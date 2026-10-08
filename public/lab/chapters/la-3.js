// 線性代數 第3章：行列式（有號面積／體積、三大性質、big formula、cofactor、pivots、det(AB)、Cramer、adj(A)、外積）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   MIT 18.06 L19（23LLB9mNJvc，有字幕）：用三個性質拆出 ad − bc；3×3 的 27 塊只剩 6 項；big formula 有 n! 項；
//     4×4 的 0/1 矩陣（行號 4321 得 +1、3214 得 −1，det = 0，R₁ + R₃ = R₂ + R₄）；cofactor 與棋盤符號；
//     2×2 的 ad + b(−c)；三對角全 1 矩陣 |Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|，1, 0, −1, −1, 0, 1 週期 6，|A₆₁| = 1。
//   課本補充（Strang Ch5；18.06 L18、3B1B「The determinant」「Cross products」「Cramer's rule」尚無字幕）：
//     有號面積與體積、三大性質、det = pivots 乘積（A = [1 2 1; 3 8 1; 0 4 1] → 10）、det(AB)、
//     A⁻¹ = Cᵀ/det A（A = [2 1 0; 1 2 1; 0 1 2]）、Cramer 的面積解釋（2x₁ + x₂ = 4、x₁ + 3x₂ = 7）、外積。
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

  const T2 = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const mstr = (M) => '[' + M.map((r) => r.map(fmt).join(' ')).join('; ') + ']';
  const minor = (M, i, j) => M.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));
  function det(M) {
    const n = M.length;
    if (n === 1) return M[0][0];
    if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
    let s = 0;
    for (let j = 0; j < n; j++) if (M[0][j]) s += (j % 2 ? -1 : 1) * M[0][j] * det(minor(M, 0, j));
    return cl(s);
  }
  const cof = (M, i, j) => ((i + j) % 2 ? -1 : 1) * det(minor(M, i, j));
  const sym = (i, j) => 'a' + sub(i + 1) + sub(j + 1);
  const symM = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => sym(i, j)));
  const POS = '#4b9ee2', NEG = '#d64545';
  // parallelogram spanned by two board vectors (2-D) — a unit square sheared by a basis matrix
  function pgram(color = POS) {
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0.5, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    m.matrixAutoUpdate = false;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#3a3a3a' })));
    lab.world.add(m); return m;
  }
  function setPg(m, bd, a, b, z = 0.02, signColor = true) {
    const O = bd.P(0, 0), va = bd.P(...a).sub(O), vb = bd.P(...b).sub(O);
    m.matrix.makeBasis(va, vb, V3(0, 0, 1)).setPosition(O.x, O.y, z); m.matrixWorldNeedsUpdate = true;
    if (signColor) m.material.color.set(a[0] * b[1] - a[1] * b[0] < -1e-9 ? NEG : POS);
  }
  // parallelogram in 3-D space
  function pgram3(sp, a, b, color) {
    const m = pgram(color);
    const n = sp.D(...a).cross(sp.D(...b)); if (n.length() < 1e-9) n.set(0, 0, 1);
    m.matrix.makeBasis(sp.D(...a), sp.D(...b), n.normalize()).setPosition(sp.P(0, 0, 0)); m.matrixWorldNeedsUpdate = true;
    return m;
  }
  // parallelepiped spanned by three column vectors
  function ppiped(color = POS) {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0.5, 0.5, 0.5);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, roughness: 0.6 }));
    m.matrixAutoUpdate = false;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#2c2c2c' })));
    lab.world.add(m); return m;
  }
  function setPP(m, sp, c1, c2, c3) {
    m.matrix.makeBasis(sp.D(...c1), sp.D(...c2), sp.D(...c3)).setPosition(sp.P(0, 0, 0)); m.matrixWorldNeedsUpdate = true;
    const d = det([[c1[0], c2[0], c3[0]], [c1[1], c2[1], c3[1]], [c1[2], c2[2], c3[2]]]);
    m.material.color.set(d < -1e-9 ? NEG : POS);
    m.material.opacity = Math.abs(d) < 1e-9 ? 0.85 : 0.55;
    return d;
  }
  const colsOf = (M) => M[0].map((_, j) => M.map((r) => r[j]));

  // ───────────────────────── 模式 1：面積與體積 ─────────────────────────
  const ar = { dim: '2', M: [[3, 1], [0, 2]], preset: 'shear', t: 0 };
  const P3 = {
    I: { name: '單位立方體 I', M: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    shear: { name: 'shear（體積不變）', M: [[1, 1, 0], [0, 1, 1], [0, 0, 1]] },
    stretch: { name: '拉長 diag(2, 1, 1.5)', M: [[2, 0, 0], [0, 1, 0], [0, 0, 1.5]] },
    swap: { name: '交換兩行（左手系）', M: [[0, 1, 0], [1, 0, 0], [0, 0, 1]] },
    tilt: { name: '一般 [2 1 0; 0 2 1; 1 0 2]', M: [[2, 1, 0], [0, 2, 1], [1, 0, 2]] },
  };
  function enterArea() {
    fresh(ar.dim === '2' ? [0, 3.3, 11] : [6, 5.6, 10], ar.dim === '2' ? [0, 3.2, 0] : [0, 2.6, 0]);
    if (ar.dim === '2') {
      const bd = board(0, 3.2, 0.6, 4);
      ar.bd = bd; ar.pg = pgram(); ar.c1 = arrow(COL.a); ar.c2 = arrow(COL.b);
      ar.l1 = tag('', 'idx', 0, 0); ar.l2 = tag('', 'idx', 0, 0);
      const sl = (id, v) => '<input id="' + id + '" type="range" min="-3" max="3" step="0.5" value="' + v + '" style="width:80px">';
      controls('<select id="aDim"><option value="2">2D：面積</option><option value="3">3D：體積</option></select> col₁ = (' + sl('a11', ar.M[0][0]) + ', ' + sl('a21', ar.M[1][0]) + ') col₂ = (' + sl('a12', ar.M[0][1]) + ', ' + sl('a22', ar.M[1][1]) + ')<button id="aRot">col₂ 繞一圈</button>');
      [['a11', 0, 0], ['a21', 1, 0], ['a12', 0, 1], ['a22', 1, 1]].forEach(([id, i, j]) => { $(id).oninput = (e) => { ar.M[i][j] = +e.target.value; drawArea2(); }; });
      on('aRot', () => runOp(async () => {
        const r = Math.hypot(ar.M[0][1], ar.M[1][1]) || 2, th0 = Math.atan2(ar.M[1][1], ar.M[0][1]);
        await anim(undefined, 4000, (t) => { ar.M[0][1] = cl(Math.round(r * Math.cos(th0 - 2 * Math.PI * t) * 100) / 100); ar.M[1][1] = cl(Math.round(r * Math.sin(th0 - 2 * Math.PI * t) * 100) / 100); drawArea2(); });
        log('col₂ 轉到 col₁ 的另一側時 det 變號；兩行共線時 det = 0（壓扁）。');
      }));
      drawArea2();
    } else {
      ar.sp = space([0, 1.2, 0], 0.95, 3);
      ar.pp = ppiped(); ar.cs = [arrow(COL.a), arrow(COL.b), arrow(COL.c)];
      controls('<select id="aDim"><option value="2">2D：面積</option><option value="3">3D：體積</option></select><select id="aPre">' + Object.keys(P3).map((k) => '<option value="' + k + '">' + P3[k].name + '</option>').join('') + '</select><label>col₃ → col₁ + col₂ <input id="aT" type="range" min="0" max="1" step="0.05" value="' + ar.t + '" style="width:120px"></label>');
      $('aPre').value = ar.preset;
      $('aPre').onchange = (e) => { ar.preset = e.target.value; ar.t = 0; enterArea(); };
      $('aT').oninput = (e) => { ar.t = +e.target.value; drawArea3(); };
      drawArea3();
    }
    $('aDim').value = ar.dim;
    $('aDim').onchange = (e) => { ar.dim = e.target.value; enterArea(); };
    log(ar.dim === '2' ? 'det [a b; c d] = ad − bc = 兩個行向量張成的平行四邊形「有號」面積。紅色 = 負（方向翻過來）。' : 'det（3×3）= 三個行向量張成的平行六面體有號體積。拉滑桿讓 col₃ 掉進 col₁、col₂ 的平面。');
  }
  function drawArea2() {
    const { bd, M } = ar, a = [M[0][0], M[1][0]], b = [M[0][1], M[1][1]], d = cl(a[0] * b[1] - a[1] * b[0]);
    setPg(ar.pg, bd, a, b);
    const O = bd.P(0, 0).setZ(0.08);
    setArrow(ar.c1, O, bd.P(...a).setZ(0.08)); setArrow(ar.c2, O, bd.P(...b).setZ(0.08));
    const p1 = bd.P(...a), p2 = bd.P(...b);
    ar.l1.position.set(p1.x + 0.3, p1.y - 0.25, 0.1); txt(ar.l1, 'col₁');
    ar.l2.position.set(p2.x + 0.3, p2.y + 0.25, 0.1); txt(ar.l2, 'col₂');
    ['a11', 'a21', 'a12', 'a22'].forEach((id, k) => { if ($(id)) $(id).value = [M[0][0], M[1][0], M[0][1], M[1][1]][k]; });
    setState('2×2 行列式 = 有號面積', [['A', mstr(M)], ['ad − bc', fmt(M[0][0]) + '·' + fmt(M[1][1]) + ' − ' + fmt(M[0][1]) + '·' + fmt(M[1][0]) + ' = ' + fmt(d)], ['面積', fmt(Math.abs(d))], ['方向', Math.abs(d) < 1e-9 ? '壓扁（共線）' : d > 0 ? '正（逆時針）' : '負（翻面）']],
      Math.abs(d) < 1e-9 ? '<span class="no">det = 0：兩行共線 → singular</span>' : '<span class="ok">det ≠ 0 → 可逆</span>');
  }
  function drawArea3() {
    const base = P3[ar.preset].M, cs = colsOf(base);
    const target = cs[0].map((v, k) => v + cs[1][k]);
    const c3 = cs[2].map((v, k) => v + (target[k] - v) * ar.t);
    const d = setPP(ar.pp, ar.sp, cs[0], cs[1], c3);
    const O = ar.sp.P(0, 0, 0);
    [cs[0], cs[1], c3].forEach((c, k) => setArrow(ar.cs[k], O, ar.sp.P(...c)));
    const M = base.map((r, i) => [r[0], r[1], c3[i]]);
    setState('3×3 行列式 = 有號體積', [['A', mstr(M)], ['det', fmt(d)], ['體積', fmt(Math.abs(d))], ['方向', Math.abs(d) < 1e-9 ? '壓扁成平面' : d > 0 ? '右手系' : '左手系（負）']],
      'col₃ 往 col₁ + col₂ 移動：det 線性變小，t = 1 時 <span class="no">三行共面 → det = 0</span>');
  }

  // ───────────────────────── 模式 2：列運算對行列式 ─────────────────────────
  const ro = { A: [[2, 1, 0], [1, 2, 1], [0, 1, 2]], hist: [] };
  function enterRowOps() {
    fresh([1.5, 4.8, 11.5], [1.2, 2.8, 0]);
    ro.mv = mview(ro.A, -3.6, 3.4, { name: 'A（看列向量）', s: 0.95 });
    ro.sp = space([3.0, 1.2, 0], 0.6, 3);
    ro.pp = ppiped(); ro.ar = [arrow(COL.a), arrow(COL.b), arrow(COL.c)];
    ro.d0 = det(ro.A);
    controls('<button id="oSwap">R₁ ↔ R₂</button><button id="oScale">R₁ × 2</button><button id="oHalf">R₁ ÷ 2</button><button class="primary" id="oAdd">R₃ − R₂</button><button id="oAdd2">R₂ + R₁</button><button id="oNew">隨機矩陣</button>');
    const guard = () => { if (Math.max(...ro.mv.v.flat().map(Math.abs)) > 6) { log('數字太大、畫面放不下了，按「隨機矩陣」重來。', true); return false; } return true; };
    const after = (rule, factor) => { const before = ro.d; ro.d = det(ro.mv.v); drawRows(); log(rule + '：det ' + fmt(before) + ' → ' + fmt(ro.d) + factor); };
    on('oSwap', () => runOp(async () => { say('交換兩列', 'det 變號'); await swapRows(undefined, ro.mv, 0, 1, 900); after('交換列', '（× −1）'); }));
    on('oScale', () => runOp(async () => { if (!guard()) return; say('一列乘 2', 'det 也乘 2'); await scaleRow(undefined, ro.mv, 0, 0.5, 800); after('R₁ × 2', '（× 2）'); }));
    on('oHalf', () => runOp(async () => { say('一列除以 2', 'det 也除以 2'); await scaleRow(undefined, ro.mv, 0, 2, 800); after('R₁ ÷ 2', '（÷ 2）'); }));
    on('oAdd', () => runOp(async () => { if (!guard()) return; say('一列減另一列的倍數', 'det 不變（shear）'); await rowOp(undefined, ro.mv, 2, 1, 1, 900); after('R₃ − R₂', '（不變）'); }));
    on('oAdd2', () => runOp(async () => { if (!guard()) return; say('一列加另一列', 'det 不變（shear）'); await rowOp(undefined, ro.mv, 1, 0, -1, 900); after('R₂ + R₁', '（不變）'); }));
    on('oNew', () => { do { ro.A = [0, 1, 2].map(() => [rint(-2, 2), rint(-2, 2), rint(-2, 2)]); } while (Math.abs(det(ro.A)) < 1 || Math.abs(det(ro.A)) > 12); enterRowOps(); });
    ro.d = ro.d0;
    log('det A = det Aᵀ，所以也等於三個「列向量」張成的有號體積。');
    drawRows();
  }
  function drawRows() {
    const R = ro.mv.v, O = ro.sp.P(0, 0, 0);
    setPP(ro.pp, ro.sp, R[0], R[1], R[2]);
    R.forEach((r, k) => setArrow(ro.ar[k], O, ro.sp.P(...r)));
    setState('列運算 vs 行列式', [['目前 A', mstr(R)], ['det', fmt(ro.d)], ['原本 det', fmt(ro.d0)]],
      '換列：<span class="no">× (−1)</span>　一列 × t：× t<br>Rᵢ − ℓRⱼ：<span class="ok">不變</span>（體積只被 shear）');
  }

  // ───────────────────────── 模式 3：餘因子展開 ─────────────────────────
  const cf = { n: 3, A: [[2, 1, 3], [0, 4, 1], [5, 2, 0]], along: 'r0', k: 0, sum: 0, terms: [] };
  function enterCof() {
    fresh([0, 3.3, 11.5], [0, 3.2, 0]);
    const n = cf.A.length;
    cf.k = 0; cf.sum = 0; cf.terms = [];
    cf.mv = mview(cf.A, -3.4, 3.5, { name: 'A', s: 0.9 });
    cf.signs = cf.A.map((r, i) => r.map((_, j) => { const p = cf.mv.cells[i][j]; const l = tag((i + j) % 2 ? '−' : '+', 'idx', p.position.x - 0.32, p.position.y + 0.3, 0.25); return l; }));
    const opts = [];
    for (let i = 0; i < n; i++) opts.push('<option value="r' + i + '">沿第 ' + (i + 1) + ' 列</option>');
    for (let j = 0; j < n; j++) opts.push('<option value="c' + j + '">沿第 ' + (j + 1) + ' 行</option>');
    controls('<select id="fAl">' + opts.join('') + '</select><button class="primary" id="fStep">下一項</button><button id="fAll">全部展開</button><button id="fNew3">隨機 3×3</button><button id="fNew4">隨機 4×4</button>');
    $('fAl').value = cf.along;
    $('fAl').onchange = (e) => { cf.along = e.target.value; enterCof(); };
    on('fStep', () => runOp(() => cofStep()));
    on('fAll', () => runOp(async () => { while (cf.k < n) await cofStep(); }));
    const rnd3 = (m) => Array.from({ length: m }, () => Array.from({ length: m }, () => (Math.random() < 0.3 ? 0 : rint(-3, 5))));
    on('fNew3', () => { cf.A = rnd3(3); if (cf.along.slice(1) > 2) cf.along = 'r0'; enterCof(); });
    on('fNew4', () => { cf.A = rnd3(4); enterCof(); });
    log('Cᵢⱼ = (−1)ⁱ⁺ʲ · det(拿掉第 i 列、第 j 行的子矩陣)。小 + / − 是棋盤符號。挑 0 多的列或行最省事。');
    cofState();
  }
  async function cofStep() {
    const n = cf.A.length;
    if (cf.k >= n) { log('已經展開完了：det A = ' + fmt(cf.sum), true); return; }
    const isRow = cf.along[0] === 'r', fix = +cf.along.slice(1), k = cf.k++;
    const i = isRow ? fix : k, j = isRow ? k : fix;
    const a = cf.A[i][j];
    if (cf.minorV) cf.minorV.kill();
    cf.mv.unglow();
    cf.mv.cells.forEach((r, ii) => r.forEach((m, jj) => { if (ii === i || jj === j) tint(m, ii === i && jj === j ? COL.piv : '#e6dccb'); else tint(m, cf.mv.colorOf(cf.A[ii][jj], ii, jj)); }));
    const Mi = minor(cf.A, i, j), md = det(Mi), sgn = (i + j) % 2 ? -1 : 1, term = a * sgn * md;
    cf.minorV = mview(Mi, 3.2, 3.5, { name: 'M' + sub(i + 1) + sub(j + 1) + '，det = ' + fmt(md), nameCls: 'ptr alt', s: 0.75, color: COL.l });
    cf.sum = cl(cf.sum + term);
    const t = fmt(a) + '·(' + (sgn > 0 ? '+' : '−') + fmt(md) + ')';
    cf.terms.push(t);
    say(a === 0 ? sym(i, j) + ' = 0：這項直接是 0' : sym(i, j) + ' × C' + sub(i + 1) + sub(j + 1), 'C' + sub(i + 1) + sub(j + 1) + ' = ' + (sgn > 0 ? '+' : '−') + 'det M = ' + fmt(sgn * md) + '，這項 = ' + fmt(term));
    log(sym(i, j) + ' = ' + fmt(a) + '，C' + sub(i + 1) + sub(j + 1) + ' = ' + fmt(sgn * md) + ' → ' + fmt(term));
    if (cf.k === n) { await W(undefined, 500); log('det A = ' + cf.terms.join(' + ') + ' = ' + fmt(cf.sum) + (Math.abs(cf.sum - det(cf.A)) < 1e-9 ? '（✓）' : '')); }
    cofState();
  }
  function cofState() {
    setState('Cofactor expansion（' + (cf.along[0] === 'r' ? '沿第 ' : '沿第 ') + (+cf.along.slice(1) + 1) + (cf.along[0] === 'r' ? ' 列）' : ' 行）'), [['A', mstr(cf.A)], ['已展開', cf.k + ' / ' + cf.A.length], ['目前總和', fmt(cf.sum)]],
      'det A = Σⱼ aᵢⱼ Cᵢⱼ（任一列）= Σᵢ aᵢⱼ Cᵢⱼ（任一行）<br>' + (cf.terms.length ? cf.terms.join(' + ') : '按「下一項」'));
  }

  // ───────────────────────── 模式 4：Cramer 法則 ─────────────────────────
  const cr = { A: [[2, 1], [1, 3]], b: [4, 7], show: 1 };
  function enterCramer() {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    cr.bd = board(0, 3.2, 0.42, 7);
    cr.pA = pgram(POS); cr.pB = pgram('#2fc092');
    cr.c1 = arrow(COL.a); cr.c2 = arrow(COL.b); cr.bv = arrow(COL.u, 0.07);
    cr.lb = tag('b', 'ptr alt', 0, 0);
    const sl = (id, v) => '<input id="' + id + '" type="range" min="-6" max="6" step="1" value="' + v + '" style="width:90px">';
    controls('b = (' + sl('cb1', cr.b[0]) + ', ' + sl('cb2', cr.b[1]) + ')<button class="primary" id="cX1">看 x₁</button><button id="cX2">看 x₂</button><button id="cNew">換 A</button>');
    $('cb1').oninput = (e) => { cr.b[0] = +e.target.value; drawCramer(); };
    $('cb2').oninput = (e) => { cr.b[1] = +e.target.value; drawCramer(); };
    on('cX1', () => { cr.show = 1; drawCramer(); });
    on('cX2', () => { cr.show = 2; drawCramer(); });
    on('cNew', () => { do { cr.A = [[rint(-1, 3), rint(-2, 2)], [rint(-2, 2), rint(-1, 3)]]; } while (Math.abs(det(cr.A)) < 1); enterCramer(); });
    log('Cramer：xᵢ = det(Bᵢ) / det(A)，Bᵢ = 把 A 的第 i 行換成 b。綠色面積 ÷ 藍色面積 = xᵢ。');
    drawCramer();
  }
  function drawCramer() {
    const { bd, A, b } = cr, c1 = [A[0][0], A[1][0]], c2 = [A[0][1], A[1][1]], dA = det(A);
    const O = bd.P(0, 0).setZ(0.1);
    setPg(cr.pA, bd, c1, c2, 0.02, false);
    if (cr.show === 1) setPg(cr.pB, bd, b, c2, 0.04, false); else setPg(cr.pB, bd, c1, b, 0.04, false);
    setArrow(cr.c1, O, bd.P(...c1).setZ(0.1)); setArrow(cr.c2, O, bd.P(...c2).setZ(0.1)); setArrow(cr.bv, O, bd.P(...b).setZ(0.12));
    const pb = bd.P(...b); cr.lb.position.set(pb.x + 0.3, pb.y + 0.3, 0.2);
    const B1 = [[b[0], A[0][1]], [b[1], A[1][1]]], B2 = [[A[0][0], b[0]], [A[1][0], b[1]]];
    const x1 = det(B1) / dA, x2 = det(B2) / dA;
    setState('Cramer 法則：Ax = b', [['A', mstr(A)], ['b', '(' + b.join(', ') + ')'], ['det A（藍）', fmt(dA)], ['det B' + sub(cr.show) + '（綠）', fmt(cr.show === 1 ? det(B1) : det(B2))], ['x', '(' + fmt(x1) + ', ' + fmt(x2) + ')']],
      'x' + sub(cr.show) + ' = det B' + sub(cr.show) + ' / det A = ' + fmt(cr.show === 1 ? det(B1) : det(B2)) + ' / ' + fmt(dA) + ' = <span class="ok">' + fmt(cr.show === 1 ? x1 : x2) + '</span>');
  }

  // ───────────────────────── 模式 5：伴隨矩陣求反矩陣 ─────────────────────────
  const ad = { A: [[2, 1, 0], [1, 2, 1], [0, 1, 2]], k: 0 };
  function enterAdj() {
    fresh([0, 3.3, 12], [0, 3.2, 0]);
    ad.k = 0; ad.d = det(ad.A);
    ad.mv = mview(ad.A, -4.4, 3.5, { name: 'A，det = ' + fmt(ad.d), s: 0.8 });
    ad.C = mview([[0, 0, 0], [0, 0, 0], [0, 0, 0]], -0.6, 3.5, { name: 'C（cofactor 矩陣）', s: 0.8, hideZero: true, colorOf: () => '#ece3d3' });
    ad.out = null;
    controls('<button class="primary" id="jStep">下一步</button><button id="jAll">自動跑完</button><button id="jNew">隨機矩陣</button>');
    on('jStep', () => runOp(() => adjStep()));
    on('jAll', () => runOp(async () => { while (ad.k < 11) await adjStep(); }));
    on('jNew', () => { do { ad.A = [0, 1, 2].map(() => [rint(-2, 3), rint(-2, 3), rint(-2, 3)]); } while (Math.abs(det(ad.A)) < 1 || Math.abs(det(ad.A)) > 9); enterAdj(); });
    log('A⁻¹ = Cᵀ / det A：先算 9 個 cofactor，轉置成 adj(A)，再除以 det A。');
    adjState();
  }
  async function adjStep() {
    const A = ad.A;
    if (ad.k < 9) {
      const i = Math.floor(ad.k / 3), j = ad.k % 3; ad.k++;
      ad.mv.cells.forEach((r, ii) => r.forEach((m, jj) => tint(m, ii === i || jj === j ? '#e6dccb' : COL.a)));
      const c = cof(A, i, j);
      ad.C.set(i, j, c); tint(ad.C.cells[i][j], c < 0 ? '#e9a0a0' : '#9fd8c0'); if (!ad.C.cells[i][j].userData.lbl) { ad.C.cells[i][j].userData.lbl = lab.label(fmt(c), 'val'); ad.C.cells[i][j].add(ad.C.cells[i][j].userData.lbl); }
      say('C' + sub(i + 1) + sub(j + 1) + ' = ' + ((i + j) % 2 ? '−' : '+') + 'det(M' + sub(i + 1) + sub(j + 1) + ')', '= ' + fmt(c));
      log('C' + sub(i + 1) + sub(j + 1) + ' = ' + fmt(c));
      if (ad.k === 9) ad.mv.cells.forEach((r) => r.forEach((m) => tint(m, COL.a)));
    } else if (ad.k === 9) {
      ad.k++;
      ad.adj = T2(ad.C.v);
      ad.out = mview(ad.adj, 3.4, 3.5, { name: 'adj A = Cᵀ', nameCls: 'ptr alt', s: 0.8, color: COL.l });
      say('轉置：adj(A) = Cᵀ', 'C 的第 i 列變成 adj 的第 i 行');
      log('adj A = ' + mstr(ad.adj));
    } else if (ad.k === 10) {
      ad.k++;
      const inv = ad.adj.map((r) => r.map((v) => v / ad.d));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ad.out.set(i, j, inv[i][j]);
      txt(ad.out.nameL, 'A⁻¹ = adj A / ' + fmt(ad.d));
      const ok = matMul(A, inv).every((r, i) => r.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-9));
      say('除以 det A = ' + fmt(ad.d), ok ? 'A·A⁻¹ = I ✓' : '檢查失敗');
      log('A·adj(A) = det(A)·I：對角線是 cofactor 展開，非對角線是「有兩列相同」的行列式 = 0。');
    } else log('已經做完了。按「隨機矩陣」再來一題。', true);
    adjState();
  }
  function adjState() {
    setState('A⁻¹ = adj(A) / det(A)', [['A', mstr(ad.A)], ['det A', fmt(ad.d)], ['步驟', Math.min(ad.k, 11) + ' / 11']],
      'adj(A) = Cᵀ；A·Cᵀ = (det A)·I<br>det A = 0 → 沒有反矩陣');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const uniq4 = (ans, cands) => { const o = [...new Set([ans, ...cands.map(String)])].slice(0, 4); return o; };
  function genQ() {
    const kind = rnd(8);
    if (kind === 0) {
      const A = [[rint(-4, 6), rint(-4, 6)], [rint(-4, 6), rint(-4, 6)]], d = det(A);
      return { q: 'det ' + mstr(A) + ' = ？', opts: uniq4(String(d), [A[0][0] * A[1][1] + A[0][1] * A[1][0], -d, A[0][0] * A[1][0] - A[0][1] * A[1][1], d + 2]), ans: String(d), why: 'ad − bc = ' + A[0][0] + '·' + A[1][1] + ' − ' + A[0][1] + '·' + A[1][0] + ' = ' + d + '。' };
    }
    if (kind === 1) {
      const A = [0, 1, 2].map(() => [rint(-2, 3), rint(-2, 3), rint(-2, 3)]), d = det(A);
      const diag = A[0][0] * A[1][1] * A[2][2], plus = diag + A[0][1] * A[1][2] * A[2][0] + A[0][2] * A[1][0] * A[2][1];
      return { q: 'det ' + mstr(A) + ' = ？', opts: uniq4(String(d), [-d, diag, plus, d + 1, d - 3]), ans: String(d), why: '沿第 1 列展開：' + [0, 1, 2].map((j) => A[0][j] + '·(' + fmt(cof(A, 0, j)) + ')').join(' + ') + ' = ' + d + '（六項：三正三負）。' };
    }
    if (kind === 2) {
      const d = pick([2, 3, -2, 4, 5]), n = 3;
      const c = pick([
        ['det(2A)', 8 * d, '每一列都乘 2：2³ = 8 倍', [2 * d, 6 * d, d]],
        ['det(Aᵀ)', d, '轉置不改變行列式', [-d, 1 / d, 0]],
        ['det(A⁻¹)', 1 / d, 'det(A)·det(A⁻¹) = det(I) = 1', [-d, d, -1 / d]],
        ['交換 A 的兩列後的 det', -d, '換列變號', [d, 0, 2 * d]],
        ['把 R₂ 減 5 倍 R₁ 後的 det', d, '一列減另一列的倍數，det 不變', [-4 * d, 5 * d, -d]],
        ['把 R₁ 乘 3 後的 det', 3 * d, '只有一列乘 3 → det 乘 3', [27 * d, d, 9 * d]],
        ['det(−A)', -d, '(−1)³ = −1', [d, 3 * d, 0]],
      ]);
      return { q: 'A 是 ' + n + '×' + n + '，det A = ' + d + '。' + c[0] + ' = ？', opts: uniq4(fmt(c[1]), c[3].map(fmt)), ans: fmt(c[1]), why: c[2] + '。' };
    }
    if (kind === 3) {
      const A = [0, 1, 2].map(() => [rint(-2, 4), rint(-2, 4), rint(-2, 4)]), i = rnd(3), j = rnd(3), c = cof(A, i, j), m = det(minor(A, i, j));
      return { q: 'A = ' + mstr(A) + '，cofactor C' + sub(i + 1) + sub(j + 1) + ' = ？', opts: uniq4(String(c), [-c, A[i][j] * c, m + 1, c + 2]), ans: String(c), why: '拿掉第 ' + (i + 1) + ' 列、第 ' + (j + 1) + ' 行，minor = ' + m + '；符號 (−1)^' + (i + j + 2) + ' = ' + ((i + j) % 2 ? '−' : '+') + ' → C = ' + c + '。' };
    }
    if (kind === 4) {
      let A; do { A = [[rint(1, 4), rint(-2, 3)], [rint(-2, 3), rint(1, 4)]]; } while (Math.abs(det(A)) < 1);
      const x = [rint(-2, 3), rint(-2, 3)], b = [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]], k = rnd(2);
      const Bk = k === 0 ? [[b[0], A[0][1]], [b[1], A[1][1]]] : [[A[0][0], b[0]], [A[1][0], b[1]]];
      return { q: '用 Cramer 法則解 ' + A[0][0] + 'x₁ + ' + A[0][1] + 'x₂ = ' + b[0] + '、' + A[1][0] + 'x₁ + ' + A[1][1] + 'x₂ = ' + b[1] + '，x' + sub(k + 1) + ' = ？', opts: uniq4(String(x[k]), [x[1 - k], -x[k], det(Bk), x[k] + 1]), ans: String(x[k]), why: 'x' + sub(k + 1) + ' = det B' + sub(k + 1) + ' / det A = ' + det(Bk) + ' / ' + det(A) + ' = ' + x[k] + '（B' + sub(k + 1) + '：第 ' + (k + 1) + ' 行換成 b）。' };
    }
    if (kind === 5) {
      const n = rint(5, 70), seq = [1, 0, -1, -1, 0, 1], v = seq[(n - 1) % 6];
      return { q: 'Aₙ 是 n×n、主對角與上下兩條對角線都是 1 的三對角矩陣。det A' + n + ' = ？（det A₁ = 1、det A₂ = 0）', opts: ['1', '0', '−1', String(n)], ans: fmt(v), why: '沿第 1 列展開得 |Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|：1, 0, −1, −1, 0, 1 週期 6；' + n + ' ≡ ' + (((n - 1) % 6) + 1) + '（mod 6）→ ' + fmt(v) + '。' };
    }
    if (kind === 6) {
      const n = pick([3, 4, 5, 6]), f = [1, 1, 2, 6, 24, 120, 720][n];
      return { q: n + '×' + n + ' 行列式的 big formula 一共有幾項？', opts: uniq4(String(f), [n * n, 2 * n, Math.pow(2, n), n * (n - 1)]), ans: String(f), why: '每項從每列每行各取一個 → 一個 permutation，共 ' + n + '! = ' + f + ' 項，一半正一半負。' };
    }
    const a = pick([2, 3, -1]), b = pick([2, 5, -3]);
    const c = pick([['det(AB)', a * b, 'det(AB) = det A · det B'], ['det(A + B)', null, '行列式沒有加法性質，不能只從 det A、det B 決定']]);
    if (c[1] === null) return { q: 'det A = ' + a + '、det B = ' + b + '（都是 3×3）。' + c[0] + ' = ？', opts: uniq4('無法只由 det A、det B 決定', [a + b, a * b, a * b * 8, a - b]), ans: '無法只由 det A、det B 決定', why: c[2] + '。例：A = I、B = −I 時 det(A + B) = 0。' };
    return { q: 'det A = ' + a + '、det B = ' + b + '（都是 3×3）。' + c[0] + ' = ？', opts: uniq4(String(c[1]), [a + b, a * b * 8, -a * b]), ans: String(c[1]), why: c[2] + '。' };
  }

  // ═════════════════════════ 場景：課本補充（Strang Ch5；18.06 L18、3B1B 尚無字幕） ═════════════════════════
  async function scDetArea(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.6, 4), O = bd.P(0, 0).setZ(0.08);
    const pg = pgram(), a1 = arrow(COL.a), a2 = arrow(COL.b);
    const cap = tag('', 'ptr alt', 0, 6.3);
    let c2 = [0, 2];
    const draw = () => { setPg(pg, bd, [3, 0], c2); setArrow(a1, O, bd.P(3, 0).setZ(0.08)); setArrow(a2, O, bd.P(...c2).setZ(0.08)); txt(cap, 'det [3 ' + fmt(c2[0]) + '; 0 ' + fmt(c2[1]) + '] = ' + fmt(3 * c2[1])); };
    draw();
    say('課本：det = 兩行張成的有號面積', 'col₁ = (3, 0)、col₂ = (0, 2)：3 × 2 長方形，面積 6');
    await W(tok, 2800);
    say('col₂ 往右推（shear）', '底 3、高 2 不變 → 面積還是 6');
    await anim(tok, 1600, (t) => { c2 = [1.5 * t, 2]; draw(); });
    await W(tok, 1600);
    say('col₂ 往下壓，面積變小', 'det = 3 × (col₂ 的高度)');
    await anim(tok, 1800, (t) => { c2 = [1.5, 2 - 2 * t]; draw(); });
    say('col₂ 跟 col₁ 共線：壓扁', 'det = 0 → singular');
    await W(tok, 2200);
    say('再往下：翻到另一側，det 變負', '紅色 = 方向翻轉（orientation 反了）');
    await anim(tok, 1600, (t) => { c2 = [1.5, -1.5 * t]; draw(); });
    await W(tok, 2600);
  }
  async function scDetVolume(tok) {
    fresh([6.2, 5.6, 10], [0, 2.4, 0]);
    const sp = space([0, 1.0, 0], 1.0, 3), pp = ppiped(), ar3 = [arrow(COL.a), arrow(COL.b), arrow(COL.c)];
    const cap = tag('', 'ptr alt', 0, 6.2);
    let C = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const draw = () => { const d = setPP(pp, sp, ...C); C.forEach((c, k) => setArrow(ar3[k], sp.P(0, 0, 0), sp.P(...c))); txt(cap, 'det = ' + fmt(Math.round(d * 100) / 100)); };
    draw();
    say('3×3：三個行向量張成的平行六面體', 'det I = 1：單位立方體');
    await W(tok, 2600);
    say('col₁ 拉成 2 倍', '體積 × 2 → det = 2');
    await anim(tok, 1400, (t) => { C = [[1 + t, 0, 0], [0, 1, 0], [0, 0, 1]]; draw(); });
    await W(tok, 1400);
    say('col₃ 往旁邊斜推（shear）', '高度不變 → 體積不變');
    await anim(tok, 1400, (t) => { C = [[2, 0, 0], [0, 1, 0], [t, t, 1]]; draw(); });
    await W(tok, 1400);
    say('col₃ 掉進 col₁、col₂ 的平面', '三行共面 → det = 0');
    await anim(tok, 1800, (t) => { C = [[2, 0, 0], [0, 1, 0], [1, 1, 1 - t]]; draw(); });
    await W(tok, 2200);
    say('再穿過去：體積變負', '換成左手系');
    await anim(tok, 1200, (t) => { C = [[2, 0, 0], [0, 1, 0], [1, 1, -0.8 * t]]; draw(); });
    await W(tok, 2600);
  }
  async function scDetProps(tok) {
    fresh([0, 3.3, 11.5], [0, 3.2, 0]);
    const mv = mview([[1, 0], [0, 1]], -4.6, 4.4, { name: 'A', s: 0.95 });
    const bd = board(2.2, 3.2, 0.62, 4);
    const pg = pgram(), r1 = arrow(COL.a), r2 = arrow(COL.b), O = bd.P(0, 0).setZ(0.08);
    const dl = tag('', 'ptr alt', -4.6, 2.4);
    const draw = () => { const R = mv.v; setPg(pg, bd, R[0], R[1]); setArrow(r1, O, bd.P(...R[0]).setZ(0.08)); setArrow(r2, O, bd.P(...R[1]).setZ(0.08)); txt(dl, 'det = ' + fmt(det(R))); };
    draw();
    say('課本三大性質（這裡畫列向量）', '性質 1：det I = 1');
    await W(tok, 2600);
    say('性質 2：交換兩列 → 變號', 'det = −1');
    await swapRows(tok, mv, 0, 1, 1200); draw();
    await W(tok, 2000);
    await swapRows(tok, mv, 0, 1, 600); draw();
    say('性質 3a：一列乘 t → det 乘 t', 'R₁ × 3 → det = 3');
    await scaleRow(tok, mv, 0, 1 / 3, 1000); draw();
    await W(tok, 2000);
    say('性質 3b：對單一列是線性的', 'det[a+a′ b+b′; c d] = det[a b; c d] + det[a′ b′; c d]');
    await W(tok, 3000);
    say('推論：Rᵢ − ℓRⱼ 不改 det', 'R₂ + R₁ → R₂ = (3, 1)：shear，面積不變');
    await rowOp(tok, mv, 1, 0, -1, 1200); draw();
    await W(tok, 2400);
    say('推論：兩列相同或有零列 → det = 0', '三角矩陣：det = 對角線乘積');
    await W(tok, 2800);
  }
  async function scDetPivots(tok) {
    fresh([0, 3.2, 10.5], [0, 3, 0]);
    const mv = mview([[1, 2, 1], [3, 8, 1], [0, 4, 1]], -1.6, 3.6, { name: 'A', s: 1 });
    say('課本：det = pivots 的乘積', '消去（Rᵢ − ℓRⱼ）不改 det');
    await W(tok, 2400);
    mv.pivot(0, 0);
    await rowOp(tok, mv, 1, 0, 3, 1100); mv.pivot(1, 1);
    await rowOp(tok, mv, 2, 1, 2, 1100); mv.pivot(2, 2);
    txt(mv.nameL, 'U');
    say('U 是上三角：det = 1 × 2 × 5', 'det A = det U = 10');
    const out = tag('det A = 1·2·5 = 10', 'ptr alt', 2.6, 3.6);
    await W(tok, 2800);
    say('有換列時要乘 (−1)^換列次數', 'det A = ± (pivot 乘積)');
    glow(out, null);
    await W(tok, 2400);
    say('這是電腦算行列式的方法：約 n³/3', 'big formula 有 n! 項，太貴');
    await W(tok, 2600);
  }
  async function scDetProduct(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.42, 6), O = bd.P(0, 0);
    const pg = pgram(), cap = tag('', 'ptr alt', 0, 6.2);
    const B = [[1, 1], [-1, 1]], A = [[3, 0], [0, 1]], AB = matMul(A, B);
    const show = (M, t) => { setPg(pg, bd, [M[0][0], M[1][0]], [M[0][1], M[1][1]]); txt(cap, t); };
    show([[1, 0], [0, 1]], '單位正方形：面積 1');
    say('課本：det(AB) = det A · det B', '每個矩陣把面積放大 det 倍');
    await W(tok, 2400);
    await anim(tok, 1400, (t) => show([[1, t], [-t, 1]], ''));
    show(B, 'B = [1 1; −1 1]：面積 × 2');
    say('先做 B：面積變 2', 'det B = 1 + 1 = 2');
    await W(tok, 2200);
    await anim(tok, 1400, (t) => { const M = matMul([[1 + 2 * t, 0], [0, 1]], B); show(M, ''); });
    show(AB, 'AB = [3 3; −1 1]：面積 6');
    say('再做 A = [3 0; 0 1]：再 × 3', 'det(AB) = 2 × 3 = 6');
    await W(tok, 2600);
    say('所以 det(A⁻¹) = 1 / det A', 'det(Aᵀ) = det A；det(2A) = 2ⁿ det A');
    await W(tok, 3000);
  }
  async function scCramer(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.4, 7), O = bd.P(0, 0).setZ(0.1);
    const c1 = [2, 1], c2 = [1, 3], b = [4, 7];
    const pA = pgram(POS); setPg(pA, bd, c1, c2, 0.02, false);
    setArrow(arrow(COL.a), O, bd.P(...c1).setZ(0.1)); setArrow(arrow(COL.b), O, bd.P(...c2).setZ(0.1)); setArrow(arrow(COL.u, 0.07), O, bd.P(...b).setZ(0.12));
    tag('col₁', 'idx', ...bd.P(2.6, 0.6).toArray()); tag('col₂', 'idx', ...bd.P(0.4, 3.4).toArray()); tag('b = (4, 7)', 'ptr alt', ...bd.P(4.9, 7.4).toArray());
    say('例：兩個方程式', '2x₁ + x₂ = 4、x₁ + 3x₂ = 7；det A = 6 − 1 = 5（藍色面積）');
    await W(tok, 2800);
    const pB = pgram('#2fc092');
    let v = b.slice();
    const draw = () => setPg(pB, bd, v, c2, 0.04, false);
    draw();
    const cap = tag('det[b col₂] = 12 − 7 = 5', 'ptr', -1.4, 6.3);
    say('把 col₁ 換成 b：綠色面積 = det B₁', 'B₁ = [4 1; 7 3]，det = 5');
    await W(tok, 2600);
    say('沿 col₂ 滑動，面積不變', 'b = x₁·col₁ + x₂·col₂，滑掉 x₂·col₂ 只剩 x₁·col₁');
    await anim(tok, 2000, (t) => { v = [4 - 2 * t * 1, 7 - 2 * t * 3]; draw(); });
    txt(cap, '綠 = x₁ × 藍');
    say('綠色 = x₁ 倍的藍色', 'x₁ = det B₁ / det A = 5 / 5 = 1');
    await W(tok, 2800);
    v = c1.slice(); setPg(pB, bd, c1, b, 0.04, false);
    txt(cap, 'det[col₁ b] = 14 − 4 = 10');
    say('同理把 col₂ 換成 b', 'x₂ = det B₂ / det A = 10 / 5 = 2');
    await W(tok, 2800);
    say('Cramer：xᵢ = det Bᵢ / det A', '理論漂亮，計算上比消去慢很多');
    await W(tok, 2600);
  }
  async function scAdj(tok) {
    fresh([0, 3.3, 12], [0, 3.2, 0]);
    const A = [[2, 1, 0], [1, 2, 1], [0, 1, 2]];
    const mA = mview(A, -4.6, 3.6, { name: 'A，det = 4', s: 0.8 });
    const C = mview([[0, 0, 0], [0, 0, 0], [0, 0, 0]], -0.8, 3.6, { name: 'C（cofactors）', s: 0.8, hideZero: true, colorOf: () => '#ece3d3' });
    say('課本：A⁻¹ = Cᵀ / det A', '先把 9 個 cofactor 算出來');
    await W(tok, 2400);
    for (let k = 0; k < 9; k++) {
      const i = Math.floor(k / 3), j = k % 3, c = cof(A, i, j);
      mA.cells.forEach((r, ii) => r.forEach((m, jj) => tint(m, ii === i || jj === j ? '#e6dccb' : COL.a)));
      C.set(i, j, c); tint(C.cells[i][j], c < 0 ? '#e9a0a0' : '#9fd8c0');
      if (k < 3) say('C' + sub(i + 1) + sub(j + 1) + '：蓋掉第 ' + (i + 1) + ' 列第 ' + (j + 1) + ' 行', '= ' + ((i + j) % 2 ? '−' : '+') + 'det(剩下的 2×2) = ' + c);
      await W(tok, k < 3 ? 1500 : 500);
    }
    mA.cells.forEach((r) => r.forEach((m) => tint(m, COL.a)));
    say('C 算好了', 'C = [3 −2 1; −2 4 −2; 1 −2 3]，轉置後就是 adj A（這裡剛好對稱）');
    await W(tok, 2400);
    const inv = mview(T2(C.v).map((r) => r.map((v) => v / 4)), 3.2, 3.6, { name: 'A⁻¹ = Cᵀ / 4', nameCls: 'ptr alt', s: 0.8, color: COL.l });
    say('除以 det A = 4', '');
    await W(tok, 2000);
    inv.unglow();
    say('為什麼？看 A·Cᵀ 的對角線', '= 沿第 1 列的 cofactor 展開 = det A：(2,1,0)·(3,−2,1) = 4');
    mA.glowRow(0, GOLD); C.glowRow(0, GOLD);
    await W(tok, 2600);
    mA.unglow(); C.unglow(); mA.glowRow(0, GOLD); C.glowRow(1, GREEN);
    say('非對角線全是 0', '用錯列展開 = 有兩列相同的 det = 0：(2,1,0)·(−2,4,−2) = 0');
    await W(tok, 3000);
    mA.unglow(); C.unglow();
    say('A·Cᵀ = (det A)·I', '⇒ A⁻¹ = Cᵀ / det A');
    await W(tok, 2400);
  }
  async function scCross(tok) {
    fresh([6.5, 5.5, 9.5], [0, 2.4, 0]);
    const sp = space([0, 1.4, 0], 1.0, 2.6), O = sp.P(0, 0, 0);
    const v = [2, 0, 1], w = [0, 1, 1], x = [-1, -2, 2];
    const av = arrow(COL.a), aw = arrow(COL.b);
    setArrow(av, O, sp.P(...v)); setArrow(aw, O, sp.P(...w));
    tag('v = (2, 0, 1)', 'ptr', ...sp.P(2.3, 0, 1.2).toArray()); tag('w = (0, 1, 1)', 'ptr', ...sp.P(0, 1.3, 1.3).toArray());
    say('課本：外積 v × w', 'v、w 張成平行四邊形');
    await W(tok, 2400);
    pgram3(sp, v, w, '#9fd8c0');
    say('|v × w| = 平行四邊形面積', '');
    await W(tok, 2000);
    const ax = arrow(COL.hot, 0.07);
    await anim(tok, 1400, (t) => setArrow(ax, O, sp.P(...x.map((c) => c * t))));
    tag('v × w = (−1, −2, 2)', 'ptr alt', ...sp.P(-1.2, -2.2, 2.4).toArray());
    say('方向：垂直 v 和 w（右手定則）', 'v × w = (0·1 − 1·1, 1·0 − 2·1, 2·1 − 0·0)');
    await W(tok, 3000);
    say('長度 = √(1 + 4 + 4) = 3 = 面積', '(v × w)·v = −2 + 0 + 2 = 0 ✓ 垂直');
    await W(tok, 2800);
    say('記法：第一列放 î ĵ k̂ 的 3×3 行列式', 'v × w = det[î ĵ k̂; 2 0 1; 0 1 1]；w × v = −(v × w)');
    await W(tok, 3000);
  }

  // ═════════════════════════ 場景：MIT 18.06 L19（Determinant Formulas and Cofactors） ═════════════════════════
  async function scDet2Split(tok) {
    fresh([0, 3.3, 12], [0, 3.0, 0]);
    const s = 0.62;
    const top = mview([['a', 'b'], ['c', 'd']], 0, 5.2, { name: '|a b; c d|', s });
    say('只用三個性質，推出 2×2 公式', '性質 1：det I = 1；性質 2：換列變號');
    await W(tok, 2600);
    say('性質 3：第 2 列不動，第 1 列可以拆', '(a, b) = (a, 0) + (0, b)');
    const L = mview([['a', '0'], ['c', 'd']], -2.4, 3.4, { name: '', s }), R = mview([['0', 'b'], ['c', 'd']], 2.4, 3.4, { name: '', s });
    tag('+', 'val', 0, 3.4);
    await W(tok, 2400);
    say('再拆第 2 列：一共 4 個', '(c, d) = (c, 0) + (0, d)');
    const xs = [-4.8, -1.6, 1.6, 4.8], Ms = [[['a', '0'], ['c', '0']], [['a', '0'], ['0', 'd']], [['0', 'b'], ['c', '0']], [['0', 'b'], ['0', 'd']]];
    const four = Ms.map((M, k) => mview(M, xs[k], 1.4, { name: '', s }));
    [-3.2, 0, 3.2].forEach((x) => tag('+', 'val', x, 1.4));
    await W(tok, 2600);
    [0, 3].forEach((k) => { four[k].glowCol(k === 0 ? 1 : 0, REDG); });
    say('有一整行是 0 → det = 0', '這兩個直接丟掉');
    await W(tok, 2200);
    const lbl = [tag('ad', 'ptr alt', xs[1], 0.35), tag('−bc', 'ptr alt', xs[2], 0.35)];
    four[1].glowCell(0, 0, GREEN); four[1].glowCell(1, 1, GREEN);
    four[2].glowCell(0, 1, GOLD); four[2].glowCell(1, 0, GOLD);
    say('對角的那個 = ad；另一個換一次列 = −bc', '|a b; c d| = ad − bc');
    await W(tok, 3000);
    glow(lbl[0], null);
    say('重點是方法：一列一列拆開', '可以推到 3×3、n×n');
    await W(tok, 2400);
  }
  async function scDet3(tok) {
    fresh([0, 3.3, 12], [0, 3.0, 0]);
    const mv = mview(symM(3), -3.4, 3.6, { name: '3×3', s: 0.95 });
    const list = tag('', 'ptr', 2.6, 5.4);
    say('每列拆成 3 塊 → 27 個', '3·3·3 = 27；大部分有整行 0 → 是 0');
    await W(tok, 2800);
    say('留下來的：每列、每行各取一個', '行號 = 1、2、3 的一個排列');
    await W(tok, 2400);
    const perms = [[[0, 1, 2], '+'], [[1, 2, 0], '+'], [[2, 0, 1], '+'], [[0, 2, 1], '−'], [[1, 0, 2], '−'], [[2, 1, 0], '−']];
    const order = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const shown = [];
    for (const p of order) {
      const sg = perms.find((q) => q[0].join() === p.join())[1];
      mv.unglow(); p.forEach((c, r) => mv.glowCell(r, c, sg === '+' ? GREEN : REDG));
      const term = sg + ' ' + p.map((c, r) => sym(r, c)).join('');
      shown.push(term); txt(list, shown.join('\n')); list.element.style.whiteSpace = 'pre';
      const ex = { '0,1,2': '原本的順序：+', '0,2,1': '換一次（2、3 列）：−', '1,0,2': '換一次：−', '1,2,0': '要換兩次：+', '2,0,1': '換兩次：+', '2,1,0': '換一次：−' }[p.join()];
      say(term, ex);
      await W(tok, 1700);
    }
    mv.unglow();
    say('6 項：3 個正、3 個負', '「往右下」正、「往左下」負：只對 3×3 成立');
    await W(tok, 2600);
    say('4×4 反對角線是 +', '換 1↔4、2↔3 兩次 → +，3×3 的斜線口訣不適用');
    await W(tok, 2800);
  }
  async function scBigFormula(tok) {
    fresh([0, 3.3, 11], [0, 3.0, 0]);
    const mv = mview([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]].map((r, i) => r.map((_, j) => sym(i, j))), -2.4, 3.4, { name: '4×4', s: 0.95 });
    const cnt = tag('', 'ptr alt', 3.2, 3.4);
    say('Big formula：每項從每列每行各取一個', 'det A = Σ ± a₁α a₂β a₃γ … a_nω');
    await W(tok, 2600);
    const pickC = [2, 0, 3, 1], used = new Set(), counts = [];
    for (let r = 0; r < 4; r++) {
      const free = [0, 1, 2, 3].filter((c) => !used.has(c));
      free.forEach((c) => mv.glowCell(r, c, GOLD));
      counts.push(free.length); txt(cnt, counts.join(' × ') + (r === 3 ? ' = 24' : ''));
      say('第 ' + (r + 1) + ' 列有 ' + free.length + ' 種選法', r === 0 ? 'n 種' : '用過的行不能再用');
      await W(tok, 1500);
      free.forEach((c) => mv.glowCell(r, c, null));
      mv.glowCell(r, pickC[r], GREEN); used.add(pickC[r]);
      await W(tok, 500);
    }
    say('n × (n−1) × … × 1 = n! 項', '4×4：24 項，一半正一半負');
    await W(tok, 2600);
    say('行號 (α, β, …, ω) 是 1…n 的排列', '正負號 = 那個 permutation 的 det（換偶數次 +、奇數次 −）');
    await W(tok, 3000);
    say('A = I：只有對角那一項不是 0', 'det I = 1 ✓（也能證 det Aᵀ = det A）');
    await W(tok, 2600);
  }
  async function scBig4(tok) {
    fresh([0, 3.3, 11], [0, 3.0, 0]);
    const M = [[0, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 1]];
    const mv = mview(M, -2.6, 3.4, { name: 'A', s: 0.95 });
    const sum = tag('', 'ptr alt', 3.0, 4.6);
    say('L19 例：0 和 1 組成的 4×4', '24 項裡大部分碰到 0');
    await W(tok, 2600);
    [[0, 3], [1, 2], [2, 1], [3, 0]].forEach(([i, j]) => mv.glowCell(i, j, GREEN));
    say('行號 4 3 2 1：換兩次 → +1', 'a₁₄a₂₃a₃₂a₄₁ = 1');
    txt(sum, '+1');
    await W(tok, 2600);
    mv.unglow();
    [[0, 2], [1, 1], [2, 0], [3, 3]].forEach(([i, j]) => mv.glowCell(i, j, REDG));
    say('行號 3 2 1 4：換一次 → −1', 'a₁₃a₂₂a₃₁a₄₄ = 1，帶負號');
    txt(sum, '+1 − 1');
    await W(tok, 2600);
    mv.unglow();
    say('其他 22 項都碰到 0', 'det A = 1 − 1 = 0');
    txt(sum, '+1 − 1 = 0');
    await W(tok, 2400);
    mv.glowRow(0, GOLD); mv.glowRow(2, GOLD);
    say('det = 0 → singular：看列', 'R₁ + R₃ = (1, 1, 1, 1)');
    await W(tok, 2000);
    mv.unglow(); mv.glowRow(1, GREEN); mv.glowRow(3, GREEN);
    say('R₂ + R₄ 也是 (1, 1, 1, 1)', 'R₁ − R₂ + R₃ − R₄ = 0');
    await W(tok, 2800);
  }
  async function scCofDef(tok) {
    fresh([0, 3.3, 11.5], [0, 3.0, 0]);
    const mv = mview(symM(3), -3.6, 3.6, { name: 'A', s: 0.95 });
    say('Cofactor：依第 1 列分組', 'big formula 寫成 det = a₁₁(…) + a₁₂(…) + a₁₃(…)');
    await W(tok, 2600);
    const steps = [[0, '+', 'a₁₁(a₂₂a₃₃ − a₂₃a₃₂)'], [1, '−', 'a₁₂(−(a₂₁a₃₃ − a₂₃a₃₁))'], [2, '+', 'a₁₃(a₂₁a₃₂ − a₂₂a₃₁)']];
    let mn = null;
    for (const [j, sg, f] of steps) {
      mv.cells.forEach((r, i) => r.forEach((m, jj) => tint(m, i === 0 && jj === j ? COL.piv : i === 0 || jj === j ? '#e6dccb' : COL.a)));
      if (mn) mn.kill();
      mn = mview(minor(symM(3), 0, j), 2.6, 3.6, { name: (sg === '+' ? '+' : '−') + ' det（剩下的 2×2）', nameCls: 'ptr alt', s: 0.85, color: COL.l });
      say(j === 1 ? 'a₁₂ 的那組要帶負號' : '蓋掉第 1 列、第 ' + (j + 1) + ' 行', f);
      await W(tok, 2600);
    }
    mn.kill();
    mv.cells.forEach((r) => r.forEach((m) => tint(m, COL.a)));
    say('Cᵢⱼ = ±det(子矩陣 Mᵢⱼ)', 'Mᵢⱼ：拿掉第 i 列第 j 行的 (n−1)×(n−1)；i + j 偶數取 +、奇數取 −');
    await W(tok, 2600);
    const signs = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) signs.push(cube((i + j) % 2 ? '−' : '+', (i + j) % 2 ? '#e9a0a0' : '#9fd8c0', [0.5, 0.5, 0.2], 2.0 + j * 0.6, 4.8 - i * 0.6, 0));
    say('符號是棋盤格', '沒帶符號的叫 minor，帶了才叫 cofactor');
    await W(tok, 3000);
  }
  async function scCofExpand(tok) {
    fresh([0, 3.3, 11.5], [0, 3.0, 0]);
    say('Cofactor formula（沿第 1 列）', 'det A = a₁₁C₁₁ + a₁₂C₁₂ + … + a₁ₙC₁ₙ');
    await W(tok, 2800);
    say('沿任何一列（或行）都可以', 'det A = Σⱼ aᵢⱼCᵢⱼ');
    await W(tok, 2200);
    const mv = mview([['a', 'b'], ['c', 'd']], -3.4, 3.6, { name: '2×2', s: 1 });
    mv.glowCell(0, 0, GOLD); mv.glowCell(1, 1, GREEN);
    say('a 的 cofactor = d', '蓋掉第 1 列第 1 行 → C₁₁ = +d');
    await W(tok, 2200);
    mv.unglow(); mv.glowCell(0, 1, GOLD); mv.glowCell(1, 0, REDG);
    say('b 的 cofactor = −c', '剩 c，位置 (1,2) 帶負號 → ad + b(−c) = ad − bc ✓');
    await W(tok, 2800);
    mv.unglow();
    const xs = [-0.2, 2.4, 5.0], names = [['Pivot 公式', '乘 pivots', COL.piv], ['Cofactor 公式', '在中間', COL.l], ['Big formula', 'n! 項', COL.b]];
    names.forEach(([n, d, c], k) => { cube(n, c, [2.3, 0.8, 0.6], xs[k], 3.9, 0, 3); tag(d, 'idx', xs[k], 3.1); });
    say('三個公式各有用處', 'pivots（最快）、big formula（n! 項）、cofactor（n×n → (n−1)×(n−1)）');
    await W(tok, 3200);
  }
  const tri = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (Math.abs(i - j) <= 1 ? 1 : 0)));
  async function scTriSmall(tok) {
    fresh([0, 3.3, 11.5], [0, 3.0, 0]);
    say('L19 例：三對角、全是 1 的 Aₙ', '對角線和上下各一條是 1，其餘 0');
    mview(tri(1), -5.2, 4.4, { name: 'A₁', s: 0.7 }); tag('det = 1', 'ptr alt', -5.2, 3.4);
    await W(tok, 2200);
    mview(tri(2), -3.4, 4.4, { name: 'A₂', s: 0.7 }); tag('det = 0', 'ptr alt', -3.4, 3.0);
    say('|A₁| = 1、|A₂| = 1 − 1 = 0', '');
    await W(tok, 2200);
    const A3 = mview(tri(3), 0.2, 4.4, { name: 'A₃', s: 0.8, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') });
    say('|A₃|：6 項只剩 3 項', 'big formula：+1（對角）− 1 − 1 = −1');
    for (const pat of [[[0, 0], [1, 1], [2, 2], GREEN], [[0, 1], [1, 0], [2, 2], REDG], [[0, 0], [1, 2], [2, 1], REDG]]) {
      A3.unglow(); pat.slice(0, 3).forEach(([i, j]) => A3.glowCell(i, j, pat[3])); await W(tok, 1300);
    }
    A3.unglow();
    say('另一種：R₂ − R₃，det 不變', 'A₃ → [1 1 0; 1 0 0; 0 1 1]');
    await rowOp(tok, A3, 1, 2, 1, 1200);
    A3.glowCell(1, 0, GOLD);
    say('沿第 2 列展開：只剩 (2,1) 那個 1', '1 × (−1)·det[1 0; 1 1] = −1');
    await W(tok, 3000);
    tag('det = −1', 'ptr alt', 0.2, 2.6);
    await W(tok, 1600);
  }
  async function scTriRec(tok) {
    fresh([0, 3.3, 11.5], [0, 3.0, 0]);
    const A4 = mview(tri(4), -3.8, 4.2, { name: 'A₄', s: 0.75, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') });
    say('|A₄|：沿第 1 列 cofactor 展開', '只有前兩個 1 有貢獻');
    await W(tok, 2400);
    A4.glowCell(0, 0, GOLD); for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) A4.glowCell(i, j, GREEN);
    say('a₁₁ = 1 乘右下 3×3，正是 A₃', '+1·|A₃|');
    await W(tok, 2400);
    A4.unglow(); A4.glowCell(0, 1, GOLD);
    [[1, 0], [2, 0], [3, 0]].forEach(([i, j]) => A4.glowCell(i, j, GREEN));
    for (let i = 2; i < 4; i++) for (let j = 2; j < 4; j++) A4.glowCell(i, j, GREEN);
    say('a₁₂ 在 (1,2)：帶負號；再沿第 1 行展開', '−1·|A₂|');
    await W(tok, 2800);
    A4.unglow();
    say('|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|', '|A₄| = −1 − 0 = −1');
    await W(tok, 2400);
    const seq = [1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1];
    const bars = tag('', 'ptr alt', 3.2, 6.0);
    for (let n = 1; n <= 12; n++) {
      const v = seq[n - 1], x = -0.2 + (n - 1) * 0.6, h = Math.max(0.05, Math.abs(v) * 1.2);
      const m = lab.box(v > 0 ? COL.c : v < 0 ? COL.red : '#c9b48e', [0.45, h, 0.45]);
      m.position.set(x, 2.0 + (v >= 0 ? h / 2 : -h / 2), 0); lab.world.add(m);
      tag(String(n), 'idx', x, 0.55);
      txt(bars, 'n = 1…' + n + '：' + seq.slice(0, n).map(fmt).join(', '));
      if (n <= 7) say('|A' + sub(n) + '| = ' + fmt(v), n >= 3 ? '= |A' + sub(n - 1) + '| − |A' + sub(n - 2) + '| = ' + fmt(seq[n - 2]) + ' − ' + fmt(seq[n - 3]) : '');
      await W(tok, n <= 7 ? 1000 : 300);
    }
    say('一直重複：週期 6', '1, 0, −1, −1, 0, 1, …；|A₆₁| = |A₁| = 1');
    await W(tok, 3200);
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

  const scenes = {
    // 課本補充（Strang Ch5；L18、3B1B 尚無字幕）
    'det-area': { title: '課本：det = 有號面積（shear 不變、共線為 0、翻面變負）', play: scDetArea },
    'det-volume': { title: '課本：3×3 det = 平行六面體的有號體積', play: scDetVolume },
    'det-properties': { title: '課本：行列式的三大性質與推論', play: scDetProps },
    'det-pivots': { title: '課本：det = pivots 乘積（1·2·5 = 10）', play: scDetPivots },
    'det-product': { title: '課本：det(AB) = det A · det B', play: scDetProduct },
    // MIT 18.06 L19
    'det2-split': { title: '用三個性質拆出 ad − bc', play: scDet2Split },
    'det3-six-terms': { title: '3×3：27 塊只剩 6 項，三正三負', play: scDet3 },
    'big-formula': { title: 'Big formula：n! 項，每列每行各取一個', play: scBigFormula },
    'big-formula-4x4': { title: '4×4 例：+1 − 1 = 0，R₁ − R₂ + R₃ − R₄ = 0', play: scBig4 },
    'cofactor-def': { title: 'Cofactor：Cᵢⱼ = (−1)ⁱ⁺ʲ det Mᵢⱼ，棋盤符號', play: scCofDef },
    'cofactor-expand': { title: 'Cofactor formula 與三種公式', play: scCofExpand },
    'tridiag-small': { title: '三對角 A₁、A₂、A₃：1、0、−1', play: scTriSmall },
    'tridiag-recursion': { title: '|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|，週期 6', play: scTriRec },
    // 課本補充
    'adjugate-inverse': { title: '課本：A⁻¹ = Cᵀ / det A', play: scAdj },
    'cramer-geometry': { title: '課本：Cramer 法則的面積解釋', play: scCramer },
    'cross-product': { title: '課本：外積 = 面積 + 垂直方向', play: scCross },
  };

  return {
    kicker: '線性代數・第 3 章',
    title: '行列式 Determinant',
    color: 'var(--la)',
    modes: [
      { id: 'area', name: '面積與體積', enter: enterArea },
      { id: 'rowops', name: '列運算與 det', enter: enterRowOps },
      { id: 'cofactor', name: '餘因子展開', enter: enterCof },
      { id: 'cramer', name: 'Cramer 法則', enter: enterCramer },
      { id: 'adj', name: '伴隨矩陣求逆', enter: enterAdj },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['det-area', 'det-volume', 'det-properties', 'det-pivots', 'det-product',
      'det2-split', 'det3-six-terms', 'big-formula', 'big-formula-4x4', 'cofactor-def', 'cofactor-expand', 'tridiag-small', 'tridiag-recursion',
      'adjugate-inverse', 'cramer-geometry', 'cross-product'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
