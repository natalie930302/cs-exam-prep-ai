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
        const p = g.userData.mid.clone().addScaledVector(g.userData.side, G.dir ? 0.28 : 0.22);
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
    sm('要證「只有一條」：用反證——假設不只一條，推出矛盾', 0, 0.2); cap('證只有一條：反證法', '若非 Q 則非 P');
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
    if (s === 'draw' || s === 'title') { if (s === 'title') { S.t = sm(kind === 'pre' ? 'root → 左 subtree → 右 subtree' : kind === 'post' ? '左 subtree → 右 subtree → root' : '左 subtree → root → 右 subtree', 0, 6.75); } cap(head, s === 'draw' ? '老師的例子' : ''); return; }
    if (typeof s === 'string' && s.startsWith('say:')) { if (S.say) gone(S.say); S.say = sm(s.slice(4), 0, 0.2); cap(s.slice(4), ''); return; }
    if (s === 'final') {
      const got = order.join('');
      ok(got === LECT[kind], 0, -0.5, (kind === 'pre' ? 'preorder' : kind === 'post' ? 'postorder' : 'inorder') + '：' + order.join(' ') + '（跟老師的順序一樣 ✓）'); cap('全部走完', ''); return;
    }
    for (const v of s) {
      const want = order[S.k];
      S.g.vcol(want, TC.hot, HL); const n = S.k + 1; S.k++;
      const l = lab.label(String(n), 'idx'); l.position.set(0.32, 0.32, 0); S.g.V[want].add(l);
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
