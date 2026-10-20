// 演算法 第10章：近似演算法 / 亂數（隨機）演算法。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片清單裡有不少支其實是 Abdul Bari 的「回溯 Backtracking / 分支界限 Branch & Bound」，
// 這些場景照影片的例子做，標題一律標明「回溯」或「分支界限」：
//   6   Introduction to Backtracking：3 位學生（B1、B2、G1）坐 3 張椅子、條件「女生不坐中間」、DFS vs BFS。
//   6.3 Graph Coloring：5 頂點圖著色 R G R G B、m-coloring 三種問題、狀態空間樹 1+3+…+3⁴ 個節點、
//       正方形圖 1-2-3-4 用 bounding function 回溯（x1 = 紅那一支）、地圖著色。
//   7   Branch and Bound：4 個 job 的子集合樹、FIFO（queue）/ LIFO（stack）節點編號、LC 成本 ∞/25/12/19、8/7。
//   7.3 TSP Branch and Bound：字幕只到開頭；5 城市成本矩陣與 reduced-matrix 的計算取自課本（Horowitz/Sahni）。
// 章名要求的近似／隨機演算法以 CLRS 第 35 章與第 5、7 章為準：
//   APPROX-VERTEX-COVER（CLRS 圖 35.1 的 a–g 圖）、APPROX-TSP-TOUR（MST 前序走訪，需三角不等式）、
//   GREEDY-SET-COVER、RANDOMIZED-QUICKSORT（Las Vegas）、Monte Carlo 測試（Freivalds 矩陣乘積驗證，錯誤率 ≤ 1/2^k）。
//   N-Queens（4 皇后）與 Sum of Subsets（w = 5,10,12,13,15,18，m = 30）取自 Horowitz/Sahni 例題。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function reset(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    fn().catch((err) => { if (!/changed/.test(err.message)) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }

  // ───────────────────────── 共用小工具 ─────────────────────────
  const C = { R: '#d64545', G: '#2fc092', B: '#4b9ee2', Y: '#e0b23c', P: '#9b7ef4', O: '#dd8238', K: '#cfc4b0', D: '#6e5f49', PK: '#e55a9b' };
  const COL = { R: C.R, G: C.G, B: C.B, Y: C.Y };
  const CN = { R: '紅', G: '綠', B: '藍', Y: '黃' };
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', REDEM = '#5a1010', EDGE = '#b9a888';
  const INF = Infinity;
  const fmtI = (v) => (v === INF ? '∞' : String(v));
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function mark(text, color, x, y, z = 0) { const l = tag(text, '', x, y, z); Object.assign(l.element.style, { color, borderColor: color, fontWeight: '800' }); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
  const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function rod(a, b, color = EDGE, r = 0.05) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    placeRod(m, a, b); lab.world.add(m); return m;
  }
  function placeRod(m, a, b) {
    const d = b.clone().sub(a), len = Math.max(0.001, d.length());
    m.scale.set(1, len, 1);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }
  const ek = (a, b) => (String(a) < String(b) ? a + '-' + b : b + '-' + a);
  // graph: nodes {id: [x, y, z]}, edges [[a, b, w?]]
  function graph(nodes, edges, opt = {}) {
    const size = opt.size || [0.7, 0.5, 0.7];
    const N = {}, E = {}, W = {};
    for (const id in nodes) { const [x, y, z] = nodes[id]; N[id] = cube(opt.label ? opt.label(id) : id, opt.color || C.K, size, x, y, z, opt.drop ? 2.5 : 0); }
    for (const [a, b, w] of edges) {
      const pa = V3(...nodes[a]), pb = V3(...nodes[b]);
      E[ek(a, b)] = rod(pa, pb, EDGE, opt.r || 0.05);
      if (w !== undefined) W[ek(a, b)] = tag(String(w), 'idx', (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + 0.3, (pa.z + pb.z) / 2);
    }
    return { N, E, W, pos: nodes };
  }
  const adjOf = (ids, edges) => { const A = {}; ids.forEach((v) => (A[v] = [])); edges.forEach(([a, b]) => { A[a].push(b); A[b].push(a); }); return A; };
  // state space tree (vertical plane z = 0)
  function mkT(label, parent, extra) { const n = { label, kids: [], parent, ...(extra || {}) }; if (parent) parent.kids.push(n); return n; }
  function layout(root, x0, x1, yTop, dy) {
    let leaves = 0;
    const walk = (n, d) => { n.d = d; if (!n.kids.length) n.slot = leaves++; else { n.kids.forEach((k) => walk(k, d + 1)); n.slot = (n.kids[0].slot + n.kids[n.kids.length - 1].slot) / 2; } };
    walk(root, 0);
    const sx = leaves > 1 ? (x1 - x0) / (leaves - 1) : 0;
    const all = [];
    const put = (n) => { n.x = leaves > 1 ? x0 + n.slot * sx : (x0 + x1) / 2; n.y = yTop - n.d * dy; all.push(n); n.kids.forEach(put); };
    put(root);
    return all;
  }
  function drawT(n, color, size = [0.5, 0.42, 0.42], drop = true) {
    n.m = cube(n.label, color, size, n.x, n.y, 0, drop ? 1.2 : 0);
    if (n.parent) n.e = rod(V3(n.parent.x, n.parent.y - size[1] / 2, 0), V3(n.x, n.y + size[1] / 2, 0), EDGE, 0.03);
    return n.m;
  }
  function killT(n) { tint(n.m, '#bdb2a0'); glow(n.m, null); n.x2 = mark('✕', C.R, n.x, n.y + 0.5); }

  // ═════════════════════════ 回溯：學生坐椅子（Abdul Bari 6） ═════════════════════════
  const STU = [['B1', C.B], ['B2', C.P], ['G1', C.PK]];
  async function scStrategy(tok) {
    reset([0, 4.5, 13], [0, 2.6, 0]);
    say('Brute force：把所有可能的解都試一遍', '再從中挑出想要的解');
    const top = cube('Brute force', C.D, [3.4, 0.7, 1], 0, 5.2, 0, 3);
    await wait(tok, 2200);
    const kinds = [
      [-4.4, 'Dynamic Programming', C.P, '最佳化問題', 'DP 解 optimization problem'],
      [0, 'Backtracking', C.B, '要「所有」解・DFS', 'Backtracking 不是拿來做最佳化：要的是所有解'],
      [4.4, 'Branch & Bound', C.O, '最佳化（最小化）・BFS', 'Branch & Bound 也用狀態空間樹，但走 BFS'],
    ];
    for (const [x, name, col, sub, cap] of kinds) {
      rod(V3(0, 4.85, 0), V3(x, 2.65, 0), EDGE, 0.04);
      cube(name, col, [3.6, 0.7, 1], x, 2.3, 0, 3);
      tag(sub, 'idx', x, 1.4, 0.6);
      say(cap, '');
      await wait(tok, 2400);
    }
    glow(top, GOLD);
    say('三者都從 brute force 出發，差在「要什麼解、怎麼走」', '回溯：DFS＋bounding function；分支界限：BFS＋cost');
    await wait(tok, 3200);
  }
  function seatTree(bound) {
    const root = mkT('開始', null, { depth: 0 });
    const ev = [];
    (function dfs(n, used) {
      for (let s = 0; s < 3; s++) {
        if (used.includes(s)) continue;
        const d = used.length + 1;
        const k = mkT(STU[s][0], n, { s, depth: d, path: [...used, s] });
        k.killed = bound && d === 2 && s === 2;
        k.sol = !k.killed && d === 3;
        ev.push({ t: 'add', n: k });
        if (!k.killed && d < 3) dfs(k, [...used, s]);
        ev.push({ t: 'back', n: k });
      }
    })(root, []);
    return { root, ev };
  }
  async function scSeats(tok, bound) {
    reset([0, 4.6, 14.5], [0, 2.9, 0]);
    const { root, ev } = seatTree(bound);
    layout(root, -5.5, 5.5, 6.7, 1.55);
    drawT(root, C.D, [1.0, 0.42, 0.42], false);
    const chairX = [-1.8, 0, 1.8];
    chairX.forEach((x, i) => { ctx.tile(V3(x, 0.04, 2.6), 1.3, 1.1, '#e3d3b4'); tag('椅子 ' + (i + 1), 'idx', x, 0, 3.5); });
    const cnt = tag('解：0', 'ptr alt', 5.4, 0.3, 2.6);
    const seated = [];
    let sols = 0;
    say('3 位學生（B1、B2、G1）坐 3 張椅子', bound ? '條件：女生不能坐中間（椅子 2）' : '全部坐法 = 3! = 6，用狀態空間樹列出來');
    await wait(tok, 2800);
    for (const e of ev) {
      const n = e.n;
      if (e.t === 'add') {
        drawT(n, STU[n.s][1]);
        glow(n.m, GOLD);
        seated[n.depth - 1] = cube(STU[n.s][0], STU[n.s][1], [1.0, 0.8, 0.9], chairX[n.depth - 1], 0.48, 2.6, 2.5);
        if (n.killed) {
          glow(seated[n.depth - 1], REDEM);
          say('G1 坐到中間 → 違反條件', 'bounding function 把這個節點殺掉，不再往下長');
          await wait(tok, 1300);
          killT(n);
        } else if (n.sol) {
          sols++; txt(cnt, '解：' + sols);
          tag('✓', 'ptr alt', n.x, n.y - 0.6);
          glow(n.m, GREEN);
          say('第 ' + sols + ' 組解：' + n.path.map((s) => STU[s][0]).join('、'), '從 root 走到葉子的一條路徑 = 一組解');
          await wait(tok, 1100);
        } else {
          say('椅子 ' + n.depth + '：' + STU[n.s][0] + ' 坐下', '往下一層（DFS）');
          await wait(tok, 650);
        }
      } else {
        if (!n.sol && !n.killed) glow(n.m, null);
        if (n.sol) glow(n.m, null);
        const m = seated[n.depth - 1];
        if (m) { fly(m, V3(0, 7, 3)); seated[n.depth - 1] = null; }
        await wait(tok, 260);
      }
    }
    say(bound ? '加了條件：只剩 4 組解，而且少長了很多節點' : '6 條路徑 = 6 種坐法', bound ? '被殺掉的節點底下整棵子樹都不用產生' : '3! = 6');
    await wait(tok, 3200);
  }
  async function scDfsBfs(tok) {
    reset([0, 4.4, 14.5], [0, 3.4, 0]);
    const mk = () => seatTree(false).root;
    const L = mk(), R = mk();
    layout(L, -6.4, -0.8, 6.6, 1.6); layout(R, 0.8, 6.4, 6.6, 1.6);
    const pre = []; (function p(n) { pre.push(n); n.kids.forEach(p); })(L);
    const bfs = []; { const q = [R]; while (q.length) { const n = q.shift(); bfs.push(n); q.push(...n.kids); } }
    tag('Backtracking：DFS', 'ptr', -3.6, 7.5); tag('Branch & Bound：BFS', 'ptr alt', 3.6, 7.5);
    say('同一棵狀態空間樹，產生節點的順序不同', '方塊上的數字 = 第幾個產生');
    await wait(tok, 2600);
    for (let i = 0; i < pre.length; i++) {
      for (const n of [pre[i], bfs[i]]) { n.label = String(i + 1); drawT(n, n.s === undefined ? C.D : STU[n.s][1], [0.46, 0.4, 0.4]); }
      if (i === 3) say('DFS 一路走到底才回頭；BFS 先把同一層都產生', '');
      await wait(tok, 520);
    }
    say('回溯 = DFS；分支界限 = BFS（一層一層）', '兩者都是 brute force＋狀態空間樹');
    await wait(tok, 3400);
  }

  // ═════════════════════════ 回溯：Graph Coloring（Abdul Bari 6.3） ═════════════════════════
  // 例圖由字幕推得：1 紅、2 綠、3 紅、4 綠、5 藍；正方形 1-2-3-4-1 給回溯示範用。
  const GC5 = { nodes: { 1: [-2.4, 0.3, 1.6], 2: [-2.4, 0.3, -1.4], 3: [0.8, 0.3, -1.4], 4: [0.8, 0.3, 1.6], 5: [3.6, 0.3, 0.1] }, edges: [[1, 2], [2, 3], [3, 4], [4, 1], [3, 5], [4, 5]] };
  async function greedyColor(tok, g, adj, order, paletteOf, ms) {
    const col = {};
    for (const v of order) {
      let ok = false;
      for (const c of paletteOf(v)) {
        tint(g.N[v], COL[c]); glow(g.N[v], GOLD);
        const bad = adj[v].filter((u) => col[u] === c);
        bad.forEach((u) => { g.E[ek(u, v)].material.color.set(C.R); glow(g.N[u], REDEM); });
        say('頂點 ' + v + ' 試' + CN[c] + '色', bad.length ? '和相鄰的 ' + bad.join('、') + ' 同色 → 不行' : '相鄰頂點都不是' + CN[c] + '色 → 可以');
        await wait(tok, ms);
        bad.forEach((u) => { g.E[ek(u, v)].material.color.set(EDGE); glow(g.N[u], null); });
        glow(g.N[v], null);
        if (!bad.length) { col[v] = c; ok = true; break; }
      }
      if (!ok) { tint(g.N[v], C.K); glow(g.N[v], REDEM); return { col, fail: v }; }
    }
    return { col };
  }
  async function scGcIntro(tok) {
    reset([0, 8.5, 8.5], [0.4, 0, 0.1]);
    const g = graph(GC5.nodes, GC5.edges, { drop: true });
    const adj = adjOf(Object.keys(GC5.nodes).map(Number), GC5.edges);
    say('給一張圖和 3 種顏色：紅、綠、藍', '相鄰的兩個頂點不能同色');
    await wait(tok, 2600);
    const r1 = await greedyColor(tok, g, adj, [1, 2, 3, 4, 5], () => ['R', 'G', 'B'], 1000);
    say('一組解：紅 綠 紅 綠 藍', '頂點 1–5 = ' + [1, 2, 3, 4, 5].map((v) => CN[r1.col[v]]).join(' '));
    await wait(tok, 2600);
    [1, 2, 3, 4, 5].forEach((v) => tint(g.N[v], C.K));
    say('換個開頭：頂點 1 先給綠色', '同一張圖可以有不只一種著色');
    await wait(tok, 1800);
    const r2 = await greedyColor(tok, g, adj, [1, 2, 3, 4, 5], (v) => (v === 1 ? ['G'] : ['R', 'G', 'B']), 650);
    say('另一組解：' + [1, 2, 3, 4, 5].map((v) => CN[r2.col[v]]).join(' '), '要「所有」解 → 適合用回溯');
    await wait(tok, 3200);
  }
  async function scGcTypes(tok) {
    reset([0, 8.5, 8.5], [0.4, 0, 0.1]);
    const g = graph(GC5.nodes, GC5.edges);
    const adj = adjOf([1, 2, 3, 4, 5], GC5.edges);
    const mt = tag('m = 2', 'ptr', -4.6, 0.3, -2.6);
    say('只給 2 種顏色（紅、綠）塗得完嗎？', 'm-coloring decision problem');
    await wait(tok, 2200);
    const r = await greedyColor(tok, g, adj, [1, 2, 3, 4, 5], () => ['R', 'G'], 650);
    if (r.fail) {
      [[3, 4], [4, 5], [3, 5]].forEach(([a, b]) => g.E[ek(a, b)].material.color.set(C.Y));
      say('頂點 5 塗不下去：3、4、5 是三角形', '三角形至少要 3 色 → 2 色不行');
      await wait(tok, 3000);
    }
    for (const [m, pal] of [[3, ['R', 'G', 'B']], [4, ['R', 'G', 'B', 'Y']]]) {
      GC5.edges.forEach(([a, b]) => g.E[ek(a, b)].material.color.set(EDGE));
      [1, 2, 3, 4, 5].forEach((v) => { tint(g.N[v], C.K); glow(g.N[v], null); });
      txt(mt, 'm = ' + m);
      say('給 ' + m + ' 種顏色呢？', '');
      await wait(tok, 1200);
      await greedyColor(tok, g, adj, [1, 2, 3, 4, 5], () => pal, 260);
      say(m + ' 色可以塗', m === 4 ? '顏色多給也行，但不一定用得完' : '');
      await wait(tok, 1800);
    }
    say('三種問題：列出所有塗法／m 色夠不夠／最少要幾色', 'm-coloring decision、m-coloring optimization（chromatic number）');
    await wait(tok, 3400);
    say('這張圖最少要 3 色：chromatic number = 3', '');
    await wait(tok, 2400);
  }
  async function scGcTreeSize(tok) {
    reset([0, 4.6, 15], [0.6, 3.4, 0]);
    say('不檢查任何條件：4 個頂點、每個 3 種顏色', '把所有可能全畫成狀態空間樹');
    await wait(tok, 2400);
    let total = 0;
    const cols = ['R', 'G', 'B'];
    for (let d = 0; d <= 4; d++) {
      const cnt = Math.pow(3, d), y = 6.6 - d * 1.45, W = 11.2, cx = 1.0;
      const w = Math.min(0.55, W / cnt * 0.82);
      for (let i = 0; i < cnt; i++) {
        const x = cnt === 1 ? cx : cx - W / 2 + (i + 0.5) * W / cnt;
        cube(d && cnt <= 9 ? cols[i % 3] : '', d ? COL[cols[i % 3]] : C.D, [w, 0.38, 0.38], x, y, 0, d >= 3 ? 0 : 1);
      }
      total += cnt;
      tag(d ? 'x' + d + '：3^' + d + ' = ' + cnt : 'root：1', 'ptr', -5.6, y);
      say(d ? '第 ' + d + ' 層（頂點 ' + d + '）：' + cnt + ' 個節點' : '從 root 開始', '目前總共 ' + total + ' 個');
      await wait(tok, 1500);
    }
    say('1 + 3 + 3² + 3³ + 3⁴ = (3⁵ − 1)/2 = 121', '');
    await wait(tok, 2800);
    say('n 個頂點、m 種顏色 ≈ m^(n+1) 個節點 → O(mⁿ)', '指數時間；回溯會殺掉一部分，但最壞仍是 3ⁿ 等級');
    await wait(tok, 3400);
  }
  async function scGcBacktrack(tok) {
    reset([0.2, 4.4, 15], [0.2, 3.6, 0]);
    const SQ = { 1: [-6.1, 5.8, 0], 2: [-4.5, 5.8, 0], 3: [-4.5, 4.2, 0], 4: [-6.1, 4.2, 0] };
    const SE = [[1, 2], [2, 3], [3, 4], [4, 1]];
    const g = graph(SQ, SE, { size: [0.55, 0.5, 0.4], r: 0.04 });
    const adj = adjOf([1, 2, 3, 4], SE);
    const root = mkT('', null);
    const x1 = mkT('R', root, { v: 1, c: 'R' });
    const ev = [{ t: 'add', n: x1 }];
    (function dfs(node, asg) {
      const v = asg.length + 1;
      for (const c of ['R', 'G', 'B']) {
        const k = mkT(c, node, { v, c, asg: [...asg, c] });
        k.bad = adj[v].filter((u) => u < v && asg[u - 1] === c);
        k.killed = k.bad.length > 0;
        k.sol = !k.killed && v === 4;
        ev.push({ t: 'add', n: k });
        if (!k.killed && v < 4) dfs(k, [...asg, c]);
        ev.push({ t: 'back', n: k });
      }
    })(x1, ['R']);
    layout(root, -2.3, 6.6, 7.0, 1.5);
    drawT(root, C.D, [0.5, 0.42, 0.42], false);
    for (let d = 1; d <= 4; d++) tag('x' + d, 'ptr', -3.2, 7.0 - d * 1.5);
    const solT = [];
    say('正方形圖 1-2-3-4，3 種顏色，用回溯', '先固定 x1 = 紅，看這一支');
    await wait(tok, 2600);
    tint(g.N[1], C.R);
    for (const e of ev) {
      const n = e.n;
      if (e.t === 'add') {
        drawT(n, COL[n.c], [0.44, 0.4, 0.4]);
        tint(g.N[n.v], COL[n.c]);
        if (n.killed) {
          n.bad.forEach((u) => g.E[ek(u, n.v)].material.color.set(C.R));
          say('x' + n.v + ' = ' + CN[n.c] + '：和頂點 ' + n.bad.join('、') + ' 同色', 'bounding function → 殺掉');
          await wait(tok, 900);
          n.bad.forEach((u) => g.E[ek(u, n.v)].material.color.set(EDGE));
          killT(n);
          tint(g.N[n.v], C.K);
        } else if (n.sol) {
          glow(n.m, GREEN);
          tag('✓', 'ptr alt', n.x, n.y - 0.55);
          solT.push(tag(n.asg.join(' '), 'ptr alt', -5.3, 3.1 - solT.length * 0.5));
          say('找到一組解：' + n.asg.map((c) => CN[c]).join(' '), '走到最後一層都沒被殺 → 解');
          await wait(tok, 1100);
        } else {
          say('x' + n.v + ' = ' + CN[n.c] + '：合法，往下一個頂點', 'DFS');
          await wait(tok, 600);
        }
      } else {
        if (n.v > 1) tint(g.N[n.v], C.K);
        if (n.sol) glow(n.m, null);
        await wait(tok, 160);
      }
    }
    say('x1 = 紅 這一支有 6 組解；x1 = 綠、藍 同理', '共 18 組；最壞時間仍是 O(3ⁿ)');
    await wait(tok, 3600);
  }
  async function scGcMap(tok) {
    reset([0, 9, 7.5], [0, 0, 0.4]);
    const R = { 1: [-5, -3, -2, 2], 2: [-3, 0, -2, 0], 3: [-3, 0, 0, 2], 4: [0, 2.5, -2, 2], 5: [2.5, 5, -2, 2] };
    const tiles = {}, ctr = {};
    for (const id in R) {
      const [x0, x1, z0, z1] = R[id];
      ctr[id] = [(x0 + x1) / 2, 0.75, (z0 + z1) / 2];
      tiles[id] = ctx.tile(V3(ctr[id][0], 0.04, ctr[id][2]), x1 - x0 - 0.1, z1 - z0 - 0.1, '#e9dcc4');
    }
    say('一張地圖：相鄰的區域不能同色', '以前印刷：每多一色，紙就要多過一次印刷機');
    await wait(tok, 3000);
    const E = [[1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [4, 5]];
    say('每個區域 → 一個頂點', '');
    const g = graph(ctr, [], { drop: true, size: [0.6, 0.45, 0.6] });
    await wait(tok, 1800);
    for (const [a, b] of E) {
      g.E[ek(a, b)] = rod(V3(...ctr[a]), V3(...ctr[b]), EDGE, 0.05);
      say('區域 ' + a + ' 和 ' + b + ' 有共同邊界 → 畫一條邊', '');
      await wait(tok, 650);
    }
    const adj = adjOf([1, 2, 3, 4, 5], E);
    const r = await greedyColor(tok, g, adj, [1, 2, 3, 4, 5], () => ['R', 'G', 'B'], 450);
    for (const id in R) { tiles[id].material.color.set(COL[r.col[id]]); }
    say('頂點的顏色塗回地圖：3 色就夠', '只要過 3 次印刷機，不是 5 次');
    await wait(tok, 3400);
  }

  // ═════════════════════════ 分支界限：Job sequencing 的狀態空間樹（Abdul Bari 7） ═════════════════════════
  const JC = { 1: C.B, 2: C.P, 3: C.PK, 4: C.O };
  function jobTree() {
    const root = mkT('', null, { set: [] });
    (function grow(n) { const last = n.set.length ? n.set[n.set.length - 1] : 0; for (let j = last + 1; j <= 4; j++) grow(mkT('', n, { set: [...n.set, j], j })); })(root);
    return root;
  }
  function jobLegend(x, y) { [1, 2, 3, 4].forEach((j, i) => cube('J' + j, JC[j], [0.62, 0.42, 0.42], x + i * 0.75, y, 0)); }
  async function scBbForms(tok) {
    reset([0, 4.2, 13], [0, 2.4, 0]);
    say('Branch & Bound：也用狀態空間樹', '用來解最佳化問題，而且只做「最小化」（最大化可轉成最小化）');
    await wait(tok, 3000);
    const jobs = [1, 2, 3, 4].map((j) => cube('J' + j, JC[j], [1.2, 0.8, 1], -4.5 + (j - 1) * 1.6, 0.4, 0, 3));
    say('例：Job sequencing with deadlines，4 個 job', '');
    await wait(tok, 1800);
    for (const j of [1, 4]) { move(jobs[j - 1], -4.5 + (j - 1) * 1.6, 1.6, 0); glow(jobs[j - 1], GREEN); }
    say('一組解：做 J1 和 J4', '');
    await wait(tok, 1800);
    tag('子集合 {J1, J4}：大小會變（variable size）', 'ptr', 3.0, 3.4);
    await wait(tok, 1600);
    const bits = [1, 0, 0, 1].map((b, i) => cube(b, b ? C.G : C.K, [0.7, 0.6, 0.7], 1.6 + i * 0.95, 0.3, 0, 2.5));
    tag('(1, 0, 0, 1)：長度固定 = job 數（fixed size）', 'ptr alt', 3.0, 1.3);
    say('兩種表示法：子集合 vs 0/1 向量', '有時解是 2 個 job、有時 3 個 → 子集合長度會變');
    await wait(tok, 3200);
    for (const j of [1, 4]) { move(jobs[j - 1], -4.5 + (j - 1) * 1.6, 0.4, 0); glow(jobs[j - 1], null); }
    for (const j of [2, 3, 4]) { move(jobs[j - 1], -4.5 + (j - 1) * 1.6, 1.6, 0); glow(jobs[j - 1], GREEN); }
    [0, 1, 1, 1].forEach((b, i) => { relabel(bits[i], b); tint(bits[i], b ? C.G : C.K); });
    say('另一組解 {J2, J3, J4} = (0, 1, 1, 1)', '接下來的樹用「子集合」法來畫');
    await wait(tok, 3000);
  }
  async function scBbFifo(tok) {
    reset([0, 4.0, 14.5], [0.3, 3.2, 0]);
    const root = jobTree();
    layout(root, -4.8, 6.4, 6.8, 1.35);
    jobLegend(-6.4, 7.6);
    tag('Queue（FIFO）', 'ptr', -6.0, 0.9, 2.2);
    let num = 1; root.label = '1';
    drawT(root, C.D, [0.5, 0.42, 0.42], false);
    const Q = [];
    const qx = (i) => -4.4 + i * 0.82;
    const enq = (n) => { const m = cube(n.label, JC[n.j], [0.66, 0.46, 0.5], qx(Q.length), 0.3, 2.2, 2); Q.push({ n, m }); };
    say('BFS：取出一個節點，就把它的孩子全部產生', '產生的節點放進 queue（先進先出）');
    await wait(tok, 2600);
    let E = root;
    while (E) {
      glow(E.m, GOLD);
      if (E.kids.length) say('展開節點 ' + E.label + '（已選 ' + (E.set.length ? E.set.map((j) => 'J' + j).join(',') : '無') + '）', '孩子：' + E.kids.map((k) => 'J' + k.j).join('、'));
      for (const k of E.kids) {
        k.label = String(++num);
        drawT(k, JC[k.j], [0.46, 0.4, 0.4]);
        enq(k);
        await wait(tok, num <= 5 ? 650 : 380);
      }
      if (!E.kids.length) { say('節點 ' + E.label + ' 已經到 J4，不能再展開', ''); await wait(tok, 300); }
      glow(E.m, null);
      const nx = Q.shift();
      if (!nx) break;
      fly(nx.m, V3(-3, 6, 2));
      Q.forEach((q, i) => move(q.m, qx(i), 0.3, 2.2));
      E = nx.n;
      await wait(tok, 300);
    }
    say('FIFO Branch & Bound：用 queue 決定下一個展開誰', '節點 1–16 依層產生');
    await wait(tok, 3200);
  }
  async function scBbLifo(tok) {
    reset([0, 4.0, 14.5], [0.3, 3.2, 0]);
    const root = jobTree();
    layout(root, -4.0, 6.5, 6.8, 1.35);
    jobLegend(-6.4, 7.6);
    tag('Stack（LIFO）', 'ptr', -5.9, 0.0, 1.2);
    let num = 1; root.label = '1';
    drawT(root, C.D, [0.5, 0.42, 0.42], false);
    const S = [];
    const push = (n) => { S.push({ n, m: cube(n.label, JC[n.j], [0.8, 0.42, 0.6], -5.9, 0.6 + S.length * 0.48, 1.2, 2.5) }); };
    say('同樣「取出一個就把孩子全產生」', '但改用 stack 存：後進先出');
    await wait(tok, 2600);
    let E = root;
    while (E) {
      glow(E.m, GOLD);
      if (E.kids.length) say('展開節點 ' + E.label, '孩子依序 push：' + E.kids.map((k) => 'J' + k.j).join('、'));
      else say('pop 出節點 ' + E.label + '：已到 J4，不能展開', '');
      for (const k of E.kids) {
        k.label = String(++num);
        drawT(k, JC[k.j], [0.46, 0.4, 0.4]);
        push(k);
        await wait(tok, 520);
      }
      await wait(tok, 420);
      glow(E.m, null);
      const nx = S.pop();
      if (!nx) break;
      fly(nx.m, V3(3, 6, 2));
      E = nx.n;
      await wait(tok, 300);
    }
    say('LIFO Branch & Bound：用 stack 決定下一個', '產生方式仍是「一次產生全部孩子」（BFS 式展開）');
    await wait(tok, 3200);
  }
  async function scBbLc(tok) {
    reset([0, 4.0, 13.5], [0.6, 3.6, 0]);
    jobLegend(-6.4, 7.4);
    const root = mkT('1', null, { cost: INF });
    const kidsCost = [25, 12, 19, 30];
    const kids = [1, 2, 3, 4].map((j, i) => mkT(String(i + 2), root, { j, cost: kidsCost[i] }));
    const g1 = mkT('6', kids[1], { j: 3, cost: 8 }), g2 = mkT('7', kids[1], { j: 4, cost: 7 });
    layout(root, -3.4, 5.8, 6.6, 2.0);
    drawT(root, C.D, [0.5, 0.42, 0.42], false);
    const costTag = (n) => (n.ct = tag('c = ' + fmtI(n.cost), 'idx', n.x, n.y - 0.6));
    costTag(root);
    say('LC（Least Cost）Branch & Bound：每個節點算一個 cost', 'cost function 依問題而定（數字是老師隨手舉例）');
    await wait(tok, 3000);
    for (const k of kids) { drawT(k, JC[k.j], [0.5, 0.42, 0.42]); costTag(k); await wait(tok, 600); }
    say('下一個展開誰？', 'FIFO → 節點 2；LIFO → 節點 5；LC → cost 最小的');
    tag('FIFO', 'ptr', kids[0].x, kids[0].y + 0.75); tag('LIFO', 'ptr', kids[3].x, kids[3].y + 0.75);
    await wait(tok, 3000);
    glow(kids[1].m, GOLD); setCls(kids[1].ct, 'ptr alt');
    say('LC：選 cost = 12 的節點 3（J2）', '');
    await wait(tok, 2000);
    for (const k of [g1, g2]) { drawT(k, JC[k.j], [0.5, 0.42, 0.42]); costTag(k); await wait(tok, 700); }
    say('孩子 cost 8 和 7 → 選 7', '');
    glow(g2.m, GOLD); setCls(g2.ct, 'ptr alt');
    await wait(tok, 2000);
    glow(g2.m, GREEN); glow(kids[1].m, GREEN);
    say('節點 7 = {J2, J4} 已到最後一個 job → 解', '不用產生整棵樹，比 FIFO / LIFO 快');
    await wait(tok, 3400);
  }

  // ═════════════════════════ 分支界限：TSP（Abdul Bari 7.3；矩陣取自課本） ═════════════════════════
  const M5 = [[INF, 20, 30, 10, 11], [15, INF, 16, 4, 2], [3, 5, INF, 2, 4], [19, 6, 18, INF, 3], [16, 4, 7, 16, INF]];
  function reduceM(M) {
    const A = M.map((r) => r.slice()), n = A.length;
    let r = 0; const rows = [], cols = [];
    for (let i = 0; i < n; i++) { const m = Math.min(...A[i]); const k = m === INF ? 0 : m; rows.push(k); if (k) { A[i] = A[i].map((v) => (v === INF ? INF : v - k)); r += k; } }
    for (let j = 0; j < n; j++) { let m = INF; for (let i = 0; i < n; i++) m = Math.min(m, A[i][j]); const k = m === INF ? 0 : m; cols.push(k); if (k) { for (let i = 0; i < n; i++) if (A[i][j] !== INF) A[i][j] -= k; r += k; } }
    return { A, r, rows, cols };
  }
  const tourCost = (M, p) => p.reduce((s, v, i) => s + M[v][p[(i + 1) % p.length]], 0);
  function tspLC(M) {
    const n = M.length, R0 = reduceM(M);
    const root = mkT('1', null, { v: 0, path: [0], cost: R0.r, M: R0.A, red: R0 });
    const live = [root], steps = [];
    while (live.length) {
      live.sort((a, b) => a.cost - b.cost);
      const E = live.shift();
      if (E.path.length === n) { steps.push({ t: 'done', E }); return { root, steps, best: E }; }
      const kids = [];
      for (let j = 0; j < n; j++) {
        if (E.path.includes(j)) continue;
        const A = E.M.map((r) => r.slice()), cij = A[E.v][j];
        for (let k = 0; k < n; k++) { A[E.v][k] = INF; A[k][j] = INF; }
        A[j][0] = INF;
        const RR = reduceM(A);
        const path = [...E.path, j];
        const cost = path.length === n ? tourCost(M, path) : E.cost + cij + RR.r;
        const k = mkT(String(j + 1), E, { v: j, path, cost, M: RR.A, cij, r: RR.r, pc: E.cost });
        kids.push(k); live.push(k);
      }
      steps.push({ t: 'expand', E, kids });
    }
    return { root, steps, best: null };
  }
  function matrixView(M, x0, y0, dx = 0.92, dy = 0.66) {
    const n = M.length, cells = [];
    for (let j = 0; j < n; j++) tag(String(j + 1), 'ptr', x0 + j * dx, y0 + dy * 0.9);
    for (let i = 0; i < n; i++) {
      tag(String(i + 1), 'ptr', x0 - dx * 0.9, y0 - i * dy);
      cells.push(M[i].map((v, j) => tag(fmtI(v), 'idx', x0 + j * dx, y0 - i * dy)));
    }
    return {
      cells,
      set(A) { A.forEach((r, i) => r.forEach((v, j) => { txt(cells[i][j], fmtI(v)); setCls(cells[i][j], 'idx'); })); },
      hl(i, j, on = true) { setCls(cells[i][j], on ? 'ptr alt' : 'idx'); },
      row(i, on) { cells[i].forEach((c) => setCls(c, on ? 'ptr alt' : 'idx')); },
      col(j, on) { cells.forEach((r) => setCls(r[j], on ? 'ptr alt' : 'idx')); },
    };
  }
  async function scTspProblem(tok) {
    reset([0, 6, 12.5], [0, 1.6, 0]);
    const P = {}; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; P[i + 1] = [-3.6 + 2.3 * Math.cos(a), 0.3, 0.4 + 2.1 * Math.sin(a)]; }
    const g = graph(P, [], { drop: true, size: [0.6, 0.45, 0.6] });
    const mv = matrixView(M5, 1.7, 4.8);
    say('TSP：從城市 1 出發，每個城市恰好走一次，再回到 1', '成本矩陣 c(i, j)：i 到 j 的成本（課本 5 城市例）');
    await wait(tok, 3400);
    const tour = [1, 2, 3, 4, 5, 1];
    let sum = 0;
    const st = tag('總成本 = 0', 'ptr alt', -3.6, 0.3, 3.4);
    for (let k = 0; k < 5; k++) {
      const a = tour[k], b = tour[k + 1], c = M5[a - 1][b - 1];
      sum += c;
      const r = rod(V3(...P[a]), V3(...P[b]), C.O, 0.07);
      tag(String(c), 'ptr', (P[a][0] + P[b][0]) / 2, 0.8, (P[a][2] + P[b][2]) / 2);
      mv.hl(a - 1, b - 1);
      glow(g.N[b], GOLD);
      txt(st, '總成本 = ' + sum);
      say('隨便一條：' + a + ' → ' + b + '，成本 ' + c, '查矩陣第 ' + a + ' 列、第 ' + b + ' 行');
      await wait(tok, 1300);
      glow(g.N[b], null);
      void r;
    }
    say('1→2→3→4→5→1 成本 ' + sum + '；但這不是最短的', '所有環路有 (5−1)! = 24 條，要找最便宜的');
    await wait(tok, 3600);
  }
  async function scTspSmall(tok) {
    reset([0, 4.2, 14], [0, 3.4, 0]);
    const root = mkT('1', null, { path: [1] });
    (function grow(n) { for (const v of [2, 3, 4]) if (!n.path.includes(v)) grow(mkT(String(v), n, { path: [...n.path, v] })); })(root);
    layout(root, -5.2, 5.2, 6.6, 1.65);
    say('4 個城市：從 1 出發的狀態空間樹', '每條 root→葉子的路徑 = 一條環路（最後回 1）');
    drawT(root, C.D, [0.5, 0.42, 0.42], false);
    await wait(tok, 2600);
    const q = [root];
    while (q.length) {
      const n = q.shift();
      for (const k of n.kids) { drawT(k, [C.B, C.P, C.O][+k.label - 2], [0.48, 0.42, 0.42]); q.push(k); await wait(tok, 420); }
    }
    root.kids.forEach((a) => a.kids.forEach((b) => b.kids.forEach((c) => tag('→1', 'idx', c.x, c.y - 0.6))));
    say('葉子 = 3! = 6 條環路；n 城市 = (n−1)! 條', 'Branch & Bound：替每個節點算下界（lower bound），剪掉不可能更好的');
    await wait(tok, 3800);
  }
  async function scTspReduce(tok) {
    reset([0, 4.4, 14.5], [0, 3.4, 0]);
    const mv = matrixView(M5, -6.0, 6.0, 0.88, 0.62);
    const res = tspLC(M5);
    layout(res.root, -0.2, 6.6, 6.8, 1.45);
    const R0 = res.root.red;
    say('例：先做 reduced matrix', '每列減掉該列最小值，再每行減掉該行最小值');
    await wait(tok, 2600);
    let A = M5.map((r) => r.slice());
    for (let i = 0; i < 5; i++) {
      mv.row(i, true);
      const k = R0.rows[i];
      tag('−' + k, 'ptr', -1.5, 6.0 - i * 0.62);
      A[i] = A[i].map((v) => (v === INF ? INF : v - k));
      say('第 ' + (i + 1) + ' 列最小 ' + k, '');
      await wait(tok, 650);
      mv.set(A);
    }
    for (let j = 0; j < 5; j++) {
      const k = R0.cols[j];
      for (let i = 0; i < 5; i++) if (A[i][j] !== INF) A[i][j] -= k;
      tag('−' + k, 'ptr', -6.0 + j * 0.88, 2.6);
      mv.set(A); mv.col(j, true);
      say('第 ' + (j + 1) + ' 行最小 ' + k, '');
      await wait(tok, 550);
    }
    mv.set(A);
    const sr = R0.rows.reduce((a, b) => a + b, 0), sc = R0.cols.reduce((a, b) => a + b, 0);
    say('下界 = ' + sr + ' + ' + sc + ' = ' + res.root.cost, '任何環路的成本都不會比 ' + res.root.cost + ' 少');
    drawT(res.root, C.D, [0.5, 0.42, 0.42], false);
    res.root.ct = tag(String(res.root.cost), 'idx', res.root.x, res.root.y - 0.55);
    await wait(tok, 3000);
    for (const s of res.steps) {
      if (s.t === 'expand') {
        glow(s.E.m, GOLD);
        say('展開 cost 最小的節點（路徑 ' + s.E.path.map((v) => v + 1).join('→') + '）', '');
        await wait(tok, 1300);
        for (const k of s.kids) {
          drawT(k, C.B, [0.48, 0.42, 0.42]);
          k.ct = tag(String(k.cost), 'idx', k.x, k.y - 0.55);
          mv.set(k.M);
          const last = k.path.length === 5;
          say('走 ' + (s.E.v + 1) + '→' + (k.v + 1) + '：列 ' + (s.E.v + 1) + '、行 ' + (k.v + 1) + ' 設 ∞，再化簡',
            last ? '最後一個城市：環路實際成本 = ' + k.cost : 'cost = ' + k.pc + ' + A(' + (s.E.v + 1) + ',' + (k.v + 1) + ')=' + k.cij + ' + r=' + k.r + ' = ' + k.cost);
          await wait(tok, 1500);
        }
        glow(s.E.m, null);
      } else {
        let n = s.E; while (n) { glow(n.m, GREEN); n = n.parent; }
        say('最佳環路：' + s.E.path.map((v) => v + 1).join('→') + '→1 = ' + s.E.cost, '其他活節點的下界都 ≥ ' + s.E.cost + ' → 不必再展開');
        await wait(tok, 4000);
      }
    }
  }

  // ═════════════════════════ 近似演算法（CLRS 35） ═════════════════════════
  async function scApproxRatio(tok) {
    reset([0, 4.5, 13], [0, 2.6, 0]);
    say('NP-complete 問題：找不到多項式時間的最佳解', '退而求其次：多項式時間、保證不會差太多');
    await wait(tok, 3000);
    const bOpt = cube('', C.G, [1.4, 1, 1.2], -4.2, 0.01, 0); bOpt.scale.y = 0.01;
    const bAlg = cube('', C.O, [1.4, 1, 1.2], -2.0, 0.01, 0); bAlg.scale.y = 0.01;
    const grow = (m, h) => anim(tok, 700, (t) => { m.scale.y = Math.max(0.01, h * t); m.position.y = m.scale.y / 2; });
    tag('C* = 3（最佳）', 'ptr', -4.2, 0, 1.2);
    await grow(bOpt, 1.8);
    tag('C = 6（近似）', 'ptr alt', -2.0, 0, 1.2);
    await grow(bAlg, 3.6);
    say('最小化問題：C ≤ ρ · C*', '這裡 C / C* = 6 / 3 = 2 → 2-approximation');
    await wait(tok, 3000);
    const cOpt = cube('', C.G, [1.4, 1, 1.2], 2.0, 0.01, 0); cOpt.scale.y = 0.01;
    const cAlg = cube('', C.O, [1.4, 1, 1.2], 4.2, 0.01, 0); cAlg.scale.y = 0.01;
    tag('C* = 8（最佳）', 'ptr', 2.0, 0, 1.2); tag('C = 5（近似）', 'ptr alt', 4.2, 0, 1.2);
    await grow(cOpt, 4.0); await grow(cAlg, 2.5);
    say('最大化問題：C* ≤ ρ · C', 'C* / C = 8 / 5 = 1.6');
    await wait(tok, 2800);
    say('近似比 ρ(n)：max(C/C*, C*/C) ≤ ρ(n)', 'ρ(n) ≥ 1；越接近 1 越好');
    await wait(tok, 3400);
  }
  // CLRS 圖 35.1
  const VCG = { nodes: { a: [-4.6, 0.3, -1.6], b: [-1.6, 0.3, -1.6], c: [1.4, 0.3, -1.6], d: [4.4, 0.3, -1.6], e: [-0.2, 0.3, 1.8], f: [2.6, 0.3, 1.8], g: [5.2, 0.3, 1.4] },
    edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['c', 'e'], ['d', 'e'], ['d', 'f'], ['d', 'g'], ['e', 'f']] };
  async function vcRun(tok, g, edges, pick, ms, quiet) {
    const left = edges.map(([a, b]) => ek(a, b));
    const Cv = [], A = [];
    while (left.length) {
      const key = pick(left);
      const [u, v] = key.split('-');
      g.E[key].material.color.set(C.Y);
      if (!quiet) say('任挑一條還沒被覆蓋的邊 (' + u + ', ' + v + ')', '把兩個端點 ' + u + '、' + v + ' 都放進 C');
      await wait(tok, ms);
      A.push(key);
      for (const x of [u, v]) { if (!Cv.includes(x)) { Cv.push(x); tint(g.N[x], C.O); move(g.N[x], g.pos[x][0], 0.75, g.pos[x][2]); } }
      await wait(tok, ms * 0.6);
      const gone = left.filter((k) => k.split('-').some((x) => x === u || x === v));
      gone.forEach((k) => { if (k !== key) g.E[k].material.color.set(C.R); });
      if (!quiet) say('刪掉所有碰到 ' + u + ' 或 ' + v + ' 的邊', '共刪 ' + gone.length + ' 條');
      await wait(tok, ms * 0.8);
      gone.forEach((k) => { left.splice(left.indexOf(k), 1); if (k !== key) g.E[k].visible = false; });
    }
    return { Cv, A };
  }
  async function scVc2(tok) {
    reset([0, 8.5, 8.5], [0.3, 0, 0.1]);
    const g = graph(VCG.nodes, VCG.edges, { drop: true });
    say('Vertex cover：選一組頂點，讓每條邊至少有一端被選到', 'APPROX-VERTEX-COVER（CLRS 圖 35.1）');
    await wait(tok, 3000);
    const order = ['b-c', 'e-f', 'd-g'];
    const r = await vcRun(tok, g, VCG.edges, (left) => order.find((k) => left.includes(k)), 1300);
    say('C = {' + r.Cv.sort().join(', ') + '}，|C| = ' + r.Cv.length, '');
    await wait(tok, 2600);
    VCG.edges.forEach(([a, b]) => { const k = ek(a, b); g.E[k].visible = true; g.E[k].material.color.set(EDGE); });
    for (const x in VCG.nodes) { tint(g.N[x], C.K); move(g.N[x], VCG.nodes[x][0], 0.3, VCG.nodes[x][2]); }
    await wait(tok, 600);
    for (const x of ['b', 'd', 'e']) { tint(g.N[x], C.G); glow(g.N[x], GREEN); }
    say('最佳解只要 {b, d, e}：|C*| = 3', '6 / 3 = 2 → 剛好碰到 2 倍的上限');
    await wait(tok, 3600);
  }
  async function scVcWhy(tok) {
    reset([0, 8.5, 8.5], [0.3, 0, 0.1]);
    const g = graph(VCG.nodes, VCG.edges);
    say('為什麼保證不超過 2 倍？', '看演算法挑到的邊集合 A');
    await wait(tok, 2400);
    const A = [['b', 'c'], ['e', 'f'], ['d', 'g']];
    for (const [u, v] of A) { g.E[ek(u, v)].material.color.set(C.Y); tint(g.N[u], C.O); tint(g.N[v], C.O); await wait(tok, 700); }
    say('A 的邊彼此不共用端點（挑完就刪掉相鄰邊）', '|C| = 2|A| = 6');
    await wait(tok, 3000);
    for (const x of ['b', 'd', 'e']) glow(g.N[x], GREEN);
    for (const [u, v] of A) {
      const w = ['b', 'd', 'e'].find((x) => x === u || x === v);
      move(g.N[w], VCG.nodes[w][0], 0.8, VCG.nodes[w][2]);
      say('任何 cover 都要蓋住 (' + u + ', ' + v + ') → 至少含 ' + u + ' 或 ' + v, '最佳解在這條邊用了 ' + w);
      await wait(tok, 1500);
    }
    say('A 的邊端點互不重疊 → |C*| ≥ |A|', '|C| = 2|A| ≤ 2|C*|：2-approximation');
    await wait(tok, 3800);
  }
  // APPROX-TSP-TOUR
  const PTS = { a: [-4.6, -1.7], b: [-1.8, -2.3], c: [1.2, -1.5], d: [4.4, -2.1], e: [-3.8, 1.5], f: [-0.8, 0.5], g: [1.9, 1.9], h: [4.8, 1.0] };
  const dist = (P, a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);
  function prim(P, ids) {
    const inT = [ids[0]], E = [];
    while (inT.length < ids.length) {
      let best = null;
      for (const u of inT) for (const v of ids) if (!inT.includes(v)) { const d = dist(P, u, v); if (!best || d < best[2]) best = [u, v, d]; }
      E.push(best); inT.push(best[1]);
    }
    return E;
  }
  function walks(ids, E) {
    const ch = {}; ids.forEach((v) => (ch[v] = []));
    E.forEach(([u, v]) => ch[u].push(v));
    const full = [], pre = [];
    (function dfs(v) { pre.push(v); full.push(v); ch[v].forEach((c) => { dfs(c); full.push(v); }); })(ids[0]);
    return { full, pre };
  }
  function optTour(P, ids) {
    const first = ids[0], rest = ids.slice(1);
    let best = INF, bestP = null;
    (function perm(arr, k) {
      if (k === arr.length) { const p = [first, ...arr]; const c = p.reduce((s, v, i) => s + dist(P, v, p[(i + 1) % p.length]), 0); if (c < best) { best = c; bestP = p; } return; }
      for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; }
    })(rest.slice(), 0);
    return { cost: best, path: bestP };
  }
  const tourLen = (P, p) => p.reduce((s, v, i) => s + dist(P, v, p[(i + 1) % p.length]), 0);
  async function scTspMst(tok) {
    reset([0, 9, 7.5], [0, 0, 0]);
    const ids = Object.keys(PTS);
    const nodes = {}; ids.forEach((k) => (nodes[k] = [PTS[k][0], 0.3, PTS[k][1]]));
    const g = graph(nodes, [], { drop: true, size: [0.55, 0.45, 0.55] });
    say('平面上的點：距離滿足三角不等式', 'c(u, w) ≤ c(u, v) + c(v, w)');
    await wait(tok, 2600);
    const E = prim(PTS, ids);
    const T = E.reduce((s, e) => s + e[2], 0);
    say('步驟 1：從 a 開始用 Prim 算 MST', '');
    for (const [u, v] of E) { rod(V3(...nodes[u]), V3(...nodes[v]), C.Y, 0.07); await wait(tok, 550); }
    say('MST 成本 c(T) = ' + T.toFixed(1), '拿掉最佳環路的一條邊就是一棵生成樹 → c(T) ≤ c(H*)');
    await wait(tok, 3200);
    const { full, pre } = walks(ids, E);
    const ball = cube('', C.R, [0.35, 0.35, 0.35], nodes.a[0], 1.0, nodes.a[2]);
    say('步驟 2：沿著樹走一圈（full walk），每條邊走兩次', '成本 = 2c(T) = ' + (2 * T).toFixed(1));
    for (let i = 1; i < full.length; i++) {
      const p0 = nodes[full[i - 1]], p1 = nodes[full[i]];
      await anim(tok, 260, (t) => { ball.position.set(p0[0] + (p1[0] - p0[0]) * t, 1.0, p0[2] + (p1[2] - p0[2]) * t); });
    }
    kill(ball);
    await wait(tok, 800);
    say('步驟 3：跳過走過的點（shortcut）→ 前序 ' + pre.join(' '), '三角不等式：抄捷徑不會變長');
    const H = [...pre, pre[0]];
    for (let i = 0; i + 1 < H.length; i++) { rod(V3(nodes[H[i]][0], 0.55, nodes[H[i]][2]), V3(nodes[H[i + 1]][0], 0.55, nodes[H[i + 1]][2]), C.O, 0.05); glow(g.N[H[i]], GOLD); await wait(tok, 420); }
    const cH = tourLen(PTS, pre), opt = optTour(PTS, ids);
    say('c(H) = ' + cH.toFixed(1) + '　最佳 c(H*) = ' + opt.cost.toFixed(1), 'c(H) ≤ 2c(T) ≤ 2c(H*) → 2-approximation');
    await wait(tok, 4000);
    say('一般 TSP（沒有三角不等式）：除非 P = NP，否則沒有常數倍近似', 'CLRS 定理 35.3');
    await wait(tok, 3200);
  }
  // GREEDY-SET-COVER（自建例子：greedy 4 個 vs 最佳 3 個）
  async function scSetCover(tok) {
    reset([0, 8.6, 7.6], [0, 0, 0.2]);
    const P = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) P.push([-3 + c * 2, 0.25, -1.8 + r * 1.8]);
    const pts = P.map((p, i) => cube(i, C.K, [0.55, 0.4, 0.55], p[0], p[1], p[2], 2));
    const SETS = [['S1', [0, 1, 2, 3], C.B], ['S2', [4, 5, 6, 7], C.P], ['S3', [8, 9, 10, 11], C.PK], ['S4', [1, 2, 5, 6, 9], C.O]];
    const panel = SETS.map(([nm, s], i) => tag(nm + '：' + s.length + ' 點', 'ptr', 5.6, 0.3, -2.2 + i * 1.1));
    say('Set cover：用最少的集合蓋住全部 12 個點', 'GREEDY-SET-COVER：每次挑「蓋到最多新點」的集合');
    await wait(tok, 3000);
    for (const [nm, s, col] of SETS) { s.forEach((i) => glow(pts[i], GOLD)); say(nm + ' = {' + s.join(', ') + '}', ''); await wait(tok, 900); s.forEach((i) => glow(pts[i], null)); }
    const covered = new Set(), used = [];
    while (covered.size < 12) {
      const gains = SETS.map(([, s]) => s.filter((i) => !covered.has(i)).length);
      SETS.forEach(([nm], i) => { txt(panel[i], nm + '：新點 ' + gains[i]); setCls(panel[i], used.includes(i) ? 'idx' : 'ptr'); });
      let bi = 0; gains.forEach((g, i) => { if (g > gains[bi]) bi = i; });
      setCls(panel[bi], 'ptr alt');
      const [nm, s, col] = SETS[bi];
      say('挑 ' + nm + '：多蓋 ' + gains[bi] + ' 個新點', '');
      await wait(tok, 1500);
      s.forEach((i) => { if (!covered.has(i)) { tint(pts[i], col); move(pts[i], P[i][0], 0.45 + used.length * 0.05, P[i][2]); } covered.add(i); });
      used.push(bi);
      await wait(tok, 900);
    }
    say('Greedy 用了 ' + used.length + ' 個：' + used.map((i) => SETS[i][0]).join('、'), '最佳只要 S1、S2、S3 共 3 個');
    await wait(tok, 3200);
    say('Greedy 是 H(max|S|) 近似：H(5) ≈ 2.28', '4 / 3 ≈ 1.33 ≤ 2.28；H(d) = 1 + 1/2 + … + 1/d ≤ ln d + 1');
    await wait(tok, 3600);
  }

  // ═════════════════════════ 隨機演算法 ═════════════════════════
  function rqsEvents(arr0) {
    const A = arr0.slice(), ev = [];
    let comps = 0;
    function part(p, r) {
      const i0 = p + rnd(r - p + 1);
      ev.push({ t: 'pivot', i: i0, p, r });
      if (i0 !== r) { [A[i0], A[r]] = [A[r], A[i0]]; ev.push({ t: 'swap', a: i0, b: r }); }
      const x = A[r]; let i = p - 1;
      for (let j = p; j < r; j++) {
        comps++; ev.push({ t: 'cmp', j, r, less: A[j] <= x, comps });
        if (A[j] <= x) { i++; if (i !== j) { [A[i], A[j]] = [A[j], A[i]]; ev.push({ t: 'swap', a: i, b: j }); } }
      }
      if (i + 1 !== r) { [A[i + 1], A[r]] = [A[r], A[i + 1]]; ev.push({ t: 'swap', a: i + 1, b: r }); }
      ev.push({ t: 'fixed', i: i + 1 });
      return i + 1;
    }
    (function qs(p, r) { if (p < r) { const q = part(p, r); qs(p, q - 1); qs(q + 1, r); } else if (p === r) ev.push({ t: 'fixed', i: p }); })(0, A.length - 1);
    return { ev, comps, sorted: A };
  }
  const qsX = (i, n) => (i - (n - 1) / 2) * 1.35;
  function drawBars(arr) {
    const n = arr.length;
    return arr.map((v, i) => { const h = 0.4 + v * 0.42; const m = cube(v, C.B, [1.0, h, 0.9], qsX(i, n), h / 2, 0); m.userData.h = h; return m; });
  }
  async function playRqs(tok, bars, ev, ms, onCmp) {
    const n = bars.length, at = bars.slice();
    for (const e of ev) {
      if (e.t === 'pivot') {
        at.forEach((m, k) => glow(m, k >= e.p && k <= e.r ? null : null));
        glow(at[e.i], GOLD); tint(at[e.i], C.Y);
        await wait(tok, ms * 2);
      } else if (e.t === 'swap') {
        const ma = at[e.a], mb = at[e.b];
        move(ma, qsX(e.b, n), ma.userData.h / 2, 0); move(mb, qsX(e.a, n), mb.userData.h / 2, 0);
        at[e.a] = mb; at[e.b] = ma;
        await wait(tok, ms);
      } else if (e.t === 'cmp') {
        glow(at[e.j], e.less ? GREEN : REDEM);
        if (onCmp) onCmp(e.comps);
        await wait(tok, ms);
        glow(at[e.j], null);
      } else if (e.t === 'fixed') {
        tint(at[e.i], C.G); glow(at[e.i], null);
      }
    }
  }
  async function scRandQs(tok) {
    reset([0, 5, 13], [0, 1.8, 0]);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const cnt = tag('比較 0 次', 'ptr alt', 0, 5.3);
    say('輸入已經排好：固定拿最後一個當 pivot 會最慘', '每次只切掉 1 個：(n−1)+…+1 = 28 次比較，Θ(n²)');
    drawBars(arr);
    await wait(tok, 3400);
    const res = [];
    for (let run = 1; run <= 2; run++) {
      lab.clear();
      const cntL = tag('比較 0 次', 'ptr alt', 0, 5.3);
      void cnt;
      tag('第 ' + run + ' 次執行', 'ptr', -4.6, 5.3);
      const bars = drawBars(arr);
      const r = rqsEvents(arr);
      say('RANDOMIZED-QUICKSORT：pivot 隨機挑', '金色 = 這次的 pivot；綠 = 位置已確定');
      await playRqs(tok, bars, r.ev, 150, (c) => txt(cntL, '比較 ' + c + ' 次'));
      res.push(r.comps);
      say('第 ' + run + ' 次：' + r.comps + ' 次比較，結果一樣排好', '');
      await wait(tok, 2000);
    }
    say('每次比較次數不同（' + res.join('、') + '），答案永遠正確', '期望時間 O(n lg n)，與輸入順序無關 → Las Vegas');
    await wait(tok, 3800);
  }
  async function scLvMc(tok) {
    reset([0, 4.6, 13.5], [0, 2.4, 0]);
    tag('Las Vegas', 'ptr', -3.6, 5.8); tag('Monte Carlo', 'ptr alt', 3.6, 5.8);
    say('兩種隨機演算法', '');
    await wait(tok, 1600);
    // Las Vegas: comparisons histogram of randomized quicksort, n = 8
    const hist = {}; for (let k = 0; k < 400; k++) { const c = rqsEvents([1, 2, 3, 4, 5, 6, 7, 8]).comps; hist[c] = (hist[c] || 0) + 1; }
    const ks = Object.keys(hist).map(Number).sort((a, b) => a - b);
    const lo = ks[0], hi = ks[ks.length - 1], mx = Math.max(...Object.values(hist));
    say('Las Vegas：答案一定對，花多少時間是隨機的', '隨機快排跑 400 次的比較次數分布（n = 8）');
    for (const c of ks) {
      const x = -6.2 + (c - lo) / Math.max(1, hi - lo) * 5.2;
      const h = 0.1 + hist[c] / mx * 3.2;
      const m = cube('', C.B, [Math.max(0.12, 5.2 / (hi - lo + 1) * 0.8), 1, 0.6], x, 0.01, 0); m.scale.y = 0.01;
      await anim(tok, 90, (t) => { m.scale.y = h * t; m.position.y = m.scale.y / 2; });
    }
    tag(lo + ' 次', 'idx', -6.2, 0, 0.8); tag(hi + ' 次', 'idx', -1.0, 0, 0.8);
    tag('結果：全部排好 ✓', 'ptr', -3.6, 4.4);
    await wait(tok, 2600);
    say('Monte Carlo：時間固定，答案可能錯（錯的機率有上限）', '例：Freivalds 驗證 A·B = C，一次 O(n²)，錯誤率 ≤ 1/2');
    let wrong = 0;
    for (let k = 0; k < 16; k++) {
      const miss = Math.random() < 0.5;
      if (miss) wrong++;
      cube(miss ? '錯' : '對', miss ? C.R : C.G, [0.62, 0.62, 0.62], 1.4 + (k % 8) * 0.68, 0.32 + Math.floor(k / 8) * 0.7, 0, 2);
      await wait(tok, 180);
    }
    tag('每次花的時間一樣', 'ptr alt', 3.6, 4.4);
    say('C 其實是錯的：16 次單獨測試中 ' + wrong + ' 次誤判「相等」', '所以要重複做好幾次');
    await wait(tok, 3200);
    say('Las Vegas：一定對、時間隨機；Monte Carlo：時間固定、可能錯', '例：隨機快排 = Las Vegas；Miller–Rabin、Freivalds = Monte Carlo');
    await wait(tok, 4000);
  }
  // Freivalds：A·B ?= C（C 在 (1,2) 那格故意錯 1）
  const FA = [[1, 2, 0], [0, 1, 1], [1, 0, 1]], FB = [[1, 0, 1], [2, 1, 0], [0, 1, 1]];
  const mmul = (X, Y) => X.map((r) => Y[0].map((_, j) => r.reduce((s, v, k) => s + v * Y[k][j], 0)));
  const mvec = (X, v) => X.map((r) => r.reduce((s, a, k) => s + a * v[k], 0));
  function freivaldsC() { const Cm = mmul(FA, FB); Cm[0][1] += 1; return Cm; }
  async function scMcTrials(tok) {
    reset([0, 4.6, 13.5], [0, 2.6, 0]);
    const Cm = freivaldsC();
    say('Monte Carlo 測試：A·B 等於 C 嗎？（其實 C 有一格錯）', '隨機挑 r ∈ {0,1}ⁿ，比 A(Br) 和 Cr：O(n²)，不用算 A·B 的 O(n³)');
    await wait(tok, 3400);
    tag('單次錯誤率上限', 'ptr', 3.0, 5.2);
    const bars = [];
    for (let k = 1; k <= 8; k++) {
      const h = 4 * Math.pow(0.5, k - 1) * 0.5 + 0.03;
      const m = cube('', C.R, [0.55, 1, 0.55], -0.2 + k * 0.82, 0.01, 0); m.scale.y = 0.01;
      tag('k=' + k, 'idx', -0.2 + k * 0.82, 0, 0.8);
      bars.push([m, h, k]);
    }
    let caught = 0;
    for (let k = 1; k <= 8; k++) {
      const r = [rnd(2), rnd(2), rnd(2)];
      const lhs = mvec(FA, mvec(FB, r)), rhs = mvec(Cm, r);
      const diff = lhs.some((v, i) => v !== rhs[i]);
      if (diff) caught++;
      cube(diff ? '≠' : '=', diff ? C.G : C.K, [0.6, 0.6, 0.6], -6.2 + ((k - 1) % 4) * 0.8, 0.32 + Math.floor((k - 1) / 4) * 0.72, 0, 2);
      log('第 ' + k + ' 次：r = (' + r.join(', ') + ') → ' + (diff ? 'A(Br) ≠ Cr' : 'A(Br) = Cr'));
      const [m, h] = bars[k - 1];
      await anim(tok, 300, (t) => { m.scale.y = h * t; m.position.y = m.scale.y / 2; });
      say('第 ' + k + ' 次：' + (diff ? '抓到不相等 → 確定 A·B ≠ C' : '沒抓到（r 剛好沒選到錯的那一行）'), k + ' 次都沒抓到的機率 ≤ (1/2)^' + k + ' = ' + (+Math.pow(0.5, k).toFixed(4)));
      await wait(tok, 1100);
    }
    say('只要一次「≠」就一定是錯的；一直「=」才可能誤判', 'k 次獨立重複：錯誤率 ≤ 1/2^k，指數下降');
    await wait(tok, 3800);
    void caught;
  }

  // ═════════════════════════ 回溯：例題 4-Queens、Sum of Subsets ═════════════════════════
  function queensEvents(n, maxSol) {
    const ev = []; let sols = 0;
    const col = [];
    (function place(r) {
      for (let c = 0; c < n; c++) {
        if (sols >= maxSol) return;
        const att = col.findIndex((cc, rr) => cc === c || Math.abs(cc - c) === r - rr);
        ev.push({ t: 'try', r, c, att, tuple: [...col, c] });
        if (att >= 0) { ev.push({ t: 'kill', r, c }); continue; }
        col.push(c);
        if (r === n - 1) { sols++; ev.push({ t: 'sol', tuple: col.slice(), k: sols }); }
        else place(r + 1);
        col.pop();
        if (sols >= maxSol) return;
        ev.push({ t: 'back', r, c });
      }
    })(0);
    return ev;
  }
  async function playQueens(tok, n, ev, ms, onTick) {
    const S = 5.4 / n, X = (c) => (c - (n - 1) / 2) * S, Z = (r) => (r - (n - 1) / 2) * S;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) ctx.tile(V3(X(c), 0.04, Z(r)), S * 0.96, S * 0.96, (r + c) % 2 ? '#d9c6a3' : '#efe3cc');
    for (let r = 0; r < n; r++) tag('row ' + (r + 1), 'idx', X(0) - S * 0.95, 0.1, Z(r));
    const Qm = [];
    let nodes = 0;
    for (const e of ev) {
      if (e.t === 'try') {
        nodes++;
        Qm[e.r] = cube('Q', C.P, [S * 0.6, S * 0.75, S * 0.6], X(e.c), S * 0.38, Z(e.r), 2);
        if (e.att >= 0) { glow(Qm[e.r], REDEM); glow(Qm[e.att], REDEM); }
        if (onTick) onTick(e, nodes);
        await wait(tok, e.att >= 0 ? ms * 1.2 : ms);
        if (e.att >= 0) glow(Qm[e.att], null);
      } else if (e.t === 'kill' || e.t === 'back') {
        if (Qm[e.r]) { fly(Qm[e.r], V3(0, 6, 3)); Qm[e.r] = null; }
        if (onTick) onTick(e, nodes);
        await wait(tok, ms * 0.5);
      } else if (e.t === 'sol') {
        Qm.forEach((m) => m && glow(m, GREEN));
        if (onTick) onTick(e, nodes);
        await wait(tok, 2600);
        Qm.forEach((m) => m && glow(m, null));
      }
    }
    return nodes;
  }
  async function scQueens(tok) {
    reset([0, 8.5, 7.5], [0, 0, 0.3]);
    const tup = tag('(x1, x2, x3, x4)', 'ptr', 0, 0.2, -3.9);
    const cnt = tag('節點 0', 'ptr alt', 4.6, 0.2, 2.6);
    say('4-Queens：每列放一個皇后，不能同行、同列、同斜線', '解寫成 (x1, …, x4)：第 i 列的皇后放在第 xi 行');
    await wait(tok, 3200);
    const ev = queensEvents(4, 2);
    await playQueens(tok, 4, ev, 420, (e, nodes) => {
      txt(cnt, '節點 ' + nodes);
      if (e.t === 'try') { txt(tup, '(' + e.tuple.map((c) => c + 1).join(', ') + ')'); say(e.att >= 0 ? '第 ' + (e.r + 1) + ' 列放第 ' + (e.c + 1) + ' 行：被第 ' + (e.att + 1) + ' 列的皇后吃到' : '第 ' + (e.r + 1) + ' 列放第 ' + (e.c + 1) + ' 行', e.att >= 0 ? 'bounding function：殺掉，試下一行' : ''); }
      if (e.t === 'back') say('第 ' + (e.r + 1) + ' 列這個位置往下都失敗 → 回溯', '拿掉，改試下一行');
      if (e.t === 'sol') say('第 ' + e.k + ' 組解 (' + e.tuple.map((c) => c + 1).join(', ') + ')', e.k === 1 ? '繼續找下一組' : '4-Queens 只有這兩組解（互為鏡像）');
    });
    await wait(tok, 1800);
  }
  const SW = [5, 10, 12, 13, 15, 18], SM = 30;
  function sosEvents(w, m) {
    const n = w.length, ev = [];
    (function dfs(k, s, r, pick) {
      if (k >= n) return;
      ev.push({ t: 'in', k, s, pick: [...pick, k] });
      if (s + w[k] > m) ev.push({ t: 'kill', k, why: s + ' + ' + w[k] + ' = ' + (s + w[k]) + ' > ' + m });
      else if (s + w[k] === m) ev.push({ t: 'sol', pick: [...pick, k] });
      else dfs(k + 1, s + w[k], r - w[k], [...pick, k]);
      ev.push({ t: 'undo', k });
      ev.push({ t: 'out', k, s });
      if (s + r - w[k] < m) ev.push({ t: 'kill', k, why: '剩下全加 ' + s + ' + ' + (r - w[k]) + ' = ' + (s + r - w[k]) + ' < ' + m });
      else dfs(k + 1, s, r - w[k], pick);
      ev.push({ t: 'unout', k });
    })(0, 0, w.reduce((a, b) => a + b, 0), []);
    return ev;
  }
  async function scSos(tok) {
    reset([0, 5, 13.5], [0, 2.2, 0]);
    const X = (k) => -5.0 + k * 1.75;
    const blk = SW.map((v, k) => { const h = 0.3 + v * 0.07; const m = cube(v, C.B, [1.2, h, 1], X(k), h / 2, 0); m.userData.h = h; return m; });
    // sum gauge
    const gauge = cube('', C.O, [0.8, 1, 0.8], 6.2, 0.01, 0); gauge.scale.y = 0.01;
    const H = (s) => Math.max(0.01, s / SM * 4.2);
    rod(V3(5.6, H(SM), 0), V3(6.8, H(SM), 0), C.R, 0.04); tag('m = 30', 'ptr', 6.2, H(SM) + 0.4);
    const sumL = tag('s = 0', 'ptr alt', 6.2, 0, 1.0);
    const solL = [];
    let s = 0;
    const setS = (v) => { s = v; gauge.scale.y = H(v); gauge.position.y = gauge.scale.y / 2; txt(sumL, 's = ' + v); };
    say('Sum of subsets：w = {5, 10, 12, 13, 15, 18}，找總和 = 30 的子集合', '依序決定每個 wk 要（xk = 1）或不要（xk = 0）');
    await wait(tok, 3400);
    const ev = sosEvents(SW, SM);
    const lift = (k, on) => { const m = blk[k]; move(m, X(k), m.userData.h / 2 + (on ? 0.9 : 0), 0); tint(m, on ? C.G : C.B); };
    for (const e of ev) {
      if (e.t === 'in') { lift(e.k, true); setS(e.s + SW[e.k]); say('取 ' + SW[e.k], 's = ' + s); await wait(tok, 220); }
      else if (e.t === 'undo') { lift(e.k, false); setS(s - SW[e.k]); await wait(tok, 120); }
      else if (e.t === 'out') { tint(blk[e.k], C.K); say('不取 ' + SW[e.k], ''); await wait(tok, 120); }
      else if (e.t === 'unout') { tint(blk[e.k], C.B); }
      else if (e.t === 'kill') { glow(gauge, REDEM); say('bounding：' + e.why, '殺掉這個節點'); await wait(tok, 340); glow(gauge, null); }
      else if (e.t === 'sol') {
        glow(gauge, GREEN);
        solL.push(tag('{' + e.pick.map((k) => SW[k]).join(', ') + '}', 'ptr alt', -5.6, 5.4 - solL.length * 0.55));
        say('找到：{' + e.pick.map((k) => SW[k]).join(', ') + '} = 30', '');
        await wait(tok, 1800); glow(gauge, null);
      }
    }
    say('三組解：{5,10,15}、{5,12,13}、{12,18}', '兩個 bound：s + wk ≤ m，且 s + 剩下全部 ≥ m');
    await wait(tok, 3800);
  }

  // ═════════════════════════ 互動模式 ═════════════════════════
  // ── Vertex cover 2-approx ──
  const vcm = {};
  function enterVc() {
    reset([0, 8.5, 8.5], [0, 0, 0.2]);
    const n = 7, ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const nodes = {}; ids.forEach((v, i) => { const a = i * 2 * Math.PI / n - Math.PI / 2; nodes[v] = [3.6 * Math.cos(a), 0.3, 2.6 * Math.sin(a)]; });
    const all = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) all.push([ids[i], ids[j]]);
    const edges = shuffle(all).slice(0, 9);
    Object.assign(vcm, { ids, nodes, edges, left: edges.map(([a, b]) => ek(a, b)), C: [], A: [], g: graph(nodes, edges) });
    controls('<button class="primary" id="vStep">挑一條邊</button><button id="vAll">自動跑完</button><button id="vOpt">看最佳解</button><button id="vNew">換一張圖</button>');
    on('vStep', () => runOp(() => vcStep()));
    on('vAll', () => runOp(async () => { while (vcm.left.length) await vcStep(); }));
    on('vOpt', vcOpt);
    on('vNew', () => { clearLog(); enterVc(); });
    log('APPROX-VERTEX-COVER：任挑一條還沒被覆蓋的邊 (u, v)，把 u、v 都放進 C，再刪掉碰到 u 或 v 的邊。');
    vcState();
  }
  function vcOptimum() {
    const { ids, edges } = vcm; let best = null;
    for (let mask = 0; mask < (1 << ids.length); mask++) {
      const S = ids.filter((_, i) => mask >> i & 1);
      if (best && S.length >= best.length) continue;
      if (edges.every(([a, b]) => S.includes(a) || S.includes(b))) best = S;
    }
    return best;
  }
  async function vcStep() {
    if (!vcm.left.length) { log('所有邊都被覆蓋了，演算法結束。按「看最佳解」比較。', true); return; }
    const key = vcm.left[rnd(vcm.left.length)];
    const [u, v] = key.split('-');
    const g = vcm.g;
    g.E[key].material.color.set(C.Y);
    vcm.A.push(key);
    for (const x of [u, v]) if (!vcm.C.includes(x)) { vcm.C.push(x); tint(g.N[x], C.O); move(g.N[x], vcm.nodes[x][0], 0.75, vcm.nodes[x][2]); }
    await wait(undefined, 450);
    const gone = vcm.left.filter((k) => k.split('-').some((x) => x === u || x === v));
    gone.forEach((k) => { if (k !== key) g.E[k].visible = false; vcm.left.splice(vcm.left.indexOf(k), 1); });
    log('挑 (' + u + ', ' + v + ')：C 加入 ' + u + '、' + v + '，刪掉 ' + gone.length + ' 條邊。');
    vcState();
  }
  function vcOpt() {
    if (vcm.left.length) { log('先把演算法跑完（所有邊都被覆蓋）再比較。', true); return; }
    const best = vcOptimum();
    best.forEach((x) => glow(vcm.g.N[x], GREEN));
    log('最佳解 C* = {' + best.join(', ') + '}（窮舉 2^7 種組合）；近似解 |C| = ' + vcm.C.length + '，比值 ' + (vcm.C.length / best.length).toFixed(2) + ' ≤ 2。');
    vcState(best);
  }
  function vcState(best) {
    setState('APPROX-VERTEX-COVER', [['剩下的邊', String(vcm.left.length)], ['挑過的邊 |A|', String(vcm.A.length)], ['C', '{' + vcm.C.join(', ') + '}'], ['最佳 |C*|', best ? String(best.length) : '—']],
      '|C| = 2|A|，而 A 的邊不共用端點 → |C*| ≥ |A|<br><span class="ok">|C| ≤ 2|C*|</span>' + (best ? '<br>這次比值 = ' + vcm.C.length + ' / ' + best.length + ' = ' + (vcm.C.length / best.length).toFixed(2) : ''));
  }
  // ── TSP MST approx ──
  const tm = {};
  function enterTsp() {
    reset([0, 9, 7.5], [0, 0, 0]);
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const P = {};
    ids.forEach((v) => { let p; do { p = [(Math.random() - 0.5) * 11, (Math.random() - 0.5) * 5]; } while (Object.values(P).some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.6)); P[v] = p; });
    const nodes = {}; ids.forEach((k) => (nodes[k] = [P[k][0], 0.3, P[k][1]]));
    Object.assign(tm, { ids, P, nodes, stage: 0, g: graph(nodes, [], { size: [0.55, 0.45, 0.55] }) });
    controls('<button class="primary" id="tS1">1. MST</button><button id="tS2">2. 繞樹一圈</button><button id="tS3">3. 抄捷徑</button><button id="tOpt">最佳解</button><button id="tNew">換一組點</button>');
    on('tS1', () => runOp(tspS1)); on('tS2', () => runOp(tspS2)); on('tS3', () => runOp(tspS3)); on('tOpt', tspOpt);
    on('tNew', () => { clearLog(); enterTsp(); });
    log('APPROX-TSP-TOUR：MST → 前序走訪 → 依前序連成環路。平面距離滿足三角不等式。');
    tspState();
  }
  async function tspS1() {
    if (tm.stage >= 1) { log('MST 已經算好了，下一步是「繞樹一圈」。', true); return; }
    tm.E = prim(tm.P, tm.ids); tm.T = tm.E.reduce((s, e) => s + e[2], 0);
    for (const [u, v] of tm.E) { rod(V3(...tm.nodes[u]), V3(...tm.nodes[v]), C.Y, 0.07); await wait(undefined, 300); }
    tm.stage = 1; log('MST 成本 c(T) = ' + tm.T.toFixed(2)); tspState();
  }
  async function tspS2() {
    if (tm.stage < 1) { log('要先算 MST，才有樹可以繞。', true); return; }
    if (tm.stage >= 2) { log('已經繞過了，下一步是「抄捷徑」。', true); return; }
    const w = walks(tm.ids, tm.E); tm.pre = w.pre;
    const ball = cube('', C.R, [0.35, 0.35, 0.35], tm.nodes.a[0], 1, tm.nodes.a[2]);
    for (let i = 1; i < w.full.length; i++) {
      const p0 = tm.nodes[w.full[i - 1]], p1 = tm.nodes[w.full[i]];
      for (let k = 1; k <= 8; k++) { const t = k / 8; ball.position.set(p0[0] + (p1[0] - p0[0]) * t, 1, p0[2] + (p1[2] - p0[2]) * t); await wait(undefined, 28); }
    }
    kill(ball);
    tm.stage = 2; log('full walk：' + w.full.join(' ') + '（每條樹邊走兩次，成本 2c(T) = ' + (2 * tm.T).toFixed(2) + '）'); tspState();
  }
  async function tspS3() {
    if (tm.stage < 2) { log('先「繞樹一圈」得到走訪順序，才能抄捷徑。', true); return; }
    if (tm.stage >= 3) { log('環路已經完成。可以按「最佳解」比較。', true); return; }
    const H = [...tm.pre, tm.pre[0]];
    for (let i = 0; i + 1 < H.length; i++) { rod(V3(tm.nodes[H[i]][0], 0.55, tm.nodes[H[i]][2]), V3(tm.nodes[H[i + 1]][0], 0.55, tm.nodes[H[i + 1]][2]), C.O, 0.05); await wait(undefined, 220); }
    tm.cH = tourLen(tm.P, tm.pre);
    tm.stage = 3; log('前序 ' + tm.pre.join(' ') + ' → 環路成本 c(H) = ' + tm.cH.toFixed(2)); tspState();
  }
  function tspOpt() {
    if (tm.stage < 3) { log('先把三個步驟做完，再和最佳解比較。', true); return; }
    const o = optTour(tm.P, tm.ids); tm.opt = o.cost;
    const H = [...o.path, o.path[0]];
    for (let i = 0; i + 1 < H.length; i++) rod(V3(tm.nodes[H[i]][0], 0.15, tm.nodes[H[i]][2]), V3(tm.nodes[H[i + 1]][0], 0.15, tm.nodes[H[i + 1]][2]), C.G, 0.05);
    log('最佳環路（窮舉 6! = 720 條）：' + o.path.join(' ') + '，成本 ' + o.cost.toFixed(2) + '；比值 ' + (tm.cH / o.cost).toFixed(3) + ' ≤ 2。');
    tspState();
  }
  function tspState() {
    setState('APPROX-TSP-TOUR', [['c(T)（MST）', tm.T ? tm.T.toFixed(2) : '—'], ['2c(T)', tm.T ? (2 * tm.T).toFixed(2) : '—'], ['c(H)（近似）', tm.cH ? tm.cH.toFixed(2) : '—'], ['c(H*)（最佳）', tm.opt ? tm.opt.toFixed(2) : '—']],
      'c(T) ≤ c(H*)（環路去掉一邊就是生成樹）<br>c(H) ≤ 2c(T)（三角不等式）→ <span class="ok">c(H) ≤ 2c(H*)</span>');
  }
  // ── randomized quicksort ──
  const rq = { kind: 'sorted' };
  function enterRqs() {
    reset([0, 5, 13], [0, 1.8, 0]);
    rq.arr = rq.kind === 'sorted' ? [1, 2, 3, 4, 5, 6, 7, 8] : shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    rq.bars = drawBars(rq.arr);
    rq.cnt = tag('比較 0 次', 'ptr alt', 0, 5.3);
    controls('<select id="qKind"><option value="sorted">輸入：已排序</option><option value="rand">輸入：亂序</option></select><button class="primary" id="qRun">跑一次</button><button id="qMany">跑 500 次統計</button>');
    $('qKind').value = rq.kind;
    $('qKind').onchange = (e) => { rq.kind = e.target.value; enterRqs(); };
    on('qRun', () => runOp(async () => {
      lab.clear(); rq.bars = drawBars(rq.arr); rq.cnt = tag('比較 0 次', 'ptr alt', 0, 5.3);
      const r = rqsEvents(rq.arr);
      await playRqs(undefined, rq.bars, r.ev, 110, (c) => txt(rq.cnt, '比較 ' + c + ' 次'));
      log('這次 ' + r.comps + ' 次比較，結果 ' + r.sorted.join(' ') + '（一定排好：Las Vegas）');
      rqState(r.comps);
    }));
    on('qMany', () => {
      let s = 0, lo = INF, hi = 0;
      for (let k = 0; k < 500; k++) { const c = rqsEvents(rq.arr).comps; s += c; lo = Math.min(lo, c); hi = Math.max(hi, c); }
      log('500 次：平均 ' + (s / 500).toFixed(1) + ' 次比較，最少 ' + lo + '、最多 ' + hi + '；固定選最後一個當 pivot 在已排序輸入要 28 次。');
    });
    log('RANDOMIZED-PARTITION：隨機選一個元素和 A[r] 交換，再照 Lomuto partition 做。');
    rqState();
  }
  function rqState(c) {
    setState('RANDOMIZED-QUICKSORT（n = 8）', [['輸入', rq.arr.join(' ')], ['這次比較', c === undefined ? '—' : String(c)], ['最壞（固定 pivot、已排序）', '28']],
      '期望比較次數 = 2(n+1)H<sub>n</sub> − 4n ≈ 16.9（n = 8）<br><span class="ok">期望 O(n lg n)</span>，答案永遠正確 → Las Vegas');
  }
  // ── Monte Carlo trials ──
  const mc = { k: 5, wrongC: true };
  function enterMc() {
    reset([0, 4.6, 13], [0, 2.4, 0]);
    controls('<label>重複 k = <input id="mK" type="number" min="1" max="12" value="' + mc.k + '"></label><select id="mW"><option value="1">C 是錯的</option><option value="0">C 是對的</option></select><button class="primary" id="mRun">做 k 次測試</button><button id="mStat">模擬 2000 回</button>');
    $('mW').value = mc.wrongC ? '1' : '0';
    $('mK').onchange = (e) => { mc.k = Math.max(1, Math.min(12, Number(e.target.value) || 5)); mcState(); };
    $('mW').onchange = (e) => { mc.wrongC = e.target.value === '1'; mcState(); };
    on('mRun', () => runOp(async () => {
      lab.clear();
      const Cm = mc.wrongC ? freivaldsC() : mmul(FA, FB);
      let verdict = '相等';
      for (let k = 0; k < mc.k; k++) {
        const r = [rnd(2), rnd(2), rnd(2)];
        const diff = mvec(FA, mvec(FB, r)).some((v, i) => v !== mvec(Cm, r)[i]);
        cube(diff ? '≠' : '=', diff ? C.G : C.K, [0.7, 0.7, 0.7], -5 + (k % 6) * 1.0, 0.36 + Math.floor(k / 6) * 0.8, 0, 2);
        log('第 ' + (k + 1) + ' 次：r = (' + r.join(', ') + ') → ' + (diff ? 'A(Br) ≠ Cr' : 'A(Br) = Cr'));
        await wait(undefined, 260);
        if (diff) { verdict = '不相等'; break; }
      }
      const right = (verdict === '不相等') === mc.wrongC;
      tag('判定：A·B ' + (verdict === '相等' ? '=' : '≠') + ' C ' + (right ? '（正確）' : '（誤判！）'), right ? 'ptr' : 'ptr alt', 0, 3.4);
      if (!right) log('k 次都剛好沒抽到錯的那一行：這就是 Monte Carlo 的錯誤，機率 ≤ 1/2^k。', true);
    }));
    on('mStat', () => {
      let wrong = 0; const Cm = freivaldsC();
      for (let t = 0; t < 2000; t++) { let caught = false; for (let k = 0; k < mc.k && !caught; k++) { const r = [rnd(2), rnd(2), rnd(2)]; caught = mvec(FA, mvec(FB, r)).some((v, i) => v !== mvec(Cm, r)[i]); } if (!caught) wrong++; }
      log('C 錯、重複 k = ' + mc.k + '：2000 回中誤判 ' + wrong + ' 回（' + (wrong / 20).toFixed(2) + '%），上限 1/2^' + mc.k + ' = ' + (100 / Math.pow(2, mc.k)).toFixed(2) + '%');
    });
    log('Freivalds：隨機 r ∈ {0,1}³，比較 A(Br) 與 Cr。只要不相等就確定 A·B ≠ C；C 錯時每次至少 1/2 機率抓到。');
    mcState();
  }
  function mcState() {
    setState('Monte Carlo：Freivalds 驗證', [['重複次數 k', String(mc.k)], ['C', mc.wrongC ? '錯的（一格多 1）' : '正確'], ['錯誤率上限', '1/2^' + mc.k + ' = ' + (+Math.pow(0.5, mc.k).toFixed(5))]],
      '一次 O(n²)，k 次 O(kn²)，比直接乘 O(n³) 快<br><span class="ok">one-sided error</span>：說「≠」一定對，說「=」可能錯');
  }
  // ── N-Queens backtracking ──
  const nq = { n: 4 };
  function enterQueens() {
    reset([0, 8.5, 7.5], [0, 0, 0.3]);
    nq.ev = queensEvents(nq.n, Infinity); nq.i = 0; nq.nodes = 0; nq.sols = []; nq.Q = [];
    const S = 5.4 / nq.n; nq.S = S;
    for (let r = 0; r < nq.n; r++) for (let c = 0; c < nq.n; c++) ctx.tile(V3((c - (nq.n - 1) / 2) * S, 0.04, (r - (nq.n - 1) / 2) * S), S * 0.96, S * 0.96, (r + c) % 2 ? '#d9c6a3' : '#efe3cc');
    controls('<select id="nN"><option>4</option><option>5</option><option>6</option></select><button class="primary" id="nStep">下一步</button><button id="nAuto">自動</button><button id="nReset">重來</button>');
    $('nN').value = String(nq.n);
    $('nN').onchange = (e) => { nq.n = Number(e.target.value); clearLog(); enterQueens(); };
    on('nStep', () => nqStep());
    on('nAuto', () => { stopTimer(); timer = setInterval(() => { if (!nqStep()) stopTimer(); }, 160); });
    on('nReset', () => { clearLog(); enterQueens(); });
    log(nq.n + '-Queens 回溯：一列一列放；被吃到的位置由 bounding function 殺掉，整列都失敗就回上一列。');
    nqState();
  }
  function nqStep() {
    if (nq.i >= nq.ev.length) { log('整棵狀態空間樹搜完了：共 ' + nq.sols.length + ' 組解。', true); return false; }
    const e = nq.ev[nq.i++], S = nq.S, X = (c) => (c - (nq.n - 1) / 2) * S, Z = (r) => (r - (nq.n - 1) / 2) * S;
    if (e.t === 'try') {
      nq.nodes++;
      if (nq.Q[e.r]) kill(nq.Q[e.r]);
      nq.Q[e.r] = cube('Q', e.att >= 0 ? C.R : C.P, [S * 0.6, S * 0.75, S * 0.6], X(e.c), S * 0.38, Z(e.r));
      if (e.att >= 0) log('(' + e.tuple.map((c) => c + 1).join(',') + ')：第 ' + (e.r + 1) + ' 列第 ' + (e.c + 1) + ' 行被第 ' + (e.att + 1) + ' 列吃到 → 殺掉');
    } else if (e.t === 'kill' || e.t === 'back') {
      if (nq.Q[e.r]) { kill(nq.Q[e.r]); nq.Q[e.r] = null; }
      if (e.t === 'back') log('第 ' + (e.r + 1) + ' 列第 ' + (e.c + 1) + ' 行往下無解 → 回溯');
    } else if (e.t === 'sol') {
      nq.sols.push(e.tuple.map((c) => c + 1).join(','));
      nq.Q.forEach((m) => m && glow(m, GREEN));
      log('解 #' + e.k + '：(' + e.tuple.map((c) => c + 1).join(', ') + ')');
    }
    nqState();
    return true;
  }
  function nqState() {
    setState(nq.n + '-Queens（回溯）', [['產生的節點', String(nq.nodes)], ['找到的解', String(nq.sols.length)], ['最後一組', nq.sols.length ? '(' + nq.sols[nq.sols.length - 1] + ')' : '—']],
      '不剪枝要看 ' + nq.n + '^' + nq.n + ' = ' + Math.pow(nq.n, nq.n) + ' 種放法<br>bounding：同行、同斜線 |xi − xj| = |i − j| 就殺掉');
  }
  // ── TSP LC branch and bound ──
  const bb = {};
  function enterBnb() {
    reset([0, 4.4, 14.5], [0, 3.4, 0]);
    bb.M = bb.M || M5;
    bb.res = tspLC(bb.M);
    layout(bb.res.root, -0.2, 6.6, 6.8, 1.45);
    bb.mv = matrixView(bb.M, -6.0, 6.0, 0.88, 0.62);
    bb.si = -1;
    controls('<button class="primary" id="bStep">展開最小 cost 節點</button><button id="bAll">自動跑完</button><button id="bBook">課本矩陣</button><button id="bNew">隨機矩陣</button>');
    on('bStep', () => runOp(() => bbStep()));
    on('bAll', () => runOp(async () => { while (await bbStep()) { /* continue */ } }));
    on('bBook', () => { bb.M = M5; clearLog(); enterBnb(); });
    on('bNew', () => { bb.M = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (i === j ? INF : 2 + rnd(28)))); clearLog(); enterBnb(); });
    log('LC Branch & Bound：每個節點的 cost = 下界（reduced matrix 的化簡量累加）；每次展開 cost 最小的活節點。');
    bbState();
  }
  async function bbStep() {
    if (bb.si < 0) {
      bb.mv.set(bb.res.root.red.A);
      drawT(bb.res.root, C.D, [0.5, 0.42, 0.42], false);
      tag(String(bb.res.root.cost), 'idx', bb.res.root.x, bb.res.root.y - 0.55);
      log('root：列化簡 ' + bb.res.root.red.rows.join('+') + '，行化簡 ' + bb.res.root.red.cols.join('+') + ' → 下界 ' + bb.res.root.cost);
      bb.si = 0; bbState(); return true;
    }
    const s = bb.res.steps[bb.si];
    if (!s) { log('已經找到最佳解了。', true); return false; }
    bb.si++;
    if (s.t === 'expand') {
      glow(s.E.m, GOLD);
      for (const k of s.kids) {
        drawT(k, C.B, [0.48, 0.42, 0.42]); tag(String(k.cost), 'idx', k.x, k.y - 0.55); bb.mv.set(k.M);
        log('路徑 ' + k.path.map((v) => v + 1).join('→') + '：' + (k.path.length === bb.M.length ? '完整環路成本 ' + k.cost : k.pc + ' + ' + k.cij + ' + ' + k.r + ' = ' + k.cost));
        await wait(undefined, 350);
      }
      glow(s.E.m, null);
    } else {
      let n = s.E; while (n) { glow(n.m, GREEN); n = n.parent; }
      log('最小 cost 的活節點已是完整環路：' + s.E.path.map((v) => v + 1).join('→') + '→1 = ' + s.E.cost + '，其他下界都不更小 → 最佳。');
    }
    bbState();
    return bb.si < bb.res.steps.length;
  }
  function bbState() {
    setState('TSP：LC Branch & Bound', [['root 下界', String(bb.res.root.cost)], ['已展開', String(Math.max(0, bb.si))], ['最佳環路', bb.si >= bb.res.steps.length && bb.res.best ? bb.res.best.path.map((v) => v + 1).join('→') + '→1 = ' + bb.res.best.cost : '—']],
      '走 i→j：列 i、行 j 設 ∞、c(j,1) = ∞，再化簡 r<br>cost(子) = cost(父) + A(i,j) + r（A = 父節點的 reduced matrix）');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const t = rnd(9);
    if (t === 0) {
      const k = 2 + rnd(6);
      return { q: 'APPROX-VERTEX-COVER 跑完時一共挑了 ' + k + ' 條邊（集合 A）。下列何者一定成立？', opts: ['|C| = ' + 2 * k + ' 且 |C*| ≥ ' + k, '|C| = ' + k + ' 且 |C*| ≥ ' + k, '|C| = ' + 2 * k + ' 且 |C*| = ' + 2 * k, '|C| ≤ ' + k + ' 且 |C*| ≥ ' + 2 * k], ans: '|C| = ' + 2 * k + ' 且 |C*| ≥ ' + k, why: '每挑一條邊放兩個端點，且 A 的邊不共用端點 → |C| = 2|A|；任何 cover 都要蓋住 A 的每條邊，至少 |A| 個點。' };
    }
    if (t === 1) {
      const w = 10 + rnd(40);
      return { q: '在滿足三角不等式的 TSP 上，MST 成本 c(T) = ' + w + '。APPROX-TSP-TOUR 得到的環路 H 必滿足？', opts: ['c(H) ≤ ' + 2 * w, 'c(H) ≤ ' + w, 'c(H) ≤ ' + (1.5 * w), 'c(H) = ' + 2 * w], ans: 'c(H) ≤ ' + 2 * w, why: 'full walk 成本 2c(T)，抄捷徑靠三角不等式不會變長 → c(H) ≤ 2c(T) ≤ 2c(H*)。（1.5 倍是 Christofides，不是這個演算法）' };
    }
    if (t === 2) {
      const items = [['隨機選 pivot 的 quicksort', 'Las Vegas'], ['Freivalds 矩陣乘積驗證', 'Monte Carlo'], ['Miller–Rabin 質數測試', 'Monte Carlo'], ['隨機打亂後再做 hiring problem', 'Las Vegas']];
      const [it, a] = items[rnd(items.length)];
      return { q: it + ' 屬於哪一類隨機演算法？', opts: ['Las Vegas', 'Monte Carlo', '確定性演算法', '近似演算法'], ans: a, why: a === 'Las Vegas' ? '答案永遠正確，只有執行時間是隨機的。' : '執行時間有固定上限，但答案有一定機率出錯（可重複降低錯誤率）。' };
    }
    if (t === 3) {
      const k = 3 + rnd(8);
      return { q: '單次錯誤率 ≤ 1/2 的 Monte Carlo 測試，獨立重複 ' + k + ' 次，錯誤率上限？', opts: ['1/' + Math.pow(2, k), '1/' + 2 * k, k + '/2', '1/' + k], ans: '1/' + Math.pow(2, k), why: '每次獨立，都誤判的機率相乘：(1/2)^' + k + '。' };
    }
    if (t === 4) {
      const n = 3 + rnd(4), m = 2 + rnd(3);
      const tot = (Math.pow(m, n + 1) - 1) / (m - 1);
      const o4 = [...new Set([tot, Math.pow(m, n), tot - 1, Math.pow(n, m), Math.pow(m, n + 1), m * n + 1].map(String))].slice(0, 4);
      return { q: 'Graph coloring：' + n + ' 個頂點、' + m + ' 種顏色，不加任何 bounding 的狀態空間樹共有幾個節點（含 root）？', opts: o4, ans: String(tot), why: '1 + m + m² + … + mⁿ = (m^(n+1) − 1)/(m − 1)。' };
    }
    if (t === 5) {
      return { q: 'Backtracking 與 Branch & Bound 產生狀態空間樹的方式？', opts: ['回溯 DFS、分支界限 BFS', '回溯 BFS、分支界限 DFS', '兩者都 DFS', '兩者都 BFS'], ans: '回溯 DFS、分支界限 BFS', why: '回溯一路往下、不行再退；分支界限取出一個節點就把它的孩子全部產生（FIFO/LIFO/LC 只差下一個挑誰）。' };
    }
    if (t === 6) {
      const c = [10 + rnd(20), 5 + rnd(20), 12 + rnd(20), 3 + rnd(25)];
      const which = ['FIFO', 'LIFO', 'LC'][rnd(3)];
      const ids = [2, 3, 4, 5];
      const ans = which === 'FIFO' ? '節點 2' : which === 'LIFO' ? '節點 5' : '節點 ' + ids[c.indexOf(Math.min(...c))];
      const opts = [...new Set(['節點 2', '節點 5', '節點 ' + ids[c.indexOf(Math.min(...c))], '節點 3', '節點 4'])].slice(0, 4);
      if (!opts.includes(ans)) opts[3] = ans;
      return { q: 'root（節點 1）展開後依序產生節點 2、3、4、5，cost 分別為 ' + c.join('、') + '。用 ' + which + ' Branch & Bound，下一個展開哪個？', opts, ans, why: 'FIFO 用 queue → 最先產生的節點 2；LIFO 用 stack → 最後產生的節點 5；LC 挑 cost 最小的。' };
    }
    if (t === 7) {
      const n = 4 + rnd(4);
      const f = (k) => (k <= 1 ? 1 : k * f(k - 1));
      const o7 = [...new Set([f(n - 1), f(n), Math.pow(2, n), n * n, f(n - 2), Math.pow(2, n - 1)].map(String))].slice(0, 4);
      return { q: n + ' 個城市的 TSP，固定從城市 1 出發，狀態空間樹有幾片葉子（幾條環路）？', opts: o7, ans: String(f(n - 1)), why: '起點固定，其餘 ' + (n - 1) + ' 個城市任意排列 → (n−1)!。' };
    }
    const nm = [[2, 4, 1, 3], [3, 1, 4, 2]][rnd(2)];
    return { q: '4-Queens 用 (x1, x2, x3, x4) 表示（第 i 列的皇后在第 xi 行），下列哪一組是解？', opts: ['(' + nm.join(', ') + ')', '(1, 3, 2, 4)', '(2, 3, 1, 4)', '(1, 4, 2, 3)'], ans: '(' + nm.join(', ') + ')', why: '4-Queens 只有 (2,4,1,3) 和 (3,1,4,2) 兩組；其他選項都有兩個皇后在同一條斜線。' };
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

  // ───────────────────────── 場景 ─────────────────────────
  const scenes = {
    // 近似演算法（CLRS 35）
    'approx-ratio': { title: '近似比 ρ(n)：C 和最佳解 C* 差幾倍', play: scApproxRatio },
    'vc-2approx': { title: 'Vertex cover 2-近似：任挑一邊、兩端都選', play: scVc2 },
    'vc-why-2': { title: '為什麼 |C| ≤ 2|C*|：挑到的邊不共用端點', play: scVcWhy },
    'tsp-mst-double': { title: 'TSP 2-近似：MST → 繞一圈 → 抄捷徑', play: scTspMst },
    'set-cover-greedy': { title: 'Set cover greedy：每次挑蓋最多新點的集合', play: scSetCover },
    // 隨機演算法
    'rand-quicksort': { title: '隨機快排：pivot 隨機、答案永遠對（Las Vegas）', play: scRandQs },
    'lv-vs-mc': { title: 'Las Vegas vs Monte Carlo', play: scLvMc },
    'mc-trials': { title: 'Monte Carlo 重複 k 次：錯誤率 ≤ 1/2^k', play: scMcTrials },
    // 回溯（Abdul Bari 6、6.3；例題）
    'strategy-map': { title: '回溯／分支界限：brute force 的兩種走法', play: scStrategy },
    'bt-seats-tree': { title: '回溯：3 人坐 3 椅的狀態空間樹（3! = 6）', play: (tok) => scSeats(tok, false) },
    'bt-seats-bound': { title: '回溯：女生不坐中間 → bounding function 殺節點', play: (tok) => scSeats(tok, true) },
    'bt-dfs-bfs': { title: '回溯 DFS vs 分支界限 BFS：節點產生順序', play: scDfsBfs },
    'nqueens-4': { title: '回溯：4-Queens（例）', play: scQueens },
    'sum-subsets': { title: '回溯：Sum of subsets，m = 30（例）', play: scSos },
    'gc-intro': { title: '回溯：Graph coloring，相鄰不同色', play: scGcIntro },
    'gc-types': { title: '回溯：m-coloring 判定與最少色數', play: scGcTypes },
    'gc-tree-size': { title: '回溯：著色狀態空間樹 1+3+…+3⁴ 個節點', play: scGcTreeSize },
    'gc-backtrack': { title: '回溯：正方形圖著色，bounding function 剪枝', play: scGcBacktrack },
    'gc-map': { title: '回溯：地圖著色 → 圖著色', play: scGcMap },
    // 分支界限（Abdul Bari 7、7.3）
    'bb-solution-forms': { title: '分支界限：解的兩種表示（子集合／0-1 向量）', play: scBbForms },
    'bb-fifo': { title: '分支界限：FIFO（queue）產生節點 1–16', play: scBbFifo },
    'bb-lifo': { title: '分支界限：LIFO（stack）產生順序', play: scBbLifo },
    'bb-lc': { title: '分支界限：LC，挑 cost 最小的節點', play: scBbLc },
    'tsp-problem': { title: '分支界限 TSP：問題與成本矩陣', play: scTspProblem },
    'tsp-bb-small': { title: '分支界限 TSP：4 城市的狀態空間樹', play: scTspSmall },
    'tsp-bb-reduce': { title: '分支界限 TSP：reduced matrix 下界與 LC 展開（例）', play: scTspReduce },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ bt.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 第 10 章（回溯 / 分支界限 / 近似 / 線性規劃 / MIT 6.006 收尾）— cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// Abdul Bari 的例子（3 人 3 椅、5 頂點著色、4-Queens、w = {5,10,12,13,15,18}、m = 30 等）照影片的數字。
const wt = (tok, ms) => ctx.beat(tok, ms);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z, drop);
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const pal = (name, v, color, x, z = 0, s = 0.8) => buddy(name, v, color, x, 0, z, s);
const gone = (...os) => os.forEach((o) => { if (o) kill(o.g || o); });
const sayc = (a, b = '') => say(a, b);
// a state-space tree node drawn at its laid-out place (module mkT / layout / drawT)
const nodeAt = (n, color, s = [0.5, 0.42, 0.42]) => drawT(n, color, s, false);

// ════════ DKCbsiDBN6c（Abdul Bari 6：Introduction to Backtracking） ════════
// 0:00 brute force 家族
FRAG.push(['bt-intro-strategy', '回溯：brute force、DP 與回溯', async (tok) => {
  fresh([0, 4.5, 13], [0, 2.4, 0]);
  await step(tok);                                   // 0:00 the topic is backtracking
  const bt = bx('Backtracking', C.B, 0, 2.3, 0, 3.6, 3, 0.7, 1);
  sayc('主題：Backtracking（回溯）');
  await step(tok);                                   // 0:02 a problem solving strategy
  note('一種「解題策略」', 0, 3.3, 0.6);
  sayc('回溯是一種解題策略', '照這個策略就能寫出演算法');
  await step(tok);                                   // 0:12 brute force: try all, pick desired
  const top = bx('Brute force', C.D, 0, 5.2, 0, 3.4, 3, 0.7, 1);
  rod(V3(0, 4.85, 0), V3(0, 2.65, 0), EDGE, 0.04);
  bub('把所有可能的解都試一遍 → 挑出想要的', 0, 6.1, 0);
  sayc('Brute force：所有可能都試', '再挑出想要的解');
  await step(tok);                                   // 0:25 we were following it in DP
  rod(V3(0, 4.85, 0), V3(-4.4, 2.65, 0), EDGE, 0.04);
  bx('Dynamic Programming', C.P, -4.4, 2.3, 0, 3.6, 3, 0.7, 1);
  sayc('DP 也是「考慮所有可能」');
  await step(tok);                                   // 0:27 DP solves optimization problems
  tag('最佳化問題（最大 / 最小）', 'idx', -4.4, 1.4, 0.6);
  sayc('DP 解的是 optimization problem');
  await step(tok);                                   // 0:33 backtracking is not for optimization
  bad('不是拿來做最佳化 ✗', 0, 1.4, 0.6);
  glow(bt, GOLD);
  sayc('Backtracking 不是最佳化用的');
  await step(tok);                                   // 0:36 multiple solutions, want all
  good('有多組解、全部都要 ✓', 0, 0.7, 0.9);
  glow(top, GOLD);
  sayc('有很多組解、而且每一組都要', '→ 用回溯');
}]);

// 3 位學生、3 張椅子：沿著狀態空間樹走（bound = 女生不坐中間）
const STUC = { B1: C.B, B2: C.P, G1: C.PK };
const SNAME = ['B1', 'B2', 'G1'];
function seatWorld(bound) {
  const { root, ev } = seatTree(bound);
  layout(root, -4.6, 5.6, 6.6, 1.5);
  const chairX = [-1.8, 0, 1.8], home = { B1: -6.2, B2: -5.3, G1: -4.4 };
  chairX.forEach((x, i) => { ctx.tile(V3(x, 0.04, 2.8), 1.3, 1.1, i === 1 && bound ? '#f1c9c2' : '#e3d3b4'); tag('椅子 ' + (i + 1), 'idx', x, 0, 3.7); });
  const kid = {}; SNAME.forEach((n) => { kid[n] = buddy(n, '', STUC[n], home[n], 0, 2.8, 0.55); });
  const cnt = hot('解：0', 5.6, 0.3, 2.8);
  const seat = []; let i = 0, adds = 0, sols = 0, lastKill = null;
  const W = { root, kid, cnt, get sols() { return sols; }, get lastKill() { return lastKill; } };
  async function sit(n) {
    const nm = SNAME[n.s]; seat[n.depth - 1] = nm;
    await slide(tok0, kid[nm].g, chairX[n.depth - 1], 0, 2.8, 260);
  }
  async function up(depth) {
    const nm = seat[depth - 1]; if (!nm) return; seat[depth - 1] = null;
    kid[nm].mood('calm'); await slide(tok0, kid[nm].g, home[nm], 0, 2.8, 200);
  }
  let tok0 = null;
  // play events until `target` adds have been drawn (undefined → only the pending go-backs)
  W.run = async (tok, target) => {
    tok0 = tok;
    while (i < ev.length) {
      const e = ev[i], n = e.n;
      if (e.t === 'add') {
        if (target === undefined || adds >= target) break;
        i++; adds++;
        if (!root.m) nodeAt(root, C.D, [1.0, 0.42, 0.42]);
        nodeAt(n, STUC[SNAME[n.s]]);
        await sit(n);
        if (n.killed) { glow(n.m, REDEM); kid.G1.mood('sad'); lastKill = n; }
        else if (n.sol) { sols++; txt(cnt, '解：' + sols); tag('✓', 'ptr alt', n.x, n.y - 0.6); glow(n.m, GREEN); seat.forEach((nm) => nm && kid[nm].mood('happy')); }
      } else {
        i++;
        if (n.sol) glow(n.m, null);
        await up(n.depth);
      }
    }
  };
  W.killNow = () => { if (lastKill && !lastKill.x2) killT(lastKill); };
  W.path = (names) => { let n = root; const out = [n]; for (const nm of names) { n = n.kids.find((k) => SNAME[k.s] === nm); out.push(n); } return out; };
  return W;
}

// 0:50 3 人 3 椅：所有坐法
FRAG.push(['bt-intro-seats', '回溯：3 人坐 3 椅的狀態空間樹', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 2.9, 0]);
  await step(tok);                                   // 0:50 take an example: 3 students
  const W = seatWorld(false);
  sayc('例子：3 位學生', '2 個男生 B1、B2，1 個女生 G1');
  await step(tok);                                   // 1:03 three chairs
  for (const n of SNAME) W.kid[n].look(1);
  sayc('3 張椅子，要排他們坐');
  await step(tok);                                   // 1:19 3! = 6 ways
  note('3! = 3 × 2 × 1 = 6 種', 0, 1.6, 2.8);
  sayc('有幾種坐法？3! = 6', '我們要把 6 種全部找出來');
  await step(tok);                                   // 1:33 state space tree
  hd('state space tree（狀態空間樹）', 0.5, 7.6);
  sayc('解畫成一棵樹', 'solution tree = state space tree');
  await step(tok);                                   // 1:50 start
  nodeAt(W.root, C.D, [1.0, 0.42, 0.42]);
  sayc('從 root（開始）出發');
  await step(tok);                                   // 1:57 first chair: boy one
  await W.run(tok, 1);
  sayc('第 1 層 = 椅子 1：B1 坐下');
  await step(tok);                                   // 2:12 next level: boy two
  await W.run(tok, 2);
  sayc('第 2 層 = 椅子 2：B2 坐下');
  await step(tok);                                   // 2:19 third seat: girl one
  await W.run(tok, 3);
  sayc('第 3 層 = 椅子 3：G1 → 第 1 組解', 'B1 B2 G1');
  await step(tok);                                   // 2:26 take out the girl, go back
  await W.run(tok);
  sayc('拿掉 G1，退回上一層', '這就是「回溯」(backtrack)');
  await step(tok);                                   // 2:37 take out B2; girl at second place
  await W.run(tok, 4);
  sayc('B2 也拿掉；椅子 2 換 G1 坐');
  await step(tok);                                   // 2:48 then boy two → another solution
  await W.run(tok, 5);
  sayc('椅子 3：B2 → 第 2 組解', 'B1 G1 B2');
  await step(tok);                                   // 2:59 take out all; boy two first
  await W.run(tok, 6);
  sayc('全部退回；椅子 1 換 B2');
  await step(tok);                                   // 3:08 boy one then girl one
  await W.run(tok, 8);
  sayc('B2 B1 G1 → 第 3 組解');
  await step(tok);                                   // 3:11 girl one then boy one
  await W.run(tok, 10);
  sayc('B2 G1 B1 → 第 4 組解');
  await step(tok);                                   // 3:19 girl one first, boy one, boy two
  await W.run(tok, 13);
  sayc('G1 B1 B2 → 第 5 組解');
  await step(tok);                                   // 3:25 boy two, boy one
  await W.run(tok, 15);
  await W.run(tok);
  sayc('G1 B2 B1 → 第 6 組解');
  await step(tok);                                   // 3:28 these are the possible arrangements
  txt(W.cnt, '解：6 = 3!');
  sayc('6 條路徑 = 6 種坐法', '一個都沒漏');
  await step(tok);                                   // 3:42 follow one path from the root
  W.path(['B2', 'B1', 'G1']).forEach((n) => glow(n.m, GOLD));
  bub('root → 葉子的一條路 = 一組解', 0.5, 0.9, 0);
  sayc('沿這條路：B2、B1、G1', 'root 到葉子 = 一組解');
}]);

// 3:52 加條件：女生不坐中間
FRAG.push(['bt-intro-bound', '回溯：女生不坐中間 → bounding function', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 2.9, 0]);
  await step(tok);                                   // 3:52 problems usually have constraints
  const W = seatWorld(true);
  sayc('回溯的問題通常有「限制條件」', '只要滿足條件的解');
  await step(tok);                                   // 4:03 girl should not sit in middle
  bad('女生不能坐中間（椅子 2）', 0, 1.5, 2.8);
  W.kid.G1.mood('wow');
  sayc('條件：G1 不能坐椅子 2');
  await step(tok);                                   // 4:16 trace and draw the tree again
  nodeAt(W.root, C.D, [1.0, 0.42, 0.42]);
  sayc('重新畫樹，邊走邊檢查條件');
  await step(tok);                                   // 4:21 boy one, boy two
  await W.run(tok, 2);
  sayc('B1、B2：沒問題');
  await step(tok);                                   // 4:30 third place girl → correct
  await W.run(tok, 3);
  sayc('椅子 3 是 G1：符合 → 第 1 組解');
  await step(tok);                                   // 4:33 second place girl → not allowed
  await W.run(tok, 4);
  sayc('椅子 2 換 G1：違反條件！');
  await step(tok);                                   // 4:44 not generating the tree further: kill
  W.killNow();
  sayc('停！這個節點不再往下長', '把它「殺掉」(kill)');
  await step(tok);                                   // 5:04 the condition is the bounding function
  hot('bounding function', W.lastKill.x, W.lastKill.y + 1.1);
  sayc('用來殺節點的條件', '叫做 bounding function');
  await step(tok);                                   // 5:15 save our work
  good('底下整棵子樹都不用畫 → 省工夫', 0.5, 0.9, 0);
  sayc('既得到正確的解，也省下工作');
  await step(tok);                                   // 5:21 boy two, boy one, girl → solution
  await W.run(tok, 7);
  sayc('B2 B1 G1 → 第 2 組解');
  await step(tok);                                   // 5:32 girl in between again → kill
  await W.run(tok, 8); W.killNow();
  sayc('G1 又坐中間 → 殺掉');
  await step(tok);                                   // 5:42 girl, boy, boy → solution
  await W.run(tok, 11);
  sayc('G1 B1 B2 → 第 3 組解');
  await step(tok);                                   // 5:49 this is also a solution
  await W.run(tok, 13); await W.run(tok);
  sayc('G1 B2 B1 → 第 4 組解');
  await step(tok);                                   // 5:56 reach the last level → solution; total four
  txt(W.cnt, '解：4');
  sayc('沒被殺、走到最後一層 = 解', '共 4 組（原本 6 組）');
  await step(tok);                                   // 6:02 n-queens, sum of subsets, graph coloring
  ['N-Queens', 'Sum of Subsets', 'Graph Coloring'].forEach((t, k) => note(t, -4.2 + k * 2.6, 7.7, 0));
  sayc('回溯的經典題', 'N-Queens、Sum of Subsets、Graph Coloring');
}]);

// 6:14 DFS vs BFS
FRAG.push(['bt-intro-dfsbfs', '回溯 DFS vs 分支界限 BFS', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.4, 0]);
  const L = seatTree(false).root, R = seatTree(false).root;
  layout(L, -6.4, -0.8, 6.4, 1.6); layout(R, 0.8, 6.4, 6.4, 1.6);
  const pre = []; (function p(n) { pre.push(n); n.kids.forEach(p); })(L);
  const bfs = []; { const q = [R]; while (q.length) { const n = q.shift(); bfs.push(n); q.push(...n.kids); } }
  const draw = (n, k) => { n.label = String(k + 1); nodeAt(n, n.s === undefined ? C.D : STUC[SNAME[n.s]], [0.46, 0.4, 0.4]); };
  const run = async (list, a, b) => { for (let k = a; k < b; k++) { draw(list[k], k); await wt(tok, 140); } };
  await step(tok);                                   // 6:14 branch and bound also uses brute force
  hd('Backtracking', -3.6, 7.5); hd('Branch & Bound', 3.6, 7.5);
  sayc('Branch and bound 也用 brute force');
  await step(tok);                                   // 6:32 both generate a state space tree
  draw(L, 0); draw(R, 0);
  sayc('兩者都產生狀態空間樹', '方塊上的數字 = 第幾個被產生');
  await step(tok);                                   // 6:40 backtracking: this one, then this one…
  await run(pre, 1, 4);
  sayc('回溯：一路往下走到底');
  await step(tok);                                   // 6:45 go back, come to this side
  await run(pre, 4, pre.length);
  sayc('到底了就退回來，換另一邊');
  await step(tok);                                   // 6:51 this is DFS
  hot('DFS（depth first）', -3.6, 0.5);
  sayc('回溯 = depth first search（DFS）');
  await step(tok);                                   // 6:57 branch and bound: BFS
  hot('BFS（breadth first）', 3.6, 0.5);
  sayc('分支界限 = breadth first search（BFS）');
  await step(tok);                                   // 7:03 first this one: B1, B2, G1
  await run(bfs, 1, 4);
  sayc('先把第 1 層全部產生', 'B1、B2、G1');
  await step(tok);                                   // 7:13 generate all nodes in the level
  bub('同一層全部產生完才往下', 3.6, 1.3, 0);
  sayc('一層一層：這就是 BFS');
  await step(tok);                                   // 7:18 then here: who can sit
  await run(bfs, 4, 10);
  sayc('第 2 層：每個節點剩 2 種選擇');
  await step(tok);                                   // 7:42 level wise
  await run(bfs, 10, 16);
  sayc('第 3 層：level wise 產生');
  await step(tok);                                   // 7:56 the only difference: how the tree is generated
  note('差別只在：樹產生的順序', 0, 0.4, 2.0);
  sayc('唯一差別：產生節點的順序', '分支界限的細節之後再講');
  await step(tok);                                   // 8:05 this DFS, that BFS
  glow(L.m, GOLD); glow(R.m, GOLD);
  sayc('回溯 → DFS；分支界限 → BFS');
}]);

// ════════ 052VkKhIaQ4（Abdul Bari 6.3：Graph Coloring） ════════
// 例圖由字幕推得（2 和 1、3 相鄰；3 不和 1 相鄰；5 和 3、4 相鄰）：1 紅、2 綠、3 紅、4 綠、5 藍。
const gcPos = (dx = 0, dz = 0) => { const o = {}; for (const k in GC5.nodes) { const [x, y, z] = GC5.nodes[k]; o[k] = [x + dx, y, z + dz]; } return o; };
function gcWorld(dx = 0, dz = 0, drop = true) {
  const g = graph(gcPos(dx, dz), GC5.edges, { drop });
  const adj = adjOf([1, 2, 3, 4, 5], GC5.edges);
  const col = {};
  const W = { g, adj, col };
  W.calm = () => { GC5.edges.forEach(([a, b]) => g.E[ek(a, b)].material.color.set(EDGE)); [1, 2, 3, 4, 5].forEach((v) => glow(g.N[v], null)); };
  // try colour c on v: returns the clashing neighbours (shown red)
  W.tryC = (v, c) => {
    W.calm(); tint(g.N[v], COL[c]); glow(g.N[v], GOLD);
    const clash = adj[v].filter((u) => col[u] === c);
    clash.forEach((u) => { g.E[ek(u, v)].material.color.set(C.R); glow(g.N[u], REDEM); });
    if (!clash.length) col[v] = c;
    return clash;
  };
  W.set = (v, c) => { col[v] = c; tint(g.N[v], c ? COL[c] : C.K); };
  W.wipe = () => { W.calm(); [1, 2, 3, 4, 5].forEach((v) => W.set(v, null)); };
  return W;
}
function palette(cols, x, y, z = 0) { return cols.map((c, i) => bx(CN[c], COL[c], x + i * 1.0, y, z, 0.8, 2, 0.5, 0.6)); }

// 0:00 問題：相鄰頂點不同色
FRAG.push(['bt-gc-intro', '回溯：Graph coloring，相鄰不同色', async (tok) => {
  fresh([0, 8.5, 8.5], [0.4, 0, 0.1]);
  await step(tok);                                   // 0:00 graph coloring problem
  hd('Graph Coloring（圖著色）', 0.6, 0.3, -3.6);
  sayc('主題：圖著色問題', '可以用回溯解');
  await step(tok);                                   // 0:07 a graph is given
  const W = gcWorld();
  sayc('給一張圖（5 個頂點）');
  await step(tok);                                   // 0:13 three colours: red, green, blue
  palette(['R', 'G', 'B'], -5.6, 0.3, 3.0);
  sayc('再給 3 種顏色：紅、綠、藍');
  await step(tok);                                   // 0:19 no two adjacent vertices same colour
  note('相鄰的兩個頂點不能同色', 1.2, 0.4, 3.2);
  sayc('規則：相鄰頂點不能同色');
  await step(tok);                                   // 0:34 vertex 1 red
  W.tryC(1, 'R');
  sayc('頂點 1 塗紅');
  await step(tok);                                   // 0:37 vertex 2: neighbours 1 and 3; red?
  W.tryC(2, 'R');
  sayc('頂點 2 和 1 相鄰，1 已經是紅', '2 不能塗紅');
  await step(tok);                                   // 0:48 give green
  W.tryC(2, 'G');
  sayc('頂點 2 改塗綠');
  await step(tok);                                   // 0:54 vertex 3 red: not adjacent to 1
  W.tryC(3, 'R');
  sayc('頂點 3 不和 1 相鄰 → 可以紅');
  await step(tok);                                   // 1:00 x4 red? adjacent → no
  W.tryC(4, 'R');
  sayc('頂點 4 塗紅？鄰居有紅色 → 不行');
  await step(tok);                                   // 1:06 green → ok
  W.tryC(4, 'G');
  sayc('頂點 4 塗綠：可以');
  await step(tok);                                   // 1:12 vertex 5 red? no
  W.tryC(5, 'R');
  sayc('頂點 5 塗紅？和 3 相鄰 → 不行');
  await step(tok);                                   // 1:17 green? no
  W.tryC(5, 'G');
  sayc('塗綠？和 4 相鄰 → 不行');
  await step(tok);                                   // 1:22 blue → yes
  W.tryC(5, 'B');
  sayc('塗藍：和鄰居都不同 → 可以');
  await step(tok);                                   // 1:29 red green red green blue
  W.calm();
  good('解 1：紅 綠 紅 綠 藍', -4.6, 0.4, -3.0);
  sayc('一組解：紅 綠 紅 綠 藍');
  await step(tok);                                   // 1:41 is it the only solution?
  sayc('這是唯一的解嗎？');
  await step(tok);                                   // 1:54 vertex 1 green instead
  W.wipe(); W.tryC(1, 'G');
  sayc('換個開頭：頂點 1 塗綠');
  await step(tok);                                   // 1:56 vertex 2 → red
  W.tryC(2, 'R');
  sayc('頂點 2 不能綠 → 紅');
  await step(tok);                                   // 2:00 vertex 3 → green
  W.tryC(3, 'G');
  sayc('頂點 3 不能紅 → 綠');
  await step(tok);                                   // 2:02 vertex 4 → red
  W.tryC(4, 'R');
  sayc('頂點 4 → 紅');
  await step(tok);                                   // 2:06 vertex 5 → blue
  W.tryC(5, 'B'); W.calm();
  good('解 2：綠 紅 綠 紅 藍', -4.6, 0.4, -2.3);
  sayc('頂點 5 → 藍');
  await step(tok);                                   // 2:12 more than one solution
  glow(W.g.N[1], GOLD);
  sayc('同一張圖可以有好幾種塗法');
  await step(tok);                                   // 2:17 we want all possible solutions
  note('要「所有」塗法', 1.2, 0.4, 2.4);
  sayc('我們要的是「全部」的解');
  await step(tok);                                   // 2:24 try all, pick those satisfying the condition
  sayc('試遍所有可能', '挑出符合「相鄰不同色」的');
  await step(tok);                                   // 2:35 solved using backtracking
  hot('→ Backtracking', 4.6, 0.4, -3.0);
  sayc('要所有解＋有條件 → 用回溯');
}]);

// 2:45 m-coloring 判定與最佳化
FRAG.push(['bt-gc-types', '回溯：m-coloring 判定 / 最佳化', async (tok) => {
  fresh([0, 8.5, 8.5], [0.4, 0, 0.1]);
  const W = gcWorld(-2.6, 0, false);
  const fill = (cs) => [1, 2, 3, 4, 5].forEach((v, i) => W.set(v, cs[i]));
  fill(['R', 'G', 'R', 'G', 'B']);
  const mt = hd('m = 3', -6.0, 0.3, -2.6);
  const px = 4.4;
  await step(tok);                                   // 2:45 three colours were given, coloured
  sayc('剛才：給 3 色，塗得完');
  await step(tok);                                   // 2:51 only two colours?
  W.wipe(); txt(mt, 'm = 2');
  fill(['R', 'G', 'R', 'G', null]);
  sayc('只給 2 色（紅、綠）呢？');
  await step(tok);                                   // 2:56 cannot be coloured
  [[3, 4], [4, 5], [3, 5]].forEach(([a, b]) => W.g.E[ek(a, b)].material.color.set(C.R));
  glow(W.g.N[5], REDEM);
  const no2 = bad('3、4、5 兩兩相鄰 → 2 色不夠', -2.4, 0.4, 3.0);
  sayc('塗不完：3、4、5 三角形要 3 色');
  await step(tok);                                   // 3:00 four colours (yellow)?
  W.wipe(); txt(mt, 'm = 4'); kill(no2);
  sayc('給 4 色（多一個黃色）？');
  await step(tok);                                   // 3:04 yes
  fill(['R', 'G', 'Y', 'G', 'B']);
  sayc('可以塗', '顏色多了不一定全部用到');
  await step(tok);                                   // 3:10 graph + colours: can it be coloured?
  const t2 = bx('m 色塗得完嗎？', C.B, px, 0.3, -1.4, 3.6, 2, 0.5, 0.8);
  sayc('問題：給 m 色，塗得完嗎？');
  await step(tok);                                   // 3:21 don't want the colours, just yes / no
  tag('只回答 YES / NO', 'idx', px, 0.4, -0.7);
  sayc('不用給出塗法，只要 YES / NO');
  await step(tok);                                   // 3:28 m-coloring decision problem
  hot('m-coloring decision problem', px, 0.4, -2.2);
  sayc('m-coloring decision problem');
  await step(tok);                                   // 3:39 minimum how many colours?
  const t3 = bx('最少要幾色？', C.O, px, 0.3, 0.6, 3.6, 2, 0.5, 0.8);
  sayc('另一個問題：最少要幾種顏色？');
  await step(tok);                                   // 3:47 m-coloring optimization problem
  hot('m-coloring optimization problem', px, 0.4, 1.4);
  sayc('m-coloring optimization problem');
  await step(tok);                                   // 4:01 three types: all ways to colour
  const t1 = bx('所有塗法', C.G, px, 0.3, -3.2, 3.6, 2, 0.5, 0.8);
  glow(t1, GOLD);
  sayc('所以有三種問題', '① 列出所有塗法');
  await step(tok);                                   // 4:11 second: colours given, possible?
  glow(t2, GOLD); glow(t1, null);
  sayc('② 給定顏色，塗得完嗎（decision）');
  await step(tok);                                   // 4:16 third: minimum colours
  glow(t3, GOLD); glow(t2, null);
  sayc('③ 不給顏色，最少幾色（optimization）');
  await step(tok);                                   // 4:25 before colouring: know the minimum
  sayc('開工前先問最少幾色 → optimization');
  await step(tok);                                   // 4:34 already have colours: sufficient?
  glow(t2, GOLD); glow(t3, null);
  sayc('手上已有顏色，夠不夠 → decision');
  await step(tok);                                   // 4:43 chromatic number
  glow(t3, GOLD); glow(t2, null);
  note('最少色數 = chromatic number（這張圖 = 3）', px - 0.4, 0.4, 2.4);
  W.wipe(); fill(['R', 'G', 'R', 'G', 'B']);
  sayc('最少色數叫 chromatic number', '這張圖是 3');
}]);

// 4:54 不加條件的狀態空間樹
FRAG.push(['bt-gc-treesize', '回溯：著色樹 1+3+…+3⁴ 個節點', async (tok) => {
  fresh([0, 4.6, 15], [0.6, 3.4, 0]);
  const cols = ['R', 'G', 'B'];
  // the square stands upright (the camera is nearly level, so a square on the floor would collapse to a line)
  const SQ = { 1: [-6.9, 1.5, 3.2], 2: [-5.7, 1.5, 3.2], 3: [-5.7, 0.4, 3.2], 4: [-6.9, 0.4, 3.2] };
  const lvl = (d) => {
    const cnt = Math.pow(3, d), y = 6.6 - d * 1.45, Wd = 11.2, cx = 1.0;
    const w = Math.min(0.55, Wd / cnt * 0.82);
    for (let i = 0; i < cnt; i++) {
      const x = cnt === 1 ? cx : cx - Wd / 2 + (i + 0.5) * Wd / cnt;
      cube(d && cnt <= 9 ? CN[cols[i % 3]] : '', d ? COL[cols[i % 3]] : C.D, [w, 0.38, 0.38], x, y, 0, d >= 3 ? 0 : 1);
    }
    return y;
  };
  const lev = (d) => { const y = lvl(d); hd('x' + d, -5.6, y); };
  await step(tok);                                   // 4:56 a simple graph, 3 colours
  graph(SQ, [[1, 2], [2, 3], [3, 4], [4, 1]], { size: [0.5, 0.45, 0.5], r: 0.04 });
  sayc('一張簡單的圖（4 個頂點）＋ 3 種顏色');
  await step(tok);                                   // 5:07 backtracking: generate a state space tree
  sayc('回溯的做法：產生狀態空間樹');
  await step(tok);                                   // 5:16 first without any conditions
  note('先不檢查任何條件', -3.6, 7.6, 0);
  sayc('先不加任何條件，全部畫出來');
  await step(tok);                                   // 5:25 the root
  const lt = hd('root', -5.6, lvl(0));
  sayc('root');
  await step(tok);                                   // 5:28 first vertex x1: R / G / B
  lev(1);
  sayc('第 1 層 = 頂點 x1：紅、綠、藍');
  await step(tok);                                   // 5:37 second vertex: R G B under each
  lev(2);
  sayc('第 2 層 = x2：每個節點再分 3 支');
  await step(tok);                                   // 5:55 third vertex
  lev(3);
  sayc('第 3 層 = x3');
  await step(tok);                                   // 6:08 fourth vertex
  lev(4);
  sayc('第 4 層 = x4');
  await step(tok);                                   // 6:31 all possibilities, no adjacency check
  sayc('這棵樹 = 所有塗法', '沒檢查相鄰（鄰居同色也算進去）');
  await step(tok);                                   // 6:44 it becomes very big
  bub('不加條件，樹非常大', 4.2, 7.6, 0);
  sayc('樹變得非常大', '回溯會加條件來剪');
  const cnt = hot('節點數 = 1', 3.4, 0.2, 1.6);
  await step(tok);                                   // 6:56 root: 1 node
  sayc('數一數有幾個節點：root 1 個');
  await step(tok);                                   // 7:04 first level 3
  txt(cnt, '1 + 3'); sayc('第 1 層：3 個');
  await step(tok);                                   // 7:07 second 3 × 3
  txt(cnt, '1 + 3 + 3²'); sayc('第 2 層：3 × 3 = 9');
  await step(tok);                                   // 7:09 third 27
  txt(cnt, '1 + 3 + 3² + 3³'); sayc('第 3 層：3 × 3 × 3 = 27');
  await step(tok);                                   // 7:15 next 3⁴
  txt(cnt, '1 + 3 + 3² + 3³ + 3⁴'); sayc('第 4 層：3⁴ = 81');
  await step(tok);                                   // 7:32 1 + 3 + 3² + 3³ + 3⁴
  txt(cnt, '1+3+9+27+81 = 121'); sayc('全部加起來 = 121 個', '沒用任何 bounding function');
  await step(tok);                                   // 7:42 (3^(4+1) − 1)/(3 − 1)
  note('等比級數 = (3⁴⁺¹ − 1) / (3 − 1)', 3.4, 0.4, 2.6);
  sayc('等比級數：(3⁵ − 1)/(3 − 1)');
  await step(tok);                                   // 7:52 ≈ 3^(n+1), c^(n+1)
  note('≈ 3ⁿ⁺¹，一般 cⁿ⁺¹', 3.4, 0.4, 3.5);
  sayc('大約 3ⁿ⁺¹（n = 頂點數）', '一般 c 種顏色 → cⁿ⁺¹');
  await step(tok);                                   // 8:06 time = number of nodes → exponential
  txt(lt, 'O(3ⁿ)'); setCls(lt, 'ptr alt');
  sayc('時間 ≈ 節點數 → O(3ⁿ)', '指數時間');
}]);

// 8:21 回溯＋bounding function：正方形圖 1-2-3-4
FRAG.push(['bt-gc-backtrack', '回溯：正方形圖著色，bounding function', async (tok) => {
  fresh([0.2, 4.4, 15], [0.2, 3.6, 0]);
  const SQ = { 1: [-6.1, 5.8, 0], 2: [-4.5, 5.8, 0], 3: [-4.5, 4.2, 0], 4: [-6.1, 4.2, 0] };
  const SE = [[1, 2], [2, 3], [3, 4], [4, 1]];
  const g = graph(SQ, SE, { size: [0.55, 0.5, 0.4], r: 0.04 });
  const adj = adjOf([1, 2, 3, 4], SE);
  const root = mkT('', null);
  const ev = [];
  (function dfs(node, asg) {
    const v = asg.length + 1;
    for (const c of v === 1 ? ['R'] : ['R', 'G', 'B']) {
      const k = mkT(c, node, { v, c, asg: [...asg, c] });
      k.bad = adj[v].filter((u) => u < v && asg[u - 1] === c);
      k.killed = k.bad.length > 0; k.sol = !k.killed && v === 4;
      ev.push({ t: 'add', n: k });
      if (!k.killed && v < 4) dfs(k, [...asg, c]);
      ev.push({ t: 'back', n: k });
    }
  })(root, []);
  layout(root, -2.3, 6.6, 7.0, 1.5);
  const solT = []; let i = 0, adds = 0, last = null;
  const clr = () => SE.forEach(([a, b]) => g.E[ek(a, b)].material.color.set(EDGE));
  async function run(target, killIt = false) {
    clr();
    const all = target === Infinity;
    while (i < ev.length) {
      const e = ev[i], n = e.n;
      if (e.t === 'add') {
        if (!all && adds >= target) break;
        i++; adds++;
        nodeAt(n, COL[n.c], [0.44, 0.4, 0.4]); tint(g.N[n.v], COL[n.c]); last = n;
        if (n.killed) { n.bad.forEach((u) => g.E[ek(u, n.v)].material.color.set(C.R)); glow(n.m, REDEM); if (killIt || all) killT(n); }
        else if (n.sol) { glow(n.m, GREEN); tag('✓', 'ptr alt', n.x, n.y - 0.55); solT.push(hot(n.asg.join(' '), -5.3, 3.1 - solT.length * 0.42)); }
        if (all) await wt(tok, 50);
      } else {
        if (n.killed && !n.x2) killT(n);
        i++; if (n.v > 1) tint(g.N[n.v], C.K);
        if (n.sol) glow(n.m, null);
        if (all) clr();
      }
    }
  }
  const killLast = () => { if (last && last.killed && !last.x2) killT(last); };
  await step(tok);                                   // 8:21 solve it using backtracking
  nodeAt(root, C.D, [0.5, 0.42, 0.42]);
  for (let d = 1; d <= 4; d++) tag('x' + d, 'ptr', -3.2, 7.0 - d * 1.5);
  sayc('現在用回溯來解');
  await step(tok);                                   // 8:25 backtracking reduces the tree
  note('時間仍算 O(3ⁿ)，但實際少畫很多', 2.2, 7.8, 0);
  sayc('回溯會少產生很多節點');
  await step(tok);                                   // 8:37 x1 red
  await run(1);
  sayc('x1 = 紅');
  await step(tok);                                   // 8:45 x2 red? adjacent
  await run(2);
  sayc('x2 = 紅？和 1 相鄰 → 不行');
  await step(tok);                                   // 8:59 killed by bounding function
  killLast();
  sayc('被 bounding function 殺掉');
  await step(tok);                                   // 9:05 green allowed
  await run(3);
  sayc('x2 = 綠：可以');
  await step(tok);                                   // 9:22 third vertex red: allowed
  await run(4);
  sayc('x3 = 紅：不和 1 相鄰 → 可以');
  await step(tok);                                   // 9:37 vertex 4 red? killed
  await run(5, true);
  sayc('x4 = 紅：鄰居有紅 → 殺掉');
  await step(tok);                                   // 9:51 green → yes
  await run(6);
  sayc('x4 = 綠：可以 → 一組解');
  await step(tok);                                   // 10:04 DFS; try blue too
  await run(7);
  sayc('像 DFS，接著試藍 → 也可以');
  await step(tok);                                   // 10:17 two solutions
  sayc('兩組解：R G R G、R G R B');
  await step(tok);                                   // 10:39 go back: x3 green? killed
  await run(8, true);
  sayc('退回 x3 試綠：和 2 相鄰 → 殺掉');
  await step(tok);                                   // 11:00 blue ok
  await run(9);
  sayc('x3 = 藍：可以');
  await step(tok);                                   // 11:06 x4 red? killed
  await run(10, true);
  sayc('x4 = 紅：和 1 相鄰 → 殺掉');
  await step(tok);                                   // 11:13 green → R G B G
  await run(11);
  sayc('x4 = 綠 → 解 R G B G');
  await step(tok);                                   // 11:27 blue? killed
  await run(12, true);
  sayc('x4 = 藍：和 3 相鄰 → 殺掉');
  await step(tok);                                   // 11:43 back to x2: blue
  await run(13);
  sayc('一路退回 x2，改試藍');
  await step(tok);                                   // 11:56 x3 red ok
  await run(14);
  sayc('x3 = 紅：可以');
  await step(tok);                                   // 12:10 x4 red killed
  await run(15, true);
  sayc('x4 = 紅 → 殺掉');
  await step(tok);                                   // 12:17 green → R B R G
  await run(16);
  sayc('x4 = 綠 → 解 R B R G');
  await step(tok);                                   // 12:28 blue → R B R B
  await run(17);
  sayc('x4 = 藍 → 解 R B R B');
  await step(tok);                                   // 12:40 continue: all solutions
  await run(Infinity);
  sayc('照這樣繼續，就找出全部的解', 'x1 = 紅 這支共 6 組；綠、藍開頭同理');
  await step(tok);                                   // 12:56 at most 3ⁿ
  hot('O(3ⁿ)', 2.2, 0.5, 0);
  sayc('剪掉一些節點，但最壞仍是 3ⁿ', '時間複雜度 O(3ⁿ)');
}]);

// 13:06 應用：地圖著色
FRAG.push(['bt-gc-map', '回溯：地圖著色 → 圖著色', async (tok) => {
  fresh([0, 9, 7.5], [0, 0, 0.4]);
  const R = { 1: [-5, -3, -2, 2], 2: [-3, 0, -2, 0], 3: [-3, 0, 0, 2], 4: [0, 2.5, -2, 2], 5: [2.5, 5, -2, 2] };
  const tiles = {}, ctr = {};
  let g = null;
  const edge = (a, b) => { g.E[ek(a, b)] = rod(V3(...ctr[a]), V3(...ctr[b]), EDGE, 0.05); };
  await step(tok);                                   // 13:13 here is a map with regions
  for (const id in R) { const [x0, x1, z0, z1] = R[id]; ctr[id] = [(x0 + x1) / 2, 0.75, (z0 + z1) / 2]; tiles[id] = ctx.tile(V3(ctr[id][0], 0.04, ctr[id][2]), x1 - x0 - 0.1, z1 - z0 - 0.1, '#e9dcc4'); }
  sayc('一張地圖，有好幾個區域');
  await step(tok);                                   // 13:17 no two adjacent regions same colour
  note('相鄰區域不能同色', 0, 0.4, 3.0);
  sayc('相鄰的區域不能同色');
  await step(tok);                                   // 13:27 olden days: one pass per colour
  prop('printer', 6.2, 0, -2.6, 0.9, '印刷機');
  sayc('以前印刷：每種顏色要過一次印刷機');
  await step(tok);                                   // 13:34 n colours → n passes
  const b5 = bad('每區一色 → 過 5 次', 6.0, 0.4, -0.6);
  sayc('n 種顏色 → 紙要過 n 次');
  await step(tok);                                   // 13:47 want minimum colours
  good('最少色數 → 最少次數', 5.8, 0.4, 0.4);
  sayc('想用最少的顏色 → 降低印刷成本');
  await step(tok);                                   // 14:04 map → graph
  sayc('地圖可以轉成一張圖');
  await step(tok);                                   // 14:17 each region → a vertex
  g = graph(ctr, [], { drop: true, size: [0.6, 0.45, 0.6] });
  sayc('每個區域 → 一個頂點');
  await step(tok);                                   // 14:26 neighbouring regions → an edge
  edge(1, 2); edge(1, 3);
  sayc('有共同邊界 → 畫一條邊', '1–2、1–3');
  await step(tok);                                   // 14:37 vertex 2: 4 and 3
  edge(2, 3); edge(2, 4);
  sayc('2 和 3、4 相鄰');
  await step(tok);                                   // 14:40 vertex 3: 4
  edge(3, 4);
  sayc('3 和 4 相鄰');
  await step(tok);                                   // 14:45 vertex 4: 5
  edge(4, 5);
  sayc('4 和 5 相鄰');
  await step(tok);                                   // 14:49 this forms a graph
  sayc('得到一張圖：1, 2, 3, 4, 5');
  await step(tok);                                   // 15:06 solve m-coloring, fill colours into regions
  const col = { 1: 'R', 2: 'G', 3: 'B', 4: 'R', 5: 'G' };
  for (const id in col) { tint(g.N[id], COL[col[id]]); tiles[id].material.color.set(COL[col[id]]); }
  kill(b5); good('3 色就夠 → 只過 3 次', 6.0, 0.4, -0.6);
  sayc('圖著色的結果填回地圖', '3 色就夠');
  await step(tok);                                   // 15:16 nowadays printers do it in one shot
  sayc('現在的印表機一次印完', '以前每色一次，還要等紙乾');
  await step(tok);                                   // 15:38 other problems → graph colouring
  sayc('其他問題也能轉成圖著色來解');
}]);

// ════════ 3RBNPc0_Q6g（Abdul Bari 7：Branch and Bound Introduction） ════════
// 0:00 分支界限是什麼；解的兩種表示
FRAG.push(['bt-bb-forms', '分支界限：最小化問題、解的兩種表示', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.4, 0]);
  let jobs = [], bits = [];
  await step(tok);                                   // 0:00 branch and bound
  hd('Branch and Bound（分支界限）', 0, 6.2);
  sayc('主題：Branch and Bound');
  await step(tok);                                   // 0:03 one more problem solving strategy
  sayc('又一種解題策略');
  await step(tok);                                   // 0:10 similar to backtracking: state space tree
  note('和回溯一樣：用狀態空間樹', 0, 5.3);
  sayc('和回溯一樣，用狀態空間樹表示解');
  await step(tok);                                   // 0:21 optimization problems
  const opt = bx('最佳化問題', C.O, -3.0, 3.8, 0, 3.2, 2, 0.6, 0.9);
  sayc('但它是解 optimization problem 的');
  await step(tok);                                   // 0:26 only minimization; convert maximization
  bx('只做 minimization', C.B, 2.4, 3.8, 0, 3.4, 2, 0.6, 0.9);
  tag('max 問題 → 取負號變 min', 'idx', 2.4, 3.0, 0.6);
  glow(opt, GOLD);
  sayc('只做最小化', '最大化可以轉成最小化');
  await step(tok);                                   // 0:38 example: job sequencing with deadlines
  jobs = [1, 2, 3, 4].map((j) => bx('J' + j, JC[j], -4.5 + (j - 1) * 1.6, 0.4, 0, 1.2, 3, 0.8, 1));
  sayc('例：Job sequencing with deadlines', '4 個 job');
  await step(tok);                                   // 0:46 two methods depending on the solution
  sayc('狀態空間樹有兩種畫法', '看解要怎麼表示');
  await step(tok);                                   // 0:52 doing job 1 and job 4
  for (const j of [1, 4]) { move(jobs[j - 1], -4.5 + (j - 1) * 1.6, 1.6, 0); glow(jobs[j - 1], GREEN); }
  sayc('假設解是：做 J1 和 J4');
  await step(tok);                                   // 1:00 subset of jobs
  const sub = hd('{J1, J4}', 3.0, 2.2);
  sayc('表示法一：子集合 {J1, J4}');
  await step(tok);                                   // 1:07 first done, 2 & 3 not, 4 done
  bits = [1, 0, 0, 1].map((b, i) => cube(b, b ? C.G : C.K, [0.7, 0.6, 0.7], 1.6 + i * 0.95, 0.3, 0, 2.5));
  sayc('表示法二：(1, 0, 0, 1)', '做 = 1，不做 = 0');
  await step(tok);                                   // 1:13 variable size vs fixed size
  tag('variable size', 'ptr alt', 3.0, 2.9);
  tag('fixed size', 'ptr alt', 3.0, 1.2);
  sayc('子集合：variable size', '0/1 向量：fixed size');
  await step(tok);                                   // 1:19 sometimes 3 jobs, sometimes 1
  txt(sub, '{J2, J3, J4} 或 {J1}');
  sayc('子集合有時 3 個、有時 1 個', '長度會變 → variable size');
  await step(tok);                                   // 1:28 fixed size: always n zeros / ones
  bits.forEach((m) => glow(m, GOLD));
  sayc('0/1 向量：長度永遠 = job 數', '→ fixed size');
  await step(tok);                                   // 1:40 follow the subset method first
  bits.forEach((m) => glow(m, null)); glow(opt, null);
  txt(sub, '{J1, J4}'); setCls(sub, 'ptr alt');
  sayc('先用子集合（variable size）畫樹');
}]);

// 樹：4 個 job 的子集合樹（module jobTree），由場景自己決定展開順序
function jobWorld(x0, x1) {
  const root = jobTree();
  layout(root, x0, x1, 6.8, 1.35);
  jobLegend(-6.4, 7.6);
  let num = 1; root.label = '1';
  const W = { root };
  W.draw = (n) => { if (n === root) { nodeAt(root, C.D); return; } n.label = String(++num); nodeAt(n, JC[n.j], [0.46, 0.4, 0.4]); };
  return W;
}

// 1:47 FIFO（queue）
FRAG.push(['bt-bb-fifo', '分支界限：FIFO（queue）產生節點 1–16', async (tok) => {
  fresh([0, 4.0, 14.5], [0.3, 3.2, 0]);
  const W = jobWorld(-4.8, 6.4), root = W.root;
  tag('Queue（FIFO）', 'ptr', -6.0, 0.9, 2.2);
  const Q = [];
  const qx = (i) => -4.4 + i * 0.82;
  const enq = (n) => { const m = cube(n.label, JC[n.j], [0.66, 0.46, 0.5], qx(Q.length), 0.3, 2.2, 2); Q.push({ n, m }); };
  const kid = (n) => { W.draw(n); enq(n); };
  let E = null;
  // take the next node out of the queue and generate all its children
  async function expand() {
    if (E) glow(E.m, null);
    const q = Q.shift(); if (!q) return null;
    kill(q.m); Q.forEach((o, i) => move(o.m, qx(i), 0.3, 2.2));
    E = q.n; glow(E.m, GOLD);
    for (const k of E.kids) { kid(k); await wt(tok, 160); }
    return E;
  }
  await step(tok);                                   // 1:50 root, first job
  W.draw(root); glow(root.m, GOLD); kid(root.kids[0]);
  sayc('root（節點 1），先考慮 J1 → 節點 2');
  await step(tok);                                   // 2:02 B&B also considers second job
  kid(root.kids[1]);
  sayc('回溯會往下一層；分支界限接著產生 J2');
  await step(tok);                                   // 2:08 third, fourth job
  kid(root.kids[2]); await wt(tok, 200); kid(root.kids[3]);
  sayc('再產生 J3、J4 → 節點 4、5');
  await step(tok);                                   // 2:11 like breadth first search
  glow(root.m, null);
  hot('BFS：一層一層', -4.8, 7.0);
  sayc('同一層全部產生 → 像 BFS');
  await step(tok);                                   // 2:27 backtracking DFS, B&B BFS
  sayc('回溯 = DFS；分支界限 = BFS');
  await step(tok);                                   // 2:37 one level completed
  sayc('第一層完成：每個 job 都考慮過了', '它們依序排在 queue 裡');
  await step(tok);                                   // 2:42 take job 1: then J2, J3, J4 → 6, 7, 8
  await expand();
  sayc('展開節點 2（已選 J1）', '可再選 J2、J3、J4 → 節點 6、7、8');
  await step(tok);                                   // 2:57 a route: first job and fourth job
  const p8 = root.kids[0].kids[2]; glow(p8.m, GREEN);
  sayc('走這條路 = 做 J1、J4', '不做 J2、J3');
  await step(tok);                                   // 3:06 which node next?
  glow(p8.m, null);
  if (Q[0]) glow(Q[0].m, GOLD);
  sayc('下一個展開誰？queue 最前面的：節點 3');
  await step(tok);                                   // 3:14 second job → J3, J4
  await expand();
  sayc('展開節點 3（J2）→ J3、J4');
  await step(tok);                                   // 3:26 first job discarded
  note('J1 已經不考慮了', 3.6, 0.4, 2.2);
  sayc('J1 不再考慮', '子集合只往後面的 job 長');
  await step(tok);                                   // 3:31 only fourth job: node 11
  await expand();
  sayc('節點 4（J3）只剩 J4 → 節點 11');
  await step(tok);                                   // 3:37 next: J3 or J4
  await expand(); await expand();
  sayc('節點 5 已到 J4；展開節點 6 → J3、J4');
  await step(tok);                                   // 3:44 only fourth job
  await expand();
  sayc('節點 7 → 只剩 J4');
  await step(tok);                                   // 3:49 fourth job
  await expand(); await expand();
  sayc('節點 8 已到 J4；節點 9 → J4');
  await step(tok);                                   // 3:57 all reach J4: the last node
  while (Q.length) await expand();
  if (E) glow(E.m, null);
  sayc('全部都到 J4，整棵樹產生完', '共 16 個節點');
  await step(tok);                                   // 4:05 any node: J2 & J4, J3 & J4
  const a = root.kids[1].kids[1], b = root.kids[2].kids[0];
  glow(a.m, GREEN); glow(b.m, GREEN);
  hot('{J2, J4}', a.x, a.y - 0.6); hot('{J3, J4}', b.x, b.y - 0.6);
  sayc('每個節點代表一個子集合', '例：{J2, J4}、{J3, J4}');
}]);

// 4:21 LIFO（stack）
FRAG.push(['bt-bb-lifo', '分支界限：LIFO（stack）產生順序', async (tok) => {
  fresh([0, 4.0, 14.5], [0.3, 3.2, 0]);
  const W = jobWorld(-4.0, 6.5), root = W.root;
  tag('Stack（LIFO）', 'ptr', -5.9, 0.0, 1.2);
  const S = [];
  const push = (n) => { W.draw(n); S.push({ n, m: cube(n.label, JC[n.j], [0.8, 0.42, 0.6], -5.9, 0.6 + S.length * 0.48, 1.2, 2.5) }); };
  let E = null;
  async function pop() {
    if (E) glow(E.m, null);
    const s = S.pop(); if (!s) return null;
    kill(s.m); E = s.n; glow(E.m, GOLD); return E;
  }
  async function grow() { for (const k of E.kids) { push(k); await wt(tok, 200); } }
  await step(tok);                                   // 4:26 second method; first node
  W.draw(root); E = root; glow(root.m, GOLD);
  sayc('第二種方法：一樣的子集合樹', '先產生 root（節點 1）');
  await step(tok);                                   // 4:30 job one, put into the stack
  push(root.kids[0]);
  sayc('J1 → 節點 2，放進 stack');
  await step(tok);                                   // 4:39 second, third node
  push(root.kids[1]);
  sayc('J2 → 節點 3，push');
  await step(tok);                                   // 4:41 job three: fourth node
  push(root.kids[2]);
  sayc('J3 → 節點 4，push');
  await step(tok);                                   // 4:47 job four: fifth node
  push(root.kids[3]);
  sayc('J4 → 節點 5，push');
  await step(tok);                                   // 4:52 which next? the fifth node
  glow(root.m, null); glow(S[S.length - 1].m, GOLD);
  sayc('下一個展開誰？stack 頂端：節點 5', '後進先出');
  await step(tok);                                   // 5:00 pop and expand: last job already
  await pop();
  sayc('pop 出節點 5（J4）', '已是最後一個 job，不能展開');
  await step(tok);                                   // 5:06 pop next → job four: node 6
  await pop(); await grow();
  sayc('pop 節點 4（J3）→ 產生 J4 = 節點 6');
  await step(tok);                                   // 5:17 node six: last job
  await pop();
  sayc('pop 節點 6：最後一個 job，不能展開');
  await step(tok);                                   // 5:23 pop next: J3 or J4 → 7, 8
  await pop(); await grow();
  sayc('pop 節點 3（J2）→ 節點 7、8，push');
  await step(tok);                                   // 5:39 node 8: on the 4th job
  await pop();
  sayc('pop 節點 8：已到 J4');
  await step(tok);                                   // 5:47 node 7 → node 9
  await pop(); await grow();
  sayc('pop 節點 7 → J4 = 節點 9');
  await step(tok);                                   // 5:55 node 9 cannot be explored
  await pop();
  sayc('pop 節點 9：不能再展開');
  await step(tok);                                   // 6:03 take out 2 → 10, 11, 12
  await pop(); await grow();
  sayc('pop 節點 2（J1）→ 節點 10、11、12', '同樣順序 push');
  await step(tok);                                   // 6:21 the difference from before
  if (E) glow(E.m, null);
  sayc('和前一種方法差在哪？');
  await step(tok);                                   // 6:32 queue → FIFO branch and bound
  note('用 queue → FIFO B&B', 2.0, 0.5, 2.4);
  sayc('用 queue 選下一個 → FIFO Branch & Bound');
  await step(tok);                                   // 6:39 stack → LIFO branch and bound
  note('用 stack → LIFO B&B', 2.0, 0.5, 3.2);
  sayc('用 stack → LIFO Branch & Bound');
  await step(tok);                                   // 6:48 BFS: explore all children first
  sayc('兩種都是 BFS 式展開', '選到一個節點，就把它的孩子全部產生');
  await step(tok);                                   // 6:58 then select the next one
  sayc('全部產生完，才去選下一個', '從 queue 或 stack 裡選');
}]);

// 7:05 LC branch and bound
FRAG.push(['bt-bb-lc', '分支界限：LC，挑 cost 最小的節點', async (tok) => {
  fresh([0, 4.0, 13.5], [0.6, 3.6, 0]);
  jobLegend(-6.4, 7.4);
  const root = mkT('1', null, { cost: INF });
  const kids = [25, 12, 19, 30].map((c, i) => mkT(String(i + 2), root, { j: i + 1, cost: c }));
  const g1 = mkT('6', kids[1], { j: 3, cost: 8 }), g2 = mkT('7', kids[1], { j: 4, cost: 7 });
  layout(root, -3.4, 5.8, 6.6, 2.0);
  const costTag = (n) => (n.ct = tag('c = ' + fmtI(n.cost), 'idx', n.x, n.y - 0.6));
  const kidAt = (n) => { nodeAt(n, JC[n.j]); costTag(n); };
  await step(tok);                                   // 7:05 least cost branch and bound
  hd('LC（Least Cost）Branch & Bound', 1.2, 7.6);
  sayc('第三種：Least Cost Branch & Bound');
  await step(tok);                                   // 7:15 generate the tree: first node
  nodeAt(root, C.D);
  sayc('一樣畫狀態空間樹：先產生 root');
  await step(tok);                                   // 7:28 for every node calculate the cost
  sayc('新東西：每個節點都要算一個 cost');
  await step(tok);                                   // 7:34 cost function depends on the problem
  note('cost function：依問題而定', -3.6, 0.4, 1.8);
  sayc('cost 由 cost function 算出', '不同問題有不同的 cost function');
  await step(tok);                                   // 7:40 for all three methods
  note('FIFO、LIFO、LC 都要算 cost', -3.6, 0.4, 2.7);
  sayc('三種方法都要算 cost', '才能解最小化問題');
  await step(tok);                                   // 7:49 root cost infinity
  costTag(root);
  sayc('假設 root 的 cost = ∞');
  await step(tok);                                   // 7:55 first job: 25
  kidAt(kids[0]);
  sayc('J1（節點 2）：cost 25', '老師隨手舉的數字');
  await step(tok);                                   // 8:03 second job: 12
  kidAt(kids[1]);
  sayc('J2（節點 3）：cost 12');
  await step(tok);                                   // 8:11 third job: 19
  kidAt(kids[2]);
  sayc('J3（節點 4）：cost 19');
  await step(tok);                                   // 8:13 fourth job node 5: 30
  kidAt(kids[3]);
  sayc('J4（節點 5）：cost 30');
  await step(tok);                                   // 8:23 next: the node with minimum cost
  sayc('下一個展開誰？cost 最小的');
  await step(tok);                                   // 8:37 FIFO would pick this, LIFO this
  tag('FIFO', 'ptr', kids[0].x, kids[0].y + 0.75); tag('LIFO', 'ptr', kids[3].x, kids[3].y + 0.75);
  sayc('對照：FIFO 選節點 2；LIFO 選節點 5');
  await step(tok);                                   // 8:47 LC: least cost → this one
  glow(kids[1].m, GOLD); setCls(kids[1].ct, 'ptr alt');
  tag('LC', 'ptr alt', kids[1].x, kids[1].y + 0.75);
  sayc('LC：選 cost = 12 的節點 3（J2）');
  await step(tok);                                   // 8:54 job three and job four: costs 8, 7
  kidAt(g1); await wt(tok, 300); kidAt(g2);
  sayc('展開節點 3：J3 cost 8、J4 cost 7');
  await step(tok);                                   // 8:59 which one: this one (7)
  glow(g2.m, GOLD); setCls(g2.ct, 'ptr alt');
  sayc('選 cost 最小的：7');
  await step(tok);                                   // 9:04 last node: J2, J4 → solution
  glow(g2.m, GREEN); glow(kids[1].m, GREEN);
  good('解：{J2, J4}', g2.x + 1.4, g2.y);
  sayc('節點 7 = {J2, J4}，已到最後一個 job', '→ 這就是解');
  await step(tok);                                   // 9:11 no need to generate the entire tree
  sayc('不用產生整棵樹', '一直挑 cost 最小的，很快走到解');
  await step(tok);                                   // 9:22 much faster than FIFO, LIFO
  hot('LC 比 FIFO、LIFO 快', 1.2, 0.5, 1.6);
  sayc('LC 比 FIFO、LIFO 快很多');
  await step(tok);                                   // 9:27 any method: write the cost of each node
  sayc('哪種方法都行，但都要寫出每個節點的 cost', '之後用 B&B 解實際問題');
}]);

// ════════ 1FEP_sNb62k（Abdul Bari 7.3：TSP using Branch and Bound） ════════
// 5 城市成本矩陣 = 影片（課本 Horowitz/Sahni）：reduced 下界 25，最佳 1→4→2→5→3→1 = 28。
const PENTA = (cx, cz, r) => { const P = {}; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; P[i + 1] = [cx + r * Math.cos(a), 0.3, cz + r * Math.sin(a)]; } return P; };
const allPairs = (ids) => { const E = []; ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => E.push([a, b]))); return E; };
// the B&B run of the video (module tspLC) with the video's node numbers 1–11
function tspRun() {
  const res = tspLC(M5), r = res.root;
  const n4 = r.kids[2], n6 = n4.kids[0], n10 = n6.kids[1], n11 = n10.kids[0];
  const order = [r, ...r.kids, ...n4.kids, ...n6.kids, n11];
  const num = new Map(); order.forEach((n, i) => num.set(n, i + 1));
  layout(r, -0.2, 6.6, 6.7, 1.42);
  return { r, n4, n6, n10, n11, num, order };
}
function tspNode(T, n, cost = true) {
  nodeAt(n, n === T.r ? C.D : C.B, [0.48, 0.42, 0.42]);
  n.nt = tag('#' + T.num.get(n), 'idx', n.x - 0.5, n.y + 0.3);
  if (cost) n.ct = tag(String(n.cost), 'ptr', n.x, n.y - 0.58);
  return n;
}
const tspCost = (n) => { n.ct = tag(String(n.cost), 'ptr', n.x, n.y - 0.58); };
// matrix helpers: copy, set row / column to ∞, subtract
const cp = (A) => A.map((r) => r.slice());
const rowInf = (A, i) => { A[i] = A[i].map(() => INF); };
const colInf = (A, j) => { A.forEach((r) => { r[j] = INF; }); };
const subR = (A, i, k) => { A[i] = A[i].map((v) => (v === INF ? INF : v - k)); };
const subC = (A, j, k) => { A.forEach((r) => { if (r[j] !== INF) r[j] -= k; }); };
const mvAt = (A) => matrixView(A, -6.0, 6.0, 0.88, 0.62);

// 0:00 問題：最短環路
FRAG.push(['bt-tsp-problem', '分支界限 TSP：問題與成本矩陣', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  const P = PENTA(-3.6, 0.4, 2.2);
  let g = null;
  await step(tok);                                   // 0:00 TSP using branch and bound
  hd('Traveling Salesperson Problem', 0, 5.6, 0);
  sayc('主題：旅行推銷員問題（TSP）', '用 Branch and Bound 解');
  await step(tok);                                   // 0:08 problem, approach, textbook example
  ['① 問題', '② B&B 做法', '③ 課本例題'].forEach((t, i) => note(t, -2.8 + i * 2.8, 4.6, 0));
  sayc('先講問題，再講做法，最後解課本例題');
  await step(tok);                                   // 0:18 a weighted graph of five vertices
  g = graph(P, allPairs([1, 2, 3, 4, 5]), { drop: true, size: [0.6, 0.45, 0.6], r: 0.03 });
  sayc('給一張加權圖：5 個頂點');
  await step(tok);                                   // 0:23 shortest tour: each vertex once, back to start
  const tour = [1, 2, 3, 4, 5, 1];
  const ball = cube('', C.R, [0.32, 0.32, 0.32], P[1][0], 1.0, P[1][2]);
  for (let k = 0; k < 5; k++) { const a = P[tour[k]], b = P[tour[k + 1]]; rod(V3(...a), V3(...b), C.O, 0.07); await anim(tok, 300, (t) => ball.position.set(a[0] + (b[0] - a[0]) * t, 1.0, a[2] + (b[2] - a[2]) * t)); }
  sayc('找最短的 tour（環路）', '每個頂點恰好經過一次，再回到起點');
  await step(tok);                                   // 0:31 start at 1: 2, 3, 4, 5, back to 1
  glow(g.N[1], GOLD);
  bub('從 1 出發 → 2、3、4、5 → 回到 1', -3.6, 2.4, 0.4);
  sayc('通常從頂點 1 出發，最後回到 1');
  await step(tok);                                   // 0:40 a cost adjacency matrix
  matrixView(M5, 1.7, 3.6);
  tag('c(i, j)：從 i 到 j 的成本', 'idx', 3.5, 0.2, 0);
  sayc('邊的成本用 cost adjacency matrix 給', '注意 c(i, j) 和 c(j, i) 可以不同');
}]);

// 0:46 先用 4 個頂點：狀態空間樹
FRAG.push(['bt-tsp-small', '分支界限 TSP：4 城市的狀態空間樹', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.2, 0]);
  // the 4 cities stand upright (a square on the floor collapses to a line from this nearly level camera)
  const P = { 1: [-7.0, 1.4, 2.0], 2: [-5.6, 1.4, 2.0], 3: [-5.6, 0.3, 2.0], 4: [-7.0, 0.3, 2.0] };
  let g = null;
  const root = mkT('1', null, { path: [1] });
  (function grow(n) { for (const v of [2, 3, 4]) if (!n.path.includes(v)) grow(mkT(String(v), n, { path: [...n.path, v] })); })(root);
  layout(root, -1.6, 6.4, 6.6, 1.65);
  const vc = { 2: C.B, 3: C.P, 4: C.O };
  const lines = [];
  const showTour = async (t) => { lines.forEach(kill); lines.length = 0; for (let k = 0; k + 1 < t.length; k++) { lines.push(rod(V3(...P[t[k]]), V3(...P[t[k + 1]]), C.O, 0.07)); await wt(tok, 200); } };
  await step(tok);                                   // 0:46 a small graph with 4 vertices
  g = graph(P, allPairs([1, 2, 3, 4]), { drop: true, size: [0.55, 0.45, 0.55], r: 0.03 });
  sayc('先拿 4 個頂點的小圖說明做法');
  await step(tok);                                   // 0:57 salesman starts from 1
  glow(g.N[1], GOLD);
  sayc('推銷員從頂點 1 出發');
  await step(tok);                                   // 1:03 around all, back to 1, minimum cost
  note('繞完所有頂點、回到 1，成本最小', -5.0, -0.2, 3.6);
  sayc('走過所有頂點再回到 1', '要成本最小的那條');
  await step(tok);                                   // 1:09 1 → 2 → 3 → 4 → 1
  await showTour([1, 2, 3, 4, 1]);
  sayc('可能走 1→2→3→4→1');
  await step(tok);                                   // 1:16 or another order
  await showTour([1, 3, 2, 4, 1]);
  sayc('也可能 1→3→2→4→1', '順序任意，挑成本最小的');
  await step(tok);                                   // 1:25 state space tree: start from 1
  lines.forEach(kill);
  nodeAt(root, C.D);
  sayc('用狀態空間樹探索：root = 從 1 出發');
  await step(tok);                                   // 1:33 he can visit 2, 3, 4
  for (const k of root.kids) { nodeAt(k, vc[k.label]); await wt(tok, 200); }
  sayc('下一站可以是 2、3 或 4');
  await step(tok);                                   // 1:43 we want the minimum tour
  sayc('任何一個都行，但我們要最小的 tour');
  await step(tok);                                   // 1:49 reached 2: 3 or 4
  for (const k of root.kids[0].kids) nodeAt(k, vc[k.label]);
  sayc('到了 2：剩 3 或 4');
  await step(tok);                                   // 1:56 from 3: the remaining two
  for (const k of root.kids[1].kids) nodeAt(k, vc[k.label]);
  sayc('到了 3：剩 2 或 4');
  await step(tok);                                   // 2:00 from 4: 2 and 3
  for (const k of root.kids[2].kids) nodeAt(k, vc[k.label]);
  sayc('到了 4：剩 2 或 3');
  await step(tok);                                   // 2:05 visited 1, 2, 3 → only 4 remains
  for (const a of root.kids) for (const b of a.kids) for (const c of b.kids) { nodeAt(c, vc[c.label]); tag('→1', 'idx', c.x, c.y - 0.6); await wt(tok, 120); }
  sayc('走過 3 個後，最後一個只剩一種選擇', '再回到 1');
  await step(tok);                                   // 2:17 this tree shows all possible tours
  hot('6 片葉子 = 3! = 6 條 tour', 2.4, 0.5, 0);
  sayc('整棵樹 = 所有可能的 tour', 'n 個城市：(n − 1)! 條');
}]);

// 2:28 回溯 vs 分支界限（同一棵 4 城市樹）
FRAG.push(['bt-tsp-btbb', '分支界限 TSP：回溯與分支界限的差別', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.4, 0]);
  const root = mkT('1', null, { path: [1] });
  (function grow(n) { for (const v of [2, 3, 4]) if (!n.path.includes(v)) grow(mkT(String(v), n, { path: [...n.path, v] })); })(root);
  layout(root, -5.4, 5.4, 6.6, 1.65);
  const vc = { 2: C.B, 3: C.P, 4: C.O };
  const pre = []; (function p(n) { pre.push(n); n.kids.forEach(p); })(root);
  const bfs = []; { const q = [root]; while (q.length) { const n = q.shift(); bfs.push(n); q.push(...n.kids); } }
  const leaves = pre.filter((n) => !n.kids.length);
  const numT = [];
  await step(tok);                                   // 2:28 both use the tree, approach differs
  hd('Backtracking', -4.6, 7.5); hd('Branch & Bound', 4.6, 7.5);
  sayc('回溯和分支界限都用狀態空間樹', '但解題的走法不同');
  await step(tok);                                   // 2:43 backtracking: order of generation
  for (let k = 0; k < pre.length; k++) { const n = pre[k]; nodeAt(n, n === root ? C.D : vc[n.label], [0.46, 0.4, 0.4]); numT.push(tag(String(k + 1), 'idx', n.x + 0.42, n.y + 0.3)); await wt(tok, 130); }
  sayc('回溯：照數字順序產生節點');
  await step(tok);                                   // 3:07 depth first search, pre-order
  hot('DFS（像 preorder）', -4.6, 6.8);
  sayc('這是 DFS，和前序走訪一樣');
  await step(tok);                                   // 3:15 every leaf = a solution, but we want the minimum
  leaves.forEach((n) => glow(n.m, GREEN));
  sayc('回溯：每片葉子都是一組解', '但我們只要成本最小的 tour');
  await step(tok);                                   // 3:31 find this cost, keep the smaller
  leaves.forEach((n) => glow(n.m, null));
  glow(leaves[0].m, GOLD); const b0 = good('目前最小', leaves[0].x, leaves[0].y - 0.75);
  sayc('算每條 tour 的成本', '先記下目前最小的');
  await step(tok);                                   // 3:45 larger → discard
  bad('較大 ✗', leaves[1].x, leaves[1].y - 0.75);
  sayc('下一條比較大 → 丟掉', '已經有更短的了');
  await step(tok);                                   // 3:56 track them, take the better one
  kill(b0); glow(leaves[0].m, null); glow(leaves[3].m, GOLD); good('更小 → 換它', leaves[3].x, leaves[3].y - 0.75);
  sayc('一路比下去，記住最好的那條');
  await step(tok);                                   // 4:07 backtracking: time consuming
  bad('回溯：每條都要走完 → 很花時間', -2.6, 0.5, 1.4);
  sayc('回溯能解，但很花時間', '最佳化問題不用它，用在排列問題');
  await step(tok);                                   // 4:21 branch and bound: level order
  numT.forEach(kill);
  pre.forEach((n) => glow(n.m, null));
  for (let k = 0; k < bfs.length; k++) { const n = bfs[k]; tag(String(k + 1), 'ptr alt', n.x + 0.42, n.y + 0.3); await wt(tok, 120); }
  hot('BFS（level order）', 4.6, 6.8);
  sayc('分支界限：一層一層（level order）產生');
  await step(tok);                                   // 4:43 cost of every node; > upper bound → kill
  [root.kids[0], root.kids[2]].forEach((n) => { tag('cost', 'idx', n.x, n.y - 0.6); });
  killT(root.kids[2]);
  sayc('每個節點都算 cost', 'cost 大於上界（upper）→ 殺掉');
  await step(tok);                                   // 4:57 generate only fruitful nodes
  good('B&B：只長有希望的節點', 2.6, 0.5, 1.4);
  sayc('只產生有希望的節點', '朝最佳解的方向走');
}]);

// 5:11 化簡成本矩陣 → 下界 25
FRAG.push(['bt-tsp-reduce', '分支界限 TSP：reduced matrix，下界 25', async (tok) => {
  fresh([0, 4.4, 13.5], [-1.2, 3.6, 0]);
  const A = cp(M5);
  let mv = null; const rT = [], cT = [];
  await step(tok);                                   // 5:14 solve it with branch and bound
  sayc('用分支界限解 5 城市的例題');
  await step(tok);                                   // 5:19 just using matrices
  sayc('全部用矩陣來算');
  await step(tok);                                   // 5:28 take the cost matrix, reduce it
  mv = mvAt(A);
  hd('cost adjacency matrix', -4.2, 7.4);
  sayc('第一步：把成本矩陣「化簡」(reduce)');
  await step(tok);                                   // 5:41 minimum of row 1: 10
  mv.row(0, true); rT.push(hot('10', -1.5, 6.0));
  sayc('每列找最小值：第 1 列最小 10');
  await step(tok);                                   // 5:48 rows 2–5: 2, 2, 3, 4
  mv.row(0, false);
  [2, 2, 3, 4].forEach((k, i) => rT.push(hot(String(k), -1.5, 6.0 - (i + 1) * 0.62)));
  sayc('其他列：2、2、3、4');
  await step(tok);                                   // 6:00 subtract the minimum: row 1
  subR(A, 0, 10); mv.set(A); mv.row(0, true);
  sayc('每列都減掉自己的最小值', '第 1 列：20−10、30−10…');
  await step(tok);                                   // 6:24 row 2 − 2
  subR(A, 1, 2); mv.set(A); mv.row(1, true);
  sayc('第 2 列減 2');
  await step(tok);                                   // 6:32 row 3 − 2
  subR(A, 2, 2); mv.set(A); mv.row(2, true);
  sayc('第 3 列減 2');
  await step(tok);                                   // 6:42 likewise rows 4, 5
  subR(A, 3, 3); subR(A, 4, 4); mv.set(A);
  sayc('第 4 列減 3、第 5 列減 4', '每列都有 0 了');
  await step(tok);                                   // 6:48 total row reduction 21
  const tot = hot('列：10+2+2+3+4 = 21', -0.2, 3.2);
  sayc('列化簡總共減了 21');
  await step(tok);                                   // 6:57 reduce columns: minimum of each column
  [1, 0, 3, 0, 0].forEach((k, j) => cT.push(hot(String(k), -6.0 + j * 0.88, 2.7)));
  sayc('再看每一行（column）的最小值', '1、0、3、0、0');
  await step(tok);                                   // 7:19 column 1 − 1
  subC(A, 0, 1); mv.set(A); mv.col(0, true);
  sayc('兩行沒有 0：第 1 行減 1');
  await step(tok);                                   // 7:34 column 3 − 3
  subC(A, 2, 3); mv.set(A); mv.col(2, true);
  sayc('第 3 行減 3');
  await step(tok);                                   // 7:38 1 + 3 + 21 = 25
  mv.set(A);
  txt(tot, '21 + (1 + 3) = 25');
  sayc('總共減掉 21 + 4 = 25', '這就是 reduction 的成本');
  await step(tok);                                   // 7:51 reduced: every row and column has a 0
  note('reduced matrix：每列、每行都至少有一個 0', -3.4, 0.4, 1.6);
  sayc('reduced matrix：每列每行都有 0');
  await step(tok);                                   // 8:09 cost of any tour ≥ 25
  good('任何 tour 的成本 ≥ 25（下界）', -3.4, 0.4, 2.5);
  sayc('減掉的 25 是一定要付的', '所以 tour 至少 25 → lower bound');
  await step(tok);                                   // 8:32 continue with the reduced matrix
  rT.forEach(kill); cT.forEach(kill);
  hd('reduced matrix（root 的矩陣）', 1.6, 6.0);
  sayc('接下來都用這個 reduced matrix');
}]);

// 8:49 第一層：節點 2–5 的 cost
FRAG.push(['bt-tsp-level1', '分支界限 TSP：第一層的 cost（35、53、25、31）', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const T = tspRun(), R0 = T.r.M;
  const mv = mvAt(R0);
  let A = cp(R0);
  const up = tag('upper = ∞', 'ptr alt', 5.6, 0.3, 1.6);
  const fm = tag('', 'say', -3.4, 0.3, 2.0); showL(fm, false);
  const say2 = (t) => { txt(fm, t); showL(fm, true); };
  await step(tok);                                   // 8:56 state space tree: start from vertex 1
  tspNode(T, T.r, false);
  sayc('畫狀態空間樹：從頂點 1 出發');
  await step(tok);                                   // 9:03 can visit 2, 3, 4, 5
  for (const k of T.r.kids) { tspNode(T, k, false); await wt(tok, 200); }
  sayc('可以去 2、3、4、5', '節點 #2–#5');
  await step(tok);                                   // 9:11 find the cost of every vertex
  sayc('每個節點都要算 cost');
  await step(tok);                                   // 9:30 cost of the first = 25
  tspCost(T.r);
  sayc('root 的 cost = 化簡成本 25');
  await step(tok);                                   // 9:40 an upper, initially ∞
  glow(T.r.m, GOLD);
  sayc('另外維護 upper（上界）', '一開始是 ∞，像 0/1 knapsack');
  await step(tok);                                   // 9:59 update upper only at a leaf
  sayc('upper 只在走到葉子時更新', '其他節點只算 cost');
  await step(tok);                                   // 10:35 cost of node 2: from 1 to 2
  glow(T.r.m, null); glow(T.r.kids[0].m, GOLD);
  sayc('算節點 #2：從 1 走到 2');
  await step(tok);                                   // 10:49 first row and second column → ∞
  rowInf(A, 0); colInf(A, 1); mv.set(A); mv.row(0, true); mv.col(1, true);
  sayc('第 1 列、第 2 行全部改成 ∞', '1 不能再出去、2 不能再進來');
  await step(tok);                                   // 11:10 2 → 1 also ∞
  A[1][0] = INF; mv.set(A); mv.hl(1, 0);
  sayc('2 → 1 也設 ∞', '不能直接走回 1');
  await step(tok);                                   // 11:23 is it reduced? yes
  mv.set(A);
  sayc('檢查：每列每行都還有 0 → 不用再化簡');
  await step(tok);                                   // 11:51 cost = c(1,2) + 25 + reduction
  say2('cost = A(1,2) + cost(root) + r');
  sayc('cost = 邊 1→2 + 父節點 cost + 這次化簡量');
  await step(tok);                                   // 12:08 A(1,2) = 10
  mv.set(R0); mv.hl(0, 1);
  say2('cost = 10 + 25 + r');
  sayc('reduced matrix 裡 1→2 = 10');
  await step(tok);                                   // 12:24 10 + 25 + 0 = 35
  say2('cost = 10 + 25 + 0 = 35');
  tspCost(T.r.kids[0]);
  sayc('沒有再化簡：10 + 25 + 0 = 35');
  await step(tok);                                   // 12:41 now 1 → 3
  glow(T.r.kids[0].m, null); glow(T.r.kids[1].m, GOLD);
  A = cp(R0); mv.set(A); showL(fm, false);
  sayc('同樣方法算 #3：1 → 3');
  await step(tok);                                   // 13:01 first row, third column ∞
  rowInf(A, 0); colInf(A, 2); mv.set(A); mv.row(0, true); mv.col(2, true);
  sayc('第 1 列、第 3 行設 ∞');
  await step(tok);                                   // 13:12 3 → 1 ∞
  A[2][0] = INF; mv.set(A); mv.hl(2, 0);
  sayc('3 → 1 設 ∞');
  await step(tok);                                   // 13:34 column 1 has no 0: subtract 11
  subC(A, 0, 11); mv.set(A); mv.col(0, true);
  const r11 = hot('−11', -6.0, 2.7);
  sayc('第 1 行沒有 0，最小 11 → 每格減 11');
  await step(tok);                                   // 14:02 17 + 25 + 11 = 53
  mv.set(A); mv.hl(0, 2, false);
  say2('cost = 17 + 25 + 11 = 53');
  tspCost(T.r.kids[1]);
  sayc('1→3 = 17：17 + 25 + 11 = 53');
  await step(tok);                                   // 14:44 1 → 4, 1 → 5 directly: 25, 31
  kill(r11); glow(T.r.kids[1].m, null);
  tspCost(T.r.kids[2]); tspCost(T.r.kids[3]);
  mv.set(R0); showL(fm, false);
  sayc('1→4、1→5 同理：25、31', '第一層 cost：35、53、25、31');
  void up;
}]);

// 15:15 LC：展開 cost 最小的 #4
FRAG.push(['bt-tsp-level2', '分支界限 TSP：LC 展開 #4（28、50、36）', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const T = tspRun(), n4 = T.n4, M4 = n4.M;
  tspNode(T, T.r); T.r.kids.forEach((k) => tspNode(T, k));
  tag('upper = ∞', 'ptr alt', 5.6, 0.3, 1.6);
  const mv = mvAt(T.r.M);
  let A = null;
  const fm = tag('', 'say', -3.4, 0.3, 2.0); showL(fm, false);
  await step(tok);                                   // 15:18 what next? four nodes
  sayc('下一個展開誰？有 4 個節點可選');
  await step(tok);                                   // 15:32 in order → FIFO
  T.r.kids.forEach((k, i) => tag(String(i + 1), 'idx', k.x + 0.45, k.y - 0.3));
  sayc('照順序 #2、#3、#4、#5 → FIFO B&B');
  await step(tok);                                   // 15:46 the minimum cost: node 4 → LC
  glow(n4.m, GOLD); setCls(n4.ct, 'ptr alt');
  sayc('看 cost：#4 的 25 最小 → 先展開它', '這就是 LC Branch & Bound');
  await step(tok);                                   // 16:10 children of 4: 2, 3, 5 → nodes 6, 7, 8
  for (const k of n4.kids) { tspNode(T, k, false); await wt(tok, 200); }
  sayc('從 4 可以去 2、3、5', '節點 #6、#7、#8');
  await step(tok);                                   // 16:41 their costs: use node 4's matrix
  mv.set(M4); A = cp(M4);
  hd('#4 的矩陣', -4.2, 7.4);
  sayc('算 #6、#7、#8 的 cost', '要用 #4 的矩陣（不是原本的）');
  await step(tok);                                   // 17:17 4 → 2: row 4, column 2 ∞
  rowInf(A, 3); colInf(A, 1); mv.set(A); mv.row(3, true); mv.col(1, true);
  glow(n4.kids[0].m, GOLD);
  sayc('#6 = 4 → 2：第 4 列、第 2 行設 ∞');
  await step(tok);                                   // 17:43 2 → 1 ∞
  A[1][0] = INF; mv.set(A); mv.hl(1, 0);
  sayc('路徑 1→4→2：2 → 1 也設 ∞');
  await step(tok);                                   // 17:58 reduced already
  mv.set(A);
  sayc('檢查：每列每行都有 0（或全 ∞）', '不用再化簡，r = 0');
  await step(tok);                                   // 18:24 3 + 25 + 0 = 28
  txt(fm, 'cost = A(4,2) + cost(#4) + r = 3 + 25 + 0 = 28'); showL(fm, true);
  tspCost(n4.kids[0]);
  sayc('cost = 3 + 25 + 0 = 28', '父節點是 #4，所以加 25');
  await step(tok);                                   // 19:08 nodes 7, 8 directly: 50, 36
  glow(n4.kids[0].m, null);
  tspCost(n4.kids[1]); tspCost(n4.kids[2]);
  showL(fm, false); mv.set(M4);
  sayc('#7（4→3）= 50、#8（4→5）= 36');
}]);

// 19:23 第三層：#6 → #9、#10；#10 → #11
FRAG.push(['bt-tsp-level3', '分支界限 TSP：展開 #6、#10（52、28、28）', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const T = tspRun(), n6 = T.n6, n10 = T.n10, M6 = n6.M;
  [T.r, ...T.r.kids, ...T.n4.kids].forEach((n) => tspNode(T, n));
  tag('upper = ∞', 'ptr alt', 5.6, 0.3, 1.6);
  const mv = mvAt(T.n4.M);
  let A = null;
  const fm = tag('', 'say', -3.4, 0.3, 2.0); showL(fm, false);
  const live = () => [...T.r.kids, ...T.n4.kids];
  await step(tok);                                   // 19:24 which minimum? 35 53 31 28 50 36
  live().filter((n) => n !== T.n4).forEach((n) => glow(n.m, null));
  glow(n6.m, GOLD); setCls(n6.ct, 'ptr alt');
  sayc('活節點：35、53、31、28、50、36', '最小 28 → #6');
  await step(tok);                                   // 19:43 explore 6: path 1→4→2, remaining 3, 5
  [T.r, T.n4, n6].forEach((n) => glow(n.m, GREEN)); glow(n6.m, GOLD);
  sayc('#6 的路徑：1 → 4 → 2', '還剩 3、5 沒去');
  await step(tok);                                   // 19:58 nodes 9 (3) and 10 (5)
  for (const k of n6.kids) { tspNode(T, k, false); await wt(tok, 200); }
  sayc('產生 #9（去 3）、#10（去 5）');
  await step(tok);                                   // 20:13 matrix for 9: copied from node 6
  mv.set(M6); A = cp(M6);
  hd('#6 的矩陣', -4.2, 7.4);
  sayc('算 #9：拿 #6 的矩陣來改');
  await step(tok);                                   // 20:35 2 → 3: row 2, column 3 ∞
  rowInf(A, 1); colInf(A, 2); mv.set(A); mv.row(1, true); mv.col(2, true);
  glow(n6.kids[0].m, GOLD);
  sayc('2 → 3：第 2 列、第 3 行設 ∞');
  await step(tok);                                   // 20:51 3 → 1 ∞
  A[2][0] = INF; mv.set(A); mv.hl(2, 0);
  sayc('3 → 1 也設 ∞');
  await step(tok);                                   // 20:57 a row with 2: subtract
  subR(A, 2, 2); mv.set(A); mv.row(2, true);
  const t2 = hot('−2', -1.5, 6.0 - 2 * 0.62);
  sayc('第 3 列只剩 2 → 減 2');
  await step(tok);                                   // 21:03 a row with 11: subtract
  subR(A, 4, 11); mv.set(A); mv.row(4, true);
  const t11 = hot('−11', -1.5, 6.0 - 4 * 0.62);
  sayc('第 5 列只剩 11 → 減 11', '化簡量 r = 13');
  await step(tok);                                   // 21:11 columns: reduced
  mv.set(A);
  sayc('每行也都有 0 或全 ∞ → 化簡完成');
  await step(tok);                                   // 21:21 11 + 28 + 13 = 52
  txt(fm, 'cost = A(2,3) + cost(#6) + r = 11 + 28 + 13 = 52'); showL(fm, true);
  tspCost(n6.kids[0]); glow(n6.kids[0].m, null);
  sayc('cost(#9) = 11 + 28 + 13 = 52');
  await step(tok);                                   // 21:56 node 10: 28
  kill(t2); kill(t11); showL(fm, false); mv.set(M6);
  tspCost(n10);
  sayc('#10（2 → 5）：0 + 28 + 0 = 28');
  await step(tok);                                   // 22:13 which next? 28 → node 10
  glow(n6.m, GREEN); glow(n10.m, GOLD); setCls(n10.ct, 'ptr alt');
  sayc('活節點 35、53、31、50、36、52、28', '最小 28 → #10');
  await step(tok);                                   // 22:37 from 5 only 3 remains → node 11
  tspNode(T, T.n11, false);
  sayc('路徑 1→4→2→5，只剩 3 → #11');
  await step(tok);                                   // 23:05 row 5, column 3 ∞ → cost 28
  mv.set(n10.M); A = cp(n10.M);
  rowInf(A, 4); colInf(A, 2); A[2][0] = INF; mv.set(A);
  tspCost(T.n11);
  sayc('第 5 列、第 3 行設 ∞ → 全部 ∞', 'cost(#11) = 0 + 28 + 0 = 28');
}]);

// 23:23 走到葉子：upper = 28，其他全部殺掉
FRAG.push(['bt-tsp-answer', '分支界限 TSP：upper = 28，最佳 tour', async (tok) => {
  fresh([0, 4.4, 14], [0.4, 3.6, 0]);
  const T = tspRun();
  T.order.forEach((n) => tspNode(T, n));
  const up = tag('upper = ∞', 'ptr alt', 5.6, 0.3, 1.6);
  const P = PENTA(-3.8, 2.0, 1.9);
  const g = graph(P, [], { size: [0.55, 0.45, 0.55] });
  const tour = [1, 4, 2, 5, 3, 1];
  await step(tok);                                   // 23:23 reached the leaf: 1→4→2→5→3
  [T.r, T.n4, T.n6, T.n10, T.n11].forEach((n) => glow(n.m, GREEN));
  for (let k = 0; k < 4; k++) { rod(V3(...P[tour[k]]), V3(...P[tour[k + 1]]), C.O, 0.07); glow(g.N[tour[k + 1]], GOLD); await wt(tok, 250); }
  sayc('走到葉子了：1 → 4 → 2 → 5 → 3');
  await step(tok);                                   // 23:33 back to vertex 1
  rod(V3(...P[3]), V3(...P[1]), C.O, 0.07);
  sayc('所有頂點都走過，3 → 1 回到起點');
  await step(tok);                                   // 23:43 leaf → update upper to 28
  txt(up, 'upper = 28'); glow(T.n11.m, GOLD);
  sayc('到了葉子才更新 upper：upper = 28');
  await step(tok);                                   // 23:52 nodes with cost > upper are killed
  T.order.filter((n) => n.kids.length === 0 && n !== T.n11).forEach((n) => killT(n));
  sayc('cost 大於 upper 的活節點全部殺掉', '35、53、31、50、36、52 都 > 28');
  await step(tok);                                   // 24:10 which remains? the leaf → answer
  sayc('只剩這片葉子 → 它就是答案');
  await step(tok);                                   // 24:16 cost 28: 1→4→2→5→3
  good('最小 tour 成本 = 28', -3.8, 0.5, 4.2);
  sayc('tour：1→4→2→5→3→1，成本 28', '10 + 6 + 2 + 7 + 3 = 28');
  await step(tok);                                   // 24:29 minimum cost tour
  sayc('這就是最短（成本最小）的 tour');
}]);

// ════════ xFv_Hl4B83A（Abdul Bari 6.1：N Queens） ════════
// a 4 × 4 board on the floor (left) — Q(i) always sits in row i; put(r, c) uses 0-based row / column
function qBoard(x0 = -5.4, z0 = -1.2, S = 1.0) {
  const X = (c) => x0 + c * S, Z = (r) => z0 + r * S;
  const tiles = [];
  for (let r = 0; r < 4; r++) { tiles.push([]); for (let c = 0; c < 4; c++) tiles[r].push(ctx.tile(V3(X(c), 0.04, Z(r)), S * 0.96, S * 0.96, (r + c) % 2 ? '#d9c6a3' : '#efe3cc')); }
  for (let c = 0; c < 4; c++) tag(String(c + 1), 'idx', X(c), 0.1, Z(-0.75));
  const Qm = [], col = [];
  const B = { X, Z, tiles, Qm, col };
  B.paint = (cells, color) => cells.forEach(([r, c]) => tiles[r][c].material.color.set(color));
  B.unpaint = () => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) tiles[r][c].material.color.set((r + c) % 2 ? '#d9c6a3' : '#efe3cc'); };
  B.att = (r, c) => col.map((cc, rr) => [cc, rr]).filter(([cc, rr]) => rr < r && cc !== undefined && cc !== null && (cc === c || Math.abs(cc - c) === r - rr)).map(([, rr]) => rr);
  B.calm = () => Qm.forEach((m) => m && glow(m, null));
  // place Q(r+1) in column c; returns the rows that attack it (shown red)
  B.put = (r, c, drop = 1.5) => {
    B.calm();
    if (Qm[r]) kill(Qm[r]);
    Qm[r] = cube('Q' + (r + 1), C.P, [S * 0.6, S * 0.75, S * 0.6], X(c), S * 0.38, Z(r), drop);
    col[r] = c;
    const a = B.att(r, c);
    if (a.length) { glow(Qm[r], REDEM); a.forEach((rr) => glow(Qm[rr], REDEM)); }
    return a;
  };
  B.take = (r) => { if (Qm[r]) kill(Qm[r]); Qm[r] = null; col[r] = null; };
  B.set = (tuple) => { for (let r = 0; r < 4; r++) { if (r < tuple.length) { if (col[r] !== tuple[r] - 1) B.put(r, tuple[r] - 1, 0); } else B.take(r); } B.calm(); };
  return B;
}
// a node of a hand-written tree: [label, killed?, kids...]
function qTree(spec, parent = null) {
  const [label, flag, ...kids] = spec;
  const n = mkT(label, parent, { flag });
  kids.forEach((k) => qTree(k, n));
  return n;
}

// 0:00 問題：4 × 4 棋盤放 4 個皇后
FRAG.push(['bt-nq-problem', '回溯：N-Queens 問題', async (tok) => {
  fresh([0, 7.5, 9], [-1.5, 0, 0.4]);
  let B = null;
  await step(tok);                                   // 0:00 N-queens problem
  hd('N-Queens Problem', 0.4, 0.3, -3.6);
  sayc('主題：N 皇后問題');
  await step(tok);                                   // 0:09 a 4 × 4 chess board, 16 cells
  B = qBoard(-3.0, -1.4, 1.1);
  sayc('一個 4 × 4 的棋盤，16 格');
  await step(tok);                                   // 0:17 standard 8 × 8, here 4 × 4 and 4 queens
  note('標準棋盤 8 × 8；這裡縮小成 4 × 4', 3.4, 0.4, -2.0);
  for (let i = 0; i < 4; i++) cube('Q' + (i + 1), C.P, [0.6, 0.8, 0.6], 2.4 + i * 0.9, 0.4, 0.4, 2);
  sayc('標準 8 × 8；縮小成 4 × 4、4 個皇后');
  await step(tok);                                   // 0:26 a queen moves along row, column, diagonal
  const q = cube('Q', C.P, [0.66, 0.8, 0.66], B.X(1), 0.42, B.Z(1), 2);
  const hit = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r === 1 || c === 1 || Math.abs(r - 1) === Math.abs(c - 1)) && !(r === 1 && c === 1)) hit.push([r, c]);
  B.paint(hit, '#f1b3a8');
  sayc('皇后可以走：同一列、同一行、斜線', '紅色格子都被它攻擊');
  await step(tok);                                   // 0:36 place all four with no two under attack
  sayc('4 個皇后都放上去', '任兩個都不能互相攻擊');
  await step(tok);                                   // 0:47 attack = same row / column / diagonal
  bad('同列、同行、同斜線 → 互相攻擊', 3.4, 0.4, -1.0);
  sayc('同列、同行或同一條斜線 → 被攻擊');
  await step(tok);                                   // 1:03 possible? yes, more than one solution
  B.unpaint(); kill(q);
  [[0, 1], [1, 3], [2, 0], [3, 2]].forEach(([r, c]) => B.put(r, c));
  good('可以！而且不只一組解', 3.4, 0.4, 0.0);
  sayc('排得出來嗎？可以', '而且解不只一組');
  await step(tok);                                   // 1:15 we want all the solutions → backtracking
  hot('要「所有」解 → Backtracking', 3.4, 0.4, 1.0);
  sayc('要找出所有符合條件的排法', '→ 用回溯');
  await step(tok);                                   // 1:35 optimal → DP; all → backtracking
  note('要最佳解 → DP；要全部解 → 回溯', 3.4, 0.4, 2.0);
  sayc('求最佳解才用 DP', '這裡要全部的解 → 回溯');
}]);

// 1:44 縮小問題：第 i 個皇后放第 i 列
FRAG.push(['bt-nq-reduce', '回溯：N-Queens，第 i 個皇后放第 i 列', async (tok) => {
  fresh([0, 7.5, 9], [-1.5, 0, 0.4]);
  const B = qBoard(-3.0, -1.4, 1.1);
  let arr = null;
  await step(tok);                                   // 1:44 place the four queens on the board
  sayc('怎麼解？把 4 個皇后放上 4 × 4 棋盤');
  await step(tok);                                   // 1:51 how many ways? 16C4
  const cnt = hot('C(16, 4) = 1820 種', 3.4, 0.4, -2.0);
  sayc('16 格挑 4 格：C(16, 4) = 1820 種');
  await step(tok);                                   // 1:59 lots of possibilities
  sayc('可能性太多，問題很大');
  await step(tok);                                   // 2:04 queen i in row i
  B.unpaint();
  for (let r = 0; r < 4; r++) { tag('Q' + (r + 1) + ' →', 'ptr', B.X(-1) - 0.2, 0.1, B.Z(r)); await wt(tok, 150); }
  sayc('縮小：第 1 個皇后放第 1 列、第 2 個放第 2 列…', '同列的問題直接解決');
  await step(tok);                                   // 2:15 only decide the column
  arr = [0, 1, 2, 3].map((i) => cube('', C.K, [0.7, 0.6, 0.7], 2.4 + i * 0.9, 0.3, 0.6, 2));
  [0, 1, 2, 3].forEach((i) => tag('x' + (i + 1), 'idx', 2.4 + i * 0.9, 0.1, 1.3));
  sayc('只要決定每個皇后放第幾「行」', '解 = (x1, x2, x3, x4)');
  await step(tok);                                   // 2:32 avoid two queens in the same column
  txt(cnt, '1820 → 4! = 24');
  sayc('再規定：不放在同一行', 'x1…x4 互不相同');
  await step(tok);                                   // 2:44 rows and columns are taken care of
  good('同列 ✓、同行 ✓：直接避開', 3.4, 0.4, -1.0);
  sayc('同列、同行都已經自動避開');
  await step(tok);                                   // 2:58 still check the diagonal
  bad('同斜線：要另外檢查', 3.4, 0.4, 0.0);
  sayc('剩下要檢查的：是不是在同一條斜線');
  await step(tok);                                   // 3:05 solutions as a state space tree
  sayc('用狀態空間樹把解列出來');
  void arr;
}]);

// 3:20 不檢查攻擊：狀態空間樹（排列樹）
FRAG.push(['bt-nq-tree', '回溯：N-Queens 的排列樹（65 個節點）', async (tok) => {
  fresh([0, 5.0, 13.5], [0, 2.8, 0]);
  const B = qBoard(-6.4, -0.6, 0.9);
  const sub = (a) => [1, 2, 3, 4].filter((c) => !a.includes(c));
  const perm = (pre) => sub(pre).map((c) => [String(c), 0, ...(pre.length < 3 ? perm([...pre, c]) : [])]);
  const root = qTree(['', 0, ['1', 0, ...perm([1])], ['2', 0], ['3', 0], ['4', 0]]);
  layout(root, -1.4, 6.6, 6.8, 1.45);
  for (let d = 1; d <= 4; d++) tag('Q' + d, 'ptr', -2.3, 6.8 - d * 1.45);
  const N1 = root.kids[0];
  const show = (path) => { let n = root; const out = []; for (const c of path) { n = n.kids.find((k) => k.label === String(c)); if (!n.m) nodeAt(n, C.P, [0.42, 0.38, 0.38]); out.push(n); } B.set(path); return n; };
  let cur = null;
  const at = (path) => { if (cur) glow(cur.m, null); cur = show(path); glow(cur.m, GOLD); };
  await step(tok);                                   // 3:20 generate a state space tree: root
  nodeAt(root, C.D);
  sayc('畫狀態空間樹：root');
  await step(tok);                                   // 3:26 queen 1 in column 1
  at([1]);
  sayc('Q1 放第 1 行');
  await step(tok);                                   // 3:33 not checking attacks yet
  note('先不檢查攻擊，只列出所有可能', 2.6, 0.4, 2.2);
  sayc('先不檢查斜線攻擊', '只列出所有可能的排法');
  await step(tok);                                   // 4:00 queen 2 in column 2
  at([1, 2]);
  sayc('Q2 放第 2 行');
  await step(tok);                                   // 4:07 queen 3 in column 3
  at([1, 2, 3]);
  sayc('Q3 放第 3 行');
  await step(tok);                                   // 4:15 queen 4 in column 4: one possibility
  at([1, 2, 3, 4]);
  sayc('Q4 放第 4 行：(1, 2, 3, 4) 一種可能', '雖然互相攻擊，但先列出來');
  await step(tok);                                   // 4:36 move back: Q3 → column 4, Q4 → 3
  at([1, 2, 4]); await wt(tok, 300); at([1, 2, 4, 3]);
  sayc('Q4 沒別的位置 → 退回；Q3 改第 4 行', 'Q4 放第 3 行');
  await step(tok);                                   // 5:05 take out; Q2 → column 3
  at([1, 3]);
  sayc('Q3 也沒位置了 → 退回；Q2 改第 3 行');
  await step(tok);                                   // 5:12 Q3 column 2, Q4 column 4
  at([1, 3, 2]); await wt(tok, 300); at([1, 3, 2, 4]);
  sayc('Q3 第 2 行、Q4 第 4 行');
  await step(tok);                                   // 5:29 Q3 → column 4, Q4 → column 2
  at([1, 3, 4]); await wt(tok, 300); at([1, 3, 4, 2]);
  sayc('退回：Q3 第 4 行、Q4 第 2 行');
  await step(tok);                                   // 5:45 Q2 → column 4
  at([1, 4]);
  sayc('Q2 改第 4 行');
  await step(tok);                                   // 5:52 Q3 2 / Q4 3; then Q3 3 / Q4 2
  at([1, 4, 2]); at([1, 4, 2, 3]); await wt(tok, 400); at([1, 4, 3]); at([1, 4, 3, 2]);
  sayc('(1, 4, 2, 3)、(1, 4, 3, 2)');
  await step(tok);                                   // 6:02 Q2 has no place: Q1 → column 2
  glow(cur.m, null); cur = null;
  for (const k of root.kids.slice(1)) nodeAt(k, C.P, [0.42, 0.38, 0.38]);
  glow(root.kids[1].m, GOLD); B.set([2]);
  sayc('Q2 也沒位置 → 退回；Q1 改第 2 行');
  await step(tok);                                   // 6:09 below this a huge tree too
  root.kids.slice(1).forEach((k) => tag('⋮ 同樣大的子樹', 'idx', k.x, k.y - 0.75));
  sayc('底下又是一棵一樣大的子樹', 'Q1 放第 3、4 行也是');
  const cntT = hot('節點數 = 1', 2.6, 0.4, 3.0);
  await step(tok);                                   // 6:23 count the nodes: root
  glow(root.kids[1].m, null); glow(root.m, GOLD);
  sayc('數一數節點：root 1 個');
  await step(tok);                                   // 6:30 four nodes
  glow(root.m, null); root.kids.forEach((k) => glow(k.m, GOLD));
  txt(cntT, '1 + 4'); sayc('第 1 層：4 個');
  await step(tok);                                   // 6:37 below each: three → 4 × 3
  root.kids.forEach((k) => glow(k.m, null)); N1.kids.forEach((k) => glow(k.m, GOLD));
  txt(cntT, '1 + 4 + 4·3'); sayc('每個底下 3 個：4 × 3');
  await step(tok);                                   // 6:44 below: two → 4 × 3 × 2
  N1.kids.forEach((k) => { glow(k.m, null); k.kids.forEach((g) => glow(g.m, GOLD)); });
  txt(cntT, '1 + 4 + 4·3 + 4·3·2'); sayc('再底下各 2 個：4 × 3 × 2');
  await step(tok);                                   // 6:51 last: one → 4 × 3 × 2 × 1
  N1.kids.forEach((k) => k.kids.forEach((g) => { glow(g.m, null); g.kids.forEach((h) => glow(h.m, GOLD)); }));
  txt(cntT, '1 + 4 + 4·3 + 4·3·2 + 4·3·2·1'); sayc('最後各 1 個：4 × 3 × 2 × 1');
  await step(tok);                                   // 6:59 rows / columns avoided, diagonals allowed
  N1.kids.forEach((k) => k.kids.forEach((g) => g.kids.forEach((h) => glow(h.m, null))));
  sayc('這是「避開同列同行、但允許斜線」的節點數');
  await step(tok);                                   // 7:05 formula
  note('1 + Σ(i=0..3) Π(j=0..i) (4 − j)', 2.6, 0.4, 3.8);
  sayc('公式：1 + Σ Π (4 − j)');
  await step(tok);                                   // 7:36 = 1 + 4 + 12 + 24 + 24 = 65
  txt(cntT, '1 + 4 + 12 + 24 + 24 = 65');
  sayc('1 + 4 + 12 + 24 + 24 = 65 個節點');
  await step(tok);                                   // 7:53 8 × 8 → 8 − j; n queens
  note('n 皇后：1 + Σ(i=0..n−1) Π(j=0..i) (n − j)', 2.6, 0.4, 4.6);
  sayc('8 皇后就把 4 換成 8', 'n 皇后：(n − j)');
  await step(tok);                                   // 8:06 the maximum number of nodes
  sayc('這是「最多」會產生的節點數', '加上 bounding function 後實際少很多');
}]);

// 8:15 加上 bounding function：找到 (2, 4, 1, 3)
FRAG.push(['bt-nq-solve', '回溯：4-Queens 加 bounding function', async (tok) => {
  fresh([0, 5.0, 13.5], [0, 2.8, 0]);
  const B = qBoard(-6.4, -0.6, 0.9);
  const root = qTree(['', 0,
    ['1', 0, ['2', 1], ['3', 0, ['2', 1], ['4', 1]], ['4', 0, ['2', 0, ['3', 1]], ['3', 1]]],
    ['2', 0, ['1', 1], ['3', 1], ['4', 0, ['1', 0, ['3', 2]]]]]);
  layout(root, -1.0, 6.6, 6.8, 1.45);
  for (let d = 1; d <= 4; d++) tag('Q' + d, 'ptr', -2.0, 6.8 - d * 1.45);
  const sols = [];
  let cur = null;
  const find = (path) => { let n = root; for (const c of path) n = n.kids.find((k) => k.label === String(c)); return n; };
  // try the node for this path: draw it, put the queen; flag 1 = attacked, 2 = solution
  const go = (path) => {
    if (cur) glow(cur.m, null);
    const n = find(path); cur = n;
    nodeAt(n, n.flag === 1 ? C.K : C.P, [0.42, 0.38, 0.38]);
    B.set(path.slice(0, -1)); B.put(path.length - 1, path[path.length - 1] - 1, 0);
    glow(n.m, n.flag === 1 ? REDEM : n.flag === 2 ? GREEN : GOLD);
    return n;
  };
  const killIt = () => { if (cur && cur.flag === 1 && !cur.x2) killT(cur); };
  await step(tok);                                   // 8:15 solve the problem with this method
  nodeAt(root, C.D);
  sayc('照同樣方法，但這次加上 bounding function');
  await step(tok);                                   // 8:21 condition: not same row / column / diagonal
  note('bounding function：不同列、不同行、不同斜線', 2.6, 0.4, 2.4);
  sayc('條件：不同列、不同行、不同斜線');
  await step(tok);                                   // 8:33 redraw the tree with the bounding function
  sayc('一邊產生樹，一邊檢查條件');
  await step(tok);                                   // 8:56 Q1 in column 1
  go([1]);
  sayc('Q1 放第 1 行');
  await step(tok);                                   // 9:05 Q2 in column 2 → under attack
  go([1, 2]);
  sayc('Q2 放第 2 行：和 Q1 在同一斜線 → 被攻擊');
  await step(tok);                                   // 9:12 kill this node
  killIt();
  sayc('違反條件 → 殺掉這個節點', '不再往下長');
  await step(tok);                                   // 9:24 Q2 in column 3
  go([1, 3]);
  sayc('Q2 改第 3 行：沒被攻擊 → 繼續');
  await step(tok);                                   // 9:34 Q3 in column 2
  go([1, 3, 2]);
  sayc('Q3 放第 2 行？');
  await step(tok);                                   // 9:47 under attack → bounding function
  killIt();
  sayc('和 Q2 同斜線 → 殺掉');
  await step(tok);                                   // 9:58 Q3 in column 4 → under attack
  go([1, 3, 4]); killIt();
  sayc('Q3 第 4 行：也被 Q2 攻擊 → 殺掉');
  await step(tok);                                   // 10:12 no place for Q3: move Q2 → column 4
  go([1, 4]);
  sayc('Q3 沒位置 → 退回，Q2 改第 4 行');
  await step(tok);                                   // 10:30 Q3 in column 2: possible
  go([1, 4, 2]);
  sayc('Q3 第 2 行：可以');
  await step(tok);                                   // 10:41 Q4: column 3 → attacked → killed
  go([1, 4, 2, 3]); killIt();
  sayc('Q4 只剩第 3 行：被 Q3 斜線攻擊 → 殺掉');
  await step(tok);                                   // 10:56 Q3 → column 3: diagonal → killed
  go([1, 4, 3]); killIt();
  sayc('Q3 改第 3 行：被 Q2 斜線攻擊 → 殺掉');
  await step(tok);                                   // 11:16 Q2 can't move: Q1 → column 2
  go([2]);
  sayc('Q2 也沒位置 → 退回，Q1 改第 2 行');
  await step(tok);                                   // 11:27 Q2 column 1 → diagonal
  go([2, 1]); killIt();
  sayc('Q2 第 1 行：斜線攻擊 → 殺掉');
  await step(tok);                                   // 11:43 Q2 column 3 → diagonal
  go([2, 3]); killIt();
  sayc('Q2 第 3 行：斜線攻擊 → 殺掉');
  await step(tok);                                   // 11:46 Q2 column 4 → possible
  go([2, 4]);
  sayc('Q2 第 4 行：可以');
  await step(tok);                                   // 12:03 Q3 column 1 → ok
  go([2, 4, 1]);
  sayc('Q3 第 1 行：可以');
  await step(tok);                                   // 12:17 Q4 column 3 → solution
  go([2, 4, 1, 3]);
  tag('✓', 'ptr alt', cur.x, cur.y - 0.55);
  sayc('Q4 第 3 行：沒被攻擊 → 找到一組解！');
  await step(tok);                                   // 12:34 solution 2 4 1 3
  sols.push(good('(2, 4, 1, 3)', 2.6, 0.4, 3.2));
  sayc('解：(x1, x2, x3, x4) = (2, 4, 1, 3)');
  await step(tok);                                   // 12:47 continue: more answers
  sayc('繼續回溯，還有別的解嗎？');
  await step(tok);                                   // 12:58 the mirror image: 3 1 4 2
  B.set([3, 1, 4, 2]);
  sols.push(good('(3, 1, 4, 2)', 2.6, 0.4, 4.0));
  sayc('它的鏡像：(3, 1, 4, 2)');
  await step(tok);                                   // 13:19 two solutions
  sayc('4-Queens 只有兩組解', '(2, 4, 1, 3) 和 (3, 1, 4, 2)');
  await step(tok);                                   // 13:31 used bounding function + backtracking
  hot('回溯 + bounding function', 2.6, 0.4, 1.6);
  sayc('先看全部可能，再用 bounding function 剪掉', '這就是用回溯解 N-Queens');
}]);

// ════════ kyLxTdsT8ws（Abdul Bari 6.2：Sum of Subsets） ════════
// w = 5, 10, 12, 13, 15, 18（總和 73），m = 30；節點寫成「目前總和 s, 剩下的總和 r」。
const SSW = [5, 10, 12, 13, 15, 18], SSM = 30;
function ssWeights(x0 = -6.3, y = 0.3, z = 2.2) {
  const X = (k) => x0 + k * 0.78;
  const blk = SSW.map((v, k) => cube(v, C.B, [0.62, 0.5, 0.62], X(k), y, z, 2));
  SSW.forEach((v, k) => tag('w' + (k + 1), 'idx', X(k), y - 0.3, z + 0.55));
  const W = { blk };
  // bits: string of 1 / 0 for the decided weights
  W.pick = (bits) => SSW.forEach((v, k) => {
    const b = bits[k];
    tint(blk[k], b === '1' ? C.G : b === '0' ? C.K : C.B);
    move(blk[k], X(k), y + (b === '1' ? 0.55 : 0), z);
  });
  return W;
}
const ssS = (p) => [...p].reduce((s, b, i) => s + (b === '1' ? SSW[i] : 0), 0);
const ssR = (p) => SSW.slice(p.length).reduce((a, b) => a + b, 0);
// the part of the tree the lecturer draws; flag 1 = killed (s + w > m), 2 = answer, 3 = not generated (s + r < m)
const SS_SPEC = [['', 0], ['1', 0], ['11', 0], ['111', 0], ['1111', 1], ['1110', 0], ['11101', 1], ['11100', 0], ['111001', 1], ['111000', 3],
  ['110', 0], ['1101', 0], ['11011', 1], ['11010', 0], ['110101', 1], ['110100', 3], ['1100', 0], ['11001', 2]];
function ssTree() {
  const N = {};
  for (const [p, flag] of SS_SPEC) {
    N[p] = mkT(ssS(p) + ', ' + ssR(p), p ? N[p.slice(0, -1)] : null, { p, flag });
  }
  layout(N[''], -2.2, 6.6, 7.0, 1.0);
  const T = { N, cur: null };
  T.draw = (p, hl = true) => {
    const n = N[p];
    if (!n.m) {
      nodeAt(n, n.flag === 1 || n.flag === 3 ? C.K : n.flag === 2 ? C.G : C.Y, [1.05, 0.38, 0.38]);
      if (n.parent) tag(p[p.length - 1], 'idx', (n.x + n.parent.x) / 2 - 0.12, (n.y + n.parent.y) / 2);
    }
    if (hl) { if (T.cur && T.cur.m) glow(T.cur.m, null); T.cur = n; glow(n.m, n.flag === 1 || n.flag === 3 ? REDEM : n.flag === 2 ? GREEN : GOLD); }
    return n;
  };
  T.kill = (p) => { const n = N[p]; if (!n.x2) killT(n); };
  return T;
}

// 0:00 問題：子集合總和恰好 = m
FRAG.push(['bt-ss-problem', '回溯：Sum of Subsets 問題', async (tok) => {
  fresh([0, 4.5, 11], [0, 1.4, 0]);
  let W = null, xs = [];
  await step(tok);                                   // 0:00 sum of subsets
  hd('Sum of Subsets', 0, 4.4);
  sayc('主題：Sum of Subsets（子集合加總）', '先講問題，再用回溯解');
  await step(tok);                                   // 0:10 some weights are given, n = 6
  W = ssWeights(-2.0, 0.3, 0);
  sayc('給 n = 6 個重量', '5、10、12、13、15、18');
  await step(tok);                                   // 0:20 subset with sum exactly m = 30
  const goal = hot('m = 30', 3.6, 1.6);
  sayc('挑一個子集合，總和「恰好」= m = 30');
  await step(tok);                                   // 0:29 all of them: much more than 30
  SSW.forEach((v, k) => glow(W.blk[k], GOLD));
  note('全部加起來 = 73，遠大於 30', 0, 2.6);
  sayc('全部加起來是 73，太多了', '要挑其中一部分');
  await step(tok);                                   // 0:40 solution as xi = 0 or 1
  SSW.forEach((v, k) => glow(W.blk[k], null));
  xs = SSW.map((v, k) => tag('x' + (k + 1) + ' = ?', 'ptr', -2.0 + k * 0.78, 1.3, 0));
  sayc('解寫成 (x1, …, x6)', 'xi = 1：要 wi；xi = 0：不要');
  void goal;
}]);

// 0:55 狀態空間樹：每層決定一個重量要不要
FRAG.push(['bt-ss-tree', '回溯：Sum of Subsets 的二元狀態空間樹', async (tok) => {
  fresh([0, 4.4, 14], [0.4, 3.4, 0]);
  const W = ssWeights();
  const root = mkT('', null);
  (function grow(n, d) { if (d === 4) return; for (const b of ['1', '0']) grow(mkT(b, n, { b }), d + 1); })(root, 0);
  layout(root, -2.0, 6.6, 6.8, 1.45);
  const lev = (d) => { const out = []; (function w(n) { if (n.d === d) out.push(n); n.kids.forEach(w); })(root); return out; };
  const drawLev = (d) => lev(d).forEach((n) => nodeAt(n, n.b === '1' ? C.G : C.K, [0.36, 0.34, 0.34]));
  await step(tok);                                   // 0:55 try all possible ways of selection
  SSW.forEach((v, k) => glow(W.blk[k], GOLD));
  sayc('挑重量的方法有很多種', '全部試一遍，找總和剛好 30 的');
  await step(tok);                                   // 1:19 a state space tree
  SSW.forEach((v, k) => glow(W.blk[k], null));
  nodeAt(root, C.D);
  sayc('畫狀態空間樹（先畫一部分）');
  await step(tok);                                   // 1:27 first weight included or not
  drawLev(1); hd('x1', -2.8, 5.35);
  W.pick('1');
  sayc('第 1 層：w1 要（1，左）或不要（0，右）');
  await step(tok);                                   // 1:38 backtracking → DFS: this side first
  glow(root.kids[0].m, GOLD);
  sayc('回溯用 DFS：先往左邊（要 w1）走到底');
  await step(tok);                                   // 1:50 second object included or not
  drawLev(2); hd('x2', -2.8, 3.9);
  W.pick('11');
  sayc('第 2 層：w2 要或不要');
  await step(tok);                                   // 2:07 third weight, fourth weight
  drawLev(3); hd('x3', -2.8, 2.45);
  await wt(tok, 400);
  drawLev(4); hd('x4', -2.8, 1.0);
  W.pick('1111');
  sayc('第 3、4 層：w3、w4…', '每個節點都分成 1 和 0 兩支');
  await step(tok);                                   // 2:18 six weights → 7 levels, height 6
  note('6 個重量 → 7 層（高度 6）', 3.4, 0.3, 1.6);
  sayc('6 個重量 → 連 root 共 7 層', '樹高 = 6');
  await step(tok);                                   // 2:33 paths: 2⁶ = 2ⁿ
  const pth = hot('路徑數 = 2⁶ = 2ⁿ', 3.4, 0.3, 2.5);
  sayc('從 root 到葉子的路徑：2⁶ 條', 'n 個重量 → 2ⁿ 條');
  await step(tok);                                   // 2:46 exponential, time consuming
  txt(pth, '時間 O(2ⁿ)：指數');
  sayc('全部產生要 O(2ⁿ) 時間', '指數時間，很花時間');
  await step(tok);                                   // 3:00 backtracking kills nodes with a bounding function
  killT(lev(4)[0]);
  good('回溯：不符合 bounding function 的節點殺掉', 3.0, 0.3, 3.4);
  sayc('回溯：用 bounding function 殺掉沒希望的節點');
}]);

// 3:15 用 bounding function 解：s + w(k+1) ≤ m、s + r ≥ m
FRAG.push(['bt-ss-bound', '回溯：Sum of Subsets 的兩個 bounding function', async (tok) => {
  fresh([0, 4.4, 14], [0.2, 3.4, 0]);
  const W = ssWeights();
  const T = ssTree();
  for (let d = 1; d <= 6; d++) tag('x' + d, 'ptr', -3.0, 7.0 - d * 1.0);
  const sL = tag('s = 0　r = 73', 'ptr alt', -4.3, 1.5, 2.2);
  const at = (p) => { T.draw(p); W.pick(p); txt(sL, 's = ' + ssS(p) + '　r = ' + ssR(p)); };
  await step(tok);                                   // 3:15 solve with backtracking: first node
  T.draw('');
  sayc('用回溯解，順便定義 bounding function');
  await step(tok);                                   // 3:25 two values: 0 and the total 73
  note('節點 = (目前總和 s, 剩下的總和 r)', 2.4, 7.7, 0);
  sayc('每個節點寫兩個數：s = 0、r = 73', '73 = 全部重量的總和');
  await step(tok);                                   // 3:43 include or not, one by one
  sayc('一個一個決定要不要放進來');
  await step(tok);                                   // 3:55 first weight included: 5, 68
  at('1');
  sayc('w1 = 5 放進來：s = 5、r = 68');
  await step(tok);                                   // 4:20 second: 15, 58
  at('11');
  sayc('w2 = 10：s = 15、r = 58');
  await step(tok);                                   // 4:38 third: 27, 46
  at('111');
  sayc('w3 = 12：s = 27、r = 46');
  await step(tok);                                   // 4:57 fourth: 40 → exceeded
  at('1111');
  sayc('w4 = 13：s = 40 > 30', '超過了！');
  await step(tok);                                   // 5:12 stop here: kill with a bounding function
  T.kill('1111');
  sayc('再往下也不可能剛好 30 → 殺掉');
  await step(tok);                                   // 5:26 condition: s + w(k+1) ≤ m
  const b1 = note('Bound 1：s + w(k+1) ≤ m', -4.4, 0.4, 3.6);
  sayc('Bound 1：目前總和 + 下一個重量 ≤ m', '超過就沒必要繼續');
  await step(tok);                                   // 6:03 without fourth: 27, 33
  at('1110');
  sayc('改成不要 w4：s = 27、r = 33');
  await step(tok);                                   // 6:26 include fifth: 42 → kill
  at('11101'); T.kill('11101');
  sayc('w5 = 15：27 + 15 = 42 > 30 → 殺掉');
  await step(tok);                                   // 6:49 without fifth: 27, 18
  at('11100');
  sayc('不要 w5：s = 27、r = 18');
  await step(tok);                                   // 6:57 not trying further: less work
  void b1;
  sayc('被殺的節點底下都不產生', '這就是 bounding function 省下的工作');
  await step(tok);                                   // 7:16 include sixth: 45 → kill
  at('111001'); T.kill('111001');
  sayc('w6 = 18：27 + 18 = 45 > 30 → 殺掉');
  await step(tok);                                   // 7:32 without sixth: 27 + 0 → meaningless
  at('111000');
  sayc('不要 w6：s = 27、r = 0', '剩下的全加也到不了 30');
  await step(tok);                                   // 7:48 bound 2: s + r ≥ m
  note('Bound 2：s + r ≥ m', -4.4, 0.4, 4.4);
  sayc('Bound 2：目前總和 + 剩下全部 ≥ m', '不夠的話，再怎麼加都湊不到');
  await step(tok);                                   // 8:19 27 + 0 < 30 → don't generate it
  T.kill('111000');
  sayc('27 + 0 < 30 → 這個節點根本不用產生');
}]);

// 8:34 繼續回溯：找到 {5, 10, 15}
FRAG.push(['bt-ss-answer', '回溯：Sum of Subsets 找到 5 + 10 + 15 = 30', async (tok) => {
  fresh([0, 4.4, 14], [0.2, 3.4, 0]);
  const W = ssWeights();
  const T = ssTree();
  for (let d = 1; d <= 6; d++) tag('x' + d, 'ptr', -3.0, 7.0 - d * 1.0);
  note('Bound 1：s + w(k+1) ≤ m', -4.4, 0.4, 3.6); note('Bound 2：s + r ≥ m', -4.4, 0.4, 4.4);
  ['', '1', '11', '111', '1111', '1110', '11101', '11100', '111001', '111000'].forEach((p) => { T.draw(p, false); if (T.N[p].flag & 1 || T.N[p].flag === 3) T.kill(p); });
  const sL = tag('s = 27　r = 0', 'ptr alt', -4.3, 1.5, 2.2);
  const at = (p) => { T.draw(p); W.pick(p); txt(sL, 's = ' + ssS(p) + '　r = ' + ssR(p)); };
  W.pick('111000');
  await step(tok);                                   // 8:34 without 3: 15, 46
  at('110');
  sayc('w4、w5、w6 都試完 → 退回，改成不要 w3', 's = 15、r = 46');
  await step(tok);                                   // 8:50 include fourth: 28, 33
  at('1101');
  sayc('要 w4 = 13：s = 28、r = 33', '還沒超過，繼續');
  await step(tok);                                   // 9:10 include fifth: 43 → kill
  at('11011'); T.kill('11011');
  sayc('w5 = 15：28 + 15 = 43 > 30 → 殺掉');
  await step(tok);                                   // 9:33 without fifth: 28, 18
  at('11010');
  sayc('不要 w5：s = 28、r = 18');
  await step(tok);                                   // 9:40 include sixth: 46 → kill
  at('110101'); T.kill('110101');
  sayc('w6 = 18：28 + 18 = 46 > 30 → 殺掉');
  await step(tok);                                   // 9:50 without sixth: not tried
  at('110100'); T.kill('110100');
  sayc('不要 w6：28 + 0 < 30 → 不產生');
  await step(tok);                                   // 10:00 without 4: 15, 33
  at('1100');
  sayc('退回：不要 w4，s = 15、r = 33');
  await step(tok);                                   // 10:22 fifth included: 30 → the answer
  at('11001');
  tag('✓', 'ptr alt', T.cur.x, T.cur.y - 0.5);
  sayc('要 w5 = 15：15 + 15 = 30', '剛好 30 → 找到答案！');
  await step(tok);                                   // 10:39 one answer; continuing gives more
  sayc('找到一組；繼續做（也包括不要 w1 的右半邊）', '樹會一直長，還會找到更多解');
  await step(tok);                                   // 10:52 x = 1 1 0 0 1 0
  const xv = hot('x = (1, 1, 0, 0, 1, 0)', -4.4, 0.4, 1.0);
  sayc('解：x = (1, 1, 0, 0, 1, 0)', 'w1、w2、w5 要，其他不要');
  await step(tok);                                   // 11:14 5 + 10 + 15 = 30
  sayc('5 + 10 + 15 = 30');
  await step(tok);                                   // 11:18 12 + 18 = 30
  W.pick('001001'); txt(xv, '{12, 18}');
  sayc('還有別的：12 + 18 = 30');
  await step(tok);                                   // 11:24 5 + 12 + 13 = 30
  W.pick('101100'); txt(xv, '{5, 12, 13}');
  sayc('5 + 12 + 13 = 30');
  await step(tok);                                   // 11:39 more than one solution; the point is the bounding function
  W.pick('110010');
  good('三組解：{5,10,15}、{12,18}、{5,12,13}', 1.6, 0.4, 3.4);
  sayc('解不只一組', '重點是 bounding function 怎麼剪');
  await step(tok);                                   // 11:55 recursive, DFS / preorder
  sayc('回溯演算法是遞迴的', '像 DFS、二元樹的 preorder');
}]);

// ════════ dQr4wZCiJJ4（Abdul Bari 6.4：Hamiltonian Cycle） ════════
// 圖的邊由字幕的環路推得：6 頂點圖 1-2-3-4-5-6-1 加 2-6、1-3、2-5；演算法例圖 1-2、1-3、1-5、2-3、2-4、2-5、3-4、4-5。
const ringP = (ids, cx, cz, r, y = 0.3) => { const P = {}; ids.forEach((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ids.length; P[v] = [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]; }); return P; };
const HG6 = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [2, 6], [1, 3], [2, 5]];
const HG5 = [[1, 2], [1, 3], [1, 5], [2, 3], [2, 4], [2, 5], [3, 4], [4, 5]];
const hcAdj = (E, n) => { const A = []; for (let i = 0; i < n; i++) A.push(new Array(n).fill(0)); E.forEach(([a, b]) => { A[a - 1][b - 1] = 1; A[b - 1][a - 1] = 1; }); return A; };
// a graph whose edges can light up along a cycle
function hcGraph(P, E, drop = true) {
  const g = graph(P, E, { drop, size: [0.6, 0.45, 0.6] });
  g.reset = () => { E.forEach(([a, b]) => g.E[ek(a, b)].material.color.set(EDGE)); Object.values(g.N).forEach((m) => glow(m, null)); };
  g.cycle = async (tok, seq, col = C.O, ms = 160) => {
    g.reset();
    for (let i = 0; i + 1 < seq.length; i++) { const e = g.E[ek(seq[i], seq[i + 1])]; if (e) e.material.color.set(col); glow(g.N[seq[i]], GOLD); await wt(tok, ms); }
  };
  return g;
}
const HC_CODE = [
  'Algorithm Hamiltonian(k)',
  '{ repeat {',
  '    NextValue(k);',
  '    if (x[k] = 0) then return;',
  '    if (k = n) then write(x[1:n]);',
  '    else Hamiltonian(k + 1);',
  '  } until (false); }',
  'Algorithm NextValue(k)',
  '{ repeat {',
  '    x[k] := (x[k] + 1) mod (n + 1);',
  '    if (x[k] = 0) then return;',
  '    if (G[x[k-1], x[k]] ≠ 0) then {',
  '      for j := 1 to k-1 do',
  '        if (x[j] = x[k]) then break;',
  '      if (j = k) then',
  '        if (k < n or G[x[n], x[1]] ≠ 0)',
  '          then return;',
  '    }',
  '  } until (false); }',
];

// 0:00 定義：每個頂點恰一次、回到起點
FRAG.push(['bt-hc-def', '回溯：Hamiltonian cycle 是什麼', async (tok) => {
  fresh([0, 7.5, 9], [0, 0, 0.4]);
  const P = ringP([1, 2, 3, 4, 5, 6], -1.6, 0.4, 2.3);
  let g = null;
  await step(tok);                                   // 0:00 hamiltonian cycle
  hd('Hamiltonian Cycle（漢米爾頓迴路）', 0, 0.3, -3.4);
  sayc('主題：Hamiltonian cycle');
  await step(tok);                                   // 0:05 definition, backtracking, algorithm
  sayc('先講定義，再用回溯和演算法來解');
  await step(tok);                                   // 0:18 a graph is given
  g = hcGraph(P, HG6);
  sayc('給一張圖');
  await step(tok);                                   // 0:21 start somewhere, visit all exactly once
  glow(g.N[1], GOLD);
  sayc('從某個起點出發', '每個頂點恰好走過一次');
  await step(tok);                                   // 0:26 return to the start → a cycle
  await g.cycle(tok, [1, 2, 3, 4, 5, 6, 1]);
  sayc('最後回到起點 → 形成一個 cycle');
  await step(tok);                                   // 0:32 is there one? find all of them
  note('有沒有？有的話，全部找出來', 4.0, 0.4, 0);
  sayc('問題：圖裡有沒有 Hamiltonian cycle？', '有好幾個的話，全部都要找出來');
  await step(tok);                                   // 0:47 looks similar to TSP
  sayc('看起來很像 TSP（旅行推銷員）');
  await step(tok);                                   // 0:59 TSP minimises; here all tours
  note('TSP：找成本最小的那一條', 4.0, 0.4, 1.0);
  good('HC：找出所有的 cycle', 4.0, 0.4, 2.0);
  sayc('TSP 是最小化問題', 'HC 要的是「所有」cycle → 回溯');
}]);

// 1:09 幾個事實：連通、NP-hard
FRAG.push(['bt-hc-facts', '回溯：Hamiltonian cycle 的前提', async (tok) => {
  fresh([0, 7.5, 9], [0, 0, 0.4]);
  await step(tok);                                   // 1:11 directed or undirected, must be connected
  const g = hcGraph(ringP([1, 2, 3, 4, 5, 6], -3.0, 0.4, 2.0), HG6);
  note('有向、無向都可以，但必須連通', 2.6, 0.4, -2.4);
  sayc('圖可以有向或無向', '但一定要是連通圖（connected）');
  await step(tok);                                   // 1:19 several pieces → no cycle
  const P2 = { a: [2.0, 0.3, 0.2], b: [3.6, 0.3, 0.2], c: [2.8, 0.3, 1.6], d: [5.4, 0.3, 0.6], e: [6.4, 0.3, 1.8] };
  graph(P2, [['a', 'b'], ['b', 'c'], ['c', 'a'], ['d', 'e']], { drop: true, size: [0.5, 0.4, 0.5] });
  bad('兩塊分開 → 不可能有 cycle', 4.0, 0.4, 3.0);
  sayc('圖分成好幾塊（components）', '就不可能走一圈經過全部頂點');
  await step(tok);                                   // 1:28 NP-hard, exponential time
  hot('NP-hard：指數時間', -3.0, 0.4, -2.4);
  sayc('這是 NP-hard 問題', '目前只有指數時間的解法');
  await step(tok);                                   // 1:36 no easy way
  sayc('沒有快速的方法判斷有沒有 HC', '只好用回溯一個一個試');
  void g;
}]);

// 1:41 手動找 cycle、注意重複
FRAG.push(['bt-hc-manual', '回溯：手動找 Hamiltonian cycle', async (tok) => {
  fresh([0, 7.5, 9], [0, 0, 0.4]);
  const P = ringP([1, 2, 3, 4, 5, 6], -2.2, 0.4, 2.4);
  let g = null; const list = [];
  const add = (t, cls = 'good') => list.push(tag(t, cls, 3.8, 0.4, -2.4 + list.length * 0.9));
  await step(tok);                                   // 1:43 manually; take this graph
  g = hcGraph(P, HG6);
  sayc('手動找找看：拿這張圖');
  await step(tok);                                   // 1:48 1 2 3 4 5 6 1
  await g.cycle(tok, [1, 2, 3, 4, 5, 6, 1]);
  add('1-2-3-4-5-6-1');
  sayc('從 1 出發：1→2→3→4→5→6→1');
  await step(tok);                                   // 1:59 1 2 6 5 4 3 1
  await g.cycle(tok, [1, 2, 6, 5, 4, 3, 1], C.B);
  add('1-2-6-5-4-3-1');
  sayc('另一個：1→2→6→5→4→3→1');
  await step(tok);                                   // 2:18 1 6 2 5 4 3 1
  await g.cycle(tok, [1, 6, 2, 5, 4, 3, 1], C.P);
  add('1-6-2-5-4-3-1');
  sayc('再一個：1→6→2→5→4→3→1');
  await step(tok);                                   // 2:32 more than one; find all
  sayc('cycle 不只一個', '要全部找出來');
  await step(tok);                                   // 2:45 one more: 2 3 4 5 6 1 2?
  await g.cycle(tok, [2, 3, 4, 5, 6, 1, 2], C.G);
  add('2-3-4-5-6-1-2 ?', 'say');
  sayc('2→3→4→5→6→1→2 也是一個？');
  await step(tok);                                   // 3:09 no, wrong
  txt(list[3], '2-3-4-5-6-1-2 ✗'); setCls(list[3], 'bad');
  sayc('不對！');
  await step(tok);                                   // 3:19 only the starting point changed
  glow(g.N[2], GOLD);
  sayc('它和第一個一模一樣', '只是起點從 1 換成 2');
  await step(tok);                                   // 3:38 don't take a duplicate cycle
  note('換起點 ≠ 新的 cycle → 要避免重複', 3.8, 0.4, 2.0);
  sayc('要小心不要把同一個 cycle 算兩次');
}]);

// 3:45 更多例子：articulation point、pendant vertex
FRAG.push(['bt-hc-nocycle', '回溯：articulation point、pendant vertex', async (tok) => {
  fresh([0, 7.5, 9], [0, 0, 0.4]);
  let cur = [];
  const clear = () => { cur.forEach(kill); cur = []; };
  const show = (P, E) => { clear(); const g = graph(P, E, { drop: true, size: [0.55, 0.45, 0.55] }); cur.push(...Object.values(g.N), ...Object.values(g.E)); g.reset = () => { E.forEach(([a, b]) => g.E[ek(a, b)].material.color.set(EDGE)); }; return g; };
  const walk = async (g, seq, col = C.O) => { g.reset(); for (let i = 0; i + 1 < seq.length; i++) { const e = g.E[ek(seq[i], seq[i + 1])]; if (e) e.material.color.set(col); await wt(tok, 160); } };
  const verdict = (t, cls) => { const l = tag(t, cls, 3.6, 0.4, 2.6); cur.push(l); return l; };
  let g = null;
  await step(tok);                                   // 3:45 a few more examples, a few facts
  sayc('再看幾張圖，學幾個重要的事實');
  await step(tok);                                   // 3:54 1-2-3-5-4-1
  const PA = { 1: [-2.6, 0.3, -1.4], 2: [0.6, 0.3, -1.4], 3: [2.0, 0.3, 0.8], 4: [-4.0, 0.3, 0.8], 5: [-1.0, 0.3, 2.4] };
  g = show(PA, [[1, 2], [2, 3], [3, 5], [5, 4], [4, 1], [2, 4], [3, 1]]);
  await walk(g, [1, 2, 3, 5, 4, 1]);
  sayc('1→2→3→5→4→1：一個 cycle');
  await step(tok);                                   // 4:05 1-2-4-5-3-1
  await walk(g, [1, 2, 4, 5, 3, 1], C.B);
  verdict('有好幾個 cycle ✓', 'good');
  sayc('1→2→4→5→3→1：又一個');
  await step(tok);                                   // 4:16 this graph: 4 or 5 left behind
  const PB = { 1: [-4.4, 0.3, -1.2], 2: [-2.2, 0.3, -2.0], 3: [0.2, 0.3, -2.0], 7: [2.0, 0.3, -0.6], 6: [0.4, 0.3, 1.2], 4: [-2.0, 0.3, 0.6], 5: [-2.0, 0.3, 2.4] };
  g = show(PB, [[1, 2], [2, 3], [3, 7], [7, 6], [6, 4], [6, 5], [4, 1], [5, 1]]);
  await walk(g, [1, 2, 3, 7, 6, 4, 1]);
  verdict('4、5 只能走一個 → 沒有 HC ✗', 'bad');
  sayc('1→2→3→7→6，再去 4 就到不了 5', '去 5 就到不了 4 → 沒有 HC');
  await step(tok);                                   // 4:32 this graph: must come back through 3
  const PC = { 1: [-4.4, 0.3, -1.4], 2: [-4.4, 0.3, 1.6], 3: [-2.0, 0.3, 0.1], 4: [0.4, 0.3, -1.4], 5: [2.2, 0.3, 0.1], 6: [0.4, 0.3, 1.6] };
  g = show(PC, [[1, 2], [2, 3], [3, 1], [3, 4], [4, 5], [5, 6], [6, 3]]);
  await walk(g, [1, 2, 3, 4, 5, 6]);
  sayc('1→2→3→4→5→6', '想回 1，一定要再經過 3');
  await step(tok);                                   // 4:48 junction: articulation point
  const ap = cube('', C.R, [0.7, 0.2, 0.7], PC[3][0], 0.75, PC[3][2]); cur.push(ap);
  cur.push(hot('articulation point', PC[3][0], 1.4, PC[3][2]));
  sayc('3 是兩塊的連接點', '叫 articulation point（關節點）');
  await step(tok);                                   // 5:02 → no hamiltonian cycle
  verdict('有 articulation point → 沒有 HC ✗', 'bad');
  sayc('有 articulation point → 不可能有 HC');
  await step(tok);                                   // 5:05 1-2-4, then 5: pendant vertex
  const PD = { 1: [-3.6, 0.3, -1.4], 2: [-0.8, 0.3, -1.4], 3: [-3.6, 0.3, 1.6], 4: [-0.8, 0.3, 1.6], 5: [1.8, 0.3, 2.2] };
  g = show(PD, [[1, 2], [2, 4], [4, 3], [3, 1], [4, 5]]);
  await walk(g, [1, 2, 4, 5]);
  cur.push(hot('pendant vertex', PD[5][0], 1.0, PD[5][2]));
  sayc('1→2→4→5，5 只有一條邊', '進去就出不來 → pendant vertex（懸掛點）');
  await step(tok);                                   // 5:21 two facts
  verdict('有 pendant vertex → 沒有 HC ✗', 'bad');
  sayc('兩個事實：有 articulation point 或', 'pendant vertex 的圖 → 沒有 HC');
}]);

// 5:39 演算法與例圖
FRAG.push(['bt-hc-algo', '回溯：Hamiltonian cycle 演算法與鄰接矩陣', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const P = ringP([1, 2, 3, 4, 5], -4.4, 2.4, 1.6);
  let cd = null, xs = [];
  await step(tok);                                   // 5:39 an algorithm and an example graph
  sayc('看演算法怎麼用回溯解');
  await step(tok);                                   // 5:51 a graph and its adjacency matrix
  hcGraph(P, HG5);
  matrixView(hcAdj(HG5, 5), -5.6, 6.6, 0.62, 0.48);
  sayc('一張圖和它的 adjacency matrix', 'G[i, j] = 1 表示 i、j 有邊');
  await step(tok);                                   // 6:00 two functions
  cd = code(HC_CODE, 3.0, 7.2, 0.37);
  sayc('演算法有兩個函式');
  await step(tok);                                   // 6:07 Hamiltonian backtracks, NextValue gets the next vertex
  cd.hl(0);
  sayc('Hamiltonian(k)：做回溯', 'NextValue(k)：找下一個可以放的頂點');
  await step(tok);                                   // 6:29 uses this adjacency matrix
  cd.hl(11);
  sayc('判斷有沒有邊：查 adjacency matrix G');
  await step(tok);                                   // 6:34 uses array x; all filled → cycle found
  xs = [1, 2, 3, 4, 5].map((k) => bx('', C.K, -5.8 + (k - 1) * 0.75, 3.6, 0, 0.6, 2, 0.5, 0.5));
  [1, 2, 3, 4, 5].forEach((k) => tag('x' + k, 'idx', -5.8 + (k - 1) * 0.75, 3.05, 0.3));
  cd.hl(4);
  sayc('陣列 x[1..n] 存 cycle 的頂點順序', '全部填滿 → 找到一個 cycle，印出來');
  await step(tok);                                   // 6:43 initially all zero
  xs.forEach((m) => relabel(m, 0));
  cd.hl(-1);
  sayc('一開始 x 全部是 0');
}]);

// 演算法追蹤：x 陣列、圖、只畫合法節點的狀態空間樹
function hcTrace() {
  const P = ringP([1, 2, 3, 4, 5], -4.4, 2.6, 1.5);
  const g = hcGraph(P, HG5, false);
  const A = hcAdj(HG5, 5);
  const X = (k) => -5.9 + (k - 1) * 0.78;
  const xs = [1, 2, 3, 4, 5].map((k) => bx(0, C.K, X(k), 6.2, 0, 0.62, 0, 0.5, 0.5));
  [1, 2, 3, 4, 5].forEach((k) => tag('x' + k, 'idx', X(k), 5.65, 0.3));
  const root = qTree(['1', 0, ['2', 0, ['3', 0, ['4', 0, ['5', 2]]], ['4', 0, ['3', 0], ['5', 0]], ['5', 0, ['4', 0, ['3', 2]]]]]);
  layout(root, 0.4, 6.4, 6.9, 1.45);
  for (let d = 0; d < 5; d++) tag('x' + (d + 1), 'ptr', -0.6, 6.9 - d * 1.45);
  const x = [1, 0, 0, 0, 0];
  const T = { g, A, xs, x, root };
  const find = (path) => { let n = root; for (const v of path.slice(1)) n = n.kids.find((k) => k.label === String(v)); return n; };
  T.path = () => x.filter((v) => v);
  T.showX = () => xs.forEach((m, i) => { relabel(m, x[i]); tint(m, x[i] ? C.B : C.K); glow(m, null); });
  T.light = () => { g.reset(); const p = T.path(); for (let i = 0; i + 1 < p.length; i++) { const e = g.E[ek(p[i], p[i + 1])]; if (e) e.material.color.set(C.O); } p.forEach((v) => glow(g.N[v], GOLD)); };
  // try value v at position k: ok → keep it (node drawn); not ok → red cell
  T.tryV = (k, v, ok) => {
    x[k - 1] = v; T.showX();
    tint(xs[k - 1], v === 0 ? C.K : ok ? C.G : C.R);
    if (ok && v) { const n = find(x.slice(0, k)); if (!n.m) nodeAt(n, n.flag === 2 ? C.G : C.B, [0.46, 0.4, 0.4]); T.light(); }
  };
  T.back = (k) => { x[k - 1] = 0; T.showX(); T.light(); };
  T.edge = (a, b) => A[a - 1][b - 1] === 1;
  T.node = find;
  T.hideTree = () => { (function w(n) { if (n.m) { kill(n.m); n.m = null; } if (n.e) { kill(n.e); n.e = null; } n.kids.forEach(w); })(root); };
  T.draw = (path) => { for (let i = 1; i <= path.length; i++) { const n = find(path.slice(0, i)); if (!n.m) nodeAt(n, n.flag === 2 ? C.G : n === root ? C.D : C.B, [0.46, 0.4, 0.4]); } };
  return T;
}

// 6:50 追蹤到第一個答案 1 2 3 4 5
FRAG.push(['bt-hc-trace1', '回溯：HC 追蹤，第一個 cycle 1-2-3-4-5', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const T = hcTrace();
  const bf = [];
  await step(tok);                                   // 6:50 explain through the state space tree (DFS)
  sayc('用狀態空間樹看演算法怎麼跑', '回溯 = DFS');
  await step(tok);                                   // 7:02 fix the starting vertex: 1
  T.draw([1]); T.showX(); glow(T.xs[0], GOLD); T.light();
  sayc('避免重複的 cycle：起點固定 x1 = 1');
  await step(tok);                                   // 7:23 second position: 3, 2 or 5
  note('1 的鄰居：2、3、5', -4.4, 0.4, 4.6);
  sayc('第二個位置：可以去 2、3 或 5');
  await step(tok);                                   // 7:39 try 1: already there
  T.tryV(2, 1, false);
  sayc('x2 先試 1：已經用過 → 不行');
  await step(tok);                                   // 7:53 try 2: new, edge 1-2 → valid
  T.tryV(2, 2, true);
  sayc('x2 試 2：沒用過，1–2 有邊 → 可以');
  await step(tok);                                   // 8:08 next position: 1, 2 used; 3 with edge 2-3
  T.tryV(3, 3, true);
  sayc('x3：1、2 用過；試 3，2–3 有邊 → 可以');
  await step(tok);                                   // 8:46 next position: 1, 2 invalid…
  T.tryV(4, 1, false);
  sayc('x4：1、2、3 都用過 → 不行');
  await step(tok);                                   // 8:59 the bounding function kills these nodes
  bf.push(bad('不合法的節點被 bounding function 殺掉（不畫出來）', 3.4, 0.4, 2.6));
  sayc('這些不合法的值，就是被 bounding function 殺掉的節點');
  await step(tok);                                   // 9:12 4: edge 3-4 → include
  T.tryV(4, 4, true);
  sayc('x4 = 4：3–4 有邊 → 可以');
  await step(tok);                                   // 9:25 x5: 5 with edge 4-5
  T.tryV(5, 5, true);
  sayc('x5：1–4 都用過；5，4–5 有邊 → 可以');
  await step(tok);                                   // 9:41 last position: edge 5 → 1? yes → cycle
  T.g.E[ek(5, 1)].material.color.set(C.G);
  sayc('最後一格：還要檢查 5 → 1 有邊', '有 → 找到 cycle！');
  await step(tok);                                   // 9:58 first answer printed
  T.xs.forEach((m) => glow(m, GREEN));
  good('答案 1：1 2 3 4 5 (1)', 3.4, 0.4, 3.4);
  sayc('第一個答案：1→2→3→4→5→1');
  let cd = null;
  await step(tok);                                   // 10:08 x[k] = (x[k] + 1) mod (n + 1)
  T.hideTree(); cd = code(HC_CODE.slice(7), 3.2, 7.0, 0.4);
  cd.hl(2);
  sayc('程式：x[k] = (x[k] + 1) mod (n + 1)', '取下一個值；變回 0 就代表試完了');
  await step(tok);                                   // 10:21 an edge? not a duplicate?
  cd.hl(4);
  sayc('檢查和前一個頂點有沒有邊', '再用 for 迴圈檢查有沒有重複');
  await step(tok);                                   // 10:42 last position: edge back to 1
  cd.hl(8);
  sayc('如果是最後一格：還要有邊回到 x1');
  await step(tok);                                   // 11:10 bounding function ① no duplicate
  const b = note('① 不能重複', -1.2, 0.4, 3.6);
  sayc('bounding function 檢查三件事', '① 不能重複');
  await step(tok);                                   // 11:17 ② edge from the previous vertex
  txt(b, '① 不能重複　② 和前一個有邊');
  sayc('② 和前一個頂點之間要有邊');
  await step(tok);                                   // 11:24 ③ last vertex: edge to the first
  txt(b, '① 不重複　② 和前一個有邊　③ 最後一個要連回起點');
  sayc('③ 如果是最後一個，要有邊回到第一個');
}]);

// 11:39 繼續回溯：第二個答案 1 2 5 4 3
FRAG.push(['bt-hc-trace2', '回溯：HC 繼續回溯，第二個 cycle 1-2-5-4-3', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const T = hcTrace();
  [1, 2, 3, 4, 5].forEach((v, i) => { T.x[i] = v; }); T.draw([1, 2, 3, 4, 5]); T.showX(); T.light();
  good('答案 1：1 2 3 4 5', 3.4, 0.4, 3.4);
  await step(tok);                                   // 11:39 x5 next value → 0: go back
  T.tryV(5, 0, false);
  sayc('x5 再取下一個值 → 0', '0 = 試完了 → 退回上一格');
  await step(tok);                                   // 11:49 x4: instead of 4 → 5, not a duplicate
  T.tryV(4, 5, false); tint(T.xs[3], C.Y);
  sayc('x4 改試 5：沒重複');
  await step(tok);                                   // 12:08 3 → 5: no edge
  tint(T.xs[3], C.R);
  sayc('但 3–5 沒有邊 → 不行');
  await step(tok);                                   // 12:14 next after 5 is 0 (mod)
  T.back(4);
  note('mod (n+1)：…4, 5, 0, 1, 2…', -1.4, 0.4, 3.6);
  sayc('5 的下一個值是 0', 'mod 讓值繞回 0 → 退回');
  await step(tok);                                   // 12:35 back to x3: instead of 3 → 4, edge 2-4
  T.tryV(3, 4, true);
  sayc('退回 x3：改試 4，2–4 有邊 → 可以');
  await step(tok);                                   // 12:57 x4: 3, edge 4-3
  T.tryV(4, 3, true);
  sayc('x4：1、2 用過；3，4–3 有邊 → 可以');
  await step(tok);                                   // 13:07 x5: only 5, edge 3-5? no → 0
  T.tryV(5, 5, false);
  sayc('x5 = 5：3–5 沒有邊 → 不行，變 0');
  await step(tok);                                   // 13:28 back: x4 = 5 valid (4-5)
  T.back(5); T.tryV(4, 5, true);
  sayc('退回 x4 改 5：4–5 有邊 → 可以');
  await step(tok);                                   // 13:42 x5: 3, edge 5-3? no → 0
  T.tryV(5, 3, false);
  sayc('x5 = 3：5–3 沒有邊；其他都用過 → 0');
  await step(tok);                                   // 13:55 back: x3 after 4 is 5 (edge 2-5)
  T.back(5); T.back(4); T.tryV(3, 5, true);
  sayc('一路退回 x3，改試 5：2–5 有邊');
  await step(tok);                                   // 14:05 x4: 3 no edge; 4 → yes
  T.tryV(4, 4, true);
  sayc('x4：3（5–3 沒邊）不行；4，5–4 有邊 → 可以');
  await step(tok);                                   // 14:14 x5: 3, edge 4-3, and 3-1 → answer
  T.tryV(5, 3, true); T.g.E[ek(3, 1)].material.color.set(C.G);
  sayc('x5 = 3：4–3 有邊，3–1 也有邊', '→ 第二個 cycle！');
  await step(tok);                                   // 14:27 1 2 5 4 3 1: two answers
  T.xs.forEach((m) => glow(m, GREEN));
  good('答案 2：1 2 5 4 3 (1)', 3.4, 0.4, 4.2);
  sayc('1→2→5→4→3→1', '目前找到兩個答案');
  await step(tok);                                   // 14:43 continue → all cycles
  sayc('繼續做下去，就能找出所有的 Hamiltonian cycle');
}]);

// 14:52 演算法逐行
FRAG.push(['bt-hc-code', '回溯：Hamiltonian / NextValue 逐行說明', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const cd = code(HC_CODE, 2.6, 7.2, 0.37);
  const X = (k) => -5.6 + (k - 1) * 0.78;
  const xs = [1, 2, 3, 4, 5].map((k) => bx(k === 1 ? 1 : 0, k === 1 ? C.B : C.K, X(k), 4.6, 0, 0.62, 0, 0.5, 0.5));
  [1, 2, 3, 4, 5].forEach((k) => tag('x' + k, 'idx', X(k), 4.05, 0.3));
  const chk = note('', -4.0, 0.4, 2.6); showL(chk, false);
  const show = (t) => { txt(chk, t); showL(chk, true); };
  await step(tok);                                   // 14:52 explain the algorithm
  cd.hl(0);
  sayc('現在逐行看演算法');
  await step(tok);                                   // 14:59 x1 = 1 fixed; from the second place
  glow(xs[0], GOLD);
  sayc('x1 固定是 1', '從第二格開始試');
  await step(tok);                                   // 15:04 NextValue finds the next value
  cd.hl(2); glow(xs[0], null); glow(xs[1], GOLD);
  sayc('呼叫 NextValue(k) 找下一個可以放的值');
  await step(tok);                                   // 15:09 condition: not already existing
  cd.hl(13);
  show('① 不能和 x[1..k−1] 重複');
  sayc('條件 ①：不能已經出現過');
  await step(tok);                                   // 15:22 an edge to the previous one
  cd.hl(11);
  show('② G[x[k−1], x[k]] ≠ 0：和前一個有邊');
  sayc('條件 ②：和前一個頂點要有邊', '查鄰接矩陣不是 0');
  await step(tok);                                   // 15:37 this for loop checks duplicates
  cd.hl(12);
  show('for 迴圈：逐一比對有沒有重複');
  sayc('這個 for 迴圈就是在檢查重複');
  await step(tok);                                   // 15:42 last place: edge to vertex 1
  cd.hl(15);
  show('③ k = n 時：G[x[n], x[1]] ≠ 0');
  sayc('條件 ③：最後一格要有邊回到 x1');
  await step(tok);                                   // 15:54 three things checked
  show('① 不重複　② 和前一個有邊　③ 最後要連回起點');
  sayc('三個條件都滿足才 return 這個值');
  await step(tok);                                   // 15:56 tries all values 0, 1, …, 5
  cd.hl(9);
  for (const v of [1, 2, 3, 4, 5, 0]) { relabel(xs[1], v); await wt(tok, 200); }
  sayc('每一格都會試 0、1、2、…、5', 'mod (n+1) 讓它回到 0');
  await step(tok);                                   // 16:09 recursively → like DFS
  sayc('每一格都這樣試，而且是遞迴的', '所以走法像 DFS');
  await step(tok);                                   // 16:19 Hamiltonian: get the next value; 0 → return
  cd.hl(3);
  sayc('Hamiltonian：拿到下一個值', '是 0 就 return（回溯）');
  await step(tok);                                   // 16:23 last place → print, go back
  cd.hl(4);
  sayc('如果是最後一格 → 印出答案', '不再往下，回去試別的');
  await step(tok);                                   // 16:33 otherwise call Hamiltonian(k + 1)
  cd.hl(5);
  sayc('不是最後一格 → 遞迴呼叫 Hamiltonian(k + 1)');
}]);

// 17:27 時間複雜度：(n − 1)! ≈ O(nⁿ)
FRAG.push(['bt-hc-time', '回溯：Hamiltonian cycle 的時間 (n−1)!', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.6, 0]);
  const X = (k) => -3.2 + (k - 1) * 1.2;
  const xs = [1, 2, 3, 4, 5].map((k) => bx(k === 1 ? 1 : '?', k === 1 ? C.B : C.K, X(k), 4.6, 0, 1.0, 0, 0.7, 0.7));
  const perms = []; (function p(a, rest) { if (!rest.length) { perms.push(a); return; } rest.forEach((v, i) => p([...a, v], rest.filter((_, j) => j !== i))); })([], [2, 3, 4, 5]);
  await step(tok);                                   // 17:27 the tree can become very big
  sayc('追蹤樹在考試不太實用', '因為樹可能變得非常大');
  await step(tok);                                   // 17:32 more vertices → taller, more nodes
  sayc('頂點越多，樹越高、節點越多');
  await step(tok);                                   // 17:44 five places, first one fixed
  glow(xs[0], GOLD);
  sayc('5 個位置，第一個固定是 1');
  await step(tok);                                   // 17:52 the other four: 2345, 2354, …
  for (let i = 0; i < 6; i++) { perms[i].forEach((v, k) => relabel(xs[k + 1], v)); tag(perms[i].join(''), 'idx', -3.4 + (i % 6) * 1.35, 3.4, 0); await wt(tok, 220); }
  sayc('其餘 4 個位置試所有排列', '2345、2354、2435…');
  await step(tok);                                   // 18:02 4! possibilities
  hot('4! = 24 種', 0, 2.6);
  sayc('一共 4! = 24 種');
  await step(tok);                                   // 18:12 n vertices → (n − 1)!
  note('n 個頂點：(n − 1)!', 0, 1.8, 0);
  sayc('n 個頂點的圖：(n − 1)! 種');
  await step(tok);                                   // 18:20 roughly n! = O(nⁿ)
  note('(n − 1)! ≈ n! = O(nⁿ)', 0, 1.0, 0);
  sayc('大約 n!，而 n! = O(nⁿ)', '時間複雜度 O(nⁿ)：指數級');
}]);

// ════════ M7Fl_z7_J2k（Abdul Bari 7.1：Job Sequencing with Deadlines, B&B） ════════
// 4 個 job（penalty, deadline, time）= (5,1,1)、(10,3,2)、(6,2,1)、(3,1,1)：最佳 {J2, J3}，penalty 8。
const JS = [{ p: 5, d: 1, t: 1 }, { p: 10, d: 3, t: 2 }, { p: 6, d: 2, t: 1 }, { p: 3, d: 1, t: 1 }];
function jsTable(x0 = -6.4, y0 = 6.9, dx = 0.85, dy = 0.5) {
  const rows = [['Job', 'J1', 'J2', 'J3', 'J4'], ['penalty', 5, 10, 6, 3], ['deadline', 1, 3, 2, 1], ['time', 1, 2, 1, 1]];
  const cells = rows.map((r, i) => r.map((v, j) => tag(String(v), j === 0 || i === 0 ? 'ptr' : 'idx', x0 + (j ? 0.6 + j * dx : 0), y0 - i * dy)));
  return { cells, col: (j, cls) => cells.forEach((r) => setCls(r[j], cls || 'idx')) };
}
// the tree the lecturer draws (node numbers 1–10; 'X' = infeasible children found at the end)
function jsTree() {
  const root = qTree(['', 0,
    ['J1', 0, ['J2', 0, ['J3', 4], ['J4', 4]], ['J3', 1], ['J4', 1]],
    ['J2', 0, ['J3', 0, ['J4', 4]], ['J4', 1]],
    ['J3', 1], ['J4', 1]]);
  layout(root, -0.6, 6.6, 6.6, 1.7);
  const n = (...p) => { let x = root; for (const i of p) x = x.kids[i]; return x; };
  const N = { 1: root, 2: n(0), 3: n(1), 4: n(2), 5: n(3), 6: n(0, 0), 7: n(0, 1), 8: n(0, 2), 9: n(1, 0), 10: n(1, 1) };
  const T = { root, N, n };
  T.draw = (k, c, u) => {
    const x = N[k]; if (!x.m) { nodeAt(x, x === root ? C.D : JC[+x.label.slice(1)], [0.5, 0.42, 0.42]); tag(String(k), 'idx', x.x - 0.45, x.y + 0.32); }
    if (c !== undefined) x.ct = tag('c=' + c + (u !== undefined ? ' u=' + fmtI(u) : ''), 'ptr', x.x, x.y - 0.58);
    return x;
  };
  T.setU = (k, c, u) => { txt(N[k].ct, 'c=' + c + ' u=' + fmtI(u)); };
  T.kill = (k) => { if (!N[k].x2) killT(N[k]); };
  T.hl = (k) => { Object.values(N).forEach((x) => x.m && !x.x2 && glow(x.m, null)); if (k) glow(N[k].m, GOLD); };
  return T;
}

// 0:00 問題：profit → penalty，最小化
FRAG.push(['bt-js-problem', '分支界限：Job sequencing，profit 改成 penalty', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  let tb = null;
  await step(tok);                                   // 0:00 job sequencing with deadlines, B&B
  hd('Job Sequencing with Deadlines', 0, 6.4);
  sayc('主題：Job sequencing with deadlines', '用 Branch and Bound 解');
  await step(tok);                                   // 0:05 also greedy, DP
  note('也可以用 greedy、DP 解', 0, 5.6);
  sayc('它也能用 greedy、DP 解', '這裡學 B&B 的解法');
  await step(tok);                                   // 0:14 B&B: minimisation only
  bad('B&B 只能解最小化', -3.4, 4.6);
  sayc('提醒：Branch and Bound 只解最小化問題');
  await step(tok);                                   // 0:23 job sequencing is maximisation (profit)
  const pr = good('原題：profit 越大越好（最大化）', 2.6, 4.6);
  sayc('但 job sequencing 原本是最大化 profit');
  await step(tok);                                   // 0:33 converted: penalty instead of profit
  txt(pr, 'profit → penalty（沒做就要付的罰金）');
  sayc('轉換：profit 改叫 penalty', '沒做的 job 要付罰金');
  await step(tok);                                   // 0:45 finish within deadlines, minimise penalty
  tb = jsTable(-3.6, 3.2, 1.2, 0.6);
  [1, 2, 3, 4].forEach((j) => setCls(tb.cells[1][j], 'ptr alt'));
  sayc('挑 job、在期限內做完', '讓 penalty 總和最小');
  await step(tok);                                   // 0:53 minimal penalty = maximal profit
  sayc('penalty 最小 ⇔ profit 最大', '只是換個名字');
  await step(tok);                                   // 1:04 deadline of each job
  [1, 2, 3, 4].forEach((j) => { setCls(tb.cells[1][j], 'idx'); setCls(tb.cells[2][j], 'ptr alt'); });
  sayc('每個 job 有 deadline（期限）');
  await step(tok);                                   // 1:08 time taken by each job: varies
  [1, 2, 3, 4].forEach((j) => { setCls(tb.cells[2][j], 'idx'); setCls(tb.cells[3][j], 'ptr alt'); });
  sayc('還有每個 job 需要的時間', '不一定是 1，J2 要 2 單位');
}]);

// 1:18 每個節點兩個值：cost、upper bound
FRAG.push(['bt-js-bounds', '分支界限：Job sequencing 的 cost 與 upper bound', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  jsTable(-3.6, 6.4, 1.2, 0.6);
  const ex = [];
  await step(tok);                                   // 1:18 solve by generating a state space tree
  sayc('用 B&B：產生狀態空間樹');
  await step(tok);                                   // 1:25 two values per node: cost, upper bound
  const nd = bx('節點', C.B, 0, 2.4, 0, 1.4, 2, 0.6, 0.8);
  ex.push(hd('cost  c', -2.0, 2.4), hd('upper bound  u', 2.4, 2.4));
  sayc('每個節點算兩個值', 'cost 和 upper bound');
  await step(tok);                                   // 1:37 u = penalties of all jobs not included
  ex.push(note('u = 所有「沒選進來」的 job 的 penalty 總和', 0, 1.4));
  sayc('upper bound：沒放進解的 job，penalty 全部加起來', '最多就付這麼多');
  await step(tok);                                   // 1:49 cost = penalties up to the job considered
  ex.push(note('c = 到目前這個 job 為止，跳過的 penalty 總和', 0, 0.7));
  sayc('cost：到目前考慮的 job 為止', '已經確定跳過的 penalty 加總');
  await step(tok);                                   // 1:58 S = jobs in the solution: u = Σ(i ∉ S) p_i
  ex.push(hot('u = Σ(i ∉ S) pᵢ', -2.6, 0.0, 1.0));
  sayc('S = 選進解的 job 集合', 'u = Σ(不在 S 的 pᵢ)');
  await step(tok);                                   // 2:10 cost = Σ(i ∉ S, i ≤ k) p_i
  ex.push(hot('c = Σ(i ∉ S, i ≤ k) pᵢ', 2.4, 0.0, 1.0));
  sayc('c = Σ(不在 S、而且 i ≤ k 的 pᵢ)', 'k = 目前考慮到的 job');
  void nd;
}]);

// 2:33 第一層：c、u、upper
FRAG.push(['bt-js-level1', '分支界限：Job sequencing 第一層（upper 19 → 14）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  jsTable();
  const T = jsTree();
  const up = hot('upper = ∞', -4.4, 3.4);
  await step(tok);                                   // 2:33 first node: cost 0, u ∞
  T.draw(1, 0, INF); T.hl(1);
  sayc('第一個節點：c = 0、u = ∞');
  await step(tok);                                   // 2:41 maintain upper = ∞
  glow(T.N[1].m, null);
  sayc('另外維護 upper（目前最好的上界）', '一開始 ∞');
  await step(tok);                                   // 2:49 first job included
  T.draw(2); T.hl(2);
  sayc('考慮 J1：把 J1 放進解（節點 2）');
  await step(tok);                                   // 3:04 cost: skipping nothing → 0
  T.draw(2, 0);
  sayc('到 J1 為止沒有跳過任何 job → c = 0');
  await step(tok);                                   // 3:10 u = 10 + 6 + 3 = 19
  T.setU(2, 0, 19);
  sayc('沒選的 J2、J3、J4：u = 10 + 6 + 3 = 19');
  await step(tok);                                   // 3:19 upper updated to 19
  txt(up, 'upper = 19');
  sayc('19 < ∞ → upper 更新成 19');
  await step(tok);                                   // 3:32 J2 node: J1 skipped → cost 5
  T.draw(3, 5); T.hl(3);
  sayc('節點 3：選 J2，J1 被跳過 → c = 5');
  await step(tok);                                   // 3:50 u = 5 + 6 + 3 = 14 → upper 14
  T.setU(3, 5, 14); txt(up, 'upper = 14');
  sayc('u = 5 + 6 + 3 = 14 → upper 更新成 14');
  await step(tok);                                   // 4:11 J3: cost = 5 + 10 = 15
  T.draw(4, 15); T.hl(4);
  sayc('節點 4：只選 J3，跳過 J1、J2 → c = 15');
  await step(tok);                                   // 4:32 one more thing: compare cost with upper
  note('c > upper → 殺掉', -4.4, 2.6);
  sayc('還要做一件事：比較 c 和 upper', 'c 超過 upper 就殺掉');
  await step(tok);                                   // 4:50 15 > 14 → kill
  T.kill(4);
  sayc('15 > 14：再怎麼做都比 14 差 → 殺掉');
  await step(tok);                                   // 5:04 node 5: J4 only, 5 + 10 + 6 = 21 → kill
  T.draw(5, 21); T.kill(5);
  sayc('節點 5：只選 J4 → c = 21 > 14 → 殺掉');
  await step(tok);                                   // 5:24 no need for u; two live nodes
  T.hl(0); glow(T.N[2].m, GOLD); glow(T.N[3].m, GOLD);
  sayc('被殺的節點不用算 u', '剩兩個活節點：2、3');
}]);

// 5:29 第二層：upper 9 → 8
FRAG.push(['bt-js-level2', '分支界限：Job sequencing 第二層（upper 9 → 8）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  jsTable();
  const T = jsTree();
  T.draw(1, 0, INF); T.draw(2, 0, 19); T.draw(3, 5, 14); T.draw(4, 15); T.kill(4); T.draw(5, 21); T.kill(5);
  const up = hot('upper = 14', -4.4, 3.4);
  await step(tok);                                   // 5:29 expand node 2: J2, J3, J4
  T.hl(2);
  for (const k of [6, 7, 8]) { T.draw(k); await wt(tok, 200); }
  sayc('展開節點 2：再選 J2、J3 或 J4', '節點 6、7、8');
  await step(tok);                                   // 5:44 node 6: J1, J2 → cost 0
  T.draw(6, 0); T.hl(6);
  sayc('節點 6 = {J1, J2}：沒跳過 → c = 0');
  await step(tok);                                   // 5:58 u = 9 → upper 9
  T.setU(6, 0, 9); txt(up, 'upper = 9');
  sayc('沒選 J3、J4：u = 6 + 3 = 9 → upper = 9');
  await step(tok);                                   // 6:13 node 7: J1, J3; skip J2 → 10 > 9
  T.draw(7, 10); T.kill(7);
  sayc('節點 7 = {J1, J3}：跳過 J2 → c = 10 > 9 → 殺');
  await step(tok);                                   // 6:29 node 8: J1, J4 → 16 → kill
  T.draw(8, 16); T.kill(8);
  sayc('節點 8 = {J1, J4}：跳過 J2、J3 → c = 16 → 殺');
  await step(tok);                                   // 6:45 which next? node 3
  T.hl(3);
  sayc('下一個展開節點 3（J2）');
  await step(tok);                                   // 6:54 J3, J4
  for (const k of [9, 10]) { T.draw(k); await wt(tok, 200); }
  sayc('節點 3 的孩子：J3、J4');
  await step(tok);                                   // 7:01 {J2, J3}: skip J1 → 5
  T.draw(9, 5); T.hl(9);
  sayc('節點 9 = {J2, J3}：跳過 J1 → c = 5 < 9');
  await step(tok);                                   // 7:19 u = 5 + 3 = 8 → upper 8
  T.setU(9, 5, 8); txt(up, 'upper = 8');
  sayc('沒選 J1、J4：u = 5 + 3 = 8 → upper = 8');
  await step(tok);                                   // 7:36 {J2, J4}: 5 + 6 = 11 > 8 → kill
  T.draw(10, 11); T.kill(10);
  sayc('節點 10 = {J2, J4}：c = 5 + 6 = 11 > 8 → 殺');
  await step(tok);                                   // 7:54 next to explore… lengthy
  T.hl(6);
  sayc('接著展開還活著的節點', '手算很冗長，老師挑重點');
}]);

// 8:06 可行性：時間夠不夠
FRAG.push(['bt-js-feasible', '分支界限：Job sequencing 可行性與答案 {J2, J3}', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  jsTable();
  const T = jsTree();
  [[1, 0, INF], [2, 0, 19], [3, 5, 14], [4, 15], [5, 21], [6, 0, 9], [7, 10], [8, 16], [9, 5, 8], [10, 11]].forEach(([k, c, u]) => T.draw(k, c, u));
  [4, 5, 7, 8, 10].forEach((k) => T.kill(k));
  hot('upper = 8', -4.4, 3.4);
  // a time line 0..3 on the floor in front
  const tx = (h) => -6.0 + h * 1.3;
  for (let h = 0; h <= 3; h++) tag(String(h), 'idx', tx(h), 0.1, 2.9);
  rod(V3(tx(0), 0.05, 2.5), V3(tx(3), 0.05, 2.5), C.D, 0.03);
  const blocks = [];
  const put = (j, h0) => { const b = bx('J' + (j + 1), JC[j + 1], tx(h0) + JS[j].t * 0.65, 0.3, 2.0, JS[j].t * 1.25, 1.5, 0.5, 0.7); blocks.push(b); return b; };
  const clearB = () => { blocks.forEach(kill); blocks.length = 0; };
  await step(tok);                                   // 8:06 one more thing: feasibility
  T.hl(6);
  sayc('還有一件事剛才沒做：檢查「做得完嗎」');
  await step(tok);                                   // 8:17 J1, J2, J3 together? deadlines 1, 3, 2
  T.hl(6); glow(T.N[2].m, GOLD);
  sayc('J1、J2、J3 都做得到嗎？', 'deadline 分別是 1、3、2');
  await step(tok);                                   // 8:43 processing times 1 + 2 + 1
  sayc('需要的時間：1 + 2 + 1 = 4', '最晚的 deadline 只有 3');
  await step(tok);                                   // 8:49 J1 then J2 → 3 hours used
  put(0, 0); await wt(tok, 300); put(1, 1);
  sayc('J1 做第 1 小時，J2 要 2 小時 → 用到第 3 小時', 'J3 的 deadline 2 已經過了');
  await step(tok);                                   // 9:10 J3 can't be done: don't generate
  const x3 = T.n(0, 0, 0); nodeAt(x3, C.K, [0.5, 0.42, 0.42]); killT(x3);
  sayc('J3 做不完 → 這個節點不用產生', '是「時間」不夠，不只看 deadline');
  await step(tok);                                   // 9:25 fourth job: same case
  const x4 = T.n(0, 0, 1); nodeAt(x4, C.K, [0.5, 0.42, 0.42]); killT(x4);
  sayc('J4 也一樣：沒有時間了');
  await step(tok);                                   // 9:33 last live node: expand J4
  clearB(); T.hl(9);
  sayc('最後一個活節點：9 = {J2, J3}', '試著再加 J4');
  await step(tok);                                   // 9:46 J2 + J3 fill 3 hours; J4 no time
  put(2, 0); await wt(tok, 250); put(1, 1);
  const x5 = T.n(1, 0, 0); nodeAt(x5, C.K, [0.5, 0.42, 0.42]); killT(x5);
  sayc('J3 先做（期限 2）、J2 接著（期限 3）', '3 小時用完，J4 沒時間 → 不可行');
  await step(tok);                                   // 10:04 the whole tree is finished
  sayc('整棵樹都處理完了');
  await step(tok);                                   // 10:10 minimum: node with cost 5, penalty 8
  T.hl(9); glow(T.N[9].m, GREEN);
  sayc('最好的節點：c = 5、u = 8', '最小 penalty = 8');
  await step(tok);                                   // 10:21 jobs J2 and J3
  good('答案：做 J2、J3', 2.8, 0.4, 2.4);
  sayc('做 J2 和 J3');
  await step(tok);                                   // 10:37 save 10 + 6; pay 5 + 3 = 8
  note('省下 10 + 6 = 16；付 J1、J4：5 + 3 = 8', 2.8, 0.4, 3.2);
  sayc('沒做的 J1、J4 要付 5 + 3 = 8', '這就是最小 penalty');
}]);

// ════════ yV1d-b_NeK8（Abdul Bari 7.2：0/1 Knapsack using LC Branch and Bound） ════════
// p = 10, 10, 12, 18；w = 2, 4, 6, 9；m = 15。cost 用分數、upper 不用分數，都取負號；答案 (1, 1, 0, 1)，profit 38。
const KP = [10, 10, 12, 18], KW = [2, 4, 6, 9], KM = 15;
const KC = [C.B, C.P, C.PK, C.O];
function kpTable(x0 = -6.4, y0 = 6.9, dx = 0.85, dy = 0.5) {
  const rows = [['', 1, 2, 3, 4], ['profit', ...KP], ['weight', ...KW]];
  return rows.map((r, i) => r.map((v, j) => tag(String(v), j === 0 || i === 0 ? 'ptr' : 'idx', x0 + (j ? 0.6 + j * dx : 0), y0 - i * dy)));
}
// a bag of capacity 15 drawn as a bar; fill([[obj, kg], …]) — kg < weight means a fraction
function kpBag(x0 = -6.4, y = 0.35, z = 2.6, u = 0.27) {
  ctx.tile(V3(x0 + KM * u / 2, 0.03, z), KM * u + 0.1, 0.9, '#e9dcc4');
  tag('背包容量 m = 15', 'idx', x0 + KM * u / 2, 0.1, z + 0.8);
  let parts = [];
  const B = {};
  B.fill = (list) => {
    parts.forEach(kill); parts = [];
    let at = 0;
    for (const [i, kg] of list) {
      const frac = kg < KW[i];
      const m = cube(frac ? kg + '/' + KW[i] : '' + (i + 1), KC[i], [kg * u - 0.04, 0.5, 0.7], x0 + (at + kg / 2) * u, y, z);
      if (frac) { m.material.transparent = true; m.material.opacity = 0.45; }
      parts.push(m); at += kg;
    }
  };
  B.clear = () => { parts.forEach(kill); parts = []; };
  return B;
}
// the LC tree of the video: 1 root; 2/3 = x1 1/0; 4/5 = x2 1/0 under 2; 6/7 = x3 1/0 under 4; 8 = x4 1 under 6; 9/10 = x4 1/0 under 7
function kpTree() {
  const root = qTree(['', 0, ['1', 0, ['1', 0, ['1', 0, ['1', 4]], ['0', 0, ['1', 2], ['0', 1]]], ['0', 1]], ['0', 1]]);
  layout(root, -0.4, 6.6, 6.8, 1.45);
  const n = (...p) => { let x = root; for (const i of p) x = x.kids[i]; return x; };
  const N = { 1: root, 2: n(0), 3: n(1), 4: n(0, 0), 5: n(0, 1), 6: n(0, 0, 0), 7: n(0, 0, 1), 8: n(0, 0, 0, 0), 9: n(0, 0, 1, 0), 10: n(0, 0, 1, 1) };
  for (let d = 1; d <= 4; d++) tag('x' + d, 'ptr', -1.3, 6.8 - d * 1.45);
  const T = { N };
  T.draw = (k, c, u) => {
    const x = N[k];
    if (!x.m) { nodeAt(x, x === root ? C.D : x.label === '1' ? C.G : C.K, [0.5, 0.42, 0.42]); tag(String(k), 'idx', x.x - 0.45, x.y + 0.32); }
    if (c !== undefined) { if (x.ct) kill(x.ct); x.ct = tag('c=' + c + (u !== undefined ? ' u=' + u : ''), 'ptr', x.x, x.y - 0.58); }
    return x;
  };
  T.kill = (k) => { if (!N[k].x2) killT(N[k]); };
  T.hl = (...ks) => { Object.values(N).forEach((x) => x.m && glow(x.m, null)); ks.forEach((k) => glow(N[k].m, GOLD)); };
  return T;
}

// 0:00 問題：0/1 knapsack，最大化 → 取負號
FRAG.push(['bt-kp-problem', '分支界限：0/1 Knapsack 問題', async (tok) => {
  fresh([0, 4.4, 12.5], [-1.5, 2.6, 0]);
  let B = null;
  await step(tok);                                   // 0:00 0/1 knapsack: profits, weights, capacity 15
  kpTable(-5.4, 5.6, 1.1, 0.6);
  B = kpBag(-5.4, 0.35, 1.6, 0.36);
  sayc('0/1 Knapsack：4 個物品，各有 profit 和 weight', '背包容量 m = 15');
  await step(tok);                                   // 0:12 total weight ≤ capacity 15
  B.fill([[0, 2], [1, 4], [2, 6]]);
  sayc('放進背包的總重 ≤ 15');
  await step(tok);                                   // 0:23 take the complete object or not at all
  B.fill([[0, 2], [1, 4], [2, 6], [3, 3]]);
  bad('不能只拿一部分：9 kg 的不能拆成 3 kg', 0.6, 0.4, 3.0);
  sayc('0/1：整個拿或整個不拿', '不能只拿一部分');
  await step(tok);                                   // 0:38 maximise the total profit
  B.fill([[0, 2], [1, 4], [2, 6]]);
  sayc('目標：總 profit 最大 → 最大化問題');
  await step(tok);                                   // 0:44 greedy, DP, backtracking too
  note('也能用 greedy、DP、回溯解', 1.8, 0.4, -1.4);
  sayc('它也能用 greedy、DP、回溯解');
  await step(tok);                                   // 0:50 B&B only minimisation
  bad('B&B 只解最小化', 1.8, 0.4, -0.6);
  sayc('但 B&B 只能解最小化');
  await step(tok);                                   // 0:58 make profits negative
  good('profit 取負號 → 最小化', 1.8, 0.4, 0.2);
  sayc('把 profit 變成負的', '最大化 → 最小化');
  await step(tok);                                   // 1:13 convert the result back
  sayc('解完再把答案的正負號換回來');
}]);

// 1:17 LC B&B：cost（含分數）與 upper（不含分數）
FRAG.push(['bt-kp-bounds', '分支界限：0/1 Knapsack 的 cost 與 upper', async (tok) => {
  fresh([0, 4.4, 12.5], [-1.0, 2.6, 0]);
  kpTable(-5.4, 6.0, 1.1, 0.6);
  const B = kpBag(-5.4, 0.35, 1.6, 0.36);
  const fx = [];
  await step(tok);                                   // 1:17 generate a state space tree
  sayc('產生狀態空間樹來解');
  await step(tok);                                   // 1:22 LC: explore the node with minimum cost
  hd('LC Branch & Bound：每次展開 cost 最小的', 2.4, 6.4);
  sayc('用 LC Branch & Bound', '每次展開 cost 最小的節點');
  await step(tok);                                   // 1:32 each node: upper bound and cost
  sayc('每個節點算兩個值：upper bound 和 cost');
  await step(tok);                                   // 1:39 Σ profits with Σ weights ≤ m
  fx.push(note('u = −Σ pᵢxᵢ（Σ wᵢxᵢ ≤ m，不含分數）', 2.4, 5.5));
  B.fill([[0, 2], [1, 4], [2, 6]]);
  sayc('依序放物品，總重 ≤ m，profit 加總');
  await step(tok);                                   // 1:48 cost: the same thing
  fx.push(note('c = 同樣加總，但最後一個可以放「分數」', 2.4, 4.7));
  sayc('cost 也是同樣的加總');
  await step(tok);                                   // 1:52 upper without fraction, cost with fraction
  B.fill([[0, 2], [1, 4], [2, 6], [3, 3]]);
  sayc('差別：upper 不含分數', 'cost 含分數（裝滿到 15）');
  await step(tok);                                   // 1:58 fractions only for computing
  note('分數只是用來估計，答案裡不會出現', 2.4, 3.9);
  sayc('題目不准拆，分數只用來計算界限');
  await step(tok);                                   // 2:14 subset or included / not included?
  B.clear();
  sayc('解要寫成哪一種？');
  await step(tok);                                   // 2:28 subset {1, 3} …
  const v = hd('{1, 3}：variable size', 2.4, 2.6);
  sayc('子集合 {1, 3}', 'variable size');
  await step(tok);                                   // 2:35 … or 1 0 1 0
  const f = hd('(1, 0, 1, 0)：fixed size', 2.4, 1.8);
  sayc('或 (1, 0, 1, 0)', 'fixed size');
  await step(tok);                                   // 2:51 go with the fixed size (0 / 1)
  setCls(f, 'ptr alt'); setCls(v, 'idx');
  sayc('用 fixed size（0 / 1）', '每層決定一個物品放（1）或不放（0）');
}]);

// 3:02 root 與第一層
FRAG.push(['bt-kp-root', '分支界限：0/1 Knapsack root（c = −38, u = −32）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  kpTable();
  const B = kpBag();
  const T = kpTree();
  const up = hot('upper = ∞', -4.4, 4.6);
  const fm = tag('', 'say', -4.2, 1.5, 2.6); showL(fm, false);
  const show = (t) => { txt(fm, t); showL(fm, true); };
  await step(tok);                                   // 3:02 upper = ∞
  sayc('先設 upper = ∞');
  await step(tok);                                   // 3:08 first node: cost and upper bound
  T.draw(1); T.hl(1);
  sayc('第一個節點：算 cost 和 upper bound');
  await step(tok);                                   // 3:14 objects 1, 2, 3 → 12 kg
  B.fill([[0, 2], [1, 4], [2, 6]]);
  show('2 + 4 + 6 = 12 kg；10 + 10 + 12 = 32');
  sayc('放物品 1、2、3：重 12 kg');
  await step(tok);                                   // 3:28 the fourth exceeds the capacity
  sayc('再放物品 4（9 kg）就超過 15');
  await step(tok);                                   // 3:37 15 − 12 = 3 more kg: 18/9 × 3 = 6
  B.fill([[0, 2], [1, 4], [2, 6], [3, 3]]);
  show('剩 3 kg：18/9 × 3 = 6 → 32 + 6 = 38');
  sayc('還剩 3 kg：放物品 4 的 3/9', 'profit 18 × 3/9 = 6');
  await step(tok);                                   // 3:50 cost = −38 (negative)
  T.draw(1, -38);
  sayc('cost = −(32 + 6) = −38', '取負號：最大化變最小化');
  await step(tok);                                   // 4:09 upper bound: same without fraction
  B.fill([[0, 2], [1, 4], [2, 6]]);
  sayc('upper bound：一樣算，但不放分數');
  await step(tok);                                   // 4:17 −32 → upper = −32
  T.draw(1, -38, -32); txt(up, 'upper = −32');
  sayc('u = −32 < ∞ → upper 更新成 −32');
  await step(tok);                                   // 4:37 include the first object
  T.draw(2, -38, -32); T.hl(2);
  sayc('節點 2：x1 = 1（放物品 1）', 'cost、u 都不變：−38、−32');
  await step(tok);                                   // 4:52 first object not included
  T.draw(3); T.hl(3);
  B.fill([[1, 4], [2, 6]]);
  show('不放 1：10 + 12 = 22，用掉 10 kg');
  sayc('節點 3：x1 = 0（不放物品 1）');
  await step(tok);                                   // 5:14 5 kg left: 18/9 × 5 = 10 → −32
  B.fill([[1, 4], [2, 6], [3, 5]]);
  show('剩 5 kg：18/9 × 5 = 10 → 22 + 10 = 32');
  T.draw(3, -32);
  sayc('剩 5 kg：放物品 4 的 5/9 → +10', 'cost = −32');
  await step(tok);                                   // 5:30 is cost > upper? equal → keep
  sayc('檢查：cost > upper 就殺掉', '−32 不大於 −32 → 留著');
  await step(tok);                                   // 5:43 upper bound −22: not smaller
  B.fill([[1, 4], [2, 6]]);
  T.draw(3, -32, -22);
  sayc('u = −22，沒有比 −32 小 → upper 不變');
}]);

// 5:53 LC 展開：upper → −38，殺掉其他
FRAG.push(['bt-kp-expand', '分支界限：0/1 Knapsack LC 展開（upper = −38）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  kpTable();
  const B = kpBag();
  const T = kpTree();
  T.draw(1, -38, -32); T.draw(2, -38, -32); T.draw(3, -32, -22);
  const up = hot('upper = −32', -4.4, 4.6);
  await step(tok);                                   // 5:53 explore the least cost: −38
  T.hl(2);
  sayc('LC：cost 最小的是節點 2（−38）');
  await step(tok);                                   // 6:07 second object included: same
  T.draw(4, -38, -32); T.hl(4);
  B.fill([[0, 2], [1, 4], [2, 6], [3, 3]]);
  sayc('節點 4：x2 = 1', 'cost、u 不變');
  await step(tok);                                   // 6:16 second object not included
  T.draw(5); T.hl(5);
  B.fill([[0, 2], [2, 6]]);
  sayc('節點 5：x2 = 0（不放物品 2）');
  await step(tok);                                   // 6:29 10 + 12, 7 kg left: 18/9 × 7 = 14 → −36
  B.fill([[0, 2], [2, 6], [3, 7]]);
  T.draw(5, -36);
  sayc('10 + 12 = 22，剩 7 kg：+14', 'cost = −36');
  await step(tok);                                   // 6:51 u = −22, not killed
  B.fill([[0, 2], [2, 6]]);
  T.draw(5, -36, -22);
  sayc('u = −22；−36 不大於 upper → 留著');
  await step(tok);                                   // 7:07 next: −38, −36, −32 → node 4
  T.hl(4);
  sayc('活節點 cost：−38、−36、−32', 'LC 選 −38（節點 4）');
  await step(tok);                                   // 7:14 FIFO would pick the other: more work
  sayc('如果用 FIFO 會選別的節點', '要產生更多節點；LC 比較快');
  await step(tok);                                   // 7:27 third object included: same
  T.draw(6, -38, -32); T.hl(6);
  B.fill([[0, 2], [1, 4], [2, 6], [3, 3]]);
  sayc('節點 6：x3 = 1，cost、u 不變');
  await step(tok);                                   // 7:41 third object not included
  T.draw(7); T.hl(7);
  B.fill([[0, 2], [1, 4]]);
  sayc('節點 7：x3 = 0（不放物品 3）');
  await step(tok);                                   // 8:01 6 kg + 9 kg = 15 exactly
  B.fill([[0, 2], [1, 4], [3, 9]]);
  sayc('放 1、2 共 6 kg，物品 4 的 9 kg 整個放得下', '剛好 15 kg');
  await step(tok);                                   // 8:14 cost = u = −38 (no fraction)
  T.draw(7, -38, -38);
  sayc('10 + 10 + 18 = 38', '沒有分數 → c = u = −38');
  await step(tok);                                   // 8:28 a smaller upper → −38
  txt(up, 'upper = −38');
  sayc('u = −38 比 −32 小 → upper 更新成 −38');
  await step(tok);                                   // 8:40 look at the other live nodes
  T.hl(3, 5, 6);
  sayc('看看其他活節點的 cost');
  await step(tok);                                   // 8:47 −32 > −38 → kill
  T.kill(3);
  sayc('節點 3：−32 > −38 → 殺掉');
  await step(tok);                                   // 8:54 −36 > −38 → kill
  T.kill(5);
  sayc('節點 5：−36 > −38 → 殺掉', '再展開也只是浪費時間');
}]);

// 9:04 最後兩個節點，得到答案
FRAG.push(['bt-kp-answer', '分支界限：0/1 Knapsack 答案 (1, 1, 0, 1)', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  kpTable();
  const B = kpBag();
  const T = kpTree();
  [[1, -38, -32], [2, -38, -32], [3, -32, -22], [4, -38, -32], [5, -36, -22], [6, -38, -32], [7, -38, -38]].forEach(([k, c, u]) => T.draw(k, c, u));
  T.kill(3); T.kill(5);
  hot('upper = −38', -4.4, 4.6);
  await step(tok);                                   // 9:04 both nodes: check node 6
  T.hl(6);
  B.fill([[0, 2], [1, 4], [2, 6]]);
  sayc('剩兩個活節點；先看節點 6', '物品 1、2、3 都放了');
  await step(tok);                                   // 9:10 the fourth: 12 + 9 = 21 → infeasible
  T.draw(8); T.kill(8);
  sayc('再放物品 4：12 + 9 = 21 > 15', '不可行');
  await step(tok);                                   // 9:24 expand node 7: fourth included
  T.draw(9, -38, -38); T.hl(9);
  B.fill([[0, 2], [1, 4], [3, 9]]);
  sayc('展開節點 7：x4 = 1', 'c = u = −38');
  await step(tok);                                   // 9:38 fourth not included
  T.draw(10); T.hl(10);
  B.fill([[0, 2], [1, 4]]);
  sayc('x4 = 0：只剩物品 1、2');
  await step(tok);                                   // 9:53 10 + 10 = 20 → −20 > −38 → kill
  T.draw(10, -20); T.kill(10);
  sayc('cost = −20 > −38 → 殺掉');
  await step(tok);                                   // 10:03 almost all killed; the last one is the answer
  T.hl(9); glow(T.N[9].m, GREEN);
  B.fill([[0, 2], [1, 4], [3, 9]]);
  sayc('幾乎全被殺掉', '剩下的節點 9 就是答案');
  await step(tok);                                   // 10:13 1 1 0 1
  good('x = (1, 1, 0, 1)', -4.4, 0.4, 3.6);
  sayc('x = (1, 1, 0, 1)', '放 1、2、4，不放 3');
  await step(tok);                                   // 10:26 profit 10 + 10 + 0 + 18 = 38
  note('profit = 10 + 10 + 18 = 38（最大）', -1.6, 0.4, 3.6);
  sayc('profit = 10 + 10 + 0 + 18 = 38', '最大 profit（把 −38 換回正號）');
  await step(tok);                                   // 10:35 weight 2 + 4 + 0 + 9 = 15
  note('weight = 2 + 4 + 9 = 15', -1.6, 0.4, 4.4);
  sayc('重量 2 + 4 + 0 + 9 = 15', '剛好裝滿');
}]);

// ════════ xyqIXdUXeU0（Approximation Algorithms 1：Vertex Cover） ════════
// 例圖 7 個頂點、10 條邊（由字幕推得）：最小 vertex cover 大小 4（{1,4,5,6}、{1,3,5,7}、{2,4,5,6}）；
// 演算法挑 (1,2)、(5,7)、(3,6) → C = {1,2,5,7,3,6}，|C| = 6 ≤ 2·4。
const VC7 = { 1: [-3.2, 0.3, -1.8], 2: [0.0, 0.3, -2.2], 3: [-4.4, 0.3, 2.6], 4: [-3.0, 0.3, 0.7], 5: [-0.5, 0.3, 0.0], 6: [-1.7, 0.3, 3.0], 7: [0.7, 0.3, 1.8] };
const VC7E = [[1, 2], [1, 5], [1, 4], [3, 4], [4, 7], [4, 5], [5, 7], [6, 7], [2, 5], [3, 6]];
function vcWorld(drop = true) {
  const g = graph(VC7, VC7E, { drop, size: [0.6, 0.45, 0.6] });
  const W = { g };
  W.reset = () => { VC7E.forEach(([a, b]) => { const e = g.E[ek(a, b)]; e.visible = true; e.material.color.set(EDGE); }); for (const v in VC7) { tint(g.N[v], C.K); glow(g.N[v], null); } };
  W.pick = (vs) => vs.forEach((v) => tint(g.N[v], C.R));
  // colour the edges covered by these vertices green
  W.cover = (vs) => VC7E.forEach(([a, b]) => { if (vs.includes(a) || vs.includes(b)) g.E[ek(a, b)].material.color.set(C.G); });
  W.missing = (vs) => VC7E.filter(([a, b]) => !vs.includes(a) && !vs.includes(b));
  W.showMissing = (vs) => W.missing(vs).forEach(([a, b]) => g.E[ek(a, b)].material.color.set(C.R));
  W.edge = (a, b, col) => g.E[ek(a, b)].material.color.set(col);
  W.hide = (a, b) => { g.E[ek(a, b)].visible = false; };
  return W;
}
const VC_ALGO = ['APPROX-VERTEX-COVER(G)', 'C = ∅', "E' = G.E", "while E' ≠ ∅", "   pick any edge (u, v) ∈ E'", '   C = C ∪ {u, v}', "   remove from E' every edge", '      incident on u or v', 'return C'];

// 0:00 本片大綱
FRAG.push(['bt-ap-intro', '近似演算法：本片大綱', async (tok) => {
  fresh([0, 4.5, 12], [0, 2.2, 0]);
  const items = [];
  const it = (t, i) => { items.push(bx(t, [C.B, C.P, C.O, C.G][i], -3.3 + i * 2.2, 1.0, 0, 2.0, 2, 0.6, 0.8)); };
  await step(tok);                                   // 0:00 approximation algorithms
  hd('Approximation Algorithms（近似演算法）', 0, 4.6);
  sayc('主題：近似演算法');
  await step(tok);                                   // 0:05 vertex cover problem
  note('例題：vertex cover problem', 0, 3.8);
  sayc('會用一個例題：vertex cover');
  await step(tok);                                   // 0:15 outline: optimization problems
  it('最佳化問題', 0);
  sayc('大綱 ①：什麼是最佳化問題、怎麼處理');
  await step(tok);                                   // 0:22 role of approximation algorithms
  it('近似演算法', 1);
  sayc('② 近似演算法扮演的角色');
  await step(tok);                                   // 0:27 solve vertex cover
  it('Vertex cover', 2);
  sayc('③ 用近似演算法解 vertex cover');
  await step(tok);                                   // 0:33 proof of the performance guarantee
  it('效能保證證明', 3);
  sayc('④ 證明它的 performance guarantee');
}]);

// 0:40 最佳化問題與 NP-hard
FRAG.push(['bt-ap-opt', '近似演算法：最佳化問題與 NP-hard', async (tok) => {
  fresh([0, 4.5, 12], [0, 2.2, 0]);
  const sols = [];
  await step(tok);                                   // 0:40 used for optimization problems
  hd('Optimization problem（最佳化問題）', 0, 4.8);
  sayc('近似演算法用來解最佳化問題');
  await step(tok);                                   // 0:49 the best of all feasible solutions
  for (let i = 0; i < 7; i++) sols.push(cube('', C.B, [0.5, 0.3 + (i * 37 % 7) * 0.25, 0.5], -3.6 + i * 0.9, 0.2 + (i * 37 % 7) * 0.12, 0, 2));
  glow(sols[3], GOLD);
  tag('所有 feasible（可行）解 → 挑最好的', 'idx', -0.9, 3.0);
  sayc('目標：在所有可行解裡找最好的');
  await step(tok);                                   // 0:54 exponential time, NP-hard
  bad('很多要指數時間：多半是 NP-hard', 3.2, 3.8);
  sayc('很多最佳化問題要指數時間', '它們多半是 NP-hard');
  await step(tok);                                   // 1:01 TSP, 0/1 knapsack, vertex cover
  ['TSP', '0/1 knapsack', 'vertex cover'].forEach((t, i) => note(t, -3.4 + i * 3.4, 0.4, 2.0));
  sayc('例：TSP、0/1 knapsack、vertex cover');
  await step(tok);                                   // 1:15 impossible: exact, poly time, all instances
  bad('無法在 poly time 內對所有輸入都求出最佳解', 0, 0.4, 3.0);
  sayc('實際上做不到：所有輸入、多項式時間、又要最佳解');
  await step(tok);                                   // 1:30 minimisation or maximisation
  sayc('最佳化問題分成最小化、最大化');
  await step(tok);                                   // 1:38 TSP min, knapsack max
  tag('min：路線成本', 'idx', -3.4, 0.4, 2.6); tag('max：profit', 'idx', 0, 0.4, 2.6);
  sayc('TSP 最小化成本', '0/1 knapsack 最大化 profit');
}]);

// 1:57 三種對付 NP-hard 的方法
FRAG.push(['bt-ap-ways', '近似演算法：brute force、heuristic、approximation', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.2, 0]);
  const col = (i) => -4.2 + i * 4.2;
  const box = [];
  await step(tok);                                   // 1:57 three ways
  sayc('對付 NP-hard 問題，通常有三種方法');
  await step(tok);                                   // 2:00 brute force
  box.push(bx('Brute force', C.D, col(0), 3.6, 0, 3.4, 2, 0.6, 0.8));
  sayc('① Brute force（暴力法）');
  await step(tok);                                   // 2:03 heuristics
  box.push(bx('Heuristics', C.P, col(1), 3.6, 0, 3.4, 2, 0.6, 0.8));
  sayc('② Heuristics（啟發式）');
  await step(tok);                                   // 2:07 approximation
  box.push(bx('Approximation', C.G, col(2), 3.6, 0, 3.4, 2, 0.6, 0.8));
  sayc('③ Approximation（近似）');
  await step(tok);                                   // 2:13 enumerate all, pick the optimum
  glow(box[0], GOLD);
  good('答案一定最佳', col(0), 2.7);
  sayc('暴力法：列出所有可行解，挑最佳的');
  await step(tok);                                   // 2:24 no guarantee on running time
  bad('時間沒有保證', col(0), 2.0);
  sayc('問題：執行時間沒有保證');
  await step(tok);                                   // 2:28 TSP: 21 cities, 77 years
  note('TSP 21 個城市：77 年', col(0), 1.2);
  sayc('之前算過：暴力解 21 城市 TSP 要 77 年');
  await step(tok);                                   // 2:42 heuristics: polynomial time
  glow(box[0], null); glow(box[1], GOLD);
  good('保證 poly time', col(1), 2.7);
  sayc('heuristic：憑直覺設計，保證多項式時間');
  await step(tok);                                   // 2:51 no guarantee on quality
  bad('答案品質沒有保證', col(1), 2.0);
  sayc('問題：答案好不好沒有保證');
  await step(tok);                                   // 2:56 good for some instances, bad for others
  note('有的輸入很準、有的很差', col(1), 1.2);
  sayc('有些輸入表現好，有些很差');
  await step(tok);                                   // 3:07 approximation: poly time AND close to optimal
  glow(box[1], null); glow(box[2], GOLD);
  good('保證 poly time', col(2), 2.7); good('保證接近最佳解', col(2), 2.0);
  sayc('近似演算法：保證多項式時間', '而且保證答案接近最佳解');
  await step(tok);                                   // 3:21 closeness defined; prove it without knowing the optimum
  note('挑戰：不知道最佳值，也要證明「很接近」', col(2), 1.2);
  sayc('「多接近」有明確定義', '難處：不知道最佳值也要證明');
}]);

// 3:33 定義：absolute / relative approximation
FRAG.push(['bt-ap-def', '近似演算法：absolute 與 relative approximation', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.4, 0]);
  const bar = (h, c, x, label) => { const m = cube('', c, [1.0, 1, 0.8], x, 0.01, 0); m.scale.y = Math.max(0.01, h); m.position.y = m.scale.y / 2; tag(label, 'idx', x, 0, 0.8); return m; };
  await step(tok);                                   // 3:33 definition
  hd('Approximation algorithm 的定義', 0, 5.6);
  sayc('看近似演算法的定義');
  await step(tok);                                   // 3:38 problem P; for any instance → a feasible solution
  note('對 P 的任何輸入 I，A 都輸出一個 feasible 解', 0, 4.8);
  sayc('最佳化問題 P、演算法 A', '任何輸入都回傳一個可行的近似解');
  await step(tok);                                   // 3:55 two types: absolute, relative
  hd('absolute', -3.4, 3.8); hd('relative', 3.4, 3.8);
  sayc('兩種：absolute、relative');
  await step(tok);                                   // 4:06 A*(I) optimal, A(I) ours
  bar(1.6, C.G, -4.4, 'A*(I) 最佳'); bar(2.2, C.O, -3.0, 'A(I) 近似');
  sayc('A*(I)：輸入 I 的最佳解值', 'A(I)：演算法給的解值');
  await step(tok);                                   // 4:24 absolute: |A*(I) − A(I)| ≤ k
  note('|A*(I) − A(I)| ≤ k', -3.4, 3.0);
  sayc('absolute：差距不超過常數 k', '|A*(I) − A(I)| ≤ k');
  await step(tok);                                   // 4:44 example: planar graph colouring
  tag('例：planar graph coloring', 'idx', -3.4, 2.4);
  sayc('例：平面圖著色');
  await step(tok);                                   // 4:48 relative: max(A*/A, A/A*) ≤ k
  bar(1.6, C.G, 2.6, 'A*(I)'); bar(3.2, C.O, 4.0, 'A(I)');
  note('max(A*/A, A/A*) ≤ k', 3.4, 3.0);
  sayc('relative：比值不超過常數 k', 'max(A*(I)/A(I), A(I)/A*(I)) ≤ k');
  await step(tok);                                   // 5:06 vertex cover approx: relative
  tag('例：vertex cover（k = 2）', 'idx', 3.4, 2.4);
  sayc('vertex cover 的近似演算法屬於 relative');
  await step(tok);                                   // 5:12 |…| and max: min and max problems
  sayc('用絕對值、取 max', '是為了最小化、最大化問題都能適用');
}]);

// 5:31 vertex cover 的定義；{1,4,7} 不是、{1,2,3,5,7} 是
FRAG.push(['bt-ap-vc-def', '近似演算法：vertex cover 的定義', async (tok) => {
  fresh([0, 8.5, 8.5], [0.2, 0, 0.4]);
  let W = null; const info = [];
  const say2 = (t, cls = 'note') => { info.push(tag(t, cls, 4.4, 0.4, -2.4 + info.length * 0.85)); };
  await step(tok);                                   // 5:31 vertex cover problem
  hd('Vertex Cover', 4.4, 0.3, -3.4);
  sayc('來看 vertex cover 問題');
  await step(tok);                                   // 5:45 G = (V, E)
  W = vcWorld();
  sayc('給一張圖 G = (V, E)', 'V = 頂點集合、E = 邊集合');
  await step(tok);                                   // 5:52 C ⊆ V covers: every edge has an endpoint in C
  say2('C ⊆ V：每條邊至少一個端點在 C 裡');
  sayc('頂點子集合 C 是 vertex cover', '⇔ 每條邊至少有一端在 C 裡');
  await step(tok);                                   // 6:01 C covers all edges; minimise |C|
  say2('目標：|C| 越小越好');
  sayc('C 要「蓋住」所有的邊', '目標是讓 |C| 最小');
  await step(tok);                                   // 6:12 choose 1, 4, 7
  W.pick([1, 4, 7]);
  sayc('試試看 {1, 4, 7}');
  await step(tok);                                   // 6:22 edges covered by a vertex: its incident edges
  glow(W.g.N[1], GOLD);
  sayc('「被頂點 v 蓋住的邊」', '= 以 v 為端點的邊');
  await step(tok);                                   // 6:34 by 1: 1-2, 1-5, 1-4
  W.cover([1]);
  sayc('1 蓋住：1–2、1–5、1–4');
  await step(tok);                                   // 6:39 by 4: 4-3, 4-7, 4-5
  glow(W.g.N[1], null); glow(W.g.N[4], GOLD);
  W.cover([1, 4]);
  sayc('4 蓋住：4–3、4–7、4–5（4–1 已蓋）');
  await step(tok);                                   // 6:53 by 7: 7-5, 7-6
  glow(W.g.N[4], null); glow(W.g.N[7], GOLD);
  W.cover([1, 4, 7]);
  sayc('7 蓋住：7–5、7–6');
  await step(tok);                                   // 7:21 not all: 2-5, 3-6 uncovered
  glow(W.g.N[7], null);
  W.showMissing([1, 4, 7]);
  sayc('還有邊沒被蓋到：2–5、3–6');
  await step(tok);                                   // 7:31 {1, 4, 7} is not a vertex cover
  say2('{1, 4, 7} ✗ 不是 vertex cover', 'bad');
  sayc('所以 {1, 4, 7} 不是 vertex cover');
  await step(tok);                                   // 7:41 check {1, 2, 3, 5, 7}
  W.reset(); W.pick([1, 2, 3, 5, 7]);
  sayc('換 {1, 2, 3, 5, 7} 試試');
  await step(tok);                                   // 7:52 edges by 1, 2
  W.cover([1, 2]);
  sayc('1、2 蓋住的邊');
  await step(tok);                                   // 8:08 by 5, 7, 3
  W.cover([1, 2, 5, 7, 3]);
  sayc('5、7、3 蓋住其餘的邊');
  await step(tok);                                   // 8:36 all covered → valid
  say2('{1, 2, 3, 5, 7} ✓ 是 vertex cover', 'good');
  sayc('每條邊都蓋到了 → 是 vertex cover');
  await step(tok);                                   // 8:44 |C| = 5
  say2('|C| = 5');
  sayc('大小 |C| = 5');
}]);

// 8:59 最小 vertex cover：4
FRAG.push(['bt-ap-vc-min', '近似演算法：最小 vertex cover = 4', async (tok) => {
  fresh([0, 8.5, 8.5], [0.2, 0, 0.4]);
  const W = vcWorld(false);
  const info = [];
  const say2 = (t, cls = 'note') => { info.push(tag(t, cls, 4.4, 0.4, -2.4 + info.length * 0.85)); };
  await step(tok);                                   // 8:59 can we do better?
  sayc('能不能更小？');
  await step(tok);                                   // 9:03 minimum vertex cover; may be several
  say2('最小的 = minimum vertex cover（可能不只一個）');
  sayc('|C| 最小的叫 minimum vertex cover', '可能有好幾個');
  await step(tok);                                   // 9:16 check {1, 4, 5, 6}
  W.pick([1, 4, 5, 6]);
  sayc('試試 {1, 4, 5, 6}');
  await step(tok);                                   // 9:27 by 1
  W.cover([1]);
  sayc('1 蓋住：1–2、1–5、1–4');
  await step(tok);                                   // 9:35 by 4
  W.cover([1, 4]);
  sayc('4 蓋住：4–5、4–7、4–3');
  await step(tok);                                   // 9:49 by 5
  W.cover([1, 4, 5]);
  sayc('5 蓋住：5–7、5–2');
  await step(tok);                                   // 9:58 by 6 → all covered
  W.cover([1, 4, 5, 6]);
  sayc('6 蓋住：6–3、6–7 → 全部蓋到');
  await step(tok);                                   // 10:08 valid, size 4
  say2('{1, 4, 5, 6} ✓，|C| = 4', 'good');
  sayc('是 vertex cover，大小 4');
  await step(tok);                                   // 10:20 pause: find others of size 4; smaller?
  sayc('暫停想想：還有別的大小 4 嗎？', '有沒有小於 4 的？');
  await step(tok);                                   // 10:33 none smaller than 4
  say2('這張圖找不到小於 4 的 → 最小 = 4', 'good');
  sayc('沒有小於 4 的', '最小 vertex cover 的大小 = 4');
  await step(tok);                                   // 10:47 figure b: all vertices (trivial)
  W.reset(); W.pick([1, 2, 3, 4, 5, 6, 7]); W.cover([1, 2, 3, 4, 5, 6, 7]);
  say2('全部頂點：一定是 cover（trivial）');
  sayc('全部頂點都選：一定是 vertex cover', '但最沒用（trivial）');
  await step(tok);                                   // 11:06 c, d: other covers of size 4
  W.reset(); W.pick([1, 3, 5, 7]); W.cover([1, 3, 5, 7]);
  say2('其他大小 4：{1, 3, 5, 7}、{2, 4, 5, 6}');
  sayc('其他大小 4 的：{1, 3, 5, 7}、{2, 4, 5, 6}');
}]);

// 11:15 暴力法：2ⁿ 個子集合
FRAG.push(['bt-ap-vc-brute', '近似演算法：vertex cover 暴力法 O(2ⁿ)', async (tok) => {
  fresh([0, 5, 12], [0, 2.2, 0]);
  const cells = [];
  await step(tok);                                   // 11:15 brute force complexity
  sayc('暴力法解 vertex cover 要多久？');
  await step(tok);                                   // 11:21 n vertices
  const vs = [1, 2, 3, 4].map((v) => bx(v, C.K, -1.8 + (v - 1) * 1.2, 4.6, 0, 0.9, 2, 0.6, 0.6));
  sayc('圖有 n 個頂點');
  await step(tok);                                   // 11:24 generate all subsets, check each
  for (let m = 0; m < 16; m++) { const s = [0, 1, 2, 3].filter((i) => m >> i & 1).map((i) => i + 1); cells.push(tag('{' + s.join(',') + '}', 'idx', -5.6 + (m % 8) * 1.6, 2.8 - Math.floor(m / 8) * 0.8)); await wt(tok, 80); }
  sayc('產生所有子集合，逐一檢查是不是 cover');
  await step(tok);                                   // 11:36 choose the minimum among the covers
  sayc('在是 cover 的子集合裡挑最小的');
  await step(tok);                                   // 11:45 2ⁿ subsets
  hot('n 個頂點 → 2ⁿ 個子集合（n = 4：16 個）', 0, 1.0);
  sayc('n 個元素有 2ⁿ 個子集合');
  await step(tok);                                   // 12:00 O(2ⁿ): exponential
  hot('O(2ⁿ)：指數時間', 0, 0.2);
  sayc('時間 O(2ⁿ)：指數級');
  await step(tok);                                   // 12:07 grows exponentially
  sayc('n 每加 1，時間就加倍');
  await step(tok);                                   // 12:17 large n: months or years
  note('n 很大 → 要算好幾個月、好幾年', 0, 5.6);
  sayc('n 很大時要算好幾個月甚至好幾年');
  await step(tok);                                   // 12:27 approximation algorithms instead
  good('改用近似演算法：快、又夠接近', 0, 6.3);
  sayc('只好靠近似演算法', '很快得到「夠接近」的答案');
  void vs;
}]);

// 12:39 演算法 APPROX-VERTEX-COVER
FRAG.push(['bt-ap-vc-algo', '近似演算法：APPROX-VERTEX-COVER', async (tok) => {
  fresh([0, 5, 12], [0, 2.4, 0]);
  const cd = code(VC_ALGO, 2.6, 5.4, 0.5);
  const P = { u: [-4.6, 0.3, 0.6], v: [-2.6, 0.3, 0.6], a: [-5.6, 0.3, 2.2], b: [-3.6, 0.3, 2.6], c: [-1.4, 0.3, 2.2], d: [-1.2, 0.3, -0.6] };
  const PE = [['u', 'v'], ['u', 'a'], ['u', 'b'], ['v', 'c'], ['v', 'd'], ['a', 'b']];
  let g = null;
  await step(tok);                                   // 12:39 step by step
  g = graph(P, PE, { drop: true, size: [0.55, 0.45, 0.55] });
  sayc('一步一步看這個演算法');
  await step(tok);                                   // 12:43 C = ∅
  cd.hl(1);
  sayc('一開始解集合 C 是空集合');
  await step(tok);                                   // 12:49 pick an arbitrary edge (u, v)
  cd.hl(4); g.E[ek('u', 'v')].material.color.set(C.Y);
  sayc('從邊集合任意挑一條邊 (u, v)');
  await step(tok);                                   // 12:56 add both u and v to C
  cd.hl(5); tint(g.N.u, C.R); tint(g.N.v, C.R);
  sayc('把 u、v 兩個端點都放進 C', 'C = C ∪ {u, v}');
  await step(tok);                                   // 13:07 remove all edges incident on u or v
  cd.hl(6);
  for (const [a, b] of PE) if ([a, b].some((x) => x === 'u' || x === 'v')) g.E[ek(a, b)].visible = false;
  sayc('刪掉所有碰到 u 或 v 的邊');
  await step(tok);                                   // 13:16 repeat until no edges
  cd.hl(3); g.E[ek('a', 'b')].material.color.set(C.Y);
  sayc('重複，直到邊都被刪光');
  await step(tok);                                   // 13:23 then C is a vertex cover; return C
  tint(g.N.a, C.R); tint(g.N.b, C.R); g.E[ek('a', 'b')].visible = false; cd.hl(8);
  sayc('邊刪光時，C 一定是 vertex cover', '回傳 C');
  await step(tok);                                   // 13:39 the formal pseudo code
  cd.hl(0);
  sayc('右邊是正式的虛擬碼');
  await step(tok);                                   // 13:56 while E' is not empty
  cd.hl(3);
  sayc("while E' ≠ ∅：邊集合還沒空就繼續");
  await step(tok);                                   // 14:02 pick an edge, add u and v
  cd.hl(4); await wt(tok, 300); cd.hl(5);
  sayc('任挑一條邊 (u, v)，u、v 加進 C');
  await step(tok);                                   // 14:08 remove every incident edge
  cd.hl(6);
  sayc('刪掉碰到 u 或 v 的所有邊');
  await step(tok);                                   // 14:15 until empty; return C
  cd.hl(8);
  sayc('直到 E\' 空了，回傳 C');
  await step(tok);                                   // 14:23 time O(V + E)
  hot('時間 O(V + E)', -3.6, 4.6);
  sayc('時間複雜度 O(V + E)', '每條邊、每個頂點只處理常數次');
  await step(tok);                                   // 14:36 E ≤ V² → O(n²)
  note('E ≤ V²（n 個頂點）→ O(n²)', -3.6, 3.8);
  sayc('邊數最多 n² → O(n²)');
  await step(tok);                                   // 14:51 polynomial
  good('多項式時間 ✓', -3.6, 3.0);
  sayc('O(n²) 是多項式時間');
}]);

// 15:08 在例圖上執行
FRAG.push(['bt-ap-vc-run', '近似演算法：在例圖上跑 → |C| = 6', async (tok) => {
  fresh([0, 8.5, 8.5], [0.4, 0, 0.4]);
  const W = vcWorld(false);
  const Ct = tag('C = { }', 'ptr alt', 4.4, 0.4, -3.0);
  const left = VC7E.map(([a, b]) => ek(a, b));
  const Et = tag("E' = " + left.length + ' 條邊', 'ptr', 4.4, 0.4, -2.2);
  const C0 = [];
  const pick = (a, b) => { W.edge(a, b, C.Y); C0.push(a, b); W.pick([a, b]); txt(Ct, 'C = {' + C0.join(', ') + '}'); };
  const drop = (a, b) => { VC7E.forEach(([x, y]) => { const k = ek(x, y); if (left.includes(k) && [x, y].some((z) => z === a || z === b)) { left.splice(left.indexOf(k), 1); W.hide(x, y); } }); txt(Et, "E' = " + left.length + ' 條邊'); };
  const showDel = (a, b) => VC7E.forEach(([x, y]) => { if (left.includes(ek(x, y)) && [x, y].some((z) => z === a || z === b) && !(x === a && y === b)) W.edge(x, y, C.R); });
  await step(tok);                                   // 15:08 run it on this graph
  sayc('在這張圖上跑演算法');
  await step(tok);                                   // 15:12 C = ∅, E' = all edges
  sayc("C = ∅，E' = 圖上所有的邊");
  await step(tok);                                   // 15:21 the two sets

  sayc("右邊顯示 C 和 E'");
  await step(tok);                                   // 15:30 is E' empty?
  sayc("檢查 E' 是不是空的");
  await step(tok);                                   // 15:34 choose, add, remove … until empty
  sayc('不空就：挑邊 → 加端點 → 刪相鄰邊', '一直做到空');
  await step(tok);                                   // 15:59 E' has all edges: not empty
  sayc("一開始 E' 有 10 條邊，不是空的");
  await step(tok);                                   // 16:06 choose (1, 2), add to C
  pick(1, 2);
  sayc('任挑一條：(1, 2)', '1、2 放進 C');
  await step(tok);                                   // 16:17 remove 1-2, 1-4, 1-5, 2-5
  showDel(1, 2); await wt(tok, 500); drop(1, 2);
  sayc('刪掉碰到 1 或 2 的邊', '1–2、1–4、1–5、2–5');
  await step(tok);                                   // 16:29 still not empty
  sayc("E' 還沒空");
  await step(tok);                                   // 16:39 choose (5, 7)
  W.edge(5, 7, C.Y);
  sayc('再挑一條：(5, 7)');
  await step(tok);                                   // 16:56 C = {1, 2, 5, 7}
  pick(5, 7);
  sayc('C = {1, 2, 5, 7}');
  await step(tok);                                   // 16:59 remove 5-4, 5-7, 7-4, 7-6
  showDel(5, 7); await wt(tok, 500); drop(5, 7);
  sayc('刪掉 5–4、5–7、7–4、7–6');
  await step(tok);                                   // 17:26 two edges left: 3-4, 3-6
  sayc("E' 還剩兩條：3–4、3–6");
  await step(tok);                                   // 17:38 choose (3, 6)
  W.edge(3, 6, C.Y);
  sayc('挑 (3, 6)');
  await step(tok);                                   // 17:50 add 3, 6
  pick(3, 6);
  sayc('3、6 放進 C');
  await step(tok);                                   // 17:55 delete 3-4, 3-6
  showDel(3, 6); await wt(tok, 500); drop(3, 6);
  sayc('刪掉 3–4、3–6');
  await step(tok);                                   // 18:14 E' empty: loop ends
  sayc("E' 空了 → 迴圈結束");
  await step(tok);                                   // 18:23 return C = {1, 2, 5, 7, 3, 6}
  W.reset(); W.pick(C0); W.cover(C0);
  sayc('回傳 C = {1, 2, 5, 7, 3, 6}', '確實蓋住所有邊');
  await step(tok);                                   // 18:35 |C| = 6
  hot('|C| = 6（最佳是 4）', 4.4, 0.4, -1.4);
  sayc('近似解 |C| = 6');
}]);

// 18:47 maximal matching
FRAG.push(['bt-ap-vc-match', '近似演算法：挑到的邊 = maximal matching', async (tok) => {
  fresh([0, 8.5, 8.5], [0.4, 0, 0.4]);
  const W = vcWorld(false);
  const M = [[1, 2], [5, 7], [3, 6]];
  const info = [];
  const say2 = (t, cls = 'note') => { info.push(tag(t, cls, 4.4, 0.4, -2.4 + info.length * 0.85)); };
  await step(tok);                                   // 18:47 chosen edges are independent
  M.forEach(([a, b]) => W.edge(a, b, C.Y));
  sayc('演算法挑的三條邊：彼此沒有共同端點', '叫做 independent edges');
  await step(tok);                                   // 19:00 useful in the proof
  sayc('這點在證明時非常有用');
  await step(tok);                                   // 19:07 maximal matching
  say2('maximal matching');
  sayc('證明要用到 maximal matching');
  await step(tok);                                   // 19:16 matching: edges without common vertices
  say2('matching：沒有共同端點的邊的集合');
  sayc('先懂 matching：一組互不相碰的邊');
  await step(tok);                                   // 19:29 maximal: cannot add more edges
  say2('maximal：再也加不進任何一條邊');
  VC7E.forEach(([a, b]) => { if (!M.some(([x, y]) => x === a && y === b)) W.edge(a, b, C.R); });
  sayc('maximal matching：再加任何一條邊', '都會和已選的邊碰在一起');
  await step(tok);                                   // 19:35 the algorithm's edges always form one
  sayc('演算法挑出的邊，一定形成 maximal matching');
  await step(tok);                                   // 19:42 1-2, 3-6, 5-7
  VC7E.forEach(([a, b]) => { if (!M.some(([x, y]) => x === a && y === b)) W.edge(a, b, EDGE); });
  M.forEach(([a, b]) => W.pick([a, b]));
  sayc('這裡是 (1, 2)、(3, 6)、(5, 7)');
  await step(tok);                                   // 19:55 M = {(1,2), (3,6), (5,7)}
  say2('M = {(1,2), (3,6), (5,7)}', 'good');
  sayc('M = {(1, 2), (3, 6), (5, 7)}');
  await step(tok);                                   // 20:03 |C| = 6, |M| = 3
  say2('|C| = 6，|M| = 3');
  sayc('|C| = 6、|M| = 3');
  await step(tok);                                   // 20:16 |C| = 2|M|
  say2('|C| = 2|M|（每條邊貢獻 2 個端點）', 'good');
  sayc('永遠 |C| = 2|M|', '每挑一條邊就放進 2 個頂點');
}]);

// 20:32 證明：|C| ≤ 2|C*|
FRAG.push(['bt-ap-vc-proof', '近似演算法：證明 |C| ≤ 2|C*|', async (tok) => {
  fresh([0, 8.5, 8.5], [0.4, 0, 0.4]);
  const W = vcWorld(false);
  const M = [[1, 2], [5, 7], [3, 6]];
  const lines = [];
  const ln = (t, cls = 'note') => { lines.push(tag(t, cls, 4.6, 0.4, -2.8 + lines.length * 0.72)); return lines[lines.length - 1]; };
  await step(tok);                                   // 20:32 performance guarantee
  sayc('近似演算法要有 performance guarantee', '和最佳解比，最多差多少');
  await step(tok);                                   // 20:49 C by the algorithm, C* the optimum
  ln('C：演算法的解；C*：最小 vertex cover');
  sayc('C = 演算法找到的 cover', 'C* = 最小（最佳）的 cover');
  await step(tok);                                   // 20:58 |C| ≤ 2|C*|
  ln('要證：|C| ≤ 2|C*|', 'ptr alt');
  sayc('要證明：|C| ≤ 2|C*|');
  await step(tok);                                   // 21:07 proof
  sayc('開始證明');
  await step(tok);                                   // 21:10 chosen edges = maximal matching M
  M.forEach(([a, b]) => W.edge(a, b, C.Y));
  ln('演算法挑的邊 = maximal matching M');
  sayc('演算法挑出的邊形成 maximal matching M');
  await step(tok);                                   // 21:18 polynomial time
  sayc('而且演算法是多項式時間');
  await step(tok);                                   // 21:24 C* must cover every edge of M
  [1, 4, 5, 6].forEach((v) => glow(W.g.N[v], GREEN));
  sayc('C* 也是 cover', '所以 M 的每條邊都要被 C* 蓋到');
  await step(tok);                                   // 21:32 edges of M are independent
  sayc('M 的邊彼此沒有共同端點');
  await step(tok);                                   // 21:39 C* has ≥ 1 endpoint of each edge of M → |C*| ≥ |M|
  ln('C* 在 M 的每條邊上至少佔一個端點 → |C*| ≥ |M|');
  sayc('C* 在每條 M 的邊上至少要一個端點', '端點互不重複 → |C*| ≥ |M|');
  await step(tok);                                   // 21:51 2|C*| ≥ 2|M|
  ln('2|C*| ≥ 2|M|');
  sayc('兩邊乘 2：2|C*| ≥ 2|M|');
  await step(tok);                                   // 22:00 2|M| = |C|
  ln('2|M| = |C|');
  sayc('又 2|M| = |C|');
  await step(tok);                                   // 22:06 |C| ≤ 2|C*|
  ln('∴ |C| ≤ 2|C*|：2-approximation', 'good');
  sayc('所以 |C| ≤ 2|C*|', '證明完成：2-近似');
  await step(tok);                                   // 22:19 verify with the example: C* = 4
  sayc('用例子驗證：|C*| = 4');
  await step(tok);                                   // 22:37 claim ≤ 8, got 6
  W.pick([1, 2, 5, 7, 3, 6]);
  sayc('保證 |C| ≤ 8；實際 |C| = 6');
  await step(tok);                                   // 22:47 6 ≤ 2 · 4 holds
  ln('6 ≤ 2 × 4 = 8 ✓', 'good');
  sayc('6 ≤ 2 × 4 成立');
}]);

// ════════ cmQQL_hBBIM（交大 江蕙如 Lec24：Chapter 9 Linear Programming） ════════
// 巧克力店：max x1 + 6x2，x1 ≤ 200、x2 ≤ 300、x1 + x2 ≤ 400、x ≥ 0 → (100, 300)，1900；
// dual：min 200y1 + 300y2 + 400y3，y1 + y3 ≥ 1、y2 + y3 ≥ 6、y ≥ 0 → (0, 5, 1)。
// Simplex 例：max 2x1 + 5x2，2x1 − x2 ≤ 4、x1 + 2x2 ≤ 9、−x1 + x2 ≤ 3、x ≥ 0：(0,0) → (0,3) → (1,4) = 22。
// a list of text lines that grows downward
function panel(x, yTop, dy = 0.55, z = 0) {
  const ls = [];
  return { ls, add(t, cls = 'note') { const l = tag(t, cls, x, yTop - ls.length * dy, z); ls.push(l); return l; }, mark(i, cls = 'ptr alt') { if (ls[i]) setCls(ls[i], cls); } };
}
// a 2D chart standing in the z = 0 plane: P(a, b) → world point
function lpChart(ox, oy, s, maxA, maxB, la = 'x1', lb = 'x2') {
  const P = (a, b) => V3(ox + a * s, oy + b * s, 0);
  rod(P(0, 0), P(maxA, 0), C.D, 0.025); rod(P(0, 0), P(0, maxB), C.D, 0.025);
  tag(la, 'idx', ox + maxA * s + 0.3, oy); tag(lb, 'idx', ox, oy + maxB * s + 0.3);
  const ch = { P, s, maxA, maxB };
  // the segment of a·x + b·y = c inside the box
  ch.line = (a, b, c, col = C.B, r = 0.03) => {
    const pts = [];
    const add = (x, y) => { if (x >= -1e-9 && y >= -1e-9 && x <= maxA + 1e-9 && y <= maxB + 1e-9 && !pts.some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 1e-6)) pts.push([x, y]); };
    if (b) { add(0, c / b); add(maxA, (c - a * maxA) / b); }
    if (a) { add(c / a, 0); add((c - b * maxB) / a, maxB); }
    if (pts.length < 2) return null;
    return rod(P(...pts[0]), P(...pts[1]), col, r);
  };
  ch.poly = (pts, col = C.G, op = 0.3) => {
    const sh = new THREE.Shape(); pts.forEach(([a, b], i) => { const p = P(a, b); if (i) sh.lineTo(p.x, p.y); else sh.moveTo(p.x, p.y); });
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    m.position.z = -0.02; lab.world.add(m); return m;
  };
  ch.dot = (a, b, col = C.R, t) => { const p = P(a, b); const m = cube('', col, [0.22, 0.22, 0.22], p.x, p.y, 0.1); if (t) m.userData.t = tag(t, 'ptr', p.x + 0.2, p.y + 0.35, 0.1); return m; };
  ch.move = async (tok, m, a, b, ms = 700) => { const from = m.position.clone(), to = P(a, b); to.z = 0.1; const t = m.userData.t; await anim(tok, ms, (u) => { m.position.lerpVectors(from, to, u); if (t) t.position.set(m.position.x + 0.2, m.position.y + 0.35, 0.1); }); };
  return ch;
}
const CHOCO = [[0, 0], [200, 0], [200, 200], [100, 300], [0, 300]];
function chocoChart(ox = -0.6, oy = 0.3, s = 0.012) {
  const ch = lpChart(ox, oy, s, 420, 420);
  [100, 200, 300, 400].forEach((v) => { tag(String(v), 'idx', ox + v * s, oy - 0.3); tag(String(v), 'idx', ox - 0.45, oy + v * s); });
  return ch;
}

// 0:16 單元大綱
FRAG.push(['bt-lp-intro', '線性規劃：單元大綱', async (tok) => {
  fresh([0, 4.4, 12], [0, 2.6, 0]);
  const pn = panel(-3.2, 5.0, 0.62);
  let pr = null, du = null;
  await step(tok);                                   // 0:16 new unit: Linear Programming
  hd('Linear Programming（線性規劃）', 0, 6.0);
  sayc('新單元：Linear Programming', '非常常用的最佳化技術');
  await step(tok);                                   // 0:21 an introduction
  sayc('這個單元是簡介性質', '讓大家認識這個技巧');
  await step(tok);                                   // 0:40 first: what is LP
  pn.add('① 什麼是 Linear Programming');
  sayc('① 什麼是 LP');
  await step(tok);                                   // 0:45 second: formulate an LP
  pn.add('② 怎麼 formulate 一個 LP');
  sayc('② 怎麼把問題寫成 LP');
  await step(tok);                                   // 0:54 the hardest part: describe your problem as an LP
  pn.mark(1);
  sayc('最大的關卡：把你的問題描述成 LP');
  await step(tok);                                   // 1:10 third: the theory behind
  pn.add('③ 背後的最佳化理論');
  sayc('③ 背後的最佳化理論');
  await step(tok);                                   // 1:20 duality
  pn.add('　　duality（對偶）');
  sayc('很重要的性質：duality');
  await step(tok);                                   // 1:27 primal problem; a dual problem comes with it
  pr = bx('primal', C.B, 2.0, 2.6, 0, 1.6, 2, 0.6, 0.8); du = bx('dual', C.O, 5.0, 2.6, 0, 1.6, 2, 0.6, 0.8);
  sayc('想解的問題叫 primal', '解的過程會伴隨產生一個 dual problem');
  await step(tok);                                   // 1:40 alternate between them until they converge
  await anim(tok, 1200, (u) => { pr.position.x = 2.0 + 1.1 * u; du.position.x = 5.0 - 1.1 * u; });
  sayc('在兩個問題之間交替', '直到收斂（converge）');
  await step(tok);                                   // 1:52 they merge → solved
  glow(pr, GREEN); glow(du, GREEN);
  sayc('兩者 merge 在一起時，就得到解了');
  await step(tok);                                   // 2:01 simplex method: simple and elegant
  pn.add('④ Simplex method');
  sayc('④ Simplex method', '非常簡單、優雅的方法');
  await step(tok);                                   // 2:08 later improvements, same essence
  sayc('後來有人改進速度', '但本質就是今天介紹的方法');
}]);

// 3:01 什麼是 LP
FRAG.push(['bt-lp-what', '線性規劃：linear + programming，三大部分', async (tok) => {
  fresh([0, 4.4, 12], [0, 2.6, 0]);
  const pn = panel(2.4, 5.6, 0.62);
  let parts = [];
  await step(tok);                                   // 3:01 what is LP
  hd('Linear Programming = 線性規劃', -3.0, 6.0);
  sayc('LP 是什麼？名字就說明了');
  await step(tok);                                   // 3:14 linear: every expression is linear
  bx('Linear', C.B, -4.4, 4.8, 0, 2.2, 2, 0.6, 0.8);
  tag('式子全部是線性（一次式）', 'idx', -4.4, 4.1);
  sayc('Linear：寫出來的式子全部是線性的');
  await step(tok);                                   // 3:24 programming = optimization
  bx('Programming', C.P, -1.6, 4.8, 0, 2.6, 2, 0.6, 0.8);
  tag('= 最佳化（和 DP 的 Programming 一樣）', 'idx', -1.6, 4.1);
  sayc('Programming：數學上的意思是最佳化', '和 Dynamic Programming 一樣');
  await step(tok);                                   // 3:34 mathematical programming
  sayc('Mathematical programming = 最佳化的過程');
  await step(tok);                                   // 3:48 why linear: two places
  sayc('從兩個地方看出它是「線性」的');
  await step(tok);                                   // 4:01 first: the criterion to optimise
  pn.add('要最佳化的目標（criterion）');
  sayc('① 要最佳化的目標');
  await step(tok);                                   // 4:08 constraints → feasible region
  pn.add('限制（constraints）→ 圍出 feasible region');
  sayc('② 一些限制，圍出可行解的空間');
  await step(tok);                                   // 4:16 linear: only first degree
  note('兩者都只和變數的「一次方」有關', 2.4, 4.4);
  sayc('這些式子都是線性函數', '只和變數的一次方有關');
  await step(tok);                                   // 4:28 an LP has three parts
  pn.ls.forEach(kill); pn.ls.length = 0;
  sayc('寫一個 LP 包含三大部分');
  const P3 = (t, c, i) => { const m = bx(t, c, -4.2 + i * 3.4, 1.6, 0, 3.0, 2, 0.6, 0.8); parts.push(m); return m; };
  await step(tok);                                   // 4:35 first: decision variables
  P3('① decision variables', C.B, 0);
  sayc('① decision variable（決策變數）', '先想好要決定哪些量');
  await step(tok);                                   // 4:49 sometimes an assignment
  tag('有時是「指派」的形式', 'idx', -4.2, 0.9);
  sayc('有時候它代表一種指派（assignment）');
  await step(tok);                                   // 5:00 optimisation decides their values
  sayc('最佳化的過程就是決定這些變數的值');
  await step(tok);                                   // 5:09 objective function and constraints
  P3('② objective function', C.O, 1); P3('③ constraints', C.PK, 2);
  sayc('另外兩大部分：objective function、constraints', '任何最佳化問題都有');
  await step(tok);                                   // 5:27 objective: maximise or minimise a cost function
  tag('max 或 min 一個 cost function', 'idx', -0.8, 0.9);
  sayc('objective：讓某個 cost function', '最大（max）或最小（min）');
  await step(tok);                                   // 6:01 must be linear
  sayc('在 LP 裡，objective 一定是線性式');
  await step(tok);                                   // 6:06 constraints: restrictions of the problem
  glow(parts[2], GOLD);
  sayc('constraints：問題本身的限制');
  await step(tok);                                   // 6:22 linear, usually ≤ / ≥, maybe =
  tag('線性；通常是 ≤、≥（也可以 =）', 'idx', 2.6, 0.9);
  sayc('也是線性式', '通常是 ≤ 或 ≥ 的不等式，也可以有等式');
  await step(tok);                                   // 6:37 built from the decision variables
  sayc('用一開始設定的 decision variable 組成');
  await step(tok);                                   // 6:46 must completely describe the problem
  sayc('constraints 要寫得完整', '必須完整反映問題的本質');
  await step(tok);                                   // 7:00 constraints describe; objective = what we want
  glow(parts[1], GOLD);
  sayc('描述問題 → 放在 constraints', '想要的最佳 → 放在 objective');
  await step(tok);                                   // 7:25 LP in linear algebra; today: formulate + simplex
  sayc('大一線代學過 LP', '今天重點：怎麼寫 LP，以及 simplex 演算法');
}]);

// 7:48 巧克力店：formulate
FRAG.push(['bt-lp-choco', '線性規劃：巧克力店 formulate', async (tok) => {
  fresh([0, 4.4, 12], [0, 2.8, 0]);
  const pn = panel(2.6, 5.4, 0.6);
  const A = prop('parcel', -5.0, 0, 0.6, 0.9, 'A：每盒賺 $1'), B = prop('parcel', -2.6, 0, 0.6, 1.1, 'B：每盒賺 $6');
  showL(A.userData.label, false); showL(B.userData.label, false);
  const fac = [];
  await step(tok);                                   // 7:48 chocolate shop: A earns $1 per box
  showL(A.userData.label, true);
  sayc('巧克力店賣兩種產品', 'A：每賣一盒賺 1 元');
  await step(tok);                                   // 7:56 B earns $6
  showL(B.userData.label, true); bob(B, 0.06);
  sayc('B：每盒賺 6 元，比較有價值');
  await step(tok);                                   // 8:11 make lots of B? there are limits
  sayc('想多賺錢就多做 B？', '可是有限制');
  await step(tok);                                   // 8:20 factory capacity is limited
  prop('warehouse', -3.8, 0, -2.0, 0.8);
  sayc('附屬工廠每天的產能有限');
  await step(tok);                                   // 8:32 A at most 200
  fac.push(note('A 每天最多 200 盒', -3.8, 2.8));
  sayc('A 每天最多做 200 盒');
  await step(tok);                                   // 8:38 B at most 300
  fac.push(note('B 每天最多 300 盒', -3.8, 3.4));
  sayc('B 每天最多 300 盒');
  await step(tok);                                   // 8:43 total at most 400
  fac.push(note('A + B 總共最多 400 盒', -3.8, 4.0));
  sayc('不管怎麼做，每天總共最多 400 盒');
  await step(tok);                                   // 9:00 split A and B to maximise profit
  sayc('目標：在 400 盒以內分配 A、B', '讓 profit 越多越好');
  await step(tok);                                   // 9:18 demo: formulate an LP
  sayc('示範：寫成一個 linear program');
  await step(tok);                                   // 9:29 first: decision variables
  sayc('第一件事：決定 decision variable');
  await step(tok);                                   // 9:41 how many A, how many B?
  sayc('我們不知道的是：A 做幾盒、B 做幾盒');
  await step(tok);                                   // 10:04 x1 = boxes of A, x2 = boxes of B
  pn.add('x1 = A 每天做幾盒；x2 = B 每天做幾盒', 'ptr');
  sayc('設兩個變數：x1 = A 的盒數、x2 = B 的盒數');
  await step(tok);                                   // 10:19 objective: maximise the profit
  sayc('objective function：讓每天的 profit 最大');
  await step(tok);                                   // 10:31 it is a max
  const obj = pn.add('max', 'ptr alt');
  sayc('寫 max（求最大值）');
  await step(tok);                                   // 10:58 profit = x1 + 6x2
  txt(obj, 'max　x1 + 6x2');
  sayc('profit = x1 × 1 + x2 × 6 = x1 + 6x2');
  await step(tok);                                   // 11:22 depends on x1, x2; the bigger the better
  sayc('x1、x2 不同，profit 就不同', '希望它越大越好');
  await step(tok);                                   // 11:28 second: constraints
  sayc('第二部分：constraints');
  await step(tok);                                   // 11:45 basic: x1, x2 ≥ 0
  const nn = pn.add('x1 ≥ 0，x2 ≥ 0（不能做負的盒數）');
  sayc('最基本：x1、x2 ≥ 0', '不可能做負的盒數');
  await step(tok);                                   // 12:22 x1 ≤ 200
  pn.add('x1 ≤ 200');
  sayc('A 最多 200：x1 ≤ 200');
  await step(tok);                                   // 12:39 x2 ≤ 300
  pn.add('x2 ≤ 300');
  sayc('B 最多 300：x2 ≤ 300');
  await step(tok);                                   // 12:45 x1 + x2 ≤ 400
  pn.add('x1 + x2 ≤ 400');
  sayc('總數最多 400：x1 + x2 ≤ 400');
  await step(tok);                                   // 12:57 objective + four constraints
  sayc('上面是 objective function', '下面四個是 constraints');
  await step(tok);                                   // 13:09 books write it compactly
  sayc('書上不會標「objective」「constraint」', '直接寫 max x1 + 6x2');
  await step(tok);                                   // 13:37 subject to
  const st = tag('subject to', 'ptr', 2.6, 3.0, 1.4);
  sayc('constraints 前面寫 subject to', '意思是「受限於」');
  await step(tok);                                   // 13:52 the full LP
  txt(nn, 'x1, x2 ≥ 0');
  sayc('max x1 + 6x2　s.t.　x1 ≤ 200、x2 ≤ 300', 'x1 + x2 ≤ 400、x1, x2 ≥ 0');
  await step(tok);                                   // 14:27 s.t. = subject to, not "such that"
  txt(st, 's.t. = subject to（不是 such that）');
  sayc('縮寫 s.t. = subject to', '不是 such that！');
  await step(tok);                                   // 15:05 this is the LP
  sayc('這就是巧克力工廠的 linear program');
}]);

// 15:13 幾何：半平面、凸多邊形、最佳解在頂點
FRAG.push(['bt-lp-geo', '線性規劃：可行區域是凸多邊形，最佳解在頂點', async (tok) => {
  fresh([0, 3.4, 11.5], [0.6, 2.8, 0]);
  const pn = panel(-4.6, 5.8, 0.55);
  pn.add('max x1 + 6x2', 'ptr'); pn.add('x1 ≤ 200'); pn.add('x2 ≤ 300'); pn.add('x1 + x2 ≤ 400'); pn.add('x1, x2 ≥ 0');
  let ch = null, fill = null; const half = [], obj = [];
  await step(tok);                                   // 15:13 is it linear? objective: first degree
  pn.mark(0);
  sayc('先檢查：objective 是線性的嗎？', 'x1、x2 都是一次 → 是');
  await step(tok);                                   // 15:28 constraints too → an LP
  [1, 2, 3, 4].forEach((i) => pn.mark(i, 'ptr alt')); pn.mark(0, 'note');
  sayc('constraints 也都是一次 → 確實是 LP');
  await step(tok);                                   // 15:34 look at the constraints only
  sayc('先不看 objective，只看 constraints');
  await step(tok);                                   // 15:49 two variables → a plane
  ch = chocoChart();
  sayc('只有兩個變數 → 整個空間是一個平面');
  await step(tok);                                   // 16:02 x1 axis, x2 axis
  sayc('橫軸 x1、縱軸 x2');
  await step(tok);                                   // 16:11 a linear equation → a line
  const l1 = ch.line(1, 0, 200, C.B);
  sayc('x1、x2 的一個線性「等式」決定一條線', '例：x1 = 200');
  await step(tok);                                   // 16:34 an inequality → half of the plane
  half.push(ch.poly([[0, 0], [200, 0], [200, 420], [0, 420]], C.B, 0.12));
  sayc('「不等式」決定的是半邊平面', 'x1 ≤ 200：線的左半邊');
  await step(tok);                                   // 16:58 every linear inequality → a half plane
  sayc('任何線性不等式 → 半個平面');
  await step(tok);                                   // 17:08 three constraints, three half planes
  ch.line(0, 1, 300, C.P); ch.line(1, 1, 400, C.PK);
  half.push(ch.poly([[0, 0], [420, 0], [420, 300], [0, 300]], C.P, 0.1));
  half.push(ch.poly([[0, 0], [400, 0], [0, 400]], C.PK, 0.1));
  sayc('三條不等式，各決定半邊平面');
  await step(tok);                                   // 17:23 all must hold at once → intersection
  sayc('三個條件要同時成立', '→ 取交集');
  await step(tok);                                   // 17:51 intersection; x ≥ 0: first quadrant
  half.forEach(kill);
  sayc('再加上 x1, x2 ≥ 0：只取第一象限');
  await step(tok);                                   // 18:06 the shaded region
  fill = ch.poly(CHOCO, C.G, 0.35);
  sayc('圍出來的就是這塊斜線區域');
  await step(tok);                                   // 18:15 a convex polygon
  note('convex polygon（凸多邊形）', 1.6, 5.8);
  sayc('它是一個凸多邊形（convex polygon）');
  await step(tok);                                   // 18:24 every point is a feasible solution
  const d = ch.dot(80, 120, C.Y);
  sayc('裡面任何一點都是合法解', 'feasible solution');
  await step(tok);                                   // 18:33 feasible, not best; differ in objective
  sayc('合法 ≠ 最佳', '好壞差在 objective function 的值');
  await step(tok);                                   // 18:52 2 variables: equation → line, inequality → half plane
  kill(d);
  sayc('整理：兩個變數時', '等式 → 一條線；不等式 → 半平面');
  await step(tok);                                   // 19:15 constraints together → a convex polygon
  sayc('所有 constraints 合起來 → 凸多邊形');
  await step(tok);                                   // 19:29 3D, n dimensions: similar
  sayc('3D 或 n 個變數也有類似的性質', '（凸多面體）');
  await step(tok);                                   // 19:41 find the point with the best objective
  sayc('要在這個凸多邊形裡', '找 objective 最好的那一點');
  await step(tok);                                   // 20:02 profit x1 + 6x2 = c
  obj.push(ch.line(1, 6, 600, C.O, 0.02));
  sayc('profit：x1 + 6x2 = c', 'c 是一個會變的值');
  await step(tok);                                   // 20:25 dashed lines: shifted, different c
  for (const c of [1200, 1800]) { obj.push(ch.line(1, 6, c, C.O, 0.02)); await wt(tok, 300); }
  sayc('不同的 c → 平移的斜線', 'c 越大越好');
  await step(tok);                                   // 20:56 a line sweeping over the polygon
  sayc('objective 是一條斜線', '掃過整個 solution space');
  await step(tok);                                   // 21:21 the best is at a corner
  obj.push(ch.line(1, 6, 1900, C.R, 0.035));
  ch.dot(100, 300, C.R, '(100, 300)');
  sayc('最佳解一定落在多邊形的「角」上');
  await step(tok);                                   // 21:29 vertex = intersection of constraints
  sayc('這個角叫 vertex（頂點）', '是兩條 constraint 線的交點');
  await step(tok);                                   // 21:57 extremes happen at the vertices
  good('極值發生在頂點上', 1.6, 5.1);
  sayc('極值一定發生在 convex polygon 的頂點');
  void l1; void fill;
}]);

// 22:06 Simplex 的想法：沿著頂點爬山
FRAG.push(['bt-lp-climb', '線性規劃：simplex 沿頂點爬山（0 → 200 → 1400 → 1900）', async (tok) => {
  fresh([0, 3.4, 11.5], [0.6, 2.8, 0]);
  const ch = chocoChart();
  ch.line(1, 0, 200, C.B); ch.line(0, 1, 300, C.P); ch.line(1, 1, 400, C.PK);
  ch.poly(CHOCO, C.G, 0.3);
  const val = { '0,0': 0, '200,0': 200, '200,200': 1400, '100,300': 1900, '0,300': 1800 };
  const pn = panel(-4.6, 5.6, 0.55);
  let me = null;
  await step(tok);                                   // 22:06 how to find the optimum?
  sayc('怎麼找到最佳解？');
  await step(tok);                                   // 22:16 simplex method, 1947
  hd('Simplex method（1947）', -4.4, 6.2);
  sayc('Simplex method：1947 年就提出了');
  await step(tok);                                   // 22:24 like climbing a hill
  sayc('概念很簡單：爬山');
  await step(tok);                                   // 22:32 convex polygon; optimum at vertex → walk along edges
  CHOCO.forEach(([a, b]) => ch.dot(a, b, C.K));
  sayc('凸多邊形＋最佳解在頂點', '→ 沿著邊、從頂點走到頂點');
  await step(tok);                                   // 22:58 maximise → climb
  sayc('求最大值 → 往上爬');
  await step(tok);                                   // 23:13 start anywhere, go uphill
  sayc('從任何一個頂點出發，往山頂前進');
  await step(tok);                                   // 23:34 no neighbour higher → top → stop
  sayc('周圍沒有人比我高 → 已在山頂，停下');
  await step(tok);                                   // 23:49 start at the origin: all variables 0
  me = ch.dot(0, 0, C.R);
  sayc('從哪裡出發？原點', '所有變數都是 0，最好算');
  await step(tok);                                   // 24:16 the origin is a vertex; look at neighbours
  sayc('原點也是頂點', '看看相鄰的頂點：右邊、上面');
  await step(tok);                                   // 24:44 profit 0
  pn.add('(0, 0)：profit 0');
  sayc('此刻 profit = 0');
  await step(tok);                                   // 24:50 right: x1 = 200 → 200 → move right
  await ch.move(tok, me, 200, 0);
  pn.add('(200, 0)：profit 200');
  sayc('往右到 (200, 0)：profit 200', '比較高 → 往右');
  await step(tok);                                   // 25:04 going up is faster; fine
  sayc('往上爬會快一點', '但沒關係，先往右');
  await step(tok);                                   // 25:13 repeat: the neighbour above is higher
  sayc('重複：看臨近頂點有沒有更高的', '上面那個更高 → 前進');
  await step(tok);                                   // 25:38 1400
  await ch.move(tok, me, 200, 200);
  pn.add('(200, 200)：profit 1400');
  sayc('(200, 200)：200 + 1200 = 1400');
  await step(tok);                                   // 25:44 diagonal neighbour: 1900 → move
  await ch.move(tok, me, 100, 300);
  pn.add('(100, 300)：profit 1900');
  sayc('斜上方 (100, 300)：100 + 1800 = 1900', '更高 → 前進');
  await step(tok);                                   // 25:52 neighbours: left is 1800 < 1900
  ch.dot(0, 300, C.K, '1800');
  pn.add('鄰居 (0, 300)：1800 < 1900');
  sayc('右邊是剛爬上來的（較低）', '左邊 (0, 300) = 1800，也比較低');
  await step(tok);                                   // 26:11 stop: 1900 is the optimum
  glow(me, GREEN); pn.mark(3);
  sayc('沒有鄰居更高 → 停下', '最佳解 1900');
  await step(tok);                                   // 26:26 the old way: move the line in from infinity
  ch.line(1, 6, 1900, C.R, 0.035);
  sayc('以前的方法：把斜線從無限遠移過來', '碰到的第一個點就是最佳解');
  await step(tok);                                   // 26:46 simplex: climb along edges, stop at the top
  sayc('Simplex 不這樣做', '它沿著邊爬山，爬到最高點就停');
  await step(tok);                                   // 27:27 each iteration: look at neighbours, move or halt
  sayc('每個 iteration 都很單純', '看鄰居 → 更好就移過去，否則 halt');
}]);

// 28:15 multiplier → dual problem
FRAG.push(['bt-lp-dual', '線性規劃：multiplier 與 dual problem', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const L = panel(-4.0, 6.2, 0.58), R = panel(3.4, 6.2, 0.58);
  L.add('max x1 + 6x2', 'ptr'); L.add('① x1 ≤ 200'); L.add('② x2 ≤ 300'); L.add('③ x1 + x2 ≤ 400'); L.add('x1, x2 ≥ 0');
  const M = [tag('', 'pkt', -6.2, 6.2 - 0.58), tag('', 'pkt', -6.2, 6.2 - 1.16), tag('', 'pkt', -6.2, 6.2 - 1.74)];
  M.forEach((m) => showL(m, false));
  const setM = (a, b, c) => [a, b, c].forEach((v, i) => { txt(M[i], '× ' + v); showL(M[i], true); });
  let sum = null;
  await step(tok);                                   // 28:15 an interesting property: multipliers
  sayc('最佳化過程中一個有趣的性質', 'multiplier（乘數）');
  await step(tok);                                   // 28:32 maximise the profit
  L.mark(0);
  sayc('巧克力店是 maximization 問題');
  await step(tok);                                   // 28:50 an upper bound before solving
  sayc('還沒解出來之前', '想先知道最大值的 upper bound');
  await step(tok);                                   // 29:10 like max flow
  sayc('就像 maximum flow 時想找 upper bound');
  await step(tok);                                   // 29:25 lower the bound as far as possible
  sayc('upper bound 壓得越低越好', '壓到碰到最佳值 → 就找到解');
  await step(tok);                                   // 29:49 optimum (100, 300): 1900
  note('最佳解：x1 = 100、x2 = 300 → 1900', 0, 0.6);
  sayc('前面知道最佳解：(100, 300)，profit 1900');
  await step(tok);                                   // 30:00 build 1900 from the constraints?
  sayc('能不能用下面的 constraints', '「兜」出 1900 這個 bound？');
  await step(tok);                                   // 30:24 profit = x1 + 6x2
  sayc('目標：兜出 x1 + 6x2');
  await step(tok);                                   // 30:31 constraints are ≤ → upper bounds
  sayc('constraints 都是 ≤', '加起來就是 upper bound');
  await step(tok);                                   // 30:46 1 × ① + 6 × ②
  setM(1, 6, 0);
  sum = note('x1 + 6x2 ≤ 200 + 6·300 = 2000', 0, 1.4);
  sayc('① 用 1 倍、② 用 6 倍加起來', 'x1 + 6x2 ≤ 200 + 1800 = 2000');
  await step(tok);                                   // 31:09 never more than 2000
  sayc('所以最佳值絕對不超過 2000');
  await step(tok);                                   // 31:18 a better combination
  sayc('更厲害的兜法：放棄 ①');
  await step(tok);                                   // 31:53 5 × ② + 1 × ③ = 1900
  setM(0, 5, 1);
  txt(sum, 'x1 + 6x2 ≤ 5·300 + 400 = 1900');
  sayc('② 用 5 倍、③ 用 1 倍', 'x1 + 6x2 ≤ 1500 + 400 = 1900');
  await step(tok);                                   // 32:09 tight and reachable → optimal
  setCls(sum, 'good');
  sayc('1900 這個 bound 很緊，而且達得到', '→ 1900 就是最佳解');
  await step(tok);                                   // 32:24 optimum = combine constraints well
  sayc('找最佳解也可以看成', '適當組合 constraints 兜出最佳值');
  await step(tok);                                   // 32:52 the multiplier: the factor of each constraint
  sayc('每條 constraint 前面乘的倍數', '叫做 multiplier');
  await step(tok);                                   // 33:00 (1, 6, 0) gives 2000
  sayc('(1, 6, 0) → 兜出 2000');
  await step(tok);                                   // 33:37 (0, 5, 1) gives the optimum
  sayc('(0, 5, 1) → 兜出最佳的 1900');
  await step(tok);                                   // 33:51 find the multipliers for the tightest bound
  sayc('問題轉化成：找最合適的 multiplier', '讓 upper bound 最緊');
  await step(tok);                                   // 34:36 all constraints are ≤
  sayc('constraints 方向都統一成 ≤');
  await step(tok);                                   // 34:54 maximise → upper bound → multipliers ≥ 0
  sayc('要兜 upper bound', 'multiplier 必須 ≥ 0（不然不等號會反向）');
  await step(tok);                                   // 35:30 multipliers become variables y1, y2, y3
  setM('y1', 'y2', 'y3');
  sayc('multiplier 變成變數：y1、y2、y3');
  await step(tok);                                   // 35:52 y ≥ 0
  R.add('y1, y2, y3 ≥ 0');
  sayc('y1、y2、y3 都 ≥ 0');
  await step(tok);                                   // 36:38 x1 gets y1 + y3, x2 gets y2 + y3
  txt(sum, '(y1 + y3)x1 + (y2 + y3)x2 ≤ …');
  sayc('組合後 x1 的係數 = y1 + y3', 'x2 的係數 = y2 + y3');
  await step(tok);                                   // 37:08 right side 200y1 + 300y2 + 400y3
  txt(sum, '(y1 + y3)x1 + (y2 + y3)x2 ≤ 200y1 + 300y2 + 400y3');
  sayc('右邊 = 200y1 + 300y2 + 400y3');
  await step(tok);                                   // 37:35 x1 + 6x2 ≤ that
  sayc('希望它成為 x1 + 6x2 的 upper bound');
  await step(tok);                                   // 38:07 y1 + y3 ≥ 1, y2 + y3 ≥ 6
  R.add('y1 + y3 ≥ 1'); R.add('y2 + y3 ≥ 6');
  sayc('需要 y1 + y3 ≥ 1、y2 + y3 ≥ 6');
  await step(tok);                                   // 38:57 these are the constraints of the new problem
  sayc('這些就成了「求 multiplier」問題的 constraints');
  await step(tok);                                   // 39:09 objective: minimise 200y1 + 300y2 + 400y3
  const dobj = tag('min 200y1 + 300y2 + 400y3', 'ptr', 3.4, 6.8);
  sayc('upper bound 越小越好', 'min 200y1 + 300y2 + 400y3');
  await step(tok);                                   // 39:48 the original problem: primal
  hd('primal', -4.0, 6.9);
  sayc('原本要解的問題叫 primal problem');
  await step(tok);                                   // 40:03 the multiplier problem: dual (max ↔ min)
  hd('dual', 5.6, 6.9);
  sayc('求 multiplier 的問題叫 dual problem', 'primal 是 max → dual 是 min');
  await step(tok);                                   // 40:24 left primal, right dual
  sayc('左：primal（max profit）', '右：dual（min upper bound），也是 LP');
  await step(tok);                                   // 41:37 alternate; meet → done
  sayc('LP 的最佳化在兩者之間交錯進行', '左邊往上、右邊往下，碰在一起就結束');
  await step(tok);                                   // 42:22 primal (100, 300), dual (0, 5, 1)
  setM(0, 5, 1); setCls(dobj, 'ptr alt');
  good('primal (100, 300) = 1900 = dual (0, 5, 1)', 0, 0.6);
  sayc('primal 最佳 (100, 300)', 'dual 最佳 (0, 5, 1)，值都是 1900');
}]);

// 42:43 一般形式與 duality theorem
FRAG.push(['bt-lp-dualthm', '線性規劃：一般形式與 duality theorem', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const L = panel(-3.6, 6.0, 0.6), R = panel(3.6, 6.0, 0.6);
  const axis = () => { rod(V3(-5.5, 1.0, 0), V3(5.5, 1.0, 0), C.D, 0.03); tag('objective 的值 →', 'idx', 4.8, 0.6); };
  await step(tok);                                   // 42:43 primal and dual again
  hd('primal', -3.6, 6.7); hd('dual', 3.6, 6.7);
  sayc('回顧 primal 和 dual');
  await step(tok);                                   // 42:50 primal: maximise the profit
  L.add('max profit');
  sayc('primal：maximize profit');
  await step(tok);                                   // 43:08 dual: find multipliers
  R.add('找 multiplier 組合 constraints');
  sayc('dual：找 multiplier 去組合 constraints');
  await step(tok);                                   // 43:35 the smallest upper bound
  R.add('→ upper bound 越小越好');
  sayc('組出 objective 的 upper bound', '越小越好');
  await step(tok);                                   // 43:58 a min problem: dual gives a lower bound
  note('若 primal 是 min → dual 求 lower bound，越大越好', 0, 0.3);
  sayc('反過來：primal 是 min', 'dual 就求 lower bound，越大越好');
  await step(tok);                                   // 44:27 the generic form
  L.ls.forEach(kill); L.ls.length = 0; R.ls.forEach(kill); R.ls.length = 0;
  sayc('一般的寫法（矩陣形式）');
  await step(tok);                                   // 44:41 max cᵀx
  L.add('max cᵀx', 'ptr alt');
  sayc('primal：max cᵀx', 'c = objective 的係數');
  await step(tok);                                   // 45:02 Ax ≤ b, x ≥ 0
  L.add('Ax ≤ b'); L.add('x ≥ 0');
  sayc('subject to Ax ≤ b、x ≥ 0');
  await step(tok);                                   // 45:20 all in the same direction (≤)
  sayc('constraints 調整成同一方向（≤）');
  await step(tok);                                   // 45:36 dual: min yᵀb
  R.add('min yᵀb', 'ptr alt');
  sayc('dual：min yᵀb', 'b = 200、300、400 那些數');
  await step(tok);                                   // 46:29 yᵀA ≥ cᵀ
  R.add('yᵀA ≥ cᵀ');
  sayc('yᵀA ≥ cᵀ', '組出來的係數要蓋過 objective 係數（1、6）');
  await step(tok);                                   // 47:13 y ≥ 0
  R.add('y ≥ 0');
  sayc('multiplier 都 ≥ 0：y ≥ 0');
  await step(tok);                                   // 47:30 duality theorem: equal optima
  good('Duality theorem：primal 有最佳解 ⇒ dual 也有，且兩個最佳值相等', 0, 2.2);
  sayc('Duality theorem：LP 有最佳解', '它的 dual 也有，而且兩個最佳值相等');
  await step(tok);                                   // 48:00 picture: primal values ≤ optimum
  axis();
  const p = cube('primal', C.B, [1.4, 0.5, 0.5], -3.6, 1.0, 0.3);
  sayc('示意：primal 的可行值都 ≤ 最佳值', '在左側，越往右越好');
  await step(tok);                                   // 48:50 dual values ≥ the optimum
  const d = cube('dual', C.O, [1.4, 0.5, 0.5], 3.6, 1.0, 0.3);
  sayc('dual 求的是 upper bound', '一定在右側');
  await step(tok);                                   // 49:11 a tighter bound is more informative
  await anim(tok, 1200, (u) => { p.position.x = -3.6 + 2.0 * u; d.position.x = 3.6 - 2.0 * u; });
  sayc('upper bound 越鬆越沒資訊', '希望壓得越緊越好');
  await step(tok);                                   // 49:26 they merge: gap 0
  await anim(tok, 900, (u) => { p.position.x = -1.6 + 0.85 * u; d.position.x = 1.6 - 0.85 * u; });
  glow(p, GREEN); glow(d, GREEN);
  sayc('最後兩點 merge 在一起', 'gap = 0 → 最佳化結束');
  await step(tok);                                   // 49:50 LP alternates between primal and dual
  sayc('LP 的最佳化', '就是在 primal 與 dual 之間交錯切換');
}]);

// 50:16 和 max flow / min cut 很像
FRAG.push(['bt-lp-flow', '線性規劃：max flow = min cut 也是對偶', async (tok) => {
  fresh([0, 4.4, 12], [0, 2.4, 0]);
  await step(tok);                                   // 50:16 like the max-flow problem
  hd('max flow ↔ min cut', 0, 5.2);
  sayc('和 duality 很像的：maximum network flow');
  await step(tok);                                   // 50:28 its dual is min cut
  bx('max flow', C.B, -2.6, 3.0, 0, 2.4, 2, 0.6, 0.8); bx('min cut', C.O, 2.6, 3.0, 0, 2.4, 2, 0.6, 0.8);
  sayc('max flow 的對偶問題是 min cut');
  await step(tok);                                   // 50:45 finding max flow also finds a min cut
  sayc('求到 max flow 的同時', '也找到一個 min cut');
  await step(tok);                                   // 51:01 every cut's capacity bounds the flow
  note('每個 cut 的 capacity 都是 flow 的 upper bound', 0, 1.8);
  sayc('每個 cut 的 capacity', '都是 max flow 的 upper bound');
  await step(tok);                                   // 51:06 equal at the optimum
  good('max flow = min cut', 0, 1.0);
  sayc('最佳時兩者相等', '這就是一種 primal–dual 關係');
}]);

// 51:14 Simplex 的幾何：頂點、鄰居
FRAG.push(['bt-lp-vertex', '線性規劃：頂點與鄰居（n 條 constraint 定一點）', async (tok) => {
  fresh([0, 4.8, 12.5], [0, 2.6, 0]);
  const pn = panel(3.2, 6.0, 0.6);
  // a small polytope: a box with a cut corner, faces numbered like the slide
  const pts = { A: [-2.0, 2.6, 0.6], B: [-4.0, 2.6, 0.6], C: [-2.0, 2.6, -1.4], D: [-4.0, 2.6, -1.4], E: [-1.2, 1.6, 1.0], F: [-4.0, 0.3, 1.0], G: [-1.2, 0.3, 1.0], H: [-1.2, 0.3, -1.4] };
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['A', 'E'], ['B', 'F'], ['E', 'G'], ['F', 'G'], ['C', 'H'], ['G', 'H'], ['E', 'H']];
  let g = null;
  await step(tok);                                   // 51:14 simplex: hill climbing
  sayc('Simplex 在解的過程就是爬山');
  await step(tok);                                   // 51:32 2 variables → 2D, 3 → 3D
  sayc('2 個變數 → 平面', '3 個變數 → 立體空間');
  await step(tok);                                   // 51:48 n ≥ 4: imagine
  sayc('4 維以上畫不出來', '用想像的');
  await step(tok);                                   // 51:59 every constraint → a half space
  pn.add('每條 constraint → 一個 half space');
  sayc('每條 constraint 圍出一個 half space（半空間）');
  await step(tok);                                   // 52:12 together → a convex polytope
  g = graph(pts, edges, { size: [0.3, 0.3, 0.3], r: 0.03 });
  pn.add('全部合起來 → 凸多面體');
  sayc('合起來 → 凸的多邊形 / 多面體');
  await step(tok);                                   // 52:26 climb along the edges; each vertex has a value
  sayc('沿著邊角爬山', '每個頂點都有一個 objective 值');
  await step(tok);                                   // 52:36 at each vertex look at the neighbours
  glow(g.N.A, GOLD);
  sayc('到一個頂點就看隔壁', '有比較好就爬過去');
  await step(tok);                                   // 52:48 all neighbours lower → stop
  sayc('鄰居都比較低 → 到頂了，停');
  await step(tok);                                   // 53:02 the same in 3D
  sayc('3D 也一樣：從任一點出發沿著邊爬');
  await step(tok);                                   // 53:29 each iteration: a start vertex
  pn.add('① 選一個頂點當起點');
  sayc('每個 iteration：先有一個頂點');
  await step(tok);                                   // 53:50 a better neighbour → move there
  pn.add('② 有更好的鄰居 → 移過去');
  sayc('鄰居比較好 → 移到那個頂點，重複');
  await step(tok);                                   // 54:07 none better → halt
  pn.add('③ 沒有 → halt（最佳解）');
  sayc('找不到更好的鄰居 → halt');
  await step(tok);                                   // 54:24 a 3D example: x1, x2, x3
  sayc('立體的例子：三個變數 x1、x2、x3', '很多 constraints');
  await step(tok);                                   // 54:43 faces are numbered; letters are vertices
  Object.keys(pts).forEach((k) => tag(k, 'ptr', pts[k][0], pts[k][1] + 0.45, pts[k][2]));
  sayc('每一面有編號，英文字母是頂點');
  await step(tok);                                   // 55:04 2D: two constraints make a vertex
  sayc('2D：兩條線（兩個 constraint）交出一個頂點');
  await step(tok);                                   // 55:25 3D: three constraints; A = 2, 3, 7
  glow(g.N.A, GOLD);
  const ta = note('A = 面 2、3、7 交出來', -2.0, 3.4, 0.6);
  sayc('3D 要三個 constraint 交出一點', '例：A 由面 2、3、7 圍出');
  await step(tok);                                   // 55:48 too few: 4 and 6 only a line
  rod(V3(...pts.E), V3(...pts.G), C.R, 0.06);
  sayc('constraint 不夠：4、6 兩面只能定出一條線', '定不出頂點');
  await step(tok);                                   // 56:13 choose a subset of constraints → a vertex
  pn.add('n 維：選 n 條 constraint → 一個頂點');
  sayc('選出 n 條 constraint 就得到一個頂點');
  await step(tok);                                   // 56:33 neighbours share n − 1 constraints
  pn.add('相鄰頂點：共用 n − 1 條、只差 1 條');
  sayc('相鄰的兩個頂點', '有 n − 1 條 constraint 相同、一條不同');
  await step(tok);                                   // 57:21 A = {2,3,7} → C = {1,3,7}
  glow(g.N.C, GOLD);
  txt(ta, 'A = {2, 3, 7} → C = {1, 3, 7}');
  rod(V3(...pts.A), V3(...pts.C), C.O, 0.07);
  sayc('A 放掉 2、換成 1 → 得到 C', '兩點共用 3、7，在同一條邊上');
  await step(tok);                                   // 57:53 each iteration: check, then halt or move
  sayc('每個 iteration 兩件事', '檢查當下是不是最好 → 是就 halt，否則移到更好的鄰居');
}]);

// 58:29 從原點出發、座標轉換
FRAG.push(['bt-lp-origin', '線性規劃：simplex 從原點出發、座標轉換', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const pn = panel(2.8, 6.2, 0.6);
  const ch = lpChart(-5.6, 0.4, 0.75, 5.5, 5.5);
  ch.poly([[0, 0], [2, 0], [3.4, 2.8], [1, 4], [0, 3]], C.G, 0.3);
  let me = null;
  await step(tok);                                   // 58:29 how to pick the first point?
  sayc('第一個點要怎麼選？');
  await step(tok);                                   // 58:38 just the origin: all zero
  me = ch.dot(0, 0, C.R, '原點');
  sayc('不用想太多：直接從原點出發', '所有變數都是 0');
  await step(tok);                                   // 59:02 the objective there is easy
  pn.add('原點：objective 值 = 0（全部代 0）');
  sayc('原點的 objective 值很容易算');
  await step(tok);                                   // 59:27 is the origin optimal?
  sayc('原點是不是最佳解？也很容易判斷');
  await step(tok);                                   // 59:40 c1x1 + c2x2 + c3x3: all ≤ 0 → optimal
  pn.add('max c1x1 + c2x2 + …：係數全 ≤ 0 → 原點最佳', 'ptr alt');
  sayc('objective = c1x1 + c2x2 + …', '係數全部 ≤ 0 → 原點就是最大值');
  await step(tok);                                   // 1:00:10 check the coefficients; halt
  sayc('所以只要看係數是不是都 ≤ 0', '是 → halt');
  await step(tok);                                   // 1:00:23 otherwise: release a variable, increase it
  pn.add('不是 → 選一個變數讓它增加');
  await ch.move(tok, me, 0, 1.5);
  sayc('不是最佳 → 找鄰居', '放掉某個變數，讓它增加');
  await step(tok);                                   // 1:00:55 a constraint gets tight → a vertex
  await ch.move(tok, me, 0, 3);
  pn.add('增加到某條 constraint 變緊 → 到達鄰居頂點');
  sayc('增加到某條 constraint 快被破壞的那一刻', '就到達相鄰的頂點');
  await step(tok);                                   // 1:01:37 a coordinate transformation
  sayc('另一個機制：座標轉換');
  await step(tok);                                   // 1:02:04 the current vertex is always the origin
  const ax = [rod(ch.P(0, 3), ch.P(1.5, 4.5), C.O, 0.03), rod(ch.P(0, 3), ch.P(1.5, 3), C.O, 0.03)];
  pn.add('轉換後：目前的頂點永遠在新的原點');
  sayc('每到一個頂點就換座標', '讓它變成新的原點');
  await step(tok);                                   // 1:02:21 the check stays easy
  sayc('好處：還是只要檢查係數是不是負的');
  await step(tok);                                   // 1:02:41 not optimal → release → next vertex
  sayc('不是最佳 → 放掉一個變數讓它增加', '到下一個比較好的頂點');
  await step(tok);                                   // 1:02:58 transform → a new LP
  sayc('套用座標轉換 → 得到一個新的 LP');
  await step(tok);                                   // 1:03:31 check the coefficients again, and so on
  sayc('再檢查新 LP 的係數', '依此類推');
  await step(tok);                                   // 1:04:01 new variables yi = bi − aix
  pn.add('新變數 yᵢ = bᵢ − aᵢx（到該 constraint 的距離）', 'ptr alt');
  sayc('新變數 yᵢ = bᵢ − aᵢx', '來自讓頂點變緊的那條 constraint');
  await step(tok);                                   // 1:04:19 applied to all constraints
  sayc('所有 constraints 都做一樣的轉換', '原點就搬過去了');
  void ax;
}]);

// 1:04:41 Simplex 例題：max 2x1 + 5x2
FRAG.push(['bt-lp-simplex-ex', '線性規劃：simplex 例題 max 2x1 + 5x2 = 22', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const ch = lpChart(-5.8, 0.4, 0.78, 5.5, 5.5);
  const pn = panel(3.0, 6.4, 0.56);
  let me = null; const lines = [];
  await step(tok);                                   // 1:04:41 an example
  sayc('用例子看 simplex 怎麼做');
  await step(tok);                                   // 1:04:54 maximisation (min is symmetric)
  sayc('一樣是 maximization', 'minimization 對稱地修改即可');
  await step(tok);                                   // 1:05:18 max 2x1 + 5x2 with five constraints
  pn.add('max 2x1 + 5x2', 'ptr'); pn.add('① 2x1 − x2 ≤ 4'); pn.add('② x1 + 2x2 ≤ 9'); pn.add('③ −x1 + x2 ≤ 3'); pn.add('④ x1 ≥ 0'); pn.add('⑤ x2 ≥ 0');
  sayc('max 2x1 + 5x2，五條 constraints');
  await step(tok);                                   // 1:05:28 the feasible region: a pentagon
  lines.push(ch.line(2, -1, 4, C.B), ch.line(1, 2, 9, C.P), ch.line(-1, 1, 3, C.PK));
  ch.poly([[0, 0], [2, 0], [3.4, 2.8], [1, 4], [0, 3]], C.G, 0.3);
  sayc('圍出的可行區域是一個五邊形');
  await step(tok);                                   // 1:05:38 start at the origin
  me = ch.dot(0, 0, C.R, '(0, 0)');
  sayc('起點：原點 x1 = x2 = 0');
  await step(tok);                                   // 1:05:55 made by constraints ④ ⑤
  pn.mark(4); pn.mark(5);
  sayc('原點是 ④、⑤ 兩條 constraint 的交點');
  await step(tok);                                   // 1:06:11 objective value 0
  sayc('objective 值 = 0');
  await step(tok);                                   // 1:06:20 optimal? coefficients positive → no
  sayc('是最佳解嗎？係數 2、5 是正的 → 不是');
  await step(tok);                                   // 1:06:39 release x2: increase it
  sayc('放掉一個變數：讓 x2 增加');
  await step(tok);                                   // 1:06:52 loosen constraint ⑤ → move up
  pn.mark(5, 'note');
  await ch.move(tok, me, 0, 1.5);
  sayc('放鬆第 ⑤ 條，往上移動');
  await step(tok);                                   // 1:07:07 other constraints tighten: ③④ vertex
  await ch.move(tok, me, 0, 3); pn.mark(3);
  sayc('其他 constraint 變緊', '最先碰到 ③、④ 的交點');
  await step(tok);                                   // 1:07:33 x2 = 3
  me.userData.t && txt(me.userData.t, '(0, 3)');
  sayc('停在 x2 = 3：頂點 (0, 3)，值 15');
  await step(tok);                                   // 1:07:44 next iteration: (0, 3) is the new origin
  sayc('下一個 iteration', '把 (0, 3) 當成新的原點');
  await step(tok);                                   // 1:08:03 coordinate transformation
  sayc('做座標轉換');
  await step(tok);                                   // 1:08:21 y1 = x1, y2 = 3 + x1 − x2
  const tr = pn.add('y1 = x1，y2 = 3 + x1 − x2', 'ptr alt');
  sayc('由 ③、④：y1 = x1', 'y2 = 3 + x1 − x2');
  await step(tok);                                   // 1:08:46 rewrite the LP in y1, y2
  const ob = pn.add('max 15 + 7y1 − 5y2', 'good');
  sayc('把 LP 改寫成 y1、y2', 'objective = 15 + 7y1 − 5y2');
  await step(tok);                                   // 1:09:10 y = 0 is the origin; +7 → not optimal
  sayc('y1 = y2 = 0 是新原點', '係數還有正的（+7）→ 還不是最佳');
  await step(tok);                                   // 1:09:31 increase y1 → the next vertex
  await ch.move(tok, me, 1, 4);
  me.userData.t && txt(me.userData.t, '(1, 4)');
  sayc('讓 y1 增加 → 到另一個頂點 (1, 4)');
  await step(tok);                                   // 1:09:45 constraints ② ③ → z1, z2
  pn.mark(2); pn.mark(3);
  txt(tr, 'z1、z2：由 ②、③ 轉換');
  sayc('這個頂點由 ②、③ 交出', '再轉換成 z1、z2');
  await step(tok);                                   // 1:10:14 all coefficients negative → optimal
  txt(ob, 'max 22 − (7/3)z1 − (1/3)z2');
  sayc('objective = 22 − (7/3)z1 − (1/3)z2', '係數全是負的 → 最佳解');
  await step(tok);                                   // 1:10:35 stop: (1, 4), value 22
  glow(me, GREEN);
  good('最佳解 (1, 4)：2 + 20 = 22', 3.0, 0.5);
  sayc('停下：最佳解 x1 = 1、x2 = 4', '2·1 + 5·4 = 22');
}]);

// 1:10:51 Simplex 小結
FRAG.push(['bt-lp-recap', '線性規劃：simplex 小結', async (tok) => {
  fresh([0, 4.4, 12], [0, 2.6, 0]);
  const pn = panel(0, 6.0, 0.62);
  await step(tok);                                   // 1:10:51 the process is simple
  hd('Simplex method 小結', 0, 6.8);
  sayc('Simplex 的操作流程很單純');
  await step(tok);                                   // 1:11:04 idea: convex polygon, optimum at a vertex
  pn.add('可行區域是凸多邊形；最佳解一定在頂點');
  sayc('想法：可行區域是凸的', '最佳解一定在頂點');
  await step(tok);                                   // 1:11:23 climb along the edges
  pn.add('沿著邊爬山，爬到山頂就停');
  sayc('沿著邊線爬到山頂');
  await step(tok);                                   // 1:11:30 check each vertex against its neighbours
  pn.add('當下頂點比所有鄰居好 → 停');
  sayc('凸的 → 只要確認比所有鄰居好就能停');
  await step(tok);                                   // 1:11:52 systematic: start at the origin
  pn.add('① 從原點出發');
  sayc('實作很系統化：從原點開始');
  await step(tok);                                   // 1:12:15 check if the origin is optimal
  pn.add('② 檢查係數：全 ≤ 0 → 最佳');
  sayc('檢查原點是不是最佳解');
  await step(tok);                                   // 1:12:26 else release a variable → neighbour
  pn.add('③ 否則放掉一個變數 → 到鄰居頂點');
  sayc('不是 → 放掉一個變數，走到鄰居');
  await step(tok);                                   // 1:12:48 coordinate transform → new origin
  pn.add('④ 座標轉換：鄰居變成新原點，回到 ②');
  sayc('座標轉換，讓新頂點變成原點');
  await step(tok);                                   // 1:13:05 until all coefficients negative
  sayc('直到係數全是負的', '保證當下的原點就是最佳解');
  await step(tok);                                   // 1:13:35 the same function called repeatedly
  sayc('同一套函式反覆呼叫就好', '這是它漂亮的地方');
  await step(tok);                                   // 1:13:49 origin not feasible? shift first
  note('原點不在可行區域？先做一次 shifting', 0, 1.2);
  sayc('一開始原點不可行怎麼辦？', '先平移，把某個頂點搬到原點');
}]);

// 1:14:19 Standard form
FRAG.push(['bt-lp-standard', '線性規劃：standard form、slack variable', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const L = panel(-3.8, 6.0, 0.6), R = panel(3.6, 6.0, 0.6);
  await step(tok);                                   // 1:14:19 standard form
  hd('Standard form（標準式）', 0, 6.8);
  sayc('LP 有一種標準格式：standard form');
  await step(tok);                                   // 1:14:37 why: LPs come in many shapes
  sayc('為什麼需要？', '大家寫出的 LP 長相不一');
  await step(tok);                                   // 1:14:52 objective: max or min
  L.add('objective：max 或 min');
  sayc('objective 可能求最大或最小');
  await step(tok);                                   // 1:15:00 constraints: = or ≤ / ≥
  L.add('constraint：等式或不等式');
  sayc('constraint 可能是等式或不等式');
  await step(tok);                                   // 1:15:11 variables: sign restrictions
  L.add('變數：可能限定正、負');
  sayc('變數可能有正負限制');
  await step(tok);                                   // 1:15:28 solvers want one form
  sayc('寫 solver 會遇到很多例外', '→ 統一成 standard form');
  await step(tok);                                   // 1:15:45 minimisation
  R.add('① objective：minimize', 'ptr alt');
  sayc('① objective 一律 minimize');
  await step(tok);                                   // 1:15:55 all constraints are equalities
  R.add('② constraints 全是等式', 'ptr alt');
  sayc('② constraints 全部是等式');
  await step(tok);                                   // 1:16:02 all variables non-negative
  R.add('③ 變數全部 ≥ 0', 'ptr alt');
  sayc('③ 變數全部 non-negative');
  await step(tok);                                   // 1:16:14 the chocolate LP doesn't fit
  L.ls.forEach(kill); L.ls.length = 0;
  L.add('max x1 + 6x2', 'ptr'); L.add('x1 ≤ 200'); L.add('x2 ≤ 300'); L.add('x1 + x2 ≤ 400'); L.add('x1, x2 ≥ 0');
  sayc('巧克力工廠的 LP 不符合 standard form');
  await step(tok);                                   // 1:16:30 max → min: multiply by −1
  txt(L.ls[0], 'min −x1 − 6x2'); L.mark(0);
  sayc('max → min：乘上負號', 'max x1 + 6x2 = min −x1 − 6x2');
  await step(tok);                                   // 1:16:55 x ≥ 0 is fine
  L.mark(4, 'good');
  sayc('x1, x2 ≥ 0 已經符合');
  await step(tok);                                   // 1:17:09 three inequalities → slack variables
  sayc('三條不等式 → 引進 slack variable');
  await step(tok);                                   // 1:17:23 x1 ≤ 200 → x1 + s1 = 200, s1 ≥ 0
  txt(L.ls[1], 'x1 + s1 = 200'); L.mark(1);
  note('s1 ≥ 0：補到 200 的「空隙」', -3.8, 0.4, 1.6);
  sayc('x1 ≤ 200 ⇔ x1 + s1 = 200，s1 ≥ 0', 's1 就是「還差多少」');
  await step(tok);                                   // 1:17:50 each ≤ gets a slack → equality
  txt(L.ls[2], 'x2 + s2 = 300'); txt(L.ls[3], 'x1 + x2 + s3 = 400'); L.mark(2); L.mark(3);
  sayc('每條 ≤ 都加一個 slack variable', '不等式變等式');
  await step(tok);                                   // 1:18:10 slack variables ≥ 0; more variables
  txt(L.ls[4], 'x1, x2, s1, s2, s3 ≥ 0');
  sayc('slack variable 也要 ≥ 0', 'decision variable 變多了');
  await step(tok);                                   // 1:18:34 wrong direction → negate
  sayc('方向不對（≥）→ 乘負號轉過來');
  await step(tok);                                   // 1:18:57 solvers use the standard form
  sayc('solver 都吃 standard form', '解完再換回原問題的答案');
}]);

// ════════ eGSXsaJ-BlY（MIT 6.006 Rec 8：PSet 3 的 sweep line、range index） ════════
// 字幕實際內容：sweep line 的事件（[x, 0/1, id, 'add'/'query', wire]）與字典序排序、range index
// （未排序陣列 vs 排序陣列、count(4, 11) 的 off-by-one）、KeyWirePair 與 ±∞ 的 wire id、
// comparison model 的下界、BST 的 list(l, h) = LCA + node-list，時間 O(h + i)。
// wires in the z = 0 plane: X ∈ [−100, 100], Y ∈ [−100, 100]
const WX = (x) => x / 26, WY = (y) => 3.1 + y / 38;
const WIRES = [
  { id: 0, h: true, y: 60, x0: -100, x1: 60 }, { id: 1, h: true, y: 20, x0: -95, x1: 80 },
  { id: 2, h: true, y: -20, x0: -90, x1: 10 }, { id: 3, h: true, y: -60, x0: -50, x1: 90 },
  { id: 4, h: false, x: -50, y0: -80, y1: 80 }, { id: 5, h: false, x: 30, y0: -40, y1: 50 },
];
function wireWorld(list = WIRES) {
  const R = {};
  for (const w of list) {
    R[w.id] = w.h ? rod(V3(WX(w.x0), WY(w.y), 0), V3(WX(w.x1), WY(w.y), 0), C.B, 0.05) : rod(V3(WX(w.x), WY(w.y0), 0), V3(WX(w.x), WY(w.y1), 0), C.O, 0.05);
    const t = tag('w' + w.id, 'idx', w.h ? WX(w.x0) - 0.35 : WX(w.x), w.h ? WY(w.y) : WY(w.y1) + 0.3); R[w.id].userData.t = t;
  }
  return R;
}
const wcol = (R, id, c) => R[id].material.color.set(c);
function sweepLine(x0 = -4.2) { const s = rod(V3(x0, WY(-100), 0.05), V3(x0, WY(100), 0.05), C.R, 0.035); return s; }
async function sweepTo(tok, s, x, ms = 700) { const a = s.position.x; await anim(tok, ms, (u) => { s.position.x = a + (x - a) * u; }); }
const ARR = [2, 3, 5, 8, 11];
function arrView(keys, x0 = -2.4, y = 2.6, dx = 1.2) {
  const cells = keys.map((k, i) => bx(k, C.B, x0 + i * dx, y, 0, 1.0, 0, 0.7, 0.7));
  keys.forEach((k, i) => tag(String(i), 'idx', x0 + i * dx, y - 0.65));
  return cells;
}
// the BST of the recitation: 8 / 3 11 / 2 5 13
const BSTP = { 8: [0, 5.6], 3: [-2.6, 4.2], 11: [2.6, 4.2], 2: [-3.9, 2.8], 5: [-1.3, 2.8], 13: [3.9, 2.8] };
function bstWorld() {
  const N = {};
  for (const k in BSTP) N[k] = cube(k, C.B, [0.8, 0.6, 0.6], BSTP[k][0], BSTP[k][1], 0);
  [[8, 3], [8, 11], [3, 2], [3, 5], [11, 13]].forEach(([a, b]) => rod(V3(BSTP[a][0], BSTP[a][1] - 0.3, 0), V3(BSTP[b][0], BSTP[b][1] + 0.3, 0), EDGE, 0.04));
  return N;
}

// 1:23 給的演算法：先加所有水平線，再對每條垂直線查詢
FRAG.push(['bt-mit8-given', 'Sweep line：PSet 給的慢演算法', async (tok) => {
  fresh([0, 3.4, 11], [0, 3.0, 0]);
  let R = null;
  await step(tok);                                   // 1:23 sweep line algorithms
  hd('Sweep line algorithms', 0, 6.9);
  sayc('先談 sweep line（掃描線）演算法');
  await step(tok);                                   // 1:35 the given one is horribly inefficient
  sayc('作業給的版本效率非常差');
  await step(tok);                                   // 1:38 some line segments
  R = wireWorld();
  sayc('平面上有一些水平、垂直的線段（wires）');
  await step(tok);                                   // 2:01 find the intersections
  sayc('要找出它們的交點');
  await step(tok);                                   // 2:09 what does the given algorithm do?
  sayc('給的演算法在做什麼？看它輸出的 trace');
  await step(tok);                                   // 2:22 horizontal lines first, then vertical
  sayc('它先跑過所有水平線，再跑所有垂直線');
  await step(tok);                                   // 2:32 bolded = added to the range index
  [0, 1, 2, 3].forEach((i) => { R[i].scale.x = R[i].scale.z = 1.8; });
  sayc('水平線變粗：被加進 range index');
  await step(tok);                                   // 2:39 one: add all horizontal lines
  note('① 所有水平線加進 range index', 3.6, 6.3);
  sayc('第一步：所有水平線加進 range index');
  await step(tok);                                   // 2:50 then vertical lines: look for intersections
  wcol(R, 4, C.R);
  sayc('接著看垂直線：找交點');
  await step(tok);                                   // 2:55 blue square = range queried, green = answers
  const box = P.ghostBox(C.B, 0.4, WY(80) - WY(-80), 0.3); box.position.set(WX(-50), (WY(80) + WY(-80)) / 2, 0);
  [0, 1, 2].forEach((i) => wcol(R, i, C.G));
  sayc('藍框 = 查詢的範圍（range query）', '綠色線段 = 查到的答案');
  await step(tok);                                   // 3:12 add all, then query
  note('② 每條垂直線做一次 query', 3.6, 5.6);
  sayc('先全部加進去，再逐條垂直線 query');
}]);

// 3:21 sweep line 的概念：只在「事件」發生時停下
FRAG.push(['bt-mit8-sweep', 'Sweep line：只在事件發生時模擬', async (tok) => {
  fresh([0, 3.4, 11], [0, 3.0, 0]);
  const R = wireWorld();
  let s = null;
  await step(tok);                                   // 3:21 geometric inputs, e.g. lines
  sayc('sweep line 演算法：輸入是幾何物件', '例如一堆線段');
  await step(tok);                                   // 3:27 a vertical line swept −∞ → +∞
  s = sweepLine(-4.6);
  await sweepTo(tok, s, 4.4, 2000);
  sayc('概念上：一條垂直線從 −∞ 掃到 +∞');
  await step(tok);                                   // 3:35 sweeping continuously in code takes forever
  sayc('真的在程式裡連續地掃，會跑不完');
  await step(tok);                                   // 3:43 know when something interesting happens
  s.position.x = 0;
  sayc('做法：事先知道「有事情發生」的位置', '只在那些點模擬');
  await step(tok);                                   // 3:55 at −∞: horizontal segments added
  s.position.x = WX(-100) - 0.4 - WX(0) * 0;
  [0, 1, 2, 3].forEach((i) => wcol(R, i, C.G));
  sayc('一開始（最左邊）：所有水平線加進 range index');
  await step(tok);                                   // 4:01 hits a vertical segment → a query
  await sweepTo(tok, s, WX(-50), 900); wcol(R, 4, C.R);
  sayc('掃到垂直線 → 做一次 query');
  await step(tok);                                   // 4:10 it stops only at those times
  await sweepTo(tok, s, WX(30), 700); wcol(R, 5, C.R);
  sayc('只在開頭、和每條垂直線的位置停下');
  await step(tok);                                   // 4:24 known ahead: a list of coordinates
  const ev = [tag('x = −100：add', 'note', 3.6, 6.4), tag('x = −50：query', 'note', 3.6, 5.8), tag('x = 30：query', 'note', 3.6, 5.2)];
  sayc('事先就知道 → 列出這些 x 座標（事件）');
  await step(tok);                                   // 4:31 sort them, then simulate in order
  ev.forEach((e) => setCls(e, 'ptr alt'));
  sayc('排序後依序處理', '就模擬出掃描線的行為');
}]);

// 4:37 事件的長相：[x, 0/1, id, 'add'/'query', wire]
FRAG.push(['bt-mit8-events', 'Sweep line：事件向量 [x, 0/1, id, 型別, wire]', async (tok) => {
  fresh([0, 3.4, 11], [0, 3.0, 0]);
  const R = wireWorld();
  const vx = (i) => -3.0 + i * 1.5;
  const add = []; const q = [];
  const cell = (arr, i, t, y, c = C.B, w = 1.3) => { if (arr[i]) kill(arr[i]); arr[i] = bx(t, c, vx(i), y, 1.2, w, 0, 0.5, 0.5); };
  await step(tok);                                   // 4:37 events_from_layer compiles a list of events
  sayc('events_from_layer：整理出事件清單');
  await step(tok);                                   // 4:45 first key: the x coordinate
  sayc('每個事件的第一個 key 是 x 座標');
  await step(tok);                                   // 4:56 sort the list → process in order
  sayc('把事件排序 → 依序處理');
  await step(tok);                                   // 5:08 what does an event for a horizontal wire look like?
  wcol(R, 0, C.G);
  sayc('水平 wire 的事件長什麼樣？');
  await step(tok);                                   // 5:21 a Python list — call it a vector
  hd('add 事件', -4.8, 1.0, 1.2);
  sayc('是一個 Python list', '老師叫它 vector，免得和事件清單混淆');
  await step(tok);                                   // 5:31 first: the leftmost point, −100
  [0, 1, 2, 3].forEach((i) => tag(String(WIRES[i].x0), 'ptr', WX(WIRES[i].x0), WY(WIRES[i].y) + 0.35));
  cell(add, 0, '−100', 1.0);
  sayc('第一格：所有線段最左邊的 x', '−100、−95、−90、−50 → 取 −100');
  await step(tok);                                   // 5:58 computed on line 4: the minimum
  sayc('第 4 行：掃過所有線段的 x，取最小');
  await step(tok);                                   // 6:12 next: 0
  cell(add, 1, '0', 1.0);
  sayc('下一格：0');
  await step(tok);                                   // 6:17 a wire id: unique, 0..n
  cell(add, 2, 'id 0', 1.0);
  sayc('再來是 wire ID', '每條 wire 一個獨一無二的編號');
  await step(tok);                                   // 6:31 'add', then the wire object
  cell(add, 3, "'add'", 1.0); cell(add, 4, 'wire', 1.0);
  sayc("然後是字串 'add'，最後是 wire 物件");
  await step(tok);                                   // 6:45 a vertical wire?
  wcol(R, 4, C.R);
  hd('query 事件', -4.8, 0.2, 1.2);
  sayc('垂直 wire 的事件呢？');
  await step(tok);                                   // 7:08 same x everywhere: −50
  cell(q, 0, '−50', 0.2, C.O);
  sayc('垂直線上每點的 x 都一樣', '這條在 −50');
  await step(tok);                                   // 7:27 then a 1
  cell(q, 1, '1', 0.2, C.O);
  sayc('下一格：1');
  await step(tok);                                   // 7:30 id 4, 'query', the wire
  cell(q, 2, 'id 4', 0.2, C.O); cell(q, 3, "'query'", 0.2, C.O); cell(q, 4, 'wire', 0.2, C.O);
  sayc("wire ID 4、'query'、wire 物件");
}]);

// 7:51 字典序排序
FRAG.push(['bt-mit8-sort', 'Sweep line：Python list 的字典序比較', async (tok) => {
  fresh([0, 3.6, 11], [0, 2.6, 0]);
  const rows = [];
  const row = (vals, y) => vals.map((v, i) => bx(v, C.B, -1.2 + i * 1.2, y, 0, 1.0, 2, 0.6, 0.6));
  await step(tok);                                   // 7:51 sort is called in __init__
  sayc('事件清單組好之後，在 __init__ 裡呼叫 sort');
  await step(tok);                                   // 8:00 reordered by an ordering relationship
  sayc('依照某個大小關係重新排列', 'Python 的 list 怎麼比大小？');
  await step(tok);                                   // 8:24 [1,2,3], [1,3,2], [2,1,2]
  rows.push(row([1, 2, 3], 4.6), row([1, 3, 2], 3.4), row([2, 1, 2], 2.2));
  sayc('例：[1, 2, 3]、[1, 3, 2]、[2, 1, 2]');
  await step(tok);                                   // 8:38 first element: different → the smaller wins
  [0, 1, 2].forEach((r) => glow(rows[r][0], GOLD));
  note('[1, 2, 3] < [2, 1, 2]：第一格 1 < 2', 0, 1.0);
  sayc('先比第一格', '不同的話，第一格小的就比較小');
  await step(tok);                                   // 8:57 equal → next element … to the end
  [0, 1, 2].forEach((r) => glow(rows[r][0], null)); glow(rows[0][1], GOLD); glow(rows[1][1], GOLD);
  note('[1, 2, 3] < [1, 3, 2]：第一格一樣，看第二格', 0, 0.3);
  sayc('第一格一樣，就比下一格', '一直比到分出大小');
  await step(tok);                                   // 9:09 lexicographic = dictionary order
  hd('lexicographic order（字典序）', 0, 6.0);
  sayc('這叫 lexicographic comparison', '和字典裡排單字的順序一樣');
  await step(tok);                                   // 9:26 events are built so sort orders them right
  sayc('事件設計成這種長相', '就是為了讓 sort 排出正確的順序');
  await step(tok);                                   // 9:42 all add events before the queries
  sayc('所有 add 事件會排在 query 事件前面');
  await step(tok);                                   // 9:54 that's why the special leftmost value
  sayc('所以 add 的 x 特別取「最左邊」', '多寫一行程式就是為了這個');
}]);

// 10:00 每一格的用途：x、0/1、id
FRAG.push(['bt-mit8-ties', 'Sweep line：同一個 x 時怎麼排（0/1、wire id）', async (tok) => {
  fresh([0, 3.4, 11], [0, 3.0, 0]);
  const R = wireWorld([WIRES[0], { id: 6, h: false, x: -50, y0: -70, y1: 70 }, { id: 4, h: false, x: -50, y0: -80, y1: 80 }]);
  const pn = (t, y, cls = 'note') => tag(t, cls, 3.6, y);
  await step(tok);                                   // 10:00 first key: x on the sweep line
  pn('第 1 格：掃描線停下的 x', 6.4);
  sayc('第一個 key：掃描線停下的 x 座標');
  await step(tok);                                   // 10:13 −∞ would work; the left edge avoids worry
  sayc('也可以放一個很小的負數當 −∞', '但用最左邊的 x 就不用擔心夠不夠小');
  await step(tok);                                   // 10:34 the x at which the sweep line stops
  sayc('它就是掃描線停下、有事發生的位置');
  await step(tok);                                   // 10:39 all x different → done
  sayc('如果每個事件 x 都不同，排序就決定好了');
  await step(tok);                                   // 10:43 two events at the same x: two vertical wires
  wcol(R, 6, C.R); wcol(R, 4, C.R);
  sayc('同一個 x 有兩個事件呢？', '例如兩條垂直線在同一個 x');
  await step(tok);                                   // 10:56 tie breaker: add 0, query 1
  pn('第 2 格：add = 0、query = 1', 5.7);
  sayc('第二格打破平手：add 是 0、query 是 1');
  await step(tok);                                   // 11:07 the add happens before the query
  sayc('同一個 x 上，add 一定先於 query');
  await step(tok);                                   // 11:29 both queries at the same x → wire id
  pn('第 3 格：wire id（唯一）', 5.0);
  sayc('兩個都是 query、x 也一樣', '就看 wire ID：保證不重複');
  await step(tok);                                   // 11:44 comparison must stop here, or it crashes
  pn('比到 wire 物件 → wire 不能比較 → 當掉', 4.3, 'bad');
  sayc('比較一定會停在 wire ID', '比到 wire 物件就當掉了（不能比較）');
  await step(tok);                                   // 12:09 compute_crossings goes through the sorted events
  sayc('compute_crossings 第 9 行：依序處理排好的事件');
  await step(tok);                                   // 12:23 reads x, type, wire; the rest only helps sorting
  pn('只讀 x、型別、wire；其他格只為了排序', 3.6);
  sayc('它取出 x、事件型別、wire', '其他格只是幫忙排序');
  await step(tok);                                   // 12:42 sorted in __init__ (not shown): don't change
  sayc('排序在沒列出的 __init__ 裡', '暗示你不需要改它');
  await step(tok);                                   // 13:10 your own sweep: your events, your processing
  sayc('自己寫 sweep line：產生自己的事件', '再改 compute_crossings 處理它們');
}]);

// 13:31 range index：用 y 範圍查詢，會有 false positive
FRAG.push(['bt-mit8-rangeq', 'Sweep line：range index 查詢與 false positive', async (tok) => {
  fresh([0, 3.4, 11], [0, 3.0, 0]);
  const R = wireWorld();
  let box = null;
  await step(tok);                                   // 13:31 what do we store? horizontal wires
  [0, 1, 2, 3].forEach((i) => wcol(R, i, C.G));
  sayc('range index 裡存什麼？水平的 wires');
  await step(tok);                                   // 13:49 why store them? the query
  sayc('為什麼要存？為了查詢');
  await step(tok);                                   // 14:05 query between the top and the bottom
  wcol(R, 4, C.R);
  box = P.ghostBox(C.B, 8.5, WY(80) - WY(-80), 0.2); box.position.set(0, (WY(80) + WY(-80)) / 2, -0.1);
  sayc('對垂直線 w4：查它的上端到下端之間');
  await step(tok);                                   // 14:24 all horizontals with y in between
  sayc('拿出 y 座標在這個範圍內的所有水平線');
  await step(tok);                                   // 14:35 wires far up/down can't intersect → eliminated
  const far = rod(V3(WX(-80), WY(95), 0), V3(WX(60), WY(95), 0), C.K, 0.05);
  sayc('太上面或太下面的線不可能相交', 'range index 幫你排除它們');
  await step(tok);                                   // 14:50 does it remove all non-intersecting? no
  sayc('不相交的會全部被排除嗎？不會');
  await step(tok);                                   // 15:18 many short horizontals inside the y range
  for (let i = 0; i < 4; i++) rod(V3(WX(10 + i * 18), WY(-30 + i * 25), 0), V3(WX(22 + i * 18), WY(-30 + i * 25), 0), C.Y, 0.05);
  sayc('例：y 在範圍內、但 x 根本碰不到的短線段');
  await step(tok);                                   // 16:50 lots of false positives
  note('false positives：查到了但其實不相交', 0, 0.3);
  sayc('range query 會給很多 false positive');
  await step(tok);                                   // 16:55 check they really intersect
  sayc('所以拿到之後還要確認真的相交', '不能直接輸出');
  void far;
}]);

// 17:06 range index 的操作；未排序陣列的時間
FRAG.push(['bt-mit8-ops', 'Range index：操作與未排序陣列的時間', async (tok) => {
  fresh([0, 3.6, 11], [0, 2.6, 0]);
  const pn = (t, y, cls = 'note') => tag(t, cls, 3.6, y);
  let cells = null;
  await step(tok);                                   // 17:06 the range index is a data structure
  hd('Range index（資料結構）', 0, 6.4);
  sayc('range index 是一個資料結構，有哪些操作？');
  await step(tok);                                   // 17:30 list(l, h)
  pn('list(l, h)：回傳 [l, h] 內所有 key', 5.6);
  sayc('list(l, h)：回傳區間內的所有 key');
  await step(tok);                                   // 17:44 count(l, h)
  pn('count(l, h)：區間內有幾個', 5.0);
  sayc('count(l, h)：區間內有幾個');
  await step(tok);                                   // 17:58 updates: add, remove
  pn('add(key)、remove(key)：更新', 4.4);
  sayc('還有更新：add、remove');
  await step(tok);                                   // 18:20 running times in the given code?
  cells = arrView([5, 8, 2, 11, 3], -5.4, 2.0, 1.1);
  sayc('作業給的版本：一個沒排序的陣列', '各操作要多久？');
  await step(tok);                                   // 18:35 add = append: O(1)
  pn('add：append → O(1)', 2.6, 'good');
  sayc('add 用 append：O(1)');
  await step(tok);                                   // 18:44 remove: shift everything left → O(n)
  glow(cells[2], REDEM);
  pn('remove：後面全部左移 → O(n)', 2.0, 'bad');
  sayc('remove 2：後面的都要往左移', 'O(n)');
  await step(tok);                                   // 19:10 count: check every key → O(n)
  glow(cells[2], null); cells.forEach((m) => glow(m, GOLD));
  pn('count：每個 key 都檢查 → O(n)', 1.4, 'bad');
  sayc('count：掃過所有 key 檢查在不在區間', 'O(n)');
  await step(tok);                                   // 19:45 list: same → O(n)
  pn('list：一樣掃一遍 → O(n)', 0.8, 'bad');
  sayc('list：list comprehension，一樣 O(n)');
}]);

// 20:02 排序陣列：count O(log n)、list O(log n + i)
FRAG.push(['bt-mit8-sorted', 'Range index：排序陣列，list = O(log n + i)', async (tok) => {
  fresh([0, 3.6, 11], [0, 2.6, 0]);
  const pn = (t, y, cls = 'note') => tag(t, cls, 3.4, y);
  const cells = arrView(ARR, -5.4, 2.0, 1.1);
  await step(tok);                                   // 20:02 another version: a sorted array
  hd('rep invariant：陣列保持排序', -3.2, 6.2);
  sayc('第二個版本：陣列保持排序');
  await step(tok);                                   // 20:29 add / remove: binary search… but
  sayc('add、remove：binary search 找位置是 O(log n)', '但是…');
  await step(tok);                                   // 20:54 insert 0: shift everything right → O(n)
  cells.forEach((m) => move(m, m.position.x + 1.1, 2.0, 0));
  const z = bx(0, C.O, -5.4, 2.0, 0, 1.0, 2, 0.7, 0.7);
  pn('add / remove：要搬移 → O(n)', 5.6, 'bad');
  sayc('插入 0：所有元素都要往右挪', 'O(n)');
  await step(tok);                                   // 21:19 remove: shift left → O(n)
  kill(z); cells.forEach((m) => move(m, m.position.x - 1.1, 2.0, 0));
  sayc('remove 也一樣：找得快，但左移要 O(n)');
  await step(tok);                                   // 21:46 count: two binary searches → O(log n)
  pn('count：兩次 binary search → O(log n)', 5.0, 'good');
  sayc('count：兩次 binary search 再相減', 'O(log n)');
  await step(tok);                                   // 22:35 list: O(log n + i)
  pn('list：O(log n + i)，i = 輸出個數', 4.4, 'good');
  sayc('list：O(log n + i)', 'i = 回傳的 key 個數');
  await step(tok);                                   // 23:06 query −∞..+∞: copy everything → O(n)
  cells.forEach((m) => glow(m, GOLD));
  sayc('查 −∞ 到 +∞：全部複製出來', '這時是 O(n)');
  await step(tok);                                   // 23:19 small answers: log n + O(1)
  cells.forEach((m) => glow(m, null)); glow(cells[2], GOLD);
  sayc('答案只有 1 個時：log n + O(1)', '只寫 O(n) 就太低估它了');
  await step(tok);                                   // 23:44 the best possible for list? O(1)? no
  sayc('list 最快能多快？O(1) 嗎？不行');
  await step(tok);                                   // 24:33 even a magic structure must write the output: Ω(i)
  pn('就算有神奇資料結構，輸出也要 Ω(i)', 3.8, 'ptr alt');
  sayc('就算搜尋是 O(1)', '輸出 i 個答案至少要 Ω(i)');
}]);

// 25:07 count(4, 11) 的 off-by-one
FRAG.push(['bt-mit8-bug', 'Range index：count(4, 11) 少算一個', async (tok) => {
  fresh([0, 3.6, 11], [0, 2.6, 0]);
  const cells = arrView(ARR, -2.4, 2.4, 1.2);
  const pn = (t, y, cls = 'note') => tag(t, cls, 0, y);
  let pt = null;
  await step(tok);                                   // 25:07 a small bug
  sayc('這段程式有個小 bug');
  await step(tok);                                   // 25:16 count(4, 11)
  hd('count(4, 11)', 0, 5.6);
  sayc('看 count(4, 11)');
  await step(tok);                                   // 25:18 binary search: position, or where to insert
  sayc('binary search：key 存在 → 回傳它的位置', '不存在 → 回傳「應該插入的位置」');
  await step(tok);                                   // 25:33 positions 0..4
  sayc('陣列 [2, 3, 5, 8, 11]，位置 0 到 4');
  await step(tok);                                   // 25:42 search 11 → 4
  glow(cells[4], GOLD);
  pt = pn('search(11) = 4', 4.8);
  sayc('search(11)：找到在位置 4');
  await step(tok);                                   // 25:47 search 4 → 2 (where it would go)
  const ins = pkt('4 →', -1.2 + 0.6, 3.4); void ins;
  txt(pt, 'search(11) = 4，search(4) = 2');
  sayc('search(4)：不存在，應插在位置 2');
  await step(tok);                                   // 25:58 4 − 2 = 2: broken (should be 3)
  [2, 3, 4].forEach((i) => glow(cells[i], GREEN));
  pn('4 − 2 = 2，但 5、8、11 有 3 個 → off by one', 4.1, 'bad');
  sayc('4 − 2 = 2，但答案是 5、8、11 共 3 個', '差一（off-by-one）');
  await step(tok);                                   // 26:04 it shipped and passed every test
  sayc('這段程式真的發出去了，還通過所有測試', '等一下看為什麼');
  await step(tok);                                   // 26:40 binary search returns a position
  sayc('binary search 不會真的插入', '只告訴你該放哪');
  await step(tok);                                   // 27:19 add inserts right there
  sayc('add 就直接插在那個位置');
}]);

// 28:30 KeyWirePair：key、wire id、±∞
FRAG.push(['bt-mit8-kwp', 'Range index：KeyWirePair 與 ±∞ 的 wire id', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.8, 0]);
  const kp = (k, id, x, y, c = C.B) => bx('(' + k + ', ' + id + ')', c, x, y, 0, 1.9, 2, 0.6, 0.6);
  const pn = (t, y, cls = 'note') => tag(t, cls, 3.4, y);
  await step(tok);                                   // 28:30 wires are not comparable
  sayc('range index 存的是 wire', '數字會比大小，wire 不會');
  await step(tok);                                   // 28:50 bridge: KeyWirePair
  hd('KeyWirePair = (key, wire)', -2.6, 6.2);
  sayc('用 KeyWirePair 搭橋：一個 key 加一個 wire');
  await step(tok);                                   // 29:16 compare by key, ties by wire id
  pn('先比 key；key 相同再比 wire id', 5.6);
  sayc('比較：先比 key', 'key 一樣再用 wire id 分出大小');
  await step(tok);                                   // 29:51 wire id set in the constructor: unique
  sayc('wire id 在建構子（第 10 行）設定', '每條 wire 唯一');
  await step(tok);                                   // 30:25 the key for a wire: its y coordinate
  pn('水平 wire 的 key = y 座標', 5.0);
  sayc('wire 的 key 是 y 座標', '查 y 範圍才拿得到對的 wire');
  await step(tok);                                   // 31:07 line 13: add event → add(KeyWirePair(y, wire))
  kp(80, 3, -4.2, 3.6);
  sayc('第 13 行：處理 add 事件時', '加入 KeyWirePair(y, wire)');
  await step(tok);                                   // 31:31 special KeyWirePairL / H
  sayc('另外有兩個特別的類別', 'KeyWirePairL、KeyWirePairH');
  await step(tok);                                   // 32:01 wire id −∞ / +∞
  kp(80, '−∞', -4.2, 2.6, C.P); kp(80, '+∞', -4.2, 4.6, C.O);
  sayc('L 的 wire id 像 −∞、H 的像 +∞', '（只要 wire 不超過十億條）');
  await step(tok);                                   // 32:24 they don't have a wire
  sayc('它們只有 key，沒有 wire');
  await step(tok);                                   // 32:37 used for queries
  sayc('什麼時候需要沒有 wire 的 key？做 query 時');
  await step(tok);                                   // 32:51 vertical −80..80: low key −80, high key 80
  pn('query w：L(−80) ~ H(80)', 4.4, 'ptr alt');
  sayc('垂直線從 −80 到 80', 'low key = −80、high key = 80');
  await step(tok);                                   // 33:12 fake wires are hacky; wire = None
  sayc('造假 wire 很 hack，可能害別處出錯', '乾淨做法：wire 設成 None');
  await step(tok);                                   // 33:58 a real pair at 80 lies between L(80) and H(80)
  pn('L(80) < (80, 3) < H(80)', 3.8, 'good');
  sayc('真正 y = 80 的 wire', '一定介於 L(80) 和 H(80) 之間');
  await step(tok);                                   // 34:21 the query grabs every wire at 80
  sayc('所以 query 會抓到所有座標剛好在邊界上的 wire');
}]);

// 34:36 沒有相等的 key；query 的 key 不在 index 裡
FRAG.push(['bt-mit8-equal', 'Range index：不必處理相等 key 與邊界', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.8, 0]);
  const kp = (t, x, y, c = C.B) => bx(t, c, x, y, 0, 2.0, 2, 0.6, 0.6);
  const pn = (t, y, cls = 'note') => tag(t, cls, 3.2, y);
  await step(tok);                                   // 34:36 equal keys in the index?
  sayc('寫程式的好處：index 裡會有相等的 key 嗎？');
  await step(tok);                                   // 35:11 two wires at y = −95, ids 2 and 10
  kp('(−95, 2)', -4.0, 4.4); kp('(−95, 10)', -4.0, 3.4);
  sayc('兩條水平線都在 y = −95', 'wire id 是 2 和 10');
  await step(tok);                                   // 35:53 different thanks to the wire id
  sayc('對演算法來說 key 一樣', '但加上 wire id 後被人為地分開了');
  await step(tok);                                   // 36:45 equal only if the same wire is inserted twice
  pn('相等 ⇔ 同一條 wire 加兩次（不會這樣做）', 5.6);
  sayc('wire id 唯一', '只有同一條 wire 加兩次才會相等');
  await step(tok);                                   // 37:25 no equal keys to handle
  pn('→ index 裡沒有相等的 key', 5.0, 'good');
  sayc('所以實作 range index 時不用處理相等的 key');
  await step(tok);                                   // 37:34 a query from −80 to 80: are its keys in the index?
  sayc('做 query（−80 到 80）時', 'query 用的 key 會在 index 裡嗎？');
  await step(tok);                                   // 38:27 KeyWirePairL(−80), KeyWirePairH(80)
  kp('L(−80)', 0.4, 4.4, C.P); kp('H(80)', 0.4, 3.4, C.O);
  sayc('用 KeyWirePairL(−80)、KeyWirePairH(80)');
  await step(tok);                                   // 38:53 L below every wire at −80, H above every wire at 80
  sayc('L 比所有 −80 的 wire 都小', 'H 比所有 80 的 wire 都大');
  await step(tok);                                   // 38:59 never in the index
  pn('query 的 key 永遠不在 index 裡', 4.4, 'good');
  sayc('它們只用來查詢，永遠不會被加進 index');
  await step(tok);                                   // 39:20 fewer border cases
  sayc('邊界情況少很多，查詢比較好寫');
  await step(tok);                                   // 39:37 that's why the buggy count passed
  sayc('這就是有 bug 的 count 還能通過測試的原因');
  await step(tok);                                   // 39:45 like count(3.99, 11.01)
  pn('像 count(4, 11) 變成 count(3.99, 11.01)', 3.8, 'ptr alt');
  sayc('用數字比喻：count(4, 11)', '其實被改寫成 count(3.99, 11.01)，答案就對了');
  await step(tok);                                   // 40:08 with plain numbers it's brittle
  sayc('如果真的用 3.99 這種數字很脆弱', '因為 index 裡可能剛好有這個 key');
}]);

// 41:38 comparison model 的代價
FRAG.push(['bt-mit8-cmp', 'Range index：comparison model 多付的 log n', async (tok) => {
  fresh([0, 3.6, 11], [0, 2.6, 0]);
  const pn = (t, x, y, cls = 'note') => tag(t, cls, x, y);
  await step(tok);                                   // 41:38 why isn't this range index optimal?
  sayc('為什麼這個 range index 不是最佳的？');
  await step(tok);                                   // 41:49 we use the comparison model
  sayc('add、remove 慢；而且我們用的是 comparison model');
  await step(tok);                                   // 41:56 convenient: 6 methods → any comparison algorithm
  sayc('方便：實作 6 個比較方法', '就能用任何「只靠比較」的演算法');
  await step(tok);                                   // 42:10 the penalty: sort n log n
  hd('comparison model', -2.6, 5.6); hd('不限比較', 2.6, 5.6);
  pn('sort：Θ(n log n)', -2.6, 4.8);
  sayc('代價：排序要 Θ(n log n)');
  await step(tok);                                   // 42:27 search Θ(log n)
  pn('search：Θ(log n)', -2.6, 4.1);
  sayc('搜尋要 Θ(log n)');
  await step(tok);                                   // 42:38 outside: sort in n
  pn('sort：O(n)', 2.6, 4.8, 'good');
  sayc('不受比較限制：排序可以 O(n)', '例如 counting / radix sort');
  await step(tok);                                   // 42:54 search O(1) with hashing
  pn('search：O(1)（hashing）', 2.6, 4.1, 'good');
  sayc('搜尋可以 O(1)：hashing');
  await step(tok);                                   // 43:05 can't do better: output size
  sayc('還能更快嗎？不行', 'sort 要輸出 n 個、search 至少輸出一個答案');
  await step(tok);                                   // 43:29 an extra log n for convenience
  note('comparison model：多付 log n，換來只要定義大小關係的方便', 0, 2.6);
  sayc('用 comparison model 多付一個 log n', '換來只要定義大小關係的方便');
}]);

// 43:50 BST 的 list：LCA + node-list、剪枝
FRAG.push(['bt-mit8-bst', 'Range index：BST 的 list(l, h) = LCA + node-list', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 3.6, 0]);
  let N = null;
  const ghost = (k, x, y) => { const m = cube(k, C.K, [0.7, 0.5, 0.5], x, y, 0); m.material.transparent = true; m.material.opacity = 0.45; return m; };
  await step(tok);                                   // 43:50 the list pseudocode
  sayc('看作業裡 list 的虛擬碼');
  await step(tok);                                   // 44:01 an intuition; a regular BST
  sayc('不證明，只建立直覺', '假設 range index 用一般的 BST');
  await step(tok);                                   // 44:22 keys 8, 3, 2, 5 …
  N = bstWorld();
  sayc('把 key 放進 BST：8、3、2、5、11、13');
  await step(tok);                                   // 44:39 list = LCA, then node-list
  note('list(l, h)：先 LCA，再 node-list', 4.6, 6.4);
  sayc('list 分兩步：LCA、node-list');
  await step(tok);                                   // 44:48 list between 1 and 6
  hd('list(1, 6)', -4.6, 6.4);
  sayc('例：列出 1 到 6 之間的 key');
  await step(tok);                                   // 45:22 LCA = lowest common ancestor
  sayc('LCA = lowest common ancestor（最低共同祖先）');
  await step(tok);                                   // 45:39 LCA(2, 5) = 3, LCA(2, 13) = 8
  glow(N[3], GOLD);
  sayc('LCA(2, 5) = 3', 'LCA(2, 13) = 8');
  await step(tok);                                   // 45:51 keys not in the tree: where they'd go → 3
  const g1 = ghost('1', -4.6, 1.5), g6 = ghost('6', -0.6, 1.5);
  sayc('key 不在樹裡：看它「會被插在哪」', '1、6 的位置 → LCA = 3');
  await step(tok);                                   // 46:27 the rest of the tree: right of 8 is > 6
  [11, 13].forEach((k) => { tint(N[k], C.K); });
  sayc('8 的右邊全部 > 6', '直接丟掉');
  await step(tok);                                   // 46:38 only the subtree rooted at the LCA
  sayc('答案全部在以 LCA 為根的子樹裡');
  await step(tok);                                   // 47:25 node-list: pre-order with pruning
  kill(g1); kill(g6); [11, 13].forEach((k) => tint(N[k], C.B)); glow(N[3], null);
  sayc('node-list：像 pre-order 走訪', '但有些地方不往下走（剪枝）');
  await step(tok);                                   // 47:57 list(4, 10): LCA 8
  hd('list(4, 10)', 4.6, 5.6);
  glow(N[8], GOLD);
  sayc('換 list(4, 10)：LCA 是 8');
  await step(tok);                                   // 48:17 at 3: 3 < 4 → prune its left
  glow(N[3], REDEM); tint(N[2], C.K);
  sayc('到 3：3 < 4', '3 的左子樹全部 < 4 → 剪掉');
  await step(tok);                                   // 48:32 at 11: 11 > 10 → don't go right
  glow(N[11], REDEM); tint(N[13], C.K);
  sayc('到 11：11 > 10', '右子樹全部 > 10 → 不往右走');
  await step(tok);                                   // 48:55 at 3 we can't stop: its right may be in range
  glow(N[5], GREEN); glow(N[8], GREEN);
  sayc('但在 3 不能整個停掉', '它的右邊（5）可能在區間內 → 輸出 8、5');
}]);

// 49:15 時間：O(h + i)
FRAG.push(['bt-mit8-time', 'Range index：BST list 的時間 O(h + i)', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 3.4, 0]);
  // a schematic path LCA → L that zig-zags; triangles = subtrees
  const path = [[0, 6.0], [-1.6, 5.0], [-0.6, 4.0], [-2.0, 3.0], [-1.0, 2.0], [-2.2, 1.0]];
  const turn = ['L', 'R', 'L', 'R', 'L'];
  const nodes = path.map(([x, y], i) => cube(i ? '' : 'LCA', i ? C.B : C.D, [i ? 0.5 : 0.9, 0.45, 0.45], x, y, 0));
  for (let i = 0; i + 1 < path.length; i++) rod(V3(path[i][0], path[i][1] - 0.2, 0), V3(path[i + 1][0], path[i + 1][1] + 0.2, 0), EDGE, 0.04);
  tag('L', 'ptr alt', -2.2, 0.4);
  const tri = (x, y, c, op = 0.3) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 3), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op })); m.position.set(x, y - 0.55, 0); lab.world.add(m); return m; };
  const side = [];
  await step(tok);                                   // 49:15 an intuitive running-time analysis
  sayc('直覺地分析執行時間');
  await step(tok);                                   // 49:25 a path from the LCA down to L
  sayc('從 LCA 走一條路徑到 L（H 那邊對稱）');
  await step(tok);                                   // 49:41 before a right turn: left side pruned
  for (let i = 1; i < path.length; i++) if (turn[i - 1] === 'R') side.push(tri(path[i - 1][0] - 0.7, path[i - 1][1], C.R));
  sayc('在路徑往右轉的節點：L 比它大', '它的左子樹整個被剪掉');
  await step(tok);                                   // 50:05 going left: the right side is in [L, LCA] → output
  for (let i = 1; i < path.length; i++) if (turn[i - 1] === 'L') side.push(tri(path[i - 1][0] + 0.7, path[i - 1][1], C.G));
  sayc('往左轉的節點：右子樹都介於 L 和 LCA 之間', '全部是答案 → 輸出');
  await step(tok);                                   // 50:25 we must pay Ω(i) for the output
  sayc('前面說過：輸出 i 個答案一定要 Ω(i)');
  await step(tok);                                   // 50:34 line 4 outputs a key → O(i)
  note('第 4 行輸出 key：只對 [l, h] 內的執行 → O(i)', 3.6, 6.2);
  sayc('第 4 行輸出 key', '只在 key 介於 l、h 時執行 → 總共 O(i)');
  await step(tok);                                   // 50:52 list(4, 10) visits 8, 3, 5, 11, outputs 8, 5
  note('list(4, 10)：走訪 8、3、5、11，輸出 8、5', 3.6, 5.5);
  sayc('list(4, 10) 走訪 8、3、5、11', '其中 8、5 被輸出');
  await step(tok);                                   // 51:16 how many visited nodes are NOT output?
  sayc('輸出的部分算 O(i)', '關鍵是：走訪了多少「沒輸出」的節點？');
  await step(tok);                                   // 51:29 visiting the whole tree → O(n)
  sayc('如果整棵樹都走 → O(n + i) = O(n)');
  await step(tok);                                   // 51:42 only the path (and one neighbour each)
  nodes.forEach((m) => glow(m, GOLD));
  sayc('其實只會多走路徑上的節點', '（每個節點加左邊那一個）');
  await step(tok);                                   // 52:14 the height: worst n, average log n
  note('BST 高度 h：最壞 n、平均 log n', 3.6, 4.8);
  sayc('路徑長度 = 樹高 h', '一般 BST 最壞 n、平均 log n');
  await step(tok);                                   // 52:48 running time O(h + i)
  hot('list = O(h + i)', 3.6, 4.0);
  sayc('所以 list 的時間是 O(h + i)');
  await step(tok);                                   // 53:58 balanced: h = log n ≪ n
  sayc('樹平衡時 h = O(log n)', '比 O(n) 好很多');
  await step(tok);                                   // 54:24 recap: right of the path output, left pruned
  sayc('整理：路徑右邊的都輸出、左邊的都不走', '只多走路徑本身 → O(h)');
}]);

// ════════ dU40AvBURDQ（MIT 6.006 L24：Topics in Algorithms Research） ════════
// Srini Devadas：時脈停滯 → 多核心、tile 架構、execution migration 的 DP（O(nq²)）；
// Erik Demaine：摺紙（foldability NP-complete、design、fold-and-cut）、cache 模型、predecessor、planar graph、遊戲。
const card = (t, c, x, y, z = 0, w = 2.6) => bx(t, c, x, y, z, w, 2, 0.55, 0.7);

// 0:52 時脈的歷史：從 5 MHz 到 3 GHz，然後停住
FRAG.push(['bt-mit24-clock', '研究主題：時脈停在 3 GHz → 多核心', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.6, 0]);
  const X = (i) => -5.0 + i * 1.7;
  const bars = [];
  const bar = (i, mhz, label, c = C.B) => { const h = 1.05 * Math.log10(mhz); const m = cube('', c, [1.0, 1, 0.8], X(i), 0.01, 0); m.scale.y = 0.01; bars.push([m, h]); tag(label, 'idx', X(i), 0, 0.8); tag(mhz >= 1000 ? (mhz / 1000) + ' GHz' : mhz + ' MHz', 'ptr', X(i), h + 0.35); return anim(tok, 600, (u) => { m.scale.y = Math.max(0.01, h * u); m.position.y = m.scale.y / 2; }); };
  await step(tok);                                   // 0:52 the first PC: 1981
  hd('時脈（對數刻度）', 0, 6.2);
  sayc('第一台個人電腦（PC）：1981 年');
  await step(tok);                                   // 1:17 Intel x86 in the IBM PC
  sayc('Intel 的 x86 架構，用在第一台 IBM PC');
  await step(tok);                                   // 1:41 5 MHz
  await bar(0, 5, '1981 x86');
  sayc('跑 5 MHz');
  await step(tok);                                   // 1:53 486 in 1989: 25 MHz
  await bar(1, 25, '1989 486');
  sayc('1989 年的 486：25 MHz');
  await step(tok);                                   // 2:01 i486: numbers can't be trademarked
  sayc('數字不能註冊商標', '所以改名 i486，之後開始取名字');
  await step(tok);                                   // 2:21 Pentium 1993: 66 MHz
  await bar(2, 66, '1993 Pentium');
  sayc('1993 年 Pentium：66 MHz');
  await step(tok);                                   // 2:45 Pentium 4, 30-stage pipeline: 1.5 GHz
  await bar(3, 1500, '2000 P4');
  sayc('2000 年 Pentium 4：30 級 pipeline', '1.5 GHz');
  await step(tok);                                   // 3:02 famous bugs (FDIV, F00F)
  sayc('也以 bug 出名：浮點除法錯誤、F00F bug');
  await step(tok);                                   // 3:34 everyone expected tens of GHz
  note('照這趨勢，好像很快就到幾十 GHz？', 0, 5.4);
  sayc('照這個成長速度', '大家以為很快就到幾十 GHz');
  await step(tok);                                   // 3:56 after Pentium D 2005 (3.2 GHz) the clock stopped
  await bar(4, 3200, '2005 P-D', C.O);
  sayc('2005 年 Pentium D：3.2 GHz', '之後時脈就不再增加了');
  await step(tok);                                   // 4:12 several processors on a chip: quad-core Xeon 2008
  await bar(5, 3000, '2008 4 核', C.G);
  sayc('改成一顆晶片放好幾個處理器', '2008 年 quad-core Xeon，3 GHz');
  await step(tok);                                   // 4:37 saturated at ~3 GHz; speed from more cores
  sayc('2005 年後時脈停在約 3 GHz', '效能改靠「更多核心」');
  await step(tok);                                   // 4:54 core = processor; quad-core = 4 x86 on one die
  const cores = [0, 1, 2, 3].map((i) => cube('core', C.G, [0.8, 0.5, 0.6], 3.2 + (i % 2) * 1.0, 3.0 + Math.floor(i / 2) * 0.7, 0, 2));
  sayc('core 就是處理器', 'quad core = 同一塊矽晶片上 4 個 x86');
  await step(tok);                                   // 5:07 interconnected, talking to memory
  sayc('彼此相連、一起存取記憶體', '一顆晶片就是一台平行電腦');
  await step(tok);                                   // 5:25 how many cores? 1000 by 2020
  note('新指標：一顆晶片有幾個核心（預測 2020 年 1000 核）', 0, 4.7);
  sayc('現在的指標是：一顆晶片有幾個 core', '有人預測 2020 年會有 1000 核');
  void cores;
}]);

// 5:38 平行架構：記憶體是瓶頸
FRAG.push(['bt-mit24-mem', '研究主題：多核心的記憶體瓶頸', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.6, 0]);
  let cpus = [];
  await step(tok);                                   // 5:38 how do we use parallelism?
  sayc('問題來了：怎麼用這些平行能力？');
  await step(tok);                                   // 5:43 parallel algorithms, auto-parallelising hardware
  sayc('平行演算法', '或讓硬體自動把程式平行化');
  await step(tok);                                   // 5:57 research in parallel architectures
  sayc('Srini 的研究：平行架構與平行演算法');
  await step(tok);                                   // 6:08 the canonical quad-core system
  cpus = [0, 1, 2, 3].map((i) => card('CPU ' + (i + 1), C.B, -4.5 + i * 1.6, 4.6, 0, 1.3));
  sayc('典型系統：一顆晶片 4 個處理器');
  await step(tok);                                   // 6:25 fast SRAM on chip: megabytes
  const sram = card('SRAM（晶片上，MB 級）', C.G, -2.1, 3.2, 0, 6.0);
  sayc('晶片上有快速的 SRAM', '大小是 MB 級');
  await step(tok);                                   // 6:40 GB of DRAM off chip (DIMMs)
  const dram = card('DRAM（晶片外 DIMM，GB 級）', C.O, -2.1, 1.0, 0, 6.0);
  rod(V3(-2.1, 2.9, 0), V3(-2.1, 1.3, 0), C.D, 0.08);
  sayc('晶片外有 GB 級的 DRAM', '一條條 DIMM，透過高速 bus 連接');
  await step(tok);                                   // 6:58 on chip GHz, off chip a few hundred MHz
  tag('晶片內：GHz', 'ptr', 2.6, 3.9); tag('晶片外：幾百 MHz（慢一個數量級）', 'ptr', 2.9, 1.9);
  sayc('晶片內是 GHz', '出了晶片只剩幾百 MHz，慢一個數量級');
  await step(tok);                                   // 7:21 4 → 8 → 16 → hundreds of processors
  for (let i = 4; i < 12; i++) cpus.push(cube('', C.B, [0.5, 0.45, 0.45], -5.0 + (i - 4) * 0.75, 5.5, 0, 2));
  sayc('處理器從 4、8、16 增加到幾百個', '記憶體存取變成瓶頸');
  await step(tok);                                   // 7:41 an SRAM has only ~4 ports
  glow(sram, REDEM);
  bad('一大塊 SRAM 只有大約 4 個讀取埠', 2.6, 5.4);
  sayc('做不出能同時服務幾百個要求的記憶體', '大 SRAM 只有約 4 個讀取埠');
  await step(tok);                                   // 8:03 not sustainable beyond 4, 8, 16 cores
  sayc('這種架構撐不過 4、8、頂多 16 核');
  void dram;
}]);

// 8:13 tile 架構、繞線、遠端存取
FRAG.push(['bt-mit24-tiles', '研究主題：tile 架構與跨晶片的來回', async (tok) => {
  fresh([0, 8.5, 7.5], [0, 0, 0.4]);
  const T = {};
  const at = (r, c) => [-3.6 + c * 1.8, 0.3, -2.4 + r * 1.6];
  let msg = null;
  await step(tok);                                   // 8:13 distributed: processor + memory in tiles
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const [x, y, z] = at(r, c); T[r + ',' + c] = cube('', C.B, [1.1, 0.4, 0.9], x, y, z); cube('', C.G, [0.5, 0.15, 0.4], x + 0.25, y + 0.28, z + 0.1); }
  sayc('學界在做的：分散式架構', '處理器和記憶體做成一格一格的 tile');
  await step(tok);                                   // 8:39 literally 100 processors on a chip
  sayc('一顆晶片可以放上百個處理器');
  await step(tok);                                   // 8:52 processor + cache memory (several levels)
  note('每格：處理器（藍）＋ cache（綠）', 4.6, 0.4, -3.2);
  sayc('每格有處理器、還有好幾層 cache 記憶體');
  await step(tok);                                   // 9:04 the space between tiles: wires
  for (let r = 0; r < 4; r++) rod(V3(...at(r, 0)).setY(0.1), V3(...at(r, 4)).setY(0.1), C.D, 0.05);
  for (let c = 0; c < 5; c++) rod(V3(...at(0, c)).setY(0.1), V3(...at(3, c)).setY(0.1), C.D, 0.05);
  sayc('tile 之間的空間留給連線（interconnect）');
  await step(tok);                                   // 9:19 routing: shortest path, weight = congestion
  sayc('研究 routing 演算法：訊息怎麼走最好？', '找最短路徑，權重 = 該通道的壅塞程度');
  await step(tok);                                   // 9:39 weighted shortest paths in hardware; may go around
  const path = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3]];
  for (let i = 0; i + 1 < path.length; i++) rod(V3(...at(...path[i])).setY(0.45), V3(...at(...path[i + 1])).setY(0.45), C.O, 0.07);
  sayc('硬體真的用 weighted shortest path', '有時繞遠路反而比較不塞');
  await step(tok);                                   // 9:57 how long to go across the chip and back
  sayc('另一個問題：橫越晶片再回來要多久？');
  await step(tok);                                   // 10:06 local memory: fast
  glow(T['3,0'], GOLD);
  sayc('存取自己這格的 cache：很快');
  await step(tok);                                   // 10:13 remote memory: data shared with another thread
  glow(T['0,4'], REDEM);
  sayc('但資料可能在別的處理器上', '例如和另一個 thread（執行緒）共用');
  await step(tok);                                   // 10:38 request across, data back: a round trip
  msg = pkt('要求 →', ...at(3, 0)); msg.position.y = 1.0;
  await travel(tok, msg, V3(at(3, 0)[0], 1.0, at(3, 0)[2]), V3(at(0, 4)[0], 1.0, at(0, 4)[2]), 900);
  txt(msg, '← 資料');
  await travel(tok, msg, V3(at(0, 4)[0], 1.0, at(0, 4)[2]), V3(at(3, 0)[0], 1.0, at(3, 0)[2]), 900);
  sayc('送要求過去、再把資料送回來', '一趟來回（round trip）');
  await step(tok);                                   // 11:00 tens of cycles vs 1 cycle for L1
  note('L1 cache：1 cycle；跨晶片來回：幾十 cycles', 4.6, 0.4, 2.4);
  sayc('本地 L1 cache 只要 1 個 cycle', '跨晶片一來一回要幾十個 cycle');
  await step(tok);                                   // 11:18 the bottleneck: routing messages back and forth
  sayc('平行處理的通訊瓶頸', '就是這些訊息的來回');
}]);

// 11:30 execution migration：搬計算而不是搬資料
FRAG.push(['bt-mit24-em', '研究主題：execution migration（搬程式不搬資料）', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.4, 0]);
  const A = card('處理器 A', C.B, -4.0, 1.0, 0, 2.2), B = card('處理器 B（資料在這）', C.G, 3.6, 1.0, 0, 3.2);
  let ctxT = null;
  await step(tok);                                   // 11:30 migrate computation instead of data
  sayc('Srini 的研究：搬「計算」而不是搬「資料」');
  await step(tok);                                   // 11:40 execution migration
  hd('Execution migration', 0, 5.6);
  sayc('叫做 execution migration');
  await step(tok);                                   // 11:46 a program here wants remote memory
  const prog = pal('程式', '', '#7cb8ee', -4.0, 1.2, 0.6);
  sayc('A 上的程式想存取 B 的記憶體');
  await step(tok);                                   // 12:00 instead of message + data back: move the program
  sayc('不送訊息、等資料回來', '而是把程式本身搬過去');
  await step(tok);                                   // 12:11 migrate the context
  sayc('搬的是程式的 context（執行狀態）');
  await step(tok);                                   // 12:18 context: program counter, register file, …
  ctxT = note('context = program counter + 暫存器 + …', 0, 4.6);
  sayc('context = program counter（執行到哪）', '加上暫存器的內容等等');
  await step(tok);                                   // 12:49 one-way trip instead of a round trip
  await slide(tok, prog.g, 3.6, 0, 1.2, 1200);
  sayc('優點：單程，不是來回');
  await step(tok);                                   // 13:00 no address + data messages
  sayc('不需要「送地址、回資料」兩個訊息');
  await step(tok);                                   // 13:11 run on the remote processor
  prog.mood('happy');
  sayc('到了 B 就直接在那裡執行');
  await step(tok);                                   // 13:23 downside: the context is kilobits
  bad('缺點：context 有好幾 kilobit，比一個資料字大很多', 0, 3.8);
  sayc('缺點：context 可能有好幾 kilobit', '比要讀的一個字（32/64 bit）大很多');
  await step(tok);                                   // 13:39 a trade-off → an optimisation problem
  sayc('有取捨，就能設計演算法找最佳取捨');
  await step(tok);                                   // 13:54 when data access, when execution migration
  sayc('問題：什麼時候搬資料、什麼時候搬執行？');
  await step(tok);                                   // 14:08 round trip = 2× distance vs a big context
  note('資料存取：距離 × 2，量小　｜　搬執行：距離 × 1，但 context 大', 0, 3.0);
  sayc('拿資料要走兩倍距離', '搬 context 只走一趟，但要搬的量大');
  void A; void B; void ctxT;
}]);

// 14:37 寫成最佳化問題
FRAG.push(['bt-mit24-model', '研究主題：何時 migrate 的成本模型', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.8, 0]);
  const pn = panel(3.0, 6.2, 0.6);
  const seq = ['p1', 'p2', 'p2', 'p1', 'p3', 'p2'];
  const S = seq.map((p, i) => bx(p, { p1: C.B, p2: C.G, p3: C.O }[p], -5.6 + i * 1.0, 3.6, 0, 0.85, 0, 0.55, 0.6));
  S.forEach((m) => { m.visible = false; });
  const mark = (i, t, c) => tag(t, c, -5.6 + i * 1.0, 2.8);
  await step(tok);                                   // 14:37 an optimisation problem
  sayc('把它寫成最佳化問題', '從 6.004（計算機結構）跳到 6.006');
  await step(tok);                                   // 14:50 assume we can predict the access pattern
  sayc('假設知道（或能預測）程式的記憶體存取順序');
  await step(tok);                                   // 15:04 prefetch engines, branch predictors
  sayc('硬體裡本來就有 prefetch、branch predictor', '跑迴圈時很好預測');
  await step(tok);                                   // 15:18 look-ahead: m1 … mn
  S.forEach((m, i) => { m.visible = true; relabel(m, 'm' + (i + 1)); });
  sayc('往前看：接下來的存取 m1、m2、…、mn');
  await step(tok);                                   // 15:34 p(m_i): the processor cache holding m_i
  S.forEach((m, i) => relabel(m, seq[i]));
  tag('p(mᵢ)：mᵢ 在哪個處理器的 cache', 'idx', -3.1, 4.4);
  sayc('p(mᵢ) = 存放 mᵢ 的處理器 cache');
  await step(tok);                                   // 15:52 example: p1, p2, …
  sayc('例：先存取 p1 的記憶體，再 p2 的…');
  await step(tok);                                   // 16:14 sitting on p1: first local, then p2's memory
  mark(0, '本地', 'good');
  sayc('程式在 p1：第一個是本地存取', '下一個要讀 p2 的（共用資料）');
  await step(tok);                                   // 16:34 cost_migrate(s, d) = dist(s, d) + C
  pn.add('migrate(s, d) = dist(s, d) + C', 'ptr alt');
  sayc('搬執行的成本 = 距離 + 常數 C', 'C 和 context 大小成正比');
  await step(tok);                                   // 16:52 the context size is fixed per architecture
  sayc('context 大小對一個架構是固定的', '放上網路要付一筆不小的額外成本');
  await step(tok);                                   // 17:14 cost_access(s, d) = 2 · dist(s, d)
  pn.add('access(s, d) = 2 · dist(s, d)', 'ptr alt');
  sayc('遠端存取的成本 = 2 × 距離（一來一回）');
  await step(tok);                                   // 17:21 just one word: no extra overhead
  sayc('只讀一個字（32 / 64 bit）', '沒有額外的大成本');
  await step(tok);                                   // 17:52 s = d: local access, cost 0
  pn.add('s = d：本地存取，成本 0');
  sayc('s = d 是本地存取，成本當作 0');
  await step(tok);                                   // 18:07 decide when to migrate to minimise the total
  pn.add('目標：決定何時 migrate，讓總成本最小', 'good');
  sayc('問題：決定何時搬執行', '讓所有記憶體存取的總成本最小');
  await step(tok);                                   // 18:25 start at p1: local
  sayc('例子：從 p1 開始，第一個是本地存取');
  await step(tok);                                   // 18:49 migrate to p2 → local accesses
  mark(1, '搬到 p2', 'ptr'); mark(2, '本地', 'good');
  sayc('搬到 p2：接下來兩個都變本地存取');
  await step(tok);                                   // 19:00 migrate back to p1
  mark(3, '搬回 p1', 'ptr');
  sayc('再搬回 p1：本地存取');
  await step(tok);                                   // 19:11 stay at p1: remote accesses to p3, p2
  mark(4, '遠端', 'bad'); mark(5, '遠端', 'bad');
  sayc('之後留在 p1', '對 p3、p2 做遠端存取');
  await step(tok);                                   // 19:21 cost: migrations + two remote accesses
  sayc('總成本 = 幾次 migration ＋ 兩次遠端存取');
}]);

// 19:31 用 DP 解：O(nq²)
FRAG.push(['bt-mit24-dp', '研究主題：migration 的 DP，O(n q²)', async (tok) => {
  fresh([0, 4.0, 12.5], [0, 2.8, 0]);
  const pn = panel(2.6, 6.4, 0.58);
  const Q = 3, NK = 5;
  const cx = (k) => -5.6 + k * 1.0, cy = (p) => 4.6 - p * 0.9;
  const cells = [];
  await step(tok);                                   // 19:31 Dijkstra? Bellman-Ford? BST? hashing?
  sayc('要用什麼解？Dijkstra？Bellman-Ford？', '平衡樹？hash？');
  await step(tok);                                   // 19:46 dynamic programming
  hd('Dynamic programming', -3.4, 6.4);
  sayc('答案：Dynamic programming');
  await step(tok);                                   // 20:11 the program starts at p1
  sayc('程式一開始在 p1');
  await step(tok);                                   // 20:18 q processors
  for (let p = 0; p < Q; p++) tag('p' + (p + 1), 'ptr', -6.5, cy(p));
  sayc('處理器個數 = q');
  await step(tok);                                   // 20:29 subproblems: prefixes
  for (let k = 1; k <= NK; k++) tag('k=' + k, 'idx', cx(k), 5.4);
  sayc('子問題用 prefix（前 k 個存取）');
  await step(tok);                                   // 20:41 DP[k][p_i]: best cost for m1..mk, start p1, end p_i
  pn.add('DP[k][pᵢ] = 處理完 m1..mk、', 'ptr alt'); pn.add('從 p1 出發、最後停在 pᵢ 的最小成本', 'ptr alt');
  sayc('DP[k][pᵢ]：處理完前 k 個存取', '從 p1 出發、最後在 pᵢ 的最小成本');
  await step(tok);                                   // 21:37 build them up
  for (let p = 0; p < Q; p++) cells.push(cube('', C.K, [0.8, 0.6, 0.4], cx(1), cy(p), 0));
  sayc('一欄一欄把子問題填起來');
  await step(tok);                                   // 21:48 compute DP[k+1][p_j]
  glow(cube('?', C.Y, [0.8, 0.6, 0.4], cx(2), cy(1), 0), GOLD);
  sayc('已知第 k 欄，算 DP[k+1][pⱼ]');
  await step(tok);                                   // 22:01 how many subproblems? n · q
  pn.add('子問題數：n × q');
  sayc('子問題有幾個？n × q');
  await step(tok);                                   // 22:38 case 1: stay at p_j, remote access
  pn.add('pⱼ ≠ p(mₖ₊₁)：DP[k][pⱼ] + access(pⱼ, p(mₖ₊₁))');
  sayc('情況一：pⱼ 不是資料所在處', '留在 pⱼ，做一次遠端存取');
  await step(tok);                                   // 23:13 the new access is not in p_j's cache
  rod(V3(cx(1), cy(1), 0.3), V3(cx(2), cy(1), 0.3), C.B, 0.05);
  sayc('從「停在 pⱼ」的最佳解出發', '加上遠端存取 mₖ₊₁ 的成本');
  await step(tok);                                   // 23:36 case 2: migrate from p_i
  pn.add('pⱼ = p(mₖ₊₁)：minᵢ DP[k][pᵢ] + migrate(pᵢ, pⱼ)');
  for (let p = 0; p < Q; p++) rod(V3(cx(1), cy(p), 0.3), V3(cx(2), cy(1), 0.3), C.O, 0.03);
  sayc('情況二：pⱼ 就是資料所在處', '從某個 pᵢ 搬過來，再做本地存取');
  await step(tok);                                   // 24:16 two cases: migrate + local, or stay + remote
  sayc('兩種選擇：搬過去本地存取', '或留在原地遠端存取');
  await step(tok);                                   // 24:47 try every starting point p_i
  sayc('搬過來的情況要試所有的 pᵢ');
  await step(tok);                                   // 24:57 each subproblem: O(q)
  pn.add('每個子問題：O(q)');
  sayc('每個子問題要看 q 個 pᵢ → O(q)');
  await step(tok);                                   // 25:12 total O(n q²)
  pn.add('總時間：O(n q²)', 'good');
  sayc('總時間 = n q 個子問題 × O(q) = O(n q²)');
  await step(tok);                                   // 25:31 close to the 128-processor EM² machine
  note('他們正在做 128 核的 execution migration machine', -1.6, 0.6);
  sayc('這很接近實際硬體', '他們在做 128 核的 execution migration machine');
}]);

// 28:30 摺紙演算法
FRAG.push(['bt-mit24-fold', '研究主題：摺紙演算法與 fold-and-cut', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.6, 0]);
  const paper = prop('note', -4.2, 0.6, 0, 2.6);
  let dz = null;
  await step(tok);                                   // 28:30 geometric folding algorithms
  hd('Geometric folding algorithms', 0, 6.2);
  sayc('Erik 的第一個主題：幾何摺紙演算法');
  await step(tok);                                   // 28:46 origami: paper → a 3D shape
  sayc('摺紙：一張紙 → 立體形狀', '例如長頸鹿、幾何雕塑');
  await step(tok);                                   // 29:09 creases: what are the rules?
  sayc('先在紙上壓摺痕（crease）', '摺痕要符合什麼規則？');
  await step(tok);                                   // 29:26 two problems: foldability
  card('Foldability：摺得起來嗎？', C.R, -2.6, 4.6, 0, 4.4);
  sayc('第一個問題：foldability（可摺性）');
  await step(tok);                                   // 29:36 diagrams take hours
  sayc('照摺紙圖摺可能要好幾個小時', '只給摺痕圖，連摺不摺得起來都看不出');
  await step(tok);                                   // 29:52 folding a crease pattern: NP-complete
  bad('判斷摺痕圖能不能摺：NP-complete', -2.6, 3.8);
  sayc('判斷一張摺痕圖能不能摺', '是 NP-complete：摺紙很難');
  await step(tok);                                   // 30:16 the reverse: origami design
  card('Design：設計摺痕', C.G, 2.8, 4.6, 0, 3.6);
  sayc('反方向：origami design', '先有想要的 3D 形狀');
  await step(tok);                                   // 30:29 shape → crease pattern: solvable
  good('3D 形狀 → 保證摺得出的摺痕圖：可解', 2.8, 3.8);
  sayc('用演算法把 3D 形狀轉成摺痕圖', '這反而是可以解的：設計比較簡單');
  await step(tok);                                   // 30:39 versions: some poly, some NP-complete
  sayc('設計問題有很多版本', '有些多項式時間，要求最佳就可能 NP-complete');
  await step(tok);                                   // 30:53 any 3D shape: Origamizer
  note('Origamizer：任何多面體 → 一張正方形紙的摺痕圖', 0, 3.0);
  sayc('任何 3D 形狀都摺得出來', '軟體 Origamizer（舘知宏）');
  await step(tok);                                   // 31:28 concentric squares, mountain / valley
  dz = [0, 1, 2].map((i) => { const s = 2.2 - i * 0.7; const m = ctx.tile(V3(-4.2, 0.1 + i * 0.03, 2.2), s, s, i % 2 ? '#e8cf8a' : '#cfe3d4'); return m; });
  sayc('簡單例子：同心正方形摺痕', '山摺、谷摺交錯，再加對角線');
  await step(tok);                                   // 31:48 pops into 3D: hyperbolic paraboloid?
  sayc('壓好摺痕就彈成立體', '多年來大家以為是雙曲拋物面');
  await step(tok);                                   // 32:15 we discovered it does not exist
  bad('這個摺法（只用這些摺痕）其實不存在！', -2.6, 1.8);
  sayc('兩年前發現：它其實不存在', '只用這些摺痕摺不出來');
  await step(tok);                                   // 32:38 rounded creases or tiny extra creases
  sayc('實物可能摺痕被圓化', '或其實有看不到的微小額外摺痕');
  await step(tok);                                   // 33:24 theorem: extra creases must be there
  sayc('定理：一定要有額外的摺痕', '只用原本的摺痕不行');
  await step(tok);                                   // 33:32 concentric circles: probably exists
  sayc('同心圓的版本：應該存在', '但還沒證明');
  await step(tok);                                   // 33:59 a magic trick: fold and cut
  hd('Fold-and-cut', 0, 1.0);
  sayc('魔術：摺平之後，剪一刀');
  await step(tok);                                   // 34:16 one straight cut → a swan
  kill(paper); bx('天鵝', C.B, -4.2, 0.4, 2.2, 1.6, 2, 0.5, 0.8);
  sayc('只剪一刀直線', '攤開得到一隻天鵝');
  await step(tok);                                   // 34:45 angelfish; MIT logo
  bx('神仙魚', C.O, -2.2, 0.4, 2.2, 1.6, 2, 0.5, 0.8); bx('MIT logo', C.R, -0.2, 0.4, 2.2, 1.6, 2, 0.5, 0.8);
  sayc('有對稱軸的神仙魚', '甚至 MIT 的 logo');
  await step(tok);                                   // 35:25 theorem: any set of polygons
  good('定理：任何一組多邊形，都能摺好後一刀剪出', 2.6, 1.0);
  sayc('定理：任何一組多邊形', '都能摺好、剪一刀得到');
  void dz;
}]);

// 35:46 記憶體階層：block、cache-oblivious
FRAG.push(['bt-mit24-cache', '研究主題：記憶體以 block 傳輸的計算模型', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.6, 0]);
  const pn = panel(3.0, 6.0, 0.62);
  await step(tok);                                   // 35:46 data structures; the memory picture
  card('CPU', C.B, -4.2, 5.0, 0, 1.6); card('cache（快、小）', C.G, -4.2, 3.6, 0, 2.6); card('主記憶體（慢、大）', C.O, -4.2, 1.2, 0, 3.0);
  sayc('談資料結構：用同一張記憶體圖');
  await step(tok);                                   // 35:59 word RAM: everything constant time
  pn.add('word RAM：每個操作都 O(1)');
  sayc('這門課用的 word RAM', '讀寫任何記憶體都一樣快');
  await step(tok);                                   // 36:18 real computers: a slow bottleneck
  const pipe = rod(V3(-4.2, 3.3, 0), V3(-4.2, 1.5, 0), C.R, 0.05);
  rod(V3(-4.2, 4.7, 0), V3(-4.2, 3.9, 0), C.G, 0.2);
  sayc('真實電腦：cache 和主記憶體之間很慢', 'cache 是粗水管、主記憶體這段是細水管');
  await step(tok);                                   // 36:40 want to stay in cache; it runs out
  sayc('希望都在 cache 裡做', '但空間會用完，只好去主記憶體');
  await step(tok);                                   // 36:51 fetch an entire block (cache line)
  for (let i = 0; i < 4; i++) cube('', C.Y, [0.4, 0.3, 0.3], -5.0 + i * 0.5, 2.2, 0.4, 1.5);
  sayc('一次不是拿一個字', '而是拿一整塊（cache line / block）');
  await step(tok);                                   // 37:19 B = block size; count memory transfers
  pn.add('B = block 大小；算「記憶體傳輸次數」', 'ptr alt');
  sayc('B = 一個 block 的大小', '新模型：以 n、B 的函數計算傳輸次數');
  await step(tok);                                   // 37:35 search: log_B n instead of log₂ n
  pn.add('搜尋：log₂ n → log_B n');
  sayc('搜尋：二分是 log n', '做對的話只要 log_B n 次傳輸');
  await step(tok);                                   // 37:56 computation is free here
  sayc('這個模型只算傳輸，計算免費');
  await step(tok);                                   // 38:03 sorting: (n/B) log_C (n/B)
  pn.add('排序：(n/B) · log_C (n/B)，C = cache 可放的 block 數');
  sayc('排序最佳是 (n/B) log_C (n/B)', 'C = cache 能放幾個 block');
  await step(tok);                                   // 38:24 optimal upper and lower bounds
  sayc('這是 comparison model 下的最佳上下界');
  await step(tok);                                   // 38:33 cache-oblivious: no need to know B or C
  pn.add('cache-oblivious：不知道 B、C 也能達到', 'good');
  sayc('不知道 B、C 也能達到同樣的界', '叫 cache-oblivious algorithm，MIT 發明的');
  void pipe;
}]);

// 38:57 predecessor：van Emde Boas、fusion tree
FRAG.push(['bt-mit24-pred', '研究主題：predecessor 問題的最佳界', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.6, 0]);
  const pn = panel(0, 5.6, 0.68);
  await step(tok);                                   // 38:57 a dynamic set of integers on the word RAM
  hd('Predecessor problem', 0, 6.4);
  sayc('word RAM 上的經典問題：維護一個動態整數集合');
  await step(tok);                                   // 39:08 insert, delete, predecessor, successor
  pn.add('insert、delete、predecessor、successor');
  sayc('支援插入、刪除、找前一個 / 後一個', '這是 BST 在做的事');
  await step(tok);                                   // 39:16 n integers in 0 … u − 1
  pn.add('n 個整數，範圍 0 … u − 1（u = universe 大小）');
  sayc('但可以更好：n 個整數，範圍 0 到 u − 1');
  await step(tok);                                   // 39:33 we know log n
  pn.add('平衡 BST：O(log n)');
  sayc('平衡 BST 是 O(log n)');
  await step(tok);                                   // 39:39 van Emde Boas: log log u
  pn.add('van Emde Boas：O(log log u)（CLRS 有）', 'ptr alt');
  sayc('van Emde Boas tree：O(log log u)', 'CLRS 裡有');
  await step(tok);                                   // 39:53 fusion trees: log n / log log u
  pn.add('fusion tree：O(log n / log log u)', 'ptr alt');
  sayc('fusion tree：O(log n / log log u)');
  await step(tok);                                   // 40:07 the min of the two is optimal
  pn.add('取兩者較小的 → 最佳（有對應的下界）', 'good');
  sayc('取兩者的最小值', '就是最佳的（有相符的下界）');
  await step(tok);                                   // 40:17 at most √(log n / log log n)
  pn.add('用 n 表示：≤ O(√(log n / log log n))', 'good');
  sayc('只用 n 表示：最多 √(log n / log log n)');
  await step(tok);                                   // 40:37 compare with log n: way better
  sayc('和 log n 比：好了一個平方根', '還多省一點');
  await step(tok);                                   // 40:48 complicated, impractical, cool
  sayc('非常複雜、大概不實用', '但理論上很酷');
}]);

// 40:58 planar graph 的最短路徑
FRAG.push(['bt-mit24-planar', '研究主題：平面圖上的最短路徑', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.6, 0]);
  const pn = panel(2.6, 5.6, 0.68);
  await step(tok);                                   // 40:58 graph algorithms: planar graphs
  const P = ringP([1, 2, 3, 4, 5, 6], -3.6, 0, 1.8, 2.4);
  const G = {}; for (const v in P) G[v] = [P[v][0], P[v][2] + 2.6, 0];
  graph(G, [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 3], [1, 4], [4, 6]], { size: [0.4, 0.4, 0.4], r: 0.04 });
  sayc('讓圖演算法變新鮮：假設圖是 planar（平面圖）');
  await step(tok);                                   // 41:29 drawn without crossings: road networks
  sayc('畫在平面上沒有交叉', '像路網（很少高架橋）');
  await step(tok);                                   // 41:39 Dijkstra in linear time
  pn.add('非負權最短路徑（Dijkstra）：O(n)', 'good');
  sayc('非負權重最短路徑：線性時間');
  await step(tok);                                   // 41:52 only a log saving vs E log V
  sayc('原本 Dijkstra 是 E log V', '只省了一個 log，不算太驚人');
  await step(tok);                                   // 42:06 negative weights: almost linear
  pn.add('負權重（Bellman–Ford）：幾乎線性', 'good');
  sayc('更厲害的是允許負權重（Bellman–Ford 的問題）', '也幾乎線性時間');
  await step(tok);                                   // 42:20 O(n log² n / log log n): last year
  pn.add('O(n log² n / log log n)：去年的結果');
  sayc('目前最好：n log² n / log log n', '去年才做出來，還在進步');
  await step(tok);                                   // 42:28 course 6.889
  sayc('有興趣可以看 6.889 的上課影片');
}]);

// 42:35 recreational algorithms
FRAG.push(['bt-mit24-games', '研究主題：遊戲與趣味演算法', async (tok) => {
  fresh([0, 3.8, 12], [0, 2.6, 0]);
  await step(tok);                                   // 42:35 recreational algorithms
  hd('Recreational algorithms', 0, 5.6);
  sayc('最後：趣味演算法');
  await step(tok);                                   // 42:38 Rubik's cube in n²/log n moves
  card('Rubik’s cube：Θ(n² / log n) 步', C.R, -3.0, 4.0, 0, 4.4);
  sayc('n×n×n 魔術方塊：n² / log n 步就能解');
  await step(tok);                                   // 42:44 Tetris NP-complete; games
  card('Tetris：NP-complete', C.B, 3.0, 4.0, 0, 3.6);
  sayc('Tetris 是 NP-complete', '很多遊戲的 NP-complete、EXPTIME-complete 結果');
  await step(tok);                                   // 42:52 balloon twisting, magic tricks
  card('氣球造型、演算法魔術', C.O, 0, 2.6, 0, 4.0);
  sayc('還有用最少氣球扭出多面體', '和演算法魔術');
}]);

// ════════ hkAONP0aC9w（MIT 6.006 Rec 24：Final Exam Review） ════════
// 切木頭 DP：dp[i][j] = min_{i<k<j} dp[i][k] + dp[k][j] + (M_k − M_i)(M_j − M_k)，O(n³)（像 parenthesization）。
// 位元雜湊集合：P(false positive) = 1 − (1 − 1/m)^n；Bloom filter（k 個 hash）：(1 − (1 − 1/m)^{nk})^k。
const BOARD = { L: 10, M: [0, 3, 5, 8, 10] };
const bX = (v) => -4.5 + v * 0.9;
function woodWorld(y = 1.2, marks = true) {
  const w = cube('', '#c99a5b', [BOARD.L * 0.9, 0.5, 0.9], bX(BOARD.L / 2), y, 0);
  const T = [];
  if (marks) BOARD.M.forEach((m, i) => { if (i && i < BOARD.M.length - 1) { rod(V3(bX(m), y - 0.3, 0.47), V3(bX(m), y + 0.3, 0.47), C.R, 0.03); } T.push(tag('M' + i + (i && i < BOARD.M.length - 1 ? '=' + m : ''), 'idx', bX(m), y - 0.6, 0.5)); });
  return { w, T };
}
function bitTable(m = 16, y = 1.0, x0 = -6.0) {
  const cells = []; for (let i = 0; i < m; i++) cells.push(cube(0, C.K, [0.62, 0.5, 0.5], x0 + i * 0.78, y, 0));
  return { cells, set(i) { relabel(cells[i], 1); tint(cells[i], C.G); }, x: (i) => x0 + i * 0.78 };
}

// 1:03 切木頭：成本 L1 × L2
FRAG.push(['bt-mit24r-wood', '期末複習：切木頭問題', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.0, 0]);
  let W = null;
  await step(tok);                                   // 1:03 how much wood would a woodchuck chuck
  sayc('今天來「劈木頭」（wood chucking）');
  await step(tok);                                   // 1:12 a piece of wood L meters long
  W = cube('', '#c99a5b', [BOARD.L * 0.9, 0.5, 0.9], bX(5), 1.2, 0, 2);
  tag('長 L 公尺', 'ptr', bX(5), 2.0);
  sayc('一根長 L 公尺的木頭');
  await step(tok);                                   // 1:16 n markings: 3, 5, …
  [3, 5].forEach((m, i) => { rod(V3(bX(m), 0.9, 0.47), V3(bX(m), 1.5, 0.47), C.R, 0.03); tag('M' + (i + 1) + '=' + m, 'idx', bX(m), 0.6, 0.5); });
  sayc('上面有 n 個記號：M1 在 3 公尺、M2 在 5 公尺…');
  await step(tok);                                   // 1:37 M3, M4, … Mn
  rod(V3(bX(8), 0.9, 0.47), V3(bX(8), 1.5, 0.47), C.R, 0.03); tag('M3=8', 'idx', bX(8), 0.6, 0.5);
  sayc('一直到 Mn');
  await step(tok);                                   // 1:44 cut at all the markings
  sayc('要在每個記號都切一刀');
  await step(tok);                                   // 1:50 not free: L → L1 + L2
  sayc('劈木頭的人要收錢', '把長 L 的木頭切成 L1、L2 兩段');
  await step(tok);                                   // 2:07 price L1 × L2
  hot('一刀的價錢 = L1 × L2', 0, 3.4);
  sayc('一刀的價錢 = L1 × L2');
  await step(tok);                                   // 2:16 pay the minimum
  sayc('目標：切完所有記號，總花費最少');
  await step(tok);                                   // 2:36 quizzes give running times: eliminate
  note('考試常給執行時間 → 用它刪去不符合的方法', 0, 4.2);
  sayc('考試通常會給執行時間', '先用它刪掉不相符的方法');
  await step(tok);                                   // 2:57 all marks get cut; the order matters
  sayc('老師說：切的順序會影響花費', '（成本 L1 × L2 時總和其實固定，見補充）');
  await step(tok);                                   // 3:04 cut at 3 first: 3 × (L − 3)
  const a = pkt('先切 3：3 × 7 = 21', bX(3), 2.6);
  sayc('先在 3 切：付 3 × (L − 3) = 3 × 7');
  await step(tok);                                   // 3:09 cut in the middle first: M3 × (L − M3)
  txt(a, '先切 M3：M3 × (L − M3) = 8 × 2');
  sayc('先切別的記號：付 M × (L − M)');
  await step(tok);                                   // 3:23 deciding the order: DP
  sayc('要決定切的順序', '→ 用 DP');
  await step(tok);                                   // 4:10 not prefixes / suffixes: O(n³) like parentheses
  note('不是 prefix / suffix：O(n³)，像 parenthesization', 0, 5.0);
  sayc('recitation 練過 prefix、suffix', '這題是 O(n³)，像加括號問題');
  await step(tok);                                   // 4:31 n³: the only n³ problem in the notes
  sayc('講義裡只有一題 O(n³) 的 DP', '一看到 n³ 就該想到它');
  void W;
}]);

// 5:00 子問題：dp[i][j]
FRAG.push(['bt-mit24r-sub', '期末複習：切木頭的子問題 dp[i][j]', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.0, 0]);
  const W = woodWorld(1.2, true);
  const fake = [W.T[0], W.T[4]]; fake.forEach((t) => showL(t, false));
  let def = null;
  await step(tok);                                   // 5:00 what is a subproblem?
  sayc('子問題是什麼？');
  await step(tok);                                   // 5:12 write "dp(…) means …"
  def = note('dp[?] = ?', 0, 4.6);
  sayc('寫考卷時一定要寫出「dp[…] 代表什麼」');
  await step(tok);                                   // 5:25 helps the recursion; helps the grader
  sayc('好處：遞迴式比較不會寫錯', '閱卷者看到定義也比較好給分');
  await step(tok);                                   // 5:45 a DP table holds numbers
  sayc('DP 表格裡放的永遠是「數字」', '最大利潤、最小成本、最短距離…');
  await step(tok);                                   // 6:04 start to end: indices i, j
  sayc('從起點到終點 → 用索引 i、j');
  await step(tok);                                   // 6:18 min cost of cutting from marking i to marking j
  txt(def, 'dp[i][j] = 把記號 i 到記號 j 這段切完的最小成本');
  const seg = P.ghostBox(C.Y, bX(5) - bX(3), 0.8, 1.2); seg.position.set((bX(3) + bX(5)) / 2, 1.2, 0);
  sayc('dp[i][j]：記號 i 到記號 j 之間', '這段木板全部切完的最小成本');
  await step(tok);                                   // 6:43 the two ends get left out
  sayc('問題：只看記號 1 到 n', '兩端（0 到 M1、Mn 到 L）被漏掉了');
  await step(tok);                                   // 7:14 fake markings M0 = 0, Mn+1 = L
  fake.forEach((t) => showL(t, true));
  txt(fake[0], 'M0 = 0'); txt(fake[1], 'M4 = L');
  sayc('加兩個假記號：M0 = 0、Mₙ₊₁ = L', '整根木頭就是 dp[0][n+1]');
  await step(tok);                                   // 7:21 not evenly spaced: real numbers
  sayc('記號不一定等距', '它們只是一些實數');
  await step(tok);                                   // 7:49 write this definition on your exam
  setCls(def, 'ptr alt');
  sayc('把這行定義寫在考卷上', '下一步寫遞迴式就容易了');
}]);

// 8:01 遞迴式：枚舉第一刀的位置 k
FRAG.push(['bt-mit24r-rec', '期末複習：切木頭的遞迴式（O(n³)）', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.2, 0]);
  const W = woodWorld(1.2, true);
  const eq = note('', 0, 5.0); showL(eq, false);
  const show = (t) => { txt(eq, t); showL(eq, true); };
  let sel = null, kL = null;
  const box = (a, b, c = C.Y) => { const g = P.ghostBox(c, bX(b) - bX(a), 0.8, 1.2); g.position.set((bX(a) + bX(b)) / 2, 1.2, 0); return g; };
  await step(tok);                                   // 8:01 how to compute dp[i][j]? the sub-board M1..M4
  sel = box(3, 10);
  sayc('怎麼算 dp[i][j]？', '先看 M1 到 M4 這段');
  await step(tok);                                   // 8:16 options?
  sayc('有哪些選擇？');
  await step(tok);                                   // 8:39 first cut at M2, then recurse on both
  kL = pkt('第一刀', bX(5), 2.2);
  sayc('第一刀切在 M2', '左右兩段再遞迴去切');
  await step(tok);                                   // 8:52 or first cut at M3
  kL.position.x = bX(8);
  sayc('或者第一刀切在 M3', '再遞迴切左右兩段');
  await step(tok);                                   // 9:10 iterate over all the markings inside
  sayc('把段內每個記號都當第一刀試一次');
  await step(tok);                                   // 9:24 M1..M4 cut at M2: total?
  kL.position.x = bX(5);
  sayc('M1..M4 第一刀切在 M2，總成本是？');
  await step(tok);                                   // 9:44 best for M1..M2 + best for M2..M4
  kill(sel); box(3, 5, C.B); box(5, 10, C.G);
  show('dp[M1..M2] + dp[M2..M4]');
  sayc('左段最佳 + 右段最佳');
  await step(tok);                                   // 10:07 + the price of this cut
  show('dp[M1..M2] + dp[M2..M4] + (M2 − M1)(M4 − M2)');
  sayc('再加上這一刀的價錢', '兩段長度相乘：(M2 − M1)(M4 − M2)');
  await step(tok);                                   // 10:46 use concrete numbers, then letters
  sayc('先用具體數字想', '再把數字換回字母');
  await step(tok);                                   // 11:07 here i = M1, j = M4
  tag('i', 'ptr alt', bX(3), 2.4); tag('j', 'ptr alt', bX(10), 2.4);
  sayc('這裡 i 是 M1、j 是 M4');
  await step(tok);                                   // 11:24 dp[i][j] = min over …
  show('dp[i][j] = min over k { … }');
  sayc('dp[i][j] = 對某個變數取 min');
  await step(tok);                                   // 11:59 a new variable k: the marking we cut at
  txt(kL, 'k');
  sayc('需要新變數 k：第一刀切在哪個記號');
  await step(tok);                                   // 12:21 dp[i][k] + dp[k][j] + (M_k − M_i)(M_j − M_k)
  show('dp[i][j] = min_k { dp[i][k] + dp[k][j] + (M_k − M_i)(M_j − M_k) }');
  sayc('左段 dp[i][k] + 右段 dp[k][j]', '+ 這一刀 (M_k − M_i)(M_j − M_k)');
  await step(tok);                                   // 13:30 the loop range for k
  sayc('k 的範圍是多少？');
  await step(tok);                                   // 13:48 k = i → the same subproblem → infinite
  bad('k = i：遞迴到自己 → 無窮遞迴', 0, 4.1);
  sayc('k = i 的話會遞迴到同一個子問題', '執行時間變成無限');
  await step(tok);                                   // 14:09 k from i + 1 to j − 1
  show('dp[i][j] = min over i<k<j { dp[i][k] + dp[k][j] + (Mₖ − Mᵢ)(Mⱼ − Mₖ) }');
  sayc('k 從 i + 1 到 j − 1');
  await step(tok);                                   // 14:20 k is a marking: the only discrete things
  sayc('i、j、k 都是「第幾個記號」', '木頭上的位置是實數，記號給我們整數');
  await step(tok);                                   // 15:09 iterates over markings; like parentheses
  hot('子問題 O(n²) 個 × 每個 O(n) = O(n³)', 0, 3.4);
  sayc('和加括號問題幾乎一樣', 'n² 個子問題 × O(n) 個 k = O(n³)');
  await step(tok);                                   // 15:20 substring subproblems: same as parentheses but the cost
  sayc('「子字串」型的 DP 比較少見也比較難', '考題多半就像加括號，只換成本函數');
  await step(tok);                                   // 15:42 be ready for a different cost function
  sayc('要準備好：形式一樣、成本函數不同的題目');
  void W;
}]);

// 15:53 Q&A：每種 DP 技巧都能用在每一題嗎？
FRAG.push(['bt-mit24r-qa', '期末複習 Q&A：選哪種子問題，看執行時間', async (tok) => {
  fresh([0, 3.6, 11.5], [0, 2.6, 0]);
  const cards = [['prefix  x[:i]', C.B, -4.2, 'n 個子問題'], ['suffix  x[i:]', C.P, 0, 'n 個子問題'], ['substring  x[i:j]', C.O, 4.2, 'n² 個子問題']];
  const K3 = [];
  let lb1 = null, lb2 = null;
  await step(tok);                                   // 15:53 does any DP technique solve any problem, only complexity changes?
  for (const [t, c, x, s] of cards) { K3.push(card(t, c, x, 5.3, 0, 3.4)); tag(s, 'idx', x, 4.55, 0.4); await wt(tok, 200); }
  sayc('Q：每種子問題技巧都能解每一題', '只差在複雜度嗎？');
  await step(tok);                                   // 16:13 prefixes on wood cutting: misses choices → fast but wrong
  woodWorld(0.9);
  glow(K3[0], REDEM);
  lb1 = bad('prefix 套到切木頭：沒看到所有切法 → 快但錯 ✕', 0, 3.4);
  sayc('不是每個技巧都套得上', '切木頭用 prefix：漏掉一些選擇，答案不是最佳');
  await step(tok);                                   // 16:30 LIS with substrings: works (more general) but slower
  glow(K3[0], null); glow(K3[2], GREEN);
  lb2 = good('最長遞增子序列（LIS）用 substring：可以，但比較慢', 0, 2.6);
  sayc('LIS 用 substring 一定行', 'substring 比 prefix／suffix 更一般，但比較慢');
  await step(tok);                                   // 16:44 in theory: try all, keep the ones that apply, pick the fastest
  remove(lb1); remove(lb2); glow(K3[2], null);
  K3.forEach((m) => glow(m, GOLD));
  lb1 = note('理論上：每個技巧都試 → 留下適用的 → 挑執行時間最好的', 0, 3.4);
  sayc('理論上：所有技巧都試一遍', '在適用的裡面挑最快的');
  await step(tok);                                   // 16:56 in practice: the given running time tells you the technique
  K3.forEach((m) => glow(m, null)); glow(K3[2], GOLD);
  lb2 = hot('實務上：題目給 O(n³) → n² 個子問題 × O(n) 個選擇 → substring', 0, 2.6);
  sayc('實務上：題目通常會給執行時間', '從執行時間倒推該用哪種技巧');
}]);

// 17:15 位元表實作 set
FRAG.push(['bt-mit24r-bits', '期末複習：只存位元的 hash 集合', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.0, 0]);
  let T = null;
  const els = [];
  await step(tok);                                   // 17:15 a hard problem: hashing
  sayc('接著一題比較難的：hashing');
  await step(tok);                                   // 17:28 implement a set: insert n elements
  for (let i = 0; i < 5; i++) els.push(bx('e' + (i + 1), C.B, -4.8 + i * 1.3, 4.6, 0, 1.0, 2, 0.5, 0.5));
  sayc('實作一個 set：先把 n 個元素插進去');
  await step(tok);                                   // 17:57 then: is f in the set?
  const f = bx('f', C.O, 4.2, 4.6, 0, 1.0, 2, 0.5, 0.5);
  sayc('之後給一個數 f：問它在不在 set 裡');
  await step(tok);                                   // 18:22 normally a hash table
  sayc('平常會用 hash table');
  await step(tok);                                   // 18:37 too much memory
  bad('存整個元素 → 記憶體不夠', 0, 5.6);
  sayc('但記憶體不夠存所有元素');
  await step(tok);                                   // 18:44 a table of m bits, uniform hashing
  T = bitTable(12, 1.4, -4.3);
  tag('m 個位元，一開始全是 0', 'idx', 0, 0.6);
  sayc('改用 m 個位元的表 T', 'hash 函數滿足 uniform hashing');
  await step(tok);                                   // 19:12 insert: T[h(a_i)] = 1
  const hit = [2, 7, 7, 10, 4];
  await travel(tok, pkt('h(e1)', 0, 3.4), V3(-4.8, 3.4, 0), V3(T.x(2), 2.2, 0), 600);
  T.set(2);
  sayc('插入：把 T[h(eᵢ)] 設成 1');
  await step(tok);                                   // 19:26 every element sets its bit
  hit.slice(1).forEach((h) => T.set(h));
  sayc('每個元素都 hash 一次、把那格設成 1', '有些格子是 1、有些是 0');
  await step(tok);                                   // 19:43 new f: probability the set says yes?
  glow(f, GOLD);
  hot('P(false positive) = ?', 0, 3.2);
  sayc('n 個元素、m 個位元', '新元素 f 被誤判「在」的機率？');
  await step(tok);                                   // 20:21 elements are gone: less memory, but false positives
  sayc('元素本身沒存下來，省很多記憶體', '代價是會有 false positive');
  await step(tok);                                   // 20:53 false negatives? no
  good('不會有 false negative', 0, 5.6);
  sayc('會有 false negative 嗎？不會', '真的插入過的那格一定是 1');
  void els;
}]);

// 20:53 P(false positive) = 1 − (1 − 1/m)^n
FRAG.push(['bt-mit24r-fp', '期末複習：false positive 機率 1 − (1 − 1/m)ⁿ', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.0, 0]);
  const T = bitTable(12, 1.4, -4.3);
  [2, 7, 10, 4].forEach((h) => T.set(h));
  const pn = panel(0, 6.2, 0.6);
  await step(tok);                                   // 21:33 a guess: less than n / m
  sayc('有人猜：小於 n / m');
  await step(tok);                                   // 21:56 check: compute h(f), look at T[h(f)]
  pn.add('查詢：算 h(f)，看 T[h(f)] 是 0 還是 1');
  sayc('怎麼查 f？算 h(f)，看那格是不是 1');
  await step(tok);                                   // 22:13 h(f) is an independent random slot
  const q = pkt('h(f)', T.x(7), 2.3);
  sayc('f 和其他元素不同', 'h(f) 是一個獨立、隨機的位置');
  await step(tok);                                   // 22:42 k ones → P = k / m
  pn.add('表裡有 k 個 1 → P = k / m');
  sayc('如果表裡有 k 個 1', '猜中 1 的機率 = k / m');
  await step(tok);                                   // 23:23 at most n ones → ≤ n / m
  pn.add('最多 n 個 1 → P ≤ n / m');
  sayc('最多 n 個 1', '所以答案 ≤ n / m');
  await step(tok);                                   // 23:40 not exactly n: collisions
  sayc('但不一定剛好 n 個 1', '兩個元素可能 hash 到同一格');
  await step(tok);                                   // 24:03 only care: how many 1s after n inserts
  sayc('現在只關心：插完 n 個後', '表裡有幾個 1？');
  await step(tok);                                   // 24:22 E[k] = m · P(a slot is 1)
  pn.add('E[k] = m × P(某一格是 1)');
  sayc('期望的 1 的個數 = m × P(一格是 1)');
  await step(tok);                                   // 25:24 answer = E[k] / m = P(a slot is 1)
  pn.add('答案 = E[k] / m = P(某一格是 1)', 'ptr alt');
  sayc('所以答案 = E[k] / m', '= 某一格是 1 的機率');
  await step(tok);                                   // 25:56 = 1 − P(slot is 0)
  pn.add('= 1 − P(那格是 0)');
  sayc('第一招：P(是 1) = 1 − P(是 0)');
  await step(tok);                                   // 26:38 a slot is 0 iff no insertion hit it
  sayc('一格是 0 ⇔ 沒有任何一次插入打中它');
  await step(tok);                                   // 27:10 P(one insertion misses)^n
  pn.add('P(那格是 0) = P(一次插入沒打中)ⁿ');
  sayc('插入彼此獨立', '= P(一次沒打中) 的 n 次方');
  await step(tok);                                   // 28:24 P(miss) = 1 − 1/m
  pn.add('P(一次沒打中) = 1 − 1/m');
  sayc('uniform hashing：打中的機率 1/m', '沒打中 = 1 − 1/m');
  await step(tok);                                   // 28:53 answer 1 − (1 − 1/m)^n
  pn.add('P(false positive) = 1 − (1 − 1/m)ⁿ', 'good');
  sayc('P(false positive) = 1 − (1 − 1/m)ⁿ');
  void q;
}]);

// 29:26 推導細節：P(某格是 0) = ((m − 1)/m)ⁿ
FRAG.push(['bt-mit24r-zero', '期末複習：P(某格是 0) = ((m−1)/m)ⁿ 的推導', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.4, 0]);
  const T = bitTable(10, 1.2, -3.5);
  const E = [0, 1, 2, 3].map((i) => bx('e' + (i + 1), C.B, -3.0 + i * 2.0, 4.8, 0, 0.9, 2, 0.5, 0.5));
  const pn = panel(0, 6.6, 0.5);
  const hit = [1, 5, 5, 8];
  let arrows = [];
  await step(tok);                                   // 29:26 don't panic: the exam is easier
  sayc('別慌：考試不會這麼難', '重點是複習機率和 hashing 的數學');
  await step(tok);                                   // 29:43 n elements e1 … en
  sayc('有 n 個元素 e1、e2、…、en');
  await step(tok);                                   // 30:08 each hashes to a random slot
  for (let i = 0; i < 4; i++) { arrows.push(arrow(V3(-3.0 + i * 2.0, 4.5, 0), V3(T.x(hit[i]), 1.6, 0), 0x6e5f49)); }
  sayc('每個元素各自 hash 到一個隨機的格子');
  await step(tok);                                   // 30:38 not necessarily different slots; those are 1
  hit.forEach((h) => T.set(h));
  sayc('不一定落在不同格（e2、e3 撞在一起）', '被打中的變 1，其餘是 0');
  await step(tok);                                   // 30:54 look at one slot: P(0)?
  glow(T.cells[3], GOLD);
  sayc('看任意一格：它是 0 的機率？');
  await step(tok);                                   // 31:09 P(e1 missed AND e2 missed AND … en missed)
  pn.add('P(0) = P(e1 沒打中 且 e2 沒打中 且 … 且 en 沒打中)');
  sayc('= P(e1 沒打中，而且 e2 沒打中…', '…而且 en 也沒打中)');
  await step(tok);                                   // 32:06 independent → AND becomes a product
  pn.add('獨立 → 「且」變成相乘');
  sayc('uniform hashing：各次 hash 互相獨立', '所以「且」可以變成乘法');
  await step(tok);                                   // 32:50 same hash function → same probability → ^n
  pn.add('每項都一樣 → P(一個元素沒打中)ⁿ');
  sayc('同一個 hash 函數，每項機率一樣', '→ 變成 n 次方');
  await step(tok);                                   // 33:15 cheat sheet: probability, hashing assumptions
  sayc('機率性質和 hashing 假設', '要放進小抄、複習一下');
  await step(tok);                                   // 33:41 P(e1 misses) = (m − 1)/m, not 1/m
  pn.add('P(沒打中這格) = (m − 1)/m（打中才是 1/m）', 'ptr alt');
  sayc('沒打中這格：可以落在其他 m − 1 格', '機率 (m − 1)/m，不是 1/m');
  await step(tok);                                   // 34:20 the complement trick makes it doable
  sayc('「取補集」看起來簡單', '卻能把難題變成做得出來的題目');
  await step(tok);                                   // 35:43 false positive = new element hits a 1
  glow(T.cells[3], null); glow(T.cells[5], GOLD);
  sayc('false positive：新元素 hash 到一個 1', '其實它不在 set 裡');
}]);

// 36:36 Bloom filter
FRAG.push(['bt-mit24r-bloom', '期末複習：Bloom filter 的 false positive', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.2, 0]);
  const T = bitTable(12, 1.2, -4.3);
  const pn = panel(0, 6.4, 0.55);
  const hs = [[1, 6, 9], [3, 6, 11]];
  await step(tok);                                   // 36:36 a harder version: Bloom filters
  hd('Bloom filter', -4.4, 6.4);
  sayc('加一個技巧，就是大名鼎鼎的 Bloom filter');
  await step(tok);                                   // 37:01 still n elements, m bits
  sayc('一樣 n 個元素、m 個位元');
  await step(tok);                                   // 37:16 k hash functions
  pn.add('k 個獨立的 hash 函數 h1 … hk');
  sayc('差別：改用 k 個 hash 函數');
  await step(tok);                                   // 37:27 insert: compute all k hashes, set the bits
  const e = bx('e1', C.B, -4.4, 4.4, 0, 0.9, 2, 0.5, 0.5);
  hs[0].forEach((h) => { arrow(V3(-4.4, 4.1, 0), V3(T.x(h), 1.6, 0), 0x6e5f49); T.set(h); });
  sayc('插入 e：用 k 個 hash 都算一次', '把這 k 格都設成 1');
  await step(tok);                                   // 37:54 for j in 1..k: T[h_j(e_i)] = 1
  pn.add('insert：for j = 1..k：T[hⱼ(eᵢ)] = 1');
  hs[1].forEach((h) => T.set(h));
  sayc('每個元素設 k 個位元為 1');
  await step(tok);                                   // 38:16 check: compute the k positions; any 0 → not in
  const f = bx('f', C.O, 4.4, 4.4, 0, 0.9, 2, 0.5, 0.5);
  [2, 6, 9].forEach((h) => arrow(V3(4.4, 4.1, 0), V3(T.x(h), 1.6, 0), 0xa8730f));
  glow(T.cells[2], REDEM);
  sayc('查詢 f：算出 k 個位置', '只要有一格是 0，f 一定不在');
  await step(tok);                                   // 38:52 all T[h_j(f)] must be 1
  pn.add('query：所有 T[hⱼ(f)] 都是 1 才說「在」');
  sayc('k 格全都是 1，才回答「在」');
  await step(tok);                                   // 39:28 the hash functions are independent
  sayc('假設 k 個 hash 函數互相獨立', '值都均勻落在 0 … m − 1');
  await step(tok);                                   // 40:35 P(fp) = P(a slot is 1)^k
  pn.add('P(fp) = P(某一格是 1)ᵏ', 'ptr alt');
  sayc('false positive = k 格全是 1', '= P(一格是 1) 的 k 次方');
  await step(tok);                                   // 41:18 P(a slot is 1)? like before, with a tweak
  sayc('P(一格是 1) 和剛才那題很像', '只差一點');
  await step(tok);                                   // 41:33 n sets before; now n·k sets
  pn.add('之前設 n 次 1；現在設 n·k 次');
  sayc('之前每個元素設 1 次 → 共 n 次', '現在每個設 k 次 → 共 nk 次');
  await step(tok);                                   // 42:38 all independent: replace n with nk
  sayc('每次設哪一格都互相獨立', '把剛才答案的 n 換成 nk 就好');
  await step(tok);                                   // 43:26 (1 − (1 − 1/m)^{nk})^k
  pn.add('P(fp) = (1 − (1 − 1/m)ⁿᵏ)ᵏ', 'good');
  sayc('P(fp) = (1 − (1 − 1/m)ⁿᵏ)ᵏ');
  await step(tok);                                   // 43:47 one element sets k (not necessarily distinct) bits
  sayc('一個元素設 k 個位元（可能重複）', 'n 個元素共設 nk 次');
  await step(tok);                                   // 44:44 the hardest hashing problem; the exam is easier
  sayc('這是能想到最難的 hashing 題', '考試會簡單些：複習 hashing 和機率');
  void e; void f;
}]);

// 45:18 獨立性、實際用途
FRAG.push(['bt-mit24r-use', '期末複習：獨立性假設與 Bloom filter 的用途', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.4, 0]);
  const pn = panel(0, 6.0, 0.62);
  await step(tok);                                   // 45:18 inside: the previous answer with n → nk
  pn.add('1 − (1 − 1/m)ⁿᵏ：一格是 1 的機率（n 換成 nk）');
  sayc('括號裡就是上一題的答案', '只是 n 換成 nk');
  await step(tok);                                   // 45:36 query: hash through k functions, check k bits
  pn.add('查詢要檢查 k 個位元');
  sayc('查詢時用 k 個函數 hash', '檢查 k 個位元');
  await step(tok);                                   // 45:50 any 0 → not a false positive; need all 1
  pn.add('任一個 0 → 不是 false positive；全 1 才是 → 再取 k 次方');
  sayc('任一格是 0 就不會誤判', '要 k 格全是 1 → k 次方');
  await step(tok);                                   // 46:35 reduce to independent hashing
  pn.add('證明都假設 uniform hashing → 化成「獨立」', 'ptr alt');
  sayc('證明都假設 uniform hashing', '把問題化成獨立事件');
  await step(tok);                                   // 46:54 dependent → very hard
  sayc('事件獨立 → 機率可以相乘，很好算', '不獨立的話證明會非常難');
  await step(tok);                                   // 47:19 much better; choose k to minimise
  pn.add('選 k 讓 P(fp) 最小（最佳約 k = (m/n) ln 2）', 'good');
  sayc('這比單一 hash 好很多', '可以選 k 讓誤判率最小');
  await step(tok);                                   // 48:17 practical: branch predictors, databases
  sayc('實務上到處都在用', '從處理器的 branch predictor 到資料庫');
  await step(tok);                                   // 48:41 put it before an expensive check
  bx('Bloom filter', C.G, -3.0, 1.4, 0, 2.4, 2, 0.6, 0.8); bx('昂貴的檢查', C.O, 2.0, 1.4, 0, 2.4, 2, 0.6, 0.8);
  rod(V3(-1.8, 1.4, 0), V3(0.8, 1.4, 0), C.D, 0.05);
  sayc('放在昂貴的檢查前面', '先擋掉大部分，剩下少數再仔細查');
  await step(tok);                                   // 49:25 doubling memory beats two filters
  sayc('把記憶體加倍，比用兩個獨立的 filter 好');
}]);
  }
  // ═══ Nn_Eq7--Rk4（The Academician：Las Vegas vs Monte Carlo 隨機演算法） ═══
  // 陣列 n = 8，a 一定在陣列裡（在 A[4]），兩種隨機搜尋：
  //   Las Vegas：while (true) 隨機挑一格，是 a 就 return true → 一定對、圈數不固定（期望 n 圈）
  //   Monte Carlo：只挑固定 x 次（x = 4），沒挑到就 return false → 時間固定、可能錯（錯的機率 (1 − 1/n)^x）
  {
const { V3, tag, cube, kill, code, anim, travel, relabel, tint, glow, step, fresh, icon, remove, txt, move } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z, drop);
const sayc = (a, b = '') => say(a, b);
const RV = [12, 5, 31, 8, 'a', 17, 26, 3];          // A[0..7]，a 在 A[4]
const AX = (i) => -6.0 + i * 0.8;
function rsArray(y = 1.0) {
  tag('A', 'ptr', AX(0) - 0.75, y);
  const cells = RV.map((v, i) => cube('?', C.K, [0.66, 0.66, 0.66], AX(i), y, 0, 2));
  RV.forEach((v, i) => tag(String(i), 'idx', AX(i), y - 0.62, 0.4));
  return cells;
}
function rsHide(cells) { cells.forEach((m) => { relabel(m, '?'); tint(m, C.K); glow(m, null); }); }
// the random pointer moves above cell i, the cell shows its value: a → green, otherwise grey
async function rsPick(tok, cells, ptr, i, y = 1.0, ms = 380) {
  const from = ptr.position.clone();
  await travel(tok, ptr, from, V3(AX(i), y + 0.85, 0), ms);
  const hit = RV[i] === 'a';
  relabel(cells[i], RV[i]); tint(cells[i], hit ? C.G : '#bdb2a0'); glow(cells[i], hit ? GREEN : null);
  return hit;
}
const LV_CODE = ['LasVegasSearch(A, n)', '  while (true)', '    k = random(0 … n−1)', '    if A[k] == a', '      return true'];
const MC_CODE = ['MonteCarloSearch(A, n, x)', '  i = 0;  flag = false', '  while (i < x)', '    k = random(0 … n−1);  i++', '    if A[k] == a', '      flag = true', '  return flag'];

// 0:22 什麼是隨機演算法
FRAG.push(['rand-what', '隨機演算法：用亂數決定下一步', async (tok) => {
  fresh([0, 3.4, 10.5], [0, 2.5, 0]);
  await step(tok);                                   // 0:22 employs randomness as part of its logic
  const alg = bx('演算法', C.B, -1.6, 3.4, 0, 2.6, 2, 0.7, 1);
  const dice = icon('🎲', '亂數', -5.4, 3.5);
  sayc('隨機演算法：邏輯裡用到亂數', '');
  await step(tok);                                   // 0:31 uniformly random values guide its behaviour
  for (const v of ['3', '7', '1']) {
    const p = pkt(v, -4.6, 3.5);
    await travel(tok, p, V3(-4.6, 3.5, 0), V3(-2.9, 3.5, 0), 500);
    remove(p);
  }
  note('均勻分布的亂數 → 引導下一步', -1.6, 4.4);
  sayc('均勻分布的亂數當輸入', '用它來引導演算法的行為');
  await step(tok);                                   // 0:37 good performance on average over all random choices
  const runs = [1.6, 3.0, 0.9, 2.2];
  for (let k = 0; k < runs.length; k++) {
    const h = runs[k], x = 1.8 + k * 1.2;
    const m = cube('', C.P, [0.8, 1, 0.6], x, 0.01, 0); m.scale.y = 0.01;
    tag('第' + (k + 1) + '次', 'idx', x, 0, 0.7);
    await anim(tok, 350, (u) => { m.scale.y = Math.max(0.01, h * u); m.position.y = m.scale.y / 2; });
  }
  rod(V3(1.2, 1.93, 0.35), V3(6.0, 1.93, 0.35), C.R, 0.03);
  hot('平均', 6.3, 2.4);
  sayc('每次跑的亂數不同，花的時間也不同', '目標：對所有亂數選擇「平均」表現好');
  await step(tok);                                   // 0:47 random numbers decide what to do next anywhere in its logic
  const A = bx('做法 A', C.K, -3.0, 1.4, 0, 1.6, 2, 0.5, 0.7), B = bx('做法 B', C.K, -0.2, 1.4, 0, 1.6, 2, 0.5, 0.7);
  rod(V3(-2.0, 3.0, 0), V3(-3.0, 1.7, 0), EDGE, 0.04); rod(V3(-1.2, 3.0, 0), V3(-0.2, 1.7, 0), EDGE, 0.04);
  await anim(tok, 500, () => {});
  tint(B, C.G); glow(B, GREEN); tint(A, '#bdb2a0');
  sayc('只要用亂數決定「下一步做什麼」', '就叫隨機演算法');
  await step(tok);                                   // 0:55 e.g. randomized quicksort picks the pivot at random
  fresh([0, 3.4, 10.5], [0, 2.5, 0]);
  const QV = [5, 2, 8, 1, 9, 3, 7];
  const qs = QV.map((v, i) => cube(v, C.K, [0.7, 0.7, 0.7], -3.6 + i * 1.2, 3.2, 0, 2));
  const dice2 = icon('🎲', '', -5.6, 4.6);
  await anim(tok, 600, () => {});
  tint(qs[5], C.Y); glow(qs[5], GOLD);
  hot('pivot（亂數挑到 3）', -3.6 + 5 * 1.2, 4.3);
  sayc('例：randomized quicksort', '用亂數挑 pivot');
  await anim(tok, 900, () => {});
  let l = 0, r = 0;
  for (let i = 0; i < QV.length; i++) {
    if (i === 5) { move(qs[i], 0, 1.2, 0); continue; }
    if (QV[i] < 3) { move(qs[i], -1.6 - (l++) * 1.0, 1.2, 0); tint(qs[i], C.B); }
    else { move(qs[i], 1.4 + (r++) * 1.0, 1.2, 0); tint(qs[i], C.O); }
    await anim(tok, 200, () => {});
  }
  note('< 3', -2.1, 0.4, 0.6); note('> 3', 2.9, 0.4, 0.6);
  sayc('比 pivot 小的放左邊、大的放右邊', '不管輸入怎麼排，期望時間都是 O(n lg n)');
  void alg; void dice; void dice2;
}]);

// 1:04 兩種類型
FRAG.push(['rand-two-types', 'Las Vegas 與 Monte Carlo：哪個固定、哪個會變', async (tok) => {
  fresh([0, 3.4, 10.5], [0, 2.6, 0]);
  await step(tok);                                   // 1:04 two types
  bx('Las Vegas', C.B, -3.6, 5.2, 0, 3.0, 2, 0.6, 0.9);
  bx('Monte Carlo', C.O, 3.6, 5.2, 0, 3.0, 2, 0.6, 0.9);
  sayc('隨機演算法分兩種', 'Las Vegas 與 Monte Carlo');
  await step(tok);                                   // 1:10 always terminate with the correct answer
  good('一定結束，答案一定正確 ✓', -3.6, 4.3);
  sayc('Las Vegas：一定會結束', '而且答案一定正確');
  await step(tok);                                   // 1:18 expected running time is finite (but varies)
  const LV = [1.3, 3.4, 2.1];
  for (let k = 0; k < 3; k++) {
    const L = LV[k], y = 3.2 - k * 0.8;
    const m = cube('', C.B, [1, 0.38, 0.5], -6.2, y, 0); m.scale.x = 0.01;
    await anim(tok, 300 + L * 160, (u) => { m.scale.x = Math.max(0.01, L * u); m.position.x = -6.2 + m.scale.x / 2; });
    good('✓', -6.2 + L + 0.35, y);
  }
  tag('時間不固定（期望值有限）', 'idx', -3.6, 0.7, 0.5);
  sayc('跑多久不一定，每次都不一樣', '但「期望」執行時間是有限的');
  await step(tok);                                   // 1:26 Monte Carlo: chance of an incorrect result
  bad('有機會答錯 ✕', 3.6, 4.3);
  sayc('Monte Carlo：有機會產生錯誤結果');
  await step(tok);                                   // 1:31 but the running time is fixed
  const res = ['✓', '✓', '✕'];
  for (let k = 0; k < 3; k++) {
    const y = 3.2 - k * 0.8;
    const m = cube('', C.O, [1, 0.38, 0.5], 1.4, y, 0); m.scale.x = 0.01;
    await anim(tok, 550, (u) => { m.scale.x = Math.max(0.01, 2.4 * u); m.position.x = 1.4 + m.scale.x / 2; });
    (res[k] === '✓' ? good : bad)(res[k], 1.4 + 2.4 + 0.35, y);
  }
  tag('時間固定（每次一樣長）', 'idx', 3.6, 0.7, 0.5);
  sayc('但執行時間是固定的', '每次都跑一樣久');
  await step(tok);                                   // 1:33 recap
  sayc('Las Vegas：時間會變，答案一定對', 'Monte Carlo：時間固定，答案可能錯');
}]);

// 1:52 例：Las Vegas 搜尋
FRAG.push(['rand-lv-search', 'Las Vegas 搜尋：一直抽到 a 為止', async (tok) => {
  fresh([0, 3.4, 10.5], [0, 2.6, 0]);
  let cells = null, cd = null, ptr = null, cnt = null, nt = null, found = null;
  await step(tok);                                   // 1:52 find a in an array of n elements
  cells = rsArray();
  sayc('問題：在 n 個元素的陣列 A 裡找 a', '這裡 n = 8');
  await step(tok);                                   // 2:09 a is present somewhere in the array
  nt = note('a 一定在陣列裡（只是不知道在哪）', -3.2, 2.7);
  sayc('前提：a 一定在陣列裡', '但我們不知道在哪一格');
  await step(tok);                                   // 2:25 while (true) randomly select an element
  cd = code(LV_CODE, 3.9, 5.2, 0.5);
  cd.hl(1);
  ptr = hot('k = random', AX(0), 1.85);
  sayc('while (true)：每一圈從 n 格裡隨機挑一格', '');
  await step(tok);                                   // 2:35 compare with a; if found return true
  remove(nt);
  cnt = hd('第 0 圈', -3.2, 3.5);
  let it = 0;
  for (const i of [6, 1, 4]) {
    it++; txt(cnt, '第 ' + it + ' 圈'); cd.hl(2);
    const hit = await rsPick(tok, cells, ptr, i);
    cd.hl(3); await anim(tok, 350, () => {});
    if (hit) { cd.hl(4); found = good('A[4] 是 a → return true', -3.2, 2.7); }
  }
  sayc('挑到的跟 a 比，是 a 就 return true', '這次第 3 圈挑到 A[4]');
  await step(tok);                                   // 2:50 while true = infinite loop
  remove(found); rsHide(cells); cd.hl(1); it = 0;
  for (const i of [2, 2, 7, 0, 4]) {
    it++; txt(cnt, '再跑一次：第 ' + it + ' 圈'); cd.hl(2);
    await rsPick(tok, cells, ptr, i, 1.0, 300);
    await anim(tok, 250, () => {});
  }
  cd.hl(4);
  note('同一格可能被重複挑到', 3.9, 1.6);
  sayc('while (true) 是無窮迴圈：沒挑到就一直挑', '這次挑了 5 圈（A[2] 被挑了兩次）');
  await step(tok);                                   // 3:13 iterations vary, arbitrarily large, but always true
  remove(cnt); remove(ptr); rsHide(cells); cd.hl(-1);
  const runs = [3, 5, 1, 14];
  runs.forEach((k, j) => good('第 ' + (j + 1) + ' 次跑：' + k + ' 圈 → true ✓', -3.2, 5.3 - j * 0.65));
  hot('平均要 n = 8 圈（期望值有限）', -3.2, 2.55);
  sayc('圈數每次不同、可能任意大', '但只要停下來，答案一定是正確的 true');
}]);

// 3:21 例：Monte Carlo 搜尋
FRAG.push(['rand-mc-search', 'Monte Carlo 搜尋：只抽 x 次', async (tok) => {
  fresh([0, 3.4, 10.5], [0, 2.6, 0]);
  const cells = rsArray();
  let cd = null, ptr = null, cnt = null, fl = null, out = null;
  await step(tok);                                   // 3:22 Monte Carlo: array, n, and a parameter x
  cd = code(MC_CODE, 3.7, 5.6, 0.5);
  cd.hl(0);
  hd('x = 4（固定）', -3.2, 4.4);
  sayc('Monte Carlo 版：多傳一個參數 x', '這裡 x = 4');
  await step(tok);                                   // 3:31 i = 0, flag = false, while i < x
  cd.hl(2);
  fl = hd('flag = false', -3.2, 3.6);
  cnt = hot('i = 0', -3.2, 2.85);
  sayc('i = 0、flag = false，while (i < x)', 'x 固定 → 迴圈圈數固定');
  ptr = hot('k = random', AX(0), 1.85);
  await step(tok);                                   // 3:41 select, i++, if a found flag = true
  let i = 0;
  for (const k of [2, 4, 0, 6]) {
    i++; cd.hl(3); txt(cnt, 'i = ' + i);
    const hit = await rsPick(tok, cells, ptr, k);
    cd.hl(4); await anim(tok, 250, () => {});
    if (hit) { cd.hl(5); txt(fl, 'flag = true'); setCls(fl, 'good'); await anim(tok, 400, () => {}); }
  }
  cd.hl(6);
  out = good('return true ✓', 3.7, 1.6);
  sayc('第 2 圈挑到 a → flag = true', '跑滿 x = 4 圈，回傳 true（正確）');
  await step(tok);                                   // 3:54 never picked a → return false although a is there
  remove(out); rsHide(cells); txt(fl, 'flag = false'); setCls(fl, 'ptr'); i = 0;
  for (const k of [1, 6, 3, 1]) {
    i++; cd.hl(3); txt(cnt, 'i = ' + i);
    await rsPick(tok, cells, ptr, k);
    cd.hl(4); await anim(tok, 300, () => {});
  }
  cd.hl(6);
  out = bad('return false ✕（a 明明在 A[4]）', 3.7, 1.6);
  sayc('再跑一次：4 圈都沒挑到 a', 'flag 還是 false → 回傳 false，答錯了');
  await step(tok);                                   // 4:22 fixed iterations, true or false
  sayc('迭代次數固定，但結果可能對、可能錯', '沒挑到的機率 = (1 − 1/n)ˣ = (7/8)⁴ ≈ 0.59');
}]);

// 4:29 比較與如何選擇
FRAG.push(['rand-lv-mc-choose', 'Las Vegas 還是 Monte Carlo：看重答案還是時間', async (tok) => {
  fresh([0, 3.4, 10.5], [0, 2.6, 0]);
  await step(tok);                                   // 4:33 Las Vegas: always correct, running time is a random variable
  bx('Las Vegas', C.B, -3.6, 5.4, 0, 3.0, 2, 0.6, 0.9);
  for (let k = 1; k <= 12; k++) {
    const h = 0.15 + 3.0 * Math.pow(7 / 8, k - 1), x = -6.3 + (k - 1) * 0.42;
    const m = cube('', C.B, [0.34, 1, 0.5], x, 0.01, 0); m.scale.y = 0.01;
    await anim(tok, 110, (u) => { m.scale.y = Math.max(0.01, h * u); m.position.y = m.scale.y / 2; });
  }
  tag('1 圈', 'idx', -6.3, 0, 0.7); tag('12 圈 …', 'idx', -1.7, 0, 0.7);
  good('答案永遠正確 ✓', -3.6, 4.5);
  sayc('Las Vegas：一定輸出正確答案', '執行時間是一個隨機變數（圈數的分布）');
  await step(tok);                                   // 4:41 Monte Carlo: time bounded by a function of n and x
  bx('Monte Carlo', C.O, 3.6, 5.4, 0, 3.0, 2, 0.6, 0.9);
  const m = cube('x 圈', C.O, [1, 0.5, 0.6], 1.2, 1.0, 0); m.scale.x = 0.01;
  await anim(tok, 600, (u) => { m.scale.x = Math.max(0.01, 3.2 * u); m.position.x = 1.2 + m.scale.x / 2; });
  hd('時間 ≤ f(n, x)：一定在時限內做完', 3.6, 2.0);
  sayc('Monte Carlo：時間有上限', '可以用輸入大小 n 和參數 x 算出來');
  await step(tok);                                   // 4:48 always a small probability of error
  const pr = [['x = 4', '0.59'], ['x = 16', '0.12'], ['x = 40', '0.005']];
  pr.forEach(([a, b], j) => tag(a + '：P(錯) ≈ ' + b, 'note', 3.6, 4.5 - j * 0.65));
  sayc('但總有一個小機率會出錯', 'P(錯) = (1 − 1/n)ˣ，x 越大越小（n = 8）');
  await step(tok);                                   // 4:59 correct output essential, time not important → Las Vegas
  const c1 = bx('答案一定要對、時間不重要 → Las Vegas', C.B, -3.0, 0.3, 2.2, 5.6, 2, 0.5, 0.6);
  glow(c1, GOLD);
  sayc('正確答案是必要的、時間不重要', '→ 用 Las Vegas');
  await step(tok);                                   // 5:06 time important, can bear some error → Monte Carlo
  const c2 = bx('時間要緊、能容忍少量錯誤 → Monte Carlo', C.O, 3.0, 0.3, 2.2, 5.6, 2, 0.5, 0.6);
  glow(c1, null); glow(c2, GOLD);
  sayc('時間很重要、可以容忍一點錯', '→ Monte Carlo 是最好的選擇');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 10 章',
    title: '近似演算法、隨機演算法（附：回溯、分支界限）',
    color: 'var(--alg)',
    modes: [
      { id: 'vc', name: 'Vertex cover 2-近似', enter: enterVc },
      { id: 'tsp', name: 'TSP 2-近似', enter: enterTsp },
      { id: 'rqs', name: '隨機快排', enter: enterRqs },
      { id: 'mc', name: 'Monte Carlo', enter: enterMc },
      { id: 'queens', name: '回溯：N-Queens', enter: enterQueens },
      { id: 'bnb', name: '分支界限：TSP', enter: enterBnb },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'strategy-map', 'bt-seats-tree', 'bt-seats-bound', 'bt-dfs-bfs',
      'nqueens-4', 'sum-subsets',
      'gc-intro', 'gc-types', 'gc-tree-size', 'gc-backtrack', 'gc-map',
      'bb-solution-forms', 'bb-fifo', 'bb-lifo', 'bb-lc',
      'tsp-problem', 'tsp-bb-small', 'tsp-bb-reduce',
      'approx-ratio', 'vc-2approx', 'vc-why-2', 'tsp-mst-double', 'set-cover-greedy',
      'rand-quicksort', 'lv-vs-mc', 'mc-trials',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
