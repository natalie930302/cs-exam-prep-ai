// 離散數學 第8章：圖論（進階）— 樹與生成樹（DFS／BFS、Cayley、Matrix-Tree）、最小生成樹、最短路徑、
// 連通度與 cut vertex、Euler trail、平面圖與 Euler 公式、著色（χ(G)、chromatic polynomial）、匹配（Hall）、最大流。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 慣例（Rosen／Grimaldi）：無向邊寫 {u,v}、有向邊寫 (u,v)。生成樹影片（Rosen 11.4）的三張圖照影片口述重建：
// 例 1（a–g，拿掉 {a,e}{e,f}{c,g}）、DFS 從 f 出發（f g h k j → i → d e c a → b）、BFS 從 e 出發（level 1 = b d f i）。
// DFS 例子的「回邊」位置影片看不到，這裡自己補了 4 條（都連到祖先，符合 back edge 定義）。
// 著色影片（Discrete Math II 10.8.1）的地圖：A–B、A–C、B–C、B–E、C–D、C–E、D–E。影片用 greedy 塗出 4 色、
// 並寫 P(G,λ) = λ(λ−1)(λ−2)(λ−1)(λ−3)；但照它列的相鄰關係 3 色就夠，正確的是 λ(λ−1)(λ−2)³ —— 場景兩者都演、標出錯在哪。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const COL = { idle: '#cdbfa6', vis: '#2fc092', edge: '#9c8b70', tree: '#c08a1f', dim: '#e9e1d3', hot: '#d64545', blue: '#4b9ee2', pink: '#e55a9b', purple: '#9b7ef4', orange: '#dd8238' };
  const COMP = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a'];
  const CC = ['#e9c53a', '#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238'];
  const CN = ['黃', '綠', '藍', '紫', '粉', '橘'];
  const GOLD = '#6a4a00';
  const UP = V3(0, 1, 0);

  // ───────────────────────── 共用小工具 ─────────────────────────
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
  const glow = (m, c) => { if (m && m.material) m.material.emissive = new THREE.Color(c || '#000000'); };
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok === undefined) await sleep(ms / steps); else await beat(tok, ms / steps); } }

  // ───────────────────────── 圖：資料、畫法、上色 ─────────────────────────
  // parseG({a:[x,z],…}, 'a-b:4 b>c') — '-' 無向、'>' 有向，':w' 權重
  function parseG(P, estr) {
    const E = []; let dir = false;
    estr.trim().split(/\s+/).forEach((tk) => {
      const [pair, w] = tk.split(':'); const d = pair.includes('>'); if (d) dir = true;
      const [u, v] = pair.split(d ? '>' : '-');
      E.push({ u, v, w: w === undefined ? undefined : Number(w) });
    });
    return { V: Object.keys(P), P, E, dir };
  }
  const ringP = (names, R, a0 = Math.PI / 2, cx = 0, cz = 0) => Object.fromEntries(names.map((n, i) => { const a = a0 + i * 2 * Math.PI / names.length; return [n, [cx + Math.cos(a) * R, cz - Math.sin(a) * R]]; }));
  // adjacency: name → [{to, i}]；order 可指定每個頂點的鄰居順序（字串或陣列），否則依名稱排序
  function adjOf(G, order) {
    const A = Object.fromEntries(G.V.map((n) => [n, []]));
    G.E.forEach((e, i) => { A[e.u].push({ to: e.v, i }); if (!G.dir) A[e.v].push({ to: e.u, i }); });
    for (const n of G.V) {
      const o = order && order[n] ? [...order[n]] : null;
      A[n].sort((p, q) => o ? o.indexOf(p.to) - o.indexOf(q.to) : (p.to < q.to ? -1 : p.to > q.to ? 1 : 0));
    }
    return A;
  }
  function edgeMesh(a, b, o = {}) {
    const gap = o.gap ?? 0.42, r = o.r ?? 0.05, off = o.off || 0;
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
    g.userData = { mat, cyl, mid: s.clone().add(e).multiplyScalar(0.5), side: V3(-n.z, 0, n.x) };
    lab.world.add(g);
    return g;
  }
  function drawGraph(G, o = {}) {
    const s = o.s ?? 1, ox = o.ox ?? 0, oz = o.oz ?? 0, y = o.y ?? 0.3;
    const size = o.size || [0.66 * Math.min(1, s + 0.2), 0.5, 0.66 * Math.min(1, s + 0.2)];
    const pos = (n) => V3(ox + G.P[n][0] * s, y, oz + G.P[n][1] * s);
    const vm = {};
    G.V.forEach((n) => {
      const m = lab.box(o.vc || COL.idle, size);
      if (!o.noName) { m.userData.lbl = lab.label(n, 'val'); m.add(m.userData.lbl); }
      m.position.copy(pos(n)); lab.world.add(m); vm[n] = m;
    });
    const key = (e) => [e.u, e.v].sort().join('|');
    const seen = {};
    const em = G.E.map((e) => {
      const k = key(e); const cnt = G.E.filter((f) => key(f) === k).length; const idx = seen[k] = (seen[k] ?? -1) + 1;
      const sign = e.u < e.v ? 1 : -1;
      const off = cnt > 1 ? (idx - (cnt - 1) / 2) * (o.par ?? 0.45) * sign : 0;
      const g = edgeMesh(pos(e.u), pos(e.v), { directed: G.dir, off, gap: o.gap ?? 0.42 * Math.min(1, s + 0.15), r: o.r });
      let wl = null;
      if (e.w !== undefined && o.weights !== false) {
        // a parallel / opposite edge: its weight goes on the outer side of its own rod, away from the twin's
        const p = g.userData.mid.clone().addScaledVector(g.userData.side, (G.dir ? 0.28 : 0.22) * (off < 0 ? -1 : 1));
        wl = tag(String(e.w), 'idx', p.x, p.y + 0.25, p.z);
      }
      return { ...e, g, wl };
    });
    const find = (u, v) => em.findIndex((e) => (e.u === u && e.v === v) || (!G.dir && e.u === v && e.v === u));
    return { G, vm, em, pos, find };
  }
  function paintEdge(e, color, thick, visible = true) {
    if (!e) return;
    e.g.visible = visible; if (e.wl) showL(e.wl, visible);
    e.g.userData.mat.color.set(color);
    const k = thick ? 1.9 : 1;
    e.g.userData.cyl.scale.set(k, 1, k);
  }
  const vcol = (gv, n, c, g) => { gv.vm[n].material.color.set(c); glow(gv.vm[n], g); };
  function lift(gv, n, h) { const m = gv.vm[n]; m.position.y = (gv.y0 ?? 0.3) + h; }

  // 走訪快照（DFS 遞迴 / BFS queue）
  function travSteps(G, root, kind, order) {
    const A = adjOf(G, order), steps = [], vis = new Set(), tree = [], lvl = {}, ds = [], tin = {};
    const snap = (msg, ex = {}) => steps.push({ msg, vis: [...vis], tree: tree.slice(), ds: ds.slice(), lvl: { ...lvl }, cur: ex.cur ?? null, chk: ex.chk ?? -1, final: !!ex.final, roots: ex.roots });
    const roots = [];
    const startList = root ? [root, ...G.V.filter((v) => v !== root)] : G.V.slice();
    for (const r0 of startList) {
      if (vis.has(r0)) continue;
      if (roots.length && !G.dir) break;
      roots.push(r0);
      vis.add(r0); lvl[r0] = 0; ds.push(r0);
      snap(roots.length > 1 ? '回不到新點了：另起一棵樹，根 = ' + r0 : '選 ' + r0 + ' 當根', { cur: r0 });
      if (kind === 'dfs') {
        const visit = (v) => {
          for (const { to, i } of A[v]) {
            if (vis.has(to)) continue;
            vis.add(to); tree.push(i); lvl[to] = lvl[v] + 1; ds.push(to);
            snap(v + ' → ' + to + '：新頂點，接上樹邊', { cur: to, chk: i });
            visit(to);
            ds.pop();
            snap(to + ' 走不下去了 → 回溯到 ' + v, { cur: v });
          }
        };
        visit(r0); ds.pop();
      } else {
        while (ds.length) {
          const v = ds.shift();
          snap('從 L 取出 ' + v + '（level ' + lvl[v] + '）', { cur: v });
          for (const { to, i } of A[v]) {
            if (vis.has(to)) continue;
            vis.add(to); tree.push(i); lvl[to] = lvl[v] + 1; ds.push(to);
            snap(v + ' — ' + to + '：加到 level ' + lvl[to] + '，放進 L 尾端', { cur: v, chk: i });
          }
        }
      }
    }
    snap((G.dir ? '完成：spanning forest，' + roots.length + ' 棵樹' : '完成：' + G.V.length + ' 個頂點、' + tree.length + ' 條樹邊'), { final: true, roots });
    return steps;
  }
  function paintTrav(gv, st, showLvl) {
    const tree = new Set(st.tree);
    gv.G.V.forEach((n) => vcol(gv, n, st.vis.includes(n) ? COL.vis : COL.idle, n === st.cur ? '#8a6400' : null));
    gv.em.forEach((e, i) => {
      if (i === st.chk) paintEdge(e, COL.hot, true);
      else if (tree.has(i)) paintEdge(e, COL.tree, true);
      else paintEdge(e, st.final ? COL.dim : COL.edge, false);
    });
    if (showLvl) {
      gv.lv = gv.lv || {};
      gv.G.V.forEach((n) => {
        if (!gv.lv[n]) { const p = gv.pos(n); gv.lv[n] = tag('', 'idx', p.x + 0.45, p.y + 0.55, p.z - 0.3); }
        txt(gv.lv[n], st.lvl[n] !== undefined && st.vis.includes(n) ? 'L' + st.lvl[n] : '');
      });
    }
  }

  // 圖例資料
  const EX1 = parseG({ a: [-3, -2.2], b: [-1, -2.2], c: [1, -2.2], d: [3, -2.2], e: [-3, 0.8], f: [-1, 0.8], g: [0.6, 2.4] }, 'a-b b-f a-e e-f e-g f-g c-f c-g c-d');
  const DFSG = parseG({ a: [-4.4, -1.8], b: [-4.4, 0.8], c: [-2.8, -0.4], d: [-1.3, 1.9], e: [-1.3, -1.9], f: [0.2, 0], g: [1.6, -1.9], h: [2.8, 0.2], i: [2.6, 2.3], j: [4.5, -1.7], k: [4.4, 0.6] }, 'f-g g-h h-k k-j h-i f-d d-e e-c c-a c-b f-e d-c g-j h-j');
  const DFS_ORDER = { f: 'gde', g: 'fhj', h: 'gkij', k: 'hj', j: 'khg', i: 'h', d: 'fec', e: 'dcf', c: 'eabd', a: 'c', b: 'c' };
  const BFSG = parseG({ a: [-4.5, -2.5], b: [-1.5, -2.5], c: [1.5, -2.5], d: [-4.5, -0.7], e: [-1.5, -0.7], f: [1.5, -0.7], g: [4.5, -0.7], h: [-4.5, 1.1], i: [-1.5, 1.1], j: [1.5, 1.1], l: [4.5, 1.1], k: [-3, 2.7], m: [-0.5, 2.7] }, 'e-b e-d e-f e-i b-a b-c d-a d-h f-c f-g f-j i-j i-k i-h g-l g-j k-h k-m');
  const DIRG = parseG({ a: [-4.5, -2.2], b: [-1.5, -2.2], c: [1.5, -2.2], d: [4.5, -2.2], e: [-4.5, 0.2], f: [-1.5, 0.2], g: [1.5, 0.2], h: [4.5, 0.2], i: [-4.5, 2.6], j: [-1.5, 2.6], k: [1.5, 2.6], l: [4.5, 2.6] }, 'e>a a>b b>c d>c c>g b>f f>e d>h h>l l>k k>j i>j i>e j>g');
  const EXR = parseG({ a: [-4, -1.6], d: [-4, 1.6], b: [-1, 0], c: [2.4, -1.6], e: [2.4, 1.6] }, 'a-b b-d d-a b-c c-e e-b');
  const WG = parseG({ a: [-4.2, 0], b: [-1.5, -2.2], c: [-1.5, 2.2], d: [1.5, -2.2], e: [1.5, 2.2], f: [4.2, 0] }, 'a-b:4 a-c:1 b-c:3 b-d:2 c-d:7 c-e:5 d-e:6 d-f:9 e-f:8');
  const CLRS = parseG({ s: [-4.5, 0], t: [-1.2, -2.2], x: [2.8, -2.2], y: [-1.2, 2.2], z: [2.8, 2.2] }, 's>t:10 s>y:5 t>x:1 t>y:2 y>t:3 y>x:9 y>z:2 x>z:4 z>x:6 z>s:7');

  function randConnected(n, extra, weighted) {
    const names = 'abcdefgh'.slice(0, n).split('');
    const P = ringP(names, 3, Math.PI / 2 + Math.random());
    const has = new Set(), E = [];
    const add = (u, v) => { const k = [u, v].sort().join('-'); if (u === v || has.has(k)) return false; has.add(k); E.push(k + (weighted ? ':' + (1 + rnd(12)) : '')); return true; };
    const p = shuffle(names.slice());
    for (let i = 1; i < n; i++) add(p[i], p[rnd(i)]);
    let t = 0; while (extra > 0 && t++ < 200) if (add(pick(names), pick(names))) extra--;
    if (weighted) { const ws = shuffle([...Array(20).keys()].map((x) => x + 1)); E.forEach((s, i) => { E[i] = s.split(':')[0] + ':' + ws[i]; }); }
    return parseG(P, E.join(' '));
  }

  // 生成樹列舉（小圖）：所有 n−1 條邊、無 cycle 的子集
  function spanningTrees(G) {
    const n = G.V.length, m = G.E.length, out = [];
    const rec = (start, chosen) => {
      if (chosen.length === n - 1) { if (acyclic(G, chosen)) out.push(chosen.slice()); return; }
      for (let i = start; i < m; i++) { chosen.push(i); rec(i + 1, chosen); chosen.pop(); }
    };
    rec(0, []);
    return out;
  }
  function makeDSU(V) { const p = Object.fromEntries(V.map((v) => [v, v])); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x]))); return { f, u(a, b) { a = f(a); b = f(b); if (a === b) return false; p[a] = b; return true; } }; }
  function acyclic(G, idxs) { const d = makeDSU(G.V); return idxs.every((i) => d.u(G.E[i].u, G.E[i].v)); }

  // Kruskal / Prim / Dijkstra 快照
  function kruskalSteps(G) {
    const order = G.E.map((e, i) => i).sort((a, b) => G.E[a].w - G.E[b].w);
    const d = makeDSU(G.V), T = [], rej = [], steps = [];
    steps.push({ T: [], rej: [], chk: -1, msg: '邊依權重排序：' + order.map((i) => G.E[i].w).join(' ≤ ') });
    for (const i of order) {
      const e = G.E[i];
      if (T.length === G.V.length - 1) break;
      const ok = d.u(e.u, e.v);
      if (ok) T.push(i); else rej.push(i);
      steps.push({ T: T.slice(), rej: rej.slice(), chk: i, ok, msg: '{' + e.u + ',' + e.v + '} = ' + e.w + (ok ? '：連接兩個不同的樹 → 收' : '：兩端已經連通，會形成 cycle → 丟') });
    }
    const W = T.reduce((s, i) => s + G.E[i].w, 0);
    steps.push({ T: T.slice(), rej: rej.slice(), chk: -1, final: true, msg: '完成：' + T.length + ' 條邊，總權重 ' + W });
    return steps;
  }
  function primSteps(G, r) {
    const inT = new Set([r]), T = [], steps = [];
    const cands = () => G.E.map((e, i) => i).filter((i) => inT.has(G.E[i].u) !== inT.has(G.E[i].v));
    steps.push({ inT: [...inT], T: [], cand: cands(), chk: -1, msg: '從 ' + r + ' 開始：樹裡只有一個點' });
    while (inT.size < G.V.length) {
      const cs = cands(); if (!cs.length) break;
      const i = cs.reduce((a, b) => (G.E[b].w < G.E[a].w ? b : a));
      const e = G.E[i]; const nv = inT.has(e.u) ? e.v : e.u;
      steps.push({ inT: [...inT], T: T.slice(), cand: cs, chk: i, msg: '跨出樹的邊裡最小：{' + e.u + ',' + e.v + '} = ' + e.w });
      inT.add(nv); T.push(i);
      steps.push({ inT: [...inT], T: T.slice(), cand: cands(), chk: -1, msg: '把 ' + nv + ' 拉進樹' });
    }
    const W = T.reduce((s, i) => s + G.E[i].w, 0);
    steps.push({ inT: [...inT], T: T.slice(), cand: [], chk: -1, final: true, msg: '完成：總權重 ' + W });
    return steps;
  }
  function dijkstraSteps(G, s) {
    const A = adjOf(G), dist = Object.fromEntries(G.V.map((v) => [v, Infinity])), pred = {}, S = [], steps = [];
    dist[s] = 0;
    const snap = (msg, ex = {}) => steps.push({ msg, dist: { ...dist }, pred: { ...pred }, S: S.slice(), cur: ex.cur ?? null, chk: ex.chk ?? -1, final: !!ex.final });
    snap('d(' + s + ') = 0，其他 ∞');
    while (S.length < G.V.length) {
      const u = G.V.filter((v) => !S.includes(v)).reduce((a, b) => (dist[b] < dist[a] ? b : a));
      if (dist[u] === Infinity) break;
      S.push(u);
      snap('未確定的點裡 d 最小：' + u + '（' + dist[u] + '）→ 確定', { cur: u });
      for (const { to, i } of A[u]) {
        if (S.includes(to)) continue;
        const nd = dist[u] + G.E[i].w;
        if (nd < dist[to]) { const old = dist[to]; dist[to] = nd; pred[to] = i; snap('relax (' + u + ',' + to + ')：' + dist[u] + ' + ' + G.E[i].w + ' = ' + nd + ' < ' + (old === Infinity ? '∞' : old), { cur: u, chk: i }); }
        else snap('relax (' + u + ',' + to + ')：' + dist[u] + ' + ' + G.E[i].w + ' = ' + nd + ' ≥ ' + dist[to] + '，不變', { cur: u, chk: i });
      }
    }
    snap('完成：' + G.V.map((v) => 'd(' + v + ')=' + dist[v]).join('，'), { final: true });
    return steps;
  }
  const fmtD = (d) => (d === Infinity ? '∞' : String(d));

  // 著色：把 V 分成 k 個 independent set 的方法數 a_k → P(G,λ) = Σ a_k·λ(λ−1)…(λ−k+1)
  function colorClasses(G) {
    const n = G.V.length, idx = Object.fromEntries(G.V.map((v, i) => [v, i]));
    const adj = G.V.map(() => new Set());
    G.E.forEach((e) => { adj[idx[e.u]].add(idx[e.v]); adj[idx[e.v]].add(idx[e.u]); });
    const a = new Array(n + 1).fill(0), blk = [];
    (function rec(i) {
      if (i === n) { a[blk.length]++; return; }
      for (const B of blk) if (!B.some((j) => adj[i].has(j))) { B.push(i); rec(i + 1); B.pop(); }
      blk.push([i]); rec(i + 1); blk.pop();
    })(0);
    return a;
  }
  const fallF = (L, k) => { let p = 1; for (let i = 0; i < k; i++) p *= L - i; return p; };
  const chromP = (a, L) => a.reduce((s, c, k) => s + c * fallF(L, k), 0);
  const chi = (a) => a.findIndex((c) => c > 0);
  function polyStr(a) {
    let coef = [0];
    a.forEach((c, k) => {
      if (!c) return;
      let p = [1];
      for (let i = 0; i < k; i++) { const q = new Array(p.length + 1).fill(0); p.forEach((x, j) => { q[j + 1] += x; q[j] -= i * x; }); p = q; }
      p.forEach((x, j) => { coef[j] = (coef[j] || 0) + c * x; });
    });
    const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
    let s = '';
    for (let j = coef.length - 1; j >= 1; j--) {
      const c = coef[j] || 0; if (!c) continue;
      const ab = Math.abs(c);
      s += (s ? (c < 0 ? ' − ' : ' + ') : (c < 0 ? '−' : '')) + (ab === 1 ? '' : ab) + 'λ' + (j > 1 ? sup(j) : '');
    }
    return s || '0';
  }
  function greedyColor(G, order) {
    const A = adjOf(G), col = {};
    for (const v of order || G.V) { const used = new Set(A[v].map((x) => col[x.to])); let c = 0; while (used.has(c)) c++; col[v] = c; }
    return col;
  }

  // 平面圖：用直線嵌入找出所有 face（half-edge 走訪：bounded face 面積 > 0，外面那塊 ≤ 0）
  function facesOf(G, idxs) {
    const nb = Object.fromEntries(G.V.map((v) => [v, []]));
    (idxs || G.E.map((e, i) => i)).forEach((i) => { const e = G.E[i]; nb[e.u].push(e.v); nb[e.v].push(e.u); });
    const ang = (u, v) => Math.atan2(G.P[v][1] - G.P[u][1], G.P[v][0] - G.P[u][0]);
    for (const v of G.V) nb[v].sort((p, q) => ang(v, p) - ang(v, q));
    const used = new Set(), faces = [];
    for (const u of G.V) for (const v of nb[u]) {
      if (used.has(u + '>' + v)) continue;
      const cyc = []; let a = u, b = v, guard = 0;
      while (!used.has(a + '>' + b) && guard++ < 200) {
        used.add(a + '>' + b); cyc.push(a);
        const L = nb[b], k = L.indexOf(a);
        const w = L[(k - 1 + L.length) % L.length];
        a = b; b = w;
      }
      let area = 0;
      cyc.forEach((p, i) => { const q = cyc[(i + 1) % cyc.length]; area += G.P[p][0] * G.P[q][1] - G.P[q][0] * G.P[p][1]; });
      faces.push({ cyc, area: area / 2 });
    }
    if (!faces.length) faces.push({ cyc: [], area: 0 });
    return faces;
  }
  function faceMesh(G, cyc, color, s = 1, ox = 0, oz = 0) {
    const sh = new THREE.Shape(cyc.map((n) => new THREE.Vector2(ox + G.P[n][0] * s, -(oz + G.P[n][1] * s))));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.06;
    lab.world.add(m);
    return m;
  }

  // ───────────────────────── 模式 1：生成樹（DFS / BFS） ─────────────────────────
  const run = { steps: [], i: 0, apply: null };
  function startRun(steps, apply) { stopTimer(); run.steps = steps; run.i = 0; run.apply = apply; apply(steps[0]); }
  function nextStep() {
    if (!run.apply) return;
    if (run.i >= run.steps.length - 1) { log('已經走完了，按「重來」或換設定。', true); stopTimer(); return; }
    run.i++; run.apply(run.steps[run.i]);
  }
  function autoRun(ms = 650) { stopTimer(); timer = setInterval(() => { if (run.i >= run.steps.length - 1) stopTimer(); else nextStep(); }, ms); }
  const stepButtons = '<button class="primary" id="xNext">下一步</button><button id="xAuto">自動</button><button id="xReset">重來</button>';

  const span = { g: 'dfs', alg: 'dfs', root: 'f' };
  const SPAN_G = { dfs: () => DFSG, bfs: () => BFSG, dir: () => DIRG, rand: () => randConnected(7, 4) };
  function enterSpan() {
    fresh([0, 10, 8.6], [0, 0, 0.2]);
    let G = SPAN_G[span.g]();
    if (span.g === 'dir') span.alg = 'dfs';
    if (!G.V.includes(span.root)) span.root = G.V[0];
    controls('<select id="sG"><option value="dfs">影片 DFS 例（a–k）</option><option value="bfs">影片 BFS 例（a–m）</option><option value="dir">有向圖（spanning forest）</option><option value="rand">隨機連通圖</option></select>'
      + '<select id="sA"><option value="dfs">DFS</option><option value="bfs">BFS</option></select>'
      + '<label>根 <select id="sR">' + G.V.map((v) => '<option>' + v + '</option>').join('') + '</select></label>' + stepButtons);
    $('sG').value = span.g; $('sA').value = span.alg; $('sR').value = span.root;
    $('sG').onchange = (e) => { span.g = e.target.value; span.root = { dfs: 'f', bfs: 'e', dir: 'a' }[span.g] || 'a'; enterSpan(); };
    $('sA').onchange = (e) => { if (span.g === 'dir' && e.target.value === 'bfs') { log('有向圖這裡示範 DFS spanning forest（影片的例子）。', true); e.target.value = 'dfs'; return; } span.alg = e.target.value; enterSpan(); };
    $('sR').onchange = (e) => { span.root = e.target.value; enterSpan(); };
    const gv = drawGraph(G);
    const order = span.g === 'dfs' ? DFS_ORDER : null;
    const steps = travSteps(G, span.root, span.alg, order);
    startRun(steps, (st) => {
      paintTrav(gv, st, span.alg === 'bfs');
      setState((span.alg === 'dfs' ? 'DFS' : 'BFS') + ' 生成' + (G.dir ? '森林' : '樹'), [
        ['已拜訪', st.vis.length + ' / ' + G.V.length], ['樹邊', String(st.tree.length)], [span.alg === 'dfs' ? '路徑（stack）' : 'L（queue）', st.ds.join(' ') || '—']],
        st.final ? (G.dir ? '有向圖不一定一棵樹走得完 → <span class="ok">spanning forest</span>' : '<span class="ok">n 個點 → n − 1 條樹邊</span>；淡色的是沒用到的邊（DFS 中都是 back edge）') : st.msg);
      log(st.msg);
    });
    on('xNext', nextStep); on('xAuto', () => autoRun()); on('xReset', enterSpan);
    log((span.alg === 'dfs' ? 'DFS：一路往沒去過的點走，走不動就回溯。' : 'BFS：先把根的鄰居全接上（level 1），再處理 level 1 的鄰居……') + (span.g === 'dfs' ? '（鄰居順序照影片的走法）' : '（鄰居依字母順序）'));
  }

  // ───────────────────────── 模式 2：最小生成樹 ─────────────────────────
  const mst = { g: 'book', alg: 'kruskal', root: 'a', G: null };
  function enterMST(regen) {
    fresh([0, 10, 8.4], [0, 0, 0.2]);
    if (!mst.G || regen) mst.G = mst.g === 'book' ? WG : randConnected(7, 5, true);
    const G = mst.G;
    controls('<select id="mG"><option value="book">範例圖（a–f）</option><option value="rand">隨機加權圖</option></select><select id="mA"><option value="kruskal">Kruskal</option><option value="prim">Prim</option></select>' + stepButtons);
    $('mG').value = mst.g; $('mA').value = mst.alg;
    $('mG').onchange = (e) => { mst.g = e.target.value; enterMST(true); };
    $('mA').onchange = (e) => { mst.alg = e.target.value; enterMST(); };
    const gv = drawGraph(G);
    const steps = mst.alg === 'kruskal' ? kruskalSteps(G) : primSteps(G, G.V[0]);
    startRun(steps, (st) => {
      const T = new Set(st.T);
      if (mst.alg === 'kruskal') {
        const d = makeDSU(G.V); st.T.forEach((i) => d.u(G.E[i].u, G.E[i].v));
        const roots = [...new Set(G.V.map(d.f))];
        G.V.forEach((v) => vcol(gv, v, COMP[roots.indexOf(d.f(v)) % COMP.length], null));
        gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? (st.ok ? COL.vis : COL.hot) : T.has(i) ? COL.tree : st.rej.includes(i) ? COL.dim : COL.edge, i === st.chk || T.has(i)));
      } else {
        G.V.forEach((v) => vcol(gv, v, st.inT.includes(v) ? COL.vis : COL.idle, null));
        gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? COL.hot : T.has(i) ? COL.tree : st.cand.includes(i) ? COL.blue : st.final ? COL.dim : COL.edge, i === st.chk || T.has(i)));
      }
      const W = st.T.reduce((s, i) => s + G.E[i].w, 0);
      setState(mst.alg === 'kruskal' ? 'Kruskal：由小到大挑邊、不成 cycle' : 'Prim：每次挑跨出樹的最小邊', [['已選邊', st.T.length + ' / ' + (G.V.length - 1)], ['目前總權重', String(W)]],
        st.final ? '<span class="ok">MST 總權重 = ' + W + '</span>（Kruskal 和 Prim 一定一樣）' : st.msg + (mst.alg === 'prim' ? '<br>藍色 = 跨出樹的候選邊' : '<br>顏色 = 目前各自的樹（forest）'));
      log(st.msg);
    });
    on('xNext', nextStep); on('xAuto', () => autoRun(900)); on('xReset', () => enterMST());
    log(mst.alg === 'kruskal' ? 'Kruskal：所有邊排序，從小挑起；兩端已連通就丟掉（會成 cycle）。' : 'Prim：從一個點長出去，每次接上「一端在樹內、一端在樹外」的最小邊。');
  }

  // ───────────────────────── 模式 3：最短路徑 Dijkstra ─────────────────────────
  const sp = { g: 'clrs', src: 's', G: null };
  function enterSP(regen) {
    fresh([0, 10, 8.4], [0, 0, 0.2]);
    if (!sp.G || regen) sp.G = sp.g === 'clrs' ? CLRS : randConnected(6, 4, true);
    const G = sp.G;
    if (!G.V.includes(sp.src)) sp.src = G.V[0];
    controls('<select id="pG"><option value="clrs">CLRS 有向圖（s,t,x,y,z）</option><option value="rand">隨機無向加權圖</option></select><label>起點 <select id="pS">' + G.V.map((v) => '<option>' + v + '</option>').join('') + '</select></label>' + stepButtons);
    $('pG').value = sp.g; $('pS').value = sp.src;
    $('pG').onchange = (e) => { sp.g = e.target.value; enterSP(true); };
    $('pS').onchange = (e) => { sp.src = e.target.value; enterSP(); };
    const gv = drawGraph(G);
    const dl = Object.fromEntries(G.V.map((v) => { const p = gv.pos(v); return [v, tag('∞', 'ptr alt', p.x, p.y + 0.85, p.z)]; }));
    startRun(dijkstraSteps(G, sp.src), (st) => {
      const pe = new Set(Object.values(st.pred));
      G.V.forEach((v) => { vcol(gv, v, st.S.includes(v) ? COL.vis : COL.idle, v === st.cur ? '#8a6400' : null); txt(dl[v], fmtD(st.dist[v])); });
      gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? COL.hot : pe.has(i) ? COL.tree : st.final ? COL.dim : COL.edge, i === st.chk || pe.has(i)));
      setState('Dijkstra（起點 ' + sp.src + '）', G.V.map((v) => ['d(' + v + ')', fmtD(st.dist[v]) + (st.S.includes(v) ? ' ✓' : '')]),
        st.final ? '<span class="ok">金色邊 = 最短路徑樹</span>；邊權不能是負的' : st.msg);
      log(st.msg);
    });
    on('xNext', nextStep); on('xAuto', () => autoRun(800)); on('xReset', () => enterSP());
    log('Dijkstra：每次從還沒確定的點挑 d 最小的確定下來，再 relax 它出去的邊。');
  }

  // ───────────────────────── 模式 4：著色與色多項式 ─────────────────────────
  const MAPD = parseG({ A: [-0.8, -1.6], B: [1.6, -0.8], C: [-0.8, 0], D: [-1.6, 1.6], E: [0.8, 1.6] }, 'A-B A-C B-C B-E C-D C-E D-E');
  const K4X = parseG({ A: [-2, -2], B: [2, -2], C: [2, 2], D: [-2, 2] }, 'A-B B-C C-D D-A A-C B-D');
  const COLOR_G = {
    map: () => parseG({ A: [-1.6, -3.2], B: [3.2, -1.6], C: [-1.6, 0], D: [-3.2, 3.2], E: [1.6, 3.2] }, MAPD.E.map((e) => e.u + '-' + e.v).join(' ')),
    c5: () => parseG(ringP(['a', 'b', 'c', 'd', 'e'], 3), 'a-b b-c c-d d-e e-a'),
    c6: () => parseG(ringP(['a', 'b', 'c', 'd', 'e', 'f'], 3), 'a-b b-c c-d d-e e-f f-a'),
    k4: () => parseG(ringP(['a', 'b', 'c', 'd'], 3, Math.PI / 4), 'a-b a-c a-d b-c b-d c-d'),
    w5: () => parseG({ o: [0, 0], ...ringP(['a', 'b', 'c', 'd', 'e'], 3) }, 'a-b b-c c-d d-e e-a o-a o-b o-c o-d o-e'),
    k33: () => parseG({ a: [-3, -2.4], b: [-3, 0], c: [-3, 2.4], x: [3, -2.4], y: [3, 0], z: [3, 2.4] }, 'a-x a-y a-z b-x b-y b-z c-x c-y c-z'),
    pet: () => parseG({ ...ringP(['0', '1', '2', '3', '4'], 3.2), ...ringP(['5', '6', '7', '8', '9'], 1.5) }, '0-1 1-2 2-3 3-4 4-0 0-5 1-6 2-7 3-8 4-9 5-7 7-9 9-6 6-8 8-5'),
    tree: () => parseG({ a: [0, -2.6], b: [-2.4, -0.6], c: [2.4, -0.6], d: [-3.6, 1.8], e: [-1.2, 1.8], f: [2.4, 1.8] }, 'a-b a-c b-d b-e c-f'),
  };
  const colm = { g: 'map', col: {}, sel: null };
  function enterColor() {
    fresh([0, 10, 8.4], [0, 0, 0.2]);
    const G = colm.G = COLOR_G[colm.g]();
    colm.col = {};
    controls('<select id="cG"><option value="map">影片地圖的對偶圖</option><option value="c5">C₅</option><option value="c6">C₆</option><option value="k4">K₄</option><option value="w5">Wheel W₅</option><option value="k33">K₃,₃</option><option value="pet">Petersen</option><option value="tree">樹（6 點）</option></select>'
      + '<select id="cV">' + G.V.map((v) => '<option>' + v + '</option>').join('') + '</select><select id="cC">' + CN.map((c, i) => '<option value="' + i + '">' + c + '</option>').join('') + '</select>'
      + '<button class="primary" id="cPaint">塗上</button><button id="cGreedy">Greedy</button><button id="cBest">最少色</button><button id="cClear">清空</button><label>λ = <input id="cL" type="number" min="1" max="8" value="3" style="width:52px"></label>');
    $('cG').value = colm.g;
    $('cG').onchange = (e) => { colm.g = e.target.value; enterColor(); };
    const gv = colm.gv = drawGraph(G);
    const a = colm.a = colorClasses(G);
    const A = adjOf(G);
    const paint = () => {
      G.V.forEach((v) => vcol(gv, v, colm.col[v] === undefined ? COL.idle : CC[colm.col[v]], null));
      const bad = G.E.map((e, i) => i).filter((i) => colm.col[G.E[i].u] !== undefined && colm.col[G.E[i].u] === colm.col[G.E[i].v]);
      gv.em.forEach((e, i) => paintEdge(e, bad.includes(i) ? COL.hot : COL.edge, bad.includes(i)));
      const used = new Set(Object.values(colm.col)).size, done = Object.keys(colm.col).length === G.V.length;
      const L = Math.max(1, Math.min(8, Number($('cL').value) || 3));
      setState('著色：相鄰頂點不同色', [['已塗', Object.keys(colm.col).length + ' / ' + G.V.length], ['用了幾色', String(used)], ['χ(G)', String(chi(a))], ['P(G,' + L + ')', String(chromP(a, L))]],
        'P(G,λ) = ' + polyStr(a) + '<br>' + (bad.length ? '<span class="no">有 ' + bad.length + ' 條邊兩端同色</span>' : done ? (used === chi(a) ? '<span class="ok">合法，而且是最少色數</span>' : '<span class="ok">合法</span>，但還能更少（χ = ' + chi(a) + '）') : '選頂點與顏色，按「塗上」'));
    };
    on('cPaint', () => {
      const v = $('cV').value, c = Number($('cC').value);
      if (!A[v] || !(c >= 0 && c < CC.length)) { log('先選一個頂點和顏色。', true); return; }
      const clash = A[v].find((x) => colm.col[x.to] === c);
      colm.col[v] = c;
      if (clash) log(v + ' 塗' + CN[c] + '，但鄰居 ' + clash.to + ' 也是' + CN[c] + ' → 不合法（相鄰要不同色）', true);
      else log(v + ' 塗' + CN[c]);
      paint();
    });
    on('cGreedy', () => { colm.col = greedyColor(G); log('Greedy：依 ' + G.V.join(',') + ' 的順序，每點選最小可用色 → 用了 ' + new Set(Object.values(colm.col)).size + ' 色（不保證最少）'); paint(); });
    on('cBest', () => { colm.col = bestColoring(G); log('用 χ(G) = ' + chi(a) + ' 色塗完。'); paint(); });
    on('cClear', () => { colm.col = {}; paint(); });
    $('cL').oninput = paint;
    log('χ(G)：最少要幾色。P(G,λ)：用 λ 色合法塗法有幾種；χ(G) = 讓 P(G,λ) > 0 的最小 λ。');
    paint();
  }
  function bestColoring(G) {
    const A = adjOf(G), k = chi(colorClasses(G)), col = {};
    const rec = (i) => { if (i === G.V.length) return true; const v = G.V[i]; for (let c = 0; c < k; c++) { if (A[v].some((x) => col[x.to] === c)) continue; col[v] = c; if (rec(i + 1)) return true; delete col[v]; } return false; };
    rec(0); return col;
  }

  // ───────────────────────── 模式 5：平面圖與 Euler 公式 ─────────────────────────
  const PLANAR = {
    k4: { name: 'K₄', planar: true, G: () => parseG({ a: [0, -3], b: [-2.8, 2], c: [2.8, 2], d: [0, 0.4] }, 'a-b b-c c-a a-d b-d c-d') },
    cube: { name: '立方體 Q₃', planar: true, G: () => parseG({ a: [-3, -3], b: [3, -3], c: [3, 3], d: [-3, 3], e: [-1.2, -1.2], f: [1.2, -1.2], g: [1.2, 1.2], h: [-1.2, 1.2] }, 'a-b b-c c-d d-a e-f f-g g-h h-e a-e b-f c-g d-h') },
    prism: { name: '三角柱', planar: true, G: () => parseG({ a: [0, -3.2], b: [-3, 2.2], c: [3, 2.2], d: [0, -1], e: [-1.1, 0.8], f: [1.1, 0.8] }, 'a-b b-c c-a d-e e-f f-d a-d b-e c-f') },
    w5: { name: 'Wheel W₅', planar: true, G: () => COLOR_G.w5() },
    octa: { name: '八面體', planar: true, G: () => parseG({ a: [0, -3.2], b: [-3, 2.2], c: [3, 2.2], d: [0, 1.3], e: [1.1, -0.6], f: [-1.1, -0.6] }, 'a-b b-c c-a d-e e-f f-d a-e a-f b-f b-d c-d c-e') },
    k5: { name: 'K₅', planar: false, G: () => parseG(ringP(['a', 'b', 'c', 'd', 'e'], 3), 'a-b a-c a-d a-e b-c b-d b-e c-d c-e d-e') },
    k33: { name: 'K₃,₃', planar: false, G: () => COLOR_G.k33() },
    pet: { name: 'Petersen', planar: false, G: () => COLOR_G.pet() },
  };
  const girthOf = (G) => {
    let best = Infinity; const A = adjOf(G);
    for (const s of G.V) {
      const d = { [s]: 0 }, par = { [s]: null }, q = [s];
      while (q.length) { const u = q.shift(); for (const { to } of A[u]) { if (d[to] === undefined) { d[to] = d[u] + 1; par[to] = u; q.push(to); } else if (par[u] !== to) best = Math.min(best, d[u] + d[to] + 1); } }
    }
    return best;
  };
  const pl = { k: 'cube' };
  function enterPlanar() {
    fresh([0, 10, 8], [0, 0, 0]);
    const P = PLANAR[pl.k], G = P.G();
    controls('<select id="qG">' + Object.keys(PLANAR).map((k) => '<option value="' + k + '">' + PLANAR[k].name + '</option>').join('') + '</select><button class="primary" id="qFace">逐一數 face</button>');
    $('qG').value = pl.k;
    $('qG').onchange = (e) => { pl.k = e.target.value; enterPlanar(); };
    drawGraph(G);
    const v = G.V.length, e = G.E.length, g = girthOf(G);
    const bound = g >= 4 ? Math.floor(g * (v - 2) / (g - 2)) : 3 * v - 6;
    const faces = P.planar ? facesOf(G).filter((f) => f.area > 1e-6) : [];
    const rows = [['v（頂點）', String(v)], ['e（邊）', String(e)], ['girth（最短 cycle）', String(g)], [g >= 4 ? 'e ≤ g(v−2)/(g−2)' : 'e ≤ 3v − 6', e + ' ≤ ' + bound + (e <= bound ? ' ✓' : ' ✗')]];
    if (P.planar) rows.push(['f（含外面那塊）', String(faces.length + 1)]);
    setState(P.name + (P.planar ? '：平面圖' : '：非平面圖'), rows,
      P.planar ? 'v − e + f = ' + v + ' − ' + e + ' + ' + (faces.length + 1) + ' = <span class="ok">' + (v - e + faces.length + 1) + '</span>'
        : (e > bound ? '<span class="no">e = ' + e + ' > ' + bound + '</span> → 一定不是平面圖' : '不等式沒被違反，但仍不是平面圖（含 K₅ / K₃,₃ 的 subdivision，Kuratowski）'));
    on('qFace', async () => {
      if (!P.planar) { log('非平面圖畫不出沒有交叉的圖，數不了 face。', true); return; }
      for (let i = 0; i < faces.length; i++) { faceMesh(G, faces[i].cyc, COMP[i % COMP.length]); log('face ' + (i + 1) + '：' + faces[i].cyc.join('–')); await sleep(450); }
      log('外面無限大那塊也算一個 face → f = ' + (faces.length + 1));
    });
    log(P.planar ? '連通平面圖：v − e + f = 2。按「逐一數 face」。' : '簡單平面圖必滿足 e ≤ 3v − 6（無三角形時 e ≤ 2v − 4）；違反就一定不是平面圖。');
  }

  // ───────────────────────── 模式 6：二分圖匹配與 Hall ─────────────────────────
  const BIP = {
    ok: 'x1-y1 x1-y2 x2-y1 x3-y2 x3-y3 x4-y3 x4-y4',
    hall: 'x1-y1 x2-y1 x2-y2 x3-y1 x3-y2 x4-y3 x4-y4',
  };
  const bipP = () => ({ x1: [-3, -2.7], x2: [-3, -0.9], x3: [-3, 0.9], x4: [-3, 2.7], y1: [3, -2.7], y2: [3, -0.9], y3: [3, 0.9], y4: [3, 2.7] });
  function randBip() {
    const E = new Set();
    ['x1', 'x2', 'x3', 'x4'].forEach((x) => { const k = 1 + rnd(2); for (let t = 0; t < k; t++) E.add(x + '-y' + (1 + rnd(4))); });
    return [...E].join(' ');
  }
  function matchSteps(G) {
    const X = G.V.filter((v) => v[0] === 'x'), A = adjOf(G), mate = {}, steps = [];
    const M = () => G.E.map((e, i) => i).filter((i) => mate[G.E[i].u] === G.E[i].v);
    steps.push({ M: [], path: [], msg: '一開始 M = ∅' });
    for (const x of X) {
      // BFS 找交錯路徑：x →(非匹配邊) y →(匹配邊) x' …
      const prev = { [x]: null }, q = [x]; let endY = null;
      while (q.length && !endY) {
        const u = q.shift();
        for (const { to } of A[u]) {
          if (prev[to] !== undefined) continue;
          prev[to] = u;
          if (!mate[to]) { endY = to; break; }
          prev[mate[to]] = to; q.push(mate[to]);
        }
      }
      if (!endY) { steps.push({ M: M(), path: [], msg: x + '：找不到 augmenting path → 這輪不增加' }); continue; }
      const pv = []; let c = endY; while (c) { pv.push(c); c = prev[c]; } pv.reverse();
      const path = []; for (let i = 0; i + 1 < pv.length; i++) path.push(G.E.findIndex((e) => (e.u === pv[i] && e.v === pv[i + 1]) || (e.v === pv[i] && e.u === pv[i + 1])));
      steps.push({ M: M(), path, msg: 'augmenting path：' + pv.join(' – ') + (pv.length > 2 ? '（交錯：非匹配／匹配）' : '') });
      for (let i = 0; i + 1 < pv.length; i += 2) { mate[pv[i]] = pv[i + 1]; mate[pv[i + 1]] = pv[i]; }
      steps.push({ M: M(), path: [], msg: '翻轉路徑上的邊 → |M| = ' + M().length });
    }
    steps.push({ M: M(), path: [], final: true, msg: '最大匹配 |M| = ' + M().length + (M().length === X.length ? '：X 全部配到（complete matching）' : '') });
    return steps;
  }
  function hallViolation(G) {
    const X = G.V.filter((v) => v[0] === 'x'), A = adjOf(G);
    for (let mask = 1; mask < 1 << X.length; mask++) {
      const S = X.filter((_, i) => mask >> i & 1), N = new Set(); S.forEach((x) => A[x].forEach((t) => N.add(t.to)));
      if (N.size < S.length) return { S, N: [...N].sort() };
    }
    return null;
  }
  const mt = { k: 'ok', E: null };
  function enterMatch(regen) {
    fresh([0, 10, 8.2], [0, 0, 0]);
    if (!mt.E || regen) mt.E = mt.k === 'rand' ? randBip() : BIP[mt.k];
    const G = parseG(bipP(), mt.E);
    controls('<select id="hG"><option value="ok">有完美匹配的例子</option><option value="hall">違反 Hall 的例子</option><option value="rand">隨機二分圖</option></select>' + stepButtons + '<button id="hHall">檢查 Hall 條件</button>');
    $('hG').value = mt.k;
    $('hG').onchange = (e) => { mt.k = e.target.value; enterMatch(true); };
    const gv = drawGraph(G);
    tag('X', 'ptr', -3, 0.3, -3.8); tag('Y', 'ptr alt', 3, 0.3, -3.8);
    startRun(matchSteps(G), (st) => {
      const M = new Set(st.M), P = new Set(st.path), matched = new Set();
      st.M.forEach((i) => { matched.add(G.E[i].u); matched.add(G.E[i].v); });
      G.V.forEach((v) => vcol(gv, v, matched.has(v) ? COL.vis : COL.idle, null));
      gv.em.forEach((e, i) => paintEdge(e, P.has(i) ? COL.hot : M.has(i) ? COL.tree : COL.edge, P.has(i) || M.has(i)));
      setState('二分圖最大匹配', [['|M|', String(st.M.length)], ['|X|', '4']], st.msg + '<br>金色 = 匹配邊、紅色 = augmenting path');
      log(st.msg);
    });
    on('xNext', nextStep); on('xAuto', () => autoRun(900)); on('xReset', () => enterMatch());
    on('hHall', () => {
      const h = hallViolation(G);
      if (!h) { log('Hall 條件成立：每個 S ⊆ X 都有 |N(S)| ≥ |S| → 一定有 complete matching。'); return; }
      h.S.forEach((v) => glow(gv.vm[v], '#8a1a1a')); h.N.forEach((v) => glow(gv.vm[v], GOLD));
      log('S = {' + h.S.join(',') + '}，N(S) = {' + h.N.join(',') + '}：|N(S)| = ' + h.N.length + ' < |S| = ' + h.S.length + ' → 不可能把 X 全配完', true);
    });
    log('Hall 定理：X 能全部配到 ⇔ 每個 S ⊆ X 都有 |N(S)| ≥ |S|。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  function genQ() {
    const r = Math.random();
    if (r < 0.1) { const n = 5 + rnd(20); return { q: '一棵有 ' + n + ' 個頂點的樹有幾條邊？', opts: [String(n - 1), String(n), String(n + 1), String(n * (n - 1) / 2)], ans: String(n - 1), why: '樹 = 連通且無 cycle，邊數恰為 n − 1；多一條就有 cycle，少一條就不連通。' }; }
    if (r < 0.2) { const n = 3 + rnd(4); const t = Math.pow(n, n - 2); return { q: 'K' + n + ' 有幾棵不同的（labeled）生成樹？', opts: [String(t), String(Math.pow(n, n - 1)), String(fallF(n, n) / 2), String(n * (n - 1) / 2)], ans: String(t), why: 'Cayley 公式：n^(n−2) = ' + n + '^' + (n - 2) + ' = ' + t + '。' }; }
    if (r < 0.32) { const v = 5 + rnd(10), e = v + 1 + rnd(2 * v - 7); return { q: '連通平面圖有 v = ' + v + '、e = ' + e + '，有幾個 face（含外部）？', opts: [String(e - v + 2), String(e - v), String(e - v + 1), String(v - e + 2)], ans: String(e - v + 2), why: 'Euler 公式 v − e + f = 2 → f = e − v + 2 = ' + (e - v + 2) + '。' }; }
    if (r < 0.42) {
      const v = 5 + rnd(6), e = 3 * v - 6 + (Math.random() < 0.5 ? 1 + rnd(3) : -rnd(3));
      const ok = e <= 3 * v - 6;
      return { q: '簡單連通圖 v = ' + v + '、e = ' + e + '，用 e ≤ 3v − 6 能斷定什麼？', opts: ['一定不是平面圖', '一定是平面圖', '無法斷定（不等式只是必要條件）', '一定是二分圖'], ans: ok ? '無法斷定（不等式只是必要條件）' : '一定不是平面圖', why: '3v − 6 = ' + (3 * v - 6) + '。' + (ok ? '滿足不等式不代表是平面圖（例如 K₃,₃、Petersen）。' : 'e 超過上限，一定不是平面圖。') };
    }
    if (r < 0.54) {
      const n = 3 + rnd(8), kind = pick(['C', 'K', 'W']);
      const ans = kind === 'K' ? n : kind === 'C' ? (n % 2 ? 3 : 2) : (n % 2 ? 4 : 3);
      const name = kind === 'K' ? 'K' + n : kind === 'C' ? 'C' + n : 'Wheel W' + n + '（C' + n + ' 加一個中心點）';
      return { q: 'χ(' + name + ') = ？', opts: ['2', '3', '4', String(n)].filter((x, i, a) => a.indexOf(x) === i).concat(n <= 4 ? ['5'] : []).slice(0, 4), ans: String(ans), why: kind === 'K' ? '完全圖每兩點相鄰，要 n 色。' : kind === 'C' ? '偶 cycle 二分 → 2；奇 cycle 要 3。' : '中心點和外圈全部相鄰，要比外圈 C' + n + ' 多一色。' };
    }
    if (r < 0.64) { const n = 3 + rnd(4), L = n + rnd(3); const v = fallF(L, n); return { q: '用 ' + L + ' 種顏色合法塗 K' + n + '，有幾種塗法？', opts: [String(v), String(Math.pow(L, n)), String(L * Math.pow(L - 1, n - 1)), String(v / 2)], ans: String(v), why: 'P(K' + n + ',λ) = λ(λ−1)…(λ−' + (n - 1) + ')，代 λ = ' + L + '。' }; }
    if (r < 0.72) { const n = 4 + rnd(4), L = 2 + rnd(3); const v = L * Math.pow(L - 1, n - 1); return { q: n + ' 個頂點的樹，用 ' + L + ' 色合法著色有幾種？', opts: [String(v), String(fallF(L, Math.min(L, n))), String(Math.pow(L, n)), String(L * (L - 1))], ans: String(v), why: '任何 n 點樹：P(T,λ) = λ(λ−1)^(n−1)。' }; }
    if (r < 0.82) {
      const degs = Array.from({ length: 5 }, () => 1 + rnd(5)); let odd = degs.filter((d) => d % 2).length; if (odd % 2) { degs[0]++; odd = degs.filter((d) => d % 2).length; }
      const ans = odd === 0 ? '有 Euler circuit' : odd === 2 ? '有 Euler trail 但沒有 circuit' : '兩者都沒有';
      return { q: '連通多重圖的度數序列 ' + degs.join(', ') + '，下列何者正確？', opts: ['有 Euler circuit', '有 Euler trail 但沒有 circuit', '兩者都沒有', '無法判斷'], ans, why: '奇度點 ' + odd + ' 個：0 個 → circuit；2 個 → trail（從一個奇點走到另一個）；其他 → 都沒有。' };
    }
    if (r < 0.92) {
      const G = randConnected(5, 3, true); const st = kruskalSteps(G); const W = st[st.length - 1].T.reduce((s, i) => s + G.E[i].w, 0);
      const opts = [...new Set([W, W + 1 + rnd(3), Math.max(1, W - 1 - rnd(3)), G.E.reduce((s, e) => s + e.w, 0)])].map(String);
      while (opts.length < 4) opts.push(String(W + 5 + opts.length));
      return { q: '加權圖邊：' + G.E.map((e) => e.u + e.v + '=' + e.w).join('、') + '。MST 總權重？', opts, ans: String(W), why: 'Kruskal：' + st.filter((s) => s.chk >= 0 && s.ok).map((s) => G.E[s.chk].u + G.E[s.chk].v + '(' + G.E[s.chk].w + ')').join(' → ') + '。' };
    }
    const m = 2 + rnd(3), n = m + rnd(3);
    return { q: 'K' + m + ',' + n + '（' + m + ' ≤ ' + n + '）的最大匹配大小？', opts: [String(m), String(n), String(m + n), String(m * n)], ans: String(m), why: '每條匹配邊用掉小的那邊一個點，最多 min(m,n) = ' + m + '；Hall 條件在小的那邊成立。' };
  }
  // 選項去重；數字題不足 4 個時補上相近的數
  function fixOpts(p) {
    const o = [...new Set(p.opts.map(String))];
    if (!o.includes(p.ans)) o.unshift(p.ans);
    const a = Number(p.ans);
    for (let d = 1; o.length < 4 && Number.isFinite(a) && d < 40; d++) for (const v of [a + d, a - d]) if (o.length < 4 && v >= 0 && !o.includes(String(v))) o.push(String(v));
    return { ...p, opts: o.slice(0, Math.max(4, o.indexOf(p.ans) + 1)) };
  }
  function renderQuiz(el) {
    const p = fixOpts(genQ());
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 場景（跟著影片 + 課本補充） ─────────────────────────
  const CAM = [[0, 10, 8.6], [0, 0, 0.2]];
  async function playSteps(tok, steps, apply, ms, capFn) {
    for (const st of steps) { apply(st); say(capFn ? capFn(st) : st.msg, ''); await beat(tok, st.final ? 2600 : ms); }
  }
  async function circuitFlash(tok, gv, cyc, ms = 1400) {
    const idx = []; for (let i = 0; i < cyc.length; i++) idx.push(gv.find(cyc[i], cyc[(i + 1) % cyc.length]));
    idx.forEach((i) => paintEdge(gv.em[i], COL.hot, true));
    await beat(tok, ms);
    return idx;
  }
  async function removeEdge(tok, e) {
    await anim(tok, 500, (t) => { e.g.scale.set(1, 1, 1); e.g.position.y = t * 1.2; e.g.userData.mat.color.set(COL.hot); });
    e.g.visible = false; e.g.position.y = 0;
  }

  // ─── 6WZvVJ0Q1FA：生成樹定義 + 拿掉 simple circuit ───
  async function scRemoveCircuits(tok) {
    fresh(...CAM);
    const gv = drawGraph(EX1);
    const cnt = tag('', 'ptr alt', 4.6, 0.3, 1.8);
    const upd = (e) => txt(cnt, '7 個頂點、' + e + ' 條邊');
    upd(9);
    say('G 是 simple graph：連通，但不是樹', 'spanning tree = 包含 G 所有頂點、本身是樹的子圖');
    await beat(tok, 3000);
    const steps = [[['a', 'b', 'f', 'e'], 'a', 'e', 'simple circuit a–b–f–e–a → 拿掉 {a,e}'], [['e', 'f', 'g'], 'e', 'f', '還有 e–g–f–e → 拿掉 {e,f}'], [['c', 'f', 'g'], 'c', 'g', '還有 f–c–g–f → 拿掉 {c,g}']];
    let m = 9;
    for (const [cyc, u, v, cap] of steps) {
      say(cap, '拿掉 circuit 上的一條邊，頂點一個都不少');
      const idx = await circuitFlash(tok, gv, cyc);
      await removeEdge(tok, gv.em[gv.find(u, v)]);
      idx.forEach((i) => { if (gv.em[i].g.visible) paintEdge(gv.em[i], COL.edge, false); });
      upd(--m);
      await beat(tok, 900);
    }
    gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.tree, true); });
    EX1.V.forEach((v) => vcol(gv, v, COL.vis));
    say('沒有 simple circuit 了：這就是一棵 spanning tree', '7 個頂點、6 條邊 = n − 1');
    await beat(tok, 2600);
    say('拿哪條邊不唯一：生成樹可以有很多棵', '先拿 {c,g} 或先拿 {e,f} 都可以');
    await beat(tok, 2600);
  }

  // ─── 6WZvVJ0Q1FA：DFS 從 f 出發 ───
  async function scDFS(tok) {
    fresh(...CAM);
    const gv = drawGraph(DFSG);
    const steps = travSteps(DFSG, 'f', 'dfs', DFS_ORDER);
    const stk = tag('', 'ptr alt', 0, 0.3, 3.6);
    say('DFS 建生成樹：任選一點當根，這裡選 f', '一路往「還沒走過」的點走，走不動就 backtrack');
    await beat(tok, 2600);
    await playSteps(tok, steps, (st) => { paintTrav(gv, st); txt(stk, '路徑：' + (st.ds.join(' → ') || '—')); }, 1000);
    say('金色 = tree edges；淡色 = back edges（都連到祖先）', '10 條 tree edge = 11 − 1');
    await beat(tok, 3000);
  }
  async function scDFSCode(tok) {
    fresh([0, 9.5, 9.5], [0, 0.8, 0.6]);
    const gv = drawGraph(DFSG, { s: 0.62, ox: 2.3, oz: 0.6 });
    const lines = ['procedure DFS(G)', '  T := 只含根 v₁ 的樹', '  visit(v₁)', 'procedure visit(v)', '  for 每個鄰居 w 不在 T 裡', '    把 w 和 {v,w} 加進 T', '    visit(w)'];
    const cl = lines.map((s, i) => { const l = tag(s.padEnd(22, ' '), '', -3.9, 3.6 - i * 0.62, -1); Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '11px' }); return l; });
    const hl = (k) => cl.forEach((l, i) => { l.element.className = 'lab-label' + (i === k ? ' ptr alt' : ''); });
    say('DFS 的遞迴虛擬碼（Rosen）', 'visit(w) 做完才回到 v 繼續看下一個鄰居');
    hl(0); await beat(tok, 2200); hl(1); await beat(tok, 900); hl(2); await beat(tok, 900);
    const steps = travSteps(DFSG, 'f', 'dfs', DFS_ORDER);
    for (const st of steps) {
      paintTrav(gv, st);
      hl(st.final ? -1 : st.chk >= 0 ? 6 : 4);
      say(st.msg, st.chk >= 0 ? 'T 加入 {' + DFSG.E[st.chk].u + ',' + DFSG.E[st.chk].v + '}' : '');
      await beat(tok, st.final ? 1800 : 700);
    }
    const back = DFSG.E.map((e, i) => i).filter((i) => !steps[steps.length - 1].tree.includes(i));
    back.forEach((i) => paintEdge(gv.em[i], COL.pink, true));
    say('剩下的邊都是 back edge：連到祖先或子孫', back.map((i) => '{' + DFSG.E[i].u + ',' + DFSG.E[i].v + '}').join(' '));
    await beat(tok, 3200);
  }

  // ─── 6WZvVJ0Q1FA：BFS 從 e 出發 ───
  async function scBFS(tok) {
    fresh(...CAM);
    const gv = drawGraph(BFSG);
    const q = tag('', 'ptr alt', 3.2, 0.3, 3.2);
    say('BFS 建生成樹：這次選 e 當根', '先把 e 的所有鄰居接上 → level 1');
    await beat(tok, 2600);
    const steps = travSteps(BFSG, 'e', 'bfs');
    await playSteps(tok, steps, (st) => { paintTrav(gv, st, true); txt(q, 'L = [' + st.ds.join(' ') + ']'); }, 950, (st) => st.msg);
    say('level 1：b d f i；level 2：a c h g j k；level 3：l m', '已經在樹裡的點不再接 → 不會有 simple circuit');
    await beat(tok, 3400);
  }
  async function scDFSvsBFS(tok) {
    fresh([0, 10.5, 8.8], [0, 0, 0.2]);
    const L = drawGraph(BFSG, { s: 0.52, ox: -3.4, oz: 0 }), R = drawGraph(BFSG, { s: 0.52, ox: 3.4, oz: 0 });
    tag('DFS（根 e）', 'ptr', -3.4, 0.3, -2.4); tag('BFS（根 e）', 'ptr alt', 3.4, 0.3, -2.4);
    say('同一張圖、同一個根 e：DFS 和 BFS 長出不同的樹', '');
    await beat(tok, 2400);
    const a = travSteps(BFSG, 'e', 'dfs'), b = travSteps(BFSG, 'e', 'bfs');
    const n = Math.max(a.length, b.length);
    for (let k = 0; k < n; k++) { paintTrav(L, a[Math.min(k, a.length - 1)]); paintTrav(R, b[Math.min(k, b.length - 1)]); await beat(tok, 280); }
    const depth = (st) => Math.max(...Object.values(st.lvl));
    say('DFS 的樹又深又長、BFS 的樹又矮又寬', 'DFS 深度 ' + depth(a[a.length - 1]) + '，BFS 深度 ' + depth(b[b.length - 1]) + '；兩棵都是 12 條邊');
    await beat(tok, 3600);
  }

  // ─── 6WZvVJ0Q1FA：有向圖 DFS → spanning forest ───
  async function scDirected(tok) {
    fresh(...CAM);
    const gv = drawGraph(DIRG);
    say('有向圖也能 DFS，但要照箭頭方向走', '結果不一定是一棵樹，而是 spanning forest');
    await beat(tok, 2800);
    const steps = travSteps(DIRG, 'a', 'dfs');
    let roots = 0;
    for (const st of steps) {
      paintTrav(gv, st);
      if (st.msg.startsWith('回不到') || st.msg.startsWith('選')) roots++;
      say(st.msg, '第 ' + roots + ' 棵樹');
      await beat(tok, st.final ? 1500 : 900);
    }
    const comp = {}; let r = -1;
    steps.forEach((st) => { if (st.msg.startsWith('選') || st.msg.startsWith('回不到')) { r++; } if (st.cur && comp[st.cur] === undefined) comp[st.cur] = r; });
    DIRG.V.forEach((v) => vcol(gv, v, COMP[(comp[v] ?? 0) % COMP.length]));
    say('三棵樹：{a b c g f e}、{d h l k j}、{i}', 'c → d 走不到（箭頭是 d → c）');
    await beat(tok, 3400);
  }

  // ─── 6WZvVJ0Q1FA：練習題 ───
  async function scExRemove(tok) {
    fresh([0, 9, 8], [0, 0, 0]);
    const gv = drawGraph(EXR);
    say('練習：拿掉 simple circuit 上的邊得到生成樹', '兩個 circuit：a–b–d、b–c–e');
    await beat(tok, 2600);
    say('拿掉 {a,b}', '');
    await circuitFlash(tok, gv, ['a', 'b', 'd'], 1000);
    await removeEdge(tok, gv.em[gv.find('a', 'b')]);
    gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.edge, false); });
    say('拿掉 {b,c}', '');
    await circuitFlash(tok, gv, ['b', 'c', 'e'], 1000);
    await removeEdge(tok, gv.em[gv.find('b', 'c')]);
    gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.tree, true); });
    EXR.V.forEach((v) => vcol(gv, v, COL.vis));
    say('剩 a–d–b–e–c：5 點 4 邊的生成樹', '每個 circuit 拿掉一條邊就夠');
    await beat(tok, 3000);
  }
  async function scTriangleAll(tok) {
    fresh([0, 9, 8], [0, 0, 0]);
    const K3 = parseG({ a: [0, -1.3], b: [-1.3, 1], c: [1.3, 1] }, 'a-b b-c c-a');
    const big = drawGraph(K3, { s: 1, ox: 0, oz: -0.6 });
    say('練習：畫出三角形 a–b–c 的所有生成樹', '3 條邊挑 2 條，而且不能成 circuit');
    await beat(tok, 2600);
    big.G.V.forEach((v) => kill(big.vm[v])); big.em.forEach((e) => kill(e.g));
    const trees = spanningTrees(K3);
    for (let k = 0; k < trees.length; k++) {
      const gv = drawGraph(K3, { s: 0.9, ox: -4 + k * 4, oz: 0 });
      gv.em.forEach((e, i) => paintEdge(e, trees[k].includes(i) ? COL.tree : COL.dim, trees[k].includes(i)));
      const miss = K3.E.find((e, i) => !trees[k].includes(i));
      tag('拿掉 {' + miss.u + ',' + miss.v + '}', 'idx', -4 + k * 4, 0.3, 2.3);
      say('第 ' + (k + 1) + ' 棵：拿掉 {' + miss.u + ',' + miss.v + '}', '');
      await beat(tok, 1500);
    }
    say('共 3 棵 = 3^(3−2)：Cayley 公式 n^(n−2)', '起點不同、拿的邊不同，都還是生成樹');
    await beat(tok, 3200);
  }

  // ─── 課本：樹 n−1 條邊、Cayley、Matrix-Tree ───
  async function scTreeEdges(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const T = parseG({ a: [0, -2.6], b: [-2.6, -0.8], c: [0, -0.8], d: [2.6, -0.8], e: [-3.6, 1.4], f: [-1.6, 1.4], g: [1.6, 1.4], h: [3.6, 1.4] }, 'a-b a-c a-d b-e b-f d-g d-h');
    const gv = drawGraph(T);
    T.V.forEach((v) => { gv.vm[v].visible = false; }); gv.em.forEach((e) => { e.g.visible = false; });
    const c = tag('', 'ptr alt', 0, 0.3, 3.2);
    say('（課本）樹：連通、沒有 circuit', '每長一個新點，剛好多一條邊');
    gv.vm.a.visible = true; txt(c, 'n = 1、邊 = 0');
    await beat(tok, 2000);
    for (let i = 0; i < T.E.length; i++) {
      const e = gv.em[i]; e.g.visible = true; paintEdge(e, COL.tree, true); gv.vm[e.v].visible = true; vcol(gv, e.v, COL.vis);
      txt(c, 'n = ' + (i + 2) + '、邊 = ' + (i + 1));
      await beat(tok, 650);
    }
    say('8 個頂點 → 7 條邊：|E| = n − 1', '');
    await beat(tok, 2200);
    const extra = edgeMesh(gv.pos('f'), gv.pos('c'), { color: COL.hot, r: 0.08 });
    say('多加一條邊 {c,f} → 一定出現 circuit', 'f–b–a–c–f');
    [gv.find('a', 'b'), gv.find('b', 'f'), gv.find('a', 'c')].forEach((i) => paintEdge(gv.em[i], COL.hot, true));
    await beat(tok, 2600);
    kill(extra); gv.em.forEach((e) => paintEdge(e, COL.tree, true));
    say('拿掉任一條樹邊 {a,d} → 分成兩塊', '樹的每條邊都是 bridge');
    const e = gv.em[gv.find('a', 'd')];
    await removeEdge(tok, e);
    ['d', 'g', 'h'].forEach((v) => vcol(gv, v, COL.pink));
    await beat(tok, 2600);
    say('三件事等價：連通無 circuit ⇔ 任兩點恰一條路徑 ⇔ 連通且 n−1 條邊', '');
    await beat(tok, 3200);
  }
  async function scCayley(tok) {
    fresh([0, 9.6, 7.4], [0, 0, 0.2]);
    const K4 = parseG({ 1: [-0.55, -0.55], 2: [0.55, -0.55], 3: [0.55, 0.55], 4: [-0.55, 0.55] }, '1-2 2-3 3-4 4-1 1-3 2-4');
    const trees = spanningTrees(K4);
    say('（課本）K₄ 有幾棵生成樹？', '6 條邊挑 3 條：C(6,3) = 20，扣掉 4 個三角形');
    await beat(tok, 2600);
    const cnt = tag('', 'ptr alt', 0, 0.3, 3.4);
    for (let k = 0; k < trees.length; k++) {
      const gv = drawGraph(K4, { s: 1, ox: -3.9 + (k % 4) * 2.6, oz: -2.2 + Math.floor(k / 4) * 1.55, noName: true, size: [0.22, 0.2, 0.22], gap: 0.12, r: 0.035 });
      gv.em.forEach((e, i) => paintEdge(e, trees[k].includes(i) ? COL.tree : COL.dim, trees[k].includes(i), trees[k].includes(i)));
      txt(cnt, '已畫 ' + (k + 1) + ' 棵');
      await beat(tok, 260);
    }
    say('K₄ 有 16 = 4² 棵 labeled spanning trees', 'Cayley 公式：Kₙ 有 n^(n−2) 棵');
    await beat(tok, 2800);
    say('K₃：3¹ = 3；K₄：4² = 16；K₅：5³ = 125', '「n 個有標號點的樹」也是 n^(n−2) 種');
    await beat(tok, 3000);
  }
  async function scMatrixTree(tok) {
    fresh([0, 9, 9], [0, 0.6, 0.4]);
    const G = parseG({ 1: [-1.2, -1.2], 2: [1.2, -1.2], 3: [1.2, 1.2], 4: [-1.2, 1.2] }, '1-2 2-3 3-4 4-1 1-3');
    const gv = drawGraph(G, { s: 1, ox: -3.6, oz: 0 });
    say('（課本）Matrix-Tree 定理：一般圖怎麼數生成樹？', 'K₄ 拿掉 {2,4}');
    await beat(tok, 2400);
    const Lm = [[3, -1, -1, -1], [-1, 2, -1, 0], [-1, -1, 3, -1], [-1, 0, -1, 2]];
    const cells = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = Lm[i][j];
      cells.push({ i, j, m: cube(v, i === j ? COL.blue : v ? COL.pink : '#e6ddcf', [0.66, 0.3, 0.66], 1.2 + j * 0.8, 0.15, -1.2 + i * 0.8, 2.5) });
      await beat(tok, 70);
    }
    say('Laplacian L = D − A：對角線放度數，相鄰放 −1', 'deg = 3, 2, 3, 2');
    await beat(tok, 2800);
    cells.filter((c) => c.i === 0 || c.j === 0).forEach((c) => lab.flyAway(bodyOf(c.m), V3(0, 6, -3)));
    say('刪掉任一列與同一行（這裡刪第 1 列第 1 行）', '剩下 3×3 的 cofactor');
    await beat(tok, 2200);
    say('det = 2(3·2 − 1) − (−1)(−1·2 − 0) + 0 = 10 − 2 = 8', 'τ(G) = 任一 cofactor = 8');
    await beat(tok, 3000);
    lab.clear();
    const trees = spanningTrees(G);
    trees.forEach((t, k) => {
      const g2 = drawGraph(G, { s: 0.55, ox: -4.2 + (k % 4) * 2.8, oz: -1.3 + Math.floor(k / 4) * 2.6, noName: true, size: [0.22, 0.2, 0.22], gap: 0.12, r: 0.035 });
      g2.em.forEach((e, i) => paintEdge(e, t.includes(i) ? COL.tree : COL.dim, t.includes(i), t.includes(i)));
    });
    say('真的列出來：剛好 8 棵', 'Kₙ 代進去就得到 Cayley 的 n^(n−2)');
    await beat(tok, 3200);
  }

  // ─── 課本：Kruskal / Prim / Dijkstra ───
  async function scKruskal(tok) {
    fresh(...CAM);
    const gv = drawGraph(WG);
    say('（課本）Minimal spanning tree：權重總和最小的生成樹', 'Kruskal：邊由小到大挑，成 cycle 就丟');
    await beat(tok, 2600);
    await playSteps(tok, kruskalSteps(WG), (st) => {
      const T = new Set(st.T), d = makeDSU(WG.V); st.T.forEach((i) => d.u(WG.E[i].u, WG.E[i].v));
      const roots = [...new Set(WG.V.map(d.f))];
      WG.V.forEach((v) => vcol(gv, v, COMP[roots.indexOf(d.f(v)) % COMP.length]));
      gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? (st.ok ? COL.vis : COL.hot) : T.has(i) ? COL.tree : st.rej.includes(i) ? COL.dim : COL.edge, i === st.chk || T.has(i)));
    }, 1500);
    say('MST 總權重 1 + 2 + 3 + 5 + 8 = 19', '顏色 = 合併中的 forest；最後只剩一棵');
    await beat(tok, 3000);
  }
  async function scPrim(tok) {
    fresh(...CAM);
    const gv = drawGraph(WG);
    say('（課本）Prim：從 a 長出去，每次接最小的跨界邊', '藍色 = 一端在樹內、一端在樹外');
    await beat(tok, 2600);
    await playSteps(tok, primSteps(WG, 'a'), (st) => {
      const T = new Set(st.T);
      WG.V.forEach((v) => vcol(gv, v, st.inT.includes(v) ? COL.vis : COL.idle));
      gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? COL.hot : T.has(i) ? COL.tree : st.cand.includes(i) ? COL.blue : st.final ? COL.dim : COL.edge, i === st.chk || T.has(i)));
    }, 1100);
    say('跟 Kruskal 同一棵、同樣 19', 'Prim 長「一棵樹」，Kruskal 合併「森林」');
    await beat(tok, 3000);
  }
  async function scDijkstra(tok) {
    fresh(...CAM);
    const gv = drawGraph(CLRS);
    const dl = Object.fromEntries(CLRS.V.map((v) => { const p = gv.pos(v); return [v, tag('∞', 'ptr alt', p.x, p.y + 0.85, p.z)]; }));
    say('（課本 CLRS）最短路徑：Dijkstra 從 s 出發', '每次確定 d 最小的未確定點，再 relax 它的出邊');
    await beat(tok, 2600);
    await playSteps(tok, dijkstraSteps(CLRS, 's'), (st) => {
      const pe = new Set(Object.values(st.pred));
      CLRS.V.forEach((v) => { vcol(gv, v, st.S.includes(v) ? COL.vis : COL.idle, v === st.cur ? '#8a6400' : null); txt(dl[v], fmtD(st.dist[v])); });
      gv.em.forEach((e, i) => paintEdge(e, i === st.chk ? COL.hot : pe.has(i) ? COL.tree : st.final ? COL.dim : COL.edge, i === st.chk || pe.has(i)));
    }, 1050, (st) => st.final ? '完成：s 0、y 5、z 7、t 8、x 9' : st.msg);
    say('金色邊 = 最短路徑樹（例：s→y→t→x = 9）', '邊權不可為負，否則要用 Bellman-Ford');
    await beat(tok, 3200);
  }

  // ─── 課本：連通度、cut vertex、bridge ───
  async function scCutVertex(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const G = parseG({ a: [-5, -1.3], b: [-5, 1.3], c: [-3, 0], d: [-0.6, 0], e: [1.4, -1.6], f: [3.4, 0], g: [1.4, 1.6], h: [5.3, 0] }, 'a-b b-c c-a c-d d-e e-f f-g g-d f-h');
    const gv = drawGraph(G);
    const cnt = tag('連通塊：1', 'ptr alt', 0, 0.3, 3);
    say('（課本）cut vertex：拿掉它，連通塊變多', '');
    await beat(tok, 2200);
    const comps = (skipV, skipE) => { const d = makeDSU(G.V.filter((v) => v !== skipV)); G.E.forEach((e, i) => { if (i !== skipE && e.u !== skipV && e.v !== skipV) d.u(e.u, e.v); }); return d; };
    for (const v of ['c', 'd', 'f']) {
      gv.vm[v].visible = false;
      const inc = G.E.map((e, i) => i).filter((i) => G.E[i].u === v || G.E[i].v === v);
      inc.forEach((i) => { gv.em[i].g.visible = false; });
      const d = comps(v, -1), rest = G.V.filter((x) => x !== v), roots = [...new Set(rest.map(d.f))];
      rest.forEach((x) => vcol(gv, x, COMP[roots.indexOf(d.f(x)) % COMP.length]));
      txt(cnt, '拿掉 ' + v + ' → 連通塊：' + roots.length);
      say('拿掉 ' + v + '：圖斷成 ' + roots.length + ' 塊 → ' + v + ' 是 cut vertex', '');
      await beat(tok, 2200);
      gv.vm[v].visible = true; inc.forEach((i) => { gv.em[i].g.visible = true; });
      G.V.forEach((x) => vcol(gv, x, COL.idle));
    }
    gv.vm.e.visible = false; [gv.find('d', 'e'), gv.find('e', 'f')].forEach((i) => { gv.em[i].g.visible = false; });
    txt(cnt, '拿掉 e → 連通塊：1');
    say('拿掉 e：還是連通 → e 不是 cut vertex', '它在 cycle d–e–f–g 上');
    await beat(tok, 2400);
    gv.vm.e.visible = true; [gv.find('d', 'e'), gv.find('e', 'f')].forEach((i) => { gv.em[i].g.visible = true; });
    ['c-d', 'f-h'].forEach((s) => { const [u, v] = s.split('-'); paintEdge(gv.em[gv.find(u, v)], COL.hot, true); });
    txt(cnt, 'bridge：{c,d}、{f,h}');
    say('bridge（cut edge）：拿掉就斷的邊', '不在任何 circuit 上的邊 = bridge');
    await beat(tok, 3000);
    say('vertex connectivity κ(G)：最少拿掉幾個點才斷', '有 cut vertex ⇒ κ(G) = 1；κ ≤ λ（邊連通度）≤ 最小度數');
    await beat(tok, 3200);
  }

  // ─── 課本：Euler trail / circuit（Königsberg） ───
  async function scEuler(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const KB = parseG({ A: [0, -2.6], B: [0, 2.6], C: [-1.6, 0], D: [3, 0] }, 'A-C A-C B-C B-C A-D B-D C-D');
    const gv = drawGraph(KB, { par: 0.7 });
    const deg = (G, v) => G.E.filter((e) => e.u === v || e.v === v).length;
    KB.V.forEach((v) => { const p = gv.pos(v); tag('deg ' + deg(KB, v), 'ptr alt', p.x - 0.9, p.y + 0.5, p.z); });
    say('（課本）Königsberg 七橋：每座橋走恰一次？', '陸地 = 頂點、橋 = 邊（multigraph）');
    await beat(tok, 3000);
    KB.V.forEach((v) => vcol(gv, v, COL.hot));
    say('四個點度數 3, 5, 3, 3 全是奇數 → 不可能', 'Euler circuit ⇔ 連通且全偶；Euler trail ⇔ 恰 0 或 2 個奇點');
    await beat(tok, 3400);
    lab.clear();
    const K5 = parseG(ringP(['a', 'b', 'c', 'd', 'e'], 2.8), 'a-b a-c a-d a-e b-c b-d b-e c-d c-e d-e');
    const g5 = drawGraph(K5);
    K5.V.forEach((v) => { const p = g5.pos(v); tag('deg 4', 'ptr alt', p.x, p.y + 0.75, p.z); });
    say('K₅：每點度數 4（偶數）→ 有 Euler circuit', '一筆畫走完 10 條邊回到起點');
    await beat(tok, 2600);
    // Hierholzer
    const used = new Set(), stack = ['a'], circ = [], A = adjOf(K5);
    while (stack.length) { const v = stack[stack.length - 1]; const nx = A[v].find((x) => !used.has(x.i)); if (nx) { used.add(nx.i); stack.push(nx.to); } else circ.push(stack.pop()); }
    circ.reverse();
    const tokM = cube('', COL.hot, [0.35, 0.35, 0.35], ...g5.pos('a').toArray());
    tokM.position.y = 1;
    for (let i = 0; i + 1 < circ.length; i++) {
      const p = g5.pos(circ[i]), q = g5.pos(circ[i + 1]);
      await anim(tok, 420, (t) => { tokM.position.set(p.x + (q.x - p.x) * t, 1, p.z + (q.z - p.z) * t); });
      paintEdge(g5.em[g5.find(circ[i], circ[i + 1])], COL.tree, true);
      say('第 ' + (i + 1) + ' 條邊：' + circ[i] + ' → ' + circ[i + 1], circ.slice(0, i + 2).join(' '));
    }
    say('Euler circuit：' + circ.join(' '), '每條邊恰一次，回到起點 a');
    await beat(tok, 3200);
  }

  // ─── 課本：Euler 公式、K₅ / K₃,₃、四色 ───
  async function scEulerFormula(tok) {
    fresh([0, 10, 8], [0, 0, 0]);
    const G = PLANAR.cube.G();
    const gv = drawGraph(G);
    G.V.forEach((v) => { gv.vm[v].visible = false; }); gv.em.forEach((e) => { e.g.visible = false; });
    const order = ['a-b', 'b-c', 'c-d', 'a-e', 'e-f', 'f-g', 'g-h', 'd-a', 'b-f', 'c-g', 'd-h', 'h-e'].map((s) => G.E.findIndex((e) => [e.u, e.v].sort().join('-') === s.split('-').sort().join('-')));
    const box = tag('', 'ptr alt', 4.9, 0.3, -3.4);
    let fm = [];
    const shown = new Set(['a']), cur = [];
    gv.vm.a.visible = true;
    const upd = () => {
      fm.forEach(kill); fm = [];
      const sub = parseG(Object.fromEntries([...shown].map((v) => [v, G.P[v]])), cur.length ? cur.map((i) => G.E[i].u + '-' + G.E[i].v).join(' ') : 'a-a');
      if (!cur.length) sub.E = [];
      const faces = cur.length ? facesOf(sub).filter((f) => f.area > 1e-6) : [];
      faces.forEach((f, k) => fm.push(faceMesh(G, f.cyc, COMP[k % COMP.length])));
      const v = shown.size, e = cur.length, f = faces.length + 1;
      txt(box, 'v=' + v + ' e=' + e + ' f=' + f + ' → ' + (v - e + f));
      return [v, e, f];
    };
    say('（課本）Euler 公式：連通平面圖 v − e + f = 2', '從一個點開始，一條一條邊長出立方體');
    upd();
    await beat(tok, 2600);
    for (const i of order) {
      const e = G.E[i]; const newV = !shown.has(e.u) ? e.u : !shown.has(e.v) ? e.v : null;
      if (newV) { shown.add(newV); gv.vm[newV].visible = true; }
      cur.push(i); gv.em[i].g.visible = true; paintEdge(gv.em[i], COL.tree, true);
      const [v, ee, f] = upd();
      say(newV ? '加新點 ' + newV + ' 和一條邊：v+1、e+1' : '連兩個舊點：切出一個新 face，e+1、f+1', v + ' − ' + ee + ' + ' + f + ' = 2');
      await beat(tok, 1250);
      gv.em.forEach((x) => paintEdge(x, COL.edge, false, x.g.visible));
    }
    say('立方體：8 − 12 + 6 = 2', '外面無限大那塊也算一個 face');
    await beat(tok, 3000);
  }
  async function scNonPlanar(tok) {
    fresh([0, 10, 8.4], [0, 0, 0.2]);
    const k5 = drawGraph(PLANAR.k5.G(), { s: 0.78, ox: -3.4 });
    const k33 = drawGraph(PLANAR.k33.G(), { s: 0.6, ox: 3.4 });
    tag('K₅', 'ptr', -3.4, 0.3, -3.3); tag('K₃,₃', 'ptr alt', 3.4, 0.3, -3.3);
    say('（課本）K₅ 和 K₃,₃ 畫不成平面圖', '用 Euler 公式推出的邊數上限來證');
    await beat(tok, 2800);
    k5.em.forEach((e) => paintEdge(e, COL.hot, true));
    say('簡單平面圖每個 face 至少 3 條邊 → 3f ≤ 2e → e ≤ 3v − 6', 'K₅：e = 10 > 3·5 − 6 = 9 ✗');
    await beat(tok, 3400);
    k5.em.forEach((e) => paintEdge(e, COL.edge, false));
    k33.em.forEach((e) => paintEdge(e, COL.hot, true));
    say('K₃,₃ 是二分圖，沒有三角形 → 每 face ≥ 4 邊 → e ≤ 2v − 4', 'K₃,₃：e = 9 > 2·6 − 4 = 8 ✗');
    await beat(tok, 3400);
    say('Kuratowski：G 是平面圖 ⇔ 不含 K₅、K₃,₃ 的 subdivision', '注意：K₃,₃ 滿足 e ≤ 3v − 6（9 ≤ 12），只用這條判不出來');
    await beat(tok, 3600);
  }
  async function scFourColor(tok) {
    fresh([0, 10, 8.4], [0, 0, 0.2]);
    const k4 = PLANAR.k4.G(), w5 = COLOR_G.w5();
    const L = drawGraph(k4, { s: 0.8, ox: -3.3 }), R = drawGraph(w5, { s: 0.75, ox: 3.3 });
    say('（課本）四色定理：每個平面圖 χ(G) ≤ 4', '只要知道結論，不用會證明');
    await beat(tok, 2800);
    const c1 = bestColoring(k4); k4.V.forEach((v) => vcol(L, v, CC[c1[v]]));
    say('平面的 K₄ 需要 4 色：所以「4」不能再降', 'χ(K₄) = 4');
    await beat(tok, 2600);
    const c2 = bestColoring(w5); w5.V.forEach((v) => vcol(R, v, CC[c2[v]]));
    say('Wheel W₅：外圈奇 cycle 要 3 色，中心再 1 色', 'χ(W₅) = 4；W₆ 外圈偶 → 3');
    await beat(tok, 3000);
    say('地圖著色 = 對偶圖的頂點著色（下一段影片）', '相鄰區域 ↔ 相鄰頂點');
    await beat(tok, 2600);
  }

  // ─── Erea1QASjXY：地圖著色 → 對偶圖、χ(G)、P(G,λ) ───
  const MAP_CELLS = { A: [[0, 0], [1, 0]], B: [[2, 0], [2, 1]], C: [[0, 1], [1, 1]], D: [[0, 2]], E: [[1, 2], [2, 2]] };
  function drawMap(ox, oz, cs = 1.6) {
    const tiles = {};
    for (const [r, cells] of Object.entries(MAP_CELLS)) {
      tiles[r] = cells.map(([c, w]) => { const m = lab.box('#efe5d3', [cs - 0.06, 0.22, cs - 0.06]); m.position.set(ox + (c - 1) * cs, 0.11, oz + (w - 1) * cs); lab.world.add(m); return m; });
      const ctr = cells.reduce((s, [c, w]) => [s[0] + c / cells.length, s[1] + w / cells.length], [0, 0]);
      tag(r, 'val', ox + (ctr[0] - 1) * cs, 0.5, oz + (ctr[1] - 1) * cs);
    }
    return { paint(r, c) { tiles[r].forEach((m) => m.material.color.set(c)); } };
  }
  async function scMapDual(tok) {
    fresh([0, 10, 8], [0, 0, 0.2]);
    const map = drawMap(-3.2, 0);
    say('虛構大陸 A–E：相鄰國家旗子不能同色', '想用最少的顏色');
    await beat(tok, 2600);
    const greedy = [['A', 0, 'A 黃'], ['D', 0, 'D 不鄰 A → 也黃'], ['B', 1, 'B 鄰 A → 綠'], ['C', 2, 'C 鄰 A、B → 藍'], ['E', 3, 'E 鄰 B、C、D → 第 4 色紫']];
    for (const [r, c, cap] of greedy) { map.paint(r, CC[c]); say(cap, '影片的塗法'); await beat(tok, 1300); }
    say('影片結論：這張地圖要 4 色', '');
    await beat(tok, 1800);
    const G = parseG({ A: [-0.8, -1.6], B: [1.6, -0.8], C: [-0.8, 0], D: [-1.6, 1.6], E: [0.8, 1.6] }, 'A-B A-C B-C B-E C-D C-E D-E');
    const gv = drawGraph(G, { s: 1, ox: 3.2, oz: 0, y: 0.9 });
    say('對偶圖：國家 → 頂點，相鄰 → 連邊', 'A–B A–C B–C B–E C–D C–E D–E');
    await beat(tok, 2800);
    greedy.forEach(([r, c]) => vcol(gv, r, CC[c]));
    say('同一個問題，在圖上做頂點著色', '相鄰頂點不同色');
    await beat(tok, 2400);
    const better = { C: 0, E: 1, B: 2, D: 2, A: 1 };
    for (const r of ['C', 'E', 'B', 'D', 'A']) { vcol(gv, r, CC[better[r]]); map.paint(r, CC[better[r]]); await beat(tok, 500); }
    say('補充：換個塗法 3 色就夠（B、D 不相鄰可同色）', 'χ(G) = 3：有三角形 B–C–E 所以至少 3');
    await beat(tok, 3600);
  }
  async function scBipartite(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const G = parseG(ringP(['A', 'B', 'C', 'D', 'E', 'F'], 2.6), 'A-B B-C C-D D-E E-F F-A');
    const gv = drawGraph(G);
    say('C₆：能不能只用 2 色？', '');
    await beat(tok, 2000);
    for (const [v, c] of [['A', 0], ['B', 2], ['C', 0], ['D', 2], ['E', 0], ['F', 2]]) { vcol(gv, v, CC[c]); await beat(tok, 450); }
    say('可以：A C E 一色、B D F 一色', '');
    await beat(tok, 1600);
    const cols = { A: [-2.6, -2], C: [-2.6, 0], E: [-2.6, 2], B: [2.6, -2], D: [2.6, 0], F: [2.6, 2] };
    gv.em.forEach((e) => { e.g.visible = false; });
    for (const v of G.V) move(gv.vm[v], cols[v][0], 0.3, cols[v][1]);
    await beat(tok, 900);
    G.E.forEach((e) => edgeMesh(V3(cols[e.u][0], 0.3, cols[e.u][1]), V3(cols[e.v][0], 0.3, cols[e.v][1])));
    say('重畫成 bipartite graph：邊只跨兩邊', '2-colorable ⇔ bipartite ⇔ 沒有奇 cycle');
    await beat(tok, 3000);
    lab.clear();
    const T = parseG({ A: [0, -1.8], B: [-2, 1.4], C: [2, 1.4] }, 'A-B B-C C-A');
    const tv = drawGraph(T);
    for (const [v, c] of [['A', 0], ['B', 2], ['C', 3]]) { vcol(tv, v, CC[c]); await beat(tok, 700); }
    say('三角形 A B C：一定要 3 色 → 不是二分圖', 'χ(二分圖) = 2');
    await beat(tok, 3000);
  }
  async function scComplete(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const Ks = [2, 3, 4].map((n, k) => parseG(ringP('ABCD'.slice(0, n).split(''), 1.3, n === 2 ? 0 : Math.PI / 2), n === 2 ? 'A-B' : n === 3 ? 'A-B B-C C-A' : 'A-B A-C A-D B-C B-D C-D'));
    const gvs = Ks.map((G, k) => drawGraph(G, { ox: -4.2 + k * 4.2 }));
    Ks.forEach((G, k) => tag('K' + G.V.length, 'ptr', -4.2 + k * 4.2, 0.3, 2.3));
    say('完全圖 Kₙ：每個點都和其他所有點相鄰', '');
    await beat(tok, 2200);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < Ks[k].V.length; i++) { vcol(gvs[k], Ks[k].V[i], CC[i]); await beat(tok, 450); }
      say('K' + (k + 2) + '：每個新點都碰到前面所有點 → ' + (k + 2) + ' 色', 'χ(K' + (k + 2) + ') = ' + (k + 2));
      await beat(tok, 1500);
    }
    say('一般化：χ(Kₙ) = n', '');
    await beat(tok, 2800);
  }
  async function scCycles(tok) {
    fresh([0, 9.8, 8.4], [0, 0, 0.2]);
    const Cs = [3, 4, 5, 6].map((n) => { const names = 'ABCDEF'.slice(0, n).split(''); return parseG(ringP(names, 1.15), names.map((v, i) => v + '-' + names[(i + 1) % n]).join(' ')); });
    const gvs = Cs.map((G, k) => drawGraph(G, { ox: -4.8 + k * 3.2, s: 1, size: [0.5, 0.45, 0.5], gap: 0.3 }));
    Cs.forEach((G, k) => tag('C' + G.V.length, 'ptr', -4.8 + k * 3.2, 0.3, 2));
    say('Cycle Cₙ 的 χ：C₃、C₄、C₅、C₆', '');
    await beat(tok, 2000);
    for (let k = 0; k < 4; k++) {
      const n = Cs[k].V.length;
      for (let i = 0; i < n; i++) { const c = i === n - 1 && n % 2 ? 3 : i % 2 ? 2 : 0; vcol(gvs[k], Cs[k].V[i], CC[c]); await beat(tok, 380); }
      say('C' + n + '：' + (n % 2 ? '最後一點碰到兩種顏色 → 3 色' : '交錯兩色剛好 → 2 色'), 'χ(C' + n + ') = ' + (n % 2 ? 3 : 2));
      await beat(tok, 1500);
    }
    say('n 偶 → χ(Cₙ) = 2；n 奇 → χ(Cₙ) = 3', 'C₃ 也是 K₃');
    await beat(tok, 3000);
  }
  async function scPolyMap(tok) {
    fresh([0, 9.5, 8.4], [0, 0.2, 0.4]);
    const G = parseG({ A: [-0.8, -1.6], B: [1.6, -0.8], C: [-0.8, 0], D: [-1.6, 1.6], E: [0.8, 1.6] }, 'A-B A-C B-C B-E C-D C-E D-E');
    const gv = drawGraph(G, { s: 1.3, ox: -2.4 });
    say('Chromatic polynomial P(G,λ)：λ 色有幾種塗法', '影片：依 A B C D E 的順序數選擇');
    await beat(tok, 2600);
    const vid = [['A', 'λ', 'A：λ 種'], ['B', 'λ−1', 'B 鄰 A：λ − 1'], ['C', 'λ−2', 'C 鄰 A、B：λ − 2'], ['D', 'λ−1', 'D 只鄰 C：λ − 1'], ['E', 'λ−3', 'E 鄰 B、C、D：影片寫 λ − 3']];
    const tl = {};
    for (const [v, s, cap] of vid) { const p = gv.pos(v); tl[v] = tag(s, 'ptr alt', p.x, p.y + 0.85, p.z); vcol(gv, v, COL.vis); say(cap, ''); await beat(tok, 1300); }
    say('影片：P = λ(λ−1)(λ−2)(λ−1)(λ−3)，λ = 5 → 480', '5·4·3·4·2 = 480');
    await beat(tok, 3000);
    vcol(gv, 'B', COL.hot); vcol(gv, 'D', COL.hot); glow(gv.vm.E, GOLD);
    say('補充：B 和 D 不相鄰，可能同色！', '那時 E 只被擋掉 2 色，λ − 3 算少了');
    await beat(tok, 3200);
    G.V.forEach((v) => vcol(gv, v, COL.idle)); glow(gv.vm.E, null);
    const ok = [['C', 'λ'], ['E', 'λ−1'], ['B', 'λ−2'], ['D', 'λ−2'], ['A', 'λ−2']];
    for (const [v, s] of ok) { txt(tl[v], s); vcol(gv, v, COL.vis); say('改成 C → E → B → D → A 的順序：' + v + ' 有 ' + s + ' 種', '每點只鄰前面已塗、而且彼此相鄰的點'); await beat(tok, 1100); }
    const a = colorClasses(G);
    say('正確：P(G,λ) = λ(λ−1)(λ−2)³', 'P(G,5) = 5·4·27 = ' + chromP(a, 5) + '；P(G,3) = ' + chromP(a, 3) + ' > 0 → χ = 3');
    await beat(tok, 4000);
  }
  async function scPolyK4(tok) {
    fresh([0, 9, 8], [0, 0.3, 0.3]);
    const gv = drawGraph(K4X, { s: 0.9, ox: -2.4 });
    say('練習：求 P(G,λ)，再算 P(G,6)', 'D 和 A、B、C 都相鄰（四點兩兩相鄰 = K₄）');
    await beat(tok, 2600);
    const seq = [['A', 'λ'], ['B', 'λ−1'], ['C', 'λ−2'], ['D', 'λ−3']];
    for (const [v, s] of seq) { const p = gv.pos(v); tag(s, 'ptr alt', p.x, p.y + 0.85, p.z); vcol(gv, v, COL.vis); say(v + '：' + s + ' 種', ''); await beat(tok, 1200); }
    say('P(K₄,λ) = λ(λ−1)(λ−2)(λ−3)', '');
    await beat(tok, 2000);
    const vals = [6, 5, 4, 3];
    for (let i = 0; i < 4; i++) { cube(vals[i], CC[i], [0.9, 0.7, 0.9], 2 + i * 1.15, 0.35, 0.3, 3); await beat(tok, 450); }
    say('λ = 6：6 · 5 · 4 · 3 = 360', 'P(K₄,λ) 在 λ = 3 時 = 0 → χ(K₄) = 4');
    await beat(tok, 3400);
  }

  // ─── 課本：匹配（Hall）與最大流 ───
  async function scHall(tok) {
    fresh([0, 10, 8.2], [0, 0, 0]);
    let G = parseG(bipP(), BIP.ok), gv = drawGraph(G);
    tag('X', 'ptr', -3, 0.3, -3.8); tag('Y', 'ptr alt', 3, 0.3, -3.8);
    say('（課本）二分圖匹配：X 的每個點配一個 Y', '用 augmenting path 一次多配一對');
    await beat(tok, 2600);
    await playSteps(tok, matchSteps(G), (st) => {
      const M = new Set(st.M), P = new Set(st.path), mm = new Set(); st.M.forEach((i) => { mm.add(G.E[i].u); mm.add(G.E[i].v); });
      G.V.forEach((v) => vcol(gv, v, mm.has(v) ? COL.vis : COL.idle));
      gv.em.forEach((e, i) => paintEdge(e, P.has(i) ? COL.hot : M.has(i) ? COL.tree : COL.edge, P.has(i) || M.has(i)));
    }, 1500);
    lab.clear();
    G = parseG(bipP(), BIP.hall); gv = drawGraph(G);
    tag('X', 'ptr', -3, 0.3, -3.8); tag('Y', 'ptr alt', 3, 0.3, -3.8);
    say('換一張圖：還能把 X 全配完嗎？', '');
    await beat(tok, 2000);
    ['x1', 'x2', 'x3'].forEach((v) => vcol(gv, v, COL.hot)); ['y1', 'y2'].forEach((v) => vcol(gv, v, COL.orange));
    say('S = {x1,x2,x3} 只連到 N(S) = {y1,y2}', '|N(S)| = 2 < |S| = 3 → 不可能');
    await beat(tok, 3200);
    say('Hall 定理：complete matching ⇔ ∀S⊆X，|N(S)| ≥ |S|', '這張圖最大匹配 = 3');
    await beat(tok, 3200);
  }
  async function scMaxFlow(tok) {
    fresh([0, 9.5, 8], [0, 0, 0]);
    const N = parseG({ s: [-4.4, 0], a: [0, -2.2], b: [0, 2.2], t: [4.4, 0] }, 's>a:3 s>b:2 a>b:1 a>t:2 b>t:3');
    const gv = drawGraph(N, { weights: false });
    const flow = N.E.map(() => 0);
    const fl = gv.em.map((e) => { const p = e.g.userData.mid.clone().addScaledVector(e.g.userData.side, 0.35); return tag('', 'ptr alt', p.x, 0.6, p.z); });
    const upd = () => fl.forEach((l, i) => txt(l, flow[i] + '/' + N.E[i].w));
    upd();
    const val = tag('|f| = 0', 'ptr', 0, 0.3, 3.4);
    say('（課本）最大流：每條邊 流量/容量', '從 s 送到 t，最多能送多少？');
    await beat(tok, 2600);
    const aug = [[['s', 'a', 't'], 2], [['s', 'b', 't'], 2], [['s', 'a', 'b', 't'], 1]];
    let tot = 0;
    for (const [path, d] of aug) {
      const idx = []; for (let i = 0; i + 1 < path.length; i++) idx.push(gv.find(path[i], path[i + 1]));
      idx.forEach((i) => paintEdge(gv.em[i], COL.hot, true));
      say('augmenting path ' + path.join('→') + '：瓶頸 ' + d, '路上最小剩餘容量 = ' + d);
      await beat(tok, 1800);
      idx.forEach((i) => { flow[i] += d; }); tot += d; upd(); txt(val, '|f| = ' + tot);
      gv.em.forEach((e, i) => paintEdge(e, flow[i] === N.E[i].w ? COL.tree : flow[i] ? COL.blue : COL.edge, flow[i] > 0));
      await beat(tok, 1200);
    }
    say('再也找不到 s 到 t 的剩餘路徑 → 最大流 = 5', '金色 = 滿載的邊');
    await beat(tok, 2600);
    vcol(gv, 's', COL.pink);
    ['a', 'b', 't'].forEach((v) => vcol(gv, v, COL.blue));
    say('cut ({s}, {a,b,t}) 容量 = 3 + 2 = 5', 'Max-flow min-cut：最大流 = 最小割容量');
    await beat(tok, 3400);
  }

  const scenes = {
    'tree-edges': { title: '（課本）樹：n 個點 n−1 條邊', play: scTreeEdges },
    'st-remove-circuits': { title: '生成樹：拿掉 simple circuit 上的邊', play: scRemoveCircuits },
    'st-exercise-remove': { title: '練習：兩個 circuit 各拿一條邊', play: scExRemove },
    'st-triangle-all': { title: '練習：三角形的 3 棵生成樹', play: scTriangleAll },
    'cayley-k4': { title: '（課本）Cayley：K₄ 有 16 棵生成樹', play: scCayley },
    'matrix-tree': { title: '（課本）Matrix-Tree 定理：Laplacian cofactor', play: scMatrixTree },
    'st-dfs': { title: 'DFS 生成樹：從 f 出發、走不動就回溯', play: scDFS },
    'st-dfs-code': { title: 'DFS 虛擬碼 visit(v)、tree edge 與 back edge', play: scDFSCode },
    'st-bfs': { title: 'BFS 生成樹：從 e 出發、一層一層', play: scBFS },
    'st-dfs-vs-bfs': { title: '同一張圖：DFS 樹 vs BFS 樹', play: scDFSvsBFS },
    'st-directed-forest': { title: '有向圖 DFS：spanning forest', play: scDirected },
    'kruskal': { title: '（課本）Kruskal 最小生成樹', play: scKruskal },
    'prim': { title: '（課本）Prim 最小生成樹', play: scPrim },
    'dijkstra': { title: '（課本）Dijkstra 最短路徑', play: scDijkstra },
    'cut-vertex': { title: '（課本）cut vertex、bridge 與連通度', play: scCutVertex },
    'euler-trail': { title: '（課本）Königsberg 與 Euler circuit', play: scEuler },
    'euler-formula': { title: '（課本）Euler 公式 v − e + f = 2', play: scEulerFormula },
    'k5-k33': { title: '（課本）K₅、K₃,₃ 不是平面圖', play: scNonPlanar },
    'four-color': { title: '（課本）四色定理', play: scFourColor },
    'col-map-dual': { title: '地圖著色 → 對偶圖', play: scMapDual },
    'col-bipartite': { title: 'C₆ 兩色 = 二分圖；三角形要 3 色', play: scBipartite },
    'col-complete': { title: 'χ(Kₙ) = n', play: scComplete },
    'col-cycles': { title: 'χ(Cₙ)：偶 2、奇 3', play: scCycles },
    'col-poly-map': { title: 'Chromatic polynomial：地圖例（含勘誤）', play: scPolyMap },
    'col-poly-k4': { title: '練習：P(K₄,6) = 360', play: scPolyK4 },
    'hall-matching': { title: '（課本）二分圖匹配與 Hall 定理', play: scHall },
    'max-flow': { title: '（課本）最大流與最小割', play: scMaxFlow },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // A board = one stack of chips laid out by the page, so its lines sit under each other and never cover each
  // other whatever the camera does; past `max` lines (or `maxH` px) the oldest drops off. The holder is a 0×0
  // point, so the stage's auto framing ignores it. o.pin: the board is pinned to the left edge of the stage
  // (o.pin px in), at the height where its world anchor projects (never above the caption) — scenes then
  // keep the left strip free for it; otherwise its top-left (top-centre with o.center) sits on the anchor.
  const _bv = new THREE.Vector3();
  function stackBoard(x, y, z, o = {}) {
    const max = o.max ?? 7, center = !!o.center, maxH = o.maxH ?? 220;
    const hold = lab.label('', '');
    const el = hold.element; el.className = 'lab-stack';
    Object.assign(el.style, { width: '0', height: '0', overflow: 'visible', pointerEvents: 'none' });
    const col = document.createElement('div');
    Object.assign(col.style, { position: 'absolute', left: '0', top: '0', width: 'max-content', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: center ? 'center' : 'flex-start' });
    if (center) col.style.transform = 'translateX(-50%)';
    el.appendChild(col);
    if (hold.center) hold.center.set(0, 0);
    hold.position.set(x, y, z); lab.world.add(hold);
    if (o.pin !== undefined) {
      hold.onAfterRender = (r, sc, cam) => {
        const H = (r.getSize ? r.getSize().height : 0) || 360;
        _bv.setFromMatrixPosition(hold.matrixWorld).project(cam);
        const top = Math.max(o.top ?? 46, Math.round((0.5 - _bv.y / 2) * H));
        el.style.transform = 'translate(' + o.pin + 'px,' + top + 'px)';
      };
    }
    const ls = [];
    const line = (t, c, dx) => {
      const d = document.createElement('div'); d.className = 'lab-label ' + (c || ''); d.textContent = t;
      if (dx) d.style.marginLeft = Math.round(dx * 22) + 'px';
      if (o.maxW) Object.assign(d.style, { whiteSpace: 'normal', maxWidth: o.maxW + 'px', fontSize: '11.5px' });
      col.appendChild(d);
      const l = { element: d, userData: {}, visible: true, position: new THREE.Vector3(), parent: null, traverse(f) { f(this); } };
      ls.push(l);
      while (ls.length > max) ls.shift().element.remove();
      return l;
    };
    // too tall on screen (long, wrapped lines): the oldest lines drop off
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { while (ls.length > 1 && col.offsetHeight > maxH) ls.shift().element.remove(); }).observe(col);
    return { hold, ls, line, clear() { ls.forEach((l) => l.element.remove()); ls.length = 0; } };
  }
  // ═══ g8a.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第20A–22B講：Euler trail/circuit、Königsberg、planar graph、
//     Euler 公式 v − e + r = 2、region degree、girth、edge–vertex inequality、Kuratowski、Petersen）— cued scenes ───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的例子照用（七橋、adjacency matrix 例、K4/K5/K2,3/K3,3/Petersen）；老師黑板上的圖看不到、自己補的一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const T = (t, c, x, z, y = 0.4) => tag(t, c, x, y, z);
const LL = (t, c, x, z, y = 0.4) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const settxt = (l, t) => { if (l && l.element) l.element.textContent = t; };
const GC = { v: '#cdbfa6', e: '#9c8b70', hot: '#d64545', ok: '#2fc092', blue: '#4b9ee2', gold: '#c08a1f', pink: '#e55a9b', purple: '#9b7ef4', orange: '#dd8238', dim: '#e2d8c6', water: '#9fd3f0', land: '#e8dcc0', bridge: '#e9c53a' };
const CAM = [[0, 12.5, 7.8], [0, 0, 0.6]];
// scenes with pictures on both sides: look a little to the left so the pictures leave the board's strip free
const CAMR = [[-3.3, 13.4, 8.4], [-3.3, 0, 0.6]];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a board lying on the floor: lines appear one under another; the newest line is lit
function board(x, z0, dz = 0.62, o = {}) {
  const st = stackBoard(x, 0.4, z0, Object.assign(x < -4 ? { maxW: 200, pin: 12 } : { maxW: 200 }, o)); const ls = st.ls; let last = null;
  return {
    ls,
    add(t, c = 'note', dx = 0) {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = st.line(t, c, dx); l.userData.hot = c === 'note'; last = l; return l;
    },
    set(i, c) { const l = ls[i < 0 ? ls.length + i : i]; if (l) cls(l, c); },
    clear() { st.clear(); last = null; },
  };
}
// a graph whose vertices/edges can appear one by one; edges are tubes along (curved) paths
function graph(o = {}) {
  const s = o.s ?? 1, ox = o.ox ?? 0, oz = o.oz ?? 0, Y = 0.3, vs = o.vs ?? 0.56;
  const g = { V: {}, E: [], P: {}, s, ox, oz };
  g.at = (x, z, y = Y) => V3(ox + x * s, y, oz + z * s);
  g.pos = (n) => g.V[n].position.clone();
  g.v = (n, x, z, opt = {}) => {
    const m = lab.box(opt.c || GC.v, [vs, 0.4, vs]);
    if (!opt.noName && !o.noName) { m.userData.lbl = lab.label(opt.name ?? n, 'val'); m.add(m.userData.lbl); }
    m.position.copy(g.at(x, z)); m.visible = opt.show !== false; lab.world.add(m); g.V[n] = m; g.P[n] = [x, z]; return m;
  };
  g.vc = (n, c, em) => { const m = g.V[n]; m.material.color.set(c); m.material.emissive = new THREE.Color(em || '#000000'); };
  g.move = (n, x, z) => { g.V[n].position.copy(g.at(x, z)); g.P[n] = [x, z]; };
  g.e = (a, b, opt = {}) => {
    const pa = g.pos(a), pb = g.pos(b);
    let curve;
    if (opt.via) curve = new THREE.CatmullRomCurve3([pa, ...opt.via.map(([x, z]) => g.at(x, z)), pb]);
    else {
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const d = pb.clone().sub(pa); const perp = V3(-d.z, 0, d.x).normalize();
      curve = new THREE.QuadraticBezierCurve3(pa, mid.addScaledVector(perp, (opt.bend || 0) * s), pb);
    }
    const mat = new THREE.MeshStandardMaterial({ color: opt.c || GC.e, roughness: 0.6, transparent: !!opt.ghost, opacity: opt.ghost ? 0.45 : 1 });
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, opt.r ?? 0.06, 6, false), mat);
    m.visible = opt.show !== false; lab.world.add(m);
    const e = { a, b, m, mat, curve, id: opt.id };
    e.paint = (c, em) => { mat.color.set(c); mat.emissive = new THREE.Color(em || '#000000'); };
    e.show = (on = true) => { m.visible = on; };
    e.pt = (u, from) => curve.getPoint(from === b && a !== b ? 1 - u : u);
    e.kill = () => { lab.world.remove(m); };
    g.E.push(e); return e;
  };
  g.find = (a, b, k = 0) => g.E.filter((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))[k];
  g.deg = (n) => g.E.reduce((t, e) => t + (e.a === n ? 1 : 0) + (e.b === n ? 1 : 0), 0);
  // filled region bounded by a list of [edge, fromVertex] (edges walked in order)
  g.region = (walk, color, op = 0.3) => {
    const pts = [];
    walk.forEach(([e, from]) => { for (let i = 0; i < 16; i++) { const p = e.pt(i / 16, from); pts.push(new THREE.Vector2(p.x, -p.z)); } });
    const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; lab.world.add(m); return m;
  };
  g.kill = () => { Object.values(g.V).forEach((m) => kill(m)); g.E.forEach((e) => e.kill()); };
  return g;
}
// a walker (red ball) that travels along an edge
function walker(p, c = GC.hot) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
  m.position.set(p.x, 0.75, p.z); lab.world.add(m); return m;
}
async function go(tok, w, e, from, ms = 650, c = GC.hot) {
  await anim(tok, ms, (u) => { const p = e.pt(u, from); w.position.set(p.x, 0.75, p.z); });
  if (c) e.paint(c);
}
function face(pts, color, op = 0.28) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; lab.world.add(m); return m;
}
function slab(color, x, z, w, d, h = 0.12, y = 0.06) { const m = lab.box(color, [w, h, d]); m.position.set(x, y, z); lab.world.add(m); return m; }
// build a whole graph at once from 'a-b a-c' (optional bends 'a-b~0.4')
function quick(o, pos, estr, show = true) {
  const g = graph(o);
  Object.entries(pos).forEach(([n, [x, z]]) => g.v(n, x, z, { show }));
  estr.trim().split(/\s+/).filter(Boolean).forEach((tk) => { const [pr, bd] = tk.split('~'); const [a, b] = pr.split('-'); g.e(a, b, { bend: bd ? Number(bd) : 0, show }); });
  return g;
}
const showAll = (g, on = true) => { Object.values(g.V).forEach((m) => { m.visible = on; }); g.E.forEach((e) => e.show(on)); };

// ════════ ZYtvLbCdn1s（第20A講：Euler trails and circuits、Königsberg 七橋） ════════
// 七橋的地形是示意（河道形狀簡化），但橋與陸地的連法照老師說的：C–A 兩座、A–B 兩座、A–D、C–D、B–D 各一座。
const KB_LAND = { C: [0, -3.2, 12, 2.2], B: [0, 3.2, 12, 2.2], A: [-1.8, 0, 3.2, 1.6], D: [3.4, 0, 4.4, 2.0] };
const KB_BR = [ // [x, z, along-x?, from, to]
  [-2.6, -1.45, false, 'A', 'C'], [-1.0, -1.45, false, 'A', 'C'], [-2.6, 1.45, false, 'A', 'B'], [-1.0, 1.45, false, 'A', 'B'],
  [0.5, 0, true, 'A', 'D'], [3.4, -1.55, false, 'C', 'D'], [3.4, 1.55, false, 'B', 'D'],
];
const KB_NODE = { A: [-1.8, 0], B: [0.6, 3.3], C: [0.6, -3.3], D: [3.6, 0] };
function kbMap(o = {}) {
  const M = { land: {}, br: [], num: [] };
  M.water = slab(GC.water, 0, 0, 13.4, 9.6, 0.04, 0.0);
  Object.entries(KB_LAND).forEach(([n, [x, z, w, d]]) => { M.land[n] = slab(GC.land, x, z, w, d, 0.16, 0.1); M.land[n].visible = o.land !== false; });
  KB_BR.forEach(([x, z, h], i) => {
    const b = lab.box(GC.bridge, h ? [1.5, 0.24, 0.5] : [0.5, 0.24, 1.35]); b.position.set(x, 0.14, z); b.visible = o.br !== false; lab.world.add(b); M.br.push(b);
    const l = T(String(i + 1), 'idx', x + (h ? 0 : 0.45), z + (h ? 0.45 : 0), 0.45); l.visible = o.br !== false; M.num.push(l);
  });
  M.showBr = (i) => { M.br[i].visible = true; M.num[i].visible = true; };
  M.names = () => Object.entries(KB_NODE).forEach(([n, [x, z]]) => { M[n] = T(n, 'ptr', x + (n === 'A' ? -0.9 : n === 'D' ? 1.2 : -2.2), z, 0.6); });
  return M;
}
// the bridge-graph drawn over the map: edge i goes through bridge i
function kbGraph(show = true) {
  const g = graph();
  Object.entries(KB_NODE).forEach(([n, [x, z]]) => g.v(n, x, z, { show }));
  KB_BR.forEach(([x, z, h, a, b], i) => g.e(a, b, { via: [[x, z]], show, id: i }));
  return g;
}

scene('g8a-names', 'Euler trail 與 Euler circuit：名詞', [
  async (tok, S) => {
    S.B = board(-7, -4.4);
    S.B.add('今天：Euler trails and circuits');
    cap('第 20 講：Euler trail 和 Euler circuit', '先複習 trail、circuit 是什麼');
  },
  async (tok, S) => {
    S.B.add('trail / circuit = 邊不能重複的 walk');
    S.g = quick({ ox: 3, oz: 0.2, s: 1.3 }, { p: [-1.2, -1], q: [1.2, -1], r: [1.2, 1.2], s: [-1.2, 1.2], t: [2.6, 0.1] }, 'p-q q-r r-s s-p q-t t-r');
    T('示意', 'idx', 5.6, -2.6);
    cap('walk：沿著邊一步一步走', 'trail、circuit：走的時候邊不能重複');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('s'));
    for (const [a, b] of [['s', 'p'], ['p', 'q'], ['q', 'r']]) await go(tok, S.w, S.g.find(a, b), a, 450, GC.blue);
    S.B.add('open（起點 ≠ 終點）→ trail', 'note');
    cap('s → p → q → r：起點和終點不同', '這種 open 的叫 trail');
  },
  async (tok, S) => {
    S.g.E.forEach((e) => e.paint(GC.e));
    S.w.position.copy(S.g.pos('p')); S.w.position.y = 0.75;
    for (const [a, b] of [['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 'p']]) await go(tok, S.w, S.g.find(a, b), a, 400, GC.ok);
    S.B.add('closed（回到起點）→ circuit', 'good');
    cap('p → q → r → s → p：繞回起點', '這種 closed 的叫 circuit');
  },
  async (tok, S) => {
    S.B.add('有些書較不嚴格：叫 Euler path / Euler cycle', 'say');
    cap('名字不統一', '有些書把它叫 Euler path、Euler cycle');
  },
]);

scene('g8a-konig-map', 'Königsberg 七橋問題', [
  async (tok, S) => {
    S.B = board(-7, -5.2, 0.55);
    S.B.add('Seven Bridges of Königsberg');
    cap('一個很久以前、很有名的問題', 'Königsberg 七橋問題');
  },
  async (tok, S) => {
    S.M = kbMap({ land: false, br: false });
    T('Pregel 河（示意）', 'say', 3.6, -5.5, 0.3);
    cap('Königsberg 是普魯士的一個城市', '城裡有一條河：Pregel 河');
  },
  async (tok, S) => {
    S.B.add('現在屬於俄羅斯（Kaliningrad，波羅的海旁）', 'say');
    cap('這個地方現在在俄羅斯', '叫 Kaliningrad，在波羅的海旁邊');
  },
  async (tok, S) => {
    Object.values(S.M.land).forEach((m) => { m.visible = true; });
    cap('藍色是河，米色是陸地', '河把陸地切成好幾塊');
  },
  async (tok, S) => {
    for (let i = 0; i < 7; i++) { S.M.showBr(i); await wt(tok, 200); }
    cap('黃色是橋：1、2、3、4、5、6、7', '一共七座橋');
  },
  async (tok, S) => {
    S.bd = buddy('遊客', '', GC.pink, 4.6, 0.16, -3.4, 0.6);
    cap('外地人來玩，本地人帶他參觀', '希望每座橋都看到，但不要重複走（浪費時間）');
  },
  async (tok, S) => {
    S.B.add('每座橋都要過、每座只能過一次、回到出發點');
    cap('規則：每座橋恰好經過一次', '最後要回到出發的地方');
  },
  async (tok, S) => {
    Object.values(S.M.land).forEach((m) => { m.material.color.set('#f0c98a'); });
    cap('四塊區域：北岸、南岸、島、東邊那塊', '從任何一塊出發都可以');
  },
  async (tok, S) => { // try 1 from C (示意)
    Object.values(S.M.land).forEach((m) => { m.material.color.set(GC.land); });
    S.g = kbGraph(false);
    S.w = walker(S.g.pos('C'));
    const path = [[0, 'C'], [2, 'A'], [3, 'B'], [1, 'A'], [5, 'C'], [4, 'D']];
    for (const [i, from] of path) { await go(tok, S.w, S.g.E[i], from, 380, null); S.M.br[i].material.color.set(GC.hot); }
    S.x1 = T('卡在 A：橋 7 沒走到 ✗（示意）', 'bad', -1.8, -0.9, 1.2);
    cap('試走一次：走了 6 座橋就回不去了', '還剩一座橋沒走到');
  },
  async (tok, S) => { // try 2 from D
    kill(S.x1); S.M.br.forEach((b) => b.material.color.set(GC.bridge));
    S.w.position.copy(S.g.pos('D')); S.w.position.y = 0.75;
    const path = [[5, 'D'], [0, 'C'], [2, 'A'], [6, 'B'], [4, 'D'], [1, 'A']];
    for (const [i, from] of path) { await go(tok, S.w, S.g.E[i], from, 380, null); S.M.br[i].material.color.set(GC.hot); }
    S.x2 = T('卡在北岸：橋 4 沒走到 ✗（示意）', 'bad', 0.6, -2.4, 1.2);
    cap('換個起點再試：又卡住了', '怎麼試都試不出來');
  },
  async (tok, S) => {
    S.B.add('試不出來 ≠ 證明不可能', 'bad');
    cap('試不出來，不代表不可能', '可能只是還沒試到；要的是證明');
  },
  async (tok, S) => {
    S.B.add('電腦試完所有走法：可以，但不是好的證明', 'say');
    cap('問題很小，電腦可以全部試完', '但「全部試過都不行」不是好的證明');
  },
]);

scene('g8a-konig-parity', '為什麼不可能：看島 A 的橋數', [
  async (tok, S) => {
    S.M = kbMap(); S.g = kbGraph(false);
    S.B = board(-7, -5.2, 0.55);
    S.B.add('答案：不行。為什麼？');
    cap('答案是不行', '關鍵：只看一塊陸地就夠了');
  },
  async (tok, S) => {
    S.M.names();
    cap('四塊區域叫 A、B、C、D', 'A 是中間的島');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('C'));
    await go(tok, S.w, S.g.E[0], 'C', 600, null); S.M.br[0].material.color.set(GC.blue);
    S.in1 = T('進', 'good', -2.6, -1.45, 1.0);
    cap('假設不是從 A 出發：要到 A，得先「進來」', '進來用掉一座橋');
  },
  async (tok, S) => {
    await go(tok, S.w, S.g.E[2], 'A', 600, null); S.M.br[2].material.color.set(GC.orange);
    S.out1 = T('出', 'bad', -2.6, 1.45, 1.0);
    cap('最後要回到出發點，所以進來後一定要「離開」', '離開又用掉一座橋');
  },
  async (tok, S) => {
    await go(tok, S.w, S.g.E[3], 'B', 600, null); S.M.br[3].material.color.set(GC.blue);
    await go(tok, S.w, S.g.E[1], 'A', 600, null); S.M.br[1].material.color.set(GC.orange);
    T('進', 'good', -1.0, 1.45, 1.0); T('出', 'bad', -1.0, -1.45, 1.0);
    cap('再到 A：再進來、再出去', '每到 A 一次，就是一進一出');
  },
  async (tok, S) => {
    S.cnt = T('到 A 1 次 → 2 座橋', 'ptr alt', -1.8, 0.0, 1.4);
    cap('到 A 一次：經過 2 座橋', '');
  },
  async (tok, S) => { settxt(S.cnt, '到 A 2 次 → 4 座橋'); cap('到 A 兩次：經過 4 座橋', ''); },
  async (tok, S) => { settxt(S.cnt, '到 A 3 次 → 6 座橋'); cap('到 A 三次：經過 6 座橋', '每次都 +2'); },
  async (tok, S) => {
    S.B.add('每座橋都要過 → 連到 A 的橋數必須是偶數');
    cap('橋又不能重複、又都要經過', '所以連到 A 的橋數一定是偶數');
  },
  async (tok, S) => {
    S.M.br[4].material.color.set(GC.hot);
    settxt(S.cnt, 'A 連了 5 座橋：奇數！');
    S.B.add('A 連 5 座橋（1、2、3、4、5）→ 奇數 ✗', 'bad');
    cap('A 連了 1、2、3、4、5 共 5 座橋', '配完兩對進出，第 5 座落單');
  },
  async (tok, S) => {
    S.B.add('從 A 出發也一樣：先出去…最後回到 A → 仍是偶數', 'say');
    cap('如果從 A 出發呢？', '先出去，中間回來再出去，最後回到 A：出、進成對，還是偶數');
  },
  async (tok, S) => {
    S.B.add('所以 A 只有 5 座橋 → 不可能', 'bad');
    cap('不管從哪裡出發，A 都需要偶數座橋', '5 是奇數 → 不可能');
  },
  async (tok, S) => {
    S.B.add('可行的話：A 要有 even number of bridges', 'good');
    cap('結論：每拜訪一次耗掉兩座橋', '所以 A 連的橋數必須是偶數');
  },
]);

scene('g8a-history', 'Euler 1736：圖論的第一個定理', [
  async (tok, S) => {
    S.B = board(-5.5, -3.6, 0.8);
    S.B.add('Leonhard Euler（尤拉），1736 年的論文');
    S.b = buddy('Euler', '1736', GC.purple, 4, 0, 0.5, 1.1);
    cap('這個問題是尤拉在 1736 年解的', '他寫了一篇論文');
  },
  async (tok, S) => {
    S.B.add('把一般情況全部解決（若且唯若的條件）');
    S.B.add('充分條件的完整證明是後人補的', 'say');
    cap('不只解七橋，連一般的情況都解決了', '條件是他說的；充分那半的完整證明是後來的人給的');
  },
  async (tok, S) => {
    S.B.add('奠定了 Graph Theory 的發展：第一個定理', 'good');
    cap('通常被當成圖論的第一個定理', '1736 年之後，圖論就開始了');
  },
  async (tok, S) => {
    S.B.add('vertex、edge 這些概念就是為了這個問題定義的');
    S.b.mood('happy');
    cap('為了解釋這個問題，尤拉定義了 vertex、edge', '我們前面學的頂點、邊，都從這裡開始');
  },
]);

scene('g8a-konig-graph', '把七橋變成一張圖', [
  async (tok, S) => {
    S.M = kbMap(); S.M.names();
    cap('怎麼把這個問題變成 graph？', '');
  },
  async (tok, S) => {
    S.g = kbGraph(false);
    Object.values(S.g.V).forEach((m) => { m.visible = true; });
    cap('每一塊區域變成一個端點（vertex）', '四塊區域 → 四個端點');
  },
  async (tok, S) => { cap('每一座橋變成一條邊（edge）', '橋連哪兩塊，邊就連哪兩個端點'); },
  async (tok, S) => { S.g.E[0].show(); S.g.E[1].show(); cap('C 到 A 有兩座橋', '→ 兩條 edge'); },
  async (tok, S) => { S.g.E[5].show(); cap('C 到 D 有一座橋', '→ 一條 edge'); },
  async (tok, S) => { S.g.E[4].show(); cap('A 到 D 有一座橋', '→ 一條 edge'); },
  async (tok, S) => { S.g.E[2].show(); S.g.E[3].show(); cap('A 到 B 有兩座橋', '→ 兩條 edge'); },
  async (tok, S) => { S.g.E[6].show(); cap('B 到 D 有一座橋', '→ 一條 edge'); },
  async (tok, S) => {
    Object.values(S.M.land).forEach((m) => { m.visible = false; }); S.M.br.forEach((b) => { b.visible = false; }); S.M.num.forEach((l) => { l.visible = false; }); S.M.water.visible = false;
    S.g.E.forEach((e) => e.paint(GC.gold));
    cap('地圖拿掉，就剩下一張 graph', '兩點之間有兩條邊 → 這是 multigraph');
  },
  async (tok, S) => {
    S.B = board(-7, -4.6);
    S.B.add('4 個 vertices、7 個 edges');
    cap('這個 graph 有 4 個 vertices、7 個 edges', '');
  },
  async (tok, S) => {
    S.B.add('問題：找一個 circuit（邊不重複、回到原點）');
    cap('從任何一點出發、邊不能重複、最後回到原點', '就是要找一個 circuit');
  },
  async (tok, S) => {
    S.B.add('而且每條邊都要走過 → 這就是 Euler circuit', 'good');
    cap('例如從 A 出發，每條邊都走、只走一次，回到 A', '這樣的 circuit 叫 Euler circuit');
  },
]);

scene('g8a-def', '定義：Euler circuit 與 Euler trail', [
  async (tok, S) => {
    S.B = board(-7, -4.6, 0.6);
    S.B.add('定義 Euler circuit');
    cap('定義 Euler circuit', '');
  },
  async (tok, S) => {
    S.B.add('G：undirected graph（simple 或 multigraph 都可以）', 'say');
    cap('圖是 undirected', 'simple graph 或 multigraph 都可以');
  },
  async (tok, S) => {
    S.B.add('simple：兩點間最多一條邊、沒有 loop', 'say');
    cap('七橋是 multigraph', 'simple graph：任兩個不同端點最多一條邊，而且沒有 loop');
  },
  async (tok, S) => {
    S.B.add('它是一個 circuit：closed walk、邊不重複');
    S.g = quick({ ox: 3.2, oz: 0.4, s: 1.1 }, { a: [-2.2, -1.4], b: [-2.2, 1.4], c: [0, 0], d: [2.2, -1.4], e: [2.2, 1.4] }, 'a-b b-c c-a c-d d-e e-c');
    T('示意', 'idx', 6, -2.2);
    cap('先是一個 circuit', '繞一圈回來的 walk，邊不能重複');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('a'));
    for (const [a, b] of [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'c'], ['c', 'a']]) await go(tok, S.w, S.g.find(a, b), a, 330, GC.ok);
    S.B.add('traverses every edge exactly once');
    cap('而且每條邊都經過、剛好一次', 'a b c d e c a：6 條邊各走一次');
  },
  async (tok, S) => {
    S.B.add('→ 叫做 Euler circuit（closed）', 'good');
    cap('這樣的 circuit 叫 Euler circuit', '');
  },
  async (tok, S) => {
    S.g.kill(); kill(S.w);
    S.h = quick({ ox: 3.2, oz: 0.6, s: 1.1 }, { p: [-1.4, 1.6], q: [1.4, 1.6], r: [1.4, -0.8], s: [-1.4, -0.8], t: [0, -2.4] }, 'p-q q-r r-s s-p s-t t-r');
    S.w = walker(S.h.pos('s'));
    for (const [a, b] of [['s', 'p'], ['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 't'], ['t', 'r']]) await go(tok, S.w, S.h.find(a, b), a, 330, GC.blue);
    S.B.add('若是 open：Euler trail', 'note');
    cap('如果是 open 的', '每條邊恰走一次、但沒回到起點 → Euler trail');
  },
  async (tok, S) => {
    S.B.add('circuit：從哪裡出發就回到哪裡', 'say');
    cap('Euler circuit 是 closed：從哪出發就回到哪', '');
  },
  async (tok, S) => {
    S.h.vc('s', GC.ok); S.h.vc('r', GC.hot);
    S.B.add('trail：起點 ≠ 終點（例：s 出發、r 結束）', 'say');
    cap('Euler trail：出發點和結束點不一樣', '這裡 s 出發、r 結束');
  },
  async (tok, S) => {
    S.B.add('trail = A 集合、B 解散；circuit = 同地集合解散', 'good');
    cap('帶團比喻：trail 在 A 集合、B 解散', 'circuit 在同一個地方集合、解散');
  },
]);

scene('g8a-thm', '定理：Euler circuit ⇔ connected 且每點 degree 偶數', [
  async (tok, S) => {
    S.B = board(-7, -4.8, 0.6);
    S.B.add('定理（Euler circuit 的條件）');
    cap('下面這個定理', '');
  },
  async (tok, S) => {
    S.B.add('G undirected（simple 或 multi）有 Euler circuit', 'say');
    cap('G 是 undirected graph', '它有 Euler circuit 的條件');
  },
  async (tok, S) => {
    S.B.add('⇔（if and only if，若且唯若＝充要條件）');
    cap('條件是 if and only if', '充分而且必要');
  },
  async (tok, S) => {
    S.B.add('條件一：G connected');
    cap('第一個條件很簡單：要 connected', '');
  },
  async (tok, S) => {
    S.g = quick({ ox: 3, oz: 0.2 }, { a: [-2.4, -1.2], b: [-0.8, -1.2], c: [-1.6, 0.4], x: [1.2, -0.4], y: [2.6, -0.4], z: [1.9, 1.0] }, 'a-b b-c c-a x-y y-z z-x');
    T('示意：兩塊', 'idx', 0.8, -2.4);
    S.x = T('這邊出發永遠到不了那邊 ✗', 'bad', 3, 2.2);
    cap('如果圖分成兩塊', '從這塊出發，永遠走不到那塊的邊');
  },
  async (tok, S) => {
    kill(S.x);
    S.B.add('connected：只有一個 component＝任兩點間有 path', 'say');
    cap('connected：只有一個 component', '也就是任兩個端點之間都有一條 path');
  },
  async (tok, S) => {
    S.B.add('補一個假設：G 沒有 isolated vertices');
    cap('老師補了一個前提', 'G 不能有 isolated vertices');
  },
  async (tok, S) => {
    S.g.kill();
    S.g = quick({ ox: 3, oz: 0.2 }, { a: [-2, -1.2], b: [0, -1.2], c: [-1, 0.6], d: [1.2, 0.6] }, 'a-b b-c c-a b-d c-d');
    S.iso = S.g.v('i', 2.6, -1.4, { c: GC.hot });
    S.il = T('isolated vertex：一條邊都沒有', 'bad', 5.6, -2.4);
    cap('isolated vertex：孤零零、沒有任何邊的點', '');
  },
  async (tok, S) => {
    S.iso.visible = false; kill(S.il);
    S.B.add('有的話就丟掉：它沒有邊，根本不會走到', 'say');
    cap('它沒有邊，本來就不用走到它', '直接拿掉，只看有邊的部分，條件比較好寫');
  },
  async (tok, S) => {
    S.g.kill();
    S.g = quick({ ox: 3, oz: 0.4 }, { v: [0, 0], n1: [-2, -1.4], n2: [2, -1.4], n3: [-2, 1.4], n4: [2, 1.4] }, 'v-n1 v-n2 v-n3 v-n4');
    S.w = walker(S.g.pos('n1'));
    await go(tok, S.w, S.g.find('v', 'n1'), 'n1', 450, GC.blue); await go(tok, S.w, S.g.find('v', 'n2'), 'v', 450, GC.orange);
    S.B.add('條件二：每經過一點：進去＋出來 → +2');
    cap('第二個條件：經過一個點就是進去、出來', '每次用掉 2 條邊');
  },
  async (tok, S) => {
    S.w.position.copy(S.g.pos('n3')); S.w.position.y = 0.75;
    await go(tok, S.w, S.g.find('v', 'n3'), 'n3', 450, GC.blue); await go(tok, S.w, S.g.find('v', 'n4'), 'v', 450, GC.orange);
    T('deg(v) = 4', 'ptr alt', 3, -0.9);
    S.B.add('每個 vertex 的 degree（連的邊數）要 even');
    cap('所以每個端點的 degree（連到它的邊數）都要是偶數', '出發點也一樣：先出去、最後回來');
  },
  async (tok, S) => {
    S.B.add('G 有 Euler circuit ⇔ G connected 且每點 degree 偶數', 'good');
    cap('定理：有 Euler circuit', '⇔ connected，而且每個端點 degree 都是偶數');
  },
]);

scene('g8a-nec', '證明必要條件：connected', [
  async (tok, S) => {
    S.B = board(-7, -4.8, 0.6);
    S.B.add('證明 ⇒（必要條件）：有 Euler circuit ⇒ 兩個條件');
    cap('先證必要條件', '從前面推到後面：若 P 則 Q');
  },
  async (tok, S) => {
    S.B.add('第一：connected ⇐ 任兩點間都有 path');
    cap('要證 connected', '用「任兩點之間都有 path」來證');
  },
  async (tok, S) => {
    S.g = quick({ ox: 3.2, oz: 0.4, s: 1.05 }, { x: [-2.6, -1.4], a: [-2.6, 1.0], c: [0, 0], p: [-0.9, -2.4], q: [0.9, -2.4], b: [2.6, 1.0], y: [2.6, -1.4] }, 'x-a a-c c-x c-p p-q q-c c-b b-y y-c');
    T('示意', 'idx', 6.2, -2.8);
    S.g.vc('x', GC.blue); S.g.vc('y', GC.blue);
    cap('任取兩個端點 x、y', '');
  },
  async (tok, S) => {
    S.B.add('Euler circuit 經過每條邊 → 經過每個點（含 x、y）', 'say');
    cap('Euler circuit 經過每一條邊', '沒有 isolated vertex，所以每個點都在 circuit 上，x、y 也在');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('x'));
    for (const [a, b] of [['x', 'a'], ['a', 'c'], ['c', 'p'], ['p', 'q'], ['q', 'c'], ['c', 'b'], ['b', 'y']]) await go(tok, S.w, S.g.find(a, b), a, 330, GC.gold);
    cap('沿著 circuit 從 x 走到 y', 'x a c p q c b y：c 出現了兩次');
  },
  async (tok, S) => {
    ['c-p', 'p-q', 'q-c'].forEach((k) => S.g.find(...k.split('-')).paint(GC.dim));
    S.B.add('重複的端點：把繞回來的那段剪掉 → path', 'say');
    cap('path 不能有重複端點', '把 c → p → q → c 這圈剪掉，剩 x a c b y 就是 path');
  },
  async (tok, S) => {
    S.B.add('⇒ 任兩點有 path ⇒ G connected', 'good');
    cap('所以任兩點之間都有 path', 'G 一定是 connected');
  },
  async (tok, S) => {
    S.B.add('第二：degree 偶數（進去、出來，每次 +2）');
    cap('第二點：degree 要偶數', '證明就是剛剛說的：進去出來，成對出現');
  },
]);

// ════════ 0kzn9J950-I（第20B講：必要條件收尾、充分條件的 constructive proof：走到卡住、break out） ════════
// 示意圖（老師在黑板上講的例子）：circuit A B C D E A，C 還有一條沒用的邊連到 X；這裡把 C–X–Y 補成三角形，讓每點 degree 都是偶數。
const PENT = { A: [-2.2, -1.6], B: [0, -2.8], C: [2.2, -1.2], D: [1.4, 1.6], E: [-1.6, 1.6], X: [4.2, -2.4], Y: [4.2, 0.3] };
const PENT_E = 'A-B B-C C-D D-E E-A C-X X-Y Y-C';
const pent = (o = {}) => quick(Object.assign({ ox: 1.4, oz: 0.5, s: 1 }, o), PENT, PENT_E);
const paintPath = (g, seq, c) => { for (let i = 0; i + 1 < seq.length; i++) g.find(seq[i], seq[i + 1]).paint(c); };

scene('g8a-nec-deg', '必要條件收尾：degree 為偶數', [
  async (tok, S) => {
    S.g = quick({ ox: 2.2, oz: 0.4, s: 1.1 }, { v: [0, 0], p: [-2.4, -1.6], q: [2.4, -1.6], r: [-2.4, 1.6], t: [2.4, 1.6] }, 'v-p v-q v-r v-t');
    S.w = walker(S.g.pos('p'));
    await go(tok, S.w, S.g.find('v', 'p'), 'p', 500, GC.blue); T('進（arriving）', 'good', 0.2, -2.5);
    await go(tok, S.w, S.g.find('v', 'q'), 'v', 500, GC.orange); T('出（departing）', 'bad', 4.4, -2.5);
    S.B = board(-7, -4.4, 0.62);
    S.B.add('每經過 v 一次：一條進來、一條離開');
    cap('每次經過一個端點 v', '一定用掉兩條連到 v 的邊：一條進來、一條離開');
  },
  async (tok, S) => {
    S.w.position.copy(S.g.pos('r')); S.w.position.y = 0.75;
    await go(tok, S.w, S.g.find('v', 'r'), 'r', 500, GC.blue); await go(tok, S.w, S.g.find('v', 't'), 'v', 500, GC.orange);
    S.B.add('連到 v 的每條邊都要經過', 'say');
    cap('連到 v 的每一條邊都要經過', '每條都被配進某一次「進＋出」');
  },
  async (tok, S) => {
    S.B.add('deg(v) = 2 ×（離開的邊數）→ 偶數', 'good');
    T('deg(v) = 4 = 2 × 2', 'ptr alt', 2.2, -0.9);
    cap('所以 deg(v) = 2 × 離開的邊數', '一定是偶數');
  },
  async (tok, S) => {
    S.B.add('必要條件：connected 很直覺；偶數 = 進出成對', 'say');
    cap('必要條件就證完了', 'connected 很直覺；degree 偶數就是「進去、出來」成對');
  },
  async (tok, S) => {
    S.B.add('接著證充分條件：兩條件成立 ⇒ 一定有 Euler circuit');
    cap('再來證充分條件', '如果滿足後面兩個條件，就一定有 Euler circuit');
  },
]);

scene('g8a-suff-intro', '充分條件：用 constructive proof', [
  async (tok, S) => {
    S.B = board(-6.6, -4.2, 0.7);
    S.B.add('要證：G connected、無 isolated vertex、每點 degree 偶數');
    S.B.add('⇒ 存在一個 Euler circuit', 'good');
    cap('要證的方向', '連通、每點偶數 ⇒ 一定有 Euler circuit');
  },
  async (tok, S) => {
    S.B.add('Euler circuit 不見得唯一：只要證「存在」', 'say');
    cap('Euler circuit 不一定只有一個', '我們只要證明「有」就好（existence）');
  },
  async (tok, S) => {
    S.B.add('證明存在的方法很多；這裡用 constructive proof（建設性證明）');
    cap('證明「存在」有很多種方法', '這裡用建設性證明');
  },
  async (tok, S) => {
    S.B.add('不只說「有」，還給方法去找 → 一個 algorithm', 'note');
    S.b = buddy('', '?', GC.blue, 4.2, 0, 2.2, 0.8);
    cap('建設性證明：不只證明存在', '還告訴你怎麼找，並說明為什麼一定找得到');
  },
  async (tok, S) => {
    S.B.add('滿足兩個條件 → 這個 algorithm 一定找得到', 'good');
    S.b.set('!'); S.b.mood('happy');
    cap('下面給一個 algorithm', '只要 connected、每點 degree 偶數，就一定能找到 Euler circuit');
  },
]);

scene('g8a-walk', '演算法第一步：一直走，直到 get stuck', [
  async (tok, S) => {
    S.g = pent(); T('示意', 'idx', 6.2, -3.2);
    S.B = board(-7, -4.6, 0.6);
    S.g.vc('A', GC.ok);
    S.B.add('1. 從任何一個 vertex 開始（這裡選 A）');
    cap('第一步：從任何一個端點開始都可以', '這裡選 A');
  },
  async (tok, S) => {
    S.g.find('A', 'B').paint(GC.gold); S.g.find('A', 'E').paint(GC.gold);
    cap('A 連著好幾條邊', '從哪一條開始都可以，隨便挑');
  },
  async (tok, S) => {
    S.g.find('A', 'E').paint(GC.e);
    S.w = walker(S.g.pos('A'));
    await go(tok, S.w, S.g.find('A', 'B'), 'A', 600, GC.hot);
    cap('開始走：A → B', '走過的邊變紅色');
  },
  async (tok, S) => {
    await go(tok, S.w, S.g.find('B', 'C'), 'B', 600, GC.hot);
    S.B.add('2. 走到下一點，挑一條「還沒走過」的邊', 'say');
    cap('到下一個端點，它又連著一些邊', '規則只有一個：走過的不能再走');
  },
  async (tok, S) => {
    ['C-D', 'C-X', 'C-Y'].forEach((k) => S.g.find(...k.split('-')).paint(GC.gold));
    await wt(tok, 700);
    ['C-X', 'C-Y'].forEach((k) => S.g.find(...k.split('-')).paint(GC.e));
    await go(tok, S.w, S.g.find('C', 'D'), 'C', 600, GC.hot);
    cap('C 還剩三條邊沒走', '隨便挑一條：這次挑 C → D');
  },
  async (tok, S) => {
    await go(tok, S.w, S.g.find('D', 'E'), 'D', 500, GC.hot);
    await go(tok, S.w, S.g.find('E', 'A'), 'E', 500, GC.hot);
    S.B.add('never repeating an edge：有邊可以走就走', 'say');
    cap('never repeating an edge', '有邊可以走就一直走：D → E → A');
  },
  async (tok, S) => {
    S.g.vc('A', GC.hot, '#5a0000');
    S.B.add('3. 直到 get stuck：走到某點，沒有邊可以出去', 'bad');
    cap('回到 A：A 的兩條邊都用掉了', '沒有邊可以走 → get stuck');
  },
  async (tok, S) => {
    ['C-X', 'X-Y', 'Y-C'].forEach((k) => S.g.find(...k.split('-')).paint(GC.ok));
    T('還沒走到的邊', 'good', 4.6, 1.8);
    cap('卡住了，可是 C–X、X–Y、Y–C 還沒走到', '如果這時邊都走完了，就已經找到 Euler circuit');
  },
  async (tok, S) => {
    S.B.add('接下來：get stuck 時會是什麼狀況？怎麼辦？');
    cap('接下來要討論', 'get stuck 時會碰到什麼狀況，以及要怎麼辦');
  },
]);

scene('g8a-stuck', '卡住的點一定是出發點', [
  async (tok, S) => {
    S.g = pent(); T('示意', 'idx', 6.2, -3.2);
    paintPath(S.g, ['A', 'B', 'C', 'D', 'E', 'A'], GC.hot);
    S.g.vc('A', GC.hot, '#5a0000');
    S.B = board(-7, -4.6, 0.6);
    S.B.add('走到某點，邊都用掉了，但還有邊沒走');
    cap('走到某個端點，它的邊全部用掉了', '但整張圖還有一些邊沒走過');
  },
  async (tok, S) => {
    S.B.add('這時走過的路一定是一個 circuit');
    cap('這時候，剛剛走過的路一定構成一個 circuit', '');
  },
  async (tok, S) => {
    S.g.vc('A', GC.ok, '#0a4a2a');
    S.B.add('也就是：get stuck 的點一定是出發點', 'note');
    cap('意思是：卡住的那點一定是出發點', '中間可以走出去再繞回來，沒關係');
  },
  async (tok, S) => {
    S.B.add('原因：每點 degree 都是偶數', 'say');
    cap('為什麼？要用到假設', '每個端點的 degree 都是偶數');
  },
  async (tok, S) => {
    S.g.vc('A', GC.v); S.g.E.forEach((e) => e.paint(GC.e));
    paintPath(S.g, ['A', 'B', 'C', 'D'], GC.hot);
    S.g.vc('D', GC.orange);
    S.dl = T('假設卡在 D？', 'bad', 2.8, 2.6);
    cap('假如走一走，卡在別的點，例如 D', '這可能嗎？');
  },
  async (tok, S) => {
    settxt(S.dl, 'D：進來 1 條（奇數）→ 還剩 1 條可出去');
    S.g.find('D', 'E').paint(GC.gold);
    cap('不可能：中間點每次都是「進去、出來」', '只進來沒出去時，D 用掉的邊數是奇數；但 deg(D) 是偶數，一定還有一條可以出去');
  },
  async (tok, S) => {
    S.g.vc('A', GC.ok);
    S.B.add('別的點：用掉奇數條時一定還有路 → 卡不住', 'say');
    S.B.add('出發點：一開始只出去（奇），回到這裡才變偶 → 只可能卡在這', 'say');
    cap('所以不會卡在別的點', '出發點一開始只出去（用掉奇數條），回到它時才變偶數，才可能沒路');
  },
  async (tok, S) => {
    kill(S.dl); S.g.vc('D', GC.v);
    paintPath(S.g, ['D', 'E', 'A'], GC.hot);
    S.g.vc('A', GC.ok, '#0a4a2a');
    S.B.add('卡住的點 = 出發點 → 整條是 circuit', 'good');
    cap('卡住的點一定是出發點', '所以走過的整條路是一個 circuit');
  },
  async (tok, S) => {
    S.B.add('circuit：端點可以重複，邊不能重複', 'say');
    cap('circuit 的端點可以重複', '只要每次走的邊不一樣就好');
  },
  async (tok, S) => {
    S.B.add('get stuck = 到了某點，沒有邊可以出去', 'bad');
    cap('再說一次 get stuck 的意思', '走到那點，沒有任何沒用過的邊可以出去');
  },
]);

scene('g8a-breakout', 'Break out：換個起點繼續走', [
  async (tok, S) => {
    S.B = board(-7, -4.8, 0.56);
    S.B.add('卡住了，但還有邊沒走 → 要想辦法繼續');
    cap('get stuck 了，但還沒達到要求', '得想辦法繼續走下去');
  },
  async (tok, S) => {
    S.g = pent(); T('示意', 'idx', 6.2, -3.2);
    paintPath(S.g, ['A', 'B', 'C', 'D', 'E', 'A'], GC.hot);
    cap('現在有一個 circuit（紅色）', '還有一些沒用到的邊');
  },
  async (tok, S) => {
    S.B.add('circuit 上一定有某點還有沒用的邊 → 從那裡 break out');
    cap('這個 circuit 上一定有端點還有邊沒用到', '那就從那裡 break out（衝出去）');
  },
  async (tok, S) => {
    S.q = T('沒用的邊會不會都離 circuit 遠遠的？', 'bad', 3.6, 3.4);
    cap('為什麼一定在 circuit 上？', '會不會沒用的邊都在別處，跟 circuit 碰不到？');
  },
  async (tok, S) => {
    settxt(S.q, 'G connected → 一定有路連到 circuit');
    cls(S.q, 'good');
    S.B.add('不可能：G connected，沒用的邊一定連得到 circuit', 'say');
    cap('不可能：G 是 connected', '那些邊一定有路連到 circuit，接上的那個點就有沒用的邊');
  },
  async (tok, S) => {
    kill(S.q);
    S.B.add('先處理能 break out 的情形；不能 break out 後面再說', 'say');
    cap('先假設 circuit 上有點有沒用的邊 → break out', '如果沒辦法 break out，後面會說明那就是答案');
  },
  async (tok, S) => {
    S.g.find('A', 'B').paint(GC.hot);
    cap('舉個例子說明 break out', '這是剛剛走出來的 circuit');
  },
  async (tok, S) => {
    ['C-X', 'X-Y', 'Y-C'].forEach((k) => S.g.find(...k.split('-')).paint(GC.ok));
    S.g.vc('C', GC.ok);
    cap('C 上面有一條沒用到的邊連到 X', '綠色的邊都還沒用');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('A'));
    for (const [a, b] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'A']]) await go(tok, S.w, S.g.find(a, b), a, 300, null);
    S.B.add('原來的 circuit：A B C D E A（回到 A 卡住）');
    cap('原來的 circuit 是 A, B, C, D, E, A', '繞回 A，A 只有兩條邊，get stuck');
  },
  async (tok, S) => {
    S.w.position.copy(S.g.pos('C')); S.w.position.y = 0.75;
    S.B.add('break out：把起點改成 C', 'note');
    cap('break out：把起始點改一下', '改成從 C 開始算');
  },
  async (tok, S) => {
    for (const [a, b] of [['C', 'D'], ['D', 'E'], ['E', 'A'], ['A', 'B'], ['B', 'C']]) await go(tok, S.w, S.g.find(a, b), a, 260, null);
    await go(tok, S.w, S.g.find('C', 'X'), 'C', 500, GC.hot);
    S.B.add('C D E A B C → X：衝出去了！', 'good');
    cap('同一個 circuit 寫成 C, D, E, A, B, C', '回到 C 時不停，沿綠色的邊走到 X：break out！');
  },
  async (tok, S) => {
    S.B.add('circuit 上任何點有沒用的邊 → 一定能 break out', 'say');
    cap('只要 circuit 上任何一個點還有沒用的邊', '把出發點換成它，就一定能 break out');
  },
  async (tok, S) => {
    await go(tok, S.w, S.g.find('X', 'Y'), 'X', 500, GC.hot);
    await go(tok, S.w, S.g.find('Y', 'C'), 'Y', 500, GC.hot);
    cap('出去以後照原來的方法：有邊就走', 'X → Y → C，又 get stuck');
  },
  async (tok, S) => {
    S.B.add('又形成 circuit → 再找有沒用邊的點 → 再 break out', 'say');
    cap('又構成一個 circuit', '再去找這個 circuit 上有沒有點還有沒用的邊，再 break out');
  },
  async (tok, S) => {
    S.B.add('forming circuits and breaking out as long as possible', 'good');
    cap('一直做', '直到沒辦法 break out 為止（這個例子已經全部走完）');
  },
]);

scene('g8a-final', '不能 break out ⇒ 就是 Euler circuit', [
  async (tok, S) => {
    S.B = board(-7, -4.8, 0.56);
    S.B.add('break out 不可能 ⇒ 找到 Euler circuit');
    cap('break out 不可能的時候', '我們就找到 Euler circuit 了');
  },
  async (tok, S) => {
    S.g = quick({ ox: 2.4, oz: 0.4 }, { A: [-1.6, -1.2], c1: [0.6, -2.6], c2: [2.8, -1.4], c3: [1.4, 0.4], A1: [-3.2, 0.6], A2: [-2.0, 2.4], v: [0.4, 2.4], w: [2.8, 2.2] },
      'A-c1 c1-c2 c2-c3 c3-A A-A1 A1-A2 A2-v v-w');
    T('示意', 'idx', 6.2, -3.2);
    paintPath(S.g, ['A', 'c1', 'c2', 'c3', 'A'], GC.hot);
    S.B.add('不能 break out = circuit 上每個點的邊都用完', 'say');
    cap('紅色是目前的 circuit', '不能 break out：circuit 上每個端點的邊都已經用完');
  },
  async (tok, S) => {
    S.B.add('要證：每一條邊都在這個 circuit 裡');
    cap('要證明的事', '圖裡每一條邊都在這個 circuit 裡');
  },
  async (tok, S) => {
    S.g.find('v', 'w').paint(GC.purple);
    T('任一條邊 e = vw', 'ptr alt', 4.2, 3.2);
    cap('任取一條邊 e', '它的兩個端點叫 v、w');
  },
  async (tok, S) => {
    ['A-A1', 'A1-A2', 'A2-v'].forEach((k) => S.g.find(...k.split('-')).paint(GC.blue));
    S.B.add('G connected → 從 circuit 的起點 A 到 v 有 path：A, A1, A2, …, v', 'say');
    cap('G 是 connected', '所以從 circuit 的起點 A 到 v 有一條 path：A, A1, A2, …, v');
  },
  async (tok, S) => {
    S.g.find('A', 'A1').paint(GC.hot);
    S.B.add('邊 A–A1 若不在 circuit：A 有沒用的邊 → 可在 A break out，矛盾', 'bad');
    cap('看第一條邊 A–A1', '如果它不在 circuit 裡，A 就有沒用的邊，可以在 A break out，矛盾；所以它在 circuit 裡');
  },
  async (tok, S) => {
    S.g.find('A1', 'A2').paint(GC.hot);
    cap('所以 A1 也在 circuit 上', '同理 A1–A2 一定在 circuit，不然可以在 A1 break out');
  },
  async (tok, S) => {
    S.g.find('A2', 'v').paint(GC.hot);
    S.B.add('以此類推：path 上所有邊、點都在 circuit → v 在 circuit', 'say');
    cap('一個一個推過去', 'path 上所有的邊和點都在 circuit 裡，所以 v 也在');
  },
  async (tok, S) => {
    S.g.find('v', 'w').paint(GC.hot);
    S.B.add('v 在 circuit → 連到 v 的邊都在 → vw 在 circuit', 'good');
    cap('v 在 circuit 上，又不能在 v break out', '所以連到 v 的每條邊都在 circuit 裡，vw 也是');
  },
  async (tok, S) => {
    S.B.add('e 是任意一條邊 → 所有邊都在 → Euler circuit', 'good');
    cap('e 是隨便取的一條邊', '所以每一條邊都在這個 circuit 裡：它就是 Euler circuit');
  },
  async (tok, S) => {
    S.B.add('演算法：任選起點走 → 卡住成 circuit → break out → 直到不能', 'note');
    cap('整理演算法', '任意起點、任意沒用過的邊一直走；卡住就 break out；直到不能 break out');
  },
  async (tok, S) => {
    S.B.add('degree 偶數：保證卡在起點；connected：保證邊都收進來', 'say');
    cap('兩個條件都有用到', 'degree 偶數用在「卡住點 = 起點」，connected 用在「所有邊都在 circuit」');
  },
  async (tok, S) => {
    S.B.add('不只證存在，還是 constructive proof；下次用例子跑一次', 'say');
    cap('這不只證明 Euler circuit 存在', '還給了找它的 algorithm；下次用一個例子試試看');
  },
]);

// ════════ ATY_gkJbfNQ（第21A講：用 adjacency matrix 的例子跑演算法、Euler trail） ════════
// 老師的例子：A–B 兩條、A–C 一條、A–D 一條、B–D 兩條、C–D 三條（degree：A 4、B 4、C 4、D 6）。每次照字母順序挑邊。
const EXP = { A: [-1.8, -1.6], B: [1.8, -1.6], C: [-1.8, 1.6], D: [1.8, 1.6] };
const EXE = [['A', 'B', 0.5], ['A', 'B', -0.5], ['A', 'C', 0], ['A', 'D', 0], ['B', 'D', 0.5], ['B', 'D', -0.5], ['C', 'D', 0], ['C', 'D', 0.75], ['C', 'D', -0.75]];
const EXN = ['A', 'B', 'C', 'D'];
function exSetup(S, o = {}) {
  S.g = graph({ ox: 3.4, oz: 0.2, s: 1.0 });
  EXN.forEach((n) => S.g.v(n, ...EXP[n]));
  EXE.forEach(([a, b, bd]) => S.g.e(a, b, { bend: bd, show: o.edges !== false }));
  S.used = new Set(); S.cnt = {};
  EXE.forEach(([a, b]) => { const k = [a, b].sort().join(''); S.cnt[k] = (S.cnt[k] || 0) + 1; });
  // cells far apart enough not to print over each other, and pinned (class val) so the grid stays a grid
  const x0 = -6.6, z0 = -4.0, dx = 1.05, dz = 0.95;
  S.cell = {};
  EXN.forEach((n, j) => { T(n, 'ptr', x0 + (j + 1) * dx, z0); T(n, 'ptr', x0, z0 + (j + 1) * dz); });
  EXN.forEach((r, i) => EXN.forEach((c, j) => { S.cell[r + c] = T(o.matrix === false ? '' : String(r === c ? 0 : S.cnt[[r, c].sort().join('')] || 0), 'say val', x0 + (j + 1) * dx, z0 + (i + 1) * dz); }));
  S.circ = LL('', 'note', -6.9, 1.0);
}
const exK = (a, b) => [a, b].sort().join('');
function exUse(S, a, b, paint = true) {
  const i = EXE.findIndex(([u, v], k) => !S.used.has(k) && exK(u, v) === exK(a, b));
  S.used.add(i); S.cnt[exK(a, b)]--;
  const val = String(S.cnt[exK(a, b)]);
  settxt(S.cell[a + b], val); settxt(S.cell[b + a], val);
  Object.values(S.cell).forEach((l) => cls(l, 'say val'));
  cls(S.cell[a + b], 'ptr alt val'); cls(S.cell[b + a], 'ptr alt val');
  if (paint) S.g.E[i].paint(GC.hot);
  return S.g.E[i];
}
async function exGo(tok, S, a, b) { const e = exUse(S, a, b, false); await go(tok, S.w, e, a, 550, GC.hot); }

scene('g8a-recap', '複習：Euler circuit 定理與演算法', [
  async (tok, S) => { S.B = board(-6, -3.6, 0.8); S.B.add('上次：Euler trail 與 Euler circuit'); cap('上次講到 Euler trail 和 Euler circuit', ''); },
  async (tok, S) => { S.B.add('G 有 Euler circuit ⇔ connected 且每點 degree 偶數', 'good'); cap('定理：G 有 Euler circuit', '⇔ G connected，而且每個 vertex 的 degree 都是偶數'); },
  async (tok, S) => { S.B.add('充分條件：constructive proof，給了一個 algorithm', 'say'); cap('證充分條件時用了 constructive proof', '給了一個 algorithm 去找 Euler circuit'); },
  async (tok, S) => { S.B.add('今天：看一個例子實際跑一次'); cap('今天用一個例子試試看', ''); },
]);

scene('g8a-ex-matrix', '例子：用 adjacency matrix 描述的圖', [
  async (tok, S) => {
    exSetup(S, { edges: false, matrix: false });
    cap('四個 vertices：A、B、C、D', 'undirected graph');
  },
  async (tok, S) => {
    T('adjacency matrix', 'idx', -4.6, -4.3);
    EXN.forEach((n) => settxt(S.cell[n + n], '0'));
    cap('用 adjacency matrix 描述它（老師寫在右邊，這裡放左邊）', 'undirected → 矩陣是對稱的');
  },
  async (tok, S) => { S.g.E[0].show(); S.g.E[1].show(); settxt(S.cell.AB, '2'); settxt(S.cell.BA, '2'); cap('A 到 B 有兩條 edges', 'A–B 格是 2，B–A 格也是 2'); },
  async (tok, S) => { S.g.E[2].show(); S.g.E[3].show(); ['AC', 'CA', 'AD', 'DA'].forEach((k) => settxt(S.cell[k], '1')); cap('A 到 C 一條、A 到 D 一條', '那些格子是 1'); },
  async (tok, S) => { S.g.E[4].show(); S.g.E[5].show(); settxt(S.cell.BD, '2'); settxt(S.cell.DB, '2'); settxt(S.cell.BC, '0'); settxt(S.cell.CB, '0'); cap('B 到 D 有兩條 edges', ''); },
  async (tok, S) => { S.g.E[6].show(); S.g.E[7].show(); S.g.E[8].show(); settxt(S.cell.CD, '3'); settxt(S.cell.DC, '3'); cap('C 到 D 有三條 edges', ''); },
  async (tok, S) => {
    EXN.forEach((n) => { const p = S.g.pos(n); T('deg ' + S.g.deg(n), 'ptr alt', p.x + (p.x > 3.4 ? 1.0 : -1.0), p.z, 0.6); });
    cap('D 那一列：A 1、B 2、C 3', '圖就長這樣；每點 degree：4、4、4、6，都是偶數');
  },
  async (tok, S) => { S.B = board(-6.9, 1.4); S.B.add('用上次的 algorithm 找 Euler circuit', 'good'); cap('用上次證明裡的 algorithm', '來找這張圖的 Euler circuit'); },
]);

scene('g8a-ex-run1', '從 A 出發照字母順序走，第一次 break out', [
  async (tok, S) => { exSetup(S); cap('直接在 adjacency matrix 上走', '矩陣就完整描述了這張圖'); },
  async (tok, S) => {
    S.B = board(-6.9, 2.2, 0.55); S.B.add('起點 A；可選時照 alphabetical order', 'say');
    S.w = walker(S.g.pos('A')); settxt(S.circ, 'A');
    cap('每次都從 A 開始', '有好幾條邊可選時，照 A、B、C、D 的字母順序');
  },
  async (tok, S) => { await exGo(tok, S, 'A', 'B'); settxt(S.circ, 'A B'); cap('A 可以到 B → A 走到 B', '用掉一條邊，矩陣 A–B 減 1'); },
  async (tok, S) => { await exGo(tok, S, 'B', 'A'); settxt(S.circ, 'A B A'); cap('從 B：照字母順序先看 A → B 走到 A', 'A–B 又減 1，變 0'); },
  async (tok, S) => { await exGo(tok, S, 'A', 'C'); settxt(S.circ, 'A B A C'); cap('回到 A：還沒用的邊是到 C', 'A 走到 C'); },
  async (tok, S) => { await exGo(tok, S, 'C', 'D'); settxt(S.circ, 'A B A C D'); cap('C 可以到 D', 'C–D 從 3 變 2'); },
  async (tok, S) => { await exGo(tok, S, 'D', 'A'); settxt(S.circ, 'A B A C D A'); cap('D 可以到 A', 'D 走到 A'); },
  async (tok, S) => {
    S.g.vc('A', GC.hot, '#5a0000');
    S.B.add('A 那一列全是 0 → get stuck', 'bad');
    cap('A → B → A → C → D → A', 'A 的邊全用完了 → get stuck');
  },
  async (tok, S) => { S.B.add('break out：走過的點上有沒有還沒用的邊？'); cap('get stuck 就 break out', '看走過的端點上，還有沒有沒用過的 edge'); },
  async (tok, S) => {
    S.g.vc('A', GC.v); S.g.vc('B', GC.ok); cls(S.cell.BD, 'good val'); cls(S.cell.DB, 'good val');
    S.B.add('A 沒有；B 有（B–D 還有 2）→ 在 B break out', 'good');
    cap('A 沒有了；B 還有（B–D 是 2）', '所以在 B break out');
  },
  async (tok, S) => {
    S.w.position.copy(S.g.pos('B')); S.w.position.y = 0.75;
    settxt(S.circ, 'B A C D A B');
    cap('同一個 circuit 改從 B 開始寫', 'B A C D A B');
  },
]);

scene('g8a-ex-run2', '再 break out 一次，得到 Euler circuit', [
  async (tok, S) => {
    exSetup(S);
    [['A', 'B'], ['B', 'A'], ['A', 'C'], ['C', 'D'], ['D', 'A']].forEach(([a, b]) => exUse(S, a, b));
    Object.values(S.cell).forEach((l) => cls(l, 'say val'));
    S.w = walker(S.g.pos('B')); settxt(S.circ, 'B A C D A B');
    S.B = board(-6.9, 2.2, 0.55);
    cap('從 B break out，走出去', '目前的 circuit：B A C D A B');
  },
  async (tok, S) => { await exGo(tok, S, 'B', 'D'); settxt(S.circ, 'B A C D A B D'); cap('B 還有沒用的邊：B 走到 D', 'B–D 從 2 變 1'); },
  async (tok, S) => { await exGo(tok, S, 'D', 'B'); settxt(S.circ, 'B A C D A B D B'); cap('從 D：A 已經 0，照順序是 B → D 走到 B', 'B–D 變 0'); },
  async (tok, S) => { S.g.vc('B', GC.hot, '#5a0000'); S.B.add('B 全部用完 → 又 get stuck', 'bad'); cap('B 的邊全用完了', '又 get stuck'); },
  async (tok, S) => {
    S.g.vc('B', GC.v); S.g.vc('C', GC.ok); cls(S.cell.CD, 'good val'); cls(S.cell.DC, 'good val');
    S.B.add('B、A 用完了；C 還有（C–D 剩 2）', 'say');
    cap('看 circuit 上的點：B、A 都用完了', 'C 還有沒用的邊（C–D 還有 2）');
  },
  async (tok, S) => {
    S.w.position.copy(S.g.pos('C')); S.w.position.y = 0.75;
    settxt(S.circ, 'C D A B D B A C');
    S.B.add('在 C break out：改寫成從 C 開始', 'note');
    cap('在 C break out', '把 circuit 改寫成 C D A B D B A C');
  },
  async (tok, S) => { await exGo(tok, S, 'C', 'D'); settxt(S.circ, 'C D A B D B A C D'); cap('C 走到 D', 'C–D 從 2 變 1'); },
  async (tok, S) => { await exGo(tok, S, 'D', 'C'); settxt(S.circ, 'C D A B D B A C D C'); cap('D 還能到 C → D 走到 C', 'C–D 變 0'); },
  async (tok, S) => {
    S.B.add('C 沒邊了 → get stuck；A、B、C、D 都沒有沒用的邊', 'bad');
    cap('C 沒有邊可走 → get stuck', '再看：A、B、C、D 全都沒有沒用的邊');
  },
  async (tok, S) => {
    S.g.E.forEach((e) => e.paint(GC.ok)); cls(S.circ, 'good');
    S.B.add('不能 break out → Euler circuit：C D A B D B A C D C', 'good');
    cap('沒辦法 break out → 這就是 Euler circuit', 'C D A B D B A C D C：9 條邊各一次');
  },
  async (tok, S) => { S.B.add('步驟：照字母順序走 → 卡住就 break out → 直到不能', 'say'); cap('回顧：每次照字母順序挑邊', 'get stuck 就在 circuit 上找還有邊的點 break out'); },
  async (tok, S) => { S.B.add('只要在 adjacency matrix 上 run 就好', 'say'); cap('整個過程只要在 adjacency matrix 上做', '每用一條邊就把對應的格子減 1'); },
]);

// house graph（示意）：deg s = deg r = 3，其餘偶數
const HOUSE = { p: [-1.4, 1.6], q: [1.4, 1.6], r: [1.4, -0.8], s: [-1.4, -0.8], t: [0, -2.4] };
const HOUSE_E = 'p-q q-r r-s s-p s-t t-r';
scene('g8a-trail', 'Euler trail：恰兩個 degree 奇數的點', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.6); S.B.add('接下來：Euler trail'); cap('剛剛的例子是 Euler circuit', '接下來講 Euler trail'); },
  async (tok, S) => {
    S.g = quick({ ox: 3.4, oz: 0.6, s: 1.1 }, HOUSE, HOUSE_E); T('示意', 'idx', 6.2, -2.4);
    S.w = walker(S.g.pos('s'));
    for (const [a, b] of [['s', 'p'], ['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 't'], ['t', 'r']]) await go(tok, S.w, S.g.find(a, b), a, 300, GC.blue);
    S.B.add('trail 是 open walk：起點 ≠ 終點，每條邊恰一次', 'say');
    cap('Euler trail：從一個 vertex 出發，到另一個 vertex 結束', '每條邊都 exactly once');
  },
  async (tok, S) => { S.B.add('條件：把 circuit 的條件稍微修正'); cap('它的若且唯若條件', '只要把 Euler circuit 的條件稍微修改'); },
  async (tok, S) => { S.B.add('第一個條件一樣：G connected', 'say'); cap('第一個條件一樣', 'G 要 connected'); },
  async (tok, S) => {
    ['p', 'q', 't'].forEach((n) => S.g.vc(n, GC.ok));
    S.B.add('原本：一進一出 → 每點 degree 偶數', 'say');
    cap('原本每點 degree 偶數，是因為一進一出', '起點和終點同一點，也是出去、回來成對');
  },
  async (tok, S) => {
    S.g.vc('s', GC.hot); T('起點：先出去 1 次 → 奇數', 'bad', 0.8, 1.0);
    cap('現在起點 ≠ 終點', '起點第一次只出去（1 次），之後進出成對 → degree 奇數');
  },
  async (tok, S) => {
    S.g.vc('r', GC.hot); T('終點：最後只進來 → 奇數', 'bad', 5.9, 1.0);
    cap('終點最後只進來、不出去 → 也是奇數', '其他點還是一進一出 → 偶數');
  },
  async (tok, S) => {
    ['p', 'q', 'r', 's', 't'].forEach((n) => { const p = S.g.pos(n); T('deg ' + S.g.deg(n), 'ptr alt', p.x + 0.9, p.z + 0.5, 0.6); });
    S.B.add('條件：exactly 兩個 vertices 的 degree 是奇數', 'good');
    cap('條件變成：恰好兩個端點 degree 是奇數', '其他都是偶數（這裡 s、r 是 3）');
  },
  async (tok, S) => { S.B.add('奇數的兩點就是起點和終點', 'say'); cap('那兩個奇數 degree 的點', '一個是起點、一個是終點'); },
  async (tok, S) => { S.B.add('必要條件證明幾乎一樣：只差起點、終點', 'say'); cap('必要條件的證明跟以前幾乎一樣', 'connected 一樣；degree 只差起點、終點那兩個是奇數'); },
]);

scene('g8a-trail-proof', '充分條件：加一條想像的邊', [
  async (tok, S) => {
    S.g = quick({ ox: 3.4, oz: 0.6, s: 1.1 }, HOUSE, HOUSE_E); T('示意', 'idx', 6.2, -2.4);
    S.g.vc('s', GC.hot); S.g.vc('r', GC.hot);
    S.B = board(-7, -4.6, 0.6); S.B.add('充分條件：借用前面的證明');
    cap('充分條件', '可以借用前面 Euler circuit 的證明');
  },
  async (tok, S) => { S.B.add('先加一條 imaginary edge（想像的邊）'); cap('先在圖上加一條想像的邊', 'imaginary edge'); },
  async (tok, S) => {
    S.im = S.g.e('r', 's', { bend: -1.1, ghost: true, c: GC.purple });
    cap('連在哪？連在兩個 degree 奇數的點之間', '剛好有兩個：s 和 r');
  },
  async (tok, S) => {
    S.g.vc('s', GC.ok); S.g.vc('r', GC.ok);
    S.B.add('兩點 degree 各 +1 → 全部變偶數', 'good');
    cap('s、r 的 degree 各多 1（3 → 4）', '現在每個端點的 degree 都是偶數');
  },
  async (tok, S) => {
    S.w = walker(S.g.pos('r'));
    await go(tok, S.w, S.im, 'r', 400, GC.purple);
    for (const [a, b] of [['s', 'p'], ['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 't'], ['t', 'r']]) await go(tok, S.w, S.g.find(a, b), a, 280, GC.blue);
    S.B.add('用前面的 algorithm 找到 Euler circuit', 'say');
    cap('用前面的 algorithm', '新圖一定找得到 Euler circuit');
  },
  async (tok, S) => { S.B.add('circuit 繞一圈：從哪裡算起都可以', 'say'); cap('circuit 是繞一圈', '從任何地方當起點都可以；把新加的邊當第一條'); },
  async (tok, S) => {
    S.circ = T('r →(想像) s p q r s t r', 'note', 3.4, 3.6);
    cap('這個 circuit 第一條就是想像的邊', 'r → s，接著 s p q r s t r');
  },
  async (tok, S) => {
    S.im.show(false); settxt(S.circ, 's p q r s t r');
    S.B.add('把 imaginary edge 刪掉 → Euler trail', 'good');
    cap('把那條想像的邊刪掉', '剩下的就是 Euler trail：s p q r s t r');
  },
  async (tok, S) => { S.B.add('其他邊都走過，從一個奇點走到另一個奇點', 'say'); cap('其他所有邊都恰好走過一次', '從 s（奇）走到 r（奇）'); },
  async (tok, S) => { S.B.add('所以這是前面定理的 corollary（系理）', 'say'); cap('它可以從前面的定理直接推出來', '叫做 corollary（系理）'); },
  async (tok, S) => {
    S.B.add('circuit：connected＋全偶；trail：connected＋恰 2 奇', 'good');
    cap('總結', 'Euler circuit：connected、每點偶數；Euler trail：connected、恰兩點奇數');
  },
]);

// ════════ UteTnjk0BAk（第21B講：planar graph、K1–K5、bipartite、K_{m,n}、K2,3 planar、K3,3 畫不出來） ════════
// where two drawn edges come closest (their crossing point, if they cross)
function crossPt(e1, e2) {
  const A = e1.curve.getPoints(80), B = e2.curve.getPoints(80); let best = 1e9, pt = null;
  for (let i = 4; i < A.length - 4; i++) for (let j = 4; j < B.length - 4; j++) { const d = A[i].distanceTo(B[j]); if (d < best) { best = d; pt = A[i].clone().add(B[j]).multiplyScalar(0.5); } }
  return pt;
}
const xmark = (e1, e2, t = '✗') => { const p = crossPt(e1, e2); return T(t, 'bad', p.x, p.z, 0.9); };

scene('g8a-planar-def', 'Planar graph：可以畫在平面上、邊不交叉', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.62); S.B.add('新主題：planar graph（平面圖）'); cap('下一個主題：planar graph', ''); },
  async (tok, S) => {
    S.pl = slab('#f4ecdc', 2.8, 0.4, 7.2, 6.4, 0.04, 0.0);
    S.B.add('planar：plane（平面）的形容詞', 'say');
    cap('planar 來自 plane：平面', '簡單講：這個 graph 可以畫在一個平面上');
  },
  async (tok, S) => { S.B.add('定義：G（simple 或 multi）可以畫在平面上…'); cap('定義：一個 graph G 叫 planar', '如果它可以畫在一個平面上'); },
  async (tok, S) => {
    S.B.add('…而且 without any edge crossing', 'note');
    S.g = quick({ ox: 2.8, oz: 0.4, s: 1.1 }, { a: [-1.8, -1.8], b: [1.8, -1.8], c: [1.8, 1.8], d: [-1.8, 1.8] }, 'a-b b-c c-d d-a a-c b-d');
    T('示意', 'idx', 5.8, -2.4);
    cap('而且任兩條邊都不能交叉', '');
  },
  async (tok, S) => {
    S.g.vc('a', GC.ok); S.g.find('a', 'b').paint(GC.ok); S.g.find('a', 'd').paint(GC.ok);
    S.ok = T('交在端點上：OK', 'good', 0.6, -2.6);
    cap('邊只能交在端點上', '兩條邊在 a 碰在一起，沒問題');
  },
  async (tok, S) => {
    kill(S.ok); S.g.vc('a', GC.v); S.g.find('a', 'b').paint(GC.e); S.g.find('a', 'd').paint(GC.e);
    S.g.find('a', 'c').paint(GC.hot); S.g.find('b', 'd').paint(GC.hot);
    S.x = xmark(S.g.find('a', 'c'), S.g.find('b', 'd'), '✗ 中間沒有端點卻交叉');
    cap('但兩條邊在「沒有端點」的地方交叉', '這樣不行');
  },
  async (tok, S) => {
    kill(S.x); const e = S.g.find('b', 'd'); e.kill(); S.g.E.splice(S.g.E.indexOf(e), 1);
    S.g.e('b', 'd', { via: [[3.2, -0.4], [2.6, 3.0], [-0.4, 3.2]], c: GC.ok }); S.g.find('a', 'c').paint(GC.e);
    S.B.add('畫法有交叉沒關係：只要「有一種」畫法不交叉', 'good');
    cap('有時候是畫法讓邊相交', '換一種畫法（b–d 繞外面）就不交叉了 → 它是 planar');
  },
  async (tok, S) => { S.B.add('一個圖有很多種畫法；看起來不像，可能其實是', 'say'); cap('一個圖通常有很多種畫法', '看起來不是 planar，可能只是畫的方式不對'); },
]);

scene('g8a-planar-use', 'Planar graph 的用途與 embedding', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.62); S.B.add('planar graph 有什麼用？'); cap('planar graph 有什麼用途？', ''); },
  async (tok, S) => {
    S.g = quick({ ox: 3.0, oz: -1.6, s: 0.7, noName: true }, { a: [-2, -1], b: [0, -1.8], c: [2, -1], d: [-1, 1], e: [1, 1], f: [3, 0.8] }, 'a-b b-c a-d b-d b-e c-e e-f c-f d-e');
    T('network visualization', 'say', 3.0, -3.3);
    S.B.add('Network Visualization：把網路畫出來看相連關係', 'say');
    cap('Network Visualization', '把網路畫出來看相連關係；常希望畫成不交叉');
  },
  async (tok, S) => {
    S.pcb = slab('#2e7d4f', 3.0, 2.4, 5.6, 2.6, 0.1, 0.05);
    [-1.6, 0, 1.6].forEach((dx, i) => { slab('#d9b45a', 3.0 + dx, 2.4 - 0.6 + i * 0.6, 2.4, 0.08, 0.04, 0.13); });
    T('電路 layout（EDA）', 'say', 3.0, 3.9);
    S.B.add('EDA（Electronic Design Automation）：電路 layout', 'say');
    cap('EDA：電路設計自動化', '電路 layout 的線不希望交叉，看成圖就希望它 planar');
  },
  async (tok, S) => { S.B.add('把 planar graph 畫在平面上的畫法 → embedding'); cap('把它畫在平面上（不交叉）的那個畫法', '叫做 embedding'); },
  async (tok, S) => { S.B.add('a planar embedding（平面上的一個 embedding）', 'good'); S.g.E.forEach((e) => e.paint(GC.ok)); cap('它在平面上的一個 embedding', '名字而已'); },
]);

scene('g8a-kn', 'Complete graph：K1、K2、K3、K4 都是 planar', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.6, { maxH: 95 }); S.B.add('例子：complete graph Kₙ'); cap('看幾個例子', '先看 complete graph'); },
  async (tok, S) => { S.B.add('Kₙ：simple graph，任兩個不同點之間恰一條 edge', 'say'); cap('Kₙ 是 simple graph', '任兩個不一樣的 vertices 之間，exactly 一條 edge'); },
  async (tok, S) => { S.k1 = quick({ ox: -5.6, oz: 1.6, noName: true }, { a: [0, 0] }, ''); T('K₁', 'ptr', -5.6, 0.6); cap('K₁：一個端點', ''); },
  async (tok, S) => { S.k2 = quick({ ox: -3.6, oz: 1.6, noName: true }, { a: [-0.6, 0], b: [0.6, 0] }, 'a-b'); T('K₂', 'ptr', -3.6, 0.6); cap('K₂：兩個端點、一條邊', ''); },
  async (tok, S) => { S.k3 = quick({ ox: -1.2, oz: 1.6, noName: true }, { a: [0, -0.8], b: [-0.9, 0.7], c: [0.9, 0.7] }, 'a-b b-c c-a'); T('K₃', 'ptr', -1.2, 0.4); cap('K₃：三個端點', '任兩點之間 exactly 一條邊'); },
  async (tok, S) => { [S.k2, S.k3].forEach((g) => g.E.forEach((e) => e.paint(GC.ok))); S.B.add('K₁、K₂、K₃ 都是 planar：沒有邊相交', 'good'); cap('K₁、K₂、K₃ 都是 planar', '畫出來本身就是 embedding，沒有邊相交'); },
  async (tok, S) => {
    S.k4 = quick({ ox: 3.6, oz: 0.6, s: 1.0 }, { a: [-1.6, -1.6], b: [1.6, -1.6], c: [1.6, 1.6], d: [-1.6, 1.6] }, 'a-b b-c c-d d-a a-c b-d');
    T('K₄', 'ptr', 3.6, -1.8);
    S.B.add('K₄：4 個端點、C(4,2) = 6 條邊');
    cap('K₄：四個端點的 complete graph', '邊數 C(4,2) = 6');
  },
  async (tok, S) => {
    S.k4.find('a', 'c').paint(GC.hot); S.k4.find('b', 'd').paint(GC.hot);
    S.x = xmark(S.k4.find('a', 'c'), S.k4.find('b', 'd'));
    cap('通常畫成這樣：兩條對角線交叉', '看起來好像不是 planar');
  },
  async (tok, S) => {
    kill(S.x); const e = S.k4.find('b', 'd'); e.kill(); S.k4.E.splice(S.k4.E.indexOf(e), 1);
    const n = S.k4.e('b', 'd', { show: false, via: [[3.0, -0.6], [2.6, 3.0], [-0.6, 3.0]] });
    await wt(tok, 300); n.show(); n.paint(GC.ok); S.k4.find('a', 'c').paint(GC.e);
    cap('其實是畫法的關係', '把 b–d 改從外面繞過去，就不相交了');
  },
  async (tok, S) => { S.B.add('K₄ 是 planar：有一種畫法不交叉就算', 'good'); cap('所以 K₄ 是 planar', '只要有一種畫法邊不相交，就是 planar'); },
]);

// K5 attempt（老師的畫法順序：外框 → A 的邊 → C 的邊 → E–B → B–D 放不下）
const K5P = { A: [0, -2.3], B: [2.2, -0.7], C: [1.35, 1.9], D: [-1.35, 1.9], E: [-2.2, -0.7] };
scene('g8a-k5-try', 'K5：試著畫成平面圖（畫不出來）', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.58); S.B.add('再看 K₅'); cap('再來看 K₅', ''); },
  async (tok, S) => { S.B.add('直覺：邊太多 → 不得已一定會交叉', 'say'); cap('直覺：邊少比較不會相交', '邊太多就不得已一定會 crossing'); },
  async (tok, S) => {
    S.g = quick({ ox: 3.0, oz: 0.5, s: 1.0 }, K5P, 'A-B A-C A-D A-E B-C B-D B-E C-D C-E D-E');
    S.B.add('K₅：5 個端點、C(5,2) = 10 條邊');
    cap('K₅ 通常畫成這樣', '五個端點、C(5,2) = 10 條邊，裡面很多邊相交');
  },
  async (tok, S) => {
    S.g.kill();
    S.g = graph({ ox: 3.0, oz: 0.5, s: 1.0 }); Object.entries(K5P).forEach(([n, [x, z]]) => S.g.v(n, x, z));
    ['A-B', 'B-C', 'C-D', 'D-E', 'E-A'].forEach((k) => S.g.e(...k.split('-')));
    S.B.add('重畫：先畫外框 A B C D E', 'say');
    cap('試著重畫成不相交', '先畫外面這一框');
  },
  async (tok, S) => { S.g.e('A', 'C'); S.g.e('A', 'D'); cap('A 還要連 C、D', '先畫在裡面'); },
  async (tok, S) => {
    Object.keys(K5P).forEach((n) => { const p = S.g.pos(n); T('deg 4', 'idx', p.x + 0.7, p.z - 0.4, 0.6); });
    cap('K₅ 是 4-regular graph', '每個端點的 degree 都是 4');
  },
  async (tok, S) => {
    S.ce = S.g.e('C', 'E', { via: [[0.2, 3.1], [-2.5, 3.0], [-3.3, 1.0]] });
    cap('C 還要連 E：走裡面會跟 A–D 相交', '所以 C–E 從外面繞過 D');
  },
  async (tok, S) => {
    S.g.e('E', 'B', { via: [[-3.0, -2.3], [0, -3.6], [3.0, -2.3]] });
    cap('E 到 B 也走外面', '從 A 的上方繞過去');
  },
  async (tok, S) => { S.g.vc('B', GC.orange); S.g.vc('D', GC.orange); cap('B 有連 A、C、E 了', '還差 B–D'); },
  async (tok, S) => {
    const t1 = S.g.e('B', 'D', { c: GC.hot }); const x1 = xmark(t1, S.g.find('A', 'C'));
    await wt(tok, 900); t1.kill(); kill(x1);
    const t2 = S.g.e('B', 'D', { c: GC.hot, via: [[3.3, 1.3], [2.2, 3.6], [-0.4, 3.9], [-1.6, 3.0]] }); const x2 = xmark(t2, S.ce);
    await wt(tok, 900); t2.kill(); kill(x2);
    const t3 = S.g.e('B', 'D', { c: GC.hot, via: [[3.6, -2.6], [0, -4.4], [-3.9, -1.0], [-3.7, 2.4], [-2.0, 3.4]] }); const x3 = xmark(t3, S.ce);
    await wt(tok, 900); t3.kill(); kill(x3);
    cap('B–D 走裡面：跟 A–C 相交', '走右邊外面、走左邊外面：都會跟 C–E 相交');
  },
  async (tok, S) => { T('B–D 放不下！', 'bad', 3.0, 0.5); S.B.add('這樣畫不 work：B–D 不知道放哪', 'bad'); cap('這條邊不知道放哪裡', '這樣畫不行'); },
  async (tok, S) => { S.B.add('但這不是證明：你畫不出來 ≠ 別人畫不出來', 'say'); cap('但這不是證明', '我這樣畫不出來，不代表沒有別的畫法'); },
  async (tok, S) => { S.B.add('後面會證明：K₅ 真的 non-planar', 'good'); cap('後面會用數學證明 K₅ 不是 planar', '不管怎麼畫，邊一定會相交'); },
]);

scene('g8a-k5-more', '方向無關；K5 之後更不是', [
  async (tok, S) => { S.B = board(-6, -3.6, 0.8); S.B.add('planar 的定義沒說 directed 或 undirected'); cap('planar 的定義', '沒有說是 directed 還是 undirected graph'); },
  async (tok, S) => {
    S.B.add('directed：planar 畫法上加箭頭還是 planar → 只討論 undirected', 'say');
    S.d = quick({ ox: 3.4, oz: 1.6, s: 0.9, noName: true }, { a: [-1.4, -1], b: [1.4, -1], c: [0, 1.2] }, 'a-b b-c c-a');
    [['a', 'b'], ['b', 'c'], ['c', 'a']].forEach(([u, v]) => { const p = S.d.find(u, v).curve.getPoint(0.62), q = S.d.find(u, v).curve.getPoint(0.7); arrow(V3(p.x, 0.35, p.z), V3(q.x, 0.35, q.z), 0x6e5f49); });
    cap('邊有沒有方向跟能不能畫在平面上無關', '所以只要討論 undirected graph');
  },
  async (tok, S) => { S.B.add('第一個 case：K₅ non-planar', 'bad'); cap('目前碰到的第一個例子', 'K₅ 是 non-planar'); },
  async (tok, S) => { S.B.add('K₆、K₇…邊更多 → 也不是', 'say'); cap('K₆ 以後邊更多', '當然也不是 planar'); },
]);

scene('g8a-bip', 'Bipartite graph 與 complete bipartite K_{m,n}', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.56); S.B.add('另一類圖：bipartite graph'); cap('再介紹另一類圖', 'bipartite graph'); },
  async (tok, S) => {
    S.g = quick({ ox: 3.0, oz: 0.4 }, { a: [-1.8, -2], b: [-1.8, 0], c: [-1.8, 2], x: [1.8, -2], y: [1.8, 0], z: [1.8, 2] }, 'a-x a-y b-y b-z c-x c-z');
    T('示意', 'idx', 5.6, -3);
    S.B.add('bipartition：分成兩部分', 'say');
    cap('bipartite 來自 bipartition', '把東西分成兩部分');
  },
  async (tok, S) => { S.B.add('分的是 vertex set（端點的集合）', 'say'); cap('分成兩部分的是 vertex set', '所有端點構成的集合'); },
  async (tok, S) => {
    S.z1 = zone('V₁', 1.2, 0.02, 0.4, 1.4, 5.6, '#dcebf7'); S.z2 = zone('V₂', 4.8, 0.02, 0.4, 1.4, 5.6, '#f7e0ea');
    ['a', 'b', 'c'].forEach((n) => S.g.vc(n, GC.blue)); ['x', 'y', 'z'].forEach((n) => S.g.vc(n, GC.pink));
    S.B.add('V = V₁ ∪ V₂，V₁ ∩ V₂ = ∅（partition）', 'say');
    cap('分成兩個 disjoint 的子集合 V₁、V₂', '交集是空集合，聯集是全部端點');
  },
  async (tok, S) => { S.g.E.forEach((e) => e.paint(GC.ok)); S.B.add('每條邊：一端在 V₁、一端在 V₂', 'note'); cap('每條邊的一個端點在 V₁', '另一個端點在 V₂'); },
  async (tok, S) => {
    const b1 = S.g.e('a', 'b', { c: GC.hot, bend: 0.4 }); const b2 = S.g.e('x', 'z', { c: GC.hot, bend: -0.6 });
    S.no = T('✗ 同一邊之間不能有邊', 'bad', 3.0, 3.2); await wt(tok, 1200); b1.kill(); b2.kill(); S.g.E.splice(-2, 2);
    S.B.add('V₁ 內部沒有邊、V₂ 內部也沒有邊', 'say');
    cap('V₁ 的端點之間沒有邊', 'V₂ 的端點之間也沒有');
  },
  async (tok, S) => { kill(S.no); S.B.add('這叫 bipartition；matching 時還會再看到', 'say'); cap('這樣的分法叫 bipartition', '後面講 matching problem 還會用到'); },
  async (tok, S) => { S.B.add('Complete bipartite graph K_{m,n}'); cap('接著介紹 complete bipartite graph', 'K_{m,n}'); },
  async (tok, S) => { S.B.add('V₁ 有 m 個端點、V₂ 有 n 個端點', 'say'); cap('一邊有 m 個端點，一邊有 n 個', '這裡 m = n = 3'); },
  async (tok, S) => {
    [['a', 'z'], ['b', 'x'], ['c', 'y']].forEach(([u, v]) => S.g.e(u, v, { c: GC.gold }));
    S.B.add('V₁ 每點和 V₂ 每點恰一條 edge（simple）→ K₃,₃', 'good');
    cap('V₁ 每個端點和 V₂ 每個端點都恰有一條邊', '補齊後就是 K₃,₃（9 條邊）');
  },
]);

scene('g8a-kmn', 'K1,1、K1,2、K2,1、K2,2、K2,3 都是 planar', [
  async (tok, S) => { S.a = quick({ ox: -6.0, oz: -2.6, s: 0.6, noName: true }, { l: [-0.9, 0], r: [0.9, 0] }, 'l-r'); T('K₁,₁', 'ptr', -6.0, -3.6); cap('K₁,₁：兩邊各一個端點', '連一條邊'); },
  async (tok, S) => { S.b = quick({ ox: -3.6, oz: -2.6, s: 0.6, noName: true }, { l: [-0.9, 0], r1: [0.9, -0.8], r2: [0.9, 0.8] }, 'l-r1 l-r2'); T('K₁,₂', 'ptr', -3.6, -3.6); cap('K₁,₂：一邊一個、一邊兩個', '左邊的點連到右邊每個點'); },
  async (tok, S) => { S.c = quick({ ox: -1.2, oz: -2.6, s: 0.6, noName: true }, { l1: [-0.9, -0.8], l2: [-0.9, 0.8], r: [0.9, 0] }, 'l1-r l2-r'); T('K₂,₁', 'ptr', -1.2, -3.6); cap('K₂,₁：把 K₁,₂ 反過來', ''); },
  async (tok, S) => {
    S.d = quick({ ox: 3.6, oz: -1.8, s: 0.8, noName: true }, { l1: [-1.4, -1], l2: [-1.4, 1], r1: [1.4, -1], r2: [1.4, 1] }, 'l1-r1 l1-r2 l2-r1 l2-r2');
    T('K₂,₂', 'ptr', 3.6, -3.2);
    S.x = xmark(S.d.find('l1', 'r2'), S.d.find('l2', 'r1'));
    cap('K₂,₂：左右各兩個端點', '左邊每點都連到右邊每點');
  },
  async (tok, S) => {
    kill(S.x); const e = S.d.find('l1', 'r2'); e.kill(); S.d.E.splice(S.d.E.indexOf(e), 1);
    S.d.e('l1', 'r2', { via: [[0, -2.2], [2.7, -1.6], [2.7, 0.6]], c: GC.ok });
    cap('這樣畫好像不是 planar', '把那條邊改從外面繞，就沒交叉 → K₂,₂ 也是 planar');
  },
  async (tok, S) => {
    S.e = quick({ ox: -1.0, oz: 2.0, s: 0.75 }, { L1: [-1.6, -0.8], L2: [-1.6, 0.8], R1: [1.6, -1.6], R2: [1.6, 0], R3: [1.6, 1.6] }, 'L1-R1 L1-R2 L1-R3 L2-R1 L2-R2 L2-R3');
    T('K₂,₃', 'ptr', -1.0, 0.4);
    cap('K₂,₃：左邊兩個、右邊三個', '左邊任一點和右邊任一點都有一條邊');
  },
  async (tok, S) => {
    S.xs = [xmark(S.e.find('L1', 'R3'), S.e.find('L2', 'R2')), xmark(S.e.find('L1', 'R2'), S.e.find('L2', 'R1'))];
    await wt(tok, 900);
    S.xs.forEach(kill);
    ['L2-R1', 'L2-R2'].forEach((k) => { const e = S.e.find(...k.split('-')); e.kill(); S.e.E.splice(S.e.E.indexOf(e), 1); });
    cap('這樣畫有 edge crossing', '試著重畫：L1 的三條先畫好，L2–R3 直接連');
  },
  async (tok, S) => {
    S.e.e('L2', 'R2', { via: [[-0.4, 2.6], [2.6, 2.4], [2.7, 0.2]], c: GC.ok });
    S.e.e('L2', 'R1', { via: [[-2.8, 0.6], [-2.6, -2.4], [0.4, -2.8]], c: GC.ok });
    cap('剩下兩條直接畫會交叉', '那就繞到外面：一條繞下面、一條繞上面');
  },
  async (tok, S) => { T('K₂,₃、K₃,₂：planar', 'good', -1.0, 4.4); cap('所以 K₂,₃ 是 planar', 'K₃,₂ 只是把它翻過來，也是 planar'); },
  async (tok, S) => {
    [S.a, S.b, S.c, S.d, S.e].forEach((g) => g.E.forEach((e) => e.paint(GC.ok)));
    T('K₁,₁ K₁,₂ K₂,₁ K₂,₂ K₂,₃ K₃,₂ 都是 planar', 'good', 3.6, 1.2);
    cap('小結', 'K₁,₁、K₁,₂、K₂,₁、K₂,₂、K₂,₃、K₃,₂ 都可以畫在平面上');
  },
]);

// K3,3 attempt（左 A B C、右 D E F；A、C 的邊先畫成 K2,3 的樣子；B–E 放不下）
scene('g8a-k33-try', 'K3,3：畫不出來（還不是證明）', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.58); S.B.add('下一個：K₃,₃'); cap('再來是 K₃,₃', ''); },
  async (tok, S) => {
    S.g = graph({ ox: 2.8, oz: 0.6, s: 0.85 });
    const P0 = { A: [-3, 0], C: [3, 0], D: [0, -1.6], E: [0, 0], F: [0, 1.6], B: [0, -3.4] };
    Object.entries(P0).forEach(([n, [x, z]]) => S.g.v(n, x, z, { c: 'ABC'.includes(n) ? GC.blue : GC.pink }));
    S.B.add('六個端點：左 A B C、右 D E F；共 3 × 3 = 9 條邊', 'say');
    cap('左邊三點 A、B、C，右邊三點 D、E、F', '左邊每一點都要連到右邊每一點：9 條邊');
  },
  async (tok, S) => {
    ['A-D', 'A-E', 'A-F', 'C-D', 'C-E', 'C-F'].forEach((k) => S.g.e(...k.split('-')));
    S.B.add('A、C 的邊先畫好（像 K₂,₃ 的畫法）', 'say');
    cap('先畫 A 的三條邊', 'C 照剛才 K₂,₃ 的方式畫，沒有交叉');
  },
  async (tok, S) => {
    S.g.e('B', 'D');
    S.bf = S.g.e('B', 'F', { via: [[3.8, -2.8], [4.5, 0], [3.6, 2.7], [1.0, 2.9]] });
    cap('B–D 直接連', 'B–F 繞外面過去');
  },
  async (tok, S) => {
    S.g.vc('B', GC.orange); S.g.vc('E', GC.orange);
    S.B.add('問題：B–E 不知道放哪裡', 'bad');
    cap('剩下 B–E', 'E 被 A、C 的邊圍在中間');
  },
  async (tok, S) => {
    const tries = [[[-1.3, -1.6]], [[1.3, -1.6]], [[-4.2, -1.6], [-3.6, 2.6], [-1.2, 1.2]]];
    const hit = [['A', 'D'], ['C', 'D'], ['A', 'F']];
    for (let i = 0; i < 3; i++) { const t = S.g.e('B', 'E', { c: GC.hot, via: tries[i] }); const x = xmark(t, S.g.find(...hit[i])); await wt(tok, 900); t.kill(); kill(x); }
    cap('B–E 走裡面會 cross，走外面還是會 cross', '三種走法都會跟別的邊相交');
  },
  async (tok, S) => { S.B.add('這樣畫不 work：找不到 planar embedding', 'bad'); cap('這樣畫沒辦法把 B–E 放上去又不交叉', '找不到 K₃,₃ 的 planar embedding'); },
  async (tok, S) => { S.B.add('但一樣不是證明；後面給數學證明', 'say'); cap('一樣：我畫不出來不是證明', '後面會給數學證明說它不是 planar'); },
  async (tok, S) => { S.B.add('證明會用到邊數、頂點數等性質', 'say'); cap('證明跟邊的個數、vertex 個數有關', 'planar graph 會滿足一些性質，K₃,₃ 不滿足'); },
  async (tok, S) => { S.B.add('K₃,₄ 更不是：它含有 K₃,₃', 'say'); cap('K₃,₄ 更不是', '它裡面有一部分就是 K₃,₃；一部分畫不了，整個更畫不了'); },
  async (tok, S) => { S.B.add('K₅、K₃,₃ non-planar；Kuratowski 定理的主角', 'good'); cap('目前兩個 case：K₅、K₃,₃ 都不是 planar', '後面的 Kuratowski 定理裡，它們扮演很重要的角色'); },
]);

// ════════ otP5yRAYc9w（第21C講：regions、Euler 公式 v − e + r = 2、對邊數歸納：基底與 case 1） ════════
// 老師的兩個例子：K4（4 點、6 邊、4 regions）與一個 7 點、11 邊、6 regions 的圖（黑板圖看不到，這裡用六邊形＋5 條輻條示意）。
const RG = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0'];
function k4emb(ox, oz, s = 0.85) {
  const g = quick({ ox, oz, s }, { a: [0, -2.4], b: [-2.2, 1.4], c: [2.2, 1.4], d: [0, 0.1] }, 'a-b b-c c-a a-d b-d c-d');
  g.faces = [['a', 'b', 'd'], ['b', 'c', 'd'], ['c', 'a', 'd']];
  return g;
}
function hexg(ox, oz, s = 0.85) {
  const g = quick({ ox, oz, s }, { a: [-1.8, -1.5], b: [0, -2.4], c: [1.8, -1.5], d: [1.8, 1.2], e: [0, 2.1], f: [-1.8, 1.2], g: [0, 0] }, 'a-b b-c c-d d-e e-f f-a g-a g-b g-c g-d g-e');
  g.faces = [['g', 'a', 'b'], ['g', 'b', 'c'], ['g', 'c', 'd'], ['g', 'd', 'e'], ['g', 'e', 'f', 'a']];
  return g;
}
function fillFaces(g, lbl0 = 1) {
  return g.faces.map((cyc, i) => {
    const walk = cyc.map((n, k) => [g.find(n, cyc[(k + 1) % cyc.length]), n]);
    const m = g.region(walk, RG[i % RG.length]);
    const c = cyc.reduce((s, n) => [s[0] + g.pos(n).x / cyc.length, s[1] + g.pos(n).z / cyc.length], [0, 0]);
    const l = T('R' + (lbl0 + i), 'ptr', c[0], c[1], 0.5);
    return { m, l };
  });
}

scene('g8a-regions', 'Embedding 把平面切成 regions', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.56, { maxH: 52 }); S.B.add('planar graph 畫在平面上（embedding）以後…'); cap('planar graph 的性質', '把它畫在平面上（一個 embedding）以後'); },
  async (tok, S) => { S.B.add('…平面被切成好幾個 regions', 'note'); cap('平面被切成好幾個 regions', 'an embedding splits the plane into regions'); },
  async (tok, S) => { S.L = k4emb(-3.4, 0.9); T('K₄ 的 planar embedding', 'say', -3.4, -1.8); cap('例子：K₄ 的 planar embedding', '畫在平面上，邊都不交叉'); },
  async (tok, S) => {
    fillFaces(S.L); T('R4（外面整塊）', 'ptr alt', -3.4, 3.4);
    cap('它把平面分成四塊：R1、R2、R3', '加上外面無限大的那塊 R4，一共 4 個 regions');
  },
  async (tok, S) => {
    S.R = hexg(3.4, 0.9); fillFaces(S.R); T('R6（外面）', 'ptr alt', 3.4, 3.4); T('示意', 'idx', 6, -1.6);
    cap('再一個例子', '裡面 5 塊、外面 1 塊，一共 6 個 regions');
  },
  async (tok, S) => { S.cL = T('v = 4、e = 6、r = 4', 'note', -3.4, 4.2); cap('左邊 K₄：4 個端點、6 條邊', '還有 4 個 regions'); },
  async (tok, S) => { S.B.add('region 要有 planar embedding 才數得出來', 'say'); cap('vertex、edge 以前就會數，現在多一個 region', '必須是 planar embedding；有交叉的話，交叉那裡不知道怎麼算'); },
  async (tok, S) => { S.cR = T('v = 7、e = 11、r = 6', 'note', 3.4, 4.2); cap('右邊：7 個 vertices、11 條 edges', '6 個 regions'); },
  async (tok, S) => { S.B.add('4、6、4 和 7、11、6 有什麼關係？'); cap('這幾個數字之間有什麼關係？', '加一加、減一減看看'); },
  async (tok, S) => {
    settxt(S.cL, '4 − 6 + 4 = 2'); settxt(S.cR, '7 − 11 + 6 = 2'); cls(S.cL, 'good'); cls(S.cR, 'good');
    S.B.add('v + r 比 e 多 2：v − e + r = 2', 'good');
    cap('vertex 加 region 比 edge 多 2', '4 − 6 + 4 = 2，7 − 11 + 6 = 2');
  },
  async (tok, S) => { S.B.add('多試幾個：always 是 2', 'say'); cap('多試幾個圖就會發現', 'planar graph 的這幾個數字 always 有這個關係'); },
]);

scene('g8a-euler-thm', 'Euler 公式：v − e + r = 2', [
  async (tok, S) => { S.B = board(-7, -4.4, 0.66); S.B.add('假設 G connected（不連通就每個 component 分開）', 'say'); S.R = hexg(3.4, 0.6); cap('先假設 G 是 connected', '如果有好幾個 component，就每個分開算'); },
  async (tok, S) => { S.B.add('connected planar graph：v 個點、e 條邊、r 個 regions'); fillFaces(S.R); cap('connected planar graph', 'vertex 數 v、edge 數 e、region 數 r'); },
  async (tok, S) => { S.B.add('Euler’s Theorem for Planar Graphs'); cap('這個關係叫做', 'Euler Theorem for planar graphs'); },
  async (tok, S) => { S.B.add('v − e + r = 2', 'good'); T('7 − 11 + 6 = 2', 'good', 3.4, 3.6); cap('v − e + r = 2', '自己多畫幾個試試看，都會是 2'); },
  async (tok, S) => { S.B.add('要有 planar embedding 才能分出 regions', 'say'); cap('這是對 planar graph 的 embedding 說的', '這樣才能把 region 分出來'); },
  async (tok, S) => { S.B.add('證明：數學歸納法'); cap('怎麼證？用數學歸納法', ''); },
  async (tok, S) => { S.B.add('對誰歸納？對 edges 的個數 e', 'note'); cap('有 v、e、r 三個數，要選一個做歸納', '選 edge 的個數'); },
]);

scene('g8a-base', '歸納基底：0 條邊、1 條邊', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.6, { maxH: 110 }); S.B.add('initial condition：e = 0 和 e = 1'); cap('先 check initial condition', '0 條邊和 1 條邊這兩個 case'); },
  async (tok, S) => { S.B.add('simple 或 multigraph 都可以（可以有 loop）', 'say'); cap('這裡沒有要求 simple graph', 'multigraph 也 OK，所以可以有 loop'); },
  async (tok, S) => { S.B.add('把所有可能的情況都舉出來 check', 'say'); cap('0 條邊、1 條邊的情況很少', '全部列出來 check 就好'); },
  async (tok, S) => {
    S.a = quick({ ox: -4.6, oz: 1.6, noName: true }, { v: [0, 0] }, ''); T('(A) 0 條邊', 'ptr', -4.6, 0.3);
    cap('沒有邊：只有一個點', '兩個點就不 connected 了');
  },
  async (tok, S) => {
    S.b = graph({ ox: 0, oz: 1.6, noName: true }); S.b.v('v', -0.6, 0);
    S.lp = S.b.e('v', 'v', { via: [[0.2, -1.1], [1.3, 0], [0.2, 1.1]] }); T('(B) 1 條邊：loop', 'ptr', 0, 0.3);
    cap('一條邊：可以是 loop', '一個端點繞一圈（multigraph 允許）');
  },
  async (tok, S) => { S.c = quick({ ox: 4.4, oz: 1.6, noName: true }, { u: [-1, 0], v: [1, 0] }, 'u-v'); T('(C) 1 條邊：兩個端點', 'ptr', 4.4, 0.3); cap('或是兩個不同的端點、一條邊', '再多加點就不 connected，所以只有這三種'); },
  async (tok, S) => { S.B.add('check 三種：v − e + r 是否都 = 2'); cap('check 這三種', 'v − e + r 是不是都等於 2'); },
  async (tok, S) => { T('1 − 0 + 1 = 2', 'good', -4.6, 3.2); cap('一個點：v = 1、e = 0、r = 1', '1 − 0 + 1 = 2'); },
  async (tok, S) => { S.b.region([[S.lp, 'v']], GC.blue); T('裡', 'ptr alt', 0, 1.6, 0.5); T('1 − 1 + 2 = 2', 'good', 0, 3.2); cap('loop：一個點、一條邊', '裡面、外面兩個 regions：1 − 1 + 2 = 2'); },
  async (tok, S) => { T('2 − 1 + 1 = 2', 'good', 4.4, 3.2); cap('兩點一邊：只有一個 region', '2 − 1 + 1 = 2'); },
  async (tok, S) => { S.B.add('三種都滿足 → initial condition OK', 'good'); cap('三種都滿足 v − e + r = 2', 'initial condition 檢查完畢'); },
], CAMR);

// case D / E / F（拿掉一條邊後仍 connected）
function caseG(kind, ox, oz) {
  const g = graph({ ox, oz, s: 0.7, noName: true });
  if (kind === 'D') { g.v('a', -1, 0.8); g.v('b', 1, 0.8); g.v('c', 0, -0.9); ['a-b', 'b-c', 'c-a'].forEach((k) => g.e(...k.split('-'))); g.rm = g.e('c', 'c', { via: [[-0.9, -1.8], [0, -2.6], [0.9, -1.8]], c: GC.hot }); }
  else {
    g.v('a', -1.1, -1.1); g.v('b', 1.1, -1.1); g.v('c', 1.1, 1.1); g.v('d', -1.1, 1.1);
    ['a-b', 'b-c', 'c-d', 'd-a', 'a-c'].forEach((k) => g.e(...k.split('-')));
    g.rm = kind === 'E' ? g.find('a', 'c') : g.find('a', 'b'); g.rm.paint(GC.hot);
  }
  return g;
}
scene('g8a-indstep', '歸納步驟：拿掉一條邊', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.56); S.B.add('歸納假設：0～k 條邊的 connected planar graph 都滿足'); cap('induction hypothesis', 'edge 數從 0 到 k 的 connected planar graph，都滿足 v − e + r = 2'); },
  async (tok, S) => { S.G = hexg(3.4, -0.6, 0.75); T('G：v 點、k+1 邊、r 個 regions', 'say', 3.4, -3.1); S.B.add('induction step：G 有 k+1 條邊'); cap('induction step', 'G 有 v 個 vertices、k+1 條 edges、r 個 regions'); },
  async (tok, S) => { S.B.add('想用假設 → 拿掉一條邊，變成 k 條', 'say'); cap('要證 G 也成立', '怎麼用到「k 條邊」的假設？拿掉一條邊就好'); },
  async (tok, S) => { S.ab = S.G.find('g', 'c'); S.ab.paint(GC.hot); T('任取一條邊 ab', 'bad', 5.6, -0.6); cap('任取一條邊，叫 ab', 'a、b 都在 vertex set 裡'); },
  async (tok, S) => { S.ab.show(false); S.B.add('拿掉 ab，剩下的圖叫 H：邊少 1', 'say'); cap('把 ab 拿掉，剩下的圖叫 H', 'H 只有 k 條邊'); },
  async (tok, S) => { S.B.add('點、邊、region 的變化都掌握得到 → 代進假設', 'say'); cap('拿掉之後，點、邊、region 個數怎麼變', '都看得出來，就能代進歸納假設'); },
  async (tok, S) => { S.B.add('但定理只對 connected 成立；拿掉後可能不 connected', 'bad'); cap('小心：定理只對 connected graph', '拿掉一條邊可能就不 connected 了，要分兩個 case'); },
  async (tok, S) => { S.B.add('Case 1：H 還是 connected', 'note'); cap('Case 1：拿掉之後 H 還是 connected', ''); },
  async (tok, S) => { S.d = caseG('D', -5.2, 2.6); T('(D) 拿掉 loop', 'ptr', -5.2, 3.9); cap('第一種：拿掉的邊是 loop', 'a = b，同一個端點'); },
  async (tok, S) => { S.e = caseG('E', -1.4, 2.6); T('(E) 不是 loop，在裡面', 'ptr', -1.4, 3.9); cap('不是 loop：影響的是裡面的 region', ''); },
  async (tok, S) => { S.f = caseG('F', 2.4, 2.6); T('(F) 不是 loop，在外圍', 'ptr', 2.4, 3.9); cap('不是 loop：影響的是外面的 region', ''); },
  async (tok, S) => { [S.d, S.e, S.f].forEach((g) => g.rm.show(false)); cap('D、E、F 三種：拿掉以後還是 connected', '不 connected 的放到 case 2'); },
]);

scene('g8a-case1', 'Case 1：v − (k+1) + r = 2', [
  async (tok, S) => {
    S.g = graph({ ox: 3.4, oz: 0.4, s: 1.1 }); [['a', -1.8, -1.8], ['b', 1.8, -1.8], ['c', 1.8, 1.8], ['d', -1.8, 1.8]].forEach(([n, x, z]) => S.g.v(n, x, z));
    ['a-b', 'b-c', 'c-d', 'd-a', 'a-c'].forEach((k) => S.g.e(...k.split('-'))); S.rm = S.g.find('a', 'c'); S.rm.paint(GC.hot);
    S.f1 = S.g.region([[S.g.find('a', 'b'), 'a'], [S.g.find('b', 'c'), 'b'], [S.rm, 'c']], RG[0]);
    S.f2 = S.g.region([[S.rm, 'a'], [S.g.find('c', 'd'), 'c'], [S.g.find('d', 'a'), 'd']], RG[1]);
    T('示意（case E）', 'idx', 6.0, -2.6);
    S.B = board(-7, -4.6, 0.62); S.B.add('看拿掉一條邊時，數字怎麼變');
    cap('看看 D、E、F 三種情況', '點、邊、region 個數怎麼變');
  },
  async (tok, S) => { S.B.add('vertices：沒變，還是 v', 'say'); cap('拿掉邊，端點沒有拿掉', 'vertex 數還是 v'); },
  async (tok, S) => { S.rm.show(false); S.B.add('edges：k+1 → k', 'say'); cap('edge 從 k+1 條變 k 條', ''); },
  async (tok, S) => { S.f1.material.color.set(RG[2]); S.f2.material.color.set(RG[2]); S.B.add('regions：少一個（兩塊合成一塊）→ r − 1', 'say'); cap('region 都少一個', '原本被這條邊隔開的兩塊，合成一塊'); },
  async (tok, S) => { S.B.add('H 只有 k 條邊 → 歸納假設可以用'); cap('H 只有 k 條邊，又是 connected planar', '所以 induction hypothesis 可以用在 H'); },
  async (tok, S) => { S.B.add('v − k + (r − 1) = 2', 'note'); cap('代進去', 'v − k + (r − 1) = 2'); },
  async (tok, S) => { S.B.add('移項：v − (k+1) + r = 2', 'good'); cap('把 1 移一下', 'v − (k+1) + r = 2'); },
  async (tok, S) => { S.B.add('k+1 正是 G 的邊數 → G 成立', 'good'); cap('k+1 就是原來 G 的 edge 數', '所以 G 也滿足：induction step 成立'); },
  async (tok, S) => { S.B.add('G：v、k+1、r　→　H：v、k、r − 1', 'say'); cap('整理：G 有 v、k+1、r', '拿掉一條邊後 H 有 v、k、r−1，代入假設再整理就得到 G'); },
  async (tok, S) => { S.B.add('若不 connected：變兩個 component → Case 2', 'bad'); cap('如果拿掉後不 connected', '會變成兩個 component，要分別用假設：下一段的 case 2'); },
]);

// ════════ ogk1m2TvR0I（第21D講：case 2 兩個 component、證明回顧、girth） ════════
scene('g8a-case2', 'Case 2：拿掉後變兩個 component', [
  async (tok, S) => {
    S.g = quick({ ox: 3.0, oz: -0.6, s: 1.0 }, { p: [-3.2, -1.2], q: [-3.2, 1.2], a: [-1.2, 0], b: [1.2, 0], r: [3.2, -1.2], s: [3.2, 1.2] }, 'a-p p-q q-a b-r r-s s-b a-b');
    T('示意', 'idx', 6.2, -2.4);
    S.ab = S.g.find('a', 'b'); S.ab.paint(GC.hot);
    await wt(tok, 600); S.ab.show(false);
    S.B = board(-7, -4.8, 0.52);
    S.B.add('Case 2：拿掉 ab 後變兩個 component');
    cap('拿掉 ab 這條邊', '圖斷成兩個 component');
  },
  async (tok, S) => { T('(G) 這個 case', 'ptr', 3.0, -3.3); cap('這種情況叫 case (G)', '兩邊不會再有邊連過來，不然就還是 connected'); },
  async (tok, S) => {
    zone('H₁', 0.8, 0.02, -0.6, 3.6, 3.6, '#dcebf7'); zone('H₂', 5.2, 0.02, -0.6, 3.6, 3.6, '#f7e0ea');
    S.B.add('H 有兩個 component：H₁、H₂', 'say');
    cap('H 有兩個 component', 'H₁ 和 H₂');
  },
  async (tok, S) => { S.B.add('G planar → 拿掉邊還是 planar；H₁、H₂ 各自 connected planar', 'say'); cap('G 是 planar，拿掉一條邊還是 planar', '兩個 component 各自是 connected planar graph'); },
  async (tok, S) => { S.B.add('邊數都 ≤ k → 各自滿足 Euler 定理', 'say'); cap('原本 k+1 條邊，拿掉一條', '兩個 component 的邊數都不超過 k，都滿足歸納假設'); },
  async (tok, S) => {
    S.l1 = T('v₁=3 e₁=3 r₁=2', 'note', 0.8, 1.9); S.l2 = T('v₂=3 e₂=3 r₂=2', 'note', 5.2, 1.9);
    S.B.add('Hᵢ：vᵢ 個點、eᵢ 條邊、rᵢ 個 regions（i = 1, 2）', 'say');
    cap('H₁ 有 v₁ 點、e₁ 邊、r₁ regions', 'H₂ 有 v₂、e₂、r₂（數字是示意圖的）');
  },
  async (tok, S) => { S.B.add('v₁ + v₂ = v（端點沒變）', 'good'); cap('端點都沒變', 'v₁ + v₂ = v（3 + 3 = 6）'); },
  async (tok, S) => { S.B.add('e₁ + e₂ = (k+1) − 1 = k', 'good'); cap('只拿掉一條邊', 'e₁ + e₂ = k（3 + 3 = 7 − 1）'); },
  async (tok, S) => {
    S.ab.show(true); S.ab.paint(GC.purple); S.out = T('ab 兩側都是外面那塊', 'bad', 3.0, 1.0);
    cap('被拿掉的 ab，兩側是同一個 region（這裡是外面那塊）', '兩側若是不同 region，ab 在某個 cycle 上，拿掉不會斷開');
  },
  async (tok, S) => {
    S.ab.show(false); kill(S.out);
    S.B.add('分開算時外面那塊算了兩次：r₁ + r₂ = r + 1', 'good');
    cap('region 總數其實沒變', '但分開算時，外面那塊在 H₁、H₂ 各算一次：r₁ + r₂ = r + 1（2 + 2 = 3 + 1）');
  },
  async (tok, S) => { S.B.add('v₁ − e₁ + r₁ = 2，v₂ − e₂ + r₂ = 2', 'note'); cap('兩個 component 各自用歸納假設', 'v₁ − e₁ + r₁ = 2，v₂ − e₂ + r₂ = 2'); },
  async (tok, S) => { S.B.add('相加：(v₁+v₂) − (e₁+e₂) + (r₁+r₂) = 4', 'say'); cap('把兩個式子加起來', '等於 4'); },
  async (tok, S) => { S.B.add('代入：v − k + (r + 1) = 4', 'say'); cap('代入剛剛的關係', 'v − k + (r + 1) = 4'); },
  async (tok, S) => { S.B.add('⇒ v − (k+1) + r = 2：G 成立', 'good'); cap('整理', 'v − (k+1) + r = 2，所以 G 也滿足 Euler 定理'); },
  async (tok, S) => { S.B.add('兩個 case 都成立 → 證完', 'good'); cap('兩個 case 都證完了', 'v − e + r = 2 對所有 connected planar graph 成立'); },
]);

scene('g8a-proof-recap', '證明回顧，以及「把 r 消掉」的想法', [
  async (tok, S) => { S.B = board(-6.4, -4.6, 0.62); S.B.add('證明：對邊數做 induction'); cap('簡單講：用 induction', '對邊的數目做'); },
  async (tok, S) => { S.B.add('0、1 先 check：拿掉一條邊後可能變成 0 或 1', 'say'); cap('0 和 1 條邊先 check', '因為切下去可能變成 0 或 1 條邊'); },
  async (tok, S) => { S.B.add('induction step：≤ k 都成立 ⇒ k+1 成立', 'say'); cap('induction step', '假設邊數不超過 k 都成立，證 k+1 也成立'); },
  async (tok, S) => { S.B.add('拿掉一條邊：connected 直接用；兩個 component 分別用', 'say'); cap('拿掉一條邊再用假設', '還 connected 就直接用；斷成兩個 component 就分別用'); },
  async (tok, S) => {
    S.g = hexg(3.6, 1.4, 0.7); fillFaces(S.g);
    S.B.add('定理對 planar graph：要有 embedding 才算得出 r', 'note');
    cap('這個定理是對 planar graph', '要先有 embedding 畫在平面上，才能分 region、數 r');
  },
  async (tok, S) => { S.B.add('想判斷「是不是 planar」：畫不出 embedding → 數不了 r', 'bad'); cap('但如果要判斷一個圖是不是 planar', '它根本可能畫不出 embedding，就沒辦法數 region'); },
  async (tok, S) => { S.B.add('所以要把 r 消掉：換成不等式', 'note'); cap('所以要想辦法把 r 弄掉', '用一個不等式把它換掉'); },
  async (tok, S) => { S.B.add('得到 e 和 v 的不等式：planar 的必要條件', 'good'); cap('就會得到 edge、vertex 之間的一個不等式', '它是 planar graph 的必要條件'); },
  async (tok, S) => { S.B.add('不等式不成立 → 一定不是 planar', 'bad'); cap('如果不等式不成立', '那就一定不是 planar'); },
]);

scene('g8a-girth-def', 'Girth：最短 cycle 的長度', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.58); S.B.add('還需要另一個量'); cap('要得到那個不等式', '除了 edge、vertex 個數，還需要另一個量'); },
  async (tok, S) => { S.B.add('girth（圍長）', 'note'); cap('這個量叫做 girth', ''); },
  async (tok, S) => { S.B.add('undirected graph 的 girth = 最短 cycle 的長度'); cap('undirected graph 的 girth', '就是圖裡最短的 cycle 的長度'); },
  async (tok, S) => {
    S.g = quick({ ox: 3.2, oz: -0.6, s: 1.0 }, { a: [-1.6, -1.2], b: [0, -2.2], c: [1.6, -1.2], d: [1.6, 0.8], e: [0, 1.8], f: [-1.6, 0.8] }, 'a-b b-c c-d d-e e-f f-a');
    T('示意', 'idx', 5.8, -2.8);
    S.w = walker(S.g.pos('a'));
    for (const [x, y] of [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a']]) await go(tok, S.w, S.g.find(x, y), x, 250, GC.ok);
    S.B.add('cycle：繞一圈回來，點、邊都不重複（頭尾除外）', 'say');
    cap('cycle：走一圈回到起點', '邊不能重複，端點也不能重複（除了頭尾同一點）');
  },
  async (tok, S) => { S.len6 = T('長度 6', 'ptr alt', 3.2, -0.6); cap('最短的那個 cycle 的長度', '就叫這個圖的 girth'); },
  async (tok, S) => { kill(S.w); kill(S.len6); S.g.kill(); S.B.add('沒有 cycle：定義成全部 edges 的個數', 'note'); cap('如果圖根本沒有 cycle 呢？', '這裡把 girth 定義成全部 edge 的個數'); },
  async (tok, S) => { S.B.add('（為了後面的不等式；別的書不見得這樣定義）', 'say'); cap('這是為了後面那個不等式也能用', '別的地方通常只說最短 cycle，沒定義沒有 cycle 的情況'); },
  async (tok, S) => {
    S.t = quick({ ox: 3.2, oz: -1.8, s: 0.9, noName: true }, { a: [-2.4, 0], b: [-1.2, -0.8], c: [0, 0], d: [1.2, -0.8], e: [2.4, 0], f: [0, 1.2] }, 'a-b b-c c-d d-e c-f');
    T('6 點、5 邊、沒有 cycle → girth = 5', 'good', 3.2, -0.2);
    cap('例子：6 個 vertices、5 條邊', '繞不回來，沒有 cycle → girth 就是全部邊數 5');
  },
  async (tok, S) => {
    S.u = quick({ ox: 3.2, oz: 2.4, s: 0.9, noName: true }, { a: [-2, -0.8], b: [0, -0.8], c: [2, -0.8], d: [-2, 0.8], e: [0, 0.8], f: [2, 0.8] }, 'a-b b-c d-e e-f a-d b-e c-f');
    ['a-b', 'b-e', 'e-d', 'd-a'].forEach((k) => S.u.find(...k.split('-')).paint(GC.ok));
    T('最短 cycle 長 4 → girth = 4（示意）', 'good', 3.2, 3.9);
    cap('另一個例子：沒有三角形', '最短的 cycle 是四邊形，所以 girth = 4');
  },
]);

scene('g8a-girth-ex', 'K5 的 girth = 3、K3,3 的 girth = 4', [
  async (tok, S) => {
    S.k5 = quick({ ox: -3.0, oz: 0.8, s: 0.85 }, K5P, 'A-B A-C A-D A-E B-C B-D B-E C-D C-E D-E'); T('K₅', 'ptr', -3.0, -1.8);
    ['A-B', 'B-C', 'C-D', 'D-A'].forEach((k) => S.k5.find(...k.split('-')).paint(GC.blue));
    S.k5l = T('A B C D A：長度 4', 'say', -3.0, 3.2);
    cap('K₅：最短的 cycle 是多少？', '這樣繞是 4，還可以更短');
  },
  async (tok, S) => {
    S.k5.E.forEach((e) => e.paint(GC.e)); ['A-B', 'B-C', 'C-A'].forEach((k) => S.k5.find(...k.split('-')).paint(GC.ok));
    settxt(S.k5l, 'A B C A：長度 3；2 不可能');
    cap('A B C A 長度 3', '長度 2 要去又回來，兩點間就要兩條邊；simple graph 不會有');
  },
  async (tok, S) => { settxt(S.k5l, 'girth(K₅) = 3'); cls(S.k5l, 'good'); cap('所以 K₅ 的 girth = 3', '最短的 cycle 有很多個，都是三角形'); },
  async (tok, S) => {
    S.k = graph({ ox: 3.6, oz: 0.8, s: 0.9 });
    [['a', -1.6, -2], ['b', -1.6, 0], ['c', -1.6, 2], ['x', 1.6, -2], ['y', 1.6, 0], ['z', 1.6, 2]].forEach(([n, x, z]) => S.k.v(n, x, z, { c: 'abc'.includes(n) ? GC.blue : GC.pink }));
    'abc'.split('').forEach((l) => 'xyz'.split('').forEach((r) => S.k.e(l, r)));
    T('K₃,₃：3 × 3 = 9 條邊', 'ptr', 3.6, -1.6);
    cap('K₃,₃：左邊三點、右邊三點', '左邊任一點連到右邊任一點：3 × 3 = 9 條邊');
  },
  async (tok, S) => {
    S.kl = T('bipartite：cycle 去、回、去、回 → 長度偶數', 'say', 3.6, 3.4);
    cap('它是 bipartite graph', 'cycle 一定是左右去、回、去、回，長度一定是偶數：沒有 1、3、5');
  },
  async (tok, S) => { settxt(S.kl, '長度 2？兩點間只有一條邊 → 沒有'); cap('長度 2 呢？', '要去又回來，兩點間要兩條邊；complete bipartite 是 simple，不會有'); },
  async (tok, S) => {
    ['a-x', 'x-b', 'b-y', 'y-a'].forEach((k) => S.k.find(...k.split('-')).paint(GC.ok));
    settxt(S.kl, 'a x b y a：長度 4 → girth(K₃,₃) = 4'); cls(S.kl, 'good');
    cap('所以至少 4，而且隨便就找得到長度 4 的 cycle', 'K₃,₃ 的 girth = 4');
  },
  async (tok, S) => { S.B = board(-7, -4.8, 0.6); S.B.add('沒 cycle → 邊數；有 cycle → 最短 cycle；從小找上去', 'say'); cap('小結 girth', '沒有 cycle 就是邊數；有 cycle 就從 3、4… 慢慢找最短的'); },
  async (tok, S) => { S.B.add('下面：connected planar graph 的 e、v、girth 滿足一個不等式', 'note'); cap('接下來', 'connected planar graph 的 girth、edge 數、vertex 數會滿足一個不等式（必要條件）'); },
]);

// ════════ B0UDSm9Jiqs（第22A講：region degree、Σdeg(R) = 2e、edge–vertex inequality、K5 non-planar） ════════
// 老師的兩個例子：上圖 9 邊、4 regions，deg = 5、3、3、7（外圍有一條伸出去的邊要走兩次）；下圖 9 邊、4 regions，deg = 4、3、5、6。
// 黑板圖看不到，這裡依這些數字重建（示意）。v − e + r = 2 需要 7 個頂點（老師口頭數成 6 個）。
function regTop(ox, oz, s = 0.95) {
  const g = quick({ ox, oz, s }, { a: [-1.6, -1.2], b: [0, -2.2], c: [1.6, -1.2], d: [1.0, 1.2], e: [-1.0, 1.2], x: [0, -0.6], f: [2.0, 2.4] }, 'a-b b-c c-d d-e e-a x-a x-b x-c d-f');
  g.F = { R1: ['x', 'c', 'd', 'e', 'a'], R2: ['x', 'a', 'b'], R3: ['x', 'b', 'c'] };
  g.FL = { R1: [0, 0.5] }; // label spots where the centroid would sit on a vertex
  g.outer = ['a', 'b', 'c', 'd', 'f', 'd', 'e', 'a'];
  return g;
}
function regBot(ox, oz, s = 0.95) {
  const g = quick({ ox, oz, s }, { a: [-2, 0], b: [-1, -1.6], c: [1, -1.6], d: [2, 0], e: [1, 1.6], f: [-1, 1.6], g: [-0.8, 0.05] }, 'a-b b-c c-d d-e e-f f-a a-c c-f a-g');
  g.F = { R5: ['c', 'd', 'e', 'f'], R6: ['a', 'b', 'c'], R7: ['a', 'c', 'f'] };
  g.FL = { R6: [0, -1.15], R7: [-1.0, 0.85] };
  g.outer = ['a', 'b', 'c', 'd', 'e', 'f', 'a'];
  return g;
}
function regFill(g, name, color) {
  const cyc = g.F[name];
  const m = g.region(cyc.map((n, k) => [g.find(n, cyc[(k + 1) % cyc.length]), n]), color);
  let c = cyc.reduce((s, n) => [s[0] + g.pos(n).x / cyc.length, s[1] + g.pos(n).z / cyc.length], [0, 0]);
  if (g.FL && g.FL[name]) { const p = g.at(...g.FL[name]); c = [p.x, p.z]; }
  const l = T(name, 'ptr', c[0], c[1], 0.5);
  return { m, l, c };
}
async function walkSeq(tok, g, w, seq, ms = 260, c = GC.hot) { w.position.copy(g.pos(seq[0])); w.position.y = 0.75; for (let i = 0; i + 1 < seq.length; i++) await go(tok, w, g.find(seq[i], seq[i + 1]), seq[i], ms, c); }

scene('g8a-ineq-goal', '回顧 Euler 定理；接下來要判斷 planar', [
  async (tok, S) => { S.B = board(-6, -3.6, 0.8); S.B.add('Euler 定理：有 embedding 時，r、v、e 有關係'); cap('前面講的 Euler theorem for planar graphs', '有 embedding 時，region 數和 vertex、edge 數有關係'); },
  async (tok, S) => { S.B.add('但要先畫出 planar embedding 才能數 region', 'say'); cap('不過那是已經畫好 planar embedding', '之後才能去數 region'); },
  async (tok, S) => { S.B.add('接下來：用什麼條件判斷一個圖是不是 planar？', 'note'); cap('接下來要看', '有什麼條件可以判斷一個 graph 是不是 planar'); },
  async (tok, S) => { S.B.add('先一個必要條件；最後一個充要條件的定理', 'good'); cap('先講一個必要條件', '最後再講一個充分必要條件的定理'); },
]);

scene('g8a-regdeg-def', 'Region 的 degree', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.62); S.B.add('有一個 planar graph 的 planar embedding'); S.g = regTop(3.0, 0.4, 1.1); T('示意', 'idx', 6.0, -2.4); cap('假設有一個 planar graph 的 planar embedding', '也就是畫在平面上、不交叉的畫法'); },
  async (tok, S) => { S.B.add('simple、multigraph 都可以；有 embedding 就分得出 regions', 'say'); S.f = regFill(S.g, 'R1', RG[0]); cap('simple graph 或 multigraph 都可以', '有了 embedding，就能分出 regions'); },
  async (tok, S) => { S.B.add('region R 的 degree：deg(R)', 'note'); cap('定義 region R 的 degree', '寫成 deg(R)'); },
  async (tok, S) => {
    S.w = walker(S.g.pos('x')); await walkSeq(tok, S.g, S.w, ['x', 'c', 'd', 'e', 'a', 'x'], 300, GC.gold);
    S.B.add('= 沿 R 的 boundary 繞一圈的最短 closed walk 的邊數', 'say');
    cap('沿著 R 的邊界繞一圈：最短的 closed walk', '上面有幾條邊，就是 deg(R)；這塊是 5');
  },
  async (tok, S) => { S.B.add('對照：vertex degree = 連到它的邊數', 'say'); cap('以前有 vertex degree：連到那個 vertex 的邊數', '現在 region 也有 degree：它外圍邊界上的邊數'); },
]);

scene('g8a-regdeg-ex', '例子：數 region 的 degree', [
  async (tok, S) => { S.t = regTop(-3.0, 0.4); S.u = regBot(3.4, 0.4); T('上面的圖（示意）', 'say', -3.0, -2.6); T('下面的圖（示意）', 'say', 3.4, -2.6); cap('兩個 graph', '先看第一個（老師黑板上方那個）'); },
  async (tok, S) => {
    S.tR = ['R1', 'R2', 'R3'].map((n, i) => regFill(S.t, n, RG[i])); S.r4 = T('R4（外面）', 'ptr alt', -5.6, 2.8);
    S.tc = T('7 個 vertices、9 條 edges、4 個 regions', 'note', -3.0, 3.8);
    cap('9 條邊、4 個 regions：R1、R2、R3，外面 R4', '頂點是 7 個（老師口頭數成 6；用 v − e + r = 2 檢查應是 7）');
  },
  async (tok, S) => { S.w = walker(S.t.pos('x')); await walkSeq(tok, S.t, S.w, ['x', 'c', 'd', 'e', 'a', 'x'], 280, GC.gold); settxt(S.tR[0].l, 'R1:5'); cap('R1：沿邊界繞一圈', '1、2、3、4、5 → deg(R1) = 5'); },
  async (tok, S) => { await walkSeq(tok, S.t, S.w, ['x', 'a', 'b', 'x'], 280, GC.gold); settxt(S.tR[1].l, 'R2:3'); cap('R2：三條邊', 'deg(R2) = 3'); },
  async (tok, S) => { await walkSeq(tok, S.t, S.w, ['x', 'b', 'c', 'x'], 280, GC.gold); settxt(S.tR[2].l, 'R3:3'); cap('R3：也是三條', 'deg(R3) = 3'); },
  async (tok, S) => { S.t.E.forEach((e) => e.paint(GC.e)); S.t.find('d', 'f').paint(GC.hot); cap('R4 是外面那塊，要稍微小心', '有一條邊（d–f）伸到外面'); },
  async (tok, S) => {
    await walkSeq(tok, S.t, S.w, S.t.outer, 280, GC.gold);
    settxt(S.r4, 'R4:7（d–f 走兩次）');
    cap('closed walk 要回到原點：d–f 走出去還得走回來', '這條邊算兩次：1、2、3、4、5、6、7 → deg(R4) = 7');
  },
  async (tok, S) => { kill(S.w); S.uR = ['R5', 'R6', 'R7'].map((n, i) => regFill(S.u, n, RG[i + 3])); S.r8 = T('R8（外面）', 'ptr alt', 5.6, 2.8); T('7 點、9 邊、4 regions', 'note', 3.4, 3.8); cap('第二個圖：也有四個 regions', 'R5、R6、R7、R8'); },
  async (tok, S) => { S.w = walker(S.u.pos('c')); await walkSeq(tok, S.u, S.w, ['c', 'd', 'e', 'f', 'c'], 280, GC.gold); settxt(S.uR[0].l, 'R5:4'); cap('R5：1、2、3、4', 'deg(R5) = 4'); },
  async (tok, S) => { await walkSeq(tok, S.u, S.w, ['a', 'b', 'c', 'a'], 280, GC.gold); settxt(S.uR[1].l, 'R6:3'); cap('R6：三條邊', 'deg(R6) = 3'); },
  async (tok, S) => {
    S.u.find('a', 'g').paint(GC.hot);
    await walkSeq(tok, S.u, S.w, ['a', 'g', 'a', 'c', 'f', 'a'], 280, GC.gold); settxt(S.uR[2].l, 'R7:5');
    cap('R7：裡面有一條伸進來的邊 a–g（示意）', 'closed walk 走進去又走出來：3 + 2 = 5');
  },
  async (tok, S) => { await walkSeq(tok, S.u, S.w, S.u.outer, 240, GC.gold); settxt(S.r8, 'R8:6'); cap('R8 是外面那塊', '1、2、3、4、5、6 → deg(R8) = 6'); },
]);

scene('g8a-regdeg-sum', '所有 region 的 degree 加起來 = 2e', [
  async (tok, S) => {
    S.t = regTop(-3.0, 0.7); S.u = regBot(3.4, 0.7);
    [['R1', 5], ['R2', 3], ['R3', 3]].forEach(([n, d], i) => { const f = regFill(S.t, n, RG[i]); settxt(f.l, n + ':' + d); });
    [['R5', 4], ['R6', 3], ['R7', 5]].forEach(([n, d], i) => { const f = regFill(S.u, n, RG[i + 3]); settxt(f.l, n + ':' + d); });
    T('R4:7', 'ptr alt', -5.6, 3.1); T('R8:6', 'ptr alt', 5.6, 3.1);
    S.B = board(-7, -4.8, 0.56, { maxH: 50 });
    S.B.add('定義 region degree 做什麼？看一個性質');
    cap('定義 region 的 degree 有什麼用？', '先看一個性質');
  },
  async (tok, S) => { S.B.add('回想：所有 vertex degree 加起來 = 2 × edges', 'say'); cap('以前學過：所有 vertex 的 degree 加起來', '等於 edge 個數的兩倍'); },
  async (tok, S) => { S.B.add('因為每條邊有兩個端點，各算一次', 'say'); cap('因為每條 edge 有兩個端點', '算 degree 時兩端各算一次'); },
  async (tok, S) => { S.s1 = T('5 + 3 + 3 + 7 = 18', 'note', -3.0, 4.1); cap('把上面那個圖的 region degree 加起來', '5 + 3 + 3 + 7 = 18'); },
  async (tok, S) => { settxt(S.s1, '18 = 2 × 9 條邊'); cls(S.s1, 'good'); cap('它有 9 條邊', '18 剛好是 2 × 9'); },
  async (tok, S) => { T('4 + 3 + 5 + 6 = 18 = 2 × 9', 'good', 3.4, 4.1); cap('下面的圖：4 + 3 + 5 + 6 = 18', '它也有 9 條邊：又是兩倍'); },
  async (tok, S) => { S.B.add('region degree 加起來也 = 2 × edges', 'note'); cap('跟 vertex 的性質很像', 'region degree 加起來也是 edge 數的兩倍'); },
  async (tok, S) => { S.B.add('為什麼？對任何 planar embedding 都成立', 'say'); cap('為什麼？', '這對任何 planar graph 的 planar embedding 都成立'); },
  async (tok, S) => { S.e = S.u.find('c', 'f'); S.e.paint(GC.hot); cap('看一條邊：它有兩側', ''); },
  async (tok, S) => { S.x1 = T('算 R5 時 +1', 'pkt', 4.6, 0.1); S.x2 = T('算 R7 時 +1', 'pkt', 1.0, 3.0); cap('數 R5 的 degree 時這條邊算一次', '數 R7 的 degree 時又算一次'); },
  async (tok, S) => { S.B.add('每條邊隔開兩側 → 各貢獻 1，共貢獻 2', 'say'); cap('每條邊都剛好隔開兩側', '兩側各貢獻 1（兩側同一塊時，那塊就算它兩次）'); },
  async (tok, S) => { S.B.add('Σ deg(R) = 2e', 'good'); cap('所以所有 region 的 degree 加起來', '= 2 × edge 個數'); },
]);

scene('g8a-evi', 'Edge–Vertex Inequality', [
  async (tok, S) => { S.B = board(-6.6, -4.4, 0.7); S.B.add('用 Σdeg(R) = 2e 推一個必要條件'); cap('用剛剛這個式子', '推出下面這個必要條件'); },
  async (tok, S) => { S.B.add('Edge–Vertex Inequality', 'note'); cap('叫做 Edge–Vertex Inequality', ''); },
  async (tok, S) => { S.B.add('對任何 connected planar simple graph', 'say'); cap('對任何 connected planar graph', '而且多一個假設：simple graph'); },
  async (tok, S) => { S.B.add('girth g ≥ 3', 'say'); cap('另外假設它的 girth 至少 3', 'girth：最短 cycle 長度；沒有 cycle 時是全部邊數'); },
  async (tok, S) => { S.B.add('（推導時需要 g > 2）', 'say'); cap('為什麼要 3？', '推導時需要 g 大於 2'); },
  async (tok, S) => { S.B.add('e ≤ g/(g−2) · (v − 2)', 'good'); cap('結論：edge 個數 e 要滿足', 'e ≤ g/(g−2) × (v − 2)'); },
  async (tok, S) => { S.B.add('邊不能太多：太多就 non-planar', 'say'); cap('edge 不能太多', 'non-planar 往往就是因為邊太多'); },
  async (tok, S) => { S.B.add('g > 2 → g − 2 > 0（否則上界變負）', 'say'); cap('g 要大於 2', '不然 g − 2 是 0 或負的，上界沒意義'); },
  async (tok, S) => { S.B.add('用法：數 e、v、g，代進去', 'note'); cap('用法很簡單', '數一數 edge 數、vertex 數、girth，代進去'); },
  async (tok, S) => { S.B.add('滿足 → 才「可能」planar；不滿足 → 一定不是', 'bad'); cap('它是必要條件', '滿足才有可能是 planar（不一定是）；不滿足就一定不是'); },
  async (tok, S) => { S.B.add('通常的問題：edge 太多 → 一定會 crossing', 'say'); cap('通常問題都是邊太多', '邊太多就一定會交叉'); },
]);

scene('g8a-evi-proof', '推導 e ≤ g(v−2)/(g−2)', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.6); S.B.add('推導這個不等式'); cap('先把這個不等式推導出來', '後面再拿來用'); },
  async (tok, S) => { S.B.add('它是 Euler 定理的 corollary（系理）', 'say'); cap('它可以看成', 'Euler theorem for planar graphs 的 corollary'); },
  async (tok, S) => { S.B.add('v − e + r = 2：用 Σdeg(R) = 2e 把 r 消掉', 'say'); cap('從 v − e + r = 2 出發', '用「region degree 總和 = 2e」把 r 消掉'); },
  async (tok, S) => { S.t = regTop(3.6, 1.2, 0.8); ['R1', 'R2', 'R3'].forEach((n, i) => { const f = regFill(S.t, n, RG[i]); settxt(f.l, n + ':' + [5, 3, 3][i]); }); T('示意：g = 3', 'idx', 3.6, -1.4); cap('看每個 region 的 degree', '例如 5、3、3'); },
  async (tok, S) => { S.B.add('每個 region 的 boundary 至少 g 條邊', 'note'); cap('每個 region 的邊界', '至少有 g 條邊（g 是 girth）'); },
  async (tok, S) => { S.B.add('沒有 cycle 時 g = 全部邊數，也成立', 'say'); cap('沒有 cycle 的時候', 'g 定義成全部邊數，唯一的 region 也至少這麼多（伸出去的邊算兩次）'); },
  async (tok, S) => { S.B.add('cycle 不重複；closed walk 可重複只會更多 → deg(R) ≥ g', 'say'); cap('girth 是最短 cycle', 'region 的邊界 closed walk 還可能重複算，只會更長：deg(R) ≥ g'); },
  async (tok, S) => { S.B.add('2e = Σ deg(R)', 'note'); cap('前面的性質', '2e = 所有 region degree 的和'); },
  async (tok, S) => { S.B.add('r 個 region、每個 ≥ g → 2e ≥ g·r'); cap('有 r 個 region，每個 degree 至少 g', '所以 2e ≥ g × r'); },
  async (tok, S) => { S.B.add('Euler：r = 2 − v + e，代進去', 'say'); cap('把 r 換掉', '由 v − e + r = 2 得 r = 2 − v + e'); },
  async (tok, S) => { S.B.add('2e ≥ g(2 − v + e)', 'note'); cap('得到一個沒有 r 的不等式', '2e ≥ g(2 − v + e)'); },
  async (tok, S) => { S.B.add('移項：(g − 2)e ≤ g(v − 2)', 'note'); cap('把有 e 的都移到同一邊', 'ge − 2e ≤ gv − 2g，也就是 (g − 2)e ≤ g(v − 2)'); },
  async (tok, S) => { S.B.add('g ≥ 3 → g − 2 > 0：兩邊除掉，不等號不變', 'say'); cap('假設 g ≥ 3，所以 g − 2 > 0', '兩邊同除 g − 2，不等號方向不變'); },
  async (tok, S) => { S.B.add('e ≤ g(v − 2)/(g − 2)', 'good'); cap('得到 Edge–Vertex Inequality', 'e ≤ g(v − 2)/(g − 2)'); },
]);

scene('g8a-k5-proof', '用不等式證明 K5 不是 planar', [
  async (tok, S) => { S.B = board(-7, -4.4, 0.7); S.B.add('拿來用：它是必要條件'); cap('拿來用一下', '它是必要條件'); },
  async (tok, S) => { S.k = quick({ ox: 3.4, oz: 0.6, s: 1.0 }, K5P, 'A-B A-C A-D A-E B-C B-D B-E C-D C-E D-E'); S.B.add('K₅：以前畫不出來，現在證明', 'say'); cap('K₅：之前畫不出來', '現在用數學證明它不是 planar'); },
  async (tok, S) => { Object.keys(K5P).forEach((n) => S.k.vc(n, GC.blue)); S.B.add('v = 5'); cap('數一數：5 個 vertices', ''); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.gold)); S.B.add('e = C(5,2) = 10'); cap('complete graph 有 C(n,2) 條邊', 'C(5,2) = 10'); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.e)); ['A-B', 'B-C', 'C-A'].forEach((k) => S.k.find(...k.split('-')).paint(GC.ok)); S.B.add('g = 3（三角形）'); cap('girth 上次算過', 'g = 3'); },
  async (tok, S) => { S.B.add('若 planar：要 e ≤ g(v−2)/(g−2)', 'say'); cap('如果 K₅ 是 planar', '這三個數就要滿足不等式'); },
  async (tok, S) => { S.B.add('3/(3−2) × (5−2) = 3 × 3 = 9', 'note'); cap('右邊：3 ÷ (3 − 2) = 3', '再乘 (5 − 2) = 3 → 9'); },
  async (tok, S) => { S.B.add('e 要 ≤ 9，但 e = 10 > 9 ✗', 'bad'); cap('planar 的話，邊數不能超過 9', '但 K₅ 有 10 條邊'); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.hot)); S.B.add('⇒ K₅ non-planar（edge 太多）', 'good'); cap('所以 K₅ 一定 non-planar', 'edge 太多了；數一數代進去就證出來'); },
]);

// ════════ yewOwasU9Hk（第22B講：K3,3 non-planar、elementary subdivision、homeomorphic、subgraph、Kuratowski、Petersen） ════════
// Petersen：外圈 a b c d e、輻條 a–f b–g c–h d–i e–j、內星 f–h h–j j–g g–i i–f（h 連 c f j、g 連 b j i，與老師核對的一致）。
// 拿掉 a–b、d–i 後，剩下的是 K3,3（{c,f,j} 對 {e,g,h}）的 subdivision，多出來的 4 點是 a、b、d、i。
const K33P = { a: [-1.8, -2], b: [-1.8, 0], c: [-1.8, 2], x: [1.8, -2], y: [1.8, 0], z: [1.8, 2] };
const k33 = (o) => { const g = graph(o); Object.entries(K33P).forEach(([n, [x, zz]]) => g.v(n, x, zz, { c: 'abc'.includes(n) ? GC.blue : GC.pink })); 'abc'.split('').forEach((l) => 'xyz'.split('').forEach((r) => g.e(l, r))); return g; };

scene('g8a-k33-proof', '用不等式證明 K3,3 不是 planar', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.62); S.k = k33({ ox: 3.4, oz: 0.4, s: 1.0 }); S.B.add('K₃,₃：一樣用 edge–vertex inequality'); cap('K₃,₃ 也來證明它 non-planar', '一樣用 edge–vertex inequality'); },
  async (tok, S) => { S.B.add('bipartite，左 3 右 3：v = 6'); cap('它是 bipartite graph：左邊 3、右邊 3', 'vertex 數 v = 6'); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.gold)); S.B.add('complete：e = 3 × 3 = 9'); cap('complete bipartite', 'e = 3 × 3 = 9'); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.e)); ['a-x', 'x-b', 'b-y', 'y-a'].forEach((k) => S.k.find(...k.split('-')).paint(GC.ok)); S.B.add('cycle 長度偶數、沒有 2 → g = 4'); cap('bipartite 的 cycle 長度一定偶數，又沒有 2', '所以 girth g = 4'); },
  async (tok, S) => { S.B.add('上界：4/(4−2) × (6−2) = 2 × 4 = 8', 'note'); cap('代進必要條件', 'g/(g−2) × (v−2) = 4/2 × 4 = 8'); },
  async (tok, S) => { S.B.add('e 要 ≤ 8，但 e = 9 ✗', 'bad'); cap('如果是 planar，邊數不能超過 8', '但 K₃,₃ 有 9 條邊'); },
  async (tok, S) => { S.k.E.forEach((e) => e.paint(GC.hot)); S.B.add('⇒ K₃,₃ non-planar（edge 太多）', 'good'); cap('所以 K₃,₃ 是 non-planar', '一樣是 edge 太多'); },
  async (tok, S) => { S.B.add('只是必要條件：滿足不一定是；不滿足一定不是', 'say'); cap('提醒：這只是必要條件', '代進去滿足，只能說「可能是」；不滿足就一定不是'); },
  async (tok, S) => { S.B.add('最後：planar 的若且唯若條件（很漂亮）', 'note'); cap('最後要講 non-planar 的若且唯若條件', '結果很漂亮，但不一定好用'); },
]);

scene('g8a-subdiv', 'Elementary subdivision：在邊上多點一個點', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.62); S.B.add('先定義幾個名詞'); cap('講那個定理之前', '要先定義一些東西'); },
  async (tok, S) => { S.B.add('G = (V, E)：undirected simple graph，E ≠ ∅', 'say'); cap('G 是 undirected simple graph', 'edge set 不是空集合：至少有一條邊'); },
  async (tok, S) => { S.B.add('這些名詞只是為了說明後面的定理', 'say'); cap('下面這些都只是名字', '定義清楚，後面的定理比較好講'); },
  async (tok, S) => { S.B.add('Elementary subdivision of G', 'note'); cap('第一個：elementary subdivision', ''); },
  async (tok, S) => { S.g = quick({ ox: 3.0, oz: -0.4, s: 1.2 }, { v: [-2, 0], w: [2, 0] }, 'v-w'); S.g.find('v', 'w').paint(GC.hot); cap('原來的圖 G 有一條邊 vw', '兩個端點 v、w'); },
  async (tok, S) => {
    S.g.find('v', 'w').show(false); S.g.v('z', 0, 0, { c: GC.ok }); S.g.e('v', 'z', { c: GC.ok }); S.g.e('z', 'w', { c: GC.ok });
    S.B.add('拿掉 vw，加上 vz、zw；z 是新 vertex', 'say');
    cap('把 vw 拿掉，加兩條邊 vz、zw', 'z 是新加的 vertex');
  },
  async (tok, S) => { S.B.add('簡單講：在一條邊上多點一個點', 'good'); cap('簡單講就是在邊上多加一個點', '這叫 elementary subdivision'); },
  async (tok, S) => {
    S.h = quick({ ox: 3.0, oz: 2.4, s: 0.7, noName: true }, { a: [-1.4, -1], b: [1.4, -1], c: [1.4, 1], d: [-1.4, 1] }, 'a-b b-c c-d d-a');
    S.B.add('planar 加點還是 planar；non-planar 加點還是 non-planar', 'note');
    cap('原來是 non-planar，加了點還是 non-planar', '原來是 planar，加了點還是 planar：不影響是不是 planar');
  },
  async (tok, S) => {
    ['a-b', 'c-d'].forEach((k) => { const [u, v] = k.split('-'); const e = S.h.find(u, v); e.show(false); const m = 'm' + u; const p = e.curve.getPoint(0.5); S.h.v(m, (p.x - 3.0) / 0.7, (p.z - 2.4) / 0.7, { c: GC.ok }); S.h.e(u, m, { c: GC.ok }); S.h.e(m, v, { c: GC.ok }); });
    S.B.add('做好幾次也一樣', 'say');
    cap('做好幾次 elementary subdivision', '是 planar 的還是 planar，不是的還是不是');
  },
]);

const TRI = { p: [-0.9, -0.6], q: [0.9, -0.6], r: [0, 0.9] };
function triSub(ox, subs) {
  const g = graph({ ox, oz: 1.6, s: 1.0, noName: true }); Object.entries(TRI).forEach(([n, [x, z]]) => g.v(n, x, z));
  [['p', 'q', 'top'], ['p', 'r', 'left'], ['q', 'r', 'right']].forEach(([u, v, side]) => {
    if (subs.includes(side)) { const x = (TRI[u][0] + TRI[v][0]) / 2, z = (TRI[u][1] + TRI[v][1]) / 2; g.v(side, x, z, { c: GC.ok }); g.e(u, side); g.e(side, v); } else g.e(u, v);
  });
  return g;
}
scene('g8a-homeo', 'Homeomorphic', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.58); S.B.add('再一個名稱：homeomorphic'); cap('再定義一個名稱', 'homeomorphic'); },
  async (tok, S) => { S.B.add('G₁ = (V₁, E₁)、G₂ = (V₂, E₂)：undirected simple graphs', 'say'); cap('兩個 undirected simple graphs', 'G₁ 和 G₂'); },
  async (tok, S) => { S.B.add('第一種：G₁、G₂ isomorphic', 'say'); cap('什麼叫 homeomorphic？第一種情況', '它們是 isomorphic：數學性質一樣，一個 non-planar 另一個也是'); },
  async (tok, S) => { S.B.add('放寬：可以從同一個圖做 elementary subdivision 得到', 'note'); cap('再放寬一點', '兩個圖可以從同一個圖做 elementary subdivision 得到'); },
  async (tok, S) => { S.B.add('either isomorphic，或 同一個圖 → subdivision 得到', 'say'); cap('所以 homeomorphic：', '要嘛 isomorphic，要嘛都能從同一個 undirected simple graph 經過 subdivision 得到'); },
  async (tok, S) => { S.B.add('「一系列」：可以做不只一次', 'say'); cap('經過一系列的 elementary subdivision', '做一次、兩次、好幾次都可以'); },
  async (tok, S) => { S.B.add('planar 做幾次還是 planar；non-planar 也是', 'say'); cap('目的：講「是不是 planar」這件事', 'planar 的怎麼做還是 planar，non-planar 的也還是 non-planar'); },
  async (tok, S) => {
    S.g1 = triSub(-5.4, []); S.g2 = triSub(-1.8, ['top']); S.g3 = triSub(1.8, ['left', 'right']); S.g4 = triSub(5.4, ['top', 'left', 'right']);
    ['G₁', 'G₂', 'G₃', 'G₄'].forEach((n, i) => T(n, 'ptr', -5.4 + 3.6 * i, 3.4));
    T('示意', 'idx', 6.4, 0.2);
    cap('舉例：四個圖 G₁、G₂、G₃、G₄', '');
  },
  async (tok, S) => { S.g1.E.forEach((e) => e.paint(GC.blue)); cap('它們都可以從 G₁ 經過 subdivision 得到', 'G₁ 就是它自己'); },
  async (tok, S) => { S.g2.E.forEach((e) => e.paint(GC.blue)); cap('G₂：在一條邊上多一個點', '做一次'); },
  async (tok, S) => { S.g3.E.forEach((e) => e.paint(GC.blue)); cap('G₃：左右兩條邊各多一個點', '做兩次'); },
  async (tok, S) => { S.g4.E.forEach((e) => e.paint(GC.blue)); cap('G₄：上面和左右各多一個點', '做三次'); },
  async (tok, S) => { S.B.add('G₁～G₄ 兩兩 homeomorphic', 'good'); cap('所以這四個兩兩都是 homeomorphic', '一個 non-planar 全都 non-planar；一個 planar 全都 planar'); },
]);

scene('g8a-subgraph', 'Subgraph', [
  async (tok, S) => { S.B = board(-7, -4.6, 0.66); S.B.add('最後一個名字：subgraph'); cap('最後一個名字', 'subgraph（子圖）'); },
  async (tok, S) => {
    S.g = quick({ ox: 3.2, oz: 0.4, s: 0.9 }, { a: [-2, -1.6], b: [0, -2.4], c: [2, -1.6], d: [2, 0.8], e: [0, 1.8], f: [-2, 0.8] }, 'a-b b-c c-d d-e e-f f-a a-d b-e');
    S.B.add('G = (V, E)；G₁ = (V₁, E₁)', 'say');
    cap('原來的圖 G，vertex set V、edge set E', '另一個圖 G₁，vertex set V₁、edge set E₁');
  },
  async (tok, S) => { ['a', 'b', 'd', 'e'].forEach((n) => S.g.vc(n, GC.ok)); ['a-b', 'b-e', 'e-d', 'a-d'].forEach((k) => S.g.find(...k.split('-')).paint(GC.ok)); S.B.add('V₁ ⊆ V、E₁ ⊆ E → G₁ 是 G 的 subgraph', 'note'); cap('V₁ 是 V 的部分集合，E₁ 是 E 的部分集合', 'G₁ 就是 G 的一部分：subgraph'); },
  async (tok, S) => {
    const e = S.g.find('c', 'd'); e.paint(GC.hot); S.x = T('✗ c 不在 V₁：不是 graph', 'bad', 5.6, -1.6);
    S.B.add('G₁ 本身要是 graph：邊的兩端都要在 V₁', 'say');
    cap('G₁ 自己必須是一個 graph', '每條邊的兩個端點都要在 V₁ 裡；隨便取一部分不一定是 graph');
  },
  async (tok, S) => { kill(S.x); S.g.find('c', 'd').paint(GC.e); S.B.add('只是名字；就像 subspace、subgroup', 'say'); cap('這只是名字', '跟 subspace、subgroup 類似'); },
  async (tok, S) => { S.B.add('有一個 subgraph non-planar ⇒ 整個圖 non-planar', 'good'); cap('為什麼要講 subgraph？', '只要裡面有一部分 non-planar，那一部分都畫不了，整個圖當然也畫不了'); },
]);

scene('g8a-kura', "Kuratowski's Theorem", [
  async (tok, S) => { S.B = board(-7, -4.8, 0.6); S.B.add('準備好了：最後的定理'); cap('名詞都定義好了', '可以講最後的定理'); },
  async (tok, S) => { S.B.add("Kuratowski's Theorem（波蘭數學家，1930）", 'note'); cap("Kuratowski's Theorem", 'Kuratowski 是波蘭數學家，1930 年提出（刻畫 planar graph）'); },
  async (tok, S) => { S.B.add('non-planar 的若且唯若條件', 'say'); cap('結果很漂亮', '因為它是 non-planar 的若且唯若條件：充分而且必要'); },
  async (tok, S) => { S.B.add('G non-planar ⇔ G 有一個 subgraph…'); cap('G 是 non-planar', '若且唯若 G 有一個 subgraph……'); },
  async (tok, S) => { S.B.add('…homeomorphic to', 'say'); cap('……這個 subgraph 是 homeomorphic to', '（isomorphic，或由下面的圖做 elementary subdivision 得到）'); },
  async (tok, S) => {
    S.k5 = quick({ ox: 1.8, oz: 1.6, s: 0.7, noName: true }, K5P, 'A-B A-C A-D A-E B-C B-D B-E C-D C-E D-E'); T('K₅', 'ptr', 1.8, -0.6);
    S.k3 = k33({ ox: 5.2, oz: 1.6, s: 0.65, noName: true }); T('K₃,₃', 'ptr', 5.2, -0.6);
    S.B.add('K₅ 或 K₃,₃', 'good');
    cap('K₅ 或 K₃,₃', '只要 check 這兩個');
  },
  async (tok, S) => { S.B.add('所有 non-planar graph 都跟這兩個有關', 'say'); cap('K₅ 和 K₃,₃ 扮演很重要的角色', '所有 non-planar graph，裡面一定有一部分是它們（多加一些點而已）'); },
  async (tok, S) => { [S.k5, S.k3].forEach((g) => g.E.forEach((e) => e.paint(GC.hot))); S.B.add('⇐（充分）容易：那部分畫不了 → 整個畫不了', 'say'); cap('充分條件很容易', '有這樣的 subgraph：它本身 non-planar，整個圖更畫不到平面上'); },
  async (tok, S) => { S.B.add('⇒（必要）比較麻煩', 'bad'); cap('比較麻煩的是另一個方向', 'non-planar ⇒ 裡面一定找得到 K₅ 或 K₃,₃ 的 subdivision'); },
  async (tok, S) => { S.B.add('converse much more complicated to prove：不講證明', 'say'); cap('這個方向的證明複雜得多', '這門課不講'); },
  async (tok, S) => { S.B.add('課本少數沒證明的地方；C. L. Liu 書中約 9 頁', 'say'); cap('本課少數沒給證明的地方', '有興趣可看參考書 C. L. Liu《Introduction to Combinatorial Mathematics》，約九頁'); },
  async (tok, S) => { S.B.add('結果漂亮（只有 K₅、K₃,₃），但不一定好找', 'note'); cap('結果很漂亮：只跟 K₅、K₃,₃ 有關', '但實際用時，要找出那個 subgraph 不一定容易'); },
]);

const PET0 = (() => { const P = {}; 'abcde'.split('').forEach((n, k) => { const t = -Math.PI / 2 + k * 2 * Math.PI / 5; P[n] = [2.7 * Math.cos(t), 2.7 * Math.sin(t)]; }); 'fghij'.split('').forEach((n, k) => { const t = -Math.PI / 2 + k * 2 * Math.PI / 5; P[n] = [1.25 * Math.cos(t), 1.25 * Math.sin(t)]; }); return P; })();
const PET_E = ['a-b', 'b-c', 'c-d', 'd-e', 'e-a', 'a-f', 'b-g', 'c-h', 'd-i', 'e-j', 'f-h', 'h-j', 'j-g', 'g-i', 'i-f'];
const lerpP = (A, B, u) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
const PET1 = { c: [-2.4, -2.2], f: [-2.4, 0], j: [-2.4, 2.2], h: [2.4, -2.2], g: [2.4, 0], e: [2.4, 2.2] };
PET1.b = lerpP(PET1.c, PET1.g, 1 / 3); PET1.d = lerpP(PET1.c, PET1.e, 2 / 3); PET1.i = lerpP(PET1.f, PET1.g, 1 / 3); PET1.a = lerpP(PET1.f, PET1.e, 2 / 3);
function petDraw(S, P) {
  if (S.p) S.p.kill();
  S.p = graph({ ox: 3.0, oz: 0.5, s: 1.0 });
  Object.entries(P).forEach(([n, [x, z]]) => S.p.v(n.toUpperCase(), x, z));
  PET_E.forEach((k) => { const [u, v] = k.toUpperCase().split('-'); S.p.e(u, v); });
}
scene('g8a-petersen', 'Petersen graph 不是 planar', [
  async (tok, S) => { S.B = board(-7, -4.8, 0.56); S.B.add('例子'); cap('看一個例子', ''); },
  async (tok, S) => { petDraw(S, PET0); S.B.add('Petersen graph：很漂亮、很多數學性質', 'note'); cap('Petersen graph', '常常碰到，很漂亮，有很多數學性質'); },
  async (tok, S) => { S.B.add('10 個端點、15 條邊：planar 嗎？', 'say'); cap('10 個端點、15 條邊', '它是不是 planar？'); },
  async (tok, S) => { S.B.add('它跟 K₃,₃ 有關', 'say'); cap('它事實上跟 K₃,₃ 有關', ''); },
  async (tok, S) => { S.d3 = Object.keys(S.p.V).map((n) => { const p = S.p.pos(n); return T('3', 'idx', p.x + 0.45, p.z - 0.35, 0.6); }); S.B.add('3-regular：每點 3 條邊；K₃,₃ 也是', 'say'); cap('它是 3-regular graph：每個 vertex 三條邊', '原來的 K₃,₃ 也是每點三條邊'); },
  async (tok, S) => {
    ['C', 'F', 'J', 'E', 'G', 'H'].forEach((n) => S.p.vc(n, 'CFJ'.includes(n) ? GC.blue : GC.pink));
    ['A', 'B', 'D', 'I'].forEach((n) => S.p.vc(n, GC.ok));
    cap('它有 10 個點，K₃,₃ 只有 6 個', '另外 4 個（綠色）在哪？');
  },
  async (tok, S) => {
    S.p.E.forEach((e) => e.show(false)); S.d3.forEach(kill);
    const ks = Object.keys(PET0);
    // H takes a bend to the right so it does not run over G on the way
    await anim(tok, 1500, (u) => ks.forEach((n) => { const [x, z] = lerpP(PET0[n], PET1[n], u); S.p.move(n.toUpperCase(), x + (n === 'h' ? Math.sin(Math.PI * u) * 1.3 : 0), z); }));
    petDraw(S, PET1);
    ['C', 'F', 'J', 'E', 'G', 'H'].forEach((n) => S.p.vc(n, 'CFJ'.includes(n) ? GC.blue : GC.pink)); ['A', 'B', 'D', 'I'].forEach((n) => S.p.vc(n, GC.ok));
    cap('換一種畫法', '同一張圖，點的位置換一下');
  },
  async (tok, S) => {
    ['H-C', 'H-F', 'H-J', 'G-B', 'G-J', 'G-I'].forEach((k) => S.p.find(...k.split('-')).paint(GC.gold));
    S.B.add('每點 degree 仍是 3；H 連 C、F、J；G 連 B、J、I', 'say');
    cap('對一下：10 個端點，每點 degree 都是 3', 'H 連到 C、F、J；G 連到 B、J、I：一模一樣');
  },
  async (tok, S) => { S.p.E.forEach((e) => e.paint(GC.e)); cap('畫成這樣', 'K₃,₃ 的樣子就跑出來了：左 C、F、J，右 H、G、E'); },
  async (tok, S) => {
    ['A-B', 'D-I'].forEach((k) => { const e = S.p.find(...k.split('-')); e.paint(GC.dim); e.mat.transparent = true; e.mat.opacity = 0.35; });
    S.B.add('不看 A–B、D–I 兩條邊 → 剩下 K₃,₃ 的 subdivision', 'note');
    cap('不看 A–B、D–I 這兩條邊', '剩下的就是 K₃,₃ 經過 elementary subdivision：多了 A、B、D、I 四個點');
  },
  async (tok, S) => { S.p.E.forEach((e) => { if (e.mat.opacity === 1) e.paint(GC.hot); }); S.B.add('K₃,₃ non-planar → homeomorphic 的也是', 'say'); cap('K₃,₃ 是 non-planar', '跟它 homeomorphic 的圖也都是 non-planar'); },
  async (tok, S) => { S.B.add('Kuratowski ⇒ Petersen graph non-planar', 'good'); cap('根據 Kuratowski 定理', 'Petersen 有一個 subgraph homeomorphic to K₃,₃ → non-planar'); },
  async (tok, S) => { S.B.add('也可以用 edge–vertex inequality（必要條件）', 'say'); cap('也可以用前面的 edge–vertex inequality 看', '它只是必要條件：不成立就一定 non-planar'); },
  async (tok, S) => { S.B.add('v = 10、e = 15、girth g = 5', 'say'); cap('10 個端點、15 條邊', 'girth 上次算過是 5'); },
  async (tok, S) => { S.B.add('上界：5/(5−2) × (10−2) = 40/3 ≈ 13.3', 'note'); cap('代進去：5/3 × 8', '= 40/3，大約 13.3'); },
  async (tok, S) => { S.B.add('e = 15 > 13.3 ✗ → non-planar', 'bad'); cap('邊數 15 超過 13.3', 'edge 太多：用不等式也看得出 Petersen non-planar'); },
  async (tok, S) => { S.B.add('不等式：只是必要；Kuratowski：充分必要', 'good'); cap('不等式不成立就一定 non-planar，成立不一定', 'Kuratowski 是充要條件：non-planar 一定跟 K₅ 或 K₃,₃ 有關'); },
]);
  }

  // ═══ g8b.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第23A–24B講 Trees）— cued scenes ───
// tree 的定義與例子、三個性質（唯一 path、拿掉一邊剛好兩棵 tree、|V| = |E| + 1）與證明、
// 四個等價敘述 (a)(b)(c)(d)、rooted tree 與名詞、m-ary / complete / balanced、n = mi + 1、l ≤ mʰ、
// preorder / postorder / inorder。每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下。
// 老師黑板上的圖看不到的地方（G1–G3、證明用的樹、K/L/N 掛哪裡）標「示意」；
// 所有個數（component 數、cycle 數、|V|、|E|、level、height、葉子數、走訪順序）都由程式在畫面上的圖算出來，
// 另外用暴力列舉（n ≤ 5 的所有圖、i 不大的所有 complete m-ary tree）檢查定理，顯示 ✓／✘。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
const TC = { node: '#cdbfa6', edge: '#9c8b70', a: '#4b9ee2', b: '#e55a9b', hot: '#d64545', gold: '#c08a1f', green: '#2fc092', yel: '#e9c53a', purple: '#9b7ef4', orange: '#dd8238', teal: '#31aab0', dim: '#e9e1d3' };
const HL = '#6a4a00';
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ── 3D 小零件：節點（球）、邊（圓柱）、虛線、三角形（subtree） ──
const NG = new THREE.SphereGeometry(0.3, 18, 12);
const CG = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(0.14, 0.32, 12);
function seg(x1, y1, x2, y2, c = TC.edge, r = 0.05, z = -0.03) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.max(0.02, Math.hypot(dx, dy));
  const m = new THREE.Mesh(CG, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  m.scale.set(r, L, r); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  lab.world.add(m); return m;
}
function dash(pts, c = TC.hot, r = 0.045) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; const L = Math.hypot(x2 - x1, y2 - y1), k = Math.max(2, Math.round(L / 0.25));
    for (let j = 0; j < k; j += 2) { const a = j / k, b = Math.min(1, (j + 1) / k); out.push(seg(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, c, r, 0.02)); }
  }
  return out;
}
function tri(x, yTop, w, h, c, label) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-w / 2, -h); sh.lineTo(w / 2, -h); sh.lineTo(0, 0);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(x, yTop, -0.1); lab.world.add(m);
  if (label) { const l = lab.label(label, 'val'); l.position.set(0, -h * 0.62, 0.1); m.add(l); m.userData.lbl = l; }
  return m;
}
// a drawable graph in the picture plane (x right, y up)
function mkGraph(s = 1) {
  const g = { V: {}, P: {}, E: {}, s };
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  g.v = (n, x, y, c = TC.node, name = n) => {
    const m = new THREE.Mesh(NG, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    m.scale.setScalar(s); m.position.set(x, y, 0); lab.world.add(m);
    if (name !== '' && name != null) { const l = lab.label(String(name), 'val'); m.add(l); }
    g.V[n] = m; g.P[n] = [x, y]; return m;
  };
  g.e = (a, b, c = TC.edge, dir = false) => {
    const [x1, y1] = g.P[a], [x2, y2] = g.P[b];
    const grp = new THREE.Group(); const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const end = dir ? 0.3 * s + 0.3 : 0; const ex = x2 - ux * end, ey = y2 - uy * end;
    const cyl = seg(x1, y1, ex, ey, c); lab.world.remove(cyl); grp.add(cyl);
    if (dir) { const cone = new THREE.Mesh(CONE, cyl.material); cone.position.set(ex + ux * 0.14, ey + uy * 0.14, -0.03); cone.rotation.z = cyl.rotation.z; grp.add(cone); grp.userData.cone = cone; }
    grp.userData.cyl = cyl; lab.world.add(grp); g.E[key(a, b)] = grp; return grp;
  };
  g.ecol = (a, b, c, thick) => { const e = g.E[key(a, b)]; if (!e) return; e.userData.cyl.material.color.set(c); const r = thick ? 0.1 : 0.05; e.userData.cyl.scale.x = r; e.userData.cyl.scale.z = r; };
  g.vcol = (n, c, gl) => { g.V[n].material.color.set(c); glow(g.V[n], gl); };
  g.cut = (a, b) => { const e = g.E[key(a, b)]; if (e) { kill(e); delete g.E[key(a, b)]; } };
  g.edges = () => Object.keys(g.E).map((k) => k.split('|'));
  g.names = () => Object.keys(g.V);
  g.all = () => [...Object.values(g.V), ...Object.values(g.E)];
  return g;
}
// nodes appear one by one (with the edges to nodes already there)
async function grow(tok, g, Pm, E, o = {}) {
  const order = o.order || Object.keys(Pm); const ms = o.ms || Math.min(200, 2200 / order.length);
  for (const n of order) {
    const m = g.v(n, Pm[n][0], Pm[n][1], o.c || TC.node, o.names ? (n in o.names ? o.names[n] : n) : n); m.scale.setScalar(0.01);
    for (const [u, v] of E) if ((u === n && g.V[v]) || (v === n && g.V[u])) g.e(u, v, TC.edge, !!o.dir && (o.dir === true ? true : o.dir(u, v)));
    await anim(tok, ms, (t) => m.scale.setScalar(Math.max(0.01, g.s * t)));
  }
}
const shift = (Pm, dx, dy, k = 1) => Object.fromEntries(Object.entries(Pm).map(([n, [x, y]]) => [n, [x * k + dx, y * k + dy]]));

// ── 圖的計算（全部在畫面上的那張圖上算） ──
function adj(names, edges) { const A = {}; names.forEach((n) => (A[n] = [])); edges.forEach(([u, v]) => { A[u].push(v); A[v].push(u); }); return A; }
function comps(names, edges) {
  const A = adj(names, edges), seen = new Set(), out = [];
  for (const s0 of names) { if (seen.has(s0)) continue; const c = [s0]; seen.add(s0); for (let i = 0; i < c.length; i++) for (const w of A[c[i]]) if (!seen.has(w)) { seen.add(w); c.push(w); } out.push(c); }
  return out;
}
function acyclic(names, edges) { const p = {}; names.forEach((n) => (p[n] = n)); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x]))); for (const [u, v] of edges) { const a = f(u), b = f(v); if (a === b) return false; p[a] = b; } return true; }
const isTree = (names, edges) => comps(names, edges).length === 1 && acyclic(names, edges);
function paths(names, edges, a, b) { const A = adj(names, edges), out = []; const go = (v, pth) => { if (v === b) { out.push(pth.slice()); return; } for (const w of A[v]) if (!pth.includes(w)) { pth.push(w); go(w, pth); pth.pop(); } }; go(a, [a]); return out; }
// every simple cycle = a connected edge subset where each vertex has degree 2
function cycleSets(edges) {
  const out = [], m = edges.length;
  for (let mask = 1; mask < (1 << m); mask++) {
    const sub = edges.filter((_, i) => mask & (1 << i)); const deg = {};
    sub.forEach(([u, v]) => { deg[u] = (deg[u] || 0) + 1; deg[v] = (deg[v] || 0) + 1; });
    const vs = Object.keys(deg); if (vs.some((x) => deg[x] !== 2)) continue;
    if (comps(vs, sub).length === 1) out.push(sub);
  }
  return out;
}
function allGraphs(n) {
  const names = range(n).map((i) => 'v' + i), pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([names[i], names[j]]);
  return range(1 << pairs.length).map((m) => ({ names, edges: pairs.filter((_, k) => m & (1 << k)), non: pairs.filter((_, k) => !(m & (1 << k))) }));
}
// rooted trees from a parent list
function kids(par) { const K2 = {}; Object.keys(par).forEach((v) => (K2[v] = K2[v] || [])); Object.entries(par).forEach(([v, p]) => { if (p) (K2[p] = K2[p] || []).push(v); }); return K2; }
function levels(par) { const L = {}; const f = (v) => (v in L ? L[v] : (L[v] = par[v] ? f(par[v]) + 1 : 0)); Object.keys(par).forEach(f); return L; }
const parEdges = (par) => Object.entries(par).filter(([, p]) => p).map(([v, p]) => [p, v]);
// complete m-ary trees as nested arrays (null = leaf, array of m subtrees = internal)
function complete(m, i) {
  if (i === 0) return [null];
  const comb = (k, left) => { if (k === m) return left === 0 ? [[]] : []; const r = []; for (let a = 0; a <= left; a++) for (const t of complete(m, a)) for (const rest of comb(k + 1, left - a)) r.push([t, ...rest]); return r; };
  return comb(0, i - 1);
}
const tN = (t) => (t ? 1 + t.reduce((s, c) => s + tN(c), 0) : 1);
const tL = (t) => (t ? t.reduce((s, c) => s + tL(c), 0) : 1);
const tI = (t) => (t ? 1 + t.reduce((s, c) => s + tI(c), 0) : 0);
const tH = (t) => (t ? 1 + Math.max(...t.map(tH)) : 0);
function leafLv(t, d = 0, acc = []) { if (!t) acc.push(d); else t.forEach((c) => leafLv(c, d + 1, acc)); return acc; }
const tBal = (t) => { const h = tH(t); return leafLv(t).every((l) => l === h || l === h - 1); };
const ceilLog = (m, l) => { let h = 0, p = 1; while (p < l) { p *= m; h++; } return h; };   // smallest h with mʰ ≥ l = ⌈log_m l⌉

// ── 共用的示意樹 T9（9 個端點、8 條邊） ──
const T9P = { a: [0, 5.9], b: [-2.4, 4.7], c: [0.2, 4.7], d: [2.6, 4.7], e: [-3.4, 3.5], f: [-1.4, 3.5], g: [1.6, 3.5], h: [3.6, 3.5], i: [-1.4, 2.3] };
const T9E = [['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e'], ['b', 'f'], ['d', 'g'], ['d', 'h'], ['f', 'i']];
const T9V = Object.keys(T9P);
const minus = (E, a, b) => E.filter(([u, v]) => !((u === a && v === b) || (u === b && v === a)));
function paintPath(g, pth, c) { for (let k = 0; k + 1 < pth.length; k++) g.ecol(pth[k], pth[k + 1], c, true); pth.forEach((n) => g.vcol(n, c)); }

// ════════ I0AdyRXvHY4（趙啟超 23A：tree 的定義、例子、三個性質、性質 1 與性質 2 前半的證明） ════════
scene('g8b-def', '23A：Tree 的定義——connected、沒有 cycle', [
  async (tok, S) => { // @4.0
    hot('Trees（樹狀圖）', 0, 7.0); cap('開始講 trees', 'tree 中文叫樹狀圖');
  },
  async (tok, S) => { // @5.5
    hd('tree 首先是 undirected simple graph', 0, 6.3);
    S.g = mkGraph(0.9); S.P = { p: [-4.4, 5.0], q: [-3.4, 3.9], r: [-4.6, 2.7], s: [-2.2, 2.8] };
    await grow(tok, S.g, S.P, [['p', 'q'], ['q', 'r'], ['q', 's']]);
    sm('undirected：邊沒有方向', -3.4, 1.9); cap('undirected：邊沒有方向', '');
  },
  async (tok, S) => { // @7.2
    const g = mkGraph(0.9); g.v('x', -0.3, 3.3); g.v('y', 1.0, 3.3); g.e('x', 'y');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 28), new THREE.MeshStandardMaterial({ color: TC.hot })); ring.position.set(-0.3, 3.95, 0); lab.world.add(ring);
    bad('loop ✘', 0.35, 4.75); sm('simple：沒有 loop', 0.35, 2.4); cap('simple graph：沒有 loop', '自己連到自己的邊不行');
  },
  async (tok, S) => { // @8.0
    const g = mkGraph(0.9); g.v('u', 2.6, 3.3); g.v('w', 4.6, 3.3);
    seg(2.6, 3.42, 4.6, 3.42, TC.hot); seg(2.6, 3.18, 4.6, 3.18, TC.hot);
    bad('兩條 edge ✘', 3.6, 4.2); sm('任兩點之間最多一條 edge', 3.6, 2.4); cap('任兩個端點之間最多一條 edge', '不能有重複的邊');
  },
  async (tok, S) => { // @9.6
    S.q = bub('這樣的 graph 要滿足什麼條件才叫 tree？兩個條件', 0, 1.2); cap('tree 要滿足兩個條件', '');
  },
  async (tok, S) => { // @74.7
    gone(S.q); const c = comps(Object.keys(S.P), S.g.edges());
    S.c1 = ok(c.length === 1, -3.4, 0.9, '條件 1：connected（只有 ' + c.length + ' 個 component）✓'); cap('條件一：connected graph', '只有一個 component');
  },
  async (tok, S) => { // @80.4
    const pth = paths(Object.keys(S.P), S.g.edges(), 'p', 's')[0]; paintPath(S.g, pth, TC.a);
    sm('任兩點都有 path：例 ' + pth.join('–'), -3.4, 0.35); cap('任何兩點之間都有 path 相連', '');
  },
  async (tok, S) => { // @82.4
    const ac = acyclic(Object.keys(S.P), S.g.edges());
    ok(ac, 2.4, 0.9, '條件 2：沒有 cycle ✓'); cap('條件二：沒有 cycle', '繞不回原點');
  },
  async (tok, S) => { // @86.6
    good('Tree = connected graph with no cycles', 0, -0.3); cap('tree：connected、沒有 cycle', '兩個都要');
  },
]);

// G1 tree、G2 有 cycle、G3 兩個 component（形狀是示意）
const G1 = { P: { 1: [0, 1.3], 2: [-0.9, 0.4], 3: [0.9, 0.4], 4: [-1.4, -0.6], 5: [-0.4, -0.6], 6: [0.9, -0.6] }, E: [['1', '2'], ['1', '3'], ['2', '4'], ['2', '5'], ['3', '6']] };
const G2 = { P: G1.P, E: [['1', '2'], ['1', '3'], ['2', '4'], ['2', '5'], ['3', '6'], ['5', '6']] };
const G3 = { P: { 1: [-0.8, 1.3], 2: [-1.4, 0.3], 3: [-0.3, 0.3], 4: [-0.3, -0.7], 5: [1.0, 1.1], 6: [1.0, 0.1], 7: [1.4, -0.8] }, E: [['1', '2'], ['1', '3'], ['3', '4'], ['5', '6'], ['6', '7']] };
const GX = [-4.3, 0, 4.3];
scene('g8b-examples', '23A：例子——G1 是 tree、G2 有 cycle、G3 是 forest', [
  async (tok, S) => { // @94.8
    hd('看例子：G1、G2、G3', 0, 7.0); note('圖形為示意', 4.6, 7.0); cap('看幾個例子', '');
  },
  async (tok, S) => { // @137.6
    S.g = [G1, G2, G3].map((G, k) => { const g = mkGraph(0.8); g.P0 = shift(G.P, GX[k], 4.4); g.E0 = G.E; return g; });
    S.nm = [0, 1, 2].map((k) => pl('G' + (k + 1), GX[k], 6.2));
    for (const g of S.g) await grow(tok, g, g.P0, g.E0, { ms: 110 });
    sm('三個都是 undirected simple graph', 0, 2.8); cap('三個 graph', '都是 undirected simple graph');
  },
  async (tok, S) => { // @147.0
    const g = S.g[0]; const c = comps(g.names(), g.edges()).length;
    ok(c === 1, GX[0], 2.1, 'connected ✓'); cap('G1 是不是 tree？', '先看 connected：是');
  },
  async (tok, S) => { // @153.0
    const g = S.g[0]; const ac = acyclic(g.names(), g.edges()); g.names().forEach((n) => g.vcol(n, TC.green));
    ok(ac, GX[0], 1.5, '沒有 cycle ✓'); good(isTree(g.names(), g.edges()) ? 'G1 是 tree' : '?', GX[0], 0.8); cap('G1 沒有 cycle', '所以 G1 是 tree');
  },
  async (tok, S) => { // @167.6
    const g = S.g[1]; const c = comps(g.names(), g.edges()).length;
    ok(c === 1, GX[1], 2.1, 'connected（' + c + ' 個 component）✓'); cap('G2 是 connected', '只有一個 component');
  },
  async (tok, S) => { // @172.1
    const g = S.g[1]; const cs = cycleSets(g.edges()); S.cyc = cs[0];
    cs[0].forEach(([u, v]) => g.ecol(u, v, TC.hot, true));
    bad('有 cycle：' + cs.length + ' 個 ✘', GX[1], 1.5); cap('但 G2 有 cycle', '紅色這圈');
  },
  async (tok, S) => { // @176.0
    bad('G2 不是 tree', GX[1], 0.8); cap('所以 G2 不是 tree', '因為有 cycle');
  },
  async (tok, S) => { // @195.0
    glow(S.g[2].V['1'], HL); cap('再看 G3', '');
  },
  async (tok, S) => { // @205.0
    const g = S.g[2]; glow(g.V['1'], null); S.c3 = comps(g.names(), g.edges());
    bad('connected？不是：' + S.c3.length + ' 個 component ✘', GX[2], 2.1); cap('條件一 connected？', 'G3 有兩個 component');
  },
  async (tok, S) => { // @210.4
    bad('G3 不是 tree', GX[2], 1.5); cap('不是 connected', '所以 G3 不是 tree');
  },
  async (tok, S) => { // @237.5
    const g = S.g[2]; const col = [TC.a, TC.b];
    const each = S.c3.map((c, k) => { c.forEach((n) => g.vcol(n, col[k])); const E = g.edges().filter(([u]) => c.includes(u)); return isTree(c, E); });
    ok(each.every(Boolean), GX[2], 0.8, '兩個 component 各自都是 tree ✓'); cap('但兩個 component', '本身都是 tree');
  },
  async (tok, S) => { // @270.4
    hot('每個 component 都是 tree → forest', 0, 0.0); cap('每個 component 都是 tree', '這種圖叫 forest');
  },
  async (tok, S) => { // @296.0
    sm('forest = 森林：好多棵樹（tree 本身也是只有一棵樹的 forest）', 0, -0.6); cap('forest 中文是森林', '好多棵樹');
  },
]);

scene('g8b-props', '23A：Tree 的三個性質', [
  async (tok, S) => { // @318.0
    hd('Tree 的性質', 0, 7.0); cap('tree 有一些性質', '後面都在討論這些');
  },
  async (tok, S) => { // @338.0
    S.g = mkGraph(0.9); await grow(tok, S.g, T9P, T9E); note('T（示意）', 4.6, 5.9);
    sm('一般 graph 叫 G；是 tree 時用 T', 0, 1.5); cap('tree 用 T 表示', '一般 graph 用 G');
  },
  async (tok, S) => { // @399.4
    const ps = paths(T9V, T9E, 'e', 'h'); S.ps = ps; paintPath(S.g, ps[0], TC.a);
    S.t1 = pl('性質 1：|V| ≥ 2 時，任兩個不同端點之間有 unique path', 0, 1.1); cap('性質一：任兩點之間', '有唯一的一條 path');
  },
  async (tok, S) => { // @423.1
    ok(S.ps.length === 1, 0, 0.45, 'e 到 h 的 path 一共 ' + S.ps.length + ' 條：' + S.ps[0].join('–') + ' ✓');
    sm('connected 只保證「有」path；tree 保證「只有一條」', 0, -0.15); cap('重點是 unique', '不只有路，而且只有一條');
  },
  async (tok, S) => { // @497.0
    gone(S.t1); S.g.names().forEach((n) => S.g.vcol(n, TC.node)); T9E.forEach(([u, v]) => S.g.ecol(u, v, TC.edge));
    S.g.cut('a', 'b'); S.cut = dash([T9P.a, T9P.b], TC.hot);
    S.t2 = pl('性質 2：拿掉任何一條 edge（例：{a,b}）', 0, 1.1); cap('性質二：拿掉任何一條 edge', '');
  },
  async (tok, S) => { // @515.4
    const cs = comps(T9V, minus(T9E, 'a', 'b')); cs.forEach((c, k) => c.forEach((n) => S.g.vcol(n, [TC.a, TC.b][k])));
    let all = true; for (const [u, v] of T9E) { const E2 = minus(T9E, u, v); const c2 = comps(T9V, E2); if (c2.length !== 2 || !c2.every((c) => isTree(c, E2.filter(([x]) => c.includes(x))))) all = false; }
    ok(cs.length === 2 && all, 0, 0.45, '剛好 ' + cs.length + ' 個 component、每個都是 tree；8 條邊逐一試都一樣 ✓'); cap('剩下 exactly 兩個 component', '每個都是 tree');
  },
  async (tok, S) => { // @547.0
    gone(S.cut, S.t2); S.g.e('a', 'b'); T9V.forEach((n) => S.g.vcol(n, TC.node));
    const nv = S.g.names().length, ne = S.g.edges().length;
    ok(nv === ne + 1, 0, -0.75, '性質 3：|V| = |E| + 1　這棵：' + nv + ' = ' + ne + ' + 1 ✓'); cap('性質三：端點個數比邊多一', '每個 tree 都是');
  },
  async (tok, S) => { // @563.6
    bub('三個性質都來證明一下', 0, -1.35); cap('三個都證明', '證明過程能更了解 tree');
  },
]);

// 證明性質 1：兩條 path → cycle（示意）
const PF1P = { a: [-4.6, 3.6], x: [-3.0, 3.6], p1: [-1.2, 5.2], p2: [1.4, 5.2], b: [3.6, 3.6], q1: [-1.4, 2.1], q2: [0.4, 1.9], q3: [2.2, 2.2] };
scene('g8b-pf1', '23A：證明性質 1——兩點之間的 path 唯一', [
  async (tok, S) => { // @576.0
    hd('證明性質 1：任兩個不同端點之間只有一條 path', 0, 7.0); cap('來證第一個性質', '');
  },
  async (tok, S) => { // @646.4
    S.g = mkGraph(0.9); S.g.v('a', ...PF1P.a, TC.a); S.g.v('b', ...PF1P.b, TC.b); note('示意', 5.2, 6.2);
    cap('T 裡兩個不同端點 a、b', '');
  },
  async (tok, S) => { // @658.0
    S.t = pl('T 是 connected → a、b 之間至少一條 path', 0, 0.8); cap('T connected', '所以至少有一條 path');
  },
  async (tok, S) => { // @672.0
    sm('要證「只有一條」：用反證——假設不只一條，推出矛盾', 0, 0.2); cap('證只有一條：反證法', '假設結論不成立，推出矛盾');
  },
  async (tok, S) => { // @700.7
    S.q = bub('假設：a、b 之間不只一條 path', 0, -0.5); cap('假設有不只一條 path', '');
  },
  async (tok, S) => { // @715.2
    const g = S.g; for (const n of ['x', 'p1', 'p2']) { g.v(n, ...PF1P[n], TC.node, ''); }
    [['a', 'x'], ['x', 'p1'], ['p1', 'p2'], ['p2', 'b']].forEach(([u, v]) => g.e(u, v, TC.gold)); sm('path 1', 0.1, 5.8);
    cap('一條 path', '隨便畫的');
  },
  async (tok, S) => { // @719.1
    const g = S.g; for (const n of ['q1', 'q2', 'q3']) g.v(n, ...PF1P[n], TC.node, '');
    [['x', 'q1'], ['q1', 'q2'], ['q2', 'q3'], ['q3', 'b']].forEach(([u, v]) => g.e(u, v, TC.purple)); sm('path 2（前面一段跟 path 1 共用）', 0.4, 1.3);
    cap('還有另外一條 path', '也是隨便畫的');
  },
  async (tok, S) => { // @746.0
    const cs = cycleSets(S.g.edges()); S.cs = cs; cs[0].forEach(([u, v]) => S.g.ecol(u, v, TC.hot, true));
    bad('出現 cycle（' + cs.length + ' 個）', 4.6, 4.6); cap('就一定會有 cycle', '不管兩條 path 怎麼交');
  },
  async (tok, S) => { // @805.0
    gone(S.q); bad('兩條 path 的某些 edges 構成 cycle → 違反「tree 沒有 cycle」✘', 0, -0.5); cap('某部分的 edges 構成 cycle', '跟 tree 沒有 cycle 矛盾');
  },
  async (tok, S) => { // @831.3
    good('所以任兩個不同端點之間只有唯一一條 path ✓', 0, -1.2); cap('所以只有唯一一條 path', '');
  },
]);

scene('g8b-pf2a', '23A：證明性質 2（上）——拿掉 {a,b} 後一定不 connected', [
  async (tok, S) => { // @850.0
    hd('證明性質 2：拿掉任一條 edge → 剛好 2 個 component、每個都是 tree', 0, 7.0); cap('再來證第二個性質', '');
  },
  async (tok, S) => { // @865.6
    S.l = sm('要證兩件事：① 剛好兩個 component　② 兩個都是 tree', 0, 6.5); cap('要證兩點', '剛好兩個 component；每個都是 tree');
  },
  async (tok, S) => { // @932.2
    S.g = mkGraph(0.9); await grow(tok, S.g, T9P, T9E); note('示意', 4.6, 5.9); S.g.ecol('a', 'b', TC.gold, true);
    cap('{a,b} 是 T 的任一條 edge', '');
  },
  async (tok, S) => { // @941.0
    S.g.cut('a', 'b'); S.d = dash([T9P.a, T9P.b], TC.gold); S.g.vcol('a', TC.a); S.g.vcol('b', TC.b);
    sm('只拿掉 edge，端點 a、b 還在', 0, 1.6); cap('把這條 edge 拿掉', '端點還在');
  },
  async (tok, S) => { // @953.0
    hot("T' = (V, E − {{a,b}})", 0, 1.0); cap("剩下的圖叫 T'", 'vertex set 不變，少一條 edge');
  },
  async (tok, S) => { // @996.7
    S.t = pl("第一步：先說明 T' 一定不是 connected", 0, 0.35); cap("先說明 T' 不是 connected", '再說明剛好兩個 component');
  },
  async (tok, S) => { // @1011.5
    S.q = bub("反證：假設 T' 還是 connected", 0, -0.3); cap("用反證：假設 T' connected", '');
  },
  async (tok, S) => { // @1071.5
    S.fake = dash([T9P.b, [-4.9, 5.2], [-4.9, 6.5], [0, 6.5], T9P.a], TC.hot); bad("假想：T' 裡 a 到 b 還有一條 path", -3.3, 6.0);
    cap("那 a 跟 b 在 T' 還有一條 path", '');
  },
  async (tok, S) => { // @1089.4
    bad('那原來 T 裡 a、b 之間就有兩條 path（還有 {a,b}）→ 跟性質 1 矛盾 ✘', 0, -0.95); cap('原來 T 裡 a、b 就有兩條 path', '跟性質一矛盾');
  },
  async (tok, S) => { // @1114.0
    gone(S.fake, S.q); const c = comps(T9V, minus(T9E, 'a', 'b')).length;
    ok(c > 1, 0, -1.6, "所以 T' 一定 disconnected（這張圖算出 " + c + ' 個 component）✓'); cap("拿掉 {a,b} 後 T' 一定 disconnected", '');
  },
  async (tok, S) => { // @1199.4
    bub('下一步：證明剛好兩個 component', 4.0, 1.6); cap('再來：證明剛好兩個 component', '');
  },
]);

// ════════ VHsNFDXGV-0（趙啟超 23B：性質 2 後半、性質 3 與數學歸納法） ════════
scene('g8b-pf2b', "23B：證明性質 2（下）——T' 剛好兩個 component、都是 tree", [
  async (tok, S) => { // @4.4
    hd("T' 不 connected：把端點分成兩組", 0, 7.0);
    S.g = mkGraph(0.9); await grow(tok, S.g, T9P, minus(T9E, 'a', 'b')); S.d = dash([T9P.a, T9P.b], TC.gold); note('示意', 4.6, 5.9);
    S.E = minus(T9E, 'a', 'b'); S.cs = comps(T9V, S.E); cap("T' 是 disconnected", '把端點分成兩個 subset');
  },
  async (tok, S) => { // @6.6
    const A = S.cs.find((c) => c.includes('a')); A.forEach((n) => S.g.vcol(n, TC.a));
    pl('第一組：a 和能經過 path 連到 a 的端點 ' + A.sort().join(' '), 0, 1.5); cap('第一組：a', '和能連到 a 的端點');
  },
  async (tok, S) => { // @41.7
    const B = S.cs.find((c) => c.includes('b')); B.forEach((n) => S.g.vcol(n, TC.b));
    pl('第二組：b 和能連到 b 的端點 ' + B.sort().join(' '), 0, 0.95); cap('第二組：b', '和能連到 b 的端點');
  },
  async (tok, S) => { // @60.5
    S.q = bub('為什麼剛好兩組？原來在 T 裡，每個端點都有唯一 path 連到 a', 0, 0.3); cap('為什麼剛好兩組？', '原來每個端點都有 path 到 a');
  },
  async (tok, S) => { // @68.0
    const p = paths(T9V, T9E, 'h', 'a')[0]; p.slice(0, -1).forEach((n, k) => S.g.ecol(n, p[k + 1], TC.a, true));
    pl('例 h：' + p.join('–') + '，沒經過 {a,b} → 拿掉後還連到 a（第一組）', 0, -0.3); cap('path 沒經過 {a,b}', '拿掉後還連到 a');
  },
  async (tok, S) => { // @84.6
    const p = paths(T9V, T9E, 'i', 'a')[0]; p.slice(0, -1).forEach((n, k) => { if (S.g.E[[n, p[k + 1]].sort().join('|')]) S.g.ecol(n, p[k + 1], TC.b, true); });
    pl('例 i：' + p.join('–') + '，經過 {a,b} → 拿掉後只連到 b（第二組）', 0, -0.85); cap('path 經過 {a,b}', '拿掉後只連到 b');
  },
  async (tok, S) => { // @109.7
    gone(S.q); ok(S.cs.length === 2, 0, -1.45, '不是經過就是沒經過 → 剛好 ' + S.cs.length + ' 個 component ✓'); cap('只有兩種情況', '所以剛好兩個 component');
  },
  async (tok, S) => { // @145.2
    S.q2 = bub('兩個 component 都是 tree？如果某個有 cycle，原來的 T 就有 cycle', 0, 6.3); cap('兩個 component 都是 tree 嗎？', '有 cycle 的話原來 T 就有');
  },
  async (tok, S) => { // @161.7
    const allT = S.cs.every((c) => acyclic(c, S.E.filter(([u]) => c.includes(u))));
    ok(allT, 4.0, 2.3, '拿掉邊不會製造新 cycle → 兩個都是 tree ✓'); cap('拿掉一條邊不會產生新的 cycle', '兩個都是 tree');
  },
  async (tok, S) => { // @223.3
    gone(S.q2); good('整理：① 不 connected（否則 a、b 有兩條 path）② 剛好兩組 ③ 都沒 cycle → 性質 2 證完', 0, 6.3); cap('整理一下性質二的證明', '');
  },
]);

scene('g8b-p3small', '23B：性質 3——畫幾棵小 tree 看 |V| = |E| + 1', [
  async (tok, S) => { // @321.2
    hd('性質 3：|V| = |E| + 1（端點比邊多一個）', 0, 7.0); cap('第三個性質', '端點比邊多一');
  },
  async (tok, S) => { // @341.6
    S.T = []; const g = mkGraph(0.8); g.v('1', -5.2, 5.0); S.T.push(g); cap('一個端點的 tree', '');
  },
  async (tok, S) => { // @344.8
    const g = mkGraph(0.8); await grow(tok, g, { 1: [-3.6, 5.6], 2: [-3.6, 4.2] }, [['1', '2']]); S.T.push(g); cap('兩個端點的 tree', '');
  },
  async (tok, S) => { // @348.8
    const g = mkGraph(0.8); await grow(tok, g, { 1: [-1.6, 5.6], 2: [-2.2, 4.4], 3: [-1.0, 4.4] }, [['1', '2'], ['1', '3']]); S.T.push(g); cap('三個端點的 tree', '');
  },
  async (tok, S) => { // @352.4
    const g = mkGraph(0.8); await grow(tok, g, { 1: [0.8, 6.0], 2: [0.8, 5.0], 3: [0.8, 4.0], 4: [0.8, 3.0] }, [['1', '2'], ['2', '3'], ['3', '4']]); S.T.push(g); cap('四個端點：有很多樣子', '隨便畫一個');
  },
  async (tok, S) => { // @361.0
    const g = mkGraph(0.8); await grow(tok, g, { 1: [3.6, 5.0], 2: [2.6, 4.0], 3: [3.6, 3.8], 4: [4.6, 4.0] }, [['1', '2'], ['1', '3'], ['1', '4']]); S.T.push(g);
    sm('四個端點的另一種', 3.6, 2.9); cap('當然還有別種', '');
  },
  async (tok, S) => { // @366.2
    const xs = [-5.2, -3.6, -1.6, 0.8, 3.6];
    S.T.forEach((g, k) => { const nv = g.names().length, ne = g.edges().length; ok(isTree(g.names(), g.edges()) && nv === ne + 1, xs[k], 1.9, nv + ' 點 ' + ne + ' 邊 ✓'); });
    cap('1→0、2→1、3→2、4→3', '端點總比邊多一');
  },
]);

scene('g8b-p3ind', '23B：用數學歸納法證 |V| = |E| + 1', [
  async (tok, S) => { // @384.6
    hd('證明：對端點個數做數學歸納法（induction on |V|）', 0, 7.0); cap('用數學歸納法', 'induction on number of vertices');
  },
  async (tok, S) => { // @409.1
    S.l1 = pl('basis：最少的 case 是 1 個端點', -3.4, 6.2); const g = mkGraph(0.8); g.v('v', -5.6, 5.4); S.g0 = g; cap('induction basis', '最少只有一個端點');
  },
  async (tok, S) => { // @430.6
    ok(S.g0.edges().length === 0, -3.0, 5.4, '沒有邊：|E| = 0 = 1 − 1 ✓'); cap('一個端點沒有邊', '|E| = 0，成立');
  },
  async (tok, S) => { // @478.6
    pl('hypothesis：所有端點個數 ≤ k 的 tree 都成立（k ≥ 1）', 0, 4.6); cap('induction hypothesis', '1 到 k 個端點都成立');
  },
  async (tok, S) => { // @508.2
    hot('induction step：證 k + 1 個端點也成立', 0, 3.9); cap('induction step', '');
  },
  async (tok, S) => { // @537.1
    gone(S.l1, S.g0); S.T = shift(T9P, 0, -3.3, 0.8);
    S.g = mkGraph(0.75); await grow(tok, S.g, S.T, T9E, { names: {} }); note('示意：k + 1 = 9', 4.4, 2.0);
    cap('考慮 k + 1 個端點的 tree T', '');
  },
  async (tok, S) => { // @568.0
    S.g.cut('a', 'b'); S.d = dash([S.T.a, S.T.b], TC.gold); cap('拿掉一條 edge', '為了能用 hypothesis');
  },
  async (tok, S) => { // @594.0
    S.cs = comps(T9V, minus(T9E, 'a', 'b')); S.cs.forEach((c, k) => c.forEach((n) => S.g.vcol(n, [TC.a, TC.b][k])));
    cap('由性質二：變成兩個 tree', 'T1、T2');
  },
  async (tok, S) => { // @651.0
    const E2 = minus(T9E, 'a', 'b'); S.n = S.cs.map((c) => [c.length, E2.filter(([u]) => c.includes(u)).length]);
    pl('T1：|V1| = ' + S.n[0][0] + '、|E1| = ' + S.n[0][1], 3.2, 3.3); pl('T2：|V2| = ' + S.n[1][0] + '、|E2| = ' + S.n[1][1], -3.6, 3.3);
    S.g.vcol('a', TC.a); cap('T1 有 V1、E1；T2 有 V2、E2', '');
  },
  async (tok, S) => { // @693.0
    ok(S.n[0][0] + S.n[1][0] === 9, 0, 0.5, '|V1| + |V2| = |V| = k + 1（端點沒少）　例：' + S.n[0][0] + ' + ' + S.n[1][0] + ' = 9 ✓'); cap('端點總數不變', '|V1| + |V2| = k + 1');
  },
  async (tok, S) => { // @716.5
    ok(S.n[0][1] + S.n[1][1] === 8 - 1, 0, -0.1, '|E1| + |E2| = |E| − 1（少一條邊）　例：' + S.n[0][1] + ' + ' + S.n[1][1] + ' = 8 − 1 ✓'); cap('邊少了一條', '|E1| + |E2| = |E| − 1');
  },
  async (tok, S) => { // @741.4
    pl('兩棵各至少有 1 個端點（a 一邊、b 一邊）→ 兩棵都 ≤ k 個端點', 0, -0.7); cap('兩棵都至少一個端點', '所以都不超過 k');
  },
  async (tok, S) => { // @848.1
    ok(S.n.every(([v, e]) => v === e + 1), 0, -1.3, 'hypothesis 可用：|V1| = |E1| + 1、|V2| = |E2| + 1 ✓'); cap('套用 induction hypothesis', '兩棵都端點比邊多一');
  },
  async (tok, S) => { // @876.6
    S.eq = hot('|V| = |V1| + |V2| = (|E1| + 1) + (|E2| + 1) = (|E| − 1) + 2', 0, -1.95); cap('代進去', '');
  },
  async (tok, S) => { // @926.5
    gone(S.eq); good('|V| = (|E| − 1) + 2 = |E| + 1　induction step 完成 ✓', 0, -1.95); cap('= |E| + 1', 'induction step 完成');
  },
  async (tok, S) => { // @934.0
    let okAll = true, cnt = 0;
    for (let n = 1; n <= 5; n++) for (const G of allGraphs(n)) if (isTree(G.names, G.edges)) { cnt++; if (G.edges.length !== n - 1) okAll = false; }
    ok(okAll, 0, 6.2, '數學歸納法 → 所有 tree 都成立；電腦檢查 n ≤ 5 的全部 ' + cnt + ' 棵（有標號的）tree ✓'); cap('由數學歸納法', '對所有 tree 都成立');
  },
  async (tok, S) => { // @965.7
    sm('流程：basis → hypothesis（≤ k）→ 拿掉一條邊變兩棵 → 套 hypothesis → 加起來', 0, 5.6); cap('再講一次證明流程', '');
  },
]);

// ════════ BlAe2OrCgTw（趙啟超 23C：四個等價敘述與證明 a⇒b⇒c⇒d） ════════
scene('g8b-equiv', '23C：定理——四個等價敘述 (a)(b)(c)(d)', [
  async (tok, S) => { // @4.0
    hd('定理：undirected simple graph T（|V|、|E|）的四個敘述互相等價', 0, 7.0); cap('一個定理有四個 statement', '四個都 equivalent');
  },
  async (tok, S) => { // @8.1
    sm('所以 (b)(c)(d) 都可以拿來當 tree 的定義', 0, 6.4); cap('剩下三個', '都可以當 tree 的定義');
  },
  async (tok, S) => { // @39.6
    pl('(a) T 是 tree', -3.2, 5.6); cap('(a) T 是 tree', '');
  },
  async (tok, S) => { // @57.8
    pl('(b) T 沒有 cycle，且 |V| = |E| + 1', -3.2, 5.0); cap('(b) 沒有 cycle', '且 |V| = |E| + 1');
  },
  async (tok, S) => { // @63.1
    pl('(c) T connected，且 |V| = |E| + 1', -3.2, 4.4); cap('(c) connected', '且 |V| = |E| + 1');
  },
  async (tok, S) => { // @87.0
    const C = [['connected', 2.6, 5.6, TC.a], ['沒有 cycle', 5.0, 5.6, TC.green], ['|V| = |E| + 1', 3.8, 4.3, TC.orange]];
    C.forEach(([t, x, y, c]) => cube(t, c, [2.1, 0.55, 0.4], x, y, 0, 0.6));
    let bad3 = 0, tot = 0;
    for (let n = 1; n <= 5; n++) for (const G of allGraphs(n)) { tot++; const c = comps(G.names, G.edges).length === 1, a = acyclic(G.names, G.edges), q = n === G.edges.length + 1; if ((c && a && !q) || (a && q && !c) || (c && q && !a)) bad3++; }
    ok(bad3 === 0, 3.8, 3.4, '任兩個成立 ⇒ 第三個成立（電腦查 n ≤ 5 全部 ' + tot + ' 個圖）✓'); cap('三個條件任兩個成立', '第三個就自動成立');
  },
  async (tok, S) => { // @141.4
    pl('(d) T 沒有 cycle，且對不相鄰的端點 a、b，加上 {a,b} 就剛好產生一個 cycle', 0, 2.5); cap('(d) 沒有 cycle', '加一條原本沒有的邊 → 剛好一個 cycle');
  },
  async (tok, S) => { // @192.5
    let bad4 = 0;
    for (let n = 1; n <= 5; n++) for (const G of allGraphs(n)) { const a = acyclic(G.names, G.edges); const d = a && G.non.every((e) => cycleSets([...G.edges, e]).length === 1); if (d !== isTree(G.names, G.edges)) bad4++; }
    ok(bad4 === 0, 0, 1.8, '(d) ⇔ tree：n ≤ 5 全部檢查 ✓'); cap('(d) 也跟 tree 等價', '');
  },
  async (tok, S) => { // @201.3
    hot('證法：(a) ⇒ (b) ⇒ (c) ⇒ (d) ⇒ (a)，繞一圈就任兩個互推', 0, 1.0); cap('證法：繞一圈', 'a⇒b⇒c⇒d⇒a');
  },
]);

scene('g8b-ab', '23C：(a) ⇒ (b)', [
  async (tok, S) => { // @237.7
    hd('(a) ⇒ (b)：假設 T 是 tree', 0, 7.0); S.g = mkGraph(0.85); await grow(tok, S.g, T9P, T9E); note('示意', 4.6, 5.9); cap('假設 T 是 tree', '');
  },
  async (tok, S) => { // @257.0
    ok(acyclic(T9V, T9E), 0, 1.5, 'tree 的定義：connected、沒有 cycle → 當然沒有 cycle ✓'); cap('tree 的定義就沒有 cycle', '');
  },
  async (tok, S) => { // @273.3
    ok(T9V.length === T9E.length + 1, 0, 0.9, '前面性質 3：|V| = |E| + 1（這棵 ' + T9V.length + ' = ' + T9E.length + ' + 1）✓'); cap('前面證過的性質', '|V| = |E| + 1');
  },
  async (tok, S) => { // @321.6
    good('(a) ⇒ (b) 完成：四個證明裡最簡單的一個', 0, 0.2); cap('a ⇒ b 最簡單', '直接套前面的性質');
  },
]);

const FOR = { P: { x1: [-4.6, 5.4], x2: [-5.2, 4.2], x3: [-4.0, 4.2], y1: [-1.0, 5.4], y2: [-1.0, 4.2], z1: [3.5, 5.4], z2: [2.6, 4.2], z3: [4.4, 4.2], z4: [4.4, 3.0] }, E: [['x1', 'x2'], ['x1', 'x3'], ['y1', 'y2'], ['z1', 'z2'], ['z1', 'z3'], ['z3', 'z4']] };
scene('g8b-bc', '23C：(b) ⇒ (c)——數 component', [
  async (tok, S) => { // @331.7
    hd('(b) ⇒ (c)：已知沒有 cycle、|V| = |E| + 1', 0, 7.0); cap('b 推到 c', '');
  },
  async (tok, S) => { // @361.3
    S.t = pl('|V| = |E| + 1 已經有了 → 只要證 T 是 connected', 0, 6.4); cap('只要證 connected 就好', '');
  },
  async (tok, S) => { // @373.4
    S.g = mkGraph(0.8); await grow(tok, S.g, FOR.P, FOR.E, { names: {} }); note('示意：r = 3', 5.4, 6.0);
    S.cs = comps(Object.keys(FOR.P), FOR.E); S.cs.forEach((c, k) => c.forEach((n) => S.g.vcol(n, [TC.a, TC.b, TC.green][k])));
    ['T1', 'T2', 'T3'].forEach((t, k) => sm(t, [-4.6, -1.0, 3.5][k], 2.4));
    cap('先不假設 connected', '設 T 有 r 個 component');
  },
  async (tok, S) => { // @463.5
    pl('Ti 有 |Vi| 個端點、|Ei| 條邊；Σ|Vi| = |V|、Σ|Ei| = |E|', 0, 1.6); cap('第 i 個 component：|Vi|、|Ei|', '加起來就是全部');
  },
  async (tok, S) => { // @486.2
    const each = S.cs.map((c) => isTree(c, FOR.E.filter(([u]) => c.includes(u))));
    ok(each.every(Boolean), 0, 1.0, '每個 component：connected（component 的定義）＋ 沒有 cycle（(b)）→ 都是 tree ✓'); cap('每個 component 都是 tree', 'connected 又沒有 cycle');
  },
  async (tok, S) => { // @576.0
    const nn = S.cs.map((c) => [c.length, FOR.E.filter(([u]) => c.includes(u)).length]); S.nn = nn;
    ok(nn.every(([v, e]) => v === e + 1), 0, 0.4, '所以每個都 |Vi| = |Ei| + 1：' + nn.map(([v, e]) => v + ' = ' + e + ' + 1').join('、') + ' ✓'); cap('每個 component 端點比邊多一', '');
  },
  async (tok, S) => { // @685.2
    const V = Object.keys(FOR.P).length, E = FOR.E.length;
    ok(V === E + S.cs.length, 0, -0.2, '|V| = Σ(|Ei| + 1) = |E| + r　這張：' + V + ' = ' + E + ' + ' + S.cs.length + ' ✓'); cap('全部加起來', '|V| = |E| + r');
  },
  async (tok, S) => { // @717.1
    hot('但 (b) 說 |V| = |E| + 1 → r = 1', 0, -0.8); bad('（示意圖 r = 3，不滿足 (b)）', 0, -1.4); cap('(b) 假設 |V| = |E| + 1', '所以 r 只能是 1');
  },
  async (tok, S) => { // @744.6
    good('只有一個 component → T connected ✓', 0, -2.0); cap('只有一個 component', '所以 connected');
  },
  async (tok, S) => { // @775.3
    sm('直觀：兩個 component 各多 1，就多 2 了，不對', 0, 6.4); gone(S.t); cap('直觀：每個 component 多一', '多個 component 數目就對不上');
  },
]);

const HEX = Object.fromEntries(range(6).map((k) => ['c' + (k + 1), [-1.6 + 1.5 * Math.cos(Math.PI / 2 - k * Math.PI / 3), 4.2 + 1.5 * Math.sin(Math.PI / 2 - k * Math.PI / 3)]]));
const HEXE = range(6).map((k) => ['c' + (k + 1), 'c' + (((k + 1) % 6) + 1)]);
scene('g8b-cd1', '23C：(c) ⇒ (d) 第一部分——T 沒有 cycle', [
  async (tok, S) => { // @823.7
    hd('(c) ⇒ (d)：已知 connected、|V| = |E| + 1', 0, 7.0); S.t = sm('要證：① 沒有 cycle　② 加一條沒有的邊 → 剛好一個 cycle', 0, 6.4); cap('c 推到 d', '要證兩部分');
  },
  async (tok, S) => { // @868.0
    S.q = bub('先證 ① 沒有 cycle：反證，假設 T 有 cycle C', 3.0, 1.6); cap('先證沒有 cycle', '假設有 cycle，推出矛盾');
  },
  async (tok, S) => { // @913.7
    S.g = mkGraph(0.8); await grow(tok, S.g, HEX, HEXE, { names: Object.fromEntries(range(6).map((k) => ['c' + (k + 1), String(k + 1)])) });
    HEXE.forEach(([u, v]) => S.g.ecol(u, v, TC.hot, true)); note('示意', -4.2, 6.0); sm('cycle C', -1.6, 4.2);
    cap('畫一個 cycle C', '一、二、三、四、五、六');
  },
  async (tok, S) => { // @937.5
    S.cnt = pl('cycle 上：' + S.g.names().length + ' 個端點、' + S.g.edges().length + ' 條邊 → 一樣多', 0, 0.9); cap('單看 cycle', '邊數 = 端點數');
  },
  async (tok, S) => { // @979.2
    gone(S.q); S.g.v('x', 1.6, 5.2, TC.a); S.g.e('x', 'c2', TC.a);
    txt(S.cnt, '加上 x：' + S.g.names().length + ' 個端點、' + S.g.edges().length + ' 條邊'); cap('不在 cycle 上的端點', 'connected → 一定有路連到 cycle');
  },
  async (tok, S) => { // @1037.6
    sm('每多考慮一個端點，至少多一條新的邊', 3.4, 4.2); cap('每多一個端點', '至少多一條新的邊');
  },
  async (tok, S) => { // @1061.1
    S.g.v('y', 3.4, 5.8, TC.b); S.g.e('y', 'x', TC.b); sm('y 不一定直接連到 cycle（經過 x）', 3.8, 6.4);
    txt(S.cnt, '加上 y：' + S.g.names().length + ' 個端點、' + S.g.edges().length + ' 條邊'); cap('不見得直接連到 cycle', '但還是多一條新的邊');
  },
  async (tok, S) => { // @1105.0
    const V = S.g.names().length, E = S.g.edges().length;
    ok(E >= V, 0, 0.3, '所以 |E| ≥ |V|（這裡 ' + E + ' ≥ ' + V + '）✓'); cap('邊數不會小於端點數', '|E| ≥ |V|');
  },
  async (tok, S) => { // @1213.2
    bad('但 (c) 說 |V| = |E| + 1（|E| < |V|）→ 矛盾 ✘', 0, -0.35); cap('跟 (c) 的假設矛盾', '|V| 應該比 |E| 多一');
  },
  async (tok, S) => { // @1242.3
    gone(S.t); good('① T 沒有 cycle；又 connected → T 是 tree ✓', 0, -1.0); cap('所以 T 沒有 cycle', '加上 connected：T 是 tree');
  },
]);

const CD2N = Object.fromEntries(T9V.map((n) => [n, n === 'i' ? 'a' : n === 'c' ? 'b' : '']));
scene('g8b-cd2', '23C：(c) ⇒ (d) 第二部分——加一條邊剛好一個 cycle', [
  async (tok, S) => { // @1277.0
    hd('② tree 加一條原本沒有的邊 {a,b} → 剛好一個 cycle', 0, 7.0);
    S.g = mkGraph(0.85); await grow(tok, S.g, T9P, T9E, { names: CD2N }); note('示意', 4.6, 5.9); S.g.vcol('i', TC.a); S.g.vcol('c', TC.b);
    cap('T 已經是 tree 了', '證第二部分');
  },
  async (tok, S) => { // @1324.0
    sm('會用到：tree 任兩個不同端點之間有唯一 path', 0, 6.4); cap('要用性質一', '唯一 path');
  },
  async (tok, S) => { // @1347.7
    S.g.e('i', 'c', TC.yel); S.g.ecol('i', 'c', TC.yel, true); S.E2 = [...T9E, ['i', 'c']];
    pl("加上黃色的 {a,b}，新圖叫 T'", 0, 1.5); cap('把 {a,b} 加上去', "新圖叫 T'");
  },
  async (tok, S) => { // @1392.4
    S.p = paths(T9V, T9E, 'i', 'c')[0]; S.p.slice(0, -1).forEach((n, k) => S.g.ecol(n, S.p[k + 1], TC.purple, true));
    pl('T 裡 a 到 b 有唯一 path P（紫色）', 0, 0.9); cap('原來 T 裡 a 到 b 有唯一 path P', '');
  },
  async (tok, S) => { // @1446.6
    ok(S.p.length - 1 >= 2, 0, 0.3, 'P + {a,b} 是 cycle；P 長度 = ' + (S.p.length - 1) + ' ≥ 2（{a,b} 原本不存在）✓'); cap('P 加上 {a,b} 就是 cycle', 'P 長度至少 2');
  },
  async (tok, S) => { // @1471.5
    S.q = bub("還要證只有這一個：假設還有另一個 cycle C'", 0, -0.35); cap('還要證只有這一個 cycle', "假設有另一個 C'");
  },
  async (tok, S) => { // @1515.5
    sm("原來 T 沒有 cycle → C' 一定含 {a,b}", 0, -0.95); cap("C' 是加了 {a,b} 才有的", '所以一定含 {a,b}');
  },
  async (tok, S) => { // @1606.0
    S.fake = dash([T9P.i, [-4.8, 2.0], [-4.8, 6.4], [-0.6, 6.4], T9P.c], TC.hot); bad("假想：C' 拿掉 {a,b} 剩 P'，P' ≠ P", -3.0, 6.0);
    cap("C' 拿掉 {a,b} 剩下 P'", "P' 在原來的 T 裡，而且 ≠ P");
  },
  async (tok, S) => { // @1679.2
    bad('T 裡 a、b 之間就有兩條 path → 跟唯一 path 矛盾 ✘', 0, -1.55); cap('a、b 之間兩條 path', '矛盾');
  },
  async (tok, S) => { // @1740.0
    gone(S.fake, S.q); const n1 = cycleSets(S.E2).length;
    let all = true, cnt = 0; for (let x = 0; x < T9V.length; x++) for (let y = x + 1; y < T9V.length; y++) { const u = T9V[x], v = T9V[y]; if (T9E.some(([p, q]) => (p === u && q === v) || (p === v && q === u))) continue; cnt++; if (cycleSets([...T9E, [u, v]]).length !== 1) all = false; }
    ok(n1 === 1 && all, 0, -2.15, '只有一個 cycle ✓（這棵 tree 的 ' + cnt + ' 條非邊逐一加上，每次都剛好 1 個 cycle）'); cap('所以只有一個 cycle', '');
  },
  async (tok, S) => { // @1857.1
    good('tree + 一條 edge = 剛好一個 cycle', 4.0, 1.6); cap('一個 tree 加一條 edge', '就製造唯一一個 cycle');
  },
]);

const TWO = { P: { p1: [-4.0, 5.2], p2: [-4.8, 4.0], p3: [-3.2, 4.0], p4: [-3.2, 2.8], q1: [3.4, 5.2], q2: [2.6, 4.0], q3: [4.2, 4.0] }, E: [['p1', 'p2'], ['p1', 'p3'], ['p3', 'p4'], ['q1', 'q2'], ['q1', 'q3']] };
scene('g8b-da1', '23C：(d) ⇒ (a)——只要證 connected', [
  async (tok, S) => { // @1882.0
    hd('最後：(d) ⇒ (a)', 0, 7.0); cap('最後一個', 'd 推到 a');
  },
  async (tok, S) => { // @1888.0
    pl('(d)：沒有 cycle，且加任何原本沒有的邊 → 剛好一個 cycle', 0, 6.2); cap('(d) 的假設', '');
  },
  async (tok, S) => { // @1905.6
    pl('已經沒有 cycle → 只要證 connected', 0, 5.4); cap('只要證 connected', '');
  },
  async (tok, S) => { // @1914.4
    bub('反證：假設不 connected，就會跟 (d) 矛盾', 0, 4.4); cap('反證', '假設不 connected');
  },
]);

// ════════ m7RjwmS8c7U（趙啟超 23D：(d)⇒(a)、rooted tree 與名詞、level、height） ════════
scene('g8b-da2', '23D：(d) ⇒ (a) 的證明', [
  async (tok, S) => { // @4.3
    hd('(d) ⇒ (a)：假設 T 不 connected → 至少兩個 component', 0, 7.0); cap('假設 T 不是 connected', '至少兩個 component');
  },
  async (tok, S) => { // @8.0
    S.g = mkGraph(0.85); await grow(tok, S.g, TWO.P, TWO.E, { names: {} }); note('示意', 0, 6.2);
    comps(Object.keys(TWO.P), TWO.E).forEach((c, k) => c.forEach((n) => S.g.vcol(n, [TC.a, TC.b][k])));
    sm('T1（V1, E1）', -4.0, 2.0); sm('T2（V2, E2）', 3.4, 2.0); cap('挑兩個 component', 'T1、T2');
  },
  async (tok, S) => { // @10.1
    S.g.vcol('p3', TC.a, HL); S.g.vcol('q2', TC.b, HL); cap('兩個 component 各挑一個端點', '');
  },
  async (tok, S) => { // @86.1
    pl('a', -3.2, 4.65); pl('b', 2.6, 4.65); cap('a 在 T1，b 在 T2', '');
  },
  async (tok, S) => { // @89.3
    sm('(d)：加任何原本沒有的邊 → 剛好一個 cycle', 0, 1.3); cap('(d) 說加任何邊', '都剛好產生一個 cycle');
  },
  async (tok, S) => { // @107.2
    S.g.e('p3', 'q2', TC.yel); S.g.ecol('p3', 'q2', TC.yel, true); cap('就加 {a,b} 這條', '');
  },
  async (tok, S) => { // @114.0
    const n = cycleSets([...TWO.E, ['p3', 'q2']]).length; S.n = n;
    pl('加上 {a,b} 後的 cycle 個數：' + n, 0, 0.7); cap('a、b 在不同 component', '加上去不會有 cycle');
  },
  async (tok, S) => { // @121.0
    sm('若有 cycle，一定含 {a,b} → 表示 a、b 原來就連在一起；但它們在不同 component', 0, 0.15); cap('有 cycle 就表示原來連在一起', '但它們不相連');
  },
  async (tok, S) => { // @203.0
    ok(S.n !== 1, 0, -0.45, '0 個 cycle ≠ 1 → 跟 (d) 的假設矛盾 ✓'); cap('跟 (d) 的假設矛盾', '');
  },
  async (tok, S) => { // @214.6
    good('所以不會有兩個 component → T connected', 0, -1.05); cap('只有一個 component', '所以 connected');
  },
  async (tok, S) => { // @298.0
    good('connected ＋（(d) 本來就）沒有 cycle → T 是 tree ✓', 0, -1.65); cap('又沒有 cycle', '所以 T 是 tree');
  },
  async (tok, S) => { // @360.2
    hot('(a) ⇒ (b) ⇒ (c) ⇒ (d) ⇒ (a)：四個敘述全部等價', 0, 6.3); cap('四部分都證完', '全部 equivalent');
  },
  async (tok, S) => { // @378.4
    sm('(b)(c)(d) 都可當定義；但我們的定義仍是 connected、沒有 cycle', 0, 5.7); cap('後三個都能當定義', '但定義還是用 connected 沒有 cycle');
  },
]);

const RT = { A: [0, 0], B: [-1.4, -1.2], C: [1.4, -1.2], D: [-2.1, -2.4], E: [-0.7, -2.4] };
const RTE = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E']];
scene('g8b-rooted', '23D：Rooted tree 的定義', [
  async (tok, S) => { // @420.3
    hd('Rooted tree：有一個端點特別，叫 root（根）', 0, 7.0); cap('rooted tree', '有一個 root');
  },
  async (tok, S) => { // @447.7
    sm('定義要先講 directed tree', 0, 6.4); cap('先定義 directed tree', '');
  },
  async (tok, S) => { // @471.3
    const Pm = shift(RT, -3.6, 5.6); const mixed = new Set(['B>A', 'A>C', 'D>B', 'B>E']);
    S.g1 = mkGraph(0.8);
    const order = Object.keys(Pm);
    for (const n of order) S.g1.v(n, Pm[n][0], Pm[n][1]);
    for (const [u, v] of RTE) { if (mixed.has(u + '>' + v)) S.g1.e(u, v, TC.edge, true); else S.g1.e(v, u, TC.edge, true); }
    ok(isTree(Object.keys(RT), RTE), -3.6, 2.4, '拿掉方向是 tree → directed tree ✓'); note('示意', -5.6, 6.0);
    cap('directed graph 拿掉方向後是 tree', '就叫 directed tree');
  },
  async (tok, S) => { // @517.1
    S.P2 = shift(RT, 3.4, 5.6); S.g2 = mkGraph(0.8); for (const n of Object.keys(S.P2)) S.g2.v(n, ...S.P2[n]); S.g2.vcol('A', TC.gold, HL);
    sm('A = root', 4.8, 5.6); cap('rooted tree：有一個端點是 root', '');
  },
  async (tok, S) => { // @534.6
    for (const [u, v] of RTE) S.g2.e(u, v, TC.green, true);
    pl('每條邊都 directed away from the root', 3.4, 2.4); cap('每條邊的方向', '都從 root 往外');
  },
  async (tok, S) => { // @571.0
    good('A 是 root、全部往外 → rooted tree', 3.4, 1.8); cap('例子：A 是 root', '所有方向都往外');
  },
  async (tok, S) => { // @606.0
    Object.values(S.g2.E).forEach((e) => { if (e.userData.cone) e.userData.cone.visible = false; });
    sm('方向都知道是往下 → 平常不畫箭頭', 3.4, 1.2); cap('平常畫 rooted tree', '不畫方向');
  },
  async (tok, S) => { // @675.0
    gone(S.g2); S.g2 = mkGraph(0.8); S.up = shift(Object.fromEntries(Object.entries(RT).map(([n, [x, y]]) => [n, [x, -y]])), 3.4, 1.4);
    for (const n of Object.keys(S.up)) S.g2.v(n, ...S.up[n], n === 'A' ? TC.gold : TC.node); for (const [u, v] of RTE) S.g2.e(u, v);
    sm('真的樹：根在下面、往上長', 5.6, 0.6); cap('跟平常的樹相反', '樹是根在下往上長');
  },
  async (tok, S) => { // @691.2
    const from = S.up, to = S.P2; const g = S.g2;
    await anim(tok, 1600, (u) => {
      for (const n of Object.keys(from)) { const x = from[n][0] + (to[n][0] - from[n][0]) * u, y = from[n][1] + (to[n][1] - from[n][1]) * u; g.V[n].position.set(x, y, 0); g.P[n] = [x, y]; }
      for (const [a, b] of RTE) { g.cut(a, b); g.e(a, b); }
    });
    sm('抓著 root 提起來，其他都垂下去', 3.4, 0.6); cap('抓著根提起來', '其他端點都垂到下面');
  },
]);

// 老師的例子：A root；B F G；C（B 下）、H I J（G 下）；D E（C 下）、K L N（H、J 下，掛法示意）
const AT = { A: null, B: 'A', F: 'A', G: 'A', C: 'B', H: 'G', I: 'G', J: 'G', D: 'C', E: 'C', K: 'H', L: 'J', N: 'J' };
const ATP = { A: [0, 6.3], B: [-3.6, 5.0], F: [-0.6, 5.0], G: [2.8, 5.0], C: [-3.6, 3.7], H: [1.4, 3.7], I: [2.8, 3.7], J: [4.2, 3.7], D: [-4.4, 2.4], E: [-2.8, 2.4], K: [1.4, 2.4], L: [3.6, 2.4], N: [4.8, 2.4] };
const ATK = kids(AT), ATL = levels(AT);
const anc = (v) => (AT[v] ? [AT[v], ...anc(AT[v])] : []);
const desc = (v) => ATK[v].flatMap((c) => [c, ...desc(c)]);
scene('g8b-terms', '23D：名詞——parent、child、sibling、ancestor、descendant、leaf', [
  async (tok, S) => { // @743.0
    hd('幾個名詞（像族譜，但沒有性別）', 0, 7.1);
    S.g = mkGraph(0.75); const order = Object.keys(AT).sort((x, y) => ATL[x] - ATL[y]);
    await grow(tok, S.g, ATP, parEdges(AT), { order }); note('K、L、N 掛法示意', -4.6, 6.4); cap('介紹幾個名詞', '');
  },
  async (tok, S) => { // @755.5
    S.g.vcol('A', TC.gold, HL); hot('root', 1.0, 6.6); cap('A 是 root', '只有一個，畫在最上面');
  },
  async (tok, S) => { // @770.0
    glow(S.g.V.A, null); S.g.ecol('B', 'C', TC.a, true); cap('C 在 B 的下面', '方向都往下');
  },
  async (tok, S) => { // @783.5
    S.g.vcol('B', TC.a); pl('B 是 C 的 parent', -5.0, 4.4); cap('B 是 C 的 parent', '父母，但沒有性別');
  },
  async (tok, S) => { // @801.6
    S.g.vcol('C', TC.b); pl('C 是 B 的 child', -5.0, 3.1); cap('C 是 B 的 child', '小孩');
  },
  async (tok, S) => { // @837.6
    const sib = ATK.G; sib.forEach((n) => S.g.vcol(n, TC.green));
    pl('siblings：' + sib.join(' ') + '（都是 G 的 child）', 3.0, 1.5); cap('同一個 parent 的', 'sibling 兄弟姐妹（手足）');
  },
  async (tok, S) => { // @888.2
    const an = anc('E'); S.g.vcol('E', TC.orange); an.forEach((n) => glow(S.g.V[n], HL));
    pl('E 的 ancestor（祖先）：' + an.join(' '), -3.0, 0.95); cap('上面的叫 ancestor', 'E 的祖先是 C、B、A');
  },
  async (tok, S) => { // @911.0
    an0(S); const ds = desc('B'); ds.forEach((n) => S.g.vcol(n, TC.purple));
    pl('B 的 descendant（後代）：' + ds.join(' '), -3.0, 0.4); cap('B 的後代 descendant', 'C、D、E');
  },
  async (tok, S) => { // @967.0
    Object.keys(AT).forEach((n) => { S.g.vcol(n, TC.node); glow(S.g.V[n], null); });
    S.leaves = Object.keys(AT).filter((n) => !ATK[n].length); S.leaves.forEach((n) => S.g.vcol(n, TC.green));
    ok(S.leaves.slice().sort().join('') === 'DEFIKLN', 2.4, 0.95, 'leaves（葉子）：' + S.leaves.join(' ') + ' ✓'); cap('端點分兩類', '一類叫葉子 leaves');
  },
  async (tok, S) => { // @1013.3
    sm('葉子 = 沒有 children 的端點', 2.4, 0.4); cap('沒有後代的叫葉子', '');
  },
  async (tok, S) => { // @1044.0
    const inn = Object.keys(AT).filter((n) => ATK[n].length); inn.forEach((n) => S.g.vcol(n, TC.orange));
    ok(inn.slice().sort().join('') === 'ABCGHJ', 0, -0.2, 'internal vertices：' + inn.join(' ') + '（含 root）✓'); cap('不是葉子的', '叫 internal vertices');
  },
  async (tok, S) => { // @1098.0
    const sub = ['G', ...desc('G')]; Object.keys(AT).forEach((n) => { if (!sub.includes(n)) S.g.vcol(n, TC.dim); });
    sub.forEach((n) => { S.g.V[n].position.y += 0.5; }); Object.keys(S.g.E).forEach((k) => { const [u, v] = k.split('|'); S.g.cut(u, v); });
    const Pn = Object.fromEntries(Object.keys(AT).map((n) => [n, [S.g.V[n].position.x, S.g.V[n].position.y]])); Object.assign(S.g.P, Pn);
    parEdges(AT).forEach(([u, v]) => S.g.e(u, v, sub.includes(u) && sub.includes(v) ? TC.gold : TC.dim));
    hot('以 G 為 root 的 subtree', 3.0, 6.3); cap('把 G 下面這塊拿起來', 'G 就是這個 subtree 的 root');
  },
]);
function an0(S) { Object.keys(AT).forEach((n) => { S.g.vcol(n, TC.node); glow(S.g.V[n], null); }); }

scene('g8b-level', '23D：Level 與 height', [
  async (tok, S) => { // @1160.2
    hd('Level 與 height', 0, 7.1); S.g = mkGraph(0.75); for (const n of Object.keys(AT)) S.g.v(n, ...ATP[n]); parEdges(AT).forEach(([u, v]) => S.g.e(u, v));
    S.g.vcol('A', TC.gold); seg(-6.0, 6.3, 6.0, 6.3, TC.dim, 0.02, -0.3); sm('level 0', -5.6, 6.6); cap('分 level', 'root 是 level 0');
  },
  async (tok, S) => { // @1175.1
    [1, 2, 3].forEach((l) => { const y = 6.3 - 1.3 * l; seg(-6.0, y, 6.0, y, TC.dim, 0.02, -0.3); sm('level ' + l, -5.6, y + 0.3); });
    cap('level 1、2、3', '依此類推');
  },
  async (tok, S) => { // @1178.0
    const byL = [1, 2, 3].map((l) => Object.keys(AT).filter((n) => ATL[n] === l));
    byL.forEach((ns, k) => ns.forEach((n) => S.g.vcol(n, [TC.a, TC.green, TC.purple][k])));
    ok(byL.map((x) => x.join('')).join(',') === 'BFG,CHIJ,DEKLN', 0, 1.4, 'level 1：' + byL[0].join(' ') + '　level 2：' + byL[1].join(' ') + '　level 3：' + byL[2].join(' ') + ' ✓');
    cap('B F G 在 level 1', 'C H I J 在 level 2；D E K L N 在 level 3');
  },
  async (tok, S) => { // @1187.0
    const path = [...anc('K').reverse(), 'K'];
    path.slice(0, -1).forEach((n, k) => S.g.ecol(n, path[k + 1], TC.hot, true));
    pl('level = root 到它的唯一 path 的邊數：K 是 ' + ATL.K + '（' + path.join('–') + '）', 0, 0.8); cap('level 怎麼定義', 'root 到它唯一 path 的邊數');
  },
  async (tok, S) => { // @1212.9
    const h = Math.max(...Object.values(ATL)); good('height = 最大的 level = ' + h, 0, 0.2); cap('tree 的高度 height', '最大 level，這裡是 3');
  },
  async (tok, S) => { // @1268.4
    sm('名詞來源：樹（leaf）＋族譜（parent、child、sibling、ancestor、descendant）', 0, -0.4); cap('都只是名詞', '有的來自樹，有的來自族譜');
  },
]);

// ════════ FxZGkU0MvfY（趙啟超 24A：m-ary tree、complete、n = mi + 1、balanced、l ≤ mʰ） ════════
const BT = { r: null, x: 'r', y: 'r', x1: 'x', x2: 'x', y1: 'y', y2: 'y', y11: 'y1', y12: 'y1' };
const BTP = { r: [0, 6.2], x: [-2.4, 5.0], y: [2.4, 5.0], x1: [-3.4, 3.8], x2: [-1.4, 3.8], y1: [1.4, 3.8], y2: [3.4, 3.8], y11: [0.8, 2.6], y12: [2.0, 2.6] };
const BTK = kids(BT), BTL = levels(BT);
const BTn = Object.keys(BT).length, BTi = Object.keys(BT).filter((v) => BTK[v].length).length, BTl = BTn - BTi, BTh = Math.max(...Object.values(BTL));
const BTnames = Object.fromEntries(Object.keys(BT).map((n) => [n, '']));
scene('g8b-recap', '24A：複習 rooted tree', [
  async (tok, S) => { // @4.3
    hd('複習：rooted tree 有一個特別的 vertex 叫 root', 0, 7.0); cap('上次講到 rooted tree', '');
  },
  async (tok, S) => { // @15.7
    S.g = mkGraph(0.75); await grow(tok, S.g, BTP, parEdges(BT), { names: BTnames }); S.g.vcol('r', TC.gold); note('示意', 4.6, 6.2);
    cap('root 畫在上面', '其他 vertex 往下畫');
  },
  async (tok, S) => { // @29.3
    pl('今天：m-ary tree，還有幾個數量之間的關係', 0, 1.4); cap('今天看 m-ary tree', '和數量之間的關係');
  },
]);

scene('g8b-mary', '24A：m-ary tree 與 complete m-ary tree', [
  async (tok, S) => { // @39.0
    hd('m-ary tree', 0, 7.0); cap('m-ary tree', '');
  },
  async (tok, S) => { // @61.2
    pl('每個 internal vertex 的 children 最多 m 個', 0, 6.4); cap('每個 internal vertex', 'children 不超過 m 個');
  },
  async (tok, S) => { // @69.3
    S.g = mkGraph(0.75); await grow(tok, S.g, BTP, parEdges(BT), { names: BTnames }); note('示意', 4.6, 6.2);
    Object.keys(BT).forEach((n) => S.g.vcol(n, BTK[n].length ? TC.orange : TC.green));
    sm('橘：internal vertex（有 children）　綠：leaf（沒有 children）', 0, 1.9); cap('vertex 分兩種', 'internal 和 leaf');
  },
  async (tok, S) => { // @104.7
    pl('complete m-ary tree：每個 internal vertex 剛好 m 個 children', 0, 1.3); cap('complete m-ary tree', '有 children 就剛好 m 個');
  },
  async (tok, S) => { // @133.2
    sm('m = 2：binary tree', -4.0, 0.7); cap('m = 2', 'binary tree');
  },
  async (tok, S) => { // @154.5
    sm('m = 3：ternary tree', 0, 0.7); cap('m = 3', 'ternary tree');
  },
  async (tok, S) => { // @176.1
    sm('m = 4：quaternary tree', 4.0, 0.7); cap('m = 4', 'quaternary tree');
  },
  async (tok, S) => { // @208.3
    hot('例：complete binary tree', 0, 0.1); cap('看一個 complete binary tree', '');
  },
  async (tok, S) => { // @242.0
    const inn = Object.keys(BT).filter((n) => BTK[n].length); inn.forEach((n) => glow(S.g.V[n], HL));
    ok(inn.every((n) => BTK[n].length === 2), 0, -0.5, '每個 internal vertex 都剛好 2 個 children ✓'); cap('每個 internal vertex', '都剛好兩個 children');
  },
  async (tok, S) => { // @261.0
    sm('很多應用都可以化成 binary tree', 0, -1.1); cap('很多應用', '都能化成 binary tree');
  },
]);

scene('g8b-count', '24A：complete m-ary tree：n = mi + 1、l = (m − 1)i + 1', [
  async (tok, S) => { // @291.0
    hd('complete m-ary tree：n 個 vertices、l 個 leaves、i 個 internal vertices', 0, 7.0);
    S.g = mkGraph(0.7); for (const n of Object.keys(BT)) S.g.v(n, BTP[n][0] - 2.2, BTP[n][1] - 0.2, BTK[n].length ? TC.orange : TC.green, ''); parEdges(BT).forEach(([u, v]) => S.g.e(u, v));
    note('示意：m = 2', -5.4, 6.2); pl('n = ' + BTn + '　l = ' + BTl + '　i = ' + BTi, 4.3, 5.6); cap('complete m-ary tree', 'n、l、i 三個數');
  },
  async (tok, S) => { // @308.8
    sm('vertex 不是 leaf 就是 internal：n = l + i', 4.3, 5.0); cap('四個數 m、n、l、i', '中間有關係');
  },
  async (tok, S) => { // @335.1
    ['① n = mi + 1', '② l = (m − 1)i + 1', '③ i = (l − 1)/(m − 1) = (n − 1)/m'].forEach((t, k) => pl(t, 4.3, 4.2 - k * 0.6)); cap('三個關係式', '');
  },
  async (tok, S) => { // @380.0
    sm('只要懂 ①，② ③ 都推得出來', 4.3, 2.2); cap('主要是第一式', '其他推得出來');
  },
  async (tok, S) => { // @397.6
    pl('除了 root，每個 vertex 都是某個 internal vertex 的 child', 0, 1.3); S.g.vcol('r', TC.gold, HL); cap('除了 root 以外', '每個 vertex 都是某個 internal vertex 的 child');
  },
  async (tok, S) => { // @448.3
    const inn = Object.keys(BT).filter((n) => BTK[n].length); const col = [TC.a, TC.b, TC.purple, TC.teal];
    inn.forEach((p, k) => BTK[p].forEach((c) => { S.g.ecol(p, c, col[k], true); }));
    sm('同色的邊：同一個 parent 的 children', 0, 0.75); cap('這是它的 child、這是它的 child…', '');
  },
  async (tok, S) => { // @489.3
    sm('complete：每個 internal vertex 剛好 m 個 children', 0, 0.25); cap('complete 的定義', '每個 internal 剛好 m 個 children');
  },
  async (tok, S) => { // @531.7
    pl('i 個 internal × 每個 m 個 children = mi', 0, -0.3); cap('i 個 internal vertex', '乘上 m');
  },
  async (tok, S) => { // @550.4
    ok(2 * BTi === BTn - 1, 0, -0.85, 'mi 數到 root 以外的全部 vertex、不重複（parent 唯一）：2 × ' + BTi + ' = ' + (2 * BTi) + ' = n − 1 ✓'); cap('mi 數到 root 以外全部', '每個 parent 唯一，不重複');
  },
  async (tok, S) => { // @606.5
    good('再加 root：n = mi + 1', 0, -1.4); cap('加上 root', 'n = mi + 1');
  },
  async (tok, S) => { // @668.0
    sm('要 complete 才成立（不 complete 時 children 不一定剛好 m 個）', 0, -1.95); cap('要 complete 才成立', '');
  },
  async (tok, S) => { // @689.3
    ok(BTl === (2 - 1) * BTi + 1, 4.3, 1.6, '② l = n − i = (m − 1)i + 1：' + BTl + ' = ' + BTi + ' + 1 ✓'); cap('第二式', 'l = n − i，再代入 n = mi + 1');
  },
  async (tok, S) => { // @745.0
    ok(BTi === (BTl - 1) / (2 - 1) && BTi === (BTn - 1) / 2, 4.3, 1.0, '③ 從 ①② 解 i：' + BTi + ' = ' + (BTl - 1) + '/1 = ' + (BTn - 1) + '/2 ✓'); cap('第三式', '用一、二解出 i');
  },
  async (tok, S) => { // @784.5
    let cnt = 0, bad0 = 0;
    for (const m of [2, 3]) for (let i = 0; i <= (m === 2 ? 5 : 4); i++) for (const t of complete(m, i)) { cnt++; const n = tN(t), l = tL(t), ii = tI(t); if (n !== m * ii + 1 || l !== (m - 1) * ii + 1 || ii !== i) bad0++; }
    ok(bad0 === 0, 0, -2.5, '電腦列出 m = 2、3 的 ' + cnt + ' 棵小 complete tree，三式全對 ✓'); cap('理解第一式就夠', '不要硬背');
  },
]);

const UB = { r: null, L: 'r', u: 'r', u1: 'u', u2: 'u', a: 'u1', b: 'u1', c: 'u2', d: 'u2' };
const UBP = { r: [0, 0], L: [-1.2, -1.1], u: [1.2, -1.1], u1: [0.5, -2.2], u2: [1.9, -2.2], a: [0.1, -3.3], b: [0.9, -3.3], c: [1.5, -3.3], d: [2.3, -3.3] };
function lvTree(par) { const L = levels(par), K2 = kids(par); const h = Math.max(...Object.values(L)); const lv = Object.keys(par).filter((n) => !K2[n].length).map((n) => L[n]); return { h, lv, bal: lv.every((x) => x === h || x === h - 1) }; }
scene('g8b-balance', '24A：Balanced——葉子的 level 是 h 或 h − 1', [
  async (tok, S) => { // @833.3
    hd('Balanced（跟 height 有關）', 0, 7.0); cap('另一個名詞：balanced', '跟 height 有關');
  },
  async (tok, S) => { // @864.2
    S.g = mkGraph(0.7); const Pm = shift(BTP, -2.6, 0.2, 0.8); for (const n of Object.keys(BT)) S.g.v(n, ...Pm[n], TC.node, ''); parEdges(BT).forEach(([u, v]) => S.g.e(u, v));
    [0, 1, 2, 3].forEach((l) => sm('level ' + l, -6.0, 6.2 * 0.8 + 0.2 - l * 0.96));
    pl('height = ' + BTh, -2.6, 1.6); cap('分 level 0、1、2、3', 'height 是 3');
  },
  async (tok, S) => { // @891.6
    pl('balanced：每個 leaf 的 level 都是 h 或 h − 1', 0, 6.4); cap('balanced', '每個葉子的 level 是 h 或 h − 1');
  },
  async (tok, S) => { // @900.0
    const r = lvTree(BT); Object.keys(BT).forEach((n) => { if (!BTK[n].length) S.g.vcol(n, BTL[n] === 2 ? TC.a : TC.purple); });
    const c2 = r.lv.filter((x) => x === 2).length, c3 = r.lv.filter((x) => x === 3).length;
    ok(r.bal, -2.6, 1.0, r.lv.length + ' 個 leaves：' + c2 + ' 個 level 2、' + c3 + ' 個 level 3 → balanced ✓'); cap('這個例子 5 個葉子', 'level 不是 2 就是 3：balanced');
  },
  async (tok, S) => { // @927.1
    const g = mkGraph(0.7); const Pm = shift(UBP, 3.4, 5.9); for (const n of Object.keys(UB)) g.v(n, ...Pm[n], TC.node, ''); parEdges(UB).forEach(([u, v]) => g.e(u, v));
    const r = lvTree(UB); const UK = kids(UB), UL = levels(UB); Object.keys(UB).forEach((n) => { if (!UK[n].length) g.vcol(n, UL[n] === 1 ? TC.hot : TC.purple); });
    ok(!r.bal, 3.4, 1.6, '一個葉子在 level 1、其他在 level 3（h = ' + r.h + '）→ 不 balanced ✓'); cap('像這樣', '一個葉子在 level 1：不 balanced');
  },
]);

scene('g8b-bound', '24A：l ≤ mʰ、h ≥ ⌈log_m l⌉；ceiling 與 floor', [
  async (tok, S) => { // @960.7
    hd('m-ary tree，height h，l 個 leaves', 0, 7.0); hot('l ≤ mʰ', -2.4, 6.2); cap('height 跟葉子數的關係', 'l ≤ mʰ');
  },
  async (tok, S) => { // @986.0
    hot('兩邊取 log_m → h ≥ ⌈log_m l⌉', 2.2, 6.2); cap('兩邊取以 m 為底的 log', 'h ≥ ⌈log_m l⌉');
  },
  async (tok, S) => { // @1001.7
    pl('⌈x⌉（ceiling，天花板）：大於等於 x 的最小整數', 0, 5.2); cap('ceiling 符號', '大於等於 x 的最小整數');
  },
  async (tok, S) => { // @1043.2
    ok(Math.ceil(3.5) === 4 && Math.ceil(4) === 4, 0, 4.5, '⌈3.5⌉ = ' + Math.ceil(3.5) + '　⌈4⌉ = ' + Math.ceil(4) + ' ✓');
    S.nl = [3, 3.5, 4, 5].map((v, k) => cube(String(v), v === 3.5 ? TC.yel : '#e9dcc4', [0.6, 0.45, 0.4], -3 + k * 2, 3.3, 0, 0.5)); cap('3.5 取 ceiling 是 4', '4 還是 4');
  },
  async (tok, S) => { // @1057.0
    pl('⌊x⌋（floor，地板）：小於等於 x 的最大整數', 0, 2.4); cap('相對的 floor', '小於等於 x 的最大整數');
  },
  async (tok, S) => { // @1091.5
    ok(Math.floor(3.5) === 3 && Math.floor(4) === 4, 0, 1.7, '⌊3.5⌋ = ' + Math.floor(3.5) + '　⌊4⌋ = ' + Math.floor(4) + ' ✓'); cap('3.5 取 floor 是 3', '4 還是 4');
  },
  async (tok, S) => { // @1128.2
    let cnt = 0, bad0 = 0;
    for (const m of [2, 3]) for (let i = 0; i <= (m === 2 ? 5 : 4); i++) for (const t of complete(m, i)) { cnt++; const l = tL(t), h = tH(t); if (l > m ** h || h < ceilLog(m, l)) bad0++; }
    ok(bad0 === 0, 0, 0.7, '直觀：長滿也只有 mʰ 個葉子（' + cnt + ' 棵小 tree 檢查 ✓）'); cap('height h 的 m-ary tree', '長滿也只有 mʰ 個葉子');
  },
]);

scene('g8b-boundind', '24A：對 height 做歸納法證 l ≤ mʰ', [
  async (tok, S) => { // @1138.2
    hd('證明 l ≤ mʰ：對 height h 做數學歸納法', 0, 7.0); cap('寫下證明', '對 height 做 induction');
  },
  async (tok, S) => { // @1166.3
    const g = mkGraph(0.6); g.v('r', -4.6, 6.0, TC.gold, ''); [-5.6, -4.6, -3.6].forEach((x, k) => { g.v('c' + k, x, 5.0, TC.green, ''); g.e('r', 'c' + k); });
    sm('h = 1：葉子都是 root 的 children → l ≤ m = m¹', -4.6, 4.3); note('示意 m = 3', -4.6, 6.6); cap('basis：h = 1', '葉子最多 m 個');
  },
  async (tok, S) => { // @1220.0
    pl('hypothesis：height < h 的 m-ary tree 都有 l ≤ m^(高度)', 2.0, 6.2); cap('induction hypothesis', 'height 小於 h 都成立');
  },
  async (tok, S) => { // @1267.0
    S.g = mkGraph(0.7); S.g.v('R', 1.6, 5.3, TC.gold, 'root'); [-0.8, 1.6, 4.0].forEach((x, k) => { S.g.v('s' + k, x, 4.3, TC.a, ''); S.g.e('R', 's' + k); });
    cap('看 level 1 的 vertices', '');
  },
  async (tok, S) => { // @1296.0
    S.tr = [-0.8, 1.6, 4.0].map((x, k) => tri(x, 4.05, 2.0, 2.2, [TC.a, TC.b, TC.green][k], 'T' + (k + 1))); cap('以它們為 root 的 subtree', '');
  },
  async (tok, S) => { // @1343.2
    sm('m-ary：root 最多 m 個 children → 最多 m 個 subtree', 1.6, 1.4); cap('最多 m 個 subtree', '');
  },
  async (tok, S) => { // @1378.0
    sm('每個 subtree 少了 root 那一層 → height ≤ h − 1', 1.6, 0.85); cap('每個 subtree 的 height', '不超過 h − 1');
  },
  async (tok, S) => { // @1408.2
    S.tr.forEach((t) => txt(t.userData.lbl, '≤ m^(h−1)')); pl('hypothesis → 每個 subtree 葉子 ≤ m^(h−1)', 1.6, 0.25); cap('用 hypothesis', '每個 subtree 葉子 ≤ m^(h−1)');
  },
  async (tok, S) => { // @1445.4
    hot('全部葉子 ≤ m · m^(h−1) = mʰ', 1.6, -0.4); cap('全部葉子加起來', '≤ m · m^(h−1) = mʰ');
  },
  async (tok, S) => { // @1498.5
    good('by induction 證完 ✓', 1.6, -1.0); cap('由數學歸納法', '證完');
  },
]);

const SK = { r: null, l1: 'r', v1: 'r', l2: 'v1', v2: 'v1', l3: 'v2', v3: 'v2', l4: 'v3', l5: 'v3' };
const SKP = { r: [0, 6.0], l1: [-0.8, 5.1], v1: [0.8, 5.1], l2: [0, 4.2], v2: [1.6, 4.2], l3: [0.8, 3.3], v3: [2.4, 3.3], l4: [1.6, 2.4], l5: [3.2, 2.4] };
scene('g8b-lower', '24A：h ≥ ⌈log_m l⌉ 只是 lower bound', [
  async (tok, S) => { // @1527.0
    hd('l ≤ mʰ：直觀上，長滿才有 mʰ 個葉子', 0, 7.0); cap('第一部分證完', '長滿就是 mʰ');
  },
  async (tok, S) => { // @1558.5
    pl('兩邊取 log_m（log 遞增，不等式方向不變）：log_m l ≤ h', 0, 6.3); cap('兩邊取 log', 'log 是遞增函數');
  },
  async (tok, S) => { // @1590.5
    pl('h 是整數 → h ≥ ⌈log_m l⌉', 0, 5.7); cap('h 是整數', '所以取 ceiling');
  },
  async (tok, S) => { // @1642.0
    const g = mkGraph(0.7); const Pm = shift(SKP, -1.2, -0.6); for (const n of Object.keys(SK)) g.v(n, ...Pm[n], kids(SK)[n].length ? TC.orange : TC.green, ''); parEdges(SK).forEach(([u, v]) => g.e(u, v));
    const L = levels(SK), h = Math.max(...Object.values(L)), l = Object.keys(SK).filter((n) => !kids(SK)[n].length).length;
    ok(h > ceilLog(2, l), 3.4, 3.0, 'binary、l = ' + l + '：⌈log₂ ' + l + '⌉ = ' + ceilLog(2, l) + '，但 h = ' + h + ' ✓');
    sm('不 balanced：一邊拉很長，h 比 lower bound 大', 3.4, 2.4); note('示意', -3.6, 5.6); cap('這只是 lower bound', '不 balanced 時 h 可能更大');
  },
]);

// ════════ gF8PA6FVLp0（趙啟超 24B：balanced + complete ⇒ h = ⌈log_m l⌉；tree traversal） ════════
scene('g8b-exact', '24B：balanced 且 complete → h = ⌈log_m l⌉', [
  async (tok, S) => { // @4.6
    hd('再加條件：balanced 且 complete', 0, 7.0); cap('balanced 跟 complete', '兩個條件都加上去');
  },
  async (tok, S) => { // @43.0
    S.g = mkGraph(0.7); const Pm = shift(BTP, -2.6, 0.2, 0.8); S.Pm = Pm;
    for (const n of Object.keys(BT)) S.g.v(n, ...Pm[n], BTK[n].length ? TC.orange : TC.green, ''); parEdges(BT).forEach(([u, v]) => S.g.e(u, v)); note('示意 m = 2', -5.6, 5.4);
    sm('complete：internal 都剛好 m 個；balanced：葉子在 h 或 h − 1', 0, 6.4); cap('complete 和 balanced', '');
  },
  async (tok, S) => { // @54.5
    hot('height 剛好等於 lower bound：h = ⌈log_m l⌉', 2.4, 5.6); cap('height 剛好等於 lower bound', '');
  },
  async (tok, S) => { // @120.3
    Object.keys(BT).filter((n) => BTL[n] === BTh).forEach((n) => S.g.vcol(n, TC.purple, HL));
    pl('height = h → 至少一個葉子在 level h', 2.4, 4.8); cap('height 是 h', '至少一個葉子在 level h');
  },
  async (tok, S) => { // @196.1
    sm('level h − 1 不一定有葉子（全部在 h 也算 balanced）', 2.4, 4.2); cap('level h − 1', '不見得有葉子');
  },
  async (tok, S) => { // @245.5
    const at = Object.keys(BT).filter((n) => BTL[n] === BTh - 1).length;
    ok(at === 2 ** (BTh - 1) && BTl > 2 ** (BTh - 1), 2.4, 3.5, 'complete：level h − 1 是滿的（' + at + ' = 2^' + (BTh - 1) + '），再多一層 → l > m^(h−1)：' + BTl + ' > ' + 2 ** (BTh - 1) + ' ✓');
    cap('level h − 1 以上都長滿', '所以 l > m^(h−1)');
  },
  async (tok, S) => { // @309.0
    ok(BTl <= 2 ** BTh, 2.4, 2.9, 'height h → l ≤ mʰ：' + BTl + ' ≤ ' + 2 ** BTh + ' ✓'); cap('height 是 h', 'l ≤ mʰ');
  },
  async (tok, S) => { // @350.0
    pl('取 log_m：h − 1 < log_m l ≤ h', 2.4, 2.3); cap('兩邊取 log', 'h − 1 < log_m l ≤ h');
  },
  async (tok, S) => { // @384.0
    ok(ceilLog(2, BTl) === BTh, 2.4, 1.6, 'h = ⌈log_m l⌉：⌈log₂ ' + BTl + '⌉ = ' + ceilLog(2, BTl) + ' = h ✓（例：算出 3.5 → h = 4；算出 4 → h = 4）'); cap('所以 h 就是取 ceiling', '3.5 → 4，4 → 4');
  },
  async (tok, S) => { // @451.4
    let cnt = 0, bad0 = 0, unb = 0;
    for (const m of [2, 3]) for (let i = 0; i <= (m === 2 ? 6 : 4); i++) for (const t of complete(m, i)) { if (tBal(t)) { cnt++; if (tH(t) !== ceilLog(m, tL(t))) bad0++; } else if (tH(t) !== ceilLog(m, tL(t))) unb++; }
    ok(bad0 === 0 && unb > 0, 0, 0.6, 'complete + balanced 的 ' + cnt + ' 棵小 tree 全部 h = ⌈log_m l⌉ ✓；少了 balanced 就有反例（' + unb + ' 棵）');
    cap('balanced 和 complete', '兩個都要用到');
  },
  async (tok, S) => { // @534.8
    sm('應用：decision tree 常是 binary tree；height = 最多要做幾次 decision', 0, -0.1); cap('例如 decision tree', 'height 就是最多做幾次決定');
  },
]);

const TRI = (S, xs, ys, labs) => labs.map((t, k) => tri(xs[k], ys, 1.7, 2.0, [TC.a, TC.b, TC.green, TC.purple][k % 4], t));
scene('g8b-travdef', '24B：Tree traversal——preorder、postorder、inorder', [
  async (tok, S) => { // @555.2
    hd('rooted tree：要把每個 vertex 都 visit 一次', 0, 7.0); cap('要 visit 每一個 vertex', '有系統地走過');
  },
  async (tok, S) => { // @573.1
    hot('tree traversal（traverse 的名詞）', 0, 6.4); cap('這叫 tree traversal', '');
  },
  async (tok, S) => { // @606.1
    sm('用途：每個都走到，算某個量、找最大或最小', 0, 5.8); cap('為什麼要走過每個點', '算量、找最大最小');
  },
  async (tok, S) => { // @670.5
    const g = mkGraph(0.8); g.v('r', 0, 5.0, TC.gold, 'r'); S.g = g;
    const xs = [-3.6, -1.2, 1.2, 3.6]; xs.forEach((x, k) => { g.v('t' + k, x, 4.0, TC.node, ''); g.e('r', 't' + k); });
    S.tr = TRI(S, xs, 3.8, ['T1', 'T2', '⋯', 'Tm']); cap('root 是 r', '下面有 subtree T1 到 Tm');
  },
  async (tok, S) => { // @701.8
    pl('三種的差別：什麼時候 visit root', 0, 1.3); cap('三種方法', '差在什麼時候 visit root');
  },
  async (tok, S) => { // @726.1
    S.l1 = pl('preorder：先 visit r', 0, 0.7); S.g.vcol('r', TC.hot, HL); cap('preorder', '一開始就 visit root');
  },
  async (tok, S) => { // @745.1
    txt(S.l1, 'preorder：r → T1 → T2 → ⋯ → Tm（每個 subtree 再用 preorder，遞迴）'); cap('再用 preorder 走 T1、T2…', '自己叫自己（遞迴）');
  },
  async (tok, S) => { // @832.8
    pl('postorder：T1 → T2 → ⋯ → Tm → r（root 最後）', 0, 0.1); cap('postorder', 'root 放最後');
  },
  async (tok, S) => { // @934.0
    S.l3 = pl('inorder：root 放中間', 0, -0.5); cap('inorder', 'root 在中間');
  },
  async (tok, S) => { // @957.8
    txt(S.l3, 'inorder（binary）：左 subtree → r → 右 subtree'); cap('binary tree', '左、root、右');
  },
  async (tok, S) => { // @1014.0
    sm('一般 m-ary：T1 → r → T2 → ⋯ → Tm（root 放第二個）', 0, -1.1); cap('不只兩個 subtree 時', 'root 放在第二個');
  },
]);

// 老師的例子（Grimaldi 的 binary tree）：r(a,b) a(c,d) c(f,g) f(j,–) j(p,q) g(k,–) b(–,e) e(h,i) h(–,m) m(s,–) i(–,n) n(t,u)
const TV = { r: ['a', 'b'], a: ['c', 'd'], c: ['f', 'g'], f: ['j', null], j: ['p', 'q'], g: ['k', null], b: [null, 'e'], e: ['h', 'i'], h: [null, 'm'], m: ['s', null], i: [null, 'n'], n: ['t', 'u'] };
const ch = (v) => TV[v] || [null, null];
const pre = (v) => (v ? [v, ...pre(ch(v)[0]), ...pre(ch(v)[1])] : []);
const post = (v) => (v ? [...post(ch(v)[0]), ...post(ch(v)[1]), v] : []);
const ino = (v) => (v ? [...ino(ch(v)[0]), v, ...ino(ch(v)[1])] : []);
const TVlv = {}; (function lv(v, d) { if (!v) return; TVlv[v] = d; lv(ch(v)[0], d + 1); lv(ch(v)[1], d + 1); })('r', 0);
const TVP = Object.fromEntries(ino('r').map((v, k) => [v, [(k - 9) * 0.6, 6.5 - TVlv[v] * 0.95]]));
const TVE = Object.entries(TV).flatMap(([p, cs]) => cs.filter(Boolean).map((c) => [p, c]));
const LECT = { pre: 'racfjpqgkdbehmsintu', post: 'pqjfkgcdasmhtunieb' + 'r', in: 'pjqfckgadrbhsmeitnu' };
function travScene(id, title, kind, head, seq) {
  // seq: list of step kinds: 'draw' | 'title' | 'say:<text>' | array of vertices to visit | 'final'
  const order = kind === 'pre' ? pre('r') : kind === 'post' ? post('r') : ino('r');
  scene(id, title, seq.map((s) => async (tok, S) => {
    if (!S.g) {
      S.g = mkGraph(0.62); for (const n of Object.keys(TVP)) S.g.v(n, ...TVP[n]); TVE.forEach(([u, v]) => S.g.e(u, v)); S.k = 0; S.row = [];
      hd(head, 0, 7.2);
    }
    if (s === 'draw' || s === 'title') { if (s === 'title') { S.t = sm(kind === 'pre' ? 'root → 左 subtree → 右 subtree' : kind === 'post' ? '左 subtree → 右 subtree → root' : '左 subtree → root → 右 subtree', -3.6, 6.5); } cap(head, s === 'draw' ? '老師的例子' : ''); return; }
    if (typeof s === 'string' && s.startsWith('say:')) { if (S.say) gone(S.say); S.say = sm(s.slice(4), 0, 0.2); cap(s.slice(4), ''); return; }
    if (s === 'final') {
      const got = order.join('');
      ok(got === LECT[kind], 0, -0.5, (kind === 'pre' ? 'preorder' : kind === 'post' ? 'postorder' : 'inorder') + '：' + order.join(' ') + '（跟老師的順序一樣 ✓）'); cap('全部走完', ''); return;
    }
    for (const v of s) {
      const want = order[S.k];
      S.g.vcol(want, TC.hot, HL); const n = S.k + 1; S.k++;
      const l = lab.label(String(n), 'idx'); l.position.set(0.56, 0.05, 0); S.g.V[want].add(l);
      S.row.push(cube(want, TC.yel, [0.5, 0.45, 0.4], -5.4 + (n - 1) * 0.6, 0.95, 0, 0.4));
      await wt(tok, 120); S.g.vcol(want, TC.gold, null);
      if (want !== v) bad('（預期 ' + v + '）', 0, 0.3);
    }
    cap('visit ' + s.join('、'), '');
  }));
}
travScene('g8b-pre', '24B：Preorder 例子', 'pre', 'Preorder traversal', ['draw', 'title', ['r'], ['a'], ['c'], ['f'], ['j'], ['p'], ['q'], ['g'], ['k'], ['d'], ['b'], ['e'], ['h'], ['m'], ['s'], ['i', 'n', 't', 'u'], 'final']);
travScene('g8b-post', '24B：Postorder 例子', 'post', 'Postorder traversal', ['title', 'say:先處理左邊的 subtree，一路往左下走', ['p'], ['q'], ['j'], ['f'], ['k'], ['g', 'c', 'd', 'a'], 'say:左邊做完；root 最後，先處理右邊的 subtree', ['s', 'm', 'h'], ['t'], ['u', 'n', 'i', 'e', 'b', 'r'], 'final']);
travScene('g8b-in', '24B：Inorder 例子', 'in', 'Inorder traversal', ['title', 'say:先處理左邊的左邊的左邊…', ['p'], ['j', 'q'], ['f', 'c'], ['k', 'g'], ['a', 'd'], ['r'], ['b'], ['h'], ['s', 'm'], ['e'], ['i', 't', 'n', 'u'], 'final']);

scene('g8b-travsum', '24B：整理三種 traversal', [
  async (tok, S) => { // @1540.1
    hd('自己用三種方法各跑一次這個例子', 0, 7.0);
    [['preorder', pre('r')], ['postorder', post('r')], ['inorder', ino('r')]].forEach(([n, o], k) => pl(n + '：' + o.join(' '), 0, 5.8 - k * 0.8));
    cap('自己各跑一次', 'pre、post、in');
  },
  async (tok, S) => { // @1571.0
    good('三種的差別只在：什麼時候 visit root（前、後、中間）', 0, 3.0); cap('三種 traversal', '看 root 相對 subtree 的順序');
  },
]);
  }

  // ═══ g8c.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第25A–26B講：Trees 續）— cued scenes ───
// expression tree 與 Polish notation（preorder、從右到左計算）、spanning tree 定義、DFS／BFS 虛擬碼與例子（A–J）、
// BFS 的應用與 Erdős number、merge sort（splitting／merging tree、虛擬碼、最多比較次數 n log n）、
// shortest path problem（path weight、principle of optimality）。
// 每個 scene 是一串 step；每一步等老師講到那一句（notes 的 cues）才動一下，不重播、不循環。
// 老師的例子照用（t + uv/(w + x − y↑z)、t=4 u=2 v=3 w=1 x=9 y=2 z=3、A–J 圖、6 2 7 3 4 9 5 1 8、ADCBF = 22）；
// 畫面上的走訪順序、計算結果、比較次數都由程式算（✓／✘ 比對老師說的）；投影片上看不到、自己補的一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const gone = (...os) => os.forEach((o) => {
  if (!o) return; if (Array.isArray(o)) return gone(...o);
  if (typeof o.all === 'function') return gone(o.all());
  if (o.element) remove(o); else kill(o);
});
const GC = { v: '#cdbfa6', e: '#9c8b70', tree: '#c08a1f', in: '#2fc092', dim: '#e6ddcd', hot: '#d64545', blue: '#4b9ee2', pink: '#e55a9b', purple: '#9b7ef4', orange: '#dd8238', op: '#f6d3b8', num: '#cfe6f7', leaf: '#d2f1e6', sand: '#e9dcc4' };
const HL = '#6a4a00';
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const paint = (m, c) => { if (m && m.material) m.material.color.set(c); };
// a thick edge between two points (a cylinder, so it can be recoloured / thickened)
function bar(x1, y1, x2, y2, c = GC.e, r = 0.045) {
  const a = V3(x1, y1, -0.1), b = V3(x2, y2, -0.1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, a.distanceTo(b)), 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  lab.world.add(m); return m;
}
// ── a rooted tree drawn node by node (each node knows its parent) ──
function mkTree() {
  const t = { N: {}, P: {}, E: {}, list: [] };
  t.add = (id, label, x, y, par, c = GC.sand, w) => {
    t.P[id] = [x, y];
    const m = cube(label, c, [w || Math.max(0.62, 0.28 + String(label).length * 0.2), 0.56, 0.4], x, y, 0, 0.5);
    t.N[id] = m; t.list.push(m);
    if (par) { const [px, py] = t.P[par]; t.E[id] = bar(px, py - 0.28, x, y + 0.28, GC.e, 0.04); t.list.push(t.E[id]); }
    return m;
  };
  t.all = () => t.list;
  return t;
}
// ── a graph on the board: vertices (cubes) and edges (bars), optional weights ──
function mkGraph(pos, opt = {}) {
  const g = { V: {}, E: {}, W: {}, list: [], pos };
  const k = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  g.k = k;
  g.v = (v, c) => { const [x, y] = pos[v]; const m = cube(v, c || GC.v, [opt.vs || 0.62, 0.56, 0.4], x, y, 0, 0); g.V[v] = m; g.list.push(m); return m; };
  g.e = (a, b, w, c) => {
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const m = bar(x1, y1, x2, y2, c || GC.e, opt.r || 0.045); g.E[k(a, b)] = m; g.list.push(m);
    if (w !== undefined) { const l = tag(String(w), 'idx', (x1 + x2) / 2 + 0.22, (y1 + y2) / 2 + 0.22); g.W[k(a, b)] = l; g.list.push(l); }
    return m;
  };
  g.pe = (a, b, c, thick) => { const m = g.E[k(a, b)]; paint(m, c); m.scale.set(thick || 1, 1, thick || 1); };
  g.pv = (v, c) => paint(g.V[v], c);
  g.all = () => g.list;
  return g;
}
// adjacency lists sorted by the given vertex order (ties broken by that order)
function adjOf(vs, es) {
  const A = {}; vs.forEach((v) => (A[v] = []));
  es.forEach(([a, b]) => { A[a].push(b); A[b].push(a); });
  vs.forEach((v) => A[v].sort((p, q) => vs.indexOf(p) - vs.indexOf(q)));
  return A;
}
// Grimaldi's DFS: T ← {v1}; visit(v): for each w adjacent to v, w ∉ T: add w and {v,w}, visit(w)
function dfsRun(vs, es, start) {
  const A = adjOf(vs, es), T = new Set([start]), ev = [], tree = [];
  (function visit(v) {
    for (const w of A[v]) if (!T.has(w)) { T.add(w); tree.push([v, w]); ev.push({ type: 'add', v, w }); visit(w); ev.push({ type: 'back', from: w, to: v }); }
  })(start);
  return { order: [...T], ev, tree };
}
// Grimaldi's BFS: L a queue of unprocessed vertices
function bfsRun(vs, es, start) {
  const A = adjOf(vs, es), T = new Set([start]), L = [start], ev = [], tree = [], lev = { [start]: 0 };
  while (L.length) {
    const v = L.shift(); ev.push({ type: 'deq', v, queue: L.slice() });
    for (const w of A[v]) if (!T.has(w) && !L.includes(w)) { L.push(w); T.add(w); tree.push([v, w]); lev[w] = lev[v] + 1; ev.push({ type: 'add', v, w, queue: L.slice() }); }
  }
  return { order: [...T], ev, tree, lev };
}
// is (vs, es) a tree?  connected and |E| = |V| − 1 (union–find also rules out cycles)
function isTree(vs, es) {
  const p = {}; vs.forEach((v) => (p[v] = v)); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x])));
  for (const [a, b] of es) { const ra = f(a), rb = f(b); if (ra === rb) return false; p[ra] = rb; }
  return es.length === vs.length - 1;
}
function cur(g, S, v) { if (S.cur && g.V[S.cur]) glow(g.V[S.cur], null); S.cur = v; if (v) glow(g.V[v], HL); }
function applyEv(g, S, e) {
  if (e.type === 'add') { g.pe(e.v, e.w, GC.tree, 2.6); g.pv(e.w, GC.in); cur(g, S, e.w); }
  else if (e.type === 'back') cur(g, S, e.to);
  else if (e.type === 'deq') cur(g, S, e.v);
  if (e.queue && S.qdraw) S.qdraw(e.queue);
}
async function runEv(tok, g, S, n, ms = 380) {
  for (let i = 0; i < n && S.ei < S.ev.length; i++) { applyEv(g, S, S.ev[S.ei++]); await wt(tok, ms); }
}
// a queue drawn as a row of small cubes
function queueRow(S, x0, y, label = 'L（queue）') {
  S.qlab = sm(label, x0 - 1.4, y);
  S.qcells = [];
  S.qdraw = (arr) => { gone(S.qcells); S.qcells = arr.map((v, i) => cube(v, GC.num, [0.55, 0.5, 0.4], x0 + i * 0.68, y, 0, 0)); };
}
// a row of value cubes (tokens) centred on x = cx
function row(toks, cx, y, dx = 0.82, colour) {
  const x0 = cx - ((toks.length - 1) * dx) / 2;
  return toks.map((s, i) => cube(String(s), colour ? colour(s, i) : GC.sand, [Math.max(0.6, 0.3 + String(s).length * 0.2), 0.52, 0.4], x0 + i * dx, y, 0, 0.4));
}

// ════════ ppLCIhAnxfI（趙啟超 25A：traversal 回顧、expression tree、Polish notation、spanning tree 定義） ════════
scene('g8c-trav-recap', '25A：三種 traversal（回顧）', [
  async (tok, S) => { // @4.3
    hd('Tree traversal：三種走訪順序', 0, 7.2);
    S.t = mkTree(); S.t.add('r', 'r', 0, 5.8, null, GC.op); S.t.add('a', 'T₁', -2.4, 4.4, 'r', GC.leaf, 1.0); S.t.add('b', 'T₂', 2.4, 4.4, 'r', GC.leaf, 1.0);
    note('示意：root r，底下是 subtree T₁、T₂', 0, 3.5); cap('上次介紹三種 tree traversal', '差在什麼時候 visit root');
  },
  async (tok, S) => { // @7.5
    glow(S.t.N.r, HL); pl('preorder：r → T₁ → T₂（一開始就 visit root）', 0, 2.5); cap('preorder：一開始就 visit root', '再走 left、right subtree');
  },
  async (tok, S) => { // @8.5
    pl('postorder：T₁ → T₂ → r（最後才 visit root）', 0, 1.7); cap('postorder：最後才 visit root', '所有 subtree 都走完才輪到 root');
  },
  async (tok, S) => { // @10.6
    pl('inorder：T₁ → r → T₂（root 在中間、第二個）', 0, 0.9); cap('inorder：root 排在中間', '先 T₁，再 root，再其餘 subtree');
  },
]);

// the lecturer's expression t + (u * v) / (w + x − y ↑ z) as a binary tree (w + (x − y↑z), as he reads it)
const EXN = [
  ['r', '+', -1.5, 6.4, null], ['t', 't', -4.5, 5.3, 'r'], ['d', '/', 1.2, 5.3, 'r'],
  ['m', '*', -1.4, 4.2, 'd'], ['p', '+', 3.6, 4.2, 'd'],
  ['u', 'u', -2.6, 3.1, 'm'], ['v', 'v', -0.2, 3.1, 'm'], ['w', 'w', 2.4, 3.1, 'p'], ['s', '−', 4.8, 3.1, 'p'],
  ['x', 'x', 3.8, 2.0, 's'], ['e', '↑', 5.8, 2.0, 's'], ['y', 'y', 5.0, 0.9, 'e'], ['z', 'z', 6.6, 0.9, 'e'],
];
const EXL = Object.fromEntries(EXN.map((n) => [n[0], n[1]]));
const EXC = (id) => EXN.filter((n) => n[4] === id).map((n) => n[0]);
const preIds = (id) => [id, ...EXC(id).flatMap(preIds)];
const postIds = (id) => [...EXC(id).flatMap(postIds), id];
const isOp = (s) => ['+', '−', '*', '/', '↑'].includes(s);
function addEx(t, id) { const n = EXN.find((q) => q[0] === id); return t.add(id, n[1], n[2], n[3], n[4], isOp(n[1]) ? GC.op : GC.leaf); }
function drawEx(t) { EXN.forEach((n) => addEx(t, n[0])); }

scene('g8c-expr-tree', '25A：數學 expression → binary tree', [
  async (tok, S) => { // @72.4
    S.h = hd('應用：電腦怎麼計算一個數學 expression？', 0, 7.3);
    S.ex = hot('t + uv ÷ (w + x − yᶻ)', 0, 6.4); cap('應用：計算一個數學 expression', '有加減乘除，還有取指數');
  },
  async (tok, S) => { // @78.3
    S.l1 = pl('運算：加 +、減 −、乘 ×、除 ÷、取指數', 0, 5.5); cap('運算有加、減、乘、除', '還有 exponential 取指數');
  },
  async (tok, S) => { // @93.1
    S.l2 = pl('優先順序：指數 → 乘除 → 加減（括號先算）', 0, 4.8); cap('先乘除後加減、指數最先', '這是以前學過的優先順序');
  },
  async (tok, S) => { // @102.4
    S.l3 = bub('每個變數有一個值：電腦裡要怎麼算？', 0, 4.0); cap('每個變數帶一個值進去', '電腦要怎麼照順序算？');
  },
  async (tok, S) => { // @141.0
    S.l4 = pl('procedural language 寫法：t + (u * v) / (w + x − y ↑ z)', 0, 3.1); cap('程式語言裡要把運算明確寫出來', '乘號、除號、指數都要寫');
  },
  async (tok, S) => { // @161.5
    S.l5 = sm('+ 加　* 乘　/ 除　− 減　↑ 取指數（exponential）', 0, 2.4); cap('* 是乘、/ 是除、↑ 是取指數', '這樣寫電腦才看得懂');
  },
  async (tok, S) => { // @185.6
    gone(S.h, S.ex, S.l1, S.l2, S.l3, S.l4, S.l5); hd('t + (u * v) / (w + x − y ↑ z)', 0, 7.3);
    S.t = mkTree(); addEx(S.t, 'r'); cap('先建一棵對應的 binary tree', '運算子放上面');
  },
  async (tok, S) => { // @261.0
    S.n = note('運算子在上面（parent）：兩個 children 做 parent 的運算', 0, -0.3); cap('運算都在上面：parent 是運算子', '兩個 children 依 parent 的運算做');
  },
  async (tok, S) => { // @281.7
    addEx(S.t, 't'); glow(S.t.N.r, HL); cap('root 是 +：t 加上後面這一塊', 't 是 left child');
  },
  async (tok, S) => { // @290.3
    glow(S.t.N.r, null); addEx(S.t, 'd'); glow(S.t.N.d, HL); cap('後面這一塊主要是除法 /', '所以 right child 是 /');
  },
  async (tok, S) => { // @298.7
    glow(S.t.N.d, null); addEx(S.t, 'm'); await wt(tok, 300); addEx(S.t, 'u'); addEx(S.t, 'v'); cap('被除數是 u * v', '* 底下兩個 children：u、v');
  },
  async (tok, S) => { // @301.6
    addEx(S.t, 'p'); glow(S.t.N.p, HL); cap('除數是後面這個 subtree', '它的 root 是 +');
  },
  async (tok, S) => { // @308.0
    glow(S.t.N.p, null); addEx(S.t, 'w'); addEx(S.t, 's'); cap('w 加上後面這個', '後面這個的 root 是 −');
  },
  async (tok, S) => { // @311.0
    addEx(S.t, 'x'); addEx(S.t, 'e'); cap('x 減掉 y 的 z 次方', '− 的兩個 children：x、↑');
  },
  async (tok, S) => { // @313.5
    addEx(S.t, 'y'); addEx(S.t, 'z'); cap('↑ 的兩個 children：y、z', '就是 y 的 z 次方');
  },
  async (tok, S) => { // @342.0
    gone(S.n);
    const ops = EXN.filter((n) => isOp(n[1])), leaves = EXN.filter((n) => !isOp(n[1]));
    const full = ops.every((n) => EXC(n[0]).length === 2) && leaves.every((n) => EXC(n[0]).length === 0);
    ok(full && leaves.length === ops.length + 1, 0, -0.3, '每個運算子剛好 2 個 children：' + ops.length + ' 個運算子、' + leaves.length + ' 個變數（葉子）✓');
    cap('這是 binary tree：最多兩個 children', '運算子都剛好有兩個 children');
  },
]);

scene('g8c-polish', '25A：preorder → Polish notation', [
  async (tok, S) => { // @367.0
    hd('用 preorder traversal 走這棵 tree', 0, 7.3); S.t = mkTree(); drawEx(S.t);
    S.pre = preIds('r'); S.k = 0; S.cells = [];
    cap('怎麼算？用 preorder traversal', '把剛剛那棵 tree 走一遍');
  },
  async (tok, S) => { // @407.8
    S.lab = sm('preorder 的結果 = Polish notation', 0, 0.1); cap('preorder 會產生 Polish notation', '一串運算子和變數');
  },
  async (tok, S) => { // @414.0
    S.who = note('紀念波蘭邏輯學家 Łukasiewicz（出生在 Lwów，今烏克蘭）', 0, -0.6); cap('名字是紀念提出它的人', '所以叫 Polish（波蘭）notation');
  },
  ...[[1, 'preorder 先從 root 開始：+', '先 visit root'], [1, '再 visit left subtree：t', 't 是一片葉子'],
    [1, '再 right subtree：先它的 root /', '每棵 subtree 也是先 root'], [1, '/ 的 left subtree：先 root *', '再來它的兩個 children'],
    [2, '* 的 children：u、v', 'left subtree 處理完了'], [1, '右邊的 subtree：先 root +', '再左再右'],
    [1, '+ 的 left subtree：w', '葉子直接寫'], [1, '右邊 subtree 的 root：−', '再往下'],
    [1, '− 的 left subtree：x', ''], [3, '最後：先 ↑，再 y、z', '整棵 tree 走完']].map(([n, a, b]) => async (tok, S) => {
    if (S.k === 0) gone(S.who);
    for (let i = 0; i < n; i++) {
      const id = S.pre[S.k], x = -5.4 + S.k * 0.9;
      Object.values(S.t.N).forEach((m) => glow(m, null)); glow(S.t.N[id], HL);
      S.cells.push(cube(EXL[id], isOp(EXL[id]) ? GC.op : GC.leaf, [0.62, 0.52, 0.4], x, -0.7, 0, 0.4)); S.k++;
      await wt(tok, 260);
    }
    cap(a, b);
  }),
  async (tok, S) => { // @489.0
    Object.values(S.t.N).forEach((m) => glow(m, null));
    const s = S.pre.map((id) => EXL[id]).join(' ');
    ok(S.k === 13 && s === '+ t / * u v + w − x ↑ y z', 0, -1.4, 'Polish notation：' + s + ' ✓');
    cap('這就是這個 expression 的 Polish notation', 'binary tree 的 preorder');
  },
  async (tok, S) => { // @500.3
    const r = postIds('r').map((id) => EXL[id]).join(' ');
    S.rp = pl('reverse Polish（postorder）：' + r, 0, -2.0); cap('reverse Polish notation 用 postorder', '不是倒過來寫；計算時改成從左往右');
  },
]);

const VAL = { t: 4, u: 2, v: 3, w: 1, x: 9, y: 2, z: 3 };
const OPF = { '+': (a, b) => a + b, '−': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '↑': (a, b) => a ** b };
// evaluate Polish notation the lecturer's way: scan from the right; the first operator met acts on the two numbers after it
function polishRun(toks) {
  let s = toks.slice(); const states = [s.slice()], ops = [];
  while (s.length > 1) {
    let i = s.length - 1; while (i >= 0 && !(s[i] in OPF)) i--;
    const a = s[i + 1], b = s[i + 2], r = OPF[s[i]](a, b);
    ops.push({ i, op: s[i], a, b, r }); s = [...s.slice(0, i), r, ...s.slice(i + 3)]; states.push(s.slice());
  }
  return { states, ops };
}
const PTOK = preIds('r').map((id) => (EXL[id] in VAL ? VAL[EXL[id]] : EXL[id]));
const PRUN = polishRun(PTOK);
const OPN = { '+': '+', '−': '−', '*': '×', '/': '÷', '↑': '^' };
const opText = (o) => (o.op === '↑' ? o.a + ' 的 ' + o.b + ' 次方 = ' + o.r : o.a + ' ' + OPN[o.op] + ' ' + o.b + ' = ' + o.r);
function evalRow(S, k) {
  const y = 5.0 - k * 0.85;
  const cells = row(PRUN.states[k], -0.9, y, 0.82, (s) => (s in OPF ? GC.op : GC.num));
  S.rows.push(cells); return cells;
}
function hiOp(S, k) { const o = PRUN.ops[k]; const cells = S.rows[k]; [o.i, o.i + 1, o.i + 2].forEach((j) => glow(cells[j], HL)); return o; }

scene('g8c-polish-eval', '25A：Polish notation 從右到左計算', [
  async (tok, S) => { // @520.7
    hd('Polish notation：+ t / * u v + w − x ↑ y z', 0, 7.3); S.rows = []; S.rl = [];
    cap('Polish notation 要怎麼算？', '每個變數已經有一個值');
  },
  async (tok, S) => { // @532.2
    S.dir = hot('計算順序：從右邊往左邊 ←', -2.6, 6.6); cap('evaluate 的順序：從右到左', '從後面往前算');
  },
  async (tok, S) => { // @564.1
    S.dir2 = sm('（reverse Polish 就反過來：從左往右）', 3.2, 6.6); cap('reverse Polish 就反過來', '從左邊算到右邊');
  },
  async (tok, S) => { // @583.0
    S.val = pl('帶值：' + Object.entries(VAL).map(([k, v]) => k + ' = ' + v).join('，'), 0, 5.9); cap('每個變數帶一個值進來', 't = 4、u = 2……');
  },
  async (tok, S) => { // @640.1
    evalRow(S, 0); cap('把值帶進 Polish notation', '一步一步從右邊算');
  },
  async (tok, S) => { // @652.1
    hiOp(S, 0); S.op = note('從右 scan：3、2，碰到 ↑', 5.3, 5.0); cap('從右邊 scan：3、2，碰到 ↑', '運算子作用在它後面兩個數');
  },
  async (tok, S) => { // @686.0
    gone(S.op); S.op = good(opText(PRUN.ops[0]), 5.3, 5.0); cap('算 2 的 3 次方 = 8', '後面這三個用 8 換掉');
  },
  ...[1, 2, 3, 4, 5].flatMap((k) => {
    const o = PRUN.ops[k];
    const say1 = [['再從右邊 scan：8、9，碰到 −', '9 − 8 = 1'], ['scan：1、1，碰到 +', '1 + 1 = 2'], ['2、3、2 還不是：要 scan 到運算子', '碰到 ×：2 × 3 = 6'], ['scan：2、6，碰到 ÷', '6 ÷ 2 = 3'], ['scan：3、4，碰到 +', '4 + 3 = 7']][k - 1];
    const replace = async (tok, S) => {
      gone(S.op); evalRow(S, k); cap('剛剛那三個用 ' + PRUN.ops[k - 1].r + ' 換掉', '其他不動');
    };
    const compute = async (tok, S) => {
      hiOp(S, k); gone(S.op); S.op = good(opText(o), 5.3, 5.0 - k * 0.85); cap(say1[0], say1[1]);
    };
    // step order: replace previous result, then compute this one (the × step has an extra "keep scanning" beat)
    if (k === 3) return [replace, async (tok, S) => { hiOp(S, k); S.op = note('2、3、2 都是數 → 繼續 scan', 5.3, 5.0 - k * 0.85); cap('2、3、2 都不是運算子', '要一直 scan 到運算子為止'); },
      async (tok, S) => { gone(S.op); S.op = good(opText(o), 5.3, 5.0 - k * 0.85); cap('碰到 ×：它後面兩個數 2 × 3 = 6', '最後那個 2 沒有動'); }];
    return [replace, compute];
  }),
  async (tok, S) => { // @875.7
    gone(S.op); evalRow(S, 6); const r = PRUN.states[6];
    ok(r.length === 1 && r[0] === 7, 1.6, 5.0 - 6 * 0.85, '答案 = ' + r[0] + ' ✓'); cap('最後只剩一個數：答案是 7', '一路從右往左算出來');
  },
  async (tok, S) => { // @886.5
    S.sum = note('expression → binary tree → preorder → Polish notation → 從右到左算', 0, -1.6); cap('流程：建 tree、preorder、從右到左算', '碰到運算子就和後面兩個數運算');
  },
  async (tok, S) => { // @947.2
    const { t, u, v, w, x, y, z } = VAL; const direct = t + (u * v) / (w + x - y ** z);
    ok(direct === PRUN.states[6][0], 0, -2.2, '直接代入：4 + (2·3) / (1 + 9 − 2³) = 4 + 6/2 = ' + direct + ' ✓');
    cap('用原來的式子直接算，也是 7', '跟平常手算一樣');
  },
]);

const SG = { pos: { a: [-3.2, 5.3], b: [0, 6.2], c: [3.2, 5.3], d: [-1.6, 2.9], e: [1.6, 2.9] }, es: [['a', 'b'], ['b', 'c'], ['a', 'd'], ['b', 'd'], ['b', 'e'], ['c', 'e'], ['d', 'e']], tree: [['a', 'b'], ['b', 'c'], ['b', 'd'], ['b', 'e']] };
scene('g8c-span-def', '25A：spanning tree 的定義', [
  async (tok, S) => { // @1006.0
    hd('Spanning tree（生成樹）', 0, 7.3); cap('spanning tree：顧名思義是一棵 tree', '而且要 spanning');
  },
  async (tok, S) => { // @1027.6
    S.g = mkGraph(SG.pos); Object.keys(SG.pos).forEach((v) => S.g.v(v)); SG.es.forEach(([a, b]) => S.g.e(a, b));
    pl('G = (V, E)：connected simple graph', 0, 1.8); note('示意', 4.8, 6.2); cap('先要有一個原來的圖 G', 'connected simple graph，V、E');
  },
  async (tok, S) => { // @1041.0
    pl('G 的一個 spanning tree：T = (V′, E′)', 0, 1.1); cap('它的 spanning tree 叫 T', 'vertex set V′、edge set E′');
  },
  async (tok, S) => { // @1050.9
    pl('① T 是 G 的 subgraph（邊都要是 G 的邊）', 0, 0.4); cap('T 一定要是 G 的 subgraph', '是 G 的一部分');
  },
  async (tok, S) => { // @1070.4
    SG.es.forEach(([a, b]) => S.g.pe(a, b, GC.dim)); SG.tree.forEach(([a, b]) => S.g.pe(a, b, GC.tree, 2.6));
    ok(isTree(Object.keys(SG.pos), SG.tree), 0, -0.3, '② T 是 tree：連通、沒有 cycle ✓'); cap('條件一：T 要是 tree', '連通而且沒有 cycle');
  },
  async (tok, S) => { // @1075.3
    pl("③ spanning：V′ = V", 0, -1.0); cap('什麼叫 spanning？', "T 的 vertex set 跟原來一樣：V′ = V");
  },
  async (tok, S) => { // @1084.2
    Object.keys(SG.pos).forEach((v) => S.g.pv(v, GC.in));
    sm('5 個端點全部在 T 裡；邊 4 = 5 − 1', 0, -1.6); cap('每個端點都要包含在裡面', '所以叫 spanning');
  },
  async (tok, S) => { // @1111.5
    bub('不能多出 G 沒有的邊或端點', 0, -2.2); cap('不能多出原來沒有的 edge', 'subgraph + tree + 所有端點');
  },
]);

// ════════ HxJ9nxLsGM8（趙啟超 25B：spanning tree 例子、DFS 與 BFS 虛擬碼） ════════
// 示意的 8 點圖（投影片上的圖看不到）：a..h = v1..v8
const G8 = { vs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], es: [['a', 'b'], ['a', 'e'], ['b', 'c'], ['b', 'f'], ['c', 'd'], ['c', 'g'], ['d', 'h'], ['e', 'f'], ['f', 'g']] };
const G8big = { a: [-4.5, 5.6], b: [-1.5, 5.6], c: [1.5, 5.6], d: [4.5, 5.6], e: [-4.5, 2.6], f: [-1.5, 2.6], g: [1.5, 2.6], h: [4.5, 2.6] };
const G8sm = { a: [-4.5, 5.7], b: [-1.5, 5.7], c: [1.5, 5.7], d: [4.5, 5.7], e: [-4.5, 4.3], f: [-1.5, 4.3], g: [1.5, 4.3], h: [4.5, 4.3] };
const D8 = dfsRun(G8.vs, G8.es, 'a'), B8 = bfsRun(G8.vs, G8.es, 'a');
function drawG(pos, gr, weights) { const g = mkGraph(pos); gr.vs.forEach((v) => g.v(v)); gr.es.forEach(([a, b]) => g.e(a, b)); return g; }

scene('g8c-span-ex', '25B：找 G 的 spanning tree', [
  async (tok, S) => { // @44.6
    S.g = drawG(G8big, G8); note('示意圖：8 個端點', 0, 7.2); cap('原來的圖 G：8 個端點、好多邊', '要找它的 spanning tree');
  },
  async (tok, S) => { // @58.6
    pl('要找一個 tree：是 G 的 subgraph', 0, 1.4); cap('找一個 tree，是 G 的 subgraph', '而且要包含所有端點');
  },
  async (tok, S) => { // @66.1
    G8.vs.forEach((v) => S.g.pv(v, GC.in)); cap('這個 tree 要包含所有的端點', '8 個一個都不能少');
  },
  async (tok, S) => { // @113.9
    G8.es.forEach(([a, b]) => S.g.pe(a, b, GC.dim)); D8.tree.forEach(([a, b]) => S.g.pe(a, b, GC.tree, 2.6));
    S.T = hot('T：G 的一個 spanning tree', 0, 0.7); cap('這就是 T，G 的一個 spanning tree', '金色的邊是 T 的邊');
  },
  async (tok, S) => { // @118.1
    const sub = D8.tree.every(([a, b]) => G8.es.some(([p, q]) => (p === a && q === b) || (p === b && q === a)));
    ok(sub, 0, 0.0, 'T 的每條邊都在 G 裡 → subgraph ✓'); cap('T 是 G 的 subgraph', '不能自己多出 edge');
  },
  async (tok, S) => { // @129.5
    ok(isTree(G8.vs, D8.tree), 0, -0.7, 'connected、沒有 cycle → tree ✓'); cap('tree：connected、without cycles', 'T 連通又沒有 cycle');
  },
  async (tok, S) => { // @137.5
    ok(D8.order.length === 8 && D8.tree.length === 7, 0, -1.4, '8 個端點都在、邊數 7 = 8 − 1 → spanning ✓'); cap('它要 span 原來的 graph', '8 個端點全都在裡面');
  },
  async (tok, S) => { // @157.5
    G8.es.forEach(([a, b]) => S.g.pe(a, b, GC.dim)); B8.tree.forEach(([a, b]) => S.g.pe(a, b, GC.blue, 2.6));
    const diff = B8.tree.some(([a, b]) => !D8.tree.some(([p, q]) => (p === a && q === b) || (p === b && q === a)));
    gone(S.T); S.T = hot('另一個 spanning tree（藍色）', 0, 0.7);
    ok(diff && isTree(G8.vs, B8.tree), 4.8, 0.7, '也是 ✓'); cap('spanning tree 通常不唯一', '邊取法不同，就得到不同的 tree');
  },
]);

const DFS_CODE = ['T ← {v₁}', 'visit(v₁)', 'procedure visit(v):', '  for 每個與 v 相鄰、不在 T 的 w:', '    把 w 和邊 {v, w} 加進 T', '    visit(w)'];
scene('g8c-dfs-code', '25B：DFS（depth-first search）虛擬碼', [
  async (tok, S) => { // @178.0
    hd('建 spanning tree 的兩個演算法', 0, 7.3); cap('介紹兩個找 spanning tree 的方法', '找法其實很多種');
  },
  async (tok, S) => { // @195.6
    S.two = pl('深度先（depth first）還是廣度先（breadth first）？', 0, 6.6); cap('差別：深度先還是廣度先', '兩種主要考量');
  },
  async (tok, S) => { // @209.1
    S.g = drawG(G8sm, G8); note('示意圖', 6.2, 6.6); cap('先把 G 的端點排一個順序', '等一下有好幾個選擇時用');
  },
  async (tok, S) => { // @238.6
    S.ordl = sm('順序 v₁ … v₈ = a b c d e f g h（有多種選擇就照這個順序）', 0, 3.75); cap('v₁ 到 vₙ：照這個順序選', '這樣就不會有 ambiguity');
  },
  async (tok, S) => { // @293.3
    gone(S.two); S.two = hot('DFS：Depth-First Search（深度先）', 0, 6.6); cap('第一個：depth-first search', '簡稱 DFS');
  },
  async (tok, S) => { // @323.0
    S.code = code(DFS_CODE, 0, 3.2, 0.5); cap('這是 DFS 的 pseudocode', '主程式兩行，加一個副程式 visit');
  },
  async (tok, S) => { // @373.0
    S.code.hl(0); S.g.pv('a', GC.in); cur(S.g, S, 'a'); S.ev = D8.ev; S.ei = 0; cap('一開始 T 只有一個端點 v₁', '從 v₁ = a 開始');
  },
  async (tok, S) => { // @410.4
    S.code.hl(1); cap('執行 visit(v₁)', '它做完回來，整個就結束');
  },
  async (tok, S) => { // @447.2
    S.code.hl(2); cap('副程式 visit(v) 會 call 它自己', '是 recursive 的');
  },
  async (tok, S) => { // @477.0
    S.code.hl(3); cap('找每個跟 v 相鄰、還不在 T 裡的 w', '已經在 T 裡的就不必管');
  },
  async (tok, S) => { // @521.2
    S.code.hl(4); await runEv(tok, S.g, S, 1); cap('把 w 和邊 {v, w} 加進 T', '這裡：a 的第一個是 b');
  },
  async (tok, S) => { // @537.0
    S.code.hl(5); await runEv(tok, S.g, S, 1); cap('再去 visit(w)：從 b 再找下去', 'b 找到還不在 T 的 c');
  },
  async (tok, S) => { // @593.4
    await runEv(tok, S.g, S, 2); cap('能下去就一直下去', 'c → d → h');
  },
  async (tok, S) => { // @608.2
    S.dp = note('depth：先往深的地方走', 0, 0.1); cap('所以叫 depth-first（深度先）', '一路往下走');
  },
  async (tok, S) => { // @618.6
    S.stk = bad('h 的鄰居都已在 T 裡 → 不能再加', 0, -0.5); cap('連到的都已經在 tree 裡了', '再加進去就會造成 cycle');
  },
  async (tok, S) => { // @639.6
    S.ind = good('每次加的新端點都不在 T → 不會有 cycle，一直是 tree', 0, -1.1); cap('每次加進的端點都不在 T 裡', '所以永遠不會造成 cycle');
  },
  async (tok, S) => { // @667.0
    gone(S.stk); await runEv(tok, S.g, S, 2); cap('沒得走就回到上一層', 'h → d → c，回到剛才的地方');
  },
  async (tok, S) => { // @686.0
    await runEv(tok, S.g, S, 3); cap('c 再找下一個還沒處理的', 'c → g → f → e');
  },
  async (tok, S) => { // @746.0
    await runEv(tok, S.g, S, S.ev.length - S.ei, 200); cur(S.g, S, null);
    const okk = S.ei === S.ev.length && isTree(G8.vs, D8.tree);
    ok(okk, 0, -1.7, 'DFS 順序：' + D8.order.join(' ') + '；' + D8.tree.length + ' 條邊 → spanning tree ✓'); cap('全部處理完，回到 v₁ 就結束', '得到 DFS spanning tree');
  },
]);

const BFS_CODE = ['L ← 空的 queue；T ← {v₁}', '把 v₁ 放進 L', 'while L 不空:', '  v ← 從 L 前面拿出第一個', '  for 每個與 v 相鄰、不在 L 也不在 T 的 w:', '    把 w 加到 L 的尾巴', '    把 w 和邊 {v, w} 加進 T'];
scene('g8c-bfs-code', '25B：BFS（breadth-first search）虛擬碼', [
  async (tok, S) => { // @760.1
    hd('BFS：Breadth-First Search（廣度先）', 0, 7.3); cap('另一個：breadth-first search', 'breadth 是廣度，簡稱 BFS');
  },
  async (tok, S) => { // @803.1
    S.g = drawG(G8sm, G8); note('示意圖', 6.2, 6.6); S.code = code(BFS_CODE, 0, 3.4, 0.48); cap('看 BFS 的 pseudocode', '除了 T，還多一個 L');
  },
  async (tok, S) => { // @854.1
    queueRow(S, 1.4, -0.1); S.qdraw([]); S.qn = sm('queue：First In First Out（FIFO）', -2.6, -0.7); cap('L 是一個 queue', 'First In First Out，先進先出');
  },
  async (tok, S) => { // @879.0
    S.st = sm('（stack 才是先進後出 FILO）', 3.0, -0.7); cap('就像排隊：先進去的先出來', '先進後出的那種叫 stack');
  },
  async (tok, S) => { // @901.0
    S.code.hl(0); cap('L 一開始是 empty list', 'L 放「還沒處理的端點」');
  },
  async (tok, S) => { // @917.5
    S.code.hl(2); cap('L 裡有東西就一直做', 'L 空了就停：全部都處理過了');
  },
  async (tok, S) => { // @961.6
    S.code.hl(1); S.qdraw(['a']); S.g.pv('a', GC.in); S.ev = B8.ev; S.ei = 0; cap('先把第一個端點放到 L 裡', 'v₁ = a');
  },
  async (tok, S) => { // @968.4
    S.code.hl(3); await runEv(tok, S.g, S, 1); cap('從 L 前面拿出第一個：a', '尾巴進、前面出');
  },
  async (tok, S) => { // @1007.0
    S.code.hl(5); await runEv(tok, S.g, S, 1); cap('a 的鄰居 b：不在 L 也不在 T', '加到 L 尾巴，邊 {a, b} 加進 T');
  },
  async (tok, S) => { // @1080.3
    S.code.hl(6); await runEv(tok, S.g, S, 1); cap('再找下一個：e', '也加到 L 尾巴、邊加進 T');
  },
  async (tok, S) => { // @1129.6
    S.code.hl(4); cap('a 連的都處理完，for 就做完了', '它們都在 L 裡排隊');
  },
  async (tok, S) => { // @1142.0
    S.code.hl(3); await runEv(tok, S.g, S, 3); cap('回到 while：拿出 L 第一個 b', 'b 再長出 c、f');
  },
  async (tok, S) => { // @1166.3
    await runEv(tok, S.g, S, 4); cap('再拿出下一個：e（沒得長）、c', 'c 長出 d、g');
  },
  async (tok, S) => { // @1189.8
    const lv = {}; Object.entries(B8.lev).forEach(([v, l]) => (lv[l] = (lv[l] || []).concat(v)));
    S.lv = sm('level：' + Object.keys(lv).map((l) => l + '｛' + lv[l].join(' ') + '｝').join('　'), 0, -1.3);
    cap('level 1 全部長完，才長 level 2', '這就是廣度先');
  },
  async (tok, S) => { // @1209.0
    await runEv(tok, S.g, S, S.ev.length - S.ei, 220); cur(S.g, S, null);
    ok(S.ei === S.ev.length && isTree(G8.vs, B8.tree), 0, -1.9, 'L 空了：BFS 順序 ' + B8.order.join(' ') + ' → spanning tree ✓'); cap('讓每個端點的 level 越小越好', 'L 空了就做完');
  },
  async (tok, S) => { // @1258.1
    S.more = note('還有其他方法：例如邊上有 weight 的 minimal spanning tree（之後講）', 0, -2.5); cap('還有其他找 spanning tree 的方法', '邊有 weight 的以後再講');
  },
]);

// ════════ OOQOvGDi_0w（趙啟超 25C：DFS／BFS 例子、BFS 應用、Erdős number） ════════
// 由老師口述重建：A–B、A–C、A–D、B–D、B–E、E–F、E–H、C–G、G–I、G–J（位置示意）
const GJ = { vs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], es: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'D'], ['B', 'E'], ['E', 'F'], ['E', 'H'], ['C', 'G'], ['G', 'I'], ['G', 'J']] };
const GJpos = { A: [0, 6.3], B: [-3, 4.7], D: [-0.6, 4.5], C: [3.2, 4.7], E: [-4.4, 2.8], F: [-5.6, 1.1], H: [-3.2, 1.1], G: [3.2, 2.8], I: [2.0, 1.1], J: [4.4, 1.1] };
const DJ = dfsRun(GJ.vs, GJ.es, 'A'), BJ = bfsRun(GJ.vs, GJ.es, 'A');
function ordTag(S, y = -0.3) { gone(S.ot); const seen = []; for (let i = 0; i < S.ei; i++) { const e = S.ev[i]; if (e.type === 'add') seen.push(e.w); } S.ot = sm('加進 T 的順序：A ' + seen.join(' '), 0, y); }

scene('g8c-dfs-ex', '25C：DFS 例子（從 A、字母順序）', [
  async (tok, S) => { // @9.3
    S.g = drawG(GJpos, GJ); note('位置示意', 5.6, 6.6);
    ['A|B', 'B|D', 'A|D'].forEach((k) => paint(S.g.E[k], GC.hot));
    ok(!isTree(GJ.vs, GJ.es), 0, 7.3, 'G：connected simple graph，有 cycle A–B–D → 不是 tree ✓'); cap('原來的 G：connected simple graph', '它本身不是 tree');
  },
  async (tok, S) => { // @79.3
    GJ.es.forEach(([a, b]) => S.g.pe(a, b, GC.e)); hot('用 DFS 找 spanning tree', 0, 0.4); cap('先用 DFS 找它的 spanning tree', '深度先');
  },
  async (tok, S) => { // @99.0
    S.ev = DJ.ev; S.ei = 0; S.g.pv('A', GC.in); cur(S.g, S, 'A'); ordTag(S); cap('多種選擇時用 alphabetic order', '所以從 A 開始');
  },
  ...[[1, 'A 連到 B、C、D：照字母先走 B', '把 A、邊 AB 加進去'], [1, 'B 連到還沒在 T 的 D、E：先 D', '邊 BD 加進去'],
    [1, 'D 只連到 A、B，都在 T 裡了', '下不去，回到上一層 B'], [1, 'B 還有 E 不在 T 裡', '走到 E'],
    [1, 'E 往下有 F、H：字母順序先 F', '邊 EF 加進去'], [2, 'F 沒得走，回到 E', 'E 還有一個 H'],
    [3, 'H、F、B 都在 T 裡了', '一路回到 B，再回到 A'], [1, 'A 還沒加的只剩 C', '邊 AC 加進去'],
    [1, 'C 往下只有 G', '邊 CG 加進去'], [3, 'G 往下：先 I，再 J', 'I 下面沒有，回到 G 再走 J'],
    [3, '所有端點都處理完了', 'J → G → C → A，結束']].map(([n, a, b]) => async (tok, S) => {
    await runEv(tok, S.g, S, n); ordTag(S); cap(a, b);
  }),
  async (tok, S) => { // @397.0
    cur(S.g, S, null); const s = DJ.order.join(' ');
    ok(s === 'A B D E F H C G I J', 0, -1.0, 'DFS 順序：' + s + ' ✓'); cap('順序：A B D E F H C G I J', '能走就走，沒有就回來');
  },
  async (tok, S) => { // @407.5
    ok(isTree(GJ.vs, DJ.tree), 0, -1.7, DJ.tree.length + ' 條邊 = 10 − 1，連通無 cycle → spanning tree ✓'); cap('每次加的端點都不在 tree 裡', '全部加完就是 spanning tree');
  },
]);

scene('g8c-bfs-ex', '25C：BFS 例子（從 A、字母順序）', [
  async (tok, S) => { // @415.3
    S.g = drawG(GJpos, GJ); note('位置示意', 5.6, 6.6); hd('用 BFS 找 spanning tree，從 A 開始', 0, 7.3);
    queueRow(S, -2.2, -0.4, 'Q（= L）'); S.qdraw(['A']); S.ev = BJ.ev; S.ei = 0; S.g.pv('A', GC.in); cap('再看 BFS：還是從 A 開始', 'A 先放進 queue');
  },
  ...[[2, '拿出 A：A 連到 B、C、D，先 B', 'B 丟進 queue，邊 AB 加進 T'], [1, '再來 C：不在 Q 也不在 T', 'C 丟進 queue'],
    [1, 'A 還有一個 D', '可以連到 A 的都處理完了'], [2, '拿出 Q 的第一個：B', 'B 下面只剩 E 可以加'],
    [2, '再拿出最前面的：C', 'C 再下去是 G'], [1, '拿出 D：D 連到 A、B', '都已經在 tree 裡，沒有可加的'],
    [3, '拿出 E：先 F 再 H', 'F、H 丟進 queue'], [3, '拿出 G：先 I 再 J', 'I、J 丟進 queue'],
    [4, 'F、H、I、J 下面都沒有了', 'Q 又空了，結束']].map(([n, a, b]) => async (tok, S) => {
    await runEv(tok, S.g, S, n); cap(a, b);
  }),
  async (tok, S) => { // @641.1
    cur(S.g, S, null); const s = BJ.order.join(' ');
    const lv = {}; Object.entries(BJ.lev).forEach(([v, l]) => (lv[l] = (lv[l] || []).concat(v)));
    ok(s === 'A B C D E G F H I J', 0, -1.2, 'BFS 順序：' + s + ' ✓');
    sm('level：' + Object.keys(lv).map((l) => l + '｛' + lv[l].join(' ') + '｝').join('　'), 0, -1.8);
    cap('順序：A，B C D，E G，F H I J', '一層一層長');
  },
  async (tok, S) => { // @663.0
    note('BFS 廣度先：先把 level 1 長滿；DFS 深度先：能往下就往下', 0, -2.4); cap('BFS 是廣度先', '剛才 DFS 是深度先');
  },
]);

scene('g8c-bfs-apps', '25C：BFS 的應用：限制高度', [
  async (tok, S) => { // @677.0
    hd('BFS 有很多應用', 0, 7.3); cap('BFS 有蠻多應用', '因為它一層一層長');
  },
  async (tok, S) => { // @688.0
    S.root = cube('A', GC.in, [0.62, 0.56, 0.4], 0, 6.3, 0, 0); S.rows = [];
    const ns = [3, 4, 5, 6, 6, 6];
    for (let l = 1; l <= 5; l++) {
      const y = 6.3 - l * 1.0, n = ns[l - 1];
      S.rows.push(...Array.from({ length: n }, (_, i) => cube('', l <= 5 ? GC.blue : GC.dim, [0.32, 0.32, 0.32], (i - (n - 1) / 2) * 1.0, y, 0, 0)));
      sm('level ' + l, -5.6, y); await wt(tok, 200);
    }
    note('示意', 5.6, 6.3); cap('BFS 可以限制 tree 的 height', '例如只做到 level 5');
  },
  async (tok, S) => { // @716.7
    S.cut = bar(-6.5, 0.8, 6.5, 0.8, GC.hot, 0.04); sm('到 level 5 就停（不一定是 spanning tree）', 0, 0.4);
    good('離 A 最短距離 ≤ 5 的端點全部都在裡面，而且在最短的 level', 0, -0.3); cap('做完 level 5 就停', '距離 ≤ 5 的端點全都在裡面');
  },
  async (tok, S) => { // @743.5
    S.a1 = pl('P2P network（如 BitTorrent）：找附近也在下載同一檔案的 node', 0, -1.0); cap('應用：P2P network', '找附近的 node 互相傳檔案');
  },
  async (tok, S) => { // @788.4
    pl('搜尋引擎的 crawler', -2.6, -1.6); cap('搜尋引擎的 crawler', '一層一層去找網頁');
  },
  async (tok, S) => { // @794.7
    pl('social network', 2.6, -1.6); cap('social network 也有應用', '找跟你很近的人');
  },
  async (tok, S) => { // @798.1
    hot('關鍵：BFS 可以只找到第 5 層就停', 0, -2.3); cap('主要因為 BFS 可以限制 level', '找到五層就停');
  },
]);

// collaboration graph：老師的例子 A–B、A–C、B–C、B–D、A–E；Erdős–A 是示意
const CG = { pos: { Erdős: [0, 6.2], A: [-2.2, 4.4], B: [1.6, 4.4], C: [-0.4, 2.7], D: [3.4, 2.7], E: [-4.2, 2.7] }, es: [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['A', 'E']] };
const CGall = { vs: ['Erdős', 'A', 'B', 'C', 'D', 'E'], es: [['Erdős', 'A'], ...CG.es] };
const BE = bfsRun(CGall.vs, CGall.es, 'Erdős');
scene('g8c-erdos', '25C：collaboration graph 與 Erdős number', [
  async (tok, S) => { // @1185.6
    hd('Erdős number', 0, 7.3); cap('數學上很有名的：Erdős number', '跟 collaboration 有關');
  },
  async (tok, S) => { // @1237.4
    S.g = mkGraph(CG.pos, { vs: 0.9 }); ['A', 'B', 'C', 'D', 'E'].forEach((v) => S.g.v(v));
    sm('每個端點 = 一位作者', 4.6, 5.6); cap('collaboration graph：端點是作者', '每一個人一個端點');
  },
  async (tok, S) => { // @1241.0
    S.g.e('A', 'B'); cap('A、B 合寫過論文 → 連一條邊', '至少一篇就連');
  },
  async (tok, S) => { // @1254.0
    for (const [a, b] of CG.es.slice(1)) { S.g.e(a, b); await wt(tok, 250); }
    cap('A–C、B–C、B–D、A–E 也都合作過', '都連起來');
  },
  async (tok, S) => { // @1278.0
    sm('simple graph：合寫兩篇也只連一條邊', 0, 1.6); cap('它是 simple graph', '沒有 multiple edge');
  },
  async (tok, S) => { // @1309.4
    S.g.v('Erdős', GC.pink); S.g.e('Erdős', 'A'); note('示意：假設 Erdős 和 A 合寫過', 3.0, 6.6);
    cap('從 Paul Erdős 開始建 BFS tree', '他當成 v₁');
  },
  async (tok, S) => { // @1332.3
    BE.tree.filter(([v]) => v === 'Erdős').forEach(([v, w]) => S.g.pe(v, w, GC.tree, 2.6));
    cap('跟他合寫過論文的人：level 1', '一層一層');
  },
  async (tok, S) => { // @1370.2
    for (const [v, w] of BE.tree.filter(([v]) => v !== 'Erdős')) { S.g.pe(v, w, GC.tree, 2.6); await wt(tok, 250); }
    cap('再從 level 1 的人長下去', '還沒出現過的合作者放在 level 2……');
  },
  async (tok, S) => { // @1430.3
    S.nums = CGall.vs.map((v) => { const [x, y] = CG.pos[v]; return hot(String(BE.lev[v]), x + 0.75, y + 0.35); });
    pl('Erdős number = BFS tree 的 level（Erdős 本人是 0）', 0, 1.0); cap('Erdős 本人是 0', 'level 1 的人是 1，level 2 是 2');
  },
  async (tok, S) => { // @1478.5
    const okk = BE.lev.D === 3 && BE.lev.B === 2 && BE.lev.A === 1;
    ok(okk, 0, 0.3, '= 在 collaboration graph 上到 Erdős 的最短 path 邊數（例：D 是 3）✓'); cap('Erdős number 就是最短距離', '最短 path 的邊數 = level');
  },
  async (tok, S) => { // @1507.3
    sm('Erdős Number Project：網站列出所有人', 0, -0.4); cap('有個 Erdős Number Project', '網站可以查自己是多少');
  },
  async (tok, S) => { // @1573.0
    pl('Erdős 1996 年過世 → Erdős number 1 的人不會再增加', 0, -1.0); cap('Erdős 已經過世', 'number 1 的人不會再增加');
  },
  async (tok, S) => { // @1589.8
    pl('Erdős number 1：512 人', -3.0, -1.6); cap('Erdős number 1 的有 512 人', '名單在網站上');
  },
  async (tok, S) => { // @1617.3
    pl('number 2：約 12600 人（還在增加）', 2.6, -1.6); cap('number 2 的人還會增加', '老師查到約 12600 人');
  },
  async (tok, S) => { // @1636.6
    sm('number 3：33605、number 4：83642（老師引用的舊統計）', 0, -2.2); cap('number 3、4 的人更多', '這些數字不是最新的');
  },
]);

// ════════ AzCFmDjYLXM（趙啟超 25D：trees and sorting、merge sort 例子） ════════
const MS = [6, 2, 7, 3, 4, 9, 5, 1, 8];
// splitting tree: left half gets ⌈n/2⌉
function splitTree(a, depth = 0, out = [], parent = null, idx0 = 0) {
  const id = out.length; out.push({ id, a, depth, parent, lo: idx0 });
  if (a.length > 1) { const m = Math.ceil(a.length / 2); const L = splitTree(a.slice(0, m), depth + 1, out, id, idx0); const R = splitTree(a.slice(m), depth + 1, out, id, idx0 + m); out[id].kids = [L, R]; }
  return id;
}
function mergeLog(x, y) {
  const a = x.slice(), b = y.slice(), out = [], comps = [];
  while (a.length && b.length) { const w = a[0] <= b[0] ? a.shift() : b.shift(); comps.push(w); out.push(w); }
  return { out: out.concat(a, b), comps: comps.length, rest: a.length ? a : b, taken: out };
}
const MSN = []; splitTree(MS, 0, MSN);
const MSX = (n) => { const xs = n.a.map((_, i) => -6 + (n.lo + i) * 1.5); return xs.reduce((s, v) => s + v, 0) / xs.length; };
const msW = (n) => 0.3 + n.a.length * 0.42;
// merge result per node (computed bottom-up) and the comparisons each merge used
const MSR = {}; (function up(id) { const n = MSN[id]; if (!n.kids) { MSR[id] = { out: n.a.slice(), comps: 0 }; return; } n.kids.forEach(up); const r = mergeLog(MSR[n.kids[0]].out, MSR[n.kids[1]].out); MSR[id] = r; })(0);
const sorted = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
function cmpPairs(x, y) { const a = x.slice(), b = y.slice(), s = []; while (a.length && b.length) { const p = a[0] + ' vs ' + b[0]; const w = a[0] <= b[0] ? a.shift() : b.shift(); s.push(p + ' → ' + w); } return { s, rest: a.length ? a : b }; }

scene('g8c-sort-intro', '25D：trees and sorting', [
  async (tok, S) => { // @4.3
    hd('Trees and sorting', 0, 7.3); cap('tree 的最後一個 topic', 'tree 跟 sorting');
  },
  async (tok, S) => { // @6.7
    pl('之前學過：bubble sort、insertion sort', 0, 6.4); cap('之前介紹過兩種 sorting', 'bubble sort、insertion sort');
  },
  async (tok, S) => { // @8.2
    S.r = row([5, 1, 4, 2, 3], 0, 5.2); note('示意', 3.2, 5.2); sm('sorting：一串數（或 totally ordered set 的元素）照大小排好', 0, 4.4);
    cap('sorting：照大小順序排起來', '或照 total order 排');
  },
  async (tok, S) => { // @57.4
    pl('看 comparison 的數目：bubble、insertion 都是 O(n²)', 0, 3.4); cap('複雜度看比較的次數', '兩個都是 O(n²)');
  },
  async (tok, S) => { // @74.2
    pl('資料用 binary tree 來存 → 比較次數可以降低', 0, 2.5); cap('如果資料用 binary tree 存', '比較的次數可以降下來');
  },
  async (tok, S) => { // @94.5
    bub('書名：Algorithms + Data Structures = Programs', 0, 1.5); cap('Algorithm + Data Structure = Program', '用對資料結構，複雜度就能降');
  },
  async (tok, S) => { // @113.2
    hot('例子：merge sort', 0, 0.5); cap('下面介紹一種 sort：merge sort', '先用例子看它怎麼做');
  },
]);

function msBox(n, y, c = GC.sand) { return cube(n.a.join(' '), c, [msW(n), 0.52, 0.4], MSX(n), y, 0, 0.4); }
scene('g8c-ms-split', '25D：merge sort 第一步 splitting', [
  async (tok, S) => { // @157.0
    hd('9 個數，照大小排', 0, 7.3); S.b = {}; S.b[0] = msBox(MSN[0], 6.4); S.e = [];
    cap('這九個數：6 2 7 3 4 9 5 1 8', '要把它照大小排好');
  },
  async (tok, S) => { // @169.2
    sm('第一步：splitting（分開）', -4.6, 7.3 - 0.0); cap('merge sort 有兩步', '第一步叫 splitting');
  },
  async (tok, S) => { // @180.5
    sm('第二步：merging（合併）', 4.6, 7.3); cap('第二步叫 merging', '兩個都是 binary tree');
  },
  async (tok, S) => { // @195.6
    S.c = note('每次切一半；不能整除時左邊多一個：⌈9/2⌉ = ⌈4.5⌉ = ' + Math.ceil(9 / 2), 0, -0.4); cap('每次把它切成兩半', '9 個：左邊放 ⌈4.5⌉ = 5 個');
  },
  ...[1, 2, 3, 4].map((d) => async (tok, S) => {
    for (const n of MSN.filter((q) => q.depth === d)) {
      const y = 6.4 - d * 1.4; S.b[n.id] = msBox(n, y); const p = MSN[n.parent];
      S.e.push(bar(MSX(p), 6.4 - (d - 1) * 1.4 - 0.26, MSX(n), y + 0.26, GC.e, 0.035)); await wt(tok, 160);
    }
    cap(...[['62734 | 9518', '左邊 5 個、右邊 4 個'], ['627 | 34、95 | 18', '一樣，比較多的放左邊'], ['一直分下去', '直到每個端點只有一個數'], ['最後只剩 62 還沒分', '分成 6 和 2']][d - 1]);
  }),
  async (tok, S) => { // @301.7
    gone(S.c); S.c = pl('這棵 tree 叫 splitting tree', 0, -0.4); cap('這就是 splitting 的過程', '建出來的叫 splitting tree');
  },
  async (tok, S) => { // @321.7
    const internal = MSN.filter((n) => n.kids).length, leaves = MSN.filter((n) => !n.kids).length;
    ok(MSN.every((n) => !n.kids || n.kids.length === 2) && leaves === 9 && internal === leaves - 1, 0, -1.1, '每個 internal vertex 剛好 2 個 children：' + internal + ' 個 internal、' + leaves + ' 片葉子 ✓');
    cap('每次都分兩個：complete binary tree', '（Grimaldi 的用語：每個 internal 都有 2 個 children）');
  },
]);

function mgBox(id, c) { const n = MSN[id]; const y = 1.0 + n.depth * 1.4; return cube(MSR[id].out.join(' '), c || (n.kids ? GC.leaf : GC.sand), [msW(n), 0.52, 0.4], MSX(n), y, 0, 0.4); }
function mgEdge(id) { const n = MSN[id], p = MSN[n.parent]; return bar(MSX(n), 1.0 + n.depth * 1.4 - 0.26, MSX(p), 1.0 + p.depth * 1.4 + 0.26, GC.e, 0.035); }
async function mgNode(tok, S, id) { S.b[id] = mgBox(id); MSN[id].kids.forEach((k) => S.e.push(mgEdge(k))); await wt(tok, 200); }
const findN = (arr) => MSN.find((n) => n.a.join(' ') === arr.join(' ')).id;
scene('g8c-ms-merge', '25D：merge sort 第二步 merging', [
  async (tok, S) => { // @339.0
    hd('Merging：把兩個已經排好的 list 合成一個', 0, 7.3); S.b = {}; S.e = [];
    cap('第二部分：merging', '兩個排好的 sublist 合併');
  },
  async (tok, S) => { // @359.6
    MSN.filter((n) => !n.kids).forEach((n) => (S.b[n.id] = mgBox(n.id)));
    sm('merging tree：從葉子開始（每片葉子只有一個數，自然排好了）', 0, -0.2); cap('從 tree 的葉子開始 merge', '每個 leaf 只有一個數');
  },
  async (tok, S) => { // @381.2
    await mgNode(tok, S, findN([6, 2])); cap('6 和 2 merge', '變成 2 6');
  },
  async (tok, S) => { // @401.3
    S.cm = sm('2 6 和 7 merge：', -3.2, -0.8); cap('2 6 再跟 7 merge', '兩個 list 都排好了');
  },
  async (tok, S) => { // @430.0
    const id = findN([6, 2, 7]); const { s } = cmpPairs(MSR[findN([6, 2])].out, [7]);
    gone(S.cm); S.cm = pl('2 6 ＋ 7：' + s.join('，') + '，左邊空了 → 7 接到後面', 0, -0.8); await mgNode(tok, S, id);
    cap('兩個的第一個拿來比：2 比 7 小', '6 比 7 小；一邊空了就把剩下的接上');
  },
  async (tok, S) => { // @454.3
    S.rule = note('每次比兩個 list 的第一個（最小的），小的寫下來、拿掉；一邊空了，剩下的整段接到後面', 0, -1.5); cap('規則：每次比兩個 list 的最前面', '小的先出來');
  },
  async (tok, S) => { // @495.6
    for (const a of [[3, 4], [9, 5], [1, 8]]) await mgNode(tok, S, findN(a));
    cap('3 4 → 3 4；9 5 → 5 9；1 8 → 1 8', '一樣照做');
  },
  async (tok, S) => { // @526.4
    gone(S.rule); cap('每兩個端點再 merge 成一個', '上面兩個都已經排好');
  },
  async (tok, S) => { // @560.2
    const id = findN([6, 2, 7, 3, 4]); const { s, rest } = cmpPairs(MSR[findN([6, 2, 7])].out, MSR[findN([3, 4])].out);
    gone(S.cm); S.cm = pl('2 6 7 ＋ 3 4：' + s.join('，') + '，接上 ' + rest.join(' '), 0, -0.8); await mgNode(tok, S, id);
    cap('2 6 7 和 3 4：2、3、4 先下來', '右邊空了，6 7 直接接後面');
  },
  async (tok, S) => { // @601.3
    const id = findN([9, 5, 1, 8]); const { s, rest } = cmpPairs(MSR[findN([9, 5])].out, MSR[findN([1, 8])].out);
    S.cm2 = pl('5 9 ＋ 1 8：' + s.join('，') + '，接上 ' + rest.join(' '), 0, -1.4); await mgNode(tok, S, id);
    cap('5 9 和 1 8：1、5、8 先下來', '最後 9 接到後面');
  },
  async (tok, S) => { // @640.5
    const L = MSR[findN([6, 2, 7, 3, 4])].out, R = MSR[findN([9, 5, 1, 8])].out; const { s, rest } = cmpPairs(L, R);
    gone(S.cm, S.cm2); S.cm = sm(L.join(' ') + ' ＋ ' + R.join(' ') + '：' + s.join('，') + '，接上 ' + rest.join(' '), 0, -0.8);
    await mgNode(tok, S, 0);
    ok(sorted(MSR[0].out) && MSR[0].out.length === 9, 0, -1.4, '結果 ' + MSR[0].out.join(' ') + '；這一次 merge 比了 ' + s.length + ' 次 ✓');
    cap('最後 5 個和 4 個 merge', '排好：1 2 3 4 5 6 7 8 9');
  },
  async (tok, S) => { // @694.6
    S.sum = note('兩個 pass：splitting（切一半，兩邊最多差 1）→ merging（兩個排好的合成一個）', 0, -2.1); cap('經過兩個 pass', 'splitting 和 merging');
  },
  async (tok, S) => { // @799.0
    hot('下次：pseudocode 與比較次數（會比 n² 低）', 0, -2.8); cap('下次寫 pseudocode、算複雜度', '比較次數會比 n² 低');
  },
]);

// ════════ -1gpdgE3Tig（趙啟超 26A：merge sort pseudocode、Merge、最多比較次數） ════════
const MSC = ['procedure MergeSort(L = a₁, …, aₙ):', '  if n > 1:', '    m ← ⌈n/2⌉', '    L₁ ← a₁, …, aₘ；L₂ ← aₘ₊₁, …, aₙ', '    L₁ ← MergeSort(L₁)；L₂ ← MergeSort(L₂)', '    L ← Merge(L₁, L₂)'];
scene('g8c-ms-code', '26A：MergeSort 的 pseudocode（recursive）', [
  async (tok, S) => { // @4.0
    hd('Merge sort：splitting ＋ merging', 0, 7.3); cap('上次講 merge sort', '兩部分：splitting 和 merging');
  },
  async (tok, S) => { // @10.1
    S.code = code(MSC, -2.6, 6.4, 0.56); cap('看 merge sort 的 pseudocode', '後面還會呼叫一個 Merge');
  },
  async (tok, S) => { // @61.4
    S.code.hl(2); cap('splitting：一個 list 分成兩個', '奇數個時前面的多一個');
  },
  async (tok, S) => { // @86.0
    S.code.hl(3); const n = 7, m = Math.ceil(n / 2);
    S.r = Array.from({ length: n }, (_, i) => cube('a' + '₁₂₃₄₅₆₇'[i], i < m ? GC.leaf : GC.num, [0.62, 0.5, 0.4], -3.2 + i * 0.9 + (i >= m ? 0.6 : 0), 2.0, 0, 0.4));
    ok(m === 4, 0, 1.2, 'n = 7：m = ⌈7/2⌉ = ' + m + ' → L₁ = a₁…a₄、L₂ = a₅…a₇ ✓'); note('示意', 4.6, 2.0);
    cap('n = 7 時 m = 4', 'a₁ 到 a₄ 放 L₁，其餘放 L₂');
  },
  async (tok, S) => { // @114.0
    S.code.hl(5); cap('再 call Merge', '把兩個排好的 list 合成一個');
  },
  async (tok, S) => { // @136.3
    S.code.hl(4); cap('L₁、L₂ 要先排好', '所以再 call MergeSort 自己');
  },
  async (tok, S) => { // @146.3
    S.q = sm('call 自己：L₁（7 個裡的 4 個）又分成 2 ＋ 2，再分……', 0, 0.5); cap('call 自己：又分成兩半', '前面那一半就只剩四分之一');
  },
  async (tok, S) => { // @170.3
    S.code.hl(1); pl('一直分到 n = 1：只有一個就不做，直接回去', 0, -0.1); cap('分到 n = 1 為止', '只有一個時就直接回去');
  },
  async (tok, S) => { // @185.2
    S.code.hl(5); pl('兩邊各一個 → Merge；回到上一層，兩邊都排好了再 Merge……', 0, -0.7); cap('兩邊都只剩一個就 merge', '回上一層再 merge');
  },
  async (tok, S) => { // @213.5
    S.code.hl(-1); hot('整個是 recursive：分到底，再一路 merge 回來', 0, -1.4); cap('整個結構是 recursive', '全部回來就排好了');
  },
]);

const MGC = ['procedure Merge(L₁, L₂):', '  L ← 空的 list', '  while L₁、L₂ 都不空:', '    比兩個的第一個，較小的移到 L 右端', '  把剩下那個 list 全部接到 L 右端'];
scene('g8c-merge-code', '26A：Merge 兩個排好的 list', [
  async (tok, S) => { // @244.7
    S.code = code(MGC, -2.2, 6.6, 0.56); S.code.hl(0);
    S.L1 = [2, 6, 7]; S.L2 = [3, 4]; S.L = [];
    S.draw = () => { gone(S.cells); S.cells = [];
      S.L1.forEach((v, i) => S.cells.push(cube(v, GC.leaf, [0.6, 0.5, 0.4], -1.2 + i * 0.75, 3.2, 0, 0)));
      S.L2.forEach((v, i) => S.cells.push(cube(v, GC.num, [0.6, 0.5, 0.4], 3.0 + i * 0.75, 3.2, 0, 0)));
      S.L.forEach((v, i) => S.cells.push(cube(v, GC.tree, [0.6, 0.5, 0.4], -1.2 + i * 0.75, 1.8, 0, 0))); };
    sm('L₁', -2.3, 3.2); sm('L₂', 2.2, 3.2); sm('L', -2.3, 1.8); S.draw(); note('例：上次的 2 6 7 和 3 4', 4.4, 1.8);
    cap('Merge：兩個排好的 list 合成一個', '結果放在 L');
  },
  async (tok, S) => { // @262.4
    S.code.hl(1); cap('L 一開始是 empty list', '從空的開始放');
  },
  async (tok, S) => { // @300.0
    S.code.hl(2); cap('L₁、L₂ 兩個都不空時', '就執行 while loop');
  },
  async (tok, S) => { // @316.4
    S.code.hl(3); S.L.push(S.L1[0] <= S.L2[0] ? S.L1.shift() : S.L2.shift()); S.draw();
    cap('比兩個的第一個（最小的）', '2 比 3 小：2 放到 L 的右邊');
  },
  async (tok, S) => { // @357.5
    for (let i = 0; i < 2; i++) { S.L.push(S.L1[0] <= S.L2[0] ? S.L1.shift() : S.L2.shift()); S.draw(); await wt(tok, 400); }
    cap('再比：6 和 3 → 3；6 和 4 → 4', '最小的先進去，第二小的再進去');
  },
  async (tok, S) => { // @367.2
    S.code.hl(4); S.e = bad('L₂ 空了 → while 停', 3.4, 3.2); cap('有一個 list 變 empty 時', 'while 就停');
  },
  async (tok, S) => { // @377.6
    S.L.push(...S.L1, ...S.L2); S.L1 = []; S.L2 = []; S.draw();
    ok(sorted(S.L) && S.L.join(' ') === '2 3 4 6 7', 0, 0.9, '剩下的 6 7 比前面都大，整段接到後面：L = ' + S.L.join(' ') + ' ✓');
    cap('剩下的一定比已經放的都大', '全部一次接到 L 後面');
  },
  async (tok, S) => { // @414.2
    S.code.hl(-1); cap('這就是上次例子用嘴巴講的做法', '寫成 pseudocode 就是這樣');
  },
]);

// worst case of Merge: brute force over every interleaving of two sorted lists of sizes n1, n2
function worstMerge(n1, n2) {
  let best = 0; const N = n1 + n2;
  for (let mask = 0; mask < 1 << N; mask++) {
    let c1 = 0; for (let i = 0; i < N; i++) if (mask & (1 << i)) c1++;
    if (c1 !== n1) continue;
    const A = [], B = []; for (let i = 0; i < N; i++) (mask & (1 << i) ? A : B).push(i);
    best = Math.max(best, mergeLog(A, B).comps);
  }
  return best;
}
scene('g8c-merge-worst', '26A：Merge 最多要比幾次？n₁ + n₂ − 1', [
  async (tok, S) => { // @437.0
    hd('複雜度：跟 bubble sort、insertion sort 比', 0, 7.3); cap('來算 merge sort 的複雜度', '跟以前兩個 sorting 比一比');
  },
  async (tok, S) => { // @453.1
    pl('算 comparison 的數目，看 worst case（最多要比幾次）', 0, 6.4); cap('比的是 comparison 的數目', '看 worst case');
  },
  async (tok, S) => { // @497.1
    pl('comparison 只發生在 Merge 裡：「兩個第一個元素哪個小」', 0, 5.6); cap('比較都發生在 Merge 裡', '要比過才知道哪個 smaller');
  },
  async (tok, S) => { // @523.0
    pl('L₁ 有 n₁ 個、L₂ 有 n₂ 個（都已排好）', 0, 4.8); cap('L₁ 有 n₁ 個、L₂ 有 n₂ 個', '兩個都已經 sorted');
  },
  async (tok, S) => { // @569.0
    pl('最差：一直比到最後一個才有一邊空', 0, 4.0); cap('最差就是要比到最後', '不能中途就有一邊空掉');
  },
  async (tok, S) => { // @587.0
    ok(worstMerge(1, 1) === 1 && worstMerge(2, 1) === 2, 0, 3.2, '各 1 個：比 1 次；2 個和 1 個：最多比 2 次 ✓'); cap('各一個：比一次就好', '兩個和一個：最多比兩次');
  },
  async (tok, S) => { // @604.3
    pl('每比一次就少一個；剩最後一個就不用比 → n₁ + n₂ − 1', 0, 2.4); cap('每比一次少一個', '剩一個時不用比：n₁ + n₂ − 1');
  },
  async (tok, S) => { // @633.0
    let allOk = true; const rows = [];
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) if (worstMerge(a, b) !== a + b - 1) allOk = false;
    for (const [a, b] of [[2, 2], [3, 2], [4, 4]]) rows.push(a + '、' + b + ' → ' + worstMerge(a, b));
    ok(allOk, 0, 1.4, 'Merge 最多用 n₁ + n₂ − 1 次比較（窮舉 n₁, n₂ ≤ 4 全對）✓'); sm('例：' + rows.join('；'), 0, 0.7);
    cap('at most n₁ + n₂ − 1 次比較', '才能 merge 出排好的 list');
  },
]);

const H3 = 3;
function lvTree(S, h) {
  const n = 2 ** h, xs = (i, k) => { const w = 2 ** (h - k); const lo = i * w; return -4.55 + (lo + (w - 1) / 2) * 1.3; };
  S.lv = []; S.lvn = [];
  for (let k = 0; k <= h; k++) {
    const y = 6.3 - k * 1.5, cnt = 2 ** k;
    S.lvn[k] = Array.from({ length: cnt }, (_, i) => cube(String(2 ** (h - k)), k === h ? GC.leaf : GC.sand, [Math.min(1.1, 0.5 + 0.12 * (h - k) * 2), 0.5, 0.4], xs(i, k), y, 0, 0));
    if (k) S.lvn[k].forEach((m, i) => S.lv.push(bar(xs(Math.floor(i / 2), k - 1), y + 1.5 - 0.25, xs(i, k), y + 0.25, GC.e, 0.03)));
  }
}
scene('g8c-ms-levels', '26A：n = 2ʰ 時 splitting tree 每層的數量', [
  async (tok, S) => { // @645.0
    hd('假設 n = 2ʰ（比較好算；不是 2 的次方，Big-O 一樣）', 0, 7.3); cap('假設 n 剛好是 2 的 h 次方', '取 Big-O 時沒差別');
  },
  async (tok, S) => { // @691.4
    lvTree(S, H3); note('示意：h = 3、n = 8（方塊上是那個 list 的元素個數）', 0, 1.0); cap('用 splitting tree 的觀點來看', '方塊裡寫元素個數');
  },
  async (tok, S) => { // @714.7
    S.lvn[0].forEach((m) => glow(m, HL)); S.lvn[1].forEach((m) => glow(m, HL));
    cap('一開始 2ʰ 個，分成兩半', '每個 2ʰ⁻¹ 個');
  },
  async (tok, S) => { // @775.5
    S.lvn.flat().forEach((m) => glow(m, null));
    for (let k = 0; k <= H3; k++) sm('level ' + (k === H3 ? 'h = ' + k : k), -6.3, 6.3 - k * 1.5);
    cap('標出 level：0、1、…、k、…、h', '最後到 level h');
  },
  async (tok, S) => { // @800.4
    for (let k = 0; k <= H3; k++) sm('2ʰ⁻' + k + ' = ' + 2 ** (H3 - k) + ' 個', 6.0, 6.3 - k * 1.5);
    const okk = S.lvn.every((ns, k) => ns.length === 2 ** k && ns.length * 2 ** (H3 - k) === 2 ** H3);
    ok(okk, 0, 0.4, 'level k：2ᵏ 個端點、每個 2ʰ⁻ᵏ 個元素 ✓'); cap('level k：每個端點有 2ʰ⁻ᵏ 個元素', 'level 1 是 2ʰ⁻¹');
  },
  async (tok, S) => { // @842.4
    S.lvn[H3].forEach((m) => glow(m, HL)); cap('level h：每個只有 2⁰ = 1 個元素', '就是葉子');
  },
  async (tok, S) => { // @858.2
    S.lvn.flat().forEach((m) => glow(m, null)); S.lvn[1].forEach((m) => glow(m, HL));
    pl('同一個 parent 的兩個叫一對（pair）：level 1 有 2⁰ = 1 對', 0, -0.2); cap('兩個一組叫一對', 'level 1 只有一對');
  },
  async (tok, S) => { // @903.4
    S.lvn[1].forEach((m) => glow(m, null)); S.lvn[H3].forEach((m) => glow(m, HL));
    const pairs = S.lvn[H3].length / 2;
    ok(pairs === 2 ** (H3 - 1), 0, -0.8, 'level k 有 2ᵏ⁻¹ 對；level h：2ʰ⁻¹ = ' + pairs + ' 對（共 2ʰ = 8 片葉子）✓'); cap('level k 有 2ᵏ⁻¹ 對', '最後一層有 2ʰ⁻¹ 對');
  },
  async (tok, S) => { // @918.4
    hot('level h：每對各 1 個 → 1 + 1 − 1 = 1 次比較', 0, -1.4); cap('先看最後一層：每對比一次', '1 + 1 − 1 = 1');
  },
  async (tok, S) => { // @942.4
    ok(2 ** (H3 - 1) * 1 === 4, 0, -2.0, 'level h 共 2ʰ⁻¹ × 1 = ' + 2 ** (H3 - 1) + ' 次比較 ✓'); cap('有 2ʰ⁻¹ 對，每對 1 次', 'merge 回來要 2ʰ⁻¹ 次比較');
  },
]);

// ════════ _ArgZzfH7aw（趙啟超 26B：merge sort 的 worst case n log n、shortest path、principle of optimality） ════════
const lvlComp = (h, k) => 2 ** (k - 1) * (2 ** (h - k) + 2 ** (h - k) - 1);   // pairs × (n1 + n2 − 1)
const totComp = (h) => { let s = 0; for (let k = 1; k <= h; k++) s += lvlComp(h, k); return s; };
const Wrec = (n) => (n <= 1 ? 0 : Wrec(Math.ceil(n / 2)) + Wrec(Math.floor(n / 2)) + n - 1);   // worst-case merge sort recurrence
scene('g8c-ms-count', '26B：merge sort 最多比較次數 = n log₂ n − n + 1', [
  async (tok, S) => { // @4.0
    hd('每一層 merge 回來要比幾次？', 0, 7.3); pl('level h：2ʰ⁻¹ 對，每對兩個 sublist 各 2⁰ 個元素', 0, 6.5); cap('先看 level h', '2ʰ⁻¹ 對，每片葉子一個元素');
  },
  async (tok, S) => { // @68.7
    pl('每對最多：2⁰ + 2⁰ − 1 = 2¹ − 1 = 1 次', 0, 5.8); cap('每對最多 n₁ + n₂ − 1', '2⁰ + 2⁰ − 1 = 2¹ − 1');
  },
  async (tok, S) => { // @124.4
    ok(2 ** (H3 - 1) * (2 - 1) === 2 ** H3 - 2 ** (H3 - 1), 0, 5.1, 'level h：2ʰ⁻¹ ·（2¹ − 1）= 2ʰ − 2ʰ⁻¹ ✓（h = 3：4）'); cap('乘開：2ʰ − 2ʰ⁻¹ 次', '這是最下面一層');
  },
  async (tok, S) => { // @176.0
    pl('一般的 level k（k = 1, …, h）', 0, 4.3); cap('再算一般的 level k', 'k 從 1 到 h');
  },
  async (tok, S) => { // @214.6
    pl('每對兩個 sublist 各 2ʰ⁻ᵏ 個 → 每對最多 2ʰ⁻ᵏ⁺¹ − 1 次', 0, 3.6); cap('每對各 2ʰ⁻ᵏ 個元素', '加起來減 1：2ʰ⁻ᵏ⁺¹ − 1');
  },
  async (tok, S) => { // @243.0
    let okk = true; for (let h = 1; h <= 6; h++) for (let k = 1; k <= h; k++) if (lvlComp(h, k) !== 2 ** h - 2 ** (k - 1)) okk = false;
    ok(okk, 0, 2.9, '× 2ᵏ⁻¹ 對 = 2ʰ − 2ᵏ⁻¹ 次 ✓'); cap('乘上 2ᵏ⁻¹ 對', '指數消掉：2ʰ − 2ᵏ⁻¹');
  },
  async (tok, S) => { // @368.0
    pl('全部 = Σₖ₌₁ʰ（2ʰ − 2ᵏ⁻¹）', 0, 2.1);
    S.tb = [1, 2, 3].map((k) => sm('h = 3、level ' + k + '：' + 2 ** (k - 1) + ' 對 × ' + (2 ** (3 - k + 1) - 1) + ' = ' + lvlComp(3, k), 4.6, 1.4 - (k - 1) * 0.55));
    cap('每一層加起來', '全部 merge 回一個端點就完成');
  },
  async (tok, S) => { // @428.0
    pl('= h · 2ʰ −（1 + 2 + … + 2ʰ⁻¹）', -2.0, 1.3); cap('拆成兩塊算', '前面是 h 個 2ʰ');
  },
  async (tok, S) => { // @484.0
    let okk = true; for (let h = 1; h <= 10; h++) if (totComp(h) !== h * 2 ** h - (2 ** h - 1)) okk = false;
    ok(okk, -2.0, 0.6, '等比級數 = 2ʰ − 1 → h·2ʰ − 2ʰ + 1 ✓'); ok(totComp(3) === 17, 4.6, -0.3, 'h = 3：7 + 6 + 4 = 17 ✓');
    cap('後面是等比級數：2ʰ − 1', '總共 h·2ʰ − 2ʰ + 1');
  },
  async (tok, S) => { // @497.0
    let okk = true; for (let h = 1; h <= 10; h++) { const n = 2 ** h; if (n * Math.log2(n) - n + 1 !== Wrec(n)) okk = false; }
    ok(okk, -1.6, -0.3, 'n = 2ʰ、h = log₂ n：n log₂ n − n + 1 ✓'); cap('把 2ʰ 換成 n', 'h 就是 log₂ n');
  },
  async (tok, S) => { // @548.0
    fresh(CAM[0], CAM[1]); hd('Merge sort：最多 n log₂ n − n + 1 次比較', 0, 7.3); hot('worst-case comparisons = O(n log n)', 0, 6.3); cap('n 很大時 n log n 最大', '所以是 O(n log n)');
  },
  async (tok, S) => { // @603.0
    sm('log 的底寫不寫都一樣：換底只差一個常數倍', 0, 5.4); cap('log 用哪個底都沒關係', '換底只乘一個常數');
  },
  async (tok, S) => { // @632.0
    const r = [10, 100, 1000].map((n) => (n * Math.log2(n)) / (n * n));
    ok(r[0] > r[1] && r[1] > r[2], 0, 4.5, 'bubble、insertion：O(n²)；n log n / n²：' + r.map((x) => x.toFixed(3)).join(' → ') + ' → 0 ✓'); cap('bubble、insertion 都是 O(n²)', 'n log n 長得慢很多');
  },
  async (tok, S) => { // @715.7
    note('每一層的比較：2ʰ − 2ᵏ⁻¹ < n → 每層 O(n)', 0, 3.4); cap('為什麼？每一層都是 O(n)', '這是用 tree 來做的好處');
  },
  async (tok, S) => { // @766.1
    good('但只有 log₂ n 層 → O(n) × log n = O(n log n)', 0, 2.5); cap('tree 的高度只有 log n', '所以總共 n log n');
  },
]);

// 老師的加權圖：AD 7、DC 2、CB 5、BF 8、DF 5、CE 4 是口述的；AB、AC、BE、EF 的數字位置看不到（示意）
const WG = { pos: { A: [-5.5, 3.6], B: [-1.8, 6.2], C: [-1.8, 3.6], D: [-1.8, 1.2], E: [1.8, 3.2], F: [5.5, 3.6] },
  es: [['A', 'B', 3], ['A', 'C', 9], ['A', 'D', 7], ['B', 'C', 5], ['C', 'D', 2], ['C', 'E', 4], ['B', 'E', 6], ['B', 'F', 8], ['E', 'F', 1], ['D', 'F', 5]],
  guess: ['A|B', 'A|C', 'B|E', 'E|F'] };
const wOf = (a, b) => { const e = WG.es.find(([p, q]) => (p === a && q === b) || (p === b && q === a)); return e ? e[2] : Infinity; };
const pathW = (p) => p.slice(1).reduce((s, v, i) => s + wOf(p[i], v), 0);
function drawWG(S, weights = true) {
  S.g = mkGraph(WG.pos); Object.keys(WG.pos).forEach((v) => S.g.v(v)); WG.es.forEach(([a, b, w]) => S.g.e(a, b, weights ? w : undefined));
  if (weights) WG.guess.forEach((k) => S.g.W[k] && (S.g.W[k].element.className = 'lab-label note'));
}
scene('g8c-sp-setup', '26B：shortest path problem 的設定', [
  async (tok, S) => { // @814.5
    hd('Graph 的 optimization 問題', 0, 7.3); cap('接下來講 graph 的 optimization 問題', '最佳化');
  },
  async (tok, S) => { // @818.8
    hot('第一個：shortest path problem（最短路徑）', 0, 6.6); cap('第一個：shortest path problem', '最短路徑問題');
  },
  async (tok, S) => { // @866.0
    pl('給一個 undirected connected simple graph', 0, 5.8); cap('給一個沒有方向、connected 的 simple graph', '任兩點之間至少有一條 path');
  },
  async (tok, S) => { // @888.0
    pl('每個 edge 上有一個 weight，而且都 > 0', 0, 5.1); cap('每個 edge 上有一個 weight', '都是大於 0 的數');
  },
  async (tok, S) => { // @929.0
    pl('{u, v} ∈ E：weight 記成 w(u, v) > 0', 0, 4.4); cap('edge {u, v} 的 weight 記成 w(u, v)', '是 positive 的');
  },
  async (tok, S) => { // @945.4
    pl('沒有這條邊：w(u, v) = ∞（找最小時一定不會選到）', 0, 3.7); cap('沒有邊就把 weight 設成無限大', '找最小的時候就不會選到');
  },
  async (tok, S) => { // @992.0
    fresh(CAM[0], CAM[1]); hd('例：weighted simple graph', 0, 7.3); drawWG(S, false); cap('舉個例子：一個 connected simple graph', '六個端點 A 到 F');
  },
  async (tok, S) => { // @1008.0
    WG.es.forEach(([a, b, w]) => { const [x1, y1] = WG.pos[a], [x2, y2] = WG.pos[b]; const l = tag(String(w), WG.guess.includes(S.g.k(a, b)) ? 'note' : 'idx', (x1 + x2) / 2 + 0.22, (y1 + y2) / 2 + 0.22); S.g.list.push(l); });
    note('黃色數字：位置示意', 5.0, 6.4); cap('每個 edge 加一個 weight', '變成 weighted simple graph');
  },
  async (tok, S) => { // @1025.0
    S.g.pe('B', 'C', GC.hot, 2.4); S.g.pe('C', 'E', GC.hot, 2.4);
    ok(wOf('B', 'C') === 5 && wOf('C', 'E') === 4, 0, 0.3, 'w(B, C) = 5、w(C, E) = 4 ✓'); cap('例如 BC 這條邊 weight 是 5', 'CE 是 4');
  },
]);

scene('g8c-sp-path', '26B：path 的 weight', [
  async (tok, S) => { // @1052.6
    drawWG(S); note('黃色數字：位置示意', 5.0, 6.4); hd('path 的 weight', 0, 7.3); cap('有了 edge weight', '就能定義一條 path 的 weight');
  },
  async (tok, S) => { // @1084.6
    pl('path 的 weight = 它經過的 edge 的 weight 加起來', 0, 0.4); cap('把 path 上每個 edge 的 weight 加起來', 'sum of the weights of its edges');
  },
  async (tok, S) => { // @1123.0
    const p = ['A', 'D', 'C', 'B', 'F']; for (let i = 1; i < p.length; i++) { S.g.pe(p[i - 1], p[i], GC.hot, 2.6); await wt(tok, 250); }
    cap('例：path A D C B F', '講出端點順序就知道路徑');
  },
  async (tok, S) => { // @1143.1
    S.b1 = pl('w(A,D) + w(D,C) + w(C,B) + w(B,F)', 0, -0.2); cap('weight = AD + DC + CB + BF', '對應的邊加起來');
  },
  async (tok, S) => { // @1173.1
    const w = pathW(['A', 'D', 'C', 'B', 'F']);
    S.b2 = ok(w === 22, 0, -0.8, '= 7 + 2 + 5 + 8 = ' + w + ' ✓'); cap('7 + 2 + 5 + 8 = 22', '這條 A 到 F 的 path weight 是 22');
  },
  async (tok, S) => { // @1192.2
    WG.es.forEach(([a, b]) => S.g.pe(a, b, GC.e)); S.g.pe('A', 'D', GC.blue, 2.6); S.g.pe('D', 'F', GC.blue, 2.6);
    const w = pathW(['A', 'D', 'F']); S.b3 = ok(w === 12 && w < 22, 0, -1.4, 'A D F：7 + 5 = ' + w + '，比 22 小 ✓'); cap('A 到 F 不止一條：A D F', 'weight 12，比較小');
  },
  async (tok, S) => { // @1213.0
    S.b4 = sm('還有 A C E F、A B E F……很多條', 0, -2.0); cap('A C E F、A B E F 也都是 path', '到 F 有很多很多條');
  },
  async (tok, S) => { // @1223.2
    WG.es.forEach(([a, b]) => S.g.pe(a, b, GC.e)); gone(S.b1, S.b2, S.b3, S.b4); hot('要找：從某點到另一點、weight 最小的 path', 0, -0.4); cap('找所有 path 裡 weight 最小的', '這就是 shortest path problem');
  },
  async (tok, S) => { // @1288.5
    sm('weight 可想成距離，或應用裡的某種 metric', 0, -1.1); cap('weight 想成距離就是最短路徑', '也可以是其他的量');
  },
]);

scene('g8c-sp-opt', '26B：principle of optimality', [
  async (tok, S) => { // @1309.4
    hd('怎麼找？有一個原理', 0, 7.3); cap('怎麼找最短路徑？', '有一個很好理解的原理');
  },
  async (tok, S) => { // @1342.4
    pl('笨方法：把所有 path 都找出來一一比 → path 太多，複雜度很大', 0, 6.5); cap('最佳化問題：全部找出來比一比？', 'path 數有限但可能非常多');
  },
  async (tok, S) => { // @1378.6
    hot('Principle of optimality', 0, 5.7); cap('用 principle of optimality', '把複雜度降下來');
  },
  async (tok, S) => { // @1406.1
    S.p = { A: [-5.5, 3.0], C: [0, 3.6], B: [5.5, 3.0] };
    S.vA = cube('A', GC.in, [0.62, 0.56, 0.4], -5.5, 3.0, 0, 0); S.vC = cube('C', GC.v, [0.62, 0.56, 0.4], 0, 3.6, 0, 0); S.vB = cube('B', GC.pink, [0.62, 0.56, 0.4], 5.5, 3.0, 0, 0);
    S.e1 = bar(-5.5, 3.0, 0, 3.6, GC.tree, 0.09); S.e2 = bar(0, 3.6, 5.5, 3.0, GC.tree, 0.09);
    sm('P：A 到 B 的 shortest path，經過中間某點 C', 0, 4.5); cap('P 是 A 到 B 的最短路徑', '中間經過某一點 C');
  },
  async (tok, S) => { // @1437.1
    sm('P₁（A → C）', -2.8, 2.7); sm('P₂（C → B）', 2.8, 2.7); paint(S.e2, GC.blue);
    S.n1 = note('示意：w(P₁) = 10、w(P₂) = 8、w(P) = 18', 0, 1.7); cap('P 分成兩段：P₁ 是 A 到 C', 'P₂ 是 C 到 B');
  },
  async (tok, S) => { // @1532.4
    pl('Claim：P₁ 一定是 A 到 C 所有 path 裡最短的', 0, 1.0); cap('P₁ 一定是 A 到 C 最短的那條', 'C 是中間任何一點都成立');
  },
  async (tok, S) => { // @1625.6
    S.alt = [bar(-5.5, 3.0, -2.8, 5.6, GC.hot, 0.05), bar(-2.8, 5.6, 0, 3.6, GC.hot, 0.05)]; sm("P₁′（假設更短，示意 7）", -3.6, 6.1);
    cap("反證：假設有另一條 P₁′ 比 P₁ 短", '到 C 為什麼要走 P₁？');
  },
  async (tok, S) => { // @1691.0
    const P = 10 + 8, P2 = 7 + 8;
    ok(P2 < P, 0, 0.3, "P₁′ + P₂ = 7 + 8 = " + P2 + " < " + P + " = w(P) → 和「P 最短」矛盾 ✓"); cap("走 P₁′ 再接 P₂ 就比 P 短", '跟 P 最短的假設矛盾');
  },
  async (tok, S) => { // @1753.7
    bub('台北 → 新竹的最短路經過桃園：台北到桃園那段也一定最短', 0, -0.5); cap('像台北到新竹經過桃園', '台北到桃園那段也一定是最短的');
  },
  async (tok, S) => { // @1784.0
    good('到中間點只要留最短的那條，其他都可以丟掉 → 複雜度降很多', 0, -1.2); cap('到中間點只留最短的那條', '其他不可能是最短路徑的一部分');
  },
  async (tok, S) => { // @1816.5
    hot('下次：Dijkstra algorithm 就是用這個原理', 0, -1.9); cap('下次介紹 Dijkstra algorithm', '它就是用這個原理');
  },
]);
  }

  // ═══ g8d.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, showL } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第27A–28B講 Shortest path／Minimal spanning tree）— cued scenes ───
// 老師的例子圖 G：6 個端點 A–F、10 條邊。26B 口述的 weight「3 9 7 5 2 4 6 8 1 5」對應 AB AC AD BC CD CE BE BF EF DF，
// 而且 26B 的 ADCBF = 22、ADF = 12，27B 每一輪的 L 值，27C／28A 的 Prim／Kruskal 每一步都和這組邊相符。端點擺放位置是示意。
// Dijkstra 的每個 label、Prim／Kruskal 每一步的候選邊與選擇、total weight 都由程式在這張圖上算出來，
// 再和老師口述的數字比對，另外用「列舉所有 path／所有 spanning tree」驗算，畫面顯示 ✓／✘。
// 27A 的抽象講解用的 H6、兩個 correctness 證明用的 K 是自己設計的示意小圖（畫面標「示意」），數字一樣由程式算。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
const TC = { node: '#cdbfa6', edge: '#9c8b70', faint: '#e4dccd', a: '#4b9ee2', b: '#e55a9b', hot: '#d64545', gold: '#c08a1f', green: '#2fc092', yel: '#e9c53a', purple: '#9b7ef4', orange: '#dd8238' };
// a scene = a list of step functions; each runs when the video reaches its cue.
// o.pre: functions run silently first (to rebuild the state a later section starts from).
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of o.pre || []) await f(tok, S, true);
    for (const f of steps) { await step(tok); await f(tok, S, false); }
  }]);
}

// ── 3D 小零件 ──
const NG = new THREE.SphereGeometry(0.3, 18, 12);
const CG = new THREE.CylinderGeometry(1, 1, 1, 8);
function seg(x1, y1, x2, y2, c = TC.edge, r = 0.05, z = -0.03) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.max(0.02, Math.hypot(dx, dy));
  const m = new THREE.Mesh(CG, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  m.scale.set(r, L, r); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  lab.world.add(m); return m;
}
function dash(pts, c = TC.hot, r = 0.045) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; const L = Math.hypot(x2 - x1, y2 - y1), k = Math.max(2, Math.round(L / 0.25));
    for (let j = 0; j < k; j += 2) { const a = j / k, b = Math.min(1, (j + 1) / k); out.push(seg(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, c, r, 0.02)); }
  }
  return out;
}
function blob(x, y, rx, ry, c, op = 0.22, rot = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
  m.scale.set(rx, ry, 1); m.position.set(x, y, -0.2); m.rotation.z = rot; lab.world.add(m); return m;
}
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const en = (e) => e[0] + e[1];
// weighted graph drawn in the picture plane. E = [[u, v, w], …]
function mkG(Pm, E, o = {}) {
  const s = o.s || 1, dx = o.dx || 0, dy = o.dy || 0, er = o.er || 0.05;
  const g = { V: {}, E: {}, W: {}, P: {}, ex: [] };
  for (const n of Object.keys(Pm)) {
    const X = Pm[n][0] * s + dx, Y = Pm[n][1] * s + dy; g.P[n] = [X, Y];
    const m = new THREE.Mesh(NG, new THREE.MeshStandardMaterial({ color: TC.node, roughness: 0.5 }));
    m.scale.setScalar(o.r || 1); m.position.set(X, Y, 0); lab.world.add(m);
    m.add(lab.label(o.nm ? o.nm(n) : n, 'val')); g.V[n] = m;
  }
  for (const [u, v, w] of E) {
    if (o.only && !o.only.some((e) => key(e[0], e[1]) === key(u, v))) continue;
    const [x1, y1] = g.P[u], [x2, y2] = g.P[v];
    g.E[key(u, v)] = seg(x1, y1, x2, y2, TC.edge, er);
    if (w != null && o.weights !== false) {
      const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L, ny = (x2 - x1) / L, off = (o.off ?? 0.3) * (o.flip && o.flip.includes(u + v) ? -1 : 1);
      g.W[key(u, v)] = pl(String(w), (x1 + x2) / 2 + nx * off, (y1 + y2) / 2 + ny * off, 0.05);
    }
  }
  g.ecol = (u, v, c, thick) => { const e = g.E[key(u, v)]; if (!e) return; e.material.color.set(c); const r = thick ? er * 2.2 : er; e.scale.x = r; e.scale.z = r; };
  g.vcol = (n, c, gl) => { g.V[n].material.color.set(c); glow(g.V[n], gl || '#000000'); };
  g.reset = () => { for (const k of Object.keys(g.E)) { const [u, v] = k.split('|'); g.ecol(u, v, TC.edge, false); } };
  g.all = () => [...Object.values(g.V), ...Object.values(g.E), ...Object.values(g.W), ...g.ex];
  return g;
}
function paintPath(g, pth, c) { for (let k = 0; k + 1 < pth.length; k++) g.ecol(pth[k], pth[k + 1], c, true); }

// ── 圖的計算（全部在畫面上的圖上算） ──
const fmt = (x) => (x === Infinity ? '∞' : String(x));
const sum = (E) => E.reduce((s, e) => s + e[2], 0);
function wOf(E, u, v) { for (const [a, b, w] of E) if ((a === u && b === v) || (a === v && b === u)) return w; return Infinity; }
function dsu(V) { const p = {}; V.forEach((v) => (p[v] = v)); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x]))); return { f, u(a, b) { a = f(a); b = f(b); if (a === b) return false; p[a] = b; return true; } }; }
function dijkstra(names, E, s) {
  const L = {}, pre = {}; names.forEach((n) => { L[n] = Infinity; pre[n] = null; }); L[s] = 0;
  const S = [], it = [];
  while (S.length < names.length) {
    const out = names.filter((n) => !S.includes(n)); let u = out[0]; for (const n of out) if (L[n] < L[u]) u = n;
    const Lbefore = { ...L }; S.push(u); const ch = [];
    for (const v of names) if (!S.includes(v)) { const w = wOf(E, u, v), old = L[v], cand = L[u] + w, upd = old > cand; ch.push({ v, old, w, cand, upd }); if (upd) { L[v] = cand; pre[v] = u; } }
    it.push({ u, Lu: L[u], out, Lbefore, ch, L: { ...L }, pre: { ...pre }, S: S.slice() });
  }
  return { L, pre, it };
}
function minPaths(names, E, a) {   // brute force: min weight over ALL simple paths from a
  const best = {}; names.forEach((n) => (best[n] = Infinity));
  const go = (v, seen, w) => { if (w < best[v]) best[v] = w; for (const [x, y, ww] of E) { const nb = x === v ? y : y === v ? x : null; if (nb && !seen.has(nb)) { seen.add(nb); go(nb, seen, w + ww); seen.delete(nb); } } };
  go(a, new Set([a]), 0); return best;
}
function back(pre, v) { const p = [v]; while (pre[p[0]]) p.unshift(pre[p[0]]); return p; }
const preEdges = (E, pre) => Object.keys(pre).filter((v) => pre[v]).map((v) => [pre[v], v, wOf(E, pre[v], v)]);
function isST(names, es) { if (es.length !== names.length - 1) return false; const d = dsu(names); return es.every(([u, v]) => d.u(u, v)); }
function allST(names, E) { const k = names.length - 1, out = []; const rec = (i, pick) => { if (pick.length === k) { if (isST(names, pick)) out.push(pick.slice()); return; } if (i >= E.length || pick.length + E.length - i < k) return; pick.push(E[i]); rec(i + 1, pick); pick.pop(); rec(i + 1, pick); }; rec(0, []); return out; }
function treePath(es, a, b) {
  const A = {}; es.forEach(([u, v]) => { (A[u] = A[u] || []).push(v); (A[v] = A[v] || []).push(u); });
  const par = { [a]: null }, q = [a]; while (q.length) { const x = q.shift(); for (const y of A[x] || []) if (!(y in par)) { par[y] = x; q.push(y); } }
  if (!(b in par)) return null; const p = [b]; while (par[p[0]] != null) p.unshift(par[p[0]]); return p;
}
function prim(names, E, r) {
  const T = [r], es = [], steps = [];
  while (T.length < names.length) {
    const cand = E.filter(([u, v]) => T.includes(u) !== T.includes(v)); let best = cand[0]; for (const c of cand) if (c[2] < best[2]) best = c;
    steps.push({ T: T.slice(), cand, e: best }); es.push(best); T.push(T.includes(best[0]) ? best[1] : best[0]);
  }
  return { es, steps, T };
}
function kruskal(names, order) {
  const d = dsu(names), acc = [], log = [];
  for (const e of order) { if (acc.length === names.length - 1) break; const cyc = d.f(e[0]) === d.f(e[1]); log.push({ e, ok: !cyc, path: cyc ? treePath(acc, e[0], e[1]) : null }); if (!cyc) { d.u(e[0], e[1]); acc.push(e); } }
  return { acc, log };
}
function compCount(es) { const vs = [...new Set(es.flatMap((e) => [e[0], e[1]]))]; const d = dsu(vs); es.forEach((e) => d.u(e[0], e[1])); return new Set(vs.map(d.f)).size; }
function cycleEdges(pth) { const out = []; for (let k = 0; k + 1 < pth.length; k++) out.push([pth[k], pth[k + 1]]); return out; }

// ── 老師的例子圖 G（A–F，10 條邊） ──
const GP = { A: [-6.3, 3.4], B: [-3.8, 6.0], C: [-4.0, 3.4], D: [-3.8, 0.8], E: [-2.3, 3.8], F: [-0.6, 3.0] };
const GE = [['A', 'B', 3], ['A', 'C', 9], ['A', 'D', 7], ['B', 'C', 5], ['B', 'E', 6], ['B', 'F', 8], ['C', 'D', 2], ['C', 'E', 4], ['D', 'F', 5], ['E', 'F', 1]];
const GN = Object.keys(GP);
const GFLIP = ['AC', 'CD', 'CE'];
const gG = (o = {}) => mkG(GP, GE, Object.assign({ flip: GFLIP }, o));
const DJ = dijkstra(GN, GE, 'A');
const SAID_L = { A: 0, B: 3, C: 8, D: 7, E: 9, F: 10 }, SAID_P = { A: null, B: 'A', C: 'B', D: 'A', E: 'B', F: 'E' };
const DJ_OK = GN.every((n) => DJ.L[n] === SAID_L[n] && DJ.pre[n] === SAID_P[n]);
const BRUTE = minPaths(GN, GE, 'A');
const BRUTE_OK = GN.every((n) => BRUTE[n] === DJ.L[n]);
const PR = prim(GN, GE, 'A'), PR_W = sum(PR.es);
const KR_ORDER = ['EF', 'CD', 'AB', 'CE', 'DF', 'BC', 'BE', 'AD', 'BF', 'AC'].map((nm) => GE.find((e) => en(e) === nm));
const KR_SORTED = KR_ORDER.every((e, i) => e && (!i || KR_ORDER[i - 1][2] <= e[2])) && new Set(KR_ORDER).size === GE.length;
const KR = kruskal(GN, KR_ORDER), KR_W = sum(KR.acc);
const STS = allST(GN, GE), MST_W = Math.min(...STS.map(sum)), MST_N = STS.filter((t) => sum(t) === MST_W).length;
const pathW = (p) => cycleEdges(p).reduce((s, [u, v]) => s + wOf(GE, u, v), 0);

// ── Dijkstra 表格（右邊）：每列 = 一個端點的 label (L, 前一點) ──
const TX = 1.0, TY = 5.7, TDY = 0.66;
const rowS = (n, L, p) => n + '：(' + fmt(L) + ', ' + (p || '–') + ')';
function mkTab(S, names, x = TX, y = TY) {
  S.head = sm('label = (L 值, 前一個端點)', x + 0.6, y + 0.72);
  S.rows = {}; S.L = {}; S.pre = {};
  names.forEach((n, i) => { S.L[n] = Infinity; S.pre[n] = null; S.rows[n] = pl(rowS(n, Infinity, null), x, y - i * TDY); });
  S.setRow = (n, L, p) => { S.L[n] = L; S.pre[n] = p; txt(S.rows[n], rowS(n, L, p)); };
}
function paintPre(S, E) { S.g.reset(); preEdges(E, S.pre).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); }

// ════════ Kj2w3kDGWBc（趙啟超 27A：shortest path、principle of optimality、Dijkstra 的設定與想法） ════════
// H6：講抽象步驟用的示意圖（v1 連到 v3、v5、v6，和老師「隨便寫 V3 V5 V6」一致）
const HP = { 1: [-6.2, 3.5], 2: [-2.4, 5.8], 3: [-4.4, 5.4], 4: [-0.8, 2.6], 5: [-3.5, 3.1], 6: [-4.8, 1.0] };
const HE = [['1', '3', 2], ['1', '5', 6], ['1', '6', 4], ['3', '2', 3], ['3', '5', 1], ['2', '4', 7], ['5', '4', 2], ['6', '4', 5]];
const HN = Object.keys(HP);
const vn = (n) => 'v' + n;
const gH = (o = {}) => mkG(HP, HE, Object.assign({ nm: vn }, o));
const HD = dijkstra(HN, HE, '1');
const HB = minPaths(HN, HE, '1');
const HD_OK = HN.every((n) => HB[n] === HD.L[n]);
const hl = (n, L, p) => '(' + fmt(L) + ', ' + (p ? vn(p) : '–') + ')';
function hLabels(S) { S.vl = {}; HN.forEach((n) => { const [x, y] = S.g.P[n]; S.vl[n] = sm('', x, y + 0.55); }); S.setV = (n, L, p) => txt(S.vl[n], hl(n, L, p)); }
const DCODE = [
  'Dijkstra（起點 v₁）',
  'L(v₁) = 0；其他 L(v) = ∞',
  'label v₁ = (0, –)；S = ∅',
  'while S ≠ V:',
  '  u = 不在 S、L 值最小的端點',
  '  S = S ∪ {u}',
  '  for 每個不在 S 的 v:',
  '    if L(v) > L(u) + w(u,v):',
  '      L(v) = L(u) + w(u,v)',
  '      label v = (L(v), u)',
];
function mkCode(S, x = 3.4, y = 6.5, upto = DCODE.length) { S.code = code(DCODE, x, y, 0.5); S.code.ls.forEach((l, i) => showL(l, i < upto)); S.reveal = (k) => S.code.ls.forEach((l, i) => { if (i < k) showL(l, true); }); }

scene('g8d-sp-intro', '27A：Shortest path 問題與 principle of optimality', [
  async (tok, S) => { // @4.4
    S.g = gG(); S.t = hd('weighted、undirected、connected simple graph', 1.0, 6.6);
    S.n = note('前一講的例子圖（擺放為示意）', 3.0, 0.6); cap('每個 edge 上有一個 weight', '');
  },
  async (tok, S) => { // @7.2
    const p1 = ['A', 'D', 'C', 'B', 'F'], p2 = ['A', 'D', 'F'];
    paintPath(S.g, p1, TC.orange); S.a = pl('path A D C B F：weight = ' + cycleEdges(p1).map(([u, v]) => wOf(GE, u, v)).join('+') + ' = ' + pathW(p1), 3.0, 4.6);
    S.b = pl('path A D F：weight = ' + cycleEdges(p2).map(([u, v]) => wOf(GE, u, v)).join('+') + ' = ' + pathW(p2), 3.0, 3.8);
    S.c = good('找 weight 和最小的 path：A → F 最短 = ' + BRUTE.F + '（列舉所有 path）', 3.0, 2.9);
    cap('path 的 weight = 邊的 weight 加起來', '要找最小的那條');
  },
  async (tok, S) => { // @10.6
    gone(S.g, S.t, S.n, S.a, S.b, S.c);
    S.pa = [-5.2, 3.0]; S.pc = [-0.8, 4.4]; S.pb = [4.6, 3.0];
    const nd = (p, n) => { const m = new THREE.Mesh(NG, new THREE.MeshStandardMaterial({ color: TC.node })); m.position.set(p[0], p[1], 0); m.add(lab.label(n, 'val')); lab.world.add(m); return m; };
    nd(S.pa, 'A'); nd(S.pc, 'C'); nd(S.pb, 'B');
    seg(S.pa[0], S.pa[1], -3.0, 4.7, TC.a, 0.09); seg(-3.0, 4.7, S.pc[0], S.pc[1], TC.a, 0.09);
    seg(S.pc[0], S.pc[1], 1.8, 4.9, TC.b, 0.09); seg(1.8, 4.9, S.pb[0], S.pb[1], TC.b, 0.09);
    pl('P₁', -3.0, 5.3); pl('P₂', 1.8, 5.5);
    hd('P = A 到 B 的最短 path，經過中間點 C', 0, 6.7); note('示意', 5.6, 6.7);
    cap('principle of optimality', '最短路徑上的中間點 C');
  },
  async (tok, S) => { // @37.0
    S.p1 = good('P₁ 一定是 A 到 C 所有 path 中最短的', -2.8, 2.2); cap('最短 path 上每點到 A 也都最短', '');
  },
  async (tok, S) => { // @46.2
    S.alt = dash([S.pa, [-3.2, 1.0], S.pc], TC.hot); bad("P₁' 比 P₁ 短？那 P₁' + P₂ 就比 P 短，矛盾", -2.2, 0.4);
    sm('其他 A→C 的 path 都可以丟掉，只留最短的', 2.4, 1.4); cap('只要留最短的那些 path', '其他的不可能是答案的一部分');
  },
  async (tok, S) => { // @60.1
    gone(S.alt); S.dj = hot('Dijkstra algorithm', 3.4, -0.6); cap('有名的 Dijkstra algorithm', '');
  },
  async (tok, S) => { // @67.6
    sm('給一個起點 → 輸出它到「所有其他點」的最短 path', 3.4, -1.1); cap('一點到所有其他點的最短路徑', '');
  },
]);

scene('g8d-dij-setup', '27A：Dijkstra 的輸入與 initialization', [
  async (tok, S) => { // @134.0
    S.g = gH(); note('示意圖', -3.5, -0.2); hd('weighted、undirected、connected、simple', -3.4, 7.0); cap('輸入：weighted connected simple graph', '');
  },
  async (tok, S) => { // @149.3
    sm('端點編號 v₁ … vₙ（這裡 n = ' + HN.length + '）只是為了好講', -3.4, 6.5); cap('端點編成 v₁ 到 vₙ', '編號順序沒有影響');
  },
  async (tok, S) => { // @164.7
    S.g.ecol('3', '5', TC.orange, true); S.w = bub('w(v₃, v₅) = ' + wOf(HE, '3', '5'), -2.6, 4.6); cap('edge {vᵢ, vⱼ} 上的 weight', '');
  },
  async (tok, S) => { // @170.0
    S.g.ecol('3', '5', TC.edge, false); gone(S.w);
    S.nd = dash([S.g.P['1'], S.g.P['2']], TC.hot, 0.03); S.w = bad('v₁ v₂ 沒有 edge → w = ' + fmt(wOf(HE, '1', '2')), -4.0, 6.4);
    cap('沒有 edge：weight 當成 ∞', '永遠不會被選到');
  },
  async (tok, S) => { // @194.0
    gone(S.nd, S.w); mkCode(S, 3.4, 6.5, 2); S.code.hl(1); cap('initialization', '最後輸出 v₁ 到每點的最短距離');
  },
  async (tok, S) => { // @218.6
    hLabels(S); HN.forEach((n) => n !== '1' && txt(S.vl[n], 'L = ∞')); cap('其他端點的 L 值先設成 ∞', '');
  },
  async (tok, S) => { // @223.1
    txt(S.vl['1'], 'L = 0'); S.g.vcol('1', TC.a, '#0b2a4a'); cap('L(v₁) = 0', 'v₁ 到自己距離是 0');
  },
  async (tok, S) => { // @235.1
    S.reveal(3); S.code.hl(2); txt(S.vl['1'], hl('1', 0, null)); S.tp = bub('label = (L 值, 前一個端點)：v₁ 沒有前一個', 3.4, 0.9); cap('每個端點有一個 2-tuple label', '');
  },
  async (tok, S) => { // @260.9
    gone(S.tp); S.s = hot('S = ∅', -6.0, 6.3); sm('S：已經處理過的端點', -6.0, 5.8); cap('S 一開始是空集合', 'S 放處理過的端點');
  },
  async (tok, S) => { // @275.4
    S.reveal(4); S.code.hl(3); S.tp = bub('n 個端點一個一個處理 → n 次 iteration', 3.4, 0.9); cap('S 包含所有端點就結束', '共 n 次 iteration');
  },
]);

// 27A 的 while loop：用 H6 在「第 1 輪做完」的狀態講第 2 輪（示意）
const H1 = HD.it[0], H2 = HD.it[1];
scene('g8d-dij-loop', '27A：while loop——挑 u、加進 S、更新 L 值', [
  async (tok, S) => { // @312.1
    S.g = gH(); note('示意圖：第 1 輪（u = v₁）做完的狀態', -3.4, -0.2); hLabels(S);
    HN.forEach((n) => S.setV(n, H1.L[n], H1.pre[n])); S.g.vcol('1', TC.green); S.blob = blob(S.g.P['1'][0], S.g.P['1'][1], 0.7, 0.7, TC.green);
    preEdges(HE, H1.pre).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
    mkCode(S); S.code.hl(3); cap('主要就是這個 while loop', '');
  },
  async (tok, S) => { // @328.5
    S.s = hot('S = {' + H1.S.map(vn).join(', ') + '} ≠ V → 繼續', -5.0, 6.8); cap('條件：還有端點不在 S 裡', '全部都在 S 就結束');
  },
  async (tok, S) => { // @351.0
    S.b1 = bub('每一輪挑一個端點出來處理，叫 u', 3.4, 0.9); cap('每次找一個端點 u 來處理', '');
  },
  async (tok, S) => { // @367.0
    gone(S.b1); S.code.hl(4);
    const out = H2.out; S.b1 = pl('不在 S：' + out.map((n) => vn(n) + '=' + fmt(H2.Lbefore[n])).join('  '), 3.4, 1.0);
    S.b2 = good('L 最小 → u = ' + vn(H2.u), 3.4, 0.4); S.g.vcol(H2.u, TC.orange, '#5a2a00');
    cap('u：不在 S、L 值最小', '');
  },
  async (tok, S) => { // @392.1
    sm('最小的不只一個時隨便挑一個；最短 path 也不一定唯一', 3.4, -0.1); cap('平手就隨便挑一個', '答案不一定唯一，但一定最短');
  },
  async (tok, S) => { // @418.5
    S.code.hl(5); txt(S.s, 'S = {' + H2.S.map(vn).join(', ') + '}'); S.g.vcol(H2.u, TC.green);
    gone(S.blob); S.blob = blob((S.g.P['1'][0] + S.g.P[H2.u][0]) / 2, (S.g.P['1'][1] + S.g.P[H2.u][1]) / 2, 1.6, 1.2, TC.green, 0.2, 0.9);
    cap('把 u 加進 S', '代表 u 處理過了');
  },
  async (tok, S) => { // @457.1
    gone(S.b1, S.b2); S.b1 = sm('找 u：' + H2.out.length + ' 個候選 → 比較 ' + (H2.out.length - 1) + ' 次（comparison）', 3.4, 1.0); cap('找最小要做 comparison', '');
  },
  async (tok, S) => { // @480.6
    S.code.hl(6); txt(S.b1, '對每個不在 S 的 v：' + H2.ch.map((c) => vn(c.v)).join('、')); cap('for：每個還沒處理的 v', '處理過的就不管');
  },
  async (tok, S) => { // @506.3
    S.b2 = bub('L 值 = 到目前為止 v₁ 到這點的最短距離（還不一定是最後答案）', 3.4, 0.3); cap('L 值是什麼？', '到現在為止的最短距離');
  },
  async (tok, S) => { // @548.2
    gone(S.b2); const c = H2.ch.find((x) => x.v === '5');
    S.b2 = pl('L(u) = L(' + vn(H2.u) + ') = ' + H2.Lu + '；L(v₅) = ' + fmt(c.old) + '（上一輪的）', 3.4, 0.3); S.g.vcol('5', TC.a);
    cap('拿 v₅ 當例子', '');
  },
  async (tok, S) => { // @567.0
    S.code.hl(7); const c = H2.ch.find((x) => x.v === '5'); S.g.ecol(H2.u, '5', TC.green, true);
    S.b3 = ok(c.upd, 3.4, -0.35, fmt(c.old) + ' > ' + H2.Lu + ' + ' + c.w + ' = ' + c.cand + '：先到 u 再到 v 比較短 ✓');
    cap('先到 u 再到 v 比較短？', '那就應該經過 u');
  },
  async (tok, S) => { // @595.6
    S.code.hl(8); const c = H2.ch.find((x) => x.v === '5'); txt(S.vl['5'], 'L = ' + c.cand);
    const c2 = H2.ch.find((x) => x.v === '2'); txt(S.vl['2'], 'L = ' + c2.cand); S.g.ecol(H2.u, '2', TC.green, true);
    gone(S.b3); S.b3 = sm('v₂ 也一樣：' + fmt(c2.old) + ' > ' + H2.Lu + ' + ' + c2.w + ' → L(v₂) = ' + c2.cand, 3.4, -0.35);
    cap('L(v) 改成經過 u 的距離', '');
  },
  async (tok, S) => { // @608.1
    S.code.hl(9); ['5', '2'].forEach((n) => S.setV(n, H2.L[n], H2.pre[n])); S.g.ecol('1', '5', TC.faint, false);
    cap('label 後面記「前一個端點」u', '');
  },
  async (tok, S) => { // @629.3
    HN.forEach((n) => S.setV(n, H2.L[n], H2.pre[n])); S.g.vcol('5', TC.node); S.b4 = sm('每個端點都帶著 (距離, 前一點)', -3.4, 6.6); cap('每個端點都有一個 2-tuple', '');
  },
  async (tok, S) => { // @665.7
    const p = back(H2.pre, '5'); S.g.reset(); paintPath(S.g, p, TC.hot);
    gone(S.b4); S.b4 = good('v₅ ← ' + p.slice(0, -1).reverse().map(vn).join(' ← ') + '：倒著找回去就是路徑', -3.4, 6.6); cap('知道前一點，就能 backtrack', '');
  },
]);

scene('g8d-dij-meaning', '27A：結束時 label 的意義', [
  async (tok, S) => { // @688.6
    S.g = gH(); note('示意圖：Dijkstra 跑完', -3.4, -0.2); hLabels(S); HN.forEach((n) => S.setV(n, HD.L[n], HD.pre[n]));
    S.t = hd('結束時每個 vᵢ 都有 label (L(vᵢ), u)', 3.0, 6.4); cap('做完後每個端點的 label', '');
  },
  async (tok, S) => { // @697.6
    const p = back(HD.pre, '4'); paintPath(S.g, p, TC.a);
    S.a = pl('L(v₄) = ' + HD.L['4'] + ' = ' + cycleEdges(p).map(([u, v]) => wOf(HE, u, v)).join(' + ') + '（edge weight 的和）', 3.0, 5.4);
    S.b = ok(HD_OK, 3.0, 4.7, '列舉所有 path：每個 L 都是真的最短 ✓'); cap('L(vᵢ) = v₁ 到 vᵢ 最短 path 的 weight', '');
  },
  async (tok, S) => { // @718.2
    S.c = pl('u = predecessor vertex：v₄ 的前一個是 ' + vn(HD.pre['4']), 3.0, 3.8); S.g.vcol(HD.pre['4'], TC.orange); cap('u 是最短 path 上的前一個端點', '');
  },
  async (tok, S) => { // @739.0
    const p = back(HD.pre, '4'); S.g.reset(); paintPath(S.g, p, TC.hot);
    S.d = good('v₄ ← ' + p.slice(0, -1).reverse().map(vn).join(' ← ') + '：一個一個找回去', 3.0, 3.0); cap('一個一個往回找，就得到 path', '');
  },
  async (tok, S) => { // @749.0
    S.g.reset(); preEdges(HE, HD.pre).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); S.g.vcol(HD.pre['4'], TC.node);
    S.e = sm('所有端點都這樣 → v₁ 到每一點的最短 path 和距離都有了', 3.0, 2.2); cap('v₁ 到所有端點的最短 path', '');
  },
]);

scene('g8d-dij-idea', '27A：從頭想一遍——為什麼每次挑 L 最小', [
  async (tok, S) => { // @793.9
    S.g = gH(); note('示意圖', -3.4, -0.2); hLabels(S); S.t = hd('過程中：L = 只考慮處理過的端點時的最短距離', 1.6, 6.9);
    mkTab(S, HN.map(vn)); HN.forEach((n) => setCls(S.rows[vn(n)], '')); S.s = hot('S = ∅', 2.0, 1.0); cap('中間過程 label 的意思', '');
  },
  async (tok, S) => { // @825.0
    HN.forEach((n) => { const L = n === '1' ? 0 : Infinity; S.setV(n, L, null); S.setRow(vn(n), L, null); }); cap('一開始：v₁ 是 0，其他都是 ∞', '什麼都還沒處理');
  },
  async (tok, S) => { // @872.0
    S.g.vcol(HD.it[0].u, TC.orange, '#5a2a00'); setCls(S.rows[vn(HD.it[0].u)], 'ptr alt'); S.u = pl('u = ' + vn(HD.it[0].u) + '（其他都是 ∞）', 4.6, 1.0); cap('挑 L 最小的 → 第一個一定是 v₁', '');
  },
  async (tok, S) => { // @898.0
    S.g.vcol('1', TC.green); txt(S.s, 'S = {v₁}'); setCls(S.rows.v1, 'good'); cap('v₁ 加進 S', '其他 v₂…vₙ 都要比一比');
  },
  async (tok, S) => { // @931.4
    for (const c of HD.it[0].ch) if (c.upd) { S.setV(c.v, c.cand, '1'); S.setRow(vn(c.v), c.cand, vn('1')); S.g.ecol('1', c.v, TC.gold, true); }
    cap('跟 v₁ 相連的點：L 變成 edge 的 weight', '沒相連的還是 ∞');
  },
  async (tok, S) => { // @986.9
    txt(S.u, '有限的只有 ' + HD.it[0].ch.filter((c) => c.upd).map((c) => vn(c.v)).join('、')); cap('再挑一個 u', '只有跟 v₁ 相連的有有限 L 值');
  },
  async (tok, S) => { // @1013.8
    const u = HD.it[1].u; txt(S.u, 'u = ' + vn(u) + '（L = ' + HD.it[1].Lu + ' 最小）'); S.g.vcol(u, TC.green); setCls(S.rows[vn(u)], 'good');
    txt(S.s, 'S = {' + HD.it[1].S.map(vn).join(', ') + '}'); cap('挑最小的 ' + vn(u) + ' 加進 S', '');
  },
  async (tok, S) => { // @1037.3
    const it = HD.it[1]; S.g.reset(); preEdges(HE, it.pre).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
    for (const c of it.ch) if (c.upd) { S.setV(c.v, c.cand, it.u); S.setRow(vn(c.v), c.cand, vn(it.u)); }
    S.up = sm('經過 ' + vn(it.u) + ' 比較近的：' + it.ch.filter((c) => c.upd).map((c) => vn(c.v) + ' ' + fmt(c.old) + '→' + c.cand).join('，'), 3.0, 0.4);
    cap('經過 ' + vn(it.u) + ' 會不會比較近？', '近的就更新 L 和 predecessor');
  },
  async (tok, S, q) => { // @1071.7
    gone(S.up);
    for (const it of HD.it.slice(2)) {
      S.g.vcol(it.u, TC.green); setCls(S.rows[vn(it.u)], 'good'); txt(S.s, 'S = {' + it.S.map(vn).join(', ') + '}'); txt(S.u, 'u = ' + vn(it.u));
      for (const c of it.ch) if (c.upd) { S.setV(c.v, c.cand, it.u); S.setRow(vn(c.v), c.cand, vn(it.u)); }
      S.g.reset(); preEdges(HE, it.pre).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
      if (!q) await wt(tok, 500);
    }
    cap('範圍慢慢擴大到所有端點', '');
  },
  async (tok, S) => { // @1078.8
    S.w1 = bub('挑進來的是目前 L 最小的：繞別的點（weight ≥ 0）只會更長', 3.0, 0.4); cap('為什麼挑最小？', '走別條不會比較短');
  },
  async (tok, S) => { // @1100.0
    gone(S.w1); S.w1 = bub('一直維持：只經過 S 裡的點時，L 就是最短距離', 3.0, 0.4); cap('一直維持同一件事', '');
  },
  async (tok, S) => { // @1132.8
    S.w2 = ok(HD_OK, 3.0, -0.2, '最後 S = 全部 → L 就是真正最短（和列舉比對 ✓）'); cap('到最後就是最短路徑', '可以用歸納法證');
  },
  async (tok, S) => { // @1176.0
    gone(S.w1, S.w2); S.w1 = pl('花時間 ①：找最小的 L(u) → comparison', 3.0, 0.4); cap('複雜度主要在哪？', '先是找 minimum');
  },
  async (tok, S) => { // @1185.0
    S.w2 = pl('花時間 ②：for 迴圈裡每個 v 一次比較 + 一次加法', 3.0, -0.2); cap('再來是一個比較、一個加法', '');
  },
  async (tok, S) => { // @1200.9
    S.w3 = hot('下一段：用前面那張 A–F 的圖實際跑一次', 0, 7.4); cap('實際 run 一個例子', '');
  },
]);

// ════════ 9r_YXw7i_mY（趙啟超 27B：Dijkstra 跑老師的圖、結果是 spanning tree、複雜度） ════════
const vIdx = (n) => GN.indexOf(n);
function cmpOp(k, v, extra) {
  return async (tok, S) => {
    const it = DJ.it[k], c = it.ch.find((x) => x.v === v), u = it.u;
    gone(S.cmp); paintPre(S, GE); const y = S.rows[v].position.y;
    S.cmp = [pl('L(' + v + ') = ' + fmt(c.old) + '  vs  L(' + u + ') + w(' + u + v + ') = ' + it.Lu + ' + ' + fmt(c.w) + ' = ' + fmt(c.cand), 4.5, y)];
    if (c.w !== Infinity) S.g.ecol(u, v, c.upd ? TC.green : TC.hot, true);
    if (c.upd) { S.setRow(v, c.cand, u); paintPre(S, GE); S.g.ecol(u, v, TC.green, true); S.cmp.push(good('比較短 → 改成 (' + c.cand + ', ' + u + ')', 4.5, y - 0.36)); }
    else S.cmp.push(note(c.w === Infinity ? u + ' 到 ' + v + ' 沒有 edge → 維持' : '沒有比較短 → 維持', 4.5, y - 0.36));
    if (extra) S.cmp.push(sm(extra, 4.5, y - 0.72));
    cap(v + '：經過 ' + u + ' 會不會比較短？', c.upd ? '會 → 更新 label' : '不會 → 不動');
  };
}
function pickOp(k, sayIt) {
  return async (tok, S) => {
    const it = DJ.it[k]; gone(S.cmp); paintPre(S, GE);
    if (S.cur) { setCls(S.rows[S.cur], 'good'); S.g.vcol(S.cur, TC.green); }
    const out = it.out.slice().sort((a, b) => it.Lbefore[a] - it.Lbefore[b]);
    S.cmp = [pl('不在 S：' + out.map((n) => n + ' ' + fmt(it.Lbefore[n])).join('，') + ' → 最小 ' + it.u, 3.4, 0.55)];
    S.cur = it.u; setCls(S.rows[it.u], 'ptr alt'); S.g.vcol(it.u, TC.orange, '#5a2a00');
    txt(S.sl, 'S = {' + it.S.join(', ') + '}'); txt(S.ul, 'u = ' + it.u);
    cap(sayIt || ('挑 L 最小的 → u = ' + it.u), '先把 ' + it.u + ' 加進 S');
  };
}
const RUN = [
  async (tok, S) => { // 0 @4.4
    S.g = gG(); S.g.vcol('A', TC.a, '#0b2a4a'); S.t = hd('v₁ = A：找 A 到其他每點的最短 path 和 weight', 0.6, 7.1);
    S.n = note('端點擺放為示意；邊和 weight 照老師的圖', -3.4, -0.2); cap('前面的例子，起點 v₁ = A', '');
  },
  async (tok, S) => { // 1 @7.3
    S.mx = []; const x0 = 1.4, y0 = 6.1, d = 0.82, dy = 0.66; S.cell = {};
    GN.forEach((n, j) => { S.mx.push(sm(n, x0 + (j + 1) * d, y0)); S.mx.push(sm(n, x0, y0 - (j + 1) * dy)); });
    GN.forEach((a, i) => GN.forEach((b, j) => { const l = pl(a === b ? '–' : (wOf(GE, a, b) < Infinity ? '1' : '0'), x0 + (j + 1) * d, y0 - (i + 1) * dy); S.cell[a + b] = l; S.mx.push(l); }));
    S.mx.push(sm('adjacency matrix（有 edge = 1）', x0 + 3.4, y0 - 7 * dy)); cap('存成矩陣：先看 adjacency matrix', '');
  },
  async (tok, S) => { // 2 @58.4
    GN.forEach((a) => GN.forEach((b) => { if (a !== b) txt(S.cell[a + b], fmt(wOf(GE, a, b))); }));
    txt(S.mx[S.mx.length - 1], 'weight matrix：0 → ∞、1 → 那條 edge 的 weight'); cap('0 換成 ∞，1 換成 weight', '後面只看這個矩陣');
  },
  async (tok, S) => { // 3 @93.1
    gone(S.mx, S.t); mkTab(S, GN); S.setRow('A', 0, null); S.sl = hot('S = ∅', 1.0, 1.3); S.ul = pl('u = ?', 3.0, 1.3);
    cap('一開始 A 的 label 是 (0, –)', '其他 L 值都是 ∞');
  },
  pickOp(0, 'L 最小的是 A → u = A'), // 4 @103.5
  async (tok, S) => { // 5 @118.2
    gone(S.cmp); const nb = GE.filter((e) => e[0] === 'A' || e[1] === 'A'); nb.forEach(([u, v]) => S.g.ecol(u, v, TC.orange, true));
    S.cmp = [pl('A 連到：' + nb.map((e) => (e[0] === 'A' ? e[1] : e[0])).join('、') + ' → 這些會被 update', 3.4, 0.55)]; cap('跟 A 相連的 B、C、D 會被 update', '');
  },
  async (tok, S) => { // 6 @160.8
    gone(S.cmp); const it = DJ.it[0]; S.cmp = [];
    for (const c of it.ch) if (c.upd) { S.setRow(c.v, c.cand, 'A'); S.cmp.push(sm('0 + ' + c.w + ' = ' + c.cand + ' < ∞', 3.6, S.rows[c.v].position.y)); }
    paintPre(S, GE); cap('L 值就是 AB、AC、AD 的 weight', '前一個端點都是 A');
  },
  async (tok, S) => { // 7 @188.0
    S.cmp.push(note('E、F 還是 ∞：挑最小時不會挑到', 3.8, S.rows.E.position.y - 0.3)); cap('E、F 還是 ∞', '');
  },
  pickOp(1, '挑最小的 3 → u = B'), // 8 @212.3
  async (tok, S) => { // 9 @230.1
    S.lockA = sm('（處理過，不會再變）', 3.2, S.rows.A.position.y); cap('處理過的端點不會變', '');
  },
  async (tok, S) => { // 10 @249.5
    gone(S.cmp); S.cmp = [pl('還沒處理：' + DJ.it[1].ch.map((c) => c.v).join(' ') + '：經過 B 會不會比較好？', 3.4, 0.55)]; cap('C D E F：改走 B 會不會比較好？', '');
  },
  cmpOp(1, 'C'), // 11 @266.1
  cmpOp(1, 'D'), // 12 @307.8
  cmpOp(1, 'E'), // 13 @339.2
  cmpOp(1, 'F'), // 14 @364.9
  async (tok, S) => { // 15 @396.5
    gone(S.cmp); paintPre(S, GE);
    S.cmp = [bub('金色 = 每點 label 的「前一點」連起來；其實只存 label，路徑倒著找', 3.2, -0.1)]; cap('把 L 值對應的路徑畫出來', '實際上只存 label');
  },
  pickOp(2, 'C D E F 是 8、7、9、11 → u = D'), // 16 @435.4
  async (tok, S) => { // 17 @496.0
    S.cmp.push(bub('加進 S 的都是當時 L 最小的：從別處繞過來不會更短', 3.2, -0.1)); cap('處理過的一定是最好的', '因為每次都挑最小的');
  },
  cmpOp(2, 'C'), // 18 @540.0
  cmpOp(2, 'E', '（老師這裡順口算了 C→E：8+4=12，那是處理 C 時的比較，結果一樣維持 9）'), // 19 @566.7
  cmpOp(2, 'F'), // 20 @598.5
  async (tok, S) => { // 21 @622.1
    gone(S.cmp); const any = DJ.it[2].ch.some((c) => c.upd); S.cmp = [ok(!any, 3.4, 0.55, '加了 D 以後 label 都沒變 ✓')]; cap('加了 D，路徑和 L 值都沒變', '');
  },
  pickOp(3, 'C E F 是 8、9、11 → u = C'), // 22 @630.7
  cmpOp(3, 'E'), // 23 @701.5
  cmpOp(3, 'F'), // 24 @725.9
  async (tok, S) => { // 25 @745.0
    gone(S.cmp); const any = DJ.it[2].ch.some((c) => c.upd) || DJ.it[3].ch.some((c) => c.upd);
    S.cmp = [ok(!any, 3.4, 0.55, '加 D、加 C 都沒改變任何 label ✓')]; cap('加 D、加 C 都不影響', '再兩個就做完');
  },
  pickOp(4, 'E 是 9、F 是 11 → u = E'), // 26 @760.4
  cmpOp(4, 'F'), // 27 @832.5
  pickOp(5, '剩下只有 F → u = F'), // 28 @872.1
  async (tok, S) => { // 29 @895.7
    gone(S.cmp); setCls(S.rows.F, 'good'); S.g.vcol('F', TC.green); S.cur = null;
    S.cmp = [pl('先把 F 加進 S，再處理「不在 S 的 v」——已經沒有了 → 結束', 3.4, 0.55)]; cap('F 加進 S 後沒有端點要處理', 'if 不會執行，結束');
  },
  async (tok, S) => { // 30 @955.7
    gone(S.cmp); S.cmp = [ok(DJ_OK && BRUTE_OK, 3.4, 0.55, '和老師算的一樣，也和列舉所有 path 的最小值一樣 ✓')]; cap('最後的 label', 'A 0、B 3A、C 8B、D 7A、E 9B、F 10E');
  },
];
const RES = [
  async (tok, S) => { // @981.4
    gone(S.cmp); const p = back(DJ.pre, 'F'); S.g.reset(); paintPath(S.g, p, TC.hot);
    S.r1 = pl('A → F：weight ' + DJ.L.F + '；F ← ' + p.slice(0, -1).reverse().join(' ← ') + ' → path ' + p.join(' '), 3.4, -0.1); cap('A 到 F：weight 10', '從 predecessor 倒著找');
  },
  async (tok, S) => { // @1000.5
    S.r2 = sm(['E', 'C', 'D'].map((v) => v + '：' + back(DJ.pre, v).join(' ')).join('　'), 3.4, -0.6); cap('A B E、A B C、A D', '每個端點都找得回去');
  },
  async (tok, S) => { // @1019.4
    gone(S.r1, S.r2); paintPre(S, GE); S.r1 = pl('金色的邊：包含全部 ' + GN.length + ' 個端點 → spanning', 3.4, -0.1); cap('結果一定是 spanning tree', '包含所有端點');
  },
  async (tok, S) => { // @1033.0
    const es = preEdges(GE, DJ.pre); S.r2 = ok(isST(GN, es), 3.4, -0.6, es.length + ' 條邊、connected、沒有 cycle → tree ✓'); cap('connected、沒有 cycle → tree', '每點只留一個前一點');
  },
  async (tok, S) => { // @1066.6
    S.r3 = sm('tree：A 到每一點 exactly 一條 path', 3.4, -1.1); cap('A 到每點只有唯一一條 path', '');
  },
  async (tok, S) => { // @1138.3
    gone(S.r1, S.r2, S.r3); const p = back(DJ.pre, 'F'); paintPre(S, GE); paintPath(S.g, p, TC.hot);
    S.r1 = pl('A B E F：' + cycleEdges(p).map(([u, v]) => wOf(GE, u, v)).join(' + ') + ' = ' + pathW(p), 3.4, -0.1); cap('A 到 F：A B E F，weight 10', '');
  },
  async (tok, S) => { // @1178.4
    const p = back(DJ.pre, 'C'); paintPre(S, GE); paintPath(S.g, p, TC.a);
    S.r2 = pl('A B C：' + cycleEdges(p).map(([u, v]) => wOf(GE, u, v)).join(' + ') + ' = ' + pathW(p), 3.4, -0.6); cap('A 到 C：A B C，weight 8', '只存 label 就看得出來');
  },
  async (tok, S) => { // @1203.5
    S.r3 = good('每次加進 L 最小的 → 留下的一定是最短的', 3.4, -1.1); cap('每次都加 L 最小的', '所以留下的一定最短');
  },
];
function runScene(id, title, a, b) { scene(id, title, RUN.slice(a, b), { pre: RUN.slice(0, a) }); }
runScene('g8d-run-matrix', '27B：老師的圖與 weight matrix', 0, 3);
runScene('g8d-run-ab', '27B：第 1、2 輪——處理 A、B', 3, 16);
runScene('g8d-run-dc', '27B：第 3、4 輪——處理 D、C', 16, 26);
runScene('g8d-run-ef', '27B：第 5、6 輪——處理 E、F，結束', 26, 30);
scene('g8d-run-result', '27B：結果——最短 path 與 spanning tree', [RUN[30], ...RES], { pre: RUN.slice(0, 30) });

scene('g8d-dij-cost', '27B：Direct implementation 的複雜度 O(n²)', [
  async (tok, S) => { // @1304.2
    mkCode(S, -3.2, 6.4); S.t = hd('算一下 Dijkstra 的複雜度（n = 端點數）', 2.6, 7.0); cap('算 Dijkstra 的複雜度', '');
  },
  async (tok, S) => { // @1318.6
    S.code.hl(3); S.a = pl('真正有運算的：n − 1 個 iteration（最後一輪只剩一點）', 2.6, 6.3); cap('n − 1 個 iteration', '最後一輪不用比');
  },
  async (tok, S) => { // @1389.0
    S.code.hl(4); S.b = pl('第 1 輪：找最小的 L(u)，n − 1 個候選 → 最多 n − 1 次比較', 2.6, 5.6); cap('第 1 輪找 u：n − 1 次比較', '');
  },
  async (tok, S) => { // @1455.4
    S.code.hl(7); S.c = pl('for 迴圈：每個 v 最多 1 次比較 + 1 次加法 → 各 n − 1', 2.6, 4.9); cap('更新：比較、加法各 n − 1', '');
  },
  async (tok, S) => { // @1527.7
    const n = GN.length; S.d = pl('第 i 輪：找 u 比 n − i 次、更新比 n − i 次、加 n − i 次', 2.6, 4.2);
    S.rowsI = []; for (let i = 1; i < n; i++) S.rowsI.push(sm('n = ' + n + '，i = ' + i + '：比較 ' + 2 * (n - i) + '、加法 ' + (n - i), 2.6, 3.7 - (i - 1) * 0.42));
    cap('一般的第 i 輪：n − i', '例：老師的圖 n = 6');
  },
  async (tok, S) => { // @1651.6
    const n = GN.length; let c = 0; for (let i = 1; i < n; i++) c += 2 * (n - i);
    S.e = ok(c === n * (n - 1), -3.2, 0.3, '比較總數 Σ 2(n − i) = n(n − 1)；n = 6：' + c + ' ✓'); cap('比較次數加起來 = n(n − 1)', '');
  },
  async (tok, S) => { // @1730.7
    const n = GN.length; let a = 0; for (let i = 1; i < n; i++) a += n - i;
    S.f = ok(a === n * (n - 1) / 2, -3.2, -0.3, '加法總數 Σ (n − i) = n(n − 1)/2；n = 6：' + a + ' ✓'); cap('加法次數 = n(n − 1)/2', '');
  },
  async (tok, S) => { // @1763.6
    S.g = hot('不管算比較還是加法：worst case O(n²)', 2.6, 0.9); cap('worst-case complexity：O(n²)', '');
  },
  async (tok, S) => { // @1805.3
    S.h = sm('這叫 direct implementation：照剛剛的步驟直接寫', 2.6, 0.3); cap('這是 direct implementation', '');
  },
]);

scene('g8d-dij-heap', '27B：用 priority queue（binary heap）降低複雜度', [
  async (tok, S) => { // @1825.6
    S.t = hd('複雜度跟資料怎麼存（data structure）有關', 0, 6.6); cap('複雜度跟 data structure 有關', '');
  },
  async (tok, S) => { // @1866.4
    S.a = pl('用 priority queue 存 L 值；priority queue 用 binary heap 實作', 0, 5.8); cap('priority queue，用 binary heap 做', '');
  },
  async (tok, S) => { // @1925.9
    S.b = hot('複雜度 O(e · log₂ n)：n = 端點數，e = edge 數', 0, 5.0); cap('O(e log n)', 'n 端點、e 邊');
  },
  async (tok, S) => { // @1971.5
    S.c = sm('跟 edge 數 e 成正比，跟端點數只差一個 log n（log 的底不影響 big-O）', 0, 4.4); cap('跟 edge 數成正比', '');
  },
  async (tok, S) => { // @1994.5
    const n = 1000, e = 3000, a = Math.round(e * Math.log2(n)), b = n * n;
    S.d = ok(a < b, 0, 3.4, '例：n = 1000、e = 3000：e·log₂n ≈ ' + a.toLocaleString() + ' < n² = ' + b.toLocaleString() + ' ✓'); cap('edge 不多時比 n² 小', '');
  },
  async (tok, S) => { // @1998.0
    const n = 1000, e = n * (n - 1) / 2, a = Math.round(e * Math.log2(n)), b = n * n;
    S.f = bad('e ≈ n²/2（' + e.toLocaleString() + '）：e·log₂n ≈ ' + a.toLocaleString() + ' > n²', 0, 2.6); cap('edge 跟 n² 同級時反而比較大', '');
  },
  async (tok, S) => { // @2055.5
    S.g = good('直接做：O(n²)；用 heap：O(e log n)', 0, 1.6); cap('直接做是 O(n²)', '');
  },
]);

// ════════ Greva74E0ZU（趙啟超 27C：minimal spanning tree、greedy、Prim's algorithm 與例子） ════════
const T1 = preEdges(GE, DJ.pre);                     // Dijkstra 的結果
const T2 = ['AC', 'AD', 'AB', 'BE', 'BF'].map((nm) => GE.find((e) => en(e) === nm));   // 一棵 weight 33 的 spanning tree（形狀示意）
const T3 = PR.es;                                     // Prim 的結果 = MST
const TS = [T1, T2, T3], TSX = [-1.75, 1.65, 5.05];
scene('g8d-mst-def', '27C：Minimal spanning tree 的定義', [
  async (tok, S) => { // @4.5
    S.t = hd('第二個問題：minimal spanning tree（也叫 minimum spanning tree）', 0, 7.0); cap('第二個問題：minimal spanning tree', 'minimal、minimum 意思一樣');
  },
  async (tok, S) => { // @50.4
    S.g = gG(); S.a = pl('G = (V, E)：weighted、undirected、connected、simple', 2.8, 6.2);
    S.b = sm('這張圖：n = |V| = ' + GN.length + '，e = |E| = ' + GE.length, 2.8, 5.6); cap('給一個 weighted connected simple graph', '');
  },
  async (tok, S) => { // @114.1
    T3.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); S.c = pl('首先它是 spanning tree：tree、含所有端點', 2.8, 4.8); cap('MST 首先是 spanning tree', '');
  },
  async (tok, S) => { // @148.9
    S.d = hot('minimal：edge weight 和是所有 spanning tree 裡最小的', 2.8, 4.0); cap('weight 的和要最小', '');
  },
  async (tok, S) => { // @170.3
    S.e = ok(STS.length > 1, 2.8, 3.2, '這張圖的 spanning tree 一共 ' + STS.length + ' 棵（程式列舉）✓'); cap('spanning tree 通常不唯一', '');
  },
  async (tok, S) => { // @194.7
    S.f = sm('DFS、BFS、Dijkstra 都會給你一棵 spanning tree，但目的不同', 2.8, 2.5); cap('DFS、BFS、Dijkstra 都給 spanning tree', '');
  },
  async (tok, S) => { // @219.7
    S.h = good('現在要找：所有 spanning tree 中 weight 和最小 = ' + MST_W, 2.8, 1.8); cap('現在要找 weight 和最小的', '');
  },
]);

scene('g8d-mst-ex', '27C：例子——三棵 spanning tree 比 weight', [
  async (tok, S) => { // @237.6
    S.G = gG({ s: 0.5, dx: -3.6, dy: 2.3, er: 0.035, off: 0.22, r: 0.6 }); S.Gl = pl('G', -5.1, 6.0); cap('看一個例子', '');
  },
  async (tok, S) => { // @288.2
    S.n = note('跟 Dijkstra 例子是同一張圖', -5.1, 1.4); cap('跟 Dijkstra 用的是同一個圖', '');
  },
  ...[0, 1, 2].map((k) => async (tok, S) => { // @302.8 @318.8 @321.3
    S.T = S.T || []; S.T[k] = gG({ s: 0.5, dx: TSX[k] + 1.6, dy: 2.3, er: 0.04, off: 0.22, r: 0.6, only: TS[k] });
    TS[k].forEach(([u, v]) => S.T[k].ecol(u, v, TC.gold, false)); pl('T' + (k + 1), TSX[k], 6.0);
    if (k === 1) note('形狀示意', TSX[k], 6.55);
    cap('T' + (k + 1) + ' 也是一棵 spanning tree', '');
  }),
  ...[0, 1, 2].map((k) => async (tok, S) => { // @426.1 @465.9 @488.2
    const ws = TS[k].map((e) => e[2]);
    S['w' + k] = ok(isST(GN, TS[k]), TSX[k], 1.2, ws.join('+') + ' = ' + sum(TS[k]) + ' ✓');
    if (k === 0) S.d0 = sm('= Dijkstra 的結果', TSX[k], 0.6);
    cap('T' + (k + 1) + ' 的 weight = ' + sum(TS[k]), k === 0 ? '就是剛才 Dijkstra 的結果' : '');
  }),
  async (tok, S) => { // @510.1
    S.best = hot('三棵裡 T3 的 ' + sum(T3) + ' 最小', TSX[2], 0.0); cap('15 最好', 'Dijkstra 的樹不一定 weight 最小');
  },
  async (tok, S) => { // @552.1
    const p1 = treePath(T1, 'A', 'E'), p3 = treePath(T3, 'A', 'E');
    paintPath(S.T[0], p1, TC.hot); paintPath(S.T[2], p3, TC.hot);
    S.pe = pl('A 到 E：T1 走 ' + p1.join('') + ' = ' + pathW(p1) + '，T3 走 ' + p3.join('') + ' = ' + pathW(p3), 1.6, -0.7); cap('目的不同，結果就不同', 'T1 讓 A 到各點最短');
  },
  async (tok, S) => { // @581.6
    S.ms = ok(sum(T3) === MST_W, -4.3, -0.1, '列舉全部 ' + STS.length + ' 棵：最小 = ' + MST_W + ' ✓ → T3 是 MST'); cap('T3 就是 minimal spanning tree', '不會比 15 更低');
  },
  async (tok, S) => { // @590.0
    S.un = sm('一般 MST 不一定唯一（這張圖 weight ' + MST_W + ' 的有 ' + MST_N + ' 棵）；algorithm 給你其中一棵', -4.3, -0.65); cap('MST 不一定唯一', 'algorithm 給你一個就對了');
  },
]);

scene('g8d-greedy', '27C：Greedy algorithm——每次選眼前最好的', [
  async (tok, S) => { // @620.8
    S.t = hd('要怎麼找 minimal spanning tree？', 0, 6.6); cap('怎麼找 MST？', '');
  },
  async (tok, S) => { // @633.4
    S.a = hot('一類方法：greedy algorithm（貪心）', 0, 5.7); cap('greedy algorithm：貪心的演算法', '');
  },
  async (tok, S) => { // @657.9
    S.b = bub('每一步都選「現在看起來最好」的，不管以後——像下棋能吃就吃', 0, 4.8); cap('現在最好就選，不管以後', '');
  },
  async (tok, S) => { // @725.3
    S.c = pl('repeatedly makes locally best choices, ignoring effects in the future', 0, 3.9); cap('locally best choice', '不管未來的影響');
  },
  async (tok, S) => { // @755.6
    S.d = bad('不是每個問題都行：下棋能吃就吃，可能掉進陷阱輸掉', 0, 3.0); cap('有些問題 greedy 不會最好', '');
  },
  async (tok, S) => { // @782.8
    S.e = good('但 MST 這個問題 greedy 會 work', 0, 2.1); cap('MST 問題 greedy 會 work', '');
  },
]);

// Prim 的抽象說明：T 裡 3 點、外面 2 點（示意）
const QP = { p: [-5.6, 4.6], q: [-4.4, 2.6], r: [-3.2, 4.4], s: [-1.4, 3.0], t: [-1.0, 5.4] };
const QE = [['p', 'q', 3], ['p', 'r', 2], ['q', 'r', 6], ['q', 's', 4], ['r', 's', 6], ['r', 't', 3], ['s', 't', 2]];
const QT = ['p', 'q', 'r'];
const QC = QE.filter(([u, v]) => QT.includes(u) !== QT.includes(v));
const QBEST = QC.reduce((b, c) => (c[2] < b[2] ? c : b));
const PCODE = ['Prim', 'T = 任選一個端點', 'for i = 1 to n − 1:', '  e = 一端在 T、一端不在 T 的', '      edge 中 weight 最小的', '  把 e（和它的新端點）加進 T', 'return T'];
scene('g8d-prim-algo', "27C：Prim's algorithm——讓一棵 tree 慢慢長大", [
  async (tok, S) => { // @815.6
    S.t = hd("兩個 greedy algorithm 都會 work；先講 Prim's algorithm", 0, 7.0); cap("第一個：Prim's algorithm", '');
  },
  async (tok, S) => { // @863.7
    S.code = code(PCODE, 3.4, 6.3, 0.52); S.code.hl(0); S.a = sm('一條 edge 一條 edge 加，直到變成 spanning tree', 3.4, 2.4); cap('一個 edge 一個 edge 加進去', '');
  },
  async (tok, S) => { // @918.6
    S.g = mkG(QP, QE); note('示意圖', -3.4, 0.9); S.zone = blob(-4.4, 3.8, 1.9, 1.6, TC.green); pl('T', -5.9, 5.6);
    [['p', 'q'], ['p', 'r']].forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); QT.forEach((n) => S.g.vcol(n, TC.green));
    S.b = sm('T 一直是一棵 tree（growing tree）', -3.4, 0.35); cap('T 一直維持是 tree', '慢慢長大');
  },
  async (tok, S) => { // @963.2
    S.code.hl(1); S.c = sm('一開始：T = 任何一個端點都可以', 3.4, 1.85); cap('一開始選任何一個端點', '');
  },
  async (tok, S) => { // @975.9
    S.code.hl(3); QC.forEach(([u, v]) => S.g.ecol(u, v, TC.orange, true));
    S.d = pl('可以加的：' + QC.map((e) => en(e) + ' ' + e[2]).join('，'), -3.4, -0.25); cap('加的邊：一端在 T、一端不在 T', '');
  },
  async (tok, S) => { // @1029.0
    S.g.ecol('q', 'r', TC.hot, true); S.e = bad('q r 兩端都在 T 裡 → 會造成 cycle ✘', -3.4, 6.6); cap('這樣加不會有 cycle，還連通', '所以還是 tree');
  },
  async (tok, S) => { // @1059.1
    S.g.ecol('q', 'r', TC.edge, false); gone(S.e); S.code.hl(4); S.g.ecol(QBEST[0], QBEST[1], TC.green, true);
    S.e = good('greedy：挑 weight 最小的 → ' + en(QBEST) + '（' + QBEST[2] + '）', -3.4, 6.6); cap('很多選擇 → 挑 weight 最小的', 'greedy 就在這裡');
  },
  async (tok, S) => { // @1102.5
    S.code.hl(2); S.f = sm('每次多 1 個端點、1 條邊：做 n − 1 次 → n 點、n − 1 邊', 3.4, 1.3); cap('做 n − 1 次就是 spanning tree', '');
  },
  async (tok, S) => { // @1157.2
    S.code.hl(6); S.h = good('每步都是 tree、每次 weight 最小 → minimal spanning tree（後面證明）', 1.0, -0.8); cap('結果是 MST', '後面會證明');
  },
]);

function primPaint(S, k) {   // T after k Prim steps, on G
  const st = PR.steps[k]; S.g.reset(); PR.es.slice(0, k).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
  GN.forEach((n) => S.g.vcol(n, st && st.T.includes(n) ? TC.green : (k >= PR.steps.length ? TC.green : TC.node)));
}
function primOp(k, said) {
  return async (tok, S) => {
    const st = PR.steps[k]; primPaint(S, k); st.cand.forEach(([u, v]) => S.g.ecol(u, v, TC.orange, true)); S.g.ecol(st.e[0], st.e[1], TC.hot, true);
    gone(S.c1, S.c2);
    S.c1 = pl('T = {' + st.T.join(', ') + '}；可以加：' + st.cand.map((e) => en(e) + ' ' + e[2]).join('，'), 2.6, 5.3);
    S.c2 = good('最小 → 加 ' + en(st.e) + '（' + st.e[2] + '）', 2.6, 4.7);
    S.log.push(sm('第 ' + (k + 1) + ' 步：+' + en(st.e) + ' ' + st.e[2], 2.6, 3.9 - k * 0.45));
    cap(said || ('加 ' + en(st.e) + '（weight ' + st.e[2] + '）'), '一端在 T、一端不在 T 裡最小的');
  };
}
scene('g8d-prim-run', "27C：Prim's algorithm 跑老師的圖", [
  async (tok, S) => { // @1199.0
    S.g = gG(); S.log = []; S.n = note('同一張圖（擺放為示意）', -3.4, -0.2); cap('例子還是原來那張圖', '');
  },
  async (tok, S) => { // @1282.3
    S.t = hd(GN.length + ' 個端點：一開始 1 個，再做 ' + (GN.length - 1) + ' 次', 2.6, 6.6); cap('6 個端點：再做 5 次', '');
  },
  async (tok, S) => { // @1297.7
    primPaint(S, 0); S.c1 = pl('T = {A}', 2.6, 5.3); cap('從 A 開始', 'T 只有 A');
  },
  ...PR.steps.map((st, k) => primOp(k)),   // @1322.1 @1371.3 @1453.2 @1560.5 @1593.7
  async (tok, S) => { // @1646.0
    gone(S.c1, S.c2); primPaint(S, PR.steps.length); S.c1 = ok(isST(GN, PR.es), 2.6, 5.3, '全部端點都進來；一直是 tree → spanning tree ✓'); cap('全部端點都加進來了', 'T 一直是 tree');
  },
  async (tok, S) => { // @1691.2
    S.c2 = ok(PR_W === 15 && PR_W === MST_W && PR_W === sum(T3), 2.6, 4.7, 'total weight = ' + PR.es.map((e) => e[2]).join('+') + ' = ' + PR_W + ' = 前面的 T3 ✓'); cap('total weight = 15', '就是前面的 T3');
  },
  async (tok, S) => { // @1714.9
    S.c3 = hot('接下來：證明 Prim 一定給出 MST', 2.6, 1.3); cap('接下來證明 correctness', '');
  },
]);

// ════════ crMqlrIH4Ds（趙啟超 27D：Prim's algorithm 的 correctness 證明） ════════
// K：證明用的示意小圖（有兩棵以上 MST，才看得到 M ≠ M'）
const KP = { a: [-5.9, 4.9], b: [-3.3, 5.7], c: [-1.1, 3.6], d: [-2.6, 1.1], x: [-5.6, 2.0] };
const KE = [['a', 'b', 1], ['c', 'd', 1], ['b', 'c', 2], ['a', 'x', 2], ['d', 'x', 2], ['b', 'd', 3]];
const KN = Object.keys(KP);
const gK = (o = {}) => mkG(KP, KE, o);
const KST = allST(KN, KE), K_MW = Math.min(...KST.map(sum)), K_MN = KST.filter((t) => sum(t) === K_MW).length;
const isMST = (es) => isST(KN, es) && sum(es) === K_MW;
const KM = ['ab', 'cd', 'ax', 'dx'].map((nm) => KE.find((e) => en(e) === nm || e[1] + e[0] === nm));
const KPR = prim(KN, KE, 'a');                  // Prim 從 a：第 1 步 ab，第 2 步 bc
const PT = KPR.steps[1].T, Pe = KPR.steps[1].e;  // T = {a, b}，algorithm 選的 e
const PCYC = treePath(KM, Pe[0], Pe[1]);         // M 裡 e 兩端之間的 path → 加 e 後的 cycle
const PCROSS = cycleEdges(PCYC).filter(([u, v]) => PT.includes(u) !== PT.includes(v));
const Pe2 = KE.find((e) => key(e[0], e[1]) === key(PCROSS[0][0], PCROSS[0][1]));
const PM2 = KM.filter((e) => e !== Pe2).concat([Pe]);
function kBase(S, M, T) {
  S.g = gK(); note('示意圖', -3.5, 0.2);
  M.forEach(([u, v]) => S.g.ecol(u, v, TC.a, true));
  if (T) T.forEach((n) => S.g.vcol(n, TC.green));
}
const ln = (S, k, t, cls = '') => { S.LN = S.LN || []; gone(S.LN[k]); S.LN[k] = tag(t, cls, 2.9, 6.4 - k * 0.62); return S.LN[k]; };

scene('g8d-prim-st', '27D：證明第一步——Prim 的 output 是 spanning tree', [
  async (tok, S) => { // @9.0
    S.g = gG(); ln(S, 0, '要證：Prim 的 output 是 minimal spanning tree', 'ptr'); cap('證明 Prim 的 correctness', '');
  },
  async (tok, S) => { // @25.6
    ln(S, 1, '先確定是 spanning tree，再證 minimal', 'idx'); cap('先證是 spanning tree', '再證 minimal');
  },
  async (tok, S) => { // @33.7
    PR.es.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); ln(S, 2, '每次加的邊都接在原來的 T 上 → connected'); cap('connected：每條邊都接在 T 上', '');
  },
  async (tok, S) => { // @48.4
    ln(S, 3, '做 n − 1 次：' + GN.length + ' 個端點、' + PR.es.length + ' 條邊'); cap('n 個端點、n − 1 條邊', '');
  },
  async (tok, S) => { // @67.7
    ln(S, 4, '每條邊一端在 T、一端不在 → 不會有 cycle'); cap('不會有 cycle', '');
  },
  async (tok, S) => { // @77.8
    ln(S, 5, 'connected、沒 cycle、含所有端點 → spanning tree ✓', isST(GN, PR.es) ? 'good' : 'bad'); cap('所以是 spanning tree', '');
  },
]);

scene('g8d-prim-ih', '27D：歸納法——T 一直是某棵 MST 的 subtree', [
  async (tok, S) => { // @96.9
    kBase(S, [], null); ln(S, 0, '用數學歸納法證：output 是 minimal spanning tree', 'ptr'); cap('用數學歸納法', '');
  },
  async (tok, S) => { // @170.5
    KPR.es.slice(0, 1).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); ['a', 'b'].forEach((n) => S.g.vcol(n, TC.green));
    KM.forEach(([u, v]) => { if (!(key(u, v) === key('a', 'b'))) S.g.ecol(u, v, TC.a, true); });
    ln(S, 1, 'Induction hypothesis：目前的 T 是某一棵 MST M 的 subtree'); ln(S, 2, '綠點金邊 = T，藍邊 = M 其他的邊（M weight ' + sum(KM) + '）', 'idx');
    cap('假設：T 是某棵 MST 的 subtree', '');
  },
  async (tok, S) => { // @220.8
    ln(S, 3, 'subtree：某棵 tree 的 subgraph，本身也是 tree', 'idx'); cap('subtree 是什麼？', '');
  },
  async (tok, S) => { // @243.2
    ln(S, 4, '一直成立 → 最後 T 含所有端點，就是那棵 MST'); cap('一直成立，最後就是 MST', '');
  },
  async (tok, S) => { // @278.6
    S.g.vcol('b', TC.node); S.g.ecol('a', 'b', TC.a, true); ln(S, 5, 'Basis：一開始 T 只有一個端點，每棵 MST 都含它 ✓', 'good'); cap('basis：一開始只有一個端點', '一定成立');
  },
  async (tok, S) => { // @326.0
    S.g.vcol('b', TC.green); S.g.ecol('a', 'b', TC.gold, true); S.g.ecol(Pe[0], Pe[1], TC.yel, true);
    ln(S, 6, 'Induction step：加上 algorithm 選的 e（黃）後，仍是某棵 MST M′ 的 subtree'); cap('加上 e 之後還是某棵 MST 的一部分', '');
  },
  async (tok, S) => { // @394.5
    ln(S, 7, "M′ 不一定等於 M：這張圖 weight " + K_MW + ' 的 MST 有 ' + K_MN + ' 棵（列舉）', K_MN > 1 ? 'note' : 'bad'); cap("M' 不一定跟 M 一樣", 'MST 不一定唯一');
  },
]);

const KM1 = KST.find((t) => isMST(t) && t.some((e) => e === Pe) && t.some((e) => key(e[0], e[1]) === key('a', 'b')));
scene('g8d-prim-case1', '27D：Case 1——e 本來就在 M 裡', [
  async (tok, S) => { // @460.9
    kBase(S, KM1, PT); S.g.ecol('a', 'b', TC.gold, true); ln(S, 0, '分兩個 case：e ∈ M，或 e ∉ M', 'ptr'); cap('分兩個 case 討論', '');
  },
  async (tok, S) => { // @477.2
    S.g.ecol(Pe[0], Pe[1], TC.yel, true); ln(S, 1, 'e = ' + en(Pe) + ' 本來就在 M 裡（藍邊）→ M′ = M，證完 ✓', isMST(KM1) ? 'good' : 'bad'); cap('e 在 M 裡：M′ 就是 M', '天下太平');
  },
]);

function pTboundary(S) { S.zone = blob(-4.6, 5.3, 2.0, 1.0, TC.green, 0.2, 0.25); pl('T', -6.4, 6.1); }
scene('g8d-prim-case2', "27D：Case 2——e 不在 M 裡，用 e' 交換", [
  async (tok, S) => { // @521.6
    kBase(S, KM, PT); S.g.ecol('a', 'b', TC.gold, true); pTboundary(S); ln(S, 0, 'Case 2：e = ' + en(Pe) + ' 不在 M 裡（M = 藍邊）', 'ptr'); cap('e 不在 M 裡', '');
  },
  async (tok, S) => { // @589.0
    S.ed = dash([S.g.P[Pe[0]], S.g.P[Pe[1]]], TC.yel, 0.07); paintPath(S.g, PCYC, TC.orange);
    ln(S, 1, '把 e 加進 M：兩端早就在 M 裡 → 唯一的 cycle ' + PCYC.join('') + Pe[0]); cap('e 加進 M 會產生一個 cycle', '');
  },
  async (tok, S) => { // @690.2
    ln(S, 2, 'e 是 algorithm 選的：候選 ' + KPR.steps[1].cand.map((e) => en(e) + ' ' + e[2]).join('，') + ' → ' + en(Pe), 'idx'); cap('補一句：e 是 algorithm 選的邊', '');
  },
  async (tok, S) => { // @791.5
    ln(S, 3, 'e 的條件：一端（' + Pe[0] + '）在 T、一端（' + Pe[1] + '）不在 T'); cap('e：一端在 T、一端不在 T', '');
  },
  async (tok, S) => { // @849.6
    S.g.ecol(Pe2[0], Pe2[1], TC.hot, true); ln(S, 4, "沿 cycle 走回 T：一定還有一條 e′ = " + en(Pe2) + ' 也跨過 T 的邊界'); cap("沿著 cycle 繞，找到 e'", '它也一端在 T、一端不在');
  },
  async (tok, S) => { // @880.1
    S.zone.material.opacity = 0.32; ln(S, 5, '示意：綠區 = T；黃 = e 出去，紅 = e′ 回來', 'idx'); cap('老師畫的示意圖', '出去了一定要再回來');
  },
  async (tok, S) => { // @1070.9
    ln(S, 6, "e′ 也夠資格被加，但 algorithm 選了 e → w(e′) = " + Pe2[2] + ' ≥ w(e) = ' + Pe[2] + ' ✓', Pe2[2] >= Pe[2] ? 'good' : 'bad'); cap("所以 w(e') ≥ w(e)", '不然會選 e′');
  },
  async (tok, S) => { // @1163.5
    gone(S.ed); S.g.reset(); PM2.forEach(([u, v]) => S.g.ecol(u, v, TC.a, true)); S.g.ecol(Pe[0], Pe[1], TC.yel, true);
    S.cut = dash([S.g.P[Pe2[0]], S.g.P[Pe2[1]]], TC.hot, 0.03);
    ln(S, 7, 'M′ = M + e − e′：cycle 被打斷、端點都還在 → spanning tree ✓', isST(KN, PM2) ? 'good' : 'bad'); cap("M + e − e'：還是 spanning tree", '');
  },
  async (tok, S) => { // @1270.0
    ln(S, 8, 'w(M′) = ' + sum(KM) + ' + ' + Pe[2] + ' − ' + Pe2[2] + ' = ' + sum(PM2) + ' ≤ w(M) → M′ 也是 MST ✓', isMST(PM2) ? 'good' : 'bad'); cap('weight 不會增加 → M′ 也是 MST', '');
  },
  async (tok, S) => { // @1385.6
    S.g.ecol('a', 'b', TC.gold, true); ln(S, 9, 'M′ 包含 T 和 e → induction step 成立 ✓', PM2.includes(Pe) && PM2.some((e) => key(e[0], e[1]) === key('a', 'b')) ? 'good' : 'bad'); cap('M′ 包含 T 和 e', 'induction step 完成');
  },
  async (tok, S) => { // @1452.7
    ln(S, 10, '每一步都成立 → 最後的 T 就是一棵 MST', 'ptr alt'); cap('每一步都成立 → 最後是 MST', '');
  },
]);

scene('g8d-prim-sum', '27D：證明重點整理', [
  async (tok, S) => { // @1475.8
    ln(S, 0, '每一步造出來的 T 都是某棵 MST 的 subtree', 'ptr'); ln(S, 1, '一開始成立；每一步都成立；最後就是 MST', ''); cap('整理：每一步都是某棵 MST 的 subtree', '');
  },
  async (tok, S) => { // @1515.5
    ln(S, 2, 'M′ 怎麼找：e ∈ M → M′ = M；e ∉ M → 加 e、拿掉 e′', 'good'); cap("關鍵：M' 怎麼找", '');
  },
  async (tok, S) => { // @1553.4
    ln(S, 3, 'greedy 會 work 的例子；下次：另一個 greedy（Kruskal）', 'idx'); cap('greedy 會 work 的一個例子', '下次講另一個');
  },
], { cam: [[0, 3.6, 15], [2.6, 3.4, 0]] });

// ════════ XAW_4UvQGWg（趙啟超 28A：Kruskal's algorithm、例子、證明 output 是 spanning tree） ════════
scene('g8d-prim-recap', '28A：回顧 Prim——一直維持 tree', [
  async (tok, S) => { // @4.4
    S.g = gG(); primPaint(S, PR.steps.length); ln(S, 0, 'Prim：T 從一個端點開始長大，最後含所有端點', 'ptr'); cap('回顧 Prim：growing tree', '');
  },
  async (tok, S) => { // @40.0
    ln(S, 1, 'greedy：維持 tree 的前提下，加 weight 最小的 edge'); cap('維持 tree，加 weight 最小的', '');
  },
  async (tok, S) => { // @56.2
    const T = PR.steps[2].T; primPaint(S, 2); const inside = GE.find((e) => T.includes(e[0]) && T.includes(e[1]) && !PR.es.slice(0, 2).includes(e));
    S.g.ecol(inside[0], inside[1], TC.hot, true);
    ln(S, 2, 'T = {' + T.join(', ') + '} 時，' + en(inside) + ' 兩端都在 T 裡 → cycle ' + treePath(PR.es.slice(0, 2), inside[0], inside[1]).join('') + inside[0], 'bad');
    ln(S, 3, '所以條件是：一端在 T 內、一端在 T 外', 'good'); cap('一端在內、一端在外', '不然就有 cycle');
  },
]);

const sortedTags = (S, x = 1.8, y = 6.3, dy = 0.55) => { S.sl = KR_ORDER.map((e, i) => pl(en(e) + '  ' + e[2], x, y - i * dy)); };
scene('g8d-kr-idea', "28A：Kruskal's algorithm 的想法", [
  async (tok, S) => { // @76.6
    S.g = gG(); S.t = hd("另一個 greedy：Kruskal's algorithm", 2.6, 7.0); cap("另一個 greedy：Kruskal's algorithm", '');
  },
  async (tok, S) => { // @94.9
    ln(S, 1, 'Prim 一直維持 tree；Kruskal 不要求', 'idx'); cap('Kruskal 不要求一直是 tree', '');
  },
  async (tok, S) => { // @116.0
    sortedTags(S, 1.4, 5.0, 0.5); ln(S, 2, '從 weight 小的 edge 開始，一條一條加', ''); cap('從 weight 最小的開始一條條加', '');
  },
  async (tok, S) => { // @132.4
    ln(S, 3, '會形成 cycle 的就不加，換下一條', 'bad'); cap('會形成 cycle 就不加', '換下一個');
  },
  async (tok, S) => { // @166.6
    ln(S, 4, '過程中不一定是 tree；最後是 spanning tree 就好', 'good'); cap('過程不一定是 tree', '最後是 spanning tree');
  },
], { cam: [[0, 3.6, 15], [0, 3.4, 0]] });

const KCODE = ['Kruskal', 'T = ∅', 'for i = 1 to n − 1:', '  e = 不在 T、加進 T 不會形成 cycle', '      的 edge 中 weight 最小的', '  T = T ∪ {e}', 'return T'];
scene('g8d-kr-algo', "28A：Kruskal's algorithm 的步驟", [
  async (tok, S) => { // @204.2
    S.code = code(KCODE, -2.6, 6.3, 0.55); S.code.hl(1); S.a = pl('T 是原圖的 subgraph，一開始是空集合', 3.4, 6.3); cap('T 一開始是空集合', '');
  },
  async (tok, S) => { // @220.2
    S.b = pl('n 個 vertices → spanning tree 要 n − 1 條 edge', 3.4, 5.6); cap('spanning tree 有 n − 1 條 edge', 'tree 的邊比點少 1');
  },
  async (tok, S) => { // @239.7
    S.code.hl(2); S.c = pl('for 迴圈做 n − 1 次，每次加一條', 3.4, 4.9); cap('for 迴圈做 n − 1 次', '');
  },
  async (tok, S) => { // @264.1
    S.code.hl(3); S.d = pl('挑不在 T 裡、weight 最小的', 3.4, 4.2); cap('挑 weight 最小的 edge', '');
  },
  async (tok, S) => { // @282.0
    S.code.hl(4); S.e = bad('條件：加進 T 不會形成 cycle', 3.4, 3.5); cap('條件：不會形成 cycle', '');
  },
  async (tok, S) => { // @321.9
    S.code.hl(6); S.f = sm('後面證明：結果是 spanning tree，而且是 MST', 3.4, 2.8); cap('後面證明它是 MST', '');
  },
  async (tok, S) => { // @330.7
    S.h = ok(KR_SORTED, 0.4, 1.4, '要先 sort：' + KR_ORDER.map((e) => en(e) + ' ' + e[2]).join(' ≤ ') + ' ✓'); cap('要先把 edge 照 weight 排好', 'sort');
  },
]);

function krOp(k) {
  return async (tok, S) => {
    const lg = KR.log[k]; const [u, v, w] = lg.e; const i = KR_ORDER.indexOf(lg.e);
    gone(S.cy); S.g.reset(); KR.acc.forEach((e) => { if (KR.log.slice(0, k).some((l) => l.ok && l.e === e)) S.g.ecol(e[0], e[1], TC.gold, true); });
    if (lg.ok) { S.g.ecol(u, v, TC.green, true); setCls(S.sl[i], 'good'); txt(S.sl[i], en(lg.e) + '  ' + w + '  ✓ 加入'); }
    else { S.g.ecol(u, v, TC.hot, true); paintPath(S.g, lg.path, TC.orange); setCls(S.sl[i], 'bad'); txt(S.sl[i], en(lg.e) + '  ' + w + '  ✘ cycle'); S.cy = bad('加 ' + en(lg.e) + ' 會形成 cycle ' + lg.path.join('') + ' → 不加', -3.4, -0.2); }
    cap(lg.ok ? ('加 ' + en(lg.e) + '（weight ' + w + '）') : (en(lg.e) + ' 會形成 cycle'), lg.ok ? '不會形成 cycle' : '不能加，換下一個');
  };
}
scene('g8d-kr-run', "28A：Kruskal's algorithm 跑老師的圖", [
  async (tok, S) => { // @436.0
    S.g = gG(); S.t = hd('同一張圖：' + GN.length + ' 個端點、' + GE.length + ' 條 edge', 0.8, 7.0); note('擺放為示意', -3.4, -0.7); cap('同一個圖：6 個端點、10 條 edge', '');
  },
  async (tok, S) => { // @462.7
    S.sl = KR_ORDER.map((e, i) => pl(en(e) + '  ' + e[2], i < 5 ? 1.2 : 4.6, 6.3 - (i % 5) * 0.55)); S.s = ok(KR_SORTED, 3.6, 3.5, '照 weight sort 好 ✓'); // the sorted list in two columns, the remarks under it cap('先 sort', '從小排到大');
  },
  krOp(0), krOp(1), krOp(2), // @473.7 @520.4 @569.7
  async (tok, S) => { // @596.2
    gone(S.s); S.cnt = pl('要 ' + (GN.length - 1) + ' 條邊：已 3 條，再 2 步', 3.6, 3.4); cap('共要 5 條邊：再兩步', '');
  },
  krOp(3), krOp(4), krOp(5), // @616.0 @712.0 @731.3
  async (tok, S) => { // @748.0
    gone(S.cy, S.cnt); S.g.reset(); KR.acc.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
    S.cnt = ok(isST(GN, KR.acc) && KR_W === PR_W && KR_W === MST_W, 3.6, 3.4, 'spanning tree：' + KR.acc.map((e) => e[2]).join('+') + ' = ' + KR_W + ' = Prim ✓');
    cap('total weight 15', '和 Prim 找到的一樣');
  },
  async (tok, S) => { // @781.1
    S.p = pl('Prim：只加一端在 T 內的邊 → 一直是 tree', 3.6, 2.65); cap('Prim 的 T 一直是 tree', '');
  },
  async (tok, S) => { // @804.8
    const cs = [2, 3, 4, 5].map((m) => compCount(KR.acc.slice(0, m)));
    S.q = pl('Kruskal：2～5 條邊時 ' + cs.join('、') + ' 個 component', 3.6, 1.9); S.q2 = sm('過程中不一定 connected（只算接到邊的點）', 3.6, 1.2);
    cap('Kruskal 過程中不一定 connected', '最後才變一個 component');
  },
  async (tok, S) => { // @843.5
    S.r = good('都是 greedy：一個顧 tree，一個顧 weight', 3.6, 0.45); cap('都是 greedy，出發點不同', '');
  },
], { cam: [[0, 3.6, 15], [0.4, 3.3, 0]] });

// 證明一的示意：如果 T 有 2 個 component（n = 6、5 條邊）
const FP = { p: [-6.0, 4.8], q: [-4.8, 5.8], r: [-4.6, 4.2], s: [-3.4, 5.0], t: [-2.2, 4.6], u: [-1.2, 5.6], w: [-1.0, 3.8] };
const FE = [['p', 'q'], ['q', 'r'], ['q', 's'], ['t', 'u'], ['t', 'w']];
scene('g8d-kr-st', '28A：證明一——Kruskal 的 output 是 spanning tree', [
  async (tok, S) => { // @880.7
    ln(S, 0, '要證：Kruskal 的 output 是 minimal spanning tree', 'ptr'); cap('證明 Kruskal 的 correctness', '');
  },
  async (tok, S) => { // @919.4
    ln(S, 1, '比 Prim 多一步：先證 output 是 spanning tree', ''); cap('比 Prim 多證一部分', '');
  },
  async (tok, S) => { // @952.1
    S.g = gG({ s: 0.75, dx: -1.6, dy: 0.6, r: 0.8 }); KR.acc.slice(0, 3).forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
    S.n1 = sm('剛才第 3 步：' + compCount(KR.acc.slice(0, 3)) + ' 塊，不 connected', -4.2, 0.0); ln(S, 2, '過程中不一定 connected，所以要另外證', 'idx'); cap('過程中不一定 connected', '');
  },
  async (tok, S) => { // @997.3
    ln(S, 3, 'output T：G 的 subgraph（點、邊都來自 G）'); cap('T 是 G 的 subgraph', '');
  },
  async (tok, S) => { // @1034.5
    ln(S, 4, 'for 迴圈做 n − 1 次 → T 有 n − 1 條 edge'); cap('T 有 n − 1 條 edge', '');
  },
  async (tok, S) => { // @1051.6
    ln(S, 5, '每次都確定不會形成 cycle → T 沒有 cycle'); cap('T 沒有 cycle', '');
  },
  async (tok, S) => { // @1098.3
    gone(S.g, S.n1); ln(S, 6, '差在：T 可能不只一個 component？', 'bad'); cap('問題：會不會不只一個 component？', '');
  },
  async (tok, S) => { // @1151.0
    S.f = mkG(Object.fromEntries(Object.entries(FP).map(([k, p]) => [k, [p[0], p[1] - 1.6]])), FE.map((e) => [...e, null]), { nm: () => '' });
    FE.forEach(([u, v]) => S.f.ecol(u, v, TC.gold, true)); note('示意：假設 T 有 2 個 component', -3.6, 1.2);
    ln(S, 7, '沒有 cycle → 每個 component 都是 tree（forest）'); cap('每個 component 都是 tree', 'T 是 forest');
  },
  async (tok, S) => { // @1267.4
    S.c1 = sm('4 點 3 邊', -4.8, 5.0); S.c2 = sm('3 點 2 邊', -1.6, 5.0); ln(S, 8, 'tree：端點數 = 邊數 + 1'); cap('tree 的端點比邊多 1', '');
  },
  async (tok, S) => { // @1323.8
    const n = GN.length; ln(S, 9, 'k 個 component → 端點數 = 邊數 + k；n = ' + n + '：' + [1, 2, 3].map((k) => 'k=' + k + '→' + (n - 1 + k)).join('，'));
    S.c3 = bad('5 條邊、2 個 component → ' + (3 + 2 + 2) + ' 個端點', -3.2, 1.8); cap('k 個 component：多 k 個端點', '');
  },
  async (tok, S) => { // @1342.8
    ln(S, 10, 'k ≥ 2 → 端點數 > n，但 T ⊆ G 只有 n 點 → 矛盾', 'bad'); cap('超過 n 個端點 → 矛盾', '');
  },
  async (tok, S) => { // @1533.6
    gone(S.f, S.c1, S.c2, S.c3); ln(S, 11, '所以 T 只有一個 component：connected、沒 cycle → tree', 'good'); cap('T connected、沒有 cycle → tree', '');
  },
  async (tok, S) => { // @1559.2
    S.g = gG({ s: 0.75, dx: -1.6, dy: 0.6, r: 0.8 }); KR.acc.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true));
    ln(S, 12, 'tree 有 n − 1 條邊 → n 個端點 → G 的端點全在 → spanning tree ✓', isST(GN, KR.acc) ? 'good' : 'bad'); cap('n 個端點全在 → spanning tree', '');
  },
  async (tok, S) => { // @1633.0
    ln(S, 13, '第二部分（下一段）：證明它是 minimal', 'ptr alt'); cap('接著證明它是 minimal', '');
  },
], { cam: [[0, 3.6, 15], [0.4, 3.0, 0]] });

// ════════ LIKCqbxc-sI（趙啟超 28B：Kruskal 證明二、複雜度） ════════
const KKR = kruskal(KN, KE.slice().sort((a, b) => a[2] - b[2]));
const KT = KKR.acc.slice(0, 2), Ke = KKR.acc[2];             // T = {ab, cd}，下一條加進來的 e
const kComp = (() => { const d = dsu(KN); KT.forEach(([u, v]) => d.u(u, v)); return d; })();
const inT = (n) => KT.some((e) => e[0] === n || e[1] === n);
const KCYC = treePath(KM, Ke[0], Ke[1]);
const KCYC_E = cycleEdges([...KCYC]);                         // path edges in M (cycle = these + e)
const KCROSS = KCYC_E.filter(([u, v]) => kComp.f(u) !== kComp.f(v));
const Ke2 = KE.find((e) => key(e[0], e[1]) === key(KCROSS[KCROSS.length - 1][0], KCROSS[KCROSS.length - 1][1]));
const KM2 = KM.filter((e) => e !== Ke2).concat([Ke]);
function kTzones(S) {
  S.z1 = blob(-4.6, 5.3, 1.9, 0.75, TC.green, 0.22, 0.27); S.z2 = blob(-1.85, 2.35, 0.75, 1.7, TC.green, 0.22, -0.5);
}
scene('g8d-kr-ih', '28B：證明二——T 一直是某棵 MST 的 subgraph', [
  async (tok, S) => { // @4.4
    ln(S, 0, '第二部分：output 不只是 spanning tree，而是 MST', 'ptr'); cap('證明二：它是 MST', '');
  },
  async (tok, S) => { // @21.4
    ln(S, 1, '方法跟 Prim 的證明很像，稍微修改', 'idx'); cap('跟 Prim 的證明很像', '');
  },
  async (tok, S) => { // @48.1
    kBase(S, [], null); KT.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); KN.filter(inT).forEach((n) => S.g.vcol(n, TC.green)); kTzones(S);
    ln(S, 2, 'T 不一定是 tree → 只能說：某棵 MST 的 subgraph'); cap('T 是某棵 MST 的 subgraph', '不能說 subtree');
  },
  async (tok, S) => { // @115.8
    KM.forEach(([u, v]) => { if (!KT.includes(KE.find((e) => key(e[0], e[1]) === key(u, v)))) S.g.ecol(u, v, TC.a, true); });
    ln(S, 3, 'Induction hypothesis：目前的 T 是某棵 MST M 的 subgraph（M = 金 + 藍）'); cap('同樣用歸納法', '');
  },
  async (tok, S) => { // @193.6
    ln(S, 4, 'Basis：一開始 T = ∅，當然是任何圖的 subgraph ✓', 'good'); cap('basis：空集合一定是 subgraph', '');
  },
  async (tok, S) => { // @213.4
    S.g.ecol(Ke[0], Ke[1], TC.yel, true); ln(S, 5, 'Step：加上下一條 e = ' + en(Ke) + '（黃）後，仍是某棵 MST M′ 的 subgraph'); cap('加上下一條 e 之後呢？', '');
  },
  async (tok, S) => { // @313.9
    ln(S, 6, 'e ∈ M → M′ = M，結束；主要看 e ∉ M', 'idx'); cap('e 在 M 裡就結束了', '主要看另一個 case');
  },
]);

scene('g8d-kr-case2', "28B：e 不在 M 裡——找 e' 交換", [
  async (tok, S) => { // @342.4
    kBase(S, KM, KN.filter(inT)); KT.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); kTzones(S);
    ln(S, 0, 'e = ' + en(Ke) + ' 不在 M 裡（M = 金 + 藍）', 'ptr'); cap('e 不在 M 裡', '');
  },
  async (tok, S) => { // @364.1
    S.ed = dash([S.g.P[Ke[0]], S.g.P[Ke[1]]], TC.yel, 0.07); paintPath(S.g, KCYC, TC.orange);
    ln(S, 1, '把 e 加進 M → 產生唯一的 cycle ' + KCYC.join('') + KCYC[0]); cap('把 e 加進 M：產生 cycle', '跟 Prim 一樣');
  },
  async (tok, S) => { // @415.6
    ln(S, 2, 'e 的條件：加進 T 不會形成 cycle'); cap('e 的條件：加進 T 不會有 cycle', '');
  },
  async (tok, S) => { // @444.9
    ln(S, 3, '也就是：e 的兩端不在 T 的同一個 component', 'good'); cap('兩端不在 T 的同一個 component', '不一定一端在 T 外');
  },
  async (tok, S) => { // @524.3
    const cmpOf = (n) => (inT(n) ? '{' + KN.filter((m) => inT(m) && kComp.f(m) === kComp.f(n)).join('') + '}' : '不在 T');
    ln(S, 4, '可能：一端不在 T／兩端都不在 T／在 T 的不同 component', 'idx');
    ln(S, 5, '這裡 e = ' + en(Ke) + '：' + Ke[0] + ' 在 ' + cmpOf(Ke[0]) + '，' + Ke[1] + ' 在 ' + cmpOf(Ke[1]), ''); cap('否定有好幾種情況', '');
  },
  async (tok, S) => { // @587.0
    S.g.ecol(Ke2[0], Ke2[1], TC.hot, true);
    ln(S, 6, "沿 cycle 走：另一條 e′ ≠ e，兩端也不在 T 的同一個 component"); cap("沿 cycle 繞，找到 e'", '');
  },
  async (tok, S) => { // @674.6
    ln(S, 7, '示意：綠 = T 的 component，橘 = cycle；e′ = ' + en(Ke2) + '（' + Ke2[1] + ' 根本不在 T 裡）', 'idx'); cap('老師畫的示意圖', '');
  },
  async (tok, S) => { // @813.9
    const all = KCROSS.map((e) => e[0] + e[1]).join('、'); ln(S, 8, '這只是一種狀況；cycle 上符合條件的有：' + all, 'idx'); cap('這只是其中一種狀況', '');
  },
  async (tok, S) => { // @854.8
    ln(S, 9, "e 和 e′ 都夠資格，algorithm 選了 e → w(e) = " + Ke[2] + ' ≤ w(e′) = ' + Ke2[2] + ' ✓', Ke[2] <= Ke2[2] ? 'good' : 'bad'); cap("w(e) ≤ w(e')", '不然會先選 e′');
  },
  async (tok, S) => { // @894.2
    gone(S.ed); S.g.reset(); KM2.forEach(([u, v]) => S.g.ecol(u, v, TC.a, true)); KT.forEach(([u, v]) => S.g.ecol(u, v, TC.gold, true)); S.g.ecol(Ke[0], Ke[1], TC.yel, true);
    S.cut = dash([S.g.P[Ke2[0]], S.g.P[Ke2[1]]], TC.hot, 0.03);
    ln(S, 10, 'M′ = M + e − e′：cycle 打斷 → spanning tree ✓', isST(KN, KM2) ? 'good' : 'bad'); cap("M + e − e' 還是 spanning tree", '');
  },
  async (tok, S) => { // @958.3
    ln(S, 11, 'w(M′) = ' + sum(KM) + ' + ' + Ke[2] + ' − ' + Ke2[2] + ' = ' + sum(KM2) + ' → M′ 是 MST，且含 T 和 e ✓', isMST(KM2) && KM2.includes(Ke) && KT.every((e) => KM2.includes(e)) ? 'good' : 'bad');
    cap("weight 沒增加 → M' 是 MST", '而且包含 T 和 e');
  },
  async (tok, S) => { // @1010.5
    ln(S, 12, '一路推到最後：T 是 spanning tree 又是某棵 MST 的 subgraph → T 就是 MST', 'ptr alt'); cap('最後 T 就是 MST', '');
  },
]);

scene('g8d-kr-cmp', '28B：兩個證明的比較', [
  async (tok, S) => { // @1028.7
    ln(S, 0, '和 Prim 的證明幾乎一模一樣，只換兩個地方：', 'ptr');
    ln(S, 1, 'subtree → subgraph', ''); ln(S, 2, '「一端在 T、一端不在」→「兩端不在 T 的同一個 component」', ''); cap('跟 Prim 的證明幾乎一樣', '只改條件');
  },
  async (tok, S) => { // @1064.0
    ln(S, 3, '過程中不一定是 tree，但最後一定是 MST', 'good'); cap('過程不是 tree，最後是 MST', '');
  },
  async (tok, S) => { // @1093.1
    ln(S, 4, '不是所有問題 greedy 都最好；但常常可以先從 greedy 想', 'note'); cap('greedy 不一定都最好', '但常是好的起點');
  },
], { cam: [[0, 3.6, 15], [2.6, 3.4, 0]] });

const HEAP = [1, 3, 2, 7, 4, 5];   // 示意：min-heap（parent ≤ children）
const HEAP_OK = HEAP.every((v, i) => !i || HEAP[(i - 1) >> 1] <= v);
scene('g8d-mst-cost', '28B：Prim 與 Kruskal 的複雜度', [
  async (tok, S) => { // @1133.7
    ln(S, 0, '複雜度（只講結果，不詳細推導）', 'ptr'); cap('稍微看一下複雜度', '');
  },
  async (tok, S) => { // @1139.5
    ln(S, 1, 'Prim 跟 Dijkstra 很像 → direct implementation：O(n²)'); cap('Prim 和 Dijkstra 很像', 'direct：O(n²)');
  },
  async (tok, S) => { // @1189.0
    ln(S, 2, '用 priority queue（binary heap）：O(e log₂ n)，e = edge 數'); cap('用 binary heap：O(e log n)', '');
  },
  async (tok, S) => { // @1255.0
    const pos = (i) => { const d = Math.floor(Math.log2(i + 1)), k = i + 1 - (1 << d); const w = 4.4 / (1 << d); return [-5.2 + w / 2 + k * w - 1.0, 5.6 - d * 1.3]; };
    HEAP.forEach((v, i) => { if (i) { const [x1, y1] = pos((i - 1) >> 1), [x2, y2] = pos(i); seg(x1, y1, x2, y2); } });
    S.hp = HEAP.map((v, i) => { const [x, y] = pos(i); const m = new THREE.Mesh(NG, new THREE.MeshStandardMaterial({ color: TC.node })); m.position.set(x, y, 0); m.add(lab.label(String(v), 'val')); lab.world.add(m); return m; });
    note('示意', -5.8, 6.4); ln(S, 3, 'binary heap：complete binary tree，parent ≤ children ' + (HEAP_OK ? '✓' : '✘'), HEAP_OK ? 'good' : 'bad');
    cap('binary heap：parent 比 children 小', '是一棵 complete binary tree');
  },
  async (tok, S) => { // @1284.4
    ln(S, 4, 'Kruskal：用 union-find 資料結構 → O(e log₂ e)'); cap('Kruskal：union-find，O(e log e)', '');
  },
  async (tok, S) => { // @1321.0
    ln(S, 5, '細節屬於資料結構課，這裡不講', 'idx'); cap('細節是資料結構課的內容', '');
  },
  async (tok, S) => { // @1341.3
    ln(S, 6, '兩個找 MST 的 greedy algorithm：Prim、Kruskal，都會 work', 'good'); cap('Prim 和 Kruskal 都是 greedy', '都找得到 MST');
  },
]);
  }

  // ═══ g8e.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第29A–30B講：Matching Problems）— cued scenes ───
// bipartite graph、matching、maximum／complete matching、augmenting alternating path、Hungarian algorithm
// （modified BFS 長 alternating tree、Hungarian tree／acorn）、正確性證明、R(A)、Hall's theorem、deficiency δ(G)。
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的例子照用：dance party 8 女 8 男（A: a e f g h、B: b c h、C: c e f g、D: d h、E: b c d、F: b d、G: a b c d、H: b c d），
// 照老師的順序配：A–a、B–b、C–c、D–d → E 卡住 → E–b–B–h → F–b–E–c–C–e → G–a–A–f → H 長出 Hungarian tree。
// 每一步的 matching 大小、R(A)、δ(G)、Hall 條件都用程式暴力算（✓／✘）。老師口頭舉、黑板看不清的例子一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const settxt = (l, t) => { if (l && l.element) l.element.textContent = t; };
const T = (t, c, x, z, y = 0.4) => tag(t, c, x, y, z);
const LL = (t, c, x, z, y = 0.4) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const ok = (b, x, z, t) => T(b ? t : t.replace(/✓/g, '✘'), b ? 'good' : 'bad', x, z);
const SI = (x, z) => T('示意', 'idx', x, z);
const CAM = [[0, 12.5, 7.8], [0, 0, 0.6]];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a board lying on the floor; the newest line is lit; old lines scroll away when it is full
function board(x = -7.3, z0 = -4.7, dz = 0.6, max = 15) {
  const st = stackBoard(x, 0.4, z0, { max: Math.min(max, 7), maxW: 200, pin: 12 }); let last = null;
  return {
    ls: st.ls,
    add(t, c = 'note') {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = st.line(t, c); l.userData.hot = c === 'note'; last = l; return l;
    },
  };
}
// ───────── graph kit: boxes for vertices, rods for edges (state = colour + thickness) ─────────
const GC = { girl: '#f2c4d6', boy: '#c4dcf2', hot: '#d64545', ok: '#2fc092', gold: '#c08a1f', dim: '#e6ddcd', new: '#e9c53a', x: '#f2c4d6', y: '#c4dcf2' };
const EC = {
  g: ['#a89878', 0.035],   // an edge of the graph, not in the matching
  m: ['#2fc092', 0.1],     // in the matching
  p: ['#dd8238', 0.08],    // on the path, not in the matching
  pm: ['#1f9e74', 0.12],   // on the path, in the matching
  bad: ['#d64545', 0.09],
  dim: ['#ddd3c2', 0.025],
  t: ['#c08a1f', 0.07],    // tree edge
  A: ['#4b9ee2', 0.09],    // edge of A-matching (proof)
  B: ['#dd8238', 0.09],    // edge of B-matching (proof)
  k: ['#e9c53a', 0.06],    // a new edge (set K)
  ok: ['#2fc092', 0.08],
};
function rod(x1, z1, x2, z2) {
  const a = V3(x1, 0.22, z1), b = V3(x2, 0.22, z2);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.max(0.01, a.distanceTo(b)), 8), new THREE.MeshStandardMaterial({ color: '#a89878', roughness: 0.6 }));
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  lab.world.add(m); return m;
}
function G() {
  const g = { V: {}, E: {}, P: {}, L: {} };
  g.v = (n, x, z, c, name, sz = 0.5) => {
    const m = lab.box(c, [sz, 0.32, sz]); m.userData.lbl = lab.label(name ?? n, 'val'); m.add(m.userData.lbl);
    m.position.set(x, 0.3, z); lab.world.add(m); g.V[n] = m; g.P[n] = [x, z]; return m;
  };
  g.key = (a, b) => (g.E[a + '|' + b] ? a + '|' + b : b + '|' + a);
  g.has = (a, b) => !!g.E[g.key(a, b)];
  g.e = (a, b, st = 'g', show = true) => {
    const [x1, z1] = g.P[a], [x2, z2] = g.P[b];
    const m = rod(x1, z1, x2, z2); g.E[a + '|' + b] = m; g.set(a, b, st); m.visible = show; return m;
  };
  g.set = (a, b, st) => {
    const m = g.E[g.key(a, b)]; if (!m) return; const [c, r] = EC[st];
    m.material.color.set(c); m.scale.set(r / 0.05, 1, r / 0.05); m.visible = true; m.userData.st = st;
  };
  g.st = (a, b) => (g.E[g.key(a, b)] || { userData: {} }).userData.st;
  g.hide = (a, b) => { const m = g.E[g.key(a, b)]; if (m) m.visible = false; };
  g.vc = (n, c) => { g.V[n].material.color.set(c); };
  g.glow = (n, c) => { g.V[n].material.emissive = new THREE.Color(c || '#000000'); };
  g.kill = () => { Object.values(g.V).forEach((m) => kill(m)); Object.values(g.E).forEach((m) => lab.world.remove(m)); Object.values(g.L).forEach((l) => kill(l)); };
  return g;
}
// ───────── the lecturer's dance party ─────────
const LIKE = { A: 'aefgh', B: 'bch', C: 'cefg', D: 'dh', E: 'bcd', F: 'bd', G: 'abcd', H: 'bcd' };
const GIRLS = [...'ABCDEFGH'], BOYS = [...'abcdefgh'];
const GNAME = { A: 'Alice', B: 'Betty', C: 'Cindy', D: 'Doris', E: 'E（名字聽不清）', F: 'Flo', G: 'Gloria', H: 'Hazel' };
const BNAME = { a: 'Art', b: 'Bill', c: 'Carl', d: 'Don', e: 'Eric', f: 'Frank', g: 'Gary', h: 'Hal' };
const PX = 0.4, PY = 3.0, pz = (i) => -3.5 + i;
const ADJ = Object.fromEntries(GIRLS.map((x) => [x, [...LIKE[x]]]));
// the matchings of the lecturer's run (girl → boy)
const M4 = { A: 'a', B: 'b', C: 'c', D: 'd' };
const M5 = { A: 'a', B: 'h', C: 'c', D: 'd', E: 'b' };
const M6 = { A: 'a', B: 'h', C: 'e', D: 'd', E: 'c', F: 'b' };
const M7 = { A: 'f', B: 'h', C: 'e', D: 'd', E: 'c', F: 'b', G: 'a' };
function party(o = {}) {
  const g = G();
  GIRLS.forEach((n, i) => g.v(n, PX, pz(i), GC.girl, n));
  BOYS.forEach((n, i) => g.v(n, PY, pz(i), GC.boy, n));
  if (o.names) GIRLS.forEach((n, i) => { g.L[n] = T(GNAME[n], 'idx', PX - 1.15, pz(i)); });
  if (o.bnames) BOYS.forEach((n, i) => { g.L[n] = T(BNAME[n], 'idx', PY + 0.85, pz(i)); });
  if (o.edges !== false) GIRLS.forEach((x) => ADJ[x].forEach((y) => g.e(x, y, 'g', o.edges !== 'hidden')));
  if (o.M) paintM(g, o.M);
  return g;
}
function paintM(g, M) {
  GIRLS.forEach((x) => ADJ[x].forEach((y) => { if (g.has(x, y)) g.set(x, y, M[x] === y ? 'm' : 'g'); }));
}
// ───────── brute force (everything shown on stage is computed here) ─────────
const isMatching = (M) => { const ys = Object.values(M); return new Set(ys).size === ys.length; };
const inGraph = (adj, M) => Object.entries(M).every(([x, y]) => adj[x].includes(y));
const msize = (M) => Object.keys(M).length;
function maxMatch(adj, X = Object.keys(adj)) {
  let bestN = -1, best = {}; const used = new Set(), cur = {};
  (function rec(i, n) {
    if (n + (X.length - i) <= bestN) return;
    if (i === X.length) { bestN = n; best = { ...cur }; return; }
    const x = X[i];
    for (const y of adj[x]) if (!used.has(y)) { used.add(y); cur[x] = y; rec(i + 1, n + 1); used.delete(y); delete cur[x]; }
    rec(i + 1, n);
  })(0, 0);
  return { n: bestN, M: best };
}
const Rof = (adj, A) => [...new Set(A.flatMap((x) => adj[x]))].sort();
function subsets(X) { const out = []; for (let s = 0; s < 1 << X.length; s++) out.push(X.filter((_, i) => (s >> i) & 1)); return out; }
function deficiency(adj, X = Object.keys(adj)) { let d = 0, arg = []; subsets(X).forEach((A) => { const v = A.length - Rof(adj, A).length; if (v > d) { d = v; arg = A; } }); return { d, arg }; }
const hallOK = (adj, X = Object.keys(adj)) => subsets(X).every((A) => Rof(adj, A).length >= A.length);
// modified BFS: grow the alternating tree from an unmatched x (edges not in M down to y, then the M edge up to x)
function altTree(adj, M, root) {
  const mate = Object.fromEntries(Object.entries(M).map(([x, y]) => [y, x]));
  const xs = [root], ys = [], par = {}; let found = null;
  for (let k = 0; k < xs.length && !found; k++) {
    const x = xs[k];
    for (const y of adj[x]) {
      if (M[x] === y || ys.includes(y)) continue;
      ys.push(y); par[y] = x;
      if (!mate[y]) { found = y; break; }
      xs.push(mate[y]); par[mate[y]] = y;
    }
  }
  let path = null;
  if (found) { path = [found]; let v = found; while (v !== root) { v = par[v]; path.unshift(v); } }
  return { xs, ys, found, path };
}
function flip(M, path) { const N = { ...M }; for (let i = 0; i + 1 < path.length; i += 2) N[path[i]] = path[i + 1]; return N; }
const sameM = (P1, P2) => JSON.stringify(Object.entries(P1).sort()) === JSON.stringify(Object.entries(P2).sort());
const mtxt = (M) => Object.keys(M).sort().map((x) => x + '–' + M[x]).join('  ');
// paint a path (list of vertex names, x first) on graph g: edges alternate not-in / in M
function paintPath(g, path, M) { for (let i = 0; i + 1 < path.length; i++) { const [u, v] = [path[i], path[i + 1]]; const x = GIRLS.includes(u) ? u : v, y = x === u ? v : u; g.set(u, v, M[x] === y ? 'pm' : 'p'); } }
// a small tree drawn on the right (alternating tree): nodes placed by hand in the lecturer's order
const TX = (k, n) => 6.0 + (k - (n - 1) / 2) * 0.78, TZ = (lv) => -3.9 + lv * 1.45;
function tnode(g, n, k, w, lv) { const isX = GIRLS.includes(n); g.v('t' + n, TX(k, w), TZ(lv), isX ? GC.girl : GC.boy, n, 0.42); }
function tedge(g, a, b, st) { g.e('t' + a, 't' + b, st); }

// ════════ EIEm2TDxzGE（第29A講：dance party、matching problem、bipartite graph、matching、maximum／complete matching、先配配看） ════════
scene('g8e-party', 'Dance party：每個女生能不能配到喜歡的男生？', [
  async (tok, S) => {
    S.B = board(); S.B.add('Dance party：8 girls、8 boys');
    S.g = party({ edges: 'hidden' });
    T('girls', 'zone', PX, -4.4); T('boys', 'zone', PY, -4.4);
    cap('一個 party：8 個女孩、8 個男孩', '左邊粉紅是女生，右邊藍色是男生');
  },
  async (tok, S) => { S.B.add('表：每個女生喜歡的男生列在右邊'); cap('下面有一張表', '每個女生喜歡哪些男生'); },
  async (tok, S) => {
    GIRLS.forEach((n, i) => { S.g.L[n] = T(GNAME[n], 'idx', PX - 1.15, pz(i)); });
    cap('女生：Alice、Betty、Cindy、Doris…', '…Flo、Gloria、Hazel：開頭剛好是 A 到 H');
  },
  async (tok, S) => {
    BOYS.forEach((n, i) => { S.g.L[n] = T(BNAME[n], 'idx', PY + 0.85, pz(i)); });
    cap('男生也是 A 到 H 開頭', 'Art、Bill、Carl、Don、Eric、Frank、Gary、Hal');
  },
  async (tok, S) => { S.B.add('A（Alice）：a e f g h'); S.g.glow('A', '#553300'); cap('Alice 喜歡 Art、Eric、Frank、Gary、Hal', '用小寫字母：a e f g h'); },
  async (tok, S) => { S.g.glow('A'); S.B.add('B（Betty）：b c h'); cap('Betty 喜歡 b、c、h', ''); },
  async (tok, S) => { S.B.add('C（Cindy）：c e f g'); cap('Cindy 喜歡 c、e、f、g', ''); },
  async (tok, S) => { S.B.add('D（Doris）：d h'); S.B.add('E：b c d'); cap('Doris 喜歡 d、h', '第 5 個女生 E 喜歡 b、c、d'); },
  async (tok, S) => { S.B.add('F（Flo）：b d'); cap('Flo 喜歡 b、d', ''); },
  async (tok, S) => { S.B.add('G（Gloria）：a b c d'); cap('Gloria 喜歡 a、b、c、d', ''); },
  async (tok, S) => {
    S.B.add('H（Hazel）：b c d');
    const n = GIRLS.reduce((s, x) => s + ADJ[x].length, 0);
    ok(n === 26, 5.6, 4.3, '表上一共 ' + n + ' 個「喜歡」✓');
    cap('Hazel 喜歡 b、c、d', '整張表就這樣');
  },
  async (tok, S) => { S.B.add('你是 organizer：幫每個女生配一個男伴', 'note'); cap('你是 party 的 organizer', '這是 dance party，要幫每個女生配一個舞伴'); },
  async (tok, S) => { S.B.add('能不能讓每個女生都跟她喜歡的男生跳舞？', 'note'); cap('Is it possible for each girl', 'to dance with a boy she likes?'); },
  async (tok, S) => {
    S.g.e('A', 'a', 'ok'); S.c1 = T('Alice–Art ✓（她喜歡）', 'good', 5.6, -3.5);
    cap('例如 Art 配給 Alice：可以', '因為 Art 在 Alice 的清單裡');
  },
  async (tok, S) => {
    S.g.e('A', 'd', 'bad'); S.c2 = T('Alice–Don ✘（她不喜歡）', 'bad', 5.6, -2.9);
    cap('Don 配給 Alice：不可以', 'Alice 不喜歡 Don');
  },
  async (tok, S) => {
    S.g.hide('A', 'a'); S.g.hide('A', 'd'); kill(S.c1); kill(S.c2);
    S.B.add('希望配到的越多越好；最好每個女生都配到');
    cap('organizer 當然希望越多人配到越好', '最好是每一個女生都配到喜歡的舞伴');
  },
  async (tok, S) => { S.B.add('條件 1：每個女生 exactly 配一個她喜歡的男生', 'note'); cap('條件一：每個女生配一個男生', '而且這個男生要在她喜歡的清單裡'); },
  async (tok, S) => {
    S.B.add('條件 2：每個男生只能配一個女生', 'note');
    S.g.e('B', 'c', 'bad'); S.g.e('C', 'c', 'bad'); S.c3 = T('Carl 不能同時配 Betty 和 Cindy ✘', 'bad', 5.6, -1.5);
    cap('條件二：每個男生只能配一個女生', 'Betty、Cindy 都喜歡 Carl，但 Carl 不能配兩個');
  },
  async (tok, S) => {
    S.g.hide('B', 'c'); S.g.hide('C', 'c'); kill(S.c3);
    S.B.add('目標：配到的女生越多越好', 'good');
    cap('在這兩個條件下', '希望越多女生被配到越好，最好全部都配到');
  },
]);

scene('g8e-draw', '把喜歡關係畫成 bipartite graph', [
  async (tok, S) => {
    S.B = board(); S.B.add('matching problem＝配對問題'); S.B.add('要配對，而且配得越多越好', 'say');
    LL('喜歡清單', 'ptr', 4.6, -4.4); GIRLS.forEach((x, i) => LL(x + '：' + LIKE[x].split('').join(' '), 'say', 4.6, -3.5 + i));
    cap('這叫 matching problem', '中文就是「配對問題」');
  },
  async (tok, S) => {
    S.g = party({ edges: 'hidden' });
    S.B.add('女生、男生寫在兩邊，每個人一個點');
    cap('女生寫左邊、男生寫右邊', '每個人用一個點表示');
  },
  ...GIRLS.map((x) => async (tok, S) => {
    for (const y of ADJ[x]) { S.g.set(x, y, 'g'); await wt(tok, 160); }
    S.g.glow(x, '#553300'); GIRLS.forEach((z) => { if (z !== x) S.g.glow(z); });
    cap(x + ' 喜歡 ' + ADJ[x].join('、'), '女生和她喜歡的男生之間畫一條線');
    if (x === 'H') {
      const n = Object.values(S.g.E).filter((m) => m.visible).length;
      ok(n === 26, 0.4, 4.4, '畫了 ' + n + ' 條邊＝表上 26 個「喜歡」✓');
    }
  }),
  async (tok, S) => {
    S.g.glow('H');
    S.B.add('每個人 → 一個端點（vertex）'); S.B.add('「喜歡」→ 兩端點之間一條邊（edge）');
    cap('每個女生、每個男生都是一個端點', '女生喜歡男生，就在兩個端點之間連一條邊');
  },
  async (tok, S) => { S.B.add('大寫＝女生、小寫＝男生', 'say'); cap('剛好都是 A 到 H 開頭', '大寫字母是女生，小寫字母是男生'); },
  async (tok, S) => { S.B.add('這是 matching problem 的一個 case', 'good'); cap('這是 matching problem 的一個例子', '這種問題不只出現在這裡'); },
]);

scene('g8e-general', '一般的 matching problem：X、Y 兩個集合', [
  async (tok, S) => { S.B = board(); S.B.add('剛才是 general matching problem 的 special case'); cap('剛才的派對', '是一般 matching problem 的一個特例'); },
  async (tok, S) => {
    S.zx = lab.box('#f6dbe5', [2.2, 0.06, 7.4]); S.zx.position.set(0.6, 0.03, 0); lab.world.add(S.zx);
    S.zy = lab.box('#dbe9f6', [2.2, 0.06, 7.4]); S.zy.position.set(4.6, 0.03, 0); lab.world.add(S.zy);
    S.lx = T('X：girls', 'zone', 0.6, -4.2); S.ly = T('Y：boys', 'zone', 4.6, -4.2);
    S.B.add('兩個集合 X、Y（X＝女生、Y＝男生）');
    cap('matching problem 裡有兩個集合 X 和 Y', 'X 是 8 個女生，Y 是 8 個男生');
  },
  async (tok, S) => {
    S.g = G(); [0, 1, 2, 3].forEach((i) => { S.g.v('x' + i, 0.6, -2.4 + i * 1.6, GC.x, ''); S.g.v('y' + i, 4.6, -2.4 + i * 1.6, GC.y, ''); });
    [[0, 0], [0, 2], [1, 1], [2, 1], [2, 3], [3, 3]].forEach(([i, j]) => S.g.e('x' + i, 'y' + j));
    SI(2.6, 3.6);
    S.B.add('X 的每個 member 和 Y 的某些 member compatible');
    cap('X 的每個成員和 Y 的某些成員 compatible（合得來）', '在派對例子裡，compatible 就是「她喜歡」');
  },
  async (tok, S) => {
    settxt(S.lx, 'X：people'); settxt(S.ly, 'Y：jobs');
    S.B.add('例 2：職業介紹所，X＝人、Y＝工作');
    cap('另一個例子：職業介紹所', 'X 是來找工作的人，Y 是工作');
  },
  async (tok, S) => { S.B.add('一個人可適合好幾種工作，一個工作可有好幾人適合', 'say'); S.B.add('每人配一個工作、每個工作只給一個人'); cap('一個人可能適合好幾個工作', '但每人只配一個工作，一個工作也只給一個人'); },
  async (tok, S) => { S.B.add('配到的人越多，仲介費收越多', 'say'); cap('介紹所希望配成功的越多越好', '配到越多人，收的仲介費越多'); },
  async (tok, S) => { settxt(S.lx, 'X：positions'); settxt(S.ly, 'Y：players'); S.B.add('例 3：X＝守備位置、Y＝球員'); cap('再一個例子：運動比賽', 'X 是場上的位置，Y 是隊上可以上場的球員'); },
  async (tok, S) => {
    S.g.kill();
    S.pos = ['P', 'C', '1B', '2B', 'SS', '3B', 'RF', 'CF', 'LF', 'DH'].map((p, i) => { const m = lab.box(GC.x, [0.9, 0.3, 0.5]); m.add(lab.label(p, 'val')); m.position.set(0.6, 0.3, -3.6 + i * 0.8); lab.world.add(m); return m; });
    S.B.add('職棒指定打擊制：10 個位置');
    cap('職棒有指定打擊（DH）制的話', '場上有 10 個位置：投、捕、一二三壘、游擊、三個外野、DH');
  },
  async (tok, S) => {
    S.pl = [...Array(8)].map((_, i) => { const m = lab.box(GC.y, [0.5, 0.3, 0.5]); m.position.set(4.6, 0.3, -3.6 + i * 1.03); lab.world.add(m); return m; });
    T('（球員很多，只畫幾個）', 'idx', 4.6, 4.4);
    const g = G(); g.P = { p1: [0.6, -1.2], p2: [0.6, -0.4], q1: [4.6, -0.51], p3: [0.6, -2.0], q2: [4.6, -1.54] };
    g.e('p1', 'q1'); g.e('p2', 'q1'); g.e('p3', 'q2'); g.e('p1', 'q2'); SI(2.6, -2.6);
    S.B.add('一隊 26 人（以前 25），有人能守好幾個位置', 'say');
    cap('美國大聯盟 active roster 以前 25 人、今年 26 人', '很多是投手；有些人可以守游擊也可以守二壘');
  },
  async (tok, S) => { S.B.add('賽前排 lineup：每個位置都要有人', 'note'); S.B.add('一人不能守兩個位置', 'note'); cap('比賽前教練要排 lineup', '10 個位置都要有人；一個人不能同時守兩個位置'); },
  async (tok, S) => { S.B.add('這些都是 matching problem', 'good'); cap('這些問題本質都一樣', '都叫 matching problem'); },
]);

scene('g8e-def', 'Bipartite graph 與 matching 的定義', [
  async (tok, S) => { S.B = board(); S.g = party(); S.B.add('用 graph 描述：就是剛才那張圖'); cap('在 graph theory 裡', '用這樣子的一張圖來描述'); },
  async (tok, S) => { S.B.add('這種圖叫 bipartite graph', 'note'); cap('這種圖以前介紹過', '叫做 bipartite graph'); },
  async (tok, S) => {
    S.zx = lab.box('#f6dbe5', [1.0, 0.06, 8.4]); S.zx.position.set(PX, 0.03, 0); lab.world.add(S.zx);
    S.zy = lab.box('#dbe9f6', [1.0, 0.06, 8.4]); S.zy.position.set(PY, 0.03, 0); lab.world.add(S.zy);
    T('X', 'ptr', PX, -4.5); T('Y', 'ptr', PY, -4.5);
    S.B.add('vertex set 分成兩個 disjoint subsets X、Y');
    cap('端點可以 partition 成兩個 disjoint subsets', '左邊一群 X、右邊一群 Y，兩群沒有共同的點');
  },
  async (tok, S) => {
    S.bad = rod(PX - 0.35, pz(0), PX - 0.35, pz(1)); S.bad.material.color.set(GC.hot);
    S.bt = T('同一群裡不能有邊 ✘（示意）', 'bad', -1.5, -3.0);
    S.B.add('每條邊：一端在 X、另一端在 Y', 'note');
    cap('每條邊的兩個端點一個在 X、一個在 Y', '同一個 subset 裡面的點之間不會有邊');
  },
  async (tok, S) => { lab.world.remove(S.bad); kill(S.bt); S.B.add('G = (V, E) 是 bipartite graph'); cap('改用 graph theory 的語言', 'G = (V, E) 是一個 bipartite graph'); },
  async (tok, S) => { S.B.add('V = X ∪ Y，X ∩ Y = ∅'); cap('V 分成兩個 subset X 和 Y', 'X ∪ Y = V，兩個沒有交集'); },
  async (tok, S) => {
    const all = GIRLS.every((x) => ADJ[x].every((y) => BOYS.includes(y)));
    S.B.add('E 的每條邊：一個 vertex 在 X、另一個在 Y'); ok(all, 1.7, 4.4, '26 條邊都是 X–Y ✓');
    cap('edge set E 裡的每一條邊', '一個端點在 X，另一個在 Y');
  },
  async (tok, S) => { S.B.add('什麼叫一個 matching（配對）？', 'note'); cap('那什麼叫一個 matching？', '就是一組配對'); },
  async (tok, S) => { S.B.add('matching M ⊆ E：一些邊組成的集合'); cap('matching 是 edge set 的一個 subset', '裡面裝的都是邊'); },
  async (tok, S) => {
    S.B.add('條件：M 裡任兩條邊沒有共同端點', 'note');
    S.M = { A: 'a', B: 'b', C: 'c' }; paintM(S.g, S.M); SI(5.0, -3.0);
    ok(isMatching(S.M) && inGraph(ADJ, S.M), 5.0, -2.4, 'A–a、B–b、C–c 是 matching ✓');
    cap('No two edges in M share an endpoint', '綠色三條邊彼此沒有共用端點');
  },
  async (tok, S) => {
    S.g.set('A', 'e', 'bad'); S.t1 = T('A–a 和 A–e 共用 A ✘', 'bad', 5.0, -1.4);
    cap('同樣的端點不會在 X 那邊', '一個女生只配一個男生');
  },
  async (tok, S) => {
    S.g.set('A', 'e', 'g'); kill(S.t1); S.g.set('C', 'c', 'bad'); S.g.set('B', 'c', 'bad'); S.g.set('B', 'b', 'g');
    S.t2 = T('B–c 和 C–c 共用 c ✘', 'bad', 5.0, -1.4);
    cap('同樣的端點也不會在 Y 那邊', '一個男生只配一個女生');
  },
  async (tok, S) => { kill(S.t2); paintM(S.g, S.M); S.B.add('希望 M 越大越好（配到越多越好）', 'good'); cap('我們希望配對成功的越多越好', '越多女生被配到，或越多人被介紹到工作'); },
]);

scene('g8e-maxcomp', 'Maximum matching 與 complete matching', [
  async (tok, S) => { S.B = board(); S.g = party(); S.B.add('「maximal matching」（老師的用詞）'); cap('最大的 matching', '老師稱為 maximal matching'); },
  async (tok, S) => { S.B.add('沒有其他 matching 的 cardinality |M| 比它大', 'note'); cap('沒有別的 matching 有比較大的 cardinality', 'cardinality 就是集合裡有幾個元素'); },
  async (tok, S) => {
    paintM(S.g, M5); S.t1 = T('M₁：|M₁| = ' + msize(M5) + '（5 個女生配到）', 'say', 5.4, -3.4);
    ok(isMatching(M5) && inGraph(ADJ, M5), 5.4, -2.8, 'M₁ 是 matching ✓');
    cap('例如一個 matching 配到 5 個女生', '');
  },
  async (tok, S) => {
    paintM(S.g, M6); settxt(S.t1, 'M₂：|M₂| = ' + msize(M6) + '（6 個女生配到）');
    S.B.add('配到 6 個的比配到 5 個的大');
    cap('另一個配到 6 個女生', '那個就比較大');
  },
  async (tok, S) => { S.B.add('|M| = 邊數 = 配到的女生數'); S.B.add('（標準名稱：maximum matching）', 'say'); cap('matching 是一些邊的集合', '它有幾條邊，就有幾個女生被配到'); },
  async (tok, S) => { S.B.add('最好：每個女生都配到 → complete matching', 'note'); cap('最好的情況：每個女生都配到', '那時候的 matching 叫做 complete matching'); },
  async (tok, S) => { S.B.add('complete matching：|M| = |X|（這裡 = 8）', 'note'); kill(S.t1); T('|X| = 8', 'ptr', PX, 4.4); cap('complete matching 就是 |M| = |X|', '這個例子 X 有 8 個女生，所以要 |M| = 8'); },
  async (tok, S) => { S.B.add('原問題 ⇔ 這個 bipartite graph 有沒有 complete matching？', 'good'); cap('原來的問題換成 graph theory 語言', '這個 bipartite graph 存不存在 complete matching？'); },
  async (tok, S) => { S.B.add('沒有的話：maximum matching 有多大？'); cap('如果存在，就是每個女生都配到（size 8）', '如果不存在，最多能配到幾個？'); },
  async (tok, S) => { paintM(S.g, {}); S.B.add('怎麼找最大的 matching？先拿例子試試', 'say'); cap('這種問題有很多例子', '要怎麼找最大的 matching 呢？'); },
]);

scene('g8e-greedy', '先配配看：能配就配，配到 E 卡住', [
  async (tok, S) => { S.B = board(); S.g = party(); S.B.add('用這個例子試試看，有問題再說'); cap('我們就用原來這個例子', '先試試看，有問題再說'); },
  async (tok, S) => { GIRLS.forEach((x) => S.B.add(x + '：' + LIKE[x].split('').join(' '), 'say')); cap('把喜歡清單再抄一次', 'A: aefgh、B: bch、C: cefg、D: dh、E: bcd、F: bd、G: abcd、H: bcd'); },
  async (tok, S) => { S.ttl = T('先配配看', 'ptr', 5.6, -4.2); cap('我們就先來配配看', ''); },
  async (tok, S) => { S.t0 = T('想方法：先找例子試試，看出端倪', 'say', 5.6, -3.5); cap('想方法的第一步', '找個例子試試看，試多了就看出端倪'); },
  async (tok, S) => {
    kill(S.t0); S.M = { A: 'a' }; S.g.set('A', 'a', 'm');
    S.ms = T('M = {A–a}', 'note', 5.6, -3.5); cap('能配就先配：Alice 配給 Art', '把 Aa 這條邊丟進 matching');
  },
  async (tok, S) => { S.M.B = 'b'; S.g.set('B', 'b', 'm'); settxt(S.ms, 'M = {' + mtxt(S.M) + '}'); cap('照字母順序配 B', 'Betty 第一個喜歡的 b 還沒人配，就配給她'); },
  async (tok, S) => { S.M.C = 'c'; S.g.set('C', 'c', 'm'); settxt(S.ms, 'M = {' + mtxt(S.M) + '}'); cap('Cindy 喜歡 c、e、f、g', 'c 還 available，就把 c 配給 Cindy'); },
  async (tok, S) => {
    S.M.D = 'd'; S.g.set('D', 'd', 'm'); settxt(S.ms, 'M = {' + mtxt(S.M) + '}');
    ok(isMatching(S.M) && sameM(S.M, M4), 5.6, -2.9, '|M| = ' + msize(S.M) + '，是 matching ✓');
    cap('Doris 喜歡 d 和 h：把 d 配給 Doris', '能做就先做，有問題再說');
  },
  async (tok, S) => {
    S.g.glow('E', '#661111'); ['b', 'c', 'd'].forEach((y) => S.g.glow(y, '#553300'));
    const free = ADJ.E.filter((y) => !Object.values(S.M).includes(y));
    ok(free.length === 0, 5.6, -2.3, 'E 喜歡的 b、c、d 都被配走了 ✓');
    cap('再來是 E：她喜歡 b、c、d', '很不幸，b、c、d 都已經配給別人了');
  },
  async (tok, S) => {
    S.g.set('E', 'b', 'bad'); S.t2 = T('再加 E–b：和 B–b 共用 b ✘', 'bad', 5.6, -1.7);
    cap('再畫一條線就違反 matching 的條件', '兩條邊會有同樣的端點');
  },
  async (tok, S) => {
    S.g.set('E', 'b', 'g'); kill(S.t2);
    S.t3 = T('A、B 其實不只喜歡一個男生', 'say', 5.6, -1.7);
    cap('那怎麼辦？也許可以調整一下前面的配法', 'Alice、Betty 其實都不只喜歡一個男生');
  },
  async (tok, S) => { S.t4 = T('卡在這裡 → 想辦法調整（下一段）', 'note', 5.6, -1.1); cap('配到這邊卡住了', '想辦法調整，把 E 也配上去'); },
]);

// ════════ Xl7Giuc-Adk（第29B講：調整配法、augmenting alternating path、Hungarian algorithm 的基本想法） ════════
scene('g8e-aug1', '調整：E–b–B–h，把 matching 變大', [
  async (tok, S) => {
    S.B = board(); S.g = party({ M: M4 }); S.g.glow('E', '#661111');
    S.ms = T('M = {' + mtxt(M4) + '}，|M| = 4', 'note', 5.6, -4.2);
    S.B.add('配了 A、B、C、D，E 配不上去');
    cap('做到這裡配了 4 個', '要配 E 的時候，她喜歡的三個男生都被配走了');
  },
  async (tok, S) => { S.B.add('想辦法調整上面的配法（要有系統）'); cap('上面的配法不是只有這一種', '想辦法有系統地調整一下'); },
  async (tok, S) => { S.g.set('E', 'b', 'p'); S.B.add('E 喜歡 b、c、d，例如 b'); cap('E 喜歡 b、c、d', '比方說 E 喜歡 b'); },
  async (tok, S) => { S.g.set('B', 'b', 'pm'); S.B.add('但 b 已經配給 Betty'); cap('但是 b 已經配給 Betty 了', ''); },
  async (tok, S) => {
    S.g.set('B', 'h', 'p'); S.g.glow('h', '#004422');
    const taken = ['b', 'c'].every((y) => Object.values(M4).includes(y)) && !Object.values(M4).includes('h');
    ok(taken, 5.6, -3.5, 'Betty：b、c 已配，h 還沒配 ✓');
    S.B.add('Betty 喜歡 b、c、h：h 還沒被配！', 'note');
    cap('Betty 喜歡 b、c、h', 'b、c 都配了，但 h 還沒有被配');
  },
  async (tok, S) => {
    LL('細線：圖裡的邊、沒用到', 'say', 4.4, 3.4); LL('粗綠：在 matching 裡', 'good', 4.4, 4.0);
    cap('老師板書：黃色＝圖裡有、但沒用到的邊', '白色＝用到的（在 matching 裡）；這裡用細線和粗綠線');
  },
  async (tok, S) => { S.B.add('E 其實可以配 b …'); cap('E 其實可以配 b', '但 b 已經配給 Betty，而 Betty 還喜歡 h'); },
  async (tok, S) => {
    S.M = flip(M4, ['E', 'b', 'B', 'h']);
    S.g.set('E', 'b', 'm'); await wt(tok, 300); S.g.set('B', 'b', 'g'); await wt(tok, 300); S.g.set('B', 'h', 'm');
    S.g.glow('E'); S.g.glow('h');
    S.B.add('h 配給 Betty，b 配給 E', 'good');
    cap('很簡單：把 h 配給 Betty', 'b 就可以配給 E，多配了一個人');
  },
  async (tok, S) => { S.B.add('黃 ↔ 白 對調（沒用的變用、用的拿掉）'); cap('就是把黃的跟白的反過來', '黃的變白的，白的拿掉'); },
  async (tok, S) => { ['A', 'C', 'D'].forEach((x) => S.g.glow(x, '#225522')); S.B.add('A、C、D 都不變', 'say'); cap('其他三個 A、C、D 維持不變', '只動了 Betty 和 b、h'); },
  async (tok, S) => {
    ['A', 'C', 'D'].forEach((x) => S.g.glow(x));
    settxt(S.ms, 'M = {' + mtxt(S.M) + '}，|M| = ' + msize(S.M));
    ok(isMatching(S.M) && inGraph(ADJ, S.M) && sameM(S.M, M5), 5.6, -3.5, '還是 matching，|M| 從 4 變 5 ✓');
    cap('這樣還是滿足 matching 的條件', 'size 從 4 變成 5，E 也配到了');
  },
  async (tok, S) => {
    paintPath(S.g, ['E', 'b', 'B', 'h'], M4);
    S.B.add('系統方法：不在 M、在 M、不在 M…，停在沒配到的男生', 'note');
    cap('有系統的方法就是找這種東西', '不在 matching 的邊、在 matching 的邊…，最後停到沒配到的男生');
  },
  async (tok, S) => { paintM(S.g, S.M); S.B.add('然後黃白反過來 → matching 變大', 'good'); cap('找到之後把它反過來', '這就是解 matching problem 最基礎的方法'); },
]);

scene('g8e-hdef', 'Hungarian algorithm：alternating path 與 augmenting', [
  async (tok, S) => { S.B = board(); S.g = party({ M: M4 }); S.B.add('Hungarian algorithm（幾位匈牙利數學家）'); cap('下面介紹 Hungarian algorithm', 'Hungarian＝匈牙利人，是幾位匈牙利數學家提出的'); },
  async (tok, S) => { S.B.add('給一個 matching（例如 A–a、B–b、C–c、D–d）'); cap('它的基礎：手上有一個 given matching', '像剛才那四條邊'); },
  async (tok, S) => { S.B.add('augment＝把它變大', 'note'); cap('要把這個 given matching augment', 'augment 就是「變大」'); },
  async (tok, S) => { S.B.add('方法：找 augmenting alternating path', 'note'); cap('怎麼 augment？', '找一條 augmenting alternating path'); },
  async (tok, S) => { paintPath(S.g, ['E', 'b', 'B', 'h'], M4); S.B.add('剛才的 E–b–B–h 就是一條'); cap('剛才找到的這條', '就是一條 augmenting alternating path'); },
  async (tok, S) => { S.B.add('alternating：不在 M、在 M、不在 M、在 M…'); cap('alternating 是什麼？', '黃白黃白：不在 matching、在 matching 輪流出現'); },
  async (tok, S) => { paintM(S.g, M4); S.g.glow('E', '#661111'); S.B.add('定義：從一個 unmatched x-vertex 出發', 'note'); cap('alternating path 從一個沒配到的 x-vertex 開始', '已經配到的不用理它，要把沒配到的配進去'); },
  async (tok, S) => {
    S.g.set('E', 'b', 'p'); await wt(tok, 250); S.g.set('B', 'b', 'pm'); await wt(tok, 250); S.g.set('B', 'h', 'p');
    S.B.add('邊依序：not in M、in M、not in M、…', 'note');
    cap('第一條邊不在 matching 裡', '下一條在 matching 裡，再下一條不在…');
  },
  async (tok, S) => {
    paintM(S.g, M4); S.g.set('E', 'b', 'p'); S.g.set('B', 'b', 'pm');
    S.t1 = T('E–b–B：停在 x-vertex，不能變大（示意）', 'bad', 5.6, -3.6);
    S.B.add('alternating path 不一定能變大');
    cap('不是每條 alternating path 都能變大', '例如停在 B 的 E–b–B 就不行');
  },
  async (tok, S) => { kill(S.t1); S.B.add('augmenting：最後停在 unmatched y-vertex', 'note'); cap('augmenting 的條件', '最後要結束在一個沒配到的 y-vertex'); },
  async (tok, S) => {
    S.g.set('B', 'h', 'p'); S.g.glow('h', '#004422');
    const t = altTree(ADJ, M4, 'E');
    ok(!Object.values(M4).includes('h'), 5.6, -3.6, 'E–b–B–h：3 條邊，h 沒配到 ✓');
    cap('E–b–B–h 三條邊：不在、在、不在', '最後停在 h，h 是沒配到的男生');
  },
  async (tok, S) => {
    S.g.glow('h'); S.g.glow('E'); paintM(S.g, flip(M4, ['E', 'b', 'B', 'h']));
    S.B.add('找到就反過來（豬羊變色）→ |M| + 1', 'good');
    cap('有系統地找這種 path，把它反過來', '不在的變在、在的變不在，matching 就大 1');
  },
  async (tok, S) => { S.B.add('新的 matching 再做一次…做不動就停 → 最大（之後證）', 'say'); cap('再從新的 given matching 繼續', '做到做不下去，結果就是最大的 matching（後面證明）'); },
]);

scene('g8e-flip', '例子回顧：E–b–B–h 反過來，4 → 5', [
  async (tok, S) => { S.B = board(); S.g = party({ M: M4 }); paintPath(S.g, ['E', 'b', 'B', 'h'], M4); S.B.add('例子裡這條是 augmenting alternating path'); cap('剛才那個例子', '這條就是 augmenting alternating path'); },
  async (tok, S) => { S.B.add('E–b 不在 M、b–B 在 M、B–h 不在 M'); cap('不在 matching、在 matching、不在 matching', ''); },
  async (tok, S) => { S.g.glow('E', '#661111'); S.g.glow('h', '#004422'); S.B.add('起點 E：沒配到的女生；終點 h：沒配到的男生', 'note'); cap('一開始是沒配到的 x-vertex E', '最後結束在沒配到的 y-vertex h'); },
  async (tok, S) => {
    S.g.set('E', 'b', 'm'); await wt(tok, 300); S.g.set('B', 'b', 'g'); await wt(tok, 300); S.g.set('B', 'h', 'm');
    S.g.glow('E'); S.g.glow('h');
    S.B.add('反過來：不在的放進 M，在的拿掉', 'note');
    cap('把它反過來', '不在 matching 的放進去，在 matching 的拿掉');
  },
  async (tok, S) => {
    const N = flip(M4, ['E', 'b', 'B', 'h']);
    ok(isMatching(N) && msize(N) === 5, 5.6, -3.6, 'path 上：1 條 → 2 條；|M|：4 → ' + msize(N) + ' ✓');
    cap('這條 path 上原本 1 條在 matching，現在 2 條', '所以 matching 從 4 變 5');
  },
  async (tok, S) => { S.B.add('這就是 Hungarian algorithm 的核心', 'good'); cap('整個 Hungarian algorithm 的核心就在這裡', '下面把例子繼續 run 下去'); },
]);

// ════════ PfQKS71fBus（第29C講：從 F、G、H 長 alternating tree；Hungarian tree、Hungarian acorn） ════════
scene('g8e-treeF', '從 F 長 alternating tree（modified BFS）', [
  async (tok, S) => {
    S.B = board(-7.3, -4.7, 0.6, 14); S.g = party({ M: M5 }); S.M = { ...M5 };
    S.B.add('現在 A、B、C、D、E 五個都配到了');
    ok(isMatching(M5) && msize(M5) === 5, 0.4, 4.4, '|M| = 5 ✓');
    cap('剛才 run 到這邊', 'A、B、C、D、E 五個都配到了');
  },
  async (tok, S) => { S.g.glow('F', '#661111'); S.B.add('再來想辦法配 F'); cap('再來拿 F 想辦法配', ''); },
  async (tok, S) => { S.B.add('F 喜歡 b、d；F–b、F–d 都沒用到'); cap('F 喜歡 b 和 d', 'F 還沒配，所以這兩條邊都沒用到'); },
  async (tok, S) => {
    S.t = G(); tnode(S.t, 'F', 0, 1, 0); T('alternating tree', 'zone', 6.0, -4.6);
    S.B.add('F 當 root，用類似 BFS 的方法（要修正）', 'note');
    cap('從 F 當 root', '用類似 breadth-first search 的方法，只是要稍微修正');
  },
  async (tok, S) => {
    tnode(S.t, 'b', 0, 2, 1); tnode(S.t, 'd', 1, 2, 1); tedge(S.t, 'F', 'b', 'p'); tedge(S.t, 'F', 'd', 'p');
    S.g.set('F', 'b', 'p'); S.g.set('F', 'd', 'p');
    S.B.add('第 1 層：不在 M 的邊 → b、d');
    cap('第一層：從 unmatched 的 F 出發', '第一條邊要不在 matching 裡：b、d');
  },
  async (tok, S) => { tnode(S.t, 'E', 0, 2, 2); tedge(S.t, 'b', 'E', 'pm'); S.g.set('E', 'b', 'pm'); S.B.add('下一層要在 M（沒得選）：b → E'); cap('下一條一定要在 matching 裡，沒得選', 'b 配的是 E'); },
  async (tok, S) => { tnode(S.t, 'D', 1, 2, 2); tedge(S.t, 'd', 'D', 'pm'); S.g.set('D', 'd', 'pm'); S.B.add('d → D'); cap('d 配的是 Doris', '這樣 tree 長到第二層'); },
  async (tok, S) => { tnode(S.t, 'c', 0, 2, 3); tedge(S.t, 'E', 'c', 'p'); S.g.set('E', 'c', 'p'); S.B.add('E：不在 M 的是 c、d；d 已在 tree → 只有 c'); cap('從 E 往下：要不在 matching 的邊', 'c 和 d，但 d 已經在 tree 上了，所以只有 c'); },
  async (tok, S) => { tnode(S.t, 'h', 1, 2, 3); tedge(S.t, 'D', 'h', 'p'); S.g.set('D', 'h', 'p'); S.B.add('D：d 已配給她，還有 h → h'); cap('Doris 原本配 d', '她還喜歡 h，所以長出 h'); },
  async (tok, S) => { tnode(S.t, 'C', 0, 2, 4); tedge(S.t, 'c', 'C', 'pm'); S.g.set('C', 'c', 'pm'); S.B.add('又要在 M：c → C（Cindy）'); cap('下一層又要在 matching：沒得選', 'c 配的是 Cindy'); },
  async (tok, S) => { tnode(S.t, 'B', 1, 2, 4); tedge(S.t, 'h', 'B', 'pm'); S.g.set('B', 'h', 'pm'); S.B.add('h → B（Betty）'); cap('h 配的是 Betty', ''); },
  async (tok, S) => { tnode(S.t, 'e', 0, 2, 5); tedge(S.t, 'C', 'e', 'p'); S.g.set('C', 'e', 'p'); S.B.add('C 喜歡 c、e、f、g：c 在 tree，e 還沒出現 → e'); cap('Cindy 喜歡 c、e、f、g', 'c 已經在 tree 上，下一個 e 還沒出現，長出 e'); },
  async (tok, S) => {
    S.t.glow('te', '#004422'); S.g.glow('e', '#004422');
    ok(!Object.values(M5).includes('e'), 7.0, 3.4, 'e 沒配到 ✓');
    S.B.add('e 是 unmatched y-vertex → 找到了！', 'good');
    cap('要結束在一個 unmatched 的 y-vertex', 'e 沒有被配到，所以找到了');
  },
  async (tok, S) => {
    const r = altTree(ADJ, M5, 'F');
    ok(r.found === 'e' && r.path.join('') === 'FbEcCe', 5.4, 4.4, '程式跑 modified BFS：F–b–E–c–C–e ✓');
    S.B.add('這棵叫 alternating tree（root 在 F）');
    cap('從 F 建的這棵叫 alternating tree', '用 modified BFS 長出來，tree 上每條路都是 alternating path');
  },
  async (tok, S) => {
    S.B.add('augmenting alternating path：F–b–E–c–C–e', 'note');
    paintM(S.g, M5); paintPath(S.g, ['F', 'b', 'E', 'c', 'C', 'e'], M5);
    cap('碰到 unmatched y-vertex 就停', 'F–b–E–c–C–e：從沒配到的 F 開始，結束在沒配到的 e');
  },
  async (tok, S) => {
    [['F', 'b'], ['E', 'c'], ['C', 'e']].forEach(([a, b]) => tedge(S.t, a, b, 'm'));
    [['b', 'E'], ['c', 'C']].forEach(([a, b]) => S.t.set('t' + a, 't' + b, 'g'));
    S.B.add('把這條 path augment：黃白反過來');
    cap('把這條 path augment', '不在裡面的變在裡面，在裡面的變不在');
  },
  async (tok, S) => {
    S.M = flip(M5, ['F', 'b', 'E', 'c', 'C', 'e']); paintM(S.g, S.M); S.g.glow('F'); S.g.glow('e');
    S.B.add('C–e、E–c、F–b（A、B、D 不變）', 'note');
    cap('反映到原來的 matching', 'Cindy 配 e、E 配 c、F 配 b，其他不變');
  },
  async (tok, S) => {
    ok(isMatching(S.M) && inGraph(ADJ, S.M) && sameM(S.M, M6), 0.4, 4.4, '|M| = ' + msize(S.M) + ' ✓');
    S.B.add('|M|：5 → 6', 'good');
    cap('matching 的 size 從 5 變成 6', '變大了');
  },
]);

scene('g8e-treeG', '從 G 長 alternating tree：G–a–A–f', [
  async (tok, S) => {
    S.B = board(-7.3, -4.7, 0.6, 14); S.g = party({ M: M6 });
    S.t = G(); tnode(S.t, 'G', 0, 1, 0); T('alternating tree', 'zone', 6.0, -4.6); S.g.glow('G', '#661111');
    S.B.add('再從 G 當 root 長 alternating tree');
    cap('下面類似：從這個 matching 再想辦法 augment', '從 G 當 root，用 modified BFS 長 alternating tree');
  },
  async (tok, S) => {
    ['a', 'b', 'c', 'd'].forEach((y, k) => { tnode(S.t, y, k, 4, 1); tedge(S.t, 'G', y, 'p'); S.g.set('G', y, 'p'); });
    S.B.add('G 喜歡 a、b、c、d，四條邊都沒用到');
    cap('G 喜歡 a、b、c、d', 'G 還沒配，四條邊都沒用到');
  },
  async (tok, S) => {
    const mate = { a: 'A', b: 'F', c: 'E', d: 'D' };
    ['a', 'b', 'c', 'd'].forEach((y, k) => { tnode(S.t, mate[y], k, 4, 2); tedge(S.t, y, mate[y], 'pm'); S.g.set(mate[y], y, 'pm'); });
    ok(Object.entries(mate).every(([y, x]) => M6[x] === y), 6.0, -0.2, 'a–A、b–F、c–E、d–D 都在 M ✓');
    S.B.add('下一層要在 M（沒得選）：A、F、E、D');
    cap('下一層要在 matching 裡，都沒得選', 'a 配 A、b 配 F、c 配 E、d 配 D');
  },
  async (tok, S) => {
    tnode(S.t, 'e', 0, 4, 3); S.t.P.te[0] = TX(0, 4) - 0.2; S.t.V.te.position.x = S.t.P.te[0]; tedge(S.t, 'A', 'e', 'p'); S.g.set('A', 'e', 'p');
    S.B.add('從 A：a e f g h，a 在 tree；e 可以');
    cap('再從 A 開始：A 喜歡 a、e、f、g、h', 'a 已經在 tree 上，e 可以長出來');
  },
  async (tok, S) => {
    ok(M6.C === 'e', 4.6, 0.6, 'e 已配給 C ✓');
    S.B.add('但 e 有配到（給 C）→ 還不行，試下一個', 'say');
    cap('但 e 已經 match 到了', '還不能結束，再試下一個');
  },
  async (tok, S) => {
    tnode(S.t, 'f', 1, 4, 3); S.t.P.tf[0] = TX(1, 4) - 0.2; S.t.V.tf.position.x = S.t.P.tf[0]; tedge(S.t, 'A', 'f', 'p'); S.g.set('A', 'f', 'p');
    S.t.glow('tf', '#004422'); S.g.glow('f', '#004422');
    ok(!Object.values(M6).includes('f'), 5.8, 0.6, 'f 沒配到 ✓');
    S.B.add('下一個 f：unmatched！', 'good');
    cap('下一個是 f', 'f 沒有被 match，bingo，找到了');
  },
  async (tok, S) => {
    const r = altTree(ADJ, M6, 'G');
    ok(r.found === 'f' && r.path.join('') === 'GaAf', 5.6, 4.4, '程式：augmenting path G–a–A–f ✓');
    paintM(S.g, M6); paintPath(S.g, ['G', 'a', 'A', 'f'], M6);
    S.B.add('碰到 unmatched y 就停：G–a–A–f', 'note');
    cap('tree 只要碰到一個 unmatched y-vertex 就停', '找到 augmenting alternating path：G–a–A–f');
  },
  async (tok, S) => {
    S.g.set('G', 'a', 'm'); await wt(tok, 300); S.g.set('A', 'a', 'g'); await wt(tok, 300); S.g.set('A', 'f', 'm');
    S.B.add('把它 augment'); cap('把這條 path augment', '');
  },
  async (tok, S) => { S.M = flip(M6, ['G', 'a', 'A', 'f']); paintM(S.g, S.M); S.g.glow('G'); S.g.glow('f'); S.B.add('A 改配 f，a 配給 G', 'note'); cap('原來 a 配 Alice', '現在 a 配給 G、f 配給 A'); },
  async (tok, S) => { S.B.add('A–f B–h C–e D–d E–c F–b G–a', 'say'); cap('新的 matching', 'A–f、B–h、C–e、D–d、E–c、F–b、G–a'); },
  async (tok, S) => {
    ok(isMatching(S.M) && inGraph(ADJ, S.M) && sameM(S.M, M7), 0.4, 4.4, '|M| = ' + msize(S.M) + ' ✓');
    S.B.add('|M|：6 → 7', 'good'); cap('cardinality 從 6 變成 7', '還剩 H 沒配到');
  },
]);

scene('g8e-hungtree', '從 H 長不出來：Hungarian tree', [
  async (tok, S) => {
    S.B = board(-7.3, -4.7, 0.6, 14); S.g = party({ M: M7 }); S.g.glow('H', '#661111');
    S.t = G(); tnode(S.t, 'H', 0, 1, 0); T('alternating tree', 'zone', 6.0, -4.6);
    S.B.add('最後 H 還沒配：H 喜歡 b、c、d');
    cap('最後還有 H 沒配到', '從 H 開始找，方法都一樣；H 喜歡 b、c、d');
  },
  async (tok, S) => {
    const mate = { b: 'F', c: 'E', d: 'D' };
    ['b', 'c', 'd'].forEach((y, k) => { tnode(S.t, y, k, 3, 1); tedge(S.t, 'H', y, 'p'); S.g.set('H', y, 'p'); });
    await wt(tok, 400);
    ['b', 'c', 'd'].forEach((y, k) => { tnode(S.t, mate[y], k, 3, 2); tedge(S.t, y, mate[y], 'pm'); S.g.set(mate[y], y, 'pm'); });
    S.B.add('b、c、d 都在 M：b → F、c → E、d → D');
    cap('三條邊都沒用過', 'b、c、d 已經在 matching 裡，沒得選：b 到 F、c 到 E、d 到 D');
  },
  async (tok, S) => { S.t.glow('tF', '#661111'); S.B.add('F：b、d 都已在 tree → 下不去'); cap('再從 F 長', 'F 喜歡 b 和 d，都已經出現過了，F 下不去'); },
  async (tok, S) => { S.t.glow('tF'); S.t.glow('tE', '#661111'); S.B.add('E：b、c、d 也都在 tree'); cap('E 喜歡 b、c、d', '也都在 tree 上了，沒辦法'); },
  async (tok, S) => { S.t.glow('tE'); tnode(S.t, 'h', 2, 3, 3); tedge(S.t, 'D', 'h', 'p'); S.g.set('D', 'h', 'p'); S.B.add('D：d、h → 唯一可能是 h'); cap('Doris 喜歡 d 和 h', 'd 在這兒了，唯一可能就是 h'); },
  async (tok, S) => { tnode(S.t, 'B', 2, 3, 4); tedge(S.t, 'h', 'B', 'pm'); S.g.set('B', 'h', 'pm'); S.B.add('h 原本配 B（沒得選）→ B'); cap('h 原來配給 Betty', '在 matching 裡，沒得選'); },
  async (tok, S) => {
    S.t.glow('tB', '#661111');
    const r = altTree(ADJ, M7, 'H');
    ok(!r.found, 5.6, 4.4, '程式跑 modified BFS：找不到 unmatched y ✓');
    S.B.add('B：b、c、h 都在 tree → 長不下去了');
    cap('Betty 喜歡 b、c、h', '全都在 tree 上，這棵 alternating tree 長不下去了');
  },
  async (tok, S) => { S.t.glow('tB'); S.B.add('從 H 出發的 alternating paths 全在這；沒有一條 augmenting'); cap('從 H 出發的 alternating path 全部就這樣', '沒有一條停在 unmatched 的 y-vertex'); },
  async (tok, S) => { S.ht = T('Hungarian tree', 'ptr alt', 6.0, 4.4); S.B.add('這棵叫 Hungarian tree', 'note'); cap('這種長不出 augmenting path 的 alternating tree', '叫做 Hungarian tree'); },
  async (tok, S) => { S.t.glow('tH', '#661111'); S.B.add('它的 root 叫 Hungarian acorn（橡實）', 'note'); cap('Hungarian tree 的 root', '叫 Hungarian acorn；acorn 是橡樹的果實「橡實」'); },
  async (tok, S) => {
    const others = GIRLS.filter((x) => x !== 'H').every((x) => M7[x]);
    ok(others, 0.4, 4.4, '其他女生都配到了 ✓');
    S.B.add('H 是 Hungarian acorn → algorithm 停');
    cap('從 H 沒辦法把 matching 變大', '其他人都配到了，剩下的是 Hungarian acorn，algorithm 就停了');
  },
  async (tok, S) => {
    ['H', 'F', 'E', 'D', 'B'].forEach((x) => S.g.glow(x, '#661111'));
    S.B.add('為什麼 H 配不下去？tree 上有 5 個女生', 'note');
    cap('為什麼 H 配不下去？看 Hungarian tree', 'tree 上有 5 個女生：Hazel、Flo、E、Doris、Betty');
  },
  async (tok, S) => { ['b', 'c', 'd', 'h'].forEach((y) => S.g.glow(y, '#553300')); S.B.add('卻只有 4 個男生：b、c、d、h'); cap('tree 上只有 4 個男生', 'b、c、d、h'); },
  async (tok, S) => {
    const R = Rof(ADJ, ['B', 'D', 'E', 'F', 'H']);
    ok(R.join('') === 'bcdh', 5.4, 3.7, 'B、D、E、F、H 喜歡的聯集 = {' + R.join(', ') + '}：4 < 5 ✓');
    S.B.add('5 個女生喜歡的聯集只有 4 個男生', 'note');
    cap('這五個女生喜歡的男生聯集起來', '只有 b、c、d、h 四個');
  },
  async (tok, S) => { S.B.add('光這 5 人就擺不平 → 8 人不可能都配到', 'bad'); cap('It is impossible for all eight girls', 'to dance with a compatible boy'); },
  async (tok, S) => {
    ['H', 'F', 'E', 'D', 'B', 'b', 'c', 'd', 'h'].forEach((n) => S.g.glow(n)); paintM(S.g, M7);
    const mm = maxMatch(ADJ);
    ok(mm.n === 7 && msize(M7) === 7, 0.4, 4.4, '暴力試所有配法：最大就是 ' + mm.n + ' ✓');
    S.B.add('結果 |M| = 7 是 maximum matching', 'good');
    cap('Hungarian algorithm 停下來的結果', '這個 size 7 的 matching 已經是最大的');
  },
  async (tok, S) => { S.B.add('|M| = |X| 才是 complete；這裡 1 個 acorn → 1 人沒配到'); cap('看它的 cardinality 是不是 |X|', '有一個 Hungarian acorn，所以有一個人配不到'); },
  async (tok, S) => { S.B.add('接下來：pseudocode、證明它一定最大', 'say'); cap('接下來用 pseudocode 描述', '然後證明 Hungarian algorithm 一定找到最大的 matching'); },
]);

// ════════ PLpMBf9Nbyg（第29D講：Hungarian algorithm pseudocode、remark、正確性證明） ════════
const PCODE = ['Hungarian algorithm（high level）', '1. 所有 x-vertex 標成 untested', '2. while 有 unmatched 且 untested 的 x：', '     選一個這樣的 x', '     從 x 長 alternating tree（modified BFS）', '     if tree 是 augmenting（碰到 unmatched y）：', '         augment；所有 x 改回 untested', '     else（Hungarian tree）：', '         x＝Hungarian acorn，標成 tested'];
scene('g8e-pseudo', 'Hungarian algorithm 的 pseudocode', [
  async (tok, S) => {
    S.L = PCODE.map((t, i) => LL(t, i ? 'idx' : 'ptr', -7.3, -4.4 + i * 0.75));
    S.hi = (i) => S.L.forEach((l, k) => cls(l, k === 0 ? 'ptr' : k === i ? 'note' : 'idx'));
    cap('用 pseudocode 描述 Hungarian algorithm', '比較 high level，有些細節不講，看起來乾淨');
  },
  async (tok, S) => { S.t0 = LL('（怎麼實作 modified BFS 等細節要自己做）', 'say', 1.6, -4.4); cap('很多 implement 的細節', '要自己去做'); },
  async (tok, S) => {
    kill(S.t0); S.hi(1);
    S.chip = GIRLS.map((x, i) => { const m = lab.box(GC.girl, [0.5, 0.3, 0.5]); m.add(lab.label(x, 'val')); m.position.set(4.2, 0.3, pz(i)); lab.world.add(m); return { m, l: LL('untested', 'idx', 4.7, pz(i)) }; });
    SI(4.2, 4.4);
    cap('第一步：所有 x-vertex 都標成 untested', '一開始都還沒測試過');
  },
  async (tok, S) => { S.hi(2); cap('while 迴圈什麼時候執行？', '還有沒配到、又沒測試過的 x-vertex 就繼續'); },
  async (tok, S) => { S.hi(3); cap('隨便挑一個 unmatched、untested 的 x', '有好幾個的話挑哪個都可以'); },
  async (tok, S) => { S.hi(4); cap('從它開始長一個 alternating tree', '用 modified BFS algorithm'); },
  async (tok, S) => { S.hi(5); cap('如果這棵 tree 是 augmenting', '走到一個 unmatched y-vertex，就停下來'); },
  async (tok, S) => { S.hi(6); cap('就把 matching augment，變大', ''); },
  async (tok, S) => { cls(S.L[6], 'note'); S.chip.forEach((c) => settxt(c.l, 'untested')); cap('然後把所有 x 再標回 untested', '因為 matching 變了，等於重新 given 一個 matching'); },
  async (tok, S) => { S.hi(8); cap('如果不是 augmenting', '碰到 Hungarian tree，root 是 Hungarian acorn，標成 tested'); },
  async (tok, S) => {
    S.hi(8); [0, 1, 2, 3].forEach((i) => { settxt(S.chip[i].l, 'matched'); S.chip[i].m.material.color.set(GC.ok); });
    settxt(S.chip[4].l, 'tested（acorn）'); cls(S.chip[4].l, 'bad');
    cap('例如 A–D 都 match，從 E 長出 Hungarian tree', '就把 E 標成 tested，再試下一個 F（示意）');
  },
  async (tok, S) => {
    S.hi(6); settxt(S.chip[5].l, 'matched'); S.chip[5].m.material.color.set(GC.ok);
    settxt(S.chip[4].l, 'untested'); cls(S.chip[4].l, 'say');
    cap('如果從 F 可以 augment，matching 變了', 'E 搞不好又可以了，所以全部清回 untested');
  },
  async (tok, S) => { S.hi(2); cap('什麼時候結束？', '沒有 unmatched 又 untested 的 x-vertex 的時候'); },
  async (tok, S) => { S.r1 = LL('Remark 1：停下來時，要嘛所有 x 都 matched', 'note', -7.3, 2.6); cap('停下來會是什麼樣子？', '第一種：所有 x-vertex 都 match 到'); },
  async (tok, S) => { cls(S.r1, 'say'); S.r2 = LL('　要嘛所有 unmatched x 都是 Hungarian acorn', 'note', -7.3, 3.3); cap('不然就是：所有沒 match 到的 x', '都是 Hungarian acorn，從它長不出 augmenting path'); },
  async (tok, S) => { cls(S.r2, 'say'); LL('Remark 2：結果是 maximum matching（要證明）', 'note', -7.3, 4.0); cap('第二點就是我們要證明的東西', ''); },
]);

scene('g8e-claim', '定理：結束時的 matching 是 maximum', [
  async (tok, S) => { S.B = board(); S.B.add('Hungarian algorithm terminates 時：', 'note'); S.B.add('the resulting matching is a maximum matching', 'note'); S.g = party({ M: M7 }); cap('當 Hungarian algorithm 結束時', '最後的 matching 一定是最大的'); },
  async (tok, S) => {
    const mm = maxMatch(ADJ);
    ok(mm.n === msize(M7), 0.4, 4.4, '派對例子：7，暴力算最大也是 ' + mm.n + ' ✓');
    S.B.add('例如派對：最多 7 個女生配到');
    cap('就像前面的例子', 'maximum matching 的 size 是 7');
  },
  async (tok, S) => { S.B.add('接下來證明它的正確性（correctness）', 'say'); cap('接下來證明這件事', 'Proof of correctness of Hungarian algorithm'); },
]);

// proof diagrams: x-vertices on the top row, y-vertices on the bottom row (示意)
function zig(g, names, x0, dx, zt, zb) { names.forEach((n, i) => g.v(n, x0 + i * dx, i % 2 ? zb : zt, i % 2 ? GC.y : GC.x, n, 0.55)); }
scene('g8e-proof1', '證明（一）：從 B-matched、A-unmatched 的 x 走 B A B A…', [
  async (tok, S) => { S.B = board(); S.B.add('A-matching：Hungarian algorithm 的結果', 'note'); cap('考慮 Hungarian algorithm 的結果', '取個名字叫 A-matching'); },
  async (tok, S) => { S.B.add('要證最大：假設有更好的，再說它其實沒比較好'); cap('要證它最大', '就假設有另一個更好的，然後 argue 它其實沒有比較好'); },
  async (tok, S) => { S.B.add('假設 B-matching 比 A 好：|B| > |A|', 'note'); cap('假設有一個比較好的 matching', '叫 B-matching'); },
  async (tok, S) => { S.B.add('→ 有些 x：B-matched，但 A-unmatched'); cap('B 比較好，配到的人比較多', '所以一定有些女生在 B 裡配到、在 A 裡沒配到'); },
  async (tok, S) => {
    S.g = G(); zig(S.g, ['x1', 'y1', 'x2', 'y2', 'x3'], 0.2, 1.5, -1.6, 1.6); SI(3.2, -3.0);
    S.g.glow('x1', '#661111'); T('B-matched、A-unmatched', 'say', 0.2, -2.4);
    LL('橘＝B-edge　藍＝A-edge', 'say', 0.0, 3.6);
    cap('從任何一個這種 x-vertex 開始', '它在 B 裡有配、在 A 裡沒配');
  },
  async (tok, S) => { S.g.e('x1', 'y1', 'B'); S.B.add('建一條 alternating path：先走 B-edge'); cap('從它建一條 alternating path', '這次的 alternating 是 B、A 輪流：第一條是 B-edge'); },
  async (tok, S) => {
    S.g.e('y1', 'x2', 'A'); await wt(tok, 300); S.g.e('x2', 'y2', 'B'); await wt(tok, 300); S.g.e('y2', 'x3', 'A');
    S.B.add('B-edge、A-edge、B-edge、A-edge…');
    cap('B-edge、A-edge、B-edge、A-edge', '這樣輪流');
  },
  async (tok, S) => {
    S.g.glow('x3', '#004422'); T('A-matched、B-unmatched', 'good', 6.2, -2.4);
    S.B.add('主張：一定停在 A-matched、B-unmatched 的 x', 'note');
    cap('一定會停到一個 x-vertex', '它剛好反過來：在 A 裡有配、在 B 裡沒配');
  },
  async (tok, S) => { S.B.add('一個點最多一條 B-edge、一條 A-edge → 只能 B A B A'); cap('為什麼只能 B A B A？', '兩條 B-edge 不會有同樣端點（B 是 matching），A 也一樣'); },
  async (tok, S) => { S.B.add('最後一條不可能是 B-edge', 'note'); cap('最後一定是 A-edge', '不可能是 B A B A…B 停住'); },
  async (tok, S) => {
    S.g2 = G(); zig(S.g2, ['x1', 'y1', 'x2', 'y2'], -0.3, 1.5, 2.6, 4.4);
    S.g2.e('x1', 'y1', 'B'); S.g2.e('y1', 'x2', 'A'); S.g2.e('x2', 'y2', 'B'); S.g2.glow('y2', '#661111');
    T('如果停在 B-edge：y 在 A 裡沒配', 'bad', 6.0, 3.6);
    S.B.add('若停在 B-edge → 對 A 是 augmenting path！', 'bad');
    cap('如果最後是 B-edge 停在 y', '那個 y 在 A 裡沒配：這條對 A-matching 是 augmenting path');
  },
  async (tok, S) => { S.B.add('翻過來 A 就變大；但 Hungarian 停下時不會有', 'bad'); cap('把它翻過來，A-matching 就變大了', '可是 Hungarian algorithm 停下時，沒配到的都是 acorn，不會有這種 path'); },
  async (tok, S) => { S.g2.kill(); S.B.add('所以：x 到 x、長度偶數、終點 A-matched B-unmatched', 'good'); cap('所以一定是 x 走到 x', '長度是偶數，最後一條是 A-edge'); },
]);

scene('g8e-proof2', '證明（二）：一對一 + 鴿籠 → |A| ≥ |B|', [
  async (tok, S) => {
    S.B = board(); S.B.add('B-matched A-unmatched 的 x → A-matched B-unmatched 的 x', 'note');
    cap('總結：從 B-match、A-unmatch 的 x-vertex', '一定走到一個 A-match、B-unmatch 的 x-vertex');
  },
  async (tok, S) => { S.B.add('這是一個對應（mapping）f'); cap('這樣就造了一個 correspondence', '也就是一個 mapping'); },
  async (tok, S) => { S.B.add('主張：f 是 one-to-one（一對一）', 'note'); cap('這個 mapping 是一對一函數', '為什麼？如果不是就會矛盾'); },
  async (tok, S) => { S.B.add('若不是：兩個不同的 x 對到同一個'); cap('如果不是一對一', '就會有兩個不同的 x 對到同一個'); },
  async (tok, S) => {
    S.g = G(); SI(3.0, -4.4);
    S.g.v('x10', 0.4, -3.4, GC.x); S.g.v('x12', 5.6, -3.4, GC.x); S.g.v('y5', 0.4, -0.6, GC.y); S.g.v('y6', 5.6, -0.6, GC.y); S.g.v('x7', 3.0, 2.0, GC.x);
    S.g.e('x10', 'y5', 'B'); S.g.e('x12', 'y6', 'B'); S.g.e('y5', 'x7', 'A'); S.g.e('y6', 'x7', 'A');
    cap('例如 x10、x12 都對到 x7', '黃（這裡橘）是 B-edge，白（這裡藍）是 A-edge');
  },
  async (tok, S) => { S.B.add('終點一樣 → 中間某處第一次碰到同一個端點'); cap('最後一樣', '所以一定有第一次碰在一起的地方'); },
  async (tok, S) => { S.B.add('第一次碰到的那兩條：都是 A-edge 或都是 B-edge'); cap('第一次有同一個端點的地方', '不是發生在 A-edge，就是發生在 B-edge'); },
  async (tok, S) => {
    S.g.glow('x7', '#661111'); S.c1 = T('兩條不同 A-edge 共用 x7 ✘', 'bad', 3.0, 3.0);
    S.B.add('發生在 A-edge：A 不是 matching，矛盾', 'bad');
    cap('如果發生在 A-edge', '兩條不同的 A-edge 有同樣端點 x7，A 就不是 matching');
  },
  async (tok, S) => {
    S.g.kill(); kill(S.c1);
    S.g = G(); S.g.v('x10', 0.4, -2.4, GC.x); S.g.v('x12', 5.6, -2.4, GC.x); S.g.v('y6', 3.0, 0.8, GC.y);
    S.g.e('x10', 'y6', 'B'); S.g.e('x12', 'y6', 'B'); S.g.glow('y6', '#661111');
    S.c2 = T('兩條不同 B-edge 共用 y6 ✘', 'bad', 3.0, 1.9);
    S.B.add('發生在 B-edge：B 不是 matching，矛盾', 'bad');
    cap('如果發生在 B-edge', '兩條不同的 B-edge 有同樣端點 y6，B 就不是 matching');
  },
  async (tok, S) => { S.B.add('兩種都不可能 → f 一對一', 'good'); cap('兩種情況都不可能', '所以這個 mapping 一定是一對一'); },
  async (tok, S) => {
    S.g.kill(); kill(S.c2);
    S.B.add('鴿籠原理：codomain 大小 ≥ domain 大小', 'note');
    S.d = [0, 1, 2].map((i) => { const m = lab.box(GC.x, [0.5, 0.3, 0.5]); m.position.set(1.0, 0.3, -1.6 + i * 1.2); lab.world.add(m); return m; });
    S.c = [0, 1, 2, 3].map((i) => { const m = lab.box(GC.x, [0.5, 0.3, 0.5]); m.position.set(5.0, 0.3, -2.2 + i * 1.2); lab.world.add(m); return m; });
    [0, 1, 2].forEach((i) => { const r = rod(1.0, -1.6 + i * 1.2, 5.0, -2.2 + i * 1.2); r.material.color.set('#9b7ef4'); });
    T('B 有 A 沒有', 'say', 1.0, -2.6); T('A 有 B 沒有', 'say', 5.0, -3.2); SI(3.0, 3.4);
    cap('一對一，所以右邊（codomain）的個數', '一定大於等於左邊（domain）的個數');
  },
  async (tok, S) => { S.B.add('兩邊都配到、或兩邊都沒配到的 x：不影響大小比較', 'say'); cap('在 A、B 都配到或都沒配到的 x', '對兩個 size 的比較沒有影響'); },
  async (tok, S) => {
    S.B.add('所以 |A| ≥ |B|：B 沒有比較好 → 矛盾', 'good');
    cap('A 有 B 沒有的 ≥ B 有 A 沒有的', '所以 |A| ≥ |B|，B 不可能比 A 好');
  },
]);

scene('g8e-hsum', '小結：Hungarian algorithm 的結果最大', [
  async (tok, S) => { S.B = board(); S.B.add('Hungarian algorithm 的結果一定是 maximum matching', 'good'); S.g = party({ M: M7 }); cap('所以 Hungarian algorithm 得到的 matching', '一定是最大的'); },
  async (tok, S) => { S.B.add('核心：找 augmenting alternating path'); cap('這個 algorithm 不難', '核心就是怎麼把 given matching 變大：找 augmenting alternating path'); },
  async (tok, S) => { S.B.add('從 unmatched x 長 alternating tree，碰到 unmatched y 就 augment；做到不能做為止', 'say'); cap('從沒配到的 x 長 alternating tree', '碰到 unmatched y 就變大；一直做到不能做為止'); },
]);

// ════════ fOgt4u5Hjs0（第30A講：R(A)、Hall's theorem 與證明、deficiency δ(G)） ════════
scene('g8e-ra', '符號 R(A)：A 裡的 x 連到的所有 y', [
  async (tok, S) => { S.B = board(); S.B.add('先介紹一個 notation（定理要用）'); cap('先介紹一個 notation', '後面的定理需要它'); },
  async (tok, S) => { S.B.add('G：bipartite，V = X ∪ Y，邊都是 X–Y'); cap('有一個 bipartite graph G', 'vertices 分成 disjoint 的 X、Y，每條邊一端在 X、一端在 Y'); },
  async (tok, S) => { S.B.add('A ⊆ X：左邊的某些 vertices'); cap('A 是 X 的一個 subset', '就是左邊某些 vertices 構成的集合'); },
  async (tok, S) => { S.B.add('R(A) = { y ∈ Y：xy ∈ E，x ∈ A }', 'note'); cap('R(A)：Y 裡跟 A 中某個 x 有邊相連的點', '全部放在一起就是 R(A)'); },
  async (tok, S) => {
    const R = Rof(ADJ, ['B', 'C', 'D']);
    S.B.add('派對：A = {B, C, D} → R(A) = 她們喜歡的男生全部');
    S.r0 = ok(R.join('') === 'bcdefgh', 1.6, -4.2, 'R({B,C,D}) = {' + R.join(',') + '} ✓');
    cap('用派對的例子：A 是某幾個女生，例如 B、C、D', '她們喜歡的所有男生的集合就是 R(A)');
  },
  async (tok, S) => {
    kill(S.r0);
    S.g = G(); ['x1', 'x2', 'x3'].forEach((n, i) => S.g.v(n, 1.0, -2.4 + i * 1.6, GC.x)); ['y1', 'y2', 'y3', 'y4'].forEach((n, i) => S.g.v(n, 4.6, -3.0 + i * 1.4, GC.y));
    T('X', 'ptr', 1.0, -4.0); T('Y', 'ptr', 4.6, -4.2);
    cap('舉個例子：左邊 x1、x2、x3', '右邊 y1、y2、y3、y4');
  },
  async (tok, S) => {
    S.E = { x1: ['y1', 'y2'], x2: ['y2', 'y3'], x3: ['y4', 'y1'] };
    for (const [x, ys] of Object.entries(S.E)) for (const y of ys) { S.g.e(x, y); await wt(tok, 150); }
    cap('這個 bipartite graph 這樣連', 'x1–y1、x1–y2、x2–y2、x2–y3、x3–y4、x3–y1');
  },
  async (tok, S) => { ['x1', 'x2', 'x3'].forEach((n) => S.g.glow(n, '#661111')); S.B.add('A = {x1, x2, x3}'); cap('取 A = {x1, x2, x3}', 'A 是 X 的 subset，沒問題'); },
  async (tok, S) => { S.E.x1.forEach((y) => { S.g.set('x1', y, 't'); S.g.glow(y, '#553300'); }); S.rl = T('R(A) = {y1, y2', 'note', 6.4, -4.2); cap('跟 x1 相連的：y1、y2', '放進 R(A)'); },
  async (tok, S) => { S.E.x2.forEach((y) => { S.g.set('x2', y, 't'); S.g.glow(y, '#553300'); }); settxt(S.rl, 'R(A) = {y1, y2, y3'); cap('跟 x2 相連的：y2、y3', 'y2 已經在裡面了，再把 y3 放進來'); },
  async (tok, S) => { S.E.x3.forEach((y) => { S.g.set('x3', y, 't'); S.g.glow(y, '#553300'); }); settxt(S.rl, 'R(A) = {y1, y2, y3, y4'); cap('跟 x3 相連的：y4、y1', 'y1 已經在裡面'); },
  async (tok, S) => {
    const R = Rof(S.E, ['x1', 'x2', 'x3']); settxt(S.rl, 'R(A) = {' + R.join(', ') + '}');
    ok(R.length === 4, 6.4, -3.5, '|R(A)| = ' + R.length + ' ✓');
    S.B.add('R(A)：這三個女生喜歡的男生的聯集', 'good');
    cap('所以 R(A) = {y1, y2, y3, y4}', '就是跟 x1 或 x2 或 x3 相連的 y-vertices');
  },
]);

scene('g8e-hall', "Hall's theorem：complete matching 的充要條件", [
  async (tok, S) => { S.B = board(); S.B.add('什麼時候有 complete matching（|M| = |X|）？'); cap('什麼時候有 complete matching？', '就是 matching 的 size 等於 |X|，每個女生都配到'); },
  async (tok, S) => { S.B.add("Hall's theorem", 'ptr'); cap('這個定理叫做', "Hall's theorem"); },
  async (tok, S) => { S.B.add('充分且必要條件（if and only if）', 'say'); cap('它給你一個充分且必要條件', 'necessary and sufficient condition，若且唯若'); },
  async (tok, S) => { S.B.add('G 有 complete matching ⇔'); cap('bipartite graph G 有 complete matching', '若且唯若'); },
  async (tok, S) => { S.B.add('對所有 A ⊆ X：|R(A)| ≥ |A|', 'note'); cap('對所有 X 的 subset A', 'R(A) 的 cardinality 都要大於等於 A 的'); },
  async (tok, S) => {
    S.B.add('任找幾個女生，她們喜歡的男生數 ≥ 女生數', 'say');
    const bad = subsets(GIRLS).find((A) => Rof(ADJ, A).length < A.length);
    S.g = party(); ok(!!bad, 5.6, 4.4, '派對：有 A 不滿足（例如 ' + bad.join('') + '）✓');
    cap('換成派對：任找幾個女生', '她們喜歡的男生個數一定要 ≥ 女生個數');
  },
  async (tok, S) => { S.g.kill(); S.B.add('要證兩個方向；先證必要條件（P ⇒ Q）'); cap('充分且必要，要證兩個方向', '先證必要條件：P 推到 Q'); },
  async (tok, S) => { S.B.add('若有 complete matching ⇒ 對所有 A，|R(A)| ≥ |A|'); cap('如果有 complete matching', '那對所有 A，|R(A)| ≥ |A|'); },
  async (tok, S) => {
    S.B.add('contrapositive：有 A 使 |R(A)| < |A| ⇒ 沒有', 'note');
    const ad = { u: ['p', 'q'], v: ['p', 'q'], w: ['q', 'p'] };
    S.h = G(); ['u', 'v', 'w'].forEach((n, i) => S.h.v(n, 1.4, -1.6 + i * 1.4, GC.x, '')); ['p', 'q'].forEach((n, i) => S.h.v(n, 4.6, -0.9 + i * 1.4, GC.y, ''));
    Object.entries(ad).forEach(([x, ys]) => ys.forEach((y) => S.h.e(x, y)));
    SI(3.0, -2.8);
    ok(maxMatch(ad).n === 2, 3.0, 2.8, '3 個女生只喜歡 2 個男生：最多配 ' + maxMatch(ad).n + ' 對 ✓');
    cap('用 contrapositive：只要有一個 A 讓 |R(A)| < |A|', '比方三個女生只喜歡兩個男生，光她們就擺不平');
  },
  async (tok, S) => { S.B.add('這方向很簡單：trivial', 'good'); cap('這個方向很簡單', '老師說是 trivial'); },
]);

scene('g8e-hallpf', "Hall's theorem 充分性：用 Hungarian tree 找出壞的 A", [
  async (tok, S) => { S.B = board(); S.B.add('充分條件：沒那麼明白'); cap('必要條件很清楚', '但充分條件就不是那麼明白'); },
  async (tok, S) => { S.B.add('還是用 contrapositive'); cap('怎麼證？還是用 contrapositive', ''); },
  async (tok, S) => { S.B.add('假設：沒有 complete matching', 'note'); cap('假設沒有 complete matching', '再證那個條件不成立'); },
  async (tok, S) => { S.B.add('「對所有 A 成立」的否定：存在一個 A 使 |R(A)| < |A|', 'note'); cap('「對所有 A 都成立」的否定', '只要找到一個 A 不成立就好'); },
  async (tok, S) => { S.B.add('run Hungarian algorithm → maximum matching，不是 complete'); S.g = party({ M: M7 }); cap('用我們學過的：run Hungarian algorithm', '它產生 maximum matching，而它不是 complete'); },
  async (tok, S) => { S.g.glow('H', '#661111'); S.B.add('有 x 沒配到 → 它是 Hungarian acorn'); cap('不是 complete，就有 x-vertex 沒配到', '停下來時沒配到的都是 Hungarian acorn'); },
  async (tok, S) => { S.B.add('從它長的 alternating tree 是 Hungarian tree'); cap('從它長 alternating tree', '會變成 Hungarian tree：找不到 unmatched y'); },
  async (tok, S) => { S.B.add('數一數 tree 上的 x 和 y：x 剛好多 1', 'note'); cap('把 Hungarian tree 上的 x、y 數一數', 'x-vertex 的數目會剛好比 y-vertex 多 1'); },
  async (tok, S) => {
    S.t = G(); T('從 H 長出的 Hungarian tree', 'zone', 6.0, -4.6);
    tnode(S.t, 'H', 0, 1, 0);
    ['b', 'c', 'd'].forEach((y, k) => { tnode(S.t, y, k, 3, 1); tedge(S.t, 'H', y, 'p'); });
    ['F', 'E', 'D'].forEach((x, k) => { tnode(S.t, x, k, 3, 2); tedge(S.t, 'bcd'[k], x, 'pm'); });
    tnode(S.t, 'h', 2, 3, 3); tedge(S.t, 'D', 'h', 'p'); tnode(S.t, 'B', 2, 3, 4); tedge(S.t, 'h', 'B', 'pm');
    cap('例如前面例子：H 沒配到', '從 H 長出來的 Hungarian tree 是這樣');
  },
  async (tok, S) => { ['F', 'E', 'B'].forEach((x) => S.t.glow('t' + x, '#225522')); S.B.add('葉子都是 x：y 有配就再接下去，沒配就是 augmenting'); cap('tree 的葉子都會是 x-vertex', 'y 如果有配，就把 matching 那條邊再畫下去；沒配就找到 augmenting path 了'); },
  async (tok, S) => { ['F', 'E', 'B'].forEach((x) => S.t.glow('t' + x)); S.B.add('tree 上的 x 連到的 y，全都在 tree 上'); cap('跟 tree 上這些 x 相連的 y', '都會出現在 tree 裡（不然 tree 還沒長完）'); },
  async (tok, S) => { S.B.add('每個 y 配一個 x，再加 root → x 多 1'); cap('為什麼 always 多一個？', 'y 和 x 一對一對（matching 邊），再多一個 root'); },
  async (tok, S) => {
    const A = ['B', 'D', 'E', 'F', 'H'], R = Rof(ADJ, A);
    ok(R.length === 4 && A.length === 5, 2.0, 4.4, 'A = {B,D,E,F,H}，R(A) = {' + R.join(',') + '}：4 < 5 ✓');
    S.B.add('取 A＝tree 上的 x：|A| = 5、|R(A)| = 4', 'note');
    cap('把 A 取成 tree 上的 x-vertices：B、D、E、F、H', 'R(A) 就是 b、c、d、h；|R(A)| = 4 < |A| = 5');
  },
  async (tok, S) => { S.B.add('至少找到一個 A 不滿足 → 充分性得證', 'good'); cap('沒有 complete matching，就找到不滿足的 A', '只要找到一個就好，證完了'); },
  async (tok, S) => { S.B.add('一般：A＝tree 上的 x，R(A)＝tree 上的 y', 'say'); cap('一般情況也一樣', 'A 取 tree 上的 x，R(A) 一定就是 tree 上的 y'); },
  async (tok, S) => { S.B.add('兩個方向都用 contrapositive（反證）', 'say'); cap('兩個方向都用 contrapositive', "Hall's theorem 就證完了"); },
]);

scene('g8e-defic', 'Deficiency δ(G) 與 maximum matching 的大小', [
  async (tok, S) => { S.B = board(); S.B.add("Hall's theorem：complete matching 的充要條件"); cap("Hall's theorem", '是有 complete matching 的若且唯若條件'); },
  async (tok, S) => {
    S.B.add('但要 check 所有 2^|X| 個 subset', 'say');
    ok(subsets(GIRLS).length === 256, 3.0, -4.2, '8 個女生：2⁸ = ' + subsets(GIRLS).length + ' 個 subset ✓');
    cap('問題是 |X| 大的時候不好 check', '要檢查所有 subset，一共 2^|X| 個');
  },
  async (tok, S) => { S.B.add('第二件事：maximum matching 的 size 是多少？'); cap('第二件事', '到底 maximum matching 的 size 是多少'); },
  async (tok, S) => { S.B.add('定義 deficiency（不足）δ(G)', 'ptr'); cap('定義一個東西叫 deficiency', '中文是「不足」'); },
  async (tok, S) => { S.B.add('看 |A| − |R(A)|：女生比喜歡的男生多幾個'); cap('跟 |A| 和 |R(A)| 有關', '|A| − |R(A)| 就是這群女生不夠幾個男生'); },
  async (tok, S) => { S.B.add('例：5 個女生只喜歡 4 個男生 → 差 1'); cap('比方五個女生只有四個男生', '就差一個男生'); },
  async (tok, S) => { S.B.add('δ(G) = max over A ⊆ X of ( |A| − |R(A)| )', 'note'); cap('考慮所有 X 的 subset A', '不足的量裡面最大的，就是 deficiency δ(G)'); },
  async (tok, S) => { S.B.add('例：|A| = 3、|R(A)| = 1 → 差 2（示意）', 'say'); cap('比方 A 有 3 個、R(A) 只有 1 個', '那這個 A 差 2'); },
  async (tok, S) => { S.B.add('Remark：δ(G) ≥ 0', 'note'); cap('第一個 remark', 'deficiency 一定 ≥ 0，不會是負的'); },
  async (tok, S) => { S.B.add('A = ∅：|∅| − |R(∅)| = 0 − 0 = 0'); cap('因為 A 可以取空集合', '0 − 0 = 0，最大值至少是 0'); },
  async (tok, S) => { S.B.add('δ 和 maximum matching 的 size 有什麼關係？'); cap('這個量跟 maximum matching 的 size 有關', '想一下會是什麼關係'); },
  async (tok, S) => { S.B.add('δ = 0（每群都夠）→ maximum = |X|（complete）'); cap('如果 always 夠，δ 就是 0', '這時 maximum matching 就是 |X|'); },
  async (tok, S) => {
    const d = deficiency(ADJ), mm = maxMatch(ADJ);
    S.B.add('派對：|X| = 8、δ = 1 → 最多 7');
    ok(d.d === 1 && mm.n === 7, 0.4, 4.4, '暴力算 256 個 A：δ = ' + d.d + '；最大 matching = ' + mm.n + ' = 8 − 1 ✓');
    S.g = party({ M: M7 });
    cap('δ = 1、|X| = 8 的話呢？', '像派對例子：Hazel 沒配到，最多 7 = 8 − 1');
  },
  async (tok, S) => { S.B.add('定理：maximum matching 的 size = |X| − δ(G)', 'good'); cap('性質：bipartite graph G 的', 'maximum matching size = |X| − δ(G)'); },
  async (tok, S) => { S.B.add('特例：有 complete matching ⇔ δ = 0（同 Hall）', 'say'); cap('特別的例子：有 complete matching', '那 δ 一定是 0，跟前面 Hall 一樣'); },
  async (tok, S) => { S.B.add('maximum 比 complete 少的量＝δ(G)'); cap('其他情況差多少', '就差 deficiency 那麼多：8 個女生配到 7 個'); },
  async (tok, S) => { S.B.add('但直接算 δ 也要看所有 2^|X| 個 subset', 'say'); cap('實際要用還是要算 deficiency', '直接算也要考慮所有 subset，不是很好用'); },
]);

// ════════ JGqB5cUX6cE（第30B講：證明 maximum matching = |X| − δ(G)） ════════
const A0 = ['B', 'D', 'E', 'F', 'H'];
scene('g8e-dpf1', '證明（一）：任何 matching ≤ |X| − δ', [
  async (tok, S) => { S.B = board(); S.B.add('要證：maximum matching 的 size = |X| − δ', 'note'); cap('來證這個性質', 'maximum matching 的 size 剛好是 |X| − δ'); },
  async (tok, S) => { S.B.add('δ = max over A ⊆ X 的 |A| − |R(A)|'); cap('回來看 δ 的定義', '所有 subset A 的 |A| − |R(A)| 的最大值'); },
  async (tok, S) => { S.B.add('最大值一定在某個 subset 達到', 'say'); cap('因為是 maximum', '一定存在一個 subset 剛好達到這個最大值'); },
  async (tok, S) => {
    S.B.add('存在 A₀ ⊆ X：|A₀| − |R(A₀)| = δ', 'note');
    S.g = party({ M: M7 }); A0.forEach((x) => S.g.glow(x, '#661111'));
    const R = Rof(ADJ, A0); const d = deficiency(ADJ).d;
    ok(A0.length - R.length === d, 5.6, 4.4, '派對：A₀ = {B,D,E,F,H}，5 − 4 = 1 = δ ✓');
    cap('有一個 subset 叫 A₀', '|A₀| − |R(A₀)| 剛好等於 δ（maximum，不是 supremum）');
  },
  async (tok, S) => { S.B.add('光看 A₀：不管怎麼配，都差 δ 個'); cap('光考慮 A₀ 這幾個女生', '她們喜歡的男生比她們少 δ 個，怎麼配都會差 δ'); },
  async (tok, S) => {
    S.B.add('任何 matching：A₀ 至少 δ 人 unmatched', 'note');
    const allM = [M5, M6, M7].every((M) => A0.filter((x) => !M[x]).length >= 1);
    ok(allM, 5.6, 3.7, '老師 run 出的 M₅、M₆、M₇：A₀ 都有人沒配 ✓');
    cap('所以任何 matching', 'A₀ 裡至少有 δ 個人會 remain unmatched');
  },
  async (tok, S) => { A0.forEach((x) => S.g.glow(x)); S.B.add('⇒ 任何 matching 的 size ≤ |X| − δ（upper bound）', 'good'); cap('所以任何 matching 的 size', '都 ≤ |X| − δ，這是 upper bound'); },
]);

scene('g8e-dpf2', '證明（二）：想法——加點加邊做出 complete matching', [
  async (tok, S) => { S.B = board(); S.B.add('只差一步：找一個 size 剛好 = |X| − δ 的 matching', 'note'); cap('再來要證剛好等於', '只要找到一個 matching 剛好這麼大'); },
  async (tok, S) => { S.B.add('所有都 ≤ 它，又有一個等於 → 它就是 maximum'); cap('所有 matching 都 ≤ 這個 upper bound', '找到一個剛好等於的，它就一定最大'); },
  async (tok, S) => { S.g = party(); S.B.add('想法：加一些點、邊，讓它有 complete matching'); cap('想辦法在原來的 bipartite graph 上', '加一些點、加一些邊，讓它有 complete matching'); },
  async (tok, S) => { S.B.add('complete 的 size = |X|，再把多加的邊丟掉', 'say'); cap('complete matching 的 size 就是 |X|', '然後把裡面多加的邊丟掉，就知道剩多少'); },
  async (tok, S) => {
    S.g.v('z', PY, 4.6, GC.new, 'D'); S.zl = T('新加的點（集合 D）', 'ptr alt', PY + 1.8, 4.6);
    S.B.add('點加在 Y 這邊：集合 D');
    cap('要維持 X 不變，點都加在 Y 這邊', '這些新的點叫集合 D');
  },
  async (tok, S) => { GIRLS.forEach((x) => S.g.e(x, 'z', 'k')); S.B.add('X 的每個點連到 D 的每個點', 'note'); cap('然後把 X 的所有點', '連到 D 的所有點，能畫的邊全部畫上去'); },
  async (tok, S) => { S.B.add('新圖有 complete matching → 拿掉新邊 → 原圖的 matching', 'say'); cap('再 argue：加得夠，新圖就有 complete matching', '把新加的邊拿掉，就得到原圖一個剛好那麼大的 matching'); },
]);

scene('g8e-dpf3', '證明（三）：G* 滿足 Hall 條件，拿掉 δ 條邊', [
  async (tok, S) => {
    S.B = board(); S.g = party();
    S.g.v('z', PY, 4.6, GC.new, 'D₁'); S.B.add('|D| = δ（加 δ 個新點）', 'note');
    T('派對：δ = 1，加 1 個點（示意）', 'say', PY + 2.6, 4.6);
    cap('D 的 size 剛好是 δ', '加進去 δ 個新端點');
  },
  async (tok, S) => { S.B.add('新的圖叫 G*'); cap('新的圖叫 G*', '原來的圖是 G'); },
  async (tok, S) => { S.B.add('X* = X，Y* = Y ∪ D'); cap('G* 還是 bipartite graph', 'X* 還是原來的 X；Y* 是原來的 Y 再加上 D'); },
  async (tok, S) => { GIRLS.forEach((x) => S.g.e(x, 'z', 'k')); S.B.add('E* = E ∪ K，K＝X 和 D 之間所有可能的邊', 'note'); cap('edge set：原來的 E 再聯集 K', 'K is the set of all possible edges connecting X and D'); },
  async (tok, S) => { S.B.add('黃色的邊＝K、黃色的點＝D', 'say'); cap('黃色的邊就是 K，黃色的點就是 D', 'G* 就是白色原圖再加上黃色的部分'); },
  async (tok, S) => { S.B.add("主張：G* 有 complete matching（用 Hall's theorem）", 'note'); cap('保證 G* 有 complete matching', "怎麼證？check Hall's theorem 的條件"); },
  async (tok, S) => { S.B.add('考慮任一 A ⊆ X*，R*(A)＝在 G* 裡的 R(A)'); cap('考慮所有 X* 的 subset A', 'R*(A) 是在 G* 裡的 R(A)'); },
  async (tok, S) => { S.B.add('R*(A) = R(A) ∪ D（A 不是空集合時）'); cap('R*(A) 有兩部分', '原來的 R(A)，再加上整個 D（A 的點都連到 D 的每個點）'); },
  async (tok, S) => { S.B.add('R(A) ∩ D = ∅ ⇒ |R*(A)| = |R(A)| + δ'); cap('R(A) 和 D 沒有交集', '所以聯集的 size 等於各自 size 的和'); },
  async (tok, S) => { S.B.add('δ 是最大值：|A| − |R(A)| ≤ δ ⇒ |R(A)| − |A| ≥ −δ'); cap('δ 是所有 |A| − |R(A)| 的最大值', '反過來減：|R(A)| − |A| ≥ −δ'); },
  async (tok, S) => {
    const adj2 = Object.fromEntries(GIRLS.map((x) => [x, [...ADJ[x], 'z']]));
    S.adj2 = adj2;
    ok(hallOK(adj2), 5.6, -2.8, 'G*：256 個 A 全部 |R*(A)| ≥ |A| ✓');
    S.B.add('|R*(A)| − |A| ≥ δ − δ = 0：Hall 條件成立', 'good');
    cap('所以 |R*(A)| − |A| ≥ δ − δ = 0', 'G* 對所有 A 都滿足 Hall condition');
  },
  async (tok, S) => {
    S.Ms = { ...M7, H: 'z' };
    paintM(S.g, S.Ms); GIRLS.forEach((x) => S.g.set(x, 'z', S.Ms[x] === 'z' ? 'm' : 'k'));
    ok(isMatching(S.Ms) && msize(S.Ms) === 8 && maxMatch(S.adj2).n === 8, 5.6, -4.2, 'G* 的 complete matching M*：|M*| = 8 ✓');
    S.B.add('G* 有 complete matching M*', 'note');
    cap('所以 G* 有一個 complete matching M*', '有些邊是白的（原圖）、有些是黃的（K）');
  },
  async (tok, S) => { S.B.add('把 M* 裡屬於 K 的邊拿掉'); cap('把 M* 裡面那些黃色的邊拿掉', '它們是我們新加進去的'); },
  async (tok, S) => { S.B.add('M* 在 K 裡最多 δ 條（D 只有 δ 個點）'); cap('M* 在 K 裡最多幾條？', 'D 只有 δ 個點，每個點最多碰一條 matching 邊'); },
  async (tok, S) => { S.B.add('也不會少於 δ：否則剩下的 > |X| − δ，矛盾'); cap('也不可能少於 δ', '不然拿掉以後剩下的 matching 比 |X| − δ 還大，違反剛才的 upper bound'); },
  async (tok, S) => {
    const N = { ...S.Ms }; Object.keys(N).forEach((x) => { if (N[x] === 'z') delete N[x]; });
    GIRLS.forEach((x) => S.g.hide(x, 'z')); S.g.V.z.visible = false;
    ok(isMatching(N) && inGraph(ADJ, N) && msize(N) === 8 - 1, 5.6, -3.5, '拿掉 δ = 1 條：剩 ' + msize(N) + ' = 8 − 1 ✓');
    S.B.add('|M*| = |X|，拿掉 δ 條 → G 的 matching，size |X| − δ', 'good');
    cap('M* 的 size 是 |X|，拿掉剛好 δ 條', '剩下的是原圖 G 的 matching，size |X| − δ');
  },
  async (tok, S) => { S.B.add('所以 maximum matching 的 size = |X| − δ(G)', 'good'); cap('最大就這麼多，又找到一個這麼大的', '所以 maximum matching 的 size 就是 |X| − δ'); },
]);

scene('g8e-sum', '本段小結：Hall 與 deficiency', [
  async (tok, S) => { S.B = board(); S.B.add("1. Hall's theorem：有 complete matching ⇔ 所有 A，|R(A)| ≥ |A|", 'note'); cap('這堂課講了兩個性質', "第一個是 Hall's theorem：complete matching 存在的充要條件"); },
  async (tok, S) => { S.B.add('2. maximum matching 的 size = |X| − δ(G)', 'note'); cap('第二個性質', '用 deficiency 描述 maximum matching 的 size'); },
  async (tok, S) => { S.B.add("證明：Hall 用 Hungarian algorithm；δ 的性質用 Hall", 'say'); cap("Hall's theorem 的證明用到 Hungarian algorithm", '第二個性質的證明用到 Hall 的結果'); },
]);
  }

  // ═══ g8f.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章（清大 趙啟超 第31A–32B講 Maximum Flow）— cued scenes ───
// transport network、capacity、flow（feasibility + conservation）、value、cut、val = 流過去 − 流回來、
// cut capacity、val ≤ c(S,T)、f-augmenting path（forward / backward）、Δ_P、Max-Flow Min-Cut Theorem 的證明、
// Edmonds–Karp。每個 scene 是一串 step；每個 step 等老師講到那一句（notes 的 cues）才動一下，不重播。
// 老師從頭到尾用同一個 network（由 31A–31D 口述的數字重建，彼此吻合）：
//   c(s,a)=5 c(s,b)=4 c(s,c)=3 c(a,d)=6 c(a,t)=3 c(b,d)=2 c(c,d)=7 c(c,t)=5 c(d,t)=4
//   flow f：3 2 3 1 2 2 1 2 4（value 8）→ 沿 s-a-t 加 1（9）→ 沿 s-a-d-c-t 加 1（10，cut {s,b} = 10）
// 所有 inflow/outflow、flow value、cut capacity、Δ 都由程式從這些數字算出來，畫面上顯示 ✓（不對會變 ✘）。
// 老師沒畫的（小例子、Edmonds–Karp 實際跑一次）一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const lb = (t, c, x, y) => tag(t, c, x, y, 0.3);
const ok = (b, t, x, y) => (b ? lb(t, 'good', x, y) : lb(t.replace(/✓/g, '✘'), 'bad', x, y));
const vis = (o, on) => { if (!o) return; o.visible = on; if (o.element) o.element.style.visibility = on ? '' : 'hidden'; };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.element) remove(o); else kill(o); });
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
const FC = { v: '#cdbfa6', S: '#e55a9b', T: '#4b9ee2', e: '#9c8b70', hot: '#d64545', ok: '#2fc092', sat: '#c08a1f', back: '#9b7ef4', fwd: '#dd8238', dim: '#e2d8c6', blue: '#4b9ee2' };
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a board at the top: newest line lit (note), older lines plain (say); at most `max` lines, oldest drops off
function board(o = {}) {
  // 3 lines fit between the top of the stage and the network's top vertex a (4 printed over a and its edge labels)
  // o.pin: pinned to the left edge as a wrapped column (for scenes whose picture sits on the right)
  const st = stackBoard(o.x ?? 0, o.y ?? 10.2, 0.3, o.pin !== undefined ? { max: o.max ?? 3, pin: o.pin, maxW: o.maxW ?? 230 } : { max: o.max ?? 3, center: true }); const ls = st.ls;
  return {
    ls,
    add(t, c = 'note') {
      ls.forEach((l) => { if (l.userData.hot) { cls(l, 'say'); l.userData.hot = false; } });
      const l = st.line(t, c); l.userData.hot = c === 'note'; return l;
    },
    clear() { st.clear(); },
  };
}

// ── the lecturer's network and all the arithmetic on it ──
const NE = [['s', 'a', 5], ['s', 'b', 4], ['s', 'c', 3], ['a', 'd', 6], ['a', 't', 3], ['b', 'd', 2], ['c', 'd', 7], ['c', 't', 5], ['d', 't', 4]];
const KEYS = NE.map(([u, w]) => u + w);
const CAPS = Object.fromEntries(NE.map(([u, w, c]) => [u + w, c]));
const VS = ['s', 'a', 'b', 'c', 'd', 't'];
const F8 = { sa: 3, sb: 2, sc: 3, ad: 1, at: 2, bd: 2, cd: 1, ct: 2, dt: 4 };
const F9 = { ...F8, sa: 4, at: 3 };
const F10 = { ...F9, sa: 5, ad: 2, cd: 0, ct: 3 };
const ZERO = Object.fromEntries(KEYS.map((k) => [k, 0]));
const ins = (v) => KEYS.filter((k) => k[1] === v);
const outs = (v) => KEYS.filter((k) => k[0] === v);
const sumF = (F, ks) => ks.reduce((s, k) => s + F[k], 0);
const sumC = (ks) => ks.reduce((s, k) => s + CAPS[k], 0);
const inF = (F, v) => sumF(F, ins(v));
const outF = (F, v) => sumF(F, outs(v));
const val = (F) => outF(F, 's');
const feasible = (F) => KEYS.every((k) => Number.isInteger(F[k]) && F[k] >= 0 && F[k] <= CAPS[k]);
const conserv = (F) => ['a', 'b', 'c', 'd'].every((v) => inF(F, v) === outF(F, v));
const fwdE = (S) => KEYS.filter((k) => S.includes(k[0]) && !S.includes(k[1]));
const bwdE = (S) => KEYS.filter((k) => !S.includes(k[0]) && S.includes(k[1]));
const inSE = (S) => KEYS.filter((k) => S.includes(k[0]) && S.includes(k[1]));
const capCut = (S) => sumC(fwdE(S));
const netCut = (F, S) => sumF(F, fwdE(S)) - sumF(F, bwdE(S));
const ALLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((m) => ['s', ...['a', 'b', 'c', 'd'].filter((_, i) => m & (1 << i))]);
const MINCUT = Math.min(...ALLS.map(capCut));
const plus = (F, ks) => ks.map((k) => F[k]).join(' + ');
const plusC = (ks) => ks.map((k) => CAPS[k]).join(' + ');
const en = (k) => '(' + k[0] + ',' + k[1] + ')';
const setS = (S) => '{' + S.join(',') + '}';
const comp = (S) => VS.filter((v) => !S.includes(v));
// BFS tree of incomplete f-augmenting paths (forward f < c, backward f > 0)
function bfs(F) {
  const par = { s: null }, lev = { s: 0 }, order = ['s'], q = ['s'];
  while (q.length) {
    const u = q.shift();
    for (const k of KEYS) {
      if (k[0] === u && !(k[1] in par) && F[k] < CAPS[k]) { par[k[1]] = [u, k, 'f']; lev[k[1]] = lev[u] + 1; q.push(k[1]); order.push(k[1]); }
      else if (k[1] === u && !(k[0] in par) && F[k] > 0) { par[k[0]] = [u, k, 'b']; lev[k[0]] = lev[u] + 1; q.push(k[0]); order.push(k[0]); }
    }
  }
  return { par, lev, order, hasT: 't' in par };
}
function pathTo(par, v) { const p = []; while (par[v]) { p.unshift(par[v]); v = par[v][0]; } return p; }
const dOf = (F, [, k, d]) => (d === 'f' ? CAPS[k] - F[k] : F[k]);
const deltaOf = (F, p) => Math.min(...p.map((e) => dOf(F, e)));
function augment(F, p, D) { const G = { ...F }; p.forEach(([, k, d]) => { G[k] += d === 'f' ? D : -D; }); return G; }
// Edmonds–Karp on the lecturer's network from the zero flow (示意 run)
const EKRUN = (() => {
  let F = { ...ZERO }; const out = [];
  for (let i = 0; i < 20; i++) {
    const B = bfs(F); if (!B.hasT) { out.push({ end: true, B, F }); break; }
    const p = pathTo(B.par, 't'), D = deltaOf(F, p); const G = augment(F, p, D);
    out.push({ B, p, D, F: G }); F = G;
  }
  return out;
})();
const EKEND = EKRUN[EKRUN.length - 1];
const pathNames = (p) => ['s', ...p.map(([u, k]) => (k[0] === u ? k[1] : k[0]))];

// ── drawing: a directed edge in the picture plane (x right, y up) ──
const UP = V3(0, 1, 0);
function dEdge(pa, pb, o = {}) {
  const gap = o.gap ?? 0.44, r = o.r ?? 0.055;
  const n = pb.clone().sub(pa).normalize();
  const s = pa.clone().addScaledVector(n, gap), e = pb.clone().addScaledVector(n, -gap);
  const L = Math.max(0.05, s.distanceTo(e) - 0.3);
  const mat = new THREE.MeshStandardMaterial({ color: o.c || FC.e, roughness: 0.6 });
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
  cyl.position.copy(s).addScaledVector(n, L / 2); cyl.quaternion.setFromUnitVectors(UP, n); g.add(cyl);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 12), mat);
  cone.position.copy(e).addScaledVector(n, -0.17); cone.quaternion.setFromUnitVectors(UP, n); g.add(cone);
  lab.world.add(g);
  return { g, mat, cyl, mid: s.clone().add(e).multiplyScalar(0.5), side: V3(-n.y, n.x, 0) };
}
function halo(p, color, r = 0.62) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
  m.position.set(p.x, p.y, -0.3); lab.world.add(m); return m;
}
// a sits a little lower than on the blackboard: the board's lines above need the room
const NV = { s: [-5.6, 3], a: [-1.9, 5.1], b: [-1.9, 3], c: [-1.9, 0.6], d: [2.1, 3], t: [5.6, 3] };
// the network: o.s scale, o.ox/o.oy shift, o.show false = start hidden
function mkNet(o = {}) {
  const sc = o.s ?? 1, ox = o.ox ?? 0, oy = o.oy ?? 0;
  const N = { v: {}, e: {}, h: {}, F: { ...ZERO } };
  N.p = (n) => V3(ox + NV[n][0] * sc, oy + NV[n][1] * sc, 0);
  VS.forEach((n) => {
    const m = lab.box(FC.v, [0.66, 0.66, 0.42]); m.userData.lbl = lab.label(n, 'val'); m.add(m.userData.lbl);
    m.position.copy(N.p(n)); lab.world.add(m); N.v[n] = m; vis(m, o.show !== false); vis(m.userData.lbl, o.show !== false);
  });
  NE.forEach(([u, w, c]) => {
    const k = u + w, d = dEdge(N.p(u), N.p(w), { gap: 0.44 });
    const q = d.mid.clone().addScaledVector(d.side, 0.36);
    const l = tag(String(c), 'note', q.x, q.y, 0.3);
    N.e[k] = { k, u, w, c, ...d, l, mode: 'cap' };
    vis(d.g, o.show !== false); vis(l, o.show !== false && o.labels !== false);
  });
  N.showV = (n, on = true) => { vis(N.v[n], on); vis(N.v[n].userData.lbl, on); };
  N.showE = (k, on = true) => { vis(N.e[k].g, on); if (N.e[k].mode !== 'none') vis(N.e[k].l, on); };
  N.lab = (k, mode) => {
    const e = N.e[k]; e.mode = mode;
    if (mode === 'none') { vis(e.l, false); return; }
    vis(e.l, true);
    if (mode === 'cap') { cls(e.l, 'note'); e.l.element.textContent = String(e.c); }
    else if (mode === 'q') { cls(e.l, 'say'); e.l.element.innerHTML = '<b style="color:#c62828">?</b><span style="color:#8a6a00">/' + e.c + '</span>'; }
    else { cls(e.l, 'say'); e.l.element.innerHTML = '<b style="color:#c62828">' + N.F[k] + '</b><span style="color:#8a6a00">/' + e.c + '</span>'; }
  };
  N.f = (k, v) => { N.F[k] = v; N.lab(k, 'flow'); };
  N.setF = (F) => KEYS.forEach((k) => N.f(k, F[k]));
  N.labs = (mode) => KEYS.forEach((k) => N.lab(k, mode));
  N.pe = (k, c, thick) => { const e = N.e[k]; e.mat.color.set(c || FC.e); const s = thick ? 1.9 : 1; e.cyl.scale.set(s, 1, s); };
  N.reset = () => KEYS.forEach((k) => N.pe(k, FC.e));
  N.vc = (n, c, em) => { N.v[n].material.color.set(c || FC.v); glow(N.v[n], em || '#000000'); };
  N.halo = (n, c) => { if (N.h[n]) kill(N.h[n]); N.h[n] = c ? halo(N.p(n), c) : null; };
  N.cut = (S) => { VS.forEach((v) => { N.halo(v, S.includes(v) ? FC.S : FC.T); N.vc(v, S.includes(v) ? '#f2b8d2' : '#b9d6f2'); }); };
  N.uncut = () => { VS.forEach((v) => { N.halo(v, null); N.vc(v); }); };
  N.paintCut = (S) => { N.reset(); fwdE(S).forEach((k) => N.pe(k, FC.fwd, true)); bwdE(S).forEach((k) => N.pe(k, FC.back, true)); };
  N.ptag = (n, t, c = 'ptr', dy = -0.75) => { const p = N.p(n); return lb(t, c, p.x, p.y + dy); };
  N.mtag = (k, t, c = 'ptr alt', off = -0.42) => { const e = N.e[k]; const q = e.mid.clone().addScaledVector(e.side, off); return lb(t, c, q.x, q.y); };
  return N;
}
async function pop(tok, m, k = 0.35, ms = 420) { await anim(tok, ms, (u) => m.scale.setScalar(1 + k * Math.sin(Math.PI * u))); m.scale.setScalar(1); }
async function flowIn(tok, N, k, v, ms = 380) { N.pe(k, FC.hot, true); N.f(k, v); await pop(tok, N.v[N.e[k].w], 0.2, ms); N.pe(k, FC.e); }
// a small "water" packet travelling along a list of vertices
async function pkt(tok, N, names, text = '流', ms = 1800) {
  // it rides just under the vertices (above them it ran into the board's lines)
  const l = lb(text, 'pkt', N.p(names[0]).x, N.p(names[0]).y - 0.55);
  const seg = Math.min(700, ms / (names.length - 1));
  for (let i = 1; i < names.length; i++) {
    const a = N.p(names[i - 1]), b = N.p(names[i]); a.y -= 0.55; b.y -= 0.55; a.z = b.z = 0.3;
    await travel(tok, l, a, b, seg);
  }
  remove(l);
}
// the path s-a-d-c-t drawn on its own row (31C/31D): [key, from x, to x]
const PROW = { s: -5, a: -2.5, d: 0, c: 2.5, t: 5 };
function pathRow(y = -1.4) {
  const R = { v: {}, e: {}, y };
  Object.entries(PROW).forEach(([n, x]) => { const m = lab.box('#efe3c8', [0.6, 0.6, 0.4]); m.userData.lbl = lab.label(n, 'val'); m.add(m.userData.lbl); m.position.set(x, y, 0); lab.world.add(m); R.v[n] = m; });
  ['sa', 'ad', 'cd', 'ct'].forEach((k) => {
    const d = dEdge(V3(PROW[k[0]], y, 0), V3(PROW[k[1]], y, 0), { gap: 0.42 });
    const l = lb(String(CAPS[k]), 'note', (PROW[k[0]] + PROW[k[1]]) / 2, y + 0.55);
    R.e[k] = { ...d, l };
  });
  R.show = (F) => Object.entries(R.e).forEach(([k, e]) => { cls(e.l, 'say'); e.l.element.innerHTML = '<b style="color:#c62828">' + F[k] + '</b><span style="color:#8a6a00">/' + CAPS[k] + '</span>'; });
  R.mark = (k, t, c) => lb(t, c, (PROW[k[0]] + PROW[k[1]]) / 2, y - 0.62);
  return R;
}
const SADCT = [['s', 'sa', 'f'], ['a', 'ad', 'f'], ['d', 'cd', 'b'], ['c', 'ct', 'f']];

// ════════ O2cUhuqSQJ8（第31A講：transport network、capacity、flow、feasibility、conservation、value） ════════
scene('g8f-network', 'Maximum flow problem：transport network', [
  async (tok, S) => {
    S.B = board();
    S.B.add('最後一個題目：maximum flow problem');
    S.B.add('裡面有名的定理：max-flow min-cut theorem', 'say');
    cap('Optimization 與 matching 的最後一題', 'maximum flow problem');
  },
  async (tok, S) => {
    S.N = mkNet({ labels: false });
    S.N.labs('none');
    S.B.add('N = (V, E)：connected、directed、simple graph');
    cap('我們討論的 graph 叫 N = (V, E)', 'connected directed simple graph');
  },
  async (tok, S) => {
    KEYS.forEach((k) => S.N.pe(k, FC.hot, true)); await wt(tok, 700); S.N.reset();
    S.B.add('之前的問題都是 undirected；這裡每條邊有方向', 'say');
    cap('前面幾個問題的圖是 undirected', '這裡是 directed graph');
  },
  async (tok, S) => {
    S.B.add('這樣的 N 叫 network，或 transport network');
    cap('N 叫 network', '或者叫 transport network');
  },
  async (tok, S) => {
    S.N.vc('s', FC.S); await pop(tok, S.N.v.s);
    S.ts = S.N.ptag('s', 'source s（唯一）');
    cap('第一：有唯一的端點 s', '叫 source');
  },
  async (tok, S) => {
    for (const k of outs('s')) { S.N.pe(k, FC.fwd, true); await wt(tok, 250); }
    S.B.add('連到 s 的邊全都 directed away from s（離開 s）');
    cap('連在 source 上的邊', '方向全部是離開 s');
  },
  async (tok, S) => {
    S.N.vc('t', FC.T); await pop(tok, S.N.v.t);
    S.tt = S.N.ptag('t', 'sink t（唯一）');
    cap('對應的另一個特別端點：sink t', '也是唯一的');
  },
  async (tok, S) => {
    for (const k of ins('t')) { S.N.pe(k, FC.blue, true); await wt(tok, 250); }
    S.B.add('連到 t 的邊全都 directed toward t（朝向 t）');
    cap('連在 t 上的邊方向都朝向 t', 'source 只出、sink 只進');
  },
  async (tok, S) => {
    S.N.reset();
    for (const k of KEYS) { S.N.lab(k, 'cap'); await wt(tok, 120); }
    S.B.add('capacity：每條有向邊 (v, w) 有一個 c(v, w)');
    S.B.add('(v, w) 是有序對（有方向）；以前無向邊是 {v, w}', 'say');
    cap('每條邊有一個 capacity c(v, w)', '(v, w) 有方向，不是集合 {v, w}');
  },
  async (tok, S) => {
    const good = KEYS.every((k) => Number.isInteger(CAPS[k]) && CAPS[k] >= 0);
    S.B.add('假設 capacity 都是 non-negative integer（非負整數）');
    S.k1 = ok(good, '這張圖的 9 個 capacity 都是非負整數 ✓', 0, -0.9);
    cap('capacity 假設是非負整數', '這不影響實際問題');
  },
  async (tok, S) => {
    gone(S.k1);
    const a = [-2, 3], k = -Math.min(...a);
    S.m1 = lb('示意：有負的？全部加 ' + k + '：' + a.join(', ') + ' → ' + a.map((x) => x + k).join(', '), 'say', 0, -0.9);
    cap('如果不是 ≥ 0', '全部加一個常數就好');
  },
  async (tok, S) => {
    const a = [0.5, 1.25], m = 4;
    S.m2 = lb('示意：不是整數？全部乘 ' + m + '：' + a.join(', ') + ' → ' + a.map((x) => x * m).join(', '), 'say', 0, -1.6);
    cap('如果不是整數：精確度有限', '全部乘一個常數就變整數');
  },
  async (tok, S) => {
    gone(S.m1, S.m2);
    S.B.add('network = source（全部出）+ sink（全部進）+ 每條邊的 capacity');
    cap('這樣的東西叫 network', 'source、sink、每邊一個 capacity');
  },
  async (tok, S) => {
    S.u1 = lb('例：輸送液體的管線：capacity = 管子的容量', 'say', 0, -0.9);
    await pkt(tok, S.N, ['s', 'a', 't'], '油', 1400);
    cap('可以 model 輸液體的管線', 'capacity 就是每根管子的容量');
  },
  async (tok, S) => {
    S.u2 = lb('例：computer network：capacity = link 的最大傳輸速率', 'say', 0, -1.6);
    await pkt(tok, S.N, ['s', 'c', 't'], 'data', 1400);
    cap('也可以 model computer network', '每個 link 的最大 data rate');
  },
  async (tok, S) => {
    S.B.add('max-flow min-cut theorem 也用在 network coding', 'say');
    cap('後面的定理', 'network coding 的基本原則會用到它');
  },
]);

scene('g8f-example', '老師的例子：s, a, b, c, d, t', [
  async (tok, S) => {
    S.B = board();
    S.N = mkNet({ show: false });
    S.B.add('舉個例子（後面從頭到尾都用它）');
    cap('看一個例子', '');
  },
  async (tok, S) => {
    for (const n of VS) { S.N.showV(n); await wt(tok, 150); }
    S.B.add('connected directed simple graph，6 個端點 s, a, b, c, d, t');
    cap('六個端點：s, a, b, c, d, t', '');
  },
  async (tok, S) => {
    S.N.vc('s', FC.S);
    for (const k of outs('s')) { S.N.showE(k); S.N.lab(k, 'none'); S.N.pe(k, FC.fwd, true); await wt(tok, 250); }
    S.B.add('s 是 source：' + outs('s').map(en).join('、') + ' 都從 s 出去');
    cap('s 是 source', '邊都 directed away from s');
  },
  async (tok, S) => {
    S.N.vc('t', FC.T);
    for (const k of KEYS.filter((k) => k[0] !== 's')) { S.N.showE(k); S.N.lab(k, 'none'); if (k[1] === 't') S.N.pe(k, FC.blue, true); await wt(tok, 200); }
    const okT = outs('t').length === 0 && ins('s').length === 0;
    S.B.add('t 是 sink：' + ins('t').map(en).join('、') + ' 都朝向 t');
    S.k = ok(okT, '檢查：沒有邊進 s、沒有邊出 t ✓', 0, -0.9);
    cap('t 是 sink', '邊都 directed towards t');
  },
  async (tok, S) => {
    S.N.reset();
    for (const k of KEYS) { S.N.lab(k, 'cap'); await wt(tok, 160); }
    S.B.add('黃色數字 = 每條 directed edge 的 capacity（非負整數）');
    cap('每個 edge 上有一個 capacity', '黃色的數字');
  },
  async (tok, S) => {
    S.N.pe('sa', FC.hot, true); await pop(tok, S.N.v.a, 0.2);
    S.h = S.N.mtag('sa', 'c(s, a) = ' + CAPS.sa);
    cap('例如 c(s, a) = 5', '其他依此類推');
  },
  async (tok, S) => {
    S.N.pe('sa', FC.e); gone(S.h, S.k);
    S.B.add('也像交通網路：capacity = 最大通行量（速率）', 'say');
    cap('這就是 network／transport network', '像交通網路的最大通行量');
  },
  async (tok, S) => {
    S.B.add('後面講這個問題時，從頭到尾都用這個例子');
    cap('這是我們要考慮的 graph', '後面都用它');
  },
]);

scene('g8f-flowdef', 'flow 的定義：feasibility 與 conservation', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet();
    S.B.add('Maximum flow problem：先定義什麼叫 flow');
    cap('什麼叫 flow？', '');
  },
  async (tok, S) => {
    for (const k of KEYS) { S.N.lab(k, 'q'); await wt(tok, 120); }
    S.B.add('flow f：每條邊 e 給一個 non-negative integer f(e)');
    cap('flow 是一個 function', '每條邊上給一個非負整數 f(e)');
  },
  async (tok, S) => {
    S.B.add('條件 1：f(e) ≤ c(e)（流量不能超過容量）');
    S.N.pe('sa', FC.hot, true);
    S.x = S.N.mtag('sa', 'f(s,a) ≤ ' + CAPS.sa);
    cap('第一個條件：flow 不能超過 capacity', 'f(e) ≤ c(e)');
  },
  async (tok, S) => {
    S.B.add('這個條件叫 feasibility；flow = 流量、capacity = 容量', 'say');
    cap('這叫 feasibility', 'flow 叫流量，capacity 叫容量');
  },
  async (tok, S) => {
    gone(S.x); S.N.pe('sa', FC.e);
    S.d = lb('像 network 的 link：實際傳的 data rate ≤ 最高 data rate', 'say', 0, -0.9);
    cap('實際傳的速率', '不能超過 link 最高的速率');
  },
  async (tok, S) => {
    gone(S.d);
    S.N.vc('d', FC.sat); await pop(tok, S.N.v.d);
    S.B.add('條件 2：每個端點 v：inflow(v) = outflow(v)');
    cap('第二個條件：流進去 = 流出來', '以 d 為例');
  },
  async (tok, S) => {
    for (const k of ins('d')) { S.N.pe(k, FC.blue, true); await wt(tok, 250); }
    S.in = lb('inflow(d) = Σ f(u, d)：' + ins('d').map((k) => 'f' + en(k)).join(' + '), 'say', 0, -0.9);
    cap('inflow：從其他端點流進 v 的', '所有 (u, v) 邊上的 flow 加起來');
  },
  async (tok, S) => {
    for (const k of outs('d')) { S.N.pe(k, FC.fwd, true); await wt(tok, 250); }
    S.out = lb('outflow(d) = Σ f(d, w)：' + outs('d').map((k) => 'f' + en(k)).join(' + '), 'say', 0, -1.6);
    cap('outflow：從 v 流出去的', '所有 (v, w) 邊上的 flow 加起來');
  },
  async (tok, S) => {
    S.B.add('這叫 conservation（流量守恆）；source 和 sink 除外');
    S.N.vc('s', FC.dim); S.N.vc('t', FC.dim);
    S.ex = lb('s 只有流出、t 只有流進 → 不要求', 'idx', 0, -2.3);
    cap('這叫 conservation，流量守恆', '除了 source 和 sink');
  },
  async (tok, S) => {
    await pkt(tok, S.N, ['b', 'd', 't'], '油', 1500);
    cap('想像成油管', '流進去的不流出來，跑到哪裡去？不會漏');
  },
  async (tok, S) => {
    gone(S.in, S.out, S.ex); S.N.reset(); S.N.vc('d'); S.N.vc('s'); S.N.vc('t');
    S.B.add('flow 要滿足兩個條件：feasibility ＋ conservation', 'good');
    cap('flow 的兩個條件', 'feasibility 和 conservation');
  },
  async (tok, S) => {
    const noE = !KEYS.includes('ab') && !KEYS.includes('ba');
    S.z = ok(noE, '沒有邊的地方（例如 a, b 之間）：c = f = 0 ✓', 0, -0.9);
    cap('沒有邊的時候', 'capacity 和 flow 都當作 0');
  },
  async (tok, S) => {
    gone(S.z);
    S.B.add('滿足條件的 flow 有很多 → 找 maximum flow（總量最大的）');
    cap('這樣的 flow 很多很多', '要找一個最大的：maximum flow');
  },
]);

scene('g8f-flow8', '一個 flow 的例子：逐邊 check', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet();
    S.B.add('一個 flow 的例子：同一個 network，每條邊給一個流量');
    cap('看一個 flow 的例子', '還是用這個圖');
  },
  async (tok, S) => {
    await flowIn(tok, S.N, 'sa', F8.sa);
    S.B.add('容量是黃色、流量是紅色：f(s,a) = ' + F8.sa, 'say');
    cap('(s,a) 上的 flow 是 3', '紅色寫流量，黃色是容量');
  },
  async (tok, S) => { await flowIn(tok, S.N, 'sb', F8.sb); cap('(s,b) 上的 flow 是 2', ''); },
  async (tok, S) => { await flowIn(tok, S.N, 'sc', F8.sc); cap('(s,c) 上的 flow 是 3', ''); },
  async (tok, S) => {
    for (const k of ['at', 'ad', 'bd', 'cd', 'dt', 'ct']) await flowIn(tok, S.N, k, F8[k], 300);
    cap('其他的邊：2 1 2 1 4 2', '每條邊都有一個流量');
  },
  async (tok, S) => {
    S.B.add('先 check feasibility：每條邊 紅 ≤ 黃');
    cap('先 check feasibility', '每個紅色要 ≤ 黃色');
  },
  async (tok, S) => {
    S.tk = [];
    for (const k of KEYS) { const g = F8[k] <= CAPS[k]; S.N.pe(k, g ? FC.ok : FC.hot, true); S.tk.push(S.N.mtag(k, F8[k] + '≤' + CAPS[k] + (g ? ' ✓' : ' ✘'), g ? 'good' : 'bad')); await wt(tok, 230); }
    cap('3 ≤ 5、2 ≤ 4、3 ≤ 3、…', '一條一條比');
  },
  async (tok, S) => {
    S.k1 = ok(feasible(F8), 'feasibility ✓（9 條邊都 f ≤ c）', 0, -0.9);
    cap('全部都滿足', 'feasibility ✓');
  },
  async (tok, S) => {
    gone(S.tk); S.N.reset();
    S.B.add('再 check conservation：a, b, c, d 的 inflow = outflow');
    cap('再 check conservation', '流量守恆');
  },
  async (tok, S) => {
    outs('s').forEach((k) => S.N.pe(k, FC.fwd, true));
    S.cs = S.N.ptag('s', 'outflow(s) = ' + plus(F8, outs('s')) + ' = ' + outF(F8, 's'));
    cap('S 的 outflow：3 + 2 + 3 = 8', '');
  },
  async (tok, S) => {
    S.k0 = lb('s 沒有 inflow（source 只流出）：inflow(s) = ' + inF(F8, 's'), 'say', 0, -1.6);
    cap('S 沒有 inflow', 'source 只有流出去');
  },
  async (tok, S) => {
    S.N.reset(); gone(S.k0);
    S.N.vc('a', FC.sat); ins('a').forEach((k) => S.N.pe(k, FC.blue, true));
    S.ca = S.N.ptag('a', 'in ' + plus(F8, ins('a')) + ' = ' + inF(F8, 'a'), 'ptr', 0.85);
    cap('看 a：inflow 是 3', '只有一條邊進來');
  },
  async (tok, S) => {
    outs('a').forEach((k) => S.N.pe(k, FC.fwd, true));
    gone(S.ca); S.ca = ok(inF(F8, 'a') === outF(F8, 'a'), 'a：' + inF(F8, 'a') + ' = ' + plus(F8, outs('a')) + ' ✓', S.N.p('a').x, S.N.p('a').y + 0.85);
    cap('a 的 outflow：1 + 2 = 3', 'inflow = outflow');
  },
  async (tok, S) => {
    S.N.reset(); S.N.vc('a'); S.N.vc('b', FC.sat); [...ins('b'), ...outs('b')].forEach((k) => S.N.pe(k, k[1] === 'b' ? FC.blue : FC.fwd, true));
    S.cb = ok(inF(F8, 'b') === outF(F8, 'b'), 'b：' + inF(F8, 'b') + ' = ' + outF(F8, 'b') + ' ✓', S.N.p('b').x + 0.2, S.N.p('b').y - 0.75);
    cap('b：inflow 2，outflow 2', '都只有一條邊');
  },
  async (tok, S) => {
    S.N.reset(); S.N.vc('b'); S.N.vc('c', FC.sat); [...ins('c'), ...outs('c')].forEach((k) => S.N.pe(k, k[1] === 'c' ? FC.blue : FC.fwd, true));
    S.cc = ok(inF(F8, 'c') === outF(F8, 'c'), 'c：' + inF(F8, 'c') + ' = ' + plus(F8, outs('c')) + ' ✓', S.N.p('c').x, S.N.p('c').y - 0.75);
    cap('c：inflow 3，outflow 1 + 2', '相等');
  },
  async (tok, S) => {
    S.N.reset(); S.N.vc('c'); S.N.vc('d', FC.sat); [...ins('d'), ...outs('d')].forEach((k) => S.N.pe(k, k[1] === 'd' ? FC.blue : FC.fwd, true));
    S.cd = ok(inF(F8, 'd') === outF(F8, 'd'), 'd：' + plus(F8, ins('d')) + ' = ' + outF(F8, 'd') + ' ✓', S.N.p('d').x + 0.3, S.N.p('d').y - 0.8);
    cap('d：inflow 1 + 2 + 1 = 4', 'outflow 只有一條邊：4');
  },
  async (tok, S) => {
    S.N.reset(); S.N.vc('d'); ins('t').forEach((k) => S.N.pe(k, FC.blue, true));
    S.ct = S.N.ptag('t', 'inflow(t) = ' + plus(F8, ins('t')) + ' = ' + inF(F8, 't'));
    cap('t 只有 inflow：2 + 4 + 2 = 8', '');
  },
  async (tok, S) => {
    S.N.reset();
    S.k2 = ok(conserv(F8), 'conservation ✓（a, b, c, d 都 inflow = outflow）', 0, -1.6);
    cap('除了 source 和 sink', '其他四個端點 inflow 都等於 outflow');
  },
  async (tok, S) => {
    S.k3 = ok(feasible(F8) && conserv(F8), '所以紅色這組數字是一個（合法的）flow ✓', 0, -2.3);
    cap('滿足 feasibility 和 conservation', '紅色的 assignment 就是一個 flow');
  },
  async (tok, S) => {
    S.B.add('flow = 每條邊一個非負整數，滿足 feasibility 和 conservation', 'good');
    cap('原來那個叫 network', '上面這樣的 assignment 叫 flow');
  },
]);

scene('g8f-value', 'flow 的 value 與 maximum flow', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('什麼叫 flow 的 value？');
    cap('要找最大的 flow', '先定義 flow 的 value');
  },
  async (tok, S) => {
    S.B.add('f 是 function：domain = E，codomain = 非負整數', 'say');
    cap('flow 是一個 function', 'domain 是 edge set');
  },
  async (tok, S) => {
    outs('s').forEach((k) => S.N.pe(k, FC.fwd, true));
    S.B.add('value of the flow = outflow of the source');
    cap('flow 的 value 定義成', 'source 的 outflow');
  },
  async (tok, S) => {
    S.v = lb('val(f) = ' + plus(F8, outs('s')) + ' = ' + val(F8), 'ptr alt', 0, -0.9);
    await pop(tok, S.N.v.s);
    cap('剛才的例子：value 是 8', '3 + 2 + 3');
  },
  async (tok, S) => {
    S.B.add('滿足兩個條件的 flow 很多；maximum flow = value 最大的那個');
    cap('flow 有很多個', 'value 最大的叫 maximum flow');
  },
  async (tok, S) => {
    S.N.reset();
    S.B.add('問題：given 一個 network，怎麼找 maximum flow？value 是多少？');
    cap('given 黃色的 network', '怎麼找 maximum flow？');
  },
  async (tok, S) => {
    S.B.add('後面：maximum flow 滿足什麼條件 ＋ 找它的 algorithm', 'say');
    cap('maximum flow 會滿足什麼條件', '還有找它的 algorithm');
  },
  async (tok, S) => {
    gone(S.v); S.v = lb('VAL(f) = outflow(s) = ' + val(F8), 'ptr alt', 0, -0.9);
    outs('s').forEach((k) => S.N.pe(k, FC.fwd, true));
    cap('同一個例子：VAL(f) = 8', '就是 source 的 outflow');
  },
  async (tok, S) => {
    S.N.reset();
    S.B.add('network 和 flow 定義清楚了 → 接下來找 maximum flow', 'good');
    cap('network 和 flow 都定義好了', '接下來要找 maximum flow');
  },
]);

// ════════ ePI-vLEM01Q（第31B講：cut、val(f) = 流過去 − 流回來、證明） ════════
const CUT1 = ['s', 'a', 'b', 'd'];
const FW1 = ['at', 'dt', 'sc'].filter((k) => fwdE(CUT1).includes(k)); // the lecturer's order: 2 + 4 + 3
scene('g8f-cut', 'cut：把 source 和 sink 分開', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('flow 的性質越多，工具越多；先看 cut');
    cap('flow 跟 cut 很有關係', '先看什麼叫 cut');
  },
  async (tok, S) => {
    S.B.add('一個 cut 有兩個集合：S 和 T');
    cap('一個 cut 有兩個集合', '一個叫 S，一個叫 T');
  },
  async (tok, S) => {
    S.N.halo('s', FC.S); S.N.halo('t', FC.T);
    S.B.add('(S, T)：separating source and sink');
    cap('separating source and sink', '把 source 和 sink 分開來');
  },
  async (tok, S) => {
    S.B.add('(S, T) 是 V 的 partition：S ∪ T = V，S ∩ T = ∅');
    cap('S、T 是 V 的 partition', '聯集是 V，交集是空集合');
  },
  async (tok, S) => {
    S.B.add('而且 source s ∈ S，sink t ∈ T');
    await pop(tok, S.N.v.s); await pop(tok, S.N.v.t);
    cap('一部分一定包含 source', '另一部分一定包含 sink');
  },
  async (tok, S) => {
    S.N.cut(CUT1);
    S.B.add('例：S = ' + setS(CUT1) + '，T = ' + setS(comp(CUT1)));
    cap('例如 s, a, b, d 當 S', 'c 和 t 當 T');
  },
  async (tok, S) => {
    S.N.paintCut(CUT1);
    S.sc = [...fwdE(CUT1), ...bwdE(CUT1)].map((k) => S.N.mtag(k, '✂', 'ptr', 0));
    cap('就好像把它這樣切下去', '被切到的邊上了顏色');
  },
  async (tok, S) => {
    const T = comp(CUT1); const part = CUT1.length + T.length === VS.length && CUT1.every((v) => !T.includes(v));
    S.k = ok(part && CUT1.includes('s') && T.includes('t'), '4 個在 S、2 個在 T；s ∈ S、t ∈ T → 是 cut ✓', 0, -0.9);
    cap('四個端點在一邊、兩個在另一邊', '這就是一個 cut');
  },
]);

scene('g8f-cutflow', 'val(f) = 流過去 − 流回來', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('cut 跟 flow value 有什麼關係？');
    cap('cut 跟 flow 的 value', '有一個性質，對任何 cut 都成立');
  },
  async (tok, S) => {
    S.B.add('對任何 flow f、任何 separating s 和 t 的 cut (S, T)：', 'say');
    cap('任何 flow', '任何把 s、t 分開的 cut');
  },
  async (tok, S) => {
    S.B.add('val(f) = 流過去的 − 流回來的');
    cap('flow 的 value 等於', '流過去的扣掉流回來的');
  },
  async (tok, S) => {
    S.B.add('流過去：Σ f(x, y)，x ∈ S、y ∈ T', 'say');
    cap('流過去：所有從 S 到 T 的邊', '上面的 flow 加起來');
  },
  async (tok, S) => {
    S.B.add('val(f) = Σ f(x,y)[x∈S, y∈T] − Σ f(u,v)[u∈T, v∈S]');
    cap('扣掉流回來的', '所有從 T 到 S 的邊上的 flow');
  },
  async (tok, S) => {
    S.N.cut(CUT1);
    S.e = lb('例：S = ' + setS(CUT1) + '，T = ' + setS(comp(CUT1)), 'ptr', 0, -0.9);
    cap('例如剛剛的 cut', 'S = {s, a, b, d}');
  },
  async (tok, S) => {
    for (const k of FW1) { S.N.pe(k, FC.fwd, true); await wt(tok, 300); }
    cap('流過去的是這三條邊', FW1.map(en).join('、'));
  },
  async (tok, S) => {
    S.f = lb('流過去：' + plus(F8, FW1) + ' = ' + sumF(F8, fwdE(CUT1)), 'say', -3.2, -1.6);
    cap('流過去的量：2 + 4 + 3', '');
  },
  async (tok, S) => {
    for (const k of bwdE(CUT1)) S.N.pe(k, FC.back, true);
    S.b = lb('流回來：' + bwdE(CUT1).map(en).join('') + ' 上的 ' + sumF(F8, bwdE(CUT1)), 'say', 3.2, -1.6);
    cap('流回來的只有一條邊', '(c, d) 上的 1');
  },
  async (tok, S) => {
    S.k = ok(netCut(F8, CUT1) === val(F8), sumF(F8, fwdE(CUT1)) + ' − ' + sumF(F8, bwdE(CUT1)) + ' = ' + netCut(F8, CUT1) + ' = val(f) ✓', 0, -2.3);
    cap('9 − 1 = 8', '正好是剛剛算的 flow value');
  },
  async (tok, S) => {
    gone(S.f, S.b, S.k, S.e); S.N.uncut(); S.N.reset();
    const all = ALLS.every((C) => netCut(F8, C) === val(F8));
    S.k = ok(all, '程式把 16 個 cut 都算一次：流過去 − 流回來 全都 = ' + val(F8) + ' ✓', 0, -0.9);
    cap('對任何 cut 都成立', '只要 s 在一邊、t 在另一邊');
  },
  async (tok, S) => {
    S.B.add('原因：conservation，流量不會漏掉', 'good');
    await pkt(tok, S.N, ['s', 'c', 'd', 't'], '流', 1500);
    cap('因為流量守恆', 'flow 不會跑掉');
  },
]);

scene('g8f-cutproof-ex', '證明前：把例子寫清楚', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('來證明：基本上只用 conservation');
    cap('我們來證明一下', '先把例子寫清楚');
  },
  async (tok, S) => {
    S.N.cut(CUT1);
    S.B.add('S = ' + setS(CUT1) + '，T = ' + setS(comp(CUT1)));
    cap('S 是 source 和 a, b, d', 'T 是 c 和 t');
  },
  async (tok, S) => {
    for (const k of FW1) { S.N.pe(k, FC.fwd, true); await wt(tok, 300); }
    S.f = lb('S → T：' + FW1.map((k) => 'f' + en(k)).join(' + ') + ' = ' + plus(F8, FW1), 'say', 0, -0.9);
    cap('從 S 流到 T 的', '(a,t)、(d,t)、(s,c)：2 + 4 + 3');
  },
  async (tok, S) => {
    bwdE(CUT1).forEach((k) => S.N.pe(k, FC.back, true));
    S.b = lb('T → S：' + bwdE(CUT1).map((k) => 'f' + en(k)).join(' + ') + ' = ' + sumF(F8, bwdE(CUT1)), 'say', 0, -1.6);
    cap('流回來的只有 (c, d)', '是 1');
  },
  async (tok, S) => {
    S.k = ok(netCut(F8, CUT1) === val(F8), 'val(f) = ' + val(F8) + ' = ' + sumF(F8, fwdE(CUT1)) + ' − ' + sumF(F8, bwdE(CUT1)) + ' ✓', 0, -2.3);
    cap('value 是 8', '剛好是 9 − 1');
  },
  async (tok, S) => {
    S.B.add('Σ 其實是 double summation（x 和 y 兩個變數）', 'say');
    cap('這個 Σ 其實是 double summation', '有 x、y 兩個 dummy variable');
  },
  async (tok, S) => {
    S.B.add('沒有邊的 (x, y)：f = 0，只要加真的有的邊', 'say');
    cap('沒有 edge 的 flow 是 0', '所以只要加真的有的邊');
  },
]);

const PR_X = -6.9;
scene('g8f-cutproof', '證明：val(f) = 流過去 − 流回來（只用 conservation）', [
  async (tok, S) => {
    S.N = mkNet({ s: 0.62, ox: 3.4, oy: 0.6 }); S.N.setF(F8); S.N.cut(CUT1); // picture lower right, the derivation above it, the worked example on the left
    S.L = board({ x: -0.6, max: 3 });
    S.L.add('要證：val(f) = Σ_{x∈S,y∈T} f(x,y) − Σ_{u∈T,v∈S} f(u,v)');
    S.n = lb('右邊用例子對照：S = ' + setS(CUT1) + '（示意對照）', 'idx', -3.2, 3.7);
    cap('要證的式子', '從定義開始');
  },
  async (tok, S) => {
    S.L.add('val(f) = Σ_{y∈V} f(s, y)　（source 的 outflow）');
    S.r = lb('例：' + outF(F8, 's'), 'ptr', -3.2, 3.0);
    cap('value 是 source 的 outflow', 's 到所有 y 的 flow 加起來');
  },
  async (tok, S) => {
    S.L.add('　　 − Σ_{u∈V} f(u, s)　（s 的 inflow = 0，多扣 0）');
    gone(S.r); S.r = lb('例：' + outF(F8, 's') + ' − ' + inF(F8, 's'), 'ptr', -3.2, 3.0);
    cap('s 的 inflow 是 0', '多扣一個 0 不影響');
  },
  async (tok, S) => {
    S.L.add('　　 + Σ_{x∈S−{s}} [ Σ_y f(x,y) − Σ_u f(u,x) ]');
    const xs = CUT1.filter((v) => v !== 's');
    S.c = xs.map((v, i) => ok(outF(F8, v) === inF(F8, v), v + '：' + outF(F8, v) + ' − ' + inF(F8, v) + ' = 0 ✓', -5.4 + i * 2.5, 1.5));
    cap('把 S 裡其他端點都加進來', '它們都守恆，t 不在 S 裡');
  },
  async (tok, S) => {
    S.L.add('　　每個括號 = outflow(x) − inflow(x) = 0（conservation）', 'say');
    cap('括號裡前面是 outflow', '後面是 inflow，相減是 0');
  },
  async (tok, S) => {
    gone(S.c);
    const o = CUT1.reduce((s, v) => s + outF(F8, v), 0), i = CUT1.reduce((s, v) => s + inF(F8, v), 0);
    S.L.add('合併：Σ_{x∈S} Σ_{y∈V} f(x,y) − Σ_{x∈S} Σ_{u∈V} f(u,x)');
    gone(S.r); S.r = lb('例：' + o + ' − ' + i, 'ptr', -3.2, 3.0); S.oi = [o, i];
    cap('s 那項和其他的合在一起', '變成對整個 S 加總');
  },
  async (tok, S) => {
    S.L.add('dummy variable 換名字：x → v，後項 = Σ_{v∈S} Σ_{u∈V} f(u,v)', 'say');
    cap('只是把 x 換成 v', '看起來跟後面一致');
  },
  async (tok, S) => {
    const ss = sumF(F8, inSE(CUT1)), st = sumF(F8, fwdE(CUT1)), ts = sumF(F8, bwdE(CUT1));
    S.L.add('V = S ∪ T 拆開：[S→S] + [S→T] − [S→S] − [T→S]');
    gone(S.r); S.r = lb('例：(' + ss + ' + ' + st + ') − (' + ss + ' + ' + ts + ')', 'ptr', -3.2, 3.0);
    S.chk = ok(ss + st === S.oi[0] && ss + ts === S.oi[1], ss + ' + ' + st + ' = ' + S.oi[0] + '、' + ss + ' + ' + ts + ' = ' + S.oi[1] + ' ✓', -3.2, 2.3);
    inSE(CUT1).forEach((k) => S.N.pe(k, FC.sat, true));
    cap('因為 S、T 是 V 的 partition', '每個 Σ 拆成兩個');
  },
  async (tok, S) => {
    S.L.add('兩個 [S→S] 一樣（只是名字不同）→ 消掉');
    gone(S.chk); inSE(CUT1).forEach((k) => S.N.pe(k, FC.dim));
    cap('S 到 S 的兩項一樣', '消掉');
  },
  async (tok, S) => {
    const st = sumF(F8, fwdE(CUT1)), ts = sumF(F8, bwdE(CUT1));
    S.L.add('剩下：Σ_{x∈S,y∈T} f(x,y) − Σ_{v∈S,u∈T} f(u,v)');
    S.N.paintCut(CUT1);
    gone(S.r); S.r = lb('例：' + st + ' − ' + ts, 'ptr', -3.2, 3.0);
    cap('最後剩下兩項', '從 S 流到 T 的、從 T 流到 S 的');
  },
  async (tok, S) => {
    S.L.add('double summation 先加 u 或先加 v 都一樣 → 改寫成要的形式', 'say');
    cap('double summation 的順序', '反過來寫是一樣的');
  },
  async (tok, S) => {
    gone(S.r); S.r = ok(netCut(F8, CUT1) === val(F8), '例：' + sumF(F8, fwdE(CUT1)) + ' − ' + sumF(F8, bwdE(CUT1)) + ' = ' + val(F8) + ' = val(f) ✓', -3.2, 3.0);
    S.L.add('證完：val(f) = 流過去 − 流回來', 'good');
    cap('這就是要證的', '證完了');
  },
  async (tok, S) => {
    S.L.add('只用了：多扣 0（s 的 inflow）、多加 0（conservation）、拆開、消掉', 'say');
    cap('其實只用了 conservation', 'notation 有點多而已');
  },
  async (tok, S) => {
    S.L.add('cut 把 s、t 拆到兩邊 → 淨流量 = flow 的量', 'good');
    cap('任何 cut 的淨流量', '都等於 flow 的 value');
  },
]);

// ════════ ju-qSc1_rwQ（第31C講：val = inflow(t)、cut capacity、val ≤ c(S,T)、max flow ≤ min cut、s-a-t 加 1） ════════
const CUTT = ['s', 'a', 'b', 'c', 'd'];
scene('g8f-sinkin', '取 T = {t}：value = sink 的 inflow', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('val(f) = 從 S 流到 T 的 − 從 T 流回 S 的（任何 cut）');
    cap('上次：value 等於', '任何 cut 流過去扣掉流回來');
  },
  async (tok, S) => {
    S.N.cut(CUTT);
    S.B.add('取 T = {t}，S = 其他全部');
    cap('隨便取一個 cut', 'T 只有 sink，其他都放 S');
  },
  async (tok, S) => {
    S.k = ok(CUTT.includes('s') && !CUTT.includes('t') && CUTT.length === 5, 'partition、s ∈ S、t ∈ T → 合法的 cut ✓', 0, -0.9);
    cap('這個 cut 沒問題', 'source 在 S、sink 在 T');
  },
  async (tok, S) => {
    gone(S.k);
    S.B.add('val(f) = Σ f(x, t) − Σ f(t, v)', 'say');
    cap('套剛剛的性質', '');
  },
  async (tok, S) => {
    S.B.add('T 只有 t：Σ over T 只剩 sink 一項', 'say');
    cap('因為 T 只有一個端點', '把 sink 帶進去就好');
  },
  async (tok, S) => {
    ins('t').forEach((k) => S.N.pe(k, FC.fwd, true));
    S.i = lb('前項 = inflow(t) = ' + plus(F8, ins('t')) + ' = ' + inF(F8, 't'), 'say', 0, -0.9);
    cap('前面那項：所有流到 sink 的', '就是 sink 的 inflow');
  },
  async (tok, S) => {
    S.o = lb('後項 = outflow(t)', 'say', 0, -1.6);
    cap('後面那項：從 sink 流出去的', '就是 sink 的 outflow');
  },
  async (tok, S) => {
    gone(S.o); S.o = ok(outs('t').length === 0, '後項 = outflow(t) = 0（t 沒有出去的邊）✓', 0, -1.6);
    cap('sink 的 outflow 是 0', '它的邊全部 directed toward sink');
  },
  async (tok, S) => {
    S.k = ok(val(F8) === inF(F8, 't'), 'val(f) = outflow(s) = ' + val(F8) + ' = inflow(t) = ' + inF(F8, 't') + ' ✓', 0, -2.3);
    cap('value 定義成 source 的 outflow', '也會等於 sink 的 inflow');
  },
  async (tok, S) => {
    S.N.uncut(); S.N.reset();
    await pkt(tok, S.N, ['s', 'c', 'd', 't'], '流', 1600); // the lower path: the packet stays clear of the board
    cap('中間每個點都守恆', '所以全部最後都流到 sink');
  },
]);

const CUTA = ['s', 'a', 'b'], CUTB = ['s', 'b'];
scene('g8f-cutcap', 'cut 的 capacity', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet();
    S.B.add('flow 和 cut 還有什麼關係？先定義 cut 的 capacity');
    cap('再來一個 flow 跟 cut 的關係', '先定義 cut 的 capacity');
  },
  async (tok, S) => {
    S.B.add('每條邊有 capacity；整個 cut 也定義一個 capacity', 'say');
    cap('原來 capacity 是每條邊的', '現在整個 cut 也有一個');
  },
  async (tok, S) => {
    S.B.add('c(S, T) = Σ c(x, y)，x ∈ S、y ∈ T（從 S 到 T 的邊）');
    cap('把所有從 S 到 T 的邊', '的 capacity 加起來');
  },
  async (tok, S) => {
    S.B.add('反方向（T 到 S）的邊不加！', 'bad');
    cap('反過來的那部分不加', '只加從 S 到 T 的');
  },
  async (tok, S) => {
    S.N.cut(CUTA);
    S.e = lb('例：S = ' + setS(CUTA) + '，T = ' + setS(comp(CUTA)), 'ptr', 0, -0.9);
    cap('例：S 是 s, a, b', 'T 是 c, d, t');
  },
  async (tok, S) => {
    S.sc = [...fwdE(CUTA), ...bwdE(CUTA)].map((k) => S.N.mtag(k, '✂', 'ptr', 0));
    cap('SAB 這樣切下來', '');
  },
  async (tok, S) => {
    for (const k of fwdE(CUTA)) { S.N.pe(k, FC.fwd, true); await wt(tok, 300); }
    cap('被切到的是這 ' + fwdE(CUTA).length + ' 條邊', '都是從 S 到 T');
  },
  async (tok, S) => {
    const ks = ['sc', 'ad', 'bd', 'at'].filter((k) => fwdE(CUTA).includes(k));
    S.k1 = ok(ks.length === fwdE(CUTA).length && bwdE(CUTA).length === 0, 'c(S,T) = ' + plusC(ks) + ' = ' + capCut(CUTA) + ' ✓', 0, -1.6);
    cap('3 + 6 + 2 + 3', '這個 cut 的 capacity 是 14');
  },
  async (tok, S) => {
    gone(S.sc, S.e, S.k1); S.N.reset(); S.N.cut(CUTB);
    S.e = lb('換一個：S = ' + setS(CUTB) + '，T = ' + setS(comp(CUTB)), 'ptr', 0, -0.9);
    cap('再換一個 cut', 'S 只有 source 和 b');
  },
  async (tok, S) => {
    S.sc = [];
    for (const k of fwdE(CUTB)) { S.N.pe(k, FC.fwd, true); S.sc.push(S.N.mtag(k, '✂', 'ptr', 0)); await wt(tok, 300); }
    cap('切到的只有 (s,a)、(b,d)、(s,c)', '');
  },
  async (tok, S) => {
    S.k2 = ok(true, 'c(S,T) = ' + plusC(fwdE(CUTB)) + ' = ' + capCut(CUTB) + ' ✓', 0, -1.6);
    cap('5 + 2 + 3 = 10', '這個 cut 比較小');
  },
  async (tok, S) => {
    S.k3 = lb('cut capacity 不一定一樣：' + capCut(CUTA) + ' 和 ' + capCut(CUTB), 'say', 0, -2.3);
    cap('每個 cut 的 capacity', '不見得一樣，有大有小');
  },
  async (tok, S) => {
    const C = ['s', 'a', 'b', 'd'];
    gone(S.sc, S.k2, S.k3, S.e); S.N.cut(C); S.N.paintCut(C);
    S.e = lb('示意：S = ' + setS(C) + ' 時，紫色 ' + bwdE(C).map(en).join('') + ' 是 T → S，不加', 'say', 0, -0.9);
    S.k = ok(capCut(C) === sumC(fwdE(C)), 'c(S,T) = ' + plusC(fwdE(C)) + ' = ' + capCut(C) + '（c(c,d) = 7 不算）✓', 0, -1.6);
    cap('切到方向反過來的邊', '那個不加');
  },
]);

scene('g8f-leq', '性質：val(f) ≤ c(S, T)', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('一個很重要的性質（後面推到定理就靠它）');
    cap('定義了 cut capacity 以後', '又有一個重要的性質');
  },
  async (tok, S) => {
    S.B.add('任何 flow f、任何 cut (S, T)：val(f) ≤ c(S, T)');
    cap('flow 的 value', '一定 ≤ cut 的 capacity');
  },
  async (tok, S) => {
    S.N.cut(CUT1); S.N.paintCut(CUT1);
    S.B.add('val(f) = Σ f(S→T) − Σ f(T→S)', 'say');
    S.e = lb('示意對照：S = ' + setS(CUT1) + '：' + sumF(F8, fwdE(CUT1)) + ' − ' + sumF(F8, bwdE(CUT1)) + ' = ' + netCut(F8, CUT1), 'ptr', 0, -0.9);
    cap('用前面的性質', '流過去的扣掉流回來的');
  },
  async (tok, S) => {
    S.B.add('每個 f ≥ 0 → 流回來的 Σ f(T→S) ≥ 0', 'say');
    cap('flow 一定 ≥ 0', '所以後面那塊整個 ≥ 0');
  },
  async (tok, S) => {
    S.B.add('丟掉它 → val(f) ≤ Σ f(S→T)（upper bound）');
    S.a = ok(val(F8) <= sumF(F8, fwdE(CUT1)), val(F8) + ' ≤ ' + sumF(F8, fwdE(CUT1)) + ' ✓', -3.2, -1.6);
    cap('減掉一個 ≥ 0 的數', '丟掉就變 upper bound');
  },
  async (tok, S) => {
    S.B.add('feasibility：每條 f(x, y) ≤ c(x, y)', 'say');
    S.t = fwdE(CUT1).map((k) => S.N.mtag(k, F8[k] + '≤' + CAPS[k] + ' ✓', F8[k] <= CAPS[k] ? 'good' : 'bad'));
    cap('再用 feasibility', '流量 ≤ 容量，每條邊都成立');
  },
  async (tok, S) => {
    S.B.add('Σ f(S→T) ≤ Σ c(S→T) = c(S, T)');
    S.b = ok(sumF(F8, fwdE(CUT1)) <= capCut(CUT1), sumF(F8, fwdE(CUT1)) + ' ≤ ' + capCut(CUT1) + ' = c(S,T) ✓', 3.2, -1.6);
    cap('全部加起來也 ≤', '就是這個 cut 的 capacity');
  },
  async (tok, S) => {
    gone(S.t);
    S.k = ok(ALLS.every((C) => val(F8) <= capCut(C)), '證完：val(f) ≤ c(S,T)；16 個 cut 都 ≥ ' + val(F8) + ' ✓', 0, -2.3);
    cap('證完了：conservation、丟掉 ≥ 0', '再用 feasibility');
  },
]);

scene('g8f-maxmin', 'max flow ≤ min cut', [
  async (tok, S) => {
    S.B = board();
    S.B.add('任何 flow 的 value ≤ 任何 cut 的 capacity');
    S.ax = []; for (let x = 0; x <= 16; x += 2) S.ax.push(lb(String(x), 'idx', -6 + x * 0.75, 2.2));
    S.line = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: FC.e })); S.line.position.set(0, 2.7, 0); lab.world.add(S.line);
    S.X = (v) => -6 + v * 0.75;
    S.fl = lb('flow ' + val(F8), 'pkt', S.X(val(F8)), 3.5);
    cap('任何 flow 都 ≤', '任何 cut 的 capacity');
  },
  async (tok, S) => {
    S.B.add('取 value 最大的 flow、capacity 最小的 cut：還是 ≤', 'say');
    cap('最大的 flow', '也 ≤ 最小的 cut');
  },
  async (tok, S) => {
    S.B.add('max flow ≤ min cut');
    cap('max flow', '≤ min cut');
  },
  async (tok, S) => {
    S.B.add('找到一個 flow 剛好 = 某個 cut capacity → 它就是 max flow', 'good');
    cap('如果 flow 剛好等於某個 cut capacity', '那就一定是 max flow');
  },
  async (tok, S) => {
    S.B.add('後面的定理：其實是等號（Max-Flow Min-Cut Theorem）', 'say');
    cap('後面有定理說', 'max flow 其實等於 min cut');
  },
  async (tok, S) => {
    S.c1 = lb('cut ' + capCut(CUTA), 'ptr', S.X(capCut(CUTA)), 1.5);
    S.c2 = lb('cut ' + capCut(CUTB), 'ptr', S.X(capCut(CUTB)), 1.5);
    S.k = ok(val(F8) <= capCut(CUTB) && val(F8) <= capCut(CUTA), '這個 flow：' + val(F8) + '；算過的 cut：' + capCut(CUTA) + '、' + capCut(CUTB) + ' ✓', 0, 0.4);
    cap('這個 flow 的 value 是 8', 'cut 算過 14 和 10');
  },
  async (tok, S) => {
    const from = S.X(val(F8)), to = S.X(capCut(CUTB));
    await anim(tok, 1200, (u) => { S.fl.position.x = from + (to - from) * u; });
    S.fl.element.textContent = 'flow ' + capCut(CUTB) + '?';
    S.B.add('如果把 flow 增大到 10 → 一定最大（10 也一定是最小的 cut）');
    cap('如果 flow 變成 10', '那 10 就一定最大');
  },
]);

scene('g8f-sat', '把 flow 變大：沿 s → a → t 加 1', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F8);
    S.B.add('問題：given network 和 flow，怎麼把 flow 值變大？');
    cap('現在的問題', '怎麼把 flow 值變大');
  },
  async (tok, S) => {
    S.B.add('像 matching：已有 matching，再找方法 augment 它', 'say');
    cap('跟 matching problem 類似', '把 matching augment 變大');
  },
  async (tok, S) => {
    S.B.add('只要保持 feasibility 和 conservation 就 OK', 'say');
    cap('看這個 network 和 flow', '有沒有辦法增大？');
  },
  async (tok, S) => {
    S.N.pe('sa', FC.hot, true); S.N.pe('at', FC.hot, true);
    S.B.add('一條 directed path：s → a → t');
    cap('有一條 directed path', 's a t，照箭頭走');
  },
  async (tok, S) => {
    S.x1 = S.N.mtag('sa', 'f ' + F8.sa + ' < c ' + CAPS.sa); S.x2 = S.N.mtag('at', 'f ' + F8.at + ' < c ' + CAPS.at);
    cap('(s,a)：flow 3、capacity 5', '(a,t)：flow 2、capacity 3');
  },
  async (tok, S) => {
    S.B.add('兩條一起加同樣的量 → a 還是守恆', 'say');
    await pkt(tok, S.N, ['s', 'a', 't'], '+?', 1300);
    cap('這邊加、那邊加一樣多', '流量守恆就還成立');
  },
  async (tok, S) => {
    S.B.add('但不能超過：(s,a) ≤ ' + CAPS.sa + '、(a,t) ≤ ' + CAPS.at, 'say');
    cap('要滿足 feasibility', '不能超過 5，不能超過 3');
  },
  async (tok, S) => {
    gone(S.x1, S.x2);
    S.x1 = S.N.mtag('sa', '還能 +' + (CAPS.sa - F8.sa)); S.x2 = S.N.mtag('at', '還能 +' + (CAPS.at - F8.at));
    cap('這邊最多加 2、那邊最多加 1', '所以只能加 1');
  },
  async (tok, S) => {
    S.B.add('(s,a)、(a,t) 的 flow 都沒到 capacity → 兩條都能增加');
    cap('寫下來：path s a t', '兩條邊都沒滿');
  },
  async (tok, S) => {
    const p = [['s', 'sa', 'f'], ['a', 'at', 'f']], D = deltaOf(F8, p);
    S.D = D;
    S.m = ok(D === 1, 'min(' + (CAPS.sa - F8.sa) + ', ' + (CAPS.at - F8.at) + ') = ' + D + ' ✓', 0, -0.9);
    cap('5 − 3 = 2，3 − 2 = 1', '取最小值：加 1');
  },
  async (tok, S) => {
    gone(S.x1, S.x2);
    await flowIn(tok, S.N, 'sa', F8.sa + S.D, 500); await flowIn(tok, S.N, 'at', F8.at + S.D, 500);
    S.N.pe('sa', FC.hot, true); S.N.pe('at', FC.hot, true);
    cap('兩條邊的 flow 都加 1', '');
  },
  async (tok, S) => {
    S.B.add('新的 flow F1：f(s,a) = ' + F9.sa + '、f(a,t) = ' + F9.at);
    cap('新的 flow 叫 F1', '(s,a) 變 4，(a,t) 變 3');
  },
  async (tok, S) => {
    S.k = ok(feasible(F9) && conserv(F9), 'feasibility ✓（取了最小值）　conservation ✓（a：' + inF(F9, 'a') + ' = ' + plus(F9, outs('a')) + '）', 0, -1.6);
    cap('feasibility：因為取最小值', 'conservation：a 進出都加 1');
  },
  async (tok, S) => {
    S.N.reset();
    S.v = ok(val(F9) === inF(F9, 't') && val(F9) === val(F8) + 1, 'val = ' + plus(F9, outs('s')) + ' = ' + val(F9) + '；inflow(t) = ' + plus(F9, ins('t')) + ' = ' + inF(F9, 't') + ' ✓', 0, -2.3);
    cap('source 流出多 1，sink 流進多 1', 'value：8 + 1 = 9');
  },
]);

scene('g8f-sadct-intro', '再找一條：s-a-d-c-t（有反方向的邊）', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F9);
    S.B.add('新的 flow F1，value = ' + val(F9) + '：還能再增加嗎？');
    cap('flow 現在是 9', '還有沒有辦法再增加？');
  },
  async (tok, S) => {
    S.B.add('這次的 path 會用到反方向的 edge', 'say');
    cap('再找一條 path', '這次牽涉到反方向的 edge');
  },
  async (tok, S) => {
    for (const [, k] of SADCT) { S.N.pe(k, k === 'cd' ? FC.back : FC.hot, true); await wt(tok, 300); }
    S.B.add('path「s a d c t」');
    cap('找這條：s a d c t', '');
  },
  async (tok, S) => {
    S.r = S.N.mtag('cd', '逆向！', 'bad');
    S.B.add('d → c 跟箭頭 (c, d) 反方向：它是 underlying undirected graph 的 path', 'say');
    cap('d 到 c 是逆著走的', '不是原圖的 directed path');
  },
  async (tok, S) => {
    S.R = pathRow(-1.4); S.R.show(F9);
    cap('把這條 path 單獨畫出來', '比較清楚');
  },
  async (tok, S) => {
    S.B.add('network 上的 path = 對應的 undirected graph 上的 path');
    cap('後面方法要找的 path', '是對應無向圖上的 path');
  },
  async (tok, S) => {
    S.B.add('這條 path 上能不能把 flow 增加？', 'good');
    cap('看看這條 path', '有沒有辦法把 flow 增加');
  },
]);

// ════════ YnPS5TFJiFE（第31D講：s-a-d-c-t 加 1 → F2、cut {s,b}、f-augmenting path、Δ_P） ════════
scene('g8f-sadct', 's-a-d-c-t：最多可以加多少？', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet({ s: 0.62, ox: 0, oy: 2.2 }); S.N.setF(F9);
    SADCT.forEach(([, k]) => S.N.pe(k, k === 'cd' ? FC.back : FC.hot, true));
    S.B.add('path s-a-d-c-t（underlying undirected graph 的 path）');
    cap('上次找到的 path：s a d c t', '');
  },
  async (tok, S) => {
    S.R = pathRow(-1.2); S.N.labs('none'); // the row below carries the numbers; the small picture only shows the path
    S.B.add('單獨畫出來：capacity ' + SADCT.map(([, k]) => CAPS[k]).join(' ') , 'say');
    cap('capacity：5 6 7 5', '');
  },
  async (tok, S) => {
    S.R.show(F9);
    S.B.add('現在的 flow：' + SADCT.map(([, k]) => F9[k]).join(' ') + '；(c, d) 是反的', 'say');
    cap('flow：4 1 1 2', '(c,d) 這條方向是反的');
  },
  async (tok, S) => {
    S.m = SADCT.map(([, k, d]) => S.R.mark(k, d === 'f' ? 'forward' : 'backward', d === 'f' ? 'ptr' : 'bad'));
    cap('一般的情況', 'path 上有順向的、有逆向的');
  },
  async (tok, S) => {
    S.B.add('沿著 path 這個方向，每條邊都多送同樣的量 Δ');
    S.pk = lb('+Δ', 'pkt', -5, -0.4);
    await travel(tok, S.pk, V3(-5, -0.4, 0.3), V3(5, -0.4, 0.3), 1600);
    cap('四條邊都增加同樣的量', '不超過 capacity，就還是 flow');
  },
  async (tok, S) => {
    remove(S.pk);
    S.B.add('source 多出 Δ、sink 多進 Δ → value 增加', 'say');
    cap('source 增加多少', 'sink 也增加同樣的量');
  },
  async (tok, S) => {
    gone(S.m); S.m = [];
    for (const [, k, d] of SADCT.filter((e) => e[2] === 'f')) { S.m.push(S.R.mark(k, CAPS[k] + '−' + F9[k] + ' = ' + (CAPS[k] - F9[k]), 'good')); await wt(tok, 350); }
    cap('順向：5−4 = 1、6−1 = 5、5−2 = 3', 'capacity 減掉現在的 flow');
  },
  async (tok, S) => {
    S.bk = S.R.mark('cd', '反向原本流 ' + F9.cd, 'bad');
    cap('逆向的怎麼辦？', '原本 c → d 流 1，往這邊加等於把它抵消');
  },
  async (tok, S) => {
    gone(S.bk); S.bk = S.R.mark('cd', '最多 ' + F9.cd + '（減到 0）', 'good');
    cap('最多只能加 1', '再多就變負的，不合 flow 的定義');
  },
  async (tok, S) => {
    const D = deltaOf(F9, SADCT);
    S.k = ok(D === 1, 'Δ = min(' + SADCT.map((e) => dOf(F9, e)).join(', ') + ') = ' + D + ' ✓', 0, -2.6);
    cap('全部取最小值', 'min(5−4, 6−1, 1, 5−2) = 1');
  },
  async (tok, S) => {
    S.B.add('沿這個方向加 1：feasibility、conservation 都還成立', 'good');
    cap('這條 path 上加 1', 'feasibility 和 conservation 都還成立');
  },
]);

scene('g8f-f2', '新的 flow F2：value = 10', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F9);
    SADCT.forEach(([, k]) => S.N.pe(k, k === 'cd' ? FC.back : FC.hot, true));
    S.B.add('四條邊沿 s-a-d-c-t 的方向 +1（不違反兩個 rule）');
    cap('這四條邊照這個方向 +1', '不違反 feasibility 和 conservation');
  },
  async (tok, S) => {
    S.N.f('sa', F9.sa + 1); await pop(tok, S.N.v.a, 0.2);
    S.x = [S.N.mtag('sa', F9.sa + '+1')];
    cap('(s,a)：原來 4，加 1', '');
  },
  async (tok, S) => {
    S.N.f('ad', F9.ad + 1); await pop(tok, S.N.v.d, 0.2);
    S.x.push(S.N.mtag('ad', F9.ad + '+1'));
    cap('(a,d)：原來 1，加 1', '');
  },
  async (tok, S) => {
    S.N.f('cd', F9.cd - 1); await pop(tok, S.N.v.c, 0.2);
    S.x.push(S.N.mtag('cd', F9.cd + '−1', 'bad'));
    cap('(c,d) 原來這個方向是 1', '反方向加 1 = 這邊扣 1');
  },
  async (tok, S) => {
    S.N.f('ct', F9.ct + 1); await pop(tok, S.N.v.t, 0.2);
    S.x.push(S.N.mtag('ct', F9.ct + '+1'));
    cap('(c,t)：原來 2，加 1', '');
  },
  async (tok, S) => {
    gone(S.x); S.N.reset();
    const same = KEYS.every((k) => S.N.F[k] === F10[k]);
    S.B.add('新的 flow 叫 F2：(s,a) ' + F10.sa + '、(a,d) ' + F10.ad + '、(c,d) ' + F10.cd + '、(c,t) ' + F10.ct);
    S.k0 = ok(same, '有些加、有些減，重寫一次 = F2 ✓', 0, -0.9);
    cap('4+1、1+1、1−1、2+1', '變成 5、2、0、3');
  },
  async (tok, S) => {
    gone(S.k0);
    S.k1 = ok(feasible(F10) && conserv(F10), 'feasibility ✓　conservation ✓（a ' + inF(F10, 'a') + '=' + outF(F10, 'a') + '、c ' + inF(F10, 'c') + '=' + outF(F10, 'c') + '、d ' + inF(F10, 'd') + '=' + outF(F10, 'd') + '）', 0, -0.9);
    cap('feasibility 還是滿足', 'path 上加的量一樣，所以守恆');
  },
  async (tok, S) => {
    outs('s').forEach((k) => S.N.pe(k, FC.fwd, true));
    S.v1 = lb('source 的 outflow = ' + plus(F10, outs('s')) + ' = ' + val(F10), 'say', -3.2, -1.6);
    cap('value 多 1', 'source 的 outflow：5 + 2 + 3 = 10');
  },
  async (tok, S) => {
    ins('t').forEach((k) => S.N.pe(k, FC.blue, true));
    S.v2 = ok(inF(F10, 't') === val(F10), 'sink 的 inflow = ' + plus(F10, ins('t')) + ' = ' + inF(F10, 't') + ' ✓', 3.2, -1.6);
    cap('sink 的 inflow', '3 + 4 + 3 也是 10');
  },
  async (tok, S) => {
    S.N.reset();
    S.k = ok(val(F8) === 8 && val(F9) === 9 && val(F10) === 10, 'value：' + val(F8) + '（f）→ ' + val(F9) + '（s-a-t）→ ' + val(F10) + '（s-a-d-c-t）✓', 0, -2.3);
    cap('一開始 8', '沿 s a t 變 9，沿 s a d c t 變 10');
  },
]);

scene('g8f-f2max', 'cut {s, b} = 10 ⇒ F2 是 maximum flow', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10);
    S.B.add('F2 的 value = ' + val(F10) + '；記得前面算過一個 cut');
    cap('新的 flow F2，value 是 10', '前面算過一個 cut');
  },
  async (tok, S) => {
    S.N.cut(CUTB);
    S.B.add('S = ' + setS(CUTB) + '，T = ' + setS(comp(CUTB)));
    cap('S 是 source 和 b', 'T 是 a, c, d, t');
  },
  async (tok, S) => {
    S.N.paintCut(CUTB);
    S.k = ok(true, 'c(S,T) = ' + plusC(fwdE(CUTB)) + ' = ' + capCut(CUTB), 0, -0.9);
    cap('從這邊切下來', 'capacity：5 + 2 + 3 = 10');
  },
  async (tok, S) => {
    S.B.add('任何 flow 的 value ≤ 任何 cut 的 capacity', 'say');
    cap('任何 flow 的 value', '都 ≤ 任何 cut 的 capacity');
  },
  async (tok, S) => {
    S.k2 = ok(val(F10) === capCut(CUTB), 'val(F2) = ' + val(F10) + ' = c(S,T) = ' + capCut(CUTB) + ' → 已經頂到了 ✓', 0, -1.6);
    cap('現在剛好相等', '所以一定是最大的');
  },
  async (tok, S) => {
    S.k3 = ok(feasible(F10) && conserv(F10) && val(F10) === MINCUT, 'F2 是 maximum flow（16 個 cut 最小就是 ' + MINCUT + '）✓', 0, -2.3);
    cap('F2 是 maximum flow', 'feasibility、conservation、value 最大');
  },
]);

scene('g8f-method', '一般做法：從 0 開始一步一步加大', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet();
    S.B.add('given 一個 network');
    cap('這個例子告訴我們', 'given 一個 network 怎麼做');
  },
  async (tok, S) => {
    S.N.setF(ZERO);
    S.B.add('一開始：flow 全部是 0');
    cap('一開始 flow 全部是 0', '再一步一步增大');
  },
  async (tok, S) => {
    S.B.add('跟 maximum matching 類似（一開始空的）', 'say');
    cap('跟 maximum matching 類似', '');
  },
  async (tok, S) => {
    S.k = ok(feasible(ZERO) && conserv(ZERO), '全 0 的 flow：feasibility ✓ conservation ✓（value = ' + val(ZERO) + '）', 0, -0.9);
    cap('全部是 0', '一定滿足兩個條件');
  },
  async (tok, S) => {
    S.B.add('找 s-a-d-c-t 這種 path → 增大 → 變成新的 flow');
    S.loop = lb('找 path → 加 Δ → 新的 flow → 再找…', 'ptr alt', 0, -1.6);
    cap('找剛才那種路徑', '增大以後就是新的 flow');
  },
  async (tok, S) => {
    S.B.add('一直做到沒辦法增大 → 就是 maximum flow', 'good');
    cap('一直做到沒辦法增大為止', '就找到 maximum flow');
  },
  async (tok, S) => {
    S.B.add('關鍵：到底要找怎麼樣的 path？（下面寫一般條件）', 'say');
    cap('到底找怎麼樣的路徑？', '這是 algorithm 和定理的關鍵');
  },
]);

scene('g8f-augdef', 'f-augmenting path 的定義', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F9);
    S.B.add('In general：類似 maximum matching 的 augmenting alternating path');
    cap('一般的情況', '類似 matching 的 augmenting path');
  },
  async (tok, S) => {
    S.B.add('這邊要找的叫 f-augmenting path（能把 flow value 增大）');
    cap('這種 path 叫 f-augmenting path', 'augment 就是增大');
  },
  async (tok, S) => {
    SADCT.forEach(([, k]) => S.N.pe(k, FC.hot, true));
    S.B.add('P：從 source 到 sink 的 path（undirected graph 上的 path）', 'say');
    cap('從 source 到 sink 的 path P', 'network 的 path = 無向圖上的 path');
  },
  async (tok, S) => {
    S.m = SADCT.map(([, k, d]) => S.N.mtag(k, d === 'f' ? 'forward' : 'backward', d === 'f' ? 'ptr' : 'bad'));
    SADCT.forEach(([, k, d]) => S.N.pe(k, d === 'f' ? FC.fwd : FC.back, true));
    S.B.add('P 上的邊有兩種：順向 forward、逆向 backward', 'say');
    cap('P 上的 edge 有兩種', '順向的和逆向的');
  },
  async (tok, S) => {
    S.B.add('forward edge e：f(e) < c(e)');
    cap('forward edge', 'flow 要小於 capacity，才有增加空間');
  },
  async (tok, S) => {
    const full = KEYS.filter((k) => F9[k] === CAPS[k]);
    S.f = full.map((k) => S.N.mtag(k, '滿', 'bad', 0.42));
    S.x = lb('已經 f = c 的邊（' + full.map(en).join('') + '）沒有空間了', 'say', 0, -0.9);
    cap('如果已經 flow = capacity', '就沒有增加空間了');
  },
  async (tok, S) => {
    gone(S.f, S.x);
    S.B.add('backward edge e：f(e) > 0（反向加 = 把它抵消）');
    cap('backward edge', 'flow 要大於 0；是 0 就不能再抵消');
  },
  async (tok, S) => {
    const okP = SADCT.every(([, k, d]) => (d === 'f' ? F9[k] < CAPS[k] : F9[k] > 0));
    S.k = ok(okP, 's-a-d-c-t 在 F1 上：' + SADCT.map(([, k, d]) => (d === 'f' ? F9[k] + '<' + CAPS[k] : F9[k] + '>0')).join('、') + ' → f-augmenting ✓', 0, -0.9);
    cap('每條 edge 都滿足條件', '這樣的 path 叫 f-augmenting path');
  },
  async (tok, S) => {
    S.B.add('algorithm 就是在找 s 到 t 的 f-augmenting path', 'good');
    cap('後面的 algorithm', '主要就是在找這種 path');
  },
]);

scene('g8f-delta', '最多能加多少：Δ_P = min Δ_e', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet({ s: 0.62, ox: 0, oy: 2.2 }); S.N.setF(F9); S.N.labs('none'); // the row below carries the numbers
    SADCT.forEach(([, k, d]) => S.N.pe(k, d === 'f' ? FC.fwd : FC.back, true));
    S.R = pathRow(-1.2); S.R.show(F9);
    S.B.add('找到 f-augmenting path P：flow 最多可以增加多少？');
    cap('找到了 f-augmenting path', 'flow 最多可以加多少？');
  },
  async (tok, S) => {
    S.B.add('forward edge 上增加、backward edge 上減少（抵消）', 'say');
    cap('forward edge 真的增加', 'backward edge 是把反向的減少');
  },
  async (tok, S) => {
    S.B.add('Δ_P = min{ Δ_e : e 在 P 上 }');
    cap('可以加的量 Δ_P', '是 path 上每條邊 Δ_e 的最小值');
  },
  async (tok, S) => {
    S.B.add('forward：Δ_e = c(e) − f(e)', 'say');
    S.m = SADCT.filter((e) => e[2] === 'f').map(([, k]) => S.R.mark(k, CAPS[k] + '−' + F9[k] + ' = ' + (CAPS[k] - F9[k]), 'good'));
    cap('forward edge', 'capacity 減掉 flow');
  },
  async (tok, S) => {
    S.B.add('backward：Δ_e = f(e)（最多減到 0，不能變負）', 'say');
    S.m.push(S.R.mark('cd', 'f = ' + F9.cd, 'good'));
    cap('backward edge', '就是現在的 flow，最多扣到 0');
  },
  async (tok, S) => {
    const D = deltaOf(F9, SADCT);
    S.k = ok(D === 1, 'Δ_P = min(' + SADCT.map((e) => dOf(F9, e)).join(', ') + ') = ' + D + ' ✓', 0, -2.4);
    cap('前面那個例子', 'min(5−4, 6−1, 1, 5−2) = 1');
  },
  async (tok, S) => {
    S.B.add('given network + flow：找 f-augmenting path，加 Δ_P', 'good');
    cap('主要做的事', '找 f-augmenting path，再加 Δ_P');
  },
  async (tok, S) => {
    S.B.add('變大後又是同樣的問題：再找、再加…直到找不到', 'say');
    cap('下一次又是同樣的問題', '一直找、一直加，直到找不到');
  },
  async (tok, S) => {
    S.B.add('找不到時就是最大：會剛好等於某個 cut 的 capacity', 'good');
    cap('找不到這種 path', 'flow 就最大了：等於某個 cut capacity');
  },
  async (tok, S) => {
    S.B.add('下次：Max-Flow Min-Cut Theorem（不只 ≤，而是 =）', 'say');
    cap('下次證明這個有名的定理', 'max flow 其實等於 min cut');
  },
]);

// ════════ ZCOlf1NFPA4（第32A講：Max-Flow Min-Cut Theorem 與證明前半） ════════
scene('g8f-mfmc', 'Max-Flow Min-Cut Theorem', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet({ s: 0.85, ox: 0, oy: 0.2 }); S.N.setF(F10);
    S.B.add('之前：任何 flow value ≤ 任何 cut 的 capacity');
    cap('前面教到', 'flow value ≤ any cut 的 capacity');
  },
  async (tok, S) => {
    S.B.add('有 f-augmenting path（forward f < c、backward f > 0）→ 可以增大', 'say');
    cap('找得到 f-augmenting path', '就可以把 flow 增大');
  },
  async (tok, S) => {
    S.B.add('The Max-Flow Min-Cut Theorem');
    cap('這個很有名的定理', 'Max-Flow Min-Cut Theorem');
  },
  async (tok, S) => {
    S.B.add('max value of flow（s 到 t）= min capacity of a cut separating s and t');
    const caps = ALLS.map(capCut);
    S.k = ok(val(EKEND.F) === MINCUT, '示意（這個 network）：max flow = ' + val(EKEND.F) + '；16 個 cut 最小 = ' + MINCUT + ' ✓', 0, -0.9);
    S.c = lb('16 個 cut 的 capacity：' + [...new Set(caps)].sort((x, y) => x - y).join(' ') , 'idx', 0, -1.6);
    cap('flow 的最大值', '剛好等於 cut capacity 的最小值');
  },
  async (tok, S) => {
    S.B.add('之前只知道 ≤；定理說：剛好相等', 'good');
    cap('之前講 max flow ≤ min cut', '現在說它們相等');
  },
  async (tok, S) => {
    S.B.add('看怎麼證；證完 algorithm 就出來了', 'say');
    cap('看怎麼證明', '證完 algorithm 就出來');
  },
]);

scene('g8f-proofS', '證明：從 maximum flow 定義集合 S', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10);
    S.B.add('假設 F 是一個 maximum flow');
    cap('先假設有一個 maximum flow F', '');
  },
  async (tok, S) => {
    S.B.add('要做的：找一個 cut (S, T)，capacity 剛好 = val(F)');
    cap('我要找出一個 cut', 'capacity 剛好等於 F 的 value');
  },
  async (tok, S) => {
    S.B.add('S = { v : 有一條從 s 到 v 的 incomplete f-augmenting path }');
    S.N.vc('s', FC.S);
    cap('S 這個集合', '可以從 source 走 incomplete f-augmenting path 到的端點');
  },
  async (tok, S) => {
    S.B.add('什麼叫 incomplete f-augmenting path？', 'say');
    cap('什麼叫 incomplete？', '');
  },
  async (tok, S) => {
    S.B.add('一條 path（undirected 意義），每條邊都滿足 f-augmenting 條件', 'say');
    S.r = lb('forward：f < c　　backward：f > 0', 'ptr', 0, -0.9);
    cap('path 上的邊', 'forward f < c，backward f > 0');
  },
  async (tok, S) => {
    S.N.pe('sb', FC.ok, true); S.N.vc('b', '#f2b8d2');
    S.x = S.N.mtag('sb', 'f ' + F10.sb + ' < c ' + CAPS.sb, 'good');
    S.e = lb('示意：s → b 就是一條結尾在 b 的 incomplete path（終點不必是 t）', 'say', 0, -1.6);
    cap('差別：最後的端點不見得是 sink', '只要走到 v 就好');
  },
  async (tok, S) => {
    S.B.add('這些 v 放進 S；剩下的放 T = V − S（S 的 complement）');
    cap('這些端點放到 S', '剩下的就是 T');
  },
]);

scene('g8f-findS', '例子：在 max flow F2 上找 S', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10);
    S.B.add('例子：上次最後算到的 max flow（F2）');
    cap('用前面的例子說明', 'S 怎麼找');
  },
  async (tok, S) => {
    S.k1 = ok(feasible(F10), 'feasibility ✓（每個紅的 ≤ 黃的）', -3.2, -0.9);
    cap('確定一下：每個紅的 ≤ 黃的', 'feasibility');
  },
  async (tok, S) => {
    S.k2 = ok(conserv(F10), 'conservation ✓', 3.2, -0.9);
    cap('除了 source 和 sink', 'inflow 都等於 outflow');
  },
  async (tok, S) => {
    S.N.vc('s', FC.S); S.N.halo('s', FC.S);
    S.B.add('從 s 出發：哪些端點有 incomplete f-augmenting path 到得了？');
    cap('從 source 出發', '看哪些端點到得了');
  },
  async (tok, S) => {
    S.N.pe('sa', FC.hot, true); S.x1 = S.N.mtag('sa', F10.sa + ' = ' + CAPS.sa + ' ✘', 'bad');
    cap('走這邊不行', '(s,a) 的 flow 5 剛好等於 5');
  },
  async (tok, S) => {
    S.N.pe('sc', FC.hot, true); S.x2 = S.N.mtag('sc', F10.sc + ' = ' + CAPS.sc + ' ✘', 'bad');
    cap('(s,c) 也不行', '3 等於 3');
  },
  async (tok, S) => {
    S.N.pe('sb', FC.ok, true); S.x3 = S.N.mtag('sb', F10.sb + ' < ' + CAPS.sb + ' ✓', 'good');
    S.N.vc('b', FC.S); S.N.halo('b', FC.S); await pop(tok, S.N.v.b);
    cap('只能走這邊：s 到 b', '2 < 4，所以 b 可以到');
  },
  async (tok, S) => {
    S.N.vc('a', FC.dim); S.N.vc('c', FC.dim);
    cap('a 和 c 下不去', '第一條邊就不滿足');
  },
  async (tok, S) => {
    S.N.pe('bd', FC.hot, true); S.x4 = S.N.mtag('bd', F10.bd + ' = ' + CAPS.bd + ' ✘', 'bad');
    const back = KEYS.filter((k) => (k[1] === 's' || k[1] === 'b') && F10[k] > 0);
    S.x5 = lb('（也沒有 flow > 0 的邊指進 s 或 b：' + back.length + ' 條）', 'idx', 0, -1.6);
    cap('從 b 往下：(b,d) 2 = 2', 'b 也下不去了');
  },
  async (tok, S) => {
    const R = Object.keys(bfs(F10).par);
    S.k3 = ok(R.length === 2 && R.includes('s') && R.includes('b'), 'S = ' + setS(R) + ' ✓', 0, -2.3);
    cap('滿足條件的只有 s 和 b', '所以 S = {s, b}');
  },
  async (tok, S) => {
    comp(CUTB).forEach((v) => { S.N.vc(v, '#b9d6f2'); S.N.halo(v, FC.T); });
    S.t = lb('T = ' + setS(comp(CUTB)), 'ptr', 3.2, -2.3);
    cap('剩下的就是 T', 'a, c, d, t');
  },
  async (tok, S) => {
    gone(S.x1, S.x2, S.x3, S.x4, S.x5);
    S.B.add('S = source ＋ 有 incomplete f-augmenting path 到得了的端點', 'good');
    cap('S 就是這樣找的', 'source 本身也在裡面');
  },
]);

scene('g8f-tinT', 'S、T 是合法的 cut：t 一定在 T', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10); S.N.cut(CUTB);
    S.B.add('要確定 (S, T) 是 cut：partition ✓、s ∈ S ✓');
    cap('先確定這是合法的 cut', 'partition、source 在 S');
  },
  async (tok, S) => {
    S.B.add('只要再確定：sink t ∈ T');
    await pop(tok, S.N.v.t);
    cap('只要確定 sink 在 T 裡', '');
  },
  async (tok, S) => {
    S.B.add('反證：假設 t 不在 T，那 t ∈ S', 'bad');
    cap('如果 sink 不在 T', '它就在 S 裡面');
  },
  async (tok, S) => {
    S.B.add('→ 有 incomplete f-augmenting path 從 s 到 t → 它就是真的 f-augmenting path', 'say');
    cap('那從 s 到 t 有 incomplete path', '結尾是 t，就是真的 f-augmenting path');
  },
  async (tok, S) => {
    S.B.add('→ F 還可以增大', 'say');
    cap('有 f-augmenting path', '表示 flow 還可以增大');
  },
  async (tok, S) => {
    S.B.add('矛盾！F 是 maximum flow，不可能再增大', 'bad');
    cap('跟假設矛盾', 'F 已經是最大值');
  },
  async (tok, S) => {
    S.k = ok(!CUTB.includes('t'), '所以 t ∈ T，(S, T) 是 separating s 和 t 的 cut（例：t ∉ ' + setS(CUTB) + '）✓', 0, -0.9);
    cap('所以 sink 一定在 T', '這樣找出來的 S、T 是 cut');
  },
]);

scene('g8f-fwdsat', '從 S 到 T 的 forward edge 一定滿載', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10); S.N.cut(CUTB);
    S.B.add('再來：證 c(S, T) = val(F)');
    cap('再來要 argue', '這個 cut 的 capacity 等於 flow value');
  },
  async (tok, S) => {
    S.B.add('（cut 是從 maximum flow F 找出來的）', 'say');
    cap('cut 是從 F 找出來的', '先有 F，才定義 S');
  },
  async (tok, S) => {
    S.B.add('val(F) = Σ f(S→T) − Σ f(T→S)', 'say');
    S.N.paintCut(CUTB);
    cap('value 怎麼算', '正向的 flow 扣掉反向的 flow');
  },
  async (tok, S) => {
    S.B.add('看一條 forward edge (x, y)：x ∈ S、y ∈ T');
    S.g = lb('x ∈ S ── (x,y) ──▶ y ∈ T', 'ptr', 0, -0.9);
    cap('先看 forward edge', 'x 在 S，y 在 T');
  },
  async (tok, S) => {
    S.B.add('x ∈ S → 有 incomplete f-augmenting path 從 s 到 x', 'say');
    cap('x 在 S 裡', '從 source 到 x 有 incomplete path');
  },
  async (tok, S) => {
    S.B.add('f(x, y) ≤ c(x, y)：要嘛 <，要嘛 =', 'say');
    cap('flow 一定 ≤ capacity', '一種是小於，一種是等於');
  },
  async (tok, S) => {
    S.B.add('如果 f(x,y) < c(x,y)：path 可以延長到 y → y ∈ S，矛盾！', 'bad');
    cap('如果小於', 'path 延長到 y，y 就在 S：矛盾');
  },
  async (tok, S) => {
    S.B.add('所以 f(x, y) = c(x, y)（forward edge 滿載）', 'good');
    cap('小於不成立', '只好等於');
  },
  async (tok, S) => {
    gone(S.g);
    S.t = fwdE(CUTB).map((k) => S.N.mtag(k, F10[k] + ' = ' + CAPS[k] + (F10[k] === CAPS[k] ? ' ✓' : ' ✘'), F10[k] === CAPS[k] ? 'good' : 'bad'));
    S.k = ok(fwdE(CUTB).every((k) => F10[k] === CAPS[k]), '例：' + fwdE(CUTB).map(en).join('、') + ' 全部滿載 ✓', 0, -0.9);
    cap('例子：(s,a)、(s,c)、(b,d)', '從 S 到 T 的邊 flow 都等於 capacity');
  },
]);

scene('g8f-bwdzero', '從 T 到 S 的 backward edge 一定是 0', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10); S.N.cut(CUTB); S.N.paintCut(CUTB);
    S.B.add('同樣的道理看 backward edge');
    cap('類似的 argue', '再看 backward edge');
  },
  async (tok, S) => {
    S.B.add('(u, v)：u ∈ T、v ∈ S（從 T 指回 S）');
    S.g = lb('u ∈ T ── (u,v) ──▶ v ∈ S', 'ptr', 0, -0.9);
    cap('edge (u, v)', 'u 在 T，v 在 S');
  },
  async (tok, S) => {
    S.B.add('v ∈ S → 有 incomplete f-augmenting path 從 s 到 v', 'say');
    cap('v 在 S 裡', '從 source 到 v 有 incomplete path');
  },
  async (tok, S) => {
    S.B.add('如果 f(u, v) > 0：backward 條件滿足 → path 延長到 u → u ∈ S', 'bad');
    cap('如果 flow > 0', '就能從 v 延伸到 u');
  },
  async (tok, S) => {
    S.B.add('跟 u ∈ T 矛盾！', 'bad');
    const b = bwdE(CUTB);
    S.k = ok(b.every((k) => F10[k] === 0), '例：從 T 指回 S = ' + setS(CUTB) + ' 的邊有 ' + b.length + ' 條（沒有反例）✓', 0, -1.6);
    cap('u 就會在 S 裡', '跟假設 u 在 T 矛盾');
  },
]);

// ════════ oFStjKYt8b4（第32B講：證明收尾、Edmonds–Karp、Ford–Fulkerson、回顧） ════════
scene('g8f-conclude', '代回去：c(S, T) = val(F)，而且是 min cut', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(F10); S.N.cut(CUTB); S.N.paintCut(CUTB);
    S.B.add('矛盾 → f(u, v) > 0 不對 → f(u, v) = 0（非負整數）');
    cap('flow 是非負整數', '大於 0 不行，只能等於 0');
  },
  async (tok, S) => {
    S.B.add('兩個結論：S→T 的邊 f = c；T→S 的邊 f = 0', 'good');
    cap('兩個結論', 'forward 滿載，backward 是 0');
  },
  async (tok, S) => {
    S.B.add('代進 val(F) = Σ f(x,y)[x∈S,y∈T] − Σ f(u,v)[u∈T,v∈S]', 'say');
    cap('帶進去算 flow value', '這個式子對任何 cut 都成立');
  },
  async (tok, S) => {
    S.B.add('前面每項 = c(x, y)；後面每項 = 0', 'say');
    cap('forward edge 那項等於 capacity', 'backward edge 那項是 0');
  },
  async (tok, S) => {
    S.B.add('val(F) = Σ c(x, y)[x∈S, y∈T] = c(S, T)');
    S.k = ok(val(F10) === capCut(CUTB), '例：val = ' + val(F10) + '，c(S,T) = ' + plusC(fwdE(CUTB)) + ' = ' + capCut(CUTB) + ' ✓', 0, -0.9);
    cap('剩下的就是 capacity 加起來', '就是這個 cut 的 capacity');
  },
  async (tok, S) => {
    S.B.add('證出：這個 cut 的 capacity = maximum flow 的 value', 'good');
    cap('有 maximum flow', '就能找到 capacity 剛好等於它的 cut');
  },
  async (tok, S) => {
    S.B.add('任何其他 cut (S′, T′)：c(S′, T′) ≥ val(F) = c(S, T)', 'say');
    S.k2 = ok(ALLS.every((C) => capCut(C) >= val(F10)), '例：16 個 cut 的 capacity 都 ≥ ' + val(F10) + ' ✓', 0, -1.6);
    cap('任何 cut 的 capacity', '都 ≥ flow 的 value');
  },
  async (tok, S) => {
    S.B.add('所以 (S, T) 是 minimum cut');
    S.k3 = ok(capCut(CUTB) === MINCUT, 'c(S,T) = ' + capCut(CUTB) + ' = 最小值 ' + MINCUT + ' ✓', 0, -2.3);
    cap('所以這個 cut capacity', '是所有 cut 中最小的');
  },
  async (tok, S) => {
    S.B.add('Max-Flow Min-Cut Theorem 證完：max flow = min cut', 'good');
    cap('證完了', 'max flow 等於 min cut');
  },
  async (tok, S) => {
    S.B.add('回顧：max flow → 定義 S → 合法 cut → c(S,T) = val → 最小', 'say');
    cap('主要用到 f-augmenting path 的條件', '');
  },
]);

const EKC = [
  'Edmonds–Karp',
  'f ← 0（每條邊）',
  'repeat',
  '  從 s 用 BFS 長 tree of',
  '  incomplete f-augmenting paths',
  '  if tree 到達 t：',
  '    沿 path 加 Δ_P；done ← 0',
  '  else done ← 1',
  'until done = 1',
  'S ← tree 的端點；T ← V − S',
];
// the pseudo-code as ONE label (lines in one box): ten separate line labels were taller than the stage allows and printed over each other
function codeBox(lines, x, y) {
  // class icon: the label tidy-up keeps it in place and moves the small labels around it instead
  const l = lab.label('', 'icon'); const el = l.element;
  Object.assign(el.style, { fontFamily: 'ui-monospace, Consolas, monospace', whiteSpace: 'pre', textAlign: 'left', lineHeight: '1.5', fontSize: '11px', fontWeight: '600', padding: '3px 6px',
    color: '#5c4a33', background: 'rgba(255,253,248,.95)', border: '1px solid rgba(216,194,155,.6)', borderRadius: '6px', boxShadow: '0 1px 2px rgba(46,36,24,.08)' });
  const sp = lines.map((t) => { const d = document.createElement('div'); d.textContent = t; d.style.borderRadius = '4px'; d.style.padding = '0 3px'; el.appendChild(d); return d; });
  l.position.set(x, y, 0.3); lab.world.add(l);
  return { l, hl(i) { sp.forEach((d, k) => { d.style.background = k === i ? '#a8730f' : ''; d.style.color = k === i ? '#fff' : ''; }); }, kill() { remove(l); } };
}
function ekTree(S, B) {
  gone(S.tr || []); S.tr = [];
  S.N.reset(); VS.forEach((v) => { S.N.vc(v); S.N.halo(v, null); });
  B.order.forEach((v) => { S.N.halo(v, FC.ok); });
  Object.entries(B.par).forEach(([v, pr]) => { if (pr) S.N.pe(pr[1], pr[2] === 'f' ? FC.ok : FC.back, true); });
  B.order.forEach((v) => { if (v !== 's') S.tr.push(S.N.ptag(v, 'L' + B.lev[v], 'idx', 0.62)); });
}
scene('g8f-ek', 'Edmonds–Karp algorithm', [
  async (tok, S) => {
    S.B = board({ x: 2.4, max: 3 });
    S.B.add('定理：flow 值 = 某個 cut capacity → 這個 flow 是 max、cut 是 min');
    cap('證完 Max-Flow Min-Cut Theorem', 'flow 等於 cut capacity 就是 max');
  },
  async (tok, S) => {
    S.C = codeBox(EKC, -4.8, 2.2);
    S.N = mkNet({ s: 0.62, ox: 3.5, oy: 1.2 });
    S.n = lb('右邊：在老師的 network 上跑一次（示意）', 'idx', 3.3, 0.2);
    S.B.add('Edmonds–Karp algorithm：找 maximum flow，也給 min cut（high-level）', 'say');
    cap('介紹 Edmonds–Karp algorithm', 'pseudocode 是比較 high level 的');
  },
  async (tok, S) => {
    S.C.hl(0);
    S.B.add('Edmonds 和 Karp，1972 年提出', 'say');
    cap('這兩個人', '1972 年提出來的');
  },
  async (tok, S) => {
    S.C.hl(1); S.F = { ...ZERO }; S.N.setF(S.F);
    S.v = lb('val = 0', 'ptr alt', 3.3, -0.6);
    cap('一開始 flow 全部設為 0', 'network 已經 given');
  },
  async (tok, S) => { S.C.hl(2); cap('然後 repeat 下面的事', ''); },
  async (tok, S) => {
    S.C.hl(3);
    cap('從 source 去找 f-augmenting path', '跟 maximum matching 類似');
  },
  async (tok, S) => {
    S.B.add('用 breadth-first search（廣度優先）來找', 'say');
    cap('用 breadth-first search', '一層一層找');
  },
  async (tok, S) => {
    S.C.hl(4);
    S.B.add('加進 tree 的邊要合條件：forward f < c、backward f > 0', 'say');
    cap('每條邊要滿足條件', 'forward f < c，backward f > 0');
  },
  async (tok, S) => {
    S.N.vc('s', FC.S); S.N.halo('s', FC.ok);
    cap('長一個 BFS tree', 'tree of incomplete f-augmenting paths，root 在 source');
  },
  async (tok, S) => {
    S.it = EKRUN[0];
    for (let L = 1; L <= Math.max(...Object.values(S.it.B.lev)); L++) {
      ekTree(S, { ...S.it.B, order: S.it.B.order.filter((v) => S.it.B.lev[v] <= L), par: Object.fromEntries(Object.entries(S.it.B.par).filter(([v]) => S.it.B.lev[v] <= L)) });
      await wt(tok, 650);
    }
    cap('第一層的邊合不合？合就放到 tree 上', '再從第一層長第二層…');
  },
  async (tok, S) => {
    S.C.hl(5);
    S.r = ok(S.it.B.hasT, 'tree 到達 t ✓', 3.3, -1.3);
    cap('如果 tree 到了 sink', '表示有 f-augmenting path');
  },
  async (tok, S) => {
    S.C.hl(6); gone(S.r);
    const p = S.it.p; S.N.reset(); p.forEach(([, k]) => S.N.pe(k, FC.hot, true));
    S.F = S.it.F; S.N.setF(S.F); S.v.element.textContent = 'val = ' + val(S.F);
    S.r = lb('path ' + pathNames(p).join('-') + '，Δ = ' + S.it.D, 'say', 3.3, -1.3);
    cap('照前面的方法增大', 'Δ = path 上 Δ_e 的最小值');
  },
  async (tok, S) => {
    gone(S.r);
    const rest = EKRUN.slice(1).filter((x) => !x.end);
    S.hist = [S.it];
    for (const it of rest) {
      S.N.reset(); it.p.forEach(([, k]) => S.N.pe(k, FC.hot, true));
      S.F = it.F; S.N.setF(S.F); S.v.element.textContent = 'val = ' + val(S.F); S.hist.push(it);
      await wt(tok, 750);
    }
    S.r = lb('（示意）' + S.hist.map((it) => pathNames(it.p).join('') + '+' + it.D).join('，'), 'say', 3.3, -1.3);
    cap('增大了，done = 0，再找一次', '一次加一條 f-augmenting path');
  },
  async (tok, S) => {
    S.C.hl(7); gone(S.r);
    ekTree(S, EKEND.B);
    S.r = ok(!EKEND.B.hasT, 'tree 沒有 sink → done = 1，停', 3.3, -1.3);
    cap('如果 tree 最後沒有包含 sink', 'flow 沒辦法增大了');
  },
  async (tok, S) => {
    S.C.hl(8);
    cap('repeat 直到 done = 1', '到了 sink 就加大、再重來');
  },
  async (tok, S) => {
    S.C.hl(9); gone(S.r, S.tr);
    const Sset = EKEND.B.order;
    S.N.cut(Sset); S.N.paintCut(Sset);
    S.r = ok(capCut(Sset) === val(EKEND.F), 'S = ' + setS(Sset) + '，c(S,T) = ' + capCut(Sset) + ' = val ' + val(EKEND.F) + ' ✓', 3.3, -1.3);
    cap('S = tree 裡的端點', '剩下的放 T（S bar）');
  },
]);

scene('g8f-ekwhy', '為什麼 Edmonds–Karp 對；和 Ford–Fulkerson 的關係', [
  async (tok, S) => {
    S.B = board(); S.N = mkNet(); S.N.setF(EKEND.F); const Sset = EKEND.B.order; S.N.cut(Sset); S.N.paintCut(Sset); S.Sset = Sset;
    S.B.add('停下來時 S 裡沒有 sink → (S, T) 是合法的 cut');
    S.k = ok(!Sset.includes('t'), '示意：S = ' + setS(Sset) + '，t ∈ T ✓', 0, -0.9);
    cap('做出來的 S、T 是合法的 cut', '因為 sink 一直在 T');
  },
  async (tok, S) => {
    const f = fwdE(S.Sset).every((k) => EKEND.F[k] === CAPS[k]), b = bwdE(S.Sset).every((k) => EKEND.F[k] === 0);
    S.B.add('S→T 的邊 f = c、T→S 的邊 f = 0（不然 tree 還能長）', 'say');
    S.k2 = ok(f && b && capCut(S.Sset) === val(EKEND.F), 'forward 全滿 ✓ backward 全 0 ✓ → c(S,T) = ' + capCut(S.Sset) + ' = val ✓', 0, -1.6);
    cap('跟定理的證明一模一樣', 'cut capacity 剛好等於現在的 flow 值');
  },
  async (tok, S) => {
    S.B.add('Remark 1：結束時 flow 是 maximum flow，cut 是 minimum cut', 'good');
    cap('第一個 remark', '結束時 flow 最大、cut 最小');
  },
  async (tok, S) => {
    S.B.add('Remark 2：Ford–Fulkerson method（1956）');
    cap('第二個 remark', '還有一個方法叫 Ford–Fulkerson');
  },
  async (tok, S) => {
    S.B.add('Ford–Fulkerson 沒規定怎麼找 f-augmenting path；Edmonds–Karp 用 BFS 找', 'say');
    cap('Ford–Fulkerson 沒有 specify 怎麼找', 'Edmonds–Karp 是用 BFS 的一種 implementation');
  },
  async (tok, S) => {
    S.B.add('Edmonds–Karp（1972）可以看成 Ford–Fulkerson（1956）的 implementation', 'good');
    cap('Edmonds–Karp 比較晚', '1972 vs 1956');
  },
]);

scene('g8f-recap', 'Maximum flow 單元回顧', [
  async (tok, S) => {
    S.B = board({ max: 4, y: 10.8 });
    S.N = mkNet({ s: 0.8, ox: 0, oy: 0.2 }); S.N.setF(F10);
    S.B.add('network：source、sink、每條邊的 capacity');
    cap('Maximum flow 這部分講完了', '先介紹 network');
  },
  async (tok, S) => { S.B.add('flow：feasibility ＋ conservation'); cap('flow 要滿足兩個條件', 'feasibility 和 conservation'); },
  async (tok, S) => { S.B.add('value = source 的 outflow'); cap('flow value 怎麼定義', ''); },
  async (tok, S) => { S.B.add('cut (S, T)：val = 流過去 − 流回來'); cap('怎麼定義 cut', 'flow value 跟 cut 的關係'); },
  async (tok, S) => { S.B.add('任何 flow 的 value ≤ 任何 cut 的 capacity'); cap('任何 flow value', '都 ≤ cut 的 capacity'); },
  async (tok, S) => { S.B.add('找 f-augmenting path 把 flow 增大'); cap('怎麼把 flow 增大', '找 f-augmenting path'); },
  async (tok, S) => { S.B.add('Max-Flow Min-Cut Theorem：max flow = min cut'); cap('maximum flow', '剛好等於 min cut'); },
  async (tok, S) => {
    S.B.add('Edmonds–Karp：結束時得到 max flow 和 min cut', 'good');
    S.N.cut(CUTB);
    cap('Edmonds–Karp algorithm', '結束時 flow 最大，cut 最小');
  },
]);
  }

  // ═══ g8g.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 8 章 — cued scenes（g8g）───
//   6WZvVJ0Q1FA  Spanning Tree（Rosen 11.4：定義、拿掉 circuit、DFS、BFS、有向圖 DFS、練習）
//   Erea1QASjXY  Discrete Math II 10.8.1 Graph Coloring（地圖著色、dual graph、χ(G)、Kₙ、Cₙ、chromatic polynomial）
//   P2FRYshQ57s  交大 易志偉 Lec24 Graphs (3/3)（權重圖、最短路徑、Dijkstra、回溯路徑、Euler path/circuit、
//                Königsberg、Hamilton、連通、component、強／弱連通）
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的圖：能從口述完整重建的照用（生成樹三張例圖沿用本章的 EX1／DFSG／BFSG／DIRG；Dijkstra 的 A–F 圖與 12 點圖
// 由老師算的每一步反推出邊與權重）；看不到的一律標「示意」。所有計數、距離、著色都在程式裡算並打 ✓。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const setc = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const set = (l, t) => { if (l && l.element) l.element.textContent = t; };
const LL = (t, c, x, z, y = 0.4) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const GCAM = [[0, 10, 8.6], [0, 0, 0.2]];
function scene(id, title, steps, cam = GCAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// lines on the floor, one under another; the newest line is lit
function board(x, z0, dz = 0.58) {
  const st = stackBoard(x, 0.4, z0, x < -4 ? { maxW: 200, pin: 12 } : { maxW: 200 }); let last = null;
  return {
    ls: st.ls,
    add(t, c = 'note') {
      if (last && last.userData.hot) { setc(last, 'say'); last.userData.hot = false; }
      const l = st.line(t, c); l.userData.hot = c === 'note'; last = l; return l;
    },
    clear() { st.clear(); last = null; },
  };
}
const EG = (gv, u, v) => { const k = gv.find(u, v); if (k < 0) throw new Error('no edge ' + u + '-' + v); return gv.em[k]; };
function flash(gv, cyc, c = COL.hot) { cyc.forEach((n, i) => paintEdge(EG(gv, n, cyc[(i + 1) % cyc.length]), c, true)); }
const calm = (gv) => gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.edge, false); });
const liveIdx = (gv) => gv.em.map((e, i) => i).filter((i) => gv.em[i].g.visible);
// a spanning tree check on the edges still shown: n − 1 edges, no cycle (⇒ connected)
function treeCheck(gv) { const idx = liveIdx(gv); return idx.length === gv.G.V.length - 1 && acyclic(gv.G, idx); }
function reach(V, E, s, dir) {
  const A = Object.fromEntries(V.map((v) => [v, []]));
  E.forEach(([u, v]) => { A[u].push(v); if (!dir) A[v].push(u); });
  const seen = new Set([s]), q = [s];
  while (q.length) { const u = q.shift(); for (const w of A[u]) if (!seen.has(w)) { seen.add(w); q.push(w); } }
  return seen;
}
function components(V, E) { const left = new Set(V); let n = 0; while (left.size) { const s = [...left][0]; reach(V, E, s).forEach((v) => left.delete(v)); n++; } return n; }
function ball(p, c = COL.hot) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
  m.position.set(p.x, 0.85, p.z); lab.world.add(m); return m;
}
async function walk(tok, m, gv, seq, ms = 380, paint) {
  for (let i = 0; i + 1 < seq.length; i++) {
    const a = gv.pos(seq[i]), b = gv.pos(seq[i + 1]);
    await anim(tok, ms, (u) => { m.position.set(a.x + (b.x - a.x) * u, 0.85, a.z + (b.z - a.z) * u); });
    if (paint) paintEdge(EG(gv, seq[i], seq[i + 1]), paint, true);
  }
}
const snapAt = (st, pre) => { const k = st.findIndex((x) => x.msg.startsWith(pre)); if (k < 0) throw new Error('snap ' + pre); return k; };
async function playSnaps(tok, gv, st, a, b, ms = 260, lvl = false, on) {
  for (let k = a; k <= b; k++) { paintTrav(gv, st[k], lvl); if (on) on(st[k]); if (k < b) await wt(tok, ms); }
}
const lastSnap = (st) => st.length - 1;
// parent map of the DFS tree in a final snapshot (tree edge i joins a vertex and its parent)
function dfsParents(G, root, order) {
  const A = adjOf(G, order), par = { [root]: null }, seen = new Set([root]);
  const visit = (v) => { for (const { to } of A[v]) if (!seen.has(to)) { seen.add(to); par[to] = v; visit(to); } };
  visit(root); return par;
}
const ancestor = (par, a, b) => { for (let x = par[b]; x !== null && x !== undefined; x = par[x]) if (x === a) return true; return false; };
function degs(G) { const d = Object.fromEntries(G.V.map((v) => [v, 0])); G.E.forEach((e) => { d[e.u]++; d[e.v]++; }); return d; }
// a walk that uses every edge exactly once? (multi-edges allowed)
function eulerOK(G, seq) {
  const used = new Array(G.E.length).fill(false);
  for (let i = 0; i + 1 < seq.length; i++) {
    const k = G.E.findIndex((e, j) => !used[j] && ((e.u === seq[i] && e.v === seq[i + 1]) || (e.v === seq[i] && e.u === seq[i + 1])));
    if (k < 0) return false; used[k] = true;
  }
  return used.every(Boolean);
}
function degTags(gv, cls = 'ptr alt') {
  const d = degs(gv.G), out = {};
  gv.G.V.forEach((v) => { const p = gv.pos(v); out[v] = tag('deg ' + d[v], d[v] % 2 ? 'bad' : cls, p.x + 0.55, p.y + 0.6, p.z - 0.45); });
  return out;
}

// ════════ 6WZvVJ0Q1FA（Spanning Tree：Rosen 11.4） ════════
// EX1 / DFSG / BFSG / DIRG / EXR 是本章原本照影片口述重建的圖（DFSG 的回邊位置影片看不清，是補的）。

scene('g8g-st-def', 'Spanning tree 的定義', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4);
    S.B.add('G：simple graph');
    S.B.add('spanning tree of G：G 的子圖');
    S.B.add('  ① 本身是一棵樹　② 含 G 的每一個頂點', 'say');
    cap('定義：spanning tree', '包含 G 所有頂點、本身是樹的子圖');
  },
  async (tok, S) => {
    S.gv = drawGraph(EX1, { s: 0.85, ox: 2.3, oz: 0.3 });
    cap('例子：找這張 simple graph 的 spanning tree', '');
  },
  async (tok, S) => {
    const E = EX1.E.map((e) => [e.u, e.v]);
    const ok = reach(EX1.V, E, 'a').size === EX1.V.length;
    EX1.V.forEach((v) => vcol(S.gv, v, COL.vis));
    S.cnt = tag('a～g：7 個頂點、9 條邊、連通 ' + (ok ? '✓' : '✗'), 'ptr alt', 2.3, 0.3, 3.0);
    cap('頂點 a 到 g，彼此都連得到', '這張圖是 connected');
  },
  async (tok, S) => {
    EX1.V.forEach((v) => vcol(S.gv, v, COL.idle));
    flash(S.gv, ['a', 'b', 'f', 'e']);
    S.B.add('但它不是樹：有 simple circuit a–b–f–e–a', 'bad');
    cap('但它不是樹', '因為它含有 simple circuit');
  },
  async (tok, S) => {
    S.w = ball(S.gv.pos('a'));
    await walk(tok, S.w, S.gv, ['a', 'b', 'f', 'e', 'a'], 450);
    cap('simple circuit：從一個點出發、繞回同一點', '有點像一個圈');
  },
  async (tok, S) => {
    kill(S.w);
    S.B.add('樹：從根往下走，不會再回到同一個點', 'note');
    cap('樹的原則：從根往下，不會繞回同一點', '會繞回來的就只是「圖」');
  },
  async (tok, S) => {
    S.B.add('目標：拿掉 simple circuit，頂點一個不少', 'good');
    cap('作法：把圖改成 spanning tree', '拿掉 simple circuit');
  },
]);

scene('g8g-st-remove', '拿掉 simple circuit 上的邊', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4);
    S.gv = drawGraph(EX1, { s: 0.85, ox: 2.3, oz: 0.3 });
    S.m = 9; S.cnt = tag('7 個頂點、9 條邊', 'ptr alt', 2.3, 0.3, 3.0);
    S.B.add('保留 a～g 全部 7 個頂點，只拿掉邊');
    cap('拿掉 circuit 上的邊', 'a 到 g 的頂點全部留著');
  },
  async (tok, S) => {
    flash(S.gv, ['a', 'b', 'f', 'e']); await wt(tok, 700);
    await removeEdge(tok, EG(S.gv, 'a', 'e')); calm(S.gv);
    set(S.cnt, '7 個頂點、' + (--S.m) + ' 條邊');
    S.B.add('拿掉 {a,e}：a–b–f–e–a 不見了');
    cap('拿掉邊 {a,e}', 'circuit a–b–f–e–a 消失');
  },
  async (tok, S) => {
    flash(S.gv, ['c', 'g', 'f']);
    cap('但還有 circuit：c–g–f–c', '剩下的圖還不是樹');
  },
  async (tok, S) => {
    calm(S.gv); flash(S.gv, ['e', 'g', 'f']); await wt(tok, 700);
    await removeEdge(tok, EG(S.gv, 'e', 'f')); calm(S.gv);
    set(S.cnt, '7 個頂點、' + (--S.m) + ' 條邊');
    S.B.add('拿掉 {e,f}：e–g–f–e 不見了');
    cap('拿掉 {e,f}', '因為 e–g–f–e 也是 circuit');
  },
  async (tok, S) => {
    flash(S.gv, ['f', 'c', 'g']); await wt(tok, 700);
    await removeEdge(tok, EG(S.gv, 'c', 'g')); calm(S.gv);
    set(S.cnt, '7 個頂點、' + (--S.m) + ' 條邊');
    S.B.add('拿掉 {c,g}：f–c–g–f 不見了');
    cap('再拿掉 {c,g}', 'f–c–g–f 也是 circuit');
  },
  async (tok, S) => {
    const ok = treeCheck(S.gv);
    S.gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.tree, true); });
    EX1.V.forEach((v) => vcol(S.gv, v, COL.vis));
    set(S.cnt, '7 個頂點、6 條邊 = 7 − 1，沒有 circuit ' + (ok ? '✓' : '✗'));
    cap('沒有 simple circuit 了', '這就是一棵 spanning tree');
  },
  async (tok, S) => {
    S.B.add('連通但有 circuit → 拿光 circuit、頂點不變 → spanning tree', 'good');
    cap('spanning tree 的意思', '拿掉所有 circuit，但頂點數不變');
  },
  async (tok, S) => {
    S.B.add('拿哪一條不重要：{a,e}、{c,g}、{e,f}… 換別條也行', 'say');
    cap('拿掉哪條邊不唯一', 'spanning tree 可以有很多棵');
  },
  async (tok, S) => {
    ['a', 'e', 'f', 'g', 'c'].forEach((v) => glow(S.gv.vm[v], '#7a5a00'));
    S.B.add('{a,e}←a–e–f–b–a、{e,f}←e–g–f–e、{c,g}←g–f–c–g', 'say');
    cap('再說一次為什麼拿這三條', '每條都在一個 circuit 上');
  },
  async (tok, S) => {
    ['a', 'e', 'f', 'g', 'c'].forEach((v) => glow(S.gv.vm[v], null));
    S.B.add('連通 ✓　沒有 circuit ✓　7 個頂點都在 ✓', 'good');
    cap('結論', '拿掉所有 circuit、保留所有頂點 → spanning tree');
  },
]);

const RULE = parseG({ r: [-1.8, 0.2], s: [0, -1.4], t: [2.0, -2.0], u: [2.0, 0.6], v: [-0.4, 2.0] }, 'r-s s-t s-u r-v');
scene('g8g-st-rule', 'DFS 建 spanning tree 的規則', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4);
    S.B.add('建 spanning tree 的兩個演算法：');
    S.B.add('  depth-first search（DFS）', 'say');
    S.B.add('  breadth-first search（BFS）', 'say');
    cap('兩個主要演算法', 'DFS 和 BFS');
  },
  async (tok, S) => {
    S.ai = tag('人工智慧課：搜尋、遊戲也常用', 'idx', -4.6, 0.3, -0.2);
    cap('這兩個在 AI 課很常用', '搜尋演算法、遊戲');
  },
  async (tok, S) => {
    kill(S.ai);
    S.gv = drawGraph(RULE, { s: 1, ox: 2.6, oz: 0.2 });
    tag('示意', 'idx', 5.4, 0.3, -2.6);
    S.st = travSteps(RULE, 'r', 'dfs');
    S.path = tag('', 'ptr alt', 2.6, 0.3, 3.1);
    S.on = (x) => set(S.path, '路徑：' + (x.ds.join(' → ') || '—'));
    await playSnaps(tok, S.gv, S.st, 0, 0, 0, false, S.on);
    S.B.add('① 任選一個頂點當根（這裡選 r）');
    cap('第一步：隨便選一個頂點當根', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 1, 2, 500, false, S.on);
    S.B.add('② 一直加邊：接在路徑最後一點、接到還沒走過的點');
    cap('從根開始一條路徑', '新邊接在最後一點、通往新的頂點');
  },
  async (tok, S) => {
    glow(S.gv.vm.t, '#8a1010');
    cap('能走多遠就走多遠', 't 已經走不下去');
  },
  async (tok, S) => {
    S.B.add('③ 若路徑已經經過所有頂點 → 就是 spanning tree', 'say');
    cap('如果路徑已經經過所有頂點，就完成了', '這裡還缺 u、v');
  },
  async (tok, S) => {
    glow(S.gv.vm.t, null);
    await playSnaps(tok, S.gv, S.st, 3, 4, 600, false, S.on);
    S.B.add('④ 否則 backtrack：退回上一點，從那裡接新路徑');
    cap('backtracking：退回 s', '從 s 再接到沒走過的 u');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 5, 7, 500, false, S.on);
    S.B.add('⑤ 還是不行就再往回退一點');
    cap('s 也沒有新點了 → 再退回 r', 'r 接到 v');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 8, lastSnap(S.st), 400, false, S.on);
    const n = S.st[lastSnap(S.st)].tree.length;
    set(S.path, '5 個頂點、' + n + ' 條樹邊 = 5 − 1 ' + (n === 4 ? '✓' : '✗'));
    cap('重複到所有頂點都拜訪過', '得到一棵 spanning tree');
  },
  async (tok, S) => {
    cap('整理：選根 → 走到下一點 → 接一條邊 → 繼續', '能走就一直走');
  },
  async (tok, S) => {
    S.B.add('沒路了就 backtrack，直到所有頂點都走過', 'good');
    cap('沒路就往回退', '再找沒去過的方向');
  },
]);

scene('g8g-st-dfs-ex', 'DFS 例子：從 f 出發', [
  async (tok, S) => {
    S.gv = drawGraph(DFSG);
    S.st = travSteps(DFSG, 'f', 'dfs', DFS_ORDER);
    S.path = tag('', 'ptr alt', 0, 0.3, 3.4);
    S.on = (x) => set(S.path, '目前路徑：' + (x.ds.join(' → ') || '—'));
    cap('例子：用 DFS 找這張圖的 spanning tree', '');
  },
  async (tok, S) => {
    vcol(S.gv, 'f', COL.vis, '#8a6400');
    cap('任選一個頂點當根', '這裡選 f');
  },
  async (tok, S) => {
    for (const [a, b] of [['f', 'g'], ['g', 'h'], ['h', 'k'], ['k', 'j']]) { paintEdge(EG(S.gv, a, b), COL.blue, true); await wt(tok, 250); }
    S.pre = tag('先口頭講一遍', 'idx', 0, 0.3, -3.0);
    cap('老師先講一遍：f → g → h → k → j', 'j 走不下去');
  },
  async (tok, S) => {
    paintEdge(EG(S.gv, 'h', 'i'), COL.blue, true);
    cap('退回 k、再退回 h', 'h 還沒去 i → 走 i');
  },
  async (tok, S) => {
    glow(S.gv.vm.f, '#8a6400');
    cap('再退回 f，往 d、e… 走下去', '以此類推');
  },
  async (tok, S) => {
    kill(S.pre);
    await playSnaps(tok, S.gv, S.st, 0, 0, 0, false, S.on);
    cap('正式來一次：從 f 開始', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 1, 4, 450, false, S.on);
    cap('一直加邊、接到新的頂點', '路徑 f → g → h → k → j');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 5, 5, 0, false, S.on);
    cap('j 走不下去 → 回到 k', 'k 也沒有新的頂點');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 6, 7, 600, false, S.on);
    cap('再回到 h：還沒去 i', '接上 h–i');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 8, 8, 0, false, S.on);
    cap('到了 i 又走不下去', '回到 h');
  },
  async (tok, S) => {
    const a = snapAt(S.st, 'h 走不下去'), b = snapAt(S.st, 'f → d');
    await playSnaps(tok, S.gv, S.st, a, b, 450, false, S.on);
    cap('h、g 都沒新點了，一路退回 f', 'f 還可以走到 d：新路徑');
  },
  async (tok, S) => {
    const a = snapAt(S.st, 'd → e'), b = snapAt(S.st, 'c → a');
    await playSnaps(tok, S.gv, S.st, a, b, 500, false, S.on);
    cap('d → e → c → a', '能走多遠走多遠');
  },
  async (tok, S) => {
    cap('根可以任意選', '選別的根也會得到 spanning tree，只是路徑不同');
  },
  async (tok, S) => {
    const a = snapAt(S.st, 'a 走不下去'), b = snapAt(S.st, 'c → b');
    await playSnaps(tok, S.gv, S.st, a, b, 600, false, S.on);
    cap('a 走不下去 → 回到 c', 'c 還沒去 b → 接上 c–b');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'b 走不下去'), lastSnap(S.st), 160, false, S.on);
    const fin = S.st[lastSnap(S.st)];
    const ok = fin.tree.length === DFSG.V.length - 1 && acyclic(DFSG, fin.tree);
    set(S.path, '根 f：11 個頂點、' + fin.tree.length + ' 條樹邊、沒有 circuit ' + (ok ? '✓' : '✗'));
    cap('這就是 spanning tree', '根是 f');
  },
  async (tok, S) => {
    const st = travSteps(DFSG, 'h', 'dfs', DFS_ORDER), fin = st[lastSnap(st)];
    paintTrav(S.gv, fin);
    fin.tree.forEach((i) => paintEdge(S.gv.em[i], COL.purple, true));
    const ok = fin.tree.length === 10 && acyclic(DFSG, fin.tree);
    set(S.path, '換根 h：一樣 ' + fin.tree.length + ' 條樹邊 ' + (ok ? '✓' : '✗') + '（路徑不同）');
    cap('換 h 當根再做一次', '一樣是 spanning tree，路徑可能不同');
  },
  async (tok, S) => {
    cap('回到定義：含所有頂點、本身是樹的子圖', '樹：有根、不會重複拜訪同一個頂點');
  },
]);

const DCODE = ['procedure DFS(G: 連通圖，頂點 v₁…vₙ)', '  T := 只含 v₁ 的樹', '  visit(v₁)', 'procedure visit(v)', '  for 每個與 v 相鄰、還不在 T 的 w', '    把 w 和 {v,w} 加進 T', '    visit(w)'];
scene('g8g-st-dfs-code', 'Tree edge、back edge 與 DFS 虛擬碼', [
  async (tok, S) => {
    S.gv = drawGraph(DFSG, { s: 0.62, ox: 2.4, oz: 0.6 });
    S.st = travSteps(DFSG, 'f', 'dfs', DFS_ORDER);
    S.fin = S.st[lastSnap(S.st)];
    paintTrav(S.gv, S.fin);
    S.info = tag('', 'ptr alt', 2.4, 0.3, 3.0);
    cap('DFS 建 spanning tree：任選根，一路往下走', '這是剛才從 f 出發的結果');
  },
  async (tok, S) => {
    S.fin.tree.forEach((i) => paintEdge(S.gv.em[i], COL.tree, true));
    set(S.info, 'tree edges：' + S.fin.tree.length + ' 條');
    cap('DFS 選到的邊叫 tree edges', '金色那些');
  },
  async (tok, S) => {
    const par = dfsParents(DFSG, 'f', DFS_ORDER);
    const back = DFSG.E.map((e, i) => i).filter((i) => !S.fin.tree.includes(i));
    back.forEach((i) => paintEdge(S.gv.em[i], COL.pink, true));
    const ok = back.every((i) => { const { u, v } = DFSG.E[i]; return ancestor(par, u, v) || ancestor(par, v, u); });
    set(S.info, 'back edges：' + back.map((i) => '{' + DFSG.E[i].u + ',' + DFSG.E[i].v + '}').join(' ') + '　都連到祖先 ' + (ok ? '✓' : '✗'));
    cap('其他的邊都連到祖先或子孫', '叫 back edges（粉紅色）');
  },
  async (tok, S) => {
    cap('課本圖：tree edges 用粗藍線', 'back edges 用細黑線');
  },
  async (tok, S) => {
    S.code = code(DCODE, -3.9, 3.6, 0.62, -1);
    paintTrav(S.gv, S.st[0]);
    cap('DFS 的虛擬碼（Rosen）', '');
  },
  async (tok, S) => {
    S.code.hl(6);
    cap('加了邊 {v,w} 之後', '先把 w 探索完，才回到 v 看下一個鄰居');
  },
  async (tok, S) => {
    S.code.hl(1);
    set(S.info, 'T = { f }（v₁ = f）');
    cap('G 是連通圖，頂點 v₁…vₙ', 'T 一開始只有 v₁');
  },
  async (tok, S) => {
    S.code.hl(2);
    cap('呼叫 visit(v₁)', '');
  },
  async (tok, S) => {
    S.code.hl(3);
    cap('visit(v) 是遞迴的', '');
  },
  async (tok, S) => {
    S.code.hl(5);
    await playSnaps(tok, S.gv, S.st, 1, 1, 0);
    set(S.info, 'w = g：加進 g 和 {f,g}');
    cap('每個和 v 相鄰、還不在 T 的 w', '把 w 和邊 {v,w} 加進 T');
  },
  async (tok, S) => {
    S.code.hl(6);
    await playSnaps(tok, S.gv, S.st, 2, 2, 0);
    set(S.info, '遞迴 visit(g)：接著接上 h');
    cap('然後遞迴呼叫 visit(w)', '');
  },
], [[0, 9.5, 9.5], [0, 0.8, 0.6]]);

scene('g8g-st-bfs', 'BFS 例子：從 e 出發、一層一層', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4);
    S.B.add('BFS（breadth-first search）建 spanning tree');
    cap('接下來：breadth-first search', '一樣可以建 spanning tree');
  },
  async (tok, S) => {
    S.B.add('① 任選根，加入所有和根相鄰的邊 → level 1');
    cap('選一個根，把它所有的邊都接上', '另一端的點就是 level 1');
  },
  async (tok, S) => {
    S.B.add('② 對上一層每個點加邊，只要不形成 simple circuit');
    cap('對上一層的每個頂點加邊', '只要不會造成 simple circuit');
  },
  async (tok, S) => {
    S.B.add('③ 一直做到所有頂點都加進來');
    cap('做到所有頂點都進樹為止', '');
  },
  async (tok, S) => {
    S.gv = drawGraph(BFSG, { s: 0.74, ox: 1.9, oz: 0.3 });
    S.st = travSteps(BFSG, 'e', 'bfs');
    S.q = tag('', 'ptr alt', 1.9, 0.3, 3.0);
    S.on = (x) => set(S.q, 'L = [ ' + x.ds.join(' ') + ' ]');
    cap('例子：用 BFS 找這張圖的 spanning tree', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 0, 0, 0, true, S.on);
    cap('這次選 e 當根', '根怎麼選沒有規定');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 1, snapAt(S.st, 'e — i'), 350, true, S.on);
    cap('e 和 b、d、f、i 相鄰', '這四個是 level 1');
  },
  async (tok, S) => {
    const p = S.gv.pos('a'); S.xa = tag('a 和 e 沒有邊 ✗', 'bad', p.x, p.y + 0.8, p.z - 0.6);
    cap('a 不在 level 1', '因為 e 和 a 之間沒有邊');
  },
  async (tok, S) => {
    kill(S.xa);
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 b'), snapAt(S.st, 'b — c'), 450, true, S.on);
    cap('從最左邊的 b 開始：b 接 a 和 c', '不能再接 e，e 已經是根');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 d'), snapAt(S.st, 'd — h'), 500, true, S.on);
    cap('d 接 h', 'a 已經在樹裡，不能再接');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 f'), snapAt(S.st, 'f — j'), 450, true, S.on);
    cap('f 接 g 和 j', 'e 是根、c 已經接過');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 i'), snapAt(S.st, 'i — k'), 500, true, S.on);
    cap('最後是 i：只能接 k', 'e、j、h 都已經在樹裡');
  },
  async (tok, S) => {
    const lv = S.st[snapAt(S.st, 'i — k')].lvl;
    const n2 = Object.values(lv).filter((x) => x === 2).length;
    S.B.add('level 2 完成：a c h g j k（' + n2 + ' 個）');
    cap('level 2 做完了', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 a'), snapAt(S.st, '從 L 取出 h'), 450, true, S.on);
    cap('level 3：a、c、h 都沒有新點可接', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 g'), snapAt(S.st, 'g — l'), 500, true, S.on);
    cap('g 接 l', 'l 只和 g 相連');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '從 L 取出 j'), lastSnap(S.st), 220, true, S.on);
    const fin = S.st[lastSnap(S.st)];
    const ok = fin.tree.length === BFSG.V.length - 1 && acyclic(BFSG, fin.tree);
    set(S.q, '13 個頂點、' + fin.tree.length + ' 條樹邊、沒有 circuit ' + (ok ? '✓' : '✗'));
    cap('j 沒有新點；k 接 m', '完成 spanning tree');
  },
  async (tok, S) => {
    const lv = S.st[lastSnap(S.st)].lvl, c = (k) => Object.values(lv).filter((x) => x === k).length;
    S.B.add('level 1：' + c(1) + ' 個　level 2：' + c(2) + ' 個　level 3：' + c(3) + ' 個', 'good');
    cap('BFS：一層一層往外', '先接根的鄰居，再看它們沒拜訪過的鄰居');
  },
]);

const VS_DFS = { e: 'ibdf', i: 'jhke', j: 'fgi', f: 'gcej', g: 'ljf', c: 'bf', b: 'aec', a: 'bd', d: 'aeh', h: 'dik', k: 'hmi', l: 'g', m: 'k' };
const VS_BFS = { f: 'ecgj', e: 'bdif' };
scene('g8g-st-vs', '同一張圖：DFS 與 BFS 的差別', [
  async (tok, S) => {
    S.L = drawGraph(BFSG, { s: 0.5, ox: -3.4, oz: 0.2 }); S.R = drawGraph(BFSG, { s: 0.5, ox: 3.4, oz: 0.2 });
    S.tl = tag('DFS，根 e（路線示意）', 'ptr', -3.4, 0.3, -2.3); S.tr = tag('BFS', 'ptr alt', 3.4, 0.3, -2.3);
    S.a = travSteps(BFSG, 'e', 'dfs', VS_DFS); S.b = travSteps(BFSG, 'f', 'bfs', VS_BFS);
    S.pa = tag('', 'idx', -3.4, 0.3, 2.4);
    await playSnaps(tok, S.L, S.a, 0, 0, 0);
    cap('如果改做 DFS：一樣用 e 當根', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.L, S.a, 1, snapAt(S.a, 'g → l'), 350, false, (x) => set(S.pa, x.ds.join('→')));
    cap('一路走成一條長路徑', 'e → i → j → f → g → l');
  },
  async (tok, S) => {
    await playSnaps(tok, S.L, S.a, snapAt(S.a, 'l 走不下去'), snapAt(S.a, 'g 走不下去'), 600, false, (x) => set(S.pa, x.ds.join('→')));
    cap('走到底沒路 → 退回 g，g 也沒有新點', '再往回退');
  },
  async (tok, S) => {
    await playSnaps(tok, S.L, S.a, snapAt(S.a, 'f → c'), lastSnap(S.a), 110, false, (x) => set(S.pa, x.ds.join('→') || ''));
    const d = Math.max(...Object.values(S.a[lastSnap(S.a)].lvl));
    set(S.pa, 'DFS 樹深度 ' + d + '、' + S.a[lastSnap(S.a)].tree.length + ' 條邊 ✓');
    cap('再從還有路的點往 c、b、a… 走下去', 'DFS 長出又深又長的樹');
  },
  async (tok, S) => {
    await playSnaps(tok, S.R, S.b, 0, snapAt(S.b, 'f — j'), 300, true);
    set(S.tr, 'BFS，根 f');
    cap('BFS：選 f 當根', 'f 的鄰居 c、e、g、j 都是 level 1');
  },
  async (tok, S) => {
    await playSnaps(tok, S.R, S.b, snapAt(S.b, '從 L 取出 e'), lastSnap(S.b), 120, true);
    const fin = S.b[lastSnap(S.b)], d = Math.max(...Object.values(fin.lvl));
    const ok = fin.tree.length === 12 && acyclic(BFSG, fin.tree);
    tag('BFS 樹深度 ' + d + '、' + fin.tree.length + ' 條邊 ' + (ok ? '✓' : '✗'), 'idx', 3.4, 0.3, 2.4);
    cap('再看 level 1 的點：e 接 b、d、i', '一層一層往外，樹比較矮');
  },
]);

const BCODE = ['procedure BFS(G: 連通圖，頂點 v₁…vₙ)', '  T := 只含 v₁ 的樹；L := 空串列', '  把 v₁ 放進 L（未處理頂點）', '  while L 不空', '    移除 L 最前面的頂點 v', '    for v 的每個鄰居 w', '      if w 不在 L、也不在 T：', '        w 加到 L 尾端；w 和 {v,w} 加進 T'];
scene('g8g-st-bfs-code', 'BFS 虛擬碼：未處理頂點的 list L', [
  async (tok, S) => {
    S.code = code(BCODE, -3.9, 3.8, 0.58, -1);
    S.gv = drawGraph(BFSG, { s: 0.55, ox: 3.0, oz: 0.6 });
    S.st = travSteps(BFSG, 'e', 'bfs');
    S.q = tag('', 'ptr alt', 3.0, 0.3, 3.0);
    S.code.hl(0);
    cap('BFS 的虛擬碼', 'G 是連通圖，頂點 v₁…vₙ');
  },
  async (tok, S) => {
    S.code.hl(1);
    paintTrav(S.gv, S.st[0]);
    set(S.q, 'T = { e }（拿剛才的圖，v₁ = e）　L = [ ]');
    cap('T 一開始只有 v₁', 'L 是空的 list');
  },
  async (tok, S) => {
    S.code.hl(2);
    set(S.q, 'L = [ e ]');
    cap('把 v₁ 放進 L', 'L 存的是「還沒處理」的頂點');
  },
  async (tok, S) => {
    S.code.hl(3);
    cap('只要 L 不是空的就繼續', 'L 空了就結束');
  },
  async (tok, S) => {
    S.code.hl(4);
    paintTrav(S.gv, S.st[1]);
    set(S.q, '取出 e　L = [ ]');
    cap('移除 L 最前面的頂點 v', '處理過就不再看它');
  },
  async (tok, S) => {
    S.code.hl(5);
    cap('看 v 的每一個鄰居 w', '');
  },
  async (tok, S) => {
    S.code.hl(7);
    await playSnaps(tok, S.gv, S.st, 2, snapAt(S.st, 'e — i'), 400, false, (x) => set(S.q, 'L = [ ' + x.ds.join(' ') + ' ]'));
    cap('w 不在 L 也不在 T → 放到 L 尾端', '同時把 w 和 {v,w} 加進 T');
  },
], [[0, 9.5, 9.5], [0, 0.8, 0.6]]);

scene('g8g-st-dir', '有向圖的 DFS：spanning forest', [
  async (tok, S) => {
    S.gv = drawGraph(DIRG);
    S.st = travSteps(DIRG, 'a', 'dfs');
    S.path = tag('', 'ptr alt', 0, 0.3, 3.6);
    S.on = (x) => set(S.path, '路徑：' + (x.ds.join(' → ') || '—'));
    cap('有向圖也可以做 DFS（BFS 也可以）', '');
  },
  async (tok, S) => {
    cap('但結果不一定是 spanning tree', '而是 spanning forest（好幾棵樹）');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, 0, snapAt(S.st, 'c → g'), 450, false, S.on);
    cap('從 a 開始：路徑 a → b → c → g', '');
  },
  async (tok, S) => {
    const k = S.gv.find('d', 'c'); paintEdge(S.gv.em[k], COL.hot, true);
    const p = S.gv.pos('d'); S.xd = tag('箭頭是 d → c，c 不能走到 d ✗', 'bad', p.x - 1.5, p.y + 0.8, p.z - 0.7);
    cap('要照箭頭方向走', 'c 不能到 d，因為箭頭是 d → c');
  },
  async (tok, S) => {
    kill(S.xd); paintTrav(S.gv, S.st[snapAt(S.st, 'c → g')]);
    glow(S.gv.vm.g, '#8a1010');
    cap('到 g 被擋住了', 'g 沒有往外的箭頭');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'g 走不下去'), snapAt(S.st, 'g 走不下去'), 0, false, S.on);
    cap('從 g 退回 c', '');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'c 走不下去'), snapAt(S.st, 'f → e'), 500, false, S.on);
    cap('c 也沒路 → 退回 b', 'b 接上 f → e');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'e 走不下去'), snapAt(S.st, 'b 走不下去'), 450, false, S.on);
    cap('一路退回 a', 'a 也沒有新的路了');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, '回不到新點了：另起一棵樹，根 = d'), snapAt(S.st, '回不到新點了：另起一棵樹，根 = d'), 0, false, S.on);
    cap('只好另起一棵樹', '新的根是 d');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'd → h'), snapAt(S.st, 'k → j'), 450, false, S.on);
    cap('從 d 照箭頭走：d → h → l → k → j', '');
  },
  async (tok, S) => {
    const k = S.gv.find('i', 'j'); paintEdge(S.gv.em[k], COL.hot, true);
    cap('到了 j 不能走到 i', '箭頭是 i → j');
  },
  async (tok, S) => {
    await playSnaps(tok, S.gv, S.st, snapAt(S.st, 'j 走不下去'), lastSnap(S.st), 150, false, S.on);
    const roots = S.st[lastSnap(S.st)].roots;
    const comp = {}; let r = -1;
    S.st.forEach((x) => { if (x.msg.startsWith('選') || x.msg.startsWith('回不到')) r++; if (x.cur && comp[x.cur] === undefined) comp[x.cur] = r; });
    DIRG.V.forEach((v) => vcol(S.gv, v, COMP[comp[v] % COMP.length]));
    set(S.path, 'spanning forest：' + roots.length + ' 棵樹（根 ' + roots.join('、') + '）✓');
    cap('最後一棵只有 i 自己', '三棵樹合起來是 spanning forest');
  },
  async (tok, S) => {
    S.web = tag('🕸 web spider：從一個網頁沿著連結（有向邊）一路探索', 'note', 0, 0.3, -3.2);
    cap('應用：搜尋引擎建索引', 'web spider（crawler）有系統地探索整個 Web');
  },
]);

scene('g8g-st-ex1', '練習：拿掉 circuit 上的邊（a–b–d、b–c–e）', [
  async (tok, S) => {
    S.gv = drawGraph(EXR, { s: 1, ox: 1.2, oz: 0 });
    S.cnt = tag('5 個頂點、6 條邊', 'ptr alt', 1.2, 0.3, 2.8);
    cap('練習：拿掉 simple circuit 上的邊', '找出 spanning tree');
  },
  async (tok, S) => {
    flash(S.gv, ['a', 'b', 'd']); flash(S.gv, ['b', 'c', 'e'], COL.orange);
    cap('兩個 simple circuit：a–b–d–a、b–c–e–b', '');
  },
  async (tok, S) => {
    await removeEdge(tok, EG(S.gv, 'a', 'b'));
    set(S.cnt, '5 個頂點、5 條邊');
    cap('{a,b} 在 circuit 上，拿掉它', '拿 {a,d} 也可以');
  },
  async (tok, S) => {
    await removeEdge(tok, EG(S.gv, 'b', 'c'));
    calm(S.gv); set(S.cnt, '5 個頂點、4 條邊');
    cap('{b,c} 也在 circuit 上，拿掉', '');
  },
  async (tok, S) => {
    const ok = treeCheck(S.gv);
    S.gv.em.forEach((e) => { if (e.g.visible) paintEdge(e, COL.tree, true); });
    EXR.V.forEach((v) => vcol(S.gv, v, COL.vis));
    set(S.cnt, '4 條邊 = 5 − 1、沒有 circuit ' + (ok ? '✓' : '✗'));
    cap('沒有 simple circuit 了', '兩個 circuit 各拿一條邊就夠');
  },
  async (tok, S) => {
    cap('spanning tree：a–d–b–e–c', '到 c 之後回不到 b');
  },
]);

scene('g8g-st-ex2', '練習：很多 circuit 的圖（只列老師唸的邊）', [
  async (tok, S) => {
    S.B = board(-6.4, -3.0, 0.7);
    S.B.add('另一題：拿掉 simple circuit 上的邊 → spanning tree');
    tag('原圖畫面看不到，這裡只列老師唸到的', 'idx', 0, 0.3, 3.2);
    cap('另一題：一樣拿掉 circuit 上的邊', '');
  },
  async (tok, S) => {
    S.B.add('circuit 很多：a–h–i…、b–i–j…、c–j–d…', 'say');
    cap('這張圖有很多 simple circuit', '');
  },
  async (tok, S) => {
    S.B.add('拿掉：{a,i}、{b,i}、{b,j}、{c,d} …');
    cap('每個 circuit 拿掉一條邊', '');
  },
  async (tok, S) => {
    S.B.add('再拿掉：{i,j}、{f,j}、{f,i}、{e,j} …');
    cap('下面的 circuit 也一樣處理', '');
  },
  async (tok, S) => {
    S.B.add('檢查：頂點一個都沒少 ✓、沒有 simple circuit ✓', 'good');
    cap('拿完要檢查', '頂點都在、沒有 circuit');
  },
]);

scene('g8g-st-tri', '練習：三角形的所有 spanning tree', [
  async (tok, S) => {
    S.K3 = parseG({ a: [0, -1.3], b: [-1.3, 1], c: [1.3, 1] }, 'a-b b-c c-a');
    S.big = drawGraph(S.K3, { s: 1, ox: 0, oz: -1.4 });
    cap('畫出這張 simple graph 的所有 spanning tree', '三角形 a、b、c');
  },
  async (tok, S) => {
    flash(S.big, ['a', 'b', 'c']);
    cap('只有一個 circuit：a–b–c–a', '');
  },
  async (tok, S) => {
    // the tree that leaves out edge {u,v}, drawn in slot k
    S.add = (u, v, k) => {
      const T = spanningTrees(S.K3).find((t) => { const m = S.K3.E.find((e, i) => !t.includes(i)); return (m.u === u && m.v === v) || (m.u === v && m.v === u); });
      if (!T) throw new Error('no tree without ' + u + v);
      const gv = drawGraph(S.K3, { s: 0.75, ox: -4 + k * 4, oz: 1.6 });
      gv.em.forEach((e, i) => paintEdge(e, T.includes(i) ? COL.tree : COL.dim, T.includes(i), T.includes(i)));
      tag('拿掉 {' + u + ',' + v + '}', 'idx', -4 + k * 4, 0.3, 3.2);
    };
    S.add('a', 'b', 0); cap('拿掉 {a,b}', '第 1 棵');
  },
  async (tok, S) => { S.add('a', 'c', 1); cap('或拿掉 {a,c}', '第 2 棵'); },
  async (tok, S) => { S.add('b', 'c', 2); cap('或拿掉 {b,c}', '第 3 棵'); },
  async (tok, S) => {
    const n = spanningTrees(S.K3).length;
    tag('共 ' + n + ' 棵 spanning tree ' + (n === 3 ? '✓' : '✗'), 'good', 0, 0.3, -3.3);
    cap('三種都是 spanning tree', '起點不會再繞回同一點');
  },
]);

scene('g8g-st-ex-a', '練習：指定 a 當根的 DFS', [
  async (tok, S) => {
    S.B = board(-6.4, -3.0, 0.7);
    S.B.add('題目：用 DFS 產生 spanning tree，以 a 為根');
    tag('原圖畫面看不到；下面只是流程示意', 'idx', 1.9, 0.3, 3.3);
    cap('練習：DFS，指定 a 當根', '');
  },
  async (tok, S) => {
    S.B.add('根很重要：根不同，spanning tree 就不同', 'say');
    cap('一定要照題目選 a', '根換了，路徑和樹都會不同');
  },
  async (tok, S) => {
    S.B.add('從 a 出發，能走多遠走多遠，先不 backtrack');
    S.chips = ['a', 'b', 'c', '…', 'h', '…', 'l'].map((t, i) => cube(t, COL.vis, [0.7, 0.4, 0.7], -1.4 + i * 1.1, 0.3, 1.4)); // right of the board's strip
    cap('樹用粗線畫出來', '從 a 開始，盡量往下走');
  },
  async (tok, S) => {
    S.B.add('每一步選「字母順序最前面、還沒用過」的鄰居');
    cap('每一步選字母最前面、還沒用過的點', '');
  },
  async (tok, S) => {
    glow(S.chips[6], '#8a1010'); glow(S.chips[4], '#8a6400');
    S.B.add('路徑走到 l 卡住 → backtrack 到 h');
    cap('走到 l 卡住', '退回 h');
  },
  async (tok, S) => {
    S.B.add('從 h 一路走到 n，不用再 backtrack');
    cap('從 h 再形成一條路徑一路到 n', '');
  },
  async (tok, S) => {
    S.B.add('最後退回 i，接上 m → 完成', 'good');
    cap('最後退回 i 接上 m', '所有頂點都進樹');
  },
]);

// ════════ Erea1QASjXY（Graph Coloring） ════════
// 地圖照本章 MAP_CELLS／MAPD（邊 A–B A–C B–C B–E C–D C–E D–E，照影片口述）。影片的 greedy 塗出 4 色、
// P(G,λ) 寫 λ(λ−1)(λ−2)(λ−1)(λ−3)；照這些相鄰關係其實 3 色就夠、P = λ(λ−1)(λ−2)³ —— 場景兩者都演、標出錯在哪。
const mapCtr = (r, ox, oz, cs) => { const cells = MAP_CELLS[r]; const c = cells.reduce((s, [a, b]) => [s[0] + a / cells.length, s[1] + b / cells.length], [0, 0]); return [ox + (c[0] - 1) * cs, oz + (c[1] - 1) * cs]; };
const MAPADJ = (u, v) => MAPD.E.some((e) => (e.u === u && e.v === v) || (e.u === v && e.v === u));
const proper = (G, col) => G.E.every((e) => col[e.u] !== col[e.v]);
scene('g8g-col-map', '地圖著色：相鄰國家不同色', [
  async (tok, S) => {
    S.t = tag('Graph coloring', 'note', 0, 0.3, -3.6);
    cap('這部影片：graph coloring', '');
  },
  async (tok, S) => {
    S.ox = 0; S.oz = -0.2; S.cs = 1.8;
    S.map = drawMap(S.ox, S.oz, S.cs);
    S.x = {};
    S.mark = (r, t, c = 'bad') => { if (S.x[r]) kill(S.x[r]); const [x, z] = mapCtr(r, S.ox, S.oz, S.cs); S.x[r] = tag(t, c, x, 0.9, z + 0.55); };
    tag('虛構大陸（示意）', 'idx', 3.6, 0.3, -2.4);
    cap('虛構的大陸分成 A～E 幾個國家', '相鄰國家的國旗不想同色');
  },
  async (tok, S) => {
    set(S.t, '最少要幾種顏色？');
    cap('做旗子的人想省錢', '顏色越少越好：最少要幾色？');
  },
  async (tok, S) => { S.col = { A: 0 }; S.map.paint('A', CC[0]); cap('先讓 A 用黃色', ''); },
  async (tok, S) => { S.mark('B', '不能黃'); S.mark('C', '不能黃'); cap('B、C 都和 A 相鄰', '所以不能用黃色'); },
  async (tok, S) => { S.col.D = 0; S.map.paint('D', CC[0]); cap('D 沒有碰到 A', 'D 也可以用黃色'); },
  async (tok, S) => { S.mark('E', '不能黃'); cap('E 碰到 D（黃）', 'E 不能黃'); },
  async (tok, S) => { kill(S.x.B); delete S.x.B; S.col.B = 1; S.map.paint('B', CC[1]); cap('換一個顏色：B 用綠色', ''); },
  async (tok, S) => { S.mark('C', '不能黃、綠'); S.mark('E', '不能黃、綠'); cap('C、E 都碰到 B', '不能用綠色'); },
  async (tok, S) => { kill(S.x.C); delete S.x.C; S.col.C = 2; S.map.paint('C', CC[2]); cap('再找新顏色：C 用藍色', ''); },
  async (tok, S) => { S.mark('E', 'B 綠、C 藍、D 黃 都碰到'); cap('E 碰到 B、C、D', '綠、藍、黃都不能用'); },
  async (tok, S) => { kill(S.x.E); S.col.E = 3; S.map.paint('E', CC[3]); cap('E 只好用第 4 色（紫）', ''); },
  async (tok, S) => {
    const ok = proper(MAPD, S.col), k = new Set(Object.values(S.col)).size;
    set(S.t, '影片：這樣塗用了 ' + k + ' 色、相鄰都不同 ' + (ok ? '✓' : '✗'));
    cap('影片的結論：最少要 4 色', '（等一下會看到其實 3 色就夠）');
  },
]);

scene('g8g-col-dual', '對偶圖：區域變頂點', [
  async (tok, S) => {
    S.map = drawMap(-4.2, 0, 1.3);
    S.gv = drawGraph(MAPD, { s: 1.15, ox: 2.8, oz: 0 });
    S.gv.em.forEach((e) => paintEdge(e, COL.edge, false, false));
    S.info = tag('dual graph：國家 → 頂點', 'ptr alt', 2.8, 0.3, -3.0);
    cap('另一個看法：dual graph', '每個區域變成一個頂點');
  },
  async (tok, S) => { ['B', 'C'].forEach((v) => paintEdge(EG(S.gv, 'A', v), COL.edge, false)); set(S.info, '相鄰就連一條邊'); cap('兩國相鄰就連一條邊', 'A 鄰 B、C'); },
  async (tok, S) => { ['C', 'E'].forEach((v) => paintEdge(EG(S.gv, 'B', v), COL.edge, false)); cap('B 鄰 C、E', ''); },
  async (tok, S) => { ['D', 'E'].forEach((v) => paintEdge(EG(S.gv, 'C', v), COL.edge, false)); cap('C 鄰 D、E', ''); },
  async (tok, S) => {
    paintEdge(EG(S.gv, 'D', 'E'), COL.edge, false);
    const n = liveIdx(S.gv).length;
    set(S.info, '共 ' + n + ' 條邊 ' + (n === 7 ? '✓' : '✗'));
    cap('D 鄰 E', '');
  },
  async (tok, S) => { cap('這張圖完全代表地圖上的相鄰關係', ''); },
  async (tok, S) => { set(S.info, 'graph coloring：相鄰頂點不同色，最少幾色？'); cap('graph coloring', '相鄰（有邊）的頂點不能同色'); },
  async (tok, S) => { S.col = { A: 0, D: 0 }; vcol(S.gv, 'A', CC[0]); vcol(S.gv, 'D', CC[0]); cap('A 黃 → B、C 不能黃', 'D 可以黃'); },
  async (tok, S) => { S.col.B = 1; vcol(S.gv, 'B', CC[1]); cap('B 綠', 'C、E 都碰到 B，不能綠'); },
  async (tok, S) => {
    S.col.C = 2; S.col.E = 3; vcol(S.gv, 'C', CC[2]); await wt(tok, 500); vcol(S.gv, 'E', CC[3]);
    set(S.info, '跟地圖一樣：4 色、相鄰都不同 ' + (proper(MAPD, S.col) ? '✓' : '✗'));
    cap('C 藍，E 只能紫', '跟地圖上做的一模一樣');
  },
  async (tok, S) => {
    const better = { C: 0, E: 1, B: 2, D: 2, A: 1 };
    for (const r of ['C', 'E', 'B', 'D', 'A']) { vcol(S.gv, r, CC[better[r]]); S.map.paint(r, CC[better[r]]); await wt(tok, 300); }
    const ok = proper(MAPD, better), x = chi(colorClasses(MAPD));
    set(S.info, '補充：B、D 不相鄰可同色 → 3 色 ' + (ok ? '✓' : '✗') + '，χ = ' + x);
    cap('用圖來看比較容易', '補充：其實 3 色就夠（影片的塗法不是最少）');
  },
]);

scene('g8g-col-bip', '二分圖：兩色就夠', [
  async (tok, S) => {
    S.t = tag('之前講 bipartite graph 時就碰過著色', 'note', 0, 0.3, -3.4);
    cap('其實之前學過一點著色', '在 bipartite graph 那裡');
  },
  async (tok, S) => {
    S.G = parseG(ringP(['A', 'B', 'C', 'D', 'E', 'F'], 2.4), 'A-B B-C C-D D-E E-F F-A');
    S.gv = drawGraph(S.G);
    tag('C₆', 'ptr', 3.4, 0.3, -2.2);
    cap('如果一張圖只用兩色就塗得完…', '例如 C₆');
  },
  async (tok, S) => {
    for (const [v, c] of [['A', 0], ['B', 2], ['C', 0], ['D', 2], ['E', 0], ['F', 2]]) { vcol(S.gv, v, CC[c]); await wt(tok, 250); }
    cap('C₆ 可以只用兩色', 'A、C、E 一色；B、D、F 一色');
  },
  async (tok, S) => {
    const side = { A: [-2.8, -2], C: [-2.8, 0], E: [-2.8, 2], B: [2.8, -2], D: [2.8, 0], F: [2.8, 2] };
    S.gv.em.forEach((e) => { e.g.visible = false; });
    S.side = side;
    for (const v of S.G.V) move(S.gv.vm[v], side[v][0], 0.3, side[v][1]);
    cap('重畫成 bipartite graph', 'A、C、E 一邊；B、D、F 一邊');
  },
  async (tok, S) => {
    for (const e of S.G.E) { edgeMesh(V3(S.side[e.u][0], 0.3, S.side[e.u][1]), V3(S.side[e.v][0], 0.3, S.side[e.v][1])); await wt(tok, 220); }
    cap('A–B、B–C、C–D、D–E、E–F、F–A', '每條邊都跨兩邊');
  },
  async (tok, S) => {
    const L = new Set(['A', 'C', 'E']);
    const ok = S.G.E.every((e) => L.has(e.u) !== L.has(e.v));
    set(S.t, '同一邊的點彼此都沒有邊 ' + (ok ? '✓' : '✗') + ' → bipartite');
    cap('A、C、E 彼此不相連；B、D、F 也是', '所以是 bipartite graph');
  },
  async (tok, S) => {
    lab.clear();
    S.T = parseG({ A: [0, -1.6], B: [-1.8, 1.3], C: [1.8, 1.3] }, 'A-B B-C C-A');
    S.tv = drawGraph(S.T); vcol(S.tv, 'A', CC[0]);
    S.t = tag('三角形 A、B、C', 'note', 0, 0.3, -3.2);
    cap('三角形 ABC：A 黃', 'B、C 都不能黃');
  },
  async (tok, S) => { vcol(S.tv, 'B', CC[2]); cap('B 藍', 'C 不能藍'); },
  async (tok, S) => {
    vcol(S.tv, 'C', CC[3]);
    const x = chi(colorClasses(S.T));
    set(S.t, '三角形要 ' + x + ' 色 → 不是 bipartite ' + (x === 3 ? '✓' : '✗'));
    cap('C 只能第三色', '要 3 色 → 不是二分圖');
  },
]);

scene('g8g-col-kn', 'Chromatic number 與完全圖 Kₙ', [
  async (tok, S) => {
    S.B = board(-6.6, -3.5);
    S.B.add('chromatic number χ(G)：塗好 G 最少要幾色');
    cap('最少需要的顏色數有特別的名字', 'chromatic number，記作 χ(G)');
  },
  async (tok, S) => { S.B.add('bipartite graph（有邊）：χ(G) = 2'); cap('任何 bipartite graph', 'χ(G) = 2'); },
  async (tok, S) => {
    S.Ks = [2, 3, 4].map((n) => parseG(ringP('ABCD'.slice(0, n).split(''), 1.25, n === 2 ? 0 : Math.PI / 2), n === 2 ? 'A-B' : n === 3 ? 'A-B B-C C-A' : 'A-B A-C A-D B-C B-D C-D'));
    S.gvs = S.Ks.map((G, k) => drawGraph(G, { ox: -2.2 + k * 3.4, oz: 0.6 }));
    S.Ks.forEach((G, k) => tag('K' + G.V.length, 'ptr', -2.2 + k * 3.4, 0.3, 2.6));
    cap('完全圖 K₂、K₃、K₄', '每個頂點都和其他所有頂點相連');
  },
  async (tok, S) => { cap('找出每個的 chromatic number', '再看能不能推廣'); },
  async (tok, S) => {
    S.paint = async (k) => { const G = S.Ks[k]; for (let i = 0; i < G.V.length; i++) { vcol(S.gvs[k], G.V[i], CC[i]); await wt(tok, 300); } const x = chi(colorClasses(G)); tag('χ = ' + x + (x === G.V.length ? ' ✓' : ' ✗'), 'good', -2.2 + k * 3.4, 0.3, -1.4); };
    await S.paint(0); cap('K₂：兩點相連 → 要 2 色', '');
  },
  async (tok, S) => { await S.paint(1); cap('K₃：B 碰到 A、C 碰到 A 和 B', '要 3 色'); },
  async (tok, S) => { await S.paint(2); cap('K₄ 也一樣', 'χ(K₄) = 4'); },
  async (tok, S) => { S.gvs[2].em.forEach((e) => paintEdge(e, COL.hot, true)); cap('原因：每個頂點都和其他所有頂點相連', '所以每個點都要自己的顏色'); },
  async (tok, S) => { S.gvs[2].em.forEach((e) => paintEdge(e, COL.edge, false)); S.B.add('χ(Kₙ) = n', 'good'); cap('推廣：χ(Kₙ) = n', ''); },
]);

scene('g8g-col-cn', 'Cycle graph 的 chromatic number', [
  async (tok, S) => {
    S.Cs = [3, 4, 5, 6].map((n) => { const nm = 'ABCDEF'.slice(0, n).split(''); return parseG(ringP(nm, 1.15), nm.map((v, i) => v + '-' + nm[(i + 1) % n]).join(' ')); });
    S.gvs = S.Cs.map((G, k) => drawGraph(G, { ox: -4.8 + k * 3.2, s: 1, size: [0.5, 0.45, 0.5], gap: 0.3 }));
    S.Cs.forEach((G, k) => tag('C' + G.V.length, 'ptr', -4.8 + k * 3.2, 0.3, 2));
    cap('cycle graph：每個點連到下一個，最後繞回起點', '');
  },
  async (tok, S) => {
    S.res = (k) => { const x = chi(colorClasses(S.Cs[k])); tag('χ = ' + x + ' ✓', 'good', -4.8 + k * 3.2, 0.3, -1.9); };
    cap('找 C₃、C₄、C₅、C₆ 的 chromatic number', '再推廣到 Cₙ');
  },
  async (tok, S) => { for (const [i, c] of [[0, 0], [1, 2], [2, 3]]) { vcol(S.gvs[0], S.Cs[0].V[i], CC[c]); await wt(tok, 300); } S.res(0); cap('C₃ 其實就是 K₃', '要 3 色'); },
  async (tok, S) => { vcol(S.gvs[1], 'A', CC[0]); await wt(tok, 300); vcol(S.gvs[1], 'B', CC[2]); cap('C₄：A 一色，B 要不同色', ''); },
  async (tok, S) => { vcol(S.gvs[1], 'C', CC[0]); await wt(tok, 300); vcol(S.gvs[1], 'D', CC[2]); cap('C 不碰 A → 和 A 同色', 'D 不碰 B → 和 B 同色'); },
  async (tok, S) => { S.res(1); cap('χ(C₄) = 2', ''); },
  async (tok, S) => { vcol(S.gvs[2], 'A', CC[0]); vcol(S.gvs[2], 'C', CC[0]); cap('C₅：A、C 用同一色', 'B、D 不能用；E 碰 A 也不能'); },
  async (tok, S) => { vcol(S.gvs[2], 'B', CC[2]); vcol(S.gvs[2], 'D', CC[2]); cap('B 換一色，D 也可以用它', ''); },
  async (tok, S) => { vcol(S.gvs[2], 'E', CC[3]); cap('E 同時碰到黃和藍', '只好用第三色'); },
  async (tok, S) => { S.res(2); cap('χ(C₅) = 3', ''); },
  async (tok, S) => { ['A', 'C', 'E'].forEach((v) => vcol(S.gvs[3], v, CC[0])); cap('C₆：A、C、E 彼此不相連', '用同一色'); },
  async (tok, S) => { ['B', 'D', 'F'].forEach((v) => vcol(S.gvs[3], v, CC[2])); cap('B、D、F 用另一色', ''); },
  async (tok, S) => { S.res(3); cap('χ(C₆) = 2', '就是剛才那個 bipartite graph'); },
  async (tok, S) => { S.g1 = tag('n 偶數：χ(Cₙ) = 2', 'good', -1.6, 0.3, -3.3); cap('偶數個頂點：剛好分成兩色', ''); },
  async (tok, S) => { tag('n 奇數：χ(Cₙ) = 3', 'good', 2.2, 0.3, -3.3); cap('奇數個頂點：多出的那一點碰到兩種顏色', '要 3 色'); },
]);

scene('g8g-col-poly', 'Chromatic polynomial：地圖例（含勘誤）', [
  async (tok, S) => {
    S.B = board(0.9, -3.4);
    S.B.add('這部分課本沒有（影片補充）', 'say');
    cap('換個問題（課本沒有）', '');
  },
  async (tok, S) => { S.B.add('chromatic polynomial P(G,λ)：用 λ 色有幾種塗法'); cap('不是問最少幾色', '而是給 λ 種顏色，有幾種塗法'); },
  async (tok, S) => {
    S.gv = drawGraph(MAPD, { s: 1.25, ox: -3.6, oz: 0.3 });
    S.tl = {};
    S.lab = (v, s) => { const p = S.gv.pos(v); if (S.tl[v]) set(S.tl[v], s); else S.tl[v] = tag(s, 'ptr alt', p.x, p.y + 0.85, p.z); vcol(S.gv, v, COL.vis); };
    cap('回到虛構大陸的 dual graph', '');
  },
  async (tok, S) => { S.lab('A', 'λ'); cap('A：λ 種顏色都可以', ''); },
  async (tok, S) => { S.lab('B', 'λ−1'); cap('B：除了 A 用掉的那色', 'λ − 1 種'); },
  async (tok, S) => { S.lab('C', 'λ−2'); cap('C 碰到 A 和 B', 'λ − 2 種'); },
  async (tok, S) => { S.lab('D', 'λ−1'); cap('D 在已塗的 A、B、C 中只碰到 C', 'λ − 1 種（E 還沒塗）'); },
  async (tok, S) => { S.lab('E', 'λ−3'); cap('E 碰到 B、C、D', '影片寫 λ − 3'); },
  async (tok, S) => { S.B.add('影片：P = λ(λ−1)(λ−2)(λ−1)(λ−3)'); cap('相乘就是影片的 chromatic polynomial', '不用展開'); },
  async (tok, S) => { S.B.add('用法：5 色有幾種塗法？→ λ = 5'); cap('怎麼用：5 色有幾種塗法？', ''); },
  async (tok, S) => {
    S.vals = [5, 4, 3, 4, 2];
    for (let i = 0; i < 5; i++) { cube(S.vals[i], CC[i], [0.8, 0.6, 0.8], -5.6 + i * 1.0, 0.3, 3.4, 2.5); await wt(tok, 250); } // under the map, clear of the board on the right
    cap('λ 換成 5：5、4、3、4、2', '');
  },
  async (tok, S) => {
    const p = S.vals.reduce((a, b) => a * b, 1);
    S.B.add('5·4·3·4·2 = ' + p + '（影片的答案）');
    cap('全部乘起來', '5 × 4 × 3 × 4 × 2 = ' + p);
  },
  async (tok, S) => {
    vcol(S.gv, 'B', COL.hot); vcol(S.gv, 'D', COL.hot);
    const a = colorClasses(MAPD);
    S.B.add('勘誤：B、D 不相鄰、可能同色 → E 不一定少 3 色', 'bad');
    S.B.add('正確：P = λ(λ−1)(λ−2)³，P(G,5) = ' + chromP(a, 5) + (chromP(a, 5) === 5 * 4 * 27 ? ' ✓' : ' ✗'), 'good');
    cap('道理：每一步的選擇數不受前面影響才能相乘', '補充：B、D 可同色，影片這裡算錯');
  },
]);

scene('g8g-col-k4', '練習：P(G,λ) 與 P(G,6)', [
  async (tok, S) => {
    S.gv = drawGraph(K4X, { s: 0.9, ox: -2.6, oz: 0.2 });
    S.B = board(1.2, -3.2);
    S.B.add('求 P(G,λ)，再算 P(G,6)');
    cap('最後一題：chromatic polynomial 與 P(G,6)', '');
  },
  async (tok, S) => { S.l = (v, s) => { const p = S.gv.pos(v); tag(s, 'ptr alt', p.x, p.y + 0.85, p.z); vcol(S.gv, v, COL.vis); }; S.l('A', 'λ'); cap('從一個頂點開始：A 標 λ', ''); },
  async (tok, S) => { S.l('B', 'λ−1'); cap('B 不能用 A 的顏色', 'λ − 1'); },
  async (tok, S) => { S.l('C', 'λ−2'); cap('C：λ − 2', '（場景用 A、B、C、D 兩兩相鄰的 K₄）'); },
  async (tok, S) => { S.l('D', 'λ−3'); cap('D 和 A、B、C 都相鄰', 'λ − 3'); },
  async (tok, S) => { S.B.add('P(G,λ) = λ(λ−1)(λ−2)(λ−3)'); cap('相乘得到 P(G,λ)', ''); },
  async (tok, S) => { S.B.add('只要多項式 → λ 保留；題目要 λ = 6', 'say'); cap('如果只問多項式，λ 留著就好', '題目要的是 6 色'); },
  async (tok, S) => {
    S.v = [6, 5, 4, 3];
    for (let i = 0; i < 4; i++) { cube(S.v[i], CC[i], [0.8, 0.6, 0.8], 1.8 + i * 1.1, 0.3, 1.4, 2.5); await wt(tok, 250); }
    cap('λ 換成 6', '6 × 5 × 4 × 3');
  },
  async (tok, S) => {
    const p = chromP(colorClasses(K4X), 6);
    S.B.add('P(G,6) = 6·5·4·3 = ' + p + (p === 360 ? ' ✓' : ' ✗'), 'good');
    cap('30 × 4 = 120，120 × 3 = 360', '');
  },
]);

// ════════ P2FRYshQ57s（交大 易志偉 Lec24：最短路徑、Dijkstra、Euler、Hamilton、連通） ════════
// 臺灣路網是老師「隨便亂畫」的示意；權重照老師說的：北–桃 30、北–宜 50、桃–竹 70、桃–宜 70、宜–花 100、
// 宜–投 70、竹–中 100、竹–投 10、投–中 40、花–投 150。A–F 圖、12 點圖：由老師算的每一步反推出邊與權重，位置是示意。
const TW = parseG({ 臺北: [2.6, -2.9], 桃園: [0.3, -2.2], 宜蘭: [4.4, -1.0], 新竹: [-1.4, -0.6], 花蓮: [4.4, 2.5], 南投: [1.3, 1.3], 臺中: [-2.0, 2.3] },
  '臺北-桃園:30 臺北-宜蘭:50 桃園-新竹:70 桃園-宜蘭:70 宜蘭-花蓮:100 宜蘭-南投:70 新竹-臺中:100 新竹-南投:10 南投-臺中:40 花蓮-南投:150');
const DJ = parseG({ A: [-4, -0.5], B: [-1, -2.6], C: [-3.5, 2.5], D: [4, -1], E: [-1, 0.2], F: [1.8, -0.6] }, 'A-B:1 A-C:4 B-D:3 B-E:3 C-E:3 C-D:10 D-F:5 E-F:1');
const V12 = parseG({ V1: [-4.6, -2.3], V2: [-1.6, -2.3], V3: [1.4, -2.3], V8: [4.6, -2.3], V4: [-4.6, 0], V6: [-1.6, 0], V7: [1.4, 0], V10: [4.6, 0.2], V5: [-3.1, 2.4], V9: [0, 2.5], V11: [3.0, 2.8], V12: [5.2, 2.0] },
  'V1-V2:1 V1-V4:3 V2-V3:2 V2-V6:4 V4-V5:3 V3-V8:3 V6-V5:1 V6-V7:1 V7-V8:2 V7-V10:3 V5-V9:2 V9-V10:6 V9-V11:5 V10-V12:1 V12-V11:1');
const wl = (gv, u, v, on = true) => { const e = EG(gv, u, v); if (e.wl) showL(e.wl, on); };
const twMap = (o = {}) => { const gv = drawGraph(TW, { s: o.s ?? 0.95, ox: o.ox ?? 1.4, oz: o.oz ?? 0.2, size: [0.95, 0.4, 0.62] }); gv.em.forEach((e) => showL(e.wl, false)); tag('路網（示意）', 'idx', (o.ox ?? 1.4) + 3.2, 0.3, 3.4); return gv; };
// Dijkstra 狀態：L（目前已知最短距離）、S（已確定）、prev（從哪裡來）
function djState(G, gv, opt = {}) {
  const D = { L: {}, S: new Set(), prev: {}, lab: {}, red: [] };
  G.V.forEach((v) => { D.L[v] = Infinity; const p = gv.pos(v); D.lab[v] = tag('', 'idx', p.x + (opt.dx ?? 0), p.y + 0.75, p.z - (opt.dz ?? 0.55)); });
  D.show = (v) => { set(D.lab[v], (opt.pre ?? 'L=') + fmtD(D.L[v])); setc(D.lab[v], D.S.has(v) ? 'good' : D.L[v] === Infinity ? 'idx' : 'ptr alt'); };
  D.showAll = () => G.V.forEach(D.show);
  D.calm = () => { D.red.forEach((k) => { const e = gv.em[k]; const tree = G.V.some((v) => D.S.has(v) && D.prev[v] && gv.find(D.prev[v], v) === k); paintEdge(e, tree ? COL.tree : COL.edge, tree); }); D.red = []; };
  D.pick = (u) => {
    D.calm();
    const rest = G.V.filter((v) => !D.S.has(v)), m = Math.min(...rest.map((v) => D.L[v]));
    if (D.L[u] !== m) throw new Error('Dijkstra pick ' + u + ' is not the minimum');
    D.S.add(u); vcol(gv, u, COL.vis); D.show(u);
    if (D.prev[u]) paintEdge(gv.em[gv.find(D.prev[u], u)], COL.tree, true);
    return m;
  };
  D.relax = (u, v) => {
    const k = gv.find(u, v); if (k < 0) throw new Error('no edge ' + u + '-' + v);
    const w = G.E[k].w, nd = D.L[u] + w, old = D.L[v], up = nd < old;
    paintEdge(gv.em[k], COL.hot, true); D.red.push(k);
    if (up) { D.L[v] = nd; D.prev[v] = u; D.show(v); }
    return u + '→' + v + '：' + D.L[u] + ' + ' + w + ' = ' + nd + (up ? ' < ' + fmtD(old) + ' → 更新' : ' ≥ ' + fmtD(old) + ' → 不變');
  };
  D.path = (t) => { const p = [t]; while (D.prev[p[0]]) p.unshift(D.prev[p[0]]); return p; };
  D.pathLen = (p) => p.slice(1).reduce((s, v, i) => s + G.E[gv.find(p[i], v)].w, 0);
  return D;
}

scene('g8g-tw-roads', '從路網說起', [
  async (tok, S) => {
    S.gv = twMap();
    S.gv.em.forEach((e) => { e.g.visible = false; });
    cap('用距離來想：臺北、桃園、新竹、宜蘭…', '');
  },
  async (tok, S) => { for (const e of S.gv.em) { e.g.visible = true; await wt(tok, 120); } cap('把路網連起來', '老師說是隨便畫的'); },
  async (tok, S) => { cap('路網裡每一條路都有它的距離', ''); },
  async (tok, S) => {
    for (const [u, v] of [['臺北', '宜蘭'], ['宜蘭', '花蓮'], ['花蓮', '南投'], ['南投', '臺中']]) { wl(S.gv, u, v); await wt(tok, 300); }
    cap('例如到宜蘭 50 公里、宜蘭到花蓮 100', '花蓮到南投 150、南投到臺中 40');
  },
  async (tok, S) => { cap('每一條路都有一個長度', '這樣的圖有特別的名字'); },
]);

scene('g8g-tw-wdef', '權重圖的定義', [
  async (tok, S) => {
    S.gv = twMap({ s: 0.78, ox: 2.6 });
    for (const [u, v] of [['臺北', '宜蘭'], ['宜蘭', '花蓮'], ['花蓮', '南投'], ['南投', '臺中']]) wl(S.gv, u, v);
    S.B = board(-6.9, -3.4);
    S.B.add('節點、邊之外，每個邊再給一個數字');
    cap('除了節點和邊', '每一個邊再給它一個數字');
  },
  async (tok, S) => { S.B.add('這個數字叫「權重」（weight）→ 權重圖'); cap('這個數字叫權重', '這種圖叫權重圖（weighted graph）'); },
  async (tok, S) => { S.B.add('G = (V, E, w)：V 節點集合'); cap('定義：G 有節點集合 V', ''); },
  async (tok, S) => { S.B.add('　E 邊集合，再多一個函式 w'); cap('還有邊集合 E', '另外多了一個函式'); },
  async (tok, S) => { S.B.add('　w：E → 實數（就是標在邊上的數字）'); cap('函式把每個邊對應到一個實數', '就是標在邊上的距離'); },
  async (tok, S) => { S.B.add('數字可以是距離、時間、過路費…', 'say'); cap('也可以是錢：高速公路的收費', '只要是生活裡有意義的數字'); },
  async (tok, S) => { S.B.add('今天的新概念：邊上帶數字', 'good'); cap('今天的第一個新概念', '邊上可以帶數字'); },
]);

scene('g8g-tw-sp', '最短路徑問題', [
  async (tok, S) => {
    S.gv = twMap({ s: 0.85, ox: 2.4 });
    S.gv.em.forEach((e) => showL(e.wl, true));
    S.B = board(-6.9, -3.4);
    vcol(S.gv, '臺北', COL.vis, '#8a6400');
    S.B.add('以臺北為起點，規劃行程');
    cap('從臺北出發規劃行程', '到每個地方的最短距離是多少？');
  },
  async (tok, S) => { S.B.add('shortest path 問題：固定一個起點'); cap('這叫 shortest path（最短路徑）問題', '今天固定一個起點：臺北'); },
  async (tok, S) => {
    for (const [u, v] of [['臺北', '桃園'], ['桃園', '新竹'], ['新竹', '臺中']]) paintEdge(EG(S.gv, u, v), COL.blue, true);
    await wt(tok, 900);
    for (const [u, v] of [['臺北', '宜蘭'], ['宜蘭', '南投'], ['南投', '臺中']]) paintEdge(EG(S.gv, u, v), COL.orange, true);
    cap('臺北到臺中，怎麼走都可以', '走西部、或繞宜蘭…');
  },
  async (tok, S) => { S.B.add('問：臺北到臺中最短多遠？怎麼走？'); cap('最短距離是多少？', '要怎麼走？'); },
  async (tok, S) => { calm(S.gv); S.B.add('等一下：Dijkstra 演算法'); cap('等一下介紹 Dijkstra 演算法', '用來算最短路徑'); },
  async (tok, S) => { S.B.add('一次算出臺北到「所有」城市的最短路徑', 'good'); cap('它不只算臺北到臺中', '到桃園、新竹、宜蘭…全部一起算出來'); },
]);

scene('g8g-tw-greedy', '最直覺的方法（greedy）：從臺北往外確定', [
  async (tok, S) => {
    S.gv = twMap({ s: 0.95, ox: 1.6 });
    for (const [u, v] of [['臺北', '宜蘭'], ['宜蘭', '花蓮'], ['花蓮', '南投'], ['南投', '臺中']]) wl(S.gv, u, v);
    S.D = djState(TW, S.gv, { pre: '', dz: 0.6 });
    S.st = tag('', 'ptr alt', -4.6, 0.3, -3.4);
    cap('最直覺的方法通常就是答案', '叫 greedy（貪婪）演算法');
  },
  async (tok, S) => { cap('只看目前看得到的鄰居', '決定到誰最近'); },
  async (tok, S) => {
    for (const [u, v] of [['桃園', '新竹'], ['臺北', '桃園'], ['桃園', '宜蘭'], ['新竹', '臺中']]) { wl(S.gv, u, v); await wt(tok, 300); }
    cap('先隨便填幾個數字', '70、30、70、100');
  },
  async (tok, S) => {
    S.D.L['臺北'] = 0; S.D.pick('臺北');
    S.D.relax('臺北', '桃園'); S.D.relax('臺北', '宜蘭');
    set(S.st, '臺北的鄰居：桃園 30、宜蘭 50');
    cap('從臺北出發，先看附近哪裡最近', '桃園 30 公里、宜蘭 50 公里');
  },
  async (tok, S) => {
    S.D.pick('桃園');
    set(S.st, '桃園 30 確定 ✓（繞別的地方只會更遠）');
    cap('桃園最近：30 公里就確定了', '不直接走的話，繞別的城市只會更遠');
  },
  async (tok, S) => { set(S.st, S.D.relax('桃園', '新竹')); cap('經過桃園再走 70 到新竹', '30 + 70 = 100'); },
  async (tok, S) => { set(S.st, S.D.relax('桃園', '宜蘭')); cap('經過桃園到宜蘭：30 + 70 = 100', '比直接走的 50 遠，不用'); },
  async (tok, S) => { S.D.pick('宜蘭'); set(S.st, '宜蘭 50 確定 ✓'); cap('宜蘭到臺北的距離確定是 50', ''); },
  async (tok, S) => { set(S.st, S.D.relax('宜蘭', '花蓮')); cap('從宜蘭往外看：花蓮', '50 + 100 = 150'); },
  async (tok, S) => { wl(S.gv, '宜蘭', '南投'); set(S.st, S.D.relax('宜蘭', '南投')); cap('宜蘭到南投（隨便寫 70）', '50 + 70 = 120'); },
  async (tok, S) => { S.D.calm(); paintEdge(EG(S.gv, '宜蘭', '桃園'), COL.dim, false); cap('宜蘭也連回桃園', '桃園已經確定是 30，不用再看'); },
  async (tok, S) => {
    const m = S.D.pick('新竹');
    set(S.st, '候選：新竹 100、南投 120、花蓮 150 → 新竹 ' + m + ' 最小 ✓');
    cap('三個城市往外看：新竹 100、南投 120、花蓮 150', '最近的是新竹 → 確定');
  },
  async (tok, S) => { set(S.st, S.D.relax('新竹', '臺中')); cap('從新竹到臺中', '100 + 100 = 200'); },
  async (tok, S) => { wl(S.gv, '新竹', '南投'); set(S.st, S.D.relax('新竹', '南投')); cap('假設新竹到南投 10 公里', '100 + 10 = 110，比 120 短 → 改掉'); },
  async (tok, S) => { const m = S.D.pick('南投'); set(S.st, '候選：臺中 200、南投 110、花蓮 150 → 南投 ' + m + ' ✓'); cap('200、110、150 哪個最短？', '南投 110 確定'); },
  async (tok, S) => { set(S.st, S.D.relax('南投', '花蓮')); cap('南投到花蓮那段 150', '對花蓮沒有用'); },
  async (tok, S) => { set(S.st, S.D.relax('南投', '臺中')); cap('南投到臺中：110 + 40 = 150', '比經過新竹的 200 近 → 改掉'); },
  async (tok, S) => { S.D.pick('花蓮'); set(S.st, '臺中、花蓮都是 150：先挑花蓮 ✓'); cap('臺中和花蓮都是 150', '隨便挑，先挑花蓮'); },
  async (tok, S) => {
    S.D.pick('臺中');
    const want = { 臺北: 0, 桃園: 30, 宜蘭: 50, 新竹: 100, 南投: 110, 花蓮: 150, 臺中: 150 };
    const ok = TW.V.every((v) => S.D.L[v] === want[v]);
    set(S.st, '全部確定：臺中 150 ' + (ok ? '✓' : '✗'));
    cap('花蓮沒連到臺中，臺中不變', '最後臺中 150 確定');
  },
  async (tok, S) => { cap('電腦可以這樣算', '我們等一下會列一個表來追蹤'); },
  async (tok, S) => { set(S.st, '知道臺中 150，可是怎麼走？要能回溯'); cap('知道到臺中 150 公里', '但是要怎麼走？改來改去容易忘記'); },
]);

scene('g8g-dj-path', '權重圖與路徑長度', [
  async (tok, S) => {
    S.B = board(-6.9, -3.5);
    S.B.add('權重圖 weighted graph：G = (V, E, w)');
    cap('權重圖：節點集合、邊集合', '再加一個權重函式');
  },
  async (tok, S) => { S.B.add('w(e)：邊的長度，或開車要花的時間'); cap('權重告訴你每個邊的長度', '或是開車要花多少時間'); },
  async (tok, S) => { S.B.add('這一小節：shortest-path problem'); cap('這一節講 shortest-path problem', ''); },
  async (tok, S) => { S.B.add('w 是函式：每個邊一個數字；距離 → 都是正數', 'say'); cap('w 是一個函式，每個邊一個數字', '距離都是正數；生活中有些可能是負的'); },
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.gv.em.forEach((e) => showL(e.wl, false));
    tag('位置示意', 'idx', 5.4, 0.3, -2.4);
    for (const [u, v] of [['A', 'B'], ['B', 'D'], ['D', 'C']]) { paintEdge(EG(S.gv, u, v), COL.blue, true); await wt(tok, 300); }
    cap('路徑：A 到 B、B 到 D、D 到 C', 'A B D C 就是一條路徑');
  },
  async (tok, S) => { S.B.add('路徑由前後相接的邊組成：{A,B}{B,D}{D,C}'); cap('它由 AB、BD、DC 這三個邊組成', ''); },
  async (tok, S) => { paintEdge(EG(S.gv, 'C', 'A'), COL.orange, true); S.B.add('再加 {C,A} 回到起點 → cycle'); cap('再加上 CA 回到 A', '這叫 cycle'); },
  async (tok, S) => {
    for (const [u, v] of [['A', 'B'], ['B', 'D'], ['D', 'C']]) wl(S.gv, u, v);
    paintEdge(EG(S.gv, 'C', 'A'), COL.edge, false);
    cap('加上權重：A–B 1、B–D 3、D–C 10', '');
  },
]);

scene('g8g-dj-len', '權重函式與路徑長度：A 到 F', [
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.gv.em.forEach((e) => showL(e.wl, false));
    S.B = board(-6.9, -3.5);
    S.B.add('G = (V, E, w)');
    cap('用這張圖當例子', '把 V、E、w 老老實實寫出來');
  },
  async (tok, S) => { S.B.add('V = {A, B, C, D, E, F}'); cap('節點集合', 'V = {A, B, C, D, E, F}'); },
  async (tok, S) => { S.B.add('E = {' + DJ.E.map((e) => e.u + e.v).join(', ') + '}'); cap('邊的集合 E', '共 ' + DJ.E.length + ' 條'); },
  async (tok, S) => { wl(S.gv, 'A', 'B'); S.B.add('w：每個邊一個數字，w({A,B}) = 1'); cap('w 對每個邊給一個數字', 'w({A,B}) = 1'); },
  async (tok, S) => { S.gv.em.forEach((e) => showL(e.wl, true)); S.B.add('w 要完整描述：每個邊都寫出來', 'say'); cap('完整的函式要把每個邊都寫下來', ''); },
  async (tok, S) => { cap('一般直接把權重標在邊上', '看圖就知道'); },
  async (tok, S) => {
    S.p1 = ['A', 'B', 'D', 'F'];
    for (let i = 0; i < 3; i++) { paintEdge(EG(S.gv, S.p1[i], S.p1[i + 1]), COL.blue, true); await wt(tok, 300); }
    cap('路徑：A → B → D → F', '像是從臺北經過三個路段到高雄');
  },
  async (tok, S) => { S.B.add('路徑長度 = 各段權重加總'); cap('路徑的長度', '就是每一段的權重加起來'); },
  async (tok, S) => { S.B.add('w({A,B}) + w({B,D}) + w({D,F})'); cap('A→B、B→D、D→F 三段', ''); },
  async (tok, S) => {
    const L = S.p1.slice(1).reduce((s, v, i) => s + DJ.E[S.gv.find(S.p1[i], v)].w, 0);
    S.B.add('= 1 + 3 + 5 = ' + L + (L === 9 ? ' ✓' : ' ✗'), 'good');
    cap('1 + 3 + 5 = ' + L, '');
  },
  async (tok, S) => {
    calm(S.gv); const p = ['A', 'C', 'D', 'F'];
    p.slice(1).forEach((v, i) => paintEdge(EG(S.gv, p[i], v), COL.orange, true));
    const L = p.slice(1).reduce((s, v, i) => s + DJ.E[S.gv.find(p[i], v)].w, 0);
    S.B.add('A → C → D → F：4 + 10 + 5 = ' + L + (L === 19 ? ' ✓' : ' ✗'));
    cap('也可以 A → C → D → F', '4 + 10 + 5 = 19');
  },
  async (tok, S) => {
    calm(S.gv); const p = ['A', 'B', 'E', 'F'];
    p.slice(1).forEach((v, i) => paintEdge(EG(S.gv, p[i], v), COL.vis, true));
    const L = p.slice(1).reduce((s, v, i) => s + DJ.E[S.gv.find(p[i], v)].w, 0);
    S.B.add('A → B → E → F：1 + 3 + 1 = ' + L + (L === 5 ? ' ✓' : ' ✗'));
    cap('或 A → B → E → F', '1 + 3 + 1 = 5，更短');
  },
  async (tok, S) => { S.B.add('A 到 F 最短的路是哪一條？'); cap('A 到 F 最短的是哪一條？', '印象中就是長度 5 這條'); },
  async (tok, S) => { calm(S.gv); glow(S.gv.vm.D, '#8a6400'); S.B.add('A 到 D 呢？最短多長、怎麼走？'); cap('A 到 D 的最短路徑呢？', ''); },
  async (tok, S) => { glow(S.gv.vm.D, null); S.B.add('= 最短路徑問題：最短、最省時的那一條', 'good'); cap('這就是最短路徑問題', '從各種組合裡找最短的一條'); },
]);

scene('g8g-dj-setup', 'Dijkstra 演算法：起始條件', [
  async (tok, S) => {
    S.B = board(-6.9, -3.5);
    S.B.add('Dijkstra 演算法（有 k：D-i-j-k-s-t-r-a）');
    cap('Dijkstra 演算法', '');
  },
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.B.add('輸入：連通、simple 的權重圖');
    cap('把剛才的想法寫成演算法', '輸入一張連通的權重圖');
  },
  async (tok, S) => { S.B.add('權重要是正的（負的會出問題）', 'say'); cap('權重要是正的', '有負的會有麻煩'); },
  async (tok, S) => { vcol(S.gv, 'A', COL.idle, '#8a6400'); glow(S.gv.vm.F, '#8a1010'); S.B.add('起點 A（臺北），終點 F（高雄）'); cap('A 是起點', '問 A 到 F 的最短路徑'); },
  async (tok, S) => { cap('它其實算了很多', '拿掉一個停止條件，就能算出到所有城市的最短路徑'); },
  async (tok, S) => { S.B.add('到不了的地方：距離先設成 ∞'); cap('剛才：先看臺北到誰最近', '暫時到不了的地方，距離設成無窮大'); },
  async (tok, S) => {
    S.D = djState(DJ, S.gv); S.D.showAll();
    S.B.add('L(v)：目前已知從 A 到 v 的最短距離，一開始全是 ∞');
    cap('函式 L：目前已知的最短距離', '一開始什麼都不知道，全部 ∞');
  },
  async (tok, S) => { S.D.L.A = 0; S.D.show('A'); S.B.add('L(A) = 0：自己到自己'); cap('起點自己到自己', '距離是 0'); },
  async (tok, S) => { S.Sl = tag('S = { }', 'ptr', 2.4, 0.3, 3.2); S.B.add('S = 空集合'); cap('集合 S 一開始是空的', ''); },
  async (tok, S) => { S.B.add('S：已經「確定」最短距離的點', 'say'); cap('S 放的是已經確定最短距離的城市', '就像剛才桃園 30 確定後寫在旁邊'); },
  async (tok, S) => { S.B.add('迴圈：每次挑「不在 S、L 最小」的點'); cap('接著是一個迴圈', '每次挑還沒確定、但距離最近的那一個'); },
  async (tok, S) => { S.tb = tag('表：A B C D E F 各一格 L，外加集合 S', 'idx', 2.4, 0.3, -3.3); cap('我們列一個表來追蹤', '每個點目前的最短距離，和集合 S'); },
  async (tok, S) => { G_all(S, Infinity); cap('第一步：全部先設成 ∞', '（老師口誤說 0，馬上改成無窮大）'); },
  async (tok, S) => { S.D.L.A = 0; S.D.show('A'); cap('第二步：A 自己寫 0', 'S 目前是空的'); },
  async (tok, S) => { S.B.add('如果 F 已經在 S → 停（已找到）'); cap('要找到高雄（F）', '迴圈先檢查 F 在不在 S 裡'); },
  async (tok, S) => { S.B.add('否則：從不在 S 的點裡找 L 最小的 u', 'good'); cap('還沒找到就繼續', '從不在 S 的點裡挑 L 最小的'); },
]);
function G_all(S, x) { DJ.V.forEach((v) => { S.D.L[v] = x; S.D.show(v); }); }

const DJ_UPD = 'if L(u) + w(u,v) < L(v)：L(v) := L(u) + w(u,v)';
scene('g8g-dj-run1', 'Dijkstra 第一圈：確定 A、更新鄰居', [
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.D = djState(DJ, S.gv); S.D.L.A = 0; S.D.showAll();
    S.B = board(-6.9, -3.5);
    S.Sl = tag('S = { }', 'ptr', 2.4, 0.3, 3.2);
    S.st = tag('', 'ptr alt', -4.3, 0.3, 3.2);
    const m = S.D.pick('A'); S.D.S.delete('A'); vcol(S.gv, 'A', COL.idle, '#8a6400'); S.D.show('A');
    S.B.add('不在 S 的點裡 L 最小：u = A（L = ' + m + '）');
    cap('這些距離都還沒確定', '最小的是 A（0），所以 u = A');
  },
  async (tok, S) => { S.D.pick('A'); set(S.Sl, 'S = { A }'); S.B.add('把 u = A 放進 S'); cap('把 A 放進 S', 'A 的最短距離確定了'); },
  async (tok, S) => { S.B.add('接著 update'); cap('接著要 update', ''); },
  async (tok, S) => { glow(S.gv.vm.B, '#8a6400'); glow(S.gv.vm.C, '#8a6400'); cap('從 A 出發，探索相鄰的點', 'A 的鄰居是 B 和 C'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'A', 'B'), COL.hot, true); set(S.st, 'A→B：0 + 1 = 1'); cap('經過 A 再走邊 {A,B}', '0 + 1 = 1'); },
  async (tok, S) => { glow(S.gv.vm.B, null); set(S.st, S.D.relax('A', 'B')); cap('表上原本 B 是 ∞', '新路長度 1，比較短 → 記下 1'); },
  async (tok, S) => { glow(S.gv.vm.C, null); set(S.st, S.D.relax('A', 'C')); cap('A 還有一條長度 4 的邊到 C', '0 + 4 = 4 → C 改成 4'); },
  async (tok, S) => { cap('其他點目前還不知道', '保留 ∞'); },
  async (tok, S) => { S.B.add(DJ_UPD); cap('演算法的這一行', '新路比原本知道的短，就 update'); },
  async (tok, S) => { S.B.add('B：0 + 1 < ∞ ✓　C：0 + 4 < ∞ ✓', 'say'); cap('剛才做的就是這件事', 'B：0+1 < ∞；C：0+4 < ∞'); },
  async (tok, S) => { S.D.calm(); S.B.add('其他點和 A 不相鄰 → 這一圈結束'); cap('其他點和 A 不相鄰', '這一圈迴圈結束'); },
  async (tok, S) => { S.B.add('F 在 S 裡嗎？沒有 → 繼續', 'bad'); cap('檢查：F 在 S 裡嗎？', 'S 只有 A → 繼續做'); },
]);

scene('g8g-dj-run2', 'Dijkstra 後面幾圈：B、D、C、E、F', [
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.D = djState(DJ, S.gv); S.D.L.A = 0; S.D.pick('A'); S.D.relax('A', 'B'); S.D.relax('A', 'C'); S.D.calm(); S.D.showAll();
    S.Sl = tag('S = { A }', 'ptr', 2.4, 0.3, 3.2);
    S.st = tag('', 'ptr alt', -3.4, 0.3, 3.2);
    S.upS = () => set(S.Sl, 'S = { ' + [...S.D.S].join(', ') + ' }');
    cap('已經確定的就不抄了', '目前 B = 1、C = 4');
  },
  async (tok, S) => { S.D.pick('B'); S.upS(); set(S.st, 'B 1、C 4 → 挑最小的 B'); cap('greedy：挑最短的', 'B（1）確定，放進 S'); },
  async (tok, S) => { cap('接著 update', '能不能經過 B 走到別的城市？'); },
  async (tok, S) => { set(S.st, S.D.relax('B', 'D')); cap('B 到 D 長度 3', '1 + 3 = 4 < ∞ → D = 4'); },
  async (tok, S) => { set(S.st, S.D.relax('B', 'E')); cap('B 到 E 也是 3', '1 + 3 = 4 → E = 4'); },
  async (tok, S) => { S.D.calm(); set(S.st, '其他照抄：C 4、D 4、E 4、F ∞'); cap('其他的照抄', ''); },
  async (tok, S) => { S.D.pick('D'); S.upS(); set(S.st, 'C、D、E 都是 4：隨便挑，挑 D'); cap('C、D、E 都是 4', '隨便挑，這次挑 D'); },
  async (tok, S) => { cap('挑哪一個，最後的距離都一樣', '最短的路可能有好幾條'); },
  async (tok, S) => { set(S.st, S.D.relax('D', 'F')); cap('D 確定 4；D 往下到 F', '4 + 5 = 9 < ∞ → F = 9'); },
  async (tok, S) => { set(S.st, S.D.relax('D', 'C')); cap('D 到 C：4 + 10 = 14', '原本 C 已經是 4，14 沒有用'); },
  async (tok, S) => { S.D.calm(); cap('D 出去的路都看過了', '其他不會改變'); },
  async (tok, S) => { S.D.pick('C'); S.upS(); set(S.st, '剩下最小：C（4）'); cap('又回到迴圈：剩下最小的', '這次挑 C（4）'); },
  async (tok, S) => { set(S.st, S.D.relax('C', 'E')); cap('C 連到 E，長度 3', '4 + 3 = 7，E 已經是 4 → 沒用'); },
  async (tok, S) => { S.D.calm(); S.D.pick('E'); S.upS(); set(S.st, '剩 E 4、F 9 → 挑 E'); cap('剩下 4 和 9', '沒得選：E（4）'); },
  async (tok, S) => { set(S.st, S.D.relax('E', 'F')); cap('E 確定 4；經過 E 到 F', '4 + 1 = 5 < 9 → F 改成 5'); },
  async (tok, S) => { S.D.calm(); S.D.pick('F'); S.upS(); set(S.st, 'F（5）確定 → 停'); cap('最後 F 也確定了', ''); },
  async (tok, S) => {
    const want = { A: 0, B: 1, C: 4, D: 4, E: 4, F: 5 };
    const ok = DJ.V.every((v) => S.D.L[v] === want[v]);
    set(S.st, 'A0 B1 C4 D4 E4 F5 ' + (ok ? '✓' : '✗'));
    cap('最短距離：A 0、B 1、C 4', 'D 4、E 4、F 5');
  },
]);

scene('g8g-dj-back', '回溯：最短路徑怎麼走', [
  async (tok, S) => {
    S.gv = drawGraph(DJ, { s: 0.82, ox: 2.4, oz: 0.3 });
    S.D = djState(DJ, S.gv); S.D.L.A = 0;
    for (const [u, vs] of [['A', ['B', 'C']], ['B', ['D', 'E']], ['D', ['F', 'C']], ['C', ['E']], ['E', ['F']], ['F', []]]) { S.D.pick(u); vs.forEach((v) => S.D.relax(u, v)); S.D.calm(); }
    S.D.showAll();
    S.B = board(-6.9, -3.5);
    S.B.add('距離知道了，路要怎麼走？');
    cap('問 A 到 F：路要怎麼走？', '');
  },
  async (tok, S) => { glow(S.gv.vm.F, '#8a1010'); S.B.add('往回找：F 為什麼從 9 變成 5？'); cap('往回退', 'F 的答案為什麼從 9 變成 5？'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'E', 'F'), COL.hot, true); S.B.add('因為確定了 E：4 + 1 = 5 → F 的上一站是 E'); cap('因為知道了 E：4 + 1 = 5', '所以上一站是 E'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'B', 'E'), COL.hot, true); S.B.add('E 為什麼從 ∞ 變成 4？因為取了 B'); cap('E 為什麼是 4？', '因為確定 B 之後，1 + 3 = 4'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'A', 'B'), COL.hot, true); S.B.add('B 為什麼是 1？從 A 過來'); cap('B 為什麼是 1？', '從 A 過來'); },
  async (tok, S) => {
    const p = S.D.path('F'), L = S.D.pathLen(p);
    S.B.add('路徑：' + p.join(' → ') + '，長度 ' + L + (L === S.D.L.F ? ' ✓' : ' ✗'), 'good');
    cap('A → B → E → F 這條路就出來了', '');
  },
  async (tok, S) => { S.B.add('兩個資訊：最短距離，和回溯出來的路', 'say'); cap('表格告訴我們兩件事', '最短距離、以及往回找出的路徑'); },
  async (tok, S) => { calm(S.gv); glow(S.gv.vm.F, null); glow(S.gv.vm.D, '#8a1010'); S.B.add('再一個：D 的最短距離是 4'); cap('再舉一個例子', 'D 的最短距離是 4'); },
  async (tok, S) => {
    const p = S.D.path('D'), L = S.D.pathLen(p);
    p.slice(1).forEach((v, i) => paintEdge(EG(S.gv, p[i], v), COL.hot, true));
    S.B.add('D ← B ← A：' + p.join(' → ') + '，長度 ' + L + (L === 4 ? ' ✓' : ' ✗'), 'good');
    cap('D 的上一站是 B，B 的上一站是 A', 'A → B → D');
  },
]);

scene('g8g-dj12', 'Dijkstra 再一例：12 個節點', [
  async (tok, S) => {
    S.gv = drawGraph(V12, { s: 1, ox: -0.3, oz: 0.2, size: [0.62, 0.4, 0.62] });
    S.gv.em.forEach((e) => { e.g.visible = false; showL(e.wl, false); });
    tag('位置示意；邊與權重由老師的計算反推', 'idx', -3.6, 0.3, 3.6);
    cap('再做一個例子：12 個節點', '');
  },
  async (tok, S) => { cap('叫它們 V1、V2、…、V12', ''); },
  async (tok, S) => { glow(S.gv.vm.V1, '#8a6400'); glow(S.gv.vm.V12, '#8a1010'); cap('從 V1 出發', '找到 V12 的最短路徑'); },
  async (tok, S) => { for (const e of S.gv.em) { e.g.visible = true; showL(e.wl, true); await wt(tok, 90); } cap('數字隨便填', '1、2、3、4…'); },
  async (tok, S) => {
    S.D = djState(V12, S.gv, { dz: 0.62 }); S.D.showAll();
    S.st = tag('', 'ptr alt', -1.0, 0.3, -3.4);
    cap('一樣畫一個表 L', '一開始全部 ∞');
  },
  async (tok, S) => { glow(S.gv.vm.V1, null); S.D.L.V1 = 0; S.D.show('V1'); cap('V1 是出發點', 'L(V1) = 0'); },
  async (tok, S) => { S.D.pick('V1'); set(S.st, S.D.relax('V1', 'V2')); cap('第一圈：V1（0）', '到 V2：0 + 1 = 1'); },
  async (tok, S) => { set(S.st, S.D.relax('V1', 'V4')); cap('到 V4：0 + 3 = 3', '只有這兩個和 V1 相鄰'); },
  async (tok, S) => { S.D.pick('V2'); set(S.st, '最小的是 V2（1）→ 確定'); cap('一圈做完；最短的是 V2', 'V2 = 1 確定'); },
  async (tok, S) => { set(S.st, S.D.relax('V2', 'V3')); cap('從 V2 探索：到 V3', '1 + 2 = 3'); },
  async (tok, S) => { set(S.st, S.D.relax('V2', 'V6')); cap('到 V6：1 + 4 = 5', ''); },
  async (tok, S) => { S.D.pick('V4'); set(S.st, 'V3、V4 都是 3：挑 V4'); cap('兩個 3，隨便挑', '這次挑後面的 V4'); },
  async (tok, S) => { set(S.st, S.D.relax('V4', 'V5')); cap('從 V4 出去：到 V5', '3 + 3 = 6'); },
  async (tok, S) => { S.D.pick('V3'); set(S.st, '最小：V3（3）'); cap('現在最小的是 V3', '確定 3'); },
  async (tok, S) => { set(S.st, S.D.relax('V3', 'V8')); cap('V3 到 V8', '3 + 3 = 6'); },
  async (tok, S) => { S.D.pick('V6'); set(S.st, '下一輪最小：V6（5）'); cap('下一輪最小的是 5', 'V6 放進來'); },
  async (tok, S) => { set(S.st, S.D.relax('V6', 'V5')); cap('V6 到 V5：5 + 1 = 6', '跟原本的 6 一樣，不用改'); },
  async (tok, S) => { set(S.st, S.D.relax('V6', 'V7')); cap('V6 到 V7：5 + 1 = 6', '原本 ∞ → 6'); },
  async (tok, S) => { S.D.pick('V7'); set(S.st, 'V5、V7、V8 都是 6：挑 V7'); cap('V5、V7、V8 都是 6', '挑 V7'); },
  async (tok, S) => { set(S.st, S.D.relax('V7', 'V8')); cap('V7 到 V8：6 + 2 = 8', '沒有比 6 小'); },
  async (tok, S) => { set(S.st, S.D.relax('V7', 'V10')); cap('V7 到 V10：6 + 3 = 9', ''); },
  async (tok, S) => { S.D.pick('V8'); S.D.calm(); set(S.st, 'V5、V8 一樣：挑 V8，沒有新鄰居 → 照抄'); cap('V5 和 V8 一樣大，挑 V8', 'V8 的邊都看過了，表格不變'); },
  async (tok, S) => { S.D.pick('V5'); set(S.st, S.D.relax('V5', 'V9')); cap('接著 V5（6）', '到 V9：6 + 2 = 8'); },
  async (tok, S) => { S.D.pick('V9'); set(S.st, S.D.relax('V9', 'V10')); cap('8 最小：取 V9', '到 V10：8 + 6 = 14，已經有 9 → 沒用'); },
  async (tok, S) => { set(S.st, S.D.relax('V9', 'V11')); cap('V9 到 V11：8 + 5 = 13', ''); },
  async (tok, S) => { S.D.pick('V10'); set(S.st, S.D.relax('V10', 'V12')); cap('抓 V10（9）', '到 V12：9 + 1 = 10'); },
  async (tok, S) => { S.D.pick('V12'); set(S.st, S.D.relax('V12', 'V11')); cap('最小的是 V12（10）', 'update：到 V11 10 + 1 = 11 < 13'); },
  async (tok, S) => {
    S.D.calm(); S.D.pick('V11');
    const want = { V1: 0, V2: 1, V3: 3, V4: 3, V5: 6, V6: 5, V7: 6, V8: 6, V9: 8, V10: 9, V11: 11, V12: 10 };
    const ok = V12.V.every((v) => S.D.L[v] === want[v]);
    set(S.st, '全部確定 ' + (ok ? '✓' : '✗') + '（只找 V12 的話，V12 確定就可以停）');
    cap('只要 V12 的話，確定 V12 就能停', '要全部的話，再做完最後的 V11');
  },
  async (tok, S) => { glow(S.gv.vm.V12, '#8a1010'); paintEdge(EG(S.gv, 'V10', 'V12'), COL.hot, true); set(S.st, 'V12 的 10 從哪來？從 V10'); cap('怎麼走到 V12？往回找', '10 是因為取了 V10'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'V7', 'V10'), COL.hot, true); set(S.st, 'V10 的 9 從 V7 來'); cap('V10 為什麼是 9？', '因為選了 V7'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'V6', 'V7'), COL.hot, true); set(S.st, 'V7 的 6 從 V6 來'); cap('V7 為什麼是 6？', '從 V6 過來'); },
  async (tok, S) => { paintEdge(EG(S.gv, 'V2', 'V6'), COL.hot, true); paintEdge(EG(S.gv, 'V1', 'V2'), COL.hot, true); set(S.st, 'V6 的 5 從 V2 來；V2 的 1 從 V1 來'); cap('V6 從 V2 來', 'V2 從 V1 來'); },
  async (tok, S) => {
    const p = S.D.path('V12'), L = S.D.pathLen(p);
    set(S.st, p.join(' → ') + '：1+4+1+3+1 = ' + L + (L === 10 ? ' ✓' : ' ✗'));
    cap('最短路徑：V1 → V2 → V6 → V7 → V10 → V12', '');
  },
  async (tok, S) => { cap('兩個資訊：最短距離、最短路徑', '最短路徑可能不只一條，演算法只告訴你一條'); },
]);

// Euler：老師黑板上的圖看不到，以下圖形都是示意（度數照老師唸的）
const HOUSE = parseG({ a: [-1.4, 0.6], b: [1.4, 0.6], c: [1.4, 2.6], d: [-1.4, 2.6], e: [0, -1.4] }, 'a-b b-c c-d d-a a-e e-b');
const SQ = parseG({ a: [-1.2, -1.2], b: [1.2, -1.2], c: [1.2, 1.2], d: [-1.2, 1.2] }, 'a-b b-c c-d d-a');
const DEG13 = parseG({ p: [-2.2, 0], q: [-0.4, 0], r: [0.8, -1.6], s: [2.4, 0], t: [0.8, 1.6] }, 'p-q q-r r-s s-t t-q');
scene('g8g-euler', '一筆畫：Euler path 與 Euler circuit', [
  async (tok, S) => {
    S.t = tag('一筆畫', 'note', 0, 0.3, -3.6);
    S.g1 = drawGraph(SQ, { s: 0.85, ox: -4.4, oz: 0.2 }); S.g2 = drawGraph(HOUSE, { s: 0.8, ox: 0, oz: -0.2 }); S.g3 = drawGraph(K4X, { s: 0.45, ox: 4.4, oz: 0.2 });
    tag('示意', 'idx', 5.8, 0.3, -2.4);
    cap('一筆畫：小時候玩過的', '');
  },
  async (tok, S) => { set(S.t, '筆不離紙，每個「邊」恰好畫一次'); cap('筆不要拿起來', '每一條邊都畫過一次，不能畫第二次'); },
  async (tok, S) => { set(S.t, 'Euler 問題（一筆畫問題）'); cap('這叫 Euler 的問題', ''); },
  async (tok, S) => {
    const seq = ['a', 'b', 'c', 'd', 'a']; S.w = ball(S.g1.pos('a'));
    await walk(tok, S.w, S.g1, seq, 380, COL.vis);
    tag('回到起點：Euler circuit ' + (eulerOK(SQ, seq) ? '✓' : '✗'), 'good', -4.4, 0.3, 2.3);
    cap('從這點出發，最後回到同一點', '叫 Euler circuit（或 cycle）');
  },
  async (tok, S) => {
    kill(S.w); const seq = ['a', 'e', 'b', 'a', 'd', 'c', 'b']; S.w = ball(S.g2.pos('a'));
    await walk(tok, S.w, S.g2, seq, 300, COL.blue);
    tag('起點 ≠ 終點：Euler path ' + (eulerOK(HOUSE, seq) ? '✓' : '✗'), 'ptr alt', 0, 0.3, 3.0);
    cap('這個起點和終點不一樣', '叫 Euler path');
  },
  async (tok, S) => {
    kill(S.w);
    tag('怎麼畫都畫不完 ✗', 'bad', 4.4, 0.3, 1.8);
    cap('這個怎麼試都沒有一筆畫', '');
  },
  async (tok, S) => {
    lab.clear();
    S.gv = drawGraph(DEG13, { s: 1.1, ox: 0.6, oz: 0.3 });
    S.w = ball(S.gv.pos('r'));
    await walk(tok, S.w, S.gv, ['r', 'q', 't'], 500, COL.blue);
    S.t = tag('走進一個點，就一定要走出去', 'note', 0, 0.3, -3.4);
    cap('簡單的觀察', '走進一個點，如果還有邊，就一定要走出去');
  },
  async (tok, S) => { glow(S.gv.vm.q, '#8a6400'); set(S.t, '一進一出：除了起點和終點'); cap('一進一出', '只有起點、終點可以只出不進、只進不出'); },
  async (tok, S) => { set(S.t, '中間的點：進出成對 → 連線數（degree）是偶數'); cap('中間經過的點都是一進一出', '所以它的連線數一定是偶數'); },
  async (tok, S) => { set(S.t, '起點、終點：可以（而且必須）是奇數'); cap('起點出去就不回來、終點進來就不出去', '這兩個可以是奇數'); },
  async (tok, S) => { set(S.t, '起點 = 終點（circuit）：那一點也一進一出 → 偶數'); cap('如果同一點出發、同一點結束', '那一點也成對 → 偶數'); },
  async (tok, S) => { S.r1 = tag('Euler path：中間都偶數，頭尾是奇數', 'good', 0, 0.3, 2.9); cap('結論：Euler path', '中間的點偶數、頭尾兩點奇數'); },
  async (tok, S) => { S.r2 = tag('Euler circuit：所有點都是偶數', 'good', 0, 0.3, 3.5); cap('Euler circuit', '所有點的連線數都是偶數'); },
  async (tok, S) => { set(S.t, '反過來也成立（圖要連通）'); cap('反過來也對', '連通、度數又符合，就一定有 Euler path／circuit'); },
  async (tok, S) => { kill(S.w); kill(S.r1); kill(S.r2); glow(S.gv.vm.q, null); calm(S.gv); S.dt = degTags(S.gv); set(S.t, '連線數：1（奇）、3（奇）、2、2、2'); cap('例：這個 1 是奇數、這個 3 是奇數', '其他都是 2，偶數'); },
  async (tok, S) => {
    const seq = ['p', 'q', 'r', 's', 't', 'q']; S.w = ball(S.gv.pos('p'));
    await walk(tok, S.w, S.gv, seq, 350, COL.vis);
    set(S.t, '兩個奇數點 → 有 Euler path，頭尾就是它們 ' + (eulerOK(DEG13, seq) ? '✓' : '✗'));
    cap('兩個奇數、其他偶數', '一定有 Euler path，頭尾就是那兩個奇數點');
  },
  async (tok, S) => { set(S.t, '不從奇數點開始、結束，就找不到'); cap('如果不是從奇數點開始', '就找不到這條路'); },
]);

const STAR = parseG({ o: [0, 0], x: [0, -1.8], y: [-1.6, 1.0], z: [1.6, 1.0] }, 'o-x o-y o-z');
const TRI1 = parseG({ x: [-1.2, -1.0], y: [1.2, -1.0], z: [0, 1.0], t: [0, 2.6] }, 'x-y y-z z-x z-t');
scene('g8g-euler-deg', '數連線數就能判斷', [
  async (tok, S) => {
    S.gv = drawGraph(STAR, { s: 1, ox: -3.4, oz: 0 }); S.dt = degTags(S.gv);
    tag('示意', 'idx', -1.2, 0.3, -2.6);
    const odd = Object.values(degs(STAR)).filter((d) => d % 2).length;
    S.r = tag('奇數點 ' + odd + ' 個 → 沒有 Euler path／circuit ✗', 'bad', -3.4, 0.3, 2.6);
    cap('這個：連線數 1、1、1 都是奇數', '不用找了，一定找不到');
  },
  async (tok, S) => { tag('奇數點只能有 0 個（circuit）或 2 個（path）', 'note', 0, 0.3, -3.5); cap('奇數點的個數不是 0 或 2', '就絕對沒有'); },
  async (tok, S) => {
    S.g2 = drawGraph(TRI1, { s: 1, ox: 3.0, oz: -0.4 }); degTags(S.g2);
    const seq = ['t', 'z', 'x', 'y', 'z']; S.w = ball(S.g2.pos('t'));
    await walk(tok, S.w, S.g2, seq, 350, COL.vis);
    tag('兩個奇數點 → Euler path ' + (eulerOK(TRI1, seq) ? '✓' : '✗'), 'good', 3.0, 0.3, 2.9);
    cap('這個：2、2、3、1', '兩個奇數、其他偶數 → 有 Euler path');
  },
]);

const HZ = parseG({ A: [-4.2, 0], x: [-1.6, 0], B: [1.6, 0], y: [-2.8, -2.2], z: [-0.4, -2.2], u: [0.4, 2.2], w: [2.8, 2.2] }, 'A-x x-B x-y y-z z-x B-u u-w w-B');
scene('g8g-euler-alg', '怎麼找 Euler path：先走一段、再兜圈接上', [
  async (tok, S) => {
    S.gv = drawGraph(HZ, { s: 1, ox: 1.2, oz: 0.2 }); S.dt = degTags(S.gv);
    tag('示意', 'idx', 4.6, 0.3, -2.8);
    S.t = tag('A、B 是奇數點 → 一定從 A 開始、B 結束', 'note', -1.0, 0.3, -3.5);
    cap('怎麼找？用漸進的方法', '一定是從一個奇數點開始、另一個結束');
  },
  async (tok, S) => {
    S.w = ball(S.gv.pos('A'));
    await walk(tok, S.w, S.gv, ['A', 'x', 'B'], 500, COL.blue);
    set(S.t, '第一步：隨便找一條 A 到 B 的路：A → x → B');
    cap('先從 A 隨便找一條路到 B', '');
  },
  async (tok, S) => {
    for (const [u, v] of [['A', 'x'], ['x', 'B']]) EG(S.gv, u, v).g.visible = false;
    set(S.t, '走過的邊不能再走 → 擦掉');
    cap('走過的路不能再走', '把它擦掉');
  },
  async (tok, S) => {
    S.dt && Object.values(S.dt).forEach((l) => kill(l));
    const rest = HZ.E.filter((e) => !((e.u === 'A' && e.v === 'x') || (e.u === 'x' && e.v === 'B')));
    const d = Object.fromEntries(HZ.V.map((v) => [v, 0])); rest.forEach((e) => { d[e.u]++; d[e.v]++; });
    HZ.V.forEach((v) => { const p = S.gv.pos(v); tag('剩 ' + d[v], d[v] % 2 ? 'bad' : 'ptr alt', p.x + 0.55, p.y + 0.6, p.z - 0.45); });
    set(S.t, '剩餘圖（residual graph）：每個點的連線數都是偶數 ' + (Object.values(d).every((x) => x % 2 === 0) ? '✓' : '✗'));
    cap('剩下的圖叫 residual graph', '每個點剩下的連線數都是偶數');
  },
  async (tok, S) => { set(S.t, '所以剩下的部分可以繞圈：從走過的點出發、繞回來'); cap('剩下的部分可以形成 Euler circuit', '從剛才經過的點出發，繞一圈回來'); },
  async (tok, S) => {
    S.w.position.copy(S.gv.pos('x')); S.w.position.y = 0.85;
    await walk(tok, S.w, S.gv, ['x', 'y', 'z', 'x'], 400, COL.orange);
    set(S.t, '在 x「兜風」一圈再接回原路：A → x → y → z → x → B');
    cap('到 x 先別急著去 B', '出去兜一圈回到 x，再接回原來的路');
  },
  async (tok, S) => {
    S.w.position.copy(S.gv.pos('B')); S.w.position.y = 0.85;
    await walk(tok, S.w, S.gv, ['B', 'u', 'w', 'B'], 400, COL.purple);
    set(S.t, '剩下的再從走過的點 B 兜一圈接上');
    cap('剩下的一樣', '從走過的點再去兜一圈，接上');
  },
  async (tok, S) => {
    for (const [u, v] of [['A', 'x'], ['x', 'B']]) EG(S.gv, u, v).g.visible = true;
    const seq = ['A', 'x', 'y', 'z', 'x', 'B', 'u', 'w', 'B'];
    seq.slice(1).forEach((v, i) => paintEdge(EG(S.gv, seq[i], v), COL.vis, true));
    set(S.t, seq.join('→') + '：8 條邊各一次 ' + (eulerOK(HZ, seq) ? '✓' : '✗'));
    cap('接起來就是一條 Euler path', '');
  },
  async (tok, S) => { tag('path：奇數點走到奇數點，再從經過的點兜圈接上', 'good', -1.0, 0.3, 3.3); cap('演算法：先從奇數點走到奇數點', '再從經過的點兜圈接上，直到所有邊都走過'); },
  async (tok, S) => { tag('circuit：隨便一點先繞一圈回自己，再慢慢接', 'good', -1.0, 0.3, 3.9); cap('Euler circuit 也一樣', '隨便一點先繞一圈回來，再慢慢把圈接上'); },
]);

const KBG = parseG({ C: [0, -2.4], A: [-1.2, 0], B: [0, 2.4], D: [2.6, 0] }, 'A-C A-C A-B A-B A-D C-D B-D');
scene('g8g-konig', 'Königsberg 七橋：四個奇數點', [
  async (tok, S) => {
    S.t = tag('一筆畫：走過所有的邊', 'note', 0, 0.3, -3.6);
    cap('一筆畫要走過所有的邊', '這個問題來自 Euler 住的小城');
  },
  async (tok, S) => { S.water = lab.box('#9fd3f0', [9, 0.04, 1.0]); S.water.position.set(0, 0.0, 0.2); lab.world.add(S.water); set(S.t, '一條河、七座橋（示意）'); cap('城裡有一條河、七座橋', ''); },
  async (tok, S) => { set(S.t, '每天散步：從家出發，七座橋都走過，再回家？'); cap('能不能從家裡出去，七座橋都走過一次', '再繞回家？'); },
  async (tok, S) => {
    kill(S.water);
    S.gv = drawGraph(KBG, { s: 1.1, ox: -0.6, oz: 0.2, par: 0.6 });
    set(S.t, '區域 → 節點 C、A、B、D；橋 → 邊');
    cap('把區域當節點：C、A、B、D', '橋就是邊');
  },
  async (tok, S) => {
    S.dt = degTags(S.gv);
    const d = degs(KBG), odd = Object.values(d).filter((x) => x % 2).length;
    set(S.t, '連線數 C ' + d.C + '、A ' + d.A + '、B ' + d.B + '、D ' + d.D + '：' + odd + ' 個奇數點');
    cap('數連線數：3、5、3、3', '全部都是奇數，四個');
  },
  async (tok, S) => { tag('奇數點 4 個 → Euler path、circuit 都沒有 ✗', 'bad', 0, 0.3, 3.4); cap('所以 Euler path 和 Euler circuit', '都不存在'); },
]);

const GRID6 = parseG({ p: [-2.4, -1.2], q: [0, -1.2], r: [2.4, -1.2], s: [-2.4, 1.2], t: [0, 1.2], u: [2.4, 1.2] }, 'p-q q-r p-s q-t r-u s-t t-u');
scene('g8g-ham', 'Hamilton path 與 Hamilton circuit', [
  async (tok, S) => { S.t = tag('Hamilton path', 'note', 0, 0.3, -3.4); cap('另外一個類似的名詞', 'Hamilton path'); },
  async (tok, S) => { set(S.t, '像 traveling salesman：推銷員挨家挨戶敲門'); cap('跟之後的 traveling salesman 很像', '推銷員要挨家挨戶去敲門'); },
  async (tok, S) => {
    S.gv = drawGraph(GRID6, { s: 1.1, ox: 0, oz: 0.3 });
    tag('街道圖（示意）', 'idx', 3.6, 0.3, -2.0);
    set(S.t, '每一家都走過一次，不能重複');
    cap('這是街道圖', '每一家都要去，而且不能重複');
  },
  async (tok, S) => {
    const seq = ['p', 'q', 'r', 'u', 't', 's'];
    S.w = ball(S.gv.pos('p'));
    await walk(tok, S.w, S.gv, seq, 350, COL.blue);
    const ok = new Set(seq).size === GRID6.V.length && seq.length === GRID6.V.length;
    seq.forEach((v) => vcol(S.gv, v, COL.vis));
    set(S.t, '每個「節點」恰好經過一次：Hamilton path ' + (ok ? '✓' : '✗'));
    cap('一筆畫把每一個「節點」走過一遍', '走過就不能再回來');
  },
  async (tok, S) => { tag('比 Euler 難很多：NP-complete 難題', 'bad', 0, 0.3, 3.0); cap('這比 Euler 的問題難很多', 'NP-complete：沒有已知的有效率演算法'); },
  async (tok, S) => { cap('不管怎樣：每個節點只能經過一次', '問的是這樣的路存不存在'); },
  async (tok, S) => {
    await walk(tok, S.w, S.gv, ['s', 'p'], 450, COL.orange);
    set(S.t, '頭尾相連（回到起點）：Hamilton circuit ✓');
    cap('如果要求頭尾相連', '從這邊出去、從這邊回來 → Hamilton circuit');
  },
  async (tok, S) => { tag('老師：Hamilton 是難題，考試不考；Euler 可能考', 'say', 0, 0.3, 3.6); cap('時間不多，這是難的問題', '考試不考它；Euler 比較好懂，可能會考'); },
]);

const CONN = parseG({ a: [-2.2, -1.4], b: [0, -2.0], c: [2.2, -1.2], d: [2.0, 1.4], e: [-0.2, 1.8], f: [-2.4, 1.2] }, 'a-b b-c c-d d-e e-f f-a b-e');
scene('g8g-conn', '連通圖與 component', [
  async (tok, S) => { S.B = board(-6.9, -3.5); S.B.add('9.4：路徑頭尾相連 → circuit'); cap('9.4：路徑之前講過', '頭尾相連的路徑叫 circuit'); },
  async (tok, S) => { S.B.add('有向圖：沿著箭頭方向走，不能逆向', 'say'); cap('有向圖的路徑', '要順著方向走，不能逆向行駛'); },
  async (tok, S) => { S.B.add('連通圖：用路網來想'); cap('很重要的名詞：連通圖', '用剛才的路網來想'); },
  async (tok, S) => {
    S.T = parseG({ A: [-1.6, -1], B: [1.6, -1], C: [0, 1.6] }, 'A-B B-C C-A');
    S.gv = drawGraph(S.T, { s: 1, ox: 2.6, oz: 0.2 });
    S.B.add('A 能走到 B（經過幾段都可以）→ A、B 連在一起');
    cap('從 A 城市可以走到 B 城市', '不管經過幾個路段，就說 A、B 連在一起');
  },
  async (tok, S) => { S.B.add('任兩點之間都有路徑 → 連通圖（connected）'); cap('如果任兩個節點之間都有路徑', '這張圖就是連通圖'); },
  async (tok, S) => {
    const E = S.T.E.map((e) => [e.u, e.v]);
    S.ck = tag('連通 ' + (components(S.T.V, E) === 1 ? '✓' : '✗'), 'good', 2.6, 0.3, 2.6);
    cap('這張是不是連通圖？是', 'A 到 B、B 到 C… 兩兩都連得到');
  },
  async (tok, S) => {
    EG(S.gv, 'A', 'B').g.visible = false;
    const E = S.T.E.filter((e) => !(e.u === 'A' && e.v === 'B')).map((e) => [e.u, e.v]);
    set(S.ck, '擦掉 {A,B}：A→C→B 還走得到，連通 ' + (components(S.T.V, E) === 1 ? '✓' : '✗'));
    cap('擦掉一條邊', '還是連通：A 經過 C 到 B');
  },
  async (tok, S) => {
    EG(S.gv, 'B', 'C').g.visible = false;
    const E = [['C', 'A']];
    const n = components(S.T.V, E);
    set(S.ck, '再擦 {B,C}：A 走不到 B → 不連通（' + n + ' 塊）');
    setc(S.ck, 'bad');
    cap('再擦一條', 'A 沒辦法走到 B → 不是連通圖');
  },
  async (tok, S) => {
    lab.clear(); S.B = board(-6.9, -3.5);
    S.gv = drawGraph(CONN, { s: 1, ox: 2.4, oz: 0.2 });
    S.E = CONN.E.map((e) => [e.u, e.v]);
    S.ck = tag('連通 ✓', 'good', 2.4, 0.3, 3.0);
    await wt(tok, 600);
    for (const [u, v] of [['a', 'b'], ['f', 'a']]) EG(S.gv, u, v).g.visible = false;
    S.E = S.E.filter(([u, v]) => !((u === 'a' && v === 'b') || (u === 'f' && v === 'a')));
    set(S.ck, '擦掉 a 的兩條邊：a 孤立 → ' + components(CONN.V, S.E) + ' 個 component');
    setc(S.ck, 'bad');
    cap('點多一點也一樣', '擦掉這裡，a 跟大家都不相連 → 不連通（示意）');
  },
  async (tok, S) => {
    for (const [u, v] of [['a', 'b'], ['f', 'a']]) EG(S.gv, u, v).g.visible = true;
    for (const [u, v] of [['b', 'c'], ['d', 'e']]) EG(S.gv, u, v).g.visible = false;
    S.E = CONN.E.map((e) => [e.u, e.v]).filter(([u, v]) => !((u === 'b' && v === 'c') || (u === 'd' && v === 'e')));
    set(S.ck, '改擦 {b,c}、{d,e}：左右兩邊走不到 → ' + components(CONN.V, S.E) + ' 個 component');
    cap('或擦掉這兩條', '這邊的點走不到那邊 → 也不是連通圖');
  },
  async (tok, S) => {
    const left = reach(CONN.V, S.E, 'a');
    CONN.V.forEach((v) => vcol(S.gv, v, left.has(v) ? COMP[0] : COMP[1]));
    S.B.add('連在一起的一塊 → 叫 component');
    cap('連在一起的部分', '叫做一個 component');
  },
  async (tok, S) => { S.B.add('不連通的圖 = 兩個以上的 component（這裡 ' + components(CONN.V, S.E) + ' 個 ✓）', 'good'); cap('不連通的圖', '會分成兩個以上的 component'); },
]);

const DIR5 = parseG({ A: [-3, -1], C: [-0.6, -2.2], D: [1.6, -0.4], B: [-0.6, 1.4], E: [3.4, 1.6] }, 'A>B A>C C>D D>B D>E');
scene('g8g-strong', '有向圖：強連通與弱連通', [
  async (tok, S) => {
    S.gv = drawGraph(DIR5, { s: 1, ox: 2.0, oz: 0.2 });
    S.B = board(-6.9, -3.5);
    tag('示意', 'idx', 5.4, 0.3, -2.6);
    S.B.add('有向圖比較麻煩：路徑附帶方向');
    cap('比較麻煩的是有向圖', '路徑除了邊，還有方向');
  },
  async (tok, S) => {
    const p = ['A', 'C', 'D', 'B']; p.slice(1).forEach((v, i) => paintEdge(EG(S.gv, p[i], v), COL.blue, true));
    S.B.add('要順著箭頭：A → C → D → B 是一條路徑');
    cap('A 要到 B：可以 A → B', '也可以 A → C → D → B');
  },
  async (tok, S) => {
    calm(S.gv);
    const r = reach(DIR5.V, DIR5.E.map((e) => [e.u, e.v]), 'E', true);
    S.B.add('E 走不到 B：沒有這條路 ' + (r.has('B') ? '✗' : '✓'), 'bad');
    cap('但不能說 E 可以走到 B', '圖上沒有這樣的路');
  },
  async (tok, S) => { S.B.add('連通要怎麼定義？兩種'); cap('有方向時，連通怎麼定義？', '分成兩種'); },
  async (tok, S) => { S.B.add('強連通（strongly connected）：A→B、B→A 都要走得通'); cap('強連通', 'A 到 B 走得通，B 到 A 也要走得通'); },
  async (tok, S) => {
    const E = DIR5.E.map((e) => [e.u, e.v]);
    const ab = reach(DIR5.V, E, 'A', true).has('B'), ba = reach(DIR5.V, E, 'B', true).has('A');
    glow(S.gv.vm.B, '#8a1010');
    S.B.add('A 到 B：' + (ab ? '可以 ✓' : '不行') + '　B 到 A：' + (ba ? '可以' : '不行 ✗（B 只進不出）'));
    cap('A 可以到 B', '但 B 只進不出，走不回 A → 不是強連通');
  },
  async (tok, S) => {
    const E = DIR5.E.map((e) => [e.u, e.v]);
    const strong = DIR5.V.every((v) => reach(DIR5.V, E, v, true).size === DIR5.V.length);
    S.B.add('強連通：任兩點去得了也回得來 → 這張 ' + (strong ? '是' : '不是 ✓'));
    cap('強連通：任兩點之間', '去得了、也回得來');
  },
  async (tok, S) => {
    glow(S.gv.vm.B, null);
    const E = DIR5.E.map((e) => [e.u, e.v]);
    const weak = components(DIR5.V, E) === 1;
    S.B.add('弱連通：拿掉方向變無向圖，連在一起 → 這張' + (weak ? '是 ✓' : '不是'), 'good');
    cap('弱連通：把方向拿掉，當成無向圖', '如果連在一起，就叫 weakly connected');
  },
]);

// ════════ Wi8IvnlMNxs（Math at Andrews：Cayley's Tree Theorem、Prüfer code） ════════
// 例子全照影片：3 個頂點 3 棵、4 個頂點 4（星形）+ 12（路徑形 24 ÷ 2）= 16 棵、6 個頂點的樹
// （邊 1–3、1–6、1–2、2–4、2–5）的 Prüfer code = 1 2 2 1。所有數目都用 spanningTrees(Kₙ) 列舉驗算、打 ✓。
const NUMG = (P, es) => parseG(P, es);
const KN = (n, R = 1.1) => { const names = Array.from({ length: n }, (_, i) => String(i + 1)); const es = []; names.forEach((a, i) => names.slice(i + 1).forEach((b) => es.push(a + '-' + b))); return parseG(ringP(names, R), es.join(' ')); };
const sameEdges = (A, B) => { const k = (G) => G.E.map((e) => [e.u, e.v].sort().join('|')).sort().join(' '); return k(A) === k(B); };
const boxLbl = (gv, n, t) => { const l = lab.label(String(t), 'val'); gv.vm[n].add(l); return l; };
// Prüfer code: repeatedly cut the smallest-numbered leaf, record its neighbour
function pruferOf(G) {
  const A = Object.fromEntries(G.V.map((v) => [v, new Set()]));
  G.E.forEach((e) => { A[e.u].add(e.v); A[e.v].add(e.u); });
  const out = [];
  for (let k = 0; k < G.V.length - 2; k++) {
    const leaves = Object.keys(A).filter((v) => A[v].size === 1).sort((a, b) => a - b);
    const leaf = leaves[0], nb = [...A[leaf]][0];
    out.push({ leaves, leaf, nb });
    A[nb].delete(leaf); delete A[leaf];
  }
  return out;
}
// …and back: code → edges
function pruferDecode(code, n) {
  const deg = {}; for (let v = 1; v <= n; v++) deg[v] = 1; code.forEach((a) => deg[a]++);
  const E = [];
  code.forEach((a) => { const leaf = Object.keys(deg).map(Number).filter((v) => deg[v] === 1).sort((x, y) => x - y)[0]; E.push([leaf, a]); deg[leaf]--; deg[a]--; });
  const last = Object.keys(deg).map(Number).filter((v) => deg[v] === 1); E.push(last);
  return E.map(([u, v]) => [String(u), String(v)]);
}
const PT6 = NUMG({ 1: [-1, 0], 2: [1.2, 0], 3: [-2.4, -1.3], 6: [-2.4, 1.3], 4: [2.6, -1.3], 5: [2.6, 1.3] }, '1-3 1-6 1-2 2-4 2-5');

scene('g8w-cay-3', '三個頂點：同構的樹 vs. 標號的樹', [
  async (tok, S) => {
    const shapes = [
      NUMG({ a: [-1, -0.6], b: [0, 0.6], c: [1, -0.6] }, 'a-b b-c'),
      NUMG({ a: [-1, 0.6], b: [0, -0.6], c: [1, 0.6] }, 'a-b b-c'),
      NUMG({ a: [-1.2, 0], b: [0, 0], c: [1.2, 0] }, 'a-b b-c'),
    ];
    S.gs = shapes.map((G, i) => drawGraph(G, { s: 1, ox: -4 + i * 4, oz: -0.8, noName: true }));
    ['V 字', '倒 V', '一直線'].forEach((t, i) => tag(t, 'idx', -4 + i * 4, 0.3, 0.9));
    cap('三個頂點的樹：V 字、倒 V、一直線', '看起來不一樣');
  },
  async (tok, S) => {
    S.gs.forEach((gv) => { const d = degs(gv.G); tag('degree ' + ['a', 'b', 'c'].map((v) => d[v]).join('–'), 'ptr alt', gv.pos('b').x, 0.3, 1.7); });
    tag('葉–中心–葉：都同構（isomorphic）', 'good', 0, 0.3, 2.7);
    cap('其實都一樣：葉子連到 degree 2 的點再連到葉子', '叫同構（isomorphic）');
  },
  async (tok, S) => {
    fresh(...GCAM);
    drawGraph(NUMG({ 1: [-1.1, 0], 2: [0, 0], 3: [1.1, 0] }, '1-2 2-3'), { s: 0.8, ox: -5.1, oz: -0.6 });
    tag('=', 'ptr', -3.6, 0.3, -0.6);
    drawGraph(NUMG({ 3: [-1.1, 0.5], 2: [0, -0.6], 1: [1.1, 0.5] }, '3-2 2-1'), { s: 0.8, ox: -2.1, oz: -0.6 });
    tag('中心是 2（同一棵）', 'ptr alt', -3.6, 0.3, 1.0);
    cap('把頂點標上 1、2、3：labeled tree', '兩種畫法的中心都是 2，記錄的資訊一樣');
  },
  async (tok, S) => {
    drawGraph(NUMG({ 2: [-1.1, 0], 1: [0, 0], 3: [1.1, 0] }, '2-1 1-3'), { s: 0.8, ox: 1.3, oz: -0.6 });
    tag('中心是 1', 'ptr alt', 1.3, 0.3, 1.0);
    await wt(tok, 900);
    drawGraph(NUMG({ 1: [-1.1, 0], 3: [0, 0], 2: [1.1, 0] }, '1-3 3-2'), { s: 0.8, ox: 4.9, oz: -0.6 });
    tag('中心是 3', 'ptr alt', 4.9, 0.3, 1.0);
    cap('中心換成 1 或 3，就是不同的樹', '只差在中間那個點是誰');
  },
  async (tok, S) => {
    const n = spanningTrees(KN(3)).length;
    tag('3 個頂點：共 ' + n + ' 棵 labeled tree' + (n === 3 ? ' ✓' : ' ✗'), 'good', 0, 0.3, 2.5);
    cap('三個頂點的 labeled tree 共 3 棵', '中心可以是 1、2、3');
  },
]);

scene('g8w-cay-4', '四個頂點：數出 16 棵', [
  async (tok, S) => {
    S.U = drawGraph(NUMG({ a: [-1, -0.8], b: [-1, 0.7], c: [1, 0.7], d: [1, -0.8] }, 'a-b b-c c-d'), { s: 1, ox: -3.4, oz: -0.6, noName: true });
    S.T = drawGraph(NUMG({ c: [0, 0], a: [0, -1.2], b: [-1.1, 0.7], d: [1.1, 0.7] }, 'c-a c-b c-d'), { s: 1, ox: 3.4, oz: -0.6, noName: true });
    tag('U 形（路徑形）', 'idx', -3.4, 0.3, 1.4); tag('星形', 'idx', 3.4, 0.3, 1.4);
    cap('四個頂點的樹只有兩種形狀', 'U 形（路徑）或一點連到另外三點');
  },
  async (tok, S) => {
    [S.U, S.T].forEach((gv) => { const d = degs(gv.G); gv.G.V.forEach((v) => { const p = gv.pos(v); tag(String(d[v]), d[v] === 3 ? 'ptr alt' : 'ptr', p.x + 0.55, p.y + 0.6, p.z - 0.45); }); });
    tag('degree 1、2、2、1', 'ptr', -3.4, 0.3, 2.3); tag('有一個 degree 3', 'ptr alt', 3.4, 0.3, 2.3);
    cap('兩種本質上不同', '一個是 1、2、2、1，一個有 degree 3 的點');
  },
  async (tok, S) => {
    fresh(...GCAM);
    [1, 2, 3, 4].forEach((c, i) => {
      const L = [1, 2, 3, 4].filter((x) => x !== c);
      const P = { [c]: [0, 0], [L[0]]: [0, -1.2], [L[1]]: [-1.1, 0.7], [L[2]]: [1.1, 0.7] };
      drawGraph(NUMG(P, L.map((x) => c + '-' + x).join(' ')), { s: 0.62, ox: -5 + i * 3.33, oz: -1.4 });
      tag('中心 ' + c, 'ptr alt', -5 + i * 3.33, 0.3, -0.2);
    });
    S.st = tag('葉子怎麼標都一樣，只看中心 → 星形 4 種', 'good', 0, 0.3, 1.0);
    cap('星形：只看 degree 3 的中心標什麼', '1、2、3、4 → 4 種');
  },
  async (tok, S) => {
    S.P = drawGraph(NUMG({ a: [-3, 0], b: [-1, 0], c: [1, 0], d: [3, 0] }, 'a-b b-c c-d'), { s: 1, ox: 0, oz: 2.2, noName: true });
    const lab4 = ['2', '1', '3', '4'], ch = [4, 3, 2, 1];
    for (let i = 0; i < 4; i++) {
      const n = 'abcd'[i]; boxLbl(S.P, n, lab4[i]); vcol(S.P, n, COL.vis);
      tag(ch[i] + ' 種', 'idx', S.P.pos(n).x, 0.3, 3.0);
      await wt(tok, 650);
    }
    S.prod = tag('路徑形：4 × 3 × 2 × 1 = 24 種排法？', 'ptr alt', 0, 0.3, 3.7);
    cap('路徑形：第一個點 4 種、下一個 3 種、再 2 種', '4 × 3 × 2 = 24 種？');
  },
  async (tok, S) => {
    const A = NUMG({ 2: [0, 0], 1: [1, 0], 3: [2, 0], 4: [3, 0] }, '2-1 1-3 3-4');
    const B = NUMG({ 4: [0, 0], 3: [1, 0], 1: [2, 0], 2: [3, 0] }, '4-3 3-1 1-2');
    const same = sameEdges(A, B);
    txt(S.prod, '2–1–3–4 倒過來 = 4–3–1–2：同一棵' + (same ? ' ✓' : ' ✗') + ' → 24 ÷ 2 = 12');
    S.P.G.V.forEach((v) => vcol(S.P, v, COL.tree));
    cap('但倒過來標（4–3–1–2）是同一棵樹', '鏡像對稱，每棵被數兩次：24 ÷ 2 = 12');
  },
  async (tok, S) => {
    const n = spanningTrees(KN(4)).length;
    kill(S.st);
    tag('12（路徑形）+ 4（星形）= ' + (12 + 4) + ' 棵' + (n === 16 ? ' ✓' : ' ✗'), 'good', 0, 0.3, 1.0);
    cap('總共 12 + 4 = 16 棵', '四個頂點的 labeled tree');
  },
]);

scene('g8w-cay-thm', 'Cayley 定理：n^(n−2) 棵', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4, 0.62);
    S.B.add('3 個頂點 3 棵、4 個頂點 16 棵');
    S.B.add('5、6、7……100 個頂點呢？有公式嗎？');
    cap('n 個頂點的 labeled tree 有幾棵？', '一個一個數會數不完');
  },
  async (tok, S) => {
    S.B.add('Cayley 定理：n 個頂點的 labeled tree 有 n^(n−2) 棵', 'good');
    cap('Cayley 定理', 'n 個頂點的 labeled tree 共 n^(n−2) 棵');
  },
  ...[3, 4, 5].map((n, i) => async (tok, S) => {
    const G = KN(n, 1.05), gv = drawGraph(G, { s: 0.85, ox: -2.0 + i * 3.6, oz: 0.9, size: [0.5, 0.4, 0.5] }); // right of the board's strip
    const T = spanningTrees(G), want = Math.pow(n, n - 2);
    const cnt = tag('', 'ptr alt', -2.0 + i * 3.6, 0.3, 2.7);
    const ms = Math.max(30, Math.min(400, 4200 / T.length));
    for (let k = 0; k < T.length; k++) {
      gv.em.forEach((e, j) => paintEdge(e, T[k].includes(j) ? COL.tree : COL.dim, T[k].includes(j)));
      txt(cnt, '第 ' + (k + 1) + ' 棵');
      await wt(tok, ms);
    }
    txt(cnt, n + '^' + (n - 2) + ' = ' + want + (T.length === want ? ' ✓' : ' ✗'));
    setc(cnt, T.length === want ? 'good' : 'bad');
    cap('n = ' + n + '：' + n + '^(' + n + '−2) = ' + want, n === 5 ? '五個頂點就有 125 棵' : '跟剛才數的一樣');
  }),
]);

scene('g8w-cay-bij', '證明想法：雙射（bijection）', [
  async (tok, S) => {
    S.B = board(-6.9, -3.4, 0.62);
    S.B.add('要證：剛好 n^(n−2) 棵 —— 直接數很難');
    S.pile = Array.from({ length: 10 }, (_, i) => cube('樹', COL.idle, [0.6, 0.4, 0.6], -1 + (i % 5) * 1.2, 0.3, 0.6 + Math.floor(i / 5) * 1.2, 2 + i * 0.3));
    cap('n^(n−2) 怎麼證？', '直接一棵一棵數非常困難');
  },
  async (tok, S) => {
    S.pile.forEach((m) => kill(m));
    S.R = [0, 1, 2, 3, 4].map((i) => cube('', COL.pink, [0.5, 0.5, 0.5], -0.2 + i * 1.3, 0.3, -0.4));
    S.L = [0, 1, 2, 3, 4].map((i) => cube('', COL.blue, [0.5, 0.5, 0.5], -0.2 + i * 1.3, 0.3, 1.9));
    tag('右手（難數）', 'ptr', -2.2, 0.3, -0.4); tag('左手（好數）', 'ptr', -2.2, 0.3, 1.9);
    S.B.add('組合學技巧：右手難數 → 和左手一一對應');
    cap('右手的手指難數？', '把它跟左手一根對一根');
  },
  async (tok, S) => {
    for (let i = 0; i < 5; i++) {
      edgeMesh(S.R[i].position.clone(), S.L[i].position.clone(), { color: COL.vis, gap: 0.35 });
      S.L[i].add(lab.label(String(i + 1), 'val'));
      await wt(tok, 450);
    }
    S.B.add('一一對應叫 bijection（雙射）→ 數左手：5 → 右手也是 5', 'good');
    cap('每根手指對到另一根：bijection', '數左手 5 根 → 右手也一定 5 根');
  },
  async (tok, S) => {
    fresh(...GCAM);
    S.B = board(-6.9, -3.4, 0.62);
    S.B.add('把 labeled tree 對應到數列 a₁ a₂ … aₙ₋₂');
    drawGraph(PT6, { s: 0.6, ox: -1.6, oz: 0.8, size: [0.45, 0.4, 0.45] });
    tag('一棵 labeled tree（n = 6）', 'idx', -1.6, 0.3, 2.4);
    arrow(V3(0.3, 0.4, 0.8), V3(1.6, 0.4, 0.8), 0x2fc092);
    tag('一一對應', 'idx', 0.95, 0.3, 0.2);
    S.sl = ['a₁', 'a₂', 'a₃', 'a₄'].map((t, i) => cube(t, COL.orange, [0.75, 0.4, 0.75], 2.4 + i * 1.2, 0.3, 0.8));
    tag('Prüfer code（長度 n − 2）', 'ptr alt', 4.2, 0.3, -0.4);
    tag('每一項是 1～n', 'idx', 4.2, 0.3, 1.8);
    cap('改成把樹對應到一串數字', '長度 n − 2，每項是 1 到 n：叫 Prüfer code');
  },
  async (tok, S) => {
    S.sl.forEach((m, i) => tag('n 種', 'ptr', m.position.x, 0.3, 2.6));
    const n = 6, all = Math.pow(n, n - 2);
    S.B.add('每項 n 種 → n × n × … × n = n^(n−2) 個數列', 'note');
    S.B.add('一一對應 → labeled tree 也有 n^(n−2) 棵（n = 6：' + all + '）', 'good');
    cap('每一項都有 n 種選法', '共 n^(n−2) 個數列 → 樹也有 n^(n−2) 棵');
  },
]);

scene('g8w-prufer', 'Prüfer code：一直剪最小的葉子', [
  async (tok, S) => {
    S.gv = drawGraph(PT6, { s: 1, ox: 2.4, oz: -0.9 });
    S.B = board(-6.9, -3.4, 0.56);
    S.B.add('一棵 6 個頂點、標 1～6 的樹');
    S.run = pruferOf(PT6); S.out = new Set();
    S.slots = [0, 1, 2, 3].map((i) => cube('', COL.dim, [0.8, 0.25, 0.8], -0.4 + i * 1.2, 0.2, 2.9));
    tag('code：', 'ptr', -2.0, 0.3, 2.9);
    cap('從樹得到 code：拿一棵 6 個頂點的樹', 'code 長度 6 − 2 = 4');
  },
  async (tok, S) => {
    S.run[0].leaves.forEach((v) => vcol(S.gv, v, COL.orange));
    S.B.add('規則：找編號最小的葉子（degree 1）');
    S.B.add('　記下它的鄰居，再把葉子和那條邊拿掉', 'say');
    cap('每次找編號最小的葉子', '葉子是 3、4、5、6');
  },
  ...[0, 1, 2, 3].map((k) => async (tok, S) => {
    const r = S.run[k];
    PT6.V.forEach((v) => { if (!S.out.has(v)) vcol(S.gv, v, r.leaves.includes(v) ? COL.orange : COL.idle); });
    vcol(S.gv, r.leaf, COL.hot, '#5a1010'); vcol(S.gv, r.nb, COL.tree, '#6a4a00');
    await wt(tok, 800);
    const s = S.slots[k]; s.material.color.set(COL.tree); S.slots[k] = cube(r.nb, COL.tree, [0.8, 0.4, 0.8], s.position.x, 0.4, 2.9, 1.6); kill(s);
    await removeEdge(tok, EG(S.gv, r.leaf, r.nb));
    S.out.add(r.leaf); vcol(S.gv, r.leaf, COL.dim); S.gv.vm[r.leaf].position.y = 0.1;
    vcol(S.gv, r.nb, COL.idle);
    S.B.add('剪 ' + r.leaf + '，鄰居 ' + r.nb + ' → 記 ' + r.nb);
    cap('最小的葉子 ' + r.leaf + ' 連到 ' + r.nb, k === 3 ? '2 現在也變成葉子了' : '記下 ' + r.nb + '，拿掉 ' + r.leaf);
  }),
  async (tok, S) => {
    const code = S.run.map((r) => r.nb);
    const ok = code.join(' ') === '1 2 2 1';
    PT6.V.forEach((v) => { if (!S.out.has(v)) vcol(S.gv, v, COL.vis); });
    S.B.add('Prüfer code = ' + code.join(' ') + (ok ? ' ✓' : ' ✗') + '（剩一條邊就停）', 'good');
    cap('這棵樹的 Prüfer code：1 2 2 1', '長度 6 − 2 = 4，剩最後一條邊 {1,6} 就停');
  },
  async (tok, S) => {
    const E = pruferDecode(S.run.map((r) => Number(r.nb)), 6);
    const back = parseG(PT6.P, E.map((e) => e.join('-')).join(' '));
    PT6.V.forEach((v) => { S.gv.vm[v].position.y = 0.3; vcol(S.gv, v, COL.idle); });
    for (const [u, v] of E) { paintEdge(EG(S.gv, u, v), COL.vis, true, true); await wt(tok, 450); }
    S.B.add('由 1 2 2 1 反推回同一棵樹' + (sameEdges(back, PT6) ? ' ✓' : ' ✗'));
    S.B.add('樹 ↔ code 一一對應 → 樹有 n^(n−2) 棵', 'good');
    cap('每棵樹的 Prüfer code 唯一，也能從 code 還原樹', '一一對應，所以樹的數目 = n^(n−2)');
  },
]);

// ════════ P2FRYshQ57s 補：想一想怎麼找、同構保留連通性 ════════
scene('g8g-tw-think', '想一想：從臺北出發，你會怎麼找？', [
  async (tok, S) => {
    S.gv = twMap({ s: 0.85, ox: 2.4 });
    S.gv.em.forEach((e) => showL(e.wl, true));
    vcol(S.gv, '臺北', COL.vis, '#8a6400');
    S.q = TW.V.filter((v) => v !== '臺北').map((v) => { const p = S.gv.pos(v); return tag('?', 'ptr alt', p.x + 0.7, 0.7, p.z - 0.4); });
    S.B = board(-6.9, -3.4);
    S.B.add('從臺北出發：到每個城市最短多遠？');
    cap('如果是你，你會怎麼做？', '從臺北出發，到每個城市的最短距離');
  },
  async (tok, S) => {
    const len = (p) => p.slice(1).reduce((s, v, i) => s + TW.E[S.gv.find(p[i], v)].w, 0);
    const r1 = ['臺北', '桃園', '新竹', '臺中'], r2 = ['臺北', '宜蘭', '南投', '臺中'];
    r1.slice(1).forEach((v, i) => paintEdge(EG(S.gv, r1[i], v), COL.blue, true));
    S.B.add('到臺中：北→桃→竹→中 = ' + len(r1));
    await wt(tok, 900);
    r2.slice(1).forEach((v, i) => paintEdge(EG(S.gv, r2[i], v), COL.orange, true));
    S.B.add('　　　　北→宜→投→中 = ' + len(r2));
    cap('路線很多條，一條一條列出來比？', '城市一多就列不完');
  },
  async (tok, S) => {
    calm(S.gv);
    S.B.add('有沒有聰明的順序？先想一想', 'good');
    cap('先自己想想看', '下一段：最直覺的 greedy 想法');
  },
]);

const ISO1 = parseG({ a: [-1, -1], b: [1, -1], c: [0, 0.8], d: [-1, 2.4], e: [1, 2.4] }, 'a-b b-c c-a d-e');
const ISOF = { a: '3', b: '1', c: '5', d: '2', e: '4' };
const ISO2 = parseG({ 1: [0, 2.2], 3: [-1.1, 0.4], 5: [1.1, 0.4], 2: [-1.1, -1.4], 4: [1.1, -1.4] }, ISO1.E.map((e) => ISOF[e.u] + '-' + ISOF[e.v]).join(' '));
scene('g8g-iso-conn', '同構的圖：連通性也一樣', [
  async (tok, S) => {
    S.g1 = drawGraph(ISO1, { s: 0.9, ox: -3.2, oz: -0.9 }); S.g2 = drawGraph(ISO2, { s: 0.9, ox: 3.2, oz: -0.4 });
    tag('G₁', 'ptr', -5.6, 0.3, -2.4); tag('G₂', 'ptr', 5.6, 0.3, -2.4);
    const ok = ISO1.E.every((e) => S.g2.find(ISOF[e.u], ISOF[e.v]) >= 0) && ISO1.E.length === ISO2.E.length;
    tag('f：a→3　b→1　c→5　d→2　e→4　邊一一對應' + (ok ? ' ✓' : ' ✗'), 'ptr alt', 0, 0.3, 2.9);
    cap('G₁ 和 G₂ 是 isomorphic', '頂點一一對應，邊也一一對應');
  },
  async (tok, S) => {
    const p = ['a', 'b', 'c'];
    p.slice(1).forEach((v, i) => { paintEdge(EG(S.g1, p[i], v), COL.blue, true); paintEdge(EG(S.g2, ISOF[p[i]], ISOF[v]), COL.blue, true); });
    tag('路徑 a–b–c ↔ 3–1–5', 'good', 0, 0.3, -2.9);
    cap('G₁ 有一條路徑', '對應過去，G₂ 也有同樣的路徑');
  },
  async (tok, S) => {
    const c1 = components(ISO1.V, ISO1.E.map((e) => [e.u, e.v])), c2 = components(ISO2.V, ISO2.E.map((e) => [e.u, e.v]));
    const no1 = !reach(ISO1.V, ISO1.E.map((e) => [e.u, e.v]), 'a').has('d'), no2 = !reach(ISO2.V, ISO2.E.map((e) => [e.u, e.v]), '3').has('2');
    ['d', 'e'].forEach((v) => { vcol(S.g1, v, COL.orange); vcol(S.g2, ISOF[v], COL.orange); });
    tag('a 到 d 沒有路 ↔ 3 到 2 也沒有' + (no1 && no2 ? ' ✓' : ' ✗') + '；component 都是 ' + c1 + (c1 === c2 ? ' ✓' : ' ✗'), 'good', 0, 0.3, -3.6);
    cap('連不連通、有沒有路徑', 'isomorphic 的兩張圖都一模一樣，不會變');
  },
]);
  }
  // ═══ fc (Numberphile The Four Color Map Theorem, NgbK43jB4rQ) ═══
  {
const { V3, tag, cube, kill, glow, tint, anim, arrow, step, fresh, fly } = K;
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const setT = (l, t) => { if (l && l.element) l.element.textContent = t; };
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f', gray: '#cfc6b6' };
const OKG = '#0f5a3a', NG = '#7a1010', HL = '#6a4a00';
const PALE = ['#efe6d4', '#e2d6c0', '#d6c9b0', '#ece0c8', '#ddd2bd', '#e6dcca'];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
function board(x, yTop, dy = 0.7) {
  const ls = []; let last = null;
  return {
    add(t, c = 'note') {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = L(t, c, x, yTop - ls.length * dy); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
  };
}
// a map drawn as a grid of tiles; rows = strings, one letter per country
function gmap(rows, x0, y0, cs = 0.85) {
  const tiles = {}, cells = {};
  rows.forEach((row, r) => [...row].forEach((k, c) => {
    const x = x0 + c * cs, y = y0 - r * cs;
    (tiles[k] = tiles[k] || []).push(cube('', PALE[Object.keys(tiles).length % PALE.length], [cs - 0.06, cs - 0.06, 0.3], x, y, 0));
    (cells[k] = cells[k] || []).push([x, y]);
  }));
  const paint = (k, c) => tiles[k].forEach((m) => tint(m, c));
  const mid = (k) => { const p = cells[k]; return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };
  // country borders: a dark segment wherever two cells of different countries (or a cell and the outside) meet
  const at = (r, c) => (rows[r] || '')[c], h = cs / 2, bl = [];
  rows.forEach((row, r) => [...row].forEach((k, c) => {
    const x = x0 + c * cs, y = y0 - r * cs;
    if (at(r, c + 1) !== k) bl.push(K.line(x + h, y - h, x + h, y + h, 0.17, '#3b2f20'));
    if (at(r + 1, c) !== k) bl.push(K.line(x - h, y - h, x + h, y - h, 0.17, '#3b2f20'));
    if (c === 0) bl.push(K.line(x - h, y - h, x - h, y + h, 0.17, '#3b2f20'));
    if (r === 0) bl.push(K.line(x - h, y + h, x + h, y + h, 0.17, '#3b2f20'));
  }));
  return { tiles, paint, mid, bl, all: () => Object.values(tiles).flat().concat(bl) };
}
const W5 = ['11122', '1CCC2', '5CCC3', '5CCC3', '54443'];
const K4 = ['AAAA', 'ACCB', 'DCCB', 'DDBB'];
const node = (t, c, x, y) => cube(t, c, [0.42, 0.42, 0.42], x, y, 0.2);
const edge = (a, b, color = '#6e5f49') => K.line(a[0], a[1], b[0], b[1], 0.2, color);
const ring = (cx, cy, r, n, a0 = Math.PI / 2) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + i * 2 * Math.PI / n), cy + r * Math.sin(a0 + i * 2 * Math.PI / n)]);

const WORLD = ['AABBBC', 'ADDBCC', 'EDDFFC', 'EEGGFC', 'EGGGFF'];
const WCOL = { D: FC.orange, A: FC.purple, B: FC.blue, F: FC.purple, G: FC.blue, E: FC.pink, C: FC.orange };
const SW4 = [FC.orange, FC.purple, FC.blue, FC.pink];
scene('fc-try', '四色定理：動手塗地圖', [
  async (tok, S) => { // 4.6
    S.B = board(-6.6, 6.4);
    S.B.add('四色定理：');
    S.W = gmap(WORLD, 1.2, 5.4, 0.8);
    S.sw = SW4.map((c, i) => cube('', c, [0.5, 0.5, 0.5], 6.4, 5.3 - i * 0.75, 0, 1));
    await wt(tok, 500);
    for (const k of 'DABFGEC') { S.W.paint(k, WCOL[k]); await wt(tok, 260); }
    S.B.add('相鄰不同色，4 色一定夠');
    cap('每張地圖都能用 4 色著色', '相鄰（有共同邊界）的國家不同色');
  },
  async (tok, S) => { // 21.9
    S.five = cube('', FC.green, [0.5, 0.5, 0.5], 6.4, 2.3, 0, 1);
    S.x5 = T('✗', 'bad', 6.4, 1.6);
    cap('沒有地圖需要第 5 色', '地圖再複雜也一樣');
  },
  async (tok, S) => { // 35.7
    kill(S.x5); fly(S.five);
    S.strip = [cube('1852', FC.sand, [1.3, 0.55, 0.3], 1.6, 0.9, 0, 1), cube('1976', FC.green, [1.3, 0.55, 0.3], 5.4, 0.9, 0, 1)];
    S.strip.push(K.line(2.3, 0.9, 4.7, 0.9, 0, '#6e5f49'), T('約 125 年', 'idx', 3.5, 1.35));
    S.B.add('1852 提出 → 1976 證明');
    cap('懸了一百多年，1970 年代才解決', '解法在當時有爭議');
  },
  async (tok, S) => { // 57.9
    S.strip.forEach(kill);
    S.strip = [T('塗英國各郡的人', 'ptr', 1.4, 1.1), T('弟弟', 'ptr', 4.9, 1.1), T('De Morgan', 'ptr alt', 4.9, 0.0)];
    S.strip.push(arrow(V3(3.15, 1.1), V3(4.2, 1.1)), arrow(V3(4.9, 0.8), V3(4.9, 0.35)));
    cap('有人替英國各郡著色，猜 4 色夠', '經弟弟傳到老師 De Morgan');
  },
  async (tok, S) => { // 81.0
    S.strip.forEach(kill);
    S.strip = [T('每張都 4 色可 → 證明', 'good', 3.5, 1.2), T('一張要 5 色 → 反例', 'bad', 3.5, 0.4)];
    cap('要嘛證明每張地圖 4 色夠', '要嘛找一張非 5 色不可的地圖');
  },
  async (tok, S) => { // 95.0
    S.strip.forEach(kill); S.strip = [];
    const pals = [[FC.orange, FC.purple, FC.blue, FC.pink], [FC.blue, FC.orange, FC.pink, FC.purple], [FC.purple, FC.pink, FC.orange, FC.blue]];
    const idx = { D: 0, A: 1, B: 2, F: 1, G: 2, E: 3, C: 0 };
    const nm = ['世界', '美國', '其他'];
    for (let m = 0; m < 3; m++) {
      const g = gmap(WORLD, 0.5 + m * 2.3, 1.3, 0.3);
      for (const k in idx) g.paint(k, pals[m][idx[k]]);
      S.strip.push(...g.all(), T(nm[m] + ' ✓', 'idx', 1.25 + m * 2.3, -0.35));
      await wt(tok, 350);
    }
    S.B.add('真實地圖都 4 色可', 'good');
    cap('世界、美國、任何真實地圖', '都能用 4 色塗完');
  },
  async (tok, S) => { // 116.1
    S.strip.forEach(kill); S.W.all().forEach(kill); S.sw.forEach(kill);
    S.M = gmap(W5, 2.2, 5.3);
    S.q = T('發明怪地圖：要 5 色？', 'say', 3.9, 6.2);
    cap('那就自己發明一張怪地圖', '說不定要 5 色？');
  },
  async (tok, S) => { // 130.7
    S.M.paint('C', FC.orange);
    kill(S.q); T('自己畫的地圖（示意）', 'idx', 3.9, 6.2);
    cap('中間的國家先塗橘色', '');
  },
  async (tok, S) => { // 148.0
    const cs = [FC.purple, FC.blue, FC.purple, FC.blue];
    for (let i = 0; i < 4; i++) { S.M.paint(String(i + 1), cs[i]); await wt(tok, 450); }
    S.B.add('外圍輪流用紫、藍');
    cap('外圍都碰到橘色', '輪流塗紫、藍');
  },
  async (tok, S) => { // 184.0
    S.M.tiles['5'].forEach((m) => glow(m, HL)); await wt(tok, 500);
    S.M.paint('5', FC.pink); S.M.tiles['5'].forEach((m) => glow(m, '#000000'));
    S.B.add('最後一國碰到三色 → 第 4 色', 'bad');
    cap('最後一國碰到紫、藍、橘', '只好用第 4 色粉紅');
  },
  async (tok, S) => { // 208.0
    S.M.all().forEach(kill);
    S.K = gmap(K4, 2.4, 5.2, 0.9);
    S.B.add('4 國兩兩相鄰的地圖');
    cap('只有 4 個國家', '但每兩國都有共同邊界');
  },
  async (tok, S) => { // 218.0
    S.K.paint('C', FC.orange); await wt(tok, 400);
    S.K.paint('A', FC.purple); await wt(tok, 400);
    S.K.paint('B', FC.blue);
    cap('前三國用掉橘、紫、藍', '');
  },
  async (tok, S) => { // 230.0
    S.K.paint('D', FC.pink);
    S.B.add('一定要 4 色：4 不能再少', 'good');
    cap('第 4 國碰到另外三國', '有些地圖真的要 4 色');
  },
]);

scene('fc-graph', '地圖 → 網路：平面圖', [
  async (tok, S) => { // 239.5
    S.B = board(-6.6, 6.4);
    S.B.add('把地圖變成網路');
    S.K = gmap(K4, 2.4, 5.2, 0.9);
    S.K.paint('A', FC.purple); S.K.paint('B', FC.blue); S.K.paint('C', FC.orange); S.K.paint('D', FC.pink);
    cap('拿剛才 4 國兩兩相鄰的地圖', '');
  },
  async (tok, S) => { // 250.0
    for (const k of 'ACBD') { const [x, y] = S.K.mid(k); node(k, FC.sand, x, y); await wt(tok, 200); }
    S.B.add('每個國家放一個點');
    cap('每個國家中間放一個點', '');
  },
  async (tok, S) => { // 259.0
    const pr = ['AB', 'AC', 'AD', 'BC', 'BD', 'CD'];
    for (const [a, b] of pr) { edge(S.K.mid(a), S.K.mid(b), '#3b2f20'); await wt(tok, 200); }
    S.K.all().forEach((m) => { m.scale.z = 0.3; m.material.transparent = true; m.material.opacity = 0.35; });
    S.B.add('有共同邊界 → 連一條線');
    cap('相鄰就連線：地圖變成網路（圖）', '著色 = 相連的點不同色');
  },
  async (tok, S) => { // 299.5
    S.B.add('不同地圖 → 可能同一個網路');
    T('像手提包的地圖也給出這個網路', 'idx', 3.75, 0.9);
    cap('形狀不同的地圖，網路可能一樣', '研究網路 = 一次研究很多地圖');
  },
  async (tok, S) => { // 344.5
    lab.clear(); S.B = board(-6.6, 6.4);
    S.B.add('不是每個網路都來自地圖');
    S.p5 = ring(3.8, 3.3, 1.9, 5);
    S.p5.forEach(([x, y], i) => node(String(i + 1), FC.sand, x, y));
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { edge(S.p5[i], S.p5[j]); await wt(tok, 120); }
    T('K₅：5 國兩兩相鄰', 'say', 3.8, 0.7);
    cap('5 個國家兩兩相鄰（K₅）', '');
  },
  async (tok, S) => { // 365.0
    lab.clear(); S.B = board(-6.6, 6.4);
    S.B.add('K₅ 怎麼畫都有交叉', 'bad');
    S.p5.forEach(([x, y], i) => node(String(i + 1), FC.sand, x, y));
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edge(S.p5[i], S.p5[j], (j - i === 2 || j - i === 3) ? '#c03030' : '#6e5f49');
    T('K₅ 不是平面圖', 'bad', 3.8, 0.7);
    cap('不管怎麼畫，K₅ 一定有線交叉', '畫不成地圖');
  },
  async (tok, S) => { // 385.5
    lab.clear(); S.B = board(-6.6, 6.4);
    S.B.add('交叉有時只是畫法不好');
    S.q = [[2.2, 4.9], [5.4, 4.9], [5.4, 1.7], [2.2, 1.7]];
    S.n = S.q.map(([x, y], i) => node('abcd'[i], FC.sand, x, y));
    S.e = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) S.e.push(edge(S.q[i], S.q[j], (i === 0 && j === 2) || (i === 1 && j === 3) ? '#c03030' : '#6e5f49'));
    cap('K₄ 這樣畫，對角線交叉了', '');
  },
  async (tok, S) => { // 400.0
    const from = S.q[3].slice(), to = [(2.2 + 5.4 + 5.4) / 3, (4.9 + 4.9 + 1.7) / 3];
    await anim(tok, 1000, (u) => { S.q[3] = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u]; S.n[3].position.set(S.q[3][0], S.q[3][1], 0.2); });
    S.e.forEach(kill); S.e = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) S.e.push(edge(S.q[i], S.q[j], OKG));
    S.B.add('能畫成不交叉 = 平面圖', 'good');
    T('planar graph', 'good', 3.8, 0.7);
    cap('把 d 移進來，交叉解開了', '邊不交叉的圖叫平面圖');
  },
]);

scene('fc-deg5', '每張地圖都有鄰國 ≤ 5 的國家', [
  async (tok, S) => { // 413.5
    S.B = board(-6.6, 6.4);
    S.B.add('任何地圖都有一國 A：');
    S.cx = [-5.4, -3.25, -1.1, 1.05, 3.2, 5.35];
    S.star = (k) => {
      const cx = S.cx[k], cy = 2.6;
      if (k) ring(cx, cy, 0.8, k).forEach((p) => { edge([cx, cy], p); node('', FC.sand, p[0], p[1]); });
      node('A', FC.orange, cx, cy);
      T(k ? k + ' 個' : '0（島）', 'idx', cx, 1.2);
    };
    S.star(0);
    cap('看地圖裡的某個國家 A', '它可能是一座島');
  },
  async (tok, S) => { // 430.0
    S.star(1); await wt(tok, 400); S.star(2);
    cap('A 可能有 1 個或 2 個鄰國', '');
  },
  async (tok, S) => { // 441.0
    S.star(3); cap('或 3 個鄰國', '');
  },
  async (tok, S) => { // 449.0
    S.star(4); cap('或 4 個鄰國', '');
  },
  async (tok, S) => { // 460.0
    S.star(5);
    S.B.add('鄰國數是 0、1、2、3、4、5 之一');
    cap('或 5 個鄰國', '每張地圖至少有一國長這樣');
  },
  async (tok, S) => { // 468.0
    S.B.add('每國都 ≥ 6 個鄰國？不可能', 'bad');
    T('每個國家都 ≥ 6 鄰國 → 網路解不開', 'bad', 0, 0.4);
    cap('不可能每國都有 6 個以上鄰國', '那樣的網路一定有交叉');
  },
  async (tok, S) => { // 483.0
    S.B.add('e ≤ 3v − 6 → 平均度數 < 6', 'good');
    T('所以一定有頂點度數 ≤ 5', 'good', 0, -0.4);
    cap('課本：簡單平面圖 e ≤ 3v − 6', '2e ≤ 6v − 12 → 有頂點度數 ≤ 5');
  },
]);

scene('fc-six', '六色定理：拿掉 A、著色、放回 A', [
  async (tok, S) => { // 498.5
    S.B = board(-6.6, 6.4);
    S.B.add('先證：6 色一定夠');
    cap('先證弱一點的版本', '沒有地圖需要 7 色');
  },
  async (tok, S) => { // 527.0
    S.B.add('假設：最小的「要 7 色」地圖');
    S.c = [3.8, 3.2];
    S.p = ring(3.8, 3.2, 1.9, 5);
    S.ex = [[6.4, 5.4], [6.6, 1.0], [1.0, 1.0]];
    for (let i = 0; i < 5; i++) edge(S.p[i], S.p[(i + 1) % 5]);
    edge(S.p[0], S.ex[0]); edge(S.p[4], S.ex[0]); edge(S.p[3], S.ex[1]); edge(S.p[2], S.ex[2]); edge(S.p[1], S.ex[2]);
    S.exN = S.ex.map(([x, y]) => node('', FC.gray, x, y));
    S.nb = S.p.map(([x, y]) => node('', FC.gray, x, y));
    S.sp = S.p.map((p) => edge(S.c, p));
    S.A = node('A', FC.gray, S.c[0], S.c[1]);
    T('示意：地圖的一部分', 'idx', 3.8, 6.1);
    cap('假設有地圖非 7 色不可', '取國家數最少的那張');
  },
  async (tok, S) => { // 540.0
    glow(S.A, HL);
    S.B.add('它有一國 A，鄰國 ≤ 5');
    cap('它一定有一國 A，鄰國 ≤ 5 個', '上一段的結論');
  },
  async (tok, S) => { // 550.0
    S.sp.forEach(kill); fly(S.A, V3(0, 6, 4));
    S.B.add('拿掉 A → 地圖變小');
    cap('把 A 拿掉', '少了一國');
  },
  async (tok, S) => { // 560.0
    S.pal = [FC.red, FC.orange, FC.green, FC.blue, FC.purple];
    for (let i = 0; i < 5; i++) { tint(S.nb[i], S.pal[i]); await wt(tok, 200); }
    [FC.blue, FC.red, FC.blue].forEach((c, i) => tint(S.exN[i], c));
    S.B.add('比最小還小 → 6 色可著色');
    T('最壞：5 個鄰國用了 5 種色', 'idx', 3.8, 0.3);
    cap('比最小的還小 → 6 色塗得完', '最壞情況：5 個鄰國 5 種顏色');
  },
  async (tok, S) => { // 571.0
    S.A = node('A', FC.teal, S.c[0], S.c[1]);
    S.sp = S.p.map((p) => edge(S.c, p));
    S.B.add('放回 A：第 6 色空著 → 矛盾', 'good');
    cap('放回 A：鄰國最多占 5 色', '第 6 色給 A → 6 色就夠，矛盾');
  },
  async (tok, S) => { // 591.0
    tint(S.A, FC.gray); glow(S.A, NG);
    S.q = T('5 色時：A 沒有空色？', 'bad', 3.8, -0.4);
    S.B.add('換 5 色：5 鄰國 5 種色就卡住', 'bad');
    cap('換成 5 色', '5 個鄰國剛好 5 種色就沒空位');
  },
  async (tok, S) => { // 605.0
    tint(S.nb[0], FC.green); await wt(tok, 500);
    tint(S.A, FC.red); glow(S.A, '#000000'); setT(S.q, '示意：Kempe chain 互換兩色，騰出紅色'); cls(S.q, 'good');
    S.B.add('先換色（Kempe chain）騰出一色');
    cap('先把某些國家換色，騰出一種顏色', '五色定理：多這一步');
  },
]);

scene('fc-proof', '四色定理：Appel 與 Haken 的電腦證明', [
  async (tok, S) => { // 624.5
    S.B = board(-6.6, 6.4);
    S.B.add('6 色 ✓　5 色 ✓　4 色 ？');
    cap('同樣的論證用在 4 色不夠強', '');
  },
  async (tok, S) => { // 640.0
    cube('1879 Kempe', FC.sand, [2.2, 0.6, 0.4], 1.8, 5.6, 0, 1);
    cube('1890 找到錯', FC.red, [2.2, 0.6, 0.4], 4.6, 5.6, 0, 1);
    S.B.add('證明被接受約十年才發現錯');
    cap('1879 年的證明被接受了約十年', '1890 年 Heawood 找到錯誤');
  },
  async (tok, S) => { // 658.5
    cube('1976 Appel & Haken', FC.green, [3.2, 0.6, 0.4], 3.2, 4.6, 0, 1);
    S.B.add('1976：伊利諾大學 Appel & Haken');
    cap('1976 年 Appel 與 Haken', '想法和剛才的證明類似');
  },
  async (tok, S) => { // 673.0
    S.cf = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) S.cf.push(cube('', PALE[(r + c) % 6], [0.5, 0.5, 0.3], 1.0 + c * 0.75, 3.4 - r * 0.75, 0));
    S.lt = T('unavoidable set：每張地圖必含其一', 'say', 3.6, 1.0);
    S.B.add('組態清單：每張地圖必含其一');
    cap('一份組態清單', '每張地圖至少含其中一個');
  },
  async (tok, S) => { // 687.0
    for (const m of S.cf) { tint(m, FC.green); await wt(tok, 60); }
    S.B.add('每個組態都可 4 色（reducible）', 'good');
    cap('每個組態都證明能 4 色著色', 'reducible');
  },
  async (tok, S) => { // 711.0
    setT(S.lt, '組態近兩千個（文獻常記 1,936）→ 電腦檢查');
    S.B.add('清單太長 → 交給電腦');
    cap('清單太長，只能交給電腦', '影片說 1,938 個');
  },
  async (tok, S) => { // 720.0
    S.B.add('第一個電腦輔助證明（有爭議）');
    cap('第一個重要的電腦輔助證明', '當時很多人有疑慮');
  },
  async (tok, S) => { // 758.0
    for (let i = S.cf.length - 1; i >= 12; i--) { fly(S.cf[i]); await wt(tok, 40); }
    setT(S.lt, '1996 Robertson 等人：633 個，仍需電腦');
    S.B.add('窮舉有效，但不說明「為什麼」', 'bad');
    cap('清單後來縮短，但仍要電腦', '還不是「漂亮」的證明');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '離散數學・第 8 章',
    title: '圖論（進階）：樹、平面圖、著色',
    color: 'var(--dm)',
    modes: [
      { id: 'span', name: '生成樹 DFS/BFS', enter: enterSpan },
      { id: 'mst', name: '最小生成樹', enter: () => enterMST() },
      { id: 'sp', name: '最短路徑', enter: () => enterSP() },
      { id: 'color', name: '著色與 P(G,λ)', enter: enterColor },
      { id: 'planar', name: '平面圖 Euler 公式', enter: enterPlanar },
      { id: 'match', name: '匹配與 Hall', enter: () => enterMatch() },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'tree-edges', 'st-remove-circuits', 'st-dfs', 'st-dfs-code', 'st-bfs', 'st-dfs-vs-bfs', 'st-directed-forest', 'st-exercise-remove', 'st-triangle-all',
      'cayley-k4', 'matrix-tree', 'kruskal', 'prim', 'dijkstra', 'cut-vertex', 'euler-trail', 'euler-formula', 'k5-k33', 'four-color',
      'col-map-dual', 'col-bipartite', 'col-complete', 'col-cycles', 'col-poly-map', 'col-poly-k4', 'hall-matching', 'max-flow',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
