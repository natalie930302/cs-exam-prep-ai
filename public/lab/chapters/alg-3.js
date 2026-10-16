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
import kit from './_kit.js';

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
      ['5 原問題', 'Fₙ', 'δₖ(s,v)，k = V−1，每個 v'],
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
    for (const c of cands) { const s = String(c); if (Number(c) >= 0 && !o.includes(s)) o.push(s); if (o.length === 4) break; }
    let k = 1; while (o.length < 4) { const x = Number(ans) + k * (k % 2 ? 1 : -1) + (k > 2 ? 3 : 0), s = String(x); if (x >= 0 && !o.includes(s)) o.push(s); k++; }
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dpbari3.js ═══
  {
// ─── Abdul Bari：9iE9Mj4m8jk（4.1 多段圖，分段填表）、FcScLYJI42E（4.1.1 程式：8 頂點 4 stage → 9，1→2→6→8）、
//     nLmhmB6NzcM（4.5 0/1 knapsack：p = 1 2 5 6、w = 2 3 4 5、m = 8 → 8，表格法＋sets 法）、zRza99HPvkQ（4.5.1 程式 k[5][9]）、
//     XaXsJJh-Q5Y / Q4zHb-Swzro（4.7 TSP：c = [0 10 15 20; 5 0 9 10; 6 13 0 12; 8 8 9 0] → 35）、
//     sSno9rV8Rhg（4.9 LCS：cdgi、egi、bace/abce、bd vs abcd、stone vs longest → ONE） ───
// 5dRGRueKU3M（4 Principle of Optimality：greedy vs DP、fib 遞迴／memo／tabulation）用這裡的 cued 複本 dpbari3-gvd / dpbari3-fib-*。
// 全部場景都是 cued：每個 await step(tok) 等講者說到那一句；beat 只留動作本身（≤ 2.5 s）。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, step, buddy, prop, bob, travel, remove } = K;
const mono = (l) => { Object.assign(l.element.style, K.MONO); return l; };
const LT = '#f3d27a', LG = '#9fe0c4', DIM = '#ddd2bf';
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a little packet that flies from a to b (values being carried), then stays or vanishes
async function fling(tok, text, a, b, ms = 800, keep = false) {
  const p = tag(text, 'pkt', a.x, a.y, a.z);
  await travel(tok, p, a, b, ms);
  if (!keep) remove(p);
  return p;
}

// slide a group (buddy) sideways to x
async function slide(tok, o, x, ms = 600, y = o.position.y, z = o.position.z) { const a = o.position.clone(), b = V3(x, y, z); await K.anim(tok, ms, (u) => o.position.lerpVectors(a, b, u)); }

// ════════════════ 5dRGRueKU3M：Greedy vs DP、Fibonacci 三種寫法 ════════════════
FRAG.push(['dpbari3-gvd', 'Greedy vs DP：既定程序 vs 試遍所有可能', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.4, 0]);
  await step(tok);                                   // 0:00 topic: dynamic programming
  const G = buddy('Greedy', '', ORANGE, -5.4, 0, 1.6, 0.95), D = buddy('DP', '', TEAL, 5.4, 0, 1.6, 0.95);
  bub('今天的主角：Dynamic Programming（DP）', 0, 7.4);
  say('DP 入門', '先比較 greedy 與 DP，再比較 memoization 與 tabulation');
  await step(tok);                                   // 0:24 both used for optimization problems
  const goal = bub('最佳化問題', 0, 6.4);
  G.look(1); D.look(-1);
  await Promise.all([fling(tok, '我也解它', V3(-5.4, 1.6, 1.6), V3(-1.2, 6.0, 0), 900), fling(tok, '我也解它', V3(5.4, 1.6, 1.6), V3(1.2, 6.0, 0), 900)]);
  say('兩種方法都解最佳化問題', '策略不同，目的一樣');
  await step(tok);                                   // 0:35 min or max result
  note('要「最小」：最短、最便宜', -2.2, 5.5); note('要「最大」：最多利潤', 2.2, 5.5);
  say('最佳化問題：要最小值或最大值', '');
  await step(tok);                                   // 0:40 greedy: predefined procedure
  const P = { S: [-3.2, 3.2], A: [0, 4.6], B: [0, 1.6], T: [3.2, 3.2] };
  const E = [['S', 'A', 1], ['S', 'B', 4], ['A', 'T', 9], ['B', 'T', 2]];
  const nodes = {}, rods = {};
  for (const [k, [x, y]] of Object.entries(P)) nodes[k] = cube(k, k === 'S' || k === 'T' ? PURPLE : BLUE, [0.7, 0.55, 0.5], x, y, 0, 1.4);
  for (const [a, b, w] of E) { const A = V3(...P[a]), Bv = V3(...P[b]); A.z = Bv.z = -0.05; rods[a + b] = rod(A, Bv, SAND, 0.035); const m = A.clone().lerp(Bv, 0.5); tag(String(w), 'idx', m.x, m.y + 0.3, 0.1); }
  const rule = note('既定程序（已知會最好）', -5.4, 2.4, 1.6);
  G.mood('happy');
  say('Greedy：照一個事先定好的程序做', '這個程序已知能得到最佳結果');
  await step(tok);                                   // 0:52 Kruskal: always select minimum cost edge
  tint(rods.SA, ORANGE); glow(nodes.S, GOLD); glow(nodes.A, GOLD);
  const kr = bub('Kruskal：每次挑成本最小的邊', -4.6, 6.0);
  say('例：Kruskal 求最小生成樹', '永遠挑成本最小的邊');
  await step(tok);                                   // 1:05 Dijkstra: always select shortest vertex
  remove(kr); glow(nodes.A, null);
  const dj = bub('Dijkstra：每次挑最近的頂點，再 relax', -4.4, 6.0);
  const tk = tag('●', 'pkt', P.S[0], P.S[1] + 0.6, 0.4);
  await travel(tok, tk, V3(P.S[0], P.S[1] + 0.6, 0.4), V3(P.A[0], P.A[1] + 0.6, 0.4), 900);
  say('例：Dijkstra 最短路徑', '永遠挑目前最近的頂點，再繼續 relax');
  await step(tok);                                   // 1:17 DP: find all possible solutions
  remove(dj); remove(tk); tint(rods.SA, SAND); glow(nodes.S, null);
  D.mood('wow');
  const r1 = tag('S→A→T', 'pkt', P.S[0], P.S[1] + 0.6, 0.4);
  await travel(tok, r1, V3(P.S[0], P.S[1] + 0.6, 0.4), V3(P.A[0], P.A[1] + 0.6, 0.4), 600);
  await travel(tok, r1, V3(P.A[0], P.A[1] + 0.6, 0.4), V3(P.T[0], P.T[1] + 0.6, 0.4), 600);
  remove(r1);
  const t1 = note('S→A→T = 1 + 9 = 10', 5.0, 5.4);
  const r2 = tag('S→B→T', 'pkt', P.S[0], P.S[1] - 0.6, 0.4);
  await travel(tok, r2, V3(P.S[0], P.S[1] - 0.6, 0.4), V3(P.B[0], P.B[1] - 0.6, 0.4), 600);
  await travel(tok, r2, V3(P.B[0], P.B[1] - 0.6, 0.4), V3(P.T[0], P.T[1] - 0.6, 0.4), 600);
  remove(r2);
  const t2 = note('S→B→T = 4 + 2 = 6', 5.0, 4.7);
  say('DP：先找出所有可能的解', '每一種走法都算一遍');
  await step(tok);                                   // 1:22 then pick up the best solution
  tint(rods.SB, TEAL); tint(rods.BT, TEAL); tint(rods.SA, GRAY); tint(rods.AT, GRAY);
  t2.element.className = 'lab-label good'; glow(nodes.B, GREEN);
  D.mood('happy'); await D.hop(tok);
  say('再從裡面挑最好的', 'min(10, 6) = 6 → 選 S→B→T');
  await step(tok);                                   // 1:27 little time consuming
  bad('要試很多種：比較花時間', 5.4, 2.6, 1.6); good('照規則一路走：快', -5.4, 3.2, 1.6);
  D.mood('calm');
  say('DP 比 greedy 花時間', '因為可行解可能很多，全部都要試');
  await step(tok);                                   // 1:42 recursive formulas
  const f = bub('cost(S) = min( 1 + cost(A), 4 + cost(B) )', 0, 0.4, 1.4); mono(f);
  say('DP 問題多半寫成遞迴式', '一個大問題的答案 = 用小問題的答案組出來');
  await step(tok);                                   // 1:48 not recursion of programming but iteration
  note('寫程式時：多半用迴圈（iteration）', 0, -0.3, 1.4);
  say('式子是遞迴的，程式卻多半用迴圈寫', '想用遞迴也可以');
  await step(tok);                                   // 2:00 principle of optimality
  const d1 = tag('決策 ①：往 A 還是 B？', 'pkt', P.S[0] - 0.4, P.S[1] + 1.1, 0.4);
  const d2 = tag('決策 ②：下一步呢？', 'pkt', P.B[0] + 0.6, P.B[1] - 0.9, 0.4);
  say('Principle of optimality', '一連串的決策 → 得到最佳解');
  await step(tok);                                   // 2:12 greedy: decision taken one time
  G.mood('happy'); await G.hop(tok);
  bub('只決定一次：「就照這個程序做」', -4.4, 1.3, 1.6);
  say('Greedy：決定只做一次', '定好程序，之後照做');
  await step(tok);                                   // 2:19 DP: every stage we take a decision
  glow(nodes.S, GOLD); glow(nodes.B, GOLD); d1.element.className = 'lab-label good'; d2.element.className = 'lab-label good';
  D.mood('happy'); await D.hop(tok);
  say('DP：每個 stage 都做一次決策', '解題時就看得到它怎麼運作');
  await step(tok);                                   // 2:34 next: tabulation vs memoization
  glow(nodes.S, null); glow(nodes.B, null);
  bub('下一步：memoization vs tabulation', 0, 7.4, 0.6);
  say('接著看：memoization 與 tabulation', '用 Fibonacci 當例子');
}]);
// fib(5) 的 tracing tree：先序順序 5,3,1,2,0,1,4,2,0,1,3,1,2,0,1
function fibNode(T, t, par, color) {
  if (par) t.edge = rod(V3(par.x, par.y - 0.25, -0.05), V3(t.x, t.y + 0.25, -0.05), SAND, 0.022);
  t.m = cube('f(' + t.n + ')', color || DCOL[t.d % DCOL.length], [T.w, 0.5, 0.45], t.x, t.y, 0, 1.2);
  return t;
}
const fibPar = (T, t) => T.all.find((p) => p.kids.includes(t)) || null;
const fibDone = (t, v) => { t.v = v; relabel(t.m, t.n + '→' + v); tint(t.m, TEAL); };
FRAG.push(['dpbari3-fib-tree', 'fib(5) 遞迴：tracing tree、15 次呼叫、O(2ⁿ)', async (tok) => {
  fresh([0, 4.6, 15.5], [0, 3.7, 0]);
  const T = treeGeom(5), N = T.all;
  const draw = (...ix) => ix.forEach((i) => fibNode(T, N[i], fibPar(T, N[i])));
  await step(tok);                                   // 2:45 recursive definition of Fibonacci
  const cd = code(['fib(n):', '  if n <= 1: return n', '  return fib(n-2) + fib(n-1)'], -4.6, 7.7, 0.45);
  say('Fibonacci 的遞迴定義 → 遞迴函式', 'fib(n) = fib(n−2) + fib(n−1)');
  await step(tok);                                   // 2:59 starts from 0 and 1
  const seq = [0, 1, 1, 2, 3, 5, 8, 13].map((v, k) => { tag('第 ' + k + ' 項', 'idx', -4.2 + k * 1.2, 0.2); return cube(v, BLUE, [0.8, 0.6, 0.5], -4.2 + k * 1.2, 0.9, 0, 0.8 + k * 0.15); });
  say('數列從 0、1 開始', '0 1 1 2 3 5 8 13 …');
  await step(tok);                                   // 3:06 every term: add previous two
  for (const k of [3, 4, 5]) {
    glow(seq[k - 2], GOLD); glow(seq[k - 1], GOLD);
    await fling(tok, seq[k - 2].userData.lbl.element.textContent + '+' + seq[k - 1].userData.lbl.element.textContent, V3(-4.2 + (k - 1.5) * 1.2, 1.6, 0.4), V3(-4.2 + k * 1.2, 1.6, 0.4), 600);
    glow(seq[k - 2], null); glow(seq[k - 1], null); glow(seq[k], GREEN);
  }
  say('每一項 = 前兩項相加', '1 + 2 = 3、2 + 3 = 5、3 + 5 = 8');
  await step(tok);                                   // 3:24 want the 10th term: call the function
  seq.forEach((m) => glow(m, null));
  note('想要第 n 項 → 呼叫 fib(n)', 3.6, 7.6);
  say('想知道第 n 項，就呼叫這個函式', '它是怎麼算出來的？來追蹤');
  await step(tok);                                   // 3:40 trace fib(5)
  seq.forEach((m) => kill(m));
  draw(0); glow(N[0].m, GOLD);
  const cnt = tag('呼叫 1 次', 'ptr alt', 5.6, 7.6);
  say('追蹤 fib(5)', '');
  await step(tok);                                   // 3:48 n <= 1? no → call two functions
  cd.hl(1);
  bad('5 ≤ 1？不是', N[0].x + 1.6, N[0].y, 0.3);
  say('n ≤ 1 嗎？不是', '那就要呼叫兩次自己，再把結果相加');
  await step(tok);                                   // 4:01 calls fib(3) and fib(4)
  cd.hl(2); draw(1, 6); txt(cnt, '呼叫 3 次');
  say('它呼叫 fib(3) 和 fib(4)', '先做左邊的 fib(3)');
  await step(tok);                                   // 4:12 fib(3) → fib(1), fib(2)
  glow(N[0].m, null); glow(N[1].m, GOLD); draw(2, 3); txt(cnt, '呼叫 5 次');
  say('fib(3) 也不是 ≤ 1', '再呼叫 fib(1) 和 fib(2)');
  await step(tok);                                   // 4:30 fib(1) answer directly 1
  cd.hl(1); fibDone(N[2], 1);
  say('fib(1)：直接得到答案 1', '沒有再呼叫');
  await step(tok);                                   // 4:35 fib(2) → fib(0), fib(1)
  draw(4, 5); txt(cnt, '呼叫 7 次'); fibDone(N[4], 0); fibDone(N[5], 1);
  say('fib(2) 呼叫 fib(0)、fib(1)', '這兩個直接回傳結果');
  await step(tok);                                   // 4:51 add these two and give the result
  cd.hl(2); fibDone(N[3], 1); fibDone(N[1], 2); glow(N[1].m, null);
  say('相加後往上回傳', 'fib(2) = 0 + 1 = 1、fib(3) = 1 + 1 = 2');
  await step(tok);                                   // 4:55 fib(4) → fib(2), fib(3)
  glow(N[6].m, GOLD); draw(7, 10); txt(cnt, '呼叫 9 次');
  say('右邊：fib(4) 呼叫 fib(2)、fib(3)', '');
  await step(tok);                                   // 5:05 fib(0), fib(1) ... this side fib(1), fib(2) ...
  glow(N[6].m, null);
  draw(8, 9); await beat(tok, 500); draw(11, 12); await beat(tok, 500); draw(13, 14);
  txt(cnt, '呼叫 15 次');
  [7, 8, 9, 10, 11, 12, 13, 14].forEach((i) => fibDone(N[i], fibV(N[i].n)));
  fibDone(N[6], 3); fibDone(N[0], 5);
  say('一路展開到 fib(0)、fib(1)', '這就是 fib(5) 的 tracing tree');
  await step(tok);                                   // 5:32 total 15 calls
  cnt.element.className = 'lab-label bad';
  say('fib(5) 一共呼叫 15 次', '');
  await step(tok);                                   // 5:39 n−2 and n−1; assume n−1
  bub('fib(n−2) ≈ fib(n−1)：先當成一樣大', -4.4, 0.4, 1.2);
  say('時間複雜度：一次呼叫 n−2、一次 n−1', '粗略地把 n−2 也當成 n−1');
  await step(tok);                                   // 5:49 recurrence T(n) = 2T(n−1) + 1
  const rec = note('T(n) = 2T(n−1) + 1', 3.6, 0.4, 1.2); mono(rec);
  say('遞迴關係：T(n) = 2T(n−1) + 1', '呼叫自己兩次，每次只做一個加法');
  await step(tok);                                   // 6:14 master theorem → O(2ⁿ)
  rec.element.textContent = 'T(n) = 2T(n−1) + 1 → O(2ⁿ)';
  say('用 decreasing function 的 master theorem', '得到 O(2ⁿ)：指數時間');
  await step(tok);                                   // 6:26 upper bound
  bub('n−2 比 n−1 小 → 這是上界', 3.6, -0.4, 1.2);
  say('實際是 n−2，比較小', '所以 O(2ⁿ) 是上界');
  await step(tok);                                   // 6:50 fib(1) called so many times
  N.forEach((t) => glow(t.m, t.n === 1 ? GOLD : null));
  say('有沒有辦法省時間？看 fib(1)', 'fib(1) 被呼叫了 ' + N.filter((t) => t.n === 1).length + ' 次');
  await step(tok);                                   // 7:03 fib(2) called here and here and here
  N.forEach((t) => glow(t.m, t.n === 2 ? GOLD : null));
  say('fib(2) 也被呼叫 ' + N.filter((t) => t.n === 2).length + ' 次', '同樣的參數，一再重算');
  await step(tok);                                   // 7:16 reduce the function calls
  N.forEach((t) => glow(t.m, null));
  good('算過就記下來 → 少呼叫', 0, 0.4, 1.6);
  say('想法：同一個參數不要再呼叫', '把結果存起來，減少呼叫次數');
}]);
FRAG.push(['dpbari3-fib-memo', 'Memoization：F[] 先填 −1，只呼叫 n+1 次', async (tok) => {
  fresh([0, 5.2, 15.5], [0, 3.4, 0]);
  const T = treeGeom(5), N = T.all;
  // ghost of the whole tree
  N.forEach((t) => { t.m = lab.box(GRAY, [T.w, 0.5, 0.45]); t.m.position.set(t.x, t.y, 0); t.m.material.transparent = true; t.m.material.opacity = 0.22; lab.world.add(t.m); });
  N.forEach((t) => t.kids.forEach((k) => { k.edge = rod(V3(t.x, t.y - 0.25, -0.05), V3(k.x, k.y + 0.25, -0.05), GRAY, 0.018); }));
  const fx = (k) => (k - 2.5) * 1.15;
  const lit = (t) => { t.m.material.opacity = 1; t.m.material.transparent = false; tint(t.m, DCOL[t.d % DCOL.length]); if (t.edge) tint(t.edge, SAND); t.m.userData.lbl = lab.label('f(' + t.n + ')', 'val'); t.m.add(t.m.userData.lbl); };
  const skip = (t) => { t.m.material.opacity = 0.5; tint(t.m, GRAY); };
  let calls = 0, cells = [], cnt;
  const call = (i) => { lit(N[i]); glow(N[i].m, GOLD); calls++; txt(cnt, '呼叫 ' + calls + ' 次'); };
  const store = async (i, v) => { glow(N[i].m, null); fibDone(N[i], v); await fling(tok, String(v), V3(N[i].x, N[i].y + 0.4, 0.4), V3(fx(N[i].n), 0.9, 1.9), 700); relabel(cells[N[i].n], v); tint(cells[N[i].n], TEAL); glow(cells[N[i].n], GREEN); };
  const known = (i) => { skip(N[i]); N[i].m.userData.lbl = lab.label('F[' + N[i].n + ']', 'val'); N[i].m.add(N[i].m.userData.lbl); glow(cells[N[i].n], GOLD); };
  cnt = tag('呼叫 0 次', 'ptr alt', 5.6, 7.6);
  await step(tok);                                   // 7:21 store the result of fib
  const M = buddy('記事本', '', '#f3d27a', -6.4, 0, 2.0, 0.8);
  say('把 fib 的結果存起來', 'fib(2) 算過一次，就不要再呼叫');
  await step(tok);                                   // 7:36 one global array 0..5
  for (let k = 0; k <= 5; k++) { tag('F[' + k + ']', 'idx', fx(k), 0, 2.75); cells.push(cube('', GRAY, [0.95, 0.5, 0.8], fx(k), 0.27, 1.9, 0.8 + k * 0.1)); }
  tag('全域陣列 F', 'ptr', fx(0) - 1.6, 0.4, 1.9);
  say('準備一個全域陣列 F[0..5]', '');
  await step(tok);                                   // 7:47 fill with −1: nothing is known
  cells.forEach((c) => { c.userData.lbl || (c.userData.lbl = lab.label('-1', 'val'), c.add(c.userData.lbl)); relabel(c, '−1'); });
  M.mood('wow');
  say('一開始全部填 −1', '−1 = 還不知道答案');
  await step(tok);                                   // 7:56 fib(5): −1, make the call
  call(0); glow(cells[5], GOLD);
  say('呼叫 fib(5)：F[5] = −1，不知道', '只好真的呼叫');
  await step(tok);                                   // 8:03 fib(3): −1, call
  glow(cells[5], null); call(1); glow(cells[3], GOLD);
  say('fib(3)：F[3] = −1', '呼叫');
  await step(tok);                                   // 8:09 fib(1): don't know, call
  glow(cells[3], null); call(2); glow(cells[1], GOLD);
  say('fib(1)：F[1] = −1', '呼叫');
  await step(tok);                                   // 8:17 fib(1) returns 1 → mark it
  await store(2, 1);
  M.mood('happy');
  say('fib(1) = 1，記進 F[1]', '');
  await step(tok);                                   // 8:25 fib(2): don't know, call
  glow(cells[1], null); call(3); glow(cells[2], GOLD);
  say('回到 fib(3)，接著 fib(2)：不知道', '呼叫');
  await step(tok);                                   // 8:29 fib(0): call, returns 0
  glow(cells[2], null); call(4);
  await beat(tok, 400);
  await store(4, 0);
  say('fib(0)：也不知道 → 呼叫', '回傳 0，記進 F[0]');
  await step(tok);                                   // 8:43 fib(1): already known, don't call
  glow(cells[0], null); known(5);
  say('fib(1)：F[1] = 1 已經知道', '不呼叫，直接拿來用');
  await step(tok);                                   // 8:49 add → fib(2) = 1
  glow(cells[1], null);
  await store(3, 1);
  say('0 + 1 = 1', 'fib(2) = 1，記進 F[2]');
  await step(tok);                                   // 8:58 fib(3) = 1 + 1 = 2
  glow(cells[2], null);
  await store(1, 2);
  say('1 + 1 = 2', 'fib(3) = 2，記進 F[3]');
  await step(tok);                                   // 9:09 fib(4): don't know, call
  glow(cells[3], null); call(6); glow(cells[4], GOLD);
  say('右邊的 fib(4)：不知道', '呼叫');
  await step(tok);                                   // 9:16 fib(2): already know, don't call
  glow(cells[4], null); known(7);
  [8, 9].forEach((i) => { N[i].m.material.opacity = 0.08; });
  say('fib(2)：F[2] 已經有了', '不呼叫 → 底下整串也都不會呼叫');
  await step(tok);                                   // 9:24 fib(3): we know, don't call
  glow(cells[2], null); known(10);
  [11, 12, 13, 14].forEach((i) => { N[i].m.material.opacity = 0.08; });
  say('fib(3)：也已經知道', '它底下的呼叫全部省掉');
  await step(tok);                                   // 9:35 1 + 2 = 3
  glow(cells[3], null);
  await store(6, 3);
  say('1 + 2 = 3', 'fib(4) = 3，記進 F[4]');
  await step(tok);                                   // 9:46 2 + 3 = 5
  glow(cells[4], null);
  await store(0, 5);
  M.mood('happy'); await M.hop(tok);
  say('2 + 3 = 5', 'fib(5) = 5');
  await step(tok);                                   // 9:54 count the calls: 1..6
  glow(cells[5], null);
  [0, 1, 2, 3, 4, 6].forEach((i) => glow(N[i].m, GOLD));
  cnt.element.className = 'lab-label good';
  say('數一數真的呼叫了幾次', '只有 6 次');
  await step(tok);                                   // 10:03 n + 1 calls → O(n)
  [0, 1, 2, 3, 4, 6].forEach((i) => glow(N[i].m, null));
  note('fib(n)：n + 1 次呼叫 → O(n)', 0, 8.3);
  say('fib(n) 只要 n + 1 次呼叫', '時間是 O(n)');
  await step(tok);                                   // 10:24 this is memoization
  bub('Memoization：把函式結果存起來，避免同樣的呼叫', 0, -0.9, 2.2);
  say('這就是 memoization', '存下結果，同樣的呼叫不再做');
  await step(tok);                                   // 10:58 2ⁿ → n
  say('時間從 O(2ⁿ) 降到 O(n)', '指數 → 線性；別的題目至少也會快一些');
  await step(tok);                                   // 11:28 top-down approach
  await fling(tok, '從 fib(5) 往下', V3(N[0].x + 1.8, N[0].y + 0.2, 0.4), V3(N[0].x + 1.8, N[0].y - 3.0, 0.4), 1000, true);
  say('從 fib(5) 開始往下呼叫', 'memoization 是 top-down approach');
}]);
FRAG.push(['dpbari3-fib-table', 'Tabulation：迴圈 bottom-up 填 F[0..5]', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.8, 0]);
  const n = 5, cw = 10 / 6;
  const g = grid({ rows: 1, cols: 6, cw: 1.25, ch: 0.9, x0: -1.25 * 2.5, y0: 3.0, colHdr: Array.from({ length: 6 }, (_, k) => 'F[' + k + ']') });
  let cd;
  await step(tok);                                   // 11:50 iterative function using loop
  cd = code(['fib(n):', '  if n <= 1: return n', '  F[0] = 0; F[1] = 1', '  for i = 2 to n:', '    F[i] = F[i-2] + F[i-1]', '  return F[n]'], 0, 8.0, 0.6);
  say('Tabulation：用迴圈寫的同一個函式', '不呼叫自己');
  await step(tok);                                   // 11:59 same formula n−2 and n−1
  cd.hl(4);
  say('公式一樣：前兩項相加', 'F[i] = F[i−2] + F[i−1]');
  await step(tok);                                   // 12:16 fib(5): n <= 1? return directly
  cd.hl(1);
  const me = buddy('i', '', ORANGE, -4.9, 0, 2.0, 0.7);
  say('求 fib(5)：n ≤ 1 就直接回傳', '5 不是，往下做');
  await step(tok);                                   // 12:20 F[0] = 0
  cd.hl(2); g.set(0, 0, 0, TEAL);
  say('F[0] = 0', '');
  await step(tok);                                   // 12:26 F[1] = 1
  g.set(0, 1, 1, TEAL);
  say('F[1] = 1', '最小的兩格先填好');
  await step(tok);                                   // 12:35 loop from i = 2 to n
  cd.hl(3); me.set(2); await slide(tok, me.g, g.pos(0, 2).x);
  say('迴圈：i 從 2 跑到 n = 5', '');
  const fill = async (i, v) => { cd.hl(4); me.set(i); await slide(tok, me.g, g.pos(0, i).x, 400); await playStep(g, { r: 0, c: i, v, deps: [{ r: 0, c: i - 2, arc: true, best: true }, { r: 0, c: i - 1, arc: true, best: true }] }, tok, 900, true); };
  await step(tok);                                   // 12:48 add previous two: F[2] = 1
  await fill(2, 1);
  say('第 i 項 = 前兩項相加', 'F[2] = F[0] + F[1] = 0 + 1 = 1');
  await step(tok);                                   // 12:59 i++ add these two, i++ ...
  await fill(3, 2); await fill(4, 3);
  say('i++，再加前兩格', 'F[3] = 1 + 1 = 2、F[4] = 1 + 2 = 3');
  await step(tok);                                   // 13:08 returns F[5] = 5
  await fill(5, 5); g.clearArrows(); g.unglow(); cd.hl(5); glow(g.get(0, 5), GREEN);
  me.mood('happy');
  say('最後回傳 F[5] = 5', '');
  await step(tok);                                   // 13:15 this is how the table is generated
  bub('DP 的寫法：用迴圈把表填滿', 0, 1.2, 1.4);
  say('DP 演算法多半這樣寫', '迭代的函式把表一格一格填滿');
  await step(tok);                                   // 13:27 filling starts from smaller values
  await fling(tok, '由小往大 →', V3(g.pos(0, 0).x, 4.2, 0.4), V3(g.pos(0, 5).x, 4.2, 0.4), 1200, true);
  say('從最小的值開始填', '要 F[5]，就從 F[0] 一路往上');
  await step(tok);                                   // 13:40 recursion started from 5: top-down
  bad('遞迴：從 fib(5) 往下 → top-down', -2.4, 0.2, 1.4);
  say('遞迴是從 fib(5) 開始、往下呼叫', '再一路回來：top-down');
  await step(tok);                                   // 13:57 this is bottom-up
  good('迴圈：從 F[0] 往上 → bottom-up', 2.6, 0.2, 1.4);
  me.mood('happy'); await me.hop(tok);
  say('tabulation 是 bottom-up approach', '');
  await step(tok);                                   // 14:02 mostly tabulation is used
  say('兩種都能用，DP 大多用 tabulation', '');
  await step(tok);                                   // 14:20 important thing: get the approach
  say('最重要的是抓到解題的策略', '懂了策略，就能自己設計 DP 解法');
}]);

// ════════════════ 9iE9Mj4m8jk：多段圖（12 頂點）分段填表 ════════════════
const outE = (v) => MSG.E.filter((e) => e[0] === v);
const msgW = (a, b) => MSG.E.find((e) => e[0] === a && e[1] === b)[2];
function msgBase(pre, drop) {
  fresh([0, 4.4, 15.5], [0, 3.8, 0]);
  const G = buildMSG(true, drop);
  pre.forEach((v) => msgFill(G, v));
  return G;
}
// fill only the cost (and the node), or only d
function msgCost(G, v) { const c = MS.cost[v]; G.g.set(0, v - 1, c, TEAL, 1); txt(G.costL[v], 'cost ' + c); showL(G.costL[v], true); tint(G.node[v], TEAL); }
function msgD(G, v) { G.g.set(1, v - 1, v === 12 ? '—' : MS.d[v].join('/'), PURPLE, 1); }
const hiOut = (G, v, c = ORANGE) => outE(v).forEach(([, l]) => { tint(edgeOf(G, v, l), c); glow(G.node[l], c === SAND ? null : GOLD); });
const pickOut = (G, v) => outE(v).forEach(([, l, w]) => { tint(edgeOf(G, v, l), w + MS.cost[l] === MS.cost[v] ? TEAL : GRAY); glow(G.node[l], null); });
const cellXY = (G, v) => { const p = G.g.pos(0, v - 1); return V3(p.x, p.y + 0.3, 0.6); };
const nodeXY = (v, dy = 0.45) => V3(MSG.pos[v][0], MSG.pos[v][1] + dy, 0.5);
// a formula line on top of the stage
const msgF = (t) => mono(tag(t, 'say', 0, 8.05));
// a traveller who walks the graph
function walker(v, name = '我', color = ORANGE) { return buddy(name, '', color, MSG.pos[v][0], MSG.pos[v][1] + 0.3, 0.6, 0.42); }
const walkTo = (tok, w, v, ms = 800) => slide(tok, w.g, MSG.pos[v][0], ms, MSG.pos[v][1] + 0.3, 0.6);
FRAG.push(['dpbari3-msg-graph', '多段圖是什麼、為什麼能用 DP', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  await step(tok);                                   // 0:01 multistage graph, solved by DP
  const G = buildMSG(false, true);
  say('多段圖（multistage graph）', '可以用 DP 解');
  await step(tok);                                   // 0:11 what is the problem / why DP / forward method
  const ag = [note('① 問題是什麼', -4.6, 8.0), note('② 為什麼能用 DP', 0, 8.0), note('③ 用 forward method 解', 4.6, 8.0)];
  say('這支影片三件事', '問題 → 能不能用 DP → 怎麼解');
  await step(tok);                                   // 0:23 directed weighted graph
  ag.forEach(remove);
  Object.values(G.edge).forEach((e) => tint(e, ORANGE));
  say('多段圖：有向、有權重的圖', '邊上的數字 = 走這條邊的成本');
  await step(tok);                                   // 0:30 vertices divided into stages; edges to next stage only
  Object.values(G.edge).forEach((e) => tint(e, GRAY));
  for (let s = 1; s <= 4; s++) {
    MSG.E.filter((e) => MSG.stage[e[0]] === s).forEach((e) => tint(edgeOf(G, e[0], e[1]), ORANGE));
    await beat(tok, 450);
    MSG.E.filter((e) => MSG.stage[e[0]] === s).forEach((e) => tint(edgeOf(G, e[0], e[1]), SAND));
  }
  say('頂點分成 stage（階段）', '邊只會從一個 stage 連到下一個 stage');
  await step(tok);                                   // 0:38 first & last stage: single vertex, source / sink
  glow(G.node[1], GOLD); glow(G.node[12], GOLD);
  good('source 起點', -6, 3.6, 0.5); good('sink 終點', 6, 3.6, 0.5);
  say('第一個、最後一個 stage 只有一個頂點', '起點 source、終點 sink');
  await step(tok);                                   // 0:47 resource allocation
  bub('常用來表示「資源分配」', 0, 1.2, 0.5);
  say('多段圖常用來表示資源分配', '');
  await step(tok);                                   // 0:54 various paths; find the minimum cost path
  const me = walker(1);
  for (const v of [2, 6, 9, 12]) await walkTo(tok, me, v, 450);
  await walkTo(tok, me, 1, 400);
  say('從 source 到 sink 有很多條路', '要找成本最小的那一條');
  await step(tok);                                   // 1:04 minimization = optimization problem
  bub('最小化問題 = 最佳化問題', 0, 0.5, 0.5);
  say('所以是最小化問題', '也就是最佳化問題 → 試試 DP');
  await step(tok);                                   // 1:15 principle of optimality: sequence of decisions
  glow(G.node[1], null); glow(G.node[12], null);
  say('DP 靠 principle of optimality', '問題要能用「一連串的決策」來解');
  await step(tok);                                   // 1:24 at stage 2 select one vertex, e.g. 5
  hiOut(G, 1);
  await beat(tok, 500);
  hiOut(G, 1, SAND); tint(edgeOf(G, 1, 5), TEAL);
  await walkTo(tok, me, 5);
  me.mood('happy');
  say('在 stage 2 選一個頂點：例如 5', '選的時候要確定它能帶來最佳結果');
  await step(tok);                                   // 1:44 from 5: go to 8 or 7 — decide
  hiOut(G, 5);
  await beat(tok, 500);
  hiOut(G, 5, SAND); tint(edgeOf(G, 5, 7), TEAL);
  await walkTo(tok, me, 7);
  say('從 5 可以去 7 或 8', '又要決定一次');
  await step(tok);                                   // 1:48 next decide and select again
  tint(edgeOf(G, 7, 10), TEAL); await walkTo(tok, me, 10, 600);
  tint(edgeOf(G, 10, 12), TEAL); await walkTo(tok, me, 12, 600);
  say('下一個 stage 再決定，再下一個也是', '');
  await step(tok);                                   // 1:53 every stage a decision → principle holds
  me.mood('happy'); await me.hop(tok);
  good('每個 stage 都做一次決策 ✓', 0, 0.5, 1.2);
  say('每個 stage 都能做決策', 'principle of optimality 成立 → 可以用 DP');
}]);
FRAG.push(['dpbari3-msg-s4', '多段圖：sink 與 stage 4 的 cost', async (tok) => {
  fresh([0, 4.4, 15.5], [0, 3.8, 0]);
  const G = buildMSG(false, false);
  await step(tok);                                   // 2:00 tabulation method: fill the table
  G.g = grid({ rows: 2, cols: 12, cw: 0.95, ch: 0.55, x0: -5.25, y0: 1.25, colHdr: Array.from({ length: 12 }, (_, k) => k + 1), rowHdr: ['cost', 'd'], rowDx: 0.55 });
  say('用 tabulation：把資料填進表', '每個頂點一格');
  await step(tok);                                   // 2:03 for each vertex find the cost
  bub('cost = 從這個頂點走到 sink 的最小成本', 0, 8.05);
  say('每個頂點都要算 cost', '');
  await step(tok);                                   // 2:08 start from here: edges go that side
  await fling(tok, '← 從 sink 這邊開始', V3(6, 7.4, 0.5), V3(-3, 7.4, 0.5), 1500);
  say('從 sink 那一邊開始算', '邊都往 sink 走：要算一個點，就看它到 sink 的所有路');
  await step(tok);                                   // 2:29 sink: cost zero
  glow(G.node[12], GOLD); msgCost(G, 12); msgD(G, 12);
  say('sink 自己：cost = 0', '已經到終點了');
  await step(tok);                                   // 2:42 write cost(5, 12) = 0
  const f = msgF('cost( 5 , 12 ) = 0      ← ( stage , 頂點 )');
  say('寫成 cost(5, 12) = 0', '前面是 stage 編號，後面是頂點編號');
  await step(tok);                                   // 3:09 cost(4, 9) = 4
  glow(G.node[12], null); remove(f);
  glow(G.node[9], GOLD); tint(edgeOf(G, 9, 12), ORANGE);
  await fling(tok, '4', nodeXY(9), cellXY(G, 9), 700);
  msgCost(G, 9);
  say('stage 4：cost(4, 9) = 4', '只有一條邊到 sink');
  await step(tok);                                   // 3:30 cost(4, 10) = 2
  glow(G.node[9], null); glow(G.node[10], GOLD); tint(edgeOf(G, 10, 12), ORANGE);
  await fling(tok, '2', nodeXY(10), cellXY(G, 10), 700);
  msgCost(G, 10);
  say('cost(4, 10) = 2', '');
  await step(tok);                                   // 3:41 cost(4, 11) = 5
  glow(G.node[10], null); glow(G.node[11], GOLD); tint(edgeOf(G, 11, 12), ORANGE);
  await fling(tok, '5', nodeXY(11), cellXY(G, 11), 700);
  msgCost(G, 11);
  say('cost(4, 11) = 5', '');
  await step(tok);                                   // 3:51 they all reach 12 → d = 12
  glow(G.node[11], null);
  [9, 10, 11].forEach((v) => { msgD(G, v); G.g.mark(1, v - 1, LT); });
  say('9、10、11 下一步都到 12', '表的 d 列寫 12（d 的意思等一下說）');
}]);
FRAG.push(['dpbari3-msg-s3', '多段圖：stage 3 與重疊子問題', async (tok) => {
  const G = msgBase([12, 9, 10, 11]);
  let f;
  await step(tok);                                   // 4:08 third stage: 6, 7, 8
  [6, 7, 8].forEach((v) => glow(G.node[v], GOLD));
  say('stage 3：頂點 6、7、8', '一個一個算');
  await step(tok);                                   // 4:15 cost(3,6): two edges 6→9, 6→10
  [7, 8].forEach((v) => glow(G.node[v], null)); hiOut(G, 6);
  say('cost(3, 6)：有兩條邊出去', '6→9 和 6→10，該選哪條？');
  await step(tok);                                   // 4:33 select minimum: consider both
  f = msgF('cost(3,6) = min{ c(6,9) + cost(4,9) , c(6,10) + cost(4,10) }');
  say('兩條都算，再取最小', '邊的成本 + 下一個點的 cost');
  await step(tok);                                   // 5:13 c = edge weight, cost = vertex cost
  note('小寫 c：邊的權重', -4.6, 0.0, 0.6); note('cost：頂點到 sink 的成本', 3.4, 0.0, 0.6);
  say('c 是一條邊的權重', 'cost 是一個頂點到 sink 的成本');
  await step(tok);                                   // 5:23 min(6 + 4, 5 + 2)
  await Promise.all([fling(tok, '4', cellXY(G, 9), V3(-1.2, 7.6, 0.6), 800), fling(tok, '2', cellXY(G, 10), V3(2.6, 7.6, 0.6), 800)]);
  txt(f, 'cost(3,6) = min{ 6 + 4 , 5 + 2 }');
  say('代入數字', 'min(6 + 4, 5 + 2)');
  await step(tok);                                   // 5:47 vertex 10 gives smaller: 7
  txt(f, 'cost(3,6) = min{ 10 , 7 } = 7');
  pickOut(G, 6); msgCost(G, 6); glow(G.node[6], null);
  say('10 和 7 取小：cost(3, 6) = 7', '是經過頂點 10 得到的');
  await step(tok);                                   // 6:07 write that vertex in d
  msgD(G, 6); G.g.mark(1, 5, LT);
  say('d 寫下「給出最小值的頂點」', 'd(3, 6) = 10');
  await step(tok);                                   // 6:12 cost(3,7): two edges out
  hiOut(G, 7); glow(G.node[7], GOLD);
  say('cost(3, 7)：也有兩條邊', '要知道 9 和 10 的 cost，再加上邊的成本');
  await step(tok);                                   // 6:34 formula for 7
  txt(f, 'cost(3,7) = min{ c(7,9) + cost(4,9) , c(7,10) + cost(4,10) }');
  say('同樣的寫法', '兩項取最小');
  await step(tok);                                   // 7:01 4 + cost of 9 from the table
  await fling(tok, '4', cellXY(G, 9), V3(-1.2, 7.6, 0.6), 800);
  txt(f, 'cost(3,7) = min{ 4 + 4 , c(7,10) + cost(4,10) }');
  say('c(7, 9) = 4，cost(4, 9) 直接查表', '');
  await step(tok);                                   // 7:09 the value of 9 was useful for 6 and for 7: overlapping
  glow(G.node[9], GOLD); glow(G.g.get(0, 8), GOLD);
  tint(edgeOf(G, 6, 9), PINK); tint(edgeOf(G, 7, 9), PINK);
  const ov = good('cost(4,9) 算一次，6 用、7 也用', 3.4, 7.0, 0.8);
  say('9 的 cost 早就算好：6 用過、7 又用', '這就是 overlapping subproblems（重疊子問題）');
  await step(tok);                                   // 7:24 3 + cost(10) = 2 → min 5
  remove(ov); glow(G.g.get(0, 8), null); tint(edgeOf(G, 6, 9), GRAY); hiOut(G, 7);
  await fling(tok, '2', cellXY(G, 10), V3(2.6, 7.6, 0.6), 800);
  txt(f, 'cost(3,7) = min{ 4 + 4 , 3 + 2 } = min{ 8 , 5 } = 5');
  pickOut(G, 7); msgCost(G, 7); glow(G.node[7], null);
  say('min(4 + 4, 3 + 2) = 5', 'cost(3, 7) = 5');
  await step(tok);                                   // 7:46 due to vertex 10 → d = 10
  msgD(G, 7); G.g.mark(1, 6, LT);
  say('是頂點 10 給的 → d(3, 7) = 10', 'd 記的就是「最短的那條往哪走」');
  await step(tok);                                   // 7:52 cost of 8: edges to 10 and 11
  hiOut(G, 8); glow(G.node[8], GOLD);
  txt(f, 'cost(3,8) = min{ c(8,10) + cost(4,10) , c(8,11) + cost(4,11) }');
  say('cost(3, 8)：邊到 10 和 11', '');
  await step(tok);                                   // 8:22 replace: 5 + 2, 6 + 5
  await Promise.all([fling(tok, '2', cellXY(G, 10), V3(-1.2, 7.6, 0.6), 800), fling(tok, '5', cellXY(G, 11), V3(2.6, 7.6, 0.6), 800)]);
  txt(f, 'cost(3,8) = min{ 5 + 2 , 6 + 5 } = min{ 7 , 11 } = 7');
  say('min(5 + 2, 6 + 5)', '= min(7, 11) = 7');
  await step(tok);                                   // 8:50 7, given by vertex 10
  pickOut(G, 8); msgCost(G, 8); msgD(G, 8); G.g.mark(1, 7, LT); glow(G.node[8], null);
  say('cost(3, 8) = 7，d = 10', 'stage 3 全部算完');
}]);
FRAG.push(['dpbari3-msg-s2', '多段圖：stage 2 的 cost', async (tok) => {
  const G = msgBase([12, 9, 10, 11, 6, 7, 8]);
  let f;
  await step(tok);                                   // 9:04 cost of vertex 2: three edges to 6, 7, 8
  glow(G.node[2], GOLD); hiOut(G, 2);
  say('stage 2：頂點 2', '有三條邊：到 6、7、8');
  await step(tok);                                   // 9:16 formula with three terms
  f = msgF('cost(2,2) = min{ c(2,6)+cost(3,6) , c(2,7)+cost(3,7) , c(2,8)+cost(3,8) }');
  say('三條邊，三項取最小', '每項都是「邊 + 下一個點的 cost」');
  await step(tok);                                   // 9:47 4 + 7, 2 + 5, 1 + 7
  await Promise.all([6, 7, 8].map((v, k) => fling(tok, String(MS.cost[v]), cellXY(G, v), V3(-3 + k * 3, 7.6, 0.6), 800)));
  txt(f, 'cost(2,2) = min{ 4 + 7 , 2 + 5 , 1 + 7 }');
  say('代入：4 + 7、2 + 5、1 + 7', 'cost(3, 6)、cost(3, 7)、cost(3, 8) 都在表上');
  await step(tok);                                   // 10:15 11, 7, 8 → 7 is smaller
  txt(f, 'cost(2,2) = min{ 11 , 7 , 8 } = 7');
  pickOut(G, 2); msgCost(G, 2);
  say('11、7、8 → 最小是 7', 'cost(2, 2) = 7');
  await step(tok);                                   // 10:28 vertex 7 gave the minimum → d = 7
  msgD(G, 2); G.g.mark(1, 1, LT); glow(G.node[2], null);
  say('是頂點 7 給的', 'd(2, 2) = 7');
  await step(tok);                                   // 10:44 cost(2,4): only one edge → 11 + 7
  glow(G.node[4], GOLD); hiOut(G, 4);
  await fling(tok, '7', cellXY(G, 8), V3(0, 7.6, 0.6), 800);
  txt(f, 'cost(2,4) = c(4,8) + cost(3,8) = 11 + 7');
  say('頂點 4 只有一條邊到 8', '11 + cost(3, 8) = 11 + 7');
  await step(tok);                                   // 11:07 18, given by 8
  txt(f, 'cost(2,4) = 18');
  pickOut(G, 4); msgCost(G, 4); msgD(G, 4); G.g.mark(1, 3, LT); glow(G.node[4], null);
  say('cost(2, 4) = 18，d = 8', '只有一個選擇，它就是最小');
  await step(tok);                                   // 11:19 cost(2,5): edges to 7 and 8
  glow(G.node[5], GOLD); hiOut(G, 5);
  txt(f, 'cost(2,5) = min{ c(5,7)+cost(3,7) , c(5,8)+cost(3,8) }');
  say('頂點 5：兩條邊到 7、8', '');
  await step(tok);                                   // 11:45 min(11 + 5, 8 + 7)
  await Promise.all([fling(tok, '5', cellXY(G, 7), V3(-1.2, 7.6, 0.6), 800), fling(tok, '7', cellXY(G, 8), V3(2.6, 7.6, 0.6), 800)]);
  txt(f, 'cost(2,5) = min{ 11 + 5 , 8 + 7 }');
  say('min(11 + 5, 8 + 7)', '');
  await step(tok);                                   // 12:07 16 and 15 → 15, by 8
  txt(f, 'cost(2,5) = min{ 16 , 15 } = 15');
  pickOut(G, 5); msgCost(G, 5); msgD(G, 5); G.g.mark(1, 4, LT); glow(G.node[5], null);
  say('16、15 → 15，由頂點 8 給出', 'cost(2, 5) = 15，d = 8');
  await step(tok);                                   // 12:21 almost filled; one value remaining
  remove(f); msgFill(G, 3); G.g.mark(1, 2, LT);
  note('頂點 3（影片沒逐項算）：min(2 + 7, 7 + 5) = 9，d = 6', 0, 8.05);
  G.g.mark(0, 0, '#f0b8a8');
  say('表幾乎填滿了', '只剩起點 1 那一格');
}]);
FRAG.push(['dpbari3-msg-s1', '多段圖：cost(1,1) = 16', async (tok) => {
  const G = msgBase([12, 9, 10, 11, 6, 7, 8, 2, 3, 4, 5]);
  let f;
  await step(tok);                                   // 12:27 cost of the starting vertex: source → sink
  glow(G.node[1], GOLD);
  say('最後算起點 1', '它的 cost 就是 source 到 sink 的最小成本');
  await step(tok);                                   // 12:39 edges to 2, 3, 4, 5
  hiOut(G, 1);
  say('cost(1, 1)：頂點 1 有四條邊', '到 2、3、4、5，全部都要考慮');
  await step(tok);                                   // 12:49 do I have their costs? yes, filled
  [2, 3, 4, 5].forEach((v) => glow(G.g.get(0, v - 1), GOLD));
  say('2、3、4、5 的 cost 都已經在表上', '所以很好算');
  await step(tok);                                   // 12:53 formula
  [2, 3, 4, 5].forEach((v) => glow(G.g.get(0, v - 1), null));
  f = msgF('cost(1,1) = min{ c(1,2)+cost(2,2) , c(1,3)+cost(2,3) , c(1,4)+… , c(1,5)+… }');
  say('同樣：邊 + 下一個點的 cost', '四項取最小');
  await step(tok);                                   // 13:10 edge values 9 7 3 2
  [2, 3, 4, 5].forEach((v) => tag(String(msgW(1, v)), 'pkt', (MSG.pos[1][0] + MSG.pos[v][0]) / 2, (MSG.pos[1][1] + MSG.pos[v][1]) / 2 + 0.2, 0.5));
  say('四條邊的成本：9、7、3、2', '');
  await step(tok);                                   // 13:17 9 + 7, 7 + 9, 3 + 18, 2 + 15
  await Promise.all([2, 3, 4, 5].map((v, k) => fling(tok, String(MS.cost[v]), cellXY(G, v), V3(-4.5 + k * 3, 7.6, 0.6), 800)));
  txt(f, 'cost(1,1) = min{ 9 + 7 , 7 + 9 , 3 + 18 , 2 + 15 }');
  say('9 + 7、7 + 9、3 + 18、2 + 15', '');
  await step(tok);                                   // 13:47 16, 16, 21, 17
  txt(f, 'cost(1,1) = min{ 16 , 16 , 21 , 17 }');
  say('= 16、16、21、17', '');
  await step(tok);                                   // 13:55 two same answers → 16
  txt(f, 'cost(1,1) = 16');
  pickOut(G, 1); msgCost(G, 1);
  say('兩個一樣小：答案就是 16', 'cost(1, 1) = 16');
  await step(tok);                                   // 14:02 via vertex 2 and 3 → d = 2 or 3
  msgD(G, 1); G.g.mark(1, 0, LT); glow(G.node[2], GREEN); glow(G.node[3], GREEN);
  say('經過 2 或經過 3 都是 16', 'd 寫「2 或 3」（只寫一個也可以）');
  await step(tok);                                   // 14:14 first smaller values, then the larger
  glow(G.node[2], null); glow(G.node[3], null); glow(G.node[1], null);
  await fling(tok, '先填小的 → 再得到大的', V3(5, 0.3, 0.8), V3(-5, 0.3, 0.8), 1500, true);
  say('先填小問題的值，再得到大問題的答案', '從多段圖的最後面往回算');
  await step(tok);                                   // 14:23 still called forward method
  bub('從後面算，卻叫 forward method？', 0, -0.3, 0.8);
  say('雖然從最後一個 stage 往回算', '仍然叫 forward method：下一段揭曉');
}]);
FRAG.push(['dpbari3-msg-formula', 'cost(i, j) = min{ c(j, l) + cost(i+1, l) }', async (tok) => {
  const G = msgBase(MSG.order);
  let f;
  await step(tok);                                   // 14:33 frame the formula
  f = msgF('cost( i , j ) = ?');
  say('把剛剛的步驟寫成公式', '');
  await step(tok);                                   // 14:43 i = stage, j = vertex
  note('i：stage 編號', -3.6, 7.2, 0.6); note('j：頂點編號', 3.6, 7.2, 0.6);
  say('cost(i, j)', 'i 是 stage 編號，j 是頂點編號');
  await step(tok);                                   // 14:59 min of c(j, l) + cost(…, l)
  txt(f, 'cost( i , j ) = min{ c( j , l ) + cost( ? , l ) }');
  say('從 j 走一條邊到某個頂點 l', '邊的成本 + l 的 cost，取最小');
  await step(tok);                                   // 15:18 j = 2, l = 6
  glow(G.node[2], GOLD); glow(G.node[6], GOLD); tint(edgeOf(G, 2, 6), ORANGE);
  bub('j = 2、l = 6：c(2,6) + cost(3,6)', 0, 0.0, 0.8);
  say('例：j = 2、l = 6', 'c(2, 6) + cost(3, 6)');
  await step(tok);                                   // 15:25 stage number i + 1
  txt(f, 'cost( i , j ) = min{ c( j , l ) + cost( i+1 , l ) }');
  say('l 那一項的 stage 是 i + 1', '');
  await step(tok);                                   // 15:32 vertex 2 has three edges → three times
  hiOut(G, 2); glow(G.node[2], GOLD);
  say('頂點 2 有三條邊', '同樣的式子寫三次，再取最小');
  await step(tok);                                   // 15:41 example: cost(2, 3)
  hiOut(G, 2, SAND); glow(G.node[2], null);
  glow(G.node[3], GOLD); hiOut(G, 3);
  say('再看 cost(2, 3)', 'c(3, 6) + cost(3, 6) 是其中一項');
  await step(tok);                                   // 16:02 l is definitely in the next stage: i + 1
  [6, 7].forEach((v) => glow(G.node[v], GREEN));
  say('l 一定在下一個 stage', 'i = 2 → l 在 stage 2 + 1 = 3');
  await step(tok);                                   // 16:26 (j, l) ∈ E, l ∈ next stage
  hiOut(G, 3, SAND); glow(G.node[3], null); [6, 7].forEach((v) => glow(G.node[v], null));
  txt(f, 'cost(i, j) = min{ c(j, l) + cost(i+1, l) }   ( j, l ) ∈ E ， l ∈ V(i+1)');
  say('條件：(j, l) 是一條邊', '而且 l 在下一個 stage');
  await step(tok);                                   // 16:45 the formula in textbooks
  f.element.className = 'lab-label good';
  say('這就是課本上的多段圖公式', '');
}]);
FRAG.push(['dpbari3-msg-path', '跟著 d 往前決策：兩條成本 16 的路徑', async (tok) => {
  const G = msgBase(MSG.order);
  let me;
  await step(tok);                                   // 16:50 now actual DP starts: formula and table ready
  bub('公式 ✓　表格 ✓', 0, 8.05);
  say('公式和表格都準備好了', '真正的 DP 現在才開始');
  await step(tok);                                   // 16:57 DP = sequence of decisions; none taken yet
  say('DP 是靠一連串的決策解題', '到目前為止，我們一個決策都還沒做');
  await step(tok);                                   // 17:10 d values: whichever vertex gave minimum
  for (let v = 1; v <= 11; v++) G.g.mark(1, v - 1, LT);
  say('d 列記的是「給出最小值的頂點」', '用它來做決策：每一步該往哪走');
  await step(tok);                                   // 17:28 decisions from vertex 1 towards sink
  me = walker(1);
  say('從頂點 1 出發，往 sink 的方向做決策', '');
  await step(tok);                                   // 17:38 forward direction → forward method
  await fling(tok, '決策方向 →', V3(-5, 0.0, 0.8), V3(5, 0.0, 0.8), 1500, true);
  say('決策往前走', '所以叫 forward method');
  const go = async (a, b, color) => { glow(G.g.get(1, a - 1), GOLD); tint(edgeOf(G, a, b), color); await walkTo(tok, me, b); glow(G.g.get(1, a - 1), null); };
  await step(tok);                                   // 18:15 d(1,1) = 2
  await go(1, 2, TEAL);
  say('d(1, 1) = 2', '走到頂點 2');
  await step(tok);                                   // 18:29 from 2 → 7
  await go(2, 7, TEAL);
  say('d(2, 2) = 7', '走到頂點 7');
  await step(tok);                                   // 18:41 from 7 → 10
  await go(7, 10, TEAL);
  say('d(3, 7) = 10', '走到頂點 10');
  await step(tok);                                   // 18:53 from 10 → 12
  await go(10, 12, TEAL);
  me.mood('happy'); await me.hop(tok);
  say('d(4, 10) = 12', '到 sink 了');
  await step(tok);                                   // 19:05 path 1 → 2 → 7 → 10 → 12
  good('1 → 2 → 7 → 10 → 12 ＝ 9 + 2 + 3 + 2 = 16', 0, -0.3, 0.8);
  say('最短路徑 1 → 2 → 7 → 10 → 12', '一連串決策就得到答案');
  await step(tok);                                   // 19:29 once more for 3
  await walkTo(tok, me, 1, 900);
  me.mood('calm');
  say('d(1, 1) 也可以是 3', '再走一次看看');
  await step(tok);                                   // 19:38 1 gives 3
  await go(1, 3, PINK);
  say('從 1 走到 3', '');
  await step(tok);                                   // 19:52 3 → 6
  await go(3, 6, PINK);
  say('d(2, 3) = 6', '走到頂點 6');
  await step(tok);                                   // 20:09 6 → 10
  await go(6, 10, PINK);
  say('d(3, 6) = 10', '走到頂點 10');
  await step(tok);                                   // 20:24 10 → 12
  await go(10, 12, PINK);
  me.mood('happy'); await me.hop(tok);
  say('d(4, 10) = 12', '');
  await step(tok);                                   // 20:36 another route with the minimum
  bub('1 → 3 → 6 → 10 → 12 ＝ 7 + 2 + 5 + 2 = 16', 0, 0.5, 0.8);
  say('另一條路徑：1 → 3 → 6 → 10 → 12', '成本也是 16');
  await step(tok);                                   // 20:52 optimal result only one, two paths
  say('最佳成本只有一個：16', '只是剛好有兩條路徑都達到它');
}]);

// ════════════════ FcScLYJI42E：多段圖程式（8 頂點、4 stage） ════════════════
const MP = {
  pos: { 1: [-6.2, 5.6], 2: [-4.5, 7.0], 3: [-4.5, 5.6], 4: [-4.5, 4.2], 5: [-2.6, 7.0], 6: [-2.6, 5.6], 7: [-2.6, 4.2], 8: [-0.9, 5.6] },
  E: [[1, 2, 2], [1, 3, 1], [1, 4, 3], [2, 5, 2], [2, 6, 3], [3, 5, 6], [3, 6, 7], [4, 5, 6], [4, 6, 8], [4, 7, 9], [5, 8, 6], [6, 8, 4], [7, 8, 5]],
};
const mpC = (i, k) => { const e = MP.E.find((x) => x[0] === i && x[1] === k); return e ? e[2] : 0; };
const MPS = (() => {
  const cost = [], d = [], log = {}; cost[8] = 0;
  for (let i = 7; i >= 1; i--) {
    let min = 32767; const tries = [];
    for (let k = i + 1; k <= 8; k++) { const c = mpC(i, k); tries.push({ k, c, v: c ? c + cost[k] : null }); if (c !== 0 && c + cost[k] < min) { min = c + cost[k]; d[i] = k; } }
    cost[i] = min; log[i] = tries;
  }
  return { cost, d, log };
})();
const MPCODE = ['cost[n] = 0;', 'for (i = n-1; i >= 1; i--) {', '  min = 32767;', '  for (k = i+1; k <= n; k++)', '    if (c[i][k] != 0 &&', '        c[i][k]+cost[k] < min) {', '      min = c[i][k] + cost[k];', '      d[i] = k;', '    }', '  cost[i] = min;', '}'];
function mpBuild(drop, table = true) {
  const G = { node: {}, edge: {}, cl: {} };
  for (const [a, b, w] of MP.E) {
    const A = V3(MP.pos[a][0], MP.pos[a][1], -0.05), B = V3(MP.pos[b][0], MP.pos[b][1], -0.05);
    G.edge[a + '-' + b] = rod(A, B, SAND, 0.028);
    const p = A.clone().lerp(B, 0.4); tag(String(w), 'idx', p.x, p.y + 0.17, 0.1);
  }
  for (const v of Object.keys(MP.pos)) {
    const [x, y] = MP.pos[v];
    G.node[v] = cube(v, v === '1' || v === '8' ? PURPLE : BLUE, [0.5, 0.45, 0.45], x, y, 0, drop ? 1.4 : 0);
    G.cl[v] = tag('', 'ptr alt', x, y + 0.45, 0.3); showL(G.cl[v], false);
  }
  G.st = [-6.2, -4.5, -2.6, -0.9].map((x, s) => tag('stage ' + (s + 1), 'idx', x, 7.75));
  if (table) mpTable(G);
  return G;
}
function mpTable(G) {
  G.g = grid({ rows: 2, cols: 9, cw: 0.74, ch: 0.55, x0: -5.4, y0: 2.6, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: ['cost', 'd'], rowDx: 0.5 });
  G.g.mark(0, 0, DIM); G.g.mark(1, 0, DIM);
}
function mpCost(G, i, drop = 1) { G.g.set(0, i, MPS.cost[i], TEAL, drop); tint(G.node[i], TEAL); txt(G.cl[i], String(MPS.cost[i])); showL(G.cl[i], true); }
function mpD(G, i, drop = 1) { G.g.set(1, i, i === 8 ? '—' : MPS.d[i], PURPLE, drop); }
function mpFill(G, i, drop = 1) { mpCost(G, i, drop); mpD(G, i, drop); }
const mpXY = (v, dy = 0.5) => V3(MP.pos[v][0], MP.pos[v][1] + dy, 0.5);
const mpCell = (G, i) => { const p = G.g.pos(0, i); return V3(p.x, p.y + 0.3, 0.6); };
const mpF = (t) => mono(tag(t, 'say', -3.5, 8.35));
FRAG.push(['dpbari3-msgp-data', '多段圖程式：c[9][9]、cost、d、p', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  let G, M;
  await step(tok);                                   // 0:33 simple C/C++: everything inside main
  const mainC = code(['int main() {', '  // 資料、迴圈全部寫在這裡', '}'], -3.6, 1.2, 0.45);
  const pc = prop('file', -6.6, 0.2, 1.4, 0.9, '程式'); bob(pc, 0.05);
  say('簡單的 C / C++ 程式', '全部寫在 main 裡');
  await step(tok);                                   // 0:40 data structures; graphical representation
  G = mpBuild(true, false);
  say('需要哪些資料結構？', '先看這張圖');
  await step(tok);                                   // 0:46 four stages
  G.st.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('4 個 stage、8 個頂點', '1 是 source、8 是 sink');
  await step(tok);                                   // 0:52 cost adjacency matrix
  M = grid({ rows: 9, cols: 9, cw: 0.44, ch: 0.34, x0: 2.5, y0: 7.3, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: Array.from({ length: 9 }, (_, k) => k), rowDx: 0.05 });
  bub('c：cost adjacency matrix', 4.3, 8.25);
  say('cost adjacency matrix c', '記錄每條邊的成本');
  await step(tok);                                   // 1:00 indices start from 0 → size 9
  for (let k = 0; k < 9; k++) { M.mark(0, k, '#f0b8a8'); M.mark(k, 0, '#f0b8a8'); }
  say('頂點 1～8，但 index 從 0 開始', '所以大小取 9：0 到 8');
  await step(tok);                                   // 1:07 first row & column zeros; partially filled
  for (let k = 0; k < 9; k++) { M.set(0, k, 0, GRAY, 0.6); if (k) M.set(k, 0, 0, GRAY, 0.6); }
  say('第 0 列、第 0 行全部是 0', '矩陣只畫了一部分');
  await step(tok);                                   // 1:13 1→2, 1→3, 1→4 costs
  ['1-2', '1-3', '1-4'].forEach((k) => tint(G.edge[k], ORANGE));
  for (const k of [2, 3, 4]) { await fling(tok, String(mpC(1, k)), mpXY(1), V3(M.pos(1, k).x, M.pos(1, k).y + 0.3, 0.6), 500); M.set(1, k, mpC(1, k), ORANGE, 0.6); }
  say('1→2 = 2、1→3 = 1、1→4 = 3', '填在第 1 列；沒有邊的格子是 0');
  await step(tok);                                   // 1:29 input given directly, not from keyboard
  ['1-2', '1-3', '1-4'].forEach((k) => tint(G.edge[k], SAND));
  note('資料直接寫在程式裡（想換題目可改成從鍵盤讀入）', 0, -0.4, 1.2);
  say('資料直接寫進程式', '這個程式只解這一題');
  await step(tok);                                   // 1:43 cost array
  mpTable(G);
  G.g.mark(1, 0, DIM); for (let k = 0; k < 9; k++) G.g.mark(1, k, DIM);
  say('cost 陣列：每個頂點到 sink 的成本', '');
  await step(tok);                                   // 1:48 d array
  for (let k = 1; k < 9; k++) G.g.mark(1, k, '#efe6d2');
  say('d 陣列：最短路徑經過哪個頂點', 'd[i]：從 i 出發，最短那條路的下一站');
  await step(tok);                                   // 1:52 p array for the path
  const P = grid({ rows: 1, cols: 5, cw: 0.74, ch: 0.5, x0: -5.4, y0: 1.2, colHdr: [0, 1, 2, 3, 4], rowHdr: ['p'], rowDx: 0.5 });
  say('最後還要一個 p 陣列', '存找到的路徑');
  await step(tok);                                   // 2:05 all size 9: vertices from 1, indices from 0
  G.g.mark(0, 0, '#f0b8a8'); G.g.mark(1, 0, '#f0b8a8');
  note('index 0 不用', -6.0, 3.1, 0.6);
  say('c 是 9×9，cost、d 大小 9', '頂點從 1 開始，index 從 0 → 0 號空著');
}]);
FRAG.push(['dpbari3-msgp-loop', '多段圖程式：i 從 n−1 往回，追蹤 i = 4', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  const cd = code(MPCODE, 3.7, 7.4, 0.45);
  let I, kp, f;
  const tryK = async (k, text) => { await travel(tok, kp, kp.position.clone(), mpXY(k, -0.55), 500); glow(G.node[k], GOLD); if (mpC(4, k)) tint(G.edge['4-' + k], ORANGE); if (text) txt(f, text); };
  await step(tok);                                   // 2:22 forward method: start from the last vertex 8, 7, 6 …
  await fling(tok, '8 → 7 → 6 → 5 …', V3(-0.9, 3.4, 0.6), V3(-5.8, 3.4, 0.6), 1600);
  say('從最後一個頂點 8 開始', '再 7、6、5……往回算');
  await step(tok);                                   // 2:46 cost[8] = 0
  cd.hl(0); glow(G.node[8], GOLD); mpFill(G, 8);
  say('cost[8] = 0', '8 是 sink，不用再走');
  await step(tok);                                   // 2:56 loop from n−1 to 1
  glow(G.node[8], null); cd.hl(1);
  I = buddy('i', 7, ORANGE, 3.0, 0, 1.6, 0.55);
  say('n = 8：外圈 i 從 n−1 跑到 1', '');
  await step(tok);                                   // 3:19 decrementing loop; everything inside
  I.mood('wow');
  bub('遞減的迴圈：i = 7, 6, 5, …, 1', 3.0, 1.6, 1.6);
  say('i 每次減 1', '所有計算都在這個迴圈裡');
  await step(tok);                                   // 3:32 7: single edge, cost 5
  I.set(7); I.mood('calm'); tint(G.edge['7-8'], TEAL); mpCost(G, 7);
  say('i = 7：只有一條邊到 8', 'cost[7] = 5');
  await step(tok);                                   // 3:40 6: direct edge 4; 5: direct edge 6
  I.set(6); tint(G.edge['6-8'], TEAL); mpCost(G, 6);
  await beat(tok, 700);
  I.set(5); tint(G.edge['5-8'], TEAL); mpCost(G, 5);
  say('6、5 也各只有一條邊到 8', 'cost[6] = 4、cost[5] = 6');
  await step(tok);                                   // 3:54 vertex 4: trace this one
  I.set(4); glow(G.node[4], GOLD);
  say('i = 4：這個要仔細追蹤', '它有好幾條邊');
  await step(tok);                                   // 4:01 formula cost[i] = min{c[i][k] + cost[k]}
  f = mpF('cost[i] = min{ c[i][k] + cost[k] }');
  say('公式：cost[i] = min{ c[i][k] + cost[k] }', 'c 是成本矩陣，cost 是 cost 陣列');
  await step(tok);                                   // 4:29 cost[4] = min of 4→k + cost[k]
  txt(f, 'cost[4] = min{ c[4][k] + cost[k] }');
  say('i = 4', 'cost[4] = min{ c[4][k] + cost[k] }');
  await step(tok);                                   // 4:57 only vertices greater than 4
  [5, 6, 7, 8].forEach((v) => glow(G.node[v], GOLD));
  say('k 要試哪些頂點？只看比 4 大的', '多段圖的邊只往前走');
  await step(tok);                                   // 5:09 i+1 to n loop
  [5, 6, 7, 8].forEach((v) => glow(G.node[v], null));
  cd.hl(3); kp = tag('k', 'pkt', MP.pos[4][0] + 0.6, MP.pos[4][1] - 0.55, 0.5);
  say('內圈 k 從 i+1 跑到 n', 'k = 5, 6, 7, 8');
  await step(tok);                                   // 5:38 k = 5: c[4][5] = 6
  cd.hl(5); await tryK(5, 'cost[4] = min{ 6 + cost[5] , … }');
  say('k = 5：c[4][5] = 6', '');
  await step(tok);                                   // 6:01 + cost[5] = 6 → 12
  await fling(tok, '6', mpCell(G, 5), V3(-2.6, 8.1, 0.6), 700);
  txt(f, 'cost[4] = min{ 6 + 6 = 12 , … }'); cd.hl(6);
  say('加上 cost[5] = 6（已經算好）', '6 + 6 = 12');
  await step(tok);                                   // 6:18 k = 6: 8 + 4 = 12
  glow(G.node[5], null); cd.hl(5); await tryK(6, 'cost[4] = min{ 12 , 8 + 4 = 12 , … }');
  say('k = 6：c[4][6] = 8，cost[6] = 4', '8 + 4 = 12');
  await step(tok);                                   // 6:41 k = 7: 9 + 5 = 14
  glow(G.node[6], null); await tryK(7, 'cost[4] = min{ 12 , 12 , 9 + 5 = 14 , … }');
  say('k = 7：c[4][7] = 9，cost[7] = 5', '9 + 5 = 14');
  await step(tok);                                   // 7:17 next k = 8: loop 5 to 8
  glow(G.node[7], null); await tryK(8);
  say('k 還會變成 8', '迴圈從 i+1 = 5 跑到 8');
  await step(tok);                                   // 7:33 condition c[i][k] != 0
  cd.hl(4);
  const z = bad('c[4][8] = 0：沒有邊 → 跳過', -0.9, 4.4, 0.6);
  say('if 條件：c[i][k] != 0 才計算', 'c[4][8] = 0，不算');
  await step(tok);                                   // 7:52 if less than minimum, change minimum
  remove(z); glow(G.node[8], null); cd.hl(6);
  say('每次比較：比目前 min 小就換掉', '');
  await step(tok);                                   // 8:00 12, 12, 14 → take 12
  txt(f, 'cost[4] = min{ 12 , 12 , 14 } = 12');
  tint(G.edge['4-5'], TEAL); tint(G.edge['4-6'], GRAY); tint(G.edge['4-7'], GRAY);
  say('12、12、14：最小 12', '兩個 12 取哪個都可以');
  await step(tok);                                   // 8:12 answer 12, k was 5 → d[4] = 5
  cd.hl(7); remove(kp); mpFill(G, 4); glow(G.node[4], null);
  I.mood('happy'); await I.hop(tok);
  say('cost[4] = 12，d[4] = 5', '給出最小值的 k 是 5（用 <，留住先找到的）');
  await step(tok);                                   // 8:25 store min after the for loop
  cd.hl(9);
  say('內圈結束後，把 min 存進 cost[i]', '');
  await step(tok);                                   // 8:37 same for 3, 2, 1
  I.set(3); I.mood('calm');
  say('同樣的做法：i = 3、2、1', '');
}]);
FRAG.push(['dpbari3-msgp-rest', '多段圖程式：i = 3、2、1 → cost[1] = 9', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  [8, 7, 6, 5].forEach((v) => mpCost(G, v, 0)); mpFill(G, 4, 0); mpD(G, 8, 0);
  const R = grid({ rows: 1, cols: 9, cw: 0.5, ch: 0.42, x0: 2.0, y0: 7.2, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: ['c[3]'], rowDx: 0.2 });
  let I, kp, f;
  await step(tok);                                   // 8:46 d for 7, 6, 5: all go to 8
  [7, 6, 5].forEach((v) => mpD(G, v));
  say('補上 d：7、6、5 都是走到 8', 'd[7] = d[6] = d[5] = 8');
  await step(tok);                                   // 9:04 i becomes 3
  I = buddy('i', 3, ORANGE, 3.0, 0, 1.6, 0.55); glow(G.node[3], GOLD);
  say('i 減 1，變成 3', '');
  await step(tok);                                   // 9:35 k from 4 to 8
  kp = tag('k = 4…8', 'pkt', 4.0, 6.3, 0.6);
  say('k 從 i+1 = 4 試到 8', '');
  await step(tok);                                   // 9:53 edges from 3 go to 5 and 6 only
  tint(G.edge['3-5'], ORANGE); tint(G.edge['3-6'], ORANGE);
  say('但 3 只有到 5、6 的邊', '其他都是 0');
  await step(tok);                                   // 10:09 fill row 3: 3→5 = 6, 3→6 = 7, rest 0
  for (let k = 0; k < 9; k++) R.set(0, k, mpC(3, k), mpC(3, k) ? ORANGE : GRAY, 0.6);
  say('矩陣第 3 列：0 0 0 0 0 6 7 0 0', 'c[3][5] = 6、c[3][6] = 7');
  await step(tok);                                   // 10:19 only 5 and 6 evaluated
  for (const k of [4, 7, 8]) R.mark(0, k, '#f0b8a8');
  say('k 雖然試 4～8', '真正計算的只有 5 和 6');
  await step(tok);                                   // 10:29 c[3][5] + cost[5] = 6 + 6
  f = mpF('cost[3] = min{ 6 + 6 , … }');
  await fling(tok, '6', mpCell(G, 5), V3(-3.2, 8.1, 0.6), 700);
  say('k = 5：c[3][5] + cost[5]', '6 + 6 = 12');
  await step(tok);                                   // 10:46 7 + 4 = 11 → 11, via 6
  await fling(tok, '4', mpCell(G, 6), V3(-1.8, 8.1, 0.6), 700);
  txt(f, 'cost[3] = min{ 12 , 7 + 4 = 11 } = 11');
  tint(G.edge['3-5'], GRAY); tint(G.edge['3-6'], TEAL); mpFill(G, 3); glow(G.node[3], null);
  say('k = 6：7 + 4 = 11，比較小', 'cost[3] = 11，d[3] = 6');
  await step(tok);                                   // 10:58 fill the others directly
  remove(kp);
  I.set(2); mpFill(G, 2); tint(G.edge['2-6'], TEAL); tint(G.edge['2-5'], GRAY);
  await beat(tok, 800);
  I.set(1); mpFill(G, 1); tint(G.edge['1-2'], TEAL); tint(G.edge['1-3'], GRAY); tint(G.edge['1-4'], GRAY);
  txt(f, 'cost[2] = min{2+6, 3+4} = 7 ， cost[1] = min{2+7, 1+11, 3+12} = 9');
  say('其他直接填好', 'cost[2] = 7（d = 6）、cost[1] = 9（d = 2）');
  await step(tok);                                   // 11:06 cost of graph is 9
  glow(G.node[1], GREEN); glow(G.g.get(0, 1), GREEN);
  I.mood('happy'); await I.hop(tok);
  say('cost[1] = 9', 'source 到 sink 的最短距離');
}]);
FRAG.push(['dpbari3-msgp-path', '多段圖程式：p[i] = d[p[i−1]] 找路徑', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  for (let v = 8; v >= 1; v--) mpFill(G, v, 0);
  let cd, P;
  await step(tok);                                   // 11:21 which vertices? 4 stages → 4 vertices
  G.st.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('知道成本 9 了，那路徑呢？', '4 個 stage → 路徑上剛好 4 個頂點');
  await step(tok);                                   // 11:28 code for finding the path
  cd = code(['p[1] = 1;', 'p[stages] = n;', 'for (i = 2; i < stages; i++)', '  p[i] = d[p[i-1]];'], 3.6, 7.0, 0.5);
  P = grid({ rows: 1, cols: 9, cw: 0.74, ch: 0.55, x0: -5.4, y0: 0.95, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: ['p'], rowDx: 0.5 });
  P.mark(0, 0, DIM);
  say('找路徑的程式碼', '結果放進 p 陣列');
  await step(tok);                                   // 11:33 p[1] = 1
  cd.hl(0); P.set(0, 1, 1, ORANGE); glow(G.node[1], GOLD);
  say('p[1] = 1', '起點一定是頂點 1');
  await step(tok);                                   // 11:42 p[stages] = n → p[4] = 8
  cd.hl(1); P.set(0, 4, 8, ORANGE); glow(G.node[8], GOLD);
  say('p[stages] = n', 'p[4] = 8：終點一定是 8');
  await step(tok);                                   // 11:49 0..4 is sufficient
  for (let k = 5; k < 9; k++) P.mark(0, k, '#f0b8a8');
  say('其實 p 只要 0～4 就夠', '');
  await step(tok);                                   // 11:57 p[i] = d[p[i−1]]
  cd.hl(3);
  say('中間的頂點：p[i] = d[p[i−1]]', 'i 從 2 到 stages − 1');
  await step(tok);                                   // 12:15 i = 2: d[p[1]] = d[1]
  glow(P.get(0, 1), GOLD); glow(G.g.get(1, 1), GOLD);
  await fling(tok, 'p[1] = 1 → 看 d[1]', V3(P.pos(0, 1).x, 1.5, 0.6), V3(G.g.pos(1, 1).x, 2.4, 0.6), 900);
  say('i = 2：p[2] = d[p[1]] = d[1]', '');
  await step(tok);                                   // 12:27 d[1] = 2 → p[2] = 2
  await fling(tok, '2', V3(G.g.pos(1, 1).x, 2.0, 0.6), V3(P.pos(0, 2).x, 1.3, 0.6), 700);
  P.set(0, 2, 2, ORANGE); glow(G.node[2], GOLD); tint(G.edge['1-2'], ORANGE);
  glow(P.get(0, 1), null); glow(G.g.get(1, 1), null);
  say('d[1] = 2 → p[2] = 2', '從 1 走到 2');
  await step(tok);                                   // 12:35 p[3] = d[p[2]] = d[2]
  glow(G.g.get(1, 2), GOLD);
  await fling(tok, 'p[2] = 2 → 看 d[2]', V3(P.pos(0, 2).x, 1.5, 0.6), V3(G.g.pos(1, 2).x, 2.4, 0.6), 900);
  say('i = 3：p[3] = d[p[2]] = d[2]', '');
  await step(tok);                                   // 12:47 d[2] = 6 → p[3] = 6
  await fling(tok, '6', V3(G.g.pos(1, 2).x, 2.0, 0.6), V3(P.pos(0, 3).x, 1.3, 0.6), 700);
  P.set(0, 3, 6, ORANGE); glow(G.node[6], GOLD); tint(G.edge['2-6'], ORANGE); glow(G.g.get(1, 2), null);
  say('d[2] = 6 → p[3] = 6', '');
  await step(tok);                                   // 12:56 path 1 → 2 → 6 → 8
  tint(G.edge['6-8'], ORANGE);
  const w = buddy('', '', ORANGE, MP.pos[1][0], MP.pos[1][1] + 0.25, 0.6, 0.38);
  for (const v of [2, 6, 8]) await slide(tok, w.g, MP.pos[v][0], 500, MP.pos[v][1] + 0.25, 0.6);
  w.mood('happy');
  say('最短路徑 1 → 2 → 6 → 8', '2 + 3 + 4 = 9 = cost[1]');
  await step(tok);                                   // 13:05 used the program and solved
  good('用程式追蹤完：最短距離 9', 3.6, 4.6, 0.6);
  say('用這個程式就把多段圖解出來了', '');
}]);
FRAG.push(['dpbari3-msgp-time', '多段圖程式：內圈 1+2+…+n → O(n²)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const cd = code(['for (i = n-1; i >= 1; i--)', '  for (k = i+1; k <= n; k++)', '    …比較 c[i][k] + cost[k]…'], -3.6, 7.4, 0.5);
  let total = 0, cnt;
  const col = (i) => {
    const m = 8 - i, x = -5 + (7 - i) * 1.5;
    tag('i=' + i, 'idx', x, 0.5);
    for (let h = 0; h < m; h++) cube('', i % 2 ? BLUE : TEAL, [0.9, 0.5, 0.5], x, 1.0 + h * 0.55, 0, 1.2);
    total += m; txt(cnt, '內圈合計 ' + total + ' 次');
  };
  await step(tok);                                   // 13:13 two nested loops: blindly n²?
  const T = buddy('計時員', '', '#f3d27a', 5.6, 0, 1.4, 0.7);
  bub('兩層迴圈 → 直接說 n²？', 3.8, 6.4);
  T.mood('wow');
  say('兩層巢狀迴圈', '直接說 n²？先別急，看清楚');
  await step(tok);                                   // 13:23 outer: n−1 to 1 ≈ n times
  cd.hl(0); cnt = tag('內圈合計 0 次', 'ptr alt', 3.8, 7.4);
  say('外圈從 n−1 到 1', '大約 n 次');
  await step(tok);                                   // 13:33 inner: how many times is the formula computed?
  cd.hl(2);
  say('真正的計算在內圈', '它總共做幾次？');
  await step(tok);                                   // 13:47 first: only one vertex
  col(7);
  say('i = 7：k 只有 8', '內圈 1 次');
  await step(tok);                                   // 13:54 then two, three … increasing
  col(6); await beat(tok, 500); col(5);
  say('i = 6：2 次；i = 5：3 次', '一次比一次多');
  await step(tok);                                   // 14:03 on 4: 5..8; on 3: 4..8
  col(4); await beat(tok, 400); col(3); await beat(tok, 400); col(2); await beat(tok, 400); col(1);
  say('i = 4 看 5～8、i = 3 看 4～8……', '慢慢增加，最多到 n');
  await step(tok);                                   // 14:13 n(n+1)/2 ≈ n²
  bub('1 + 2 + … ≈ n(n+1)/2 ≈ n²', 3.8, 5.6);
  T.mood('calm');
  say('1 + 2 + 3 + … ≈ n(n+1)/2', '大約 n²');
  await step(tok);                                   // 14:21 time complexity O(n²)
  good('多段圖程式：O(n²)', 3.8, 4.8);
  T.mood('happy'); await T.hop(tok);
  say('多段圖的時間複雜度：O(n²)', 'n = 頂點數');
}]);

// ════════════════ nLmhmB6NzcM：0/1 knapsack（表格法＋sets 法） ════════════════
const KP = KN.items.map(([w, p]) => ({ w, p }));           // p = 1 2 5 6、w = 2 3 4 5
const KV = knapSteps(KN.items, KN.W).V;
const KCOL = [ORANGE, PINK, BLUE, TEAL];
// the four objects as little characters (profit / weight on the belly)
function kItems(x0 = -4.8, y = 0, z = 2.3, dx = 1.75, size = 0.62) {
  return KP.map((o, k) => buddy('物品 ' + (k + 1), 'p' + o.p + ' w' + o.w, KCOL[k], x0 + k * dx, y, z, size));
}
// V table: rows i = 0..4, columns w = 0..8
function kTable(zeros) {
  const g = grid({ rows: 5, cols: 9, cw: 0.9, ch: 0.72, x0: -2.9, y0: 6.6, colHdr: Array.from({ length: 9 }, (_, k) => 'w=' + k), rowHdr: ['i=0', ...KP.map((o, k) => 'i=' + (k + 1) + ' (p' + o.p + ',w' + o.w + ')')], rowDx: 1.0 });
  if (zeros) { for (let w = 0; w <= 8; w++) g.set(0, w, 0, GRAY, 0); for (let i = 1; i <= 4; i++) g.set(i, 0, 0, GRAY, 0); }
  return g;
}
const kSet = (g, i, w, color = BLUE, drop = 1.2) => g.set(i, w, KV[i][w], color, drop);
function kRows(g, rows) { for (let i = 1; i <= rows; i++) for (let w = 1; w <= 8; w++) kSet(g, i, w, BLUE, 0); }
const kXY = (g, i, w, dy = 0.4) => { const p = g.pos(i, w); return V3(p.x, p.y + dy, 0.6); };
FRAG.push(['dpbari3-knap-problem', '0/1 knapsack：4 件物品、容量 m = 8', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.4, 0]);
  let I, bag, f;
  await step(tok);                                   // 0:25 four objects
  I = kItems(-5.6, 2.6, 0.6, 1.5, 0.7);
  say('有 4 件物品', '');
  await step(tok);                                   // 0:33 profit and weight
  I.forEach((b) => b.mood('happy'));
  note('p = 利潤（賣掉賺多少）', -3.4, 1.6, 1.2); note('w = 重量', -3.4, 1.0, 1.2);
  say('每件都有利潤 p 和重量 w', 'p：1 2 5 6、w：2 3 4 5');
  await step(tok);                                   // 0:37 a bag of capacity m = 8
  bag = K.ghostBox('#c9a35a', 3.4, 2.2, 1.6); bag.position.set(4.2, 1.2, 0.6);
  tag('背包 m = 8', 'ptr', 4.2, 2.7, 0.6);
  say('背包容量 m = 8', '');
  await step(tok);                                   // 0:41 fill the bag with these objects
  bub('把物品裝進背包', 4.2, 3.4, 0.6);
  say('目標：把物品裝進背包', '');
  await step(tok);                                   // 0:49 all of them? total 14 > 8
  await Promise.all(I.map((b, k) => slide(tok, b.g, 3.0 + k * 0.8, 900, 0.1, 0.6)));
  I.forEach((b) => b.mood('sad'));
  f = bad('全放：2 + 3 + 4 + 5 = 14 > 8', 4.2, -0.4, 1.2);
  say('能全部放嗎？總重 14，背包只有 8', '不行！');
  await step(tok);                                   // 1:01 carry only a subset, sell elsewhere
  remove(f);
  await Promise.all(I.map((b, k) => slide(tok, b.g, -5.6 + k * 1.5, 900, 2.6, 0.6)));
  I.forEach((b) => b.mood('calm'));
  say('只能帶其中一部分（子集合）', '帶到別的地方賣掉');
  await step(tok);                                   // 1:07 sell → profit; maximize total profit
  bub('總利潤要最大', 4.2, 3.4, 0.6).element.className = 'lab-label good';
  say('賣掉就得到利潤', '要讓總利潤最大');
  await step(tok);                                   // 1:14 solution as a set: included or not
  const xs = KP.map((o, k) => tag('x' + (k + 1) + ' = ?', 'pkt', -5.6 + k * 1.5, 4.4, 0.6));
  say('答案寫成每件「有放」或「沒放」', '(x1, x2, x3, x4)');
  await step(tok);                                   // 1:29 xi = 0 or 1, not fraction
  xs.forEach((l, k) => txt(l, 'x' + (k + 1) + ' = 0/1'));
  say('每個 xᵢ 只能是 0 或 1', '不能是分數');
  await step(tok);                                   // 1:44 not divisible: mixer, microwave oven …
  const mx = prop('parcel', 0.6, 0, 1.6, 0.9, '果汁機、微波爐…'); bob(mx, 0.05);
  bad('半台？不行', 0.6, -0.5, 2.0);
  say('物品不能切開', '像果汁機、微波爐：不能只帶半台');
  await step(tok);                                   // 2:03 whole object or not at all
  I[1].mood('happy'); I[3].mood('happy'); await Promise.all([I[1].hop(tok), I[3].hop(tok)]);
  say('要嘛整件帶，要嘛不帶', '這就是「0/1」的意思');
  await step(tok);                                   // 2:09 sum of profits maximized
  f = mono(tag('max  Σ pᵢ xᵢ', 'say', -1.6, 6.3, 0));
  say('目標：Σ pᵢxᵢ 最大', '帶走的利潤加起來最多');
  await step(tok);                                   // 2:17 sum of weights ≤ m
  mono(tag('限制  Σ wᵢ xᵢ ≤ m = 8', 'say', 2.6, 6.3, 0));
  say('限制：Σ wᵢxᵢ ≤ m', '帶走的重量不能超過背包');
}]);
FRAG.push(['dpbari3-knap-brute', '0/1 knapsack：一連串決策、2ⁿ 種解', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.0, 0]);
  let root, lvl, cnt;
  const grow = (d) => {
    const i = 4 - d, sp = 11.2 / 2 ** (d + 1), nx = [];
    lvl.forEach((n) => [0, 1].forEach((b) => {
      // the 16 leaves are only 0.7 apart: every other one sits a little lower so their bit strings never touch
      const x = n.x + (b ? 1 : -1) * sp / 2, y = 7.0 - (d + 1) * 1.3 - (d === 3 && nx.length % 2 ? 0.5 : 0);
      rod(V3(n.x, n.y - 0.2, -0.05), V3(x, y + 0.2, -0.05), b ? ORANGE : GRAY, 0.022);
      const c = { x, y, bits: [b].concat(n.bits), w: n.w + b * KP[i - 1].w };
      c.m = cube(d === 3 ? c.bits.join('') : b, b ? ORANGE : GRAY, [d === 3 ? 0.62 : 0.4, 0.36, 0.36], x, y, 0, 1);
      nx.push(c);
    }));
    tag('x' + i, 'ptr', -6.4, 7.0 - (d + 1) * 1.3);
    lvl = nx;
  };
  await step(tok);                                   // 2:25 the approach of DP
  const D = buddy('DP', '', TEAL, 6.0, 0, 1.4, 0.7);
  say('用 DP 怎麼解？', '先複習 DP 的幾個重點');
  await step(tok);                                   // 2:32 optimization: maximum
  note('① 最佳化問題：要最大利潤 ✓', 4.6, 7.6);
  say('DP 解最佳化問題', '這題要最大值 ✓');
  await step(tok);                                   // 2:39 sequence of decisions
  note('② 一連串的決策', 4.6, 7.0);
  say('DP：問題要能用一連串決策來解', '');
  await step(tok);                                   // 2:46 each object: include or not
  root = { x: 0, y: 7.0, bits: [], w: 0 }; cube('', PURPLE, [0.5, 0.4, 0.4], 0, 7.0, 0, 1.2); lvl = [root];
  grow(0);
  say('每件物品：放或不放', '一件一個決策');
  await step(tok);                                   // 2:56 usually from the last object towards first
  for (const d of [1, 2, 3]) { grow(d); await beat(tok, 600); }
  say('通常從最後一件往第一件決定', 'x4 → x3 → x2 → x1');
  await step(tok);                                   // 3:06 try all possible solutions, pick best
  note('③ 試遍所有可能，挑最好的', 4.6, 6.4);
  D.mood('wow');
  say('DP：試遍所有可能的解', '再挑最好的');
  await step(tok);                                   // 3:18 0000, 1111, 0001 …
  for (const c of lvl) { const s = c.bits.join(''); if (s === '0000' || s === '1111' || s === '0001') glow(c.m, GOLD); }
  say('0000 = 都不放、1111 = 全放', '0001 = 只放第 4 件……');
  await step(tok);                                   // 3:36 some feasible, some not
  lvl.forEach((c) => { glow(c.m, null); tint(c.m, c.w > KN.W ? RED : TEAL); });
  say('有些可行（綠）、有些超重不可行（紅）', '例如全放就不行');
  await step(tok);                                   // 3:47 2⁴ solutions; n objects → 2ⁿ
  cnt = bub('4 件 → 2⁴ = 16 種；n 件 → 2ⁿ 種', 0, 0.6, 1.2);
  say('4 件就有 2⁴ = 16 種', 'n 件就有 2ⁿ 種');
  await step(tok);                                   // 4:00 time 2ⁿ: too much
  bad('全部試：O(2ⁿ)，太花時間', 0, -0.2, 1.2);
  D.mood('sad');
  say('全部試一遍要 O(2ⁿ)', '太花時間了');
  await step(tok);                                   // 4:06 DP: indirectly try all
  good('DP：用表格「間接」試遍', 4.6, 0.2, 1.4);
  D.mood('happy'); await D.hop(tok);
  say('DP 有更簡單的方法', '間接地試遍 2ⁿ 種，卻不花那麼多時間');
}]);
FRAG.push(['dpbari3-knap-rows', '0/1 knapsack 表格法：直覺填前三列', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  let g, I;
  const row = async (i, ws, ms = 280) => { for (const w of ws) { kSet(g, i, w); await beat(tok, ms); } };
  await step(tok);                                   // 4:20 tabulation method
  g = kTable(false); I = kItems();
  say('表格法（tabulation）', '先畫一張表');
  await step(tok);                                   // 4:32 columns 0..8: weight one by one
  await fling(tok, '容量 0 → 8', kXY(g, 0, 0, 0.9), kXY(g, 0, 8, 0.9), 1500);
  say('行：背包容量 0 到 8', '不一次看容量 8，而是一格一格加大');
  await step(tok);                                   // 4:54 rows 0..4: one object at a time
  await fling(tok, '物品 0 → 4', V3(-4.6, 6.6, 0.6), V3(-4.6, 3.7, 0.6), 1300);
  say('列：0 到 4，一次多考慮一件物品', '第 0 列：什麼都不放');
  await step(tok);                                   // 5:11 row 0: no object → profit 0
  for (let w = 0; w <= 8; w++) g.set(0, w, 0, GRAY, 0.8);
  say('格子裡寫「利潤」', '沒有物品：利潤 0');
  await step(tok);                                   // 5:22 capacity 0 → 0
  for (let i = 1; i <= 4; i++) g.set(i, 0, 0, GRAY, 0.8);
  say('容量 0：什麼都放不下', '第 0 行也全是 0');
  await step(tok);                                   // 5:42 first object; ignore others
  I[0].mood('happy'); [1, 2, 3].forEach((k) => I[k].mood('calm'));
  say('第 1 列：只考慮物品 1', '其他先不管');
  await step(tok);                                   // 5:55 i-th row: also previous objects
  bub('第 i 列：考慮物品 1 … i', 3.9, 7.7);
  say('到第 i 列時', '前面各列的物品也一起考慮');
  await step(tok);                                   // 6:14 weight 2 → at capacity 2, profit 1
  kSet(g, 1, 1, BLUE); await fling(tok, '1', V3(-4.8, 1.2, 2.3), kXY(g, 1, 2), 700); kSet(g, 1, 2, TEAL);
  say('物品 1 重 2：容量 2 才放得下', '利潤 1；容量 1 放不下 → 0');
  await step(tok);                                   // 6:29 only one object → 1 1 1 …
  await row(1, [3, 4, 5, 6, 7, 8]);
  say('容量再大，也只有一件可放', '之後都是 1');
  await step(tok);                                   // 7:08 second object weight 3 → at 3, profit 2
  I[1].mood('happy'); await fling(tok, '2', V3(-3.05, 1.2, 2.3), kXY(g, 2, 3), 700); kSet(g, 2, 3, TEAL);
  say('第 2 列：物品 2 重 3', '容量 3 → 利潤 2');
  await step(tok);                                   // 7:20 this side: same as previous row
  await row(2, [1, 2]);
  say('前面放不下物品 2', '照抄上一列：0、1');
  await step(tok);                                   // 7:28 both objects: weight 5, profit 3
  await fling(tok, '1 + 2', V3(-3.9, 1.2, 2.3), kXY(g, 2, 5), 800); kSet(g, 2, 5, TEAL);
  say('兩件都放：重 2 + 3 = 5', '容量 5 → 利潤 1 + 2 = 3');
  await step(tok);                                   // 8:01 rest 3 3 3
  await row(2, [6, 7, 8]);
  say('之後都是 3', '只有兩件，最多就是 3');
  await step(tok);                                   // 8:06 capacity 4: 2 (max of previous / this)
  kSet(g, 2, 4);
  say('容量 4：上一列 1、這列 2', '取大的：2');
  await step(tok);                                   // 8:19 third object
  I[2].mood('happy');
  say('第 3 列：物品 3（p5、w4）', '物品照重量由小到大排好了');
  await step(tok);                                   // 8:42 at capacity 4: profit 5
  await fling(tok, '5', V3(-1.3, 1.2, 2.3), kXY(g, 3, 4), 700); kSet(g, 3, 4, TEAL);
  say('容量 4 才放得下物品 3', '利潤 5');
  await step(tok);                                   // 8:49 before: previous row 2 1 0
  await row(3, [1, 2, 3]);
  say('之前照抄上一列', '0、1、2');
  await step(tok);                                   // 8:57 also consider objects 1, 2
  [0, 1].forEach((k) => I[k].mood('wow'));
  say('也要考慮物品 1、2 能不能一起放', '');
  await step(tok);                                   // 9:19 capacity 5: 5 (1+2 only gives 3)
  kSet(g, 3, 5);
  say('容量 5：物品 1+2 只有 3', '物品 3 自己就是 5 → 5');
  await step(tok);                                   // 9:27 capacity 6: objects 1 + 3 → 6
  await fling(tok, '1 + 5', V3(-3.0, 1.2, 2.3), kXY(g, 3, 6), 800); kSet(g, 3, 6, TEAL);
  say('容量 6：物品 1、3（重 2 + 4）', '利潤 1 + 5 = 6');
  await step(tok);                                   // 9:35 capacity 7: objects 2 + 3 → 7
  await fling(tok, '2 + 5', V3(-2.2, 1.2, 2.3), kXY(g, 3, 7), 800); kSet(g, 3, 7, TEAL);
  say('容量 7：物品 2、3（重 3 + 4）', '利潤 2 + 5 = 7');
  await step(tok);                                   // 9:45 all three? weight 9 > 8 → 7
  kSet(g, 3, 8);
  bad('三件都放：重 9 > 8', 3.9, 7.7);
  say('三件都放要 9，背包只有 8', '容量 8 還是 7');
}]);
FRAG.push(['dpbari3-knap-formula', '0/1 knapsack：用公式填第 4 列', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  const g = kTable(true); kRows(g, 3); const I = kItems();
  let f, fa;
  const show = (t) => { if (!f) f = mono(tag('', 'say', 1.0, 8.0)); txt(f, t); };
  const deps = (w) => { g.clearArrows(); g.unglow(); g.arrow(3, w, 4, w, TRY); glow(g.get(3, w), GOLD); if (w >= 5) { g.arrow(3, w - 5, 4, w, OKC); glow(g.get(3, w - 5), GREEN); } };
  await step(tok);                                   // 10:09 the formula; call the table V
  I[3].mood('happy');
  show('V[i, w] = ?');
  say('第 4 列用公式填', '把這張表叫做 V');
  await step(tok);                                   // 10:17 max of V[i−1, w]: previous row
  show('V[i, w] = max( V[i−1, w] , … )');
  say('第一項：上一列同一格', '不放第 i 件，就跟上一列一樣');
  await step(tok);                                   // 10:34 or V[i−1, w − wᵢ] + pᵢ
  show('V[i, w] = max( V[i−1, w] , V[i−1, w−wᵢ] + pᵢ )');
  say('第二項：放第 i 件', '剩下的容量 w − wᵢ 交給上一列，再加 pᵢ');
  await step(tok);                                   // 10:56 V[4,1] = max(V[3,1], V[3,1−5] + 6)
  deps(1);
  show('V[4,1] = max( V[3,1] , V[3, 1−5] + 6 )');
  say('V[4, 1]：物品 4 重 5、利潤 6', 'max(V[3,1], V[3,1−5] + 6)');
  await step(tok);                                   // 11:33 V[3, −4]: no such location
  show('V[4,1] = max( V[3,1] , V[3, −4] + 6 )');
  fa = bad('V[3, −4]：沒有這一格', 4.0, 4.6, 0.6);
  say('1 − 5 = −4：沒有這一格', '這一項不算');
  await step(tok);                                   // 11:41 only V[3,1] = 0 → 0
  remove(fa); kSet(g, 4, 1); show('V[4,1] = V[3,1] = 0');
  say('只剩 V[3, 1] = 0', 'V[4, 1] = 0');
  await step(tok);                                   // 11:54 up to weight 5: copy as is
  for (const w of [2, 3, 4]) { deps(w); kSet(g, 4, w); await beat(tok, 400); }
  g.clearArrows(); g.unglow();
  show('w < 5：V[4,w] = V[3,w]');
  say('容量 5 以前都會得到負的 index', '直接照抄上一列');
  await step(tok);                                   // 12:27 V[4,5] = max(V[3,5], V[3,0] + 6)
  deps(5); show('V[4,5] = max( V[3,5] , V[3,0] + 6 )');
  say('V[4, 5]', 'max(V[3,5], V[3,5−5] + 6)');
  await step(tok);                                   // 13:03 5 vs 0 + 6 → 6: object included
  show('V[4,5] = max( 5 , 0 + 6 ) = 6'); kSet(g, 4, 5, TEAL); I[3].mood('happy'); await I[3].hop(tok);
  say('5 和 6 取大：6', '表示物品 4 放進去了');
  await step(tok);                                   // 13:22 V[4,6] = max(V[3,6], V[3,1] + 6)
  deps(6); show('V[4,6] = max( V[3,6] , V[3,1] + 6 )');
  say('V[4, 6]', 'max(V[3,6], V[3,6−5] + 6)');
  await step(tok);                                   // 13:54 6 vs 0 + 6 → same, 6
  show('V[4,6] = max( 6 , 0 + 6 ) = 6'); kSet(g, 4, 6);
  say('6 和 6 一樣', 'V[4, 6] = 6');
  await step(tok);                                   // 14:02 V[4,7] = max(V[3,7], V[3,2] + 6)
  deps(7); show('V[4,7] = max( V[3,7] , V[3,2] + 6 )');
  say('V[4, 7]', 'max(V[3,7], V[3,7−5] + 6)');
  await step(tok);                                   // 14:38 7 vs 1 + 6 → 7
  show('V[4,7] = max( 7 , 1 + 6 ) = 7'); kSet(g, 4, 7);
  say('7 和 1 + 6 = 7 一樣', 'V[4, 7] = 7');
  await step(tok);                                   // 14:45 V[4,8] = max(V[3,8], V[3,3] + 6)
  deps(8); show('V[4,8] = max( V[3,8] , V[3,3] + 6 )');
  say('V[4, 8]', 'max(V[3,8], V[3,8−5] + 6)');
  await step(tok);                                   // 15:16 7 vs 2 + 6 = 8 → 8
  show('V[4,8] = max( 7 , 2 + 6 ) = 8'); kSet(g, 4, 8, TEAL);
  g.clearArrows(); g.unglow(); glow(g.get(4, 8), GREEN);
  say('7 和 2 + 6 = 8：取 8', '表填完了');
  await step(tok);                                   // 15:33 can also fill directly
  glow(g.get(4, 8), null);
  show('不用公式，也能直接填');
  say('最後一列也能不用公式、直接填', '');
  await step(tok);                                   // 15:46 column 5: 6; before: previous row
  glow(g.get(4, 5), GOLD); [1, 2, 3, 4].forEach((w) => glow(g.get(4, w), GREEN));
  say('物品 4 重 5：第 5 行寫它的利潤 6', '之前照抄上一列');
  await step(tok);                                   // 16:03 beyond: at 6 → 6, at 7: 6 + 1 = 7
  g.unglow(); glow(g.get(4, 6), GOLD); glow(g.get(4, 7), GOLD);
  I[0].mood('happy');
  say('容量再大，看能多帶誰', '容量 6 還是 6；容量 7：6 + 1 = 7（物品 1、4）');
  await step(tok);                                   // 16:29 at 8: 6 + 2 = 8
  g.unglow(); glow(g.get(4, 8), GREEN);
  I[1].mood('happy'); I[3].mood('happy'); await Promise.all([I[1].hop(tok), I[3].hop(tok)]);
  say('容量 8：物品 2、4', '6 + 2 = 8');
  await step(tok);                                   // 16:44 add those that fit: simple method
  g.unglow();
  show('放得下的物品加起來，取最大利潤');
  say('放得下的物品利潤相加，寫最大的', '比公式簡單');
}]);
FRAG.push(['dpbari3-knap-trace', '0/1 knapsack：從 8 往回決定 x', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  const g = kTable(true); kRows(g, 4); const I = kItems();
  const xs = [];
  const xl = (i, v) => { xs[i] = tag('x' + i + ' = ' + v, v ? 'good' : 'bad', -4.8 + (i - 1) * 1.75, 1.75, 2.3); };
  const where = (i, P) => { const out = []; for (let w = 0; w <= 8; w++) if (KV[i][w] === P) out.push(w); return out; };
  const lit = (i, P, c) => where(i, P).forEach((w) => { glow(g.get(i, w), c); g.mark(i, w, c === GREEN ? LG : LT); });
  let P = 8;
  await step(tok);                                   // 16:57 write x1 … x4
  KP.forEach((o, k) => tag('x' + (k + 1) + ' = ?', 'pkt', -4.8 + k * 1.75, 1.75, 2.3));
  say('要寫出 x1、x2、x3、x4', '哪件放、哪件不放');
  await step(tok);                                   // 17:08 sequence of decisions; need data
  bub('表格 = 決策需要的資料 ✓', 3.9, 7.7);
  say('現在才開始做一連串決策', '先有資料才能決策：表已經填好了');
  await step(tok);                                   // 17:27 start with the maximum profit 8
  glow(g.get(4, 8), GOLD);
  const pk = tag('利潤 8', 'pkt', g.pos(4, 8).x + 0.9, g.pos(4, 8).y, 0.6);
  say('從最大利潤開始：右下角的 8', '');
  await step(tok);                                   // 17:39 8 only in row 4, not row 3 → include 4
  lit(4, 8, GOLD); for (let w = 0; w <= 8; w++) g.mark(3, w, '#f0d0c8');
  xl(4, 1); I[3].mood('happy'); await I[3].hop(tok);
  say('8 只在第 4 列出現，第 3 列沒有', '是因為放了物品 4：x4 = 1');
  await step(tok);                                   // 17:55 8 − 6 = 2
  txt(pk, '利潤 2'); g.unglow();
  say('剩下的利潤：8 − 6 = 2', '物品 4 的利潤是 6');
  await step(tok);                                   // 18:11 2 in row 3 and also row 2 → x3 = 0
  for (let w = 0; w <= 8; w++) g.mark(3, w, '#efe6d2');
  lit(3, 2, GOLD); lit(2, 2, GREEN); xl(3, 0); I[2].mood('sad');
  say('2 在第 3 列有，第 2 列也有', '不是物品 3 造成的：x3 = 0');
  await step(tok);                                   // 18:26 2 in row 2, not row 1 → x2 = 1
  g.unglow(); lit(2, 2, GOLD); xl(2, 1); I[1].mood('happy'); await I[1].hop(tok);
  say('2 在第 2 列有，第 1 列沒有', '是物品 2 造成的：x2 = 1');
  await step(tok);                                   // 18:40 2 − 2 = 0
  txt(pk, '利潤 0'); g.unglow();
  say('剩下 2 − 2 = 0', '');
  await step(tok);                                   // 18:47 0 in row 1 and row 0 → x1 = 0
  lit(1, 0, GOLD); lit(0, 0, GREEN); xl(1, 0); I[0].mood('sad');
  say('0 在第 1 列有，第 0 列也有', '不放物品 1：x1 = 0');
  await step(tok);                                   // 19:00 x2 and x4 included
  g.unglow(); remove(pk);
  say('x = (0, 1, 0, 1)', '放物品 2 和物品 4');
  await step(tok);                                   // 19:12 total profit 8
  good('最大利潤 = 2 + 6 = 8', 3.9, 7.7);
  say('總利潤 8：0/1 knapsack 的最佳解', '');
}]);
// sets 法：(p, w) 有序對
const kAdd = (S, o) => S.map(([p, w]) => [p + o.p, w + o.w]);
const pairCube = (pr, color, x, y, drop = 0) => cube(pr[0] + ',' + pr[1], color, [0.82, 0.42, 0.4], x, y, 0, drop);
FRAG.push(['dpbari3-knap-sets', '0/1 knapsack sets 法：S⁰ → S³', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const Y = [7.0, 5.4, 3.8, 2.2];
  let S = [[0, 0]], I, cs3;
  const plus = async (i) => { const o = KP[i], add = kAdd(S, o); tag('S' + i + '¹', 'ptr alt', 0.7, Y[i]); const ms = []; for (const [k, q] of add.entries()) { ms.push(pairCube(q, ORANGE, 1.9 + k * 1.0, Y[i], 1.2)); await beat(tok, 250); } return add; };
  const merge = (i, add) => { const M = S.concat(add); tag('S' + (i + 1), 'ptr', -6.3, Y[i + 1]); const ms = M.map((q, k) => pairCube(q, k < S.length ? TEAL : ORANGE, -5.0 + k * 1.0, Y[i + 1], 1.2)); S = M; return ms; };
  let add;
  await step(tok);                                   // 19:20 solve it using sets method
  I = kItems(-4.8, 0, 2.6, 1.75, 0.55);
  say('同一題，改用 sets 法', '');
  await step(tok);                                   // 19:25 find all possibilities, pick best
  say('sets 法也是列出所有可能', '再挑最好的');
  await step(tok);                                   // 19:32 set of ordered pairs (p, w)
  note('有序對 (p, w) = (利潤, 重量)', 3.6, 7.8);
  say('集合裡放「有序對」(p, w)', '前面是利潤、後面是重量');
  await step(tok);                                   // 19:39 S0 = {(0,0)}
  tag('S0', 'ptr', -6.3, Y[0]); pairCube(S[0], GRAY, -5.0, Y[0], 1.2);
  say('S0 = {(0, 0)}', '沒利潤、沒重量：什麼都沒放');
  await step(tok);                                   // 19:47 first object (1,2)
  I[0].mood('happy'); await I[0].hop(tok);
  say('考慮物品 1：(1, 2)', '利潤 1、重量 2');
  await step(tok);                                   // 20:02 add (1,2) → S0¹
  await fling(tok, '+(1,2)', V3(-4.8, 1.2, 2.6), V3(1.9, Y[0] + 0.4, 0.4), 800);
  add = await plus(0);
  say('把 (1, 2) 加到 S0 的每一對', 'S0¹ = {(1, 2)}');
  await step(tok);                                   // 20:07 merge → S1
  merge(0, add);
  say('合併 S0 和 S0¹ → S1', 'S1 = {(0,0), (1,2)}');
  await step(tok);                                   // 20:21 not included / included
  note('物品 1：不放 ｜ 放', -4.5, Y[1] - 0.55, 0.4);
  say('兩對分別代表', '物品 1 沒放、物品 1 有放');
  await step(tok);                                   // 20:29 second object (2,3): S1¹
  I[1].mood('happy');
  await fling(tok, '+(2,3)', V3(-3.05, 1.2, 2.6), V3(1.9, Y[1] + 0.4, 0.4), 800);
  add = await plus(1);
  say('物品 2：(2, 3) 加到 S1 每一對', 'S1¹ = {(2,3), (3,5)}');
  await step(tok);                                   // 20:56 merge: four pairs
  merge(1, add);
  say('合併 → S2：四對', '都不放、只放 1、只放 2、兩件都放');
  await step(tok);                                   // 21:17 third object (5,4): S2¹
  I[2].mood('happy');
  await fling(tok, '+(5,4)', V3(-1.3, 1.2, 2.6), V3(1.9, Y[2] + 0.4, 0.4), 800);
  add = await plus(2);
  say('物品 3：(5, 4) 加到 S2 每一對', 'S2¹ = {(5,4), (6,6), (7,7), (8,9)}');
  await step(tok);                                   // 21:46 merge → S3
  cs3 = merge(2, add);
  say('合併 → S3：8 對', '= 2³ 種可能');
  await step(tok);                                   // 22:08 (8,9): profit 8, weight 9
  glow(cs3[7], GOLD);
  say('最後一對 (8, 9)', '利潤 8、重量 9');
}]);
FRAG.push(['dpbari3-knap-dominance', '0/1 knapsack sets 法：dominance rule 與 S⁴', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const S3raw = [[0, 0], [1, 2], [2, 3], [3, 5], [5, 4], [6, 6], [7, 7], [8, 9]];
  tag('S3', 'ptr', -6.3, 6.6);
  const cs = S3raw.map((q, k) => pairCube(q, TEAL, -5.0 + k * 1.0, 6.6, 0));
  const keep = [0, 1, 2, 4, 5, 6], S3 = keep.map((k) => S3raw[k]), add = kAdd(S3, KP[3]);
  const all = S3.concat(add.filter((q) => !(q[0] === 7 && q[1] === 7))).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const i66 = all.findIndex((q) => q[0] === 6 && q[1] === 6);
  let ca = [], c4 = [];
  await step(tok);                                   // 22:22 (8,9) exceeds capacity → discard
  glow(cs[7], RED);
  const b9 = bad('重量 9 > 8', 2.0, 7.4, 0.4);
  await beat(tok, 600); fly(cs[7]); remove(b9);
  say('(8, 9)：重量 9 超過背包 8', '丟掉');
  await step(tok);                                   // 22:31 profit increases, weight increases
  for (let k = 0; k < 4; k++) { glow(cs[k], GOLD); await beat(tok, 300); }
  say('看 S3：利潤增加，重量也增加', '這樣才合理');
  await step(tok);                                   // 22:46 here profit increases, weight decreases
  [0, 1, 2].forEach((k) => glow(cs[k], null)); glow(cs[3], RED); glow(cs[4], RED);
  bub('(3,5) → (5,4)：利潤變大，重量反而變小？', -1.0, 7.6, 0.4);
  say('(3, 5) 之後是 (5, 4)', '利潤變大，重量卻從 5 變 4');
  await step(tok);                                   // 22:59 discard the one with smaller profit
  fly(cs[3]); glow(cs[4], null);
  say('不合理：丟掉利潤較小的 (3, 5)', '更重又賺更少，沒人會選它');
  await step(tok);                                   // 23:13 now only 6 pairs
  keep.forEach((k, j) => move(cs[k], -5.0 + j * 1.0, 6.6, 0));
  say('S3 剩 6 對', '');
  await step(tok);                                   // 23:18 dominance rule
  good('dominance rule（支配規則）', 3.6, 6.0, 0.4);
  say('這種刪法叫 dominance rule', '');
  await step(tok);                                   // 23:29 fourth object (6,5): S3¹
  tag('S3¹', 'ptr alt', -6.3, 4.8);
  for (const [k, q] of add.entries()) { ca.push(pairCube(q, ORANGE, -5.0 + k * 1.0, 4.8, 1.2)); await beat(tok, 300); }
  say('物品 4：(6, 5) 加到每一對', 'S3¹ = (6,5) (7,7) (8,8) (11,9) (12,11) (13,12)');
  await step(tok);                                   // 24:11 merge → S4
  tag('S4', 'ptr', -6.3, 2.8);
  c4 = all.map((q, k) => pairCube(q, add.some((r) => r[0] === q[0] && r[1] === q[1]) ? ORANGE : TEAL, -5.4 + k * 1.0, 2.8, 1.2));
  say('合併成最後的 S4', '照重量排；(7, 7) 兩邊都有，只留一個');
  await step(tok);                                   // 24:30 (6,5) comes before (7,7)
  glow(c4[i66 - 1], GOLD);
  say('(6, 5) 要排在 (7, 7) 前面', '');
  await step(tok);                                   // 24:37 same profit, smaller weight → remove (6,6)
  glow(c4[i66], RED); glow(c4[i66 - 1], GOLD);
  await beat(tok, 500); fly(c4[i66]);
  say('(6, 6) 和 (6, 5)：利潤一樣，(6, 6) 比較重', '刪掉 (6, 6)');
  await step(tok);                                   // 24:43 (11,9) (12,11) (13,12) exceed → gone
  glow(c4[i66 - 1], null);
  all.forEach((q, k) => { if (q[1] > KN.W) { glow(c4[k], RED); fly(c4[k]); } });
  const fin = all.map((q, k) => [q, c4[k]]).filter(([q], k) => k !== i66 && q[1] <= KN.W);
  fin.forEach(([, m], j) => move(m, -5.0 + j * 1.0, 2.8, 0));
  say('(11,9)、(12,11)、(13,12) 超重', '全部丟掉，S4 剩 7 對');
  await step(tok);                                   // 24:59 generating all possibilities
  say('sets 法其實就是產生所有可能', '一個簡單的方法');
  await step(tok);                                   // 25:06 time ≈ 2ⁿ
  bad('時間大約 2ⁿ', 3.6, 1.6, 0.4);
  say('所花時間大約 2ⁿ', '');
}]);
FRAG.push(['dpbari3-knap-sets-trace', '0/1 knapsack sets 法：(8,8) 往回找 x', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const SS = [[[0, 0]], [[0, 0], [1, 2]], [[0, 0], [1, 2], [2, 3], [3, 5]], [[0, 0], [1, 2], [2, 3], [5, 4], [6, 6], [7, 7]], [[0, 0], [1, 2], [2, 3], [5, 4], [6, 5], [7, 7], [8, 8]]];
  const Y = [7.4, 6.3, 5.2, 4.1, 3.0];
  const C = SS.map((S, i) => { tag('S' + i, 'ptr', -6.3, Y[i]); return S.map((q, k) => pairCube(q, TEAL, -5.0 + k * 1.0, Y[i])); });
  const I = kItems(-4.8, 0, 2.6, 1.75, 0.55);
  const find = (i, q) => SS[i].findIndex((r) => r[0] === q[0] && r[1] === q[1]);
  const off = () => C.flat().forEach((m) => glow(m, null));
  const xl = (i, v) => tag('x' + i + ' = ' + v, v ? 'good' : 'bad', -4.8 + (i - 1) * 1.75, 1.6, 2.6);
  let pk;
  await step(tok);                                   // 25:13 now take the sequence of decisions
  say('集合都有了', '現在做一連串決策');
  await step(tok);                                   // 25:17 maximum pair (8,8)
  glow(C[4][6], GOLD); pk = tag('(8, 8)', 'pkt', 3.4, Y[4], 0.4);
  say('最大的有序對：(8, 8)', '做法跟表格法很像');
  await step(tok);                                   // 25:30 (8,8) ∈ S4 but ∉ S3 → object 4 included
  bad('S3 裡沒有 (8, 8)', 3.4, Y[3], 0.4);
  xl(4, 1); I[3].mood('happy'); await I[3].hop(tok);
  say('(8, 8) 在 S4，不在 S3', '所以是物品 4 造成的：x4 = 1');
  await step(tok);                                   // 25:49 subtract (6,5) → (2,3)
  off(); txt(pk, '(8,8) − (6,5) = (2,3)');
  say('減掉物品 4 的 (6, 5)', '(8, 8) − (6, 5) = (2, 3)');
  await step(tok);                                   // 26:11 (2,3) ∈ S3 and ∈ S2 → not object 3
  glow(C[3][find(3, [2, 3])], GOLD); glow(C[2][find(2, [2, 3])], GREEN); txt(pk, '(2, 3)');
  xl(3, 0); I[2].mood('sad');
  say('(2, 3) 在 S3，也在 S2', '不是物品 3 造成的：x3 = 0');
  await step(tok);                                   // 26:44 (2,3) ∈ S2, ∉ S1 → object 2 included
  off(); glow(C[2][find(2, [2, 3])], GOLD);
  xl(2, 1); I[1].mood('happy'); await I[1].hop(tok);
  say('(2, 3) 在 S2，不在 S1', '是物品 2 造成的：x2 = 1');
  await step(tok);                                   // 27:09 subtract (2,3) → (0,0)
  off(); txt(pk, '(2,3) − (2,3) = (0,0)');
  say('減掉物品 2 的 (2, 3)', '得到 (0, 0)');
  await step(tok);                                   // 27:25 (0,0) ∈ S1 and ∈ S0 → x1 = 0
  glow(C[1][0], GOLD); glow(C[0][0], GREEN); txt(pk, '(0, 0)');
  xl(1, 0); I[0].mood('sad');
  say('(0, 0) 在 S1，也在 S0', '不放物品 1：x1 = 0');
  await step(tok);                                   // 27:48 solution 0 1 0 1, profit 8
  off(); remove(pk);
  good('x = (0, 1, 0, 1)，利潤 8', 3.4, 5.6, 0.4);
  say('答案 0 1 0 1', '放物品 2、4，利潤 8');
  await step(tok);                                   // 28:02 same solution with sets
  say('用 sets 法得到同樣的答案', '');
  await step(tok);                                   // 28:14 both methods appear in different places
  bub('有的書用表格法，有的用 sets 法：兩種都要會', 0, 0.9, 1.6);
  say('有的地方用表格法，有的用 sets 法', '兩種都要會');
}]);

// ════════════════ zRza99HPvkQ：0/1 knapsack 程式（k[5][9]） ════════════════
const KCODE = ['for (i = 0; i <= n; i++)', ' for (w = 0; w <= m; w++) {', '  if (i == 0 || w == 0)', '   k[i][w] = 0;', '  else if (wt[i] <= w)', '   k[i][w] = max(p[i] +', '     k[i-1][w-wt[i]],', '     k[i-1][w]);', '  else', '   k[i][w] = k[i-1][w];', ' }'];
function kpArrays(drop) {
  const A = grid({ rows: 2, cols: 5, cw: 0.64, ch: 0.5, x0: 0.75, y0: 3.0, colHdr: [0, 1, 2, 3, 4], rowHdr: ['p', 'wt'], rowDx: 0.25 });
  [0, ...KP.map((o) => o.p)].forEach((v, k) => A.set(0, k, v, k ? ORANGE : GRAY, drop ? 1.2 : 0));
  [0, ...KP.map((o) => o.w)].forEach((v, k) => A.set(1, k, v, k ? PINK : GRAY, drop ? 1.2 : 0));
  tag('n = 4，m = 8', 'ptr', 5.0, 2.75);
  return A;
}
function kpGrid() {
  const g = grid({ rows: 5, cols: 9, cw: 0.64, ch: 0.56, x0: 0.75, y0: 6.9, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: [0, 1, 2, 3, 4], rowDx: 0.15 });
  tag('w →', 'idx', 0.1, 7.45); tag('i ↓', 'idx', -0.3, 6.9);
  return g;
}
function kpBuild(rowsFilled, drop) {
  const g = kpGrid(); kpArrays(drop);
  for (let i = 0; i < rowsFilled; i++) for (let w = 0; w <= 8; w++) g.set(i, w, KV[i][w], i && w ? BLUE : GRAY, 0);
  return g;
}
function kpStep(i, w) {
  const v = KV[i][w];
  if (i === 0 || w === 0) return { line: 3, s: { r: i, c: w, v, color: GRAY, deps: [], cap: 'i == 0 或 w == 0', formula: 'k[' + i + '][' + w + '] = 0' } };
  const wt = KP[i - 1].w, p = KP[i - 1].p;
  if (wt > w) return { line: 9, s: { r: i, c: w, v, color: BLUE, deps: [{ r: i - 1, c: w, best: true }], cap: 'wt[' + i + '] = ' + wt + ' > ' + w + '：照抄上一列', formula: 'k[' + i + '][' + w + '] = k[' + (i - 1) + '][' + w + '] = ' + v } };
  const take = p + KV[i - 1][w - wt], skip = KV[i - 1][w];
  return { line: 5, s: { r: i, c: w, v, color: take > skip ? TEAL : BLUE, deps: [{ r: i - 1, c: w - wt, best: take >= skip }, { r: i - 1, c: w, best: skip > take }],
    cap: 'wt[' + i + '] = ' + wt + ' ≤ ' + w + '：取 max', formula: 'max(' + p + ' + k[' + (i - 1) + '][' + (w - wt) + '], k[' + (i - 1) + '][' + w + ']) = max(' + take + ', ' + skip + ') = ' + v } };
}
// i / w loop counters as two little characters under the code
function kpCounters(i, w) { return { I: buddy('i', i, ORANGE, -5.4, 0, 1.6, 0.6), W: buddy('w', w, BLUE, -4.1, 0, 1.6, 0.6) }; }
// fill cells (i, w) for the listed w, each quickly, with the code line lit
async function kpCells(tok, g, cd, C, i, ws, ms = 450) {
  for (const w of ws) { const { line, s } = kpStep(i, w); cd.hl(line); C.I.set(i); C.W.set(w); await playStep(g, s, tok, ms, true); }
}
const kpF = (t) => mono(tag(t, 'say', 2.5, 8.1));
FRAG.push(['dpbari3-knapp-data', '0/1 knapsack 程式：p[5]、wt[5]、k[5][9]', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  let A, g, cd;
  await step(tok);                                   // 0:48 data: profits, weights, n, m
  A = kpArrays(true);
  const I = kItems(-5.4, 0, 1.8, 1.3, 0.55);
  say('程式需要的資料', '利潤 p[]、重量 wt[]、物品數 n = 4、容量 m = 8');
  await step(tok);                                   // 0:59 four objects but size five
  for (let k = 0; k < 5; k++) A.mark(0, k, k ? '#efe6d2' : '#f0b8a8');
  say('只有 4 件物品，陣列卻開 5 格', '想從 1 開始數：第一件就叫 1');
  await step(tok);                                   // 1:12 zeroth index empty
  glow(A.get(0, 0), GOLD); glow(A.get(1, 0), GOLD);
  note('index 0 空著（填 0）', 2.0, 1.8, 0.6);
  say('index 0 空著，放 0', '');
  await step(tok);                                   // 1:18 table k[5][9]
  glow(A.get(0, 0), null); glow(A.get(1, 0), null);
  g = kpGrid();
  bub('表格 k[5][9]', 3.3, 8.1);
  say('需要一張表 k[5][9]', '5 列：0～4（4 件物品）；9 行：0～8（容量）');
  await step(tok);                                   // 1:34 columns = capacity, rows = objects, + zero row/column
  for (let k = 0; k < 9; k++) g.mark(0, k, LT); for (let k = 0; k < 5; k++) g.mark(k, 0, LT);
  say('容量多大就幾行、物品幾件就幾列', '再多加第 0 列、第 0 行');
  await step(tok);                                   // 1:45 5 rows, 9 columns
  await fling(tok, '5 × 9', V3(0.75, 7.6, 0.6), V3(5.9, 7.6, 0.6), 1000);
  say('所以是 5 列 × 9 行', '');
  await step(tok);                                   // 1:53 just a main function
  cd = code(['int main() {', '  int p[5] = {0,1,2,5,6};', '  int wt[5] = {0,2,3,4,5};', '  int m = 8, n = 4;', '  int k[5][9];', '  …', '}'], -3.6, 7.2, 0.5);
  say('全部寫在 main 裡', '這裡不需要拆成好幾個函式');
  await step(tok);                                   // 2:09 works only for this example; change values
  cd.hl(1); await beat(tok, 500); cd.hl(2);
  say('這個程式只解這一組資料', '要換題目：改值、重新編譯執行');
  await step(tok);                                   // 2:20 or read from the keyboard
  cd.hl(-1);
  note('也可以改成從鍵盤讀：幾件？容量？重量？利潤？', -3.0, 3.6, 0.6);
  I.forEach((b) => b.mood('wow'));
  say('也可以改成從鍵盤輸入', '物品數、容量、重量、利潤');
  await step(tok);                                   // 2:34 remaining part: the logic
  I.forEach((b) => b.mood('happy'));
  say('接下來只專注在核心邏輯', '');
}]);
FRAG.push(['dpbari3-knapp-row01', '0/1 knapsack 程式：追蹤第 0、1 列', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(0, false);
  let C, f;
  await step(tok);                                   // 2:38 nested for: i from 0 to n — rows
  cd.hl(0); C = kpCounters('', '');
  say('兩層 for 迴圈', 'i 從 0 到 n = 4：表的列');
  await step(tok);                                   // 2:54 w from 0 to m — columns
  cd.hl(1);
  say('w 從 0 到 m = 8：表的行', '');
  await step(tok);                                   // 3:00 trace: i = 0, w = 0
  C.I.set(0); C.W.set(0); glow(g.plates['0,0'], GOLD);
  say('開始追蹤：i = 0、w = 0', '');
  await step(tok);                                   // 3:24 if i == 0 || w == 0 is true; three cases
  cd.hl(2);
  note('三種情況：① if　② else if　③ else', -3.6, 2.4, 0.6);
  say('if (i == 0 || w == 0) 成立', '程式共有三種情況');
  await step(tok);                                   // 3:29 k[0][0] = 0
  await kpCells(tok, g, cd, C, 0, [0], 600);
  say('k[0][0] = 0', '');
  await step(tok);                                   // 3:46 w = 1: k[0][1] = 0
  await kpCells(tok, g, cd, C, 0, [1], 600);
  say('w 移到 1：i 還是 0 → 0', '');
  await step(tok);                                   // 3:56 w = 2 … 8: all zeros
  await kpCells(tok, g, cd, C, 0, [2, 3, 4, 5, 6, 7, 8], 300);
  say('w = 2 … 8：i 一直是 0', '整個第 0 列都是 0');
  await step(tok);                                   // 4:16 i++ → i = 1: first object
  cd.hl(0); C.I.set(1); C.I.mood('wow');
  glow(g.plates['0,0'], null);
  say('內圈結束，i++ → i = 1', '開始考慮物品 1（p = 1、wt = 2）');
  await step(tok);                                   // 4:23 w = 0 → first condition → 0
  await kpCells(tok, g, cd, C, 1, [0], 600);
  say('w = 0：還是第一種情況 → 0', '');
  await step(tok);                                   // 4:34 w = 1: wt[1] = 2 ≤ 1? no
  cd.hl(4); C.W.set(1); glow(g.plates['1,1'], GOLD);
  f = kpF('wt[1] = 2 ≤ 1 ？ 不成立');
  say('w = 1：第一種不成立', '檢查 wt[1] ≤ w：2 ≤ 1？不成立');
  await step(tok);                                   // 4:59 else: k[1][1] = k[0][1] = 0
  glow(g.plates['1,1'], null); txt(f, 'else：k[1][1] = k[0][1] = 0');
  await kpCells(tok, g, cd, C, 1, [1], 900);
  say('走 else：照抄上一列同一行', 'k[1][1] = k[0][1] = 0');
  await step(tok);                                   // 5:24 w = 2: wt[1] ≤ 2 true
  g.clearArrows(); g.unglow(); cd.hl(4); C.W.set(2);
  txt(f, 'wt[1] = 2 ≤ 2 ？ 成立 ✓');
  say('w = 2：wt[1] = 2 ≤ 2 成立', '走第二種情況');
  await step(tok);                                   // 5:39 the formula: max(p[1] + k[0][0], k[0][2])
  cd.hl(5); txt(f, 'k[1][2] = max( p[1] + k[0][2−2] , k[0][2] )');
  g.arrow(0, 0, 1, 2, OKC); g.arrow(0, 2, 1, 2, TRY); glow(g.get(0, 0), GREEN); glow(g.get(0, 2), GOLD);
  say('k[1][2] = max(p[1] + k[0][0], k[0][2])', '放物品 1 vs 不放');
  await step(tok);                                   // 6:44 1 + 0 vs 0 → 1
  txt(f, 'k[1][2] = max( 1 + 0 , 0 ) = 1');
  await kpCells(tok, g, cd, C, 1, [2], 900);
  say('max(1 + 0, 0) = 1', '');
  await step(tok);                                   // 7:06 w = 3: max(1 + k[0][1], k[0][3]) = 1
  txt(f, 'k[1][3] = max( 1 + k[0][1] , k[0][3] ) = max( 1 , 0 ) = 1');
  await kpCells(tok, g, cd, C, 1, [3], 1100);
  say('w = 3：max(1 + 0, 0) = 1', '');
  await step(tok);                                   // 7:34 all this row → 1
  await kpCells(tok, g, cd, C, 1, [4, 5, 6, 7, 8], 360);
  g.clearArrows(); g.unglow(); C.I.mood('happy');
  txt(f, '第 1 列之後都是 1');
  say('之後每次都走第二種情況', '這一列都是 1');
}]);
FRAG.push(['dpbari3-knapp-row2', '0/1 knapsack 程式：追蹤第 2 列', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(2, false);
  const C = kpCounters(2, 0);
  let f;
  await step(tok);                                   // 7:45 i = 2, w = 0 → 0
  await kpCells(tok, g, cd, C, 2, [0], 600);
  say('i = 2：物品 2（p = 2、wt = 3）', 'w = 0 → 0');
  await step(tok);                                   // 8:04 w = 1: 3 ≤ 1? no → else → 0
  f = kpF('wt[2] = 3 ≤ 1 ？ 不成立 → else');
  await kpCells(tok, g, cd, C, 2, [1], 900);
  say('w = 1：3 ≤ 1 不成立', '走 else，照抄上一列：0');
  await step(tok);                                   // 8:26 w = 2 → 1; w = 3 equal → second part
  txt(f, 'w = 2：照抄 → 1');
  await kpCells(tok, g, cd, C, 2, [2], 700);
  g.clearArrows(); g.unglow(); C.W.set(3); cd.hl(4);
  txt(f, 'w = 3：wt[2] = 3 ≤ 3 ✓ → 第二種');
  say('w = 2 照抄 1', 'w = 3：重量相等，走第二種');
  await step(tok);                                   // 8:41 k[2][3] = max(p[2] + k[1][0], k[1][3])
  cd.hl(5); txt(f, 'k[2][3] = max( p[2] + k[1][3−3] , k[1][3] )');
  g.arrow(1, 0, 2, 3, OKC); g.arrow(1, 3, 2, 3, TRY); glow(g.get(1, 0), GREEN); glow(g.get(1, 3), GOLD);
  say('k[2][3] = max(p[2] + k[1][0], k[1][3])', '');
  await step(tok);                                   // 9:05 max(2 + 0, 1) = 2
  txt(f, 'k[2][3] = max( 2 + 0 , 1 ) = 2');
  await kpCells(tok, g, cd, C, 2, [3], 900);
  say('max(2 + 0, 1) = 2', '放物品 2 比較好');
  await step(tok);                                   // 9:17 next value also 2
  txt(f, 'w = 4：max( 2 + k[1][1] , k[1][4] ) = max( 2 , 1 ) = 2');
  await kpCells(tok, g, cd, C, 2, [4], 900);
  say('w = 4 也是 2', '');
  await step(tok);                                   // 9:26 w = 5: this changes
  g.clearArrows(); g.unglow(); C.W.set(5); C.W.mood('wow');
  txt(f, 'k[2][5] = max( p[2] + k[1][5−3] , k[1][5] )');
  say('w = 5：這裡會不一樣', '');
  await step(tok);                                   // 9:43 2 + k[1][2] = 1, k[1][5] = 1 → 3
  txt(f, 'k[2][5] = max( 2 + 1 , 1 ) = 3');
  await kpCells(tok, g, cd, C, 2, [5], 1100);
  say('max(2 + k[1][2], k[1][5])', '= max(2 + 1, 1) = 3');
  await step(tok);                                   // 10:01 capacity 5: both objects (2 + 3)
  g.clearArrows(); g.unglow(); glow(g.get(2, 5), GREEN);
  C.W.mood('happy'); await C.W.hop(tok);
  txt(f, '容量 5：物品 1、2 都放（重 2 + 3 = 5）');
  say('容量 5：兩件都放得下', '重 2 + 3 = 5，利潤 1 + 2 = 3');
  await step(tok);                                   // 10:20 rest 3 3 3
  glow(g.get(2, 5), null);
  await kpCells(tok, g, cd, C, 2, [6, 7, 8], 500);
  g.clearArrows(); g.unglow();
  txt(f, '之後都是 3');
  say('剩下的都是 3', '');
}]);
FRAG.push(['dpbari3-knapp-row34', '0/1 knapsack 程式：第 3、4 列與答案', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(3, false);
  const C = kpCounters(3, 0);
  let f;
  await step(tok);                                   // 10:26 i = 3: till weight 4 copy previous row
  await kpCells(tok, g, cd, C, 3, [0, 1, 2, 3], 450);
  f = kpF('i = 3：物品 3（p = 5、wt = 4）');
  say('i = 3：物品 3 重 4', '容量 4 以前照抄上一列');
  await step(tok);                                   // 10:34 here it can be included → 5, next 5
  await kpCells(tok, g, cd, C, 3, [4, 5], 900);
  say('容量 4 放得下 → 5', '容量 5 也是 5');
  await step(tok);                                   // 10:41 k[3][6] = max(p[3] + k[2][2], k[2][6])
  g.clearArrows(); g.unglow(); C.W.set(6); cd.hl(5);
  txt(f, 'k[3][6] = max( p[3] + k[2][6−4] , k[2][6] )');
  g.arrow(2, 2, 3, 6, OKC); g.arrow(2, 6, 3, 6, TRY); glow(g.get(2, 2), GREEN); glow(g.get(2, 6), GOLD);
  say('k[3][6] = max(p[3] + k[2][2], k[2][6])', '6 − 4 = 2');
  await step(tok);                                   // 11:25 5 + 1 vs 3 → 6
  txt(f, 'k[3][6] = max( 5 + 1 , 3 ) = 6');
  await kpCells(tok, g, cd, C, 3, [6], 900);
  say('max(5 + 1, 3) = 6', '');
  await step(tok);                                   // 11:34 capacity 6: two objects
  g.clearArrows(); g.unglow(); glow(g.get(3, 6), GREEN);
  txt(f, '容量 6：物品 1 + 物品 3（重 2 + 4、利潤 1 + 5）');
  say('容量 6：放兩件物品得到 6', '物品 1（w2、p1）＋ 物品 3（w4、p5）');
  await step(tok);                                   // 11:50 k[3][7] = max(5 + k[2][3], k[2][7]) = 7
  glow(g.get(3, 6), null); C.W.set(7);
  txt(f, 'k[3][7] = max( 5 + k[2][3] , k[2][7] ) = max( 5 + 2 , 3 ) = 7');
  await kpCells(tok, g, cd, C, 3, [7], 1200);
  say('k[3][7] = max(5 + 2, 3) = 7', '');
  await step(tok);                                   // 12:19 capacity 7: objects 2, 3 (3 + 4); rest 7
  g.clearArrows(); g.unglow();
  txt(f, '容量 7：物品 2 + 物品 3（重 3 + 4、利潤 2 + 5）');
  await kpCells(tok, g, cd, C, 3, [8], 700);
  g.clearArrows(); g.unglow();
  say('容量 7：物品 2、3（重 3 + 4）', '利潤 7；容量 8 也是 7');
  await step(tok);                                   // 12:37 fourth row: weight 5
  C.I.set(4); C.I.mood('wow');
  txt(f, 'i = 4：物品 4（p = 6、wt = 5）— 不用公式直接填');
  say('第 4 列：物品 4 重 5', 'w ≥ 1 時只會走第二或第三種情況');
  await step(tok);                                   // 12:45 till 5 as it is; 5 → 6; 6 → 6
  await kpCells(tok, g, cd, C, 4, [0, 1, 2, 3, 4, 5, 6], 300);
  g.clearArrows(); g.unglow();
  say('容量 5 以前照抄', '容量 5、6 → 6');
  await step(tok);                                   // 12:56 at 7: these two → 7
  await kpCells(tok, g, cd, C, 4, [7], 800);
  g.clearArrows(); g.unglow();
  say('容量 7：物品 1、4 → 1 + 6 = 7', '');
  await step(tok);                                   // 13:04 at 8: 5 and 3 → 8
  await kpCells(tok, g, cd, C, 4, [8], 800);
  g.clearArrows(); g.unglow(); C.I.mood('happy');
  say('容量 8：物品 2、4（重 3 + 5）', '利潤 2 + 6 = 8');
  await step(tok);                                   // 13:13 cout << k[n][m] = 8
  glow(g.get(4, 8), GREEN);
  txt(f, 'cout << k[n][m];   // k[4][8] = 8');
  await C.I.hop(tok);
  say('cout << k[n][m]', 'k[4][8] = 8：最大利潤');
}]);
FRAG.push(['dpbari3-knapp-trace', '0/1 knapsack 程式：while 迴圈印出 x', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(['i = n; j = m;', 'while (i > 0 && j > 0) {', ' if (k[i][j] == k[i-1][j]) {', '   cout << i << " = 0";', '   i--;', ' } else {', '   cout << i << " = 1";', '   j = j - wt[i]; i--;', ' }', '}'], -3.6, 7.4, 0.48);
  const g = kpBuild(5, false);
  const I = buddy('i', 4, ORANGE, -5.4, 0, 1.6, 0.6), J = buddy('j', 8, BLUE, -4.1, 0, 1.6, 0.6);
  const outs = [];
  const print = (i, v) => outs.push(mono(tag(i + ' = ' + v, v ? 'good' : 'bad', 5.4 - outs.length * 1.2, 1.3)));
  const look = (i, j) => { g.unglow(); glow(g.get(i, j), GOLD); glow(g.get(i - 1, j), GOLD); };
  await step(tok);                                   // 13:33 i = n, j = m → (4, 8)
  cd.hl(0); look(4, 8);
  say('哪些物品放了？', '從 i = n = 4、j = m = 8 開始');
  await step(tok);                                   // 13:50 if k[i][j] == k[i−1][j]
  cd.hl(2);
  say('如果 k[i][j] == k[i−1][j]', '這個值上一列就有了');
  await step(tok);                                   // 14:11 8 not in the row above → 4th included
  g.mark(3, 8, '#f0d0c8');
  say('8 和上面的 7 不一樣', '8 是放了物品 4 才得到的');
  await step(tok);                                   // 14:21 if equal → not included: cout i = 0
  g.mark(3, 8, '#efe6d2'); cd.hl(3);
  say('相等 → 第 i 件沒放', '印出「i = 0」');
  await step(tok);                                   // 14:43 i−−, weight stays the same
  cd.hl(4);
  say('然後 i−−，看上一件', '重量 j 不變');
  await step(tok);                                   // 14:50 else: included → cout i = 1
  cd.hl(6);
  say('不相等 → 第 i 件有放', '印出「i = 1」');
  await step(tok);                                   // 15:07 j = j − wt[i]; i−−
  cd.hl(7);
  say('有放就要扣掉它的重量', 'j = j − wt[i]，再 i−−');
  await step(tok);                                   // 15:45 while i > 0 && j > 0
  cd.hl(1);
  say('一直做到 i 或 j 變成 0', 'while (i > 0 && j > 0)');
  await step(tok);                                   // 15:57 4th included; 8 − 5 = 3 → (3, 3)
  cd.hl(7); print(4, 1); g.mark(4, 8, LG);
  J.set(3); I.set(3); I.mood('happy'); await I.hop(tok); look(3, 3);
  say('物品 4 有放：印 4 = 1', 'j = 8 − 5 = 3，i = 3 → 看 k[3][3]');
  await step(tok);                                   // 16:09 k[3][3] = 2 = k[2][3] → 3rd not included
  cd.hl(3); print(3, 0); g.mark(3, 3, LT);
  I.set(2); look(2, 3);
  say('k[3][3] = 2 = k[2][3]', '物品 3 沒放：印 3 = 0，i = 2');
  await step(tok);                                   // 16:15 k[2][3] = 2 ≠ 1 → included, j = 0
  cd.hl(7); print(2, 1); g.mark(2, 3, LG);
  J.set(0); I.set(1); g.unglow();
  say('k[2][3] = 2 ≠ k[1][3] = 1', '物品 2 有放：印 2 = 1，j = 3 − 3 = 0');
  await step(tok);                                   // 16:27 → objects 2 and 4 included
  cd.hl(1); J.mood('sad');
  note('j = 0 → 迴圈停；物品 1 沒印 → 也是 0', 2.6, 0.6, 0.6);
  say('j 變成 0，迴圈結束', '放了物品 2 和物品 4（x = 0 1 0 1）');
  await step(tok);                                   // 16:34 loop from the last row to row 0: code is important
  cd.hl(-1);
  say('用迴圈從最後一列往第 0 列走', '就能找出哪些物品放了；重點是程式碼');
}]);

// ════════════════ XaXsJJh-Q5Y / Q4zHb-Swzro：TSP ════════════════
const CM = [[0, 10, 15, 20], [5, 0, 9, 10], [6, 13, 0, 12], [8, 8, 9, 0]];
const cm = (a, b) => CM[a - 1][b - 1];
const TP = { 1: [-5.8, 7.0], 2: [-2.6, 7.0], 3: [-2.6, 3.8], 4: [-5.8, 3.8] };
function tspGraph(drop) {
  const T = { node: {}, edge: {} };
  for (let a = 1; a <= 4; a++) for (let b = a + 1; b <= 4; b++) T.edge[a + '-' + b] = rod(V3(TP[a][0], TP[a][1], -0.05), V3(TP[b][0], TP[b][1], -0.05), SAND, 0.03);
  for (let v = 1; v <= 4; v++) T.node[v] = cube(v, v === 1 ? PURPLE : BLUE, [0.6, 0.55, 0.5], TP[v][0], TP[v][1], 0, drop ? 1.4 : 0);
  T.e = (a, b) => T.edge[Math.min(a, b) + '-' + Math.max(a, b)];
  return T;
}
function tspMatrix(drop) {
  const M = grid({ rows: 4, cols: 4, cw: 0.85, ch: 0.62, x0: 2.4, y0: 6.6, colHdr: [1, 2, 3, 4], rowHdr: [1, 2, 3, 4], rowDx: 0.2 });
  tag('c(i, j)：i → j', 'ptr', 3.7, 7.75);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) M.set(i, j, CM[i][j], i === j ? GRAY : ORANGE, drop ? 1.2 : 0);
  return M;
}
// the salesperson walks the graph
const sales = (v) => buddy('推銷員', '', '#f3d27a', TP[v][0], TP[v][1] + 0.3, 0.6, 0.45);
const salesTo = (tok, s, v, ms = 600) => slide(tok, s.g, TP[v][0], ms, TP[v][1] + 0.3, 0.6);
FRAG.push(['dpbari3-tsp-problem', 'TSP：成本矩陣與旅行路線', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 4.8, 0]);
  let T, M, S;
  await step(tok);                                   // 0:01 TSP; solve with DP formula
  bub('Traveling Salesperson Problem（旅行推銷員問題）', 0, 8.2);
  say('旅行推銷員問題（TSP）', '用 DP 的公式來解');
  await step(tok);                                   // 0:12 weighted directed graph + cost matrix
  T = tspGraph(true); M = tspMatrix(true);
  say('有向加權圖，和它的成本矩陣', 'c(i, j)：從 i 走到 j 的成本');
  await step(tok);                                   // 0:20 bi-directional edge = parallel edges
  tint(T.e(1, 2), ORANGE);
  note('一條雙向邊 = 兩條方向相反的邊', -4.2, 8.0);
  say('圖上一條雙向邊其實是兩條平行邊', '為了不畫太多線才合成一條');
  await step(tok);                                   // 0:33 1→2 = 10, 2→1 = 5
  glow(M.get(0, 1), GOLD); glow(M.get(1, 0), GOLD);
  await fling(tok, '1→2：10', V3(TP[1][0], 7.6, 0.5), V3(TP[2][0], 7.6, 0.5), 700);
  await fling(tok, '2→1：5', V3(TP[2][0], 6.4, 0.5), V3(TP[1][0], 6.4, 0.5), 700);
  say('1→2 是 10，2→1 是 5', '');
  await step(tok);                                   // 0:43 costs may differ
  say('兩個方向的成本可能不一樣', '這題就不一樣');
  await step(tok);                                   // 0:49 select a starting vertex
  M.unglow(); tint(T.e(1, 2), SAND);
  S = sales(1); glow(T.node[1], GOLD);
  say('先選一個頂點當起點', '例如頂點 1');
  await step(tok);                                   // 0:53 through all vertices and back: a cycle
  const tour = [1, 2, 3, 4, 1];
  for (let k = 1; k < tour.length; k++) { tint(T.e(tour[k - 1], tour[k]), ORANGE); await salesTo(tok, S, tour[k], 500); }
  S.mood('happy');
  say('經過所有頂點，再回到起點', '形成一個 cycle（環）');
}]);
FRAG.push(['dpbari3-tsp-problem2', 'TSP：問題回顧', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 4.8, 0]);
  let T, M, S;
  await step(tok);                                   // 0:00 same example; formula at every step
  T = tspGraph(true);
  bub('同一個例子：這次每一步都用公式', 0, 8.2);
  say('同一題 TSP', '這次每一步都用公式來做');
  await step(tok);                                   // 0:18 directed weighted graph: every edge has weight
  Object.values(T.edge).forEach((e) => tint(e, ORANGE));
  say('有向加權圖', '每條邊都有權重（成本）');
  await step(tok);                                   // 0:25 parallel edges shown as one bidirectional
  Object.values(T.edge).forEach((e) => tint(e, SAND)); tint(T.e(1, 2), ORANGE);
  note('1→2、2→1 兩條邊，畫成一條雙向邊', -4.2, 8.0);
  say('1→2、2→1 其實是兩條邊', '畫成一條雙向邊');
  await step(tok);                                   // 0:38 cost adjacency matrix
  tint(T.e(1, 2), SAND); M = tspMatrix(true);
  say('這是它的成本鄰接矩陣', '');
  await step(tok);                                   // 0:45 start from some vertex, travel all others
  S = sales(1); glow(T.node[1], GOLD);
  for (const [a, b] of [[1, 2], [2, 4], [4, 3]]) { tint(T.e(a, b), ORANGE); await salesTo(tok, S, b, 450); }
  say('從某個頂點出發', '其他每個頂點都走過一次');
  await step(tok);                                   // 0:50 return to the same starting vertex
  tint(T.e(3, 1), ORANGE); await salesTo(tok, S, 1, 600);
  say('最後回到同一個起點', '');
  await step(tok);                                   // 0:55 the cost must be minimum
  S.mood('happy');
  good('旅行成本要最小', -4.2, 2.8, 0.6);
  say('而且旅行成本要最小', '這就是旅行推銷員問題');
}]);
// brute-force 路線樹（XaXsJJh-Q5Y 1:05–7:45）
const TR = [[2, 3, 4], [2, 4, 3], [3, 2, 4], [3, 4, 2], [4, 2, 3], [4, 3, 2]];
const LXS = [-5, -3, -1, 1, 3, 5], TY = [7.4, 6.1, 4.8, 3.5, 2.2];
function bfTree() {
  const N = { root: { v: 1, x: 0, y: TY[0] }, l1: [], l2: [], l3: [], l4: [] };
  [2, 3, 4].forEach((v, a) => N.l1.push({ v, x: (LXS[2 * a] + LXS[2 * a + 1]) / 2, y: TY[1], par: N.root, kids: [] }));
  TR.forEach((r, k) => {
    const p1 = N.l1[Math.floor(k / 2)];
    const n2 = { v: r[1], x: LXS[k], y: TY[2], par: p1 }; p1.kids.push(n2); N.l2.push(n2);
    const n3 = { v: r[2], x: LXS[k], y: TY[3], par: n2 }; n2.kid = n3; N.l3.push(n3);
    N.l4.push({ v: 1, x: LXS[k], y: TY[4], par: n3 });
  });
  N.l3.forEach((n) => { n.val = cm(n.v, 1); });
  N.l2.forEach((n) => { n.val = cm(n.v, n.kid.v) + n.kid.val; });
  N.l1.forEach((n) => { n.cands = n.kids.map((c) => cm(n.v, c.v) + c.val); n.val = Math.min(...n.cands); });
  N.root.cands = N.l1.map((c) => cm(1, c.v) + c.val); N.root.val = Math.min(...N.root.cands);
  return N;
}
function bfDraw(n, drop) {
  n.m = cube(n.v, n.v === 1 ? PURPLE : BLUE, [0.55, 0.48, 0.45], n.x, n.y, 0, drop ? 1.1 : 0);
  if (n.par) n.e = rod(V3(n.par.x, n.par.y - 0.25, -0.05), V3(n.x, n.y + 0.25, -0.05), SAND, 0.024);
  n.t = tag('', 'ptr alt', n.x + 0.66, n.y, 0.2); showL(n.t, false);
  return n;
}
const bfVal = (n, v) => { txt(n.t, String(v)); showL(n.t, true); };
function bfAll(N, drop) { [N.root, ...N.l1, ...N.l2, ...N.l3, ...N.l4].forEach((n) => bfDraw(n, drop)); }
const bfF = (t) => mono(tag(t, 'say', 0, 0.9, 0.6));
FRAG.push(['dpbari3-tsp-tree', 'TSP 暴力法：從 1 出發的所有路線', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree();
  await step(tok);                                   // 1:06 DP: try all, pick best
  const D = buddy('DP', '', TEAL, 5.6, 0, 1.4, 0.7);
  say('DP：試遍所有可能，再挑最好的', '全部試很花時間，但 DP 有簡單的辦法');
  await step(tok);                                   // 1:17 trying all = brute force
  bub('試遍所有可能 = brute force（暴力法）', 3.4, 1.4, 1.4);
  D.mood('wow');
  say('試遍所有可能，其實就是暴力法', '先看暴力法，再看 DP 怎麼變簡單');
  await step(tok);                                   // 1:35 start from 1
  bfDraw(N.root, true);
  say('起點選 1', '');
  await step(tok);                                   // 1:41 go to 2, 3 or 4
  N.l1.forEach((n) => bfDraw(n, true));
  say('下一站：2、3 或 4', '');
  await step(tok);                                   // 1:50 after 2: 3 or 4 …
  N.l2.forEach((n) => bfDraw(n, true));
  say('選 2 剩 3、4；選 3 剩 2、4；選 4 剩 2、3', '每一層少一個可選的點');
  await step(tok);                                   // 2:05 then only one vertex left
  N.l3.forEach((n) => bfDraw(n, true));
  say('再下一站之後，只剩一個點', '');
  await step(tok);                                   // 2:19 possible routes
  for (const k of [0, 3]) {
    const path = [N.root, N.l2[k].par, N.l2[k], N.l3[k]];
    path.forEach((n) => { if (n.e) tint(n.e, ORANGE); glow(n.m, GOLD); });
    await beat(tok, 1000);
    path.forEach((n) => { if (n.e) tint(n.e, SAND); glow(n.m, null); });
  }
  say('這些就是推銷員可能走的路線', '例：1-2-3-4、1-3-4-2……');
  await step(tok);                                   // 2:40 return to the starting vertex 1
  N.l4.forEach((n) => bfDraw(n, true));
  say('最後都要回到起點 1', '共 3! = 6 條路線');
}]);
FRAG.push(['dpbari3-tsp-bottom', 'TSP 暴力法：從樹的底層往上算成本', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree(); bfAll(N, false);
  let f;
  const back = (k) => { tint(N.l4[k].e, ORANGE); bfVal(N.l3[k], N.l3[k].val); glow(N.l3[k].m, GOLD); };
  const two = (k) => { const n = N.l2[k]; N.l3.forEach((m) => glow(m.m, null)); tint(n.kid.e, ORANGE); glow(n.m, GOLD); bfVal(n, n.val); txt(f, '在 ' + n.v + '：' + n.v + '→' + n.kid.v + '→1 = ' + cm(n.v, n.kid.v) + ' + ' + n.kid.val + ' = ' + n.val); };
  await step(tok);                                   // 2:52 need cost of all routes; solve from bottom
  f = bfF('從最下面開始算');
  say('要知道每條路線的成本：問題很大', '從樹的底部開始算');
  await step(tok);                                   // 3:04 on 4: return to 1 costs 8
  back(0); txt(f, '在 4：回到 1 = c(4,1) = 8');
  say('推銷員在頂點 4', '只能回到 1：成本 8');
  await step(tok);                                   // 3:22 on 3: 6; 4: 8; 2: 5
  glow(N.l3[0].m, null); back(1); await beat(tok, 350); back(2); await beat(tok, 350); back(3);
  txt(f, '3→1 = 6、4→1 = 8、2→1 = 5');
  say('在 3 回到 1 是 6、在 4 是 8', '在 2 回到 1 是 5');
  await step(tok);                                   // 3:30 3 is 6, 2 is 5
  back(4); await beat(tok, 350); back(5);
  say('剩下兩個也一樣：6、5', '回到起點的成本都寫好了');
  await step(tok);                                   // 3:42 on 3: 3→4→1 = 12 + 8 = 20
  two(0);
  say('在 3、還要去 4 再回 1', '12 + 8 = 20');
  await step(tok);                                   // 4:14 on 4: 4→3→1 = 9 + 6 = 15
  glow(N.l2[0].m, null); two(1);
  say('在 4、去 3 再回 1', '9 + 6 = 15');
  await step(tok);                                   // 4:25 on 2: 2→4→1 = 10 + 8 = 18
  glow(N.l2[1].m, null); two(2);
  say('在 2、去 4 再回 1', '10 + 8 = 18');
  await step(tok);                                   // 4:45 on 4: 4→2→1 = 8 + 5 = 13
  glow(N.l2[2].m, null); two(3);
  say('在 4、去 2 再回 1', '8 + 5 = 13');
  await step(tok);                                   // 4:55 on 2: 2→3→1 = 9 + 6 = 15
  glow(N.l2[3].m, null); two(4);
  say('在 2、去 3 再回 1', '9 + 6 = 15');
  await step(tok);                                   // 5:08 on 3: 3→2→1 = 13 + 5 = 18
  glow(N.l2[4].m, null); two(5);
  say('在 3、去 2 再回 1', '13 + 5 = 18');
  await step(tok);                                   // 5:25 started from the bottom
  glow(N.l2[5].m, null);
  txt(f, '20、15、18、13、15、18：剩一個點要走的成本');
  say('從底部一層一層往上算', '「在某點、還剩一個點」的成本都知道了');
}]);
FRAG.push(['dpbari3-tsp-up', 'TSP 暴力法：取最小值一路算回起點 → 35', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree(); bfAll(N, false);
  [...N.l3, ...N.l2].forEach((n) => bfVal(n, n.val));
  const f = bfF('再往上一層');
  const cand = (n) => n.kids.map((c, k) => cm(n.v, c.v) + ' + ' + c.val).join('，');
  const pick = (n) => { n.kids.forEach((c, k) => tint(c.e, n.cands[k] === n.val ? TEAL : GRAY)); bfVal(n, n.val); };
  await step(tok);                                   // 5:31 one level up: on vertex 2
  glow(N.l1[0].m, GOLD);
  say('再往上一層：推銷員在 2', '');
  await step(tok);                                   // 5:39 remaining 3, 4: two orders, take min
  N.l1[0].kids.forEach((c) => tint(c.e, ORANGE));
  txt(f, '在 2、剩 3 和 4：先 3 再 4，或先 4 再 3');
  say('剩 3、4：可以先 3 或先 4', '兩條取最小');
  await step(tok);                                   // 5:55 9 + 20, 10 + 15
  txt(f, '在 2：' + cand(N.l1[0]));
  say('2→3：9 + 20；2→4：10 + 15', '');
  await step(tok);                                   // 6:08 minimum 25
  pick(N.l1[0]); glow(N.l1[0].m, null);
  txt(f, '在 2：min(29, 25) = 25');
  say('min(29, 25) = 25', '');
  await step(tok);                                   // 6:17 on 3: 13 + 18, 12 + 13
  glow(N.l1[1].m, GOLD); N.l1[1].kids.forEach((c) => tint(c.e, ORANGE));
  txt(f, '在 3：' + cand(N.l1[1]));
  say('在 3：3→2 是 13 + 18', '3→4 是 12 + 13');
  await step(tok);                                   // 6:32 31 and 25 → 25
  pick(N.l1[1]); glow(N.l1[1].m, null);
  txt(f, '在 3：min(31, 25) = 25');
  say('min(31, 25) = 25', '');
  await step(tok);                                   // 6:45 on 4: 8 + 15, 9 + 18 → 23
  glow(N.l1[2].m, GOLD); pick(N.l1[2]);
  txt(f, '在 4：min(8 + 15, 9 + 18) = min(23, 27) = 23');
  say('在 4：8 + 15 = 23、9 + 18 = 27', '取 23');
  await step(tok);                                   // 6:57 root: 10 + 25, 15 + 25, 20 + 23
  glow(N.l1[2].m, null); glow(N.root.m, GOLD);
  N.l1.forEach((c) => tint(c.e, ORANGE));
  txt(f, '在 1：10 + 25，15 + 25，20 + 23');
  say('起點 1：1→2 是 10 + 25', '1→3 是 15 + 25、1→4 是 20 + 23');
  await step(tok);                                   // 7:31 35 40 43 → 35
  N.l1.forEach((c, k) => tint(c.e, N.root.cands[k] === N.root.val ? TEAL : GRAY)); bfVal(N.root, N.root.val);
  txt(f, 'min(35, 40, 43) = 35');
  say('35、40、43 → 最小 35', '最短旅行路線的成本是 35');
  await step(tok);                                   // 7:44 that was brute force; now DP
  glow(N.root.m, GREEN);
  say('以上是暴力法', '接著看 DP 怎麼做');
}]);
// g(1,{2,3,4}) 公式（兩支影片各一份：步數不同）
function gFormulaTree() {
  const root = cube('g(1,{2,3,4})', PURPLE, [2.4, 0.6, 0.5], 0, 6.8, 0, 1.4);
  const ks = [2, 3, 4], xs = [-4.4, 0, 4.4];
  const kids = ks.map((k, a) => ({ k, rest: ks.filter((v) => v !== k), x: xs[a] }));
  const show = (o) => { rod(V3(0, 6.5, -0.05), V3(o.x, 4.75, -0.05), ORANGE, 0.03); o.m = cube('c(1,' + o.k + ') + g(' + o.k + ',{' + o.rest.join(',') + '})', BLUE, [2.9, 0.6, 0.5], o.x, 4.4, 0, 1.2); };
  return { root, kids, show };
}
FRAG.push(['dpbari3-tsp-formula', 'TSP：g(i, S) 遞迴公式', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  let F, f;
  await step(tok);                                   // 7:50 the idea of the formula
  f = mono(tag('g( 1 , {2,3,4} ) = ?', 'say', 0, 8.0));
  say('從暴力法可以看出公式', '');
  await step(tok);                                   // 8:03 start 1, remaining 2, 3, 4
  F = gFormulaTree();
  say('g(1, {2,3,4})：從 1 出發', '還要走過 2、3、4，最後回到 1');
  await step(tok);                                   // 8:20 c(1,k) + cost from k to the rest
  F.show(F.kids[0]);
  say('先走到某個 k：c(1, k)', '再加上「從 k 走完剩下的點」的成本');
  await step(tok);                                   // 8:45 subtract k; try every k
  F.show(F.kids[1]); await beat(tok, 500); F.show(F.kids[2]);
  say('走過的 k 要從集合拿掉', 'k = 2、3、4 每一個都試');
  await step(tok);                                   // 9:00 k ∈ {2,3,4}
  txt(f, 'g(1,{2,3,4}) = min over k∈{2,3,4} { c(1,k) + g(k, {2,3,4} − {k}) }');
  say('三種 k 取最小', 'k ∈ {2, 3, 4}');
  await step(tok);                                   // 9:13 formula for start 1, four vertices
  note('這是「起點 1、共 4 個頂點」的版本', 0, 2.8);
  say('這是起點 1、4 個頂點時的式子', '');
  await step(tok);                                   // 9:27 general formula g(i, S)
  const gen = mono(tag('g(i, S) = min over k∈S { c(i,k) + g(k, S − {k}) }', 'good', 0, 2.0));
  say('一般式', 'g(i, S) = min over k∈S { c(i,k) + g(k, S − {k}) }');
  await step(tok);                                   // 9:47 the general formula of DP
  F.kids.forEach((o) => tint(o.m, TEAL));
  say('這就是 DP 用的一般公式', '接下來看 DP 怎麼用它算');
}]);
FRAG.push(['dpbari3-tsp-formula2', 'TSP：公式 g(1, {2,3,4})', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  let F, f;
  await step(tok);                                   // 1:11 DP formula, general form
  f = mono(tag('g(i, S) = min over k∈S { c(i,k) + g(k, S − {k}) }', 'say', 0, 8.0));
  say('這是 DP 的公式（一般式）', '');
  await step(tok);                                   // 1:19 write it for these four vertices
  txt(f, 'g( 1 , {2,3,4} ) = ?');
  say('先依照這個 4 個頂點的圖寫出來', '');
  await step(tok);                                   // 1:24 cost function g; start 1, visit 2,3,4
  F = gFormulaTree();
  say('成本函式叫 g', '起點 1，還要走 2、3、4');
  await step(tok);                                   // 1:43 from 1 go to any k in the set
  F.show(F.kids[0]); await beat(tok, 400); F.show(F.kids[1]); await beat(tok, 400); F.show(F.kids[2]);
  say('從 1 可以走到集合裡任一個 k', '2、3 或 4');
  await step(tok);                                   // 2:00 c(1,k) + g(k, {2,3,4} − {k})
  txt(f, 'g(1,{2,3,4}) = min_k { c(1,k) + g(k, {2,3,4} − {k}) }');
  say('c(1, k) + g(k, 集合 − {k})', '');
  await step(tok);                                   // 2:15 any order: try all, take min
  F.kids.forEach((o) => glow(o.m, GOLD));
  say('剩下的點順序隨意', '所有可能都試，取最小');
  await step(tok);                                   // 2:36 subtract the chosen vertex
  F.kids.forEach((o) => glow(o.m, null));
  note('走到 k → 從集合拿掉 k', 0, 2.8);
  say('走到哪個點，就把它從集合拿掉', '');
  await step(tok);                                   // 2:41 the formula is recursive
  good('遞迴：g 用更小集合的 g 來定義', 0, 2.0);
  say('這個公式是遞迴的', '集合每次少一個點');
}]);
// 依 |S| 填表（XaXsJJh-Q5Y 10:00–15:25）
const gF = (S) => (S.length ? '{' + S.join(',') + '}' : '∅');
function gval(i, S) { if (!S.length) return cm(i, 1); return Math.min(...S.map((k) => cm(i, k) + gval(k, S.filter((v) => v !== k)))); }
const GT = [
  [[2, []], [3, []], [4, []]],
  [[2, [3]], [2, [4]], [3, [2]], [3, [4]], [4, [2]], [4, [3]]],
  [[2, [3, 4]], [3, [2, 4]], [4, [2, 3]]],
  [[1, [2, 3, 4]]],
];
const GX = [-5.2, -1.8, 1.7, 5.1];
function gEntry(i, S) {
  if (!S.length) return { formula: 'g(' + i + ',∅) = c(' + i + ',1) = ' + cm(i, 1), deps: [] };
  const parts = S.map((k) => ({ k, rest: S.filter((v) => v !== k) })).map((o) => ({ ...o, v: cm(i, o.k) + gval(o.k, o.rest) }));
  return { formula: (S.length > 1 ? 'min(' : '') + parts.map((o) => cm(i, o.k) + '+' + gval(o.k, o.rest)).join(', ') + (S.length > 1 ? ')' : '') + ' = ' + gval(i, S), deps: parts };
}
function gTable(filled) {
  const cells = {};
  GT.forEach((col, c) => {
    tag('|S| = ' + c, 'ptr', GX[c], 7.8);
    col.forEach(([i, S], r) => {
      const y = c === 1 ? 7.0 - r * 0.95 : c === 3 ? 4.6 : 6.4 - r * 1.3;
      const key = i + gF(S);
      cells[key] = { i, S, y, x: GX[c], m: filled ? cube('g(' + i + ',' + gF(S) + ')=' + gval(i, S), c === 3 ? PURPLE : TEAL, [2.2, 0.55, 0.45], GX[c], y, 0) : null };
    });
  });
  return cells;
}
FRAG.push(['dpbari3-tsp-table', 'TSP：依 |S| 由小到大填 g 表', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const cells = gTable(false);
  const f = mono(tag('', 'say', 0, 1.0, 0.6));
  const put = async (i, S, show) => {
    const e = cells[i + gF(S)], info = gEntry(i, S), c = S.length;
    const deps = info.deps.map((o) => cells[o.k + gF(o.rest)]).filter(Boolean);
    deps.forEach((d) => glow(d.m, GOLD));
    e.m = cube('g(' + i + ',' + gF(S) + ')', c === 3 ? PURPLE : BLUE, [2.2, 0.55, 0.45], e.x, e.y, 0, 1.2);
    txt(f, show || ('g(' + i + ',' + gF(S) + ') = ' + info.formula));
    await beat(tok, 600);
    relabel(e.m, 'g(' + i + ',' + gF(S) + ')=' + gval(i, S)); tint(e.m, c === 3 ? PURPLE : TEAL);
    deps.forEach((d) => glow(d.m, null));
  };
  await step(tok);                                   // 10:03 how DP works: start from here
  const D = buddy('DP', '', TEAL, 6.0, 0, 1.6, 0.6);
  say('現在用公式實際算', '從最小的子問題開始');
  await step(tok);                                   // 10:10 on 2, nowhere to go → back to 1: 5
  await put(2, []);
  say('在 2、沒有點要去：回到 1', 'g(2, ∅) = c(2,1) = 5');
  await step(tok);                                   // 10:29 on 3 → back: 6
  await put(3, []);
  say('在 3、沒有點要去', 'g(3, ∅) = c(3,1) = 6');
  await step(tok);                                   // 10:43 on 4 → back: 8
  await put(4, []);
  say('在 4、沒有點要去', 'g(4, ∅) = c(4,1) = 8');
  await step(tok);                                   // 10:49 next: one vertex remaining
  D.mood('wow');
  say('下一組：還剩一個點要走', '|S| = 1');
  await step(tok);                                   // 11:04 g(2,{3}) = 15
  await put(2, [3]);
  say('g(2, {3}) = 9 + 6 = 15', '剛才暴力法就算過了');
  await step(tok);                                   // 11:15 g(2,{4})
  await put(2, [4]);
  say('g(2, {4}) = 10 + 8 = 18', '（講者口頭念的 8 是 4→1 那段）');
  await step(tok);                                   // 11:26 g(3,{2})
  await put(3, [2]);
  say('g(3, {2}) = 13 + 5 = 18', '');
  await step(tok);                                   // 11:42 g(3,{4})
  await put(3, [4]);
  say('g(3, {4}) = 12 + 8 = 20', '');
  await step(tok);                                   // 11:53 g(4,{2})
  await put(4, [2]);
  say('g(4, {2}) = 8 + 5 = 13', '');
  await step(tok);                                   // 12:01 g(4,{3})
  await put(4, [3]);
  say('g(4, {3}) = 9 + 6 = 15', '');
  await step(tok);                                   // 12:12 two vertices remaining: one level up
  D.mood('calm');
  say('再上一層：還剩兩個點', '|S| = 2');
  await step(tok);                                   // 12:25 g(2,{3,4}) = 25
  await put(2, [3, 4]);
  say('g(2, {3,4}) = min(9 + 20, 10 + 15)', '= 25');
  await step(tok);                                   // 12:33 g(3,{2,4}) = 25
  await put(3, [2, 4]);
  say('g(3, {2,4}) = min(13 + 18, 12 + 13)', '= 25');
  await step(tok);                                   // 12:45 g(4,{2,3}) = 23
  await put(4, [2, 3]);
  say('g(4, {2,3}) = min(8 + 15, 9 + 18)', '= 23');
  await step(tok);                                   // 13:00 like table values, not solved using a tree
  bub('真正的解法是填表，不是畫樹', 0, 0.2, 0.6);
  say('值都像表格一樣排好了', '真正的 DP 是這樣填表，不是畫樹');
  await step(tok);                                   // 13:07 last: g(1,{2,3,4}) = min(…)
  const e = cells['1{2,3,4}'];
  e.m = cube('g(1,{2,3,4})', PURPLE, [2.2, 0.55, 0.45], e.x, e.y, 0, 1.2);
  ['2{3,4}', '3{2,4}', '4{2,3}'].forEach((k) => glow(cells[k].m, GOLD));
  txt(f, 'g(1,{2,3,4}) = min( c12 + g(2,{3,4}) , c13 + g(3,{2,4}) , c14 + g(4,{2,3}) )');
  say('最後一個：g(1, {2,3,4})', '三項取最小');
  await step(tok);                                   // 13:53 10 + 25, 15 + 25, 20 + 23
  txt(f, 'g(1,{2,3,4}) = min( 10 + 25 , 15 + 25 , 20 + 23 )');
  say('10 + 25、15 + 25、20 + 23', '');
  await step(tok);                                   // 14:15 43, 40, 35 → 35
  ['2{3,4}', '3{2,4}', '4{2,3}'].forEach((k) => glow(cells[k].m, null));
  relabel(e.m, 'g(1,{2,3,4})=35'); glow(e.m, GREEN);
  txt(f, 'min( 35 , 40 , 43 ) = 35');
  D.mood('happy'); await D.hop(tok);
  say('min(35, 40, 43) = 35', '答案是 35');
  await step(tok);                                   // 14:28 using the formula you get the answer
  say('用公式把這些值算出來，就得到答案', '');
}]);
FRAG.push(['dpbari3-tsp-path', 'TSP：記下誰給出最小值 → 1→2→4→3→1', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const cells = gTable(true);
  const out = mono(tag('1', 'pkt', 0, 1.2, 0.6));
  await step(tok);                                   // 14:33 what is the path? 35 because of …
  glow(cells['1{2,3,4}'].m, GOLD);
  say('最短的路線是哪一條？', '35 是從哪裡來的？');
  await step(tok);                                   // 14:38 selected vertex 2: 10 + 25
  glow(cells['2{3,4}'].m, GREEN);
  txt(out, '1 → 2');
  say('35 = 10 + 25：選了頂點 2', 'g(2, {3,4}) = 25');
  await step(tok);                                   // 14:45 25 from 10 + 15 → vertex 4
  glow(cells['1{2,3,4}'].m, null); glow(cells['2{3,4}'].m, GOLD); glow(cells['4{3}'].m, GREEN);
  txt(out, '1 → 2 → 4');
  say('25 = 10 + 15：下一站是 4', 'g(4, {3}) = 15');
  await step(tok);                                   // 15:01 answer 1 → 2 → 4 → 3
  glow(cells['2{3,4}'].m, null); glow(cells['4{3}'].m, GOLD); glow(cells['3∅'].m, GREEN);
  txt(out, '1 → 2 → 4 → 3 → 1');
  say('路線 1 → 2 → 4 → 3 → 1', '10 + 10 + 9 + 6 = 35');
  await step(tok);                                   // 15:10 remember where the minimum came from
  Object.values(cells).forEach((c) => glow(c.m, null));
  good('記住每個最小值從哪來 → 一連串決策找出路線', 0, 0.2, 0.6);
  say('記住每個最小值是從哪一項來的', '就能用一連串決策找出路線');
}]);
// g 的遞迴樹（Q4zHb-Swzro）
function gTree() {
  const L1X = [-4.2, 0, 4.2], L2X = [-5.25, -3.15, -1.05, 1.05, 3.15, 5.25], Y = [7.4, 6.0, 4.6, 3.2, 1.8];
  const root = { lvl: 0, x: 0, y: Y[0], k: 1, rest: [2, 3, 4], sym: 'g(1,{2,3,4})', w: 2.2 };
  const all = [root]; let b2 = 0;
  [2, 3, 4].forEach((k, a) => {
    const rest = [2, 3, 4].filter((v) => v !== k);
    const n1 = { lvl: 1, x: L1X[a], y: Y[1], par: root, from: 1, k, rest, w: 2.6 }; all.push(n1);
    rest.forEach((j) => {
      const r2 = rest.filter((v) => v !== j);
      const x = L2X[b2++];
      const n2 = { lvl: 2, x, y: Y[2], par: n1, from: k, k: j, rest: r2, w: 1.95 }; all.push(n2);
      const n3 = { lvl: 3, x, y: Y[3], par: n2, from: j, k: r2[0], rest: [], w: 1.95 }; all.push(n3);
      all.push({ lvl: 4, x, y: Y[4], par: n3, k: r2[0], w: 1.2, base: true });
    });
  });
  all.forEach((n) => {
    if (n.lvl === 0) return;
    if (n.base) { n.sym = 'g(' + n.k + ',∅)'; n.num = 'c' + n.k + '1=' + cm(n.k, 1); return; }
    n.c = cm(n.from, n.k); n.g = gval(n.k, n.rest);
    n.sym = 'c' + n.from + n.k + '+g(' + n.k + ',' + gF(n.rest) + ')';
    n.num = n.c + '+g(' + n.k + ',' + gF(n.rest) + ')';
    n.sub = n.c + '+' + n.g;
  });
  return all;
}
function gDraw(n, text, drop) {
  n.m = cube(text, n.lvl === 0 ? PURPLE : n.base ? TEAL : BLUE, [n.w, 0.5, 0.42], n.x, n.y, 0, drop ? 1.1 : 0);
  if (n.par) n.e = rod(V3(n.par.x, n.par.y - 0.25, -0.05), V3(n.x, n.y + 0.25, -0.05), SAND, 0.024);
  return n;
}
const gLv = (all, l) => all.filter((n) => n.lvl === l);
const gKids = (all, n) => all.filter((x) => x.par === n);
function gStart(upto) {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const all = gTree();
  all.filter((n) => n.lvl < upto).forEach((n) => gDraw(n, n.lvl ? n.num : n.sym, false));
  return all;
}
FRAG.push(['dpbari3-tsp-rtree1', 'TSP 遞迴樹：第一層 c(1,k) + g(k, …)', async (tok) => {
  const all = gStart(0), L1 = gLv(all, 1);
  await step(tok);                                   // 3:03 generate a recursive tree
  gDraw(all[0], all[0].sym, true);
  say('遞迴式要用遞迴樹求值', '根：g(1, {2,3,4})');
  await step(tok);                                   // 3:08 1 → 2: c12 + g(2,{3,4})
  gDraw(L1[0], L1[0].sym, true);
  say('k = 2：c(1,2) + g(2, {3,4})', '2 走過了，從集合拿掉');
  await step(tok);                                   // 3:38 1 → 3: c13 + g(3,{2,4})
  gDraw(L1[1], L1[1].sym, true);
  say('k = 3：c(1,3) + g(3, {2,4})', '');
  await step(tok);                                   // 3:56 1 → 4: c14 + g(4,{2,3})
  gDraw(L1[2], L1[2].sym, true);
  say('k = 4：c(1,4) + g(4, {2,3})', '');
  await step(tok);                                   // 4:18 three formulas; take the minimum
  L1.forEach((n) => tint(n.e, ORANGE));
  say('代入三個 k，得到三個式子', '三個要取最小');
  await step(tok);                                   // 4:44 we don't know these: cannot take min
  L1.forEach((n) => glow(n.m, RED));
  bad('三個 g 都還不知道 → 沒辦法取 min', 0, 0.6, 0.6);
  say('可是三個 g 的值都不知道', '沒辦法取最小');
  await step(tok);                                   // 4:57 the same formula again: start 2, 3, 4
  L1.forEach((n) => glow(n.m, null));
  say('再用同一個公式展開它們', '起點分別換成 2、3、4');
  await step(tok);                                   // 5:10 c12 = 10, c13 = 15, c14 = 20
  for (const n of L1) { await fling(tok, String(n.c), V3(0, 7.4, 0.5), V3(n.x - 0.8, n.y + 0.4, 0.5), 450); relabel(n.m, n.num); glow(n.m, GOLD); }
  say('先填上邊的成本', 'c12 = 10、c13 = 15、c14 = 20');
}]);
FRAG.push(['dpbari3-tsp-rtree2', 'TSP 遞迴樹：第二層六個 g', async (tok) => {
  const all = gStart(2), L1 = gLv(all, 1), L2 = gLv(all, 2);
  const draw = (ns) => ns.forEach((n) => gDraw(n, n.sym, true));
  const num = (ns) => ns.forEach((n) => { relabel(n.m, n.num); glow(n.m, GOLD); });
  await step(tok);                                   // 5:39 expand these formulas
  glow(L1[0].m, GOLD);
  say('展開這些式子，算出來再加上去', '先展開 g(2, {3,4})');
  await step(tok);                                   // 5:46 2 → 3: c23 + g(3,{4})
  draw([L2[0]]);
  say('起點 2，走到 3', 'c(2,3) + g(3, {4})：只剩 4');
  await step(tok);                                   // 6:11 or 2 → 4: c24 + g(4,{3})
  draw([L2[1]]);
  say('或者 2 走到 4', 'c(2,4) + g(4, {3})');
  await step(tok);                                   // 6:28 g(3,{2,4}): c32 + g(2,{4}), c34 + g(4,{2})
  glow(L1[0].m, null); glow(L1[1].m, GOLD); draw([L2[2], L2[3]]);
  say('g(3, {2,4}) 一樣展開', 'c(3,2) + g(2,{4})、c(3,4) + g(4,{2})');
  await step(tok);                                   // 6:51 g(4,{2,3}): c42 + g(2,{3}), c43 + g(3,{2})
  glow(L1[1].m, null); glow(L1[2].m, GOLD); draw([L2[4], L2[5]]);
  say('g(4, {2,3})', 'c(4,2) + g(2,{3})、c(4,3) + g(3,{2})');
  await step(tok);                                   // 7:20 six formulas; fill c values
  glow(L1[2].m, null);
  say('現在有 6 個式子', '先填上邊的成本');
  await step(tok);                                   // 7:28 c23 = 9, c24 = 10
  num([L2[0], L2[1]]);
  say('c(2,3) = 9、c(2,4) = 10', '');
  await step(tok);                                   // 7:40 c32 = 13, c34 = 12
  num([L2[2], L2[3]]);
  say('c(3,2) = 13、c(3,4) = 12', '');
  await step(tok);                                   // 7:56 c42 = 8, c43 = 9
  num([L2[4], L2[5]]);
  say('c(4,2) = 8、c(4,3) = 9', '6 個 g 還是不知道 → 繼續展開');
}]);
FRAG.push(['dpbari3-tsp-rtree3', 'TSP 遞迴樹：展開到 g(k, ∅) = c(k, 1)', async (tok) => {
  const all = gStart(3), L3 = gLv(all, 3), L4 = gLv(all, 4);
  gLv(all, 2).forEach((n) => relabel(n.m, n.num));
  await step(tok);                                   // 8:06 g(3,{4}): only 4 → c34 + g(4,∅)
  gDraw(L3[0], L3[0].sym, true);
  say('g(3, {4})：只剩 4，走過去', 'c(3,4) + g(4, ∅)：沒有點要走了');
  await step(tok);                                   // 8:28 the same for the others
  L3.slice(1).forEach((n) => gDraw(n, n.sym, true));
  say('其他也一樣展開', '例：c(4,3) + g(3, ∅)、c(3,2) + g(2, ∅)');
  await step(tok);                                   // 8:47 the complete tree (order of execution differs)
  all.forEach((n) => { if (n.m) glow(n.m, GOLD); });
  await beat(tok, 700);
  all.forEach((n) => { if (n.m) glow(n.m, null); });
  say('用遞迴樹的話，整棵樹長這樣', '實際執行的順序不同');
  await step(tok);                                   // 9:08 edge costs 12, 9, 10, 8, 9, 13
  for (const n of L3) { relabel(n.m, n.num); glow(n.m, GOLD); await beat(tok, 250); }
  say('填上邊的成本', '12、9、10、8、9、13');
  await step(tok);                                   // 9:33 g(2,∅): on 2, nothing to visit
  L3.forEach((n) => glow(n.m, null));
  L4.forEach((n) => gDraw(n, n.sym, true));
  L4.filter((n) => n.k === 2).forEach((n) => glow(n.m, GOLD));
  say('g(2, ∅)：在 2，沒有點要走了', '');
  await step(tok);                                   // 10:02 must go back to vertex 1: 2→1 = 5
  L4.filter((n) => n.k === 2).forEach((n) => relabel(n.m, n.num));
  say('TSP 規定要回到起點', 'g(2, ∅) = c(2,1) = 5');
  await step(tok);                                   // 10:14 4 to nothing = 4 to 1
  L4.filter((n) => n.k === 2).forEach((n) => glow(n.m, null));
  L4.filter((n) => n.k === 4).forEach((n) => { relabel(n.m, n.num); glow(n.m, GOLD); });
  say('g(4, ∅) = 4 回到 1', 'c(4,1) = 8');
  await step(tok);                                   // 10:44 3 → 1 = 6, 2 → 1 = 5
  L4.filter((n) => n.k === 4).forEach((n) => glow(n.m, null));
  L4.filter((n) => n.k === 3).forEach((n) => { relabel(n.m, n.num); glow(n.m, GOLD); });
  say('g(3, ∅) = c(3,1) = 6', '最底層都有值了');
  await step(tok);                                   // 10:57 substitute values back to the answer
  L4.forEach((n) => glow(n.m, GREEN));
  say('現在可以把值往上代', '一路代回最上面的答案');
  await step(tok);                                   // 11:04 tree expanded so much: use a table
  L4.forEach((n) => glow(n.m, null));
  bad('樹太大了 → 改用表格', 0, 0.8, 0.6);
  say('樹展開得這麼大', '所以不這樣算，而是改用表格');
}]);
// 由下往上代值（Q4zHb-Swzro 11:23–17:07）
function gSubStart(phase) {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const all = gTree();
  const keepTo = phase === 1 ? 4 : 2;
  all.filter((n) => n.lvl <= keepTo).forEach((n) => gDraw(n, n.lvl === 0 ? n.sym : phase === 2 && n.lvl === 2 ? n.sub : n.num, false));
  return all;
}
FRAG.push(['dpbari3-tsp-sub1', 'TSP：改用表格，先算最小的值', async (tok) => {
  const all = gSubStart(1), L2 = gLv(all, 2), L4 = gLv(all, 4);
  const T = mono(tag('', 'say', 0, 0.6, 0.6));
  const coll = (k, rest) => {
    const n = L2.find((x) => x.k === k && x.rest[0] === rest);
    const n3 = all.find((x) => x.par === n), n4 = all.find((x) => x.par === n3);
    glow(n.m, GOLD); relabel(n.m, n.sub); tint(n.m, TEAL);
    fly(n3.m); kill(n3.e); fly(n4.m); kill(n4.e);
    return n;
  };
  let last;
  await step(tok);                                   // 11:23 a table: last level first, then upper
  const D = buddy('DP', '', TEAL, 6.2, 0, 1.6, 0.6);
  txt(T, '表格：先算最底層 → 再上一層 → 答案自然出來');
  say('改成表格：先算最底層的值', '再上一層、再上一層，答案自然出來');
  await step(tok);                                   // 11:46 last level: g(2,∅), g(3,∅), g(4,∅)
  L4.forEach((n) => glow(n.m, GOLD));
  txt(T, 'g(2,∅)   g(3,∅)   g(4,∅)');
  say('最底層：g(2, ∅)、g(3, ∅)、g(4, ∅)', '在某點、沒有點要走');
  await step(tok);                                   // 12:04 5, 6, 8
  L4.forEach((n) => glow(n.m, GREEN));
  txt(T, 'g(2,∅) = 5   g(3,∅) = 6   g(4,∅) = 8');
  say('g(2, ∅) = 5、g(3, ∅) = 6、g(4, ∅) = 8', '');
  await step(tok);                                   // 12:20 programming = tabular values
  L4.forEach((n) => glow(n.m, null));
  bub('講者：programming 指表格，不是寫程式（原意是規劃／最佳化）', 0, 8.3);
  D.mood('wow');
  say('講者：DP 的 programming 指表格', '不是寫程式；原意是「規劃」，靠動態填表完成');
  await step(tok);                                   // 12:36 not like recursion: smaller values first
  D.mood('happy');
  say('不照遞迴的方式算', '先算小的值，才能算依賴它的大值');
  await step(tok);                                   // 12:51 next level values
  L2.forEach((n) => glow(n.m, GOLD));
  say('下一層需要這些值', 'g(3,{4})、g(4,{3})、g(2,{4})……');
  await step(tok);                                   // 13:28 one vertex remaining
  L2.forEach((n) => glow(n.m, null));
  txt(T, '在 2：剩 {3} 或剩 {4}　……　共 6 種');
  say('在某個點、還剩一個點要走', '例如在 2：可能剩 3，也可能剩 4');
  await step(tok);                                   // 13:51 g(3,{4}) = 20
  last = coll(3, 4); txt(T, 'g(3,{4}) = 12 + 8 = 20');
  say('在 3、剩 4：12 + 8 = 20', '式子換成數字');
  await step(tok);                                   // 14:04 g(4,{3}) = 15
  glow(last.m, null); last = coll(4, 3); txt(T, 'g(4,{3}) = 9 + 6 = 15');
  say('在 4、剩 3：9 + 6 = 15', '');
  await step(tok);                                   // 14:21 g(4,{2}) = 13
  glow(last.m, null); last = coll(4, 2); txt(T, 'g(4,{2}) = 8 + 5 = 13');
  say('在 4、剩 2：8 + 5 = 13', '');
  await step(tok);                                   // 14:41 g(2,{3}) = 15
  glow(last.m, null); last = coll(2, 3); txt(T, 'g(2,{3}) = 9 + 6 = 15');
  say('在 2、剩 3：9 + 6 = 15', '');
  await step(tok);                                   // 14:49 g(3,{2}) = 18 (and g(2,{4}) = 18)
  glow(last.m, null); last = coll(3, 2); coll(2, 4);
  txt(T, 'g(3,{2}) = 13 + 5 = 18　g(2,{4}) = 10 + 8 = 18');
  say('在 3、剩 2：13 + 5 = 18', 'g(2, {4}) = 10 + 8 = 18 也一樣算');
}]);
FRAG.push(['dpbari3-tsp-sub2', 'TSP：剩兩個點取 min，得 35', async (tok) => {
  const all = gSubStart(2), L1 = gLv(all, 1), r = all[0];
  const T = mono(tag('', 'say', 0, 2.8, 0.6));
  const D = buddy('DP', '', TEAL, 6.2, 0, 1.6, 0.6);
  const up = (n) => { const kids = gKids(all, n); relabel(n.m, n.sub); tint(n.m, TEAL); kids.forEach((c) => { fly(c.m); kill(c.e); }); };
  const lit = (n) => gKids(all, n).forEach((c) => glow(c.m, c.c + c.g === n.g ? GREEN : GOLD));
  await step(tok);                                   // 15:10 two vertices remaining
  L1.forEach((n) => glow(n.m, GOLD));
  say('再上一層：還剩兩個點', '');
  await step(tok);                                   // 15:36 three sets: {3,4}, {2,4}, {2,3}
  txt(T, 'g(2,{3,4})　g(3,{2,4})　g(4,{2,3})');
  say('三種情況', '在 2 剩 {3,4}、在 3 剩 {2,4}、在 4 剩 {2,3}');
  await step(tok);                                   // 15:47 min(29, 25) = 25
  L1.forEach((n) => glow(n.m, null)); lit(L1[0]);
  txt(T, 'g(2,{3,4}) = min( 9 + 20 , 10 + 15 ) = min( 29 , 25 ) = 25');
  await beat(tok, 700); up(L1[0]);
  say('g(2, {3,4}) = min(29, 25) = 25', '');
  await step(tok);                                   // 15:57 31 and 25 → 25
  lit(L1[1]);
  txt(T, 'g(3,{2,4}) = min( 13 + 18 , 12 + 13 ) = min( 31 , 25 ) = 25');
  await beat(tok, 700); up(L1[1]);
  say('g(3, {2,4}) = min(31, 25) = 25', '');
  await step(tok);                                   // 16:19 23 and 27 → 23
  lit(L1[2]);
  txt(T, 'g(4,{2,3}) = min( 8 + 15 , 9 + 18 ) = min( 23 , 27 ) = 23');
  await beat(tok, 700); up(L1[2]);
  say('g(4, {2,3}) = min(23, 27) = 23', '');
  await step(tok);                                   // 16:38 out of these, the minimum: g(1,{2,3,4})
  glow(r.m, GOLD);
  txt(T, 'g(1,{2,3,4}) = min( 10 + 25 , 15 + 25 , 20 + 23 )');
  say('最後：g(1, {2,3,4})', '三項取最小');
  await step(tok);                                   // 16:55 35, 40, 43 → 35
  relabel(r.m, 'g(1,{2,3,4}) = 35'); glow(r.m, GREEN);
  txt(T, 'min( 35 , 40 , 43 ) = 35');
  say('35、40、43 → 最小 35', '');
  await step(tok);                                   // 17:07 shortest route 35
  D.mood('happy'); await D.hop(tok);
  say('TSP 最短路線成本 = 35', '由下往上填表，和遞迴樹同一個答案');
}]);

// ════════════════ sSno9rV8Rhg：LCS ════════════════
function letters(s, x0, dx, y, color, drop = 1.2) { return s.split('').map((ch, k) => cube(ch, color, [0.66, 0.58, 0.5], x0 + k * dx, y, 0, drop)); }
function tie(a, b, color = TEAL) { return rod(V3(a.position.x, a.position.y - 0.32, 0), V3(b.position.x, b.position.y + 0.32, 0), color, 0.04); }
async function match(tok, A, B, pairs, color, ms) {
  const ls = [];
  for (const [b, a] of pairs) { glow(A[a], GOLD); glow(B[b], GOLD); ls.push(tie(A[a], B[b], color)); await beat(tok, ms); }
  return ls;
}
const unlit = (...xs) => xs.flat().forEach((m) => glow(m, null));
FRAG.push(['dpbari3-lcs-intro', 'LCS：cdgi 依序出現在另一個字串', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  let A, B, ls, out;
  await step(tok);                                   // 0:39 two strings: nothing like substring
  A = letters('abcdefghij', -5.4, 1.2, 6.4, BLUE); B = letters('cdgi', -3.6, 1.2, 3.0, ORANGE);
  tag('字串 1', 'ptr', -6.6, 7.3); tag('字串 2', 'ptr', -5.0, 3.9);
  say('有兩個字串', '這裡沒有「子字串」的概念');
  await step(tok);                                   // 0:45 KMP: search a substring in a main string
  bad('不是 KMP：在主字串裡找一模一樣的一段', 0, 1.6, 0.6);
  say('不是像 KMP 那樣', '在主字串裡找一模一樣的子字串');
  await step(tok);                                   // 0:58 longer / smaller; not an exact match
  say('一個長、一個短', '不是找完全相同的一段');
  await step(tok);                                   // 1:04 same characters appearing in sequence
  const P = buddy('配對員', '', '#f3d27a', 5.6, 0, 2.0, 0.6);
  say('有些字元在兩個字串都出現', '要找「依照順序」出現的那些');
  await step(tok);                                   // 1:22 c yes, d yes, g, i
  ls = await match(tok, A, B, [[0, 2], [1, 3], [2, 6], [3, 8]], TEAL, 500);
  P.mood('happy');
  say('c ✓、d ✓、g ✓、i ✓', '都能在字串 1 找到');
  await step(tok);                                   // 1:38 not together but same order
  [3, 4, 5, 7].forEach((k) => tint(A[k], GRAY));
  say('它們在字串 1 裡不相鄰', '但出現的順序一樣');
  await step(tok);                                   // 1:45 longest common subsequence
  out = good('c d g i：共同子序列（common subsequence）', 0, 1.6, 1.2);
  say('這叫 common subsequence（共同子序列）', '');
  await step(tok);                                   // 1:52 dgi, gi also; cdgi is longest
  glow(A[2], null); glow(B[0], null);
  await beat(tok, 500); glow(A[3], null); glow(B[1], null);
  await beat(tok, 500);
  [A[2], A[3], B[0], B[1]].forEach((m) => glow(m, GOLD));
  txt(out, '最長的是 c d g i → LCS（長度 4）');
  P.mood('happy'); await P.hop(tok);
  say('dgi、gi 也是共同子序列', '最長的是 cdgi：Longest Common Subsequence');
}]);
FRAG.push(['dpbari3-lcs-cross', 'LCS：連線不能交叉（egi vs cdgi）', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const A = letters('abcdefghij', -5.4, 1.2, 6.4, BLUE, 0), B = letters('ecdgi', -4.8, 1.2, 3.0, ORANGE, 0);
  let ls = [], l;
  await step(tok);                                   // 2:08 another example: add e in front
  glow(B[0], GOLD);
  say('同一個例子，在字串 2 前面加上 e', 'B = e c d g i');
  await step(tok);                                   // 2:14 e matches
  ls = await match(tok, A, B, [[0, 4]], TEAL, 400);
  say('e：有配到', '');
  await step(tok);                                   // 2:21 c? lines must not intersect
  l = tie(A[2], B[1], RED);
  const no = bad('連線交叉了 ✗', 0, 4.7, 0.6);
  say('c 也找得到……但連線交叉了', '配對的連線不能互相交叉');
  await step(tok);                                   // 2:41 only characters after e: skip c
  kill(l); remove(no);
  note('e 之後的字元，只能配 e 後面的', 2.4, 1.8, 0.6);
  say('e 配好之後，下一個只能往 e 後面找', 'c 在 e 前面：跳過');
  await step(tok);                                   // 2:49 d also intersects
  l = tie(A[3], B[2], RED);
  await beat(tok, 900); kill(l);
  say('d 也一樣會交叉', '跳過');
  await step(tok);                                   // 2:56 g, i match → e g i
  ls = ls.concat(await match(tok, A, B, [[3, 6], [4, 8]], TEAL, 500));
  say('g ✓、i ✓', '得到 e g i');
  await step(tok);                                   // 3:13 start from c instead: c d g i
  ls.forEach(kill); unlit(A, B);
  ls = await match(tok, A, B, [[1, 2], [2, 3], [3, 6], [4, 8]], PINK, 450);
  say('改從 c 開始', 'c d g i 也配得上');
  await step(tok);                                   // 3:24 egi and cdgi; cdgi is longest
  good('egi、cdgi 都是共同子序列；最長：cdgi', 0, 1.6, 1.2);
  say('egi、cdgi 都是', '最長的是 cdgi');
}]);
FRAG.push(['dpbari3-lcs-two', 'LCS：長度相同的答案可以不只一個', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  let A, B, ls;
  await step(tok);                                   // 3:38 one more example
  A = letters('abdace', -3.0, 1.2, 6.4, BLUE); B = letters('babce', -2.4, 1.2, 3.0, ORANGE);
  say('再一個例子', 'abdace 與 babce');
  await step(tok);                                   // 3:49 b found, a found
  ls = await match(tok, A, B, [[0, 1], [1, 3]], TEAL, 600);
  say('從字串 2 逐字比', 'b ✓、a ✓');
  await step(tok);                                   // 4:03 b? none after a; c, e → b a c e
  const l = tie(A[1], B[2], RED); await beat(tok, 700); kill(l);
  ls = ls.concat(await match(tok, A, B, [[3, 4], [4, 5]], TEAL, 500));
  const r1 = good('b a c e', -5.6, 4.7, 0.6);
  say('下一個 b：a 後面沒有 b，跳過', 'c ✓、e ✓ → b a c e');
  await step(tok);                                   // 4:15 another one: start from a
  ls.forEach(kill); unlit(A, B);
  say('還有沒有別的？', '改從 a 開始');
  await step(tok);                                   // 4:24 a b c e, not intersecting
  ls = await match(tok, A, B, [[1, 0], [2, 1], [3, 4], [4, 5]], PINK, 450);
  good('a b c e', -5.6, 4.0, 0.6);
  say('a、b、c、e：連線方向不同，但不交叉', '得到 a b c e');
  await step(tok);                                   // 4:40 multiple subsequences of the same length
  bub('長度都是 4：LCS 可以不只一個', 0, 1.6, 1.2);
  say('兩個答案長度一樣', 'LCS 可能不只一個');
  await step(tok);                                   // 4:48 matching characters need not be continuous
  say('找兩字串裡依序相符的字元', '不必連續；接著用遞迴解');
}]);
// 遞迴版（A = "bd"、B = "abcd"，index 從 0、字串以 \0 結尾）
const RA = 'bd', RB = 'abcd';
const rch = (s, i) => (i < s.length ? s[i] : '\\0');
const RT = [['00', null], ['10', '00'], ['20', '10'], ['11', '10'], ['21', '11'], ['12', '11'], ['22', '12'], ['13', '12'], ['24', '13'], ['01', '00'], ['12b', '01'], ['22b', '12b'], ['13b', '12b'], ['24b', '13b']];
const RCODE = ['LCS(i, j):', ' if (A[i]==\'\\0\' || B[j]==\'\\0\')', '   return 0;', ' else if (A[i] == B[j])', '   return 1 + LCS(i+1, j+1);', ' else', '   return max(LCS(i+1, j),', '              LCS(i, j+1));'];
function recTree(yTop, dy, x0, sp) {
  const N = {}; RT.forEach(([id, p]) => { N[id] = { id, i: +id[0], j: +id[1], par: p ? N[p] : null, kids: [] }; if (p) N[p].kids.push(N[id]); });
  let leaf = 0;
  (function lay(n, d) { n.d = d; if (!n.kids.length) n.x = x0 + leaf++ * sp; else { n.kids.forEach((k) => lay(k, d + 1)); n.x = n.kids.reduce((s, k) => s + k.x, 0) / n.kids.length; } n.y = yTop - d * dy; })(N['00'], 0);
  (function val(n) { const a = rch(RA, n.i), b = rch(RB, n.j); n.lbl = a + ',' + b; n.kids.forEach(val); n.v = a === '\\0' || b === '\\0' ? 0 : a === b ? 1 + n.kids[0].v : Math.max(n.kids[0].v, n.kids[1].v); n.kind = a === '\\0' || b === '\\0' ? 0 : a === b ? 1 : 2; })(N['00']);
  return N;
}
function recStrings(x0, y) {
  tag('A', 'ptr', x0 - 0.9, y); tag('B', 'ptr', x0 - 0.9, y - 0.8);
  const a = ['b', 'd', '\\0'].map((c, k) => { tag(String(k), 'idx', x0 + k * 0.75, y + 0.45); return cube(c, BLUE, [0.6, 0.48, 0.4], x0 + k * 0.75, y, 0); });
  const b = ['a', 'b', 'c', 'd', '\\0'].map((c, k) => cube(c, ORANGE, [0.6, 0.48, 0.4], x0 + k * 0.75, y - 0.8, 0));
  return { a, b };
}
function recNode(n, drop) {
  n.m = cube(n.lbl, n.kind === 0 ? GRAY : n.kind === 1 ? TEAL : BLUE, [0.95, 0.46, 0.4], n.x, n.y, 0, drop ? 1 : 0);
  if (n.par) n.e = rod(V3(n.par.x, n.par.y - 0.24, -0.05), V3(n.x, n.y + 0.24, -0.05), SAND, 0.022);
  n.t = tag('', 'ptr alt', n.x, n.y - 0.45, 0.2); showL(n.t, false);
}
const recVal = (n) => { txt(n.t, '=' + n.v); showL(n.t, true); glow(n.m, n.kind === 1 ? GREEN : null); };
FRAG.push(['dpbari3-lcs-reccode', 'LCS 遞迴演算法：前幾次呼叫', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  let S, cd, N;
  const show = (id, line) => { const n = N[id]; recNode(n, true); unlit(S.a, S.b); glow(S.a[n.i], GOLD); glow(S.b[n.j], GOLD); cd.hl(line); return n; };
  await step(tok);                                   // 5:00 a recursive algorithm, small example
  cd = code(RCODE, -3.6, 5.6, 0.48);
  say('LCS 的遞迴演算法', '用一個很小的例子追蹤');
  await step(tok);                                   // 5:19 draw the recursion tree; memoization later
  bub('畫遞迴樹 → 再看 memoization 怎麼加速', 3.2, 8.0);
  say('會畫出遞迴樹', '之後再看 memoization 怎麼讓它變快');
  await step(tok);                                   // 5:30 strings end with \0, index from 0
  S = recStrings(-5.0, 7.4);
  say('字串以 \\0 結尾', 'index 從 0 開始');
  await step(tok);                                   // 5:38 parameters i, j: start 0, 0
  cd.hl(0);
  const pi = tag('i', 'pkt', -5.0, 8.15), pj = tag('j', 'pkt', -5.0, 6.15);
  say('參數 i、j：兩個字串目前的位置', '一開始都是 0');
  await step(tok);                                   // 5:48 any one is \0 → return 0
  cd.hl(1);
  say('任一個是 \\0：回傳 0', '');
  await step(tok);                                   // 5:56 match → 1 + both move on
  cd.hl(3);
  say('兩個字元相同：1 + 兩邊都往後一格', 'LCS(i+1, j+1)');
  await step(tok);                                   // 6:05 no match → max of moving A or B
  cd.hl(6);
  say('不同：A 往後一格，或 B 往後一格', '兩個取大的；大部分時候走這條');
  await step(tok);                                   // 6:25 initially 0, 0: b and a
  N = recTree(7.2, 1.25, 1.2, 1.15);
  show('00', 0);
  say('一開始 (0, 0)：A[0] = b、B[0] = a', '');
  await step(tok);                                   // 6:34 not \0, not same → two calls
  cd.hl(6);
  say('不是 \\0、也不相同', '走第三種：呼叫兩次');
  await step(tok);                                   // 6:48 first call: A moves → (1,0) d, a
  show('10', 6); await travel(tok, pi, pi.position.clone(), V3(-4.25, 8.15, 0), 400);
  say('第一個呼叫：A 往後一格', '(1, 0)：d、a');
  await step(tok);                                   // 7:04 second call: (0,1) b, b
  show('01', 7);
  say('第二個呼叫：B 往後一格', '(0, 1)：b、b');
  await step(tok);                                   // 7:18 first this one completes, then that one
  glow(N['10'].m, GOLD);
  say('兩個結果取最大', '要先把左邊的呼叫做完，才做右邊');
  await step(tok);                                   // 7:33 (1,0): not same → (2,0) \0, a
  show('20', 6);
  say('(1, 0)：d、a 不同 → 又呼叫兩次', '第一個是 (2, 0)：\\0、a');
  await step(tok);                                   // 7:53 (1,1): d, b
  show('11', 7);
  say('另一個是 (1, 1)：d、b', '');
  await step(tok);                                   // 8:16 (2,0) is \0 → returns 0
  cd.hl(2); unlit(S.a, S.b); glow(S.a[2], GOLD); recVal(N['20']);
  say('(2, 0) 遇到 \\0', '回傳 0');
}]);
FRAG.push(['dpbari3-lcs-rectree', 'LCS 遞迴樹：答案 2，與重疊的子問題', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  tag('A = "bd"   B = "abcd"', 'ptr', -5.0, 7.6);
  const N = recTree(7.0, 1.08, -4.6, 1.84);
  ['00', '10', '01', '20', '11'].forEach((id) => recNode(N[id], false)); recVal(N['20']);
  const add = (...ids) => ids.forEach((id) => recNode(N[id], true));
  await step(tok);                                   // 8:29 (1,1): not same → (2,1) \0,b and (1,2) d,c
  glow(N['11'].m, GOLD); add('21', '12');
  say('(1, 1)：d、b 不同 → 兩個呼叫', '(2, 1)：\\0、b　(1, 2)：d、c');
  await step(tok);                                   // 8:57 (2,1) = 0; (1,2) → (2,2), (1,3)
  glow(N['11'].m, null); recVal(N['21']); add('22', '13');
  say('(2, 1) 遇到 \\0 → 0', '(1, 2) 再呼叫 (2, 2) 和 (1, 3)');
  await step(tok);                                   // 9:19 (2,2) = 0; (1,3) d,d match → 1 + (2,4)
  recVal(N['22']); add('24'); glow(N['13'].m, GREEN);
  say('(2, 2) → 0', '(1, 3)：d、d 相同！→ 1 + LCS(2, 4)');
  await step(tok);                                   // 9:32 (2,4) both \0 → 0
  recVal(N['24']);
  say('(2, 4)：兩個都是 \\0', '回傳 0');
  await step(tok);                                   // 9:41 return 1 + 0 = 1
  recVal(N['13']);
  say('往回傳：1 + 0 = 1', '(1, 3) = 1');
  await step(tok);                                   // 9:48 max(0, 1) = 1 …
  recVal(N['12']); await beat(tok, 500); recVal(N['11']);
  say('(1, 2) = max(0, 1) = 1', '(1, 1) = max(0, 1) = 1');
  await step(tok);                                   // 9:56 (1,0) = max(0, 1) = 1
  recVal(N['10']);
  say('(1, 0) = max(0, 1) = 1', '左邊做完了');
  await step(tok);                                   // 10:03 (0,1) not yet solved
  glow(N['01'].m, GOLD);
  say('右邊的 (0, 1) 還沒算', '');
  await step(tok);                                   // 10:08 b, b match → 1 + (1,2)
  glow(N['01'].m, GREEN); add('12b');
  say('b、b 相同 → 1 + LCS(1, 2)', '(1, 2) 是 d、c');
  await step(tok);                                   // 10:27 it continues: the same nodes again
  add('22b', '13b', '24b');
  say('遞迴會繼續展開', '節點跟左邊一模一樣');
  await step(tok);                                   // 10:50 … 1 + 1 = 2, max = 2
  ['22b', '24b', '13b', '12b'].forEach((id) => recVal(N[id])); recVal(N['01']);
  say('(1, 2) 一樣得 1 → (0, 1) = 1 + 1 = 2', '');
  await step(tok);                                   // 11:12 the answer is 2
  recVal(N['00']); glow(N['00'].m, GREEN);
  say('(0, 0) = max(1, 2) = 2', '答案：LCS 長度 2');
  await step(tok);                                   // 11:16 such a huge tree: exponential
  bad('才幾個字元，樹就這麼大 → 指數時間', 0, 0.8, 0.6);
  say('只有兩三個字元，樹就這麼大', '純遞迴是指數時間');
  await step(tok);                                   // 11:28 starts from top: top-down
  await fling(tok, '從 (0,0) 往下 → top-down', V3(N['00'].x + 2.6, 7.0, 0.5), V3(N['00'].x + 2.6, 4.0, 0.5), 1000, true);
  say('從最上面開始呼叫', '答案在回傳時得到：top-down approach');
  await step(tok);                                   // 11:40 overlapping: d, c → 1 again
  const sub = (n) => [n].concat(...n.kids.map(sub));
  [...sub(N['12']), ...sub(N['12b'])].forEach((n) => glow(n.m, GOLD));
  say('左邊的 (1, 2)「d、c」得 1', '右邊又算一次，答案一樣：重疊子問題');
  await step(tok);                                   // 11:59 no need to call again if remembered
  sub(N['12b']).forEach((n) => { n.m.material.transparent = true; n.m.material.opacity = 0.3; });
  say('記得答案的話', '就不用再呼叫一次');
  await step(tok);                                   // 12:11 storing results = memoization
  good('把遞迴的結果存起來 = memoization', 0, 0.1, 0.6);
  say('把遞迴的結果存起來', '就叫 memoization');
  await step(tok);                                   // 12:25 big problems: many overlaps
  say('題目一大，重疊的分支會很多', '接著看 memoization 怎麼加速');
}]);
FRAG.push(['dpbari3-lcs-memo', 'LCS memoization：用表存遞迴結果', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  let g;
  const put = (i, j, v) => g.set(i, j, v, i === 2 || j === 4 ? GRAY : v ? TEAL : BLUE);
  const cnt = tag('', 'ptr alt', 4.6, 7.6);
  await step(tok);                                   // 12:37 a table: rows A, columns B, index from 0
  g = grid({ rows: 3, cols: 5, cw: 1.1, ch: 0.85, x0: -2.2, y0: 6.2, colHdr: ['a', 'b', 'c', 'd', '\\0'], rowHdr: ['b', 'd', '\\0'], colCls: 'ptr', rowCls: 'ptr', rowDx: 0.2 });
  [0, 1, 2, 3, 4].forEach((j) => tag('j=' + j, 'idx', -2.2 + j * 1.1, 7.35));
  [0, 1, 2].forEach((i) => tag('i=' + i, 'idx', -4.4, 6.2 - i * 0.85));
  const M = buddy('記事本', '', '#f3d27a', -5.6, 0, 2.0, 0.7);
  say('準備一張表給 memoization 用', '列是 A、行是 B，index 從 0 開始');
  await step(tok);                                   // 12:57 start 0,0 → 1,0 → 2,0: first value 2,0 = 0
  for (const [i, j] of [[0, 0], [1, 0], [2, 0]]) { glow(g.plates[i + ',' + j], GOLD); await beat(tok, 350); }
  put(2, 0, 0);
  say('呼叫 (0,0) → (1,0) → (2,0)', '第一個得到的值：(2, 0) = 0');
  await step(tok);                                   // 13:06 (2,1)=0, (2,2)=0, (2,4)=0, (1,3)=1, (1,2)=1
  for (const [i, j, v] of [[2, 1, 0], [2, 2, 0], [2, 4, 0], [1, 3, 1], [1, 2, 1]]) { put(i, j, v); await beat(tok, 380); }
  say('(2,1)、(2,2)、(2,4) 都是 0', '回傳得 (1,3) = 1、(1,2) = 1');
  await step(tok);                                   // 13:36 (1,1) = 1, (1,0) = 1
  put(1, 1, 1); await beat(tok, 400); put(1, 0, 1);
  say('再回傳：(1, 1) = 1、(1, 0) = 1', '');
  await step(tok);                                   // 13:43 top-down, but the table fills bottom-up
  await fling(tok, '表從下往上填 ↑', V3(3.6, 4.5, 0.6), V3(3.6, 6.4, 0.6), 1000, true);
  say('呼叫是 top-down', '表格卻是由下往上填');
  await step(tok);                                   // 13:49 (1,2) already known → no calls
  glow(g.get(1, 2), GREEN); g.arrow(1, 2, 0, 1, OKC);
  M.mood('happy'); await M.hop(tok);
  say('右邊要 LCS(1, 2)：表裡已經有了', '不用再呼叫');
  await step(tok);                                   // 14:00 (0,1) = 2, then (0,0) = 2
  g.set(0, 1, 2, TEAL); await beat(tok, 600);
  g.clearArrows(); glow(g.get(1, 2), null);
  g.arrow(1, 0, 0, 0, TRY); g.arrow(0, 1, 0, 0, OKC);
  g.set(0, 0, 2, TEAL);
  say('(0, 1) = 1 + 1 = 2', '(0, 0) = max(1, 2) = 2');
  await step(tok);                                   // 14:10 (1,2) was in the table: no calls
  g.clearArrows(); glow(g.get(0, 0), GREEN);
  say('因為 (1, 2) 已在表裡', '那一整串呼叫都省掉了');
  await step(tok);                                   // 14:24 calls ≤ table size m × n
  txt(cnt, '呼叫次數 ≤ 格子數 m × n');
  say('呼叫次數取決於表格的大小', 'm × n → 時間 O(m × n)');
  await step(tok);                                   // 14:42 top-down + memoization: 2ⁿ → m × n
  good('memoization：O(2ⁿ) → O(m × n)', 0, 2.6, 0.6);
  say('top-down 加上 memoization', '時間從 2ⁿ 降到 m × n');
}]);
// DP 填表：一格一格、依講者的句子
const lcsAt = (L, r, c) => L.steps.find((s) => s.r === r && s.c === c);
async function lcsCells(tok, g, L, cells, ms = 380) { for (const [r, c] of cells) await playStep(g, lcsAt(L, r, c), tok, ms, true); }
const lcsRow = (r, a, b) => { const out = []; for (let c = a; c <= b; c++) out.push([r, c]); return out; };
function lcsBack(L, X) {
  // groups of moves ending in a diagonal (one group per LCS letter, from the end)
  let i = X.length, j = L.c[0].length - 1; const groups = []; let cur = [];
  while (i > 0 && j > 0) { const d = L.b[i][j]; cur.push([i, j, d]); if (d === '↖') { groups.push({ cells: cur, ch: X[i - 1] }); cur = []; i--; j--; } else if (d === '↑') i--; else j--; }
  return groups;
}
function lcsMark(g, cells) { for (const [i, j, d] of cells) { g.mark(i, j, d === '↖' ? LG : LT); glow(g.get(i, j), d === '↖' ? GREEN : GOLD); } }
FRAG.push(['dpbari3-lcs-dp-bd', 'LCS 的 DP 表：bd vs abcd → bd', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  const X = 'bd', Y = 'abcd', L = lcsSteps(X, Y);
  let g, f, R;
  const rule = (t) => { if (!f) f = mono(tag('', 'say', 0, 8.2)); txt(f, t); };
  await step(tok);                                   // 14:58 the same example with DP: bottom-up
  const D = buddy('DP', '', TEAL, 5.4, 0, 1.6, 0.7);
  say('同一個例子改用 DP', 'DP 是 bottom-up approach');
  await step(tok);                                   // 15:08 recursion: table bottom→up, method top-down
  bub('遞迴＋memo：表由下往上，方法 top-down', -3.4, 1.4, 1.2);
  say('剛才：表由下往上填', '但方法是 top-down');
  await step(tok);                                   // 15:21 DP: bottom-up, though the table fills top→down
  bub('DP：表由上往下，方法 bottom-up', 3.0, 1.4, 1.2);
  say('DP：方法是 bottom-up，表卻由上往下填', '看的是解題方法，不是填表方向');
  await step(tok);                                   // 15:34 match → diagonal + 1
  rule('相同：左上（對角）+ 1');
  say('演算法：字元相同', '取左上對角的值 + 1');
  await step(tok);                                   // 15:45 no match → max(previous row, previous column)
  rule('相同：左上 + 1　｜　不同：max(上, 左)');
  say('不同：取上面或左邊較大的', '');
  await step(tok);                                   // 15:51 same example; index from 1, no \0
  g = lcsGrid(X, Y);
  for (let j = 0; j <= 4; j++) g.set(0, j, '', GRAY, 0); for (let i = 1; i <= 2; i++) g.set(i, 0, '', GRAY, 0);
  say('同一個例子：index 從 1 開始', '沒有 \\0');
  await step(tok);                                   // 16:18 index 0 row/column filled with 0
  for (let j = 0; j <= 4; j++) g.set(0, j, 0, GRAY, 0.6); for (let i = 1; i <= 2; i++) g.set(i, 0, 0, GRAY, 0.6);
  say('第 0 列、第 0 行留給初始值 0', '');
  await step(tok);                                   // 16:31 fill row by row
  R = tag('→', 'pkt', g.pos(1, 0).x - 1.1, g.pos(1, 0).y, 0.6);
  say('一列一列填', '很簡單');
  await step(tok);                                   // 16:48 b vs a: no → max → 0
  await lcsCells(tok, g, L, [[1, 1]], 900);
  say('b 和 a 不同', 'max(0, 0) = 0');
  await step(tok);                                   // 16:59 b = b → 1 + diagonal = 1
  await lcsCells(tok, g, L, [[1, 2]], 900);
  D.mood('happy');
  say('b 和 b 相同！', '左上 0 + 1 = 1');
  await step(tok);                                   // 17:09 b, c: no → 1
  await lcsCells(tok, g, L, [[1, 3]], 900);
  say('b 和 c 不同', 'max(上 0, 左 1) = 1');
  await step(tok);                                   // 17:21 b, d: no → 1
  await lcsCells(tok, g, L, [[1, 4]], 900);
  say('b 和 d 不同', '一樣是 1');
  await step(tok);                                   // 17:26 row d: a, b, c no → 0, 1, 1
  await travel(tok, R, R.position.clone(), V3(g.pos(2, 0).x - 1.1, g.pos(2, 0).y, 0.6), 400);
  await lcsCells(tok, g, L, [[2, 1], [2, 2], [2, 3]], 600);
  say('下一列 d：和 a、b、c 都不同', '取最大：0、1、1');
  await step(tok);                                   // 17:42 d = d → 1 + 1 = 2
  await lcsCells(tok, g, L, [[2, 4]], 900);
  g.clearArrows(); g.unglow();
  D.mood('happy'); await D.hop(tok);
  say('d 和 d 相同', '左上 1 + 1 = 2');
  await step(tok);                                   // 17:50 LCS size 2; trace back: from the diagonal
  const G = lcsBack(L, X);
  lcsMark(g, G[0].cells);
  rule('LCS 長度 = 2　往回找：' + G[0].ch);
  say('LCS 長度是 2', '這個 2 是左上 + 1 來的 → 走對角');
  await step(tok);                                   // 18:04 this 1 came from its diagonal too
  lcsMark(g, G[1].cells);
  rule('往回找：' + G[1].ch + ' ' + G[0].ch);
  say('這個 1 也是對角 + 1 來的', '上面、左邊都是 0');
  await step(tok);                                   // 18:29 diagonals at d and b → bd
  rule('LCS = bd');
  say('走對角的地方：d 和 b', 'LCS = bd');
  await step(tok);                                   // 18:36 time m × n
  g.unglow();
  rule('格子數 m × n → 時間 O(m × n)');
  say('表有 m × n 格', 'DP 時間 O(m × n)');
}]);
FRAG.push(['dpbari3-lcs-stone', 'LCS 填表：stone vs longest', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  const X = 'STONE', Y = 'LONGEST', L = lcsSteps(X, Y);
  let g, f, R;
  const row = async (r) => { if (R) await travel(tok, R, R.position.clone(), V3(g.pos(r, 0).x - 1.0, g.pos(r, 0).y, 0.6), 300); };
  await step(tok);                                   // 18:51 one more example
  const D = buddy('DP', '', TEAL, 5.6, 0, 1.6, 0.6);
  say('再一個例子', '用 DP 解一個小題目');
  await step(tok);                                   // 19:04 stone and longest
  g = lcsGrid(X, Y);
  say('stone 和 longest', '列是 stone 的字母、行是 longest 的字母');
  await step(tok);                                   // 19:12 index 0 reserved for 0
  for (let j = 0; j <= 7; j++) g.mark(0, j, LT); for (let i = 1; i <= 5; i++) g.mark(i, 0, LT);
  say('index 0 那一列、一行放初始的 0', 'index 從 1 開始');
  await step(tok);                                   // 19:31 the rule
  f = mono(tag('相同：左上 + 1　｜　不同：max(上, 左)', 'say', 0, 8.2));
  g.mark(0, 0, '#efe6d2'); for (let j = 1; j <= 7; j++) g.mark(0, j, '#efe6d2'); for (let i = 1; i <= 5; i++) g.mark(i, 0, '#efe6d2');
  say('照演算法填就能得到答案', '相同取對角 + 1，不同取上、左較大的');
  await step(tok);                                   // 19:55 row s: l o n g e → 0
  R = tag('→', 'pkt', g.pos(1, 0).x - 1.0, g.pos(1, 0).y, 0.6);
  await lcsCells(tok, g, L, lcsRow(1, 1, 5), 380);
  say('s 這一列：和 l、o、n、g、e 都不同', '都是 0');
  await step(tok);                                   // 20:13 s = s → 1
  await lcsCells(tok, g, L, [[1, 6]], 900);
  say('s 和 s 相同', '對角 0 + 1 = 1');
  await step(tok);                                   // 20:21 s vs t: no → max 1
  await lcsCells(tok, g, L, [[1, 7]], 700);
  say('s 和 t 不同', '取最大：1');
  await step(tok);                                   // 20:32 row t: matches only at the end
  await row(2); await lcsCells(tok, g, L, lcsRow(2, 1, 5), 360);
  say('t 這一列：t 在最後才相同', '前面都取最大：0');
  await step(tok);                                   // 20:53 max 1; t = t → 2
  await lcsCells(tok, g, L, [[2, 6], [2, 7]], 800);
  say('上面的 1 抄下來', 't 和 t 相同：對角 1 + 1 = 2');
  await step(tok);                                   // 20:57 o matches → diagonal + 1
  await row(3); await lcsCells(tok, g, L, [[3, 1], [3, 2]], 700);
  say('o 這一列：o 和 o 相同', '對角 0 + 1 = 1');
  await step(tok);                                   // 21:03 no other match: 1 1 … max 2
  await lcsCells(tok, g, L, lcsRow(3, 3, 7), 380);
  say('之後沒有別的 o', '一路取最大：1、1、1、1、2');
  await step(tok);                                   // 21:14 n: till there max 1; match → 2
  await row(4); await lcsCells(tok, g, L, lcsRow(4, 1, 3), 500);
  say('n 這一列：n 和 n 相同', '對角 1 + 1 = 2');
  await step(tok);                                   // 21:26 after the match: max 2 2 2
  await lcsCells(tok, g, L, lcsRow(4, 4, 7), 400);
  say('之後取最大', '2、2、2、2');
  await step(tok);                                   // 21:39 row e: max until the match
  await row(5); await lcsCells(tok, g, L, lcsRow(5, 1, 4), 450);
  say('e 這一列：相同之前都取最大', '0、1、2、2');
  await step(tok);                                   // 21:56 e = e → 3, then 3 3
  await lcsCells(tok, g, L, lcsRow(5, 5, 7), 650);
  g.clearArrows(); g.unglow();
  D.mood('happy'); await D.hop(tok);
  say('e 和 e 相同：對角 2 + 1 = 3', '之後 3、3');
}]);
FRAG.push(['dpbari3-lcs-stone-trace', 'LCS 回溯：得到 ONE', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  const X = 'STONE', Y = 'LONGEST';
  const g = lcsGrid(X, Y), L = lcsSteps(X, Y);
  for (const s of L.steps) g.set(s.r, s.c, s.v, s.color, 0);
  const G = lcsBack(L, X);
  const out = mono(tag('LCS = ', 'pkt', 0, 0.9, 0.6));
  let got = '';
  await step(tok);                                   // 22:05 LCS size 3
  glow(g.get(5, 7), GOLD);
  say('右下角：LCS 長度是 3', '');
  await step(tok);                                   // 22:09 which letters?
  say('是哪些字母？', '從右下角往回走');
  await step(tok);                                   // 22:14 3 from the max → left … then diagonal: E
  lcsMark(g, G[0].cells); got = G[0].ch + got; txt(out, 'LCS = ' + got);
  say('3 是取最大抄來的 → 往那邊走', '前面沒有 3 了：由對角 + 1 來 → E');
  await step(tok);                                   // 22:28 2 from the diagonal: N
  lcsMark(g, G[1].cells); got = G[1].ch + got; txt(out, 'LCS = ' + got);
  say('這個 2：上、左都沒有 2', '是對角 + 1 來的 → N');
  await step(tok);                                   // 22:46 1 from the diagonal: O
  lcsMark(g, G[2].cells); got = G[2].ch + got; txt(out, 'LCS = ' + got);
  say('這個 1：上、左都是 0', '對角 + 1 → O');
  await step(tok);                                   // 22:53 answer ONE
  out.element.className = 'lab-label good';
  say('LCS = ONE', '長度 3');
  await step(tok);                                   // 23:05 repeating letters: be careful
  g.unglow();
  say('字母重複很多時要更小心', '這裡用簡單的例子方便理解');
  await step(tok);                                   // 23:14 time m × n
  bub('時間 O(m × n)：m、n 是兩字串長度', 0, 8.2);
  say('DP 時間取決於兩個字串的長度', 'O(m × n)');
}]);
  }

  // ═══ dpjiang1.js ═══
  {
// ─── 交大江蕙如：359YMyqbEG4（Lec17 DP 1/3）、S5vS9YEvnFU（Lec19 DP 3/3） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in
// each step comment is the transcript line where the lecturer starts saying it). Motion between steps is
// short; nothing loops or replays. Little buddies react to what happens.
// 老師的例子：
//   Weighted interval scheduling（KT Fig 6.2 那組）：v = 2 4 4 7 2 1、p = 0 0 1 0 3 3；O6 = {6}∪O3 或 O5；
//   OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))；遞迴樹 6→5,3、5→4,3…；memo 後只算 6 次；M[0..6] = 0 2 4 6 7 8 8。
//   greedy（最早結束）反例 1 3 1；Fibonacci F0 = 0、F1 = 1，F5 → F4、F3；F[] 先填 −1；maze routing（wave propagation，O(mn)，
//   倒著數 12 11 … 1）。
//   Lec19：Bellman-Ford 表（KT Fig 6.23）b 欄 5 = min(−2, −1+2, −2+0) = −2；O(nm)；只要前一欄；negative cycle；
//   套利 $1 → 1.3941 法郎 → 0.9308 歐元 → $1.00084（金 1 → $327.25）；−log 轉換；多跑一輪偵測；鴿籠證明；
//   加一個新點 t（全部 0 邊）；TSP：OPT(S,u,v)、2ⁿn² / 2ⁿn³ vs n!；DP = 聰明的 recursion。
// 示意值：迷宮的牆、D&C／paradigm 的方塊、negative cycle 與 n = 3 小圖的邊權、TSP 城市位置。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove } = K;
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', gold: '#c08a1f', brown: '#6e5f49', cyan: '#31aab0', gray: '#bdb3a2' };
const LV = [C.purple, C.blue, C.cyan, C.orange, C.pink, C.gold];
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
const fade = (m, on) => { m.material.transparent = !on; m.material.opacity = on ? 1 : 0.25; };
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a little helper character standing on the floor in front of the picture
const pal = (name, x, color = '#f4a56a', z = 1.6, size = 0.75, y = 0) => buddy(name, '', color, x, y, z, size);
const hl = (l, on) => { l.element.className = 'lab-label ' + (on ? 'ptr alt' : 'ptr'); };
// generic tree layout: node = { kids: [] }; leaves spaced by sp, parents centred over kids
function layout(root, sp, yTop, dy, cx = 0) {
  const all = []; let leaf = 0;
  (function walk(t, d, par) {
    t.d = d; t.par = par; all.push(t);
    if (!t.kids.length) t.lx = leaf++;
    else { t.kids.forEach((k) => walk(k, d + 1, t)); t.lx = (t.kids[0].lx + t.kids[t.kids.length - 1].lx) / 2; }
  })(root, 0, null);
  all.forEach((t) => { t.x = cx + (t.lx - (leaf - 1) / 2) * sp; t.y = yTop - t.d * dy; });
  return all;
}
const sub = (t) => [t].concat(...t.kids.map(sub));
const pre = (T) => { const o = []; (function w(t) { o.push(t); t.kids.forEach(w); })(T); return o; };

// ── weighted interval scheduling 資料（依 finish time 排好） ──
const WJ = [null, { s: 0, f: 3, v: 2, p: 0 }, { s: 1, f: 5, v: 4, p: 0 }, { s: 4, f: 7, v: 4, p: 1 }, { s: 2, f: 8, v: 7, p: 0 }, { s: 7, f: 10, v: 2, p: 3 }, { s: 7.5, f: 11, v: 1, p: 3 }];
const WM = [0, 2, 4, 6, 7, 8, 8];
const TX = (t) => (t - 5.5) * 1.0;
const JY = (j) => 7.0 - j * 0.72;
function drawJobs(withV = true, yOff = 0) {
  line(TX(0) - 0.3, JY(6) - 0.55 + yOff, TX(11) + 0.3, JY(6) - 0.55 + yOff, 0, C.brown);
  for (const t of [0, 3, 5, 7, 8, 10, 11]) tag(String(t), 'idx', TX(t), JY(6) - 0.85 + yOff);
  const ms = [];
  for (let j = 1; j <= 6; j++) {
    const J = WJ[j];
    ms[j] = box(withV ? 'v=' + J.v : '', LV[j - 1], (TX(J.s) + TX(J.f)) / 2, JY(j) + yOff, TX(J.f) - TX(J.s) - 0.06, 0.42, 0.35);
    ms[j].userData.id = tag(String(j), 'ptr', TX(J.s) - 0.35, JY(j) + yOff);
  }
  return ms;
}
// recursion tree of Compute-Opt(6)（省略 OPT(0)）：kids = [j−1, p(j)]
function optTree(j) { const k = []; if (j - 1 >= 1) k.push(optTree(j - 1)); if (WJ[j].p >= 1) k.push(optTree(WJ[j].p)); return { j, kids: k }; }
const fibT = (n) => ({ n, kids: n <= 1 ? [] : [fibT(n - 1), fibT(n - 2)] });

// ════════════════ 359YMyqbEG4（Lec17 Dynamic Programming 1/3） ════════════════

// 03:35 Divide & Conquer 回顧：divide → conquer → combine
FRAG.push(['dpjiang1-dc-review', 'Divide & Conquer 回顧：拆、遞迴解、合併', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  await step(tok);                                   // 215.0 先 review D&C：和 DP 像雙胞胎
  const dc = pal('D&C', -5.6, C.blue), dp = pal('DP', -4.2, C.orange);
  dc.look(1); dp.look(-1);
  const tw = bub('我們很像，但本質不一樣', -4.9, 2.2, 1.6);
  say('先快速 review Divide & Conquer', '它和 DP 像雙胞胎');
  await step(tok);                                   // 238.0 直接處理一個問題太複雜
  remove(tw); dp.look(0); dc.mood('wow');
  const top = box('n', C.purple, 0, 7.2, 4.6, 0.6, 0.5, 1.2);
  const hard = bub('太大了，直接解好難…', 3.6, 8.2);
  say('一個大問題：直接處理太複雜', '');
  await step(tok);                                   // 243.0 divide：先拆成小問題
  remove(hard); dc.mood('calm');
  const lv1 = [-2.6, 2.6].map((x) => box('n/2', C.blue, x, 5.6, 2.2, 0.55, 0.5, 1.0));
  const e1 = lv1.map((m) => line(0, 6.9, m.position.x, 5.9, 0, C.sand));
  tag('divide', 'ptr', -5.4, 6.4);
  say('第一步 divide：把大問題拆成小問題', '');
  await step(tok);                                   // 249.0 problem size 小了，比較好解
  const lv2 = [-3.9, -1.3, 1.3, 3.9].map((x) => box('n/4', C.cyan, x, 4.0, 1.1, 0.5, 0.5, 1.0));
  const e2 = lv2.map((m, k) => line(lv1[k >> 1].position.x, 5.35, m.position.x, 4.25, 0, C.sand));
  say('拆小了，problem size 就變小', '小問題比較有機會解');
  await step(tok);                                   // 264.0 小問題要和原問題同性質
  const same = note('拆完還是「同一種問題」，只是比較小', 0, 2.9);
  say('唯一條件：小問題要和原問題同性質', '拆完變成別種問題就不算成功');
  await step(tok);                                   // 277.0 每一塊 recursively conquer
  remove(same);
  tag('conquer', 'ptr', -5.4, 4.0);
  for (const m of lv2) { glow(m, GOLD); await beat(tok, 260); }
  say('每一塊再 recursively conquer', '同樣的方法再拆下去');
  await step(tok);                                   // 283.0 拆到 simple enough 就停
  lv2.forEach((m) => { glow(m, null); tint(m, C.teal); });
  good('simple enough：直接有答案', 0, 2.9);
  dc.mood('happy');
  say('拆到 simple enough 就停', '答案一眼就看得出來');
  await step(tok);                                   // 299.0 combine：把小答案兜回大答案
  tag('combine', 'ptr alt', -5.4, 5.6);
  lv2.forEach((m) => relabel(m, '')); // names off while the pieces merge back
  for (let k = 0; k < 2; k++) { move(lv2[2 * k], lv1[k].position.x - 0.3, 5.6, 0); move(lv2[2 * k + 1], lv1[k].position.x + 0.3, 5.6, 0); }
  await beat(tok, 800);
  lv2.forEach(kill); e2.forEach(kill); lv1.forEach((m) => tint(m, C.teal));
  lv1.forEach((m) => { relabel(m, ''); move(m, 0, 7.2, 0); });
  await beat(tok, 800);
  lv1.forEach(kill); e1.forEach(kill); tint(top, C.teal);
  say('最後 combine：小答案兜回大問題的答案', '');
  await step(tok);                                   // 313.0 combine 最困難
  glow(top, GOLD); dc.mood('wow');
  bad('combine 通常最難設計', 3.6, 8.2);
  say('幾乎所有 D&C，combine 都最困難', '它決定 time complexity 好不好');
  await step(tok);                                   // 327.2 設計方法和數學歸納法結合
  glow(top, null); dc.mood('calm');
  pkt('數學歸納法（induction）', -3.6, 3.0);
  say('D&C 的設計和數學歸納法綁在一起', '例如貼磁磚的例子');
  await step(tok);                                   // 349.0 正確性也用數學歸納法證
  good('正確性：用歸納法證明', -3.6, 2.2);
  say('所以證明正確性也用數學歸納法', '');
  await step(tok);                                   // 364.0 implementation 配合 recursive code
  const cd = code(['solve(n):', '  if n 很小: 直接解', '  solve(左半); solve(右半)', '  combine'], 2.2, 3.6, 0.42);
  cd.hl(2);
  say('實作通常是 recursive code', '函式自己呼叫自己');
  await step(tok);                                   // 375.0 寫 recurrence relation 分析
  cd.hl(-1);
  const rc = tag('T(n) = 2T(n/2) + O(n)', 'ptr alt', 2.2, 1.6);
  say('分析時間：寫出 recurrence relation', '例：merge sort');
  await step(tok);                                   // 380.0 展開法／recursion tree
  txt(rc, 'T(n) 展開 → recursion tree → O(n log n)');
  say('解法一：展開（iteration）', '也可以畫 recursion tree');
  await step(tok);                                   // 395.0 猜答案再用歸納法證
  bub('或先猜答案，再用數學歸納法證', 2.2, 0.8);
  dp.look(1); await dp.hop(tok);
  say('解法二：猜一個答案，再用歸納法證', '這就是 D&C 的 review');
}]);

// 06:58 Programming = 數學最佳化；DP 隱式試遍所有子問題、順序是關鍵
FRAG.push(['dpjiang1-dp-idea', 'DP：Programming 是最佳化；隱式試遍、照順序算', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const bel = pal('', -5.8, C.orange);
  await step(tok);                                   // 421.0 Programming ≠ 寫程式
  const pc = prop('monitor', -3.4, 4.6, 0, 1.2, 'coding？');
  bad('Programming ≠ coding', -3.4, 7.2);
  say('Dynamic Programming 的 Programming', '不是寫程式的意思');
  await step(tok);                                   // 431.0 Mathematical Programming：Linear、Quadratic…
  kill(pc);
  const words = ['Linear', 'Quadratic', 'Convex', 'Non-linear'].map((w, k) => tag(w + ' Programming', 'idx', -3.4, 6.2 - k * 0.55));
  say('是 Mathematical Programming', '例如 linear / quadratic programming：最佳化');
  await step(tok);                                   // 461.9 DP 用來解最佳化問題
  pkt('DP → 最佳化問題', 3.0, 7.2);
  say('所以 DP 典型用來解最佳化問題', '');
  await step(tok);                                   // 478.6 解有 quality：objective
  const sc = tag('objective：評分方式', 'ptr', 3.0, 6.4);
  say('解不只要對，還要分數最好', '有一個 objective（cost function）');
  await step(tok);                                   // 500.0 minimization / maximization
  txt(sc, 'objective：min cost／max value');
  say('分成 minimization 或 maximization', '求最小或最大');
  await step(tok);                                   // 515.0 Bellman 1953
  words.forEach(kill);
  const nm = tag('Richard Bellman，1953', 'ptr alt', -3.4, 6.6);
  bel.mood('happy'); await bel.hop(tok);
  say('Richard Bellman 在 1953 年發表', '之前已經醞釀很久');
  await step(tok);                                   // 545.0 軍方單位，老闆不喜歡純數學
  const boss = pal('老闆', -2.2, C.gray);
  boss.mood('sad'); bel.look(1);
  const b1 = bub('數學？不給錢…', -2.2, 2.0, 1.6);
  say('他在軍方做研究，老闆不愛純數學', '名字太數學就拿不到 funding');
  await step(tok);                                   // 601.0 取名 Dynamic Programming
  remove(b1); boss.mood('happy');
  bub('Dynamic Programming？聽起來不錯！', -2.2, 2.0, 1.6);
  say('取名 Dynamic Programming', '外行看不出跟數學有關');
  await step(tok);                                   // 629.7 basic idea：D&C 完全展開
  kill(nm);
  tag('Divide & Conquer：完全展開', 'ptr', -3.4, 5.4);
  const L = layout({ k: 4, kids: [{ k: 3, kids: [{ k: 2, kids: [] }, { k: 1, kids: [] }] }, { k: 2, kids: [{ k: 1, kids: [] }, { k: 0, kids: [] }] }] }, 1.0, 4.6, 1.15, -3.4);
  for (const t of L) { if (t.par) line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand); t.m = box('P' + t.k, LV[t.d], t.x, t.y, 0.8, 0.45, 0.4, 1.0); await beat(tok, 160); }
  say('D&C：recursive call 把子問題全部攤開', '每個都很明白地算一遍');
  await step(tok);                                   // 668.0 DP 也看過所有子問題，但 implicitly
  L.forEach((t) => { if (t.k === 2 || t.k === 1) glow(t.m, GOLD); });
  tag('DP：implicitly 試遍', 'ptr', 3.4, 5.4);
  say('DP 也看過所有 subproblem', '但不是一個一個攤開：implicitly');
  await step(tok);                                   // 697.0 從小的 solution 兜出大的
  L.forEach((t) => glow(t.m, null));
  const cells = [0, 1, 2, 3, 4].map((k) => box('P' + k, C.gray, 1.4 + k * 1.0, 3.6, 0.85, 0.5, 0.45));
  for (let k = 0; k < 5; k++) {
    tint(cells[k], C.teal);
    if (k) link([1.4 + (k - 1) * 1.0, 3.6], [1.4 + k * 1.0, 3.6], C.teal, 0.43);
    await beat(tok, 300);
  }
  say('從小的 solution 兜出大的 solution', '');
  await step(tok);                                   // 726.0 計算順序是 key idea
  cells.forEach((m) => glow(m, GREEN));
  note('計算順序 = key idea', 3.4, 2.4);
  say('最講究的是：子問題的計算順序', '順序對了，DP 才會正常運作');
  await step(tok);                                   // 780.0 培養 sense：看出能用 DP
  cells.forEach((m) => glow(m, null));
  bel.look(0); bel.mood('wow');
  bub('這題聞起來像 DP？', -5.8, 2.2, 1.6);
  say('之後要培養 sense', '看到題目就聞得出適不適合 DP');
}]);

// 13:24 Weighted interval scheduling：個數最多 ≠ value 最大；greedy 反例 1 3 1
FRAG.push(['dpjiang1-wis-greedy', 'Weighted interval scheduling：greedy 失效（1 3 1）', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.8, 0]);
  const X = (t) => (t - 4) * 1.15;
  await step(tok);                                   // 804.0 第一個問題：WIS
  const cpu = prop('cpu', -5.6, 0, 1.4, 0.9, 'single core');
  bob(cpu, 0.04);
  tag('Weighted Interval Scheduling', 'ptr alt', 0, 8.0);
  say('第一個問題：Weighted Interval Scheduling', '開學列的代表性問題之一');
  await step(tok);                                   // 827.0 DP 的基礎是數學歸納法
  const ind = pkt('DP ＝ induction？', 3.6, 7.2);
  say('DP 最基礎的數學 idea 是數學歸納法', '有老師說：送你一個字 induction');
  await step(tok);                                   // 878.0 有 weight；request 有 start / finish
  remove(ind);
  line(X(0) - 0.3, 2.0, X(8) + 0.3, 2.0, 0, C.brown); tag('time', 'idx', X(8) + 0.6, 2.0);
  const R0 = [[0, 2, 5.6], [0.5, 4.8, 4.8], [2.2, 4.4, 4.0], [5, 8, 3.2]].map(([s, f, y], k) => box(' ', C.gray, (X(s) + X(f)) / 2, y, X(f) - X(s) - 0.06, 0.45, 0.4, 1.0));
  say('每個 request 有 start 和 finish time', '占用一段 interval');
  await step(tok);                                   // 922.0 single core 一次一個；以前要做最多個
  [0, 2, 3].forEach((k) => tint(R0[k], C.blue));
  const cnt = tag('以前：做越多個越好（例：12、13、16 三個）', 'ptr', 0, 7.2);
  say('一次只能做一個 request', '以前的目標：個數最多');
  await step(tok);                                   // 947.0 每個 request 做完有 value
  R0.forEach((m, k) => relabel(m, 'v=' + [12, 26, 13, 16][k]));
  say('現在：每個 request 做完會得到 value', '');
  await step(tok);                                   // 969.0 最佳解只要兩個：26 + 16 = 42
  R0.forEach((m) => tint(m, C.gray)); [1, 3].forEach((k) => { tint(R0[k], C.orange); glow(R0[k], GREEN); });
  txt(cnt, '這題最佳：兩個 request，26 + 16 = 42');
  say('最佳解只要兩個：26 + 16 = 42', '比做三個的 value 還大');
  await step(tok);                                   // 1005.0 unit weight vs non-uniform weight
  R0.forEach(kill);
  txt(cnt, '個數 = 每個 value 都一樣（unit weight）');
  say('只看個數 = 每個 value 都一樣', '現在是 non-uniform weight');
  await step(tok);                                   // 1037.0 greedy：每次挑最早結束的
  txt(cnt, 'greedy：每次挑 finish time 最早的');
  const J = [{ s: 0, f: 3, v: 1, y: 5.6 }, { s: 2, f: 7, v: 3, y: 4.4 }, { s: 4, f: 8, v: 1, y: 3.2 }];
  say('之前的 greedy：照 finish time 排', '挑最早結束的，刪掉衝突的，再重複');
  await step(tok);                                   // 1062.0 小例子：weight 1 3 1
  const ms = J.map((j, k) => box('v=' + j.v, LV[k + 1], (X(j.s) + X(j.f)) / 2, j.y, X(j.f) - X(j.s) - 0.06, 0.5, 0.4, 1.2));
  say('小例子：三個 request，weight 1 3 1', '');
  await step(tok);                                   // 1071.0 greedy 選兩個 1：value 2
  const g = pal('greedy', 5.6, C.blue);
  glow(ms[0], GOLD); tint(ms[0], C.teal);
  fly(ms[1]);
  await beat(tok, 700);
  glow(ms[2], GOLD); tint(ms[2], C.teal);
  g.mood('happy');
  bub('1 + 1 = 2', 5.6, 2.2, 1.6);
  say('greedy 選兩個 1：value = 2', '');
  await step(tok);                                   // 1077.0 最佳解只選 3
  glow(ms[0], null); glow(ms[2], null); fly(ms[0]); fly(ms[2]);
  const best = box('v=3', C.orange, (X(2) + X(7)) / 2, 4.4, X(7) - X(2) - 0.06, 0.5, 0.4, 2);
  await beat(tok, 700);
  glow(best, GREEN); g.mood('sad');
  bad('greedy 2 < 最佳 3', 0, 1.0);
  say('最佳解只選中間那個：value = 3', '有 weight 時 greedy 不保證最佳');
}]);

// 18:12 第一個企圖：induction on time（刻度 Δ 不好控制）
FRAG.push(['dpjiang1-wis-time', 'Induction on time：Δ 的刻度不好控制', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 1097.0 給一些 request，各有 value
  const ms = drawJobs(true);
  say('6 個 request，各有 value', '做完得到 2 塊、4 塊…');
  await step(tok);                                   // 1136.0 第一個企圖
  me.mood('wow');
  bub('要對什麼做 induction？', -5.4, 2.0, 1.6);
  say('最難的是決定 induction 在什麼上面', '第一個企圖');
  await step(tok);                                   // 1151.0 用時間當 induction 的 base
  const tl0 = pkt('time →', TX(0), 7.6);
  await travel(tok, tl0, V3(TX(0), 7.6, 0), V3(TX(11), 7.6, 0), 1400);
  say('想法一：在時間軸上做 induction', '時間慢慢往後推');
  await step(tok);                                   // 1173.0 先照 finish time 排好
  remove(tl0);
  for (let j = 1; j <= 6; j++) { glow(ms[j], GOLD); await beat(tok, 150); glow(ms[j], null); }
  say('和 greedy 一樣：先照 finish time 排序', '1 號最早結束…6 號最晚');
  await step(tok);                                   // 1202.0 時間 0 到 t 的最大 value
  const cur = box('', C.red, TX(11), 4.4, 0.08, 5.6, 0.08);
  const tl = tag('t', 'ptr alt', TX(11), 7.6);
  say('問：從時間 0 到 t，最大 value 是多少？', '');
  await step(tok);                                   // 1237.0 = 小一點的 t′ 的答案 + Δ
  const cur2 = box('', C.blue, TX(10.4), 4.4, 0.08, 5.6, 0.08);
  const tl2 = tag("t′", 'ptr', TX(10.4), 7.6);
  const dl = tag('Δ', 'idx', TX(10.7), 8.0);
  say("OPT(t) = OPT(t′) + Δ 那一小段的貢獻", '一般 induction 的想法');
  await step(tok);                                   // 1320.0 區間要取多大？
  await anim(tok, 1600, (e) => { cur2.position.x = TX(10.4 - 3 * e); tl2.position.x = cur2.position.x; dl.position.x = (cur2.position.x + TX(11)) / 2; });
  me.mood('sad');
  say('問題：Δ 要切多大？', '固定刻度很難寫成好算的 recursion');
  await step(tok);                                   // 1346.0 t 剛好落在最後 request 結束
  kill(dl); glow(ms[6], GOLD);
  say('其實 t 剛好卡在最後一筆 request 結束', '');
  await step(tok);                                   // 1368.0 只考慮兩件事
  const q = bub('第 6 筆要不要算？', TX(9.2), 7.0);
  say('只要問：最後這筆在不在最佳解裡', '是的話怎樣？不是的話怎樣？');
  await step(tok);                                   // 1398.0 要算：前面只能到 s₆ 之前
  remove(q);
  cur2.position.x = TX(7.5); tl2.position.x = TX(7.5); txt(tl2, 's₆');
  ms.forEach((m, j) => { if (j && j <= 3) tint(m, C.teal); });
  say('要算 6：前面只能累計到 s₆ 之前', '再加上 v₆');
  await step(tok);                                   // 1419.0 刻度不是固定的
  note('這一段不是固定的 Δ', TX(9.3), 1.6);
  say('切的位置不是固定的刻度', '');
  await step(tok);                                   // 1439.0 不要算：前 5 筆的答案
  ms.forEach((m, j) => { if (j && j <= 3) tint(m, LV[j - 1]); });
  glow(ms[6], null); fade(ms[6], false);
  cur2.position.x = TX(10); tl2.position.x = TX(10); txt(tl2, 'f₅');
  say('不要算 6：就是倒數第二筆以前的答案', '');
  await step(tok);                                   // 1459.0 時間軸不好控制，走不下去
  kill(cur); kill(tl);
  bad('時間軸不好控制 ✗', 0, 0.6);
  me.look(1);
  say('用時間軸做 induction 不好控制', '這條路走不下去');
}]);

// 24:39 Induction on index；p(j)：往前最後一個不重疊的
FRAG.push(['dpjiang1-wis-p', 'p(j)：往前最後一個不會 overlap 的 request', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 1478.9 第二個企圖：每次多考慮一個 request
  const ms = drawJobs(true);
  for (let j = 1; j <= 6; j++) fade(ms[j], false);
  me.mood('happy');
  say('第二個企圖（這次會成功）', '每次多考慮一個 request');
  await step(tok);                                   // 1499.0 依 finish time 由小排到大
  for (let j = 1; j <= 6; j++) { fade(ms[j], true); await beat(tok, 160); }
  say('一樣先依 finish time 由小排到大', 'f₁ ≤ f₂ ≤ … ≤ f₆');
  await step(tok);                                   // 1516.2 每次前進一格：前 1、前 2、前 3…
  const cut = box('', C.red, TX(3) + 0.1, 4.6, 0.06, 4.8, 0.06);
  for (let j = 1; j <= 6; j++) { cut.position.x = TX(WJ[j].f) + 0.1; glow(ms[j], GOLD); await beat(tok, 330); }
  say('前 1 個、前 2 個、前 3 個…', '每次往後多切一格');
  await step(tok);                                   // 1543.0 induction 在 index 上
  kill(cut); for (let j = 1; j <= 6; j++) glow(ms[j], null);
  for (let j = 1; j <= 6; j++) hl(ms[j].userData.id, true);
  say('induction 的對象是 index：1 號、2 號…', '不是時間');
  await step(tok);                                   // 1555.0 n 個的解和前 n−1 個的關係
  const rel = tag('前 n 個的最佳解 ⇐ 前 n−1 個的最佳解？', 'ptr alt', 0, 8.2);
  say('前 n 個的最佳解，和前 n − 1 個的關係？', '');
  await step(tok);                                   // 1582.4 決定 induction 對象最難
  for (let j = 1; j <= 6; j++) hl(ms[j].userData.id, false);
  txt(rel, '選對 induction 的對象 ≈ 完成 80～90%');
  me.mood('wow'); await me.hop(tok);
  say('決定 induction 在誰身上最困難', '選對了，DP 幾乎完成八、九成');
  await step(tok);                                   // 1607.0 照 finish time 排也是 DP trick
  txt(rel, '照 finish time 排序：也是 DP 的 trick');
  say('照 finish time 排序也有講究', '這題的 DP trick 之一');
  await step(tok);                                   // 1630.0 定義參數 p
  txt(rel, 'p(j)：往前最後一個跟 j 不重疊的 request');
  me.mood('calm');
  say('定義一個參數 p', '看意思比背定義好');
  await step(tok);                                   // 1652.0 把自己槓掉，往前找不 overlap 的
  glow(ms[6], GOLD);
  const bar = box('', C.red, TX(WJ[6].s), 4.6, 0.06, 4.8, 0.06);
  const x6 = bad('✗ 先劃掉自己', TX(9.5), JY(6) + 0.55);
  say('把自己槓掉，往前看', '哪些 request 和我完全不 overlap');
  await step(tok);                                   // 1669.8 第 6 筆：p = 3
  remove(x6);
  for (let i = 1; i < 6; i++) fade(ms[i], i <= 3);
  glow(ms[3], GREEN);
  const plab = [];
  plab[6] = note('p=3', TX(WJ[6].f) + 0.55, JY(6));
  say('第 6 筆：第 3 筆以前都不會 overlap', 'p(6) = 3');
  await step(tok);                                   // 1693.0 第 2 筆：p = 0
  glow(ms[6], null); glow(ms[3], null); kill(bar);
  for (let i = 1; i <= 6; i++) fade(ms[i], true);
  glow(ms[2], GOLD); fade(ms[1], false);
  const bar2 = box('', C.red, TX(WJ[2].s), 4.6, 0.06, 4.8, 0.06);
  plab[2] = note('p=0', TX(WJ[2].f) + 0.55, JY(2));
  say('第 2 筆：前面那筆就 overlap 了', 'p(2) = 0：沒有人');
  await step(tok);                                   // 1709.0 依此類推，每個都算出 p
  kill(bar2); glow(ms[2], null); fade(ms[1], true);
  for (const j of [1, 3, 4, 5]) { plab[j] = note('p=' + WJ[j].p, TX(WJ[j].f) + 0.55, JY(j)); await beat(tok, 300); }
  say('依此類推：p = 0 0 1 0 3 3', '大家可以回去驗算');
  await step(tok);                                   // 1729.0 p 只是讓式子好寫
  say('p 只是讓式子比較好寫', 'idea 不變');
  await step(tok);                                   // 1743.0 求前 n 個的答案；一般的 index j
  txt(rel, '目標：OPT(n)；先看一般的 index j');
  say('目標是前 n 個累計的最大 value', '先寫出一般 index j 的關係');
}]);

// 29:30 OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))；O6 = {6} ∪ O3 或 O5
FRAG.push(['dpjiang1-wis-recur', 'OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const ms = drawJobs(true, 0.6);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 1771.0 Oⱼ：最佳解由哪些 request 組成
  const d1 = tag('Oⱼ：前 j 個的最佳解「由誰組成」', 'ptr', -1.4, 1.2);
  say('定義 Oⱼ：累計到 j 的最佳解是哪些 request', '是一個 set');
  await step(tok);                                   // 1791.0 OPT(j)：那個最大值
  const d2 = tag('OPT(j)：它的最大 value（一個數）', 'ptr', -1.4, 0.5);
  say('OPT(j)：對應算出來的最大 value', 'O 是組成，OPT 是值');
  await step(tok);                                   // 1810.0 拿最後一個人來看 O6
  kill(d1); kill(d2);
  glow(ms[6], GOLD);
  say('拿最後一個來看：O6 長什麼樣？', '善用前面累計的結果');
  await step(tok);                                   // 1838.0 只要考慮兩個 case
  const q = bub('6 號：要算？不要算？', TX(9.2), 7.9);
  say('只要考慮兩個 case', '第 6 筆要算，或不要算');
  await step(tok);                                   // 1867.0 case 1：第 6 個要算
  remove(q);
  tint(ms[6], C.orange);
  const c1 = tag('case 1：{6} ∪ ？', 'ptr alt', -1.2, 1.2);
  say('case 1：6 要算', '那 6 之外還有誰？');
  await step(tok);                                   // 1876.4 前面紅色那包：O3
  for (let i = 1; i <= 5; i++) fade(ms[i], i <= 3);
  [1, 2, 3].forEach((i) => tint(ms[i], C.teal));
  txt(c1, 'case 1：{6} ∪ O3');
  say('再加上前面那一包的最佳解：O3', '6 和 O3 兜出一個解');
  await step(tok);                                   // 1892.0 3 怎麼找？p(6)
  const pn = note('3 = p(6)', TX(WJ[6].f) + 0.6, JY(6) + 0.6);
  say('3 從哪來？就是 p(6)', '6 劃掉後，往前不重疊的累計到第 3 筆');
  await step(tok);                                   // 1910.0 case 2：不算 6 → O5
  remove(pn);
  [1, 2, 3].forEach((i) => tint(ms[i], LV[i - 1])); tint(ms[6], LV[5]);
  for (let i = 1; i <= 6; i++) fade(ms[i], i <= 5);
  [1, 2, 3, 4, 5].forEach((i) => tint(ms[i], C.blue));
  glow(ms[6], null);
  const c2 = tag('case 2：O5', 'ptr', -1.2, 0.5);
  say('case 2：6 不要算', '往前推一個：就是 O5');
  await step(tok);                                   // 1933.0 OPT(6) = 兩者取大
  [1, 2, 3, 4, 5].forEach((i) => tint(ms[i], LV[i - 1]));
  for (let i = 1; i <= 6; i++) fade(ms[i], true);
  txt(c1, 'OPT(6) = max( v₆ + OPT(3) , OPT(5) )'); kill(c2);
  me.mood('happy');
  say('OPT(6)：看兩種 option 誰比較厲害', '要 maximum value → 取其大');
  await step(tok);                                   // 1956.0 推廣到一般的 j
  txt(c1, 'OPT(j) = max( ？ , ？ )');
  say('推廣到一般的 index j', '一樣只有兩種可能');
  await step(tok);                                   // 1983.0 不算 j：OPT(j−1)
  txt(c1, 'OPT(j) = max( ？ , OPT(j − 1) )');
  say('j 不要算：直接取前一個的解', 'OPT(j − 1)');
  await step(tok);                                   // 1990.0 算 j：vⱼ + OPT(p(j))
  txt(c1, 'OPT(j) = max( vⱼ + OPT(p(j)) , OPT(j − 1) )');
  tag('OPT(0) = 0', 'idx', -1.2, 0.5);
  say('j 要算：vⱼ 加上不重疊的那些人', 'vⱼ + OPT(p(j))，兩者取大');
  await step(tok);                                   // 2006.0 recursion 寫出來就做完了
  hl(c1, false); glow(ms[6], GREEN);
  await me.hop(tok);
  say('recursion 寫出來，DP 的目標就達成了', '接下來只是 implement');
}]);

// 33:41 直接翻成 recursive code → 遞迴樹很多重複
FRAG.push(['dpjiang1-wis-tree', 'Compute-Opt 的遞迴樹：重複的子問題', async (tok) => {
  fresh([0, 4.0, 15], [0.6, 4.2, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2021.0 implementation 決定真 DP 或假 DP
  const rec = tag('OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))', 'ptr alt', 3.4, 8.6);
  say('procedure 怎麼寫？', '它決定你做的是真 DP 還是假 DP');
  await step(tok);                                   // 2035.7 直接翻成 recursive code
  const cd = code(['Compute-Opt(j):', '  if j = 0: return 0', '  return max(Compute-Opt(j-1),', '             v[j] + Compute-Opt(p[j]))'], -4.6, 8.6, 0.45);
  say('recursion 可以直接翻成 recursive code', '很直覺');
  await step(tok);                                   // 2051.0 preprocessing：依 finish time 排序
  const pp = note('前置：f₁ ≤ f₂ ≤ … ≤ fₙ', -4.6, 6.4);
  say('前置作業一：依 finish time 排好', 'index 已重新安排');
  await step(tok);                                   // 2067.0 算好每個 p(j)
  txt(pp, '前置：排序 ＋ 算好 p(1..n)');
  say('前置作業二：每個 request 算好 p 值', '');
  await step(tok);                                   // 2093.7 boundary：j = 0 return 0
  cd.hl(1);
  say('boundary condition：j = 0', '沒有 request，return 0');
  await step(tok);                                   // 2109.0 兩種 case 取 max
  cd.hl(2);
  say('其他：照 recursion 算兩種 case', '不貢獻取前一筆；貢獻就加 vⱼ + OPT(p(j))');
  await step(tok);                                   // 2138.0 右邊龐大的 tree：每個 node 是一個 call
  cd.hl(-1); remove(pp); kill(rec);
  const T = optTree(6);
  const all = layout(T, 1.35, 6.6, 1.0, 1.4);
  T.m = box('O6', LV[0], T.x, T.y, 0.75, 0.45, 0.4, 1.0);
  say('畫出 recursive call 產生的 tree', '每個 node 就是一次 recursive call');
  await step(tok);                                   // 2172.0 O6 呼叫 O5 和 O3
  cd.hl(2);
  for (const k of T.kids) { k.e = line(T.x, T.y - 0.25, k.x, k.y + 0.25, 0, C.sand); k.m = box('O' + k.j, LV[(6 - k.j) % 6], k.x, k.y, 0.75, 0.45, 0.4, 1.0); }
  say('O6 往下呼叫 O5 和 O3', '再比誰比較厲害');
  await step(tok);                                   // 2188.0 O5 呼叫 O4、O3…整棵長出來
  cd.hl(-1);
  for (const t of pre(T)) {
    if (t.m) continue;
    t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand);
    t.m = box('O' + t.j, LV[(6 - t.j) % 6], t.x, t.y, 0.75, 0.45, 0.4, 1.0);
    await beat(tok, 120);
  }
  tag('（省略 Compute-Opt(0)）', 'idx', 4.6, 0.9);
  say('O5 再呼叫 O4、O3…依此類推', '整棵 tree：' + all.length + ' 個 call');
  await step(tok);                                   // 2214.0 很多地方是重複的
  all.forEach((t) => { if (t.j === 3) glow(t.m, GOLD); });
  me.mood('wow');
  say('發現了嗎？很多地方是重複的', 'O3 被算了 ' + all.filter((t) => t.j === 3).length + ' 次');
  await step(tok);                                   // 2228.4 重複就是多算了
  all.forEach((t) => glow(t.m, null));
  const dup = {}; all.forEach((t) => { dup[t.j] = (dup[t.j] || 0) + 1; });
  all.forEach((t) => { if (dup[t.j] > 1 && all.find((u) => u.j === t.j) !== t) tint(t.m, C.red); });
  me.mood('sad');
  say('重複 = 多算了', '紅色的其實只要算一次');
  await step(tok);                                   // 2235.0 算好就記起來
  const memo = pkt('算好的記起來！', 4.6, 8.4);
  me.mood('happy'); await me.hop(tok);
  say('怎麼只算一次？算好的記起來', '每個都是一個 subproblem 的解');
  void memo;
}]);

// 37:35 Memoization：M[j] 先查；樹變成細長一條，只算 6 次
FRAG.push(['dpjiang1-wis-memo', 'M-Compute-Opt：先查 M[j]，只算 6 次', async (tok) => {
  fresh([0, 4.0, 15], [0.6, 4.0, 0]);
  const T = optTree(6);
  const all = layout(T, 1.35, 6.4, 0.95, 1.6);
  all.forEach((t) => {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, '#d8cfc0');
    t.m = box('O' + t.j, GRAY, t.x, t.y, 0.75, 0.42, 0.38); fade(t.m, false);
  });
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2255.0 O3 先算好存起來，之後查
  const o3 = all.find((t) => t.j === 3);
  fade(o3.m, true); tint(o3.m, C.teal); glow(o3.m, GREEN);
  const n3 = note('O3 算好 → 記下來', o3.x, o3.y + 0.65);
  say('O3 第一次算好就存起來', '之後遇到相同狀況：先查有沒有算過');
  await step(tok);                                   // 2277.0 這招叫 memoization
  remove(n3); glow(o3.m, null);
  pkt('memoization = 做 memo（小抄）', -3.6, 8.6);
  say('這一招叫 memoization', 'memo 就是做筆記');
  await step(tok);                                   // 2297.0 開一個小 table M
  const MX = (k) => -3.6 + k * 1.15;
  tag('M', 'ptr', MX(0) - 1.0, 0.75);
  const cells = WM.map((v, k) => { tag(String(k), 'idx', MX(k), 0.15); return box(' ', '#e6dccb', MX(k), 0.75, 1.0, 0.5, 0.45); });
  say('多開一個小 table（array）M', '存已經算過的小解');
  await step(tok);                                   // 2314.0 recursive call 前先看 table
  const cd = code(['M-Compute-Opt(j):', '  if j = 0: return 0', '  if M[j] 有值: return M[j]', '  M[j] = max(M-Compute-Opt(j-1),', '             v[j] + M-Compute-Opt(p[j]))', '  return M[j]'], -4.7, 8.0, 0.42);
  cd.hl(2);
  say('遇到 subproblem 先看 table 有沒有值', '有就直接拿來用');
  await step(tok);                                   // 2342.6 j = 0 return 0
  cd.hl(1); relabel(cells[0], 0); tint(cells[0], C.teal);
  say('第一行一樣：j = 0 就 return 0', '兩行變三行');
  await step(tok);                                   // 2354.0 先看 M[j] 有值 → return
  cd.hl(2);
  say('算之前先查小抄 M[j]', '有值：不要 recursive call，直接 return');
  await step(tok);                                   // 2373.0 沒存 → 才 recursive call
  cd.hl(3);
  say('沒存：表示沒算過', '才真的去做 recursive call');
  await step(tok);                                   // 2380.0 算好存進 M[j] 再 return
  cd.hl(5);
  say('算完存進 M[j]，再 return', '多這一個步驟');
  await step(tok);                                   // 2405.0 和 recursive code 九成像；top-down
  cd.hl(-1);
  tag('top-down', 'ptr alt', 5.2, 8.6);
  say('和原本 recursive code 相似度九成', '從最大的問題往下呼叫：top-down');
  await step(tok);                                   // 2452.0 省了什麼？只算 6 個 call
  const known = new Set([0]); let calls = 0;
  async function visit(t) {
    fade(t.m, true);
    if (known.has(t.j)) { tint(t.m, C.gold); glow(cells[t.j], GOLD); await beat(tok, 90); glow(cells[t.j], null); return; }
    calls++; tint(t.m, LV[(6 - t.j) % 6]); await beat(tok, 90);
    for (const k of t.kids) await visit(k);
    known.add(t.j); relabel(cells[t.j], WM[t.j]); tint(cells[t.j], C.teal); tint(t.m, C.teal);
    await beat(tok, 90);
  }
  await visit(T);
  say('真正只算了 ' + calls + ' 個 recursive call', '金色的都是查表');
  await step(tok);                                   // 2468.0 多的那一塊都不見了
  all.forEach((t) => { if (t.m.material.opacity < 1) { fly(t.m); if (t.e) kill(t.e); } });
  me.mood('happy'); await me.hop(tok);
  say('原本多出來的那一大塊都不見了', '這就是省下的地方');
  await step(tok);                                   // 2487.0 變成 linear time
  good('O(2ⁿ) → linear time', 4.6, 1.8);
  say('DP 的方式：變成 linear time', '快非常多');
  await step(tok);                                   // 2507.0 只存 value；組成要另外存
  note('只存了 value；要組成 Oⱼ 就一起存', 1.0, -0.6);
  say('注意：這裡只記了 value', '要 retrieve 組成，就要順便存 Oⱼ');
}]);

// 42:25 Bottom-up：M[0] = 0，for j = 1..n 由小填到大
FRAG.push(['dpjiang1-wis-iter', 'Bottom-up：M[0..6] 由小填到大', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2545.0 bottom-up 比較流行
  tag('bottom-up', 'ptr alt', 4.6, 8.4);
  say('另一個版本：bottom-up', '為什麼比較流行？');
  await step(tok);                                   // 2550.0 一定是 for loop，很簡單
  const cd = code(['Iterative-Compute-Opt:', '  M[0] = 0', '  for j = 1 to n:', '    M[j] = max(v[j] + M[p[j]], M[j-1])'], -3.0, 8.2, 0.48);
  say('implementation 很簡單：一定是 for loop', 'recursion 寫好，安排好 loop 順序就結束');
  await step(tok);                                   // 2598.0 反過來：從 O1 漲到 On
  const up = pkt('O1 → O2 → O3 → … → On', 3.6, 1.0);
  say('反過來操作：從最下面慢慢漲上去', 'O1、O2、O3…一直到 On');
  await step(tok);                                   // 2625.0 一樣開 table M
  remove(up);
  const MX = (k) => -4.2 + k * 1.4;
  tag('j', 'idx', MX(0) - 1.0, 2.55); tag('v', 'idx', MX(0) - 1.0, 5.35); tag('p', 'idx', MX(0) - 1.0, 4.85);
  const cells = WM.map((v, k) => { tag(String(k), 'idx', MX(k), 2.55); if (k) { tag(String(WJ[k].v), 'idx', MX(k), 5.35); tag(String(WJ[k].p), 'idx', MX(k), 4.85); } return box(' ', '#e6dccb', MX(k), 3.4, 1.2, 0.7, 0.5); });
  say('一樣開小抄 table M', '');
  await step(tok);                                   // 2630.0 boundary：M[0] = 0
  cd.hl(1);
  say('boundary：沒有 request 時是 0', 'M[0] = 0');
  await step(tok);                                   // 2643.0 j = 1..n 用 for loop
  cd.hl(2);
  say('接著 j 從 1 到 n', 'for loop 慢慢算');
  await step(tok);                                   // 2650.0 每次用同一個 recursion
  cd.hl(3);
  say('每次算的就是同一個 recursion', 'j 要貢獻 or 不貢獻');
  await step(tok);                                   // 2664.0 只參考已填好的值：像填表
  say('只參考 table 裡已填好的值', '看起來很像在填表');
  await step(tok);                                   // 2681.0 誤解：DP 就是填表格
  const myth = bad('DP ＝ 填表格？ ✗', 4.6, 6.6);
  me.mood('wow');
  say('有人誤解 DP 就是填表格', '錯！填表只是一種 implementation');
  await step(tok);                                   // 2713.0 重點在 recursion
  remove(myth); me.mood('calm');
  good('重點：recursion 怎麼寫', 4.6, 6.6);
  say('memoization 就不是填表', '重點放在 recursion 怎麼寫出來');
  await step(tok);                                   // 2740.0 例子：n = 6，M[0] = 0
  relabel(cells[0], 0); tint(cells[0], C.teal); glow(cells[0], GREEN);
  say('例子 n = 6：開 M[0..6]', '一開始 M[0] 填 0');
  const fill = async (j) => {
    const J = WJ[j];
    const a1 = link([MX(j), 3.85], [MX(j - 1), 3.85], C.blue, 0.2);
    const a2 = J.p !== j - 1 ? arrow(V3(MX(j), 2.9, 0.3), V3(MX(J.p), 2.9, 0.3), 0xc08a1f) : null;
    glow(cells[j], GOLD);
    await beat(tok, 400);
    const take = J.v + WM[J.p];
    relabel(cells[j], WM[j]); tint(cells[j], take >= WM[j - 1] ? C.orange : C.teal); glow(cells[j], null);
    await beat(tok, 200);
    kill(a1); if (a2) kill(a2);
    return 'M[' + j + '] = max(' + J.v + ' + M[' + J.p + '], M[' + (j - 1) + ']) = ' + WM[j];
  };
  await step(tok);                                   // 2747.0 填 M[1]：request 1 算或不算
  glow(cells[0], null);
  cd.hl(3);
  say('進 for loop，填 M[1]', await fill(1));
  await step(tok);                                   // 2764.0 填 M[2]：往前參考兩格
  say('接下來 M[2]：往前參考兩個填好的格子', await fill(2));
  await step(tok);                                   // 2780.0 最後填完：每次看前面兩格
  let last = '';
  for (let j = 3; j <= 6; j++) last = await fill(j);
  cd.hl(-1);
  say('M[3] 到 M[6]：每次都看前面兩格', last + '：最佳值');
  await step(tok);                                   // 2799.0 guarantee 查到的格子都有值
  cells.forEach((m) => glow(m, GREEN));
  say('一定要保證：查到的格子都已經有值', '沒準備好的話，DP 就做錯了');
  await step(tok);                                   // 2815.0 順序：for loop 由小算到大
  cells.forEach((m) => glow(m, null));
  const ord = pkt('j：0 → 6', MX(0), 1.6);
  await travel(tok, ord, V3(MX(0), 1.6, 0), V3(MX(6), 1.6, 0), 1200);
  me.mood('happy');
  say('subproblem 的計算順序很重要', '這題：for loop 從小算到大');
}]);

// 47:28 兩種 implementation：memoization（top-down）vs iteration（bottom-up）
FRAG.push(['dpjiang1-memo-vs-iter', 'Memoization（top-down）vs Iteration（bottom-up）', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const L = [], R = [];
  await step(tok);                                   // 2848.0 兩種形式，都對
  const hL = tag('memoization：top-down', 'ptr', -3.4, 7.4), hR = tag('iteration：bottom-up', 'ptr', 3.4, 7.4);
  for (let k = 0; k < 6; k++) {
    L.push(box('P' + k, C.gray, -3.4, 1.4 + k * 1.0, 1.4, 0.55, 0.45));
    R.push(box('P' + k, C.gray, 3.4, 1.4 + k * 1.0, 1.4, 0.55, 0.45));
  }
  say('summary：DP 有兩種 implement 方式', '兩種都對');
  await step(tok);                                   // 2861.0 memoization：top-down，像 recursive code
  hl(hL, true);
  const mL = pal('memo', -6.0, C.blue);
  say('第一招 memoization：top-down', '長得很像一般的 recursive code');
  await step(tok);                                   // 2877.0 先偷看小抄，有就 return
  tint(L[5], C.orange); glow(L[5], GOLD);
  const peek = note('小抄有答案？有 → return', -6.0, 2.3, 1.6);
  say('每次 recursive call 前先偷看小抄', '有答案就直接 return');
  await step(tok);                                   // 2887.0 沒答案才真的 recursive call
  remove(peek); glow(L[5], null);
  const need = [5, 3, 1, 0];
  for (let i = 1; i < need.length; i++) {
    const k = need[i];
    tint(L[k], C.orange); link([-3.4, 1.4 + need[i - 1] * 1.0], [-3.4, 1.4 + k * 1.0], C.orange, 0.3);
    await beat(tok, 500);
  }
  say('小抄沒有，才真的 recursive call 下去', '示意：P5 只用到 P3、P1、P0');
  await step(tok);                                   // 2893.2 iteration：bottom-up，小長到大
  hl(hL, false); hl(hR, true);
  const mR = pal('loop', 6.0, C.teal);
  say('第二招 iteration：bottom-up', '從比較小的 problem 慢慢長到大');
  await step(tok);                                   // 2911.0 for loop：每圈算一個 subproblem
  for (let k = 0; k < 6; k++) { tint(R[k], C.teal); await beat(tok, 300); }
  say('一定是 for loop', '每個 iteration 算一個 subproblem');
  await step(tok);                                   // 2919.0 保證參考的人都有值
  for (let k = 1; k < 6; k++) link([3.4, 1.4 + (k - 1) * 1.0], [3.4, 1.4 + k * 1.0], C.teal, 0.3);
  say('要保證：參考的更小答案都已經算好', '才能安全算完');
  await step(tok);                                   // 2989.0（下一堂回顧）top-down = memoization
  hl(hR, false); hl(hL, true); mL.mood('happy'); await mL.hop(tok);
  say('（下一堂回顧）top-down 叫 memoization', '先查 lookup table，沒算過才展開');
  await step(tok);                                   // 3035.0 bottom-up：iteration
  hl(hL, false); hl(hR, true); mR.mood('happy'); await mR.hop(tok);
  say('bottom-up 就是 iteration', '從最小的 subproblem 兜到最大');
  await step(tok);                                   // 3110.0 差別：iteration 每個都算
  R.forEach((m) => glow(m, GREEN));
  note('不管有沒有人用，全部都算', 6.0, 2.3, 1.6);
  say('最大不同：iteration 每個 subproblem 都算', '不管之後有沒有人參考');
  await step(tok);                                   // 3134.0 memo 只算需要的，少一點
  R.forEach((m) => glow(m, null));
  [5, 3, 1, 0].forEach((k) => glow(L[k], GOLD));
  note('需要才算 → 有時少一點', -6.0, 2.3, 1.6);
  say('memoization：上面需要時才算', '有時算的 subproblem 少一點');
  await step(tok);                                   // 3168.0 先從 D&C 思考，再轉成 DP
  [5, 3, 1, 0].forEach((k) => glow(L[k], null));
  hl(hR, false);
  pkt('先用 D&C 想 → 再轉成 DP', 0, 0.4);
  say('兩者都 based on induction', '常先用 D&C 思考，再轉成 DP');
}]);

// 53:19 什麼時候用 DP：子問題數 polynomial、由子問題兜出、自然順序；runtime ~ table size
FRAG.push(['dpjiang1-when-dp', '什麼時候用 DP：三個特性', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const row = [];
  await step(tok);                                   // 3201.0 背後一個 table；runtime 跟 table size
  for (let k = 0; k < 7; k++) row.push(box('', C.teal, -4.2 + k * 1.4, 6.6, 1.2, 0.5, 0.45, 1.0));
  tag('lookup table', 'ptr', -5.6, 7.4);
  say('DP 背後都有一個 table', 'runtime 和 table size 關係很大');
  await step(tok);                                   // 3233.0 純 recurrence 直接寫：tree 很龐大
  const big = [];
  for (let k = 0; k < 15; k++) big.push(box('', C.gray, -2.8 + (k % 8) * 0.8, 4.7 - Math.floor(k / 8) * 0.6, 0.6, 0.4, 0.3));
  say('直接照 recurrence 寫 recursive code', '展開的 tree 很龐大');
  await step(tok);                                   // 3247.0 DP：重複的消失，只要查表
  big.forEach((m, k) => { if (k > 5) fly(m); });
  say('用 DP：重複的部分消失', '再遇到只要查表');
  await step(tok);                                   // 3272.0 大樹變細長一條：省時間
  big.slice(0, 6).forEach((m, k) => move(m, -2.8 + k * 1.1, 4.4, 0));
  me.mood('happy');
  say('大樹變成細細長長的一條', '計算時間大幅省下');
  await step(tok);                                   // 3291.0 什麼時候才可以用？
  big.slice(0, 6).forEach(kill);
  me.mood('wow');
  bub('什麼問題才適用？', -5.4, 2.0, 1.6);
  say('什麼時候才可以用 DP？', '不是所有問題都適合');
  await step(tok);                                   // 3319.0 ① subproblem 數是 polynomial
  const t1 = tag('① subproblem 總數是 polynomial', 'ptr alt', 0, 5.6);
  say('① subproblem 總數是 polynomial', '不是 exponential');
  await step(tok);                                   // 3334.0 exponential：table 太大，效果不明顯
  const ex = [];
  for (let k = 0; k < 16; k++) ex.push(box('', C.red, -5.6 + (k % 8) * 1.6, 4.5 - Math.floor(k / 8) * 0.6, 1.3, 0.4, 0.35, 1.0));
  say('若是 exponential 個', 'lookup table 也那麼大：還是很花時間');
  await step(tok);                                   // 3364.0 ② 大問題的解由子問題兜出
  ex.forEach((m) => fly(m)); me.mood('calm');
  txt(t1, '② 原問題的解由 subproblem 的解兜出');
  for (let k = 1; k < 7; k++) link([-4.2 + (k - 1) * 1.4, 6.6], [-4.2 + k * 1.4, 6.6], C.brown, 0.62);
  say('② 原問題的解由 subproblem 的解兜出來', 'highly depends on 子問題');
  await step(tok);                                   // 3395.0 ③ 最重要：natural order
  const t3 = tag('③ 有很自然的計算順序：小 → 大', 'ptr alt', 0, 3.6);
  for (let k = 0; k < 7; k++) { glow(row[k], GREEN); await beat(tok, 200); }
  say('③ 最重要：有天生的 natural order', '從最小的 subproblem 算到最大');
  await step(tok);                                   // 3438.0 order 不會改變 → 90% 可用 DP
  row.forEach((m) => glow(m, null));
  good('看到不變的順序 → 90% 能用 DP', 0, 2.6);
  me.mood('happy'); await me.hop(tok);
  say('遇到固定不變的 ordering', '大概 90% 有機會用 DP');
  await step(tok);                                   // 3462.0 配合容易計算的 recurrence
  txt(t3, '＋ 一個容易計算的 recurrence relation');
  say('再配合一個好算的 recurrence relation', '這幾點要銘記在心');
}]);

// 58:04 CLRS：optimal substructure + overlapping subproblems（用 WIS 說明）
FRAG.push(['dpjiang1-clrs', 'CLRS 兩大特性：最佳子結構＋重疊子問題', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  await step(tok);                                   // 3484.0 Introduction to Algorithms
  const bk = prop('file', -5.8, 0, 1.2, 1.2, 'CLRS');
  bob(bk, 0.04);
  say('Algorithm Bible：Introduction to Algorithms', '它說能用 DP 的問題有兩大特性');
  await step(tok);                                   // 3499.0 兩大特性，倒過來解釋
  const hO = tag('overlapping subproblems', 'ptr', -3.4, 7.6);
  const hS = tag('optimal substructure', 'ptr', 3.4, 7.6);
  say('optimal substructure ＋ overlapping subproblems', '倒過來先解釋第二個');
  await step(tok);                                   // 3505.0 overlapping：子問題重複出現
  hl(hO, true);
  const T = optTree(5);
  const all = layout(T, 1.0, 6.7, 0.95, -3.4);
  all.forEach((t) => { if (t.par) line(t.par.x, t.par.y - 0.22, t.x, t.y + 0.22, 0, C.sand); t.m = box('O' + t.j, C.blue, t.x, t.y, 0.7, 0.4, 0.35); });
  all.forEach((t) => { if (t.j === 3 || t.j === 2) { tint(t.m, C.orange); glow(t.m, GOLD); } });
  say('overlapping：subproblem 重複出現', 'WIS 的遞迴樹就很明顯');
  await step(tok);                                   // 3527.0 重疊的只算一次，記在 table
  all.forEach((t) => glow(t.m, null));
  const tb = [0, 1, 2, 3, 4, 5].map((k) => box(String(k), C.teal, -5.6 + k * 0.85, 1.6, 0.75, 0.45, 0.4, 1.0));
  say('強烈的 hint：重疊的只要算一次', '記在 table 上，大幅簡化');
  void tb;
  await step(tok);                                   // 3541.0 optimal substructure
  hl(hO, false); hl(hS, true);
  const o6 = box('O6', C.purple, 3.4, 6.2, 1.1, 0.55, 0.45, 1.2);
  const a = box('{6}', C.pink, 2.4, 4.6, 0.9, 0.5, 0.45, 1.2), b = box('O3', C.teal, 4.2, 4.6, 0.9, 0.5, 0.45, 1.2);
  line(3.4, 5.9, 2.4, 4.85, 0, C.sand); line(3.4, 5.9, 4.2, 4.85, 0, C.sand);
  say('optimal substructure：整體最佳解', '來自 subproblem 的最佳解兜起來（O6 = {6} ∪ O3）');
  void a;
  await step(tok);                                   // 3579.0 需要簡單的證明
  glow(b, GREEN);
  note('要證明：O3 自己也必須最佳', 3.4, 3.5);
  say('這個特性需要簡單的證明', '確認問題真的符合');
  await step(tok);                                   // 3594.0 最重要：objects 天生的 linear order
  glow(b, null);
  const lo = [1, 2, 3, 4, 5, 6].map((k) => box(String(k), C.gray, -2.5 + (k - 1) * 1.0, 0.4, 0.85, 0.5, 0.4, 1.0));
  tag('objects 天生有 linear order', 'ptr alt', 0, 1.3);
  say('紅字最重要：objects 天生有 linear order', '而且排好在那裡');
  await step(tok);                                   // 3622.0 不能改變 → 照順序算
  for (const m of lo) { tint(m, C.teal); await beat(tok, 200); }
  say('order 給定且不能改變', '就照這個順序算出最後的解');
  await step(tok);                                   // 3646.0 DP 天生適合最佳化問題
  glow(o6, GOLD);
  good('DP：天生最適合最佳化問題', 3.4, 8.4);
  say('Programming 來自 mathematical programming', 'DP 典型用來解最佳化問題');
}]);

// 61:15 發展 DP 的步驟：recurrence、確認子問題數、決定順序
FRAG.push(['dpjiang1-steps', '發展 DP 的三個步驟', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const S = ['① 寫出 recurrence relation', '② 確認 subproblem 數是 polynomial', '③ 決定 subproblem 的計算順序'];
  const bars = [], ls = [];
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const on = (k) => { tint(bars[k], [C.purple, C.blue, C.teal][k]); glow(bars[k], GOLD); ls[k].element.style.opacity = '1'; };
  await step(tok);                                   // 3675.8 確認了 linear order 和兩特性之後
  S.forEach((s, k) => { bars.push(box('', C.gray, 0, 6.4 - k * 1.7, 9.6, 0.9, 0.45)); ls.push(tag(s, 'ptr', 0, 6.4 - k * 1.7, 0.4)); });
  ls.forEach((l) => { l.element.style.opacity = '0.35'; });
  say('確認能用 DP 之後', '照特定步驟發展（借另一位教授的投影片）');
  await step(tok);                                   // 3711.0 第一：recurrence relation
  on(0);
  say('第一：找 recurrence relation', '大問題最佳解和小問題最佳解的關係');
  await step(tok);                                   // 3747.0 最難是 recursive form
  me.mood('wow');
  note('最難的一步！', 5.4, 7.3);
  say('DP 最難的就是發展 recursive form', 'procedure 只是去 implement 它');
  await step(tok);                                   // 3764.0 先用 D&C 的方式思考
  pkt('先用 D&C 的方式想', -3.2, 5.6);
  say('怎麼開始？先用 D&C 的方式思考', '兩者都源自 induction');
  await step(tok);                                   // 3774.7 第二：確認 subproblem 數 polynomial
  glow(bars[0], null); on(1); me.mood('calm');
  say('第二：確認真的適用 DP', 'subproblem 個數要 bound 在 polynomial');
  await step(tok);                                   // 3806.0 單元最後的反例
  bad('exponential 個 → 效果很差（單元最後的例子）', 0, 3.9);
  say('exponential 個：長得再美也沒用', '單元最後會看到例子');
  await step(tok);                                   // 3820.0 它決定 lookup table size
  note('它決定 lookup table 的大小', 5.0, 4.2);
  say('subproblem 總數決定 lookup table 的 size', '');
  await step(tok);                                   // 3835.0 第三：決定運算順序
  glow(bars[1], null); on(2);
  say('第三，也是 DP 能運作最重要的', '決定 subproblem 的運算順序');
  await step(tok);                                   // 3853.0 照這個 order 發展 procedure
  glow(bars[2], null);
  me.mood('happy'); await me.hop(tok);
  say('照這三步', '就能發展出 DP 的 procedure');
}]);

// 64:38 演算法 paradigm 回顧：brute force、greedy、D&C、DP
FRAG.push(['dpjiang1-paradigms', '四種 paradigm：暴力、greedy、D&C、DP', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const X = [-4.8, -1.6, 1.6, 4.8];
  const N = ['Brute force', 'Greedy', 'Divide & Conquer', 'Dynamic Prog.'];
  const head = [], hd = [];
  const show = (k) => { head[k] = box('', LV[k], X[k], 7.0, 2.9, 0.6, 0.4, 1.2); hd[k] = tag(N[k], 'ptr', X[k], 7.0, 0.3); };
  const focus = (k) => head.forEach((m, i) => m && glow(m, i === k ? GOLD : null));
  await step(tok);                                   // 3877.7 暴力法：exhaustive search
  show(0); focus(0);
  const bf = [];
  for (let k = 0; k < 9; k++) bf.push(box('', C.gray, X[0] - 0.9 + (k % 3) * 0.9, 5.6 - Math.floor(k / 3) * 0.7, 0.7, 0.45, 0.35, 0.8));
  say('暴力法：exhaustive search', '所有可能的答案都拿來試');
  await step(tok);                                   // 3892.5 試過全部 → 找到最好的
  for (const m of bf) { tint(m, C.sand); await beat(tok, 120); }
  tint(bf[7], C.teal); glow(bf[7], GREEN);
  say('全部試過，當然找得到最好的', '');
  await step(tok);                                   // 3900.8 當 baseline
  note('baseline', X[0], 3.2);
  say('暴力法常當 baseline（對照組）', '更厲害的方法至少要贏它');
  await step(tok);                                   // 3920.0 學過：greedy、D&C、DP
  show(1); show(2); show(3); focus(-1);
  say('這門課：greedy、D&C、現在的 DP', '');
  await step(tok);                                   // 3945.0 greedy：一步一步，選當下最好
  focus(1);
  const gr = [];
  for (let k = 0; k < 4; k++) { gr.push(box('', C.blue, X[1], 5.6 - k * 0.75, 1.6, 0.45, 0.35, 0.8)); await beat(tok, 300); }
  say('Greedy：step by step 兜出 final solution', '每一步選當下看到最好的');
  await step(tok);                                   // 3969.0 做了決定不反悔（有證明）
  good('不反悔（有證明）', X[1], 2.4);
  say('做好決定就不反悔', '證明保證它會在最佳解裡');
  await step(tok);                                   // 3994.0 沒 guarantee → heuristic
  note('沒證明 → heuristic', X[1], 1.7);
  say('沒有 guarantee 的 greedy', '只是 heuristic（近似解）');
  await step(tok);                                   // 4028.0 不建議只試 greedy
  bad('別只試 greedy', X[1], 1.0);
  say('做作業、研究時不建議只試 greedy', '要根據問題特性設計演算法');
  await step(tok);                                   // 4062.0 D&C：大問題拆小
  focus(2);
  const d0 = box('', C.cyan, X[2], 5.6, 2.2, 0.45, 0.35, 0.8);
  const d1 = [X[2] - 0.6, X[2] + 0.6].map((x) => box('', C.cyan, x, 4.6, 1.0, 0.45, 0.35, 0.8));
  say('D&C：大問題不會，就拆成小問題', 'problem size 降下來');
  await step(tok);                                   // 4085.0 subproblem 要同性質
  note('同性質', X[2], 3.8);
  say('拆出的 subproblem 本質不能變', '只有 size 變小');
  await step(tok);                                   // 4111.0 conquer：recursively solve
  d1.forEach((m) => { tint(m, C.teal); glow(m, GREEN); });
  say('conquer：自動 recursively solve', '');
  await step(tok);                                   // 4125.0 combine 最難；merge sort
  d1.forEach((m) => { glow(m, null); move(m, X[2], 5.6, 0); });
  await beat(tok, 700);
  d1.forEach(kill); tint(d0, C.teal); glow(d0, GOLD);
  say('最難的是 combine', 'merge sort：merge 是 linear → O(n log n)');
  await step(tok);                                   // 4216.0 binary search：只有一個 subproblem
  glow(d0, null);
  note('binary search：1 個 subproblem → log n', X[2], 3.1);
  say('binary search 也是 D&C', '每次只產生一個 subproblem：log n');
  await step(tok);                                   // 4244.0 quick sort：不均勻地拆
  note('quick sort：不均勻地拆', X[2], 2.4);
  say('quick sort：不是均勻地拆成兩半', 'D&C 有很多變形');
  await step(tok);                                   // 4291.6 DP 和 D&C 都源自 induction
  focus(3);
  tag('D&C 與 DP 都源自 induction', 'ptr alt', 0, 1.2);
  say('DP 和 D&C 都源自數學歸納法', '都從 recurrence relation 開始');
  await step(tok);                                   // 4307.0 recurrence：自己定義自己
  const rr = note('f(n) 由 f(更小) 定義', X[3], 5.8);
  say('recurrence relation：自己定義自己', '大的由小的定義');
  await step(tok);                                   // 4350.0 DP 的 subproblem 會重複
  remove(rr);
  const t = [0, 1, 2, 3].map((k) => box('', C.gray, X[3] - 1.05 + k * 0.7, 5.0, 0.6, 0.6, 0.35, 0.8));
  [1, 2].forEach((k) => glow(t[k], GOLD));
  say('DP 特別側重：subproblem 會重複出現', 'overlapping');
  await step(tok);                                   // 4362.0 沒重疊 → 不適合 DP
  [1, 2].forEach((k) => glow(t[k], null));
  bad('不重疊 → 存了也沒人用', X[3], 3.8);
  say('每個 subproblem 只出現一次？', '不適合 DP：存了也沒人用');
  await step(tok);                                   // 4397.0 照 natural ordering 算出 final solution
  for (const m of t) { tint(m, C.orange); await beat(tok, 250); }
  head.forEach((m) => glow(m, null));
  say('照 natural ordering 把 subproblem 算出來', '兜出 final solution');
}]);

// 73:49 Fibonacci：F0 = 0、F1 = 1、螺旋
FRAG.push(['dpjiang1-fib-spiral', 'Fibonacci：每項是前兩項的和、正方形螺旋', async (tok) => {
  fresh([0, 4.0, 14], [0, 4.0, 0]);
  const seq = [0, 1, 1, 2, 3, 5, 8];
  const lbl = [];
  const u = 0.48, sq = [[1, 0, 0], [1, 1, 0], [2, 0.5, 1.5], [3, -2, 1], [5, -1, -3], [8, 5.5, -1.5]];
  const ms = [];
  const square = (k) => { const [s, cx, cy] = sq[k]; ms.push(box(String(s), LV[k], (cx - 1.5) * u, 4.0 + cy * u, s * u - 0.06, s * u - 0.06, 0.15, 1.2)); };
  await step(tok);                                   // 4429.0 例子：Fibonacci sequence
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  tag('Fibonacci sequence', 'ptr alt', 0, 8.8);
  say('第一個例子：Fibonacci sequence', '常被列為 DP 的 Exercise 1');
  await step(tok);                                   // 4442.1 不是最佳化問題
  bub('這題沒有「最好」，只是計算', -5.4, 2.0, 1.6);
  say('先講好：它不是最佳化問題', '只是計算過程可以用 DP 的方式想');
  await step(tok);                                   // 4461.0 每一項是前兩項的總和
  tag('Fₙ = Fₙ₋₁ + Fₙ₋₂', 'ptr', 0, 8.1);
  say('每一項都是前兩項的總和', 'Fₙ = Fₙ₋₁ + Fₙ₋₂');
  await step(tok);                                   // 4476.0 F0 = 0、F1 = 1；F2 = 0 + 1
  for (let k = 0; k < 3; k++) lbl.push(tag('F' + k + '=' + seq[k], 'idx', -5.6 + k * 1.0 + 2.0, 7.4));
  say('initial：F0 = 0、F1 = 1', 'F2 = 0 + 1 = 1，依此類推');
  await step(tok);                                   // 4484.0 算出整個 sequence
  for (let k = 3; k < 7; k++) { lbl.push(tag('F' + k + '=' + seq[k], 'idx', -5.6 + k * 1.0 + 2.0, 7.4)); await beat(tok, 300); }
  say('照 recurrence 一直算下去', '0, 1, 1, 2, 3, 5, 8, …');
  await step(tok);                                   // 4497.0 和自然界結合：螺旋貝殼
  me.mood('wow');
  say('它在數學上有名：和自然界結合', '例如螺旋形的貝殼');
  await step(tok);                                   // 4536.0 邊長 1 的正方形
  square(0);
  say('0 的面積是 0，先不看', '從 1 開始：畫邊長 1 的 square');
  await step(tok);                                   // 4542.9 旁邊再一個 1
  square(1);
  say('旁邊再放一個 1', '1 + 1 會兜出 2');
  await step(tok);                                   // 4559.0 邊長 2
  square(2);
  say('旁邊邊長放大：畫邊長 2 的 square', '');
  await step(tok);                                   // 4573.0 1 + 2 = 3 → 邊長 3
  square(3);
  say('下一項 1 + 2 = 3', '畫邊長 3 的 square');
  await step(tok);                                   // 4581.0 3 + 2 = 5 → 邊長 5
  square(4);
  say('下一項 3 + 2 = 5', '再畫一個 square');
  await step(tok);                                   // 4587.0 5 + 3 = 8 → 邊長 8
  square(5);
  say('5 + 3 = 8', '再畫一個 square');
  await step(tok);                                   // 4595.0 角連起來：螺旋
  const pts = [[0.5, 0], [1, 1], [0.5, 2.5], [-3, 1], [-1, -3.5], [9.5, -1.5]];
  for (let k = 1; k < pts.length; k++) { line((pts[k - 1][0] - 1.5) * u, 4.0 + pts[k - 1][1] * u, (pts[k][0] - 1.5) * u, 4.0 + pts[k][1] * u, 0.2, C.red); await beat(tok, 200); }
  say('把角連起來：就是螺旋', '一直畫下去');
  await step(tok);                                   // 4603.0 生物的螺旋，ratio 很像
  me.mood('happy'); await me.hop(tok);
  say('和很多生物的螺旋形狀很像', '比例（ratio）非常類似');
  await step(tok);                                   // 4623.0 先不談延伸：想一件事
  me.mood('calm');
  bub('那…怎麼算出 Fₙ？', -5.4, 2.0, 1.6);
  say('先不談延伸', '想一件事：怎麼算它？');
}]);

// 77:10 直接實作：F5 → F4、F3；大量重疊；依賴只有 5 個
FRAG.push(['dpjiang1-fib-tree', 'Direct implementation：F5 的遞迴樹與依賴', async (tok) => {
  fresh([0, 4.0, 15], [0.4, 4.0, 0]);
  const T = fibT(5);
  const all = layout(T, 1.3, 7.0, 1.3, 0.8);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const grow = (t) => { if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand); t.m = box('F' + t.n, LV[t.d], t.x, t.y, 0.8, 0.45, 0.4, 1.0); };
  await step(tok);                                   // 4632.0 給 recurrence，算 F100？
  const q = bub('F100 = ？', -5.4, 2.0, 1.6);
  say('給你 recurrence relation', '想算第 100 項 F100，怎麼算？');
  await step(tok);                                   // 4652.0 第一種：direct implementation
  remove(q);
  tag('Direct implementation', 'ptr alt', -4.2, 9.2);
  say('第一種：direct implementation', '');
  await step(tok);                                   // 4672.0 直接翻成 recursive code
  const cd = code(['Fib(n):', '  if n <= 1: return n', '  return Fib(n-1) + Fib(n-2)'], -4.2, 8.6, 0.45);
  say('直接翻成 recursive code', 'recurrence 很簡單');
  await step(tok);                                   // 4675.0 n ≤ 1 直接 return
  cd.hl(1);
  say('F0 = 0、F1 = 1', 'n ≤ 1 就直接 return');
  await step(tok);                                   // 4690.0 其他：前兩項加起來
  cd.hl(2);
  say('比較大的：recursive call 前兩項', '再加起來');
  await step(tok);                                   // 4701.0 會有什麼問題？
  cd.hl(-1); me.mood('wow');
  say('這樣寫會有什麼問題？', '');
  await step(tok);                                   // 4708.0 試試看 F5
  grow(T);
  say('試試看：呼叫 F5', '');
  await step(tok);                                   // 4718.0 F5 → F4、F3；F4 → F3、F2
  T.kids.forEach(grow); T.kids[0].kids.forEach(grow);
  say('F5 呼叫 F4、F3', 'F4 再呼叫 F3、F2');
  await step(tok);                                   // 4729.0 F3 → F2、F1…畫成一棵樹
  for (const t of pre(T)) { if (!t.m) { grow(t); await beat(tok, 110); } }
  say('F3 呼叫 F2、F1，依此類推', '畫成一棵 tree：共 ' + all.length + ' 次 call');
  await step(tok);                                   // 4761.0 重疊量非常高
  all.forEach((t) => glow(t.m, t.n === 3 ? GOLD : null));
  say('subproblem 的重疊量非常高', 'F3 整棵出現兩次');
  await step(tok);                                   // 4768.0 這一塊也是重疊的
  all.forEach((t) => glow(t.m, t.n === 2 ? GOLD : null));
  say('這一塊也是重疊的', 'F2 出現 ' + all.filter((t) => t.n === 2).length + ' 次');
  await step(tok);                                   // 4786.0 不需要每次都 call；算好記下來
  all.forEach((t) => glow(t.m, null));
  me.mood('calm');
  say('重複的不需要每次都 call', '算好先記下來');
  await step(tok);                                   // 4805.0 之後查表：DP 的概念
  pkt('需要時查表 = DP', 4.6, 8.6);
  say('之後要用就去查表', '這就是 DP 的概念');
  await step(tok);                                   // 4812.0 抽出 dependency
  const keep = {};
  all.forEach((t) => { if (!keep[t.n] && t.n >= 1) keep[t.n] = t; });
  all.forEach((t) => { if (keep[t.n] !== t) fly(t.m); if (t.e) kill(t.e); });
  await beat(tok, 700);
  for (let n = 5; n >= 1; n--) move(keep[n].m, -3.6 + (n - 1) * 1.8, 2.6, 0);
  say('把 dependency 抽出來', 'F5 ← F4、F3；F4 ← F3、F2…');
  await step(tok);                                   // 4833.0 其實只有五個 call
  for (let n = 2; n <= 5; n++) link([-3.6 + (n - 2) * 1.8, 2.6], [-3.6 + (n - 1) * 1.8, 2.6], C.brown, 0.5);
  say('這麼大一棵 tree', '其實只是這五個 call 之間的關係');
  await step(tok);                                   // 4845.0 從 F1 算起，五次就結束
  for (let n = 1; n <= 5; n++) { tint(keep[n].m, C.teal); glow(keep[n].m, GREEN); await beat(tok, 350); glow(keep[n].m, null); }
  me.mood('happy');
  say('從沒有 dependency 的 F1 開始往後算', 'F1、F2、F3、F4、F5：五次就結束');
}]);

// 81:07 Memoization：F[] 先填 −1；F[0] = 0、F[1] = 1；查表
FRAG.push(['dpjiang1-fib-memo', 'Memoization：F[] 先填 −1，算過就查表', async (tok) => {
  fresh([0, 4.0, 15], [0.4, 4.0, 0]);
  const T = fibT(5);
  const all = layout(T, 1.25, 6.9, 1.2, 1.2);
  all.forEach((t) => { if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, '#d8cfc0'); t.m = box('F' + t.n, GRAY, t.x, t.y, 0.75, 0.42, 0.38); fade(t.m, false); });
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const FX = (k) => -2.6 + k * 1.15;
  const F = [-1, -1, -1, -1, -1, -1];
  let cells = null, cd = null;
  await step(tok);                                   // 4870.0 不想重複算：需要 lookup table
  say('不想再重複計算', '需要一個小小的 lookup table');
  await step(tok);                                   // 4886.0 top-down：memoization
  pkt('top-down = memoization', -4.4, 9.0);
  say('這是 top-down 的方法', 'memoization');
  await step(tok);                                   // 4898.0 加一件事：create 一個 table
  cd = code(['F[0..n] = -1', 'F[0] = 0; F[1] = 1', 'MFib(n):', '  if F[n] = -1:', '    F[n] = MFib(n-1) + MFib(n-2)', '  return F[n]'], -4.6, 8.4, 0.42);
  say('把 recursive code 改成 memoization', '只多一件事：開一個 table 暫存');
  await step(tok);                                   // 4914.0 存在 F 這個 array
  tag('F', 'ptr', FX(0) - 1.0, 0.7);
  cells = F.map((v, k) => { tag(String(k), 'idx', FX(k), 0.1); return box(' ', '#e6dccb', FX(k), 0.7, 1.0, 0.5, 0.45); });
  say('算出來的 number 存在 array F', '');
  await step(tok);                                   // 4928.0 怎麼判斷算過沒？
  const q = bub('這格算過了沒？', FX(3), 1.6);
  say('查表時怎麼知道這格算過沒？', '要填一個特殊值');
  await step(tok);                                   // 4949.0 用 −1 initialize
  remove(q);
  cd.hl(0);
  for (const c of cells) { relabel(c, -1); await beat(tok, 120); }
  say('Fibonacci 的數都 ≥ 0', '所以先全部填 −1：代表沒算過');
  await step(tok);                                   // 4955.0 F0 填 0、F1 填 1
  cd.hl(1);
  F[0] = 0; F[1] = 1;
  [0, 1].forEach((k) => { relabel(cells[k], F[k]); tint(cells[k], C.teal); });
  say('boundary：F[0] 填 0、F[1] 填 1', '');
  await step(tok);                                   // 4985.5 兩行變三行：多一個查表
  cd.hl(3);
  say('code 從兩行變三行', '多一個查表的動作');
  await step(tok);                                   // 4999.0 −1 → 沒算過 → 老實 recursive call
  cd.hl(4);
  for (const t of [T, T.kids[0], T.kids[0].kids[0], T.kids[0].kids[0].kids[0]]) { fade(t.m, true); tint(t.m, LV[t.d]); await beat(tok, 300); }
  say('F[n] 是 −1：沒算過', '老老實實 recursive call：F5 → F4 → F3 → F2');
  await step(tok);                                   // 5013.0 算過 → 直接 return 記錄的值
  cd.hl(5);
  async function back(t) {
    for (const k of t.kids) {
      if (k.m.material.opacity === 1) continue;
      fade(k.m, true); tint(k.m, C.gold); glow(cells[k.n], GOLD);
      sub(k).slice(1).forEach((u) => { u.gone = true; fly(u.m); if (u.e) kill(u.e); });
      await beat(tok, 160); glow(cells[k.n], null);
    }
    F[t.n] = F[t.n - 1] + F[t.n - 2];
    relabel(cells[t.n], F[t.n]); tint(cells[t.n], C.teal); tint(t.m, C.teal);
    await beat(tok, 160);
  }
  for (const t of [T.kids[0].kids[0].kids[0], T.kids[0].kids[0], T.kids[0], T]) await back(t);
  say('有算過：跳過，直接 return 記下的值', '金色 = 查表；F[5] = 5');
  await step(tok);                                   // 5039.0 真正 recursive call 只有這五個
  all.forEach((t) => { if (!t.gone && t.m.material.opacity < 1) { fly(t.m); if (t.e) kill(t.e); } });
  me.mood('happy'); await me.hop(tok);
  say('真正的 recursive call 只有這五個', '其他都來自查表，不會展開');
}]);

// 84:21 Bottom-up：F[0] = 0、F[1] = 1，i = 2..n 由小填到大（cued copy of the module's fib-table）
FRAG.push(['dpjiang1-fib-table', 'Iteration：F[0..5] 由小填到大', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.8, 0]);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const FX = (k) => -3.2 + k * 1.3;
  const F = [0, 1, 1, 2, 3, 5];
  let cells = null, cd = null;
  const fill = async (i) => {
    const a1 = arrow(V3(FX(i - 2), 3.95, 0.3), V3(FX(i), 3.95, 0.3), 0xc08a1f), a2 = link([FX(i - 1), 3.4], [FX(i), 3.4], C.blue, 0.62);
    glow(cells[i - 1], GOLD); glow(cells[i - 2], GOLD);
    await beat(tok, 500);
    relabel(cells[i], F[i]); tint(cells[i], C.teal); glow(cells[i], GREEN);
    await beat(tok, 400);
    glow(cells[i - 1], null); glow(cells[i - 2], null); glow(cells[i], null); kill(a1); kill(a2);
    return 'F[' + i + '] = F[' + (i - 2) + '] + F[' + (i - 1) + '] = ' + F[i - 2] + ' + ' + F[i - 1] + ' = ' + F[i];
  };
  await step(tok);                                   // 5061.0 iteration：不是 recursive，從小算到大
  tag('bottom-up：iteration', 'ptr alt', 0, 8.6);
  say('另一個版本：bottom-up 的 iteration', '不 recursive，老實從小問題算到大問題');
  await step(tok);                                   // 5071.0 subproblem 之間有 natural ordering？
  const q = bub('有沒有天生的順序？', -5.4, 2.0, 1.6);
  say('先想：subproblem 之間有沒有 natural ordering', '');
  await step(tok);                                   // 5082.0 F1、F2、F3、F4、F5…
  remove(q);
  const ord = pkt('F1 → F2 → F3 → F4 → F5', 0, 1.4);
  say('很簡單：F1、F2、F3、F4、F5…', '就照這個順序');
  await step(tok);                                   // 5095.0 一層 for loop；開 F array
  remove(ord);
  cd = code(['fib(n):', '  F[0] = 0; F[1] = 1', '  for i = 2 to n:', '    F[i] = F[i-2] + F[i-1]', '  return F[n]'], 0, 7.6, 0.45);
  cells = F.map((v, k) => { tag('F[' + k + ']', 'idx', FX(k), 2.6); return box(' ', '#e6dccb', FX(k), 3.4, 1.1, 0.7, 0.5); });
  say('只要一層 for loop', '一樣開一個 array F 暫存');
  await step(tok);                                   // 5108.0 F0、F1 填 0 和 1
  cd.hl(1);
  [0, 1].forEach((k) => { relabel(cells[k], F[k]); tint(cells[k], C.teal); });
  say('initial boundary condition', 'F[0] = 0、F[1] = 1');
  await step(tok);                                   // 5116.0 從 2 以上才用 recurrence
  cd.hl(2);
  say('從 i = 2 開始', '才真的 apply recurrence relation');
  await step(tok);                                   // 5130.0 每個 F[i] = 前兩項的總和
  cd.hl(3);
  say('F[i] = 前兩項的總和', await fill(2));
  await step(tok);                                   // 5137.0 算好存進 F[i]
  say('算出來存進 F[i]', await fill(3));
  await step(tok);                                   // 5145.0 i 從小到大計算
  say('i 從小到大算', await fill(4));
  await step(tok);                                   // 5153.0 i−1、i−2 一定已經有值
  say('往前看的 i−1、i−2 一定已經有值', await fill(5));
  await step(tok);                                   // 5161.0 for loop 不會中途卡住或算錯
  cd.hl(4);
  me.mood('happy');
  say('所以 for loop 不會中途卡住、不會算錯', 'F[5] = 5');
  await step(tok);                                   // 5169.0 照 natural ordering；共 5 個 subproblem
  cd.hl(-1);
  cells.slice(1).forEach((m) => glow(m, GREEN));
  say('follow natural ordering', '要算的 subproblem 一樣是 5 個');
  await step(tok);                                   // 5180.0 本質就是 induction
  cells.forEach((m) => glow(m, null));
  note('其實就是 induction：由小到大', 0, 1.4);
  say('這樣做其實就是 induction', '做完照順序從小算到大');
  await step(tok);                                   // 5194.0 也是 DP 的例子，但沒最佳化
  await me.hop(tok);
  say('Fibonacci 也可當 DP 的 example', '只是它沒有最佳化：比較特別');
}]);

// 86:53 Maze routing：wave propagation，一步、兩步…碰到 target，倒著數回去
FRAG.push(['dpjiang1-maze', 'Maze routing：wave propagation 找最短路徑', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.6, 0]);
  const G = ['........', '.##.#...', '...#....', '.#.#.#..', '.#...#..', 'S#.#..T.'];
  const R = 6, CN = 8, at = (r, c) => G[R - 1 - r][c];
  const X = (c) => (c - 3.5) * 1.1, Y = (r) => 1.0 + r * 1.0;
  const cell = {}; let S, Tt;
  const d = {}; let front = [], w = 0, hit = false;
  const wave = async (n, ms) => {
    for (let s = 0; s < n && front.length && !hit; s++) {
      w++; const nx = [];
      for (const [r, c] of front) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= CN || at(nr, nc) === '#' || d[[nr, nc]] !== undefined) continue;
        d[[nr, nc]] = w; nx.push([nr, nc]);
        const m = cell[nr + ',' + nc];
        if (at(nr, nc) === 'T') { hit = true; glow(m, GREEN); relabel(m, 'T' + w); } else { relabel(m, w); tint(m, w % 2 ? '#bfe3d3' : '#a9d8c4'); }
      }
      front = nx;
      await beat(tok, ms);
    }
  };
  let mouse = null;
  await step(tok);                                   // 5213.0 DP 最好用在最佳化；下一個例子 maze routing
  tag('Maze routing', 'ptr alt', 0, 8.2);
  say('DP 最好用在最佳化問題', '下一個例子：maze routing');
  await step(tok);                                   // 5227.0 老鼠走迷宮
  mouse = pal('老鼠', -6.4, C.gray, 1.6, 0.7);
  say('可以想成老鼠走迷宮', '');
  await step(tok);                                   // 5233.0 格狀圖
  for (let r = 0; r < R; r++) for (let c = 0; c < CN; c++) {
    const ch = at(r, c);
    cell[r + ',' + c] = box(' ', '#e9e1d0', X(c), Y(r), 1.0, 0.9, 0.15);
    if (ch === 'S') S = [r, c]; if (ch === 'T') Tt = [r, c];
  }
  say('迷宮是一個格狀圖', '很多格子');
  await step(tok);                                   // 5248.0 障礙物：灰色
  for (let r = 0; r < R; r++) for (let c = 0; c < CN; c++) if (at(r, c) === '#') { const m = cell[r + ',' + c]; tint(m, '#7d7466'); m.scale.z = 4; }
  say('迷宮有牆壁、障礙物', '用灰色 block 起來');
  await step(tok);                                   // 5260.0 老鼠從入口進去，起司在出口
  const sm = cell[S[0] + ',' + S[1]], tm = cell[Tt[0] + ',' + Tt[1]];
  tint(sm, C.purple); relabel(sm, 'S'); tint(tm, C.gold); relabel(tm, '🧀');
  say('老鼠 S 從入口進去', '起司 T 在另一個出口');
  await step(tok);                                   // 5277.0 任何一點都可以放
  mouse.mood('wow');
  say('其實任何一點都可放老鼠、任何一點放起司', '想辦法讓老鼠走到起司');
  await step(tok);                                   // 5294.9 VLSI 繞線
  const vl = prop('cpu', 6.6, 0, 1.0, 0.8, 'VLSI 繞線');
  bob(vl, 0.04);
  say('和 VLSI 的繞線問題很像', 'source 拉線到 target，也有障礙物');
  await step(tok);                                   // 5327.0 走最短距離
  say('不只要找到路', '還希望走最短距離');
  await step(tok);                                   // 5340.0 只能上下左右
  const dirs = ['↑', '↓', '←', '→'].map((a, k) => tag(a, 'pkt', X(S[1]) + [0, 0, -0.7, 0.7][k], Y(S[0]) + [0.7, -0.7, 0, 0][k], 0.3));
  say('限制方向：只能上下左右', '不能走斜的');
  await step(tok);                                   // 5371.0 一步可以走到哪些點
  dirs.forEach(remove);
  d[S] = 0; front = [S];
  await wave(1, 300);
  say('從 source 開始：一步可以走到哪些點？', '標上 1');
  await step(tok);                                   // 5380.0 兩步、三步、四步…
  await wave(5, 350);
  say('再看兩步、三步、四步可以走到的', '一直看下去');
  await step(tok);                                   // 5401.0 像 wave propagation
  await wave(5, 350);
  say('像水波一樣往外擴散', 'wave propagation');
  await step(tok);                                   // 5414.7 直到碰到 target 停下來
  await wave(5, 400);
  mouse.mood('happy'); await mouse.hop(tok);
  say('一直到碰到 target 就停', '最短：' + w + ' 步');
  await step(tok);                                   // 5423.0 保證最短；怎麼 retrieve？
  say('停下來時保證找到最短路徑', '怎麼把路徑 retrieve 出來？');
  await step(tok);                                   // 5431.0 剛才 1 2 3 數過去 → 倒過來數
  say('剛才是照順序 1、2、3…數過去', '所以倒過來數就好');
  await step(tok);                                   // 5442.0 12 11 10 … 1 連續的 path
  let cur = Tt; const path = [];
  while (d[cur] > 1) {
    const [r, c] = cur;
    for (const [dr, dc] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) { const n = [r + dr, c + dc]; if (d[n] === d[cur] - 1) { cur = n; break; } }
    path.push(cur);
  }
  for (const p of path) { tint(cell[p[0] + ',' + p[1]], C.orange); await beat(tok, 150); }
  say('倒著數 ' + w + '、' + (w - 1) + '、…、1', '任何一條連續遞減的 path 都是解');
  await step(tok);                                   // 5469.0 memory 和 runtime 多少？
  say('這個 DP 要多少 memory 和 runtime？', '看 lookup table 的 size');
  await step(tok);                                   // 5481.0 m × n 個格子 → O(mn)
  tag('m × n 個格子 → O(mn)', 'ptr alt', 0, 7.4);
  say('worst case：table = 整個平面的格數', 'm × n 格 → O(mn)');
  await step(tok);                                   // 5497.0 table 多大，runtime 就 bound 在那
  note('table 多大，runtime 就 bound 在那', 0, 0.0);
  say('這也是 DP 的特性', 'table 有多大，running time 就 bound 在上面');
}]);

// ════════════════ S5vS9YEvnFU（Lec19 Dynamic Programming 3/3） ════════════════

// Bellman-Ford 表（KT Fig 6.23）：OPT(i, v) 列 = 點、欄 = 最多 i 條 edge
const BV = ['t', 'a', 'b', 'c', 'd', 'e'];
const BT = { t: [0, 0, 0, 0, 0, 0], a: [null, -3, -3, -4, -6, -6], b: [null, null, 0, -2, -2, -2], c: [null, 3, 3, 3, 3, 3], d: [null, 4, 3, 3, 2, 0], e: [null, 2, 0, 0, 0, 0] };
const bfs = (v) => (v === null ? '∞' : String(v));
function bfTable(x0, y0, cw = 0.95, chh = 0.62, cols = 6, upto = cols) {
  const cells = {};
  for (let i = 0; i < cols; i++) tag(String(i), 'idx', x0 + i * cw, y0 + 0.6);
  BV.forEach((v, r) => {
    tag(v, 'ptr', x0 - 0.85, y0 - r * chh);
    cells[v] = [];
    for (let i = 0; i < cols; i++) cells[v][i] = box(i < upto ? bfs(BT[v][i]) : ' ', i === cols - 1 ? '#efe0c0' : '#e6dccb', x0 + i * cw, y0 - r * chh, cw - 0.08, chh - 0.08, 0.3);
  });
  return cells;
}
const colGlow = (cells, i, c) => BV.forEach((v) => glow(cells[v][i], c));

// 00:16 Bellman-Ford 回顧：一欄一欄填；b 在 i = 5：min(−2, −1 + 2, −2 + 0)
FRAG.push(['dpjiang1-bf-cell', 'Bellman-Ford 填表：OPT(5, b) = −2', async (tok) => {
  fresh([0, 4.2, 13.5], [0.4, 3.9, 0]);
  const X0 = -4.6, CW = 0.95;
  let cells = null, opt = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 16.1 上次的 Bellman-Ford：iteration、bottom-up 建表
  cells = bfTable(X0, 6.4);
  tag('M[i, v]：v 到 t、最多 i 條 edge', 'idx', -2.2, 7.6);
  say('上次的 Bellman-Ford：iteration 版本', 'bottom-up 建出這張 table');
  await step(tok);                                   // 47.0 最後一個 column：每個點到 t 的最短距離
  colGlow(cells, 5, GOLD);
  say('最後一個 column', '就是每個點到 destination t 的最短距離');
  await step(tok);                                   // 64.0 第一個 column：boundary condition
  colGlow(cells, 5, null); colGlow(cells, 0, GREEN);
  say('第一個 column 是 boundary condition', 't 自己是 0，其他是 ∞');
  await step(tok);                                   // 72.0 每個 iteration 填一個新 column
  colGlow(cells, 0, null);
  for (let i = 1; i < 6; i++) { colGlow(cells, i, GOLD); await beat(tok, 300); colGlow(cells, i, null); }
  say('每個 iteration 填一個新的 column', '');
  await step(tok);                                   // 80.0 只參考前一個 column
  colGlow(cells, 3, GOLD); colGlow(cells, 2, GREEN);
  const lk = arrow(V3(X0 + 2 * CW, 7.25, 0), V3(X0 + 3 * CW, 7.25, 0), 0x0f5a3a);
  say('填新 column 時', '只參考前面一個 column 的值');
  await step(tok);                                   // 104.0 for each vertex：順序不在意
  colGlow(cells, 3, null); colGlow(cells, 2, null); kill(lk);
  const cd = code(['for i = 1 to n-1:', '  for each v (any order):', '    M[i,v] = min(M[i-1,v],', '      min_w c(v,w) + M[i-1,w])'], 2.9, 2.4, 0.42);
  cd.hl(1);
  say('for 每一個 vertex，in any order', '順序不在意，反正每個點都要看');
  await step(tok);                                   // 126.0 option 1：沒用到第 i 條 → 左邊那格
  cd.hl(2);
  say('兩個 option。option 1：沒用到第 i 條 edge', '最多 i − 1 條：承接前一 column 的解');
  await step(tok);                                   // 145.0 option 2：剛好 i 條 = 第一條 + i−1 條
  cd.hl(3);
  say('option 2：剛好用 i 條 edge', '拆成：v 出去的第一條 ＋ 從 w 到 t 的 i − 1 條');
  await step(tok);                                   // 178.0 option 2 也只參考前一個 column
  say('option 2 參考的也是前一個 iteration', '就是隔壁 column 的解');
  await step(tok);                                   // 201.0 highlight：b 到 t、最多 5 條
  cd.hl(-1);
  glow(cells.b[5], GOLD); opt = cells.b[5]; relabel(opt, '?');
  say('例子：b 到 t、最多 5 條 edge', '這格怎麼算？');
  await step(tok);                                   // 209.0 option 1：最多 4 條的 b → 左邊格子
  glow(cells.b[4], GREEN);
  const o1 = note('option 1：−2', 4.0, 6.0);
  say('option 1：參考最多 4 條的 b', '左邊那格：−2');
  await step(tok);                                   // 226.0 b 出去可以到 d、也可以到 e
  const ed = pkt('b→d：−1', 4.0, 5.2), ee = pkt('b→e：−2', 4.0, 4.5);
  say('b 出去可以 reach d，也可以 reach e', '剛好 5 條 = 1 條 ＋ 4 條');
  await step(tok);                                   // 250.0 b→d ＋ d 到 t 最多 4 條
  glow(cells.d[4], GREEN); hl(ed, true);
  say('第一種：b→d 這一段', '再加上 d 到 t 最多 4 條的解');
  await step(tok);                                   // 258.0 b→e ＋ e 到 t 最多 4 條
  glow(cells.e[4], GREEN); hl(ee, true);
  say('第二種：b→e 這一段', '再加上 e 到 t 最多 4 條的解');
  await step(tok);                                   // 277.0 2 + (−1) = 1；−2 + 0 = −2
  txt(ed, '−1 + 2 = 1'); txt(ee, '−2 + 0 = −2');
  say('d 那格是 2：2 + (−1) = 1', 'e 那格是 0：−2 + 0 = −2');
  await step(tok);                                   // 287.0 take minimum：還是 −2
  ['b', 'd', 'e'].forEach((v) => glow(cells[v][4], null));
  relabel(opt, -2); glow(opt, GREEN); txt(o1, 'min(−2, 1, −2) = −2');
  me.mood('happy'); await me.hop(tok);
  say('take minimum：仍然是 −2', '每一格都用這種方式兜出來');
}]);

// 05:02 Complexity：O(nm) 而不是 O(n³)；空間只要前一欄，但回溯路徑要留紀錄
FRAG.push(['dpjiang1-bf-cost', 'Bellman-Ford 的 O(nm) 與空間', async (tok) => {
  fresh([0, 4.2, 13.5], [0.4, 3.9, 0]);
  const cells = bfTable(-4.6, 6.4);
  const cd = code(['for i = 1 to n-1:', '  for each v (any order):', '    M[i,v] = min(M[i-1,v],', '      min over (v,w): c(v,w) + M[i-1,w])'], 2.7, 2.4, 0.42);
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  let cx = null;
  await step(tok);                                   // 302.0 complexity 主要來源在這裡
  [0, 1, 2, 3].forEach((k) => { cd.ls[k].element.style.outline = '2px solid #c08a1f'; });
  say('complexity 的主要來源', '是這兩層 for loop');
  await step(tok);                                   // 313.0 外層：一個一個 column，n − 1 個
  [0, 1, 2, 3].forEach((k) => { cd.ls[k].element.style.outline = ''; });
  cd.hl(0);
  for (let i = 1; i < 6; i++) { colGlow(cells, i, GOLD); await beat(tok, 200); colGlow(cells, i, null); }
  cx = tag('外層：n − 1 個 column → O(n)', 'ptr alt', 2.7, 0.4);
  say('外層一個 column 一個 column 填', '最多 n − 1 個 column');
  await step(tok);                                   // 326.0 option 1：直接參考左邊格子
  cd.hl(2);
  glow(cells.b[5], GOLD); glow(cells.b[4], GREEN);
  say('每一格：option 1 直接參考左邊格子', '1 格，固定的');
  await step(tok);                                   // 334.0 option 2：看 out-degree
  cd.hl(3);
  glow(cells.d[4], GREEN); glow(cells.e[4], GREEN);
  const od = note('b 的 out-degree = 2 → 再看 2 格', 4.0, 5.4);
  say('option 2 要參考幾格？', '看這個點 outgoing 的 edge 數（out-degree）');
  await step(tok);                                   // 354.0 每個點：out-degree ＋ 左邊 1 格
  txt(od, 'b：1（左格）＋ 2（out-degree）');
  say('每個點看：out-degree 個格子', '再加上自己隔壁的 1 格');
  await step(tok);                                   // 386.0 全部點加總 = 總 edge 數 m
  ['b', 'd', 'e'].forEach((v) => glow(cells[v][4], null)); glow(cells.b[5], null);
  colGlow(cells, 5, GOLD);
  txt(od, 'Σ out-degree = m（總 edge 數）');
  say('每個點的 outgoing edge 全部加起來', '就是總 edge 數 m');
  await step(tok);                                   // 410.0 內層每個 iteration：O(m)
  colGlow(cells, 5, null);
  cd.hl(1);
  txt(cx, '內層：每個 iteration O(m)');
  say('所以內層在每個 iteration', '貢獻 O(m)');
  await step(tok);                                   // 445.0 外層 n → 整體 O(nm)
  cd.hl(-1);
  txt(cx, '整體：O(n) × O(m) = O(nm)');
  me.mood('happy');
  say('外層 bound 在 n、內層在 m', '兩層乘起來：O(nm)');
  await step(tok);                                   // 470.0 粗略分析：每格看整欄 → n²
  me.mood('wow');
  BV.forEach((v) => glow(cells[v][4], GOLD)); glow(cells.b[5], GREEN);
  txt(od, '粗略：每格看整個前一欄 → 一欄 n²');
  say('如果粗略看：每格都參考整個前一欄', '一欄就要 n²');
  await step(tok);                                   // 501.0 → n³，算太多
  BV.forEach((v) => glow(cells[v][4], null)); glow(cells.b[5], null);
  txt(od, '粗略總共 O(n³)：算太多了');
  say('這樣算出來 O(n³)', '其實算太多了');
  await step(tok);                                   // 506.0 詳細分析：n × m
  txt(od, '詳細分析：O(nm)'); me.mood('calm');
  say('詳細分析只有 n × m', '');
  await step(tok);                                   // 517.9 只參考隔壁 column
  colGlow(cells, 4, GOLD); colGlow(cells, 3, GREEN);
  say('每一格真正參考的', '只有隔壁那一個 column，不會再往前看');
  await step(tok);                                   // 530.0 table 不需要這麼大
  colGlow(cells, 4, null); colGlow(cells, 3, null);
  BV.forEach((v) => { for (let i = 0; i < 4; i++) fade(cells[v][i], false); });
  say('所以 table 不一定要建這麼大', '可以壓縮成兩欄');
  await step(tok);                                   // 551.0 只要記錄值 → 可以縮小
  good('只要最短距離的值 → 兩欄就夠', 2.6, 8.4);
  say('如果只要 shortest path 的值', 'table 可以縮小');
  await step(tok);                                   // 567.0 要 retrieve 路徑 → 整張留著，記「參考誰」
  BV.forEach((v) => { for (let i = 0; i < 4; i++) fade(cells[v][i], true); });
  arrow(V3(-4.6 + 5 * 0.95, 6.4 - 2 * 0.62 + 0.15, 0.3), V3(-4.6 + 4 * 0.95, 6.4 - 5 * 0.62 + 0.15, 0.3), 0xa8730f);
  note('每格記：我參考了誰', 4.0, 6.0);
  say('想 retrieve 每個點到 t 的路徑', '整張 table 要留著，每格記下參考誰');
  await step(tok);                                   // 599.0 DP 最後一步：需不需要 detail solution
  me.mood('happy'); await me.hop(tok);
  say('這是 DP 的最後一步', '看題目需不需要 detail solution 的長相');
}]);

// 10:39 Negative cycle：在 v 繞圈，每繞一圈更短
FRAG.push(['dpjiang1-negcycle', 'Negative cycle：繞一圈就更短，出不來', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const P = { s: [-5, 2.4], v: [-1, 2.4], t: [5, 2.4], x: [0.6, 5.4], y: [-2.6, 5.4] };
  const N = {};
  const tr = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 639.4 Negative cycle：shortest path 的重要主題
  tag('Negative cycle', 'ptr alt', 0, 8.2);
  say('今天的新重點：negative cycle', 'shortest path 裡很重要的主題');
  await step(tok);                                   // 647.6 有 negative cycle：最短距離不探討
  for (const [k, p] of Object.entries(P)) N[k] = box(k, k === 's' || k === 't' ? C.purple : C.blue, p[0], p[1], 0.8, 0.6, 0.5, 1.4);
  link(P.s, P.v); link(P.v, P.t);
  const cyc = [['v', 'x', -2], ['x', 'y', 3], ['y', 'v', -4]];
  cyc.forEach(([a, b, w]) => { link(P[a], P[b], C.red); tag(String(w), 'ptr alt', (P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2 + 0.4); });
  say('graph 裡有 negative cycle 時', '任兩點的最短距離不探討：不知道在哪');
  await step(tok);                                   // 663.0 Bellman-Ford 吐出的解不對
  const bf = bad('Bellman-Ford：答案不對', 4.4, 6.6);
  say('Bellman-Ford 也一樣', '路上經過 negative cycle 時，吐出的解不對');
  await step(tok);                                   // 683.0 其他演算法也一樣
  txt(bf, '任何 shortest path 演算法：都給不出正解');
  say('其他 shortest path 演算法', '遇到這種 case 也沒辦法');
  await step(tok);                                   // 698.0 s 到 t，中間經過 v
  glow(N.s, GOLD); glow(N.t, GOLD); glow(N.v, GOLD);
  say('討論 s 到 t 的最短路徑', '中間經過某個點 v');
  await step(tok);                                   // 712.0 v 在 cycle C 上，總和 < 0
  glow(N.s, null); glow(N.t, null);
  const sum = tag('cycle C：−2 + 3 − 4 = −3 < 0', 'ptr', 0, 7.4);
  say('v 剛好在一個 cycle C 上', 'C 的 edge weight 總和是負的');
  await step(tok);                                   // 728.0 s 到 v 之後在這裡繞圈圈
  glow(N.v, null);
  const tk = box('', C.orange, P.s[0], P.s[1] + 0.65, 0.35, 0.35, 0.35);
  const cost = tag('目前長度', 'ptr alt', 4.2, 4.4);
  move(tk, P.v[0], P.v[1] + 0.65, 0);
  await beat(tok, 700);
  for (const k of ['x', 'y', 'v']) { move(tk, P[k][0], P[k][1] + 0.65, 0); await beat(tok, 450); }
  txt(cost, '繞 1 圈：再 −3');
  say('走到 v 之後會在這裡繞圈圈', '每繞一圈，總長再降 3');
  await step(tok);                                   // 741.0 繞 10 圈賺 10 次，出不來
  for (const k of ['x', 'y', 'v', 'x', 'y', 'v']) { move(tk, P[k][0], P[k][1] + 0.4, 0); await beat(tok, 300); }
  txt(cost, '一直繞：−∞，出不來');
  tr.mood('wow');
  say('繞 10 圈就賺 10 次', '無限賺下去，出不來');
  await step(tok);                                   // 751.3 一般問題：給 directed graph 算最短距離
  kill(sum); tr.mood('calm');
  say('一般的 shortest path 問題', '給 directed graph 和 edge weight，求任兩點最短距離');
  await step(tok);                                   // 770.0 算之前先確認有沒有 negative cycle
  const chk = bub('先檢查：有 negative cycle 嗎？', -6.0, 2.2, 1.6);
  say('真正跑演算法之前', '先確認 graph 裡有沒有 negative cycle');
  await step(tok);                                   // 781.0 negative cycle detection 很重要
  remove(chk);
  good('negative cycle detection', 0, 0.6);
  say('negative cycle detection', '是很重要的議題');
  await step(tok);                                   // 795.0 看一個有名的 application
  tr.mood('happy'); await tr.hop(tok);
  say('先看一個很有名的 application', '');
}]);

// 13:21 套利：匯率相乘 > 1 的 cycle
FRAG.push(['dpjiang1-arbitrage', '套利：匯率乘積 > 1 的 cycle', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { USD: [-3.6, 2.2], CHF: [0, 6.6], EUR: [3.6, 2.2], GOLD: [-5.8, 6.0] };
  const N = {};
  const tr = pal('交易員', 6.0, C.orange, 1.6, 0.75);
  let coin = null;
  await step(tok);                                   // 801.0 技巧常見；找 negative cycle 的應用
  say('這個技巧之後在很多地方都會看到', '問題：graph 裡有沒有 negative cycle？');
  await step(tok);                                   // 825.0 不同貨幣之間的 exchange rate
  for (const k of ['USD', 'CHF', 'EUR']) N[k] = box(k, C.blue, P[k][0], P[k][1], 1.2, 0.6, 0.5, 1.4);
  say('這裡是不同貨幣之間的 exchange rate', '');
  await step(tok);                                   // 832.0 有人靠匯差賺錢，用電腦算
  const pc = prop('monitor', 6.0, 3.2, -1.0, 0.8);
  say('有人專門賺匯差', '現在都靠電腦幫忙算');
  void pc;
  await step(tok);                                   // 854.0 學了演算法去金融業
  const ws = bub('華爾街很多人是 CS 出身', 6.0, 2.4, 1.6);
  tr.mood('happy');
  say('有人學了演算法去金融業', '華爾街很多專家是 Computer Science 出身');
  await step(tok);                                   // 880.0 只是 example，和現在匯率無關
  remove(ws);
  say('這只是一個參考圖', '跟現在的匯率沒有關係');
  await step(tok);                                   // 892.0 1 單位金 → 327.25 美元
  N.GOLD = box('GOLD', C.gold, P.GOLD[0], P.GOLD[1], 1.2, 0.6, 0.5, 1.4);
  link(P.GOLD, P.USD, C.brown, 0.6); tag('1 → 327.25', 'idx', -5.6, 4.0);
  say('例：1 單位的金', '可以換 327.25 美元');
  await step(tok);                                   // 903.0 兩兩幣值之間都有 rate
  link(P.USD, P.EUR, C.gray, 0.6); link(P.CHF, P.USD, C.gray, 0.6);
  say('兩兩幣值之間', '都有一個 exchange rate（edge）');
  await step(tok);                                   // 917.0 可以換過去，也可以換回來
  coin = box('$1', C.orange, P.USD[0], P.USD[1] + 0.8, 0.7, 0.45, 0.4);
  move(coin, P.EUR[0], P.EUR[1] + 0.8, 0);
  await beat(tok, 800);
  move(coin, P.USD[0], P.USD[1] + 0.8, 0);
  say('可以換過去', '也可以換回來');
  await step(tok);                                   // 932.0 換過去再換回來 → 一定虧
  relabel(coin, '$0.98'); tint(coin, C.red);
  tr.mood('sad');
  say('直接換過去再換回來：乘積 < 1', '一定會虧，否則大家都在櫃檯賺錢');
  await step(tok);                                   // 975.0 匯率波動：繞一大圈可能 > 1
  relabel(coin, '$1'); tint(coin, C.orange); tr.mood('calm');
  const q = bub('繞一大圈回來 > 1？', 0, 0.6);
  say('但匯率每天在波動', '從某幣換 A、再換 B…繞一大圈回來可能 > 1');
  await step(tok);                                   // 999.0 丟錢一直轉就賺
  remove(q);
  say('那就可以把錢丟進去一直轉', '一直賺');
  await step(tok);                                   // 1043.0 找一個乘積 > 1 的 cycle
  tag('找：rate 乘積 > 1 的 cycle', 'ptr alt', 0, 8.6);
  say('問題：給你所有匯率的 graph', '找一個 rate 乘起來 > 1 的 cycle');
  const E = [['USD', 'CHF', '1.3941'], ['CHF', 'EUR', '0.6677'], ['EUR', 'USD', '1.0752']];
  const amt = ['1.3941 法郎', '0.9308 歐元', '$1.00084'];
  const hop = async (k) => {
    const [a, b, r] = E[k];
    link(P[a], P[b], C.red, 0.6);
    tag('×' + r, 'ptr alt', (P[a][0] + P[b][0]) / 2 + (k === 2 ? 0 : (k ? 0.9 : -0.9)), (P[a][1] + P[b][1]) / 2 + (k === 2 ? -0.5 : 0.3));
    move(coin, P[b][0], P[b][1] + 0.8, 0); relabel(coin, amt[k]);
    await beat(tok, 700);
  };
  await step(tok);                                   // 1071.0 $1 → 1.3941 法郎
  await hop(0);
  say('$1 美元換 1.39 法郎', '× 1.3941');
  await step(tok);                                   // 1078.0 法郎 → 歐元；歐元再換回美元
  await hop(1);
  say('1 法郎換 0.6677 歐元', '手上變成 0.9308 歐元；歐元再換回美元');
  await step(tok);                                   // 1087.0 乘起來 > 1
  await hop(2);
  tag('1.3941 × 0.6677 × 1.0752 > 1', 'ptr', 0, 0.6);
  say('這一圈乘起來', '是一個大於 1 的數字');
  await step(tok);                                   // 1097.0 $1 繞一圈變 $1.00084
  glow(coin, GREEN); tr.mood('happy'); await tr.hop(tok);
  say('丟 $1 繞一圈回來', '變成 $1.00084');
  await step(tok);                                   // 1105.0 一大筆錢一直繞：無本生意
  relabel(coin, '$$$');
  say('看起來不多，但會丟一大筆錢', '一直繞：無本生意');
  await step(tok);                                   // 1128.0 問題：edge = rate，找乘積 > 1 的 cycle
  glow(coin, null);
  say('整理：edge weight = exchange rate', '找 edge weight「乘積」> 1 的 cycle');
  await step(tok);                                   // 1155.0 我們會的是 shortest path
  const sp = pkt('我們會的：shortest path', -4.0, 8.0);
  say('但這個單元我們會的', '是 shortest path：任兩點（含自己到自己）的最短路徑');
  await step(tok);                                   // 1175.0 shortest path 是「和」，這裡要「乘積」
  txt(sp, 'shortest path：edge weight 的「和」');
  tr.mood('wow');
  say('shortest path 算的是 edge weight 的總和', '這裡要的是乘積：不一樣');
}]);

// 19:53 轉換：w = −log r，乘積 > 1 ⇔ 總和 < 0
FRAG.push(['dpjiang1-neglog', '取 −log：乘積 > 1 變成 negative cycle', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { USD: [-3.6, 2.2], CHF: [0, 6.6], EUR: [3.6, 2.2] };
  for (const [k, p] of Object.entries(P)) box(k, C.blue, p[0], p[1], 1.2, 0.6, 0.5, 1.4);
  const E = [['USD', 'CHF', 1.3941], ['CHF', 'EUR', 0.6677], ['EUR', 'USD', 1.0752]];
  const pos = (k) => [(P[E[k][0]][0] + P[E[k][1]][0]) / 2 + (k === 2 ? 0 : (k ? 1.2 : -1.2)), (P[E[k][0]][1] + P[E[k][1]][1]) / 2 + (k === 2 ? -0.5 : 0.3)];
  const lb = E.map(([a, b, r], k) => { link(P[a], P[b], C.red, 0.6); return tag('r = ' + r, 'ptr alt', pos(k)[0], pos(k)[1]); });
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const f = tag(' ', 'ptr', 0, 0.6);
  await step(tok);                                   // 1193.0 問題一：把乘積換成和
  const p1 = note('① 乘積 → 和？', 5.0, 7.6);
  say('第一個問題：要把乘積', '換成某種「和」的形式');
  await step(tok);                                   // 1201.0 問題二：要 > 1；shortest path 找最小
  note('② 越大越好 → 越小越好？', 5.0, 6.9);
  say('第二個問題：我們要 > 1、越大越好', 'shortest path 找的是越小越好：方向相反');
  void p1;
  await step(tok);                                   // 1221.0 要做一些轉換
  me.mood('wow');
  say('所以要做一些轉換', '');
  await step(tok);                                   // 1238.0 假設一個 cycle：v₁ → v₂ → … → v₁
  txt(f, 'cycle：v₁ → v₂ → … → vₙ → v₁');
  say('假設想找一個 cycle', 'v₁、v₂…繞一大圈回到 v₁');
  await step(tok);                                   // 1247.0 對應的乘積
  txt(f, 'r(v₁v₂) · r(v₂v₃) · … · r(vₙv₁)');
  say('它對應的 exchange rate 乘積', 'r₁₂ · r₂₃ · … · rₙ₁');
  await step(tok);                                   // 1263.0 希望 > 1：會賺錢
  txt(f, 'r₁₂ · r₂₃ · … · rₙ₁ > 1 → 賺錢');
  say('希望乘積 > 1', '就表示會賺錢');
  await step(tok);                                   // 1280.0 shortest path 算的是總和
  say('shortest path 算的是 edge weight 的總和', '需要一個轉換');
  await step(tok);                                   // 1292.0 想找 cycle：c₁₂ + c₂₃ + …
  const f2 = tag('新 weight：c₁₂ + c₂₃ + … + cₙ₁', 'ptr', 0, -0.1);
  say('在 shortest path 上也找同一個 cycle', 'weight 是 c₁₂ + c₂₃ + … 一直加');
  await step(tok);                                   // 1308.9 c 和 r 的關係：乘法換成加法
  say('c 和 r 要怎麼設定？', '希望把乘法換成加法');
  await step(tok);                                   // 1317.6 取 log：log 乘積 = log 的和
  txt(f, 'log(r₁₂ · r₂₃ · …) = log r₁₂ + log r₂₃ + …');
  me.mood('happy');
  say('簡單的做法：取 log', 'log 的乘積 = 拆成 log 的和');
  await step(tok);                                   // 1345.0 要 > 1：方向要反過來
  say('原本要找 > 1 的', '設定要整個反向');
  await step(tok);                                   // 1353.0 取負的 log
  txt(f2, 'c = −log r');
  say('所以取負的 log', 'c = −log r');
  await step(tok);                                   // 1368.9 每條 edge 改成 −log r → 找 negative cycle
  txt(f, '乘積 > 1 ⇔ Σ(−log r) < 0');
  say('每個 edge weight 都改成 −log r 之後', '要找的就是 weight 總和 < 0 的 negative cycle');
  await step(tok);                                   // 1383.0 紅色是 rate，藍色是 −log 之後
  const w = E.map(([, , r]) => -Math.log(r));
  E.forEach((e, k) => tag('c = ' + w[k].toFixed(4), 'ptr', pos(k)[0], pos(k)[1] - 0.5));
  say('紅色：原本的 exchange rate', '藍色：取 −log 之後的 weight');
  await step(tok);                                   // 1401.6 這一圈加起來是負的
  const s = w[0] + w[1] + w[2];
  txt(f2, '−0.3323 + 0.4040 − 0.0725 = ' + s.toFixed(5) + ' < 0');
  lb.forEach((l) => hl(l, false));
  say('這一圈加起來', '總和是負的：negative cycle');
  await step(tok);                                   // 1413.0 轉化：乘積 > 1 → 總和 < 0
  txt(f, '找 rate 乘積 > 1 的 cycle ⇒ 找 −log 權重的 negative cycle');
  say('原本：找 rate 乘積 > 1 的 cycle', '現在：weight 改成 −log r，找 negative cycle');
  await step(tok);                                   // 1446.0 問題變成找 negative cycle
  await me.hop(tok);
  say('問題轉化了', '給你一個 graph：能不能找到 negative cycle？');
}]);

// 24:22 偵測：多跑一個 iteration（最多 n 條 edge），值還會變小 → 有 negative cycle
FRAG.push(['dpjiang1-bf-extra', '多跑一輪：值還變小就有 negative cycle', async (tok) => {
  fresh([0, 4.0, 14], [0, 4.0, 0]);
  const L = {};
  const P = { v: [2.4, 5.6], w: [5.0, 5.6], t: [2.4, 2.6] };
  let vt = null, wt = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 1462.0 學到的演算法能不能 detect？
  say('手上的演算法', '能不能幫我們 detect negative cycle？');
  await step(tok);                                   // 1468.0 Bellman-Ford 的重要 property
  pkt('Bellman-Ford 可以 detect！', 0, 8.6);
  me.mood('happy');
  say('這正是 Bellman-Ford 很重要的 property', '');
  await step(tok);                                   // 1474.0 左：cycle 都 ≥ 0
  tag('cycle 都 ≥ 0', 'ptr', -3.6, 7.6);
  BV.forEach((v, r) => { tag(v, 'idx', -5.6, 6.6 - r * 0.62); L[v] = [box(bfs(BT[v][5]), '#e6dccb', -4.4, 6.6 - r * 0.62, 1.0, 0.54, 0.3), null]; });
  tag('i=5', 'idx', -4.4, 7.1);
  say('左邊：graph 有 cycle', '但不管怎樣都是 non-negative（≥ 0）');
  await step(tok);                                   // 1494.0 右：存在 negative cycle
  tag('negative cycle', 'ptr alt', 3.6, 7.6);
  for (const [k, p] of Object.entries(P)) box(k, k === 't' ? C.purple : C.blue, p[0], p[1], 0.7, 0.55, 0.5, 1.2);
  arrow(V3(2.8, 5.85, 0), V3(4.6, 5.85, 0), 0xd64545); tag('−3', 'ptr alt', 3.7, 6.3);
  arrow(V3(4.6, 5.35, 0), V3(2.8, 5.35, 0), 0x6e5f49); tag('1', 'ptr', 3.7, 4.95);
  link(P.v, P.t); tag('2', 'ptr', 2.0, 4.1);
  say('右邊：存在 negative cycle', 'v ⇄ w：−3 + 1 = −2');
  await step(tok);                                   // 1509.0 procedure：induction 在 edge 數上
  say('Bellman-Ford 是 induction 的概念', 'induction 在「經過的 edge 數」上');
  await step(tok);                                   // 1522.0 n 個點：最多 n − 1 條就停
  vt = tag('i=1：OPT(v) = 2', 'ptr alt', 5.0, 3.4); wt = tag('OPT(w) = ∞', 'ptr alt', 5.0, 2.7);
  await beat(tok, 800);
  txt(vt, 'i=2：OPT(v) = 2'); txt(wt, 'OPT(w) = 1 + 2 = 3');
  say('n 個點：找最多 n − 1 條 edge 的最短路徑', '通常就停在 n − 1（右邊 n = 3，停在 i = 2）');
  await step(tok);                                   // 1539.8 想法：再多 run 一個 iteration
  const more = bub('再多跑一輪看看？', -6.0, 2.2, 1.6);
  say('想法：再多 run 一個 iteration', '');
  await step(tok);                                   // 1547.0 = 最多 n 條 edge 的最短路徑
  remove(more);
  say('多一輪代表', '最多經過 n 條 edge 的最短路徑');
  await step(tok);                                   // 1556.3 有機會找到回到自己的 cycle
  say('n 條 edge 就有機會', '找到「從某點回到自己」的 cycle');
  await step(tok);                                   // 1563.6 worst case：全部串成一個 cycle
  note('最大的 cycle：n 個點串一圈', -2.0, 0.6);
  say('worst case：所有點串成一個完整的 cycle', '也可能是更小的 cycle');
  await step(tok);                                   // 1584.0 多一個 column，和前一欄比
  tag('i=6', 'idx', -3.2, 7.1);
  BV.forEach((v, r) => { L[v][1] = box(bfs(BT[v][5]), C.teal, -3.2, 6.6 - r * 0.62, 1.0, 0.54, 0.3, 1.0); });
  say('多列一個 column', '和最多 n − 1 條的那一欄比較');
  await step(tok);                                   // 1598.0 數字降低 → 有 negative cycle
  txt(vt, 'i=3（多跑）：OPT(v) = −3 + 3 = 0'); glow(L.a[1], null);
  say('多一輪後 shortest path 的數字降低', '就代表有 negative cycle');
  await step(tok);                                   // 1614.2 沒降低 → 沒有 negative cycle
  BV.forEach((v) => glow(L[v][1], GREEN));
  say('數字沒降低、維持不變', '就代表沒有 negative cycle');
  await step(tok);                                   // 1636.0 正常：直接吐出剛算的解
  BV.forEach((v) => glow(L[v][1], null));
  good('沒變 → 正常 graph，答案吐出去', -3.8, 2.4);
  say('正常狀況：值不會變', '完成檢查，直接吐出剛才的解');
  await step(tok);                                   // 1642.0 降低 → report infeasible
  bad('變小 → report negative cycle（infeasible）', 3.6, 1.6);
  say('如果值降低了', 'report 有 negative cycle：infeasible，找不到最短路徑');
  await step(tok);                                   // 1656.2 左：positive cycle 不會讓它變短
  me.mood('calm');
  say('左邊只有 positive cycle', '多跑一輪也不會讓最短路徑變短（取 minimum）');
  await step(tok);                                   // 1686.0 右：negative cycle 讓值降低
  hl(vt, true); me.mood('wow');
  say('右邊有 negative cycle', '多跑一輪時它幫忙 reduce：v 從 2 降到 0');
  await step(tok);                                   // 1699.8 這件事可以證明
  await me.hop(tok);
  say('這件事可以證明', '');
}]);

// 28:29 證明：剛好 n 條 edge 的路徑一定重複點（鴿籠）→ cycle；若 ≥ 0 砍掉更好 → 矛盾
FRAG.push(['dpjiang1-bf-proof', '證明：n 條 edge 必重複點，cycle 必為負', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const xs = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
  const nm = ['v', 'a', 'b', 'c', 'd', 'b', 't'];
  let ms = [], cy = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  const head = tag(' ', 'ptr alt', 0, 8.2);
  await step(tok);                                   // 1709.0 多跑一輪，發現值變小
  txt(head, '多跑一輪：OPT(n, v) < OPT(n − 1, v)');
  say('假設多 run 一個 iteration', '發現某個點 v 的值變小');
  await step(tok);                                   // 1716.3 claim：path 上有 negative cycle
  good('claim：有 negative cycle', 0, 7.4);
  say('claim：這條 shortest path 裡', '存在一個 negative cycle');
  await step(tok);                                   // 1728.0 用反證法
  say('用反證法', '');
  await step(tok);                                   // 1741.0 值變低 → 最後一輪有用
  say('值變低', '代表最後那一輪是有用的');
  await step(tok);                                   // 1755.0 取的是剛好 n 條 edge 的解
  ms = xs.map((x, k) => box(nm[k], k === 0 || k === 6 ? C.purple : C.blue, x, 4.2, 0.8, 0.6, 0.5, 1.2));
  for (let k = 0; k < 6; k++) link([xs[k], 4.2], [xs[k + 1], 4.2]);
  say('取 minimum 時選了新的解', '它剛好用到 n 條 edge（路徑 P）');
  await step(tok);                                   // 1794.8 最多 n − 1 條的都比較差
  note('最多 n − 1 條的路徑：都比 P 長', 0, 2.6);
  say('所以最多用 n − 1 條 edge 的路徑', '都比 P 差（比較長）');
  await step(tok);                                   // 1819.0 鴿籠原理
  const pig = pkt('鴿籠原理', -4.0, 6.6);
  say('離散數學學過的鴿籠原理', '');
  void pig;
  await step(tok);                                   // 1832.0 P 剛好 n 條 edge，v 到 t
  tag('n = 6 個點，P 走 6 條 edge → 7 個位置', 'ptr', 1.2, 6.6);
  say('P 從 v 到 t，剛好用 n 條 edge', '經過 n + 1 個位置');
  await step(tok);                                   // 1844.0 只有 n 個點 → 一定有重複
  say('graph 只有 n 個點', '所以一定有重複 visit 的點');
  await step(tok);                                   // 1863.0 至少有一個點經過兩遍
  glow(ms[2], GOLD); glow(ms[5], GOLD);
  me.mood('wow');
  say('至少找得到一個點經過兩遍', '這裡是 b');
  await step(tok);                                   // 1885.0 重複點之間那段：cycle
  [2, 3, 4, 5].forEach((k) => tint(ms[k], C.orange));
  cy = tag('b → c → d → b：cycle', 'ptr alt', 0, 2.0);
  say('重複 visit 的那一段', '就形成一個 cycle');
  await step(tok);                                   // 1903.0 反設：它不是 negative cycle
  me.mood('calm');
  txt(cy, '反設：這個 cycle 不是 negative');
  say('反設跟預期相反的結果', '這個 cycle 不是 negative cycle');
  await step(tok);                                   // 1933.0 那它就 ≥ 0
  txt(cy, '反設：cycle ≥ 0');
  say('那這個 cycle 一定是正的（≥ 0）', '');
  await step(tok);                                   // 1940.0 把 cycle 砍掉 → 更低
  [3, 4, 5].forEach((k) => fly(ms[k]));
  await beat(tok, 700);
  move(ms[6], xs[3], 4.2, 0);
  txt(cy, '砍掉 cycle：路徑 weight 不會更高');
  say('把這段 cycle 砍掉', 'P 的 path weight 可以更低（至少不更高）');
  await step(tok);                                   // 1948.0 edge 更少、cost 更低 → 矛盾
  txt(cy, 'edge 更少、cost 不更高 ⇒ 矛盾');
  bad('和「n 條才比較好」矛盾', 0, 1.2);
  say('用的 edge 更少、cost 又不更高', '矛盾：剛好 n 條的解應該比較厲害');
  await step(tok);                                   // 1969.0 假設錯 → 一定有 negative cycle
  txt(cy, '假設錯 ⇒ 一定有 negative cycle');
  me.mood('happy'); await me.hop(tok);
  say('所以一開始的假設是錯的', '這種情況一定存在 negative cycle');
  await step(tok);                                   // 1990.0 正常跑到 n − 1；再多 run 一輪
  ms.forEach((m) => kill(m));
  txt(head, 'Bellman-Ford：跑到 n − 1，再多跑 1 輪');
  say('利用這個 property', '正常跑到 n − 1，之後再多 run 一個 iteration');
  await step(tok);                                   // 2011.0 值變小 → report error
  bad('值變小 → report error：有 negative cycle', 0, 5.2);
  say('觀察結果：值會變小', '就 report error：input graph 有 negative cycle');
  await step(tok);                                   // 2026.0 沒 update → 答案正確，吐出去
  good('沒有 update → 答案正確，吐出去', 0, 4.2);
  say('沒有被 update', '沒有 negative cycle：剛才的答案正確');
}]);

// 34:09 找出所有 negative cycle：加一個新點 t，每個點連 0 邊到 t
FRAG.push(['dpjiang1-aug-t', '加新點 t：每個點都連 0 的 edge', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { a: [-4.6, 6.0], b: [-1.6, 6.6], c: [1.6, 6.0], d: [-3.2, 3.6], e: [0.2, 3.8], f: [4.2, 4.4] };
  const N = {}, E = {};
  const T = [0.2, 0.6];
  let tm = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2049.0 偵測 = 多 run 一個 iteration
  say('detect：多 run 一個 iteration 就行', '');
  await step(tok);                                   // 2055.0 想把 negative cycle 抓出來
  const want = bub('它長什麼樣？抓出來！', -6.0, 2.2, 1.6);
  say('但我不只想知道有沒有', '還想把 negative cycle 抓出來 report');
  await step(tok);                                   // 2068.0 對 input graph 做手腳
  remove(want);
  say('對原來的 input graph', '做一個小小的手腳');
  await step(tok);                                   // 2075.0 一個隨意的 directed graph
  for (const [k, p] of Object.entries(P)) N[k] = box(k, C.teal, p[0], p[1], 0.7, 0.55, 0.5, 1.2);
  [['a', 'b'], ['b', 'c'], ['d', 'a'], ['e', 'd'], ['c', 'e'], ['f', 'c']].forEach(([x, y]) => { E[x + y] = link(P[x], P[y], C.brown, 0.4); });
  say('假設 input graph 長這樣', '隨便畫的 directed graph');
  await step(tok);                                   // 2102.0 隨便選一個點當 destination
  glow(N.f, GOLD);
  const dst = tag('destination？', 'ptr', 4.2, 5.2);
  say('原本：隨便選一個點當 destination', '算每個點到它的最短路徑');
  await step(tok);                                   // 2113.0 不保險：不是每條都經過那個 cycle
  ['ab', 'bc', 'ce', 'ed', 'da'].forEach((k) => E[k].setColor && E[k].setColor(0xd64545));
  ['a', 'b', 'c', 'e', 'd'].forEach((k) => tint(N[k], C.red));
  bad('這個 cycle 走不到 f → 算到 f 的最短路抓不到它', 1.0, 8.4);
  me.mood('sad');
  say('這樣不保險：可能漏抓', '不是所有到那個點的最短路徑都會經過 negative cycle');
  await step(tok);                                   // 2134.0 加一個新的點 t
  glow(N.f, null); kill(dst);
  tm = box('t', C.purple, T[0], T[1], 0.9, 0.6, 0.5, 2.0);
  me.mood('wow');
  say('做個手腳：加一個新的點 t', '');
  await step(tok);                                   // 2147.0 每個點都連到 t，weight 0
  for (const k of Object.keys(P)) { link(P[k], T, C.blue, 0.42); await beat(tok, 200); }
  tag('每條新 edge weight = 0', 'ptr alt', 4.2, 1.4);
  say('原 graph 每一個點都連到 t', '新 edge 的 weight 都是 0');
  await step(tok);                                   // 2164.0 Bellman-Ford：每個點到 t
  say('用 Bellman-Ford 算', '原 graph 每個點到新 t 的最短路徑');
  await step(tok);                                   // 2188.7 為什麼？假設原圖有 negative cycle
  say('為什麼可以？', '假設原 graph 有 negative cycle（紅色）');
  await step(tok);                                   // 2213.0 不管在哪，negative cycle 都 reach 得到 t
  glow(tm, GOLD);
  say('不管它在哪裡', '這個 negative cycle 一定 reach 得到 t（藍色 0 邊）');
  await step(tok);                                   // 2237.0 算到 t 的最短路徑時一定抓得到
  me.mood('happy'); await me.hop(tok);
  say('算任何一點到 t 的最短路徑時', '只要能 reach 那個 cycle，就一定抓得到');
  await step(tok);                                   // 2256.0 拿新 graph 跑 Bellman-Ford
  glow(tm, null);
  say('拿新的 graph 去 run Bellman-Ford', 't 當 destination');
  await step(tok);                                   // 2271.0 n + 1 個點：G′
  tag("G′ = 原 graph + t：n + 1 個點", 'ptr', 0, 8.6);
  say("原本 n 個點，加 t 變 n + 1 個點", "這個新 graph 叫 G′");
  await step(tok);                                   // 2285.0 要 run n + 1 個 iteration（多一輪）
  note('G′ 跑到 (n + 1) − 1，再多 1 輪', 4.4, 7.6);
  say('要 detect：多 run 一個 iteration', '這裡的 n 指 G′ 的點數');
  await step(tok);                                   // 2319.0 步驟：augment → G′，run BF + 多一輪
  const cd = code(['1. augment G → G′（加 t、0 邊）', '2. 對 G′ run Bellman-Ford', '3. 多 run 1 個 iteration'], -4.4, 1.4, 0.42);
  void cd;
  say('步驟：augment 原 graph 成 G′', '對 G′ run Bellman-Ford，再多 run 一輪');
  await step(tok);                                   // 2340.0 看最後一輪有沒有 update
  bad('最後一輪有 update → 有 negative cycle', 1.6, -0.6);
  say('看最後那一輪有沒有讓 optimal 值 update', '有 → 有 negative cycle，把它抓出來');
  await step(tok);                                   // 2357.9 很 general：正負 edge 都適用
  good('正、負 edge weight 都適用', -4.0, 8.0);
  say('這個方法很 general', '不管 edge weight 是正是負都適用');
  await step(tok);                                   // 2377.0 Bellman-Ford 使用率很高
  say('所以 Bellman-Ford 實務上', '使用率蠻高的');
}]);

// 39:51 TSP：拜訪每個城市一次再回來；n! 種排列；NP-complete
FRAG.push(['dpjiang1-tsp-intro', 'Traveling salesman：n! 種路線', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const pos = [0, 1, 2, 3, 4].map((k) => [3.0 * Math.sin(k * 2 * Math.PI / 5), 4.0 + 3.0 * Math.cos(k * 2 * Math.PI / 5)]);
  const nm = ['base', 'c1', 'c2', 'c3', 'c4'];
  const cm = [];
  let sales = null, ar = [];
  const cnt = tag(' ', 'ptr alt', 0, 8.2);
  const drawTour = (t, col) => { ar.forEach(kill); ar = []; for (let i = 0; i < 5; i++) ar.push(link(pos[t[i]], pos[t[(i + 1) % 5]], col, 0.55)); };
  await step(tok);                                   // 2391.0 Traveling salesman problem：很有名
  txt(cnt, 'Traveling Salesman Problem（TSP）');
  say('一個很有趣、很有名的問題', 'traveling salesman problem');
  await step(tok);                                   // 2400.5 NP-complete
  const np = bad('NP-complete', 5.4, 7.4);
  say('它非常 classic，也非常難', '是 NP-complete 問題');
  await step(tok);                                   // 2412.0 沒人證明有 polynomial 最佳解法
  txt(np, 'NP-complete：沒有已知的 polynomial-time 最佳解法');
  say('目前沒有人能證明', '存在 polynomial time 的方法求最佳解');
  await step(tok);                                   // 2418.0 1962 年 Bellman 想用 DP
  const bel = pal('Bellman', -6.0, C.orange, 1.6, 0.7);
  bel.mood('happy');
  say('1962 年 Richard Bellman 想到', '這麼難的問題，能不能用 DP 解？');
  await step(tok);                                   // 2438.0 比 exhaustive search 好，但仍太高
  bub('比暴力好一點，但還是太高', -6.0, 2.2, 1.6);
  say('確實比 exhaustive search 好一點', '但 complexity 還是太高');
  await step(tok);                                   // 2452.0 想成聖誕老公公送禮物
  say('可以想成聖誕老公公送禮物', '');
  await step(tok);                                   // 2466.0 銷售員，客戶在世界各地
  pos.forEach((p, k) => { if (k) cm[k] = box(nm[k], C.blue, p[0], p[1], 1.0, 0.55, 0.5, 1.2); });
  say('有一個銷售員', '客戶坐落在世界各地');
  await step(tok);                                   // 2473.5 每年拜訪每個客戶一次
  for (let k = 1; k < 5; k++) { glow(cm[k], GOLD); await beat(tok, 200); }
  say('每年要例行拜訪每個客戶一次', '');
  await step(tok);                                   // 2487.0 從 base city 出發
  for (let k = 1; k < 5; k++) glow(cm[k], null);
  cm[0] = box('base', C.purple, pos[0][0], pos[0][1], 1.0, 0.55, 0.5, 1.2);
  sales = tag('🧳', 'pkt', pos[0][0], pos[0][1] + 0.7);
  say('先從 base city（公司所在地）出發', '');
  await step(tok);                                   // 2492.0 拜訪全部再回到原城市
  const tour = [0, 1, 2, 3, 4, 0];
  for (let i = 0; i < 5; i++) { ar.push(link(pos[tour[i]], pos[tour[i + 1]], C.orange, 0.55)); await travel(tok, sales, V3(pos[tour[i]][0], pos[tour[i]][1] + 0.7, 0), V3(pos[tour[i + 1]][0], pos[tour[i + 1]][1] + 0.7, 0), 380); }
  say('安排路線，每個客戶拜訪一次', '最後回到原來的城市');
  await step(tok);                                   // 2509.0 總距離越短越好
  txt(cnt, '目標：總距離越短越好');
  say('目標：travel 的總距離越短越好', '');
  await step(tok);                                   // 2516.0 距離 = 機票錢、油錢…
  txt(cnt, '「距離」= 機票錢、油錢、真的距離…');
  say('距離可以代表很多事', '總機票錢、開車油錢，或真的距離');
  await step(tok);                                   // 2534.6 很老很 classic；每年有 TSP contest
  txt(cnt, '每年都有 TSP contest');
  say('這個問題很老、很 classic', '世界上還有有名的 TSP 競賽');
  await step(tok);                                   // 2553.0 Georgia Tech 維護；benchmark
  txt(cnt, 'Georgia Tech 維護：benchmark（VLSI、美國城市地圖…）');
  say('Georgia Tech 舉辦、維護網頁', 'benchmark 有 VLSI 繞線、美國城市地圖等');
  await step(tok);                                   // 2589.0 前幾名公開軟體
  say('前幾名隊伍會公開 software', '有興趣可以下載來玩');
  await step(tok);                                   // 2606.0 n 個城市，兩兩距離已知
  txt(cnt, 'n 個城市，兩兩距離已知');
  say('n 個 city，兩兩之間的距離已知', '要安排 route，從某點出發回到原點');
  await step(tok);                                   // 2614.0 最後一段回原點可先省略
  ar[ar.length - 1].visible = false;
  say('反正最後一定回到原點', '最後那一段可以先省略不看');
  await step(tok);                                   // 2628.0 permutation：n! 種
  const tours = [[0, 2, 4, 1, 3], [0, 3, 1, 4, 2], [0, 4, 3, 2, 1]];
  for (const t of tours) { drawTour(t, C.gray); await beat(tok, 500); }
  txt(cnt, 'n 個城市的 permutation：n! 種');
  say('n 個 city 的 permutation', '有 n! 這麼多種：complexity 非常高');
  await step(tok);                                   // 2640.0 試用 DP：Bellman 的方法
  ar.forEach(kill); ar = [];
  bel.mood('wow'); await bel.hop(tok);
  say('希望用 DP 幫它降低', '這是 Richard Bellman 一開始想的方法');
  await step(tok);                                   // 2657.0 S：所有城市的一個 subset
  [1, 3].forEach((k) => tint(cm[k], C.teal));
  txt(cnt, 'S：所有城市的一個 subset');
  say('他定義的最佳解裡', 'S 是所有城市的一個 subset');
}]);

// 44:26 Bellman 1962：OPT(S, u, v)；|S| = 2 → c(u,v)；否則 min over w：c(u,w) + OPT(S − {u}, w, v)
FRAG.push(['dpjiang1-tsp-dp', 'TSP 的 DP：OPT(S, u, v)', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const pos = [[-4.6, 4.4], [-2.2, 6.6], [0.6, 6.0], [-1.2, 2.6], [2.2, 3.4], [5.0, 6.4]];
  const nm = ['u', 'w1', 'w2', 'w3', 'v', 'x'];
  const ms = [];
  const def = tag(' ', 'ptr', 0, 8.3);
  let sb = null, a0 = null, rec = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2666.0 只考慮一個 partial subset S
  pos.forEach((p, k) => ms.push(box(nm[k], k === 5 ? C.gray : C.blue, p[0], p[1], 0.75, 0.55, 0.5, 1.2)));
  sb = ghostBox(C.teal, 8.4, 5.4, 1.0); sb.position.set(-1.2, 4.6, 0);
  tag('S', 'ptr alt', -5.0, 7.1);
  say('先考慮一個 partial 的小 subset S', '（灰色的 x 不在 S 裡）');
  await step(tok);                                   // 2672.0 抓頭尾 u、v；經過 S 每個點
  tint(ms[0], C.purple); tint(ms[4], C.purple);
  txt(def, 'OPT(S, u, v)：u 出發、經過 S 每個點一次、到 v');
  say('從 S 裡抓兩點當頭尾：u、v', '中間要經過 S 裡所有的點');
  await step(tok);                                   // 2684.0 u 到 v 的最短 route
  txt(def, 'OPT(S, u, v)：這種 route 的最短長度');
  say('完成這種 route 的最短長度', '就是 OPT(S, u, v)');
  await step(tok);                                   // 2696.0 最後要 report：S = 全部，u = base
  note('最後要的：S = 全部城市，u = base', 4.4, 1.2);
  say('最後要 report 的', 'S 包含所有點，u 就是 base city');
  await step(tok);                                   // 2720.0 recurrence 分兩個 case
  rec = tag(' ', 'ptr alt', 0, 0.3);
  say('用 DP：設計 recurrence relation', '分成兩個 case');
  await step(tok);                                   // 2737.0 boundary：S 只有 u、v
  [1, 2, 3].forEach((k) => fade(ms[k], false));
  txt(rec, 'case 1：S = {u, v}');
  say('case 1 是 boundary condition', 'S 只包含 u、v 兩點');
  await step(tok);                                   // 2744.0 直接飛：c(u, v)
  a0 = link(pos[0], pos[4], C.teal, 0.5);
  txt(rec, 'case 1：S = {u, v} → c(u, v)');
  say('只考慮兩點：直接飛就好', 'OPT = u、v 之間的直接距離 c(u, v)');
  await step(tok);                                   // 2762.6 S 比較大，有第三個點
  kill(a0);
  [1, 2, 3].forEach((k) => fade(ms[k], true));
  txt(rec, 'case 2：|S| ≥ 3');
  say('如果 S 比較大', '有第三個點以上，怎麼辦？');
  await step(tok);                                   // 2784.0 總要先 reach 到某一個點
  me.mood('wow');
  say('不管怎樣，一開始', '總要先 reach 到某一個點，再走剩下的');
  await step(tok);                                   // 2800.4 u 先到 w
  let a = link(pos[0], pos[1], C.orange, 0.5); glow(ms[1], GOLD);
  say('u 先出發到另一個 city w', '');
  await step(tok);                                   // 2807.0 再看 w 到 v 的最短 route
  const r1 = ghostBox(C.orange, 4.6, 4.8, 0.9); r1.position.set(0, 4.6, 0);
  say('接下來看 w 到 v', '之間的最短 route');
  await step(tok);                                   // 2814.0 把 u 拿掉：已經走過
  fade(ms[0], false);
  say('剩下這段會踩過誰？', '把 u 去掉：u 已經走過了');
  await step(tok);                                   // 2822.0 寫出 recurrence
  txt(rec, 'OPT(S, u, v) = c(u, w) + OPT(S − {u}, w, v)');
  me.mood('calm');
  say('recurrence 很容易寫出來', '先走一段出去，再走剩下的人');
  await step(tok);                                   // 2845.0 u 可以 reach 的人很多：每個都看
  kill(r1); fade(ms[0], true);
  for (const k of [2, 3]) { kill(a); glow(ms[k - 1], null); a = link(pos[0], pos[k], C.orange, 0.5); glow(ms[k], GOLD); await beat(tok, 700); }
  say('u 可以 reach 的不只 w 一個', '把每個人都拿出來看');
  await step(tok);                                   // 2851.0 take minimum
  kill(a); glow(ms[3], null);
  txt(rec, 'OPT(S, u, v) = min_w { c(u, w) + OPT(S − {u}, w, v) }');
  say('看誰兜起來的解比較好', 'take minimum：這就是 recurrence');
  await step(tok);                                   // 2866.0 efficiency：子問題 2ⁿ·n²
  const cx = tag('subproblem 數：2ⁿ · n²', 'ptr', 3.6, 1.2);
  say('分析 efficiency', 'S 有 2ⁿ 種，u、v 各 n 種：2ⁿ · n²');
  await step(tok);                                   // 2884.0 running time：2ⁿ · n³
  txt(cx, 'running time：2ⁿ · n³（每格試 n 個 w）');
  say('running time 再多一維', '2ⁿ · n³');
  await step(tok);                                   // 2891.0 brute force 是 n!
  const bf = tag('brute force：n! = 1·2·3·…·n', 'ptr', 3.6, 0.5);
  say('對照 brute force', '是 n! = 1 × 2 × 3 × …');
  await step(tok);                                   // 2905.0 3 以後都遠大於 2 → 比較小
  txt(bf, 'n = 20：2ⁿn³ ≈ 8.4×10⁹ < n! ≈ 2.4×10¹⁸');
  me.mood('happy');
  say('從 3 以後每個因子都遠大於 2', '所以 2ⁿn³ 比 n! 小（n = 20 時差很多）');
  await step(tok);                                   // 2915.3 仍然不是 polynomial
  bad('但仍是 exponential，不是 polynomial', 0, -0.5);
  me.mood('sad');
  say('但仍然不好', '它不是 polynomial time');
  await step(tok);                                   // 2922.0 可以用 DP，但不如前面那些經典
  say('TSP 確實可以用 DP 求解', '但 quality 不如前面課程介紹的經典例子');
}]);

// 49:04 總結：DP 是聰明的 recursion；填表不是本質；linear order
FRAG.push(['dpjiang1-dp-essence', 'DP 的本質：聰明的 recursion，不是填表', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  let rec = null, td = null, bu = null, row = null, tsp = null;
  const me = pal('', -6.4, C.orange, 1.6, 0.7);
  await step(tok);                                   // 2944.3 DP 就是一個 recursion
  rec = box('recursion', C.purple, 0, 6.8, 5.2, 0.7, 0.5, 1.2);
  say('summary：什麼是 Dynamic Programming？', '它其實就是一個 recursion');
  await step(tok);                                   // 2950.0 聰明的 recursion
  relabel(rec, '聰明的 recursion');
  say('只是它是聰明的 recursion', '');
  await step(tok);                                   // 2955.0 不重複計算
  note('不重複計算', 3.6, 7.6);
  say('它不會重複計算', '會省略重複的部分');
  await step(tok);                                   // 2966.0 這單元多用 iteration 建 table
  bu = box('bottom-up：建 table', C.teal, 3.2, 4.6, 4.2, 0.6, 0.45, 1.0);
  link([0, 6.8], [3.2, 4.6], C.brown, 0.5);
  say('這個單元很多實作用 iteration', '建 table，bottom-up 慢慢建');
  await step(tok);                                   // 2977.0 不要從填表去看 DP
  const no = bad('DP ≠ 填表格', 3.2, 3.6);
  say('千萬不要從「填表格」去看 DP', '填表是為了防止重複計算');
  await step(tok);                                   // 2985.0 源頭是 recurrence relation
  glow(rec, GOLD);
  say('所有的源頭', '還是 recursion：那個 recurrence relation');
  await step(tok);                                   // 2992.0 寫對了才有填表；也不一定要填
  glow(rec, null); remove(no);
  say('recurrence 寫對了才有填 table 這件事', '而且也不一定要填 table');
  await step(tok);                                   // 3006.0 memoization：有 table 但不必從小填
  td = box('top-down：memoization', C.blue, -3.2, 4.6, 4.2, 0.6, 0.45, 1.0);
  link([0, 6.8], [-3.2, 4.6], C.brown, 0.5);
  say('top-down 的 memoization 也有 table', '但不必從小到大填，用 recursive call 就行');
  await step(tok);                                   // 3017.0 填表絕不是本質
  bad('慢慢填 table ≠ DP 的本質', 0, 2.9);
  say('慢慢填 table', '絕對不是 DP 的本質');
  await step(tok);                                   // 3023.0 本質：聰明、避免重複的 recursion
  glow(rec, GOLD); me.mood('happy');
  say('DP 的本質是 recursion', '聰明、會避免重複計算：這才是 key idea');
  await step(tok);                                   // 3037.1 書上的例子全都在填表
  glow(rec, null); me.mood('calm');
  const bk = prop('file', -5.0, 2.6, 0, 0.9, '課本例子：都在填表');
  void bk;
  say('課本或別的書上的例子', '幾乎全部都在填 table');
  await step(tok);                                   // 3050.0 focus 在 recurrence 與 induction
  glow(rec, GOLD);
  say('請不要 focus 在填表', 'focus 在 recurrence 怎麼寫、induction 怎麼做');
  await step(tok);                                   // 3063.0 recurrence 錯，怎麼填都錯
  glow(rec, RED);
  say('recurrence 錯了', '怎麼填 table 都是錯的，algorithm 不會 work');
  await step(tok);                                   // 3078.0 什麼時候適用：objects 有自然排列
  glow(rec, null);
  row = [0, 1, 2, 3, 4].map((k) => box(String(k + 1), C.gray, -4.6 + k * 0.9, 1.6, 0.8, 0.5, 0.4, 1.0));
  say('什麼時候適合 DP？', '探討的 objects 呈現一種自然的排列');
  await step(tok);                                   // 3093.0 order 不會再改變
  row.forEach((m) => tint(m, C.teal));
  say('而且這個 order 排好之後', '不會再被動到');
  await step(tok);                                   // 3106.0 照 linear order 算出答案
  for (const m of row) { glow(m, GREEN); await beat(tok, 200); }
  say('做 induction 時', '就 follow 這個 linear order 把答案算出來');
  await step(tok);                                   // 3111.0 TSP：沒有 linear order
  row.forEach((m) => glow(m, null));
  tsp = [0, 1, 2, 3, 4].map((k) => box('c' + (k + 1), C.red, 1.4 + k * 0.9, 1.6, 0.8, 0.5, 0.4, 1.0));
  say('剛才的 TSP 為什麼不行？', '它的城市不存在 linear order');
  await step(tok);                                   // 3120.0 可以隨意打亂，每種都可能是解
  for (const perm of [[2, 0, 4, 1, 3], [4, 3, 0, 2, 1]]) { perm.forEach((p, k) => move(tsp[p], 1.4 + k * 0.9, 1.6, 0)); await beat(tok, 800); }
  say('城市可以隨意打亂', '每一種打亂都可能是一個解');
  await step(tok);                                   // 3132.0 subproblem 數不是 polynomial
  tag('subproblem 數：不是 polynomial', 'ptr alt', 3.2, 0.6);
  me.mood('sad');
  say('所以它包含的 subproblem 個數', '不是 polynomial number');
  await step(tok);                                   // 3142.0 比 brute force 好，但不夠 efficient
  say('雖然比 brute force 好', '但達不到 efficient algorithm（polynomial time）的條件');
  await step(tok);                                   // 3161.0 有 linear order → 第一優先試 DP
  me.mood('happy'); await me.hop(tok);
  good('有 linear order → first priority：DP', -2.8, 0.6);
  say('發現 linear order 的特性', '就不要懷疑：first priority 先試 DP');
}]);

// 53:08 最後的 paradigm 總結：brute force、greedy、D&C、DP（Lec19 版）
FRAG.push(['dpjiang1-paradigms3', '四種 paradigm 總結：greedy 最快、DP 靠重複', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const X = [-4.8, -1.6, 1.6, 4.8];
  const N = ['Brute force', 'Greedy', 'Divide & Conquer', 'Dynamic Prog.'];
  const head = N.map((n, k) => box('', LV[k], X[k], 7.0, 2.9, 0.6, 0.4, 1.2));
  N.forEach((n, k) => tag(n, 'ptr', X[k], 7.0, 0.3));
  head.forEach((m) => fade(m, false));
  const focus = (k) => head.forEach((m, i) => { fade(m, i === k || m.userData.done); glow(m, i === k ? GOLD : null); if (i === k) m.userData.done = true; });
  await step(tok);                                   // 3188.0 brute force：每種可能都算
  focus(0);
  for (let k = 0; k < 9; k++) { box('', C.sand, X[0] - 0.9 + (k % 3) * 0.9, 5.6 - Math.floor(k / 3) * 0.7, 0.7, 0.45, 0.35, 0.8); await beat(tok, 100); }
  say('brute force：沒有任何 idea', '每種可能都算一次，挑最好的');
  await step(tok);                                   // 3195.0 greedy：step by step 兜解
  focus(1);
  const gr = [];
  for (let k = 0; k < 4; k++) { gr.push(box('', C.blue, X[1], 5.6 - k * 0.75, 1.6, 0.45, 0.35, 0.8)); await beat(tok, 250); }
  say('greedy：step by step', '慢慢把解兜起來');
  await step(tok);                                   // 3202.0 每一步選當下最好的
  gr.forEach((m) => glow(m, GREEN));
  say('每一步 make a decision', '都選當下看到最好的：所以叫 greedy');
  await step(tok);                                   // 3214.9 可以證明會貢獻到最佳解
  gr.forEach((m) => glow(m, null));
  good('證明：每步都在最佳解裡', X[1], 2.4);
  say('能達到最佳解時', '可以證明每次選的都會貢獻到 final optimal solution');
  await step(tok);                                   // 3226.0 不需要反悔
  note('決定了就不反悔', X[1], 1.7);
  say('所以 make decision 後不需要反悔', '它一定是 final solution 的成員');
  await step(tok);                                   // 3234.0 有這個特性就用 greedy
  say('問題有這個好特性', '就不要懷疑，直接用 greedy');
  await step(tok);                                   // 3249.0 greedy 通常最快
  good('通常最快（簡單 for loop）', X[1], 1.0);
  say('能用 greedy 得最佳解時，它通常最快', '簡單的 for loop，比 DP 還快一點');
  await step(tok);                                   // 3261.0 D&C：拆成同性質小問題
  focus(2);
  const d0 = box('', C.cyan, X[2], 5.6, 2.2, 0.45, 0.35, 0.8);
  const d1 = [X[2] - 0.6, X[2] + 0.6].map((x) => box('', C.cyan, x, 4.6, 1.0, 0.45, 0.35, 0.8));
  say('D&C：大問題拆成相同性質的小問題', '');
  await step(tok);                                   // 3272.0 recursively 解，再 combine
  d1.forEach((m) => { tint(m, C.teal); move(m, X[2], 5.6, 0); });
  await beat(tok, 700);
  d1.forEach(kill); tint(d0, C.teal);
  say('recursively 求解', '重點是把答案 combine 回來');
  await step(tok);                                   // 3283.0 DP：一樣拆成小問題
  focus(3);
  const t = [0, 1, 2, 3].map((k) => box('', C.gray, X[3] - 1.05 + k * 0.7, 5.0, 0.6, 0.6, 0.35, 0.8));
  say('DP：一樣把大問題拆成小問題', '');
  await step(tok);                                   // 3294.0 很多 overlapping subproblem
  [1, 2].forEach((k) => glow(t[k], GOLD));
  say('但它發現有很多 overlapping subproblem', '有些會重複出現');
  await step(tok);                                   // 3307.0 不重複 → 不用 DP
  [1, 2].forEach((k) => glow(t[k], null));
  bad('不重複 → 記 table 沒意義', X[3], 3.8);
  say('如果每個 subproblem 都 unique', '記 table 沒意義：只用一次，沒人再用');
  await step(tok);                                   // 3326.0 iteration：從小建表 build up
  for (const m of t) { tint(m, C.orange); await beat(tok, 250); }
  say('有重複，用 DP 就非常好', 'iteration 形式：從小問題建表，build up 大的解');
  await step(tok);                                   // 3346.0 D&C 與 DP 都從 induction 出發
  head.forEach((m) => glow(m, null));
  tag('D&C 與 DP：都從 induction 出發', 'ptr alt', 0, 1.8);
  say('D&C 和 DP', 'basic idea 都從 induction 出發');
  await step(tok);                                   // 3352.0 不重複 → D&C
  glow(head[2], GOLD);
  note('subproblem 不重複 → D&C 就好', X[2] - 1.0, 1.0);
  say('拆出來的 subproblem 都不會重複', '用 D&C 就好');
  await step(tok);                                   // 3357.0 會重複 → DP 降 complexity
  glow(head[2], null); glow(head[3], GOLD);
  note('會重複 → 試 DP', X[3], 0.3);
  say('subproblem 會重複', '就試 DP 來降低 complexity');
}]);
  }

  // ═══ dpjiang2.js ═══
  {
// ─── 交大江蕙如 Lec18 Dynamic Programming (2/3)：dkmxHij2pfU ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in
// each step comment is the transcript line where the lecturer starts saying it). Motion between steps is
// short; nothing loops or replays. Tables fill one entry (or one row/column) per sentence that says it.
// 老師的例子（Kleinberg & Tardos 6.4、6.8）：
// Subset Sum：W = 15、物品 12 1 2 1 4 → 12 + 2 + 1 = 15；反例 W = 11、物品 1 2 5 6 7：大的先 7+2+1 = 10、小的先 1+2+5 = 8、最佳 5+6 = 11；
// OPT(i) 只有一個變數不夠（放 12 kg 後只剩 3 kg）→ OPT(i, w)；填表 M[0..5][0..11]，M[5][11] = max(11, 7 + M[4][4] = 3) = 11；O(nW) pseudo-polynomial。
// Knapsack：價值 1 6 18 22 28，貪心先偷最貴 28+6+1 = 35，最佳 18+22 = 40；wᵢ 改成 vᵢ；0/1 vs fractional；bin packing。
// Bellman-Ford：Dijkstra 反例 s→t 1、s→a 2、a→b 3、b→t −6（正解 s-a-b-t = −1）；全部 +6 仍錯；negative cycle；simple path ≤ n−1 條邊；
// OPT(i, v) = v 到 t 最多 i 條邊；課本圖 t a b c d e，表格最後一欄 0 −6 −2 3 0 0；a 的路徑 a→b→e→c→t = −6；O(nm)。
// 示意值：bin packing 的體積、optimization 的解空間點、simple path 圖。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove } = K;
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#e6dccb', gold: '#c08a1f', brown: '#6e5f49' };
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pal = (name, x, color = '#f4a56a', z = 1.6, size = 0.7, y = 0) => buddy(name, '', color, x, y, z, size);
const hl = (l, on) => { l.element.className = 'lab-label ' + (on ? 'ptr alt' : 'ptr'); };
const paint = (ar, c) => ar.setColor(new THREE.Color(c));
const IW = [1, 2, 5, 6, 7], IV = [1, 6, 18, 22, 28];
const ICOL = [C.teal, C.blue, C.purple, C.orange, C.pink];
function ssTable(val) {
  const M = [];
  for (let i = 0; i <= 5; i++) { M[i] = []; for (let w = 0; w <= 11; w++) M[i][w] = (i === 0 || w === 0) ? 0 : IW[i - 1] > w ? M[i - 1][w] : Math.max(M[i - 1][w], val[i - 1] + M[i - 1][w - IW[i - 1]]); }
  return M;
}
// a "bag" column: ghost box from y0 with capacity cap (u world units per kg)
function bag(x, y0, cap, u, label) {
  const g = ghostBox(C.gold, 1.5, cap * u, 1.2); g.position.set(x, y0 + cap * u / 2, 0);
  const l = tag(label, 'ptr', x, y0 + cap * u + 0.45);
  return { g, l, x, y0, u, used: 0, items: [] };
}
function put(b, w, col, text) {
  const h = w * b.u, y = b.y0 + b.used + h / 2;
  const m = box(text, col, b.x, y, 1.2, Math.max(0.12, h - 0.04), 0.9, 2.2);
  b.used += h; b.items.push(m); return m;
}

// Bellman-Ford example graph (K&T Fig 6.23)
const BFN = ['t', 'a', 'b', 'c', 'd', 'e'];
const BFP = { a: [-4.3, 2.3], b: [-1.3, 0], d: [-4.3, -2.3], c: [1.5, 2.2], e: [1.2, -2.3], t: [4.4, 0] };
const BFE = [['a', 't', -3], ['a', 'b', -4], ['b', 'd', -1], ['b', 'e', -2], ['c', 'b', 8], ['c', 't', 3], ['d', 'a', 6], ['d', 't', 4], ['e', 'c', -3], ['e', 't', 2]];
function bfGraph(ox, oy, s, drop = 0) {
  const P = {}, N = {}, E = {};
  for (const k of BFN) P[k] = [ox + BFP[k][0] * s, oy + BFP[k][1] * s];
  for (const k of BFN) N[k] = box(k, k === 't' ? C.orange : C.blue, P[k][0], P[k][1], 0.75 * Math.max(s, 0.75), 0.75 * Math.max(s, 0.75), 0.5, drop);
  for (const [u, v, w] of BFE) {
    const a = P[u], b = P[v];
    const ar = link([a[0], a[1], 0], [b[0], b[1], 0], C.brown, 0.45 * Math.max(s, 0.75));
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const lb = tag(String(w), 'idx', (a[0] + b[0]) / 2 - dy / L * 0.3, (a[1] + b[1]) / 2 + dx / L * 0.3);
    E[u + v] = { ar, lb, u, v, w };
  }
  return { P, N, E };
}
function bfTable() {
  const M = {};
  BFN.forEach((x) => { M[x] = [x === 't' ? 0 : Infinity]; });
  for (let i = 1; i <= 5; i++) BFN.forEach((x) => { let m = M[x][i - 1]; for (const [u, v, w] of BFE) if (u === x) m = Math.min(m, w + M[v][i - 1]); M[x][i] = m; });
  return M;
}
const fmt = (v) => (v === Infinity ? '∞' : String(v));
// table: rows = vertices, cols = i (0..5)
function bfGrid(x0, y0, dx = 1.05, dy = 0.82) {
  const X = (i) => x0 + i * dx, Y = (r) => y0 - r * dy;
  for (let i = 0; i <= 5; i++) tag('i=' + i, 'idx', X(i), y0 + 0.75);
  BFN.forEach((v, r) => { tag(v, 'ptr', x0 - 0.85, Y(r)); for (let i = 0; i <= 5; i++) box('', C.paper, X(i), Y(r), 0.9, 0.62, 0.2, 0, -0.2); });
  return { X, Y, cell: {} };
}
function bfFill(G, v, i, val, drop = 1.0) {
  const r = BFN.indexOf(v);
  const m = box(fmt(val), val === Infinity ? GRAY : i === 0 ? C.sand : C.teal, G.X(i), G.Y(r), 0.8, 0.52, 0.4, drop);
  G.cell[v + i] = m; return m;
}
const bfCol = (G, M, i, drop = 0.8) => BFN.forEach((v) => bfFill(G, v, i, M[v][i], drop));

// ════════════════ dkmxHij2pfU（交大江蕙如 Lec18：Subset Sum、Knapsack、Bellman-Ford） ════════════════

// 01:46 Subset Sum：W = 15，物品 12 1 2 1 4 → 12 + 2 + 1 = 15
FRAG.push(['dpjiang2-subset-def', 'Subset Sum：包包限重 W，塞越滿越好', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  let B = null; const it = [];
  const ws = [12, 1, 2, 1, 4], xs = [0.6, 2.0, 3.2, 4.4, 5.6];
  const me = pal('', -6.4, C.orange);
  await step(tok);                                   // 110.0 Karp：21 個 NP-complete 之一
  const np = tag('Karp 的 21 個 NP-complete 問題之一', 'ptr alt', 0, 8.6);
  say('Subset Sum 被 Karp 列為 21 個 NP-complete 之一', 'NP-complete 期末才會正式介紹');
  await step(tok);                                   // 129.0 很困難，跟前面的問題差很多
  me.mood('wow');
  say('它是很困難的問題', '和前面學過的問題難度明顯不同');
  await step(tok);                                   // 145.0 DP 在合理情況下 quality 很好
  txt(np, '很難，但 DP 在合理情況下能得到很好的答案');
  me.mood('happy');
  say('但在很多合理的情況下', 'DP 能得到非常好的答案');
  await step(tok);                                   // 159.0 input：n 個物體
  remove(np);
  say('Subset Sum 的 input：n 個物體', '');
  await step(tok);                                   // 168.0 還有一個包包
  B = bag(-3.6, 0.6, 15, 0.36, '包包');
  say('還有一個包包', '');
  await step(tok);                                   // 175.0 capacity W = 15 kg
  txt(B.l, 'W = 15 kg');
  say('包包有限重 capacity W', '這裡 W = 15 kg，超過就破掉');
  await step(tok);                                   // 191.0 旁邊的 item 各有重量 wᵢ
  ws.forEach((w, k) => { it.push(box(w, ICOL[k], xs[k], 0.6 + w * 0.36 / 2, 1.0, w * 0.36, 0.8, 1.6)); tag('w=' + w, 'idx', xs[k], 0.2); });
  say('旁邊有一些 item', '每個 item i 有自己的重量 wᵢ');
  await step(tok);                                   // 208.0 塞進包包，不能破，越滿越好
  const g1 = note('① 不能破', -1.4, 6.6);
  say('把東西塞進包包：不能讓包包破掉', '而且塞得越滿越好');
  await step(tok);                                   // 232.0 越接近 W 越好
  note('② 越接近 W 越好', -1.4, 5.9);
  say('第二：越接近 capacity W 越好', '');
  void g1;
  await step(tok);                                   // 240.0 maximize 重量、不超過 W
  tag('max Σ wᵢ，且 Σ wᵢ ≤ W', 'ptr', 2.4, 8.2);
  say('目標：maximize 塞進去的總重量', '但不能超過 W');
  await step(tok);                                   // 260.0 15 kg；旁邊 12、1、2、1、4
  it.forEach((m) => glow(m, GOLD));
  say('包包 15 kg，旁邊有 12、1、2、1、4 kg', '怎麼塞最滿又不破？');
  await step(tok);                                   // 277.0 12 + 2 + 1 = 15
  it.forEach((m) => glow(m, null));
  for (const k of [0, 2, 1]) { fly(it[k], V3(0, 4, 2)); put(B, ws[k], ICOL[k], ws[k]); await beat(tok, 600); }
  B.items.forEach((m) => glow(m, GREEN));
  txt(B.l, '12 + 2 + 1 = 15');
  me.mood('happy'); await me.hop(tok);
  say('case 很小，眼睛看：12 + 2 + 1', '剛好 15 kg：塞滿又不破，這是最佳解');
  await step(tok);                                   // 284.0 但要怎麼解它？
  me.mood('wow');
  bub('那…一般要怎麼解？', -6.0, 2.2, 1.6);
  say('問題來了：要怎麼解它？', '');
  await step(tok);                                   // 293.2 看起來好像很簡單？
  say('看起來好像很簡單？', '等一下看為什麼不簡單');
}]);

// 05:05 Greedy 反例：W = 11，物品 1 2 5 6 7
FRAG.push(['dpjiang2-subset-greedy', 'Greedy 反例：W = 11，大的先只得 10', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const xs = [-3, -1.5, 0, 1.5, 3], u = 0.4;
  let B1 = null, B2 = null, B3 = null;
  const g = pal('greedy', -6.4, C.blue);
  const add = (B, k) => put(B, IW[k], ICOL[k], IW[k]);
  await step(tok);                                   // 305.0 greedy 得不到最佳解；反例
  bad('greedy 得不到最佳解', 0, 8.6);
  say('先講：這題用 greedy 得不到最佳解', '舉一個反例');
  await step(tok);                                   // 311.8 capacity 11 kg
  B1 = bag(-4.2, 0.4, 11, u, 'W = 11'); B2 = bag(0, 0.4, 11, u, 'W = 11'); B3 = bag(4.2, 0.4, 11, u, 'W = 11');
  say('包包限重 11 公斤', '');
  await step(tok);                                   // 317.0 五樣物體：1 2 5 6 7
  IW.forEach((w, k) => box(w, ICOL[k], xs[k], 7.4, 1.0, 0.6, 0.6, 1.2));
  tag('item 重量', 'idx', -4.6, 7.4);
  say('旁邊五樣物體', '重量 1、2、5、6、7');
  await step(tok);                                   // 325.6 怎麼選才最滿？
  say('怎麼選，才能塞最滿又不破？', '');
  await step(tok);                                   // 336.0 用 greedy 試試看
  g.mood('happy');
  say('第一個想法：用 greedy 試試', '');
  await step(tok);                                   // 351.0 大的先塞
  txt(B1.l, '大的先');
  say('希望塞滿一點：大的先塞', '');
  await step(tok);                                   // 360.0 先塞 7
  add(B1, 4);
  say('先塞重量 7', '');
  await step(tok);                                   // 372.0 只剩 4 kg：再塞 2 和 1
  await beat(tok, 300);
  add(B1, 1); await beat(tok, 500); add(B1, 0);
  say('7 放進去只剩 4 kg', '6、5 塞不下，只能再塞 2 和 1');
  await step(tok);                                   // 383.0 只得 7 + 2 + 1 = 10
  txt(B1.l, '7+2+1 = 10');
  B1.items.forEach((m) => glow(m, RED)); g.mood('sad');
  say('大的先：只得 7 + 2 + 1 = 10', '最佳解在哪裡？');
  await step(tok);                                   // 392.0 最佳：5 + 6 = 11
  txt(B3.l, '最佳解');
  add(B3, 2); await beat(tok, 500); add(B3, 3);
  txt(B3.l, '5+6 = 11'); B3.items.forEach((m) => glow(m, GREEN));
  say('眼睛看：5 + 6 = 11', '剛好塞滿又不破');
  await step(tok);                                   // 407.0 倒過來：小的先？
  txt(B2.l, '小的先'); g.mood('calm');
  say('也可以倒過來', '從最小的開始塞？');
  await step(tok);                                   // 415.0 1 + 2 + 5 → 塞不下了
  add(B2, 0); await beat(tok, 400); add(B2, 1); await beat(tok, 400); add(B2, 2);
  txt(B2.l, '1+2+5 = 8'); B2.items.forEach((m) => glow(m, RED));
  say('小的先：1 + 2 + 5 = 8', '6、7 都塞不下了');
  await step(tok);                                   // 423.7 greedy 不行 → 想別的方法
  g.mood('sad'); await g.hop(tok);
  say('greedy 在這題沒辦法求得最佳解', '一定要想別的方法');
}]);

// 07:26 Optimization problem：objective function + constraints
FRAG.push(['dpjiang2-opt-form', '最佳化問題 = objective function + constraints', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const poly = [[-4, 1.2], [1.5, 1.2], [3.2, 4.0], [0.5, 6.6], [-4, 5.2]];
  const pts = [[-3, 2], [-1.5, 3.5], [0, 2.5], [1.2, 4.6], [-2.5, 4.6], [0.3, 5.8], [4.5, 2.5], [5.2, 6.2], [-5.6, 7], [4.2, 6.8]];
  const inside = (k) => k < 6;
  let t1 = null, t2 = null, ls = [], dots = [], f = null;
  await step(tok);                                   // 445.0 Programming = mathematical programming
  tag('Dynamic Programming 的 Programming = 最佳化', 'ptr alt', 0, 8.6);
  say('DP 的 Programming', '指 mathematical programming：針對最佳化問題');
  await step(tok);                                   // 458.0 正式描述 optimization problem
  say('正式描述一下 optimization problem', '以後其他課也常看到這種 formulation');
  await step(tok);                                   // 471.0 兩部分：objective + constraint
  t1 = tag('① Objective function', 'ptr', -3.2, 7.8); t2 = tag('② Constraints', 'ptr', 3.2, 7.8);
  say('由兩部分構成', 'objective function 和 constraints');
  await step(tok);                                   // 494.0 一個評分方式：cost function
  hl(t1, true);
  say('objective：對解提出評分方式', '例如 cost function');
  await step(tok);                                   // 501.0 有的越高越好、有的越低越好
  say('有的問題分數越高越好（gain）', '有的越低越好（cost）');
  await step(tok);                                   // 519.0 maximize 或 minimize
  txt(t1, '① Objective：maximize 或 minimize');
  say('所以分兩大類', 'maximize 或 minimize 某個 function');
  await step(tok);                                   // 528.0 Subset Sum：塞得越滿越好
  say('Subset Sum：塞進去的東西', '越多（越滿）越好');
  await step(tok);                                   // 543.0 maximize Σ_{i∈S} wᵢ
  f = tag('maximize Σ over i∈S wᵢ（S：選出的 item）', 'ptr alt', 0, 0.6);
  say('objective：maximize Σ wᵢ', 'S 是最後選出來的 item');
  await step(tok);                                   // 564.0 constraints：限制條件
  hl(t1, false); hl(t2, true);
  ls = poly.map((p, k) => { const q = poly[(k + 1) % poly.length]; return line(p[0], p[1], q[0], q[1], 0, C.brown); });
  say('第二部分 constraints', '顧名思義：很多限制條件');
  await step(tok);                                   // 570.0 規範出 solution space
  ls.forEach((l) => { l.material.color.set(C.teal); });
  say('限制條件規範出 solution space', '');
  await step(tok);                                   // 578.0 合理解要落在圍出的空間裡
  dots = pts.map((p, k) => box('', inside(k) ? C.teal : GRAY, p[0], p[1], 0.35, 0.35, 0.35, 1.0));
  say('合理解一定落在 constraints 圍出的空間裡', '外面的（灰色）不合理');
  await step(tok);                                   // 586.0 在合理解中挑 objective 最好的
  pts.forEach((p, k) => { if (!inside(k)) fly(dots[k]); });
  await beat(tok, 500);
  glow(dots[5], GOLD); tint(dots[5], C.gold);
  say('在合理解當中', '挑讓 objective function 最好的那個');
  await step(tok);                                   // 596.0 這題的 constraint：包包不能破
  txt(f, 'max Σ over i∈S wᵢ   s.t.  Σ over i∈S wᵢ < W');
  say('這題的 constraint 很簡單：包包不能破', '選出的 S 總重量不能超過 W');
  await step(tok);                                   // 621.0 加上等號：≤
  txt(f, 'max Σ over i∈S wᵢ   s.t.  Σ over i∈S wᵢ ≤ W');
  say('加上等號比較合適', '可以剛好 reach capacity');
  await step(tok);                                   // 634.0 標準的最佳化 formulation
  hl(t2, false); hl(f, false);
  say('這就是很標準的最佳化問題 formulation', '有 objective，也有 constraint');
  await step(tok);                                   // 651.0 一次式 → Linear Programming
  ls.forEach(kill); dots.forEach(kill);
  txt(t1, '一次式（含常數）→ Linear Programming');
  say('式子都是一次式以下', '叫 Linear Programming');
  await step(tok);                                   // 664.1 二次式 → Quadratic Programming
  txt(t2, '二次式 → Quadratic Programming');
  say('出現二次式', '叫 Quadratic Programming');
  await step(tok);                                   // 671.0 更高 → Non-linear Programming
  tag('更高次 → Non-linear Programming', 'ptr alt', 0, 5.6);
  say('再上去', '廣泛稱為 non-linear programming');
  await step(tok);                                   // 685.7 回到 Subset Sum：用 DP 設計
  pkt('回到 Subset Sum → 設計 DP', 0, 3.6);
  say('回到 Subset Sum', '用 DP 來發展演算法');
}]);

// 11:52 第一版：OPT(i) = 前 i 個 item 的最佳解；第 n 個 item 選或不選
FRAG.push(['dpjiang2-subset-cases', '第一版：OPT(i)，第 n 個 item 選或不選', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const lbl = ['1', '2', '3', '…', 'n−1', 'n'], it = [];
  const me = pal('', -6.4, C.orange);
  let ov = null, def = null, c1 = null, c2 = null, f1 = null, f2 = null;
  await step(tok);                                   // 712.0 DP 基本想法：數學歸納法
  pkt('DP = 數學歸納法', -4.4, 8.6);
  say('DP 的基本想法', '就是數學歸納法');
  await step(tok);                                   // 717.0 objective 用 OPT 表示
  def = tag('OPT = 某個最佳值', 'ptr', 2.6, 8.6);
  say('把 objective 的最佳值', '用 OPT 來表示');
  await step(tok);                                   // 730.0 越大越好但不超過 W
  txt(def, 'OPT：越大越好，但 ≤ W');
  say('最佳解的 value 越大越好', '但不能超過 W');
  await step(tok);                                   // 738.6 對 n 個 item 來說
  txt(def, 'OPT：n 個 item 裡選，越大越好，≤ W');
  say('更明確地說：對 n 個 item 選出來', '越大越好');
  await step(tok);                                   // 753.0 拆成 recurrence relation
  say('由這個角度', '把它拆成 recurrence relation 的形式');
  await step(tok);                                   // 757.0 定義較小的 subproblem：OPT(i)
  txt(def, '子問題：OPT(i)');
  say('先定一個比較小的 subproblem', 'OPT(i)');
  await step(tok);                                   // 767.4 item 隨意編號 1 … n
  lbl.forEach((s, k) => it.push(box(s, k === 5 ? C.orange : C.blue, -4 + k * 1.6, 7.0, 1.2, 0.7, 0.6, 1.2)));
  say('item 事先隨意編號 1、2、3…n', '不用照重量排');
  await step(tok);                                   // 784.0 OPT(i)：前 i 個 item 的最佳解
  ov = ghostBox(C.teal, 1, 1.0, 1.0);
  await anim(tok, 1200, (e) => { const w = (1 + e * 3) * 1.6; ov.scale.set(w, 1, 1); ov.position.set(-4 - 0.8 + w / 2, 7.0, 0); });
  txt(def, 'OPT(i)：前 i 個 item、包包不破的最佳解');
  say('OPT(i)：前 i 個 item 當中', '放進包包又不破的最佳解');
  await step(tok);                                   // 801.0 找一個 S，讓 Σ wⱼ 最大
  const sdef = tag('OPT(i) = max Σ over j∈S wⱼ', 'ptr alt', 0, 5.6);
  say('也就是找一個 set S', '讓 Σ wⱼ 越大越好');
  await step(tok);                                   // 824.0 S 是 {1..i} 的 subset，不爆掉
  txt(sdef, 'OPT(i) = max Σ over j∈S wⱼ，S ⊆ {1..i}，Σ ≤ W');
  say('S 是從 1 到 i 裡選的 subset', '全選也可以，只要不爆掉');
  await step(tok);                                   // 848.0 最後目標：OPT(n)
  await anim(tok, 800, (e) => { const w = (4 + e * 2) * 1.6; ov.scale.set(w, 1, 1); ov.position.set(-4 - 0.8 + w / 2, 7.0, 0); });
  txt(def, '目標：OPT(n)');
  say('最後要吐出 OPT(n)', '所有 item 都拿來考慮');
  await step(tok);                                   // 882.0 從最後一個 instance 來看
  say('怎麼兜出 OPT(n)？', '從最後一個來分析');
  await step(tok);                                   // 897.4 跟 weighted interval scheduling 很像
  note('跟 weighted interval scheduling 很像', 3.0, 5.0);
  say('跟 weighted interval scheduling 的方式很類似', '');
  await step(tok);                                   // 926.0 看最後一個 item n
  kill(ov); kill(sdef);
  glow(it[5], GOLD);
  say('編號 label 好就不再改', '看最後一個：第 n 個 item');
  await step(tok);                                   // 933.0 最佳解只有兩種 case
  say('最佳解的組成', '只會落在兩種 case');
  await step(tok);                                   // 959.0 case 1：n ∉ O
  c1 = box('case 1：n ∉ O', C.purple, -3.2, 4.6, 3.6, 0.8, 0.6, 1.4);
  link([1.2, 6.6], [-3.2, 5.0], C.brown);
  say('case 1：第 n 個沒有選', '不屬於最佳解 O');
  await step(tok);                                   // 969.0 case 2：n ∈ O
  c2 = box('case 2：n ∈ O', C.orange, 3.2, 4.6, 3.6, 0.8, 0.6, 1.4);
  link([4.0, 6.6], [3.2, 5.0], C.brown);
  say('case 2：第 n 個有選', '在最佳解裡');
  await step(tok);                                   // 997.0 case 1 分析：不放 → OPT(n−1)
  glow(c1, GOLD);
  f1 = tag('OPT(n) = OPT(n−1)', 'ptr', -3.2, 3.6);
  say('case 1：第 n 個沒放進包包', '最佳解跟 OPT(n − 1) 一樣');
  await step(tok);                                   // 1016.7 等於只考慮前 n−1 個
  say('不考慮第 n 個', '等於只看前 n − 1 個：直接承接');
  await step(tok);                                   // 1033.0 case 2：放進包包
  glow(c1, null); glow(c2, GOLD);
  say('case 2：第 n 個要放進包包', '會怎樣？');
  await step(tok);                                   // 1045.0 貢獻 wₙ，剩下由前 n−1 個
  say('第 n 個貢獻一點重量 wₙ', '剩下由前 n − 1 個貢獻');
  await step(tok);                                   // 1063.0 OPT(n) = wₙ + OPT(n−1)
  f2 = tag('OPT(n) = wₙ + OPT(n−1)', 'ptr', 3.2, 3.6);
  say('初步寫成', 'OPT(n) = wₙ + OPT(n − 1)');
  await step(tok);                                   // 1080.0 同學表情怪怪的
  me.mood('wow');
  bub('嗯…怪怪的？', -6.0, 2.2, 1.6);
  say('有同學表情怪怪的', '這個 recurrence 有沒有問題？');
  await step(tok);                                   // 1096.0 放進去會吃掉重量
  glow(c2, RED); hl(f2, true);
  bad('放進 n 會吃掉容量！', 3.2, 2.8);
  say('怪在哪：第 n 個放進包包', '會吃掉重量（容量）');
  void f1;
}]);

// 18:25 問題：放進 wₙ 會吃掉容量 → OPT(i, w)
FRAG.push(['dpjiang2-subset-2var', '放進 12 kg 只剩 3 kg：多加一個變數 w', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const B = bag(-3.6, 0.5, 15, 0.38, 'W = 15');
  const me = pal('', -6.4, C.orange);
  let m = null, rest = null, info = tag(' ', 'ptr', 2.6, 6.6), grid = false, c1 = null;
  await step(tok);                                   // 1111.0 會吃空間 → 剩下的人受限
  say('放進去會吃空間', '剩下 n − 1 個能放的空間就受到限制');
  await step(tok);                                   // 1121.1 少掉一塊；function 有考慮嗎？
  txt(info, 'OPT(n − 1) 有考慮空間變少嗎？');
  say('少掉一塊了', '原本的 function 有考慮到這件事嗎？');
  await step(tok);                                   // 1128.9 沒有：OPT 是在容量 W 下定義的
  txt(info, '沒有：OPT 永遠假設容量是 W');
  me.mood('sad');
  say('沒有', 'OPT 是在包包容量 W 的狀況下設計的');
  await step(tok);                                   // 1145.0 例：放進 12 kg
  m = put(B, 12, C.orange, 12);
  say('剛才的例子：把 12 kg 放進包包', '');
  await step(tok);                                   // 1159.3 15 kg 只剩 3 kg
  rest = ghostBox(C.teal, 1.7, 3 * 0.38, 1.4); rest.position.set(-3.6, 0.5 + 12 * 0.38 + 1.5 * 0.38, 0);
  txt(B.l, '只剩 3 kg');
  say('15 kg 的包包', '現在只剩 3 kg 給剩下的人');
  await step(tok);                                   // 1166.0 剩下的人要塞 3 kg，不是 15 kg
  glow(m, RED);
  txt(info, '剩下的人要塞的是 3 kg，不是 15 kg');
  say('剩下的人要塞的是 3 kg', '不是 15 kg：不一樣');
  await step(tok);                                   // 1175.0 available capacity = W − wₙ
  glow(m, null);
  txt(info, 'available capacity = W − wₙ');
  say('放進 wₙ 後，真正的容量變少', 'available capacity = W − wₙ');
  await step(tok);                                   // 1205.0 OPT(i) 定義太窄
  txt(info, 'OPT(i) 的定義太窄');
  me.mood('wow');
  say('所以 OPT(i) 的定義太窄了', '');
  await step(tok);                                   // 1211.0 只跟 item 有關
  say('它只跟 item 有關', '而且永遠在大 W 之下');
  await step(tok);                                   // 1219.0 capacity 也是變數
  txt(info, 'capacity 也是會影響 OPT 的變數！');
  say('發現 capacity 也是一個變數', '會影響最佳值');
  await step(tok);                                   // 1233.0 定義要 extend
  say('所以定義要 extend', '最佳解不只跟前 i 個 item 有關');
  await step(tok);                                   // 1250.0 w 也是很重要的引數
  txt(info, '還跟包包能放多少（w）有關');
  say('還跟包包能放多少東西有關', 'w 也是很重要的引數');
  await step(tok);                                   // 1265.0 加一個 term：OPT(i, w)
  for (let i = 0; i < 4; i++) for (let w = 0; w < 6; w++) box('', C.paper, 0.6 + w * 0.95, 1.2 + i * 0.8, 0.8, 0.6, 0.2, 0, -0.2);
  tag('w →', 'idx', 6.4, 1.2); tag('i ↑', 'idx', 0.0, 4.4);
  grid = true;
  txt(info, 'OPT(i, w)：前 i 個 item、容量 w');
  me.mood('happy');
  say('加一個 term：小寫 w', 'OPT(i, w)：前 i 個、目前考慮的容量 w');
  await step(tok);                                   // 1287.0 Σ wⱼ 要在小 w 之下
  txt(info, 'OPT(i, w) = max Σ wⱼ，且 Σ wⱼ ≤ w');
  say('一樣要 Σ wⱼ 越大越好', '但同時要在小寫 w 之下');
  await step(tok);                                   // 1312.9 修正後 recurrence 就對了
  say('透過這個修正', '剛才的 recurrence 就可以變正確');
  await step(tok);                                   // 1324.0 剛剛只對一半
  say('剛剛那個只對一半', '照它做會產生錯的解');
  await step(tok);                                   // 1350.0 把 w 放進 recurrence
  say('把第二個 parameter w 放進來', '重看 recurrence 的長相');
  await step(tok);                                   // 1359.0 前一頁：兩個 case
  c1 = tag('case 1：n 不在最佳解', 'ptr', 2.8, 5.6);
  tag('case 2：n 在最佳解', 'ptr', 2.8, 4.9);
  say('前一頁的版本：分兩個 case', 'n 不在 / n 在最佳解');
  await step(tok);                                   // 1398.0 沒考慮 w 的變化 → 修正
  say('basic idea 沒錯太多', '只是沒考慮 capacity w 的變化：要修正');
  await step(tok);                                   // 1412.0 case 1 需要修正嗎？
  hl(c1, true);
  say('case 1 需要修正嗎？', '');
  await step(tok);                                   // 1420.0 沒選 → 沒吃重量，直接承接
  say('第 n 個沒選，沒吃掉重量', '可以完完全全承接前 n − 1 個');
  await step(tok);                                   // 1437.0 OPT(n, w) = OPT(n−1, w)
  txt(c1, 'case 1：OPT(n, w) = OPT(n − 1, w)');
  say('容量還是原來的小寫 w', 'case 1：OPT(n − 1, w)');
  void grid;
}]);

// 24:21 完整 recurrence：邊界、wᵢ > w 跳過、max
FRAG.push(['dpjiang2-subset-recur', 'OPT(i, w) 的 recurrence：0／跳過／max', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const X = (w) => -3.4 + w * 0.95, Y = (i) => 1.0 + i * 0.85;
  let cd = null, cur = null, ar = [];
  const c2 = tag('case 2：OPT(n, w) = wₙ + OPT(n − 1, ？)', 'ptr alt', 0, 8.6);
  const clear = () => { ar.forEach(kill); ar = []; };
  await step(tok);                                   // 1461.0 case 2：第 n 個要放進來
  say('case 2：第 n 個 item 要放進來', '');
  await step(tok);                                   // 1469.0 會吃掉 capacity
  const bite = bad('吃掉容量 wₙ', 4.2, 7.8);
  say('它一放進來', '就會吃掉 capacity');
  await step(tok);                                   // 1476.0 修正第二個 parameter
  remove(bite);
  say('所以第二個 parameter（capacity）', '要做修正');
  await step(tok);                                   // 1490.0 wₙ 當然要貢獻
  say('第 n 個的 wₙ', '當然要貢獻');
  await step(tok);                                   // 1496.0 剩下由前 n−1 個貢獻
  say('剩下的一樣由前 n − 1 個貢獻', '');
  await step(tok);                                   // 1502.0 兜剩下的空間 W − wₙ
  txt(c2, 'case 2：OPT(n, w) = wₙ + OPT(n − 1, w − wₙ)');
  say('但它們要兜的是剩下的空間', 'w − wₙ：wₙ 被吃掉了');
  await step(tok);                                   // 1519.0 recurrence 差不多寫出來了
  say('recurrence 差不多寫出來了', '');
  await step(tok);                                   // 1526.0 對任何第 i 個都成立
  txt(c2, '對任何 i：OPT(i, w) …');
  say('不只第 n 個', '任何第 i 個的 OPT(i, w) 都能這樣擴充');
  await step(tok);                                   // 1544.0 真正的 recurrence 長相
  kill(c2);
  cd = code([
    'OPT(i,w) = 0                      if i = 0 or w = 0',
    '         = OPT(i-1, w)            if w_i > w',
    '         = max( OPT(i-1, w),',
    '                w_i + OPT(i-1, w - w_i) )   otherwise',
  ], 0, 8.4, 0.55);
  for (let i = 0; i <= 3; i++) for (let w = 0; w <= 7; w++) box('', C.paper, X(w), Y(i), 0.8, 0.62, 0.2, 0, -0.2);
  tag('i', 'idx', X(0) - 0.9, Y(3)); tag('w →', 'idx', X(7) + 0.9, Y(0));
  say('真正的 recurrence 長這樣', '左邊是 OPT(i, w)，右邊分三種情況');
  await step(tok);                                   // 1553.0 boundary：包包沒空間 w = 0
  cd.hl(0);
  for (let i = 0; i <= 3; i++) box(0, C.sand, X(0), Y(i), 0.66, 0.5, 0.35, 0.8);
  say('第一種是 boundary condition', '包包已經塞滿或根本沒包包：w = 0');
  await step(tok);                                   // 1576.0 → OPT = 0
  say('w = 0：不管有多少 item 都塞不進去', 'OPT(i, w) = 0');
  await step(tok);                                   // 1582.0 沒有 item：i = 0
  for (let w = 1; w <= 7; w++) box(0, C.sand, X(w), Y(0), 0.66, 0.5, 0.35, 0.8);
  say('另一個 boundary', '沒有任何 item：i = 0');
  await step(tok);                                   // 1596.0 i 或 w 為 0 → 0
  say('i 或 w 為 0', 'OPT(i, w) = 0');
  await step(tok);                                   // 1607.0 item 太大：wᵢ > w
  cd.hl(1);
  cur = ghostBox(C.gold, 0.95, 0.75, 0.6); cur.position.set(X(1), Y(2), 0);
  note('w₂ = 2 > w = 1', X(1) + 1.6, Y(2) + 0.7);
  say('第二種：i、w 都不是 0', '但這個 item 太大：wᵢ > w，塞不進去');
  await step(tok);                                   // 1626.0 skip → OPT(i−1, w)
  ar.push(link([X(1), Y(1), 0.3], [X(1), Y(2), 0.3], C.teal, 0.3));
  say('塞不進去就 skip 它', '承接前 i − 1 個：OPT(i − 1, w)');
  await step(tok);                                   // 1639.0 第三種：general case
  clear(); cur.position.set(X(6), Y(3), 0);
  cd.hl(2);
  say('第三種：一般的 general case', '第 i 個不會讓包包爆掉');
  await step(tok);                                   // 1653.0 case 1：不放 → OPT(i−1, w)
  ar.push(link([X(6), Y(2), 0.3], [X(6), Y(3), 0.3], C.teal, 0.3));
  say('case 1：第 i 個不放', '承接 OPT(i − 1, w)：正上方那格');
  await step(tok);                                   // 1672.0 case 2：放 → wᵢ + OPT(i−1, …)
  cd.hl(3);
  ar.push(link([X(1), Y(2), 0.3], [X(6), Y(3), 0.3], C.gold, 0.35));
  say('case 2：第 i 個放進去', 'wᵢ ＋ 前 i − 1 個的貢獻');
  await step(tok);                                   // 1693.0 要兜出 w − wᵢ 的容量
  tag('w − wᵢ', 'idx', X(1), Y(2) - 0.55);
  say('前 i − 1 個要兜的容量', '是 w − wᵢ（左上那格）');
  await step(tok);                                   // 1704.0 兩個 case 取大：max
  cd.hl(-1); glow(cur, GOLD);
  say('兩個 case 怎麼選？', '誰的 quality 好選誰：max');
}]);

// 30:43 Bottom-up 實作：開表 M[0..n][0..W]，第 1–4 行邊界，5–10 行填表
FRAG.push(['dpjiang2-subset-code', 'Bottom-up 實作：for loop 填表 M[i][w]', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.8, 0]);
  const M = ssTable(IW);
  const X = (w) => 0.8 + w * 0.8, Y = (i) => 6.8 - i * 0.8;
  let cd = null, cur = null; const cell = {};
  const fill = (i, w, c) => { cell[i + ',' + w] = box(M[i][w], c || C.teal, X(w), Y(i), 0.56, 0.48, 0.35, 0.8); };
  const rec = tag(' ', 'ptr', 0, 8.9);
  await step(tok);                                   // 1847.0 recurrence 寫上面當小抄
  txt(rec, 'OPT(i,w) = 0｜OPT(i−1,w)｜max(OPT(i−1,w), wᵢ + OPT(i−1,w−wᵢ))');
  say('recurrence 寫在上面當小抄', '');
  await step(tok);                                   // 1852.0 把它 implement 出來
  say('接下來就是把它 implement 出來', '');
  await step(tok);                                   // 1860.0 n 個 item、容量 W：要算 OPT(n, W)
  say('n 個 item、包包總重 W', '最終目的：算出 OPT(n, W)');
  await step(tok);                                   // 1892.8 bottom-up 形式
  pkt('bottom-up', -5.2, 8.3);
  say('第一招：bottom-up 形式', '');
  await step(tok);                                   // 1899.0 從小 subproblem 兜到大
  say('從比較小的 subproblem', '慢慢兜出比較大的');
  await step(tok);                                   // 1911.9 procedure：老實刻出 recurrence
  cd = code([
    ' 1 for w = 0 to W',
    ' 2     M[0][w] = 0',
    ' 3 for i = 0 to n',
    ' 4     M[i][0] = 0',
    ' 5 for i = 1 to n',
    ' 6   for w = 1 to W',
    ' 7     if w_i > w',
    ' 8       M[i][w] = M[i-1][w]',
    ' 9     else',
    '10       M[i][w] = max(M[i-1][w],',
    '              w_i + M[i-1][w-w_i])',
    '11 return M[n][W]',
  ], -3.6, 7.6, 0.52);
  say('procedure 很老實', '就是把 recurrence 刻出來');
  await step(tok);                                   // 1923.0 只要 for loop：填表格
  say('bottom-up iteration 形式', '只需要 for loop：就是填表格');
  await step(tok);                                   // 1934.2 開一個 table M
  for (let i = 0; i <= 5; i++) for (let w = 0; w <= 6; w++) box('', C.paper, X(w), Y(i), 0.68, 0.6, 0.2, 0, -0.2);
  tag('M', 'ptr', X(0) - 1.3, Y(0) + 0.8);
  say('心目中開一個 table', '叫 M');
  await step(tok);                                   // 1950.0 M 存 OPT 的值
  say('M 存的就是 OPT 的值', '');
  await step(tok);                                   // 1958.0 w 從 0 長到 W
  for (let w = 0; w <= 6; w++) tag(w === 6 ? '…W' : String(w), 'idx', X(w), Y(0) + 0.75);
  say('一個方向：小寫 w 從 0', '一直長到大 W（這裡只畫到 6）');
  await step(tok);                                   // 1977.0 item 從 0 到 n
  for (let i = 0; i <= 5; i++) tag(i === 5 ? 'n' : String(i), 'idx', X(0) - 0.7, Y(i));
  say('另一個方向：item', '前 0 個、前 1 個…一直到前 n 個');
  await step(tok);                                   // 2015.7 接下來填 table
  say('開好 table', '接下來就是填 table');
  await step(tok);                                   // 2023.0 第 1–2 行：i = 0 那一列
  cd.hl(1);
  for (let w = 0; w <= 6; w++) { fill(0, w, C.sand); await beat(tok, 120); }
  say('第 1、2 行：i = 0 那一列', '沒有 item → 全填 0');
  await step(tok);                                   // 2033.0 第 3–4 行：w = 0 那一欄
  cd.hl(3);
  for (let i = 1; i <= 5; i++) { fill(i, 0, C.sand); await beat(tok, 140); }
  say('第 3、4 行：w = 0 那一欄', '沒有空間 → 全填 0');
  await step(tok);                                   // 2041.0 5–10 行兜兩個 case
  cd.hl(4);
  cur = ghostBox(C.gold, 0.78, 0.72, 0.6); cur.position.set(X(1), Y(1), 0);
  say('第 5 到 10 行', '用來兜下面的兩個 case');
  await step(tok);                                   // 2063.0 先 check 有沒有超過 w
  cd.hl(6);
  fill(1, 1);
  say('先 check：item 有沒有超過現在的容量 w', '例：w₁ = 1 ≤ 1，放得下 → M[1][1] = 1');
  await step(tok);                                   // 2071.0 超過：直接承接前面的解
  cd.hl(7);
  for (let w = 2; w <= 6; w++) fill(1, w);
  cur.position.set(X(1), Y(2), 0);
  say('超過的話：直接承接 i − 1 的解', '它會讓包包破掉，不會貢獻');
  await step(tok);                                   // 2093.4 wᵢ > w：照抄上面（第 7–8 行）
  const a1 = link([X(1), Y(1), 0.3], [X(1), Y(2), 0.3], C.teal, 0.25);
  fill(2, 1);
  say('例：w₂ = 2 > w = 1', '第 7–8 行：照抄上面 M[1][1] = 1');
  await step(tok);                                   // 2100.0 沒超過：放或不放取 max
  kill(a1); cd.hl(9);
  fill(2, 2); cur.position.set(X(3), Y(2), 0);
  const a2 = link([X(3), Y(1), 0.3], [X(3), Y(2), 0.3], C.teal, 0.25), a3 = link([X(1), Y(1), 0.3], [X(3), Y(2), 0.3], C.gold, 0.3);
  fill(2, 3);
  say('沒超過：放或不放，比一下取 max', 'M[2][3] = max(M[1][3] = 1, 2 + M[1][1] = 3) = 3');
  await step(tok);                                   // 2118.8 第 10 行：做完
  kill(a2); kill(a3);
  for (let w = 4; w <= 6; w++) { fill(2, w); await beat(tok, 120); }
  for (let i = 3; i <= 5; i++) for (let w = 1; w <= 6; w++) { fill(i, w); await beat(tok, 50); }
  kill(cur); cd.hl(11);
  say('這是第 10 行', '一列一列由左往右，就做完了');
  await step(tok);                                   // 2124.0 忠實刻下 recurrence
  cd.hl(-1);
  say('procedure 就是很忠實地把 recurrence 刻下來', '沒有特殊技巧');
  await step(tok);                                   // 2136.0 bottom-up：查的前面 solution 要 ready
  glow(cell['3,4'], GOLD); glow(cell['2,4'], GREEN);
  say('要注意：bottom-up 填每格時', '它參照的前面 solution 一定要 ready');
  await step(tok);                                   // 2153.0 從小到大填 → 一定查得到
  glow(cell['3,4'], null); glow(cell['2,4'], null);
  good('從小到大填 → 查的值都已經 ready', 3.0, 1.6);
  say('剛才都是從小到大填', '保證查的值在那一刻都查得到');
  await step(tok);                                   // 2163.0 舉個例子：W = 11
  pkt('例子：W = 11、重量 1 2 5 6 7', 3.0, 0.8);
  say('接下來舉例：一開始那個 case', '大寫 W = 11');
}]);

// 36:16 例子：W = 11，物品 1 2 5 6 7 → 填表，M[5][11] = 11，倒推 5 + 6
FRAG.push(['dpjiang2-subset-table', '填表：W = 11、重量 1 2 5 6 7 → 11', async (tok) => {
  fresh([0, 4.2, 15], [0, 3.8, 0]);
  const M = ssTable(IW);
  const X = (w) => -5.0 + w * 0.95, Y = (i) => 7.3 - i * 0.95;
  const rl = ['{ }', '{1}', '{1,2}', '{1,2,5}', '{…,6}', '{…,7}'];
  const cell = [[], [], [], [], [], []];
  const me = pal('', -6.6, C.orange, 1.8);
  const fl = (i, w) => { cell[i][w] = box(M[i][w], i === 0 || w === 0 ? C.sand : C.teal, X(w), Y(i), 0.7, 0.55, 0.4, 0.8); };
  const f = tag(' ', 'ptr alt', 0.6, 0.6);
  await step(tok);                                   // 2176.0 W = 11 → 5 + 6
  say('capacity 11：答案是 5 + 6', '用剛才的 procedure 跑一次');
  await step(tok);                                   // 2184.0 開出 table
  for (let i = 0; i <= 5; i++) for (let w = 0; w <= 11; w++) box('', C.paper, X(w), Y(i), 0.82, 0.7, 0.2, 0, -0.2);
  say('第一件事：開出這樣一個 table', '');
  await step(tok);                                   // 2192.5 w 從 0 到 W：W + 1 個欄位
  for (let w = 0; w <= 11; w++) tag(String(w), 'idx', X(w), 8.1);
  say('w 從 0 變化到 W', '一共 W + 1 = 12 個欄位');
  await step(tok);                                   // 2205.0 item：不放、前 1、前 2…前 5
  for (let i = 0; i <= 5; i++) tag(rl[i], 'idx', X(0) - 1.2, Y(i));
  say('item：什麼都不放，再來前 1 個、前 2 個', '一直到全部 5 個');
  await step(tok);                                   // 2220.0 第 1–2 行、第 3–4 行：邊界
  for (let w = 0; w <= 11; w++) fl(0, w);
  for (let i = 1; i <= 5; i++) fl(i, 0);
  say('第 1、2 行把第一列填完', '第 3、4 行填第一欄：全是 0');
  await step(tok);                                   // 2231.0 5–10 行：填剩下的
  for (let i = 1; i <= 5; i++) { for (let w = 1; w <= 11; w++) fl(i, w); await beat(tok, 420); }
  say('5 到 10 行把剩下的填完', '一列一列：加入重量 1、2、5、6、7');
  await step(tok);                                   // 2247.0 highlight 最後一格
  glow(cell[5][11], GOLD);
  say('highlight 最後一格', '');
  await step(tok);                                   // 2257.0 所有 item、容量 W 的最佳解
  say('考慮所有 item、容量 W 之下的最佳解', '把這格 report 回去就行');
  await step(tok);                                   // 2268.3 = 11，來自 5 + 6；為什麼？
  txt(f, 'M[5][11] = 11');
  say('就是 11，來自 5 + 6', '來看為什麼');
  await step(tok);                                   // 2284.0 最後一格怎麼填的？
  say('最後一格是怎麼填的？', '');
  await step(tok);                                   // 2288.0 第 5 個 item 重 7，W = 11
  note('item 5：w = 7', X(11) + 0.2, Y(5) - 0.7);
  say('考慮第 5 個 item：重量 7', '容量 W = 11');
  await step(tok);                                   // 2308.0 case 1：自己不放
  say('比較兩個 case', 'case 1：自己（7）不放進去');
  await step(tok);                                   // 2316.0 看前 4 個 → 往上查
  const a1 = link([X(11), Y(4), 0.3], [X(11), Y(5), 0.3], C.teal, 0.25);
  glow(cell[4][11], GOLD);
  say('看前 4 個 item 能兜出什麼', '往上查正上方的格子');
  await step(tok);                                   // 2333.0 = 11
  txt(f, 'case 1：M[4][11] = 11');
  say('前 4 個塞容量 11 的包包', '最佳解是 11');
  await step(tok);                                   // 2342.0 case 2：7 放進去
  say('case 2：7 這個 item 要放進包包', '');
  await step(tok);                                   // 2349.0 剩下由前 4 個兜
  say('剩下由前 4 個來兜', '');
  await step(tok);                                   // 2357.0 11 − 7 = 4 → 查第 4 欄
  const a2 = link([X(4), Y(4), 0.3], [X(11), Y(5), 0.3], C.gold, 0.3);
  glow(cell[4][4], GOLD);
  say('剩下 capacity：11 − 7 = 4', '查第 4 欄');
  await step(tok);                                   // 2367.6 前 4 個兜容量 4 → 3
  txt(f, 'case 2：7 + M[4][4] = 7 + 3');
  say('前 4 個兜容量 4', '最多只能兜到 3');
  await step(tok);                                   // 2375.0 3 + 7 = 10
  txt(f, 'case 2：7 + 3 = 10');
  say('3 配上我的 7', '這個 case 貢獻 10');
  await step(tok);                                   // 2383.0 和 11 比：取 11
  kill(a2); glow(cell[4][4], null);
  txt(f, 'max(11, 10) = 11：承接上面');
  me.mood('happy');
  say('和直接承接的 11 比', '當然 take 11');
  await step(tok);                                   // 2401.0 可以繼續倒推
  kill(a1);
  say('還可以繼續倒推', '這個 11 又來自哪裡？');
  await step(tok);                                   // 2408.0 一定來自第 3、4 個 item：5 + 6
  for (const [i, w] of [[4, 11], [3, 5], [2, 0]]) { glow(cell[i][w], GREEN); await beat(tok, 400); }
  glow(cell[3][11], RED);
  txt(f, 'M[4][11] ≠ M[3][11] → 放 6；M[3][5] ≠ M[2][5] → 放 5');
  say('一步步倒推', '一定來自第 3、4 個 item：5 + 6');
  await step(tok);                                   // 2421.0 往回推就找到最佳解的組成
  await me.hop(tok);
  say('一步一步往回推', '就找到最佳解是哪些 item 貢獻的');
}]);

// 40:33 O(nW)：pseudo-polynomial；n = 10、W = 10⁷
FRAG.push(['dpjiang2-pseudo', 'O(nW) 是 pseudo-polynomial：W 不是 input size', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const g = ghostBox(C.teal, 3.0, 1.8, 0.6); g.position.set(-3.2, 6.0, 0);
  const lb = tag('(n+1) × (W+1) 格', 'ptr', -3.2, 7.4);
  const t2 = tag(' ', 'ptr alt', 3.2, 6.0);
  const me = pal('', -6.4, C.orange);
  let big = null;
  await step(tok);                                   // 2433.0 填表動作都很簡單
  say('跑完要花多少時間？', '填表動作都簡單：assign 0、照抄、比大小');
  await step(tok);                                   // 2448.0 每個 operation 都 constant time
  note('每格 O(1)', -3.2, 4.6);
  say('每個 operation', '都是 constant time');
  await step(tok);                                   // 2455.0 重點：填了幾格 (n+1)(W+1)
  glow(g, GOLD);
  say('重點是填了多少格子', '(n + 1) × (W + 1)');
  await step(tok);                                   // 2463.0 running time O(nW)
  glow(g, null);
  txt(t2, 'running time：O(nW)');
  say('running time bound 在', 'O(n × W)');
  await step(tok);                                   // 2471.0 這樣好不好？
  me.mood('wow');
  say('這樣的 complexity 好不好？', '這個概念很重要');
  await step(tok);                                   // 2486.3 看起來像多項式？
  txt(t2, 'O(nW)：看起來像多項式？');
  say('看起來像一個多項式', '');
  await step(tok);                                   // 2496.0 並非 polynomial time
  bad('不是 polynomial time！', 3.2, 5.2);
  say('但它並非 polynomial time', '');
  await step(tok);                                   // 2503.0 否則不會說它很難
  say('如果真的是 polynomial time', '就不會說這個問題很難了');
  await step(tok);                                   // 2511.0 pseudo-polynomial：假的
  txt(t2, 'pseudo-polynomial（pseudo = 假的）');
  say('我們叫它 pseudo-polynomial time', 'pseudo 是「假的」');
  await step(tok);                                   // 2518.0 含 W，W 不是 input size
  note('W 不是 input size', 3.2, 4.4);
  say('因為 running time 含有 W', '而 W 不是 input size');
  await step(tok);                                   // 2526.0 input size 是 n
  note('input size 是 n（item 數）', 3.2, 3.7);
  say('W 只是 input 的一個參數（引數）', 'input size 是 n 個 item');
  await step(tok);                                   // 2558.0 所以叫 pseudo；21 個 NPC 之一
  say('所以叫 pseudo-polynomial', 'Subset Sum 是 21 個 NP-complete 之一');
  await step(tok);                                   // 2574.0 沒人找到真的 polynomial 演算法
  say('到目前沒有人找到', '真正 polynomial time 的 Subset Sum 演算法');
  await step(tok);                                   // 2585.0 卡在 W：n 小 W 很大
  say('卡在 W 身上', '如果 n 很小、W 非常大');
  await step(tok);                                   // 2592.0 n = 10，W = 1000 萬
  txt(lb, 'n = 10，W = 10⁷');
  await anim(tok, 1600, (k) => { g.scale.set(1 + k * 3.4, 0.6 + 0.4 * (1 - k), 1); g.position.x = -3.2 + k * 3.2; });
  say('例：只有 10 個 item', '但 W 有 1000 萬：table 有多大？');
  await step(tok);                                   // 2599.4 要開 10⁷ + 1 個 column
  big = tag('10⁷ + 1 個 column', 'ptr', 0, 4.9);
  me.mood('sad');
  say('要建 1000 萬多個 column', 'running time 很恐怖，卻只有 10 個 item');
  await step(tok);                                   // 2610.2 不算快的演算法
  say('從這個觀點看', '不會認為它是很快的演算法');
  await step(tok);                                   // 2617.3 要填到最後一格才有答案
  const cur = pkt('→ 最後一格', -1.0, 6.0);
  await travel(tok, cur, V3(-1.0, 6.0, 0), V3(4.6, 6.0, 0), 1400);
  say('table 一定要老老實實填到最後一格', '才知道答案');
  await step(tok);                                   // 2624.0 W 很大時不好
  say('所以 W 很大時', '這個 running time 不好');
  await step(tok);                                   // 2631.0 書上推薦 DP，但 W 大時效果不好
  me.mood('calm');
  good('一般推薦 DP；但 W 很大時效果不好', 0, 1.2);
  say('書上一般都推薦用 DP 解 Subset Sum', '但要知道：W 很大時效果並不好');
  void big;
}]);

// 44:22 Knapsack：小偷、vᵢ；greedy 先偷最值錢 → 35，最佳 18 + 22 = 40
FRAG.push(['dpjiang2-knap-greedy', 'Knapsack：先偷最值錢只得 35，最佳 40', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const xs = [-3.2, -1.6, 0, 1.6, 3.2], u = 0.4;
  const thief = pal('小偷', -6.4, '#7d7466');
  const it = [], wl = [];
  let B1 = null, B2 = null, f = null;
  await step(tok);                                   // 2662.0 小偷晚上去行竊
  tag('Knapsack（背包問題）', 'ptr alt', 0, 8.6);
  thief.mood('happy');
  say('Knapsack：有人叫它小偷問題', '小偷晚上要去行竊');
  await step(tok);                                   // 2671.0 包包有容量限制 W，到商店
  B1 = bag(-3.2, 0.3, 11, u, 'W');
  say('他背一個包包，容量限制 W', '到一家商店');
  await step(tok);                                   // 2681.0 商店有 n 個 item
  IW.forEach((w, k) => it.push(box(' ', ICOL[k], xs[k], 7.5, 1.2, 0.6, 0.6, 1.2)));
  say('商店裡有 n 個 item', '');
  await step(tok);                                   // 2689.0 每個有重量 wᵢ（像 Subset Sum）
  IW.forEach((w, k) => wl.push(tag(w + ' kg', 'idx', xs[k], 6.9)));
  say('每個 item 有重量 wᵢ', '這跟 Subset Sum 很像');
  await step(tok);                                   // 2697.0 另外還有價值 vᵢ
  it.forEach((m, k) => relabel(m, '$' + IV[k]));
  say('但多了一件事：value', '每個 item 有價值 vᵢ');
  await step(tok);                                   // 2705.0 把東西裝進包包
  say('小偷要把東西裝進包包', '');
  await step(tok);                                   // 2711.0 不能破；越值錢越好
  say('前提：包包不能破', '目標：越值錢越好');
  await step(tok);                                   // 2719.0 目標跟 Subset Sum 不一樣
  say('目標跟 Subset Sum 有點不一樣', '');
  await step(tok);                                   // 2744.0 max Σ wᵢ → max Σ vᵢ
  f = tag('max Σ wᵢ', 'ptr', 3.2, 4.6);
  await beat(tok, 600);
  txt(f, 'max Σ vᵢ（重量不是重點）');
  say('從 maximize Σ wᵢ', '變成 maximize Σ vᵢ');
  await step(tok);                                   // 2765.0 只有 objective 不同，constraint 一樣
  note('constraint 一模一樣：Σ wᵢ ≤ W', 3.2, 3.8);
  say('formulation 只差 objective function', 'constraint 一模一樣');
  await step(tok);                                   // 2782.0 選出 X，總重不能破
  say('選出一些 item（集合 X）', '總重量不能讓包包破');
  await step(tok);                                   // 2791.0 maximize Σ vᵢ
  hl(f, true);
  say('目標：偷出來的總價值越高越好', 'maximize Σ vᵢ');
  await step(tok);                                   // 2811.0 greedy 也不能求最佳解
  hl(f, false);
  say('這個問題用 greedy', '一樣不能求得最佳解');
  await step(tok);                                   // 2815.0 剛才的例子加上 value
  say('用剛才的例子', '每個 item 加上 value');
  await step(tok);                                   // 2823.0 重量一樣，W = 11
  txt(B1.l, 'W = 11');
  say('重量和剛才一樣', '包包一樣是 capacity 11');
  await step(tok);                                   // 2829.0 偷最有價值的優先
  txt(B1.l, 'greedy：最值錢先');
  say('greedy 想法：最有價值的優先', '先把它偷走');
  await step(tok);                                   // 2849.0 Largest vᵢ 先偷
  glow(it[4], GOLD);
  say('先偷 largest vᵢ', '最有價值的東西');
  await step(tok);                                   // 2856.0 最有價值是 28
  glow(it[4], null); fly(it[4], V3(0, 4, 2)); put(B1, 7, ICOL[4], '$28');
  say('最有價值的是 $28', '先偷它');
  await step(tok);                                   // 2862.0 它重 7 → 剩 4
  note('剩 4 kg', -1.4, 3.6);
  say('它重 7', '只剩 4 個單位的空間');
  await step(tok);                                   // 2872.0 剩 4：只剩 6 和 1 塞得下
  fly(it[1], V3(0, 4, 2)); put(B1, 2, ICOL[1], '$6');
  await beat(tok, 500);
  fly(it[0], V3(0, 4, 2)); put(B1, 1, ICOL[0], '$1');
  say('依此類推：剩 4 kg 能偷什麼', '只剩 value 6 和 1 塞得進去');
  await step(tok);                                   // 2888.0 總價 35；最佳是 18 + 22
  txt(B1.l, '28 + 6 + 1 = 35'); B1.items.forEach((m) => glow(m, RED));
  B2 = bag(3.6, 0.3, 11, u, '最佳解');
  put(B2, 5, ICOL[2], '$18'); await beat(tok, 500); put(B2, 6, ICOL[3], '$22');
  say('greedy 總價值 35', '真正的最佳解是 18 + 22');
  await step(tok);                                   // 2897.0 = 40；greedy 不保證最佳
  txt(B2.l, '18 + 22 = 40'); B2.items.forEach((m) => glow(m, GREEN));
  thief.mood('wow'); await thief.hop(tok);
  say('最佳是 40', '不是從最值錢的開始偷：重量也會帶來難度');
  await step(tok);                                   // 2919.7 本質跟 Subset Sum 類似
  thief.mood('calm');
  say('本質上跟 Subset Sum 還是很類似', '只是 objective function 不同');
}]);

// 48:46 Knapsack 的 recurrence：只把 wᵢ 改成 vᵢ
FRAG.push(['dpjiang2-knap-recur', 'Knapsack recurrence：把 wᵢ 改成 vᵢ 就好', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const me = pal('', -6.4, C.orange);
  let cd = null, hd = null, hi = null;
  await step(tok);                                   // 2926.0 Subset Sum 的 recurrence
  hd = tag('Subset Sum', 'ptr', -4.6, 8.4);
  cd = code([
    'OPT(i,w) = 0                      if i = 0 or w = 0',
    '         = OPT(i-1, w)            if w_i > w',
    '         = max( OPT(i-1, w),',
    '                w_i + OPT(i-1, w - w_i) )',
  ], 0, 7.6, 0.6);
  say('上面是 Subset Sum 的 recurrence', '');
  await step(tok);                                   // 2933.0 第一行 boundary
  cd.hl(0);
  say('第一行是 boundary condition', '');
  await step(tok);                                   // 2937.0 第二行：item 太大不考慮
  cd.hl(1);
  say('第二行：第 i 個太大會讓包包破', '不考慮它');
  await step(tok);                                   // 2943.0 第三行：正常 case
  cd.hl(2);
  say('第三行：正常的 case', '考慮前 i 個、容量 w');
  await step(tok);                                   // 2962.2 case 1：不放 → OPT(i−1, w)
  say('case 1：第 i 個不放', '承接 OPT(i − 1, w)');
  await step(tok);                                   // 2971.0 case 2：wᵢ + OPT(i−1, w − wᵢ)
  cd.hl(3);
  say('case 2：第 i 個放進來', 'wᵢ ＋ OPT(i − 1, w − wᵢ)');
  await step(tok);                                   // 2988.0 Knapsack：有 value，maximize 總價值
  txt(hd, 'Knapsack？');
  cd.hl(-1);
  say('這是 Subset Sum，不是 Knapsack', 'Knapsack 有 value：maximize 總價值');
  await step(tok);                                   // 3003.0 前兩行 boundary 沒差
  cd.hl(0);
  say('前兩個 boundary 沒有太大差異', '沒東西偷、沒帶包包 → 0');
  await step(tok);                                   // 3023.0 太重塞不下：一樣承接
  cd.hl(1);
  say('第 i 個太重塞不下', '一樣直接承接前 i − 1 個');
  await step(tok);                                   // 3029.0 general case 怎麼辦？
  cd.hl(2);
  say('問題在一般的 general case', '');
  await step(tok);                                   // 3054.0 最後一行怎麼改？
  me.mood('wow');
  bub('要改哪裡？', -6.0, 2.2, 1.6);
  say('目標是總價值，不是總重量', '最後一行要怎麼改？');
  await step(tok);                                   // 3067.0 OPT(i, w)：定義成價值最高
  note('OPT(i, w)：前 i 個、容量 w、價值最高', 2.6, 4.4);
  say('一樣定義 OPT(i, w)', '只是現在是「價值最高」的意思');
  await step(tok);                                   // 3094.0 只要改一個地方
  say('只需要改一個地方', '');
  await step(tok);                                   // 3116.5 一樣兩個 case：放或不放
  say('一樣分兩種 case', '第 i 個放或不放');
  await step(tok);                                   // 3124.6 不放：前面照抄
  cd.hl(2);
  say('不放：前面這個 term 照抄', '意思變成前 i − 1 個的最高總價值');
  await step(tok);                                   // 3163.0 放進包包：總價值是什麼？
  cd.hl(3);
  hi = tag('w_i →', 'ptr alt', -4.4, 7.6 - 3 * 0.6);
  say('放進包包：總價值會是什麼？', '');
  await step(tok);                                   // 3172.0 wᵢ 改成 vᵢ
  txt(cd.ls[3], cd.ls[3].element.textContent.replace('w_i +', 'v_i +'));
  txt(hi, 'v_i ✓'); txt(hd, 'Knapsack');
  me.mood('happy'); await me.hop(tok);
  say('把 wᵢ 改成 vᵢ 就行', '其他都不動（容量仍扣 w − wᵢ）');
  await step(tok);                                   // 3185.0 這就是 Knapsack 的 recurrence
  cd.hl(-1);
  box('M[5][11] = 40', C.teal, 0, 3.0, 3.2, 0.7, 0.6, 1.4);
  say('這就是 Knapsack 的 recurrence', '補充：代回例子 max(M[4][11] = 40, 28 + M[4][4] = 35) = 40');
}]);

// 53:26 0/1 knapsack vs fractional knapsack；O(nW) 仍是 pseudo-polynomial
FRAG.push(['dpjiang2-knap-frac', '0/1 Knapsack vs Fractional Knapsack', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  let a = null, b = null, br = null, half = null;
  const thief = pal('小偷', -6.4, '#7d7466');
  await step(tok);                                   // 3206.0 只能放或不放：0/1
  tag('0/1 knapsack', 'ptr', -3.4, 7.8);
  a = box('$18', ICOL[2], -4.4, 6.0, 1.3, 1.0, 0.8, 1.2); b = box('$22', ICOL[3], -2.4, 6.0, 1.3, 1.0, 0.8, 1.2);
  say('這個版本叫 0/1 knapsack', 'item 只能放或不放：yes / no，0 和 1');
  await step(tok);                                   // 3221.0 另一種形式
  tag('fractional knapsack', 'ptr', 3.4, 7.8);
  move(a, -3.4, 2.4, 0); fly(b);
  tag('全拿 ✓ / 不拿 ✓ / 拿一半 ✗', 'idx', -3.4, 1.4);
  say('有 0/1，就有另一種形式', '');
  await step(tok);                                   // 3229.0 可以偷一部分：麵包撥一半
  br = box('麵包', C.sand, 3.4, 6.0, 1.6, 1.0, 0.8, 1.2);
  await beat(tok, 600);
  br.scale.set(0.5, 1, 1); br.position.x = 2.95;
  half = box('½', C.sand, 3.85, 6.0, 0.8, 1.0, 0.8, 0);
  move(half, 3.4, 2.4, 0);
  thief.mood('happy');
  say('item 可以偷一部分', '麵包剝一半、米不用整包、金塊分開');
  await step(tok);                                   // 3250.0 partial → fractional
  tag('可以拿比例', 'idx', 3.4, 1.4);
  say('每個 item 可以拿部分', '叫 fractional knapsack');
  await step(tok);                                   // 3269.0 0/1：DP 求最佳解
  tag('DP：最佳解', 'ptr alt', -3.4, 4.4);
  say('0/1 knapsack', '用 DP 可以求得最佳解');
  await step(tok);                                   // 3279.0 fractional：學過的沒幾招 → greedy
  tag('？學過的沒幾招', 'ptr alt', 3.4, 4.4);
  say('fractional 要用什麼求最佳解？', '學過的沒幾招，試一下就知道（補充：greedy 依 vᵢ / wᵢ 拿）');
  await step(tok);                                   // 3298.0 recurrence 只改 value
  thief.mood('calm');
  say('Knapsack 的 recurrence', '跟 Subset Sum 只差 value 那一處');
  await step(tok);                                   // 3309.0 procedure 照抄，wᵢ 改 vᵢ
  note('procedure 照抄：wᵢ → vᵢ', 0, 0.6);
  say('procedure 也照抄', '把 wᵢ 改成 vᵢ 就行');
  await step(tok);                                   // 3323.4 complexity O(nW)
  const cx = tag('O(nW)', 'ptr', 0, 9.0);
  say('complexity bound 在 table 大小', 'O(n × W)');
  await step(tok);                                   // 3334.0 pseudo-polynomial；包包大效果不好
  txt(cx, 'O(nW)：pseudo-polynomial');
  say('一樣是 pseudo-polynomial', '包包很大時效果不好');
  await step(tok);                                   // 3356.0 小變異 → bin packing
  pkt('小變異 → bin packing', 0, -0.2);
  say('Subset Sum / Knapsack 再一點變異', '可以延伸出別的難題：bin packing');
}]);

// 56:09 Bin packing：卡車越少越好，NP-complete
FRAG.push(['dpjiang2-binpack', 'Bin packing：用最少的卡車裝完', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const sz = [0.9, 1.6, 0.7, 1.2, 1.0, 0.5, 1.4, 0.8];
  let it = [], T = [];
  await step(tok);                                   // 3369.0 n 個 item；像物流公司
  it = sz.map((h, k) => box('', [C.teal, C.blue, C.purple, C.orange, C.pink, C.sand, C.red, C.gold][k], -5.6 + k * 1.6, 7.2, 1.0, h * 0.6, 0.8, 1.2));
  say('一樣有 n 個 item', '但不只一個包包：像物流（宅配）公司');
  await step(tok);                                   // 3383.0 包裹到公司，安排卡車
  T = [-4, 0, 4].map((x, k) => { const g = ghostBox(C.brown, 2.2, 3.0, 1.4); g.position.set(x, 2.1, 0); tag('卡車 ' + (k + 1), 'ptr', x, 4.1); return { x, used: 0 }; });
  say('客戶的包裹送到公司', '要安排卡車去運送');
  await step(tok);                                   // 3393.0 卡車越少越好
  say('當然希望', '用越少卡車越好');
  await step(tok);                                   // 3399.0 每個 item 體積不同
  it.forEach((m) => glow(m, GOLD));
  say('bin packing：n 個 item', '每個體積不一樣');
  await step(tok);                                   // 3411.0 每輛卡車容量固定
  it.forEach((m) => glow(m, null));
  note('每輛卡車容量相同', 0, 5.0);
  say('知道每輛卡車', '總共可以裝多少');
  await step(tok);                                   // 3420.0 把物品 assign 給卡車
  const plan = [0, 0, 1, 0, 1, 2, 1, 2];
  for (let k = 0; k < sz.length; k++) { const t = T[plan[k]], h = sz[k] * 0.6; move(it[k], t.x, 0.65 + t.used + h / 2, 0); t.used += h; await beat(tok, 250); }
  say('把物品適當 assign 給卡車', '不能超過容量');
  await step(tok);                                   // 3429.0 卡車數越少越好
  good('目標：minimize 卡車數', 0, 8.6);
  say('目標：用的卡車數越少越好', '');
  await step(tok);                                   // 3435.9 NP-complete
  bad('NP-complete', 0, 6.2);
  say('難度一樣是 NP-complete', '');
}]);

// 57:31 Bellman-Ford 由來；shortest path 定義；Dijkstra 遇到負邊會錯
FRAG.push(['dpjiang2-dijkstra-neg', 'Dijkstra 遇到 −6：回報 1，正解 −1', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const P = { s: [-4.6, 3.0], a: [-1.6, 6.6], b: [1.6, 6.6], t: [4.6, 3.0] };
  const N = {}, E = {}, d = {};
  const ed = [['s', 't', 1], ['s', 'a', 2], ['a', 'b', 3], ['b', 't', -6]];
  const off = { st: [0, -0.4], sa: [-0.4, 0.3], ab: [0, 0.4], bt: [0.45, 0.3] };
  const hd = tag(' ', 'ptr alt', 0, 8.6);
  const dj = pal('Dijkstra', -6.4, C.blue);
  await step(tok);                                   // 3451.0 Bellman：DP 的發明人
  txt(hd, 'Bellman-Ford');
  say('第二階段：Bellman-Ford', 'Bellman 就是 DP 的發明人 Richard Bellman');
  await step(tok);                                   // 3461.6 和 Ford 合作
  say('跟他合作的是 Ford', '那個年代有幾位很有名的演算法學者');
  await step(tok);                                   // 3488.0 Ford：下一單元 Ford-Fulkerson
  note('Ford → 下單元 network flow：Ford-Fulkerson', 3.6, 7.8);
  say('Ford 在下一單元 network flow 會再出現', 'Ford-Fulkerson');
  await step(tok);                                   // 3511.1 回顧 Dijkstra
  say('講 shortest path', '不得不回顧 Dijkstra');
  await step(tok);                                   // 3516.0 shortest path 問題
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 't' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.5, 1.2);
  for (const [u, v] of ed) E[u + v] = link([...P[u], 0], [...P[v], 0], C.brown, 0.5);
  say('shortest path 問題：給一個 directed graph', 'G = (V, E)');
  await step(tok);                                   // 3528.0 source s、destination t
  glow(N.s, GOLD); glow(N.t, GOLD);
  say('給起點 source s', '和終點 destination t');
  await step(tok);                                   // 3535.9 每條 edge 有 weight c_uv
  glow(N.s, null); glow(N.t, null);
  for (const [u, v, w] of ed) tag(String(w), 'idx', (P[u][0] + P[v][0]) / 2 + off[u + v][0], (P[u][1] + P[v][1]) / 2 + off[u + v][1]);
  say('每條 edge 上有一個 weight', 'edge (u, v) 的 cost 是 c_uv');
  await step(tok);                                   // 3554.1 找 s 到 t 的最短路徑
  say('請你找一條', '從 s 到 t 的最短路徑');
  await step(tok);                                   // 3563.0 path 長度 = Σ c_uv
  tag('path 長度 = Σ c_uv', 'ptr', 0, 1.2);
  say('路徑長度', '= 經過的 edge cost 總和 Σ c_uv');
  await step(tok);                                   // 3582.0 左下：Dijkstra
  dj.mood('happy');
  say('左下是 Dijkstra 的演算法', '');
  await step(tok);                                   // 3590.2 Dijkstra 有限制
  say('Dijkstra 有限制', '什麼時候可以 run？');
  await step(tok);                                   // 3598.0 c_uv 一定要 ≥ 0
  note('限制：c_uv ≥ 0', -5.6, 2.4, 1.6);
  say('最大的限制：edge weight', 'c_uv 一定要 non-negative（≥ 0）');
  await step(tok);                                   // 3605.0 < 0 會錯：舉例
  say('出現小於 0 會怎樣？', '會錯，舉個例子');
  await step(tok);                                   // 3624.0 小 graph 有 −6
  glow(N.b, RED); glow(N.t, RED);
  say('這個小 directed graph', '有一個 edge weight 是 −6');
  await step(tok);                                   // 3639.0 最短：s-a-b-t = −1
  glow(N.b, null); glow(N.t, null);
  ['sa', 'ab', 'bt'].forEach((k) => paint(E[k], C.teal));
  tag('s→a→b→t = 2 + 3 − 6 = −1', 'ptr alt', 0, 0.4);
  say('直接算：最短是 s→a→b→t', '加起來 −1：正確答案');
  await step(tok);                                   // 3658.3 run Dijkstra：從 s 出發 0
  ['sa', 'ab', 'bt'].forEach((k) => paint(E[k], C.brown));
  glow(N.s, GOLD); d.s = tag('0', 'pkt', P.s[0], P.s[1] + 0.8);
  say('run Dijkstra：從 source 出發', '自己到自己距離 0');
  await step(tok);                                   // 3663.0 往外看：t 是 1
  d.t = tag('1', 'pkt', P.t[0], P.t[1] + 0.8);
  say('往外看能 reach 到誰', 't：距離 1');
  await step(tok);                                   // 3671.0 a 是 2；取小的 → t = 1
  d.a = tag('2', 'pkt', P.a[0], P.a[1] + 0.8);
  glow(N.t, GREEN); paint(E.st, C.red);
  say('a：距離 2；take 比較小的', '說 s 到 t 最短是 1');
  await step(tok);                                   // 3681.0 run 完 report：1
  say('依此類推做完', 'report：s 到 t 最短距離 1，直接走這條 edge');
  await step(tok);                                   // 3691.1 對嗎？不對
  glow(N.t, RED); dj.mood('sad');
  bad('Dijkstra：1 ✗（正解 −1）', 3.6, 1.4);
  say('答案對嗎？不對', '正確答案是上面那一條');
  await step(tok);                                   // 3709.0 有 negative weight 就不適用
  say('出現 negative weight 時', 'Dijkstra 不適用，的確會出錯');
  await step(tok);                                   // 3717.7 有沒有機會修正？
  dj.mood('calm');
  say('有沒有機會修正它', '讓它可以使用？');
  await step(tok);                                   // 3735.0 Dijkstra 的原理是 greedy
  say('觀察：為什麼會壞掉？', 'Dijkstra 的原理是 greedy algorithm');
  await step(tok);                                   // 3743.0 判定後就不回頭
  note('定案 → done，不再 revisit', P.t[0], P.t[1] - 0.9);
  say('一判定某點的最短距離', '就認為 done，不再回頭');
  await step(tok);                                   // 3757.0 第一次 s 走到 t 就認為最短
  say('剛才第一次從 s 走到 t', '就認為找到最短距離');
  await step(tok);                                   // 3764.0 前面長、後面很短的 path
  ['sa', 'ab', 'bt'].forEach((k) => paint(E[k], C.teal));
  say('沒想過有些 path 前面走得很長', '後面卻很短（大轉彎）');
  await step(tok);                                   // 3781.0 一開始就假設 non-negative
  say('Dijkstra 一開始就事先假設', 'cost 都是 non-negative，才能這麼大方地 guarantee');
  await step(tok);                                   // 3796.0 negative weight 怎麼辦：第一個 idea
  dj.mood('wow');
  say('那有 negative weight 怎麼辦？', '第一個 idea…');
}]);

// 63:24 Naive reweighting：每條邊 +6 → Dijkstra 仍選 s→t；邊數不同、加的量不同
FRAG.push(['dpjiang2-reweight', '每條邊都 +6？邊數不同，加的量不同', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const P = { s: [-4.6, 3.0], a: [-1.6, 6.6], b: [1.6, 6.6], t: [4.6, 3.0] };
  const N = {}, E = {}, L = {};
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 't' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.5);
  const ed = [['s', 't', 1, 0, -0.4], ['s', 'a', 2, -0.4, 0.3], ['a', 'b', 3, 0, 0.4], ['b', 't', -6, 0.45, 0.3]];
  for (const [u, v, w, ox, oy] of ed) { E[u + v] = link([...P[u], 0], [...P[v], 0], C.brown, 0.5); L[u + v] = tag(String(w), 'idx', (P[u][0] + P[v][0]) / 2 + ox, (P[u][1] + P[v][1]) / 2 + oy); }
  const me = pal('', -6.4, C.orange);
  let p1 = null, p2 = null;
  await step(tok);                                   // 3804.0 修正成非負
  say('既然 edge weight 不能是負的', '那就把它修正成非負');
  await step(tok);                                   // 3817.7 naive 的想法
  me.mood('happy');
  say('也許就能用 Dijkstra', '來試一個 naive 的想法');
  await step(tok);                                   // 3825.0 最負的是 −6
  glow(N.b, GOLD); L.bt.element.className = 'lab-label bad';
  say('最負的 edge 是 −6', '把它往上提升');
  await step(tok);                                   // 3834.0 全部 +6 → non-negative
  glow(N.b, null);
  for (const [u, v, w] of ed) { txt(L[u + v], String(w + 6)); L[u + v].element.className = 'lab-label ptr alt'; await beat(tok, 250); }
  say('全部往上 shift：每條 +6', '1→7、2→8、3→9、−6→0：都 ≥ 0');
  await step(tok);                                   // 3849.0 non-negative：apply Dijkstra
  say('已經是 non-negative', '可以 apply Dijkstra');
  await step(tok);                                   // 3855.0 還是找到 s→t
  paint(E.st, C.red); glow(N.t, RED);
  p1 = tag('s→t：7', 'ptr', 0, 1.6);
  p2 = tag('s→a→b→t：8 + 9 + 0 = 17', 'ptr', 0, 0.8);
  say('Dijkstra 還是找到 s→t', '7 < 17');
  await step(tok);                                   // 3866.0 修正後 report 還是錯
  me.mood('sad');
  bad('還是錯', 4.6, 1.6);
  say('但最短路徑其實是上面那條', '修正之後 report 還是錯的');
  await step(tok);                                   // 3874.0 為什麼直接 reweighting 會錯？
  say('為什麼直接往上 shift 會錯？', '講明確一點');
  await step(tok);                                   // 3893.0 每條 path 經過的 edge 數不同
  txt(p1, 's→t：1 條 edge → +6');
  txt(p2, 's→a→b→t：3 條 edge → +18');
  say('因為每條 path', '經過的 edge 數不一樣');
  await step(tok);                                   // 3902.0 edge 多的 shift 多，少的加少
  hl(p2, true);
  say('edge 多的 path 被 shift 很多', 'edge 少的加得少：原本 1 vs −1 變成 7 vs 17');
  await step(tok);                                   // 3919.0 應該整條 path 一起 shift 同一個值
  hl(p2, false);
  note('希望：每條 path 都加同一個量', 0, 0.0);
  say('我們希望的是', '每條 path 的總 weight 一起 shift 同一個值');
  await step(tok);                                   // 3927.0 naive reweighting 失效
  say('所以單純這樣 reweighting', '是失效的、沒有用的');
  await step(tok);                                   // 3934.2 文獻上有聰明的 reweighting：Johnson
  txt(p1, 'Johnson：聰明的 reweighting');
  say('文獻上有聰明的 reweighting', 'Johnson 發明的');
  await step(tok);                                   // 3947.0 Johnson 一心想用 Dijkstra
  say('Johnson 一心一意想用 Dijkstra', '設計很精巧、會正常工作的 reweighting');
  await step(tok);                                   // 3962.0 本課不講
  txt(p1, 'Johnson：聰明的 reweighting（本課不講）');
  say('這門課沒有特別講', '有興趣可以參考');
  await step(tok);                                   // 3975.0 每條 path 調整量不同（variant）
  say('這樣做沒效：每條 path 的 edge 數不同', '被調整的量會 vary');
  await step(tok);                                   // 3995.0 不能保證最短 shift 後還最短
  say('所以不能保證', '原本最短的，shift 之後還是最短');
  await step(tok);                                   // 4005.0 Bellman-Ford：簡單 shift 做不到
  txt(p2, 'Bellman-Ford：老老實實發展演算法');
  say('Bellman-Ford 發現', '直接簡單 shift 是做不到的');
  await step(tok);                                   // 4015.0 用 DP；induction 在 node 或 edge
  me.mood('calm');
  say('用 Dynamic Programming', 'induction 的對象可以是 node，也可以是 edge');
  await step(tok);                                   // 4029.0 Bellman-Ford：induction 在 edge 上
  txt(p2, 'Bellman-Ford：DP，induction 在 edge 數上');
  say('Bellman-Ford 的 induction', '做在 edge 上');
  await step(tok);                                   // 4041.0 先看一個簡單 property
  await me.hop(tok);
  say('發展演算法之前', '先看一個簡單的 property');
}]);

// 67:42 不考慮 negative cycle；沒有 negative cycle → 最短路徑是 simple path → 最多 n−1 條邊
FRAG.push(['dpjiang2-simple-path', '無 negative cycle：最短路徑是 simple，≤ n−1 條邊', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const cyc = [[-1.2, 6.4], [0, 7.6], [1.2, 6.4], [0, 5.2]];
  let dot = null, vv = null, lp = [], lb = null, info = null, Q = null;
  const me = pal('', -6.4, C.orange);
  const P = { s: [-5, 2.6], v: [-1, 2.6], t: [5, 2.6] };
  await step(tok);                                   // 4062.0 graph 有 negative cycle 時
  box('s', C.teal, -5.2, 6.4, 0.7, 0.7, 0.5, 1.0); box('t', C.orange, 5.2, 6.4, 0.7, 0.7, 0.5, 1.0);
  cyc.forEach((p) => box('', C.blue, p[0], p[1], 0.5, 0.5, 0.4, 1.0));
  link([-5.2, 6.4], [-1.2, 6.4]); link([1.2, 6.4], [5.2, 6.4]);
  say('有一種 case 不特別考慮', 'graph 裡有 negative cycle');
  await step(tok);                                   // 4073.0 有一個 cycle 是負的
  cyc.forEach((p, k) => link([...p, 0], [...cyc[(k + 1) % 4], 0], C.red, 0.35));
  tag('cycle cost < 0', 'ptr', 0, 8.4);
  say('假設 graph 裡有一個 cycle', 'cost 是負的（< 0）');
  await step(tok);                                   // 4092.6 最短路徑是多少？不知道
  me.mood('wow');
  say('s 到 t 的最短路徑是多少？', '其實不知道');
  await step(tok);                                   // 4103.1 走進去就不想出來：每圈都降
  dot = box('', C.gold, -1.2, 6.4, 0.3, 0.3, 0.3);
  await anim(tok, 2000, (k) => { const a = Math.PI - k * 4 * Math.PI; dot.position.set(Math.cos(a) * 1.2, 6.4 + Math.sin(a) * 1.2, 0.35); });
  say('走進 negative cycle 就不想出來', '每走一圈 cost 就往下降：無窮迴圈');
  await step(tok);                                   // 4114.7 不是我們探討的目標
  say('這種 case', '不是 shortest path 問題探討的目標');
  await step(tok);                                   // 4120.0 只討論沒有 negative cycle 的 graph
  good('只討論：沒有 negative cycle 的 graph', 0, 4.2);
  me.mood('calm');
  say('我們只討論', '沒有 negative cycle 的 graph');
  await step(tok);                                   // 4140.0 假設沒有 negative cycle
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  info = tag('前提：沒有 negative cycle', 'ptr alt', 0, 8.6);
  box('s', C.teal, P.s[0], P.s[1], 0.7, 0.7, 0.5); vv = box('v', C.blue, P.v[0], P.v[1], 0.7, 0.7, 0.5); box('t', C.orange, P.t[0], P.t[1], 0.7, 0.7, 0.5);
  say('假設 graph 沒有 negative cycle', '');
  await step(tok);                                   // 4152.7 s 到 t 一定有 simple 的最短路徑
  txt(info, 'claim：s 到 t 一定有一條 simple 的最短路徑');
  say('s 到 t 的最短路徑', '一定可以找到一條是 simple path');
  await step(tok);                                   // 4161.0 什麼是 simple path？
  say('什麼叫 simple path？', '');
  await step(tok);                                   // 4170.0 不重複經過同一個點
  const sp = good('simple：每個點最多經過一次', 0, 7.6);
  say('simple：這條 path', '不會重複經過一樣的點');
  await step(tok);                                   // 4186.0 不 simple：中間重複經過某點
  remove(sp);
  bad('不 simple：某個點經過兩次', 0, 7.6);
  say('不 simple', '就是中間會重複經過某些點');
  await step(tok);                                   // 4216.0 用反證法
  say('證明很容易', '用反證法');
  await step(tok);                                   // 4227.0 假設最短路徑 P 不 simple
  txt(info, '反設：最短路徑 P 不是 simple');
  say('假設跟它相反', 's 到 t 的最短路徑 P 不是 simple');
  await step(tok);                                   // 4241.0 一定 revisit 某個點
  glow(vv, GOLD);
  say('不 simple', '就一定會 revisit 某個點');
  await step(tok);                                   // 4257.0 s→v，繞一圈回 v，再到 t
  link([...P.s, 0], [...P.v, 0]);
  const loop = [[-1, 2.6], [0.4, 4.4], [-1, 5.6], [-2.4, 4.4]];
  for (let k = 0; k < 4; k++) { lp.push(link([...loop[k], 0], [...loop[(k + 1) % 4], 0], C.gold, k === 0 || k === 3 ? 0.35 : 0.05)); await beat(tok, 250); }
  link([...P.v, 0], [...P.t, 0]);
  say('s 先到 v', 'v 又繞一圈回來，再走到 t');
  await step(tok);                                   // 4271.4 revisit v → 這裡形成 cycle
  lb = tag('cycle', 'ptr alt', -1, 6.2);
  say('revisit v', '這邊就形成一個 cycle');
  await step(tok);                                   // 4286.0 沒有 negative cycle → 總和 ≥ 0
  txt(lb, 'cycle ≥ 0');
  say('沒有 negative cycle', '所以這個 cycle 的 edge weight 總和 ≥ 0');
  await step(tok);                                   // 4294.0 這一塊是累贅 → 砍掉
  lp.forEach((a) => paint(a, C.red));
  say('這一塊是不是累贅？', '可以把它砍掉');
  await step(tok);                                   // 4300.0 砍掉 → 更短
  lp.forEach(kill); txt(lb, '砍掉 cycle');
  say('把重複的 cycle 減掉', '得到一條更短（至少不更長）的路徑');
  await step(tok);                                   // 4319.0 s→v→t：叫它 Q
  glow(vv, GREEN);
  Q = tag('Q：s → v → t', 'ptr', 0, 1.4);
  say('直接 s → v → t', '這條 path 叫 Q');
  await step(tok);                                   // 4327.0 Q 的 weight 比 P 小
  txt(Q, 'Q：s → v → t，cost(Q) ≤ cost(P)');
  say('Q 的總長度', '一定比原來的 P 小（P 多了那個 cycle）');
  await step(tok);                                   // 4341.0 contradiction
  bad('contradiction：P 不是最短', 0, 0.6);
  say('這就 contradiction', '和「P 是 shortest path」矛盾');
  await step(tok);                                   // 4353.0 最短路徑一定是 simple path
  txt(info, '沒有 negative cycle ⇒ 最短路徑一定是 simple path');
  me.mood('happy');
  say('沒有 negative cycle 時', '兩點之間的最短路徑一定是 simple path');
  await step(tok);                                   // 4371.0 graph 有 n 個點
  say('再往後延伸', '假設 graph 有 n 個點');
  await step(tok);                                   // 4390.8 最多經過 n − 1 條 edge
  txt(info, 'n 個點 → 最短路徑最多 n − 1 條 edge');
  say('shortest path 都是 simple path', '最多只會經過 n − 1 條 edge');
  await step(tok);                                   // 4398.0 worst case：每個點都踩過
  const xs = [-5, -3, -1, 1, 3, 5];
  const row = xs.map((x) => box('', C.teal, x, 0.4, 0.5, 0.5, 0.4, 1.0));
  for (let k = 0; k < 5; k++) link([xs[k], 0.4], [xs[k + 1], 0.4], C.teal, 0.3);
  say('worst case', '每個點都被踩過一次');
  void row;
  await step(tok);                                   // 4411.0 也只有 n − 1 條 edge
  tag('6 個點 → 5 條 edge', 'ptr', 0, -0.4);
  await me.hop(tok);
  say('即使每個點都踩過', '也只有 n − 1 條 edge');
}]);

// 73:56 Bellman-Ford：induction 在 edge 數；OPT(i, v) = v 到 t 最多 i 條邊
FRAG.push(['dpjiang2-bf-def', 'OPT(i, v)：v 到 t、最多 i 條 edge 的最短距離', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const G = bfGraph(0, 4.2, 1, 1.0);
  const info = tag(' ', 'ptr alt', 0, 8.2);
  let T = null;
  const me = pal('', -6.4, C.orange);
  const lit = (vs, es) => { vs.forEach((v) => { glow(G.N[v], GOLD); tint(G.N[v], C.teal); }); es.forEach((k) => paint(G.E[k].ar, C.teal)); };
  await step(tok);                                   // 4436.0 開始發展 DP
  say('Bellman-Ford', '開始發展 dynamic programming 的方法');
  await step(tok);                                   // 4441.0 induction 在 edge 數上
  txt(info, 'induction 在「經過的 edge 數」上');
  say('它的 induction', '做在 edge 的數目上');
  await step(tok);                                   // 4450.0 一條 edge 能到的最短路徑
  glow(G.N.t, GOLD);
  lit(['a', 'c', 'd', 'e'], ['at', 'ct', 'dt', 'et']);
  txt(info, '最多 1 條 edge 能到 t');
  say('先看 1 條 edge 可以到達的最短路徑', '跟 t 直接相連的點');
  await step(tok);                                   // 4461.0 兩條、三條…到 n−1 條
  ['a', 'c', 'd', 'e'].forEach((v) => glow(G.N[v], null));
  lit(['b'], ['bd', 'be']);
  txt(info, '最多 2 條、3 條、… 一直到 n − 1 條');
  say('再看 2 條（b 要繞一步）', '3 條、4 條…一直做到 n − 1 條');
  await step(tok);                                   // 4468.0 n−1 條就結束
  BFN.forEach((v) => glow(G.N[v], null));
  say('最多 n − 1 條 edge 的最短路徑算完', '就結束了');
  await step(tok);                                   // 4473.0 induction 在 edge 總數上
  say('所以它 induction 在', '經過的 edge 總數上');
  await step(tok);                                   // 4483.0 了解 DP 要先知道 induction 的對象
  me.mood('happy');
  note('看懂 DP：先找 induction 的對象', -4.6, 8.8);
  say('了解一個 DP 演算法之前', '先知道它背後 induction 的對象是什麼');
  await step(tok);                                   // 4511.0 想要 s 到 t 的最短路徑
  say('現在想要的', '是 s 到 t 的最短路徑');
  await step(tok);                                   // 4518.0 課本固定終點 t
  T = tag('固定終點 t（課本）', 'ptr', G.P.t[0], G.P.t[1] + 0.9);
  say('課本的版本', '固定終點 destination t');
  await step(tok);                                   // 4529.0 其他書固定起點 s：對稱
  txt(T, '固定終點 t（其他書固定起點 s：對稱）');
  say('其他書固定起點 s', '是對稱的發展，沒有什麼不一樣');
  await step(tok);                                   // 4560.0 最佳解定義在 edge 數上
  say('最佳解', '定義在經過的 edge 總數上');
  await step(tok);                                   // 4567.0 OPT 跟什麼有關？
  txt(info, 'OPT( ？ , ？ )');
  say('定義一個 OPT', '它跟什麼有關？');
  await step(tok);                                   // 4575.6 t 固定，第二個引數 v
  txt(info, 'OPT( ？ , v )');
  glow(G.N.d, GOLD);
  say('t 已經固定', '第二個引數是起點 v');
  await step(tok);                                   // 4581.0 v 到 t 最短，最多 i 條 edge
  txt(info, 'OPT(i, v)');
  say('任何 v 到 t 的 path，希望它最短', 'under 最多經過 i 條 edge');
  await step(tok);                                   // 4590.0 OPT(i, v) 的意思
  txt(info, 'OPT(i, v)：v 到 t、最多 i 條 edge 的最短距離');
  say('OPT(i, v)', 'v 到 t 最多經過 i 條 edge 的最短距離');
  await step(tok);                                   // 4608.0 最終：s 到 t、最多 n−1 條
  glow(G.N.d, null);
  txt(info, '目標：OPT(n − 1, s)');
  say('最終目標', 's 到 t、最多經過 n − 1 條 edge 的最短路徑');
  await step(tok);                                   // 4625.0 承接前面的證明
  say('承接前面的證明', '任兩點的最短路徑最多經過 n − 1 條 edge');
  await step(tok);                                   // 4632.0 第 n−1 個 iteration 就取出答案
  say('所以到第 n − 1 個 iteration', '直接取出 s 到 t 的最短路徑');
  await step(tok);                                   // 4646.4 發展演算法：寫 recurrence
  say('怎麼發展這個演算法？', '一樣要寫出 recurrence relation');
  await step(tok);                                   // 4654.0 考慮 v 到 t、最多 i 條
  glow(G.N.b, GOLD);
  say('考慮 v 到 t 最多經過 i 條 edge', '這個解怎麼兜出來？');
  await step(tok);                                   // 4674.0 用 edge 數少的解兜：兩個 case
  me.mood('wow');
  say('用經過比較少 edge 的解', '去兜出最多 i 條的解：一樣兩個 case');
}]);

// 78:05 Recurrence：case 1 少用一條 → OPT(i−1, v)；case 2 先走 (v, w) → c_vw + OPT(i−1, w)
FRAG.push(['dpjiang2-bf-recur', 'OPT(i, v) = min(OPT(i−1, v), min c_vw + OPT(i−1, w))', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const me = pal('', -6.4, C.orange);
  let r1 = null, r2 = null, cd = null, ws = [];
  const f1 = tag(' ', 'ptr', 0, 7.7), f2 = tag(' ', 'ptr', 0, 0.2);
  await step(tok);                                   // 4690.0 case 1：最多 i 條 → i−1 條也可以
  box('v', C.blue, -5, 6.6, 0.8, 0.8, 0.5, 1.0); box('t', C.orange, 5, 6.6, 0.8, 0.8, 0.5, 1.0);
  r1 = line(-4.5, 6.6, 4.5, 6.6, 0, C.teal);
  txt(f1, '≤ i − 1 條 edge');
  say('最多 i 條就好', 'i − 1 條也沒有超過 i');
  await step(tok);                                   // 4702.0 直接用 i−1 條的解
  say('case 1：直接使用', '最多 i − 1 條 edge 的解');
  await step(tok);                                   // 4709.0 case 2：剛好用 i 條
  box('v', C.blue, -5, 3.0, 0.8, 0.8, 0.5, 1.0); box('t', C.orange, 5, 3.0, 0.8, 0.8, 0.5, 1.0);
  txt(f2, '剛好 i 條 edge');
  say('case 2：剛剛好', '用到 i 條 edge');
  await step(tok);                                   // 4718.0 兩個 case；跟 Subset Sum 類似
  say('就這兩個 case', '分析方式跟其他 DP 很類似');
  await step(tok);                                   // 4734.0 Subset Sum：最後 item 放不放
  const cmp = note('Subset Sum：最後一個 item 放不放', 0, 5.0);
  say('Subset Sum 對 item 數 induction', '看最後那個 item 放不放');
  await step(tok);                                   // 4741.0 這裡：最後一條 edge 用不用
  txt(cmp, 'Bellman-Ford：最後那條 edge 用不用');
  say('這裡對 edge 數 induction', '看要用到 i 條，還是少一點');
  await step(tok);                                   // 4770.0 case 1：直接承接 i−1
  remove(cmp);
  r1.material.color.set(C.gold);
  say('case 1 沒有爭議', '沒用到第 i 條：直接承接最多 i − 1 條的解');
  await step(tok);                                   // 4787.0 OPT(i, v) = OPT(i−1, v)
  txt(f1, 'case 1：OPT(i, v) = OPT(i − 1, v)');
  say('OPT(i, v) = OPT(i − 1, v)', '一樣是 v 到 t，最多 i − 1 條');
  await step(tok);                                   // 4796.0 case 2：exactly i 條
  say('case 2：exactly 用到 i 條', '這個解怎麼兜？');
  await step(tok);                                   // 4812.0 拆成兩部分
  say('把它拆成兩部分', '');
  await step(tok);                                   // 4821.3 總要先走一條出去
  say('不管怎樣，這 i 條 edge', '總要先經過一條出去');
  await step(tok);                                   // 4830.0 第一條叫 (v, w)
  const w1 = box('w', C.purple, -1.8, 3.0, 0.8, 0.6, 0.5, 1.0); ws.push(w1);
  link([-5, 3.0], [-1.8, 3.0], C.gold);
  tag('c_vw', 'idx', -3.4, 3.5);
  say('第一條叫 (v, w)', 'w 是 v 出發可以 reach 的另一個點');
  await step(tok);                                   // 4840.0 任何一個鄰居都可以是 w
  ws.push(box('w₂', C.purple, -1.8, 4.6, 0.8, 0.6, 0.5, 1.0), box('w₃', C.purple, -1.8, 1.4, 0.8, 0.6, 0.5, 1.0));
  link([-5, 3.0], [-1.8, 4.6], C.gold); link([-5, 3.0], [-1.8, 1.4], C.gold);
  say('任何一個鄰居', '都可以是這個 w');
  await step(tok);                                   // 4848.0 後半：w 到 t，最多 i−1 條
  r2 = line(-1.3, 3.0, 4.5, 3.0, 0, C.teal);
  tag('≤ i − 1 條', 'idx', 1.6, 3.5);
  say('後半段：w 到 t 的最短路徑', '最多經過 i − 1 條（v→w 已用掉一條）');
  await step(tok);                                   // 4879.0 case 2 = c_vw + OPT(i−1, w)
  txt(f2, 'case 2：c_vw + OPT(i − 1, w)');
  say('兜起來：第一段 c_vw', '再加上 w 到 t 的 OPT(i − 1, w)');
  await step(tok);                                   // 4901.0 兩 case 取小
  say('兩個 case 都可能發生', 'shortest path 越小越好：取其小');
  await step(tok);                                   // 4915.0 寫下 recurrence
  cd = code(['OPT(i,v) = 0          if v = t', '         = ∞          if i = 0, v ≠ t', '         = min( OPT(i-1,v), min_w ( c_vw + OPT(i-1,w) ) )'], 0, -0.8, 0.5);
  say('寫下 recurrence relation', '');
  await step(tok);                                   // 4923.0 boundary：v 就是 t → 0
  cd.hl(0);
  say('boundary：v 就是 t', '自己到自己，距離 0');
  await step(tok);                                   // 4943.6 最多 0 條 edge
  cd.hl(1);
  say('另一個：最多經過 0 條 edge', '不經過任何 edge');
  await step(tok);                                   // 4953.0 不是 t → ∞
  say('除非 v 就是 t，不然走不到', '距離是 ∞');
  await step(tok);                                   // 4979.0 中間的 i：general case
  cd.hl(2);
  say('1 條、2 條…n − 1 條怎麼算？', '用 general case：case 1、case 2 取小');
  await step(tok);                                   // 5040.0 w 可能好幾個：每個都算、取最小
  ws.forEach((m) => glow(m, GOLD));
  say('v 可能 reach 很多個 w', '每個都算一下，取最小');
  await step(tok);                                   // 5053.5 整體也取最小
  ws.forEach((m) => glow(m, null));
  say('overall：case 1、case 2 也取最小', '這就是 Bellman-Ford 的 recurrence');
  await step(tok);                                   // 5067.0 用兩個小圖就能理解
  cd.hl(-1);
  me.mood('happy'); await me.hop(tok);
  say('用這兩個小圖', '就能了解 Bellman-Ford 的 idea');
  void r2;
}]);

// 84:56 實作：M[i][v]，列是點、欄是 edge 數 0 … n−1；1–3 行邊界、4–6 行 general case
FRAG.push(['dpjiang2-bf-code', 'Bellman-Ford 實作：M 表 = 點 × edge 數', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.8, 0]);
  let cd = null, G = null, gr = null;
  const rec = tag(' ', 'ptr', 0, 8.9);
  await step(tok);                                   // 5096.0 剩下 implementation
  say('剩下的就是 implementation', '');
  await step(tok);                                   // 5099.0 recurrence 寫在這
  txt(rec, 'OPT(i,v) = min(OPT(i−1,v), min_w c_vw + OPT(i−1,w))');
  say('recurrence relation 寫在這裡', '');
  await step(tok);                                   // 5107.0 iteration：開一個 table
  cd = code([
    '1 M[0, t] = 0',
    '2 for each v ≠ t',
    '3     M[0, v] = ∞',
    '4 for i = 1 to n-1',
    '5   for each v ∈ V',
    '6     M[i, v] = min( M[i-1, v],',
    '         min_w ( c_vw + M[i-1, w] ) )',
    '7 return M[n-1, s]',
  ], -3.8, 7.8, 0.56);
  say('demo iteration 的做法', '一樣開一個 table');
  await step(tok);                                   // 5119.0 叫 M（小抄）
  G = bfGrid(1.6, 7.0, 0.95, 0.8);
  say('姑且叫它 M', '就是小抄的那個 M table');
  await step(tok);                                   // 5133.0 一維：所有點 v
  note('列 = 點 v', -0.6, 4.2);
  say('每個點都要看它到 t 的最短路徑', '一個 dimension 是所有點 v');
  await step(tok);                                   // 5148.0 另一維：edge 數 0 … n−1
  say('另一個 dimension 是 induction 的對象', '經過的 edge 數：0、1…n − 1');
  await step(tok);                                   // 5163.0 1–3 行：boundary
  cd.hl(0);
  say('1、2、3 行', '對應兩個 boundary condition');
  await step(tok);                                   // 5172.0 t 到 t：0
  bfFill(G, 't', 0, 0);
  say('t 自己到自己、不經過任何 edge', '當然是 0');
  await step(tok);                                   // 5180.0 其他點：∞
  cd.hl(2);
  for (const v of BFN.slice(1)) { bfFill(G, v, 0, Infinity); await beat(tok, 200); }
  say('第 2、3 行：其他點不經過 edge 到 t', '做不到：距離 ∞');
  await step(tok);                                   // 5201.0 4–6 行：general case
  cd.hl(5);
  gr = ghostBox(C.gold, 0.95, 0.8 * 6, 0.6); gr.position.set(G.X(1), G.Y(2.5), 0);
  say('4、5、6 行算 general case', '就是照抄 recurrence');
  await step(tok);                                   // 5217.0 case 1：最多 i−1 條
  say('兩種 case', '第一種：只用最多 i − 1 條，承接前面的解');
  await step(tok);                                   // 5237.9 case 2：exactly i 條
  cd.hl(6);
  say('第二種：exactly 用到 i 條', '');
  await step(tok);                                   // 5244.0 先走一步到 w，再接 w 到 t
  say('v 先往外走一步到 w：c_vw', '再加上 w 到 t、最多 i − 1 條的最短路徑');
  await step(tok);                                   // 5263.0 w 很多：取最小
  say('w 可能有很多個', '取最小，再跟直接承接的解比，取最小');
  await step(tok);                                   // 5290.0 Bellman-Ford 非常重要
  cd.hl(-1);
  say('Bellman-Ford 在 shortest path', '演算法裡非常重要');
  await step(tok);                                   // 5300.0 適用時機比 Dijkstra 廣
  good('適用時機比 Dijkstra 廣：允許負 edge', 2.6, 1.6);
  say('適用時機比 Dijkstra 廣非常多', '實務上用的機會很大');
  await step(tok);                                   // 5306.0 課本的例子
  say('接下來看課本的例子', '');
  await step(tok);                                   // 5320.0 directed graph，有些 weight 是負的
  say('一個 directed graph', '有些 edge weight 是負的');
  await step(tok);                                   // 5327.0 不能用 Dijkstra → 用 Bellman-Ford
  pkt('不能用 Dijkstra → Bellman-Ford', 2.6, 0.8);
  say('不能用 Dijkstra', '用 Bellman-Ford 來做');
}]);

// 88:54 課本例子：6 個點、最多 5 條 edge；逐欄填表
FRAG.push(['dpjiang2-bf-table', '課本例子：逐欄填 M[i, v]', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const M = bfTable();
  let T = null, cur = null;
  const rowsL = [];
  const f = tag(' ', 'ptr alt', 0, -0.4);
  await step(tok);                                   // 5334.4 destination t；開 table
  glow(G.N.t, GOLD);
  T = bfGrid(1.3, 7.0, 1.0, 0.85);
  say('destination t 在這裡', '第一件事：把 table 開出來');
  await step(tok);                                   // 5344.0 一個 dimension：每個點
  glow(G.N.t, null);
  say('第一個 dimension：每個點', '每個點到 t 都要算');
  await step(tok);                                   // 5360.0 每個 row = 一個點到 t
  say('最後每一個 row', '對應一個點到 t 的最短路徑');
  await step(tok);                                   // 5370.3 另一個：最多 n−1 條 edge
  say('另一個 dimension：經過的 edge 數', '最多 n − 1 條');
  await step(tok);                                   // 5379.3 6 個點 → 最多 5 條
  say('6 個點', '最多只能經過 5 條 edge');
  await step(tok);                                   // 5385.0 從 0 條開始：n × n
  say('initial：0 條 edge 的 boundary', 'overall 開 n × n 的 table');
  await step(tok);                                   // 5398.0 左上角填 0
  bfFill(T, 't', 0, 0);
  say('左上角這格填 0', 't 到 t');
  await step(tok);                                   // 5408.1 第一欄其他填 ∞
  for (const v of BFN.slice(1)) { bfFill(T, v, 0, Infinity); await beat(tok, 180); }
  say('第一個 column 其他人填 ∞', '不經過任何 edge 到不了 t');
  await step(tok);                                   // 5424.0 4–6 行：column by column 填
  cur = ghostBox(C.gold, 1.0, 0.75, 0.6); cur.position.set(T.X(1), T.Y(0), 0);
  say('4、5、6 行把剩下的填起來', 'column by column 地填');
  await step(tok);                                   // 5437.5 t 到 t 最多 1 條
  say('先看第一格', 't 到 t、最多 1 條 edge');
  await step(tok);                                   // 5462.0 case 1：0 條直接到自己 = 0
  txt(f, 'case 1：M[0, t] = 0');
  say('case 1：不經過 edge', '直接到自己：0');
  await step(tok);                                   // 5470.8 case 2：t 沒有出邊
  txt(f, 'case 2：t 沒有往外的 edge');
  say('case 2：往外散出去再繞回來？', 't 沒有往外的 edge');
  await step(tok);                                   // 5485.0 沒有 case 2 → 照抄 0
  bfFill(T, 't', 1, 0);
  txt(f, 'M[1, t] = 0（照抄）');
  say('沒有第二個 case', '直接照抄：距離 0');
  await step(tok);                                   // 5490.0 a 到 t
  cur.position.set(T.X(1), T.Y(1), 0);
  glow(G.N.a, GOLD);
  say('再看 a 到 t', '最多經過 1 條 edge');
  await step(tok);                                   // 5509.0 case 1：承接 0 條的解 → ∞
  txt(f, 'case 1：M[0, a] = ∞');
  say('case 1：承接前面 0 條 edge 的解', '不可能：∞');
  await step(tok);                                   // 5517.0 case 2：直接經過 1 條 edge
  txt(f, 'case 2：a 經過 1 條 edge 到 t？');
  say('case 2：直接經過 1 條 edge', 'a 有沒有辦法 1 條就到 t？');
  await step(tok);                                   // 5532.0 有直接的 edge：−3
  paint(G.E.at.ar, C.teal);
  txt(f, 'case 2：c_at + M[0, t] = −3 + 0 = −3');
  say('直接看到存在這條 edge', 'weight −3');
  await step(tok);                                   // 5536.4 −3 < ∞ → take −3
  bfFill(T, 'a', 1, M.a[1]); glow(G.N.a, null);
  txt(f, 'M[1, a] = min(∞, −3) = −3');
  say('−3 比 ∞ 小', 'take −3');
  await step(tok);                                   // 5543.0 依此類推算完第 1 欄
  for (const v of ['b', 'c', 'd', 'e']) { cur.position.set(T.X(1), T.Y(BFN.indexOf(v)), 0); bfFill(T, v, 1, M[v][1]); await beat(tok, 350); }
  say('依此類推', '把最多 1 條 edge 的解算出來');
  await step(tok);                                   // 5551.0 第 1 欄 = 直接相連的 edge
  ['at', 'ct', 'dt', 'et'].forEach((k) => paint(G.E[k].ar, C.teal));
  txt(f, '第 1 欄：來自和 t 直接相連的 edge');
  say('最多 1 條 edge 的解', '來自和 t 直接相連的 edge');
  await step(tok);                                   // 5559.5 b 沒有直接 edge → ∞
  glow(T.cell.b1, RED); glow(G.N.b, RED);
  say('b 和 t 之間沒有 edge', '所以保留 ∞');
  await step(tok);                                   // 5568.2 其他人：剛好是 edge weight
  glow(T.cell.b1, null); glow(G.N.b, null);
  ['a', 'c', 'd', 'e'].forEach((v) => glow(T.cell[v + 1], GREEN));
  say('其他人都和 t 有 edge 相連', '解剛好就是那條 edge weight');
  await step(tok);                                   // 5586.0 依此類推：2 條、3 條
  ['a', 'c', 'd', 'e'].forEach((v) => glow(T.cell[v + 1], null));
  ['at', 'ct', 'dt', 'et'].forEach((k) => paint(G.E[k].ar, C.brown));
  for (const i of [2, 3]) { cur.position.set(T.X(i), T.Y(2.5), 0); cur.scale.set(1, 6, 1); bfCol(T, M, i); await beat(tok, 900); }
  say('依此類推推出', '最多 2 條、3 條 edge 的解');
  await step(tok);                                   // 5595.3 一直到最多 5 條
  for (const i of [4, 5]) { cur.position.set(T.X(i), T.Y(2.5), 0); bfCol(T, M, i); await beat(tok, 900); }
  kill(cur);
  BFN.forEach((v) => glow(T.cell[v + 5], GREEN));
  txt(f, '最後一欄：t 0、a −6、b −2、c 3、d 0、e 0');
  say('一直到最多 5 條 edge', '最後一欄就是每個點到 t 的最短距離');
  void rowsL;
}]);

// 93:23 每欄只參考左邊一欄 → 只要算值的話一兩個 column 就夠；要還原 path 才需要整張表
FRAG.push(['dpjiang2-bf-space', '每欄只看左邊一欄：只要值就不用 n × n', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const M = bfTable();
  for (let i = 0; i <= 5; i++) bfCol(T, M, i, 0);
  const colG = (i, c) => BFN.forEach((v) => glow(T.cell[v + i], c));
  const fadeCol = (i, on) => BFN.forEach((v) => { const m = T.cell[v + i].material; m.transparent = !on; m.opacity = on ? 1 : 0.25; });
  const f = tag(' ', 'ptr alt', 0, -0.4);
  const me = pal('', -6.6, C.orange, 1.8);
  await step(tok);                                   // 5603.0 case 1：承接左邊 column
  colG(5, GOLD); colG(4, GREEN);
  say('兜出答案時：case 1 承接前面的解', '就在左邊那個 column');
  await step(tok);                                   // 5620.1 case 2：也只參考左邊 column
  say('case 2 自己重新算一個', '參考的也是左邊那個 column，再配合一條 edge');
  await step(tok);                                   // 5627.0 每次只看左邊一欄
  colG(5, null); colG(4, null);
  colG(3, GOLD); colG(2, GREEN);
  say('每次 iteration 真正參考的', '都是左邊那一欄：不會往前兩欄以上');
  await step(tok);                                   // 5652.0 有必要開 n × n 嗎？
  colG(3, null); colG(2, null);
  me.mood('wow');
  say('那 table 有必要開 n × n 嗎？', '如果只要 shortest path 的值');
  await step(tok);                                   // 5661.0 single column 就夠
  for (let i = 0; i <= 3; i++) fadeCol(i, false);
  say('不需要', 'single column 就行，頂多兩個 column');
  await step(tok);                                   // 5671.2 怕被蓋掉 → 兩欄
  fadeCol(4, true);
  note('怕被蓋掉 → 兩欄', T.X(4.5), 8.4);
  say('怕舊的值被蓋掉的話', '就用兩個 column，適當修正');
  await step(tok);                                   // 5684.0 每欄只參考左邊：前面多記了
  say('每個 iteration 只參考左邊一欄', '前面那些都多記了');
  await step(tok);                                   // 5692.7 只要最後一欄的值 → 不需大 table
  colG(5, GREEN);
  say('如果只需要最後這個 column 的數值', '不需要開這麼大的 table');
  await step(tok);                                   // 5698.0 要 retrieve path → 需要整張表
  colG(5, null);
  for (let i = 0; i <= 3; i++) fadeCol(i, true);
  me.mood('calm');
  say('但如果要 retrieve 整條 path 的長相', '可能還是需要這麼大的 table');
  await step(tok);                                   // 5716.0 例子：D2 怎麼算
  glow(T.cell.d2, GOLD);
  paint(G.E.da.ar, C.teal); paint(G.E.dt.ar, C.teal);
  txt(f, 'M[2, d] = ?');
  say('舉例：D2 這格怎麼算', 'd 的出邊：d→a（6）、d→t（4）');
  await step(tok);                                   // 5726.5 參考 D1、A1（和 T1）
  glow(T.cell.d1, GREEN); glow(T.cell.a1, GREEN); glow(T.cell.t1, GREEN);
  txt(f, 'M[2, d] = min(4, 6 + (−3), 4 + 0) = 3');
  say('參考的是前一欄的 D1、A1（和 T1）', 'min(4, 6 − 3, 4 + 0) = 3');
  await step(tok);                                   // 5736.4 不會再往前；怎麼找最短路徑？
  ['d2', 'd1', 'a1', 't1'].forEach((k) => glow(T.cell[k], null));
  say('不會再往前參考', '那怎麼找出最短路徑？');
  await step(tok);                                   // 5749.0 最後一欄記錄每點到 t 的最短距離
  colG(5, GREEN);
  say('全部算完後', '每點到 t 的最短距離都記錄在最後一欄');
  await step(tok);                                   // 5759.0 找出要 retrieve 的點
  colG(5, null);
  say('identify 要哪一點到 t 的最短路徑', '再 retrieve 它的 detail 長相');
  await step(tok);                                   // 5765.0 例：a 到 t
  glow(G.N.a, GOLD); glow(T.cell.a5, GOLD);
  say('假設要找 a 到 t 的最短路徑', '');
  await step(tok);                                   // 5775.0 總長 −6
  txt(f, 'a 到 t：−6');
  say('table 告訴我', '這條 path 的總長度是 −6');
}]);

// 96:17 還原 a 到 t 的最短路徑：−6 ← 抄左邊；a→b（−4）+ M[3, b] = −2；→ a b e c t
FRAG.push(['dpjiang2-bf-trace', '倒推 a 的最短路徑：a→b→e→c→t = −6', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const M = bfTable();
  for (let i = 0; i <= 5; i++) bfCol(T, M, i, 0);
  glow(T.cell.a5, GOLD);
  const f = tag(' ', 'ptr alt', 0, -0.4);
  const walker = pkt('a', G.P.a[0], G.P.a[1] + 0.7);
  await step(tok);                                   // 5783.0 take min 時可以記來源
  say('算 take minimum 的時候', '可以順便記下它來自哪個 term');
  await step(tok);                                   // 5796.0 有記就容易；沒記就倒推
  say('有記的話 retrieve 很容易', '剛才沒記：我們倒推看看');
  await step(tok);                                   // 5805.0 −6 照抄左邊：M[4, a]
  glow(T.cell.a4, GOLD);
  txt(f, 'M[5, a] = −6 ← 照抄左邊 M[4, a]');
  say('這個 −6 來自哪？', '直接照抄左邊：最多 4 條 edge 的解');
  await step(tok);                                   // 5812.0 M[4, a] 的 −6 又來自哪？
  say('那 M[4, a] 的 −6', '又來自哪裡？');
  await step(tok);                                   // 5818.0 兩種可能
  say('a 最多 4 條 edge', '有兩種可能');
  await step(tok);                                   // 5823.0 照抄左邊是 −4 → 不是
  glow(T.cell.a3, RED);
  txt(f, '照抄 M[3, a] = −4？不是，有更小的');
  say('第一種：照抄前面的 −4', '但 −6 不是 −4：有更小的解');
  await step(tok);                                   // 5833.0 a 先踩到某個人
  glow(T.cell.a3, null);
  say('第二種：a 先經過某個人', '');
  await step(tok);                                   // 5842.0 再到 t，兜出 −6
  say('再到達 t', '兜出最小的 −6');
  await step(tok);                                   // 5857.3 b 到 t 最多 3 條：−2
  glow(T.cell.b3, GOLD);
  say('已知 b 到 t 最多 3 條 edge', '是 −2');
  await step(tok);                                   // 5864.0 a→b（−4）+ (−2) = −6
  paint(G.E.ab.ar, C.teal);
  txt(f, 'c_ab + M[3, b] = −4 + (−2) = −6 ✓');
  say('配合 a→b 的 −4', '−4 + (−2) = −6：兜出更小的解');
  await step(tok);                                   // 5873.0 retrieve 到 edge ab
  await travel(tok, walker, V3(G.P.a[0], G.P.a[1] + 0.7, 0), V3(G.P.b[0], G.P.b[1] + 0.7, 0), 700);
  txt(walker, 'a→b');
  say('所以 retrieve 出', 'a→b 這條 edge');
  await step(tok);                                   // 5881.6 繼續倒推下去
  const hop = [['be', 'e2', 'e'], ['ec', 'c1', 'c'], ['ct', 't0', 't']];
  let at = 'b';
  for (const [ek, ck, nx] of hop) {
    paint(G.E[ek].ar, C.teal); glow(T.cell[ck], GOLD);
    await travel(tok, walker, V3(G.P[at][0], G.P[at][1] + 0.7, 0), V3(G.P[nx][0], G.P[nx][1] + 0.7, 0), 650);
    at = nx;
  }
  say('繼續倒推：b→e、e→c、c→t', 'M[2, e]、M[1, c]、M[0, t]');
  await step(tok);                                   // 5888.0 整條 path 走出來
  ['a', 'b', 'e', 'c', 't'].forEach((v) => glow(G.N[v], GREEN));
  txt(f, 'a→b→e→c→t：−4 − 2 − 3 + 3 = −6');
  txt(walker, '到了！');
  say('整條 path 走出來', 'a→b→e→c→t');
  await step(tok);                                   // 5897.0 有整張 table 就能還原任何 path
  say('有了整張 table', '任何一條最短路徑都能 retrieve 回來');
  await step(tok);                                   // 5915.0 每格多記一個欄位
  note('每格多記一欄：我來自誰', T.X(2.5), 8.6);
  say('為了方便 retrieve', '每格會另外記一個 field：這個值來自誰');
  await step(tok);                                   // 5929.0 來自照抄左邊，或某條 edge
  say('例如：來自照抄左邊', '或來自某一條 edge');
  await step(tok);                                   // 5937.0 倒走回去就推出 path
  say('記錄之後，整條 path', '倒走回去就推出來了');
}]);

// 99:16 Space O(n²)；naive time O(n³)；細算每欄只看每條 edge 一次 → O(nm)
FRAG.push(['dpjiang2-bf-time', 'Bellman-Ford：space O(n²)、time O(nm)', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const f = tag(' ', 'ptr alt', 0, -0.4);
  const ek = Object.keys(G.E);
  let cur = null;
  await step(tok);                                   // 5956.0 space：n × n
  const sp = ghostBox(C.teal, 6.2, 5.3, 0.4); sp.position.set(T.X(2.5), T.Y(2.5), 0);
  txt(f, 'space：n × n → O(n²)');
  say('space：table 開多大？', 'n by n：O(n²)');
  await step(tok);                                   // 5964.0 naive：n² 格，每格看連線
  kill(sp);
  cur = ghostBox(C.gold, 1.0, 0.75, 0.6); cur.position.set(T.X(2), T.Y(2), 0);
  say('running time 的 naive 分析', 'n² 個格子，每格看後面跟誰有連線');
  await step(tok);                                   // 5982.0 每人可能和 n−1 人連 → n³
  txt(f, 'naive：n² 格 × (n − 1) → O(n³)');
  say('naive：每個人可能跟其他 n − 1 人都有連線', '算起來 O(n³)');
  await step(tok);                                   // 5996.0 其實只看自己能 reach 的
  paint(G.E.bd.ar, C.teal); paint(G.E.be.ar, C.teal);
  say('但實際上沒那麼多', '每個點只往外看它能 reach 到的鄰居');
  await step(tok);                                   // 6002.0 整欄看下來：每條 edge 一次
  for (const k of ek) { paint(G.E[k].ar, C.teal); await beat(tok, 150); }
  cur.scale.set(1, 6, 1); cur.position.y = T.Y(2.5);
  say('整欄看下來', 'visit 的只是 edge 總數 m');
  await step(tok);                                   // 6008.0 detail：n × m
  txt(f, '詳細：每欄 O(m)');
  say('detail 分析', '你只會走 n × m 這麼多');
  await step(tok);                                   // 6022.0 每個 iteration 每條 edge 一次 → O(nm)
  ek.forEach((k) => paint(G.E[k].ar, C.brown));
  for (let i = 1; i <= 5; i++) { cur.position.x = T.X(i); await beat(tok, 300); }
  txt(f, 'n 個 iteration × O(m) = O(nm)');
  say('每個 iteration 每條 edge 頂多 visit 一次', 'total complexity：O(nm)');
}]);
  }

  // ═══ dpmit1.js ═══
  {
// ─── MIT 6.006 Fall 2011：OQ5jsbhAv_M（L19 DP I：Fibonacci、Shortest Paths）、ENyox7kNKeY（L20 DP II：五步驟、
//     text justification、blackjack）、wFP5VHGHFdk（Rec21 Knapsack） ───
// Cued scenes: every `await step(tok)` waits until the lecturer says that sentence; the motion after it is
// short (≤ 2.5 s) and then the picture holds. The comment on each step gives its cue time (seconds).
// 老師的例子：naive fib（n ≤ 2 → 1）、T(n) ≥ 2T(n−2) → 2^{n/2}、memo = {}、「Fₙ₋₃ 被切掉、Fₙ₋₂ 整棵子樹消失」、
// n 次非 memo 呼叫 × Θ(1)、bottom-up for k in range(1, n+1)、只留最後兩個值；猜最後一條邊 δ(s,v) = min δ(s,u) + w(u,v)；
// 有環圖 s→b→a→v→b 無限遞迴；DAG 上 Σ(indeg+1) = V + E；分層 δₖ(s,v) → V² 個子問題、Θ(VE) = Bellman-Ford。
// L20：五步驟對照表、text justification（badness = (W − 總長)³、DP(i) = min badness(i,j) + DP(j)、parent pointers）、
// Victor 示範 blackjack（A+7 = 18 vs 17、18 vs 20）、BJ(i) = max(結果 + BJ(j))、i+4、i+5、i+6 的 DAG。
// Knapsack：S = 5；雕像 (4 磅, $10)、水晶球 (2 磅, $4)、鋼筆 (3 磅, $7) → $11；圖的節點 (i, w)、邊權 −vᵢ；
// dp(i, j) = max(dp(i+1, j), vᵢ + dp(i+1, j−sᵢ))、dp(3, j) = 0、答案 dp(0, 5)；O(nS) pseudo-polynomial（32 vs 64 bit）；Dijkstra 輸入對照。
// 老師沒給數字的地方（text justification 的字、blackjack 的牌堆、圖的權重）用「示意」資料，畫面上標明。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, travel, remove, step, buddy, prop, bob, GOLD, GREEN, RED, GRAY } = K;
const say = (a, b = '') => ctx.say(a, b);
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', gold: '#c08a1f', brown: '#6e5f49', cyan: '#31aab0', mint: '#cfe8da', butter: '#f2d37a', peach: '#f4a56a', sky: '#a9cdf0', cell: '#e6dccb' };
const LV = [C.purple, C.blue, C.cyan, C.orange, C.pink];
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
// an arrow between two node centres [x, y, z?], trimmed so it starts / ends at the node edges
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
// small label kinds: a sticky note, a good / bad verdict, a speech bubble
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
// a label spot that replaces itself, so an old line never lingers
function board(x, y, z = 0, cls = 'say') { let l = null; return (t) => { if (l) remove(l); l = t ? tag(t, cls, x, y, z) : null; return l; }; }
// a pile of things that can be cleared together (meshes, labels, arrows, buddies)
function pile() { const a = []; const f = (o) => { a.push(o && o.g ? o.g : o); return o; }; f.clear = () => { a.forEach((o) => kill(o)); a.length = 0; }; return f; }
// a little packet that travels from a to b and stays there
async function pkt(tok, t, a, b, ms = 800, cls = 'pkt') { const l = tag(t, cls, a.x, a.y, a.z); await travel(tok, l, a, b, ms); return l; }
// fade something out of focus (on) or back (off)
function dimm(o, on = true) {
  o.traverse((c) => {
    if (c.material) { if (!c.userData.own) { c.material = c.material.clone(); c.userData.own = true; } c.material.transparent = true; c.material.opacity = on ? 0.22 : 1; }
    if (c.element) c.element.style.opacity = on ? '0.3' : '';
  });
}
const strike = (l) => { l.element.style.textDecoration = 'line-through'; l.element.style.opacity = '0.6'; };
// symbolic Fibonacci recursion tree: node k means F(n−k); left child n−1, right child n−2 (MIT order)
const symK = (k) => (k === 0 ? 'n' : 'n−' + k);
function symTree(depth, cx, spread, yTop, dy) {
  const all = []; let leaf = 0;
  (function mk(k, d, par) {
    const t = { k, d, par, kids: [] }; all.push(t);
    if (d < depth) { t.kids = [mk(k + 1, d + 1, t), mk(k + 2, d + 1, t)]; t.x = (t.kids[0].x + t.kids[1].x) / 2; }
    else t.x = cx + (leaf++ - (2 ** depth - 1) / 2) * spread;
    t.y = yTop - d * dy;
    return t;
  })(0, 0, null);
  return all;
}
const subtree = (t) => [t].concat(...t.kids.map(subtree));

// ════════════════ OQ5jsbhAv_M（MIT 6.006 L19 / 2011：DP I） ════════════════

// 00:21 DP：最佳化問題、careful brute force
FRAG.push(['dpmit1-brute', 'DP ≈ careful brute force：小心的暴力搜尋', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.6, 0]);
  const T = board(0.6, 7.7, 0, 'ptr'), G = pile();
  await step(tok);                                   // 20.8 a brand new topic: dynamic programming
  const dp = buddy('DP', '', C.teal, -5.7, 0, 1.4, 1.1);
  dp.mood('happy'); T('新主題：dynamic programming（DP）');
  say('新主題：動態規劃（DP）');
  await dp.hop(tok);
  await step(tok);                                   // 31.8 the next four lectures
  const lec = [];
  for (let k = 0; k < 4; k++) lec.push(box('第 ' + (k + 1) + ' 講', LV[k], -2.4 + k * 2.0, 5.6, 1.7, 0.7, 0.5, 1.2));
  say('接下來四講都講 DP');
  await step(tok);                                   // 37.8 a very general, powerful design technique
  lec.forEach((m) => fly(m));
  bubble('通用又強大的設計技巧', -5.7, 2.7, 1.4);
  say('DP：一般又強大的演算法設計技巧');
  await step(tok);                                   // 92.8 good for optimization problems, like shortest paths
  const P = { s: [-1.6, 4.2], a: [1.2, 5.8], b: [1.2, 2.6], v: [4.0, 4.2] }, N = {};
  for (const k in P) N[k] = G(box(k, k === 's' ? C.teal : k === 'v' ? C.orange : C.blue, P[k][0], P[k][1], 0.7, 0.7, 0.5, 1.0));
  for (const [p, q, w] of [['s', 'a', 5], ['s', 'b', 2], ['a', 'v', 1], ['b', 'v', 3]]) { G(link(P[p], P[q])); G(tag(String(w), 'idx', (P[p][0] + P[q][0]) / 2, (P[p][1] + P[q][1]) / 2 + 0.35)); }
  G(tag('（權重為示意）', 'idx', 1.2, 1.4));
  T('最佳化問題：找「最好」的做法');
  say('DP 特別適合最佳化問題', '例如 shortest paths');
  await step(tok);                                   // 100.8 the shortest path = the minimum length path
  G(link([...P.s, 0.3], [...P.b, 0.3], C.teal)); G(link([...P.b, 0.3], [...P.v, 0.3], C.teal));
  [N.s, N.b, N.v].forEach((m) => glow(m, GREEN));
  G(ok('最短：2 + 3 = 5', 4.4, 2.6));
  say('最短路徑 = 長度最小的路徑', 'minimize / maximize：最佳化問題');
  await step(tok);                                   // 113.8 DP as a kind of exhaustive search
  G.clear();
  const rows = [];
  for (let d = 0; d < 5; d++) {
    const cnt = 2 ** d, sp = Math.min(1.3, 10.4 / cnt), row = [];
    for (let k = 0; k < cnt; k++) row.push(box('', LV[d], 0.6 + (k - (cnt - 1) / 2) * sp, 6.4 - d * 1.05, Math.min(0.9, sp * 0.75), 0.36, 0.36, 1.2));
    rows.push(row);
    await anim(tok, 220, () => {});
  }
  T('exhaustive search：試遍所有可能');
  say('也可以把 DP 看成窮舉', '試遍所有可能');
  await step(tok);                                   // 121.8 usually bad: exponential time
  const ex = no('指數時間：每層翻倍', 3.4, 1.0);
  dp.mood('sad');
  say('窮舉通常很糟：指數時間');
  await step(tok);                                   // 124.8 done cleverly by DP → polynomial time
  const pol = ok('聰明地做 → 多項式時間', 3.4, 0.3);
  dp.mood('wow');
  say('用 DP 聰明地做', '通常得到多項式時間');
  await step(tok);                                   // 136.8 DP ≈ careful brute force
  T('DP ≈ careful brute force');
  say('一句話：DP ≈ 小心的暴力搜尋');
  await step(tok);                                   // 148.8 try all possibilities, but carefully
  const flat = rows.flat();
  flat.forEach((m, k) => { if (k < 5) move(m, -2.6 + k * 1.6, 3.6, 0); else fly(m, V3(0, 6, 3)); });
  kill(ex); kill(pol);
  await anim(tok, 600, () => {});
  flat.slice(0, 5).forEach((m) => { m.scale.set(1.5, 1.8, 1.6); tint(m, C.teal); glow(m, GREEN); });
  dp.mood('happy');
  say('還是全部試，但小心地試', '重複的只算一次 → 多項式');
  await step(tok);                                   // 156.8 often the only known polynomial algorithm
  ok('很多問題：唯一已知的多項式解法就是 DP', 0.6, 2.0);
  say('很多問題只有 DP 能做到多項式時間');
  await step(tok);                                   // 162.8 it doesn't always work
  no('但不是萬能：有些問題被認為沒有多項式解', 0.6, 1.2);
  say('DP 不是萬能');
  await step(tok);                                   // 181.8 warm up: Fibonacci and shortest paths
  flat.slice(0, 5).forEach((m) => fly(m));
  box('Fibonacci', C.purple, -1.8, 5.4, 2.6, 0.8, 0.6, 1.2);
  box('shortest paths', C.blue, 2.6, 5.4, 3.2, 0.8, 0.6, 1.2);
  T('今天暖身：已經會解的兩個問題');
  say('今天暖身：Fibonacci 與 shortest paths');
  await step(tok);                                   // 192.8 next three lectures: surprisingly polynomial problems
  for (let k = 0; k < 3; k++) box('?', LV[k + 2], -1.8 + k * 2.4, 3.6, 1.2, 0.8, 0.6, 1.2);
  bubble('後三講：竟然能多項式時間解的問題', 0.6, 2.8);
  dp.mood('wow');
  say('後三講：更驚人的例子');
}]);

// 05:46 naive recursive fib：if n ≤ 2: f = 1；T(n) = T(n−1) + T(n−2) + Θ(1) ≥ 2T(n−2)
FRAG.push(['dpmit1-fib-naive', 'Naive 遞迴 fib：T(n) ≥ 2T(n−2) → 指數', async (tok) => {
  fresh([0, 4.2, 14.5], [0.6, 4.0, 0]);
  const P = pile(), F = board(1.4, 0.4, 0.6, 'ptr alt');
  await step(tok);                                   // 345.8 split a problem into subproblems
  P(box('大問題', C.orange, 0, 6.2, 3.0, 0.9, 0.6, 1.2));
  const sm = [];
  for (let k = 0; k < 3; k++) { sm.push(P(box('子問題', C.blue, -2.8 + k * 2.8, 4.0, 1.9, 0.7, 0.5, 1.2))); P(link([0, 5.7], [-2.8 + k * 2.8, 4.4], C.sand, 0.1)); }
  say('DP 的基本想法：拆成子問題');
  await step(tok);                                   // 352.8 solve them and reuse the solutions
  sm.forEach((m) => tint(m, C.teal));
  P(await pkt(tok, '答案 ♻ 再用一次', V3(-2.8, 3.2, 0.5), V3(2.8, 3.2, 0.5), 1000));
  say('解出子問題，答案重複使用', '像回收再利用');
  await step(tok);                                   // 365.8 Fibonacci: rabbits on day n
  P.clear();
  const bun = [1, 1, 2, 3, 5].map((v, k) => P(buddy('F' + (k + 1), v, k % 2 ? '#f2c6d8' : '#f6e3b0', -4.4 + k * 2.2, 3.0, 0, 0.8)));
  say('Fibonacci 數：第 n 天有幾對兔子', '1, 1, 2, 3, 5, …');
  await step(tok);                                   // 378.8 a recursive definition: Fₙ = Fₙ₋₁ + Fₙ₋₂
  F('Fₙ = Fₙ₋₁ + Fₙ₋₂（F₁ = F₂ = 1）');
  bun[4].mood('happy'); bun[2].look(1); bun[3].look(1);
  say('遞迴定義：Fₙ = Fₙ₋₁ + Fₙ₋₂');
  await bun[4].hop(tok);
  await step(tok);                                   // 389.8 goal: compute the nth Fibonacci number
  P.clear(); F('');
  const goal = buddy('目標', 'Fₙ = ?', C.purple, -5.5, 0.2, 1.6, 0.9); goal.mood('wow');
  say('目標：算出第 n 個 Fibonacci 數');
  await step(tok);                                   // 398.8 it fits in a word: addition is O(1)
  note('假設放得進一個 word：加法 O(1)', -4.6, 2.4, 1.6);
  say('假設：數字放得進一個 word', '加法、比較都是常數時間');
  await step(tok);                                   // 430.8 the naive recursive algorithm
  const cd = code(['fib(n):', '  if n <= 2: f = 1', '  else: f = fib(n-1) + fib(n-2)', '  return f'], -3.8, 8.4, 0.48);
  cd.hl(0);
  say('先寫最直接的遞迴版本');
  await step(tok);                                   // 449.8 check the base case
  cd.hl(1);
  say('base case：n ≤ 2 時 f = 1');
  await step(tok);                                   // 481.8 otherwise call fib(n−1) and fib(n−2), add them
  cd.hl(2);
  const T = symTree(3, 1.4, 1.2, 6.2, 1.45);
  const show = (t) => { if (t.par) t.e = line(t.par.x, t.par.y - 0.3, t.x, t.y + 0.3, 0, C.sand); t.m = box(symK(t.k), LV[t.d], t.x, t.y, 1.0, 0.55, 0.45, 1.0); };
  T.filter((t) => t.d <= 1).forEach(show);
  say('否則遞迴呼叫 fib(n−1)、fib(n−2)', '相加後回傳');
  await step(tok);                                   // 489.8 correct, but very bad
  cd.hl(3);
  const bad = no('正確，但很糟', 5.4, 7.3);
  say('這個演算法正確，但很糟');
  await step(tok);                                   // 496.8 exponential time
  for (const d of [2, 3]) { T.filter((t) => t.d === d).forEach(show); await anim(tok, 500, () => {}); }
  txt(bad, '指數時間！');
  goal.mood('sad');
  say('指數時間：遞迴樹爆炸成長');
  await step(tok);                                   // 506.8 write the running time as a recurrence
  cd.hl(-1);
  F('T(n) = 算第 n 個要花的時間');
  say('把執行時間寫成 recurrence', 'T(n)：算第 n 個 Fibonacci 的時間');
  await step(tok);                                   // 534.8 T(n−1) + T(n−2) + constant
  F('T(n) = T(n−1) + T(n−2) + Θ(1)');
  T.forEach((t) => glow(t.m, t.d === 1 ? GOLD : null));
  say('兩個遞迴 + 常數的加法', 'T(n) = T(n−1) + T(n−2) + Θ(1)');
  await step(tok);                                   // 570.8 the same as the Fibonacci recurrence
  T.forEach((t) => glow(t.m, null));
  F('T(n) ≥ Fₙ：跟 Fibonacci 同一個遞迴');
  say('這就是 Fibonacci 的遞迴', '所以 T(n) 至少是 Fₙ');
  await step(tok);                                   // 582.8 about the golden ratio to the nth power
  F('T(n) ≥ Fₙ ≈ φⁿ（φ ≈ 1.618）');
  say('Fₙ 大約是黃金比例 φ 的 n 次方', '很糟');
  await step(tok);                                   // 596.8 at least 2·T(n−2)
  F('T(n) ≥ 2·T(n−2)');
  say('另一種看法：T(n−1) 放小成 T(n−2)', 'T(n) ≥ 2T(n−2)：得到下界');
  await step(tok);                                   // 618.8 ×2 each time, n − 2 each time
  for (let d = 0; d <= 3; d++) { tag('×' + 2 ** d, 'idx', 6.5, 6.2 - d * 1.45); await anim(tok, 300, () => {}); }
  say('每往下一層乘 2、n 減 2');
  await step(tok);                                   // 626.8 n/2 times → 2^{n/2}
  F('T(n) ≥ c·2^(n/2) → 指數');
  say('n 可以減 2 共 n/2 次', 'T(n) = Ω(2^(n/2))');
  await step(tok);                                   // 650.8 the right base is φ
  F('精確來說：T(n) = Θ(φⁿ)');
  say('真正的底數是 φ', '總之：很糟的演算法');
}]);

// 11:09 memoization：memo = {}，查到就回傳；Fₙ₋₃ 被切掉、Fₙ₋₂ 整棵子樹消失
FRAG.push(['dpmit1-memo', 'Memoization：查到 memo 就整棵子樹不用算', async (tok) => {
  fresh([0, 4.2, 14.5], [0.4, 3.8, 0]);
  const Tb = board(1.6, 7.9, 0, 'ptr'), Nb = board(-4.0, 5.3, 0, 'note');
  await step(tok);                                   // 668.8 a general approach: memoization
  const pad = prop('note', -5.6, 0.2, 1.8, 1.6, 'memo pad'); bob(pad, 0.05);
  Tb('通用方法：memoization');
  say('讓爛演算法變好的通用方法', 'memoization');
  await step(tok);                                   // 684.8 the memoized dynamic programming algorithm
  Tb('memoized DP algorithm');
  say('得到 memoized DP 演算法');
  await step(tok);                                   // 709.8 every Fibonacci number goes into a dictionary
  const keys = ['…', 'n−3', 'n−2', 'n−1', 'n'], MX = (i) => -0.6 + i * 1.25;
  tag('memo', 'ptr', MX(0) - 1.3, 0.8);
  const cells = keys.map((k, i) => { tag(k, 'idx', MX(i), 0.15); return box(' ', C.cell, MX(i), 0.8, 1.05, 0.5, 0.5); });
  const fill = (i) => { cells.forEach((m) => glow(m, null)); tint(cells[i], C.teal); relabel(cells[i], '✓'); glow(cells[i], GREEN); };
  say('每算出一個 Fibonacci 數', '就放進 dictionary（memo）');
  await step(tok);                                   // 716.8 already in the dictionary? then return it
  const q = await pkt(tok, '先查：memo 裡有嗎？', V3(-3.6, 2.2, 0.6), V3(MX(2), 1.6, 0.6), 900);
  say('要算 Fₙ 時先查 memo', '有 → 直接回傳；沒有 → 才算');
  await step(tok);                                   // 776.8 the transformation: these lines are identical
  remove(q);
  const cd = code(['memo = {}', 'fib(n):', '  if n in memo: return memo[n]', '  if n <= 2: f = 1', '  else: f = fib(n-1) + fib(n-2)', '  memo[n] = f', '  return f'], -4.0, 8.6, 0.44);
  cd.hl(4); Nb('中間兩行跟 naive 版一模一樣');
  say('轉換很簡單', '中間兩行跟原本完全一樣');
  await step(tok);                                   // 793.8 start with an empty dictionary called memo
  cd.hl(0);
  say('一開始：memo = {} 空的 dictionary');
  await step(tok);                                   // 801.8 check whether fib(n) is already there
  cd.hl(2);
  say('先檢查 n 在不在 memo 裡', '在 → 回傳存好的值');
  await step(tok);                                   // 817.8 once computed, store it in the memo table
  cd.hl(5);
  say('算完之後存進 memo', 'memo[n] = f');
  await step(tok);                                   // 831.8 and return that value
  cd.hl(6);
  say('然後回傳');
  await step(tok);                                   // 836.8 works for any recursion with no side effects
  cd.hl(-1); Nb('任何沒有 side effect 的遞迴都能這樣改');
  say('任何沒有副作用的遞迴', '都能用這招');
  await step(tok);                                   // 855.8 the recursion tree of the old algorithm
  const T = symTree(3, 1.9, 1.12, 6.4, 1.38);
  T.forEach((t) => { if (t.par) t.e = line(t.par.x, t.par.y - 0.3, t.x, t.y + 0.3, 0, '#d8cfc0'); t.m = box(symK(t.k), GRAY, t.x, t.y, 0.95, 0.52, 0.42); });
  glow(T[0].m, GOLD);
  say('看遞迴樹：舊版的 Fₙ₋₁ 與 Fₙ₋₂', '完全分開算');
  await step(tok);                                   // 862.8 Fₙ₋₁ needs Fₙ₋₂ and Fₙ₋₃; Fₙ₋₂ needs Fₙ₋₃, Fₙ₋₄
  glow(T[0].m, null);
  subtree(T[1]).forEach((t) => tint(t.m, C.sky)); subtree(T[8]).forEach((t) => tint(t.m, '#d9c9f7'));
  glow(T[1].m, GOLD); glow(T[8].m, GOLD);
  say('Fₙ₋₁ 要算 Fₙ₋₂、Fₙ₋₃', 'Fₙ₋₂ 又要算 Fₙ₋₃、Fₙ₋₄ …');
  await step(tok);                                   // 883.8 these Fₙ₋₃'s are the same
  T.forEach((t) => glow(t.m, t.k === 3 && t.d === 2 ? GOLD : null));
  say('這兩個 Fₙ₋₃ 是同一個子問題', '應該只算一次');
  await step(tok);                                   // 891.8 the first call to Fₙ₋₃ does the work
  T.forEach((t) => glow(t.m, null));
  subtree(T[2]).forEach((t) => tint(t.m, C.teal));
  glow(T[3].m, GREEN);
  fill(0); fill(1);
  say('第一次呼叫 Fₙ₋₃：真的去算', '算完存進 memo');
  await step(tok);                                   // 896.8 the other call is cut off: no tree there
  glow(T[3].m, null);
  subtree(T[5]).slice(1).forEach((u) => { fly(u.m); kill(u.e); });
  tint(T[5].m, C.gold); glow(T[5].m, GOLD);
  say('另一個 Fₙ₋₃：memo 裡已經有', '直接回傳，下面沒有樹');
  await step(tok);                                   // 907.8 even Fₙ₋₂: its whole tree disappears
  glow(T[5].m, null); fill(2);
  subtree(T[8]).slice(1).forEach((u) => { fly(u.m); kill(u.e); });
  tint(T[8].m, C.gold); glow(T[8].m, GOLD);
  say('其實 Fₙ₋₂ 就已經被切掉', '整棵子樹消失');
  await step(tok);                                   // 917.8 clear why it improves things
  tint(T[1].m, C.teal); fill(3);
  say('Fₙ₋₁ 算完，存進 memo');
  await step(tok);                                   // 920.8 this call is free
  glow(T[8].m, null); tint(T[0].m, C.teal); fill(4);
  ok('free', T[8].x + 0.9, T[8].y + 0.5);
  say('那個 Fₙ₋₂ 呼叫是免費的', '工作早在左邊做過了');
}]);

// 16:17 為什麼線性：非 memo 呼叫恰好 n 次 × Θ(1)；時間 = 子問題數 × 每題時間
FRAG.push(['dpmit1-memo-time', '時間 = 子問題數 × 每題時間 = n × Θ(1)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const L = ['fib(1)', 'fib(2)', 'fib(3)', '…', 'fib(n−1)', 'fib(n)'], X = (i) => -4.5 + i * 1.8;
  const Tb = board(0, 7.5, 0, 'ptr'), Fm = board(0, 0.6, 0.6, 'ptr alt'), P = pile();
  await step(tok);                                   // 976.8 calling fib(k): recursion only the first time
  const kb = P(buddy('fib(k)', '', C.blue, -4.8, 3.0, 0.5, 0.9));
  Tb('呼叫 fib(k)：只有第一次會遞迴');
  say('呼叫 fib(k) 時', '只有第一次會遞迴，之後都在 memo 裡');
  await step(tok);                                   // 989.8 two versions of calling fib(k)
  P(box('第一次：non-memoized', C.orange, 0.8, 5.2, 4.4, 0.7, 0.5, 1.2));
  P(box('之後：memoized', C.teal, 0.8, 3.6, 4.4, 0.7, 0.5, 1.2));
  P(link([-3.9, 4.2], [-1.5, 5.2], C.sand, 0.2)); P(link([-3.9, 3.7], [-1.5, 3.6], C.sand, 0.2));
  P(tag('遞迴、做事', 'idx', 4.0, 5.9));
  say('呼叫分兩種', '第一次：遞迴、做事');
  await step(tok);                                   // 1005.8 memoized calls cost constant time
  P(ok('Θ(1)', 3.9, 3.6, 0.5));
  say('之後的 memoized 呼叫：O(1)');
  await step(tok);                                   // 1010.8 think of them as free
  P(await pkt(tok, 'free！', V3(0.8, 2.6, 0.6), V3(3.9, 2.8, 0.6), 700));
  kb.mood('happy');
  say('可以把它們當成免費', '查表而已，不再遞迴');
  await step(tok);                                   // 1040.8 the number of non-memoized calls is n
  P.clear();
  const subs = L.map((t, i) => box(t, i === 3 ? GRAY : C.orange, X(i), 4.6, 1.5, 0.7, 0.6, 1.4));
  Tb('non-memoized 呼叫：恰好 n 次');
  say('第一次的呼叫有幾次？', '恰好 n 次');
  await step(tok);                                   // 1053.8 we call fib(1), fib(2) at some point
  [0, 1].forEach((i) => glow(subs[i], GOLD));
  say('fib(1)、fib(2) 一定會被呼叫到');
  await step(tok);                                   // 1062.8 the original call is fib(n)
  glow(subs[5], GOLD);
  say('最一開始的呼叫就是 fib(n)');
  await step(tok);                                   // 1071.8 we never call fib(n+1)
  const ex = box('fib(n+1)', GRAY, 6.1, 4.6, 1.4, 0.7, 0.6, 1.4); dimm(ex);
  no('不會呼叫', 6.1, 5.5);
  say('算 fib(n) 不會呼叫 fib(n+1)', '最多 n 次，其實恰好 n 次');
  await step(tok);                                   // 1082.8 ignoring recursion, the work is constant
  subs.forEach((m, i) => { glow(m, null); if (i !== 3) tag('Θ(1)', 'idx', X(i), 5.45); });
  say('不算遞迴的話', '每次呼叫只做 O(1) 的事');
  await step(tok);                                   // 1109.8 so the running time is linear
  Fm('n 次 × Θ(1) = Θ(n)');
  say('所以總時間是線性的', 'Θ(n)');
  await step(tok);                                   // 1122.8 aside: the best uses O(log n) operations
  note('（旁註）最好的做法只要 O(log n) 次運算：6.046 會教', 0, 1.6);
  say('旁註：還有 O(log n) 的做法');
  await step(tok);                                   // 1179.8 memo pad: write down your scratch work
  const pad = prop('note', -5.8, 0.2, 2.2, 1.5, 'memo pad：寫下、記住、重用'); bob(pad, 0.05);
  say('為什麼叫 memoization？', '寫在 memo pad 上：記住、之後重用');
  await step(tok);                                   // 1233.8 the big challenge: what are the subproblems
  Tb('設計 DP 最難的：子問題是什麼？');
  say('設計 DP 的最大挑戰', '找出子問題是什麼');
  await step(tok);                                   // 1269.8 DP ≈ recursion + memoization
  Tb('DP ≈ recursion + memoization');
  say('DP ≈ 遞迴 + memoization');
  await step(tok);                                   // 1282.8 the subproblems: fib(1) … fib(n)
  subs.forEach((m, i) => { if (i !== 3) { tint(m, C.blue); glow(m, GOLD); } });
  say('這裡的子問題：fib(1) … fib(n)', '我們要的是 fib(n)');
  await step(tok);                                   // 1302.8 time = #subproblems × time per subproblem
  subs.forEach((m) => glow(m, null));
  Fm('時間 = 子問題數 × 每題時間');
  say('任何 DP 的執行時間', '= 子問題數 × 每個子問題的時間');
  await step(tok);                                   // 1320.8 n subproblems, constant time each
  Fm('時間 = n × Θ(1) = Θ(n)');
  say('這裡：n 個子問題、每個 Θ(1)');
  await step(tok);                                   // 1332.8 ignore recursive calls: no recurrence needed
  ok('每題時間不數遞迴呼叫 → 不用解 recurrence', 0, 2.6);
  say('算每題時間時不數遞迴呼叫', '所以 DP 不必解 recurrence');
  await step(tok);                                   // 1353.8 memoized recursions: count each subproblem once
  subs.forEach((m, i) => { if (i !== 3) tag('付 1 次', 'note', X(i), 3.75); });
  say('每個子問題只付一次', '第一次之後就免費');
}]);

// 23:14 bottom-up：for k in range(1, n+1)；拓樸排序 subproblem dependency DAG
FRAG.push(['dpmit1-bottomup', 'Bottom-up：for 迴圈 = 依賴 DAG 的拓樸順序', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const X = (k) => -3.75 + (k - 1) * 1.5, V = [0, 1, 1, 2, 3, 5, 8];
  const Tb = board(0, 8.0, 0, 'ptr'), Nb = board(4.4, 5.3, 0, 'note'), P = pile();
  await step(tok);                                   // 1403.8 another perspective, the most commonly taught
  Tb('另一個角度：bottom-up（最常被教的）');
  say('另一個角度：bottom-up', '最常被教的方式');
  await step(tok);                                   // 1428.8 recursion starts at the top and works down
  P(box('fib(n)', C.purple, -3.4, 6.4, 1.6, 0.6, 0.5, 1.2)); P(box('fib(1)', C.teal, -3.4, 2.4, 1.6, 0.6, 0.5, 1.2));
  P(arrow(V3(-4.6, 6.0, 0), V3(-4.6, 2.8, 0), 0xc08a1f)); P(tag('遞迴：top-down', 'idx', -5.7, 4.4));
  say('遞迴：從頂端往下拆');
  await step(tok);                                   // 1437.8 or start at the bottom and work up
  P(arrow(V3(-2.2, 2.8, 0), V3(-2.2, 6.0, 0), 0x0f5a3a)); P(ok('bottom-up', -1.0, 4.4));
  say('也可以反過來', '從最底下往上算');
  await step(tok);                                   // 1443.8 written in a slightly funny way
  P.clear();
  const cd = code(['fib = {}', 'for k in range(1, n+1):', '  if k <= 2: f = 1', '  else: f = fib[k-1] + fib[k-2]', '  fib[k] = f', 'return fib[n]'], -2.2, 7.2, 0.46);
  say('寫法有點怪，但是故意的');
  await step(tok);                                   // 1470.8 naive → memoized → bottom-up is automatic
  ['naive', 'memoized', 'bottom-up'].forEach((t, i) => { P(box(t, [C.red, C.orange, C.teal][i], 4.4, 7.2 - i * 1.1, 2.2, 0.6, 0.5, 1.2)); if (i) P(arrow(V3(4.4, 7.2 - i * 1.1 + 0.8, 0.3), V3(4.4, 7.2 - i * 1.1 + 0.32, 0.3), 0x6e5f49)); });
  say('naive → memo → bottom-up', '轉換完全自動，不用想');
  await step(tok);                                   // 1488.8 same code, with n replaced by k
  cd.hl(3);
  say('中間的程式碼一模一樣', '只是 n 換成 k，外面套 for 迴圈');
  await step(tok);                                   // 1530.8 exactly the same additions, same order
  Nb('跟 memo 版：同樣的加法、同樣的順序');
  say('跟 memo 版做完全一樣的加法', '順序也一樣');
  await step(tok);                                   // 1546.8 more efficient in practice
  Nb('迴圈取代遞迴：實務上比較快');
  say('不用一直呼叫函式', '實務上比較快');
  await step(tok);                                   // 1575.8 compute f1 up to fn
  P.clear(); cd.hl(1); Nb('（示意：n = 6）');
  for (let k = 1; k <= 6; k++) { tag('fib[' + k + ']', 'idx', X(k), 4.3); box('', C.cell, X(k), 3.6, 1.25, 0.6, 0.3); }
  const cells = [];
  const put = (k) => { cells.forEach((m) => m && glow(m, null)); cells[k] = box(V[k], C.teal, X(k), 3.6, 1.0, 0.55, 0.5, 1.3); };
  say('for k = 1 … n：從 f₁ 算到 fₙ');
  await step(tok);                                   // 1586.8 compute it exactly how we used to
  cd.hl(2); put(1);
  say('k = 1：base case', 'fib[1] = 1');
  await step(tok);                                   // 1593.8 computing the k-th number
  put(2);
  say('k = 2：也是 base case', 'fib[2] = 1');
  await step(tok);                                   // 1604.8 the previous two are already computed
  cd.hl(3); put(3); glow(cells[1], GOLD); glow(cells[2], GOLD);
  say('k = 3：前兩個已經算好了', 'fib[3] = 1 + 1 = 2');
  await step(tok);                                   // 1607.8 because we go in increasing order
  put(4); glow(cells[2], GOLD); glow(cells[3], GOLD);
  say('因為照遞增順序算', 'fib[4] = 1 + 2 = 3');
  await step(tok);                                   // 1611.8 the solutions are just waiting there
  put(5); glow(cells[3], GOLD); glow(cells[4], GOLD);
  say('需要的值都在表裡等著', 'fib[5] = 2 + 3 = 5');
  await step(tok);                                   // 1615.8 otherwise a key error
  cells.forEach((m) => m && glow(m, null));
  Nb('前兩個若還沒算 → KeyError（代表有 bug）');
  say('如果還沒算就會 KeyError', '照這個順序永遠不會');
  await step(tok);                                   // 1620.8 store it in the table
  cd.hl(4); put(6); glow(cells[4], GOLD); glow(cells[5], GOLD);
  say('算好存進表', 'fib[6] = 3 + 5 = 8');
  await step(tok);                                   // 1625.8 all subproblems solved; we wanted the nth
  cd.hl(5); cells.forEach((m) => m && glow(m, null)); glow(cells[6], GREEN);
  say('子問題 f₁ … fₙ 全部解完', '要的是 fib[n]');
  await step(tok);                                   // 1658.8 in general: the same computation as memoized
  cd.hl(-1);
  Tb('一般來說：bottom-up 做的就是 memo 版的計算');
  say('一般情形也一樣', 'bottom-up 跟 memo 版做一樣的計算');
  await step(tok);                                   // 1670.8 a topological sort of the subproblem dependency DAG
  const D = []; for (let k = 1; k <= 6; k++) D.push(box('F' + k, C.blue, X(k), 1.2, 0.8, 0.5, 0.4, 1.2));
  Tb('= 子問題依賴 DAG 的 topological sort');
  say('其實是在對子問題的依賴圖', '做 topological sort');
  const dep = (k) => { link([X(k - 1), 1.2, 0.3], [X(k), 1.2, 0.3], C.gold, 0.45); if (k >= 3) { const mx = (X(k - 2) + X(k)) / 2; line(X(k - 2), 1.55, mx, 2.15, 0.3, C.sand); link([mx, 2.15, 0.3], [X(k), 1.55, 0.3], C.sand, 0.02); } };
  await step(tok);                                   // 1700.8 Fₙ needs Fₙ₋₁ and Fₙ₋₂
  dep(6); glow(D[5], GOLD);
  say('Fₙ 需要 Fₙ₋₁ 與 Fₙ₋₂');
  await step(tok);                                   // 1711.8 Fₙ₋₃ is needed by this one and that one
  glow(D[5], null);
  for (let k = 5; k >= 2; k--) { dep(k); await anim(tok, 250, () => {}); }
  say('Fₙ₋₃ 又被這兩個需要', '依此類推');
  await step(tok);                                   // 1719.8 all the edges go left to right
  for (let k = 0; k < 6; k++) { glow(D[k], GOLD); await anim(tok, 220, () => {}); glow(D[k], null); }
  say('邊全都由左往右', '拓樸順序就是由左往右');
  await step(tok);                                   // 1725.8 so f1, f2, …, fn in order
  D.forEach((m) => tint(m, C.teal));
  say('依序算 f₁, f₂, …, fₙ');
  await step(tok);                                   // 1743.8 just a for loop
  cd.hl(1);
  say('通常順序很明顯', '就是一個 for 迴圈');
}]);

// 29:25 只記最後兩個值：O(1) 空間；時間一眼可見
FRAG.push(['dpmit1-const-space', '只留最後兩個值：O(1) 空間', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.4, 0]);
  const X = (k) => -3.75 + (k - 1) * 1.5, V = [0, 1, 1, 2, 3, 5, 8];
  const Tb = board(0, 7.5, 0, 'ptr');
  await step(tok);                                   // 1764.8 from the bottom-up perspective
  for (let k = 1; k <= 6; k++) { tag('fib[' + k + ']', 'idx', X(k), 5.55); box('', C.cell, X(k), 4.8, 1.25, 0.6, 0.3); }
  Tb('從 bottom-up 的角度看');
  say('從 bottom-up 的角度');
  await step(tok);                                   // 1780.8 you can save storage space
  Tb('可以省空間（storage space）');
  say('還可以省下記憶體空間');
  await step(tok);                                   // 1794.8 here we build a table of size n
  const cells = [];
  for (let k = 1; k <= 6; k++) { cells.push(box(V[k], C.teal, X(k), 4.8, 1.0, 0.55, 0.5, 1.0)); await anim(tok, 150, () => {}); }
  say('這裡建了一張 n 格的表');
  await step(tok);                                   // 1799.8 we only need the last two values
  cells.slice(0, 4).forEach((m) => dimm(m));
  const win = ghostBox(C.gold, 3.0, 1.0, 0.9); win.position.set((X(5) + X(6)) / 2, 4.8, 0);
  say('其實只需要記最後兩個值');
  await step(tok);                                   // 1803.8 each new one, delete the oldest
  const a = buddy('前一個', 1, C.sky, -1.3, 1.3, 0.6, 0.85), b = buddy('最新', 1, '#d9c9f7', 1.3, 1.3, 0.6, 0.85);
  for (let k = 3; k <= 6; k++) { await anim(tok, 450, () => {}); a.set(V[k - 1]); b.set(V[k]); }
  b.mood('happy');
  say('每算一個新的，就丟掉最舊的', '1,1 → 1,2 → 2,3 → 3,5 → 5,8');
  await step(tok);                                   // 1806.8 only constant space
  ok('空間 O(1)', -4.2, 2.4);
  say('只要常數空間');
  await step(tok);                                   // 1811.8 still linear time
  ok('時間仍是 Θ(n)', 4.2, 2.4);
  say('時間仍然是線性');
  await step(tok);                                   // 1825.8 the running time is totally obvious
  const cd = code(['for k in range(1, n+1):', '  f = …   # O(1)'], 0, 6.7, 0.46);
  Tb('另一個好處：時間一眼看出');
  say('另一個好處：執行時間一眼可見');
  await step(tok);                                   // 1829.8 constant inside → linear time
  cd.hl(1);
  tag('n 次 × O(1) = Θ(n)', 'ptr alt', 0, 0.2, 0.6);
  say('迴圈裡是常數', '迴圈 n 次 → 線性時間');
  await step(tok);                                   // 1841.8 I still like #subproblems × time per subproblem
  Tb('老師偏好：子問題數 × 每題時間');
  say('老師還是偏好這條公式', '子問題數 × 每題時間');
  await step(tok);                                   // 1853.8 choose however you like to think
  Tb('兩種角度都對：挑自己順手的');
  a.mood('happy');
  say('挑自己順手的角度');
}]);

// 31:00 shortest paths 前：guessing——不知道就全部試，取最好
FRAG.push(['dpmit1-guess', 'Guessing：不知道就全部試，取最好的', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const Tb = board(0, 7.8, 0, 'ptr'), P = pile();
  await step(tok);                                   // 1887.8 single-source shortest paths: s to every v
  P(box('s', C.teal, -4.6, 4.0, 0.8, 0.8, 0.6, 1.2));
  for (let k = 0; k < 4; k++) { const y = 6.2 - k * 1.45; P(box('v' + '₁₂₃₄'[k], C.orange, -0.8, y, 0.8, 0.7, 0.5, 1.2)); P(link([-4.6, 4.0], [-0.8, y], C.sand, 0.5)); }
  Tb('single-source shortest paths：δ(s, v)，每個 v');
  say('回到 single-source shortest paths', '算 s 到每個 v 的最短路徑');
  await step(tok);                                   // 1900.8 naive recursion → memoize → bottom-up
  ['naive 遞迴', 'memoize', 'bottom-up'].forEach((t, i) => { P(box(t, [C.red, C.orange, C.teal][i], 4.2, 6.2 - i * 1.3, 2.4, 0.6, 0.5, 1.2)); if (i) P(arrow(V3(4.2, 6.2 - i * 1.3 + 0.95, 0.3), V3(4.2, 6.2 - i * 1.3 + 0.35, 0.3), 0x6e5f49)); });
  say('想跟 Fibonacci 一樣', '先寫 naive 遞迴，再 memo、再 bottom-up');
  await step(tok);                                   // 1912.8 not so obvious
  P(no('遞迴式從哪裡來？', 4.2, 2.0));
  say('可是遞迴式從哪來？', '不明顯');
  await step(tok);                                   // 1956.8 the tool: guessing
  P.clear();
  const me = buddy('你', '?', C.blue, -5.8, 0.2, 1.5, 1.0); me.mood('wow');
  Tb('工具：guessing（猜）');
  say('給你一個工具：guessing');
  await step(tok);                                   // 1967.8 you don't know something but want to
  box('答案 = ?', C.red, 0, 6.6, 2.0, 0.9, 0.6, 1.5);
  say('不知道某件事，但很想知道');
  await step(tok);                                   // 1975.8 how to answer it? Guess!
  const g1 = await pkt(tok, '猜！', V3(-5.8, 1.8, 1.5), V3(-0.4, 5.8, 0.6), 800);
  me.mood('happy');
  say('怎麼辦？猜！');
  await step(tok);                                   // 1998.8 don't try just one guess: try them all
  remove(g1);
  const X = (i) => -4.5 + i * 3, gs = [];
  for (let i = 0; i < 4; i++) { line(0, 6.1, X(i), 4.2, 0, C.sand); gs.push(box('猜 ' + (i + 1), C.blue, X(i), 3.8, 1.5, 0.7, 0.6, 1.3)); await anim(tok, 300, () => {}); }
  say('不是只猜一個：全部都試', 'try all guesses');
  await step(tok);                                   // 2022.8 central to dynamic programming
  gs.forEach((m) => glow(m, GOLD));
  say('這是 DP 的核心');
  await step(tok);                                   // 2032.8 DP ≈ recursion + memoization + guessing
  gs.forEach((m) => glow(m, null));
  Tb('DP ≈ recursion + memoization + guessing');
  say('修正公式', 'DP ≈ 遞迴 + memo + 猜');
  await step(tok);                                   // 2055.8 the brute-force part
  note('猜 = brute force 的部分（電腦最擅長）', 0, 1.4);
  say('電腦很會做這種事', '這就是暴力搜尋的部分');
  await step(tok);                                   // 2063.8 try all guesses, take the best one
  for (let i = 0; i < 4; i++) { glow(gs[i], GOLD); await anim(tok, 220, () => {}); glow(gs[i], null); }
  tint(gs[2], C.teal); glow(gs[2], GREEN); ok('最好的', X(2), 2.8);
  say('試完全部，取最好的');
  await step(tok);                                   // 2073.8 that's why DP fits optimization problems
  Tb('能挑出「最好」→ DP 適合 min / max');
  say('所以 DP 適合最佳化問題', 'maximize / minimize');
  await step(tok);                                   // 2081.8 forget all of them but the best one
  gs.forEach((m, i) => { if (i !== 2) dimm(m); });
  say('其他的都可以忘掉', '只留下最好的一個');
}]);

// 34:59 猜第一條邊 vs 猜最後一條邊；δ(s,v) = min over (u,v) of δ(s,u) + w(u,v)；memo
FRAG.push(['dpmit1-sp-recur', '猜最後一條邊：δ(s,v) = min δ(s,u) + w(u,v)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5.5, 3.8], x1: [-2.6, 6.2], x2: [-2.6, 1.4], u1: [2.0, 6.4], u2: [2.0, 3.8], u3: [2.0, 1.2], v: [5.4, 3.8] };
  const N = {}, Tb = board(0, 7.9, 0, 'ptr'), Fm = board(0, -0.3, 0.6, 'ptr alt'), A = pile();
  await step(tok);                                   // 2098.8 the source s, some vertex v
  N.s = box('s', C.teal, ...P.s, 0.8, 0.8, 0.6, 1.3); N.v = box('v', C.orange, ...P.v, 0.8, 0.8, 0.6, 1.3);
  say('來源 s，某個頂點 v');
  await step(tok);                                   // 2109.8 a shortest path from s to v
  const pts = [P.s, [-3.6, 5.0], [-1.0, 2.6], [1.4, 5.2], [3.8, 3.0], P.v];
  for (let i = 0; i + 1 < pts.length; i++) A(line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0, C.sand));
  Tb('想找 s → v 的最短路徑');
  say('想找 s 到 v 的最短路徑', '假設它長這樣');
  await step(tok);                                   // 2132.8 look at all the places I could go from s
  A.clear();
  for (const k of ['x1', 'x2']) { N[k] = box('', GRAY, ...P[k], 0.7, 0.7, 0.5, 1.2); A(link([...P.s, 0.2], [...P[k], 0.2], C.gold, 0.5)); }
  say('看 s 先走到哪裡');
  await step(tok);                                   // 2152.8 guess where it goes first
  glow(N.x1, GOLD); glow(N.x2, GOLD);
  Tb('guess first edge：s 的某條出邊');
  say('不知道先走哪條：猜第一條邊', '每條都試');
  await step(tok);                                   // 2163.8 then the shortest path from there to v; take the best
  for (const k of ['x1', 'x2']) { A(line(P[k][0] + 0.4, P[k][1], P.v[0] - 0.4, P.v[1], 0, '#d8cfc0')); A(tag('δ(·, v)?', 'idx', 1.4, (P[k][1] + P.v[1]) / 2 + 0.3)); }
  say('再從那裡算到 v 的最短路徑', '取最好的選擇');
  await step(tok);                                   // 2182.8 but that changes s
  A(no('起點 s 變了 → 變成 single-target', -2.6, 0.2));
  say('可行，但起點 s 會跟著變', 'single-source 用起來不順');
  await step(tok);                                   // 2197.8 guess the last edge instead
  A.clear(); kill(N.x1); kill(N.x2); glow(N.s, null);
  for (const k of ['u1', 'u2', 'u3']) { N[k] = box('u' + '₁₂₃'[+k[1] - 1], C.blue, ...P[k], 0.8, 0.8, 0.6, 1.3); link([...P[k], 0.2], [...P.v, 0.2], C.brown, 0.5); }
  Tb('改猜最後一條邊');
  say('改猜最後一條邊', '兩種其實等價');
  await step(tok);                                   // 2215.8 the last edge (u, v): an incoming edge of v
  glow(N.v, GOLD);
  say('最後一條邊 (u, v)', '一定是 v 的某條入邊');
  await step(tok);                                   // 2231.8 guess every incoming edge; recursively δ(s, u)
  glow(N.v, null);
  for (let i = 0; i < 3; i++) {
    const k = 'u' + (i + 1), sub = '₁₂₃'[i];
    glow(N[k], GOLD); line(P.s[0] + 0.4, P.s[1], P[k][0] - 0.4, P[k][1], -0.2, '#d8cfc0');
    tag('δ(s,u' + sub + ')', 'ptr', P[k][0], P[k][1] + 0.75);
    await anim(tok, 400, () => {}); glow(N[k], null);
  }
  say('每條入邊都猜一次', '遞迴算 δ(s,u)：同一種子問題');
  await step(tok);                                   // 2258.8 add on the weight of edge (u, v)
  for (let i = 0; i < 3; i++) { const k = 'u' + (i + 1); tag('w(u' + '₁₂₃'[i] + ',v)', 'idx', (P[k][0] + P.v[0]) / 2, (P[k][1] + P.v[1]) / 2 + 0.35); }
  say('再加上那條邊的權重 w(u,v)');
  await step(tok);                                   // 2274.8 not lucky: minimize over all edges (u, v)
  Fm('δ(s,v) = min over (u,v) ∈ E of δ(s,u) + w(u,v)');
  say('不知道哪個 u 對', '全部取 min');
  await step(tok);                                   // 2296.8 that gives the shortest path
  glow(N.u2, GREEN); tint(N.u2, C.teal); link([...P.u2, 0.45], [...P.v, 0.45], C.teal, 0.5);
  say('最短路徑一定有某條最後的邊', '正確的那個 u 一定在試的裡面');
  await step(tok);                                   // 2322.8 subpaths of shortest paths are shortest paths
  ok('optimal substructure：子路徑也是最短路徑', 0, 0.5);
  say('最短路徑的子路徑也是最短路徑', 'optimal substructure');
  await step(tok);                                   // 2340.8 treat it as a recursive algorithm
  K.fresh([0, 4.2, 14], [0, 3.8, 0]);
  const cd = code(['δ(s, v):', '  if v in memo: return memo[v]', '  d = min(δ(s,u) + w(u,v) for (u,v) in E)', '  memo[v] = d', '  return d'], 0, 6.8, 0.52);
  showL(cd.ls[1], false); showL(cd.ls[3], false); cd.hl(2);
  const bd = buddy('δ(s,v)', '', C.orange, -5.4, 0.4, 1.2, 0.9);
  say('把遞迴式當成遞迴演算法', '就像 naive 的 fib');
  await step(tok);                                   // 2367.8 terrible: exponential without memoization
  no('沒有 memo：指數時間', 3.8, 2.4);
  bd.mood('sad');
  say('很糟：沒有 memo 是指數時間');
  await step(tok);                                   // 2379.8 we know how: memoize
  showL(cd.ls[1], true); showL(cd.ls[3], true); cd.hl(-1);
  bd.mood('calm');
  say('那就 memoize');
  await step(tok);                                   // 2385.8 first check the memo table
  cd.hl(1);
  say('先查 memo 表', '有就直接回傳');
  await step(tok);                                   // 2394.8 otherwise compute, then store
  cd.hl(3);
  say('沒有就照式子算', '算完存進 memo');
  await step(tok);                                   // 2406.8 s doesn't change: key by v only
  cd.hl(-1);
  const MX = (i) => -1.6 + i * 1.3;
  tag('memo', 'ptr', MX(0) - 1.4, 1.2);
  ['s', 'a', 'b', 'v'].forEach((k, i) => { tag('[' + k + ']', 'idx', MX(i), 0.55); box(' ', C.cell, MX(i), 1.2, 1.0, 0.5, 0.5); });
  note('s 不變：只用 v 當 key', 3.8, 1.2);
  say('s 一直不變', '所以只用 v 當 key');
  await step(tok);                                   // 2419.8 is it a fast algorithm?
  bd.mood('wow');
  bubble('加了 memo，這樣就快了嗎？', -3.8, 2.6, 1.2);
  say('加了 memo 之後', '這是快的演算法嗎？');
}]);

// 41:27 有環的圖：δ(s,v) → δ(s,a) → δ(s,b) → δ(s,v) → …… 無限遞迴
FRAG.push(['dpmit1-cycle', '有環：δ(s,v) 還沒算完又被呼叫 → 無限遞迴', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5, 5.0], b: [-1.5, 5.0], a: [1.6, 7.2], v: [5, 5.0] };
  const N = {}, Tb = board(0, 3.4, 0, 'ptr'), lit = pile();
  const X = (i) => -5.25 + i * 1.5;
  let ci = 0;
  const call = (k, red) => { const m = box('δ(s,' + k + ')', red ? C.red : C.blue, X(ci), 1.2, 1.35, 0.6, 0.5, 1.4); if (ci) link([X(ci - 1), 1.2, 0.3], [X(ci), 1.2, 0.3], C.sand, 0.7); ci++; return m; };
  await step(tok);                                   // 2489.0 a graph; we want δ(s,v)
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 'v' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.6, 1.3);
  link([...P.s, 0], [...P.b, 0]); link([...P.b, 0], [...P.a, 0]); link([...P.a, 0], [...P.v, 0]);
  link([P.v[0], P.v[1] - 0.25, 0.2], [P.b[0], P.b[1] - 0.25, 0.2], C.red);
  tag('呼叫順序 →', 'idx', X(0) - 0.2, 2.0);
  say('畫一張圖', 's→b、b→a、a→v、v→b');
  await step(tok);                                   // 2495.8 compute δ(s,v)
  call('v'); glow(N.v, GOLD);
  say('要算 δ(s,v)');
  await step(tok);                                   // 2511.8 only one incoming edge to v
  lit(link([...P.a, 0.3], [...P.v, 0.3], C.gold)); glow(N.a, GOLD);
  say('v 只有一條入邊：a→v');
  await step(tok);                                   // 2519.8 the base case δ(s,s) = 0
  box('δ(s,s)=0', C.teal, P.s[0], 3.9, 1.5, 0.5, 0.4, 1.2);
  say('先補 base case', 'δ(s,s) = 0');
  await step(tok);                                   // 2529.8 δ(s,a) plus the edge
  lit.clear(); glow(N.v, null);
  call('a');
  say('δ(s,v) = δ(s,a) + w(a,v)', '所以要算 δ(s,a)');
  await step(tok);                                   // 2535.8 a has one incoming edge: δ(s,b)
  glow(N.a, null); glow(N.b, GOLD); lit(link([...P.b, 0.3], [...P.a, 0.3], C.gold));
  call('b');
  say('a 也只有一條入邊：b→a', '所以要算 δ(s,b)');
  await step(tok);                                   // 2543.8 two ways to get to b
  lit.clear();
  lit(link([...P.s, 0.3], [...P.b, 0.3], C.gold)); lit(link([P.v[0], P.v[1] - 0.25, 0.45], [P.b[0], P.b[1] - 0.25, 0.45], C.gold));
  say('到 b 有兩條路', 's→b 和 v→b');
  await step(tok);                                   // 2549.8 one from s, the other δ(s,v)
  const again = call('v', true); glow(again, RED);
  say('一條來自 s：δ(s,s) = 0', '另一條來自 v：要 δ(s,v)');
  await step(tok);                                   // 2559.8 δ(s,v) is what we were trying to compute
  const bd = buddy('δ(s,v)', '?', C.orange, 5.6, 0.0, 2.2, 0.75); bd.mood('wow');
  no('就是我們正在算的那個！', 2.6, 2.4);
  say('看出問題了嗎？', 'δ(s,v) 正是我們還沒算完的那個');
  await step(tok);                                   // 2575.8 memo is set only once we're done
  note('memo 只在算完後寫入：δ(s,v) 還沒有', -2.2, 2.6);
  say('memo 只在算完之後才寫入', '這時 memo 裡還沒有 δ(s,v)');
  await step(tok);                                   // 2585.8 the same thing over and over
  glow(again, null);
  for (const k of ['a', 'b', 'v']) { const m = call(k, true); await anim(tok, 350, () => {}); if (k === 'v') glow(m, RED); }
  tag('…', 'ptr', X(ci), 1.2);
  say('同樣的呼叫一再重複');
  await step(tok);                                   // 2589.8 this is an infinite algorithm
  bd.mood('sad'); bd.set('∞');
  say('這是一個永遠停不下來的演算法');
  await step(tok);                                   // 2598.8 infinite time on graphs with cycles
  Tb('有環的圖：infinite time');
  say('在有環的圖上', '執行時間是無限');
}]);

// 43:35 DAG：子問題 V 個、每題 indeg(v)+1 → Σ = V + E；= DFS 拓樸 + 一輪 Bellman-Ford
FRAG.push(['dpmit1-dag-time', 'DAG 上：Σ(indeg(v)+1) = Θ(V + E)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5, 4.2], a: [-2, 6.4], b: [-2, 1.8], c: [1.8, 4.2], v: [5, 4.2] };
  const E = [['s', 'a'], ['s', 'b'], ['a', 'b'], ['a', 'c'], ['b', 'c'], ['b', 'v'], ['c', 'v']];
  const N = {}, Tb = board(0, 7.9, 0, 'ptr'), Fm = board(0, -0.2, 0.6, 'ptr alt'), lit = pile(), deg = {};
  await step(tok);                                   // 2614.8 on DAGs it runs in V + E
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.6, 1.3);
  for (const [a, b] of E) link([...P[a], 0], [...P[b], 0]);
  Tb('DAG（無環圖）：只要 Θ(V + E)（圖為示意）');
  say('沒有環的 DAG 就沒問題', '時間 Θ(V + E)');
  await step(tok);                                   // 2621.8 time = #subproblems × time per subproblem
  Fm('時間 = 子問題數 × 每題時間');
  say('可以用那條公式', '子問題數 × 每題時間');
  await step(tok);                                   // 2634.8 the number of subproblems is V
  for (const k in P) { glow(N[k], GOLD); tag('δ(s,' + k + ')', 'idx', P[k][0], P[k][1] - 0.75); }
  Fm('子問題數 = V（每個頂點一個 δ(s,v)）');
  say('子問題：每個頂點一個 δ(s,v)', '共 V 個');
  await step(tok);                                   // 2649.8 the time per subproblem: a little tricky
  for (const k in P) glow(N[k], null);
  Fm('每題時間 = ?');
  say('每題要花多少時間？', '有點微妙');
  await step(tok);                                   // 2654.8 the number of incoming edges to v
  glow(N.v, GOLD);
  for (const [a, b] of E) if (b === 'v') lit(link([...P[a], 0.35], [...P.v, 0.35], C.gold));
  say('算 δ(s,v) 要試 v 的每條入邊');
  await step(tok);                                   // 2669.8 the in-degree of v
  lit.clear(); glow(N.v, null);
  for (const k in P) deg[k] = tag('indeg ' + E.filter((e) => e[1] === k).length, 'ptr', P[k][0], P[k][1] + 0.8);
  Fm('δ(s,v) 的時間 = indeg(v)');
  say('時間 = indegree(v)', 'v 的入邊數');
  await step(tok);                                   // 2675.8 it depends on v: no straight product
  note('每題時間不一樣 → 不能直接相乘', 3.4, 1.4);
  say('每個 v 的時間不同', '不能直接相乘');
  await step(tok);                                   // 2679.8 sum over all subproblems
  Fm('總時間 = Σ 每個子問題的時間');
  say('改成對所有子問題加總');
  await step(tok);                                   // 2685.8 the sum over v of indegree(v)
  for (const k of ['s', 'a', 'b', 'c', 'v']) { glow(N[k], GOLD); await anim(tok, 220, () => {}); glow(N[k], null); }
  Fm('總時間 = Σ_v indeg(v)');
  say('總時間 = Σ indeg(v)');
  await step(tok);                                   // 2697.8 that's the number of edges; really indeg + 1
  for (const k in P) txt(deg[k], 'indeg+1 = ' + (E.filter((e) => e[1] === k).length + 1));
  Fm('Σ (indeg(v) + 1) = E + V = 7 + 5');
  say('Σ indeg(v) 就是邊數 E', '嚴格說是 indeg + 1');
  await step(tok);                                   // 2705.8 V + E: the handshaking lemma
  Fm('總時間 = Θ(V + E)（handshaking lemma）');
  say('所以是 V + E', 'handshaking lemma');
  await step(tok);                                   // 2713.8 we already knew a V + E algorithm for DAGs
  note('DAG 最短路徑本來就有 V + E 的演算法', -3.2, 0.6);
  say('之前就學過 DAG 的 V + E 演算法', '這是另一種做法');
  await step(tok);                                   // 2720.8 DFS topological sort + one round of Bellman-Ford
  const t1 = box('DFS 拓樸排序', C.purple, 3.2, 6.9, 2.6, 0.6, 0.5, 1.2), t2 = box('一輪 Bellman-Ford', C.orange, 3.2, 6.1, 2.6, 0.6, 0.5, 1.2);
  bubble('memo 版 = 兩者合成一個', 3.2, 5.3);
  say('這個 memo 演算法其實是', 'DFS 拓樸排序 + 一輪 Bellman-Ford');
  await step(tok);                                   // 2737.8 the min is the relaxation step
  glow(t2, GOLD);
  Fm('min δ(s,u) + w(u,v) = relax 每條入邊');
  say('那個 min 就是 relaxation', '同一個演算法，不同角度');
  await step(tok);                                   // 2768.8 lesson: subproblem dependencies should be acyclic
  glow(t2, null); glow(t1, null);
  Tb('教訓：子問題的依賴必須 acyclic');
  say('教訓：子問題依賴不能有環', '否則演算法停不下來');
  await step(tok);                                   // 2789.8 bottom-up needs a topological order, too
  Fm('memo 與 bottom-up 都需要無環');
  say('bottom-up 要拓樸排序', '本來就要求無環');
}]);

// 47:00 把圖攤成多層：δₖ(s,v) = min δₖ₋₁(s,u) + w(u,v)；V² 子問題、Θ(VE) = Bellman-Ford
FRAG.push(['dpmit1-layers', '分層：δₖ(s,v) 讓依賴無環 → Bellman-Ford', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const VS = ['s', 'a', 'b', 'v'], XV = { s: -4.2, a: -1.4, b: 1.4, v: 4.2 }, Y = (k) => 6.8 - k * 1.7;
  const E = [['s', 'b'], ['b', 'a'], ['a', 'v'], ['v', 'b']];
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, -0.3, 0.6, 'ptr alt'), G = pile();
  await step(tok);                                   // 2819.5 take a cyclic graph and make it acyclic
  const Q = { s: [-3.6, 4.6], b: [-0.8, 4.6], a: [1.2, 6.4], v: [3.6, 4.6] };
  for (const k in Q) G(box(k, k === 's' ? C.teal : k === 'v' ? C.orange : C.blue, Q[k][0], Q[k][1], 0.8, 0.8, 0.6, 1.2));
  for (const [a, b] of E) G(link(Q[a], Q[b], a === 'v' ? C.red : C.brown));
  Tb('目標：把有環的圖變成無環');
  say('有環怎麼辦？', '想辦法把它變成無環');
  await step(tok);                                   // 2845.8 explode it into multiple layers
  G.clear();
  const L = [];
  for (let k = 0; k <= 3; k++) { tag('k = ' + k, 'ptr', -6.0, Y(k)); L.push(Object.fromEntries(VS.map((u) => [u, box(u + k, k ? C.blue : C.teal, XV[u], Y(k), 0.8, 0.55, 0.45, 1.2)]))); await anim(tok, 300, () => {}); }
  say('把圖複製成好幾層');
  await step(tok);                                   // 2869.8 time axis: every edge goes to the next layer
  for (let k = 0; k < 3; k++) { for (const [a, b] of E) link([XV[a], Y(k), 0], [XV[b], Y(k + 1), 0], C.brown, 0.45); await anim(tok, 300, () => {}); }
  Tb('縱軸想成時間：每條邊都往下一層');
  say('縱軸想成時間', '每條邊都從這一層走到下一層');
  await step(tok);                                   // 2880.8 follow an edge, go down a layer: acyclic
  const hop = tag('走一步', 'pkt', XV.s, Y(0) + 0.5, 0.6);
  const path = [['s', 0], ['b', 1], ['a', 2], ['v', 3]];
  for (let i = 1; i < path.length; i++) await travel(tok, hop, V3(XV[path[i - 1][0]], Y(i - 1) + 0.5, 0.6), V3(XV[path[i][0]], Y(i) + 0.5, 0.6), 500);
  remove(hop);
  ok('只會往下：任何圖都變 acyclic', 3.4, 0.6);
  say('每走一條邊就往下一層', '永遠回不去 → 無環');
  await step(tok);                                   // 2910.8 define δₖ(s,v)
  Tb('新子問題：δₖ(s,v)');
  say('定義新的子問題 δₖ(s,v)');
  await step(tok);                                   // 2920.8 the shortest s→v path using at most k edges
  Tb('δₖ(s,v) = 最多用 k 條邊的最短路徑權重');
  say('s 到 v、最多用 k 條邊', '的最短路徑權重');
  await step(tok);                                   // 2944.8 s up here, v in the 0 situation
  glow(L[0].s, GOLD); glow(L[0].v, GOLD);
  say('起點固定在第 0 層的 s', '看第 0 層的 v');
  await step(tok);                                   // 2967.8 no way to get there in zero edges
  tag('∞', 'bad', XV.v + 0.8, Y(0));
  say('0 條邊到不了 v', 'δ₀(s,v) = ∞');
  await step(tok);                                   // 2972.8 the best way with at most one edge
  glow(L[0].v, null); glow(L[1].v, GOLD);
  say('第 1 層的 v', '最多 1 條邊的最佳走法');
  await step(tok);                                   // 2977.8 add vertical edges: at most two edges
  for (let k = 0; k < 3; k++) for (const u of VS) link([XV[u] + 0.25, Y(k), -0.3], [XV[u] + 0.25, Y(k + 1), -0.3], '#d8cfc0', 0.35);
  glow(L[1].v, null); glow(L[2].v, GOLD);
  note('加上縱向的邊：原地等一層 → 「最多」k 條', 4.0, 7.3);
  say('再加上縱向的邊', '第 2 層的 v：最多 2 條邊');
  await step(tok);                                   // 2986.8 a recurrence: min over all last edges
  glow(L[2].v, null);
  Fm('δₖ(s,v) = min over (u,v) of δₖ₋₁(s,u) + w(u,v)');
  say('遞迴式：對最後一條邊取 min');
  await step(tok);                                   // 2995.8 the s→u part uses one fewer edge
  glow(L[3].v, GOLD); glow(L[2].a, GOLD);
  link([XV.a, Y(2), 0.4], [XV.v, Y(3), 0.4], C.teal, 0.45);
  say('s 到 u 那段少用一條邊', '再走 (u, v) 這條');
  await step(tok);                                   // 3006.8 the k parameter makes it acyclic
  ok('加了 k：依賴無環', -3.6, 0.6);
  say('加了 k 這個參數', '子問題的依賴就無環了');
  await step(tok);                                   // 3016.8 more subproblems: V²
  glow(L[3].v, null); glow(L[2].a, null);
  Tb('代價：子問題變成 V² 個');
  say('代價是子問題變多', 'V² 個');
  await step(tok);                                   // 3033.8 the goal: δ_{V−1}(s,v)
  VS.forEach((u) => glow(L[3][u], GOLD));
  tag('V−1 層', 'ptr alt', 6.1, Y(3));
  say('目標：k = V−1 的 δₖ(s,v)', '這張圖 V = 4 → 最後一層 k = 3');
  await step(tok);                                   // 3045.8 simple paths only, no negative weight cycles
  note('沒有負環 → 只需 simple path（≤ V−1 條邊）', -2.4, 7.3);
  say('假設沒有負環', '最短路徑是 simple path，最多 V−1 條邊');
  await step(tok);                                   // 3057.8 V choices of k × V choices of v
  VS.forEach((u) => glow(L[3][u], null));
  for (let k = 0; k <= 3; k++) { VS.forEach((u) => glow(L[k][u], GOLD)); await anim(tok, 220, () => {}); VS.forEach((u) => glow(L[k][u], null)); }
  Fm('子問題數：k 有 V 種 × v 有 V 種 = V²');
  say('k 有 V 種、v 有 V 種', 'V² 個子問題');
  await step(tok);                                   // 3064.8 time per subproblem: the in-degree
  Fm('每題時間 = indeg(v)');
  say('每題時間跟之前一樣', 'v 的 indegree');
  await step(tok);                                   // 3071.8 sum over v of in-degree, times V
  Fm('總時間 = V × Σ indeg(v) = Θ(VE)');
  say('對 v 加總 indegree，再乘 V', 'Θ(VE)');
  await step(tok);                                   // 3078.8 Bellman-Ford again
  Tb('Θ(VE)：這就是 Bellman-Ford！');
  say('聽起來很熟？', '這就是 Bellman-Ford');
  await step(tok);                                   // 3088.8 this is where Bellman-Ford came from
  Tb('Bellman-Ford 本來就是從這個 DP 觀點來的');
  say('Bellman-Ford 本來就是', '從這個 DP 觀點發明的');
  await step(tok);                                   // 3097.8 next lectures: more problems the same way
  Fm('下三講：更多問題用同一招');
  say('接下來三講', '更多問題都能用同一招解');
}]);

// ════════════════ ENyox7kNKeY（MIT 6.006 L20 / 2011：DP II） ════════════════
// Cued copies of the module's built-in scenes (dp-recipe, dp-dag, dp-five-steps, textjust-*, blackjack-*):
// each section gets its own scene so every sentence moves the picture once.
const TW = 10, CWD = 0.55;                             // text justification：頁寬 W = 10（示意），每個字元寬 0.55
const TWORDS = ['the', 'cat', 'is', 'happy'];
const tLen = (i, j) => TWORDS.slice(i, j).reduce((s, w) => s + w.length, 0) + (j - i - 1);
const tBad = (i, j) => (tLen(i, j) > TW ? Infinity : (TW - tLen(i, j)) ** 3);
const fmt = (v) => (v === Infinity ? '∞' : String(v));
// DP over the four words: DP[i] = min over j of badness(i, j) + DP[j]
const TJD = (() => {
  const n = TWORDS.length, D = new Array(n + 1).fill(0), par = new Array(n + 1).fill(null), tries = [];
  for (let i = n - 1; i >= 0; i--) {
    D[i] = Infinity; tries[i] = [];
    for (let j = i + 1; j <= n; j++) { const b = tBad(i, j), v = b + D[j]; tries[i].push({ j, b, v }); if (v < D[i]) { D[i] = v; par[i] = j; } }
  }
  return { D, par, tries };
})();
// words laid out on a line from x0 (one char = CWD), returns the cubes
function wordLine(ws, x0, y, color, drop = 1.0, z = 0) {
  let x = x0;
  return ws.map((w) => { const len = w.length * CWD; const m = box(w, color, x + len / 2, y, len - 0.06, 0.55, 0.4, drop, z); x += len + CWD; return m; });
}
// a page of `rows` lines with its right margin (red) at x0 + W
function page(x0, y0, rows, title) {
  cube('', '#f6efe2', [TW * CWD + 0.4, rows * 1.0 + 0.5, 0.06], x0 + TW * CWD / 2, y0 - (rows - 1) * 0.5, -0.3);
  const m = cube('', C.red, [0.05, rows * 1.0 + 0.7, 0.05], x0 + TW * CWD, y0 - (rows - 1) * 0.5, 0.1);
  if (title) tag(title, 'ptr', x0 + TW * CWD / 2, y0 + 0.85);
  return m;
}
const BJN = (c) => (c === 1 ? 'A' : String(c));
const cardM = (c, x, y, z = 0, hidden = false, drop = 0) => box(hidden ? '?' : BJN(c), hidden ? '#b8a98a' : '#fbf7f0', x, y, 0.62, 0.86, 0.06, drop, z);
const BJ = bjSolve(DECK);                              // 模組裡的示意牌堆：9 10 2 7 10 10 8 9 10 6 5 10

// 00:22 複習：DP = carefully executed brute force；guessing、recursion、memoization
FRAG.push(['dpmit1-recipe-a', '複習：DP = 小心執行的暴力搜尋', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.6, 0]);
  const Tb = board(0.4, 7.9, 0, 'ptr'), P = pile();
  await step(tok);                                   // 22.3 we continue into dynamic programming
  const dp = buddy('DP', '', C.teal, -5.8, 0, 1.4, 1.0); dp.mood('happy');
  Tb('繼續：dynamic programming');
  say('今天繼續 DP');
  await dp.hop(tok);
  await step(tok);                                   // 36.8 especially for optimization: max or min
  bubble('最佳化：maximize / minimize', -5.8, 2.6, 1.4);
  say('設計演算法的強大技巧', '特別適合最佳化問題');
  await step(tok);                                   // 44.3 last time: Fibonacci and Bellman-Ford
  P(box('Fibonacci', C.purple, -1.6, 5.8, 2.6, 0.7, 0.5, 1.2)); P(box('Bellman-Ford', C.blue, 2.4, 5.8, 2.8, 0.7, 0.5, 1.2));
  say('上次：Fibonacci 與 Bellman-Ford');
  await step(tok);                                   // 55.9 dynamic programs in disguise
  P(note('其實都是偽裝的 DP', 0.4, 4.7));
  say('它們其實都是 DP', 'Bellman-Ford 就是這樣發明的');
  await step(tok);                                   // 68.8 a general technique in five easy steps
  P.clear();
  for (let k = 0; k < 5; k++) P(box('步驟 ' + (k + 1), LV[k], -2.8 + k * 1.75, 5.8, 1.5, 0.8, 0.6, 1.2));
  Tb('今天：DP 的五個步驟');
  say('今天：五個「簡單」步驟');
  await step(tok);                                   // 79.9 text justification: where to break lines
  P(box('text justification', C.orange, -1.6, 4.0, 3.4, 0.7, 0.5, 1.2));
  say('新問題一：text justification', '段落要在哪裡換行');
  await step(tok);                                   // 83.8 how to win at blackjack
  P(box('blackjack', C.red, 2.8, 4.0, 2.4, 0.7, 0.5, 1.2));
  say('新問題二：blackjack', '怎麼贏最多錢');
  await step(tok);                                   // 103.8 a carefully executed brute force search
  P.clear();
  const rows = [];
  for (let d = 0; d < 5; d++) {
    const cnt = 2 ** d, sp = Math.min(1.3, 10.4 / cnt), row = [];
    for (let k = 0; k < cnt; k++) row.push(box('', LV[d], 0.6 + (k - (cnt - 1) / 2) * sp, 6.6 - d * 1.0, Math.min(0.9, sp * 0.75), 0.36, 0.36, 1.2));
    rows.push(row);
    await anim(tok, 200, () => {});
  }
  Tb('DP = carefully executed brute force search');
  say('DP = 小心執行的暴力搜尋', '試遍所有可能');
  await step(tok);                                   // 113.8 exponentially many of them
  const ex = no('可能性：指數多個', 3.6, 1.2);
  dp.mood('sad');
  say('可能性有指數多個');
  await step(tok);                                   // 117.8 reduce the search space to polynomial
  const flat = rows.flat();
  flat.forEach((m, k) => { if (k < 6) move(m, -3.4 + k * 1.5, 3.6, 0); else fly(m, V3(0, 6, 3)); });
  kill(ex);
  await anim(tok, 500, () => {});
  flat.slice(0, 6).forEach((m) => { m.scale.set(1.4, 1.7, 1.6); tint(m, C.teal); });
  dp.mood('happy');
  say('聰明地想：把指數的搜尋空間', '縮成多項式');
  await step(tok);                                   // 131.8 three main techniques: guessing
  const tech = [['guessing', '猜'], ['recursion', '遞迴'], ['memoization', '記住']].map(([t, z], k) => P(box(t + '（' + z + '）', LV[k + 1], -4.0 + k * 4.0, 1.6, 3.2, 0.7, 0.5, 1.2)));
  glow(tech[0], GOLD);
  say('三個主要技巧', '第一個：guessing');
  await step(tok);                                   // 145.3 guess: try all possibilities, take the best
  P(note('不知道 → 全部試，取最好', -4.0, 0.7));
  say('想知道解的某個特徵', '不知道就全部試、取最好的');
  await step(tok);                                   // 157.7 recursion: in terms of subproblems
  glow(tech[0], null); glow(tech[1], GOLD);
  P(note('用子問題的解表示答案', 0, 0.7));
  say('第二個：recursion', '用子問題的解表示答案');
  await step(tok);                                   // 178.9 recursion alone is exponential: add memoization
  glow(tech[1], null); glow(tech[2], GOLD);
  say('只有遞迴通常是指數時間', '加上 memoization');
  await step(tok);                                   // 193.6 write it down on the memo pad
  P(note('算過的寫在 memo pad 上', 4.0, 0.7));
  say('算過的答案都記下來', '再需要就查，不重算');
  await step(tok);                                   // 205.8 memo → polynomial; guessing = brute force
  glow(tech[2], null);
  Tb('memo 讓遞迴變多項式；guessing 是暴力搜尋的部分');
  say('memoization 讓遞迴變多項式', 'guessing 是暴力搜尋的部分');
}]);

// 03:38 另一個角度：DP = DAG 上的最短路徑
FRAG.push(['dpmit1-dag-a', 'DP = DAG 上的最短路徑', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.9, 0, 'ptr');
  const X = (i) => -4.8 + i * 2.4, Y = 3.0;
  await step(tok);                                   // 217.3 another, orthogonal perspective
  Tb('另一個角度（跟剛才的正交）');
  say('另一個角度看 DP');
  await step(tok);                                   // 234.8 DP is computing shortest paths in a DAG
  const N = [];
  for (let i = 0; i <= 4; i++) N.push(box(String(i), C.blue, X(i), Y, 0.8, 0.8, 0.6, 1.2));
  const E = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j <= 4; j++) E.push({ i, j, h: arc(V3(X(i), Y + 0.45, 0), V3(X(j), Y + 0.45, 0), 0.5 + 0.35 * (j - i), '#c9b48e') });
  Tb('DP 其實是在算 DAG 上的最短路徑');
  say('DP 某種意義上', '永遠是在算 DAG 上的最短路徑');
  await step(tok);                                   // 240.0 e.g. split text into lines
  wordLine(TWORDS, -4.6, 6.6, C.orange, 1.0);
  tag('（字為示意）', 'idx', 3.6, 6.6);
  say('例如：把文字切成好看的行');
  await step(tok);                                   // 244.8 express the problem as a DAG
  for (let i = 0; i < 4; i++) tag('word ' + i + ' 前', 'idx', X(i), Y - 0.8);
  tag('結尾', 'idx', X(4), Y - 0.8);
  note('節點 = 從哪個字開始；邊 i→j = 一行放 word i … j−1', 0, 1.2);
  say('把問題表示成有向無環圖', '節點：從哪個字開始；邊：一行');
  await step(tok);                                   // 253.3 shortest paths in a DAG in linear time
  for (const [a, b] of [[0, 2], [2, 4]]) { arc(V3(X(a), Y + 0.5, 0.35), V3(X(b), Y + 0.5, 0.35), 0.5 + 0.35 * (b - a), C.teal); }
  [0, 2, 4].forEach((i) => { tint(N[i], C.teal); glow(N[i], GREEN); });
  say('DAG 最短路徑：線性時間就能算');
  await step(tok);                                   // 260.8 a new, experimental perspective
  bubble('老師上週才想到的新角度', 4.4, 5.4);
  say('這是個新的、實驗性的角度');
  await step(tok);                                   // 270.6 clever DAG setup, simple algorithm
  Tb('巧思在怎麼設定 DAG；演算法本身很簡單');
  say('巧思在怎麼設定這個 DAG', '設好之後演算法很簡單');
}]);

// 04:47 總時間 = 子問題數 × 每題時間；遞迴呼叫當作免費（像攤銷）
FRAG.push(['dpmit1-recipe-b', '總時間 = 子問題數 × 每題時間', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.9, 0, 'ptr'), Fm = board(0, 0.6, 0.6, 'ptr alt');
  const X = (k) => -4.5 + k * 1.5;
  await step(tok);                                   // 286.7 generalize into many subproblems
  Tb('把真正的問題推廣成很多子問題');
  say('把要解的問題推廣成很多子問題');
  await step(tok);                                   // 293.4 Fibonacci: we want the nth number
  const want = buddy('想要的', 'Fₙ', C.purple, 5.2, 3.2, 0.6, 0.9); want.mood('wow');
  say('像 Fibonacci：真正想要的只有 Fₙ');
  await step(tok);                                   // 300.8 along the way we compute f1 … fn
  const F = [];
  for (let k = 0; k < 6; k++) { F.push(box(k === 5 ? 'Fₙ' : k === 4 ? '…' : 'F' + (k + 1), k === 4 ? GRAY : C.blue, X(k), 4.6, 1.2, 0.7, 0.5, 1.2)); await anim(tok, 180, () => {}); }
  say('但過程中會算出 F₁ … Fₙ');
  await step(tok);                                   // 304.1 those are subproblems: time × number
  F.forEach((m, k) => k !== 4 && glow(m, GOLD));
  Fm('總時間 = 子問題數 × 每題時間');
  say('這些就是子問題', '總時間 = 子問題數 × 每題時間');
  await step(tok);                                   // 311.8 a general true fact
  F.forEach((m) => glow(m, null));
  ok('普遍成立', 3.6, 1.4);
  say('這是普遍成立的事實');
  await step(tok);                                   // 317.8 recursive calls count as free
  for (let k = 1; k < 6; k++) if (k !== 4) tag('O(1)', 'idx', X(k), 3.7);
  say('式子裡的遞迴呼叫', '都當作 O(1)');
  await step(tok);                                   // 329.8 the second time it's memoized
  const coin = await pkt(tok, '第二次：查 memo', V3(X(1), 2.8, 0.6), V3(X(3), 2.8, 0.6), 800);
  want.mood('happy');
  say('只有第一次要付', '第二次已經 memo 了，不用付');
  await step(tok);                                   // 336.0 like amortization in table doubling
  remove(coin);
  note('像 table doubling 的 amortization：換個時間點算成本', 0, 2.2);
  say('就像 table doubling 的攤銷', '只是換個地方算成本');
}]);

// 06:14 DP 的五個步驟
FRAG.push(['dpmit1-five-a', 'DP 的五個步驟', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.8, 0]);
  const Tb = board(0, 7.9, 0, 'ptr');
  const Y = (k) => 6.5 - k * 1.25, S = [];
  const put = (k, t, c) => { S[k] = box(t, c, -3.2, Y(k), 4.2, 0.8, 0.6, 1.2); };
  await step(tok);                                   // 373.7 not necessarily sequential, interdependent
  for (let k = 0; k < 5; k++) { cube('', '#efe6d2', [4.4, 0.95, 0.06], -3.2, Y(k), -0.2); tag(String(k + 1), 'ptr', -5.8, Y(k)); }
  Tb('五個「簡單」步驟（不一定照順序，互相牽動）');
  say('五個步驟不一定照順序', '彼此有點互相依賴');
  await step(tok);                                   // 380.8 how to express, invent, explain a DP
  note('寫出、發明、解釋一個 DP 的方式', 3.8, 6.5);
  say('這是表達一個 DP 的方式', '也是發明、解釋它的方式');
  await step(tok);                                   // 402.7 1. define subproblems
  put(0, '1 定義子問題', C.purple);
  say('第 1 步：定義子問題');
  await step(tok);                                   // 408.3 2. guess something
  put(1, '2 猜（guess）', C.blue);
  say('第 2 步：猜某件事');
  await step(tok);                                   // 411.0 3. relate subproblem solutions: recurrence
  put(2, '3 遞迴式：關聯子問題', C.cyan);
  say('第 3 步：用遞迴式把子問題的解關聯起來');
  await step(tok);                                   // 422.7 4. build an algorithm
  put(3, '4 建出演算法', C.orange);
  say('第 4 步：真正建出演算法');
  await step(tok);                                   // 441.8 recursion + memoization
  const r = box('遞迴 + memo', C.teal, 2.2, Y(3) + 0.3, 2.4, 0.6, 0.5, 1.2);
  say('一種：遞迴 + memoization', '老師喜歡的想法');
  await step(tok);                                   // 446.6 or bottom-up: building a table
  const b = box('bottom-up 建表', C.gold, 2.2, Y(3) - 0.5, 2.4, 0.6, 0.5, 1.2);
  say('另一種：bottom-up', '通常叫「建表」');
  await step(tok);                                   // 460.8 a bunch of for loops
  code(['for … :', '  for … :', '    DP[…] = …'], 5.4, Y(3) + 0.4, 0.42);
  say('把遞迴 + memo 變成一堆 for 迴圈', '更實際、更快');
  await step(tok);                                   // 475.9 same running time
  glow(r, GOLD); glow(b, GOLD);
  ok('worst case 時間一樣', 3.8, Y(3) - 1.3);
  say('兩種做法', 'worst case 執行時間差不多一樣');
  await step(tok);                                   // 487.6 5. solve the original problem
  glow(r, null); glow(b, null);
  put(4, '5 解出原問題', C.pink);
  say('第 5 步：解出原本的問題');
  await step(tok);                                   // 501.8 a convenient table ("cheating")
  bubble('事先寫好的對照表（「作弊」）', 3.8, 5.0);
  say('老師準備了一張對照表');
  await step(tok);                                   // 510.2 Fibonacci and shortest paths
  tag('Fibonacci', 'ptr alt', 1.6, 7.2); tag('shortest paths', 'ptr alt', 4.8, 7.2);
  say('用上次的兩個例子對照', 'Fibonacci、shortest paths');
}]);

// 08:40 對照表：子問題數、猜幾種、遞迴式、每題時間
FRAG.push(['dpmit1-five-b', '對照表：子問題、猜、遞迴式、每題時間', async (tok) => {
  fresh([0, 4.4, 14.5], [0.3, 3.8, 0]);
  const rows = ['1 子問題', '2 猜', '3 遞迴式', '每題時間'], Y = (k) => 6.3 - k * 1.55, XF = -0.8, XS = 4.0;
  rows.forEach((t, k) => { cube('', '#e2d4b8', [2.2, 1.2, 0.06], -4.9, Y(k), -0.2); tag(t, 'ptr', -4.9, Y(k)); cube('', C.paper, [4.0, 1.3, 0.06], XF, Y(k), -0.2); cube('', C.paper, [4.6, 1.3, 0.06], XS, Y(k), -0.2); });
  tag('Fibonacci', 'ptr alt', XF, 7.5); tag('shortest paths', 'ptr alt', XS, 7.5);
  const cell = (t, x, y, cls = '') => tag(t, cls, x, y, 0.1);
  await step(tok);                                   // 520.3 Fibonacci subproblems: f1 … fn
  cell('F₁ … Fₙ', XF, Y(0) + 0.25);
  say('Fibonacci 的子問題：F₁ … Fₙ');
  await step(tok);                                   // 527.2 n of them: count the subproblems
  cell('n 個', XF, Y(0) - 0.3, 'note');
  say('共 n 個', '第 1 步要數子問題有幾個');
  await step(tok);                                   // 556.8 shortest paths: δₖ(s,v)
  cell('δₖ(s,v)', XS, Y(0) + 0.25);
  say('最短路徑：δₖ(s,v)');
  await step(tok);                                   // 563.8 the shortest s→v path with at most k edges
  cell('最多 k 條邊的最短路徑', XS, Y(0) - 0.3, 'idx');
  say('s 到 v、最多用 k 條邊的最短路徑');
  await step(tok);                                   // 571.6 V² subproblems
  cell('V² 個', XS + 1.6, Y(0) + 0.25, 'note');
  say('每個 v、每個 k = 0 … V−1', 'V² 個子問題');
  await step(tok);                                   // 592.2 2. guess some feature of the solution
  say('第 2 步：猜解的某個特徵');
  cube('', C.gold, [0.25, 0.25, 0.25], -6.2, Y(1), 0.1);
  await step(tok);                                   // 599.8 Fibonacci: no guessing, 1 choice
  cell('不用猜（1 種）', XF, Y(1));
  say('Fibonacci：不用猜', '選擇只有 1 種');
  await step(tok);                                   // 614.8 shortest paths: guess the last edge
  cell('最後一條邊 (u, v)', XS, Y(1) + 0.25);
  say('最短路徑：猜最後一條邊 (u, v)');
  await step(tok);                                   // 633.7 indegree(v) choices (+1)
  cell('indeg(v) + 1 種', XS, Y(1) - 0.3, 'note');
  say('有 indegree(v) 種選擇', '+1 是沒有邊的情形');
  await step(tok);                                   // 646.8 write down the number of choices
  bubble('分析：寫下猜測有幾種', -2.4, Y(1) - 0.8);
  say('分析時要寫下猜測有幾種');
  await step(tok);                                   // 664.3 3. the recurrence
  cube('', C.gold, [0.25, 0.25, 0.25], -6.2, Y(2), 0.1);
  say('第 3 步：遞迴式');
  await step(tok);                                   // 673.8 Fibonacci: just the definition
  cell('Fₙ = Fₙ₋₁ + Fₙ₋₂', XF, Y(2));
  say('Fibonacci：就是定義本身');
  await step(tok);                                   // 678.6 shortest paths: a min (usually min or max)
  cell('δₖ(s,v) = min{ … }', XS, Y(2) + 0.3);
  say('最短路徑：取 min', '遞迴式通常是 min 或 max');
  await step(tok);                                   // 690.8 δ_{k−1}(s,u): one fewer edge
  cell('δₖ₋₁(s,u)：少用一條邊', XS, Y(2) - 0.2, 'idx');
  say('s 到 u 那段', '因為猜了最後一條邊，少用一條');
  await step(tok);                                   // 720.8 plus the weight of (u, v)
  cell('+ w(u,v)', XS + 1.7, Y(2) - 0.45, 'idx');
  say('再加上 (u, v) 的權重', '就是整條路徑的成本');
  await step(tok);                                   // 731.8 considering all possible paths
  bubble('試所有入邊 = 考慮所有可能的路徑', XS, Y(2) - 0.85);
  say('每條入邊都試', '等於考慮了所有可能的路徑');
  await step(tok);                                   // 755.3 slow, but memoization makes it fast
  ok('加 memo 就快', XF, Y(2) - 0.45);
  say('直接遞迴很慢', '加上 memoization 就快了');
  await step(tok);                                   // 759.6 time per subproblem: Fibonacci O(1)
  cell('O(1)', XF, Y(3));
  say('每題時間（遞迴呼叫算免費）', 'Fibonacci：O(1)');
  await step(tok);                                   // 767.8 shortest paths: indegree(v)
  cell('O(indeg(v))', XS, Y(3) + 0.2);
  say('最短路徑：min 裡有 indegree(v) 項');
  await step(tok);                                   // 780.3 constant work per guess
  cell('每個猜測 O(1)', XS, Y(3) - 0.35, 'note');
  say('每個猜測 O(1)', '猜測數 ≈ 每題時間（常見）');
}]);

// 13:49 第 4 步：拓樸順序；第 5 步：原問題；總時間
FRAG.push(['dpmit1-dag-b', '拓樸順序、總時間、原問題', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  const Tb = board(0, 8.0, 0, 'ptr');
  const xs = (k) => -4.8 + k * 1.6, fy = 6.6;
  const V = ['s', 'a', 'b', 'c'], GX = (c) => -1.4 + c * 1.5, GY = (k) => 3.8 - k * 0.85;
  await step(tok);                                   // 829.2 the subproblem recurrence must be acyclic
  Tb('第 4 步要確認：子問題的遞迴式無環');
  say('第 4 步：確認子問題的遞迴', '是 acyclic（無環）');
  await step(tok);                                   // 844.6 i.e. it has a topological order
  Tb('有環？沒有 → 就有 topological order');
  say('也就是有拓樸順序');
  await step(tok);                                   // 855.8 Fibonacci: smallest to biggest
  const F = [];
  for (let k = 0; k < 7; k++) F.push(box('F' + (k + 1), GRAY, xs(k), fy, 0.9, 0.6, 0.5, 1.2));
  for (let k = 1; k < 7; k++) { link([xs(k - 1), fy, 0.3], [xs(k), fy, 0.3], C.gold, 0.5); if (k >= 2) arc(V3(xs(k - 2), fy + 0.35, 0.3), V3(xs(k), fy + 0.35, 0.3), 0.7, C.sand); }
  say('Fibonacci：從最小的算到最大的');
  for (let k = 0; k < 7; k++) { tint(F[k], C.teal); await anim(tok, 150, () => {}); }
  await step(tok);                                   // 858.8 the reverse fails
  no('反過來不行：Fₙ 要的還沒算', 4.6, 5.4);
  say('反過來不行', '算 Fₙ 時 Fₙ₋₁、Fₙ₋₂ 還沒有');
  await step(tok);                                   // 872.8 every node depends on the previous two
  F.forEach((m) => glow(m, GOLD));
  say('這是個 DAG', '每個節點依賴前兩個');
  await step(tok);                                   // 885.8 topological order left → right = the for loop
  F.forEach((m) => glow(m, null));
  bubble('拓樸順序 = bottom-up 的 for 迴圈', -2.0, 5.4);
  say('拓樸順序：由左往右', '這就是 bottom-up 的 for 迴圈');
  await step(tok);                                   // 895.8 shortest paths: k outer, v inner
  V.forEach((v, c) => tag(v, 'ptr', GX(c), GY(0) + 0.75));
  const g = [];
  for (let k = 0; k < 4; k++) { tag('k=' + k, 'idx', GX(0) - 1.1, GY(k)); g.push(V.map((_, c) => box('', C.cell, GX(c), GY(k), 1.2, 0.65, 0.3))); }
  for (let k = 0; k < 4; k++) { g[k].forEach((m) => { tint(m, C.teal); }); await anim(tok, 300, () => {}); }
  say('最短路徑：k 在外層、v 在內層', '一整層 k 算完才換下一層');
  await step(tok);                                   // 899.8 the reverse does not work
  no('v 外 k 內：不行', 5.0, GY(1));
  say('反過來（v 外 k 內）不行', 'δₖ 需要整個 δₖ₋₁ 層');
  await step(tok);                                   // 909.8 overall time: multiply the two
  Tb('總時間 = 子問題數 × 每題時間');
  say('總時間：子問題數 × 每題時間');
  await step(tok);                                   // 929.8 5. solve the original problem
  Tb('第 5 步：確認原本的問題被解出來');
  say('第 5 步：確認原本的問題有被解出來');
  await step(tok);                                   // 954.2 Fibonacci: Fn
  glow(F[6], GREEN); tag('答案 Fₙ', 'good', xs(6), fy + 1.0);
  say('Fibonacci：答案就是 Fₙ', '它本身就是子問題之一');
  await step(tok);                                   // 962.1 shortest paths: δ_{V−1}(s,v) for all v
  g[3].forEach((m) => glow(m, GREEN));
  ok('答案：δₖ(s,v)，k = V−1，每個 v', 5.2, GY(3));
  say('最短路徑：每個 v 的 δₖ(s,v)，k = V−1', '沒有負環時就是答案');
  await step(tok);                                   // 976.8 sometimes combining takes extra time
  note('有時要花額外時間把子問題的解組合起來', -3.4, 0.2);
  say('有時要額外時間組合答案', '這兩個例子直接就有');
  await step(tok);                                   // 997.7 total: n and VE
  tag('Θ(n)', 'ptr alt', 6.3, fy); tag('Θ(VE)', 'ptr alt', 5.2, 4.2);
  say('總時間', 'Fibonacci Θ(n)、最短路徑 Θ(VE)');
}]);

// 17:07 Text justification：badness(i, j) = ∞ 或 (W − 總長)³；greedy 不是最佳
FRAG.push(['dpmit1-tj-badness', 'Text justification：badness 與 greedy', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, 0.5, 0.6, 'ptr alt'), P = pile();
  const L = -6.1, R = 0.6;
  await step(tok);                                   // 1027.2 the first problem: text justification
  const pen = prop('file', -5.8, 0.1, 2.2, 1.3, '排版'); bob(pen, 0.05);
  Tb('Text justification：把文字排成段落');
  say('第一個問題：text justification');
  await step(tok);                                   // 1041.1 given some text: a string
  const strip = wordLine(TWORDS, -3.2, 6.6, C.orange, 1.0);
  tag('（示意：4 個字）', 'idx', 4.4, 6.6);
  say('給一段文字', '一串字元、很多個字');
  await step(tok);                                   // 1049.9 split it into good lines
  page(L, 4.8, 2, 'Greedy（舊版 Word）'); page(R, 4.8, 2, '');
  tag('頁寬 W = 10', 'idx', R + TW * CWD + 0.2, 6.0);
  say('想切成好看的幾行');
  await step(tok);                                   // 1071.4 cut only between word boundaries
  for (let k = 0; k < 3; k++) P(tag('✂', 'pkt', strip[k].position.x + TWORDS[k].length * CWD / 2 + CWD / 2, 7.25));
  say('只能在字與字之間斷行');
  await step(tok);                                   // 1085.8 justify the text on the right
  P.clear();
  say('文字要對齊右邊（紅線）');
  await step(tok);                                   // 1089.3 avoid big gaps: ugly
  const gapEx = ghostBox(C.red, 2.2, 0.6, 0.5); gapEx.position.set(R + 4.4, 1.6, 0);
  P(no('大空隙：難看', R + 4.4, 2.3));
  say('想避免很大的空隙', '難看又難讀');
  await step(tok);                                   // 1101.9 Word: greedy, pack as many words as you can
  kill(gapEx); P.clear();
  const g1 = wordLine(['the', 'cat', 'is'], L, 4.8, C.orange, 1.2);
  say('Greedy：第一行塞越多字越好', '再換下一行');
  await step(tok);                                   // 1109.8 not optimal; LaTeX uses DP
  wordLine(['happy'], L, 3.8, C.orange, 1.2);
  tag('DP（LaTeX）', 'ptr', R + TW * CWD / 2, 5.65);
  say('這樣不是最佳的', 'LaTeX 用 DP 來排');
  await step(tok);                                   // 1133.3 text = a list of words
  strip.forEach((m, k) => tag('word ' + k, 'idx', m.position.x, 7.3));
  say('把文字看成一串 words', 'word 0, word 1, …');
  await step(tok);                                   // 1140.8 define badness
  Tb('badness(i, j)：這些字排成一行有多糟');
  say('定義 badness：美觀程度');
  await step(tok);                                   // 1162.4 words i through j as a line
  strip.forEach((m, k) => glow(m, k >= 1 && k < 3 ? GOLD : null));
  Fm('badness(i, j)：把 words[i:j] 放成一行');
  say('把 word i 到 j 放成一行', '例：i = 1, j = 3');
  await step(tok);                                   // 1176.1 Python notation: i … j − 1
  note('Python 記法：words[i:j] = word i … j−1', 3.6, 5.6);
  say('Python 記法：從 i 到 j−1');
  await step(tok);                                   // 1196.8 doesn't fit → infinity
  strip.forEach((m, k) => glow(m, k >= 1 ? RED : null));
  Fm('cat is happy：3+1+2+1+5 = 12 > 10 → badness = ∞');
  say('放不下：badness = ∞', '絕對不要這樣（LaTeX sloppy mode）');
  await step(tok);                                   // 1207.7 how wide the line can be
  say('字長加最小空白', '跟頁寬比');
  await step(tok);                                   // 1233.8 otherwise (page width − total width)³
  strip.forEach((m) => glow(m, null));
  Fm('放得下：badness = (W − 總寬)³');
  say('放得下：(頁寬 − 總寬)³', '總寬要算字之間的空白');
  await step(tok);                                   // 1252.2 why cubed? LaTeX's rule
  note('為什麼三次方？LaTeX 的規則；平方也可以', -2.6, 1.3);
  say('為什麼是三次方？', 'LaTeX 的規則，平方大概也行');
  await step(tok);                                   // 1268.0 close to the width → near 0
  tag('(10−10)³ = 0', 'good', L + 2.75, 4.3);
  say('幾乎填滿：接近 0', '很好');
  await step(tok);                                   // 1279.3 much shorter → huge
  tag('(10−5)³ = 125', 'bad', L + 2.75, 3.2);
  say('空很多：值很大', '三次方之後更大');
  await step(tok);                                   // 1291.8 leave out a word to make the next line better
  wordLine(['the', 'cat'], R, 4.8, C.teal, 1.2); wordLine(['is', 'happy'], R, 3.8, C.teal, 1.2);
  tag('(10−7)³ = 27', 'idx', R + 2.75, 4.3); tag('(10−8)³ = 8', 'idx', R + 2.75, 3.2);
  say('第一行少放一個字', '下一行好很多');
  await step(tok);                                   // 1310.8 minimize the sum of the badnesses
  tag('總和 125', 'bad', L + 2.75, 2.5); tag('總和 35', 'good', R + 2.75, 2.5);
  Fm('目標：所有行的 badness 總和最小');
  say('目標：所有行的 badness 總和最小', 'greedy 125，DP 35');
}]);

// 22:12 子問題 = suffix words[i:]：只有 n 個
FRAG.push(['dpmit1-tj-suffix', 'Text justification：子問題 = suffix', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, 0.4, 0.6, 'ptr alt');
  const X = (i) => -4.8 + i * 2.4, WY = 5.6;
  const W = TWORDS.map((w, i) => box(w, C.orange, X(i), WY, w.length * 0.38 + 0.5, 0.6, 0.45));
  TWORDS.forEach((_, i) => tag('word ' + i, 'idx', X(i), WY + 0.65));
  await step(tok);                                   // 1332.1 defining subproblems: the hard part
  Tb('第 1 步：定義子問題（最難的部分）');
  say('第一步：定義子問題', '最難的部分');
  await step(tok);                                   // 1338.1 what would brute force do?
  const me = buddy('', '?', C.sky, 5.9, 0.0, 1.8, 0.8); me.mood('wow');
  say('先想：暴力法怎麼試遍所有可能？');
  await step(tok);                                   // 1364.3 try all partitions of the words
  say('試所有的切法');
  const sw = TWORDS.map((_, i) => tag(i ? '換行？' : '開頭', 'note', X(i) - 0.9, WY - 0.9));
  await step(tok);                                   // 1374.8 for every word: does it start a line?
  for (let r = 0; r < 8; r++) { for (let i = 1; i < 4; i++) txt(sw[i], (r >> (i - 1)) & 1 ? '換行 ✓' : '不換'); await anim(tok, 220, () => {}); }
  say('每個字：要不要從它開新的一行？');
  await step(tok);                                   // 1381.8 2ⁿ different splits
  Fm('n 個字 → 2ⁿ 種切法');
  me.mood('sad');
  say('n 個字 → 2ⁿ 種切法', '指數多');
  await step(tok);                                   // 1416.3 guess how long the first line is
  sw.forEach(remove); Fm('');
  me.mood('calm');
  say('換個想法：猜第一行有多長');
  await step(tok);                                   // 1417.8 word 0 begins a line: where does line 2 begin?
  glow(W[0], GREEN);
  tag('第 1 行從這開始', 'good', X(0), WY - 0.9);
  say('第 0 個字一定開頭', '第二行從哪個字開始？');
  await step(tok);                                   // 1438.8 try all words after the first
  const tries = [];
  for (let j = 1; j <= 3; j++) { tries.push(arc(V3(X(0), WY - 0.4, 0.3), V3(X(j), WY - 0.4, 0.3), -0.6 - 0.25 * j, C.sand)); glow(W[j], GOLD); await anim(tok, 300, () => {}); glow(W[j], null); }
  say('第 0 個字之後的每個字', '都試試看當第二行開頭');
  await step(tok);                                   // 1445.7 at some point too much: abort
  no('塞太多 → 放棄', X(3), WY - 1.6);
  say('第一行塞太多就放棄');
  await step(tok);                                   // 1458.8 then the third line, the fourth …
  say('然後再猜第三行、第四行從哪開始');
  const more = await pkt(tok, '再猜下一行…', V3(X(1), 2.6, 0.6), V3(X(3), 2.6, 0.6), 900);
  await step(tok);                                   // 1465.8 after the first guess: the same kind of problem
  remove(more);
  Tb('子問題：猜完一次後，剩下的還是同一類問題');
  say('要讓猜完一次後', '剩下的還是同一種問題');
  await step(tok);                                   // 1477.3 after the guess: the remaining words
  tries.forEach(kill);
  dimm(W[0]); glow(W[0], null);
  [1, 2, 3].forEach((i) => glow(W[i], GOLD));
  say('猜完第二行的開頭', '剩下的就是後面的字');
  await step(tok);                                   // 1501.7 a suffix of the array
  const sfx = ghostBox(C.gold, 7.6, 1.2, 1.0); sfx.position.set((X(1) + X(3)) / 2, WY, 0);
  Fm('剩下的字 = 陣列的 suffix');
  say('這叫 suffix（後綴）');
  await step(tok);                                   // 1508.9 subproblems: suffixes words[i:]
  Fm('子問題：suffix words[i:]');
  say('子問題就是 suffix', 'words[i:]');
  await step(tok);                                   // 1520.3 how many subproblems?
  kill(sfx); [1, 2, 3].forEach((i) => glow(W[i], null)); dimm(W[0], false);
  const S = [];
  for (let i = 0; i <= 4; i++) { S.push(box('words[' + i + ':]', C.purple, X(i) + (i === 4 ? -0.4 : 0), 3.0, 1.9, 0.6, 0.5, 1.2)); await anim(tok, 150, () => {}); }
  say('有幾個子問題？');
  await step(tok);                                   // 1540.5 I hope only n, not 2ⁿ
  Fm('suffix 只有 n 個（不是 2ⁿ）');
  say('只有 n 個，不是 2ⁿ');
  await step(tok);                                   // 1556.5 only which words remain matters
  S.forEach((m) => glow(m, GOLD));
  say('只看剩下哪些字', '前面處理了 100 個或 1000 個，都只是 i 不同');
  await step(tok);                                   // 1570.7 we remember only one thing
  S.forEach((m) => glow(m, null));
  bubble('只記得「從第 i 個字開始」', -3.2, 1.6);
  say('只記一件事：還剩哪些字', '這就是關鍵');
  await step(tok);                                   // 1580.5 forget the past: that makes DP efficient
  me.mood('happy');
  ok('忘掉過去 → DP 才有效率', 3.4, 1.6);
  say('忘掉過去怎麼排的', '這讓 DP 有效率');
  await step(tok);                                   // 1608.7 n − i words: still text justification
  Tb('words[i:]：剩 n − i 個字，仍是 text justification');
  say('剩 n − i 個字', '還是同一個排版問題');
}]);

// 27:00 DP(i) = min over j of badness(i, j) + DP(j)；由右往左；O(n²)；答案 DP(0)
FRAG.push(['dpmit1-tj-dp', 'Text justification：DP(i) 由右往左填', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, 0.3, 0.6, 'ptr alt'), Nb = board(0, 4.2, 0.4, 'note');
  const X = (i) => -4.8 + i * 2.4, WY = 5.2, DY = 2.6;
  const W = TWORDS.map((w, i) => box(w, C.orange, X(i), WY, w.length * 0.38 + 0.5, 0.6, 0.45));
  TWORDS.forEach((_, i) => tag('word ' + i, 'idx', X(i), WY + 0.65));
  tag('（結束）', 'idx', X(4), WY);
  for (let i = 0; i <= 4; i++) { tag('DP(' + i + ')', 'ptr', X(i), DY + 0.8); box(' ', C.cell, X(i), DY, 1.6, 0.8, 0.3); }
  const cells = [], arcs = pile();
  const setDP = (i) => { cells[i] = box(fmt(TJD.D[i]), C.teal, X(i), DY, 1.3, 0.65, 0.5, 1.2); };
  const tryJ = async (i) => {
    for (const t of TJD.tries[i]) { arcs.clear(); arcs(arc(V3(X(t.j), DY - 0.4, 0.4), V3(X(i), DY - 0.4, 0.4), -0.5 - 0.2 * (t.j - i), t.v === TJD.D[i] ? '#1f9e6e' : '#c9a35a')); await anim(tok, 450, () => {}); }
    arcs.clear(); arcs(arc(V3(X(TJD.par[i]), DY - 0.4, 0.4), V3(X(i), DY - 0.4, 0.4), -0.5 - 0.2 * (TJD.par[i] - i), '#1f9e6e'));
  };
  await step(tok);                                   // 1620.5 guess where to break the first line
  Tb('第 2 步：猜第一行在哪裡斷（第二行從哪開始）');
  say('猜：第一行在哪裡斷', '也就是第二行從哪個字開始');
  await step(tok);                                   // 1646.7 some word after i
  glow(W[0], GREEN); for (let j = 1; j < 4; j++) glow(W[j], GOLD);
  say('一定是 i 之後的某個字');
  await step(tok);                                   // 1650.8 at most n − i choices: O(n)
  Fm('選擇最多 n − i 種 → O(n)');
  say('最多 n − i 種選擇', '當成 O(n)');
  await step(tok);                                   // 1665.0 3. the recurrence
  W.forEach((m) => glow(m, null));
  Tb('第 3 步：遞迴式');
  say('第 3 步：遞迴式', '其實很簡單');
  await step(tok);                                   // 1689.4 call it DP(i): the suffix from word i
  const cd = code(['DP(i) = min(', '    badness(i, j) + DP(j)', '    for j in range(i+1, n+1))'], 2.6, 7.4, 0.46);
  cd.hl(0);
  Fm('DP(i) = 排好 words[i:] 的最小成本');
  say('記作 DP(i)', 'words[i:] 這個 suffix 的答案');
  await step(tok);                                   // 1728.2 a for loop over where line 2 can start
  cd.hl(2);
  say('for 迴圈：第二行可能從哪開始');
  await step(tok);                                   // 1735.3 i+1 … n; j = n means no second line
  Nb('j = n：沒有第二行');
  say('從 i+1 開始', 'j = n 代表沒有第二行');
  await step(tok);                                   // 1766.8 word i starts line 1, word j starts line 2
  glow(W[0], GREEN); glow(W[2], GOLD);
  tag('i', 'pkt', X(0) - 1.15, WY); tag('j', 'pkt', X(2) - 1.15, WY);
  say('word i 是第一行的第一個字', 'word j 是第二行的第一個字');
  await step(tok);                                   // 1789.2 the rest: DP(j)
  cd.hl(1);
  glow(W[0], null); glow(W[2], GOLD); glow(W[3], GOLD);
  Fm('剩下的部分：DP(j)（遞迴，當作免費）');
  say('後面的部分：DP(j)', '遞迴呼叫，當作免費');
  await step(tok);                                   // 1819.7 the first line: badness(i, j)
  glow(W[2], null); glow(W[3], null); glow(W[0], GOLD); glow(W[1], GOLD);
  Fm('第一行的成本：badness(i, j)');
  say('第一行的成本：badness(i, j)', 'O(1) 就算得出來');
  await step(tok);                                   // 1828.8 DP doesn't care what badness is
  W.forEach((m) => glow(m, null));
  Nb('badness 換成別的定義也行：只要由 i、j 算得出');
  say('DP 不在乎 badness 是什麼函數', '換別的定義一樣能解');
  await step(tok);                                   // 1855.2 a min over the whole thing
  cd.hl(0);
  Fm('對每個 j 取 min');
  say('對所有 j 取 min');
  await step(tok);                                   // 1870.3 this checks all possible solutions
  say('這樣就神奇地檢查了所有可能的解');
  await step(tok);                                   // 1897.8 constant work per choice: O(n) per subproblem
  cd.hl(-1);
  Fm('每題時間：O(n) 個 j × O(1) = O(n)');
  say('每個 j 做常數的事', '每題 O(n)');
  await step(tok);                                   // 1911.5 a topological order
  Tb('第 4 步：拓樸順序');
  say('第 4 步：有拓樸順序嗎？');
  await step(tok);                                   // 1931.7 DP(i) uses bigger j: go right to left
  for (let i = 4; i >= 0; i--) { tag('←', 'idx', X(i) - 1.2, DY); await anim(tok, 120, () => {}); }
  say('DP(i) 用到比 i 大的 j', '所以要從右往左算');
  await step(tok);                                   // 1951.8 base case DP(n) = 0
  setDP(4);
  say('base case：DP(n) = 0', '沒有字了，不花成本');
  await step(tok);                                   // 1978.8 then we work backwards
  await tryJ(3); setDP(3);
  say('往回算 DP(3)：「happy」', '(10−5)³ + 0 = 125');
  await step(tok);                                   // 1982.8 whenever we need a value, we have it
  await tryJ(2); setDP(2);
  say('DP(2)：需要的值都已經有了', 'min(512+125, 8+0) = 8');
  await step(tok);                                   // 1987.9 total time: number of subproblems …
  await tryJ(1); setDP(1);
  say('DP(1)：三種 j', 'min(343+8, 64+125, ∞) = 189');
  await step(tok);                                   // 1998.8 … times O(n): O(n²)
  Fm('總時間 = n 題 × O(n) = O(n²)');
  say('n 個子問題 × 每題 O(n)', '= O(n²)');
  await step(tok);                                   // 2002.8 worst case Θ(n²); better in practice
  Nb('worst case Θ(n²)；實際上一行不會太長，更快');
  say('worst case 是 Θ(n²)', '實務上行不會太長，會更快');
  await step(tok);                                   // 2011.7 5. the original problem
  Tb('第 5 步：原問題是 DP(0)');
  say('原本的問題是哪一個？');
  await step(tok);                                   // 2019.8 DP(0): all the words
  await tryJ(0); setDP(0); glow(cells[0], GREEN);
  say('DP(0)：從第 0 個字開始＝全部的字', '= 35（the cat ⏎ is happy）');
}]);

// 34:09 parent pointers：parent[i] = arg min；0 → 2 → 4
FRAG.push(['dpmit1-tj-parent', 'Parent pointers：還原斷行位置', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.4, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, 0.0, 0.6, 'ptr alt'), Nb = board(0, 1.0, 0.4, 'say');
  const X = (i) => -4.8 + i * 2.4, WY = 6.0, DY = 3.8, PY = 2.4;
  const W = TWORDS.map((w, i) => box(w, C.orange, X(i), WY, w.length * 0.38 + 0.5, 0.6, 0.45));
  tag('DP', 'ptr', X(0) - 1.5, DY); tag('parent', 'ptr', X(0) - 1.6, PY);
  const D = []; for (let i = 0; i <= 4; i++) { tag(String(i), 'idx', X(i), DY + 0.7); D.push(box(fmt(TJD.D[i]), C.teal, X(i), DY, 1.3, 0.65, 0.5)); box(' ', C.cell, X(i), PY, 1.3, 0.65, 0.3); }
  const Pm = [];
  await step(tok);                                   // 2049.4 what does DP(j) return? a cost
  const st = buddy('學生', '?', C.sky, 6.0, 0.0, 1.6, 0.75); st.mood('wow');
  say('學生問：DP(j) 回傳什麼？');
  await step(tok);                                   // 2078.5 a number: a sum of badness values
  D.forEach((m) => glow(m, GOLD));
  Fm('DP(j) 回傳一個數字：badness 的總和');
  say('回傳一個數字', '是 badness 的總和');
  await step(tok);                                   // 2086.9 it doesn't actually pack the words
  D.forEach((m) => glow(m, null));
  Nb('只知道成本 35，不知道怎麼排');
  say('它沒有告訴你怎麼排', '只告訴你排好的成本');
  await step(tok);                                   // 2094.8 like shortest paths: the weight first
  Nb('像最短路徑：先算權重，之後再還原路徑');
  st.mood('calm');
  say('就像最短路徑', '先算權重，再還原路徑');
  await step(tok);                                   // 2113.1 parent pointers
  Tb('parent pointers');
  say('用 parent pointers');
  await step(tok);                                   // 2126.3 remember which guess was best
  Tb('parent pointers：記住哪個猜測最好');
  say('記住哪個猜測最好');
  await step(tok);                                   // 2153.1 the min tries every j
  for (const t of TJD.tries[0]) { glow(D[t.j], GOLD); await anim(tok, 300, () => {}); glow(D[t.j], null); }
  say('算 min 時試遍每個 j');
  await step(tok);                                   // 2160.8 at least one gave the min: the arg min
  glow(D[2], GREEN);
  Fm('讓它最小的那個 j = arg min');
  say('至少有一個 j 給出最小值', '叫 arg min');
  await step(tok);                                   // 2181.7 parent[i] = arg min
  glow(D[2], null);
  Fm('parent[i] = arg min over j of badness(i, j) + DP(j)');
  say('parent[i] = 那個 arg min 的 j');
  await step(tok);                                   // 2201.0 store it for each i: constant extra work
  for (let i = 0; i < 4; i++) { Pm[i] = box(String(TJD.par[i]), C.purple, X(i), PY, 1.0, 0.6, 0.5, 1.2); await anim(tok, 200, () => {}); }
  box('—', GRAY, X(4), PY, 1.0, 0.6, 0.5, 1.2);
  say('每個 i 都存下來', '只多常數倍的工作');
  await step(tok);                                   // 2215.8 start with the original problem, follow pointers
  Tb('從原問題開始，跟著 parent 走');
  say('最後從原問題開始', '跟著 parent pointers 走');
  await step(tok);                                   // 2228.1 start at 0: the first line
  glow(Pm[0], GOLD); glow(W[0], GREEN);
  const hand = tag('從 0 開始', 'pkt', X(0), PY - 0.75, 0.6);
  say('從 0 開始', 'word 0 是第一行的開頭');
  await step(tok);                                   // 2234.8 parent of 0: where line 2 begins
  arc(V3(X(0), PY - 0.4, 0.5), V3(X(2), PY - 0.4, 0.5), -0.7, '#1f9e6e');
  await travel(tok, hand, V3(X(0), PY - 0.75, 0.6), V3(X(2), PY - 0.75, 0.6), 700);
  txt(hand, 'parent[0] = 2'); glow(Pm[0], null); glow(Pm[2], GOLD); glow(W[2], GREEN);
  say('parent[0] = 2', '第二行從 word 2 開始');
  await step(tok);                                   // 2240.7 parent of parent: the third line
  arc(V3(X(2), PY - 0.4, 0.5), V3(X(4), PY - 0.4, 0.5), -0.7, '#1f9e6e');
  await travel(tok, hand, V3(X(2), PY - 0.75, 0.6), V3(X(4), PY - 0.75, 0.6), 700);
  txt(hand, 'parent[2] = 4：結束'); glow(Pm[2], null);
  say('parent[parent[0]] = 4', '到結尾了：只有兩行');
  await step(tok);                                   // 2267.5 linear time reconstructs the breaks
  Nb(''); wordLine(['the', 'cat'], -3.0, 0.9, C.teal, 1.0, 1.0); wordLine(['is', 'happy'], 1.0, 0.9, C.teal, 1.0, 1.0);
  tag('⏎', 'pkt', 0.4, 0.9, 1.0);
  Fm('the cat ⏎ is happy：線性時間還原');
  say('線性時間就還原出每行的起點');
  await step(tok);                                   // 2271.4 works in any DP; automatic
  Tb('parent pointers：任何 DP 都能用，完全自動');
  say('任何 DP 都能用', '跟 memo、bottom-up 一樣自動');
  await step(tok);                                   // 2318.8 the hard part: what to guess, subproblems
  st.mood('happy');
  bubble('真正難的：猜什麼、子問題是什麼', -2.4, 7.2);
  say('真正難的是', '決定猜什麼、子問題是什麼');
}]);

// 38:52 Blackjack 規則：Victor 示範（A+7 = 18 vs 莊家 17；18 vs 20）
FRAG.push(['dpmit1-bj-rules', 'Blackjack 規則：Victor 上台示範', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.0, 0]);
  const Tb = board(0, 7.4, 0, 'ptr');
  const PX = -3.4, DXp = 3.4, CY = 4.4;
  let pv = null, dv = null, cs = [];
  await step(tok);                                   // 2335.4 I brought some cards
  const deck = box('牌', '#b8a98a', 0, 2.2, 0.7, 0.9, 0.5, 1.2);
  Tb('Blackjack（21 點）');
  say('老師帶了撲克牌', '先示範 blackjack 的規則');
  await step(tok);                                   // 2347.8 Victor comes up to help
  const vic = buddy('Victor（玩家）', '', C.sky, PX, 0, 1.2, 1.0); vic.mood('happy');
  say('請 Victor 上台幫忙');
  await vic.hop(tok);
  await step(tok);                                   // 2373.8 a dealer and one player
  const prof = buddy('老師（莊家）', '', C.peach, DXp, 0, 1.2, 1.0);
  say('一位莊家（dealer）', '一位玩家（player）');
  await step(tok);                                   // 2378.5 I'm the dealer: a deterministic strategy
  bubble('莊家的策略固定，沒什麼好想', DXp, 2.6, 1.2);
  say('老師當莊家', '莊家的策略是固定的');
  const deal = async (P, D) => {
    const pos = [[PX - 0.4, CY], [DXp - 0.4, CY], [PX + 0.4, CY], [DXp + 0.4, CY]], seq = [P[0], D[0], P[1], D[1]];
    for (let k = 0; k < 4; k++) { cs.push(cardM(seq[k], pos[k][0], pos[k][1], 0, k === 3, 1.6)); await anim(tok, 250, () => {}); }
  };
  await step(tok);                                   // 2385.8 deal: you, me, you, me
  await deal([1, 7], [10, 7]);
  say('發牌：玩家、莊家、玩家、莊家');
  await step(tok);                                   // 2398.8 you don't see one of my cards
  tag('蓋著', 'idx', DXp + 0.4, CY - 0.75);
  say('莊家有一張牌先蓋著');
  await step(tok);                                   // 2401.8 over 21 loses
  Tb('規則：點數總和超過 21 → 輸（爆牌）');
  say('點數超過 21 就輸');
  await step(tok);                                   // 2413.8 an ace is 1 or 11: 8 or 18
  pv = tag('A + 7 = 8 或 18', 'ptr alt', PX, CY + 1.0);
  vic.mood('wow');
  say('A 可以算 1 或 11', 'Victor：8 或 18');
  await step(tok);                                   // 2422.5 the choice: take another card or not
  bubble('hit（再拿）還是 stand（停）？', PX, 2.6, 1.2);
  say('玩家要選：再拿一張（hit）', '或停（stand）');
  await step(tok);                                   // 2428.8 he stands
  txt(pv, '18：stand'); vic.mood('calm');
  say('標準策略：stand');
  await step(tok);                                   // 2433.8 my cards flip over: 17
  kill(cs[3]); cs[3] = cardM(7, DXp + 0.4, CY, 0);
  dv = tag('10 + 7 = 17', 'ptr alt', DXp, CY + 1.0);
  say('莊家翻牌：17');
  await step(tok);                                   // 2442.8 I hit … and lose (a slip)
  const extra = cardM(9, DXp + 1.2, CY, 0, false, 1.6);
  txt(dv, '17 + 9 = 26：爆了');
  prof.mood('sad');
  say('老師一時想多拿一張', '結果爆牌（示範失誤）');
  await step(tok);                                   // 2449.8 always stand on 17
  kill(extra); txt(dv, '17：必須 stand');
  Tb('莊家規則：≥ 17 一定 stand');
  say('Victor 提醒：17 一定要 stand', '18 > 17，還是 Victor 贏');
  await step(tok);                                   // 2465.0 below 17: always take another card
  Tb('莊家規則：≥ 17 stand；< 17 一定再拿');
  vic.mood('happy');
  say('莊家：< 17 就一定再拿一張');
  await step(tok);                                   // 2470.8 deal again
  cs.forEach((m) => kill(m)); cs = []; remove(pv); remove(dv); // cleared at once: the new hand is dealt on the same spots
  await deal([10, 8], [10, 10]);
  say('再來一局：再發一次牌');
  await step(tok);                                   // 2475.6 you have 18 again
  pv = tag('10 + 8 = 18', 'ptr alt', PX, CY + 1.0);
  say('Victor 又是 18');
  await step(tok);                                   // 2485.3 still stand
  txt(pv, '18：stand');
  say('照策略：stand');
  await step(tok);                                   // 2490.8 I have 20: I win
  kill(cs[3]); cs[3] = cardM(10, DXp + 0.4, CY, 0);
  dv = tag('10 + 10 = 20', 'ptr alt', DXp, CY + 1.0);
  prof.mood('happy'); vic.mood('sad');
  say('莊家 20', '這局莊家贏');
  await step(tok);                                   // 2496.8 $1 per game: we're even
  tag('+$1', 'good', PX, 6.3); tag('−$1', 'bad', PX + 1.2, 6.3);
  say('每局賭 $1', '一勝一負，打平');
  await step(tok);                                   // 2507.8 this rule set: 1% house advantage
  note('這套規則：莊家約有 1% 優勢', 0, 1.2);
  say('Victor：這套規則莊家約有 1% 優勢');
}]);

// 41:56 Perfect-information blackjack：猜這手 hit 幾次；子問題 = 牌的 suffix cᵢ:
FRAG.push(['dpmit1-bj-guess', 'Perfect-information blackjack：猜與子問題', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.9, 0, 'ptr'), Fm = board(0, 0.2, 0.6, 'ptr alt'), Mb = board(-5.8, 2.0, 2.0, 'say'), Nb = board(0.6, 3.2, 0, 'note');
  const n = DECK.length, X = (k) => -5.5 + k * 1.0, CY = 5.2;
  let cards = [];
  await step(tok);                                   // 2515.8 how to cheat at blackjack
  const me = buddy('你（玩家）', '', C.sky, -5.8, 0.0, 2.0, 0.85); me.mood('wow');
  Tb('教你「作弊」');
  say('接下來教：怎麼在 blackjack 作弊');
  await step(tok);                                   // 2540.8 guaranteed to win: plays optimally
  Mb('保證贏最多：最佳玩法');
  say('保證贏最多錢', '因為每一步都最佳');
  await step(tok);                                   // 2544.8 perfect information: I know the whole deck
  for (let k = 0; k < n; k++) { cards.push(cardM(DECK[k], X(k), CY, 0, false, 1.4)); await anim(tok, 80, () => {}); }
  tag('（牌堆為示意）', 'idx', 4.8, CY + 0.9);
  Tb('perfect information：事先知道整副牌的順序');
  say('perfect information', '事先看到整副牌的順序');
  await step(tok);                                   // 2564.9 each time: hit or stand?
  say('每次都想知道', '該 hit 還是 stand？');
  await step(tok);                                   // 2572.9 the same strategy as text justification
  Nb('跟 text justification 同一招：每個字要不要開新行');
  say('跟 text justification 同一招', '每個字要不要開新行 ↔ 要不要再拿');
  await step(tok);                                   // 2588.1 the deck c0, c1, …, cn−1
  cards.forEach((m, k) => tag('c' + k, 'idx', X(k), CY - 0.75));
  say('牌堆：c₀, c₁, …, cₙ₋₁', '共 n 張');
  await step(tok);                                   // 2602.9 one player against the dealer
  const dl = buddy('莊家', '', C.peach, 5.8, 0.0, 2.0, 0.85);
  say('一位玩家對莊家');
  await step(tok);                                   // 2613.8 $1 per hand; no double, no split
  Fm('每手賭 $1；不能 double、不能 split');
  say('每手賭 $1', '不能 double、不能 split');
  await step(tok);                                   // 2634.8 hit or stand? guess
  Mb('hit？stand？→ 猜！');
  say('該 hit 還是 stand？不知道', '那就猜');
  await step(tok);                                   // 2649.7 easier: guess a whole hand
  Tb('一次猜一整手比較好想');
  say('一次想一整手（一局）比較容易');
  await step(tok);                                   // 2654.8 guess how many times to hit in the first hand
  Fm('猜：第一手要 hit 幾次？');
  say('猜：第一手要 hit 幾次');
  await step(tok);                                   // 2668.2 four cards are dealt first
  for (let k = 0; k < 4; k++) glow(cards[k], GOLD);
  say('一開始先發 4 張');
  await step(tok);                                   // 2679.8 try them all: 5 hits, 0 hits …
  for (let h = 0; h <= 3; h++) { for (let k = 4; k < 4 + h; k++) glow(cards[k], '#1d4f7a'); Tb('hit ' + h + ' 次？'); await anim(tok, 400, () => {}); for (let k = 4; k < 8; k++) glow(cards[k], null); }
  Tb('hit 0 次、1 次、2 次 …：全部試');
  say('不用聰明：每種 hit 次數都試');
  await step(tok);                                   // 2690.4 what are the subproblems?
  me.mood('calm');
  say('子問題是什麼？');
  await step(tok);                                   // 2704.5 suffixes of the cards
  for (let k = 0; k < 4; k++) dimm(cards[k]);
  const sfx = ghostBox(C.gold, (n - 4) * 1.0 + 0.2, 1.2, 0.6); sfx.position.set((X(4) + X(n - 1)) / 2, CY, 0);
  say('學生：從哪裡開始新的一手', '→ 牌的 suffix');
  await step(tok);                                   // 2714.9 suffix cᵢ:
  Fm('子問題：suffix cᵢ:（從第 i 張牌開始）');
  say('子問題：從第 i 張開始的 suffix', 'cᵢ:');
  await step(tok);                                   // 2724.8 the best outcome: maximize winnings
  Fm('BJ(i)：只用 cᵢ: 這些牌，最多能贏多少錢');
  say('從這些牌開始', '最多能贏多少錢');
  await step(tok);                                   // 2751.8 the number of subproblems: n
  for (let k = 0; k < n; k++) tag(String(k), 'pkt', X(k), CY + 0.95);
  say('子問題有幾個？', 'i 有 n 種 → n 個');
  await step(tok);                                   // 2769.8 never a subset: a prefix is played
  for (let k = 0; k < 4; k++) dimm(cards[k], false);
  Nb('玩掉的永遠是 prefix → 剩下的是 suffix（不是任意子集合）');
  say('不是任意子集合被玩掉', '永遠是 prefix，剩下 suffix');
  await step(tok);                                   // 2785.6 solve a subproblem
  kill(sfx);
  say('來解一個子問題');
  await step(tok);                                   // 2787.8 first four fixed; guess hits: ≤ n − i − 4
  for (let k = 0; k < 4; k++) glow(cards[k], GOLD);
  for (let k = 4; k < n; k++) glow(cards[k], '#1d4f7a');
  say('從 cᵢ 開始：前 4 張固定', '猜 hit 數：最多 n − i − 4 種');
  await step(tok);                                   // 2808.8 at most n: O(n) choices
  Fm('猜測數 ≤ n：O(n)');
  me.mood('happy');
  say('選擇最多 n 種', 'O(n)');
}]);

// 47:08 BJ(i) = max over 合法的 hit 數 of（這一手的結果 + BJ(j)）
FRAG.push(['dpmit1-bj-recur', 'BJ(i) 的遞迴式：max（這手 ±1/0 + BJ(j)）', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Fm = board(0, -0.2, 0.6, 'ptr alt');
  const n = DECK.length, X = (k) => -5.5 + k * 1.0, CY = 2.0;
  const cards = DECK.map((c, k) => cardM(c, X(k), CY, 0));
  DECK.forEach((_, k) => tag('c' + k, 'idx', X(k), CY - 0.75));
  const cd = code(['BJ(i) = max(', '  outcome(這一手) + BJ(j)', '  for #hits in range(0, n)', '  if 合法（沒爆才能再拿）)'], -2.2, 7.0, 0.5);
  const res = board(3.8, 5.2, 0, 'say');
  const play = async (h) => {
    const r = bjPlay(DECK, 0, h);
    cards.forEach((m, k) => glow(m, k < 4 ? GOLD : k < r.j ? (k < 4 + h ? '#1d4f7a' : '#4a1f4a') : null));
    res('玩家 ' + r.P.map(BJN).join('+') + ' = ' + r.pv + (r.pv > 21 ? ' 爆' : '') + '｜莊家 ' + r.D.map(BJN).join('+') + ' = ' + r.dv);
    return r;
  };
  await step(tok);                                   // 2828.6 call it BJ(i)
  cd.hl(0);
  Tb('BJ(i)：從第 i 張牌開始的最佳玩法');
  say('記作 BJ(i)', '從 i 開始的最佳結果');
  await step(tok);                                   // 2840.6 a max, since we measure winnings
  say('算贏的錢 → 取 max');
  await step(tok);                                   // 2852.8 the outcome of the first hand
  cd.hl(1);
  say('第一項：這一手的結果');
  await step(tok);                                   // 2860.2 lose $1, tie, or win $1
  Fm('這一手的結果：−1（輸）、0（平）、+1（贏）');
  say('輸 $1、平手、贏 $1');
  await step(tok);                                   // 2867.1 a tie: you get your money back → 0
  say('平手：拿回賭注', '結果是 0');
  await step(tok);                                   // 2880.8 told the hits, play through the cards
  const r0 = await play(0);
  say('知道 hit 幾次，就照牌跑一遍', '例：i = 0、hit 0 次');
  await step(tok);                                   // 2890.7 bust? else compare the values
  Fm('11 < 17 → 這手 −1');
  say('有人爆嗎？沒有就比大小', '11 < 17：輸 $1');
  await step(tok);                                   // 2901.9 the dealer's strategy is deterministic
  bubble('莊家策略固定', 5.4, 4.4);
  say('莊家的策略是固定的', '知道玩家拿幾張，莊家怎麼拿就決定了');
  await step(tok);                                   // 2911.8 17 or more? otherwise take another
  bubble('≥ 17 停；< 17 再拿', 5.4, 3.7);
  say('莊家：≥ 17 停，否則再拿', '線性時間就能算出結果');
  await step(tok);                                   // 2919.6 plus the rest: BJ(j)
  cd.hl(1);
  tag('BJ(' + r0.j + ')', 'pkt', X(r0.j), CY + 0.95);
  say('再加上剩下的牌：BJ(j)', '遞迴');
  await step(tok);                                   // 2927.6 for all choices
  cd.hl(2);
  const r1 = await play(1);
  Fm('hit 1 次：21 vs 17 → +1，接 BJ(' + r1.j + ')');
  say('每種選擇都試', '例：hit 1 次 → 21，贏');
  await step(tok);                                   // 2945.9 only if it's a valid play
  cd.hl(3);
  say('要加一個條件', '這一手得是合法的玩法');
  await step(tok);                                   // 2953.9 once busted, can't hit again
  const r2 = await play(2);
  Fm('hit 2 次：31 爆 → −1；之後不能再 hit（break）');
  say('已經爆了就不能再 hit', '用 if 或 break');
  await step(tok);                                   // 2983.8 #hits from 0 to n
  cd.hl(2);
  say('hit 數從 0 試到 n', '也可能完全不 hit');
  await step(tok);                                   // 2994.8 j = i + 4 + #hits + #dealer hits
  cards.forEach((m) => glow(m, null));
  Fm('j = i + 4 + 玩家 hit 數 + 莊家 hit 數');
  say('j 有點麻煩', 'i + 4 + 玩家 hit + 莊家 hit');
  await step(tok);                                   // 3006.8 run it to see how many cards got used
  for (const r of [r0, r1, r2]) { tag('j=' + r.j, 'note', X(r.j), CY + 1.7); await anim(tok, 300, () => {}); }
  say('要真的跑一次', '才知道用掉幾張牌');
  await step(tok);                                   // 3021.2 then call BJ on that
  cd.hl(1);
  Tb('從那裡繼續：BJ(j)');
  say('再對那個位置呼叫 BJ(j)');
}]);

// 50:21 BJ(i) → i+4、i+5、i+6…，邊權 +1/0/−1，最長路徑；O(n³)，21 是常數則 O(n²)
FRAG.push(['dpmit1-bj-dag', 'Blackjack 的 DAG：邊權 +1/0/−1 的最長路徑', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const n = DECK.length, X = (i) => -5.4 + i * 0.9, Y = 2.4;
  const Tb = board(0, 7.6, 0, 'ptr'), Fm = board(0, 0.2, 0.6, 'ptr alt');
  const N = [];
  const col = (w) => (w > 0 ? C.teal : w < 0 ? C.red : C.gold);
  const sg = (w) => (w > 0 ? '+1' : w < 0 ? '−1' : '0');
  const edge = (i, t, z = 0) => { const h = 0.5 + 0.18 * (t.j - i); const a = arc(V3(X(i), Y + 0.35, z), V3(X(t.j), Y + 0.35, z), h, col(t.out)); return a; };
  await step(tok);                                   // 3022.2 think of the DAG: from BJ(i)
  for (let i = 0; i <= n; i++) N.push(box(String(i), i > n - 4 ? GRAY : C.blue, X(i), Y, 0.7, 0.6, 0.5, 1.2));
  tag('節點 i = 從第 i 張牌開始（示意牌堆）', 'idx', 0, Y - 0.8);
  Tb('DAG 的角度：從 BJ(i) 出發');
  say('用 DAG 的角度想', '節點：從第 i 張牌開始');
  await step(tok);                                   // 3031.8 maybe i+4 happens
  glow(N[0], GOLD);
  const t0 = BJ.tries[0];
  edge(0, t0[0]);
  say('從 i 出發：也許到 i + 4', '（沒人再拿牌）');
  await step(tok);                                   // 3035.6 i+5, i+6 … depending on the dealer
  for (let k = 1; k < t0.length; k++) { edge(0, t0[k]); await anim(tok, 300, () => {}); }
  say('也可能到 i + 5、i + 6 …', '看這一手玩家、莊家拿了幾張');
  await step(tok);                                   // 3040.5 all these different plays
  for (let i = 1; i <= n; i++) for (const t of BJ.tries[i] || []) edge(i, t, -0.2);
  say('每條邊是一種玩法', '所有節點都這樣連');
  await step(tok);                                   // 3046.1 edge weights +1, 0, −1
  for (const t of t0) tag(sg(t.out), 'idx', (X(0) + X(t.j)) / 2, Y + 0.35 + (0.5 + 0.18 * t.j) / 2 + 0.25);
  Fm('邊權：贏 +1、平 0、輸 −1');
  say('每條邊的權重', '贏 +1、平 0、輸 −1');
  await step(tok);                                   // 3054.9 a shortest path in this DAG (he means longest)
  glow(N[0], null);
  note('老師口誤說 shortest：贏錢要取 max → longest path', 0, 6.6);
  say('在這個 DAG 上找路徑', '（要贏最多 → 其實是最長路徑）');
  await step(tok);                                   // 3061.8 a node = how many cards are left
  tag('剩 n − i 張', 'note', X(n - 3), Y + 1.3);
  say('節點的意思：還剩幾張牌');
  await step(tok);                                   // 3063.8 all the edges: where can I go next
  for (const t of t0) glow(N[t.j], GOLD);
  say('從這裡能走到哪些狀態？', '每條邊贏或輸多少？');
  await step(tok);                                   // 3074.9 take longest paths
  for (const t of t0) glow(N[t.j], null);
  let i = 0; const path = [0];
  while (BJ.par[i]) { i = BJ.par[i].j; path.push(i); }
  for (let k = 0; k < path.length; k++) { tint(N[path[k]], C.teal); glow(N[path[k]], GREEN); if (k) { const a = path[k - 1]; edge(a, BJ.par[a], 0.45); } await anim(tok, 300, () => {}); }
  Fm('最長路徑 = BJ(0) = ' + BJ.BJ[0]);
  say('取最長路徑', '跟 DP 得到一樣的答案');
  await step(tok);                                   // 3093.1 the same order as before (right to left)
  for (let k = n; k >= 0; k--) { tag(String(BJ.BJ[k]), 'pkt', X(k), Y - 1.5); await anim(tok, 100, () => {}); }
  say('計算順序跟 text justification 一樣', '從右往左');
  await step(tok);                                   // 3095.8 cubic worst case: n subproblems
  Fm('n 個子問題');
  say('worst case 是三次方', '先有 n 個子問題');
  await step(tok);                                   // 3102.8 n choices each
  Fm('n 個子問題 × n 種 hit 數');
  say('每個子問題 n 種選擇');
  await step(tok);                                   // 3104.8 each choice runs the dealer strategy
  Fm('n × n × 跑莊家 O(n) = O(n³)');
  say('每種選擇都要跑一次莊家策略', '最壞 O(n)');
  await step(tok);                                   // 3110.8 21 constant → quadratic
  Fm('若 21 是常數：一手 O(1) → O(n²)');
  say('21 是常數的話', '一手 O(1) 跑完 → O(n²)');
  await step(tok);                                   // 3123.8 more powerful in the next two lectures
  Tb('下兩講：DP 更強大的例子');
  say('下兩講會看到更強大的 DP');
}]);

// ════════════════ wFP5VHGHFdk（MIT 6.006 Rec21 / 2011：Knapsack） ════════════════

const USD = String.fromCharCode(36);
const KI = [{ nm: '雕像', s: 4, v: 10, c: C.gold }, { nm: '水晶球', s: 2, v: 4, c: C.cyan }, { nm: '鋼筆', s: 3, v: 7, c: C.purple }];
// dp(i, j) over suffixes of KI with capacity j ≤ 5 (dp(3, j) = 0)
const KD = (() => { const D = [[], [], [], [0, 0, 0, 0, 0, 0]]; for (let i = 2; i >= 0; i--) for (let j = 0; j <= 5; j++) D[i][j] = Math.max(D[i + 1][j], j >= KI[i].s ? KI[i].v + D[i + 1][j - KI[i].s] : -1); return D; })();
// the layered graph: layer i = 1..3 (item i) and 4 (done); node (i, w) = looking at item i with w pounds taken
const GX = (i) => -3.6 + (i - 1) * 2.4, GY = (w) => 1.0 + w * 1.05, GS = [-6.2, 3.6];
function knapNodes(layers) {
  const N = {};
  for (const i of layers) for (let w = 0; w <= 5; w++) N[i + ',' + w] = box(i + ',' + w, i === 4 ? C.orange : C.blue, GX(i), GY(w), 0.8, 0.5, 0.4);
  return N;
}
// the two edges out of (i, w): skip (weight 0) and take (weight −vᵢ, only if it fits)
function knapEdges(i, w, z = 0, color) {
  const o = KI[i - 1], out = [];
  out.push(link([GX(i), GY(w), z], [GX(i + 1), GY(w), z], color || C.sand, 0.45));
  if (w + o.s <= 5) out.push(link([GX(i), GY(w), z], [GX(i + 1), GY(w + o.s), z], color || C.gold, 0.45));
  return out;
}
const knapHeaders = (n) => ['item 1 雕像', 'item 2 水晶球', 'item 3 鋼筆', 'done'].slice(0, n).forEach((t, k) => tag(t, 'ptr', GX(k + 1), 7.3));
// the DP table: column i = 0..3, row j = 0..5 (j grows downward, so dp(0, 5) is the bottom-left corner)
const TX = (i) => -2.4 + i * 1.6, TY = (j) => 6.6 - j * 0.95;
function knapTable() {
  ['0 雕像', '1 水晶球', '2 鋼筆', '3（空）'].forEach((t, i) => tag(t, 'ptr', TX(i), 7.5));
  for (let j = 0; j <= 5; j++) { tag('j=' + j, 'idx', TX(0) - 1.3, TY(j)); for (let i = 0; i <= 3; i++) box('', C.cell, TX(i), TY(j), 1.3, 0.8, 0.2, 0, -0.2); }
}

// 01:16 小偷、n 個物品 (sᵢ 磅, vᵢ 元)、背包 S 磅
FRAG.push(['dpmit1-knap-items', 'Knapsack：小偷、n 個物品、背包 S 磅', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.2, 0]);
  const Tb = board(0, 7.6, 0, 'ptr'), Sb = board(-5.6, 2.6, 1.4, 'say');
  const IX = (k) => -1.4 + k * 1.9, nm = ['item 1', 'item 2', '…', 'item n'], sub = ['₁', '₂', '', 'ₙ'];
  await step(tok);                                   // 76.1 the knapsack problem: you're a thief
  const th = buddy('小偷（你）', '', '#8a8fa8', -5.6, 0, 1.4, 1.0); th.mood('wow');
  Tb('Knapsack 問題');
  say('Knapsack 問題', '你是一個小偷');
  await step(tok);                                   // 85.8 you made it into a vault with n items
  const vault = prop('warehouse', 1.4, 0, -2.6, 2.4, '金庫：n 個物品'); bob(vault, 0.02, 1);
  const it = nm.map((t, k) => box(t, k === 2 ? GRAY : LV[k], IX(k), 0.45, 1.5, 0.9, 0.8, 1.4, 0.6));
  say('闖進一個金庫', '裡面有 n 個物品');
  await step(tok);                                   // 94.0 item i weighs sᵢ pounds
  nm.forEach((_, k) => k !== 2 && tag('s' + sub[k] + ' 磅', 'idx', IX(k), 1.3, 0.6));
  say('item i 重 sᵢ 磅');
  await step(tok);                                   // 104.1 sell it for vᵢ dollars
  nm.forEach((_, k) => k !== 2 && tag(USD + 'v' + sub[k], 'good', IX(k), 1.85, 0.6));
  th.mood('happy');
  say('出去之後可以賣 vᵢ 元');
  await step(tok);                                   // 119.1 one knapsack: at most S pounds
  const bag = ghostBox(C.brown, 1.6, 2.2, 1.2); bag.position.set(-3.6, 1.1, 1.6);
  tag('背包：最多 S 磅', 'ptr', -3.6, 2.6, 1.6);
  say('你只帶一個背包', '最多裝 S 磅');
  await step(tok);                                   // 133.4 put in more and it breaks
  bag.material.color.set(C.red); bag.material.opacity = 0.3;
  Sb('超過 S 磅 → 背包破掉！');
  th.mood('wow');
  say('裝超過 S 磅', '逃跑時背包會破掉');
  await step(tok);                                   // 140.8 stuff falls; the lasers get you
  th.mood('sad');
  Sb('東西掉一地，觸發雷射…遊戲結束');
  say('東西掉一地', '觸發雷射：遊戲結束');
  await step(tok);                                   // 148.8 only S pounds; as much money as possible
  bag.material.color.set(C.brown); bag.material.opacity = 0.16; th.mood('calm'); Sb('');
  Tb('限制：總重 ≤ S；目標：總價值最大');
  say('只能裝 S 磅', '在這個限制下賺最多錢');
  await step(tok);                                   // 159.2 load the knapsack optimally
  for (const k of [0, 3]) { move(it[k], -3.6, 0.45 + (k ? 1.0 : 0), 1.6); await anim(tok, 400, () => {}); }
  th.mood('happy');
  say('最佳地裝滿背包');
  await step(tok);                                   // 167.6 two ways: graphs and DP
  box('解法 1：圖（shortest path）', C.blue, 3.4, 5.6, 4.6, 0.7, 0.5, 1.2);
  box('解法 2：dynamic programming', C.teal, 3.4, 4.5, 4.6, 0.7, 0.5, 1.2);
  say('兩種解法：圖、DP', '兩個都做，先做圖');
}]);

// 03:06 解 = n 個 true/false 決策；狀態 = (物品 i, 已拿重量)；邊權 −vᵢ
FRAG.push(['dpmit1-knap-state', '決策 dᵢ、狀態 (i, w)、邊權 −vᵢ', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.8, 0, 'ptr'), Nb = board(0, 0.2, 0.6, 'note');
  const X = (i) => -3.6 + i * 3.6;
  await step(tok);                                   // 185.8 first, represent the solution
  Tb('先把「解」表示出來');
  say('先想：解長什麼樣子？');
  await step(tok);                                   // 187.8 a solution = which items we choose
  const items = [0, 1, 2].map((k) => box('item ' + (k + 1), LV[k], X(k), 6.6, 1.6, 0.6, 0.5, 1.2));
  say('解 = 選了哪些物品');
  await step(tok);                                   // 203.3 n true/false decisions
  const qs = [0, 1, 2].map((k) => box('d' + '₁₂₃'[k] + ' = ?', C.cell, X(k), 5.5, 1.6, 0.6, 0.5, 1.2));
  say('寫成 n 個 true / false 的決策');
  await step(tok);                                   // 216.9 dᵢ: take item i? a game show
  const host = buddy('益智節目', '', C.peach, -6.0, 0, 3.0, 0.8); host.mood('happy');
  const ans = ['F', 'T', 'T'];
  for (let k = 0; k < 3; k++) { relabel(qs[k], 'd' + '₁₂₃'[k] + ' = ' + ans[k]); tint(qs[k], ans[k] === 'T' ? C.mint : '#e6e1d8'); await anim(tok, 400, () => {}); }
  say('dᵢ：要不要拿 item i？', '像益智節目一題一題回答');
  await step(tok);                                   // 232.8 more than S pounds: you're out
  Nb('拿超過 S 磅 → 出局');
  say('拿超過 S 磅就出局');
  await step(tok);                                   // 239.8 money depends on what you took
  Nb('順利出去 → 賺的錢看你拿了什麼');
  say('沒出局的話', '賺多少看拿了哪些物品');
  await step(tok);                                   // 250.8 like the game problems we solved with graphs
  const st = [0, 1, 2, 3].map((k) => box('狀態', C.sky, -4.8 + k * 3.2, 3.2, 1.3, 0.6, 0.5, 1.2));
  for (let k = 1; k < 4; k++) link([-4.8 + (k - 1) * 3.2, 3.2], [-4.8 + k * 3.2, 3.2], C.brown, 0.75);
  Tb('跟以前用圖解的遊戲題一樣：決策 = 走一步');
  say('就像以前用圖解的遊戲題', '每個決策是一步，在狀態之間移動');
  await step(tok);                                   // 260.8 state: which item we're thinking about
  st.forEach((m, k) => relabel(m, 'i = ' + (k + 1)));
  say('狀態要記什麼？', '第一：正在考慮哪個物品');
  await step(tok);                                   // 271.9 and how much capacity is left
  st.forEach((m, k) => relabel(m, 'i=' + (k + 1) + ', 剩 ?'));
  host.mood('wow');
  say('第二：背包還剩多少容量');
  await step(tok);                                   // 290.8 that's knowing how much weight is left
  Nb('要知道這個物品放不放得下 → 要知道還剩多少');
  say('要知道放不放得下', '就要知道還剩多少重量');
  await step(tok);                                   // 306.8 equivalently: the weight taken so far
  st.forEach((m, k) => relabel(m, '(i=' + (k + 1) + ', 已拿 w)'));
  Nb('剩下的容量 = S − 已拿的重量：知道一個就知道另一個');
  say('等價於：已經拿了多少重量', '畫圖時比較好用');
  await step(tok);                                   // 357.8 what's a node, an edge, an edge weight?
  Tb('節點是什麼？邊是什麼？邊權呢？');
  say('節點、邊、邊權各是什麼？');
  await step(tok);                                   // 380.6 an edge that takes the item: its weight?
  const q = tag('拿：邊權 = ?', 'pkt', -3.2, 3.85, 0.4);
  say('「拿這個物品」的邊', '權重是多少？');
  await step(tok);                                   // 396.8 maximize earnings; a shortest path algorithm
  Nb('目標：賺最多；可是要交給 shortest path 演算法');
  say('目標是賺最多', '但要交給最短路徑演算法');
  await step(tok);                                   // 403.7 maximize ↔ minimize: flip signs
  Nb('maximize 收益 = minimize 路徑權重：把正負號翻過來');
  say('最大化收益 ↔ 最小化路徑權重', '把正負號翻過來就一樣');
  await step(tok);                                   // 419.8 the negative value of the item
  txt(q, '拿 item i：邊權 −vᵢ');
  q.element.className = 'lab-label good';
  say('邊權 = −vᵢ', '不加負號，最短路徑會給最少錢');
  await step(tok);                                   // 446.1 a node holds i, the item we look at
  items.forEach((m) => fly(m)); qs.forEach((m) => fly(m));
  const node = box('(i, ·)', C.blue, 0, 5.8, 2.2, 0.8, 0.6, 1.2);
  say('節點的狀態：i，正在看的物品', '每個物品一層');
  await step(tok);                                   // 465.3 … and the weight taken
  relabel(node, '(i, w)');
  glow(node, GOLD);
  say('再加上已拿的重量 w', '節點 = (i, w)');
  await step(tok);                                   // 488.2 like the gas problem
  glow(node, null);
  Nb('像加油那題：要同時記位置和油量');
  host.mood('happy');
  say('就像加油那題', '同時記住位置和剩多少油');
}]);

// 08:17 例子：S = 5；雕像 $10 4 磅、水晶球 $4 2 磅、鋼筆 $7 3 磅
FRAG.push(['dpmit1-knap-example', '例子：雕像、水晶球、鋼筆，S = 5', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const Tb = board(0, 7.6, 0, 'ptr');
  const home = [-5.0, -3.0, -1.0];
  await step(tok);                                   // 496.8 an example with three items
  Tb('例子：三個物品');
  say('舉個例子：三個物品');
  await step(tok);                                   // 506.2 the backpack holds five pounds
  const bag = ghostBox(C.brown, 1.9, 5, 1.2); bag.position.set(-3.0 + 6.4, 2.6, 0);
  tag('背包 S = 5 磅', 'ptr', 3.4, 5.6);
  for (let w = 1; w <= 5; w++) tag(String(w), 'idx', 4.7, 0.1 + w - 0.5);
  say('背包最多 5 磅');
  const it = [];
  const show = (k) => { const o = KI[k]; it[k] = box(o.nm, o.c, home[k], 0.1 + o.s / 2, 1.6, o.s, 0.9, 1.4); };
  await step(tok);                                   // 514.0 a golden statue: $10, 4 pounds
  show(0); tag(USD + '10・4 磅', 'good', home[0], 4.6);
  say('金色雕像：' + USD + '10、4 磅');
  await step(tok);                                   // 532.6 a crystal ball: $4, 2 pounds
  show(1); tag(USD + '4・2 磅', 'good', home[1], 2.6);
  say('水晶球：' + USD + '4、2 磅');
  await step(tok);                                   // 547.4 a fountain pen worth $7
  const pen = tag(USD + '7', 'good', home[2], 3.6);
  say('鋼筆：值 ' + USD + '7');
  await step(tok);                                   // 557.9 … weighing three pounds
  show(2); txt(pen, USD + '7・3 磅');
  say('鋼筆重 3 磅');
  await step(tok);                                   // 589.1 a binary decision tree: 2ⁿ nodes
  const T = [];
  for (let d = 0; d <= 3; d++) { const cnt = 2 ** d; for (let k = 0; k < cnt; k++) { const x = 0.4 + (k - (cnt - 1) / 2) * (3.2 / cnt), y = 7.0 - d * 0.8; T.push(box('', d ? (k % 2 ? C.teal : GRAY) : C.orange, x, y, 0.35, 0.3, 0.3, 1.0)); if (d) line(0.4 + ((k >> 1) - (cnt / 2 - 1) / 2) * (6.4 / cnt), y + 0.8 - 0.15, x, y + 0.15, 0, C.sand); } await anim(tok, 200, () => {}); }
  tag('每層：拿／不拿', 'idx', -1.9, 6.2);
  say('畫成決策樹：每層拿或不拿', '');
  await step(tok);                                   // 600.3 exponential in the number of items
  no('節點數 2ⁿ：物品數的指數', 1.4, 4.1);
  say('節點數是 2ⁿ', '物品數的指數');
  await step(tok);                                   // 618.9 all the weights are integers
  note('所有重量都是整數', 1.4, 3.4);
  say('補充：所有重量都是整數');
}]);

// 10:34 分層圖：起點、item 1/2/3 各一層、每層 w = 0…5；(1,0) → (2,0)（0）、(2,4)（−10）
FRAG.push(['dpmit1-knap-graph', '分層圖：節點 (i, w) 與兩種邊', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Nb = board(5.6, 4.2, 0, 'note');
  let N = {};
  await step(tok);                                   // 633.0 keep the idea of levels by item
  Tb('保留「依物品分層」的想法');
  say('保留按物品分層的想法');
  await step(tok);                                   // 638.8 a starting node
  const s = box('s', C.teal, GS[0], GS[1], 0.7, 0.7, 0.5, 1.3);
  say('一個起點');
  await step(tok);                                   // 645.2 a layer for item 1, item 2, item 3
  knapHeaders(3);
  for (let i = 1; i <= 3; i++) { const p = cube('', '#efe6d2', [1.2, 6.6, 0.06], GX(i), 3.6, -0.3); await anim(tok, 250, () => {}); }
  say('item 1、item 2、item 3 各一層');
  await step(tok);                                   // 653.7 how many nodes in a layer?
  say('每一層有幾個節點？');
  Nb('每層幾個節點？');
  await step(tok);                                   // 662.3 one node per possible weight
  Nb('每種可能的「已拿重量」一個節點');
  say('每種可能的重量一個節點', '節點記：物品 i、已拿的重量');
  await step(tok);                                   // 682.1 the backpack holds 5: possible sums?
  Nb('背包 5 磅：已拿重量可能是？（大家猜 2、3、4、5、6）');
  say('背包 5 磅', '已拿的重量可能有幾種？');
  await step(tok);                                   // 702.3 six: from 0 (empty) to 5 (full)
  N = knapNodes([1, 2, 3]);
  for (let w = 0; w <= 5; w++) tag('w=' + w, 'idx', GX(3) + 1.0, GY(w));
  Nb('6 種：0（空）… 5（滿）');
  say('答案是 6 種', '0（空背包）到 5（滿）');
  await step(tok);                                   // 719.0 never above five
  Nb('超過 5 磅就出局 → 不用畫');
  say('不會超過 5 磅', '超過就出局了');
  await step(tok);                                   // 739.6 the first node (1, 0) from the start
  glow(N['1,0'], GOLD); link([...GS, 0], [GX(1), GY(0), 0], C.teal, 0.45);
  say('第一個節點 (1, 0)', '看 item 1，背包 0 磅；從起點連過來');
  await step(tok);                                   // 751.6 outgoing edges: take it or not
  say('它有哪些出邊？', '拿，或不拿');
  await step(tok);                                   // 776.0 a node has two numbers: i and j
  Nb('節點 (i, j)：正在看 item i，背包裡已有 j 磅');
  say('每個節點兩個數字', '(物品 i, 已拿重量)');
  await step(tok);                                   // 806.5 (1, 0): don't take item 1 → ?
  say('(1, 0) 不拿 item 1', '會到哪裡？');
  await step(tok);                                   // 817.3 → (2, 0)
  link([GX(1), GY(0), 0], [GX(2), GY(0), 0], C.sand, 0.45); glow(N['2,0'], GOLD);
  say('→ (2, 0)', '換看 item 2，背包還是 0 磅');
  await step(tok);                                   // 825.8 take item 1 → ?
  glow(N['2,0'], null);
  say('拿 item 1 呢？');
  await step(tok);                                   // 843.8 → (2, 4)
  link([GX(1), GY(0), 0], [GX(2), GY(4), 0], C.gold, 0.45); glow(N['2,4'], GOLD);
  say('→ (2, 4)', '雕像 4 磅，現在包裡 4 磅');
  await step(tok);                                   // 857.5 edge weights: 0 and −10
  tag('0', 'idx', (GX(1) + GX(2)) / 2, GY(0) + 0.3); tag('−10', 'idx', (GX(1) + GX(2)) / 2 - 0.2, (GY(0) + GY(4)) / 2 + 0.3);
  say('邊權：不拿 0、拿 −10', '負號讓我們能用最短路徑');
  await step(tok);                                   // 871.7 now (2, 0): its outgoing edges
  glow(N['1,0'], null); glow(N['2,4'], null); glow(N['2,0'], GOLD);
  knapEdges(2, 0);
  say('換 (2, 0)：出邊？', '不拿 → (3, 0)、拿水晶球 → (3, 2)');
  await step(tok);                                   // 890.6 not a tree: several paths reach a node
  glow(N['2,0'], null);
  for (let w = 1; w <= 5; w++) knapEdges(1, w);
  for (let w = 1; w <= 5; w++) knapEdges(2, w);
  glow(N['3,4'], GOLD);
  Nb('不是樹：(3,4) 可以從 (2,4) 或 (2,2) 走到');
  say('有些邊會走到同一個節點', '它不是一棵樹');
}]);

// 16:09 答案 11；done 層；(2,4) 只能不拿；起點 0 權重連到第一層；終點 (done, 5)
FRAG.push(['dpmit1-knap-graph-end', 'done 層、起點與終點：最短路徑 −11', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.6, 0]);
  const Tb = board(0, 8.0, 0, 'ptr'), Nb = board(0, 0.0, 0.6, 'note'), lit = pile();
  knapHeaders(3);
  const s = box('s', C.teal, GS[0], GS[1], 0.7, 0.7, 0.5);
  const N = knapNodes([1, 2, 3]);
  link([...GS, 0], [GX(1), GY(0), 0], C.teal, 0.45);
  for (let w = 0; w <= 5; w++) { knapEdges(1, w); knapEdges(2, w); }
  await step(tok);                                   // 968.2 the answer here, by the way?
  Tb('這個例子的答案是？');
  say('順便問：這題答案是多少？');
  await step(tok);                                   // 971.7 11: the ball and the pen
  ok('11：拿水晶球 + 鋼筆（2 + 3 = 5 磅）', 0, 7.2);
  say('11', '拿水晶球和鋼筆：4 + 7');
  await step(tok);                                   // 989.8 item 2 with 0 pounds: outgoing edges
  glow(N['2,0'], GOLD); lit(...knapEdges(2, 0, 0.3, C.teal));
  say('在 (2, 0)：看 item 2，包裡 0 磅', '出邊到 (3, 0) 和 (3, 2)');
  await step(tok);                                   // 1012.6 at the third item, what then?
  lit.clear(); glow(N['2,0'], null);
  for (let w = 0; w <= 5; w++) glow(N['3,' + w], GOLD);
  say('到了 item 3 之後', '要往哪裡走？');
  await step(tok);                                   // 1015.8 one more layer: done
  for (let w = 0; w <= 5; w++) glow(N['3,' + w], null);
  tag('done', 'ptr', GX(4), 7.3);
  Object.assign(N, knapNodes([4]));
  say('再加一層 done', '表示全部決定完了');
  await step(tok);                                   // 1033.3 at layer 2, I only look at item 2
  Nb('物品依序決定：在第 2 層只看 item 2');
  say('在第 2 層只看 item 2', '一個一個物品依序決定');
  await step(tok);                                   // 1080.4 node (2, 4): its outgoing edges?
  glow(N['2,4'], GOLD);
  say('(2, 4) 有哪些出邊？');
  await step(tok);                                   // 1093.1 don't take item 2: still 4 pounds
  lit(link([GX(2), GY(4), 0.3], [GX(3), GY(4), 0.3], C.teal, 0.45));
  say('不拿 item 2', '包裡還是 4 磅，也沒賺錢');
  await step(tok);                                   // 1107.4 taking it is overweight: no such edge
  lit(no('4 + 2 = 6 > 5：這條邊不存在', GX(3) + 0.4, GY(5) + 0.6));
  say('拿了會超重', '那條邊跑出圖外，不存在');
  await step(tok);                                   // 1121.2 here I don't know how I got here
  lit.clear(); glow(N['2,4'], null);
  Nb('在節點裡：不知道怎麼走到這裡的');
  say('在一個節點裡', '不知道是怎麼走到這裡的');
  await step(tok);                                   // 1132.8 one item, one decision
  Nb('也不管之後怎麼走：只看一個物品、做一個決定');
  say('也不管之後', '只看一個物品、做一個決定');
  await step(tok);                                   // 1153.9 a final node on the right, connected to everything
  const T = box('T', C.red, 6.2, 3.6, 0.7, 0.7, 0.5, 1.2);
  const tl = [];
  for (let w = 0; w <= 5; w++) tl.push(line(GX(4) + 0.4, GY(w), 5.85, 3.6, -0.1, '#d8cfc0'));
  Nb('做法一：右邊放一個終點，所有 done 連過去');
  say('一種做法：右邊放一個終點', '把每個 done 都連過去');
  await step(tok);                                   // 1188.3 from (3, 2): done with 2 pounds, or take item 3
  glow(N['3,2'], GOLD);
  knapEdges(3, 2, 0.3, C.teal);
  tag('0', 'idx', (GX(3) + GX(4)) / 2, GY(2) + 0.3); tag('−7', 'idx', (GX(3) + GX(4)) / 2 - 0.2, (GY(2) + GY(5)) / 2 + 0.3);
  say('(3, 2) 的出邊', '不拿 → (done, 2)；拿鋼筆 → (done, 5)');
  for (let w = 0; w <= 5; w++) if (w !== 2) knapEdges(3, w);
  await step(tok);                                   // 1233.6 finish by connecting to one destination
  glow(N['3,2'], null); glow(T, GOLD);
  say('收尾方法一：全部連到一個終點');
  await step(tok);                                   // 1238.8 or connect the source to everything, cost zero
  glow(T, null); dimm(T); tl.forEach((l) => dimm(l));
  for (let w = 1; w <= 5; w++) link([GS[0], GS[1], -0.2], [GX(1), GY(w), -0.2], '#cfc4b0', 0.45);
  Nb('做法二：起點連到第一層的每個節點');
  say('方法二：起點連到第一層每個節點');
  await step(tok);                                   // 1254.2 starting there = wasting one pound
  glow(N['1,1'], GOLD);
  Nb('從 (1, 1) 出發 = 浪費 1 磅的容量');
  say('從 (1, 1) 出發', '等於一開始就浪費 1 磅容量');
  await step(tok);                                   // 1315.9 the destination is (done, 5)
  glow(N['1,1'], null); glow(N['4,5'], GOLD);
  Nb('這樣終點只有一個：(done, 5)');
  say('這樣終點只有一個', '(done, 5)');
  await step(tok);                                   // 1352.8 those source edges cost zero
  for (let w = 0; w <= 5; w++) tag('0', 'idx', (GS[0] + GX(1)) / 2, (GS[1] + GY(w)) / 2 + 0.15);
  say('起點出來的邊權：0');
  await step(tok);                                   // 1362.6 a third way: equivalent
  Nb('做法三：起點只連 (1,0)、done 全連到終點（等價）');
  say('第三種做法也等價');
  await step(tok);                                   // 1375.0 we pick this one: it maps to DP
  const path = [[1, 0], [2, 0], [3, 2], [4, 5]];
  link([GS[0], GS[1], 0.4], [GX(1), GY(0), 0.4], C.teal, 0.45);
  for (let k = 0; k < path.length; k++) { const [i, w] = path[k]; glow(N[i + ',' + w], GREEN); tint(N[i + ',' + w], C.teal); if (k) link([GX(path[k - 1][0]), GY(path[k - 1][1]), 0.4], [GX(i), GY(w), 0.4], C.teal, 0.45); await anim(tok, 300, () => {}); }
  Nb('選這種：直接對應到 DP。最短路徑 0 + 0 − 4 − 7 = −11');
  say('選這種，因為它對應到 DP', '最短路徑 −11 → 賺 11');
}]);

// 23:23 V = (n+1)(S+1) = O(nS)、每點 ≤ 2 條出邊；DAG shortest path O(V+E) = O(nS)
FRAG.push(['dpmit1-knap-graph-time', '圖解的時間：DAG 最短路徑 O(V+E) = O(nS)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const X = (i) => -5.6 + i * 0.75, Y = (w) => 1.2 + w * 0.75;
  const Tb = board(0, 7.6, 0, 'ptr'), Fm = board(-3.4, 6.6, 0, 'ptr alt');
  const ns = [];
  await step(tok);                                   // 1402.2 how many vertices?
  for (let i = 0; i < 4; i++) for (let w = 0; w <= 5; w++) ns.push(box('', C.blue, X(i), Y(w), 0.5, 0.45, 0.4));
  Tb('頂點有幾個？');
  say('先算頂點數');
  await step(tok);                                   // 1406.1 n layers
  for (let i = 0; i < 4; i++) { for (let w = 0; w <= 5; w++) glow(ns[i * 6 + w], GOLD); await anim(tok, 200, () => {}); for (let w = 0; w <= 5; w++) glow(ns[i * 6 + w], null); }
  say('n 層（其實 n + 1 層）');
  await step(tok);                                   // 1415.0 (n + 1) × (S + 1)
  Fm('V = (n+1)(S+1)');
  say('每層 S + 1 個', 'V = (n+1)(S+1)');
  await step(tok);                                   // 1429.8 write O(nS)
  Fm('V = (n+1)(S+1) = O(nS)');
  say('不想管 +1', '寫成 O(nS)');
  await step(tok);                                   // 1433.8 at most two edges out of a vertex
  link([X(1), Y(1), 0.3], [X(2), Y(1), 0.3], C.sand, 0.25); link([X(1), Y(1), 0.3], [X(2), Y(3), 0.3], C.gold, 0.25);
  glow(ns[7], GOLD);
  say('每個頂點最多 2 條出邊', '拿、不拿');
  await step(tok);                                   // 1449.7 edges total? which shortest path algorithm?
  glow(ns[7], null);
  Fm('E ≤ 2V = O(nS)');
  const al = [['Dijkstra', C.red], ['Bellman-Ford', GRAY], ['DAG shortest path', C.teal]].map(([t, c], k) => box(t, c, 3.0, 5.6 - k * 1.5, 3.4, 0.8, 0.6, 1.4));
  say('邊數 O(nS)', '用哪個最短路徑演算法？');
  await step(tok);                                   // 1465.1 the faster one
  say('選跑得快的那個');
  await step(tok);                                   // 1468.2 Bellman-Ford: VE
  tag('O(VE)：太慢', 'idx', 3.0, 5.6 - 1.5 - 0.65);
  say('Bellman-Ford：V × E');
  await step(tok);                                   // 1472.2 DAG: topological sort + relax: V + E
  tag('拓樸排序 + relax：O(V + E)', 'good', 3.0, 5.6 - 3.0 - 0.65);
  glow(al[2], GREEN);
  say('DAG 演算法：拓樸排序再 relax', 'V + E');
  await step(tok);                                   // 1480.1 for any DP graph, this is the answer
  Tb('DP 畫出來的圖 → 永遠用 DAG 演算法');
  say('只要是 DP 的圖', '答案永遠是這個');
  await step(tok);                                   // 1484.5 never Dijkstra, never Bellman-Ford
  dimm(al[0]); dimm(al[1]);
  tag('有負邊權：本來就不能用', 'bad', 3.0, 5.6 - 0.65);
  say('不是 Dijkstra', '也不是 Bellman-Ford');
  await step(tok);                                   // 1486.8 the running time of the graph solution
  Fm('圖解法：O(V + E) = O(nS)');
  say('圖解法的總時間', 'O(nS)');
  await step(tok);                                   // 1554.8 topological order: each node once
  for (let i = 0; i < 4; i++) { for (let w = 0; w <= 5; w++) { tint(ns[i * 6 + w], C.teal); } await anim(tok, 250, () => {}); }
  note('照拓樸順序，每個節點只處理一次（不是 DFS）', -2.4, 0.3);
  say('拓樸排序後', '每個節點只看一次它的邊');
}]);

// 26:05 DP：子問題 = 節點；dp(i, j) = 只用 item i 以後、總重 ≤ j 的最大價值；suffix
FRAG.push(['dpmit1-knap-dp-def', 'DP 子問題：dp(i, j)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Tb = board(0, 7.9, 0, 'ptr'), Fm = board(0, 6.9, 0, 'ptr alt');
  await step(tok);                                   // 1565.0 what if we do DP instead?
  Tb('改用 dynamic programming');
  say('改用 DP 會怎樣？');
  await step(tok);                                   // 1570.0 a subproblem maps to a node
  const nd = box('節點 (i, w)', C.blue, -4.2, 4.6, 2.4, 0.8, 0.6, 1.2);
  const arrowP = link([-2.9, 4.6], [-0.6, 4.6], C.brown, 0.1);
  const sp = box('子問題', C.teal, 0.8, 4.6, 2.2, 0.8, 0.6, 1.2);
  say('節點換成子問題', '一個子問題對應一個節點');
  await step(tok);                                   // 1576.8 the same state
  relabel(sp, '子問題 (i, j)');
  say('節點記的狀態', '就是子問題的狀態');
  await step(tok);                                   // 1607.4 how many subproblems?
  Fm('子問題有幾個？');
  say('子問題有幾個？');
  await step(tok);                                   // 1622.2 nS vertices → nS subproblems
  Fm('nS 個頂點 → nS 個子問題');
  say('nS 個頂點', '→ nS 個子問題');
  await step(tok);                                   // 1653.8 the maximum value …
  kill(nd); kill(arrowP); kill(sp);
  Fm('dp(i, j) = 最多能賺多少錢？');
  say('子問題的值：最多能賺多少錢');
  await step(tok);                                   // 1665.3 using some weight; label it (i, j)
  say('用某個重量', '跟節點一樣標成 (i, j)');
  await step(tok);                                   // 1682.8 using a weight of at most j
  Fm('dp(i, j)：總重最多 j 磅時，最多賺多少');
  say('dp(i, j)：總重「最多」j 磅', '最多能賺多少');
  await step(tok);                                   // 1712.5 using items ≥ i
  Fm('dp(i, j)：只用 item i 以後、總重 ≤ j，最多賺多少');
  say('只用第 i 個以後的物品');
  await step(tok);                                   // 1717.8 number items from 0
  say('物品改從 0 開始編號', '因為要放進 DP 表');
  await step(tok);                                   // 1734.9 0 statue, 1 ball, 2 pen
  KI.forEach((o, k) => { box(k + ' ' + o.nm, o.c, -3.2 + k * 3.2, 5.6, 2.4, 0.6, 0.5, 1.2); });
  say('0 = 雕像、1 = 水晶球、2 = 鋼筆');
  await step(tok);                                   // 1741.4 suffixes of the items
  Tb('看物品的 suffix');
  say('看的是物品的 suffix');
  const SX = (i) => 3.6 - i * 2.4, sets = [[], [2], [1, 2], [0, 1, 2]];
  const col = (k) => { tag('i = ' + [3, 2, 1, 0][k], 'ptr', SX(k), 4.5); if (!sets[k].length) tag('（空）', 'idx', SX(k), 3.9); sets[k].forEach((j, r) => box(KI[j].nm, KI[j].c, SX(k), 3.9 - r * 0.6, 1.8, 0.5, 0.4, 1.2)); };
  await step(tok);                                   // 1744.8 the empty set, then only the pen
  col(0); await anim(tok, 400, () => {}); col(1);
  say('先是空集合', '再來只有鋼筆');
  await step(tok);                                   // 1750.8 the ball and the pen, then all three
  col(2); await anim(tok, 400, () => {}); col(3);
  say('然後水晶球 + 鋼筆', '最後三個全部');
  await step(tok);                                   // 1755.9 and how much weight we have
  Fm('另一維：容量 j = 0 … 5');
  say('另一維：能用多少重量');
  await step(tok);                                   // 1769.8 this is our DP table
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 5; j++) box('', C.cell, -1.8 + i * 1.2, 1.9 - j * 0.32, 1.1, 0.28, 0.15, 0, 0.2);
  tag('DP table：i = 0 … 3 × j = 0 … 5', 'say', 4.2, 1.2);
  say('這就是 DP 表', 'i × j');
}]);

// 29:57 dp(i, j) = max(dp(i+1, j), vᵢ + dp(i+1, j − sᵢ))，後者要 j ≥ sᵢ
FRAG.push(['dpmit1-knap-recur', '遞迴式：拿或不拿 item i', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Tb = board(0, 7.9, 0, 'ptr'), Nb = board(0, 0.1, 0.6, 'note');
  const cd = code(['dp(i, j) = max(', '  dp(i+1, j),             # 不拿 item i', '  v[i] + dp(i+1, j−s[i])  # 拿 item i', ')    # 第二項只在 j ≥ s[i] 時'], -2.0, 7.0, 0.52);
  cd.ls.forEach((l, k) => showL(l, k === 0));
  const CXi = 2.4, CXn = 5.0, cY = (r) => 4.2 - r * 0.8;
  const c0 = box('dp(i, j)', C.blue, CXi, cY(1), 2.0, 0.6, 0.4);
  tag('i', 'ptr', CXi, cY(-0.6)); tag('i + 1', 'ptr', CXn, cY(-0.6));
  const lit = pile();
  await step(tok);                                   // 1797.4 the maximum of something
  cd.hl(0);
  say('dp(i, j) = 某些東西的 max');
  await step(tok);                                   // 1801.3 how many decisions? two, like the graph
  Tb('兩個決策：跟圖一樣');
  say('有幾個決策？兩個', '跟圖的版本一樣');
  await step(tok);                                   // 1811.8 take item i, or not
  const me = buddy('', '?', C.sky, -5.8, 0, 2.0, 0.8); me.mood('wow');
  Tb('拿 item i？還是不拿？');
  say('拿 item i，或不拿');
  await step(tok);                                   // 1814.8 don't take it: where do we land?
  say('不拿 item i', '會變成什麼情況？');
  await step(tok);                                   // 1828.8 use items i+1 … n−1
  showL(cd.ls[1], true); cd.hl(1);
  const n1 = box('dp(i+1, ?)', C.teal, CXn, cY(1), 2.0, 0.6, 0.4, 1.0);
  say('改用 item i+1 … n−1');
  await step(tok);                                   // 1836.8 with the same weight: dp(i+1, j)
  relabel(n1, 'dp(i+1, j)');
  lit(link([CXn, cY(1), 0.3], [CXi, cY(1), 0.3], C.teal, 1.0));
  say('容量還是 j', '→ dp(i+1, j)');
  await step(tok);                                   // 1845.6 suppose we take item i
  say('如果拿 item i 呢？');
  await step(tok);                                   // 1857.8 we make vᵢ
  showL(cd.ls[2], true); cd.hl(2);
  me.mood('happy'); me.set('+vᵢ');
  say('賺到 vᵢ');
  await step(tok);                                   // 1888.9 the rest from items i+1 on
  const n2 = box('dp(i+1, ?)', C.gold, CXn, cY(3), 2.2, 0.6, 0.4, 1.0);
  say('剩下的從 item i+1 開始');
  await step(tok);                                   // 1894.8 sᵢ pounds in: the rest must weigh j − sᵢ
  relabel(n2, 'dp(i+1, j−sᵢ)');
  lit(link([CXn, cY(3), 0.3], [CXi, cY(1), 0.3], C.gold, 1.0));
  say('背包已有 sᵢ 磅', '其他物品只能用 j − sᵢ 磅');
  await step(tok);                                   // 1911.8 make some money, lose some capacity
  Nb('賺一點錢，少一點容量');
  say('賺到錢，也吃掉容量');
  await step(tok);                                   // 1916.2 the arrows point the other way now
  Nb('從圖變 DP：箭頭方向反過來了');
  say('箭頭方向跟圖相反了');
  await step(tok);                                   // 1940.1 one check, or the code crashes
  showL(cd.ls[3], true); cd.hl(3);
  say('還要加一個檢查', '不然程式會壞');
  await step(tok);                                   // 1951.8 j ≥ sᵢ
  Nb('j − sᵢ ≥ 0，也就是 j ≥ sᵢ（放得下才能拿）');
  say('j − sᵢ ≥ 0', '也就是 j ≥ sᵢ');
  await step(tok);                                   // 1963.9 the graph: moves of the game, in order
  cd.hl(-1);
  Nb('圖：照遊戲的順序，一題一題回答');
  say('圖：照遊戲順序', '一題一題回答要不要拿');
  await step(tok);                                   // 1985.4 DP: decide with full information
  Nb('DP：做決定時要知道後面物品的結果');
  say('DP：做決定時要有完整資訊', '拿不拿取決於後面的物品');
  await step(tok);                                   // 2007.4 people understand suffixes better
  Nb('用 suffix：教了很多年，大家比較懂 suffix');
  say('大家比較容易理解 suffix', '所以這樣寫');
  await step(tok);                                   // 2029.5 subproblems: nothing, item 2, items 1-2, all
  Tb('子問題：{ }、{2}、{1, 2}、{0, 1, 2}');
  me.mood('happy');
  say('子問題：空、item 2、item 1–2、全部', '物品的 suffix');
}]);

// 34:10 答案 dp(0,5)、拓樸順序 i 由大到小、初始 dp(3, j) = 0
FRAG.push(['dpmit1-knap-table', '答案在哪、拓樸順序、初始條件', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Nb = board(0.2, 0.8, 0.4, 'note');
  knapTable();
  tag('j ↓', 'idx', TX(0) - 1.3, 7.5);
  const goalBox = ghostBox(C.gold, 1.5, 0.95, 0.9); goalBox.visible = false;
  const cells = {};
  await step(tok);                                   // 2049.8 we need: where the answer is
  Nb('還需要：① 答案在哪');
  say('還需要知道：答案在哪');
  await step(tok);                                   // 2056.0 … the initial conditions
  Nb('還需要：① 答案在哪 ② 初始條件');
  say('還有初始條件');
  await step(tok);                                   // 2064.8 … and a topological sort
  Nb('還需要：① 答案在哪 ② 初始條件 ③ 拓樸順序');
  say('還有拓樸順序');
  await step(tok);                                   // 2091.7 the answer considers all items: which i?
  for (let j = 0; j <= 5; j++) cube('', C.butter, [1.3, 0.8, 0.05], TX(0), TY(j), -0.1);
  say('答案要考慮所有物品', '所以 i = 0 那一欄');
  await step(tok);                                   // 2097.8 top-left = all items, empty knapsack
  goalBox.visible = true; goalBox.position.set(TX(0), TY(0), 0);
  say('左上角：所有物品、空背包', '不是答案');
  await step(tok);                                   // 2112.2 max of the column only if "= j"
  Nb('若定義是「恰好 = j」：答案要對整欄取 max');
  say('如果定義是「恰好 j 磅」', '才要對整欄取 max');
  await step(tok);                                   // 2116.9 but it's "≤ j": just look here
  goalBox.position.set(TX(0), TY(5), 0);
  say('可是定義是「≤ j」', '直接看這一格就好');
  await step(tok);                                   // 2134.4 weight at most S, items 0 and up
  Nb('dp(0, S)：用 item 0 以後（全部）、重量 ≤ S');
  say('重量最多 S', '考慮 item 0 以後＝全部物品');
  await step(tok);                                   // 2140.7 that's where the answer is
  tag('答案', 'good', TX(0) - 1.6, TY(5) - 0.55);
  say('答案就在這裡');
  await step(tok);                                   // 2175.2 dp(0, S): i = 0, j = S
  Nb('dp(0, S)：i = 0、j = S = 5');
  say('dp(0, S)：i = 0、j = S');
  await step(tok);                                   // 2201.8 it maps to the original problem
  Nb('全部物品 + 最大容量 = 原本的問題');
  say('它就是原本的問題');
  await step(tok);                                   // 2225.0 with "=", something else must change
  Nb('改成「= j」：遞迴式不變，答案位置和初始條件要改');
  say('改成「恰好等於」', '遞迴式不變，但答案和初始條件要改');
  await step(tok);                                   // 2248.6 only the answer and initial conditions change
  say('改變的只有：答案在哪、初始條件');
  await step(tok);                                   // 2267.5 a topological sort
  Nb('③ 拓樸順序：用什麼順序填？');
  say('拓樸順序：該怎麼填？');
  await step(tok);                                   // 2283.3 iterate i from n down
  for (let i = 3; i >= 0; i--) { tag('←', 'pkt', TX(i) - 0.8, 7.0); await anim(tok, 200, () => {}); }
  say('外層：i 從 n 往下到 0');
  await step(tok);                                   // 2313.4 dp(i, j) needs i+1 and smaller j
  const a1 = link([TX(2), TY(3), 0.5], [TX(1), TY(3), 0.5], C.teal, 0.55), a2 = link([TX(2), TY(1), 0.5], [TX(1), TY(3), 0.5], C.gold, 0.55);
  glow(cube('', C.sky, [1.0, 0.6, 0.1], TX(1), TY(3), 0.1), GOLD);
  say('算 (i, j) 要看 i + 1 那欄', '同一列和上面的列');
  await step(tok);                                   // 2331.6 both orders of j work
  Nb('右邊那欄已經算完：j 往上或往下都可以');
  say('右邊那欄整欄都算好了', 'j 的方向兩種都行');
  await step(tok);                                   // 2406.2 this column, then this column …
  kill(a1); kill(a2);
  for (let i = 3; i >= 0; i--) { for (let j = 0; j <= 5; j++) cube('', '#f3d27a', [1.3, 0.8, 0.05], TX(i), TY(j), -0.05); await anim(tok, 300, () => {}); }
  say('一欄一欄：右邊先算');
  await step(tok);                                   // 2413.3 this column is the initial condition
  Nb('最右邊這欄（i = 3）= 初始條件');
  say('最右邊這一欄', '就是初始條件');
  await step(tok);                                   // 2436.6 dp(2, 0) = max(dp(3, 0), …)
  const a3 = link([TX(3), TY(0), 0.5], [TX(2), TY(0), 0.5], C.teal, 0.55);
  say('算 dp(2, 0)', '= max(dp(3, 0), …)');
  await step(tok);                                   // 2450.5 we want dp(3, 0) = 0
  Nb('第二項 j ≥ s 不成立 → dp(2,0) = dp(3,0)，要是 0');
  say('第二項不成立', '所以希望 dp(3, 0) = 0');
  await step(tok);                                   // 2461.2 dp(n, j) = 0 for all j
  kill(a3);
  for (let j = 0; j <= 5; j++) { cells['3,' + j] = box(0, GRAY, TX(3), TY(j), 1.0, 0.6, 0.4, 1.2); await anim(tok, 120, () => {}); }
  say('初始條件：dp(n, j) = 0', '每個 j 都是');
  await step(tok);                                   // 2479.8 an extra column, like the done column
  Nb('多一欄 i = 3：就像圖的 done 那層');
  say('多出來的這欄', '就像圖裡的 done 層');
  await step(tok);                                   // 2498.3 any capacity, no items, zero money
  Nb('空的 suffix：什麼都不拿，賺 0');
  say('空的 suffix：不用任何物品', '賺 0 元');
}]);

// 42:22 填表：鋼筆欄 0 0 0 7 7 7、水晶球欄 0 0 4 7 7 11、雕像欄 0 0 4 7 10 11
FRAG.push(['dpmit1-knap-fill', '填表：dp(0, 5) = 11', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Nb = board(4.9, 4.4, 0.4, 'note'), Fm = board(0, 0.6, 0.6, 'ptr alt');
  knapTable();
  const cells = {}, lit = pile();
  for (let j = 0; j <= 5; j++) cells['3,' + j] = box(0, GRAY, TX(3), TY(j), 1.0, 0.6, 0.4);
  const unglow = () => Object.values(cells).forEach((m) => glow(m, null));
  const deps = (i, j) => {
    lit.clear(); unglow();
    const o = KI[i], skip = KD[i + 1][j], can = j >= o.s, take = can ? o.v + KD[i + 1][j - o.s] : -1;
    lit(link([TX(i + 1), TY(j), 0.5], [TX(i), TY(j), 0.5], skip >= take ? C.teal : C.gold, 0.55)); glow(cells[(i + 1) + ',' + j], GOLD);
    if (can) { lit(link([TX(i + 1), TY(j - o.s), 0.5], [TX(i), TY(j), 0.5], take > skip ? C.teal : C.gold, 0.55)); glow(cells[(i + 1) + ',' + (j - o.s)], GOLD); }
    Fm('dp(' + i + ',' + j + ') = ' + (can ? 'max(' + skip + ', ' + o.v + ' + ' + KD[i + 1][j - o.s] + ')' : 'dp(' + (i + 1) + ',' + j + ')（放不下）') + ' = ' + KD[i][j]);
  };
  const put = async (i, j) => { deps(i, j); await anim(tok, 350, () => {}); const o = KI[i], take = j >= o.s ? o.v + KD[i + 1][j - o.s] : -1; cells[i + ',' + j] = box(KD[i][j], take > KD[i + 1][j] ? C.teal : C.blue, TX(i), TY(j), 1.0, 0.6, 0.4, 1.2); };
  await step(tok);                                   // 2542.0 the next one? dp(2, 0)
  Nb('照拓樸順序：先填鋼筆欄（i = 2）');
  await put(2, 0);
  say('先填鋼筆那欄', 'dp(2, 0) = 0');
  await step(tok);                                   // 2557.2 filling them like this
  await put(2, 1);
  say('照這個順序往下填', 'dp(2, 1) = 0');
  await step(tok);                                   // 2562.4 topological order: still 0
  await put(2, 2);
  say('還是 0', '鋼筆 3 磅放不下');
  await step(tok);                                   // 2572.7 here the condition is finally true
  deps(2, 3);
  say('這格條件終於成立', 'j = 3 ≥ 3：可以拿鋼筆');
  await step(tok);                                   // 2580.8 max(dp(3,3) = 0, 7 + dp(3,0)) = 7
  await put(2, 3);
  say('max(dp(3,3) = 0, 7 + dp(3,0) = 7)', '= 7');
  await step(tok);                                   // 2591.6 that's why 7; then 7, 7
  await put(2, 4); await put(2, 5);
  say('dp(2, 4)、dp(2, 5) 也是 7');
  await step(tok);                                   // 2611.9 the ball: max(0, 4 + 0) = 4
  Nb('水晶球欄（i = 1，2 磅）');
  await put(1, 0); await put(1, 1); await put(1, 2);
  say('水晶球那欄', 'dp(1, 2) = max(0, 4 + 0) = 4');
  await step(tok);                                   // 2626.2 max(7, 4 + 0) = 7
  await put(1, 3);
  say('dp(1, 3) = max(7, 4 + 0)', '= 7');
  await step(tok);                                   // 2639.1 max(7, 4 + 7) = 11
  await put(1, 4); await put(1, 5);
  say('dp(1, 5) = max(7, 4 + 7)', '= 11');
  await step(tok);                                   // 2654.3 the last column: 0, 0 …
  Nb('雕像欄（i = 0，4 磅）');
  for (let j = 0; j <= 3; j++) await put(0, j);
  say('最後一欄：雕像', 'j < 4 放不下雕像，照抄右邊：0、0、4、7');
  await step(tok);                                   // 2672.1 it needs to be 11
  await put(0, 4); await put(0, 5);
  glow(cells['0,5'], GREEN);
  say('最後一格要是 11', 'dp(0, 4) = 10（板書沒念）');
  await step(tok);                                   // 2679.4 this one, or 10 + dp(1, 1)
  deps(0, 5);
  say('dp(0, 5) = max(右邊 11, 10 + dp(1, 1))', '= max(11, 10) = 11');
  await step(tok);                                   // 2690.7 the statue weighs 4: one right, four up
  Nb('拿雕像：往右一欄、往上 4 格');
  say('雕像重 4', '所以往右一欄、往上 4 格看');
  await step(tok);                                   // 2713.8 horizontally = not taking item i
  lit.clear(); unglow();
  lit(link([TX(1), TY(5), 0.5], [TX(0), TY(5), 0.5], C.teal, 0.55)); glow(cells['1,5'], GOLD);
  Fm('橫著看 = 不拿 item i：dp(i+1, j)');
  say('橫著看：不拿 item i');
  await step(tok);                                   // 2721.8 take: add vᵢ, the column to the right, leftover row
  lit(link([TX(1), TY(1), 0.5], [TX(0), TY(5), 0.5], C.gold, 0.55)); glow(cells['1,1'], GOLD);
  Fm('斜著看 = 拿：vᵢ + dp(i+1, 剩下的容量)');
  say('拿的話：加上 vᵢ', '再看右一欄、剩下容量那一列');
  await step(tok);                                   // 2781.1 a student: the middle cell dp(1, 3)
  lit.clear(); unglow();
  glow(cells['1,3'], GOLD);
  const st = buddy('學生', '?', C.sky, 5.9, 0, 2.2, 0.75); st.mood('wow');
  say('學生問 dp(1, 3)');
  await step(tok);                                   // 2790.1 the ball weighs two pounds
  Nb('dp(1, 3)：容量 3、水晶球 2 磅');
  say('水晶球重 2 磅');
  await step(tok);                                   // 2838.8 one pound left
  Nb('容量 3 − 2 = 剩 1 磅 → 看 dp(2, 1)');
  say('容量 3、放進 2 磅', '剩 1 磅');
  await step(tok);                                   // 2878.1 that's why the arrow points to (2, 1)
  deps(1, 3);
  say('所以箭頭指到 (2, 1)', '另一條是 (2, 3)');
  await step(tok);                                   // 2888.9 j = the weight allowed for the subproblem
  st.mood('happy');
  Nb('j = 能用的重量上限');
  Fm('j：子問題「最多能用」的重量，不是已經用掉多少');
  say('j 是這個子問題能用的重量上限');
}]);

// 49:19 O(nS)：子問題 nS 個、每題 O(1)；pseudo-polynomial：S 是數字的「值」
FRAG.push(['dpmit1-pseudo-poly', 'DP 的執行時間 O(nS)：pseudo-polynomial', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.6, 0, 'ptr'), Fm = board(0, 0.6, 0.6, 'ptr alt');
  await step(tok);                                   // 2959.2 the running time: how many subproblems?
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 5; j++) box('', C.cell, -4.6 + i * 0.75, 2.0 + j * 0.6, 0.65, 0.5, 0.2);
  Tb('DP 的執行時間');
  Fm('子問題數：nS');
  say('執行時間：子問題有幾個？', 'nS 個');
  await step(tok);                                   // 2968.1 how many subproblems does one look at? two
  const c = box('', C.teal, -4.6 + 0.75, 2.0 + 3 * 0.6, 0.65, 0.5, 0.3);
  glow(box('', C.gold, -4.6 + 1.5, 2.0 + 3 * 0.6, 0.65, 0.5, 0.3), GOLD); glow(box('', C.gold, -4.6 + 1.5, 2.0 + 1 * 0.6, 0.65, 0.5, 0.3), GOLD);
  say('算一個子問題要看幾個子問題？', '兩個');
  await step(tok);                                   // 2990.3 max of two: constant time
  Fm('子問題數 nS × 每題 O(1)');
  say('兩個取 max：常數時間');
  await step(tok);                                   // 2996.0 total O(nS): polynomial?
  Fm('總時間 O(nS)：是多項式嗎？');
  say('總時間 O(nS)', '這是多項式嗎？');
  await step(tok);                                   // 3007.8 the same kind as Dijkstra? pseudo-polynomial
  box('Dijkstra：多項式', C.blue, 3.0, 5.2, 3.4, 0.7, 0.5, 1.2);
  box('Knapsack：pseudo-polynomial', C.orange, 3.0, 4.0, 3.8, 0.7, 0.5, 1.2);
  say('跟 Dijkstra 是同一種嗎？', '不是：pseudo-polynomial');
  await step(tok);                                   // 3023.7 S shows up in the running time
  Tb('問題：S 出現在執行時間裡');
  say('直覺：S 出現在執行時間裡');
  await step(tok);                                   // 3029.3 S is a property of the input numbers
  note('S 是輸入裡一個數字的「值」', 3.0, 2.8);
  say('S 是輸入數字的性質');
  await step(tok);                                   // 3033.4 not how many elements the input has
  note('不是輸入有幾個元素', 3.0, 2.1);
  say('不是輸入有幾個元素');
  await step(tok);                                   // 3035.8 what's inside one element: let's see why
  ok('要看元素「裡面」：來看實際例子', 0, 1.4);
  say('而是一個元素裡面裝什麼', '來看為什麼這很重要');
}]);

// 51:06 32-bit vs 64-bit；b = log S → 時間 n·2ᵇ：pseudo-polynomial
FRAG.push(['dpmit1-pseudo-bits', '32-bit vs 64-bit：為什麼是 pseudo', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const Tb = board(0, 7.7, 0, 'ptr'), Fm = board(0, 6.9, 0, 'ptr alt'), Nb = board(0, -0.8, 0.6, 'note');
  const bar = (x, h, c, label) => { const m = box('', c, x, 0.3 + h / 2, 1.0, h, 0.8); tag(label, 'idx', x, 0.6 + h + 0.25); return m; };
  await step(tok);                                   // 3066.8 a 100-item input
  Tb('實際例子：100 個物品');
  say('實際例子：100 個物品的輸入');
  await step(tok);                                   // 3076.4 the worst-case input on a 32-bit machine
  say('32-bit 機器上的最壞輸入');
  const inp = [];
  await step(tok);                                   // 3085.5 the input: n = 3 first
  inp.push(box('3', C.purple, -4.4, 5.6, 0.7, 0.6, 0.5, 1.2)); tag('n', 'idx', -4.4, 6.3);
  say('輸入長這樣：先是物品數 3');
  await step(tok);                                   // 3092.7 then weight and value per item
  say('然後每個物品的重量和價值');
  await step(tok);                                   // 3097.9 the weights 4, 2, 3
  [4, 2, 3].forEach((v, k) => inp.push(box(String(v), C.orange, -3.2 + k * 0.85, 5.6, 0.7, 0.6, 0.5, 1.2))); tag('重量', 'idx', -2.35, 6.3);
  say('三個重量：4、2、3');
  await step(tok);                                   // 3110.8 the values 10, 4, 7
  [10, 4, 7].forEach((v, k) => inp.push(box(String(v), C.teal, -0.4 + k * 0.85, 5.6, 0.7, 0.6, 0.5, 1.2))); tag('價值', 'idx', 0.45, 6.3);
  say('三個價值：10、4、7');
  await step(tok);                                   // 3122.6 the values are irrelevant
  for (let k = 4; k < 7; k++) dimm(inp[k]);
  say('價值跟分析無關', '先不管');
  await step(tok);                                   // 3129.5 weights between 0 and S
  Nb('每個重量都在 0 … S 之間（比 S 大的根本不會拿）');
  say('重量要在 0 到 S 之間', '大於 S 的不可能拿');
  await step(tok);                                   // 3140.8 how many bits: log S
  tag('每個 log S bits', 'idx', -2.35, 4.95);
  say('每個重量要幾個 bits？', 'O(log S)');
  await step(tok);                                   // 3157.7 times the number of items
  Fm('輸入大小 ≈ n · log S bits');
  say('乘上物品數', 'n log S');
  await step(tok);                                   // 3169.4 + log n is smaller: input size
  Fm('輸入大小 = O(n log S) bits（log n 較小，忽略）');
  say('這就是輸入大小', 'O(n log S) bits');
  await step(tok);                                   // 3179.5 32-bit: about 3200 bits
  tag('32-bit', 'ptr', -3.6, -0.2 + 0.0);
  bar(-4.3, 1.0, C.teal, '輸入 ≈ 3200 bits');
  say('32-bit：100 個 32-bit 數字', '輸入約 3200 bits');
  await step(tok);                                   // 3207.8 the worst S: about 4×10⁹
  note('S 最大 ≈ 4×10⁹', -5.7, 2.4);
  say('S 最大約 4 × 10⁹');
  await step(tok);                                   // 3227.6 n·S ≈ 4×10¹¹ operations
  bar(-2.9, 11.6 * 0.3, C.red, '≈ 4×10¹¹ 次');
  say('運算次數 ≈ n · S', '≈ 4 × 10¹¹');
  await step(tok);                                   // 3249.8 now a 64-bit machine
  tag('64-bit', 'ptr', 3.6, -0.2);
  say('換成 64-bit 機器', '還是 100 個物品');
  await step(tok);                                   // 3281.1 each weight 64 bits
  bar(2.9, 2.0, C.teal, '輸入 ≈ 6400 bits');
  say('每個重量 64 bits', '輸入只變 2 倍');
  await step(tok);                                   // 3297.9 S ≈ 1.6×10¹⁹ → 10²¹ operations
  const hi = bar(4.3, 21.2 * 0.3, C.red, '≈ 10²¹ 次'); glow(hi, RED);
  note('S ≈ 2⁶⁴ ≈ 1.8×10¹⁹', 6.0, 2.4);
  say('S ≈ 1.8 × 10¹⁹（老師說 1.6）', '運算 ≈ 10²¹');
  await step(tok);                                   // 3315.1 I increased the word size
  glow(hi, null);
  Nb('只是把 word size 加大（紅柱是 log 刻度）');
  say('只是加大 word size');
  await step(tok);                                   // 3318.1 time grows quadratically: not polynomial
  Tb('word size ×2 → 時間平方倍：不是多項式成長');
  say('執行時間平方倍成長', '這不是多項式的增加');
  await step(tok);                                   // 3328.8 write log S as b
  Fm('令 b = log S');
  say('問題在哪？', '令 b = log S');
  await step(tok);                                   // 3345.4 input size n·b
  Fm('b = log S：輸入大小 n · b');
  say('輸入大小：n · b');
  await step(tok);                                   // 3350.9 running time n·S = n·2ᵇ
  Fm('b = log S：輸入 n · b，時間 n · S = n · 2ᵇ');
  say('執行時間 n · S', '而 S = 2ᵇ');
  await step(tok);                                   // 3372.4 the input is polynomial in n and b
  say('輸入大小是 n、b 的多項式');
  await step(tok);                                   // 3377.2 but b is in the exponent of the time
  Nb('時間裡 b 跑到指數上 → 對輸入大小是指數');
  say('時間裡 b 卻在指數上', '數字寬度加倍 → 時間平方');
  await step(tok);                                   // 3393.6 written O(nS) it looks polynomial
  Tb('O(nS) 看起來像多項式……');
  say('寫成 O(nS) 看起來像多項式');
  await step(tok);                                   // 3400.8 not really: pseudo = fake
  Tb('O(nS)：pseudo-polynomial（假的多項式）');
  say('但不是真的', 'pseudo = 假的');
  await step(tok);                                   // 3410.5 not exponential either: try all subsets is 2ⁿ·n
  Nb('也不是一般的指數：真正的指數做法是試所有子集合 O(2ⁿ · n)');
  say('也不是指數演算法', '真正的指數：試所有子集合 O(2ⁿ · n)');
}]);

// 57:13 pseudo-polynomial = 小心陷阱：數字的值出現在時間裡
FRAG.push(['dpmit1-pseudo-trap', 'Pseudo-polynomial 的意思：小心陷阱', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const Tb = board(0, 7.6, 0, 'ptr'), Nb = board(0, 0.4, 0.6, 'note');
  const L = -3.4, R = 3.4;
  await step(tok);                                   // 3433.6 double the items: polynomial growth
  tag('物品數 ×2', 'ptr', L, 6.6);
  const a = buddy('n', '×2', C.sky, L - 0.8, 3.0, 0, 0.8), at = box('時間 ×2', C.teal, L + 0.9, 3.4, 1.8, 0.8, 0.6, 1.2);
  a.mood('happy');
  say('物品數加倍、word size 不變', '時間多項式成長');
  await step(tok);                                   // 3443.4 change the number width: exponential growth
  tag('數字寬度 ×2', 'ptr', R, 6.6);
  const b = buddy('b', '×2', C.peach, R - 0.8, 3.0, 0, 0.8), bt = box('時間 平方！', C.red, R + 0.9, 4.0, 1.8, 2.0, 0.6, 1.2);
  b.mood('sad');
  say('數字寬度加倍', '時間指數成長');
  await step(tok);                                   // 3447.3 pseudo-polynomial: watch out, a trap
  Tb('pseudo-polynomial = 小心，有陷阱');
  say('pseudo-polynomial 的意思', '小心，有陷阱');
  await step(tok);                                   // 3451.8 widen the numbers: bad stuff
  glow(bt, RED);
  say('把數字寬度加大', '時間就爆了');
  await step(tok);                                   // 3459.8 Dijkstra: count vertices and edges
  glow(bt, null);
  Nb('Dijkstra：只數頂點數、邊數，不用看數字多大');
  say('對照 Dijkstra', '只數頂點、邊，不看數字大小');
  await step(tok);                                   // 3479.9 an input number in the time → a trap
  Tb('輸入裡某個數字的「值」出現在時間裡 → pseudo-polynomial');
  say('輸入數字的值出現在時間裡', '（而不是數字的個數）→ 陷阱');
  await step(tok);                                   // 3504.8 "S is constant"? then everything is O(1)
  Nb('「S 是常數」？那宇宙原子 10⁸⁰ 也是常數 → 什麼都 O(1)，分析就沒意義');
  say('不能說 S 是常數', '不然什麼演算法都是 O(1)');
  await step(tok);                                   // 3518.6 draw a line: it depends on the field size
  say('要畫一條線', '時間跟數字寬度有關，就要把寬度當成會變大的量');
  await step(tok);                                   // 3528.8 asymptotics: how do algorithms scale?
  Nb('漸近分析：資料變大時，時間怎麼成長？');
  say('漸近分析看的是', '資料越來越大時時間怎麼成長');
  await step(tok);                                   // 3535.9 bigger word size → time explodes
  b.mood('wow');
  Nb('pseudo-polynomial 提醒：換更大的 word size，時間會爆');
  say('換更大的 word size', '時間會爆，不會線性成長');
}]);

// 60:01 對照 Dijkstra：輸入 log V + E(log V + log W) bits；時間 E + V log V ≤ E·v；W 不在時間裡
FRAG.push(['dpmit1-dijkstra-input', '對照 Dijkstra：權重的大小不在時間裡', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Tb = board(0, 7.7, 0, 'ptr'), Fm = board(0, 3.4, 0.4, 'ptr alt'), Nb = board(0, 0.2, 0.6, 'note');
  const Y = 5.6;
  let V = null; const ws = [];
  await step(tok);                                   // 3600.2 the input to Dijkstra: a graph
  Tb('Dijkstra 的輸入：一張圖');
  say('Dijkstra 的輸入是什麼？', '一張圖');
  await step(tok);                                   // 3610.7 the number of nodes: one number
  V = box('5', C.purple, -5.4, Y, 0.8, 0.6, 0.5, 1.3); tag('V', 'idx', -5.4, Y + 0.7);
  say('先是節點數：一個數字');
  await step(tok);                                   // 3614.8 log V bits
  tag('log V bits', 'idx', -5.4, Y - 0.7);
  say('它有 log V 個 bits');
  await step(tok);                                   // 3621.0 each edge: three numbers
  say('每條邊：三個數字');
  await step(tok);                                   // 3626.3 first vertex, second vertex, weight
  const e1 = [box('u', C.blue, -3.8, Y, 0.7, 0.6, 0.5, 1.3), box('v', C.blue, -2.95, Y, 0.7, 0.6, 0.5, 1.3), box('w', C.orange, -2.05, Y, 0.85, 0.6, 0.5, 1.3)];
  say('起點、終點、權重');
  await step(tok);                                   // 3633.6 log V, log V, log W
  tag('log V', 'idx', -3.8, Y - 0.7); tag('log V', 'idx', -2.95, Y - 0.7); tag('log W', 'idx', -2.05, Y - 0.7);
  say('各要 log V、log V、log W bits', 'W = 最大的權重');
  await step(tok);                                   // 3664.5 input size: log V + E(log V + log W)
  Fm('輸入 = log V + E · (log V + log W) bits');
  say('E 條邊、一個頂點數', '輸入大小');
  await step(tok);                                   // 3710.1 a graph with 5 nodes: edge 1→2, weight 3
  e1.forEach((m, k) => relabel(m, ['1', '2', '3'][k])); ws.push(e1[2]);
  say('例：5 個節點', '邊 1→2，權重 3');
  await step(tok);                                   // 3718.4 an edge 1→5, weight 4
  const e2 = [box('1', C.blue, -0.6, Y, 0.7, 0.6, 0.5, 1.3), box('5', C.blue, 0.25, Y, 0.7, 0.6, 0.5, 1.3), box('4', C.orange, 1.15, Y, 0.85, 0.6, 0.5, 1.3)];
  ws.push(e2[2]); tag('…', 'ptr', 2.4, Y);
  say('邊 1→5，權重 4', '…');
  await step(tok);                                   // 3745.0 the whole graph as a list of numbers
  bubble('整張圖 = 一串數字', 4.6, Y);
  say('整張圖就是一串數字');
  await step(tok);                                   // 3757.9 little v = log V, w = log W
  Fm('令 v = log V、w = log W');
  say('令 v = log V、w = log W');
  await step(tok);                                   // 3774.7 input: O(E(v + w) + v) bits
  Fm('輸入 = O(E(v + w) + v) bits');
  say('輸入大小', 'O(E(v + w) + v)');
  await step(tok);                                   // 3795.3 how many operations?
  Fm('輸入 = O(E(v + w) + v) bits；運算數 = ?');
  say('Dijkstra 要做幾次運算？');
  await step(tok);                                   // 3813.1 E + V log V
  const t = tag('運算 E + V log V', 'ptr', 0, 2.5);
  say('E + V log V', '理論上最快');
  await step(tok);                                   // 3817.0 at most E log V
  txt(t, '運算 E + V log V ≤ E log V');
  say('小於 E log V', '方便計算');
  await step(tok);                                   // 3835.5 E log V = E · v
  txt(t, '運算 ≤ E log V = E · v');
  say('E log V = E · v');
  await step(tok);                                   // 3844.6 bits vs operations: any exponential?
  Nb('輸入 E(v + w) bits ↔ 運算 E · v：哪裡有指數？');
  say('輸入 E(v + w)、運算 E·v', '有指數嗎？');
  await step(tok);                                   // 3906.1 polynomial in the input size
  ok('沒有：對輸入大小是多項式', 0, 1.6);
  say('沒有', '運算數是輸入大小的多項式');
  await step(tok);                                   // 3947.5 weights 32-bit → 64-bit
  ws.forEach((m) => { m.scale.set(1.7, 1, 1); glow(m, GOLD); });
  Nb('權重從 32-bit 換成 64-bit');
  say('把權重從 32-bit 換成 64-bit');
  await step(tok);                                   // 3955.1 nothing happens: W isn't in the time
  ws.forEach((m) => glow(m, null));
  Nb('運算數完全不變：W 沒出現在時間裡');
  say('執行時間：沒變', 'W 不在運算數裡');
  await step(tok);                                   // 3980.8 RAM: arithmetic is O(1)
  Nb('RAM 模型：任何算術運算 O(1)（數字變大只影響每次運算的成本）');
  say('RAM 模型：算術運算 O(1)');
  await step(tok);                                   // 3990.1 knapsack: a number from the input was in the time
  const k = box('Knapsack：O(nS)，S 在時間裡', C.red, 0, 1.0, 5.0, 0.7, 0.6, 1.4);
  glow(k, RED);
  say('Knapsack：輸入裡的 S', '直接出現在執行時間裡');
  await step(tok);                                   // 4016.3 a polynomial knapsack algorithm ⇒ P = NP
  glow(k, null);
  Nb('Knapsack 找到真正的多項式解 → 證明 P = NP，拿百萬美元');
  say('找到 knapsack 的多項式解', '就證明了 P = NP');
  await step(tok);                                   // 4029.6 is counting sort pseudo-linear?
  bubble('counting sort 也是嗎？', -4.6, 2.4);
  say('學生問：counting sort 呢？');
  await step(tok);                                   // 4093.1 linear in the range, not the input → radix sort
  Nb('counting sort 對「值的範圍」線性，不是對輸入大小 → 所以用 radix sort');
  say('對範圍線性，不是對輸入大小', '所以實際用 radix sort');
  await step(tok);                                   // 4124.8 pure counting sort on 64-bit numbers: out of RAM
  Nb('64-bit 數字直接 counting sort：記憶體不夠');
  say('64-bit 數字直接 counting sort', '記憶體會不夠');
}]);
  }

  // ═══ dpmit2.js ═══
  {
// ─── MIT 6.006 Fall 2011：Rec19 IFrvgSvZA0I（DP：Crazy Eights、Shortest Path）、Rec20 jZbkToeNK2g（DP：Blackjack、LIS） ───
// Cued scenes: every `await step(tok)` waits until the lecturer says that sentence; the motion after it is
// short (≤ 2.5 s) and then the picture holds. The comment on each step gives its cue time (seconds).
// 老師的例子：Crazy Eights（like = 同數字／同花色／有 8；假 source、權重 −1、Bellman-Ford O(n³) vs DAG O(n²)）、
// DAG S A B C D E F G（d(S,A)=1、d(S,B)=2、d(S,C)=3、d(S,D)=4，C→G 讓 BFS 出錯）、曼哈頓格子 d(i,j)、optimal substructure、
// 有環的 S→A→B→C→A（1, −1, 1, 1）→ 分層 d_k = Bellman-Ford；blackjack 的 round_outcome(i, h)、邊 i → i+O[0] 權重 −O[1]、
// dp[i] = max(O[1] + dp[i+O[0]])、走人 = 0、parent pointer (值, h)；LIS 8 3 5 2 4 9 7 11。
// 板書看不到的權重、牌面為自擬（標在 notes 的 trap）。Blackjack DP 實跑用本模組的 DECK / bjPlay。
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, step, buddy, prop, bob, travel, remove, GOLD, GREEN, RED, GRAY } = K;
const say = (a, b = '') => ctx.say(a, b);
const beat = ctx.beat;
const M = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', brown: '#6e5f49', gold: '#c08a1f', ink: '#3a3328', card: '#fbf7f0', cardR: '#f6dede', ok: '#1f9e6e', faint: '#cfc6b4', sky: '#dbe9f7', you: '#f2d37a', lilac: '#c4b3f7' };
const mBox = (t, c, x, y, w = 0.8, h = 0.8, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
// a curved edge (quadratic bezier bulging by h) with an arrowhead at the end
function mArc(x1, y1, x2, y2, h, color = M.gold, z = 0.1) {
  const N = 10, pts = [], cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 + 2 * h;
  for (let k = 0; k <= N; k++) { const t = k / N; pts.push([(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2]); }
  const objs = [];
  for (let k = 0; k < N - 1; k++) objs.push(line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], z, color));
  objs.push(arrow(V3(pts[N - 1][0], pts[N - 1][1], z), V3(pts[N][0], pts[N][1], z), color));
  return { objs, mid: pts[N / 2], kill() { objs.forEach(kill); } };
}
// a straight edge between two node centres, trimmed by r at both ends
function mEdge(a, b, color = M.brown, r = 0.5, z = 0) {
  const d = V3(b[0] - a[0], b[1] - a[1], 0).normalize();
  const h = arrow(V3(a[0] + d.x * r, a[1] + d.y * r, z), V3(b[0] - d.x * r, b[1] - d.y * r, z), color);
  return { objs: [h], kill() { kill(h); } };
}
function mCol(e, c) { e.objs.forEach((o) => { if (o.setColor) o.setColor(c); else o.material.color.set(c); }); }
const mArcH = (span) => 0.25 + 0.22 * span;
// a label spot that replaces itself, so an old line never lingers
function board(x, y, z = 0, cls = 'say') { let l = null; return (t) => { if (l) remove(l); l = t ? tag(t, cls, x, y, z) : null; return l; }; }
// a little packet that travels from a to b and stays there
async function pkt(tok, t, a, b, ms = 700, cls = 'pkt') { const l = tag(t, cls, a.x, a.y, a.z); await travel(tok, l, a, b, ms); return l; }
// the learner: a little character who watches and reacts
const me = (x, y, z = 1.0, s = 0.7, name = '你') => buddy(name, '', M.you, x, y, z, s);
async function walk(tok, b, x, ms = 600) { const a = b.g.position.clone(), e = V3(x, a.y, a.z); await anim(tok, ms, (u) => b.g.position.lerpVectors(a, e, u)); }
const strike = (l) => { l.element.style.textDecoration = 'line-through'; l.element.style.opacity = '0.6'; };
const cls = (l, c) => { l.element.className = 'lab-label ' + c; };

// ── 共用：DAG S…G（老師的 d(S,A)=1、d(S,B)=2、d(S,C)=3、d(S,D)=4；其餘權重自擬） ──
const DG = { S: [0, 7.0], A: [-3, 5.2], B: [0, 5.2], C: [3, 5.2], D: [-3, 3.2], E: [0, 3.2], F: [3, 3.2], G: [0, 1.0] };
const DE = [['S', 'A', 1], ['S', 'B', 2], ['S', 'C', 3], ['A', 'D', 3], ['B', 'D', 3], ['A', 'E', 4], ['B', 'E', 1], ['C', 'E', 2],
  ['D', 'F', 1], ['E', 'F', 3], ['C', 'F', 5], ['E', 'G', 4], ['F', 'G', 1], ['C', 'G', 4]];
const DORD = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const DD = (() => { const d = { S: 0 }; for (const v of DORD.slice(1)) d[v] = Math.min(...DE.filter((e) => e[1] === v).map((e) => d[e[0]] + e[2])); return d; })();
function mDag() {
  const nodes = {}, edges = {}, wl = {};
  for (const v of DORD) nodes[v] = mBox(v, v === 'S' ? M.orange : M.sand, DG[v][0], DG[v][1], 0.8, 0.8, 0.5);
  for (const [u, v, w] of DE) {
    const a = DG[u], b = DG[v];
    if (u === 'D' && v === 'F') { edges[u + v] = mArc(a[0] + 0.3, a[1] - 0.45, b[0] - 0.3, b[1] - 0.45, -0.5, M.brown, 0); wl[u + v] = tag(String(w), 'idx', 0.9, 2.45); }
    else { edges[u + v] = mEdge(a, b); wl[u + v] = tag(String(w), 'idx', a[0] + 0.35 * (b[0] - a[0]) + 0.22, a[1] + 0.35 * (b[1] - a[1]) + 0.15); }
  }
  return { nodes, edges, wl };
}
function mDagReset(G) { DE.forEach(([u, v]) => mCol(G.edges[u + v], M.brown)); DORD.forEach((v) => glow(G.nodes[v], null)); }

// ── 共用：Crazy Eights 的牌（板書看不清，牌面自擬，但符合老師問的幾組 like） ──
const CE = [['4', '♦'], ['5', '♥'], ['8', '♦'], ['7', '♥'], ['7', '♠'], ['5', '♠'], ['9', '♦']];
const ceLike = (a, b) => a[0] === b[0] || a[1] === b[1] || a[0] === '8' || b[0] === '8';
const ceCol = (c) => (c[1] === '♦' || c[1] === '♥' ? M.cardR : M.card);

// ── 共用：曼哈頓格子 5 × 4（權重自擬）；節點、邊、權重分開畫 ──
const GN = 5, GM = 4;
const gwh = (i, j) => ((i * 7 + j * 3) % 5) + 1;   // (i,j) → (i,j+1)
const gwv = (i, j) => ((i * 3 + j * 5) % 4) + 1;   // (i,j) → (i+1,j)
const GDIST = (() => { const d = {}; for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { if (i === 1 && j === 1) { d['1,1'] = 0; continue; } const c = []; if (i > 1) c.push(d[(i - 1) + ',' + j] + gwv(i - 1, j)); if (j > 1) c.push(d[i + ',' + (j - 1)] + gwh(i, j - 1)); d[i + ',' + j] = Math.min(...c); } return d; })();
function mGrid(x0, y0, dx, dy, drop = 0) {
  const P = (i, j) => [x0 + (j - 1) * dx, y0 - (i - 1) * dy], n = {}, eh = {}, ev = {}, wl = [];
  for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { const p = P(i, j); n[i + ',' + j] = mBox('', M.sand, p[0], p[1], 0.5, 0.5, 0.3, drop); }
  return {
    P, n, eh, ev, wl,
    edges() { for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { const p = P(i, j); if (j < GM) eh[i + ',' + j] = mEdge(p, P(i, j + 1), M.brown, 0.32); if (i < GN) ev[i + ',' + j] = mEdge(p, P(i + 1, j), M.brown, 0.32); } },
    weights() { for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { const p = P(i, j); if (j < GM) wl.push(tag(String(gwh(i, j)), 'idx', p[0] + dx / 2, p[1] + 0.22)); if (i < GN) wl.push(tag(String(gwv(i, j)), 'idx', p[0] + 0.22, p[1] - dy / 2)); } },
  };
}

// ── 共用：分層圖（S→A 1、A→B −1、B→C 1、C→A 1） ──
const LV = ['S', 'A', 'B', 'C'], LY = { S: 6.2, A: 4.7, B: 3.2, C: 1.7 }, LX = (k) => -4.5 + k * 3.0;
const LE = [['S', 'A', 1], ['A', 'B', -1], ['B', 'C', 1], ['C', 'A', 1]];
const LD = (() => { const d = [{ S: 0, A: Infinity, B: Infinity, C: Infinity }]; for (let k = 1; k <= 3; k++) { const r = { S: Infinity, A: Infinity, B: Infinity, C: Infinity }; for (const [u, v, w] of LE) r[v] = Math.min(r[v], d[k - 1][u] + w); d.push(r); } return d; })();
const inf = (x) => (x === Infinity ? '∞' : String(x).replace('-', '−'));
const wtxt = (w) => String(w).replace('-', '−');
function mLayers() {
  const n = {}, e = [], wl = [], kt = [];
  for (let k = 0; k <= 3; k++) kt.push(tag('k = ' + k, 'ptr', LX(k), 7.3));
  for (let k = 0; k <= 3; k++) for (const v of (k === 0 ? ['S'] : LV)) n[v + k] = mBox(v + k, v === 'S' ? M.orange : M.sand, LX(k), LY[v], 0.8, 0.6, 0.4);
  for (let k = 0; k < 3; k++) for (const [u, v, w] of LE) if (n[u + k]) {
    const a = [LX(k), LY[u]], b = [LX(k + 1), LY[v]];
    const ed = mEdge(a, b, M.brown, 0.5); ed.u = u + k; ed.v = v + (k + 1);
    const l = tag(wtxt(w), 'idx', a[0] + 0.3 * (b[0] - a[0]), a[1] + 0.3 * (b[1] - a[1]) + 0.2); l.w = w; wl.push(l);
    e.push(ed);
  }
  return { n, e, wl, kt };
}

// ── 共用：一排節點／格子（blackjack） ──
const RX = (k) => -5.85 + k * 0.9;
function mRow(y, n, lab, size = 0.6, color = M.sand, drop = 0) { const r = []; for (let k = 0; k < n; k++) r.push(mBox(lab ? lab(k) : String(k), color, RX(k), y, size, size, 0.4, drop)); return r; }

// ── 共用：LIS 8 3 5 2 4 9 7 11 ──
const LA = [8, 3, 5, 2, 4, 9, 7, 11];
const LISDP = (() => { const n = LA.length, d = Array(n).fill(1); for (let i = n - 1; i >= 0; i--) for (let j = i + 1; j < n; j++) if (LA[j] > LA[i]) d[i] = Math.max(d[i], 1 + d[j]); return d; })();
const LXp = (k) => -4.9 + k * 1.4;
function mLisRow(y, withIdx = true, drop = 0) {
  if (withIdx) LA.forEach((v, k) => tag(String(k), 'idx', LXp(k), y + 0.8));
  return LA.map((v, k) => mBox(v, M.blue, LXp(k), y, 0.9, 0.9, 0.5, drop));
}

// ── Blackjack DP（本模組 DECK、bjPlay），walk = 是否可以走人（0） ──
function mBjSolve(walk) {
  const n = DECK.length, dp = Array(n + 1).fill(0), par = Array(n + 1).fill(null), tries = [];
  for (let i = n; i >= 0; i--) {
    tries[i] = [];
    for (let h = 0; h <= n; h++) { const r = bjPlay(DECK, i, h); if (!r) break; tries[i].push({ h, out: r.out, j: r.j, v: r.out + dp[r.j] }); }
    let best = walk || !tries[i].length ? { v: 0, h: -1, j: n } : null;
    for (const t of tries[i]) if (!best || t.v > best.v) best = t;
    dp[i] = best.v; par[i] = best;
  }
  return { dp, par, tries };
}
const sgn = (x) => (x > 0 ? '+' + x : String(x).replace('-', '−'));
const nm = (x) => (x < 0 ? '(−' + (-x) + ')' : String(x));
const mn = (x) => String(x).replace('-', '−');

// ════════════════ IFrvgSvZA0I（MIT 6.006 Rec19：Crazy Eights、Shortest Path） ════════════════

// 00:21 圖 → DP：不建圖，直接算數字
FRAG.push(['dpmit2-graph-vs-dp', '從圖到 DP：不建圖，直接算數字', async (tok) => {
  fresh([0, 3.4, 13], [0, 3.2, 0]);
  const gx = (k) => -5.4 + k * 1.0, ax = (k) => 1.4 + k * 1.0;
  const you = me(-0.2, 0.2, 1.2, 0.75);
  const succ = { 0: [1, 2], 1: [3], 2: [3, 4], 3: [4], 4: [] };
  await step(tok);                                   // 21.4 shortest paths; game states as nodes
  [0, 1, 2, 3, 4].map((k) => mBox('', M.sand, gx(k), 3.6, 0.6, 0.6, 0.4, 1.5));
  tag('遊戲的狀態 = 節點', 'say', -3.4, 6.4);
  you.look(-1);
  say('前幾週：把遊戲的「狀態」畫成節點', '然後跑 shortest path');
  await step(tok);                                   // 35.0 edges = moves
  for (const a in succ) for (const b of succ[a]) mArc(gx(+a), 3.95, gx(b), 3.95, mArcH(b - a) * 0.8, M.brown);
  tag('一步走法 = 一條邊', 'note', -3.4, 5.6);
  say('一步走法 = 一條邊', '先建圖，再跑演算法');
  await step(tok);                                   // 42.0 you can do it without thinking of a graph at all
  const cells = [0, 1, 2, 3, 4].map((k) => mBox('?', M.paper, ax(k), 3.6, 0.8, 0.7, 0.4, 1.5));
  [0, 1, 2, 3, 4].forEach((k) => tag(String(k), 'idx', ax(k), 4.4));
  tag('DP：只有一排數字', 'say', 3.4, 6.4);
  you.mood('wow'); you.look(1);
  say('其實可以完全不畫圖', '直接用 dynamic programming');
  await step(tok);                                   // 51.0 you can do better without building the graph
  const dp = {};
  for (let i = 4; i >= 0; i--) { dp[i] = succ[i].length ? Math.max(...succ[i].map((j) => dp[j])) + 1 : 0; relabel(cells[i], dp[i]); tint(cells[i], M.teal); await beat(tok, 300); }
  say('不建圖：一格一格直接把答案算出來', 'dp[i] = 從 i 出發最多還能走幾步');
  await step(tok);                                   // 54.0 code is smaller and runs faster
  tag('程式短 ✓　跑得快 ✓', 'good', 3.4, 1.9);
  you.mood('happy'); await you.hop(tok);
  say('好處：程式比較短、跑得比較快');
  await step(tok);                                   // 60.0 harder to understand: black magic
  tag('看不到背後的圖 → 像黑魔法', 'bad', 3.4, 1.1);
  you.mood('sad');
  say('壞處：比較難懂', 'DP 的程式看起來像黑魔法');
  await step(tok);                                   // 66.0 on the final: no partial credit for building a graph
  prop('file', -5.6, 0.2, 1.0, 0.9, '期末考');
  tag('要寫出正確的遞迴式', 'note', -3.6, 1.0, 1.0);
  you.mood('wow');
  say('期末考的 DP 題：「先建圖」拿不到部分分', '要真的懂，寫出對的式子');
  await step(tok);                                   // 90.0 DP = catchy name for optimization problems
  tag('DP = 「最佳化問題」的好聽名字', 'ptr alt', 0, 7.2);
  you.mood('calm');
  say('dynamic programming 只是個好聽的名字', '指的就是最佳化問題');
  await step(tok);                                   // 98.0 the minimum or the maximum of something
  tag('求某個東西的 min 或 max', 'say', 0, 6.4);
  say('要算某個東西的最小值或最大值', '例如最短路徑、最多賺多少');
}]);

// 01:43 Crazy Eights：like 的定義
FRAG.push(['dpmit2-crazy-like', 'Crazy Eights：同數字、同花色或有 8 就 like', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.6, 0]);
  const X = (k) => -4.2 + k * 1.4;
  const you = me(-5.9, 0.4, 1.0, 0.7);
  const top = board(0.6, 6.8);
  let cs = [], marks = [];
  const clear = () => { marks.forEach(remove); marks = []; cs.forEach((m) => glow(m, null)); };
  const mark = (a, b) => { const ok = ceLike(CE[a], CE[b]); glow(cs[a], ok ? GREEN : RED); glow(cs[b], ok ? GREEN : RED); marks.push(tag(ok ? '✓ like' : '✗ 不 like', ok ? 'good' : 'bad', (X(a) + X(b)) / 2, 4.9)); return ok; };
  const pair = (a, b, why) => { clear(); const ok = mark(a, b); marks.push(tag(why, 'note', (X(a) + X(b)) / 2, 1.7)); you.mood(ok ? 'happy' : 'sad'); return ok; };
  await step(tok);                                   // 102.5 this problem is called Crazy Eights
  const deck = []; for (let k = 0; k < 6; k++) deck.push(cube('', k === 5 ? M.cardR : M.card, [1.0, 1.4, 0.06], 0, 3.6 + k * 0.04, -k * 0.08));
  top('今天的題目：Crazy Eights（瘋狂 8）');
  say('從一個題目開始：Crazy Eights');
  await step(tok);                                   // 109.0 a shuffled deck; some cards are pulled out
  deck.forEach(kill);
  cs = CE.map((c, k) => mBox(c[0] + c[1], ceCol(c), X(k), 3.6, 1.0, 1.4, 0.08, 2));
  CE.forEach((c, k) => tag(String(k), 'idx', X(k), 2.5));
  top('洗好的牌 → 抽出一排');
  say('一副洗過的牌，抽出幾張排成一排', '（板書看不清，牌面為自擬）');
  await step(tok);                                   // 175.2 the longest crazy subsequence
  top('目標：最長的 crazy 子序列');
  you.mood('wow'); you.look(1);
  say('目標：找最長的 crazy subsequence');
  await step(tok);                                   // 183.0 two cards are like each other
  marks.push(tag('挑出來的牌：相鄰兩張要 like', 'note', 0.6, 5.7));
  say('crazy：挑出來的牌，相鄰兩張要互相 like');
  await step(tok);                                   // 189.0 same number, same suit, or one is an 8
  clear();
  tag('like = 同數字 ／ 同花色 ／ 其中一張是 8', 'note', 0.6, 5.9);
  you.mood('calm');
  say('like：數字一樣、花色一樣，或其中一張是 8');
  await step(tok);                                   // 201.0 an 8 is like anything else
  glow(cs[2], GOLD); marks.push(tag('8 = 萬用牌', 'good', X(2), 4.9));
  you.mood('happy'); await you.hop(tok);
  say('8 跟任何牌都 like', '所以叫 Crazy Eights');
  await step(tok);                                   // 211.3 4 and 8? 8 and 5?
  clear(); mark(0, 2); mark(2, 5);
  marks.push(tag('有 8 → 都 like', 'note', X(2), 1.7));
  say('4 和 8 like 嗎？8 和 5 呢？', '都 like：其中一張是 8');
  await step(tok);                                   // 226.9 5♥ and 9♦? no
  pair(1, 6, '數字不同、花色也不同');
  say('5♥ 和 9♦：不 like', '數字、花色都不一樣，也沒有 8');
  await step(tok);                                   // 233.5 5♥ and 7♥? yes
  pair(1, 3, '同花色 ♥');
  say('5♥ 和 7♥：like', '花色一樣');
  await step(tok);                                   // 240.2 5♠ and 7♥? no
  pair(5, 3, '數字不同、花色也不同');
  say('5♠ 和 7♥：不 like');
  await step(tok);                                   // 246.5 the longest possible subsequence
  clear();
  top('最長能挑出幾張？');
  you.mood('wow');
  say('想挑出最長的一串', '可以跳過牌，但不能重排');
}]);

// 04:28 建圖：假 source、往右的邊、權重 −1、Bellman-Ford O(n³)
FRAG.push(['dpmit2-crazy-graph', 'Crazy Eights 建圖：權重 −1，最長變最短', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const X = (k) => -3.9 + k * 1.3, Y = 3.0;
  const top = board(0, 7.2);
  const you = me(-1.2, -1.3, 1.0, 0.6);
  let ny = 1.8; const col = (t, c = 'say') => { const l = tag(t, c, 3.6, ny, 0.4); ny -= 0.62; return l; };
  let cs = [];
  await step(tok);                                   // 268.4 model it as a graph: all the cards are nodes
  cs = CE.map((c, k) => mBox(c[0] + c[1], ceCol(c), X(k), Y, 0.9, 1.1, 0.08, 1.5));
  top('建圖：每張牌 = 一個節點');
  say('怎麼畫成圖？', '每張牌是一個節點');
  await step(tok);                                   // 279.0 the longest path between what and what?
  top('要找最長路徑：從哪裡到哪裡？');
  you.mood('wow');
  say('要找最長的路徑', '可是起點、終點是誰？');
  await step(tok);                                   // 296.6 add a fake source
  mBox('s', M.orange, -5.8, 0.6, 0.7, 0.7, 0.4, 2);
  tag('假的起點', 'note', -5.8, -0.3);
  top('小技巧：加一個假的 source s');
  you.mood('calm');
  say('技巧：加一個假的起點 source', '把問題變成我們會的形式');
  await step(tok);                                   // 302.9 it connects to everything
  for (let k = 0; k < CE.length; k++) { mEdge([-5.8, 0.6], [X(k), Y], M.gold, 0.55); await beat(tok, 140); }
  say('s 連到每一張牌', '從哪張牌開始都可以');
  await step(tok);                                   // 312.1 the longest path starting from the source, anywhere
  top('答案 = 從 s 出發、走到任何地方的最長路徑');
  say('答案：從 s 出發的最長路徑', '終點是哪張牌都行');
  await step(tok);                                   // 331.0 edges are directed
  const e02 = mArc(X(0), Y + 0.6, X(2), Y + 0.6, mArcH(2), M.brown);
  top('邊有方向：兩張牌 like 才連');
  say('邊要有方向', '例：4♦ 和 8♦ like → 連一條邊');
  await step(tok);                                   // 358.3 they have to match in this order: only forward
  const back = mArc(X(3), Y + 0.6, X(1), Y + 0.6, mArcH(2), M.red), bk = tag('往回 ✗', 'bad', X(2), Y + 2.1);
  you.mood('sad');
  top('只能往前：不能重排');
  say('子序列要照原本的順序', '所以邊只能往右，不能往回');
  await step(tok);                                   // 365.0 four of diamonds, eight of diamonds, … nine of diamonds
  back.kill(); remove(bk);
  const e26 = mArc(X(2), Y + 0.6, X(6), Y + 0.6, mArcH(4), M.ok);
  mCol(e02, M.ok); [0, 2, 6].forEach((k) => glow(cs[k], GREEN));
  you.mood('happy');
  top('例：4♦ → 8♦ → 9♦');
  say('例：4♦、8♦、9♦', '不用全選，但要照原本的順序');
  await step(tok);                                   // 387.0 everything points right
  e02.kill(); e26.kill(); [0, 2, 6].forEach((k) => glow(cs[k], null));
  const arcs = [];
  for (let a = 0; a < CE.length; a++) for (let b = a + 1; b < CE.length; b++) if (ceLike(CE[a], CE[b])) { arcs.push(mArc(X(a), Y + 0.6, X(b), Y + 0.6, mArcH(b - a), M.brown)); await beat(tok, 90); }
  top('所有的邊都往右指');
  say('所有的邊都往右指', '只連「在後面、而且 like」的牌');
  await step(tok);                                   // 441.1 we only have algorithms for shortest paths
  top('可是我們只會算「最短」路徑…');
  you.mood('sad');
  say('問題：我們沒有求最長路徑的演算法', '只會求最短路徑');
  await step(tok);                                   // 448.0 make the weights negative
  arcs.forEach((e) => tag('−1', 'idx', e.mid[0], e.mid[1] + 0.2));
  top('每條邊的權重：1 → −1');
  you.mood('happy');
  say('把權重變負的：每條邊 1 → −1', '最長的路徑 = 最短（最負）的路徑');
  await step(tok);                                   // 461.0 no cycles: the answer is well defined
  col('沒有環 → 答案有定義 ✓', 'good');
  say('圖裡沒有環', '最短路徑不會無限變小，答案有定義');
  await step(tok);                                   // 481.8 Bellman-Ford
  col('用 Bellman-Ford', 'ptr alt');
  you.mood('calm');
  say('會解這題的演算法：Bellman-Ford', '可以處理負的權重');
  await step(tok);                                   // 495.4 n cards: vertices = n + 1 = O(n)
  col('V = n + 1 = O(n)');
  say('n 張牌：節點 = n 張牌 + source', 'V = O(n)');
  await step(tok);                                   // 505.3 edges, worst case: O(n²)
  col('E = O(n²)（最壞：每對都 like）');
  say('邊最多幾條？每一對牌都可能有邊', 'E = O(n²)');
  await step(tok);                                   // 525.0 Bellman-Ford is V times E (not V + E)
  const v1 = col('Bellman-Ford：O(V × E)', 'note');
  tag('不是 V + E', 'bad', 6.3, ny + 0.62, 0.4);
  say('Bellman-Ford 是 V × E', '黑板一度寫成 V + E，學生糾正了');
  await step(tok);                                   // 557.0 n cubed
  col('O(n) × O(n²) = O(n³)', 'bad');
  glow(cs[0], null); you.mood('wow');
  say('總共 O(n³)', '能不能更快？');
}]);

// 09:24 DAG 的距離公式
FRAG.push(['dpmit2-dag-formulas', 'DAG 最短路徑：d(S,v) = min(入邊起點 + 權重)', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.0, 0]);
  const top = board(0, 8.2), fm = board(0.4, -0.2, 0.5, 'note'), side = board(5.0, 3.6, 0.3, 'good');
  const you = me(-5.6, 0.0, 1.0, 0.7);
  let G = null; const vt = {};
  const val = (v) => { txt(vt[v], String(DD[v])); tint(G.nodes[v], M.teal); glow(G.nodes[v], null); };
  const hl = (u, v, c = M.gold) => { mCol(G.edges[u + v], c); glow(G.nodes[u], GOLD); };
  async function walkPath(path, ms = 550) {
    const p = tag('走', 'pkt', DG[path[0]][0], DG[path[0]][1] + 0.6, 0.6);
    for (let k = 1; k < path.length; k++) await travel(tok, p, p.position.clone(), V3(DG[path[k]][0], DG[path[k]][1] + 0.6, 0.6), ms);
    return p;
  }
  await step(tok);                                   // 564.2 a better way: directed acyclic graph shortest paths
  top('更好的方法：DAG 的最短路徑');
  you.mood('wow');
  say('有更好的解法', '利用 DAG（有向無環圖）的最短路徑演算法');
  await step(tok);                                   // 580.2 S, A, B, C …
  G = mDag(); DORD.forEach((v) => { vt[v] = tag('?', 'ptr alt', DG[v][0] + 0.75, DG[v][1] + 0.35); });
  top('例子：S、A、B、C、D、E、F、G');
  you.mood('calm');
  say('換一個小一點的 DAG 來看', '求 S 到每個點的最短距離（權重自擬）');
  await step(tok);                                   // 627.8 acyclic: all the edges point downwards
  DE.forEach(([u, v]) => mCol(G.edges[u + v], M.gold)); await beat(tok, 900); mDagReset(G);
  tag('↓ 邊都往下 → 沒有環', 'good', 5.0, 6.0, 0.3);
  say('所有的邊都往下指', '所以沒有環：acyclic');
  await step(tok);                                   // 641.0 distance from the source to itself
  val('S'); fm('d(S,S) = 0');
  say('S 到自己：距離 0');
  await step(tok);                                   // 649.7 SA is 1, SB is 2, SC is 3
  ['A', 'B', 'C'].forEach(val); fm('d(S,A) = 1　d(S,B) = 2　d(S,C) = 3');
  say('簡單的先填', 'd(S,A) = 1、d(S,B) = 2、d(S,C) = 3');
  await step(tok);                                   // 661.2 the distance from S to D: how?
  glow(G.nodes.D, GOLD); fm('d(S,D) = ?');
  you.mood('wow');
  say('S 到 D 呢？要怎麼算？');
  await step(tok);                                   // 672.4 it's four
  txt(vt.D, '4');
  fm('d(S,D) = 4');
  say('答案是 4', '可是要寫成一般的公式');
  await step(tok);                                   // 676.6 the minimum of two paths
  hl('A', 'D'); hl('B', 'D');
  fm('d(S,D) = min( d(S,A) + w(A,D) ,  d(S,B) + w(B,D) )');
  you.mood('calm');
  say('兩條路取比較短的', 'D 的入邊有兩條：從 A 來、從 B 來');
  await step(tok);                                   // 687.0 a path from S to A, then the edge A to D
  mCol(G.edges.SA, M.ok); mCol(G.edges.AD, M.ok); glow(G.nodes.A, GREEN);
  const p1 = await walkPath(['S', 'A', 'D']);
  say('第一條：先走到 A（1），再走 A→D（3）', '1 + 3 = 4');
  await step(tok);                                   // 697.6 a path from S to B and the weight B to D
  remove(p1);
  mCol(G.edges.SB, M.orange); mCol(G.edges.BD, M.orange); glow(G.nodes.B, GOLD);
  const p2 = await walkPath(['S', 'B', 'D']);
  say('第二條：先走到 B（2），再走 B→D（3）', '2 + 3 = 5');
  await step(tok);                                   // 703.0 SA and SB are already known: well defined
  remove(p2);
  side('A、B 已經算好 → 馬上能算');
  fm('d(S,D) = min(1 + 3, 2 + 3) = 4');
  you.mood('happy');
  say('d(S,A)、d(S,B) 都已經知道', '所以 d(S,D) 可以直接算出來');
  await step(tok);                                   // 716.2 recursion, but no infinite recursion
  val('D'); mDagReset(G); ['S', 'A', 'B', 'C', 'D'].forEach((v) => tint(G.nodes[v], M.teal));
  side('有遞迴，但不會無限遞迴');
  say('有遞迴，但不會沒完沒了', '要的值都已經算好了');
  await step(tok);                                   // 739.0 how about SE? the formula?
  side(null);
  ['A', 'B', 'C'].forEach((u) => hl(u, 'E')); glow(G.nodes.E, GOLD);
  fm('d(S,E) = min( d(S,A) + 4 ,  d(S,B) + 1 ,  d(S,C) + 2 )');
  say('S 到 E：E 有三條入邊', '從 A、B、C 來，各算一次取最小');
  await step(tok);                                   // 789.5 B to E
  mDagReset(G); mCol(G.edges.BE, M.ok); val('E');
  fm('d(S,E) = min(1 + 4, 2 + 1, 3 + 2) = 3');
  say('最好的是從 B 走過來', 'd(S,E) = 2 + 1 = 3');
  await step(tok);                                   // 800.3 F: d(S,D) + w(D,F), d(S,E) + w(E,F)
  mDagReset(G); hl('D', 'F'); hl('E', 'F'); glow(G.nodes.F, GOLD);
  fm('d(S,F) = min( d(S,D) + 1 ,  d(S,E) + 3 ,  … )');
  say('S 到 F：從 D 來、從 E 來…');
  await step(tok);                                   // 812.4 and C, F
  hl('C', 'F');
  fm('d(S,F) = min( d(S,D) + 1 ,  d(S,E) + 3 ,  d(S,C) + 5 )');
  say('還有 C → F 這條', 'F 一共三條入邊');
  await step(tok);                                   // 822.1 and that is?
  mDagReset(G); mCol(G.edges.DF, M.ok); val('F');
  fm('d(S,F) = min(4 + 1, 3 + 3, 3 + 5) = 5');
  say('d(S,F) = 5', '從 D 走過來最好');
  await step(tok);                                   // 832.0 the distance from S to G
  mDagReset(G); glow(G.nodes.G, GOLD);
  fm('d(S,G) = min( … )');
  say('最後一個：S 到 G', '先找出 G 的入邊');
  await step(tok);                                   // 891.8 EG, FG
  hl('E', 'G'); hl('F', 'G');
  fm('d(S,G) = min( d(S,E) + 4 ,  d(S,F) + 1 ,  … )');
  say('從 E 來、從 F 來', '這樣就完整了嗎？');
  await step(tok);                                   // 903.4 C! I didn't see that
  hl('C', 'G', M.red); glow(G.nodes.C, RED);
  fm('d(S,G) = min( d(S,E) + 4 ,  d(S,F) + 1 ,  d(S,C) + 4 ) = 6');
  txt(vt.G, '6'); tint(G.nodes.G, M.teal);
  tag('C → G 很容易漏看！', 'bad', 4.8, 2.0, 0.3);
  you.mood('wow');
  say('還有 C → G！', '入邊要一條都不漏：d(S,G) = 6');
}]);

// 15:21 BFS 的陷阱與拓撲排序；O(V+E)
FRAG.push(['dpmit2-dag-topo', '拓撲排序：BFS 會被 C→G 騙；O(V+E)', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.8, 0]);
  const G = mDag();
  const top = board(0, 7.9), low = board(0, 0.6, 0.4, 'note');
  const you = me(-6.0, -1.2, 1.0, 0.6);
  const lv = [];
  await step(tok);                                   // 921.0 the point of this guy: with BFS you get tricked
  mCol(G.edges.CG, M.red); glow(G.nodes.C, RED); glow(G.nodes.G, RED);
  top('C → G 這條邊的用意：BFS 會被騙');
  say('為什麼要畫 C → G？', '用 BFS 的順序算，會出錯');
  await step(tok);                                   // 927.9 BFS puts G on the same level as these
  glow(G.nodes.C, null);
  glow(G.nodes.S, GOLD); lv.push(tag('第 0 層', 'idx', -1.3, 7.0));
  ['A', 'B', 'C'].forEach((v) => glow(G.nodes[v], GOLD)); lv.push(tag('第 1 層', 'idx', -4.3, 5.2));
  ['D', 'E', 'F'].forEach((v) => glow(G.nodes[v], GOLD)); lv.push(tag('第 2 層', 'idx', -4.3, 3.2));
  lv.push(tag('G 也在第 2 層！', 'bad', 1.9, 1.0));
  you.mood('wow');
  say('BFS：G 經 C→G 也算第 2 層', '可能先算 G，可是 E、F 還沒算好');
  await step(tok);                                   // 938.0 what order do I need?
  DORD.forEach((v) => glow(G.nodes[v], null));
  top('要照什麼順序算，才不會出錯？');
  say('那要照什麼順序算？');
  await step(tok);                                   // 947.5 topological sort
  top('拓撲排序（topological sort）');
  you.mood('happy');
  say('答案：topological sort（拓撲排序）', '保證「被依賴的」一定先算');
  await step(tok);                                   // 966.8 S, A, B, C, D, E, F, G
  lv.forEach(remove);
  DE.forEach(([u, v]) => { G.edges[u + v].kill(); remove(G.wl[u + v]); });
  const TX = (k) => -5.6 + k * 1.6, TY = 2.4;
  DORD.forEach((v, k) => move(G.nodes[v], TX(k), TY));
  top('這次用的拓撲順序：S A B C D E F G');
  you.mood('calm');
  say('拓撲順序有很多種，哪一種都可以', '這次用 S A B C D E F G');
  await step(tok);                                   // 985.4 every edge here indicates a dependency
  const idx = Object.fromEntries(DORD.map((v, k) => [v, k])), arcs = {};
  for (const [u, v] of DE.filter((e) => e[1] === 'E')) arcs[u + v] = mArc(TX(idx[u]), TY + 0.45, TX(idx[v]), TY + 0.45, mArcH(idx[v] - idx[u]) * 0.9, M.gold);
  glow(G.nodes.E, GOLD);
  low('每條邊 = 一個依賴：E 要等 A、B、C 算好');
  say('每條邊代表一個依賴', '算 d(S,E) 之前，要先有 A、B、C 的值');
  await step(tok);                                   // 1002.8 after this ordering, all the edges point forward
  for (const [u, v] of DE) if (!arcs[u + v]) arcs[u + v] = mArc(TX(idx[u]), TY + 0.45, TX(idx[v]), TY + 0.45, mArcH(idx[v] - idx[u]) * 0.9, M.brown);
  Object.values(arcs).forEach((a) => mCol(a, M.brown)); glow(G.nodes.E, null);
  low('排好之後：所有邊都往前（往右）指');
  say('照拓撲順序排好', '所有的邊都往右指');
  await step(tok);                                   // 1019.0 no such thing as a backward edge
  low('沒有往回的邊 ✓');
  say('沒有任何一條邊往回指');
  const cur = tag('▲', 'ptr alt', TX(0), TY - 1.0);
  const done = (k) => { const v = DORD[k]; relabel(G.nodes[v], v + ' ' + DD[v]); tint(G.nodes[v], M.teal); };
  await step(tok);                                   // 1025.1 computing in this order: at E, a b c d are done
  for (let k = 0; k <= 5; k++) { move(cur, TX(k), TY - 1.0); done(k); await beat(tok, 260); }
  glow(G.nodes.E, GOLD);
  low('算到 E 時，指向 E 的點都已經算好了');
  say('照這個順序算', '算到 E 時，A、B、C、D 都已經好了');
  await step(tok);                                   // 1044.0 at A, relax all the edges going out of A
  glow(G.nodes.E, null);
  mCol(arcs.AD, M.orange); mCol(arcs.AE, M.orange); glow(G.nodes.A, GOLD);
  low('另一種看法：到 A 時，relax A 的「出」邊');
  say('也可以：到了 A，就 relax 從 A 出去的邊');
  await step(tok);                                   // 1058.0 I'm relaxing all the edges coming into a node
  mCol(arcs.AD, M.brown); mCol(arcs.AE, M.brown); glow(G.nodes.A, null);
  ['AE', 'BE', 'CE'].forEach((e) => mCol(arcs[e], M.ok)); glow(G.nodes.E, GREEN);
  low('老師的做法：到 E 時，relax 進入 E 的邊');
  say('老師的寫法：看「進入」這個點的邊', '兩種做法結果一樣');
  await step(tok);                                   // 1078.0 in topological order, all the algorithms work
  ['AE', 'BE', 'CE'].forEach((e) => mCol(arcs[e], M.brown)); glow(G.nodes.E, null);
  for (let k = 6; k <= 7; k++) { move(cur, TX(k), TY - 1.0); done(k); await beat(tok, 300); }
  low('只要照拓撲順序，依賴都滿足 → 結果都對');
  you.mood('happy');
  say('只要照拓撲順序處理', '依賴都滿足，算出來就對');
  await step(tok);                                   // 1090.0 so what's the running time?
  top('時間複雜度是多少？');
  you.mood('wow');
  say('這樣要花多少時間？');
  await step(tok);                                   // 1123.0 V + E: every edge shows up exactly once
  Object.values(arcs).forEach((a) => mCol(a, M.gold)); await beat(tok, 700); Object.values(arcs).forEach((a) => mCol(a, M.brown));
  top('O(V + E)');
  low('每條邊在式子裡只出現一次');
  you.mood('calm');
  say('每條邊只出現在一個式子裡', '所以是 O(V + E)');
  await step(tok);                                   // 1129.0 even without edges you initialise each vertex
  low('沒有邊的點，也要初始化一次 → 加上 V');
  say('就算一個點沒有入邊', '也要花時間初始化它，所以有 + V');
  await step(tok);                                   // 1146.5 use it to solve the Crazy Eights problem
  low(null);
  tag('用在 Crazy Eights：', 'say', -2.6, 6.9);
  say('拿這個方法解 Crazy Eights', '時間是多少？');
  await step(tok);                                   // 1158.0 V' + E' = n² + n² = n²
  tag("V′ + E′ = O(n) + O(n²) = O(n²)", 'note', 1.6, 6.3);
  say("V′ + E′ = O(n²)", 'n 張牌：點 O(n)、邊 O(n²)');
  await step(tok);                                   // 1168.2 better than Bellman-Ford
  const bf = tag('Bellman-Ford：O(n³)', 'bad', 1.6, 5.6); strike(bf);
  tag('看出圖沒有環 → 更快 ✓', 'good', -3.0, 5.6);
  you.mood('happy'); await you.hop(tok);
  say('比 Bellman-Ford 的 O(n³) 快', '只因為注意到圖沒有環');
  await step(tok);                                   // 1214.7 the topological sort here: the cards in their order
  top('Crazy Eights 的拓撲順序 = 牌原本的順序');
  say('Crazy Eights 的拓撲順序是什麼？', '就是牌在桌上的順序');
  await step(tok);                                   // 1225.5 in DP the topological order is obvious
  low('DP 的拓撲順序通常很明顯');
  say('DP 題的拓撲順序通常一眼就看得出來');
  await step(tok);                                   // 1231.5 the hard part: the state and the dependencies
  low('難的是：狀態要怎麼定？依賴（邊）是什麼？');
  you.mood('wow');
  say('真正難的是定義狀態', '還有想清楚誰依賴誰（邊是什麼）');
}]);

// 22:14 曼哈頓格子：d(i,j) 的遞迴式
FRAG.push(['dpmit2-grid-rec', '曼哈頓格子：d(i,j) = min(上 + w, 左 + w)', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 3.8, 0]);
  const top = board(0, 8.0), fm = board(0, 0.2, 0.5, 'note');
  let g = null, you = null;
  await step(tok);                                   // 1339.6 something like Manhattan's map: a lattice
  g = mGrid(-2.1, 6.6, 1.4, 1.35, 1.2);
  top('像曼哈頓的街道：格子（lattice）');
  say('新題目：像曼哈頓地圖的格子', 'lattice 就是 grid（格子）');
  await step(tok);                                   // 1357.3 you can only go forward and down
  g.edges();
  top('只能往右、往下走');
  say('只能往右或往下走');
  await step(tok);                                   // 1363.6 all the streets are one way
  tag('全部都是單行道', 'note', 4.3, 6.6);
  tag('↑ ✗', 'bad', 0.7 + 0.35, 4.0); tag('← ✗', 'bad', -0.7 - 0.2, 2.9);
  say('每條街都是單行道', '不能往上、不能往左');
  await step(tok);                                   // 1384.2 from s to t
  const p11 = g.P(1, 1), p54 = g.P(GN, GM);
  tag('s', 'ptr', p11[0] - 0.7, p11[1]); tag('t', 'ptr', p54[0] + 0.7, p54[1]);
  glow(g.n['1,1'], GOLD); glow(g.n['5,4'], GOLD);
  say('從左上角 s 走到右下角 t');
  await step(tok);                                   // 1388.2 different costs on all these edges
  g.weights();
  say('每條邊的成本都不一樣', '（數字為自擬）');
  await step(tok);                                   // 1394.0 an n by m matrix
  tag('n = 5 列', 'say', -3.8, 3.9); tag('m = 4 行', 'say', 0, 7.3);
  say('整張圖是 n × m 的格子', '這裡 n = 5、m = 4');
  await step(tok);                                   // 1398.0 from s to t in the shortest possible way
  you = me(p11[0] - 2.3, p11[1] - 0.5, 0.3, 0.5, '你'); you.look(1); you.mood('wow');
  top('從 s 到 t：總成本最小的路');
  say('要從 s 走到 t，總成本越小越好');
  await step(tok);                                   // 1438.0 this is 1,1 and this is 5,4
  tag('(1,1)', 'idx', p11[0], p11[1] + 0.5); tag('(5,4)', 'idx', p54[0], p54[1] - 0.5);
  say('幫節點編號 (i, j)', '左上 (1,1)，右下 (5,4)');
  await step(tok);                                   // 1442.6 2,1  3,1  4,1  5,1
  for (let i = 2; i <= GN; i++) { const p = g.P(i, 1); tag('(' + i + ',1)', 'idx', p[0] - 0.75, p[1]); await beat(tok, 150); }
  say('第一行往下：(2,1)、(3,1)、(4,1)、(5,1)', 'i = 第幾列');
  await step(tok);                                   // 1453.1 1,2  1,3  1,4
  for (let j = 2; j <= GM; j++) { const p = g.P(1, j); tag('(1,' + j + ')', 'idx', p[0], p[1] + 0.5); await beat(tok, 150); }
  say('第一列往右：(1,2)、(1,3)、(1,4)', 'j = 第幾行');
  await step(tok);                                   // 1466.8 this problem has tripped up people on exams
  tag('看不出「DP ＝ 圖」的人，考試常栽在這題', 'bad', 0, -0.8, 0.5);
  you.mood('sad');
  say('這題在考試中考倒過很多人', '看不出 DP 和圖的關係就會卡住');
  await step(tok);                                   // 1484.8 solve it with DP: recursion formulas
  top('用 DP：寫出遞迴式');
  you.mood('calm');
  say('改用 dynamic programming', '寫出每個點的遞迴式');
  await step(tok);                                   // 1490.1 shortest distance to (1,1)?
  relabel(g.n['1,1'], 0); tint(g.n['1,1'], M.teal); glow(g.n['5,4'], null);
  fm('d(1,1) = 0');
  say('起點 (1,1) 的距離是 0');
  await step(tok);                                   // 1503.7 a general node d(i,j): how?
  glow(g.n['1,1'], null); glow(g.n['3,3'], GOLD); relabel(g.n['3,3'], '?');
  fm('一般的點 d(i, j) = ?　（例：(3,3)）');
  you.mood('wow');
  say('一般的點 d(i, j) 怎麼算？', '拿 (3,3) 當例子');
  await step(tok);                                   // 1516.8 from (i−1, j)
  glow(g.n['2,3'], GREEN);
  fm('從上面 (i−1, j) 來…');
  say('它只能從上面那格 (i−1, j) 走下來…');
  await step(tok);                                   // 1534.4 the weight from (i−1, j) to (i, j)
  mCol(g.ev['2,3'], M.ok);
  fm('d(i−1, j) + w((i−1,j) → (i,j))');
  say('上面那格的距離 + 往下那條邊的成本', '例：d(2,3) + ' + gwv(2, 3));
  await step(tok);                                   // 1544.0 or from (i, j−1) plus that weight
  glow(g.n['3,2'], GREEN); mCol(g.eh['3,2'], M.ok);
  fm('或  d(i, j−1) + w((i,j−1) → (i,j))');
  say('或是從左邊那格 (i, j−1) 走過來', '例：d(3,2) + ' + gwh(3, 2));
  await step(tok);                                   // 1557.7 these are the recursions
  fm('d(i, j) = min( d(i−1, j) + w上 ,  d(i, j−1) + w左 )');
  you.mood('happy');
  say('兩條路取小的：這就是遞迴式', 'd(i,j) = min(上 + w, 左 + w)');
}]);

// 26:07 pseudocode：逐列填表
FRAG.push(['dpmit2-grid-code', '格子 DP：for i, for j 逐列填 d[i,j]', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.8, 0]);
  const L = ['for i in 1..n:', '  for j in 1..m:', '    if i == 1 and j == 1:', '      d[i,j] = 0', '    else:', '      d[i,j] = min(上 + w, 左 + w)', '      （第一列／第一行：少一個鄰居）'];
  const cd = code(L, -3.6, 6.4, 0.6); cd.ls.forEach((l) => showL(l, false));
  const show = (...ks) => ks.forEach((k) => showL(cd.ls[k], true));
  const g = mGrid(1.4, 6.4, 1.4, 1.3); g.edges(); g.weights();
  const top = board(-1.0, 7.7), low = board(-3.2, 1.0, 0.5, 'note');
  const you = me(-6.0, -0.6, 1.0, 0.6);
  const fill = (i, j) => { const k = i + ',' + j; relabel(g.n[k], GDIST[k]); tint(g.n[k], M.teal); };
  async function sweep(rows, ms = 650) { const p = g.P(rows[0], 1); const l = tag('→', 'pkt', p[0] - 0.6, p[1] + 0.45, 0.4); for (const i of rows) { const a = g.P(i, 1), b = g.P(i, GM); l.position.set(a[0] - 0.6, a[1] + 0.45, 0.4); await travel(tok, l, V3(a[0] - 0.6, a[1] + 0.45, 0.4), V3(b[0] + 0.3, b[1] + 0.45, 0.4), ms); } return l; }
  await step(tok);                                   // 1567.0 how would I write the full pseudocode?
  top('把它寫成完整的 pseudocode');
  say('怎麼寫成完整的 pseudocode？');
  await step(tok);                                   // 1570.0 a valid topological sort?
  top('先要一個拓撲順序：誰先算？');
  you.mood('wow');
  say('要先決定一個拓撲順序', '每格算之前，上面和左邊要先算好');
  await step(tok);                                   // 1597.0 for i in 1 to n, for j in 1 to m
  show(0, 1); cd.hl(1);
  const sw = await sweep([1, 2], 650); remove(sw);
  top('一列一列、由左到右：好寫又正確');
  you.mood('calm');
  say('for i、for j：一列一列，由左到右', '上面那列一定先算完');
  await step(tok);                                   // 1613.1 if i is 1 and j is 1: d = 0
  show(2, 3); cd.hl(3); fill(1, 1);
  say('i = 1 且 j = 1：d = 0', '這是 base case（起點）');
  await step(tok);                                   // 1622.0 otherwise d(i,j) = the big formula
  show(4, 5); cd.hl(5);
  say('其他格子：套用剛剛的遞迴式', 'min(上 + w, 左 + w)');
  await step(tok);                                   // 1648.0 this is a DP solution
  cd.hl(-1);
  for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { if (i + j > 2) { fill(i, j); await beat(tok, 105); } }
  top('這就是 DP 解法');
  you.mood('happy');
  say('照順序填完整張表：這就是 DP', '不用建圖，直接寫遞迴');
  await step(tok);                                   // 1655.0 an implicit representation of the graph
  low('圖沒有畫出來：藏在遞迴式裡（implicit）');
  say('圖還在，只是「隱含」在遞迴式裡', '上、左兩個鄰居就是入邊');
  await step(tok);                                   // 1664.0 most people are afraid of it: the hardest unit
  top('很多人最怕的單元');
  you.mood('wow');
  say('很多人很怕 DP', '這是整門課最難的單元');
  await step(tok);                                   // 1687.0 code is smaller, but looks like black magic
  low('程式短、好讀，但看不到圖就像黑魔法');
  you.mood('calm');
  say('程式短很多', '但如果看不到背後的圖，就像黑魔法');
  await step(tok);                                   // 1753.2 an array, or a dictionary keyed by the tuple (i, j)
  tag('d 可以用陣列，或 key = (i, j) 的 dictionary', 'say', -2.4, 2.1, 0.4);
  say('d 可以是二維陣列', '或是用 tuple (i, j) 當 key 的 dictionary');
  await step(tok);                                   // 1775.0 boundary conditions
  glow(g.n['1,2'], GOLD);
  const p12 = g.P(1, 2), ghost = tag('(0,2)？不存在', 'bad', p12[0], p12[1] + 0.95);
  say('還有邊界條件', '(1,2) 上面那格 (0,2) 根本不存在');
  await step(tok);                                   // 1788.0 a few more ifs for boundary conditions
  show(6); cd.hl(6);
  say('要多加幾個 if', '第一列、第一行只有一個鄰居');
  await step(tok);                                   // 1813.3 DP solutions are 5 to 10 lines
  remove(ghost); glow(g.n['1,2'], null); cd.hl(-1);
  low('DP 的解法通常只有 5～10 行');
  say('DP 的程式通常只有 5～10 行');
  await step(tok);                                   // 1817.0 the only hard thing: what is the state
  top('唯一難的：狀態要定成什麼');
  you.mood('wow');
  say('唯一難的是：狀態要定成什麼', '狀態想通了，其他都很自然');
  await step(tok);                                   // 1865.6 it depends on these two: in the dictionary?
  glow(g.n['3,3'], GOLD); glow(g.n['2,3'], GREEN); glow(g.n['3,2'], GREEN);
  top('算 (3,3) 要用上面、左邊：表裡有了嗎？');
  say('算 (3,3) 要用 (2,3) 和 (3,2)', '它們已經在表裡了嗎？');
  await step(tok);                                   // 1877.0 line one, then line two: already there
  const sw2 = await sweep([1, 2, 3], 500); remove(sw2);
  low('一列一列算 → 要用的值一定已經算好');
  you.mood('happy');
  say('因為是一列一列算', '用到的格子一定早就算好了');
  await step(tok);                                   // 1891.1 no memoization if you know the topological sort
  ['3,3', '2,3', '3,2'].forEach((k) => glow(g.n[k], null));
  top('知道拓撲順序 → 不需要 memoization');
  say('知道拓撲順序，就不需要 memoization', '不知道順序時才需要');
  await step(tok);                                   // 1912.1 it would refer to zero, which doesn't exist
  glow(g.n['2,1'], GOLD);
  const p21 = g.P(2, 1); tag('(2,0)？✗', 'bad', p21[0] - 1.0, p21[1]);
  low('邊界：(2,1) 的左邊 (2,0) 不存在 → 要特別處理');
  say('邊界再看一次：(2,1) 會去找 (2,0)', '那格不存在，所以要加 if');
}]);

// 32:13 Optimal substructure
FRAG.push(['dpmit2-opt-sub', 'Optimal substructure：最短路徑的一段也最短', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.0, 0]);
  const G = mDag();
  DORD.forEach((v) => relabel(G.nodes[v], v + ' ' + DD[v]));
  const top = board(0, 8.2), low = board(0, -0.4, 0.5, 'note');
  const you = me(-5.6, 0.0, 1.0, 0.7);
  let p3 = null, l3 = null;
  await step(tok);                                   // 1941.0 a key property: optimal substructure
  top('DP 的關鍵性質：optimal substructure（最佳子結構）');
  say('DP 的關鍵性質：optimal substructure');
  await step(tok);                                   // 1966.0 suppose I have a shortest path from S to G
  ['SA', 'AD', 'DF', 'FG'].forEach((e) => mCol(G.edges[e], M.ok)); ['S', 'A', 'D', 'F', 'G'].forEach((v) => glow(G.nodes[v], GREEN));
  low('P = S → A → D → F → G（成本 6）');
  say('假設 P 是 S 到 G 的最短路徑', '這裡 P = S→A→D→F→G');
  await step(tok);                                   // 1994.0 this path goes through D
  glow(G.nodes.D, GOLD);
  tag('P 經過 D', 'ptr alt', -4.4, 3.2);
  say('假設 P 經過 D');
  await step(tok);                                   // 2000.0 a path S to D, then another path D to G
  mCol(G.edges.SA, M.gold); mCol(G.edges.AD, M.gold);
  tag('P1', 'ptr alt', -2.1, 6.4); tag('P2', 'ptr', 1.2, 1.9);
  low('P = P1（S→D）+ P2（D→G）');
  say('P 拆成兩段', 'P1：S 到 D，P2：D 到 G');
  await step(tok);                                   // 2016.4 P1 is guaranteed to be a shortest path S to D
  tag('P1 一定是 S → D 的最短路徑', 'good', 4.2, 6.4);
  you.mood('wow');
  say('P1 一定也是 S 到 D 的最短路徑');
  await step(tok);                                   // 2040.0 a part of the optimal solution is optimal for the part
  low('大問題最佳解的「一部分」，也是小問題的最佳解');
  say('大問題最佳解的一部分', '也是那個小問題（S 到 D）的最佳解');
  await step(tok);                                   // 2072.0 if you had a better path P3 …
  p3 = mArc(-0.6, 6.6, -2.6, 3.7, -0.9, M.red); l3 = tag('P3：假設更短', 'bad', -1.4, 4.4);
  you.mood('calm');
  say('反證：假設有一條更短的 P3 到 D', '把 P1 換成 P3…');
  await step(tok);                                   // 2086.5 that would contradict that this is the best path
  tag('整條 P 就更短 → 矛盾 ✗', 'bad', -4.6, 4.4);
  say('整條路就更短了', '和「P 是最短」矛盾，所以 P3 不存在');
  await step(tok);                                   // 2096.0 get to D, E or F optimally, then cross one edge
  p3.kill(); remove(l3); mDagReset(G);
  ['E', 'F', 'C'].forEach((u) => { mCol(G.edges[u + 'G'], M.gold); glow(G.nodes[u], GOLD); }); glow(G.nodes.G, GOLD);
  low('S → G = 先走到 G 的前一站（這張圖是 E、F、C），再走一條邊');
  say('所以 S 到 G 可以拆成：', '先最佳地走到前一站，再走最後一條邊');
  await step(tok);                                   // 2106.3 the ways to get there have to be optimal
  ['E', 'F', 'C'].forEach((u) => glow(G.nodes[u], GREEN));
  tag('到前一站的路也要最短', 'good', 4.6, 3.2);
  you.mood('happy');
  say('走到前一站的那段路', '也一定要是最短的');
  await step(tok);                                   // 2123.2 in some problems the answer is yes: not DP
  low('有些問題沒有這個性質 → 不能用 DP');
  you.mood('sad');
  say('有些問題沒有這個性質', '那就不能用 dynamic programming');
  await step(tok);                                   // 2131.0 you probably forgot part of the state
  low('通常是狀態少記了東西');
  say('如果遇到這種情況', '多半是狀態少記了某個東西');
  await step(tok);                                   // 2140.2 the quiz problem with the gas stations
  mDagReset(G);
  const car = buddy('車', '油?', M.lilac, 5.4, 0.4, 0.8, 0.6); car.mood('wow');
  tag('⛽ 便宜', 'pkt', 4.4, 2.0); tag('⛽ 很貴', 'pkt', 6.2, 2.0);
  say('例：小考的加油站題', '只看路程，沒有算油量和油錢');
  await step(tok);                                   // 2171.0 no optimal substructure: the fuel state was not counted
  car.mood('sad');
  tag('沒記「油量」→ 失去最佳子結構', 'bad', 5.0, 0.0, 0.6);
  say('短的路可能經過很貴的加油站', '沒把油量放進狀態，最佳子結構就壞了');
  await step(tok);                                   // 2187.0 all DP problems have optimal substructure
  low('能用 DP 的問題，都有 optimal substructure');
  you.mood('calm');
  say('所有能用 DP 解的問題', '都有 optimal substructure');
}]);

// 37:08 有環：遞迴式互相依賴
FRAG.push(['dpmit2-cycle-rec', '有環：d(A) 要 d(C)、d(C) 要 d(B)、d(B) 又要 d(A)', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 3.8, 0]);
  const P = { S: [-5, 3], A: [-1.5, 3], B: [2.2, 5.2], C: [2.2, 0.8] };
  const top = board(1.0, 7.9);
  const you = me(5.4, -0.6, 1.0, 0.65);
  const n = {}, E = {};
  const L = ['d(S,S) = 0', 'd(S,A) = min( d(S,S) + 1 ,  d(S,C) + 1 )', 'd(S,B) = d(S,A) − 1', 'd(S,C) = d(S,B) + 1'];
  const cd = code(L, -2.4, 7.0, 0.55); cd.ls.forEach((l) => showL(l, false));
  const show = (k, t) => { showL(cd.ls[k], true); if (t) txt(cd.ls[k], t); cd.hl(k); };
  await step(tok);                                   // 2228.7 let's do cycles
  top('有環的圖怎麼辦？');
  you.mood('wow');
  say('接著看：圖裡有環的時候');
  await step(tok);                                   // 2245.2 source going to A, to B, to C
  for (const v of ['S', 'A', 'B', 'C']) n[v] = mBox(v, v === 'S' ? M.orange : M.sand, P[v][0], P[v][1], 0.8, 0.8, 0.5, 1.5);
  for (const [u, v] of [['S', 'A'], ['A', 'B'], ['B', 'C']]) E[u + v] = mEdge(P[u], P[v]);
  say('S → A → B → C');
  await step(tok);                                   // 2254.4 the costs are 1, −1, 1, 1
  E.CA = mEdge(P.C, P.A);
  for (const [u, v, w] of LE) tag(wtxt(w), 'idx', (P[u][0] + P[v][0]) / 2 + 0.3, (P[u][1] + P[v][1]) / 2 + 0.2);
  you.mood('calm');
  say('再加一條 C → A', '權重：1、−1、1、1');
  await step(tok);                                   // 2267.0 can I use that method? write the recursions
  top('還能用 DAG 的方法嗎？先寫遞迴式');
  say('剛剛的方法還能用嗎？', '先照舊寫出每個點的遞迴式');
  await step(tok);                                   // 2280.1 d(S,A) = min of d(S,S) + w(S,A) …
  show(1, 'd(S,A) = min( d(S,S) + 1 ,  … )');
  mCol(E.SA, M.gold);
  say('d(S,A)：從 S 來，d(S,S) + 1…');
  await step(tok);                                   // 2309.1 one more edge to account for: d(S,C) + weight
  show(1, L[1]); mCol(E.CA, M.gold);
  say('還有一條入邊：C → A', 'd(S,A) = min(d(S,S) + 1, d(S,C) + 1)');
  await step(tok);                                   // 2324.8 d(S,B) = d(S,A) + w(A,B)
  mCol(E.SA, M.brown); mCol(E.CA, M.brown);
  show(2); mCol(E.AB, M.gold);
  say('d(S,B) = d(S,A) + w(A,B)', 'B 只有一條入邊');
  await step(tok);                                   // 2333.8 d(S,C) = d(S,B) + w(B,C)
  mCol(E.AB, M.brown);
  show(3); mCol(E.BC, M.gold);
  say('d(S,C) = d(S,B) + w(B,C)');
  await step(tok);                                   // 2344.0 d(S,S) = 0
  mCol(E.BC, M.brown);
  show(0); glow(n.S, GREEN);
  say('d(S,S) = 0', '起點，一開始就說好的');
  await step(tok);                                   // 2350.4 is there an order to evaluate them? nope
  cd.hl(-1); glow(n.S, null);
  top('有沒有一個順序可以算？');
  you.mood('wow');
  say('照什麼順序算這四條？', '找不到！來看為什麼');
  await step(tok);                                   // 2358.8 S,A depends on S,C
  cd.hl(1); glow(n.A, GOLD); glow(n.C, RED); mCol(E.CA, M.red);
  say('算 d(S,A) 要先有 d(S,C)', '可是 d(S,C) 還沒算');
  await step(tok);                                   // 2365.8 S,C depends on S,B
  cd.hl(3); glow(n.B, RED); mCol(E.BC, M.red);
  say('d(S,C) 要先有 d(S,B)');
  await step(tok);                                   // 2371.6 S,B depends on S,A
  cd.hl(2); mCol(E.AB, M.red); glow(n.A, RED);
  say('d(S,B) 又要 d(S,A)', '繞回來了！');
  await step(tok);                                   // 2378.6 infinite recursion: they all depend on each other
  cd.hl(-1);
  const q = tag('等…', 'pkt', P.A[0], P.A[1] + 0.8, 0.6);
  for (const v of ['C', 'B', 'A']) await travel(tok, q, q.position.clone(), V3(P[v][0], P[v][1] + 0.8, 0.6), 550);
  you.mood('sad');
  say('互相等來等去', '無限遞迴，永遠算不完');
  await step(tok);                                   // 2384.5 there's a loop: can't use this algorithm
  tag('依賴有環 → 不能用 DAG 的方法', 'bad', -2.8, 0.4, 0.4);
  tag('（老師說 negative cycle；其實這圈 = −1+1+1 = 1）', 'note', -2.8, -0.3, 0.4);
  say('依賴形成一個環', 'DAG 的方法不能用了');
  await step(tok);                                   // 2420.0 one way to do it is Bellman-Ford
  tag('辦法①：Bellman-Ford', 'good', 4.6, 3.0);
  you.mood('calm');
  say('一個辦法：Bellman-Ford');
}]);

// 40:23 拆環：d_k(S, v)，分層圖
FRAG.push(['dpmit2-layers-build', '拆環：d_k(S,v) 用剛好 k 條邊，建分層圖', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  const top = board(0, 8.3), fm = board(0, 5.9, 0.3, 'note'), fm2 = board(0, 5.0, 0.3, 'say');
  const MP = { S: [-3, 1.8], A: [-1, 1.8], B: [1, 2.8], C: [1, 0.8] };
  const mini = [], mk = [];
  const n = {};
  const node = (v, k, faint = false) => { n[v + k] = mBox(v + k, faint ? M.faint : (v === 'S' ? M.orange : M.sand), LX(k), LY[v], 0.8, 0.6, 0.4, 1.0); return n[v + k]; };
  const edge = (u, k, v, w, col = M.brown) => { const a = [LX(k), LY[u]], b = [LX(k + 1), LY[v]]; const e = mEdge(a, b, col, 0.5); const l = tag(wtxt(w), 'idx', a[0] + 0.3 * (b[0] - a[0]), a[1] + 0.3 * (b[1] - a[1]) + 0.2); return { e, l }; };
  const all = [];
  await step(tok);                                   // 2423.1 another way: break the cycle
  for (const v of ['S', 'A', 'B', 'C']) mini.push(mBox(v, v === 'S' ? M.orange : M.sand, MP[v][0], MP[v][1], 0.6, 0.6, 0.4));
  const me1 = [mEdge(MP.S, MP.A, M.brown, 0.4), mEdge(MP.A, MP.B, M.red, 0.4), mEdge(MP.B, MP.C, M.red, 0.4), mEdge(MP.C, MP.A, M.red, 0.4)];
  top('辦法②：把環拆開');
  say('另一個辦法：把環拆開', '上次課堂講過');
  await step(tok);                                   // 2427.0 add the path length into the equation
  mk.push(tag('✂', 'pkt', 0.1, 1.2, 0.5));
  fm2('在狀態裡多記一個數：路徑用了幾條邊 k');
  say('怎麼拆？把「路徑長度」放進式子裡', '多記一個數：用了幾條邊');
  await step(tok);                                   // 2459.0 the old: d(S,v) = min over edges of d(S,u) + w(u,v)
  fm('舊的：d(S,v) = min over (u,v)  d(S,u) + w(u,v)');
  fm2(null);
  say('舊的式子：', '到 v 的距離 = 某個入邊起點 u 的距離 + 邊的權重');
  await step(tok);                                   // 2477.7 the distance from s to v using a path of length k
  fm('新的：d_k(S,v) = 剛好用 k 條邊走到 v 的最短距離');
  say('新的定義：d_k(S, v)', '剛好用 k 條邊，從 S 走到 v');
  await step(tok);                                   // 2501.7 from s to u using k − 1, plus the weight of uv
  fm2('dₖ(S,v) = min over (u,v)  dₖ₋₁(S,u) + w(u,v)');
  say('走到 u 用了 k − 1 條邊', '再走 (u,v) 這一條，剛好 k 條');
  await step(tok);                                   // 2521.0 this will always decrease
  const kc = tag('k = 3', 'pkt', 4.6, 3.6, 0.4);
  for (const k of [2, 1, 0]) { await beat(tok, 450); txt(kc, 'k = ' + k); }
  say('每遞迴一層，k 就少 1', '3 → 2 → 1 → 0');
  await step(tok);                                   // 2525.1 guaranteed no infinite recursion
  mk.push(tag('k 一直變小 → 一定會停 ✓', 'good', 4.0, 2.8, 0.4));
  say('k 一定會減到 0', '保證不會無限遞迴');
  await step(tok);                                   // 2532.0 an equivalent way: build a graph
  mini.forEach(kill); me1.forEach((e) => e.kill()); mk.forEach(remove); remove(kc); fm(null); fm2(null);
  for (let k = 0; k <= 3; k++) tag('k = ' + k, 'ptr', LX(k), 7.3);
  top('等價的看法：畫成一張「分層圖」');
  say('也可以畫成一張等價的圖', '每一層 = 用了幾條邊');
  await step(tok);                                   // 2549.1 k = 0: S to itself 0, any other node ∞
  node('S', 0); tag('0', 'idx', LX(0) + 0.75, LY.S - 0.3);
  const z0 = ['A', 'B', 'C'].map((v) => [node(v, 0, true), tag('∞', 'idx', LX(0) + 0.75, LY[v] - 0.3)]);
  say('k = 0：S 到自己距離 0', '到其他點都是 ∞（0 條邊到不了）');
  await step(tok);                                   // 2562.7 you can't get anywhere else in zero edges: no teleport
  const you = me(LX(0) - 1.6, LY.S - 0.5, 0.3, 0.45); you.mood('wow');
  const tp = await pkt(tok, '瞬移？', V3(LX(0), LY.S + 0.6, 0.5), V3(LX(0), LY.A + 0.6, 0.5), 800);
  txt(tp, '不能瞬移 ✗'); cls(tp, 'bad'); you.mood('sad');
  say('0 條邊，哪裡都去不了', '不能瞬間移動');
  await step(tok);                                   // 2576.5 at the first layer you only have the source
  remove(tp); z0.forEach(([m, l]) => { kill(m); remove(l); }); you.mood('calm');
  top('第 0 層只有 source');
  say('所以第 0 層只畫 S0', '其他點沒用，不用畫');
  await step(tok);                                   // 2583.5 level one: S1, A1, B1, C1
  for (const v of LV) { node(v, 1); await beat(tok, 150); }
  say('第 1 層：S1、A1、B1、C1', '用 1 條邊可能走到的點');
  await step(tok);                                   // 2589.6 from the source to A: cost of the edge
  all.push(edge('S', 0, 'A', 1, M.gold)); glow(n.A1, GREEN);
  say('S0 → A1：權重 1', '用 1 條邊只能到 A');
  await step(tok);                                   // 2602.0 a second layer: S2, A2, B2, C2
  for (const v of LV) { node(v, 2); await beat(tok, 150); }
  say('第 2 層：S2、A2、B2、C2');
  await step(tok);                                   // 2621.6 A1 to B2, cost −1
  all.push(edge('A', 1, 'B', -1, M.gold)); glow(n.B2, GREEN);
  say('原本的 A → B，變成 A1 → B2', '權重 −1');
  await step(tok);                                   // 2649.7 B with one edge → C with two edges
  all.push(edge('B', 1, 'C', 1));
  say('B1 → C2：權重 1', '用 1 條邊到 B，就能用 2 條邊到 C');
  await step(tok);                                   // 2656.5 C with one edge → A with two edges
  all.push(edge('C', 1, 'A', 1));
  say('C1 → A2：權重 1', '這是原本 C → A 那條邊');
  await step(tok);                                   // 2666.0 S using one edge? there's no edge
  tint(n.S1, M.faint); tint(n.S2, M.faint);
  tag('沒有邊進 S', 'bad', LX(1), LY.S + 0.6);
  say('沒有任何邊指向 S', '所以 S1、S2 用不到');
  await step(tok);                                   // 2681.7 S to A, cost? a third level S3, A3, B3, C3
  all.push(edge('S', 1, 'A', 1));
  for (const v of LV) { node(v, 3, v === 'S'); await beat(tok, 150); }
  say('S1 → A2 也是權重 1', '再建第 3 層：S3、A3、B3、C3');
  await step(tok);                                   // 2708.5 A2 to B3 −1, B2 to C3 1, C2 to A3 1
  all.push(edge('S', 2, 'A', 1)); all.push(edge('A', 2, 'B', -1)); all.push(edge('B', 2, 'C', 1, M.gold)); all.push(edge('C', 2, 'A', 1));
  glow(n.C3, GREEN);
  say('一模一樣的邊再接一次', 'A2→B3 −1、B2→C3 1、C2→A3 1');
  await step(tok);                                   // 2719.5 every edge in the graph connects two levels
  all.forEach(({ e }) => mCol(e, M.gold)); await beat(tok, 900); all.forEach(({ e }) => mCol(e, M.brown));
  top('原圖的每條邊，都連接相鄰的兩層');
  say('其實就是原本的邊', '每條邊都從第 k 層連到第 k+1 層');
}]);

// 45:44 要幾層？V′、E′ 與 Bellman-Ford
FRAG.push(['dpmit2-layers-bf', '分層圖 = Bellman-Ford：V−1 層，O(VE)', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  const L = mLayers();
  const top = board(0, 8.3), low = board(0, 0.6, 0.4, 'note'), low2 = board(0, -0.1, 0.4, 'say');
  const you = me(-6.1, -0.6, 1.0, 0.6);
  const path = ['S0', 'A1', 'B2', 'C3'];
  await step(tok);                                   // 2744.1 how many layers do I need?
  top('要畫幾層？');
  you.mood('wow');
  say('要畫幾層才夠？');
  await step(tok);                                   // 2763.8 the longest shortest path: V − 1
  path.forEach((v) => glow(L.n[v], GREEN));
  L.e.forEach((e) => { if (path.indexOf(e.v) === path.indexOf(e.u) + 1 && path.includes(e.u)) mCol(e, M.ok); });
  low('V 個點：最短路徑最多 V − 1 條邊');
  say('V 個點的圖', '最短路徑最多用 V − 1 條邊');
  await step(tok);                                   // 2770.6 that's why Bellman-Ford has V − 1 rounds
  low2('所以 Bellman-Ford 跑 V − 1 輪');
  you.mood('happy');
  say('這也是 Bellman-Ford 跑 V − 1 輪的原因');
  await step(tok);                                   // 2776.3 a shortest path can't have a cycle
  low('最短路徑不會繞環（繞了就沒有答案）');
  low2(null);
  you.mood('calm');
  say('最短路徑不會繞環', '如果繞環還更短，就沒有答案了');
  await step(tok);                                   // 2783.0 V − 1 edges → V − 1 layers
  low('就算走過所有點，也只有 V − 1 條邊 → V − 1 層');
  say('最多 V − 1 條邊', '所以畫 V − 1 層就夠');
  await step(tok);                                   // 2795.6 I drew three layers, so I'm done
  L.kt.forEach((l, k) => { if (k) cls(l, 'ptr alt'); });
  low('這張圖 V = 4 → 3 層就夠');
  say('這裡 V = 4', '所以畫到第 3 層就停');
  await step(tok);                                   // 2824.5 copy the graph V − 1 times, plus that one source
  for (let k = 1; k <= 3; k++) { const b = ghostBox(M.blue, 1.5, 5.8, 0.8); b.position.set(LX(k), 3.95, 0); await beat(tok, 300); }
  glow(L.n.S0, GOLD);
  low("V′ = (V − 1) 份原圖 + 1 個 source");
  say('把原圖複製 V − 1 份', '再加上一個 source');
  await step(tok);                                   // 2832.0 order of V squared
  low2("V′ = O(V²)");
  say("點數 V′ = O(V²)");
  await step(tok);                                   // 2846.8 order of V times E
  L.e.forEach((e) => mCol(e, M.gold));
  low("E′ = (V − 1) 份所有的邊 = O(VE)");
  low2("V′ = O(V²)　E′ = O(VE)");
  say("每兩層之間放一份所有的邊", "E′ = O(VE)");
  await step(tok);                                   // 2851.7 this graph is acyclic: all going forward
  L.e.forEach((e) => mCol(e, M.brown));
  top('新圖只往右 → 沒有環（DAG）');
  you.mood('happy');
  say('新圖的邊全都往右', '所以它是 DAG');
  await step(tok);                                   // 2862.1 use the DAG algorithm: V′ + E′
  low("跑 DAG 演算法：O(V′ + E′)");
  say('DAG 的最短路徑：O(V′ + E′)');
  await step(tok);                                   // 2879.0 V² + VE
  low2("O(V² + VE) = O(VE)　（老師口誤說成 V）");
  say("O(V² + VE) = O(VE)", '圖是連通的話 E ≥ V − 1');
  await step(tok);                                   // 2888.1 this is Bellman-Ford
  top('這就是 Bellman-Ford！');
  you.mood('wow'); await you.hop(tok);
  say('這就是 Bellman-Ford', '第 k 輪 ≈ 算出第 k 層');
  await step(tok);                                   // 2919.0 the dynamic programming view of Bellman-Ford
  low('用 DP 的眼光看 Bellman-Ford：為什麼它是對的');
  low2(null);
  you.mood('calm');
  say('這是 Bellman-Ford 的 DP 觀點', '實際寫程式時，照課本的寫法比較短');
  await step(tok);                                   // 2931.2 this is how we handle cycles
  low2('有環 → 多記 k，拆成分層的 DAG');
  say('也看出 DAG 演算法和 Bellman-Ford 的關係', '有環就這樣處理');
}]);

// 49:19 讀答案：每個點取各層最小
FRAG.push(['dpmit2-layers-read', '讀答案：δ(S,v) = 各層 d_k(S,v) 取最小', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  const L = mLayers();
  const top = board(0, 8.3), low = board(0, 0.6, 0.4, 'note');
  const you = me(-6.1, -0.6, 1.0, 0.6);
  const path = ['S0', 'A1', 'B2', 'C3'];
  let bad = null;
  await step(tok);                                   // 2959.0 if all edges were −1 here
  L.wl.forEach((l) => { txt(l, '−1'); cls(l, 'bad'); });
  top('學生問：如果每條邊都是 −1？');
  you.mood('wow');
  say('學生問：如果每條邊都改成 −1 呢？');
  await step(tok);                                   // 3000.4 that's a negative cycle
  bad = tag('A → B → C → A = −3：負環 → 沒有答案', 'bad', 0, 0.6, 0.4);
  you.mood('sad');
  say('那 A→B→C→A 就是負環', '可以一直繞、一直變小，沒有答案');
  await step(tok);                                   // 3010.0 looking at the graph: only one actual path
  remove(bad);
  L.wl.forEach((l) => { txt(l, wtxt(l.w)); cls(l, 'idx'); });
  top('回到原本的權重：其實只有一條路');
  you.mood('calm');
  say('回到原本的圖', '從 S 出發，其實只有一條路');
  await step(tok);                                   // 3021.1 s, a, b, c → s0, a1, b2, c3
  path.forEach((v) => glow(L.n[v], GREEN));
  L.e.forEach((e) => { if (path.includes(e.u) && path.indexOf(e.v) === path.indexOf(e.u) + 1) mCol(e, M.ok); });
  low('S, A, B, C  →  S0, A1, B2, C3');
  say('S → A → B → C', '在分層圖上是 S0 → A1 → B2 → C3');
  await step(tok);                                   // 3036.0 shortest path to B: s0 a1 b2, or s1 a2 b3?
  top('S 到 B 的最短距離：要看哪一個 B？');
  you.mood('wow');
  say('那 S 到 B 的最短距離要讀哪裡？', 'B2？還是 B3？');
  await step(tok);                                   // 3047.0 it could have length 1, 2 or 3
  [1, 2, 3].forEach((k) => glow(L.n['B' + k], GOLD));
  low('最短路徑可能用 1、2 或 3 條邊 → B1、B2、B3 都要看');
  say('最短路徑可能用 1、2 或 3 條邊', '事先不知道，所以都要看');
  await step(tok);                                   // 3066.0 it computes all the shortest paths
  for (let k = 0; k <= 3; k++) for (const v of (k === 0 ? ['S'] : LV)) { const val = LD[k][v]; tag(inf(val), 'idx', LX(k) + 0.75, LY[v] - 0.3); if (val === Infinity && !(v === 'B' && k)) tint(L.n[v + k], M.faint); }
  you.mood('calm');
  say('演算法一次算出所有層的值', '到不了的點是 ∞');
  await step(tok);                                   // 3074.0 read these and take the smallest
  [1, 3].forEach((k) => glow(L.n['B' + k], null)); glow(L.n.B2, GREEN);
  low('δ(S,B) = min(d₁, d₂, d₃) = min(∞, 0, ∞) = 0');
  you.mood('happy');
  say('把 B1、B2、B3 的值取最小', 'δ(S,B) = min(∞, 0, ∞) = 0');
  await step(tok);                                   // 3095.0 a question: recursion with no beginning point?
  top('學生問：遞迴一直往回找，起點在哪？');
  you.mood('wow');
  say('另一個問題：遞迴一直往回找', '會不會永遠沒有起點？');
  await step(tok);                                   // 3123.0 in the DAG case this is the beginning point
  low('DAG：拓撲順序的第一個點 = 起點');
  say('DAG 的情況：只需要一個起點', '其他點最後都會回頭參考它');
  await step(tok);                                   // 3137.4 the first node in that order is my source
  low('拓撲順序一定存在，第一個就是 source');
  you.mood('calm');
  say('一定有拓撲順序', '排第一的就是 source');
  await step(tok);                                   // 3146.0 with cycles the beginning conditions are here
  const gb = ghostBox(M.orange, 1.6, 6.0, 0.8); gb.position.set(LX(0), 3.95, 0);
  glow(L.n.S0, GOLD);
  low('有環的版本：起點條件 = k = 0 那一層');
  say('有環的版本：起點條件就是 k = 0 那一層');
  await step(tok);                                   // 3152.0 only drawing this vertex: the others aren't useful
  tag('A0、B0、C0 都是 ∞，不用畫', 'note', LX(0), 0.9, 0.4);
  low(null);
  you.mood('happy');
  say('所以第 0 層只畫 S0', '其他點都是 ∞，畫了也沒用');
}]);

// ════════════════ jZbkToeNK2g（MIT 6.006 Rec20：Blackjack、LIS） ════════════════

// 00:36 抽象化：round_outcome(i, h)
FRAG.push(['dpmit2-bj-outcome', 'Blackjack 抽象化：round_outcome(i, h)', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.6, 0]);
  const SX = (k) => -6.12 + k * 0.24;
  const top = board(0, 8.2);
  const you = me(-3.6, 0.3, 1.0, 0.75), dealer = buddy('莊家', '', M.lilac, 2.6, 0.3, 1.0, 0.75);
  let deck = [];
  const P = [], D = [];
  const deal = async (k, toP) => {
    const arr = toP ? P : D, x = (toP ? -4.6 : 1.6) + arr.length * 0.9;
    tint(deck[k], M.gold);
    const c = mBox('#' + k, M.card, SX(k), 6.3, 0.75, 1.0, 0.08); arr.push(c);
    const a = c.position.clone(), b = V3(x, 3.6, 0);
    await anim(tok, 300, (u) => c.position.lerpVectors(a, b, u));
  };
  await step(tok);                                   // 36.0 abstract the rules away
  top('Blackjack：不講細節規則，先把規則「包起來」');
  say('不講 blackjack 的細節規則', '直接把規則抽象化');
  await step(tok);                                   // 53.1 a game of blackjack has a deck
  deck = Array.from({ length: 52 }, (_, k) => mBox('', M.card, SX(k), 6.3, 0.2, 0.8, 0.08));
  tag('一副牌', 'say', SX(0) + 0.6, 7.3);
  say('一場遊戲有一副牌');
  await step(tok);                                   // 55.0 x-ray vision: we know what the deck looks like
  deck.forEach((c) => tint(c, M.sky));
  tag('X 光眼：整副牌的順序都知道', 'note', 1.8, 7.3);
  you.mood('wow'); await you.hop(tok);
  say('假設我們有 X 光眼', '一開始就知道整副牌的順序（perfect information）');
  await step(tok);                                   // 68.2 from 0 to 51: zero-based indexing
  tag('0', 'idx', SX(0), 5.6); tag('51', 'idx', SX(51), 5.6);
  you.mood('calm');
  say('52 張牌，編號 0 到 51', '從 0 開始編號');
  await step(tok);                                   // 76.3 you get two cards, the dealer gets two cards
  for (const [k, toP] of [[0, true], [1, false], [2, true], [3, false]]) await deal(k, toP);
  say('開局：你拿 2 張、莊家拿 2 張');
  await step(tok);                                   // 80.0 the only decision, with perfect information?
  top('牌都知道了，你只需要決定什麼？');
  you.mood('wow');
  say('牌全都知道了', '你唯一要做的決定是什麼？');
  await step(tok);                                   // 121.0 no need to decide after every card
  tag('不用每拿一張就重新決定', 'note', -3.6, 2.0, 0.4);
  say('不用每拿一張牌就決定要不要繼續', '因為後面的牌早就知道了');
  await step(tok);                                   // 143.3 the only decision: h, how many cards to hit
  tag('唯一的決定：h = 要 hit 幾張', 'good', -3.6, 1.3, 0.4);
  you.mood('happy');
  say('每局唯一的決定：h', 'h = 要 hit（多拿）幾張牌');
  await step(tok);                                   // 160.4 the game eats up some cards
  await deal(4, true); await deal(5, false);
  say('這局吃掉一些牌', '開局 4 張 + 你 hit 1 張 + 莊家補 1 張');
  await step(tok);                                   // 167.1 the number of cards consumed
  tag('這局用掉 6 張', 'pkt', -0.9, 4.8);
  say('第一個結果：這局用掉幾張牌', '這裡是 6 張');
  await step(tok);                                   // 178.7 how much money I make: +1, 0, −1
  tag('+$1 ／ 0 ／ −$1', 'pkt', -0.9, 2.6);
  you.mood('happy'); dealer.mood('sad');
  say('第二個結果：賺多少錢', '簡化的規則：贏 $1、平手 0、輸 $1');
  await step(tok);                                   // 200.5 a helper: round_outcome
  const fn = mBox('round_outcome(i, h)', M.paper, -0.6, 1.4, 3.6, 0.7, 0.4, 1.2);
  say('寫成一個 helper 函式', 'round_outcome(i, h)');
  await step(tok);                                   // 209.7 start at card i
  const ip = tag('i', 'pkt', SX(0), 7.1);
  say('i：這一局從第 i 張牌開始');
  await step(tok);                                   // 221.6 a tuple: first item = number of cards played
  const out = tag('→ (6, ?)', 'ptr alt', 2.4, 1.4, 0.4);
  say('回傳一個 tuple', '第一項：這局用掉幾張牌');
  await step(tok);                                   // 231.0 the second item: how much money
  txt(out, '→ (6, +1)');
  say('第二項：這局賺多少錢', '這局贏了：+1');
  await step(tok);                                   // 249.0 i: cards already played in previous games
  P.concat(D).forEach(kill);
  for (let k = 0; k < 6; k++) tint(deck[k], GRAY);
  await travel(tok, ip, ip.position.clone(), V3(SX(6), 7.1, 0), 600);
  tag('前幾局已用掉 i 張', 'say', SX(3), 4.9);
  say('i = 前面幾局已經用掉的牌數', '下一局就從第 6 張開始');
  await step(tok);                                   // 289.2 the dealer's predefined algorithm; cards played includes it
  tag('O[0] = 開局 4 張 + 你 hit 的 + 莊家照規則補的', 'note', 0, 3.3);
  dealer.mood('calm');
  say('莊家照固定規則補牌', '用掉的牌數也包含莊家補的牌');
  await step(tok);                                   // 296.1 this little thing has all the rules encoded
  glow(fn, GOLD);
  tag('所有規則都藏在這裡', 'good', -0.6, 0.4, 0.4);
  say('blackjack 的規則全都藏在這個函式裡', '我們不用管細節');
  await step(tok);                                   // 340.1 play optimally every round, or lose one to save good cards?
  top('每局都要贏嗎？還是故意輸一局，把好牌留到後面？');
  you.mood('wow');
  say('整副牌都知道了', '有時故意輸一局，把好牌留給後面反而賺更多');
  await step(tok);                                   // 351.4 how many cards to hit each time: most money overall
  top('目標：決定每局 hit 幾張，離桌時賺最多');
  you.mood('calm');
  say('要決定每一局 hit 幾張', '讓離開牌桌時總共賺最多');
  await step(tok);                                   // 358.1 when I run out of cards I leave the table
  deck.forEach((c) => tint(c, GRAY));
  tag('牌用完 → 離開牌桌', 'say', 4.6, 2.0);
  dealer.mood('happy');
  say('牌用完了就離開牌桌');
}]);

// 06:11 建圖：節點 = 已用掉幾張；邊 i → i + O[0]
FRAG.push(['dpmit2-bj-graph', 'Blackjack 建圖：節點 i、邊 i → i + O[0]', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const Y = 2.6;
  const top = board(0, 7.4), mid = board(0, 5.9, 0.3, 'note');
  let row = [], you = null, sample = null, ht = null;
  await step(tok);                                   // 371.0 two ways: graph first, then DP
  top('兩種做法：① 先畫成圖　② 再寫成 DP');
  say('兩種做法都試試看', '先畫成圖，再寫成 DP，看兩者怎麼對應');
  await step(tok);                                   // 422.1 what would be the nodes?
  top('節點要代表什麼？');
  say('畫成圖：節點要代表什麼？', '節點 = 遊戲的狀態');
  await step(tok);                                   // 460.0 your hand as the state? too complicated
  const bad = tag('用「手上的牌」當狀態？太複雜 ✗', 'bad', 0, 4.6);
  say('學生提議用手上的牌當狀態', '每種牌有 4 張、位置又不同，太複雜');
  await step(tok);                                   // 475.5 how many cards I have left in the deck
  remove(bad);
  row = mRow(Y, 14, null, 0.6, M.sand, 1.2);
  tag('… 52', 'idx', 6.65, Y);
  top('狀態 = 牌已經用掉幾張');
  say('狀態：牌堆還剩幾張', '等於說：已經用掉了幾張');
  await step(tok);                                   // 478.6 one node per card: start a new game at this card
  mid('節點 i：從第 i 張牌開始新的一局');
  say('每張牌一個節點', '節點 i = 從第 i 張開始新的一局');
  await step(tok);                                   // 504.2 where do we always start? the first one
  glow(row[0], GREEN);
  you = me(RX(0), 0.2, 1.0, 0.6);
  say('永遠從 0 出發', '0 張用掉、還剩 52 張');
  await step(tok);                                   // 533.5 one edge is a game
  sample = mArc(RX(0), Y + 0.4, RX(5), Y + 0.4, mArcH(5), M.gold);
  mid('一條邊 = 打一局');
  say('一條邊 = 打一局', '從一個狀態走到下一個狀態');
  await step(tok);                                   // 542.5 at node i: how do I draw the edges?
  sample.kill(); glow(row[0], null); glow(row[5], GOLD);
  await walk(tok, you, RX(5), 700);
  mid('在節點 i（例 i = 5）：要畫哪些邊？');
  say('假設在節點 i', '已經用掉 i 張牌，要怎麼畫邊？');
  await step(tok);                                   // 580.0 h starts at 0
  ht = tag('每個 h 一條邊：h = 0, 1, 2, …', 'say', RX(5), 4.6);
  say('每一種 h 畫一條邊', 'h 從 0 開始（不 hit 也可以）');
  await step(tok);                                   // 605.0 if you don't know the rules: 52 − i
  txt(ht, '每個 h 一條邊：h = 0 … 52 − i');
  say('h 最多到多少？', '不懂規則的話，寫 52 − i 就安全');
  await step(tok);                                   // 636.5 O = round_outcome(i, h)
  mid('O = round_outcome(i, h)');
  say('把結果存起來', 'O = round_outcome(i, h)');
  await step(tok);                                   // 678.5 i = 5: hit once, dealer hits once, 6 cards, won
  tag('i = 5：hit 1 張、莊家補 1 張、贏了', 'note', 2.4, 0.6, 0.6);
  you.mood('happy');
  say('例：i = 5，hit 1 張，莊家也補 1 張', '總共用掉 6 張，而且贏了');
  await step(tok);                                   // 699.0 the output: (6, +1)
  mid('O = (6, +1)');
  say('輸出 O = (6, +1)', '用掉 6 張、賺 $1');
  await step(tok);                                   // 707.0 an edge from 5 to 11
  mArc(RX(5), Y + 0.4, RX(11), Y + 0.4, mArcH(6), M.ok); glow(row[11], GREEN);
  say('所以畫一條邊：5 → 11');
  await step(tok);                                   // 718.3 11 is 5 plus O[0]
  tag('11 = 5 + O[0]', 'good', RX(11), 0.8);
  say('11 = 5 + O[0]', '起點 i 加上這局用掉的牌數');
  await step(tok);                                   // 765.0 i cards before, after O[0]: i + O[0]
  mid('終點 = i + O[0]，不是 O[0]');
  say('O[0] 只算「這一局」用掉的牌', '加上之前用掉的 i 張，才是新的狀態');
  await step(tok);                                   // 775.3 you'd lose a point on an exam if you forget it
  mArc(RX(5), Y + 0.4, RX(6), Y + 0.4, mArcH(1), M.red);
  tag('連到 O[0] = 6 ✗　考試會扣分', 'bad', RX(4), 0.8 - 0.75);
  you.mood('sad');
  say('小細節：連到 6 就錯了', '考試很容易因此扣分');
  await step(tok);                                   // 782.7 write down your state and keep representing it
  top('先寫下「狀態代表什麼」，再一直照著它做');
  you.mood('calm');
  say('寫下狀態代表什麼', '然後每一步都確實維持它');
}]);

// 13:20 DAG：邊都往右，拓撲排序 + relax
FRAG.push(['dpmit2-bj-dag', 'Blackjack 圖是 DAG：拓撲排序 + relax，O(V+E)', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const Y = 2.4, row = mRow(Y, 14);
  tag('… 52', 'idx', 6.65, Y);
  const top = board(0, 7.4), mid = board(0, 6.4, 0.3, 'note');
  const you = me(-6.2, -0.8, 1.0, 0.6);
  const ex = [[5, 11, 1], [5, 10, -1], [5, 12, -1]];
  const arcs = ex.map(([a, b]) => mArc(RX(a), Y + 0.4, RX(b), Y + 0.4, mArcH(b - a) * 0.85, M.brown));
  glow(row[5], GOLD);
  await step(tok);                                   // 808.4 most money = the longest path
  top('賺最多錢 = 走最長的路');
  say('要賺最多錢', '就是找最長的路徑');
  await step(tok);                                   // 814.0 to shortest path: put −O[1] on the edge
  ex.forEach(([a, b, o], k) => tag('−O[1] = ' + sgn(-o), 'idx', RX(b), Y - 0.7 - 0.45 * k));
  mid('邊的權重 = −O[1]：贏 $1 → −1');
  say('換成最短路徑：權重放 −O[1]', '贏錢的邊變成負的');
  await step(tok);                                   // 835.0 Dijkstra: add one to everything
  tag('全部 +1 再用 Dijkstra？✗ 局數多的路被加得多', 'bad', 0, 5.5, 0.3);
  say('學生：每條邊都 +1 再用 Dijkstra？', '老師：不行，每條路的邊數不同，加 1 會改變誰最短');
  await step(tok);                                   // 851.3 negative cycles? no, everything goes right
  arcs.forEach((a) => mCol(a, M.gold));
  mid('有負的邊，但沒有負環：邊全都往右');
  say('會有負環嗎？', '不會：所有的邊都往右');
  await step(tok);                                   // 856.2 even with no hits, at least four cards are played
  for (const [i, js] of [[0, [4, 5, 6]], [3, [7, 8]]]) for (const j of js) { mArc(RX(i), Y + 0.4, RX(j), Y + 0.4, mArcH(j - i) * 0.85, M.brown); await beat(tok, 150); }
  tag('每局至少用 4 張', 'say', RX(2), 0.7);
  say('就算不 hit，一局也至少用掉 4 張', '所以邊至少往右跨 4 格');
  await step(tok);                                   // 872.3 what's this graph? a DAG
  top('沒有往回的邊 → 這是 DAG');
  you.mood('happy');
  say('邊都往同一個方向', '這是 DAG');
  await step(tok);                                   // 900.7 topological sort + relax: O(V + E)
  const cur = tag('▲', 'ptr alt', RX(0), Y - 0.9);
  for (let k = 0; k < 14; k++) { move(cur, RX(k), Y - 0.9); glow(row[k], GREEN); await beat(tok, 120); }
  mid('拓撲排序 + relax：O(V + E)');
  say('照拓撲順序 relax 每條邊', 'DAG 最短路徑：O(V + E)');
  await step(tok);                                   // 910.0 better than Dijkstra, E + V log V
  tag('Dijkstra：O(E + V log V)', 'bad', 4.0, 0.7);
  say('比 Dijkstra 的 O(E + V log V) 還好');
  await step(tok);                                   // 923.0 we'll do this with DP: the graph implicitly
  top('改用 DP：圖不用真的建出來');
  you.mood('wow');
  say('不懂那個演算法也沒關係', '等一下用 DP 做，圖會「隱含」在式子裡');
  await step(tok);                                   // 975.6 what does i mean? starting a new round
  row.forEach((m) => glow(m, null)); glow(row[5], GOLD); remove(cur);
  mid('i = 5：前幾局已經用掉 5 張，現在開新的一局');
  you.mood('calm');
  say('i 是什麼意思？', '開新的一局之前，已經用掉 i 張牌');
  await step(tok);                                   // 1004.4 the first five cards are out: best strategy?
  tag('從這裡開始，最多能賺多少？', 'pkt', RX(9), 4.6);
  say('前 5 張已經不在牌堆裡', '從這裡開始，最好的策略能賺多少？');
  await step(tok);                                   // 1026.4 all the edges point forward, across at least four nodes
  arcs.forEach((a) => mCol(a, M.ok));
  top('所有的邊都往前，至少跨 4 個節點');
  say('重點：所有的邊都往前指', '至少跨過 4 個節點');
}]);

// 18:01 DP：dp[i] = max over h (O[1] + dp[i + O[0]])
FRAG.push(['dpmit2-bj-dp', 'Blackjack DP：dp[i] = max(O[1] + dp[i + O[0]])', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const L = ['# dp[i]：從第 i 張開新的一局，最多淨賺多少', 'for h in 0 .. 52 − i:', '  o = round_outcome(i, h)', '  畫邊 i → i + o[0]', '  choices.append(o[1] + dp[i + o[0]])', 'dp[i] = max(choices)'];
  const cd = code(L, -0.4, 7.2, 0.55); cd.ls.forEach((l) => showL(l, false));
  const show = (k) => { showL(cd.ls[k], true); cd.hl(k); };
  const top = board(0, 8.3), fm = board(-2.6, 0.5, 0.4, 'note');
  const you = me(-6.1, -0.6, 1.0, 0.6);
  const Y = 2.2; let cells = [];
  let a11 = null;
  await step(tok);                                   // 1081.2 with DP: what instead of nodes?
  top('改用 DP：節點換成什麼？');
  you.mood('wow');
  say('改用 dynamic programming', '節點要換成什麼？');
  await step(tok);                                   // 1098.0 the states are sub-problems
  top('狀態還在：變成「子問題」');
  you.mood('calm');
  say('兩邊都有狀態', '在 DP 裡，狀態就是子問題');
  await step(tok);                                   // 1114.5 numbers in a vector: no graph
  cells = mRow(Y, 14, () => '?', 0.75, M.paper, 1.2);
  for (let k = 0; k < 14; k++) tag(String(k), 'idx', RX(k), Y - 0.7);
  tag('dp', 'ptr', RX(0) - 0.05, Y + 0.85);
  top('沒有圖：只有一排數字（陣列）');
  say('沒有圖、也不用呼叫其他演算法', '直接算出一排數字');
  await step(tok);                                   // 1134.3 how many elements? 52
  tag('… 52', 'idx', 6.65, Y);
  say('陣列有多長？', '大約 52 格（每張牌一格）');
  await step(tok);                                   // 1146.4 element i = 5
  glow(cells[5], GOLD);
  say('看第 i = 5 格', '它對應圖上的節點 5');
  await step(tok);                                   // 1166.6 starting a round after the first five cards
  fm('dp[5]：前 5 張用掉了，從第 5 張開新的一局');
  say('前 5 張已經用掉', '從第 5 張開始新的一局');
  await step(tok);                                   // 1202.2 max money by playing optimally from card i
  show(0);
  say('dp[i] = 從第 i 張開局', '照最好的玩法，最多淨賺多少');
  await step(tok);                                   // 1236.0 people name it dp: the most useless name
  tag('「dp」：看不出意思的爛名字', 'bad', RX(3), Y + 1.6);
  you.mood('sad');
  say('大家都叫這個陣列 dp', '其實是看不出意思的爛名字，但很好寫');
  await step(tok);                                   // 1253.3 how do I compute dp[i]?
  top('dp[i] 要怎麼算？');
  you.mood('calm');
  say('那 dp[i] 要怎麼算？');
  await step(tok);                                   // 1293.5 the choices are exactly the same as before
  show(1);
  say('選擇跟圖一模一樣：試每一個 h', 'for h in 0 .. 52 − i');
  await step(tok);                                   // 1365.0 impossible h → −∞, never chosen
  tag('不可能的 h → 回傳 −∞，不會被選', 'say', 3.6, 0.5, 0.4);
  say('h 太大、不可能時', 'helper 回傳 −∞，自然不會被選到');
  await step(tok);                                   // 1396.3 copy the next line over
  show(2);
  say('下一行照抄：o = round_outcome(i, h)');
  await step(tok);                                   // 1418.0 do I have a graph? can I draw edges?
  show(3); strike(cd.ls[3]);
  say('畫邊這一行要抄嗎？', '不要：DP 沒有圖可以畫邊');
  await step(tok);                                   // 1430.5 compute my answer directly
  top('不畫邊：直接算答案');
  say('不畫邊，直接算出答案');
  await step(tok);                                   // 1471.0 i = 5 and h = 2 → (6, 1)
  fm('i = 5、h = 2 → o = (6, 1)');
  say('同一個例子：i = 5', 'round_outcome 給出 (6, 1)');
  await step(tok);                                   // 1476.5 I end up at 11
  a11 = mArc(RX(5), Y + 0.45, RX(11), Y + 0.45, mArcH(6) * 0.8, M.gold); glow(cells[11], GOLD);
  say('打完這局，會落在第 11 張', '5 + 6 = 11');
  await step(tok);                                   // 1496.6 how much money: O[1]
  fm('這局賺：o[1] = +1');
  say('這局賺多少？o[1] = +1');
  await step(tok);                                   // 1515.0 after landing, how much more if optimal?
  fm('落在 11 之後，最好還能賺多少？→ dp[11]');
  you.mood('wow');
  say('落在 11 之後，繼續照最好的方式玩', '還能賺多少？就是 dp[11]');
  await step(tok);                                   // 1543.4 dp[i + O[0]] is used to compute dp[i]
  show(4);
  fm('候選答案 = o[1] + dp[i + o[0]]');
  say('這個選擇的總收益：', 'o[1] + dp[i + o[0]]');
  await step(tok);                                   // 1569.0 the edge i → i + O[0] with cost −O[1]
  tag('圖：邊 5 → 11，權重 −o[1]', 'say', 3.6, 0.5 - 0.7, 0.4);
  you.mood('calm');
  say('對照圖：邊 i → i + o[0]', '權重 −o[1]');
  await step(tok);                                   // 1584.2 assume it's already computed (black magic)
  glow(cells[11], GREEN);
  tag('假設已經算好', 'idx', RX(11), Y + 0.8);
  say('先假設 dp[11] 已經算好了', '（等一下說為什麼可以這樣假設）');
  await step(tok);                                   // 1601.4 suppose this is $20
  relabel(cells[11], 20); tint(cells[11], M.teal);
  say('假設 dp[11] = 20', '從第 11 張開始，最多能賺 $20');
  await step(tok);                                   // 1618.0 1 + 20 = 21
  fm('這個選擇：1 + dp[11] = 1 + 20 = 21');
  you.mood('happy');
  say('這個選擇的總收益：1 + 20 = 21');
  await step(tok);                                   // 1638.4 go over all possible answers
  const others = [[10, 19, -1], [12, 18, -1]];
  for (const [j, d, o] of others) { mArc(RX(5), Y + 0.45, RX(j), Y + 0.45, mArcH(j - 5) * 0.8, M.faint); relabel(cells[j], d); tint(cells[j], M.teal); await beat(tok, 300); }
  tag('其他 h（數字示意）', 'idx', RX(11), Y + 1.3);
  say('每個 h 都算一個候選答案', '例：−1 + 19 = 18、−1 + 18 = 17');
  await step(tok);                                   // 1653.1 which answer do I want? the largest
  top('要哪一個？最大的！');
  say('要選哪一個？', '最大的那個');
  await step(tok);                                   // 1659.1 a choices array: append each answer
  const ch = tag('choices = [ ]', 'pkt', 3.4, 4.0);
  const got = [];
  for (const v of [18, 21, 17]) { got.push(v); txt(ch, 'choices = [' + got.join(', ') + ']'); await beat(tok, 300); }
  say('每個候選都 append 進 choices');
  await step(tok);                                   // 1678.0 max of choices → dp[i]
  show(5);
  relabel(cells[5], 21); tint(cells[5], M.ok); glow(cells[5], GREEN);
  say('dp[5] = max(choices) = 21');
  await step(tok);                                   // 1695.4 I just finished computing dp[i]
  cd.hl(-1); a11.kill();
  top('dp[i] 算完了！');
  you.mood('happy'); await you.hop(tok);
  say('就這樣，dp[i] 算完了');
}]);

// 28:23 依賴 → 拓撲順序：i 由大到小（用本模組的 12 張牌實跑）
FRAG.push(['dpmit2-bj-order', 'dp[i] 依賴右邊 → i 從 n 往 0 算', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.6, 0]);
  const S = mBjSolve(false), n = DECK.length;
  const cx = (k) => -6.0 + k * 1.0;
  DECK.forEach((c, k) => mBox(cardName(c), M.card, cx(k), 5.6, 0.7, 0.95, 0.08));
  const cells = Array.from({ length: n + 1 }, (_, k) => mBox('?', M.paper, cx(k), 3.0, 0.8, 0.7, 0.4));
  for (let k = 0; k <= n; k++) tag(String(k), 'idx', cx(k), 2.3);
  tag('dp', 'ptr', cx(0) - 0.05, 4.0);
  tag('（示範：一副只有 12 張的已知牌）', 'idx', 1.5, 6.6);
  const top = board(0, 7.6), low = board(0, 1.3, 0.4, 'note');
  const you = me(-6.3, -0.9, 1.0, 0.55);
  let arcs = [];
  const fill = (i) => { relabel(cells[i], mn(S.dp[i])); tint(cells[i], S.dp[i] > 0 ? M.teal : S.dp[i] < 0 ? M.red : M.sand); };
  await step(tok);                                   // 1703.5 to compute this I need this guy
  glow(cells[2], GOLD);
  top('小問題：算這一格，要先有別格的答案');
  say('有個小問題', '算 dp[2]，要先知道別格的答案');
  await step(tok);                                   // 1719.0 an answer here depends on future answers
  arcs = S.tries[2].map((t) => mArc(cx(2), 3.4, cx(t.j), 3.4, mArcH(t.j - 2) * 0.55, M.gold));
  S.tries[2].forEach((t) => glow(cells[t.j], GOLD));
  you.mood('wow');
  say('這格的答案依賴「後面」的答案', '箭頭指到的格子都要先算好');
  await step(tok);                                   // 1724.6 the arrows are the same as in the graph: moves
  low('這些箭頭 = 遊戲裡可能的走法（跟圖上的邊一樣）');
  you.mood('calm');
  say('這些箭頭和圖上的邊一樣', '代表遊戲裡可能的走法');
  await step(tok);                                   // 1731.5 the arrows represent dependencies
  low('同時也是「依賴」：這格要等那格算好');
  say('同時它們也代表依賴', '這格的答案要等那格');
  await step(tok);                                   // 1741.0 dependencies → topological sort
  arcs.forEach((a) => a.kill()); glow(cells[2], null); S.tries[2].forEach((t) => glow(cells[t.j], null));
  top('聽到「依賴」→ 想到拓撲排序');
  say('聽到「依賴」', '就想到 topological sort');
  await step(tok);                                   // 1761.3 answers ready in time: the code doesn't crash
  low('照拓撲順序算 → 要用時都已算好，程式不會出錯');
  say('照拓撲順序算子問題', '用到的答案都已經準備好，程式不會出錯');
  await step(tok);                                   // 1786.1 start at the easiest problem
  fill(n); glow(cells[n], GREEN);
  top('從最簡單的開始：牌快用完的時候');
  say('從最簡單的問題開始', '牌快用完了：能做的事很少');
  await step(tok);                                   // 1791.0 bigger and bigger problems
  for (let i = n - 1; i >= 6; i--) { fill(i); await beat(tok, 330); }
  say('再一步步往前算更大的問題', '每格用到的都在它右邊，早就算好了');
  await step(tok);                                   // 1814.0 from the end to 0: whenever I access it, it's computed
  for (let i = 5; i >= 0; i--) { fill(i); await beat(tok, 330); }
  glow(cells[n], null); glow(cells[0], GREEN);
  top('i 從大到小：…→ 0');
  you.mood('happy');
  say('i 從大往小算到 0', 'dp[0] = ' + mn(S.dp[0]) + '：整副牌最多淨賺 $' + mn(S.dp[0]));
  await step(tok);                                   // 1841.7 the code is a lot smaller
  top('好處：程式短很多');
  say('這樣寫的好處：程式短很多');
  await step(tok);                                   // 1845.6 graph methods, DAG shortest path code, extracting the answer
  tag('圖的做法：建圖 ＋ DAG 最短路徑 ＋ 讀出答案', 'bad', -1.6, 0.5, 0.4);
  low(null);
  say('圖的做法要寫很多', '建圖、DAG 最短路徑、再把答案讀出來');
  await step(tok);                                   // 1860.3 this is all the code: a few lines
  tag('DP：就這幾行 ✓', 'good', 4.6, 0.5, 0.4);
  say('DP 就這幾行而已');
  await step(tok);                                   // 1863.0 graph, topological sort, edges: implicit
  tag('圖、拓撲順序、邊：全都「隱含」在程式裡', 'note', 0, -0.3, 0.4);
  say('圖、拓撲順序、邊都還在', '只是隱含在程式裡');
  await step(tok);                                   // 1868.0 looks like magic, if you know where to look …
  top('看起來像魔法，但知道去哪找，就看得出圖');
  you.mood('wow'); await you.hop(tok);
  say('看起來像魔法', '但知道去哪裡找，就能看出背後的圖');
}]);

// 31:24 走人（0）與 parent pointers
FRAG.push(['dpmit2-bj-parent', '走人 = 0 的選項；parent pointer 存 (值, h)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const A = mBjSolve(false), S = mBjSolve(true), n = DECK.length;
  const cx = (k) => -6.0 + k * 1.0;
  DECK.forEach((c, k) => mBox(cardName(c), M.card, cx(k), 5.6, 0.7, 0.95, 0.08));
  const cells = Array.from({ length: n + 1 }, (_, k) => mBox(mn(A.dp[k]), A.dp[k] < 0 ? M.red : M.paper, cx(k), 3.0, 0.8, 0.7, 0.4));
  for (let k = 0; k <= n; k++) tag(String(k), 'idx', cx(k), 2.3);
  const top = board(0, 7.4), low = board(0, 0.2, 0.4, 'note');
  const you = me(-6.3, -1.2, 1.0, 0.55);
  const neg = []; for (let i = 0; i <= n; i++) if (A.dp[i] < 0) neg.push(i);
  const i0 = neg.length ? neg[neg.length - 1] : 6;
  let w = null, wl = null; const ht = [];
  await step(tok);                                   // 1883.8 parent pointers
  top('還沒講：parent pointers');
  say('學生提醒：還沒講 parent pointers');
  await step(tok);                                   // 1903.6 one decision I missed
  top('等等，還漏了一個選擇…');
  you.mood('wow');
  say('還漏了一個選擇');
  await step(tok);                                   // 1910.0 if you know you'll lose money, what can you do?
  glow(cells[i0], RED);
  tag('從這裡玩下去會輸錢', 'bad', cx(i0), 4.0 + 0.6);
  you.mood('sad');
  say('如果知道接下來一定輸錢', '可以怎麼辦？');
  await step(tok);                                   // 1918.0 walk away: you get 0
  tag('走人！拿 0', 'good', cx(i0) - 2.2, 1.4);
  you.mood('happy'); await you.hop(tok);
  say('起身走人', '收益 0，總比輸錢好');
  await step(tok);                                   // 1923.2 an edge all the way out, cost 0
  w = mArc(cx(i0), 3.4, cx(n), 3.4, mArcH(n - i0) * 0.5, M.ok);
  wl = tag('走人：0', 'ptr', (cx(i0) + cx(n)) / 2, 4.5);
  say('在圖上：一條權重 0 的邊', '直接連到終點');
  await step(tok);                                   // 1931.0 start with a choice of 0
  glow(cells[i0], null);
  for (let i = n; i >= 0; i--) { relabel(cells[i], mn(S.dp[i])); tint(cells[i], S.dp[i] > 0 ? M.teal : M.sand); await beat(tok, 80); }
  low('choices 一開始就放 0：dp 不會是負的');
  say('寫成程式：choices 一開始就放 0', '負的格子都變成 0 了');
  await step(tok);                                   // 1939.2 parent pointers: the easiest way?
  w.kill(); remove(wl);
  top('parent pointer 怎麼記最簡單？');
  you.mood('calm');
  say('接著做 parent pointers', '怎麼記最簡單？');
  await step(tok);                                   // 1957.7 keep track of the h that led to that answer
  for (let i = n; i >= 0; i--) { ht.push(tag(S.par[i].h < 0 ? '走' : 'h' + S.par[i].h, 'idx', cx(i), 1.7)); await beat(tok, 60); }
  low('每格多記：是哪個 h 得到這個答案');
  say('每格記下：是哪個 h 讓它最大');
  await step(tok);                                   // 1966.7 store the maximum and the number of hits
  low('dp[i] 存一對 (最大值, h)');
  say('陣列裡改存兩個數', '(最大收益, 要 hit 幾張)');
  await step(tok);                                   // 1977.4 21 and 2: hit twice
  tag('例：(21, 2) = 賺 21，這局 hit 2 張', 'say', 1.2, 1.0 - 0.0, 0.5);
  say('例：(21, 2)', '收益 21，這局要 hit 2 張');
  await step(tok);                                   // 1991.5 follow the parent pointers
  let i = 0; const hops = [];
  while (i < n && S.par[i].h >= 0) { hops.push([i, S.par[i].j]); i = S.par[i].j; }
  for (const [a, b] of hops) { glow(cells[a], GREEN); mArc(cx(a), 3.4, cx(b), 3.4, mArcH(b - a) * 0.55, M.ok); await beat(tok, 400); }
  glow(cells[i], GREEN);
  say('跟著 parent pointer 走', '就知道每一局該 hit 幾張');
  await step(tok);                                   // 2001.0 start at 0 and play the entire game
  const pk = tag('玩', 'pkt', cx(0), 4.3, 0.5);
  for (const [, b] of hops) await travel(tok, pk, pk.position.clone(), V3(cx(b), 4.3, 0.5), 500);
  txt(pk, '整場打完');
  you.mood('happy');
  say('從 0 出發', '一路照著走，就能把整場打完');
  await step(tok);                                   // 2020.7 store a tuple instead of one number
  low('改動很小：存 tuple，不是存一個數');
  you.mood('calm');
  say('改動很小', '把一個數換成一個 tuple');
  await step(tok);                                   // 2026.1 tuples sort the right way: max still works
  low('tuple 先比第一項 → max(choices) 不用改');
  say('tuple 比大小先比第一項', '所以 max 照樣能用');
  await step(tok);                                   // 2052.7 a separate parent dictionary: no difference in running time
  low('另開一個 parent dictionary 也行：時間一樣');
  say('另外開一個 parent dictionary 也可以', '執行時間完全一樣');
}]);

// 34:59 Memoization vs 拓撲順序；DP 與圖對照
FRAG.push(['dpmit2-bj-memo', 'Memoization vs 拓撲順序；DP 與圖算的是同一件事', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const top = board(0, 7.6), low = board(0, 0.0, 0.4, 'note');
  const gx = (k) => -6.0 + k * 1.0;
  const nodes = [0, 1, 2, 3, 4].map((k) => mBox(k, M.sand, gx(k), 4.0, 0.6, 0.6, 0.4));
  for (const [a, b] of [[0, 2], [0, 3], [1, 4], [2, 4]]) mArc(gx(a), 4.35, gx(b), 4.35, mArcH(b - a) * 0.6, M.brown);
  tag('圖的做法', 'say', -4.0, 5.9);
  const cd = code(['for i in n … 0:', '  choices = [0]', '  for h …:', '    o = round_outcome(i, h)', '    choices.append(o[1] + dp[i+o[0]])', '  dp[i] = max(choices)'], 3.2, 5.6, 0.5);
  tag('DP 的做法', 'say', 3.2, 6.4);
  const you = me(-0.8, 0.8, 1.0, 0.6);
  await step(tok);                                   // 2100.1 if you have a topological sort, use that order
  cd.hl(0);
  const p = tag('→', 'pkt', gx(0), 3.2); await travel(tok, p, V3(gx(0), 3.2, 0), V3(gx(4), 3.2, 0), 900);
  top('知道拓撲順序 → 照那個順序算');
  say('知道拓撲順序的話', '就照那個順序算');
  await step(tok);                                   // 2104.1 if you don't, use memoization
  remove(p);
  tag('memo = { }', 'pkt', -3.8, 2.4);
  top('不知道順序 → 用 memoization');
  say('不知道順序的話', '就用 memoization（算過就記起來）');
  await step(tok);                                   // 2111.0 there has to be one, otherwise infinite loops
  low('一定要有拓撲順序：不然會無限迴圈');
  you.mood('wow');
  say('但拓撲順序一定要存在', '不然會無限迴圈');
  await step(tok);                                   // 2113.7 a loop in the dependency graph: the DP is wrong
  const loop = mArc(gx(4), 3.6, gx(1), 3.6, -0.6, M.red);
  tag('依賴有環 → DP 定義錯了', 'bad', -3.8, 1.6);
  you.mood('sad');
  say('依賴之間有環', '代表你的 DP 定義寫錯了');
  await step(tok);                                   // 2124.1 for our problems the topological sort is obvious
  loop.kill();
  low('我們的題目：順序很明顯，從 0 往上，或從尾巴往回');
  you.mood('calm');
  say('這些題目的順序都很明顯', '從 0 往上長，或反過來從尾巴往回');
  await step(tok);                                   // 2135.6 memoization: a proof of concept
  low('memoization 的意義：只要有遞迴式，其餘都能自動完成');
  say('memoization 證明了一件事', '只要有遞迴式，其他都可以自動完成');
  await step(tok);                                   // 2161.0 this line is the magic part
  cd.hl(4);
  tag('← 魔法就在這一行', 'good', 3.2, 2.4);
  say('真正的關鍵是這一行', 'choices 怎麼算、用 max 合併');
  await step(tok);                                   // 2172.0 everything else is mechanical
  low('其他都是照流程的機械步驟');
  you.mood('happy');
  say('其他部分都是機械化的', '題目做多了，照流程走就好');
  await step(tok);                                   // 2183.1 in graph problems the hard part is the state
  nodes.forEach((m) => glow(m, GOLD));
  low('圖的做法也一樣：難的是決定「狀態」');
  say('圖的做法也一樣', '難的是決定狀態，其他就是畫點、畫邊、跑演算法');
  await step(tok);                                   // 2205.2 DP: smaller code; this is the graph approach
  nodes.forEach((m) => glow(m, null)); cd.hl(-1);
  tag('程式長', 'bad', -4.0, 2.6); tag('程式短', 'good', 4.6, 2.4 - 0.7);
  say('DP：程式短', '圖：程式長');
  await step(tok);                                   // 2210.0 they compute the same thing
  arrow(V3(-1.4, 4.2, 0), V3(0.4, 4.2, 0), 0x0f5a3a); arrow(V3(0.4, 3.8, 0), V3(-1.4, 3.8, 0), 0x0f5a3a);
  low('兩種做法算的是同一件事');
  say('兩種做法其實算的是同一件事', '看懂對應關係，就更懂這題');
  await step(tok);                                   // 2223.0 a new problem: either way
  top('遇到新題：兩條路都可以走');
  you.mood('wow');
  say('遇到新題目，兩條路都可以');
  await step(tok);                                   // 2229.0 if not: draw the graph, find the state, the edges, then the math
  low('看得出 DP 就直接寫；看不出：畫圖 → 找狀態 → 畫邊 → 寫成數學式');
  you.mood('happy');
  say('看得出 DP 就直接寫', '看不出來：先畫圖、找狀態、畫邊，再寫成式子');
}]);

// 37:24 LIS：問題與子問題
FRAG.push(['dpmit2-lis-def', 'LIS：dp[i] = 從 a[i] 開始的最長遞增子序列', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.8, 0]);
  const top = board(0, 7.4), mid = board(0, 6.3, 0.3, 'note'), fm = board(0, 0.6, 0.4, 'note');
  const you = me(-6.1, -0.3, 1.0, 0.6);
  let c = [], arcs = [], marks = [];
  const clr = () => { marks.forEach(remove); marks = []; c.forEach((m) => glow(m, null)); };
  await step(tok);                                   // 2243.6 a problem that shows up on interviews
  top('新題目：面試常考');
  you.mood('wow');
  say('換一個新題目', '面試很常考');
  await step(tok);                                   // 2263.6 a sequence of numbers
  c = mLisRow(4.0, false, 1.2);
  you.mood('calm');
  say('給你一串數字', '8 3 5 2 4 9 7 11');
  await step(tok);                                   // 2275.6 find the (longest) increasing subsequence
  top('找最長遞增子序列（LIS）');
  tag('（老師口誤說成 shortest）', 'idx', 4.2, 6.9);
  say('找最長的遞增子序列', 'LIS：longest increasing subsequence');
  await step(tok);                                   // 2280.5 choose some numbers: they form an increasing sequence
  mid('挑一些數，順序不變，要越來越大');
  say('從裡面挑一些數', '照原本的順序，而且要越來越大');
  await step(tok);                                   // 2284.0 for example, this is a sequence: increasing
  [1, 2, 6].forEach((k) => glow(c[k], GREEN)); marks.push(tag('3, 5, 7 ✓ 遞增', 'good', 0, 5.3));
  you.mood('happy');
  say('例：3, 5, 7', '越來越大：合格');
  await step(tok);                                   // 2293.6 this is also a sequence, but not increasing
  clr(); [0, 2, 5].forEach((k) => glow(c[k], RED)); marks.push(tag('8, 5, 9 ✗ 不是遞增', 'bad', 0, 5.3));
  you.mood('sad');
  say('例：8, 5, 9', '8 → 5 變小了：不合格');
  await step(tok);                                   // 2298.0 the longest subsequence that is increasing
  clr();
  top('要找「最長」的遞增子序列');
  you.mood('calm');
  say('在所有合格的子序列裡', '找最長的那一個');
  await step(tok);                                   // 2321.0 DP or graphs?
  top('用 DP 解？還是用圖解？');
  you.mood('wow');
  say('要用 DP 還是用圖？', '投票：這次用 DP');
  await step(tok);                                   // 2353.0 sub-problems: starting somewhere
  top('子問題：從某個位置開始');
  you.mood('calm');
  say('子問題是什麼？', '從某個位置開始');
  await step(tok);                                   // 2369.7 say I start at 3
  glow(c[1], GOLD);
  await walk(tok, you, LXp(1), 700);
  say('假設從 3 開始');
  await step(tok);                                   // 2376.0 two choices: 5, which is closer, and 4
  arcs = [2, 4].map((j) => mArc(LXp(1), 4.5, LXp(j), 4.5, mArcH(j - 1) * 0.6, M.gold));
  say('下一個可以選 5（比較近），或 4');
  await step(tok);                                   // 2380.2 a few more choices further away
  arcs.push(...[5, 6, 7].map((j) => mArc(LXp(1), 4.5, LXp(j), 4.5, mArcH(j - 1) * 0.6, M.faint)));
  say('其實還有更遠的：9、7、11', '比 3 大、在 3 後面的都可以');
  await step(tok);                                   // 2387.5 go from 3 to 4: then the longest starting at 4
  arcs.forEach((a) => a.kill()); arcs = [mArc(LXp(1), 4.5, LXp(4), 4.5, mArcH(3) * 0.6, M.ok)];
  for (let k = 4; k < 8; k++) tint(c[k], M.teal);
  const gb = ghostBox(M.teal, 5.6, 1.3, 0.8); gb.position.set((LXp(4) + LXp(7)) / 2, 4.0, 0);
  mid('選了 4 → 接著要「從 4 開始」的最長遞增子序列');
  say('如果下一個選 4', '接下來就要找「從 4 開始」最長的');
  await step(tok);                                   // 2400.6 still has to be optimal, no matter what happened before
  fm('不管前面怎麼選，後面那段也要最長（optimal substructure）');
  say('不管前面怎麼選', '從 4 開始的那段，也一定要最長');
  await step(tok);                                   // 2408.3 if instead I choose 7: same thing
  arcs.forEach((a) => a.kill()); kill(gb);
  for (let k = 4; k < 8; k++) tint(c[k], k >= 6 ? M.teal : M.blue);
  arcs = [mArc(LXp(1), 4.5, LXp(6), 4.5, mArcH(5) * 0.6, M.ok)];
  say('改選 7 也一樣', '從 7 開始的那段，也要最長');
  await step(tok);                                   // 2412.0 a sub-problem: start at number i
  arcs.forEach((a) => a.kill()); for (let k = 0; k < 8; k++) tint(c[k], M.blue); glow(c[1], null);
  top('子問題：從第 i 個數開始');
  say('所以子問題就是：從第 i 個數開始');
  await step(tok);                                   // 2421.1 zero-based indexing again
  LA.forEach((v, k) => tag(String(k), 'idx', LXp(k), 4.8));
  say('編號照樣從 0 開始', 'i = 0, 1, …, 7');
  await step(tok);                                   // 2439.0 the longest increasing subsequence starting at i: its length
  fm('dp[i] = 從 a[i] 開始的最長遞增子序列「長度」');
  you.mood('happy');
  say('dp[i] = 從第 i 個數開始', '最長遞增子序列的長度');
}]);

// 41:00 pseudocode：預設 1、j 從 i+1 起、a[j] > a[i] 才能接
FRAG.push(['dpmit2-lis-code', 'LIS 的 pseudocode：choices = [1]，a[j] > a[i] 才加 1 + dp[j]', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.2, 0]);
  const L = ['dp = 陣列，n 格        # 原陣列叫 a', 'for i in n−1 … 0:', '  choices = [1]', '  for j in i+1 … n−1:', '    if a[j] > a[i]:', '      choices.append(1 + dp[j])', '  dp[i] = max(choices)'];
  const cd = code(L, -0.4, 7.5, 0.5); cd.ls.forEach((l) => showL(l, false));
  const show = (k, t) => { showL(cd.ls[k], true); if (t) txt(cd.ls[k], t); cd.hl(k); };
  const top = board(0, 8.4), low = board(0, -0.6, 0.4, 'note');
  const c = mLisRow(2.6, false);
  const you = me(-6.2, -0.9, 1.0, 0.55);
  let d = [], it = null, jt = null, ar = null, xk = null;
  await step(tok);                                   // 2460.0 an array that stores the answers: dp
  show(0);
  d = LA.map((v, k) => mBox('?', M.paper, LXp(k), 1.3, 0.9, 0.6, 0.4, 1.0));
  tag('dp', 'ptr', -6.0, 1.3); tag('a', 'ptr', -6.0, 2.6);
  say('再開一個陣列存答案：dp');
  await step(tok);                                   // 2468.1 n numbers → n elements, 0 to n − 1
  LA.forEach((v, k) => tag(String(k), 'idx', LXp(k), 3.4));
  say('n 個數，dp 就有 n 格', '編號 0 到 n − 1');
  await step(tok);                                   // 2474.0 at element i; the original array is a
  it = tag('i', 'ptr alt', LXp(1), 0.4); glow(c[1], GOLD);
  say('假設在第 i 格（例：a[1] = 3）', '原本的陣列叫 a');
  await step(tok);                                   // 2496.5 pseudocode: how to compute dp[i]
  show(1);
  say('寫 pseudocode：dp[i] 怎麼算？', 'i 從後面往前');
  await step(tok);                                   // 2516.5 from 3 to 4: what would h be?
  ar = mArc(LXp(1), 3.1, LXp(4), 3.1, mArcH(3) * 0.6, M.gold);
  xk = tag('跳過幾個？要加加減減，容易錯', 'bad', LXp(3), 4.6 - 0.3);
  you.mood('wow');
  say('從 3 跳到 4：h 要算成「跳過幾個」嗎？', '要加加減減，容易算錯');
  await step(tok);                                   // 2535.5 look at the index I land at, directly
  remove(xk);
  jt = tag('j', 'ptr', LXp(4), 0.4); glow(c[4], GREEN);
  tag('直接看「落在哪」：j', 'good', LXp(4) + 1.6, 0.4);
  you.mood('calm');
  say('改成直接看落點 j', '從 i 跳到 j');
  await step(tok);                                   // 2545.3 then h is j − i
  low('h 就是 j − i，不用另外數');
  say('想要 h 的話，就是 j − i');
  await step(tok);                                   // 2569.0 j from i + 1 to n
  show(3);
  say('j 從 i + 1 開始，到最後一個', '同一個數不能選兩次');
  await step(tok);                                   // 2578.0 a choices array
  show(2, '  choices = []');
  say('開一個 choices 陣列', '收集所有候選答案');
  await step(tok);                                   // 2599.4 choosing j: length dp[j] + 1
  show(5);
  low('選 j 當下一個 → 長度 = 1 + dp[j]');
  say('如果下一個選 j', '長度 = 1（自己）+ dp[j]');
  await step(tok);                                   // 2614.6 can I go from 3 to 2? no
  ar.kill(); glow(c[4], null);
  move(jt, LXp(3), 0.4); glow(c[3], RED);
  ar = mArc(LXp(1), 3.1, LXp(3), 3.1, mArcH(2) * 0.6, M.red);
  you.mood('sad');
  say('每個 j 都可以嗎？', '3 → 2 不行：變小了');
  await step(tok);                                   // 2631.0 if a[j] > a[i]
  show(4);
  low('只有 a[j] > a[i] 才能接上');
  say('所以要加條件', 'a[j] > a[i] 才能接');
  await step(tok);                                   // 2646.0 stick it in choices; afterwards max
  ar.kill(); glow(c[3], null);
  show(6); cd.hl(5);
  you.mood('calm');
  say('合格的候選就放進 choices', '最後 dp[i] = max(choices)');
  await step(tok);                                   // 2677.8 one more choice: the default
  show(2, '  choices = [1]        # 後面都不選');
  say('還漏了一個選擇：預設值');
  await step(tok);                                   // 2691.7 choose nothing after 3: length 1
  low('3 後面什麼都不選 → 長度 1');
  say('後面什麼都不選', '只有自己一個數，長度 1');
  await step(tok);                                   // 2698.7 costs you a point if you get it wrong
  tag('漏了預設值 → 考試扣分', 'bad', 4.4, 0.4);
  you.mood('wow');
  say('小細節', '忘了這個預設值，考試會被扣分');
}]);

// 45:39 實跑 8 3 5 2 4 9 7 11
FRAG.push(['dpmit2-lis-run', 'LIS 實跑：dp 由右往左 = 3 4 3 4 3 2 2 1', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.6, 0]);
  const top = board(0, 7.3), chb = board(0, 1.3, 0.4, 'pkt'), low = board(0, 0.4, 0.4, 'note');
  const you = me(-6.2, -0.9, 1.0, 0.55);
  let c = [], d = [];
  const cand = (i) => { const js = []; for (let j = i + 1; j < LA.length; j++) if (LA[j] > LA[i]) js.push(j); return js; };
  const focus = (i) => { c.forEach((m) => glow(m, null)); d.forEach((m) => glow(m, null)); glow(c[i], GOLD); };
  const setd = (i) => { relabel(d[i], LISDP[i]); tint(d[i], M.teal); glow(d[i], GREEN); };
  await step(tok);                                   // 2739.2 copy it again: 8, 3, 5, 2, 4, 9, 7, 11
  c = mLisRow(4.6, false, 1.2);
  tag('a', 'ptr', -6.2, 4.6);
  top('範例：8 3 5 2 4 9 7 11');
  say('實際跑一次：8 3 5 2 4 9 7 11');
  await step(tok);                                   // 2746.5 this is a, dp is here; where do I start?
  d = LA.map((v, k) => mBox('?', M.paper, LXp(k), 2.8, 0.9, 0.7, 0.4, 1.0));
  tag('dp', 'ptr', -6.2, 2.8);
  top('要從哪裡開始算？');
  you.mood('wow');
  say('上面是 a，下面是 dp', '從哪裡開始算？');
  await step(tok);                                   // 2761.0 for i in n − 1 down to 0
  const arr = tag('← i', 'pkt', LXp(7) + 0.6, 3.7);
  await travel(tok, arr, arr.position.clone(), V3(LXp(0), 3.7, 0), 1000);
  remove(arr);
  top('i 從 n − 1 往回到 0');
  you.mood('calm');
  say('照程式：i 從 n − 1 往回到 0', '從最右邊開始');
  await step(tok);                                   // 2778.1 start at 11: the default choice is 1
  focus(7); chb('choices = [1]');
  say('i = 7（a = 11）', '預設選項：1');
  await step(tok);                                   // 2786.5 any other choice? no: 1
  setd(7);
  say('後面沒有數了，沒別的選擇', 'dp[7] = 1');
  await step(tok);                                   // 2806.0 write the indices too: 0 … 7
  LA.forEach((v, k) => tag(String(k), 'idx', LXp(k), 5.4));
  say('把編號也寫上，比較不會搞混', '0 到 7');
  await step(tok);                                   // 2816.6 at 7, i = 6: j = 7, a[j] > a[i]?
  focus(6); chb('choices = [1]'); glow(c[7], GREEN);
  say('i = 6（a = 7）', 'j = 7：11 > 7 嗎？是');
  await step(tok);                                   // 2829.7 choose 11: length 2 = 1 + dp[7]
  glow(d[7], GOLD); chb('choices = [1, 2]');
  low('7 → 11：長度 1 + dp[7] = 2');
  say('選 11 當下一個：1 + dp[7] = 2');
  await step(tok);                                   // 2842.0 1 and 2 are the candidates: the max
  setd(6); low(null);
  say('候選 1 和 2，取最大', 'dp[6] = 2');
  await step(tok);                                   // 2862.0 how about 9? first, there's 1
  focus(5); chb('choices = [1]');
  say('i = 5（a = 9）', '先放預設的 1');
  await step(tok);                                   // 2867.3 j = 6: is the if true? nope
  glow(c[6], RED);
  say('j = 6：7 > 9 嗎？不是', '9 後面不能接 7');
  await step(tok);                                   // 2877.0 j = 7: true, so append
  glow(c[6], null); glow(c[7], GREEN); glow(d[7], GOLD);
  chb('choices = [1, 2]');
  say('j = 7：11 > 9，可以接', '放入 1 + dp[7] = 2');
  await step(tok);                                   // 2902.6 starting at 9, the longest has length 2
  setd(5);
  say('從 9 開始，最長是 2', 'dp[5] = 2（9 → 11）');
  await step(tok);                                   // 2959.7 a subsequence, not a substring: you can skip
  low('是子序列（subsequence），不是子字串：可以跳著選');
  say('學生問：一定要接下一個嗎？', '不用：子序列可以跳過中間的數');
  await step(tok);                                   // 2983.0 4: start with 1
  low(null); focus(4); chb('choices = [1]');
  say('i = 4（a = 4）', '先放 1');
  await step(tok);                                   // 2991.0 3, 3, 2
  [5, 6, 7].forEach((j) => { glow(c[j], GREEN); glow(d[j], GOLD); });
  chb('choices = [1, 3, 3, 2]');
  say('9、7、11 都比 4 大', '候選：1 + 2、1 + 2、1 + 1 → 3、3、2');
  await step(tok);                                   // 3007.0 3: the maximum
  setd(4);
  say('取最大：dp[4] = 3');
  await step(tok);                                   // 3016.0 the parent pointer: either of the 2's
  const pa = mArc(LXp(4), 5.1, LXp(5), 5.1, mArcH(1) * 0.5, M.ok), pb = mArc(LXp(4), 5.1, LXp(6), 5.1, mArcH(2) * 0.5, M.ok);
  low('parent：指向 dp = 2 的任一格都行（9 或 7）');
  say('parent pointer 指哪？', 'dp = 2 的格子都可以：9 或 7');
  await step(tok);                                   // 3045.0 dp of 2: all bigger than 2
  pa.kill(); pb.kill(); low(null);
  focus(3); [4, 5, 6, 7].forEach((j) => { glow(c[j], GREEN); glow(d[j], GOLD); });
  chb('choices = [1, 4, 3, 3, 2]');
  say('i = 3（a = 2）', '後面全都比 2 大：候選 1、4、3、3、2');
  await step(tok);                                   // 3063.0 4 is the biggest
  setd(3);
  say('最大是 4', 'dp[3] = 4（2 → 4 → 9 → 11）');
  await step(tok);                                   // 3067.4 5: what are the choices?
  focus(2); chb('choices = [1]');
  say('i = 2（a = 5）', '這格比較有趣');
  await step(tok);                                   // 3088.7 the if skips these two; 3, 3, 2 → 3
  glow(c[3], RED); glow(c[4], RED); [5, 6, 7].forEach((j) => { glow(c[j], GREEN); glow(d[j], GOLD); });
  chb('choices = [1, 3, 3, 2]');
  setd(2);
  say('2 和 4 比 5 小：if 跳過', '9、7、11 → 3、3、2，dp[2] = 3');
  await step(tok);                                   // 3118.3 3 and 8: same idea
  focus(1); setd(1); await beat(tok, 600);
  focus(0); setd(0);
  chb('8：choices = [1, 3, 2] → 3');
  low('3 和 8 同樣算：dp[1] = 4、dp[0] = 3（老師留給大家算）');
  you.mood('happy');
  say('3 和 8 也一樣算', 'dp = [3, 4, 3, 4, 3, 2, 2, 1]');
}]);

// 52:04 答案是 max(dp)；圖的看法
FRAG.push(['dpmit2-lis-max', 'LIS 答案 = max(dp) = 4，不是 dp[0]', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.6, 0]);
  const c = mLisRow(4.0);
  const d = LA.map((v, k) => mBox(LISDP[k], M.teal, LXp(k), 2.2, 0.9, 0.7, 0.4));
  tag('dp', 'ptr', -6.2, 2.2);
  const top = board(0, 7.3), low = board(0, 0.9, 0.4, 'note');
  const you = me(-6.2, -0.9, 1.0, 0.55);
  await step(tok);                                   // 3124.7 the answer overall: not dp[0]
  glow(d[0], RED);
  top('整題的答案是？不是 dp[0]');
  you.mood('wow');
  say('整題的答案是什麼？', '不是 dp[0]！');
  await step(tok);                                   // 3134.1 blackjack: start at the first card → dp[0]
  low('blackjack：一定從第 0 張開始 → 答案是 dp[0]');
  say('blackjack 一定從第 0 張開始', '所以那題的答案是 dp[0]');
  await step(tok);                                   // 3142.0 the maximum of all the dps
  glow(d[0], null);
  for (let k = 0; k < 8; k++) { glow(d[k], GOLD); await beat(tok, 120); glow(d[k], null); }
  top('答案 = 所有 dp 的最大值');
  you.mood('calm');
  say('這題要取所有 dp 的最大值');
  await step(tok);                                   // 3146.0 I can start my sequence anywhere
  low('LIS 可以從任何一個數開始');
  say('因為子序列可以從任何一個數開始');
  await step(tok);                                   // 3149.0 the overall answer: 4
  [1, 3].forEach((k) => glow(d[k], GREEN));
  tag('max(dp) = 4', 'good', 3.6, 1.4 - 0.5);
  you.mood('happy'); await you.hop(tok);
  say('最大值是 4', 'dp[1] = dp[3] = 4');
  await step(tok);                                   // 3159.6 if you don't understand: represent it as a graph
  top('還不懂？畫成圖看看');
  you.mood('calm');
  say('如果還不太懂', '試著畫成圖');
  await step(tok);                                   // 3164.0 numbers are nodes; edge when first < second
  const arcs = [];
  for (let i = 0; i < LA.length; i++) for (let j = i + 1; j < LA.length; j++) if (LA[i] < LA[j]) { const a = mArc(LXp(i), 4.5, LXp(j), 4.5, mArcH(j - i) * 0.45, M.faint); a.i = i; a.j = j; arcs.push(a); }
  low('數字 = 節點；前面比後面小 → 連一條邊');
  say('每個數是一個節點', '前面的數比後面小，就連一條邊');
  await step(tok);                                   // 3174.0 write the shortest-path formulation and compare
  const path = [1, 4, 5, 7];
  for (let k = 0; k + 1 < path.length; k++) mCol(arcs.find((a) => a.i === path[k] && a.j === path[k + 1]), M.ok);
  path.forEach((k) => glow(c[k], GREEN));
  low('LIS = DAG 上的最長路徑（例 3 → 4 → 9 → 11）：寫出來對照 DP');
  say('寫成圖上的最長（最短）路徑', '再對照 DP 的式子，就看出兩者一樣');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
