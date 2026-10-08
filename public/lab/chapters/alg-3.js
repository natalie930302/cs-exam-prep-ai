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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dpbari3.js ═══
  {
// ─── Abdul Bari：9iE9Mj4m8jk（4.1 多段圖，分段填表）、FcScLYJI42E（4.1.1 程式：8 頂點 4 stage → 9，1→2→6→8）、
//     nLmhmB6NzcM（4.5 0/1 knapsack：p = 1 2 5 6、w = 2 3 4 5、m = 8 → 8，表格法＋sets 法）、zRza99HPvkQ（4.5.1 程式 k[5][9]）、
//     XaXsJJh-Q5Y / Q4zHb-Swzro（4.7 TSP：c = [0 10 15 20; 5 0 9 10; 6 13 0 12; 8 8 9 0] → 35）、
//     sSno9rV8Rhg（4.9 LCS：cdgi、egi、bace/abce、bd vs abcd、stone vs longest → ONE） ───
// 5dRGRueKU3M 直接沿用模組原本的 greedy-vs-dp / fib-* 場景。用模組的 grid / playStep / buildMSG / knapGrid / lcsGrid。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code } = K;
const mono = (l) => { Object.assign(l.element.style, K.MONO); return l; };
const LT = '#f3d27a', LG = '#9fe0c4', DIM = '#ddd2bf';

// ════════════════ 9iE9Mj4m8jk：多段圖（12 頂點）分段填表 ════════════════
async function msgPart(tok, pre, run, intro) {
  fresh([0, 4.4, 15.5], [0, 3.8, 0]);
  const G = buildMSG(true, false);
  pre.forEach((v) => msgFill(G, v));
  say(intro[0], intro[1]);
  await beat(tok, 2600);
  for (const v of run) await msgStepAnim(G, MS.steps.find((s) => s.v === v), tok, 2000);
  Object.values(G.edge).forEach((e) => tint(e, SAND));
  return G;
}
FRAG.push(['dpbari3-msg-s4', '多段圖：sink 與 stage 4 的 cost', async (tok) => {
  const G = await msgPart(tok, [], [12, 9, 10, 11], ['從 sink 往回算每個頂點的 cost', 'cost(i, j)：i = stage、j = 頂點']);
  say('stage 4 都只有一條邊到 12', 'cost(4,9) = 4、cost(4,10) = 2、cost(4,11) = 5');
  await beat(tok, 2600);
  [9, 10, 11].forEach((v) => G.g.mark(1, v - 1, LT));
  say('d 記下「走到哪個頂點」', 'd(4,9) = d(4,10) = d(4,11) = 12');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-msg-s3', '多段圖：stage 3 與重疊子問題', async (tok) => {
  const G = await msgPart(tok, [12, 9, 10, 11], [6, 7, 8], ['stage 3：頂點 6、7、8', '每點看兩條邊，取最小']);
  glow(G.node[9], GOLD); glow(G.node[10], GOLD);
  [6, 7].forEach((v) => { tint(edgeOf(G, v, 9), ORANGE); tint(edgeOf(G, v, 10), ORANGE); });
  say('cost(4,9)、cost(4,10) 給 6、7 重複用', 'overlapping subproblems：查表就好');
  await beat(tok, 3200);
  glow(G.node[9], null); glow(G.node[10], null);
  Object.values(G.edge).forEach((e) => tint(e, SAND));
  say('stage 3：7、5、7，d 都是 10', 'cost(3,6) = 7、cost(3,7) = 5、cost(3,8) = 7');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-msg-s2', '多段圖：stage 2 的 cost', async (tok) => {
  const G = await msgPart(tok, [12, 9, 10, 11, 6, 7, 8], [2, 4, 5], ['stage 2：用 stage 3 的 cost', '頂點 2 有三條邊、4 一條、5 兩條']);
  glow(G.node[3], GOLD); msgFill(G, 3);
  say('表上 cost(2,3) = 9，d = 6', 'min(2 + 7, 7 + 5) = 9');
  await beat(tok, 2600);
  glow(G.node[3], null);
  say('stage 2：7、9、18、15', 'd：7、6、8、8');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-msg-s1', '多段圖：cost(1,1) = 16', async (tok) => {
  const G = await msgPart(tok, [12, 9, 10, 11, 6, 7, 8, 2, 3, 4, 5], [1], ['最後填 source：頂點 1', '四條邊到 2、3、4、5']);
  glow(G.node[2], GREEN); glow(G.node[3], GREEN);
  say('16、16、21、17：經 2 或 3 都是 16', 'cost(1,1) = 16，d = 2 或 3');
  await beat(tok, 3000);
  glow(G.node[2], null); glow(G.node[3], null);
  say('最小成本只有一個：16', '只是剛好有兩條路徑達到它');
  await beat(tok, 2600);
  say('從最後一個 stage 往回填', '卻叫 forward method：看決策方向');
  await beat(tok, 3000);
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
function mpBuild(drop) {
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
  [-6.2, -4.5, -2.6, -0.9].forEach((x, s) => tag('stage ' + (s + 1), 'idx', x, 7.75));
  G.g = grid({ rows: 2, cols: 9, cw: 0.74, ch: 0.55, x0: -5.4, y0: 2.6, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: ['cost', 'd'], rowDx: 0.5 });
  G.g.mark(0, 0, DIM); G.g.mark(1, 0, DIM);
  return G;
}
function mpFill(G, i, drop = 1) {
  G.g.set(0, i, MPS.cost[i], TEAL, drop); G.g.set(1, i, i === 8 ? '—' : MPS.d[i], PURPLE, drop);
  tint(G.node[i], TEAL); txt(G.cl[i], String(MPS.cost[i])); showL(G.cl[i], true);
}
async function mpTrace(tok, G, cd, i, ms, showZero) {
  glow(G.node[i], GOLD); cd.hl(2);
  say('i = ' + i + '：min 先設成 32767', 'k 從 i+1 = ' + (i + 1) + ' 跑到 n = 8');
  await beat(tok, ms);
  let min = 32767, best = null;
  for (const t of MPS.log[i]) {
    if (!t.c) {
      if (showZero) { cd.hl(4); glow(G.node[t.k], GOLD); say('k = ' + t.k + '：c[' + i + '][' + t.k + '] = 0，沒有邊', '條件不成立，跳過'); await beat(tok, ms); glow(G.node[t.k], null); }
      continue;
    }
    cd.hl(5); glow(G.node[t.k], GOLD); tint(G.edge[i + '-' + t.k], ORANGE);
    const better = t.v < min;
    say('k = ' + t.k + '：c[' + i + '][' + t.k + '] + cost[' + t.k + ']', t.c + ' + ' + MPS.cost[t.k] + ' = ' + t.v + (better ? ' < ' + min + '：更新' : '，不小於 ' + min + '：不換'));
    await beat(tok, ms);
    if (better) { if (best) tint(G.edge[i + '-' + best], GRAY); cd.hl(7); min = t.v; best = t.k; await beat(tok, ms * 0.4); }
    else tint(G.edge[i + '-' + t.k], GRAY);
    glow(G.node[t.k], null);
  }
  tint(G.edge[i + '-' + best], TEAL); cd.hl(9); mpFill(G, i); glow(G.node[i], null);
  say('cost[' + i + '] = ' + min + '，d[' + i + '] = ' + best, '');
  await beat(tok, ms * 0.8);
}
FRAG.push(['dpbari3-msgp-data', '多段圖程式：c[9][9]、cost、d、p', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(true);
  say('4 個 stage、8 個頂點', 'n = 8，stages = 4');
  await beat(tok, 3200);
  ['1-2', '1-3', '1-4'].forEach((k) => tint(G.edge[k], ORANGE));
  const cm = mono(tag('c[1][2]=2  c[1][3]=1  c[1][4]=3', '', 3.6, 7.0));
  say('cost adjacency matrix c', '有邊填權重，沒邊填 0');
  await beat(tok, 3400);
  ['1-2', '1-3', '1-4'].forEach((k) => tint(G.edge[k], SAND));
  G.g.mark(0, 0, '#f0b8a8'); G.g.mark(1, 0, '#f0b8a8');
  say('陣列大小都是 9：index 0 不用', '頂點從 1 編到 8 → 0..8');
  await beat(tok, 3400);
  const a = [mono(tag('cost[i]：i 到 sink 的最小成本', '', 3.6, 5.8)), mono(tag('d[i]  ：給出最小值的下一個頂點', '', 3.6, 5.2)), mono(tag('p[ ]  ：最後的路徑', '', 3.6, 4.6))];
  say('三個陣列：cost、d、p', 'c 是 9×9；cost、d、p 都是 9');
  await beat(tok, 3200);
  say('資料直接寫在 main 裡', '要換題目就改值，或改成讀輸入');
  await beat(tok, 3200);
  kill(cm); a.forEach(kill);
}]);
FRAG.push(['dpbari3-msgp-loop', '多段圖程式：i 從 n−1 往回，追蹤 i = 4', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  const cd = code(MPCODE, 3.7, 7.4, 0.45);
  cd.hl(0); mpFill(G, 8);
  say('cost[8] = 0：sink 不用再走', 'cost[n] = 0');
  await beat(tok, 2600);
  cd.hl(1);
  for (const i of [7, 6, 5]) {
    tint(G.edge[i + '-8'], TEAL); mpFill(G, i);
    say('i = ' + i + '：只有一條邊到 8', 'cost[' + i + '] = ' + mpC(i, 8) + '，d[' + i + '] = 8');
    await beat(tok, 1700);
  }
  await mpTrace(tok, G, cd, 4, 2300, true);
  say('12 與 12 平手：用 <，留住先找到的 5', 'cost[4] = 12，d[4] = 5');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-msgp-rest', '多段圖程式：i = 3、2、1 → cost[1] = 9', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  const cd = code(MPCODE, 3.7, 7.4, 0.45);
  [8, 7, 6, 5, 4].forEach((v) => mpFill(G, v, 0));
  say('8 到 4 已經填好', '接著 i = 3：只有 3→5、3→6 有邊');
  await beat(tok, 2400);
  await mpTrace(tok, G, cd, 3, 2100, false);
  say('其他 k 的 c[3][k] = 0：都跳過', 'cost[3] = min(6+6, 7+4) = 11');
  await beat(tok, 2200);
  await mpTrace(tok, G, cd, 2, 1500, false);
  await mpTrace(tok, G, cd, 1, 1500, false);
  say('cost[1] = 9：source 到 sink 最短 9', 'd[1] = 2');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-msgp-path', '多段圖程式：p[i] = d[p[i−1]] 找路徑', async (tok) => {
  fresh([0, 4.4, 15], [0, 4.4, 0]);
  const G = mpBuild(false);
  for (let v = 8; v >= 1; v--) mpFill(G, v, 0);
  const cd = code(['p[1] = 1;', 'p[stages] = n;', 'for (i = 2; i < stages; i++)', '  p[i] = d[p[i-1]];'], 3.6, 7.0, 0.5);
  const P = grid({ rows: 1, cols: 5, cw: 0.74, ch: 0.55, x0: -5.4, y0: 0.95, colHdr: [0, 1, 2, 3, 4], rowHdr: ['p'], rowDx: 0.5 });
  P.mark(0, 0, DIM);
  say('有 4 個 stage：路徑上剛好 4 個頂點', 'p[0..4] 就夠');
  await beat(tok, 2600);
  cd.hl(0); P.set(0, 1, 1, ORANGE); glow(G.node[1], GOLD);
  say('起點一定是 1', 'p[1] = 1');
  await beat(tok, 1800);
  cd.hl(1); P.set(0, 4, 8, ORANGE); glow(G.node[8], GOLD);
  say('終點一定是 n = 8', 'p[4] = 8');
  await beat(tok, 1800);
  const p = [0, 1];
  for (const i of [2, 3]) {
    cd.hl(3); G.g.mark(1, p[i - 1], LT); glow(G.g.get(1, p[i - 1]), GOLD);
    p[i] = MPS.d[p[i - 1]];
    say('p[' + i + '] = d[p[' + (i - 1) + ']] = d[' + p[i - 1] + ']', '= ' + p[i] + '：' + p[i - 1] + ' 之後走 ' + p[i]);
    await beat(tok, 2200);
    P.set(0, i, p[i], ORANGE); tint(G.edge[p[i - 1] + '-' + p[i]], ORANGE); glow(G.node[p[i]], GOLD);
    glow(G.g.get(1, p[i - 1]), null);
    await beat(tok, 900);
  }
  tint(G.edge['6-8'], ORANGE);
  say('最短路徑 1 → 2 → 6 → 8', '2 + 3 + 4 = 9 = cost[1]');
  await beat(tok, 3200);
}]);
FRAG.push(['dpbari3-msgp-time', '多段圖程式：內圈 1+2+…+n → O(n²)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  code(['for (i = n-1; i >= 1; i--)', '  for (k = i+1; k <= n; k++)', '    …比較 c[i][k] + cost[k]…'], -3.6, 7.4, 0.5);
  say('兩層迴圈：先別直接說 n²', '看內圈實際跑幾次');
  await beat(tok, 2600);
  let total = 0; const cnt = tag('合計 0 次', 'ptr alt', 3.8, 7.3);
  for (let i = 7; i >= 1; i--) {
    const m = 8 - i, x = -5 + (7 - i) * 1.5;
    tag('i=' + i, 'idx', x, 0.5);
    for (let h = 0; h < m; h++) cube('', i % 2 ? BLUE : TEAL, [0.9, 0.5, 0.5], x, 1.0 + h * 0.55, 0, 1.2);
    total += m; txt(cnt, '合計 ' + total + ' 次');
    say('i = ' + i + '：k 從 ' + (i + 1) + ' 到 8', '內圈 ' + m + ' 次');
    await beat(tok, 1100);
  }
  say('1 + 2 + … ≈ n(n+1)/2', '每次只做 O(1) 的比較');
  await beat(tok, 2800);
  say('多段圖程式的時間：O(n²)', 'n = 頂點數');
  await beat(tok, 3000);
}]);

// ════════════════ nLmhmB6NzcM：0/1 knapsack（表格法＋sets 法） ════════════════
const KP = KN.items.map(([w, p]) => ({ w, p }));           // p = 1 2 5 6、w = 2 3 4 5
const KV = knapSteps(KN.items, KN.W).V;
function kGridFilled(rows) {
  const g = knapGrid(KN.items, KN.W);
  tag('列 = 前 i 件 (wᵢ, pᵢ)', 'idx', -4.4, 7.05);
  for (let i = 1; i <= rows; i++) for (let w = 1; w <= KN.W; w++) g.set(i, w, KV[i][w], BLUE, 0);
  return g;
}
FRAG.push(['dpbari3-knap-problem', '0/1 knapsack：4 件物品、容量 m = 8', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const objs = KP.map((o, k) => {
    const x = -5.6 + [0, 1.3, 2.9, 4.8][k];
    const m = cube(k + 1, [ORANGE, PINK, BLUE, TEAL][k], [0.25 * o.w + 0.2, 0.8, 0.7], x, 5.6, 0, 1.6);
    tag('p=' + o.p + ' w=' + o.w, 'idx', x, 4.8);
    return m;
  });
  const bag = K.ghostBox('#c9a35a', 3.4, 2.2, 1.2); bag.position.set(3.8, 2.4, 0);
  tag('背包 m = 8', 'ptr', 3.8, 3.9);
  say('4 件物品，各有利潤 p 與重量 w', '背包容量 m = 8');
  await beat(tok, 3200);
  say('全放？總重 2+3+4+5 = 14 > 8', '只能帶其中一部分');
  objs.forEach((m, k) => move(m, 2.6 + k * 0.75, 2.4, 0));
  await beat(tok, 2000);
  objs.forEach((m) => tint(m, RED));
  await beat(tok, 2000);
  objs.forEach((m, k) => { move(m, -5.6 + [0, 1.3, 2.9, 4.8][k], 5.6, 0); tint(m, [ORANGE, PINK, BLUE, TEAL][k]); });
  const xs = mono(tag('x = ( x1, x2, x3, x4 )', '', -3.0, 3.2));
  say('每件只能整件拿或不拿', 'xᵢ = 0 或 1，不能拿一半');
  await beat(tok, 3000);
  say('目標：Σ pᵢxᵢ 最大', '限制：Σ wᵢxᵢ ≤ m');
  await beat(tok, 3400);
  say('同一題會用兩種 DP 方法解', '表格法（tabulation）與 sets 法');
  await beat(tok, 2800);
  kill(xs);
}]);
FRAG.push(['dpbari3-knap-brute', '0/1 knapsack：一連串決策、2ⁿ 種解', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.0, 0]);
  say('DP：最佳化＋一連串決策', '從最後一件開始決定：放或不放');
  await beat(tok, 2600);
  const nodes = [{ x: 0, y: 7.4, bits: [], w: 0 }];
  cube('', PURPLE, [0.5, 0.4, 0.4], 0, 7.4, 0, 1.2);
  let lvl = nodes;
  for (let d = 0; d < 4; d++) {
    const i = 4 - d, sp = 11.2 / 2 ** (d + 1), nx = [];
    lvl.forEach((n) => [0, 1].forEach((b) => {
      const x = n.x + (b ? 1 : -1) * sp / 2, y = 7.4 - (d + 1) * 1.35;
      rod(V3(n.x, n.y - 0.2, -0.05), V3(x, y + 0.2, -0.05), b ? ORANGE : GRAY, 0.022);
      const c = { x, y, bits: [b].concat(n.bits), w: n.w + b * KP[i - 1].w };
      c.m = cube(d === 3 ? c.bits.join('') : b, b ? ORANGE : GRAY, [d === 3 ? 0.62 : 0.4, 0.36, 0.36], x, y, 0, 1);
      nx.push(c);
    }));
    lvl = nx;
    say('x' + i + ' = 0 或 1', '第 ' + (d + 1) + ' 層：' + 2 ** (d + 1) + ' 種');
    await beat(tok, 1300);
  }
  say('4 件 → 2⁴ = 16 種 0/1 組合', 'n 件 → 2ⁿ 種');
  await beat(tok, 2600);
  lvl.forEach((c) => tint(c.m, c.w > KN.W ? RED : TEAL));
  say('有些超重（紅色）：不可行', '全部試一遍要 O(2ⁿ)');
  await beat(tok, 3000);
  say('DP 用表格間接試遍所有可能', '不必真的列出 2ⁿ 種');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-knap-rows', '0/1 knapsack：直覺填前三列', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  const g = kGridFilled(0);
  say('列 = 考慮前 i 件，行 = 容量 0..8', '格子裡寫最大利潤');
  await beat(tok, 2800);
  say('第 0 列、第 0 行都是 0', '沒有物品或容量 0 → 利潤 0');
  await beat(tok, 2400);
  const S = knapSteps(KN.items, KN.W).steps;
  const caps = {
    1: [['物品 1：w = 2、p = 1', '容量 ≥ 2 才放得下'], ['只有一件可放：之後都是 1', 'V[1][2..8] = 1']],
    2: [['物品 2：w = 3、p = 2（也考慮物品 1）', '容量 3 → 2'], ['容量 5：兩件都放 1 + 2 = 3', '之後都是 3']],
    3: [['物品 3：w = 4、p = 5', '容量 4 → 5'], ['容量 6：1+5 = 6；容量 7：2+5 = 7', '三件共重 9 > 8：放不下']],
  };
  for (const i of [1, 2, 3]) {
    say(caps[i][0][0], caps[i][0][1]);
    for (const s of S.filter((x) => x.r === i)) {
      if (s.c === { 1: 3, 2: 5, 3: 6 }[i]) say(caps[i][1][0], caps[i][1][1]);
      await playStep(g, s, tok, 560, true);
    }
    await beat(tok, 900);
  }
  g.clearArrows(); g.unglow();
  say('前三列：放得下就加上、不然照抄上一列', '第 4 列改用公式');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-knap-formula', '0/1 knapsack：用公式填第 4 列', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  const g = kGridFilled(3);
  say('公式：不放 vs 放第 i 件，取大', 'V[i,w] = max(V[i−1,w], V[i−1,w−wᵢ] + pᵢ)');
  await beat(tok, 3400);
  const S = knapSteps(KN.items, KN.W).steps.filter((s) => s.r === 4);
  for (const s of S) {
    const fit = s.c >= 5;
    const st = Object.assign({}, s, { cap: fit ? 'V[4][' + s.c + ']：兩項取大' : 'w = ' + s.c + ' − 5 < 0：沒這格', formula: fit ? s.formula : 'V[4][' + s.c + '] = V[3][' + s.c + '] = ' + s.v });
    await playStep(g, st, tok, fit ? 2600 : 900, false);
  }
  g.clearArrows(); g.unglow();
  say('也能直接填：容量 8 放物品 2、4', 'p：2 + 6 = 8；w：3 + 5 = 8');
  glow(g.get(4, 8), GREEN);
  await beat(tok, 3200);
}]);
FRAG.push(['dpbari3-knap-trace', '0/1 knapsack：從 8 往回決定 x', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.6, 0]);
  const g = kGridFilled(4);
  say('表填好了，現在才做一連串決策', '從最大利潤 V[4][8] = 8 開始');
  await beat(tok, 2600);
  let P = 8; const x = [];
  for (let i = 4; i >= 1; i--) {
    g.unglow();
    for (let w = 0; w <= KN.W; w++) if (KV[i][w] === P && g.get(i, w)) glow(g.get(i, w), GOLD);
    const prev = KV[i - 1].indexOf(P);
    if (prev >= 0) { glow(g.get(i - 1, prev), GREEN); g.mark(i - 1, prev, LG); }
    x[i] = prev >= 0 ? 0 : 1;
    say(prev >= 0 ? P + ' 在第 ' + (i - 1) + ' 列也有：x' + i + ' = 0' : P + ' 不在第 ' + (i - 1) + ' 列：x' + i + ' = 1', x[i] ? '剩下利潤 ' + P + ' − ' + KP[i - 1].p + ' = ' + (P - KP[i - 1].p) : '不是因為第 ' + i + ' 件');
    await beat(tok, 2600);
    tag('x' + i + '=' + x[i], x[i] ? 'ptr alt' : 'ptr', -3.6 + i * 1.4, 2.3);
    if (x[i]) P -= KP[i - 1].p;
  }
  g.unglow();
  say('x = (0, 1, 0, 1)：放物品 2、4', '利潤 2 + 6 = 8，重量 3 + 5 = 8');
  await beat(tok, 3400);
}]);
// sets 法：(p, w) 有序對
const kAdd = (S, o) => S.map(([p, w]) => [p + o.p, w + o.w]);
const pairCube = (pr, color, x, y, drop = 0) => cube(pr[0] + ',' + pr[1], color, [0.82, 0.42, 0.4], x, y, 0, drop);
FRAG.push(['dpbari3-knap-sets', '0/1 knapsack sets 法：S⁰ → S³', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const Y = [7.0, 5.4, 3.8, 2.2];
  let S = [[0, 0]];
  tag('S0', 'ptr', -6.3, Y[0]); pairCube(S[0], GRAY, -5.0, Y[0], 1.2);
  say('有序對 (p, w)：利潤、重量', 'S0 = {(0,0)}：什麼都沒放');
  await beat(tok, 2800);
  for (let i = 0; i < 3; i++) {
    const o = KP[i], add = kAdd(S, o);
    tag('S' + i + '¹', 'ptr alt', 0.7, Y[i]);
    say('S' + i + '¹：每對都加上物品 ' + (i + 1) + ' (' + o.p + ',' + o.w + ')', add.map((q) => '(' + q + ')').join(' '));
    add.forEach((q, k) => pairCube(q, ORANGE, 1.9 + k * 1.0, Y[i], 1.2));
    await beat(tok, 2600);
    const M = S.concat(add);
    tag('S' + (i + 1), 'ptr', -6.3, Y[i + 1]);
    M.forEach((q, k) => pairCube(q, k < S.length ? TEAL : ORANGE, -5.0 + k * 1.0, Y[i + 1], 1.2));
    say('合併：S' + (i + 1) + ' = S' + i + ' ∪ S' + i + '¹', M.length + ' 對：物品 1..' + (i + 1) + ' 放或不放');
    await beat(tok, 2600);
    S = M;
  }
  say('S3 有 8 對 = 2³ 種可能', '下一步：刪掉不合理的對');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-knap-dominance', '0/1 knapsack sets 法：dominance rule 與 S⁴', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const S3raw = [[0, 0], [1, 2], [2, 3], [3, 5], [5, 4], [6, 6], [7, 7], [8, 9]];
  tag('S3', 'ptr', -6.3, 6.6);
  const cs = S3raw.map((q, k) => pairCube(q, TEAL, -5.0 + k * 1.0, 6.6, 1.2));
  say('S3：(p, w) 共 8 對', '容量 m = 8');
  await beat(tok, 2400);
  glow(cs[7], RED);
  say('(8,9)：重量 9 > 8，丟掉', '超過背包容量');
  await beat(tok, 2200);
  fly(cs[7]);
  glow(cs[3], GOLD); glow(cs[4], GOLD);
  say('(3,5) → (5,4)：利潤變大、重量反而變小', '(3,5) 被支配：利潤小的那個丟掉');
  await beat(tok, 3200);
  fly(cs[3]);
  const keep = [0, 1, 2, 4, 5, 6];
  keep.forEach((k, j) => move(cs[k], -5.0 + j * 1.0, 6.6, 0));
  glow(cs[4], null);
  say('這叫 dominance rule', 'S3 剩 6 對');
  await beat(tok, 2400);
  const S3 = keep.map((k) => S3raw[k]);
  const add = kAdd(S3, KP[3]);
  tag('S3¹', 'ptr alt', -6.3, 4.8);
  add.forEach((q, k) => pairCube(q, ORANGE, -5.0 + k * 1.0, 4.8, 1.2));
  say('S3¹：每對加上物品 4 (6,5)', add.map((q) => '(' + q + ')').join(' '));
  await beat(tok, 3000);
  const all = S3.concat(add.filter((q) => !(q[0] === 7 && q[1] === 7))).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  tag('S4', 'ptr', -6.3, 2.8);
  const c4 = all.map((q, k) => pairCube(q, add.some((r) => r[0] === q[0] && r[1] === q[1]) ? ORANGE : TEAL, -5.4 + k * 1.0, 2.8, 1.2));
  say('合併成 S4（照重量排）', '(7,7) 兩邊都有，只留一個');
  await beat(tok, 2600);
  const i66 = all.findIndex((q) => q[0] === 6 && q[1] === 6);
  glow(c4[i66], GOLD); glow(c4[i66 - 1], GOLD);
  say('(6,5) 與 (6,6)：利潤一樣、重量較大', '丟掉 (6,6)');
  await beat(tok, 2600);
  fly(c4[i66]);
  all.forEach((q, k) => { if (q[1] > KN.W) { glow(c4[k], RED); fly(c4[k]); } });
  say('(11,9)、(12,11)、(13,12) 超重', '全部丟掉');
  await beat(tok, 2000);
  const fin = all.map((q, k) => [q, c4[k]]).filter(([q], k) => k !== i66 && q[1] <= KN.W);
  fin.forEach(([, m], j) => { glow(m, null); move(m, -5.0 + j * 1.0, 2.8, 0); });
  say('S4 剩 7 對；仍是試遍所有可能', '(0,0) (1,2) (2,3) (5,4) (6,5) (7,7) (8,8)');
  await beat(tok, 3400);
}]);
FRAG.push(['dpbari3-knap-sets-trace', '0/1 knapsack sets 法：(8,8) 往回找 x', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 4.2, 0]);
  const SS = [[[0, 0]], [[0, 0], [1, 2]], [[0, 0], [1, 2], [2, 3], [3, 5]], [[0, 0], [1, 2], [2, 3], [5, 4], [6, 6], [7, 7]], [[0, 0], [1, 2], [2, 3], [5, 4], [6, 5], [7, 7], [8, 8]]];
  const Y = [7.4, 6.2, 5.0, 3.8, 2.6];
  const C = SS.map((S, i) => { tag('S' + i, 'ptr', -6.3, Y[i]); return S.map((q, k) => pairCube(q, TEAL, -5.0 + k * 1.0, Y[i])); });
  const find = (i, q) => SS[i].findIndex((r) => r[0] === q[0] && r[1] === q[1]);
  say('最大的有序對：(8,8)，利潤 8', '從 S4 往回看');
  await beat(tok, 2600);
  let q = [8, 8]; const x = [];
  for (let i = 4; i >= 1; i--) {
    C.flat().forEach((m) => glow(m, null));
    const a = find(i, q), b = find(i - 1, q);
    glow(C[i][a], GOLD); if (b >= 0) glow(C[i - 1][b], GREEN);
    x[i] = b >= 0 ? 0 : 1;
    const nq = x[i] ? [q[0] - KP[i - 1].p, q[1] - KP[i - 1].w] : q;
    say('(' + q + ') ∈ S' + i + (b >= 0 ? '，也 ∈ S' + (i - 1) + '：x' + i + ' = 0' : '，∉ S' + (i - 1) + '：x' + i + ' = 1'), x[i] ? '(' + q + ') − (' + KP[i - 1].p + ',' + KP[i - 1].w + ') = (' + nq + ')' : '不是因為物品 ' + i);
    await beat(tok, 2800);
    tag('x' + i + '=' + x[i], x[i] ? 'ptr alt' : 'ptr', 3.0 + (i - 1) * 1.0, 1.4);
    q = nq;
  }
  C.flat().forEach((m) => glow(m, null));
  say('x = (0, 1, 0, 1)：與表格法相同', '利潤 8');
  await beat(tok, 3200);
}]);

// ════════════════ zRza99HPvkQ：0/1 knapsack 程式（k[5][9]） ════════════════
const KCODE = ['for (i = 0; i <= n; i++)', ' for (w = 0; w <= m; w++) {', '  if (i == 0 || w == 0)', '   k[i][w] = 0;', '  else if (wt[i] <= w)', '   k[i][w] = max(p[i] +', '     k[i-1][w-wt[i]],', '     k[i-1][w]);', '  else', '   k[i][w] = k[i-1][w];', ' }'];
function kpBuild(rowsFilled, drop) {
  const g = grid({ rows: 5, cols: 9, cw: 0.64, ch: 0.56, x0: 0.75, y0: 6.9, colHdr: Array.from({ length: 9 }, (_, k) => k), rowHdr: [0, 1, 2, 3, 4], rowDx: 0.15 });
  tag('w →', 'idx', 0.1, 7.45);
  const A = grid({ rows: 2, cols: 5, cw: 0.64, ch: 0.5, x0: 0.75, y0: 3.0, rowHdr: ['p', 'wt'], rowDx: 0.25 });
  [0, ...KP.map((o) => o.p)].forEach((v, k) => A.set(0, k, v, k ? ORANGE : GRAY, drop ? 1.2 : 0));
  [0, ...KP.map((o) => o.w)].forEach((v, k) => A.set(1, k, v, k ? PINK : GRAY, drop ? 1.2 : 0));
  tag('n = 4，m = 8', 'ptr', 5.0, 2.75);
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
async function kpRow(tok, g, cd, i, slow) {
  for (let w = 0; w <= 8; w++) {
    const { line, s } = kpStep(i, w);
    cd.hl(line);
    const isSlow = slow.includes(w);
    await playStep(g, s, tok, isSlow ? 2600 : 520, !isSlow);
  }
  g.clearArrows(); g.unglow();
}
FRAG.push(['dpbari3-knapp-data', '0/1 knapsack 程式：p[5]、wt[5]、k[5][9]', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(0, true);
  say('資料：p[]、wt[]、n = 4、m = 8', '陣列大小 5：index 0 空著');
  await beat(tok, 3600);
  say('表 k[5][9]：列 0..4、行 0..8', '多一列、一行放初始的 0');
  for (let i = 0; i < 5; i++) g.mark(i, 0, LT);
  for (let w = 0; w < 9; w++) g.mark(0, w, LT);
  await beat(tok, 3000);
  say('只寫一個 main，固定這組資料', '要換資料：改值或改成讀輸入');
  await beat(tok, 2800);
  cd.hl(0);
  say('核心：兩層 for，i 是列、w 是行', '三種情況：if / else if / else');
  await beat(tok, 3400);
  say('接著追蹤迴圈怎麼把表填滿', '一列一列、由左到右');
  await beat(tok, 2600);
}]);
FRAG.push(['dpbari3-knapp-row01', '0/1 knapsack 程式：追蹤第 0、1 列', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(0, false);
  say('i = 0：整列都走第一種情況', 'k[0][w] = 0');
  await beat(tok, 2000);
  await kpRow(tok, g, cd, 0, [0]);
  say('i = 1：考慮物品 1（p = 1、wt = 2）', '');
  await beat(tok, 2000);
  await kpRow(tok, g, cd, 1, [0, 1, 2, 3]);
  say('第 1 列：之後都走第二種情況', '結果都是 1');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-knapp-row2', '0/1 knapsack 程式：追蹤第 2 列', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(2, false);
  say('i = 2：物品 2（p = 2、wt = 3）', 'w = 0 → 0；w = 1、2 → 照抄');
  await beat(tok, 2400);
  await kpRow(tok, g, cd, 2, [1, 3, 5]);
  say('容量 5：物品 1、2 都放 → 3', '2 + 3 = 5 剛好裝滿');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-knapp-row34', '0/1 knapsack 程式：第 3、4 列與答案', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(KCODE, -3.6, 7.4, 0.45);
  const g = kpBuild(3, false);
  say('i = 3：物品 3（p = 5、wt = 4）', 'w < 4 照抄上一列');
  await beat(tok, 2400);
  await kpRow(tok, g, cd, 3, [4, 6, 7]);
  say('i = 4：物品 4（p = 6、wt = 5）', '直接填：0 0 1 2 5 6 6 7 8');
  await beat(tok, 2000);
  await kpRow(tok, g, cd, 4, [8]);
  glow(g.get(4, 8), GREEN);
  say('cout << k[n][m]：最大利潤 8', 'k[4][8] = 8');
  await beat(tok, 3200);
}]);
FRAG.push(['dpbari3-knapp-trace', '0/1 knapsack 程式：while 迴圈印出 x', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 4.4, 0]);
  const cd = code(['i = n; j = m;', 'while (i > 0 && j > 0) {', ' if (k[i][j] == k[i-1][j]) {', '   cout << i << " = 0";', '   i--;', ' } else {', '   cout << i << " = 1";', '   j = j - wt[i]; i--;', ' }', '}'], -3.6, 7.4, 0.48);
  const g = kpBuild(5, false);
  cd.hl(0);
  say('從 i = 4、j = 8 開始', '跟上一列比');
  await beat(tok, 2400);
  let i = 4, j = 8, n = 0;
  while (i > 0 && j > 0) {
    cd.hl(2); g.unglow(); glow(g.get(i, j), GOLD); glow(g.get(i - 1, j), GOLD);
    const same = KV[i][j] === KV[i - 1][j];
    say('k[' + i + '][' + j + '] = ' + KV[i][j] + (same ? ' 等於' : ' 不等於') + '上面的 ' + KV[i - 1][j], same ? '物品 ' + i + ' 沒放：i--' : '物品 ' + i + ' 有放：j −= ' + KP[i - 1].w);
    await beat(tok, 2600);
    cd.hl(same ? 3 : 6); g.mark(i, j, same ? LT : LG);
    mono(tag(i + ' = ' + (same ? 0 : 1), same ? '' : 'ptr alt', 5.0 - n * 1.2, 1.3)); n++;
    if (!same) j -= KP[i - 1].w;
    i--;
    await beat(tok, 1300);
  }
  g.unglow(); cd.hl(1);
  say('j = 0：迴圈結束，物品 1 沒印出', '補充：沒印的就是 0 → x = 0 1 0 1');
  await beat(tok, 3400);
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
FRAG.push(['dpbari3-tsp-problem', 'TSP：成本矩陣與旅行路線', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 4.8, 0]);
  const T = tspGraph(true), M = tspMatrix(true);
  say('有向加權圖＋成本矩陣', '一條雙向邊 = 兩條平行邊');
  await beat(tok, 2800);
  glow(M.get(0, 1), GOLD); glow(M.get(1, 0), GOLD); tint(T.e(1, 2), ORANGE);
  say('1→2 是 10，2→1 是 5', '兩個方向的成本可以不同');
  await beat(tok, 3000);
  M.unglow(); tint(T.e(1, 2), SAND);
  const tk = cube('', ORANGE, [0.32, 0.32, 0.32], TP[1][0], TP[1][1] + 0.55, 0.4);
  const tour = [1, 2, 3, 4, 1]; let sum = 0;
  for (let k = 1; k < tour.length; k++) {
    const a = tour[k - 1], b = tour[k]; sum += cm(a, b);
    tint(T.e(a, b), ORANGE); glow(M.get(a - 1, b - 1), GOLD); move(tk, TP[b][0], TP[b][1] + 0.55, 0.4);
    say('走 ' + a + ' → ' + b + '：+' + cm(a, b), '目前 ' + sum);
    await beat(tok, 1500);
  }
  say('每個點走一次、回到起點：一個 cycle', '例：1→2→3→4→1 = 39');
  await beat(tok, 2800);
  say('目標：成本最小的 cycle', 'DP：試遍所有可能，再挑最好的');
  await beat(tok, 3000);
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
FRAG.push(['dpbari3-tsp-tree', 'TSP：從 1 出發的所有路線', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree();
  bfDraw(N.root, true);
  say('起點選 1', '');
  await beat(tok, 1600);
  N.l1.forEach((n) => bfDraw(n, true));
  say('下一站：2、3 或 4', '');
  await beat(tok, 2200);
  N.l2.forEach((n) => bfDraw(n, true));
  say('選 2 之後剩 3、4；選 3 之後剩 2、4…', '每一層少一個可選的點');
  await beat(tok, 2600);
  N.l3.forEach((n) => bfDraw(n, true));
  say('最後只剩一個點', '');
  await beat(tok, 2000);
  N.l4.forEach((n) => bfDraw(n, true));
  say('最後都要回到 1', '');
  await beat(tok, 2000);
  for (const k of [0, 3]) {
    const path = [N.root, N.l2[k].par, N.l2[k], N.l3[k], N.l4[k]];
    path.forEach((n) => { if (n.e) tint(n.e, ORANGE); glow(n.m, GOLD); });
    say('一條路線：' + path.map((n) => n.v).join(' → '), '');
    await beat(tok, 1900);
    path.forEach((n) => { if (n.e) tint(n.e, SAND); glow(n.m, null); });
  }
  say('共 3! = 6 條路線', '每條成本都要知道：從下往上算');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-tsp-bottom', 'TSP：從樹的底層往上算成本', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree(); bfAll(N, false);
  say('從最下面開始：回到 1 的成本', '');
  await beat(tok, 2200);
  for (const [k, n] of N.l3.entries()) {
    tint(N.l4[k].e, ORANGE); bfVal(n, n.val);
    if (k < 3) { say('在頂點 ' + n.v + '：回到 1', 'c(' + n.v + ',1) = ' + n.val); await beat(tok, 1500); }
  }
  say('回到 1：4→1 = 8、3→1 = 6、2→1 = 5', '');
  await beat(tok, 2200);
  for (const n of N.l2) {
    tint(n.kid.e, ORANGE); glow(n.m, GOLD); bfVal(n, n.val);
    say('在 ' + n.v + '：先到 ' + n.kid.v + ' 再回 1', cm(n.v, n.kid.v) + ' + ' + n.kid.val + ' = ' + n.val);
    await beat(tok, 2000);
    glow(n.m, null);
  }
  say('20、15、18、13、15、18', '還剩一個點要走的成本都知道了');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-tsp-up', 'TSP：取最小值一路算回起點 → 35', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const N = bfTree(); bfAll(N, false);
  [...N.l3, ...N.l2].forEach((n) => bfVal(n, n.val));
  say('再往上一層：兩條取最小', '');
  await beat(tok, 2000);
  for (const n of N.l1) {
    glow(n.m, GOLD);
    n.kids.forEach((c, k) => { tint(c.e, n.cands[k] === n.val ? TEAL : GRAY); });
    say('在 ' + n.v + '：' + n.kids.map((c) => n.v + '→' + c.v).join(' 或 '), 'min(' + n.kids.map((c) => cm(n.v, c.v) + '+' + c.val).join(', ') + ') = ' + n.val);
    bfVal(n, n.val);
    await beat(tok, 2800);
    glow(n.m, null);
  }
  glow(N.root.m, GOLD);
  N.l1.forEach((c, k) => tint(c.e, N.root.cands[k] === N.root.val ? TEAL : GRAY));
  bfVal(N.root, N.root.val);
  say('起點 1：35、40、43 取最小', 'min(10+25, 15+25, 20+23) = 35');
  await beat(tok, 3200);
  say('最短旅行路線成本 35', '這是暴力法；接著寫成 DP 公式');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-tsp-formula', 'TSP：g(i, S) 遞迴公式', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const root = cube('g(1,{2,3,4})', PURPLE, [2.4, 0.6, 0.5], 0, 6.8, 0, 1.4);
  say('g(1, {2,3,4})：從 1 出發', '還要走過 2、3、4 再回 1');
  await beat(tok, 2800);
  const ks = [2, 3, 4], xs = [-4.4, 0, 4.4], ch = [];
  for (let a = 0; a < 3; a++) {
    const k = ks[a], rest = ks.filter((v) => v !== k);
    rod(V3(0, 6.5, -0.05), V3(xs[a], 4.75, -0.05), ORANGE, 0.03);
    ch.push(cube('c(1,' + k + ') + g(' + k + ',{' + rest.join(',') + '})', BLUE, [2.9, 0.6, 0.5], xs[a], 4.4, 0, 1.2));
    say('先走到 k = ' + k + '：c(1,' + k + ') + g(' + k + ', 剩下)', '剩下的集合要拿掉 ' + k);
    await beat(tok, 2200);
  }
  say('三種 k 取最小', 'g(1,{2,3,4}) = min_k { c(1,k) + g(k, {2,3,4} − {k}) }');
  await beat(tok, 3200);
  ch.forEach((m) => tint(m, TEAL));
  const gen = mono(tag('g(i, S) = min_{k∈S} { c(i,k) + g(k, S − {k}) }', 'ptr alt', 0, 2.6));
  say('一般式：遞迴定義', 'g(i, S) = min_{k∈S} { c(i,k) + g(k, S−{k}) }');
  await beat(tok, 3400);
  const base = mono(tag('g(k, ∅) = c(k, 1)：沒點可走就回起點', 'ptr', 0, 1.6));
  say('集合空了：直接回到 1', 'g(k, ∅) = c(k, 1)');
  await beat(tok, 3000);
  kill(gen); kill(base); glow(root, null);
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
  say('DP：從最小的集合開始填', '|S| = 0 → 1 → 2 → 3');
  await beat(tok, 2600);
  for (let c = 0; c < 4; c++) {
    for (const [i, S] of GT[c]) {
      const e = cells[i + gF(S)], info = gEntry(i, S);
      const deps = info.deps.map((o) => cells[o.k + gF(o.rest)]).filter(Boolean);
      deps.forEach((d) => glow(d.m, GOLD));
      e.m = cube('g(' + i + ',' + gF(S) + ')', c === 3 ? PURPLE : BLUE, [2.2, 0.55, 0.45], e.x, e.y, 0, 1.2);
      say('在 ' + i + '，還要走 ' + gF(S), info.formula);
      await beat(tok, c === 1 ? 1500 : 2300);
      relabel(e.m, 'g(' + i + ',' + gF(S) + ')=' + gval(i, S)); tint(e.m, c === 3 ? PURPLE : TEAL);
      deps.forEach((d) => glow(d.m, null));
      await beat(tok, 500);
    }
  }
  glow(cells['1{2,3,4}'].m, GREEN);
  say('g(1,{2,3,4}) = 35', 'min(10+25, 15+25, 20+23)');
  await beat(tok, 3200);
}]);
FRAG.push(['dpbari3-tsp-path', 'TSP：記下誰給出最小值 → 1→2→4→3→1', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const cells = gTable(true);
  say('35 是從哪裡來的？', '記住每個最小值的來源');
  await beat(tok, 2800);
  let i = 1, S = [2, 3, 4]; const path = [1]; const out = mono(tag('1', 'ptr alt', 0, 1.2));
  while (S.length) {
    const e = cells[i + gF(S)];
    const k = S.find((v) => cm(i, v) + gval(v, S.filter((u) => u !== v)) === gval(i, S));
    const rest = S.filter((u) => u !== k), nx = cells[k + gF(rest)];
    glow(e.m, GOLD); if (nx) glow(nx.m, GREEN);
    say('g(' + i + ',' + gF(S) + ') 由 k = ' + k + ' 得到', cm(i, k) + ' + ' + gval(k, rest) + ' = ' + gval(i, S) + '：下一站 ' + k);
    path.push(k); txt(out, path.join(' → '));
    await beat(tok, 3000);
    glow(e.m, null); if (nx) glow(nx.m, null);
    i = k; S = rest;
  }
  path.push(1); txt(out, path.join(' → '));
  say('路線 1 → 2 → 4 → 3 → 1', '10 + 10 + 9 + 6 = 35');
  await beat(tok, 3800);
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
    if (n.base) { n.sym = 'c' + n.k + '1'; n.num = String(cm(n.k, 1)); return; }
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
async function gGrow(tok, upto, caps) {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const all = gTree();
  all.filter((n) => n.lvl < upto[0]).forEach((n) => gDraw(n, n.lvl ? n.num : n.sym, false));
  if (caps.pre) { say(caps.pre[0], caps.pre[1]); await beat(tok, 2600); }
  for (const lv of upto) {
    const ns = all.filter((n) => n.lvl === lv);
    ns.forEach((n) => gDraw(n, n.sym, true));
    say(caps[lv][0], caps[lv][1]);
    await beat(tok, 3400);
    if (lv > 0) {
      ns.forEach((n) => { relabel(n.m, n.num); glow(n.m, GOLD); });
      say(caps[lv][2], caps[lv][3]);
      await beat(tok, 3200);
      ns.forEach((n) => glow(n.m, null));
    }
  }
  return all;
}
FRAG.push(['dpbari3-tsp-rtree1', 'TSP 遞迴樹：第一層 c(1,k) + g(k, …)', async (tok) => {
  await gGrow(tok, [0, 1], {
    0: ['公式是遞迴的：畫遞迴樹', '根：g(1, {2,3,4})'],
    1: ['k = 2、3、4 代進公式：三個分支', 'c1k + g(k, {2,3,4} − {k})', '查表填上 c(1,k)', 'c12 = 10、c13 = 15、c14 = 20'],
  });
  say('三個分支要取最小', 'min(10 + g(2,{3,4}), 15 + g(3,{2,4}), 20 + g(4,{2,3}))');
  await beat(tok, 3000);
  say('還不知道 g 的值：無法取 min', '要先展開下面');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-tsp-rtree2', 'TSP 遞迴樹：第二層六個 g', async (tok) => {
  const all = await gGrow(tok, [2], {
    pre: ['上一層：10、15、20 加上三個 g', '同一個公式展開這三個 g'],
    2: ['同一個公式再展開：起點換成 2、3、4', '每個分支剩兩個點可選', '填上邊的成本', '9、10、13、12、8、9'],
  });
  for (const n of all.filter((x) => x.lvl === 1)) {
    const ks = all.filter((x) => x.par === n);
    glow(n.m, GOLD); ks.forEach((c) => glow(c.m, GOLD));
    say(n.num.split('+')[1] + '：下一站 ' + ks.map((c) => c.k).join(' 或 '), ks.map((c) => c.num).join('，'));
    await beat(tok, 1800);
    glow(n.m, null); ks.forEach((c) => glow(c.m, null));
  }
  say('6 個 g 還是未知', '繼續往下展開');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-tsp-rtree3', 'TSP 遞迴樹：展開到 g(k, ∅) = c(k, 1)', async (tok) => {
  const all = await gGrow(tok, [3, 4], {
    3: ['只剩一個點：走過去', '例：c34 + g(4, ∅)', '填上邊的成本', '12、9、10、8、9、13'],
    4: ['g(k, ∅)：沒點可走，回到 1', 'g(k, ∅) = c(k, 1)', '回 1 的成本', '4→1 = 8、3→1 = 6、2→1 = 5'],
  });
  say('整棵遞迴樹長這麼大', '真的這樣算太慢：改用表格');
  await beat(tok, 3200);
  return all;
}]);
async function gSub(tok, phase) {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const all = gTree();
  const keepTo = phase === 1 ? 4 : 2;
  all.filter((n) => n.lvl <= keepTo).forEach((n) => gDraw(n, n.lvl === 0 ? n.sym : phase === 2 && n.lvl === 2 ? n.sub : n.num, false));
  if (phase === 1) {
    say('DP 的 programming = 表格', '不是寫程式；先算最小的值');
    await beat(tok, 3000);
    all.filter((n) => n.base).forEach((n) => glow(n.m, GREEN));
    say('|S| = 0：g(2,∅)=5、g(3,∅)=6、g(4,∅)=8', '最底層先有值');
    await beat(tok, 2800);
    for (const n of all.filter((x) => x.lvl === 2)) {
      glow(n.m, GOLD);
      const n3 = all.find((x) => x.par === n), n4 = all.find((x) => x.par === n3);
      say('在 ' + n.k + '、還剩 ' + gF(n.rest) + '：' + n3.c + ' + ' + cm(n3.k, 1), 'g(' + n.k + ',' + gF(n.rest) + ') = ' + n.g);
      await beat(tok, 1800);
      relabel(n.m, n.sub); tint(n.m, TEAL); glow(n.m, null);
      fly(n3.m); kill(n3.e); fly(n4.m); kill(n4.e);
      await beat(tok, 400);
    }
    say('剩一個點的 g 全部算好', '換成數字：20、15、18、13、15、18');
    await beat(tok, 3000);
  } else {
    say('再上一層：剩兩個點', '每個 g 是兩項取 min');
    await beat(tok, 2400);
    for (const n of all.filter((x) => x.lvl === 1)) {
      const kids = all.filter((x) => x.par === n);
      kids.forEach((c) => glow(c.m, c.c + c.g === n.g ? GREEN : GOLD));
      say('g(' + n.k + ',' + gF(n.rest) + ') = min(' + kids.map((c) => c.c + c.g).join(', ') + ')', '= ' + n.g);
      await beat(tok, 2600);
      relabel(n.m, n.sub); tint(n.m, TEAL);
      kids.forEach((c) => { fly(c.m); kill(c.e); });
      await beat(tok, 500);
    }
    const r = all[0];
    say('最後：g(1,{2,3,4})', 'min(10+25, 15+25, 20+23) = min(35, 40, 43)');
    await beat(tok, 2800);
    relabel(r.m, 'g(1,{2,3,4}) = 35'); glow(r.m, GREEN);
    say('TSP 最短路線成本 = 35', '由下往上填：與遞迴樹同一個答案');
    await beat(tok, 3200);
  }
}
FRAG.push(['dpbari3-tsp-sub1', 'TSP：由下往上代值（|S| = 0、1）', async (tok) => { await gSub(tok, 1); }]);
FRAG.push(['dpbari3-tsp-sub2', 'TSP：|S| = 2 取 min，得 35', async (tok) => { await gSub(tok, 2); }]);

// ════════════════ sSno9rV8Rhg：LCS ════════════════
function letters(s, x0, dx, y, color, drop = 1.2) { return s.split('').map((ch, k) => cube(ch, color, [0.66, 0.58, 0.5], x0 + k * dx, y, 0, drop)); }
function tie(a, b, color = TEAL) { return rod(V3(a.position.x, a.position.y - 0.32, 0), V3(b.position.x, b.position.y + 0.32, 0), color, 0.04); }
async function match(tok, A, B, pairs, color, ms) {
  const ls = [];
  for (const [b, a] of pairs) { glow(A[a], GOLD); glow(B[b], GOLD); ls.push(tie(A[a], B[b], color)); await beat(tok, ms); }
  return ls;
}
FRAG.push(['dpbari3-lcs-intro', 'LCS：cdgi 依序出現在另一個字串', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const A = letters('abcdefghij', -5.4, 1.2, 6.4, BLUE), B = letters('cdgi', -3.6, 1.2, 3.0, ORANGE);
  tag('字串 1', 'ptr', -6.6, 7.3); tag('字串 2', 'ptr', -5.0, 3.9);
  say('兩個不同的字串，不是找 substring', '不是 KMP 那種完全比對');
  await beat(tok, 2800);
  say('c、d、g、i 都在字串 1 出現', '');
  const ls = await match(tok, A, B, [[0, 2], [1, 3], [2, 6], [3, 8]], TEAL, 1100);
  say('字元不相鄰，但順序一樣', '這叫 subsequence');
  await beat(tok, 2800);
  say('dgi、gi 也是共同子序列', '最長的是 cdgi：長度 4');
  await beat(tok, 3000);
  say('LCS：最長的共同子序列', 'Longest Common Subsequence');
  await beat(tok, 2600);
  ls.forEach(kill);
}]);
FRAG.push(['dpbari3-lcs-cross', 'LCS：連線不能交叉（egi vs cdgi）', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const A = letters('abcdefghij', -5.4, 1.2, 6.4, BLUE), B = letters('ecdgi', -4.8, 1.2, 3.0, ORANGE);
  say('在字串 2 前面加一個 e', 'B = ecdgi');
  await beat(tok, 2400);
  let ls = await match(tok, A, B, [[0, 4]], TEAL, 1000);
  for (const [b, a] of [[1, 2], [2, 3]]) {
    const l = tie(A[a], B[b], RED);
    say(B[b].userData.lbl.element.textContent + ' 在 e 前面：連線會交叉', '不行，跳過');
    await beat(tok, 1800);
    kill(l);
  }
  ls = ls.concat(await match(tok, A, B, [[3, 6], [4, 8]], TEAL, 1000));
  say('得到 e g i', '一個共同子序列');
  await beat(tok, 2200);
  ls.forEach(kill); [...A, ...B].forEach((m) => glow(m, null));
  say('改從 c 開始', '');
  ls = await match(tok, A, B, [[1, 2], [2, 3], [3, 6], [4, 8]], PINK, 900);
  say('c d g i 比 e g i 長', 'LCS = cdgi');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-lcs-two', 'LCS：長度相同的答案可以不只一個', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.6, 0]);
  const A = letters('abdace', -3.0, 1.2, 6.4, BLUE), B = letters('babce', -2.4, 1.2, 3.0, ORANGE);
  say('另一個例子', 'abdace 與 babce');
  await beat(tok, 2400);
  let ls = await match(tok, A, B, [[0, 1], [1, 3], [3, 4], [4, 5]], TEAL, 1100);
  say('b a c e：長度 4', '');
  await beat(tok, 2400);
  ls.forEach(kill); [...A, ...B].forEach((m) => glow(m, null));
  ls = await match(tok, A, B, [[1, 0], [2, 1], [3, 4], [4, 5]], PINK, 1100);
  say('a b c e：也是長度 4', '');
  await beat(tok, 2400);
  say('可能有多個一樣長的 LCS', '字元不必連續，順序要一樣');
  await beat(tok, 3000);
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
FRAG.push(['dpbari3-lcs-reccode', 'LCS 遞迴演算法：前幾次呼叫', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const S = recStrings(-5.0, 7.4);
  const cd = code(RCODE, -3.6, 5.6, 0.48);
  say('字串以 \\0 結尾，index 從 0 開始', 'A = "bd"、B = "abcd"');
  await beat(tok, 2800);
  cd.hl(1); say('任一個到 \\0：回傳 0', ''); await beat(tok, 2000);
  cd.hl(3); say('相同：1 + 兩邊都往後一格', ''); await beat(tok, 2000);
  cd.hl(6); say('不同：A 跳一格或 B 跳一格，取大', '大部分時候走這一條'); await beat(tok, 2600);
  const N = recTree(7.2, 1.25, 1.2, 1.15);
  const show = ['00', '10', '01', '20', '11'];
  const caps = {
    '00': ['LCS(0,0)：A[0] = b、B[0] = a', '不同 → 兩個呼叫'],
    '10': ['LCS(1,0)：A 往後一格', 'd vs a'],
    '01': ['LCS(0,1)：B 往後一格', 'b vs b'],
    '20': ['LCS(2,0)：A[2] = \\0', '回傳 0'],
    '11': ['LCS(1,1)：d vs b', '又不同 → 再呼叫兩次'],
  };
  for (const id of show) {
    const n = N[id]; recNode(n, true);
    glow(S.a[n.i], GOLD); glow(S.b[n.j], GOLD);
    cd.hl(n.kind === 0 ? 1 : n.kind === 1 ? 3 : 6);
    say(caps[id][0], caps[id][1]);
    await beat(tok, 2400);
    glow(S.a[n.i], null); glow(S.b[n.j], null);
    if (id === '20') { txt(n.t, '0'); showL(n.t, true); }
  }
  say('先把左邊的呼叫做完，再做右邊', 'max(LCS(1,0), LCS(0,1))');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-lcs-rectree', 'LCS 遞迴樹：答案 2，與重疊的子問題', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  tag('A = "bd"   B = "abcd"', 'ptr', -5.0, 7.6);
  const N = recTree(7.0, 1.08, -4.6, 1.84);
  async function visit(n) {
    recNode(n, true);
    say('LCS(' + n.i + ',' + n.j + ')：' + n.lbl.replace(',', ' vs '), n.kind === 0 ? '遇到 \\0 → 0' : n.kind === 1 ? '相同 → 1 + LCS(' + (n.i + 1) + ',' + (n.j + 1) + ')' : '不同 → 兩個呼叫取 max');
    await beat(tok, 900);
    for (const k of n.kids) await visit(k);
    txt(n.t, '=' + n.v); showL(n.t, true); glow(n.m, n.kind === 1 ? GREEN : null);
    if (n.kids.length) { say('LCS(' + n.i + ',' + n.j + ') 回傳 ' + n.v, n.kind === 1 ? '1 + ' + n.kids[0].v : 'max(' + n.kids.map((k) => k.v).join(', ') + ')'); await beat(tok, 700); }
  }
  await visit(N['00']);
  say('LCS("bd", "abcd") = 2', '從 (0,0) 開始往下：top-down');
  await beat(tok, 2600);
  const sub = (n) => [n].concat(...n.kids.map(sub));
  [...sub(N['12']), ...sub(N['12b'])].forEach((n) => glow(n.m, GOLD));
  say('LCS(1,2)「d vs c」整棵算了兩次', '重疊子問題 → 存起來就不用再算');
  await beat(tok, 3200);
  say('才幾個字元，樹就這麼大', '純遞迴是指數時間');
  await beat(tok, 2600);
}]);
FRAG.push(['dpbari3-lcs-memo', 'LCS memoization：用表存遞迴結果', async (tok) => {
  fresh([0, 4.4, 14], [0, 4.4, 0]);
  const g = grid({ rows: 3, cols: 5, cw: 1.1, ch: 0.85, x0: -2.2, y0: 6.2, colHdr: ['a', 'b', 'c', 'd', '\\0'], rowHdr: ['b', 'd', '\\0'], colCls: 'ptr', rowCls: 'ptr', rowDx: 0.2 });
  [0, 1, 2, 3, 4].forEach((j) => tag('j=' + j, 'idx', -2.2 + j * 1.1, 7.35));
  [0, 1, 2].forEach((i) => tag('i=' + i, 'idx', -4.4, 6.2 - i * 0.85));
  say('列 = A 的 index，行 = B 的 index', '表存 LCS(i, j) 的結果');
  await beat(tok, 2800);
  const order = [[2, 0, 0], [2, 1, 0], [2, 2, 0], [2, 4, 0], [1, 3, 1], [1, 2, 1], [1, 1, 1], [1, 0, 1]];
  for (const [i, j, v] of order) {
    g.set(i, j, v, i === 2 ? GRAY : BLUE);
    say('LCS(' + i + ',' + j + ') 算完，存進表', 'L[' + i + '][' + j + '] = ' + v);
    await beat(tok, 1300);
  }
  say('呼叫是 top-down，表卻由下往上填', '');
  await beat(tok, 2400);
  glow(g.get(1, 2), GREEN); g.arrow(1, 2, 0, 1, OKC);
  say('LCS(0,1)：b = b → 1 + LCS(1,2)', 'L[1][2] = 1 已經在表裡：不再呼叫');
  await beat(tok, 3000);
  g.set(0, 1, 2, TEAL);
  await beat(tok, 900);
  g.clearArrows(); glow(g.get(1, 2), null);
  g.arrow(1, 0, 0, 0, TRY); g.arrow(0, 1, 0, 0, OKC);
  say('LCS(0,0) = max(1, 2) = 2', '');
  g.set(0, 0, 2, TEAL);
  await beat(tok, 2400);
  g.clearArrows();
  say('呼叫次數不超過表格大小', 'memoization：O(2ⁿ) → O(m × n)');
  await beat(tok, 3200);
}]);
async function lcsDP(tok, X, Y, intro, slowRows) {
  const g = lcsGrid(X, Y), L = lcsSteps(X, Y);
  say(intro[0], intro[1]);
  await beat(tok, 2800);
  say('相同：左上 + 1', '不同：max(上, 左)');
  await beat(tok, 2600);
  for (const s of L.steps) {
    const slow = slowRows.includes(s.r) || s.color === TEAL;
    await playStep(g, s, tok, slow ? 1500 : 420, !slow);
  }
  g.clearArrows(); g.unglow();
  return { g, L };
}
FRAG.push(['dpbari3-lcs-dp-bd', 'LCS 的 DP 表：bd vs abcd → BD', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  const { g, L } = await lcsDP(tok, 'BD', 'ABCD', ['DP：同一題改成 bottom-up 填表', 'index 從 1，第 0 列、0 行放 0'], [1, 2]);
  say('長度 2；往回看箭頭', '↖ 的格子就是共同字元');
  await beat(tok, 2400);
  const s = await lcsTrace(tok, g, 'BD', 'ABCD', L, 1600);
  say('LCS = ' + s, '表由上往下填，方法仍是 bottom-up');
  await beat(tok, 2800);
  say('格子數 m × n', 'DP 時間 O(m × n)');
  await beat(tok, 2800);
}]);
FRAG.push(['dpbari3-lcs-stone', 'LCS 填表：stone vs longest', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  await lcsDP(tok, 'STONE', 'LONGEST', ['列 = stone，行 = longest', '照兩條規則逐列填'], [1]);
  say('c[5][7] = 3：LCS 長度 3', '');
  await beat(tok, 3000);
}]);
FRAG.push(['dpbari3-lcs-stone-trace', 'LCS 回溯：得到 ONE', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.4, 0]);
  const X = 'STONE', Y = 'LONGEST';
  const g = lcsGrid(X, Y), L = lcsSteps(X, Y);
  for (const s of L.steps) g.set(s.r, s.c, s.v, s.color, 0);
  say('從右下角的 3 往回走', '從旁邊抄來的就往那邊走；變大的走斜的');
  await beat(tok, 2800);
  const s = await lcsTrace(tok, g, X, Y, L, 1300);
  say('LCS = ' + s + '：長度 3', 'O(m × n)：m、n 是兩字串長度');
  await beat(tok, 3400);
}]);
  }

  // ═══ dpjiang1.js ═══
  {
// ─── 交大江蕙如：359YMyqbEG4（Lec17 DP 1/3）、S5vS9YEvnFU（Lec19 DP 3/3） ───
// 只用 K 與 ctx（say / beat）。老師的例子：
//   Weighted interval scheduling（KT Fig 6.2 那組）：v = 2 4 4 7 2 1、p = 0 0 1 0 3 3；O6 = {6}∪O3 或 O5；
//   OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))；遞迴樹 6→5,3、5→4,3…；memo 後只算 6 次；M[0..6] = 0 2 4 6 7 8 8。
//   greedy（最早結束）反例 1 3 1；Fibonacci F0 = 0、F1 = 1，F5 → F4、F3；F[] 先填 −1；maze routing（wave propagation，O(mn)）。
//   Lec19：Bellman-Ford 表（KT Fig 6.23）b 欄 5 = min(−2, −1+2, −2+0) = −2；O(nm)；只要前一欄；negative cycle；
//   套利 $1 → 1.3941 法郎 → 0.9308 歐元 → $1.00084（金 1 → $327.25）；−log 轉換；多跑一輪偵測；鴿籠證明；
//   加一個新點 t（全部 0 邊）；TSP：OPT(S,u,v)、2ⁿn² / 2ⁿn³ vs n!；DP = 聰明的 recursion。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, GRAY } = K;
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', gold: '#c08a1f', brown: '#6e5f49', cyan: '#31aab0', gray: '#bdb3a2' };
const LV = [C.purple, C.blue, C.cyan, C.orange, C.pink, C.gold];
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
const fade = (m, on) => { m.material.transparent = !on; m.material.opacity = on ? 1 : 0.25; };
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

// ════════════════ 359YMyqbEG4（Lec17 Dynamic Programming 1/3） ════════════════

// 03:35 Divide & Conquer 回顧：divide → conquer → combine
FRAG.push(['dpjiang1-dc-review', 'Divide & Conquer 回顧：拆、遞迴解、合併', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const top = box('n', C.purple, 0, 7.2, 4.6, 0.6, 0.5, 1.2);
  say('D&C：問題太複雜，先拆開', 'divide：拆成同性質的小問題');
  await beat(tok, 2400);
  const lv1 = [-2.6, 2.6].map((x) => box('n/2', C.blue, x, 5.6, 2.2, 0.55, 0.5, 1.0));
  const e1 = lv1.map((m) => line(0, 6.9, m.position.x, 5.9, 0, C.sand));
  await beat(tok, 1600);
  const lv2 = [-3.9, -1.3, 1.3, 3.9].map((x) => box('n/4', C.cyan, x, 4.0, 1.1, 0.5, 0.5, 1.0));
  const e2 = lv2.map((m, k) => line(lv1[k >> 1].position.x, 5.35, m.position.x, 4.25, 0, C.sand));
  say('拆出來的小問題要同性質', '只有 problem size 變小');
  await beat(tok, 2400);
  lv2.forEach((m) => { tint(m, C.teal); glow(m, GREEN); });
  say('小到 simple enough 就直接解', 'conquer：recursively solve');
  await beat(tok, 2400);
  lv2.forEach((m) => glow(m, null));
  say('最難的是 combine', '把小答案兜回大答案');
  for (let k = 0; k < 2; k++) {
    move(lv2[2 * k], lv1[k].position.x - 0.3, 5.6, 0); move(lv2[2 * k + 1], lv1[k].position.x + 0.3, 5.6, 0);
    await beat(tok, 900);
    kill(lv2[2 * k]); kill(lv2[2 * k + 1]); kill(e2[2 * k]); kill(e2[2 * k + 1]);
    tint(lv1[k], C.teal); glow(lv1[k], GOLD);
    await beat(tok, 700);
    glow(lv1[k], null);
  }
  lv1.forEach((m) => move(m, 0, 7.2, 0));
  await beat(tok, 900);
  lv1.forEach(kill); e1.forEach(kill);
  tint(top, C.teal); glow(top, GOLD);
  say('例：merge sort 的 merge 是 O(n)', 'combine 決定 time complexity');
  await beat(tok, 2600);
  glow(top, null);
  tag('recurrence：T(n) = 2T(n/2) + O(n)', 'ptr alt', 0, 2.2);
  say('用 recurrence 分析遞迴程式', '展開法／recursion tree／猜+數學歸納');
  await beat(tok, 3200);
}]);

// 06:52 Programming = 數學最佳化；DP 隱式試遍所有子問題、順序是關鍵
FRAG.push(['dpjiang1-dp-idea', 'DP：Programming 是最佳化；隱式試遍、照順序算', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const words = ['Linear', 'Quadratic', 'Convex', 'Non-linear'].map((w, k) => tag(w + ' Programming', 'idx', -4.2, 7.4 - k * 0.5));
  say('Programming ≠ 寫程式', 'mathematical programming = 最佳化');
  await beat(tok, 2600);
  const obj = tag('objective：min cost / max value', 'ptr', 2.6, 7.0);
  say('最佳化問題：解要有 quality', 'minimization 或 maximization');
  await beat(tok, 2600);
  tag('Richard Bellman, 1953', 'ptr alt', 2.6, 6.2);
  say('Bellman 1953 年發表', '名字刻意避開太數學的字眼');
  await beat(tok, 2600);
  words.forEach(kill); kill(obj);
  // left: D&C fully expanded tree with duplicates
  tag('Divide & Conquer：完全展開', 'ptr', -3.6, 5.4);
  const L = layout({ k: 4, kids: [{ k: 3, kids: [{ k: 2, kids: [] }, { k: 1, kids: [] }] }, { k: 2, kids: [{ k: 1, kids: [] }, { k: 0, kids: [] }] }] }, 1.0, 4.6, 1.15, -3.6);
  L.forEach((t) => { if (t.par) line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand); t.m = box('P' + t.k, LV[t.d], t.x, t.y, 0.8, 0.45, 0.4, 1.0); });
  await beat(tok, 1200);
  L.forEach((t) => { if (t.k === 2 || t.k === 1) glow(t.m, GOLD); });
  say('D&C 把每個子問題攤開來算', '重複的也重算');
  await beat(tok, 2400);
  L.forEach((t) => glow(t.m, null));
  // right: DP in an order
  tag('DP：implicitly 試遍，照順序', 'ptr', 3.4, 5.4);
  const cells = [0, 1, 2, 3, 4].map((k) => box('P' + k, C.gray, 1.4 + k * 1.0, 3.6, 0.85, 0.5, 0.45));
  for (let k = 0; k < 5; k++) {
    tint(cells[k], C.teal); glow(cells[k], GREEN);
    if (k) link([1.4 + (k - 1) * 1.0, 3.6], [1.4 + k * 1.0, 3.6], C.teal, 0.43);
    say('由小到大：P' + k, k ? '用前面算好的答案兜出來' : '最小的子問題先算');
    await beat(tok, 900);
    glow(cells[k], null);
  }
  say('計算子問題的順序是 key idea', '順序對了 DP 才會正常運作');
  await beat(tok, 3000);
}]);

// 13:19 Weighted interval scheduling：個數最多 ≠ value 最大；greedy 反例 1 3 1
FRAG.push(['dpjiang1-wis-greedy', 'Weighted interval scheduling：greedy 失效（1 3 1）', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.8, 0]);
  say('每個 request 做完有 value', '選一組不重疊的，總 value 最大');
  const ex = tag('例：3 個 request（12、13、16）< 26 + 16 = 42', 'ptr', 0, 7.6);
  await beat(tok, 3000);
  say('個數最多 ≠ value 最大', 'unit weight → non-uniform weight');
  await beat(tok, 2400);
  kill(ex);
  const X = (t) => (t - 4) * 1.15;
  line(X(0) - 0.3, 2.0, X(8) + 0.3, 2.0, 0, C.brown); tag('time', 'idx', X(8) + 0.6, 2.0);
  const J = [{ s: 0, f: 3, v: 1, y: 5.6 }, { s: 2, f: 7, v: 3, y: 4.4 }, { s: 4, f: 8, v: 1, y: 3.2 }];
  const ms = J.map((j, k) => box('v=' + j.v, LV[k + 1], (X(j.s) + X(j.f)) / 2, j.y, X(j.f) - X(j.s) - 0.06, 0.5, 0.4, 1.2));
  say('之前的 greedy：照 finish time 排', '每次挑最早結束的');
  await beat(tok, 2400);
  glow(ms[0], GOLD); tint(ms[0], C.teal);
  say('先挑最早結束：v = 1', '和它重疊的刪掉');
  await beat(tok, 1800);
  fly(ms[1]);
  await beat(tok, 900);
  glow(ms[2], GOLD); tint(ms[2], C.teal);
  say('再挑下一個：v = 1', 'greedy 總和 = 1 + 1 = 2');
  await beat(tok, 2400);
  glow(ms[0], null); glow(ms[2], null);
  fly(ms[0]); fly(ms[2]);
  const best = box('v=3', C.orange, (X(2) + X(7)) / 2, 4.4, X(7) - X(2) - 0.06, 0.5, 0.4, 2);
  await beat(tok, 900);
  glow(best, GREEN);
  say('最佳解只選中間那個：3', '3 > 2：有 weight 時 greedy 不保證最佳');
  await beat(tok, 3000);
}]);

// 18:05 第一個企圖：induction on time（刻度 Δ 不好控制）
FRAG.push(['dpjiang1-wis-time', 'Induction on time：Δ 的刻度不好控制', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const ms = drawJobs(true);
  say('先照 finish time 排好', '1~6 號 request');
  await beat(tok, 2400);
  const cur = box('', C.red, TX(11), 4.4, 0.08, 5.6, 0.08);
  const tl = tag('t', 'ptr alt', TX(11), 7.6);
  say('想法一：在時間軸上做 induction', 'OPT(t) = OPT(t′) + Δ 那一小段');
  await beat(tok, 2600);
  const cur2 = box('', C.blue, TX(10.4), 4.4, 0.08, 5.6, 0.08);
  const tl2 = tag("t′", 'ptr', TX(10.4), 7.6);
  say('Δ 要切多大？', '固定刻度很難寫成 recursion');
  await anim(tok, 1800, (e) => { cur2.position.x = TX(10.4 - 3 * e); tl2.position.x = cur2.position.x; });
  await beat(tok, 1200);
  glow(ms[6], GOLD);
  say('其實 t 卡在最後一筆 request 結束', '只要問：第 6 筆要不要算？');
  await beat(tok, 2600);
  cur2.position.x = TX(7.5); tl2.position.x = TX(7.5); txt(tl2, 's₆');
  ms.forEach((m, j) => { if (j && j <= 3) tint(m, C.teal); });
  say('要算：前面只能到 s₆ 之前', '再加上 v₆');
  await beat(tok, 2800);
  ms.forEach((m, j) => { if (j && j <= 3) tint(m, LV[j - 1]); });
  glow(ms[6], null); fade(ms[6], false);
  cur2.position.x = TX(10); tl2.position.x = TX(10); txt(tl2, 'f₅');
  say('不算：就是前 5 筆的答案', '兩種情況的 Δ 都不固定');
  await beat(tok, 2800);
  kill(cur); kill(tl);
  say('改成：一次多考慮一個 request', 'induction on interval index');
  await beat(tok, 3000);
}]);

// 24:36 Induction on index；p(j)：往前第一個不重疊的
FRAG.push(['dpjiang1-wis-p', 'p(j)：往前最後一個不會 overlap 的 request', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const ms = drawJobs(true);
  say('依 finish time 由小排到大', 'f₁ ≤ f₂ ≤ … ≤ f₆');
  await beat(tok, 2400);
  say('一次多看一個：前 1 個、前 2 個…', 'induction 的對象是 index，不是時間');
  for (let j = 1; j <= 6; j++) { glow(ms[j], GOLD); await beat(tok, 380); glow(ms[j], null); }
  await beat(tok, 1200);
  const plab = [];
  const order = [6, 2, 1, 3, 4, 5];
  for (const j of order) {
    const J = WJ[j];
    const bar = box('', C.red, TX(J.s), 4.6, 0.06, 4.8, 0.06);
    glow(ms[j], GOLD);
    for (let i = 1; i < j; i++) fade(ms[i], i <= J.p);
    if (J.p) glow(ms[J.p], GREEN);
    say('p(' + j + ') = ' + J.p, J.p ? '自己先劃掉，往前 1~' + J.p + ' 都不重疊' : '往前沒有人跟它不重疊');
    await beat(tok, j === 6 || j === 2 ? 2600 : 1500);
    plab[j] = tag('p=' + J.p, 'idx', TX(J.f) + 0.55, JY(j));
    glow(ms[j], null); if (J.p) glow(ms[J.p], null);
    for (let i = 1; i <= 6; i++) fade(ms[i], true);
    kill(bar);
  }
  say('p = 0 0 1 0 3 3', 'p 只是讓式子比較好寫');
  await beat(tok, 3000);
}]);

// 28:42 OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))；O6 = {6} ∪ O3 或 O5
FRAG.push(['dpjiang1-wis-recur', 'OPT(j) = max(vⱼ + OPT(p(j)), OPT(j−1))', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const ms = drawJobs(true, 0.6);
  say('Oⱼ：前 j 個的最佳解由誰組成', 'OPT(j)：它的最大 value');
  await beat(tok, 2600);
  glow(ms[6], GOLD);
  say('看 O6：只有兩種 case', '第 6 筆要算，或不要算');
  await beat(tok, 2400);
  // case 1
  for (let i = 1; i <= 5; i++) fade(ms[i], i <= 3);
  [1, 2, 3].forEach((i) => tint(ms[i], C.teal));
  const c1 = tag('case 1：{6} ∪ O3 → v₆ + OPT(3)', 'ptr alt', -1.2, 1.2);
  say('要算 6：前面接 O3（p(6) = 3）', 'v₆ + OPT(p(6))');
  await beat(tok, 3000);
  [1, 2, 3].forEach((i) => tint(ms[i], LV[i - 1]));
  for (let i = 1; i <= 6; i++) fade(ms[i], i <= 5);
  [1, 2, 3, 4, 5].forEach((i) => tint(ms[i], C.blue));
  glow(ms[6], null);
  const c2 = tag('case 2：O5 → OPT(5)', 'ptr', -1.2, 0.5);
  say('不算 6：直接用 O5', 'OPT(j − 1)');
  await beat(tok, 3000);
  [1, 2, 3, 4, 5].forEach((i) => tint(ms[i], LV[i - 1]));
  for (let i = 1; i <= 6; i++) fade(ms[i], true);
  kill(c1); kill(c2);
  tag('OPT(j) = max( vⱼ + OPT(p(j)) , OPT(j − 1) )', 'ptr alt', 0, 1.0);
  tag('OPT(0) = 0', 'idx', 0, 0.4);
  say('兩者取其大', '取 max：value 越大越好');
  await beat(tok, 2800);
  say('recursion 寫出來就做完大半', '決定 induction 對象最難');
  await beat(tok, 3000);
}]);

// 33:36 直接翻成 recursive code → 遞迴樹很多重複
FRAG.push(['dpjiang1-wis-tree', 'Compute-Opt 的遞迴樹：重複的子問題', async (tok) => {
  fresh([0, 4.0, 15], [0.6, 4.2, 0]);
  const cd = code(['Compute-Opt(j):', '  if j = 0: return 0', '  return max(Compute-Opt(j-1),', '             v[j] + Compute-Opt(p[j]))'], -4.6, 8.6, 0.45);
  say('先排序、先算好 p(j)', '把 recursion 直接翻成 recursive code');
  await beat(tok, 2600);
  const T = optTree(6);
  const all = layout(T, 1.35, 6.6, 1.0, 1.4);
  cd.hl(2);
  say('O6 往下呼叫 O5 和 O3', 'O5 再呼叫 O4 和 O3 …');
  const order = []; (function w(t) { order.push(t); t.kids.forEach(w); })(T);
  for (const t of order) {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand);
    t.m = box('O' + t.j, LV[(6 - t.j) % 6], t.x, t.y, 0.75, 0.45, 0.4, 1.0);
    await beat(tok, 300);
  }
  cd.hl(-1);
  tag('（省略 Compute-Opt(0)）', 'idx', 4.6, 0.9);
  say('整棵樹：' + all.length + ' 個呼叫', '這還沒算 Compute-Opt(0)');
  await beat(tok, 2400);
  for (const j of [3, 2, 1]) {
    all.forEach((t) => glow(t.m, t.j === j ? GOLD : null));
    say('O' + j + ' 被算了 ' + all.filter((t) => t.j === j).length + ' 次', '重複的地方都多算了');
    await beat(tok, 2000);
  }
  all.forEach((t) => glow(t.m, null));
  say('同一個子問題只要算一次', '算好就記起來 → memoization');
  await beat(tok, 3000);
}]);

// 37:24 Memoization：M[j] 先查；樹變成細長一條，只算 6 次
FRAG.push(['dpjiang1-wis-memo', 'M-Compute-Opt：先查 M[j]，只算 6 次', async (tok) => {
  fresh([0, 4.0, 15], [0.6, 4.0, 0]);
  const cd = code(['M-Compute-Opt(j):', '  if j = 0: return 0', '  if M[j] 有值: return M[j]', '  M[j] = max(M-Compute-Opt(j-1),', '             v[j] + M-Compute-Opt(p[j]))', '  return M[j]'], -4.7, 8.7, 0.42);
  const T = optTree(6);
  const all = layout(T, 1.35, 6.4, 0.95, 1.6);
  all.forEach((t) => {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, '#d8cfc0');
    t.m = box('O' + t.j, GRAY, t.x, t.y, 0.75, 0.42, 0.38); fade(t.m, false);
  });
  const MX = (k) => -3.6 + k * 1.15;
  tag('M', 'ptr', MX(0) - 1.0, 0.75);
  const cells = WM.map((v, k) => { tag(String(k), 'idx', MX(k), 0.15); return box(k ? ' ' : '0', k ? '#e6dccb' : C.teal, MX(k), 0.75, 1.0, 0.5, 0.45); });
  say('開一個小抄 M[0..6]', 'recursive call 前先偷看小抄');
  cd.hl(2);
  await beat(tok, 2600);
  const known = new Set([0]); let calls = 0;
  async function visit(t) {
    if (known.has(t.j)) {
      fade(t.m, true); tint(t.m, C.gold); glow(t.m, GOLD); glow(cells[t.j], GOLD); cd.hl(2);
      const gone = sub(t).slice(1);
      say('M[' + t.j + '] = ' + WM[t.j] + ' 已有：直接 return', gone.length ? '下面整棵不用展開' : '查表 O(1)');
      await beat(tok, 1100);
      gone.forEach((u) => { fly(u.m); if (u.e) kill(u.e); });
      await beat(tok, 600);
      glow(t.m, null); glow(cells[t.j], null);
      return;
    }
    calls++;
    fade(t.m, true); tint(t.m, LV[(6 - t.j) % 6]); glow(t.m, GOLD); cd.hl(3);
    say('O' + t.j + '：M[' + t.j + '] 沒值', '只好真的 recursive call');
    await beat(tok, 800); glow(t.m, null);
    for (const k of t.kids) await visit(k);
    known.add(t.j); relabel(cells[t.j], WM[t.j]); tint(cells[t.j], C.teal); glow(cells[t.j], GREEN);
    tint(t.m, C.teal); cd.hl(5);
    const J = WJ[t.j];
    say('存 M[' + t.j + '] = ' + WM[t.j], 'max(' + J.v + ' + M[' + J.p + '], M[' + (t.j - 1) + '])');
    await beat(tok, 900); glow(cells[t.j], null);
  }
  await visit(T);
  cd.hl(-1);
  say('真正只算了 ' + calls + ' 個 recursive call', '大樹變細長一條：linear time');
  await beat(tok, 3000);
  say('只存了 value；要組成就一起存 O', 'top-down = memoization');
  await beat(tok, 2600);
}]);

// 42:14 Bottom-up：M[0] = 0，for j = 1..n 由小填到大
FRAG.push(['dpjiang1-wis-iter', 'Bottom-up：M[0..6] 由小填到大', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const cd = code(['Iterative-Compute-Opt:', '  M[0] = 0', '  for j = 1 to n:', '    M[j] = max(v[j] + M[p[j]], M[j-1])'], -3.0, 8.2, 0.48);
  const MX = (k) => -4.2 + k * 1.4;
  tag('j', 'idx', MX(0) - 1.0, 2.55); tag('v', 'idx', MX(0) - 1.0, 5.35); tag('p', 'idx', MX(0) - 1.0, 4.85);
  const cells = WM.map((v, k) => { tag(String(k), 'idx', MX(k), 2.55); if (k) { tag(String(WJ[k].v), 'idx', MX(k), 5.35); tag(String(WJ[k].p), 'idx', MX(k), 4.85); } return box(' ', '#e6dccb', MX(k), 3.4, 1.2, 0.7, 0.5); });
  say('同一個 recursion，反過來做', '從最小的 subproblem 長上去');
  cd.hl(1);
  relabel(cells[0], 0); tint(cells[0], C.teal);
  await beat(tok, 2400);
  cd.hl(3);
  for (let j = 1; j <= 6; j++) {
    const J = WJ[j];
    const a1 = link([MX(j), 3.85], [MX(j - 1), 3.85], C.blue, 0.2);
    const a2 = J.p !== j - 1 ? arrow(V3(MX(j), 2.9, 0.3), V3(MX(J.p), 2.9, 0.3), 0xc08a1f) : null;
    glow(cells[j], GOLD);
    const take = J.v + WM[J.p];
    say('M[' + j + '] = max(' + J.v + ' + M[' + J.p + '], M[' + (j - 1) + '])', '= max(' + take + ', ' + WM[j - 1] + ') = ' + WM[j]);
    await beat(tok, 1700);
    relabel(cells[j], WM[j]); tint(cells[j], take >= WM[j - 1] ? C.orange : C.teal); glow(cells[j], null);
    kill(a1); if (a2) kill(a2);
    await beat(tok, 400);
  }
  cd.hl(-1);
  say('每格只看前面已填好的兩格', '順序保證查到的都有值');
  await beat(tok, 2600);
  say('M[6] = 8 就是最佳值', '補充：回溯得 {1, 3, 5}：2 + 4 + 2');
  await beat(tok, 2600);
  say('DP 不等於填表格', '填表只是一種 implementation');
  await beat(tok, 2600);
}]);

// 47:26 兩種 implementation 比較：memoization（top-down）vs iteration（bottom-up）
FRAG.push(['dpjiang1-memo-vs-iter', 'Memoization（top-down）vs Iteration（bottom-up）', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  tag('memoization：top-down', 'ptr', -3.4, 7.4);
  tag('iteration：bottom-up', 'ptr', 3.4, 7.4);
  const L = [], R = [];
  for (let k = 0; k < 6; k++) {
    L.push(box('P' + k, C.gray, -3.4, 1.4 + k * 1.0, 1.4, 0.55, 0.45));
    R.push(box('P' + k, C.gray, 3.4, 1.4 + k * 1.0, 1.4, 0.55, 0.45));
  }
  say('兩種寫法都對', '同一個 recursion');
  await beat(tok, 2200);
  // top-down: starts at P5, only needed ones (示意：P5 需要 P3、P1)
  const need = [5, 3, 1, 0];
  say('memo：從最大問題往下呼叫', '先查小抄，沒有才算');
  for (let i = 0; i < need.length; i++) {
    const k = need[i];
    tint(L[k], C.orange); glow(L[k], GOLD);
    if (i) link([-3.4, 1.4 + need[i - 1] * 1.0], [-3.4, 1.4 + k * 1.0], C.orange, 0.3);
    await beat(tok, 900); glow(L[k], null);
  }
  say('只算上面需要用到的', '示意：P5 只用到 P3、P1、P0');
  await beat(tok, 2600);
  say('iteration：一層 for loop 由小算到大', '每個 subproblem 都算一次');
  for (let k = 0; k < 6; k++) { tint(R[k], C.teal); glow(R[k], GREEN); await beat(tok, 500); glow(R[k], null); }
  await beat(tok, 1000);
  say('不管有沒有人用，全部都算', '但重複的不會再算');
  await beat(tok, 2600);
  say('memo 有時算得少一點', 'iteration 寫起來最簡單');
  await beat(tok, 2800);
}]);

// 52:47 什麼時候用 DP：子問題數 polynomial、由子問題兜出、自然順序；runtime ~ table size
FRAG.push(['dpjiang1-when-dp', '什麼時候用 DP：三個特性', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  say('DP 的 runtime 跟 table size 有關', '把 recursion 大樹壓成細長一條');
  const row = [];
  for (let k = 0; k < 7; k++) row.push(box('', C.teal, -4.2 + k * 1.4, 6.6, 1.2, 0.5, 0.45, 1.0));
  await beat(tok, 2600);
  const t1 = tag('① subproblem 總數是 polynomial', 'ptr alt', 0, 5.6);
  say('① 子問題數要 polynomial', '它決定 lookup table 的大小');
  await beat(tok, 2600);
  const ex = [];
  for (let k = 0; k < 16; k++) ex.push(box('', C.red, -5.6 + (k % 8) * 1.6, 4.5 - Math.floor(k / 8) * 0.6, 1.3, 0.4, 0.35, 1.0));
  say('若是 exponential 個', 'table 也是 exponential：效果不大');
  await beat(tok, 2400);
  ex.forEach((m) => fly(m));
  txt(t1, '② 大問題的解由子問題的解兜出');
  say('② 大問題的解由小問題兜出', 'highly depends on subproblems');
  for (let k = 1; k < 7; k++) link([-4.2 + (k - 1) * 1.4, 6.6], [-4.2 + k * 1.4, 6.6], C.brown, 0.62);
  await beat(tok, 2600);
  const t3 = tag('③ 有天生的 natural order：小 → 大', 'ptr alt', 0, 3.6);
  say('③ 最重要：有自然的順序', '從最小的算到最大的');
  for (let k = 0; k < 7; k++) { glow(row[k], GREEN); await beat(tok, 300); glow(row[k], null); }
  await beat(tok, 1400);
  tag('order 不會改變 → 90% 可以用 DP', 'ptr', 0, 2.6);
  say('看到固定不變的順序', '就先試 DP');
  await beat(tok, 3000);
  kill(t3);
}]);

// 57:59 CLRS：optimal substructure + overlapping subproblems（用 WIS 說明）
FRAG.push(['dpjiang1-clrs', 'CLRS 兩大特性：最佳子結構＋重疊子問題', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  say('Introduction to Algorithms 的說法', 'DP 要有兩大特性');
  await beat(tok, 2200);
  tag('overlapping subproblems', 'ptr', -3.4, 7.6);
  const T = optTree(5);
  const all = layout(T, 1.0, 6.7, 0.95, -3.4);
  all.forEach((t) => { if (t.par) line(t.par.x, t.par.y - 0.22, t.x, t.y + 0.22, 0, C.sand); t.m = box('O' + t.j, C.blue, t.x, t.y, 0.7, 0.4, 0.35, 1.0); });
  await beat(tok, 1000);
  all.forEach((t) => { if (t.j === 3) { tint(t.m, C.orange); glow(t.m, GOLD); } });
  say('子問題重複出現（O3 兩次）', '記在 table 上只算一次');
  await beat(tok, 2800);
  all.forEach((t) => glow(t.m, null));
  tag('optimal substructure', 'ptr', 3.4, 7.6);
  const o6 = box('O6', C.purple, 3.4, 6.2, 1.1, 0.55, 0.45, 1.2);
  const a = box('{6}', C.pink, 2.4, 4.6, 0.9, 0.5, 0.45, 1.2), b = box('O3', C.teal, 4.2, 4.6, 0.9, 0.5, 0.45, 1.2);
  line(3.4, 5.9, 2.4, 4.85, 0, C.sand); line(3.4, 5.9, 4.2, 4.85, 0, C.sand);
  say('最佳解由子問題的最佳解兜出', '例：O6 = {6} ∪ O3');
  await beat(tok, 2800);
  glow(b, GREEN);
  say('O3 本身也必須是最佳', '這需要簡單的證明');
  await beat(tok, 2600);
  glow(b, null);
  tag('objects 有不能改變的 linear order', 'ptr alt', 0, 1.4);
  say('最重要的 hint：linear order', '照這個順序就能算出解');
  await beat(tok, 3000);
  glow(o6, GOLD); void a;
  say('DP 天生最適合最佳化問題', '來自 mathematical programming');
  await beat(tok, 2600);
}]);

// 61:07 發展 DP 的步驟：recurrence、確認子問題數、決定順序
FRAG.push(['dpjiang1-steps', '發展 DP 的三個步驟', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const S = ['① 寫出 recurrence relation', '② 確認 subproblem 數是 polynomial', '③ 決定 subproblem 的計算順序'];
  const bars = S.map((s, k) => box('', C.gray, 0, 6.4 - k * 1.7, 9.6, 0.9, 0.45));
  const ls = S.map((s, k) => tag(s, 'ptr', 0, 6.4 - k * 1.7, 0.4));
  ls.forEach((l) => { l.element.style.opacity = '0.35'; });
  say('確認可以用 DP 之後', '照固定步驟發展');
  await beat(tok, 3200);
  const caps = [['大問題最佳解跟小問題的關係', '可以先用 D&C 的方式思考'], ['決定 lookup table 的大小', 'exponential 個就做不好'], ['讓 DP 正常運作的關鍵', '查表時一定要已經有值']];
  for (let k = 0; k < 3; k++) {
    tint(bars[k], [C.purple, C.blue, C.teal][k]); glow(bars[k], GOLD); ls[k].element.style.opacity = '1';
    say(caps[k][0], caps[k][1]);
    await beat(tok, 3000);
    glow(bars[k], null);
  }
  say('最難的是寫出 recursive form', '剩下只是 implement 它');
  await beat(tok, 3000);
}]);

// 64:28 演算法 paradigm 回顧：brute force、greedy、D&C、DP
FRAG.push(['dpjiang1-paradigms', '四種 paradigm：暴力、greedy、D&C、DP', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const X = [-4.8, -1.6, 1.6, 4.8];
  const N = ['Brute force', 'Greedy', 'Divide & Conquer', 'Dynamic Prog.'];
  const head = N.map((n, k) => box('', LV[k], X[k], 7.0, 2.9, 0.6, 0.4, 1.2));
  N.forEach((n, k) => tag(n, 'ptr', X[k], 7.0, 0.3));
  await beat(tok, 1000);
  // brute force: all candidates
  const bf = [];
  for (let k = 0; k < 9; k++) bf.push(box('', C.gray, X[0] - 0.9 + (k % 3) * 0.9, 5.6 - Math.floor(k / 3) * 0.7, 0.7, 0.45, 0.35, 0.8));
  glow(head[0], GOLD);
  say('暴力法：所有可能都試', 'exhaustive search，當 baseline');
  await beat(tok, 1600);
  tint(bf[7], C.teal);
  await beat(tok, 1400); glow(head[0], null);
  // greedy: step by step, never regret
  glow(head[1], GOLD);
  const gr = [];
  for (let k = 0; k < 4; k++) { gr.push(box('', C.blue, X[1], 5.6 - k * 0.75, 1.6, 0.45, 0.35, 0.8)); await beat(tok, 450); }
  say('Greedy：每步選當下最好的', '做了決定就不反悔');
  await beat(tok, 2400); glow(head[1], null);
  // D&C: split + combine
  glow(head[2], GOLD);
  const d0 = box('', C.cyan, X[2], 5.6, 2.2, 0.45, 0.35, 0.8);
  const d1 = [X[2] - 0.6, X[2] + 0.6].map((x) => box('', C.cyan, x, 4.6, 1.0, 0.45, 0.35, 0.8));
  say('D&C：拆成同性質小問題', '重點在 combine（merge sort）');
  await beat(tok, 2400); void d0; void d1; glow(head[2], null);
  // DP: overlapping, table
  glow(head[3], GOLD);
  const t = [0, 1, 2, 3].map((k) => box('', C.gray, X[3] - 1.05 + k * 0.7, 5.0, 0.6, 0.6, 0.35, 0.8));
  say('DP：子問題會重複', '記在 table，從小到大');
  for (let k = 0; k < 4; k++) { tint(t[k], C.orange); await beat(tok, 450); }
  await beat(tok, 1400); glow(head[3], null);
  tag('D&C 與 DP 都源自 induction', 'ptr alt', 0, 1.6);
  say('都從 recurrence relation 出發', '子問題不重複 → D&C；會重複 → DP');
  await beat(tok, 3200);
}]);

// 73:40 Fibonacci：F0 = 0、F1 = 1、螺旋
FRAG.push(['dpjiang1-fib-spiral', 'Fibonacci：每項是前兩項的和、正方形螺旋', async (tok) => {
  fresh([0, 4.0, 14], [0, 4.0, 0]);
  const seq = [0, 1, 1, 2, 3, 5, 8];
  const lbl = seq.map((v, k) => tag('F' + k + '=' + v, 'idx', -5.6 + k * 1.0, 8.2));
  lbl.forEach((l) => { l.element.style.visibility = 'hidden'; });
  say('Fibonacci：不是最佳化問題', '只是一個計算');
  await beat(tok, 2200);
  for (let k = 0; k < 7; k++) {
    lbl[k].element.style.visibility = '';
    say(k < 2 ? 'F0 = 0、F1 = 1' : 'F' + k + ' = F' + (k - 1) + ' + F' + (k - 2), k < 2 ? 'initial number' : seq[k - 1] + ' + ' + seq[k - 2] + ' = ' + seq[k]);
    await beat(tok, 800);
  }
  // squares 1,1,2,3,5,8 in a spiral (unit 0.5)
  const u = 0.48, sq = [[1, 0, 0], [1, 1, 0], [2, 0.5, 1.5], [3, -2, 1], [5, -1, -3], [8, 5.5, -1.5]];
  say('邊長 1、1、2、3、5、8 的正方形', '一個一個接上去');
  const ms = [];
  for (let k = 0; k < sq.length; k++) {
    const [s, cx, cy] = sq[k];
    ms.push(box(String(s), LV[k], (cx - 1.5) * u, 4.0 + cy * u, s * u - 0.06, s * u - 0.06, 0.15, 1.2));
    await beat(tok, 900);
  }
  say('連起角落就是螺旋', '自然界的貝殼也有這個比例');
  await beat(tok, 3000);
  say('問題：怎麼算 F100？', '把 recurrence 直接寫成程式？');
  await beat(tok, 2600);
}]);

// 77:03 直接實作：F5 → F4、F3；大量重疊；依賴只有 5 個
FRAG.push(['dpjiang1-fib-tree', 'Direct implementation：F5 的遞迴樹與依賴', async (tok) => {
  fresh([0, 4.0, 15], [0.4, 4.0, 0]);
  const cd = code(['Fib(n):', '  if n <= 1: return n', '  return Fib(n-1) + Fib(n-2)'], -4.2, 8.6, 0.45);
  const mk = (n) => ({ n, kids: n <= 1 ? [] : [mk(n - 1), mk(n - 2)] });
  const T = mk(5);
  const all = layout(T, 1.3, 7.0, 1.3, 0.8);
  say('直接翻成 recursive code', 'n ≤ 1 直接 return');
  cd.hl(2);
  await beat(tok, 2200);
  const order = []; (function w(t) { order.push(t); t.kids.forEach(w); })(T);
  for (const t of order) {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, C.sand);
    t.m = box('F' + t.n, LV[t.d], t.x, t.y, 0.8, 0.45, 0.4, 1.0);
    await beat(tok, 260);
  }
  cd.hl(-1);
  say('F5 呼叫 F4、F3；F4 再呼叫 F3、F2…', '共 ' + all.length + ' 次 recursive call');
  await beat(tok, 2400);
  all.forEach((t) => glow(t.m, t.n === 3 ? GOLD : null));
  say('F3 整棵子樹出現兩次', '重疊量非常高');
  await beat(tok, 2400);
  all.forEach((t) => glow(t.m, null));
  // dependency: only 5 distinct calls
  say('把 dependency 抽出來', '其實只有 F5…F1 五個');
  const keep = {};
  all.forEach((t) => { if (!keep[t.n] && t.n >= 1) keep[t.n] = t; });
  all.forEach((t) => { if (keep[t.n] !== t) { fly(t.m); } if (t.e) kill(t.e); });
  await beat(tok, 900);
  for (let n = 5; n >= 1; n--) move(keep[n].m, -3.6 + (n - 1) * 1.8, 2.6, 0);
  await beat(tok, 1200);
  for (let n = 1; n <= 5; n++) {
    if (n > 1) link([-3.6 + (n - 2) * 1.8, 2.6], [-3.6 + (n - 1) * 1.8, 2.6], C.teal, 0.5);
    tint(keep[n].m, C.teal); glow(keep[n].m, GREEN);
    await beat(tok, 500); glow(keep[n].m, null);
  }
  say('從沒有 dependency 的 F1 開始算', '算 5 次就結束');
  await beat(tok, 3000);
}]);

// 81:01 Memoization：F[] 先填 −1；F[0] = 0、F[1] = 1；查表
FRAG.push(['dpjiang1-fib-memo', 'Memoization：F[] 先填 −1，算過就查表', async (tok) => {
  fresh([0, 4.0, 15], [0.4, 4.0, 0]);
  const cd = code(['F[0..n] = -1', 'F[0] = 0; F[1] = 1', 'MFib(n):', '  if F[n] = -1:', '    F[n] = MFib(n-1) + MFib(n-2)', '  return F[n]'], -4.6, 8.6, 0.42);
  const mk = (n) => ({ n, kids: n <= 1 ? [] : [mk(n - 1), mk(n - 2)] });
  const T = mk(5);
  const all = layout(T, 1.25, 6.9, 1.2, 1.2);
  all.forEach((t) => { if (t.par) t.e = line(t.par.x, t.par.y - 0.25, t.x, t.y + 0.25, 0, '#d8cfc0'); t.m = box('F' + t.n, GRAY, t.x, t.y, 0.75, 0.42, 0.38); fade(t.m, false); });
  const FX = (k) => -2.6 + k * 1.15;
  tag('F', 'ptr', FX(0) - 1.0, 0.7);
  const F = [0, 1, -1, -1, -1, -1];
  const cells = F.map((v, k) => { tag(String(k), 'idx', FX(k), 0.1); return box(String(v), k <= 1 ? C.teal : '#e6dccb', FX(k), 0.7, 1.0, 0.5, 0.45); });
  cd.hl(0);
  say('−1 表示還沒算過', 'Fibonacci 的數都 ≥ 0');
  await beat(tok, 2400);
  cd.hl(1);
  say('boundary：F[0] = 0、F[1] = 1', '先填好');
  await beat(tok, 2000);
  async function visit(t) {
    fade(t.m, true);
    if (F[t.n] !== -1) {
      tint(t.m, C.gold); glow(t.m, GOLD); glow(cells[t.n], GOLD); cd.hl(5);
      const gone = sub(t).slice(1);
      say('F[' + t.n + '] = ' + F[t.n] + '：有值，直接 return', gone.length ? '不再展開' : '查表');
      await beat(tok, 900);
      gone.forEach((u) => { fly(u.m); if (u.e) kill(u.e); });
      glow(t.m, null); glow(cells[t.n], null);
      return;
    }
    tint(t.m, LV[t.d]); glow(t.m, GOLD); cd.hl(4);
    say('F[' + t.n + '] = −1：沒算過', '老實 recursive call');
    await beat(tok, 900); glow(t.m, null);
    for (const k of t.kids) await visit(k);
    F[t.n] = F[t.n - 1] + F[t.n - 2];
    relabel(cells[t.n], F[t.n]); tint(cells[t.n], C.teal); glow(cells[t.n], GREEN); tint(t.m, C.teal);
    say('存 F[' + t.n + '] = ' + F[t.n], F[t.n - 1] + ' + ' + F[t.n - 2]);
    await beat(tok, 800); glow(cells[t.n], null);
  }
  await visit(T);
  cd.hl(-1);
  say('真正展開的只有 F5→F4→F3→F2→F1', '其他都來自查表：top-down');
  await beat(tok, 3000);
}]);

// 86:53 Maze routing：wave propagation，一步、兩步…碰到 target，倒著數回去
FRAG.push(['dpjiang1-maze', 'Maze routing：wave propagation 找最短路徑', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.6, 0]);
  const G = ['.........', '..##.....', '......#..', '.##.#.#..', '....#.#..', 'S...#.T..'];
  const R = 6, CN = 9, at = (r, c) => G[R - 1 - r][c];
  const X = (c) => (c - 4) * 1.1, Y = (r) => 1.0 + r * 1.0;
  const cell = {}; let S, Tt;
  for (let r = 0; r < R; r++) for (let c = 0; c < CN; c++) {
    const ch = at(r, c);
    cell[r + ',' + c] = box(ch === 'S' ? 'S' : ch === 'T' ? 'T' : ch === '#' ? '' : ' ', ch === '#' ? '#7d7466' : ch === 'S' ? C.purple : ch === 'T' ? C.gold : '#e9e1d0', X(c), Y(r), 1.0, 0.9, ch === '#' ? 0.6 : 0.15);
    if (ch === 'S') S = [r, c]; if (ch === 'T') Tt = [r, c];
  }
  say('格狀迷宮：灰色是障礙物', '老鼠 S 走到起司 T；只能上下左右');
  await beat(tok, 2800);
  say('就像 VLSI 繞線：source 接 target', '而且要走最短');
  await beat(tok, 2200);
  const d = { [S]: 0 }; let front = [S], w = 0, hit = false;
  while (front.length && !hit) {
    w++; const nx = [];
    for (const [r, c] of front) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= CN || at(nr, nc) === '#' || d[[nr, nc]] !== undefined) continue;
      d[[nr, nc]] = w; nx.push([nr, nc]);
      const m = cell[nr + ',' + nc];
      if (at(nr, nc) === 'T') { hit = true; glow(m, GREEN); relabel(m, 'T' + w); } else { relabel(m, w); tint(m, w % 2 ? '#bfe3d3' : '#a9d8c4'); }
    }
    front = nx;
    say('wave：' + w + ' 步可以到的格子', hit ? '碰到 T：最短 = ' + w + ' 步' : '像水波一樣往外擴散');
    await beat(tok, hit ? 2200 : 550);
  }
  say('倒過來數 ' + w + ', ' + (w - 1) + ', …, 1', '任何一條連續遞減的路都是解');
  let cur = Tt;
  while (d[cur] > 0) {
    const [r, c] = cur;
    for (const [dr, dc] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      const n = [r + dr, c + dc];
      if (d[n] === d[cur] - 1) { cur = n; break; }
    }
    if (d[cur] > 0) { tint(cell[cur[0] + ',' + cur[1]], C.orange); await beat(tok, 260); }
  }
  await beat(tok, 1200);
  say('table 大小 = 格子數 m × n', '時間與空間都是 O(mn)');
  await beat(tok, 3000);
}]);

// ════════════════ S5vS9YEvnFU（Lec19 Dynamic Programming 3/3） ════════════════

// Bellman-Ford 表（KT Fig 6.23）：OPT(i, v) 列 = 點、欄 = 最多 i 條 edge
const BV = ['t', 'a', 'b', 'c', 'd', 'e'];
const BT = { t: [0, 0, 0, 0, 0, 0], a: [null, -3, -3, -4, -6, -6], b: [null, null, 0, -2, -2, -2], c: [null, 3, 3, 3, 3, 3], d: [null, 4, 3, 3, 2, 0], e: [null, 2, 0, 0, 0, 0] };
const bfs = (v) => (v === null ? '∞' : String(v));
function bfTable(x0, y0, cw = 0.95, chh = 0.62, cols = 6) {
  const cells = {};
  for (let i = 0; i < cols; i++) tag(String(i), 'idx', x0 + i * cw, y0 + 0.6);
  BV.forEach((v, r) => {
    tag(v, 'ptr', x0 - 0.85, y0 - r * chh);
    cells[v] = [];
    for (let i = 0; i < cols; i++) cells[v][i] = box(bfs(BT[v][i]), i === cols - 1 ? '#efe0c0' : '#e6dccb', x0 + i * cw, y0 - r * chh, cw - 0.08, chh - 0.08, 0.3);
  });
  return cells;
}

// 00:15 Bellman-Ford 回顧：一欄一欄填；b 在 i = 5：min(−2, −1 + 2, −2 + 0)
FRAG.push(['dpjiang1-bf-cell', 'Bellman-Ford 填表：OPT(5, b) = −2', async (tok) => {
  fresh([0, 4.2, 13.5], [0.4, 3.9, 0]);
  const cells = bfTable(-4.6, 6.4);
  tag('i = 最多經過幾條 edge', 'idx', -2.2, 7.6);
  say('上次的 Bellman-Ford：bottom-up', '最後一欄 = 每個點到 t 的最短距離');
  await beat(tok, 3000);
  say('每個 iteration 填一個新 column', '只參考前一個 column');
  for (let i = 1; i < 6; i++) { BV.forEach((v) => glow(cells[v][i], GOLD)); await beat(tok, 450); BV.forEach((v) => glow(cells[v][i], null)); }
  await beat(tok, 800);
  glow(cells.b[5], GOLD);
  tag('b→d：−1', 'ptr alt', 3.0, 5.0); tag('b→e：−2', 'ptr alt', 3.0, 4.3);
  say('看 b 到 t、最多 5 條 edge', '兩種 option');
  await beat(tok, 2600);
  glow(cells.b[4], GREEN);
  say('option 1：沒用到第 5 條 edge', 'OPT(4, b) = −2（左邊那格）');
  await beat(tok, 2600);
  glow(cells.d[4], GREEN);
  say('option 2：剛好 5 條，先走 b→d', '−1 + OPT(4, d) = −1 + 2 = 1');
  await beat(tok, 2800);
  glow(cells.d[4], null); glow(cells.e[4], GREEN);
  say('或先走 b→e', '−2 + OPT(4, e) = −2 + 0 = −2');
  await beat(tok, 2800);
  glow(cells.e[4], null); glow(cells.b[4], null); glow(cells.b[5], GREEN);
  say('取 minimum：還是 −2', 'OPT(5, b) = min(−2, 1, −2) = −2');
  await beat(tok, 3000);
}]);

// 05:00 Complexity：O(nm) 而不是 O(n³)；空間只要前一欄，但回溯路徑要留紀錄
FRAG.push(['dpjiang1-bf-cost', 'Bellman-Ford 的 O(nm) 與空間', async (tok) => {
  fresh([0, 4.2, 13.5], [0.4, 3.9, 0]);
  const cells = bfTable(-4.6, 6.4);
  const cd = code(['for i = 1 to n-1:', '  for each v (any order):', '    M[i,v] = min(M[i-1,v],', '      min over (v,w): c(v,w) + M[i-1,w])'], 2.7, 2.4, 0.42);
  cd.hl(0);
  say('外層：最多填 n − 1 個 column', 'O(n)');
  await beat(tok, 2600);
  cd.hl(3);
  glow(cells.b[5], GOLD); glow(cells.b[4], GREEN); glow(cells.d[4], GREEN); glow(cells.e[4], GREEN);
  say('每個點只看左格＋out-degree 格', 'b：1 + 2 格');
  await beat(tok, 2800);
  ['b', 'd', 'e'].forEach((v) => glow(cells[v][4], null)); glow(cells.b[5], null);
  say('全部點加總 = 總 edge 數 m', '內層 O(m) → 整體 O(nm)');
  await beat(tok, 2800);
  say('粗略看：每格看整欄 → O(n³)', '算太多了；詳細分析是 O(nm)');
  await beat(tok, 2800);
  cd.hl(-1);
  BV.forEach((v) => { for (let i = 1; i < 4; i++) fade(cells[v][i], false); });
  say('每格只參考前一欄', '只求值的話，兩欄就夠');
  await beat(tok, 2800);
  BV.forEach((v) => { for (let i = 1; i < 4; i++) fade(cells[v][i], true); });
  say('要還原整條路徑', '每格還要記「參考了誰」');
  await beat(tok, 2800);
}]);

// 10:29 Negative cycle：在 v 繞圈，每繞一圈更短
FRAG.push(['dpjiang1-negcycle', 'Negative cycle：繞一圈就更短，出不來', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const P = { s: [-5, 2.4], v: [-1, 2.4], t: [5, 2.4], x: [0.6, 5.4], y: [-2.6, 5.4] };
  const N = {};
  for (const [k, p] of Object.entries(P)) N[k] = box(k, k === 's' || k === 't' ? C.purple : C.blue, p[0], p[1], 0.8, 0.6, 0.5, 1.4);
  link(P.s, P.v); link(P.v, P.t);
  const cyc = [['v', 'x', -2], ['x', 'y', 3], ['y', 'v', -4]];
  cyc.forEach(([a, b, w]) => { link(P[a], P[b], C.red); tag(String(w), 'ptr alt', (P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2 + 0.4); });
  tag('cycle C：−2 + 3 − 4 = −3 < 0', 'ptr', 0, 7.2);
  say('s 到 t 的路上經過 v', 'v 在一個 negative cycle 上');
  await beat(tok, 3000);
  const tk = box('', C.orange, P.s[0], P.s[1] + 0.65, 0.35, 0.35, 0.35);
  const cost = tag('路徑長 −∞ ?', 'ptr alt', 4.2, 4.4);
  move(tk, P.v[0], P.v[1] + 0.65, 0);
  await beat(tok, 1200);
  for (let lap = 1; lap <= 3; lap++) {
    for (const k of ['x', 'y', 'v']) { move(tk, P[k][0], P[k][1] + 0.65, 0); await beat(tok, 600); }
    txt(cost, '多繞 ' + lap + ' 圈：再 −' + 3 * lap);
    say('每繞一圈總長再降 3', '繞 10 圈就賺 10 次');
  }
  await beat(tok, 1400);
  say('最短路徑不存在', 'Bellman-Ford 也給不出正確解');
  await beat(tok, 2600);
  say('算最短路徑前', '先偵測有沒有 negative cycle');
  await beat(tok, 2600);
}]);

// 13:18 套利：匯率相乘 > 1 的 cycle
FRAG.push(['dpjiang1-arbitrage', '套利：匯率乘積 > 1 的 cycle', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { USD: [-3.6, 2.2], CHF: [0, 6.6], EUR: [3.6, 2.2], GOLD: [-5.8, 6.0] };
  const N = {};
  for (const [k, p] of Object.entries(P)) N[k] = box(k, k === 'GOLD' ? C.gold : C.blue, p[0], p[1], 1.2, 0.6, 0.5, 1.4);
  link(P.GOLD, P.USD, C.brown, 0.6); tag('1 → 327.25', 'idx', -5.6, 4.0);
  say('edge 上是兩種貨幣的 exchange rate', '例：1 單位金 → 327.25 美元');
  await beat(tok, 3000);
  say('換過去再直接換回來', '乘積一定 < 1：會虧');
  await beat(tok, 2600);
  const E = [['USD', 'CHF', '1.3941'], ['CHF', 'EUR', '0.6677'], ['EUR', 'USD', '1.0752']];
  const coin = box('$1', C.orange, P.USD[0], P.USD[1] + 0.8, 0.7, 0.45, 0.4);
  const amt = ['1.3941 法郎', '0.9308 歐元', '$1.00084'];
  for (let k = 0; k < 3; k++) {
    const [a, b, r] = E[k];
    link(P[a], P[b], C.red, 0.6);
    tag('×' + r, 'ptr alt', (P[a][0] + P[b][0]) / 2 + (k === 2 ? 0 : (k ? 0.9 : -0.9)), (P[a][1] + P[b][1]) / 2 + (k === 2 ? -0.5 : 0.3));
    move(coin, P[b][0], P[b][1] + 0.8, 0); relabel(coin, amt[k]);
    say(a + ' → ' + b + '：× ' + r, '手上變成 ' + amt[k]);
    await beat(tok, 2200);
  }
  glow(coin, GREEN);
  say('繞一圈：$1 變 $1.00084', '乘積 > 1：無本生意');
  await beat(tok, 3000);
  say('要找：edge 乘積 > 1 的 cycle', '但 shortest path 算的是「和」的最小');
  await beat(tok, 3000);
}]);

// 19:10 轉換：w = −log r，乘積 > 1 ⇔ 總和 < 0
FRAG.push(['dpjiang1-neglog', '取 −log：乘積 > 1 變成 negative cycle', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { USD: [-3.6, 2.2], CHF: [0, 6.6], EUR: [3.6, 2.2] };
  for (const [k, p] of Object.entries(P)) box(k, C.blue, p[0], p[1], 1.2, 0.6, 0.5, 1.4);
  const E = [['USD', 'CHF', 1.3941], ['CHF', 'EUR', 0.6677], ['EUR', 'USD', 1.0752]];
  const lb = E.map(([a, b, r], k) => { link(P[a], P[b], C.red, 0.6); return tag('r = ' + r, 'ptr alt', (P[a][0] + P[b][0]) / 2 + (k === 2 ? 0 : (k ? 1.1 : -1.1)), (P[a][1] + P[b][1]) / 2 + (k === 2 ? -0.5 : 0.3)); });
  say('問題一：要的是乘積，不是和', 'r₁₂ · r₂₃ · … · rₙ₁ > 1');
  await beat(tok, 3000);
  const f = tag('log(r₁₂ r₂₃ r₃₁) = log r₁₂ + log r₂₃ + log r₃₁', 'ptr', 0, 0.8);
  say('取 log：乘法變加法', 'log 的乘積 = log 的和');
  await beat(tok, 3000);
  say('問題二：要越大越好', 'shortest path 是越小越好 → 加負號');
  await beat(tok, 2600);
  const w = E.map(([, , r]) => -Math.log(r));
  for (let k = 0; k < 3; k++) {
    txt(lb[k], 'c = ' + w[k].toFixed(4)); lb[k].element.className = 'lab-label ptr';
    say('c = −log r', '−log ' + E[k][2] + ' = ' + w[k].toFixed(4));
    await beat(tok, 1700);
  }
  const s = w[0] + w[1] + w[2];
  txt(f, '總和 = ' + s.toFixed(5) + ' < 0');
  say('乘積 > 1 ⇔ −log 的總和 < 0', '套利 = negative cycle');
  await beat(tok, 3200);
  say('問題轉成：圖裡有沒有 negative cycle', '用 Bellman-Ford 偵測');
  await beat(tok, 2800);
}]);

// 24:14 偵測：多跑一個 iteration（最多 n 條 edge），值還會變小 → 有 negative cycle
FRAG.push(['dpjiang1-bf-extra', '多跑一輪：值還變小就有 negative cycle', async (tok) => {
  fresh([0, 4.0, 14], [0, 4.0, 0]);
  tag('cycle ≥ 0', 'ptr', -3.6, 7.6);
  tag('negative cycle', 'ptr alt', 3.6, 7.6);
  // left: KT table, columns 5 and 6 equal
  const L = {};
  BV.forEach((v, r) => { tag(v, 'idx', -5.6, 6.6 - r * 0.62); L[v] = [box(bfs(BT[v][5]), '#e6dccb', -4.4, 6.6 - r * 0.62, 1.0, 0.54, 0.3), null]; });
  tag('i=5', 'idx', -4.4, 7.1); tag('i=6', 'idx', -3.2, 7.1);
  say('正常 Bellman-Ford 停在 n − 1', '最多經過 n − 1 條 edge');
  await beat(tok, 2600);
  say('再多跑一個 iteration：i = n', '最多 n 條：可能繞回自己');
  BV.forEach((v, r) => { L[v][1] = box(bfs(BT[v][5]), C.teal, -3.2, 6.6 - r * 0.62, 1.0, 0.54, 0.3, 1.0); });
  await beat(tok, 2400);
  say('左邊（上次的圖）：完全沒變', '沒有 negative cycle → 答案正確');
  await beat(tok, 2600);
  // right: v ⇄ w cycle (−3, +1), v → t (2); n = 3
  const P = { v: [2.4, 5.6], w: [5.0, 5.6], t: [2.4, 2.6] };
  for (const [k, p] of Object.entries(P)) box(k, k === 't' ? C.purple : C.blue, p[0], p[1], 0.7, 0.55, 0.5, 1.2);
  arrow(V3(2.8, 5.85, 0), V3(4.6, 5.85, 0), 0xd64545); tag('−3', 'ptr alt', 3.7, 6.3);
  arrow(V3(4.6, 5.35, 0), V3(2.8, 5.35, 0), 0x6e5f49); tag('1', 'ptr', 3.7, 4.95);
  link(P.v, P.t); tag('2', 'ptr', 2.0, 4.1);
  const vt = tag('', 'ptr alt', 5.0, 3.4), wt = tag('', 'ptr alt', 5.0, 2.7);
  const rows = [['i=1', 2, '∞'], ['i=2', 2, 3], ['i=3（多跑）', 0, 3]];
  for (let k = 0; k < 3; k++) {
    txt(vt, rows[k][0] + '：OPT(v) = ' + rows[k][1]); txt(wt, 'OPT(w) = ' + rows[k][2]);
    say(k < 2 ? '右邊 n = 3：跑到 i = 2' : '多跑 i = 3：v 從 2 降到 0', k < 2 ? 'v = 2、w = 1 + 2 = 3' : '−3 + OPT(w) = 0 < 2');
    await beat(tok, 2400);
  }
  vt.element.className = 'lab-label ptr';
  say('值變小 → report negative cycle', 'infeasible：沒有最短路徑');
  await beat(tok, 3000);
}]);

// 28:22 證明：剛好 n 條 edge 的路徑一定重複點（鴿籠）→ cycle；若 ≥ 0 砍掉更好 → 矛盾
FRAG.push(['dpjiang1-bf-proof', '證明：n 條 edge 必重複點，cycle 必為負', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  say('假設多跑一輪後 OPT(n, v) 變小', '新解一定剛好用 n 條 edge');
  await beat(tok, 3000);
  const xs = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
  const nm = ['v', 'a', 'b', 'c', 'd', 'b', 't'];
  const ms = xs.map((x, k) => box(nm[k], k === 0 || k === 6 ? C.purple : C.blue, x, 4.2, 0.8, 0.6, 0.5, 1.2));
  for (let k = 0; k < 6; k++) link([xs[k], 4.2], [xs[k + 1], 4.2]);
  tag('n = 6 個點，路徑走 6 條 edge → 7 個位置', 'ptr', 0, 6.4);
  say('只有 n 個點，卻有 n + 1 個位置', '鴿籠原理：某個點出現兩次');
  await beat(tok, 3000);
  glow(ms[2], GOLD); glow(ms[5], GOLD);
  say('b 出現兩次', 'b → c → d → b 形成 cycle');
  await beat(tok, 2600);
  const cy = tag('若此 cycle ≥ 0（反證）', 'ptr alt', 0, 2.4);
  say('反證：假設 cycle 不是負的', '把它砍掉');
  await beat(tok, 2400);
  [3, 4, 5].forEach((k) => fly(ms[k]));
  await beat(tok, 900);
  move(ms[6], xs[3], 4.2, 0);
  txt(cy, '用更少 edge，cost 不會更高');
  say('edge 數更少、cost 不更高', '那 n − 1 欄早就該有這個值');
  await beat(tok, 3000);
  txt(cy, '矛盾 → cycle 一定是 negative');
  say('與「多跑一輪才變小」矛盾', '所以一定有 negative cycle');
  await beat(tok, 3000);
}]);

// 34:02 找出所有 negative cycle：加一個新點 t，每個點連 0 邊到 t
FRAG.push(['dpjiang1-aug-t', '加新點 t：每個點都連 0 的 edge', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const P = { a: [-4.6, 6.0], b: [-1.6, 6.6], c: [1.6, 6.0], d: [-3.2, 3.6], e: [0.2, 3.8], f: [4.2, 4.4] };
  for (const [k, p] of Object.entries(P)) box(k, C.teal, p[0], p[1], 0.7, 0.55, 0.5, 1.2);
  [['a', 'b'], ['b', 'c'], ['d', 'a'], ['e', 'd'], ['c', 'e'], ['c', 'f']].forEach(([x, y]) => link(P[x], P[y], C.brown, 0.4));
  say('原來的 input graph G', '隨便選一個 destination 不保險');
  await beat(tok, 3000);
  say('不是每條最短路都經過那個 cycle', '可能漏抓');
  await beat(tok, 2400);
  const T = [0.2, 0.6];
  const tm = box('t', C.purple, T[0], T[1], 0.9, 0.6, 0.5, 2.0);
  await beat(tok, 900);
  for (const k of Object.keys(P)) { link(P[k], T, C.red, 0.42); await beat(tok, 300); }
  tag('每條新 edge weight = 0', 'ptr alt', 4.0, 1.6);
  say('加一個新點 t，所有點都連過去', 'edge weight 都是 0');
  await beat(tok, 2800);
  glow(tm, GOLD);
  say('任何 negative cycle 都 reach 得到 t', '算每個點到 t 就一定抓得到');
  await beat(tok, 3000);
  glow(tm, null);
  tag("G′ 有 n + 1 個點：多跑一輪", 'ptr', 0, 8.0);
  say("對 G′ 跑 Bellman-Ford 並多跑一輪", '最後一輪有 update → 有 negative cycle');
  await beat(tok, 3000);
}]);

// 39:48 TSP：拜訪每個城市一次再回來；n! 種排列；NP-complete
FRAG.push(['dpjiang1-tsp-intro', 'Traveling salesman：n! 種路線', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const pos = [0, 1, 2, 3, 4].map((k) => [3.0 * Math.sin(k * 2 * Math.PI / 5), 4.0 + 3.0 * Math.cos(k * 2 * Math.PI / 5)]);
  const nm = ['base', 'c1', 'c2', 'c3', 'c4'];
  pos.forEach((p, k) => box(nm[k], k ? C.blue : C.purple, p[0], p[1], 1.0, 0.55, 0.5, 1.2));
  say('銷售員從公司所在地出發', '每個客戶城市拜訪一次，再回來');
  await beat(tok, 3000);
  const tours = [[0, 1, 2, 3, 4], [0, 2, 4, 1, 3], [0, 3, 1, 4, 2]];
  const cnt = tag('', 'ptr alt', 0, 8.2);
  for (let k = 0; k < tours.length; k++) {
    const ar = [];
    for (let i = 0; i < 5; i++) ar.push(link(pos[tours[k][i]], pos[tours[k][(i + 1) % 5]], k ? C.gray : C.orange, 0.55));
    txt(cnt, '路線 ' + (k + 1) + '：' + tours[k].map((i) => nm[i]).join('→') + '→base');
    say('總距離越短越好', '距離 = 機票錢、油錢…');
    await beat(tok, 2400);
    ar.forEach(kill);
  }
  txt(cnt, 'n 個城市的排列：n! 種');
  say('暴力法：試所有排列', 'n! 種，非常高');
  await beat(tok, 2800);
  say('TSP 是 NP-complete', '沒人證明有 polynomial-time 最佳解');
  await beat(tok, 3000);
}]);

// 44:05 Bellman 1962：OPT(S, u, v)；|S| = 2 → c(u,v)；否則 min over w：c(u,w) + OPT(S − {u}, w, v)
FRAG.push(['dpjiang1-tsp-dp', 'TSP 的 DP：OPT(S, u, v)', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 4.0, 0]);
  const pos = [[-4.6, 4.4], [-2.2, 6.6], [0.6, 6.0], [-1.2, 2.6], [2.2, 3.4]];
  const nm = ['u', 'w1', 'w2', 'w3', 'v'];
  const ms = pos.map((p, k) => box(nm[k], k === 0 || k === 4 ? C.purple : C.blue, p[0], p[1], 0.75, 0.55, 0.5, 1.2));
  tag('OPT(S, u, v)：從 u 到 v、經過 S 每個點一次的最短 route', 'ptr', 0, 8.3);
  say('Bellman 1962：用 DP 解 TSP', 'S 是城市的 subset，u、v 是頭尾');
  await beat(tok, 3200);
  const base = tag('S = {u, v} → c(u, v)', 'ptr alt', 4.6, 7.2);
  const a0 = link(pos[0], pos[4], C.teal, 0.5);
  say('boundary：S 只有 u、v', '直接飛：c(u, v)');
  await beat(tok, 2600);
  kill(a0); kill(base);
  const rec = tag('OPT(S, u, v) = min_w { c(u, w) + OPT(S − {u}, w, v) }', 'ptr alt', 0, 0.9);
  for (const k of [1, 2, 3]) {
    const a = link(pos[0], pos[k], C.orange, 0.5);
    glow(ms[k], GOLD); fade(ms[0], false);
    say('u 先飛到 w' + k, '剩下：OPT(S − {u}, w' + k + ', v)');
    await beat(tok, 1800);
    kill(a); glow(ms[k], null); fade(ms[0], true);
  }
  say('每個 w 都試，取 minimum', 'u 已走過，所以從 S 拿掉');
  await beat(tok, 2600);
  txt(rec, '子問題 2ⁿ·n² 個；時間 2ⁿ·n³');
  say('比 n! 小，但仍是 exponential', 'n = 20：2ⁿn³ ≈ 8.4×10⁹ vs n! ≈ 2.4×10¹⁸');
  await beat(tok, 3400);
  say('DP 可以用，但效果不好', '子問題數不是 polynomial');
  await beat(tok, 2800);
}]);

// 48:56 總結：DP 是聰明的 recursion；填表不是本質；linear order
FRAG.push(['dpjiang1-dp-essence', 'DP 的本質：聰明的 recursion，不是填表', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const rec = box('recurrence relation', C.purple, 0, 6.8, 5.2, 0.7, 0.5, 1.2);
  say('DP = recursion', '而且是不重複計算的聰明 recursion');
  await beat(tok, 2800);
  const td = box('top-down：memoization', C.blue, -3.2, 4.6, 4.2, 0.6, 0.45, 1.0);
  const bu = box('bottom-up：填 table', C.teal, 3.2, 4.6, 4.2, 0.6, 0.45, 1.0);
  link([0, 6.8], [-3.2, 4.6], C.brown, 0.5); link([0, 6.8], [3.2, 4.6], C.brown, 0.5);
  say('填 table 只是一種實作', 'memoization 也不必從小填到大');
  await beat(tok, 3000);
  glow(rec, GOLD);
  say('focus 在 recurrence 怎麼寫', 'recurrence 錯了，怎麼填都錯');
  await beat(tok, 3000);
  glow(rec, null); void td; void bu;
  const row = [0, 1, 2, 3, 4].map((k) => box(String(k + 1), C.gray, -4.6 + k * 0.9, 2.2, 0.8, 0.5, 0.4, 1.0));
  for (let k = 0; k < 5; k++) { tint(row[k], C.teal); await beat(tok, 300); }
  say('objects 有固定的 linear order', '先試 DP');
  await beat(tok, 2400);
  const tsp = [0, 1, 2, 3, 4].map((k) => box('c' + (k + 1), C.red, 1.4 + k * 0.9, 2.2, 0.8, 0.5, 0.4, 1.0));
  for (let r = 0; r < 3; r++) {
    const perm = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    perm.forEach((p, k) => move(tsp[p], 1.4 + k * 0.9, 2.2, 0));
    await beat(tok, 700);
  }
  say('TSP 的城市可以任意打亂', '沒有 linear order → 子問題 exponential');
  await beat(tok, 3000);
}]);
  }

  // ═══ dpjiang2.js ═══
  {
// ─── 交大江蕙如 Lec18 Dynamic Programming (2/3)：dkmxHij2pfU ───
// 只用 K 與 ctx（say / beat）。老師的例子（Kleinberg & Tardos 6.4、6.8）：
// Subset Sum：W = 15、物品 12 1 2 1 4 → 12 + 2 + 1 = 15；反例 W = 11、物品 1 2 5 6 7：大的先 7+2+1 = 10、小的先 1+2+5 = 8、最佳 5+6 = 11；
// OPT(i) 只有一個變數不夠（放 12 kg 後只剩 3 kg）→ OPT(i, w)；填表 M[0..5][0..11]，M[5][11] = max(11, 7 + M[4][4] = 3) = 11；O(nW) pseudo-polynomial。
// Knapsack：價值 1 6 18 22 28，貪心先偷最貴 28+6+1 = 35，最佳 18+22 = 40；wᵢ 改成 vᵢ；0/1 vs fractional；bin packing。
// Bellman-Ford：Dijkstra 反例 s→t 1、s→a 2、a→b 3、b→t −6（正解 s-a-b-t = −1）；全部 +6 仍錯；negative cycle；simple path ≤ n−1 條邊；
// OPT(i, v) = v 到 t 最多 i 條邊；課本圖 t a b c d e，表格最後一欄 0 −6 −2 3 0 0；a 的路徑 a→b→e→c→t = −6；O(nm)。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#e6dccb', gold: '#c08a1f', brown: '#6e5f49' };
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
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

// ════════════════ dkmxHij2pfU（交大江蕙如 Lec18：Subset Sum、Knapsack、Bellman-Ford） ════════════════

// 01:40 Subset Sum：W = 15，物品 12 1 2 1 4 → 12 + 2 + 1 = 15
FRAG.push(['dpjiang2-subset-def', 'Subset Sum：包包限重 W，塞越滿越好', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  say('Subset Sum：21 個 NPC 之一', 'Karp 列出的難題，DP 卻能解得不錯');
  await beat(tok, 2800);
  const B = bag(-3.6, 0.6, 15, 0.36, 'W = 15 kg');
  say('一個包包：限重 W = 15', '超過就破掉');
  await beat(tok, 2400);
  const ws = [12, 1, 2, 1, 4], xs = [0.6, 2.0, 3.2, 4.4, 5.6], it = [];
  ws.forEach((w, k) => {
    it.push(box(w, ICOL[k], xs[k], 0.6 + w * 0.36 / 2, 1.0, w * 0.36, 0.8, 1.6));
    tag('w=' + w, 'idx', xs[k], 0.2);
  });
  say('旁邊 n 個 item，各重 wᵢ', '12、1、2、1、4 公斤');
  await beat(tok, 2600);
  say('目標：選一些塞進去', 'max Σ wᵢ，且 Σ wᵢ ≤ W');
  await beat(tok, 2800);
  for (const k of [0, 2, 1]) { fly(it[k], V3(0, 4, 2)); put(B, ws[k], ICOL[k], ws[k]); await beat(tok, 900); }
  glow(B.items[0], GREEN); glow(B.items[1], GREEN); glow(B.items[2], GREEN);
  txt(B.l, '12 + 2 + 1 = 15');
  say('眼睛看：12 + 2 + 1', '剛好 15 kg：塞滿又不破');
  await beat(tok, 3000);
}]);

// 05:02 Greedy 反例：W = 11，物品 1 2 5 6 7
FRAG.push(['dpjiang2-subset-greedy', 'Greedy 反例：W = 11，大的先只得 10', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const xs = [-3, -1.5, 0, 1.5, 3];
  IW.forEach((w, k) => { box(w, ICOL[k], xs[k], 7.4, 1.0, 0.6, 0.6, 1.2); });
  tag('item 重量', 'idx', -4.6, 7.4);
  say('W = 11，五個 item', '重量 1、2、5、6、7');
  await beat(tok, 2600);
  const u = 0.4;
  const B1 = bag(-4.2, 0.4, 11, u, '大的先'), B2 = bag(0, 0.4, 11, u, '小的先'), B3 = bag(4.2, 0.4, 11, u, '最佳解');
  const run = async (B, order, name) => {
    let sum = 0;
    for (const k of order) {
      const w = IW[k];
      if (sum + w <= 11) { put(B, w, ICOL[k], w); sum += w; say(name + '：放 ' + w, '剩 ' + (11 - sum) + ' kg'); }
      else say(name + '：' + w + ' 放不下', sum + ' + ' + w + ' > 11');
      await beat(tok, 900);
    }
    return sum;
  };
  const s1 = await run(B1, [4, 3, 2, 1, 0], '大的先');
  txt(B1.l, '7+2+1 = ' + s1);
  B1.items.forEach((m) => glow(m, RED));
  say('greedy（大的先）只得 10', '7 放進去後只剩 4 kg');
  await beat(tok, 2600);
  const s3 = await run(B3, [2, 3], '最佳');
  txt(B3.l, '5+6 = ' + s3);
  B3.items.forEach((m) => glow(m, GREEN));
  say('最佳解：5 + 6 = 11', '剛好塞滿');
  await beat(tok, 2400);
  const s2 = await run(B2, [0, 1, 2, 3, 4], '小的先');
  txt(B2.l, '1+2+5 = ' + s2);
  B2.items.forEach((m) => glow(m, RED));
  say('倒過來小的先：1+2+5 = 8', 'greedy 都得不到最佳解');
  await beat(tok, 3000);
}]);

// 07:17 Optimization problem：objective function + constraints
FRAG.push(['dpjiang2-opt-form', '最佳化問題 = objective function + constraints', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  say('DP 的 programming', '= mathematical programming（最佳化）');
  await beat(tok, 2600);
  const t1 = tag('Objective function：max 或 min', 'ptr', -3.2, 8.0);
  say('第一部分：objective', '評分函數：越大越好或越小越好');
  await beat(tok, 2600);
  const t2 = tag('Constraints：圍出 solution space', 'ptr', 3.2, 8.0);
  const poly = [[-4, 1.2], [1.5, 1.2], [3.2, 4.0], [0.5, 6.6], [-4, 5.2]];
  const ls = poly.map((p, k) => { const q = poly[(k + 1) % poly.length]; return line(p[0], p[1], q[0], q[1], 0, C.brown); });
  const pts = [[-3, 2], [-1.5, 3.5], [0, 2.5], [1.2, 4.6], [-2.5, 4.6], [0.3, 5.8], [4.5, 2.5], [5.2, 6.2], [-5.6, 7], [4.2, 6.8]];
  const inside = (k) => k < 6;
  const dots = pts.map((p, k) => box('', inside(k) ? C.teal : GRAY, p[0], p[1], 0.35, 0.35, 0.35, 1.0));
  say('第二部分：constraints', '合理解只能落在圍出的空間裡');
  await beat(tok, 3000);
  pts.forEach((p, k) => { if (!inside(k)) fly(dots[k]); });
  say('不合 constraint 的解丟掉', '在合理解裡挑 objective 最好的');
  await beat(tok, 2400);
  glow(dots[5], GOLD); tint(dots[5], C.gold);
  say('Subset Sum 的寫法', 'max Σ_{i∈S} wᵢ  s.t.  Σ_{i∈S} wᵢ ≤ W');
  await beat(tok, 3200);
  ls.forEach(kill); dots.forEach(kill); txt(t1, '一次式（含常數）→ Linear Programming'); txt(t2, '二次式 → Quadratic Programming');
  tag('更高次 → Non-linear Programming', 'ptr alt', 0, 5.6);
  say('依式子的次數分類', 'LP、QP、Non-linear');
  await beat(tok, 3200);
}]);

// 11:46 第一版：OPT(i) = 前 i 個 item 的最佳解；第 n 個 item 選或不選
FRAG.push(['dpjiang2-subset-cases', '第一版：OPT(i)，第 n 個 item 選或不選', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const lbl = ['1', '2', '3', '…', 'n−1', 'n'], it = [];
  lbl.forEach((s, k) => it.push(box(s, k === 5 ? C.orange : C.blue, -4 + k * 1.6, 7.0, 1.2, 0.7, 0.6, 1.2)));
  say('DP 的想法 = 數學歸納法', 'item 隨意編號 1 … n');
  await beat(tok, 2600);
  const ov = ghostBox(C.teal, 1, 1.0, 1.0);
  for (let i = 1; i <= 6; i++) {
    const w = i * 1.6; ov.scale.set(w, 1, 1); ov.position.set(-4 - 0.8 + w / 2, 7.0, 0);
    say('OPT(i)：前 i 個 item', '不讓包包破的最大總重');
    await beat(tok, 450);
  }
  say('目標：OPT(n)', '所有 item 都考慮');
  await beat(tok, 2200);
  glow(it[5], GOLD);
  say('看最後一個 item n', '最佳解 O 只有兩種 case');
  await beat(tok, 2400);
  const c1 = box('case 1：n ∉ O', C.purple, -3.2, 4.6, 3.6, 0.8, 0.6, 1.4);
  link([1.2, 6.6], [-3.2, 5.0], C.brown);
  say('case 1：不選 n', 'OPT(n) = OPT(n−1)');
  tag('OPT(n) = OPT(n−1)', 'ptr', -3.2, 3.6);
  await beat(tok, 3000);
  const c2 = box('case 2：n ∈ O', C.orange, 3.2, 4.6, 3.6, 0.8, 0.6, 1.4);
  link([4.0, 6.6], [3.2, 5.0], C.brown);
  tag('OPT(n) = wₙ + OPT(n−1)', 'ptr', 3.2, 3.6);
  say('case 2：選 n，貢獻 wₙ', '剩下由前 n−1 個貢獻');
  await beat(tok, 3000);
  glow(c2, RED);
  const q = tag('？少考慮了什麼', 'ptr alt', 3.2, 2.6);
  say('這樣寫對嗎？', '有同學表情怪怪的……');
  await beat(tok, 3000);
}]);

// 18:01 問題：放進 wₙ 會吃掉容量 → OPT(i, w)
FRAG.push(['dpjiang2-subset-2var', '放進 12 kg 只剩 3 kg：多加一個變數 w', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const B = bag(-3.6, 0.5, 15, 0.38, 'W = 15');
  say('放進第 n 個 item', '它會不會吃掉容量？');
  await beat(tok, 2400);
  const m = put(B, 12, C.orange, 12);
  await beat(tok, 1200);
  const rest = ghostBox(C.teal, 1.7, 3 * 0.38, 1.4); rest.position.set(-3.6, 0.5 + 12 * 0.38 + 1.5 * 0.38, 0);
  txt(B.l, '只剩 3 kg');
  say('15 kg 的包包放進 12 kg', '剩下的人只能塞 3 kg');
  await beat(tok, 2800);
  const wrong = tag('OPT(n−1) 卻還以為有 15 kg', 'ptr', 2.6, 6.6);
  glow(m, RED);
  say('第一版沒考慮容量變化', 'available = W − wₙ');
  await beat(tok, 3000);
  glow(m, null);
  txt(wrong, 'capacity 也是變數！');
  say('OPT(i) 的定義太窄', '答案不只跟 i 有關，也跟 w 有關');
  await beat(tok, 2800);
  // the 2-D subproblem grid
  for (let i = 0; i < 4; i++) for (let w = 0; w < 6; w++) box('', C.paper, 0.6 + w * 0.95, 1.2 + i * 0.8, 0.8, 0.6, 0.2, 0, -0.2);
  tag('w →', 'idx', 6.4, 1.2);
  tag('i ↑', 'idx', 0.0, 4.4);
  txt(wrong, 'OPT(i, w)');
  say('OPT(i, w)：前 i 個、容量 w', 'max Σ wⱼ，且 Σ wⱼ ≤ w');
  await beat(tok, 3000);
  tag('case 2：wₙ + OPT(n−1, W − wₙ)', 'ptr alt', 2.8, 5.4);
  say('第二個參數記住剩多少空間', '修正後 recurrence 就對了');
  await beat(tok, 3200);
}]);

// 22:21 完整 recurrence：邊界、wᵢ > w 跳過、max
FRAG.push(['dpjiang2-subset-recur', 'OPT(i, w) 的 recurrence：0／跳過／max', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const cd = code([
    'OPT(i,w) = 0                      if i = 0 or w = 0',
    '         = OPT(i-1, w)            if w_i > w',
    '         = max( OPT(i-1, w),',
    '                w_i + OPT(i-1, w - w_i) )   otherwise',
  ], 0, 8.0, 0.55);
  say('把 w 放進來重寫兩個 case', '對任何第 i 個 item 都成立');
  await beat(tok, 2600);
  const X = (w) => -3.4 + w * 0.95, Y = (i) => 1.0 + i * 0.85;
  for (let i = 0; i <= 3; i++) for (let w = 0; w <= 7; w++) box('', i === 0 || w === 0 ? C.sand : C.paper, X(w), Y(i), 0.8, 0.62, 0.2, 0, -0.2);
  tag('i', 'idx', X(0) - 0.9, Y(3)); tag('w →', 'idx', X(7) + 0.9, Y(0));
  cd.hl(0);
  say('邊界：沒 item 或沒空間', 'i = 0 或 w = 0 → 0');
  await beat(tok, 2800);
  const cur = ghostBox(C.gold, 0.95, 0.75, 0.6); cur.position.set(X(2), Y(3), 0);
  cd.hl(1);
  say('item 太大：wᵢ > w', '塞不進去 → skip，承接 OPT(i−1, w)');
  const a0 = link([X(2), Y(2), 0.3], [X(2), Y(3), 0.3], C.teal, 0.3);
  await beat(tok, 3000);
  kill(a0);
  cur.position.set(X(6), Y(3), 0);
  cd.hl(2);
  const a1 = link([X(6), Y(2), 0.3], [X(6), Y(3), 0.3], C.teal, 0.3);
  say('case 1：item i 不放', 'OPT(i−1, w)：正上方那格');
  await beat(tok, 2800);
  cd.hl(3);
  const a2 = link([X(2), Y(2), 0.3], [X(6), Y(3), 0.3], C.gold, 0.35);
  tag('w − wᵢ', 'idx', X(2), Y(2) - 0.55);
  say('case 2：item i 放進去', 'wᵢ + OPT(i−1, w − wᵢ)');
  await beat(tok, 3000);
  cd.hl(-1);
  say('兩個 case 取大的', 'max：誰的 quality 好選誰');
  await beat(tok, 3000);
}]);

// 30:40 Bottom-up 實作：開表 M[0..n][0..W]，第 1–4 行邊界，5–10 行填表
FRAG.push(['dpjiang2-subset-code', 'Bottom-up 實作：for loop 填表 M[i][w]', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.8, 0]);
  const cd = code([
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
  ], -3.6, 8.2, 0.52);
  say('bottom-up：由小往大兜', '只要 for loop：就是填表格');
  await beat(tok, 2800);
  const X = (w) => 0.8 + w * 0.8, Y = (i) => 6.8 - i * 0.8;
  for (let i = 0; i <= 5; i++) { tag(i === 5 ? 'n' : String(i), 'idx', X(0) - 0.7, Y(i)); for (let w = 0; w <= 6; w++) box('', C.paper, X(w), Y(i), 0.68, 0.6, 0.2, 0, -0.2); }
  for (let w = 0; w <= 6; w++) tag(w === 6 ? 'W' : String(w), 'idx', X(w), 7.55);
  cd.hl(1);
  say('1–2 行：i = 0 那一列', '沒有 item → 0');
  for (let w = 0; w <= 6; w++) { box(0, C.sand, X(w), Y(0), 0.56, 0.48, 0.35, 0.9); await beat(tok, 160); }
  await beat(tok, 1000);
  cd.hl(3);
  say('3–4 行：w = 0 那一欄', '沒有空間 → 0');
  for (let i = 1; i <= 5; i++) { box(0, C.sand, X(0), Y(i), 0.56, 0.48, 0.35, 0.9); await beat(tok, 180); }
  await beat(tok, 1000);
  const cur = ghostBox(C.gold, 0.78, 0.72, 0.6);
  for (let i = 1; i <= 2; i++) for (let w = 1; w <= 6; w++) {
    cur.position.set(X(w), Y(i), 0);
    cd.hl(IW[i - 1] > w ? 7 : 9);
    say('5–10 行：一列一列由左往右', IW[i - 1] > w ? 'wᵢ > w：抄上面' : 'max(上面, wᵢ + 左上某格)');
    box('', C.teal, X(w), Y(i), 0.56, 0.48, 0.35, 0.9);
    await beat(tok, 380);
  }
  cd.hl(-1);
  say('每格只查上一列：早就填好了', '從小到大填，查的值一定 ready');
  await beat(tok, 3200);
}]);

// 36:06 例子：W = 11，物品 1 2 5 6 7 → 填表，M[5][11] = 11，倒推 5 + 6
FRAG.push(['dpjiang2-subset-table', '填表：W = 11、重量 1 2 5 6 7 → 11', async (tok) => {
  fresh([0, 4.2, 15], [0, 3.8, 0]);
  const M = ssTable(IW);
  const X = (w) => -5.0 + w * 0.95, Y = (i) => 7.3 - i * 0.95;
  for (let w = 0; w <= 11; w++) tag(String(w), 'idx', X(w), 8.1);
  const rl = ['{ }', '{1}', '{1,2}', '{1,2,5}', '{…,6}', '{…,7}'];
  const cell = [];
  for (let i = 0; i <= 5; i++) { tag(rl[i], 'idx', X(0) - 1.2, Y(i)); cell[i] = []; for (let w = 0; w <= 11; w++) box('', C.paper, X(w), Y(i), 0.82, 0.7, 0.2, 0, -0.2); }
  say('開 (n+1) × (W+1) 的表', 'w = 0 … 11；item 前 0 … 5 個');
  await beat(tok, 2800);
  for (let i = 0; i <= 5; i++) {
    for (let w = 0; w <= 11; w++) cell[i][w] = box(M[i][w], i === 0 || w === 0 ? C.sand : C.teal, X(w), Y(i), 0.7, 0.55, 0.4, 1.0);
    say(i === 0 ? '先填邊界 0' : '加入重量 ' + IW[i - 1] + ' 的 item', i === 0 ? 'i = 0 或 w = 0 → 0' : '第 ' + i + ' 列：M[' + i + '][11] = ' + M[i][11]);
    await beat(tok, i === 0 ? 1400 : 1100);
  }
  glow(cell[5][11], GOLD);
  say('答案：M[5][11] = 11', '怎麼來的？item 5 重 7');
  await beat(tok, 2600);
  glow(cell[4][11], GOLD);
  say('case 1：不放 7 → 查正上方', 'M[4][11] = 11');
  await beat(tok, 2600);
  glow(cell[4][4], GOLD);
  say('放 7：剩 11 − 7 = 4', '7 + M[4][4] = 7 + 3 = 10');
  await beat(tok, 3000);
  glow(cell[4][4], null);
  say('max(11, 10) = 11', '承接上面的 11');
  await beat(tok, 2400);
  [[5, 11], [4, 11], [3, 5], [2, 0]].forEach(([i, w]) => glow(cell[i][w], GREEN));
  glow(cell[3][11], RED);
  say('一路倒推：6 和 5 有放', 'M[4][11] ≠ M[3][11] → 放 6；M[3][5] → 放 5');
  await beat(tok, 3400);
}]);

// 40:30 O(nW)：pseudo-polynomial；n = 10、W = 10⁷
FRAG.push(['dpjiang2-pseudo', 'O(nW) 是 pseudo-polynomial：W 不是 input size', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const g = ghostBox(C.teal, 3.0, 1.8, 0.6); g.position.set(-3.2, 6.0, 0);
  const lb = tag('(n+1) × (W+1) 格', 'ptr', -3.2, 7.4);
  say('每格 O(1)：assign、抄、比大小', '重點是填了幾格');
  await beat(tok, 2800);
  say('格子數 (n+1)(W+1)', 'running time O(nW)');
  await beat(tok, 2600);
  const t2 = tag('看起來像多項式？', 'ptr alt', 3.2, 6.0);
  say('看起來像多項式？', '不是！W 不是 input size');
  await beat(tok, 2800);
  txt(t2, 'n = input size；W 只是參數');
  say('input size 是 n 個 item', 'W 只是 input 的一個參數');
  await beat(tok, 2600);
  txt(lb, 'n = 10，W = 10⁷');
  say('例：只有 10 個 item', '但 W = 1000 萬');
  await anim(tok, 1800, (k) => { g.scale.set(1 + k * 3.4, 0.6 + 0.4 * (1 - k), 1); g.position.x = -3.2 + k * 3.2; });
  tag('10,000,001 個 column', 'ptr', 0, 4.6);
  say('要開 10⁷ + 1 個 column', '而且要填到最後一格才有答案');
  await beat(tok, 3000);
  txt(t2, 'pseudo-polynomial（假的多項式）');
  say('所以叫 pseudo-polynomial', 'W 很大時 DP 效果並不好');
  await beat(tok, 3200);
}]);

// 44:12 Knapsack：小偷、vᵢ；greedy 先偷最值錢 → 35，最佳 18 + 22 = 40
FRAG.push(['dpjiang2-knap-greedy', 'Knapsack：先偷最值錢只得 35，最佳 40', async (tok) => {
  fresh([0, 4.2, 14.5], [0, 3.8, 0]);
  const xs = [-3.2, -1.6, 0, 1.6, 3.2];
  IW.forEach((w, k) => { box('$' + IV[k], ICOL[k], xs[k], 7.5, 1.2, 0.6, 0.6, 1.2); tag(w + ' kg', 'idx', xs[k], 6.9); });
  say('Knapsack：小偷背包包行竊', '每個 item 有重量 wᵢ、價值 vᵢ');
  await beat(tok, 2800);
  say('constraint 一樣：不能破', 'objective 改成 max Σ vᵢ');
  await beat(tok, 2800);
  const u = 0.4;
  const B1 = bag(-3.2, 0.3, 11, u, 'greedy：最值錢先'), B2 = bag(3.2, 0.3, 11, u, '最佳解');
  let sum = 0, val = 0;
  for (const k of [4, 3, 2, 1, 0]) {
    if (sum + IW[k] <= 11) { put(B1, IW[k], ICOL[k], '$' + IV[k]); sum += IW[k]; val += IV[k]; say('偷 $' + IV[k] + '（' + IW[k] + ' kg）', '剩 ' + (11 - sum) + ' kg，總價 ' + val); }
    else say('$' + IV[k] + ' 重 ' + IW[k] + '：塞不下', sum + ' + ' + IW[k] + ' > 11');
    await beat(tok, 1000);
  }
  txt(B1.l, '28 + 6 + 1 = 35');
  B1.items.forEach((m) => glow(m, RED));
  say('greedy 得 35', '先偷最貴的 28 就只剩 4 kg');
  await beat(tok, 2600);
  put(B2, 5, ICOL[2], '$18'); await beat(tok, 700); put(B2, 6, ICOL[3], '$22'); await beat(tok, 700);
  txt(B2.l, '18 + 22 = 40');
  B2.items.forEach((m) => glow(m, GREEN));
  say('最佳解：18 + 22 = 40', 'greedy 不保證最佳解');
  await beat(tok, 3200);
}]);

// 48:46 Knapsack 的 recurrence：只把 wᵢ 改成 vᵢ
FRAG.push(['dpjiang2-knap-recur', 'Knapsack recurrence：把 wᵢ 改成 vᵢ 就好', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const cd = code([
    'OPT(i,w) = 0                      if i = 0 or w = 0',
    '         = OPT(i-1, w)            if w_i > w',
    '         = max( OPT(i-1, w),',
    '                w_i + OPT(i-1, w - w_i) )',
  ], 0, 7.6, 0.6);
  tag('Subset Sum', 'ptr', -4.6, 8.4);
  say('先看 Subset Sum 的版本', '邊界、太大跳過、一般 case');
  await beat(tok, 2800);
  cd.hl(0);
  say('邊界兩行不用改', '沒東西偷或沒帶包包 → 0');
  await beat(tok, 2600);
  cd.hl(1);
  say('太重塞不下：也不用改', '承接 OPT(i−1, w)');
  await beat(tok, 2600);
  cd.hl(2);
  say('OPT(i, w) 改成最高總價值', '不放 item i：照抄');
  await beat(tok, 2600);
  cd.hl(3);
  const hi = tag('w_i →', 'ptr alt', -4.0, 7.6 - 3 * 0.6);
  say('只改一個地方？', '放進去的貢獻是價值，不是重量');
  await beat(tok, 2600);
  txt(cd.ls[3], cd.ls[3].element.textContent.replace('w_i +', 'v_i +'));
  txt(hi, 'v_i ✓');
  say('wᵢ 改成 vᵢ，其他都不動', '容量仍扣 w − wᵢ');
  await beat(tok, 3000);
  cd.hl(-1);
  const r = box('M[5][11] = 40', C.teal, 0, 3.4, 3.2, 0.7, 0.6, 1.4);
  say('補充：代回剛剛的例子', 'max(M[4][11] = 40, 28 + M[4][4] = 35) = 40');
  await beat(tok, 3400);
}]);

// 53:17 0/1 knapsack vs fractional knapsack；O(nW) 仍是 pseudo-polynomial
FRAG.push(['dpjiang2-knap-frac', '0/1 Knapsack vs Fractional Knapsack', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  tag('0/1 knapsack', 'ptr', -3.4, 7.8);
  tag('fractional knapsack', 'ptr', 3.4, 7.8);
  const a = box('$18', ICOL[2], -4.4, 6.0, 1.3, 1.0, 0.8, 1.2), b = box('$22', ICOL[3], -2.4, 6.0, 1.3, 1.0, 0.8, 1.2);
  say('0/1：每個 item 選或不選', '只有 yes / no 兩種');
  await beat(tok, 2600);
  move(a, -3.4, 2.4, 0); fly(b);
  tag('全拿 ✓ / 不拿 ✓ / 拿一半 ✗', 'idx', -3.4, 1.4);
  await beat(tok, 2400);
  const br = box('麵包', C.sand, 3.4, 6.0, 1.6, 1.0, 0.8, 1.2);
  say('fractional：可以拿一部分', '麵包剝一半、米不用整包');
  await beat(tok, 2600);
  br.scale.set(0.5, 1, 1); br.position.x = 2.95;
  const half = box('½', C.sand, 3.85, 6.0, 0.8, 1.0, 0.8, 0);
  move(half, 3.4, 2.4, 0);
  tag('可以拿比例', 'idx', 3.4, 1.4);
  await beat(tok, 2400);
  const s1 = tag('DP：最佳解', 'ptr alt', -3.4, 4.4), s2 = tag('greedy 就能最佳解', 'ptr alt', 3.4, 4.4);
  say('0/1 → DP；fractional → greedy', '補充：依 vᵢ / wᵢ 由大到小拿');
  await beat(tok, 3200);
  say('Knapsack DP：O(nW)', '一樣是 pseudo-polynomial');
  await beat(tok, 3000);
}]);

// 55:47 Bin packing：卡車越少越好，NP-complete
FRAG.push(['dpjiang2-binpack', 'Bin packing：用最少的卡車裝完', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  say('變形：bin packing', '物流公司要送 n 個包裹');
  await beat(tok, 2400);
  const sz = [0.9, 1.6, 0.7, 1.2, 1.0, 0.5, 1.4, 0.8];
  const it = sz.map((h, k) => box('', [C.teal, C.blue, C.purple, C.orange, C.pink, C.sand, C.red, C.gold][k], -5.6 + k * 1.6, 7.2, 1.0, h * 0.6, 0.8, 1.2));
  say('每個 item 有不同體積', '每輛卡車容量相同');
  await beat(tok, 2600);
  const T = [-4, 0, 4].map((x, k) => { const g = ghostBox(C.brown, 2.2, 3.0, 1.4); g.position.set(x, 2.1, 0); tag('卡車 ' + (k + 1), 'ptr', x, 4.1); return { x, used: 0 }; });
  const plan = [0, 0, 1, 0, 1, 2, 1, 2];
  for (let k = 0; k < sz.length; k++) {
    const t = T[plan[k]], h = sz[k] * 0.6;
    move(it[k], t.x, 0.65 + t.used + h / 2, 0); t.used += h;
    say('把 item assign 給卡車', '不能超過卡車容量');
    await beat(tok, 600);
  }
  say('目標：卡車數越少越好', 'minimize 使用的 bin 數');
  await beat(tok, 2800);
  say('跟 subset sum 一樣', 'bin packing 也是 NP-complete');
  await beat(tok, 3000);
}]);

// 57:19 Bellman-Ford 由來；shortest path 定義；Dijkstra 遇到負邊會錯
FRAG.push(['dpjiang2-dijkstra-neg', 'Dijkstra 遇到 −6：回報 1，正解 −1', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const P = { s: [-4.6, 3.0], a: [-1.6, 6.6], b: [1.6, 6.6], t: [4.6, 3.0] };
  const N = {};
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 't' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.5, 1.2);
  const ed = [['s', 't', 1], ['s', 'a', 2], ['a', 'b', 3], ['b', 't', -6]];
  const E = {};
  const off = { st: [0, -0.4], sa: [-0.4, 0.3], ab: [0, 0.4], bt: [0.45, 0.3] };
  for (const [u, v, w] of ed) { E[u + v] = link([...P[u], 0], [...P[v], 0], C.brown, 0.5); tag(String(w), 'idx', (P[u][0] + P[v][0]) / 2 + off[u + v][0], (P[u][1] + P[v][1]) / 2 + off[u + v][1]); }
  say('Shortest path：s 到 t 最短', '路徑長 = Σ c_uv（經過的邊）');
  await beat(tok, 3000);
  say('Dijkstra 的限制', '每條 c_uv 必須 ≥ 0');
  await beat(tok, 2600);
  glow(N.s, GOLD);
  const d = { s: tag('0', 'ptr', P.s[0], P.s[1] + 0.8) };
  say('Dijkstra 從 s 出發', 'd(s) = 0');
  await beat(tok, 2000);
  d.t = tag('1', 'ptr', P.t[0], P.t[1] + 0.8); d.a = tag('2', 'ptr', P.a[0], P.a[1] + 0.8);
  say('鄰居：t 是 1、a 是 2', '取最小的 t');
  await beat(tok, 2400);
  glow(N.t, RED); E.st.setColor(new THREE.Color(C.red));
  say('t 被定案：d(t) = 1', 'greedy：定案後不再回頭');
  await beat(tok, 3000);
  ['sa', 'ab', 'bt'].forEach((k) => E[k].setColor(new THREE.Color(C.teal)));
  E.st.setColor(new THREE.Color(C.brown)); glow(N.t, GREEN);
  txt(d.t, '−1');
  say('正解：s → a → b → t', '2 + 3 − 6 = −1 < 1');
  await beat(tok, 3200);
  say('有負邊 Dijkstra 會出錯', '前面走得長、後面大轉彎它看不到');
  await beat(tok, 3000);
}]);

// 63:20 Naive reweighting：每條邊 +6 → Dijkstra 仍選 s→t；邊數不同、加的量不同
FRAG.push(['dpjiang2-reweight', '每條邊都 +6？邊數不同，加的量不同', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const P = { s: [-4.6, 3.0], a: [-1.6, 6.6], b: [1.6, 6.6], t: [4.6, 3.0] };
  const N = {};
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 't' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.5, 1.2);
  const ed = [['s', 't', 1, 0, -0.4], ['s', 'a', 2, -0.4, 0.3], ['a', 'b', 3, 0, 0.4], ['b', 't', -6, 0.45, 0.3]];
  const E = {}, L = {};
  for (const [u, v, w, ox, oy] of ed) { E[u + v] = link([...P[u], 0], [...P[v], 0], C.brown, 0.5); L[u + v] = tag(String(w), 'idx', (P[u][0] + P[v][0]) / 2 + ox, (P[u][1] + P[v][1]) / 2 + oy); }
  say('想法：把負的修成非負', '最負的是 −6 → 每條邊 +6');
  await beat(tok, 3000);
  for (const [u, v, w] of ed) { txt(L[u + v], String(w + 6)); L[u + v].element.className = 'lab-label ptr alt'; }
  say('全部往上 shift 6', '1→7、2→8、3→9、−6→0');
  await beat(tok, 3000);
  E.st.setColor(new THREE.Color(C.red)); glow(N.t, RED);
  const p1 = tag('s→t：7（1 條邊，+6）', 'ptr', 0, 1.6);
  const p2 = tag('s→a→b→t：17（3 條邊，+18）', 'ptr', 0, 0.8);
  say('非負了，跑 Dijkstra', '還是選 s→t：7 < 17，錯！');
  await beat(tok, 3200);
  say('為什麼錯？', '每條 path 經過的 edge 數不一樣');
  await beat(tok, 2800);
  say('邊多的 path 加得多', '原本 1 vs −1，shift 後 7 vs 17');
  await beat(tok, 3000);
  txt(p1, 'Johnson：聰明的 reweighting（本課不講）');
  txt(p2, 'Bellman-Ford：DP，induction 在 edge 數');
  say('單純 shift 沒用', '改用 DP：Bellman-Ford');
  await beat(tok, 3200);
}]);

// 67:27 不考慮 negative cycle；沒有 negative cycle → 最短路徑是 simple path → 最多 n−1 條邊
FRAG.push(['dpjiang2-simple-path', '無 negative cycle：最短路徑是 simple，≤ n−1 條邊', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const s = box('s', C.teal, -5.2, 6.4, 0.7, 0.7, 0.5, 1.0), t = box('t', C.orange, 5.2, 6.4, 0.7, 0.7, 0.5, 1.0);
  const cyc = [[-1.2, 6.4], [0, 7.6], [1.2, 6.4], [0, 5.2]];
  const cn = cyc.map((p) => box('', C.blue, p[0], p[1], 0.5, 0.5, 0.4, 1.0));
  link([-5.2, 6.4], [-1.2, 6.4]); link([1.2, 6.4], [5.2, 6.4]);
  cyc.forEach((p, k) => link([...p, 0], [...cyc[(k + 1) % 4], 0], C.red, 0.35));
  tag('cycle cost < 0', 'ptr', 0, 8.4);
  say('若有 negative cycle', '每繞一圈 cost 就往下降');
  const dot = box('', C.gold, -1.2, 6.4, 0.3, 0.3, 0.3);
  await anim(tok, 2400, (k) => { const a = Math.PI - k * 4 * Math.PI; dot.position.set(Math.cos(a) * 1.2, 6.4 + Math.sin(a) * 1.2, 0.35); });
  say('永遠不想出來：沒有最短', '所以只討論沒有 negative cycle 的圖');
  await beat(tok, 2800);
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const P = { s: [-5, 4.4], v: [-1, 4.4], t: [5, 4.4] };
  box('s', C.teal, P.s[0], P.s[1], 0.7, 0.7, 0.5); const vv = box('v', C.blue, P.v[0], P.v[1], 0.7, 0.7, 0.5); box('t', C.orange, P.t[0], P.t[1], 0.7, 0.7, 0.5);
  link([...P.s, 0], [...P.v, 0]); const vt = link([...P.v, 0], [...P.t, 0]);
  const loop = [[-1, 4.4], [0.4, 6.2], [-1, 7.4], [-2.4, 6.2]];
  const lp = [];
  for (let k = 0; k < 4; k++) lp.push(link([...loop[k], 0], [...loop[(k + 1) % 4], 0], C.gold, k === 0 || k === 3 ? 0.35 : 0.05));
  const lb = tag('cycle ≥ 0', 'ptr alt', -1, 8.0);
  say('反證：假設最短 P 不 simple', 'P 重複經過 v：中間有個 cycle');
  await beat(tok, 3200);
  say('沒有 negative cycle', '→ 這個 cycle 的總和 ≥ 0');
  await beat(tok, 2600);
  lp.forEach(kill); txt(lb, '砍掉 cycle → Q');
  glow(vv, GREEN);
  say('把 cycle 砍掉得到 Q', 'cost(Q) ≤ cost(P)');
  await beat(tok, 3000);
  say('所以一定有 simple 的最短路徑', 'simple：不重複經過同一點');
  await beat(tok, 2600);
  txt(lb, 'n 個點 → 最多 n−1 條 edge');
  say('n 個點全踩過', '也只有 n−1 條 edge');
  await beat(tok, 3000);
}]);

// 73:47 Bellman-Ford：induction 在 edge 數；OPT(i, v) = v 到 t 最多 i 條邊
FRAG.push(['dpjiang2-bf-def', 'OPT(i, v)：v 到 t、最多 i 條 edge 的最短距離', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const G = bfGraph(0, 4.2, 1, 1.0);
  say('Bellman-Ford：對 edge 數歸納', '1 條、2 條……到 n−1 條');
  await beat(tok, 3000);
  const T = tag('固定終點 t（課本）', 'ptr', G.P.t[0], G.P.t[1] + 0.9);
  say('課本固定終點 t', '別本書固定起點 s：對稱，一樣');
  await beat(tok, 2800);
  const info = tag('', 'ptr alt', 0, 8.2);
  const lv = [['t'], ['a', 'c', 'd', 'e'], ['b']];
  for (let i = 0; i <= 2; i++) {
    lv[i].forEach((v) => { glow(G.N[v], GOLD); tint(G.N[v], C.teal); });
    if (i === 1) ['at', 'ct', 'dt', 'et'].forEach((k) => G.E[k].ar.setColor(new THREE.Color(C.teal)));
    if (i === 2) ['bd', 'be'].forEach((k) => G.E[k].ar.setColor(new THREE.Color(C.teal)));
    txt(info, '最多 ' + i + ' 條 edge 能到 t');
    say('最多 i = ' + i + ' 條 edge', i === 0 ? '只有 t 自己' : i === 1 ? '跟 t 直接相連的點' : 'b 要繞一步才到');
    await beat(tok, 2400);
  }
  BFN.forEach((v) => glow(G.N[v], null));
  txt(info, 'OPT(i, v)');
  say('OPT(i, v)', 'v → t、最多 i 條 edge 的最短距離');
  await beat(tok, 3000);
  txt(info, '目標：OPT(n−1, s)');
  say('最短路徑最多 n−1 條 edge', '算到 OPT(n−1, s) 就結束');
  await beat(tok, 3000);
}]);

// 77:25 Recurrence：case 1 少用一條 → OPT(i−1, v)；case 2 先走 (v, w) → c_vw + OPT(i−1, w)
FRAG.push(['dpjiang2-bf-recur', 'OPT(i, v) = min(OPT(i−1, v), min c_vw + OPT(i−1, w))', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  say('對照 Subset Sum', '那邊看最後一個 item 放不放');
  await beat(tok, 2600);
  say('這邊看 edge 數', '用滿 i 條，還是最多 i−1 條就好');
  await beat(tok, 2600);
  const v = box('v', C.blue, -5, 6.6, 0.8, 0.8, 0.5, 1.0), t = box('t', C.orange, 5, 6.6, 0.8, 0.8, 0.5, 1.0);
  const c1 = line(-4.5, 6.6, 4.5, 6.6, 0, C.teal);
  tag('≤ i−1 條 edge', 'ptr', 0, 7.2);
  say('case 1：最多 i−1 條就夠', 'OPT(i, v) = OPT(i−1, v)');
  await beat(tok, 3000);
  const v2 = box('v', C.blue, -5, 3.0, 0.8, 0.8, 0.5, 1.0), t2 = box('t', C.orange, 5, 3.0, 0.8, 0.8, 0.5, 1.0);
  const ws = [[-1.8, 4.6, 'w₁'], [-1.8, 3.0, 'w₂'], [-1.8, 1.4, 'w₃']];
  ws.forEach(([x, y, n]) => { box(n, C.purple, x, y, 0.8, 0.6, 0.5, 1.0); link([-5, 3.0], [x, y], C.gold); line(x + 0.45, y, 4.5, 3.0, 0, C.teal); });
  tag('c_vw', 'idx', -3.6, 4.4); tag('≤ i−1 條', 'idx', 1.6, 4.3);
  say('case 2：剛好用 i 條', '先走第一條 (v, w)：用掉一條');
  await beat(tok, 3000);
  say('後半 w → t 最多 i−1 條', 'c_vw + OPT(i−1, w)');
  await beat(tok, 3000);
  say('w 可能有好幾個：取最小', 'min over (v, w) ∈ E');
  await beat(tok, 2600);
  const cd = code(['OPT(i,v) = 0          if v = t', '         = ∞          if i = 0, v ≠ t', '         = min( OPT(i-1,v), min_w ( c_vw + OPT(i-1,w) ) )'], 0, 0.3, 0.5);
  cd.hl(0);
  say('邊界：自己到自己 = 0', '0 條 edge 又不是 t → ∞');
  await beat(tok, 2800);
  cd.hl(2);
  say('兩個 case 取最小', 'shortest path 要 min');
  await beat(tok, 3000);
}]);

// 84:52 實作：M[i][v]，列是點、欄是 edge 數 0 … n−1；1–3 行邊界、4–6 行 general case
FRAG.push(['dpjiang2-bf-code', 'Bellman-Ford 實作：M 表 = 點 × edge 數', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.8, 0]);
  const cd = code([
    '1 M[0, t] = 0',
    '2 for each v ≠ t',
    '3     M[0, v] = ∞',
    '4 for i = 1 to n-1',
    '5   for each v ∈ V',
    '6     M[i, v] = min( M[i-1, v],',
    '         min_w ( c_vw + M[i-1, w] ) )',
    '7 return M[n-1, s]',
  ], -3.8, 7.8, 0.56);
  say('一樣開一張表 M', '小抄：memoization 的 M table');
  await beat(tok, 2600);
  const G = bfGrid(1.6, 7.0, 0.95, 0.8);
  say('一維：所有點 v', '另一維：edge 數 0 … n−1');
  await beat(tok, 2800);
  cd.hl(0);
  bfFill(G, 't', 0, 0);
  say('第 1 行：t 到 t = 0', '不經過任何 edge');
  await beat(tok, 2200);
  cd.hl(2);
  for (const v of BFN.slice(1)) { bfFill(G, v, 0, Infinity); await beat(tok, 260); }
  say('第 2–3 行：其他點 = ∞', '0 條 edge 走不到 t');
  await beat(tok, 2200);
  cd.hl(5);
  const cur = ghostBox(C.gold, 0.95, 0.8 * 6, 0.6); cur.position.set(G.X(1), G.Y(2.5), 0);
  say('第 4–6 行：一欄一欄往右算', '每格看左邊一欄 + 一條 edge');
  await beat(tok, 3000);
  cd.hl(-1);
  say('適用時機比 Dijkstra 廣', '允許負 edge weight');
  await beat(tok, 2800);
}]);

// 88:35 課本例子：6 個點、最多 5 條 edge；逐欄填表
FRAG.push(['dpjiang2-bf-table', '課本例子：逐欄填 M[i, v]', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const M = bfTable();
  say('有負 edge：不能用 Dijkstra', '終點 t；6 個點 → 最多 5 條 edge');
  await beat(tok, 3000);
  BFN.forEach((v) => bfFill(T, v, 0, M[v][0]));
  say('第 0 欄：t = 0，其他 ∞', '6 × 6 的表');
  await beat(tok, 2600);
  // column 1 with explanations
  const cur = ghostBox(C.gold, 1.0, 0.75, 0.6);
  cur.position.set(T.X(1), T.Y(0), 0);
  bfFill(T, 't', 1, 0);
  say('t 最多 1 條：照抄 0', 't 沒有出邊，沒有 case 2');
  await beat(tok, 2600);
  cur.position.set(T.X(1), T.Y(1), 0);
  G.E.at.ar.setColor(new THREE.Color(C.teal)); glow(G.N.a, GOLD);
  say('a 最多 1 條 edge', 'min(∞, c_at + 0 = −3) = −3');
  await beat(tok, 2600);
  bfFill(T, 'a', 1, M.a[1]); glow(G.N.a, null);
  await beat(tok, 800);
  for (const v of ['b', 'c', 'd', 'e']) { cur.position.set(T.X(1), T.Y(BFN.indexOf(v)), 0); bfFill(T, v, 1, M[v][1]); await beat(tok, 450); }
  glow(T.cell.b1, RED);
  say('第 1 欄 = 直接相連的 edge', 'b 跟 t 沒有 edge → 還是 ∞');
  await beat(tok, 3000);
  glow(T.cell.b1, null);
  for (let i = 2; i <= 5; i++) {
    cur.position.set(T.X(i), T.Y(2.5), 0); cur.scale.set(1, 6, 1);
    BFN.forEach((v) => bfFill(T, v, i, M[v][i]));
    say('依此類推：第 ' + i + ' 欄', '最多 ' + i + ' 條 edge');
    await beat(tok, 1300);
  }
  kill(cur);
  BFN.forEach((v) => glow(T.cell[v + 5], GREEN));
  say('最後一欄：每個點到 t 的最短距離', 't 0、a −6、b −2、c 3、d 0、e 0');
  await beat(tok, 3400);
}]);

// 93:18 每欄只參考左邊一欄 → 只要算值的話一兩個 column 就夠；要還原 path 才需要整張表
FRAG.push(['dpjiang2-bf-space', '每欄只看左邊一欄：只要值就不用 n × n', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const M = bfTable();
  for (let i = 0; i <= 1; i++) BFN.forEach((v) => bfFill(T, v, i, M[v][i], 0));
  say('例：算 M[2, d]', 'd 的出邊：d→a（6）、d→t（4）');
  await beat(tok, 2800);
  glow(T.cell.d1, GOLD); glow(T.cell.a1, GOLD); glow(T.cell.t1, GOLD);
  G.E.da.ar.setColor(new THREE.Color(C.teal)); G.E.dt.ar.setColor(new THREE.Color(C.teal));
  say('只查左邊那欄：D1、A1、T1', 'min(4, 6 + (−3), 4 + 0) = 3');
  await beat(tok, 3200);
  bfFill(T, 'd', 2, M.d[2]);
  BFN.forEach((v) => glow(T.cell[v + 1], null));
  await beat(tok, 1000);
  say('每次 iteration 只看左邊一欄', '不會再往前兩欄以上');
  await beat(tok, 2600);
  BFN.forEach((v) => { if (v !== 'd') bfFill(T, v, 2, M[v][2], 0); });
  BFN.forEach((v) => fly(T.cell[v + 0], V3(0, 4, 3)));
  say('只要最短距離的值', '一個（頂多兩個）column 就夠');
  await beat(tok, 3000);
  say('要還原 path 長相', '才需要整張 n × n 的表');
  await beat(tok, 3000);
}]);

// 95:44 還原 a 到 t 的最短路徑：−6 ← 抄左邊；a→b（−4）+ M[3, b] = −2；→ a b e c t
FRAG.push(['dpjiang2-bf-trace', '倒推 a 的最短路徑：a→b→e→c→t = −6', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  const M = bfTable();
  for (let i = 0; i <= 5; i++) BFN.forEach((v) => bfFill(T, v, i, M[v][i], 0));
  glow(T.cell.a5, GOLD);
  say('找 a 到 t 的最短路徑', 'M[5, a] = −6');
  await beat(tok, 2800);
  glow(T.cell.a4, GOLD);
  say('−6 從哪來？照抄左邊', 'M[4, a] = −6');
  await beat(tok, 2600);
  glow(T.cell.a3, RED);
  say('M[4, a]：抄左邊是 −4', '不是 −4，有更小的');
  await beat(tok, 2600);
  glow(T.cell.a3, null); glow(T.cell.b3, GOLD);
  G.E.ab.ar.setColor(new THREE.Color(C.teal));
  say('走 a→b（−4）再接 M[3, b]', '−4 + (−2) = −6：找到邊 ab');
  await beat(tok, 3000);
  const steps = [['be', 'e2', 'b→e（−2）+ M[2, e] = 0'], ['ec', 'c1', 'e→c（−3）+ M[1, c] = 3'], ['ct', 't0', 'c→t（3）+ M[0, t] = 0']];
  for (const [ek, ck, f] of steps) {
    G.E[ek].ar.setColor(new THREE.Color(C.teal)); glow(T.cell[ck], GOLD);
    say('繼續倒推', f);
    await beat(tok, 2200);
  }
  ['a', 'b', 'e', 'c', 't'].forEach((v) => glow(G.N[v], GREEN));
  say('路徑：a→b→e→c→t', '−4 − 2 − 3 + 3 = −6');
  await beat(tok, 3000);
  say('填表時順便記「來自誰」', '倒走回去就能還原 path');
  await beat(tok, 3000);
}]);

// 99:09 Space O(n²)；naive time O(n³)；細算每欄只看每條 edge 一次 → O(nm)
FRAG.push(['dpjiang2-bf-time', 'Bellman-Ford：space O(n²)、time O(nm)', async (tok) => {
  fresh([0, 4.0, 15], [0, 3.8, 0]);
  const G = bfGraph(-3.9, 4.0, 0.6);
  const T = bfGrid(1.3, 7.0, 1.0, 0.85);
  say('space：表格 n × n', 'O(n²)');
  await beat(tok, 2600);
  say('naive：n² 格 × n−1 個鄰居', 'O(n³)');
  await beat(tok, 3000);
  const cur = ghostBox(C.gold, 1.0, 0.85 * 6, 0.6); cur.position.set(T.X(1), T.Y(2.5), 0);
  const ek = Object.keys(G.E);
  for (const k of ek) { G.E[k].ar.setColor(new THREE.Color(C.teal)); await beat(tok, 260); }
  say('其實每格只看自己的出邊', '一欄加起來 = 每條 edge 看一次');
  await beat(tok, 2800);
  ek.forEach((k) => G.E[k].ar.setColor(new THREE.Color(C.brown)));
  for (let i = 1; i <= 5; i++) { cur.position.x = T.X(i); say('第 ' + i + ' 欄：O(m)', 'm = edge 數'); await beat(tok, 600); }
  say('n 次 iteration × O(m)', 'total O(nm)');
  await beat(tok, 3000);
}]);
  }

  // ═══ dpmit1.js ═══
  {
// ─── MIT 6.006 Fall 2011：OQ5jsbhAv_M（L19 DP I：Fibonacci、Shortest Paths）、ENyox7kNKeY（L20 DP II：只補 blackjack 的 DAG）、
//     wFP5VHGHFdk（Rec21 Knapsack） ───
// 只用 K 與 ctx（say / beat）。老師的例子：naive fib（n ≤ 2 → 1）、T(n) ≥ 2T(n−2) → 2^{n/2}、memo = {}、
// 「Fₙ₋₃ 被切掉、Fₙ₋₂ 整棵子樹消失」、n 次非 memo 呼叫 × Θ(1)、bottom-up for k in range(1, n+1)、只留最後兩個值；
// 猜最後一條邊 δ(s,v) = min δ(s,u) + w(u,v)；有環圖 s→b→a→v→b 無限遞迴；DAG 上 Σ(indeg+1) = V + E；
// 分層 δₖ(s,v) → V² 個子問題、Θ(VE) = Bellman-Ford。BJ(i) → i+4、i+5、i+6，邊權 +1/0/−1，最長路徑，O(n³)。
// Knapsack：S = 5；雕像 (4 磅, $10)、水晶球 (2 磅, $4)、鋼筆 (3 磅, $7) → 答案 $11；圖的節點 (i, w)、邊權 −vᵢ；
// dp(i, j) = max(dp(i+1, j), vᵢ + dp(i+1, j−sᵢ))、dp(3, j) = 0、答案 dp(0, 5)；O(nS) pseudo-polynomial（32 vs 64 bit）；Dijkstra 輸入對照。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const C = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', gold: '#c08a1f', brown: '#6e5f49', cyan: '#31aab0' };
const LV = [C.purple, C.blue, C.cyan, C.orange, C.pink];
const box = (t, c, x, y, w = 0.9, h = 0.6, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
// an arrow between two node centres [x, y, z?], trimmed so it starts / ends at the node edges
function link(a, b, color = C.brown, trim = 0.42) {
  const A = V3(a[0], a[1], a[2] || 0), Bv = V3(b[0], b[1], b[2] || 0);
  const d = Bv.clone().sub(A).normalize();
  return arrow(A.clone().addScaledVector(d, trim), Bv.clone().addScaledVector(d, -trim), color);
}
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
  say('新主題：動態規劃 DP', '一般又強大的演算法設計技巧');
  await beat(tok, 2400);
  const opt = tag('最佳化：min / max（例：shortest paths）', 'ptr', 0, 7.4);
  say('最適合最佳化問題', '要找「最好」的做法');
  await beat(tok, 2600);
  const rows = [];
  for (let d = 0; d < 5; d++) {
    const cnt = 2 ** d, sp = Math.min(1.3, 10.4 / cnt), row = [];
    for (let k = 0; k < cnt; k++) row.push(box('', LV[d], (k - (cnt - 1) / 2) * sp, 6.2 - d * 1.05, Math.min(0.9, sp * 0.75), 0.36, 0.36, 1.2));
    rows.push(row);
    say('窮舉：試遍所有可能', '第 ' + (d + 1) + ' 層：' + cnt + ' 種');
    await beat(tok, 650);
  }
  const ex = tag('exhaustive search → 指數時間', 'ptr', 0, 0.9);
  say('暴力窮舉通常是指數時間', '可能性每層翻倍');
  await beat(tok, 2400);
  const flat = rows.flat();
  flat.forEach((m, k) => { if (k < 5) move(m, -3.6 + k * 1.8, 3.4, 0); else fly(m, V3(0, 6, 3)); });
  txt(ex, 'careful brute force → 多項式時間');
  say('DP：還是全部試，但小心地試', 'DP ≈ careful brute force');
  await beat(tok, 1800);
  flat.slice(0, 5).forEach((m) => { m.scale.set(1.5, 1.8, 1.6); tint(m, C.teal); glow(m, GREEN); });
  say('重複的部分只算一次', '指數 → 多項式');
  await beat(tok, 2600);
  flat.slice(0, 5).forEach((m) => glow(m, null));
  txt(opt, '暖身：Fibonacci、shortest paths');
  say('今天暖身：兩個熟悉的問題', '之後三講看更驚人的例子');
  await beat(tok, 3000);
}]);

// 05:46 naive recursive fib：if n ≤ 2: f = 1；T(n) = T(n−1) + T(n−2) + Θ(1) ≥ 2T(n−2)
FRAG.push(['dpmit1-fib-naive', 'Naive 遞迴 fib：T(n) ≥ 2T(n−2) → 指數', async (tok) => {
  fresh([0, 4.2, 14.5], [0.6, 4.0, 0]);
  const cd = code(['fib(n):', '  if n <= 2: f = 1', '  else: f = fib(n-1) + fib(n-2)', '  return f'], -3.8, 8.4, 0.48);
  say('目標：算第 n 個 Fibonacci', 'F₁ = F₂ = 1，Fₙ = Fₙ₋₁ + Fₙ₋₂');
  await beat(tok, 2600);
  const T = symTree(3, 1.4, 1.2, 6.2, 1.45);
  const order = []; (function walk(t) { order.push(t); t.kids.forEach(walk); })(T[0]);
  cd.hl(2);
  say('naive 遞迴：每次分兩支', 'fib(n−1) 與 fib(n−2) 分開算');
  for (const t of order) {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.3, t.x, t.y + 0.3, 0, C.sand);
    t.m = box(symK(t.k), LV[t.d], t.x, t.y, 1.0, 0.55, 0.45, 1.0);
    await beat(tok, 380);
  }
  cd.hl(-1);
  for (const k of [2, 3]) {
    const same = T.filter((t) => t.k === k);
    T.forEach((t) => glow(t.m, t.k === k ? GOLD : null));
    say('F(' + symK(k) + ') 被算了 ' + same.length + ' 次', '同一個子問題一直重算');
    await beat(tok, 2200);
  }
  T.forEach((t) => glow(t.m, null));
  say('寫成 recurrence', 'T(n) = T(n−1) + T(n−2) + Θ(1) ≈ φⁿ');
  await beat(tok, 2800);
  say('把 T(n−1) 放小成 T(n−2)', 'T(n) ≥ 2T(n−2)：得到下界');
  const lv = [];
  for (let d = 0; d <= 3; d++) { lv.push(tag('×' + 2 ** d, 'idx', 6.2, 6.2 - d * 1.45)); await beat(tok, 450); }
  await beat(tok, 1200);
  say('每次 ×2、n 減 2：減 n/2 次', 'T(n) ≥ 2^{n/2}：指數時間');
  await beat(tok, 3200);
}]);

// 11:09 memoization：memo = {}，查到就回傳；Fₙ₋₃ 被切掉、Fₙ₋₂ 整棵子樹消失
FRAG.push(['dpmit1-memo', 'Memoization：查到 memo 就整棵子樹不用算', async (tok) => {
  fresh([0, 4.2, 14.5], [0.4, 3.8, 0]);
  const cd = code(['memo = {}', 'fib(n):', '  if n in memo: return memo[n]', '  if n <= 2: f = 1', '  else: f = fib(n-1) + fib(n-2)', '  memo[n] = f', '  return f'], -4.0, 8.6, 0.44);
  const T = symTree(3, 1.9, 1.12, 6.4, 1.38);
  T.forEach((t) => {
    if (t.par) t.e = line(t.par.x, t.par.y - 0.3, t.x, t.y + 0.3, 0, '#d8cfc0');
    t.m = box(symK(t.k), GRAY, t.x, t.y, 0.95, 0.52, 0.42);
    t.m.material.transparent = true; t.m.material.opacity = 0.35;
  });
  const keys = ['…', 'n−3', 'n−2', 'n−1', 'n'];
  const MX = (i) => -0.6 + i * 1.25;
  tag('memo', 'ptr', MX(0) - 1.3, 0.8);
  const cells = keys.map((k, i) => { tag(k, 'idx', MX(i), 0.15); return box('', '#e6dccb', MX(i), 0.8, 1.05, 0.5, 0.5); });
  say('memo = {}：先查，沒有才算', '算完存進 memo 再回傳');
  cd.hl(0);
  await beat(tok, 2600);
  const on = (t, c) => { t.m.material.opacity = 1; t.m.material.transparent = false; tint(t.m, c); };
  const store = async (k, label) => {
    const i = keys.indexOf(symK(k)); tint(cells[i], C.teal); relabel(cells[i], '✓'); glow(cells[i], GREEN);
    cd.hl(5); say('存起來：memo[' + label + ']', 'memo[n] = f；return f');
    await beat(tok, 1000); glow(cells[i], null);
  };
  let minK = Infinity;
  async function visit(t) {
    if (t.k >= minK) {
      on(t, C.gold); glow(t.m, GOLD); cd.hl(2);
      const gone = subtree(t).slice(1);
      say('F(' + symK(t.k) + ') 已在 memo', gone.length ? '直接回傳：整棵子樹消失' : '直接回傳：O(1)');
      await beat(tok, 900);
      gone.forEach((u) => { fly(u.m); if (u.e) kill(u.e); });
      await beat(tok, 900); glow(t.m, null);
      return;
    }
    on(t, LV[t.d]); glow(t.m, GOLD); cd.hl(4);
    if (!t.kids.length) {
      say('F(' + symK(t.k) + ') 第一次：遞迴算完', '（下面的遞迴省略）');
      await beat(tok, 1200);
      tint(cells[0], C.teal); relabel(cells[0], '✓'); minK = t.k;
      await store(t.k, symK(t.k)); glow(t.m, null); tint(t.m, C.teal);
      return;
    }
    say('F(' + symK(t.k) + ')：memo 裡沒有', '第一次呼叫 → 遞迴');
    await beat(tok, 1000); glow(t.m, null);
    await visit(t.kids[0]);
    await visit(t.kids[1]);
    minK = t.k; tint(t.m, C.teal); glow(t.m, GREEN);
    await store(t.k, symK(t.k)); glow(t.m, null);
  }
  // empty memo cells get a label slot so relabel() can write into them
  cells.forEach((m) => { const l = tag('', 'val', 0, 0); m.add(l); l.position.set(0, 0, 0); m.userData.lbl = l; });
  await visit(T[0]);
  cd.hl(-1);
  say('每個 F(k) 只遞迴一次', '其餘呼叫都被 memo 切掉');
  await beat(tok, 3000);
}]);

// 16:17 為什麼線性：非 memo 呼叫恰好 n 次 × Θ(1)；時間 = 子問題數 × 每題時間
FRAG.push(['dpmit1-memo-time', '時間 = 子問題數 × 每題時間 = n × Θ(1)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const L = ['fib(1)', 'fib(2)', 'fib(3)', '…', 'fib(n−1)', 'fib(n)'];
  const X = (i) => -4.5 + i * 1.8;
  say('呼叫 fib(k) 分成兩種', '第一次：遞迴；之後：查 memo');
  await beat(tok, 2600);
  const subs = [];
  for (let i = 0; i < 6; i++) {
    subs.push(box(L[i], i === 3 ? GRAY : C.teal, X(i), 4.6, 1.5, 0.7, 0.6, 1.4));
    if (i !== 3) tag('Θ(1)', 'idx', X(i), 5.4);
    say('非 memo 呼叫：恰好 n 次', 'fib(1) … fib(n) 各第一次');
    await beat(tok, 520);
  }
  await beat(tok, 1600);
  const peb = [];
  for (const i of [1, 2, 4, 5]) { const p = box('free', C.gold, X(i), 3.3, 0.8, 0.4, 0.4, 1.4); peb.push(p); await beat(tok, 300); }
  say('memo 呼叫：O(1)，當作免費', '已經付過，不再遞迴');
  await beat(tok, 2400);
  peb.forEach((p) => fly(p));
  subs.forEach((m) => glow(m, GOLD));
  const f = tag('n × Θ(1) = Θ(n)', 'ptr alt', 0, 2.3);
  say('時間 = 子問題數 × 每題時間', '不算遞迴：每次呼叫只做 O(1)');
  await beat(tok, 3000);
  subs.forEach((m) => glow(m, null));
  tag('DP ≈ recursion + memoization', 'ptr', 0, 1.2);
  say('DP ≈ 遞迴 + memoization', '子問題：fib(1) … fib(n)');
  await beat(tok, 2800);
  txt(f, '（最好的做法：O(log n) 次運算）');
  say('不必解 recurrence', '只數子問題，不數遞迴呼叫');
  await beat(tok, 3000);
}]);

// 23:14 bottom-up：for k in range(1, n+1)；拓樸排序 subproblem dependency DAG
FRAG.push(['dpmit1-bottomup', 'Bottom-up：for 迴圈 = 依賴 DAG 的拓樸順序', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const cd = code(['fib = {}', 'for k in range(1, n+1):', '  if k <= 2: f = 1', '  else: f = fib[k-1] + fib[k-2]', '  fib[k] = f', 'return fib[n]'], 0, 8.6, 0.46);
  const X = (k) => -3.75 + (k - 1) * 1.5, V = [0, 1, 1, 2, 3, 5, 8];
  for (let k = 1; k <= 6; k++) { tag('fib[' + k + ']', 'idx', X(k), 4.75); box('', '#e6dccb', X(k), 4.0, 1.25, 0.6, 0.3); }
  say('Bottom-up：從最小的往上算', '跟 memo 版做一模一樣的加法');
  await beat(tok, 2600);
  const cells = [];
  for (let k = 1; k <= 6; k++) {
    cd.hl(1);
    if (k <= 2) { cd.hl(2); say('k ≤ 2：f = 1', 'fib[' + k + '] = 1'); }
    else {
      cd.hl(3); glow(cells[k - 2], GOLD); glow(cells[k - 3], GOLD);
      say('前兩個一定已經算好', 'fib[' + k + '] = ' + V[k - 1] + ' + ' + V[k - 2] + ' = ' + V[k]);
    }
    await beat(tok, 700);
    cells.push(box(V[k], C.teal, X(k), 4.0, 1.0, 0.55, 0.5, 1.3));
    cd.hl(4);
    await beat(tok, 800);
    cells.forEach((m) => glow(m, null));
  }
  cd.hl(5);
  say('一路填到 fib[n]', '迴圈取代遞迴：實務上更快');
  await beat(tok, 2200);
  cd.hl(-1);
  const D = [];
  for (let k = 1; k <= 6; k++) D.push(box('F' + k, C.blue, X(k), 1.4, 0.8, 0.5, 0.4, 1.2));
  say('子問題依賴圖是 DAG', 'Fₖ 依賴 Fₖ₋₁ 與 Fₖ₋₂');
  for (let k = 2; k <= 6; k++) {
    link([X(k - 1), 1.4, 0.3], [X(k), 1.4, 0.3], C.gold, 0.45);
    if (k >= 3) { const mx = (X(k - 2) + X(k)) / 2; line(X(k - 2), 1.75, mx, 2.35, 0.3, C.sand); link([mx, 2.35, 0.3], [X(k), 1.75, 0.3], C.sand, 0.02); }
    await beat(tok, 450);
  }
  await beat(tok, 1200);
  for (let k = 0; k < 6; k++) { glow(D[k], GOLD); await beat(tok, 300); glow(D[k], null); }
  say('bottom-up = 拓樸排序', '邊都往右：順序 f₁, f₂, …, fₙ');
  await beat(tok, 3000);
}]);

// 29:25 只記最後兩個值：O(1) 空間；時間一眼可見
FRAG.push(['dpmit1-const-space', '只留最後兩個值：O(1) 空間', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.4, 0]);
  const X = (k) => -3.75 + (k - 1) * 1.5, V = [0, 1, 1, 2, 3, 5, 8];
  for (let k = 1; k <= 6; k++) tag('fib[' + k + ']', 'idx', X(k), 4.75);
  say('表有 n 格，真的都要存嗎？', '算 fib[k] 只看 k−1 與 k−2');
  const keep = [box(1, C.teal, X(1), 4.0, 1.0, 0.55, 0.5, 1.3), box(1, C.teal, X(2), 4.0, 1.0, 0.55, 0.5, 1.3)];
  await beat(tok, 2600);
  const win = ghostBox(C.gold, 3.0, 1.0, 0.9); win.position.set((X(1) + X(2)) / 2, 4.0, 0);
  for (let k = 3; k <= 6; k++) {
    keep.forEach((m) => glow(m, GOLD));
    say('只留最後兩個值', 'fib[' + k + '] = ' + V[k - 1] + ' + ' + V[k - 2] + ' = ' + V[k]);
    await beat(tok, 900);
    const m = box(V[k], C.teal, X(k), 4.0, 1.0, 0.55, 0.5, 1.3);
    keep.forEach((o) => glow(o, null));
    await beat(tok, 500);
    fly(keep.shift(), V3(-2, 7, 3)); keep.push(m);
    win.position.set((X(k - 1) + X(k)) / 2, 4.0, 0);
    await beat(tok, 700);
  }
  tag('空間 O(1)、時間 Θ(n)', 'ptr alt', 0, 2.4);
  say('每次刪掉最舊的一個', '常數空間，時間仍是線性');
  await beat(tok, 2800);
  code(['for k in range(1, n+1):', '  ... O(1) ...'], 0, 1.4, 0.46);
  say('bottom-up：時間一眼看出', 'n 次迴圈 × O(1) = Θ(n)');
  await beat(tok, 3000);
}]);

// 31:00 shortest paths 前：guessing——不知道就猜，全部試，取最好
FRAG.push(['dpmit1-guess', 'Guessing：不知道就全部試，取最好的', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const q = box('?', C.red, 0, 6.6, 1.0, 1.0, 0.8, 1.5);
  say('想知道某件事的答案', '可是不知道');
  await beat(tok, 2200);
  say('工具：guessing（猜）', '不知道？那就猜');
  glow(q, GOLD);
  await beat(tok, 2200);
  glow(q, null);
  const X = (i) => -4.5 + i * 3, gs = [];
  for (let i = 0; i < 4; i++) {
    line(0, 6.1, X(i), 4.2, 0, C.sand);
    gs.push(box('猜 ' + (i + 1), C.blue, X(i), 3.8, 1.5, 0.7, 0.6, 1.3));
    say('不是只猜一個：全部都試', 'try all guesses');
    await beat(tok, 600);
  }
  await beat(tok, 1400);
  const best = 2;
  for (let i = 0; i < 4; i++) { glow(gs[i], GOLD); await beat(tok, 450); glow(gs[i], null); }
  gs.forEach((m, i) => { if (i === best) { tint(m, C.teal); glow(m, GREEN); } else tint(m, GRAY); });
  tag('最好的', 'ptr alt', X(best), 2.9);
  say('取最好的那一個', '所以 DP 適合 min / max');
  await beat(tok, 2800);
  tag('DP ≈ recursion + memoization + guessing', 'ptr', 0, 1.6);
  say('DP ≈ 遞迴 + memo + 猜', '猜 = 暴力搜尋的部分');
  await beat(tok, 3200);
}]);

// 34:59 猜第一條邊 vs 猜最後一條邊；δ(s,v) = min over (u,v) of δ(s,u) + w(u,v)；memo
FRAG.push(['dpmit1-sp-recur', '猜最後一條邊：δ(s,v) = min δ(s,u) + w(u,v)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5.5, 3.8], x1: [-3, 6.2], x2: [-3, 1.4], u1: [1.8, 6.4], u2: [1.8, 3.8], u3: [1.8, 1.2], v: [5.4, 3.8] };
  const N = {};
  for (const k in P) N[k] = box(k === 's' || k === 'v' ? k : k[0] === 'x' ? '' : 'u' + '₁₂₃'[+k[1] - 1], k === 's' ? C.teal : k === 'v' ? C.orange : k[0] === 'u' ? C.blue : GRAY, P[k][0], P[k][1], 0.8, 0.8, 0.6, 1.3);
  for (const a of ['x1', 'x2']) for (const b of ['u1', 'u2', 'u3']) line(P[a][0] + 0.4, P[a][1], P[b][0] - 0.4, P[b][1], 0, '#e2d8c4');
  say('最短路徑 s → v：先寫成遞迴', '但遞迴式從哪來？');
  await beat(tok, 2600);
  const outs = ['x1', 'x2'].map((k) => link([...P.s, 0.2], [...P[k], 0.2], C.gold, 0.5));
  glow(N.s, GOLD);
  say('猜第一條邊：s 的某條出邊', '可行，但起點 s 會跟著變');
  await beat(tok, 3000);
  glow(N.s, null);
  const ins = ['u1', 'u2', 'u3'].map((k) => link([...P[k], 0.2], [...P.v, 0.2], C.brown, 0.5));
  glow(N.v, GOLD);
  say('改猜最後一條邊 (u, v)', '一定是 v 的某條入邊');
  await beat(tok, 2600);
  const tg = [];
  for (let i = 0; i < 3; i++) {
    const k = 'u' + (i + 1), sub = '₁₂₃'[i];
    glow(N[k], GOLD);
    tg.push(tag('δ(s,u' + sub + ')', 'ptr', P[k][0], P[k][1] + 0.75));
    tg.push(tag('w(u' + sub + ',v)', 'idx', (P[k][0] + P.v[0]) / 2, (P[k][1] + P.v[1]) / 2 + 0.35));
    say('猜 (u' + sub + ', v)', 'δ(s,u' + sub + ') + w(u' + sub + ',v)');
    await beat(tok, 1500);
    glow(N[k], null);
  }
  glow(N.u2, GREEN); tint(N.u2, C.teal);
  link([...P.u2, 0.45], [...P.v, 0.45], C.teal, 0.5);
  say('不知道哪個對：全部取 min', 'δ(s,v) = min δ(s,u) + w(u,v)');
  await beat(tok, 3200);
  const mm = box('memo[v]', C.purple, 0, -0.2 + 0.6, 1.6, 0.6, 0.5, 1.4);
  say('直接遞迴：指數時間', '加 memo：先查 memo[v]，算完再存');
  await beat(tok, 3200);
}]);

// 41:27 有環的圖：δ(s,v) → δ(s,a) → δ(s,b) → δ(s,v) → …… 無限遞迴
FRAG.push(['dpmit1-cycle', '有環：δ(s,v) 還沒算完又被呼叫 → 無限遞迴', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5, 4.6], b: [-1.5, 4.6], a: [1.6, 7.0], v: [5, 4.6] };
  const N = {};
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : k === 'v' ? C.orange : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.6, 1.3);
  link([...P.s, 0], [...P.b, 0]); link([...P.b, 0], [...P.a, 0]); link([...P.a, 0], [...P.v, 0]);
  link([P.v[0], P.v[1] - 0.2, 0.2], [P.b[0], P.b[1] - 0.2, 0.2], C.red);
  say('畫一張有環的圖', 's→b、b→a、a→v、v→b');
  await beat(tok, 2600);
  tag('memo：空的（還沒有算完的）', 'idx', 0, 2.6);
  const X = (i) => -5.25 + i * 1.5, seq = ['v', 'a', 'b', 'v', 'a', 'b', 'v', 'a'];
  const caps = { v: ['算 δ(s,v)', 'v 只有入邊 a→v：要 δ(s,a)'], a: ['算 δ(s,a)', 'a 只有入邊 b→a：要 δ(s,b)'], b: ['算 δ(s,b)', 'b 的入邊：s→b、v→b'] };
  for (let i = 0; i < seq.length; i++) {
    const k = seq[i], m = box('δ(s,' + k + ')', i >= 3 ? C.red : C.blue, X(i), 0.8, 1.35, 0.6, 0.5, 1.4);
    Object.values(N).forEach((o) => glow(o, null)); glow(N[k], GOLD);
    if (i < 3) say(caps[k][0], caps[k][1]);
    else if (i === 3) { glow(m, RED); say('δ(s,v) 又被呼叫了！', '它還沒算完，memo 裡沒有'); }
    else say('同樣的事一直重複', '無限遞迴');
    await beat(tok, i === 2 ? 1400 : i === 3 ? 2600 : 1300);
    if (i === 2) {
      const base = box('δ(s,s)=0', C.teal, P.s[0], 3.3, 1.5, 0.5, 0.4, 1.2);
      say('一條來自 s：δ(s,s) = 0', '另一條來自 v：要 δ(s,v)');
      await beat(tok, 2200);
    }
  }
  Object.values(N).forEach((o) => glow(o, null));
  say('有環：infinite time', 'memo 只在算完後才寫入');
  await beat(tok, 3200);
}]);

// 43:35 DAG：子問題 V 個、每題 indeg(v)+1 → Σ = V + E；= DFS 拓樸 + 一輪 Bellman-Ford
FRAG.push(['dpmit1-dag-time', 'DAG 上：Σ(indeg(v)+1) = Θ(V + E)', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.8, 0]);
  const P = { s: [-5, 4.2], a: [-2, 6.4], b: [-2, 1.8], c: [1.8, 4.2], v: [5, 4.2] };
  const E = [['s', 'a'], ['s', 'b'], ['a', 'b'], ['a', 'c'], ['b', 'c'], ['b', 'v'], ['c', 'v']];
  const N = {}, ed = [];
  for (const k in P) N[k] = box(k, k === 's' ? C.teal : C.blue, P[k][0], P[k][1], 0.8, 0.8, 0.6, 1.3);
  for (const [a, b] of E) ed.push({ a, b, h: link([...P[a], 0], [...P[b], 0]) });
  say('沒有環（DAG）就沒問題', '時間 = 子問題數 × 每題時間');
  await beat(tok, 2800);
  say('子問題：δ(s,v)，共 V 個', '每個頂點一個');
  Object.values(N).forEach((m) => glow(m, GOLD));
  await beat(tok, 2200);
  Object.values(N).forEach((m) => glow(m, null));
  let sum = 0;
  for (const k of ['s', 'a', 'b', 'c', 'v']) {
    const ind = E.filter((e) => e[1] === k).length; sum += ind + 1;
    glow(N[k], GOLD);
    const hs = ed.filter((e) => e.b === k).map((e) => link([...P[e.a], 0.3], [...P[k], 0.3], C.gold));
    tag('indeg+1 = ' + (ind + 1), 'idx', P[k][0], P[k][1] + 0.8);
    say('δ(s,' + k + ')：試 ' + ind + ' 條入邊', '每題時間 = indeg(' + k + ') + 1');
    await beat(tok, 1500);
    hs.forEach(kill); glow(N[k], null);
  }
  tag('Σ (indeg + 1) = 7 + 5 = ' + sum, 'ptr alt', 0, 0.4);
  say('加總：Σ indeg(v) = E', '總時間 Θ(V + E)');
  await beat(tok, 3000);
  say('= DFS 拓樸排序 + 一輪 relax', '其實就是 DAG 最短路徑');
  await beat(tok, 2800);
  say('教訓：子問題依賴要無環', 'memo、bottom-up 才會成立');
  await beat(tok, 3000);
}]);

// 47:00 把圖攤成 V 層：δₖ(s,v) = min δₖ₋₁(s,u) + w(u,v)；V² 子問題、Θ(VE) = Bellman-Ford
FRAG.push(['dpmit1-layers', '分層：δₖ(s,v) 讓依賴無環 → Bellman-Ford', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const VS = ['s', 'a', 'b', 'v'], Y = { s: 6.6, a: 5.2, b: 3.8, v: 2.4 }, X = (k) => -4.8 + k * 3.2;
  const E = [['s', 'b'], ['b', 'a'], ['a', 'v'], ['v', 'b']];
  say('有環的圖：s→b→a→v→b', '直接 memo 會無限遞迴');
  const L = [];
  for (let k = 0; k <= 3; k++) {
    tag('k = ' + k, 'ptr', X(k), 7.6);
    L.push(Object.fromEntries(VS.map((u) => [u, box(u + k, k ? C.blue : C.teal, X(k), Y[u], 0.75, 0.55, 0.45, 1.2)])));
    await beat(tok, 500);
  }
  say('把圖複製成好幾層', '第 k 層：用了 k 條邊之後');
  await beat(tok, 2200);
  for (let k = 0; k < 3; k++) {
    for (const [a, b] of E) link([X(k), Y[a], 0], [X(k + 1), Y[b], 0], C.brown, 0.45);
    say('每條邊都往下一層走', '層 k → 層 k+1：一定無環');
    await beat(tok, 900);
  }
  for (let k = 0; k < 3; k++) for (const u of VS) link([X(k), Y[u], -0.2], [X(k + 1), Y[u], -0.2], '#d8cfc0', 0.45);
  say('同一頂點也連到下一層', '所以是「最多」k 條邊');
  await beat(tok, 2600);
  const path = [['s', 0], ['b', 1], ['a', 2], ['v', 3]];
  for (let i = 0; i < path.length; i++) {
    const [u, k] = path[i]; glow(L[k][u], GOLD);
    if (i) link([X(k - 1), Y[path[i - 1][0]], 0.35], [X(k), Y[u], 0.35], C.teal, 0.45);
    await beat(tok, 500);
  }
  say('δ₃(s,v)：最多 3 條邊', 'δₖ(s,v) = min δₖ₋₁(s,u) + w(u,v)');
  await beat(tok, 3000);
  tag('V × V 個子問題', 'ptr alt', 0, 1.2);
  say('k = 0 … V−1、v 有 V 個', 'V² 個子問題；目標 δ_{V−1}(s,v)');
  await beat(tok, 2800);
  say('每題 indeg：V · Σ indeg', '= Θ(VE)：這就是 Bellman-Ford');
  await beat(tok, 3200);
}]);

// ════════════════ ENyox7kNKeY（MIT 6.006 L20 / 2011：DP II）——blackjack 的 DAG ════════════════

// 50:21 BJ(i) → i+4、i+5、i+6…，邊權 +1 / 0 / −1，最長路徑；O(n³)，21 是常數則 O(n²)
FRAG.push(['dpmit1-bj-dag', 'Blackjack 的 DAG：邊權 +1/0/−1 的最長路徑', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const n = 10, X = (i) => -5.25 + i * 1.05, Y = 2.6;
  const N = [];
  for (let i = 0; i <= n; i++) { N.push(box(i, i >= 7 ? GRAY : C.blue, X(i), Y, 0.75, 0.6, 0.5, 1.2)); }
  tag('節點 i = 從第 i 張牌開始（剩 n − i 張）', 'idx', 0, 1.5);
  say('DAG 的節點：牌從哪裡繼續', 'BJ(i)：從 cᵢ 開始最多贏多少');
  await beat(tok, 2800);
  const E = [[0, 4, 1], [0, 5, 0], [0, 6, -1], [4, 8, 1], [4, 9, -1], [5, 9, 1], [5, 10, 0], [6, 10, 1]];
  const sg = (w) => (w > 0 ? '+1' : w < 0 ? '−1' : '0');
  const col = (w) => (w > 0 ? C.teal : w < 0 ? C.red : C.gold);
  const arcs = [];
  for (const [a, b, w] of E) {
    const h = 0.9 + 0.22 * (b - a), mx = (X(a) + X(b)) / 2;
    const l1 = line(X(a), Y + 0.35, mx, Y + h, 0, col(w)), l2 = link([mx, Y + h, 0], [X(b), Y + 0.35, 0], col(w), 0.02);
    const t = tag(sg(w), 'idx', mx, Y + h + 0.3);
    arcs.push({ a, b, w, l1, l2, t });
    if (a === 0) { say('從 i 出發：這一手用掉幾張？', '4 張 + 玩家 hit + 莊家 hit'); await beat(tok, 1300); }
    else await beat(tok, 500);
  }
  say('邊權：贏 +1、平 0、輸 −1', '剩不到 4 張：不能開局，BJ = 0');
  for (let i = 7; i <= n; i++) glow(N[i], GOLD);
  await beat(tok, 2800);
  for (let i = 7; i <= n; i++) glow(N[i], null);
  [0, 4, 8].forEach((i) => { glow(N[i], GREEN); tint(N[i], C.teal); });
  arcs.filter((e) => (e.a === 0 && e.b === 4) || (e.a === 4 && e.b === 8)).forEach((e) => link([X(e.a), Y + 0.1, 0.4], [X(e.b), Y + 0.1, 0.4], C.teal, 0.4));
  tag('+1 + +1 = 2', 'ptr alt', X(4), 6.4);
  say('求最長路徑（longest path）', '贏最多的玩法 = BJ(0)');
  await beat(tok, 3200);
  say('n 題 × n 種 hit 數 × 跑莊家', '最壞 O(n³)；21 視為常數則 O(n²)');
  await beat(tok, 3200);
}]);

// ════════════════ wFP5VHGHFdk（MIT 6.006 Rec21 / 2011：Knapsack） ════════════════

const USD = String.fromCharCode(36);
const KI = [{ nm: '雕像', s: 4, v: 10, c: C.gold }, { nm: '水晶球', s: 2, v: 4, c: C.cyan }, { nm: '鋼筆', s: 3, v: 7, c: C.purple }];

// 01:16 小偷、n 個物品 (sᵢ 磅, vᵢ 元)、背包 S 磅；例子 S = 5 → 水晶球 + 鋼筆 = $11
FRAG.push(['dpmit1-knap-items', 'Knapsack：S = 5，雕像／水晶球／鋼筆', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  const home = [[-5.2, 2.5], [-3.2, 1.5], [-1.2, 2.0]];
  const it = KI.map((o, i) => box(o.nm + ' ' + USD + o.v, o.c, home[i][0], home[i][1], 1.6, o.s, 0.9, 1.6));
  KI.forEach((o, i) => tag(o.s + ' 磅', 'idx', home[i][0], 0.2 + 0.0));
  tag('金庫：item i 重 sᵢ、值 vᵢ', 'ptr', -3.2, 6.8);
  const bag = ghostBox(C.brown, 1.9, 5, 1.2); bag.position.set(3.6, 3.0, 0);
  tag('背包 S = 5 磅', 'ptr', 3.6, 6.2);
  for (let w = 1; w <= 5; w++) tag(String(w), 'idx', 4.9, 0.5 + w - 0.5);
  say('小偷：n 個物品、一個背包', 'item i：重 sᵢ 磅、賣 vᵢ 元');
  await beat(tok, 3000);
  say('背包最多裝 S 磅', '超重就破掉（被雷射切碎）');
  await beat(tok, 2600);
  move(it[0], 3.6, 2.5); glow(it[0], GOLD);
  say('先拿雕像：4 磅、$10', '還剩 1 磅');
  await beat(tok, 2200);
  move(it[1], 3.6, 5.5); glow(it[1], RED);
  say('再放水晶球：4 + 2 > 5', '超重：不行');
  await beat(tok, 2400);
  move(it[1], ...home[1]); glow(it[1], null); move(it[0], ...home[0]); glow(it[0], null);
  await beat(tok, 900);
  move(it[1], 3.6, 1.5); await beat(tok, 700); move(it[2], 3.6, 4.0);
  glow(it[1], GREEN); glow(it[2], GREEN);
  tag('$4 + $7 = $11', 'ptr alt', 3.6, 7.0);
  say('水晶球 + 鋼筆 = 5 磅', '$11：比單拿雕像的 $10 好');
  await beat(tok, 3000);
  say('目標：不超過 S，價值最大', '兩種解法：圖、DP');
  await beat(tok, 2600);
}]);

// 03:06 解 = n 個 true/false 決策；狀態 = (物品 i, 已拿重量 w)；邊權 −vᵢ
FRAG.push(['dpmit1-knap-state', '決策 dᵢ、狀態 (i, w)、邊權 −vᵢ', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const X = (i) => -4 + i * 4;
  const qs = KI.map((o, i) => box('d' + (i + 1) + '：' + o.nm + '？', o.c, X(i), 6.6, 2.4, 0.7, 0.5, 1.4));
  say('解 = 選了哪些物品', 'n 個 true / false 決策 dᵢ');
  await beat(tok, 2600);
  const ans = ['F', 'T', 'T'];
  for (let i = 0; i < 3; i++) {
    glow(qs[i], GOLD);
    box(ans[i], ans[i] === 'T' ? C.teal : GRAY, X(i), 5.6, 0.6, 0.5, 0.4, 1.2);
    say('像益智節目：一題一題答', '超過 S 磅就出局');
    await beat(tok, 900); glow(qs[i], null);
  }
  say('狀態要記什麼？', '看到第幾個物品 i ＋ 已拿重量 w');
  const st = box('(i, w)', C.orange, 0, 4.2, 1.6, 0.7, 0.5, 1.4);
  await beat(tok, 3000);
  fly(st);
  const a = box('1, 0', C.blue, -4, 2.8, 1.1, 0.6, 0.5, 1.3);
  const b = box('2, 0', C.blue, 1.5, 4.2, 1.1, 0.6, 0.5, 1.3);
  const c = box('2, 4', C.blue, 1.5, 1.2, 1.1, 0.6, 0.5, 1.3);
  say('節點 (1, 0)：包裡 0 磅', '看 item 1：拿不拿雕像？');
  await beat(tok, 2400);
  link([-4, 2.8, 0], [1.5, 4.2, 0], C.sand, 0.65); tag('不拿：0', 'idx', -1.2, 4.0);
  say('不拿 → (2, 0)', '邊權 0');
  await beat(tok, 2000);
  link([-4, 2.8, 0], [1.5, 1.2, 0], C.gold, 0.65); tag('拿：−10', 'idx', -1.2, 1.5);
  say('拿 → (2, 4)', '邊權 −v₁ = −10');
  await beat(tok, 2200);
  glow(c, GOLD);
  say('取負號：max 收益 → min 路徑', '交給 shortest path 演算法');
  await beat(tok, 3000);
}]);

// 10:34 分層圖：item 1/2/3/done 各一層、每層 w = 0…5；起點 0 權重連到第一層；終點 (done, 5)；最短路徑 −11
FRAG.push(['dpmit1-knap-graph', '分層圖：最短路徑 −11 = 拿水晶球＋鋼筆', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.6, 0]);
  const X = (i) => -3.9 + (i - 1) * 2.6, Y = (w) => 1.0 + w * 1.05;
  const hdr = ['item 1 雕像', 'item 2 水晶球', 'item 3 鋼筆', 'done'];
  const N = {};
  for (let i = 1; i <= 4; i++) {
    tag(hdr[i - 1], 'ptr', X(i), 7.2);
    for (let w = 0; w <= 5; w++) N[i + ',' + w] = box(i + ',' + w, i === 4 ? C.orange : C.blue, X(i), Y(w), 0.8, 0.5, 0.4, 1.2);
    await beat(tok, 450);
  }
  for (let w = 0; w <= 5; w++) tag('w=' + w, 'idx', X(4) + 1.0, Y(w));
  say('每個物品一層', '每層 6 個節點：已拿 0…5 磅');
  await beat(tok, 2200);
  const P = (i, w) => [X(i), Y(w), 0];
  const edges = async (i, quick) => {
    const o = KI[i - 1];
    for (let w = 0; w <= 5; w++) {
      if (quick || w) link(P(i, w), P(i + 1, w), C.sand, 0.45);
      if (w + o.s <= 5 && (quick || w)) { link(P(i, w), P(i + 1, w + o.s), C.gold, 0.45); tag('−' + o.v, 'idx', X(i) + 1.3, (Y(w) + Y(w + o.s)) / 2 + 0.2); }
    }
  };
  glow(N['1,0'], GOLD);
  link(P(1, 0), P(2, 0), C.sand, 0.45);
  say('(1,0) 不拿雕像 → (2,0)', '邊權 0');
  await beat(tok, 2000);
  link(P(1, 0), P(2, 4), C.gold, 0.45); tag('−10', 'idx', X(1) + 1.3, (Y(0) + Y(4)) / 2 + 0.2);
  say('拿雕像 → (2,4)', '邊權 −10');
  await beat(tok, 2000);
  glow(N['1,0'], null);
  await edges(1, false);
  say('其他節點同理', '會超過 5 磅的邊不存在');
  await beat(tok, 1800);
  await edges(2, true);
  glow(N['2,4'], RED);
  say('(2,4) 不能拿水晶球', '4 + 2 > 5：只有「不拿」');
  await beat(tok, 2400);
  glow(N['2,4'], null);
  await edges(3, true);
  say('最後一層 done：全部決定完', '(3,2) 拿鋼筆 → (done,5)');
  await beat(tok, 2000);
  const S = [-6.4, 3.6];
  box('s', C.teal, S[0], S[1], 0.7, 0.7, 0.5, 1.3);
  for (let w = 0; w <= 5; w++) link([S[0], S[1], -0.2], [X(1), Y(w), -0.2], '#d8cfc0', 0.45);
  say('起點連到第一層每個節點', '邊權 0 = 浪費掉的容量');
  await beat(tok, 2600);
  glow(N['4,5'], GOLD);
  say('終點：(done, 5)', '找 s 到 (done,5) 的最短路徑');
  await beat(tok, 2000);
  const path = [[1, 0], [2, 0], [3, 2], [4, 5]];
  link([S[0], S[1], 0.4], [X(1), Y(0), 0.4], C.teal, 0.45);
  for (let k = 0; k < path.length; k++) {
    const [i, w] = path[k]; glow(N[i + ',' + w], GREEN); tint(N[i + ',' + w], C.teal);
    if (k) link([X(path[k - 1][0]), Y(path[k - 1][1]), 0.4], [X(i), Y(w), 0.4], C.teal, 0.45);
    await beat(tok, 600);
  }
  say('0 + 0 − 4 − 7 = −11', '拿水晶球＋鋼筆：$11');
  await beat(tok, 3000);
}]);

// 23:23 V = (n+1)(S+1) = O(nS)、每點 ≤ 2 條出邊；DAG shortest path O(V+E) = O(nS)
FRAG.push(['dpmit1-knap-graph-time', '圖解的時間：DAG 最短路徑 O(V+E) = O(nS)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.6, 0]);
  const X = (i) => -5.6 + i * 0.75, Y = (w) => 1.2 + w * 0.75;
  const ns = [];
  for (let i = 0; i < 4; i++) { for (let w = 0; w <= 5; w++) ns.push(box('', C.blue, X(i), Y(w), 0.5, 0.45, 0.4, 1.1)); await beat(tok, 300); }
  tag('V = (n+1)(S+1) = 24', 'ptr', X(1.5), 6.2);
  say('頂點數 (n+1)(S+1)', '寫成 O(nS)');
  await beat(tok, 2600);
  for (const m of ns) glow(m, GOLD);
  tag('每點最多 2 條出邊 → E ≤ 2V', 'ptr', X(1.5), 0.3);
  say('每個頂點最多 2 條出邊', '拿／不拿 → E = O(nS)');
  await beat(tok, 2600);
  ns.forEach((m) => glow(m, null));
  const al = [['Dijkstra', C.red, '邊權為負：不能用'], ['Bellman-Ford', GRAY, 'O(VE)：太慢'], ['DAG shortest path', C.teal, 'O(V + E)']];
  const ab = al.map((a, k) => { const m = box(a[0], a[1], 2.8, 5.6 - k * 1.6, 3.2, 0.8, 0.6, 1.4); tag(a[2], 'idx', 2.8, 5.0 - k * 1.6); return m; });
  say('用哪個最短路徑演算法？', '圖是 DAG（層層往右）');
  await beat(tok, 2800);
  glow(ab[2], GREEN);
  say('DP 的圖永遠用 DAG 演算法', '拓樸排序 + relax 一次');
  await beat(tok, 2800);
  tag('O(V + E) = O(nS)', 'ptr alt', 2.8, 0.3);
  say('總時間 O(nS)', '跟 DP 的時間一樣');
  await beat(tok, 3000);
}]);

// 26:06 子問題 dp(i, j)：items i 以後（suffix）、重量最多 j；遞迴 max(不拿, vᵢ + dp(i+1, j−sᵢ))
FRAG.push(['dpmit1-knap-dp-def', 'dp(i, j) = max(dp(i+1, j), vᵢ + dp(i+1, j − sᵢ))', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  say('改用 DP：子問題 = 圖的節點', 'nS 個節點 → nS 個子問題');
  await beat(tok, 2600);
  say('dp(i, j)：最多 j 磅', '只用 item i 以後，最多賺多少');
  await beat(tok, 2800);
  const sets = [['3', '{ }', []], ['2', '{鋼筆}', [2]], ['1', '{水晶球, 鋼筆}', [1, 2]], ['0', '{雕像, 水晶球, 鋼筆}', [0, 1, 2]]];
  const SX = (k) => -4.8 + k * 3.2;
  const sb = [];
  for (let k = 0; k < 4; k++) {
    tag('i = ' + sets[k][0], 'ptr', SX(k), 7.6);
    sets[k][2].forEach((j, r) => sb.push(box(KI[j].nm, KI[j].c, SX(k), 6.7 - r * 0.62, 1.7, 0.5, 0.4, 1.2)));
    if (!sets[k][2].length) tag('（空）', 'idx', SX(k), 6.7);
    say('物品改 0-based，看 suffix', 'i = ' + sets[k][0] + '：' + sets[k][1]);
    await beat(tok, 1100);
  }
  await beat(tok, 1200);
  const cd = code(['dp(i, j) = max(', '    dp(i+1, j),                # 不拿 item i', '    v[i] + dp(i+1, j - s[i])   # 拿 item i', ')   # 第二項只在 j >= s[i] 時'], 0, 3.4, 0.55);
  cd.hl(0);
  say('兩個決策：拿或不拿 item i', '取 max');
  await beat(tok, 2400);
  cd.hl(1);
  say('不拿 item i', '容量不變 → dp(i+1, j)');
  await beat(tok, 2600);
  cd.hl(2);
  say('拿 item i：賺 vᵢ', '剩下的只能用 j − sᵢ 磅');
  await beat(tok, 2800);
  cd.hl(3);
  say('先檢查 j ≥ sᵢ', '不然 j − sᵢ 變負的，程式會壞');
  await beat(tok, 2800);
  cd.hl(-1);
  say('箭頭方向跟圖相反', 'DP 決定時要知道後面物品的結果');
  await beat(tok, 3000);
}]);

// 34:10 答案 dp(0,5)、拓樸順序 i 由大到小、初始 dp(3, j) = 0，填表 → 11
FRAG.push(['dpmit1-knap-table', 'Knapsack DP 表：dp(3, j) = 0 往左填到 dp(0, 5) = 11', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const X = (i) => -2.4 + i * 1.6, Y = (j) => 6.6 - j * 0.95;
  const hdr = ['0 雕像', '1 水晶球', '2 鋼筆', '3（空）'];
  for (let i = 0; i <= 3; i++) tag(hdr[i], 'ptr', X(i), 7.5);
  for (let j = 0; j <= 5; j++) { tag('j=' + j, 'idx', X(0) - 1.3, Y(j)); for (let i = 0; i <= 3; i++) box('', '#e6dccb', X(i), Y(j), 1.3, 0.8, 0.2, 0, -0.2); }
  tag('i →', 'idx', X(3) + 1.2, 7.5);
  const goal = ghostBox(C.gold, 1.5, 0.95, 0.9); goal.position.set(X(0), Y(5), 0);
  say('答案在 dp(0, 5)', '所有物品、容量最多 S = 5');
  await beat(tok, 2800);
  const DP = [[], [], [], [0, 0, 0, 0, 0, 0]], cell = {};
  for (let j = 0; j <= 5; j++) cell['3,' + j] = box(0, GRAY, X(3), Y(j), 1.0, 0.6, 0.4, 1.2);
  say('初始：dp(3, j) = 0', '空 suffix：什麼都不拿，賺 0');
  await beat(tok, 2600);
  say('順序：i 由大到小（右往左）', '每格只看右邊那一欄');
  await beat(tok, 2200);
  const tmp = [];
  for (let i = 2; i >= 0; i--) {
    const o = KI[i];
    for (let j = 0; j <= 5; j++) {
      tmp.forEach(kill); tmp.length = 0;
      const skip = DP[i + 1][j], can = j >= o.s, take = can ? o.v + DP[i + 1][j - o.s] : -1, v = Math.max(skip, take);
      DP[i][j] = v;
      tmp.push(link([X(i + 1), Y(j), 0.5], [X(i), Y(j), 0.5], skip >= take ? C.teal : C.gold, 0.55));
      glow(cell[(i + 1) + ',' + j], GOLD);
      if (can) { tmp.push(link([X(i + 1), Y(j - o.s), 0.5], [X(i), Y(j), 0.5], take > skip ? C.teal : C.gold, 0.55)); glow(cell[(i + 1) + ',' + (j - o.s)], GOLD); }
      say('dp(' + i + ',' + j + ')：' + (can ? '拿' + o.nm + '？' : o.nm + '放不下'),
        can ? 'max(' + skip + ', ' + o.v + ' + dp(' + (i + 1) + ',' + (j - o.s) + ')) = ' + v : 'j < ' + o.s + '：只能不拿 → ' + v);
      await beat(tok, 700);
      cell[i + ',' + j] = box(v, take > skip ? C.teal : C.blue, X(i), Y(j), 1.0, 0.6, 0.4, 1.2);
      await beat(tok, 450);
      for (const k in cell) glow(cell[k], null);
    }
  }
  tmp.forEach(kill);
  glow(cell['1,3'], GOLD); glow(cell['2,1'], GOLD); glow(cell['2,3'], GOLD);
  say('dp(1,3)：容量 3、水晶球 2 磅', '拿了剩 1 磅 → 看 dp(2,1) = 0');
  await beat(tok, 3000);
  for (const k in cell) glow(cell[k], null);
  glow(cell['0,5'], GREEN);
  say('dp(0, 5) = 11', 'max(11, 10 + dp(1,1) = 10) = 11');
  await beat(tok, 3200);
}]);

// 49:19 O(nS)；32-bit vs 64-bit；b = log S → 時間 n·2ᵇ：pseudo-polynomial
FRAG.push(['dpmit1-pseudo-poly', 'O(nS) 是 pseudo-polynomial：32-bit vs 64-bit', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  say('nS 個子問題 × O(1)', '總時間 O(nS)：是多項式嗎？');
  await beat(tok, 2800);
  const inp = tag('輸入：3 | 4 2 3 | 10 4 7', 'ptr', 0, 7.6);
  say('輸入：n、重量、價值', '每個重量 ≤ S：要 log S bits');
  await beat(tok, 2800);
  txt(inp, '輸入大小 O(n log S) bits');
  const bar = (x, h, c, label) => { const m = box('', c, x, 0.3 + h / 2, 1.0, h, 0.8, 0); tag(label, 'idx', x, 0.6 + h + 0.25); return m; };
  tag('32-bit', 'ptr', -3.6, -0.2 + 0.0 + 0.1);
  tag('64-bit', 'ptr', 3.6, 0.1);
  bar(-4.3, 1.6, C.teal, '≈3200 bits');
  say('32-bit、100 個物品', '輸入約 3200 bits');
  await beat(tok, 2400);
  bar(-2.9, 11.6 * 0.33, C.red, '≈4×10¹¹ 次');
  say('S 最大約 4×10⁹', '運算 ≈ n·S ≈ 4×10¹¹');
  await beat(tok, 2800);
  bar(2.9, 3.2, C.teal, '≈6400 bits');
  say('64-bit：輸入只變 2 倍', '');
  await beat(tok, 2200);
  const hi = bar(4.3, 21.2 * 0.33, C.red, '≈1.6×10²¹ 次');
  glow(hi, RED);
  say('S ≈ 1.6×10¹⁹', '運算 ≈ 10²¹：平方倍成長');
  await beat(tok, 3000);
  glow(hi, null);
  tag('（紅柱為 log 刻度）', 'idx', 0, 0.4);
  txt(inp, 'b = log S：輸入 n·b，時間 n·2ᵇ');
  say('令 b = log S', 'b 跑到指數上：不是多項式');
  await beat(tok, 3000);
  say('看起來像多項式：pseudo', 'pseudo-polynomial = 假的多項式');
  await beat(tok, 3000);
}]);

// 59:51 Dijkstra 的輸入：log V + E(log V + log W) bits；時間 E + V log V ≤ E log V；W 不在時間裡
FRAG.push(['dpmit1-dijkstra-input', '對照 Dijkstra：權重的大小不在時間裡', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.8, 0]);
  const Y = 5.4;
  box('V=5', C.purple, -5.4, Y, 0.9, 0.6, 0.5, 1.3);
  tag('log V', 'idx', -5.4, Y - 0.7);
  say('Dijkstra 的輸入', '頂點數 + 邊的清單 (u, v, w)');
  await beat(tok, 2600);
  const ws = [];
  const tri = [[1, 2, 3], [1, 5, 4]];
  for (let e = 0; e < 2; e++) {
    const x0 = -3.6 + e * 3.6;
    box(tri[e][0], C.blue, x0, Y, 0.7, 0.6, 0.5, 1.3); box(tri[e][1], C.blue, x0 + 0.85, Y, 0.7, 0.6, 0.5, 1.3);
    ws.push(box(tri[e][2], C.orange, x0 + 1.75, Y, 0.85, 0.6, 0.5, 1.3));
    tag('log V  log V  log W', 'idx', x0 + 0.85, Y - 0.7);
    say('邊 ' + tri[e][0] + '→' + tri[e][1] + '，權重 ' + tri[e][2], '每條邊三個數字');
    await beat(tok, 1500);
  }
  tag('…', 'ptr', 4.4, Y);
  const f = tag('輸入 = log V + E(log V + log W) bits', 'ptr alt', 0, 3.6);
  say('輸入大小', 'v = log V、w = log W：O(E(v + w) + v)');
  await beat(tok, 3000);
  const t = tag('時間 E + V log V ≤ E·v', 'ptr', 0, 2.6);
  say('運算數 ≤ E log V', '對輸入大小是多項式');
  await beat(tok, 3000);
  ws.forEach((m) => { m.scale.set(1.7, 1, 1); glow(m, GOLD); });
  say('權重換成 64-bit', 'W 不在時間裡：運算數不變');
  await beat(tok, 3000);
  ws.forEach((m) => glow(m, null));
  const k = box('Knapsack：O(nS)', C.red, 0, 1.2, 3.4, 0.7, 0.6, 1.4);
  glow(k, RED);
  say('Knapsack：S 在時間裡', '換大 word size → 時間爆炸');
  await beat(tok, 3000);
  glow(k, null);
  say('Knapsack 有多項式解？', '那就證明了 P = NP');
  await beat(tok, 2600);
  say('counting sort 也一樣', '線性於範圍，不是輸入大小');
  await beat(tok, 3000);
}]);
  }

  // ═══ dpmit2.js ═══
  {
// ─── MIT 6.006 Fall 2011：Rec19 IFrvgSvZA0I（DP：Crazy Eights、Shortest Path）、Rec20 jZbkToeNK2g（DP：Blackjack、LIS） ───
// 老師的例子：Crazy Eights（like = 同數字／同花色／有 8；假 source、權重 −1、Bellman-Ford O(n³) vs DAG O(n²)）、
// DAG S A B C D E F G（d(S,A)=1、d(S,B)=2、d(S,C)=3、d(S,D)=4，C→G 讓 BFS 出錯）、曼哈頓格子 d(i,j)、optimal substructure、
// 有環的 S→A→B→C→A（1, −1, 1, 1）→ 分層 d_k = Bellman-Ford；blackjack 的 round_outcome(i, h)、邊 i → i+O[0] 權重 −O[1]、
// dp[i] = max(O[1] + dp[i+O[0]])、走人 = 0、parent pointer (值, h)；LIS 8 3 5 2 4 9 7 11。
// 板書看不到的權重、牌面為自擬（標在 notes 的 trap）。Blackjack DP 實跑用本模組的 DECK / bjPlay。
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, code, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat;
const M = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', brown: '#6e5f49', gold: '#c08a1f', ink: '#3a3328', card: '#fbf7f0', cardR: '#f6dede', ok: '#1f9e6e', faint: '#cfc6b4' };
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

// ── 共用：曼哈頓格子 5 × 4（權重自擬） ──
const GN = 5, GM = 4;
const gwh = (i, j) => ((i * 7 + j * 3) % 5) + 1;   // (i,j) → (i,j+1)
const gwv = (i, j) => ((i * 3 + j * 5) % 4) + 1;   // (i,j) → (i+1,j)
const GDIST = (() => { const d = {}; for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { if (i === 1 && j === 1) { d['1,1'] = 0; continue; } const c = []; if (i > 1) c.push(d[(i - 1) + ',' + j] + gwv(i - 1, j)); if (j > 1) c.push(d[i + ',' + (j - 1)] + gwh(i, j - 1)); d[i + ',' + j] = Math.min(...c); } return d; })();
function mGrid(x0, y0, dx, dy) {
  const P = (i, j) => [x0 + (j - 1) * dx, y0 - (i - 1) * dy], n = {}, eh = {}, ev = {};
  for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) { const p = P(i, j); n[i + ',' + j] = mBox('', M.sand, p[0], p[1], 0.5, 0.5, 0.3); }
  for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) {
    const p = P(i, j);
    if (j < GM) { eh[i + ',' + j] = mEdge(p, P(i, j + 1), M.brown, 0.32); tag(String(gwh(i, j)), 'idx', p[0] + dx / 2, p[1] + 0.22); }
    if (i < GN) { ev[i + ',' + j] = mEdge(p, P(i + 1, j), M.brown, 0.32); tag(String(gwv(i, j)), 'idx', p[0] + 0.22, p[1] - dy / 2); }
  }
  return { P, n, eh, ev };
}

// ── 共用：分層圖（S→A 1、A→B −1、B→C 1、C→A 1） ──
const LV = ['S', 'A', 'B', 'C'], LY = { S: 6.2, A: 4.7, B: 3.2, C: 1.7 }, LX = (k) => -4.5 + k * 3.0;
const LE = [['S', 'A', 1], ['A', 'B', -1], ['B', 'C', 1], ['C', 'A', 1]];
const LD = (() => { const d = [{ S: 0, A: Infinity, B: Infinity, C: Infinity }]; for (let k = 1; k <= 3; k++) { const r = { S: Infinity, A: Infinity, B: Infinity, C: Infinity }; for (const [u, v, w] of LE) r[v] = Math.min(r[v], d[k - 1][u] + w); d.push(r); } return d; })();
const inf = (x) => (x === Infinity ? '∞' : String(x));
function mLayers(withVals) {
  const n = {}, e = [], vt = {};
  for (let k = 0; k <= 3; k++) tag('k = ' + k, 'ptr', LX(k), 7.3);
  for (let k = 0; k <= 3; k++) for (const v of (k === 0 ? ['S'] : LV)) {
    const val = LD[k][v];
    n[v + k] = mBox(v + k, val === Infinity && withVals ? M.faint : (v === 'S' ? M.orange : M.sand), LX(k), LY[v], 0.8, 0.6, 0.4);
    if (withVals) vt[v + k] = tag(inf(val), 'idx', LX(k) + 0.75, LY[v] - 0.3);
  }
  for (let k = 0; k < 3; k++) for (const [u, v, w] of LE) if (n[u + k]) {
    const a = [LX(k), LY[u]], b = [LX(k + 1), LY[v]];
    const ed = mEdge(a, b, M.brown, 0.5); ed.u = u + k; ed.v = v + (k + 1);
    tag(String(w), 'idx', a[0] + 0.3 * (b[0] - a[0]), a[1] + 0.3 * (b[1] - a[1]) + 0.2);
    e.push(ed);
  }
  return { n, e, vt };
}

// ── 共用：一排節點／格子（blackjack） ──
const RX = (k) => -5.85 + k * 0.9;
function mRow(y, n, lab, size = 0.6, color = M.sand) { const r = []; for (let k = 0; k < n; k++) r.push(mBox(lab ? lab(k) : String(k), color, RX(k), y, size, size, 0.4)); return r; }

// ── 共用：LIS 8 3 5 2 4 9 7 11 ──
const LA = [8, 3, 5, 2, 4, 9, 7, 11];
const LISDP = (() => { const n = LA.length, d = Array(n).fill(1); for (let i = n - 1; i >= 0; i--) for (let j = i + 1; j < n; j++) if (LA[j] > LA[i]) d[i] = Math.max(d[i], 1 + d[j]); return d; })();
const LXp = (k) => -4.9 + k * 1.4;
function mLisRow(y, withIdx = true) {
  if (withIdx) LA.forEach((v, k) => tag(String(k), 'idx', LXp(k), y + 0.8));
  return LA.map((v, k) => mBox(v, M.blue, LXp(k), y, 0.9, 0.9, 0.5));
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

// 00:21 圖 → DP：不建圖，直接算數字（Rec20 34:43 也用）
FRAG.push(['dpmit2-graph-vs-dp', '從圖到 DP：狀態是節點，DP 不建圖直接算', async (tok) => {
  fresh([0, 3.4, 13], [0, 3.2, 0]);
  const gx = (k) => -5.6 + k * 1.0, ax = (k) => 1.6 + k * 1.0;
  const nodes = [0, 1, 2, 3, 4].map((k) => mBox(k, M.sand, gx(k), 3.6, 0.6, 0.6, 0.4, 1.5));
  tag('圖：節點 + 邊', 'ptr', -3.6, 6.4);
  await beat(tok, 600);
  for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4]]) mArc(gx(a), 3.95, gx(b), 3.95, mArcH(b - a) * 0.8, M.brown);
  say('以前：狀態當節點、走法當邊', '先建圖，再跑最短／最長路徑');
  await beat(tok, 2600);
  const cells = [0, 1, 2, 3, 4].map((k) => mBox('?', M.paper, ax(k), 3.6, 0.8, 0.7, 0.4, 1.5));
  [0, 1, 2, 3, 4].forEach((k) => tag(String(k), 'idx', ax(k), 4.4));
  tag('DP：一個陣列 dp[i]', 'ptr', 3.6, 6.4);
  say('DP：不建圖，直接算數字', 'dp[i] = 從 i 走到 4 的最長路徑');
  await beat(tok, 2600);
  const succ = { 0: [1, 2], 1: [3], 2: [3, 4], 3: [4], 4: [] }, dp = {};
  for (let i = 4; i >= 0; i--) {
    dp[i] = succ[i].length ? Math.max(...succ[i].map((j) => dp[j])) + 1 : 0;
    glow(nodes[i], GOLD); succ[i].forEach((j) => glow(cells[j], GOLD));
    relabel(cells[i], dp[i]); tint(cells[i], M.teal);
    say('dp[' + i + '] 只看它的後繼', succ[i].length ? 'dp[' + i + '] = max(' + succ[i].map((j) => 'dp[' + j + ']').join(', ') + ') + 1 = ' + dp[i] : 'dp[4] = 0（終點）');
    await beat(tok, 1500);
    glow(nodes[i], null); succ[i].forEach((j) => glow(cells[j], null));
  }
  say('程式短、跑得快', '但看不到背後的圖時，像黑魔法');
  await beat(tok, 2800);
  say('DP = 求 min / max 的最佳化', '難的是定義狀態（子問題）');
  await beat(tok, 3000);
}]);

// 01:47 Crazy Eights：like 的定義
FRAG.push(['dpmit2-crazy-like', 'Crazy Eights：同數字、同花色或有 8 就 like', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.6, 0]);
  const X = (k) => -4.2 + k * 1.4;
  const cs = CE.map((c, k) => mBox(c[0] + c[1], ceCol(c), X(k), 3.6, 1.0, 1.4, 0.08, 2));
  CE.forEach((c, k) => tag(String(k), 'idx', X(k), 2.5));
  say('Crazy Eights：抽出一排牌', '找最長的 crazy 子序列');
  await beat(tok, 2600);
  say('like：同數字、同花色、或有一張是 8', '8 跟任何牌都 like');
  await beat(tok, 2800);
  const pairs = [[0, 2, '8 萬用'], [2, 5, '8 萬用'], [1, 6, '數字、花色都不同'], [1, 3, '同花色 ♥'], [5, 3, '數字、花色都不同']];
  for (const [a, b, why] of pairs) {
    const ok = ceLike(CE[a], CE[b]);
    glow(cs[a], ok ? GREEN : RED); glow(cs[b], ok ? GREEN : RED);
    const mk = tag(ok ? '✓ like' : '✗', ok ? 'ptr' : 'ptr alt', (X(a) + X(b)) / 2, 5.0);
    say(CE[a].join('') + ' 和 ' + CE[b].join('') + (ok ? '：like' : '：不 like'), why);
    await beat(tok, 1900);
    glow(cs[a], null); glow(cs[b], null); kill(mk);
  }
  say('子序列：可以跳過，但不能重排', '選中的牌，相鄰兩張要 like');
  await beat(tok, 2800);
  const best = [0, 2, 3, 4, 5];
  cs.forEach((m, k) => { if (best.includes(k)) { move(m, X(k), 5.0); glow(m, GREEN); } else tint(m, GRAY); });
  say('最長：4♦ 8♦ 7♥ 7♠ 5♠', '長度 5（相鄰兩張都 like）');
  await beat(tok, 3200);
}]);

// 04:28 建圖：假 source、往右的邊、權重 −1、Bellman-Ford O(n³)
FRAG.push(['dpmit2-crazy-graph', 'Crazy Eights 建圖：權重 −1，最長變最短', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const X = (k) => -3.9 + k * 1.3, Y = 3.0;
  const cs = CE.map((c, k) => mBox(c[0] + c[1], ceCol(c), X(k), Y, 0.9, 1.1, 0.08, 1.5));
  say('每張牌是一個節點', '照原本的順序排好');
  await beat(tok, 2200);
  const arcs = [];
  for (let a = 0; a < CE.length; a++) for (let b = a + 1; b < CE.length; b++) if (ceLike(CE[a], CE[b])) {
    const e = mArc(X(a), Y + 0.6, X(b), Y + 0.6, mArcH(b - a), M.brown); e.a = a; e.b = b; arcs.push(e);
    say('like 而且在後面 → 有向邊', '只往右指：不能重排');
    await beat(tok, 260);
  }
  await beat(tok, 1600);
  const s = mBox('s', M.orange, -5.8, 0.6, 0.7, 0.7, 0.4, 2);
  const sa = CE.map((c, k) => mEdge([-5.8, 0.6], [X(k), Y], M.gold, 0.55));
  say('加一個假的 source s', '連到每張牌：從 s 出發的最長路徑');
  await beat(tok, 2800);
  const wt = arcs.map((e) => tag('−1', 'idx', e.mid[0], e.mid[1] + 0.2));
  say('我們只會求最短路徑', '每條邊權重改成 −1：最長 ⇔ 最短');
  await beat(tok, 2800);
  wt.forEach(kill);
  const path = [0, 2, 3, 4, 5];
  mCol(sa[0], M.ok);
  for (let k = 0; k + 1 < path.length; k++) { const e = arcs.find((x) => x.a === path[k] && x.b === path[k + 1]); mCol(e, M.ok); }
  path.forEach((k) => glow(cs[k], GREEN));
  say('最短距離 −5 → 最長子序列 5', '沒有環 → 答案有定義');
  await beat(tok, 2800);
  say('Bellman-Ford：O(VE)', 'V = n+1、E = O(n²) → O(n³)');
  await beat(tok, 3000);
}]);

// 09:24 DAG 的距離公式
FRAG.push(['dpmit2-dag-formulas', 'DAG 最短路徑：d(S,v) = min(入邊起點 + 權重)', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.0, 0]);
  const G = mDag();
  const vt = {}; DORD.forEach((v) => { vt[v] = tag('?', 'ptr alt', DG[v][0] + 0.75, DG[v][1] + 0.35); });
  say('一個 DAG：邊都往下指', '求 S 到每個點的最短距離');
  await beat(tok, 2600);
  txt(vt.S, '0'); glow(G.nodes.S, GREEN);
  say('d(S,S) = 0', '');
  await beat(tok, 1600);
  ['A', 'B', 'C'].forEach((v) => { txt(vt[v], String(DD[v])); glow(G.nodes[v], GREEN); });
  say('簡單的先填', 'd(S,A) = 1、d(S,B) = 2、d(S,C) = 3');
  await beat(tok, 2400);
  const caps = { D: 'S→D：從 A 來，或從 B 來', E: 'S→E：A、B、C 三條入邊', F: 'S→F：入邊來自 D、E、C', G: 'S→G：別漏了 C→G' };
  for (const v of ['D', 'E', 'F', 'G']) {
    const ins = DE.filter((e) => e[1] === v);
    ins.forEach(([u]) => { mCol(G.edges[u + v], M.gold); glow(G.nodes[u], GOLD); });
    glow(G.nodes[v], GOLD);
    say(caps[v], 'd(' + v + ') = min(' + ins.map(([u, , w]) => DD[u] + '+' + w).join(', ') + ') = ' + DD[v]);
    await beat(tok, 2600);
    txt(vt[v], String(DD[v]));
    mDagReset(G); DORD.forEach((x) => { if (vt[x].element.textContent !== '?') glow(G.nodes[x], GREEN); });
    await beat(tok, 400);
  }
  say('入邊起點的值都已知 → 直接算', '有遞迴，但不會無限遞迴');
  await beat(tok, 3000);
}]);

// 15:21 BFS 的陷阱與拓撲排序；O(V+E)
FRAG.push(['dpmit2-dag-topo', '拓撲排序：BFS 會被 C→G 騙；O(V+E)', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.8, 0]);
  const G = mDag();
  say('如果用 BFS 的層次來算…', '第 0 層 S；第 1 層 A、B、C');
  glow(G.nodes.S, GOLD); await beat(tok, 1400);
  ['A', 'B', 'C'].forEach((v) => glow(G.nodes[v], GOLD)); await beat(tok, 1400);
  ['D', 'E', 'F', 'G'].forEach((v) => glow(G.nodes[v], v === 'G' ? RED : GOLD));
  mCol(G.edges.CG, M.red);
  say('G 經 C→G 也在第 2 層', '可能先算 G，可是 E、F 還沒好');
  await beat(tok, 3000);
  DE.forEach(([u, v]) => { G.edges[u + v].kill(); kill(G.wl[u + v]); });
  DORD.forEach((v) => glow(G.nodes[v], null));
  const TX = (k) => -5.6 + k * 1.6, TY = 2.4;
  DORD.forEach((v, k) => move(G.nodes[v], TX(k), TY));
  say('改用拓撲排序', 'S A B C D E F G');
  await beat(tok, 2000);
  const idx = Object.fromEntries(DORD.map((v, k) => [v, k]));
  for (const [u, v] of DE) mArc(TX(idx[u]), TY + 0.45, TX(idx[v]), TY + 0.45, mArcH(idx[v] - idx[u]) * 0.9, M.brown);
  say('每條邊都往前指', '沒有往回的邊');
  await beat(tok, 2600);
  const cur = tag('▼', 'ptr alt', TX(0), TY + 1.0);
  for (let k = 0; k < DORD.length; k++) {
    move(cur, TX(k), TY - 1.0); glow(G.nodes[DORD[k]], GREEN); relabel(G.nodes[DORD[k]], DORD[k] + ' ' + DD[DORD[k]]);
    say('依序算：入邊的起點都算過了', 'd(' + DORD[k] + ') = ' + DD[DORD[k]]);
    await beat(tok, 700);
  }
  say('每條邊只看一次', '時間 = O(V + E)');
  await beat(tok, 2600);
  say('Crazy Eights：V′ + E′ = O(n²)', '比 Bellman-Ford 的 O(n³) 快');
  await beat(tok, 2800);
  say('DP 的拓撲順序通常很明顯', '卡牌就照原本的順序');
  await beat(tok, 2600);
}]);

// 22:14 曼哈頓格子：d(i,j) 的遞迴式
FRAG.push(['dpmit2-grid-rec', '曼哈頓格子：d(i,j) = min(上 + w, 左 + w)', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 3.8, 0]);
  const g = mGrid(-2.1, 6.6, 1.4, 1.35);
  say('格子圖：只能往右、往下', '每條邊有成本，求 s 到 t 最短');
  await beat(tok, 2800);
  const p11 = g.P(1, 1), p54 = g.P(GN, GM);
  tag('s (1,1)', 'ptr', p11[0] - 1.2, p11[1]); tag('t (5,4)', 'ptr', p54[0] + 1.2, p54[1]);
  say('節點編號 (i, j)', '左上 (1,1)，右下 (5,4)');
  await beat(tok, 2400);
  tint(g.n['1,1'], M.teal); relabel(g.n['1,1'], 0);
  say('d(1,1) = 0', '起點');
  await beat(tok, 2000);
  const i = 3, j = 3;
  glow(g.n[i + ',' + j], GOLD);
  glow(g.n[(i - 1) + ',' + j], GREEN); glow(g.n[i + ',' + (j - 1)], GREEN);
  mCol(g.ev[(i - 1) + ',' + j], M.ok); mCol(g.eh[i + ',' + (j - 1)], M.ok);
  say('d(i,j) 只能從上面或左邊來', 'd(i,j) = min(d(i−1,j) + w, d(i,j−1) + w)');
  await beat(tok, 3600);
  say('例：(3,3)', 'd(3,3) = min(d(2,3) + ' + gwv(2, 3) + ', d(3,2) + ' + gwh(3, 2) + ')');
  await beat(tok, 3000);
  say('這題曾在考試考倒很多人', '它其實就是 DAG 最短路徑');
  await beat(tok, 3000);
}]);

// 26:07 pseudocode：逐列填表
FRAG.push(['dpmit2-grid-code', '格子 DP：for i, for j 逐列填 d[i,j]', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.8, 0]);
  const cd = code(['for i in 1..n:', '  for j in 1..m:', '    if i == 1 and j == 1:', '      d[i,j] = 0', '    else:', '      d[i,j] = min(上 + w, 左 + w)', '      # 沒有上／左就略過'], -3.5, 6.4, 0.6);
  const g = mGrid(1.4, 6.4, 1.4, 1.3);
  say('拓撲順序：一列一列、由左到右', '寫成兩層 for 迴圈');
  cd.hl(0); await beat(tok, 2600);
  for (let i = 1; i <= GN; i++) for (let j = 1; j <= GM; j++) {
    const k = i + ',' + j, pre = [];
    if (i > 1) pre.push([g.n[(i - 1) + ',' + j], g.ev[(i - 1) + ',' + j]]);
    if (j > 1) pre.push([g.n[i + ',' + (j - 1)], g.eh[i + ',' + (j - 1)]]);
    pre.forEach(([m, e]) => { glow(m, GOLD); mCol(e, M.gold); });
    cd.hl(i === 1 && j === 1 ? 3 : 5);
    relabel(g.n[k], GDIST[k]); tint(g.n[k], M.teal);
    say(i === 1 && j === 1 ? 'base case：d[1,1] = 0' : (i === 1 || j === 1 ? '邊界：只有一個鄰居' : '上和左都已經算好'), 'd[' + i + ',' + j + '] = ' + GDIST[k]);
    await beat(tok, 650);
    pre.forEach(([m, e]) => { glow(m, null); mCol(e, M.brown); });
  }
  cd.hl(-1);
  say('照順序算 → 需要的值都在表裡', '知道拓撲順序就不需要 memo');
  await beat(tok, 3000);
  say('DP 難在定義狀態', '程式通常只有 5–10 行');
  await beat(tok, 2600);
}]);

// 32:13 Optimal substructure
FRAG.push(['dpmit2-opt-sub', 'Optimal substructure：最短路徑的一段也最短', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.0, 0]);
  const G = mDag();
  DORD.forEach((v) => relabel(G.nodes[v], v + ' ' + DD[v]));
  const P1 = ['SA', 'AD'], P2 = ['DF', 'FG'];
  [...P1, ...P2].forEach((e) => mCol(G.edges[e], M.ok));
  ['S', 'A', 'D', 'F', 'G'].forEach((v) => glow(G.nodes[v], GREEN));
  say('設 P 是 S → G 的最短路徑', 'P = S → A → D → F → G，成本 6');
  await beat(tok, 3000);
  P1.forEach((e) => mCol(G.edges[e], M.gold)); glow(G.nodes.D, GOLD);
  const l1 = tag('P1', 'ptr alt', -2.0, 6.6), l2 = tag('P2', 'ptr', 1.2, 1.9);
  say('P 經過 D：P = P1 + P2', 'P1 = S→A→D，P2 = D→F→G');
  await beat(tok, 2800);
  say('P1 一定是 S → D 的最短路徑', '大問題最佳解的一部分，也是最佳');
  await beat(tok, 3000);
  ['SB', 'BD'].forEach((e) => mCol(G.edges[e], M.red)); glow(G.nodes.B, RED);
  const l3 = tag('P3?', 'ptr alt', 0.6, 4.4);
  say('反證：若有更短的 P3 到 D', '換掉 P1 → 整條更短 → 矛盾');
  await beat(tok, 3000);
  say('這裡 S→B→D = 5 > 4', 'P1 確實是 S → D 最短');
  await beat(tok, 2600);
  kill(l3);
  say('沒有這個性質就不能用 DP', '通常是少記了狀態（例：油量）');
  await beat(tok, 3000);
}]);

// 37:08 有環：遞迴式互相依賴
FRAG.push(['dpmit2-cycle-rec', '有環：d(A) 要 d(C)、d(C) 要 d(B)、d(B) 又要 d(A)', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 3.8, 0]);
  const P = { S: [-5, 3], A: [-1.5, 3], B: [2.2, 5.2], C: [2.2, 0.8] };
  const n = {}; for (const v in P) n[v] = mBox(v, v === 'S' ? M.orange : M.sand, P[v][0], P[v][1], 0.8, 0.8, 0.5, 1.5);
  const E = {}; for (const [u, v, w] of LE) { E[u + v] = mEdge(P[u], P[v]); tag(sgn(w).replace('+', ''), 'idx', (P[u][0] + P[v][0]) / 2 + 0.3, (P[u][1] + P[v][1]) / 2 + 0.2); }
  say('S→A→B→C，再加 C→A', '權重 1、−1、1、1');
  await beat(tok, 2600);
  const cd = code(['d(S) = 0', 'd(A) = min(d(S)+1, d(C)+1)', 'd(B) = d(A) − 1', 'd(C) = d(B) + 1'], -2.6, 7.6, 0.55);
  say('照舊寫出每個點的遞迴式', '入邊有幾條，min 裡就有幾項');
  await beat(tok, 2800);
  cd.hl(1); glow(n.A, GOLD); glow(n.C, RED); mCol(E.CA, M.red);
  say('算 d(A) 要先有 d(C)', '');
  await beat(tok, 2000);
  cd.hl(3); glow(n.B, RED); mCol(E.BC, M.red);
  say('d(C) 要先有 d(B)', '');
  await beat(tok, 2000);
  cd.hl(2); mCol(E.AB, M.red); glow(n.A, RED);
  say('d(B) 又要 d(A)', 'A → C → B → A：繞回來了');
  await beat(tok, 2600);
  cd.hl(-1);
  say('依賴有環 → 無限遞迴', '找不到合法的計算順序');
  await beat(tok, 2800);
  say('解法：Bellman-Ford，或把環拆開', '狀態多記「用了幾條邊」');
  await beat(tok, 3000);
}]);

// 40:17 拆環：d_k(S, v)，分層圖
FRAG.push(['dpmit2-layers-build', '拆環：d_k(S,v) 用剛好 k 條邊，建分層圖', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  for (let k = 0; k <= 3; k++) tag('k = ' + k, 'ptr', LX(k), 7.3);
  say('新狀態：(v, k)', 'd_k(S,v) = min d_{k−1}(S,u) + w(u,v)');
  await beat(tok, 3000);
  const n = {};
  n.S0 = mBox('S0', M.orange, LX(0), LY.S, 0.8, 0.6, 0.4, 1.5); tag('0', 'idx', LX(0) + 0.75, LY.S - 0.3);
  say('k = 0：只有 S 自己', 'd₀(S,S) = 0，其他點 ∞（不能瞬移）');
  await beat(tok, 2800);
  const caps = { 1: ['k = 1：S0 → A1，成本 1', '其他點用 1 條邊到不了 → ∞'], 2: ['每條原本的邊都連到下一層', 'A1 → B2：1 + (−1) = 0'], 3: ['第三層：同樣的邊再接一次', 'B2 → C3：0 + 1 = 1'] };
  for (let k = 1; k <= 3; k++) {
    for (const v of LV) { const val = LD[k][v]; n[v + k] = mBox(v + k, val === Infinity ? M.faint : M.sand, LX(k), LY[v], 0.8, 0.6, 0.4, 1.2); }
    await beat(tok, 500);
    for (const [u, v, w] of LE) if (n[u + (k - 1)]) {
      const a = [LX(k - 1), LY[u]], b = [LX(k), LY[v]], fin = LD[k - 1][u] !== Infinity;
      mEdge(a, b, fin ? M.gold : M.brown, 0.5);
      tag(String(w), 'idx', a[0] + 0.3 * (b[0] - a[0]), a[1] + 0.3 * (b[1] - a[1]) + 0.2);
    }
    for (const v of LV) { tag(inf(LD[k][v]), 'idx', LX(k) + 0.75, LY[v] - 0.3); if (LD[k][v] !== Infinity) glow(n[v + k], GREEN); }
    say(caps[k][0], caps[k][1]);
    await beat(tok, 3000);
  }
  say('k 每層減 1 → 遞迴一定會停', '新圖只往右：是 DAG');
  await beat(tok, 3000);
}]);

// 45:44 要幾層？V′、E′ 與 Bellman-Ford
FRAG.push(['dpmit2-layers-bf', '分層圖 = Bellman-Ford：V−1 層，O(VE)', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  const L = mLayers(false);
  say('要幾層？', '最短路徑沒有環 → 最多 V−1 條邊');
  await beat(tok, 3000);
  const gb = [];
  for (let k = 1; k <= 3; k++) { const b = ghostBox(M.blue, 1.5, 5.8, 0.8); b.position.set(LX(k), 3.95, 0); gb.push(b); say('每一層是原圖的一份拷貝', '第 ' + k + ' 份'); await beat(tok, 900); }
  say('複製 V−1 份，再加上 S0', 'V′ = O(V²)');
  await beat(tok, 2600);
  L.e.forEach((e) => mCol(e, M.gold));
  say('相鄰兩層之間放一份所有邊', 'E′ = O(VE)');
  await beat(tok, 2600);
  say('新圖是 DAG：跑 DAG 演算法', 'O(V′ + E′) = O(V² + VE) = O(VE)');
  await beat(tok, 3000);
  L.e.forEach((e) => mCol(e, M.brown));
  say('這就是 Bellman-Ford', '第 k 輪 ≈ 用到第 k 層');
  await beat(tok, 3000);
}]);

// 49:06 讀答案：每個點取各層最小
FRAG.push(['dpmit2-layers-read', '讀答案：δ(S,v) = 各層 d_k(S,v) 取最小', async (tok) => {
  fresh([0, 4.2, 13], [0, 4.2, 0]);
  const L = mLayers(true);
  say('一次算出所有層的值', '');
  await beat(tok, 2200);
  const path = ['S0', 'A1', 'B2', 'C3'];
  path.forEach((v) => glow(L.n[v], GREEN));
  L.e.forEach((e) => { if (path.includes(e.u) && path.includes(e.v) && path.indexOf(e.v) === path.indexOf(e.u) + 1) mCol(e, M.ok); });
  say('唯一的路：S0 → A1 → B2 → C3', '');
  await beat(tok, 2800);
  for (const v of ['A', 'B', 'C']) {
    const ks = [1, 2, 3], vals = ks.map((k) => LD[k][v]), best = Math.min(...vals);
    ks.forEach((k) => glow(L.n[v + k], LD[k][v] === best ? GREEN : GOLD));
    say('S 到 ' + v + '：看 ' + v + '1、' + v + '2、' + v + '3', 'δ(S,' + v + ') = min(' + vals.map(inf).join(', ') + ') = ' + best);
    await beat(tok, 2600);
    ks.forEach((k) => glow(L.n[v + k], path.includes(v + k) ? GREEN : null));
  }
  glow(L.n.S0, GOLD);
  say('起點條件只有 S0 = 0', '其他值都從它推出來');
  await beat(tok, 3000);
}]);

// ════════════════ jZbkToeNK2g（MIT 6.006 Rec20：Blackjack、LIS） ════════════════

// 00:21 抽象化：round_outcome(i, h)
FRAG.push(['dpmit2-bj-outcome', 'Blackjack 抽象化：round_outcome(i, h)', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.6, 0]);
  const SX = (k) => -6.12 + k * 0.24;
  const deck = Array.from({ length: 52 }, (_, k) => mBox('', M.card, SX(k), 6.3, 0.2, 0.8, 0.08));
  tag('0', 'idx', SX(0), 5.6); tag('51', 'idx', SX(51), 5.6);
  say('Perfect information：整副牌已知', '52 張，編號 0…51');
  await beat(tok, 2800);
  for (let k = 0; k < 5; k++) tint(deck[k], GRAY);
  const it = tag('i = 5', 'ptr alt', SX(5), 7.2);
  say('前面幾局已用掉 i 張', '這一局從第 i 張開始');
  await beat(tok, 2400);
  tag('玩家', 'ptr', -3.4, 4.9); tag('莊家', 'ptr', 2.6, 4.9);
  const P = [], D = [];
  const deal = (k, toP) => {
    const arr = toP ? P : D, x = (toP ? -4.4 : 1.6) + arr.length * 0.9;
    tint(deck[k], M.gold);
    const c = mBox('c' + k, M.card, SX(k), 6.3, 0.75, 1.0, 0.08); arr.push(c); move(c, x, 3.6);
  };
  say('開局：玩家 2 張、莊家 2 張', '');
  for (const [k, toP] of [[5, true], [6, false], [7, true], [8, false]]) { deal(k, toP); await beat(tok, 550); }
  await beat(tok, 900);
  say('唯一的決定：要 hit 幾張（h）', '牌都知道，不必每張再決定');
  await beat(tok, 2600);
  deal(9, true);
  say('h = 1：玩家再拿 1 張', '');
  await beat(tok, 1600);
  deal(10, false);
  say('莊家照固定規則補牌', '< 17 就拿');
  await beat(tok, 2000);
  tag('round_outcome(5, 1) = (6, +1)', 'ptr alt', 0, 1.7);
  say('回傳 (O[0], O[1])', 'O[0] = 這局用掉 6 張，O[1] = +1（贏 $1）');
  await beat(tok, 3000);
  say('規則全藏在這個 helper 裡', 'O[1] 只會是 +1、0、−1');
  await beat(tok, 2600);
}]);

// 06:11 建圖：節點 = 已用掉幾張；邊 i → i + O[0]，權重 −O[1]
FRAG.push(['dpmit2-bj-graph', 'Blackjack 建圖：邊 i → i + O[0]，權重 −O[1]', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const Y = 2.6, row = mRow(Y, 14);
  tag('… 52', 'idx', 6.65, Y);
  say('節點 i：已經玩掉 i 張牌', '0, 1, 2, …, 52');
  await beat(tok, 2600);
  glow(row[0], GREEN);
  say('永遠從 0 出發', '還有 52 張');
  await beat(tok, 2000);
  glow(row[0], null); glow(row[5], GOLD);
  say('一條邊 = 打一局', '從 i 出發，每個 h 一條邊');
  await beat(tok, 2400);
  const bad = mArc(RX(5), Y + 0.4, RX(6), Y + 0.4, mArcH(1), M.red), bl = tag('✗ 連到 O[0] = 6', 'ptr alt', RX(6), Y + 1.6);
  say('錯：連到 O[0] = 6', '忘了前面已用掉 i 張');
  await beat(tok, 2600);
  bad.kill(); kill(bl);
  const ex = [[1, 6, 1, M.ok], [0, 5, -1, M.gold], [2, 7, -1, M.gold]];
  for (const [h, o0, o1, col] of ex) {
    const j = 5 + o0;
    mArc(RX(5), Y + 0.4, RX(j), Y + 0.4, mArcH(o0), col);
    tag('h=' + h + '：' + sgn(-o1), 'idx', RX(j), Y - 0.75 - 0.45 * h);
    glow(row[j], h === 1 ? GREEN : GOLD);
    say('h = ' + h + '：(' + o0 + ', ' + sgn(o1) + ') → 邊 5 → ' + j, '終點 = i + O[0] = 5 + ' + o0);
    await beat(tok, 2400);
  }
  say('邊權 = −O[1]', '贏 $1 → 成本 −1');
  await beat(tok, 2600);
  say('賺最多 = 最長路徑', '權重取負 → 變成最短路徑');
  await beat(tok, 2800);
}]);

// 13:20 DAG：邊都往右，拓撲排序 + relax
FRAG.push(['dpmit2-bj-dag', 'Blackjack 圖是 DAG：拓撲排序 + relax，O(V+E)', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const Y = 2.4, row = mRow(Y, 14);
  tag('… 52', 'idx', 6.65, Y);
  say('權重 −O[1]：有負的邊', '邊權只有 −1、0、+1');
  await beat(tok, 2600);
  const ex = [[0, [4, 5, 6]], [3, [7, 8]], [6, [10, 11, 12]], [8, [12, 13]]];
  for (const [i, js] of ex) { for (const j of js) mArc(RX(i), Y + 0.4, RX(j), Y + 0.4, mArcH(j - i) * 0.85, M.brown); await beat(tok, 400); }
  say('每局至少用 4 張', '邊都往右，至少跨 4 格');
  await beat(tok, 2600);
  say('沒有往回的邊 → 沒有環', '這是 DAG');
  await beat(tok, 2400);
  const cur = tag('▲', 'ptr alt', RX(0), Y - 0.9);
  for (let k = 0; k < 14; k++) { move(cur, RX(k), Y - 0.9); glow(row[k], GREEN); say('拓撲順序就是 0, 1, 2, …', '依序 relax 每條邊'); await beat(tok, 260); }
  say('DAG 最短路徑：O(V + E)', '');
  await beat(tok, 2400);
  say('Dijkstra 要先把權重 +1 變非負', '還要 O(E + V log V)，比較慢');
  await beat(tok, 3000);
}]);

// 18:01 DP：dp[i] = max over h (O[1] + dp[i + O[0]])
FRAG.push(['dpmit2-bj-dp', 'Blackjack DP：dp[i] = max(O[1] + dp[i + O[0]])', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.0, 0]);
  const cd = code(['# dp[i]：從第 i 張開局，最多淨贏多少', 'for h in 0 .. 52−i:', '  o = round_outcome(i, h)', '  choices.append(o[1] + dp[i + o[0]])', 'dp[i] = max(choices)'], -0.6, 7.6, 0.58);
  const Y = 2.0, cells = mRow(Y, 14, () => '?', 0.75, M.paper);
  for (let k = 0; k < 14; k++) tag(String(k), 'idx', RX(k), Y - 0.7);
  tag('… 52', 'idx', 6.65, Y);
  cd.hl(0);
  say('DP：不建圖，只用陣列 dp[0…52]', 'dp[i] 對應圖上的節點 i');
  await beat(tok, 3000);
  const known = { 10: 19, 11: 20, 12: 18 };
  for (const k in known) { relabel(cells[k], known[k]); tint(cells[k], M.teal); }
  tag('（假設已算好）', 'idx', RX(11), Y + 0.75);
  say('假設後面已算好', 'dp[10] = 19、dp[11] = 20、dp[12] = 18');
  await beat(tok, 2800);
  glow(cells[5], GOLD);
  const chl = tag('choices = [ ]', 'ptr', -3.6, 4.0), got = [];
  const ex = [[0, 5, -1], [1, 6, 1], [2, 7, -1]];
  for (const [h, o0, o1] of ex) {
    const j = 5 + o0, v = o1 + known[j];
    cd.hl(1); await beat(tok, 300); cd.hl(2);
    const a = mArc(RX(5), Y + 0.35, RX(j), Y + 0.35, mArcH(o0) * 0.8, M.gold); glow(cells[j], GOLD);
    say('h = ' + h + '：o = (' + o0 + ', ' + sgn(o1) + ')', sgn(o1) + ' + dp[' + j + '] = ' + v);
    await beat(tok, 1800);
    cd.hl(3); got.push(v); txt(chl, 'choices = [' + got.join(', ') + ']');
    await beat(tok, 900);
    a.kill(); glow(cells[j], null);
  }
  cd.hl(4); relabel(cells[5], 21); tint(cells[5], M.ok); glow(cells[5], GREEN);
  say('取最大：dp[5] = 21', 'max(18, 21, 17)：這局 hit 1 張');
  await beat(tok, 2800);
  cd.hl(-1);
  say('圖：邊 i → i+O[0]，權重 −O[1]', 'DP：O[1] + dp[i + O[0]] 取 max');
  await beat(tok, 3000);
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
  say('一副 12 張的牌（已知順序）', 'dp[0…12]，12 = 牌用完');
  await beat(tok, 2600);
  let arcs = S.tries[2].map((t) => mArc(cx(2), 3.4, cx(t.j), 3.4, mArcH(t.j - 2) * 0.55, M.gold));
  glow(cells[2], GOLD);
  say('算 dp[2] 要用右邊的 dp[j]', '箭頭 = 依賴，全都往右');
  await beat(tok, 2800);
  arcs.forEach((a) => a.kill()); glow(cells[2], null);
  say('依賴 → 拓撲順序', 'i 從 12 往 0 遞減');
  await beat(tok, 2400);
  for (let i = n; i >= 0; i--) {
    const tr = S.tries[i];
    if (!tr.length) { relabel(cells[i], 0); tint(cells[i], GRAY); say('剩不到 4 張：開不了局', 'dp[' + i + '] = 0'); await beat(tok, 380); continue; }
    glow(cells[i], GOLD);
    arcs = tr.map((t) => mArc(cx(i), 3.4, cx(t.j), 3.4, mArcH(t.j - i) * 0.55, t === S.par[i] ? M.ok : M.gold));
    tr.forEach((t) => glow(cells[t.j], GOLD));
    relabel(cells[i], S.dp[i]); tint(cells[i], S.dp[i] > 0 ? M.teal : S.dp[i] < 0 ? M.red : M.sand);
    say('i = ' + i + '：試 h = 0…' + (tr.length - 1), 'max(' + tr.map((t) => sgn(t.out) + '+' + nm(S.dp[t.j])).join(', ') + ') = ' + mn(S.dp[i]));
    await beat(tok, 1500);
    arcs.forEach((a) => a.kill()); glow(cells[i], null); tr.forEach((t) => glow(cells[t.j], null));
  }
  glow(cells[0], GREEN);
  say('dp[0] = ' + S.dp[0] + '：整副牌最多淨贏 $' + S.dp[0], '用到的值都先算好，不會出錯');
  await beat(tok, 3000);
}]);

// 31:25 走人（0）與 parent pointers
FRAG.push(['dpmit2-bj-parent', '走人 = 0 的選項；parent pointer 存 (值, h)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const A = mBjSolve(false), S = mBjSolve(true), n = DECK.length;
  const cx = (k) => -6.0 + k * 1.0;
  DECK.forEach((c, k) => mBox(cardName(c), M.card, cx(k), 5.6, 0.7, 0.95, 0.08));
  const cells = Array.from({ length: n + 1 }, (_, k) => mBox(A.dp[k], A.dp[k] < 0 ? M.red : M.paper, cx(k), 3.0, 0.8, 0.7, 0.4));
  for (let k = 0; k <= n; k++) tag(String(k), 'idx', cx(k), 2.3);
  say('上一版：只比較各種 h', '有些格子是負的');
  await beat(tok, 2600);
  const neg = []; for (let i = 0; i <= n; i++) if (A.dp[i] < 0) neg.push(i);
  const i0 = neg[0] !== undefined ? neg[0] : 6;
  glow(cells[i0], GOLD);
  const w = mArc(cx(i0), 3.4, cx(n), 3.4, mArcH(n - i0) * 0.5, M.ok), wl = tag('走人：0', 'ptr', (cx(i0) + cx(n)) / 2, 5.0 - 0.2);
  say('漏了一個選擇：走人', '一條成本 0 的邊直接到終點');
  await beat(tok, 2800);
  relabel(cells[i0], S.dp[i0]); tint(cells[i0], M.sand);
  say('choices 一開始就放 0', 'dp[' + i0 + '] = max(0, ' + S.tries[i0].map((t) => sgn(t.out) + '+' + nm(S.dp[t.j])).join(', ') + ') = ' + mn(S.dp[i0]));
  await beat(tok, 2800);
  w.kill(); kill(wl); glow(cells[i0], null);
  const ht = [];
  for (let i = n; i >= 0; i--) {
    relabel(cells[i], S.dp[i]); tint(cells[i], S.dp[i] > 0 ? M.teal : M.sand);
    ht.push(tag(S.par[i].h < 0 ? '走' : 'h' + S.par[i].h, 'idx', cx(i), 1.8));
    await beat(tok, 140);
  }
  say('Parent pointer：每格存 (值, h)', 'tuple 先比值 → max 照樣能用');
  await beat(tok, 3000);
  let i = 0, total = 0;
  while (i < n && S.par[i].h >= 0) {
    const p = S.par[i];
    glow(cells[i], GREEN);
    mArc(cx(i), 3.4, cx(p.j), 3.4, mArcH(p.j - i) * 0.55, M.ok);
    total += p.out;
    say('在 ' + i + '：hit ' + p.h + ' 張 → 跳到 ' + p.j, '這局 ' + sgn(p.out) + '，累計 ' + sgn(total));
    await beat(tok, 2400);
    i = p.j;
  }
  glow(cells[i], GREEN);
  say('到 ' + i + '：不再開局（走人）', '跟著 parent 走完：總共 ' + sgn(total));
  await beat(tok, 3000);
}]);

// 37:19 LIS：問題與子問題
FRAG.push(['dpmit2-lis-def', 'LIS：dp[i] = 從 a[i] 開始的最長遞增子序列', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.8, 0]);
  const c = mLisRow(4.0);
  c.forEach((m, k) => { m.position.y = 4.0; });
  say('一串數字：找最長遞增子序列', 'LIS：可以跳著選，順序不能變');
  await beat(tok, 2800);
  [1, 2, 6].forEach((k) => glow(c[k], GREEN));
  let mk = tag('3, 5, 7 ✓', 'ptr', 0, 6.4);
  say('3, 5, 7：遞增 ✓', '');
  await beat(tok, 2000);
  [1, 2, 6].forEach((k) => glow(c[k], null)); kill(mk);
  [0, 2, 5].forEach((k) => glow(c[k], RED));
  mk = tag('8, 5, 9 ✗', 'ptr alt', 0, 6.4);
  say('8, 5, 9：不是遞增 ✗', '');
  await beat(tok, 2000);
  [0, 2, 5].forEach((k) => glow(c[k], null)); kill(mk);
  glow(c[1], GOLD);
  const arcs = [2, 4, 5, 6, 7].map((j) => mArc(LXp(1), 4.5, LXp(j), 4.5, mArcH(j - 1) * 0.6, j === 2 || j === 4 ? M.gold : M.faint));
  say('從 3 出發：下一個可選 5、4、…', '比 3 大、在 3 後面的都行');
  await beat(tok, 2800);
  arcs.forEach((a) => a.kill());
  mArc(LXp(1), 4.5, LXp(4), 4.5, mArcH(3) * 0.6, M.ok);
  for (let k = 4; k < 8; k++) tint(c[k], M.teal);
  const gb = ghostBox(M.teal, 5.6, 1.3, 0.8); gb.position.set((LXp(4) + LXp(7)) / 2, 4.0, 0);
  say('選了 4 → 接著要「從 4 開始」的最長', '前面怎麼選，都不影響後面');
  await beat(tok, 3000);
  say('子問題：從 a[i] 開始的 LIS', 'dp[i] = 長度，i = 0 … n−1（0-based）');
  await beat(tok, 3000);
}]);

// 40:58 pseudocode：預設 1、j 從 i+1 起、a[j] > a[i] 才能接
FRAG.push(['dpmit2-lis-code', 'LIS 的 pseudocode：choices = [1]，a[j] > a[i] 才加 1 + dp[j]', async (tok) => {
  fresh([0, 4.0, 13], [0, 4.2, 0]);
  const cd = code(['for i in n−1 … 0:', '  choices = [1]        # 後面都不選', '  for j in i+1 … n−1:', '    if a[j] > a[i]:', '      choices.append(1 + dp[j])', '  dp[i] = max(choices)', 'answer = max(dp)'], -0.6, 7.8, 0.56);
  const c = mLisRow(1.8);
  say('原陣列叫 a，答案存在 dp', '直接看下一個落點 j，不數跳過幾個');
  cd.hl(0); await beat(tok, 2800);
  const i = 1; glow(c[i], GOLD);
  const it = tag('i', 'ptr alt', LXp(i), 0.8);
  cd.hl(1);
  say('預設選項 1：後面都不選', '少了它會扣分');
  await beat(tok, 2400);
  const jt = tag('j', 'ptr', LXp(2), 0.8);
  for (let j = i + 1; j < LA.length; j++) {
    move(jt, LXp(j), 0.8); cd.hl(3);
    const ok = LA[j] > LA[i];
    glow(c[j], ok ? GREEN : RED);
    say('a[' + j + '] = ' + LA[j] + ' > ' + LA[i] + ' ?', ok ? '✓ 加入 1 + dp[' + j + ']' : '✗ 跳過（不能從 3 接到 2）');
    await beat(tok, 700);
    if (ok) { cd.hl(4); await beat(tok, 500); }
  }
  cd.hl(5);
  say('dp[i] = max(choices)', '');
  await beat(tok, 2200);
  cd.hl(6);
  say('答案 = max(dp)', '不是 dp[0]：起點可以是任何一個數');
  await beat(tok, 3000);
}]);

// 45:31 實跑 8 3 5 2 4 9 7 11
FRAG.push(['dpmit2-lis-run', 'LIS 實跑：dp 由右往左 = 3 4 3 4 3 2 2 1', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.6, 0]);
  const c = mLisRow(4.6);
  const d = LA.map((v, k) => mBox('?', M.paper, LXp(k), 2.8, 0.9, 0.7, 0.4));
  tag('a', 'ptr', -6.2, 4.6); tag('dp', 'ptr', -6.2, 2.8);
  say('範例：8 3 5 2 4 9 7 11', 'for i 從 n−1 到 0');
  await beat(tok, 2600);
  for (let i = LA.length - 1; i >= 0; i--) {
    glow(c[i], GOLD);
    const js = []; for (let j = i + 1; j < LA.length; j++) if (LA[j] > LA[i]) js.push(j);
    js.forEach((j) => glow(d[j], GOLD));
    const ch = [1, ...js.map((j) => 1 + LISDP[j])];
    say('i = ' + i + '（a = ' + LA[i] + '）' + (js.length ? '：可接 ' + js.map((j) => LA[j]).join('、') : '：後面沒有更大的'), 'choices = [' + ch.join(', ') + '] → dp = ' + LISDP[i]);
    await beat(tok, 1800);
    relabel(d[i], LISDP[i]); tint(d[i], M.teal);
    let arc = null;
    const pj = js.find((j) => 1 + LISDP[j] === LISDP[i]);
    if (pj !== undefined) arc = mArc(LXp(i), 5.1, LXp(pj), 5.1, mArcH(pj - i) * 0.5, M.ok);
    await beat(tok, 500);
    glow(c[i], null); js.forEach((j) => glow(d[j], null)); if (arc) arc.kill();
  }
  say('dp = [' + LISDP.join(', ') + ']', 'parent 指向任一個 dp 少 1 的格子都行');
  await beat(tok, 3000);
}]);

// 52:12 答案是 max(dp)；圖的看法
FRAG.push(['dpmit2-lis-max', 'LIS 答案 = max(dp) = 4，不是 dp[0]', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.6, 0]);
  const c = mLisRow(4.0);
  const d = LA.map((v, k) => mBox(LISDP[k], M.teal, LXp(k), 2.2, 0.9, 0.7, 0.4));
  tag('dp', 'ptr', -6.2, 2.2);
  glow(d[0], RED);
  say('答案不是 dp[0] = 3', '起點不一定是第一個數');
  await beat(tok, 2600);
  glow(d[0], null); [1, 3].forEach((k) => glow(d[k], GREEN));
  say('取 max(dp) = 4', 'dp[1] = dp[3] = 4');
  await beat(tok, 2600);
  const arcs = [];
  for (let i = 0; i < LA.length; i++) for (let j = i + 1; j < LA.length; j++) if (LA[i] < LA[j]) { const a = mArc(LXp(i), 4.5, LXp(j), 4.5, mArcH(j - i) * 0.45, M.faint); a.i = i; a.j = j; arcs.push(a); }
  say('圖的看法：前小後大就連邊', 'LIS = DAG 上的最長路徑');
  await beat(tok, 2800);
  const path = [1, 4, 5, 7];
  for (let k = 0; k + 1 < path.length; k++) mCol(arcs.find((a) => a.i === path[k] && a.j === path[k + 1]), M.ok);
  path.forEach((k) => glow(c[k], GREEN));
  say('跟著 parent：3 → 4 → 9 → 11', '長度 4（2 → 4 → 7 → 11 也行）');
  await beat(tok, 3000);
  say('對照 blackjack：一定從第 0 張開始', '所以那題的答案是 dp[0]');
  await beat(tok, 3000);
  say('不懂時：畫成圖、寫最短路徑', '再對照 DP 的遞迴式');
  await beat(tok, 2800);
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
