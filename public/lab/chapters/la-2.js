// 線性代數 第2章：矩陣運算（乘法四種看法、方塊乘法、反矩陣、Gauss-Jordan、轉置、對稱、permutation、合成變換）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   MIT 18.06 L3（FX4C-JpTFgY，有字幕）：c₃₄ = Σ a₃ₖbₖ₄、(m×n)(n×p) = m×p、行的組合／列的組合、
//     (2,3,4)×(1,6) = [2 12; 3 18; 4 24] 與 row space / column space、方塊乘法 A₁B₁ + A₂B₃、
//     [1 3; 2 6] 不可逆（x = (3, −1)）、[1 3; 2 7] 用 Gauss-Jordan 得 [7 −3; −2 1]、E[A I] = [I A⁻¹]。
//   課本補充（Strang Ch2；3B1B「composition」、18.06 L5、L20 尚無字幕）：合成變換（先旋轉 90° 再 shear，SR = [1 −1; 1 0]）、
//     乘法陷阱、轉置與 (AB)ᵀ、對稱矩陣 RRᵀ（R = [1 3; 2 3; 4 1]）、permutation 換列換行、2×2 反矩陣公式。
//   L3 的 c₃₄、行／列組合用的具體數字是自己選的（影片只寫符號），流程依影片。
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

  const comb = (cs, names) => cs.map((c, k) => (k === 0 ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + ') + fmt(Math.abs(c)) + '·' + names[k]).join('');
  const T2 = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const mstr = (M) => '[' + M.map((r) => r.map(fmt).join(' ')).join('; ') + ']';
  const eqM = (A, B) => A.length === B.length && A[0].length === B[0].length && A.every((r, i) => r.every((v, j) => Math.abs(v - B[i][j]) < 1e-9));
  const I2 = [[1, 0], [0, 1]];
  // layout positions of an R×C matrix centred at (cx, cy), same as mview (no aug)
  const gridXY = (R, C, cx, cy, s) => ({ X: (j) => cx - (C * s) / 2 + s / 2 + j * s, Y: (i) => cy + ((R - 1) / 2 - i) * s });
  // a ghost value block that flies from (x1, y1) to (x2, y2)
  async function ghostFly(tok, v, x1, y1, x2, y2, ms = 800, z = 0.5, color = COL.hot) {
    const g = cube(typeof v === 'number' ? fmt(v) : v, color, [0.5, 0.5, 0.26], x1, y1, z);
    move(g, x2, y2, z); await W(tok, ms); kill(g);
  }
  // linear-transformation grid: faint fixed board + a moving blue grid and î (green) ĵ (red)
  function gridView(ox, oy, s, ext, n = 2) {
    const bd = board(ox, oy, s, ext);
    const base = [];
    for (let k = -n; k <= n; k++) base.push([k, -n], [k, n], [-n, k], [n, k]);
    const geo = new THREE.BufferGeometry().setFromPoints(base.map(() => V3(0, 0, 0)));
    lab.world.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#4b9ee2' })));
    const iA = arrow('#2fc092', 0.06), jA = arrow('#d64545', 0.06);
    const li = tag('î', 'idx', 0, 0), lj = tag('ĵ', 'idx', 0, 0);
    function apply(M) {
      const pos = geo.attributes.position;
      base.forEach(([x, y], k) => { const p = bd.P(M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y); pos.setXYZ(k, p.x, p.y, 0.03); });
      pos.needsUpdate = true; geo.computeBoundingSphere();
      const O = bd.P(0, 0).setZ(0.08), pi = bd.P(M[0][0], M[1][0]).setZ(0.08), pj = bd.P(M[0][1], M[1][1]).setZ(0.08);
      setArrow(iA, O, pi); setArrow(jA, O, pj);
      li.position.set(pi.x + 0.25, pi.y + 0.2, 0.1); lj.position.set(pj.x + 0.25, pj.y + 0.2, 0.1);
    }
    apply(I2);
    return { bd, apply };
  }
  const rot = (th) => [[Math.cos(th), -Math.sin(th)], [Math.sin(th), Math.cos(th)]];
  const lerpM = (A, B, t) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * t));
  // animate the grid from matrix `from` to `M·from` (rotations turn by angle, others interpolate)
  async function animT(tok, gv, M, from, ms = 1400) {
    const P = TRANS.find((p) => eqM(p.M, M));
    await anim(tok, ms, (t) => gv.apply(matMul(P && P.rot !== undefined ? rot(P.rot * t) : lerpM(I2, M, t), from)));
    return matMul(M, from);
  }
  const TRANS = [
    { id: 'rot', name: '旋轉 90°', M: [[0, -1], [1, 0]], rot: Math.PI / 2 },
    { id: 'shear', name: 'Shear [1 1; 0 1]', M: [[1, 1], [0, 1]] },
    { id: 'scale', name: '伸縮 [2 0; 0 1]', M: [[2, 0], [0, 1]] },
    { id: 'flip', name: '對 y = x 鏡射', M: [[0, 1], [1, 0]] },
    { id: 'proj', name: '投影到 x 軸', M: [[1, 0], [0, 0]] },
    { id: 'rot45', name: '旋轉 45°', M: rot(Math.PI / 4), rot: Math.PI / 4 },
  ];

  // ───────────────────────── 模式 1：四種乘法 ─────────────────────────
  const mm = { A: [[2, 1], [1, 3]], B: [[1, 0, 2], [1, 1, -1]], way: 'entry', k: 0 };
  const WAYS = { entry: '列 · 行（一格一格）', col: '行的組合（A × B 的每一行）', row: '列的組合（A 的每一列 × B）', outer: '行 × 列 再相加' };
  function enterMult() {
    fresh([0, 3.2, 11.5], [0, 3.2, 0]);
    const m = mm.A.length, n = mm.B.length, p = mm.B[0].length;
    mm.k = 0; mm.C = matMul(mm.A, mm.B);
    mm.mA = mview(mm.A, -4.2, 3.4, { name: 'A（' + m + '×' + n + '）', s: 0.85 });
    mm.mB = mview(mm.B, -0.6, 3.4, { name: 'B（' + n + '×' + p + '）', s: 0.85, color: COL.b });
    tag('×', 'val', -2.5, 3.4); tag('=', 'val', 1.6, 3.4);
    mm.mC = mview(mm.C.map((r) => r.map(() => 0)), 3.9, 3.4, { name: 'C（' + m + '×' + p + '）', s: 0.85, hideZero: true, colorOf: (v) => (Math.abs(v) > 1e-9 ? COL.c : '#ece3d3') });
    controls('<select id="mWay">' + Object.keys(WAYS).map((k) => '<option value="' + k + '">' + WAYS[k] + '</option>').join('') + '</select><button class="primary" id="mStep">下一步</button><button id="mAll">自動跑完</button><button id="mNew">隨機矩陣</button>');
    $('mWay').value = mm.way;
    $('mWay').onchange = (e) => { mm.way = e.target.value; enterMult(); };
    on('mStep', () => runOp(() => multStep()));
    on('mAll', () => runOp(async () => { while (mm.k < multTotal()) await multStep(); }));
    on('mNew', () => {
      const m2 = rint(2, 3), n2 = rint(2, 3), p2 = rint(2, 3);
      mm.A = Array.from({ length: m2 }, () => Array.from({ length: n2 }, () => rint(-2, 3)));
      mm.B = Array.from({ length: n2 }, () => Array.from({ length: p2 }, () => rint(-2, 3)));
      enterMult();
    });
    log('同一個乘積，四種看法：' + WAYS[mm.way]);
    multState('按「下一步」');
  }
  const multTotal = () => (mm.way === 'entry' ? mm.C.length * mm.C[0].length : mm.way === 'col' ? mm.C[0].length : mm.way === 'row' ? mm.C.length : mm.B.length);
  async function multStep() {
    const { A, B, C, mA, mB, mC } = mm, n = B.length;
    if (mm.k >= multTotal()) { log('已經乘完了。換一種看法或按「隨機矩陣」。', true); return; }
    const k = mm.k++;
    mA.unglow(); mB.unglow(); mC.unglow();
    if (mm.way === 'entry') {
      const i = Math.floor(k / C[0].length), j = k % C[0].length;
      mA.glowRow(i, GOLD); mB.glowCol(j, GOLD);
      const terms = A[i].map((a, t) => fmt(a) + '·' + fmt(B[t][j]));
      await ghostFly(undefined, C[i][j], mA.X(n - 1) + 0.4, mA.Y(i), mC.X(j), mC.Y(i), 600);
      mC.set(i, j, C[i][j]); mC.glowCell(i, j, GREEN);
      multState('c' + sub(i + 1) + sub(j + 1) + ' = ' + terms.join(' + ') + ' = ' + fmt(C[i][j]));
    } else if (mm.way === 'col') {
      const j = k; mB.glowCol(j, GOLD);
      for (let t = 0; t < n; t++) { mA.glowCol(t, GOLD); for (let i = 0; i < A.length; i++) mC.set(i, j, mC.v[i][j] + A[i][t] * B[t][j]); await W(undefined, 450); mA.glowCol(t, null); }
      mC.glowCol(j, GREEN);
      multState('C 第 ' + (j + 1) + ' 行 = ' + comb(B.map((r) => r[j]), B.map((_, t) => '(A 第 ' + (t + 1) + ' 行)')));
    } else if (mm.way === 'row') {
      const i = k; mA.glowRow(i, GOLD);
      for (let t = 0; t < n; t++) { mB.glowRow(t, GOLD); for (let j = 0; j < C[0].length; j++) mC.set(i, j, mC.v[i][j] + A[i][t] * B[t][j]); await W(undefined, 450); mB.glowRow(t, null); }
      mC.glowRow(i, GREEN);
      multState('C 第 ' + (i + 1) + ' 列 = ' + comb(A[i], A[i].map((_, t) => '(B 第 ' + (t + 1) + ' 列)')));
    } else {
      const t = k; mA.glowCol(t, GOLD); mB.glowRow(t, GOLD);
      for (let i = 0; i < A.length; i++) for (let j = 0; j < C[0].length; j++) mC.set(i, j, mC.v[i][j] + A[i][t] * B[t][j]);
      mC.cells.flat().forEach((c) => glow(c, GREEN));
      multState('加上 (A 第 ' + (t + 1) + ' 行)(B 第 ' + (t + 1) + ' 列)：一個 rank-1 矩陣');
    }
    if (mm.k >= multTotal()) log('完成：C = ' + mstr(C));
  }
  function multState(f) {
    const m = mm.A.length, n = mm.B.length, p = mm.B[0].length;
    setState('AB 的看法：' + WAYS[mm.way], [['A', m + '×' + n], ['B', n + '×' + p], ['C = AB', m + '×' + p], ['進度', mm.k + ' / ' + multTotal()]],
      f + '<br>A 的行數 = B 的列數 = ' + n + ' 才能乘');
  }

  // ───────────────────────── 模式 2：Gauss-Jordan 求反矩陣 ─────────────────────────
  const gj = { A: [[1, 3], [2, 7]], plan: null, k: 0, mv: null };
  function unitInv(n) {
    for (;;) {
      const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : i > j ? rint(-2, 2) : 0)));
      const U = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? pick([1, -1]) : j > i ? rint(-2, 2) : 0)));
      let A = matMul(L, U);
      if (Math.random() < 0.3) A = [A[1], A[0], ...A.slice(2)];
      if (Math.max(...A.flat().map(Math.abs)) <= 9) return A;
    }
  }
  function enterGJ() {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const n = gj.A.length;
    const M = gj.A.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
    gj.plan = planElim(M, n, true); gj.k = 0;
    gj.mv = mview(M, 0, 3.5, { aug: n, name: '[A | I]', s: 0.95 });
    gj.lab = tag('', 'ptr alt', gj.mv.X(n + (n - 1) / 2), gj.mv.Y(n - 1) - 0.9);
    controls('<button class="primary" id="gStep">下一步</button><button id="gAll">自動跑完</button><button id="gStrang">Strang 例 [1 3; 2 7]</button><button id="gNew2">隨機 2×2</button><button id="gNew3">隨機 3×3</button><button id="gSing">singular [1 3; 2 6]</button>');
    on('gStep', () => runOp(() => gjStep()));
    on('gAll', () => runOp(async () => { while (gj.k <= gj.plan.steps.length) await gjStep(); }));
    on('gStrang', () => { gj.A = [[1, 3], [2, 7]]; enterGJ(); });
    on('gNew2', () => { gj.A = unitInv(2); enterGJ(); });
    on('gNew3', () => { gj.A = unitInv(3); enterGJ(); });
    on('gSing', () => { gj.A = [[1, 3], [2, 6]]; enterGJ(); });
    log('Gauss-Jordan：對 [A | I] 做列運算直到左半變 I，右半就是 A⁻¹。');
    gjState();
  }
  async function gjStep() {
    const n = gj.A.length, steps = gj.plan.steps;
    if (gj.k < steps.length) { const st = steps[gj.k++]; await doStep(undefined, gj.mv, st, 850); log(stepLog(st)); }
    else if (gj.k === steps.length) {
      gj.k++;
      if (gj.plan.rank < n) { txt(gj.lab, '左半出現全 0 列 → 不可逆'); say('沒有 ' + n + ' 個 pivot', 'A 是 singular，沒有反矩陣'); log('左半變不成 I：A 不可逆（singular）。', true); }
      else {
        const inv = gj.mv.v.map((r) => r.slice(n));
        txt(gj.lab, 'A⁻¹ = ' + mstr(inv));
        for (let i = 0; i < n; i++) for (let j = n; j < 2 * n; j++) gj.mv.glowCell(i, j, GREEN);
        const ok = eqM(matMul(inv, gj.A), gj.A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))));
        say('右半就是 A⁻¹', ok ? 'A⁻¹A = I ✓' : '檢查失敗');
        log('檢查 A⁻¹A = I：' + (ok ? '成立' : '不成立'), !ok);
      }
    } else log('已經做完了。按「隨機」再來一題。', true);
    gjState();
  }
  const stepLog = (st) => st.t === 'swap' ? '換列 R' + sub(st.a + 1) + ' ↔ R' + sub(st.b + 1) : st.t === 'pivot' ? 'pivot = ' + fmt(st.v) : st.t === 'sub' ? opStr(st.tg, st.s, st.k) : st.t === 'scale' ? 'R' + sub(st.r + 1) + ' ÷ ' + fmt(st.k) : '第 ' + (st.c + 1) + ' 行沒有 pivot';
  function gjState() {
    const n = gj.A.length, tot = gj.plan.steps.length + 1;
    setState('Gauss-Jordan：[A | I] → [I | A⁻¹]', [['A', mstr(gj.A)], ['步驟', Math.min(gj.k, tot) + ' / ' + tot], ['pivots', String(gj.plan.rank) + ' / ' + n]],
      'E[A | I] = [EA | E]；EA = I ⇒ <span class="ok">E = A⁻¹</span>' + (gj.plan.rank < n ? '<br><span class="no">pivot 不足：singular</span>' : ''));
  }

  // ───────────────────────── 模式 3：合成變換 ─────────────────────────
  const cp = { a: 'shear', b: 'rot' };
  function enterCompose() {
    fresh([0, 3.2, 10.5], [0, 3.2, 0]);
    cp.gv = gridView(0, 3.2, 0.68, 4, 2);
    const opt = TRANS.map((t) => '<option value="' + t.id + '">' + t.name + '</option>').join('');
    controls('先 B：<select id="cB">' + opt + '</select> 再 A：<select id="cA">' + opt + '</select><button class="primary" id="cAB">播放 AB（先 B 再 A）</button><button id="cBA">播放 BA（先 A 再 B）</button>');
    $('cA').value = cp.a; $('cB').value = cp.b;
    $('cA').onchange = (e) => { cp.a = e.target.value; enterCompose(); };
    $('cB').onchange = (e) => { cp.b = e.target.value; enterCompose(); };
    const A = TRANS.find((t) => t.id === cp.a).M, B = TRANS.find((t) => t.id === cp.b).M;
    const play = (first, second, nm) => runOp(async () => {
      cp.gv.apply(I2); await W(undefined, 300);
      const m1 = await animT(undefined, cp.gv, first, I2, 1100);
      await W(undefined, 300);
      const m2 = await animT(undefined, cp.gv, second, m1, 1100);
      log(nm + ' = ' + mstr(m2) + '：î 落在 (' + fmt(m2[0][0]) + ', ' + fmt(m2[1][0]) + ')、ĵ 落在 (' + fmt(m2[0][1]) + ', ' + fmt(m2[1][1]) + ')');
    });
    on('cAB', () => play(B, A, 'AB'));
    on('cBA', () => play(A, B, 'BA'));
    const AB = matMul(A, B), BA = matMul(B, A);
    setState('矩陣乘法 = 合成變換', [['A', mstr(A)], ['B', mstr(B)], ['AB', mstr(AB)], ['BA', mstr(BA)]],
      'ABx = A(Bx)：<b>從右往左</b>讀，先 B 再 A<br>' + (eqM(AB, BA) ? '<span class="ok">這一對剛好 AB = BA</span>' : '<span class="no">AB ≠ BA：順序不能換</span>'));
    log('矩陣的兩行 = î、ĵ 變換後落在哪裡。');
  }

  // ───────────────────────── 模式 4：轉置與對稱 ─────────────────────────
  const tr = { A: [[1, 2, 3], [4, 5, 6]] };
  function enterTranspose() {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const A = tr.A, R = A.length, C = A[0].length;
    tr.mv = mview(A, -3.2, 3.4, { name: 'A（' + R + '×' + C + '）', s: 0.9 });
    const sym = R === C && eqM(A, T2(A));
    controls('<button class="primary" id="tFlip">轉置</button><button id="tRRT">RRᵀ（一定對稱）</button><button id="tNew">隨機矩陣</button><button id="tSym">隨機對稱矩陣</button>');
    on('tFlip', () => runOp(async () => {
      const B = T2(tr.A), g = gridXY(C, R, 3.2, 3.4, 0.9);
      if (tr.out) tr.out.kill();
      const ps = [];
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { tr.mv.glowCell(i, j, GOLD); ps.push(ghostFly(undefined, A[i][j], tr.mv.X(j), tr.mv.Y(i), g.X(i), g.Y(j), 800)); }
      await Promise.all(ps);
      tr.mv.unglow();
      tr.out = mview(B, 3.2, 3.4, { name: 'Aᵀ（' + C + '×' + R + '）', nameCls: 'ptr alt', s: 0.9, color: COL.b });
      log('(Aᵀ)ᵢⱼ = Aⱼᵢ：第 i 列變成第 i 行。' + (sym ? '這個 A 對稱：Aᵀ = A。' : ''));
    }));
    on('tRRT', () => { const Rm = tr.A; tr.A = matMul(Rm, T2(Rm)); log('R = ' + mstr(Rm) + '，RRᵀ 的 (i, j) = (R 第 i 列)·(R 第 j 列) = (j, i)，所以對稱。'); enterTranspose(); });
    on('tNew', () => { const r = rint(2, 3), c = rint(2, 3); tr.A = Array.from({ length: r }, () => Array.from({ length: c }, () => rint(-3, 5))); enterTranspose(); });
    on('tSym', () => { const n = rint(2, 3), S = Array.from({ length: n }, () => Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = i; j < n; j++) S[i][j] = S[j][i] = rint(-3, 5); tr.A = S; enterTranspose(); });
    if (sym) for (let i = 0; i < R; i++) for (let j = i + 1; j < C; j++) { tr.mv.glowCell(i, j, GREEN); tr.mv.glowCell(j, i, GREEN); }
    setState('轉置 Aᵀ', [['A', R + '×' + C], ['Aᵀ', C + '×' + R], ['對稱？', R !== C ? '不是方陣' : sym ? '是：Aᵀ = A' : '不是']],
      '(Aᵀ)ᵢⱼ = Aⱼᵢ；(AB)ᵀ = BᵀAᵀ；(A⁻¹)ᵀ = (Aᵀ)⁻¹<br>RᵀR、RRᵀ 永遠對稱');
  }

  // ───────────────────────── 模式 5：Permutation matrix ─────────────────────────
  const ORD = [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2], [2, 3, 1], [3, 1, 2]];
  const ORDN = ['I', 'P₁₂', 'P₁₃', 'P₂₃', '列序 231', '列序 312'];
  const Pof = (o) => o.map((r) => [1, 2, 3].map((c) => (c === r ? 1 : 0)));
  const pm = { p: 1, A: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] };
  function enterPerm() {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const P = Pof(ORD[pm.p]);
    pm.mP = mview(P, -3.4, 3.4, { name: ORDN[pm.p], s: 0.8, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') });
    pm.mA = mview(pm.A, 0.6, 3.4, { name: 'A', s: 0.8, color: COL.b });
    pm.res = tag('', 'ptr alt', 0.6, 1.6);
    controls('<select id="pP">' + ORD.map((o, k) => '<option value="' + k + '">' + ORDN[k] + '</option>').join('') + '</select><button class="primary" id="pPA">PA（換列）</button><button id="pAP">AP（換行）</button><button id="pT">Pᵀ 與 PᵀP</button><button id="pReset">還原 A</button>');
    $('pP').value = String(pm.p);
    $('pP').onchange = (e) => { pm.p = +e.target.value; enterPerm(); };
    on('pReset', () => enterPerm());
    on('pPA', () => runOp(async () => {
      const o = ORD[pm.p], mv = pm.mA, cells = mv.cells.map((r) => r.slice()), v = mv.v.map((r) => r.slice());
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) move(cells[o[i] - 1][j], mv.X(j), mv.Y(i), 0.3);
      await W(undefined, 800);
      for (let i = 0; i < 3; i++) { mv.cells[i] = cells[o[i] - 1]; mv.v[i] = v[o[i] - 1]; for (let j = 0; j < 3; j++) move(mv.cells[i][j], mv.X(j), mv.Y(i), 0); }
      txt(mv.nameL, 'PA'); txt(pm.res, 'PA 的第 i 列 = A 的第 ' + o.join('、') + ' 列');
      log('左乘 P 重排「列」：PA 的第 1、2、3 列 = A 的第 ' + o.join('、') + ' 列。');
    }));
    on('pAP', () => runOp(async () => {
      const o = ORD[pm.p], mv = pm.mA, cells = mv.cells.map((r) => r.slice()), v = mv.v.map((r) => r.slice());
      // column k of A goes to column o[k] − 1 of AP
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) move(cells[i][k], mv.X(o[k] - 1), mv.Y(i), 0.3);
      await W(undefined, 800);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { mv.cells[i][o[k] - 1] = cells[i][k]; mv.v[i][o[k] - 1] = v[i][k]; move(cells[i][k], mv.X(o[k] - 1), mv.Y(i), 0); }
      txt(mv.nameL, 'AP'); txt(pm.res, '右乘 P：重排「行」');
      log('右乘 P：A 的第 k 行搬到第 ' + o.join('、') + ' 行（依 k = 1, 2, 3）。');
    }));
    on('pT', () => runOp(async () => {
      if (pm.tv) pm.tv.kill();
      pm.tv = mview(T2(P), 4.2, 3.4, { name: 'Pᵀ', nameCls: 'ptr alt', s: 0.8, hideZero: true, colorOf: (v) => (v ? COL.l : '#ece3d3') });
      txt(pm.res, 'PᵀP = I → P⁻¹ = Pᵀ');
      log('PᵀP = ' + mstr(matMul(T2(P), P)) + ' = I，所以 P⁻¹ = Pᵀ' + (eqM(P, T2(P)) ? '（這個 P 對稱，P⁻¹ = P）' : '（這個 P 不對稱，P⁻¹ ≠ P）'));
    }));
    setState('Permutation matrix ' + ORDN[pm.p], [['P', mstr(P)], ['列序', ORD[pm.p].join(' ')], ['對稱？', eqM(P, T2(P)) ? '是（P⁻¹ = P）' : '否']],
      'PA 換列、AP 換行；P⁻¹ = Pᵀ<br>n×n 的 P 共 n! 個');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  function genQ() {
    const kind = rnd(8);
    if (kind === 0) {
      const A = [[rint(-2, 4), rint(-2, 4), rint(-2, 4)], [rint(-2, 4), rint(-2, 4), rint(-2, 4)]], B = [[rint(-2, 4), rint(-2, 4)], [rint(-2, 4), rint(-2, 4)], [rint(-2, 4), rint(-2, 4)]];
      const i = rnd(2), j = rnd(2), C = matMul(A, B), ans = String(C[i][j]);
      const wrong = [C[1 - i][j], C[i][1 - j], A[i][0] * B[0][j] + A[i][1] * B[1][j], C[i][j] + 1, C[i][j] - 2].map(String);
      const opts = [...new Set([ans, ...wrong])].slice(0, 4);
      return { q: 'A = ' + mstr(A) + '，B = ' + mstr(B) + '。(AB) 的 (' + (i + 1) + ', ' + (j + 1) + ') 元素？', opts, ans, why: '(A 第 ' + (i + 1) + ' 列)·(B 第 ' + (j + 1) + ' 行) = ' + A[i].map((a, t) => a + '·' + B[t][j]).join(' + ') + ' = ' + ans + '。' };
    }
    if (kind === 1) {
      const m = rint(1, 5), n = rint(2, 5), p = rint(1, 5), ok = Math.random() < 0.65, n2 = ok ? n : n + pick([1, -1]);
      const ans = ok ? m + '×' + p : '不能相乘';
      const opts = [...new Set([ans, n + '×' + n2, p + '×' + m, '不能相乘', m + '×' + n2])].slice(0, 4);
      if (!opts.includes(ans)) opts[0] = ans;
      return { q: 'A 是 ' + m + '×' + n + '，B 是 ' + n2 + '×' + p + '。AB 的大小？', opts, ans, why: ok ? 'A 的行數 ' + n + ' = B 的列數 ' + n2 + '，結果是 (A 的列數)×(B 的行數) = ' + ans + '。' : 'A 的行數 ' + n + ' ≠ B 的列數 ' + n2 + '，不能乘。' };
    }
    if (kind === 2) {
      const A = unitInv(2), d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      const inv = [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]], ans = mstr(inv);
      const opts = [...new Set([ans, mstr([[A[1][1], A[0][1]], [A[1][0], A[0][0]]]), mstr(T2(A)), mstr([[-inv[0][0], inv[0][1]], [inv[1][0], -inv[1][1]]])])].slice(0, 4);
      if (opts.length < 4) opts.push(mstr([[A[0][0], -A[0][1]], [-A[1][0], A[1][1]]]));
      return { q: 'A = ' + mstr(A) + '，A⁻¹ = ？', opts: [...new Set(opts)].slice(0, 4), ans, why: 'ad − bc = ' + d + '；A⁻¹ = (1/(ad−bc))·[d −b; −c a]。可用 A·A⁻¹ = I 驗算，或做 Gauss-Jordan。' };
    }
    if (kind === 3) {
      const f = pick([['(AB)ᵀ', 'BᵀAᵀ', 'AᵀBᵀ'], ['(AB)⁻¹', 'B⁻¹A⁻¹', 'A⁻¹B⁻¹'], ['(ABC)ᵀ', 'CᵀBᵀAᵀ', 'AᵀBᵀCᵀ'], ['(Aᵀ)⁻¹', '(A⁻¹)ᵀ', '−A']]);
      return { q: '（A、B、C 都可逆的方陣）' + f[0] + ' = ？', opts: [f[1], f[2], f[0].replace(/[ᵀ⁻¹]+$/, ''), '不一定能化簡'], ans: f[1], why: '轉置和反矩陣碰到乘積都要「反序」。' };
    }
    if (kind === 4) {
      const c = [rint(1, 5), rint(1, 5), rint(1, 5)], r = [rint(1, 6), rint(1, 6)], i = rnd(3), j = rnd(2);
      const ans = String(c[i] * r[j]);
      const opts = [...new Set([ans, String(c[i] + r[j]), String(c[(i + 1) % 3] * r[j]), String(c[i] * r[1 - j]), String(c.reduce((s, x) => s + x, 0) * r[j])])].slice(0, 4);
      return { q: '行 (' + c.join(', ') + ') 乘列 (' + r.join(', ') + ')，結果的 (' + (i + 1) + ', ' + (j + 1) + ') 元素？這個矩陣的 rank？', opts: opts.map((o) => o + '；rank 1'), ans: ans + '；rank 1', why: '行×列 = 3×2 矩陣，(i, j) = cᵢ·rⱼ = ' + c[i] + '·' + r[j] + '；每一行都是 (' + c.join(', ') + ') 的倍數 → rank 1。' };
    }
    if (kind === 5) {
      const items = [['AB = AC 且 A ≠ 0 ⇒ B = C', false], ['AB = 0 ⇒ A = 0 或 B = 0', false], ['A² = A ⇒ A = I 或 A = 0', false], ['AB = BA 對所有方陣成立', false], ['(AB)C = A(BC)', true], ['A(B + C) = AB + AC', true]];
      const tru = pick(items.filter((x) => x[1])), fs = items.filter((x) => !x[1]).sort(() => Math.random() - 0.5).slice(0, 3);
      return { q: '下列哪一個「一定成立」？', opts: [tru[0], ...fs.map((x) => x[0])], ans: tru[0], why: '結合律、分配律成立；交換律、消去律都不成立。反例：A = [1 1; 1 1]、B = [1 −1; −1 1] 有 AB = 0；A = [1 0; 0 0] 有 A² = A。' };
    }
    if (kind === 6) {
      const n = pick([2, 3]);
      return { q: '對 [A | I]（' + n + '×' + (2 * n) + '）做列運算，左半變成 I 時，右半是？', opts: ['A⁻¹', 'Aᵀ', 'A', 'det(A)·I'], ans: 'A⁻¹', why: '所有列運算合起來是 E：E[A | I] = [EA | E]，EA = I ⇒ E = A⁻¹。' };
    }
    const pair = pick([['旋轉 90° [0 −1; 1 0]', [[0, -1], [1, 0]], 'shear [1 1; 0 1]', [[1, 1], [0, 1]]], ['shear [1 1; 0 1]', [[1, 1], [0, 1]], '旋轉 90° [0 −1; 1 0]', [[0, -1], [1, 0]]], ['伸縮 [2 0; 0 1]', [[2, 0], [0, 1]], '旋轉 90° [0 −1; 1 0]', [[0, -1], [1, 0]]]]);
    const [n1, M1, n2, M2] = pair, ans = mstr(matMul(M2, M1)), wrong = mstr(matMul(M1, M2));
    const opts = [...new Set([ans, wrong, mstr(lerpM(M1, M2, 1)), mstr(T2(matMul(M2, M1))), mstr([[1, 0], [0, 1]])])].slice(0, 4);
    return { q: '先做 ' + n1 + '，再做 ' + n2 + '。合成的矩陣是？', opts, ans, why: '先做的放右邊：(' + n2.split(' ')[0] + ')·(' + n1.split(' ')[0] + ') = ' + ans + '；順序反過來會得到 ' + wrong + '。' };
  }

  // ═════════════════════════ 場景：MIT 18.06 L3（Multiplication and Inverse Matrices） ═════════════════════════
  const EA = [[1, 0, 2], [2, 1, 1], [2, 1, 3]], EB = [[1, 0, 2, 1], [0, 1, 1, 2], [1, 1, 0, 1]];
  async function scEntry(tok) {
    fresh([0, 3.2, 12], [0, 3.2, 0]);
    const C = matMul(EA, EB);
    const mA = mview(EA, -4.7, 3.4, { name: 'A', s: 0.72 }), mB = mview(EB, -0.9, 3.4, { name: 'B', s: 0.72, color: COL.b });
    tag('×', 'val', -3.05, 3.4); tag('=', 'val', 1.05, 3.4);
    const mC = mview(C.map((r) => r.map(() => 0)), 3.9, 3.4, { name: 'C = AB', nameCls: 'ptr alt', s: 0.72, hideZero: true, colorOf: (v) => (Math.abs(v) > 1e-9 ? COL.c : '#ece3d3') });
    say('C 的 (3,4) 元素從哪來？', 'c₃₄：第 3 列、第 4 行');
    mC.glowCell(2, 3, GOLD);
    await W(tok, 2200);
    mA.glowRow(2, GOLD); mB.glowCol(3, GOLD);
    say('A 的第 3 列 · B 的第 4 行', 'c₃₄ = (row 3 of A) · (column 4 of B)');
    await W(tok, 2200);
    let acc = 0;
    for (let k = 0; k < 3; k++) {
      mA.glowCell(2, k, GREEN); mB.glowCell(k, 3, GREEN);
      acc += EA[2][k] * EB[k][3];
      say('a₃' + sub(k + 1) + ' × b' + sub(k + 1) + '₄ = ' + EA[2][k] + ' × ' + EB[k][3], '累加 = ' + acc);
      await ghostFly(tok, EA[2][k] * EB[k][3], mA.X(k), mA.Y(2), mC.X(3), mC.Y(2), 900);
      mA.glowCell(2, k, GOLD); mB.glowCell(k, 3, GOLD);
    }
    mC.set(2, 3, C[2][3]); mC.glowCell(2, 3, GREEN);
    say('c₃₄ = Σₖ a₃ₖ bₖ₄ = 7', '2·1 + 1·2 + 3·1 = 7');
    await W(tok, 2600);
    mA.unglow(); mB.unglow(); mC.unglow();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { mC.set(i, j, C[i][j]); await W(tok, 160); }
    say('每一格都是「一列 · 一行」', 'cᵢⱼ = Σₖ aᵢₖ bₖⱼ');
    await W(tok, 2600);
  }
  async function scShapes(tok) {
    fresh([0, 3.4, 11], [0, 3, 0]);
    const u = 0.62;
    const slab = (r, c, color, x, y, name) => { const m = lab.box(color, [c * u, r * u, 0.3]); m.position.set(x, y, 0); lab.world.add(m); tag(name, 'ptr', x, y + r * u / 2 + 0.35); return m; };
    say('A 是 m × n：m 列、n 行', '這裡 m = 3、n = 4');
    const A = slab(3, 4, COL.a, -4.2, 3.2, 'A：3×4');
    await W(tok, 2000);
    const B = slab(4, 2, COL.b, -0.6, 3.2, 'B：4×2');
    tag('×', 'val', -2.2, 3.2);
    say('B 的列數必須 = A 的行數 n', 'A 一列有 4 個，B 一行也要有 4 個');
    glow(A, GREEN); glow(B, GREEN);
    tag('n = 4', 'idx', -4.2, 3.2 - 1.5 * u - 0.35); tag('n = 4', 'idx', -0.6 - 1.3, 3.2);
    await W(tok, 2600);
    glow(A, null); glow(B, null);
    tag('=', 'val', 0.9, 3.2);
    const C = slab(3, 2, COL.c, 2.6, 3.2, 'C：3×2');
    say('結果是 m × p', '3×4 乘 4×2 → 3×2');
    await W(tok, 2200);
    say('m × p 個格子，每格一個長度 n 的內積', '共 3·2 = 6 格，每格 4 次乘法');
    glow(C, GOLD);
    await W(tok, 2400);
    glow(C, null);
    const Bad = slab(3, 2, COL.red, 5.6, 3.2, 'B′：3×2');
    say('A（3×4）× B′（3×2）？', '4 ≠ 3：<span class="no">不能乘</span>');
    glow(A, REDG); glow(Bad, REDG);
    await W(tok, 2800);
  }
  const CA = [[2, 1], [1, 3]], CB = [[1, 0, 2], [1, 1, -1]];
  async function scColumns(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const C = matMul(CA, CB);
    const mA = mview(CA, -4, 3.4, { name: 'A', s: 0.9 }), mB = mview(CB, -0.6, 3.4, { name: 'B', s: 0.9, color: COL.b });
    tag('×', 'val', -2.6, 3.4); tag('=', 'val', 1.5, 3.4);
    const mC = mview(C.map((r) => r.map(() => 0)), 3.7, 3.4, { name: 'C', nameCls: 'ptr alt', s: 0.9, hideZero: true, colorOf: (v) => (Math.abs(v) > 1e-9 ? COL.c : '#ece3d3') });
    say('第二種：一次看 B 的一整行', 'A × (B 的第 j 行) = C 的第 j 行');
    await W(tok, 2400);
    for (let j = 0; j < 3; j++) {
      mB.glowCol(j, GOLD);
      for (let t = 0; t < 2; t++) {
        mA.glowCol(t, GREEN);
        await Promise.all([0, 1].map((i) => ghostFly(tok, CA[i][t] * CB[t][j], mA.X(t), mA.Y(i), mC.X(j), mC.Y(i), 700)));
        for (let i = 0; i < 2; i++) mC.set(i, j, mC.v[i][j] + CA[i][t] * CB[t][j]);
        mA.glowCol(t, null);
      }
      say('C 第 ' + (j + 1) + ' 行 = A 兩行的組合', comb([CB[0][j], CB[1][j]], ['(A 第1行)', '(A 第2行)']) + ' = (' + C[0][j] + ', ' + C[1][j] + ')');
      await W(tok, 1500);
      mB.glowCol(j, null);
    }
    say('C 的每一行都是 A 的行的組合', 'B 的數字決定怎麼組合');
    await W(tok, 2800);
  }
  async function scRows(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const C = matMul(CA, CB);
    const mA = mview(CA, -4, 3.4, { name: 'A', s: 0.9 }), mB = mview(CB, -0.6, 3.4, { name: 'B', s: 0.9, color: COL.b });
    tag('×', 'val', -2.6, 3.4); tag('=', 'val', 1.5, 3.4);
    const mC = mview(C.map((r) => r.map(() => 0)), 3.7, 3.4, { name: 'C', nameCls: 'ptr alt', s: 0.9, hideZero: true, colorOf: (v) => (Math.abs(v) > 1e-9 ? COL.c : '#ece3d3') });
    say('第三種：一次看 A 的一整列', '(A 的第 i 列) × B = C 的第 i 列');
    await W(tok, 2400);
    for (let i = 0; i < 2; i++) {
      mA.glowRow(i, GOLD);
      for (let t = 0; t < 2; t++) {
        mB.glowRow(t, GREEN);
        await Promise.all([0, 1, 2].map((j) => ghostFly(tok, CA[i][t] * CB[t][j], mB.X(j), mB.Y(t), mC.X(j), mC.Y(i), 700)));
        for (let j = 0; j < 3; j++) mC.set(i, j, mC.v[i][j] + CA[i][t] * CB[t][j]);
        mB.glowRow(t, null);
      }
      say('C 第 ' + (i + 1) + ' 列 = B 兩列的組合', comb(CA[i], ['(B 第1列)', '(B 第2列)']) + ' = (' + C[i].join(', ') + ')');
      await W(tok, 1600);
      mA.glowRow(i, null);
    }
    say('C 的每一列都是 B 的列的組合', '左乘 A = 把 B 的列混合');
    await W(tok, 2800);
  }
  async function scOuter(tok) {
    fresh([0, 3.4, 11.5], [0, 3.2, 0]);
    const c = mview([[2], [3], [4]], -4.6, 3.4, { name: '行 (2,3,4)', s: 0.85 }), r = mview([[1, 6]], -2.4, 5.0, { name: '列 (1,6)', s: 0.85, color: COL.b });
    const P = mview([[0, 0], [0, 0], [0, 0]], -2.4, 3.0, { name: '', s: 0.85, hideZero: true, colorOf: (v) => (Math.abs(v) > 1e-9 ? COL.c : '#ece3d3') });
    say('第四種：行 × 列（不是列 × 行）', '(3×1)(1×2) = 3×2 的整個矩陣');
    await W(tok, 2400);
    const vals = [[2, 12], [3, 18], [4, 24]];
    for (let i = 0; i < 3; i++) {
      c.glowCell(i, 0, GOLD);
      for (let j = 0; j < 2; j++) { r.glowCell(0, j, GOLD); P.set(i, j, vals[i][j]); P.glowCell(i, j, GREEN); await W(tok, 420); r.glowCell(0, j, null); }
      say('第 ' + (i + 1) + ' 列：' + (i + 2) + ' × (1, 6)', '= (' + vals[i].join(', ') + ')');
      await W(tok, 700); c.glowCell(i, 0, null);
    }
    P.unglow();
    say('每一行都是 (2,3,4) 的倍數', '每一列都是 (1,6) 的倍數');
    await W(tok, 2400);
    // row space: all rows on the line through (1, 6)
    const o = V3(2.2, 1.2, 0), sc = 0.17;
    const ln = rod('#c9b48e', 0.03); setRod(ln, o.clone().add(V3(-0.3 * sc * 1, -0.3 * sc * 6, 0)), o.clone().add(V3(4.6 * sc, 27.6 * sc, 0)));
    [[1, 6, COL.b], [2, 12, COL.c], [3, 18, COL.c], [4, 24, COL.c]].forEach(([x, y, col]) => { const d = dot(col, 0.12); d.position.copy(o).add(V3(x * sc, y * sc, 0.05)); });
    tag('row space：過 (1, 6) 的一條線', 'ptr alt', 4.6, 3.4);
    say('所有列都在同一條線上', 'row space = 過 (1,6) 的直線；column space = 過 (2,3,4) 的直線');
    await W(tok, 3000);
    say('AB = Σ (A 第 k 行)(B 第 k 列)', '[2 7; 3 8; 4 9]·[1 6; 0 0] = (2,3,4)(1,6) + (7,8,9)(0,0)');
    await W(tok, 3400);
  }
  async function scBlocks(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const t = (s, color, x, y) => cube(s, color, [1.1, 1.1, 0.4], x, y, 0);
    const A = [['A₁', -4.9, 4.0], ['A₂', -3.7, 4.0], ['A₃', -4.9, 2.8], ['A₄', -3.7, 2.8]].map(([s, x, y]) => t(s, COL.a, x, y));
    const B = [['B₁', -1.0, 4.0], ['B₂', 0.2, 4.0], ['B₃', -1.0, 2.8], ['B₄', 0.2, 2.8]].map(([s, x, y]) => t(s, COL.b, x, y));
    tag('×', 'val', -2.35, 3.4); tag('=', 'val', 1.4, 3.4);
    const C1 = cube('?', COL.c, [2.0, 1.1, 0.4], 3.6, 4.0, 0);
    cube('', '#ece3d3', [2.0, 1.1, 0.4], 3.6, 2.8, 0);
    say('把矩陣切成方塊（例：20×20 切成 10×10）', '大小要能對上');
    await W(tok, 2600);
    glow(A[0], GOLD); glow(A[1], GOLD); glow(B[0], GOLD); glow(B[2], GOLD); glow(C1, GOLD);
    say('左上那塊 = A 的上方塊列 × B 的左方塊行', '像數字一樣「列 × 行」');
    await W(tok, 2400);
    glow(A[1], null); glow(B[2], null); glow(A[0], GREEN); glow(B[0], GREEN);
    relabel(C1, 'A₁B₁');
    say('A₁B₁（矩陣乘矩陣）', '');
    await W(tok, 1600);
    glow(A[0], null); glow(B[0], null); glow(A[1], GREEN); glow(B[2], GREEN);
    relabel(C1, 'A₁B₁ + A₂B₃');
    say('再加 A₂B₃', 'C₁ = A₁B₁ + A₂B₃');
    await W(tok, 2600);
    say('五種看法做的都是同一批乘法', '一格一格、行、列、行×列、方塊');
    await W(tok, 2600);
  }
  async function scInvDef(tok) {
    fresh([0, 3.4, 11], [0, 2.6, 0]);
    say('方陣 A 不一定有反矩陣', '最重要的問題：可不可逆？');
    await W(tok, 2200);
    const row1 = [['A⁻¹', COL.b], ['A', COL.a], ['= I', '#e9dcc4']].map(([s, c], k) => cube(s, c, [1.2, 0.9, 0.9], -4.2 + k * 1.4, 3.6, 0, 3));
    say('若存在：A⁻¹A = I', '');
    await W(tok, 1800);
    const row2 = [['A', COL.a], ['A⁻¹', COL.b], ['= I', '#e9dcc4']].map(([s, c], k) => cube(s, c, [1.2, 0.9, 0.9], 1.4 + k * 1.4, 3.6, 0, 3));
    say('方陣的左反矩陣也是右反矩陣', 'AA⁻¹ = I 也成立');
    await W(tok, 2400);
    row1.concat(row2).forEach((m) => glow(m, GREEN));
    const rect = lab.box(COL.a, [0.6 * 2, 0.6 * 3, 0.3]); rect.position.set(0, 1.2, 0); lab.world.add(rect);
    tag('3×2 長方形矩陣', 'ptr', 0, 2.4);
    say('長方形矩陣：左反、右反不會同時存在', '形狀不允許（之後再談）');
    await W(tok, 2600);
    say('可逆 = invertible = nonsingular', '沒有反矩陣 = singular');
    await W(tok, 2400);
  }
  async function scSingular(tok) {
    fresh([0, 3.3, 11], [0, 3.2, 0]);
    const bd = board(0, 3.2, 0.45, 6);
    const O = bd.P(0, 0).setZ(0.08);
    say('A = [1 3; 2 6] 為什麼沒有反矩陣？', 'det = 1·6 − 3·2 = 0');
    await W(tok, 2400);
    const c1 = arrow(COL.a), c2 = arrow(COL.b);
    setArrow(c2, O.clone().setZ(0.05), bd.P(3, 6).setZ(0.05)); setArrow(c1, O.clone().setZ(0.12), bd.P(1, 2).setZ(0.12));
    tag('col₁ (1, 2)', 'ptr', ...bd.P(2.3, 1.6).toArray()); tag('col₂ (3, 6)', 'ptr', ...bd.P(4.3, 5.4).toArray());
    const ln = rod('#c9b48e', 0.03); setRod(ln, bd.P(-3, -6).setZ(0.02), bd.P(3, 6).setZ(0.02));
    say('兩行在同一條線上', 'A 乘任何矩陣，結果的行都在這條線上');
    await W(tok, 2600);
    const tgt = dot(COL.red, 0.15); tgt.position.copy(bd.P(1, 0)).setZ(0.1);
    tag('(1, 0) 到不了', 'ptr alt', ...bd.P(2.2, -0.8).toArray());
    say('I 的第一行 (1, 0) 不在線上', '→ 不可能 AX = I');
    await W(tok, 2600);
    say('更好的理由：找一個 x ≠ 0 讓 Ax = 0', 'x = (3, −1)');
    const a1 = arrow(COL.a, 0.045), a2 = arrow(COL.hot, 0.045);
    await anim(tok, 1200, (t) => setArrow(a1, O.clone().setZ(0.2), bd.P(3 * t, 6 * t).setZ(0.2)));
    say('3·col₁ = (3, 6)', '');
    await W(tok, 800);
    await anim(tok, 1200, (t) => setArrow(a2, bd.P(3, 6).setZ(0.25), bd.P(3 - 3 * t, 6 - 6 * t).setZ(0.25)));
    say('再減 1·col₂ → 回到原點', '3·col₁ − 1·col₂ = 0');
    await W(tok, 2200);
    say('若 A⁻¹ 存在會怎樣？', 'x = A⁻¹Ax = A⁻¹0 = 0，可是 x = (3, −1) ≠ 0 → 矛盾，沒有 A⁻¹');
    await W(tok, 3200);
  }
  async function scInvColumns(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const A = mview([[1, 3], [2, 7]], -3.6, 3.6, { name: 'A', s: 0.95 });
    tag('×', 'val', -2.2, 3.6);
    const X = mview([['a', 'c'], ['b', 'd']], -0.8, 3.6, { name: 'A⁻¹', s: 0.95, color: COL.b });
    tag('=', 'val', 0.6, 3.6);
    const Im = mview([[1, 0], [0, 1]], 2.0, 3.6, { name: 'I', s: 0.95, color: '#e9dcc4' });
    say('A = [1 3; 2 7]：兩行方向不同 → 可逆', 'det = 7 − 6 = 1 ≠ 0');
    await W(tok, 2600);
    X.glowCol(0, GOLD); Im.glowCol(0, GOLD);
    say('A × (第 1 行 a, b) = (1, 0)', '一個方程組');
    await W(tok, 2200);
    X.unglow(); Im.unglow(); X.glowCol(1, GREEN); Im.glowCol(1, GREEN);
    say('A × (第 2 行 c, d) = (0, 1)', '同一個 A、另一個右邊');
    await W(tok, 2200);
    X.unglow(); Im.unglow();
    say('求 A⁻¹ = 解 n 個方程組', 'A·(A⁻¹ 第 j 行) = (I 第 j 行)');
    await W(tok, 2400);
    [[0, 0, 7], [1, 0, -2], [0, 1, -3], [1, 1, 1]].forEach(([i, j, v]) => X.set(i, j, v));
    X.cells.flat().forEach((m) => glow(m, GREEN));
    say('解出來：A⁻¹ = [7 −3; −2 1]', 'Jordan：兩個方程組一起解');
    await W(tok, 2800);
  }
  async function scGaussJordan(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const mv = mview([[1, 3, 1, 0], [2, 7, 0, 1]], 0, 3.8, { aug: 2, name: '[A | I]', s: 1 });
    say('把 I 整個貼在 A 右邊', '增廣矩陣：兩個右邊一起帶著走');
    await W(tok, 2600);
    mv.pivot(0, 0);
    say('第 2 列減 2 倍第 1 列', 'R₂ − 2·R₁');
    await rowOp(tok, mv, 1, 0, 2, 1400);
    mv.pivot(1, 1);
    say('左半是上三角：Gauss 停在這', '[1 3 | 1 0; 0 1 | −2 1]');
    await W(tok, 2400);
    say('Jordan 繼續往上消', 'R₁ − 3·R₂：第 1 列減 3 倍第 2 列');
    await rowOp(tok, mv, 0, 1, 3, 1400);
    for (let i = 0; i < 2; i++) for (let j = 2; j < 4; j++) mv.glowCell(i, j, GREEN);
    txt(mv.nameL, '[I | A⁻¹]');
    say('左半變 I，右半就是 A⁻¹', 'A⁻¹ = [7 −3; −2 1]');
    await W(tok, 2600);
    mview([[7, -3], [-2, 1]], -3.2, 1.2, { name: '', s: 0.7, color: COL.b }); tag('×', 'val', -1.9, 1.2);
    mview([[1, 3], [2, 7]], -0.6, 1.2, { name: '', s: 0.7 }); tag('= I', 'val', 0.8, 1.2);
    say('檢查：7 − 6 = 1、21 − 21 = 0', '−2 + 2 = 0、−6 + 7 = 1 ✓');
    await W(tok, 3000);
  }
  async function scGJWhy(tok) {
    fresh([0, 3.4, 11.5], [0, 3.2, 0]);
    say('為什麼右半會變成 A⁻¹？', '每一步列運算 = 左乘一個 E');
    const E21 = mview([[1, 0], [-2, 1]], -4.6, 4.6, { name: 'E₂₁（減 2 倍）', s: 0.75, color: COL.hot });
    const E12 = mview([[1, -3], [0, 1]], -1.6, 4.6, { name: 'E₁₂（減 3 倍）', s: 0.75, color: COL.hot });
    await W(tok, 2400);
    tag('合起來', 'idx', 0.3, 4.6);
    const E = mview([[1, -3], [0, 1]], 2.4, 4.6, { name: 'E = E₁₂E₂₁', nameCls: 'ptr alt', s: 0.75, color: COL.l });
    E21.glowRow(1, GOLD); E12.glowRow(0, GOLD);
    for (const [i, j, v] of [[0, 0, 7], [1, 0, -2]]) { E.set(i, j, v); await W(tok, 500); }
    say('這例子只有兩步：E = [7 −3; −2 1]', '');
    await W(tok, 2000);
    E21.unglow(); E12.unglow();
    const xs = [-4.4, -2.9, -1.3, 0.3, 2.0, 3.6];
    const toks = [['E', COL.l], ['[ A', COL.a], ['| I ]', '#e9dcc4'], ['=', null], ['[ EA', COL.a], ['| E ]', COL.l]].map(([s, c], k) => (c ? cube(s, c, [1.3, 0.8, 0.7], xs[k], 1.8, 0, 3) : tag(s, 'val', xs[k], 1.8)));
    say('E 乘上整個長矩陣', 'E[A | I] = [EA | E]');
    await W(tok, 2600);
    relabel(toks[4], '[ I'); glow(toks[4], GREEN);
    say('左半變成 I：EA = I', '所以 E 就是 A⁻¹');
    await W(tok, 2400);
    relabel(toks[5], '| A⁻¹ ]'); glow(toks[5], GREEN);
    say('右半是 E·I = E = A⁻¹', '同時解 n 個方程組，n 行答案一起出現');
    await W(tok, 3200);
  }

  // ═════════════════════════ 場景：課本補充（Strang Ch2；3B1B、L5、L20 影片尚無字幕） ═════════════════════════
  async function scComposition(tok) {
    fresh([0, 3.2, 10.5], [0, 3.2, 0]);
    const gv = gridView(0, 3.2, 0.68, 4, 2);
    const cap = tag('', 'ptr alt', 0, 6.4);
    say('矩陣 = 變換：兩行是 î、ĵ 的落點', '課本／3B1B 同主題：乘法 = 合成');
    await W(tok, 2400);
    txt(cap, 'R = 旋轉 90° = [0 −1; 1 0]');
    say('先旋轉 90°', 'î → (0, 1)，ĵ → (−1, 0)');
    let m = await animT(tok, gv, [[0, -1], [1, 0]], I2, 1600);
    await W(tok, 1200);
    txt(cap, '再 S = shear [1 1; 0 1]');
    say('再做 shear', 'S 作用在已經旋轉過的格子上');
    m = await animT(tok, gv, [[1, 1], [0, 1]], m, 1600);
    await W(tok, 1000);
    txt(cap, 'SR = [1 −1; 1 0]');
    say('看 î、ĵ 最後落在哪：(1, 1)、(−1, 0)', '合成 = SR = [1 −1; 1 0]（先做的放右邊）');
    await W(tok, 3000);
    gv.apply(I2); await W(tok, 600);
    txt(cap, '換順序：先 S 再 R');
    say('順序反過來：先 shear 再旋轉', '');
    m = await animT(tok, gv, [[1, 1], [0, 1]], I2, 1300);
    m = await animT(tok, gv, [[0, -1], [1, 0]], m, 1300);
    txt(cap, 'RS = [0 −1; 1 1]');
    say('RS = [0 −1; 1 1] ≠ SR', '矩陣乘法不可交換');
    await W(tok, 3000);
  }
  async function scTraps(tok) {
    fresh([0, 3.4, 12], [0, 3.2, 0]);
    const s = 0.72;
    const row = (y, A, B, C, nA, nB, nC, sym = '=') => {
      mview(A, -4.4, y, { name: nA, s }); tag('×', 'val', -3.1, y); mview(B, -1.8, y, { name: nB, s, color: COL.b }); tag(sym, 'val', -0.5, y);
      return mview(C, 0.8, y, { name: nC, s, nameCls: 'ptr alt', color: COL.c });
    };
    say('同儕筆記的地雷：數字規則不能照搬', '');
    await W(tok, 2000);
    const r1 = row(5.0, [[1, 1], [1, 1]], [[1, -1], [-1, 1]], [[0, 0], [0, 0]], 'A ≠ 0', 'B ≠ 0', 'AB');
    tag('AB = 0，但 A、B 都不是 0', 'ptr alt', 4.4, 5.0);
    say('AB = 0 不代表 A = 0 或 B = 0', 'A = [1 1; 1 1]、B = [1 −1; −1 1]');
    r1.cells.flat().forEach((m) => glow(m, REDG));
    await W(tok, 3000);
    row(2.9, [[1, 1], [1, 1]], [[0, 1], [1, 0]], [[1, 1], [1, 1]], 'A', 'C = P₁₂', 'AC = A·I');
    tag('AB = AC（B = I），但 B ≠ C', 'ptr alt', 4.4, 2.9);
    say('AB = AC 不能消去成 B = C', 'A ≠ 0 也不行：A·I = A·P₁₂ = [1 1; 1 1]');
    await W(tok, 3200);
    mview([[1, 0], [0, 0]], -1.8, 0.9, { name: 'A = [1 0; 0 0]', s: 0.6 });
    tag('A² = A，但 A ≠ I、A ≠ 0', 'ptr alt', 2.2, 0.9);
    say('A² = A 不代表 A = I 或 0', '例：投影矩陣');
    await W(tok, 3000);
  }
  async function scTranspose(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const A = [[1, 2, 3], [4, 5, 6]];
    const mv = mview(A, -3, 3.4, { name: 'A（2×3）', s: 0.95 });
    say('轉置：第 i 列變成第 i 行', '(Aᵀ)ᵢⱼ = Aⱼᵢ');
    await W(tok, 2200);
    const g = gridXY(3, 2, 3, 3.4, 0.95);
    for (let i = 0; i < 2; i++) {
      mv.glowRow(i, GOLD);
      await Promise.all([0, 1, 2].map((j) => ghostFly(tok, A[i][j], mv.X(j), mv.Y(i), g.X(i), g.Y(j), 900, 0.5, COL.a)));
      mv.glowRow(i, null);
      say('A 的第 ' + (i + 1) + ' 列 → Aᵀ 的第 ' + (i + 1) + ' 行', '');
      await W(tok, 500);
    }
    mview(T2(A), 3, 3.4, { name: 'Aᵀ（3×2）', nameCls: 'ptr alt', s: 0.95, color: COL.b });
    say('2×3 轉置成 3×2', 'Aᵀ = [1 4; 2 5; 3 6]');
    await W(tok, 2400);
    say('乘積的轉置要反序', '(AB)ᵀ = BᵀAᵀ');
    await W(tok, 2600);
  }
  async function scSymmetric(tok) {
    fresh([0, 3.4, 11.5], [0, 3.2, 0]);
    const R = [[1, 3], [2, 3], [4, 1]], S = matMul(R, T2(R));
    mview(R, -5, 3.4, { name: 'R（3×2）', s: 0.75 }); tag('×', 'val', -3.9, 3.4);
    mview(T2(R), -2.2, 3.4, { name: 'Rᵀ', s: 0.75, color: COL.b }); tag('=', 'val', -0.6, 3.4);
    say('例：R 乘它的轉置', 'R = [1 3; 2 3; 4 1]');
    await W(tok, 2400);
    const mS = mview(S, 1.6, 3.4, { name: 'RRᵀ', nameCls: 'ptr alt', s: 0.75, color: COL.c });
    say('乘出來是 3×3 的對稱矩陣', 'RRᵀ = [10 11 7; 11 13 11; 7 11 17]');
    await W(tok, 2000);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      mS.glowCell(i, j, GOLD); mS.glowCell(j, i, GOLD);
      say('(' + (i + 1) + ',' + (j + 1) + ') = (' + (j + 1) + ',' + (i + 1) + ') = ' + S[i][j], '(R 第 ' + (i + 1) + ' 列)·(R 第 ' + (j + 1) + ' 列)，順序無關');
      await W(tok, 1500); mS.glowCell(i, j, null); mS.glowCell(j, i, null);
    }
    tag('對角線是鏡子', 'idx', 1.6, 1.9);
    say('對稱：Sᵀ = S', '(RRᵀ)ᵀ = (Rᵀ)ᵀRᵀ = RRᵀ；RᵀR 也對稱');
    await W(tok, 3200);
  }
  async function scPermRows(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    const P = [[0, 1, 0], [1, 0, 0], [0, 0, 1]], A = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    mview(P, -3.6, 3.4, { name: 'P₁₂', s: 0.8, hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') });
    tag('×', 'val', -2.1, 3.4);
    const mv = mview(A, -0.4, 3.4, { name: 'A', s: 0.8, color: COL.b });
    say('左乘 P：換 A 的「列」', 'P₁₂A：第 1、2 列交換');
    await W(tok, 2000);
    await swapRows(tok, mv, 0, 1, 1300);
    txt(mv.nameL, 'P₁₂A');
    await W(tok, 1400);
    say('右乘 P：換「行」', 'AP₁₂：第 1、2 行交換');
    const c0 = mv.cells.map((r) => r[0]), c1 = mv.cells.map((r) => r[1]);
    c0.forEach((m, i) => move(m, mv.X(1), mv.Y(i), 0.4)); c1.forEach((m, i) => move(m, mv.X(0), mv.Y(i), -0.4));
    await W(tok, 700);
    c0.forEach((m, i) => move(m, mv.X(1), mv.Y(i), 0)); c1.forEach((m, i) => move(m, mv.X(0), mv.Y(i), 0));
    txt(mv.nameL, 'P₁₂AP₁₂');
    await W(tok, 1400);
    mview(P, 3.6, 3.4, { name: 'PᵀP = I', nameCls: 'ptr alt', s: 0.8, hideZero: true, colorOf: (v) => (v ? COL.l : '#ece3d3') });
    say('P⁻¹ = Pᵀ', '有換列時：PA = LU');
    await W(tok, 3000);
  }
  async function scInvFormula(tok) {
    fresh([0, 3.2, 11], [0, 3.2, 0]);
    say('2×2 反矩陣公式', '[a b; c d]⁻¹ = (1/(ad − bc))·[d −b; −c a]');
    const A = mview([[1, 3], [2, 7]], -3.6, 3.6, { name: 'A = [1 3; 2 7]', s: 1 });
    await W(tok, 2400);
    A.glowCell(0, 0, GOLD); A.glowCell(1, 1, GOLD);
    say('a、d 對調', '');
    await W(tok, 1200);
    const B = mview([[7, 3], [2, 1]], 0.4, 3.6, { name: 'a、d 對調', s: 1, color: COL.b });
    A.unglow(); A.glowCell(0, 1, GREEN); A.glowCell(1, 0, GREEN);
    say('b、c 變號', '');
    await W(tok, 1000);
    B.set(0, 1, -3); B.set(1, 0, -2);
    txt(B.nameL, '[d −b; −c a]');
    say('再除以 ad − bc = 7 − 6 = 1', 'A⁻¹ = [7 −3; −2 1]：跟 Gauss-Jordan 一樣');
    await W(tok, 2800);
    A.unglow();
    mview([[1, 3], [2, 6]], 4.2, 3.6, { name: '[1 3; 2 6]', s: 1, color: COL.red });
    say('ad − bc = 0 → 沒有反矩陣', '6 − 6 = 0：singular');
    await W(tok, 2800);
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
    // MIT 18.06 L3
    'mult-entry': { title: 'cᵢⱼ = 列 · 行：c₃₄ = Σ a₃ₖbₖ₄', play: scEntry },
    'mult-shapes': { title: '(m×n)(n×p) = m×p', play: scShapes },
    'mult-columns': { title: 'C 的行 = A 的行的組合', play: scColumns },
    'mult-rows': { title: 'C 的列 = B 的列的組合', play: scRows },
    'mult-outer': { title: '行 × 列：(2,3,4)(1,6) 是 rank 1', play: scOuter },
    'mult-blocks': { title: '方塊乘法：C₁ = A₁B₁ + A₂B₃', play: scBlocks },
    'inverse-def': { title: '反矩陣：A⁻¹A = I = AA⁻¹', play: scInvDef },
    'singular-columns': { title: '[1 3; 2 6] 不可逆：Ax = 0 有 x = (3, −1)', play: scSingular },
    'inverse-columns': { title: '求 A⁻¹ = 解 n 個方程組', play: scInvColumns },
    'gauss-jordan': { title: 'Gauss-Jordan：[A | I] → [I | A⁻¹]', play: scGaussJordan },
    'gj-why': { title: '為什麼：E[A | I] = [I | E]，E = A⁻¹', play: scGJWhy },
    // 課本補充
    'composition': { title: '課本：乘法 = 合成變換（先轉 90° 再 shear）', play: scComposition },
    'mult-traps': { title: '課本：AB = 0、AB = AC、A² = A 的陷阱', play: scTraps },
    'transpose': { title: '課本：轉置 Aᵀ 與 (AB)ᵀ = BᵀAᵀ', play: scTranspose },
    'symmetric': { title: '課本：對稱矩陣，RRᵀ 永遠對稱', play: scSymmetric },
    'perm-rows': { title: '課本：PA 換列、AP 換行、P⁻¹ = Pᵀ', play: scPermRows },
    'inverse-formula': { title: '課本：2×2 反矩陣公式', play: scInvFormula },
  };

  return {
    kicker: '線性代數・第 2 章',
    title: '矩陣運算',
    color: 'var(--la)',
    modes: [
      { id: 'mult', name: '四種乘法', enter: enterMult },
      { id: 'gj', name: 'Gauss-Jordan 求逆', enter: enterGJ },
      { id: 'compose', name: '合成變換', enter: enterCompose },
      { id: 'transpose', name: '轉置與對稱', enter: enterTranspose },
      { id: 'perm', name: 'Permutation', enter: enterPerm },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['mult-entry', 'mult-shapes', 'mult-columns', 'mult-rows', 'mult-outer', 'mult-blocks', 'composition', 'mult-traps',
      'inverse-def', 'singular-columns', 'inverse-columns', 'gauss-jordan', 'gj-why', 'inverse-formula', 'transpose', 'symmetric', 'perm-rows'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
