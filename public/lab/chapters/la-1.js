// 線性代數 第1章：矩陣與線性方程組（row / column picture、高斯消去、RREF、自由變數、三種解、elementary matrix、A = LU）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   MIT 18.06 L4（5hO3MrzPa0A，有字幕）：(AB)⁻¹ = B⁻¹A⁻¹（穿襪穿鞋）、(Aᵀ)⁻¹ = (A⁻¹)ᵀ、A = [2 1; 8 7] = LU 與 LDU、
//     E32E31E21A = U → A = LU、E 裡出現 10 而 L = [1 0 0; 2 1 0; 0 5 1]、運算量 n² + (n−1)² + … ≈ n³/3、
//     3×3 的 6 個 permutation matrix、P⁻¹ = Pᵀ、4×4 有 24 個。
//   課本補充（Strang《Introduction to Linear Algebra》Ch1–2；L1、L2 影片尚無字幕，例題取自 Strang 課本／講義常用例）：
//     2x − y = 0、−x + 2y = 3 的 row / column picture；3×3 的三平面與 column picture；
//     A = [1 2 1; 3 8 1; 0 4 1]、b = (2, 12, 2) 的消去與回代；elementary matrix；pivot 為 0 的換列與失敗；
//     A = [1 2 2 2; 2 4 6 8; 3 6 8 10] 的 RREF 與自由變數；解的三種情況。
// 注意：本章影片清單裡的 3Blue1Brown「Essence of calculus」系列是微積分，不屬於線性代數，沒有做任何場景。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const rint = (a, b) => a + rnd(b - a + 1);
  const pick = (arr) => arr[rnd(arr.length)];
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', REDG = '#6a1010';
  const COL = { a: '#4b9ee2', b: '#9b7ef4', c: '#2fc092', piv: '#dd8238', zero: '#d8cfc0', hot: '#e55a9b', l: '#31aab0', u: '#c08a1f', red: '#d64545' };
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => SUB[+d]).join('');
  const cl = (x) => (Math.abs(x) < 1e-10 ? 0 : x);
  function fmt(x) {
    if (!isFinite(x)) return '∞';
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x) || 0).replace('-', '−');
    for (let q = 2; q <= 64; q++) { const p = x * q; if (Math.abs(p - Math.round(p)) < 1e-7) return (p < 0 ? '−' : '') + Math.abs(Math.round(p)) + '/' + q; }
    return x.toFixed(2).replace('-', '−');
  }
  const opStr = (t, s, k) => 'R' + sub(t + 1) + (k >= 0 ? ' − ' + fmt(k) : ' + ' + fmt(-k)) + '·R' + sub(s + 1);
  function fresh(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  // wait: in scenes tok is the shell token; in modes tok is undefined and we abort when the mode changes
  async function W(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    return fn().catch((err) => { if (!/changed/.test(String(err && err.message))) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }
  async function anim(tok, ms, fn) { const n = 12; for (let k = 1; k <= n; k++) { fn(k / n); await W(tok, ms / n); } }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    if (o.parent) o.parent.remove(o);
    o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m && m.material) m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function rod(color, r = 0.045) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.castShadow = true; lab.world.add(m); return m;
  }
  function setRod(m, p, q) {
    const d = q.clone().sub(p), L = d.length();
    m.visible = L > 1e-4; if (!m.visible) return;
    m.scale.set(1, L, 1); m.position.copy(p).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }
  function arrow(color, r = 0.06) {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat), hd = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
    sh.castShadow = hd.castShadow = true;
    g.add(sh, hd); g.userData = { sh, hd, mat }; lab.world.add(g); return g;
  }
  function setArrow(g, p, q) {
    const d = q.clone().sub(p), L = d.length();
    g.visible = L > 1e-3; if (!g.visible) return;
    const hl = Math.min(0.3, L * 0.45), { sh, hd } = g.userData;
    sh.scale.set(1, L - hl, 1); sh.position.set(0, (L - hl) / 2, 0);
    hd.scale.set(1, hl, 1); hd.position.set(0, L - hl / 2, 0);
    g.position.copy(p); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }
  function dot(color, r = 0.14) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    m.castShadow = true; lab.world.add(m); return m;
  }
  // a 2-D coordinate board standing upright (x right, y up), origin at (ox, oy)
  function board(ox, oy, s, ext, z = 0) {
    const P = (x, y) => V3(ox + x * s, oy + y * s, z);
    const pts = [];
    for (let k = -ext; k <= ext; k++) pts.push(P(k, -ext), P(k, ext), P(-ext, k), P(ext, k));
    lab.world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e2d3b8' })));
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2 * ext * s + 0.3, 2 * ext * s + 0.3), new THREE.MeshStandardMaterial({ color: '#fffaf1', roughness: 1 }));
    bg.position.set(ox, oy, z - 0.03); bg.receiveShadow = true; lab.world.add(bg);
    setRod(rod('#6e5f49', 0.022), P(-ext, 0), P(ext, 0)); setRod(rod('#6e5f49', 0.022), P(0, -ext), P(0, ext));
    const xl = P(ext + 0.45, 0), yl = P(0, ext + 0.45);
    tag('x', 'idx', xl.x, xl.y, xl.z); tag('y', 'idx', yl.x, yl.y, yl.z);
    return { P, s, ext };
  }
  // the segment of a·x + b·y = c inside the square [−e, e]²
  function clipLine(a, b, c, e) {
    const pts = [];
    if (Math.abs(b) > 1e-9) for (const x of [-e, e]) { const y = (c - a * x) / b; if (Math.abs(y) <= e + 1e-9) pts.push([x, y]); }
    if (Math.abs(a) > 1e-9) for (const y of [-e, e]) { const x = (c - b * y) / a; if (Math.abs(x) <= e + 1e-9) pts.push([x, y]); }
    if (pts.length < 2) return null;
    let best = null, bd = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > bd) { bd = d; best = [pts[i], pts[j]]; } }
    return bd > 1e-6 ? best : null;
  }
  // 3-D math space: math (x, y, z) with z up → three (x, z, −y)
  function space(o, s, ext = 3) {
    const P = (x, y, z) => V3(o[0] + x * s, o[1] + z * s, o[2] - y * s);
    const D = (x, y, z) => V3(x * s, z * s, -y * s);
    [[ext, 0, 0, 'x'], [0, ext, 0, 'y'], [0, 0, ext, 'z']].forEach(([x, y, z, n]) => {
      setRod(rod('#8a7a60', 0.018), P(-x, -y, -z), P(x, y, z));
      const p = P(x * 1.1, y * 1.1, z * 1.1); tag(n, 'idx', p.x, p.y, p.z);
    });
    return { P, D, s };
  }
  function plane3(sp, n, d, color, size, focus = [0, 0, 0]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 }));
    const nn = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
    const t = (n[0] * focus[0] + n[1] * focus[1] + n[2] * focus[2] - d) / nn;
    const c = [focus[0] - n[0] * t, focus[1] - n[1] * t, focus[2] - n[2] * t];
    m.position.copy(sp.P(...c));
    m.quaternion.setFromUnitVectors(V3(0, 0, 1), sp.D(...n).normalize());
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color })));
    lab.world.add(m);
    return m;
  }

  // ── matrix of blocks standing upright; aug = column index where the right-hand side starts ──
  function mview(M, cx, cy, o = {}) {
    const R = M.length, C = M[0].length, s = o.s || 0.8, w = s * 0.82, z = o.z || 0, aug = o.aug;
    const gap = aug !== undefined ? s * 0.35 : 0, width = C * s + gap;
    const X = (j) => cx - width / 2 + s / 2 + j * s + (aug !== undefined && j >= aug ? gap : 0);
    const Y = (i) => cy + ((R - 1) / 2 - i) * s;
    const mv = { R, C, v: M.map((r) => r.slice()), cells: [], X, Y, z, s, extra: [], piv: new Set(), aug, cx, cy };
    mv.colorOf = (v, i, j) => (o.colorOf ? o.colorOf(v, i, j) : mv.piv.has(i + ',' + j) ? COL.piv : Math.abs(v) < 1e-9 ? COL.zero : aug !== undefined && j >= aug ? COL.b : o.color || COL.a);
    for (let i = 0; i < R; i++) {
      const row = [];
      for (let j = 0; j < C; j++) {
        const m = lab.box(mv.colorOf(M[i][j], i, j), [w, w, 0.34]);
        if (!(o.hideZero && Math.abs(M[i][j]) < 1e-9)) { m.userData.lbl = lab.label(typeof M[i][j] === 'number' ? fmt(M[i][j]) : M[i][j], 'val'); m.add(m.userData.lbl); }
        m.position.set(X(j), Y(i), z); lab.world.add(m); row.push(m);
      }
      mv.cells.push(row);
    }
    const h = R * s + 0.1, xl = cx - width / 2 - 0.08, xr = cx + width / 2 + 0.08;
    for (const [x, dir] of [[xl, 1], [xr, -1]]) {
      const b = lab.box('#6e5f49', [0.05, h, 0.05]); b.position.set(x, cy, z); lab.world.add(b); mv.extra.push(b);
      for (const yy of [cy + h / 2, cy - h / 2]) { const t = lab.box('#6e5f49', [0.16, 0.05, 0.05]); t.position.set(x + dir * 0.08, yy, z); lab.world.add(t); mv.extra.push(t); }
    }
    if (aug !== undefined) { const b = lab.box('#a89272', [0.03, h - 0.1, 0.03]); b.position.set((X(aug - 1) + X(aug)) / 2, cy, z); lab.world.add(b); mv.extra.push(b); }
    if (o.name) { mv.nameL = tag(o.name, o.nameCls || 'ptr', cx, cy + h / 2 + 0.36, z); mv.extra.push(mv.nameL); }
    mv.set = (i, j, v) => {
      v = cl(v); mv.v[i][j] = v; const m = mv.cells[i][j];
      if (m.userData.lbl) txt(m.userData.lbl, typeof v === 'number' ? fmt(v) : v);
      else if (!(o.hideZero && Math.abs(v) < 1e-9)) { m.userData.lbl = lab.label(fmt(v), 'val'); m.add(m.userData.lbl); }
      tint(m, mv.colorOf(v, i, j));
    };
    mv.pivot = (i, j, onP = true) => { if (onP) mv.piv.add(i + ',' + j); else mv.piv.delete(i + ',' + j); tint(mv.cells[i][j], mv.colorOf(mv.v[i][j], i, j)); };
    mv.glowRow = (i, c) => mv.cells[i].forEach((m) => glow(m, c));
    mv.glowCol = (j, c) => mv.cells.forEach((r) => glow(r[j], c));
    mv.glowCell = (i, j, c) => glow(mv.cells[i][j], c);
    mv.unglow = () => mv.cells.flat().forEach((m) => glow(m, null));
    mv.kill = () => { mv.cells.flat().forEach(kill); mv.extra.forEach(kill); };
    return mv;
  }
  // R_t ← R_t − k·R_s : a pink copy of k·(row s) flies onto row t, then row t updates
  async function rowOp(tok, mv, t, s, k, ms = 1100) {
    if (Math.abs(k) < 1e-12) return;
    mv.glowRow(s, GOLD);
    const gh = [];
    for (let j = 0; j < mv.C; j++) {
      const g = lab.box(COL.hot, [mv.s * 0.6, mv.s * 0.6, 0.22]);
      g.add(lab.label(fmt(cl(k * mv.v[s][j])), 'val'));
      g.position.set(mv.X(j), mv.Y(s), mv.z + 0.42); lab.world.add(g); gh.push(g);
    }
    await W(tok, ms * 0.35);
    gh.forEach((g, j) => move(g, mv.X(j), mv.Y(t), mv.z + 0.42));
    await W(tok, ms * 0.45);
    gh.forEach(kill);
    for (let j = 0; j < mv.C; j++) mv.set(t, j, mv.v[t][j] - k * mv.v[s][j]);
    mv.glowRow(s, null); mv.glowRow(t, GREEN);
    await W(tok, ms * 0.4);
    mv.glowRow(t, null);
  }
  async function swapRows(tok, mv, a, b, ms = 1000) {
    mv.glowRow(a, GOLD); mv.glowRow(b, GOLD);
    for (let j = 0; j < mv.C; j++) { move(mv.cells[a][j], mv.X(j), mv.Y(b), mv.z + 0.55); move(mv.cells[b][j], mv.X(j), mv.Y(a), mv.z - 0.55); }
    await W(tok, ms * 0.5);
    for (let j = 0; j < mv.C; j++) { move(mv.cells[a][j], mv.X(j), mv.Y(b), mv.z); move(mv.cells[b][j], mv.X(j), mv.Y(a), mv.z); }
    await W(tok, ms * 0.5);
    [mv.cells[a], mv.cells[b]] = [mv.cells[b], mv.cells[a]];
    [mv.v[a], mv.v[b]] = [mv.v[b], mv.v[a]];
    const np = new Set();
    for (const key of mv.piv) { const [i, j] = key.split(',').map(Number); np.add((i === a ? b : i === b ? a : i) + ',' + j); }
    mv.piv = np;
    mv.unglow();
  }
  async function scaleRow(tok, mv, r, k, ms = 900) {
    mv.glowRow(r, GOLD);
    await W(tok, ms * 0.5);
    for (let j = 0; j < mv.C; j++) mv.set(r, j, mv.v[r][j] / k);
    await W(tok, ms * 0.5);
    mv.glowRow(r, null);
  }
  // elimination plan on the first `nc` columns; full = reduce to RREF (pivots 1, zeros above)
  function planElim(M0, nc, full) {
    const M = M0.map((r) => r.slice()), R = M.length, steps = [], piv = [];
    let r = 0;
    for (let c = 0; c < nc && r < R; c++) {
      let p = -1;
      for (let i = r; i < R; i++) if (Math.abs(M[i][c]) > 1e-9) { p = i; break; }
      if (p < 0) { steps.push({ t: 'free', c, r }); continue; }
      if (p !== r) { [M[p], M[r]] = [M[r], M[p]]; steps.push({ t: 'swap', a: r, b: p }); }
      steps.push({ t: 'pivot', i: r, j: c, v: M[r][c] });
      piv.push([r, c]);
      if (full && Math.abs(M[r][c] - 1) > 1e-9) { const k = M[r][c]; M[r] = M[r].map((x) => cl(x / k)); steps.push({ t: 'scale', r, k }); }
      for (let i = full ? 0 : r + 1; i < R; i++) {
        if (i === r) continue;
        const k = M[i][c] / M[r][c];
        if (Math.abs(k) < 1e-12) continue;
        M[i] = M[i].map((x, j) => cl(x - k * M[r][j]));
        steps.push({ t: 'sub', tg: i, s: r, k });
      }
      r++;
    }
    for (let c = 0; c < nc; c++) if (!piv.some((p) => p[1] === c) && !steps.some((s) => s.t === 'free' && s.c === c)) steps.push({ t: 'free', c, r });
    return { steps, M, piv, rank: r };
  }
  async function doStep(tok, mv, st, ms = 1100) {
    if (st.t === 'swap') { say('pivot 位置是 0：換列 R' + sub(st.a + 1) + ' ↔ R' + sub(st.b + 1), '換列 = 乘上 permutation matrix'); await swapRows(tok, mv, st.a, st.b, ms); }
    else if (st.t === 'pivot') { mv.pivot(st.i, st.j); mv.glowCell(st.i, st.j, GOLD); say('pivot = ' + fmt(st.v) + '（第 ' + (st.j + 1) + ' 行）', 'pivot 不能是 0'); await W(tok, ms * 0.7); mv.glowCell(st.i, st.j, null); }
    else if (st.t === 'scale') { say('整列除以 pivot ' + fmt(st.k), 'R' + sub(st.r + 1) + ' ÷ ' + fmt(st.k)); await scaleRow(tok, mv, st.r, st.k, ms); }
    else if (st.t === 'sub') { say('multiplier ℓ = ' + fmt(st.k), opStr(st.tg, st.s, st.k)); await rowOp(tok, mv, st.tg, st.s, st.k, ms); }
    else if (st.t === 'free') { mv.glowCol(st.c, REDG); say('第 ' + (st.c + 1) + ' 行找不到 pivot', '→ x' + sub(st.c + 1) + ' 是 free variable'); await W(tok, ms * 0.8); mv.glowCol(st.c, null); }
  }
  const matMul = (A, B) => A.map((r) => B[0].map((_, j) => cl(r.reduce((s, a, k) => s + a * B[k][j], 0))));

  // ───────────────────────── 模式 1：方程組的兩種圖像（2×2） ─────────────────────────
  const pic = { A: [[2, -1], [-1, 2]], b: [0, 3], view: 'row', x: 0, y: 0 };
  let pv = null;
  function enterPicture() {
    fresh([0, 3.3, 11.5], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.55, 5);
    pv = { bd, r1: rod(COL.a, 0.05), r2: rod(COL.b, 0.05), hit: dot(COL.piv), l1: tag('', 'ptr', 0, 0), l2: tag('', 'ptr alt', 0, 0),
      c1: arrow(COL.a), c2: arrow(COL.b), bA: arrow(COL.u, 0.07), x1: arrow(COL.a, 0.045), y2: arrow(COL.b, 0.045), tip: dot(COL.hot, 0.11),
      lc1: tag('', 'idx', 0, 0), lc2: tag('', 'idx', 0, 0), lb: tag('b', 'ptr alt', 0, 0) };
    const A = pic.A, b = pic.b;
    controls('<input id="p11" type="number" value="' + A[0][0] + '" style="width:44px">x + <input id="p12" type="number" value="' + A[0][1] + '" style="width:44px">y = <input id="pb1" type="number" value="' + b[0] + '" style="width:44px">'
      + '　<input id="p21" type="number" value="' + A[1][0] + '" style="width:44px">x + <input id="p22" type="number" value="' + A[1][1] + '" style="width:44px">y = <input id="pb2" type="number" value="' + b[1] + '" style="width:44px">'
      + '<select id="pView"><option value="row">Row picture（兩條線）</option><option value="col">Column picture（行向量組合）</option></select>'
      + '<label>x <input id="pX" type="range" min="-4" max="4" step="0.5" value="' + pic.x + '" style="width:90px"></label><label>y <input id="pY" type="range" min="-4" max="4" step="0.5" value="' + pic.y + '" style="width:90px"></label>'
      + '<button class="primary" id="pSolve">解出來</button><button id="pEx">Strang 例題</button><button id="pSing">singular 例</button>');
    $('pView').value = pic.view;
    const read = () => { pic.A = [[+$('p11').value || 0, +$('p12').value || 0], [+$('p21').value || 0, +$('p22').value || 0]]; pic.b = [+$('pb1').value || 0, +$('pb2').value || 0]; drawPicture(); };
    ['p11', 'p12', 'p21', 'p22', 'pb1', 'pb2'].forEach((id) => { $(id).onchange = read; });
    $('pView').onchange = (e) => { pic.view = e.target.value; drawPicture(); };
    $('pX').oninput = (e) => { pic.x = +e.target.value; drawPicture(); };
    $('pY').oninput = (e) => { pic.y = +e.target.value; drawPicture(); };
    on('pSolve', () => runOp(async () => {
      const s = solve2(pic.A, pic.b);
      if (s.kind !== 'unique') { log(s.kind === 'none' ? '無解：兩條線平行（column picture：b 不在兩個行向量張成的直線上）。' : '無限多解：兩條線重合；任何一組解都行，例如 ' + s.note, true); return; }
      if (pic.view === 'row') { log('Row picture：兩條線交於 (' + fmt(s.x) + ', ' + fmt(s.y) + ')。'); drawPicture(); return; }
      const x0 = pic.x, y0 = pic.y;
      await anim(undefined, 900, (t) => { pic.x = x0 + (s.x - x0) * t; drawPicture(); });
      await anim(undefined, 900, (t) => { pic.y = y0 + (s.y - y0) * t; drawPicture(); });
      log('Column picture：' + fmt(s.x) + '·col₁ + ' + fmt(s.y) + '·col₂ 剛好到 b。');
    }));
    on('pEx', () => { pic.A = [[2, -1], [-1, 2]]; pic.b = [0, 3]; pic.x = 0; pic.y = 0; enterPicture(); });
    on('pSing', () => { pic.A = [[1, 2], [2, 4]]; pic.b = [3, 5]; pic.x = 0; pic.y = 0; enterPicture(); });
    log('Row picture：每個方程式是一條線，解 = 交點。Column picture：找 x、y 讓 x·col₁ + y·col₂ = b。');
    drawPicture();
  }
  function solve2(A, b) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(det) > 1e-9) return { kind: 'unique', det, x: (b[0] * A[1][1] - A[0][1] * b[1]) / det, y: (A[0][0] * b[1] - b[0] * A[1][0]) / det };
    // singular: consistent iff the augmented rows are dependent too
    const r1 = [A[0][0], A[0][1], b[0]], r2 = [A[1][0], A[1][1], b[1]];
    const zero1 = r1.slice(0, 2).every((v) => v === 0), zero2 = r2.slice(0, 2).every((v) => v === 0);
    let cons;
    if (zero1 || zero2) cons = (zero1 ? b[0] === 0 : true) && (zero2 ? b[1] === 0 : true);
    else cons = Math.abs(r1[0] * r2[2] - r1[2] * r2[0]) < 1e-9 && Math.abs(r1[1] * r2[2] - r1[2] * r2[1]) < 1e-9;
    let note = '';
    if (cons) { const [a, bb, c] = zero1 ? r2 : r1; note = Math.abs(bb) > 1e-9 ? '(0, ' + fmt(c / bb) + ')' : '(' + fmt(c / a) + ', 0)'; }
    return { kind: cons ? 'inf' : 'none', det, note };
  }
  function drawPicture() {
    if (!pv) return;
    const { bd } = pv, A = pic.A, b = pic.b, e = bd.ext, rowV = pic.view === 'row';
    const s = solve2(A, b);
    [pv.r1, pv.r2, pv.l1, pv.l2].forEach((o) => { o.visible = rowV; });
    [pv.c1, pv.c2, pv.bA, pv.x1, pv.y2, pv.tip, pv.lc1, pv.lc2, pv.lb].forEach((o) => { o.visible = !rowV; });
    pv.hit.visible = false;
    const eq = (r, c) => fmt(A[r][0]) + 'x ' + (A[r][1] < 0 ? '− ' + fmt(-A[r][1]) : '+ ' + fmt(A[r][1])) + 'y = ' + fmt(c);
    if (rowV) {
      [[pv.r1, pv.l1, 0], [pv.r2, pv.l2, 1]].forEach(([r, l, k]) => {
        const seg = clipLine(A[k][0], A[k][1], b[k], e);
        if (!seg) { r.visible = false; l.visible = false; return; }
        setRod(r, bd.P(...seg[0]), bd.P(...seg[1]));
        const p = bd.P(seg[1][0] * 0.8, seg[1][1] * 0.8); l.position.set(p.x + (k ? 0.2 : -0.2), p.y + 0.35, 0.1); txt(l, eq(k, b[k]));
      });
      if (s.kind === 'unique' && Math.abs(s.x) <= e && Math.abs(s.y) <= e) { pv.hit.visible = true; pv.hit.position.copy(bd.P(s.x, s.y)).setZ(0.1); }
    } else {
      const c1 = [A[0][0], A[1][0]], c2 = [A[0][1], A[1][1]];
      const O = bd.P(0, 0).setZ(0.08);
      setArrow(pv.c1, O, bd.P(...c1).setZ(0.08)); setArrow(pv.c2, O, bd.P(...c2).setZ(0.08)); setArrow(pv.bA, O, bd.P(...b).setZ(0.05));
      pv.c1.userData.mat.opacity = 0.35; pv.c1.userData.mat.transparent = true; pv.c2.userData.mat.opacity = 0.35; pv.c2.userData.mat.transparent = true;
      const m1 = [pic.x * c1[0], pic.x * c1[1]], tipv = [m1[0] + pic.y * c2[0], m1[1] + pic.y * c2[1]];
      const cap = (p) => [Math.max(-e, Math.min(e, p[0])), Math.max(-e, Math.min(e, p[1]))];
      setArrow(pv.x1, O.clone().setZ(0.16), bd.P(...cap(m1)).setZ(0.16)); setArrow(pv.y2, bd.P(...cap(m1)).setZ(0.16), bd.P(...cap(tipv)).setZ(0.16));
      pv.tip.position.copy(bd.P(...cap(tipv))).setZ(0.2);
      const p1 = bd.P(...c1), p2 = bd.P(...c2), pb = bd.P(...cap(b));
      pv.lc1.position.set(p1.x, p1.y + 0.3, 0.2); txt(pv.lc1, 'col₁ (' + fmt(c1[0]) + ', ' + fmt(c1[1]) + ')');
      pv.lc2.position.set(p2.x, p2.y + 0.3, 0.2); txt(pv.lc2, 'col₂ (' + fmt(c2[0]) + ', ' + fmt(c2[1]) + ')');
      pv.lb.position.set(pb.x + 0.4, pb.y + 0.3, 0.2); txt(pv.lb, 'b (' + fmt(b[0]) + ', ' + fmt(b[1]) + ')');
      const hitB = Math.abs(tipv[0] - b[0]) < 1e-9 && Math.abs(tipv[1] - b[1]) < 1e-9;
      glow(pv.tip, hitB ? GREEN : null);
    }
    if ($('pX')) { $('pX').value = pic.x; $('pY').value = pic.y; }
    const sol = s.kind === 'unique' ? '唯一解 (' + fmt(s.x) + ', ' + fmt(s.y) + ')' : s.kind === 'none' ? '無解' : '無限多解';
    setState(rowV ? 'Row picture：兩條線' : 'Column picture：x·col₁ + y·col₂', [['方程式 1', eq(0, b[0])], ['方程式 2', eq(1, b[1])], ['ad − bc', fmt(s.det)], ['結果', sol]].concat(rowV ? [] : [['目前組合', fmt(pic.x) + '·col₁ + ' + fmt(pic.y) + '·col₂']]),
      s.kind === 'unique' ? '<span class="ok">兩行向量不共線</span>：組合填滿整個平面，任何 b 都到得了' : '<span class="no">兩行向量共線</span>：組合只是一條線；b 在線上 → 無限多解，不在 → 無解');
  }

  // ───────────────────────── 模式 2：三個平面（3×3） ─────────────────────────
  const PLANE_CASES = {
    strang: { name: 'Strang 例題（唯一解）', eqs: [[2, -1, 0, 0], [-1, 2, -1, -1], [0, -3, 4, 4]], focus: [0, 0, 1] },
    unique: { name: '唯一解：交於一點', eqs: [[1, 1, 1, 3], [1, -1, 0, 0], [0, 1, -1, 0]], focus: [1, 1, 1] },
    parallel: { name: '無解：兩平面平行', eqs: [[1, 1, 1, 1], [1, 1, 1, 3], [1, -1, 0, 0]], focus: [0.6, 0.6, 0.6] },
    prism: { name: '無解：兩兩相交成三條平行線', eqs: [[1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 4]], focus: [1, 1, 0.5] },
    line: { name: '無限多解：交於一條線', eqs: [[1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 2]], focus: [1, 1, 0] },
  };
  const planes = { kind: 'strang', custom: null };
  function caseOf(eqs) {
    const pl = planElim(eqs, 3, true), M = pl.M;
    const bad = M.some((r) => Math.abs(r[0]) < 1e-9 && Math.abs(r[1]) < 1e-9 && Math.abs(r[2]) < 1e-9 && Math.abs(r[3]) > 1e-9);
    return { M, rank: pl.rank, kind: bad ? 'none' : pl.rank === 3 ? 'unique' : 'inf', piv: pl.piv };
  }
  const eqStr = (e) => { let s = ''; ['x', 'y', 'z'].forEach((v, k) => { const c = e[k]; if (!c) return; s += (s ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : '') + (Math.abs(c) === 1 ? '' : fmt(Math.abs(c))) + v; }); return (s || '0') + ' = ' + fmt(e[3]); };
  function drawPlanes(eqs, focus, sp) {
    const colors = [COL.a, COL.b, COL.c];
    const meshes = eqs.map((e, k) => plane3(sp, e.slice(0, 3), e[3], colors[k], 4.4, focus));
    const info = caseOf(eqs);
    if (info.kind === 'unique') { const p = dot(COL.piv, 0.16); p.position.copy(sp.P(...info.M.map((r) => r[3]))); }
    if (info.kind === 'inf' && info.rank === 2) {
      const n1 = eqs[0], n2 = eqs[1];
      const d = [n1[1] * n2[2] - n1[2] * n2[1], n1[2] * n2[0] - n1[0] * n2[2], n1[0] * n2[1] - n1[1] * n2[0]];
      const L = Math.hypot(...d), u = d.map((x) => x / L);
      // a point on the line: from RREF set free variable 0
      const pt = [0, 0, 0]; info.piv.forEach(([r, c]) => { pt[c] = info.M[r][3]; });
      setRod(rod(COL.piv, 0.06), sp.P(...pt.map((x, k) => x - 2.2 * u[k])), sp.P(...pt.map((x, k) => x + 2.2 * u[k])));
    }
    return { meshes, info };
  }
  function enterPlanes() {
    fresh([6.2, 6.4, 10.5], [0, 3, 0]);
    controls('<select id="plKind">' + Object.keys(PLANE_CASES).map((k) => '<option value="' + k + '">' + PLANE_CASES[k].name + '</option>').join('') + '</select><button class="primary" id="plRand">隨機唯一解</button><button id="plShow">一張一張出現</button>');
    $('plKind').value = planes.kind;
    $('plKind').onchange = (e) => { planes.kind = e.target.value; planes.custom = null; enterPlanes(); };
    on('plRand', () => {
      const sol = [rint(-1, 1), rint(-1, 1), rint(0, 2)];
      let eqs;
      do { eqs = [0, 1, 2].map(() => { const n = [rint(-2, 2), rint(-2, 2), rint(-2, 2)]; return [...n, n[0] * sol[0] + n[1] * sol[1] + n[2] * sol[2]]; }); } while (caseOf(eqs).kind !== 'unique');
      planes.custom = { name: '隨機', eqs, focus: sol }; enterPlanes();
    });
    on('plShow', () => runOp(async () => {
      for (const m of cur.meshes) m.visible = false;
      for (let k = 0; k < 3; k++) { cur.meshes[k].visible = true; log('第 ' + (k + 1) + ' 個平面：' + eqStr(C.eqs[k])); await W(undefined, 1000); }
    }));
    const C = planes.custom || PLANE_CASES[planes.kind];
    const sp = space([0, 2.9, 0], 0.8, 2.8);
    const cur = drawPlanes(C.eqs, C.focus, sp);
    const info = cur.info, last = info.M[2];
    const kindTxt = info.kind === 'unique' ? '唯一解 (' + info.M.map((r) => fmt(r[3])).join(', ') + ')' : info.kind === 'none' ? '無解' : '無限多解（' + (3 - info.rank) + ' 個 free variable）';
    setState('三個平面：' + C.name, C.eqs.map((e, k) => ['平面 ' + (k + 1), eqStr(e)]).concat([['rank', String(info.rank)], ['結果', kindTxt]]),
      'RREF 最後一列：[' + last.slice(0, 3).map(fmt).join(' ') + ' | ' + fmt(last[3]) + ']<br>'
      + (info.kind === 'none' ? '<span class="no">出現 0 = 非零 → 無解</span>' : info.kind === 'unique' ? '<span class="ok">3 個 pivot → 唯一解</span>' : '<span class="ok">0 = 0，有 free variable → 無限多解</span>'));
    log('拖曳畫面可以旋轉，看清楚三個平面怎麼相交。');
  }

  // ───────────────────────── 模式 3：高斯消去（含回代） ─────────────────────────
  const STRANG_A = [[1, 2, 1], [3, 8, 1], [0, 4, 1]], STRANG_B = [2, 12, 2];
  const el = { M: STRANG_A.map((r, i) => [...r, STRANG_B[i]]), plan: null, k: 0, mv: null, sol: null };
  function randomSystem(forceSwap) {
    for (;;) {
      const L = [[1, 0, 0], [rint(-2, 2), 1, 0], [rint(-2, 2), rint(-2, 2), 1]];
      const U = [[pick([1, 2, -1]), rint(-2, 2), rint(-2, 2)], [0, pick([1, 2, -1, 3]), rint(-2, 2)], [0, 0, pick([1, 2, -2, 3])]];
      let A = matMul(L, U);
      if (forceSwap) A = [A[0], A[2], A[1]].map((r) => r.slice());
      const x = [rint(-2, 3), rint(-2, 3), rint(-2, 3)];
      const b = A.map((r) => r[0] * x[0] + r[1] * x[1] + r[2] * x[2]);
      const M = A.map((r, i) => [...r, b[i]]);
      const p = planElim(M, 3, false);
      if (forceSwap && !p.steps.some((s) => s.t === 'swap')) continue;
      if (p.rank === 3 && Math.max(...M.flat().map(Math.abs)) <= 20) return M;
    }
  }
  function enterElim() {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    el.plan = planElim(el.M, 3, false); el.k = 0; el.sol = null;
    el.mv = mview(el.M, -1.2, 3.4, { aug: 3, name: '[A | b]', s: 0.95 });
    el.solL = [0, 1, 2].map((i) => tag('', 'ptr alt', 2.9, el.mv.Y(i)));
    controls('<button class="primary" id="eStep">下一步</button><button id="eAll">自動跑完</button><button id="eStrang">Strang 例題</button><button id="eNew">隨機題</button><button id="eSwap">需要換列的題</button>');
    on('eStep', () => runOp(() => elimStep()));
    on('eAll', () => runOp(async () => { while (el.k < el.plan.steps.length + 3) await elimStep(); }));
    on('eStrang', () => { el.M = STRANG_A.map((r, i) => [...r, STRANG_B[i]]); enterElim(); });
    on('eNew', () => { el.M = randomSystem(false); enterElim(); });
    on('eSwap', () => { el.M = randomSystem(true); enterElim(); });
    log('消去：用 pivot 把下方的數字消成 0，得到上三角 U；再由下往上回代。');
    elimState();
  }
  async function elimStep() {
    const n = el.plan.steps.length;
    if (el.k < n) { const st = el.plan.steps[el.k++]; await doStep(undefined, el.mv, st, 900); log(stepLog(st)); }
    else if (el.k < n + 3) {
      const i = 2 - (el.k - n); el.k++;
      if (!el.sol) el.sol = [0, 0, 0];
      const U = el.mv.v; let s = U[i][3];
      for (let j = i + 1; j < 3; j++) s -= U[i][j] * el.sol[j];
      el.sol[i] = cl(s / U[i][i]);
      el.mv.glowRow(i, GREEN);
      const nm = ['x', 'y', 'z'][i];
      txt(el.solL[i], nm + ' = ' + fmt(el.sol[i]));
      say('回代：第 ' + (i + 1) + ' 列解出 ' + nm, nm + ' = ' + fmt(el.sol[i]));
      log('回代：' + nm + ' = ' + fmt(el.sol[i]));
      await W(undefined, 700); el.mv.glowRow(i, null);
    } else { log('已經解完了。按「隨機題」再來一題。', true); }
    elimState();
  }
  const stepLog = (st) => st.t === 'swap' ? '換列 R' + sub(st.a + 1) + ' ↔ R' + sub(st.b + 1) : st.t === 'pivot' ? 'pivot = ' + fmt(st.v) : st.t === 'sub' ? opStr(st.tg, st.s, st.k) + '（multiplier ' + fmt(st.k) + '）' : st.t === 'scale' ? 'R' + sub(st.r + 1) + ' ÷ ' + fmt(st.k) : '第 ' + (st.c + 1) + ' 行沒有 pivot';
  function elimState() {
    const n = el.plan.steps.length, pivs = el.plan.piv.map(([r, c]) => fmt(el.plan.M[r][c]));
    setState('高斯消去 [A | b]', [['步驟', Math.min(el.k, n + 3) + ' / ' + (n + 3)], ['階段', el.k < n ? '向前消去' : el.k < n + 3 ? '回代' : '完成'], ['pivots', el.k >= n ? pivs.join(', ') : '…'], ['解', el.sol && el.k >= n + 3 ? '(' + el.sol.map(fmt).join(', ') + ')' : '…']],
      'ℓᵢⱼ = (要消掉的數) ÷ pivot<br>' + (el.k >= n + 3 ? '<span class="ok">檢查：A·x = b</span>' : 'Rᵢ − ℓᵢⱼ·Rⱼ'));
  }

  // ───────────────────────── 模式 4：RREF 與自由變數 ─────────────────────────
  const STRANG_R = [[1, 2, 2, 2], [2, 4, 6, 8], [3, 6, 8, 10]];
  const rr = { M: STRANG_R.map((r) => r.slice()), plan: null, k: 0, mv: null };
  function randomRank() {
    for (;;) {
      const r = rint(1, 3);
      const cols = [0, 1, 2, 3].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, r).sort();
      const R = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      cols.forEach((c, i) => { R[i][c] = 1; for (let j = c + 1; j < 4; j++) if (!cols.includes(j)) R[i][j] = rint(-2, 2); });
      const E = matMul([[1, 0, 0], [rint(-2, 2), 1, 0], [rint(-2, 2), rint(-2, 2), 1]], [[pick([1, 2]), rint(-1, 1), rint(-1, 1)], [0, 1, rint(-1, 1)], [0, 0, 1]]);
      const M = matMul(E, R);
      if (Math.max(...M.flat().map(Math.abs)) <= 12 && M[0].some((v) => v)) return M;
    }
  }
  function enterRref() {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    rr.plan = planElim(rr.M, 4, true); rr.k = 0;
    rr.mv = mview(rr.M, 0, 3.6, { name: 'A → R = rref(A)', s: 0.95 });
    rr.colL = [0, 1, 2, 3].map((j) => tag('x' + sub(j + 1), 'idx', rr.mv.X(j), rr.mv.Y(2) - 0.85));
    controls('<button class="primary" id="rStep">下一步</button><button id="rAll">自動跑完</button><button id="rStrang">Strang 例題</button><button id="rNew">隨機矩陣</button>');
    on('rStep', () => runOp(() => rrefStep()));
    on('rAll', () => runOp(async () => { while (rr.k <= rr.plan.steps.length) await rrefStep(); }));
    on('rStrang', () => { rr.M = STRANG_R.map((r) => r.slice()); enterRref(); });
    on('rNew', () => { rr.M = randomRank(); enterRref(); });
    log('RREF：pivot 都變成 1、pivot 上下都是 0。沒有 pivot 的行 = free variable。');
    rrefState();
  }
  async function rrefStep() {
    const n = rr.plan.steps.length;
    if (rr.k < n) { const st = rr.plan.steps[rr.k++]; await doStep(undefined, rr.mv, st, 850); log(stepLog(st)); }
    else if (rr.k === n) {
      rr.k++;
      const pc = rr.plan.piv.map((p) => p[1]);
      [0, 1, 2, 3].forEach((j) => { const free = !pc.includes(j); txt(rr.colL[j], 'x' + sub(j + 1) + (free ? '：free' : '：pivot')); rr.colL[j].element.className = 'lab-label ' + (free ? 'ptr alt' : 'ptr'); });
      say('pivot 行 ' + pc.map((c) => c + 1).join('、') + '；free 有 ' + (4 - pc.length) + ' 個', 'Ax = 0 的 special solutions 有 ' + (4 - pc.length) + ' 個');
      log('rank = ' + pc.length + '，free variables = 4 − ' + pc.length + ' = ' + (4 - pc.length));
      specials().forEach((s) => log('special solution：(' + s.map(fmt).join(', ') + ')'));
    } else log('已經是 RREF 了。按「隨機矩陣」再來一題。', true);
    rrefState();
  }
  function specials() {
    const R = rr.plan.M, pc = rr.plan.piv.map((p) => p[1]), out = [];
    for (let f = 0; f < 4; f++) {
      if (pc.includes(f)) continue;
      const x = [0, 0, 0, 0]; x[f] = 1;
      rr.plan.piv.forEach(([r, c]) => { x[c] = cl(-R[r][f]); });
      out.push(x);
    }
    return out;
  }
  function rrefState() {
    const n = rr.plan.steps.length, done = rr.k > n, pc = rr.plan.piv.map((p) => p[1] + 1);
    setState('RREF 與自由變數（Ax = 0）', [['步驟', Math.min(rr.k, n + 1) + ' / ' + (n + 1)], ['rank r', done ? String(pc.length) : '…'], ['pivot 行', done ? pc.join('、') : '…'], ['free 變數', done ? String(4 - pc.length) + ' 個' : '…']],
      done ? 'n − r = 4 − ' + pc.length + ' = ' + (4 - pc.length) + ' 個 special solution<br>' + specials().map((s) => '(' + s.map(fmt).join(', ') + ')').join('<br>') : 'free 變數設 1 / 0，從 R 讀出 pivot 變數');
  }

  // ───────────────────────── 模式 5：A = LU ─────────────────────────
  const lu = { A: STRANG_A.map((r) => r.slice()), steps: [], k: 0, mvA: null, mvL: null };
  function enterLU() {
    fresh([0, 3.2, 11], [0, 3, 0]);
    lu.steps = planElim(lu.A, 3, false).steps.filter((s) => s.t === 'sub' || s.t === 'pivot'); lu.k = 0;
    lu.mvA = mview(lu.A, -2.7, 3.4, { name: 'A → U', s: 0.9 });
    lu.mvL = mview([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 2.7, 3.4, { name: 'L（存 multipliers）', nameCls: 'ptr alt', s: 0.9, colorOf: (v, i, j) => (i === j ? '#e9dcc4' : i > j ? (Math.abs(v) > 1e-9 ? COL.l : COL.zero) : COL.zero) });
    controls('<button class="primary" id="uStep">下一步</button><button id="uAll">自動跑完</button><button id="uStrang">Strang 例題</button><button id="uNew">隨機矩陣</button>');
    on('uStep', () => runOp(() => luStep()));
    on('uAll', () => runOp(async () => { while (lu.k <= lu.steps.length) await luStep(); }));
    on('uStrang', () => { lu.A = STRANG_A.map((r) => r.slice()); enterLU(); });
    on('uNew', () => {
      const L = [[1, 0, 0], [rint(-3, 3), 1, 0], [rint(-3, 3), rint(-3, 3), 1]], U = [[pick([1, 2, 3]), rint(-2, 2), rint(-2, 2)], [0, pick([1, 2, -1]), rint(-2, 2)], [0, 0, pick([1, 2, 3, -2])]];
      lu.A = matMul(L, U); enterLU();
    });
    log('沒有換列時：消去用到的 multiplier ℓᵢⱼ 直接放進 L 的 (i, j) 位置。');
    luState();
  }
  async function luStep() {
    const n = lu.steps.length;
    if (lu.k < n) {
      const st = lu.steps[lu.k++];
      if (st.t === 'pivot') { await doStep(undefined, lu.mvA, st, 800); log('pivot = ' + fmt(st.v)); }
      else {
        await doStep(undefined, lu.mvA, st, 900);
        const g = cube(fmt(st.k), COL.hot, [0.5, 0.5, 0.3], lu.mvA.X(st.s), lu.mvA.Y(st.tg), 0.6);
        move(g, lu.mvL.X(st.s), lu.mvL.Y(st.tg), 0.6);
        await W(undefined, 700); kill(g);
        lu.mvL.set(st.tg, st.s, st.k); lu.mvL.glowCell(st.tg, st.s, GREEN);
        log('ℓ' + sub(st.tg + 1) + sub(st.s + 1) + ' = ' + fmt(st.k) + ' 放進 L');
        await W(undefined, 400); lu.mvL.glowCell(st.tg, st.s, null);
      }
    } else if (lu.k === n) {
      lu.k++;
      const prod = matMul(lu.mvL.v, lu.mvA.v), ok = prod.every((r, i) => r.every((v, j) => Math.abs(v - lu.A[i][j]) < 1e-9));
      say(ok ? 'L × U 乘回去 = A' : 'L × U ≠ A？', 'A = LU');
      log(ok ? '檢查：L·U 剛好等於原來的 A。' : '檢查失敗', !ok);
    } else log('已經分解完成。按「隨機矩陣」再來一題。', true);
    luState();
  }
  function luState() {
    const n = lu.steps.length;
    setState('A = LU（不換列）', [['步驟', Math.min(lu.k, n + 1) + ' / ' + (n + 1)], ['L 的下三角', [[1, 0], [2, 0], [2, 1]].map(([i, j]) => 'ℓ' + sub(i + 1) + sub(j + 1) + '=' + fmt(lu.mvL.v[i][j])).join('  ')], ['U 的對角線', [0, 1, 2].map((i) => fmt(lu.mvA.v[i][i])).join(', ')]],
      'E₃₂E₃₁E₂₁A = U ⇒ A = E₂₁⁻¹E₃₁⁻¹E₃₂⁻¹U = <span class="ok">LU</span>');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  function genQ() {
    const kind = rnd(7);
    if (kind === 0) {
      let a, b, c, d; do { a = rint(-3, 3); b = rint(-3, 3); c = rint(-3, 3); d = rint(-3, 3); } while (a * d - b * c === 0);
      const x = rint(-3, 3), y = rint(-3, 3), e = a * x + b * y, f = c * x + d * y;
      const ans = '(' + x + ', ' + y + ')';
      const opts = [...new Set([ans, '(' + y + ', ' + x + ')', '(' + (-x) + ', ' + y + ')', '(' + x + ', ' + (-y) + ')', '(' + (x + 1) + ', ' + y + ')'])].slice(0, 4);
      if (!opts.includes(ans)) opts[0] = ans;
      return { q: '解方程組：\n' + a + 'x + ' + b + 'y = ' + e + '\n' + c + 'x + ' + d + 'y = ' + f, opts, ans, why: '代回檢查：' + a + '·' + x + ' + ' + b + '·' + y + ' = ' + e + '，' + c + '·' + x + ' + ' + d + '·' + y + ' = ' + f + '。det = ' + (a * d - b * c) + ' ≠ 0，唯一解。' };
    }
    if (kind === 1) {
      const n = pick([4, 5, 6]), r = rint(1, Math.min(3, n - 1));
      const fo = [...new Set([n - r, r, 3 - r, n, n - r + 1, n + r].map(String))].slice(0, 4);
      return { q: '3×' + n + ' 矩陣 A 化成 RREF 後有 ' + r + ' 個 pivot。Ax = 0 有幾個 free variable？', opts: fo, ans: String(n - r), why: 'free variable 數 = 未知數個數 n − rank r = ' + n + ' − ' + r + ' = ' + (n - r) + '（不是列數 3 − r）。' };
    }
    if (kind === 2) {
      const c = pick([0, 0, rint(1, 4)]), d = pick([0, rint(1, 5)]);
      const ans = c !== 0 ? '唯一解' : d !== 0 ? '無解' : '無限多解';
      return { q: '3×3 方程組消去後，增廣矩陣最後一列是 [0 0 ' + c + ' | ' + d + ']（前兩列各有一個 pivot）。解的情況？', opts: ['唯一解', '無解', '無限多解', '無法判斷'], ans, why: c !== 0 ? '第三個 pivot = ' + c + ' ≠ 0：三個 pivot → 唯一解。' : d !== 0 ? '這列寫成 0 = ' + d + '，矛盾 → 無解。' : '這列是 0 = 0，z 是 free variable → 無限多解。' };
    }
    if (kind === 3) {
      const a = pick([1, 2, 3]), k = pick([2, 3, 4, -2]), b = rint(1, 4), d = rint(1, 9);
      const c = k * a, u22 = d - k * b;
      const ans = 'L₂₁ = ' + k + '，U₂₂ = ' + u22;
      return { q: 'A = [' + a + ' ' + b + '; ' + c + ' ' + d + ']，不換列做 A = LU。L₂₁ 與 U₂₂ 是？', opts: [ans, 'L₂₁ = ' + (-k) + '，U₂₂ = ' + u22, 'L₂₁ = ' + k + '，U₂₂ = ' + (d + k * b), 'L₂₁ = ' + c + '，U₂₂ = ' + d], ans, why: 'multiplier ℓ = ' + c + ' ÷ ' + a + ' = ' + k + ' 直接放進 L（正號）；U₂₂ = ' + d + ' − ' + k + '·' + b + ' = ' + u22 + '。E₂₁ 才是 −' + k + '。' };
    }
    if (kind === 4) {
      const n = pick([100, 200, 300, 1000]);
      const v = Math.round(n ** 3 / 3), f = (x) => x >= 1e6 ? (x / 1e6).toFixed(1) + ' 百萬' : x.toLocaleString();
      return { q: 'n = ' + n + ' 的 n×n 矩陣做消去（A → U），乘減運算大約幾次？', opts: ['約 ' + f(v), '約 ' + f(n * n), '約 ' + f(n ** 3), '約 ' + f(n * n / 2)], ans: '約 ' + f(v), why: 'n² + (n−1)² + … + 1² ≈ n³/3。每個右邊 b 另外只要約 n²。n 加倍，時間變 8 倍。' };
    }
    if (kind === 5) {
      const n = pick([3, 4, 5]), f = [1, 1, 2, 6, 24, 120][n];
      return { q: n + '×' + n + ' 的 permutation matrix 一共有幾個？它們的反矩陣是？', opts: [f + ' 個；P⁻¹ = Pᵀ', f + ' 個；P⁻¹ = P', (n * n) + ' 個；P⁻¹ = Pᵀ', (n * (n - 1) / 2) + ' 個；P⁻¹ = −P'], ans: f + ' 個；P⁻¹ = Pᵀ', why: n + ' 列的排列有 ' + n + '! = ' + f + ' 種。PᵀP = I，所以 P⁻¹ = Pᵀ（只有單純交換兩列的 P 才剛好 P⁻¹ = P）。' };
    }
    const forms = [['(AB)⁻¹', 'B⁻¹A⁻¹', 'A⁻¹B⁻¹', '先脫後穿的鞋：反序'], ['(Aᵀ)⁻¹', '(A⁻¹)ᵀ', '−Aᵀ', '對 AA⁻¹ = I 兩邊轉置'], ['(ABC)⁻¹', 'C⁻¹B⁻¹A⁻¹', 'A⁻¹B⁻¹C⁻¹', '反序']];
    const [l, r, w, why] = pick(forms);
    return { q: 'A、B、C 都可逆。' + l + ' 等於？', opts: [r, w, l.replace('⁻¹', 'ᵀ'), '不一定存在'], ans: r, why: why + '：' + l + ' = ' + r + '。' };
  }
  function renderQuiz(elx) {
    const p = genQ();
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    elx.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    elx.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (elx.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        elx.querySelectorAll('.lab-quiz-opts button').forEach((b) => { const o = decodeURIComponent(b.dataset.o); if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(elx);
      };
    });
  }

  // ═════════════════════════ 場景：課本補充（Strang Ch1–2；L1、L2 影片尚無字幕） ═════════════════════════
  async function scRow2D(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.62, 4);
    say('例：2x − y = 0、−x + 2y = 3', 'Row picture：一個方程式 = 一條線');
    await W(tok, 2200);
    const r1 = rod(COL.a, 0.05), r2 = rod(COL.b, 0.05);
    const s1 = clipLine(2, -1, 0, 4), s2 = clipLine(-1, 2, 3, 4);
    const grow = (r, s) => anim(tok, 1000, (t) => setRod(r, bd.P(...s[0]), bd.P(s[0][0] + (s[1][0] - s[0][0]) * t, s[0][1] + (s[1][1] - s[0][1]) * t)));
    tag('2x − y = 0', 'ptr', ...bd.P(1.7, 3.6).toArray());
    say('第一條：2x − y = 0，過原點', '例如 (0, 0)、(1, 2)、(2, 4)');
    await grow(r1, s1); await W(tok, 1400);
    tag('−x + 2y = 3', 'ptr alt', ...bd.P(-2.4, 1.2).toArray());
    say('第二條：−x + 2y = 3', '例如 (−3, 0)、(1, 2)、(3, 3)');
    await grow(r2, s2); await W(tok, 1400);
    const p = dot(COL.piv, 0.16); p.position.copy(bd.P(1, 2)).setZ(0.12);
    tag('(1, 2)', 'ptr alt', ...bd.P(1.9, 1.6).toArray());
    say('兩條線交於 (1, 2)：同時滿足兩式', 'x = 1、y = 2');
    await W(tok, 2400);
    say('代回檢查', '2·1 − 2 = 0 ✓　−1 + 2·2 = 3 ✓');
    await W(tok, 2600);
  }
  async function scCol2D(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.62, 4);
    const O = bd.P(0, 0).setZ(0.08);
    say('同一組方程式，改看「行」', 'x·(2, −1) + y·(−1, 2) = (0, 3)');
    await W(tok, 2400);
    const c1 = arrow(COL.a), c2 = arrow(COL.b), b = arrow(COL.u, 0.07);
    setArrow(c1, O, bd.P(2, -1).setZ(0.08)); tag('col₁ = (2, −1)', 'ptr', ...bd.P(2.4, -1.6).toArray());
    await W(tok, 900);
    setArrow(c2, O, bd.P(-1, 2).setZ(0.08)); tag('col₂ = (−1, 2)', 'ptr', ...bd.P(-2.2, 2.4).toArray());
    await W(tok, 900);
    setArrow(b, O, bd.P(0, 3).setZ(0.05)); tag('b = (0, 3)', 'ptr alt', ...bd.P(0.9, 3.4).toArray());
    say('要找多少個 col₁ 加多少個 col₂ 才到 b', 'Column picture：行向量的線性組合');
    await W(tok, 2200);
    const xa = arrow(COL.a, 0.045), ya = arrow(COL.b, 0.045);
    await anim(tok, 1200, (t) => setArrow(xa, O.clone().setZ(0.16), bd.P(2 * t, -t).setZ(0.16)));
    say('先走 1 個 col₁ → (2, −1)', 'x = 1');
    await W(tok, 1200);
    await anim(tok, 1400, (t) => setArrow(ya, bd.P(2, -1).setZ(0.16), bd.P(2 - 2 * t, -1 + 4 * t).setZ(0.16)));
    const tip = dot(COL.piv, 0.15); tip.position.copy(bd.P(0, 3)).setZ(0.2);
    say('再走 2 個 col₂ → 剛好到 (0, 3)', '1·(2, −1) + 2·(−1, 2) = (0, 3)');
    await W(tok, 2400);
    say('答案一樣：x = 1、y = 2', '兩行不共線 → 所有組合填滿平面');
    await W(tok, 2600);
  }
  async function scRow3D(tok) {
    fresh([6.2, 6.2, 10.5], [0, 3, 0]);
    const sp = space([0, 2.6, 0], 0.85, 2.6);
    const eqs = [[2, -1, 0, 0], [-1, 2, -1, -1], [0, -3, 4, 4]], f = [0, 0, 1], colors = [COL.a, COL.b, COL.c];
    say('例：三個未知數、三個方程式', '2x − y = 0　−x + 2y − z = −1　−3y + 4z = 4');
    await W(tok, 2600);
    const pls = [];
    for (let k = 0; k < 3; k++) {
      pls.push(plane3(sp, eqs[k].slice(0, 3), eqs[k][3], colors[k], 4.2, f));
      say('第 ' + (k + 1) + ' 個方程式 = 一個平面', eqStr(eqs[k]));
      await W(tok, 1800);
      if (k === 1) {
        const r = rod(COL.piv, 0.05);
        await anim(tok, 1000, (t) => setRod(r, sp.P(-0.9 * t, -1.8 * t, 1 - 2.7 * t), sp.P(0.9 * t, 1.8 * t, 1 + 2.7 * t)));
        say('前兩個平面交成一條線', '方向 (1, 2, 3)，過 (0, 0, 1)');
        await W(tok, 2200);
      }
    }
    const p = dot(COL.hot, 0.17); p.position.copy(sp.P(0, 0, 1));
    say('第三個平面把那條線切在一點', '解 = (0, 0, 1)');
    await W(tok, 2600);
    say('維度一高，row picture 很難畫', '所以下一步看 column picture');
    await W(tok, 2400);
  }
  async function scCol3D(tok) {
    fresh([6.4, 5.8, 10.5], [0, 2.8, 0]);
    const sp = space([0, 2.5, 0], 0.6, 4);
    const O = sp.P(0, 0, 0), cols = [[2, -1, 0], [-1, 2, -3], [0, -1, 4]], colors = [COL.a, COL.b, COL.c];
    say('3D：三個行向量的組合', 'x·col₁ + y·col₂ + z·col₃ = b；col₁ = (2, −1, 0)、col₂ = (−1, 2, −3)、col₃ = (0, −1, 4)');
    await W(tok, 2600);
    const ar = cols.map((c, k) => { const a = arrow(colors[k]); setArrow(a, O, sp.P(...c)); const p = sp.P(...c.map((v) => v * 1.12)); tag('col' + sub(k + 1), 'ptr', p.x, p.y, p.z); return a; });
    await W(tok, 1600);
    const b = arrow(COL.u, 0.08); setArrow(b, O, sp.P(0, -1, 4)); glow(ar[2], GOLD);
    say('b = (0, −1, 4)：剛好就是 col₃', '所以 x = 0、y = 0、z = 1');
    await W(tok, 2800);
    glow(ar[2], null);
    say('換一個 b = (1, 1, −3)', '= col₁ + col₂');
    setArrow(b, O, sp.P(1, 1, -3));
    const a1 = arrow(COL.a, 0.045), a2 = arrow(COL.b, 0.045);
    await anim(tok, 1100, (t) => setArrow(a1, O, sp.P(2 * t, -t, 0)));
    await anim(tok, 1100, (t) => setArrow(a2, sp.P(2, -1, 0), sp.P(2 - t, -1 + 2 * t, -3 * t)));
    say('走 1 個 col₁、1 個 col₂ 就到 b', '1·col₁ + 1·col₂ + 0·col₃ = b → x = 1、y = 1、z = 0');
    await W(tok, 2600);
    say('三行不在同一平面 → 每個 b 都有解', 'A 可逆（nonsingular）');
    await W(tok, 2600);
  }
  async function scElim3(tok) {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    const M = STRANG_A.map((r, i) => [...r, STRANG_B[i]]);
    const mv = mview(M, 0, 3.4, { aug: 3, name: '[A | b]', s: 1 });
    say('例：A 和 b 並排成增廣矩陣', 'x + 2y + z = 2　3x + 8y + z = 12　4y + z = 2');
    await W(tok, 2600);
    for (const st of planElim(M, 3, false).steps) {
      if (st.t === 'sub' && st.tg === 1) { say('ℓ₂₁ = 3 ÷ 1 = 3', 'R₂ − 3·R₁：從第 2 列減掉 3 倍第 1 列'); await rowOp(tok, mv, 1, 0, 3, 1300); await W(tok, 900); continue; }
      if (st.t === 'sub' && st.tg === 2) { say('ℓ₃₂ = 4 ÷ 2 = 2', 'R₃ − 2·R₂：第 3 列減掉 2 倍第 2 列'); await rowOp(tok, mv, 2, 1, 2, 1300); await W(tok, 900); continue; }
      await doStep(tok, mv, st, 1100);
      if (st.t === 'pivot' && st.i === 0) { mv.glowCell(2, 0, GREEN); say('(3,1) 位置本來就是 0', 'multiplier ℓ₃₁ = 0，不用做'); await W(tok, 1600); mv.glowCell(2, 0, null); }
    }
    say('得到上三角 U：pivots 1、2、5', 'Ux = c，c = (2, 6, −10)');
    await W(tok, 3000);
  }
  async function scBack(tok) {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    const mv = mview([[1, 2, 1, 2], [0, 2, -2, 6], [0, 0, 5, -10]], -1.4, 3.4, { aug: 3, name: '[U | c]', s: 1 });
    [[0, 0], [1, 1], [2, 2]].forEach(([i, j]) => mv.pivot(i, j));
    say('消去完成：U 是上三角', 'x + 2y + z = 2　2y − 2z = 6　5z = −10');
    await W(tok, 2600);
    const out = [];
    const steps = [[2, 'z', -2, '5z = −10 → z = −2'], [1, 'y', 1, '2y − 2(−2) = 6 → y = 1'], [0, 'x', 2, 'x + 2(1) + (−2) = 2 → x = 2']];
    for (const [i, nm, v, f] of steps) {
      mv.glowRow(i, GREEN);
      say('回代：由下往上解 ' + nm, f);
      out.push(cube(nm + ' = ' + v, COL.piv, [1.3, 0.7, 0.6], 3.4, mv.Y(i), 0, 3));
      await W(tok, 2000); mv.glowRow(i, null);
    }
    say('解 (x, y, z) = (2, 1, −2)', '代回原式：2 + 2 − 2 = 2 ✓　6 + 8 − 2 = 12 ✓　4 − 2 = 2 ✓');
    await W(tok, 3200);
  }
  async function scElem(tok) {
    fresh([0, 3.2, 11.5], [0, 3, 0]);
    const E = mview([[1, 0, 0], [-3, 1, 0], [0, 0, 1]], -3.8, 3.4, { name: 'E₂₁', s: 0.8 });
    const A = mview(STRANG_A, 0, 3.4, { name: 'A', s: 0.8 });
    tag('×', 'val', -2.0, 3.4); tag('=', 'val', 1.9, 3.4);
    say('一步消去 = 左乘一個 E', 'elementary matrix E₂₁ = I 的 (2,1) 位置放 −3');
    await W(tok, 2600);
    E.glowRow(1, GOLD);
    say('E₂₁ 的第 2 列 (−3, 1, 0)', '結果第 2 列 = −3·(A 第 1 列) + 1·(A 第 2 列)');
    A.glowRow(0, GOLD); A.glowRow(1, GOLD);
    await W(tok, 2600);
    const R = mview([[1, 2, 1], [0, 2, -2], [0, 4, 1]], 3.8, 3.4, { name: 'E₂₁A', nameCls: 'ptr alt', s: 0.8 });
    R.glowRow(1, GREEN);
    say('其他列不動：E₂₁ 其他列就是 I', '(E₂₁A) 第 2 列 = (0, 2, −2)');
    await W(tok, 2600);
    E.unglow(); A.unglow(); R.unglow();
    say('再左乘 E₃₂（(3,2) 位置放 −2）', 'E₃₂(E₂₁A) = U');
    E.set(1, 0, 0); E.set(2, 1, -2); txt(E.nameL, 'E₃₂');
    A.kill(); const A2 = mview([[1, 2, 1], [0, 2, -2], [0, 4, 1]], 0, 3.4, { name: 'E₂₁A', s: 0.8 });
    R.kill(); await W(tok, 1400);
    A2.glowRow(1, GOLD); A2.glowRow(2, GOLD); E.glowRow(2, GOLD);
    const U = mview([[1, 2, 1], [0, 2, -2], [0, 0, 5]], 3.8, 3.4, { name: 'U', nameCls: 'ptr alt', s: 0.8 });
    U.glowRow(2, GREEN);
    await W(tok, 2600);
    say('結合律：(E₃₂E₂₁)A = U', '把所有步驟合成一個矩陣 E');
    await W(tok, 2800);
  }
  async function scBreakdown(tok) {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    const mv = mview([[1, 1, 1], [2, 2, 5], [4, 6, 8]], -2.6, 3.4, { name: 'A', s: 0.9 });
    say('例：消去時 pivot 位置變成 0', 'A = [1 1 1; 2 2 5; 4 6 8]');
    await W(tok, 2400);
    mv.pivot(0, 0);
    say('消第 1 行：ℓ₂₁ = 2、ℓ₃₁ = 4', 'R₂ − 2R₁、R₃ − 4R₁');
    await rowOp(tok, mv, 1, 0, 2, 1000); await rowOp(tok, mv, 2, 0, 4, 1000);
    mv.glowCell(1, 1, REDG);
    say('第 2 個 pivot 位置是 0！', '0 不能當 pivot（不能除以 0）');
    await W(tok, 2200);
    mv.glowCell(1, 1, null);
    say('下面還有非 0 → 換列就好（暫時的失敗）', 'R₂ ↔ R₃');
    await swapRows(tok, mv, 1, 2, 1200);
    mv.pivot(1, 1); mv.pivot(2, 2);
    say('pivots 1、2、3：仍然可逆', 'PA = LU');
    await W(tok, 2400);
    const mv2 = mview([[1, 1, 1], [0, 0, 3], [0, 0, 4]], 2.8, 3.4, { name: '若 A = [1 1 1; 2 2 5; 4 4 8]', nameCls: 'ptr alt', s: 0.9 });
    mv2.pivot(0, 0); mv2.glowCol(1, REDG);
    say('若下面也全是 0：換列也救不了', '永久失敗 → singular，沒有 3 個 pivot');
    await W(tok, 3200);
  }
  async function scRref(tok) {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    const mv = mview(STRANG_R, 0, 3.7, { name: 'A', s: 0.95 });
    const colL = [0, 1, 2, 3].map((j) => tag('x' + sub(j + 1), 'idx', mv.X(j), mv.Y(2) - 0.8));
    say('例：3×4 的 A，解 Ax = 0', 'A = [1 2 2 2; 2 4 6 8; 3 6 8 10]');
    await W(tok, 2400);
    const pl = planElim(STRANG_R, 4, true);
    for (const st of pl.steps) await doStep(tok, mv, st, 1000);
    txt(mv.nameL, 'R = rref(A)');
    [0, 2].forEach((j) => { txt(colL[j], 'x' + sub(j + 1) + '：pivot'); colL[j].element.className = 'lab-label ptr'; });
    [1, 3].forEach((j) => { txt(colL[j], 'x' + sub(j + 1) + '：free'); colL[j].element.className = 'lab-label ptr alt'; });
    say('RREF：pivot = 1，上下都是 0', 'pivot 行 1、3；free 行 2、4');
    await W(tok, 2800);
    say('free 變數自由設值：x₂ = 1、x₄ = 0', 'special solution (−2, 1, 0, 0)');
    await W(tok, 2600);
    say('x₂ = 0、x₄ = 1', 'special solution (2, 0, −2, 1)');
    await W(tok, 2600);
    say('rank 2 → free 變數 2 個', 'n − r = 4 − 2；Ax = 0 的解 = 兩個 special solution 的所有組合');
    await W(tok, 2800);
  }
  async function scThreeCases(tok) {
    const cases = [['unique', '唯一解：三平面交於一點', '[0 0 1 | 1] → 3 個 pivot'], ['parallel', '無解：兩個平面平行', '[0 0 0 | 2] → 0 = 2 矛盾'], ['prism', '無解：兩兩交出三條平行線', '[0 0 0 | 2] → 0 = 2 矛盾'], ['line', '無限多解：三平面共用一條線', '[0 0 0 | 0] → 1 個 free variable']];
    for (const [k, cap, f] of cases) {
      fresh([6.2, 6.4, 10.5], [0, 3, 0]);
      const C = PLANE_CASES[k];
      const sp = space([0, 2.9, 0], 0.8, 2.8);
      const cur = drawPlanes(C.eqs, C.focus, sp);
      const last = cur.info.M[2];
      say(cap, 'RREF 最後一列 [' + last.slice(0, 3).map(fmt).join(' ') + ' | ' + fmt(last[3]) + ']：' + f.split('→')[1].trim());
      log(C.eqs.map(eqStr).join('；'));
      await W(tok, 4200);
    }
    say('解的個數只有 0、1、∞ 三種', '不會剛好 2 個解');
    await W(tok, 2600);
  }

  // ═════════════════════════ 場景：MIT 18.06 L4（Factorization into A = LU） ═════════════════════════
  async function scInvProduct(tok) {
    fresh([0, 4, 11], [0, 2.4, 0]);
    say('A、B 都可逆：AB 的反矩陣是？', '(AB)⁻¹ = ?');
    await W(tok, 2200);
    const xs = [-3.3, -1.7, 1.7, 3.3];
    const A = cube('A', COL.a, [1.3, 1, 1], xs[0], 0.5, 0, 3), B = cube('B', COL.b, [1.3, 1, 1], xs[1], 0.5, 0, 3);
    tag('鞋（後穿）', 'idx', xs[0], 1.5); tag('襪（先穿）', 'idx', xs[1], 1.5);
    await W(tok, 1400);
    say('ABx：先做 B，再做 A', '像先穿襪子、再穿鞋子');
    await W(tok, 2200);
    const Bi = cube('B⁻¹', COL.b, [1.3, 1, 1], xs[2], 0.5, 0, 3), Ai = cube('A⁻¹', COL.a, [1.3, 1, 1], xs[3], 0.5, 0, 3);
    say('還原要反過來：先脫鞋 A⁻¹，再脫襪 B⁻¹', '(AB)⁻¹ = B⁻¹A⁻¹');
    await W(tok, 2400);
    glow(B, GOLD); glow(Bi, GOLD);
    say('括號可以隨便移：先算中間的 BB⁻¹', 'A(BB⁻¹)A⁻¹ = A·I·A⁻¹');
    await W(tok, 1800);
    fly(B, V3(-1, 8, 3)); fly(Bi, V3(1, 8, 3));
    const I1 = cube('I', '#e9dcc4', [1, 0.8, 0.8], 0, 0.4, 0, 3);
    await W(tok, 1600);
    glow(A, GOLD); glow(Ai, GOLD);
    say('再 AA⁻¹ = I', 'AB · B⁻¹A⁻¹ = I ✓');
    await W(tok, 1600);
    fly(A, V3(-2, 8, 3)); fly(Ai, V3(2, 8, 3)); fly(I1);
    cube('I', '#e9dcc4', [1.2, 0.9, 0.9], 0, 0.45, 0, 3);
    await W(tok, 1800);
    say('另一邊 B⁻¹A⁻¹ · AB 也是 I', '反矩陣：順序相反');
    await W(tok, 2600);
  }
  async function scInvTranspose(tok) {
    fresh([0, 3.4, 11.5], [0, 3.2, 0]);
    const A = mview([[1, 3], [2, 7]], -3.6, 4.6, { name: 'A', s: 0.85 }), Ai = mview([[7, -3], [-2, 1]], -0.8, 4.6, { name: 'A⁻¹', s: 0.85, color: COL.b });
    tag('×', 'val', -2.2, 4.6); tag('= I', 'val', 0.9, 4.6);
    say('從 AA⁻¹ = I 出發，兩邊都轉置', '(AA⁻¹)ᵀ = Iᵀ');
    await W(tok, 2400);
    say('Iᵀ = I：identity 是對稱的', '乘積轉置也要反序');
    await W(tok, 2000);
    const At = mview([[1, 3], [2, 7]], 3.8, 2.0, { name: '', s: 0.85 }), Ait = mview([[7, -3], [-2, 1]], 1.0, 2.0, { name: '', s: 0.85, color: COL.b });
    tag('×', 'val', 2.4, 2.0); tag('= I', 'val', 5.3, 2.0);
    for (const mv of [Ait, At]) {
      mv.glowCell(0, 1, GOLD); mv.glowCell(1, 0, GOLD);
      await W(tok, 700);
      const a = mv.v[0][1], b = mv.v[1][0];
      move(mv.cells[0][1], mv.X(0), mv.Y(1), 0.5); move(mv.cells[1][0], mv.X(1), mv.Y(0), 0.5);
      await W(tok, 700);
      move(mv.cells[0][1], mv.X(0), mv.Y(1), 0); move(mv.cells[1][0], mv.X(1), mv.Y(0), 0);
      [mv.cells[0][1], mv.cells[1][0]] = [mv.cells[1][0], mv.cells[0][1]]; mv.v[0][1] = b; mv.v[1][0] = a;
      mv.unglow();
    }
    tag('(A⁻¹)ᵀ', 'ptr', 1.0, 3.25); tag('Aᵀ', 'ptr', 3.8, 3.25);
    say('(A⁻¹)ᵀ · Aᵀ = I', '[7 −2; −3 1]·[1 2; 3 7] = I');
    await W(tok, 2600);
    say('所以 Aᵀ 的反矩陣就是 (A⁻¹)ᵀ', '(Aᵀ)⁻¹ = (A⁻¹)ᵀ：轉置、取逆可以交換順序');
    await W(tok, 3000);
  }
  async function scLU2(tok) {
    fresh([0, 3.4, 11], [0, 3.2, 0]);
    const A = mview([[2, 1], [8, 7]], -3.4, 4.4, { name: 'A', s: 0.9 });
    say('L4 例子：A = [2 1; 8 7]', '第一個 pivot 2，multiplier 8 ÷ 2 = 4');
    A.pivot(0, 0);
    await W(tok, 2400);
    say('右下不能放 4，不然沒有第二個 pivot', '[2 1; 8 4] 是 singular');
    await W(tok, 2200);
    const E = mview([[1, 0], [-4, 1]], -6, 4.4, { name: 'E₂₁', s: 0.9, color: COL.hot });
    say('E₂₁：第 2 列減 4 倍第 1 列', 'E₂₁ = [1 0; −4 1]，E₂₁A = U');
    await rowOp(tok, A, 1, 0, 4, 1300);
    A.pivot(1, 1); txt(A.nameL, 'U');
    say('得到 U，pivots 2、3', 'U = [2 1; 0 3]');
    await W(tok, 2000);
    E.kill(); A.kill();
    const A2 = mview([[2, 1], [8, 7]], -4.4, 4.4, { name: 'A', s: 0.9 });
    tag('=', 'val', -3.0, 4.4);
    const L = mview([[1, 0], [-4, 1]], -1.6, 4.4, { name: 'L = E₂₁⁻¹', nameCls: 'ptr alt', s: 0.9, colorOf: (v, i, j) => (i > j ? COL.l : i === j ? '#e9dcc4' : COL.zero) });
    const U = mview([[2, 1], [0, 3]], 1.0, 4.4, { name: 'U', s: 0.9 });
    U.pivot(0, 0); U.pivot(1, 1);
    say('把 E₂₁ 搬到右邊：乘它的反矩陣', 'E₂₁⁻¹：只要把 −4 變號');
    await W(tok, 1600);
    L.glowCell(1, 0, GOLD); L.set(1, 0, 4);
    say('A = LU：L = [1 0; 4 1]', '4·(2, 1) + (0, 3) = (8, 7) ✓');
    await W(tok, 2600); L.glowCell(1, 0, null);
    say('L：下三角、對角線 1；U：對角線是 pivots', 'L = lower，U = upper');
    await W(tok, 2400);
    tag('A = L ×', 'ptr alt', 2.3, 2.0);
    const D = mview([[2, 0], [0, 3]], 4.1, 2.0, { name: 'D', s: 0.75, color: COL.piv });
    mview([[1, 0.5], [0, 1]], 5.9, 2.0, { name: 'U\'', s: 0.75 });
    say('也可以把 pivots 拆出來成 D', 'A = LDU，U 的第 1 列 ÷ 2 → (1, 1/2)');
    D.glowCell(0, 0, GOLD); D.glowCell(1, 1, GOLD);
    await W(tok, 3200);
  }
  async function scLU3(tok) {
    fresh([0, 3.6, 12], [0.4, 2.6, 0]);
    say('3×3：三步消去，沒有換列', 'E₃₂ E₃₁ E₂₁ A = U');
    const t = (s, c, x) => cube(s, c, [1.05, 0.9, 0.9], x, 2.4, 0, 3);
    const E32 = t('E₃₂', COL.hot, -5.2), E31 = t('E₃₁', COL.hot, -4.0), E21 = t('E₂₁', COL.hot, -2.8);
    t('A', COL.a, -1.6); const eq = tag('=', 'val', -0.55, 2.4);
    const U = t('U', COL.u, 0.6);
    tag('依序消 (2,1)、(3,1)、(3,2)', 'idx', -4.0, 3.5);
    await W(tok, 3000);
    say('把 E 們搬到右邊：乘反矩陣', '最外面的 E₃₂ 先過去');
    await W(tok, 1800);
    const moves = [[E32, 'E₃₂⁻¹'], [E31, 'E₃₁⁻¹'], [E21, 'E₂₁⁻¹']];
    const rightX = [[0.6], [0.6, 1.8], [0.6, 1.8, 3.0]];
    const placed = [];
    for (let k = 0; k < 3; k++) {
      const [m, nm] = moves[k];
      relabel(m, nm); tint(m, COL.l);
      placed.unshift(m);
      placed.forEach((p, i) => move(p, rightX[k][i], 2.4, 0));
      move(U, 1.8 + 1.2 * k, 2.4, 0);
      say(nm + ' 跑到右邊，接在最左', 'A = ' + placed.map((p) => p.userData.lbl.element.textContent).join(' ') + ' U');
      await W(tok, 1900);
    }
    glow(eq, null);
    const br = lab.box(COL.l, [3.4, 0.08, 0.08]); br.position.set(1.8, 1.6, 0); lab.world.add(br);
    tag('L', 'ptr alt', 1.8, 1.15);
    say('A = E₂₁⁻¹E₃₁⁻¹E₃₂⁻¹ U = LU', 'L = 反矩陣的乘積，順序相反');
    await W(tok, 3200);
  }
  async function scEvsL(tok) {
    fresh([0, 3.4, 12], [0, 3.1, 0]);
    say('例：multipliers 2 和 5', 'E₂₁ 用 2、E₃₁ = I、E₃₂ 用 5；比較 E = E₃₂E₂₁ 和 L = E₂₁⁻¹E₃₂⁻¹');
    const s = 0.72;
    mview([[1, 0, 0], [0, 1, 0], [0, -5, 1]], -5.2, 4.6, { name: 'E₃₂', s });
    mview([[1, 0, 0], [-2, 1, 0], [0, 0, 1]], -2.6, 4.6, { name: 'E₂₁', s });
    tag('=', 'val', -1.0, 4.6);
    await W(tok, 2600);
    const E = mview([[1, 0, 0], [-2, 1, 0], [10, -5, 1]], 0.7, 4.6, { name: 'E', s, color: COL.a });
    say('E：對角線 1、上面全 0（只往下減）', '');
    await W(tok, 1800);
    E.glowCell(2, 0, REDG); tint(E.cells[2][0], COL.red);
    say('(3,1) 冒出一個 10！', 'row 1 的 2 倍進了 row 2，再 5 倍進 row 3：2 × 5 = 10');
    await W(tok, 3200);
    mview([[1, 0, 0], [2, 1, 0], [0, 0, 1]], -5.2, 1.7, { name: 'E₂₁⁻¹', s, nameCls: 'ptr alt' });
    mview([[1, 0, 0], [0, 1, 0], [0, 5, 1]], -2.6, 1.7, { name: 'E₃₂⁻¹', s, nameCls: 'ptr alt' });
    tag('=', 'val', -1.0, 1.7);
    say('反過來：反矩陣、反順序', '每個 E⁻¹ 只是把 multiplier 變號');
    await W(tok, 2400);
    const L = mview([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 0.7, 1.7, { name: 'L', s, nameCls: 'ptr alt', colorOf: (v, i, j) => (i > j && Math.abs(v) > 1e-9 ? COL.l : i === j ? '#e9dcc4' : COL.zero) });
    for (const [i, j, v] of [[1, 0, 2], [2, 1, 5]]) {
      const g = cube(String(v), COL.hot, [0.45, 0.45, 0.3], i === 1 ? -5.2 + (j - 1) * s : -2.6 + (j - 1) * s, 1.7 + (1 - i) * s, 0.6);
      move(g, L.X(j), L.Y(i), 0.6); await W(tok, 900); kill(g); L.set(i, j, v); L.glowCell(i, j, GREEN);
    }
    say('L 裡沒有 10！', 'L = [1 0 0; 2 1 0; 0 5 1]：multipliers 原封不動放進 L');
    await W(tok, 3000);
    E.glowCell(2, 0, null);
    say('不換列時，記下 multipliers 就有 L', '消去時存下 U 的列和 ℓ，A 就可以丟了');
    await W(tok, 3000);
  }
  async function scLUCost(tok) {
    fresh([7, 5.2, 10], [0, 1.8, 0]);
    const n = 8, u = 0.42;
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(n * u, n * u, n * u), new THREE.MeshBasicMaterial({ color: '#4b9ee2', transparent: true, opacity: 0.08, depthWrite: false }));
    ghost.position.set(0, n * u / 2, 0); lab.world.add(ghost);
    ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineBasicMaterial({ color: '#9fb7d0' })));
    say('n × n 的 A 做消去，要幾次運算？', '一次運算 = 乘一次再減一次');
    await W(tok, 2400);
    const cnt = tag('', 'ptr alt', -3.6, 4.6);
    let sum = 0;
    for (let k = n; k >= 1; k--) {
      const slab = lab.box(k === n ? COL.a : '#6fa8dc', [k * u, u * 0.92, k * u]);
      const y = (n - k) * u + u / 2;
      slab.position.set((k - n) * u / 2, y + 3, (k - n) * u / 2);
      lab.dropTo(lab.addBody(slab), V3((k - n) * u / 2, y, (k - n) * u / 2));
      sum += k * k;
      txt(cnt, k + '² → 累計 ' + sum);
      if (k === n) say('第 1 步：下面的數幾乎全部改掉 ≈ n²', 'n = 100 時約 100²');
      if (k === n - 1) say('第 2 步：問題縮小一號 ≈ (n−1)²', '99²，再來 98²、97²…');
      await W(tok, k >= n - 1 ? 1600 : 650);
    }
    say('加起來 ≈ n³/3', 'n² + (n−1)² + … + 1² ≈ ∫₀ⁿ x² dx = n³/3');
    await W(tok, 2800);
    say('n = 100：約 33 萬次，不到整個立方體的一半', '100² + 99² + … + 1² = 338350');
    await W(tok, 2800);
    say('右邊的 b 每個只要 ≈ n²', '先把 A 分解成 LU，多個 b 都便宜地解');
    for (let k = 1; k <= 8; k++) { cube('', COL.u, [u * 0.9, u * 0.9, u * 0.9], 2.6, (k - 0.5) * u, 2.4, 0); await W(tok, 120); }
    tag('b：一行', 'idx', 2.6, 8 * u + 0.4, 2.4);
    await W(tok, 2600);
    say('n 加倍 → 時間 ×8', '行列式的公式展開是 n!，更貴');
    await W(tok, 2600);
  }
  async function scPerm(tok) {
    fresh([0, 3.6, 11.5], [0, 3.4, 0]);
    const orders = [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2], [2, 3, 1], [3, 1, 2]];
    const names = ['I', 'P₁₂', 'P₁₃', 'P₂₃', '列序 231', '列序 312'];
    const P = (o) => o.map((r) => [1, 2, 3].map((c) => (c === r ? 1 : 0)));
    say('pivot 是 0 → 換列 → 用 P', 'permutation matrix：把 I 的列重新排列');
    await W(tok, 2400);
    const mats = [];
    for (let k = 0; k < 6; k++) {
      const x = -4.4 + (k % 3) * 4.4, y = k < 3 ? 5.1 : 2.1;
      mats.push(mview(P(orders[k]), x, y, { name: names[k], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }));
      if (k === 1) say('P₁₂：交換 I 的第 1、2 列', '[0 1 0; 1 0 0; 0 0 1]');
      if (k === 4) say('還有兩個「輪換」：列序 231、312', '3×3 一共 6 個 = 3!');
      await W(tok, k === 1 || k === 4 ? 1800 : 800);
    }
    await W(tok, 1200);
    [1, 3].forEach((k) => mats[k].cells.flat().forEach((m) => glow(m, GOLD)));
    say('相乘的結果還在這 6 個裡', 'P₁₂·P₂₃ = 列序 312；相乘、取逆都跑不出去 → group');
    await W(tok, 1600);
    mats[5].cells.flat().forEach((m) => glow(m, GREEN));
    await W(tok, 2400);
    mats.forEach((m) => m.unglow());
    [4, 5].forEach((k) => mats[k].cells.flat().forEach((m) => glow(m, GOLD)));
    say('231 和 312 互為反矩陣，也互為轉置', 'P⁻¹ = Pᵀ');
    await W(tok, 2600);
    mats.forEach((m) => m.unglow());
    [1, 2, 3].forEach((k) => mats[k].cells.flat().forEach((m) => glow(m, GREEN)));
    say('只換一對列的 P：自己就是自己的反矩陣', 'P₁₂⁻¹ = P₁₂ = P₁₂ᵀ');
    await W(tok, 2600);
    say('4×4 有幾個？', '4! = 24 個');
    await W(tok, 2600);
  }

  const scenes = {
    // 課本補充（Strang；L1、L2 影片尚無字幕）
    'row-picture-2d': { title: '課本：Row picture——兩條線交於 (1, 2)', play: scRow2D },
    'column-picture-2d': { title: '課本：Column picture——1·col₁ + 2·col₂ = b', play: scCol2D },
    'row-picture-3d': { title: '課本：三個平面交於一點 (0, 0, 1)', play: scRow3D },
    'column-picture-3d': { title: '課本：3D column picture——b 是行向量的組合', play: scCol3D },
    'elimination-3x3': { title: '課本：高斯消去 [A | b]，pivots 1、2、5', play: scElim3 },
    'back-substitution': { title: '課本：回代 z = −2、y = 1、x = 2', play: scBack },
    'elementary-matrix': { title: '課本：Elementary matrix E₂₁、E₃₂', play: scElem },
    'pivot-breakdown': { title: '課本：pivot 為 0——換列 vs singular', play: scBreakdown },
    'rref-free': { title: '課本：RREF、pivot 行與 free variable', play: scRref },
    'three-cases': { title: '課本：解的三種情況（幾何）', play: scThreeCases },
    // MIT 18.06 L4
    'inv-product': { title: '(AB)⁻¹ = B⁻¹A⁻¹：穿襪穿鞋', play: scInvProduct },
    'inv-transpose': { title: '(Aᵀ)⁻¹ = (A⁻¹)ᵀ', play: scInvTranspose },
    'lu-2x2': { title: 'A = [2 1; 8 7] = LU = LDU', play: scLU2 },
    'lu-3x3': { title: 'E₃₂E₃₁E₂₁A = U → A = LU', play: scLU3 },
    'e-vs-l': { title: '為什麼用 L：E 裡有 10，L 沒有', play: scEvsL },
    'lu-cost': { title: '消去的運算量 ≈ n³/3', play: scLUCost },
    'perm-group': { title: '3×3 的 6 個 permutation matrix，P⁻¹ = Pᵀ', play: scPerm },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ ls.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 1 章：MIT 18.06 L1、L2、L4 與 3Blue1Brown 預告片 — cued scenes（ls-） ───
// 例子全部用 Strang 自己在黑板上寫的矩陣：L1 的 2x − y = 0、−x + 2y = 3 與 3×3 的 [2 −1 0; −1 2 −1; 0 −3 4]、b = (0, −1, 4)；
// L2 的 A = [1 2 1; 3 8 1; 0 4 1]、b = (2, 12, 2)；L4 的 [2 1; 8 7]、multipliers 2 與 5。
// 每個矩陣乘積、反矩陣、pivot、回代結果都由程式算出來，再和老師口述的數字比對，畫面顯示 ✓／✘。
// 老師只用口頭描述、沒有給數字的地方（例如「某個矩陣乘 (3, 4, 5)」、九維空間）用自己挑的例子，畫面標「示意」。
// 註：本檔案的 3D 箭頭用 vArrow（模組原本的 arrow 被 kit 的同名函式遮住）。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (b, t, x, y, z = 0) => (b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z));
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.cells && typeof o.kill === 'function') return o.kill(); if (o.element) remove(o); else kill(o); });
const CAM = [[0, 3.2, 11], [0, 3, 0]];
const CAM3 = [[6.2, 6.2, 10.5], [0, 3, 0]];
// a scene = a list of step functions; each runs when the video reaches its cue
function sc(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    if (o.init) await o.init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 計算（全部用程式算） ──
const mm = (A, B) => matMul(A, B);
const mv3 = (A, x) => A.map((r) => cl(r.reduce((s, a, k) => s + a * x[k], 0)));
const same = (A, B) => A.length === B.length && A.every((r, i) => (Array.isArray(r) ? r.every((v, j) => Math.abs(v - B[i][j]) < 1e-9) : Math.abs(r - B[i]) < 1e-9));
const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const vs = (v) => '(' + v.map(fmt).join(', ') + ')';
const ms = (A) => '[' + A.map((r) => r.map(fmt).join(' ')).join('; ') + ']';
function inv(A) {   // Gauss–Jordan
  const n = A.length, M = A.map((r, i) => [...r, ...eye(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let i = 0; i < n; i++) if (i !== c) { const k = M[i][c]; for (let j = 0; j < 2 * n; j++) M[i][j] -= k * M[c][j]; }
  }
  return M.map((r) => r.slice(n).map(cl));
}
function det(A) {   // elimination with partial pivoting
  const M = A.map((r) => r.slice()), n = M.length; let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-9) return 0;
    if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
    d *= M[c][c];
    for (let i = c + 1; i < n; i++) { const k = M[i][c] / M[c][c]; for (let j = c; j < n; j++) M[i][j] -= k * M[c][j]; }
  }
  return cl(d);
}
function rank(A) {
  const M = A.map((r) => r.slice()), R = M.length, C = M[0].length; let r = 0;
  for (let c = 0; c < C && r < R; c++) {
    let p = r; for (let i = r + 1; i < R; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-9) continue;
    [M[r], M[p]] = [M[p], M[r]];
    for (let i = r + 1; i < R; i++) { const k = M[i][c] / M[r][c]; for (let j = c; j < C; j++) M[i][j] -= k * M[r][j]; }
    r++;
  }
  return r;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotp = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const colsOf = (A) => tr(A);
const solve = (A, b) => mv3(inv(A), b);
// row op on a plain array (the "board" value after R_t ← R_t − k·R_s)
const rop = (M, t, s, k) => M.map((r, i) => (i === t ? r.map((x, j) => cl(x - k * M[s][j])) : r.slice()));
// 3D arrow (shaft + cone); placed with the module's setArrow
function vArrow(color, r = 0.06) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat), hd2 = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
  g.add(sh, hd2); g.userData = { sh, hd: hd2, mat }; lab.world.add(g); return g;
}
const aglow = (g, c) => { g.userData.mat.emissive = new THREE.Color(c || '#000000'); };
async function grow(tok, g, a, b, msx = 800) { await anim(tok, msx, (u) => setArrow(g, a, a.clone().lerp(b, Math.max(0.02, u)))); }
async function fadeIn(tok, m, op = 0.3, msx = 600) { m.material.opacity = 0; await anim(tok, msx, (u) => { m.material.opacity = op * u; }); }
const blankM = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, () => ''));
const setRow = (mv, i, row) => row.forEach((v, j) => mv.set(i, j, v));
const fillM = (mv, M) => M.forEach((r, i) => setRow(mv, i, r));
const sym = (t, x, y) => tag(t, 'val', x, y);

// ═══════════════════════ MIT 18.06 L1：Geometry of Linear Equations ═══════════════════════
const L1A = [[2, -1], [-1, 2]], L1b = [0, 3];
const f1 = (x, y) => 2 * x - y, f2 = (x, y) => -x + 2 * y;
const L1S = solve(L1A, L1b);                     // (1, 2)
const L1_OK = same(L1S, [1, 2]);
const A3 = [[2, -1, 0], [-1, 2, -1], [0, -3, 4]], b3 = [0, -1, 4];
const X3 = solve(A3, b3);                          // (0, 0, 1)
const C3 = colsOf(A3);
const EQ3 = A3.map((r, i) => [...r, b3[i]]);

sc('ls-l1-plan', 'L1：今天的計畫——row picture、column picture、矩陣', [
  async (tok, S) => { cap('線性代數的基本問題：解方程組', 'system of linear equations'); S.h = hd('目標：解線性方程組', 0, 6.0); },
  async (tok, S) => { cap('先看 n 個方程式、n 個未知數', '方程式個數 = 未知數個數'); sm('n equations, n unknowns', 0, 5.3); },
  async (tok, S) => { S.r = cube('Row', COL.a, [2.0, 1.1, 1], -4, 2.8, 0, 3); note('一次看一個方程式', -4, 1.6); cap('第一種：row picture', '一次一列＝一個方程式，畫出來是線'); },
  async (tok, S) => { S.c = cube('Column ★', COL.b, [2.0, 1.1, 1], 0, 2.8, 0, 3); note('一次看一行（column）', 0, 1.6); glow(S.c, GOLD); cap('第二種：column picture（打星號）', '老師說這個最重要'); },
  async (tok, S) => { S.m = cube('A x = b', COL.u, [2.0, 1.1, 1], 4, 2.8, 0, 3); note('代數：係數矩陣 A', 4, 1.6); cap('第三種：矩陣形式', '把係數排成矩陣 A'); },
]);

sc('ls-l1-system', 'L1：2x − y = 0、−x + 2y = 3 的矩陣形式 Ax = b', [
  async (tok, S) => { cap('例子：兩個方程式、兩個未知數', 'n = 2'); },
  async (tok, S) => { S.e1 = hd('2x − y = 0', -4.2, 5.6); cap('第一式：2x − y = 0', ''); },
  async (tok, S) => { S.e2 = hd('−x + 2y = 3', -4.2, 4.7); cap('第二式：−x + 2y = 3', ''); },
  async (tok, S) => {
    S.A = mview(blankM(2, 2), -2.4, 2.2, { name: 'A（係數矩陣）', s: 0.85 });
    cap('係數矩陣：把係數排成方陣', '2 列（row）、2 行（column）');
  },
  async (tok, S) => { setRow(S.A, 0, L1A[0]); S.A.glowRow(0, GOLD); setCls(S.e1, 'ptr alt'); cap('第 1 列：2、−1', '來自第一式的係數'); },
  async (tok, S) => { S.A.glowRow(0, null); setCls(S.e1, 'ptr'); setRow(S.A, 1, L1A[1]); S.A.glowRow(1, GOLD); setCls(S.e2, 'ptr alt'); cap('第 2 列：−1、2', '來自第二式的係數'); },
  async (tok, S) => { S.A.glowRow(1, null); setCls(S.e2, 'ptr'); S.x = mview([['x'], ['y']], -0.2, 2.2, { name: 'x', s: 0.85, color: COL.c }); cap('未知數排成向量 x = (x, y)', '粗體 x'); },
  async (tok, S) => { sym('=', 0.8, 2.2); S.b = mview([[0], [3]], 1.8, 2.2, { name: 'b', s: 0.85, color: COL.b }); cap('右邊也是向量 b = (0, 3)', ''); },
  async (tok, S) => {
    hot('A x = b', 1.6, 5.2);
    const r = ['2x − y', '−x + 2y'];
    const auto = L1A.map((row) => (row[0] === 2 ? '2x' : '−x') + (row[1] < 0 ? ' − ' : ' + ') + (Math.abs(row[1]) === 1 ? '' : Math.abs(row[1])) + 'y');
    ok(auto[0] === r[0] && auto[1] === r[1], 'A 的每一列乘 (x, y) → ' + auto.join('、') + ' ✓', 1.6, 0.5);
    cap('線性方程組就是 Ax = b', '先解這個例子，再看大圖像');
  },
]);

sc('ls-l1-row2d', 'L1：Row picture——兩條線交於 (1, 2)', [
  async (tok, S) => { S.bd = board(0, 3.2, 0.62, 4); cap('Row picture：一次看一列', '在 xy 平面上畫'); },
  async (tok, S) => { S.l1 = hd('2x − y = 0', ...S.bd.P(2.2, 3.6).toArray()); cap('找出所有滿足 2x − y = 0 的點', ''); },
  async (tok, S) => {
    const p = dot(COL.a, 0.12); p.position.copy(S.bd.P(0, 0)).setZ(0.12);
    S.k1 = ok(f1(0, 0) === 0, 'y = 0 → x = 0：2·0 − 0 = 0 ✓', ...S.bd.P(-2.2, -0.8).toArray());
    cap('在 x 軸上 y = 0，於是 x = 0', '原點 (0, 0) 在線上');
  },
  async (tok, S) => {
    const y = 2 * 1; const p = dot(COL.a, 0.12); p.position.copy(S.bd.P(1, y)).setZ(0.12);
    gone(S.k1); S.k1 = ok(f1(1, y) === 0, 'x = 1 → y = ' + y + '：2·1 − 2 = 0 ✓', ...S.bd.P(-1.8, -0.8).toArray());
    cap('再找一點：x = 1，y 要是 2', '(1, 2) 也在線上');
  },
  async (tok, S) => {
    S.r1 = rod(COL.a, 0.05); const s = clipLine(2, -1, 0, 4);
    await anim(tok, 900, (u) => setRod(S.r1, S.bd.P(...s[0]), S.bd.P(s[0][0] + (s[1][0] - s[0][0]) * u, s[0][1] + (s[1][1] - s[0][1]) * u)));
    cap('所有解排成一條直線', 'linear 這個字裡就有 line');
  },
  async (tok, S) => {
    const p = dot(COL.a, 0.1); p.position.copy(S.bd.P(0.5, 1)).setZ(0.12);
    gone(S.k1); S.k1 = ok(f1(0.5, 1) === 0, 'x = 1/2、y = 1：2·½ − 1 = 0 ✓', ...S.bd.P(-1.8, -0.8).toArray());
    cap('例如 x = 1/2、y = 1 也行', '線上每一點都是第一式的解');
  },
  async (tok, S) => {
    gone(S.k1); S.l2 = hot('−x + 2y = 3', ...S.bd.P(-2.4, 2.4).toArray());
    S.k1 = ok(f2(0, 0) !== 3, '(0, 0) 代入：−0 + 0 = 0 ≠ 3 ✓', ...S.bd.P(-1.8, -0.8).toArray());
    cap('第二式不經過原點', 'x、y 都是 0 時得不到 3');
  },
  async (tok, S) => {
    const x = (3 - 2 * 0) / -1; const p = dot(COL.b, 0.12); p.position.copy(S.bd.P(x, 0)).setZ(0.12);
    gone(S.k1); S.k1 = ok(f2(x, 0) === 3, 'y = 0 → x = ' + fmt(x) + '：3 + 0 = 3 ✓', ...S.bd.P(-1.8, -0.8).toArray());
    cap('y = 0 時 x = −3', '第二條線上的一點 (−3, 0)');
  },
  async (tok, S) => {
    const y = (3 + -1) / 2; const p = dot(COL.b, 0.12); p.position.copy(S.bd.P(-1, y)).setZ(0.12);
    gone(S.k1); S.k1 = ok(f2(-1, y) === 3, 'x = −1 → y = ' + fmt(y) + '：1 + 2 = 3 ✓', ...S.bd.P(-1.8, -0.8).toArray());
    cap('x = −1 時 y = 1', '(−1, 1) 也在第二條線上');
  },
  async (tok, S) => {
    S.r2 = rod(COL.b, 0.05); const s = clipLine(-1, 2, 3, 4);
    await anim(tok, 900, (u) => setRod(S.r2, S.bd.P(...s[0]), S.bd.P(s[0][0] + (s[1][0] - s[0][0]) * u, s[0][1] + (s[1][1] - s[0][1]) * u)));
    gone(S.k1); cap('連起兩點，就是整條第二條線', '');
  },
  async (tok, S) => {
    S.hit = dot(COL.piv, 0.18); S.hit.position.copy(S.bd.P(L1S[0], L1S[1])).setZ(0.15); glow(S.hit, GOLD);
    hot(vs(L1S), ...S.bd.P(2.1, 1.4).toArray());
    cap('兩條線的交點 = 同時滿足兩式', '解 x = 1、y = 2');
  },
  async (tok, S) => {
    glow(S.hit, null);
    ok(L1_OK && f1(1, 2) === 0 && f2(1, 2) === 3, '2·1 − 2 = 0 ✓　−1 + 2·2 = 3 ✓', ...S.bd.P(-1.2, -3.3).toArray());
    cap('代回檢查：兩式都成立', '');
  },
]);

sc('ls-l1-col2d', 'L1：Column picture——1·col₁ + 2·col₂ = b', [
  async (tok, S) => { cap('Column picture：改看矩陣的行', '兩個方程式一起看'); },
  async (tok, S) => { sym('x', -6.0, 3.6); S.c1 = mview([[2], [-1]], -5.2, 3.6, { name: 'col₁', s: 0.6 }); cap('x 乘上第 1 行 (2, −1)', '第一式有 2 個 x，第二式有 −1 個'); },
  async (tok, S) => { sym('+ y', -4.4, 3.6); S.c2 = mview([[-1], [2]], -3.6, 3.6, { name: 'col₂', s: 0.6, color: COL.b }); cap('y 乘上第 2 行 (−1, 2)', ''); },
  async (tok, S) => { sym('=', -2.95, 3.6); S.bv = mview([[0], [3]], -2.3, 3.6, { name: 'b', s: 0.6, color: COL.u }); cap('右邊 b = (0, 3)', '要用對的份量把兩行組合成 b'); },
  async (tok, S) => { note('線性組合 linear combination', -4.2, 1.6); cap('這叫做線性組合', '乘上數字再相加；整門課最基本的運算'); },
  async (tok, S) => { S.bd = board(2.6, 3.0, 0.5, 4); S.O = S.bd.P(0, 0).setZ(0.08); cap('畫出來：每個行向量有兩個分量', ''); },
  async (tok, S) => { S.a1 = vArrow(COL.a); await grow(tok, S.a1, S.O, S.bd.P(2, -1).setZ(0.08)); sm('col₁ = (2, −1)', ...S.bd.P(2.6, -1.7).toArray()); cap('col₁：往右 2、往下 1', ''); },
  async (tok, S) => { S.a2 = vArrow(COL.b); await grow(tok, S.a2, S.O, S.bd.P(-1, 2).setZ(0.08)); sm('col₂ = (−1, 2)', ...S.bd.P(-2.4, 2.6).toArray()); cap('col₂：往左 1、往上 2', ''); },
  async (tok, S) => { S.k = hot('x = 1、y = 2', -4.2, 0.8); cap('取對的組合：1 個 col₁、2 個 col₂', '因為 row picture 已經算出 x = 1、y = 2'); },
  async (tok, S) => { S.t1 = vArrow(COL.a, 0.04); await grow(tok, S.t1, S.O.clone().setZ(0.18), S.bd.P(2, -1).setZ(0.18)); cap('先走 1 個 col₁，到 (2, −1)', ''); },
  async (tok, S) => { S.t2 = vArrow(COL.b, 0.04); await grow(tok, S.t2, S.bd.P(2, -1).setZ(0.18), S.bd.P(1, 1).setZ(0.18)); cap('接上 1 個 col₂：左 1、上 2', '箭頭接在前一個箭頭的尖端'); },
  async (tok, S) => { S.t3 = vArrow(COL.b, 0.04); await grow(tok, S.t3, S.bd.P(1, 1).setZ(0.18), S.bd.P(0, 3).setZ(0.18)); cap('再接 1 個 col₂（共 2 個）', ''); },
  async (tok, S) => {
    const tip = [0, 1].map((i) => 1 * L1A[i][0] + 2 * L1A[i][1]);
    S.b = vArrow(COL.u, 0.075); setArrow(S.b, S.O, S.bd.P(...tip).setZ(0.05));
    S.hit = dot(COL.piv, 0.15); S.hit.position.copy(S.bd.P(...tip)).setZ(0.22);
    ok(same(tip, L1b), '終點 ' + vs(tip) + ' = b ✓', ...S.bd.P(1.8, 3.5).toArray());
    cap('剛好停在 (0, 3)，就是 b', '');
  },
  async (tok, S) => {
    const c1 = 1 * 2 + 2 * -1, c2 = 1 * -1 + 2 * 2;
    ok(c1 === 0 && c2 === 3, '2 + (−2) = ' + c1 + '　−1 + 4 = ' + c2 + ' ✓', -4.2, 0.0);
    cap('分量檢查：第一個分量 0，第二個 3', '');
  },
  async (tok, S) => {
    S.cloud = [];
    for (let x = -2; x <= 2; x += 0.5) for (let y = -2; y <= 2; y += 0.5) {
      const p = [2 * x - y, -x + 2 * y]; if (Math.abs(p[0]) > 4 || Math.abs(p[1]) > 4) continue;
      const d = dot('#9b7ef4', 0.05); d.position.copy(S.bd.P(...p)).setZ(0.1); S.cloud.push(d);
    }
    ok(det(L1A) !== 0, '兩行不共線 → 組合填滿整個平面 ✓', ...S.bd.P(0, -4.9).toArray());
    cap('所有 x、y 的組合：填滿整個平面', '任何右邊 b 都到得了');
  },
  async (tok, S) => { note('哪些 b 到得了？', -4.2, -0.8); cap('關鍵問題：哪些 b 是組合得到的？', '之後會一再出現'); },
]);

sc('ls-l1-sys3', 'L1：3×3 例子與矩陣 A', [
  async (tok, S) => { cap('三個方程式、三個未知數', '3 × 3'); },
  async (tok, S) => { S.e = [hd(eqStr(EQ3[0]), -3.9, 6.0)]; cap('第一式：2x − y = 0', '沒有 z'); },
  async (tok, S) => { S.e.push(hd(eqStr(EQ3[1]), -3.9, 5.2)); cap('第二式：−x + 2y − z = −1', ''); },
  async (tok, S) => { S.e.push(hd(eqStr(EQ3[2]), -3.9, 4.4)); cap('第三式：−3y + 4z = 4', ''); },
  async (tok, S) => { cap('現在在三維空間 x、y、z', '還不知道解'); },
  async (tok, S) => { S.A = mview(blankM(3, 3), -2.4, 2.0, { name: 'A', s: 0.7 }); setRow(S.A, 0, A3[0]); setCls(S.e[0], 'ptr alt'); cap('矩陣 A 的第 1 列：2、−1、0', ''); },
  async (tok, S) => { setCls(S.e[0], 'ptr'); setRow(S.A, 1, A3[1]); setCls(S.e[1], 'ptr alt'); cap('第 2 列：−1、2、−1', ''); },
  async (tok, S) => { setCls(S.e[1], 'ptr'); setRow(S.A, 2, A3[2]); setCls(S.e[2], 'ptr alt'); cap('第 3 列：0、−3、4', '3 × 3 矩陣'); },
  async (tok, S) => {
    setCls(S.e[2], 'ptr');
    mview([['x'], ['y'], ['z']], -0.3, 2.0, { name: 'x', s: 0.7, color: COL.c }); sym('=', 0.6, 2.0);
    mview(b3.map((v) => [v]), 1.5, 2.0, { name: 'b', s: 0.7, color: COL.b });
    cap('右邊 b = (0, −1, 4)', 'Ax = b：三個方程式的簡寫');
  },
]);

sc('ls-l1-row3d', 'L1：Row picture 3D——三個平面交於一點', [
  async (tok, S) => { S.sp = space([0, 2.6, 0], 0.85, 2.6); cap('Row picture：三維空間 x、y、z', '一次看一個方程式'); },
  async (tok, S) => {
    S.o = dot(COL.red, 0.1); S.o.position.copy(S.sp.P(0, 0, 0));
    S.lb = hd('−x + 2y − z = −1', -4.6, 6.2);
    S.k = ok(-0 + 0 - 0 !== -1, '(0, 0, 0)：0 ≠ −1 → 原點不在上面 ✓', -4.2, 5.4);
    cap('先看第二式：原點不是解', '');
  },
  async (tok, S) => {
    const p = [1, 0, 0]; const d = dot(COL.b, 0.11); d.position.copy(S.sp.P(...p));
    gone(S.k); S.k = ok(dotp(A3[1], p) === b3[1], '(1, 0, 0)：−1 = −1 ✓', -4.2, 5.4);
    cap('x = 1、y = z = 0：是解', '');
  },
  async (tok, S) => {
    const p = [0, 0, 1]; const d = dot(COL.b, 0.11); d.position.copy(S.sp.P(...p));
    gone(S.k); S.k = ok(dotp(A3[1], p) === b3[1], '(0, 0, 1)：−1 = −1 ✓', -4.2, 5.4);
    cap('z = 1、x = y = 0：也是解', '在 z 軸上');
  },
  async (tok, S) => {
    const p = [0, -0.5, 0]; const d = dot(COL.b, 0.11); d.position.copy(S.sp.P(...p));
    gone(S.k); S.k = ok(dotp(A3[1], p) === b3[1], '(0, −1/2, 0)：2·(−½) = −1 ✓', -4.2, 5.4);
    cap('x = z = 0 時 y = −1/2', '第三個點');
  },
  async (tok, S) => { S.p2 = plane3(S.sp, A3[1], b3[1], COL.b, 4.0, [0, 0, 1]); await fadeIn(tok, S.p2); gone(S.k); cap('所有解形成一個平面', '三點決定一個平面'); },
  async (tok, S) => { S.p1 = plane3(S.sp, A3[0], b3[0], COL.a, 4.0, [0, 0, 1]); await fadeIn(tok, S.p1); hd('2x − y = 0', -4.6, 5.4); cap('第一式 2x − y = 0：z 隨便 → 也是平面', '每一列 = 一個平面'); },
  async (tok, S) => {
    const u = cross(A3[0], A3[1]), L = Math.hypot(...u), p0 = X3;
    S.line = rod(COL.piv, 0.05);
    await anim(tok, 900, (t) => setRod(S.line, S.sp.P(...p0.map((v, i) => v - 2.2 * t * u[i] / L)), S.sp.P(...p0.map((v, i) => v + 2.2 * t * u[i] / L))));
    sm('交線方向 ' + vs(u), -4.2, 4.6);
    cap('兩個平面相交成一條線', '');
  },
  async (tok, S) => { S.p3 = plane3(S.sp, A3[2], b3[2], COL.c, 4.0, [0, 0, 1]); await fadeIn(tok, S.p3); hd('−3y + 4z = 4', -4.6, 3.8); cap('第三個方程式：第三個平面', ''); },
  async (tok, S) => { S.hit = dot(COL.hot, 0.17); S.hit.position.copy(S.sp.P(...X3)); glow(S.hit, GOLD); S.q = hot('交點？', ...S.sp.P(0.8, 0, 1.5).toArray()); cap('三個平面交於一點：那就是解', '老師：還不知道在哪'); },
  async (tok, S) => { glow(S.hit, null); cap('三個平面已經不好看了', '四維、更高維更難畫'); },
]);

sc('ls-l1-col3d', 'L1：Column picture 3D——b 剛好是 col₃', [
  async (tok, S) => { S.sp = space([0, 2.5, 0], 0.6, 4); S.O = S.sp.P(0, 0, 0); S.eq = hd('x·col₁ + y·col₂ + z·col₃ = b', -3.6, 6.4); cap('Column picture：把三行組合起來', ''); },
  async (tok, S) => { txt(S.eq, 'x·' + vs(C3[0])); cap('x 乘第 1 行 (2, −1, 0)', '第一式 2 個 x、第二式 −1 個、第三式沒有'); },
  async (tok, S) => { txt(S.eq, 'x·' + vs(C3[0]) + ' + y·' + vs(C3[1])); cap('y 乘第 2 行 (−1, 2, −3)', ''); },
  async (tok, S) => { txt(S.eq, 'x·' + vs(C3[0]) + ' + y·' + vs(C3[1]) + ' + z·' + vs(C3[2])); cap('z 乘第 3 行 (0, −1, 4)', ''); },
  async (tok, S) => { S.bq = hot('= ' + vs(b3), -3.6, 5.6); cap('要組合出 b = (0, −1, 4)', ''); },
  async (tok, S) => { cap('三個三維向量的線性組合', '找 x、y、z 讓組合等於 b'); },
  async (tok, S) => { S.a = [vArrow(COL.a)]; await grow(tok, S.a[0], S.O, S.sp.P(...C3[0])); hd('col₁', ...S.sp.P(...C3[0].map((v) => v * 1.15)).toArray()); cap('畫 col₁ = (2, −1, 0)', ''); },
  async (tok, S) => { S.a.push(vArrow(COL.b)); await grow(tok, S.a[1], S.O, S.sp.P(...C3[1])); hd('col₂', ...S.sp.P(...C3[1].map((v) => v * 1.15)).toArray()); cap('col₂ = (−1, 2, −3)', ''); },
  async (tok, S) => { S.a.push(vArrow(COL.c)); await grow(tok, S.a[2], S.O, S.sp.P(...C3[2])); S.l3 = hd('col₃', ...S.sp.P(0.9, -1.2, 4.4).toArray()); cap('col₃ = (0, −1, 4)', ''); },
  async (tok, S) => { S.b = vArrow(COL.u, 0.1); S.b.userData.mat.transparent = true; S.b.userData.mat.opacity = 0.6; await grow(tok, S.b, S.O, S.sp.P(...b3)); cap('b 在哪？', '要用三行組合出這個箭頭'); },
  async (tok, S) => { aglow(S.a[2], GOLD); aglow(S.b, GOLD); ok(same(C3[2], b3), 'b = col₃ ✓', ...S.sp.P(-1.5, 0, 4.6).toArray()); cap('老師特意挑的：b 就是第 3 行', ''); },
  async (tok, S) => {
    aglow(S.a[2], null); aglow(S.b, null);
    const Ax = mv3(A3, [0, 0, 1]);
    ok(same(Ax, b3), 'A·(0, 0, 1) = ' + vs(Ax) + ' = b ✓', -3.6, 4.8);
    cap('0·col₁ + 0·col₂ + 1·col₃ = b', 'x = 0、y = 0、z = 1');
  },
  async (tok, S) => {
    const okAll = A3.every((r, i) => dotp(r, X3) === b3[i]);
    ok(okAll, '(0, 0, 1) 代入三個平面都成立 ✓', -3.6, 4.0);
    cap('這就是 row picture 三平面的交點', '剛才看不出來，column picture 一眼看出');
  },
  async (tok, S) => { note('下一講：消去法', 3.2, 6.0); cap('一般情況要靠下一講的消去法', 'elimination：所有軟體解方程組的方法'); },
], { cam: [[6.4, 5.8, 10.5], [0, 2.8, 0]] });

const bNew = C3[0].map((v, i) => v + C3[1][i]);   // col1 + col2 = (1, 1, −3)
const xNew = solve(A3, bNew);
sc('ls-l1-newb', 'L1：換一個 b = col₁ + col₂', [
  async (tok, S) => {
    S.sp = space([0, 2.5, 0], 0.6, 4); S.O = S.sp.P(0, 0, 0);
    S.a = C3.map((c, k) => { const a = vArrow([COL.a, COL.b, COL.c][k]); setArrow(a, S.O, S.sp.P(...c)); return a; });
    S.lb = ['col₁', 'col₂', 'col₃'].map((n, k) => hd(n, ...S.sp.P(...C3[k].map((v) => v * 1.15)).toArray()));
    cap('同一個 A，換一個右邊 b', '');
  },
  async (tok, S) => {
    S.t = vArrow(COL.b, 0.04); await grow(tok, S.t, S.sp.P(...C3[0]), S.sp.P(...bNew));
    S.b = vArrow(COL.u, 0.09); setArrow(S.b, S.O, S.sp.P(...bNew));
    S.k = hot('b = col₁ + col₂ = ' + vs(bNew), -3.6, 6.2);
    cap('把前兩行加起來當新的 b', '(2, −1, 0) + (−1, 2, −3) = (1, 1, −3)');
  },
  async (tok, S) => { ok(same(mv3(A3, [1, 1, 0]), bNew) && same(xNew, [1, 1, 0]), '解 = ' + vs(xNew) + '：1 個 col₁ + 1 個 col₂ ✓', -3.6, 5.4); cap('新的解：(1, 1, 0)', '一個 col₁、一個 col₂、零個 col₃'); },
  async (tok, S) => {
    [...S.a, S.t, S.b].forEach((a) => { a.visible = false; }); S.lb.forEach((l) => { l.visible = false; });
    S.pl = A3.map((n, k) => plane3(S.sp, n, bNew[k], [COL.a, COL.b, COL.c][k], 4.4, xNew));
    S.hit = dot(COL.hot, 0.16); S.hit.position.copy(S.sp.P(...xNew));
    ok(A3.every((r, i) => dotp(r, xNew) === bNew[i]), 'row picture：三個新平面交於 ' + vs(xNew) + ' ✓', -3.6, 4.6);
    cap('Row picture：三個新的平面', '交在 (1, 1, 0)');
  },
  async (tok, S) => {
    S.pl.forEach((p) => kill(p)); kill(S.hit);
    [...S.a, S.t, S.b].forEach((a) => { a.visible = true; }); S.lb.forEach((l) => { l.visible = true; });
    aglow(S.a[0], GOLD); aglow(S.a[1], GOLD);
    cap('Column picture：同樣三行，組合出新 b', 'col₁ + col₂ = 新的 b');
  },
], { cam: [[6.4, 5.8, 10.5], [0, 2.8, 0]] });

const C3bad = [C3[0], C3[1], bNew];                 // column 3 replaced by col1 + col2
const Abad = tr(C3bad);
sc('ls-l1-everyb', 'L1：每個 b 都有解嗎？——三行共面就失敗', [
  async (tok, S) => {
    S.sp = space([0, 2.5, 0], 0.55, 4); S.O = S.sp.P(0, 0, 0);
    S.a = C3.map((c, k) => { const a = vArrow([COL.a, COL.b, COL.c][k]); setArrow(a, S.O, S.sp.P(...c)); return a; });
    cap('想想所有的 b', '所有可能的右邊');
  },
  async (tok, S) => { hd('Ax = b 對每個 b 都有解嗎？', -3.4, 6.6); cap('能不能對每個 b 解 Ax = b？', '代數的問法'); },
  async (tok, S) => {
    S.cs = []; S.cl = [];
    const g = [-1, -0.5, 0, 0.5, 1];
    for (const x of g) for (const y of g) for (const z of g) { const c = [x, y, z]; const d = dot('#9b7ef4', 0.045); d.position.copy(S.sp.P(...mv3(A3, c))); S.cs.push(c); S.cl.push(d); }
    cap('三行的所有組合能不能填滿 3D 空間？', '線性組合的問法');
  },
  async (tok, S) => { note('A 乘 x = A 各行的組合', -3.4, 5.8); cap('A 乘向量 x，就是 A 的行的組合', '兩種問法是同一個問題'); },
  async (tok, S) => { ok(det(A3) !== 0, '三行不在同一平面（det = ' + fmt(det(A3)) + ' ≠ 0）✓', -3.4, 5.0); cap('這個 A：答案是「可以」', 'non-singular、invertible（可逆）'); },
  async (tok, S) => { cap('什麼時候會失敗？', ''); },
  async (tok, S) => {
    S.n = cross(C3[0], C3[1]);
    S.pl = plane3(S.sp, S.n, 0, '#c9a227', 5.2, [0, 0, 0]); await fadeIn(tok, S.pl, 0.25);
    cap('如果三行都在同一個平面上…', '組合也只會在那個平面裡');
  },
  async (tok, S) => {
    kill(S.a[2]); S.a[2] = vArrow(COL.red); setArrow(S.a[2], S.O, S.sp.P(...C3bad[2]));
    const P0 = S.cl.map((d) => d.position.clone()), P1 = S.cs.map((c) => S.sp.P(...mv3(Abad, c)));
    await anim(tok, 1500, (u) => S.cl.forEach((d, i) => d.position.lerpVectors(P0[i], P1[i], u)));
    ok(det(Abad) === 0 && dotp(S.n, C3bad[2]) === 0, '例：col₃ = col₁ + col₂ → 在平面上（det = 0）✓', -3.4, 4.2);
    cap('例如 col₃ = col₁ + col₂', '第三行沒帶來新方向，組合全擠進平面');
  },
  async (tok, S) => {
    S.b = vArrow(COL.u, 0.08); setArrow(S.b, S.O, S.sp.P(...b3));
    ok(Math.abs(dotp(S.n, b3)) > 1e-9, 'b = (0, −1, 4) 不在平面上 → 到不了 ✓', -3.4, 3.4);
    cap('b 在平面上才有解，平面外的 b 到不了', '大部分的 b 都到不了');
  },
  async (tok, S) => { hot('singular：不可逆', -3.4, 2.6); cap('這種矩陣叫 singular（奇異）', '不是每個 b 都有解'); },
], { cam: [[6.4, 5.8, 10.5], [0, 2.8, 0]] });

// 九維：老師只用口頭描述，數字是自己產生的示意矩陣（固定亂數種子）
let seed = 7; const rnd9 = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed % 7) - 3; };
const R9 = Array.from({ length: 9 }, () => Array.from({ length: 9 }, rnd9));
const R9bad = R9.map((r) => { const s = r.slice(); s[8] = s[7]; return s; });
sc('ls-l1-nine', 'L1：九維空間的九個行（示意）', [
  async (tok, S) => { note('示意', -5.6, 6.2); cap('想像九維空間', '向量有 9 個分量'); },
  async (tok, S) => {
    S.cells = [];
    for (let j = 0; j < 9; j++) { const col = []; for (let i = 0; i < 9; i++) { const v = R9[i][j]; col.push(cube(null, v === 0 ? COL.zero : v > 0 ? COL.a : COL.b, [0.4, 0.4, 0.3], -3.6 + j * 0.9, 5.4 - i * 0.48, 0)); } S.cells.push(col); }
    for (let j = 0; j < 9; j++) sm('col' + sub(j + 1), -3.6 + j * 0.9, 0.9);
    cap('九個方程式 → 九個行，每行 9 個數', '藍 = 正數、紫 = 負數（示意）');
  },
  async (tok, S) => { cap('能不能組合出每一個 b？', '答案取決於這九個行'); },
  async (tok, S) => { S.k = ok(rank(R9) === 9, '隨機矩陣：rank 9，可逆 ✓', 0, 6.4); cap('隨便挑一個矩陣：幾乎一定可逆', '老師：用 MATLAB 的 rand 挑'); },
  async (tok, S) => {
    gone(S.k);
    S.cells[8].forEach((m, i) => { tint(m, R9bad[i][8] === 0 ? COL.zero : R9bad[i][8] > 0 ? COL.a : COL.b); glow(m, GOLD); });
    S.cells[7].forEach((m) => glow(m, GOLD));
    S.k = ok(det(R9bad) === 0, '第 9 行 = 第 8 行 → det = 0 ✓', 0, 6.4);
    cap('但若第 9 行和第 8 行一樣…', '它沒有帶來任何新東西');
  },
  async (tok, S) => { ok(rank(R9bad) === 8, 'rank = ' + rank(R9bad) + '：組合只填出「8 維平面」✓', 0, -0.1); cap('組合只填滿九維裡的 8 維平面', '有些 b 就到不了'); },
  async (tok, S) => { S.cells.flat().forEach((m) => glow(m, null)); cap('現在先待在好的情況', '每個 b 都有解'); },
]);

const AM = [[2, 5], [1, 3]], xM = [1, 2], AxM = mv3(AM, xM);
sc('ls-l1-matvec', 'L1：矩陣乘向量——用行、用列', [
  async (tok, S) => { hd('A x = b', 0, 6.2); cap('回到矩陣形式 Ax = b', 'A 乘 x：矩陣乘向量'); },
  async (tok, S) => { S.A = mview(AM, -3.0, 4.4, { name: 'A', s: 0.8 }); cap('例：A = [2 5; 1 3]', ''); },
  async (tok, S) => { sym('×', -1.9, 4.4); S.x = mview(xM.map((v) => [v]), -1.1, 4.4, { name: 'x', s: 0.8, color: COL.c }); sym('=', -0.2, 4.4); S.r = mview(blankM(2, 1), 0.7, 4.4, { name: 'Ax', s: 0.8, color: COL.u }); cap('x = (1, 2)', '怎麼乘？'); },
  async (tok, S) => { cap('有兩種乘法', '老師最喜歡的：一次一行'); },
  async (tok, S) => {
    S.A.glowCol(0, GOLD); S.A.glowCol(1, GOLD);
    sym('1 ·', -4.8, 1.6); mview([[2], [1]], -3.9, 1.6, { s: 0.7 }); sym('+  2 ·', -2.9, 1.6); mview([[5], [3]], -1.9, 1.6, { s: 0.7 });
    cap('1 個第 1 行 + 2 個第 2 行', '');
  },
  async (tok, S) => { S.A.unglow(); S.r.set(0, 0, AxM[0]); S.r.glowCell(0, 0, GREEN); sm('2 + 10 = 12', -0.8, 1.9); cap('第一個分量：2 + 10 = 12', ''); },
  async (tok, S) => { S.r.glowCell(0, 0, null); S.r.set(1, 0, AxM[1]); S.r.glowCell(1, 0, GREEN); sm('1 + 6 = 7', -0.8, 1.3); ok(same(AxM, [12, 7]), 'Ax = (12, 7) ✓', 0.7, 2.7); cap('第二個分量：1 + 6 = 7', 'Ax = (12, 7)'); },
  async (tok, S) => { S.r.unglow(); S.A.glowRow(0, GOLD); S.r.glowCell(0, 0, GOLD); const d = dotp(AM[0], xM); ok(d === 12, '一次一列：2·1 + 5·2 = ' + d + ' ✓', 3.8, 4.8); cap('另一種：一次一列（dot product）', '第 1 列 · x'); },
  async (tok, S) => { S.A.unglow(); S.r.unglow(); S.A.glowRow(1, GOLD); S.r.glowCell(1, 0, GOLD); const d = dotp(AM[1], xM); ok(d === 7, '1·1 + 3·2 = ' + d + ' ✓', 3.8, 4.0); cap('第 2 列 · x = 7', ''); },
  async (tok, S) => { S.A.unglow(); S.r.unglow(); hot('Ax = A 的行的線性組合', 3.0, 1.0); cap('重點：Ax 是 A 的行的組合', '以後請這樣想'); },
  async (tok, S) => { note('若 b = (12, 7)，解就是 x = (1, 2)', 0, -0.2); cap('如果 b = (12, 7)，解就是 (1, 2)', ''); },
]);

// ═══════════════════════ MIT 18.06 L2：Elimination with Matrices ═══════════════════════
const A2 = [[1, 2, 1], [3, 8, 1], [0, 4, 1]], b2 = [2, 12, 2];
const L21 = A2[1][0] / A2[0][0];                      // 3
const A2a = rop(A2, 1, 0, L21);                        // [1 2 1; 0 2 −2; 0 4 1]
const L31 = A2a[2][0] / A2a[0][0];                     // 0
const L32 = A2a[2][1] / A2a[1][1];                     // 2
const U2 = rop(A2a, 2, 1, L32);                        // [1 2 1; 0 2 −2; 0 0 5]
const U2_OK = same(U2, [[1, 2, 1], [0, 2, -2], [0, 0, 5]]) && L21 === 3 && L31 === 0 && L32 === 2;
const E21 = [[1, 0, 0], [-L21, 1, 0], [0, 0, 1]], E32 = [[1, 0, 0], [0, 1, 0], [0, -L32, 1]];
const E2 = mm(E32, E21);
const EQ2 = A2.map((r, i) => [...r, b2[i]]);
const Aug1 = rop(EQ2, 1, 0, L21), Aug2 = rop(Aug1, 2, 1, L32);
const c2 = Aug2.map((r) => r[3]);                      // (2, 6, −10)
function backSub(U, c) { const n = U.length, x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = c[i]; for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j]; x[i] = cl(s / U[i][i]); } return x; }
const x2 = backSub(U2, c2);                            // (2, 1, −2)

sc('ls-l2-plan', 'L2：今天的主題——消去、失敗、回代、矩陣語言', [
  async (tok, S) => { EQ2.forEach((e, i) => hd(eqStr(e), -3.8, 6.0 - i * 0.75)); cap('今天的例子：三個方程式、三個未知數', 'Ax = b'); },
  async (tok, S) => { cube('消去法', COL.a, [1.9, 1.0, 0.9], -4.5, 2.2, 0, 3); sm('不用行列式', -4.5, 1.2); cap('解法：消去法（elimination）', '每個軟體都用它解方程組'); },
  async (tok, S) => { cube('怎麼會失敗', COL.red, [1.9, 1.0, 0.9], -1.5, 2.2, 0, 3); sm('好矩陣才會成功', -1.5, 1.2); cap('同時看：消去什麼時候會失敗', ''); },
  async (tok, S) => { cube('回代', COL.c, [1.9, 1.0, 0.9], 1.5, 2.2, 0, 3); sm('back substitution', 1.5, 1.2); cap('最後一步：回代', ''); },
  async (tok, S) => { cube('矩陣語言', COL.u, [1.9, 1.0, 0.9], 4.5, 2.2, 0, 3); sm('消去 = 乘矩陣', 4.5, 1.2); cap('重點：用矩陣寫出消去', '也會談矩陣怎麼相乘'); },
]);

sc('ls-l2-elim1', 'L2：第一步——pivot 1、multiplier 3、R₂ − 3R₁', [
  async (tok, S) => { S.e = EQ2.map((e, i) => hd(eqStr(e), -4.2, 4.6 - i * 0.95)); cap('三個方程式、三個未知數', ''); },
  async (tok, S) => { S.A = mview(A2, 1.6, 3.6, { name: 'A', s: 0.95 }); cap('只寫係數：矩陣 A 就夠了', '等號、加號太麻煩'); },
  async (tok, S) => { S.A.glowRow(0, GREEN); cap('第一步：第一式保持不動', ''); },
  async (tok, S) => { S.A.glowRow(0, null); S.A.glowCell(1, 0, REDG); cap('目的：消掉第二式裡的 x', '讓 (2,1) 位置變 0'); },
  async (tok, S) => { S.A.glowCell(1, 0, null); S.A.pivot(0, 0); S.A.glowCell(0, 0, GOLD); hot('第 1 個 pivot', 1.6 - 0.95 - 1.7, 3.6 + 0.95); cap('左上角的 1 是第一個 pivot', '框起來；這一列叫 pivot row'); },
  async (tok, S) => { S.A.glowCell(0, 0, null); S.m = ok(L21 === 3, 'multiplier ℓ₂₁ = 3 ÷ 1 = ' + fmt(L21) + ' ✓', 1.6, 0.9); cap('multiplier 是多少？3', '3 × 第一式，正好消掉 3x'); },
  async (tok, S) => {
    await rowOp(tok, S.A, 1, 0, L21, 1300);
    ok(same(S.A.v, A2a), '新的第 2 列 = ' + vs(A2a[1]) + ' ✓', 1.6, 0.2);
    cap('R₂ − 3·R₁ → (0, 2, −2)', '8 − 3·2 = 2；1 − 3·1 = −2；第 3 列不動');
  },
]);

sc('ls-l2-elim2', 'L2：(3,1) 已經是 0，第二個 pivot 2，R₃ − 2R₂ → 第三個 pivot 5', [
  async (tok, S) => { S.A = mview(A2a, 0.6, 3.6, { name: 'A → U', s: 0.95 }); S.A.pivot(0, 0); cap('向前消去：第一步完成', 'forward elimination'); },
  async (tok, S) => { S.ph = [0, 1, 2].map((i) => cube('?', '#efe6d6', [0.6, 0.6, 0.2], 3.4, S.A.Y(i), 0)); S.pl = sm('右邊 b：先留空，之後再補', 3.4, 5.5); cap('右邊 b 呢？先留位子，之後再算', '像 MATLAB：先做完左邊'); },
  async (tok, S) => { S.A.glowCell(1, 0, GREEN); S.t = sm('(2,1) 位置 → 0', -2.6, S.A.Y(1)); cap('剛才清掉的是 (2,1) 位置', '第 2 列、第 1 行；這一步叫 2-1 步'); },
  async (tok, S) => { S.A.glowCell(1, 0, null); S.A.glowCell(2, 0, GREEN); gone(S.t); S.t = ok(L31 === 0, '(3,1) 本來就是 0 → ℓ₃₁ = 0 ✓', -2.6, S.A.Y(2) - 0.6); cap('下一步是 3-1 步，但那裡已經是 0', 'multiplier 0，什麼都不用做'); },
  async (tok, S) => { S.A.glowCell(2, 0, null); gone(S.t); S.A.pivot(1, 1); S.A.glowCell(1, 1, GOLD); hot('第 2 個 pivot', -2.4, S.A.Y(1)); cap('第二個 pivot 出現了：2', 'x 已消掉，剩 y、z 的兩個方程式'); },
  async (tok, S) => { S.A.glowCell(1, 1, null); S.A.glowCell(2, 1, REDG); S.t = ok(L32 === 2, 'ℓ₃₂ = 4 ÷ 2 = ' + fmt(L32) + ' ✓', -2.6, S.A.Y(2) - 0.6); cap('目標：消掉 (3,2) 位置的 4', 'multiplier = 4 ÷ 2 = 2'); },
  async (tok, S) => { S.A.glowCell(2, 1, null); await rowOp(tok, S.A, 2, 1, L32, 1300); cap('R₃ − 2·R₂ → (0, 0, 5)', '1 − 2·(−2) = 5'); },
  async (tok, S) => { gone(S.t); S.A.pivot(2, 2); S.A.glowCell(2, 2, GOLD); hot('第 3 個 pivot', -2.4, S.A.Y(2)); ok(U2_OK && same(S.A.v, U2), 'pivots 1、2、5 ✓', 0.6, 0.6); cap('第三個 pivot：5', '三個 pivot 都框起來'); },
  async (tok, S) => { S.A.glowCell(2, 2, null); S.A.glowCell(1, 2, GOLD); note('板書一度寫成 −1，更正為 −2', 4.0, 2.4); cap('老師黑板上一度寫錯：應是 −2', '1 − 3·1 = −2；因此第三個 pivot 是 5'); },
]);

sc('ls-l2-u', 'L2：U 是上三角，pivots 1、2、5，det = 10', [
  async (tok, S) => {
    S.U = mview(U2, 0.6, 3.6, { name: 'U', s: 0.95 }); [0, 1, 2].forEach((i) => S.U.pivot(i, i));
    [[1, 0], [2, 0], [2, 1]].forEach(([i, j]) => S.U.glowCell(i, j, GREEN));
    hot('U = upper triangular（上三角）', 0.6, 0.8); cap('消去的結果叫 U', '對角線下方全是 0');
  },
  async (tok, S) => { S.U.unglow(); S.Am = mview(A2, -4.2, 3.6, { name: 'A', s: 0.7 }); sym('→', -2.2, 3.6); cap('消去的目的：從 A 走到 U', '科學計算裡最常見的計算'); },
  async (tok, S) => { note('pivot 不能是 0', 4.3, 5.6); cap('pivot 不能是 0', '這個矩陣沒碰到 0，很好'); },
  async (tok, S) => { S.pv = [0, 1, 2].map((i) => U2[i][i]); [0, 1, 2].forEach((i) => S.U.glowCell(i, i, GOLD)); hd('pivots：' + S.pv.join('、'), 4.3, 4.6); cap('pivots：1、2、5', ''); },
  async (tok, S) => {
    S.U.unglow(); const pr = S.pv.reduce((a, b) => a * b, 1);
    ok(pr === 10 && det(A2) === pr, 'det A = 1 × 2 × 5 = ' + pr + ' ✓', 4.3, 3.7);
    cap('順便：行列式 = pivots 相乘 = 10', '老師說他其實從不想算行列式');
  },
]);

const A6 = [[1, 2, 1], [3, 6, 1], [0, 4, 1]], A6a = rop(A6, 1, 0, 3);
const Am4 = [[1, 2, 1], [3, 8, 1], [0, 4, -4]], Am4b = rop(rop(Am4, 1, 0, 3), 2, 1, 2);
const A0 = [[0, 2, 1], [3, 8, 1], [0, 4, 1]];
sc('ls-l2-fail', 'L2：消去什麼時候失敗——暫時失敗（換列）與完全失敗', [
  async (tok, S) => { cap('消去什麼時候會失敗？', '失敗 = 湊不出三個 pivot'); },
  async (tok, S) => {
    note('示意', -5.6, 5.8);
    S.M = mview(A0, -3.4, 3.6, { name: '若左上角是 0', s: 0.8 }); S.M.glowCell(0, 0, REDG);
    await wt(tok, 700); await swapRows(tok, S.M, 0, 1, 1000); S.M.pivot(0, 0);
    ok(S.M.v[0][0] !== 0, '換列 R₁ ↔ R₂ → pivot ' + fmt(S.M.v[0][0]) + ' ✓', -3.4, 1.2);
    cap('第一個數是 0：交換兩列就好', '不說「zero pivot」，是「pivot 位置是 0」');
  },
  async (tok, S) => {
    gone(S.M); S.M = mview(A6, -3.4, 3.6, { name: '若 8 改成 6', s: 0.8 }); S.M.glowCell(1, 1, GOLD);
    await wt(tok, 500); S.M.pivot(0, 0); await rowOp(tok, S.M, 1, 0, 3, 1000);
    S.M.glowCell(1, 1, REDG); ok(A6a[1][1] === 0, '6 − 3·2 = ' + fmt(A6a[1][1]) + '：第 2 個 pivot 位置是 0 ✓', -3.4, 1.2);
    cap('若 8 改成 6：第二個 pivot 位置變 0', '');
  },
  async (tok, S) => {
    S.M.glowCell(2, 1, GREEN); await wt(tok, 500);
    await swapRows(tok, S.M, 1, 2, 1000); S.M.pivot(1, 1);
    ok(S.M.v[1][1] !== 0, '下面有非 0 的 4 → 換列救回來 ✓', -3.4, 0.5);
    cap('下面有非 0 → 換列就能活下來', '暫時的失敗');
  },
  async (tok, S) => { S.N = mview(Am4, 2.8, 3.6, { name: '若 (3,3) 是 −4', s: 0.8 }); S.N.glowCell(2, 2, GOLD); cap('再試：右下角的 1 改成 −4', ''); },
  async (tok, S) => {
    S.N.glowCell(2, 2, null); S.N.pivot(0, 0); await rowOp(tok, S.N, 1, 0, 3, 800); S.N.pivot(1, 1); await rowOp(tok, S.N, 2, 1, 2, 800);
    S.N.glowCell(2, 2, REDG); ok(Am4b[2][2] === 0, '−4 − 2·(−2) = ' + fmt(Am4b[2][2]) + ' ✓', 2.8, 1.2);
    cap('同樣步驟，最後一刻變成 0', '沒有第三個 pivot');
  },
  async (tok, S) => { ok(det(Am4) === 0, '下面沒有列可換 → 不可逆（det = 0）✓', 2.8, 0.5); cap('下面沒得換：矩陣不可逆', 'singular'); },
  async (tok, S) => { hd('暫時失敗：換列', -3.4, 6.2); hd('完全失敗：0 下面沒有非 0', 2.8, 6.2); cap('兩種失敗', '能換列 → 暫時；沒得換 → 完全失敗'); },
]);

sc('ls-l2-back', 'L2：增廣矩陣 [A | b] 與回代 x = (2, 1, −2)', [
  async (tok, S) => { cap('接下來：回代 back substitution', '先把右邊 b 帶進來'); },
  async (tok, S) => { S.M = mview(EQ2, -0.4, 3.6, { name: '[A | b]', s: 0.95, aug: 3 }); cap('把 b 當成多出來的一行', '叫增廣矩陣 augmented matrix'); },
  async (tok, S) => { S.M.glowCol(3, GOLD); cap('augment = 加上去', '對方程式兩邊做同樣的事'); },
  async (tok, S) => { S.M.glowCol(3, null); S.M.pivot(0, 0); await rowOp(tok, S.M, 1, 0, L21, 1200); ok(Aug1[1][3] === 6, '12 − 3·2 = ' + fmt(Aug1[1][3]) + ' ✓', 3.8, S.M.Y(1)); cap('第一步也作用在 b：12 − 3·2 = 6', '2 和 2 不變'); },
  async (tok, S) => { S.M.pivot(1, 1); await rowOp(tok, S.M, 2, 1, L32, 1200); S.M.pivot(2, 2); ok(Aug2[2][3] === -10, '2 − 2·6 = ' + fmt(Aug2[2][3]) + ' ✓', 3.8, S.M.Y(2)); cap('第二步：2 − 2·6 = −10', ''); },
  async (tok, S) => { txt(S.M.nameL, '[U | c]'); S.M.glowCol(3, GREEN); hot('c = ' + vs(c2), 3.8, 5.6); cap('b 變成 c = (2, 6, −10)', 'A 變成 U，b 變成 c'); },
  async (tok, S) => { S.M.glowCol(3, null); S.eq = Aug2.map((r, i) => hd(eqStr(r), -4.8, 1.2 - i * 0.6)); cap('新的方程式 Ux = c', ''); },
  async (tok, S) => { setCls(S.eq[2], 'ptr alt'); S.M.glowRow(2, GREEN); cube('z = ' + fmt(x2[2]), COL.piv, [1.3, 0.6, 0.5], 3.6, 1.2, 0, 3); cap('先解最後一式：5z = −10 → z = −2', ''); },
  async (tok, S) => { S.M.glowRow(2, null); setCls(S.eq[2], 'ptr'); setCls(S.eq[1], 'ptr alt'); S.M.glowRow(1, GREEN); cube('y = ' + fmt(x2[1]), COL.piv, [1.3, 0.6, 0.5], 3.6, 0.5, 0, 3); cap('往上：2y − 2(−2) = 6 → y = 1', ''); },
  async (tok, S) => { S.M.glowRow(1, null); setCls(S.eq[1], 'ptr'); setCls(S.eq[0], 'ptr alt'); S.M.glowRow(0, GREEN); cube('x = ' + fmt(x2[0]), COL.piv, [1.3, 0.6, 0.5], 3.6, -0.2, 0, 3); cap('再往上：x + 2 − 2 = 2 → x = 2', ''); },
  async (tok, S) => {
    S.M.glowRow(0, null); setCls(S.eq[0], 'ptr');
    ok(same(x2, [2, 1, -2]) && same(mv3(A2, x2), b2), 'A·(2, 1, −2) = ' + vs(mv3(A2, x2)) + ' = b ✓', -0.4, 6.0);
    cap('U 是三角形：倒著解就好', '代回原式檢查');
  },
]);

const xs3 = [3, 4, 5], Axs = mv3(A2, xs3), ys3 = [1, 2, 7], yA = [0, 1, 2].map((j) => ys3.reduce((s, y, i) => s + y * A2[i][j], 0));
sc('ls-l2-rowcomb', 'L2：矩陣 × 行 = 行的組合；列 × 矩陣 = 列的組合', [
  async (tok, S) => { cap('第二部分：把消去寫成矩陣運算', ''); },
  async (tok, S) => { S.A = mview(A2, -1.6, 4.6, { name: 'A', s: 0.7 }); note('示意：拿 A 當例子', -5.0, 6.0); cap('矩陣 A（老師說「某個矩陣」）', ''); },
  async (tok, S) => { sym('×', -0.2, 4.6); mview(xs3.map((v) => [v]), 0.5, 4.6, { name: 'x', s: 0.7, color: COL.c }); sym('=', 1.3, 4.6); S.r = mview(blankM(3, 1), 2.1, 4.6, { name: '結果', s: 0.7, color: COL.u }); cap('矩陣乘一個行向量 (3, 4, 5)', '上次講的：結果是行的組合'); },
  async (tok, S) => {
    S.A.glowCol(0, GOLD); S.A.glowCol(1, GOLD); S.A.glowCol(2, GOLD);
    Axs.forEach((v, i) => S.r.set(i, 0, v));
    const comb = [0, 1, 2].map((i) => 3 * A2[i][0] + 4 * A2[i][1] + 5 * A2[i][2]);
    ok(same(comb, Axs), '3·col₁ + 4·col₂ + 5·col₃ = ' + vs(Axs) + ' ✓', 2.6, 2.9);
    cap('3 個第 1 行 + 4 個第 2 行 + 5 個第 3 行', '');
  },
  async (tok, S) => { S.A.unglow(); cap('同樣的事也可以對「列」做', '這兩週的運算全是列運算'); },
  async (tok, S) => { S.y = mview([ys3], -4.0, 1.5, { name: '列向量', s: 0.6, color: COL.c }); sym('×', -2.6, 1.5); S.B = mview(A2, -1.2, 1.5, { name: 'A', s: 0.6 }); cap('列向量 [1 2 7] 放在左邊乘', '1×3 乘 3×3'); },
  async (tok, S) => { sym('=', 0.4, 1.5); S.o = mview(blankM(1, 3), 1.9, 1.5, { name: '結果是一列', s: 0.6, color: COL.u }); cap('列 × 矩陣 = 一列', '矩陣 × 行 = 一行'); },
  async (tok, S) => {
    S.B.glowRow(0, GOLD); S.B.glowRow(1, GOLD); S.B.glowRow(2, GOLD);
    yA.forEach((v, j) => S.o.set(0, j, v));
    const comb = [0, 1, 2].map((j) => 1 * A2[0][j] + 2 * A2[1][j] + 7 * A2[2][j]);
    ok(same(comb, yA), '1·row₁ + 2·row₂ + 7·row₃ = ' + vs(yA) + ' ✓', 1.9, 0.2);
    cap('1 個第 1 列 + 2 個第 2 列 + 7 個第 3 列', '');
  },
  async (tok, S) => { S.B.unglow(); hot('左乘 = 列的線性組合', 4.6, 2.9); cap('結果是 A 的列的線性組合', '消去要的就是這個'); },
]);

sc('ls-l2-e21', 'L2：E₂₁ = [1 0 0; −3 1 0; 0 0 1]', [
  async (tok, S) => {
    S.E = mview(blankM(3, 3), -4.2, 3.6, { name: 'E = ?', s: 0.75, color: COL.hot }); sym('×', -2.55, 3.6);
    S.A = mview(A2, -0.9, 3.6, { name: 'A', s: 0.75 }); sym('=', 0.75, 3.6);
    cap('哪個矩陣能做「第 2 列減 3 倍第 1 列」？', '');
  },
  async (tok, S) => { S.T = mview(A2a, 2.4, 3.6, { name: '想要的結果', s: 0.75, color: COL.c }); S.T.glowRow(1, GREEN); cap('結果：第 1、3 列不變', '第 2 列變成 (0, 2, −2)'); },
  async (tok, S) => { S.T.unglow(); setRow(S.E, 0, [1, 0, 0]); S.E.glowRow(0, GOLD); S.A.glowRow(0, GOLD); cap('E 的第 1 列：1 0 0', '取 1 個第 1 列、其他列 0 個'); },
  async (tok, S) => { S.E.unglow(); S.A.unglow(); setRow(S.E, 2, [0, 0, 1]); S.E.glowRow(2, GOLD); S.A.glowRow(2, GOLD); cap('E 的第 3 列：0 0 1', '只取第 3 列'); },
  async (tok, S) => { S.E.unglow(); S.A.unglow(); setRow(S.E, 1, [0, 1, 0]); S.E.glowRow(1, GREEN); S.k = ok(same(S.E.v, eye(3)), '中間放 0 1 0 → identity matrix I：什麼都不做 ✓', -1.5, 1.0); cap('若中間是 0 1 0：identity matrix', '像數字 1：乘了不變'); },
  async (tok, S) => { gone(S.k); setRow(S.E, 1, E21[1]); S.E.glowRow(1, GOLD); S.A.glowRow(0, GOLD); S.A.glowRow(1, GOLD); cap('我們要的第 2 列：−3 1 0', '−3 個第 1 列 + 1 個第 2 列'); },
  async (tok, S) => {
    S.A.unglow(); S.E.unglow(); S.E.glowRow(1, GOLD); S.A.glowCol(2, GOLD); S.T.glowCell(1, 2, GREEN);
    const v = dotp(E21[1], A2.map((r) => r[2]));
    ok(v === A2a[1][2], '(2,3) 位置：−3·1 + 1·1 + 0·1 = ' + fmt(v) + ' ✓', -0.9, 1.0);
    cap('檢查 (2,3) 位置：E 第 2 列 · A 第 3 行', '= −2，對了');
  },
  async (tok, S) => { S.E.unglow(); S.A.unglow(); S.T.unglow(); cap('矩陣相乘有好幾種看法', '用行、用列、一次一個元素'); },
  async (tok, S) => { txt(S.E.nameL, 'E₂₁'); ok(same(mm(E21, A2), A2a), 'E₂₁ A = ' + ms(A2a) + ' ✓', -0.9, 1.0); cap('它叫 E₂₁：elementary／elimination matrix', '負責把 (2,1) 位置變 0'); },
]);

sc('ls-l2-e32', 'L2：E₃₂ = [1 0 0; 0 1 0; 0 −2 1]，E₃₂(E₂₁A) = U', [
  async (tok, S) => {
    S.E = mview(blankM(3, 3), -4.2, 3.6, { name: 'E = ?', s: 0.75, color: COL.hot }); sym('×', -2.55, 3.6);
    S.A = mview(A2a, -0.9, 3.6, { name: 'E₂₁A', s: 0.75 }); S.A.pivot(1, 1); sym('=', 0.75, 3.6);
    cap('下一步需要另一個矩陣', '');
  },
  async (tok, S) => { S.A.glowCell(2, 1, REDG); S.T = mview(U2, 2.4, 3.6, { name: '想要 U', s: 0.75, color: COL.c }); S.T.glowRow(2, GREEN); cap('pivot 2 下面是 4：第 3 列減 2 倍第 2 列', ''); },
  async (tok, S) => { S.A.glowCell(2, 1, null); txt(S.E.nameL, 'E₃₂'); cap('它叫 E₃₂', '負責 (3,2) 位置'); },
  async (tok, S) => { S.T.unglow(); setRow(S.E, 0, [1, 0, 0]); setRow(S.E, 1, [0, 1, 0]); cap('第 1、2 列不變：1 0 0、0 1 0', ''); },
  async (tok, S) => { setRow(S.E, 2, E32[2]); S.E.glowCell(2, 1, GOLD); cap('第 3 列：0 −2 1', '−multiplier 放在 (3,2) 位置'); },
  async (tok, S) => { S.E.unglow(); ok(same(mm(E32, A2a), U2), 'E₃₂(E₂₁A) = U = ' + ms(U2) + ' ✓', -0.9, 1.0); cap('E₃₂(E₂₁A) = U', ''); },
]);

sc('ls-l2-assoc', 'L2：結合律——(E₃₂E₂₁)A = U', [
  async (tok, S) => { cap('把各步驟合起來', '用矩陣寫出整個消去'); },
  async (tok, S) => {
    S.A = cube('A', COL.a, [1.1, 0.9, 0.9], -0.5, 3.0, 0, 3); await wt(tok, 300);
    S.e21 = cube('E₂₁', COL.hot, [1.1, 0.9, 0.9], -1.8, 3.0, 0, 3); await wt(tok, 300);
    S.e32 = cube('E₃₂', COL.hot, [1.1, 0.9, 0.9], -3.1, 3.0, 0, 3); sym('=', 0.6, 3.0);
    S.U = cube('U', COL.u, [1.1, 0.9, 0.9], 1.7, 3.0, 0, 3);
    S.p1 = hd('E₃₂ ( E₂₁ A ) = U', -1.0, 5.0);
    cap('先乘 E₂₁，再乘 E₃₂，得到 U', '');
  },
  async (tok, S) => { cap('矩陣記號：一小行就寫完整堂課', ''); },
  async (tok, S) => { S.q = cube('?', '#efe6d6', [1.1, 0.9, 0.9], -2.45, 1.4, 0, 3); cap('哪一個矩陣一次就把 A 變成 U？', ''); },
  async (tok, S) => {
    kill(S.q); glow(S.e21, GOLD); glow(S.e32, GOLD);
    const br = lab.box(COL.hot, [2.4, 0.07, 0.07]); br.position.set(-2.45, 2.35, 0); lab.world.add(br);
    txt(S.p1, '( E₃₂ E₂₁ ) A = U');
    cap('括號可以移：先乘兩個 E', '順序不能換，但先算哪一個可以換');
  },
  async (tok, S) => { glow(S.e21, null); glow(S.e32, null); hot('結合律 associative law', -1.0, 6.0); cap('這叫結合律', '名字可以忘，規則不能忘'); },
  async (tok, S) => {
    mview(E2, 3.9, 3.0, { name: 'E = E₃₂E₂₁', s: 0.6, color: COL.hot });
    ok(same(mm(E2, A2), U2) && same(mm(E32, mm(E21, A2)), mm(mm(E32, E21), A2)), 'EA = U ✓　兩種括號結果相同 ✓', 1.6, 0.9);
    cap('合成一個矩陣 E', 'E = [1 0 0; −3 1 0; 6 −2 1]');
  },
]);

// symbolic 2×2 with letters: P (0/1) times M (letters)
const SM = [['a', 'b'], ['c', 'd']], P2 = [[0, 1], [1, 0]];
const symMul = (X, Y) => X.map((r, i) => Y[0].map((_, j) => { let out = ''; for (let k = 0; k < r.length; k++) { const a = X[i][k], b = Y[k][j]; if (a === 0 || b === 0) continue; out = a === 1 ? b : b === 1 ? a : a + b; } return out || '0'; }));
const PM = symMul(P2, SM), MP = symMul(SM, P2);
sc('ls-l2-perm', 'L2：Permutation matrix——左乘換列、右乘換行', [
  async (tok, S) => { cap('另一種 elementary matrix：交換兩列', 'permutation matrix（置換矩陣）'); },
  async (tok, S) => { S.M = mview(SM, -0.2, 3.8, { name: '[a b; c d]', s: 0.85 }); cap('用 2×2 的 [a b; c d] 來看', ''); },
  async (tok, S) => {
    S.P = mview(P2, -2.6, 3.8, { name: 'P', s: 0.85, color: COL.hot }); S.s1 = sym('×', -1.4, 3.8); S.s2 = sym('=', 1.1, 3.8);
    S.R = mview(PM, 2.4, 3.8, { name: 'PM', s: 0.85, color: COL.c });
    ok(PM[0][0] === 'c' && PM[1][0] === 'a', 'P·M = [c d; a b]：兩列交換 ✓', 0, 1.8);
    cap('要 [c d; a b]：P = [0 1; 1 0]', '第 1 列取 1 個第 2 列');
  },
  async (tok, S) => { S.I = mview(eye(2), -2.6, 6.0, { name: 'I', s: 0.55 }); await swapRows(tok, S.I, 0, 1, 900); ok(same(S.I.v, P2), '把 I 的兩列交換就是 P ✓', -5.0, 6.0); cap('簡單作法：對 identity 做同樣的換列', ''); },
  async (tok, S) => { S.T = mview([['b', 'a'], ['d', 'c']], 4.8, 3.8, { name: '若想換行？', s: 0.65, color: COL.b }); cap('如果想交換「行」呢？', '得到 [b a; d c]'); },
  async (tok, S) => { bad('放左邊：只能做列運算 ✘', 0, 0.9); cap('放在左邊做不到', '左乘永遠是列的組合'); },
  async (tok, S) => {
    gone(S.P, S.R, S.s1, S.s2); sym('×', 1.1, 3.8);
    S.P2 = mview(P2, 2.3, 3.8, { name: 'P（右乘）', s: 0.85, color: COL.hot });
    S.R2 = mview(MP, 2.3, 1.2, { name: 'MP', s: 0.7, color: COL.c });
    ok(MP[0][0] === 'b' && MP[0][1] === 'a', 'M·P = [b a; d c]：兩行交換 ✓', -2.6, 1.2);
    cap('放在右邊：交換兩行', '右乘 = 行的組合');
  },
  async (tok, S) => { hd('列運算：左乘　行運算：右乘', -2.6, 6.1); cap('列運算左乘，行運算右乘', '消去法做的是列運算'); },
  async (tok, S) => { ok(JSON.stringify(PM) !== JSON.stringify(MP), 'PM ≠ MP：AB 一般 ≠ BA ✓', -2.6, 0.4); cap('矩陣乘法不能交換順序', 'AB ≠ BA'); },
  async (tok, S) => { note('交換律 ✘　結合律 ✓', 4.8, 6.1); cap('交換律不成立；但括號可以移', 'commutative ✘、associative ✓'); },
]);

const E21i = inv(E21), bA = mv3(E21, b2), bBack = mv3(E21i, bA);
sc('ls-l2-inv', 'L2：E₂₁ 的反矩陣——減掉的加回去', [
  async (tok, S) => { S.c = [cube('E₃₂', COL.hot, [1.0, 0.8, 0.8], -3.4, 4.6, 0, 3), cube('E₂₁', COL.hot, [1.0, 0.8, 0.8], -2.3, 4.6, 0, 3)]; cap('可以把 E₃₂E₂₁ 乘出來…', '但老師說有更好的看法'); },
  async (tok, S) => { hot('A → U', -3.0, 6.0); S.back = hot('U → A ？', -0.6, 6.0); cap('更好的問法：怎麼從 U 回到 A', '把步驟倒回去'); },
  async (tok, S) => { note('inverse：反矩陣', 2.6, 6.0); cap('倒回去 = 反矩陣（inverse）', '黑板上的矩陣都可逆'); },
  async (tok, S) => { gone(S.c); S.E = mview(E21, -3.8, 3.0, { name: 'E = E₂₁', s: 0.75, color: COL.hot }); cap('例子：E = [1 0 0; −3 1 0; 0 0 1]', ''); },
  async (tok, S) => {
    sym('×', -2.2, 3.0); mview(b2.map((v) => [v]), -1.5, 3.0, { name: 'b', s: 0.75, color: COL.b }); sym('=', -0.8, 3.0);
    S.r = mview(bA.map((v) => [v]), -0.1, 3.0, { name: 'Eb', s: 0.75, color: COL.u });
    ok(same(bA, [2, 6, 2]), 'E·(2, 12, 2) = ' + vs(bA) + ' ✓', -1.5, 0.9);
    cap('這一步把 (2, 12, 2) 變成 (2, 6, 2)', '第 2 列減 3 倍第 1 列');
  },
  async (tok, S) => { S.q = mview(blankM(3, 3), 2.6, 3.0, { name: '?', s: 0.75, color: COL.l }); cap('要找一個矩陣把它變回 (2, 12, 2)', '「還原」消去的矩陣'); },
  async (tok, S) => { note('減掉 3 倍 → 加回 3 倍', 2.6, 5.2); cap('剛才減掉 3 倍第 1 列，現在加回去', ''); },
  async (tok, S) => {
    fillM(S.q, E21i); S.q.glowCell(1, 0, GOLD); txt(S.q.nameL, 'E⁻¹');
    ok(same(bBack, b2), 'E⁻¹·(2, 6, 2) = ' + vs(bBack) + ' ✓', 2.6, 0.9);
    cap('E⁻¹ = [1 0 0; 3 1 0; 0 0 1]', '只是 −3 變 +3');
  },
  async (tok, S) => { S.q.unglow(); ok(same(mm(E21i, E21), eye(3)), 'E⁻¹E = I ✓', 2.6, 0.2); cap('檢查：E⁻¹ 乘 E 得到 identity', ''); },
  async (tok, S) => { hd('E⁻¹：E inverse', 5.2, 3.0); cap('記號：E⁻¹，讀作 E inverse', '下一講繼續'); },
]);

// ═══════════════════════ MIT 18.06 L4：Factorization into A = LU（cued copies） ═══════════════════════
const NA = [[1, 3], [2, 7]], NB = [[2, 1], [1, 1]];            // 示意用的兩個可逆矩陣
const NAB = mm(NA, NB), NBiAi = mm(inv(NB), inv(NA)), NAiBi = mm(inv(NA), inv(NB));
sc('ls-l4-invprod', 'L4：(AB)⁻¹ = B⁻¹A⁻¹', [
  async (tok, S) => { S.h = hd('(AB)⁻¹ = ?', -2.2, 6.2); cap('第一件事：乘積的反矩陣', '兩個可逆矩陣相乘，反矩陣是什麼？'); },
  async (tok, S) => { note('今天的高潮：A = LU', 3.6, 6.2); cap('再用它把消去寫成 A = LU', '消去矩陣的乘積'); },
  async (tok, S) => { S.A = cube('A', COL.a, [1.1, 0.9, 0.9], -4.4, 2.6, 0, 3); S.B = cube('B', COL.b, [1.1, 0.9, 0.9], -3.2, 2.6, 0, 3); cap('假設 A、B 都可逆', 'invertible'); },
  async (tok, S) => { cap('AB 的反矩陣是什麼？', '會用到 A⁻¹ 和 B⁻¹'); },
  async (tok, S) => {
    S.Bi = cube('B⁻¹', COL.b, [1.1, 0.9, 0.9], -2.0, 2.6, 0, 3); S.Ai = cube('A⁻¹', COL.a, [1.1, 0.9, 0.9], -0.8, 2.6, 0, 3);
    txt(S.h, '(AB)⁻¹ = B⁻¹A⁻¹'); setCls(S.h, 'ptr alt');
    cap('答案：B⁻¹A⁻¹，順序反過來', '');
  },
  async (tok, S) => {
    note('示意：A = ' + ms(NA) + '，B = ' + ms(NB), 3.4, 4.9);
    sm('AB = ' + ms(NAB) + '，B⁻¹A⁻¹ = ' + ms(NBiAi), 3.4, 4.2);
    ok(same(mm(NAB, NBiAi), eye(2)), '(AB)(B⁻¹A⁻¹) = I ✓', 3.4, 3.5);
    cap('檢查：AB 乘 B⁻¹A⁻¹', '可以任意移動括號');
  },
  async (tok, S) => {
    glow(S.B, GOLD); glow(S.Bi, GOLD); await wt(tok, 500);
    fly(S.B, V3(-1, 8, 3)); fly(S.Bi, V3(1, 8, 3)); S.I1 = cube('I', '#e9dcc4', [0.9, 0.8, 0.8], -2.6, 2.6, 0, 3);
    cap('先算中間：BB⁻¹ = I', 'A·I·A⁻¹');
  },
  async (tok, S) => {
    glow(S.A, GOLD); glow(S.Ai, GOLD); await wt(tok, 500);
    fly(S.A, V3(-2, 8, 3)); fly(S.Ai, V3(2, 8, 3)); fly(S.I1, V3(0, 8, 3));
    cube('I', '#e9dcc4', [1.2, 0.9, 0.9], -2.6, 2.6, 0, 3);
    cap('A·I 還是 A，再 AA⁻¹ = I', '');
  },
  async (tok, S) => { bub('穿：先襪子 B，再鞋子 A', -2.6, 1.3); bub('脫：先脫鞋 A⁻¹，再脫襪 B⁻¹', -2.6, 0.5); cap('像穿襪子和鞋子', '還原時順序要反過來'); },
  async (tok, S) => {
    ok(same(mm(NBiAi, NAB), eye(2)), '另一邊 (B⁻¹A⁻¹)(AB) = I ✓', 3.4, 2.7);
    ok(!same(NAiBi, NBiAi), 'A⁻¹B⁻¹ = ' + ms(NAiBi) + ' ≠ (AB)⁻¹ ✓', 3.4, 2.0);
    cap('另一邊：B⁻¹A⁻¹·AB 也是 I', '中間的 A⁻¹A 先變成 I');
  },
]);

async function flipT(tok, mv) {   // 2×2 transpose: swap the two off-diagonal blocks
  mv.glowCell(0, 1, GOLD); mv.glowCell(1, 0, GOLD);
  const a = mv.v[0][1], b = mv.v[1][0];
  move(mv.cells[0][1], mv.X(0), mv.Y(1), 0.5); move(mv.cells[1][0], mv.X(1), mv.Y(0), 0.5);
  await wt(tok, 600);
  move(mv.cells[0][1], mv.X(0), mv.Y(1), 0); move(mv.cells[1][0], mv.X(1), mv.Y(0), 0);
  [mv.cells[0][1], mv.cells[1][0]] = [mv.cells[1][0], mv.cells[0][1]]; mv.v[0][1] = b; mv.v[1][0] = a;
  await wt(tok, 400); mv.unglow();
}
const NAi = inv(NA);
sc('ls-l4-invT', 'L4：(Aᵀ)⁻¹ = (A⁻¹)ᵀ', [
  async (tok, S) => { S.h = hd('(Aᵀ)⁻¹ = ?', 0, 6.4); cap('順便：轉置的反矩陣', '轉置 transpose：列變成行'); },
  async (tok, S) => {
    note('示意', -6.0, 5.6);
    mview(NA, -4.2, 4.6, { name: 'A', s: 0.8 }); sym('×', -3.0, 4.6); mview(NAi, -1.8, 4.6, { name: 'A⁻¹', s: 0.8, color: COL.b }); sym('=', -0.6, 4.6);
    mview(mm(NA, NAi), 0.6, 4.6, { name: 'I', s: 0.8, color: COL.c });
    cap('從 AA⁻¹ = I 出發', '');
  },
  async (tok, S) => { S.t = hot('(A A⁻¹)ᵀ = Iᵀ', 4.2, 4.6); cap('兩邊同時轉置', ''); },
  async (tok, S) => { ok(same(tr(eye(2)), eye(2)), 'Iᵀ = I：identity 是對稱的 ✓', 4.2, 3.8); cap('Iᵀ = I', 'identity 是 symmetric matrix'); },
  async (tok, S) => {
    S.L = mview(NAi, -3.0, 1.6, { name: '(A⁻¹)ᵀ', s: 0.8, color: COL.b }); sym('×', -1.8, 1.6); S.R = mview(NA, -0.6, 1.6, { name: 'Aᵀ', s: 0.8 });
    await flipT(tok, S.L); await flipT(tok, S.R);
    sym('=', 0.6, 1.6); mview(mm(S.L.v, S.R.v), 1.8, 1.6, { name: 'I', s: 0.8, color: COL.c });
    ok(same(mm(tr(NAi), tr(NA)), eye(2)), '(A⁻¹)ᵀAᵀ = I ✓（乘積轉置要反序）', 4.2, 2.6);
    cap('乘積轉置：各自轉置、順序反過來', '(A⁻¹)ᵀ Aᵀ = I');
  },
  async (tok, S) => { cap('這說明了什麼？', 'Aᵀ 的反矩陣是誰？'); },
  async (tok, S) => { txt(S.h, '(Aᵀ)⁻¹ = (A⁻¹)ᵀ'); setCls(S.h, 'ptr alt'); ok(same(inv(tr(NA)), tr(NAi)), 'inv(Aᵀ) = ' + ms(inv(tr(NA))) + ' = (A⁻¹)ᵀ ✓', 4.2, 1.0); cap('Aᵀ 的反矩陣就是 (A⁻¹)ᵀ', '把 A⁻¹ 轉置就好'); },
  async (tok, S) => { note('先轉置或先取逆都一樣', 4.2, 0.2); cap('單一矩陣：轉置、取逆可以對調', ''); },
]);

const LA = [[2, 1], [8, 7]], LE = [[1, 0], [-LA[1][0] / LA[0][0], 1]], LU2 = mm(LE, LA), LL = inv(LE);
const LD = [[LU2[0][0], 0], [0, LU2[1][1]]], LU2p = LU2.map((r, i) => r.map((v) => cl(v / LU2[i][i])));
sc('ls-l4-lu2', 'L4：A = [2 1; 8 7] = LU = LDU', [
  async (tok, S) => { cap('用這些工具完成消去', ''); },
  async (tok, S) => { hd('A = LU：最基本的分解', 3.8, 6.6); cap('A = LU：矩陣最基本的分解', '別以為整門課都是消去'); },
  async (tok, S) => { note('假設：不換列、pivot 都不是 0', 3.8, 5.8); cap('先看好矩陣：不需要換列', ''); },
  async (tok, S) => { S.A = mview([[2, ''], [8, '']], -2.4, 5.0, { name: 'A', s: 0.8 }); S.A.pivot(0, 0); ok(8 / 2 === 4, '第一個 pivot 2，multiplier 8 ÷ 2 = 4 ✓', 3.8, 5.0); cap('2×2 例子：2 和 8', 'pivot 2、multiplier 4'); },
  async (tok, S) => { S.A.set(0, 1, 1); cap('右上放 1', ''); },
  async (tok, S) => { S.A.set(1, 1, 4); S.A.glowCell(1, 1, REDG); S.k = ok(4 - 4 * 1 === 0, '若放 4：4 − 4·1 = 0，沒有第二個 pivot ✓', 3.8, 4.2); cap('右下不能放 4', '不然是 singular'); },
  async (tok, S) => { S.A.glowCell(1, 1, null); gone(S.k); S.A.set(1, 1, 7); cap('放 7：A = [2 1; 8 7]', ''); },
  async (tok, S) => {
    sym('=', -1.3, 5.0); S.U = mview(LA, -0.2, 5.0, { name: 'U', s: 0.8 }); S.U.pivot(0, 0);
    await rowOp(tok, S.U, 1, 0, 4, 1200); S.U.pivot(1, 1);
    cap('減掉 4 倍第 1 列：得到 0 和 3', 'U = [2 1; 0 3]');
  },
  async (tok, S) => {
    S.E = mview(LE, -4.6, 5.0, { name: 'E₂₁', s: 0.8, color: COL.hot }); sym('×', -3.5, 5.0);
    ok(same(LU2, [[2, 1], [0, 3]]) && same(S.U.v, LU2), 'E₂₁A = U ✓', 3.8, 4.2);
    cap('E₂₁ = [1 0; −4 1]', '它把 (2,1) 位置變成 0');
  },
  async (tok, S) => {
    S.A2 = mview(LA, -4.6, 2.0, { name: 'A', s: 0.8 }); sym('=', -3.5, 2.0);
    S.L = mview(blankM(2, 2), -2.4, 2.0, { name: 'L', s: 0.8, nameCls: 'ptr alt', colorOf: (v, i, j) => (v === '' ? COL.zero : i > j ? COL.l : i === j ? '#e9dcc4' : COL.zero) });
    S.U2 = mview(LU2, -0.2, 2.0, { name: 'U', s: 0.8 }); S.U2.pivot(0, 0); S.U2.pivot(1, 1);
    cap('目標：A 單獨一邊，其他放另一邊', 'A = L U');
  },
  async (tok, S) => { note('L = E₂₁ 的反矩陣', 3.8, 3.4); cap('L 是什麼？E₂₁ 的反矩陣', '把 E₂₁ 搬到右邊'); },
  async (tok, S) => { fillM(S.L, LL); S.L.glowCell(1, 0, GOLD); cap('E₂₁⁻¹ = [1 0; 4 1]', '正號：把減掉的加回去'); },
  async (tok, S) => { S.L.glowCell(1, 0, null); ok(same(mm(LL, LU2), LA), 'LU = A ✓　4·(2, 1) + (0, 3) = (8, 7)', 3.8, 2.6); cap('檢查：L 乘 U 回到 A', ''); },
  async (tok, S) => { sm('L：lower triangular', -2.4, 0.8); sm('U：upper triangular', -0.2, 0.3); cap('L = 下三角，U = 上三角', 'U 是 upper，所以 L 是 lower'); },
  async (tok, S) => { [0, 1].forEach((i) => { S.L.glowCell(i, i, GREEN); S.U2.glowCell(i, i, GOLD); }); cap('L 的對角線是 1，U 的對角線是 pivots', ''); },
  async (tok, S) => {
    S.L.unglow(); S.U2.unglow();
    gone(S.E, S.A, S.U); lab.world.children.filter((o) => o.element && (o.element.textContent === '=' || o.element.textContent === '×') && o.position.y > 4).forEach(remove);
    mview(LA, -4.6, 5.0, { name: 'A', s: 0.7 }); sym('=', -3.6, 5.0);
    mview(LL, -2.6, 5.0, { name: 'L', s: 0.7, nameCls: 'ptr alt' });
    S.D = mview(LD, -0.8, 5.0, { name: 'D（pivots）', s: 0.7, color: COL.piv });
    cap('也可以把 pivots 拆出來：D', 'D = diag(2, 3)');
  },
  async (tok, S) => {
    mview(LU2p, 1.0, 5.0, { name: 'U\'', s: 0.7 });
    ok(same(mm(mm(LL, LD), LU2p), LA), 'L·D·U\' = A ✓（U\' 的列 ÷ pivot）', 3.8, 5.0);
    cap('A = LDU：U 的列除以 pivot', 'U\' = [1 1/2; 0 1]，兩邊對角線都是 1');
  },
]);

sc('ls-l4-lu3', 'L4：E₃₂E₃₁E₂₁A = U → A = E₂₁⁻¹E₃₁⁻¹E₃₂⁻¹U = LU', [
  async (tok, S) => { S.A = cube('A', COL.a, [1.05, 0.9, 0.9], -1.6, 2.6, 0, 3); cap('接著看比 2×2 大的情況', ''); },
  async (tok, S) => { sm('3×3', -1.6, 1.7); cap('3×3 會出現更重要的差別', '2×2 時只差一個正負號'); },
  async (tok, S) => { S.e21 = cube('E₂₁', COL.hot, [1.05, 0.9, 0.9], -2.8, 2.6, 0, 3); sm('消 (2,1)', -2.8, 3.6); cap('第一步 E₂₁：(2,1) 位置變 0', ''); },
  async (tok, S) => { S.e31 = cube('E₃₁', COL.hot, [1.05, 0.9, 0.9], -4.0, 2.6, 0, 3); sm('消 (3,1)', -4.0, 3.6); cap('再 E₃₁：(3,1) 位置', ''); },
  async (tok, S) => { S.e32 = cube('E₃₂', COL.hot, [1.05, 0.9, 0.9], -5.2, 2.6, 0, 3); sm('消 (3,2)', -5.2, 3.6); sym('=', -0.55, 2.6); S.U = cube('U', COL.u, [1.05, 0.9, 0.9], 0.6, 2.6, 0, 3); cap('最後 E₃₂：(3,2) 位置 → 得到 U', 'E₃₂E₃₁E₂₁A = U'); },
  async (tok, S) => { note('不換列', 3.6, 5.6); cap('一樣假設不需要換列', '典型的情況'); },
  async (tok, S) => { cap('想把 E 們搬到右邊', ''); },
  async (tok, S) => { [S.e32, S.e31, S.e21].forEach((m) => glow(m, GOLD)); sm('每個都好逆：multiplier 變號', -4.0, 1.5); cap('每個 E 都很好求反矩陣', ''); },
  async (tok, S) => { [S.e32, S.e31, S.e21].forEach((m) => glow(m, null)); cap('整串的反矩陣：各自取逆、順序相反', ''); },
  async (tok, S) => { relabel(S.e32, 'E₃₂⁻¹'); tint(S.e32, COL.l); move(S.e32, 0.6, 2.6, 0); move(S.U, 1.8, 2.6, 0); await wt(tok, 800); cap('最外面的 E₃₂ 先過去：E₃₂⁻¹', 'A = …E₃₂⁻¹ U'); },
  async (tok, S) => { relabel(S.e31, 'E₃₁⁻¹'); tint(S.e31, COL.l); move(S.e31, 0.6, 2.6, 0); move(S.e32, 1.8, 2.6, 0); move(S.U, 3.0, 2.6, 0); await wt(tok, 800); cap('接著 E₃₁⁻¹', ''); },
  async (tok, S) => { relabel(S.e21, 'E₂₁⁻¹'); tint(S.e21, COL.l); move(S.e21, 0.6, 2.6, 0); move(S.e31, 1.8, 2.6, 0); move(S.e32, 3.0, 2.6, 0); move(S.U, 4.2, 2.6, 0); await wt(tok, 800); cap('最後 E₂₁⁻¹：A 左邊空了', 'A = E₂₁⁻¹E₃₁⁻¹E₃₂⁻¹U'); },
  async (tok, S) => { const br = lab.box(COL.l, [3.4, 0.08, 0.08]); br.position.set(1.8, 1.8, 0); lab.world.add(br); hot('L', 1.8, 1.3); hd('A = LU', 1.8, 4.6); cap('這三個反矩陣的乘積就是 L', 'A = LU'); },
]);

const V21 = [[1, 0, 0], [-2, 1, 0], [0, 0, 1]], V31 = eye(3), V32 = [[1, 0, 0], [0, 1, 0], [0, -5, 1]];
const VE = mm(V32, mm(V31, V21)), V21i = inv(V21), V32i = inv(V32), VL = mm(V21i, mm(inv(V31), V32i));
sc('ls-l4-evl', 'L4：為什麼用 L——E 裡冒出 10，L 裡沒有', [
  async (tok, S) => { cap('為什麼反矩陣的乘積比較好？', '要 3×3 才看得出來'); },
  async (tok, S) => { S.e21 = mview(V21, -2.6, 4.6, { name: 'E₂₁', s: 0.72, color: COL.hot }); S.e21.glowCell(1, 0, GOLD); cap('E₂₁ 裡是 −2', 'multiplier 2'); },
  async (tok, S) => { S.e21.unglow(); note('E₃₁ = I（(3,1) 已經是 0）', 4.4, 6.2); cap('E₃₁ 就是 identity', '那個位置本來就是 0'); },
  async (tok, S) => { S.e32 = mview(V32, -5.2, 4.6, { name: 'E₃₂', s: 0.72, color: COL.hot }); S.e32.glowCell(2, 1, GOLD); cap('E₃₂ 裡是 −5', 'multiplier 5'); },
  async (tok, S) => { S.e32.unglow(); sym('=', -1.0, 4.6); S.E = mview(blankM(3, 3), 0.7, 4.6, { name: 'E', s: 0.72, color: COL.a }); cap('把它們乘起來：E = E₃₂E₂₁', ''); },
  async (tok, S) => { [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]].forEach(([i, j]) => S.E.set(i, j, VE[i][j])); cap('對角線 1、上方全 0', '只把上面的列減到下面的列'); },
  async (tok, S) => { S.E.set(1, 0, VE[1][0]); S.E.glowRow(1, GOLD); cap('第 2 列：−2 1 0', ''); },
  async (tok, S) => { S.E.unglow(); S.E.set(2, 0, VE[2][0]); S.E.glowCell(2, 0, REDG); tint(S.E.cells[2][0], COL.red); cap('(3,1) 冒出一個 10！', ''); },
  async (tok, S) => { S.E.set(2, 1, VE[2][1]); tint(S.E.cells[2][0], COL.red); ok(same(VE, [[1, 0, 0], [-2, 1, 0], [10, -5, 1]]), 'E = ' + ms(VE) + ' ✓', 0.7, 2.9); cap('(3,2) 是 −5', ''); },
  async (tok, S) => { note('2 × 5 = 10：row 1 經 row 2 進到 row 3', 4.0, 5.4); cap('10 怎麼來的？', 'row 1 經由 row 2 影響到 row 3'); },
  async (tok, S) => { sym('=', -1.0, 1.7); S.L = mview(blankM(3, 3), 0.7, 1.7, { name: 'L', s: 0.72, nameCls: 'ptr alt', colorOf: (v, i, j) => (v === '' ? COL.zero : i > j && Math.abs(v) > 1e-9 ? COL.l : i === j ? '#e9dcc4' : COL.zero) }); cap('反方向：反矩陣、反順序', 'E₂₁⁻¹E₃₂⁻¹'); },
  async (tok, S) => { S.i21 = mview(V21i, -5.2, 1.7, { name: 'E₂₁⁻¹', s: 0.72, nameCls: 'ptr alt' }); S.i21.glowCell(1, 0, GREEN); ok(same(mm(V21i, V21), eye(3)), 'E₂₁⁻¹：+2 ✓', -5.2, 0.2); cap('E₂₁⁻¹：把 2 倍 row 1 加回 row 2', '同一個矩陣，正號'); },
  async (tok, S) => { S.i21.unglow(); S.i32 = mview(V32i, -2.6, 1.7, { name: 'E₃₂⁻¹', s: 0.72, nameCls: 'ptr alt' }); S.i32.glowCell(2, 1, GREEN); ok(same(mm(V32i, V32), eye(3)), 'E₃₂⁻¹：+5 ✓', -2.6, 0.2); cap('E₃₂⁻¹：把 5 加回去', ''); },
  async (tok, S) => {
    S.i32.unglow();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i > j && VL[i][j] !== 0)) S.L.set(i, j, VL[i][j]);
    for (const [i, j, src] of [[1, 0, S.i21], [2, 1, S.i32]]) {
      const g = cube(fmt(VL[i][j]), COL.hot, [0.42, 0.42, 0.3], src.X(j), src.Y(i), 0.6);
      move(g, S.L.X(j), S.L.Y(i), 0.6); await wt(tok, 700); kill(g); S.L.set(i, j, VL[i][j]); S.L.glowCell(i, j, GREEN);
    }
    ok(same(VL, [[1, 0, 0], [2, 1, 0], [0, 5, 1]]), 'L = ' + ms(VL) + ' ✓', 0.7, 0.0);
    cap('乘出來：L = [1 0 0; 2 1 0; 0 5 1]', '');
  },
  async (tok, S) => { S.L.unglow(); hd('EA = U　⇔　A = LU', 4.2, 3.6); cap('E 放在 A 左邊；L 放在 U 左邊', 'EA = U，A = LU'); },
  async (tok, S) => { S.L.glowCell(2, 0, GREEN); ok(VL[2][0] === 0, 'L 的 (3,1) = 0：沒有 10 ✓', 4.2, 2.8); cap('2 和 5 互不干擾，沒有 10', ''); },
  async (tok, S) => { S.L.unglow(); S.L.glowCell(1, 0, GOLD); S.L.glowCell(2, 1, GOLD); hot('不換列：multipliers 直接放進 L', 4.2, 2.0); cap('不換列時，multipliers 直接放進 L', '完全不用計算'); },
  async (tok, S) => { S.L.unglow(); note('存下 U 的新列 + 用過的 multipliers，A 可以丟掉', 3.2, 0.9); cap('消去時只要存 U 和 multipliers', '原本的 A 可以丟了'); },
  async (tok, S) => { S.E.cells.flat().forEach((m) => glow(m, REDG)); S.L.cells.flat().forEach((m) => glow(m, GREEN)); cap('E 不好看；L 直接冒出來', '這就是用矩陣看消去的新收穫'); },
]);

const SUM100 = Array.from({ length: 100 }, (_, i) => (i + 1) ** 2).reduce((a, b) => a + b, 0);
sc('ls-l4-cost', 'L4：消去的運算量 ≈ n³/3', [
  async (tok, S) => {
    const n = 8, u = 0.42; S.n = n; S.u = u;
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(n * u, n * u, n * u), new THREE.MeshBasicMaterial({ color: '#4b9ee2', transparent: true, opacity: 0.08, depthWrite: false }));
    ghost.position.set(0, n * u / 2, 0); lab.world.add(ghost);
    ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineBasicMaterial({ color: '#9fb7d0' })));
    note('示意：n = 8 的小方塊', 3.6, 5.6);
    cap('消去法要花多少運算？', '很實際的問題');
  },
  async (tok, S) => { S.q = hd('n × n：n = 1000？一百萬？', -3.6, 5.4); cap('n×n 的矩陣，n 越大越精確', '但也越貴'); },
  async (tok, S) => { txt(S.q, 'n = 100'); cap('假設 n = 100，而且沒有 0', ''); },
  async (tok, S) => { sm('第一步後：第 1 行 pivot 下面全 0，剩 99×99', -3.6, 4.7); cap('第一步：把第一行 pivot 下面清成 0', '剩下 99×99 的問題'); },
  async (tok, S) => { S.opt = sm('n 加倍時：×2？×4？×8？還是 n!？', -3.6, 4.0); cap('跟 n、n²、n³ 還是 n! 成正比？', ''); },
  async (tok, S) => { note('一次運算 = 乘一次 + 減一次', -3.6, 3.2); cap('一次「運算」：乘一個 ℓ、再減掉', 'multiply-subtract'); },
  async (tok, S) => {
    const { n, u } = S; S.cnt = hot('100² = ' + 100 * 100, -3.6, 2.4);
    const slab = lab.box(COL.a, [n * u, u * 0.92, n * u]); slab.position.set(0, u / 2 + 3, 0); lab.dropTo(lab.addBody(slab), V3(0, u / 2, 0));
    cap('第一步：幾乎每個數都改 ≈ 100²', '');
  },
  async (tok, S) => {
    const { n, u } = S, k = n - 1; txt(S.cnt, '100² + 99² = ' + (100 * 100 + 99 * 99));
    const slab = lab.box('#6fa8dc', [k * u, u * 0.92, k * u]); slab.position.set((k - n) * u / 2, u * 1.5 + 3, (k - n) * u / 2); lab.dropTo(lab.addBody(slab), V3((k - n) * u / 2, u * 1.5, (k - n) * u / 2));
    cap('第二步：問題小一號 ≈ 99²', '');
  },
  async (tok, S) => {
    const { n, u } = S;
    for (let k = n - 2; k >= 1; k--) { const y = (n - k) * u + u / 2; const slab = lab.box('#6fa8dc', [k * u, u * 0.92, k * u]); slab.position.set((k - n) * u / 2, y + 3, (k - n) * u / 2); lab.dropTo(lab.addBody(slab), V3((k - n) * u / 2, y, (k - n) * u / 2)); await wt(tok, 150); }
    txt(S.cnt, '… + 2² + 1²'); cap('98²、97²……一直到 1²', '');
  },
  async (tok, S) => { hd('n² + (n−1)² + … + 1²', 3.6, 4.6); cap('總數 ≈ n² + (n−1)² + … + 1²', ''); },
  async (tok, S) => { bad('不是 n', 3.6, 3.9); bad('不是 n!（那是行列式公式）', 3.6, 3.3); cap('不是 n，也不是 n!', 'n! 是行列式展開公式的量'); },
  async (tok, S) => { hot('是 n³ 等級', 3.6, 2.6); cap('n 項、最大一項 n² → 最多 n³', ''); },
  async (tok, S) => { ok(SUM100 === 338350 && Math.abs(SUM100 / (100 ** 3 / 3) - 1) < 0.02, 'n = 100：' + SUM100 + ' ≈ 100³/3 ≈ 333333 ✓', 3.6, 1.9); cap('大約 n³/3', '因為問題越來越小'); },
  async (tok, S) => { sm('∫₀ⁿ x² dx = n³/3', 3.6, 1.2); cap('像微積分：∫x² dx = x³/3', '加總 ≈ 積分'); },
  async (tok, S) => {
    const { u } = S; for (let k = 1; k <= 8; k++) cube('', COL.u, [u * 0.9, u * 0.9, u * 0.9], 2.6, (k - 0.5) * u, 2.4, 0);
    sm('b：一行', 2.6, 8 * u + 0.4, 2.4); cap('右邊的 b 要花多少？', '');
  },
  async (tok, S) => { hot('每個 b ≈ n²', -3.6, 1.5); cap('每個右邊 b 只要 ≈ n²', '消去 + 回代'); },
  async (tok, S) => { note('A 付一次大錢 → 每個 b 都便宜', -3.6, 0.7); cap('多個右邊：A 先分解一次', '之後每個 b 都很便宜'); },
], { cam: [[7, 5.2, 10], [0, 1.8, 0]] });

function perms(n) { if (n === 1) return [[1]]; const out = []; for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n, ...p.slice(i)]); return out; }
const PM3 = (o) => o.map((r) => [1, 2, 3].map((c) => (c === r ? 1 : 0)));
const ORD = [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2], [2, 3, 1], [3, 1, 2]];
const PS = ORD.map(PM3), key = (M) => M.flat().join('');
const inSet = (M) => PS.some((Q) => key(Q) === key(M));
const CLOSED = PS.every((A) => PS.every((B) => inSet(mm(A, B))));
const PNAMES = ['I', 'P₁₂', 'P₁₃', 'P₂₃', '列序 231', '列序 312'];
sc('ls-l4-perm', 'L4：3×3 的 6 個 permutation matrix，P⁻¹ = Pᵀ', [
  async (tok, S) => { cap('現在允許換列', 'row exchange'); },
  async (tok, S) => { cap('pivot 位置出現 0，就要換列', ''); },
  async (tok, S) => { hd('Transposes and Permutations', 0, 6.9); cap('本章最後一節：轉置與置換', ''); },
  async (tok, S) => { cap('換列要用 permutation matrix', ''); },
  async (tok, S) => { S.m = []; cap('把 3×3 的全部列出來', ''); },
  async (tok, S) => { S.m[0] = mview(PS[0], -4.4, 5.1, { name: PNAMES[0], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('先算 identity：一列都不換', ''); },
  async (tok, S) => { S.m[1] = mview(PS[1], 0, 5.1, { name: PNAMES[1], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('P₁₂：交換 I 的第 1、2 列', '[0 1 0; 1 0 0; 0 0 1]'); },
  async (tok, S) => { cap('全部 = I 的列的所有排法', ''); },
  async (tok, S) => { for (const k of [2, 3]) S.m[k] = mview(PS[k], k === 2 ? 4.4 : -4.4, k === 2 ? 5.1 : 2.1, { name: PNAMES[k], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('P₁₃、P₂₃：只交換一對列', ''); },
  async (tok, S) => { S.m[4] = mview(PS[4], 0, 2.1, { name: PNAMES[4], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('輪換：第 2 列上來、第 3 列上來、第 1 列下去', '[0 1 0; 0 0 1; 1 0 0]'); },
  async (tok, S) => { S.m[5] = mview(PS[5], 4.4, 2.1, { name: PNAMES[5], s: 0.5, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); ok(perms(3).length === 6 && new Set(PS.map(key)).size === 6, '一共 3! = 6 個 ✓', 0, 0.3); cap('最後一個：[0 0 1; 1 0 0; 0 1 0]', ''); },
  async (tok, S) => {
    const pr = mm(PS[1], PS[3]); const k = PS.findIndex((Q) => key(Q) === key(pr));
    [1, 3].forEach((i) => S.m[i].cells.flat().forEach((m) => glow(m, GOLD))); S.m[k].cells.flat().forEach((m) => glow(m, GREEN));
    S.k = ok(CLOSED, PNAMES[1] + '·' + PNAMES[3] + ' = ' + PNAMES[k] + '；36 個乘積都在裡面 ✓', 0, -0.4);
    cap('兩個相乘？還在這 6 個裡', '換列再換列，還是換列');
  },
  async (tok, S) => { S.m.forEach((m) => m.unglow()); gone(S.k); S.k = ok(PS.every((Q) => inSet(inv(Q))), '反矩陣也都在裡面 → group ✓', 0, -0.4); cap('反矩陣也在裡面：形成一個 group', ''); },
  async (tok, S) => { S.m[1].cells.flat().forEach((m) => glow(m, GREEN)); gone(S.k); S.k = ok(same(mm(PS[1], PS[1]), eye(3)), 'P₁₂·P₁₂ = I ✓', 0, -0.4); cap('P₁₂ 的反矩陣就是自己', '再換一次就回來了'); },
  async (tok, S) => { S.m.forEach((m) => m.unglow()); [4, 5].forEach((k) => S.m[k].cells.flat().forEach((m) => glow(m, GOLD))); gone(S.k); S.k = ok(same(mm(PS[4], PS[5]), eye(3)), '231 與 312 互為反矩陣 ✓', 0, -0.4); cap('兩個輪換互為反矩陣', ''); },
  async (tok, S) => { S.m.forEach((m) => m.unglow()); gone(S.k); S.k = ok(PS.every((Q) => same(inv(Q), tr(Q))), '6 個全部 P⁻¹ = Pᵀ ✓', 0, -0.4); cap('反矩陣 = 轉置', 'P⁻¹ = Pᵀ'); },
  async (tok, S) => { gone(S.k); S.k = ok(perms(4).length === 24, '4×4：4! = ' + perms(4).length + ' 個 ✓', 0, -0.4); cap('4×4 有幾個？24 個', ''); },
]);

// ═══════════════════════ 3Blue1Brown：Essence of linear algebra 預告 ═══════════════════════
// 影片沒有給任何數字；畫面上的矩陣、向量都是自己挑的示意例子（數字由程式算）。
const QA = [[1, 2], [3, 4]], QB = [[5, 6], [7, 8]], QAB = mm(QA, QB);
const QE = [[2, 1], [1, 2]], QV = [1, 1], QEv = mv3(QE, QV);
sc('ls-3b-compute', '3B1B：會算，但不知道為什麼', [
  async (tok, S) => { hd('Essence of linear algebra', 0, 6.4); cap('接下來的系列：線性代數', ''); },
  async (tok, S) => { note('示意', -6.0, 5.6); cap('幾乎每個技術領域都要用到', '但第一次學的人常常沒真正懂'); },
  async (tok, S) => {
    mview(QA, -5.0, 4.2, { s: 0.6 }); sym('×', -4.0, 4.2); mview(QB, -3.0, 4.2, { s: 0.6, color: COL.b }); sym('=', -2.0, 4.2);
    mview(QAB, -0.9, 4.2, { s: 0.6, color: COL.c });
    S.k = [ok(same(QAB, [[19, 22], [43, 50]]), '矩陣乘法 ✓', -3.0, 5.2)];
    cap('學會算矩陣乘法', '');
  },
  async (tok, S) => { const d = det(QA); S.k.push(ok(d === QA[0][0] * QA[1][1] - QA[0][1] * QA[1][0], '行列式 det[1 2; 3 4] = 1·4 − 2·3 = ' + fmt(d) + ' ✓', 3.2, 5.2)); cap('學會算行列式', 'determinant'); },
  async (tok, S) => {
    const sp = space([3.4, 1.4, 0], 0.9, 1.4), O = sp.P(0, 0, 0), i = [1, 0, 0], j = [0, 1, 0], k = cross(i, j);
    [[i, COL.a], [j, COL.b], [k, COL.u]].forEach(([v, c]) => { const a = vArrow(c, 0.05); setArrow(a, O, sp.P(...v)); });
    S.k.push(ok(same(k, [0, 0, 1]), '外積 i × j = ' + vs(k) + ' ✓', 3.2, 4.4));
    cap('外積（cross product），也用到行列式', '');
  },
  async (tok, S) => {
    mview(QE, -4.6, 1.6, { s: 0.6 }); sym('×', -3.7, 1.6); mview(QV.map((v) => [v]), -3.0, 1.6, { s: 0.6, color: COL.c }); sym('=', -2.3, 1.6); mview(QEv.map((v) => [v]), -1.6, 1.6, { s: 0.6, color: COL.u });
    S.k.push(ok(same(QEv, QV.map((v) => 3 * v)), '特徵值：Av = 3v ✓', -3.0, 0.5));
    cap('學會算特徵值（eigenvalue）', '');
  },
  async (tok, S) => { bub('為什麼這樣定義？', -3.0, 6.1); bub('跟行列式有什麼關係？', 3.2, 6.1); bub('到底代表什麼？', -3.0, -0.2); cap('卻不懂為什麼', '為什麼乘法這樣定義？特徵值代表什麼？'); },
  async (tok, S) => { cap('數字很熟，幾何直覺很模糊', ''); },
]);

const SH = [[1, 1], [0, 1]], SHp = mv3(SH, [1, 2]);
sc('ls-3b-geo', '3B1B：數值理解 vs 幾何理解', [
  async (tok, S) => {
    note('示意', -6.0, 6.0);
    S.M = mview(SH, -4.4, 4.4, { name: '數字：矩陣', s: 0.8 });
    S.bd = board(2.4, 3.2, 0.42, 5);
    S.g = []; for (let k = -3; k <= 3; k++) { S.g.push([[k, -3], [k, 3], rod('#9fb7d0', 0.02)]); S.g.push([[-3, k], [3, k], rod('#9fb7d0', 0.02)]); }
    S.draw = (u) => { const Mt = [[1, u * SH[0][1]], [u * SH[1][0], 1]]; S.g.forEach(([a, b, r]) => setRod(r, S.bd.P(...mv3(Mt, a)).setZ(0.05), S.bd.P(...mv3(Mt, b)).setZ(0.05))); };
    S.draw(0);
    S.i = vArrow(COL.c, 0.05); S.j = vArrow(COL.red, 0.05); setArrow(S.i, S.bd.P(0, 0).setZ(0.1), S.bd.P(1, 0).setZ(0.1)); setArrow(S.j, S.bd.P(0, 0).setZ(0.1), S.bd.P(0, 1).setZ(0.1));
    cap('數值的理解 vs 幾何的理解', '左邊是數字，右邊是圖');
  },
  async (tok, S) => {
    await anim(tok, 1800, (u) => { S.draw(u); setArrow(S.j, S.bd.P(0, 0).setZ(0.1), S.bd.P(u * SH[0][1], 1).setZ(0.1)); });
    S.M.glowCol(1, GOLD); sm('第 2 行 (1, 1) = 縱軸箭頭跑去的位置', 2.4, 0.2);
    cap('幾何：知道用什麼工具、為什麼有效', '矩陣 = 把整張格子變形');
  },
  async (tok, S) => {
    S.M.unglow(); const d = dot(COL.piv, 0.12); d.position.copy(S.bd.P(...SHp)).setZ(0.15);
    ok(same(SHp, [3, 2]), '數值：[1 1; 0 1]·(1, 2) = ' + vs(SHp) + ' ✓', -4.4, 2.2);
    cap('數值：真的把答案算出來', '兩種都需要');
  },
  async (tok, S) => { cap('少了幾何基礎，問題一時看不出來', '直到更深入某個領域'); },
  async (tok, S) => { bub('別人怎麼一眼就知道？', -4.4, 1.2); cap('那時別人用起來像魔法', '他們其實是靠幾何直覺'); },
]);

const sinTerms = [1, 2, 3, 4].map((n) => { let s = 0; for (let k = 0; k < n; k++) { let f = 1; for (let m = 2; m <= 2 * k + 1; m++) f *= m; s += (k % 2 ? -1 : 1) / f; } return s; });
const SIN1 = Math.sin(1);
sc('ls-3b-sine', '3B1B：sin 的無窮多項式比喻', [
  async (tok, S) => { note('類比', -6.0, 6.2); S.h = hd('sin x = x − x³/3! + x⁵/5! − x⁷/7! + …', -1.6, 6.2); cap('類比：第一次學 sin 時只看到這個', '一個無窮多項式'); },
  async (tok, S) => { sm('計算機就是這樣算 sin', -1.6, 5.5); cap('計算機確實這樣算 sin', ''); },
  async (tok, S) => {
    S.bars = sinTerms.map((v, i) => { const h = v * 4; const m = cube('', i === 3 ? COL.c : COL.a, [0.6, h, 0.6], -5.0 + i * 0.9, h / 2, 0); const l = lab.label(v.toFixed(4), 'val'); l.position.set(0, h / 2 + 0.25, 0); m.add(l); return m; });
    sm('x = 1，前 1～4 項', -3.6, -0.4);
    ok(Math.abs(sinTerms[3] - SIN1) < 1e-3, '4 項 = ' + sinTerms[3].toFixed(6) + ' ≈ sin 1 = ' + SIN1.toFixed(6) + ' ✓', -3.6, 4.6);
    cap('作業：代數字進去、截斷到某一項', '例如 x = 1');
  },
  async (tok, S) => {
    const C = [3.2, 2.2], R = 2.0, pts = [];
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; pts.push(V3(C[0] + R * Math.cos(a), C[1] + R * Math.sin(a), 0)); }
    lab.world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#a99470' })));
    const P = V3(C[0] + R * Math.cos(1), C[1] + R * Math.sin(1), 0);
    setRod(rod(COL.a, 0.03), V3(C[0], C[1], 0), P); setRod(rod('#6e5f49', 0.03), V3(C[0], C[1], 0), V3(P.x, C[1], 0));
    S.h1 = rod(COL.c, 0.05); await anim(tok, 800, (u) => setRod(S.h1, V3(P.x, C[1], 0), V3(P.x, C[1] + (P.y - C[1]) * u, 0)));
    ok(Math.abs((P.y - C[1]) / R - SIN1) < 1e-9, '高 = sin 1 ≈ ' + SIN1.toFixed(4) + ' ✓', 3.2, 4.6);
    cap('其實 sin 跟三角形有關', '角度 1 弧度時的高度');
  },
  async (tok, S) => { bub('物理課上大家一眼就看出來？', 3.2, -0.3); cap('後來上物理課會很挫折', '別人像有電腦腦袋'); },
  async (tok, S) => { note('線性代數也一樣：靠幾個視覺直覺', -1.6, 5.5); cap('線性代數也一樣', '底下有幾個關鍵的視覺直覺'); },
  async (tok, S) => { cap('計算和圖像的連結很直接', '弄懂之後，細節就合理多了'); },
  async (tok, S) => { sm('數字交給電腦，人負責概念', 3.2, 5.3); cap('很多課花太多時間在數值計算', '現在計算多半交給電腦'); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '線性代數・第 1 章',
    title: '矩陣與線性方程組',
    color: 'var(--la)',
    modes: [
      { id: 'picture', name: 'Row / Column picture', enter: enterPicture },
      { id: 'planes', name: '三個平面', enter: () => { planes.custom = null; enterPlanes(); } },
      { id: 'elim', name: '高斯消去', enter: enterElim },
      { id: 'rref', name: 'RREF 與自由變數', enter: enterRref },
      { id: 'lu', name: 'A = LU', enter: enterLU },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['row-picture-2d', 'column-picture-2d', 'row-picture-3d', 'column-picture-3d', 'elimination-3x3', 'back-substitution', 'elementary-matrix', 'pivot-breakdown', 'rref-free', 'three-cases',
      'inv-product', 'inv-transpose', 'lu-2x2', 'lu-3x3', 'e-vs-l', 'lu-cost', 'perm-group'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
