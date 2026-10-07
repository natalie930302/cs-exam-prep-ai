// 資料結構 第7章：圖（基礎）— 表示法（Adjacency List / Adjacency Matrix / Incidence Matrix）、DFS、BFS、連通元件、生成樹。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 慣例（洪逸／Horowitz）：頂點編號 0..V−1；無向邊寫 (u,v)、有向邊寫 ⟨u,v⟩；簡單圖（無自迴圈、無重複邊）。
// 鄰接串列一律依頂點編號由小到大排列（考題沒指定順序時的常見假設），所以 DFS／BFS 順序是唯一的。
// DFS 用課本的遞迴版（畫面上的 stack = 遞迴呼叫堆疊）；BFS 在 enqueue 時就標記 visited（課本 bfs()）。
// 表示法場景沿用影片〈Graph Data Structure Intro〉的例子：A–B、B–C；有向圖 B→A、C→A；Incidence Matrix 有向時離開 −1、進入 +1。
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
  const RC = 0.56;
  const vn = (i) => (rep.letters ? 'ABCDEF'[i] : String(i));
  const rowZ = (i) => (i - (rep.V - 1) / 2) * RC + 0.3;
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
    lab.frameCamera([0, 9.5, 8.6], [0, 0, 0.4]);
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
        const m = lab.box(val === 1 ? COL.one : val === -1 ? COL.neg : (!inc && i === j) ? COL.diag : COL.zero, [cw - 0.06, 0.1, 0.5]);
        const p = cellAt(i, j);
        if (val) { m.scale.y = 3; p.y = 0.15; }
        m.position.copy(p);
        const l = lab.label(val === -1 ? '−1' : String(val), 'idx'); l.position.set(0, 0.12, 0); m.add(l);
        const isHot = hl && (inc ? j === rep.order.length - 1 && val !== 0
          : (i === hl[0] && j === hl[1]) || (!rep.directed && i === hl[1] && j === hl[0]));
        if (isHot) glow(m, '#6a4a00');
        g.add(m); rep.cells[i].push(m);
      }
      const rl = lab.label(vn(i), 'idx'); rl.position.copy(cellAt(i, 0)).add(V3(-0.5, 0, 0)); g.add(rl);
    }
    for (let j = 0; j < cols; j++) {
      const cl = lab.label(inc ? 'e' + (j + 1) : vn(j), 'idx'); cl.position.copy(cellAt(0, j)).add(V3(0, 0, -0.5)); g.add(cl);
    }
    rep.sideTitle.element.textContent = inc ? 'Incidence Matrix' : 'Adjacency Matrix';
    rep.sideTitle.position.copy(cellAt(0, Math.max(0, (cols - 1) / 2))).add(V3(0, 0, -0.95));
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
      + '<select id="tGraph"><option value="book">課本範例圖</option><option value="rand">隨機連通圖</option></select>'
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
      '<select id="sG"><option value="book">課本範例圖</option><option value="rand">隨機連通圖</option></select>'
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
    sceneOrder: ['graph-representations', 'directed-matrix', 'incidence-matrix', 'space-sparse-dense', 'dfs-stack', 'bfs-queue', 'connected-components', 'spanning-tree'],
    stop() { stopTimer(); },
  };
}
