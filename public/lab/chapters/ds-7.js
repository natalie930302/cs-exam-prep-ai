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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ grapha.js ═══
  {
const { V3, fresh, tag, cube, glow, relabel, code, arrow, GOLD } = K;
// ─── DBRW8nwZV-g：Graph Data Structure Intro（表示法） ───
const GV = '#4b9ee2', GP = '#9b7ef4', GO = '#dd8238';
function gaV(name, x, z, color) { return cube(name, color || GV, [0.9, 0.7, 0.9], x, 0.35, z, 3); }
function gaLine(a, b) {
  const l = new ctx.THREE.Line(new ctx.THREE.BufferGeometry().setFromPoints([V3(a.position.x, 0.35, a.position.z), V3(b.position.x, 0.35, b.position.z)]), new ctx.THREE.LineBasicMaterial({ color: '#9c8b70' }));
  ctx.lab.world.add(l); return l;
}
// directed edge: arrow from a to b, stopping short of b's cube
function gaArc(a, b, color = 0x9c8b70) {
  const p = V3(a.position.x, 0.35, a.position.z), q = V3(b.position.x, 0.35, b.position.z);
  const d = q.clone().sub(p).normalize();
  return arrow(p.clone().addScaledVector(d, 0.55), q.clone().addScaledVector(d, -0.6), color);
}

// 00:05 graph = nodes + edges；undirected vs directed
FRAG.push(['grapha-types', 'Graph：node、edge，有向與無向', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.4, 0]);
  const you = gaV('你', -4.4, 1.6, GV), a = gaV('小明', -2.0, -1.4, GV), b = gaV('小華', -5.6, -1.8, GV);
  say('graph：一群東西＋它們之間的關係', '不是數學課畫的函數圖');
  await beat(tok, 2800);
  tag('node / vertex', 'ptr', -3.8, 1.6, -3.2);
  say('資料叫 node（vertex）', '連線叫 edge');
  await beat(tok, 2000);
  for (const [p, q] of [[you, a], [you, b], [a, b]]) { gaLine(p, q); await beat(tok, 500); }
  tag('edge', 'ptr alt', -3.2, 0.9, 0.2);
  say('社群網路：node = 人，edge = 朋友', '朋友是雙向的 → undirected');
  await beat(tok, 3000);
  tag('undirected', 'ptr', -3.8, 0, 3.4);
  const p1 = gaV('網頁1', 2.4, 1.6, GO), p2 = gaV('網頁2', 5.4, 1.2, GO), p3 = gaV('網頁3', 4.0, -2.0, GO);
  say('directed：edge 有方向', '例：網頁與超連結');
  await beat(tok, 2200);
  for (const [p, q] of [[p1, p2], [p1, p3], [p3, p2]]) { gaArc(p, q); await beat(tok, 700); }
  tag('directed', 'ptr', 4.0, 0, 3.4);
  glow(p1, GOLD); glow(p2, GOLD);
  say('網頁1 連到網頁2，網頁2 不一定連回來', '⟨網頁1, 網頁2⟩ ≠ ⟨網頁2, 網頁1⟩');
  await beat(tok, 3200);
}]);

// 01:04 adjacency list：A–B、B–C → JS 物件 → 編號陣列
FRAG.push(['grapha-adjlist', 'Adjacency List：A–B、B–C', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.8, -0.4]);
  const A = gaV('A', -5.4, -1.6), B = gaV('B', -3.6, 0.6), C = gaV('C', -5.4, 2.6);
  gaLine(A, B); gaLine(B, C);
  say('第一種表示法：adjacency list', '每個 vertex 記住它的鄰居');
  await beat(tok, 2600);
  const rows = [['A', ['B']], ['B', ['A', 'C']], ['C', ['B']]];
  const idx = { A: 0, B: 1, C: 2 };
  const heads = [], cells = [];
  for (let r = 0; r < rows.length; r++) {
    const [h, nb] = rows[r], z = -1.6 + r * 2.1;
    heads.push(cube(h, GP, [0.9, 0.7, 0.9], -1.2, 0.35, z, 3));
    glow([A, B, C][r], GOLD);
    nb.forEach((n, k) => {
      arrow(V3(-0.7 + k * 1.6, 0.4, z), V3(0.05 + k * 1.6, 0.4, z));
      cells.push([cube(n, GV, [0.9, 0.7, 0.9], 0.6 + k * 1.6, 0.35, z, 3), n]);
    });
    say(h + ' 的鄰居：' + nb.join('、'), h + ' → ' + nb.join(', '));
    await beat(tok, 2200);
    glow([A, B, C][r], null);
  }
  const js = code(['var undirectedG = {', "  A: ['B'],", "  B: ['A', 'C'],", "  C: ['B']", '};'], 4.6, 1.2, 0.5, -1.2);
  say('用 JavaScript 物件寫出來', 'key = 頂點，value = 鄰居陣列');
  await beat(tok, 2800);
  say('undirected：A 有 B，B 也有 A', '看不出方向 → 無向圖');
  await beat(tok, 2400);
  js.kill();
  code(['var undirectedGArr = [', '  [1],', '  [0, 2],', '  [1]', '];'], 4.6, 1.2, 0.5, -1.2);
  heads.forEach((h, r) => relabel(h, r));
  cells.forEach(([c, n]) => relabel(c, idx[n]));
  relabel(A, 0); relabel(B, 1); relabel(C, 2);
  say('node 改用編號：更簡單的陣列', 'A = 0、B = 1、C = 2');
  await beat(tok, 3200);
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
  say('目前都是 unweighted', '有邊 = 1、沒邊 = 0');
  await beat(tok, 3800);
  tag('4', 'ptr alt', -4.3, 0.9, -0.6); tag('2', 'ptr alt', -4.3, 0.9, 1.4);
  say('邊可以帶權重（weight）', '權重依應用而定，例如距離（數字為示意）');
  await beat(tok, 3400);
  for (const [i, j, w] of [[0, 1, 4], [1, 0, 4], [1, 2, 2], [2, 1, 2]]) { relabel(cells[i][j], w); glow(cells[i][j], GOLD); }
  say('矩陣裡改填權重', 'M[A][B] = M[B][A] = 4　M[B][C] = M[C][B] = 2');
  await beat(tok, 3200);
  for (const row of cells) for (const c of row) glow(c, null);
  say('不只 0／1：數字就是邊的權重', 'weighted graph');
  await beat(tok, 3000);
}]);
  }

  // ═══ graphbari.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, line, GOLD } = K;
// ─── pcKY4hjDrxk：Abdul Bari〈Graph Traversals - BFS & DFS〉 ───
// 老師的例子：小樹 1–{2,4,5}、2–{3,6,7}；binary tree 1..7；大圖 10 個頂點、13 條邊：
// 1-2 1-4 2-3 2-5 2-7 2-8 3-4 3-9 3-10 5-6 5-7 5-8 7-8（由逐字稿的鄰接關係重建）。
// 鄰居順序照老師口述（pref），其餘依編號小到大。圖畫在地板左半；右半是 queue／stack、結果列與直立的生成樹。
const GB_SMALL = { pos: { 1: [-3.6, -2.6], 2: [-5.6, -0.1], 4: [-3.6, -0.1], 5: [-1.6, -0.1], 3: [-6.5, 2.5], 6: [-5.4, 2.5], 7: [-4.3, 2.5] },
  edges: [[1, 2], [1, 4], [1, 5], [2, 3], [2, 6], [2, 7]] };
const GB_BIN = { pos: { 1: [-3.6, -2.6], 2: [-5.4, 0], 3: [-1.8, 0], 4: [-6.3, 2.6], 5: [-4.5, 2.6], 6: [-2.7, 2.6], 7: [-0.9, 2.6] },
  edges: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7]] };
const GB_BIG = { pos: { 1: [-5.2, -2.6], 4: [-2.8, -2.6], 2: [-5.2, 0.2], 3: [-2.8, 0.2], 10: [-0.8, -1.2], 9: [-0.8, 1.6], 7: [-5.2, 2.6], 5: [-6.6, 3.8], 8: [-3.8, 3.8], 6: [-5.2, 4.9] },
  edges: [[1, 2], [1, 4], [2, 3], [2, 5], [2, 7], [2, 8], [3, 4], [3, 9], [3, 10], [5, 6], [5, 7], [5, 8], [7, 8]] };
const GB_CAM = [0, 8.5, 11], GB_LOOK = [0, 1.6, 0.6], GB_TZ = -2.4, GB_DONE = '#1d8a68';

function gbGraph(spec) {
  const vs = {}, es = {}, adj = {};
  for (const k in spec.pos) { const [x, z] = spec.pos[k]; vs[k] = vertexMesh(k, V3(x, 0.3, z), COL.idle, [0.7, 0.6, 0.7]); adj[k] = []; }
  for (const [u, v] of spec.edges) { es[ek(u, v)] = edgeMesh(vs[u].position, vs[v].position, { gap: 0.42 }); adj[u].push(v); adj[v].push(u); }
  const G = { vs, es, adj, edges: spec.edges, cur: null };
  G.reset = () => { for (const k in vs) { tint(vs[k], COL.idle); glow(vs[k], null); } for (const k in es) paintEdge(es[k], COL.edge, false); G.cur = null; };
  return G;
}
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
  const ms = o.ms || 1000, bfs = o.kind === 'bfs', order = [], par = {}, all = [];
  ev.forEach((e) => { if (e.t === 'visit') { par[e.v] = e.p; all.push(e.v); } });
  const pos = o.tree ? gbLayout(all, par) : null;
  const res = gbRow(o.rowZ ?? 3.4, o.rowLabel || (bfs ? 'BFS 結果' : 'DFS 結果'));
  const box = o.contZ === null ? null : gbRow(o.contZ ?? 1.4, bfs ? 'queue（左邊是前端）' : 'stack（右邊是頂端）');
  const cont = [];
  const fm = () => (box ? (bfs ? 'queue：' : 'stack：') + (cont.join(' ') || '空') + '　' : '') + '結果：' + order.join(' ');
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k], m = G.vs[e.v];
    if (e.t === 'visit') {
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
      await beat(tok, ms);
    } else if (e.t === 'explore') {
      cont.shift(); if (box) box.shift();
      glow(m, GOLD);
      const none = ev[k + 1].t === 'done';
      say(none ? '探索 ' + e.v + '：沒有新的鄰居' : '取出 ' + e.v + '，開始探索', fm());
      await beat(tok, ms * (none ? 0.7 : 0.8));
    } else if (e.t === 'done') {
      glow(m, null); tint(m, GB_DONE);
      if (!bfs) {
        cont.pop(); if (box) box.pop();
        if (k === ev.length - 1) { G.cur = null; say(e.v + ' 探索完，全部結束', fm()); await beat(tok, ms * 0.8); }
      }
    } else if (e.t === 'back') {
      glow(m, GOLD); G.cur = m;
      say(e.from + ' 探索完 → 回到 ' + e.v, fm());
      await beat(tok, ms * 0.75);
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
  const G = gbGraph(GB_SMALL);
  say('BFS、DFS：兩種 graph traversal', '例子是一棵樹 —— tree 也是 graph');
  await beat(tok, 3000);
  tint(G.vs[1], COL.visit);
  tag('visit', 'ptr', -3.6, 1.3, -2.6);
  say('visit：走到一個頂點上', '拜訪 1');
  await beat(tok, 2600);
  glow(G.vs[1], GOLD);
  tag('explore', 'ptr alt', 0.6, 1.0, -1.4);
  say('explore：拜訪它所有相鄰頂點', '1 的鄰居：2、4、5');
  await beat(tok, 1800);
  for (const w of [2, 4, 5]) { paintEdge(G.es[ek(1, w)], COL.tree, true); tint(G.vs[w], COL.visit); await beat(tok, 900); }
  say('1 的鄰居都拜訪過 → 1 探索完', 'visit 一個點　explore = visit 它全部鄰居');
  await beat(tok, 3000);
}]);

// 00:59 小例子 BFS：1 → 2 4 5 → 7 3 6
FRAG.push(['graphbari-small-bfs', '小例子 BFS：1 2 4 5 7 3 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_SMALL);
  say('BFS：起點任選，這裡選 1', '探索完一個點，才換下一個點');
  await beat(tok, 2400);
  const r = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [2, 4, 5], 2: [7, 3, 6] }, ms: 1100 });
  say('BFS = ' + r.order.join(' '), '鄰居的順序可以任意（這裡 7 3 6）');
  await beat(tok, 3000);
}]);

// 02:06 小例子 DFS：1 2 3 6 7 4 5
FRAG.push(['graphbari-small-dfs', '小例子 DFS：1 2 3 6 7 4 5', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_SMALL);
  say('DFS：拜訪到新點，就先探索新點', '4、5 先不管，等一下再回來');
  await beat(tok, 2400);
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [2, 4, 5], 2: [3, 6, 7] }, ms: 1000 });
  say('DFS = ' + r.order.join(' '), 'BFS = 1 2 4 5 7 3 6　→ 結果不同');
  await beat(tok, 3200);
}]);

// 04:06 binary tree：BFS = level order，DFS = pre-order
FRAG.push(['graphbari-tree-level-pre', 'Binary tree：BFS 像 level order，DFS 像 pre-order', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIN);
  say('binary tree 也是 graph', '從 1 開始做 BFS 與 DFS');
  await beat(tok, 2200);
  await gbRun(tok, G, { kind: 'bfs', s: 1, contZ: null, rowZ: 1.4, rowLabel: 'BFS = level order', ms: 600 });
  say('BFS = 1 2 3 4 5 6 7', '<span class="ok">一層一層 = level order</span>');
  await beat(tok, 2600);
  G.reset();
  await gbRun(tok, G, { kind: 'dfs', s: 1, contZ: null, rowZ: 3.4, rowLabel: 'DFS = pre-order', ms: 600 });
  say('DFS = 1 2 4 5 3 6 7', '<span class="ok">根 → 左 → 右 = pre-order</span>');
  await beat(tok, 3000);
}]);

// 05:17 大例子 BFS（queue）：1 4 2 3 5 8 7 10 9 6
FRAG.push(['graphbari-bfs-queue', 'BFS 用 queue：1 4 2 3 5 8 7 10 9 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  say('BFS 用 queue', '初始：選起點 1，寫進結果、放進 queue');
  await beat(tok, 2400);
  const r = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [4, 2], 2: [3, 5, 8, 7], 3: [10, 9], 5: [8, 7, 6] }, tree: true, ms: 950 });
  gbNonTree(G, r);
  say('已拜訪過的邊畫虛線', 'BFS = ' + r.order.join(' '));
  await beat(tok, 3200);
}]);

// 09:06 BFS spanning tree、cross edge、兩個規則
FRAG.push(['graphbari-bfs-rules', 'BFS spanning tree、cross edge 與規則', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const r = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [4, 2], 2: [3, 5, 8, 7], 3: [10, 9], 5: [8, 7, 6] }, tree: true, contZ: null, ms: 90 });
  tag('BFS spanning tree', 'ptr alt', 3.7, 7.0, GB_TZ);
  say('得到的樹：BFS spanning tree', '樹邊 = V − 1 = 9 條');
  await beat(tok, 3000);
  const ne = gbNonTree(G, r);
  tag('cross edge', 'ptr', 6.2, 3.6, GB_TZ);
  say('虛線的邊叫 cross edge', ne.join('、'));
  await beat(tok, 3200);
  say('自由：起點任選、鄰居順序任選', '');
  await beat(tok, 2800);
  glow(G.vs[1], GOLD); glow(G.vs[4], GOLD); glow(G.vs[2], GOLD);
  say('規則 1：鄰居全拜訪完才換點', '探索 1：4 和 2 都要先拜訪，才能探索 4');
  await beat(tok, 3600);
  for (const k of [1, 4, 2]) glow(G.vs[k], null);
  say('規則 2：下一個探索點從 queue 取', 'queue 先進先出 → 一層一層');
  await beat(tok, 3400);
}]);

// 10:31 其他合法的 BFS
FRAG.push(['graphbari-bfs-more', '同一張圖，很多種合法的 BFS', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  say('答案不唯一：換個鄰居順序', '從 1 出發，先 2 再 4');
  await beat(tok, 2400);
  const a = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [2, 4], 2: [8, 5, 7, 3], 3: [10, 9] }, contZ: null, rowZ: 1.4, rowLabel: '從 1 出發', ms: 430 });
  say('也是合法的 BFS', a.order.join(' '));
  await beat(tok, 2600);
  G.reset();
  say('換起點：從 5 出發', '5 的鄰居 2、8、7、6');
  await beat(tok, 2000);
  const b = await gbRun(tok, G, { kind: 'bfs', s: 5, pref: { 5: [2, 8, 7, 6], 2: [3, 1], 3: [9, 10, 4] }, contZ: null, rowZ: 3.4, rowLabel: '從 5 出發', ms: 430 });
  say('起點、順序都能變 → 答案很多', b.order.join(' '));
  await beat(tok, 3000);
}]);

// 12:08 大例子 DFS（stack）：1 4 3 10 9 2 8 7 5 6
FRAG.push(['graphbari-dfs-stack', 'DFS 用 stack：1 4 3 10 9 2 8 7 5 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  say('DFS 用 stack', '拜訪到新點：目前的點暫停（留在 stack）');
  await beat(tok, 2600);
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [4, 2], 3: [10, 9, 2], 2: [8], 8: [7], 7: [5], 5: [6] }, ms: 850 });
  say('DFS = ' + r.order.join(' '), '一路往深處走，走不下去就從 stack 退回');
  await beat(tok, 3200);
}]);

// 15:44 DFS spanning tree、back edge、pre-order
FRAG.push(['graphbari-dfs-tree', 'DFS spanning tree、back edge 與 pre-order', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [4, 2], 3: [10, 9, 2], 2: [8], 8: [7], 7: [5], 5: [6] }, tree: true, contZ: null, ms: 90 });
  tag('DFS spanning tree', 'ptr alt', 3.7, 7.0, GB_TZ);
  say('走過的邊：DFS spanning tree', '樹又深又窄');
  await beat(tok, 3000);
  const ne = gbNonTree(G, r);
  tag('back edge', 'ptr', 6.2, 4.4, GB_TZ);
  say('虛線的邊叫 back edge', ne.join('、') + '（都連回祖先）');
  await beat(tok, 3400);
  const cur = tag('▼', 'ptr alt', 0, 0, GB_TZ);
  const seen = [];
  for (const v of r.order) {
    const [x, y] = r.pos[v]; cur.position.set(x, y + 0.6, GB_TZ); seen.push(v);
    say('對這棵樹做 pre-order', seen.join(' '));
    await beat(tok, 650);
  }
  say('pre-order = DFS 的結果', '<span class="ok">' + r.order.join(' ') + '</span>');
  await beat(tok, 3000);
}]);

// 16:24 其他合法的 DFS
FRAG.push(['graphbari-dfs-more', '同一張圖，很多種合法的 DFS', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  say('從 1 出發，這次先走 2', '2 → 8 → 7 → 5 → 6');
  await beat(tok, 2200);
  const a = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [2, 4], 2: [8, 3], 8: [7], 7: [5], 5: [6], 3: [9, 10] }, contZ: null, rowZ: 1.4, rowLabel: '從 1 出發', ms: 380 });
  say('也是合法的 DFS', a.order.join(' '));
  await beat(tok, 2600);
  G.reset();
  say('換起點：從 3 出發', '3 → 4 → 1 → 2 → 5 → 6');
  await beat(tok, 2000);
  const b = await gbRun(tok, G, { kind: 'dfs', s: 3, pref: { 3: [4, 10, 9], 4: [1], 1: [2], 2: [5], 5: [6, 7], 7: [8] }, contZ: null, rowZ: 3.4, rowLabel: '從 3 出發', ms: 380 });
  say('唯一規則：遇到新點就先探索它', b.order.join(' '));
  await beat(tok, 3000);
}]);

// 18:16 時間複雜度
FRAG.push(['graphbari-complexity', 'BFS、DFS 的時間複雜度', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  say('每個頂點只拜訪一次', '');
  await beat(tok, 1600);
  await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [4, 2], 2: [3, 5, 8, 7], 3: [10, 9], 5: [8, 7, 6] }, contZ: null, ms: 260 });
  say('影片：時間 O(n)，n = 頂點數', '只數「拜訪頂點」的次數');
  await beat(tok, 3200);
  for (const k in G.es) paintEdge(G.es[k], GOLD, true);
  say('補充：每條邊也要檢查', '<span class="ok">Adjacency List：O(V + E)</span>　Matrix：O(V²)');
  await beat(tok, 3800);
}]);
  }

  // ═══ graphpeng.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, ghostBox, GOLD, RED } = K;
// ─── 交大彭文志 Lec18／Lec19 Graph (1/4)(2/4)：課本（Horowitz）G1–G4、Weiss 7 點有向圖、ABCDE 的 BFS ───
const gpT = ctx.THREE;
const GPC = { v: '#4b9ee2', e: '#9c8b70', hot: '#c08a1f', red: '#d64545', ok: '#2fc092', zero: '#efe5d3', one: '#4b9ee2', head: '#e2d6c2', pink: '#e55a9b', start: '#e8a0a0' };
// a vertex block; its resting position is kept in userData.p so edges can be drawn while it is still falling
function gpV(name, x, z, color, dropH = 3, size = [0.8, 0.6, 0.8]) {
  const m = cube(name, color || GPC.v, size, x, 0.3, z, dropH);
  m.userData.p = V3(x, 0.3, z);
  return m;
}
const gpP = (m) => (m.userData && m.userData.p) || m.position;
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
async function gpRow(tok, label, items, x0, z, step = 1.1, color = GPC.v, ms = 300, size = [0.7, 0.5, 0.7]) {
  const head = cube(label, GPC.head, size, x0, 0.25, z, 0);
  const nodes = [], arrows = [];
  for (let k = 0; k < items.length; k++) {
    const x = x0 + (k + 1) * step;
    arrows.push(gpArrow(V3(x - step + size[0] / 2 + 0.02, 0.3, z), V3(x - size[0] / 2 - 0.02, 0.3, z)));
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
const gpK4 = (cx, cz, r) => ({ 0: [cx, cz - r], 1: [cx - r, cz], 2: [cx + r, cz], 3: [cx, cz + r] });
const GP_K4E = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

// ═════════════ Lec18 (0fVJsIC1QXs) ═════════════

// 00:00 Königsberg 七橋：A 是島（degree 5），B、C、D degree 3 → 沒有 Euler circuit
FRAG.push(['graphpeng-konigsberg', '七橋問題：degree 全是奇數', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const P = { C: [-0.8, -2.8], A: [-2.2, 0], B: [-0.8, 2.8], D: [2.6, 0] };
  const V = {};
  for (const n of Object.keys(P)) V[n] = gpV(n, P[n][0], P[n][1], '#c9a46a', 3, [1.0, 0.6, 1.0]);
  say('七橋問題：陸地 = 點，橋 = 邊', '4 塊陸地 A、B、C、D；7 座橋');
  await beat(tok, 2600);
  const br = [['a', 'A', 'C', 0.35], ['b', 'A', 'C', -0.35], ['c', 'A', 'B', 0.35], ['d', 'A', 'B', -0.35], ['e', 'A', 'D', 0], ['f', 'C', 'D', 0], ['g', 'B', 'D', 0]];
  for (const [nm, u, v, off] of br) {
    gpE(V[u], V[v], { off, gap: 0.6 });
    const m = gpMid(V[u], V[v], off * 1.9); tag(nm, 'idx', m.x, 0.5, m.z);
    say('橋 ' + nm + '：連接 ' + u + ' 與 ' + v, 'edge = 橋');
    await beat(tok, 550);
  }
  say('每座橋恰走一次，再回到起點？', '這就是 Euler circuit 問題');
  await beat(tok, 2800);
  const deg = { A: 5, B: 3, C: 3, D: 3 };
  for (const n of ['A', 'B', 'C', 'D']) {
    glow(V[n], GOLD);
    const p = P[n]; tag('deg ' + deg[n], 'ptr alt', p[0] + (n === 'D' ? 1.3 : n === 'A' ? -1.4 : 1.2), 0.5, p[1]);
    say('degree(' + n + ') = ' + deg[n], 'degree = 連在這個點上的邊數');
    await beat(tok, 1300);
    glow(V[n], null);
  }
  say('Euler：每點 degree 都要是偶數', '才可能有這種路徑');
  await beat(tok, 2800);
  for (const n of ['A', 'B', 'C', 'D']) tint(V[n], GPC.red);
  say('這裡 degree 全是奇數 → 不存在', 'A:5　B:3　C:3　D:3');
  await beat(tok, 3200);
}]);

// 05:35 G = (V, E)；shortest path：空間最短 vs 時間最短（數字為示意）
FRAG.push(['graphpeng-shortest-space-time', 'Shortest path：距離最短 vs 時間最短', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph({ S: [-5, 0], X: [-1, -2.4], Y: [-1, 2.4], D: [3.4, 0] }, [['S', 'X'], ['X', 'D'], ['S', 'Y'], ['Y', 'D']], { dropH: 3 });
  say('地圖 = graph：G = (V, E)', '點 = 地點，邊 = 道路');
  await beat(tok, 2600);
  const lb = { 'S-X': ['3 km', -0.5], 'X-D': ['4 km', -0.5], 'S-Y': ['5 km', 0.5], 'Y-D': ['5 km', 0.5] };
  const L = {};
  for (const k of Object.keys(lb)) { const [u, v] = k.split('-'); const m = gpMid(G.V[u], G.V[v], lb[k][1]); L[k] = tag(lb[k][0], 'ptr alt', m.x, 0.5, m.z); }
  tag('source', 'idx', -5, 0.4, 0.9); tag('destination', 'idx', 3.4, 0.4, 0.9);
  say('給 source、destination 找路徑', '例：Google Map 導航（數字為示意）');
  await beat(tok, 2800);
  gpPaint(G.E['S-X'], GPC.hot); gpPaint(G.E['X-D'], GPC.hot); glow(G.V.X, GOLD);
  say('空間上最短：S → X → D', '3 + 4 = 7 km　vs　5 + 5 = 10 km');
  await beat(tok, 3000);
  glow(G.V.X, null);
  txt(L['S-X'], '5 分'); txt(L['X-D'], '25 分（塞車）'); txt(L['S-Y'], '7 分'); txt(L['Y-D'], '8 分');
  gpPaint(G.E['X-D'], GPC.red);
  say('改看 travel time：X → D 常塞車', 'S→X→D = 30 分　S→Y→D = 15 分');
  await beat(tok, 3200);
  gpPaint(G.E['S-X'], GPC.e); gpPaint(G.E['S-Y'], GPC.ok); gpPaint(G.E['Y-D'], GPC.ok); glow(G.V.Y, GOLD);
  say('時間上最短：S → Y → D', '空間近，不一定時間短');
  await beat(tok, 3200);
}]);

// 14:55 project planning、Facebook 共同朋友
FRAG.push(['graphpeng-social', 'Graph 應用：專案流程與共同朋友', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const T = gpGraph({ '設計': [-5.6, -2.0], '實作': [-3.6, 0], '測試': [-5.6, 2.0] }, [['設計', '實作'], ['實作', '測試']], { dir: true, color: '#dd8238', dropH: 3, size: [1.2, 0.6, 0.8], gap: 0.75 });
  say('Project planning：工作的先後', '前一個 component 完成，下一個才開始');
  await beat(tok, 3000);
  glow(T.V['設計'], GOLD); await beat(tok, 600); glow(T.V['實作'], GOLD); await beat(tok, 600); glow(T.V['測試'], GOLD);
  say('開發流程畫成 graph 來控管', 'edge 有方向：先 → 後');
  await beat(tok, 2400);
  const S = gpGraph({ '你': [0.4, 0], '小明': [2.8, -2.2], '小華': [2.8, 2.2], '阿強': [5.4, 0] }, [['你', '小明'], ['你', '小華'], ['小明', '阿強'], ['小華', '阿強']], { dropH: 3, size: [1.1, 0.6, 0.8], gap: 0.7 });
  say('社群網路：V = user，E = 朋友', 'Facebook 的好友關係');
  await beat(tok, 2800);
  glow(S.V['你'], GOLD); glow(S.V['小明'], GOLD); glow(S.V['小華'], GOLD);
  gpPaint(S.E['你-小明'], GPC.hot); gpPaint(S.E['你-小華'], GPC.hot);
  say('先找你的鄰居', '小明、小華');
  await beat(tok, 2400);
  gpPaint(S.E['小明-阿強'], GPC.ok); gpPaint(S.E['小華-阿強'], GPC.ok);
  tint(S.V['阿強'], GPC.ok);
  tag('推薦加好友', 'ptr alt', 5.4, 0.6, 1.0);
  say('再找鄰居的鄰居 → 阿強', '你和阿強有 2 位共同朋友');
  await beat(tok, 3400);
}]);

// 17:00 G = (V, E)；G1 complete、G2 tree、G3 directed
FRAG.push(['graphpeng-g1g2g3', 'Graph 定義：G1、G2、G3', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.4]);
  say('G = (V, E)：頂點集合＋邊集合', 'V(G)、E(G)');
  await beat(tok, 2600);
  const G1 = gpGraph(gpK4(-4.6, 0, 1.8), [], { dropH: 3, size: [0.7, 0.5, 0.7] });
  tag('G1', 'ptr', -4.6, 0.3, 2.9);
  for (const [u, v] of GP_K4E) { gpE(G1.V[u], G1.V[v]); await beat(tok, 300); }
  say('G1：每兩點都相連 → complete', 'V = {0,1,2,3}，E 有 6 條');
  await beat(tok, 2600);
  say('無向：(0,1) = (1,0)', 'undirected：邊沒有方向');
  await beat(tok, 2400);
  const tp = { 0: [0, -1.9], 1: [-1.1, -0.4], 2: [1.1, -0.4], 3: [-1.7, 1.1], 4: [-0.5, 1.1], 5: [0.5, 1.1], 6: [1.7, 1.1] };
  const G2 = gpGraph(tp, [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]], { dropH: 3, size: [0.5, 0.45, 0.5], gap: 0.35 });
  tag('G2：tree', 'ptr', 0, 0.3, 2.9);
  say('G2：tree 也是一種 graph', 'V = {0..6}，E 有 6 條');
  await beat(tok, 2800);
  const G3 = gpGraph({ 0: [4.6, -2.0], 1: [4.6, 0], 2: [4.6, 2.0] }, [], { dropH: 3, size: [0.7, 0.5, 0.7] });
  tag('G3', 'ptr', 4.6, 0.3, 2.9);
  gpE(G3.V[0], G3.V[1], { dir: true, off: 0.22 }); gpE(G3.V[1], G3.V[0], { dir: true, off: 0.22 }); gpE(G3.V[1], G3.V[2], { dir: true });
  say('G3：directed，⟨0,1⟩ ≠ ⟨1,0⟩', 'E = {⟨0,1⟩, ⟨1,0⟩, ⟨1,2⟩}');
  await beat(tok, 3000);
  glow(G3.V[0], GOLD); glow(G3.V[1], GOLD);
  say('有方向：兩個方向是不同的邊', '⟨u,v⟩：u 指向 v');
  await beat(tok, 3000);
}]);

// 21:11 self loop（FSM）與 multigraph（例圖依影片口述重畫）
FRAG.push(['graphpeng-selfloop-multi', 'Self loop 與 multigraph', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const A = gpGraph({ 0: [-4.4, -1.6], 1: [-5.8, 1.2], 2: [-3.0, 1.2] }, [[0, 1], [1, 2]], { dropH: 3 });
  tag('(a)', 'ptr', -4.4, 0.3, 2.8);
  say('graph 通常不會自己連到自己', '否則形成 self loop');
  await beat(tok, 2600);
  gpLoop(A.V[0], 0, -0.75); glow(A.V[0], GOLD);
  tag('(0,0)', 'ptr alt', -3.3, 0.5, -2.4);
  say('self edge：(0,0)', 'FSM、compiler 檢查語法時會出現');
  await beat(tok, 3200);
  const B = gpGraph({ 0: [3.4, -2.2], 1: [1.8, 0], 2: [5.0, 0], 3: [3.4, 2.2] }, [[0, 1], [0, 2]], { dropH: 3 });
  tag('(b)', 'ptr', 3.4, 0.3, 3.2);
  say('通常也沒有 multiple edges', '同兩點之間只有一條');
  await beat(tok, 2400);
  for (const off of [0.2, -0.2]) { gpE(B.V[1], B.V[3], { off, color: GPC.red }); await beat(tok, 450); }
  for (const off of [0.2, -0.2]) { gpE(B.V[3], B.V[2], { off, color: GPC.red }); await beat(tok, 450); }
  say('有重複邊 → multigraph', '1–3、3–2 各有兩條');
  await beat(tok, 2800);
  say('例：每次 PO 文、回文各留一條邊', '保留每次互動的時間');
  await beat(tok, 2800);
  say('課本的 graph：沒有這兩種', '無 self loop、無 multiple edges');
  await beat(tok, 2800);
}]);

// 26:35 adjacent、path、length、simple path、cycle、DAG
FRAG.push(['graphpeng-path', 'Path、simple path、cycle、DAG', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-2.2, 0, 2.4), GP_K4E, { dropH: 3 });
  say('G1：看 path 相關名詞', 'V = {0,1,2,3}');
  await beat(tok, 2200);
  glow(G.V[0], GOLD); glow(G.V[1], GOLD); gpPaint(G.E['0-1'], GPC.hot);
  say('adjacent：(0,1) ∈ E → 0、1 相鄰', '有邊直接連就叫相鄰');
  await beat(tok, 2600);
  glow(G.V[0], null); glow(G.V[1], null); gpPaint(G.E['0-1'], GPC.e);
  const cur = tag('▼', 'ptr alt', -2.2, 1.0, -2.4);
  const path = [0, 1, 3, 2];
  tint(G.V[0], GPC.ok);
  for (let k = 1; k < path.length; k++) {
    const u = path[k - 1], v = path[k];
    gpPaint(G.E[Math.min(u, v) + '-' + Math.max(u, v)], GPC.ok);
    const p = gpP(G.V[v]); cur.position.set(p.x, 1.0, p.z); tint(G.V[v], GPC.ok);
    say('path：' + path.slice(0, k + 1).join(' → '), 'length = ' + k + ' 條邊');
    await beat(tok, 1100);
  }
  say('length = path 上的邊數 = 3', '0 → 1 → 3 → 2');
  await beat(tok, 2400);
  say('simple path：中間的點都不重複', '0, 1, 3, 2 是 simple path');
  await beat(tok, 2600);
  for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e);
  for (const n of [0, 1, 2, 3]) tint(G.V[n], GPC.v);
  for (const k of ['0-1', '1-2', '0-2']) gpPaint(G.E[k], GPC.red);
  for (const n of [0, 1, 2]) tint(G.V[n], GPC.red);
  say('cycle：起點 = 終點的 simple path', '0 → 1 → 2 → 0');
  await beat(tok, 3000);
  const D = gpGraph({ a: [3.6, -1.8], b: [5.6, 0], c: [3.6, 1.8] }, [['a', 'b'], ['b', 'c'], ['a', 'c']], { dir: true, dropH: 3, color: '#dd8238' });
  tag('DAG', 'ptr', 4.4, 0.3, 3.0);
  say('directed 且沒有 cycle → DAG', 'directed acyclic graph');
  await beat(tok, 3200);
}]);

// 29:32 connected／strongly connected；complete graph 邊數 n(n−1)/2、n(n−1)
FRAG.push(['graphpeng-complete-count', 'Complete graph 有幾條邊', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const U = gpGraph(gpK4(-3.8, 0, 2.2), [], { dropH: 3 });
  say('connected：兩點之間有 path', 'strongly connected：有向圖雙向都要有');
  await beat(tok, 3000);
  say('complete：每點都跟其他點相連', 'n = 4');
  await beat(tok, 2000);
  let c = 0;
  const cnt = tag('0 條', 'ptr alt', -3.8, 0.4, 3.2);
  for (const [u, v] of GP_K4E) {
    gpE(U.V[u], U.V[v], { color: GPC.hot }); c++; txt(cnt, c + ' 條');
    say('undirected：第 ' + c + ' 條 (' + u + ',' + v + ')', 'C(n,2) = n(n−1)/2');
    await beat(tok, 600);
  }
  say('undirected：C(4,2) = 6 條', 'n(n−1)/2 = 4·3/2 = 6');
  await beat(tok, 2800);
  const D = gpGraph(gpK4(3.8, 0, 2.2), [], { dropH: 3 });
  const cnt2 = tag('0 條', 'ptr alt', 3.8, 0.4, 3.2);
  c = 0;
  for (const [u, v] of GP_K4E) {
    gpE(D.V[u], D.V[v], { dir: true, off: 0.16, color: GPC.hot });
    gpE(D.V[v], D.V[u], { dir: true, off: 0.16, color: GPC.hot });
    c += 2; txt(cnt2, c + ' 條');
    say('directed：⟨' + u + ',' + v + '⟩ 與 ⟨' + v + ',' + u + '⟩', '每一對有兩個方向');
    await beat(tok, 650);
  }
  say('directed：n(n−1) = 12 條', '4·3 = 12，是 undirected 的 2 倍');
  await beat(tok, 3200);
}]);

// 31:27 subgraph：(i)–(iv) 都是 G1 的 subgraph（子圖依影片口述重畫）
FRAG.push(['graphpeng-subgraph', 'Subgraph：G1 的子圖', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-4.6, 0, 2.0), GP_K4E, { dropH: 3 });
  tag('G1', 'ptr', -4.6, 0.3, 3.0);
  say('subgraph G′：點、邊都取自 G', 'V(G′) ⊆ V(G)，E(G′) ⊆ E(G)');
  await beat(tok, 3000);
  const S = [
    ['(i)', 0.6, -1.8, [0], []],
    ['(ii)', 4.6, -1.8, [0, 1, 2], [[0, 1], [0, 2]]],
    ['(iii)', 0.6, 2.0, [0, 1, 2], [[0, 1], [0, 2], [1, 2]]],
    ['(iv)', 4.6, 2.0, [0, 1, 2, 3], [[0, 1], [1, 3], [3, 2]]],
  ];
  const cap = ['(i)：只有頂點 0，邊是空的', '(ii)：三個點，只留兩條邊', '(iii)：三個點與三條邊', '(iv)：四個點，留三條邊'];
  const frm = ['V = {0}，E = ∅ 也是 graph', '6 條邊只保留 2 條', 'E(G′) ⊆ E(G)', 'V 全取，E 取一部分'];
  for (let k = 0; k < S.length; k++) {
    const [nm, cx, cz, vs, es] = S[k];
    const pos = gpK4(cx, cz, 1.05); const sub = {};
    for (const v of vs) sub[v] = pos[v];
    const H = gpGraph(sub, es, { dropH: 3, size: [0.5, 0.4, 0.5], gap: 0.35, color: GPC.ok });
    tag(nm, 'ptr', cx - 1.7, 0.3, cz - 1.0);
    for (const v of vs) glow(G.V[v], GOLD);
    for (const [u, v] of es) gpPaint(G.E[Math.min(u, v) + '-' + Math.max(u, v)], GPC.hot);
    say(cap[k], frm[k]);
    await beat(tok, 2600);
    for (const v of vs) glow(G.V[v], null);
    for (const kk of Object.keys(G.E)) gpPaint(G.E[kk], GPC.e);
  }
  say('四個都是 G1 的 subgraph', '取點的子集、邊的子集');
  await beat(tok, 3000);
}]);

// 33:08 G4 的兩個 connected component H1、H2；connected() 呼叫 dfs 的次數 = component 數
FRAG.push(['graphpeng-g4-components', 'G4：兩個 connected component', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.6]);
  const pos = { 0: [-4.6, -2.4], 1: [-5.9, -0.9], 2: [-3.3, -0.9], 3: [-4.6, 0.6], 4: [-1.6, -0.9], 5: [0.2, -0.9], 6: [2.0, -0.9], 7: [3.8, -0.9] };
  const ed = [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [5, 6], [6, 7]];
  const G = gpGraph(pos, ed, { dropH: 3 });
  const adj = { 0: [1, 2], 1: [0, 3], 2: [0, 3], 3: [1, 2], 4: [5], 5: [4, 6], 6: [5, 7], 7: [6] };
  tag('H1', 'ptr', -6.4, 0.3, -2.6); tag('H2', 'ptr', 1.1, 0.3, -2.2);
  say('G4：8 個點，分成兩塊', 'H1 = {0,1,2,3}　H2 = {4,5,6,7}');
  await beat(tok, 2800);
  say('component 內任兩點都有 path', '例：4 → 5 → 6 → 7');
  for (const k of ['4-5', '5-6', '6-7']) { gpPaint(G.E[k], GPC.hot); await beat(tok, 600); }
  await beat(tok, 1400);
  for (const k of ['4-5', '5-6', '6-7']) gpPaint(G.E[k], GPC.e);
  const vis = [];
  for (let i = 0; i < 8; i++) { vis.push(cube(0, GPC.zero, [0.7, 0.4, 0.7], -3.5 + i * 1.0, 0.2, 2.8, 0)); tag(String(i), 'idx', -3.5 + i * 1.0, 0, 3.5); }
  tag('visited', 'idx', -5.2, 0.2, 2.8);
  const iptr = tag('i', 'ptr alt', -3.5, 0.9, 2.8);
  say('connected()：for i = 0..7', '沒拜訪過就 dfs(i)');
  await beat(tok, 2400);
  const COLS = [GPC.v, GPC.pink];
  let count = 0;
  for (let i = 0; i < 8; i++) {
    iptr.position.set(-3.5 + i * 1.0, 0.9, 2.8);
    if (vis[i].userData.done) { say('i = ' + i + '：已拜訪，跳過', 'count = ' + count); await beat(tok, 650); continue; }
    count++;
    const order = [], st = [i];
    const seen = new Set();
    const dfs = (u) => { seen.add(u); order.push(u); for (const w of adj[u]) if (!seen.has(w)) dfs(w); };
    dfs(i);
    say('i = ' + i + '：沒拜訪 → dfs(' + i + ')', 'count = ' + count);
    await beat(tok, 1000);
    for (const u of order) {
      tint(G.V[u], COLS[count - 1]); glow(G.V[u], GOLD);
      vis[u].userData.done = true; relabel(vis[u], 1); tint(vis[u], COLS[count - 1]);
      say('dfs 拜訪 ' + u, '順序：' + order.slice(0, order.indexOf(u) + 1).join(' '));
      await beat(tok, 650);
      glow(G.V[u], null);
    }
  }
  say('呼叫 dfs 2 次 → 2 個 component', '每個 component 是極大的連通子圖');
  await beat(tok, 3200);
}]);

// 34:34 G3 的 strongly connected component：{0,1} 與 {2}
FRAG.push(['graphpeng-scc-g3', 'G3 的 strongly connected component', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  const U = gpGraph({ 0: [-5.2, -1.6], 1: [-5.2, 1.6] }, [[0, 1]], { dropH: 3, color: '#9b7ef4' });
  tag('undirected', 'ptr', -5.2, 0.3, 3.0);
  say('undirected：一條邊兩邊都能走', '有 path 就 connected');
  await beat(tok, 2800);
  const G = gpGraph({ 0: [-1.6, 0], 1: [1.6, 0], 2: [4.8, 0] }, [], { dropH: 3 });
  const e01 = gpE(G.V[0], G.V[1], { dir: true, off: 0.25 });
  const e10 = gpE(G.V[1], G.V[0], { dir: true, off: 0.25 });
  const e12 = gpE(G.V[1], G.V[2], { dir: true });
  tag('G3', 'ptr', 1.6, 0.3, 2.2);
  say('directed：條件更嚴', 'u → v 而且 v → u 都要有 path');
  await beat(tok, 2800);
  gpPaint(e01, GPC.hot); glow(G.V[1], GOLD);
  say('0 → 1：有', '⟨0,1⟩ ∈ E');
  await beat(tok, 1600);
  gpPaint(e10, GPC.hot); glow(G.V[0], GOLD);
  say('1 → 0：也有 → 0、1 互通', '⟨1,0⟩ ∈ E');
  await beat(tok, 2200);
  const b1 = ghostBox('#c08a1f', 4.6, 1.2, 2.0); b1.position.set(0, 0.3, 0);
  say('{0,1} 是一個 SCC', 'strongly connected component：雙向都到得了');
  await beat(tok, 2800);
  gpPaint(e12, GPC.red); glow(G.V[2], RED);
  say('1 → 2 有，但 2 回不到 1', '2 不能併進 {0,1}');
  await beat(tok, 2800);
  const b2 = ghostBox('#d64545', 1.6, 1.2, 2.0); b2.position.set(4.8, 0.3, 0);
  say('2 自己一點也是一個 SCC', '只有自己 → isolated');
  await beat(tok, 2800);
  say('G3 共 2 個 SCC', '{0,1}　{2}');
  await beat(tok, 3000);
}]);

// 37:00 degree、in/out-degree、e = Σd / 2；Graph ADT
FRAG.push(['graphpeng-degree', 'Degree 與 e = Σd / 2', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-4.4, 0, 1.8), GP_K4E, { dropH: 3 });
  tag('G1', 'ptr', -4.4, 0.3, 2.9);
  say('degree：連在點上的邊數', 'G1（undirected）');
  await beat(tok, 2400);
  const dl = [];
  for (const n of [0, 1, 2, 3]) {
    glow(G.V[n], GOLD);
    for (const [u, v] of GP_K4E) if (u === n || v === n) gpPaint(G.E[u + '-' + v], GPC.hot);
    const p = gpP(G.V[n]); dl.push(tag('d=3', 'ptr alt', p.x + (n === 1 ? -0.9 : n === 2 ? 0.9 : 0.8), 0.5, p.z + (n === 0 ? -0.5 : n === 3 ? 0.5 : -0.5)));
    say('degree(' + n + ') = 3', 'd' + n + ' = 3');
    await beat(tok, 900);
    glow(G.V[n], null);
    for (const k of Object.keys(G.E)) gpPaint(G.E[k], GPC.e);
  }
  say('e = (Σ dᵢ) / 2', '(3 + 3 + 3 + 3) / 2 = 6');
  await beat(tok, 2800);
  say('除以 2：每條邊被兩端各算一次', 'undirected');
  await beat(tok, 2400);
  const D = gpGraph({ 0: [-0.8, -2.0], 1: [-0.8, 0], 2: [-0.8, 2.0] }, [], { dropH: 3 });
  tag('G3', 'ptr', -0.8, 0.3, 3.0);
  const a = gpE(D.V[0], D.V[1], { dir: true, off: 0.22 }), b = gpE(D.V[1], D.V[0], { dir: true, off: 0.22 }), c = gpE(D.V[1], D.V[2], { dir: true });
  glow(D.V[1], GOLD);
  gpPaint(a, GPC.ok);
  say('in-degree(1)：指向 1 的邊', '⟨0,1⟩ → in = 1');
  await beat(tok, 2400);
  gpPaint(a, GPC.e); gpPaint(b, GPC.hot); gpPaint(c, GPC.hot);
  say('out-degree(1)：從 1 指出的邊', '⟨1,0⟩、⟨1,2⟩ → out = 2');
  await beat(tok, 2600);
  const adt = code(['class Graph (ADT)', '  InsertVertex(v)', '  InsertEdge(u, v)', '  DeleteVertex(v)', '  DeleteEdge(u, v)', '  IsEmpty()'], 3.6, 0.3, 0.5, -1.4);
  say('Graph ADT：加點、加邊、刪點、刪邊', 'IsEmpty() 判斷是否為空');
  for (let i = 1; i < 6; i++) { adt.hl(i); await beat(tok, 600); }
  await beat(tok, 2200);
}]);

// Weiss 的 7 點有向圖（影片：1 → 2、3、4；2 → 4、5）
const GPW = { pos: { 1: [-5.4, -2.2], 2: [-2.6, -2.2], 3: [-6.4, 0], 4: [-4.0, 0], 5: [-1.6, 0], 6: [-5.4, 2.2], 7: [-2.6, 2.2] },
  adj: { 1: [2, 3, 4], 2: [4, 5], 3: [6], 4: [3, 6, 7], 5: [4, 7], 6: [], 7: [6] } };
function gpWeiss() {
  const ed = [];
  for (const u of Object.keys(GPW.adj)) for (const v of GPW.adj[u]) ed.push([Number(u), v]);
  return gpGraph(GPW.pos, ed, { dir: true, dropH: 3, size: [0.7, 0.5, 0.7], gap: 0.45 });
}

// 38:49 adjacency matrix（7 × 7，directed → 不對稱，space O(V²)）
FRAG.push(['graphpeng-weiss-matrix', 'Adjacency matrix：7 × 7', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G = gpWeiss();
  say('7 個點的 directed graph', '要用程式表示它');
  await beat(tok, 2400);
  const x0 = 0.6, z0 = -2.6, d = 0.8, M = [];
  for (let i = 1; i <= 7; i++) { tag(String(i), 'idx', x0 + (i - 1) * d, 0, z0 - 0.7); tag(String(i), 'idx', x0 - 0.7, 0, z0 + (i - 1) * d); }
  for (let i = 1; i <= 7; i++) { M[i] = []; for (let j = 1; j <= 7; j++) M[i][j] = cube(0, GPC.zero, [0.66, 0.2, 0.66], x0 + (j - 1) * d, 0.1, z0 + (i - 1) * d, 0); }
  say('7 個點 → 7 × 7 的 2D matrix', '有邊 = 1，沒邊 = 0');
  await beat(tok, 2600);
  const set1 = (i, j) => { relabel(M[i][j], 1); tint(M[i][j], GPC.one); M[i][j].scale.y = 2.2; };
  glow(G.V[1], GOLD);
  for (const j of GPW.adj[1]) { set1(1, j); glow(M[1][j], GOLD); glow(G.V[j], GOLD); await beat(tok, 700); }
  say('1 → 2、3、4：第 1 列三個 1', 'M[1][2] = M[1][3] = M[1][4] = 1');
  await beat(tok, 2600);
  for (let j = 1; j <= 7; j++) { glow(M[1][j], null); glow(G.V[j], null); }
  for (let i = 2; i <= 7; i++) {
    for (const j of GPW.adj[i]) set1(i, j);
    say('第 ' + i + ' 列：' + i + ' → ' + (GPW.adj[i].join('、') || '無'), '共 12 條邊 → 12 個 1');
    await beat(tok, 750);
  }
  glow(M[1][2], GOLD); glow(M[2][1], RED);
  say('directed：matrix 不對稱', 'M[1][2] = 1，M[2][1] = 0');
  await beat(tok, 2800);
  glow(M[1][2], null); glow(M[2][1], null);
  say('space：O(V²)，大多是 0', '7 × 7 = 49 格，只有 12 個 1');
  await beat(tok, 2800);
  say('undirected 時 matrix 會對稱', 'M[u][v] = M[v][u]');
  await beat(tok, 3000);
}]);

// 40:30 adjacency list（同一張圖；space O(V + E)）
FRAG.push(['graphpeng-weiss-list', 'Adjacency list：7 點有向圖', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G = gpWeiss();
  say('matrix 太佔空間 → 改用串列', 'linked list：每個頂點一個 head');
  await beat(tok, 2600);
  let total = 0;
  for (let i = 1; i <= 7; i++) {
    glow(G.V[i], GOLD);
    const ms = i <= 2 ? 450 : 150;
    await gpRow(tok, i, GPW.adj[i], 0.2, -2.7 + (i - 1) * 0.9, 1.1, GPC.v, ms, [0.6, 0.45, 0.6]);
    total += GPW.adj[i].length;
    say(i + ' → ' + (GPW.adj[i].join(' → ') || '空串列'), i === 1 ? '串列存的是 adjacent 的點' : '目前 ' + total + ' 個節點');
    await beat(tok, i <= 2 ? 2200 : 800);
    glow(G.V[i], null);
  }
  say('6 沒有指出去的邊 → 空串列', '共 12 個節點 = E');
  await beat(tok, 2600);
  say('space：O(V + E)', '7 個 head + 12 個節點');
  await beat(tok, 3000);
}]);

// ═════════════ Lec19 (Ax1OL2mikJo) ═════════════

// 02:07 adjacency list：G1（complete）與 G3（directed）
FRAG.push(['graphpeng-g1g3-lists', 'Adjacency list：G1 與 G3', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const G1 = gpGraph(gpK4(-5.4, 0, 1.3), GP_K4E, { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 });
  tag('G1', 'ptr', -5.4, 0.3, 2.2);
  say('adjacent node：一條邊就到得了', 'list 裡的順序沒有規定');
  await beat(tok, 2600);
  const L1 = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 3], 3: [0, 1, 2] };
  for (let i = 0; i < 4; i++) {
    glow(G1.V[i], GOLD);
    await gpRow(tok, i, L1[i], -3.3, -2.1 + i * 1.3, 0.95, GPC.v, 220, [0.55, 0.42, 0.55]);
    say(i + ' → ' + L1[i].join(' → '), 'G1 complete：每條都 3 個');
    await beat(tok, 900);
    glow(G1.V[i], null);
  }
  say('complete graph：每條串列一樣長', '無向：每條邊存兩次，共 2e = 12');
  await beat(tok, 2600);
  const G3 = gpGraph({ 0: [1.8, -2.0], 1: [1.8, 0], 2: [1.8, 2.0] }, [], { dropH: 3, size: [0.55, 0.45, 0.55] });
  gpE(G3.V[0], G3.V[1], { dir: true, off: 0.2, gap: 0.4 }); gpE(G3.V[1], G3.V[0], { dir: true, off: 0.2, gap: 0.4 }); gpE(G3.V[1], G3.V[2], { dir: true, gap: 0.4 });
  tag('G3', 'ptr', 1.8, 0.3, 3.0);
  const L3 = { 0: [1], 1: [0, 2], 2: [] };
  for (let i = 0; i < 3; i++) {
    glow(G3.V[i], GOLD);
    await gpRow(tok, i, L3[i], 3.6, -2.0 + i * 2.0, 0.95, GPC.pink, 250, [0.55, 0.42, 0.55]);
    say(i + ' → ' + (L3[i].join(' → ') || '空'), 'directed：只記指出去的邊');
    await beat(tok, 1300);
    glow(G3.V[i], null);
  }
  say('directed：串列長度 = out-degree', '節點總數 = e = 3');
  await beat(tok, 3000);
}]);

// 04:42 sequential representation：G4 存進一維陣列 node[0..22]
FRAG.push(['graphpeng-sequential', '一維陣列表示：node[]', async (tok) => {
  fresh([0, 10, 8], [0, 0, 0]);
  const pos = { 0: [-5.0, -3.4], 1: [-6.0, -2.4], 2: [-4.0, -2.4], 3: [-5.0, -1.4], 4: [-1.6, -2.4], 5: [0.0, -2.4], 6: [1.6, -2.4], 7: [3.2, -2.4] };
  const G = gpGraph(pos, [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [5, 6], [6, 7]], { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 });
  tag('H1', 'ptr', -6.6, 0.3, -3.4); tag('H2', 'ptr', 4.4, 0.3, -2.4);
  say('第三種：一維陣列存 G4', 'n = 8 個點（0–7），e = 7');
  await beat(tok, 2600);
  const node = [9, 11, 13, 15, 17, 18, 20, 22, 23, 2, 1, 3, 0, 0, 3, 1, 2, 5, 6, 4, 5, 7, 6];
  const own = [];
  for (let v = 0; v < 8; v++) for (let k = node[v]; k < node[v + 1]; k++) own[k] = v;
  const X = (i) => -6.16 + i * 0.56, Z = 1.0;
  const C = [];
  for (let i = 0; i < 23; i++) {
    const col = i <= 8 ? GPC.start : (own[i] % 2 ? GPC.ok : GPC.v);
    C.push(cube(node[i], col, [0.5, 0.4, 0.5], X(i), 0.2, Z, 3));
    tag(String(i), 'idx', X(i), 0, Z + 0.6);
    if (i === 8 || i === 22) await beat(tok, 300);
  }
  tag('起點區', 'ptr', X(4), 0.3, Z + 1.4); tag('鄰居區', 'ptr', X(15), 0.3, Z + 1.4);
  say('前 n + 1 格放「起點 index」', '後面 2e 格依序放鄰居');
  await beat(tok, 2800);
  glow(C[0], GOLD); glow(G.V[0], GOLD);
  const ar = gpArrow(V3(X(0), 0.7, Z - 0.3), V3(X(9), 0.7, Z - 0.3), 0x8a6400);
  say('node[0] = 9：0 的鄰居從 9 開始', '0 的鄰居區：node[9..10]');
  await beat(tok, 2600);
  for (const k of [9, 10]) { glow(C[k], GOLD); glow(G.V[node[k]], GOLD); await beat(tok, 700); }
  say('node[9], node[10] = 2, 1', '0 跟 2、1 相連');
  await beat(tok, 2200);
  glow(C[1], RED);
  say('終點 = 下一個起點 − 1', 'node[1] = 11 → 0 的鄰居到 10 為止');
  await beat(tok, 2800);
  kill(ar); [0, 1, 9, 10].forEach((k) => glow(C[k], null)); for (let v = 0; v < 8; v++) glow(G.V[v], null);
  glow(C[7], GOLD); glow(C[22], GOLD); glow(G.V[7], GOLD); glow(G.V[6], GOLD);
  const ar2 = gpArrow(V3(X(7), 0.7, Z - 0.3), V3(X(22), 0.7, Z - 0.3), 0x8a6400);
  say('node[7] = 22：7 只連到 6', 'node[22] = 6');
  await beat(tok, 2600);
  glow(C[8], RED);
  say('node[8] = 23：結尾哨兵，不是頂點', '大小 n + 2e + 1 = 8 + 14 + 1 = 23');
  await beat(tok, 3000);
  kill(ar2); [7, 8, 22].forEach((k) => glow(C[k], null)); glow(G.V[7], null); glow(G.V[6], null);
  say('新增頂點 8：起點區要多一格', 'index 9 以後全部往右 shift');
  for (let i = 9; i < 23; i++) move(C[i], X(i) + 0.56, 0.2, Z);
  await beat(tok, 1200);
  const nw = cube('new', GPC.hot, [0.5, 0.4, 0.5], X(9), 0.2, Z, 3);
  await beat(tok, 1000);
  say('插入／刪除頂點：整段搬移', 'movement cost 很高');
  await beat(tok, 3000);
}]);

// 10:42 inverse adjacency list（G3）：記 in-degree
FRAG.push(['graphpeng-inverse-list', 'Inverse adjacency list：誰指向我', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph({ 0: [-5.6, -2.2], 1: [-5.6, 0], 2: [-5.6, 2.2] }, [], { dropH: 3 });
  gpE(G.V[0], G.V[1], { dir: true, off: 0.22 }); gpE(G.V[1], G.V[0], { dir: true, off: 0.22 }); gpE(G.V[1], G.V[2], { dir: true });
  tag('G3', 'ptr', -5.6, 0.3, 3.3);
  tag('adjacency list', 'ptr', -2.0, 0.3, -3.3);
  const OUT = { 0: [1], 1: [0, 2], 2: [] }, IN = { 0: [1], 1: [0], 2: [1] };
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(await gpRow(tok, i, OUT[i], -3.4, -2.2 + i * 2.2, 1.2, GPC.v, 250));
  say('adjacency list 記「我指向誰」', '串列長度 = out-degree');
  await beat(tok, 2800);
  glow(G.V[2], GOLD);
  say('問 2 的 in-degree？', '只有這份 list → 每條都要 scan');
  await beat(tok, 2200);
  let cnt = 0;
  for (let i = 0; i < 3; i++) {
    glow(rows[i].head, GOLD);
    for (const nd of rows[i].nodes) { glow(nd, '#3a2a10'); await beat(tok, 500); if (nd.userData.lbl.element.textContent === '2') { glow(nd, GOLD); cnt++; } }
    say('掃 list[' + i + ']：' + (i === 1 ? '有 2 → +1' : '沒有 2'), 'in-degree(2) 目前 = ' + cnt);
    await beat(tok, 1300);
    glow(rows[i].head, null);
  }
  for (const r of rows) for (const nd of r.nodes) glow(nd, null);
  tag('inverse adjacency list', 'ptr', 4.2, 0.3, -3.3);
  for (let i = 0; i < 3; i++) await gpRow(tok, i, IN[i], 2.8, -2.2 + i * 2.2, 1.2, GPC.pink, 350);
  say('inverse：記「誰指向我」', '0 ← 1　1 ← 0　2 ← 1');
  await beat(tok, 2800);
  say('in-degree = inverse 串列長度', 'in-degree(2) = 1，不用全部掃');
  await beat(tok, 3000);
}]);

// 14:05 adjacency multilist 的動機：adjacency list 每條邊存兩次
FRAG.push(['graphpeng-multilist-why', 'Multilist：每條邊只存一次', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const G = gpGraph(gpK4(-5.0, 0, 1.6), GP_K4E, { dropH: 3, size: [0.6, 0.45, 0.6], gap: 0.38 });
  tag('K4（G1）', 'ptr', -5.0, 0.3, 2.6);
  const L = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 3], 3: [0, 1, 2] };
  const rows = [];
  for (let i = 0; i < 4; i++) rows.push(await gpRow(tok, i, L[i], -2.4, -2.4 + i * 1.3, 1.0, GPC.v, 120, [0.6, 0.45, 0.6]));
  say('adjacency list：以 vertex 為主', '4 個點、6 條邊');
  await beat(tok, 2400);
  gpPaint(G.E['0-1'], GPC.red);
  glow(rows[0].nodes[0], RED); glow(rows[1].nodes[0], RED);
  say('邊 (0,1) 被存了兩次', 'list[0] 有 1，list[1] 有 0');
  await beat(tok, 2800);
  say('6 條邊 → 12 個串列節點', '每條邊都存兩次（2e）');
  await beat(tok, 2600);
  fly(rows[0].nodes[0]); fly(rows[1].nodes[0]);
  const n0 = code(['N0: | m | 0 | 1 | link1 | link2 |'], 3.3, 2.4, 0.5, 0);
  say('multilist：每條邊一個 node', '(0,1) 只存成 N0');
  await beat(tok, 2800);
  n0.hl(0);
  tag('vertex1, vertex2 = 兩個端點', 'idx', 3.3, 0.3, 3.1);
  tag('link1／link2 = 兩個 pointer', 'idx', 3.3, 0.3, 3.6);
  say('欄位：兩個端點＋兩個 pointer', 'link1 接 vertex1 的下一條邊');
  await beat(tok, 3200);
  say('以 edge 為主，不以 vertex 為主', 'node 數 = e = 6');
  await beat(tok, 3000);
}]);

// 17:00／21:15 adjacency multilist（K4）：沿 pointer 走出每個頂點的串列；params.v = 要追蹤的頂點
FRAG.push(['graphpeng-multilist', 'Multilist：沿 pointer 走', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const P = ctx.params || {};
  const trace = Array.isArray(P.v) ? P.v : [0, 1];
  const N = [[0, 1, 1, 3], [0, 2, 2, 3], [0, 3, -1, 4], [1, 2, 4, 5], [1, 3, -1, 5], [2, 3, -1, -1]];
  const z = (k) => -2.6 + k * 1.05, cx = [-1.4, -0.6, 0.5, 1.5];
  const R = [];
  for (let k = 0; k < 6; k++) {
    const [a, b, l1, l2] = N[k];
    tag('N' + k, 'ptr', -2.6, 0.3, z(k));
    R.push([cube(a, '#c9d9f0', [0.75, 0.4, 0.75], cx[0], 0.2, z(k), 3), cube(b, '#c9d9f0', [0.75, 0.4, 0.75], cx[1], 0.2, z(k), 3),
      cube(l1 < 0 ? 0 : 'N' + l1, '#f2d9a0', [0.95, 0.4, 0.75], cx[2], 0.2, z(k), 3), cube(l2 < 0 ? 0 : 'N' + l2, '#f2d9a0', [0.95, 0.4, 0.75], cx[3], 0.2, z(k), 3)]);
    await beat(tok, 250);
  }
  tag('v1', 'idx', cx[0], 0, z(0) - 0.7); tag('v2', 'idx', cx[1], 0, z(0) - 0.7); tag('link1', 'idx', cx[2], 0, z(0) - 0.7); tag('link2', 'idx', cx[3], 0, z(0) - 0.7);
  const G = gpGraph(gpK4(4.8, -0.6, 1.4), GP_K4E, { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 });
  const H = [];
  for (let v = 0; v < 4; v++) H.push(cube(v, GPC.head, [0.6, 0.45, 0.6], -5.4, 0.25, -1.8 + v * 1.2, 0));
  tag('head', 'idx', -5.4, 0, -2.6);
  say('K4 有 6 條邊 → 6 個 node', 'N0=(0,1) … N5=(2,3)');
  await beat(tok, 2600);
  for (const v of trace) {
    glow(H[v], GOLD); glow(G.V[v], GOLD);
    let k = [0, 1, 2, 3, 4, 5].find((q) => N[q][0] === v || N[q][1] === v);
    let prev = V3(-5.0, 0.4, -1.8 + v * 1.2);
    const arrows = [], chain = [];
    while (k >= 0) {
      const [a, b, l1, l2] = N[k];
      const side = a === v ? 0 : 1;
      arrows.push(gpArrow(prev, V3(cx[0] - 0.45, 0.4, z(k)), 0x8a6400));
      chain.push('N' + k);
      glow(R[k][side], GOLD); glow(R[k][2 + side], GOLD);
      gpPaint(G.E[a + '-' + b], GPC.hot);
      const nx = side === 0 ? l1 : l2;
      say('vertex ' + v + '：' + chain.join(' → '), 'N' + k + ' = (' + a + ',' + b + ')，' + (side ? 'link2' : 'link1') + ' = ' + (nx < 0 ? '0（null）' : 'N' + nx));
      await beat(tok, 1300);
      prev = V3(cx[2 + side], 0.4, z(k) + 0.25);
      k = nx;
    }
    say('vertex ' + v + ' 的串列：' + chain.join(' → '), '就是 ' + v + ' 的 3 條邊');
    await beat(tok, 2000);
    arrows.forEach(kill); glow(H[v], null); glow(G.V[v], null);
    for (const r of R) r.forEach((c) => glow(c, null));
    for (const kk of Object.keys(G.E)) gpPaint(G.E[kk], GPC.e);
  }
  say('一個 node 同時屬於兩條串列', 'node 數 = e = 6（list 要 2e = 12）');
  await beat(tok, 3000);
}]);

// 24:30 weighted edge → network；road network：路口 = vertex，路段 = edge（數字為示意）
FRAG.push(['graphpeng-network', 'Network：有權重的 graph', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const pos = { S: [-5.4, 0], A: [-2.2, -2.2], B: [-2.2, 2.2], C: [1.4, 0], D: [4.8, 0] };
  const W = [['S', 'A', 4], ['S', 'B', 2], ['B', 'A', 1], ['A', 'C', 3], ['B', 'C', 6], ['C', 'D', 2]];
  const V = {};
  for (const n of Object.keys(pos)) V[n] = gpV(n, pos[n][0], pos[n][1], '#c9a46a', 3);
  say('road network：路口 = vertex', '交叉路口（intersection）');
  await beat(tok, 2600);
  const E = {};
  for (const [u, v] of W) { E[u + v] = gpE(V[u], V[v]); await beat(tok, 300); }
  say('路口之間的路段 = edge', '一條路被路口切成很多 segment');
  await beat(tok, 2600);
  kill(E.SA);
  const e1 = gpE(V.S, V.A, { dir: true, off: 0.18 }), e2 = gpE(V.A, V.S, { dir: true, off: 0.18 });
  gpPaint(e1, GPC.hot); gpPaint(e2, GPC.hot);
  say('雙向道 → 兩條有向邊', 'road network 是 directed graph');
  await beat(tok, 2800);
  for (const [u, v, w] of W) { const m = gpMid(V[u], V[v], 0.45); tag(String(w), 'ptr alt', m.x, 0.5, m.z); }
  say('edge 加上 weight → network', 'weight = 路段實際距離（示意）');
  await beat(tok, 3000);
  const best = ['S', 'B', 'A', 'C', 'D'];
  for (let k = 0; k < best.length; k++) {
    tint(V[best[k]], GPC.ok);
    if (k) { const key = best[k - 1] + best[k]; gpPaint(E[key], GPC.ok); }
    say('最短路徑：' + best.slice(0, k + 1).join('→'), k === best.length - 1 ? '2 + 1 + 3 + 2 = 8' : '從 S 到 D 距離總和最小');
    await beat(tok, 900);
  }
  say('其他路線都比較長', 'S→A→C→D = 9　S→B→C→D = 10　最短 = 8');
  await beat(tok, 3200);
}]);

// 34:44 DFS 不唯一（list[0] = 1,2 vs 2,1）＋ complexity：list O(e)、matrix O(n²)
FRAG.push(['graphpeng-dfs-order-cost', 'DFS 不唯一與複雜度', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const BX = [[0, -2.9], [-1.9, -1.4], [1.9, -1.4], [-2.9, 0.4], [-0.95, 0.4], [0.95, 0.4], [2.9, 0.4], [0, 2.2]];
  const ED = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7]];
  const mk = (cx) => { const p = {}; BX.forEach(([x, z], i) => { p[i] = [cx + x * 0.62, z * 0.75]; }); return gpGraph(p, ED, { dropH: 3, size: [0.55, 0.45, 0.55], gap: 0.35 }); };
  const L = mk(-3.6), Rg = mk(3.6);
  const adjOf = (first) => { const A = {}; for (let i = 0; i < 8; i++) A[i] = []; for (const [u, v] of ED) { A[u].push(v); A[v].push(u); } for (const k in A) A[k].sort((a, b) => a - b); A[0] = first; return A; };
  const dfsOrder = (A) => { const seen = new Set(), ord = [], tree = []; const go = (u) => { seen.add(u); ord.push(u); for (const w of A[u]) if (!seen.has(w)) { tree.push([u, w]); go(w); } }; go(0); return [ord, tree]; };
  const [o1, t1] = dfsOrder(adjOf([1, 2])), [o2, t2] = dfsOrder(adjOf([2, 1]));
  tag('list[0] = 1 → 2', 'ptr', -3.6, 0.3, 3.0); tag('list[0] = 2 → 1', 'ptr', 3.6, 0.3, 3.0);
  say('DFS 不唯一：看 list 的順序', 'adjacency list 沒規定小的在前');
  await beat(tok, 3000);
  const seq = [tag('', 'ptr alt', -3.6, 0.5, -3.3), tag('', 'ptr alt', 3.6, 0.5, -3.3)];
  for (let k = 0; k < 8; k++) {
    for (const [G, o, t, s] of [[L, o1, t1, seq[0]], [Rg, o2, t2, seq[1]]]) {
      const v = o[k]; tint(G.V[v], GPC.ok); glow(G.V[v], GOLD);
      if (k) { const [a, b] = t[k - 1]; gpPaint(G.E[Math.min(a, b) + '-' + Math.max(a, b)], GPC.hot); }
      txt(s, o.slice(0, k + 1).join(' '));
    }
    say('第 ' + (k + 1) + ' 個拜訪：' + o1[k] + '　vs　' + o2[k], '左：' + o1.slice(0, k + 1).join(' ') + '　右：' + o2.slice(0, k + 1).join(' '));
    await beat(tok, 1000);
    glow(L.V[o1[k]], null); glow(Rg.V[o2[k]], null);
  }
  say('兩種順序都是正確的 DFS', o1.join(' ') + '　／　' + o2.join(' '));
  await beat(tok, 3000);
  say('Adjacency list：每條邊看常數次', 'DFS = O(e)（含頂點 O(n + e)）');
  await beat(tok, 2800);
  say('Adjacency matrix：每點掃一整列', 'n 個點 × n 格 = O(n²)');
  await beat(tok, 3000);
}]);

// 37:14 BFS：A 的鄰居 B、D、E；B、D、E 都連到 C → A B D E C
FRAG.push(['graphpeng-bfs-abcde', 'BFS：A B D E C', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const pos = { A: [-4.0, -2.4], B: [-5.8, -0.2], D: [-4.0, -0.2], E: [-2.2, -0.2], C: [-4.0, 2.2] };
  const G = gpGraph(pos, [['A', 'B'], ['A', 'D'], ['A', 'E'], ['B', 'C'], ['D', 'C'], ['E', 'C']], { dropH: 3 });
  const adj = { A: ['B', 'D', 'E'], B: ['A', 'C'], D: ['A', 'C'], E: ['A', 'C'], C: ['B', 'D', 'E'] };
  tag('queue', 'ptr', 0.0, 0.3, -1.0); tag('輸出', 'ptr', 0.0, 0.3, 2.4);
  const QX = (k) => 1.3 + k * 1.1, OX = (k) => 1.3 + k * 1.1;
  say('BFS ≈ tree 的 level order', '要用 queue');
  await beat(tok, 2600);
  const Q = [], seen = new Set(['A']); let out = 0;
  const outCube = (n) => { cube(n, GPC.ok, [0.7, 0.5, 0.7], OX(out), 0.25, 2.4, 3); out++; };
  tint(G.V.A, GPC.ok); outCube('A');
  say('輸出 A', '從 A 開始');
  await beat(tok, 1600);
  const qShow = () => Q.forEach((q, k) => move(q.m, QX(k), 0.25, -1.0));
  for (const w of adj.A) { seen.add(w); Q.push({ n: w, m: cube(w, GPC.v, [0.7, 0.5, 0.7], QX(Q.length), 0.25, -1.0, 3) }); glow(G.V[w], GOLD); gpPaint(G.E['A-' + w], GPC.hot); await beat(tok, 500); }
  say('A 的鄰居 B、D、E 進 queue', 'queue：B D E');
  await beat(tok, 2400);
  while (Q.length) {
    const { n, m } = Q.shift(); fly(m); qShow();
    tint(G.V[n], GPC.ok); glow(G.V[n], null); outCube(n);
    const added = [], skipped = [];
    for (const w of adj[n]) {
      if (w === 'A') continue;
      const key = pos[n] && G.E[n + '-' + w] ? n + '-' + w : w + '-' + n;
      if (seen.has(w)) { if (n !== 'C') { skipped.push(w); gpPaint(G.E[key], GPC.red); } continue; }
      seen.add(w); added.push(w); gpPaint(G.E[key], GPC.hot); glow(G.V[w], GOLD);
      Q.push({ n: w, m: cube(w, GPC.v, [0.7, 0.5, 0.7], QX(Q.length), 0.25, -1.0, 3) });
    }
    const qs = Q.map((q) => q.n).join(' ') || '空';
    let cap = '取出 ' + n;
    if (added.length) cap += '：' + added.join('、') + ' 進 queue';
    else if (skipped.length && n !== 'C') cap += '：' + skipped.join('、') + ' 已在 queue';
    say(cap, 'queue：' + qs);
    await beat(tok, 2200);
  }
  say('BFS：A B D E C', '一層一層：A｜B D E｜C');
  await beat(tok, 3200);
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
