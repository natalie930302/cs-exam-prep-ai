// 線性代數 第3章：行列式（有號面積／體積、三大性質、big formula、cofactor、pivots、det(AB)、Cramer、adj(A)、外積）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   MIT 18.06 L19（23LLB9mNJvc，有字幕）：用三個性質拆出 ad − bc；3×3 的 27 塊只剩 6 項；big formula 有 n! 項；
//     4×4 的 0/1 矩陣（行號 4321 得 +1、3214 得 −1，det = 0，R₁ + R₃ = R₂ + R₄）；cofactor 與棋盤符號；
//     2×2 的 ad + b(−c)；三對角全 1 矩陣 |Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|，1, 0, −1, −1, 0, 1 週期 6，|A₆₁| = 1。
//   課本補充（Strang Ch5；18.06 L18、3B1B「The determinant」「Cross products」「Cramer's rule」尚無字幕）：
//     有號面積與體積、三大性質、det = pivots 乘積（A = [1 2 1; 3 8 1; 0 4 1] → 10）、det(AB)、
//     A⁻¹ = Cᵀ/det A（A = [2 1 0; 1 2 1; 0 1 2]）、Cramer 的面積解釋（2x₁ + x₂ = 4、x₁ + 3x₂ = 7）、外積。
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
    // the ghost row covers a row of the matrix: that row's values step aside while it is there (no two numbers printed on each other)
    const hideRow = (i, on) => mv.cells[i].forEach((m) => { if (m.userData.lbl) m.userData.lbl.element.style.visibility = on ? 'hidden' : ''; });
    hideRow(s, true);
    await W(tok, ms * 0.35);
    hideRow(t, true);
    gh.forEach((g, j) => move(g, mv.X(j), mv.Y(t), mv.z + 0.42));
    await W(tok, ms * 0.2);
    hideRow(s, false);
    await W(tok, ms * 0.25);
    gh.forEach(kill); hideRow(t, false);
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
  const pr = (n) => (n < 0 ? '(' + fmt(n) + ')' : fmt(n));
  const uniq4 = (ans, cands) => { const o = [...new Set([ans, ...cands.map(String)])].slice(0, 4); return o; };
  function genQ() {
    const kind = rnd(8);
    if (kind === 0) {
      const A = [[rint(-4, 6), rint(-4, 6)], [rint(-4, 6), rint(-4, 6)]], d = det(A);
      return { q: 'det ' + mstr(A) + ' = ？', opts: uniq4(fmt(d), [A[0][0] * A[1][1] + A[0][1] * A[1][0], -d, A[0][0] * A[1][0] - A[0][1] * A[1][1], d + 2].map(fmt)), ans: fmt(d), why: 'ad − bc = ' + pr(A[0][0]) + '·' + pr(A[1][1]) + ' − ' + pr(A[0][1]) + '·' + pr(A[1][0]) + ' = ' + fmt(d) + '。' };
    }
    if (kind === 1) {
      const A = [0, 1, 2].map(() => [rint(-2, 3), rint(-2, 3), rint(-2, 3)]), d = det(A);
      const diag = A[0][0] * A[1][1] * A[2][2], plus = diag + A[0][1] * A[1][2] * A[2][0] + A[0][2] * A[1][0] * A[2][1];
      return { q: 'det ' + mstr(A) + ' = ？', opts: uniq4(fmt(d), [-d, diag, plus, d + 1, d - 3].map(fmt)), ans: fmt(d), why: '沿第 1 列展開：' + [0, 1, 2].map((j) => pr(A[0][j]) + '·(' + fmt(cof(A, 0, j)) + ')').join(' + ') + ' = ' + fmt(d) + '（六項：三正三負）。' };
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
      return { q: 'A = ' + mstr(A) + '，cofactor C' + sub(i + 1) + sub(j + 1) + ' = ？', opts: uniq4(fmt(c), [-c, A[i][j] * c, m + 1, c + 2].map(fmt)), ans: fmt(c), why: '拿掉第 ' + (i + 1) + ' 列、第 ' + (j + 1) + ' 行，minor = ' + fmt(m) + '；符號 (−1)^' + (i + j + 2) + ' = ' + ((i + j) % 2 ? '−' : '+') + ' → C = ' + fmt(c) + '。' };
    }
    if (kind === 4) {
      let A; do { A = [[rint(1, 4), rint(-2, 3)], [rint(-2, 3), rint(1, 4)]]; } while (Math.abs(det(A)) < 1);
      const x = [rint(-2, 3), rint(-2, 3)], b = [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]], k = rnd(2);
      const Bk = k === 0 ? [[b[0], A[0][1]], [b[1], A[1][1]]] : [[A[0][0], b[0]], [A[1][0], b[1]]];
      const term = (c, v, first) => (c === 0 ? '' : (c < 0 ? (first ? '−' : ' − ') : (first ? '' : ' + ')) + (Math.abs(c) === 1 ? '' : Math.abs(c)) + v);
      const eq = (r, rhs) => { const t1 = term(r[0], 'x₁', true); return t1 + term(r[1], 'x₂', !t1) + ' = ' + fmt(rhs); };
      return { q: '用 Cramer 法則解 ' + eq(A[0], b[0]) + '、' + eq(A[1], b[1]) + '，x' + sub(k + 1) + ' = ？', opts: uniq4(fmt(x[k]), [x[1 - k], -x[k], det(Bk), x[k] + 1].map(fmt)), ans: fmt(x[k]), why: 'x' + sub(k + 1) + ' = det B' + sub(k + 1) + ' / det A = ' + fmt(det(Bk)) + ' / ' + fmt(det(A)) + ' = ' + fmt(x[k]) + '（B' + sub(k + 1) + '：第 ' + (k + 1) + ' 行換成 b）。' };
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
    if (c[1] === null) return { q: 'det A = ' + fmt(a) + '、det B = ' + fmt(b) + '（都是 3×3）。' + c[0] + ' = ？', opts: uniq4('無法只由 det A、det B 決定', [a + b, a * b, a * b * 8, a - b].map(fmt)), ans: '無法只由 det A、det B 決定', why: c[2] + '。例：A = I、B = −I 時 det(A + B) = 0。' };
    return { q: 'det A = ' + fmt(a) + '、det B = ' + fmt(b) + '（都是 3×3）。' + c[0] + ' = ？', opts: uniq4(fmt(c[1]), [a + b, a * b * 8, -a * b].map(fmt)), ans: fmt(c[1]), why: c[2] + '。' };
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dt.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 3 章（行列式）— cued scenes：MIT 18.06 L18／L19、3Blue1Brown（determinant、cross products、Cramer's rule） ───
// 每一個行列式、cofactor、外積、Cramer 的分子分母都由程式當場算（det／bigDet／cross3），畫面顯示 ✓／✘。
// 老師沒給數字的地方用自己選的小例子，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, t, x, y, z = 0) => (b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z));
const pre = (l) => { l.element.style.whiteSpace = 'pre'; return l; };
const near = (a, b) => Math.abs(a - b) < 1e-9;
// everything added after mark() can be wiped in one go
const mark = () => lab.world.children.length;
// a scene = a list of step functions; each runs when the video reaches its cue
const CAM = [[0, 3.3, 11.5], [0, 3.1, 0]];
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    if (o.init) await o.init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 計算 ──
function perms(n) { const out = []; const rec = (p, used) => { if (p.length === n) { out.push(p.slice()); return; } for (let c = 0; c < n; c++) if (!used[c]) { used[c] = 1; p.push(c); rec(p, used); p.pop(); used[c] = 0; } }; rec([], []); return out; }
const sgnP = (p) => { let inv = 0; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++; return inv % 2 ? -1 : 1; };
// big formula: Σ over permutations of sign · a₁α a₂β …
function bigDet(M) { let s = 0; for (const p of perms(M.length)) s += sgnP(p) * p.reduce((t, c, r) => t * M[r][c], 1); return cl(s); }
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const len3 = (a) => Math.sqrt(dot3(a, a));
const mul2 = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];
const det2 = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const lerpM = (A, B, u) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * u));
const cols2 = (a, b) => [[a[0], b[0]], [a[1], b[1]]];
const cols3 = (a, b, c) => [0, 1, 2].map((i) => [a[i], b[i], c[i]]);
const v2s = (v) => '(' + v.map(fmt).join(', ') + ')';
const pstr = (p) => p.map((c) => c + 1).join(' ');
// ── 3D 小零件 ──
function arw(color, r = 0.06) {
  const g = new THREE.Group(), mt = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mt), hh = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mt);
  sh.castShadow = hh.castShadow = true; g.add(sh, hh); g.userData = { sh, hd: hh, mat: mt }; lab.world.add(g); return g;
}
function clipSeg(p, q, e) {
  let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
  const pp = [-dx, dx, -dy, dy], qq = [p[0] + e, e - p[0], p[1] + e, e - p[1]];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(pp[i]) < 1e-12) { if (qq[i] < 0) return null; continue; }
    const r = qq[i] / pp[i];
    if (pp[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
}
function setPgAt(m, bd, o, a, b, z = 0.025) {
  const O = bd.P(0, 0), va = bd.P(...a).sub(O), vb = bd.P(...b).sub(O), oo = bd.P(...o);
  m.matrix.makeBasis(va, vb, V3(0, 0, 1)).setPosition(oo.x, oo.y, z); m.matrixWorldNeedsUpdate = true;
}
const YEL = '#e9c53a', IH = '#2fa86a', JH = '#d64545', KH = '#4b7be2';
// a 3Blue1Brown-style plane: background board + transformed grid + unit square + î (green) ĵ (red)
function lin2(ox, oy, s, ext, o = {}) {
  const bd = board(ox, oy, s, ext);
  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#7fb2e5' })); lab.world.add(grid);
  const sq = pgram(YEL); sq.visible = o.square !== false;
  const ai = arw(IH), aj = arw(JH);
  const L = { bd, M: [[1, 0], [0, 1]], grid, sq, ai, aj, gridOn: o.grid !== false, ext };
  L.set = (M) => {
    L.M = M.map((r) => r.slice());
    const pts = [];
    if (L.gridOn) for (let k = -ext; k <= ext; k++) for (const [p, q] of [[[k, -ext], [k, ext]], [[-ext, k], [ext, k]]]) { const c = clipSeg(mul2(M, p), mul2(M, q), ext); if (c) pts.push(bd.P(c[0][0], c[0][1]).setZ(0.015), bd.P(c[1][0], c[1][1]).setZ(0.015)); }
    grid.geometry.dispose(); grid.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const a = [M[0][0], M[1][0]], b = [M[0][1], M[1][1]], d = det2(M);
    setPg(sq, bd, a, b, 0.03, false); sq.material.color.set(d < -1e-9 ? JH : YEL);
    const O = bd.P(0, 0).setZ(0.08); setArrow(ai, O, bd.P(...a).setZ(0.08)); setArrow(aj, O, bd.P(...b).setZ(0.08));
    return d;
  };
  L.to = (tok, M2, ms = 1500, each) => { const M0 = L.M.map((r) => r.slice()); return anim(tok, ms, (u) => { const d = L.set(lerpM(M0, M2, u)); if (each) each(u, d); }); };
  L.set(L.M);
  return L;
}
// 3-D: axes + parallelepiped of the three columns + î ĵ k̂ arrows
function lin3(o, s, ext = 2.6) {
  const sp = space(o, s, ext), pp = ppiped(), ar = [arw(IH), arw(JH), arw(KH)];
  const L = { sp, pp, ar, C: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
  L.set = (C) => { L.C = C.map((c) => c.slice()); const d = setPP(pp, sp, ...C); C.forEach((c, k) => setArrow(ar[k], sp.P(0, 0, 0), sp.P(...c))); return d; };
  L.to = (tok, C2, ms = 1500, each) => { const C0 = L.C.map((c) => c.slice()); return anim(tok, ms, (u) => { const d = L.set(C0.map((c, k) => c.map((v, i) => v + (C2[k][i] - v) * u))); if (each) each(u, d); }); };
  L.set(L.C);
  return L;
}

// ═════════════════════════ MIT 18.06 L19（23LLB9mNJvc）Determinant Formulas and Cofactors ═════════════════════════
// L19-1：用三個性質拆出 ad − bc
scene('dt-l19-det2', 'L19：用三個性質拆出 ad − bc', [
  async (tok, S) => { cap('目標：找出 det A 的公式', '用 n×n 的元素算出一個數'); S.t = hd('n×n 矩陣 A → 一個數 det A', 0, 5.7); S.mv = mview(symM(3), 0, 3.6, { name: '|A| = ?', s: 0.8 }); },
  async (tok, S) => { cap('還有第二個公式：cofactors', '這堂課後半段會講'); S.c2 = sm('公式 ①：big formula　公式 ②：cofactor', 0, 1.6); },
  async (tok, S) => {
    S.mv.kill(); remove(S.t); remove(S.c2);
    cap('從上一講的三個性質出發', '性質 1、2、3');
    S.props = [pl('性質 1：det I = 1', -4.3, 5.8), pl('性質 2：換列 → 變號', -4.3, 5.3), pl('性質 3：對每一列線性', -4.3, 4.8)];
  },
  async (tok, S) => { cap('先用 2×2 試：大家都知道答案', '但要「只用三個性質」推出來'); S.top = mview([['a', 'b'], ['c', 'd']], 0.6, 5.2, { name: '', s: 0.62 }); },
  async (tok, S) => { cap('性質 1：單位矩陣', 'det I = 1'); S.m1 = mview([[1, 0], [0, 1]], 3.6, 5.2, { s: 0.5 }); S.l1 = ok(det([[1, 0], [0, 1]]) === 1, '= 1 ✓', 4.9, 5.2); },
  async (tok, S) => { cap('性質 2：換列 → 變號', '|0 1; 1 0| = −1'); S.m1.kill(); remove(S.l1); S.m2 = mview([[0, 1], [1, 0]], 3.6, 5.2, { s: 0.5 }); S.l2 = ok(det([[0, 1], [1, 0]]) === -1, '= −1 ✓', 4.9, 5.2); },
  async (tok, S) => {
    S.m2.kill(); remove(S.l2);
    cap('性質 3：第 2 列不動，第 1 列可以拆', '(a, b) = (a, 0) + (0, b)');
    S.L = mview([['a', '0'], ['c', 'd']], -2.4, 3.4, { s: 0.62 }); S.R = mview([['0', 'b'], ['c', 'd']], 2.4, 3.4, { s: 0.62 });
    S.L.glowRow(0, GOLD); S.R.glowRow(0, GOLD); S.plus = pl('+', 0, 3.4);
  },
  async (tok, S) => {
    S.L.unglow(); S.R.unglow();
    cap('再拆第 2 列（第 1 列不動）：一共 4 個', '(c, d) = (c, 0) + (0, d)');
    const xs = [-4.5, -1.5, 1.5, 4.5], Ms = [[['a', '0'], ['c', '0']], [['a', '0'], ['0', 'd']], [['0', 'b'], ['c', '0']], [['0', 'b'], ['0', 'd']]];
    S.xs = xs; S.four = Ms.map((M, k) => mview(M, xs[k], 1.3, { s: 0.58 }));
    S.four.forEach((f) => f.glowRow(1, GOLD)); S.pl3 = [-3, 0, 3].map((x) => pl('+', x, 1.3));
  },
  async (tok, S) => { S.four.forEach((f) => f.unglow()); cap('第一個：第 2 行全是 0', '→ singular，det = 0，丟掉'); S.four[0].glowCol(1, REDG); S.z1 = bad('= 0', S.xs[0], 0.3); },
  async (tok, S) => { cap('最後一個：第 1 行全是 0', '一樣 det = 0'); S.four[3].glowCol(0, REDG); S.z2 = bad('= 0', S.xs[3], 0.3); },
  async (tok, S) => { cap('[a 0; 0 d] 是對角矩陣', '把 a、d 提出來 → ad · det I = ad'); S.four[1].glowCell(0, 0, GREEN); S.four[1].glowCell(1, 1, GREEN); S.ad = hot('ad', S.xs[1], 0.3); },
  async (tok, S) => { cap('[0 b; c 0]：先換列變成 [c 0; 0 b]', '換一次 → 負號：−cb'); S.four[2].glowCell(0, 1, GOLD); S.four[2].glowCell(1, 0, GOLD); S.bc = hot('−bc', S.xs[2], 0.3); },
  async (tok, S) => {
    cap('|a b; c d| = ad − bc', '重點是方法：一列一列拆開，3×3、n×n 也一樣');
    hot('|a b; c d| = ad − bc', 3.6, 5.6);
    const M = [[3, 1], [2, 4]]; ok(near(3 * 4 - 1 * 2, det(M)), '示意 [3 1; 2 4]：3·4 − 1·2 = 10 ✓', 3.6, 5.0);
  },
]);

// L19-2：3×3 的 27 塊只剩 6 項
const TERMS3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const termStr = (p) => (sgnP(p) > 0 ? '+ ' : '− ') + p.map((c, r) => sym(r, c)).join('');
function showTerm(S, p) {
  S.mv.unglow(); p.forEach((c, r) => S.mv.glowCell(r, c, sgnP(p) > 0 ? GREEN : REDG));
  S.shown.push(termStr(p)); txt(S.list, S.shown.join('\n'));
}
scene('dt-l19-det3', 'L19：3×3 的 27 塊只剩 6 項（三正三負）', [
  async (tok, S) => {
    S.mv = mview(symM(3), -3.4, 3.6, { name: '3×3', s: 0.95 }); S.shown = [];
    S.list = pre(hd('', 2.0, 3.4)); S.list.element.style.textAlign = 'left';
    cap('3×3：第 2、3 列不動，第 1 列拆成 3 塊', '(a₁₁,0,0) + (0,a₁₂,0) + (0,0,a₁₃)');
    S.mv.glowRow(0, GOLD); S.cnt = hot('1 → 3', 2.4, 5.8);
  },
  async (tok, S) => { S.mv.unglow(); cap('第 2 列再拆 3 塊、第 3 列也拆 3 塊', '3 × 3 × 3 = 27 個行列式'); txt(S.cnt, '1 → 3 → 9 → 27 = 3³'); },
  async (tok, S) => { cap('可是大部分都是 0', '只要有一整行是 0，det 就是 0'); S.z = sm('27 個裡大多數：有整行 0 → 0', 2.4, 5.2); },
  async (tok, S) => { remove(S.z); cap('哪些不是 0？', '老師叫它們 survivors（倖存者）'); S.sv = sm('survivors = ?', 2.4, 5.2); },
  async (tok, S) => { cap('一個 survivor：a₁₁·a₂₂·a₃₃', '其他位置全是 0：就像 ad 那一項'); showTerm(S, [0, 1, 2]); },
  async (tok, S) => { cap('規律：每一列、每一行各取一個', '一行一個、一列一個'); txt(S.sv, '每列、每行各取一個'); },
  async (tok, S) => {
    S.mv.unglow(); S.mv.glowCell(0, 0, REDG); S.mv.glowCell(1, 0, REDG);
    cap('如果某一行沒被用到', '那一行全是 0 → singular → det = 0（例：第 1 行用了兩次）');
  },
  async (tok, S) => { S.mv.unglow(); [[0, 0], [1, 2], [2, 1]].forEach(([i, j]) => S.mv.glowCell(i, j, GOLD)); cap('另一個：a₁₁ 之後，第 2 列用第 3 行', 'a₁₁ a₂₃ a₃₂：行號 1、3、2'); },
  async (tok, S) => {
    cap('行號 = 1、2、3 的一個排列（permutation）', '就像 permutation matrix，只是 1 換成數字');
    const Pm = [[1, 0, 0], [0, 0, 1], [0, 1, 0]]; S.pm = mview(Pm, 4.4, 1.2, { s: 0.42, name: 'P（行號 1 3 2）' }); S.pd = ok(det(Pm) === -1, 'det P = −1 ✓', 4.4, 0.25);
  },
  async (tok, S) => { cap('把 a₁₁、a₂₃、a₃₂ 提出來，剩下就是 P', '換一次列回到 I → 負號'); showTerm(S, [0, 2, 1]); },
  async (tok, S) => { S.pm.kill(); remove(S.pd); cap('a₁₂ 那兩項：a₁₂ a₂₁ a₃₃', '離 I 只差一次交換 → −'); showTerm(S, [1, 0, 2]); },
  async (tok, S) => { cap('a₁₂ a₂₃ a₃₁：一次交換排不好', '要換兩次（1↔3、2↔3）→ +'); showTerm(S, [1, 2, 0]); },
  async (tok, S) => { cap('a₁₃ a₂₁ a₃₂', '也是換兩次 → +'); showTerm(S, [2, 0, 1]); },
  async (tok, S) => { cap('a₁₃ a₂₂ a₃₁', '換一次（1↔3）→ −'); showTerm(S, [2, 1, 0]); },
  async (tok, S) => {
    S.mv.unglow(); remove(S.sv); remove(S.cnt);
    cap('6 項：3 個正、3 個負', '這就是從三個性質推出的 3×3 公式');
    const A = [[2, 1, 3], [0, 4, 1], [5, 2, 0]], terms = TERMS3.map((p) => sgnP(p) * p.reduce((t, c, r) => t * A[r][c], 1));
    S.chk = ok(near(terms.reduce((a, b) => a + b, 0), det(A)), '示意 ' + mstr(A) + '：6 項相加 = ' + fmt(det(A)) + ' ✓', 1.2, 0.5);
  },
  async (tok, S) => {
    cap('口訣：往右下的取 +、往左下的取 −', '只對 3×3 成立（Sarrus）');
    const c = (i, j) => V3(S.mv.X(j), S.mv.Y(i), 0.5);
    S.a1 = arrow(c(0, 0).add(V3(-0.4, 0.4, 0)), c(2, 2).add(V3(0.4, -0.4, 0)), 0x0f5a3a); S.a2 = arrow(c(0, 2).add(V3(0.4, 0.4, 0)), c(2, 0).add(V3(-0.4, -0.4, 0)), 0x7a1010);
  },
  async (tok, S) => {
    kill(S.a1); kill(S.a2); S.mv.kill(); remove(S.chk);
    cap('4×4：反對角線反而是 +', '換 1↔4、再換 2↔3：兩次 → +1');
    const A4 = [[0, 0, 0, 1], [0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0]];
    mview(A4, -3.0, 3.4, { s: 0.75, name: '4×4 反對角', hideZero: true }); ok(det(A4) === 1 && bigDet(A4) === 1, 'det = +1 ✓', -3.0, 1.3);
  },
]);

// L19-3：big formula
scene('dt-l19-big', 'L19：Big formula——n! 項，每列每行各取一個', [
  async (tok, S) => {
    S.mv = mview(symM(4), -2.6, 3.4, { name: '4×4', s: 0.9 });
    cap('Big formula：det A = 很多項的和', '每一項前面有 + 或 −'); S.f = hot('det A = Σ（± 一堆乘積）', 2.9, 5.7);
  },
  async (tok, S) => { cap('2×2 有 2 項、3×3 有 6 項', '一半正、一半負'); S.cnt = hd('2×2：2 項　3×3：6 項', 3.0, 4.9); },
  async (tok, S) => { cap('那 4×4 有幾項？', '24 = 4!'); txt(S.cnt, '2×2：2　3×3：6　4×4：24'); },
  async (tok, S) => { const f = [1, 2, 6, 24, 120, 720]; cap('一般是 n! 項', 'n = 4, 5, 6：' + f[4 - 1] + '、' + f[5 - 1] + '、' + f[6 - 1]); txt(S.cnt, 'n! 項：24、120、720…'); },
  async (tok, S) => {
    S.pick = [2, 0, 3, 1]; S.used = new Set();
    [0, 1, 2, 3].forEach((c) => S.mv.glowCell(0, c, GOLD)); S.ways = hot('4', 3.0, 3.6);
    cap('第 1 列的那個可以從 n 行裡選', 'n 種選法'); await wt(tok, 900);
    S.mv.glowRow(0, null); S.mv.glowCell(0, S.pick[0], GREEN); S.used.add(S.pick[0]);
  },
  async (tok, S) => {
    const free = [0, 1, 2, 3].filter((c) => !S.used.has(c)); free.forEach((c) => S.mv.glowCell(1, c, GOLD)); txt(S.ways, '4 × ' + free.length);
    cap('那一行用掉了：第 2 列剩 n − 1 種', ''); await wt(tok, 900);
    free.forEach((c) => S.mv.glowCell(1, c, null)); S.mv.glowCell(1, S.pick[1], GREEN); S.used.add(S.pick[1]);
  },
  async (tok, S) => {
    let free = [0, 1, 2, 3].filter((c) => !S.used.has(c)); free.forEach((c) => S.mv.glowCell(2, c, GOLD)); txt(S.ways, '4 × 3 × ' + free.length);
    cap('第 3 列剩 n − 2 種……', '最後一列只剩 1 種'); await wt(tok, 900);
    free.forEach((c) => S.mv.glowCell(2, c, null)); S.mv.glowCell(2, S.pick[2], GREEN); S.used.add(S.pick[2]);
    S.mv.glowCell(3, S.pick[3], GREEN); txt(S.ways, '4 × 3 × 2 × 1 = 24 = ' + perms(4).length);
  },
  async (tok, S) => { cap('寫成一般式', '第 1 列取第 α 行、第 2 列取第 β 行……第 n 列取第 ω 行'); txt(S.f, 'det A = Σ ± a₁α a₂β a₃γ … aₙω'); },
  async (tok, S) => {
    const p = S.pick, sg = sgnP(p);
    cap('(α, β, …, ω) 是 1…n 的一個排列', '這一項：行號 ' + pstr(p) + '，' + (sg > 0 ? '偶' : '奇') + '排列 → ' + (sg > 0 ? '+' : '−'));
    S.tm = hd((sg > 0 ? '+ ' : '− ') + p.map((c, r) => sym(r, c)).join(''), 3.0, 2.6);
  },
  async (tok, S) => { S.mv.unglow(); [0, 1, 2, 3].forEach((k) => S.mv.glowCell(k, k, GREEN)); cap('α = 1、β = 2、γ = 3 …', '恆等排列：對角線那一項，取 +'); txt(S.tm, '+ a₁₁a₂₂a₃₃a₄₄'); },
  async (tok, S) => {
    S.mv.kill(); const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    S.mi = mview(I, -2.6, 3.4, { name: 'A = I', s: 0.9 }); [0, 1, 2, 3].forEach((k) => S.mi.glowCell(k, k, GREEN));
    cap('從公式也能看出 det I = 1', '只有對角那一項不是 0，帶 +'); txt(S.tm, '24 項只剩 1·1·1·1'); ok(bigDet(I) === 1, 'big formula：det I = 1 ✓', 3.0, 1.9);
  },
  async (tok, S) => { cap('理論上能證 det(AB) = det A det B', '可是用這公式要寫到下禮拜'); txt(S.ways, 'det(AB)：用 big formula 證太難'); },
  async (tok, S) => {
    cap('det Aᵀ = det A 比較容易', '轉置後每一項還是「每列每行各取一個」');
    const A = [[2, 1, 0, 3], [1, 0, 2, 1], [0, 3, 1, 1], [1, 1, 0, 2]];
    ok(near(bigDet(A), bigDet(T2(A))), '示意 4×4：det A = det Aᵀ = ' + fmt(bigDet(A)) + ' ✓', 3.0, 1.2);
  },
]);

// L19-4：4×4 的 0/1 例子
const M44 = [[0, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 1]];
scene('dt-l19-4x4', 'L19：4×4 例子，+1 − 1 = 0，R₁ − R₂ + R₃ − R₄ = 0', [
  async (tok, S) => { S.mv = mview(M44, -2.8, 3.4, { name: 'A（老師現場造的）', s: 0.95 }); cap('現場造一個 4×4：放一些 1 和 0', '老師自己也不知道答案'); S.sum = hot('', 2.8, 5.3); },
  async (tok, S) => { cap('4×4 → 24 項', '很多項會碰到 0；說不定整個是 0'); S.n = sm('24 項', 2.8, 4.6); },
  async (tok, S) => { cap('一種做法：消去', '看最後有沒有整列 0'); S.el = sm('也可以：消去 → 有沒有零列？', 2.8, 4.0); },
  async (tok, S) => { remove(S.el); [[0, 3], [1, 2], [2, 1], [3, 0]].forEach(([i, j]) => S.mv.glowCell(i, j, GREEN)); cap('試 big formula：每列每行各拿一個 1', '這條路：a₁₄ a₂₃ a₃₂ a₄₁'); },
  async (tok, S) => { const sg = sgnP([3, 2, 1, 0]); cap('行號 4 3 2 1：換兩次就排好', '→ ' + (sg > 0 ? '+1' : '−1')); txt(S.sum, (sg > 0 ? '+1' : '−1')); },
  async (tok, S) => { S.mv.unglow(); [[0, 2], [1, 1], [2, 0], [3, 3]].forEach(([i, j]) => S.mv.glowCell(i, j, REDG)); cap('還有另一條：a₁₃ a₂₂ a₃₁ a₄₄', '行號 3 2 1 4'); },
  async (tok, S) => { const sg = sgnP([2, 1, 0, 3]); cap('換 1 和 3 一次就排好', '→ ' + (sg > 0 ? '+1' : '−1')); txt(S.sum, '+1 − 1'); },
  async (tok, S) => { S.mv.unglow(); cap('還有別的嗎？', '第 1 列選第 3 行之後，下面每一列都被逼著只剩一個選擇'); S.mv.glowCell(0, 2, GOLD); await wt(tok, 600); S.mv.glowCell(1, 1, GOLD); await wt(tok, 400); S.mv.glowCell(2, 0, GOLD); S.mv.glowCell(3, 3, GOLD); },
  async (tok, S) => {
    S.mv.unglow(); const nz = perms(4).filter((p) => p.every((c, r) => M44[r][c] !== 0)).length;
    cap('24 項：22 項是 0、一項 +1、一項 −1', 'det = 0'); txt(S.n, '24 項裡 ' + (24 - nz) + ' 項是 0'); txt(S.sum, '+1 − 1 = 0');
    S.c = ok(bigDet(M44) === 0 && near(det(M44), 0), 'det A = 0 ✓（消去也得 0）', 2.8, 4.0);
  },
  async (tok, S) => { cap('det = 0 → A 是 singular', '那應該找得到「列的組合 = 0」'); },
  async (tok, S) => { remove(S.c); S.mv.glowRow(0, GOLD); S.mv.glowRow(2, GOLD); const r = M44[0].map((v, j) => v + M44[2][j]); cap('R₁ + R₃ = ' + v2s(r), '加起來是全 1'); S.r13 = hd('R₁ + R₃ = ' + v2s(r), 2.8, 3.6); },
  async (tok, S) => { S.mv.unglow(); S.mv.glowRow(1, GREEN); S.mv.glowRow(3, GREEN); const r = M44[1].map((v, j) => v + M44[3][j]); cap('R₂ + R₄ = ' + v2s(r), '也是全 1'); S.r24 = hd('R₂ + R₄ = ' + v2s(r), 2.8, 3.0); },
  async (tok, S) => { S.mv.unglow(); const z = M44[0].map((v, j) => v - M44[1][j] + M44[2][j] - M44[3][j]); cap('R₁ − R₂ + R₃ − R₄ = 零列', '列向量線性相依 → singular'); ok(z.every((v) => v === 0), 'R₁ − R₂ + R₃ − R₄ = ' + v2s(z) + ' ✓', 2.8, 2.3); },
  async (tok, S) => {
    const x = [1, -1, 1, -1], Ax = M44.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
    cap('同樣可以找 null space 裡的向量', '行的組合 = 0：x = (1, −1, 1, −1)'); ok(Ax.every((v) => v === 0), 'A(1, −1, 1, −1) = ' + v2s(Ax) + ' ✓', 2.8, 1.6);
  },
]);

// L19-5：cofactor 的定義
scene('dt-l19-cofdef', 'L19：Cofactor——Cᵢⱼ = (−1)ⁱ⁺ʲ det Mᵢⱼ，棋盤符號', [
  async (tok, S) => { cap('Cofactor：把 big formula 拆開', 'n×n 的行列式 ↔ 小一號的行列式'); S.mv = mview(symM(3), -3.8, 3.8, { name: 'A', s: 0.95 }); S.ln = pre(hd('', 2.0, 3.6)); S.ln.element.style.textAlign = 'left'; },
  async (tok, S) => { S.mv.glowCell(0, 0, GOLD); cap('3×3 公式依 a₁₁ 分組', 'a₁₁ ×（a₂₂a₃₃ − a₂₃a₃₂）'); S.lines = ['a₁₁(a₂₂a₃₃ − a₂₃a₃₂)']; txt(S.ln, S.lines.join('\n')); },
  async (tok, S) => { S.mv.glowCell(0, 1, GOLD); S.mv.glowCell(0, 2, GOLD); cap('再來是 a₁₂ 的那些、a₁₃ 的那些', '各自乘上「某個東西」'); S.lines.push('+ a₁₂(　…　)', '+ a₁₃(　…　)'); txt(S.ln, S.lines.join('\n')); },
  async (tok, S) => { S.mv.unglow(); S.mv.glowCell(0, 0, GOLD); cap('括號裡那個東西叫 cofactor', 'co = 跟 a₁₁「一起」的因子'); },
  async (tok, S) => {
    S.mv.cells.forEach((r, i) => r.forEach((m, j) => tint(m, i === 0 && j === 0 ? COL.piv : i === 0 || j === 0 ? '#e6dccb' : COL.a)));
    cap('a₁₁ 用掉了第 1 列和第 1 行', '剩下能用的只有右下角'); },
  async (tok, S) => { S.mn = mview(minor(symM(3), 0, 0), 4.2, 0.9, { name: '+ det（剩下的 2×2）', nameCls: 'ptr alt', s: 0.75, color: COL.l }); cap('cofactor 就是這個小矩陣的行列式', 'a₂₂a₃₃ − a₂₃a₃₂'); },
  async (tok, S) => { cap('一般：用掉一列一行，剩 n − 1 列 n − 1 行', '每列每行各取一個 → 正好是小矩陣的 det'); },
  async (tok, S) => {
    S.mn.kill(); S.mv.cells.forEach((r, i) => r.forEach((m, j) => tint(m, i === 0 && j === 1 ? COL.piv : i === 0 || j === 1 ? '#e6dccb' : COL.a)));
    S.mn = mview(minor(symM(3), 0, 1), 4.2, 0.9, { name: 'det（剩下的 2×2）', nameCls: 'ptr alt', s: 0.75, color: COL.l });
    cap('用 a₁₂：剩 a₂₁ a₂₃ a₃₁ a₃₃', 'a₁₂ ×（a₂₁a₃₃ − a₂₃a₃₁）'); S.lines[1] = '+ a₁₂(a₂₁a₃₃ − a₂₃a₃₁)'; txt(S.ln, S.lines.join('\n'));
  },
  async (tok, S) => { cap('符號對嗎？要帶負號', 'a₁₂a₂₁a₃₃ 在公式裡是 −'); S.mv.glowCell(1, 0, REDG); S.mv.glowCell(2, 2, REDG); },
  async (tok, S) => { S.mv.unglow(); txt(S.mn.nameL, '− det（剩下的 2×2）'); cap('把負號放進 cofactor 裡', 'C₁₂ = −(a₂₁a₃₃ − a₂₃a₃₁)'); S.lines[1] = '+ a₁₂·[−(a₂₁a₃₃ − a₂₃a₃₁)]'; txt(S.ln, S.lines.join('\n')); },
  async (tok, S) => {
    S.mn.kill(); S.mv.cells.forEach((r, i) => r.forEach((m, j) => tint(m, i === 0 && j === 2 ? COL.piv : i === 0 || j === 2 ? '#e6dccb' : COL.a)));
    S.mn = mview(minor(symM(3), 0, 2), 4.2, 0.9, { name: '+ det（剩下的 2×2）', nameCls: 'ptr alt', s: 0.75, color: COL.l });
    cap('第三個 a₁₃：取 + det', 'a₁₃(a₂₁a₃₂ − a₂₂a₃₁)'); S.lines[2] = '+ a₁₃(a₂₁a₃₂ − a₂₂a₃₁)'; txt(S.ln, S.lines.join('\n'));
    const A = [[2, 1, 3], [0, 4, 1], [5, 2, 0]], e = [0, 1, 2].map((j) => A[0][j] * cof(A, 0, j)).reduce((a, b) => a + b, 0);
    S.ck = ok(near(e, bigDet(A)), '示意 ' + mstr(A) + '：三組相加 = ' + fmt(e) + ' = big formula ✓', 0.8, 0.2);
  },
  async (tok, S) => {
    S.mn.kill(); remove(S.ck); S.mv.cells.forEach((r) => r.forEach((m) => tint(m, COL.a)));
    cap('Cofactor 的定義：aᵢⱼ 的 cofactor', '= 拿掉第 i 列、第 j 行的 (n−1)×(n−1) 矩陣的 det'); txt(S.ln, 'Cᵢⱼ = ± det Mᵢⱼ\nMᵢⱼ：拿掉第 i 列、第 j 行');
  },
  async (tok, S) => { cap('再乘上 + 或 −', '記作 Cᵢⱼ（大寫 C）'); },
  async (tok, S) => { cap('規則：i + j 偶數取 +、奇數取 −', 'C₁₁、C₁₃ 取 +，C₁₂ 取 −'); txt(S.ln, 'Cᵢⱼ = (−1)ⁱ⁺ʲ det Mᵢⱼ'); },
  async (tok, S) => { S.sg = []; for (let j = 0; j < 5; j++) S.sg.push(cube(j % 2 ? '−' : '+', j % 2 ? '#e9a0a0' : '#9fd8c0', [0.5, 0.5, 0.2], 1.6 + j * 0.6, 2.7, 0)); for (let j = 0; j < 5; j++) S.sg.push(cube((1 + j) % 2 ? '−' : '+', (1 + j) % 2 ? '#e9a0a0' : '#9fd8c0', [0.5, 0.5, 0.2], 1.6 + j * 0.6, 2.1, 0)); cap('第 1 列：+ − + − +', '第 2 列從 − 開始：− + − + −'); },
  async (tok, S) => { for (let i = 2; i < 5; i++) for (let j = 0; j < 5; j++) S.sg.push(cube((i + j) % 2 ? '−' : '+', (i + j) % 2 ? '#e9a0a0' : '#9fd8c0', [0.5, 0.5, 0.2], 1.6 + j * 0.6, 2.7 - i * 0.6, 0)); cap('符號排成棋盤格', '5×5 的樣子'); },
  async (tok, S) => { cap('沒帶符號的叫 minor', '把符號放進去才叫 cofactor'); sm('minor = det Mᵢⱼ　cofactor = ± minor', 2.8, 4.9); },
]);

// L19-6：cofactor formula
scene('dt-l19-cofexp', 'L19：Cofactor formula 與三種公式', [
  async (tok, S) => {
    S.A = [[2, 1, 3], [0, 4, 1], [5, 2, 0]]; S.mv = mview(S.A, -3.8, 4.4, { name: '示意 A', s: 0.85 });
    cap('Cofactor formula：沿第 1 列', 'det A = a₁₁C₁₁ + …'); S.f = hot('det A = a₁₁C₁₁', 2.2, 5.8); S.mv.glowCell(0, 0, GOLD);
    S.ts = []; S.tl = pre(hd('', 2.2, 4.5));
    const c = cof(S.A, 0, 0); S.ts.push(fmt(S.A[0][0]) + '·(' + fmt(c) + ')'); txt(S.tl, S.ts.join(' + '));
  },
  async (tok, S) => {
    txt(S.f, 'det A = a₁₁C₁₁ + a₁₂C₁₂ + … + a₁ₙC₁ₙ'); cap('一直加到這一列的最後一個', '每個元素 × 它的 cofactor');
    for (const j of [1, 2]) { S.mv.glowCell(0, j, GOLD); S.ts.push(fmt(S.A[0][j]) + '·(' + fmt(cof(S.A, 0, j)) + ')'); }
    const sum = [0, 1, 2].reduce((s, j) => s + S.A[0][j] * cof(S.A, 0, j), 0); txt(S.tl, S.ts.join(' + ') + ' = ' + fmt(sum));
    S.k1 = ok(near(sum, bigDet(S.A)), '= big formula ✓', 2.2, 3.9);
  },
  async (tok, S) => {
    S.mv.unglow(); S.mv.glowRow(1, GREEN); remove(S.k1);
    const sum = [0, 1, 2].reduce((s, j) => s + S.A[1][j] * cof(S.A, 1, j), 0);
    cap('沿第 i 列也可以', 'det A = Σⱼ aᵢⱼCᵢⱼ'); txt(S.f, 'det A = aᵢ₁Cᵢ₁ + aᵢ₂Cᵢ₂ + … + aᵢₙCᵢₙ');
    txt(S.tl, '沿第 2 列：' + [0, 1, 2].map((j) => fmt(S.A[1][j]) + '·(' + fmt(cof(S.A, 1, j)) + ')').join(' + ') + ' = ' + fmt(sum)); S.k2 = ok(near(sum, det(S.A)), '一樣 ✓', 2.2, 3.9);
  },
  async (tok, S) => { cap('也可以拿它來「定義」行列式', 'n×n 由 n−1 階組成，一路降到 1×1'); S.ch = sm('n → n−1 → n−2 → … → 1×1', 2.2, 3.2); },
  async (tok, S) => {
    S.mv.kill(); remove(S.tl); remove(S.k2); remove(S.ch);
    S.m2 = mview([['a', 'b'], ['c', 'd']], -3.4, 3.6, { name: '2×2', s: 1 }); S.m2.glowCell(0, 0, GOLD); S.m2.glowCell(1, 1, GREEN);
    cap('最小的例子：2×2', 'a 的 cofactor：蓋掉第 1 列第 1 行 → +d'); txt(S.f, 'det = a·d + …');
  },
  async (tok, S) => { S.m2.unglow(); S.m2.glowCell(0, 1, GOLD); S.m2.glowCell(1, 0, REDG); cap('b 的 cofactor：剩 c，位置 (1,2) 是奇數 → −c', 'ad + b(−c) = ad − bc ✓'); txt(S.f, 'det = a·d + b·(−c) = ad − bc'); },
  async (tok, S) => {
    S.m2.unglow(); cap('三個公式之一：det = pivots 的乘積', '最有效率：消去時就把麻煩都算進去了');
    const names = [['Pivot 公式', '乘 pivots', COL.piv], ['Big formula', 'n! 項', COL.b], ['Cofactor 公式', '介於中間', COL.l]];
    S.bx = names.map(([n, d, c], k) => { const m = cube(n, c, [2.3, 0.8, 0.6], -0.4 + k * 2.7, 1.6, 0); m.visible = k === 0; m.userData.d = sm(d, -0.4 + k * 2.7, 0.8); m.userData.d.element.style.visibility = k === 0 ? '' : 'hidden'; return m; });
  },
  async (tok, S) => { S.bx[1].visible = true; S.bx[1].userData.d.element.style.visibility = ''; cap('Big formula：n! 項', '所有麻煩全部攤開'); },
  async (tok, S) => { S.bx[2].visible = true; S.bx[2].userData.d.element.style.visibility = ''; cap('Cofactor 公式在中間', '簡單的數 × 小一號的行列式'); },
]);

// L19-7：三對角 A₁、A₂、A₃
scene('dt-l19-trism', 'L19：三對角 A₁、A₂、A₃：1、0、−1', [
  async (tok, S) => { cap('例子：三對角、全是 1 的矩陣', '對角線和上下各一條是 1，其餘 0'); S.A4 = mview(tri(4), 3.4, 4.0, { name: 'A₄', s: 0.62, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); },
  async (tok, S) => { cap('目標是所有大小：Aₙ', 'A₁、A₂、A₃、A₄ …'); sm('n×n 都要', 3.4, 2.4); },
  async (tok, S) => { mview(tri(1), -5.0, 4.6, { name: 'A₁', s: 0.62 }); ok(det(tri(1)) === 1, '|A₁| = 1 ✓', -5.0, 3.8); cap('|A₁| = 1', '只有一個 1'); },
  async (tok, S) => { mview(tri(2), -3.3, 4.6, { name: 'A₂', s: 0.62 }); ok(det(tri(2)) === 0, '|A₂| = 1 − 1 = 0 ✓', -3.3, 3.5); cap('|A₂| = 0', '1·1 − 1·1'); },
  async (tok, S) => { S.A3 = mview(tri(3), -0.6, 4.4, { name: 'A₃', s: 0.75, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('|A₃| 就沒那麼明顯', '3×3：6 項'); },
  async (tok, S) => {
    cap('用 big formula：對角 +1', '兩個「斜的」各 −1：1 − 1 − 1 = −1');
    for (const [pat, c] of [[[0, 1, 2], GREEN], [[1, 0, 2], REDG], [[0, 2, 1], REDG]]) { S.A3.unglow(); pat.forEach((cc, r) => S.A3.glowCell(r, cc, c)); await wt(tok, 650); }
    S.A3.unglow(); S.k3 = ok(bigDet(tri(3)) === -1, '|A₃| = −1 ✓', -0.6, 2.9);
  },
  async (tok, S) => { remove(S.k3); cap('另一種：R₂ − R₃', '一列減另一列，det 不變'); await rowOp(tok, S.A3, 1, 2, 1, 1500); },
  async (tok, S) => { S.A3.glowRow(1, GOLD); cap('第 2 列變成 (1, 0, 0)', '沿這一列用 cofactor：只剩那一個 1'); },
  async (tok, S) => {
    S.A3.unglow(); S.A3.glowCell(1, 0, GOLD); [[0, 1], [0, 2], [2, 1], [2, 2]].forEach(([i, j]) => S.A3.glowCell(i, j, GREEN));
    const m = minor(S.A3.v, 1, 0); cap('它的 2×2：' + mstr(m), 'det = ' + fmt(det(m)));
  },
  async (tok, S) => { const c = cof(S.A3.v, 1, 0); cap('位置 (2,1)：2 + 1 奇數 → 負號', '1 × (' + fmt(c) + ') = ' + fmt(c)); ok(near(c, det(tri(3))), '|A₃| = 1·C₂₁ = ' + fmt(c) + ' ✓', -0.6, 2.6); },
]);

// L19-8：|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|
scene('dt-l19-trirec', 'L19：|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|，週期 6', [
  async (tok, S) => { S.A4 = mview(tri(4), -3.8, 4.2, { name: 'A₄', s: 0.75, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') }); cap('A₄ 的行列式？', '用 cofactors'); },
  async (tok, S) => {
    S.A4.glowCell(0, 0, GOLD); for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) S.A4.glowCell(i, j, GREEN);
    cap('沿第 1 列：a₁₁ = 1 乘右下的 3×3', '那個 3×3 正是 A₃ → +1·|A₃|'); S.f = hot('|A₄| = 1·|A₃|', 2.6, 5.6);
  },
  async (tok, S) => { S.A4.unglow(); S.A4.glowCell(0, 1, GOLD); cap('下一個 1 在 (1,2)', '1 + 2 奇數 → 帶負號'); for (const [i, j] of [[1, 0], [1, 2], [1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [3, 3]]) S.A4.glowCell(i, j, '#3a2a00'); },
  async (tok, S) => { S.m3 = mview(minor(tri(4), 0, 1), 2.6, 3.4, { name: '剩下的 3×3', s: 0.65, color: COL.l }); S.m3.glowCol(0, GOLD); cap('剩下的 3×3 再用 cofactor', '這次沿第 1 行（det Aᵀ = det A，行也可以）'); },
  async (tok, S) => {
    S.m3.unglow(); S.m3.glowCell(0, 0, GOLD); for (let i = 1; i < 3; i++) for (let j = 1; j < 3; j++) S.m3.glowCell(i, j, GREEN);
    const c = minor(minor(tri(4), 0, 1), 0, 0); cap('左上的 1 × 右下 2×2', '那個 2×2 = A₂ → −1·|A₂|'); txt(S.f, '|A₄| = |A₃| − |A₂|');
    S.ck = ok(JSON.stringify(c) === JSON.stringify(tri(2)), '右下 2×2 = A₂ ✓', 2.6, 1.6);
  },
  async (tok, S) => { remove(S.ck); S.m3.kill(); S.A4.unglow(); cap('對所有 n 都成立', '|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|'); txt(S.f, '|Aₙ| = |Aₙ₋₁| − |Aₙ₋₂|'); },
  async (tok, S) => { cap('其他位置為什麼不用算？', '它們乘的是 0'); S.A4.glowCell(0, 2, REDG); S.A4.glowCell(0, 3, REDG); },
  ...[4, 5, 6, 7].map((n) => async (tok, S) => {
    if (!S.seq) { S.A4.unglow(); S.seq = [1, 0]; S.bars = hd('', 2.2, 4.4); S.dn = []; }
    while (S.seq.length < n) S.seq.push(S.seq[S.seq.length - 1] - S.seq[S.seq.length - 2]);
    const v = S.seq[n - 1];
    cap('|A' + sub(n) + '| = |A' + sub(n - 1) + '| − |A' + sub(n - 2) + '|', '= ' + fmt(S.seq[n - 2]) + ' − ' + fmt(S.seq[n - 3]) + ' = ' + fmt(v));
    txt(S.bars, S.seq.map(fmt).join(', ')); ok(near(det(tri(n)), v), '|A' + sub(n) + '| = ' + fmt(v) + ' ✓（直接算 det）', 2.2, 4.0 - (n - 4) * 0.55);
  }),
  async (tok, S) => {
    while (S.seq.length < 12) S.seq.push(S.seq[S.seq.length - 1] - S.seq[S.seq.length - 2]);
    cap('1, 0, −1, −1, 0, 1 之後開始重複', '週期 6');
    for (let n = 1; n <= 12; n++) { const v = S.seq[n - 1], x = -5.2 + (n - 1) * 0.45, h = Math.max(0.05, Math.abs(v) * 0.9); const m = lab.box(v > 0 ? COL.c : v < 0 ? COL.red : '#c9b48e', [0.38, h, 0.38]); m.position.set(x, 1.3 + (v >= 0 ? h / 2 : -h / 2), 0); lab.world.add(m); sm(String(n), x, 0.15); }
  },
  async (tok, S) => {
    let a = 1, b = 0; for (let n = 3; n <= 61; n++) { const c = b - a; a = b; b = c; }
    cap('|A₆₁| = |A₁| = 1', '61 = 6·10 + 1'); ok(b === 1 && det(tri(8)) === det(tri(2)), '遞迴算到 n = 61：|A₆₁| = ' + b + ' ✓', 2.2, 1.5);
  },
]);

// ═════════════════════════ 3Blue1Brown：The determinant（Ip3X9LOh2dk） ═════════════════════════
const CAM2 = [[0, 3.3, 11.5], [0, 3.1, 0]];
function showM(S, M, name, x = -4.3, y = 4.7) { if (S.mx) S.mx.kill(); S.mx = mview(M, x, y, { s: 0.6, name: name || '' }); return S.mx; }
function detTag(S, d, x = -4.3, y = 3.2) { const t = 'det = ' + fmt(Math.round(d * 1000) / 1000); if (!S.dt) S.dt = hot(t, x, y); else txt(S.dt, t); return S.dt; }
function chk(S, cond, t, x = -4.3, y = 2.5) { if (S.ck) remove(S.ck); S.ck = ok(cond, t, x, y); return S.ck; }
// small grid cells (a blob) that ride along with the transformation
function cells(bd, list, h, color) { return list.map((o) => { const m = pgram(color); m.userData.o = o; m.userData.h = h; setPgAt(m, bd, o, [h, 0], [0, h], 0.04); return m; }); }
function moveCells(bd, cs, M) { for (const m of cs) { const o = m.userData.o, h = m.userData.h; setPgAt(m, bd, mul2(M, o), mul2(M, [h, 0]), mul2(M, [0, h]), 0.04); } }
const MG = [[1.5, 0.5], [0, 1]];   // 示意：一般的變換
scene('dt-3b-area', '3B1B：det = 面積被放大的倍數', [
  async (tok, S) => { cap('有些變換把空間拉開、有些把它擠扁', '（示意）'); S.sy = note('示意', 3.2, 5.6); await S.L.to(tok, [[1.6, 0.3], [0.2, 1.4]], 1100); await S.L.to(tok, [[0.6, 0.2], [-0.2, 0.5]], 1100); },
  async (tok, S) => { await S.L.to(tok, [[1, 0], [0, 1]], 600); remove(S.sy); cap('要量的是：面積被放大或縮小幾倍', '先看那個 1×1 的單位正方形'); S.a1 = hd('面積 1', 3.4, 4.0); },
  async (tok, S) => { cap('例：矩陣的兩行是 (3, 0) 和 (0, 2)', 'î 拉長 3 倍、ĵ 拉長 2 倍'); showM(S, [[3, 0], [0, 2]], 'A'); },
  async (tok, S) => { glow(S.L.sq, '#5a4a00'); cap('盯著那個 1×1 正方形', '底邊在 î、左邊在 ĵ'); },
  async (tok, S) => { glow(S.L.sq, null); cap('變換之後：變成 3×2 的長方形', ''); await S.L.to(tok, [[3, 0], [0, 2]], 1600); },
  async (tok, S) => { const d = det2(S.L.M); txt(S.a1, '面積 1 → ' + fmt(3 * 2)); cap('面積從 1 變成 6', '這個變換把面積放大 6 倍'); detTag(S, d); chk(S, near(d, 6), '3 × 2 = 6 ✓'); },
  async (tok, S) => { await S.L.to(tok, [[1, 0], [0, 1]], 500); showM(S, [[1, 1], [0, 1]], 'shear'); txt(S.a1, '面積 1'); cap('對照：shear', 'î 不動，ĵ 移到 (1, 1)'); await S.L.to(tok, [[1, 1], [0, 1]], 1500); },
  async (tok, S) => { const d = det2(S.L.M); cap('正方形歪成平行四邊形', '底 1、高 1 → 面積還是 1'); txt(S.a1, '面積 1 → 1'); detTag(S, d); chk(S, near(d, 1), '底 1 × 高 1 = 1 ✓'); },
  async (tok, S) => {
    await S.L.to(tok, [[1, 0], [0, 1]], 500); showM(S, MG, '示意'); txt(S.a1, '');
    cap('一個格子怎麼變，每個格子都一樣', '格線變換後還是平行、等距');
    S.cs = cells(S.L.bd, [[1, 1], [-2, 0], [0, -2], [-1, 2]], 1, '#9b7ef4');
    await S.L.to(tok, MG, 1600, () => moveCells(S.L.bd, S.cs, S.L.M));
    detTag(S, det2(MG)); chk(S, near(det2(MG), 1.5), '每格都 × ' + fmt(det2(MG)) + ' ✓');
  },
  async (tok, S) => {
    S.cs.forEach(kill); await S.L.to(tok, [[1, 0], [0, 1]], 500); remove(S.ck); S.ck = null;
    cap('任何形狀都能用很小的格子拼出來', '格子越小越準（示意：一個圓）');
    const h = 0.25, list = []; for (let x = -2.75; x < 0.6; x += h) for (let y = -0.75; y < 2.6; y += h) if (Math.hypot(x + h / 2 + 1.1, y + h / 2 - 0.9) < 1.5) list.push([x, y]);
    S.blob = cells(S.L.bd, list, h, '#e55a9b'); S.n = list.length; S.a0 = S.n * h * h;
    txt(S.a1, S.n + ' 小格 ≈ 面積 ' + S.a0.toFixed(2));
  },
  async (tok, S) => {
    cap('每個小格都被放大同一個倍數', '所以整塊的面積也放大同一個倍數');
    await S.L.to(tok, MG, 1800, () => moveCells(S.L.bd, S.blob, S.L.M));
    const h = 0.25, cellA = Math.abs(det2(cols2(mul2(MG, [h, 0]), mul2(MG, [0, h])))), a1 = S.n * cellA;
    txt(S.a1, '面積 ' + S.a0.toFixed(2) + ' → ' + a1.toFixed(2)); chk(S, near(a1 / S.a0, det2(MG)), '比值 = ' + fmt(det2(MG)) + ' = det ✓');
  },
  async (tok, S) => { cap('這個特別的倍數就叫 determinant', '線性變換把任何面積放大的倍數'); hot('determinant = 面積縮放倍數', 0, 6.1); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(0, 3.2, 0.55, 4); } });

scene('dt-3b-values', '3B1B：det = 3、½、0 是什麼意思', [
  async (tok, S) => { showM(S, [[3, 0], [0, 1]], '示意'); cap('det = 3：面積放大 3 倍', ''); await S.L.to(tok, [[3, 0], [0, 1]], 1400); detTag(S, det2(S.L.M)); chk(S, near(det2(S.L.M), 3), '面積 1 → 3 ✓'); },
  async (tok, S) => { showM(S, [[0.5, 0], [0, 1]], '示意'); cap('det = ½：所有面積縮成一半', ''); await S.L.to(tok, [[0.5, 0], [0, 1]], 1400); detTag(S, det2(S.L.M)); chk(S, near(det2(S.L.M), 0.5), '面積 1 → ½ ✓'); },
  async (tok, S) => { const M = [[2, 1], [1, 0.5]]; showM(S, M, '示意'); cap('det = 0：整個平面被壓到一條線上', '兩行共線'); await S.L.to(tok, M, 1600); detTag(S, det2(S.L.M)); chk(S, near(det2(M), 0), '2·½ − 1·1 = 0 ✓'); },
  async (tok, S) => { showM(S, [[0, 0], [0, 0]], '示意'); cap('甚至壓到一個點', '任何區域的面積都變成 0'); await S.L.to(tok, [[0, 0], [0, 0]], 1400); detTag(S, 0); chk(S, near(det2([[0, 0], [0, 0]]), 0), '整個平面壓成一點：面積 0 ✓'); },
  async (tok, S) => { cap('檢查 det 是不是 0', '就知道這個變換有沒有把空間壓到更低的維度'); hot('det = 0 ⇔ 壓扁（降維）', 0, 6.1); if (S.mx) S.mx.kill(); S.mx = null; remove(S.ck); S.ck = null; remove(S.dt); S.dt = null; await S.L.to(tok, [[1, 0], [0, 1]], 1200); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(0, 3.2, 0.55, 4); } });

// a sheet of paper: yellow front, red back — turns over to show "orientation flipped"
function paper(x, y) { const g = new THREE.Group(); g.position.set(x, y, 0); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ color: YEL, side: THREE.FrontSide })); const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ color: JH, side: THREE.BackSide })); g.add(f, b); lab.world.add(g); return g; }
scene('dt-3b-neg', '3B1B：負的 det = 空間翻面（orientation）', [
  async (tok, S) => { cap('其實 det 可以是負的', '面積放大「負的倍數」是什麼意思？'); },
  async (tok, S) => {
    cap('跟「方向」（orientation）有關', '像把一張紙翻到背面'); S.pp = paper(-4.3, 1.6); S.ppl = sm('一張紙（示意）', -4.3, 0.6);
    await anim(tok, 1800, (u) => { S.pp.rotation.y = Math.PI * u; S.L.set(lerpM([[1, 0], [0, 1]], [[-1, 0], [0, 1]], u)); });
  },
  async (tok, S) => { cap('這種變換叫做「反轉空間的方向」', 'invert the orientation'); S.o = hd('orientation 反轉', 3.4, 5.6); },
  async (tok, S) => { kill(S.pp); remove(S.ppl); await S.L.to(tok, [[1, 0], [0, 1]], 800); txt(S.o, '一開始：ĵ 在 î 的左邊'); cap('另一個看法：看 î 和 ĵ', '一開始 ĵ 在 î 的左邊（逆時針那一側）'); },
  async (tok, S) => { cap('變換後 ĵ 跑到 î 的右邊', '→ 方向被翻過來了'); await S.L.to(tok, [[1, 2], [1, -1]], 1700); txt(S.o, '變換後：ĵ 在 î 的右邊'); },
  async (tok, S) => { cap('只要方向翻轉，det 就是負的', '正方形變成紅色'); detTag(S, det2(S.L.M)); },
  async (tok, S) => { cap('|det| 還是面積放大的倍數', '負號只負責說「翻面了」'); },
  async (tok, S) => { const M = [[1, 2], [1, -1]]; showM(S, M, 'A'); cap('例：兩行是 (1, 1) 和 (2, −1)', 'det = 1·(−1) − 2·1 = −3'); chk(S, near(det2(M), -3), '1·(−1) − 2·1 = −3 ✓'); },
  async (tok, S) => { cap('意思是：空間翻面，面積放大 3 倍', '|−3| = 3'); txt(S.o, '翻面 ＋ 面積 × 3'); },
  async (tok, S) => {
    if (S.mx) S.mx.kill(); S.mx = null; remove(S.ck); S.ck = null; await S.L.to(tok, [[1, 0], [0, 1]], 700);
    cap('為什麼用「負的」描述翻面？', '讓 î 慢慢靠近 ĵ：面積越擠越小');
    await anim(tok, 1800, (u) => { const th = u * Math.PI * 0.4; const d = S.L.set([[Math.cos(th), 0], [Math.sin(th), 1]]); detTag(S, d); });
    txt(S.o, 'det 越來越接近 0');
  },
  async (tok, S) => { cap('î 和 ĵ 完全對齊', 'det = 0'); await anim(tok, 900, (u) => { const th = (0.4 + 0.1 * u) * Math.PI; const d = S.L.set([[Math.cos(th), 0], [Math.sin(th), 1]]); detTag(S, d); }); chk(S, near(det2([[0, 0], [1, 1]]), 0), '共線 → det = 0 ✓'); },
  async (tok, S) => { remove(S.ck); S.ck = null; cap('î 繼續往前走', 'det 自然地繼續變小，變成負數'); await anim(tok, 1500, (u) => { const th = (0.5 + 0.25 * u) * Math.PI; const d = S.L.set([[Math.cos(th), 0], [Math.sin(th), 1]]); detTag(S, d); }); txt(S.o, '越過去 → det < 0（翻面）'); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(0, 3.2, 0.62, 3); } });

const MW = [[1, 0, 0.5], [0.5, 1, 0], [0, 0.5, 1]];   // 示意：三個行向量（每個是一行）
scene('dt-3b-vol', '3B1B：3D 的 det = 體積放大倍數（平行六面體）', [
  async (tok, S) => { S.L = lin3([0, 1.0, 0], 1.1, 2.4); S.L.pp.visible = false; cap('那 3D 呢？', 'î、ĵ、k̂ 三個基底向量'); S.lb = [sm('î', ...S.L.sp.P(1.25, 0, 0).toArray()), sm('ĵ', ...S.L.sp.P(0, 1.25, 0).toArray()), sm('k̂', ...S.L.sp.P(0, 0, 1.25).toArray())]; },
  async (tok, S) => { cap('det 一樣是放大倍數', '這次量的是「體積」'); },
  async (tok, S) => { S.L.pp.visible = true; cap('看 1×1×1 的單位立方體', '三條邊靠在 î、ĵ、k̂ 上'); S.v = hot('體積 1', -3.2, 5.4); },
  async (tok, S) => { S.lb.forEach(remove); cap('變換後：立方體被扭成斜斜的形狀', '（示意）'); await S.L.to(tok, MW, 1800); S.n = note('示意', -3.2, 4.8); },
  async (tok, S) => { cap('這形狀叫 parallelepiped', '平行六面體'); txt(S.v, 'parallelepiped'); },
  async (tok, S) => { const d = S.L.set(S.L.C), dm = det(cols3(...S.L.C)); cap('原本體積 1，所以 det = 它的體積', ''); txt(S.v, '體積 = det = ' + fmt(dm)); S.ck = ok(near(d, dm), 'det ' + mstr(cols3(...S.L.C)) + ' = ' + fmt(dm) + ' ✓', -3.2, 4.2); },
  async (tok, S) => {
    remove(S.ck); const c1 = S.L.C[0], c2 = S.L.C[1], tgt = c1.map((v, i) => v + c2[i]);
    cap('det = 0：整個空間被壓成沒有體積的東西', '一個平面、一條線，甚至一個點'); await S.L.to(tok, [c1, c2, tgt], 1800);
    const d = det(cols3(c1, c2, tgt)); txt(S.v, '體積 = ' + fmt(d)); S.ck = ok(near(d, 0), '壓成平面：det = 0 ✓', -3.2, 4.2);
  },
  async (tok, S) => { cap('這代表矩陣的行向量線性相依', '這裡：第 3 行 = 第 1 行 + 第 2 行'); txt(S.ck, 'col₃ = col₁ + col₂ → 線性相依'); },
  async (tok, S) => {
    remove(S.ck); remove(S.n); await S.L.to(tok, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 900); txt(S.v, '右手定則');
    cap('負的 det：用右手定則', '食指指 î、中指指 ĵ，拇指就是 k̂');
    S.h = [sm('食指 î', ...S.L.sp.P(1.4, 0, 0).toArray()), sm('中指 ĵ', ...S.L.sp.P(0, 1.4, 0).toArray()), sm('拇指 k̂', ...S.L.sp.P(0, 0, 1.4).toArray())];
  },
  async (tok, S) => { S.h.forEach(remove); cap('變換後還能用右手比出來', '方向沒變 → det > 0'); await S.L.to(tok, MW, 1500); const d = det(cols3(...MW)); txt(S.v, 'det = ' + fmt(d) + ' > 0'); S.ck = ok(d > 0, '右手系 ✓', -3.2, 4.2); },
  async (tok, S) => {
    remove(S.ck); const C = [MW[0], MW[1], [0, 0.5, -1]];
    cap('只能用左手比 → 方向翻了', 'det < 0（變紅色）'); await S.L.to(tok, C, 1800);
    const d = det(cols3(...C)); txt(S.v, 'det = ' + fmt(d) + ' < 0'); S.ck = ok(d < 0, '左手系：det < 0 ✓', -3.2, 4.2);
  },
], { cam: [[6.2, 5.4, 10], [0, 2.3, 0]] });

scene('dt-3b-formula', '3B1B：ad − bc 從哪裡來', [
  async (tok, S) => { cap('怎麼算？2×2 的公式', 'det [a b; c d] = ad − bc'); hot('det [a b; c d] = a·d − b·c', -3.6, 6.1); },
  async (tok, S) => { cap('先假設 b、c 都是 0', '（示意：a = 3、d = 2）'); showM(S, [[3, 0], [0, 2]], '示意'); await S.L.to(tok, [[3, 0], [0, 2]], 1400); },
  async (tok, S) => { cap('a 告訴你 î 在 x 方向拉長幾倍', 'a = 3'); S.L.ai.userData.mat.emissive = new THREE.Color('#2a5a00'); S.ta = sm('a = 3', ...S.L.bd.P(1.5, -0.5).toArray()); },
  async (tok, S) => { S.L.ai.userData.mat.emissive = new THREE.Color('#000000'); S.L.aj.userData.mat.emissive = new THREE.Color('#5a0000'); cap('d 告訴你 ĵ 在 y 方向拉長幾倍', 'd = 2'); S.td = sm('d = 2', ...S.L.bd.P(-0.6, 1).toArray()); },
  async (tok, S) => { S.L.aj.userData.mat.emissive = new THREE.Color('#000000'); const d = det2(S.L.M); cap('a·d 就是長方形的面積', '就像前面的 [3 0; 0 2]'); detTag(S, d); chk(S, near(d, 3 * 2), 'a·d = 3·2 = 6 ✓'); },
  async (tok, S) => { remove(S.ta); remove(S.td); const M = [[3, 1], [0, 2]]; showM(S, M, '示意 b = 1'); cap('只有 b 或 c 其中一個是 0', '平行四邊形：底 a、高 d → 面積還是 ad'); await S.L.to(tok, M, 1400); detTag(S, det2(M)); chk(S, near(det2(M), 6), '3·2 − 1·0 = 6 ✓'); },
  async (tok, S) => { const M = [[3, 1], [1, 2]]; showM(S, M, '示意 b = c = 1'); cap('b、c 都不是 0：', 'b·c 大概說明它在對角線方向被拉或擠了多少'); await S.L.to(tok, M, 1400); detTag(S, det2(M)); chk(S, near(det2(M), 5), '3·2 − 1·1 = 5 ✓'); },
  async (tok, S) => {
    const [a, b] = S.L.M[0], [c, d] = S.L.M[1];
    cap('想更精確：看這張圖', '大長方形 (a+b)(c+d) 減掉周圍的三角形和小長方形');
    const bd = S.L.bd, cs = [[0, 0], [a + b, 0], [a + b, c + d], [0, c + d], [0, 0]];
    S.box = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cs.map((p) => bd.P(...p).setZ(0.06))), new THREE.LineBasicMaterial({ color: '#6a4a00' })); lab.world.add(S.box);
    const big = (a + b) * (c + d), rest = big - 2 * (a * c / 2) - 2 * (b * d / 2) - 2 * (b * c);
    pre(sm('(a+b)(c+d) = ' + fmt(big) + '\n− 2·½ac − 2·½bd − 2bc\n= ' + fmt(rest), 4.7, 2.0)); chk(S, near(rest, a * d - b * c), '= ad − bc = ' + fmt(a * d - b * c) + ' ✓', 4.7, 0.9);
  },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(0, 3.2, 0.55, 4); } });

scene('dt-3b-prod', '3B1B：det(AB) = det A · det B（一句話的理由）', [
  async (tok, S) => {
    S.B = [[1, 1], [-1, 1]]; S.A = [[1.5, 0], [0, 1]];
    showM(S, S.B, '示意 B'); S.mA = mview(S.A, -4.3, 2.3, { s: 0.6, name: '示意 A' });
    cap('把兩個矩陣相乘', '先做 B：面積 × det B'); await S.L.to(tok, S.B, 1600); S.t = hot('面積 1 → ' + fmt(det2(S.B)), 3.6, 5.6);
  },
  async (tok, S) => {
    cap('再做 A：再 × det A', '乘積 AB 的 det = det A · det B'); const AB = matMul(S.A, S.B); await S.L.to(tok, AB, 1600);
    txt(S.t, '面積 → ' + fmt(det2(S.B)) + ' × ' + fmt(det2(S.A)) + ' = ' + fmt(det2(AB))); S.ck = ok(near(det2(AB), det2(S.A) * det2(S.B)), 'det(AB) = ' + fmt(det2(AB)) + ' = det A · det B ✓', 3.6, 5.0);
  },
  async (tok, S) => { cap('一句話：先放大 det B 倍，再放大 det A 倍', '用數字硬證要很久，用「面積倍率」一句就懂'); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(0, 3.2, 0.55, 4); } });

// ═════════════════════════ 3Blue1Brown：Cross products（eu6i7WJeinw） ═════════════════════════
const CV = '#4b9ee2', CW = '#e08a2e';
// two board vectors v, w with labels, a parallelogram, live signed area
function vw2(bd, v, w) {
  const O = bd.P(0, 0).setZ(0.1), R = { v: v.slice(), w: w.slice(), pg: pgram(YEL), av: arw(CV), aw: arw(CW), lv: sm('v', 0, 0), lw: sm('w', 0, 0) };
  R.pg.visible = false;
  R.set = (v2, w2) => { R.v = v2.slice(); R.w = w2.slice(); setArrow(R.av, O, bd.P(...v2).setZ(0.1)); setArrow(R.aw, O, bd.P(...w2).setZ(0.1)); const pv = bd.P(...v2), pw = bd.P(...w2); R.lv.position.set(pv.x + 0.25, pv.y + 0.2, 0.2); R.lw.position.set(pw.x + 0.25, pw.y + 0.2, 0.2); setPg(R.pg, bd, v2, w2, 0.03, false); const d = det2(cols2(v2, w2)); R.pg.material.color.set(d < -1e-9 ? JH : YEL); return d; };
  R.to = (tok, v2, w2, ms = 1400, each) => { const v0 = R.v.slice(), w0 = R.w.slice(); return anim(tok, ms, (u) => { const d = R.set(v0.map((x, i) => x + (v2[i] - x) * u), w0.map((x, i) => x + (w2[i] - x) * u)); if (each) each(d); }); };
  R.set(v, w); return R;
}
const crossTag = (S, d) => { const t = 'v × w = ' + fmt(Math.round(d * 100) / 100); if (!S.ct) S.ct = hot(t, -4.6, 4.6); else txt(S.ct, t); };
scene('dt-cx-2d', '3B1B：2D 的「外積」= 平行四邊形的有號面積', [
  async (tok, S) => { S.bd = board(0, 3.2, 0.6, 4); S.R = vw2(S.bd, [3, 1], [1, 2]); cap('先從 2D 開始：兩個向量 v、w', '（示意）'); S.n = note('示意', -4.6, 5.6); },
  async (tok, S) => {
    cap('它們張出一個平行四邊形', 'v 的複本：尾巴移到 w 的尖端'); const O = S.bd.P(0, 0).setZ(0.1);
    S.cv = arw(CV, 0.04); await anim(tok, 1300, (u) => { const s = S.R.w.map((x) => x * u); setArrow(S.cv, S.bd.P(...s).setZ(0.1), S.bd.P(s[0] + S.R.v[0], s[1] + S.R.v[1]).setZ(0.1)); });
  },
  async (tok, S) => { cap('w 的複本：尾巴移到 v 的尖端', '四個向量圍出平行四邊形'); S.cw = arw(CW, 0.04); await anim(tok, 1300, (u) => { const s = S.R.v.map((x) => x * u); setArrow(S.cw, S.bd.P(...s).setZ(0.1), S.bd.P(s[0] + S.R.w[0], s[1] + S.R.w[1]).setZ(0.1)); }); },
  async (tok, S) => { kill(S.cv); kill(S.cw); S.R.pg.visible = true; cap('v × w（叉叉符號）= 這個平行四邊形的面積', ''); },
  async (tok, S) => { cap('嗯，差不多——還要考慮方向（orientation）', ''); },
  async (tok, S) => { const d = det2(cols2(S.R.v, S.R.w)); cap('v 在 w 的右邊 → v × w 是正的', '等於面積'); crossTag(S, d); S.ck = ok(near(d, 5), '3·2 − 1·1 = +5 ✓', -4.6, 4.0); },
  async (tok, S) => { remove(S.ck); cap('v 在 w 的左邊 → 外積是負的', '負的面積（變紅色）'); await S.R.to(tok, [-2, 1], [1, 2], 1800, (d) => crossTag(S, d)); S.ck = ok(near(det2(cols2([-2, 1], [1, 2])), -5), '(−2)·2 − 1·1 = −5 ✓', -4.6, 4.0); },
  async (tok, S) => { remove(S.ck); const d1 = det2(cols2(S.R.v, S.R.w)), d2 = det2(cols2(S.R.w, S.R.v)); cap('順序有差：w × v = −(v × w)', ''); S.ck = ok(near(d2, -d1), 'w × v = ' + fmt(d2) + ' = −(' + fmt(d1) + ') ✓', -4.6, 4.0); },
  async (tok, S) => { remove(S.ck); cap('記法：î × ĵ 要是正的', 'î 在 ĵ 的右邊 → 「v 在 w 右邊」就是正'); await S.R.to(tok, [1, 0], [0, 1], 1500, (d) => crossTag(S, d)); txt(S.R.lv, 'î'); txt(S.R.lw, 'ĵ'); S.ck = ok(near(det2([[1, 0], [0, 1]]), 1), 'î × ĵ = +1 ✓', -4.6, 4.0); },
  async (tok, S) => {
    remove(S.ck); txt(S.R.lv, 'v'); txt(S.R.lw, 'w'); cap('例：這個平行四邊形面積是 7', 'v 在 w 的左邊 → v × w = −7');
    await S.R.to(tok, [-2, 1], [1, 3], 1500, (d) => crossTag(S, d)); S.ck = ok(near(det2(cols2([-2, 1], [1, 3])), -7), '示意 v = (−2, 1)、w = (1, 3)：−7 ✓', -4.6, 4.0);
  },
], { cam: CAM2 });

scene('dt-cx-det2', '3B1B：2D 外積 = det[v w]', [
  async (tok, S) => { cap('不用別人告訴你面積，怎麼算？', '行列式登場'); },
  async (tok, S) => { cap('v 的座標放第 1 行、w 放第 2 行', '然後算 det'); S.m = mview([['v₁', 'w₁'], ['v₂', 'w₂']], -4.2, 4.8, { s: 0.6, name: 'v × w = det' }); },
  async (tok, S) => {
    S.v = [-3, 1]; S.w = [2, 1]; S.L = lin2(0.6, 3.2, 0.55, 4);
    cap('這個矩陣代表一個線性變換', '把 î、ĵ 送到 v、w'); S.gv = [arw(CV, 0.035), arw(CW, 0.035)]; const O = S.L.bd.P(0, 0).setZ(0.05); setArrow(S.gv[0], O, S.L.bd.P(...S.v).setZ(0.05)); setArrow(S.gv[1], O, S.L.bd.P(...S.w).setZ(0.05));
    S.lv = sm('v', ...S.L.bd.P(-3.3, 1.3).toArray()); S.lw = sm('w', ...S.L.bd.P(2.3, 1.3).toArray());
  },
  async (tok, S) => { glow(S.L.sq, '#5a4a00'); cap('det 量的是面積怎麼變', '標準的那塊：靠在 î、ĵ 上的單位正方形'); },
  async (tok, S) => { glow(S.L.sq, null); cap('變換後，正方形變成我們要的平行四邊形', ''); await S.L.to(tok, cols2(S.v, S.w), 1800); },
  async (tok, S) => { cap('它是從面積 1 變來的', '所以 det = 這個平行四邊形的面積'); },
  async (tok, S) => { cap('v 在 w 的左邊 → 變換時方向翻了', '→ det 是負的（紅色）'); },
  async (tok, S) => { S.m.kill(); S.m = mview(cols2(S.v, S.w), -4.2, 4.8, { s: 0.6, name: '[v w]' }); cap('例：v = (−3, 1)、w = (2, 1)', ''); },
  async (tok, S) => { const d = det2(cols2(S.v, S.w)); cap('det = (−3)·1 − 2·1 = −5', ''); S.ck = ok(near(d, -5), 'v × w = (−3)·1 − 2·1 = −5 ✓', -4.2, 3.3); },
  async (tok, S) => { cap('面積是 5', 'v 在 w 的左邊，所以是負的'); S.a = hot('面積 5，帶負號', -4.2, 2.7); },
  async (tok, S) => {
    remove(S.ck); remove(S.a); S.m.kill(); remove(S.lv); remove(S.lw); S.gv.forEach(kill);
    cap('垂直的時候外積比較大', '方向越接近，平行四邊形越扁（示意：長度都是 2）'); S.n = note('示意', -4.2, 5.6);
    await anim(tok, 2200, (u) => { const th = Math.PI / 2 - u * Math.PI * 0.42; const d = S.L.set(cols2([2, 0], [2 * Math.cos(th), 2 * Math.sin(th)])); if (!S.ct) S.ct = hot('', -4.2, 4.6); txt(S.ct, 'v × w = ' + fmt(Math.round(d * 100) / 100)); });
  },
  async (tok, S) => {
    cap('把 v 放大 3 倍', '面積也放大 3 倍'); await S.L.to(tok, cols2([1, 0], [0.5, 1.5]), 800); const d0 = det2(S.L.M); txt(S.ct, 'v × w = ' + fmt(d0));
    await S.L.to(tok, cols2([3, 0], [0.5, 1.5]), 1400); S.d0 = d0;
  },
  async (tok, S) => { const d1 = det2(S.L.M); cap('(3v) × w = 3 (v × w)', ''); txt(S.ct, '(3v) × w = ' + fmt(d1)); S.ck = ok(near(d1, 3 * S.d0), fmt(d1) + ' = 3 × ' + fmt(S.d0) + ' ✓', -4.2, 4.0); },
], { cam: CAM2 });

// 3-D cross product
const CAM3 = [[6.5, 5.4, 9.5], [0, 2.2, 0]];
scene('dt-cx-3d', '3B1B：真正的外積是一個 3D 向量', [
  async (tok, S) => {
    S.sp = space([0, 1.2, 0], 1.0, 2.6); S.O = S.sp.P(0, 0, 0); S.v = [2, 0, 0]; S.w = [0.5, 1.25, 0];
    S.av = arw(CV); S.aw = arw(CW); setArrow(S.av, S.O, S.sp.P(...S.v)); setArrow(S.aw, S.O, S.sp.P(...S.w));
    S.lv = sm('v', ...S.sp.P(2.2, 0, 0.2).toArray()); S.lw = sm('w', ...S.sp.P(0.6, 1.45, 0.2).toArray());
    cap('真正的外積：兩個 3D 向量 → 一個新的 3D 向量', '（示意）'); S.n = note('示意', -3.6, 5.6);
  },
  async (tok, S) => { S.pg = pgram3(S.sp, S.v, S.w, YEL); cap('一樣看 v、w 張出的平行四邊形', '它的面積很重要'); },
  async (tok, S) => { const a = len3(cross3(S.v, S.w)); cap('假設面積是 2.5', ''); S.t = hot('面積 = ' + fmt(a), -3.6, 4.9); S.ck = ok(near(a, 2.5), '|v||w|sinθ = 2.5 ✓', -3.6, 4.3); },
  async (tok, S) => { cap('可是外積不是一個數', '它是一個向量'); },
  async (tok, S) => { S.ax = arw('#e55a9b', 0.07); const c = cross3(S.v, S.w); cap('新向量的長度 = 面積 = 2.5', ''); await anim(tok, 1500, (u) => setArrow(S.ax, S.O, S.sp.P(...c.map((x) => x * u)))); S.lx = sm('v × w', ...S.sp.P(0.3, 0, c[2] + 0.3).toArray()); },
  async (tok, S) => { const c = cross3(S.v, S.w); cap('方向：垂直於平行四邊形', ''); remove(S.ck); S.ck = ok(near(dot3(c, S.v), 0) && near(dot3(c, S.w), 0), '(v × w)·v = 0、(v × w)·w = 0 ✓', -3.6, 4.3); },
  async (tok, S) => { cap('可是哪一邊？', '垂直的方向有兩個：往上或往下'); S.gh = arw('#e55a9b', 0.035); setArrow(S.gh, S.O, S.sp.P(0, 0, -2.5)); S.q = sm('？', ...S.sp.P(0.3, 0, -2.6).toArray()); },
  async (tok, S) => { kill(S.gh); remove(S.q); cap('右手定則：食指指 v、中指指 w', '拇指的方向就是 v × w'); txt(S.lv, '食指 v'); txt(S.lw, '中指 w'); txt(S.lx, '拇指 v × w'); },
  async (tok, S) => {
    remove(S.ck); remove(S.n); kill(S.pg); kill(S.ax); remove(S.lx); S.v = [0, 0, 2]; S.w = [0, 2, 0];
    cap('例：v 長度 2、指向 z；w 長度 2、指向 y', ''); const v0 = [2, 0, 0], w0 = [0.5, 1.25, 0]; await anim(tok, 1400, (u) => { setArrow(S.av, S.O, S.sp.P(...v0.map((x, i) => x + (S.v[i] - x) * u))); setArrow(S.aw, S.O, S.sp.P(...w0.map((x, i) => x + (S.w[i] - x) * u))); });
    S.lv.position.copy(S.sp.P(0.2, 0, 2.3)); S.lw.position.copy(S.sp.P(0, 2.3, 0.2)); txt(S.lv, 'v = (0, 0, 2)'); txt(S.lw, 'w = (0, 2, 0)');
  },
  async (tok, S) => { S.pg = pgram3(S.sp, S.v, S.w, YEL); const a = len3(cross3(S.v, S.w)); cap('它們垂直、一樣長：是正方形', '面積 4 → 外積長度 4'); txt(S.t, '面積 = ' + fmt(a)); S.ck = ok(near(a, 4), '2 × 2 = 4 ✓', -3.6, 4.3); },
  async (tok, S) => {
    const c = cross3(S.v, S.w); S.ax = arw('#e55a9b', 0.07); cap('右手定則：指向 −x 方向', 'v × w = −4 î');
    await anim(tok, 1500, (u) => setArrow(S.ax, S.O, S.sp.P(...c.map((x) => x * u)))); sm('v × w = ' + v2s(c), ...S.sp.P(c[0] - 0.3, 0, 0.4).toArray());
    remove(S.ck); S.ck = ok(near(c[0], -4) && near(c[1], 0) && near(c[2], 0), 'v × w = (−4, 0, 0) = −4î ✓', -3.6, 4.3);
  },
], { cam: CAM3 });

scene('dt-cx-formula', '3B1B：用 3×3 行列式記外積公式', [
  async (tok, S) => {
    S.v = [2, 0, 1]; S.w = [0, 1, 1]; S.sp = space([2.6, 1.0, 0], 0.9, 2.4); S.O = S.sp.P(0, 0, 0);
    setArrow(arw(CV), S.O, S.sp.P(...S.v)); setArrow(arw(CW), S.O, S.sp.P(...S.w)); sm('v = (2, 0, 1)', ...S.sp.P(2.3, 0, 1.3).toArray()); sm('w = (0, 1, 1)', ...S.sp.P(0, 1.3, 1.4).toArray());
    cap('一般的計算：記一個「3D 行列式」的步驟', '（示意：v = (2, 0, 1)、w = (0, 1, 1)）'); S.n = note('示意', -1.5, 4.4);
  },
  async (tok, S) => { cap('寫一個 3×3 矩陣', '第 2、3 行放 v、w 的座標'); S.m = mview([['', 2, 0], ['', 0, 1], ['', 1, 1]], -3.6, 4.4, { s: 0.75, name: '' }); },
  async (tok, S) => { cap('第 1 行放基底向量 î、ĵ、k̂', '「把向量放進矩陣」看起來很怪'); S.m.kill(); S.m = mview([['î', 2, 0], ['ĵ', 0, 1], ['k̂', 1, 1]], -3.6, 4.4, { s: 0.75, name: 'v × w = det' }); S.m.glowCol(0, GOLD); },
  async (tok, S) => {
    S.m.unglow(); cap('然後算這個 det', '沿第 1 行展開（cofactor）');
    const M = [[0, 2, 0], [0, 0, 1], [0, 1, 1]]; S.c = [0, 1, 2].map((i) => cof(M, i, 0));
    S.t = pre(sm('î·(' + fmt(S.c[0]) + ') + ĵ·(' + fmt(S.c[1]) + ') + k̂·(' + fmt(S.c[2]) + ')', -3.6, 2.4));
  },
  async (tok, S) => { cap('把 î、ĵ、k̂ 當數字算', '得到它們的線性組合'); const x = cross3(S.v, S.w); S.ck = ok(S.c.every((c, i) => near(c, x[i])), '= ' + v2s(S.c) + ' = v × w ✓', -3.6, 1.7); },
  async (tok, S) => {
    const x = cross3(S.v, S.w); S.ax = arw('#e55a9b', 0.07); await anim(tok, 1400, (u) => setArrow(S.ax, S.O, S.sp.P(...x.map((c) => c * u)))); sm('v × w', ...S.sp.P(x[0] - 0.3, x[1], x[2] + 0.3).toArray());
    cap('這個向量垂直於 v 和 w', ''); remove(S.ck); S.ck = ok(near(dot3(x, S.v), 0) && near(dot3(x, S.w), 0), '(v × w)·v = 0、(v × w)·w = 0 ✓', -3.6, 1.7);
  },
  async (tok, S) => {
    pgram3(S.sp, S.v, S.w, YEL); const x = cross3(S.v, S.w), area = Math.sqrt(dot3(S.v, S.v) * dot3(S.w, S.w) - dot3(S.v, S.w) ** 2);
    cap('長度 = 平行四邊形的面積', '|v × w| = √(1 + 4 + 4) = 3'); remove(S.ck); S.ck = ok(near(len3(x), area), '|v × w| = ' + fmt(len3(x)) + ' = 面積 ' + fmt(area) + ' ✓', -3.6, 1.7);
  },
  async (tok, S) => { const x = cross3(S.v, S.w), d = det(cols3(S.v, S.w, x)); cap('方向遵守右手定則', 'det[v w v×w] > 0'); remove(S.ck); S.ck = ok(d > 0, 'det[v w v×w] = ' + fmt(d) + ' > 0 ✓', -3.6, 1.7); },
  async (tok, S) => { cap('有人說這只是記號上的小把戲', '但 det 再次出現不是巧合（下一集用 duality 解釋）'); },
], { cam: [[1.5, 4.0, 11.5], [0, 3.0, 0]] });

// ═════════════════════════ 3Blue1Brown：Cramer's rule（jBsC34PxzoM） ═════════════════════════
// 片尾驗算的例子：A = [2 −1; 0 1]、b = (4, 2)、解 (3, 2)；全段都用這組（片頭口述的輸出 (−4, −2) 沒有給矩陣，畫面標示意）
const CA = [[2, -1], [0, 1]], CB = [4, 2], CX = [3, 2], CO = '#c08a1f';
function inArrow(S, bd) { S.ai = arw('#e55a9b', 0.07); S.li = sm('', 0, 0); S.setIn = (v, lbl) => { const O = bd.P(0, 0).setZ(0.12); setArrow(S.ai, O, bd.P(...v).setZ(0.12)); const p = bd.P(...v); S.li.position.set(p.x + 0.25, p.y + 0.25, 0.2); if (lbl !== undefined) txt(S.li, lbl); }; }
scene('dt-cr-setup', '3B1B Cramer：方程組 = 找哪個輸入落到輸出', [
  async (tok, S) => { cap('兩個未知數 x、y，兩條方程式', '（畫面用片尾驗算的那組數字）'); S.eq = pre(hd('2x − y = 4\n     y = 2', -4.0, 5.2)); S.n = note('示意', -4.0, 6.1); },
  async (tok, S) => {
    cap('幾何上：已知矩陣把未知向量 (x, y) 變到已知的輸出', '輸出 b = (4, 2)'); S.m = mview(CA, -4.9, 3.4, { s: 0.55, name: 'A' }); pl('[x; y] =', -3.7, 3.4); S.bm = mview([[4], [2]], -2.7, 3.4, { s: 0.55, name: 'b' });
    S.ab = arw(CO, 0.07); setArrow(S.ab, S.L.bd.P(0, 0).setZ(0.12), S.L.bd.P(...CB).setZ(0.12)); S.lb = sm('b', ...S.L.bd.P(4.3, 2.4).toArray());
  },
  async (tok, S) => { cap('矩陣的兩行：î、ĵ 各自落在哪裡', 'î → (2, 0)、ĵ → (−1, 1)'); await S.L.to(tok, CA, 1600); },
  async (tok, S) => { cap('謎題：哪個輸入向量會落在 (4, 2)？', ''); S.q = hot('(x, y) = ?', -4.0, 1.6); },
  async (tok, S) => {
    cap('b 是兩行的線性組合', 'x·(落點 î) + y·(落點 ĵ)，要找出 x、y'); const O = S.L.bd.P(0, 0).setZ(0.14), p1 = S.L.bd.P(CX[0] * 2, 0).setZ(0.14);
    S.c1 = arw(IH, 0.035); S.c2 = arw(JH, 0.035); await anim(tok, 1400, (u) => { setArrow(S.c1, O, S.L.bd.P(2 * CX[0] * u, 0).setZ(0.14)); });
    await anim(tok, 1000, (u) => { setArrow(S.c2, p1, S.L.bd.P(6 - CX[1] * u, CX[1] * u).setZ(0.14)); }); S.lc = sm('x·col₁ + y·col₂', ...S.L.bd.P(3, -0.7).toArray());
  },
  async (tok, S) => {
    kill(S.c1); kill(S.c2); remove(S.lc); const Z = [[2, -1], [-2, 1]];
    cap('如果 det = 0（空間被壓扁）', '可能沒有輸入落在 b，也可能有一大堆'); await S.L.to(tok, Z, 1500); S.z = ok(near(det2(Z), 0), '示意 [2 −1; −2 1]：det = 0 ✓', -4.0, 1.0);
  },
  async (tok, S) => { remove(S.z); cap('這支影片只看 det ≠ 0', '每個輸出剛好對應一個輸入'); await S.L.to(tok, CA, 1400); S.z = ok(near(det2(CA), 2), 'det A = 2·1 − (−1)·0 = 2 ≠ 0 ✓', -4.0, 1.0); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(1.0, 3.0, 0.42, 6); } });

scene('dt-cr-dot', '3B1B Cramer：錯誤的第一步——內積不會被保持', [
  async (tok, S) => { inArrow(S, S.L.bd); S.setIn(CX, '(x, y) = (3, 2)'); cap('先看一個錯的、但方向對的想法', ''); },
  async (tok, S) => { const d = dot3([...CX, 0], [1, 0, 0]); cap('x 座標 = 它和 (1, 0) 的內積', '(3, 2)·(1, 0) = 3'); S.t1 = ok(d === 3, '(3, 2)·î = 3 = x ✓', -4.0, 5.2); },
  async (tok, S) => { const d = dot3([...CX, 0], [0, 1, 0]); cap('y 座標 = 它和 (0, 1) 的內積', '(3, 2)·(0, 1) = 2'); S.t2 = ok(d === 2, '(3, 2)·ĵ = 2 = y ✓', -4.0, 4.6); },
  async (tok, S) => {
    cap('希望變換後的內積還是這些座標', '我們知道變換後的 b 和兩行'); await S.L.to(tok, CA, 1600, () => S.setIn(mul2(S.L.M, CX), 'b = (4, 2)'));
  },
  async (tok, S) => {
    const c1 = [2, 0], c2 = [-1, 1], d1 = CB[0] * c1[0] + CB[1] * c1[1], d2 = CB[0] * c2[0] + CB[1] * c2[1];
    cap('問題：根本不對', 'b·col₁ = 8 ≠ 3，b·col₂ = −2 ≠ 2'); S.w1 = bad('b·col₁ = ' + fmt(d1) + ' ≠ 3 ✘', -4.0, 3.8); S.w2 = bad('b·col₂ = ' + fmt(d2) + ' ≠ 2 ✘', -4.0, 3.2);
  },
  async (tok, S) => {
    [S.t1, S.t2, S.w1, S.w2].forEach(remove); kill(S.ai); remove(S.li); await S.L.to(tok, [[1, 0], [0, 1]], 600);
    const T = [[3, -4], [0, 1]], u1 = [1, 0.5], u2 = [0.5, 1]; S.n = note('示意', -4.0, 6.0);
    S.u = [arw('#9b7ef4', 0.05), arw('#e55a9b', 0.05)]; const O = S.L.bd.P(0, 0).setZ(0.12);
    const draw = () => { setArrow(S.u[0], O, S.L.bd.P(...mul2(S.L.M, u1)).setZ(0.12)); setArrow(S.u[1], O, S.L.bd.P(...mul2(S.L.M, u2)).setZ(0.12)); }; draw();
    cap('兩個差不多同方向的向量：內積是正的', '變換把它們拉開，內積變成負的');
    await S.L.to(tok, T, 1800, draw); const a = mul2(T, u1), b = mul2(T, u2), d0 = u1[0] * u2[0] + u1[1] * u2[1], d1 = a[0] * b[0] + a[1] * b[1];
    S.k = ok(d0 > 0 && d1 < 0, '內積 ' + fmt(d0) + ' → ' + fmt(d1) + ' ✓', -4.0, 5.2);
  },
  async (tok, S) => {
    S.u.forEach(kill); remove(S.k); remove(S.n); await S.L.to(tok, CA, 1400);
    const d = CA[0][0] * CA[0][1] + CA[1][0] * CA[1][1]; cap('原本垂直的 î、ĵ（內積 0）', '變換後通常不再垂直'); S.k = ok(d !== 0, 'col₁·col₂ = ' + fmt(d) + ' ≠ 0 ✓', -4.0, 5.2);
  },
  async (tok, S) => {
    remove(S.k); const th = Math.PI / 6, R = [[Math.cos(th), -Math.sin(th)], [Math.sin(th), Math.cos(th)]]; S.R = R;
    cap('會保持內積的變換：orthonormal（正交）', '像旋轉：不拉不擠，基底還是互相垂直、長度 1'); await S.L.to(tok, R, 1600); S.k = hd('旋轉 30°（示意）', -4.0, 5.2);
  },
  async (tok, S) => {
    const b = mul2(S.R, CX); inArrow(S, S.L.bd); S.setIn(b, '輸出');
    const c1 = [S.R[0][0], S.R[1][0]], c2 = [S.R[0][1], S.R[1][1]], x = c1[0] * b[0] + c1[1] * b[1], y = c2[0] * b[0] + c2[1] * b[1];
    cap('這種矩陣解方程超簡單', 'x = col₁·輸出、y = col₂·輸出'); ok(near(x, 3) && near(y, 2), 'x = ' + fmt(Math.round(x * 1e6) / 1e6) + '、y = ' + fmt(Math.round(y * 1e6) / 1e6) + ' ✓', -4.0, 4.6);
  },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(1.0, 3.0, 0.42, 6); } });

scene('dt-cr-area', '3B1B Cramer：座標 = 有號面積／有號體積', [
  async (tok, S) => { cap('有沒有另一種描述座標的方法', '在變換之後還能保持（或可預測）？'); inArrow(S, S.bd); S.setIn(CX, '(x, y)'); },
  async (tok, S) => { S.pg = pgram(YEL); setPg(S.pg, S.bd, [1, 0], CX, 0.03, false); cap('看 î 和這個神秘向量張出的平行四邊形', ''); },
  async (tok, S) => { const d = det2(cols2([1, 0], CX)); cap('面積 = 底 × 高 = 1 × y', '繞了一大圈的方式描述 y 座標'); S.k = ok(near(d, CX[1]), 'det[î (x,y)] = ' + fmt(d) + ' = y ✓', -2.6, 0.2); },
  async (tok, S) => {
    cap('更精確：是「有號」面積', 'y 是負的 → 面積是負的（紅色）');
    await anim(tok, 1200, (u) => { const v = [3, 2 - 3.5 * u]; S.setIn(v); setPg(S.pg, S.bd, [1, 0], v, 0.03, true); }); await anim(tok, 1000, (u) => { const v = [3, -1.5 + 3.5 * u]; S.setIn(v); setPg(S.pg, S.bd, [1, 0], v, 0.03, true); }); S.pg.material.color.set(YEL);
  },
  async (tok, S) => { remove(S.k); S.pg2 = pgram('#9fd8c0'); setPg(S.pg2, S.bd, CX, [0, 1], 0.025, false); const d = det2(cols2(CX, [0, 1])); cap('對稱地：神秘向量和 ĵ 的平行四邊形', '面積 = x 座標'); S.k = ok(near(d, CX[0]), 'det[(x,y) ĵ] = ' + fmt(d) + ' = x ✓', -2.6, 0.2); },
  async (tok, S) => {
    S.sp = space([3.4, 1.0, 0], 0.8, 2.2); S.v3 = [1, 1.5, 2]; S.a3 = arw('#e55a9b', 0.06); setArrow(S.a3, S.sp.P(0, 0, 0), S.sp.P(...S.v3)); sm('(x, y, z)', ...S.sp.P(1.2, 1.6, 2.3).toArray());
    cap('3D：平常 z 座標 = 和 k̂ 的內積', '（示意：(1, 1.5, 2)）'); S.n = note('示意', 3.4, 6.1);
  },
  async (tok, S) => { S.pp = ppiped('#e9c53a'); const d = setPP(S.pp, S.sp, [1, 0, 0], [0, 1, 0], S.v3); cap('另一種：和 î、ĵ 張出的平行六面體', '底面積 1，體積 = 高 = z'); S.k3 = ok(near(d, S.v3[2]), 'det[î ĵ v] = ' + fmt(d) + ' = z ✓', 3.4, 0.0); },
  async (tok, S) => { remove(S.k3); const d = setPP(S.pp, S.sp, S.v3, [0, 1, 0], [0, 0, 1]); cap('其他座標也一樣', '向量 + 其他兩個基底 → 體積 = x'); S.k3 = ok(near(d, S.v3[0]), 'det[v ĵ k̂] = ' + fmt(d) + ' = x ✓', 3.4, 0.0); },
  async (tok, S) => { remove(S.k3); const d = setPP(S.pp, S.sp, [0, 1, 0], S.v3, [0, 0, 1]); cap('是「有號」體積：順序有差', '用右手定則；換了順序 → 負的'); S.k3 = ok(near(d, -S.v3[0]), 'det[ĵ v k̂] = ' + fmt(d) + ' = −x ✓', 3.4, 0.0); },
], { cam: [[1.5, 3.8, 12], [0.4, 3.0, 0]], init: async (tok, S) => { S.bd = board(-2.6, 3.2, 0.5, 4); } });

scene('dt-cr-rule', '3B1B Cramer：面積都乘上 det A → Cramer 法則', [
  async (tok, S) => {
    inArrow(S, S.L.bd); S.setIn(CX, '(x, y)'); S.pg = pgram(YEL); S.pgSet = (a, b) => setPg(S.pg, S.L.bd, a, b, 0.05, false); S.pgSet([1, 0], CX);
    cap('為什麼要把座標想成面積？', '套用變換時，這些面積會變'); S.y = hot('面積 = y = ' + fmt(det2(cols2([1, 0], CX))), 3.6, 5.6);
  },
  async (tok, S) => { const d = det2(CA); cap('關鍵：所有面積都乘上同一個數', '就是 det A'); S.dA = hd('det A = ' + fmt(d), 3.6, 5.0); },
  async (tok, S) => { cap('看 col₁（î 的落點）和變換後的 (x, y)', '也就是 b'); await S.L.to(tok, CA, 1800, () => { const M = S.L.M; S.setIn(mul2(M, CX)); S.pgSet([M[0][0], M[1][0]], mul2(M, CX)); }); txt(S.li, 'b = (4, 2)'); },
  async (tok, S) => { cap('它的面積是多少？', '它就是剛才那個平行四邊形變換後的樣子'); },
  async (tok, S) => { const a = det2(cols2([2, 0], CB)); cap('面積 = det A × y', ''); txt(S.y, '面積 = det A · y = ' + fmt(a)); S.k = ok(near(a, det2(CA) * CX[1]), fmt(a) + ' = ' + fmt(det2(CA)) + ' × ' + fmt(CX[1]) + ' ✓', 3.6, 4.4); },
  async (tok, S) => { remove(S.k); cap('所以 y = 新面積 ÷ det A', ''); S.k = ok(near(det2(cols2([2, 0], CB)) / det2(CA), CX[1]), 'y = ' + fmt(det2(cols2([2, 0], CB))) + ' / ' + fmt(det2(CA)) + ' = ' + fmt(CX[1]) + ' ✓', 3.6, 4.4); },
  async (tok, S) => { cap('新面積怎麼算？做一個新矩陣', '第 1 行照舊，第 2 行換成輸出 b'); S.my = mview(cols2([2, 0], CB), 2.4, 1.5, { s: 0.55, name: 'det[col₁ b] = ' + fmt(det2(cols2([2, 0], CB))) }); },
  async (tok, S) => { cap('只用輸出那一側的資料', '（矩陣的行、b）就拿回 y：解了一半'); },
  async (tok, S) => {
    remove(S.k); cap('x 也一樣：看 (x, y) 和 ĵ 的平行四邊形', '回到輸入空間：面積 = x');
    await S.L.to(tok, [[1, 0], [0, 1]], 1400, () => { const M = S.L.M; S.setIn(mul2(M, CX)); S.pgSet(mul2(M, CX), [M[0][1], M[1][1]]); }); txt(S.li, '(x, y)');
    S.pg.material.color.set('#9fd8c0'); txt(S.y, '面積 = x = ' + fmt(det2(cols2(CX, [0, 1]))));
  },
  async (tok, S) => {
    cap('變換後：由 b 和 col₂ 張成', '面積乘上 det A'); await S.L.to(tok, CA, 1600, () => { const M = S.L.M; S.setIn(mul2(M, CX)); S.pgSet(mul2(M, CX), [M[0][1], M[1][1]]); }); txt(S.li, 'b');
    const a = det2(cols2(CB, [-1, 1])); txt(S.y, '面積 = det A · x = ' + fmt(a)); S.k = ok(near(a, det2(CA) * CX[0]), fmt(a) + ' = ' + fmt(det2(CA)) + ' × ' + fmt(CX[0]) + ' ✓', 3.6, 4.4);
  },
  async (tok, S) => { remove(S.k); cap('x = 新面積 ÷ det A', ''); S.k = ok(near(det2(cols2(CB, [-1, 1])) / det2(CA), CX[0]), 'x = ' + fmt(det2(cols2(CB, [-1, 1]))) + ' / ' + fmt(det2(CA)) + ' = ' + fmt(CX[0]) + ' ✓', 3.6, 4.4); },
  async (tok, S) => { cap('新矩陣：第 1 行換成 b，第 2 行照舊', ''); S.mx2 = mview(cols2(CB, [-1, 1]), 5.6, 1.5, { s: 0.55, name: 'det[b col₂] = ' + fmt(det2(cols2(CB, [-1, 1]))) }); },
  async (tok, S) => { remove(S.k); cap('這就是 Cramer 法則', 'x = det[b col₂] / det A、y = det[col₁ b] / det A'); S.k = hot('Cramer：x = det[b col₂] / det A，y = det[col₁ b] / det A', -0.6, 6.2); },
  async (tok, S) => { const n = det2(cols2(CB, [-1, 1])); cap('驗算：上面的 det = 4 + 2 = 6', '下面 det A = 2 → x = 3'); S.k2 = ok(n === 4 + 2 && n / det2(CA) === CX[0], 'x = 6 / 2 = 3 ✓（輸入的 x 就是 3）', 3.6, 4.4); },
  async (tok, S) => { const n = det2(cols2([2, 0], CB)); cap('y = 4 / 2 = 2', '輸入的 y 確實是 2'); remove(S.k2); ok(n / det2(CA) === CX[1], 'y = 4 / 2 = 2 ✓（輸入的 y 就是 2）', 3.6, 4.4); },
], { cam: CAM2, init: async (tok, S) => { S.L = lin2(-1.0, 3.0, 0.4, 6); } });

const A3C = [[1, 0, 0.5], [0.5, 1, 0], [0, 0, 1.5]], X3 = [1, 1, 1];   // 示意
scene('dt-cr-3d', '3B1B Cramer：推廣到 3D（自己想）', [
  async (tok, S) => { S.sp = space([0, 1.2, 0], 1.1, 2.2); cap('3 維以上也類似', '先暫停想一想'); S.n = note('示意', -3.6, 6.95); },
  async (tok, S) => {
    S.b = A3C.map((r) => dot3(r, X3)); S.m = mview(A3C, -3.6, 4.35, { s: 1.0, name: 'A（示意）' });
    S.ab = arw(CO, 0.06); setArrow(S.ab, S.sp.P(0, 0, 0), S.sp.P(...S.b)); sm('b = ' + v2s(S.b), ...S.sp.P(S.b[0], S.b[1], S.b[2] + 0.35).toArray()); cap('已知 3×3 的變換和輸出 b', '要找哪個輸入落到 b');
  },
  async (tok, S) => { S.pp = ppiped(YEL); const d = setPP(S.pp, S.sp, [1, 0, 0], [0, 1, 0], X3); cap('把 z 座標想成 î、ĵ 和輸入向量的體積', ''); S.k = ok(near(d, X3[2]), 'det[î ĵ x] = ' + fmt(d) + ' = z ✓', -3.6, 2.4); },
  async (tok, S) => {
    const c = colsOf(A3C), d0 = det(A3C); cap('變換後，這個體積變成多少？', '乘上 det A'); remove(S.k);
    await anim(tok, 1600, (u) => { const L = (p, q) => p.map((x, i) => x + (q[i] - x) * u); setPP(S.pp, S.sp, L([1, 0, 0], c[0]), L([0, 1, 0], c[1]), L(X3, S.b)); });
    const d = det(cols3(c[0], c[1], S.b)); S.k = ok(near(d, d0 * X3[2]), 'det[col₁ col₂ b] = ' + fmt(d) + ' = det A · z ✓', -3.6, 2.4);
  },
  async (tok, S) => { const c = colsOf(A3C), z = det(cols3(c[0], c[1], S.b)) / det(A3C); cap('每個座標都能寫成這樣', 'z = det[col₁ col₂ b] / det A'); ok(near(z, X3[2]), 'z = ' + fmt(det(cols3(c[0], c[1], S.b))) + ' / ' + fmt(det(A3C)) + ' = ' + fmt(z) + ' ✓', -3.6, 1.8); },
], { cam: [[6.0, 5.0, 10], [0, 2.2, 0]] });

// ═════════════════════════ MIT 18.06 L18（srxexLishgY）Properties of Determinants ═════════════════════════
// Strang 的十個性質，一個一個從性質 1–3 推出來。老師多半用 a b c d 的符號；有數字的例子是自己選的（畫面標示意），
// 消去的數字例用課本 Ch5 的 A = [1 2 1; 3 8 1; 0 4 1]（pivots 1、2、5）。
const SYM2 = [['a', 'b'], ['c', 'd']];
const TB = [[1, 2, 1], [3, 8, 1], [0, 4, 1]];   // 課本例
scene('dt-l18-intro', 'L18：行列式是方陣的一個數，用來測可不可逆', [
  async (tok, S) => { S.mv = mview(symM(3), -3.2, 3.6, { name: '方陣 A', s: 0.85 }); cap('每個方陣都有一個數：它的行列式', 'determinant'); S.ar = arrow(V3(-1.5, 3.6, 0), V3(0.4, 3.6, 0), 0x6e5f49); S.n = hot('一個數', 1.6, 3.6); },
  async (tok, S) => { cap('寫成 det A，或用直線框起來 |A|', ''); txt(S.n, 'det A = |A|'); },
  async (tok, S) => { cap('一個數當然說不完整個矩陣', '但它把盡量多的資訊擠進一個數'); },
  async (tok, S) => {
    S.mv.kill(); kill(S.ar); remove(S.n); cap('最重要的一件事：det ≠ 0 ⇔ 可逆', 'det = 0 ⇔ singular（示意）');
    const A = [[2, 1], [1, 1]], B = [[1, 2], [2, 4]];
    mview(A, -2.6, 4.2, { s: 0.75, name: '示意' }); ok(near(det(A), 1), 'det = 1 ≠ 0 → 可逆 ✓', -2.6, 2.9);
    mview(B, 2.6, 4.2, { s: 0.75, name: '示意' }); ok(near(det(B), 0), 'det = 0 → singular ✓', 2.6, 2.9);
  },
  async (tok, S) => { cap('不直接給一個大公式', '先講三個性質，公式之後自己長出來'); hd('先講三個性質', 0, 1.4); },
]);

scene('dt-l18-p12', 'L18：性質 1 det I = 1、性質 2 換列變號', [
  async (tok, S) => { const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; S.m = mview(I, -3.2, 4.0, { name: 'I', s: 0.8 }); cap('性質 1：det I = 1', '最簡單的一條，也是「單位」'); S.k = ok(bigDet(I) === 1, 'det I = 1 ✓', -3.2, 2.4); S.p = [pl('性質 1：det I = 1', 3.4, 5.8)]; },
  async (tok, S) => { S.m.kill(); remove(S.k); S.A = [[2, 1, 0], [1, 3, 1], [0, 1, 2]]; S.m = mview(S.A, -3.2, 4.0, { name: '示意 A', s: 0.8 }); S.d0 = det(S.A); cap('性質 2：交換兩列會怎樣？', ''); S.dt = hot('det = ' + fmt(S.d0), -3.2, 2.4); await swapRows(tok, S.m, 0, 1, 1400); },
  async (tok, S) => { const d1 = det(S.m.v); cap('換列 → det 變號', ''); txt(S.dt, 'det：' + fmt(S.d0) + ' → ' + fmt(d1)); S.k = ok(near(d1, -S.d0), '變號 ✓', -3.2, 1.8); S.p.push(pl('性質 2：換列 → 變號', 3.4, 5.3)); },
  async (tok, S) => {
    S.m.kill(); remove(S.dt); remove(S.k); cap('現在知道哪些矩陣的 det？', 'permutation matrices：I 換列得到的');
    S.P1 = [[0, 1, 0], [1, 0, 0], [0, 0, 1]]; S.P2 = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
    S.m1 = mview(S.P1, -4.0, 4.0, { s: 0.6, name: '換 1 次' }); S.m2 = mview(S.P2, -1.4, 4.0, { s: 0.6, name: '換 2 次' });
  },
  async (tok, S) => { cap('permutation 的 det = 1 或 −1', '換偶數次 +1、奇數次 −1'); S.pk = [ok(det(S.P1) === -1, 'det = −1 ✓', -4.0, 2.8), ok(det(S.P2) === 1, 'det = +1 ✓', -1.4, 2.8)]; },
  async (tok, S) => { S.m1.kill(); S.m2.kill(); (S.pk || []).forEach(remove); cap('2×2：性質 1 說這個是 1', ''); mview([[1, 0], [0, 1]], -3.6, 1.2, { s: 0.55 }); ok(det([[1, 0], [0, 1]]) === 1, '= 1 ✓', -2.5, 1.2); },
  async (tok, S) => { cap('性質 2 說這個是 −1', ''); mview([[0, 1], [1, 0]], -0.4, 1.2, { s: 0.55 }); ok(det([[0, 1], [1, 0]]) === -1, '= −1 ✓', 0.7, 1.2); },
  async (tok, S) => { cap('最終要得到大家都知道的 ad − bc', '每個性質都可以拿它來檢查'); mview(SYM2, 2.6, 3.4, { s: 0.6 }); hot('= ad − bc', 4.2, 3.4); },
]);

// rows of a 2×2 as board vectors, with their parallelogram (det = signed area)
function rows2(bd) { const R = { pg: pgram(YEL), a1: arw(CV), a2: arw(CW) }; R.set = (r1, r2, signColor = true) => { const O = bd.P(0, 0).setZ(0.1); setArrow(R.a1, O, bd.P(...r1).setZ(0.1)); setArrow(R.a2, O, bd.P(...r2).setZ(0.1)); setPg(R.pg, bd, r1, r2, 0.03, signColor); return det2([r1, r2]); }; return R; }
scene('dt-l18-p3', 'L18：性質 3——對每一列是線性的', [
  async (tok, S) => { cap('性質 3 是關鍵', '分成 3a 和 3b'); S.bd = board(2.2, 3.0, 0.42, 5); S.R = rows2(S.bd); S.R.set([1, 1], [1, 3]); S.m = mview([[1, 1], [1, 3]], -3.6, 4.6, { s: 0.6, name: '示意（看列向量）' }); S.dt = hot('det = ' + fmt(det([[1, 1], [1, 3]])), -3.6, 3.4); },
  async (tok, S) => { cap('3a：第 1 列乘 t，其他列不動', '（t = 2）'); S.m.glowRow(0, GOLD); await anim(tok, 1400, (u) => { const t = 1 + u; S.R.set([t, t], [1, 3]); }); S.m.set(0, 0, 2); S.m.set(0, 1, 2); S.m.unglow(); },
  async (tok, S) => { const d = det([[2, 2], [1, 3]]); cap('t 整個提出來：det 也乘 t', '|ta tb; c d| = t·|a b; c d|'); txt(S.dt, 'det = ' + fmt(d)); S.k = ok(near(d, 2 * det([[1, 1], [1, 3]])), fmt(d) + ' = 2 × ' + fmt(det([[1, 1], [1, 3]])) + ' ✓', -3.6, 2.8); },
  async (tok, S) => {
    remove(S.k); S.m.kill(); remove(S.dt); const r = [1, 1], r2 = [1, -1], s = [1, 3];
    cap('3b：第 2 列不動，第 1 列是兩個向量的和', '|a+a′ b+b′; c d| = |a b; c d| + |a′ b′; c d|');
    S.R.set([r[0] + r2[0], r[1] + r2[1]], s); S.p1 = pgram('#9fd8c0'); setPg(S.p1, S.bd, r, s, 0.045, false); S.p2 = pgram('#c9b6f5'); setPg(S.p2, S.bd, r2, s, 0.05, false);
    const d = det2([[2, 0], s]), d1 = det2([r, s]), d2 = det2([r2, s]);
    S.k = pre(sm('示意：第 2 列 (1, 3)\n|2 0; 1 3| = ' + fmt(d) + '\n|1 1; 1 3| + |1 −1; 1 3| = ' + fmt(d1) + ' + ' + fmt(d2), -3.6, 4.4)); S.k2 = ok(near(d, d1 + d2), '線性 ✓', -3.6, 3.2);
  },
  async (tok, S) => { cap('用一句話說：det 是第 1 列的線性函數', '前提是其他列都不動'); },
  async (tok, S) => { remove(S.k2); const I = [[1, 0], [0, 1]], s2 = matMul(I, I).map((r, i) => r.map((v, j) => I[i][j] + I[i][j])); cap('不是說 det(A + B) = det A + det B！', '例：A = B = I'); S.k3 = ok(!near(det(s2), det(I) + det(I)), 'det(I + I) = ' + fmt(det(s2)) + ' ≠ 1 + 1 ✓', -3.6, 3.2); },
  async (tok, S) => { cap('那會讓「所有列」一起變', '這裡要的只是：一次一列的線性'); },
  async (tok, S) => {
    remove(S.k); remove(S.k3); kill(S.p1); kill(S.p2); S.m = mview([['a', 'b'], ["c+c′", "d+d′"]], -3.6, 4.4, { s: 0.75, name: '第 2 列也線性' });
    cap('第 2 列也是線性的', '先換列把它移到第 1 列，用性質 3，再換回來（兩次變號抵消）'); await swapRows(tok, S.m, 0, 1, 1000); await swapRows(tok, S.m, 0, 1, 1000);
  },
]);

const M7 = [[2, 1, 0, 3, 1, 0, 2], [1, 0, 2, 1, 3, 1, 0], [2, 1, 0, 3, 1, 0, 2], [0, 3, 1, 1, 0, 2, 1], [1, 1, 2, 0, 1, 3, 0], [3, 0, 1, 2, 2, 1, 1], [0, 2, 1, 1, 0, 1, 3]];
scene('dt-l18-p4', 'L18：性質 4——兩列相同 → det = 0', [
  async (tok, S) => { cap('性質 4：有兩列相同 → det = 0', ''); hd('性質 4：兩列相同 → det = 0', 2.8, 6.0); },
  async (tok, S) => { const A = [[2, 5], [2, 5]]; cap('2×2 很好檢查', '|a b; a b| = ab − ba = 0'); S.m2 = mview(A, 3.6, 4.2, { s: 0.6, name: '示意' }); S.k = ok(near(det(A), 0), '2·5 − 5·2 = 0 ✓', 3.6, 3.0); },
  async (tok, S) => { S.m2.kill(); remove(S.k); cap('n×n 為什麼也對？', '例：7×7，第 1 列 = 第 3 列（示意）'); S.m = mview(M7, -2.2, 3.4, { s: 0.48, name: '示意 7×7' }); S.m.glowRow(0, GOLD); S.m.glowRow(2, GOLD); },
  async (tok, S) => { cap('只能用性質 1、2、3：做一次換列', '交換第 1、3 列'); await swapRows(tok, S.m, 0, 2, 1500); S.m.glowRow(0, GOLD); S.m.glowRow(2, GOLD); },
  async (tok, S) => { const same = JSON.stringify(S.m.v) === JSON.stringify(M7); cap('換完還是同一個矩陣 → det 沒變', '但性質 2 說：換列要變號'); S.k = ok(same, '換完 = 原矩陣 ✓', 3.4, 4.6); S.e = hot('det = −det', 3.4, 4.0); },
  async (tok, S) => { const d = det(M7); cap('又不變、又要變號：只可能是 0', 'det = −det ⇒ det = 0'); txt(S.e, 'det = −det ⇒ det = 0'); S.k2 = ok(near(d, 0), '直接算：det = ' + fmt(d) + ' ✓', 3.4, 3.4); },
  async (tok, S) => { S.m.unglow(); cap('跟以前學的一致', '兩列相同 → rank < n → 不可逆'); sm('rank < n → singular', 3.4, 2.7); },
]);

scene('dt-l18-p5', 'L18：性質 5——消去（Rₖ − ℓRᵢ）不改 det', [
  async (tok, S) => { cap('性質 5：從第 k 列減掉 ℓ 倍的第 i 列', 'det 不變'); hd('性質 5：Rₖ − ℓRᵢ → det 不變', 0, 6.0); },
  async (tok, S) => { cap('就是消去法每天在做的事', 'ℓ 選來在那個位置製造 0'); },
  async (tok, S) => {
    S.m = mview(TB, -3.2, 3.6, { s: 0.8, name: '示意（課本例）A' }); S.d0 = det(TB); S.dt = hot('det = ' + fmt(S.d0), -3.2, 1.9);
    cap('一路消到上三角的 U', 'det A = det U'); S.m.pivot(0, 0); await rowOp(tok, S.m, 1, 0, 3, 1100); S.m.pivot(1, 1); await rowOp(tok, S.m, 2, 1, 2, 1100); S.m.pivot(2, 2); txt(S.m.nameL, 'U');
    S.k = ok(near(det(S.m.v), S.d0), 'det U = ' + fmt(det(S.m.v)) + ' = det A ✓', -3.2, 1.3);
  },
  async (tok, S) => { S.m.kill(); remove(S.dt); remove(S.k); cap('用 2×2 看為什麼', '第 2 列減掉 ℓ 倍第 1 列'); S.s = mview([['a', 'b'], ['c−ℓa', 'd−ℓb']], -3.2, 4.0, { s: 0.85 }); },
  async (tok, S) => { cap('乘開：ad − bc − aℓb + aℓb', '多的兩項抵消……但這是作弊，要用性質'); S.t = pre(sm('a(d−ℓb) − b(c−ℓa)\n= ad − bc − aℓb + bℓa', 1.8, 4.6)); },
  async (tok, S) => {
    remove(S.t); cap('性質 3b：第 1 列不動，第 2 列拆開', '= |a b; c d| + |a b; −ℓa −ℓb|');
    S.p1 = mview(SYM2, 0.4, 4.0, { s: 0.6 }); pl('+', 1.6, 4.0); S.p2 = mview([['a', 'b'], ['−ℓa', '−ℓb']], 2.9, 4.0, { s: 0.6 }); pl('=', -1.4, 4.0);
  },
  async (tok, S) => { cap('性質 3a：把 −ℓ 提出來', '−ℓ · |a b; a b|'); S.p2.kill(); S.p3 = mview([['a', 'b'], ['a', 'b']], 3.6, 4.0, { s: 0.6 }); S.l = pl('−ℓ ·', 2.6, 4.0); },
  async (tok, S) => { S.p3.glowRow(0, GOLD); S.p3.glowRow(1, GOLD); cap('性質 4：兩列相同 → 0', ''); S.z = bad('= 0', 3.6, 2.9); },
  async (tok, S) => { S.p3.unglow(); cap('所以消去之後的 det 跟原來一樣', '|a b; c−ℓa d−ℓb| = |a b; c d|'); const a = 2, b = 1, c = 4, d = 3, l = 2; ok(near(det([[a, b], [c - l * a, d - l * b]]), det([[a, b], [c, d]])), '示意 a,b,c,d,ℓ = 2,1,4,3,2：' + fmt(det([[a, b], [c - l * a, d - l * b]])) + ' = ' + fmt(det([[a, b], [c, d]])) + ' ✓', 0, 1.6); },
]);

scene('dt-l18-p6', 'L18：性質 6——有一整列 0 → det = 0', [
  async (tok, S) => { cap('性質 6：有一整列都是 0 → det = 0', ''); hd('性質 6：零列 → det = 0', 0, 6.0); },
  async (tok, S) => { const A = [[1, 2], [2, 4]]; S.m = mview(A, -3.0, 4.0, { s: 0.8, name: '示意' }); cap('消去時如果得到一整列 0', '以前那代表 singular，現在 det 也是 0'); await rowOp(tok, S.m, 1, 0, 2, 1400); S.m.glowRow(1, REDG); },
  async (tok, S) => { cap('怎麼用前面的性質證？', '看 |0 0; c d|'); S.z = mview([[0, 0], ['c', 'd']], 2.4, 4.0, { s: 0.8 }); S.z.glowRow(0, REDG); },
  async (tok, S) => {
    cap('用 3a，t = 5：零列乘 5 還是零列', '所以 det = 5·det → det = 0'); S.z.glowRow(0, GOLD); S.t = pre(sm('|0 0; c d| = |5·0 5·0; c d|\n= 5·|0 0; c d|\n⇒ det = 0', 2.4, 1.9));
    const A = [[0, 0], [3, 7]]; S.k = ok(near(det(A), 0), '示意 c = 3、d = 7：det = 0 ✓', -3.0, 1.9);
  },
  async (tok, S) => { cap('更好的做法：直接取 t = 0', '0 · det = 0'); txt(S.t, '|0 0; c d| = 0 · |? ?; c d| = 0'); },
]);

scene('dt-l18-p7', 'L18：性質 7——三角矩陣的 det = 對角線乘積', [
  async (tok, S) => { cap('性質 7：消去後得到上三角矩陣', '對角線是 pivots d₁、d₂、…、dₙ，上面是什麼都沒關係'); S.u = mview([['d₁', '*', '*'], ['0', 'd₂', '*'], ['0', '0', 'd₃']], -3.4, 4.0, { s: 0.85, name: 'U' }); },
  async (tok, S) => { cap('det U = d₁ · d₂ · … · dₙ', '只看對角線'); [0, 1, 2].forEach((k) => S.u.glowCell(k, k, GREEN)); S.f = hot('det U = d₁d₂d₃', -3.4, 1.9); },
  async (tok, S) => {
    S.u.kill(); remove(S.f); cap('這就是 MATLAB 算 det 的方法', '消去 → 三角 → pivots 相乘（示意：課本例）');
    S.m = mview(TB, -3.4, 3.8, { s: 0.8, name: 'A' }); await rowOp(tok, S.m, 1, 0, 3, 1100); await rowOp(tok, S.m, 2, 1, 2, 1100); txt(S.m.nameL, 'U'); [0, 1, 2].forEach((k) => S.m.pivot(k, k));
  },
  async (tok, S) => { cap('要注意正負號', '途中如果換過列：每換一次 × (−1)'); S.sg = sm('有換列：det = ±(pivots 乘積)', 2.6, 5.4); },
  async (tok, S) => {
    cap('證明：pivots 不是 0 時', '用消去把上面的東西全部消掉'); remove(S.sg);
    await rowOp(tok, S.m, 1, 2, -0.4, 800); await rowOp(tok, S.m, 0, 2, 0.2, 800); await rowOp(tok, S.m, 0, 1, 1, 800); txt(S.m.nameL, '對角矩陣');
  },
  async (tok, S) => { cap('性質 3a：每一列把 dᵢ 提出來', '剩下的是 I'); S.t = hot('= 1 · 2 · 5 · det I', 2.6, 4.4); },
  async (tok, S) => { const p = 1 * 2 * 5; cap('最後性質 1：det I = 1', 'det = d₁d₂d₃ = 1·2·5'); txt(S.t, '= 1·2·5·1 = ' + p); ok(near(p, det(TB)), 'det A = ' + fmt(det(TB)) + ' ✓', 2.6, 3.8); },
]);

scene('dt-l18-p8', 'L18：性質 8——det A = 0 ⇔ A singular', [
  async (tok, S) => { cap('如果某個 dᵢ 是 0', '消去會得到整列 0 → 用性質 6：det = 0'); hd('性質 8：det A = 0 ⇔ A 是 singular', 0, 6.0); },
  async (tok, S) => { cap('關鍵結論：det A = 0 剛好在 A singular 的時候', '否則 det ≠ 0'); },
  async (tok, S) => { cap('可逆 ⇔ 消去得到一整組 pivots', 'det = 這些非 0 數的乘積 ≠ 0'); },
  async (tok, S) => { cap('用 2×2 檢查', '2×2 的 pivots 是什麼？'); S.m = mview(SYM2, -3.2, 4.0, { s: 0.85 }); S.m.pivot(0, 0); },
  async (tok, S) => { cap('乘數 ℓ = c / a', '第 2 列 − (c/a)·第 1 列'); S.u = mview([['a', 'b'], ['0', 'd − (c/a)b']], 1.2, 4.0, { s: 0.85 }); S.u.pivot(0, 0); S.u.pivot(1, 1); },
  async (tok, S) => { cap('det = a · (d − cb/a)', 'a 消掉 → ad − bc'); hot('a·(d − cb/a) = ad − bc', 1.2, 2.6); const A = [[2, 1], [4, 5]], p2 = 5 - (4 / 2) * 1; ok(near(2 * p2, det(A)), '示意 [2 1; 4 5]：pivots 2、' + fmt(p2) + '，乘積 ' + fmt(2 * p2) + ' = 10 − 4 ✓', 1.2, 1.9); },
  async (tok, S) => { cap('前提是 a ≠ 0', 'a = 0 就要先換列；換不了 → singular'); },
]);

scene('dt-l18-p9', 'L18：性質 9——det(AB) = det A · det B', [
  async (tok, S) => {
    S.L = lin2(-2.4, 3.0, 0.42, 4, { grid: false }); S.B = [[1, 1], [-1, 1]]; S.A = [[1.5, 0], [0, 1]];
    cap('性質 9：det(AB) = det A · det B', '（示意：先 B 再 A，面積先 × 2 再 × 1.5）'); await S.L.to(tok, S.B, 1000); await S.L.to(tok, matMul(S.A, S.B), 1000);
    S.k = ok(near(det(matMul(S.A, S.B)), det(S.A) * det(S.B)), 'det(AB) = ' + fmt(det(matMul(S.A, S.B))) + ' = ' + fmt(det(S.A)) + '·' + fmt(det(S.B)) + ' ✓', 2.8, 5.6);
  },
  async (tok, S) => { const A = [[1, 0], [0, 1]]; cap('奇妙：det 沒有加法性質', '但有乘法性質'); S.k2 = ok(!near(det([[2, 0], [0, 2]]), 2 * det(A)), 'det(I + I) = 4 ≠ 2', 2.8, 5.0); },
  async (tok, S) => { remove(S.k2); cap('例如：det(A⁻¹) 是多少？', '用性質 9'); },
  async (tok, S) => { cap('A⁻¹A = I，兩邊取 det', 'det(A⁻¹)·det(A) = det I = 1'); S.t = hd('det(A⁻¹)·det A = det I = 1', 2.8, 4.4); },
  async (tok, S) => { cap('所以 det(A⁻¹) = 1 / det A', ''); txt(S.t, 'det(A⁻¹) = 1 / det A'); },
  async (tok, S) => { const D = [[2, 0], [0, 3]], Di = [[1 / 2, 0], [0, 1 / 3]]; cap('對角矩陣檢查：diag(2, 3)', '反矩陣 diag(½, ⅓)：det 6 和 1/6'); S.dm = [mview(D, 2.0, 3.0, { s: 0.55 }), mview(Di, 3.9, 3.0, { s: 0.55 })]; S.dk = [ok(near(det(D), 6) && near(det(Di), 1 / 6), '6 和 1/6 ✓', 2.9, 2.0)]; },
  async (tok, S) => { const D2 = [[4, 0], [0, 9]]; cap('det(A²) = (det A)²', '矩陣平方 → det 也平方'); S.dk.push(ok(near(det(D2), 36), 'det(diag(2,3)²) = 36 = 6² ✓', 2.9, 1.4)); },
  async (tok, S) => { cap('把整個矩陣乘 2，det 變幾倍？', '不是 2 倍：是 2ⁿ 倍'); S.t2 = hot('det(2A) = 2ⁿ det A', -2.4, 0.4); },
  async (tok, S) => { cap('因為每一列都提出一個 2', 'n 列 → n 個 2'); },
  async (tok, S) => {
    S.dm.forEach((m) => m.kill()); S.dk.forEach(remove); remove(S.t);
    cap('就像體積：盒子每邊放大 2 倍', '3D：體積 × 8'); S.sp = space([5.0, 0.9, 0], 0.55, 2.2); S.pp = ppiped(); setPP(S.pp, S.sp, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    await anim(tok, 1500, (u) => { const t = 1 + u; setPP(S.pp, S.sp, [t, 0, 0], [0, t, 0], [0, 0, t]); });
    S.k3 = ok(near(det([[2, 0, 0], [0, 2, 0], [0, 0, 2]]), 8), 'det(2I₃) = 2³ = 8 ✓', 5.0, 3.4);
  },
  async (tok, S) => { cap('也跟可逆性一致', 'A 可逆 → det ≠ 0，1/det A 才有意義；det A = 0 → A⁻¹ 不存在'); },
], { cam: [[1.2, 3.8, 12.5], [0.6, 3.0, 0]] });

scene('dt-l18-p10', 'L18：性質 10——det Aᵀ = det A', [
  async (tok, S) => { cap('性質 10：det Aᵀ = det A', ''); hd('性質 10：det Aᵀ = det A', 0, 6.0); },
  async (tok, S) => { cap('用 a b c d 檢查', '|a c; b d| = ad − cb = ad − bc ✓'); mview(SYM2, -3.6, 4.4, { s: 0.6, name: 'A' }); mview([['a', 'c'], ['b', 'd']], -1.6, 4.4, { s: 0.6, name: 'Aᵀ' }); },
  async (tok, S) => { cap('所以「列」的性質，「行」也都有', '一整行是 0 → det = 0'); S.c = sm('零行 → det = 0', 2.6, 5.0); },
  async (tok, S) => { cap('交換兩行 → 變號', '轉置 → 換列 → 再轉置回來'); txt(S.c, '零行 → 0、換兩行 → 變號'); },
  async (tok, S) => {
    cap('快速證明：A = LU，Aᵀ = UᵀLᵀ', '（示意：課本例）'); const L = [[1, 0, 0], [3, 1, 0], [0, 2, 1]], U = [[1, 2, 1], [0, 2, -2], [0, 0, 5]]; S.L = L; S.U = U;
    S.mA = mview(TB, -4.2, 1.6, { s: 0.5, name: 'A' }); pl('=', -3.2, 1.6); S.mL = mview(L, -2.2, 1.6, { s: 0.5, name: 'L' }); S.mU = mview(U, -0.4, 1.6, { s: 0.5, name: 'U' });
    S.k = ok(JSON.stringify(matMul(L, U)) === JSON.stringify(TB), 'LU = A ✓', -2.2, 0.3);
  },
  async (tok, S) => { cap('性質 9：乘積的 det = det 的乘積', 'det A = det L · det U、det Aᵀ = det Uᵀ · det Lᵀ'); S.f = pre(sm('det A = det L · det U\ndet Aᵀ = det Uᵀ · det Lᵀ', 3.0, 3.4)); },
  async (tok, S) => { S.mL.glowRow(0, null); [0, 1, 2].forEach((k) => S.mL.glowCell(k, k, GREEN)); cap('L 是下三角、對角線全是 1', 'det L = 1'); ok(det(S.L) === 1, 'det L = 1 ✓', 3.0, 2.4); },
  async (tok, S) => { cap('Lᵀ 也是三角、對角線還是 1', '非 0 的東西只是跑到另一邊'); ok(det(T2(S.L)) === 1, 'det Lᵀ = 1 ✓', 3.0, 1.8); },
  async (tok, S) => { [0, 1, 2].forEach((k) => S.mU.glowCell(k, k, GREEN)); cap('U 和 Uᵀ 都是三角：只看對角線', '轉置不影響對角線 → det 一樣'); ok(near(det(S.U), det(T2(S.U))) && near(det(TB), det(T2(TB))), 'det U = det Uᵀ = ' + fmt(det(S.U)) + ' → det A = det Aᵀ ✓', 3.0, 1.2); },
]);

scene('dt-l18-parity', 'L18：排列一定是奇或偶（det 才定義得好）', [
  async (tok, S) => { cap('最後一個（數學教授在等的）註解', '回到性質 2：換列就變號'); S.c = [1, 2, 3].map((v, k) => cube(String(v), ['#4b9ee2', '#2fc092', '#e9c53a'][k], [0.9, 0.9, 0.9], -1.5 + k * 1.5, 3.6, 0)); S.order = [0, 1, 2]; },
  async (tok, S) => {
    cap('同一個排列：能不能換 7 次得到，也換 10 次得到？', '（示意：排成 3 1 2）'); S.cnt = hot('', 0, 5.4);
    const sw = async (i, j, n) => { [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; S.order.forEach((c, k) => P.move(S.c[c], -1.5 + k * 1.5, 3.6, 0)); txt(S.cnt, '換了 ' + n + ' 次'); await wt(tok, 450); };
    S.sw = sw; await sw(0, 2, 1); await sw(1, 2, 2);
    S.r1 = sm('走法一：2 次 → ' + S.order.map((c) => c + 1).join(' '), 0, 2.2);
  },
  async (tok, S) => { cap('如果可以，性質 2 就自相矛盾', '7 次 → 變號；10 次 → 不變'); S.bad = sm('7 次：−det　10 次：+det　→ 矛盾', 0, 1.6); },
  async (tok, S) => {
    remove(S.bad); cap('隱藏的事實：每個排列不是奇就是偶', '另一種走法：4 次，還是偶數');
    S.order = [0, 1, 2]; S.order.forEach((c, k) => P.move(S.c[c], -1.5 + k * 1.5, 3.6, 0));
    await S.sw(0, 1, 1); await S.sw(0, 2, 2); await S.sw(0, 1, 3); await S.sw(0, 1, 4);
    const p = S.order; S.r2 = sm('走法二：4 次 → ' + p.map((c) => c + 1).join(' '), 0, 1.6);
    const Pm = p.map((c) => [0, 1, 2].map((j) => (j === c ? 1 : 0))); ok(sgnP(p) === 1 && det(Pm) === 1, '逆序數 2 → 偶排列，det P = +1 ✓', 0, 1.0);
  },
  async (tok, S) => { cap('所以 det 被性質 1、2、3 唯一決定', '並且有性質 4 到 10'); hd('性質 1–3 定義 det → 推出 4–10', 0, 0.3); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'adjugate-inverse', 'cramer-geometry', 'cross-product'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
