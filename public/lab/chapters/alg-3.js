// 演算法 第3章：動態規劃（基礎）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自本章影片（有逐字稿的三支）：
//   Abdul Bari「4 Principle of Optimality」：Greedy vs DP；fib(5) 遞迴樹共 15 次呼叫、T(n) ≈ 2T(n−1)+1 → O(2ⁿ)；
//     memoization（全域陣列 F[0..5] 初值 −1，只呼叫 6 次 = n+1）；tabulation（迴圈由 F[0]、F[1] 往上填 → bottom-up）。
//   Abdul Bari「4.1 MultiStage Graph」：12 個頂點、5 個 stage 的多段圖；cost(i,j) 從 sink 往回填，
//     d 值往前做決策：1→2→7→10→12 與 1→3→6→10→12，成本都是 16。
//   MIT 6.006 L12「DP II」：DP = 小心的暴力搜尋（guess + recursion + memo）、DP = DAG 最短路徑、
//     五步驟（Fibonacci／Bellman-Ford 對照）、text justification（badness = (W − 總長)³）、parent pointers、perfect-information blackjack。
// 課本補充（CLRS Ch15）：rod cutting（p = 1 5 8 9 10 17 17 20）、0/1 knapsack V[i][w]、LCS（ABCBDAB／BDCABA）、
//   LIS 的 O(n²) 與 O(n log n)、DP 兩要素（optimal substructure + overlapping subproblems）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', GRAY = '#d8cfc0';
  const BLUE = '#4b9ee2', TEAL = '#2fc092', PURPLE = '#9b7ef4', ORANGE = '#dd8238', PINK = '#e55a9b', RED = '#d64545', SAND = '#c9b48e', PAPER = '#efe6d2';
  const OKC = '#1f9e6e', TRY = '#c9a35a';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function fresh(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
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
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z + 0.9); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m && m.material && m.material.emissive) m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { if (m && m.material) m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
  const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => setCls(l, k === i ? 'ptr alt' : '')); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function rod(a, b, color = SAND, r = 0.03) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len), 8), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    lab.world.add(m); return m;
  }
  function arrow(a0, b0, color = '#c08a1f', r = 0.035) {
    const A = a0.clone(), B = b0.clone(), d = B.clone().sub(A);
    let len = d.length(); d.normalize();
    const s = Math.min(0.3, len * 0.22); A.addScaledVector(d, s); B.addScaledVector(d, -s); len = A.distanceTo(B);
    const head = Math.min(0.26, len * 0.45), mat = new THREE.MeshBasicMaterial({ color });
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len - head), 8), mat); sh.position.y = (len - head) / 2;
    const co = new THREE.Mesh(new THREE.ConeGeometry(r * 3.2, head, 12), mat); co.position.y = len - head / 2;
    g.add(sh, co); g.position.copy(A); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d);
    lab.world.add(g); return g;
  }
  // a curved arrow from a to b bulging h units along y (negative = below)
  function arc(a, b, h, color = '#c08a1f', r = 0.03) {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += h;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const pts = curve.getPoints(24).slice(2, 23);
    const path = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.MeshBasicMaterial({ color });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, r, 6, false), mat));
    const end = pts[pts.length - 1], tan = curve.getTangent(0.92);
    const co = new THREE.Mesh(new THREE.ConeGeometry(r * 3.4, 0.24, 12), mat);
    co.position.copy(end).addScaledVector(tan, 0.08); co.quaternion.setFromUnitVectors(V3(0, 1, 0), tan);
    g.add(co); lab.world.add(g); return g;
  }
  function plate(x, y, w, h, color = PAPER, z = -0.05) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    t.position.set(x, y, z); t.receiveShadow = true; lab.world.add(t); return t;
  }
  // an upright DP table: cells fall into their slot; arrows show which cells a cell was computed from
  function grid(o) {
    const g = { o, cells: {}, plates: {}, arrows: [] };
    g.pos = (r, c) => V3(o.x0 + c * o.cw, o.y0 - r * o.ch, 0);
    for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) { const p = g.pos(r, c); g.plates[r + ',' + c] = plate(p.x, p.y, o.cw * 0.94, o.ch * 0.92); }
    (o.colHdr || []).forEach((t, c) => { if (t !== null && t !== '') tag(String(t), o.colCls || 'idx', g.pos(0, c).x, o.y0 + o.ch * 0.8); });
    (o.rowHdr || []).forEach((t, r) => { if (t !== null && t !== '') tag(String(t), o.rowCls || 'idx', o.x0 - o.cw * 0.6 - (o.rowDx || 0.45), g.pos(r, 0).y); });
    g.set = (r, c, v, color = BLUE, dropH = 1.4) => {
      const k = r + ',' + c; if (g.cells[k]) kill(g.cells[k]);
      const p = g.pos(r, c);
      return (g.cells[k] = cube(v, color, [o.cw * 0.8, o.ch * 0.72, 0.32], p.x, p.y, 0.2, dropH));
    };
    g.get = (r, c) => g.cells[r + ',' + c];
    g.arrow = (r1, c1, r2, c2, color) => { const a = g.pos(r1, c1), b = g.pos(r2, c2); a.z = b.z = 0.6; const h = arrow(a, b, color); g.arrows.push(h); return h; };
    g.arc = (r1, c1, r2, c2, color, below = true) => {
      const a = g.pos(r1, c1), b = g.pos(r2, c2), s = below ? -1 : 1;
      a.z = b.z = 0.6; a.y += s * o.ch * 0.3; b.y += s * o.ch * 0.3;
      const h = arc(a, b, s * (0.3 + 0.16 * Math.abs(c2 - c1)), color); g.arrows.push(h); return h;
    };
    g.clearArrows = () => { g.arrows.forEach(kill); g.arrows = []; };
    g.mark = (r, c, color) => { const p = g.plates[r + ',' + c]; if (p) p.material.color.set(color || PAPER); };
    g.unglow = () => Object.values(g.cells).forEach((m) => glow(m, null));
    return g;
  }
  // play one table step: arrows from the cells it depends on, then the value drops in
  async function playStep(g, s, tok, ms, quiet) {
    g.clearArrows(); g.unglow();
    for (const d of s.deps || []) {
      const col = d.best ? OKC : TRY;
      if (d.arc) g.arc(d.r, d.c, s.r, s.c, col, d.arc !== 'up'); else g.arrow(d.r, d.c, s.r, s.c, col);
      const m = g.get(d.r, d.c); if (m) glow(m, d.best ? GREEN : GOLD);
    }
    for (const h of s.hi || []) { const m = g.get(h[0], h[1]); if (m) glow(m, GOLD); }
    if (!quiet) say(s.cap, s.formula);
    if (tok === undefined && s.log) log(s.log);
    await wait(tok, ms * 0.55);
    g.set(s.r, s.c, s.v, s.color || BLUE);
    if (s.also) for (const a of s.also) g.set(a[0], a[1], a[2], a[3] || PURPLE);
    await wait(tok, ms * 0.45);
  }
  const fmtV = (v) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : String(v));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (n) => Math.floor(Math.random() * n);

  // ───────────────────────── Fibonacci：遞迴樹、memo、tabulation ─────────────────────────
  function fibTree(n) { const t = { n, kids: [] }; if (n > 1) t.kids = [fibTree(n - 2), fibTree(n - 1)]; return t; }
  function layoutTree(root, spread, yTop, dy) {
    let leaf = 0; const all = [];
    (function walk(t, d) {
      t.d = d; all.push(t);
      if (!t.kids.length) t.lx = leaf++;
      else { t.kids.forEach((k) => walk(k, d + 1)); t.lx = (t.kids[0].lx + t.kids[1].lx) / 2; }
    })(root, 0);
    all.forEach((t) => { t.x = (t.lx - (leaf - 1) / 2) * spread; t.y = yTop - t.d * dy; });
    return { all, leaves: leaf };
  }
  const fibV = (n) => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };
  const fibCalls = (n) => 2 * fibV(n + 1) - 1;
  const DCOL = [PURPLE, BLUE, '#31aab0', ORANGE, PINK, '#c08a1f'];
  const fibState = { n: 5 };
  function treeGeom(n) {
    const root = fibTree(n);
    const leaves = fibV(n + 1);
    const spread = Math.min(1.3, 10.6 / Math.max(1, leaves - 1));
    const dy = Math.min(1.35, 5.4 / Math.max(1, n - 1));
    const L = layoutTree(root, spread, 6.7, dy);
    return { root, all: L.all, spread, w: Math.min(1.15, spread * 0.92) };
  }
  async function runFibNaive(tok, n, ms) {
    const T = treeGeom(n);
    const cnt = tag('呼叫 0 次', 'ptr alt', 5.6, 7.6);
    let calls = 0;
    async function call(t, par) {
      calls++;
      if (par) t.edge = rod(V3(par.x, par.y - 0.25, -0.05), V3(t.x, t.y + 0.25, -0.05), SAND, 0.022);
      t.m = cube('f(' + t.n + ')', DCOL[t.d % DCOL.length], [T.w, 0.5, 0.45], t.x, t.y, 0, 1.2);
      txt(cnt, '呼叫 ' + calls + ' 次');
      if (tok !== undefined || ms > 0) say('呼叫 fib(' + t.n + ')', t.n <= 1 ? 'n ≤ 1：直接回傳 ' + t.n : 'fib(' + t.n + ') = fib(' + (t.n - 2) + ') + fib(' + (t.n - 1) + ')');
      await wait(tok, ms);
      if (t.n <= 1) t.v = t.n;
      else { await call(t.kids[0], t); await call(t.kids[1], t); t.v = t.kids[0].v + t.kids[1].v; }
      relabel(t.m, t.n + '→' + t.v); tint(t.m, TEAL);
      await wait(tok, ms * 0.35);
    }
    await call(T.root, null);
    return { T, calls };
  }
  async function scFibTree(tok) {
    fresh([0, 4.6, 15.5], [0, 3.7, 0]);
    const n = (ctx.params || {}).n || 5;
    code(['fib(n):', '  if n <= 1: return n', '  return fib(n-2) + fib(n-1)'], -4.6, 7.7, 0.45);
    say('Fibonacci：0 1 1 2 3 5 8 13 …', '每一項 = 前兩項相加');
    await wait(tok, 2200);
    const { T, calls } = await runFibNaive(tok, n, 520);
    say('fib(' + n + ') 一共呼叫 ' + calls + ' 次', '同一個參數被算了好多遍');
    await wait(tok, 2400);
    for (const k of [2, 1]) {
      T.all.forEach((t) => glow(t.m, t.n === k ? GOLD : null));
      say('fib(' + k + ') 被呼叫 ' + T.all.filter((t) => t.n === k).length + ' 次', '重複的子問題（overlapping subproblems）');
      await wait(tok, 2200);
    }
    T.all.forEach((t) => glow(t.m, null));
    say('T(n) ≈ 2T(n−1) + 1 → O(2ⁿ)', '把 n−2 放大成 n−1：得到上界');
    await wait(tok, 3200);
  }
  async function runFibMemo(tok, n, ms) {
    const T = treeGeom(n);
    // ghost of the full tree
    T.all.forEach((t) => {
      t.m = lab.box(GRAY, [T.w, 0.5, 0.45]); t.m.position.set(t.x, t.y, 0);
      t.m.material.transparent = true; t.m.material.opacity = 0.22; lab.world.add(t.m);
    });
    T.all.forEach((t) => t.kids.forEach((k) => { k.edge = rod(V3(t.x, t.y - 0.25, -0.05), V3(k.x, k.y + 0.25, -0.05), GRAY, 0.018); }));
    const F = new Array(n + 1).fill(-1);
    const fx = (k) => (k - n / 2) * 1.15;
    const cells = F.map((v, k) => { tag('F[' + k + ']', 'idx', fx(k), 0, 2.75); return cube(-1, GRAY, [0.95, 0.5, 0.8], fx(k), 0.27, 1.9); });
    tag('全域陣列 F', 'ptr', fx(0) - 1.6, 0.4, 1.9);
    const cnt = tag('呼叫 0 次', 'ptr alt', 5.6, 7.6);
    let calls = 0;
    const lit = (t, color) => { t.m.material.opacity = 1; t.m.material.transparent = false; tint(t.m, color); if (!t.m.userData.lbl) { t.m.userData.lbl = lab.label('f(' + t.n + ')', 'val'); t.m.add(t.m.userData.lbl); } };
    async function call(t, par) {
      calls++; txt(cnt, '呼叫 ' + calls + ' 次');
      lit(t, DCOL[t.d % DCOL.length]); if (t.edge) tint(t.edge, SAND);
      say('呼叫 fib(' + t.n + ')：F[' + t.n + '] 還是 −1', '還不知道，只好算');
      await wait(tok, ms);
      if (t.n <= 1) F[t.n] = t.n;
      else {
        for (const k of t.kids) {
          if (F[k.n] === -1) await call(k, t);
          else {
            lit(k, GRAY); relabel(k.m, 'F[' + k.n + ']'); glow(k.m, GOLD); glow(cells[k.n], GOLD);
            say('F[' + k.n + '] = ' + F[k.n] + ' 已經存好：不呼叫', '直接查表');
            await wait(tok, ms);
            glow(k.m, null); glow(cells[k.n], null);
          }
        }
        F[t.n] = F[t.n - 2] + F[t.n - 1];
      }
      relabel(t.m, t.n + '→' + F[t.n]); tint(t.m, TEAL);
      relabel(cells[t.n], F[t.n]); tint(cells[t.n], TEAL); glow(cells[t.n], GREEN);
      say('存起來：F[' + t.n + '] = ' + F[t.n], '');
      await wait(tok, ms * 0.6);
      glow(cells[t.n], null);
    }
    await call(T.root, null);
    return { calls };
  }
  async function scFibMemo(tok) {
    fresh([0, 5.2, 15.5], [0, 3.4, 0]);
    const n = 5;
    say('同一棵樹，但把算過的結果存起來', '全域陣列 F[0..5] 先填 −1（還不知道）');
    await wait(tok, 600);
    const { calls } = await runFibMemo(tok, n, 1100);
    say('只呼叫 ' + calls + ' 次 = n + 1', 'memoization：O(2ⁿ) → O(n)');
    await wait(tok, 2800);
    say('從 fib(5) 往下呼叫：top-down', '灰色的呼叫全部省掉了');
    await wait(tok, 2800);
  }
  async function runFibTable(tok, n, ms, quiet) {
    const g = grid({ rows: 1, cols: n + 1, cw: Math.min(1.25, 10 / (n + 1)), ch: 0.9, x0: -Math.min(1.25, 10 / (n + 1)) * n / 2, y0: 3.4, colHdr: Array.from({ length: n + 1 }, (_, k) => 'F[' + k + ']') });
    const cd = code(['fib(n):', '  if n <= 1: return n', '  F[0] = 0; F[1] = 1', '  for i = 2 to n:', '    F[i] = F[i-2] + F[i-1]', '  return F[n]'], 0, 7.4, 0.45);
    cd.hl(2);
    g.set(0, 0, 0, TEAL); if (n >= 1) g.set(0, 1, 1, TEAL);
    if (!quiet) say('先填最小的兩格', 'F[0] = 0、F[1] = 1');
    await wait(tok, ms * 1.6);
    const F = [0, 1];
    for (let i = 2; i <= n; i++) {
      F[i] = F[i - 2] + F[i - 1];
      cd.hl(4);
      await playStep(g, { r: 0, c: i, v: F[i], deps: [{ r: 0, c: i - 2, arc: true, best: true }, { r: 0, c: i - 1, arc: true, best: true }], cap: 'i = ' + i + '：加前兩格', formula: 'F[' + i + '] = F[' + (i - 2) + '] + F[' + (i - 1) + '] = ' + F[i - 2] + ' + ' + F[i - 1] + ' = ' + F[i] }, tok, ms, quiet);
    }
    g.clearArrows(); g.unglow(); cd.hl(5);
    return { g, F };
  }
  async function scFibTable(tok) {
    fresh([0, 4.4, 14], [0, 3.8, 0]);
    say('Tabulation：用迴圈把表填滿', '同一個遞迴式，但不呼叫自己');
    await wait(tok, 2000);
    await runFibTable(tok, 5, 1500);
    say('F[5] = 5：從 F[0] 一路往上填', 'bottom-up；也是 O(n)');
    await wait(tok, 2600);
    say('memo 是 top-down，tabulation 是 bottom-up', 'DP 大多用 tabulation（迭代）寫');
    await wait(tok, 3000);
  }

  // ───────────────────────── Greedy vs DP（Abdul Bari 開場） ─────────────────────────
  async function scGreedyVsDP(tok) {
    fresh([0, 4.4, 14], [0, 3.6, 0]);
    const P = { S: [-5, 3.6], A: [0, 6], B: [0, 1.4], T: [5, 3.6] };
    const E = [['S', 'A', 1], ['S', 'B', 4], ['A', 'T', 9], ['B', 'T', 2]];
    const nodes = {};
    for (const [k, [x, y]] of Object.entries(P)) nodes[k] = cube(k, k === 'S' || k === 'T' ? PURPLE : BLUE, [0.8, 0.6, 0.6], x, y, 0, 2);
    const rods = {};
    for (const [a, b, w] of E) {
      const A = V3(...P[a]), B = V3(...P[b]);
      rods[a + b] = rod(A, B, SAND, 0.04);
      const m = A.clone().lerp(B, 0.5); tag(String(w), 'ptr', m.x, m.y + 0.35, 0.1);
    }
    say('Greedy 與 DP 都解最佳化問題', '要最小值或最大值');
    await wait(tok, 2600);
    const tokn = cube('', ORANGE, [0.4, 0.4, 0.4], P.S[0], P.S[1] + 0.6, 0.4);
    say('Greedy：照事先定好的規則走', '例：Kruskal 每次挑最小邊、Dijkstra 挑最近點');
    await wait(tok, 2600);
    say('規則「每步挑最便宜的邊」：S→A 只要 1', '只做一次決定，之後照做');
    tint(rods.SA, ORANGE); move(tokn, P.A[0], P.A[1] + 0.6, 0.4);
    await wait(tok, 2200);
    tint(rods.AT, ORANGE); move(tokn, P.T[0], P.T[1] + 0.6, 0.4);
    say('A→T 是 9：總成本 10', '1 + 9 = 10');
    await wait(tok, 2400);
    fly(tokn);
    tint(rods.SA, SAND); tint(rods.AT, SAND);
    say('DP：把所有可能的解都試過，再挑最好的', '');
    await wait(tok, 1800);
    const t1 = tag('S→A→T = 10', 'ptr', -4.6, 6.6), t2 = tag('S→B→T = 6', 'ptr', -4.6, 0.6);
    tint(rods.SA, GRAY); tint(rods.AT, GRAY);
    await wait(tok, 900);
    tint(rods.SB, TEAL); tint(rods.BT, TEAL); setCls(t2, 'ptr alt'); glow(nodes.B, GREEN);
    say('選 S→B→T：成本 6', 'min(1 + 9, 4 + 2) = 6；較慢但一定最佳');
    await wait(tok, 2800);
    say('Principle of optimality：一連串決策', 'DP 每個階段都做決策；Greedy 只定一次規則');
    await wait(tok, 3000);
    say('DP 多半寫成遞迴式，再用迴圈實作', '補充：規則沒被證明最佳時，Greedy 可能出錯');
    await wait(tok, 3200);
    kill(t1);
  }

  // ───────────────────────── DP 兩要素（課本） ─────────────────────────
  async function scElements(tok) {
    fresh([0, 4.6, 15], [0, 3.6, 0]);
    say('DP 能用的兩個條件（CLRS）', 'optimal substructure + overlapping subproblems');
    await wait(tok, 2600);
    // left: shortest path whose sub-path is also shortest
    const pts = [[-6.2, 2], [-4.6, 4.6], [-2.8, 3.2], [-1.2, 5.6]];
    const nm = ['s', 'a', 'b', 'v'];
    pts.forEach(([x, y], k) => cube(nm[k], k === 0 || k === 3 ? PURPLE : BLUE, [0.6, 0.5, 0.5], x, y, 0, 1.5));
    const r1 = [];
    for (let k = 0; k < 3; k++) r1.push(rod(V3(...pts[k]), V3(...pts[k + 1]), TEAL, 0.05));
    tag('s→v 的最短路徑', 'ptr', -3.7, 7);
    say('Optimal substructure', '最佳解裡的子路徑，本身也是最佳解');
    await wait(tok, 2200);
    r1.forEach((r, k) => tint(r, k < 2 ? ORANGE : TEAL));
    tag('s→b 這一段也一定最短', 'ptr alt', -4.4, 1.0);
    say('若 s→b 有更短的路，整條就能更短：矛盾', 'cut-and-paste 論證');
    await wait(tok, 3200);
    // right: fib(4) tree with duplicated subtrees
    const T = fibTree(4); const L = layoutTree(T, 0.9, 6.4, 1.3);
    L.all.forEach((t) => { t.x += 3.6; });
    L.all.forEach((t) => { t.kids.forEach((k) => rod(V3(t.x, t.y - 0.22, -0.05), V3(k.x, k.y + 0.22, -0.05), SAND, 0.02)); });
    L.all.forEach((t) => { t.m = cube('f' + t.n, BLUE, [0.8, 0.45, 0.4], t.x, t.y, 0, 1.2); });
    say('Overlapping subproblems', '遞迴時同一個子問題一再出現');
    await wait(tok, 2000);
    L.all.forEach((t) => { if (t.n === 2) tint(t.m, ORANGE); });
    say('f2 出現 2 次、f1 出現 3 次', '算一次存起來，之後查表');
    await wait(tok, 2800);
    say('Divide & Conquer 的子問題互不重疊', '重疊才值得用 DP 存表');
    await wait(tok, 3000);
  }

  // ───────────────────────── Multistage graph（Abdul Bari 4.1） ─────────────────────────
  const MSG = {
    stage: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 5 },
    pos: { 1: [-6, 4.6], 2: [-3, 6.5], 3: [-3, 5.2], 4: [-3, 3.9], 5: [-3, 2.6], 6: [0, 5.9], 7: [0, 4.6], 8: [0, 3.3], 9: [3, 5.9], 10: [3, 4.6], 11: [3, 3.3], 12: [6, 4.6] },
    E: [[1, 2, 9], [1, 3, 7], [1, 4, 3], [1, 5, 2], [2, 6, 4], [2, 7, 2], [2, 8, 1], [3, 6, 2], [3, 7, 7], [4, 8, 11], [5, 7, 11], [5, 8, 8],
      [6, 9, 6], [6, 10, 5], [7, 9, 4], [7, 10, 3], [8, 10, 5], [8, 11, 6], [9, 12, 4], [10, 12, 2], [11, 12, 5]],
    order: [12, 9, 10, 11, 6, 7, 8, 2, 3, 4, 5, 1],
  };
  function msgSolve() {
    const cost = {}, d = {}, steps = [];
    for (const v of MSG.order) {
      const out = MSG.E.filter((e) => e[0] === v);
      if (!out.length) { cost[v] = 0; d[v] = [v]; steps.push({ v, out, cands: [], best: 0 }); continue; }
      const cands = out.map(([, l, w]) => ({ l, w, s: w + cost[l] }));
      const best = Math.min(...cands.map((c) => c.s));
      cost[v] = best; d[v] = cands.filter((c) => c.s === best).map((c) => c.l);
      steps.push({ v, out, cands, best });
    }
    return { cost, d, steps };
  }
  const MS = msgSolve();
  function buildMSG(table, ms) {
    const G = { node: {}, edge: {}, costL: {} };
    for (const [a, b, w] of MSG.E) {
      const A = V3(...MSG.pos[a]), B = V3(...MSG.pos[b]);
      A.z = B.z = -0.05;
      G.edge[a + '-' + b] = rod(A, B, SAND, 0.03);
      const p = A.clone().lerp(B, 0.36); tag(String(w), 'idx', p.x, p.y + 0.18, 0.1);
    }
    for (const v of Object.keys(MSG.pos)) {
      const [x, y] = MSG.pos[v];
      G.node[v] = cube(v, v === '1' || v === '12' ? PURPLE : BLUE, [0.62, 0.5, 0.5], x, y, 0, ms ? 1.5 : 0);
      G.costL[v] = tag('', 'ptr alt', x, y + 0.5, 0.3); showL(G.costL[v], false);
    }
    [1, 2, 3, 4, 5].forEach((s) => tag('stage ' + s, 'idx', -6 + (s - 1) * 3, 7.4));
    if (table) G.g = grid({ rows: 2, cols: 12, cw: 0.95, ch: 0.55, x0: -5.25, y0: 1.25, colHdr: Array.from({ length: 12 }, (_, k) => k + 1), rowHdr: ['cost', 'd'], rowDx: 0.55 });
    return G;
  }
  function msgFill(G, v, show = true) {
    const c = MS.cost[v], dd = MS.d[v];
    txt(G.costL[v], 'cost ' + c); showL(G.costL[v], show);
    if (G.g) { G.g.set(0, v - 1, c, TEAL, 1); G.g.set(1, v - 1, v === 12 ? '—' : dd.join('/'), PURPLE, 1); }
    tint(G.node[v], TEAL);
  }
  const edgeOf = (G, a, b) => G.edge[a + '-' + b];
  async function msgStepAnim(G, st, tok, ms) {
    const v = st.v;
    Object.values(G.edge).forEach((e) => tint(e, SAND));
    glow(G.node[v], GOLD);
    if (!st.out.length) {
      say('sink 12：到自己的成本 = 0', 'cost(5, 12) = 0');
      await wait(tok, ms);
    } else {
      st.out.forEach(([, l]) => { tint(edgeOf(G, v, l), ORANGE); glow(G.node[l], GOLD); });
      const parts = st.cands.map((c) => c.w + '+' + MS.cost[c.l]).join(', ');
      say('頂點 ' + v + '：看所有往下一個 stage 的邊', st.cands.length > 1 ? 'min(' + parts + ') = ' + st.best : parts + ' = ' + st.best);
      if (tok === undefined) log('cost(' + MSG.stage[v] + ',' + v + ') = ' + (st.cands.length > 1 ? 'min(' + parts + ')' : parts) + ' = ' + st.best + '，d = ' + MS.d[v].join(' 或 '));
      await wait(tok, ms);
      st.cands.forEach((c) => { if (c.s === st.best) tint(edgeOf(G, v, c.l), TEAL); else tint(edgeOf(G, v, c.l), GRAY); });
      await wait(tok, ms * 0.5);
      st.out.forEach(([, l]) => glow(G.node[l], null));
    }
    msgFill(G, v);
    glow(G.node[v], null);
    await wait(tok, ms * 0.4);
  }
  async function scMsgGraph(tok) {
    fresh([0, 4.4, 15], [0, 4.4, 0]);
    say('Multistage graph：有向加權圖', '');
    const G = buildMSG(false, true);
    await wait(tok, 2400);
    Object.values(G.edge).forEach((e) => tint(e, GRAY));
    for (let s = 1; s <= 4; s++) {
      MSG.E.filter((e) => MSG.stage[e[0]] === s).forEach((e) => tint(edgeOf(G, e[0], e[1]), ORANGE));
      say('邊只從 stage ' + s + ' 連到 stage ' + (s + 1), '頂點分成 5 個 stage');
      await wait(tok, 1100);
    }
    Object.values(G.edge).forEach((e) => tint(e, SAND));
    glow(G.node[1], GOLD); glow(G.node[12], GOLD);
    say('頭尾 stage 各一點：source、sink', '目標：1 到 12 的最小成本路徑');
    await wait(tok, 3000);
    glow(G.node[1], null); glow(G.node[12], null);
    const tk = cube('', ORANGE, [0.36, 0.36, 0.36], MSG.pos[1][0], MSG.pos[1][1] + 0.55, 0.4);
    const route = [1, 5, 7, 10, 12];
    for (let k = 1; k < route.length; k++) {
      const [x, y] = MSG.pos[route[k]];
      MSG.E.filter((e) => e[0] === route[k - 1]).forEach((e) => tint(edgeOf(G, e[0], e[1]), ORANGE));
      say('在 stage ' + MSG.stage[route[k - 1]] + '：從幾條邊裡選一條', '每個 stage 都要做一次決策');
      await wait(tok, 1300);
      MSG.E.filter((e) => e[0] === route[k - 1]).forEach((e) => tint(edgeOf(G, e[0], e[1]), e[1] === route[k] ? TEAL : SAND));
      move(tk, x, y + 0.55, 0.4);
      await wait(tok, 700);
    }
    say('能拆成一連串決策', 'principle of optimality 成立 → 能用 DP');
    await wait(tok, 3200);
  }
  async function scMsgCostTable(tok) {
    fresh([0, 4.4, 15.5], [0, 3.8, 0]);
    const G = buildMSG(true, false);
    say('從 sink 往回算每個頂點到 sink 的成本', 'tabulation：先填小的，再填大的');
    await wait(tok, 2600);
    for (const st of MS.steps) await msgStepAnim(G, st, tok, st.v === 1 || st.v === 6 ? 2200 : 1300);
    say('cost(1,1) = 16：經 2 或 3 都是 16', 'd 欄記下「是哪個頂點給出最小值」');
    await wait(tok, 3200);
  }
  async function scMsgFormula(tok) {
    fresh([0, 4.4, 15.5], [0, 3.8, 0]);
    const G = buildMSG(true, false);
    for (const v of [12, 9, 10, 11, 6, 7, 8]) msgFill(G, v);
    say('stage 3、4 已經填好', '現在算 stage 2 的頂點 2');
    await wait(tok, 2400);
    const st = MS.steps.find((s) => s.v === 2);
    glow(G.node[2], GOLD);
    for (const c of st.cands) {
      tint(edgeOf(G, 2, c.l), ORANGE); glow(G.node[c.l], GOLD);
      say('走 2→' + c.l + '：c(2,' + c.l + ') + cost(3,' + c.l + ')', c.w + ' + ' + MS.cost[c.l] + ' = ' + c.s);
      await wait(tok, 1900);
      glow(G.node[c.l], null);
    }
    st.cands.forEach((c) => tint(edgeOf(G, 2, c.l), c.s === st.best ? TEAL : GRAY));
    msgFill(G, 2);
    say('cost(2,2) = min(11, 7, 8) = 7，d = 7', 'cost(3,7) 已經算過，直接用：重疊子問題');
    await wait(tok, 3000);
    say('cost(i, j) = min{ c(j,l) + cost(i+1, l) }', 'l 在 stage i+1，且 (j, l) 是一條邊');
    await wait(tok, 3600);
    glow(G.node[2], null);
  }
  async function scMsgPath(tok) {
    fresh([0, 4.4, 15.5], [0, 3.8, 0]);
    const G = buildMSG(true, false);
    for (const v of MSG.order) msgFill(G, v);
    say('表填完了，現在才開始「做決策」', '從 source 往前走：forward method');
    await wait(tok, 2600);
    const tk = cube('', ORANGE, [0.36, 0.36, 0.36], MSG.pos[1][0], MSG.pos[1][1] + 0.9, 0.4);
    async function walk(first, color) {
      let v = 1, path = [1];
      move(tk, MSG.pos[1][0], MSG.pos[1][1] + 0.9, 0.4);
      await wait(tok, 500);
      while (v !== 12) {
        const nx = v === 1 ? first : MS.d[v][0];
        G.g.mark(1, v - 1, '#f3d27a');
        say('d(' + MSG.stage[v] + ', ' + v + ') = ' + nx + '：走到 ' + nx, '');
        tint(edgeOf(G, v, nx), color);
        move(tk, MSG.pos[nx][0], MSG.pos[nx][1] + 0.9, 0.4);
        v = nx; path.push(v);
        await wait(tok, 1400);
      }
      return path;
    }
    const p1 = await walk(2, TEAL);
    say('路徑 ' + p1.join('→') + '，成本 16', '9 + 2 + 3 + 2 = 16');
    await wait(tok, 2600);
    const p2 = await walk(3, PINK);
    say('另一條 ' + p2.join('→') + ' 也是 16', '7 + 2 + 5 + 2 = 16；最佳值只有一個');
    await wait(tok, 3200);
  }

  // ───────────────────────── MIT 6.006 L12：DP 的觀念 ─────────────────────────
  async function scRecipe(tok) {
    fresh([0, 4.6, 14.5], [0, 3.6, 0]);
    say('DP ≈ 小心執行的暴力搜尋', 'careful brute force：試遍所有可能');
    await wait(tok, 2200);
    const rows = [];
    for (let d = 0; d < 5; d++) {
      const cnt = 2 ** d, sp = Math.min(1.2, 9.6 / cnt);
      const row = [];
      for (let k = 0; k < cnt; k++) row.push(cube('', DCOL[d], [Math.min(0.9, sp * 0.8), 0.35, 0.35], (k - (cnt - 1) / 2) * sp, 6.8 - d * 1.05, 0, 1.2));
      rows.push(row);
      say('每多猜一層，可能性翻倍', '第 ' + (d + 1) + ' 層：' + cnt + ' 種');
      await wait(tok, 700);
    }
    say('直接遞迴：指數時間', '例如 Fibonacci 的遞迴樹');
    await wait(tok, 2000);
    const tech = [['guessing', '不知道就全部試，取最好'], ['recursion', '用子問題表示答案'], ['memoization', '算過就記在表上']];
    const tl = tech.map(([t], k) => tag(t, 'ptr', -4.4 + k * 4.4, 1.0));
    for (let k = 0; k < 3; k++) { setCls(tl[k], 'ptr alt'); say('三招之 ' + (k + 1) + '：' + tech[k][0], tech[k][1]); await wait(tok, 2000); }
    say('memo 之後，相同的子問題只算一次', '指數多個節點 → 只剩 n 個不同子問題');
    const flat = rows.flat();
    flat.forEach((m, k) => { if (k < 7) move(m, -4.5 + k * 1.5, 3.4, 0); else fly(m, V3(0, 6, 3)); });
    await wait(tok, 1600);
    const subs = flat.slice(0, 7);
    subs.forEach((m, k) => { m.scale.set(1.4, 1.6, 1.6); m.userData.lbl = lab.label('F' + (k + 1), 'val'); m.add(m.userData.lbl); tint(m, BLUE); });
    await wait(tok, 1200);
    say('總時間 = 子問題數 × 每題時間', '遞迴呼叫當作免費：只有第一次要付（像攤銷）');
    for (const m of subs) { glow(m, GOLD); await wait(tok, 260); }
    await wait(tok, 1600);
    say('Fibonacci：n 題 × Θ(1) = Θ(n)', '最短路徑（Bellman-Ford）：V² 題 → Θ(VE)');
    await wait(tok, 3400);
  }
  async function scDag(tok) {
    fresh([0, 4.6, 14.5], [0, 3.8, 0]);
    say('另一個角度：DP 就是在 DAG 上找最短路徑', '子問題 = 節點、依賴 = 邊');
    const xs = (k) => -4.8 + k * 1.6;
    const fv = [0, 1, 1, 2, 3, 5, 8, 13];
    const nodes = [];
    for (let k = 1; k <= 7; k++) nodes.push(cube('F' + k, GRAY, [0.9, 0.6, 0.5], xs(k - 1), 5.6, 0, 1.2));
    await wait(tok, 1600);
    for (let k = 1; k < 7; k++) {
      arrow(V3(xs(k - 1), 5.6, 0.4), V3(xs(k), 5.6, 0.4), TRY);
      if (k >= 2) arc(V3(xs(k - 2), 5.95, 0.4), V3(xs(k), 5.95, 0.4), 0.8, SAND);
    }
    say('F(n) 依賴 F(n−1) 與 F(n−2)', '沒有環：一定有拓樸順序');
    await wait(tok, 2600);
    for (let k = 0; k < 7; k++) {
      tint(nodes[k], TEAL); relabel(nodes[k], 'F' + (k + 1) + '=' + fv[k + 1]); glow(nodes[k], GOLD);
      say('依拓樸順序由左往右算', 'bottom-up 的 for 迴圈就是這個順序');
      await wait(tok, 520);
      glow(nodes[k], null);
    }
    await wait(tok, 1200);
    // Bellman-Ford as DP: delta_k(s,v), k outer, v inner
    const V = ['s', 'a', 'b', 'c'];
    const D = [[0, Infinity, Infinity, Infinity], [0, 2, 5, Infinity], [0, 2, 3, 7], [0, 2, 3, 5]];
    const IN = { a: [['s', 2]], b: [['s', 5], ['a', 1]], c: [['a', 6], ['b', 2]], s: [] };
    const g = grid({ rows: 4, cols: 4, cw: 1.3, ch: 0.72, x0: -1.95, y0: 3.4, colHdr: V, rowHdr: ['k=0', 'k=1', 'k=2', 'k=3'], rowDx: 0.5 });
    tag('邊：s→a 2、s→b 5、a→b 1、a→c 6、b→c 2', 'idx', 0, 0.2, 0.6);
    say('Bellman-Ford：δₖ(s,v) = 最多用 k 條邊', '猜最後一條邊 (u, v)');
    for (let c = 0; c < 4; c++) g.set(0, c, fmtV(D[0][c]), c ? GRAY : TEAL, 1);
    await wait(tok, 2200);
    for (let k = 1; k < 4; k++) {
      for (let c = 0; c < 4; c++) {
        const v = V[c];
        const deps = [{ r: k - 1, c, best: D[k - 1][c] === D[k][c] }];
        for (const [u, w] of IN[v]) { const cu = V.indexOf(u); deps.push({ r: k - 1, c: cu, best: D[k - 1][cu] + w === D[k][c] && D[k][c] !== D[k - 1][c] }); }
        const parts = IN[v].map(([u, w]) => fmtV(D[k - 1][V.indexOf(u)]) + '+' + w);
        await playStep(g, { r: k, c, v: fmtV(D[k][c]), color: D[k][c] === Infinity ? GRAY : TEAL, deps, cap: 'k = ' + k + '：δ(' + v + ')', formula: parts.length ? 'min(' + fmtV(D[k - 1][c]) + ', ' + parts.join(', ') + ') = ' + fmtV(D[k][c]) : '起點：0' }, tok, 900);
      }
    }
    g.clearArrows(); g.unglow();
    say('k 外層、v 內層：反過來不行', 'V² 個子問題，每題看 indegree → Θ(VE)');
    await wait(tok, 3400);
  }
  async function scFiveSteps(tok) {
    fresh([0, 4.4, 14.5], [0, 3.8, 0]);
    const steps = [
      ['1 子問題', 'F₁ … Fₙ（n 個）', 'δₖ(s,v)（V² 個）'],
      ['2 猜', '不用猜（1 種）', '最後一條邊（indeg+1 種）'],
      ['3 遞迴式', 'Fₙ = Fₙ₋₁ + Fₙ₋₂', 'min{δₖ₋₁(s,u) + w(u,v)}'],
      ['4 順序／時間', '由小到大：Θ(n)', 'k 外 v 內：Θ(VE)'],
      ['5 原問題', 'Fₙ', 'δ_{V−1}(s,v)，每個 v'],
    ];
    tag('Fibonacci', 'ptr', -0.4, 7.2); tag('最短路徑', 'ptr', 4.0, 7.2);
    say('DP 的五個步驟', '用上一講的兩個例子對照');
    await wait(tok, 2000);
    const caps = ['定義子問題：數一數有幾個', '猜答案的某個特徵：數一數有幾種選擇', '用子問題寫出遞迴式（通常是 min／max）', '確認子問題無環（拓樸順序）；時間 = 題數 × 每題', '確認原問題被解出來了'];
    for (let k = 0; k < 5; k++) {
      const y = 6.2 - k * 1.25;
      plate(-4.6, y, 2.4, 0.9, '#e2d4b8'); tag(steps[k][0], 'ptr alt', -4.6, y);
      plate(-0.4, y, 4, 0.9); plate(4.0, y, 4.4, 0.9);
      say(caps[k], '');
      await wait(tok, 900);
      cube('', TEAL, [0.25, 0.25, 0.25], -2.6, y, 0.1, 1);
      tag(steps[k][1], '', -0.4, y, 0.1);
      await wait(tok, 900);
      tag(steps[k][2], '', 4.0, y, 0.1);
      await wait(tok, 1400);
    }
    say('2、3 步最難：決定猜什麼、子問題是什麼', '4 步可以用 memo 遞迴或 bottom-up 表');
    await wait(tok, 3600);
  }

  // ── Text justification ──
  const TJ = { words: ['the', 'cat', 'is', 'happy'], W: 10 };
  const lineLen = (i, j) => TJ.words.slice(i, j).reduce((s, w) => s + w.length, 0) + (j - i - 1);
  const badness = (i, j) => (lineLen(i, j) > TJ.W ? Infinity : (TJ.W - lineLen(i, j)) ** 3);
  function tjSolve() {
    const n = TJ.words.length, DP = new Array(n + 1).fill(0), par = new Array(n + 1).fill(null), tries = [];
    for (let i = n - 1; i >= 0; i--) {
      DP[i] = Infinity; tries[i] = [];
      for (let j = i + 1; j <= n; j++) { const v = badness(i, j) + DP[j]; tries[i].push({ j, b: badness(i, j), v }); if (v < DP[i]) { DP[i] = v; par[i] = j; } }
    }
    return { DP, par, tries };
  }
  const TJS = tjSolve();
  const CW = 0.55;
  function pageLines(x0, y0, lines, color) {
    const out = [];
    lines.forEach((ws, r) => {
      let x = x0;
      ws.forEach((w) => { const len = w.length * CW; out.push(cube(w, color, [len - 0.06, 0.55, 0.4], x + len / 2, y0 - r * 1.05, 0, 1.2)); x += len + CW; });
    });
    return out;
  }
  function pageFrame(x0, y0, rows, title) {
    plate(x0 + TJ.W * CW / 2, y0 - (rows - 1) * 0.525, TJ.W * CW + 0.3, rows * 1.05 + 0.4, '#f6efe2', -0.2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, rows * 1.05 + 0.6, 0.05), new THREE.MeshBasicMaterial({ color: RED }));
    m.position.set(x0 + TJ.W * CW, y0 - (rows - 1) * 0.525, 0.1); lab.world.add(m);
    tag(title, 'ptr', x0 + TJ.W * CW / 2, y0 + 0.9);
  }
  async function scTjBadness(tok) {
    fresh([0, 4.4, 14], [0, 3.8, 0]);
    say('Text justification：哪裡換行？', '只能在字與字之間斷行；每行寬 W = 10');
    await wait(tok, 2600);
    const L = -6.3, R = 0.6;
    pageFrame(L, 5.6, 2, 'Greedy（舊版 Word）');
    say('Greedy：每行塞越多字越好', '');
    pageLines(L, 5.6, [['the', 'cat', 'is']], ORANGE);
    await wait(tok, 1400);
    const over = pageLines(L, 5.6, [['the', 'cat', 'is', 'happy']].map((ws) => ws.slice(3)), RED);
    over.forEach((m) => move(m, L + 11 * CW + 1.6, 5.6, 0));
    say('happy 塞不下：超過寬度', 'badness = ∞（絕不允許）');
    await wait(tok, 1800);
    over.forEach((m) => move(m, L + 2.5 * CW, 4.55, 0));
    tag('(10−10)³ = 0', 'idx', L + 2.75, 3.95 + 1.05);
    tag('(10−5)³ = 125', 'idx', L + 2.75, 3.95);
    say('badness = (W − 這行總長)³', '空白越多罰越重；第二行 125');
    await wait(tok, 2600);
    const gT = tag('總和 125', 'ptr alt', L + 2.75, 2.9);
    pageFrame(R, 5.6, 2, 'DP（LaTeX）');
    say('DP：第一行少放一個字', '');
    pageLines(R, 5.6, [['the', 'cat'], ['is', 'happy']], TEAL);
    await wait(tok, 1600);
    tag('(10−7)³ = 27', 'idx', R + 2.75, 5.0);
    tag('(10−8)³ = 8', 'idx', R + 2.75, 3.95);
    tag('總和 35', 'ptr alt', R + 2.75, 2.9);
    say('27 + 8 = 35 < 125', '讓前一行差一點，後面好很多');
    await wait(tok, 3000);
    setCls(gT, 'ptr');
    say('目標：所有行的 badness 總和最小', '暴力法：每個字要不要開新行 → 2ⁿ 種');
    await wait(tok, 3400);
  }
  function tjWordsRow(g) {
    TJ.words.forEach((w, i) => { const p = g.pos(0, i); cube(w, ORANGE, [w.length * 0.38 + 0.4, 0.55, 0.4], p.x, 5.6, 0); tag('word ' + i, 'idx', p.x, 6.25); });
    tag('（結束）', 'idx', g.pos(0, 4).x, 5.6);
  }
  async function scTjDP(tok) {
    fresh([0, 4.4, 14], [0, 3.6, 0]);
    const g = grid({ rows: 1, cols: 5, cw: 1.9, ch: 1.0, x0: -3.8, y0: 3.6, colHdr: ['DP[0]', 'DP[1]', 'DP[2]', 'DP[3]', 'DP[4]'] });
    tjWordsRow(g);
    say('子問題：suffix words[i:]', '只記得「還剩哪些字」→ 只有 n 個');
    await wait(tok, 2600);
    say('猜：第二行從哪個字 j 開始', 'DP[i] = min over j of badness(i, j) + DP[j]');
    await wait(tok, 2600);
    g.set(0, 4, 0, TEAL);
    say('base case：DP[4] = 0', '沒有字了，不花成本');
    await wait(tok, 2000);
    for (let i = 3; i >= 0; i--) {
      for (const t of TJS.tries[i]) {
        g.clearArrows(); g.unglow();
        g.arc(0, t.j, 0, i, t.v === TJS.DP[i] ? OKC : TRY);
        const m = g.get(0, t.j); glow(m, GOLD);
        say('i = ' + i + '，j = ' + t.j + '：「' + TJ.words.slice(i, t.j).join(' ') + '」', 'badness ' + fmtV(t.b) + ' + DP[' + t.j + '] ' + TJS.DP[t.j] + ' = ' + fmtV(t.v));
        await wait(tok, 1300);
      }
      g.clearArrows(); g.unglow();
      g.arc(0, TJS.par[i], 0, i, OKC);
      g.set(0, i, TJS.DP[i], TEAL);
      say('DP[' + i + '] = ' + TJS.DP[i], '最好的 j = ' + TJS.par[i]);
      await wait(tok, 1500);
    }
    g.clearArrows();
    say('從右往左算：j 永遠比 i 大', 'n 個子問題 × 每題 O(n) = Θ(n²)；答案 DP[0] = 35');
    await wait(tok, 3400);
  }
  async function scTjParent(tok) {
    fresh([0, 4.4, 14], [0, 3.4, 0]);
    const g = grid({ rows: 2, cols: 5, cw: 1.9, ch: 0.9, x0: -3.8, y0: 3.8, colHdr: ['0', '1', '2', '3', '4'], rowHdr: ['DP', 'parent'], rowDx: 0.7 });
    tjWordsRow(g);
    for (let i = 0; i <= 4; i++) { g.set(0, i, TJS.DP[i], TEAL, 0); g.set(1, i, i === 4 ? '—' : TJS.par[i], PURPLE, 0); }
    say('DP[0] = 35 只告訴我們成本', '怎麼斷行？');
    await wait(tok, 2400);
    say('算 min 時順便記下 arg min', 'parent[i] = 讓 DP[i] 最小的 j');
    await wait(tok, 2600);
    let i = 0;
    const lines = [];
    while (i < 4) {
      const j = TJS.par[i];
      g.mark(1, i, '#f3d27a'); glow(g.get(1, i), GOLD);
      g.clearArrows(); g.arc(1, i, 1, j, OKC, true);
      lines.push(TJ.words.slice(i, j).join(' '));
      say('parent[' + i + '] = ' + j + '：一行放 word ' + i + '…' + (j - 1), '「' + lines[lines.length - 1] + '」');
      await wait(tok, 2200);
      i = j;
    }
    g.clearArrows();
    tag(lines.join('  ⏎  '), 'ptr alt', 0, 1.2);
    say('0 → 2 → 4：the cat ⏎ is happy', '跟著 parent 走，O(n) 就還原出解');
    await wait(tok, 3400);
  }

  // ── Blackjack ──
  const handVal = (cs) => { let s = 0, ace = false; for (const c of cs) { s += c; if (c === 1) ace = true; } return ace && s + 10 <= 21 ? s + 10 : s; };
  const cardName = (c) => (c === 1 ? 'A' : String(c));
  function bjPlay(deck, i, hits) {
    const n = deck.length;
    if (i + 4 > n) return null;
    const P = [deck[i], deck[i + 2]], D = [deck[i + 1], deck[i + 3]];
    let k = i + 4;
    for (let h = 0; h < hits; h++) { if (handVal(P) > 21 || k >= n) return null; P.push(deck[k++]); }
    const pv = handVal(P);
    if (pv > 21) return { out: -1, j: k, P, D, pv, dv: handVal(D) };
    while (handVal(D) < 17) { if (k >= n) return null; D.push(deck[k++]); }
    const dv = handVal(D);
    return { out: dv > 21 || pv > dv ? 1 : pv < dv ? -1 : 0, j: k, P, D, pv, dv };
  }
  function bjSolve(deck) {
    const n = deck.length, BJ = new Array(n + 1).fill(0), par = new Array(n + 1).fill(null), tries = [];
    for (let i = n; i >= 0; i--) {
      tries[i] = [];
      for (let h = 0; h <= n; h++) { const r = bjPlay(deck, i, h); if (!r) break; tries[i].push({ h, ...r, v: r.out + BJ[r.j] }); }
      if (tries[i].length) { const b = tries[i].reduce((a, t) => (t.v > a.v ? t : a)); BJ[i] = b.v; par[i] = b; }
    }
    return { BJ, par, tries };
  }
  const DECK = [9, 10, 2, 7, 10, 10, 8, 9, 10, 6, 5, 10];
  function card(c, x, y, z = 0, color = '#fbf7f0', drop = 0) {
    const m = cube(cardName(c), color, [0.62, 0.86, 0.06], x, y, z, drop);
    return m;
  }
  async function scBjRules(tok) {
    fresh([0, 4.4, 13], [0, 3.4, 0]);
    tag('玩家', 'ptr', -3.6, 6.6); tag('莊家', 'ptr', 3.6, 6.6);
    const pl = tag('', 'ptr alt', -3.6, 2.6), dl = tag('', 'ptr alt', 3.6, 2.6);
    say('Blackjack：點數超過 21 就輸（爆牌）', 'A 可算 1 或 11');
    await wait(tok, 2400);
    async function deal(P, D, dHits) {
      const all = [];
      const pos = [[-4.0, 4.6], [3.2, 4.6], [-3.2, 4.6], [4.0, 4.6]];
      const seq = [P[0], D[0], P[1], D[1]];
      for (let k = 0; k < 4; k++) {
        all.push(card(seq[k], pos[k][0], pos[k][1], 0, k === 3 ? '#b8a98a' : '#fbf7f0', 2));
        say('發牌順序：玩家、莊家、玩家、莊家', '莊家有一張牌先蓋著');
        await wait(tok, 600);
      }
      txt(pl, '玩家 ' + handVal(P));
      await wait(tok, 1200);
      return all;
    }
    let cs = await deal([1, 7], [10, 7]);
    say('玩家 A + 7 = 8 或 18', '選擇：hit（再拿）或 stand（停）→ stand');
    await wait(tok, 2600);
    tint(cs[3], '#fbf7f0'); txt(dl, '莊家 17');
    say('莊家翻牌：17', '莊家固定策略：< 17 就拿，≥ 17 就停');
    await wait(tok, 2600);
    say('18 > 17：玩家贏 $1', '平手不輸不贏（0）');
    txt(pl, '玩家 18 ✓'); await wait(tok, 2400);
    cs.forEach((m) => fly(m)); txt(pl, ''); txt(dl, '');
    await wait(tok, 800);
    cs = await deal([10, 8], [10, 10]);
    say('玩家 18，照策略 stand', '');
    await wait(tok, 1800);
    tint(cs[3], '#fbf7f0'); txt(dl, '莊家 20 ✓');
    say('莊家 20：玩家輸 $1', '每手的結果只有 +1、0、−1');
    await wait(tok, 3000);
  }
  async function runBj(tok, deck, ms) {
    const S = bjSolve(deck), n = deck.length;
    const cw = Math.min(1.0, 11.4 / (n + 1));
    const g = grid({ rows: 1, cols: n + 1, cw, ch: 0.8, x0: -cw * n / 2, y0: 3.2, colHdr: Array.from({ length: n + 1 }, (_, k) => k) });
    tag('BJ(i)', 'ptr', -cw * n / 2 - cw * 1.2, 3.2);
    const cards = deck.map((c, k) => card(c, g.pos(0, k).x, 5.4, 0));
    tag('牌堆 c₀ … c' + (n - 1), 'idx', 0, 6.4);
    say('Perfect information：整副牌的順序全知道', 'BJ(i) = 從第 i 張牌開始，最多能贏多少');
    await wait(tok, ms * 2.4);
    for (let i = n; i >= 0; i--) {
      if (!S.tries[i].length) {
        g.set(0, i, 0, GRAY);
        if (i === n || i >= n - 3) { say('剩不到 4 張：不能再開一局', 'BJ(' + i + ') = 0'); await wait(tok, ms * 0.5); }
        continue;
      }
      for (const t of S.tries[i]) {
        g.clearArrows(); g.unglow(); cards.forEach((m) => glow(m, null));
        for (let k = i; k < t.j; k++) glow(cards[k], k < i + 4 ? GOLD : t.P.length > 2 && k < i + 4 + t.h ? '#1d4f7a' : '#4a1f4a');
        g.arc(0, t.j, 0, i, t.v === S.BJ[i] ? OKC : TRY);
        glow(g.get(0, t.j), GOLD);
        const res = t.out > 0 ? '+1' : t.out < 0 ? '−1' : '0';
        say('i=' + i + '：hit ' + t.h + ' 次，' + t.pv + (t.pv > 21 ? '爆' : '') + ' vs 莊家 ' + t.dv + (t.dv > 21 ? '爆' : ''), res + ' + BJ(' + t.j + ') ' + S.BJ[t.j] + ' = ' + t.v);
        await wait(tok, ms);
      }
      g.clearArrows(); g.unglow(); cards.forEach((m) => glow(m, null));
      g.arc(0, S.par[i].j, 0, i, OKC);
      g.set(0, i, S.BJ[i], S.BJ[i] > 0 ? TEAL : S.BJ[i] < 0 ? RED : GRAY);
      say('BJ(' + i + ') = max(…) = ' + S.BJ[i], '最好：hit ' + S.par[i].h + ' 次');
      await wait(tok, ms * 0.9);
    }
    g.clearArrows();
    return S;
  }
  async function scBjDP(tok) {
    fresh([0, 4.4, 14], [0, 3.8, 0]);
    const S = await runBj(tok, DECK, 1300);
    let i = 0, stand = 0; while (true) { const r = bjPlay(DECK, i, 0); if (!r) break; stand += r.out; i = r.j; }
    say('BJ(0) = ' + S.BJ[0] + '：最多淨贏 $' + S.BJ[0], '對照：每局都 stand 只得 ' + stand + '（第一局該 hit 一次）');
    await wait(tok, 3200);
    say('子問題 = 牌堆的 suffix', '已玩的永遠是 prefix → 只有 n 個子問題');
    await wait(tok, 3000);
    say('猜：這一局要 hit 幾次', 'n 題 × n 種猜法 × 跑莊家 → 最多 O(n³)');
    await wait(tok, 3400);
  }

  // ───────────────────────── Rod cutting（CLRS 15.1） ─────────────────────────
  const ROD_P = [0, 1, 5, 8, 9, 10, 17, 17, 20, 24, 30];
  function rodSteps(n, P) {
    const r = [0], s = [0], steps = [];
    for (let j = 1; j <= n; j++) {
      let best = -1, bi = 0; const c = [];
      for (let i = 1; i <= j; i++) { const v = P[i] + r[j - i]; c.push({ i, v }); if (v > best) { best = v; bi = i; } }
      r[j] = best; s[j] = bi;
      steps.push({ r: 2, c: j, v: best, color: TEAL, also: [[1, j, bi, PURPLE]],
        deps: c.map((x) => ({ r: 2, c: j - x.i, arc: true, best: x.i === bi })), hi: [[0, bi]],
        cap: 'r[' + j + ']：第一刀切 i 公分，試 i = 1…' + j, formula: 'max(' + c.map((x) => P[x.i] + '+' + r[j - x.i]).join(', ') + ') = ' + best,
        log: 'r[' + j + '] = max_i (p[i] + r[' + j + '−i]) = ' + best + '，第一段切 ' + bi });
    }
    return { r, s, steps };
  }
  function rodGrid(n, P) {
    const cw = Math.min(1.1, 10.4 / (n + 1));
    const g = grid({ rows: 3, cols: n + 1, cw, ch: 0.78, x0: -cw * n / 2 + 0.4, y0: 5.6, colHdr: Array.from({ length: n + 1 }, (_, k) => k), rowHdr: ['p[i]', 's[j]', 'r[j]'], rowDx: 0.5 });
    for (let i = 1; i <= n; i++) g.set(0, i, P[i], ORANGE, 0);
    g.set(2, 0, 0, TEAL, 0);
    return g;
  }
  async function showRodCuts(tok, R, n, y) {
    const pieces = []; let j = n;
    while (j > 0) { pieces.push(R.s[j]); j -= R.s[j]; }
    let x = -n * 0.6 / 2 * 1.0;
    const unit = Math.min(0.75, 9 / n);
    x = -n * unit / 2;
    for (const p of pieces) { cube(p, PINK, [p * unit - 0.08, 0.4, 0.4], x + p * unit / 2, y, 0.6, 1.5); x += p * unit; await wait(tok, 500); }
    return pieces;
  }
  async function scRod(tok) {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const n = 8;
    say('Rod cutting：長 n 的鐵條切成幾段賣', 'p[i] = 長度 i 的價格（CLRS 的價目表）');
    const g = rodGrid(n, ROD_P);
    await wait(tok, 2600);
    say('暴力：每個整數位置切或不切 → 2ⁿ⁻¹ 種', '改用 DP：r[j] = max(p[i] + r[j−i])');
    await wait(tok, 2800);
    const R = rodSteps(n, ROD_P);
    for (const s of R.steps) await playStep(g, s, tok, s.c <= 2 ? 1800 : 1500);
    g.clearArrows(); g.unglow();
    say('r[8] = 22；用 s[j] 還原切法', 's[8] = 2 → 剩 6，s[6] = 6');
    const pcs = await showRodCuts(tok, R, n, 1.2);
    await wait(tok, 1200);
    say('切成 ' + pcs.join(' + ') + '：5 + 17 = 22', 'Θ(n²)：n 格 × 每格試 j 種');
    await wait(tok, 3200);
  }

  // ───────────────────────── 0/1 Knapsack ─────────────────────────
  const KN = { items: [[2, 1], [3, 2], [4, 5], [5, 6]], W: 8 };
  function knapSteps(items, W) {
    const n = items.length, V = [new Array(W + 1).fill(0)], steps = [];
    for (let i = 1; i <= n; i++) {
      V[i] = [0];
      const [wi, vi] = items[i - 1];
      for (let w = 1; w <= W; w++) {
        const skip = V[i - 1][w], take = wi <= w ? V[i - 1][w - wi] + vi : -Infinity;
        const v = Math.max(skip, take); V[i][w] = v;
        const tk = take > skip;
        const deps = [{ r: i - 1, c: w, best: !tk }];
        if (wi <= w) deps.push({ r: i - 1, c: w - wi, best: tk });
        steps.push({ r: i, c: w, v, color: tk ? TEAL : BLUE, deps,
          cap: wi > w ? '第 ' + i + ' 件（重 ' + wi + '）放不下：照抄上面' : tk ? '放第 ' + i + ' 件比較好' : '不放第 ' + i + ' 件比較好',
          formula: wi > w ? 'V[' + i + '][' + w + '] = V[' + (i - 1) + '][' + w + '] = ' + v : 'max(' + skip + ', V[' + (i - 1) + '][' + (w - wi) + '] + ' + vi + ' = ' + take + ') = ' + v,
          log: 'V[' + i + '][' + w + '] = ' + v + (wi > w ? '（放不下）' : tk ? '（放）' : '（不放）') });
      }
    }
    return { V, steps };
  }
  function knapGrid(items, W) {
    const cw = Math.min(0.9, 9.6 / (W + 1)), n = items.length;
    const g = grid({ rows: n + 1, cols: W + 1, cw, ch: Math.min(0.78, 5.6 / (n + 1)), x0: -cw * W / 2 + 0.7, y0: 6.3,
      colHdr: Array.from({ length: W + 1 }, (_, k) => 'w=' + k), rowHdr: ['i=0', ...items.map((it, k) => 'i=' + (k + 1) + ' (' + it[0] + ',' + it[1] + ')')], rowDx: 0.95 });
    for (let w = 0; w <= W; w++) g.set(0, w, 0, GRAY, 0);
    for (let i = 1; i <= n; i++) g.set(i, 0, 0, GRAY, 0);
    return g;
  }
  async function knapTrace(tok, g, items, V, W, ms) {
    let w = W; const take = [];
    for (let i = items.length; i >= 1; i--) {
      const t = V[i][w] !== V[i - 1][w];
      g.mark(i, w, t ? '#9fe0c4' : '#f3d27a'); glow(g.get(i, w), GOLD);
      say(t ? '第 ' + i + ' 件有放：w −= ' + items[i - 1][0] : '第 ' + i + ' 件沒放', 'V[' + i + '][' + w + '] = ' + V[i][w] + (t ? ' ≠ ' : ' = ') + 'V[' + (i - 1) + '][' + w + '] = ' + V[i - 1][w]);
      if (tok === undefined) log(t ? '第 ' + i + ' 件放入（重 ' + items[i - 1][0] + '，值 ' + items[i - 1][1] + '）' : '第 ' + i + ' 件不放');
      await wait(tok, ms);
      if (t) { take.push(i); w -= items[i - 1][0]; }
    }
    return take.reverse();
  }
  async function scKnap(tok) {
    fresh([0, 4.2, 14.5], [0, 3.6, 0]);
    const { items, W } = KN;
    say('0/1 Knapsack：容量 8', '每件拿或不拿；(重量, 價值) = (2,1) (3,2) (4,5) (5,6)');
    const g = knapGrid(items, W);
    await wait(tok, 2800);
    say('V[i][w]：前 i 件、容量 w 的最佳', '第 0 列、第 0 行都是 0');
    await wait(tok, 2600);
    const S = knapSteps(items, W);
    for (const s of S.steps) await playStep(g, s, tok, s.r === 1 && s.c <= 3 ? 1500 : 620, s.r > 1 && s.c < items[s.r - 1][0] && s.c > 1);
    g.clearArrows(); g.unglow();
    say('V[4][8] = 8：從右下角往回看', '跟上一列一樣 → 沒放；不一樣 → 有放');
    await wait(tok, 2400);
    const take = await knapTrace(tok, g, items, S.V, W, 1600);
    say('放第 ' + take.join('、') + ' 件：2 + 6 = 8', 'Θ(nW)：W 是數值，不是輸入長度（pseudo-polynomial）');
    await wait(tok, 3400);
  }

  // ───────────────────────── LCS（CLRS 15.4） ─────────────────────────
  function lcsSteps(X, Y) {
    const m = X.length, n = Y.length, c = [], b = [], steps = [];
    for (let i = 0; i <= m; i++) { c[i] = new Array(n + 1).fill(0); b[i] = new Array(n + 1).fill(''); }
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      let deps, cap, f;
      if (X[i - 1] === Y[j - 1]) {
        c[i][j] = c[i - 1][j - 1] + 1; b[i][j] = '↖';
        deps = [{ r: i - 1, c: j - 1, best: true }]; cap = X[i - 1] + ' = ' + Y[j - 1] + '：相同，左上 + 1'; f = 'c[' + i + '][' + j + '] = c[' + (i - 1) + '][' + (j - 1) + '] + 1 = ' + c[i][j];
      } else if (c[i - 1][j] >= c[i][j - 1]) {
        c[i][j] = c[i - 1][j]; b[i][j] = '↑';
        deps = [{ r: i - 1, c: j, best: true }, { r: i, c: j - 1, best: false }]; cap = X[i - 1] + ' ≠ ' + Y[j - 1] + '：取上、左較大的'; f = 'max(' + c[i - 1][j] + ', ' + c[i][j - 1] + ') = ' + c[i][j] + '（同分取上）';
      } else {
        c[i][j] = c[i][j - 1]; b[i][j] = '←';
        deps = [{ r: i - 1, c: j, best: false }, { r: i, c: j - 1, best: true }]; cap = X[i - 1] + ' ≠ ' + Y[j - 1] + '：取上、左較大的'; f = 'max(' + c[i - 1][j] + ', ' + c[i][j - 1] + ') = ' + c[i][j];
      }
      steps.push({ r: i, c: j, v: c[i][j] + b[i][j], color: b[i][j] === '↖' ? TEAL : BLUE, deps, cap, formula: f, log: 'c[' + i + '][' + j + '] = ' + c[i][j] + ' ' + b[i][j] });
    }
    return { c, b, steps };
  }
  function lcsGrid(X, Y) {
    const m = X.length, n = Y.length;
    const cw = Math.min(0.85, 8.4 / (n + 1)), ch = Math.min(0.68, 6 / (m + 1));
    const g = grid({ rows: m + 1, cols: n + 1, cw, ch, x0: -cw * n / 2, y0: 6.5, colHdr: ['', ...Y.split('')], rowHdr: ['', ...X.split('')], colCls: 'ptr', rowCls: 'ptr', rowDx: 0.2 });
    for (let j = 0; j <= n; j++) g.set(0, j, 0, GRAY, 0);
    for (let i = 1; i <= m; i++) g.set(i, 0, 0, GRAY, 0);
    tag('X', 'ptr alt', -cw * n / 2 - cw * 1.5, 6.5 + ch * 0.8); tag('Y →', 'idx', -cw * n / 2 + cw * 0.3, 6.5 + ch * 1.6);
    return g;
  }
  async function lcsTrace(tok, g, X, Y, L, ms) {
    let i = X.length, j = Y.length; const out = [];
    while (i > 0 && j > 0) {
      const d = L.b[i][j];
      g.mark(i, j, d === '↖' ? '#9fe0c4' : '#f3d27a'); glow(g.get(i, j), d === '↖' ? GREEN : GOLD);
      if (d === '↖') { out.unshift(X[i - 1]); say(X[i - 1] + ' 是 LCS 的字元', '↖：往左上；目前 ' + out.join('')); i--; j--; }
      else if (d === '↑') { say('↑：往上走', '目前 ' + (out.join('') || '（空）')); i--; }
      else { say('←：往左走', '目前 ' + (out.join('') || '（空）')); j--; }
      await wait(tok, ms);
    }
    return out.join('');
  }
  const LCS_X = 'ABCBDAB', LCS_Y = 'BDCABA';
  async function scLcsTable(tok) {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    say('LCS：最長共同子序列', 'X = ABCBDAB、Y = BDCABA（CLRS）');
    const g = lcsGrid(LCS_X, LCS_Y);
    await wait(tok, 2600);
    say('c[i][j]：前綴 Xᵢ、Yⱼ 的 LCS 長度', '相同：左上 + 1；不同：max(上, 左)');
    await wait(tok, 2800);
    const L = lcsSteps(LCS_X, LCS_Y);
    for (const s of L.steps) await playStep(g, s, tok, s.r <= 2 ? 1300 : 520, s.r > 2);
    g.clearArrows(); g.unglow();
    say('c[7][6] = 4：LCS 長度是 4', 'Θ(mn) 格，每格 O(1)');
    await wait(tok, 3200);
  }
  async function scLcsTrace(tok) {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    const g = lcsGrid(LCS_X, LCS_Y);
    const L = lcsSteps(LCS_X, LCS_Y);
    for (const s of L.steps) g.set(s.r, s.c, s.v, s.color, 0);
    say('從右下角跟著箭頭走回去', '↖ 的格子就是共同字元');
    await wait(tok, 2600);
    const s = await lcsTrace(tok, g, LCS_X, LCS_Y, L, 1200);
    say('LCS = ' + s, '路徑長 O(m + n)；同分的取法不同，答案可能不同但長度一樣');
    await wait(tok, 3600);
  }

  // ───────────────────────── LIS ─────────────────────────
  const LIS_A = [10, 9, 2, 5, 3, 7, 101, 18];
  function lisSteps(A) {
    const n = A.length, L = [], prev = [], steps = [];
    for (let i = 0; i < n; i++) {
      L[i] = 1; prev[i] = -1;
      for (let j = 0; j < i; j++) if (A[j] < A[i] && L[j] + 1 > L[i]) { L[i] = L[j] + 1; prev[i] = j; }
      const deps = [];
      for (let j = 0; j < i; j++) if (A[j] < A[i]) deps.push({ r: 1, c: j, arc: true, best: j === prev[i] });
      steps.push({ r: 1, c: i, v: L[i], color: TEAL, deps, hi: [[0, i]],
        cap: deps.length ? '接在比 ' + A[i] + ' 小的元素後面' : '前面沒有比 ' + A[i] + ' 小的：自己一個',
        formula: 'L[' + i + '] = 1 + max{L[j] : j < ' + i + ', A[j] < ' + A[i] + '} = ' + L[i],
        log: 'L[' + i + '] = ' + L[i] + (prev[i] >= 0 ? '（接在 A[' + prev[i] + '] = ' + A[prev[i]] + ' 後面）' : '') });
    }
    return { L, prev, steps };
  }
  function lisGrid(A) {
    const n = A.length, cw = Math.min(1.25, 10.4 / n);
    const g = grid({ rows: 2, cols: n, cw, ch: 0.9, x0: -cw * (n - 1) / 2, y0: 5.2, colHdr: A.map((_, k) => k), rowHdr: ['A', 'L'], rowDx: 0.3 });
    A.forEach((v, k) => g.set(0, k, v, ORANGE, 0));
    return g;
  }
  async function scLisN2(tok) {
    fresh([0, 4.2, 14], [0, 3.6, 0]);
    say('LIS：最長嚴格遞增子序列', 'A = 10 9 2 5 3 7 101 18');
    const g = lisGrid(LIS_A);
    await wait(tok, 2400);
    say('L[i] = 以 A[i] 結尾的 LIS 長度', '往前找比 A[i] 小的 j，接在它後面');
    await wait(tok, 2600);
    const S = lisSteps(LIS_A);
    for (const s of S.steps) await playStep(g, s, tok, 1500);
    g.clearArrows(); g.unglow();
    const best = Math.max(...S.L); let k = S.L.indexOf(best); const seq = [];
    while (k >= 0) { seq.unshift(LIS_A[k]); g.mark(0, k, '#9fe0c4'); glow(g.get(0, k), GREEN); k = S.prev[k]; }
    say('答案 = max L[i] = ' + best + '：' + seq.join(' < '), '每格看前面所有 j → O(n²)');
    await wait(tok, 3400);
  }
  async function runLisTails(tok, A, ms) {
    const n = A.length, cw = Math.min(1.25, 10.4 / n);
    const xs = (k) => -cw * (n - 1) / 2 + k * cw;
    const src = A.map((v, k) => { tag(String(k), 'idx', xs(k), 6.35); return cube(v, ORANGE, [cw * 0.8, 0.6, 0.4], xs(k), 5.7, 0); });
    tag('tails', 'ptr', -5.9, 2.6);
    for (let k = 0; k < n; k++) plate(xs(k), 2.6, cw * 0.94, 0.85);
    const tails = [], tm = [];
    for (let i = 0; i < n; i++) {
      const x = A[i];
      glow(src[i], GOLD);
      let lo = 0, hi = tails.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
      if (lo === tails.length) {
        tails.push(x); tm.push(cube(x, TEAL, [cw * 0.8, 0.6, 0.32], xs(lo), 2.6, 0.2, 2));
        say(x + ' 比所有 tails 都大：接在最後', '長度變 ' + tails.length);
      } else {
        const old = tails[lo]; tails[lo] = x;
        fly(tm[lo], V3(0, 6, 3)); tm[lo] = cube(x, PURPLE, [cw * 0.8, 0.6, 0.32], xs(lo), 2.6, 0.2, 2);
        say('二分搜尋：' + x + ' 取代 ' + old + '（第一個 ≥ ' + x + '）', '同長度時結尾越小越好');
      }
      if (tok === undefined) log('處理 ' + x + ' → tails = [' + tails.join(', ') + ']');
      await wait(tok, ms);
      glow(src[i], null);
    }
    return tails;
  }
  async function scLisNlogn(tok) {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    say('O(n log n)：維護 tails 陣列', 'tails[k] = 長度 k+1 遞增序列的最小結尾；tails 遞增 → 可二分');
    await wait(tok, 2800);
    const t = await runLisTails(tok, LIS_A, 1700);
    say('tails 長度 = ' + t.length + ' = LIS 長度', 'n 次 × 二分 O(log n)；tails 本身不一定是 LIS');
    await wait(tok, 3600);
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  // Fibonacci
  function enterFib() {
    fresh([0, 4.8, 15.5], [0, 3.6, 0]);
    controls('<label>n = <input id="fN" type="number" min="2" max="6" value="' + fibState.n + '"></label>'
      + '<button class="primary" id="fNaive">純遞迴</button><button id="fMemo">Memoization</button><button id="fTab">Tabulation</button>');
    $('fN').onchange = (e) => { const v = Number(e.target.value); if (!(v >= 2 && v <= 6)) { log('n 請填 2～6：n 再大樹就塞不下畫面了。', true); e.target.value = fibState.n; return; } fibState.n = v; };
    on('fNaive', () => runOp(async () => { lab.clear(); const r = await runFibNaive(undefined, fibState.n, 260); fibInfo('純遞迴', r.calls); log('fib(' + fibState.n + ') 純遞迴：呼叫 ' + r.calls + ' 次（= 2F(n+1) − 1）'); }));
    on('fMemo', () => runOp(async () => { lab.clear(); const r = await runFibMemo(undefined, fibState.n, 600); fibInfo('Memoization', r.calls); log('memo：只呼叫 ' + r.calls + ' 次 = n + 1'); }));
    on('fTab', () => runOp(async () => { lab.clear(); await runFibTable(undefined, fibState.n, 900); fibInfo('Tabulation', 0); log('tabulation：一個迴圈從 F[2] 填到 F[' + fibState.n + ']，不呼叫函式'); }));
    log('選 n，比較三種寫法的呼叫次數。');
    fibInfo('—', 0);
  }
  function fibInfo(kind, calls) {
    const n = fibState.n;
    setState('Fibonacci fib(' + n + ') = ' + fibV(n), [['寫法', kind], ['這次呼叫次數', kind === 'Tabulation' ? '0（迴圈）' : String(calls)], ['純遞迴', fibCalls(n) + ' 次'], ['memo', (n + 1) + ' 次']],
      '純遞迴 <span class="no">O(2ⁿ)</span>（T(n) ≈ 2T(n−1)+1）<br>memo（top-down）、tabulation（bottom-up）<span class="ok">O(n)</span>');
  }
  // Multistage graph
  const msgM = { G: null, k: 0 };
  function enterMsg() {
    fresh([0, 4.4, 15.5], [0, 3.8, 0]);
    msgM.G = buildMSG(true, false); msgM.k = 0;
    controls('<button class="primary" id="mStep">算下一個頂點</button><button id="mAll">全部算完</button><button id="mPath">找最短路徑</button><button id="mReset">重來</button>');
    on('mStep', () => runOp(async () => { if (msgM.k >= MS.steps.length) { log('表已經填完了，按「找最短路徑」。', true); return; } await msgStepAnim(msgM.G, MS.steps[msgM.k++], undefined, 700); msgInfo(); }));
    on('mAll', () => runOp(async () => { while (msgM.k < MS.steps.length) await msgStepAnim(msgM.G, MS.steps[msgM.k++], undefined, 220); msgInfo(); }));
    on('mPath', () => runOp(async () => {
      if (msgM.k < MS.steps.length) { log('cost 表還沒填完：forward method 要等所有 d 值都有了才能做決策。', true); return; }
      let v = 1; const path = [1];
      while (v !== 12) { const nx = MS.d[v][0]; tint(edgeOf(msgM.G, v, nx), PINK); v = nx; path.push(v); await wait(undefined, 400); }
      log('跟著 d 走：' + path.join(' → ') + '，成本 ' + MS.cost[1] + '（另一條 1→3→6→10→12 也是 16）');
    }));
    on('mReset', () => { clearLog(); enterMsg(); });
    log('從 sink 12 往回，一個一個頂點算 cost 與 d。');
    msgInfo();
  }
  function msgInfo() {
    const done = MS.steps.slice(0, msgM.k).map((s) => s.v);
    setState('Multistage graph（12 個頂點）', [['已算頂點', done.length ? done.join(', ') : '—'], ['下一個', msgM.k < MS.steps.length ? String(MS.steps[msgM.k].v) : '完成'], ['cost(1,1)', msgM.k >= MS.steps.length ? '16' : '?']],
      'cost(i, j) = min{ c(j,l) + cost(i+1, l) }<br>先由後往前填表，再由前往後做決策');
  }
  // Generic table mode (knapsack / LCS / rod / LIS share one stepping UI)
  const tm = { g: null, steps: [], k: 0, after: null, info: null };
  function tableControls(extra, onBuild) {
    controls(extra + '<button class="primary" id="tStep">填下一格</button><button id="tAuto">自動填完</button><button id="tAfter">回溯答案</button><button id="tReset">重來</button>');
    on('tStep', () => runOp(async () => { if (tm.k >= tm.steps.length) { log('表已經填完了，按「回溯答案」。', true); return; } await playStep(tm.g, tm.steps[tm.k++], undefined, 700); tm.info(); }));
    on('tAuto', () => runOp(async () => { while (tm.k < tm.steps.length) await playStep(tm.g, tm.steps[tm.k++], undefined, 240, true); tm.g.clearArrows(); tm.g.unglow(); tm.info(); }));
    on('tAfter', () => runOp(async () => { if (tm.k < tm.steps.length) { log('還有 ' + (tm.steps.length - tm.k) + ' 格沒填：要整張表填完才能回溯。', true); return; } tm.g.clearArrows(); tm.g.unglow(); await tm.after(); }));
    on('tReset', () => { clearLog(); onBuild(); });
  }
  const knM = { items: KN.items.map((x) => x.slice()), W: KN.W };
  function enterKnap() {
    fresh([0, 4.2, 14.5], [0, 3.6, 0]);
    const build = () => {
      lab.clear(); tm.g = knapGrid(knM.items, knM.W); const S = knapSteps(knM.items, knM.W); tm.steps = S.steps; tm.k = 0;
      tm.after = async () => { const take = await knapTrace(undefined, tm.g, knM.items, S.V, knM.W, 700); log('最佳：放第 ' + (take.join('、') || '（無）') + ' 件，總價值 ' + S.V[knM.items.length][knM.W]); };
      tm.info = () => setState('0/1 Knapsack（W = ' + knM.W + '）', [['物品 (w,v)', knM.items.map((x) => '(' + x + ')').join(' ')], ['已填', tm.k + ' / ' + tm.steps.length], ['V[n][W]', tm.k >= tm.steps.length ? String(S.V[knM.items.length][knM.W]) : '?']],
        'V[i][w] = max(V[i−1][w], V[i−1][w−wᵢ] + vᵢ)<br>wᵢ &gt; w 時只能不放；時間 Θ(nW)');
      tm.info();
    };
    tableControls('<label>物品 w:v <input id="kI" value="' + knM.items.map((x) => x.join(':')).join(' ') + '" style="width:150px"></label><label>W = <input id="kW" type="number" min="1" max="10" value="' + knM.W + '"></label><button id="kSet">套用</button>', build);
    on('kSet', () => {
      const its = $('kI').value.trim().split(/\s+/).map((s) => s.split(':').map(Number));
      const W = Number($('kW').value);
      if (!its.length || its.length > 5 || its.some((x) => x.length !== 2 || !(x[0] >= 1 && x[0] <= 10) || !(x[1] >= 0 && x[1] <= 99))) { log('物品格式：w:v 用空白分開，最多 5 件，重量 1～10、價值 0～99。', true); return; }
      if (!(W >= 1 && W <= 10)) { log('W 請填 1～10：表格太寬會塞不下。', true); return; }
      knM.items = its; knM.W = W; clearLog(); build();
    });
    log('一格一格填，看每格是從上面（不放）還是左上方（放）來的。');
    build();
  }
  const lcsM = { X: LCS_X, Y: LCS_Y };
  function enterLcs() {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    const build = () => {
      lab.clear(); tm.g = lcsGrid(lcsM.X, lcsM.Y); const L = lcsSteps(lcsM.X, lcsM.Y); tm.steps = L.steps; tm.k = 0;
      tm.after = async () => { const s = await lcsTrace(undefined, tm.g, lcsM.X, lcsM.Y, L, 600); log('LCS = ' + (s || '（空）') + '，長度 ' + s.length); };
      tm.info = () => setState('LCS', [['X', lcsM.X], ['Y', lcsM.Y], ['已填', tm.k + ' / ' + tm.steps.length], ['長度', tm.k >= tm.steps.length ? String(L.c[lcsM.X.length][lcsM.Y.length]) : '?']],
        'xᵢ = yⱼ：c[i−1][j−1] + 1（↖）<br>否則 max(c[i−1][j]（↑）, c[i][j−1]（←）)；同分取 ↑');
      tm.info();
    };
    tableControls('<label>X <input id="lX" value="' + lcsM.X + '" style="width:90px"></label><label>Y <input id="lY" value="' + lcsM.Y + '" style="width:90px"></label><button id="lSet">套用</button>', build);
    on('lSet', () => {
      const X = $('lX').value.trim().toUpperCase(), Y = $('lY').value.trim().toUpperCase();
      if (!/^[A-Z]{1,8}$/.test(X) || !/^[A-Z]{1,8}$/.test(Y)) { log('X、Y 請用 1～8 個英文字母。', true); return; }
      lcsM.X = X; lcsM.Y = Y; clearLog(); build();
    });
    log('填表：相同字元走 ↖ 加一，不同就取上或左較大的。');
    build();
  }
  const rodM = { n: 8 };
  function enterRod() {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const build = () => {
      lab.clear(); tm.g = rodGrid(rodM.n, ROD_P); const R = rodSteps(rodM.n, ROD_P); tm.steps = R.steps; tm.k = 0;
      tm.after = async () => { const p = await showRodCuts(undefined, R, rodM.n, 1.2); log('切成 ' + p.join(' + ') + '，總價 ' + R.r[rodM.n]); };
      tm.info = () => setState('Rod cutting（n = ' + rodM.n + '）', [['價目 p', ROD_P.slice(1, rodM.n + 1).join(' ')], ['已填', tm.k + ' / ' + tm.steps.length], ['r[n]', tm.k >= tm.steps.length ? String(R.r[rodM.n]) : '?']],
        'r[j] = max₁≤ᵢ≤ⱼ (p[i] + r[j−i])<br>s[j] 記第一刀；Θ(n²)');
      tm.info();
    };
    tableControls('<label>n = <input id="rN" type="number" min="1" max="10" value="' + rodM.n + '"></label><button id="rSet">套用</button>', build);
    on('rSet', () => { const n = Number($('rN').value); if (!(n >= 1 && n <= 10)) { log('n 請填 1～10（價目表只到 10）。', true); return; } rodM.n = n; clearLog(); build(); });
    log('CLRS 價目表：p = 1 5 8 9 10 17 17 20 24 30。');
    build();
  }
  const lisM = { A: LIS_A.slice() };
  function enterLis() {
    fresh([0, 4.2, 14], [0, 3.6, 0]);
    const build = () => {
      lab.clear(); tm.g = lisGrid(lisM.A); const S = lisSteps(lisM.A); tm.steps = S.steps; tm.k = 0;
      tm.after = async () => {
        const best = Math.max(...S.L); let k = S.L.indexOf(best); const seq = [];
        while (k >= 0) { seq.unshift(lisM.A[k]); tm.g.mark(0, k, '#9fe0c4'); glow(tm.g.get(0, k), GREEN); k = S.prev[k]; await wait(undefined, 300); }
        log('LIS 長度 ' + best + '：' + seq.join(' < '));
      };
      tm.info = () => setState('LIS（O(n²)）', [['A', lisM.A.join(' ')], ['已填', tm.k + ' / ' + tm.steps.length], ['LIS 長度', tm.k >= tm.steps.length ? String(Math.max(...S.L)) : '?']],
        'L[i] = 1 + max{ L[j] : j &lt; i, A[j] &lt; A[i] }<br>答案 = max L[i]；O(n log n) 版見「tails」按鈕');
      tm.info();
    };
    tableControls('<label>A <input id="sA" value="' + lisM.A.join(' ') + '" style="width:170px"></label><button id="sSet">套用</button><button id="sTails">tails（n log n）</button>', build);
    on('sSet', () => { const A = $('sA').value.trim().split(/[\s,]+/).map(Number); if (A.length < 2 || A.length > 9 || A.some((x) => !Number.isFinite(x) || Math.abs(x) > 999)) { log('A 請填 2～9 個整數（−999～999），空白分開。', true); return; } lisM.A = A; clearLog(); build(); });
    on('sTails', () => runOp(async () => { lab.clear(); const t = await runLisTails(undefined, lisM.A, 800); log('tails 長度 = ' + t.length + ' = LIS 長度'); }));
    log('L[i]：以 A[i] 結尾的最長遞增子序列長度。');
    build();
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  function mkOpts(ans, cands) {
    const o = [String(ans)];
    for (const c of cands) { const s = String(c); if (!o.includes(s)) o.push(s); if (o.length === 4) break; }
    let k = 1; while (o.length < 4) { const s = String(Number(ans) + k * (k % 2 ? 1 : -1) + (k > 2 ? 3 : 0)); if (!o.includes(s)) o.push(s); k++; }
    return o;
  }
  function genQ() {
    const t = rnd(8);
    if (t === 0) {
      const A = 'ABC', X = Array.from({ length: 4 + rnd(3) }, () => A[rnd(3)]).join(''), Y = Array.from({ length: 4 + rnd(3) }, () => A[rnd(3)]).join('');
      const L = lcsSteps(X, Y), ans = L.c[X.length][Y.length];
      return { q: 'X = ' + X + '、Y = ' + Y + '，LCS 的長度是？', opts: mkOpts(ans, [ans + 1, ans - 1, Math.min(X.length, Y.length)]), ans: String(ans), why: '填 c 表：相同字元取左上 + 1，不同取 max(上, 左)；c[' + X.length + '][' + Y.length + '] = ' + ans + '。' };
    }
    if (t === 1) {
      const n = 3 + rnd(2), items = Array.from({ length: n }, () => [1 + rnd(5), 1 + rnd(9)]), W = 5 + rnd(4);
      const S = knapSteps(items, W), ans = S.V[n][W];
      const byRatio = [...items].sort((a, b) => b[1] / b[0] - a[1] / a[0]); let cap = W, gv = 0; for (const [w, v] of byRatio) if (w <= cap) { cap -= w; gv += v; }
      const sumAll = items.reduce((s, x) => s + x[1], 0);
      return { q: '0/1 Knapsack：W = ' + W + '，物品 (重量,價值) = ' + items.map((x) => '(' + x + ')').join(' ') + '，最大總價值？', opts: mkOpts(ans, [gv, sumAll, ans + 1]), ans: String(ans), why: 'V[i][w] = max(V[i−1][w], V[i−1][w−wᵢ]+vᵢ)，V[' + n + '][' + W + '] = ' + ans + '。照價值密度貪婪拿只得 ' + gv + (gv < ans ? '，不一定最佳。' : '（這題剛好一樣）。') };
    }
    if (t === 2) {
      const n = 4 + rnd(4);
      if (rnd(2)) return { q: '純遞迴 fib(n) = fib(n−1) + fib(n−2)（n ≤ 1 直接回傳），算 fib(' + n + ') 共呼叫幾次函式？', opts: mkOpts(fibCalls(n), [n + 1, 2 ** n, fibV(n)]), ans: String(fibCalls(n)), why: '呼叫次數 C(n) = C(n−1) + C(n−2) + 1 = 2F(n+1) − 1 = ' + fibCalls(n) + '。fib(5) 就是影片的 15 次。' };
      return { q: '加上 memoization（F[] 初值 −1，已知就不呼叫），fib(' + n + ') 共呼叫幾次？', opts: mkOpts(n + 1, [fibCalls(n), n, 2 * n]), ans: String(n + 1), why: 'fib(n) 到 fib(0) 每個值只會真的呼叫一次：n + 1 次 → O(n)。' };
    }
    if (t === 3) {
      const n = 4 + rnd(5), R = rodSteps(n, ROD_P), ans = R.r[n];
      return { q: 'Rod cutting，價目 p = 1 5 8 9 10 17 17 20（長度 1～8），長 ' + n + ' 的鐵條最多賣多少？', opts: mkOpts(ans, [ROD_P[n], ans - 1, ans + 2]), ans: String(ans), why: 'r[j] = max(p[i] + r[j−i])；r = ' + R.r.slice(1).join(' ') + '，r[' + n + '] = ' + ans + '。' };
    }
    if (t === 4) {
      const A = Array.from({ length: 7 }, () => 1 + rnd(20)), S = lisSteps(A), ans = Math.max(...S.L);
      return { q: 'A = ' + A.join(' ') + '，最長嚴格遞增子序列長度？', opts: mkOpts(ans, [ans + 1, ans - 1, S.L[A.length - 1]]), ans: String(ans), why: 'L[i] = 1 + max L[j]（j < i 且 A[j] < A[i]）；答案是 max L[i] = ' + ans + '，不是 L[n−1] = ' + S.L[A.length - 1] + '。' };
    }
    if (t === 5) {
      const P = [
        { q: 'Multistage graph（Abdul Bari 的 12 點圖）中 cost(2, 2) = ?', opts: ['7', '11', '8', '9'], ans: '7', why: 'min(c(2,6)+cost(6), c(2,7)+cost(7), c(2,8)+cost(8)) = min(4+7, 2+5, 1+7) = 7，d = 7。' },
        { q: 'Multistage graph 的 forward method 為什麼叫 forward？', opts: ['決策是從 source 往 sink 依 d 值做的', 'cost 表是從 source 開始填的', '只看往前的邊', '因為用 Dijkstra'], ans: '決策是從 source 往 sink 依 d 值做的', why: 'cost 由 sink 往回填，但用 d 值做決策是從 1 往前走：1→2→7→10→12。' },
        { q: 'MIT 五步驟中，DP 的總時間怎麼算？', opts: ['子問題數 × 每個子問題的時間', '子問題數 + 猜測數', '遞迴深度 × 分支數', '輸入大小的平方'], ans: '子問題數 × 每個子問題的時間', why: '遞迴呼叫都當 O(1)（memo 後只付一次），所以總時間 = #subproblems × time/subproblem。' },
        { q: 'Text justification 的 DP 子問題是什麼？', opts: ['suffix words[i:]', 'prefix words[:i]', '所有字的子集合', '每一行的長度'], ans: 'suffix words[i:]', why: '猜第二行從哪個字開始後，剩下的是 suffix；只有 n 個，子集合會有 2ⁿ 個。' },
        { q: 'Text justification：DP[i] = min_j (badness(i,j) + DP[j])，總時間？', opts: ['Θ(n²)', 'Θ(n)', 'Θ(2ⁿ)', 'Θ(n³)'], ans: 'Θ(n²)', why: 'n 個子問題，每個試 O(n) 個 j，每次 O(1)。' },
        { q: 'Memoization 與 tabulation 的差別？', opts: ['memo 是 top-down 遞迴，tabulation 是 bottom-up 迴圈', 'memo 比較快一個量級', 'tabulation 一定比較省空間', 'memo 不能用在 DP'], ans: 'memo 是 top-down 遞迴，tabulation 是 bottom-up 迴圈', why: '兩者時間通常一樣；memo 從原問題往下呼叫，tabulation 依拓樸順序由小填到大。' },
        { q: 'Perfect-information blackjack 的 DP 在猜什麼？', opts: ['這一局玩家要 hit 幾次', '莊家要 hit 幾次', '下一張牌是什麼', '要不要下注'], ans: '這一局玩家要 hit 幾次', why: '莊家策略固定（< 17 就拿），所以只需猜玩家 hit 幾次；子問題是牌堆的 suffix。' },
        { q: 'DP 適用的兩個要素是？', opts: ['optimal substructure + overlapping subproblems', 'greedy choice + optimal substructure', '子問題互不重疊 + 可平行', '輸入已排序 + 無負邊'], ans: 'optimal substructure + overlapping subproblems', why: '重疊才值得存表；divide & conquer 的子問題互不重疊。' },
      ];
      return P[rnd(P.length)];
    }
    if (t === 6) {
      const n = 4 + rnd(4);
      return { q: 'Rod cutting 用暴力法，長 ' + n + ' 的鐵條有幾種切法（每個整數位置切或不切）？', opts: mkOpts(2 ** (n - 1), [2 ** n, n * n, n]), ans: String(2 ** (n - 1)), why: 'n − 1 個切點各自切或不切：2ⁿ⁻¹ 種，所以要 DP。' };
    }
    const x = 1 + rnd(3), P = [8, 9, 10];
    return { q: '把 F[0..n] 用迴圈 F[i] = F[i−1] + F[i−2] 填到 n = ' + P[x - 1] + '，F[' + P[x - 1] + '] = ?', opts: mkOpts(fibV(P[x - 1]), [fibV(P[x - 1] - 1), fibV(P[x - 1] + 1), fibV(P[x - 1]) + 1]), ans: String(fibV(P[x - 1])), why: '0 1 1 2 3 5 8 13 21 34 55：F[' + P[x - 1] + '] = ' + fibV(P[x - 1]) + '。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = shuffle([...p.opts]);
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

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'greedy-vs-dp': { title: 'Greedy vs DP：固定規則 vs 試遍所有可能', play: scGreedyVsDP },
    'fib-tree': { title: 'fib(5) 遞迴樹：15 次呼叫、O(2ⁿ)', play: scFibTree },
    'fib-memo': { title: 'Memoization：F[] 先填 −1，只呼叫 n+1 次', play: scFibMemo },
    'fib-table': { title: 'Tabulation：迴圈 bottom-up 填 F[0..5]', play: scFibTable },
    'dp-elements': { title: '（課本）DP 兩要素：最佳子結構＋重疊子問題', play: scElements },
    'msg-graph': { title: 'Multistage graph 與 principle of optimality', play: scMsgGraph },
    'msg-cost-table': { title: 'Multistage graph：由 sink 往回填 cost 與 d', play: scMsgCostTable },
    'msg-formula': { title: 'cost(i,j) = min{c(j,l) + cost(i+1,l)}', play: scMsgFormula },
    'msg-path': { title: '跟著 d 往前決策：兩條成本 16 的路徑', play: scMsgPath },
    'dp-recipe': { title: 'DP = 猜測＋遞迴＋memo；時間 = 題數 × 每題', play: scRecipe },
    'dp-dag': { title: 'DP = DAG 最短路徑：Fibonacci 與 Bellman-Ford', play: scDag },
    'dp-five-steps': { title: 'DP 五步驟（Fibonacci／最短路徑對照）', play: scFiveSteps },
    'textjust-badness': { title: 'Text justification：badness 與 greedy 的問題', play: scTjBadness },
    'textjust-dp': { title: 'Text justification：DP[i] 由右往左填', play: scTjDP },
    'textjust-parent': { title: 'Parent pointers：還原斷行位置', play: scTjParent },
    'blackjack-rules': { title: 'Blackjack 規則：莊家 < 17 就拿', play: scBjRules },
    'blackjack-dp': { title: 'Perfect-information blackjack：BJ(i) 由後往前', play: scBjDP },
    'rod-cutting': { title: '（課本）Rod cutting：r[j] = max(p[i] + r[j−i])', play: scRod },
    'knapsack-table': { title: '（課本）0/1 Knapsack：V[i][w] 填表與回溯', play: scKnap },
    'lcs-table': { title: '（課本）LCS 填表：ABCBDAB vs BDCABA', play: scLcsTable },
    'lcs-trace': { title: '（課本）LCS 回溯：跟著箭頭得到 BCBA', play: scLcsTrace },
    'lis-n2': { title: '（課本）LIS 的 O(n²) DP', play: scLisN2 },
    'lis-nlogn': { title: '（課本）LIS 的 O(n log n)：tails + 二分搜尋', play: scLisNlogn },
  };

  return {
    kicker: '演算法・第 3 章',
    title: '動態規劃（基礎）',
    color: 'var(--alg)',
    modes: [
      { id: 'fib', name: 'Fibonacci 三種寫法', enter: enterFib },
      { id: 'msg', name: 'Multistage graph', enter: enterMsg },
      { id: 'knap', name: '0/1 Knapsack', enter: enterKnap },
      { id: 'lcs', name: 'LCS', enter: enterLcs },
      { id: 'rod', name: 'Rod cutting', enter: enterRod },
      { id: 'lis', name: 'LIS', enter: enterLis },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'greedy-vs-dp', 'fib-tree', 'fib-memo', 'fib-table', 'dp-elements',
      'msg-graph', 'msg-cost-table', 'msg-formula', 'msg-path',
      'dp-recipe', 'dp-dag', 'dp-five-steps', 'textjust-badness', 'textjust-dp', 'textjust-parent', 'blackjack-rules', 'blackjack-dp',
      'rod-cutting', 'knapsack-table', 'lcs-table', 'lcs-trace', 'lis-n2', 'lis-nlogn',
    ],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
