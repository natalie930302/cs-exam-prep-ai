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
      const cols = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, r).sort();
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
      'inv-product', 'inv-transpose', 'lu-2x2', 'lu-3x3', 'e-vs-l', 'lu-cost', 'perm-group'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
