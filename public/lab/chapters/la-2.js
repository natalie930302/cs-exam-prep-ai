// 線性代數 第2章：矩陣運算（乘法四種看法、方塊乘法、反矩陣、Gauss-Jordan、轉置、對稱、permutation、合成變換）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   MIT 18.06 L3（FX4C-JpTFgY，有字幕）：c₃₄ = Σ a₃ₖbₖ₄、(m×n)(n×p) = m×p、行的組合／列的組合、
//     (2,3,4)×(1,6) = [2 12; 3 18; 4 24] 與 row space / column space、方塊乘法 A₁B₁ + A₂B₃、
//     [1 3; 2 6] 不可逆（x = (3, −1)）、[1 3; 2 7] 用 Gauss-Jordan 得 [7 −3; −2 1]、E[A I] = [I A⁻¹]。
//   課本補充（Strang Ch2；3B1B「composition」、18.06 L5、L20 尚無字幕）：合成變換（先旋轉 90° 再 shear，SR = [1 −1; 1 0]）、
//     乘法陷阱、轉置與 (AB)ᵀ、對稱矩陣 RRᵀ（R = [1 3; 2 3; 4 1]）、permutation 換列換行、2×2 反矩陣公式。
//   L3 的 c₃₄、行／列組合用的具體數字是自己選的（影片只寫符號），流程依影片。
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ mx.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// 這個片段用模組自己的 3D 箭頭 arrow(color) / setArrow()，所以不從 kit 取 arrow（kit 沒有 beat：短暫停用 ctx.beat）
// ─── 線性代數 第 2 章 — cued scenes（mx）───
//   MIT 18.06 L3（FX4C-JpTFgY）：四種乘法、方塊乘法、反矩陣、[1 3; 2 6] singular、[1 3; 2 7] 的 Gauss-Jordan
//   MIT 18.06 L5（JibVXBElKL0）：PA = LU、permutation、轉置、對稱、RᵀR、向量空間與子空間、column space
//   MIT 18.06 L20（QNpj-gOXW9M）：cofactor 求 A⁻¹、Cramer's rule、行列式 = 體積／面積
//   3Blue1Brown（XkY2DOUCWMU）：矩陣乘法 = 合成變換
// 每個乘積、反矩陣、行列式都由程式算出來再和講者說的數字比對，畫面顯示 ✓／✘。
// 講者只寫符號的地方，用的數字是自己選的，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const nt = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ok = (b, t, x, y, z = 0) => (b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.cells && typeof o.kill === 'function') return o.kill(); kill(o); });
const CAM = [[0, 3.2, 11.5], [0, 3.2, 0]];
// a scene = a list of step functions; each runs when the video reaches its cue
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 計算 ──
const det2 = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const minorM = (M, i, j) => M.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
const detN = (M) => (M.length === 1 ? M[0][0] : M[0].reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * detN(minorM(M, 0, j)), 0));
const cofN = (M, i, j) => ((i + j) % 2 ? -1 : 1) * detN(minorM(M, i, j));
const cofMat = (M) => M.map((r, i) => r.map((_, j) => cofN(M, i, j)));
const idn = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const scaleM = (M, k) => M.map((r) => r.map((v) => cl(v * k)));
const addM = (A, B) => A.map((r, i) => r.map((v, j) => cl(v + B[i][j])));
const colOf = (M, j) => M.map((r) => r[j]);
const mv1 = (M, v) => M.map((r) => cl(r.reduce((s, a, k) => s + a * v[k], 0)));
const vstr = (v) => '(' + v.map(fmt).join(', ') + ')';
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
const zeros = (r, c) => Array.from({ length: r }, () => Array(c).fill(0));
const blankC = { hideZero: true, colorOf: (v) => (typeof v === 'number' && Math.abs(v) < 1e-9 ? '#ece3d3' : COL.c) };
// ── 畫圖小零件 ──
function slab(r, c, color, x, y, name, u = 0.62) {
  const m = lab.box(color, [c * u, r * u, 0.3]); m.position.set(x, y, 0); lab.world.add(m);
  const l = hd(name, x, y + (r * u) / 2 + 0.35); return [m, l];
}
function vec2(bd, color, x, y, x0 = 0, y0 = 0, z = 0.1, r = 0.05) { const a = arrow(color, r); setArrow(a, bd.P(x0, y0).setZ(z), bd.P(x, y).setZ(z)); return a; }
function vec3(sp, color, v, r = 0.05) { const a = arrow(color, r); setArrow(a, sp.P(0, 0, 0), sp.P(...v)); return a; }
function poly(pts, color, op = 0.28, z = 0.02) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
  m.position.z = z; lab.world.add(m); return m;
}
function dashed(p, q, color = '#b9a27a', r = 0.025) {
  const out = [], k = 18;
  for (let j = 0; j < k; j += 2) out.push((() => { const m = rod(color, r); setRod(m, p.clone().lerp(q, j / k), p.clone().lerp(q, (j + 1) / k)); return m; })());
  return out;
}
// parallelepiped with edges r1, r2, r3 (math coords) in a 3-D space
function pbox(sp, r1, r2, r3, color = '#4b9ee2') {
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0.5, 0.5, 0.5);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7 }));
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#2f5f8f' })));
  m.matrixAutoUpdate = false; lab.world.add(m);
  m.userData.set = (a, b, c) => {
    const o = sp.P(0, 0, 0), A = sp.D(...a), B = sp.D(...b), C = sp.D(...c);
    m.matrix.set(A.x, B.x, C.x, o.x, A.y, B.y, C.y, o.y, A.z, B.z, C.z, o.z, 0, 0, 0, 1); m.matrixWorldNeedsUpdate = true;
  };
  m.userData.set(r1, r2, r3); return m;
}
const R90 = [[0, -1], [1, 0]], SH = [[1, 1], [0, 1]];
async function tfTo(tok, gv, from, to, ms = 1300, extra) {
  await anim(tok, ms, (t) => { const M = lerpM(from, to, t); gv.apply(M); if (extra) extra(M); });
  return to;
}
async function tfRot(tok, gv, from, ang, ms = 1300, extra) {
  await anim(tok, ms, (t) => { const M = matMul(rot(ang * t), from); gv.apply(M); if (extra) extra(M); });
  return matMul(ang === Math.PI / 2 ? R90 : rot(ang), from).map((r) => r.map(cl));
}

// ═════════════════════════ MIT 18.06 L3：Multiplication and Inverse Matrices ═════════════════════════
const L3C = matMul(EA, EB);
// 9 steps
scene('mx-l3-entry', 'L3：cᵢⱼ = 列 · 行（c₃₄）', [
  (tok, S) => {
    S.A = mview(EA, -4.7, 3.4, { name: 'A', s: 0.72 }); S.B = mview(EB, -0.9, 3.4, { name: 'B', s: 0.72, color: COL.b });
    tag('×', 'val', -3.05, 3.4); tag('=', 'val', 1.05, 3.4);
    S.C = mview(zeros(3, 4), 3.9, 3.4, Object.assign({ name: 'C = AB', nameCls: 'ptr alt', s: 0.72 }, blankC));
    nt('數字是示意（影片只寫符號）', 0, 1.2);
    cap('A 乘 B 得到 C', 'C = AB');
  },
  (tok, S) => { S.C.glowCell(2, 3, GOLD); sm('c₃₄', S.C.X(3), S.C.Y(2) - 0.62); cap('看 C 的 (3, 4) 元素', 'c₃₄：先寫列號 3，再寫行號 4'); },
  (tok, S) => { S.A.glowRow(2, GOLD); S.B.glowCol(3, GOLD); cap('它來自 A 的第 3 列、B 的第 4 行', ''); },
  (tok, S) => { S.f = hot('c₃₄ = (A 的第 3 列) · (B 的第 4 行)', 0, 5.7); cap('列 · 行：dot product（內積）', ''); S.acc = 0; S.terms = []; },
  ...[0, 1, 2].map((k) => async (tok, S) => {
    S.A.glowCell(2, k, GREEN); S.B.glowCell(k, 3, GREEN);
    S.acc += EA[2][k] * EB[k][3]; S.terms.push(EA[2][k] + '·' + EB[k][3]);
    cap('a₃' + sub(k + 1) + ' × b' + sub(k + 1) + '₄ = ' + EA[2][k] + ' × ' + EB[k][3], '累加 = ' + S.acc);
    await ghostFly(tok, EA[2][k] * EB[k][3], S.A.X(k), S.A.Y(2), S.C.X(3), S.C.Y(2), 800);
    S.A.glowCell(2, k, GOLD); S.B.glowCell(k, 3, GOLD);
    if (k === 2) { S.C.set(2, 3, S.acc); S.C.glowCell(2, 3, GREEN); ok(S.acc === L3C[2][3], 'c₃₄ = ' + S.terms.join(' + ') + ' = ' + S.acc + ' ✓', 0, 0.6); }
  }),
  (tok, S) => { txt(S.f, 'c₃₄ = Σₖ a₃ₖ bₖ₄'); cap('寫成加總：k 走過整列、整行', 'c₃₄ = Σₖ a₃ₖ bₖ₄'); },
  async (tok, S) => {
    sm('k = 1, 2, …, n（這裡 n = 3）', 0, 5.1);
    cap('k 從 1 加到 n', '每一項：a₃ₖ × bₖ₄');
    for (let k = 0; k < 3; k++) { S.A.glowCell(2, k, COL.hot); S.B.glowCell(k, 3, COL.hot); await wt(tok, 400); S.A.glowCell(2, k, GOLD); S.B.glowCell(k, 3, GOLD); }
  },
]);
// 4 steps
scene('mx-l3-shapes', 'L3：(m×n)(n×p) = m×p', [
  (tok, S) => { [S.A] = slab(3, 4, COL.a, -4.2, 3.2, 'A：m×n'); nt('3×4、4×2 是示意', 0, 1.0); cap('什麼形狀才能相乘？', 'A 是 m×n：m 列、n 行'); },
  (tok, S) => {
    tag('×', 'val', -2.2, 3.2); [S.B] = slab(4, 2, COL.b, -0.6, 3.2, 'B：n×p');
    glow(S.A, GREEN); glow(S.B, GREEN); sm('A 一列有 n 個', -4.2, 1.85); sm('B 一行有 n 個', -0.6, 1.5);
    cap('B 的列數必須等於 A 的行數 n', '一列的長度 = 一行的長度，內積才算得出來');
  },
  (tok, S) => { glow(S.A, null); glow(S.B, null); tag('=', 'val', 0.9, 3.2); [S.C] = slab(3, 2, COL.c, 2.6, 3.2, 'C：m×p'); cap('結果 C 是 m×p', 'm 列（跟 A 一樣）、p 行（跟 B 一樣）'); },
  (tok, S) => { glow(S.C, GOLD); sm('m·p 個數字，每個是長度 n 的內積', 2.6, 1.8); cap('C 有 m·p 個數字', '每一個都是一次「列 · 行」'); },
]);
// 7 steps
const L3CC = matMul(CA, CB);
function colsLayout(S, nm) {
  S.A = mview(CA, -4, 3.4, { name: 'A（m×n）', s: 0.9 }); S.B = mview(CB, -0.6, 3.4, { name: 'B（n×p）', s: 0.9, color: COL.b });
  tag('×', 'val', -2.6, 3.4); tag('=', 'val', 1.5, 3.4);
  S.C = mview(zeros(2, 3), 3.7, 3.4, Object.assign({ name: 'C（m×p）', nameCls: 'ptr alt', s: 0.9 }, blankC));
  nt('數字是示意', 0, 1.0);
}
async function fillCol(tok, S, j) {
  S.B.glowCol(j, GOLD);
  for (let t = 0; t < 2; t++) {
    S.A.glowCol(t, GREEN);
    await Promise.all([0, 1].map((i) => ghostFly(tok, CA[i][t] * CB[t][j], S.A.X(t), S.A.Y(i), S.C.X(j), S.C.Y(i), 650)));
    for (let i = 0; i < 2; i++) S.C.set(i, j, S.C.v[i][j] + CA[i][t] * CB[t][j]);
    S.A.glowCol(t, null);
  }
  cap('A × (B 的第 ' + (j + 1) + ' 行) = C 的第 ' + (j + 1) + ' 行', comb(colOf(CB, j), ['a₁', 'a₂']) + ' = ' + vstr(colOf(L3CC, j)));
  S.B.glowCol(j, null);
}
scene('mx-l3-columns', 'L3：C 的行 = A 的行的組合', [
  (tok, S) => { colsLayout(S); cap('第二種看法：一次看一整行', 'A 是 m×n、B 是 n×p、C 是 m×p'); },
  (tok, S) => fillCol(tok, S, 0),
  (tok, S) => fillCol(tok, S, 1),
  async (tok, S) => { sm('B = p 個行並排', -0.6, 1.9); await fillCol(tok, S, 2); ok(eqM(S.C.v, L3CC), 'C = ' + mstr(L3CC) + ' ✓', 3.7, 1.9); },
  (tok, S) => { sm('a₁、a₂ = A 的第 1、2 行', -4, 1.9); cap('C 的每一行都是 A 的行的組合', 'A 乘一個向量 = A 的行的線性組合'); S.C.cells.flat().forEach((m) => glow(m, GREEN)); },
  (tok, S) => { S.C.unglow(); S.A.glowCol(0, GOLD); S.A.glowCol(1, GOLD); S.C.glowCol(0, GOLD); S.C.glowCol(1, GOLD); S.C.glowCol(2, GOLD); cap('A 的行長度 m，C 的行長度也是 m', '所以 C 的行可以是 A 的行的組合'); },
  (tok, S) => { S.A.unglow(); S.C.unglow(); S.B.glowCol(2, GOLD); S.C.glowCol(2, GREEN); cap('B 那一行的數字決定怎麼組合', 'C 第 3 行 = ' + comb(colOf(CB, 2), ['a₁', 'a₂'])); },
]);
// 5 steps
async function fillRow(tok, S, i) {
  S.A.glowRow(i, GOLD);
  for (let t = 0; t < 2; t++) {
    S.B.glowRow(t, GREEN);
    await Promise.all([0, 1, 2].map((j) => ghostFly(tok, CA[i][t] * CB[t][j], S.B.X(j), S.B.Y(t), S.C.X(j), S.C.Y(i), 650)));
    for (let j = 0; j < 3; j++) S.C.set(i, j, S.C.v[i][j] + CA[i][t] * CB[t][j]);
    S.B.glowRow(t, null);
  }
  cap('(A 的第 ' + (i + 1) + ' 列) × B = C 的第 ' + (i + 1) + ' 列', comb(CA[i], ['b₁', 'b₂']) + ' = ' + vstr(L3CC[i]));
  S.A.glowRow(i, null);
}
scene('mx-l3-rows', 'L3：C 的列 = B 的列的組合', [
  (tok, S) => { colsLayout(S); cap('第三種看法：一次看一整列', ''); },
  (tok, S) => fillRow(tok, S, 0),
  async (tok, S) => { await fillRow(tok, S, 1); ok(eqM(S.C.v, L3CC), 'C = ' + mstr(L3CC) + ' ✓', 3.7, 1.9); },
  (tok, S) => { sm('b₁、b₂ = B 的第 1、2 列', -0.6, 1.9); S.B.glowRow(0, GOLD); S.B.glowRow(1, GOLD); S.C.glowRow(0, GREEN); S.C.glowRow(1, GREEN); cap('C 的每一列都是 B 的列的組合', '左乘 A = 把 B 的列混合'); },
  (tok, S) => { S.B.unglow(); S.C.unglow(); hot('列 ← B 的列的組合；行 ← A 的行的組合', 0, 5.8); cap('答案的每一部分從哪來，看得清清楚楚', ''); },
]);
// 12 steps
const OC = [2, 3, 4], OR = [1, 6], OP = matMul(OC.map((v) => [v]), [OR]);
scene('mx-l3-outer', 'L3：第四種：行 × 列', [
  (tok, S) => {
    S.ways = ['① 列 · 行（一格一格）', '② 行的組合', '③ 列的組合', '④ ？'].map((t, k) => sm(t, 4.6, 5.4 - k * 0.55));
    cap('前三種看法回顧', '第四種是什麼？');
  },
  (tok, S) => { txt(S.ways[3], '④ 行 × 列'); S.ways[3].element.className = 'lab-label ptr alt'; cap('第四種：行 × 列', ''); },
  (tok, S) => {
    S.t = [...slab(1, 3, COL.a, -4.2, 5.2, '列（1×n）', 0.4), ...slab(3, 1, COL.b, -2.4, 5.2, '行（n×1）', 0.4), tag('×', 'val', -3.15, 5.2), tag('=', 'val', -1.8, 5.2), cube('數', COL.c, [0.4, 0.4, 0.3], -1.2, 5.2, 0)];
    cap('列 × 行 → 只得到一個數字', '(1×n)(n×1) = 1×1');
  },
  (tok, S) => { S.t.push(...slab(3, 1, COL.a, -4.4, 2.4, 'A 的一行：m×1')); cap('A 的一行是 m×1', 'm 個數字排成一行'); },
  (tok, S) => { S.t.push(...slab(1, 2, COL.b, -2.6, 3.4, 'B 的一列：1×p'), tag('×', 'val', -3.6, 2.4)); cap('B 的一列是 1×p', ''); },
  (tok, S) => { S.t.push(tag('=', 'val', -1.3, 2.4), ...slab(3, 2, COL.c, 0.2, 2.4, '整個 m×p 矩陣')); cap('行 × 列 → 一整個 m×p 矩陣', '(m×1)(1×p) = m×p'); },
  (tok, S) => {
    gone(S.t);
    S.c = mview(OC.map((v) => [v]), -4.4, 3.0, { name: '行 (2,3,4)', s: 0.85 });
    S.r = mview([OR], -2.2, 4.75, { name: '', s: 0.85, color: COL.b }); sm('列 (1, 6)', -0.5, 4.75);
    S.P = mview(zeros(3, 2), -2.2, 3.0, Object.assign({ name: '', s: 0.85 }, blankC));
    cap('例子：行 (2, 3, 4) 乘列 (1, 6)', '3×1 乘 1×2 = 3×2');
  },
  ...[0, 1, 2].map((i) => async (tok, S) => {
    S.c.glowCell(i, 0, GOLD); S.r.glowRow(0, GOLD);
    for (let j = 0; j < 2; j++) { S.P.set(i, j, OC[i] * OR[j]); S.P.glowCell(i, j, GREEN); }
    cap('第 ' + (i + 1) + ' 列：' + OC[i] + ' × (1, 6)', '= ' + vstr(OP[i]));
    await wt(tok, 500); S.c.glowCell(i, 0, null); S.r.unglow();
    if (i === 2) ok(eqM(S.P.v, [[2, 12], [3, 18], [4, 24]]), '= [2 12; 3 18; 4 24] ✓', -2.2, 1.2);
  }),
  (tok, S) => { S.P.unglow(); S.P.glowCol(0, GOLD); S.P.glowCol(1, GOLD); sm('×1', S.P.X(0), S.P.Y(0) + 0.65); sm('×6', S.P.X(1), S.P.Y(0) + 0.65); cap('每一行都是 (2, 3, 4) 的倍數', '第 1 行 = 1·(2,3,4)，第 2 行 = 6·(2,3,4)'); },
  (tok, S) => { S.P.unglow(); [0, 1, 2].forEach((i) => { S.P.glowRow(i, COL.l); sm('×' + OC[i], S.P.X(1) + 0.75, S.P.Y(i)); }); cap('每一列都是 (1, 6) 的倍數', '第 i 列 = cᵢ·(1, 6)'); },
]);
// 6 steps
const O2A = [[2, 7], [3, 8], [4, 9]], O2B = [[1, 6], [0, 0]];
scene('mx-l3-outer-sum', 'L3：AB = Σ（第 k 行）（第 k 列）', [
  (tok, S) => { S.f = hot('AB = (A 第 1 行)(B 第 1 列) + (A 第 2 行)(B 第 2 列) + ⋯', 0, 5.9); cap('第四種：行 × 列，再全部加起來', ''); },
  (tok, S) => {
    S.A = mview(O2A, -4.6, 3.6, { name: 'A', s: 0.8 }); S.ops = [tag('×', 'val', -3.55, 3.6)];
    S.B = mview(O2B, -2.4, 3.6, { name: 'B', s: 0.8, color: COL.b }); S.ops.push(tag('=', 'val', -1.25, 3.6));
    cap('例：A = [2 7; 3 8; 4 9]、B = [1 6; 0 0]', '');
  },
  (tok, S) => {
    S.A.glowCol(0, GOLD); S.B.glowRow(0, GOLD);
    S.t1 = mview(matMul(O2A.map((r) => [r[0]]), [O2B[0]]), 0.2, 3.6, { name: '第1行 × 第1列', s: 0.8, color: COL.c });
    cap('第 1 行 × 第 1 列', '(2,3,4)(1,6) = [2 12; 3 18; 4 24]');
  },
  (tok, S) => {
    S.A.unglow(); S.B.unglow(); S.A.glowCol(1, GOLD); S.B.glowRow(1, GOLD); S.ops.push(tag('+', 'val', 1.55, 3.6));
    S.t2 = mview(matMul(O2A.map((r) => [r[1]]), [O2B[1]]), 2.9, 3.6, Object.assign({ name: '第2行 × 第2列', s: 0.8 }, blankC));
    cap('再加：第 2 行 × 第 2 列', '(7,8,9)(0,0) = 全部是 0');
  },
  (tok, S) => {
    S.A.unglow(); S.B.unglow();
    const sum = addM(S.t1.v, S.t2.v);
    S.ok = ok(eqM(sum, matMul(O2A, O2B)) && eqM(sum, OP), 'AB = ' + mstr(sum) + '：和剛才一樣 ✓', 0, 1.3);
    cap('第二項是 0，答案回到剛才那個矩陣', '');
  },
  (tok, S) => {
    gone(S.A, S.B, S.t1, S.t2, S.ops, S.ok);
    const o = V3(-5.2, 0.9, 0), sc = 0.19;
    setRod(rod('#6e5f49', 0.02), o.clone().add(V3(-0.3, 0, 0)), o.clone().add(V3(6 * sc, 0, 0)));
    setRod(rod('#6e5f49', 0.02), o.clone().add(V3(0, -0.3, 0)), o.clone().add(V3(0, 26 * sc, 0)));
    sm('x', o.x + 6 * sc + 0.25, o.y); sm('y', o.x, o.y + 26 * sc + 0.3);
    setRod(rod('#c9b48e', 0.03), o.clone(), o.clone().add(V3(4.4 * sc, 26.4 * sc, 0)));
    OP.forEach(([x, y]) => { const d = dot(COL.c, 0.11); d.position.copy(o).add(V3(x * sc, y * sc, 0.05)); });
    hot('row space：過 (1, 6) 的直線', -3.2, 6.2);
    cap('所有的列都在同一條線上', '(2,12)、(3,18)、(4,24) 都是 (1,6) 的倍數');
  },
  (tok, S) => {
    const sp = space([2.6, 1.8, 0], 0.42, 4.5), c = [2, 3, 4];
    setRod(rod('#c9b48e', 0.03), sp.P(...c.map((v) => -0.9 * v)), sp.P(...c.map((v) => 1.25 * v)));
    vec3(sp, COL.a, c, 0.05);
    hot('column space：過 (2, 3, 4) 的直線（在 R³）', 2.6, 6.2);
    sm('(12, 18, 24) = 6·(2, 3, 4) 也在線上', 2.6, -0.2);
    cap('所有的行也都在同一條線上', '這是一個「最小」的矩陣：rank 1');
  },
]);
// 7 steps
const BLA = [[1, 2, 0, 1], [0, 1, 3, 1], [2, 0, 1, 1], [1, 1, 0, 2]], BLB = [[1, 0, 2, 1], [3, 1, 0, 0], [0, 2, 1, 1], [1, 1, 1, 0]];
const blk = (M, bi, bj) => M.slice(bi * 2, bi * 2 + 2).map((r) => r.slice(bj * 2, bj * 2 + 2));
scene('mx-l3-blocks', 'L3：方塊乘法 C₁ = A₁B₁ + A₂B₃', [
  (tok, S) => { const t = (s, x, y) => cube(s, COL.a, [1.1, 1.1, 0.4], x, y, 0); S.A = [['A₁', -4.9, 4.0], ['A₂', -3.7, 4.0], ['A₃', -4.9, 2.8], ['A₄', -3.7, 2.8]].map(([s, x, y]) => t(s, x, y)); cap('把矩陣切成方塊', 'A 切成 4 塊：A₁、A₂、A₃、A₄'); },
  (tok, S) => { tag('×', 'val', -2.35, 3.4); const t = (s, x, y) => cube(s, COL.b, [1.1, 1.1, 0.4], x, y, 0); S.B = [['B₁', -1.0, 4.0], ['B₂', 0.2, 4.0], ['B₃', -1.0, 2.8], ['B₄', 0.2, 2.8]].map(([s, x, y]) => t(s, x, y)); cap('B 也切成 4 塊', '大小要對得上'); },
  (tok, S) => { sm('例：20×20 切成四塊 10×10', -2.4, 1.6); tag('=', 'val', 1.4, 3.4); S.C1 = cube('?', COL.c, [2.0, 1.1, 0.4], 3.6, 4.0, 0); cube('', '#ece3d3', [2.0, 1.1, 0.4], 3.6, 2.8, 0); cap('答案的左上那塊是什麼？', ''); },
  (tok, S) => { glow(S.A[0], GREEN); glow(S.B[0], GREEN); glow(S.C1, GOLD); relabel(S.C1, 'A₁B₁'); cap('A₁B₁：矩陣乘矩陣', '大小剛好是 10×10'); },
  (tok, S) => { glow(S.A[0], null); glow(S.B[0], null); glow(S.A[1], GREEN); glow(S.B[2], GREEN); relabel(S.C1, 'A₁B₁ + A₂B₃'); cap('再加上 A₂B₃', 'C₁ = A₁B₁ + A₂B₃'); },
  (tok, S) => {
    [S.A[0], S.A[1], S.B[0], S.B[2]].forEach((m) => glow(m, GOLD));
    const lhs = addM(matMul(blk(BLA, 0, 0), blk(BLB, 0, 0)), matMul(blk(BLA, 0, 1), blk(BLB, 1, 0))), rhs = blk(matMul(BLA, BLB), 0, 0);
    ok(eqM(lhs, rhs), '示意 4×4：A₁B₁ + A₂B₃ = ' + mstr(lhs) + ' = AB 左上 ✓', 0, 0.9);
    cap('方塊列 × 方塊行，就像數字一樣', '(A₁ A₂) × (B₁; B₃)');
  },
  (tok, S) => { sm('一格一格、行、列、行×列、方塊：同一批乘法', 0, 0.3); cap('五種看法，做的都是同一批乘法', ''); },
]);
// 7 steps
scene('mx-l3-invdef', 'L3：反矩陣 A⁻¹A = I = AA⁻¹', [
  (tok, S) => { S.a = cube('A', COL.a, [1.2, 1.2, 0.9], 0, 4.6, 0, 2); hd('方陣（n×n）', 0, 5.6); cap('方陣 A：可能有反矩陣，也可能沒有', ''); },
  (tok, S) => { hot('最重要的問題：A 可不可逆？', 0, 6.4); cap('關於矩陣，最重要的問題', '可逆嗎？'); },
  (tok, S) => { kill(S.a); [['A⁻¹', COL.b], ['A', COL.a], ['= I', '#e9dcc4']].forEach(([s, c], k) => cube(s, c, [1.2, 0.9, 0.9], -4.2 + k * 1.4, 4.0, 0, 3)); cap('如果存在：A⁻¹A = I', 'I 是 identity（單位矩陣）'); },
  (tok, S) => { [['A', COL.a], ['A⁻¹', COL.b], ['= I', '#e9dcc4']].forEach(([s, c], k) => cube(s, c, [1.2, 0.9, 0.9], 1.4 + k * 1.4, 4.0, 0, 3)); cap('放在右邊也成立：AA⁻¹ = I', ''); },
  (tok, S) => { good('方陣：左反矩陣 = 右反矩陣（不容易證明）', 0, 2.9); cap('方陣的左反矩陣也是右反矩陣', ''); },
  (tok, S) => { const r = lab.box(COL.a, [0.6 * 2, 0.6 * 3, 0.3]); r.position.set(-2, 1.0, 0); lab.world.add(r); sm('3×2 長方形矩陣', -2, 2.2); bad('長方形：形狀不允許兩邊都是反矩陣', 1.8, 1.0); cap('長方形矩陣就不一樣', '之後再談'); },
  (tok, S) => { good('可逆 = invertible = nonsingular', 0, -0.2); cap('可逆的矩陣叫 invertible 或 nonsingular', ''); },
]);
// 12 steps
const SGA = [[1, 3], [2, 6]];
scene('mx-l3-singular', 'L3：[1 3; 2 6] 不可逆：Ax = 0 有 x = (3, −1)', [
  (tok, S) => { S.A = mview(SGA, -4.6, 4.7, { name: 'A', s: 0.85 }); S.bd = board(1.7, 3.0, 0.42, 6); cap('A = [1 3; 2 6] 沒有反矩陣', '為什麼？'); },
  (tok, S) => { ok(det2(SGA) === 0, 'det = 1·6 − 3·2 = 0 ✓', -4.0, 3.3); cap('懂行列式的話：det = 0', ''); },
  (tok, S) => { sm('假設 A × (某個矩陣) = I？', -4.0, 2.7); cap('假設 A 乘某個矩陣得到 I', '為什麼不可能？'); },
  (tok, S) => {
    const O = S.bd.P(0, 0).setZ(0.08); S.O = O;
    vec2(S.bd, COL.b, 3, 6, 0, 0, 0.05); vec2(S.bd, COL.a, 1, 2, 0, 0, 0.12);
    sm('第1行 (1, 2)', ...S.bd.P(2.6, 1.4).toArray()); sm('第2行 (3, 6)', ...S.bd.P(4.4, 5.3).toArray());
    S.A.glowCol(0, GOLD); S.A.glowCol(1, GOLD);
    cap('乘出來的每一行，都是 A 的行的組合', '');
  },
  (tok, S) => { setRod(rod('#c9b48e', 0.03), S.bd.P(-3, -6).setZ(0.02), S.bd.P(3, 6).setZ(0.02)); cap('兩行在同一條線上', '組合永遠留在這條線上'); },
  (tok, S) => { const d = dot(COL.red, 0.15); d.position.copy(S.bd.P(1, 0)).setZ(0.1); bad('(1, 0) 到不了', ...S.bd.P(2.6, -1.0).toArray()); cap('I 的第一行 (1, 0) 不在線上', '→ 不可能得到 I'); },
  (tok, S) => { S.A.unglow(); sm('另一個理由：Ax = 0，x ≠ 0？', -4.0, 2.1); cap('更重要的理由：找 x ≠ 0 讓 Ax = 0', ''); },
  (tok, S) => { const Ax = mv1(SGA, [3, -1]); ok(Ax.every((v) => v === 0), 'x = (3, −1)：Ax = ' + vstr(Ax) + ' ✓', -4.0, 1.5); cap('x = (3, −1)', '不是零向量才有意思'); },
  async (tok, S) => {
    const a1 = arrow(COL.a, 0.045), a2 = arrow(COL.hot, 0.045);
    await anim(tok, 1100, (t) => setArrow(a1, S.bd.P(0, 0).setZ(0.2), S.bd.P(3 * t, 6 * t).setZ(0.2)));
    await anim(tok, 1100, (t) => setArrow(a2, S.bd.P(3, 6).setZ(0.25), S.bd.P(3 - 3 * t, 6 - 6 * t).setZ(0.25)));
    cap('3·(第1行) − 1·(第2行) = 0', '走出去，又走回原點');
  },
  (tok, S) => { sm('若 A⁻¹ 存在：x = A⁻¹Ax = A⁻¹0 = 0', -4.0, 0.9); cap('如果 A⁻¹ 存在，兩邊左乘 A⁻¹', '得到 x = 0'); },
  (tok, S) => { bad('可是 x = (3, −1) ≠ 0 → 矛盾', -4.0, 0.3); cap('可是 x 不是 0 → 矛盾', '所以 A⁻¹ 不存在'); },
  (tok, S) => { hot('singular：某個行組合 = 零向量', 1.7, 6.3); cap('結論：singular 矩陣的某個行組合是 0', 'A 把 x 送到 0，A⁻¹ 救不回來'); },
]);
// 9 steps
const IVA = [[1, 3], [2, 7]];
scene('mx-l3-invcols', 'L3：求 A⁻¹ = 解 n 個方程組', [
  (tok, S) => { S.h = hot('換一個「有」反矩陣的例子', 0, 6.3); cap('回到正面：可逆的矩陣', ''); },
  (tok, S) => { kill(S.h); S.A = mview(IVA, -4.2, 4.5, { name: 'A', s: 0.95 }); cap('右下角放 7', 'A = [1 3; 2 7]'); },
  (tok, S) => { ok(det2(IVA) === 1, 'det = 1·7 − 3·2 = 1 ≠ 0 ✓', -4.2, 2.9); cap('行列式不是 0', ''); },
  (tok, S) => {
    const bd = board(3.6, 2.6, 0.27, 7.5);
    vec2(bd, COL.a, 1, 2, 0, 0, 0.12); vec2(bd, COL.b, 3, 7, 0, 0, 0.08);
    sm('(1, 2)', ...bd.P(2.6, 1.5).toArray()); sm('(3, 7)', ...bd.P(4.8, 6.6).toArray());
    cap('兩行指向不同方向', '→ 什麼向量都組合得出來');
  },
  (tok, S) => {
    S.a2 = mview(IVA, -4.6, 1.2, { name: 'A', s: 0.6 }); tag('×', 'val', -3.6, 1.2);
    S.X = mview([['a', 'c'], ['b', 'd']], -2.6, 1.2, { name: 'A⁻¹', s: 0.6, color: COL.b }); tag('=', 'val', -1.6, 1.2);
    S.I = mview(I2, -0.6, 1.2, { name: 'I', s: 0.6, color: '#e9dcc4' });
    cap('A × A⁻¹ = I：要找四個數', '');
  },
  (tok, S) => { S.X.glowCol(0, GOLD); S.I.glowCol(0, GOLD); sm('A·(a, b) = (1, 0)', -2.2, 0.0); cap('A⁻¹ 的第 1 行：A·(a, b) = (1, 0)', ''); },
  (tok, S) => { S.X.unglow(); S.I.unglow(); S.X.glowCol(1, GREEN); S.I.glowCol(1, GREEN); sm('A·(c, d) = (0, 1)', 0.6, 0.0); cap('A⁻¹ 的第 2 行：A·(c, d) = (0, 1)', '求反矩陣 = 解兩個方程組'); },
  (tok, S) => { S.X.unglow(); S.I.unglow(); hot('A·(A⁻¹ 第 j 行) = (I 第 j 行)', -1.2, 5.6); cap('同一個 A，n 個不同的右邊', '右邊就是 I 的各行'); },
  (tok, S) => { good('Gauss-Jordan：這些方程組一起解', -1.2, 6.25); cap('Jordan 的點子：一起解', ''); },
]);
// 9 steps
scene('mx-l3-gj', 'L3：Gauss-Jordan [A | I] → [I | A⁻¹]', [
  (tok, S) => { sm('[1 3; 2 7]·(a, b) = (1, 0)', -2.6, 6.0); sm('[1 3; 2 7]·(c, d) = (0, 1)', 2.6, 6.0); cap('兩個方程組', '解出來就是 A⁻¹ 的兩行'); },
  (tok, S) => { S.one = mview([[1, 3, 1], [2, 7, 0]], 0, 3.6, { aug: 2, name: '[A | b]：只解一個', s: 1 }); cap('只解一個時：右邊貼成多一行', '增廣矩陣（augmented matrix）'); },
  (tok, S) => { gone(S.one); S.mv = mview([[1, 3, 1, 0], [2, 7, 0, 1]], 0, 3.6, { aug: 2, name: '[A | I]', s: 1 }); cap('現在貼上兩行：整個 I', '左邊做什麼，右邊跟著做'); },
  (tok, S) => { sm('目標：左半 → I，右半就變成 A⁻¹', 0, 1.9); cap('消去到左半變成 I', ''); },
  async (tok, S) => { S.mv.pivot(0, 0); cap('第 2 列減 2 倍第 1 列', 'R₂ − 2·R₁'); await rowOp(tok, S.mv, 1, 0, 2, 1400); },
  (tok, S) => { S.mv.pivot(1, 1); sm('上三角：Gauss 停在這；Jordan 繼續往上消', 0, 1.3); cap('左半已是上三角', 'Jordan：繼續往上消'); },
  async (tok, S) => { cap('第 1 列減 3 倍第 2 列', 'R₁ − 3·R₂：消掉 3'); await rowOp(tok, S.mv, 0, 1, 3, 1400); },
  (tok, S) => {
    for (let i = 0; i < 2; i++) for (let j = 2; j < 4; j++) S.mv.glowCell(i, j, GREEN);
    txt(S.mv.nameL, '[I | A⁻¹]'); S.inv = S.mv.v.map((r) => r.slice(2));
    cap('左半變 I，右半就是 A⁻¹', 'A⁻¹ = ' + mstr(S.inv));
  },
  (tok, S) => { const pr = matMul(S.inv, IVA); ok(eqM(pr, I2), '檢查 A⁻¹A：7−6 = 1、21−21 = 0、−2+2 = 0、−6+7 = 1 → I ✓', 0, 0.6); cap('乘回去檢查', '得到 I：答案對'); },
]);
// 9 steps
scene('mx-l3-gjwhy', 'L3：為什麼 E[A | I] = [I | A⁻¹]', [
  (tok, S) => { hot('為什麼右半會變成 A⁻¹？', 0, 6.3); cap('為什麼會這樣？', ''); },
  (tok, S) => {
    const xs = [-4.4, -2.9, -1.3, 0.3, 2.0, 3.6];
    S.tk = [['E', COL.l], ['[ A', COL.a], ['| I ]', '#e9dcc4'], ['=', null], ['[ EA', COL.a], ['| E ]', COL.l]].map(([s, c], k) => (c ? cube(s, c, [1.3, 0.8, 0.7], xs[k], 1.6, 0) : tag(s, 'val', xs[k], 1.6)));
    S.tk.slice(3).forEach((o) => { o.visible = false; });
    cap('每一步消去 = 左乘一個 elimination matrix', '全部合起來叫 E');
  },
  (tok, S) => { S.E21 = mview([[1, 0], [-2, 1]], -4.4, 4.5, { name: 'E₂₁：減 2 倍', s: 0.75, color: COL.hot }); cap('第一個 E：第 2 列減 2 倍第 1 列', ''); },
  (tok, S) => { S.E12 = mview([[1, -3], [0, 1]], -1.4, 4.5, { name: 'E₁₂：減 3 倍', s: 0.75, color: COL.hot }); cap('第二個 E：第 1 列減 3 倍第 2 列', '這個例子只有兩步'); },
  (tok, S) => { S.E = matMul([[1, -3], [0, 1]], [[1, 0], [-2, 1]]); mview(S.E, 2.4, 4.5, { name: 'E = E₁₂E₂₁', nameCls: 'ptr alt', s: 0.75, color: COL.l }); cap('兩個合起來 = 一個 E', 'E = ' + mstr(S.E)); },
  (tok, S) => { S.tk.slice(3).forEach((o) => { o.visible = true; }); cap('E 乘上整個長矩陣', 'E[A | I] = [EA | E]'); },
  (tok, S) => { relabel(S.tk[4], '[ I'); glow(S.tk[4], GREEN); ok(eqM(matMul(S.E, IVA), I2), 'EA = I ✓', 0, 0.3); cap('左半變成 I：EA = I', '所以 E 就是 A⁻¹'); },
  (tok, S) => { relabel(S.tk[5], '| A⁻¹ ]'); glow(S.tk[5], GREEN); cap('右半是 E·I = E = A⁻¹', ''); },
  (tok, S) => { sm('同時解 n 個方程組 → n 行答案 = A⁻¹ 的 n 行', 0, -0.3); cap('Gauss-Jordan：n 個方程組一起解', ''); },
]);

// ═════════════════════════ MIT 18.06 L5：Transposes, Permutations, Spaces Rⁿ ═════════════════════════
function luNP(M) {
  const n = M.length, U = M.map((r) => r.slice()), L = idn(n);
  for (let c = 0; c < n; c++) for (let i = c + 1; i < n; i++) { const k = U[i][c] / U[c][c]; L[i][c] = k; U[i] = U[i].map((x, j) => cl(x - k * U[c][j])); }
  return { L, U };
}
const PLA = [[0, 1, 1], [1, 2, 1], [2, 7, 9]], PLP = [[0, 1, 0], [1, 0, 0], [0, 0, 1]], PLPA = matMul(PLP, PLA), PLLU = luNP(PLPA);
// 8 steps
scene('mx-l5-palu', 'L5：換列與 PA = LU', [
  (tok, S) => { hot('permutation matrix P：負責換列', 0, 6.3); cap('Permutation：做換列的矩陣', ''); },
  (tok, S) => { S.A = mview(PLA, -4.4, 4.0, { name: 'A（示意）', s: 0.75 }); S.A.glowCell(0, 0, REDG); sm('pivot 位置是 0', -4.4, 2.4); cap('A 是好好的可逆矩陣', '可是 pivot 位置出現 0'); },
  async (tok, S) => { cap('跟下面的列交換', '換到一個不是 0 的 pivot'); await swapRows(tok, S.A, 0, 1, 1200); txt(S.A.nameL, 'PA'); },
  (tok, S) => {
    S.L = mview([[1, 0, 0], ['ℓ', 1, 0], ['ℓ', 'ℓ', 1]], 0.2, 4.0, { name: 'L', s: 0.7, color: COL.l }); tag('×', 'val', 1.6, 4.0);
    S.U = mview([['•', '•', '•'], [0, '•', '•'], [0, 0, '•']], 3.2, 4.0, { name: 'U', s: 0.7, color: COL.u });
    sm('L：對角線 1、下面是乘數', 0.2, 2.6); sm('U：上三角', 3.2, 2.6);
    cap('原本的 A = LU', '');
  },
  (tok, S) => { sm('A = LU 假設不用換列：P = I', 1.7, 1.9); cap('那個描述假設不需要換列', 'P 是 identity'); },
  (tok, S) => { sm('MATLAB：pivot 太小也會換列（數值準確）', 0, 1.2); cap('MATLAB 連「太小的 pivot」都會換', '接近 0 的 pivot 數值上不好'); },
  (tok, S) => {
    gone(S.L, S.U);
    mview(PLLU.L, 0.2, 4.0, { name: 'L', s: 0.7, color: COL.l }); mview(PLLU.U, 3.2, 4.0, { name: 'U', s: 0.7, color: COL.u });
    tag('=', 'val', -1.8, 4.0);
    ok(eqM(matMul(PLLU.L, PLLU.U), PLPA), 'L·U = PA ✓', 4.8, 4.9);
    cap('有換列時：A = LU 變成 PA = LU', 'P 先把列排好');
  },
  (tok, S) => { hot('PA = LU：任何可逆的 A 都可以', 0, 0.4); cap('大部分矩陣不需要 P', '需要的話，P 就在那裡'); },
]);
// 10 steps
const ORD3 = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]];
const P231 = Pof([2, 3, 1]);
scene('mx-l5-perm', 'L5：Permutation：n! 個、P⁻¹ = Pᵀ', [
  async (tok, S) => {
    const pc = { hideZero: true, colorOf: (v) => (v ? COL.a : '#ece3d3') };
    S.pc = pc; S.I = mview(idn(3), -4.4, 4.4, Object.assign({ name: 'I', s: 0.7 }, pc));
    cap('P = 把單位矩陣的列重新排列', '');
    await swapRows(tok, S.I, 0, 1, 1100); txt(S.I.nameL, 'P₁₂：換第 1、2 列');
  },
  (tok, S) => { S.x1 = sm('什麼都不換也算：I', -4.4, 2.6); cap('「不換」也算一種：identity', ''); },
  (tok, S) => { S.cyc = mview(P231, -1.2, 4.4, Object.assign({ name: '三列循環', s: 0.7 }, S.pc)); cap('換兩列、換三列……', ''); },
  (tok, S) => { S.t4 = [sm('4 列：1→2→3→4→1 一個大循環', 2.9, 4.8), sm('或：1↔2 且 3↔4', 2.9, 4.2)]; cap('四列：一個大循環，或兩對各自交換', '可能性很多'); },
  (tok, S) => { S.t4.push(hot('n×n 的 permutation 共有 n! 個', 2.9, 3.3)); cap('一共有幾個？n!', 'n! = n·(n−1)·…·2·1'); },
  (tok, S) => {
    ORD3.forEach((o, k) => mview(Pof(o), -5.0 + k * 2.0, 1.4, Object.assign({ name: '', s: 0.3 }, S.pc)));
    const n = new Set(ORD3.map((o) => o.join(''))).size;
    ok(n === fact(3), '3×3：3! = 6 個 ✓', 0, 0.5);
    cap('3×3 的全部列出來', '');
  },
  (tok, S) => { cap('它們全都可逆', '把列排回原來的順序就好'); S.x2 = sm('反矩陣 = 轉置', -1.2, 2.6); },
  (tok, S) => {
    gone(S.I, S.cyc, S.t4, S.x1, S.x2);
    mview(P231, -4.4, 4.4, Object.assign({ name: 'P', s: 0.7 }, S.pc)); tag('×', 'val', -3.1, 4.4);
    mview(T2(P231), -1.8, 4.4, Object.assign({ name: 'Pᵀ', s: 0.7 }, S.pc)); tag('=', 'val', -0.5, 4.4);
    const pr = matMul(P231, T2(P231)); mview(pr, 0.8, 4.4, Object.assign({ name: 'I', s: 0.7 }, S.pc));
    ok(eqM(pr, idn(3)), 'PPᵀ = I ✓', 0.8, 2.9);
    cap('P 乘它的轉置', '1 碰到 1，正好得到 I');
  },
  (tok, S) => { ok(eqM(matMul(T2(P231), P231), idn(3)), 'PᵀP = I → P⁻¹ = Pᵀ ✓', 4.0, 4.4); cap('PᵀP = I：Pᵀ 就是 P 的反矩陣', ''); },
  (tok, S) => { ok(fact(4) === 24 && fact(5) === 120, '4×4：4! = 24 個；5×5：5! = 120 個 ✓', 4.0, 3.6); cap('4×4 有 24 個，5×5 有 120 個', ''); },
]);
// 8 steps
const L5R = [[1, 3], [2, 3], [4, 1]];
scene('mx-l5-transpose', 'L5：轉置 (Aᵀ)ᵢⱼ = Aⱼᵢ', [
  (tok, S) => { S.R = mview(L5R, -3.4, 3.4, { name: 'A（3×2）', s: 0.9 }); cap('例：A = [1 3; 2 3; 4 1]', '3 列 2 行'); },
  (tok, S) => { hot('轉置：Aᵀ（MATLAB 寫 A′）', 0, 6.0); cap('轉置寫成 Aᵀ', ''); },
  (tok, S) => { S.T = mview(zeros(2, 3), 2.6, 3.4, Object.assign({ name: 'Aᵀ（2×3）', nameCls: 'ptr alt', s: 0.9 }, blankC)); cap('3×2 轉置後是 2×3', '變得矮又寬'); },
  ...[0, 1].map((j) => async (tok, S) => {
    S.R.glowCol(j, GOLD);
    await Promise.all([0, 1, 2].map((i) => ghostFly(tok, L5R[i][j], S.R.X(j), S.R.Y(i), S.T.X(i), S.T.Y(j), 900, 0.5, COL.a)));
    for (let i = 0; i < 3; i++) S.T.set(j, i, L5R[i][j]);
    S.R.glowCol(j, null); S.T.glowRow(j, GREEN);
    cap('A 的第 ' + (j + 1) + ' 行 → Aᵀ 的第 ' + (j + 1) + ' 列', vstr(colOf(L5R, j)));
  }),
  (tok, S) => { S.T.unglow(); S.R.glowRow(0, GOLD); S.T.glowCol(0, GOLD); cap('同時，A 的列變成 Aᵀ 的行', 'A 第 1 列 (1, 3) → Aᵀ 第 1 行'); },
  (tok, S) => { S.R.unglow(); S.T.unglow(); hot('(Aᵀ)ᵢⱼ = Aⱼᵢ', 0, 1.3); ok(eqM(S.T.v, T2(L5R)), 'Aᵀ = ' + mstr(T2(L5R)) + ' ✓', 0, 0.6); cap('沿主對角線翻過去', '(Aᵀ)ᵢⱼ = Aⱼᵢ'); },
  (tok, S) => { S.R.glowCell(2, 0, GREEN); S.T.glowCell(0, 2, GREEN); cap('列號變行號、行號變列號', 'A 的 (3,1) = 4 → Aᵀ 的 (1,3) = 4'); },
]);
// 8 steps
const L5S = [[3, 1, 7], [1, 2, 9], [7, 9, 4]];
scene('mx-l5-sym', 'L5：對稱矩陣 Aᵀ = A', [
  (tok, S) => { hot('symmetric matrix（對稱矩陣）', 0, 6.3); cap('很多應用裡都會出現對稱矩陣', ''); },
  (tok, S) => { sm('對稱：Aᵀ = A，轉置後不變', 0, 5.7); cap('對稱的意思：轉置不改變它', 'Aᵀ = A'); },
  (tok, S) => {
    S.M = mview(L5S.map((r, i) => r.map((v, j) => (i === j ? v : ''))), -2.6, 3.4, { name: 'A', s: 1, colorOf: (v) => (v === '' ? '#ece3d3' : COL.a) });
    nt('對角線的數字是示意', -2.6, 1.4);
    cap('對角線上放什麼都可以', '');
  },
  ...[[0, 1], [0, 2], [1, 2]].map(([i, j]) => async (tok, S) => {
    S.M.unglow(); S.M.set(i, j, L5S[i][j]); S.M.glowCell(i, j, GOLD); await wt(tok, 500); S.M.set(j, i, L5S[j][i]); S.M.glowCell(j, i, GOLD);
    cap('上面放 ' + L5S[i][j] + '，對稱的位置也要是 ' + L5S[i][j], '(' + (i + 1) + ',' + (j + 1) + ') = (' + (j + 1) + ',' + (i + 1) + ')');
  }),
  (tok, S) => { S.M.unglow(); mview(T2(L5S), 2.8, 3.4, { name: 'Aᵀ', nameCls: 'ptr alt', s: 1, color: COL.b }); ok(eqM(T2(L5S), L5S), 'Aᵀ = A ✓', 2.8, 1.4); cap('轉置之後，得到同一個矩陣', ''); },
  (tok, S) => { sm('permutation：Pᵀ = P⁻¹（重要，但不容易看出）', 0, 0.7); sm('對稱：Aᵀ = A（一眼看出）', 0, 0.1); cap('對照：轉置剛好是反矩陣的 P', '對稱：轉置就是自己'); },
]);
// 13 steps
const RT = L5R, RR = T2(L5R), RTR = matMul(RT, RR);
scene('mx-l5-rtr', 'L5：RᵀR 一定對稱', [
  (tok, S) => {
    S.a = mview(RT, -5.0, 3.6, { name: 'Rᵀ（3×2）', s: 0.75 }); S.b = mview(RR, -2.3, 3.6, { name: 'R（2×3）', s: 0.75, color: COL.b });
    cap('這個長方形矩陣一點都不對稱', '轉置後連形狀都不一樣');
  },
  (tok, S) => { tag('×', 'val', -3.75, 3.6); tag('=', 'val', -0.7, 3.6); cap('把它們乘起來', ''); },
  (tok, S) => { S.P = mview(zeros(3, 3), 1.4, 3.6, Object.assign({ name: 'RᵀR', nameCls: 'ptr alt', s: 0.75 }, blankC)); hot('RᵀR 永遠對稱？', 4.6, 5.4); cap('RᵀR 一定是對稱矩陣', '先用數字算算看'); },
  ...[[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]].map(([i, j]) => (tok, S) => {
    S.a.unglow(); S.b.unglow(); S.P.unglow();
    S.a.glowRow(i, GOLD); S.b.glowCol(j, GOLD); S.P.set(i, j, RTR[i][j]); S.P.glowCell(i, j, GREEN);
    cap('(' + (i + 1) + ',' + (j + 1) + ')：' + vstr(RT[i]) + '·' + vstr(RT[j]) + ' = ' + RT[i].map((v, k) => v + '·' + RT[j][k]).join(' + ') + ' = ' + RTR[i][j], i > j ? '順序換了，數字一樣' : '');
  }),
  (tok, S) => {
    S.a.unglow(); S.b.unglow(); S.P.unglow();
    for (const [i, j] of [[1, 1], [1, 2], [2, 1], [2, 2]]) { S.P.set(i, j, RTR[i][j]); S.P.glowCell(i, j, GREEN); }
    ok(eqM(RTR, T2(RTR)), 'RᵀR = ' + mstr(RTR) + '：對稱 ✓', 1.4, 1.2);
    cap('再填四個數', '');
  },
  (tok, S) => { S.P.unglow(); S.f = hot('(RᵀR)ᵀ = ?', 4.6, 4.5); cap('為什麼一定對稱？轉置看看', '轉置後不變 = 對稱'); },
  (tok, S) => { txt(S.f, '(RᵀR)ᵀ = Rᵀ(Rᵀ)ᵀ'); cap('乘積的轉置：順序反過來', '(AB)ᵀ = BᵀAᵀ'); },
  (tok, S) => { txt(S.f, '(RᵀR)ᵀ = RᵀR'); good('(Rᵀ)ᵀ = R → 又回到 RᵀR ✓', 4.6, 3.8); cap('翻兩次 = 沒翻：(Rᵀ)ᵀ = R', ''); },
  (tok, S) => { sm('對稱矩陣常常就是這樣來的', 1.4, 0.5); cap('兩行就證完：RᵀR 永遠對稱', ''); },
]);
// 5 steps
scene('mx-l5-ops', 'L5：向量能相加、能乘數字', [
  (tok, S) => { hot('vector space（向量空間）、subspace（子空間）', 0, 6.3); S.bd = board(2.2, 3.0, 0.45, 5); cap('什麼是向量空間？', ''); },
  (tok, S) => {
    vec2(S.bd, COL.a, 1, 1); vec2(S.bd, COL.b, -1, 2); vec2(S.bd, COL.c, 0, 3, 0, 0, 0.14);
    sm('v', ...S.bd.P(1.4, 0.6).toArray()); sm('w', ...S.bd.P(-1.5, 1.7).toArray()); sm('v + w', ...S.bd.P(0.9, 3.2).toArray());
    sm('① 相加：v + w', -4.2, 5.2); nt('v、w 是示意', -4.2, 1.0);
    cap('向量可以相加', '');
  },
  (tok, S) => { vec2(S.bd, COL.hot, 3, 3, 0, 0, 0.06, 0.035); sm('3v', ...S.bd.P(3.4, 3.4).toArray()); sm('② 乘數字（scalar）：3v', -4.2, 4.5); cap('向量可以乘一個數字（scalar）', ''); },
  (tok, S) => { sm('還要滿足一些合理的規則', -4.2, 3.8); cap('能加、能乘，並且守規則', '才能叫一個向量空間'); },
  (tok, S) => { vec2(S.bd, COL.l, 1, 4, 0, 0, 0.16); sm('2v + w', ...S.bd.P(1.6, 4.4).toArray()); hot('線性組合：cv + dw', -4.2, 3.1); cap('能做線性組合', '例：2v + w'); },
]);
// 12 steps
scene('mx-l5-r2', 'L5：R² 與零向量', [
  (tok, S) => { S.bd = board(2.0, 3.0, 0.5, 4.5); hot('R²', -4.2, 6.0); cap('例子：R²', ''); },
  (tok, S) => { S.t1 = sm('R² = 所有「兩個實數」組成的向量', -3.6, 5.3); cap('R²：所有兩個分量的實數向量', ''); },
  (tok, S) => { sm('例：(3, 2)、(0, 0)、(π, e)…', -3.6, 4.7); cap('列不完，舉幾個', ''); },
  (tok, S) => { sm('(3, 2) + (π, e) = (3 + π, 2 + e)', -3.6, 4.1); cap('一個分量一個分量相加', ''); },
  (tok, S) => { vec2(S.bd, COL.a, 3, 2); sm('(3, 2)', ...S.bd.P(3.5, 2.4).toArray()); cap('畫出來：(3, 2) 是一支箭頭', ''); },
  (tok, S) => { S.z = dot(COL.red, 0.12); S.z.position.copy(S.bd.P(0, 0)).setZ(0.1); sm('(0, 0)', ...S.bd.P(-0.9, -0.5).toArray()); cap('零向量在原點', '最重要的向量'); },
  (tok, S) => { vec2(S.bd, COL.b, Math.PI, Math.E, 0, 0, 0.13); sm('(π, e)', ...S.bd.P(3.3, 3.3).toArray()); cap('(π, e)：π 比 3 多一點，e 比 2 多一點', ''); },
  (tok, S) => { const a = S.bd.P(-4.5, -4.5), b = S.bd.P(4.5, 4.5); poly([a, V3(b.x, a.y), b, V3(a.x, b.y)], '#4b9ee2', 0.12); sm('R² = 整個 xy 平面', -3.6, 3.5); cap('整個平面就是 R²', ''); },
  (tok, S) => { glow(S.z, null); S.z.material.color.set('#ffffff'); bad('挖掉原點？', ...S.bd.P(-2.0, -1.4).toArray()); cap('如果把原點挖掉呢？', ''); },
  async (tok, S) => {
    const a = arrow(COL.hot, 0.04); await anim(tok, 1200, (t) => setArrow(a, S.bd.P(0, 0).setZ(0.16), S.bd.P(3 * (1 - t), 2 * (1 - t)).setZ(0.16)));
    sm('0·(3, 2) = (0, 0)', -3.6, 2.9); cap('乘 0 的結果必須還在裡面', '0·(3, 2) = (0, 0)');
  },
  (tok, S) => { vec2(S.bd, COL.hot, -3, -2, 0, 0, 0.14, 0.04); sm('(3, 2) + (−3, −2) = (0, 0)', -3.6, 2.3); cap('(3, 2) 加 (−3, −2) 也回到原點', '少了原點，就不封閉'); },
  (tok, S) => { S.z.material.color.set(COL.red); good('每個向量空間都含有零向量', -3.6, 1.5); cap('每個向量空間都有零向量', ''); },
]);
// 5 steps
scene('mx-l5-rn', 'L5：R³ 與 Rⁿ', [
  (tok, S) => { S.sp = space([2.2, 1.6, 0], 0.55, 3.6); hot('R³：三個實數分量', -3.6, 6.0); cap('R³：所有三個分量的實數向量', ''); },
  (tok, S) => { vec3(S.sp, COL.a, [3, 2, 0]); sm('(3, 2, 0)', ...S.sp.P(3.4, 2.2, 0.4).toArray()); sm('(3, 2, 0) 在 R³：三個分量，剛好一個是 0', -3.6, 5.3); cap('(3, 2, 0) 在 R² 還是 R³？', 'R³：有三個分量'); },
  (tok, S) => { mview([['x₁'], ['x₂'], ['⋮'], ['xₙ']], -4.8, 2.8, { name: 'Rⁿ', s: 0.6 }); sm('Rⁿ：n 個實數分量的行向量', -2.6, 4.5); cap('Rⁿ：n 個分量的所有向量', '寫成行向量（column vector）'); },
  (tok, S) => { sm('相加、乘數字、取組合：都還在 Rⁿ 裡', -2.6, 3.9); cap('加、乘、組合，都留在裡面', ''); },
  (tok, S) => { sm('課本列了 8 條運算規則（Rⁿ 都滿足）', -2.6, 3.3); cap('還有 8 條運算規則', 'Rⁿ 都滿足'); },
]);
// 7 steps
scene('mx-l5-quarter', 'L5：四分之一平面不是向量空間', [
  (tok, S) => { S.bd = board(2.0, 3.0, 0.17, 16); hot('一個「不是」向量空間的例子', -3.8, 6.2); cap('看一個不行的例子', ''); },
  (tok, S) => { const a = S.bd.P(0, 0), b = S.bd.P(16, 16); poly([a, V3(b.x, a.y), b, V3(a.x, b.y)], '#2fc092', 0.22); sm('只取第一象限：分量 ≥ 0', -3.8, 5.4); cap('只取 R² 的四分之一', '兩個分量都不是負的'); },
  (tok, S) => { vec2(S.bd, COL.a, 2, 3); vec2(S.bd, COL.b, 5, 6); vec2(S.bd, COL.c, 7, 9, 0, 0, 0.14); ok(mv1(I2, [2 + 5, 3 + 6]).every((v) => v >= 0), '(2, 3) + (5, 6) = (7, 9)：還在裡面 ✓', -3.8, 4.7); cap('相加沒問題', ''); },
  async (tok, S) => { const a = arrow(COL.red, 0.05); await anim(tok, 1300, (t) => setArrow(a, S.bd.P(0, 0).setZ(0.15), S.bd.P(3 - 18 * t, 2 - 12 * t).setZ(0.15))); bad('(3, 2) × (−5) = (−15, −10)：跑出去了', -3.8, 4.0); cap('乘負數就跑出去了', ''); },
  (tok, S) => { hot('不封閉（not closed）', -3.8, 3.3); cap('對乘數字「不封閉」', '所以不是向量空間'); },
  (tok, S) => { sm('向量空間：對線性組合封閉', -3.8, 2.6); cap('向量空間要對加法和乘數字封閉', '也就是對線性組合封閉'); },
  (tok, S) => { good('在 R² 裡面、自己也是向量空間 → subspace', -3.8, 1.9); cap('在 R² 裡面又守規則的：子空間', ''); },
]);
// 8 steps
scene('mx-l5-line', 'L5：子空間一定過原點', [
  (tok, S) => { S.bd = board(2.0, 3.0, 0.42, 6); vec2(S.bd, COL.a, 2, 1, 0, 0, 0.16); sm('v', ...S.bd.P(2.3, 1.6).toArray()); nt('v = (2, 1) 是示意', -3.8, 0.9); cap('子空間裡有這個向量', ''); },
  (tok, S) => { vec2(S.bd, COL.b, 4, 2, 0, 0, 0.1, 0.035); sm('2v', ...S.bd.P(4.3, 2.6).toArray()); cap('那 2v 也必須在裡面', ''); },
  (tok, S) => { [0, 0.5, 0.75, -0.5, -1].forEach((c) => { const d = dot(COL.hot, 0.1); d.position.copy(S.bd.P(2 * c, c)).setZ(0.2); }); sm('0、½、¾、−½、−1 倍都要在', -3.8, 5.4); cap('乘任何數字都要在', ''); },
  (tok, S) => { const s = clipLine(1, -2, 0, 6); setRod(rod('#2f7fc0', 0.035), S.bd.P(...s[0]).setZ(0.05), S.bd.P(...s[1]).setZ(0.05)); hot('整條線：v 的所有倍數', -3.8, 4.7); cap('於是整條線都要在', ''); },
  (tok, S) => { ok(Math.abs(1 - 2 * 0.5) < 1e-9, '(2, 1) + (−1, −½) = (1, ½)：還在線上 ✓', -3.8, 4.0); cap('加法也沒問題', '線上加線上，還在線上'); },
  (tok, S) => { const s = clipLine(-0.5, 1, 2, 6); S.dl = dashed(S.bd.P(...s[0]).setZ(0.04), S.bd.P(...s[1]).setZ(0.04)); sm('虛線：不過原點的線', -3.8, 3.3); cap('如果是一條不過原點的線呢？', ''); },
  (tok, S) => { const d = dot(COL.red, 0.13); d.position.copy(S.bd.P(0, 0)).setZ(0.2); bad('乘 0 → 原點，不在虛線上', -3.8, 2.6); cap('虛線上的向量乘 0，跑到原點', '原點不在虛線上 → 不是子空間'); },
  (tok, S) => { good('每個子空間都一定包含零向量', -3.8, 1.9); cap('子空間一定要包含零向量', ''); },
]);
// 9 steps
scene('mx-l5-subs', 'L5：R²、R³ 的所有子空間', [
  (tok, S) => { S.bd = board(-3.0, 3.0, 0.3, 6); hot('R² 的子空間有哪些？', -3.0, 5.6); cap('R² 有哪些子空間？', ''); },
  (tok, S) => { const a = S.bd.P(-6, -6), b = S.bd.P(6, 6); poly([a, V3(b.x, a.y), b, V3(a.x, b.y)], '#4b9ee2', 0.14); sm('① 整個 R²', -5.2, 0.6); cap('第一種：整個 R²', '自己也算自己的子空間'); },
  (tok, S) => { [[1, -2], [1, 1]].forEach(([a, b]) => { const s = clipLine(a, b, 0, 6); setRod(rod('#2f7fc0', 0.03), S.bd.P(...s[0]).setZ(0.05), S.bd.P(...s[1]).setZ(0.05)); }); sm('② 任何過原點的直線 L', -3.0, 0.6); cap('第二種：過原點的直線', '兩邊無限延伸'); },
  (tok, S) => { sm('L ≠ R¹：L 上的向量有 2 個分量', -3.0, 0.0); cap('這條線是 R¹ 嗎？不是', 'L 上的向量有兩個分量'); },
  (tok, S) => { const d = dot(COL.red, 0.16); d.position.copy(S.bd.P(0, 0)).setZ(0.2); sm('③ 只有零向量 Z', -0.8, 0.6); cap('第三種：只有零向量', '叫它 Z'); },
  (tok, S) => { good('0 + 0 = 0、17·0 = 0 ✓', -3.0, -0.6); cap('加自己、乘 17，都還是 0', 'Z 也守規則'); },
  (tok, S) => { S.sp = space([3.4, 2.2, 0], 0.5, 2.6); const d = dot(COL.red, 0.12); d.position.copy(S.sp.P(0, 0, 0)); hot('R³：整個 R³、零向量 Z', 3.4, 5.6); cap('R³：最大是整個 R³，最小是零向量', ''); },
  (tok, S) => { plane3(S.sp, [1, -1, 2], 0, '#2fc092', 2.6); sm('過原點的平面', 3.4, 0.2); cap('還有過原點的平面', ''); },
  (tok, S) => { setRod(rod('#c08a1f', 0.035), S.sp.P(-2, -1, -1.2), S.sp.P(2, 1, 1.2)); sm('過原點的直線', 3.4, -0.4); cap('還有過原點的直線', ''); },
]);
// 13 steps
const CS1 = [1, 2, 4], CS2 = [3, 3, 1];
scene('mx-l5-colspace', 'L5：column space C(A) 是過原點的平面', [
  (tok, S) => { S.A = mview(L5R, -4.6, 4.6, { name: 'A', s: 0.8 }); cap('從這個矩陣造子空間', 'A = [1 3; 2 3; 4 1]'); },
  (tok, S) => { S.A.glowCol(0, GOLD); S.A.glowCol(1, GOLD); hot('從 A 的「行」出發', -4.6, 2.3); cap('一個子空間從行來', ''); },
  (tok, S) => { S.sp = space([1.8, 1.3, 0], 0.27, 11); vec3(S.sp, COL.a, CS1); vec3(S.sp, COL.b, CS2); sm('(1, 2, 4)', ...S.sp.P(1, 2, 4.8).toArray()); sm('(3, 3, 1)', ...S.sp.P(3.6, 3, 1.4).toArray()); cap('兩行都是 R³ 的向量', ''); },
  (tok, S) => { const v = CS1.map((x, k) => x + CS2[k]); vec3(S.sp, COL.c, v, 0.04); ok(eqM([v], [[4, 5, 5]]), '相加：(4, 5, 5) 要在 ✓', -4.6, 1.6); cap('只放兩行不夠：和也要在', ''); },
  (tok, S) => { const d = dot(COL.red, 0.12); d.position.copy(S.sp.P(0, 0, 0)); sm('乘 0 → (0, 0, 0) 要在', -4.6, 1.0); cap('乘 0 得到零向量，也要在', ''); },
  (tok, S) => { const v = CS1.map((x, k) => x + 3 * CS2[k]); vec3(S.sp, COL.hot, v, 0.04); ok(eqM([v], [[10, 11, 7]]), '1·第1行 + 3·第2行 = (10, 11, 7) ✓', -4.6, 0.4); cap('一份第 1 行加三份第 2 行', '也要在'); },
  (tok, S) => { sm('所有線性組合 → 一定是子空間', -4.6, -0.2); cap('把所有線性組合都放進來', '就保證是子空間'); },
  (tok, S) => { hot('column space：C(A)', 1.8, 6.2); cap('它叫 column space，寫成 C(A)', ''); },
  (tok, S) => { [CS1, CS2].forEach((c) => setRod(rod('#c9b48e', 0.025), S.sp.P(...c.map((v) => -1.1 * v)), S.sp.P(...c.map((v) => 1.6 * v)))); cap('每一行的倍數填滿一條線', '兩條線中間也會被填滿'); },
  (tok, S) => {
    const n = cross(CS1, CS2); plane3(S.sp, n, 0, '#2fc092', 3.6, [2, 2.5, 2.5]);
    ok(Math.abs(dot3(n, [10, 11, 7])) < 1e-9, '一個過原點的平面（(10, 11, 7) 也在上面 ✓）', 1.8, 5.5);
    cap('結果是一個過原點的平面', '');
  },
  (tok, S) => { sm('R¹⁰ 裡 5 個向量 → 某個過原點的平的子空間', 1.8, -0.4); cap('R¹⁰ 裡 5 個向量的組合呢？', '不是 R⁵：向量有 10 個分量'); },
  (tok, S) => { sm('兩行共線的話 → 只是一條線', 1.8, -1.0); cap('如果兩行在同一條線上', 'column space 就只是一條線'); },
  (tok, S) => { good('取行 → 取所有組合 → column space', -4.6, -0.8); cap('下一講：用 column space 看 Ax = b', ''); },
]);

// ═════════════════════════ MIT 18.06 L20：Cramer's Rule, Inverse Matrix, and Volume ═════════════════════════
const ABCD = [['a', 'b'], ['c', 'd']];
// 8 steps
scene('mx-l20-inv2', 'L20：2×2 反矩陣 = Cᵀ / det', [
  (tok, S) => {
    S.A = mview(ABCD, -4.6, 4.4, { name: 'A', s: 0.9 }); tag('⁻¹ =', 'val', -3.3, 4.4);
    S.k = hd('1 / (ad − bc) ·', -1.8, 4.4);
    S.I = mview([['d', '−b'], ['−c', 'a']], 0.4, 4.4, { name: 'A⁻¹', nameCls: 'ptr alt', s: 0.9, color: COL.b });
    cap('2×2 的反矩陣公式', '[a b; c d]⁻¹ = (1/(ad − bc))·[d −b; −c a]');
  },
  (tok, S) => { sm('除以 det A：只要 det ≠ 0 就行', -1.8, 2.6); cap('除以行列式', 'det ≠ 0 ⇔ 有反矩陣'); },
  (tok, S) => { S.A.glowRow(0, REDG); S.A.glowCol(0, REDG); S.A.glowCell(1, 1, GREEN); S.I.glowCell(0, 0, GREEN); sm('a 的 cofactor：劃掉第1列第1行 → d', -1.8, 2.0); cap('d 是 a 的 cofactor（餘因子）', '劃掉 a 所在的列和行，剩下 d'); },
  (tok, S) => { S.A.unglow(); S.I.unglow(); S.A.glowRow(1, REDG); S.A.glowCol(0, REDG); S.A.glowCell(0, 1, GREEN); S.I.glowCell(0, 1, GREEN); sm('c 的 cofactor：剩 b，(−1)²⁺¹ → −b', -1.8, 1.4); cap('−b 是 c 的 cofactor', 'c 在 (2,1)，2 + 1 是奇數 → 加負號'); },
  (tok, S) => { S.A.unglow(); S.I.unglow(); hot('A⁻¹ = (1 / det A)·Cᵀ', 3.6, 5.8); S.C = mview([['d', '−c'], ['−b', 'a']], 3.6, 4.4, { name: 'C（cofactor 矩陣）', s: 0.9, color: COL.l }); cap('公式：A⁻¹ = Cᵀ / det A', 'C 是 cofactor matrix，還要轉置'); },
  (tok, S) => { S.C.glowCell(0, 0, GOLD); S.I.glowCell(0, 0, GOLD); cap('C 的 (1,1) 是 a 的 cofactor = d', ''); },
  (tok, S) => { S.C.unglow(); S.I.unglow(); S.C.glowCell(1, 0, GOLD); S.I.glowCell(0, 1, GOLD); S.C.glowCell(0, 1, GREEN); S.I.glowCell(1, 0, GREEN); cap('因為轉置：位置對調', '(1,2) 放 c 的 cofactor −b，(2,1) 放 b 的 cofactor −c'); },
  (tok, S) => {
    S.C.unglow(); S.I.unglow(); S.C.glowCell(1, 1, GOLD); S.I.glowCell(1, 1, GOLD);
    const inv = scaleM(T2(cofMat(IVA)), 1 / detN(IVA));
    ok(eqM(matMul(IVA, inv), I2), '示意 [1 3; 2 7]：Cᵀ/det = ' + mstr(inv) + '，A·A⁻¹ = I ✓', 0, 0.6);
    cap('(2,2) 是 d 的 cofactor = a', '');
  },
]);
// 5 steps
const ABC9 = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']];
scene('mx-l20-inv3', 'L20：3×3：det 是 3 個數相乘，cofactor 是 2 個', [
  (tok, S) => { S.A = mview(ABC9, -3.6, 3.8, { name: 'A（3×3）', s: 0.9 }); cap('為什麼對？先看 3×3', ''); },
  (tok, S) => { [[0, 0], [1, 1], [2, 2]].forEach(([i, j]) => S.A.glowCell(i, j, GOLD)); sm('det A = aei + bfg + cdh − ceg − bdi − afh', 0, 1.3); cap('det：每一項是 3 個數相乘', 'aei + bfg + cdh − ceg − ⋯'); },
  (tok, S) => { S.A.unglow(); S.A.glowRow(0, REDG); S.A.glowCol(0, REDG); [[1, 1], [1, 2], [2, 1], [2, 2]].forEach(([i, j]) => S.A.glowCell(i, j, GREEN)); sm('a 的 cofactor = ei − fh：每項 2 個數', 0, 0.7); cap('a 的 cofactor = ei − fh', '每一項 2 個數相乘'); },
  (tok, S) => { hot('det：n 個數相乘；cofactor：n − 1 個', 2.4, 5.0); cap('n×n：det 用 n 個，cofactor 用 n − 1 個', ''); },
  (tok, S) => { sm('Gauss-Jordan 是演算法（algorithm）', 2.4, 4.2); sm('這裡是代數公式（algebra）', 2.4, 3.6); cap('以前用 Gauss-Jordan 算，不知道裡面發生什麼', '現在看到字母寫成的公式'); },
]);
// 12 steps
const PFA = [[2, 1, 1], [0, 3, 1], [1, 0, 2]];
scene('mx-l20-proof', 'L20：證明 A·Cᵀ = (det A)·I', [
  (tok, S) => { hot('檢查：A·A⁻¹ = I？', 0, 6.3); cap('檢查這個公式', 'A 乘 A⁻¹ 要得到 I'); },
  (tok, S) => {
    S.A = mview([['a₁₁', '⋯', 'a₁ₙ'], ['⋮', '', '⋮'], ['aₙ₁', '⋯', 'aₙₙ']], -4.3, 4.2, { name: 'A', s: 0.9 }); tag('×', 'val', -2.75, 4.2);
    S.C = mview([['C₁₁', '⋯', 'Cₙ₁'], ['⋮', '', '⋮'], ['C₁ₙ', '⋯', 'Cₙₙ']], -1.2, 4.2, { name: 'Cᵀ', s: 0.9, color: COL.l }); tag('=', 'val', 0.4, 4.2);
    S.R = mview([['?', '', '?'], ['', '?', ''], ['?', '', '?']], 2.4, 4.2, { name: '(det A)·I？', nameCls: 'ptr alt', s: 0.9, color: COL.c });
    cap('等於要證：A·Cᵀ = (det A)·I', '');
  },
  (tok, S) => { S.C.glowCol(0, GOLD); sm('Cᵀ 的第 1 行 = 第 1 列的 cofactor', -1.2, 2.4); cap('轉置過，所以 Cᵀ 的第 1 行是第 1 列的 cofactor', ''); },
  (tok, S) => { S.A.glowRow(0, GOLD); S.R.set(0, 0, 'det A'); S.R.glowCell(0, 0, GREEN); sm('a₁₁C₁₁ + ⋯ + a₁ₙC₁ₙ = det A', 0, 1.8); cap('(1,1) 元素 = 第 1 列的 cofactor 展開', '就是 det A'); },
  (tok, S) => { sm('2×2：a·d + b·(−c) = ad − bc ✓', 0, 1.2); cap('2×2 也對：ad − bc', ''); },
  (tok, S) => { S.A.unglow(); S.C.unglow(); S.R.set(1, 1, 'det A'); S.R.set(2, 2, 'det A'); [1, 2].forEach((k) => S.R.glowCell(k, k, GREEN)); cap('對角線每一格都一樣：det A', '每一列配自己的 cofactor'); },
  (tok, S) => { [[0, 2], [2, 0], [0, 1], [1, 0], [1, 2], [2, 1]].forEach(([i, j]) => S.R.glowCell(i, j, REDG)); cap('還差對角線以外：要是 0', ''); },
  (tok, S) => { sm('2×2：(a, b)·(第 2 列的 cofactor −b, a) = −ab + ba = 0', 0, 0.6); cap('2×2：第 1 列 × 第 2 列的 cofactor = 0', ''); },
  (tok, S) => { S.As = mview([['a', 'b'], ['a', 'b']], -4.8, 1.0, { name: 'Aₛ：兩列一樣', s: 0.7, color: COL.red }); cap('理由：其實在算一個「兩列相同」的矩陣的行列式', '這種矩陣 det = 0'); },
  (tok, S) => { S.As.glowRow(1, GOLD); sm('沿第 2 列展開：a·b + b·(−a) = 0', -4.8, -0.1); cap('沿第 2 列展開', 'a·b + b·(−a) = 0'); },
  (tok, S) => { [[0, 2], [2, 0], [0, 1], [1, 0], [1, 2], [2, 1]].forEach(([i, j]) => { S.R.set(i, j, 0); S.R.glowCell(i, j, null); }); sm('n×n：第 i 列 × 第 j 列的 cofactor = 兩列相同的 det = 0', 0, 0.0); cap('n×n 一樣：對角線外全是 0', ''); },
  (tok, S) => { const d = detN(PFA), pr = matMul(PFA, T2(cofMat(PFA))); ok(eqM(pr, scaleM(idn(3), d)), '示意 A = ' + mstr(PFA) + '：A·Cᵀ = ' + d + '·I ✓', 0, -0.6); cap('A·Cᵀ = (det A)·I：A⁻¹ = Cᵀ / det A', ''); },
]);
// 3 steps
const PTA = [[2, 1], [1, 1]], PTB = [[3, 1], [1, 1]];
scene('mx-l20-perturb', 'L20：改一個元素，反矩陣怎麼變', [
  (tok, S) => { S.A = mview(PTA, -3.8, 3.8, { name: 'A（示意）', s: 1 }); const inv = scaleM(T2(cofMat(PTA)), 1 / detN(PTA)); S.inv = mview(inv, 2.4, 3.8, { name: 'A⁻¹', nameCls: 'ptr alt', s: 1, color: COL.b }); ok(eqM(matMul(PTA, inv), I2), 'det = ' + detN(PTA) + '，A·A⁻¹ = I ✓', 2.4, 2.0); cap('一個可逆矩陣和它的反矩陣', ''); },
  (tok, S) => { S.A.set(0, 0, 3); S.A.glowCell(0, 0, GOLD); sm('a₁₁ 加 1 → det 變成 ' + detN(PTB), -3.8, 2.0); cap('把一個元素加 1', '反矩陣會怎樣？'); },
  (tok, S) => { const inv = scaleM(T2(cofMat(PTB)), 1 / detN(PTB)); gone(S.inv); mview(inv, 2.4, 3.8, { name: '新的 A⁻¹ = Cᵀ/det', nameCls: 'ptr alt', s: 1, color: COL.b }); ok(eqM(matMul(PTB, inv), I2), '看 det 和每個 cofactor 怎麼變 ✓', 2.4, 1.4); cap('看 det 和 cofactor 怎麼變', '公式全部告訴你'); },
]);
// 10 steps
const CRA = [[2, 1], [1, 3]], CRb = [5, 10];
const CRB1 = [[5, 1], [10, 3]], CRB2 = [[2, 5], [1, 10]];
scene('mx-l20-cramer', "L20：Cramer's rule xⱼ = det Bⱼ / det A", [
  (tok, S) => {
    S.A = mview(CRA, -4.6, 4.6, { name: 'A', s: 0.8 }); S.x = mview([['x₁'], ['x₂']], -3.0, 4.6, { name: 'x', s: 0.8, color: '#e9dcc4' }); tag('=', 'val', -2.2, 4.6);
    S.b = mview(CRb.map((v) => [v]), -1.4, 4.6, { name: 'b', s: 0.8, color: COL.b }); nt('數字是示意', -3.0, 3.0);
    sm('x = A⁻¹b', 2.4, 5.6); cap('Ax = b 的解：x = A⁻¹b', '');
  },
  (tok, S) => { sm('= (1 / det A)·Cᵀb', 2.4, 5.0); cap('代入剛才的公式', 'x = Cᵀb / det A'); },
  (tok, S) => { ok(detN(CRA) === 5, 'det A = 2·3 − 1·1 = 5：一定在分母 ✓', 2.4, 4.4); cap('答案一定除以 det A', ''); },
  (tok, S) => { S.x.glowCell(0, 0, GOLD); cap('先看第一個分量 x₁', ''); },
  (tok, S) => { sm('Cᵀb 的第 1 個 = C₁₁b₁ + C₂₁b₂ = det(B₁)', 2.4, 3.8); cap('cofactor 乘 b 的元素 → 某個矩陣的行列式', '叫它 B₁'); },
  (tok, S) => { sm('x₂ = det(B₂) / det A', 2.4, 3.2); cap('x₂ 也一樣：det(B₂) / det A', ''); },
  async (tok, S) => {
    S.B1 = mview(CRA, -3.2, 1.3, { name: 'B₁：第 1 行換成 b', s: 0.8 }); S.B1.glowCol(0, GOLD);
    await Promise.all([0, 1].map((i) => ghostFly(tok, CRb[i], S.b.X(0), S.b.Y(i), S.B1.X(0), S.B1.Y(i), 900, 0.5, COL.b)));
    [0, 1].forEach((i) => S.B1.set(i, 0, CRb[i]));
    cap('B₁ = 把 A 的第 1 行換成 b', '其他行不變');
  },
  (tok, S) => {
    const c = cofMat(CRA), e = c[0][0] * CRb[0] + c[1][0] * CRb[1];
    ok(e === detN(CRB1), '沿第 1 行展開：' + c[0][0] + '·5 + (' + c[1][0] + ')·10 = ' + e + ' = det B₁ ✓', 2.4, 2.4);
    sm('x₁ = ' + detN(CRB1) + ' / ' + detN(CRA) + ' = ' + fmt(detN(CRB1) / detN(CRA)), 2.4, 1.8);
    cap('沿第 1 行做 cofactor 展開', '正好是 C₁₁b₁ + C₂₁b₂');
  },
  (tok, S) => {
    S.B1.glowCol(0, null); mview(CRB2, -0.6, 1.3, { name: 'B₂：第 2 行換成 b', s: 0.8 }).glowCol(1, GOLD);
    const x = [detN(CRB1) / detN(CRA), detN(CRB2) / detN(CRA)];
    S.x.set(0, 0, x[0]); S.x.set(1, 0, x[1]);
    ok(eqM([mv1(CRA, x)], [CRb]), 'x₂ = ' + detN(CRB2) + ' / 5 = ' + fmt(x[1]) + '；檢查 Ax = b ✓', 2.4, 1.2);
    cap('一般：Bⱼ = A 的第 j 行換成 b', 'xⱼ = det(Bⱼ) / det(A)');
  },
  (tok, S) => { sm('n 個未知數：要算 n + 1 個行列式', 2.4, 0.4); cap('實際好用嗎？', '要算 n + 1 個行列式'); },
]);
// 2 steps
scene('mx-l20-cramer2', "L20：Cramer's rule 實際上很慢", [
  (tok, S) => {
    const n = 10, terms = fact(n) * (n + 1), elim = Math.round(n ** 3 / 3);
    hot('n = 10 的方程組', 0, 6.0);
    bad('Cramer（用展開算行列式）：11 個 det × 10! 項 ≈ ' + terms.toLocaleString('en-US') + ' 項', 0, 5.0);
    good('elimination：約 n³/3 ≈ ' + elim + ' 次乘法', 0, 4.2);
    cap('算這些行列式要算到天荒地老', 'elimination 一下就好');
  },
  (tok, S) => { sm('公式的價值：用字母做代數，不是拿來算數字', 0, 3.2); sm('MATLAB 也是用 elimination', 0, 2.5); cap('公式拿來做代數推導', '真的要算，用消去法'); },
]);
// 9 steps
const VR = [[2, 1, 0], [0, 2, 1], [1, 0, 2]];
scene('mx-l20-volume', 'L20：|det A| = 盒子的體積', [
  (tok, S) => { hot('行列式 = 體積', 0, 6.3); cap('第三個應用：行列式是體積', ''); },
  (tok, S) => { S.M = mview(VR, -4.6, 4.5, { name: 'A（示意）', s: 0.7 }); S.sp = space([1.4, 1.2, 0], 0.8, 3.6); sm('det A = 盒子的體積', -4.6, 2.6); cap('det A = 某個盒子的體積', '哪個盒子？'); },
  ...[0, 1, 2].map((k) => (tok, S) => {
    S.M.unglow(); S.M.glowRow(k, GOLD); vec3(S.sp, [COL.a, COL.b, COL.c][k], VR[k], 0.055);
    sm('第' + (k + 1) + '列 ' + vstr(VR[k]), ...S.sp.P(...VR[k].map((v) => v * 1.15)).toArray());
    cap('第 ' + (k + 1) + ' 列 = 盒子的一條邊', '從原點畫到 ' + vstr(VR[k]));
  }),
  (tok, S) => { S.M.unglow(); S.box = pbox(S.sp, ...VR); cap('把盒子補完整', '每一面都是平行四邊形（parallelepiped）'); },
  (tok, S) => { const d = detN(VR), v = dot3(VR[0], cross(VR[1], VR[2])); ok(d === v, 'det A = ' + d + ' = 盒子體積 ✓', -4.6, 2.0); cap('這個盒子的體積 = det A', ''); },
  (tok, S) => { sm('det 可能是負的 → 體積取 |det A|', -4.6, 1.4); cap('det 是負的怎麼辦？', '體積取絕對值'); },
  (tok, S) => { const sw = [VR[1], VR[0], VR[2]]; ok(detN(sw) === -detN(VR), '兩條邊對調：盒子一樣，det = ' + detN(sw) + '（變號）✓', -4.6, 0.8); cap('正負號：右手盒還是左手盒', '對調兩列，體積不變、det 變號'); },
]);
// 9 steps
const QA = matMul([[1, 0, 0], [0, Math.cos(0.5), -Math.sin(0.5)], [0, Math.sin(0.5), Math.cos(0.5)]], [[Math.cos(0.7), -Math.sin(0.7), 0], [Math.sin(0.7), Math.cos(0.7), 0], [0, 0, 1]]);
scene('mx-l20-cube', 'L20：I、Q 的盒子都是單位立方體', [
  (tok, S) => { S.M = mview(idn(3), -4.6, 4.6, { name: 'A = I', s: 0.65, hideZero: true }); S.sp = space([1.6, 1.4, 0], 1.25, 2); [0, 1, 2].forEach((k) => vec3(S.sp, [COL.a, COL.b, COL.c][k], idn(3)[k], 0.05)); cap('特例：A = I', '三列 = 三個座標軸方向'); },
  (tok, S) => { S.box = pbox(S.sp, ...idn(3)); ok(detN(idn(3)) === 1, '單位立方體：體積 1 = det I ✓', -4.6, 2.6); cap('盒子是單位立方體', '體積 1 = det I'); },
  (tok, S) => { sm('策略：體積也滿足 det 的三個性質 → 體積 = det', -2.6, 6.2); cap('證明策略', '體積也滿足定義 det 的三個性質'); },
  (tok, S) => { gone(S.M); S.M = mview(QA, -4.6, 4.6, { name: 'Q（示意）', s: 0.65 }); hot('Q：orthonormal columns', -4.6, 2.0); cap('再看 orthogonal matrix Q', '行是互相垂直的單位向量'); },
  async (tok, S) => {
    const Rz = (t) => [[Math.cos(0.7 * t), -Math.sin(0.7 * t), 0], [Math.sin(0.7 * t), Math.cos(0.7 * t), 0], [0, 0, 1]];
    const Rx = (t) => [[1, 0, 0], [0, Math.cos(0.5 * t), -Math.sin(0.5 * t)], [0, Math.sin(0.5 * t), Math.cos(0.5 * t)]];
    await anim(tok, 1800, (t) => { const Q = matMul(Rx(t), Rz(t)); S.box.userData.set(...Q); });
    sm('還是單位立方體，只是轉了方向 → 體積 1', 1.6, -0.2);
    cap('盒子還是立方體，只是轉了', '體積還是 1');
  },
  (tok, S) => { hot('det Q = ±1？', -4.6, 1.3); cap('那 det Q 應該是 1 或 −1', ''); },
  (tok, S) => { ok(eqM(matMul(T2(QA), QA), idn(3)), 'QᵀQ = I ✓', -4.6, 0.6); cap('Q 的性質：QᵀQ = I', ''); },
  (tok, S) => { sm('兩邊取 det：det(Qᵀ)·det(Q) = det(I) = 1', -2.6, -0.1); cap('兩邊取行列式', '乘積的 det = det 相乘'); },
  (tok, S) => { const d = detN(QA); ok(Math.abs(Math.abs(d) - 1) < 1e-9, 'det Qᵀ = det Q → (det Q)² = 1 → det Q = ' + fmt(d) + ' ✓', -2.6, -0.7); cap('det Qᵀ = det Q，所以 (det Q)² = 1', 'det Q = ±1'); },
]);
// 5 steps
scene('mx-l20-stretch', 'L20：拉長一條邊 → 體積、det 都加倍', [
  (tok, S) => { S.sp = space([0.8, 1.2, 0], 1.0, 2.6); S.box = pbox(S.sp, [1, 0, 0], [0, 1, 0], [0, 0, 1]); hot('先看直角的盒子', -4.4, 6.0); cap('先看所有角都是直角的盒子', ''); },
  async (tok, S) => { await anim(tok, 1400, (t) => S.box.userData.set([1 + t, 0, 0], [0, 1, 0], [0, 0, 1])); cap('把第一條邊拉成兩倍', '其他邊不變'); },
  (tok, S) => { const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#c08a1f' })); g.position.copy(S.sp.P(1.5, 0.5, 0.5)); lab.world.add(g); good('兩個一樣的立方體 → 體積 2', -4.4, 5.2); cap('體積變成兩倍', '兩個一模一樣的立方體'); },
  (tok, S) => { const M = [[2, 0, 0], [0, 1, 0], [0, 0, 1]]; mview(M, -4.4, 3.4, { name: '第 1 列乘 2', s: 0.6, hideZero: true }); ok(detN(M) === 2 * detN(idn(3)), 'det：第 1 列的 2 提出來（性質 3a）→ 2 ✓', -4.4, 1.6); cap('det 也加倍', '性質 3a：一列的倍數可以提出來'); },
  (tok, S) => { sm('還要處理不是直角的盒子 → 性質 3b', -4.4, 0.9); cap('還差：角度不是直角的情形', '要檢查性質 3b'); },
]);
// 10 steps
const PA2 = [3, 1], PB2 = [1, 2];
scene('mx-l20-area', 'L20：平行四邊形面積 = ad − bc', [
  (tok, S) => { hot('det A = 盒子體積：逐條檢查性質', -3.4, 6.2); good('性質 1：單位立方體體積 1 ✓', -3.4, 5.5); cap('性質 1：單位立方體', '沒問題'); },
  (tok, S) => { sm('性質 2：換兩列 → 同一個盒子（只差正負號）', -3.4, 4.9); cap('性質 2：換兩列', '盒子不變，絕對值不變'); },
  (tok, S) => { sm('性質 3a：一列乘 t → 體積乘 t', -3.4, 4.3); cap('性質 3a：一列乘 t', ''); },
  (tok, S) => { sm('性質 3b：|a+a′ b+b′; c d| = |a b; c d| + |a′ b′; c d|', -3.4, 3.7); cap('性質 3b：對第 1 列是線性的', ''); },
  (tok, S) => { hot('2×2：體積就是面積', -3.4, 3.0); cap('2×2 的「體積」就是面積', ''); },
  (tok, S) => {
    S.bd = board(3.2, 2.6, 0.55, 4);
    const O = S.bd.P(0, 0), A = S.bd.P(...PA2), B = S.bd.P(...PB2), C = S.bd.P(PA2[0] + PB2[0], PA2[1] + PB2[1]);
    S.par = poly([O, A, C, B], '#4b9ee2', 0.25); vec2(S.bd, COL.a, ...PA2); vec2(S.bd, COL.b, ...PB2);
    sm('(a, b) = (3, 1)', ...S.bd.P(3.6, 0.4).toArray()); sm('(c, d) = (1, 2)', ...S.bd.P(0.2, 2.6).toArray()); sm('(a+c, b+d)', ...S.bd.P(4.0, 3.6).toArray());
    nt('座標是示意', 3.2, 0.0);
    cap('平行四邊形：(a, b) 和 (c, d)', '第四個角在 (a + c, b + d)');
  },
  (tok, S) => {
    const base = Math.hypot(...PA2), u = PA2.map((v) => v / base), pr = dot3([...PB2, 0], [...u, 0]), h = Math.hypot(PB2[0] - pr * u[0], PB2[1] - pr * u[1]);
    S.bh = base * h;
    sm('底 × 高 = √10 × ' + h.toFixed(3) + ' ≈ ' + S.bh.toFixed(3), -3.4, 2.3); cap('以前的算法：底 × 高', '要開根號、求高……很麻煩');
  },
  (tok, S) => { const d = det2([PA2, PB2]); ok(Math.abs(d - S.bh) < 1e-9, 'ad − bc = 3·2 − 1·1 = ' + d + '：一樣 ✓', -3.4, 1.6); cap('現在：面積 = ad − bc', '沒有根號'); },
  (tok, S) => { sm('只用角落座標：不用長度、角度、高', -3.4, 0.9); cap('只要知道角落座標就好', ''); },
  (tok, S) => { poly([S.bd.P(0, 0), S.bd.P(...PA2), S.bd.P(...PB2)], '#e55a9b', 0.35, 0.04); ok(det2([PA2, PB2]) / 2 === 2.5, '三角形 = ½(ad − bc) = 2.5 ✓', -3.4, 0.2); cap('三角形：剛好一半', '½(ad − bc)'); },
]);
// 5 steps
const TRI = [[1, 1], [4, 2], [2, 4]];
scene('mx-l20-tri', 'L20：任意三角形面積 = ½ det', [
  (tok, S) => { S.bd = board(3.0, 2.8, 0.5, 5); S.tr = poly(TRI.map((p) => S.bd.P(...p)), '#e55a9b', 0.32); TRI.forEach((p, k) => sm('(x' + sub(k + 1) + ', y' + sub(k + 1) + ') = ' + vstr(p), ...S.bd.P(p[0] + 0.3, p[1] + 0.55).toArray())); nt('座標是示意', 3.0, -0.2); cap('三角形不在原點也行', '給任意三個角'); },
  (tok, S) => { hot('六個數字就決定面積', -3.6, 6.0); cap('六個數字決定面積', ''); },
  (tok, S) => { S.M3 = TRI.map(([x, y]) => [x, y, 1]); S.m = mview(S.M3, -3.6, 4.2, { name: '[xᵢ yᵢ 1]', s: 0.7 }); S.area = detN(S.M3) / 2; sm('面積 = ½·det = ½·' + detN(S.M3) + ' = ' + fmt(S.area), -3.6, 2.6); cap('面積 = ½·det [x₁ y₁ 1; x₂ y₂ 1; x₃ y₃ 1]', ''); },
  async (tok, S) => {
    const M = S.M3.map((r, i) => (i ? r.map((v, j) => v - S.M3[0][j]) : r));
    for (let i = 1; i < 3; i++) for (let j = 0; j < 3; j++) S.m.set(i, j, M[i][j]);
    const pts = TRI.map(([x, y]) => [x - TRI[0][0], y - TRI[0][1]]);
    const t2 = poly(pts.map((p) => S.bd.P(...p)), '#2fc092', 0.3, 0.05);
    const shoe = Math.abs(pts[1][0] * pts[2][1] - pts[1][1] * pts[2][0]) / 2;
    await wt(tok, 200);
    ok(Math.abs(shoe - S.area) < 1e-9 && detN(M) === detN(S.M3), '減掉第 1 列 = 把三角形移到原點：½(3·3 − 1·1) = ' + fmt(shoe) + ' ✓', -3.6, 1.9);
    cap('第 2、3 列減第 1 列', '等於把三角形搬到原點');
  },
  (tok, S) => { good('面積、體積：行列式給出漂亮的公式', -3.6, 1.2); cap('面積和體積：行列式就是好公式', '下一講：eigenvalues'); },
]);

// ═════════════════════════ 3Blue1Brown：Matrix multiplication as composition ═════════════════════════
const RC0 = [[1, 3], [-2, 0]], RCv = [-1, 2];
function gv3(S, ox = 2.0, oy = 3.0, s = 0.4, ext = 6) { S.gv = gridView(ox, oy, s, ext, 2); S.bd = S.gv.bd; }
// 7 steps
scene('mx-3b-recap', '3B1B：複習：矩陣 = 線性變換', [
  (tok, S) => { gv3(S); hot('線性變換：輸入向量、輸出向量', -3.8, 6.0); cap('複習：線性變換', ''); },
  async (tok, S) => { nt('這個變換是示意', -3.8, 0.8); S.M = await tfTo(tok, S.gv, I2, RC0, 1600); sm('格線保持平行、等距；原點不動', -3.8, 5.3); cap('把空間「捏」一捏', '格線平行又等距，原點不動'); },
  (tok, S) => { sm('î → (1, −2)、ĵ → (3, 0)', -3.8, 4.6); cap('只要知道 î、ĵ 跑到哪裡', '整個變換就決定了'); },
  async (tok, S) => {
    await tfTo(tok, S.gv, RC0, I2, 900);
    S.v = arrow(COL.hot, 0.06); setArrow(S.v, S.bd.P(0, 0).setZ(0.12), S.bd.P(...RCv).setZ(0.12));
    sm('v = (−1, 2) = −1·î + 2·ĵ', -3.8, 3.9); cap('任何向量都是 î、ĵ 的組合', '(x, y) = x·î + y·ĵ');
  },
  async (tok, S) => {
    await tfTo(tok, S.gv, I2, RC0, 1600, (M) => setArrow(S.v, S.bd.P(0, 0).setZ(0.12), S.bd.P(...mv1(M, RCv)).setZ(0.12)));
    const w = mv1(RC0, RCv); ok(eqM([w], [[5, 2]]), '落點 = −1·(1, −2) + 2·(3, 0) = ' + vstr(w) + ' ✓', -3.8, 3.2);
    cap('變換後：還是同樣的組合', 'x·(新的 î) + y·(新的 ĵ)');
  },
  (tok, S) => { mview(RC0, -3.8, 1.2, { name: '矩陣：兩行 = î、ĵ 的落點', s: 0.7 }); cap('把 î、ĵ 的落點寫成矩陣的兩行', ''); },
  (tok, S) => { sm('矩陣 × 向量 = 套用這個變換', 0.0, 6.2); cap('矩陣乘向量 = 把變換用在向量上', ''); },
]);
// 11 steps
const SR = matMul(SH, R90), CV = [1, 2];
scene('mx-3b-comp', '3B1B：先旋轉、再 shear：合成矩陣', [
  (tok, S) => { gv3(S, 2.0, 3.0, 0.5, 4.5); S.M = I2; hot('先做一個變換，再做另一個', -3.8, 6.0); cap('先做一個變換，再做另一個', ''); },
  async (tok, S) => { S.M = await tfRot(tok, S.gv, S.M, Math.PI / 2, 1400); mview(R90, -4.6, 4.4, { name: '旋轉 90°', s: 0.6 }); cap('先逆時針轉 90°', ''); },
  async (tok, S) => { S.M = await tfTo(tok, S.gv, S.M, SR, 1400); mview(SH, -2.6, 4.4, { name: 'shear', s: 0.6, color: COL.b }); cap('再做 shear（剪切）', ''); },
  (tok, S) => { sm('整體效果 = 另一個線性變換：composition', -3.8, 3.2); cap('從頭到尾的效果：合成（composition）', '它也是一個線性變換'); },
  (tok, S) => { S.C = mview([[SR[0][0], '?'], [SR[1][0], '?']], -3.8, 1.8, { name: '合成矩陣', nameCls: 'ptr alt', s: 0.6, color: COL.c }); S.C.glowCol(0, GREEN); cap('跟著 î：最後落在 (1, 1)', '這是第 1 行'); },
  (tok, S) => { S.C.set(0, 1, SR[0][1]); S.C.set(1, 1, SR[1][1]); S.C.glowCol(1, COL.red); cap('跟著 ĵ：最後落在 (−1, 0)', '這是第 2 行'); },
  async (tok, S) => { S.C.unglow(); await tfTo(tok, S.gv, SR, I2, 700); await tfTo(tok, S.gv, I2, SR, 1300); cap('一個矩陣，一步做完', '旋轉 + shear 的總效果'); },
  (tok, S) => { const Rv = mv1(R90, CV), SRv = mv1(SH, Rv); S.lg = SRv; sm('v = (1, 2)（示意）：先 R → ' + vstr(Rv) + '，再 S → ' + vstr(SRv), 1.6, 0.2); cap('慢的算法：先乘旋轉，再乘 shear', 'S(Rv)'); },
  (tok, S) => { const d = mv1(SR, CV); ok(eqM([d], [S.lg]), '直接用合成矩陣：' + vstr(d) + '，一樣 ✓', 1.6, -0.4); cap('直接用合成矩陣乘', '結果一樣'); },
  (tok, S) => { hot('這個新矩陣 = 乘積 SR', -4.2, 0.5); cap('所以把它叫做兩個矩陣的乘積', ''); },
  (tok, S) => { good('相乘 = 先做一個變換，再做另一個', -4.2, -0.1); cap('別忘了乘法的幾何意義', ''); },
]);
// 2 steps
scene('mx-3b-rtl', '3B1B：從右往左讀', [
  (tok, S) => {
    mview(SH, -1.2, 3.6, { name: 'S（shear）', s: 0.8, color: COL.b }); mview(R90, 1.2, 3.6, { name: 'R（旋轉）', s: 0.8 });
    const a = arrow(COL.hot, 0.05); setArrow(a, V3(2.6, 2.3, 0.2), V3(-2.4, 2.3, 0.2));
    sm('① 先做 R', 1.2, 1.8); sm('② 再做 S', -1.2, 1.8);
    cap('從右往左讀', '右邊的先做，左邊的後做');
  },
  (tok, S) => { hot('S(R(v))：就像函數 f(g(x))', 0, 0.9); cap('來自函數寫法：f(g(x))', '先算 g，再算 f'); },
]);
// 7 steps
const M1 = [[1, -2], [1, 0]], M2 = [[0, 2], [1, 0]], M21 = matMul(M2, M1);
scene('mx-3b-m1m2', '3B1B：M₂M₁ 一行一行算', [
  async (tok, S) => { gv3(S, 2.2, 3.0, 0.38, 6); S.m1 = mview(M1, -4.8, 4.9, { name: 'M₁', s: 0.6 }); await tfTo(tok, S.gv, I2, M1, 1300); cap('M₁：兩行是 (1, 1) 和 (−2, 0)', ''); },
  async (tok, S) => { S.m2 = mview(M2, -2.9, 4.9, { name: 'M₂', s: 0.6, color: COL.b }); await tfTo(tok, S.gv, M1, M2, 1300); cap('M₂：兩行是 (0, 1) 和 (2, 0)', ''); },
  async (tok, S) => { await tfTo(tok, S.gv, M2, I2, 500); await tfTo(tok, S.gv, I2, M1, 900); await tfTo(tok, S.gv, M1, M21, 1000); S.C = mview([['?', '?'], ['?', '?']], -3.8, 2.6, { name: 'M₂M₁', nameCls: 'ptr alt', s: 0.6, color: COL.c }); cap('先 M₁ 再 M₂：合成矩陣是？', '這次只用數字算'); },
  (tok, S) => { S.m1.glowCol(0, GOLD); sm('î 先到 M₁ 的第 1 行 (1, 1)', -3.8, 1.1); cap('î 經過 M₁：到 (1, 1)', '就是 M₁ 的第 1 行'); },
  (tok, S) => { const c = mv1(M2, colOf(M1, 0)); S.C.set(0, 0, c[0]); S.C.set(1, 0, c[1]); S.C.glowCol(0, GREEN); sm('M₂·(1, 1) = ' + vstr(c), -3.8, 0.5); cap('再乘 M₂', '得到 (2, 1)：合成矩陣的第 1 行'); },
  (tok, S) => { S.m1.unglow(); S.m1.glowCol(1, GOLD); sm('ĵ 先到 M₁ 的第 2 行 (−2, 0)', -0.6, 1.1); cap('ĵ 經過 M₁：到 (−2, 0)', ''); },
  (tok, S) => { const c = mv1(M2, colOf(M1, 1)); S.C.set(0, 1, c[0]); S.C.set(1, 1, c[1]); S.C.glowCol(1, GREEN); ok(eqM(S.C.v, M21), 'M₂·(−2, 0) = ' + vstr(c) + ' → M₂M₁ = ' + mstr(M21) + ' ✓', -0.6, 0.5); cap('再乘 M₂ 得 (0, −2)', '合成矩陣的第 2 行'); },
]);
// 5 steps
scene('mx-3b-sym', '3B1B：用字母看：左矩陣 × 右矩陣的每一行', [
  (tok, S) => { S.L = mview([['a', 'b'], ['c', 'd']], -4.4, 4.2, { name: '左（後做）', s: 0.9 }); S.R = mview([['e', 'f'], ['g', 'h']], -2.0, 4.2, { name: '右（先做）', s: 0.9, color: COL.b }); tag('=', 'val', -0.6, 4.2); cap('換成字母：對任何矩陣都成立', ''); },
  (tok, S) => { S.R.glowCol(0, GOLD); sm('î 先到右矩陣的第 1 行 (e, g)', -2.0, 2.4); cap('î 先到右邊矩陣的第 1 行', ''); },
  (tok, S) => { S.C = mview([['ae + bg', '?'], ['ce + dg', '?']], 2.4, 4.2, { name: '合成', nameCls: 'ptr alt', s: 1.3, color: COL.c }); S.C.glowCol(0, GREEN); cap('左矩陣乘這一行 = 合成的第 1 行', '(ae + bg, ce + dg)'); },
  (tok, S) => {
    S.R.unglow(); S.R.glowCol(1, GOLD); S.C.set(0, 1, 'af + bh'); S.C.set(1, 1, 'cf + dh'); S.C.glowCol(1, GREEN);
    const [a, b, c, d] = M2.flat(), [e, f, g, h] = M1.flat();
    ok(eqM([[a * e + b * g, a * f + b * h], [c * e + d * g, c * f + d * h]], M21), '代入 M₂、M₁：' + mstr(M21) + ' ✓', 2.4, 2.2);
    cap('ĵ：左矩陣乘右矩陣的第 2 行', '(af + bh, cf + dh)');
  },
  (tok, S) => { sm('先別死背：想成「先做一個，再做另一個」', 0, 0.8); cap('背公式之前，先想它代表什麼', ''); },
]);
// 6 steps
const RS = matMul(R90, SH);
scene('mx-3b-order', '3B1B：順序重要：RS ≠ SR', [
  (tok, S) => { S.g1 = gridView(-3.0, 3.0, 0.42, 4.5, 2); S.g2 = gridView(3.0, 3.0, 0.42, 4.5, 2); hot('順序重要嗎？', 0, 6.3); cap('相乘的順序有關係嗎？', ''); },
  (tok, S) => { sm('shear：î 不動、ĵ 推向右；rotation：轉 90°', 0, 5.7); cap('拿 shear 和 90° 旋轉來試', ''); },
  async (tok, S) => { let M = await tfTo(tok, S.g1, I2, SH, 1100); M = await tfRot(tok, S.g1, M, Math.PI / 2, 1100); ok(eqM(M, RS) && eqM(RS, [[0, -1], [1, 1]]), '先 shear 再轉：î → (0, 1)、ĵ → (−1, 1) ✓', -3.0, 0.3); cap('先 shear 再旋轉', 'î 到 (0, 1)、ĵ 到 (−1, 1)：靠得很近'); },
  async (tok, S) => { let M = await tfRot(tok, S.g2, I2, Math.PI / 2, 1100); M = await tfTo(tok, S.g2, M, SR, 1100); ok(eqM(M, SR) && eqM(SR, [[1, -1], [1, 0]]), '先轉再 shear：î → (1, 1)、ĵ → (−1, 0) ✓', 3.0, 0.3); cap('先旋轉再 shear', 'î 到 (1, 1)、ĵ 到 (−1, 0)：離得比較遠'); },
  (tok, S) => { ok(!eqM(RS, SR), 'RS ≠ SR → 順序很重要 ✓', 0, -0.4); cap('結果明顯不同', '順序很重要'); },
  (tok, S) => { sm('想成變換，在腦中就看得出來，不用算', 0, -1.0); cap('用變換想，腦中就能看出來', ''); },
]);
// 5 steps
const AA = [[2, 0], [0, 1]], AB_ = R90, AC = SH;
scene('mx-3b-assoc', '3B1B：結合律 (AB)C = A(BC)', [
  (tok, S) => { hot('結合律：(AB)C = A(BC)？', -3.4, 6.0); gv3(S, 2.4, 3.0, 0.42, 5.5); cap('作業題：證明矩陣乘法有結合律', '括號放哪裡都一樣'); },
  (tok, S) => { bad('用數字硬算：很可怕，也看不出道理', -3.4, 5.2); cap('用數字算：又累又看不懂', ''); },
  async (tok, S) => {
    nt('C = shear、B = 轉 90°、A = 橫向拉長 2 倍（示意）', -3.4, 4.4);
    let M = await tfTo(tok, S.gv, I2, AC, 800); M = await tfRot(tok, S.gv, M, Math.PI / 2, 800); M = await tfTo(tok, S.gv, M, matMul(AA, M), 800);
    sm('不管括號：都是先 C、再 B、再 A', -3.4, 3.6);
    cap('都是：先 C，再 B，再 A', '同樣三件事、同樣的順序');
  },
  (tok, S) => { const l = matMul(matMul(AA, AB_), AC), r = matMul(AA, matMul(AB_, AC)); ok(eqM(l, r), '(AB)C = A(BC) = ' + mstr(l) + ' ✓', -3.4, 2.8); cap('這就是貨真價實的證明', '而且說明了為什麼'); },
  (tok, S) => { sm('自己想兩個變換，再用數字驗算', -3.4, 2.0); cap('多玩：想像兩個變換，再算乘積', ''); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'inverse-def', 'singular-columns', 'inverse-columns', 'gauss-jordan', 'gj-why', 'inverse-formula', 'transpose', 'symmetric', 'perm-rows'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
