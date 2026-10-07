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
//   N-Queens（4 皇后）與 Sum of Subsets（w = 5,10,12,13,15,18，m = 30）取自 Horowitz/Sahni 課本例題。
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
    say('課本例：先做 reduced matrix', '每列減掉該列最小值，再每行減掉該行最小值');
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

  // ═════════════════════════ 回溯：課本例題 4-Queens、Sum of Subsets ═════════════════════════
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
      return { q: 'Graph coloring：' + n + ' 個頂點、' + m + ' 種顏色，不加任何 bounding 的狀態空間樹共有幾個節點（含 root）？', opts: [String(tot), String(Math.pow(m, n)), String(Math.pow(n, m)), String(tot - 1)], ans: String(tot), why: '1 + m + m² + … + mⁿ = (m^(n+1) − 1)/(m − 1)。' };
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
      return { q: n + ' 個城市的 TSP，固定從城市 1 出發，狀態空間樹有幾片葉子（幾條環路）？', opts: [String(f(n - 1)), String(f(n)), String(Math.pow(2, n)), String(n * n)], ans: String(f(n - 1)), why: '起點固定，其餘 ' + (n - 1) + ' 個城市任意排列 → (n−1)!。' };
    }
    const nm = [[2, 4, 1, 3], [3, 1, 4, 2]][rnd(2)];
    return { q: '4-Queens 用 (x1, x2, x3, x4) 表示（第 i 列的皇后在第 xi 行），下列哪一組是解？', opts: ['(' + nm.join(', ') + ')', '(1, 3, 2, 4)', '(2, 3, 1, 4)', '(1, 4, 2, 3)'], ans: '(' + nm.join(', ') + ')', why: '4-Queens 只有 (2,4,1,3) 和 (3,1,4,2) 兩組；其他選項都有兩個皇后在同一條斜線。' };
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
    // 回溯（Abdul Bari 6、6.3；課本例題）
    'strategy-map': { title: '回溯／分支界限：brute force 的兩種走法', play: scStrategy },
    'bt-seats-tree': { title: '回溯：3 人坐 3 椅的狀態空間樹（3! = 6）', play: (tok) => scSeats(tok, false) },
    'bt-seats-bound': { title: '回溯：女生不坐中間 → bounding function 殺節點', play: (tok) => scSeats(tok, true) },
    'bt-dfs-bfs': { title: '回溯 DFS vs 分支界限 BFS：節點產生順序', play: scDfsBfs },
    'nqueens-4': { title: '回溯：4-Queens（課本例）', play: scQueens },
    'sum-subsets': { title: '回溯：Sum of subsets，m = 30（課本例）', play: scSos },
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
    'tsp-bb-reduce': { title: '分支界限 TSP：reduced matrix 下界與 LC 展開（課本例）', play: scTspReduce },
  };

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
    ],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
