// 資料結構 第7章：圖（基礎）— 表示法（Adjacency List / Adjacency Matrix / Incidence Matrix）、DFS、BFS、連通元件、生成樹。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 慣例（洪逸／Horowitz）：頂點編號 0..V−1；無向邊寫 (u,v)、有向邊寫 ⟨u,v⟩；簡單圖（無自迴圈、無重複邊）。
// 鄰接串列一律依頂點編號由小到大排列（考題沒指定順序時的常見假設），所以 DFS／BFS 順序是唯一的。
// DFS 用課本的遞迴版（畫面上的 stack = 遞迴呼叫堆疊）；BFS 在 enqueue 時就標記 visited（課本 bfs()）。
// 表示法場景沿用影片〈Graph Data Structure Intro〉的例子：A–B、B–C；有向圖 B→A、C→A；Incidence Matrix 有向時離開 −1、進入 +1。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const COL = { idle: '#cdbfa6', visit: '#2fc092', edge: '#9c8b70', tree: '#c08a1f', dim: '#e6ddcf', hot: '#d64545', one: '#4b9ee2', neg: '#e55a9b', zero: '#efe5d3', diag: '#e2d6c2' };
  const COMP = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0'];
  const UP = V3(0, 1, 0);
  const ek = (u, v) => Math.min(u, v) + '-' + Math.max(u, v);
  const glow = (m, hex) => { if (m && m.material) m.material.emissive.set(hex || '#000000'); };
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
  const withAdj = (G) => { G.adj = adjOf(G.V, G.edges); return G; };
  function randConnected(V, extra) {
    const edges = [], has = new Set();
    const add = (u, v) => {
      if (u === v || has.has(ek(u, v))) return false;
      has.add(ek(u, v)); edges.push([Math.min(u, v), Math.max(u, v)]); return true;
    };
    const p = shuffle([...Array(V).keys()]);
    for (let i = 1; i < V; i++) add(p[i], p[rnd(i)]);
    let t = 0;
    while (extra > 0 && t++ < 200) if (add(rnd(V), rnd(V))) extra--;
    return edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  // 課本 Figure 6.16 那張 8 個點的圖（DFS：0 1 3 7 4 5 2 6；BFS：0 1 2 3 4 5 6 7）
  const BOOK = {
    V: 8,
    edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7]],
    xy: [[0, -2.9], [-1.9, -1.4], [1.9, -1.4], [-2.9, 0.4], [-0.95, 0.4], [0.95, 0.4], [2.9, 0.4], [0, 2.2]],
  };
  function makeGraph(kind) {
    if (kind === 'book') return withAdj({ V: 8, edges: BOOK.edges.map((e) => e.slice()), xy: BOOK.xy });
    return withAdj({ V: 8, edges: randConnected(8, 3), xy: ringXY(8, 2.6) });
  }
  function buildGraphView(G, posFn, size, gap) {
    const verts = [], edges = new Map();
    for (let i = 0; i < G.V; i++) verts.push(vertexMesh(i, posFn(i), COL.idle, size));
    G.edges.forEach(([u, v]) => edges.set(ek(u, v), edgeMesh(posFn(u), posFn(v), { gap })));
    return { G, verts, edges };
  }
  // 依快照上色：已拜訪＝綠、目前＝發亮、樹邊＝粗金線、正在檢查的邊＝紅；走完後非樹邊變淡
  function paintGraph(gv, st) {
    const tree = new Set(st.tree.map(([a, b]) => ek(a, b)));
    const chk = st.chk ? ek(st.chk[0], st.chk[1]) : '';
    gv.verts.forEach((m, i) => {
      const c = st.comp ? (st.comp[i] >= 0 ? COMP[st.comp[i] % COMP.length] : COL.idle) : (st.vis[i] ? COL.visit : COL.idle);
      m.material.color.set(c);
      glow(m, i === st.cur ? '#8a6400' : null);
    });
    for (const [k, g] of gv.edges) {
      if (k === chk) paintEdge(g, COL.hot, true);
      else if (tree.has(k)) paintEdge(g, st.comp ? COMP[st.comp[Number(k.split('-')[0])] % COMP.length] : COL.tree, true);
      else paintEdge(g, st.final ? COL.dim : COL.edge, false);
    }
  }
  // 預先算好每一步的快照（DFS：遞迴＝stack；BFS：queue）
  function trSteps(G, kind, s) {
    const steps = [], vis = new Array(G.V).fill(false), order = [], tree = [], cont = [];
    const snap = (msg, ex = {}) => steps.push({ msg, vis: vis.slice(), order: order.slice(), tree: tree.slice(), cont: cont.slice(), cur: ex.cur ?? -1, chk: ex.chk || null, final: !!ex.final });
    vis[s] = true; order.push(s); cont.push(s);
    if (kind === 'dfs') {
      snap('dfs(' + s + ')：拜訪 ' + s + '，push', { cur: s });
      const nxt = new Array(G.V).fill(0);
      while (cont.length) {
        const u = cont[cont.length - 1], A = G.adj[u], skip = [];
        while (nxt[u] < A.length && vis[A[nxt[u]]]) skip.push(A[nxt[u]++]);
        if (nxt[u] < A.length) {
          const w = A[nxt[u]++];
          vis[w] = true; order.push(w); tree.push([u, w]); cont.push(w);
          snap((skip.length ? skip.join('、') + ' 已拜訪；' : '') + u + ' → ' + w + '：dfs(' + w + ')，push ' + w, { cur: w, chk: [u, w] });
        } else {
          cont.pop();
          snap((skip.length ? skip.join('、') + ' 已拜訪；' : '') + u + ' 沒有未拜訪的鄰居 → pop（回溯）', { cur: cont.length ? cont[cont.length - 1] : -1 });
        }
      }
    } else {
      snap('拜訪 ' + s + '，enqueue', { cur: s });
      while (cont.length) {
        const u = cont.shift();
        snap('dequeue ' + u + '，依序檢查 ' + u + ' 的鄰居', { cur: u });
        for (const w of G.adj[u]) {
          if (vis[w]) continue;
          vis[w] = true; order.push(w); tree.push([u, w]); cont.push(w);
          snap(w + ' 還沒拜訪 → 拜訪並 enqueue', { cur: u, chk: [u, w] });
        }
      }
    }
    snap('走訪完成：' + order.join(' → '), { final: true });
    return steps;
  }
  const emptyStep = (V) => ({ msg: '', vis: new Array(V).fill(false), order: [], tree: [], cont: [], cur: -1, chk: null, final: false });
  function smallBlock(v) { const m = lab.box(colorFor(v), [0.6, 0.55, 0.6]); m.add(lab.label(String(v), 'val')); return m; }
  // 讓一排 3D 方塊跟 list 同步：不在 list 的飛走、新的掉下來、其餘彈到新位置
  function syncRow(map, list, posFn) {
    for (const [v, b] of [...map]) if (!list.includes(v)) { lab.flyAway(b, V3(0, 8, 3)); map.delete(v); }
    list.forEach((v, k) => {
      let b = map.get(v);
      if (!b) {
        const m = smallBlock(v);
        m.position.copy(posFn(k)).add(V3(0, 5, 0));
        b = lab.addBody(m); map.set(v, b);
        lab.dropTo(b, posFn(k));
      } else if (b.target.distanceTo(posFn(k)) > 1e-3) lab.springTo(b, posFn(k));
    });
  }

  // ───────────────────────── 表示法：Matrix ↔ List 同步 ─────────────────────────
  const rep = { V: 6, directed: false, letters: false, view: 'adj', M: [], order: [], verts: [], edgeG: [], panel: null, cells: [], lists: [], heads: [], arrows: [], busy: false, sideTitle: null };
  const REP_DEF = { u: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5]], d: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [5, 4]] };
  // cell pitch grows for small graphs, so the 0/1 labels stay on their own row on the small stage
  // (at 0.56 the stage's label de-overlap pushed them down a row, under the wrong row name)
  const rcOf = () => (rep.V <= 3 ? 0.95 : rep.V <= 4 ? 0.75 : 0.56);
  const vn = (i) => (rep.letters ? 'ABCDEF'[i] : String(i));
  const rowZ = (i) => (i - (rep.V - 1) / 2) * rcOf() + 0.3;
  const listPos = (i, t) => V3(2.85 + 0.78 * t, 0.2, rowZ(i)); // t = 0 是 head
  const repVPos = (i) => { const [x, z] = ringXY(rep.V, rep.V <= 3 ? 1.6 : 2.1)[i]; return V3(x - 4.5, 0.3, z + 0.3); };
  const eName = (u, v) => (rep.directed ? '⟨' + vn(u) + ',' + vn(v) + '⟩' : '(' + vn(u) + ',' + vn(v) + ')');
  function parseV(id) {
    const s = String($(id) ? $(id).value : '').trim();
    if (/^[A-Fa-f]$/.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
    return /^\d+$/.test(s) ? Number(s) : NaN;
  }

  function enterRep(preset) {
    stopTimer(); lab.clear(); clearLog();
    rep.busy = false;
    rep.M = Array.from({ length: rep.V }, () => new Array(rep.V).fill(0));
    rep.order = []; rep.verts = []; rep.edgeG = []; rep.panel = null; rep.cells = [];
    rep.lists = Array.from({ length: rep.V }, () => []); rep.heads = []; rep.arrows = [];
    // 5–6 vertices: rows are only 0.56 apart, so look from higher up or the rows' values print over each other
    lab.frameCamera(rep.V >= 5 ? [0, 12.5, 4.6] : [0, 9.5, 8.6], [0, 0, 0.4]);
    for (let i = 0; i < rep.V; i++) {
      rep.verts.push(vertexMesh(vn(i), repVPos(i), colorFor(i)));
      const h = lab.box(colorFor(i), [0.5, 0.4, 0.5]);
      h.add(lab.label(vn(i), 'val'));
      h.position.copy(listPos(i, 0));
      lab.world.add(h); rep.heads.push(h);
    }
    const t2 = lab.label('Adjacency List', 'ptr'); t2.position.copy(listPos(0, 2)).add(V3(0, 0, -0.95)); lab.world.add(t2);
    const t3 = lab.label(rep.directed ? '有向圖' : '無向圖', 'ptr'); t3.position.copy(repVPos(0)).add(V3(0, 0, -1.0)); lab.world.add(t3);
    rep.sideTitle = lab.label('', 'ptr'); lab.world.add(rep.sideTitle);
    controls(
      '<select id="rDir"><option value="u">無向圖</option><option value="d">有向圖</option></select>'
      + '<select id="rView"><option value="adj">Adjacency Matrix</option><option value="inc">Incidence Matrix</option></select>'
      + '<select id="rName"><option value="n">0, 1, 2…</option><option value="l">A, B, C…</option></select>'
      + '<label>V = <input id="rV" type="number" min="3" max="6" value="' + rep.V + '"></label>'
      + '<label>u <input id="rU" style="width:46px" value="0"></label><label>v <input id="rW" style="width:46px" value="4"></label>'
      + '<button class="primary" id="rAdd">加邊</button><button id="rDel">刪邊</button>'
      + '<button id="rAsk">查 (u,v)</button><button id="rNb">列出 u 的鄰居</button>'
      + '<button id="rRand">隨機圖</button><button id="rClr">清空</button>'
    );
    $('rDir').value = rep.directed ? 'd' : 'u';
    $('rView').value = rep.view;
    $('rName').value = rep.letters ? 'l' : 'n';
    $('rDir').onchange = (e) => { rep.directed = e.target.value === 'd'; enterRep(); };
    $('rView').onchange = (e) => { rep.view = e.target.value; repRedraw(null); };
    $('rName').onchange = (e) => { rep.letters = e.target.value === 'l'; enterRep(rep.order.map((x) => x.slice())); };
    $('rV').onchange = (e) => { rep.V = Math.max(3, Math.min(6, Number(e.target.value) || 6)); enterRep(); };
    on('rAdd', () => repAdd(parseV('rU'), parseV('rW')));
    on('rDel', () => repDel(parseV('rU'), parseV('rW')));
    on('rAsk', () => repAsk(parseV('rU'), parseV('rW')));
    on('rNb', () => repNeighbors(parseV('rU')));
    on('rRand', repRandom);
    on('rClr', () => enterRep([]));
    const pre = (preset || (rep.directed ? REP_DEF.d : REP_DEF.u)).filter(([a, b]) => a < rep.V && b < rep.V);
    pre.forEach(([u, v]) => repAdd(u, v, true));
    repRedraw(null);
    log('左：圖；中：' + (rep.view === 'adj' ? 'Adjacency Matrix（有邊填 1）' : 'Incidence Matrix（列＝頂點、行＝邊）') + '；右：Adjacency List（每個頂點一條串列，存它的鄰居）。');
    log('輸入 u、v 後按「加邊」或「刪邊」，三種表示法會一起改。' + (rep.letters ? '可以輸入字母 A–F。' : ''));
  }
  function repValid(u, v) {
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 0 || v < 0 || u >= rep.V || v >= rep.V) {
      log('頂點要在 ' + vn(0) + ' 到 ' + vn(rep.V - 1) + ' 之間。', true); return false;
    }
    if (u === v) { log('本章討論簡單圖：不允許自迴圈 (' + vn(u) + ',' + vn(u) + ')。', true); return false; }
    return true;
  }
  function listInsert(i, v, quiet) {
    const m = lab.box(colorFor(v), [0.46, 0.36, 0.46]);
    m.add(lab.label(vn(v), 'val'));
    const L = rep.lists[i];
    let t = 0;
    while (t < L.length && L[t].v < v) t++;
    const target = listPos(i, t + 1);
    m.position.copy(target).add(V3(0, quiet ? 0 : 4, 0));
    const b = lab.addBody(m); b.v = v;
    L.splice(t, 0, b);
    L.forEach((nb, k) => {
      if (nb === b) { if (!quiet) lab.dropTo(b, target); }
      else lab.springTo(nb, listPos(i, k + 1));
    });
  }
  function listRemove(i, v) {
    const L = rep.lists[i];
    const t = L.findIndex((b) => b.v === v);
    if (t < 0) return;
    const [b] = L.splice(t, 1);
    lab.flyAway(b, V3(0, 7, 3));
    L.forEach((nb, k) => lab.springTo(nb, listPos(i, k + 1)));
  }
  function repAdd(u, v, quiet) {
    if (!repValid(u, v)) return false;
    if (rep.M[u][v]) { log('已經有 ' + eName(u, v) + ' 了：簡單圖不允許重複邊。', true); return false; }
    rep.M[u][v] = 1; rep.order.push([u, v]); listInsert(u, v, quiet);
    if (!rep.directed) { rep.M[v][u] = 1; listInsert(v, u, quiet); }
    if (!quiet) {
      repRedraw([u, v]);
      log('加入 ' + eName(u, v) + '：M[' + vn(u) + '][' + vn(v) + '] = 1' + (rep.directed ? '' : '、M[' + vn(v) + '][' + vn(u) + '] = 1')
        + '；' + (rep.directed ? 'list[' + vn(u) + '] 多一個 ' + vn(v) : 'list[' + vn(u) + '] 和 list[' + vn(v) + '] 各多一個節點'));
    }
    return true;
  }
  function repDel(u, v) {
    if (!repValid(u, v)) return false;
    if (!rep.M[u][v]) { log('沒有 ' + eName(u, v) + ' 這條邊，不能刪。', true); return false; }
    rep.M[u][v] = 0; listRemove(u, v);
    if (!rep.directed) { rep.M[v][u] = 0; listRemove(v, u); }
    rep.order = rep.order.filter(([a, b]) => !((a === u && b === v) || (!rep.directed && a === v && b === u)));
    repRedraw(null);
    log('刪除 ' + eName(u, v) + '：矩陣那' + (rep.directed ? '一格' : '兩格') + '變回 0，串列節點飛走。');
    return true;
  }
  function repRandom() {
    const edges = [];
    for (let u = 0; u < rep.V; u++) for (let v = 0; v < rep.V; v++) {
      if (u === v || (!rep.directed && v < u)) continue;
      if (Math.random() < (rep.directed ? 0.25 : 0.4)) edges.push([u, v]);
    }
    enterRep(edges);
    log('隨機產生 ' + edges.length + ' 條邊。');
  }
  const edgeCount = () => rep.order.length;
  function repRedraw(hl) {
    rep.edgeG.forEach(drop); rep.edgeG = [];
    for (const [u, v] of rep.order) {
      const hot = hl && ((hl[0] === u && hl[1] === v) || (!rep.directed && hl[0] === v && hl[1] === u));
      const g = edgeMesh(repVPos(u), repVPos(v), { directed: rep.directed, color: hot ? COL.tree : COL.edge, off: rep.directed && rep.M[v][u] ? 0.13 : 0, r: hot ? 0.08 : 0.05 });
      rep.edgeG.push(g);
    }
    buildPanel(hl);
    rep.arrows.forEach(drop); rep.arrows = [];
    rep.lists.forEach((L, i) => {
      const pts = [listPos(i, 0), ...L.map((b) => b.target)];
      for (let k = 0; k + 1 < pts.length; k++) {
        const from = pts[k].clone().add(V3(0.25, 0, 0));
        const a = new THREE.ArrowHelper(V3(1, 0, 0), from, Math.max(0.1, pts[k + 1].x - pts[k].x - 0.48), 0x6e5f49, 0.12, 0.1);
        lab.world.add(a); rep.arrows.push(a);
      }
    });
    renderRepState();
  }
  // 中間的矩陣面板：Adjacency（V×V）或 Incidence（V×E）
  function buildPanel(hl) {
    if (rep.panel) drop(rep.panel);
    const g = new THREE.Group();
    rep.panel = g; rep.cells = [];
    const inc = rep.view === 'inc';
    const cols = inc ? rep.order.length : rep.V;
    const RC = rcOf();
    const cw = inc ? Math.min(RC, 3.4 / Math.max(1, cols)) : RC;
    const x0 = -0.95;
    const cellAt = (i, j) => V3(x0 + j * cw, 0.05, rowZ(i));
    for (let i = 0; i < rep.V; i++) {
      rep.cells.push([]);
      for (let j = 0; j < cols; j++) {
        let val = 0;
        if (inc) {
          const [a, b] = rep.order[j];
          if (rep.directed) val = i === a ? -1 : i === b ? 1 : 0;
          else val = i === a || i === b ? 1 : 0;
        } else val = rep.M[i][j];
        const m = lab.box(val === 1 ? COL.one : val === -1 ? COL.neg : (!inc && i === j) ? COL.diag : COL.zero, [cw - 0.06, 0.1, Math.min(0.8, RC - 0.06)]);
        const p = cellAt(i, j);
        if (val) { m.scale.y = 3; p.y = 0.15; }
        m.position.copy(p);
        // values are 'val' chips: the stage keeps them on their cell (an 'idx' label got pushed a row down)
        const l = lab.label(val === -1 ? '−1' : String(val), 'val'); l.position.set(0, 0.12, 0); m.add(l);
        const isHot = hl && (inc ? j === rep.order.length - 1 && val !== 0
          : (i === hl[0] && j === hl[1]) || (!rep.directed && i === hl[1] && j === hl[0]));
        if (isHot) glow(m, '#6a4a00');
        g.add(m); rep.cells[i].push(m);
      }
      const rl = lab.label(vn(i), 'idx'); rl.position.copy(cellAt(i, 0)).add(V3(-(cw * 0.5 + 0.3), 0, 0)); g.add(rl);
    }
    for (let j = 0; j < cols; j++) {
      const cl = lab.label(inc ? 'e' + (j + 1) : vn(j), 'idx'); cl.position.copy(cellAt(0, j)).add(V3(0, 0, -(RC * 0.5 + 0.3))); g.add(cl);
    }
    rep.sideTitle.element.textContent = inc ? 'Incidence Matrix' : 'Adjacency Matrix';
    rep.sideTitle.position.copy(cellAt(0, Math.max(0, (cols - 1) / 2))).add(V3(0, 0, -(RC * 0.5 + 0.8)));
    if (inc && !cols) rep.sideTitle.element.textContent = 'Incidence Matrix（還沒有邊）';
    lab.world.add(g);
  }
  function renderRepState() {
    const V = rep.V, E = edgeCount();
    let sym = true;
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) if (rep.M[i][j] !== rep.M[j][i]) sym = false;
    const nodes = rep.directed ? E : 2 * E;
    const row = (i) => rep.M[i].reduce((s, x) => s + x, 0);
    const col = (j) => rep.M.reduce((s, r) => s + r[j], 0);
    const deg = [...Array(V).keys()].map((i) => vn(i) + ':' + (rep.directed ? row(i) + '/' + col(i) : row(i))).join('  ');
    setState((rep.directed ? '有向圖' : '無向圖') + '　V = ' + V + '，E = ' + E, [
      ['Adjacency Matrix', V + ' × ' + V + ' = ' + V * V + ' 格'],
      ['Adjacency List', V + ' 個 head + ' + nodes + ' 個節點'],
      ['Incidence Matrix', V + ' × ' + E + ' = ' + V * E + ' 格'],
      ['矩陣對稱', sym ? '是' : '否'],
      [rep.directed ? '出／入分支度' : '分支度', deg],
    ], (rep.directed ? 'out-degree(i) = 第 i 列總和；in-degree(i) = 第 i 行總和<br>' : '無向圖每條邊存兩次：M 對稱、串列共 2E 個節點<br>')
      + '空間：Matrix O(V²) = ' + V * V + '；List O(V + E) = ' + (V + nodes) + ' → '
      + (V * V <= V + nodes ? '<span class="no">很稠密，List 不比 Matrix 省</span>' : '<span class="ok">稀疏圖用 List 較省</span>'));
  }
  // 查 (u,v)：Matrix 一步；List 從 head 走
  async function repAsk(u, v, tok) {
    if (rep.busy) return;
    if (!repValid(u, v)) return;
    if (rep.view !== 'adj') { rep.view = 'adj'; if ($('rView')) $('rView').value = 'adj'; }
    rep.busy = true;
    const wait = (ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
    try {
      repRedraw(null);
      glow(rep.cells[u][v], '#8a6400');
      log('Matrix：直接看 M[' + vn(u) + '][' + vn(v) + '] = ' + rep.M[u][v] + ' → 1 步，O(1)');
      await wait(800);
      glow(rep.heads[u], '#8a6400');
      let steps = 0, found = false;
      for (const b of rep.lists[u]) {
        steps++; glow(b.obj, '#8a6400');
        await wait(450);
        if (b.v === v) { found = true; break; }
        glow(b.obj, null);
      }
      log('List：從 list[' + vn(u) + '] 開頭往後走，看了 ' + steps + ' 個節點' + (found ? '，找到 ' + vn(v) : '，沒有 ' + vn(v)) + ' → O(deg(' + vn(u) + '))');
    } finally { rep.busy = false; }
  }
  async function repNeighbors(u, tok) {
    if (rep.busy) return;
    if (!Number.isInteger(u) || u < 0 || u >= rep.V) { log('頂點要在 ' + vn(0) + ' 到 ' + vn(rep.V - 1) + ' 之間。', true); return; }
    if (rep.view !== 'adj') { rep.view = 'adj'; if ($('rView')) $('rView').value = 'adj'; }
    rep.busy = true;
    const wait = (ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
    try {
      repRedraw(null);
      for (let j = 0; j < rep.V; j++) { glow(rep.cells[u][j], rep.M[u][j] ? '#8a6400' : '#3a2a10'); await wait(260); }
      log('Matrix：第 ' + vn(u) + ' 列整列掃過 ' + rep.V + ' 格 → O(V)');
      glow(rep.heads[u], '#8a6400');
      for (const b of rep.lists[u]) { glow(b.obj, '#8a6400'); await wait(330); }
      log('List：list[' + vn(u) + '] 只有 ' + rep.lists[u].length + ' 個節點 → O(deg(' + vn(u) + '))');
    } finally { rep.busy = false; }
  }
  function repRowCol(r) {
    for (let j = 0; j < rep.V; j++) glow(rep.cells[r][j], '#8a6400');
    for (let i = 0; i < rep.V; i++) if (i !== r) glow(rep.cells[i][r], '#3a1a5a');
  }

  // ───────────────────────── DFS／BFS ─────────────────────────
  const tv = { kind: 'dfs', graph: 'book', start: 0, G: null, gv: null, steps: [], i: -1, cont: new Map(), ord: new Map(), lbA: null, lbB: null };
  const trPos = (i) => V3(tv.G.xy[i][0] - 2.4, 0.3, tv.G.xy[i][1] + 0.2);
  const stackPos = (k) => V3(4.7, 0.3 + k * 0.62, -0.6);
  const queuePos = (k) => V3(2.2 + k * 0.76, 0.28, -0.6);
  const orderPos = (k) => V3(-5.0 + k * 0.8, 0.28, 3.4);
  function enterTrav(regen) {
    stopTimer(); lab.clear(); clearLog();
    if (regen || !tv.G) tv.G = makeGraph(tv.graph);
    if (tv.start >= tv.G.V) tv.start = 0;
    tv.cont = new Map(); tv.ord = new Map();
    lab.frameCamera([0, 10, 10.5], [0, 0.4, 0.4]);
    tv.gv = buildGraphView(tv.G, trPos);
    const isS = tv.kind === 'dfs';
    const t = lab.label(isS ? 'stack（遞迴）' : 'queue', 'ptr');
    t.position.copy(isS ? stackPos(0) : queuePos(1.5)).add(V3(0, -0.2, 1.0)); lab.world.add(t);
    const o = lab.label('拜訪順序', 'idx'); o.position.copy(orderPos(0)).add(V3(-1.2, 0, 0)); lab.world.add(o);
    tv.lbA = lab.label('', 'ptr alt'); tv.lbB = lab.label('', 'ptr alt'); lab.world.add(tv.lbA, tv.lbB);
    controls(
      '<select id="tKind"><option value="dfs">DFS（stack）</option><option value="bfs">BFS（queue）</option></select>'
      + '<select id="tGraph"><option value="book">範例圖</option><option value="rand">隨機連通圖</option></select>'
      + '<label>起點 <input id="tS" type="number" min="0" max="7" value="' + tv.start + '"></label>'
      + '<button class="primary" id="tStep">下一步</button><button id="tAuto">自動播放</button><button id="tReset">重來</button>'
    );
    $('tKind').value = tv.kind; $('tGraph').value = tv.graph;
    $('tKind').onchange = (e) => { tv.kind = e.target.value; enterTrav(false); };
    $('tGraph').onchange = (e) => { tv.graph = e.target.value; enterTrav(true); };
    $('tS').onchange = (e) => {
      const s = Number(e.target.value);
      if (!Number.isInteger(s) || s < 0 || s >= tv.G.V) { log('起點要在 0 到 ' + (tv.G.V - 1) + ' 之間。', true); e.target.value = tv.start; return; }
      tv.start = s; enterTrav(false);
    };
    on('tStep', trStep);
    on('tAuto', () => { stopTimer(); timer = setInterval(() => { if (!trStep()) stopTimer(); }, 750); });
    on('tReset', () => enterTrav(false));
    tv.steps = trSteps(tv.G, tv.kind, tv.start); tv.i = -1;
    log(isS ? 'DFS（課本遞迴版）：拜訪 v 後，依序對每個「還沒拜訪」的鄰居 w 呼叫 dfs(w)。右邊的 stack 就是遞迴呼叫堆疊。'
      : 'BFS（課本版）：拜訪起點並 enqueue；每次 dequeue 一個 v，把 v 所有還沒拜訪的鄰居「拜訪並 enqueue」。');
    log('鄰接串列（由小到大）：' + tv.G.adj.map((l, i) => i + '→' + (l.join(',') || '∅')).join('　'));
    trShow(emptyStep(tv.G.V));
  }
  function trStep() {
    if (tv.i >= tv.steps.length - 1) { log('已經走完了，按「重來」或換起點。'); return false; }
    tv.i++;
    const st = tv.steps[tv.i];
    trShow(st); log(st.msg);
    return tv.i < tv.steps.length - 1;
  }
  function trShow(st) {
    paintGraph(tv.gv, st);
    const isS = tv.kind === 'dfs';
    syncRow(tv.cont, st.cont, isS ? stackPos : queuePos);
    syncRow(tv.ord, st.order, orderPos);
    const n = st.cont.length;
    if (isS) {
      tv.lbA.element.textContent = 'top';
      tv.lbA.position.copy(stackPos(Math.max(0, n - 1))).add(V3(0.95, 0, 0));
      tv.lbA.element.style.display = n ? '' : 'none';
      tv.lbB.element.style.display = 'none';
    } else {
      tv.lbA.element.textContent = 'front'; tv.lbB.element.textContent = 'rear';
      tv.lbA.position.copy(queuePos(0)).add(V3(0, 0, -0.75));
      tv.lbB.position.copy(queuePos(Math.max(0, n - 1))).add(V3(0, 0, 0.75));
      tv.lbA.element.style.display = tv.lbB.element.style.display = n ? '' : 'none';
    }
    setState((isS ? 'DFS（遞迴 = stack）' : 'BFS（queue）') + '，起點 ' + tv.start, [
      ['第幾步', (tv.i + 1) + ' / ' + tv.steps.length],
      [isS ? 'stack（底→頂）' : 'queue（front→rear）', n ? st.cont.join(' ') : '空'],
      ['拜訪順序', st.order.join(' → ') || '—'],
      ['樹邊', st.tree.length + ' 條'],
    ], 'Adjacency List：每個點拜訪一次、每條邊看兩次 → <span class="ok">O(V + E)</span><br>Adjacency Matrix：每個點都要掃一整列 → O(V²)');
  }

  // ───────────────────────── 連通元件 ─────────────────────────
  const cp = { G: null, gv: null, steps: [], i: -1, ptr: null };
  function makeCompGraph() {
    const V = 9;
    for (let t = 0; t < 50; t++) {
      const k = 2 + rnd(3);
      const ids = shuffle([...Array(V).keys()]);
      const cuts = shuffle([...Array(V - 1).keys()].map((x) => x + 1)).slice(0, k - 1).sort((a, b) => a - b);
      const groups = []; let prev = 0;
      [...cuts, V].forEach((c) => { groups.push(ids.slice(prev, c)); prev = c; });
      if (groups.some((g) => g.length > 5)) continue;
      const edges = [], xy = new Array(V), has = new Set();
      groups.forEach((g, gi) => {
        const ang = Math.PI / 2 - gi * 2 * Math.PI / k;
        const cx = Math.cos(ang) * 3.2, cz = -Math.sin(ang) * 2.4;
        const r = g.length === 1 ? 0 : 0.45 + 0.25 * g.length;
        g.forEach((v, j) => { const a = Math.PI / 2 - j * 2 * Math.PI / g.length; xy[v] = [cx + Math.cos(a) * r, cz - Math.sin(a) * r]; });
        for (let j = 1; j < g.length; j++) { const p = g[rnd(j)]; has.add(ek(g[j], p)); edges.push([Math.min(g[j], p), Math.max(g[j], p)]); }
        if (g.length >= 4) {
          const a = g[rnd(g.length)], b = g[rnd(g.length)];
          if (a !== b && !has.has(ek(a, b))) { has.add(ek(a, b)); edges.push([Math.min(a, b), Math.max(a, b)]); }
        }
      });
      return withAdj({ V, edges, xy, k });
    }
    return withAdj({ V: 9, edges: [[0, 4], [4, 7], [1, 5], [2, 3], [3, 8], [6, 8]], xy: ringXY(9, 3), k: 3 });
  }
  function compSteps(G) {
    const steps = [], comp = new Array(G.V).fill(-1), tree = [];
    let count = 0;
    const snap = (msg, i, cur) => steps.push({ msg, comp: comp.slice(), tree: tree.slice(), i, cur, count, vis: [], final: i < 0 });
    for (let i = 0; i < G.V; i++) {
      if (comp[i] >= 0) { snap('i = ' + i + '：已經拜訪過，跳過', i, -1); continue; }
      count++;
      const c = count - 1;
      comp[i] = c;
      snap('i = ' + i + ' 還沒拜訪 → count = ' + count + '，呼叫 dfs(' + i + ')', i, i);
      const st = [i], nxt = {};
      while (st.length) {
        const u = st[st.length - 1], A = G.adj[u];
        nxt[u] = nxt[u] || 0;
        while (nxt[u] < A.length && comp[A[nxt[u]]] >= 0) nxt[u]++;
        if (nxt[u] < A.length) {
          const w = A[nxt[u]++];
          comp[w] = c; tree.push([u, w]); st.push(w);
          snap('  dfs 走到 ' + w + '（第 ' + count + ' 個元件）', i, w);
        } else st.pop();
      }
    }
    snap('外層迴圈結束：共 ' + count + ' 個連通元件', -1, -1);
    return steps;
  }
  const cpPos = (i) => V3(cp.G.xy[i][0], 0.3, cp.G.xy[i][1] + 0.3);
  function enterComp(regen = true) {
    stopTimer(); lab.clear(); clearLog();
    if (regen || !cp.G) cp.G = makeCompGraph();
    lab.frameCamera([0, 11, 8.5], [0, 0, 0.3]);
    cp.gv = buildGraphView(cp.G, cpPos);
    cp.ptr = lab.label('i', 'ptr alt'); cp.ptr.element.style.display = 'none'; lab.world.add(cp.ptr);
    controls('<button class="primary" id="cStep">下一步</button><button id="cAuto">自動播放</button><button id="cNew">換一張圖</button><button id="cReset">重來</button>');
    on('cStep', compStep);
    on('cAuto', () => { stopTimer(); timer = setInterval(() => { if (!compStep()) stopTimer(); }, 650); });
    on('cNew', () => enterComp(true));
    on('cReset', () => enterComp(false));
    cp.steps = compSteps(cp.G); cp.i = -1;
    log('課本 connected()：for (i = 0; i < n; i++) if (!visited[i]) { dfs(i); 印出一個元件 }');
    log('外層迴圈呼叫 dfs 幾次，就有幾個連通元件。');
    compShow({ comp: new Array(cp.G.V).fill(-1), tree: [], i: -1, cur: -1, count: 0, vis: [] });
  }
  function compStep() {
    if (cp.i >= cp.steps.length - 1) { log('已經做完了，按「換一張圖」再試。'); return false; }
    cp.i++;
    const st = cp.steps[cp.i];
    compShow(st); log(st.msg);
    return cp.i < cp.steps.length - 1;
  }
  function compShow(st) {
    paintGraph(cp.gv, st);
    if (st.i >= 0) { cp.ptr.element.style.display = ''; cp.ptr.element.textContent = 'i = ' + st.i; cp.ptr.position.copy(cpPos(st.i)).add(V3(0, 1.0, 0)); }
    else cp.ptr.element.style.display = 'none';
    setState('連通元件（V = ' + cp.G.V + '，E = ' + cp.G.edges.length + '）', [
      ['外層 i', st.i >= 0 ? String(st.i) : '—'],
      ['count（呼叫 dfs 次數）', String(st.count)],
      ['已拜訪', st.comp.filter((c) => c >= 0).length + ' / ' + cp.G.V],
    ], '同一個顏色 = 同一個連通元件；粗線 = 生成森林的樹邊<br>總時間：List O(V + E)，Matrix O(V²)');
  }

  // ───────────────────────── 生成樹：DFS 樹 vs BFS 樹 ─────────────────────────
  const sp = { graph: 'book', start: 0, G: null, L: null, R: null, sL: [], sR: [], i: -1 };
  const spPos = (side) => (i) => V3(sp.G.xy[i][0] * 0.62 + side * 3.7, 0.25, sp.G.xy[i][1] * 0.62 + 0.4);
  function enterSpan(regen) {
    stopTimer(); lab.clear(); clearLog();
    if (regen || !sp.G) sp.G = makeGraph(sp.graph);
    if (sp.start >= sp.G.V) sp.start = 0;
    lab.frameCamera([0, 9.5, 8.5], [0, 0, 0.4]);
    sp.L = buildGraphView(sp.G, spPos(-1), [0.6, 0.45, 0.6], 0.4);
    sp.R = buildGraphView(sp.G, spPos(1), [0.6, 0.45, 0.6], 0.4);
    const a = lab.label('DFS 生成樹', 'ptr'); a.position.set(-3.7, 0.3, -2.2); lab.world.add(a);
    const b = lab.label('BFS 生成樹', 'ptr'); b.position.set(3.7, 0.3, -2.2); lab.world.add(b);
    controls(
      '<select id="sG"><option value="book">範例圖</option><option value="rand">隨機連通圖</option></select>'
      + '<label>起點 <input id="sS" type="number" min="0" max="7" value="' + sp.start + '"></label>'
      + '<button class="primary" id="sStep">下一步</button><button id="sAuto">自動播放</button><button id="sAll">直接完成</button>'
      + '<button id="sCyc">加一條非樹邊</button><button id="sReset">重來</button>'
    );
    $('sG').value = sp.graph;
    $('sG').onchange = (e) => { sp.graph = e.target.value; enterSpan(true); };
    $('sS').onchange = (e) => {
      const s = Number(e.target.value);
      if (!Number.isInteger(s) || s < 0 || s >= sp.G.V) { log('起點要在 0 到 ' + (sp.G.V - 1) + ' 之間。', true); e.target.value = sp.start; return; }
      sp.start = s; enterSpan(false);
    };
    on('sStep', spStep);
    on('sAuto', () => { stopTimer(); timer = setInterval(() => { if (!spStep()) stopTimer(); }, 650); });
    on('sAll', () => { stopTimer(); while (spStep()); });
    on('sCyc', spCycle);
    on('sReset', () => enterSpan(false));
    sp.sL = trSteps(sp.G, 'dfs', sp.start); sp.sR = trSteps(sp.G, 'bfs', sp.start); sp.i = -1;
    log('同一張圖、同一個起點：走訪時「發現新點」用到的邊就是樹邊，V 個點一定剛好 V − 1 條。');
    const e0 = emptyStep(sp.G.V);
    paintGraph(sp.L, e0); paintGraph(sp.R, e0); spState(e0, e0);
  }
  const spMax = () => Math.max(sp.sL.length, sp.sR.length) - 1;
  function spStep() {
    if (sp.i >= spMax()) return false;
    sp.i++;
    const a = sp.sL[Math.min(sp.i, sp.sL.length - 1)], b = sp.sR[Math.min(sp.i, sp.sR.length - 1)];
    paintGraph(sp.L, a); paintGraph(sp.R, b);
    if (sp.i < sp.sL.length) log('DFS：' + a.msg);
    if (sp.i < sp.sR.length) log('BFS：' + b.msg);
    spState(a, b);
    return sp.i < spMax();
  }
  function spState(a, b) {
    const fmt = (t) => t.map(([u, v]) => '(' + u + ',' + v + ')').join(' ') || '—';
    setState('DFS 樹 vs BFS 樹（起點 ' + sp.start + '）', [
      ['DFS 樹邊', fmt(a.tree)], ['BFS 樹邊', fmt(b.tree)], ['樹邊數', a.tree.length + ' / ' + b.tree.length + '（應為 V − 1 = ' + (sp.G.V - 1) + '）'],
    ], 'V 個點的生成樹：恰 V − 1 條邊、沒有 cycle<br>DFS 樹又深又長；BFS 樹一層一層，起點到每點的邊數最少');
  }
  function treePath(tree, V, s, t) {
    const A = Array.from({ length: V }, () => []);
    tree.forEach(([u, v]) => { A[u].push(v); A[v].push(u); });
    const par = new Array(V).fill(-2); par[s] = -1;
    const q = [s];
    while (q.length) { const u = q.shift(); for (const w of A[u]) if (par[w] === -2) { par[w] = u; q.push(w); } }
    const path = [];
    for (let x = t; x !== -1 && x !== -2; x = par[x]) path.push(x);
    return path.reverse();
  }
  function spCycle() {
    if (sp.i < spMax()) { log('先把兩棵生成樹都建完（按「直接完成」），再加非樹邊。', true); return false; }
    let any = false;
    [[sp.L, sp.sL, 'DFS'], [sp.R, sp.sR, 'BFS']].forEach(([gv, steps, nm]) => {
      const last = steps[steps.length - 1];
      paintGraph(gv, last);
      const ts = new Set(last.tree.map(([a, b]) => ek(a, b)));
      const non = sp.G.edges.filter(([u, v]) => !ts.has(ek(u, v)));
      if (!non.length) { log(nm + '：沒有非樹邊，這張圖本身就是一棵樹。', true); return; }
      any = true;
      const [u, v] = non[rnd(non.length)];
      const path = treePath(last.tree, sp.G.V, u, v);
      for (let k = 0; k + 1 < path.length; k++) paintEdge(gv.edges.get(ek(path[k], path[k + 1])), COL.hot, true);
      paintEdge(gv.edges.get(ek(u, v)), COL.hot, true);
      log(nm + ' 樹加上 (' + u + ',' + v + ')：' + path.join(' → ') + ' → ' + u + ' 形成 cycle，就不再是樹。');
    });
    return any;
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    const rows = [
      ['空間', 'O(V²)', 'O(V + E)', 'O(V·E)'],
      ['判斷 (u,v) 有沒有邊', 'O(1)', 'O(deg(u))', 'O(E)'],
      ['找 u 的所有鄰居', 'O(V)', 'O(deg(u))', 'O(E)'],
      ['算出總邊數 E', 'O(V²)', 'O(V + E)', '直接看行數'],
      ['DFS／BFS 整張圖', 'O(V²)', 'O(V + E)', '—'],
      ['無向圖 deg(i)', '第 i 列總和', 'list[i] 的節點數', '第 i 列總和'],
      ['有向圖 out／in-degree', '第 i 列／第 i 行總和', 'list[i] 節點數／掃全部串列 O(V + E)', '−1 的個數／+1 的個數'],
      ['適合', '稠密圖', '稀疏圖（E ≪ V²）', '—'],
    ];
    const cls = (t) => (/^O\(1\)$|O\(deg|O\(V \+ E\)$/.test(t) ? 'o1' : /O\(V²\)|O\(V·E\)/.test(t) ? 'on' : '');
    el.innerHTML = '<h2>三種表示法比較</h2>'
      + '<p>Adjacency Matrix 用空間換「O(1) 查邊」；Adjacency List 只存真的存在的邊，走訪整張圖是 O(V + E)。Incidence Matrix 是列＝頂點、行＝邊的 V × E 表。</p>'
      + '<table class="lab-table"><thead><tr><th>操作</th><th>Adjacency Matrix</th><th>Adjacency List</th><th>Incidence Matrix</th></tr></thead><tbody>'
      + rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td class="' + cls(c) + '">' + esc(c) + '</td>' : '<th>' + esc(c) + '</th>')).join('') + '</tr>').join('')
      + '</tbody></table><p class="src">Adjacency List 的節點數：無向圖 2E、有向圖 E；再加上 V 個 head。無向圖的矩陣可以只存上三角 V(V−1)/2 格。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">無向圖的 Adjacency Matrix 一定對稱（M[i][j] = M[j][i]）；有向圖不一定。有向圖的 out-degree 看「列」，in-degree 看「行」。</div>'
      + '<div class="lab-trap">n 個點的簡單無向圖最多 n(n−1)/2 條邊，有向圖最多 n(n−1) 條。</div>'
      + '<div class="lab-trap">DFS／BFS 的順序取決於鄰接串列的順序；題目沒說時通常照編號由小到大。BFS 在 enqueue 時就標記 visited，同一個點不會進 queue 兩次。</div>'
      + '<div class="lab-trap">用 Adjacency Matrix 做 DFS／BFS 是 O(V²)，不是 O(V + E)：找鄰居得掃整列。</div>'
      + '<div class="lab-trap">連通元件數 = connected() 外層迴圈呼叫 dfs（或 bfs）的次數；每個元件的樹邊合起來是生成森林，邊數 = V − 元件數。</div>';
  }

  const qz = { score: 0, total: 0 };
  function orderOf(G, kind, s) { const st = trSteps(G, kind, s); return st[st.length - 1].order; }
  function fillOpts(set, maker, n = 4) { let t = 0; while (set.size < n && t++ < 80) set.add(maker()); return [...set]; }
  const GENS = [
    () => { // DFS / BFS 順序
      const V = 6, edges = randConnected(V, 2 + rnd(2));
      const G = withAdj({ V, edges });
      const s = rnd(3) ? 0 : rnd(V);
      const kind = rnd(2) ? 'dfs' : 'bfs';
      const dfs = orderOf(G, 'dfs', s).join(' '), bfs = orderOf(G, 'bfs', s).join(' ');
      const ans = kind === 'dfs' ? dfs : bfs;
      const rev = orderOf({ V, adj: G.adj.map((l) => l.slice().reverse()) }, kind, s).join(' ');
      const opts = fillOpts(new Set([ans, kind === 'dfs' ? bfs : dfs, rev]), () => [s, ...shuffle([...Array(V).keys()].filter((x) => x !== s))].join(' '));
      return { q: '無向圖 V = 6，邊：' + edges.map((e) => '(' + e + ')').join(' ') + '。鄰居依編號由小到大，從 ' + s + ' 開始做 ' + kind.toUpperCase() + '，拜訪順序是？',
        opts, ans, why: kind === 'dfs' ? '每到一個點就先走「編號最小、還沒拜訪」的鄰居，走不下去才退回。DFS = ' + dfs + '（BFS 會是 ' + bfs + '）'
          : '一層一層：先把起點的鄰居全部拜訪完，再處理鄰居的鄰居。BFS = ' + bfs + '（DFS 會是 ' + dfs + '）' };
    },
    () => { // 空間
      const V = [8, 10, 20, 50, 100][rnd(5)], E = V + rnd(V * 2), dir = rnd(2) === 1;
      if (rnd(2)) {
        const ans = String(dir ? E : 2 * E);
        return { q: (dir ? '有向圖' : '無向圖') + '有 V = ' + V + ' 個頂點、E = ' + E + ' 條邊，用 Adjacency List 表示，串列裡（不含 head）共有幾個節點？',
          opts: [...new Set([ans, String(dir ? 2 * E : E), String(V + E), String(V * V)])], ans,
          why: dir ? '有向邊 ⟨u,v⟩ 只出現在 list[u]，共 E 個節點。' : '無向邊 (u,v) 同時出現在 list[u] 和 list[v]，共 2E 個節點。' };
      }
      const ans = String(V * V);
      return { q: 'V = ' + V + '、E = ' + E + ' 的圖用 Adjacency Matrix 表示，需要幾格？', opts: [...new Set([ans, String(V + E), String(V * (V - 1) / 2), String(2 * E)])], ans,
        why: '不管有幾條邊，矩陣都是 V × V = ' + ans + ' 格，空間 O(V²)。' };
    },
    () => { // in/out-degree
      const n = 4, M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i !== j && Math.random() < 0.45 ? 1 : 0)));
      const k = rnd(n), out = M[k].reduce((s, x) => s + x, 0), inn = M.reduce((s, r) => s + r[k], 0);
      const askIn = rnd(2) === 1, ans = String(askIn ? inn : out);
      const opts = fillOpts(new Set([ans, String(askIn ? out : inn), String(inn + out)]), () => String(rnd(4)));
      return { q: '有向圖的 Adjacency Matrix（第 i 列第 j 行 = 1 表示 ⟨i,j⟩）：\n' + M.map((r) => r.join(' ')).join('\n') + '\n頂點 ' + k + ' 的 ' + (askIn ? 'in-degree' : 'out-degree') + ' 是？',
        opts, ans, why: (askIn ? 'in-degree 看第 ' + k + ' 行（直的）總和 = ' + inn : 'out-degree 看第 ' + k + ' 列（橫的）總和 = ' + out) + '。列 = 出發，行 = 抵達。' };
    },
    () => { // 連通元件
      const G = makeCompGraph(), cnt = G.k, ans = String(cnt);
      const opts = fillOpts(new Set([ans, String(cnt + 1), String(Math.max(1, cnt - 1))]), () => String(1 + rnd(5)));
      return { q: '無向圖 V = 9（0–8），邊：' + G.edges.map((e) => '(' + e + ')').join(' ') + '。共有幾個連通元件？', opts, ans,
        why: '從 0 到 8 依序找還沒拜訪的點，每找到一個就 dfs 一次，共 ' + cnt + ' 次。孤立點自己也算一個元件。' };
    },
    () => { // 最多幾條邊
      const n = 5 + rnd(8), dir = rnd(2) === 1, ans = String(dir ? n * (n - 1) : n * (n - 1) / 2);
      return { q: n + ' 個頂點的簡單' + (dir ? '有向圖' : '無向圖') + '最多有幾條邊？', opts: [...new Set([ans, String(dir ? n * (n - 1) / 2 : n * (n - 1)), String(n * n), String(n - 1)])], ans,
        why: dir ? '每個有序對 ⟨i,j⟩（i ≠ j）都可以有一條：n(n−1)。' : '每兩點最多一條：C(n,2) = n(n−1)/2。' };
    },
    () => { // 複雜度觀念
      const pool = [
        { q: '圖用 Adjacency Matrix 表示時，DFS 走完整張圖的時間？', opts: ['O(V + E)', 'O(V²)', 'O(E log V)', 'O(V·E)'], ans: 'O(V²)', why: '每個點都要掃一整列（V 格）找鄰居，V 個點就是 V²。' },
        { q: '圖用 Adjacency List 表示時，BFS 走完整張圖的時間？', opts: ['O(V + E)', 'O(V²)', 'O(E log V)', 'O(V·E)'], ans: 'O(V + E)', why: '每個點進出 queue 一次、每條串列節點看一次（無向圖 2E 個）。' },
        { q: '用 Adjacency List 判斷 (u,v) 是否相鄰，最壞要？', opts: ['O(1)', 'O(deg(u))', 'O(V²)', 'O(log V)'], ans: 'O(deg(u))', why: '要從 list[u] 開頭一路找 v；Matrix 才是 O(1)。' },
        { q: '有向圖用 Adjacency List 表示，求某點的 in-degree 要？', opts: ['O(1)', 'O(deg(u))', 'O(V + E)', 'O(log V)'], ans: 'O(V + E)', why: '指向它的邊散在別人的串列裡，要全部掃過（或另建 inverse adjacency list）。' },
        { q: 'V 個點的連通無向圖，生成樹有幾條邊？', opts: ['V', 'V − 1', 'E − V', '2V − 1'], ans: 'V − 1', why: '樹 = 連通且無 cycle，V 個點恰 V − 1 條邊；再多一條就有 cycle。' },
        { q: '無向圖的 Adjacency Matrix 有什麼性質？', opts: ['一定對稱', '一定是上三角', '對角線全為 1', '每列總和相同'], ans: '一定對稱', why: '(u,v) 和 (v,u) 是同一條邊，所以 M[u][v] = M[v][u]。' },
      ];
      return pool[rnd(pool.length)];
    },
  ];
  function renderQuiz(el) {
    const p = GENS[rnd(GENS.length)]();
    let opts = [...new Set(p.opts)];
    if (!opts.includes(p.ans)) opts[0] = p.ans;
    opts = shuffle(opts);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qz.score + ' / ' + qz.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + esc(p.q) + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + esc(o) + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pick = decodeURIComponent(btn.dataset.o);
        qz.total++; if (pick === p.ans) qz.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + esc(p.why) + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 舞台場景 ─────────────────────────
  const scenes = {
    // 影片〈Graph Data Structure Intro〉：A–B、B–C；先 adjacency list，再 adjacency matrix（3 × 3）
    'graph-representations': { title: '無向圖：Adjacency List 與 Matrix', play: async (tok) => {
      rep.V = 3; rep.directed = false; rep.letters = true; rep.view = 'adj'; enterRep([]);
      say('圖 = 頂點（vertex）＋ 邊（edge）', '無向圖：邊沒有方向，像「朋友關係」');
      await beat(tok, 2600);
      repAdd(0, 1);
      say('A 連到 B：list[A] 有 B，list[B] 有 A', 'M[A][B] = M[B][A] = 1');
      await beat(tok, 2800);
      repAdd(1, 2);
      say('B 連到 C：B 的串列變成 A、C', 'A → B　B → A, C　C → B');
      await beat(tok, 2800);
      say('Matrix 是 3 × 3：有邊填 1、沒邊填 0', '<span class="ok">無向圖的矩陣對稱</span>');
      await beat(tok, 2800);
      say('問 A、C 相鄰嗎？Matrix 一格就知道', 'Matrix O(1)　List O(deg)');
      await repAsk(0, 2, tok);
      await beat(tok, 3600);
    } },
    // 影片：有向圖例子 —— 第二個點指向第一個、第三個點指向第一個
    'directed-matrix': { title: '有向圖：矩陣不對稱', play: async (tok) => {
      rep.V = 3; rep.directed = true; rep.letters = true; rep.view = 'adj'; enterRep([]);
      say('有向圖：邊有方向，像網頁連結', '⟨u,v⟩：從 u 指向 v');
      await beat(tok, 2400);
      repAdd(1, 0);
      say('B → A：只有 M[B][A] = 1', 'list[B] 多一個 A，list[A] 不變');
      await beat(tok, 2800);
      repAdd(2, 0);
      say('C → A：只有 M[C][A] = 1', '兩條邊 → 矩陣裡只有兩個 1');
      await beat(tok, 2800);
      repRedraw(null); repRowCol(0);
      say('有向圖的矩陣不一定對稱', '<span class="no">M[B][A] = 1，但 M[A][B] = 0</span>');
      await beat(tok, 2800);
      say('A 那一列總和 = out-degree，那一行總和 = in-degree', 'out(A) = 0　in(A) = 2');
      await beat(tok, 4200);
    } },
    // 影片：第三種表示法 Incidence Matrix（列 = 頂點、行 = 邊；有向圖離開 −1、進入 +1）
    'incidence-matrix': { title: 'Incidence Matrix：列是頂點、行是邊', play: async (tok) => {
      rep.V = 3; rep.directed = false; rep.letters = true; rep.view = 'inc'; enterRep([]);
      say('Incidence Matrix：列 = 頂點，行 = 邊', '大小 V × E，列數和行數可以不一樣');
      await beat(tok, 2600);
      repAdd(0, 1);
      say('e1 連接 A、B：e1 那一行在 A、B 填 1', '每一行剛好兩個 1');
      await beat(tok, 2800);
      repAdd(1, 2);
      say('e2 連接 B、C', 'B 那一列有兩個 1 → deg(B) = 2');
      await beat(tok, 2800);
      rep.directed = true; enterRep([[1, 0], [2, 0]]); rep.view = 'inc'; repRedraw([2, 0]);
      say('有向圖：離開的點填 −1，進入的點填 +1', 'e1 = ⟨B,A⟩：B 是 −1，A 是 +1');
      await beat(tok, 3200);
      say('A 那一列有兩個 +1：兩條邊指進 A', 'in-degree(A) = 2');
      await beat(tok, 3800);
      rep.view = 'adj';
    } },
    'space-sparse-dense': { title: '空間：Matrix O(V²) vs List O(V+E)', play: async (tok) => {
      rep.V = 6; rep.directed = false; rep.letters = false; rep.view = 'adj'; enterRep([[0, 1], [2, 3], [4, 5]]);
      say('稀疏圖：6 個點只有 3 條邊', 'Matrix 36 格　List 6 + 2·3 = 12');
      await beat(tok, 3000);
      const all = [];
      for (let u = 0; u < 6; u++) for (let v = u + 1; v < 6; v++) if (!rep.M[u][v]) all.push([u, v]);
      for (const [u, v] of all) {
        repAdd(u, v);
        const E = edgeCount();
        say('一直加邊……', 'E = ' + E + '：List = 6 + 2·' + E + ' = ' + (6 + 2 * E) + '　Matrix 還是 36');
        await beat(tok, 650);
      }
      say('完全圖：E = V(V−1)/2 = 15', 'List = 6 + 30 = 36 → 稠密圖時 O(V + E) ≈ O(V²)');
      await beat(tok, 4400);
    } },
    'dfs-stack': { title: 'DFS：遞迴走到底再回溯（stack）', play: async (tok) => {
      tv.kind = 'dfs'; tv.graph = 'book'; tv.start = (ctx.params || {}).start || 0; enterTrav(true);
      say('DFS：一路往深處走，走不下去就退回', '遞迴呼叫堆疊 = stack');
      await beat(tok, 2000);
      while (tv.i < tv.steps.length - 1) {
        trStep();
        const st = tv.steps[tv.i];
        say(st.msg, 'stack：' + (st.cont.join(' ') || '空') + '　順序：' + st.order.join(' '));
        await beat(tok, 1200);
      }
      say('DFS 順序：' + tv.steps[tv.steps.length - 1].order.join(' '), '<span class="ok">Adjacency List：O(V + E)</span>');
      await beat(tok, 3000);
    } },
    'bfs-queue': { title: 'BFS：一層一層往外擴（queue）', play: async (tok) => {
      tv.kind = 'bfs'; tv.graph = 'book'; tv.start = (ctx.params || {}).start || 0; enterTrav(true);
      say('BFS：先拜訪所有鄰居，再往下一層', '容器換成 queue');
      await beat(tok, 2000);
      while (tv.i < tv.steps.length - 1) {
        trStep();
        const st = tv.steps[tv.i];
        say(st.msg, 'queue：' + (st.cont.join(' ') || '空') + '　順序：' + st.order.join(' '));
        await beat(tok, 1150);
      }
      say('BFS 順序：' + tv.steps[tv.steps.length - 1].order.join(' '), '<span class="ok">Adjacency List：O(V + E)</span>');
      await beat(tok, 3000);
    } },
    'connected-components': { title: '連通元件：呼叫幾次 dfs', play: async (tok) => {
      enterComp(true);
      say('不連通的圖：一次 dfs 走不完', 'for i = 0..V−1：沒拜訪過就 dfs(i)');
      await beat(tok, 2200);
      while (cp.i < cp.steps.length - 1) {
        compStep();
        const st = cp.steps[cp.i];
        say(st.msg.trim(), 'count = ' + st.count);
        await beat(tok, 900);
      }
      say('呼叫 dfs 的次數 = 連通元件數', '<span class="ok">共 ' + cp.steps[cp.steps.length - 1].count + ' 個元件</span>');
      await beat(tok, 3000);
    } },
    'spanning-tree': { title: 'DFS 生成樹 vs BFS 生成樹', play: async (tok) => {
      sp.graph = 'book'; sp.start = 0; enterSpan(true);
      say('同一張圖：DFS 和 BFS 各長出一棵生成樹', '發現新點時走的邊 = 樹邊');
      await beat(tok, 2000);
      while (spStep()) await beat(tok, 750);
      say('兩棵樹都是 V − 1 = 7 條邊', 'DFS 樹深、BFS 樹寬');
      await beat(tok, 2800);
      spCycle();
      say('再加任何一條非樹邊，就形成 cycle', '<span class="no">樹 + 1 條邊 = 有 cycle</span>');
      await beat(tok, 3200);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ grapha.js ═══
  {
const { V3, fresh, tag, cube, glow, relabel, code, arrow, GOLD, step, buddy, prop, bob, travel, remove, anim } = K;
// ─── DBRW8nwZV-g：Graph Data Structure Intro（表示法）— cued: every step(tok) waits for the sentence it shows ───
// People are buddies, web pages are little monitors; the matrix scenes are cued copies of the module's
// graph-representations / directed-matrix / incidence-matrix (same A–B、B–C example as the video).
const GV = '#4b9ee2', GP = '#9b7ef4', GO = '#dd8238';
function gaV(name, x, z, color) { return cube(name, color || GV, [0.9, 0.7, 0.9], x, 0.35, z, 3); }
const gaPos = (a) => (a.g ? a.g.position : a.position);
function gaLine(a, b, color = '#9c8b70') {
  const p = gaPos(a), q = gaPos(b);
  const l = new ctx.THREE.Line(new ctx.THREE.BufferGeometry().setFromPoints([V3(p.x, 0.35, p.z), V3(q.x, 0.35, q.z)]), new ctx.THREE.LineBasicMaterial({ color }));
  ctx.lab.world.add(l); return l;
}
// directed edge: arrow from a to b, stopping short of b
function gaArc(a, b, color = 0x9c8b70) {
  const pa = gaPos(a), pb = gaPos(b);
  const p = V3(pa.x, 0.35, pa.z), q = V3(pb.x, 0.35, pb.z);
  const d = q.clone().sub(p).normalize();
  return arrow(p.clone().addScaledVector(d, 0.7), q.clone().addScaledVector(d, -0.75), color);
}
// a little tag that walks along an edge (a message, a friendship…)
async function gaWalk(tok, text, a, b, ms = 900, cls = 'pkt') {
  const pa = gaPos(a), pb = gaPos(b);
  const t = tag(text, cls, pa.x, 1.4, pa.z);
  await travel(tok, t, V3(pa.x, 1.4, pa.z), V3(pb.x, 1.4, pb.z), ms);
  return t;
}

// 00:05 graph = nodes + edges；undirected vs directed
FRAG.push(['grapha-types', 'Graph：node、edge，有向與無向', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.4, 0]);
  await step(tok);                                   // 0:05 not the graph from math class
  const m1 = tag('數學課的 graph：y = f(x) 的曲線', 'note', 0, 1.8, -2.6);
  const m2 = tag('✗ 這一章說的不是它', 'bad', 0, 1.0, -2.6);
  say('Graph 資料結構 ≠ 數學課的函數圖');
  await step(tok);                                   // 0:08 collections of things and their connections
  remove(m1); remove(m2);
  const you = buddy('你', '', '#7cb8ee', -4.4, 0, 1.6, 0.8), a = buddy('小明', '', '#f4a56a', -2.0, 0, -1.4, 0.8), b = buddy('小華', '', '#9ed49a', -5.8, 0, -1.8, 0.8);
  const ls = [[you, a], [you, b], [a, b]].map(([p, q]) => gaLine(p, q));
  say('graph：一群東西＋它們之間的關係');
  await step(tok);                                   // 0:12 the data are nodes / vertices
  tag('node（vertex）', 'ptr', -3.8, 2.2, -1.6);
  for (const x of [you, a, b]) x.mood('wow');
  say('每一個資料叫 node，也叫 vertex');
  await step(tok);                                   // 0:17 the connections are edges
  ls.forEach((l) => l.material.color.set('#c08a1f'));
  tag('edge', 'ptr alt', -3.2, 0.9, 0.2);
  say('點和點之間的連線叫 edge');
  await step(tok);                                   // 0:22 social network: people + friendships
  for (const x of [you, a, b]) x.mood('happy');
  await you.hop(tok);
  tag('社群網路：node = 人，edge = 是不是朋友', 'say', -3.8, 0.2, 3.2);
  say('例子：social network', 'node = 你和其他人，edge = 兩人是朋友');
  await step(tok);                                   // 0:30 two major types
  tag('兩大類：undirected ｜ directed', 'note', 0, 2.6, -3.4);
  say('graph 分兩大類', 'directed（有向）與 undirected（無向）');
  await step(tok);                                   // 0:35 undirected: no direction on edges
  tag('undirected：邊沒有方向', 'ptr', -3.8, 0, 3.9);
  say('undirected graph：邊沒有方向', '連線就是連線，不分誰指向誰');
  await step(tok);                                   // 0:40 directed: edges have a direction
  const p1 = prop('monitor', 2.4, 0, 1.4, 0.7, '頁 1'), p2 = prop('monitor', 5.4, 0, 1.0, 0.7, '頁 2'), p3 = prop('monitor', 4.0, 0, -2.0, 0.7, '頁 3');
  for (const [p, q] of [[p1, p2], [p1, p3], [p3, p2]]) gaArc(p, q);
  tag('directed：邊有方向（箭頭）', 'ptr', 4.0, 0, 3.4);
  say('directed graph：邊有方向', '箭頭從一個點指向另一個點');
  await step(tok);                                   // 0:44 undirected example: friendships
  const f = await gaWalk(tok, '朋友 ↔', you, a, 900);
  remove(f);
  you.mood('happy'); a.mood('happy');
  say('無向的例子：朋友關係', '你是小明的朋友，小明也是你的朋友');
  await step(tok);                                   // 0:51 directed example: web pages and links
  bob(p1, 0.05); bob(p2, 0.05); bob(p3, 0.05);
  tag('node = 網頁，edge = 超連結', 'say', 4.0, 2.6, -3.2);
  say('有向的例子：網頁和超連結', 'node = 網頁，directed edge = 連到別頁的連結');
  await step(tok);                                   // 1:00 links might not point the other way
  const k = await gaWalk(tok, '連結 →', p1, p2, 900);
  remove(k);
  tag('頁 2 不一定連回頁 1', 'bad', 3.9, 1.8, 2.4);
  say('頁 1 連到頁 2，頁 2 不一定連回來', '⟨頁1, 頁2⟩ ≠ ⟨頁2, 頁1⟩');
}]);

// 01:04 adjacency list：A–B、B–C → JS 物件 → 編號陣列
FRAG.push(['grapha-adjlist', 'Adjacency List：A–B、B–C', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.8, -0.4]);
  await step(tok);                                   // 1:04 three ways to represent a graph
  const three = tag('三種表示法：① adjacency list　② adjacency matrix　③ incidence matrix', 'say', 0, 2.6, -3.6);
  say('接下來介紹三種表示 graph 的方法');
  await step(tok);                                   // 1:08 first: adjacency list
  remove(three);
  const A = gaV('A', -5.4, -1.6), B = gaV('B', -3.6, 0.6), C = gaV('C', -5.4, 2.6);
  gaLine(A, B); gaLine(B, C);
  tag('① adjacency list', 'note', -1.2, 1.6, -3.0);
  say('第一種：adjacency list', '每個 vertex 記住它的鄰居有誰');
  const rows = [['A', ['B']], ['B', ['A', 'C']], ['C', ['B']]];
  const idx = { A: 0, B: 1, C: 2 };
  const heads = [], cells = [];
  for (let r = 0; r < rows.length; r++) {
    await step(tok);                                 // 1:18 A–B ／ 1:20 B–A、C ／ 1:21 C–B
    const [h, nb] = rows[r], z = -1.6 + r * 2.1;
    for (const v of [A, B, C]) glow(v, null);
    heads.push(cube(h, GP, [0.9, 0.7, 0.9], -1.2, 0.35, z, 3));
    glow([A, B, C][r], GOLD);
    nb.forEach((n, k) => {
      arrow(V3(-0.7 + k * 1.6, 0.4, z), V3(0.05 + k * 1.6, 0.4, z));
      cells.push([cube(n, GV, [0.9, 0.7, 0.9], 0.6 + k * 1.6, 0.35, z, 3), n]);
    });
    say(h + ' 連到 ' + nb.join(' 和 '), h + ' → ' + nb.join(', '));
  }
  await step(tok);                                   // 1:29 the same list in JavaScript
  for (const v of [A, B, C]) glow(v, null);
  const js = code(['var undirectedG = {', "  A: ['B'],", "  B: ['A', 'C'],", "  C: ['B']", '};'], 4.6, 1.2, 0.5, -1.2);
  say('用 JavaScript 物件寫出來', 'key = 頂點，value = 鄰居陣列');
  await step(tok);                                   // 1:35 undirected: no direction shown
  glow(heads[0], GOLD); glow(cells[1][0], GOLD);
  say('A 的鄰居有 B，B 的鄰居也有 A', '看不出方向 → undirected graph');
  await step(tok);                                   // 1:40 simpler: numbers instead of labels
  glow(heads[0], null); glow(cells[1][0], null);
  js.kill();
  code(['var undirectedGArr = [', '  [1],', '  [0, 2],', '  [1]', '];'], 4.6, 1.2, 0.5, -1.2);
  heads.forEach((h, r) => relabel(h, r));
  cells.forEach(([c, n]) => relabel(c, idx[n]));
  relabel(A, 0); relabel(B, 1); relabel(C, 2);
  say('node 改用編號：更簡單的陣列', 'A = 0、B = 1、C = 2');
}]);

// 01:48 adjacency matrix（無向）— cued copy of graph-representations
FRAG.push(['grapha-matrix', 'Adjacency Matrix：A–B、B–C', async (tok) => {
  rep.V = 3; rep.directed = false; rep.letters = true; rep.view = 'adj'; enterRep([]);
  await step(tok);                                   // 1:48 another way: adjacency matrix
  const t = tag('② adjacency matrix', 'note', -0.4, 1.4, -2.0);
  say('第二種：adjacency matrix', '先畫一張 3 × 3 的表格');
  await step(tok);                                   // 1:55 2D array, each row as long as the outer array
  for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) glow(rep.cells[i][j], '#3a2a10'); await anim(tok, 350, () => {}); for (let j = 0; j < 3; j++) glow(rep.cells[i][j], null); }
  say('二維陣列：每一列的長度 = 外層的長度', '3 列 × 每列 3 格');
  await step(tok);                                   // 2:04 the numbers represent edges
  repAdd(0, 1);
  say('格子裡的數字代表 edge', 'A–B 有邊 → M[A][B] = M[B][A] = 1');
  await step(tok);                                   // 2:07 0 = no edge, 1 = edge
  repAdd(1, 2);
  say('0 = 沒有邊，1 = 有邊', 'B–C 有邊；A–C 沒邊 → 0');
  await step(tok);                                   // 2:16 labels on the top and left
  remove(t);
  const top = tag('上方：node 名稱', 'note', -0.4, 1.0, -1.6), left = tag('左側：node 名稱', 'note', -2.3, 1.0, 0.3);
  say('表格上方和左側都是 node 的名字', '第 i 列第 j 行 = i 和 j 之間有沒有邊');
  await step(tok);                                   // 2:23 the same matrix in JavaScript
  remove(top); remove(left);
  code(['var adjMatrix = [', '  [0, 1, 0],', '  [1, 0, 1],', '  [0, 1, 0]', '];'], 0.2, 1.6, 0.48, 2.8);
  say('用 JavaScript 寫出來：陣列裡放陣列');
  await step(tok);                                   // 2:28 every row has as many entries as nodes
  for (let j = 0; j < 3; j++) glow(rep.cells[1][j], '#8a6400');
  glow(rep.heads[1], '#8a6400');
  say('和 list 不同：矩陣每一列都要 3 格', 'list[B] 只有 2 個；矩陣第 B 列一定 3 格');
  await step(tok);                                   // 2:32 3 × 3 → three nodes
  for (let j = 0; j < 3; j++) glow(rep.cells[1][j], null);
  glow(rep.heads[1], null);
  tag('3 × 3 → 3 個 node', 'ptr alt', -0.4, 1.0, -1.7);
  say('3 × 3 的矩陣 → graph 有 3 個 node', '<span class="ok">無向圖的矩陣沿對角線對稱</span>');
}]);

// 02:40 adjacency matrix（有向）— cued copy of directed-matrix
FRAG.push(['grapha-directed', 'Adjacency Matrix：有向圖', async (tok) => {
  rep.V = 3; rep.directed = true; rep.letters = true; rep.view = 'adj'; enterRep([]);
  await step(tok);                                   // 2:40 a matrix can also show a directed graph
  say('adjacency matrix 也能表示 directed graph', '⟨u,v⟩：從 u 指向 v');
  await step(tok);                                   // 2:45 the second node points to the first
  repAdd(1, 0);
  say('第二個點 B 指向第一個點 A', '只有 M[B][A] = 1');
  await step(tok);                                   // 2:50 the third node points to the first
  repAdd(2, 0);
  say('第三個點 C 也指向 A', '只有 M[C][A] = 1');
  await step(tok);                                   // 2:53 notice how the numbers change
  repRedraw(null);
  glow(rep.cells[1][0], GOLD); glow(rep.cells[0][1], '#7a1010');
  say('只有「從某點指向另一點」的格子是 1', '<span class="no">M[B][A] = 1，但 M[A][B] = 0 → 不對稱</span>');
  await step(tok);                                   // 2:59 two edges → only two ones
  glow(rep.cells[0][1], null); glow(rep.cells[2][0], GOLD);
  tag('只有 2 個 1', 'ptr alt', -0.4, 1.0, -1.7);
  say('兩條有向邊 → 矩陣裡只有兩個 1', '不會自動補上反方向');
}]);

// 03:04 incidence matrix — cued copy of incidence-matrix
FRAG.push(['grapha-incidence', 'Incidence Matrix：列是頂點、行是邊', async (tok) => {
  rep.V = 3; rep.directed = false; rep.letters = true; rep.view = 'inc'; enterRep([]);
  await step(tok);                                   // 3:04 the final way: incidence matrix
  const t = tag('③ incidence matrix', 'note', -0.4, 1.4, -2.0);
  say('最後一種：incidence matrix');
  await step(tok);                                   // 3:10 also a two-dimensional array
  say('它也是一個二維陣列', '跟 adjacency matrix 一樣是表格');
  await step(tok);                                   // 3:17 but rows and columns mean something else
  say('可是「列」和「行」的意思不一樣了');
  await step(tok);                                   // 3:21 adjacency matrix: rows and columns are nodes
  const n1 = tag('adjacency：列 = node，行 = node', 'say', 0.6, 2.0, 2.6);
  say('adjacency matrix：列和行都代表 node');
  await step(tok);                                   // 3:26 incidence: rows = nodes, columns = edges
  remove(t);
  const n2 = tag('incidence：列 = node，行 = edge', 'note', 0.6, 1.2, 2.6);
  say('incidence matrix：列 = node，行 = edge');
  await step(tok);                                   // 3:31 rows and columns can differ in number
  remove(n1);
  say('列數和行數可以不一樣', '大小是 V × E（點數 × 邊數）');
  await step(tok);                                   // 3:35 each column is one unique edge
  repAdd(0, 1); await anim(tok, 600, () => {}); repAdd(1, 2);
  say('每一行代表一條不同的 edge', 'e1 = (A,B)、e2 = (B,C)');
  await step(tok);                                   // 3:41 an edge connects two nodes → two 1s in its column
  remove(n2);
  say('一條邊連兩個 node', '所以那一行會在兩列填 1');
  await step(tok);                                   // 3:48 edge one connects A and B
  repRedraw(null);
  glow(rep.verts[0], GOLD); glow(rep.verts[1], GOLD);
  say('圖上：edge 1 連接 A 和 B');
  await step(tok);                                   // 3:53 column e1: a 1 in row A and row B
  glow(rep.cells[0][0], GOLD); glow(rep.cells[1][0], GOLD);
  say('看 e1 那一行：A 列、B 列都是 1', '表示 e1 連接 A、B');
  await step(tok);                                   // 4:03 a directed graph
  rep.directed = true; enterRep([[1, 0], [2, 0]]); rep.view = 'inc'; repRedraw(null);
  say('換成 directed graph', 'e1 = ⟨B,A⟩、e2 = ⟨C,A⟩');
  await step(tok);                                   // 4:06 −1 for leaving, +1 for entering
  glow(rep.cells[1][0], '#7a1010'); glow(rep.cells[0][0], GOLD);
  say('離開的點填 −1，進入的點填 +1', 'e1 = ⟨B,A⟩：B 是 −1，A 是 +1');
  await step(tok);                                   // 4:14 the JavaScript version
  code(['var incMatrix = [', '  [ 1,  1],', '  [-1,  0],', '  [ 0, -1]', '];'], 0.2, 1.6, 0.48, 2.8);
  say('JavaScript 寫法：列 = A、B、C，行 = e1、e2');
  rep.view = 'adj';
}]);

// 04:19 weighted edges
FRAG.push(['grapha-weights', 'Weighted graph：邊上有權重', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.6, 0]);
  const A = gaV('A', -5.4, -1.6), B = gaV('B', -3.2, 0.4), C = gaV('C', -5.4, 2.4);
  gaLine(A, B); gaLine(B, C);
  const N = ['A', 'B', 'C'], x0 = 1.0, z0 = -1.4, d = 1.3;
  N.forEach((n, i) => { tag(n, 'idx', x0 + i * d, 0, z0 - 1.0); tag(n, 'idx', x0 - 1.0, 0, z0 + i * d); });
  const M = [[0, 1, 0], [1, 0, 1], [0, 1, 0]];
  const cells = M.map((row, i) => row.map((v, j) => cube(v, v ? GV : '#efe5d3', [1.0, 0.4, 1.0], x0 + j * d, 0.2, z0 + i * d, 3)));
  await step(tok);                                   // 4:19 edges can have weights
  const q1 = tag('weight ?', 'note', -4.3, 0.9, -0.6), q2 = tag('weight ?', 'note', -4.3, 0.9, 1.4);
  say('edge 上還可以加權重（weight）');
  await step(tok);                                   // 4:24 so far unweighted: 0 or 1
  for (const row of cells) for (const c of row) if (c.userData.lbl.element.textContent === '1') glow(c, GOLD);
  say('目前的例子都是 unweighted', '只看有沒有邊：1 或 0');
  await step(tok);                                   // 4:28 different weights for your application
  for (const row of cells) for (const c of row) glow(c, null);
  q1.element.textContent = '4'; q2.element.textContent = '2';
  q1.element.className = 'lab-label ptr alt'; q2.element.className = 'lab-label ptr alt';
  say('依應用給不同的 weight', '例如距離：A–B 4 公里、B–C 2 公里（數字為示意）');
  await step(tok);                                   // 4:32 a weight is a number other than 1
  for (const [i, j, w] of [[0, 1, 4], [1, 0, 4], [1, 2, 2], [2, 1, 2]]) { relabel(cells[i][j], w); glow(cells[i][j], GOLD); }
  say('矩陣裡改填 weight', 'M[A][B] = M[B][A] = 4　M[B][C] = M[C][B] = 2');
}]);
  }

  // ═══ graphbari.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, line, GOLD, step, travel, remove, anim, buddy } = K;
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
  mid.add(V3(-d.y, d.x, 0).normalize().multiplyScalar(0.35 + 0.3 * d.length())); // longer spans bend wider, clear of the nodes in between
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
    2: [() => { n2 = tag('2、4、5 誰先？順序任意', 'note', -3.6, 1.6, 1.2); say('1 的鄰居：2、4、5', '拜訪的順序可以任意'); }, () => remove(n2)],
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

  // ═══ graphpeng.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, ghostBox, GOLD, RED, step, buddy, prop, bob, travel, remove, anim, zone } = K;
// ─── 交大彭文志 Lec18／Lec19 Graph (1/4)(2/4)：課本（Horowitz）G1–G4、Weiss 7 點有向圖、ABCDE 的 BFS ───
// cued: every step(tok) waits for the sentence it shows; motion between steps is short, nothing loops.
const gpT = ctx.THREE;
const GPC = { v: '#4b9ee2', e: '#9c8b70', hot: '#c08a1f', red: '#d64545', ok: '#2fc092', zero: '#efe5d3', one: '#4b9ee2', head: '#e2d6c2', pink: '#e55a9b', start: '#e8a0a0', land: '#c9a46a' };
// a vertex block; its resting position is kept in userData.p so edges can be drawn while it is still falling
function gpV(name, x, z, color, dropH = 3, size = [0.8, 0.6, 0.8]) {
  const m = cube(name, color || GPC.v, size, x, 0.3, z, dropH);
  m.userData.p = V3(x, 0.3, z);
  return m;
}
const gpP = (m) => (m.userData && m.userData.p) || m.position;
// a person (buddy) that edges can attach to
function gpBud(name, x, z, color) { const b = buddy(name, '', color, x, 0, z, 0.7); b.g.userData.p = V3(x, 0.3, z); return b; }
// edge between two vertex blocks (x–z plane); o.off shifts it sideways (multi-edges), o.dir draws an arrow
function gpE(a, b, o = {}) {
  const p = gpP(a), q = gpP(b);
  const d = q.clone().sub(p).normalize();
  const side = V3(-d.z, 0, d.x).multiplyScalar(o.off || 0);
  const gap = o.gap ?? 0.5;
  const s = p.clone().addScaledVector(d, gap).add(side), e = q.clone().addScaledVector(d, -gap).add(side);
  if (o.dir) {
    const len = Math.max(0.1, s.distanceTo(e));
    const h = new gpT.ArrowHelper(d.clone(), s, len, o.color || GPC.e, Math.min(0.32, len * 0.4), 0.2);
    ctx.lab.world.add(h); return h;
  }
  const l = new gpT.Line(new gpT.BufferGeometry().setFromPoints([s, e]), new gpT.LineBasicMaterial({ color: o.color || GPC.e }));
  ctx.lab.world.add(l); return l;
}
const gpPaint = (e, c) => { if (!e) return; if (e.setColor) e.setColor(new gpT.Color(c)); else e.material.color.set(c); };
const gpMid = (a, b, off = 0) => { const p = gpP(a), q = gpP(b); const d = q.clone().sub(p).normalize(); return p.clone().add(q).multiplyScalar(0.5).add(V3(-d.z, 0, d.x).multiplyScalar(off)); };
// a flat ring next to a vertex = self loop
function gpLoop(a, dx, dz) {
  const m = new gpT.Mesh(new gpT.TorusGeometry(0.36, 0.04, 8, 28), new gpT.MeshStandardMaterial({ color: GPC.red }));
  const p = gpP(a); m.position.set(p.x + dx, 0.3, p.z + dz); m.rotation.x = Math.PI / 2;
  ctx.lab.world.add(m); return m;
}
// draw a whole graph: pos = {name: [x, z]}, edges = [[u, v, opt?]]; returns { V: {name: mesh}, E: {'u-v': edge} }
function gpGraph(pos, edges, o = {}) {
  const V = {}, E = {};
  for (const n of Object.keys(pos)) V[n] = gpV(n, pos[n][0], pos[n][1], o.color, o.dropH ?? 0, o.size);
  for (const [u, v, eo] of edges) E[u + '-' + v + (eo && eo.key ? eo.key : '')] = gpE(V[u], V[v], Object.assign({ dir: o.dir, gap: o.gap }, eo || {}));
  return { V, E };
}
// a horizontal linked list row: head at (x0, z), nodes after it; returns { head, nodes, arrows }
async function gpRow(tok, label, items, x0, z, stepX = 1.1, color = GPC.v, ms = 300, size = [0.7, 0.5, 0.7]) {
  const head = cube(label, GPC.head, size, x0, 0.25, z, 0);
  const nodes = [], arrows = [];
  for (let k = 0; k < items.length; k++) {
    const x = x0 + (k + 1) * stepX;
    arrows.push(gpArrow(V3(x - stepX + size[0] / 2 + 0.02, 0.3, z), V3(x - size[0] / 2 - 0.02, 0.3, z)));
    nodes.push(cube(items[k], color, size, x, 0.25, z, 3));
    if (ms) await beat(tok, ms);
  }
  return { head, nodes, arrows };
}
function gpArrow(a, b, color = 0x6e5f49) {
  const d = b.clone().sub(a); const len = Math.max(0.08, d.length());
  const h = new gpT.ArrowHelper(d.normalize(), a, len, color, Math.min(0.25, len * 0.4), 0.16);
  ctx.lab.world.add(h); return h;
}
// a small tag that walks from one vertex to another (a person on the move, a message, a pointer being followed)
async function gpWalk(tok, text, a, b, ms = 600, cls = 'pkt') {
  const p = gpP(a), q = gpP(b);
  const t = tag(text, cls, p.x, 1.1, p.z);
  await travel(tok, t, V3(p.x, 1.1, p.z), V3(q.x, 1.1, q.z), ms);
  return t;
}
const gpK4 = (cx, cz, r) => ({ 0: [cx, cz - r], 1: [cx - r, cz], 2: [cx + r, cz], 3: [cx, cz + r] });
const GP_K4E = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const gpEK = (u, v) => Math.min(u, v) + '-' + Math.max(u, v);

// ═════════════ Lec18 (0fVJsIC1QXs) ═════════════

// 00:00 Königsberg 七橋：A 是島（degree 5），B、C、D degree 3 → 沒有 Euler circuit
FRAG.push(['graphpeng-konigsberg', '七橋問題：degree 全是奇數', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const P = { C: [-0.8, -2.8], A: [-2.2, 0], B: [-0.8, 2.8], D: [2.6, 0] };
  const br = [['a', 'A', 'C', 0.35], ['b', 'A', 'C', -0.35], ['c', 'A', 'B', 0.35], ['d', 'A', 'B', -0.35], ['e', 'A', 'D', 0], ['f', 'C', 'D', 0], ['g', 'B', 'D', 0]];
  const V = {}, E = [];
  await step(tok);                                   // 0:00 a small town in Europe with seven bridges
  zone('河', 0.2, 0, 0, 9.0, 7.6, '#cfe3f3');
  for (const n of Object.keys(P)) V[n] = gpV('', P[n][0], P[n][1], GPC.land, 3, [1.0, 0.6, 1.0]);
  for (const [, u, v, off] of br) E.push(gpE(V[u], V[v], { off, gap: 0.6, color: '#8a5a2a' }));
  say('歐洲小鎮 Königsberg：河上有七座橋');
  await step(tok);                                   // 0:39 the land is marked with points
  for (const n of Object.keys(P)) { const l = ctx.lab.label(n, 'val'); V[n].userData.lbl = l; V[n].add(l); } // the blocks were created unlabelled
  say('每塊陸地標上一個點：A、B、C、D');
  await step(tok);                                   // 0:52 A is an island
  glow(V.A, GOLD);
  const isl = tag('A 是一個島', 'note', -3.6, 1.2, 0);
  say('A 這塊陸地是一個島');
  await step(tok);                                   // 1:07 the map as a graph: capital letters = land
  glow(V.A, null); remove(isl);
  for (const n of Object.keys(P)) tint(V[n], GPC.v);
  tag('vertex（大寫）= 陸地', 'ptr', 4.6, 0.4, -2.6);
  say('把地圖畫成 graph', '大寫 A、B、C、D = 陸地 = vertex');
  await step(tok);                                   // 1:16 lower-case letters are edges
  br.forEach(([nm, u, v, off]) => { const m = gpMid(V[u], V[v], off * 1.9); tag(nm, 'idx', m.x, 0.5, m.z); });
  say('小寫 a～g 是 edge');
  await step(tok);                                   // 1:24 an edge is a bridge
  E.forEach((e) => gpPaint(e, GPC.hot));
  tag('edge（小寫）= 橋', 'ptr alt', 4.6, 0.4, -1.8);
  say('每條 edge 對應一座橋');
  await step(tok);                                   // 1:33 cross every bridge once and come back?
  E.forEach((e) => gpPaint(e, '#8a5a2a'));
  const w1 = await gpWalk(tok, '走', V.A, V.C, 700); remove(w1);
  const w2 = await gpWalk(tok, '走', V.C, V.D, 700); remove(w2);
  const q = tag('每座橋只走一次，最後回到起點？', 'note', 0.2, 1.4, 3.6);
  say('問題：每座橋恰好走一次，再走回起點，做得到嗎？');
  await step(tok);                                   // 1:57 degree: number of edges on a vertex
  remove(q);
  tag('degree = 連在點上的邊數', 'say', 0.2, 1.4, 3.6);
  say('degree：一個 vertex 連了幾條邊');
  await step(tok);                                   // 2:12 B has degree 3
  glow(V.B, GOLD);
  tag('deg 3', 'ptr alt', 0.4, 0.5, 2.8);
  say('B 連了 3 條邊 → degree(B) = 3');
  await step(tok);                                   // 2:18 A: 1 2 3 4 5 → 5；D: 3
  glow(V.B, null); glow(V.A, GOLD);
  const da = tag('deg 1', 'ptr alt', -3.6, 0.5, 0);
  for (let k = 2; k <= 5; k++) { await anim(tok, 260, () => {}); txt(da, 'deg ' + k); }
  glow(V.A, null);
  tag('deg 3', 'ptr alt', 3.9, 0.5, 0); tag('deg 3', 'ptr alt', 0.4, 0.5, -2.8);
  say('A：1、2、3、4、5 → degree 5', 'D、C 的 degree 都是 3');
  await step(tok);                                   // 3:02 condition 1: start = end
  const c1 = tag('條件 1：起點 = 終點', 'note', 5.0, 1.2, 1.4);
  say('這條路徑的條件一：起點和終點一樣');
  await step(tok);                                   // 3:14 condition 2: every bridge exactly once
  const c2 = tag('條件 2：每座橋只走一次', 'note', 5.0, 1.2, 2.2);
  say('條件二：每一座橋（edge）只能走一次');
  await step(tok);                                   // 4:00 a mathematician proved a theorem
  remove(c1); remove(c2);
  const eu = buddy('Euler（數學家）', '', '#f3dcc0', 5.2, 0, 1.8, 0.7); eu.mood('wow');
  say('數學家 Euler 證明了一個定理');
  await step(tok);                                   // 4:11 every vertex needs an even degree
  eu.mood('happy'); await eu.hop(tok);
  tag('每個 vertex 的 degree 都要是偶數', 'say', 5.0, 2.2, 0.4);
  say('要有這種路徑：每個 vertex 的 degree 都必須是偶數');
  await step(tok);                                   // 4:45 here all degrees are odd → no such route
  for (const n of Object.keys(P)) tint(V[n], GPC.red);
  eu.mood('sad');
  tag('degree 全是奇數 → 不存在', 'bad', 0.2, 1.4, 3.6);
  say('七橋圖 degree 都是奇數 → 這種路徑不存在', 'A:5　B:3　C:3　D:3');
  await step(tok);                                   // 5:19 the first problem modelled as a graph
  tag('第一個「把問題變成 graph」的應用', 'good', 0.2, 1.4, -3.6);
  say('這大概是第一個把實際問題 model 成 graph 的例子');
}]);

// 05:38 G = (V, E)；layout；shortest path：空間最短 vs 時間最短（數字為示意）
FRAG.push(['graphpeng-shortest-space-time', 'Graph 的應用：layout 與 shortest path', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const pos = { S: [-5, 0], X: [-1, -2.4], Y: [-1, 2.4], D: [3.4, 0] };
  await step(tok);                                   // 5:38 a graph has just two components
  const ge = tag('Graph = vertex 的集合 ＋ edge 的集合', 'say', -0.8, 1.6, -3.6);
  say('Graph 只包含兩個重要元件');
  await step(tok);                                   // 5:45 the set of vertices
  const V = {}; for (const n of Object.keys(pos)) V[n] = gpV(n, pos[n][0], pos[n][1]);
  say('第一個：vertex（頂點）的集合', 'V = {S, X, Y, D}');
  await step(tok);                                   // 5:51 the set of edges
  const E = {}; for (const [u, v] of [['S', 'X'], ['X', 'D'], ['S', 'Y'], ['Y', 'D']]) E[u + '-' + v] = gpE(V[u], V[v]);
  say('第二個：edge（邊）的集合', '有這兩樣就是一個 graph');
  await step(tok);                                   // 6:05 application 1: circuit layout
  remove(ge);
  const chip = prop('cpu', 5.6, 0, -2.6, 1.0, '應用一：電路 layout'); bob(chip, 0.05);
  say('應用一：電路的 layout');
  await step(tok);                                   // 6:19 connect gates with routes in limited space
  tag('有限空間裡把 gate 用 route 連起來', 'note', 5.0, 1.0, -1.0);
  say('在有限的空間把 gate 用連線（route）接起來', '看起來是硬體，其實是演算法問題');
  await step(tok);                                   // 6:54 application 2: shortest path
  say('應用二：找 shortest path（最短路徑）');
  await step(tok);                                   // 7:20 Google Map: give two points
  tag('source', 'good', -5, 1.1, 0); tag('destination', 'good', 3.4, 1.1, 0);
  say('Google Map：給定兩個點', '起點 source、終點 destination');
  await step(tok);                                   // 7:31 it plans routes — there are many
  const w1 = await gpWalk(tok, '路線 1', V.S, V.X, 450); await travel(tok, w1, w1.position.clone(), V3(3.4, 1.1, 0), 450); remove(w1);
  const w2 = await gpWalk(tok, '路線 2', V.S, V.Y, 450); await travel(tok, w2, w2.position.clone(), V3(3.4, 1.1, 0), 450); remove(w2);
  say('規劃路徑：可能有好幾種走法');
  await step(tok);                                   // 7:48 the fewest kilometres
  const lb = { 'S-X': ['3 km', -0.5], 'X-D': ['4 km', -0.5], 'S-Y': ['5 km', 0.5], 'Y-D': ['5 km', 0.5] };
  const L = {};
  for (const k of Object.keys(lb)) { const [u, v] = k.split('-'); const m = gpMid(V[u], V[v], lb[k][1]); L[k] = tag(lb[k][0], 'ptr alt', m.x, 0.5, m.z); }
  gpPaint(E['S-X'], GPC.hot); gpPaint(E['X-D'], GPC.hot); glow(V.X, GOLD);
  say('最常見：走最少的公里數到目的地', 'S→X→D = 7 km　S→Y→D = 10 km（數字為示意）');
  await step(tok);                                   // 8:16 that is the spatial shortest path
  tag('空間上的 shortest path', 'note', -1, 1.2, -3.4);
  say('這叫空間上的 shortest path');
  await step(tok);                                   // 8:22 the temporal one: shortest travel time
  glow(V.X, null);
  txt(L['S-X'], '5 分'); txt(L['X-D'], '25 分'); txt(L['S-Y'], '7 分'); txt(L['Y-D'], '8 分');
  say('時間上的 shortest path：travel time 最短', '同樣給 source、destination');
  await step(tok);                                   // 8:53 a segment that is often jammed
  gpPaint(E['X-D'], GPC.red);
  tag('常常塞車', 'bad', 1.2, 1.0, -1.6);
  say('X→D 這段常塞車', 'S→X→D = 30 分');
  await step(tok);                                   // 8:59 close in space, slow in time
  gpPaint(E['S-X'], GPC.e); gpPaint(E['S-Y'], GPC.ok); gpPaint(E['Y-D'], GPC.ok); glow(V.Y, GOLD);
  tag('時間上的 shortest path', 'good', -1, 1.2, 3.4);
  say('空間上很近，時間上不一定短', 'S→Y→D = 15 分：時間最短');
}]);

// 14:55 project planning、Facebook 共同朋友
FRAG.push(['graphpeng-social', 'Graph 應用：專案流程與共同朋友', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  await step(tok);                                   // 14:55 project planning
  const pj = prop('file', -4.6, 0, -3.0, 0.9, '專案：開發 Windows 8'); bob(pj, 0.05);
  say('應用：project planning（專案規劃）');
  await step(tok);                                   // 15:02 many components
  const T = gpGraph({ '設計': [-5.6, -1.0], '實作': [-3.6, 0.8], '測試': [-5.6, 2.6] }, [], { dropH: 3, size: [1.2, 0.6, 0.8], color: '#dd8238' });
  say('一個專案有好多 component（部分工作）');
  await step(tok);                                   // 15:08 the components form a graph
  gpE(T.V['設計'], T.V['實作'], { dir: true, color: '#dd8238', gap: 0.75 }); gpE(T.V['實作'], T.V['測試'], { dir: true, color: '#dd8238', gap: 0.75 });
  say('component 之間的關係畫成 graph', 'edge 有方向：先 → 後');
  await step(tok);                                   // 15:14 when one finishes, the next must finish in time
  glow(T.V['設計'], GOLD);
  const w = await gpWalk(tok, '完成 →', T.V['設計'], T.V['實作'], 700);
  glow(T.V['實作'], GOLD);
  await travel(tok, w, w.position.clone(), V3(-5.6, 1.1, 2.6), 700); remove(w);
  glow(T.V['測試'], GOLD);
  say('這個 component 完成後，下一個要在期限內完成');
  await step(tok);                                   // 15:44 big software: the development flow is a graph
  tag('大型軟體：開發流程 = graph', 'note', -4.6, 1.4, 3.6);
  say('大公司的軟體開發流程，也常畫成 graph 來控管');
  await step(tok);                                   // 16:00 social science
  say('應用：social science（社群）', '例如 Facebook');
  await step(tok);                                   // 16:20 vertex = Facebook user
  const B = { '你': gpBud('你', 0.4, 0, '#7cb8ee'), '小明': gpBud('小明', 2.8, -2.2, '#f4a56a'), '小華': gpBud('小華', 2.8, 2.2, '#9ed49a'), '阿強': gpBud('阿強', 5.4, 0, '#f3c5d5') };
  say('vertex = Facebook 的 user');
  await step(tok);                                   // 16:28 edge = added as friends
  const E = {};
  for (const [u, v] of [['你', '小明'], ['你', '小華'], ['小明', '阿強'], ['小華', '阿強']]) E[u + '-' + v] = gpE(B[u].g, B[v].g, { gap: 0.7 });
  for (const k in B) B[k].mood('happy');
  say('edge = 兩人加為朋友');
  await step(tok);                                   // 16:36 recommend: a friend of yours is his friend too
  B['你'].glow(GOLD); B['小明'].glow(GOLD); B['小華'].glow(GOLD);
  gpPaint(E['你-小明'], GPC.hot); gpPaint(E['你-小華'], GPC.hot);
  say('推薦朋友：先看你的鄰居', '小明、小華');
  await step(tok);                                   // 16:45 your neighbours' neighbours → common friends
  gpPaint(E['小明-阿強'], GPC.ok); gpPaint(E['小華-阿強'], GPC.ok);
  B['阿強'].mood('wow'); await B['阿強'].hop(tok);
  tag('推薦加好友：2 位共同朋友', 'good', 5.4, 1.6, 1.0);
  say('再看鄰居的鄰居 → 阿強', '你和阿強有 2 位共同朋友');
}]);

// 17:08 G = (V, E)；directed／undirected；G1 complete、G2 tree、G3 directed
FRAG.push(['graphpeng-g1g2g3', 'Graph 定義：G1、G2、G3', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.4]);
  await step(tok);                                   // 17:08 G = (V, E)
  tag('G = (V, E)', 'ptr alt', 0, 1.6, -3.4);
  say('Graph 的定義：G = (V, E)', 'V = 頂點的集合，E = 邊的集合');
  await step(tok);                                   // 17:24 V(G) and E(G)
  tag('V(G)：G 的頂點集合　E(G)：G 的邊集合', 'say', 0, 1.0, -3.4);
  say('也可以寫成 V(G)、E(G)');
  await step(tok);                                   // 17:42 does an edge have a direction?
  const u1 = gpV('u', -1.4, -1.2), v1 = gpV('v', 1.4, -1.2), u2 = gpV('u', -1.4, 1.2), v2 = gpV('v', 1.4, 1.2);
  const qn = tag('edge 有沒有方向？', 'note', 0, 1.2, 0);
  say('edge 可以有方向，也可以沒有，看需求');
  await step(tok);                                   // 17:59 with a direction → directed graph
  remove(qn);
  const a1 = gpE(u1, v1, { dir: true, color: '#dd8238' });
  const t1 = tag('有方向 → directed graph', 'ptr', 0, 0.6, -2.1);
  say('edge 有方向 → directed graph（有向圖）');
  await step(tok);                                   // 18:06 without → undirected graph
  const l2 = gpE(u2, v2);
  const t2 = tag('沒方向 → undirected graph', 'ptr', 0, 0.6, 2.1);
  say('沒有方向 → undirected graph（無向圖）');
  await step(tok);                                   // 18:14 an edge = (u, v), two endpoints from V
  glow(u2, GOLD); glow(v2, GOLD);
  const t3 = tag('edge = (u, v)：兩個端點都來自 V', 'say', 0, 1.3, 1.2);
  say('一條邊有兩個端點 u、v', '兩個端點都是 V 裡的頂點');
  await step(tok);                                   // 18:35 undirected: (u, v) = (v, u)
  const w = await gpWalk(tok, '↔', u2, v2, 600); remove(w);
  txt(t3, '無向：(u, v) = (v, u)');
  say('undirected：(u, v) 和 (v, u) 是同一條邊');
  await step(tok);                                   // 18:45 directed: u→v and v→u mean different things
  glow(u2, null); glow(v2, null); glow(u1, GOLD);
  tag('有向：⟨u, v⟩ ≠ ⟨v, u⟩', 'bad', 0, 1.3, -1.2);
  say('directed：u → v 和 v → u 意義不同');
  await step(tok);                                   // 19:12 G1: a complete graph
  for (const o of [u1, v1, u2, v2, a1, l2, t1, t2, t3]) kill(o);
  ctx.lab.world.children.filter((c) => c.element && /≠|V\(G\)/.test(c.element.textContent)).forEach(remove);
  const G1 = gpGraph(gpK4(-4.6, 0, 1.8), [], { dropH: 3, size: [0.7, 0.5, 0.7] });
  tag('G1', 'ptr', -4.6, 0.3, 2.9);
  for (const [u, v] of GP_K4E) { gpE(G1.V[u], G1.V[v]); await anim(tok, 200, () => {}); }
  say('G1：complete graph', '每個點都跟其他所有點相連');
  await step(tok);                                   // 19:28 V(G1) = {0,1,2,3}
  for (const k of [0, 1, 2, 3]) glow(G1.V[k], GOLD);
  tag('V = {0, 1, 2, 3}', 'say', -4.6, 1.2, -2.9);
  say('V(G1) = {0, 1, 2, 3}');
  await step(tok);                                   // 19:37 six edges; (0,1) = (1,0)
  for (const k of [0, 1, 2, 3]) glow(G1.V[k], null);
  tag('E：6 條邊，(0,1) = (1,0)', 'say', -4.6, 0.6, 3.6);
  say('E(G1) 有 6 條邊：(0,1)、(0,2)…', '無向：(0,1) = (1,0)');
  await step(tok);                                   // 19:56 a tree is also a graph (G2)
  const tp = { 0: [0, -1.9], 1: [-1.1, -0.4], 2: [1.1, -0.4], 3: [-1.7, 1.1], 4: [-0.5, 1.1], 5: [0.5, 1.1], 6: [1.7, 1.1] };
  gpGraph(tp, [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]], { dropH: 3, size: [0.5, 0.45, 0.5], gap: 0.35 });
  tag('G2：tree', 'ptr', 0, 0.3, 2.9);
  say('G2：tree 也是一種 graph', 'tree 的 node = vertex，樹邊 = edge');
  await step(tok);                                   // 20:26 G3: a directed graph with arrows
  const G3 = gpGraph({ 0: [4.6, -2.0], 1: [4.6, 0], 2: [4.6, 2.0] }, [], { dropH: 3, size: [0.7, 0.5, 0.7] });
  tag('G3', 'ptr', 4.6, 0.3, 2.9);
  gpE(G3.V[0], G3.V[1], { dir: true, off: 0.22 }); gpE(G3.V[1], G3.V[0], { dir: true, off: 0.22 }); gpE(G3.V[1], G3.V[2], { dir: true });
  say('G3：directed graph，edge 上有箭頭');
  await step(tok);                                   // 20:43 ⟨0,1⟩ and ⟨1,0⟩ are different edges; ⟨1,2⟩
  glow(G3.V[0], GOLD); glow(G3.V[1], GOLD);
  const w3 = await gpWalk(tok, '⟨0,1⟩', G3.V[0], G3.V[1], 500); remove(w3);
  const w4 = await gpWalk(tok, '⟨1,0⟩', G3.V[1], G3.V[0], 500); remove(w4);
  say('⟨0,1⟩ 和 ⟨1,0⟩ 是兩條不同的邊', 'E(G3) = {⟨0,1⟩, ⟨1,0⟩, ⟨1,2⟩}');
}]);

// 21:17 self loop（FSM、compiler）與 multigraph（Facebook 的 PO 文、回文）
FRAG.push(['graphpeng-selfloop-multi', 'Self loop 與 multigraph', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  await step(tok);                                   // 21:17 a graph usually doesn't connect to itself
  const A = gpGraph({ 0: [-4.4, -1.6], 1: [-5.8, 1.2], 2: [-3.0, 1.2] }, [[0, 1], [1, 2]], { dropH: 3 });
  tag('(a)', 'ptr', -4.4, 0.3, 2.6);
  say('限制一：graph 通常不會自己連到自己');
  await step(tok);                                   // 21:26 otherwise it forms a loop
  const lp = gpLoop(A.V[0], 0, -0.75); glow(A.V[0], GOLD);
  tag('self loop：(0, 0)', 'ptr alt', -2.9, 0.5, -2.4);
  say('否則形成 self loop（自己連到自己）', 'self edge (0, 0)');
  await step(tok);                                   // 21:41 formal language: finite state machine
  tag('FSM：finite state machine', 'note', -4.4, 1.4, -3.4);
  say('什麼時候會自己連到自己？', '正規語言裡的 finite state machine');
  await step(tok);                                   // 22:02 a compiler checks your syntax
  const f = prop('file', -1.2, 0, -2.6, 0.8, 'C 程式'); bob(f, 0.05);
  say('例：compiler 檢查 C 程式的語法');
  await step(tok);                                   // 22:24 each vertex is a token
  tag('vertex = token（一個字）', 'say', -4.4, 1.6, 3.4);
  say('把語法畫成 graph：每個點是一個 token');
  await step(tok);                                   // 22:46 if it doesn't fit → error
  tag('走不下去 → error', 'bad', -1.2, 1.9, -1.4);
  say('程式在 FSM 裡走不下去，就報 error');
  await step(tok);                                   // 23:05 in an FSM a vertex can loop to itself
  lp.material.color.set('#2fc092');
  tag('FSM 裡可以有 self loop', 'good', -2.9, 1.1, -2.4);
  say('在 FSM 這種 graph 裡，就會出現自己連到自己');
  await step(tok);                                   // 23:10 usually no multiple edges either
  const B = gpGraph({ 0: [3.4, -2.2], 1: [1.8, 0], 2: [5.0, 0], 3: [3.4, 2.2] }, [[0, 1], [0, 2], [1, 3], [3, 2]], { dropH: 3 });
  tag('(b)', 'ptr', 3.4, 0.3, 3.2);
  say('限制二：通常也不會有 multiple edges', '同兩點之間不會有很多條邊');
  await step(tok);                                   // 23:28 if there are, it's a multigraph
  tag('有的話 → multigraph', 'note', 3.4, 1.4, -3.2);
  say('如果有，就叫 multigraph');
  await step(tok);                                   // 24:38 1–3 has two or more edges
  gpE(B.V[1], B.V[3], { off: 0.22, color: GPC.red });
  say('1 到 3 之間有兩條以上的邊');
  await step(tok);                                   // 24:44 3–2 too
  gpE(B.V[3], B.V[2], { off: 0.22, color: GPC.red });
  say('3 到 2 也有好幾條');
  await step(tok);                                   // 25:16 Facebook: 3 and 2 are people
  tag('3 = 一個人', 'say', 2.4, 1.0, 3.2); tag('2 = 另一個人', 'say', 6.0, 1.0, 0.8);
  say('什麼時候會有？看應用', '例：Facebook 上 3、2 是兩個人');
  await step(tok);                                   // 25:31 an edge = a post and a reply
  const w = await gpWalk(tok, 'PO 文 →', B.V[3], B.V[2], 700); txt(w, '← 回文'); await travel(tok, w, w.position.clone(), V3(3.4, 1.1, 2.2), 700); remove(w);
  say('edge 代表一次互動：3 PO 文，2 回覆、按讚');
  await step(tok);                                   // 25:40 posted many times
  gpE(B.V[3], B.V[2], { off: -0.22, color: GPC.red });
  const w2 = await gpWalk(tok, '又 PO 一篇', B.V[3], B.V[2], 700); remove(w2);
  say('一個月前、這個月、上禮拜都 PO 了文', '每次互動都留一條邊');
  await step(tok);                                   // 26:07 keep the time of each → multigraph
  tag('保留每次互動的時間 → multigraph', 'good', 3.4, 1.8, -2.4);
  say('要保留每次互動的時間，就形成 multigraph');
}]);

// 26:40 edge = pair、adjacent、path、length、simple path、cycle、DAG
FRAG.push(['graphpeng-path', 'Path、simple path、cycle、DAG', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-2.2, 0, 2.4), GP_K4E, { dropH: 3 });
  tag('G1', 'ptr', -2.2, 0.3, 3.4);
  await step(tok);                                   // 26:40 an edge is a pair
  tag('edge = 一對頂點 (u, v)', 'say', 3.8, 1.4, -3.0);
  say('edge 表示成一個 pair');
  await step(tok);                                   // 26:47 directed: the pair has an order
  tag('directed：⟨u, v⟩ ≠ ⟨v, u⟩（有順序）', 'say', 3.8, 1.4, -2.2);
  say('directed graph 的 pair 有順序');
  await step(tok);                                   // 26:52 adjacent
  say('adjacent（相鄰）：兩個點有沒有直接相連');
  await step(tok);                                   // 26:59 (v, w) ∈ E → v, w adjacent
  glow(G.V[0], GOLD); glow(G.V[1], GOLD); gpPaint(G.E['0-1'], GPC.hot);
  tag('(0, 1) ∈ E → 0、1 adjacent', 'good', 3.8, 1.4, -1.4);
  say('(0, 1) ∈ E → 0 和 1 相鄰', '無向圖：(0,1) = (1,0)');
  await step(tok);                                   // 27:36 path: the vertices you pass
  glow(G.V[0], null); glow(G.V[1], null); gpPaint(G.E['0-1'], GPC.e);
  tint(G.V[0], GPC.ok);
  const cur = tag('走', 'pkt', -2.2, 1.1, -2.4);
  say('path：一路經過哪些點、哪些邊');
  await step(tok);                                   // 27:44 walk 0 → 1 → 3 → 2
  const path = [0, 1, 3, 2];
  for (let k = 1; k < path.length; k++) {
    const u = path[k - 1], v = path[k];
    await travel(tok, cur, cur.position.clone(), V3(gpP(G.V[v]).x, 1.1, gpP(G.V[v]).z), 550);
    gpPaint(G.E[gpEK(u, v)], GPC.ok); tint(G.V[v], GPC.ok);
  }
  say('path：0 → 1 → 3 → 2');
  await step(tok);                                   // 28:08 length = number of edges on the path
  const ln = tag('length = 3（經過 3 條邊）', 'ptr alt', 3.8, 1.4, 0.2);
  say('path 的 length = 經過的 edge 個數', '0→1→3→2：length 3');
  await step(tok);                                   // 28:25 simple path
  tag('simple path', 'note', 3.8, 1.4, 1.0);
  say('simple path：一種特別的 path');
  await step(tok);                                   // 28:33 all vertices distinct except possibly the ends
  say('除了起點和終點可以相同，其他點都要 distinct（不重複）', '0, 1, 3, 2 → simple path');
  await step(tok);                                   // 28:41 cycle
  remove(cur); remove(ln);
  for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e);
  for (const n of [0, 1, 2, 3]) tint(G.V[n], GPC.v);
  for (const k of ['0-1', '1-2', '0-2']) gpPaint(G.E[k], GPC.red);
  for (const n of [0, 1, 2]) tint(G.V[n], GPC.red);
  tag('cycle：0 → 1 → 2 → 0', 'bad', -2.2, 1.4, 0);
  say('cycle：經過的點重複，又繞回起點', '0 → 1 → 2 → 0');
  await step(tok);                                   // 28:56 a graph without cycles: DAG
  gpGraph({ a: [3.6, 1.8], b: [5.6, 3.0], c: [3.6, 3.8] }, [['a', 'b'], ['b', 'c'], ['a', 'c']], { dir: true, dropH: 3, color: '#dd8238', size: [0.6, 0.45, 0.6], gap: 0.4 });
  tag('DAG', 'ptr', 5.8, 0.3, 4.2);
  say('沒有 cycle 的有向圖叫 DAG', '右下角：a→b→c、a→c，繞不回起點');
  await step(tok);                                   // 29:18 DAG: directed, no cycle
  tag('directed acyclic graph', 'good', 4.6, 1.2, 2.6);
  say('DAG = directed acyclic graph', '有方向、沒有 cycle');
}]);

// 29:30 connected／strongly connected；complete graph 邊數 n(n−1)/2、n(n−1)
FRAG.push(['graphpeng-complete-count', 'Complete graph 有幾條邊', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const U = gpGraph(gpK4(-3.8, 0, 2.2), [], { dropH: 3 });
  await step(tok);                                   // 29:30 connected: pick two vertices
  glow(U.V[0], GOLD); glow(U.V[3], GOLD);
  say('connected：給兩個點', '0 和 3');
  await step(tok);                                   // 29:41 a path joins them → connected
  const e01 = gpE(U.V[0], U.V[1], { color: GPC.ok }), e13 = gpE(U.V[1], U.V[3], { color: GPC.ok });
  const w = await gpWalk(tok, '走', U.V[0], U.V[1], 500); await travel(tok, w, w.position.clone(), V3(-3.8, 1.1, 2.2), 500); remove(w);
  say('找得到一條 path 連起它們 → connected');
  await step(tok);                                   // 29:51 strongly connected
  tag('strongly connected：有向圖中任兩點互相到得了', 'note', 0, 1.6, -3.6);
  say('strongly connected：任兩點都要互相有 path', '後面會再講');
  await step(tok);                                   // 30:06 complete graph
  glow(U.V[0], null); glow(U.V[3], null);
  say('complete graph：每個點都跟其他點有邊');
  await step(tok);                                   // 30:15 every vertex connected to all others
  gpPaint(e01, GPC.hot); gpPaint(e13, GPC.hot);
  let c = 2;
  const cnt = tag('2 條', 'ptr alt', -3.8, 0.4, 3.2);
  for (const [u, v] of GP_K4E) {
    if ((u === 0 && v === 1) || (u === 1 && v === 3)) continue;
    gpE(U.V[u], U.V[v], { color: GPC.hot }); c++; txt(cnt, c + ' 條');
    await anim(tok, 300, () => {});
  }
  say('把每一對點都連起來', 'n = 4 → 6 條');
  await step(tok);                                   // 30:34 n vertices
  tag('n 個頂點', 'say', -3.8, 1.4, -3.0);
  say('推導：一個 graph 有 n 個頂點');
  await step(tok);                                   // 30:49 undirected complete: C(n,2)
  tag('undirected：C(n,2) = n(n−1)/2', 'good', -3.8, 1.0, 3.8);
  say('undirected complete graph：C(n, 2) 條邊', '4·3/2 = 6');
  await step(tok);                                   // 31:02 directed complete graph
  const D = gpGraph(gpK4(3.8, 0, 2.2), [], { dropH: 3 });
  say('如果是 directed graph 呢？');
  await step(tok);                                   // 31:14 both directions → × 2 = n(n−1)
  const cnt2 = tag('0 條', 'ptr alt', 3.8, 0.4, 3.2);
  c = 0;
  for (const [u, v] of GP_K4E) {
    gpE(D.V[u], D.V[v], { dir: true, off: 0.16, color: GPC.hot });
    gpE(D.V[v], D.V[u], { dir: true, off: 0.16, color: GPC.hot });
    c += 2; txt(cnt2, c + ' 條');
    await anim(tok, 300, () => {});
  }
  tag('directed：n(n−1)', 'good', 3.8, 1.0, 3.8);
  say('u→v 和 v→u 是兩條不同的邊 → 乘 2', 'n(n−1) = 4·3 = 12 條');
}]);

// 31:34 subgraph：(i)–(iv) 都是 G1 的 subgraph（子圖依影片口述重畫）
FRAG.push(['graphpeng-subgraph', 'Subgraph：G1 的子圖', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-4.6, 0, 2.0), GP_K4E, { dropH: 3 });
  tag('G1', 'ptr', -4.6, 0.3, 3.0);
  await step(tok);                                   // 31:34 subgraph
  say('subgraph（子圖）：graph 的子集合');
  await step(tok);                                   // 31:50 V and E are subsets of the original
  tag('V(G′) ⊆ V(G)　E(G′) ⊆ E(G)', 'say', -4.6, 1.4, -3.2);
  say('G′ 的點、邊都是原來 G 的子集合', 'V(G′) ⊆ V(G)，E(G′) ⊆ E(G)');
  const S = [
    ['(i)', 0.6, -1.8, [0], []],
    ['(ii)', 4.6, -1.8, [0, 1, 2], [[0, 1], [0, 2]]],
    ['(iii)', 0.6, 2.0, [0, 1, 2], [[0, 1], [0, 2], [1, 2]]],
    ['(iv)', 4.6, 2.0, [0, 1, 2, 3], [[0, 1], [1, 3], [3, 2]]],
  ];
  await step(tok);                                   // 32:00 (i)–(iv) are all subgraphs of G1
  const H = S.map(([nm, cx, cz, vs, es]) => {
    const pos = gpK4(cx, cz, 1.05), sub = {};
    for (const v of vs) sub[v] = pos[v];
    tag(nm, 'ptr', cx - 1.7, 0.3, cz - 1.0);
    return gpGraph(sub, es, { dropH: 3, size: [0.5, 0.4, 0.5], gap: 0.35, color: GPC.ok });
  });
  say('(i)～(iv) 都是 G1 的 subgraph');
  await step(tok);                                   // 32:12 (i): one vertex, 0
  glow(H[0].V[0], GOLD); glow(G.V[0], GOLD);
  say('(i)：只有一個頂點 0');
  await step(tok);                                   // 32:20 its edge set is empty — still a graph
  tag('E = ∅ 也是 graph', 'note', 0.6, 1.2, -1.0);
  say('(i) 的 edge 是空的，也算一個 graph', 'V 是原本的子集合 → subgraph');
  await step(tok);                                   // 32:39 (ii): three vertices
  glow(H[0].V[0], null); glow(G.V[0], null);
  for (const v of [0, 1, 2]) { glow(H[1].V[v], GOLD); glow(G.V[v], GOLD); }
  say('(ii)：包含三個點');
  await step(tok);                                   // 32:46 keeps only two of the six edges
  for (const [u, v] of [[0, 1], [0, 2]]) gpPaint(G.E[gpEK(u, v)], GPC.hot);
  say('原本 6 條邊，只保留 2 條', '也是 subgraph');
  await step(tok);                                   // 32:53 all four are subgraphs of the complete graph
  for (const v of [0, 1, 2]) { glow(H[1].V[v], null); glow(G.V[v], null); }
  for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e);
  tag('四個都是 G1 的 subgraph', 'good', 2.6, 1.4, 0.1);
  say('上面四個都是 complete graph G1 的 subgraph');
}]);

// 33:02 G4 的兩個 connected component H1、H2
FRAG.push(['graphpeng-g4-components', 'G4：兩個 connected component', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.6]);
  const pos = { 0: [-4.6, -2.4], 1: [-5.9, -0.9], 2: [-3.3, -0.9], 3: [-4.6, 0.6], 4: [-1.6, -0.9], 5: [0.2, -0.9], 6: [2.0, -0.9], 7: [3.8, -0.9] };
  const G = gpGraph(pos, [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [5, 6], [6, 7]], { dropH: 3 });
  await step(tok);                                   // 33:02 a graph with two connected components
  tag('G4', 'ptr', -1.0, 0.3, 1.6);
  say('G4：有兩個 connected component');
  await step(tok);                                   // 33:22 the components are H1 and H2
  const b1 = ghostBox('#4b9ee2', 3.6, 1.0, 4.0); b1.position.set(-4.6, 0.3, -0.9);
  const b2 = ghostBox('#e55a9b', 6.6, 1.0, 1.6); b2.position.set(1.1, 0.3, -0.9);
  tag('H1', 'ptr', -6.4, 0.3, -2.6); tag('H2', 'ptr', 1.1, 0.3, -2.2);
  say('component（元件）：H1、H2');
  await step(tok);                                   // 33:32 in H1 every two vertices are joined by a path
  const w = await gpWalk(tok, '走', G.V[0], G.V[1], 450); await travel(tok, w, w.position.clone(), V3(-4.6, 1.1, 0.6), 450); remove(w);
  say('H1 裡的點，兩兩之間都有 path 串接');
  await step(tok);                                   // 33:50 pick any two in a component → connected
  glow(G.V[2], GOLD); glow(G.V[1], GOLD);
  gpPaint(G.E['0-2'], GPC.ok); gpPaint(G.E['0-1'], GPC.ok);
  say('component 裡任選兩點，它們都 connected', '例：2 → 0 → 1');
  await step(tok);                                   // 34:02 a component is a subgraph that must be connected
  glow(G.V[2], null); glow(G.V[1], null);
  tag('component = 連通的 subgraph', 'note', -4.6, 1.4, 2.2);
  say('component 也是一種 subgraph', '條件：裡面任兩點都要 connected');
  await step(tok);                                   // 34:18 H2: 4 to 7 via 5 and 6
  for (const k of ['4-5', '5-6', '6-7']) { gpPaint(G.E[k], GPC.hot); await anim(tok, 300, () => {}); }
  say('H2：選 4 和 7', '4 → 5 → 6 → 7 也是 connected');
  await step(tok);                                   // 34:26 two connected components extracted
  for (let i = 0; i < 4; i++) tint(G.V[i], GPC.v);
  for (let i = 4; i < 8; i++) tint(G.V[i], GPC.pink);
  tag('2 個 connected component', 'good', -1.0, 1.4, 2.2);
  say('G4 可以拆出 2 個 connected component');
}]);

// 34:38 G3 的 strongly connected component：{0,1} 與 {2}
FRAG.push(['graphpeng-scc-g3', 'G3 的 strongly connected component', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 34:38 undirected: a path is enough
  const U = gpGraph({ 0: [-5.2, -1.6], 1: [-5.2, 1.6] }, [[0, 1]], { dropH: 3, color: '#9b7ef4' });
  tag('undirected', 'ptr', -5.2, 0.3, 3.0);
  say('undirected graph：只要有 path 就是 connected');
  await step(tok);                                   // 34:54 strongly: a stricter condition
  const G = gpGraph({ 0: [-1.6, 0], 1: [1.6, 0], 2: [4.8, 0] }, [], { dropH: 3 });
  const e01 = gpE(G.V[0], G.V[1], { dir: true, off: 0.25 });
  const e10 = gpE(G.V[1], G.V[0], { dir: true, off: 0.25 });
  const e12 = gpE(G.V[1], G.V[2], { dir: true });
  tag('G3（directed）', 'ptr', 1.6, 0.3, 2.2);
  say('strongly：比 connected 更強、條件更嚴', '發生在 directed graph');
  await step(tok);                                   // 35:04 0 has to reach 1…
  gpPaint(e01, GPC.hot); glow(G.V[0], GOLD);
  const w = await gpWalk(tok, '0 → 1', G.V[0], G.V[1], 600); remove(w);
  say('0 要到得了 1');
  await step(tok);                                   // 35:14 …and 1 has to reach 0: two edges
  gpPaint(e10, GPC.hot); glow(G.V[1], GOLD);
  const w2 = await gpWalk(tok, '1 → 0', G.V[1], G.V[0], 600); remove(w2);
  say('1 也要到得了 0', '要兩條 edge：⟨0,1⟩、⟨1,0⟩');
  await step(tok);                                   // 35:27 undirected: one edge works both ways
  gpPaint(U.E['0-1'], GPC.ok);
  const w3 = await gpWalk(tok, '↕', U.V[0], U.V[1], 500); remove(w3);
  say('undirected：一條 edge 就能雙向走', 'directed 要更多的邊支撐');
  await step(tok);                                   // 35:52 {0,1} is a strongly connected component
  const b1 = ghostBox('#c08a1f', 4.6, 1.2, 2.0); b1.position.set(0, 0.3, 0);
  tag('SCC {0, 1}', 'good', 0, 1.4, -1.4);
  say('{0, 1} 是一個 strongly connected component');
  await step(tok);                                   // 35:59 2 alone is also one
  gpPaint(e12, GPC.red);
  const b2 = ghostBox('#d64545', 1.6, 1.2, 2.0); b2.position.set(4.8, 0.3, 0);
  tag('SCC {2}', 'good', 4.8, 1.4, -1.4);
  say('頂點 2 自己一個點，也是一個 SCC', '2 回不到 1，所以不能併進 {0,1}');
  await step(tok);                                   // 36:16 a lone vertex: isolated
  tag('isolated（孤立點）', 'note', 4.8, 1.4, 1.4);
  say('只有自己一個點的 component：isolated');
  await step(tok);                                   // 36:49 many applications filter it out
  tint(G.V[2], '#d8cfc0');
  say('很多應用會把 isolated point 濾掉，不考慮');
}]);

// 36:56 degree、in/out-degree、e = Σd / 2；Graph ADT
FRAG.push(['graphpeng-degree', 'Degree 與 e = Σd / 2', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-4.4, 0, 1.8), GP_K4E, { dropH: 3 });
  tag('G1', 'ptr', -4.4, 0.3, 2.9);
  await step(tok);                                   // 36:56 degree
  say('degree：一個 vertex 連了幾條邊');
  await step(tok);                                   // 37:04 count the edges around each vertex
  for (const n of [0, 1, 2, 3]) {
    glow(G.V[n], GOLD);
    for (const [u, v] of GP_K4E) gpPaint(G.E[u + '-' + v], u === n || v === n ? GPC.hot : GPC.e);
    const p = gpP(G.V[n]); tag('d=3', 'ptr alt', p.x + (n === 1 ? -0.9 : n === 2 ? 0.9 : 0.8), 0.5, p.z + (n === 0 ? -0.5 : n === 3 ? 0.5 : -0.5));
    await anim(tok, 450, () => {});
    glow(G.V[n], null);
  }
  for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e);
  say('G1 每個點都連 3 條邊', 'd₀ = d₁ = d₂ = d₃ = 3');
  await step(tok);                                   // 37:15 directed: in-degree and out-degree
  const D = gpGraph({ 0: [-0.8, -2.0], 1: [-0.8, 0], 2: [-0.8, 2.0] }, [], { dropH: 3 });
  tag('G3', 'ptr', -0.8, 0.3, 3.0);
  const a = gpE(D.V[0], D.V[1], { dir: true, off: 0.22 }), b = gpE(D.V[1], D.V[0], { dir: true, off: 0.22 }), c = gpE(D.V[1], D.V[2], { dir: true });
  say('directed：degree 分成兩種', 'in-degree 與 out-degree');
  await step(tok);                                   // 37:23 in-degree: edges pointing at it
  glow(D.V[1], GOLD); gpPaint(a, GPC.ok);
  tag('in = 1', 'good', 0.4, 0.5, -0.6);
  say('in-degree(1)：指向 1 的邊數', '⟨0,1⟩ → in-degree = 1');
  await step(tok);                                   // 37:30 out-degree: edges leaving it
  gpPaint(a, GPC.e); gpPaint(b, GPC.hot); gpPaint(c, GPC.hot);
  tag('out = 2', 'ptr alt', 0.4, 0.5, 0.6);
  say('out-degree(1)：從 1 指出去的邊數', '⟨1,0⟩、⟨1,2⟩ → out-degree = 2');
  await step(tok);                                   // 37:38 n vertices, e edges, dᵢ = degree of i
  glow(D.V[1], null);
  tag('n 個頂點、e 條邊、dᵢ = 頂點 i 的 degree', 'say', 3.6, 1.6, -3.2);
  say('n 個頂點、e 條邊，dᵢ 是每個點的 degree');
  await step(tok);                                   // 37:48 e = (Σ dᵢ) / 2
  tag('e = (Σ dᵢ) / 2 = (3+3+3+3)/2 = 6', 'ptr alt', 3.6, 1.6, -2.4);
  say('邊數 e = 所有 degree 加起來 ÷ 2', 'G1：12 / 2 = 6');
  await step(tok);                                   // 37:54 ÷ 2: each edge counted at both ends
  for (const k of ['0-1']) gpPaint(G.E[k], GPC.red);
  glow(G.V[0], GOLD); glow(G.V[1], GOLD);
  say('為什麼除 2？每條邊被兩端各算一次', '(0,1) 在 d₀、d₁ 各算一次');
  await step(tok);                                   // 38:21 Graph ADT
  glow(G.V[0], null); glow(G.V[1], null); gpPaint(G.E['0-1'], GPC.e);
  const adt = code(['class Graph (ADT)', '  InsertVertex(v)', '  InsertEdge(u, v)', '  DeleteVertex(v)', '  DeleteEdge(u, v)', '  IsEmpty()'], 3.6, 0.3, 0.5, -0.6);
  say('Graph 的 ADT：有哪些 member function');
  await step(tok);                                   // 38:38 insert / delete vertices and edges
  for (let i = 1; i <= 4; i++) { adt.hl(i); await anim(tok, 350, () => {}); }
  say('加點、加邊、刪點、刪邊');
  await step(tok);                                   // 38:45 IsEmpty
  adt.hl(5);
  say('還有一個 Boolean function：IsEmpty()', '判斷 graph 是不是空的');
}]);

// Weiss 的 7 點有向圖（影片：1 → 2、3、4；2 → 4、5）
const GPW = { pos: { 1: [-5.4, -2.2], 2: [-2.6, -2.2], 3: [-6.4, 0], 4: [-4.0, 0], 5: [-1.6, 0], 6: [-5.4, 2.2], 7: [-2.6, 2.2] },
  adj: { 1: [2, 3, 4], 2: [4, 5], 3: [6], 4: [3, 6, 7], 5: [4, 7], 6: [], 7: [6] } };
function gpWeiss() {
  const ed = [];
  for (const u of Object.keys(GPW.adj)) for (const v of GPW.adj[u]) ed.push([Number(u), v]);
  return gpGraph(GPW.pos, ed, { dir: true, dropH: 3, size: [0.7, 0.5, 0.7], gap: 0.45 });
}
// the 7 × 7 adjacency matrix of the Weiss graph (all zeros at first)
function gpWMat() {
  const x0 = 0.6, z0 = -2.6, d = 0.8, M = [];
  for (let i = 1; i <= 7; i++) { tag(String(i), 'idx', x0 + (i - 1) * d, 0, z0 - 0.7); tag(String(i), 'idx', x0 - 0.7, 0, z0 + (i - 1) * d); }
  for (let i = 1; i <= 7; i++) { M[i] = []; for (let j = 1; j <= 7; j++) M[i][j] = cube(0, GPC.zero, [0.66, 0.2, 0.66], x0 + (j - 1) * d, 0.1, z0 + (i - 1) * d, 0); }
  const set1 = (i, j) => { relabel(M[i][j], 1); tint(M[i][j], GPC.one); M[i][j].scale.y = 2.2; };
  const glowRow = (i, js, c) => { for (const j of js) glow(M[i][j], c); };
  return { M, set1, glowRow };
}

// 38:62 adjacency matrix（7 × 7，directed → 不對稱，space O(V²)）
FRAG.push(['graphpeng-weiss-matrix', 'Adjacency matrix：7 × 7', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G = gpWeiss();
  await step(tok);                                   // 39:02 the simplest: use a matrix
  say('怎麼用程式表示 graph？最簡單：用 matrix');
  await step(tok);                                   // 39:09 a directed graph → a 2D matrix
  for (let i = 1; i <= 7; i++) glow(G.V[i], '#3a2a10');
  say('這是一個 directed graph', '用 2-dimensional matrix 存');
  await step(tok);                                   // 39:17 7 vertices → 7 × 7
  for (let i = 1; i <= 7; i++) glow(G.V[i], null);
  const W = gpWMat();
  say('7 個點 → 7 × 7 的 matrix');
  await step(tok);                                   // 39:27 edge → 1, no edge → 0
  tag('有邊 = 1，沒邊 = 0', 'note', 3.0, 1.2, 3.4);
  say('有邊就填 1，沒邊就填 0');
  await step(tok);                                   // 39:35 1 → 2 and 1 → 3
  glow(G.V[1], GOLD);
  for (const j of [2, 3]) { W.set1(1, j); glow(W.M[1][j], GOLD); glow(G.V[j], GOLD); await anim(tok, 400, () => {}); }
  say('1 連到 2 → M[1][2] = 1', '1 也連到 3 → M[1][3] = 1');
  await step(tok);                                   // 39:45 1 → 4; the rest are 0
  W.set1(1, 4); glow(W.M[1][4], GOLD); glow(G.V[4], GOLD);
  await anim(tok, 500, () => {});
  for (let j = 1; j <= 7; j++) { glow(W.M[1][j], null); glow(G.V[j], null); }
  for (let i = 2; i <= 7; i++) { for (const j of GPW.adj[i]) W.set1(i, j); await anim(tok, 200, () => {}); }
  say('1 連到 4 也是 1；沒連的都是 0', '其他列依此類推：共 12 個 1');
  await step(tok);                                   // 39:58 space depends on the number of vertices
  say('空間花多少？只看頂點個數');
  await step(tok);                                   // 40:05 O(V²): 7 × 7
  tag('space：O(V²) = 7 × 7 = 49 格', 'ptr alt', 3.0, 1.2, -3.6);
  say('space = O(V²)：7 × 7 = 49 格', '只有 12 個 1，其他都是 0');
  await step(tok);                                   // 40:19 undirected → symmetric
  glow(W.M[1][2], GOLD); glow(W.M[2][1], RED);
  say('如果是 undirected graph，matrix 會 symmetric', '1 連到 2，2 也連到 1；這張是 directed，所以不對稱');
}]);

// 40:33 adjacency list（同一張圖；space O(V + E)）
FRAG.push(['graphpeng-weiss-list', 'Adjacency list：7 點有向圖', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G = gpWeiss();
  const Z = (i) => -2.7 + (i - 1) * 0.9;
  await step(tok);                                   // 40:33 the matrix uses lots of memory → linked list
  say('matrix 很花記憶體', '另一種表示法：用 linked list');
  await step(tok);                                   // 40:47 heads = the vertices
  const heads = [];
  for (let i = 1; i <= 7; i++) { heads.push(cube(i, GPC.head, [0.6, 0.45, 0.6], 0.2, 0.25, Z(i), 3)); }
  tag('head（白色）= 頂點', 'idx', 0.2, 0, -3.5);
  say('每個頂點一個 head（白色格子）', '後面接它連到的點');
  await step(tok);                                   // 41:03 vertex 1 → 2, 3, 4
  glow(G.V[1], GOLD);
  const r1 = GPW.adj[1];
  for (let k = 0; k < r1.length; k++) { cube(r1[k], GPC.v, [0.6, 0.45, 0.6], 0.2 + (k + 1) * 1.1, 0.25, Z(1), 3); gpArrow(V3(0.5 + k * 1.1, 0.3, Z(1)), V3(1.0 + k * 1.1, 0.3, Z(1))); glow(G.V[r1[k]], GOLD); await anim(tok, 300, () => {}); }
  say('頂點 1 連到 2、3、4', '1 → 2 → 3 → 4');
  await step(tok);                                   // 41:21 vertex 2 → 4, 5
  for (let i = 1; i <= 7; i++) glow(G.V[i], null);
  glow(G.V[2], GOLD);
  const r2 = GPW.adj[2];
  for (let k = 0; k < r2.length; k++) { cube(r2[k], GPC.v, [0.6, 0.45, 0.6], 0.2 + (k + 1) * 1.1, 0.25, Z(2), 3); gpArrow(V3(0.5 + k * 1.1, 0.3, Z(2)), V3(1.0 + k * 1.1, 0.3, Z(2))); glow(G.V[r2[k]], GOLD); await anim(tok, 300, () => {}); }
  say('頂點 2 連到 4 和 5', '2 → 4 → 5');
  await step(tok);                                   // 41:32 and so on → adjacency list
  for (let i = 1; i <= 7; i++) glow(G.V[i], null);
  for (let i = 3; i <= 7; i++) {
    GPW.adj[i].forEach((v, k) => { cube(v, GPC.v, [0.6, 0.45, 0.6], 0.2 + (k + 1) * 1.1, 0.25, Z(i), 3); gpArrow(V3(0.5 + k * 1.1, 0.3, Z(i)), V3(1.0 + k * 1.1, 0.3, Z(i))); });
    await anim(tok, 200, () => {});
  }
  tag('adjacency list', 'ptr', 2.4, 0.3, -3.6);
  say('依此類推：這就叫 adjacency list', '6 沒有指出去的邊 → 空串列');
  await step(tok);                                   // 41:45 why "adjacent": it records the neighbours
  glow(G.V[4], GOLD); glow(heads[3], GOLD);
  for (const v of GPW.adj[4]) glow(G.V[v], '#8a6400');
  say('為什麼叫 adjacent？', '每條串列記的是跟這個點相連（adjacent）的點');
  await step(tok);                                   // 42:15 space O(V + E)
  glow(G.V[4], null); glow(heads[3], null);
  for (const v of GPW.adj[4]) glow(G.V[v], null);
  tag('space：O(V + E) = 7 + 12', 'ptr alt', 2.4, 1.2, 3.4);
  say('space = O(V + E)', 'V 個 head ＋ E 個節點');
  await step(tok);                                   // 42:36 other graphs (G1) work the same way
  tag('G1 也一樣：head 後面接所有鄰居', 'note', -4.0, 1.4, 3.4);
  say('其他 graph（例如 G1）也一樣', 'head node 後面接它所有的鄰居');
}]);

// ═════════════ Lec19 (Ax1OL2mikJo) ═════════════

// 00:16 複習 adjacency matrix（同一張 7 點有向圖）
FRAG.push(['graphpeng-matrix-review', '複習：Adjacency matrix', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G = gpWeiss();
  await step(tok);                                   // 0:16 review: how to represent a graph
  say('複習：graph 要怎麼表示');
  await step(tok);                                   // 0:29 an n × n matrix, n = number of vertices
  const W = gpWMat();
  tag('n × n，n = vertex 個數', 'note', 3.0, 1.2, -3.6);
  say('第一種：n × n 的 2D matrix', 'n = vertex 的個數 = 7');
  await step(tok);                                   // 0:43 connected → 1, not → 0
  for (let i = 1; i <= 7; i++) for (const j of GPW.adj[i]) W.set1(i, j);
  say('有連線填 1，沒有連線填 0');
  await step(tok);                                   // 0:55 directed → not symmetric
  glow(W.M[1][2], GOLD); glow(W.M[2][1], RED);
  say('這是 directed graph → matrix 不 symmetric', 'M[1][2] = 1，M[2][1] = 0');
  await step(tok);                                   // 1:03 1 → 2, 1 → 3
  glow(W.M[2][1], null); glow(G.V[1], GOLD);
  W.glowRow(1, [2, 3], GOLD); glow(G.V[2], GOLD); glow(G.V[3], GOLD);
  say('1 連到 2、1 連到 3', '對應的格子是 1');
  await step(tok);                                   // 1:13 1 → 4
  glow(W.M[1][4], GOLD); glow(G.V[4], GOLD);
  say('1 連到 4 → M[1][4] = 1');
  await step(tok);                                   // 1:21 undirected → symmetric
  for (let i = 1; i <= 7; i++) glow(G.V[i], null);
  W.glowRow(1, [2, 3, 4], null);
  tag('undirected → symmetric', 'say', 3.0, 1.2, 3.4);
  say('如果是 undirected graph，matrix 就 symmetric', 'M[u][v] = M[v][u]');
  await step(tok);                                   // 1:35 size depends on the number of vertices
  tag('大小 = 7 × 7，只看頂點數', 'ptr alt', 3.0, 1.2, -2.9);
  say('matrix 的大小只跟頂點個數有關');
  await step(tok);                                   // 1:42 dense (e.g. complete) → efficient
  say('graph 很 dense（例如 complete graph）', '格子幾乎都有值 → 用 matrix 存還蠻有效率');
  await step(tok);                                   // 2:00 this one is sparse: lots of 0s
  for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) if (!GPW.adj[i].includes(j)) glow(W.M[i][j], '#3a2a10');
  tag('很多 0 → sparse', 'bad', 3.0, 1.8, 3.4);
  say('這張圖很多格是 0 → sparse', '於是有第二種存法');
}]);

// 02:07 adjacency list：先看 7 點有向圖，再看 G1（complete）與 G3（directed）
FRAG.push(['graphpeng-g1g3-lists', 'Adjacency list：G1 與 G3', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const W = gpWeiss();
  const Z = (i) => -2.7 + (i - 1) * 0.9;
  await step(tok);                                   // 2:07 second method: adjacency list
  say('第二種存法：adjacency list');
  await step(tok);                                   // 2:18 the middle column is the head nodes
  const heads = [];
  for (let i = 1; i <= 7; i++) heads.push(cube(i, GPC.head, [0.6, 0.45, 0.6], 0.2, 0.25, Z(i), 3));
  tag('head node', 'idx', 0.2, 0, -3.5);
  say('中間那一排是 head node', '7 個頂點，每個一個 head');
  await step(tok);                                   // 2:37 adjacent node: one hop away
  glow(W.V[1], GOLD);
  for (const v of GPW.adj[1]) { const t = await gpWalk(tok, '1 hop', W.V[1], W.V[v], 350); remove(t); glow(W.V[v], '#8a6400'); }
  say('adjacent node：只經過一條邊（one hop）就到得了的點');
  await step(tok);                                   // 2:45 1 is connected to 2, 3, 4
  const r1 = [];
  GPW.adj[1].forEach((v, k) => { r1.push(cube(v, GPC.v, [0.6, 0.45, 0.6], 0.2 + (k + 1) * 1.1, 0.25, Z(1), 3)); gpArrow(V3(0.5 + k * 1.1, 0.3, Z(1)), V3(1.0 + k * 1.1, 0.3, Z(1))); });
  say('1 跟 2、3、4 相連', '1 → 2 → 3 → 4');
  await step(tok);                                   // 2:54 the order doesn't matter
  move(r1[0], 0.2 + 3 * 1.1, 0.25, Z(1)); move(r1[2], 0.2 + 1 * 1.1, 0.25, Z(1));
  say('串列裡的順序不重要', '4 → 3 → 2 也可以：都是鄰居就好');
  await step(tok);                                   // 3:12 space O(V + E)
  for (let i = 1; i <= 7; i++) glow(W.V[i], null);
  for (let i = 2; i <= 7; i++) GPW.adj[i].forEach((v, k) => { cube(v, GPC.v, [0.6, 0.45, 0.6], 0.2 + (k + 1) * 1.1, 0.25, Z(i), 3); gpArrow(V3(0.5 + k * 1.1, 0.3, Z(i)), V3(1.0 + k * 1.1, 0.3, Z(i))); });
  tag('space：O(V + E)', 'ptr alt', 2.4, 1.2, 3.4);
  say('space = O(V + E)', 'V = 頂點數，E = 邊數');
  await step(tok);                                   // 3:28 more examples
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G1 = gpGraph(gpK4(-5.4, 0, 1.3), GP_K4E, { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 });
  tag('G1', 'ptr', -5.4, 0.3, 2.2);
  say('再看 adjacency list 的例子');
  await step(tok);                                   // 3:33 G1 is complete
  const L1 = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 3], 3: [0, 1, 2] };
  for (let i = 0; i < 4; i++) await gpRow(tok, i, L1[i], -3.3, -2.1 + i * 1.3, 0.95, GPC.v, 90, [0.55, 0.42, 0.55]);
  say('G1 是 complete graph', '每個頂點都跟其他所有頂點相連');
  await step(tok);                                   // 3:46 every list has the same length
  tag('每條都 3 個', 'ptr alt', -1.4, 1.0, 3.0);
  say('每條串列的節點數一模一樣', '因為它是 complete');
  const G3 = gpGraph({ 0: [1.8, -2.0], 1: [1.8, 0], 2: [1.8, 2.0] }, [], { dropH: 3, size: [0.55, 0.45, 0.55] });
  gpE(G3.V[0], G3.V[1], { dir: true, off: 0.2, gap: 0.4 }); gpE(G3.V[1], G3.V[0], { dir: true, off: 0.2, gap: 0.4 }); gpE(G3.V[1], G3.V[2], { dir: true, gap: 0.4 });
  tag('G3', 'ptr', 1.8, 0.3, 3.0);
  const L3 = { 0: [1], 1: [0, 2], 2: [] };
  await step(tok);                                   // 4:12 G3 directed: 0 → 1
  glow(G3.V[0], GOLD);
  await gpRow(tok, 0, L3[0], 3.6, -2.0, 0.95, GPC.pink, 200, [0.55, 0.42, 0.55]);
  say('G3 是有向圖：0 指向 1', 'list[0] = 1');
  await step(tok);                                   // 4:18 1 → 0 and 2
  glow(G3.V[0], null); glow(G3.V[1], GOLD);
  await gpRow(tok, 1, L3[1], 3.6, 0, 0.95, GPC.pink, 200, [0.55, 0.42, 0.55]);
  say('1 連到 0 和 2', 'list[1] = 0 → 2');
  await step(tok);                                   // 4:30 2 points nowhere: we record outgoing edges
  glow(G3.V[1], null); glow(G3.V[2], GOLD);
  await gpRow(tok, 2, L3[2], 3.6, 2.0, 0.95, GPC.pink, 0, [0.55, 0.42, 0.55]);
  tag('空串列', 'idx', 4.6, 0, 2.0);
  say('2 沒有指出去任何邊 → 空串列', 'directed：串列只記「指出去」的邊');
}]);

// 04:47 sequential representation：G4 存進一維陣列 node[0..22]
FRAG.push(['graphpeng-sequential', '一維陣列表示：node[]', async (tok) => {
  fresh([0, 10, 8], [0, 0, 0]);
  const node = [9, 11, 13, 15, 17, 18, 20, 22, 23, 2, 1, 3, 0, 0, 3, 1, 2, 5, 6, 4, 5, 7, 6];
  const own = [];
  for (let v = 0; v < 8; v++) for (let k = node[v]; k < node[v + 1]; k++) own[k] = v;
  const X = (i) => -5.72 + i * 0.52, Z = 1.0;
  const C = [];
  let G = null;
  await step(tok);                                   // 4:47 third: a one-dimensional array
  say('第三種表示法：一個 one-dimensional array');
  await step(tok);                                   // 5:03 G4 with two components H1, H2
  const pos = { 0: [-5.0, -3.4], 1: [-6.0, -2.4], 2: [-4.0, -2.4], 3: [-5.0, -1.4], 4: [-1.6, -2.4], 5: [0.0, -2.4], 6: [1.6, -2.4], 7: [3.2, -2.4] };
  G = gpGraph(pos, [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [5, 6], [6, 7]], { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 });
  tag('H1', 'ptr', -6.6, 0.3, -3.4); tag('H2', 'ptr', 4.4, 0.3, -2.4);
  say('例子是 G4：兩個 component H1、H2', '頂點 0～7');
  await step(tok);                                   // 5:17 the red block: where each vertex's neighbours start
  for (let i = 0; i <= 8; i++) { C.push(cube(node[i], GPC.start, [0.46, 0.4, 0.46], X(i), 0.2, Z, 3)); tag(String(i), 'idx', X(i), 0, Z + 0.55); }
  tag('起點區', 'ptr', X(4), 0.3, Z + 1.3);
  say('前面紅色區塊：每個頂點的鄰居從哪一格開始放');
  await step(tok);                                   // 5:35 index 0..7 = the vertices
  for (let i = 0; i < 8; i++) { glow(C[i], GOLD); glow(G.V[i], GOLD); await anim(tok, 140, () => {}); }
  for (let i = 0; i < 8; i++) { glow(C[i], null); glow(G.V[i], null); }
  say('index 0～7 對應 8 個頂點');
  await step(tok);                                   // 5:45 index 8: not a vertex, marks the end
  glow(C[8], RED);
  tag('結尾記號', 'bad', X(8), 1.0, Z);
  say('index 8 沒有對應的頂點', '它是用來標示「結尾」的');
  await step(tok);                                   // 5:58 node[0] = 9
  glow(C[8], null); glow(C[0], GOLD); glow(G.V[0], GOLD);
  for (let i = 9; i < 23; i++) { C.push(cube(node[i], own[i] % 2 ? GPC.ok : GPC.v, [0.46, 0.4, 0.46], X(i), 0.2, Z, 3)); tag(String(i), 'idx', X(i), 0, Z + 0.55); }
  const ar = gpArrow(V3(X(0), 0.7, Z - 0.3), V3(X(9), 0.7, Z - 0.3), 0x8a6400);
  say('node[0] = 9', '跟 0 相連的點，從 index 9 開始放');
  await step(tok);                                   // 6:05 green: index 9 and 10
  glow(C[9], GOLD); glow(C[10], GOLD);
  tag('鄰居區', 'ptr', X(15), 0.3, Z + 1.3);
  say('綠色的 index 9、10：0 的鄰居');
  await step(tok);                                   // 6:28 0 connects to 2 and 1
  glow(G.V[2], GOLD); glow(G.V[1], GOLD);
  say('node[9] = 2、node[10] = 1', '0 跟 2、1 相連');
  await step(tok);                                   // 7:03 where does it end? look at node[1] = 11
  glow(C[1], RED);
  say('結束在哪？看下一個頂點的起點', 'node[1] = 11 → 1 的鄰居從 11 開始');
  await step(tok);                                   // 8:00 end = next start − 1
  tag('終點 = 下一個起點 − 1', 'note', X(4), 1.2, Z - 1.2);
  say('不用另外記終點：下一個起點減 1 就是', '0 的鄰居：index 9 到 11 − 1 = 10');
  await step(tok);                                   // 8:17 node[7] = 22
  kill(ar); [0, 1, 9, 10].forEach((k) => glow(C[k], null)); for (let v = 0; v < 8; v++) glow(G.V[v], null);
  glow(C[7], GOLD); glow(G.V[7], GOLD);
  const ar2 = gpArrow(V3(X(7), 0.7, Z - 0.3), V3(X(22), 0.7, Z - 0.3), 0x8a6400);
  say('node[7] = 22', '7 的鄰居從 index 22 開始');
  await step(tok);                                   // 8:24 index 22 holds 6
  glow(C[22], GOLD); glow(G.V[6], GOLD);
  say('index 22 放的是 6', '7 只跟 6 相連');
  await step(tok);                                   // 9:18 drawback: adding or deleting a vertex
  kill(ar2); [7, 22].forEach((k) => glow(C[k], null)); glow(G.V[7], null); glow(G.V[6], null);
  say('缺點：要在 graph 刪除或新增一個點時……');
  await step(tok);                                   // 9:32 add vertices 8 and 9
  gpV(8, 4.6, -2.4, GPC.hot, 3, [0.55, 0.45, 0.55]); gpV(9, 5.8, -2.4, GPC.hot, 3, [0.55, 0.45, 0.55]);
  say('例如新增兩個點：vertex 8、vertex 9', '它們的起點要放在 index 8、9');
  await step(tok);                                   // 9:50 index 9 was 0's neighbour → shift everything
  glow(C[9], RED);
  for (let i = 9; i < 23; i++) move(C[i], X(i) + 1.04, 0.2, Z);
  await anim(tok, 900, () => {});
  say('可是 index 9 原本放 0 的鄰居', '後面整段都要往右 shift');
  await step(tok);                                   // 10:02 movement cost
  tag('movement cost 很高', 'bad', X(15), 1.2, Z - 1.2);
  say('新增／刪除頂點要搬動整個 array', 'movement cost 很高');
}]);

// 10:26 inverse adjacency list（G3）：記 in-degree
FRAG.push(['graphpeng-inverse-list', 'Inverse adjacency list：誰指向我', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const OUT = { 0: [1], 1: [0, 2], 2: [] }, IN = { 0: [1], 1: [0], 2: [1] };
  await step(tok);                                   // 10:26 three methods so far
  const rec = tag('目前三種：2D array ｜ adjacency list ｜ sequential', 'say', 0, 1.6, -3.6);
  say('到目前講了三種表示法', '還有第四種，等一下講');
  await step(tok);                                   // 10:45 inverse adjacency list
  remove(rec);
  const G = gpGraph({ 0: [-5.6, -2.2], 1: [-5.6, 0], 2: [-5.6, 2.2] }, [], { dropH: 3 });
  gpE(G.V[0], G.V[1], { dir: true, off: 0.22 }); gpE(G.V[1], G.V[0], { dir: true, off: 0.22 }); gpE(G.V[1], G.V[2], { dir: true });
  tag('G3', 'ptr', -5.6, 0.3, 3.3);
  say('inverse adjacency list', 'inverse = 顛倒');
  await step(tok);                                   // 10:56 the adjacency list records out-degree
  tag('adjacency list：我指向誰', 'ptr', -2.0, 0.3, -3.3);
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(await gpRow(tok, i, OUT[i], -3.4, -2.2 + i * 2.2, 1.2, GPC.v, 150));
  say('原本的 adjacency list 記的是 out-degree', '「我指向誰」');
  await step(tok);                                   // 11:07 inverse records in-degree: who points to me
  tag('inverse：誰指向我', 'ptr', 4.2, 0.3, -3.3);
  say('inverse adjacency list 記的是 in-degree', '「誰指向我」');
  const inv = [];
  for (let i = 0; i < 3; i++) {
    await step(tok);                                 // 11:16 0 ← 1 ／ 11:26 1 ← 0 ／ 11:35 2 ← 1
    for (let k = 0; k < 3; k++) glow(G.V[k], null);
    glow(G.V[i], GOLD); glow(G.V[IN[i][0]], '#8a6400');
    inv.push(await gpRow(tok, i, IN[i], 2.8, -2.2 + i * 2.2, 1.2, GPC.pink, 250));
    say('誰指向 ' + i + '？是 ' + IN[i][0], 'inverse[' + i + '] = ' + IN[i][0]);
  }
  await step(tok);                                   // 11:44 compare with G3's adjacency list
  for (let k = 0; k < 3; k++) glow(G.V[k], null);
  for (const r of rows) glow(r.head, GOLD);
  for (const r of inv) glow(r.head, '#8a6400');
  say('跟 G3 的 adjacency list 比：記的資訊不一樣', '左邊：我指向誰　右邊：誰指向我');
  await step(tok);                                   // 12:38 with only the adjacency list: in-degree of 2?
  for (const r of rows) glow(r.head, null);
  for (const r of inv) { glow(r.head, null); r.nodes.concat([r.head]).forEach((m) => tint(m, '#e6ddcf')); }
  glow(G.V[2], GOLD);
  say('假設只有 adjacency list', '問：2 的 in-degree 是多少？');
  let cnt = 0;
  const cntT = tag('in-degree(2) = 0', 'ptr alt', -5.6, 1.4, 2.2);
  for (let i = 0; i < 3; i++) {
    await step(tok);                                 // 12:58 scan list 0 ／ 13:08 list 1 has 2 ／ 13:15 list 2
    for (const r of rows) glow(r.head, null);
    glow(rows[i].head, GOLD);
    for (const nd of rows[i].nodes) {
      glow(nd, '#3a2a10'); await anim(tok, 400, () => {});
      if (nd.userData.lbl.element.textContent === '2') { glow(nd, GOLD); cnt++; txt(cntT, 'in-degree(2) = ' + cnt); }
    }
    say('scan list[' + i + ']：' + (i === 1 ? '有 2 → 加 1' : rows[i].nodes.length ? '沒有 2' : '是空的'), 'in-degree(2) 目前 = ' + cnt);
  }
  await step(tok);                                   // 13:36 every vertex's in-degree: scan everything
  for (const r of rows) { glow(r.head, '#8a6400'); r.nodes.forEach((m) => glow(m, '#8a6400')); }
  say('要算所有點的 in-degree', '也一樣要把所有串列全部 scan 一遍');
  await step(tok);                                   // 13:51 with the inverse list: just count
  for (const r of rows) { glow(r.head, null); r.nodes.forEach((m) => glow(m, null)); }
  for (const r of inv) r.nodes.concat([r.head]).forEach((m) => tint(m, GPC.pink));
  glow(inv[2].head, GOLD); glow(inv[2].nodes[0], GOLD);
  say('有 inverse adjacency list 就很快', '數 inverse[2] 的節點數 = 1 → in-degree(2) = 1');
}]);

// 14:11 adjacency multilist 的動機：adjacency list 每條邊存兩次
FRAG.push(['graphpeng-multilist-why', 'Multilist：每條邊只存一次', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  await step(tok);                                   // 14:11 fourth: multi-linked list
  const t0 = tag('第四種：adjacency multilist（multi-linked list）', 'say', 0, 1.6, -3.6);
  say('第四種表示法：multi-linked list', '「多個」linked list');
  await step(tok);                                   // 14:23 in the adjacency list, an edge (u, v)…
  remove(t0);
  const G = gpGraph(gpK4(-5.0, 0, 1.6), GP_K4E, { dropH: 3, size: [0.6, 0.45, 0.6], gap: 0.38 });
  const L = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 3], 3: [0, 1, 2] };
  const rows = [];
  for (let i = 0; i < 4; i++) rows.push(await gpRow(tok, i, L[i], -2.4, -2.4 + i * 1.3, 1.0, GPC.v, 60, [0.6, 0.45, 0.6]));
  say('回到 adjacency list：看一條邊 (u, v)');
  await step(tok);                                   // 14:33 it is stored twice
  gpPaint(G.E['0-1'], GPC.red);
  say('(u, v) 這條邊被存了兩次');
  await step(tok);                                   // 14:45 u's list has a node v
  glow(rows[0].head, GOLD); glow(rows[0].nodes[0], RED);
  say('u 的串列裡一定有 v', 'list[0] 有 1');
  await step(tok);                                   // 14:53 v's list has a node u
  glow(rows[1].head, GOLD); glow(rows[1].nodes[0], RED);
  say('v 的串列裡也一定有 u', 'list[1] 有 0 → 同一條邊存兩次');
  await step(tok);                                   // 15:15 multilist: each edge stored once
  for (const r of rows) glow(r.head, null);
  tag('目標：一條邊只存一次', 'good', 3.4, 1.6, -3.2);
  say('multilist 的目標：graph 的一條邊只存一次');
  await step(tok);                                   // 15:25 the adjacency list starts from vertices
  for (const r of rows) glow(r.head, '#8a6400');
  tag('adjacency list：以 vertex 為出發點', 'say', 0.4, 1.0, 3.4);
  say('adjacency list：以 vertex 為出發點');
  await step(tok);                                   // 15:34 the multilist starts from edges
  for (const r of rows) glow(r.head, null);
  tag('multilist：以 edge 為出發點', 'note', 3.4, 1.0, 3.9);
  say('multilist：以 edge 為出發點');
  await step(tok);                                   // 15:42 example: complete graph 0..3
  for (const r of rows) { fly(r.head); r.nodes.forEach((m) => fly(m)); r.arrows.forEach(kill); }
  for (let v = 0; v < 4; v++) glow(G.V[v], GOLD);
  say('例子：complete graph，頂點 0、1、2、3');
  await step(tok);                                   // 16:03 six edges
  for (let v = 0; v < 4; v++) glow(G.V[v], null);
  GP_K4E.forEach(([u, v], k) => { const m = gpMid(G.V[u], G.V[v], 0.25); tag('N' + k, 'ptr alt', m.x, 0.5, m.z); gpPaint(G.E[u + '-' + v], GPC.hot); });
  say('共有 6 條邊', '(0,1) (0,2) (0,3) (1,2) (1,3) (2,3)');
  await step(tok);                                   // 16:13 each edge becomes one node
  const n0 = code(['N0: | m | 0 | 1 | link1 | link2 |'], 1.4, 2.0, 0.5, -0.4);
  n0.hl(0);
  say('每條邊用一個 node 表示', '(0,1) → node N0');
  await step(tok);                                   // 16:33 fields 2 and 3: the two endpoints
  tag('第 2、3 欄 = 這條邊的兩個端點', 'idx', 1.4, 0.3, 0.6);
  say('第二、第三欄：這條邊兩端的 vertex');
  await step(tok);                                   // 16:53 the left end is 0, the right end is 1
  tag('左邊 = 0，右邊 = 1', 'note', 1.4, 1.0, 1.4);
  say('第一個邊 N0：左邊是 0，右邊是 1');
}]);

// the K4 multilist table + heads + graph, shared by the two pointer-tracing scenes
const GP_N = [[0, 1, 1, 3], [0, 2, 2, 3], [0, 3, -1, 4], [1, 2, 4, 5], [1, 3, -1, 5], [2, 3, -1, -1]];
const gpNZ = (k) => -2.6 + k * 1.05, GP_NX = [-1.4, -0.6, 0.5, 1.5];
function gpMultiTable() {
  const R = [];
  for (let k = 0; k < 6; k++) {
    const [a, b, l1, l2] = GP_N[k];
    tag('N' + k, 'ptr', -2.6, 0.3, gpNZ(k));
    R.push([cube(a, '#c9d9f0', [0.75, 0.4, 0.75], GP_NX[0], 0.2, gpNZ(k), 0), cube(b, '#c9d9f0', [0.75, 0.4, 0.75], GP_NX[1], 0.2, gpNZ(k), 0),
      cube(l1 < 0 ? 0 : 'N' + l1, '#f2d9a0', [0.95, 0.4, 0.75], GP_NX[2], 0.2, gpNZ(k), 0), cube(l2 < 0 ? 0 : 'N' + l2, '#f2d9a0', [0.95, 0.4, 0.75], GP_NX[3], 0.2, gpNZ(k), 0)]);
  }
  tag('v1', 'idx', GP_NX[0], 0, gpNZ(0) - 0.7); tag('v2', 'idx', GP_NX[1], 0, gpNZ(0) - 0.7); tag('link1', 'idx', GP_NX[2], 0, gpNZ(0) - 0.7); tag('link2', 'idx', GP_NX[3], 0, gpNZ(0) - 0.7);
  const G = gpGraph(gpK4(4.8, -0.6, 1.4), GP_K4E, { size: [0.55, 0.45, 0.55], gap: 0.35 });
  const H = [];
  for (let v = 0; v < 4; v++) H.push(cube(v, GPC.head, [0.6, 0.45, 0.6], -5.4, 0.25, -1.8 + v * 1.2, 0));
  tag('head', 'idx', -5.4, 0, -2.6);
  const clear = () => { for (const r of R) r.forEach((c) => glow(c, null)); for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e); for (let v = 0; v < 4; v++) { glow(H[v], null); glow(G.V[v], null); } };
  return { R, G, H, clear };
}

// 17:07 adjacency multilist（K4）：沿 pointer 走出 vertex 0 與 vertex 1 的串列
FRAG.push(['graphpeng-multilist', 'Multilist：沿 pointer 走', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const { R, G, H, clear } = gpMultiTable();
  const arrows = [];
  const hop = (fromK, toK, side) => arrows.push(gpArrow(V3(GP_NX[2 + side], 0.45, gpNZ(fromK) + 0.25), V3(GP_NX[0] - 0.45, 0.45, gpNZ(toK) - 0.1), 0x8a6400));
  const edge = (k, c) => { const [a, b] = GP_N[k]; gpPaint(G.E[a + '-' + b], c); glow(R[k][0], GOLD); glow(R[k][1], GOLD); };
  await step(tok);                                   // 17:07 the last two fields are pointers
  for (const r of R) { glow(r[2], '#8a6400'); glow(r[3], '#8a6400'); }
  say('後面兩個欄位是 pointer', 'link1 跟第一個端點有關，link2 跟第二個端點有關');
  await step(tok);                                   // 17:16 N0: link1 = N1 (about vertex 0)
  for (const r of R) { glow(r[2], null); glow(r[3], null); }
  edge(0, GPC.hot); glow(R[0][2], RED); glow(H[0], GOLD); glow(G.V[0], GOLD);
  arrows.push(gpArrow(V3(-5.0, 0.45, -1.8), V3(GP_NX[0] - 0.45, 0.45, gpNZ(0)), 0x8a6400));
  say('N0 = (0,1)：link1 是 N1（紅字）', '紅字 = 跟 0 有關');
  await step(tok);                                   // 17:24 the next edge touching 0 is stored in N1
  hop(0, 1, 0);
  say('除了 (0,1)，下一條跟 0 有關的邊', '存在 N1 這個 node');
  await step(tok);                                   // 17:41 N1 is edge (0,2)
  edge(1, GPC.hot);
  say('N1 是 edge (0,2)', '起點 0、終點 2');
  await step(tok);                                   // 18:03 N1's link1 = N2: still more
  glow(R[1][2], RED); hop(1, 2, 0);
  say('N1 的 link1 = N2', '跟 0 有關的還有 N2');
  await step(tok);                                   // 18:17 N2 is edge (0,3)
  edge(2, GPC.hot);
  say('N2 是 edge (0,3)');
  await step(tok);                                   // 18:28 the last red field is 0 = null
  glow(R[2][2], RED);
  tag('0 = null', 'bad', GP_NX[2], 0.9, gpNZ(2));
  say('N2 的 link1 是 0 → null', '跟 0 有關的邊到此結束');
  await step(tok);                                   // 18:49 vertex 0's list: N0 → N1 → N2
  tag('vertex 0：N0 → N1 → N2', 'good', -5.4, 1.2, -3.2);
  say('以 vertex 0 出發，構成一條 linked list', 'N0 → N1 → N2');
  await step(tok);                                   // 19:02 the same neighbours as the adjacency list of 0
  say('就是 adjacency list 裡 0 的鄰居', '(0,1)、(0,2)、(0,3) → 1、2、3');
  await step(tok);                                   // 19:44 N0's blue field: the edge after it for vertex 1 is N3
  clear(); arrows.forEach(kill); arrows.length = 0;
  edge(0, GPC.ok); glow(R[0][3], '#1a4a8a'); glow(H[1], GOLD); glow(G.V[1], GOLD);
  arrows.push(gpArrow(V3(-5.0, 0.45, -0.6), V3(GP_NX[0] - 0.45, 0.45, gpNZ(0)), 0x1a4a8a));
  say('N0 的藍色數字（link2）', '跟 1 有關的下一條邊：N3');
  await step(tok);                                   // 19:55 go to N3: (1,2)
  hop(0, 3, 1); edge(3, GPC.ok);
  say('到 N3：edge (1,2)', '以 1 為起點，2 是另一端');
  await step(tok);                                   // 20:07 the next node about 1 is N4
  glow(R[3][2], '#1a4a8a'); hop(3, 4, 0);
  say('跟 1 有關的下一個 node 在 N4');
  await step(tok);                                   // 20:21 N4 = (1,3)
  edge(4, GPC.ok);
  say('N4：起點 1、終點 3', 'edge (1,3)');
  await step(tok);                                   // 20:34 then null: no more edges for 1
  glow(R[4][2], RED);
  tag('vertex 1：N0 → N3 → N4', 'good', -5.4, 1.2, 3.0);
  say('N4 之後是 null', '跟 1 有連線的 edge 就沒有了');
  await step(tok);                                   // 20:45 every node: two endpoints, two pointers
  clear(); arrows.forEach(kill);
  for (const r of R) { glow(r[0], GOLD); glow(r[1], GOLD); glow(r[2], RED); glow(r[3], '#1a4a8a'); }
  say('每個 node：左右兩個頂點＋兩個 pointer', 'link1 串左邊頂點的邊，link2 串右邊頂點的邊');
}]);

// 21:21 multilist 的 node 數 = e；畫法；四種表示法總結
FRAG.push(['graphpeng-multilist-sum', 'Multilist 總結與四種表示法', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const { R, G } = gpMultiTable();
  await step(tok);                                   // 21:21 number of nodes = number of edges
  for (let k = 0; k < 6; k++) { glow(R[k][0], GOLD); glow(R[k][1], GOLD); await anim(tok, 150, () => {}); }
  tag('6 個 node', 'ptr alt', -1.0, 1.0, 3.6);
  say('multilist 的 node 個數 = graph 的 edge 個數');
  await step(tok);                                   // 21:39 = number of edges in the graph
  for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.hot);
  tag('= 6 條邊', 'ptr alt', 4.8, 1.0, 1.6);
  say('node 數 = e（graph 的邊數）');
  await step(tok);                                   // 21:50 how to draw it: count the edges first
  for (const r of R) { glow(r[0], null); glow(r[1], null); }
  tag('畫法 1：先數有幾條邊', 'note', 4.8, 1.4, -3.2);
  say('要畫出來：先看 graph 有幾條邊');
  await step(tok);                                   // 21:56 number each edge
  GP_K4E.forEach(([u, v], k) => { const m = gpMid(G.V[u], G.V[v], 0.2); tag('N' + k, 'idx', m.x, 0.5, m.z); });
  say('每條邊給它編號', '以 0 開頭的、以 1 開頭的、以 2 開頭的');
  await step(tok);                                   // 22:24 then fill in the two pointers
  for (const r of R) { glow(r[2], '#8a6400'); glow(r[3], '#8a6400'); }
  tag('畫法 2：填上兩個 pointer', 'note', 4.8, 1.4, -2.5);
  say('編號完，再把每個 node 的兩個 pointer 填上去');
  await step(tok);                                   // 22:49 before: a node belonged to just one list
  for (const r of R) { glow(r[2], null); glow(r[3], null); }
  say('第四章的 linked list：一個 node 只屬於一條 list');
  await step(tok);                                   // 23:04 here a node has two pointers → two lists
  glow(R[0][2], RED); glow(R[0][3], '#1a4a8a'); glow(R[0][0], GOLD); glow(R[0][1], GOLD);
  tag('N0 同時在 0 的串列、1 的串列', 'good', -1.0, 1.2, -3.4);
  say('這裡一個 node 有兩個 pointer', '同時屬於兩條 list → multi-linked list');
  await step(tok);                                   // 23:24 adjacency list vs adjacency multilist
  tag('adjacency list ≠ adjacency multilist', 'bad', 0, 1.8, 3.6);
  say('名字只差一點，意思完全不一樣');
  await step(tok);                                   // 23:47 one starts from vertices, the other from edges
  say('adjacency list 以頂點為出發點', 'multilist 以邊為出發點');
  await step(tok);                                   // 24:00 summary: four representations
  tag('① 2D matrix　② adjacency list　③ sequential array　④ multilist', 'say', 0, 2.4, -3.8);
  say('總結：graph 有四種表示方法');
  await step(tok);                                   // 24:17 each has pros and cons
  say('四種表示法各有優缺點', '回去想一想各自的優缺點');
}]);

// 24:24 weighted edge → network；road network：路口 = vertex，路段 = edge（數字為示意）
FRAG.push(['graphpeng-network', 'Network：有權重的 graph', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const pos = { S: [-5.4, 0], A: [-2.2, -2.2], B: [-2.2, 2.2], C: [1.4, 0], D: [4.8, 0] };
  const W = [['S', 'A', 4], ['S', 'B', 2], ['B', 'A', 1], ['A', 'C', 3], ['B', 'C', 6], ['C', 'D', 2]];
  const V = {}, E = {}, Lb = {};
  for (const n of Object.keys(pos)) V[n] = gpV(n, pos[n][0], pos[n][1], GPC.v, 0);
  for (const [u, v] of W) E[u + v] = gpE(V[u], V[v]);
  await step(tok);                                   // 24:24 an edge can carry a weight
  say('edge 可以給它一個 weight（權重）');
  await step(tok);                                   // 24:38 so far: 1 if connected, 0 if not
  for (const [u, v] of W) { const m = gpMid(V[u], V[v], 0.45); Lb[u + v] = tag('1', 'ptr alt', m.x, 0.5, m.z); }
  say('前面的 graph：有連線就是 1，沒有就是 0');
  await step(tok);                                   // 24:49 the weight can be a cost
  for (const k in Lb) txt(Lb[k], 'cost');
  say('weight 可以是從這點到那點花的 cost');
  await step(tok);                                   // 24:59 or a distance
  for (const k in Lb) txt(Lb[k], '距離');
  say('也可以是兩點之間的距離');
  await step(tok);                                   // 25:15 a graph with weighted edges = a network
  tag('weighted edge 的 graph = network', 'good', 0, 1.6, -3.4);
  say('edge 有 weight 的 graph，統稱 network');
  await step(tok);                                   // 25:21 not a computer network
  tag('≠ 電腦網路（Wi-Fi）', 'bad', 0, 1.0, -3.4);
  say('這個 network 不是電腦網路的 network');
  await step(tok);                                   // 25:53 a road network is a graph
  zone('新竹市的道路', -0.3, 0, 0, 11.6, 6.2, '#e7e1d4');
  say('道路構成的 road network，其實也是一個 graph');
  await step(tok);                                   // 26:32 vertex = intersection
  for (const n of Object.keys(V)) tint(V[n], GPC.land);
  tag('vertex = 交叉路口（intersection）', 'ptr', -5.4, 0.4, 1.2);
  say('road network 的頂點：交叉路口');
  await step(tok);                                   // 26:53 a road is cut into segments = edges
  for (const k in E) gpPaint(E[k], GPC.hot);
  tag('edge = 路段（road segment）', 'ptr alt', 3.1, 0.4, 1.2);
  say('一條路被路口切成很多 segment', '每一段 = 一條 edge');
  await step(tok);                                   // 27:41 two-way roads → directed graph
  kill(E.SA);
  const e1 = gpE(V.S, V.A, { dir: true, off: 0.18, color: GPC.hot }), e2 = gpE(V.A, V.S, { dir: true, off: 0.18, color: GPC.hot });
  const c = await gpWalk(tok, '車', V.S, V.A, 600); txt(c, '車'); await travel(tok, c, c.position.clone(), V3(-5.4, 1.1, 0), 600); remove(c);
  say('道路有單行道、也有雙向道', 'road network 是 directed graph：雙向道 = 兩條反向的邊');
  await step(tok);                                   // 28:03 the cost of a segment = its real distance
  for (const [u, v, w] of W) txt(Lb[u + v], w + ' km');
  say('路段的 cost = 實際的距離（physical distance）', '數字為示意');
  await step(tok);                                   // 28:22 from a source to a destination
  tag('source', 'good', -5.4, 1.1, -0.8); tag('destination', 'good', 4.8, 1.1, -0.8);
  say('給一個 source S、一個 destination D');
  await step(tok);                                   // 28:41 the set of segments with the least total → shortest path
  const best = ['S', 'B', 'A', 'C', 'D'];
  for (const k in E) gpPaint(E[k], GPC.e);
  gpPaint(e1, GPC.e); gpPaint(e2, GPC.e);
  const car = tag('車', 'pkt', -5.4, 1.1, 0);
  for (let k = 1; k < best.length; k++) {
    const q = gpP(V[best[k]]);
    await travel(tok, car, car.position.clone(), V3(q.x, 1.1, q.z), 420);
    tint(V[best[k]], GPC.ok);
    if (E[best[k - 1] + best[k]]) gpPaint(E[best[k - 1] + best[k]], GPC.ok);
  }
  tint(V.S, GPC.ok);
  say('找一組路段：從 S 到 D、距離總和最小', 'S→B→A→C→D = 2 + 1 + 3 + 2 = 8 → shortest path');
}]);

// Horowitz 課本範例（8 點）：0-1 0-2 1-3 1-4 2-5 2-6 3-7 4-7 5-7 6-7
const GP_BX = [[0, -2.9], [-1.9, -1.4], [1.9, -1.4], [-2.9, 0.4], [-0.95, 0.4], [0.95, 0.4], [2.9, 0.4], [0, 2.2]];
const GP_BE = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7]];
const gpBook = (cx, sx = 0.62, sz = 0.75) => { const p = {}; GP_BX.forEach(([x, z], i) => { p[i] = [cx + x * sx, z * sz]; }); return gpGraph(p, GP_BE, { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 }); };
const gpBookAdj = () => { const A = {}; for (let i = 0; i < 8; i++) A[i] = []; for (const [u, v] of GP_BE) { A[u].push(v); A[v].push(u); } for (const k in A) A[k].sort((a, b) => a - b); return A; };

// 29:15 DFS：追蹤課本範例（adjacency list ＋ visited 陣列）
FRAG.push(['graphpeng-dfs-book', 'DFS：沿 adjacency list 走（課本範例）', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.4]);
  const G = gpBook(-3.9, 0.66, 0.8);
  const A = gpBookAdj();
  const RZ = (i) => -2.9 + i * 0.78, RX = (k) => 1.2 + k * 0.78;
  const vis = [], out = [];
  const visit = (v) => { tint(G.V[v], GPC.ok); relabel(vis[v], 1); tint(vis[v], GPC.ok); out.push(v); };
  const cell = (u, w) => rows[u].nodes[A[u].indexOf(w)];
  let rows = [], outT = null, cur = null;
  await step(tok);                                   // 29:15 a tree has traversals
  tag('tree 有 traversal（pre-order、level order…）', 'say', -3.9, 1.6, -3.6);
  say('tree 有 traversal：走過整棵樹', '用來判別結構、複製、比較');
  await step(tok);                                   // 29:31 graph traversal: DFS and BFS
  say('graph 也有 traversal：DFS 和 BFS');
  await step(tok);                                   // 29:43 depth-first and breadth-first
  tag('DFS：深度優先　BFS：廣度優先', 'note', -3.9, 1.0, -3.6);
  say('DFS = 深度優先，BFS = 廣度優先');
  await step(tok);                                   // 29:53 DFS is like pre-order: go left as far as you can
  say('DFS 就像 tree 的 pre-order', '有 left 就一直往 left 走，走到不能走為止');
  await step(tok);                                   // 30:16 the graph stored as adjacency lists
  for (let i = 0; i < 8; i++) rows.push(await gpRow(tok, i, A[i], 0.42, RZ(i), 0.78, GPC.v, 0, [0.5, 0.4, 0.5]));
  for (let i = 0; i < 8; i++) { vis.push(cube(0, GPC.zero, [0.5, 0.35, 0.5], -6.4 + i * 0.62, 0.2, 3.4, 0)); tag(String(i), 'idx', -6.4 + i * 0.62, 0, 3.95); }
  tag('visited', 'idx', -6.4, 0.2, 2.8);
  say('假設 graph 用 adjacency list 表示');
  await step(tok);                                   // 30:34 the first unvisited vertex in the list → visit it, recursively
  tag('串列裡第一個沒拜訪過的 → 去拜訪（recursive）', 'note', 2.6, 1.6, 3.6);
  say('看串列：第一個沒被拜訪過的頂點就去拜訪', '然後 recursive 繼續');
  await step(tok);                                   // 30:57 start from 0
  visit(0); glow(G.V[0], GOLD); cur = G.V[0];
  outT = tag('輸出：0', 'ptr alt', -3.9, 1.4, -3.0);
  say('從 0 出發：拜訪 0、輸出 0');
  await step(tok);                                   // 31:08 0's list: first is 1 → go to 1
  glow(rows[0].head, GOLD); glow(cell(0, 1), GOLD);
  const w = await gpWalk(tok, '走', G.V[0], G.V[1], 450); remove(w);
  glow(cur, null); visit(1); glow(G.V[1], GOLD); cur = G.V[1]; txt(outT, '輸出：' + out.join(' '));
  say('0 的串列第一個是 1 → 走到 1');
  await step(tok);                                   // 31:32 1's list: 0 already visited → skip
  glow(rows[0].head, null); glow(cell(0, 1), null);
  glow(rows[1].head, GOLD); glow(cell(1, 0), RED);
  say('看 1 的串列：第一個是 0', '0 已經拜訪過 → 跳過');
  await step(tok);                                   // 32:00 next is 3, not visited → visit 3
  glow(cell(1, 3), GOLD);
  glow(cur, null); visit(3); glow(G.V[3], GOLD); cur = G.V[3]; txt(outT, '輸出：' + out.join(' '));
  say('第二個是 3，沒拜訪過 → 拜訪 3');
  await step(tok);                                   // 32:10 3's list: 1 already visited
  glow(rows[1].head, null); glow(cell(1, 0), null); glow(cell(1, 3), null);
  glow(rows[3].head, GOLD); glow(cell(3, 1), RED);
  say('3 的串列：1 已經拜訪過了');
  await step(tok);                                   // 32:20 jump to 7 → visit 7
  glow(cell(3, 7), GOLD);
  glow(cur, null); visit(7); glow(G.V[7], GOLD); cur = G.V[7]; txt(outT, '輸出：' + out.join(' '));
  say('跳到 7 → 拜訪 7');
  await step(tok);                                   // 32:30 7's list: 3 visited → visit 4
  glow(rows[3].head, null); glow(cell(3, 1), null); glow(cell(3, 7), null);
  glow(rows[7].head, GOLD); glow(cell(7, 3), RED); glow(cell(7, 4), GOLD);
  glow(cur, null); visit(4); glow(G.V[4], GOLD); cur = G.V[4]; txt(outT, '輸出：' + out.join(' '));
  say('7 的串列：3 拜訪過 → 下一個是 4，拜訪 4');
  await step(tok);                                   // 32:40 4's list: 1 and 7 both visited
  glow(rows[4].head, GOLD); glow(cell(4, 1), RED); glow(cell(4, 7), RED);
  say('4 的串列：1、7 都拜訪過了', '4 沒有路可走');
  await step(tok);                                   // 32:59 back to where it was called (7) → visit 5
  glow(rows[4].head, null); glow(cell(4, 1), null); glow(cell(4, 7), null);
  glow(cur, null); glow(G.V[7], GOLD);
  await anim(tok, 400, () => {});
  glow(cell(7, 5), GOLD);
  glow(G.V[7], null); visit(5); glow(G.V[5], GOLD); cur = G.V[5]; txt(outT, '輸出：' + out.join(' '));
  say('像 recursive 一樣回到呼叫它的地方（7）', '7 的下一個是 5 → 拜訪 5');
  await step(tok);                                   // 33:09 and so on → 2, 6
  for (const r of rows) { glow(r.head, null); r.nodes.forEach((m) => glow(m, null)); }
  for (const v of [2, 6]) { await anim(tok, 450, () => {}); glow(cur, null); visit(v); glow(G.V[v], GOLD); cur = G.V[v]; txt(outT, '輸出：' + out.join(' ')); }
  glow(cur, null);
  say('依此類推：5 → 2 → 6', 'DFS = ' + out.join(' '));
  await step(tok);                                   // 33:19 a Boolean array records visited
  for (const c of vis) glow(c, GOLD);
  say('要有一個 Boolean array', '記錄每個 vertex 有沒有被拜訪過');
  await step(tok);                                   // 33:39 visited → 1, not → 0
  for (const c of vis) glow(c, null);
  say('拜訪過 mark 成 1，沒有就是 0');
  await step(tok);                                   // 34:07 check the array; unvisited → visit
  tag('沒 visit 過 → 拜訪、輸出', 'note', -3.9, 1.4, 4.4);
  say('看串列裡的點，查 Boolean array', '沒 visit 過，就去拜訪它、把它 output');
  await step(tok);                                   // 34:24 until every vertex is visited
  say('直到所有點都被拜訪過為止', 'DFS 完成');
  await step(tok);                                   // 34:34 written as a recursive function
  code(['void dfs(int v) {', '  visited[v] = 1; output(v);', '  for (w in list[v])', '    if (!visited[w]) dfs(w);', '}'], 3.2, 2.6, 0.45, 4.2);
  say('DFS 可以寫成 recursive function', '不斷呼叫自己');
}]);

// 34:44 DFS 不唯一（list[0] = 1,2 vs 2,1）＋ complexity：list O(e)、matrix O(n²)
FRAG.push(['graphpeng-dfs-order-cost', 'DFS 不唯一與複雜度', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const L = gpBook(-3.6), Rg = gpBook(3.6);
  const adjOf = (first) => { const A = gpBookAdj(); A[0] = first; return A; };
  const dfsOrder = (A) => { const seen = new Set(), ord = [], tree = []; const go = (u) => { seen.add(u); ord.push(u); for (const w of A[u]) if (!seen.has(w)) { tree.push([u, w]); go(w); } }; go(0); return [ord, tree]; };
  const [o1, t1] = dfsOrder(adjOf([1, 2])), [o2, t2] = dfsOrder(adjOf([2, 1]));
  await step(tok);                                   // 34:44 is DFS unique?
  tag('DFS 唯一嗎？', 'note', 0, 1.6, -3.6);
  say('DFS 的結果會不會是唯一的？', '不一定');
  await step(tok);                                   // 35:00 different storage → different result
  say('存放的方法不一樣，出來的結果就不一樣');
  await step(tok);                                   // 35:08 list[0] may be 2, 1
  tag('list[0] = 1 → 2', 'ptr', -3.6, 0.3, 3.0); tag('list[0] = 2 → 1', 'ptr', 3.6, 0.3, 3.0);
  say('0 的串列可以寫 1、2，也可以寫 2、1');
  await step(tok);                                   // 35:12 no rule says small first → traversals differ
  const seq = [tag('', 'ptr alt', -3.6, 0.5, -3.0), tag('', 'ptr alt', 3.6, 0.5, -3.0)];
  for (let k = 0; k < 8; k++) {
    for (const [G, o, t, s] of [[L, o1, t1, seq[0]], [Rg, o2, t2, seq[1]]]) {
      const v = o[k]; tint(G.V[v], GPC.ok);
      if (k) { const [a, b] = t[k - 1]; gpPaint(G.E[gpEK(a, b)], GPC.hot); }
      txt(s, o.slice(0, k + 1).join(' '));
    }
    await anim(tok, 260, () => {});
  }
  say('adjacency list 沒規定小的排前面', '左：' + o1.join(' ') + '　右：' + o2.join(' '));
  await step(tok);                                   // 35:20 DFS is a pre-order
  say('統稱來看：DFS 就是對 graph 做 pre-order');
  await step(tok);                                   // 35:53 unvisited → output
  say('從 v 的 adjacency list 看起', '沒拜訪過的就 output 出來');
  await step(tok);                                   // 35:58 recursive; the complexity depends on the edges
  say('recursive 地做下去', '所以 complexity 跟 edge 有關');
  await step(tok);                                   // 36:09 adjacency list → O(e)
  for (const G of [L, Rg]) for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.hot);
  tag('adjacency list：O(e)', 'good', -3.6, 1.2, 3.8);
  say('用 adjacency list：要 traverse 所有的邊', 'complexity = O(e)');
  await step(tok);                                   // 36:29 adjacency matrix…
  say('如果 graph 表示成 adjacency matrix 呢？');
  await step(tok);                                   // 36:36 → O(n²)
  tag('adjacency matrix：O(n²)', 'bad', 3.6, 1.2, 3.8);
  say('adjacency matrix：O(n²)', '每個點都要掃一整列 n 格（留給同學證明）');
}]);

// 37:17 BFS：A 的鄰居 B、D、E；B、D、E 都連到 C → A B D E C
FRAG.push(['graphpeng-bfs-abcde', 'BFS：A B D E C', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const pos = { A: [-4.0, -2.4], B: [-5.8, -0.2], D: [-4.0, -0.2], E: [-2.2, -0.2], C: [-4.0, 2.2] };
  const G = gpGraph(pos, [['A', 'B'], ['A', 'D'], ['A', 'E'], ['B', 'C'], ['D', 'C'], ['E', 'C']], { dropH: 3 });
  const QX = (k) => 1.3 + k * 1.1;
  const Q = [];
  let out = 0;
  const outCube = (n) => { cube(n, GPC.ok, [0.7, 0.5, 0.7], QX(out), 0.25, 2.4, 3); out++; tint(G.V[n], GPC.ok); glow(G.V[n], null); };
  const qShow = () => Q.forEach((q, k) => move(q.m, QX(k), 0.25, -1.0));
  const enq = (n) => { Q.push({ n, m: cube(n, GPC.v, [0.7, 0.5, 0.7], QX(Q.length), 0.25, -1.0, 3) }); glow(G.V[n], GOLD); };
  const deq = () => { const q = Q.shift(); fly(q.m); qShow(); return q.n; };
  await step(tok);                                   // 37:17 BFS = level order of a tree
  say('BFS 對應 tree 的 level order traversal', '一層一層');
  await step(tok);                                   // 37:34 it uses a queue
  tag('queue', 'ptr', 0.0, 0.3, -1.0); tag('輸出', 'ptr', 0.0, 0.3, 2.4);
  say('level order 用 queue，BFS 也一樣用 queue');
  await step(tok);                                   // 37:55 layers: A | B D E | C
  const lv = [tag('第 1 層', 'note', -7.0, 0.6, -2.4), tag('第 2 層', 'note', -7.0, 0.6, -0.2), tag('第 3 層', 'note', -7.0, 0.6, 2.2)];
  say('第一層 A，第二層 B D E，第三層 C');
  await step(tok);                                   // 38:08 output each layer left to right → A B D E C
  say('每一層由左到右輸出', 'BFS = A B D E C');
  await step(tok);                                   // 38:26 programming it: output A
  lv.forEach(remove);
  outCube('A');
  say('寫程式：先輸出 A');
  await step(tok);                                   // 38:35 A's neighbours B, D, E go into the queue
  for (const w of ['B', 'D', 'E']) { gpPaint(G.E['A-' + w], GPC.hot); enq(w); await anim(tok, 300, () => {}); }
  say('A 跟 B、D、E 相連 → 放進 queue', 'queue：B D E');
  await step(tok);                                   // 38:44 queue not empty: take out B
  outCube(deq());
  say('queue 不是空的：取出第一個 B，輸出', 'queue：D E');
  await step(tok);                                   // 38:54 B–C → C is inserted
  gpPaint(G.E['B-C'], GPC.hot); enq('C');
  say('B 跟 C 相連 → C 放進 queue', 'queue：D E C');
  await step(tok);                                   // 39:16 the queue holds D, E, C
  say('現在 queue 裡有 D、E、C 三個 element');
  await step(tok);                                   // 39:24 take out D
  outCube(deq());
  say('第一個是 D → 取出、輸出', 'queue：E C');
  await step(tok);                                   // 39:30 D–C, but C is already in the queue
  gpPaint(G.E['D-C'], GPC.red);
  tag('C 已在 queue', 'bad', -3.0, 1.0, 1.2);
  say('D 跟 C 相連，但 C 已經在 queue 裡', '不用再放');
  await step(tok);                                   // 39:46 take out E; C already queued
  outCube(deq()); gpPaint(G.E['E-C'], GPC.red);
  say('取出 E，輸出；E 連到 C，C 也已在 queue', 'queue：C');
  await step(tok);                                   // 39:56 finally take out C — BFS done
  outCube(deq());
  say('最後取出 C → BFS 完成', 'A B D E C');
}]);

// 40:07 總結 DFS／BFS 的寫法，並用來找 connected component（課本 Program 6.3，G4）
FRAG.push(['graphpeng-cc-program', 'DFS／BFS 的寫法與 connected component', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.6]);
  await step(tok);                                   // 40:07 DFS = pre-order, recursive
  tag('DFS = pre-order：串列裡沒拜訪的就去拜訪', 'say', 0, 1.8, -3.6);
  say('總結：DFS 就是 pre-order', '會用到 recursive');
  await step(tok);                                   // 40:33 two ways to write DFS: recursion or a stack
  const p1 = prop('file', -4.0, 0, -1.6, 0.9, '寫法 1：recursive code'); bob(p1, 0.05);
  const s = [0, 1, 2].map((k) => cube('', '#9b7ef4', [0.9, 0.25, 0.9], -0.6, 0.15 + k * 0.3, -1.6, 2));
  tag('寫法 2：自己用 stack', 'say', -0.6, 1.4, -1.6);
  say('DFS 有兩種寫法', 'recursive，或自己用 stack 實作');
  await step(tok);                                   // 40:46 BFS just needs a queue
  [0, 1, 2].forEach((k) => cube('', '#4b9ee2', [0.7, 0.4, 0.7], 2.6 + k * 0.8, 0.2, -1.6, 2));
  tag('BFS：用 queue', 'say', 3.4, 1.0, -1.6);
  say('BFS 用 queue 就能完成');
  await step(tok);                                   // 41:14 they can find connected components
  for (const m of s) kill(m);
  const pos = { 0: [-4.6, 0.6], 1: [-5.9, 1.8], 2: [-3.3, 1.8], 3: [-4.6, 3.0], 4: [-1.6, 1.8], 5: [0.2, 1.8], 6: [2.0, 1.8], 7: [3.8, 1.8] };
  const G = gpGraph(pos, [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [5, 6], [6, 7]], { dropH: 3, size: [0.6, 0.45, 0.6], gap: 0.38 });
  tag('G4', 'ptr', -1.0, 0.3, 3.4);
  say('BFS、DFS 可以做很多事', '例如找出 graph 的 connected component');
  await step(tok);                                   // 41:18 Program 6.3: for each unvisited i → dfs(i)
  const cnt = tag('count = 1', 'ptr alt', 5.4, 1.0, 3.0);
  code(['for (i = 0; i < n; i++)', '  if (!visited[i]) { dfs(i); count++; }'], 2.6, 1.6, 0.45, 3.6);
  for (const v of [0, 1, 3, 2]) { tint(G.V[v], GPC.v); glow(G.V[v], GOLD); await anim(tok, 280, () => {}); glow(G.V[v], null); }
  say('Program 6.3：i = 0 沒拜訪 → dfs(0)', '走完 H1 = {0,1,2,3}');
  await step(tok);                                   // 41:26 i = 4 → dfs(4): the second component
  txt(cnt, 'count = 2');
  for (const v of [4, 5, 6, 7]) { tint(G.V[v], GPC.pink); glow(G.V[v], GOLD); await anim(tok, 280, () => {}); glow(G.V[v], null); }
  say('i = 1、2、3 已拜訪，跳過；i = 4 → dfs(4)', '呼叫 dfs 2 次 → 2 個 connected component');
  await step(tok);                                   // 41:39 go trace the code
  tag('回去一定要 trace code！', 'note', 0, 1.8, 4.4);
  say('回去一定要 trace code', '花點時間一步一步追程式');
}]);
  }
  // ═══ qa-ds7.js（地圖就是 graph） ═══
  {
const { V3, fresh, tag, cube, kill, glow, line, arrow, step, GOLD, GREEN } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
FRAG.push(['qa-map-graph', '地圖就是 graph：POI 與不完整的圖資', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.3]);
  const N = { A: [-4.8, 0.6], B: [-2.6, -1.8], C: [-1.0, 1.4], D: [1.2, -1.6], E: [2.4, 1.6], F: [4.6, -0.4] };
  const R = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'F'], ['E', 'F']];
  cube('', '#efe6d2', [12, 0.06, 6.4], 0, -0.05, 0);
  const V = {};
  await step(tok);                                   // 地圖是 graph G = (V, E)
  for (const [k, [x, z]] of Object.entries(N)) V[k] = cube(k, '#4b9ee2', [0.5, 0.35, 0.5], x, 0.18, z, 1.5);
  const roads = R.map(([a, b]) => line(N[a][0], 0.05, N[b][0], 0.05, 0, '#8a7a60'));
  roads.forEach((l, i) => { const [a, b] = R[i]; l.geometry.setFromPoints([V3(N[a][0], 0.06, N[a][1]), V3(N[b][0], 0.06, N[b][1])]); });
  tag('G = (V, E)：V = 地點、路口　E = 道路', 'note', 0, 0.3, -3.0);
  say('地圖其實就是一個 graph', 'G = (V, E)：點是地點、邊是道路');
  await step(tok);                                   // POI
  for (const [k, t] of [['C', '交大'], ['E', '鬆餅店']]) { glow(V[k], GOLD); tag(t, 'ptr', N[k][0], 0.8, N[k][1]); }
  const poi = tag('POI（Point of Interest）：景點、餐廳…', 'idx', 0, 0.3, 3.0);
  say('POI = Point of Interest', '景點、餐廳、地標，都是地圖上的點');
  await step(tok);                                   // 圖資不完整 → shortest path 不一定最短
  for (const k of ['A', 'C', 'E', 'F']) glow(V[k], GREEN);
  [1, 3, 5].forEach((i) => { roads[i].material.color.set('#0f5a3a'); });
  const miss = line(0, 0.06, 0, 0.06, 0, '#d64545'); miss.geometry.setFromPoints([V3(N.A[0], 0.07, N.A[1]), V3(N.F[0], 0.07, N.F[1])]);
  bad('真正的近路沒在圖資裡', 0, 0.4, -0.4);
  kill(poi); good('演算法找到的「最短」：A → C → E → F', 0, 0.3, 3.0);
  say('圖資不完整時，找到的 shortest path', '不一定真的最短；不是演算法爛，是圖資不夠完整');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 7 章',
    title: '圖（基礎）：表示法、DFS、BFS',
    color: 'var(--ds)',
    modes: [
      { id: 'rep', name: '表示法', enter: () => { rep.letters = false; enterRep(); } },
      { id: 'trav', name: 'DFS／BFS', enter: () => enterTrav(false) },
      { id: 'comp', name: '連通元件', enter: () => enterComp(true) },
      { id: 'span', name: '生成樹', enter: () => enterSpan(false) },
    ],
    pages: [
      { id: 'cmp', name: '表示法比較', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['graph-representations', 'directed-matrix', 'incidence-matrix', 'space-sparse-dense', 'dfs-stack', 'bfs-queue', 'connected-components', 'spanning-tree'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
