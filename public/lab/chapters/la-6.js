// 線性代數 第6章：特徵值與特徵向量（det(A − λI) = 0、對角化 A = SΛS⁻¹、Aᵏ、Fibonacci、Markov、相似與 Jordan form）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 座標慣例：3D 的 (x, y, z) 畫成 world (x, z, −y)；2D 平面平放在地上，(x, y) → world (x, 0, −y)。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const COL = { a: '#4b9ee2', b: '#dd8238', c: '#9b7ef4', d: '#2fc092', r: '#d64545', g: '#c08a1f', k: '#6e5f49', gray: '#b9ad99' };
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '12px', fontWeight: '600' };
  let gen = 0;
  function fresh(pos, look) { gen++; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const mono = (l) => { Object.assign(l.element.style, MONO); return l; };
  const txt = (l, t) => { l.element.textContent = t; };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
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
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); else { m.userData.lbl = lab.label(String(t), 'val'); m.add(m.userData.lbl); } };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  async function wait(tok, ms) { if (tok != null) await beat(tok, ms); else { const g = gen; await sleep(ms); if (g !== gen) throw new Error('cancel'); } }
  async function tw(tok, ms, fn) { const steps = Math.max(2, Math.round(ms / 33)); for (let k = 1; k <= steps; k++) { fn(ease(k / steps)); await wait(tok, ms / steps); } }
  const safe = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'cancel') throw e; } };
  function fmt(x) {
    if (typeof x === 'string') return x;
    if (!isFinite(x)) return '∞';
    if (Math.abs(x) < 1e-9) return '0';
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    for (const d of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) { const n = x * d; if (Math.abs(n - Math.round(n)) < 1e-7) return Math.round(n) + '/' + d; }
    return String(Math.round(x * 100) / 100);
  }
  const vstr = (v) => '(' + v.map(fmt).join(', ') + ')';
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const addv = (a, b) => a.map((x, i) => x + b[i]);
  const scl = (a, k) => a.map((x) => x * k);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const T = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const mulMV = (M, x) => M.map((r) => dot(r, x));
  function orthoBasis(u, v) {
    const e1 = scl(u, 1 / norm(u));
    let w = addv(v, scl(e1, -dot(v, e1)));
    if (norm(w) < 1e-9) w = Math.abs(e1[0]) < 0.9 ? cross(e1, [1, 0, 0]) : cross(e1, [0, 1, 0]);
    return [e1, scl(w, 1 / norm(w))];
  }
  // ── 3D 箭頭、桿子、平面 ──
  const UP = V3(0, 1, 0);
  function rod(color, r = 0.03, opacity = 1) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: opacity < 1, opacity }));
    lab.world.add(m);
    m.setW = (a, b) => { const d = b.clone().sub(a), L = d.length(); m.visible = L > 1e-5; if (!m.visible) return m; m.quaternion.setFromUnitVectors(UP, d.clone().divideScalar(L)); m.scale.set(1, L, 1); m.position.copy(a).addScaledVector(d, 0.5); return m; };
    return m;
  }
  function arrow(color, r = 0.055) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
    shaft.castShadow = head.castShadow = true;
    const g = new THREE.Group(); g.add(shaft, head); g.visible = false; lab.world.add(g);
    g.setW = (a, b) => {
      const d = b.clone().sub(a), L = d.length();
      g.visible = L > 1e-4;
      if (g.lbl) showL(g.lbl, g.visible);
      if (!g.visible) return g;
      const u = d.clone().divideScalar(L), hl = Math.min(0.3, L * 0.45), sl = L - hl;
      shaft.quaternion.setFromUnitVectors(UP, u); head.quaternion.copy(shaft.quaternion);
      shaft.scale.set(1, Math.max(sl, 1e-3), 1); shaft.position.copy(a).addScaledVector(u, sl / 2);
      head.scale.set(1, hl, 1); head.position.copy(a).addScaledVector(u, sl + hl / 2);
      if (g.lbl) g.lbl.position.copy(b).addScaledVector(u, 0.32).add(V3(0, 0.14, 0));
      return g;
    };
    g.tag = (t, cls) => { if (!g.lbl) { g.lbl = lab.label('', cls || 'ptr'); lab.world.add(g.lbl); } txt(g.lbl, t); return g; };
    g.glow = (c) => { mat.emissive = new THREE.Color(c || '#000000'); };
    g.color = (c) => mat.color.set(c);
    return g;
  }
  function dotBall(color, r = 0.12) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })); m.castShadow = true; lab.world.add(m); return m; }
  function planeMesh(S, u, v, color, ext, opacity = 0.2, center = [0, 0, 0]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
    lab.world.add(m); lab.world.add(edge);
    m.edge = edge;
    m.setSpan = (u2, v2, c = center) => {
      const [e1, e2] = orthoBasis(u2, v2);
      const P = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => S.w([0, 1, 2].map((k) => c[k] + (a * e1[k] + b * e2[k]) * ext)));
      const arr = geo.attributes.position.array;
      P.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      edge.geometry.setFromPoints(P);
    };
    m.fade = (o) => { m.material.opacity = o; m.visible = o > 0.004; edge.visible = o > 0.03; };
    m.setSpan(u, v);
    return m;
  }
  // 一個 R³：math (x,y,z) → world (ox + x·s, oy + z·s, oz − y·s)
  function space3(ox = 0, oy = 2.7, oz = 0, s = 1, ext = 2.5, names = ['x', 'y', 'z'], title) {
    const S = { s, ext };
    S.w = (p) => V3(ox + p[0] * s, oy + (p[2] || 0) * s, oz - (p[1] || 0) * s);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => {
      rod('#a8987f', 0.016).setW(S.w(scl(e, -ext / s)), S.w(scl(e, ext / s)));
      const p = S.w(scl(e, ext / s + 0.25 / s)); tag(names[i], 'idx', p.x, p.y, p.z);
    });
    if (title) { const p = S.w([0, 0, ext / s + 0.75 / s]); tag(title, 'ptr', p.x, p.y, p.z); }
    S.arrow = (v, color, t, cls) => { const a = arrow(color); a.v = v.slice(); if (t) a.tag(t, cls); a.setW(S.w([0, 0, 0]), S.w(v)); return a; };
    S.set = (a, v, from) => { a.v = v.slice(); a.setW(S.w(from || [0, 0, 0]), S.w(addv(from || [0, 0, 0], v))); };
    S.line = (u, color, len = ext / s, center = [0, 0, 0], r = 0.028) => { const m = rod(color, r); S.setLine(m, u, len, center); return m; };
    S.setLine = (m, u, len = ext / s, center = [0, 0, 0]) => { const e = scl(u, len / norm(u)); m.setW(S.w(addv(center, scl(e, -1))), S.w(addv(center, e))); };
    S.plane = (u, v, color, opacity = 0.2, center) => planeMesh(S, u, v, color, ext / s * 0.95, opacity, center);
    S.ball = (p, color, r) => { const b = dotBall(color, r); b.position.copy(S.w(p)); return b; };
    return S;
  }
  // 方塊矩陣：M 可含字串（例如 'b2−2b1'）；widths 可指定每欄寬度
  function mgrid(M, x0, y0, z = 0, o = {}) {
    const gap = o.gap || 0.78, sz = o.size || 0.62, widths = o.widths || [];
    const xs = []; let x = x0;
    for (let j = 0; j < M[0].length; j++) { const w = widths[j] || sz; xs.push(x + w / 2 - sz / 2); x += w + (gap - sz); }
    const c = M.map((row, i) => row.map((v, j) => cube(fmt(v), o.color ? o.color(i, j) : '#d9cbb2', [widths[j] || sz, sz, 0.3], xs[j], y0 - i * gap, z)));
    return {
      c, xs, y: (i) => y0 - i * gap,
      set(i, j, v) { relabel(c[i][j], fmt(v)); },
      setAll(A) { A.forEach((r, i) => r.forEach((v, j) => relabel(c[i][j], fmt(v)))); },
      row(i, col) { c[i].forEach((m) => glow(m, col)); },
      col(j, col) { c.forEach((r) => glow(r[j], col)); },
      paintCol(j, col) { c.forEach((r) => tint(r[j], col)); },
      clearGlow() { c.forEach((r) => r.forEach((m) => glow(m, null))); },
    };
  }
  // R⁴ 之類的向量畫成一排長條（基準線在 base）
  function bars(vals, x0, base, z = 0, color = COL.a, o = {}) {
    const k = o.k || 0.42, w = o.w || 0.3, gap = o.gap || 0.38;
    const ms = vals.map((v, i) => { const m = lab.box(color, [w, 1, w]); m.position.set(x0 + i * gap, base, z); lab.world.add(m); return m; });
    const ls = vals.map((v, i) => tag('', 'idx', x0 + i * gap, base, z + 0.3));
    const plank = new THREE.Mesh(new THREE.BoxGeometry(gap * vals.length, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: '#a8987f' }));
    plank.position.set(x0 + gap * (vals.length - 1) / 2, base, z); lab.world.add(plank);
    const B = {
      ms, ls, vals: vals.slice(),
      set(v) {
        B.vals = v.slice();
        v.forEach((x, i) => { const h = x * k; ms[i].scale.y = Math.max(Math.abs(h), 0.001); ms[i].position.y = base + h / 2; ms[i].visible = Math.abs(h) > 0.002; ls[i].position.set(x0 + i * gap, base + h + (h >= 0 ? 0.22 : -0.22), z + 0.25); txt(ls[i], o.noNum ? '' : fmt(Math.round(x * 100) / 100)); });
      },
      color(c) { ms.forEach((m) => tint(m, c)); },
      glow(c) { ms.forEach((m) => glow(m, c)); },
      ghost() { ms.forEach((m) => { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.28; m.material.depthWrite = false; }); },
      mid: x0 + gap * (vals.length - 1) / 2,
    };
    B.set(vals);
    return B;
  }
  // 鏡頭繞著 look 轉：angle（度，0 = 正前方）、elev（度）
  function cam(angle, elev, dist, look) {
    const a = angle * Math.PI / 180, e = elev * Math.PI / 180;
    lab.frameCamera([look[0] + dist * Math.sin(a) * Math.cos(e), look[1] + dist * Math.sin(e), look[2] + dist * Math.cos(a) * Math.cos(e)], look);
  }
  async function orbit(tok, ms, a0, a1, elev, dist, look) { await tw(tok, ms, (t) => cam(a0 + (a1 - a0) * t, elev, dist, look)); }

  // ── 線性代數運算：RREF（逐步紀錄）、零空間基底 ──
  const EPS = 1e-9;
  function rrefSteps(M) {
    const A = M.map((r) => r.slice()), m = A.length, n = A[0].length, piv = [], steps = [];
    const snap = () => A.map((r) => r.map((x) => (Math.abs(x) < 1e-10 ? 0 : x)));
    let r = 0;
    for (let c = 0; c < n && r < m; c++) {
      let p = -1; for (let i = r; i < m; i++) if (Math.abs(A[i][c]) > EPS) { p = i; break; }
      if (p < 0) { steps.push({ text: '第 ' + (c + 1) + ' 行在第 ' + (r + 1) + ' 列以下全是 0 → 自由行', A: snap(), row: -1, col: c }); continue; }
      if (p !== r) { [A[r], A[p]] = [A[p], A[r]]; steps.push({ text: '交換 R' + (r + 1) + ' ↔ R' + (p + 1), A: snap(), row: r, col: c }); }
      const pv = A[r][c];
      if (Math.abs(pv - 1) > EPS) { for (let j = 0; j < n; j++) A[r][j] /= pv; steps.push({ text: 'R' + (r + 1) + ' ÷ ' + fmt(pv) + '：pivot 變 1', A: snap(), row: r, col: c }); }
      for (let i = 0; i < m; i++) if (i !== r && Math.abs(A[i][c]) > EPS) {
        const f = A[i][c]; for (let j = 0; j < n; j++) A[i][j] -= f * A[r][j];
        steps.push({ text: 'R' + (i + 1) + ' − (' + fmt(f) + ')·R' + (r + 1), A: snap(), row: i, col: c });
      }
      piv.push(c); r++;
    }
    return { R: snap(), piv, rank: piv.length, steps };
  }
  function nullBasis(R, piv, n) {
    const free = []; for (let j = 0; j < n; j++) if (!piv.includes(j)) free.push(j);
    return free.map((f) => { const x = new Array(n).fill(0); x[f] = 1; piv.forEach((pc, k) => { x[pc] = -R[k][f]; }); return x; });
  }
  function subspaces(A) {
    const m = A.length, n = A[0].length, E = rrefSteps(A), Et = rrefSteps(T(A));
    return {
      rank: E.rank, piv: E.piv, R: E.R,
      row: E.R.slice(0, E.rank), null: nullBasis(E.R, E.piv, n),
      col: E.piv.map((j) => A.map((r) => r[j])), left: nullBasis(Et.R, Et.piv, m), m, n,
    };
  }
  function parseM(s) {
    const rows = String(s).trim().split(/\s*[;\n]\s*/).filter(Boolean).map((r) => r.split(/[\s,]+/).filter(Boolean).map(Number));
    if (!rows.length || rows.some((r) => r.length !== rows[0].length || r.some((x) => !isFinite(x)))) return null;
    return rows;
  }


  // ── 2×2 / 3×3 小工具 ──
  const I2 = [[1, 0], [0, 1]], I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  const lerpM = (A, B, t) => A.map((r, i) => r.map((x, j) => x + (B[i][j] - x) * t));
  const det2 = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const det3 = (M) => dot(M.map((r) => r[0]), cross(M.map((r) => r[1]), M.map((r) => r[2])));
  const inv2 = (M) => { const d = det2(M); return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; };
  const mstr = (M) => '[' + M.map((r) => r.map(fmt).join(' ')).join('; ') + ']';
  function setPts(line, pts) { line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(pts); }
  // 把線段 p→q 裁到 [−B, B]² 裡（Liang–Barsky）；整段在外面回傳 null
  function clip(p, q, B) {
    let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
    for (const [pp, qq] of [[-dx, p[0] + B], [dx, B - p[0]], [-dy, p[1] + B], [dy, B - p[1]]]) {
      if (Math.abs(pp) < 1e-12) { if (qq < 0) return null; continue; }
      const r = qq / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
  }
  // 平放在地上的 R²：math (x, y) → world (x·s, y0, −y·s)
  function flat2(s = 0.72, B = 5.4, n = 8) {
    const F = { s, B };
    F.w = (p, h = 0.06) => V3(p[0] * s, h, -p[1] * s);
    F.grid = (color = COL.a, op = 0.75, h = 0.07) => {
      const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
      lab.world.add(l);
      l.setM = (M) => {
        const pts = [];
        for (let k = -n; k <= n; k++) for (const [a, b] of [[[k, -n], [k, n]], [[-n, k], [n, k]]]) { const c = clip(mulMV(M, a), mulMV(M, b), B); if (c) pts.push(F.w(c[0], h), F.w(c[1], h)); }
        setPts(l, pts.length ? pts : [V3(0, -1, 0), V3(0, -1, 0)]);
      };
      l.setM(I2);
      return l;
    };
    const base = F.grid('#c9b99c', 0.5, 0.03);
    const ax = (a, b) => rod('#8a7b66', 0.02).setW(F.w(a, 0.04), F.w(b, 0.04));
    ax([-B, 0], [B, 0]); ax([0, -B], [0, B]);
    F.base = base;
    F.arrow = (v, color, t, cls, from = [0, 0]) => { const a = arrow(color, 0.06); a.v = v.slice(); if (t) a.tag(t, cls); a.setW(F.w(from, 0.12), F.w(addv(from, v), 0.12)); return a; };
    F.set = (a, v, from = [0, 0]) => { a.v = v.slice(); a.setW(F.w(from, 0.12), F.w(addv(from, v), 0.12)); };
    // 單位正方形變換後的平行四邊形（看 det）
    F.square = (color = COL.g, op = 0.32) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
      lab.world.add(m);
      m.setM = (M) => { const P = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => F.w(mulMV(M, p), 0.09)); const arr = geo.attributes.position.array; P.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }); geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere(); };
      m.setM(I2); return m;
    };
    return F;
  }
  // 平行六面體 / 平行四邊形（在 space3 裡）
  function ppiped(S, a, b, c, color = COL.c, op = 0.22) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
    geo.setIndex([0, 1, 3, 0, 3, 2, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 3, 7, 1, 7, 5]);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    const edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
    lab.world.add(m); lab.world.add(edges); m.edges = edges;
    const E = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    m.set = (a2, b2, c2) => {
      const P = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => S.w(addv(addv(scl(a2, k & 1), scl(b2, (k >> 1) & 1)), scl(c2, (k >> 2) & 1))));
      const arr = geo.attributes.position.array; P.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      setPts(edges, E.flatMap(([i, j]) => [P[i], P[j]]));
    };
    m.show = (v) => { m.visible = v; edges.visible = v; };
    m.set(a, b, c); return m;
  }
  function pgram(S, a, b, color = COL.g, op = 0.3) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    lab.world.add(m);
    m.set = (a2, b2) => { const P = [[0, 0, 0], a2, addv(a2, b2), b2].map((p) => S.w(p)); const arr = geo.attributes.position.array; P.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }); geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere(); };
    m.set(a, b); return m;
  }
  // 3D 格線（xy 平面上的格子，經過 3×3 或 3×2 矩陣）
  function grid3(S, color, n = 3, op = 0.7) {
    const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    lab.world.add(l);
    l.setM = (M) => { const f = (p) => S.w(M[0].length === 2 ? mulMV(M, p.slice(0, 2)) : mulMV(M, p)); const pts = []; for (let k = -n; k <= n; k++) { pts.push(f([k, -n, 0]), f([k, n, 0]), f([-n, k, 0]), f([n, k, 0])); } setPts(l, pts); };
    l.setM(I3); return l;
  }
  function unitCube(S, color = COL.c) { return ppiped(S, [1, 0, 0], [0, 1, 0], [0, 0, 1], color, 0.2); }

  // ── 特徵值計算 ──
  const C_ = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; } };
  // 單變數多項式的所有根（monic，係數由高到低），Durand–Kerner
  function roots(coef) {
    const n = coef.length - 1;
    let z = Array.from({ length: n }, (_, k) => { let p = [1, 0]; for (let i = 0; i < k; i++) p = C_.mul(p, [0.4, 0.9]); return p; });
    const P = (x) => coef.reduce((acc, c) => C_.add(C_.mul(acc, x), [c, 0]), [0, 0]);
    for (let it = 0; it < 800; it++) z = z.map((zi, i) => { let den = [1, 0]; z.forEach((zj, j) => { if (j !== i) den = C_.mul(den, C_.sub(zi, zj)); }); return C_.sub(zi, C_.div(P(zi), den)); });
    return z.map(([re, im]) => {
      if (Math.abs(im) < 1e-6) { im = 0; for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12]) { const s = Math.round(re * d) / d; if (Math.abs(s - re) < 1e-6) { re = s; break; } } }
      return [re, im];
    });
  }
  function charPoly(M) {
    if (M.length === 2) return [1, -(M[0][0] + M[1][1]), det2(M)];
    const tr = M[0][0] + M[1][1] + M[2][2];
    const c2 = det2([[M[0][0], M[0][1]], [M[1][0], M[1][1]]]) + det2([[M[0][0], M[0][2]], [M[2][0], M[2][2]]]) + det2([[M[1][1], M[1][2]], [M[2][1], M[2][2]]]);
    return [1, -tr, c2, -det3(M)];
  }
  function rrefTol(M, tol = 1e-6) {
    const A = M.map((r) => r.slice()), m = A.length, n = A[0].length, piv = [];
    let r = 0;
    for (let c = 0; c < n && r < m; c++) {
      let p = r; for (let i = r + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
      if (Math.abs(A[p][c]) < tol) continue;
      [A[r], A[p]] = [A[p], A[r]];
      const pv = A[r][c]; for (let j = 0; j < n; j++) A[r][j] /= pv;
      for (let i = 0; i < m; i++) if (i !== r) { const f = A[i][c]; for (let j = 0; j < n; j++) A[i][j] -= f * A[r][j]; }
      piv.push(c); r++;
    }
    return { R: A, piv, rank: piv.length };
  }
  function eigInfo(M) {
    const n = M.length, rs = roots(charPoly(M)), groups = [];
    rs.forEach(([re, im]) => { const g = groups.find((x) => Math.abs(x.re - re) < 1e-5 && Math.abs(x.im - im) < 1e-5); if (g) g.am++; else groups.push({ re, im, am: 1 }); });
    groups.forEach((g) => {
      if (g.im !== 0) { g.gm = g.am; g.vecs = []; return; }
      const B = M.map((r, i) => r.map((x, j) => x - (i === j ? g.re : 0)));
      const E = rrefTol(B, 1e-6);
      g.gm = n - E.rank; g.vecs = nullBasis(E.R, E.piv, n);
    });
    groups.sort((a, b) => b.re - a.re || b.im - a.im);
    const real = groups.every((g) => g.im === 0);
    return { groups, real, diag: groups.every((g) => g.gm === g.am), n };
  }
  const lstr = (g) => g.im === 0 ? fmt(Math.round(g.re * 1e4) / 1e4) : fmt(Math.round(g.re * 1e3) / 1e3) + (g.im > 0 ? ' + ' : ' − ') + fmt(Math.round(Math.abs(g.im) * 1e3) / 1e3) + 'i';
  function rodrigues(axis, ang) {
    const [x, y, z] = scl(axis, 1 / norm(axis)), c = Math.cos(ang), s = Math.sin(ang), C = 1 - c;
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
  }
  const rot2 = (a, r = 1) => [[r * Math.cos(a), -r * Math.sin(a)], [r * Math.sin(a), r * Math.cos(a)]];

  // ───────────────────────── 模式 1：找特徵向量 ─────────────────────────
  const fe = { src: '3 1; 0 2', ang: 0.3 };
  function enterFind() {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    controls('<label>A = <input id="feA" value="' + fe.src + '" style="width:110px"></label>'
      + '<select id="feP"><option value="">範例…</option><option value="3 1; 0 2">3B1B：[3 1; 0 2]</option><option value="2 1; 1 2">對稱 [2 1; 1 2]</option><option value="0 -1; 1 0">旋轉 90°</option><option value="1 1; 0 1">Shear</option><option value="2 1; 0 2">[2 1; 0 2]（缺特徵向量）</option><option value="0.9 0.2; 0.1 0.8">Markov</option></select>'
      + '<button class="primary" id="feSweep">讓 x 掃一圈</button><button id="feLines">畫出特徵方向</button>');
    $('feP').onchange = (e) => { if (e.target.value) { fe.src = e.target.value; enterFind(); } };
    on('feSweep', safe(() => sweepFind()));
    on('feLines', () => linesFind());
    const M = parseM(fe.src);
    if (!M || M.length !== 2 || M[0].length !== 2 || M.flat().some((x) => Math.abs(x) > 3)) { log('A 要是 2×2，數字在 −3 到 3 之間，例如 3 1; 0 2', true); fe.src = '3 1; 0 2'; return; }
    fe.M = M; fe.F = flat2(0.62, 6, 8);
    fe.ax = fe.F.arrow([1, 0], COL.a, 'x'); fe.aAx = fe.F.arrow([1, 0], COL.b, 'Ax');
    fe.cl = rod('#a8987f', 0.012);
    setFind(fe.ang);
    const E = eigInfo(M);
    setState('A = ' + mstr(M), [['det(A − λI)', 'λ² − ' + fmt(M[0][0] + M[1][1]) + 'λ + ' + fmt(det2(M))], ['特徵值', E.groups.map((g) => lstr(g) + (g.am > 1 ? '（重根 ×' + g.am + '）' : '')).join('、')], ['可對角化？', E.real ? (E.diag ? '是' : '否（特徵向量不夠）') : '實數上不行（複數特徵值）']],
      'Ax = λx：x 經過 A 之後還在自己的 span 上<br>λ₁ + λ₂ = trace，λ₁λ₂ = det');
    log('藍 = x（單位圓上），橘 = Ax。兩者共線時 x 就是特徵向量。');
  }
  function setFind(a) {
    const x = [Math.cos(a), Math.sin(a)], y = mulMV(fe.M, x);
    fe.F.set(fe.ax, x); fe.F.set(fe.aAx, y);
    fe.cl.setW(fe.F.w(scl(x, -6), 0.05), fe.F.w(scl(x, 6), 0.05));
    const crs = x[0] * y[1] - x[1] * y[0], par = Math.abs(crs) < 0.04 * Math.max(1, norm(y));
    fe.aAx.glow(par ? GOLD : null); fe.ax.glow(par ? GOLD : null);
    return par;
  }
  async function sweepFind() {
    let last = false;
    const steps = 240;
    for (let k = 0; k <= steps; k++) {
      const a = k / steps * Math.PI * 2;
      const par = setFind(a);
      if (par && !last) { const x = [Math.cos(a), Math.sin(a)], y = mulMV(fe.M, x); log('x ≈ ' + vstr(x.map((v) => Math.round(v * 100) / 100)) + ' 時 Ax 跟 x 共線，λ ≈ ' + (Math.round(dot(x, y) * 100) / 100)); await wait(null, 600); }
      last = par;
      await wait(null, 22);
    }
    fe.ang = 0.3; setFind(0.3);
  }
  function linesFind() {
    const E = eigInfo(fe.M);
    if (!E.real) { log('特徵值是複數 ' + E.groups.map(lstr).join('、') + '：沒有實數的特徵方向（每個向量都被轉走）。', true); return; }
    E.groups.forEach((g, i) => g.vecs.forEach((v) => { const r = rod([COL.d, COL.r][i % 2], 0.04); r.setW(fe.F.w(scl(v, -6 / norm(v)), 0.08), fe.F.w(scl(v, 6 / norm(v)), 0.08)); const p = fe.F.w(scl(v, 3.2 / norm(v)), 0.3); tag('λ = ' + lstr(g), 'ptr alt', p.x, p.y, p.z); }));
    if (!E.diag) log('重根但特徵方向只有 ' + E.groups[0].gm + ' 條：幾何重數 < 代數重數，不能對角化。', true);
    else log('特徵方向：' + E.groups.map((g) => 'λ = ' + lstr(g) + ' → ' + g.vecs.map(vstr).join(' ')).join('；'));
  }

  // ───────────────────────── 模式 2：A^k 疊代 ─────────────────────────
  const PW = {
    stable: { name: '穩定 [0.5 0.4; 0.4 0.5]（λ = 0.9, 0.1）', M: [[0.5, 0.4], [0.4, 0.5]], u: [1, -0.5] },
    grow: { name: '[1 0.5; 0.5 1]（λ = 1.5, 0.5）', M: [[1, 0.5], [0.5, 1]], u: [1, -0.6] },
    fib: { name: 'Fibonacci [1 1; 1 0]', M: [[1, 1], [1, 0]], u: [1, 0] },
    markov: { name: 'Markov [0.9 0.2; 0.1 0.8]', M: [[0.9, 0.2], [0.1, 0.8]], u: [0, 1] },
    spiral: { name: '螺旋（複數 λ，|λ| = 0.9）', M: rot2(Math.PI / 6, 0.9), u: [1.5, 0] },
    out: { name: '螺旋（|λ| = 1.08）', M: rot2(Math.PI / 6, 1.08), u: [0.6, 0] },
  };
  const pw = { key: 'grow' };
  function enterPower() {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    controls('<select id="pwP">' + Object.keys(PW).map((k) => '<option value="' + k + '">' + PW[k].name + '</option>').join('') + '</select>'
      + '<label>u₀ = <input id="pwU" value="' + PW[pw.key].u.join(',') + '" style="width:64px"></label><button id="pwReset">重設</button><button class="primary" id="pwStep">u ← Au</button><button id="pwRun">連跑 10 步</button>');
    $('pwP').value = pw.key;
    $('pwP').onchange = (e) => { pw.key = e.target.value; enterPower(); };
    on('pwReset', () => resetPower());
    on('pwStep', () => stepPower());
    on('pwRun', safe(async () => { for (let i = 0; i < 10; i++) { stepPower(); await wait(null, 350); } }));
    resetPower();
  }
  function resetPower() {
    lab.clear();
    pw.F = flat2(0.62, 6, 8);
    const u = String(($('pwU') || {}).value || PW[pw.key].u.join(',')).split(/[\s,]+/).filter(Boolean).map(Number);
    if (u.length !== 2 || u.some((x) => !isFinite(x) || Math.abs(x) > 3)) { log('u₀ 要兩個數字，絕對值 ≤ 3。', true); return; }
    const M = PW[pw.key].M, E = eigInfo(M);
    pw.M = M; pw.pts = [u]; pw.k = 0;
    if (E.real) E.groups.forEach((g, i) => g.vecs.forEach((v) => { const r = rod([COL.d, COL.r][i % 2], 0.03); r.setW(pw.F.w(scl(v, -6 / norm(v)), 0.05), pw.F.w(scl(v, 6 / norm(v)), 0.05)); const p = pw.F.w(scl(v, 4.6 / norm(v)), 0.3); tag('λ = ' + lstr(g), 'idx', p.x, p.y, p.z); }));
    pw.dots = []; pw.arr = pw.F.arrow(u, COL.g, 'u₀');
    pw.E = E;
    drawPower();
  }
  function drawPower() {
    const mx = Math.max(...pw.pts.map(norm)), k = mx > 5 ? 5 / mx : 1;
    while (pw.dots.length < pw.pts.length) pw.dots.push(dotBall(COL.b, 0.09));
    pw.pts.forEach((p, i) => pw.dots[i].position.copy(pw.F.w(scl(p, k), 0.12)));
    const u = pw.pts[pw.pts.length - 1];
    pw.F.set(pw.arr, scl(u, k)); pw.arr.tag('u' + pw.k + (k < 1 ? '（縮小 ×' + k.toPrecision(2) + '）' : ''));
    setState('u_k = Aᵏ u₀', [['k', String(pw.k)], ['u_k', vstr(u.map((x) => Math.round(x * 1000) / 1000))], ['|u_k|', String(Math.round(norm(u) * 1000) / 1000)], ['特徵值', pw.E.groups.map(lstr).join('、')]],
      'u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂：|λ| 最大的方向主導<br>全部 |λ| < 1 → Aᵏ → 0（穩定）');
  }
  function stepPower() {
    if (!pw.pts) return;
    if (pw.k >= 40) { log('已經 40 步了，按「重設」重來。', true); return; }
    pw.pts.push(mulMV(pw.M, pw.pts[pw.pts.length - 1])); pw.k++;
    drawPower();
  }

  // ───────────────────────── 模式 3：Markov 人口流動 ─────────────────────────
  const mk = { a: 0.9, b: 0.8, u: [0, 1000], k: 0 };
  function enterMarkov() {
    fresh([0, 3.6, 12.5], [0, 3.2, 0]);
    controls('<label>加州留下 <input id="mkA" value="' + mk.a + '" style="width:44px"></label><label>麻州留下 <input id="mkB" value="' + mk.b + '" style="width:44px"></label>'
      + '<label>u₀ = <input id="mkU" value="' + mk.u.join(',') + '" style="width:72px"></label><button id="mkReset">重設</button><button class="primary" id="mkStep">過一年</button><button id="mkRun">過 10 年</button>');
    on('mkReset', () => resetMarkov());
    on('mkStep', safe(() => stepMarkov()));
    on('mkRun', safe(async () => { for (let i = 0; i < 10; i++) await stepMarkov(); }));
    resetMarkov();
  }
  function resetMarkov() {
    const a = Number($('mkA') && $('mkA').value), b = Number($('mkB') && $('mkB').value);
    const u = String(($('mkU') || {}).value || '0,1000').split(/[\s,]+/).filter(Boolean).map(Number);
    if (!(a >= 0 && a <= 1 && b >= 0 && b <= 1)) { log('留下的比例要在 0 到 1 之間（Markov：每行非負、加起來 = 1）。', true); return; }
    if (u.length !== 2 || u.some((x) => !(x >= 0) || x > 5000)) { log('u₀ 要兩個非負數字。', true); return; }
    mk.a = a; mk.b = b; mk.u = u; mk.k = 0; mk.cur = u.slice();
    lab.clear();
    mk.A = [[a, 1 - b], [1 - a, b]];
    mk.tot = u[0] + u[1] || 1;
    mk.bars = [cube('', COL.b, [2, 1, 1.6], -2.6, 0.5, 0), cube('', COL.a, [2, 1, 1.6], 2.6, 0.5, 0)];
    mk.lbl = [tag('', 'ptr', -2.6, 1, 1), tag('', 'ptr', 2.6, 1, 1)];
    tag('California', 'idx', -2.6, 0, 1.3); tag('Massachusetts', 'idx', 2.6, 0, 1.3);
    mk.g = mgrid(mk.A, -0.7, 6.4, 0, { size: 0.7, gap: 0.9, color: () => '#e7dcc8' });
    drawMarkov();
  }
  function drawMarkov() {
    const H = 4.8;
    mk.cur.forEach((v, i) => { const h = Math.max(0.02, v / mk.tot * H); mk.bars[i].scale.y = h; mk.bars[i].position.y = h / 2; mk.lbl[i].position.y = h + 0.4; txt(mk.lbl[i], String(Math.round(v * 10) / 10)); });
    const s = mk.a + mk.b === 2 ? null : [(1 - mk.b) / (2 - mk.a - mk.b), (1 - mk.a) / (2 - mk.a - mk.b)];
    const l2 = mk.a + mk.b - 1;
    setState('第 ' + mk.k + ' 年', [['A', mstr(mk.A)], ['特徵值', '1 和 ' + fmt(Math.round(l2 * 1000) / 1000)], ['穩定狀態', s ? vstr(s.map((x) => Math.round(x * mk.tot * 10) / 10)) : '每個狀態都穩定']],
      'λ = 1 的特徵向量 = 穩定狀態；另一個 λ = ' + fmt(Math.round(l2 * 1000) / 1000) + ' 的部分每年乘 ' + fmt(Math.round(l2 * 1000) / 1000) + ' 消失<br>總人數不變（每行和 = 1）');
  }
  async function stepMarkov() {
    if (!mk.A) return;
    const from = mk.cur.slice(), to = mulMV(mk.A, from);
    const flow = [from[0] * (1 - mk.a), from[1] * (1 - mk.b)];
    const d1 = dotBall(COL.b, 0.18), d2 = dotBall(COL.a, 0.18);
    await tw(null, 500, (t) => { d1.position.set(-2.6 + 5.2 * t, 2.6 + Math.sin(t * Math.PI) * 1.2, 0.9); d2.position.set(2.6 - 5.2 * t, 2.2 + Math.sin(t * Math.PI) * 0.8, 0.9); });
    lab.world.remove(d1); lab.world.remove(d2);
    mk.cur = to; mk.k++;
    log('第 ' + mk.k + ' 年：' + Math.round(flow[0]) + ' 人 加州→麻州、' + Math.round(flow[1]) + ' 人 麻州→加州 → ' + vstr(to.map((x) => Math.round(x * 10) / 10)));
    drawMarkov();
  }

  // ───────────────────────── 模式 4：對角化檢查 ─────────────────────────
  const dg = { src: '2 1; 1 2' };
  function enterDiag() {
    fresh([0, 3.4, 13], [0, 3.6, 0]);
    controls('<label>A = <input id="dgA" value="' + dg.src + '" style="width:170px"></label>'
      + '<select id="dgP"><option value="">範例…</option><option value="2 1; 1 2">[2 1; 1 2]</option><option value="2 1; 0 2">[2 1; 0 2]</option><option value="4 1; 2 3">[4 1; 2 3]</option><option value="1 1; 1 0">Fibonacci</option><option value="2 0 0; 0 2 0; 0 0 3">diag(2, 2, 3)</option><option value="2 1 0; 0 2 0; 0 0 3">[2 1 0; 0 2 0; 0 0 3]</option><option value="0 0 1; 1 0 0; 0 1 0">輪換（旋轉 120°）</option><option value="1 2 3; 0 4 5; 0 0 6">上三角</option></select>'
      + '<button class="primary" id="dgGo">分解</button>');
    $('dgP').onchange = (e) => { if (e.target.value) { dg.src = e.target.value; $('dgA').value = dg.src; goDiag(); } };
    on('dgGo', () => { dg.src = $('dgA').value; goDiag(); });
    goDiag();
  }
  function goDiag() {
    const M = parseM(dg.src);
    if (!M || M.length !== M[0].length || M.length < 2 || M.length > 3) { log('A 要是 2×2 或 3×3 方陣，例如 2 1; 1 2', true); return; }
    lab.clear();
    const n = M.length, E = eigInfo(M);
    const g = mgrid(M, -6.2, 5.4, 0, { color: () => COL.a }); tag('A', 'ptr', -6.2 + (n - 1) * 0.39, 6.1);
    let rows = E.groups.map((x) => ['λ = ' + lstr(x), '代數重數 ' + x.am + '、幾何重數 ' + (x.im === 0 ? x.gm : '—')]);
    if (E.real && E.diag) {
      const S = T(E.groups.flatMap((x) => x.vecs)), L = E.groups.flatMap((x) => x.vecs.map(() => x.re));
      const Lm = L.map((l, i) => L.map((_, j) => (i === j ? l : 0)));
      tag('=', 'val', -6.2 + n * 0.78 + 0.1, 5.4 - (n - 1) * 0.39);
      const x0 = -6.2 + n * 0.78 + 0.7;
      mgrid(S, x0, 5.4, 0, { color: () => COL.d }); tag('S（特徵向量）', 'ptr', x0 + (n - 1) * 0.39, 6.1);
      const x1 = x0 + n * 0.78 + 0.4;
      mgrid(Lm, x1, 5.4, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); tag('Λ', 'ptr alt', x1 + (n - 1) * 0.39, 6.1);
      const x2 = x1 + n * 0.78 + 0.4;
      tag('S⁻¹', 'ptr', x2 + 0.3, 5.4 - (n - 1) * 0.39);
      rows = rows.concat([['可對角化', '是：A = SΛS⁻¹']]);
      setState('A 的特徵分解', rows, '<span class="ok">每個特徵值：幾何重數 = 代數重數</span><br>Aᵏ = SΛᵏS⁻¹：特徵值變 λᵏ，特徵向量不變');
      log('S 的行 = 特徵向量（' + E.groups.map((x) => x.vecs.map(vstr).join(' ')).join(' ') + '），Λ 的對角 = 特徵值。');
    } else if (!E.real) {
      setState('A 的特徵分解', rows.concat([['可對角化', '實數上不行']]), '<span class="no">有複數特徵值</span>：實數矩陣的複數特徵值成對出現（共軛）<br>在複數上若特徵值相異仍可對角化');
      log('特徵值有複數：' + E.groups.map(lstr).join('、'), true);
    } else {
      const bad = E.groups.find((x) => x.gm < x.am);
      setState('A 的特徵分解', rows.concat([['可對角化', '否']]), '<span class="no">λ = ' + lstr(bad) + '：幾何重數 ' + bad.gm + ' < 代數重數 ' + bad.am + '</span><br>特徵向量不夠 n 個 → S 不可逆；只能化成 Jordan form');
      log('特徵向量只有 ' + E.groups.reduce((s, x) => s + x.gm, 0) + ' 個獨立的，不夠 ' + n + ' 個。', true);
    }
    const tr = M.reduce((s, r, i) => s + r[i], 0), dt = n === 2 ? det2(M) : det3(M);
    log('檢查：特徵值總和 = trace = ' + fmt(Math.round(tr * 1e4) / 1e4) + '；乘積 = det = ' + fmt(Math.round(dt * 1e4) / 1e4) + '。');
    void g;
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.16) {
      let l1 = ri(-3, 5), l2 = ri(-3, 5); if (l1 === l2) l2++;
      let a = ri(-2, 4); while (a === l1 || a === l2) a++; // a 不能剛好是特徵值，不然 {a, d} 也會是對的答案
      const d = l1 + l2 - a, bc = a * d - l1 * l2; // 選 b、c 使 bc 符合
      const b = pick([1, -1, 2, -2].filter((x) => bc % x === 0)) || 1, c = bc / b;
      const pair = (x, y) => '{' + Math.max(x, y) + ', ' + Math.min(x, y) + '}'; // 一律大的在前，同一組數字只會有一種寫法
      const ans = pair(l1, l2);
      const opts = [ans]; for (const o of [pair(a, d), pair(l1 + 1, l2 - 1), pair(-l1, -l2), pair(l1 + 2, l2), pair(l1, l2 - 2)]) if (!opts.includes(o) && opts.length < 4) opts.push(o);
      return { q: 'A = [' + a + ' ' + b + '; ' + c + ' ' + d + ']，特徵值是？', opts, ans, why: 'λ₁ + λ₂ = trace = ' + (a + d) + '，λ₁λ₂ = det = ' + (a * d - b * c) + ' → λ² − (' + (a + d) + ')λ + (' + (a * d - b * c) + ') = 0。' };
    }
    if (k < 0.28) {
      const a = ri(-3, 4), d = ri(-3, 4), f = ri(-3, 4), b = ri(-5, 5), c = ri(-5, 5), e = ri(-5, 5);
      const set3 = (v) => '{' + v.slice().sort((x, y) => y - x).join(', ') + '}'; // 同一組數字只會有一種寫法
      const ans = set3([a, d, f]);
      const opts = [ans]; for (const o of [set3([b, c, e]), set3([a + b + c, d + e, f]), set3([a, d + e, f]), set3([a + 1, d, f - 1]), set3([-a, -d, -f])]) if (!opts.includes(o) && opts.length < 4) opts.push(o);
      return { q: '上三角矩陣 [' + a + ' ' + b + ' ' + c + '; 0 ' + d + ' ' + e + '; 0 0 ' + f + '] 的特徵值是？', opts, ans, why: '三角矩陣的 det(A − λI) = (a − λ)(d − λ)(f − λ)，特徵值就在對角線上。' };
    }
    if (k < 0.4) {
      const l = pick([2, 3, -2, -3, 4]), p = ri(2, 4), c = ri(1, 5);
      const which = pick(['pow', 'shift', 'inv']);
      if (which === 'pow') return { q: 'Ax = ' + l + 'x。A^' + p + ' 的對應特徵值是？', opts: [...new Set([String(Math.pow(l, p)), String(l * p), String(l), String(l + p)])], ans: String(Math.pow(l, p)), why: 'Aᵏx = λᵏx，特徵向量不變；A = SΛS⁻¹ ⇒ Aᵏ = SΛᵏS⁻¹。' };
      if (which === 'shift') return { q: 'Ax = ' + l + 'x。(A + ' + c + 'I) 的對應特徵值是？', opts: [...new Set([String(l + c), String(l * c), String(l), String(l - c)])], ans: String(l + c), why: '(A + cI)x = λx + cx = (λ + c)x。' };
      return { q: 'Ax = ' + l + 'x（A 可逆）。A⁻¹ 的對應特徵值是？', opts: [...new Set(['1/' + l, String(-l), String(l), String(l * l)])].map((s) => s.replace('1/-', '−1/')), ans: ('1/' + l).replace('1/-', '−1/'), why: 'x = A⁻¹(λx) ⇒ A⁻¹x = (1/λ)x。' };
    }
    if (k < 0.54) {
      const C = [['[2 1; 0 2]', '不可以'], ['[2 0; 0 2]', '可以'], ['[1 1; 0 1]', '不可以'], ['[2 1; 1 2]', '可以'], ['[3 1; 0 2]', '可以'], ['[0 1; 0 0]', '不可以'], ['[4 1; 2 3]', '可以'], ['[5 0; 1 5]', '不可以']];
      const [m, a] = pick(C);
      return { q: m + ' 在實數上可以對角化嗎？', opts: ['可以', '不可以'], ans: a, why: a === '可以' ? '特徵值相異，或重根但特徵向量夠多（如 2I），就能找到 n 個獨立特徵向量。' : '重根 λ 的 A − λI 只有 1 維 null space：幾何重數 1 < 代數重數 2，特徵向量不夠。' };
    }
    if (k < 0.68) {
      const a = pick([0.9, 0.8, 0.7, 0.6, 0.5]), b = pick([0.9, 0.8, 0.7, 0.6]);
      const s1 = (1 - b) / (2 - a - b), N = 1000, ans = String(Math.round(s1 * N));
      return { q: 'Markov 矩陣 A = [' + a + ' ' + fmt(Math.round((1 - b) * 10) / 10) + '; ' + fmt(Math.round((1 - a) * 10) / 10) + ' ' + b + ']，總人口 1000。長期下來第一個狀態有幾人（四捨五入）？', opts: [...new Set([ans, String(Math.round((1 - a) / (2 - a - b) * N)), '500', String(Math.round(a * N)), String(Math.round(b * N)), String(Math.round((1 - a) * N))])].slice(0, 4), ans, why: '穩定狀態 = λ = 1 的特徵向量 ∝ (' + fmt(Math.round((1 - b) * 10) / 10) + ', ' + fmt(Math.round((1 - a) * 10) / 10) + ')，再縮放成總和 1000。另一個特徵值 = trace − 1 = ' + fmt(Math.round((a + b - 1) * 10) / 10) + '。' };
    }
    if (k < 0.8) {
      const S = [['相似矩陣 B = M⁻¹AM 和 A 有相同的特徵值', '對'], ['列運算（例如 R2 − 2R1）不會改變特徵值', '錯'], ['A 和 Aᵀ 有相同的特徵值', '對'], ['A 和 Aᵀ 有相同的特徵向量', '錯'], ['特徵值都相異 ⇒ 特徵向量線性獨立', '對'], ['有重根 ⇒ 一定不能對角化', '錯'], ['Markov 矩陣一定有 λ = 1', '對'], ['實數矩陣的特徵值一定是實數', '錯']];
      const [s, a] = pick(S);
      return { q: '對或錯：' + s, opts: ['對', '錯'], ans: a, why: { '相似矩陣 B = M⁻¹AM 和 A 有相同的特徵值': 'det(M⁻¹AM − λI) = det(M⁻¹(A − λI)M) = det(A − λI)。', '列運算（例如 R2 − 2R1）不會改變特徵值': '列運算會改變特徵值：[2 1; 1 2] 的特徵值 3、1，做 R2 − ½R1 後變 [2 1; 0 1.5]，特徵值 2、1.5。', 'A 和 Aᵀ 有相同的特徵值': 'det(A − λI) = det((A − λI)ᵀ) = det(Aᵀ − λI)。', 'A 和 Aᵀ 有相同的特徵向量': '一般不同；例如 Markov：Aᵀ 的 λ = 1 特徵向量是 (1, 1, …, 1)，A 的是穩定狀態。', '特徵值都相異 ⇒ 特徵向量線性獨立': '相異特徵值對應的特徵向量一定獨立，所以一定可對角化。', '有重根 ⇒ 一定不能對角化': '單位矩陣 I 的特徵值全是 1，但每個向量都是特徵向量，本來就是對角矩陣。', 'Markov 矩陣一定有 λ = 1': 'A − I 每行和為 0 → 列相加 = 零列 → 奇異。', '實數矩陣的特徵值一定是實數': '旋轉 90° [0 −1; 1 0] 的特徵值是 ±i。' }[s] };
    }
    const tr = ri(-3, 6), dt = ri(-6, 8);
    const which = pick(['sum', 'prod']);
    return { q: '2×2 矩陣 trace = ' + tr + '、det = ' + dt + '。特徵值的' + (which === 'sum' ? '和' : '乘積') + '是？', opts: [...new Set([String(which === 'sum' ? tr : dt), String(which === 'sum' ? dt : tr), String(-tr), String(tr * tr - 4 * dt)])], ans: String(which === 'sum' ? tr : dt), why: 'λ₁ + λ₂ = trace，λ₁λ₂ = det（3B1B 的快速算法：λ = m ± √(m² − p)，m = trace/2、p = det）。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => { const o = decodeURIComponent(b.dataset.o); if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 場景 ═════════════════════════
  function trail(F, pts, color, r = 0.08) { return pts.map((p) => { const b = dotBall(color, r); b.position.copy(F.w(p, 0.12)); return b; }); }
  function eigLine(F, v, color, ext = 6) { const r = rod(color, 0.03); r.setW(F.w(scl(v, -ext / norm(v)), 0.05), F.w(scl(v, ext / norm(v)), 0.05)); return r; }

  // ─── 13r9QY6cmjc（MIT 18.06 L22）：對角化與 Aᵏ ───
  async function scDiagASSL(tok) {
    fresh([0, 3.4, 13], [0, 3.6, 0]);
    const A = [[2, 1], [1, 2]];
    say('有 n 個獨立特徵向量 → 放進 S 的行', '示範用 A = [2 1; 1 2]：x₁ = (1, 1)、x₂ = (1, −1)');
    const gA = mgrid(A, -6.4, 5.2, 0, { color: () => COL.a }); tag('A', 'ptr', -6, 5.9);
    const gS = mgrid([[1, 1], [1, -1]], -4.4, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('S', 'ptr', -4, 5.9);
    tag('=', 'val', -2.5, 4.8);
    const R = mgrid([['', ''], ['', '']], -1.8, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('AS', 'ptr', -1.4, 5.9);
    await beat(tok, 2800);
    const cols = [[[3, 3], 'A x₁ = (3, 3) = 3·x₁'], [[1, -1], 'A x₂ = (1, −1) = 1·x₂']];
    for (let j = 0; j < 2; j++) {
      gS.col(j, GOLD);
      cols[j][0].forEach((v, i) => R.set(i, j, v)); R.col(j, GOLD);
      say('一次算一行：A 乘第 ' + (j + 1) + ' 個特徵向量', cols[j][1]);
      await beat(tok, 2200); gS.clearGlow(); R.clearGlow();
    }
    say('把 λ 從行裡提出來，放到右邊', 'AS = [λ₁x₁ λ₂x₂] = SΛ');
    tag('=', 'val', 0.2, 4.8);
    mgrid([[1, 1], [1, -1]], 0.9, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('S', 'ptr', 1.3, 5.9);
    mgrid([[3, 0], [0, 1]], 2.9, 5.2, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); tag('Λ', 'ptr alt', 3.3, 5.9);
    await beat(tok, 2800);
    mono(tag('AS = SΛ  ⇒  S⁻¹AS = Λ  ⇒  A = SΛS⁻¹', 'ptr', 0, 2.6));
    say('S 可逆（n 個獨立特徵向量）→ 兩邊乘 S⁻¹', 'A = SΛS⁻¹：取代 LU、QR 的新分解');
    await beat(tok, 3400);
    say('記法：A 乘的是它的特徵向量 S', '「A 在 S 的左邊」');
    await beat(tok, 2400);
    void gA;
  }
  async function scPowers(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), M = [[1, 0.5], [0.5, 1]];
    eigLine(F, [1, 1], COL.d); eigLine(F, [1, -1], COL.r);
    const p1 = F.w([4.2, 4.6], 0.3); tag('x₁：λ = 1.5', 'ptr', p1.x, p1.y, p1.z);
    const p2 = F.w([4.2, -4.6], 0.3); tag('x₂：λ = 0.5', 'ptr alt', p2.x, p2.y, p2.z);
    say('A² x = A(λx) = λ²x', '特徵值平方、特徵向量不變');
    await beat(tok, 2600);
    say('A² = SΛS⁻¹SΛS⁻¹ = SΛ²S⁻¹', 'Aᵏ = SΛᵏS⁻¹：中間的 S⁻¹S 全部抵消');
    await beat(tok, 3000);
    let u = [1, -0.6];
    const pts = [u];
    const au = F.arrow(u, COL.g, 'u₀');
    const kl = tag('', 'ptr', 0, 0.4, 1.2);
    for (let k = 1; k <= 6; k++) {
      const v = mulMV(M, u), from = u.slice();
      await tw(tok, 700, (t) => F.set(au, addv(from, scl(addv(v, scl(from, -1)), t))));
      u = v; pts.push(u); trail(F, [u], COL.b); au.tag('A' + (k === 1 ? '' : toSup(k)) + 'u₀');
      txt(kl, 'Λ' + toSup(k) + ' = diag(' + (Math.round(Math.pow(1.5, k) * 100) / 100) + ', ' + (Math.round(Math.pow(0.5, k) * 1000) / 1000) + ')');
      say('k = ' + k + '：x₁ 方向 ×1.5、x₂ 方向 ×0.5', 'Aᵏ 的特徵值 = λᵏ');
      await beat(tok, 900);
    }
    say('|λ| 最大的方向接管一切', '冪次的資訊在特徵值裡，不在 pivot 裡');
    await beat(tok, 3000);
  }
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function toSup(n) { return String(n).split('').map((d) => SUP[+d]).join(''); }
  async function scStability(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8);
    const run = async (M, u0, color, n, cap, f) => {
      say(cap, f);
      let u = u0; const a = F.arrow(u, color, 'u₀');
      for (let k = 1; k <= n; k++) { const v = mulMV(M, u), from = u.slice(); await tw(tok, 380, (t) => F.set(a, addv(from, scl(addv(v, scl(from, -1)), t)))); u = v; trail(F, [u], color, 0.07); }
      await beat(tok, 1500);
      return a;
    };
    say('什麼時候 Aᵏ → 0（穩定）？', 'Aᵏ = SΛᵏS⁻¹：S 不動，只看 Λᵏ');
    await beat(tok, 2600);
    eigLine(F, [1, 1], COL.d); eigLine(F, [1, -1], COL.r);
    await run([[0.5, 0.4], [0.4, 0.5]], [4, -1], COL.g, 10, 'λ = 0.9 和 0.1：都小於 1', 'u_k 縮向 0');
    lab.clear();
    const F2 = flat2(0.62, 6, 8);
    F.w = F2.w;
    await run(rot2(Math.PI / 6, 0.9), [4.5, 0], COL.c, 16, '複數特徵值 |λ| = 0.9：轉著縮進去', '條件要寫絕對值：所有 |λ| < 1');
    await run(rot2(Math.PI / 6, 1.08), [1, 0], COL.r, 16, '|λ| = 1.08 > 1：轉著往外跑', '不穩定');
    say('定理：Aᵏ → 0 ⇔ 所有 |λᵢ| < 1', '前提：有 n 個獨立特徵向量（可對角化）');
    await beat(tok, 3000);
  }
  async function scDistinct(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), G = F.grid(COL.a, 0.85);
    say('特徵值都相異 ⇒ 一定有 n 個獨立特徵向量', '例：MATLAB eig(rand(10)) 幾乎都是 10 個相異特徵值');
    const M = [[2, 0], [0, 0.5]];
    await tw(tok, 1300, (t) => G.setM(lerpM(I2, M, t)));
    eigLine(F, [1, 0], COL.d); eigLine(F, [0, 1], COL.r);
    say('λ = 2、0.5 相異：兩條特徵方向，獨立', '→ 可對角化');
    await beat(tok, 2600);
    await tw(tok, 900, (t) => G.setM(lerpM(M, I2, t)));
    lab.clear();
    const F2 = flat2(0.62, 6, 8); F2.grid(COL.a, 0.85);
    const vs = [];
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; vs.push(F2.arrow([2 * Math.cos(a), 2 * Math.sin(a)], COL.g)); }
    say('重根不一定糟：單位矩陣 I', 'λ = 1 重複 10 次，但每個向量都是特徵向量');
    vs.forEach((a) => a.glow(GOLD));
    await beat(tok, 2800);
    say('S 隨便選 n 個獨立向量：S⁻¹IS = I = Λ', '本來就是對角矩陣');
    await beat(tok, 2600);
    say('重根時要數：特徵向量夠不夠？', '可能夠（如 I），也可能不夠（下一個例子）');
    await beat(tok, 2600);
  }
  async function scDefective(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), M = [[2, 1], [0, 2]];
    say('A = [2 1; 0 2]：三角矩陣，特徵值在對角線', 'det(A − λI) = (2 − λ)² → λ = 2, 2');
    await beat(tok, 2800);
    say('A − 2I = [0 1; 0 0]：null space 只有 (1, 0)', '代數重數 2，幾何重數 1');
    const ax = F.arrow([1, 0], COL.a, 'x'), aAx = F.arrow([2, 0], COL.b, 'Ax');
    for (let k = 0; k <= 120; k++) {
      const a = k / 120 * Math.PI * 2, x = [2 * Math.cos(a), 2 * Math.sin(a)], y = mulMV(M, x);
      F.set(ax, x); F.set(aAx, scl(y, 0.75));
      const par = Math.abs(x[0] * y[1] - x[1] * y[0]) < 0.25;
      ax.glow(par ? GOLD : null); aAx.glow(par ? GOLD : null);
      await beat(tok, k % 60 === 0 ? 900 : 45);
    }
    eigLine(F, [1, 0], COL.d);
    say('掃一圈：只有 x 軸方向跟 Ax 共線', '只有一條特徵方向（橘色 Ax 畫成 0.75 倍）');
    await beat(tok, 2600);
    say('找不到 2 個獨立特徵向量 → 不能對角化', 'S 不可逆；這種矩陣要用 Jordan form');
    await beat(tok, 3000);
  }
  async function scUkExpansion(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), M = [[1, 0.5], [0.5, 1]];
    eigLine(F, [1, 1], COL.d); eigLine(F, [1, -1], COL.r);
    say('差分方程 uₖ₊₁ = A uₖ', '答案：u_k = Aᵏu₀，但怎麼真的算出來？');
    await beat(tok, 2800);
    const u0 = [1, 0.2], c1 = 0.6, c2 = 0.4;
    F.arrow(u0, COL.g, 'u₀');
    say('把 u₀ 拆成特徵向量的組合', 'u₀ = c₁x₁ + c₂x₂ = 0.6(1, 1) + 0.4(1, −1)');
    const a1 = F.arrow(scl([1, 1], c1), COL.d, 'c₁x₁'), a2 = F.arrow(scl([1, -1], c2), COL.r, 'c₂x₂', '', scl([1, 1], c1));
    await beat(tok, 2800);
    const as = F.arrow(u0, COL.b, 'u_k');
    for (let k = 1; k <= 5; k++) {
      const s1 = c1 * Math.pow(1.5, k), s2 = c2 * Math.pow(0.5, k);
      await tw(tok, 700, () => { F.set(a1, scl([1, 1], s1)); F.set(a2, scl([1, -1], s2), scl([1, 1], s1)); F.set(as, addv(scl([1, 1], s1), scl([1, -1], s2))); });
      say('k = ' + k + '：每一塊各走各的', 'u_k = 0.6·1.5' + toSup(k) + '·x₁ + 0.4·0.5' + toSup(k) + '·x₂');
      await beat(tok, 1000);
    }
    say('u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂ = SΛᵏc', '前提：u₀ 能用特徵向量展開（n 個獨立）');
    await beat(tok, 3200);
  }
  async function scFibMatrix(tok) {
    fresh([0, 3.4, 13], [0, 3.6, 0]);
    const F = [0, 1, 1, 2, 3, 5, 8, 13];
    say('Fibonacci：0, 1, 1, 2, 3, 5, 8, 13, …', 'Fₖ₊₂ = Fₖ₊₁ + Fₖ；F₁₀₀ 是多少？長多快？');
    const cs = [];
    for (let k = 0; k < F.length; k++) { cs.push(cube(F[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2)); tag('F' + k, 'idx', -6 + k * 0.9, 5.3); await beat(tok, 380); }
    await beat(tok, 1200);
    say('二階的純量方程 → 一階的 2×2 系統', '令 uₖ = (Fₖ₊₁, Fₖ)，補一條 Fₖ₊₁ = Fₖ₊₁');
    mono(tag('[Fₖ₊₂]   [1 1] [Fₖ₊₁]', '', -2.6, 4.1)); mono(tag('[Fₖ₊₁] = [1 0] [Fₖ    ]', '', -2.6, 3.55));
    await beat(tok, 3200);
    const g = mgrid([[1, 1], [1, 0]], 2.6, 4.2, 0, { color: () => COL.b }); tag('A', 'ptr', 3.0, 4.9);
    say('A = [1 1; 1 0]，uₖ₊₁ = A uₖ', 'A 對稱 → 特徵值是實數');
    await beat(tok, 2600);
    mono(tag('det(A − λI) = λ² − λ − 1 = 0', 'ptr', 0, 2.5));
    say('跟遞迴式 Fₖ₊₂ − Fₖ₊₁ − Fₖ = 0 長得一樣', '');
    await beat(tok, 2600);
    mono(tag('λ = (1 ± √5) / 2 ≈ 1.618、−0.618', 'ptr alt', 0, 1.8));
    say('二次公式：λ₁ ≈ 1.618、λ₂ ≈ −0.618', '檢查：λ₁ + λ₂ = 1 = trace，λ₁λ₂ = −1 = det');
    await beat(tok, 3200);
    void g; void cs;
  }
  async function scFibGrowth(tok) {
    fresh([0, 3.6, 13], [0, 3.4, 0]);
    const l1 = (1 + Math.sqrt(5)) / 2, l2 = (1 - Math.sqrt(5)) / 2;
    say('哪個特徵值控制成長？大的那個：1.618', 'F₁₀₀ ≈ c₁ · 1.618¹⁰⁰');
    const fib = [0, 1]; for (let k = 2; k <= 13; k++) fib.push(fib[k - 1] + fib[k - 2]);
    const rl = tag('', 'ptr alt', 3.6, 6.4);
    for (let k = 1; k <= 13; k++) {
      const h = Math.max(0.03, fib[k] * 0.022), x = -6.2 + k * 0.82;
      const m = lab.box(COL.a, [0.6, 1, 0.6]); m.scale.y = 0.001; m.position.set(x, 0, 0); lab.world.add(m);
      await tw(tok, 300, (t) => { m.scale.y = h * t; m.position.y = h * t / 2; });
      tag(String(fib[k]), 'idx', x, h + 0.3);
      if (k >= 2) txt(rl, 'F' + k + ' / F' + (k - 1) + ' = ' + (fib[k] / fib[k - 1]).toFixed(4));
      await beat(tok, 260);
    }
    say('相鄰兩項的比值 → 1.618…（黃金比例）', '每一步大約乘上 λ₁');
    await beat(tok, 2800);
    say('特徵向量 x = (λ, 1)；u₀ = (F₁, F₀) = (1, 0)', 'u₀ = (x₁ − x₂)/√5 → c₁ = 1/√5');
    await beat(tok, 3000);
    mono(tag('F_k = (λ₁ᵏ − λ₂ᵏ) / √5', 'ptr', -3, 5.8));
    say('(−0.618)ᵏ 很快趨近 0，可以忽略', 'F₁₀₀ ≈ 1.618¹⁰⁰ / √5 ≈ 3.54 × 10²⁰');
    await beat(tok, 3200);
    say('動態問題：Aᵏ 隨時間演化，特徵值決定一切', '靜態的 Ax = b 看 pivot；動態的 u_k 看 λ');
    await beat(tok, 2800);
    void l2; void l1;
  }

  // ─── 8MF3pz-oYHo（MIT 18.06 L24）：Markov 矩陣、Fourier 級數 ───
  const MK = [[0.1, 0.01, 0.3], [0.2, 0.99, 0.3], [0.7, 0, 0.4]];
  async function scMarkovProps(tok) {
    fresh([0, 3.4, 12.5], [0, 3.4, 0]);
    const g = mgrid(MK, -1.6, 5.4, 0, { size: 0.82, gap: 1.05, color: () => COL.a });
    tag('A', 'ptr', -0.55, 6.25);
    say('Markov 矩陣：隨手寫一個 3×3', '[.1 .01 .3; .2 .99 .3; .7 0 .4]');
    await beat(tok, 2600);
    say('性質 1：每個元素 ≥ 0', '（機率不會是負的）');
    g.c.flat().forEach((m) => glow(m, GREEN)); await beat(tok, 2000); g.clearGlow();
    const sums = [];
    for (let j = 0; j < 3; j++) {
      g.col(j, GOLD);
      sums.push(cube('Σ = 1', COL.g, [0.95, 0.5, 0.3], g.xs[j], 2.0, 0, 2));
      say('性質 2：每一行加起來 = 1', MK.map((r) => r[j]).join(' + ') + ' = 1');
      await beat(tok, 1300); g.clearGlow();
    }
    say('Aᵏ 也還是 Markov 矩陣', '我們關心 Aᵏ 與穩定狀態（steady state）');
    await beat(tok, 2600);
    say('穩定狀態 ↔ λ = 1（不是微分方程裡的 λ = 0）', 'λ = 0 的部分在冪次裡一步就消失');
    await beat(tok, 3000);
  }
  async function scMarkovSteady(tok) {
    fresh([0, 3.6, 12.5], [0, 3.2, 0]);
    const E = eigInfo(MK);
    say('關鍵事實：λ = 1 一定是特徵值', '其他特徵值 |λ| < 1（這裡 ≈ ' + E.groups.filter((g) => Math.abs(g.re - 1) > 1e-6).map((g) => g.re.toFixed(3)).join('、') + '）');
    await beat(tok, 3000);
    mono(tag('u_k = c₁·1ᵏ·x₁ + c₂λ₂ᵏx₂ + c₃λ₃ᵏx₃', 'ptr', 0, 6.4));
    say('u_k 展開：λ₂ᵏ、λ₃ᵏ → 0', '只剩 c₁x₁：穩定狀態就是 λ = 1 的特徵向量');
    await beat(tok, 3000);
    let u = [1 / 3, 1 / 3, 1 / 3];
    const H = 4.5, xs = [-3, 0, 3];
    const bs = xs.map((x, i) => { const m = lab.box([COL.b, COL.a, COL.c][i], [1.6, 1, 1.4]); m.position.set(x, 0.5, 0); lab.world.add(m); tag('狀態 ' + (i + 1), 'idx', x, 0, 1.2); return m; });
    const ls = xs.map((x) => tag('', 'ptr', x, 1, 0.9));
    const kl = tag('', 'ptr alt', 5.6, 5.2);
    const show = (v) => v.forEach((p, i) => { const h = Math.max(0.02, p * H); bs[i].scale.y = h; bs[i].position.y = h / 2; ls[i].position.y = h + 0.4; txt(ls[i], (p * 100).toFixed(1) + '%'); });
    show(u);
    for (let k = 1; k <= 14; k++) {
      const v = mulMV(MK, u), from = u.slice();
      await tw(tok, 350, (t) => show(addv(from, scl(addv(v, scl(from, -1)), t))));
      u = v; txt(kl, 'k = ' + k);
      if (k === 1) say('從平均分配開始，一直乘 A', '總和永遠是 100%');
      await beat(tok, 180);
    }
    const x1 = [0.6, 33, 0.7], s = x1.reduce((a, b) => a + b, 0);
    say('收斂到 x₁ ∝ (0.6, 33, 0.7)', '= (' + x1.map((x) => (x / s * 100).toFixed(1) + '%').join(', ') + ')；每個分量 ≥ 0');
    await beat(tok, 3200);
  }
  async function scMarkovWhy(tok) {
    fresh([0, 3.4, 12.5], [0, 3.4, 0]);
    const AI = MK.map((r, i) => r.map((x, j) => Math.round((x - (i === j ? 1 : 0)) * 100) / 100));
    const g = mgrid(MK, -4.2, 5.4, 0, { size: 0.82, gap: 1.05, color: () => COL.a });
    tag('A', 'ptr', -3.15, 6.25);
    say('為什麼 λ = 1？看 A − I 是否奇異', '');
    await beat(tok, 1800);
    AI.forEach((r, i) => r.forEach((v, j) => g.set(i, j, v)));
    g.c.forEach((r, i) => tint(r[i], COL.r));
    tag('A − I', 'ptr', -3.15, 6.25);
    say('對角線各減 1：A − I', '每一行加起來變成 0');
    await beat(tok, 2600);
    say('行和全 0 ⇒ 三列相加 = 零列', '(1, 1, 1) 乘上各列：列1 + 列2 + 列3 = 0');
    for (let i = 0; i < 3; i++) { g.row(i, GOLD); await beat(tok, 500); }
    const zr = mgrid([[0, 0, 0]], -4.2, 1.8, 0, { size: 0.82, gap: 1.05, color: () => COL.g }); tag('列的和', 'idx', -5.4, 1.8);
    await beat(tok, 1500); g.clearGlow();
    say('列相依 → A − I 奇異 → λ = 1 是特徵值', '(1, 1, 1) 在 A − I 的 left null space（Aᵀ 的特徵向量）');
    await beat(tok, 3000);
    const xs = [0.6, 33, 0.7];
    xs.forEach((v, i) => cube(fmt(v), COL.d, [0.82, 0.82, 0.3], 0.6, 5.4 - i * 1.05, 0, 2));
    tag('x₁', 'ptr alt', 0.6, 6.25);
    say('A 自己的特徵向量 x₁ 在 N(A − I)', '解出 x₁ = (0.6, 33, 0.7)：分量都是正的');
    await beat(tok, 2800);
    mono(tag('第 1 列：−0.9(0.6) + 0.01(33) + 0.3(0.7) = −0.54 + 0.33 + 0.21 = 0', '', 2.6, 3.0));
    await beat(tok, 2400);
    say('附帶一提：A 和 Aᵀ 特徵值相同', 'det(A − λI) = det(Aᵀ − λI)；特徵向量不同');
    await beat(tok, 3200);
    void zr;
  }
  async function scCalMass(tok) {
    fresh([0, 3.6, 12.5], [0, 3.2, 0]);
    const A = [[0.9, 0.2], [0.1, 0.8]];
    const g = mgrid(A, -0.7, 6.6, 0, { size: 0.7, gap: 0.9, color: () => '#e7dcc8' }); void g;
    say('兩個狀態：California、Massachusetts', '加州 90% 留下、10% 搬去麻州；麻州 80% 留下、20% 搬去加州');
    const H = 4.4;
    const bc = lab.box(COL.b, [2, 1, 1.6]), bm = lab.box(COL.a, [2, 1, 1.6]);
    bc.position.set(-3, 0.5, 0); bm.position.set(3, 0.5, 0); lab.world.add(bc); lab.world.add(bm);
    tag('California', 'idx', -3, 0, 1.3); tag('Massachusetts', 'idx', 3, 0, 1.3);
    const lc = tag('', 'ptr', -3, 1, 1), lm = tag('', 'ptr', 3, 1, 1), kl = tag('', 'ptr alt', 0, 1.2, 0);
    const show = (u) => { [[bc, lc, -3], [bm, lm, 3]].forEach(([b, l], i) => { const h = Math.max(0.02, u[i] / 1000 * H); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; txt(l, String(Math.round(u[i]))); }); };
    let u = [0, 1000]; show(u); txt(kl, 'k = 0');
    await beat(tok, 3000);
    for (let k = 1; k <= 8; k++) {
      const v = mulMV(A, u), from = u.slice();
      const d1 = dotBall(COL.b, 0.16), d2 = dotBall(COL.a, 0.16);
      await tw(tok, 600, (t) => { show(addv(from, scl(addv(v, scl(from, -1)), t))); d1.position.set(-3 + 6 * t, 3 + Math.sin(t * Math.PI), 0.9); d2.position.set(3 - 6 * t, 2.4 + Math.sin(t * Math.PI) * 0.6, 0.9); });
      lab.world.remove(d1); lab.world.remove(d2);
      u = v; txt(kl, 'k = ' + k);
      if (k === 1) { say('一年後：(200, 800)', 'u₁ = A u₀；總數 1000 不變'); await beat(tok, 2200); }
      else await beat(tok, 300);
    }
    say('λ = 1（必有）、λ = 0.7（trace 1.7 − 1）', 'x₁ = (2, 1)、x₂ = (−1, 1)');
    await beat(tok, 2800);
    mono(tag('u_k = (1000/3)(2, 1) + (2000/3)(0.7)ᵏ(−1, 1)', 'ptr', 0, 5.5));
    say('穩定狀態 = (2/3, 1/3) × 1000 ≈ (667, 333)', '0.7ᵏ 那一項逐漸消失');
    await beat(tok, 3200);
    say('有些書用列向量：u A，改成「每列和 = 1」', '只是轉置，觀念一樣');
    await beat(tok, 2600);
  }
  async function scOrthoExpand(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const R = rodrigues([1, 2, 2], 0.7), q = [0, 1, 2].map((j) => R.map((r) => r[j]));
    q.forEach((v, i) => S.arrow(v, [COL.d, COL.r, COL.a][i], 'q' + (i + 1)));
    say('標準正交基底 q₁、q₂、q₃', 'qᵢᵀqⱼ = 0（i ≠ j），qᵢᵀqᵢ = 1');
    await beat(tok, 2600);
    const v = [1.2, 0.8, 1.6]; S.arrow(v, COL.k, 'v');
    say('v = x₁q₁ + x₂q₂ + x₃q₃：x₁ 是多少？', '兩邊都跟 q₁ 做內積');
    await beat(tok, 2600);
    let base = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const x = dot(q[i], v), a = arrow([COL.d, COL.r, COL.a][i], 0.07);
      const b0 = base.slice();
      await tw(tok, 900, (t) => S.set(a, scl(q[i], x * t), b0));
      base = addv(base, scl(q[i], x));
      say('x' + (i + 1) + ' = q' + (i + 1) + 'ᵀv = ' + x.toFixed(2), '其他項的內積都是 0，消掉了');
      await beat(tok, 1500);
    }
    say('矩陣語言：Qx = v ⇒ x = Q⁻¹v = Qᵀv', 'Q 的行標準正交 ⇒ Q⁻¹ = Qᵀ，不用解方程式');
    await beat(tok, 3200);
  }
  async function scFourier(tok) {
    fresh([0, 3.2, 12.5], [0, 3.2, 0]);
    const X0 = -5.6, sx = 11.2 / (2 * Math.PI), Y0 = 3.4, sy = 0.9;
    const P = (fn) => { const pts = []; for (let k = 0; k <= 160; k++) { const x = k / 160 * 2 * Math.PI; pts.push(V3(X0 + x * sx, Y0 + fn(x) * sy, 0)); } return pts; };
    const curve = (fn, color) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(P(fn)), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; };
    rod('#a8987f', 0.015).setW(V3(X0, Y0, 0), V3(X0 + 11.4, Y0, 0)); tag('0', 'idx', X0, Y0 - 0.3); tag('2π', 'idx', X0 + 11.2, Y0 - 0.3);
    say('Fourier：把函數寫成 1、cos x、sin x、cos 2x、… 的組合', 'f(x) = a₀ + a₁cos x + b₁sin x + a₂cos 2x + …');
    await beat(tok, 2800);
    const f = (x) => 0.5 + 1.2 * Math.cos(x) + 0.8 * Math.sin(x) + 0.4 * Math.cos(2 * x);
    curve(f, COL.k); tag('f(x)', 'ptr', X0 + 0.4, Y0 + f(0) * sy + 0.4);
    say('向量 → 函數；R^n → 無限維的函數空間', '（示範用 f = 0.5 + 1.2cos x + 0.8sin x + 0.4cos 2x）');
    await beat(tok, 2800);
    say('函數的內積：把 Σ vᵢwᵢ 換成 ∫₀^(2π) f(x)g(x) dx', '週期 2π');
    await beat(tok, 2600);
    // sin x · cos x 的面積：正負抵消
    const barsG = [];
    const area = (fn, color1, color2) => { barsG.forEach((b) => lab.world.remove(b)); barsG.length = 0; for (let k = 0; k < 60; k++) { const x = (k + 0.5) / 60 * 2 * Math.PI, v = fn(x), h = Math.abs(v) * sy; const m = new THREE.Mesh(new THREE.BoxGeometry(11.2 / 60 * 0.9, Math.max(h, 0.001), 0.05), new THREE.MeshBasicMaterial({ color: v >= 0 ? color1 : color2, transparent: true, opacity: 0.45 })); m.position.set(X0 + x * sx, Y0 + (v >= 0 ? h / 2 : -h / 2), -0.1); lab.world.add(m); barsG.push(m); } };
    area((x) => Math.sin(x) * Math.cos(x), COL.d, COL.r);
    say('sin x · cos x：正負面積抵消', '∫ sin x cos x dx = 0 → 正交');
    await beat(tok, 3000);
    area((x) => f(x) * Math.cos(x), COL.d, COL.r);
    say('求 a₁：兩邊乘 cos x 再積分', '其他項全部正交消失，只剩 a₁∫cos²x dx = a₁π');
    await beat(tok, 3200);
    say('a₁ = (1/π)∫₀^(2π) f(x) cos x dx = 1.2', '跟 x₁ = q₁ᵀv 完全同一個想法');
    await beat(tok, 2800);
    say('a₀ = f 的平均值', '');
    await beat(tok, 2000);
  }

  // ─── 課本補充（L21、3Blue1Brown、L28 的例子）───
  async function scEigenIntro(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), G = F.grid(COL.a, 0.8), M = [[3, 1], [0, 2]];
    const vs = [[1, 0], [-1, 1], [1, 1], [0, 1.2], [-1, -0.4]];
    const cols = [COL.d, COL.r, COL.k, COL.k, COL.k];
    const spans = vs.map((v, i) => eigLine(F, v, i < 2 ? cols[i] : '#bfb29c'));
    const as = vs.map((v, i) => F.arrow(v, cols[i]));
    say('A = [3 1; 0 2]：每個向量會被帶去哪？', '細線 = 每個向量自己的 span');
    await beat(tok, 2800);
    await tw(tok, 2200, (t) => { const N = lerpM(I2, M, t); G.setM(N); as.forEach((a, i) => F.set(a, mulMV(N, vs[i]))); });
    say('大部分向量被轉離自己的 span', '');
    as.slice(2).forEach((a) => a.glow(RED));
    await beat(tok, 2000);
    as[0].glow(GOLD); as[1].glow(GOLD); as[0].tag('×3'); as[1].tag('×2');
    say('x 軸上的向量：只被拉長 3 倍', '(−1, 1) 方向：只被拉長 2 倍');
    await beat(tok, 2800);
    say('Ax = λx：特徵向量（eigenvector）與特徵值（eigenvalue）', 'λ₁ = 3、λ₂ = 2');
    await beat(tok, 2800);
    say('（課本補充：3Blue1Brown 第 14 集的例子）', '');
    await beat(tok, 1500);
    void spans;
  }
  async function scCharPoly(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), G = F.grid(COL.a, 0.85), sq = F.square();
    const M = [[3, 1], [0, 2]];
    say('Ax = λx ⇔ (A − λI)x = 0，x ≠ 0', '→ A − λI 必須把某個方向壓成 0 → det(A − λI) = 0');
    await beat(tok, 3000);
    const lab2 = tag('', 'ptr alt', 0, 0.5, 1.6);
    let lam = 0;
    const setL = (l) => { const N = [[M[0][0] - l, M[0][1]], [M[1][0], M[1][1] - l]]; G.setM(N); sq.setM(N); const d = det2(N); txt(lab2, 'λ = ' + l.toFixed(2) + '　det(A − λI) = ' + d.toFixed(2)); return d; };
    setL(0);
    for (const [a, b, hold] of [[0, 2, true], [2, 3, true], [3, 4, false]]) {
      await tw(tok, 2000, (t) => { lam = a + (b - a) * t; setL(lam); });
      if (hold) { say('λ = ' + b + '：平面被壓成一條線，det = 0', '(' + (3 - b) + ')(' + (2 - b) + ') = 0'); await beat(tok, 2200); }
    }
    say('det(A − λI) = (3 − λ)(2 − λ) = 0', '特徵多項式的根 = 特徵值：λ = 2、3');
    await beat(tok, 3000);
    say('地雷：不能先列運算再求特徵值', '消去（R2 − ℓR1）不改 det，卻會改特徵值');
    await beat(tok, 2600);
  }
  async function scRotation(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(0.62, 6, 8), G = F.grid(COL.a, 0.85);
    const vs = [[2, 0], [0, 2], [1.5, 1.5], [-1.5, 1]].map((v) => [v, F.arrow(v, COL.k)]);
    say('旋轉 90°：[0 −1; 1 0]', '每個向量都被轉走');
    await tw(tok, 2000, (t) => { const N = rot2(t * Math.PI / 2); G.setM(N); vs.forEach(([v, a]) => F.set(a, mulMV(N, v))); });
    vs.forEach(([, a]) => a.glow(RED));
    say('沒有實數特徵向量', 'det(A − λI) = λ² + 1 = 0 → λ = ±i');
    await beat(tok, 2800);
    await tw(tok, 900, (t) => { const N = rot2((1 - t) * Math.PI / 2); G.setM(N); vs.forEach(([v, a]) => F.set(a, mulMV(N, v))); });
    vs.forEach(([, a]) => a.glow(null));
    say('Shear [1 1; 0 1]：λ = 1（重根）', '');
    await tw(tok, 1800, (t) => { const N = [[1, t], [0, 1]]; G.setM(N); vs.forEach(([v, a]) => F.set(a, mulMV(N, v))); });
    vs[0][1].glow(GOLD); eigLine(F, [1, 0], COL.d);
    say('只有 x 軸是特徵方向', '特徵向量不夠 → 不能對角化');
    await beat(tok, 3000);
  }
  async function scEigen3d(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 20, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const axis = [1, 1, 1];
    S.line(axis, COL.g, 2.6, [0, 0, 0], 0.03);
    const vs = [[1.6, 0, 0], [0, 1.6, 0], [0, 0, 1.6], [1, -1, 0.5], [1.2, 1.2, 1.2]];
    const as = vs.map((v, i) => S.arrow(v, i === 4 ? COL.g : COL.k, i === 4 ? '軸 (1, 1, 1)' : ''));
    say('3D 旋轉：A = [0 0 1; 1 0 0; 0 1 0]', 'x → y → z → x：繞 (1, 1, 1) 轉 120°');
    await beat(tok, 2600);
    await tw(tok, 2600, (t) => { const R = rodrigues(axis, t * 2 * Math.PI / 3); as.forEach((a, i) => S.set(a, mulMV(R, vs[i]))); });
    as[4].glow(GOLD);
    say('旋轉軸上的向量不動：特徵值 λ = 1', '旋轉的特徵向量 = 旋轉軸');
    await orbit(tok, 3000, 30, 90, 20, 10.5, [0, 2.4, 0]);
    say('另外兩個特徵值是複數 e^(±2πi/3)', '三個特徵值乘積 = det = 1，和 = trace = 0');
    await beat(tok, 3000);
  }
  async function scTrick(tok) {
    fresh([0, 3.2, 12], [0, 3.2, 0]);
    say('2×2 快速求特徵值', 'm = (λ₁ + λ₂)/2 = trace/2，p = λ₁λ₂ = det');
    await beat(tok, 2800);
    rod('#8a7b66', 0.02).setW(V3(-6, 2.4, 0), V3(6, 2.4, 0));
    for (let k = -2; k <= 9; k++) { const x = -3.6 + k * 0.95; rod('#8a7b66', 0.015).setW(V3(x, 2.2, 0), V3(x, 2.6, 0)); tag(String(k), 'idx', x, 1.9); }
    const X = (v) => -3.6 + v * 0.95;
    const show = async (M, nm) => {
      const m = (M[0][0] + M[1][1]) / 2, p = det2(M), d = Math.sqrt(m * m - p);
      say(nm + '：m = ' + fmt(m) + '、p = ' + fmt(p), 'λ = m ± √(m² − p) = ' + fmt(m) + ' ± √' + fmt(m * m - p));
      const c = dotBall(COL.k, 0.14); c.position.set(X(m), 2.4, 0); const cl = tag('m', 'ptr', X(m), 3.0);
      await beat(tok, 1500);
      const a = dotBall(COL.d, 0.16), b = dotBall(COL.r, 0.16);
      await tw(tok, 1200, (t) => { a.position.set(X(m + d * t), 2.4, 0); b.position.set(X(m - d * t), 2.4, 0); });
      const la = tag('λ = ' + (Math.round((m + d) * 1000) / 1000), 'ptr alt', X(m + d), 3.6), lb = tag('λ = ' + (Math.round((m - d) * 1000) / 1000), 'ptr alt', X(m - d), 3.6);
      await beat(tok, 2400);
      [c, a, b, cl, la, lb].forEach((o) => { lab.world.remove(o); if (o.element) o.element.remove(); });
    };
    await show([[2, 7], [1, 8]], '[2 7; 1 8]');
    await show([[3, 1], [4, 1]], '[3 1; 4 1]');
    say('兩個特徵值以 m 為中心對稱', '（課本補充：3Blue1Brown 第 15 集的技巧）');
    await beat(tok, 2600);
  }
  async function scSimilar(tok) {
    fresh([0, 3.4, 13], [0, 3.6, 0]);
    say('相似：B = M⁻¹AM（M 可逆）', '同一個變換、換一組基底來寫');
    const A = [[2, 1], [1, 2]], M = [[1, 4], [0, 1]], Mi = [[1, -4], [0, 1]], B = mm(Mi, mm(A, M));
    mgrid(Mi, -6.2, 5.2, 0, { color: () => COL.c }); tag('M⁻¹', 'ptr', -5.8, 5.9);
    mgrid(A, -4.2, 5.2, 0, { color: () => COL.a }); tag('A', 'ptr', -3.8, 5.9);
    mgrid(M, -2.2, 5.2, 0, { color: () => COL.c }); tag('M', 'ptr', -1.8, 5.9);
    tag('=', 'val', -0.4, 4.8);
    await beat(tok, 2600);
    const gB = mgrid(B, 0.4, 5.2, 0, { gap: 0.95, size: 0.82, color: () => COL.b }); tag('B', 'ptr alt', 0.9, 5.9);
    say('A = [2 1; 1 2]、M = [1 4; 0 1] → B = [−2 −15; 1 6]', '');
    await beat(tok, 2800);
    mono(tag('A：trace 4、det 3 → λ = 3, 1', '', -3.5, 2.8)); mono(tag('B：trace 4、det 3 → λ = 3, 1', '', 2.2, 2.8));
    say('相似矩陣的特徵值相同', 'det(M⁻¹AM − λI) = det(M⁻¹(A − λI)M) = det(A − λI)');
    await beat(tok, 3200);
    say('特徵向量不同：B 的特徵向量 = M⁻¹ × A 的特徵向量', '可對角化 = 跟 Λ 相似');
    await beat(tok, 3000);
    say('（Strang L28 的例子）', '');
    await beat(tok, 1600);
    void gB;
  }
  async function scJordan(tok) {
    fresh([0, 3.4, 13], [0, 3.6, 0]);
    say('重根 λ = 4、特徵向量只有 1 個：不能對角化', '那「最接近對角」的形式是？');
    await beat(tok, 2600);
    const g1 = mgrid([[4, 0], [0, 4]], -5.6, 5.2, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); tag('4I', 'ptr', -5.2, 5.9);
    say('4I：只跟自己相似', 'M⁻¹(4I)M = 4I');
    await beat(tok, 2400);
    const g2 = mgrid([[4, 1], [0, 4]], -1.2, 5.2, 0, { color: (i, j) => (i === j ? COL.g : i === 0 && j === 1 ? COL.b : '#e7dcc8') }); tag('Jordan block', 'ptr alt', -0.8, 5.9);
    say('Jordan block J = [4 1; 0 4]', '對角放 λ、上面一條 1');
    await beat(tok, 2400);
    mono(tag('[5 1; −1 3]、[4 0; 17 4]… 都相似於 J', '', 2.6, 4.4));
    say('所有 trace 8、det 16、但不是 4I 的矩陣', '都跟 J 相似');
    await beat(tok, 3000);
    const g3 = mgrid([[7, 1, 0, 0], [0, 7, 1, 0], [0, 0, 7, 0], [0, 0, 0, 7]], -5.6, 3.0, 0, { size: 0.55, gap: 0.66, color: (i, j) => (i === j ? COL.g : j === i + 1 && (i < 2) ? COL.b : '#e7dcc8') });
    say('Jordan form J = diag(J₁, …, J_s)', 'block 數 = 獨立特徵向量數；可對角化 ⇔ 每個 block 都是 1×1');
    await beat(tok, 3400);
    say('（課本補充：Strang L28；考試掌握定義與基本求法）', '');
    await beat(tok, 1800);
    void g1; void g2; void g3;
  }
  async function scRowOpsTrap(tok) {
    fresh([0, 3.4, 12.5], [0, 3.6, 0]);
    const g = mgrid([[2, 1], [1, 2]], -4.6, 5.0, 0, { color: () => COL.a }); tag('A', 'ptr', -4.2, 5.8);
    say('地雷：先把矩陣列運算成上三角，再讀對角線？', '');
    await beat(tok, 2400);
    mono(tag('λ = 3, 1', 'ptr', -4.2, 3.0));
    say('A = [2 1; 1 2] 的特徵值：3、1', 'λ² − 4λ + 3 = 0');
    await beat(tok, 2400);
    const R = mgrid([[2, 1], [0, 1.5]], 0.8, 5.0, 0, { color: () => COL.b }); tag('R2 − ½R1', 'ptr', 1.2, 5.8);
    g.row(1, GOLD);
    say('R2 − ½R1 → [2 1; 0 1.5]', '對角線是 2、1.5');
    await beat(tok, 2600);
    mono(tag('λ = 2, 1.5 ✗', 'ptr alt', 1.2, 3.0));
    R.row(1, RED);
    say('特徵值變了！列運算會改變特徵值', '<span class="no">一定要直接解 det(A − λI) = 0</span>');
    await beat(tok, 3000);
    say('消去（R2 − ℓR1）只保留 det', 'trace、特徵值都會變');
    await beat(tok, 2600);
  }

  const scenes = {
    'diag-as-slambda': { title: 'AS = SΛ：一次一行', play: scDiagASSL },
    'powers-ak': { title: 'Aᵏ = SΛᵏS⁻¹：特徵值變 λᵏ', play: scPowers },
    'stability': { title: 'Aᵏ → 0 ⇔ 所有 |λ| < 1', play: scStability },
    'distinct-eigen': { title: '相異特徵值 ⇒ 獨立特徵向量；I 的重根', play: scDistinct },
    'defective': { title: '[2 1; 0 2]：代數重數 2、幾何重數 1', play: scDefective },
    'uk-expansion': { title: 'u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂', play: scUkExpansion },
    'fibonacci-matrix': { title: 'Fibonacci 化成 uₖ₊₁ = Auₖ', play: scFibMatrix },
    'fibonacci-growth': { title: 'Fibonacci 的成長率 = 1.618', play: scFibGrowth },
    'markov-props': { title: 'Markov 矩陣：非負、行和 = 1', play: scMarkovProps },
    'markov-steady': { title: 'λ = 1 → 穩定狀態', play: scMarkovSteady },
    'markov-why-one': { title: '為什麼 λ = 1：A − I 的列相依', play: scMarkovWhy },
    'cal-mass': { title: '加州 / 麻州人口流動', play: scCalMass },
    'orthonormal-expand': { title: '標準正交基底展開：xᵢ = qᵢᵀv', play: scOrthoExpand },
    'fourier': { title: 'Fourier 級數：函數空間的正交展開', play: scFourier },
    'eigen-intro': { title: '（課本）特徵向量：留在自己 span 上的向量', play: scEigenIntro },
    'char-poly': { title: '（課本）det(A − λI) = 0：把平面壓扁的 λ', play: scCharPoly },
    'rotation-complex': { title: '（課本）旋轉沒有實數特徵向量；shear 只有一條', play: scRotation },
    'eigen-3d': { title: '（課本）3D 旋轉：旋轉軸是特徵向量', play: scEigen3d },
    'trace-det-trick': { title: '（課本）快速算法：λ = m ± √(m² − p)', play: scTrick },
    'similar-matrices': { title: '（課本）相似矩陣：特徵值相同', play: scSimilar },
    'jordan-form': { title: '（課本）Jordan form 的概念', play: scJordan },
    'row-ops-trap': { title: '（課本）地雷：列運算會改變特徵值', play: scRowOpsTrap },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ egA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 6 章（特徵值）— cued scenes：MIT 18.06 L21（兩個上傳版本共用）、L22、L23 ───
// 每個特徵值、特徵向量、S、Λ、Aᵏ、e^{At}、ODE 解都由程式當場算，畫面顯示 ✓／✘。
// 老師沒給數字的地方用自己選的小例子，畫面標「示意」。
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, t, x, y, z = 0) => { if (!b) log('檢查沒過：' + t, true); return b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const nearV = (a, b, e = 1e-9) => a.every((v, i) => near(v, b[i], e));
const nearM = (A, B, e = 1e-9) => A.every((r, i) => nearV(r, B[i], e));
const addM = (A, B, k = 1) => A.map((r, i) => r.map((v, j) => v + k * B[i][j]));
const sclM = (A, k) => A.map((r) => r.map((v) => v * k));
const diagM = (d) => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));
const powM = (A, k) => { let R = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))); for (let i = 0; i < k; i++) R = mm(R, A); return R; };
const trM = (A) => A.reduce((s, r, i) => s + r[i], 0);
const r3 = (x) => Math.round(x * 1000) / 1000;
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
// 右邊的「黑板」：一列一列往下寫
const X0 = 3.0, R = (k) => 5.7 - k * 0.7;
const row = (f, t, k) => f(t, X0, R(k));
const mlab = (name, M, k, cls = 'ptr') => tag(name + ' = ' + mstr(M), cls, X0, R(k));
const ln = (o) => { if (o) remove(o); };
// everything added after mark() can be wiped in one go
const mark = () => lab.world.children.length;
function wipe(n) { while (lab.world.children.length > n) { const o = lab.world.children[lab.world.children.length - 1]; kill(o); if (o.parent === lab.world) lab.world.remove(o); } }
const CAM = [[0, 3.1, 12], [0, 3.0, 0]];
function scene(id, title, steps, o = {}) {
  FRAG.push(['egA-' + id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    if (o.init) await o.init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 立起來的 2D 平面（左半邊），右半邊寫字 ──
function arw(color, r = 0.05) {
  const mt = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mt), hh = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, 1, 14), mt);
  const g = new THREE.Group(); g.add(sh, hh); g.visible = false; lab.world.add(g);
  const UPV = V3(0, 1, 0);
  g.setW = (a, b) => {
    const d = b.clone().sub(a), L = d.length(); g.visible = L > 1e-4;
    if (g.lbl) g.lbl.element.style.visibility = g.visible ? '' : 'hidden';
    if (!g.visible) return g;
    const u = d.clone().divideScalar(L), hl = Math.min(0.26, L * 0.45), sl = L - hl;
    sh.quaternion.setFromUnitVectors(UPV, u); hh.quaternion.copy(sh.quaternion);
    sh.scale.set(1, Math.max(sl, 1e-3), 1); sh.position.copy(a).addScaledVector(u, sl / 2);
    hh.scale.set(1, hl, 1); hh.position.copy(a).addScaledVector(u, sl + hl / 2);
    if (g.lbl) g.lbl.position.copy(b).addScaledVector(u, 0.3).add(V3(0, 0.12, 0.1));
    return g;
  };
  g.tag = (t, cls) => { if (!g.lbl) { g.lbl = lab.label('', cls || 'idx'); lab.world.add(g.lbl); } txt(g.lbl, t); return g; };
  g.glow = (c) => { mt.emissive = new THREE.Color(c || '#000000'); };
  g.col = (c) => mt.color.set(c);
  return g;
}
function plane2(ox = -3.4, oy = 3.0, s = 0.42, ext = 6) {
  const F = { ox, oy, s, ext, M: I2 };
  F.w = (p, z = 0.03) => V3(ox + p[0] * s, oy + p[1] * s, z);
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(2 * ext * s + 0.4, 2 * ext * s + 0.4), new THREE.MeshBasicMaterial({ color: '#fbf6ec' }));
  bd.position.set(ox, oy, -0.04); lab.world.add(bd);
  const mk = (color, op) => { const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); lab.world.add(l); return l; };
  const gridAt = (l, M, z) => {
    const pts = [];
    for (let k = -ext; k <= ext; k++) for (const [a, b] of [[[k, -ext], [k, ext]], [[-ext, k], [ext, k]]]) { const c = clip(mulMV(M, a), mulMV(M, b), ext); if (c) pts.push(F.w(c[0], z), F.w(c[1], z)); }
    setPts(l, pts.length ? pts : [V3(0, 0, -1), V3(0, 0, -1)]);
  };
  gridAt(mk('#d8ccb6', 0.8), I2, -0.02);
  F.grid = mk('#7fb2e5', 0.9); F.grid.visible = false;
  F.setM = (M) => { F.M = M.map((r) => r.slice()); F.grid.visible = true; gridAt(F.grid, M, -0.01); };
  rod('#8a7b66', 0.018).setW(F.w([-ext, 0], 0), F.w([ext, 0], 0));
  rod('#8a7b66', 0.018).setW(F.w([0, -ext], 0), F.w([0, ext], 0));
  F.arrow = (v, color, t, cls, from = [0, 0]) => { const a = arw(color); if (t) a.tag(t, cls); F.set(a, v, from); return a; };
  F.set = (a, v, from = [0, 0]) => { a.v = v.slice(); a.setW(F.w(from, 0.06), F.w(addv(from, v), 0.06)); };
  F.line = (v, color, r = 0.025) => { const m = rod(color, r); const e = clip(scl(v, -100 / norm(v)), scl(v, 100 / norm(v)), ext); m.setW(F.w(e[0], 0.02), F.w(e[1], 0.02)); return m; };
  F.dot = (p, color, r = 0.1) => { const b = dotBall(color, r); b.position.copy(F.w(p, 0.08)); return b; };
  F.lab = (t, p, cls = 'idx') => { const q = F.w(p, 0.2); return tag(t, cls, q.x, q.y, q.z); };
  return F;
}
const isPar = (x, y) => Math.abs(x[0] * y[1] - x[1] * y[0]) < 0.03 * Math.max(1e-9, norm(x) * norm(y));
// x 繞一圈：Ax 跟 x 共線時兩支都發金光
async function sweep(tok, F, M, ax, aAx, a0, a1, ms, len = 1.6, k = 1) {
  await anim(tok, ms, (u) => {
    const a = a0 + (a1 - a0) * u, x = [len * Math.cos(a), len * Math.sin(a)], y = mulMV(M, x);
    F.set(ax, x); F.set(aAx, scl(y, k)); const par = isPar(x, y); ax.glow(par ? GOLD : null); aAx.glow(par ? GOLD : null);
  });
}
async function moveTo(tok, F, a, v, ms = 700) { const v0 = a.v.slice(); await anim(tok, ms, (u) => F.set(a, addv(v0, scl(addv(v, scl(v0, -1)), u)))); }

// ═════════════════════════ MIT 18.06 L21（cdZnhQjJu4I／lXNXrLcoerU）Eigenvalues and Eigenvectors ═════════════════════════
// L21-1：什麼是特徵向量
{
  const A = [[2, 1], [1, 2]];
  scene('l21-what', 'L21：Ax 跟 x 同方向 → 特徵向量', [
    async (tok, S) => { cap('第一講：特徵值與特徵向量', '方陣的特殊數字 λ、特殊向量 x'); S.F = plane2(); S.t0 = row(hd, '特徵值 eigenvalue λ　特徵向量 eigenvector x', 0); },
    async (tok, S) => { cap('矩陣在做什麼？作用在向量上', '示意：A = [2 1; 1 2]'); S.m = row(sm, '示意 A = ' + mstr(A), 1); S.x0 = [1.8, 0.3]; S.ax = S.F.arrow(S.x0, COL.a, 'x'); },
    async (tok, S) => { const y = mulMV(A, S.x0); cap('放進 x，出來 Ax', 'Ax = ' + vstr(y)); S.aAx = S.F.arrow(y, COL.b, 'Ax'); S.r2 = row(pl, 'x = ' + vstr(S.x0) + ' → Ax = ' + vstr(y), 2); },
    async (tok, S) => { cap('就像函數：進去 x，出來 f(x)', '只是現在進出的都是向量'); S.f1 = row(sm, '微積分：數字 x → f(x)', 3); S.f2 = row(sm, '線代：向量 x → 向量 Ax', 4); },
    async (tok, S) => {
      cap('特別想找：出來跟進去同方向的向量', '大部分向量不會這樣');
      const a0 = Math.atan2(S.x0[1], S.x0[0]); await sweep(tok, S.F, A, S.ax, S.aAx, a0, a0 + 0.45, 1500, norm(S.x0));
      S.aAx.glow(RED); ln(S.r2); S.r2 = row(bad, '一般的 x：Ax 轉到別的方向', 2);
    },
    async (tok, S) => {
      cap('少數向量：Ax 跟 x 平行', '它們就是特徵向量');
      const a0 = Math.atan2(S.x0[1], S.x0[0]) + 0.45; await sweep(tok, S.F, A, S.ax, S.aAx, a0, Math.PI / 4, 1200, 1.2);
      S.F.line([1, 1], COL.d); const x = [1, 1], y = mulMV(A, x);
      ln(S.r2); ln(S.f1); ln(S.f2); S.r2 = ok(nearV(y, scl(x, 3)), 'x = (1, 1) 方向：Ax = (3, 3) = 3x ✓', 2);
    },
    async (tok, S) => { cap('用方程式寫：Ax = λx', 'λ（lambda）= 伸縮的倍數'); S.r3 = row(hot, 'Ax = λx', 3); },
    async (tok, S) => {
      cap('同方向也包含反方向', 'λ 可以是負的，也可以是 0');
      const x = [1, -1], y = mulMV(A, x); S.F.line(x, COL.r); S.F.arrow(scl(x, 1.3), COL.r, 'x₂'); S.r4 = ok(nearV(y, x), '(1, −1) 方向：Ax = 1·x ✓（λ = 1）', 4);
    },
    async (tok, S) => { cap('λ 是那個倍數', '6、−6、0，甚至虛數都可以'); S.r5 = row(sm, 'λ 可以是 6、−6、0、甚至虛數', 5); },
    async (tok, S) => { cap('λ = 0 的特徵向量是誰？', 'Ax = 0x = 0'); S.r6 = row(pl, 'λ = 0：Ax = 0 → x 在 null space', 6); },
    async (tok, S) => {
      cap('A 是 singular → λ = 0 一定是特徵值', '有非零的 x 被送到 0');
      const B = [[1, 2], [2, 4]], x = [2, -1]; S.r7 = ok(det2(B) === 0 && nearV(mulMV(B, x), [0, 0]), '示意 [1 2; 2 4]：x = (2, −1)，Ax = 0 ✓', 7);
    },
    async (tok, S) => {
      cap('怎麼找 x 和 λ？', '不是 Ax = b，不能直接消去');
      [S.r4, S.r5, S.r6, S.r7].forEach(ln); row(hot, 'λ 和 x 都未知，還乘在一起', 4); row(sm, '→ 需要新方法（行列式）', 5);
    },
  ]);
}
// L21-2：投影矩陣
{
  const n = [-0.3, -0.2, 1], nn = dot(n, n);
  const Pm = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) - n[i] * n[j] / nn));
  const u1 = [1, 0, 0.3], u2 = [0, 1, 0.2], b = [1.0, -0.6, 1.7], x = [1.4, 0.5, 0.52];
  const X3 = 3.4, R3c = (k) => 5.7 - k * 0.7, r = (f, t, k) => f(t, X3, R3c(k));
  scene('l21-proj', 'L21：投影矩陣 P 的特徵值 1 和 0', [
    async (tok, S) => { cap('先看幾個「知道在做什麼」的矩陣', '還不用行列式、公式'); S.sp = space3(-2.8, 2.2, 0, 1, 2.2); },
    async (tok, S) => { cap('投影矩陣 P：投影到一個平面', '（3 維空間裡的一個平面，示意）'); S.pl = S.sp.plane(u1, u2, COL.a, 0.2); r(hd, '投影矩陣 P：投影到平面上', 0); },
    async (tok, S) => { cap('P 的特徵值、特徵向量是什麼？', ''); S.q = r(hot, 'P 的 λ、x = ？', 1); },
    async (tok, S) => {
      const Pb = mulMV(Pm, b); cap('拿一個向量 b，投影成 Pb', '');
      S.ab = S.sp.arrow(b, COL.k, 'b'); S.aPb = S.sp.arrow(Pb, COL.b, 'Pb'); rod('#9a8a70', 0.015).setW(S.sp.w(b), S.sp.w(Pb));
      r(pl, 'b 投影到平面：Pb', 2);
    },
    async (tok, S) => { const Pb = mulMV(Pm, b); cap('b 是特徵向量嗎？不是', 'Pb 跟 b 方向不同'); r(ok, norm(cross(b, Pb)) > 0.1, 'Pb 跟 b 不平行 ✓ → b 不是特徵向量', 3); S.ab.glow(RED); },
    async (tok, S) => { cap('哪些向量投影後方向不變？', ''); },
    async (tok, S) => { cap('本來就在平面上的向量！', ''); S.ax = S.sp.arrow(x, COL.d, 'x'); r(pl, 'x 本來就在平面上', 4); },
    async (tok, S) => { cap('投影它：還是它自己，不動', 'Px = x'); r(ok, nearV(mulMV(Pm, x), x), 'Px = ' + vstr(mulMV(Pm, x).map(r3)) + ' = x ✓', 5); S.ax.glow(GOLD); },
    async (tok, S) => {
      cap('所以 x 是特徵向量，λ = 1', '平面上每個向量都是');
      [[1.5, -1, 0], [-1, 1.2, 0]].forEach(([p, q]) => { const v = addv(scl(u1, p), scl(u2, q)); S.sp.arrow(v, COL.d).glow(GOLD); });
      r(hot, 'λ = 1：整個平面都是特徵向量', 6);
    },
    async (tok, S) => { cap('還有別的嗎？3 維希望有 3 個獨立的', '平面上 2 個 + 平面外 1 個'); },
    async (tok, S) => { cap('好的那個：垂直平面的向量', ''); S.an = S.sp.arrow(scl(n, 1.5 / Math.sqrt(nn)), COL.r, 'n'); },
    async (tok, S) => { const Pn = mulMV(Pm, n); cap('垂直的向量投影 → 0', 'Pn = 0 = 0·n'); r(ok, nearV(Pn, [0, 0, 0]), 'Pn = 0 ✓ → λ = 0（null space）', 7); },
    async (tok, S) => {
      cap('投影矩陣的特徵值：1 和 0', '');
      remove(S.q); const Mx = [0, 1, 2].map((i) => [u1[i], u2[i], n[i]]);
      r(ok, Math.abs(det3(Mx)) > 1e-6, 'λ = 1、1、0：u₁、u₂、n 三個獨立 ✓', 1);
    },
    async (tok, S) => { cap('P = A(AᵀA)⁻¹Aᵀ 可以算', '但看圖就知道特徵向量'); },
  ], { cam: [[-1.2, 5.6, 11.5], [0.4, 2.6, 0]] });
}
// L21-3：permutation 與 trace
{
  const A = [[0, 1], [1, 0]];
  scene('l21-perm', 'L21：Permutation [0 1; 1 0]：λ = 1、−1；和 = trace', [
    async (tok, S) => { cap('第二個例子：permutation matrix', 'A = [0 1; 1 0]'); S.F = plane2(); mlab('A', A, 0); },
    async (tok, S) => {
      cap('A 把 x₁、x₂ 交換', ''); S.F.line([1, 1], '#cbbfa8', 0.012);
      S.x = [2.4, 0.8]; S.ax = S.F.arrow(S.x, COL.a, 'x'); S.aAx = S.F.arrow(mulMV(A, S.x), COL.b, 'Ax');
      row(pl, '(x₁, x₂) → (x₂, x₁)：對 y = x 鏡射', 1);
    },
    async (tok, S) => { cap('哪個向量的 λ = 1？', '交換之後不變'); },
    async (tok, S) => {
      const x = [1.6, 1.6]; cap('(1, 1)！交換後還是自己', 'Ax = x，λ = 1');
      await anim(tok, 900, (u) => { const v = addv(S.x, scl(addv(x, scl(S.x, -1)), u)); S.F.set(S.ax, v); S.F.set(S.aAx, mulMV(A, v)); });
      S.ax.glow(GOLD); S.aAx.glow(GOLD); row(ok, nearV(mulMV(A, [1, 1]), [1, 1]), 'x = (1, 1)：Ax = x ✓ λ = 1', 2);
    },
    async (tok, S) => { cap('2×2 應該還有第二個特徵值', '和第二個特徵向量'); },
    async (tok, S) => { cap('老師先說：另一個 λ = −1', '正數矩陣也會有負的特徵值'); row(hot, '另一個 λ = −1', 3); },
    async (tok, S) => { cap('要 Ax = −x：交換後剛好變號', '送進什麼 x？'); },
    async (tok, S) => {
      const x = [-1, 1]; cap('送進 (−1, 1)', 'Ax = (1, −1) = −x'); S.F.line(x, COL.r);
      S.F.arrow(scl(x, 1.6), COL.a, 'x₂').glow(GOLD); S.F.arrow(scl(mulMV(A, x), 1.6), COL.b, 'Ax₂').glow(GOLD);
      row(ok, nearV(mulMV(A, x), scl(x, -1)), 'x = (−1, 1)：Ax = −x ✓ λ = −1', 4);
    },
    async (tok, S) => { cap('n×n 矩陣有 n 個特徵值', 'n 大時要解 n 次方程式，不好找'); row(sm, 'n×n → n 個特徵值', 5); },
    async (tok, S) => { cap('好消息：特徵值的和 = 對角線的和', '對角線的和叫 trace'); row(hot, 'λ₁ + … + λₙ = a₁₁ + … + aₙₙ（trace）', 6); },
    async (tok, S) => { cap('這個例子：trace = 0', '1 + (−1) = 0'); row(ok, 1 + -1 === trM(A), '1 + (−1) = 0 = 0 + 0 ✓', 7); },
    async (tok, S) => { cap('2×2：知道一個 λ，trace 給出另一個', '找到 1 → 另一個一定是 −1'); },
  ]);
}
// L21-4：det(A − λI) = 0
{
  const A = [[0, 1], [1, 0]];
  scene('l21-chareq', 'L21：特徵方程式 det(A − λI) = 0', [
    async (tok, S) => { cap('面對方程式 Ax = λx', '怎麼同時找 x 和 λ？'); S.F = plane2(); row(hd, 'Ax = λx', 0); },
    async (tok, S) => { cap('移到同一邊', 'Ax − λx = (A − λI)x = 0'); row(hot, '(A − λI)x = 0', 1); },
    async (tok, S) => { cap('x 不能是零向量', '零向量當特徵向量沒有意義'); S.x0 = row(pl, 'x ≠ 0', 2); },
    async (tok, S) => { cap('A − λI 必須是 singular', '否則唯一的解是 x = 0'); row(pl, 'A − λI 把某個方向壓成 0 → singular', 3); S.F.setM(A); S.lb = row(sm, '示意 A = [0 1; 1 0]，λ = 0：det = −1', 7); },
    async (tok, S) => {
      cap('singular ⇔ 行列式 = 0', 'det(A − λI) = 0'); row(hot, 'det(A − λI) = 0', 4);
      await anim(tok, 2200, (u) => { const N = addM(A, I2, -u); S.F.setM(N); txt(S.lb, '示意 λ = ' + u.toFixed(2) + '：det(A − λI) = ' + det2(N).toFixed(2)); });
      ln(S.lb); S.lb = row(ok, near(det2(addM(A, I2, -1)), 0), '示意：λ = 1 時 det = 0，平面壓成一條線 ✓', 7);
    },
    async (tok, S) => { cap('x 消失了：只剩 λ 的方程式', '特徵方程式 characteristic equation'); row(pl, 'characteristic equation：只含 λ', 5); },
    async (tok, S) => { cap('先求 λ：會有 n 個', '但不一定都不同'); row(sm, 'n×n → n 次方程式 → n 個 λ', 6); },
    async (tok, S) => { cap('重根：18.06 所有麻煩的來源', '先希望沒有重根'); S.nt = note('重根 → 麻煩', 5.6, R(1)); },
    async (tok, S) => { cap('有了 λ，再用消去法找 x', '找 A − λI 的 null space'); ln(S.x0); S.x0 = row(pl, 'x ≠ 0，x 在 A − λI 的 null space', 2); },
    async (tok, S) => {
      const N = addM(A, I2, -1), x = [1, 1]; cap('通常 1 個自由變數，設成 1', '例：λ = 1，A − I = [−1 1; 1 −1] → x = (1, 1)');
      ln(S.lb); row(ok, nearV(mulMV(N, x), [0, 0]), '例：(A − I)(1, 1) = 0 ✓ → x = (1, 1)', 7); S.F.line([1, 1], COL.d);
    },
  ]);
}
// L21-5：[3 1; 1 3]
{
  const A = [[3, 1], [1, 3]];
  scene('l21-ex', 'L21：例子 [3 1; 1 3]：λ = 4、2', [
    async (tok, S) => { cap('再做一個例子', '這次完整算一遍'); S.F = plane2(); },
    async (tok, S) => { cap('A = [3 1; 1 3]', ''); mlab('A', A, 0); S.n0 = mark(); },
    async (tok, S) => { cap('2×2、對稱、對角線是常數', '特別的矩陣 → 特別的特徵值'); row(sm, '2×2、對稱、對角線都是 3', 1); },
    async (tok, S) => { cap('對稱矩陣：特徵值一定是實數', ''); row(pl, '對稱 → λ 是實數', 2); },
    async (tok, S) => { cap('上一個例子也對稱', 'λ = 1、−1，都是實數'); row(pl, '[0 1; 1 0] 也對稱：λ = 1、−1', 3); },
    async (tok, S) => {
      cap('它的特徵向量 (1, 1)、(−1, 1)', '互相垂直：內積 = 0'); S.F.line([1, 1], COL.d); S.F.line([-1, 1], COL.r);
      row(ok, dot([1, 1], [-1, 1]) === 0, '(1, 1)·(−1, 1) = 0：垂直 ✓', 4);
    },
    async (tok, S) => { wipe(S.n0); cap('算 det(A − λI)', '只從對角線減掉 λ'); mlab('A − λI', [['3−λ', '1'], ['1', '3−λ']], 1); },
    async (tok, S) => { cap('(3 − λ)² − 1', ''); row(hot, 'det = (3 − λ)² − 1', 2); },
    async (tok, S) => { const c = charPoly(A); cap('乘開：λ² − 6λ + 8', ''); row(ok, nearV(c, [1, -6, 8]), '= λ² − 6λ + 8 ✓', 3); },
    async (tok, S) => { cap('6 是什麼？trace：3 + 3', ''); row(ok, trM(A) === 6, '6 = 3 + 3 = trace ✓', 4); },
    async (tok, S) => { cap('8 是什麼？行列式', '3·3 − 1·1 = 8'); row(ok, det2(A) === 8, '8 = det A = 9 − 1 ✓', 5); },
    async (tok, S) => { cap('2×2 一定是這個樣子', 'λ² − (trace)λ + det'); row(hot, '2×2：λ² − (trace)λ + det = 0', 6); },
    async (tok, S) => {
      const rs = roots(charPoly(A)).map((z) => z[0]).sort((a, b) => b - a); cap('因式分解：(λ − 4)(λ − 2)', '特徵值 4 和 2');
      row(ok, nearV(rs, [4, 2]), '(λ − 4)(λ − 2) = 0 → λ₁ = 4、λ₂ = 2 ✓', 7);
    },
    async (tok, S) => { wipe(S.n0); cap('再找特徵向量', '各自去找 null space'); row(hot, 'λ₁ = 4、λ₂ = 2', 1); },
    async (tok, S) => { cap('A − 4I：對角線減 4', ''); mlab('A − 4I', addM(A, I2, -4), 2); },
    async (tok, S) => { cap('4 是特徵值 → A − 4I 必須 singular', '不 singular 就表示算錯了'); row(ok, det2(addM(A, I2, -4)) === 0, 'det(A − 4I) = 0：singular ✓', 3); },
    async (tok, S) => {
      const x = [1, 1], y = mulMV(A, x); cap('null space 裡：x₁ = (1, 1)', 'Ax₁ = 4x₁');
      S.F.line(x, COL.d); S.F.arrow(scl(x, 0.9), COL.a, 'x₁'); S.F.arrow(scl(y, 0.9), COL.b, 'Ax₁').glow(GOLD);
      row(ok, nearV(y, scl(x, 4)), 'x₁ = (1, 1)：Ax₁ = (4, 4) = 4x₁ ✓', 4);
    },
    async (tok, S) => { const N = addM(A, I2, -2); cap('A − 2I = [1 1; 1 1]', '也是 singular'); row(ok, det2(N) === 0, 'A − 2I = ' + mstr(N) + '，det = 0 ✓', 5); },
    async (tok, S) => { cap('null space 是一整條線', '取一個代表當基底就好'); S.F.line([-1, 1], COL.r, 0.04); row(pl, 'null space = 一條線 → 取一個代表', 6); },
    async (tok, S) => {
      const x = [-1, 1], y = mulMV(A, x); cap('自然的選擇：x₂ = (−1, 1)', 'Ax₂ = 2x₂');
      S.F.arrow(scl(x, 1.4), COL.a, 'x₂'); S.F.arrow(scl(y, 1.4), COL.b, 'Ax₂').glow(GOLD);
      row(ok, nearV(y, scl(x, 2)), 'x₂ = (−1, 1)：Ax₂ = (−2, 2) = 2x₂ ✓', 7);
    },
  ]);
}
// L21-6：加 3I
{
  const A0 = [[0, 1], [1, 0]], A = [[3, 1], [1, 3]];
  const ev = (M) => eigInfo(M).groups.map(lstr).join('、');
  scene('l21-shift', 'L21：A + 3I：特徵值加 3、特徵向量不變；A + B 不行', [
    async (tok, S) => {
      cap('兩個例子有什麼關係？', ''); S.F = plane2(); S.F.line([1, 1], COL.d); S.F.line([-1, 1], COL.r);
      S.n0 = mark(); row(pl, '[0 1; 1 0]：λ = ' + ev(A0), 0); row(pl, '[3 1; 1 3]：λ = ' + ev(A), 1);
    },
    async (tok, S) => { cap('一個剛好比另一個多 3I', '[3 1; 1 3] = [0 1; 1 0] + 3I'); row(ok, nearM(A, addM(A0, I2, 3)), 'A = A₀ + 3I ✓', 2); },
    async (tok, S) => { cap('特徵值、特徵向量怎麼變？', '這章一直會問的問題'); },
    async (tok, S) => {
      cap('特徵值各加 3', '1 + 3 = 4、−1 + 3 = 2'); const x = [1, 1];
      S.F.arrow(scl(mulMV(A0, x), 0.9), COL.a, 'A₀x'); S.F.arrow(scl(mulMV(A, x), 0.9), COL.b, 'Ax');
      row(ok, nearV(mulMV(A, x), scl(x, 1 + 3)), '特徵值 +3：1 → 4、−1 → 2 ✓', 3);
    },
    async (tok, S) => { cap('特徵向量完全不變', '(1, 1)、(−1, 1) 還是特徵向量'); const x = [-1, 1]; row(ok, nearV(mulMV(A0, x), scl(x, -1)) && nearV(mulMV(A, x), scl(x, 2)), '特徵向量不變：(1, 1)、(−1, 1) ✓', 4); },
    async (tok, S) => { wipe(S.n0); cap('為什麼？若 Ax = λx', '再加上 3I'); row(hd, '若 Ax = λx', 0); },
    async (tok, S) => { cap('(A + 3I)x = λx + 3x', '= (λ + 3)x，同一個 x'); row(hot, '(A + 3I)x = λx + 3x = (λ + 3)x', 1); },
    async (tok, S) => { cap('如果加的是別的矩陣 B 呢？', ''); row(pl, 'A + B 的特徵值 = ？', 2); },
    async (tok, S) => { cap('B 的特徵值叫 α', ''); row(pl, 'Bx = αx？', 3); },
    async (tok, S) => { cap('你可能會想：直接相加', '(A + B)x = (λ + α)x'); row(pl, '想法：(A + B)x = (λ + α)x', 4); },
    async (tok, S) => { cap('這是錯的！', ''); row(bad, '這個推論是錯的 ✘', 5); },
    async (tok, S) => { cap('x 不一定也是 B 的特徵向量', 'B 的特徵向量通常不一樣'); row(pl, 'A 和 B 的特徵向量通常不同', 6); },
    async (tok, S) => {
      cap('A + B、AB 的特徵值都不能直接加或乘', '示意反例');
      const a = [[0, 1], [0, 0]], b = [[0, 0], [1, 0]], e = eigInfo(addM(a, b)).groups.map((g) => g.re);
      row(ok, nearV(e, [1, -1]) && nearV(charPoly(a), [1, 0, 0]) && nearV(charPoly(b), [1, 0, 0]), '示意 [0 1; 0 0] + [0 0; 1 0]：0 + 0 → ±1 ✓', 7);
    },
    async (tok, S) => { cap('只有 B = cI 時能直接加', '一般的 B：A + B 要重新解'); note('B 是 I 的倍數才行', 5.6, R(5)); },
  ]);
}
// L21-7：旋轉 → 複數特徵值
{
  const Q = [[0, -1], [1, 0]];
  scene('l21-rot', 'L21：旋轉 90°：λ = ±i（複數）', [
    async (tok, S) => { cap('再一個例子：旋轉矩陣', ''); S.F = plane2(); S.vs = [[3, 0], [0, 3], [2, 2], [-2, 1.2]].map((v) => [v, S.F.arrow(v, COL.k)]); },
    async (tok, S) => { cap('叫它 Q：orthogonal matrix', '旋轉是最重要的正交矩陣'); row(pl, 'Q：orthogonal（旋轉）', 0); },
    async (tok, S) => {
      cap('轉 90°：[cos −sin; sin cos]', 'cos 90° = 0、sin 90° = 1'); mlab('Q', Q, 1);
      await anim(tok, 2000, (u) => { const N = rot2(u * Math.PI / 2); S.F.setM(N); S.vs.forEach(([v, a]) => S.F.set(a, mulMV(N, v))); });
    },
    async (tok, S) => { cap('兩個特徵值加起來 = trace = 0', ''); row(pl, 'λ₁ + λ₂ = trace = 0 + 0 = 0', 2); },
    async (tok, S) => { cap('乘起來 = 行列式 = 1', 'det = λ₁λ₂'); row(pl, 'λ₁λ₂ = det Q = ' + fmt(det2(Q)), 3); },
    async (tok, S) => { cap('上一題：4 × 2 = 8 = det', ''); row(ok, 4 * 2 === det2([[3, 1], [1, 3]]), '[3 1; 1 3]：4 × 2 = 8 = det ✓', 4); },
    async (tok, S) => {
      cap('轉 90° 後，誰還跟自己平行？', '每個向量都被轉走');
      S.vs.forEach(([, a]) => kill(a)); S.F.setM(I2); S.ax = S.F.arrow([2, 0], COL.a, 'x'); S.aQx = S.F.arrow([0, 2], COL.b, 'Qx');
      await sweep(tok, S.F, Q, S.ax, S.aQx, 0, Math.PI, 2400, 2); S.aQx.glow(RED);
    },
    async (tok, S) => { cap('和 = 0 要一正一負，積卻是 +1', '實數做不到 → 麻煩'); S.nt = note('和 0、積 +1？', 5.6, R(2)); },
    async (tok, S) => { [S.nt].forEach(ln); cap('照規矩算 det(Q − λI)', 'λ² + 1 = 0'); row(ok, nearV(charPoly(Q), [1, 0, 1]), 'det(Q − λI) = λ² + 1 ✓', 5); },
    async (tok, S) => { cap('λ = i、λ = −i', ''); row(hot, 'λ₁ = i、λ₂ = −i', 6); },
    async (tok, S) => {
      const s = [0 + 0, 1 + -1], p = cmul([0, 1], [0, -1]); cap('和 0 = trace、積 1 = det', '都對得上');
      row(ok, s[1] === 0 && nearV(p, [1, 0]), 'i + (−i) = 0 ✓　i·(−i) = 1 ✓', 7);
    },
    async (tok, S) => { cap('實數矩陣也可能有複數特徵值', '18.06 從這裡開始要用複數'); },
    async (tok, S) => { cap('它們互為共軛複數', 'a + bi ↔ a − bi：虛部變號'); S.c = note('共軛：i ↔ −i', 5.6, R(6)); },
    async (tok, S) => { cap('對稱 → 實數；Q 是反對稱', 'Qᵀ = −Q → 純虛數'); ln(S.c); row(ok, nearM(T(Q), sclM(Q, -1)), 'Qᵀ = −Q（反對稱）✓ → 純虛數', 2); },
    async (tok, S) => { cap('中間的矩陣：對稱部分 + 反對稱部分', ''); row(sm, '對稱 → 實數；反對稱 → 純虛數', 3); },
    async (tok, S) => { cap('好：實數 λ、垂直的特徵向量', '壞：複數 λ'); },
  ]);
}
// L21-8：三角矩陣、重根、缺特徵向量
{
  const A = [[3, 1], [0, 3]];
  scene('l21-tri', 'L21：[3 1; 0 3]：重根、只有一個特徵向量', [
    async (tok, S) => { cap('還有一種更糟的情況', ''); S.F = plane2(); },
    async (tok, S) => { cap('把 [3 1; 1 3] 左下改成 0', 'A = [3 1; 0 3]'); mlab('A', A, 0); S.r1 = row(sm, '[3 1; 1 3] 的左下 1 改成 0', 1); },
    async (tok, S) => { cap('三角矩陣：特徵值就在對角線上', '一眼就看出來'); S.r2 = row(pl, '三角矩陣：λ 在對角線上', 2); },
    async (tok, S) => { cap('λ = 3 和 3：重根', ''); row(hot, 'λ₁ = 3、λ₂ = 3（重根）', 3); },
    async (tok, S) => { cap('算一次：(3 − λ)(3 − λ)', ''); row(ok, nearV(charPoly(A), [1, -6, 9]), 'det(A − λI) = (3 − λ)(3 − λ) ✓', 4); },
    async (tok, S) => { cap('三角矩陣的 det = 對角線相乘', ''); S.r5 = row(sm, '三角：det = 對角線相乘', 5); },
    async (tok, S) => { cap('問題出在特徵向量', ''); },
    async (tok, S) => { cap('解 (A − 3I)x = 0', ''); mlab('A − 3I', addM(A, I2, -3), 6); },
    async (tok, S) => { cap('應該是 singular：是的', ''); row(ok, det2(addM(A, I2, -3)) === 0, 'det(A − 3I) = 0：singular ✓', 7); },
    async (tok, S) => {
      const x = [1, 0]; cap('null space：x₁ = (1, 0)', 'Ax₁ = 3x₁'); S.F.line(x, COL.d);
      S.F.arrow([1.4, 0], COL.a, 'x₁'); S.F.arrow(scl(mulMV(A, [1.4, 0]), 1), COL.b, 'Ax₁').glow(GOLD);
      ln(S.r5); S.r5 = row(ok, nearV(mulMV(A, x), [3, 0]), 'x₁ = (1, 0)：Ax₁ = 3x₁ ✓', 5);
    },
    async (tok, S) => {
      cap('λ₂ = 3 也要一個獨立的特徵向量', '掃一圈找找看');
      S.ax = S.F.arrow([1.5, 0], COL.a, 'x'); S.aAx = S.F.arrow([4.5, 0], COL.b, 'Ax').tag('Ax（×½）');
      await sweep(tok, S.F, A, S.ax, S.aAx, 0, 2 * Math.PI, 2500, 1.5, 0.5);
    },
    async (tok, S) => {
      cap('沒有！退化（degenerate）矩陣', '只有一條特徵向量的線'); const E = eigInfo(A);
      ln(S.r1); S.r1 = row(ok, E.groups.length === 1 && E.groups[0].am === 2 && E.groups[0].gm === 1, 'null space 只有 1 維 ✓ → 沒有 x₂', 1);
    },
    async (tok, S) => { cap('重根 → 可能缺特徵向量', ''); ln(S.r2); S.r2 = note('重根 → 可能缺特徵向量', X0, R(2)); },
    async (tok, S) => { cap('2×2 卻只有 1 個獨立特徵向量', '下一講處理其他矩陣的完整故事'); },
  ]);
}

// ═════════════════════════ MIT 18.06 L22（13r9QY6cmjc）Diagonalization and Powers of A ═════════════════════════
// L22-1：AS = SΛ → A = SΛS⁻¹（示意 A = [2 1; 1 2]）
{
  const A = [[2, 1], [1, 2]], Sm = [[1, 1], [1, -1]], L = diagM([3, 1]);
  const ctr = (t, y, f = pl) => f(t, 0, y);
  scene('l22-diag', 'L22：AS = SΛ → A = SΛS⁻¹（一次一行）', [
    async (tok, S) => { cap('第二講：怎麼用 Ax = λx', 'x = 特徵向量、λ = 特徵值'); ctr('上一講：Ax = λx', 6.3, hd); },
    async (tok, S) => { cap('第一步永遠是：找出 λ 和 x', '找到之後呢？'); },
    async (tok, S) => { cap('好方法：把矩陣對角化', 'diagonalize'); ctr('目標：對角化（diagonalize）', 3.2, hot); },
    async (tok, S) => {
      cap('特徵向量放進 S 的每一行', '示意 A = [2 1; 1 2]：x₁ = (1, 1)、x₂ = (1, −1)');
      S.gA = mgrid(A, -6.4, 5.2, 0, { color: () => COL.a }); tag('A', 'ptr', -6, 5.9);
      S.gS = mgrid(Sm, -4.4, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('S', 'ptr', -4, 5.9);
    },
    async (tok, S) => { cap('神奇的組合：S⁻¹AS', ''); S.l1 = ctr('看 S⁻¹AS 會變成什麼', 2.5, sm); },
    async (tok, S) => { cap('要能求 S⁻¹：需要 n 個獨立特徵向量', ''); S.l2 = ctr('S 可逆 ⇔ n 個獨立特徵向量', 1.8, pl); },
    async (tok, S) => {
      cap('先算 A 乘 S', ''); [S.l1, S.l2].forEach(ln);
      tag('=', 'val', -2.5, 4.8); S.R = mgrid([['', ''], ['', '']], -1.8, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('AS', 'ptr', -1.4, 5.9);
    },
    async (tok, S) => {
      const y = mulMV(A, [1, 1]); cap('一次算一行：A 乘第 1 個特徵向量', 'Ax₁ = λ₁x₁');
      S.gS.col(0, GOLD); y.forEach((v, i) => S.R.set(i, 0, v)); S.R.col(0, GOLD);
      S.c1 = ok(nearV(y, scl([1, 1], 3)), 'Ax₁ = (3, 3) = 3·x₁ ✓', -1.2, 2.5);
    },
    async (tok, S) => {
      const y = mulMV(A, [1, -1]); cap('第 2 行、…、第 n 行都一樣', 'Ax₂ = λ₂x₂'); S.gS.clearGlow(); S.R.clearGlow();
      S.gS.col(1, GOLD); y.forEach((v, i) => S.R.set(i, 1, v)); S.R.col(1, GOLD);
      S.c2 = ok(nearV(y, scl([1, -1], 1)), 'Ax₂ = (1, −1) = 1·x₂ ✓', -1.2, 1.8);
    },
    async (tok, S) => { S.gS.clearGlow(); S.R.clearGlow(); cap('下一步：把 λ 從 x 分開', 'AS = [λ₁x₁ λ₂x₂]'); },
    async (tok, S) => {
      cap('λ₁ 乘第一行 → 放到右邊的對角矩陣', '第一個位置 λ₁，其他是 0');
      tag('=', 'val', 0.2, 4.8); mgrid(Sm, 0.9, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('S', 'ptr', 1.3, 5.9);
      S.gL = mgrid(L, 2.9, 5.2, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); tag('Λ', 'ptr alt', 3.3, 5.9);
    },
    async (tok, S) => { [S.c1, S.c2].forEach(ln); cap('矩陣乘法幫我們做好了', 'AS = SΛ'); S.e1 = ok(nearM(mm(A, Sm), mm(Sm, L)), 'AS = SΛ ✓', 4.9, 4.8); },
    async (tok, S) => { cap('Λ：特徵值矩陣，對角線是 λ', '大寫 lambda'); S.gL.c.forEach((r, i) => glow(r[i], GOLD)); ctr('Λ = diag(λ₁, …, λₙ)：特徵值矩陣', 2.5, pl); },
    async (tok, S) => { S.gL.clearGlow(); cap('n 個獨立特徵向量 → S 可逆', ''); ctr('det S = ' + fmt(det2(Sm)) + ' ≠ 0 → S 可逆', 1.8, (t, x, y) => ok(det2(Sm) !== 0, t + ' ✓', x, y)); },
    async (tok, S) => { cap('左邊乘 S⁻¹', 'S⁻¹AS = Λ'); ctr('S⁻¹AS = Λ', 1.1, (t, x, y) => ok(nearM(mm(inv2(Sm), mm(A, Sm)), L), t + ' ✓', x, y)); },
    async (tok, S) => { cap('少數矩陣沒有 n 個獨立特徵向量', '那種不能對角化（之後討論）'); },
    async (tok, S) => { cap('右邊乘 S⁻¹', 'A = SΛS⁻¹'); S.f = ctr('A = SΛS⁻¹', 0.4, (t, x, y) => ok(nearM(mm(Sm, mm(L, inv2(Sm))), A), t + ' ✓', x, y)); },
    async (tok, S) => { cap('記法：A 乘的是它的特徵向量', '所以 S 緊貼在 A 的右邊：AS'); note('A 乘 S（特徵向量）', 4.9, 3.7); },
    async (tok, S) => { cap('新的分解：取代 LU、QR', 'S·Λ·S⁻¹ 這個組合會一直出現'); hot('A = LU、QR → 現在 SΛS⁻¹', 4.6, 2.5); },
  ]);
}
// L22-2：A²、Aᵏ（示意 A = [1 0.5; 0.5 1]，λ = 1.5、0.5）
{
  const A = [[1, 0.5], [0.5, 1]], Sm = [[1, 1], [1, -1]], L = diagM([1.5, 0.5]), Si = inv2(Sm);
  scene('l22-powers', 'L22：A² = SΛ²S⁻¹、Aᵏ = SΛᵏS⁻¹', [
    async (tok, S) => { cap('A² 的特徵值、特徵向量是什麼？', '示意 A = [1 0.5; 0.5 1]'); S.F = plane2(); S.F.line([1, 1], COL.d); S.F.line([1, -1], COL.r); row(sm, '示意 A = [1 0.5; 0.5 1]', 0); },
    async (tok, S) => { cap('從 Ax = λx 開始，兩邊再乘 A', ''); row(hd, 'Ax = λx → 兩邊乘 A', 1); },
    async (tok, S) => { cap('A²x = λAx = λ²x', ''); row(hot, 'A²x = λ(Ax) = λ²x', 2); },
    async (tok, S) => {
      cap('特徵值平方、特徵向量不變', ''); const x = [1.4, 1.4];
      S.F.arrow(x, COL.a, 'x₁'); S.a = S.F.arrow(mulMV(A, x), COL.b, 'Ax₁'); S.b = S.F.arrow(mulMV(mm(A, A), x), COL.g, 'A²x₁');
      row(ok, nearV(mulMV(mm(A, A), x), scl(x, 1.5 * 1.5)), 'x₁ = (1, 1)：A²x₁ = 1.5²x₁ = 2.25x₁ ✓', 3);
    },
    async (tok, S) => { cap('用公式再看一次', 'A² = SΛS⁻¹ · SΛS⁻¹'); row(pl, 'A² = SΛS⁻¹SΛS⁻¹', 4); },
    async (tok, S) => { cap('中間 S⁻¹S = I，消掉', 'A² = SΛ²S⁻¹'); row(ok, nearM(mm(A, A), mm(Sm, mm(mm(L, L), Si))), 'S⁻¹S = I → A² = SΛ²S⁻¹ ✓', 5); },
    async (tok, S) => { cap('S 一樣（特徵向量一樣）、Λ 平方', 'Λ² = diag(λ₁², …, λₙ²)'); row(pl, 'Λ² = diag(' + fmt(2.25) + ', ' + fmt(0.25) + ')', 6); },
    async (tok, S) => {
      cap('k 次方：S⁻¹S 一直消', 'Aᵏ = SΛᵏS⁻¹'); S.k = row(hot, 'Aᵏ = SΛᵏS⁻¹', 7);
      kill(S.a); kill(S.b); const u0 = [1.2, -0.4]; let u = u0; const au = S.F.arrow(u, COL.k, 'u');
      for (let k = 1; k <= 3; k++) { const v = mulMV(A, u), from = u.slice(); await anim(tok, 600, (t) => S.F.set(au, addv(from, scl(addv(v, scl(from, -1)), t)))); u = v; S.F.dot(u, COL.b, 0.07); }
      au.tag('A³u');
    },
    async (tok, S) => { const k = 3; cap('Aᵏ 的特徵值是 λᵏ，特徵向量不變', 'A³ 的特徵值 = λ³'); ln(S.k); S.k = row(ok, nearM(powM(A, k), mm(Sm, mm(diagM([1.5 ** k, 0.5 ** k]), Si))), 'A³ = S·diag(1.5³, 0.5³)·S⁻¹ ✓', 7); },
    async (tok, S) => { cap('一百個 LU 相乘：看不出什麼', 'pivot 跑得到處都是'); S.lu = note('(LU)(LU)…(LU)：沒用', -3.4, 0.0); },
    async (tok, S) => { cap('SΛS⁻¹ 乘一百次：99 個 S⁻¹S 消掉', 'A¹⁰⁰ = SΛ¹⁰⁰S⁻¹'); ln(S.lu); S.lu = good('A¹⁰⁰ = SΛ¹⁰⁰S⁻¹', -3.4, 0.0); },
    async (tok, S) => { cap('特徵值告訴我們「冪次」的事', '以前沒辦法處理'); },
  ]);
}
// L22-3：Aᵏ → 0 ⇔ 所有 |λ| < 1
{
  const A = [[0.5, 0.4], [0.4, 0.5]], Rt = rot2(Math.PI / 6, 0.9);
  scene('l22-stab', 'L22：Aᵏ → 0 ⇔ 所有 |λ| < 1', [
    async (tok, S) => { cap('Aᵏ 什麼時候趨近 0？', '叫它「穩定」'); S.F = plane2(); row(hd, 'Aᵏ → 0（穩定）的條件？', 0); },
    async (tok, S) => { cap('寫成定理：k 變大時 Aᵏ → 0，如果…', ''); row(pl, '定理：Aᵏ → 0 ⇔ ？', 1); },
    async (tok, S) => {
      const R = rrefSteps(A); const piv = [A[0][0], A[1][1] - A[1][0] / A[0][0] * A[0][1]];
      cap('答案不在 pivot 裡，在特徵值裡', '示意 A = [0.5 0.4; 0.4 0.5]'); void R;
      row(sm, '示意 A：pivot ' + fmt(piv[0]) + '、' + r3(piv[1]) + '；λ = ' + eigInfo(A).groups.map(lstr).join('、'), 2);
    },
    async (tok, S) => { cap('S、S⁻¹ 不動，Λᵏ 要變小', 'Aᵏ = SΛᵏS⁻¹'); row(pl, 'Aᵏ = SΛᵏS⁻¹：只看 Λᵏ', 3); },
    async (tok, S) => {
      cap('條件：所有特徵值小於 1', 'λ = 0.9、0.1 → u 縮向 0'); S.F.line([1, 1], COL.d); S.F.line([1, -1], COL.r);
      let u = [5, -1]; const a = S.F.arrow(u, COL.g, 'u₀');
      for (let k = 1; k <= 6; k++) { const v = mulMV(A, u), f = u.slice(); await anim(tok, 300, (t) => S.F.set(a, addv(f, scl(addv(v, scl(f, -1)), t)))); u = v; S.F.dot(u, COL.g, 0.06); }
      row(ok, norm(mulMV(powM(A, 60), [5, -1])) < 0.01, 'A⁶⁰u₀ ≈ 0 ✓', 4);
    },
    async (tok, S) => {
      cap('要寫絕對值：λ 可能是負數或複數', '示意：複數 λ，|λ| = 0.9 → 轉著縮進去');
      let u = [4.5, 0]; const a = S.F.arrow(u, COL.c, 'u₀');
      for (let k = 1; k <= 8; k++) { const v = mulMV(Rt, u), f = u.slice(); await anim(tok, 260, (t) => S.F.set(a, addv(f, scl(addv(v, scl(f, -1)), t)))); u = v; S.F.dot(u, COL.c, 0.06); }
      const E = eigInfo(Rt); row(ok, E.groups.every((g) => near(Math.hypot(g.re, g.im), 0.9, 1e-6)), '示意：λ = ' + E.groups.map(lstr).join('、') + '，|λ| = 0.9 ✓', 5);
      row(hot, '所有 |λᵢ| < 1', 1);
    },
    async (tok, S) => { cap('前提：有 n 個獨立特徵向量', '這個推論靠 A = SΛS⁻¹'); row(note, '前提：n 個獨立特徵向量', 6); },
    async (tok, S) => { cap('沒有的話不能對角化', 'S⁻¹ 必須存在'); row(sm, '不能對角化 → 這個方法不適用', 7); },
  ]);
}
// L22-4：哪些矩陣可以對角化
{
  const M = [[3, 1], [0, 2]];
  scene('l22-distinct', 'L22：特徵值相異 ⇒ 可對角化；I 的重根', [
    async (tok, S) => { cap('哪些矩陣可以對角化？', 'diagonalizable'); S.F = plane2(); row(hd, '哪些矩陣可以對角化？', 0); },
    async (tok, S) => { cap('好情況：所有 λ 都不一樣', '沒有重根'); row(hot, '所有 λ 相異 ⇒ 可對角化', 1); },
    async (tok, S) => {
      cap('MATLAB：eig(rand(10)) 幾乎都相異', '示意：一個「亂數」3×3');
      const Rm = [[0.8, 0.1, 0.4], [0.3, 0.6, 0.2], [0.5, 0.9, 0.1]], E = eigInfo(Rm);
      row(ok, E.groups.length === 3, '示意 3×3：λ ≈ ' + E.groups.map((g) => lstr({ re: r3(g.re), im: r3(g.im) })).join('、') + '（相異）✓', 2);
    },
    async (tok, S) => {
      const E = eigInfo(M), v = E.groups.map((g) => g.vecs[0]); cap('相異 → 特徵向量自動獨立', '示意 [3 1; 0 2]：λ = 3、2');
      v.forEach((x, i) => { S.F.line(x, [COL.d, COL.r][i]); S.F.arrow(scl(x, 1.8 / norm(x)), [COL.d, COL.r][i], 'λ = ' + lstr(E.groups[i])); });
      row(ok, Math.abs(det2(T(v))) > 1e-9, '示意 [3 1; 0 2]：' + v.map(vstr).join('、') + ' 獨立 ✓', 3);
    },
    async (tok, S) => { cap('有重根：要仔細數', '可能夠，也可能不夠'); row(pl, '有重根 → 要數特徵向量夠不夠', 4); },
    async (tok, S) => {
      wipe(S.F.n0 || 0); S.F = plane2(); cap('單位矩陣 I：λ = 1 重複 10 次', '一點都不糟');
      S.vs = []; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; S.vs.push(S.F.arrow([3 * Math.cos(a), 3 * Math.sin(a)], COL.k)); }
      row(hd, 'I：λ = 1 重複', 0);
    },
    async (tok, S) => { cap('每個向量都是特徵向量', 'Ix = 1·x'); S.vs.forEach((a) => a.glow(GOLD)); row(ok, nearV(mulMV(I2, [0.3, -2]), [0.3, -2]), '每個 x：Ix = x ✓', 1); },
    async (tok, S) => { const Sm = [[2, 1], [1, 3]]; cap('S 隨便選獨立的向量', 'S⁻¹IS = I = Λ'); row(ok, nearM(mm(inv2(Sm), mm(I2, Sm)), I2), '示意 S = [2 1; 1 3]：S⁻¹IS = I ✓', 2); },
    async (tok, S) => { cap('本來就是對角矩陣：特徵值就在對角線上', '三角矩陣也是'); row(pl, '對角、三角：λ 就在對角線上', 3); },
  ]);
}
// L22-5：[2 1; 0 2] 不能對角化
{
  const A = [[2, 1], [0, 2]];
  scene('l22-defect', 'L22：[2 1; 0 2]：代數重數 2、幾何重數 1', [
    async (tok, S) => { cap('A = [2 1; 0 2]', '三角矩陣'); S.F = plane2(); mlab('A', A, 0); },
    async (tok, S) => { cap('這是會出問題的例子', '先求特徵值'); },
    async (tok, S) => { cap('三角：λ = 2 和 2', ''); row(hot, 'λ = 2、2', 1); },
    async (tok, S) => { cap('det(A − λI) = (2 − λ)²', 'λ = 2 兩次'); row(ok, nearV(charPoly(A), [1, -4, 4]), 'det(A − λI) = (2 − λ)² ✓', 2); },
    async (tok, S) => { cap('找特徵向量：A − 2I', ''); mlab('A − 2I', addM(A, I2, -2), 3); },
    async (tok, S) => {
      cap('null space 只有一維', '掃一圈：只有水平方向');
      S.ax = S.F.arrow([1.6, 0], COL.a, 'x'); S.aAx = S.F.arrow([3.2, 0], COL.b, 'Ax');
      await sweep(tok, S.F, A, S.ax, S.aAx, 0, 2 * Math.PI, 2500, 1.6, 0.8); S.F.line([1, 0], COL.d);
    },
    async (tok, S) => { const E = eigInfo(A); cap('代數重數 2：多項式的重根次數', 'algebraic multiplicity'); row(ok, E.groups[0].am === 2, '代數重數（AM）= 2 ✓', 4); },
    async (tok, S) => { const E = eigInfo(A); cap('幾何重數：特徵向量有幾個', '只有 (1, 0)'); row(ok, E.groups[0].gm === 1 && nearV(mulMV(addM(A, I2, -2), [1, 0]), [0, 0]), '幾何重數（GM）= 1：只有 (1, 0) ✓', 5); },
    async (tok, S) => { const y = mulMV(addM(A, I2, -2), [0, 1]); cap('(0, 1) 不在 null space', '(A − 2I)(0, 1) = (1, 0) ≠ 0'); row(ok, !nearV(y, [0, 0]), '(A − 2I)(0, 1) = ' + vstr(y) + ' ≠ 0 ✓', 6); },
    async (tok, S) => { cap('找不到兩個獨立特徵向量', '不能對角化'); row(bad, 'GM 1 < AM 2 → 不能對角化', 7); },
    async (tok, S) => { cap('「Aᵏ → 0 ⇔ |λ| < 1」沒涵蓋這種', '推論靠 n 個獨立特徵向量'); },
    async (tok, S) => { cap('λ 都相異就一定沒問題', '每個 λ：AM = GM = 1'); },
  ]);
}
// L22-6：u_{k+1} = A u_k（示意 A = [1 0.5; 0.5 1]，u₀ = (1, 0.2)）
{
  const A = [[1, 0.5], [0.5, 1]], Sm = [[1, 1], [1, -1]], u0 = [1, 0.2], c = mulMV(inv2(Sm), u0), lam = [1.5, 0.5];
  const uk = (k) => addv(scl([1, 1], c[0] * lam[0] ** k), scl([1, -1], c[1] * lam[1] ** k));
  scene('l22-uk', 'L22：uₖ₊₁ = Auₖ → uₖ = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂', [
    async (tok, S) => { cap('可以對角化的重要情況', '來解一個方程式'); S.F = plane2(); S.F.line([1, 1], COL.d); S.F.line([1, -1], COL.r); row(sm, '示意 A = [1 0.5; 0.5 1]', 0); },
    async (tok, S) => { cap('從 u₀ 開始，每一步乘 A', 'uₖ₊₁ = Auₖ'); S.au = S.F.arrow(u0, COL.k, 'u₀'); row(hd, 'uₖ₊₁ = A uₖ', 1); },
    async (tok, S) => {
      cap('u₁ = Au₀、u₂ = A²u₀ …', 'u_k = Aᵏu₀'); let u = u0;
      for (let k = 1; k <= 2; k++) { const v = mulMV(A, u), f = u.slice(); await anim(tok, 700, (t) => S.F.set(S.au, addv(f, scl(addv(v, scl(f, -1)), t)))); u = v; S.F.dot(u, COL.k, 0.06); }
      S.au.tag('u₂'); row(hot, 'u_k = Aᵏ u₀', 2);
    },
    async (tok, S) => { cap('一階差分方程（difference equation）', '下一講是微分方程'); row(pl, '一階、系統（向量 + 矩陣）', 3); },
    async (tok, S) => { cap('u₁₀₀ = A¹⁰⁰u₀ 很簡潔', '但要怎麼真的算出來？'); },
    async (tok, S) => {
      cap('把 u₀ 寫成特徵向量的組合', 'u₀ = c₁x₁ + c₂x₂'); kill(S.au);
      S.a0 = S.F.arrow(u0, COL.k, 'u₀'); S.a1 = S.F.arrow(scl([1, 1], c[0]), COL.d, 'c₁x₁'); S.a2 = S.F.arrow(scl([1, -1], c[1]), COL.r, 'c₂x₂', '', scl([1, 1], c[0]));
      row(ok, nearV(addv(scl([1, 1], c[0]), scl([1, -1], c[1])), u0), 'u₀ = ' + fmt(c[0]) + '(1, 1) + ' + fmt(c[1]) + '(1, −1) ✓', 4);
    },
    async (tok, S) => {
      cap('乘 A：每一塊各走各的', 'Au₀ = c₁λ₁x₁ + c₂λ₂x₂');
      await anim(tok, 900, (t) => { const k = t; const s1 = c[0] * lam[0] ** k, s2 = c[1] * lam[1] ** k; S.F.set(S.a1, scl([1, 1], s1)); S.F.set(S.a2, scl([1, -1], s2), scl([1, 1], s1)); S.F.set(S.a0, addv(scl([1, 1], s1), scl([1, -1], s2))); });
      S.a0.tag('Au₀'); row(ok, nearV(mulMV(A, u0), uk(1)), 'Au₀ = 1.5·c₁x₁ + 0.5·c₂x₂ ✓', 5);
    },
    async (tok, S) => {
      cap('乘 A¹⁰⁰：每塊多一個 λ¹⁰⁰', '示意先走到 k = 4');
      await anim(tok, 1800, (t) => { const k = 1 + 3 * t; const s1 = c[0] * lam[0] ** k, s2 = c[1] * lam[1] ** k; S.F.set(S.a1, scl([1, 1], s1)); S.F.set(S.a2, scl([1, -1], s2), scl([1, 1], s1)); S.F.set(S.a0, addv(scl([1, 1], s1), scl([1, -1], s2))); });
      S.a0.tag('A⁴u₀'); row(hot, 'A¹⁰⁰u₀ = c₁λ₁¹⁰⁰x₁ + c₂λ₂¹⁰⁰x₂', 6);
    },
    async (tok, S) => { cap('這其實就是 SΛ¹⁰⁰c', ''); row(ok, nearV(mulMV(powM(A, 4), u0), mulMV(Sm, mulMV(diagM([1.5 ** 4, 0.5 ** 4]), c))), 'A⁴u₀ = SΛ⁴c ✓', 7); },
    async (tok, S) => { cap('c 從哪來？u₀ = Sc', 'c = S⁻¹u₀：每個特徵向量佔多少'); row(note, 'u₀ = Sc', 3); },
    async (tok, S) => { cap('u₁₀₀ = SΛ¹⁰⁰c', '展開 u₀，讓每個特徵向量各走各的'); },
  ]);
}
// L22-7：Fibonacci → u_{k+1} = Au_k
{
  const A = [[1, 1], [1, 0]], l1 = (1 + Math.sqrt(5)) / 2, l2 = (1 - Math.sqrt(5)) / 2;
  const fib = [0, 1]; for (let k = 2; k <= 40; k++) fib.push(fib[k - 1] + fib[k - 2]);
  const ctr = (f, t, y) => f(t, 0, y);
  scene('l22-fib1', 'L22：Fibonacci 化成 uₖ₊₁ = Auₖ；λ = (1 ± √5)/2', [
    async (tok, S) => { cap('例子：Fibonacci 數列', ''); S.cs = []; },
    async (tok, S) => { cap('F₀ = 0、F₁ = 1', ''); for (let k = 0; k < 2; k++) { S.cs.push(cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2)); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('下一個 = 前兩個相加', '0 + 1 = 1'); S.cs.push(cube(1, COL.a, [0.7, 0.7, 0.7], -6 + 2 * 0.9, 6.0, 0, 2)); sm('F2', -6 + 1.8, 5.3); },
    async (tok, S) => { cap('1 + 1 = 2、1 + 2 = 3', '看起來像 1, 2, 3, 4…？'); for (let k = 3; k <= 4; k++) { cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('不是：5、8、13…', ''); for (let k = 5; k <= 7; k++) { cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('F₁₀₀ 是多少？', ''); hot('F₁₀₀ = ?', 2.0, 6.0); },
    async (tok, S) => { cap('長得多快？一定在長', '不穩定：特徵值不會都小於 1'); },
    async (tok, S) => { cap('答案在特徵值裡：先找出矩陣', ''); },
    async (tok, S) => { cap('Fₖ₊₂ = Fₖ₊₁ + Fₖ', '一條方程式、二階'); S.e1 = ctr(hd, 'Fₖ₊₂ = Fₖ₊₁ + Fₖ　（純量、二階）', 4.4); },
    async (tok, S) => { cap('小技巧：令 uₖ = (Fₖ₊₁, Fₖ)', '把未知數變成向量'); ctr(pl, 'uₖ = (Fₖ₊₁, Fₖ)', 3.7); },
    async (tok, S) => { cap('再加一條：Fₖ₊₁ = Fₖ₊₁', '得到 2×2 的一階系統'); ctr(pl, '補一條：Fₖ₊₁ = Fₖ₊₁', 3.0); },
    async (tok, S) => {
      cap('矩陣 A = [1 1; 1 0]', 'uₖ₊₁ = Auₖ'); S.g = mgrid(A, 3.6, 4.6, 0, { color: () => COL.b }); tag('A', 'ptr', 4.0, 5.3);
      const u6 = mulMV(powM(A, 6), [1, 0]); ok(nearV(u6, [fib[7], fib[6]]), 'A⁶(1, 0) = (13, 8) ✓', 4.0, 3.1);
    },
    async (tok, S) => { cap('二階純量 → 一階 2×2 系統', ''); },
    async (tok, S) => { cap('A 對稱 → 特徵值是實數', '特徵向量互相垂直'); ctr(sm, 'A 對稱 → λ 實數、特徵向量垂直', 2.3); },
    async (tok, S) => { cap('λ₁ + λ₂ = trace = 1', 'λ₁λ₂ = det = −1'); ctr(pl, 'λ₁ + λ₂ = trace = ' + fmt(trM(A)) + '　λ₁λ₂ = det = ' + fmt(det2(A)), 1.6); },
    async (tok, S) => { cap('det(A − λI) = λ² − λ − 1', ''); ctr((t, x, y) => ok(nearV(charPoly(A), [1, -1, -1]), t, x, y), 'det(A − λI) = λ² − λ − 1 ✓', 0.9); },
    async (tok, S) => { cap('跟遞迴式長得一樣', 'Fₖ₊₂ − Fₖ₊₁ − Fₖ = 0'); S.g.c.forEach((r) => r.forEach((m) => glow(m, GOLD))); ctr(note, 'λ² − λ − 1 ↔ Fₖ₊₂ − Fₖ₊₁ − Fₖ', 0.2); },
    async (tok, S) => {
      S.g.clearGlow(); cap('二次公式：λ = (1 ± √5)/2', ''); const rs = roots(charPoly(A)).map((z) => z[0]).sort((a, b) => b - a);
      ok(near(rs[0], l1, 1e-6) && near(rs[1], l2, 1e-6), 'λ = (1 ± √5)/2 ✓', 4.0, 2.4);
    },
    async (tok, S) => { cap('加起來 1、乘起來 −1', ''); ok(near(l1 + l2, 1) && near(l1 * l2, -1), 'λ₁ + λ₂ = 1 ✓　λ₁λ₂ = −1 ✓', 4.0, 1.7); },
    async (tok, S) => { cap('λ₁ ≈ 1.618、λ₂ ≈ −0.618', ''); hot('λ₁ ≈ ' + l1.toFixed(3) + '、λ₂ ≈ ' + l2.toFixed(3), 4.0, 1.0); },
  ]);
}
// L22-8：Fibonacci 的成長率
{
  const A = [[1, 1], [1, 0]], s5 = Math.sqrt(5), l1 = (1 + s5) / 2, l2 = (1 - s5) / 2;
  const fib = [0, 1]; for (let k = 2; k <= 100; k++) fib.push(fib[k - 1] + fib[k - 2]);
  scene('l22-fib2', 'L22：Fibonacci 的成長率 ≈ 1.618', [
    async (tok, S) => { cap('一個 λ > 1，一個 |λ| < 1', 'λ₁ ≈ 1.618、λ₂ ≈ −0.618'); hd('λ₁ ≈ 1.618 > 1　λ₂ ≈ −0.618', 3.2, 6.3); },
    async (tok, S) => { cap('特徵值相異 → 可以對角化', ''); ok(Math.abs(l1 - l2) > 1e-9, '相異 → 可對角化 ✓', 3.2, 5.6); },
    async (tok, S) => {
      cap('長多快？不是每步加倍', '5、8、13、21、34…');
      for (let k = 1; k <= 9; k++) { const h = fib[k] * 0.12, x = -6.2 + k * 0.62; const m = lab.box(COL.a, [0.45, 1, 0.45]); m.scale.y = 0.001; lab.world.add(m); await anim(tok, 220, (t) => { m.scale.y = Math.max(0.001, h * t); m.position.set(x, h * t / 2, 0); }); sm(String(fib[k]), x, h + 0.3); }
    },
    async (tok, S) => { cap('什麼控制成長？特徵值', '大的那個：λ₁'); },
    async (tok, S) => {
      cap('F₁₀₀ ≈ c₁·((1 + √5)/2)¹⁰⁰', '每一步大約乘 λ₁'); hot('F₁₀₀ ≈ c₁ · 1.618¹⁰⁰', 3.2, 4.8);
      ok(near(fib[30] / fib[29], l1, 1e-9), 'F₃₀ / F₂₉ = ' + (fib[30] / fib[29]).toFixed(6) + ' ≈ λ₁ ✓', 3.2, 4.1);
    },
    async (tok, S) => { cap('u₀ 是特徵向量的組合', '乘 A 一百次：λ₁¹⁰⁰ 那一項接管'); },
    async (tok, S) => { const t = Math.abs(l2) ** 100; cap('第二項幾乎是 0', '(−0.618)¹⁰⁰ 非常小'); ok(t < 1e-20, '|λ₂|¹⁰⁰ ≈ ' + t.toExponential(1) + ' ✓', 3.2, 3.4); },
    async (tok, S) => { cap('動態問題：A、A²、A³…隨時間演化', '靜態 Ax = b 看 pivot；動態看 λ'); },
    async (tok, S) => { cap('補完特徵向量：A − λI', '[1 − λ 1; 1 −λ]'); pl('A − λI = [1−λ 1; 1 −λ]', 3.2, 2.7); },
    async (tok, S) => {
      cap('特徵向量 x = (λ, 1)', '第二列 λ − λ = 0；第一列用 λ² − λ − 1 = 0');
      ok([l1, l2].every((l) => nearV(mulMV(addM(A, I2, -l), [l, 1]), [0, 0], 1e-12)), 'x₁ = (λ₁, 1)、x₂ = (λ₂, 1) ✓', 3.2, 2.0);
    },
    async (tok, S) => { cap('u₀ = (F₁, F₀) = (1, 0)', ''); pl('u₀ = (F₁, F₀) = (1, 0)', 3.2, 1.3); },
    async (tok, S) => {
      cap('找 c₁、c₂ 組出 u₀', '（補充：老師沒算完）c₁ = 1/√5、c₂ = −1/√5'); const c1 = 1 / s5, c2 = -1 / s5;
      const okc = nearV(addv(scl([l1, 1], c1), scl([l2, 1], c2)), [1, 0], 1e-12) && Math.round((l1 ** 10 - l2 ** 10) / s5) === fib[10];
      ok(okc, '補充：F_k = (λ₁ᵏ − λ₂ᵏ)/√5，F₁₀ = ' + fib[10] + ' ✓', 3.2, 0.6);
    },
    async (tok, S) => { cap('一階系統隨時間演化：先找 λ、x', '特徵值就告訴你：爆掉？趨近 0？'); },
    async (tok, S) => { cap('再把 u₀ 展開、每個特徵向量各走各的', 'Aᵏ = SΛᵏS⁻¹'); note('Aᵏ = SΛᵏS⁻¹', -3.4, 6.3); },
  ]);
}

// ═════════════════════════ MIT 18.06 L23（IZqwi0wJovM）Differential Equations and exp(At) ═════════════════════════
const A23 = [[-1, 2], [1, -2]], S23 = [[2, 1], [1, -1]], X1 = [2, 1], X2 = [1, -1];
const u23 = (t) => addv(scl(X1, 1 / 3), scl(X2, Math.exp(-3 * t) / 3));          // u(t) = ⅓(2,1) + ⅓e^{−3t}(1,−1)
const du23 = (t) => scl(X2, -Math.exp(-3 * t));                                  // du/dt
// e^{M} 用級數（夠多項）；拿來跟 S e^{Λt} S⁻¹ 對答案
function expSeries(M, N = 40) { let term = I2.map((r) => r.slice()), sum = I2.map((r) => r.slice()); for (let n = 1; n <= N; n++) { term = sclM(mm(term, M), 1 / n); sum = addM(sum, term); } return sum; }
const eAt = (t) => mm(S23, mm(diagM([Math.exp(0 * t), Math.exp(-3 * t)]), inv2(S23)));
function rect(F, a, b, color, op = 0.18) { const w = (b[0] - a[0]) * F.s, h = (b[1] - a[1]) * F.s; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); const c = F.w([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 0.01); m.position.copy(c); lab.world.add(m); return m; }
function disk(F, r, color, op = 0.22) { const m = new THREE.Mesh(new THREE.CircleGeometry(r * F.s, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); m.position.copy(F.w([0, 0], 0.015)); lab.world.add(m); return m; }
const ctr = (f, t, y, x = 0) => f(t, x, y);
// L23-1：開場
scene('l23-intro', 'L23：微分方程 du/dt = Au：解是指數', [
  async (tok, S) => { cap('這講：解線性微分方程組', 'du/dt = Au（常係數）'); ctr(hd, 'du/dt = Au', 5.6); },
  async (tok, S) => { cap('關鍵：解是指數函數 e^(λt)', '要找的是指數上的 λ 和前面的向量'); ctr(hot, '找 u = e^(λt)x', 4.6); },
  async (tok, S) => { cap('完全平行於矩陣的冪次', '上一講：Aᵏ、A¹⁰⁰'); ctr(pl, '上一講：uₖ₊₁ = Auₖ → λᵏ', 3.4, -3); ctr(pl, '這一講：du/dt = Au → e^(λt)', 3.4, 3); },
  async (tok, S) => { cap('不是次方，而是指數', '微分方程自然的東西'); ctr(note, 'λᵏ（次方） ↔ e^(λt)（指數）', 2.2); },
]);
// L23-2：例子：特徵值、特徵向量
scene('l23-eig', 'L23：例子 A = [−1 2; 1 −2]：λ = 0、−3', [
  async (tok, S) => { cap('從一個例子開始', '先走過一遍機制'); S.F = plane2(-3.4, 3.0, 0.8, 3); },
  async (tok, S) => { cap('du₁/dt = −u₁ + 2u₂、du₂/dt = u₁ − 2u₂', 'A = [−1 2; 1 −2]'); mlab('A', A23, 0); },
  async (tok, S) => { cap('初始條件：u(0) = (1, 0)', '一開始全部在 u₁'); S.au = S.F.arrow([1, 0], COL.k, 'u(0)'); row(pl, 'u(0) = (1, 0)', 1); },
  async (tok, S) => {
    const d = mulMV(A23, [1, 0]); cap('du₂/dt > 0：u₁ 流進 u₂', 'u₁ 流出'); S.F.arrow(scl(d, 0.5), COL.b, 'du/dt', '', [1, 0]);
    row(ok, d[1] > 0 && d[0] < 0, 't = 0：du/dt = ' + vstr(d) + ' → 流進 u₂ ✓', 2);
  },
  async (tok, S) => { cap('靠特徵值、特徵向量追蹤這個流動', '第一件事：找 λ、x'); S.n1 = mark(); },
  async (tok, S) => { cap('看得出一個特徵值嗎？A 是 singular', ''); row(ok, det2(A23) === 0, 'det A = 0：singular → λ = 0 ✓', 3); },
  async (tok, S) => { cap('第二行 = −2 × 第一行', ''); row(ok, nearV([A23[0][1], A23[1][1]], scl([A23[0][0], A23[1][0]], -2)), '第 2 行 = −2 × 第 1 行 ✓', 4); },
  async (tok, S) => { cap('trace = −3 → 另一個 λ = −3', '0 + λ₂ = −3'); row(ok, trM(A23) === -3, 'trace = −1 − 2 = −3 → λ₂ = −3 ✓', 5); },
  async (tok, S) => { cap('照算：det(A − λI) = λ² + 3λ', ''); row(ok, nearV(charPoly(A23), [1, 3, 0]), 'det(A − λI) = λ² + 3λ ✓', 6); },
  async (tok, S) => { const rs = roots(charPoly(A23)).map((z) => z[0]).sort((a, b) => b - a); cap('λ(λ + 3)：λ₁ = 0、λ₂ = −3', ''); row(ok, nearV(rs, [0, -3]), 'λ(λ + 3) = 0 → λ₁ = 0、λ₂ = −3 ✓', 7); },
  async (tok, S) => { cap('e⁻³ᵗ 會消失、e⁰ᵗ = 1 不動', '→ 穩定狀態（steady state）'); S.nt = note('e⁻³ᵗ → 0；e⁰ᵗ = 1', 5.5, R(1)); },
  async (tok, S) => {
    cap('λ = 0 的特徵向量：null space', 'x₁ = (2, 1)'); S.F.line(X1, COL.d); S.F.arrow(X1, COL.d, 'x₁');
    wipe(S.n1); row(hot, 'λ₁ = 0、λ₂ = −3', 3); row(ok, nearV(mulMV(A23, X1), [0, 0]), 'x₁ = (2, 1)：Ax₁ = 0 ✓', 4);
  },
  async (tok, S) => { cap('λ = −3：A + 3I', '對角線加 3'); S.m3 = mlab('A + 3I', addM(A23, I2, 3), 5, ''); },
  async (tok, S) => {
    cap('null space：x₂ = (1, −1)', 'Ax₂ = −3x₂'); S.F.line(X2, COL.r); S.F.arrow(X2, COL.r, 'x₂');
    row(ok, nearV(mulMV(A23, X2), scl(X2, -3)), 'x₂ = (1, −1)：Ax₂ = (−3, 3) = −3x₂ ✓', 6);
  },
  async (tok, S) => { cap('第一件工作完成', '特徵值已經告訴我們最重要的資訊'); },
]);
// L23-3：解 u(t) = c₁e^{λ₁t}x₁ + c₂e^{λ₂t}x₂
scene('l23-sol', 'L23：u(t) = ⅓(2, 1) + ⅓e⁻³ᵗ(1, −1)', [
  async (tok, S) => { cap('答案 u(t) 是什麼？', ''); S.F = plane2(-3.4, 3.0, 0.8, 3); S.F.line(X1, COL.d); S.F.line(X2, COL.r); },
  async (tok, S) => { cap('兩個純指數解', 'e^(λ₁t)x₁ 和 e^(λ₂t)x₂'); S.n = mark(); row(hd, '純解：e^(λ₁t)x₁、e^(λ₂t)x₂', 0); },
  async (tok, S) => { cap('一般解：兩個的組合', ''); row(hot, 'u(t) = c₁e^(λ₁t)x₁ + c₂e^(λ₂t)x₂', 1); },
  async (tok, S) => { cap('檢查：代進 du/dt = Au', '試 u = e^(λ₁t)x₁'); row(pl, '代入 du/dt = Au', 2); },
  async (tok, S) => {
    const t = 0.4, u = scl(X2, Math.exp(-3 * t)), lhs = scl(u, -3), rhs = mulMV(A23, u);
    cap('左邊：微分拿下一個 λ₁；右邊 Ax₁ = λ₁x₁', '兩邊一樣');
    row(ok, nearV(lhs, rhs, 1e-12), '例 e⁻³ᵗx₂：d/dt = −3e⁻³ᵗx₂ = A(e⁻³ᵗx₂) ✓', 3);
  },
  async (tok, S) => { cap('類比上一講的純冪次', 'λ₁ᵏx₁ ↔ e^(λ₁t)x₁'); row(note, '差分：λᵏx　微分：e^(λt)x', 4); },
  async (tok, S) => { cap('c₁、c₂ 是多少？', ''); },
  async (tok, S) => { cap('代入這個例子', 'λ₁ = 0：e⁰ᵗ = 1；λ₂ = −3'); row(pl, 'u(t) = c₁·1·(2, 1) + c₂e⁻³ᵗ(1, −1)', 5); },
  async (tok, S) => { cap('c 由初始條件決定', 'u(0) = (1, 0)'); },
  async (tok, S) => { cap('t = 0：c₁(2, 1) + c₂(1, −1) = (1, 0)', ''); row(pl, 't = 0：c₁(2, 1) + c₂(1, −1) = (1, 0)', 6); },
  async (tok, S) => { const c = mulMV(inv2(S23), [1, 0]); cap('都是 1 → (3, 0)；所以各取 1/3', 'c₁ = c₂ = 1/3'); row(ok, nearV(c, [1 / 3, 1 / 3]), 'c₁ = 1/3、c₂ = 1/3 ✓', 7); },
  async (tok, S) => {
    cap('答案：u(t) = ⅓(2, 1) + ⅓e⁻³ᵗ(1, −1)', ''); const okk = [0, 0.3, 1].every((t) => nearV(du23(t), mulMV(A23, u23(t)), 1e-12)) && nearV(u23(0), [1, 0], 1e-12);
    wipe(S.n); row(hot, 'u(t) = ⅓(2, 1) + ⅓e⁻³ᵗ(1, −1)', 0); row(ok, okk, 'u(0) = (1, 0)、du/dt = Au ✓', 1);
  },
  async (tok, S) => {
    cap('從 (1, 0) 出發，慢慢流向 u₂', '一部分「人」搬過去'); S.au = S.F.arrow(u23(0), COL.k, 'u(t)');
    await anim(tok, 2400, (s) => { const t = s * 2; S.F.set(S.au, u23(t)); });
    S.au.tag('u(2)');
  },
  async (tok, S) => { const ui = [2 / 3, 1 / 3]; cap('t → ∞：e⁻³ᵗ 消失', '穩定狀態 u(∞) = (2/3, 1/3)'); S.F.dot(ui, COL.g, 0.12); row(ok, nearV(u23(40), ui, 1e-12), 'u(∞) = ⅓(2, 1) = (2/3, 1/3) ✓', 2); },
]);
// L23-4：穩定、穩定狀態、爆掉（複數平面）
scene('l23-stab', 'L23：穩定 ⇔ Re λ < 0（複數平面）', [
  async (tok, S) => { cap('不一定有穩定狀態', '可能趨近 0，也可能爆掉'); S.F = plane2(-3.4, 3.0, 0.3, 7.5); S.F.lab('Re', [7.4, -0.6]); S.F.lab('Im', [0.7, 7.2]); },
  async (tok, S) => { cap('穩定：u(t) → 0', '不管初始條件'); row(hd, '穩定：u(t) → 0', 0); },
  async (tok, S) => { cap('負的特徵值', 'e^(λt) → 0'); S.F.dot([-3, 0], COL.d, 0.13); row(pl, 'λ < 0：e^(λt) → 0', 1); },
  async (tok, S) => { cap('如果 λ 是複數呢？', ''); },
  async (tok, S) => { cap('例：λ = −3 + 6i', ''); S.F.dot([-3, 6], COL.c, 0.13); S.F.lab('−3 + 6i', [-3, 6.9], 'ptr'); },
  async (tok, S) => {
    const t = 0.5, re = Math.exp(-3 * t) * Math.cos(6 * t), im = Math.exp(-3 * t) * Math.sin(6 * t);
    cap('|e^((−3+6i)t)| = e⁻³ᵗ', '虛部不影響大小'); row(ok, near(Math.hypot(re, im), Math.exp(-3 * t), 1e-12), 't = 0.5：|e^((−3+6i)t)| = e^(−1.5) ✓', 2);
  },
  async (tok, S) => {
    cap('e⁶ⁱᵗ = cos 6t + i sin 6t', '在單位圓上繞，大小永遠 1'); const c = new THREE.Mesh(new THREE.RingGeometry(1 * S.F.s - 0.012, 1 * S.F.s + 0.012, 48), new THREE.MeshBasicMaterial({ color: COL.k })); c.position.copy(S.F.w([0, 0], 0.02)); lab.world.add(c);
    const d = S.F.dot([1, 0], COL.b, 0.1); await anim(tok, 2000, (s) => d.position.copy(S.F.w([Math.cos(6 * s), Math.sin(6 * s)], 0.08)));
    row(ok, near(Math.cos(6) ** 2 + Math.sin(6) ** 2, 1), 'cos² + sin² = 1 ✓', 3);
  },
  async (tok, S) => { cap('重要的是實部：Re λ < 0', ''); S.lh = rect(S.F, [-7.5, -7.5], [0, 7.5], COL.d, 0.14); row(hot, '穩定 ⇔ 所有 Re λ < 0', 4); },
  async (tok, S) => { cap('虛部只讓兩個分量來回振盪', ''); row(sm, '虛部 → 振盪', 5); },
  async (tok, S) => { cap('穩定狀態：λ₁ = 0、其他 Re λ < 0', '剛才的例子：0 和 −3'); S.F.dot([0, 0], COL.g, 0.15); row(pl, '穩定狀態：λ₁ = 0，其他 Re λ < 0', 6); },
  async (tok, S) => { cap('任何一個 Re λ > 0 → 爆掉', ''); rect(S.F, [0, -7.5], [7.5, 7.5], COL.r, 0.1); row(bad, '有 Re λ > 0 → 爆掉', 7); },
  async (tok, S) => {
    const E = eigInfo(sclM(A23, -1)).groups.map((g) => g.re); cap('把 A 全部變號：特徵值也變號', '−A：λ = 0、+3 → e³ᵗ 爆掉');
    S.F.dot([3, 0], COL.r, 0.13); row(ok, nearV(E, [3, 0]), '−A 的 λ = 3、0 ✓ → e³ᵗ 爆掉', 5);
  },
]);
// L23-5：2×2：trace < 0 且 det > 0
scene('l23-tr', 'L23：2×2 穩定 ⇔ trace < 0 且 det > 0', [
  async (tok, S) => { cap('2×2 可以講得更精確', ''); S.F = plane2(-3.4, 3.0, 0.4, 6); S.F.lab('trace', [5.6, -0.7]); S.F.lab('det', [0.8, 5.8]); },
  async (tok, S) => { cap('A = [a b; c d]', '要兩個特徵值的實部都 < 0'); row(hd, 'A = [a b; c d]：Re λ₁、Re λ₂ < 0？', 0); },
  async (tok, S) => { cap('trace = a + d = λ₁ + λ₂', '所以 trace < 0'); row(pl, 'trace = a + d = λ₁ + λ₂ < 0', 1); },
  async (tok, S) => { cap('複數時：+6i、−6i 相加抵消', ''); row(ok, (-3 + -3) === -6, '(−3 + 6i) + (−3 − 6i) = −6 ✓', 2); },
  async (tok, S) => { cap('trace < 0 就夠了嗎？不夠', ''); },
  async (tok, S) => {
    const B = [[-2, 0], [0, 1]], E = eigInfo(B).groups.map((g) => g.re); cap('[−2 0; 0 1]：trace = −1', '但 λ = 1 → eᵗ 爆掉');
    S.F.dot([trM(B), det2(B)], COL.r, 0.14); S.F.lab('[−2 0; 0 1]', [trM(B), det2(B) - 0.9], 'bad');
    row(ok, trM(B) < 0 && nearV(E, [1, -2]), 'trace = −1 < 0，λ = 1、−2 → 不穩定 ✓', 3);
  },
  async (tok, S) => { cap('還需要行列式的條件', ''); },
  async (tok, S) => { cap('兩個都負 → 乘積 det > 0', 'det = λ₁λ₂'); row(pl, 'det = λ₁λ₂ > 0', 4); },
  async (tok, S) => {
    const C = [[-2, 1], [-1, -1]], E = eigInfo(C); cap('穩定：trace < 0 且 det > 0', '示意 [−2 1; −1 −1]');
    rect(S.F, [-6, 0], [0, 6], COL.d, 0.16); S.F.dot([trM(C), det2(C)], COL.d, 0.14);
    row(hot, '穩定 ⇔ trace < 0 且 det > 0', 5); row(ok, trM(C) < 0 && det2(C) > 0 && E.groups.every((g) => g.re < 0), '示意：trace −3、det 3，Re λ = ' + fmt(E.groups[0].re) + ' ✓', 6);
  },
]);
// L23-6：u = Sv：特徵向量把方程式解耦
scene('l23-uncouple', 'L23：u = Sv：解耦 → u(t) = Se^(Λt)S⁻¹u(0)', [
  async (tok, S) => { cap('核心步驟：解這個系統', '找 λ、找 x、找 c'); ctr(hd, '找 λ → 找 x → 找 c', 6.0); },
  async (tok, S) => { cap('求 c 的那兩條方程式', '寫成矩陣形式'); ctr(pl, 'c₁(2, 1) + c₂(1, −1) = (1, 0)', 5.3); },
  async (tok, S) => { cap('矩陣就是 S：特徵向量矩陣', 'Sc = u(0)'); ctr((t, x, y) => ok(nearV(mulMV(S23, [1 / 3, 1 / 3]), [1, 0]), t, x, y), 'S = [2 1; 1 −1]：Sc = u(0)，c = (1/3, 1/3) ✓', 4.6); },
  async (tok, S) => { cap('c 說每個純指數佔多少', '起點對了，之後各走各的'); },
  async (tok, S) => { cap('A 把 u₁、u₂ 綁在一起（coupled）', '特徵向量把它們解開（uncouple）'); ctr(note, 'coupled → uncouple = 對角化', 3.9); },
  async (tok, S) => { cap('du/dt = Au，令 u = Sv', ''); ctr(hot, 'du/dt = Au，令 u = Sv', 3.2); },
  async (tok, S) => { cap('S 是常數：S dv/dt = ASv', ''); ctr(pl, 'S dv/dt = A S v', 2.6); },
  async (tok, S) => { cap('左乘 S⁻¹：dv/dt = S⁻¹ASv = Λv', ''); ctr((t, x, y) => ok(nearM(mm(inv2(S23), mm(A23, S23)), diagM([0, -3])), t, x, y), 'dv/dt = S⁻¹AS v = Λv，Λ = diag(0, −3) ✓', 2.0); },
  async (tok, S) => { cap('dv₁/dt = λ₁v₁、…：彼此不相連', ''); ctr(pl, 'dv₁/dt = λ₁v₁　dv₂/dt = λ₂v₂', 1.4); },
  async (tok, S) => { cap('每條都好解：v(t) = e^(Λt)v(0)', ''); ctr(pl, 'v(t) = e^(Λt) v(0)', 0.8); },
  async (tok, S) => {
    cap('u(t) = Se^(Λt)S⁻¹u(0)', ''); const okk = [0.2, 1].every((t) => nearV(mulMV(eAt(t), [1, 0]), u23(t), 1e-12));
    ok(okk, 'u(t) = S e^(Λt) S⁻¹ u(0) ✓', 3.6, 0.1);
  },
  async (tok, S) => { cap('Se^(Λt)S⁻¹ 就是 e^(At)', ''); hot('e^(At) = S e^(Λt) S⁻¹', -3.6, 0.1); },
  async (tok, S) => { cap('可是「e 的矩陣次方」是什麼意思？', '接下來定義它'); },
]);
// L23-7：e^{At} 的級數
scene('l23-exp', 'L23：e^(At) = I + At + (At)²/2! + … = Se^(Λt)S⁻¹', [
  async (tok, S) => { cap('矩陣的指數是什麼？', ''); ctr(hd, 'e^(At) = ?', 6.1); },
  async (tok, S) => { cap('回到冪級數', 'e^x = 1 + x + x²/2 + x³/6 + …'); ctr(pl, 'eˣ = 1 + x + x²/2 + x³/6 + …', 5.5); },
  async (tok, S) => { cap('換成矩陣：1 → I、x → At', ''); ctr(hot, 'e^(At) = I + At + (At)²/2 + (At)³/6 + …', 4.9); },
  async (tok, S) => { cap('一般項 (At)ⁿ / n!', '分母是階乘'); ctr(sm, '一般項：(At)ⁿ / n!', 4.3); },
  async (tok, S) => { cap('另一個漂亮的級數：幾何級數', '1 + x + x² + … = 1/(1 − x)'); S.g1 = ctr(pl, '1 + x + x² + x³ + … = 1/(1 − x)', 3.6, -3); },
  async (tok, S) => { cap('矩陣版：(I − At)⁻¹ = I + At + (At)² + …', ''); S.g2 = ctr(pl, '(I − At)⁻¹ = I + At + (At)² + …', 3.0, -3); },
  async (tok, S) => {
    const t = 0.01, ex = inv2(addM(I2, sclM(A23, t), -1)), ap = addM(I2, sclM(A23, t)); cap('t 很小：(I − At)⁻¹ ≈ I + At', '');
    S.g3 = ctr((a, x, y) => ok(nearM(ex, ap, 1e-3), a, x, y), 't = 0.01：(I − At)⁻¹ ≈ I + At（差 < 0.001）✓', 2.4, -3);
  },
  async (tok, S) => {
    const M = sclM(A23, 1), terms = []; let term = I2; for (let n = 1; n <= 15; n++) { term = sclM(mm(term, M), 1 / n); terms.push(Math.max(...term.flat().map(Math.abs))); }
    cap('指數級數永遠收斂', '除以越來越大的 n!'); ctr((a, x, y) => ok(terms[14] < 1e-3 && terms[14] < terms[7], a, x, y), 't = 1：第 15 項最大只剩 ' + terms[14].toExponential(1) + ' ✓', 3.6, 3);
  },
  async (tok, S) => { cap('幾何級數可能發散', 'At 的特徵值要小於 1'); ctr(note, '幾何級數：要 |λ(At)| < 1', 3.0, 3); },
  async (tok, S) => { [S.g1, S.g2, S.g3].forEach(ln); cap('主角是 e^(At)', '怎麼看出它 = Se^(Λt)S⁻¹？'); },
  async (tok, S) => { cap('用這章的基本公式 A = SΛS⁻¹', 'At = SΛS⁻¹t'); ctr(pl, 'At = SΛS⁻¹ t', 2.2, -3); },
  async (tok, S) => { cap('A²t²/2 = SΛ²S⁻¹ t²/2', 'S⁻¹S 消掉'); ctr(pl, '(At)²/2 = SΛ²S⁻¹ t²/2', 1.6, -3); },
  async (tok, S) => { cap('把 S 拉到左邊、S⁻¹ 拉到右邊', 'I 寫成 SS⁻¹'); ctr(pl, 'I = SS⁻¹', 1.0, -3); },
  async (tok, S) => {
    const t = 0.5, lhs = expSeries(sclM(A23, t)), rhs = eAt(t); cap('中間剩 I + Λt + (Λt)²/2 + … = e^(Λt)', 'e^(At) = Se^(Λt)S⁻¹');
    ctr((a, x, y) => ok(nearM(lhs, rhs, 1e-10), a, x, y), 't = 0.5：級數 = S e^(Λt) S⁻¹ ✓', 1.6, 3);
  },
  async (tok, S) => { cap('這個公式永遠成立嗎？', '前提：A 可以對角化'); ctr(note, '前提：n 個獨立特徵向量', 1.0, 3); },
  async (tok, S) => { cap('特徵向量不夠的矩陣：S⁻¹ 不存在', '只能化成三角形（之後講）'); ctr(sm, '級數定義永遠可用；SΛS⁻¹ 版本不一定', 0.3); },
]);
// L23-8：e^{Λt}、穩定區域
scene('l23-region', 'L23：e^(Λt) 是對角的；穩定區域：左半平面 vs 單位圓', [
  async (tok, S) => { cap('e^(Λt) 是什麼？', ''); S.F = plane2(-3.4, 3.0, 0.62, 3.8); S.F.lab('Re', [3.7, -0.4]); S.F.lab('Im', [0.4, 3.6]); },
  async (tok, S) => { cap('Λ 是對角矩陣：λ₁ … λₙ', ''); row(hd, 'Λ = diag(λ₁, …, λₙ)', 0); },
  async (tok, S) => {
    const t = 0.7, E = expSeries(sclM(diagM([0, -3]), t)); cap('對角矩陣的指數：各自取指數', 'e^(Λt) = diag(e^(λ₁t), …)');
    row(ok, nearM(E, diagM([1, Math.exp(-3 * t)]), 1e-12), '例 Λ = diag(0, −3)：e^(Λt) = diag(1, e⁻³ᵗ) ✓', 1);
  },
  async (tok, S) => { cap('就是前半堂具體例子的公式版', ''); },
  async (tok, S) => { cap('e^(At) 什麼時候 → 0？', 'S、S⁻¹ 不動，看 e^(Λt)'); },
  async (tok, S) => { cap('每個 e^(λt) 都要 → 0', '所有 Re λ < 0'); row(hot, 'e^(At) → 0 ⇔ 所有 Re λ < 0', 2); },
  async (tok, S) => { cap('畫出複數平面', '橫軸實部、縱軸虛部'); },
  async (tok, S) => { cap('微分方程的穩定區域：左半平面', 'Re λ < 0'); rect(S.F, [-3.8, -3.8], [0, 3.8], COL.d, 0.18); row(pl, '微分方程：左半平面 Re λ < 0', 3); },
  async (tok, S) => { cap('冪次的穩定區域：單位圓內', '|λ| < 1'); disk(S.F, 1, COL.b, 0.3); row(pl, '冪次 Aᵏ：單位圓內 |λ| < 1', 4); },
  async (tok, S) => {
    cap('|λ| < 1 → Aᵏ → 0；Re λ < 0 → e^(At) → 0', '兩個平行的故事');
    const P = [[-0.5, 0.5], [0.6, 0]]; P.forEach((p) => S.F.dot(p, COL.k, 0.08));
    row(ok, Math.hypot(...P[0]) < 1 && P[0][0] < 0 && Math.hypot(...P[1]) < 1 && P[1][0] > 0, '示意 0.6：|λ| < 1 但 Re λ > 0 ✓', 5);
  },
]);
// L23-9：二階方程 → 2×2 系統
scene('l23-second', 'L23：y″ + by′ + ky = 0 → 2×2 一階系統', [
  async (tok, S) => { cap('最後一個例子', ''); },
  async (tok, S) => { cap('一條二階方程', 'y″ + by′ + ky = 0'); ctr(hd, "y'' + b y' + k y = 0", 6.0); },
  async (tok, S) => { cap('跟 Fibonacci 一樣的技巧', ''); },
  async (tok, S) => { cap('令 u = (y′, y)', ''); ctr(pl, "u = (y', y)", 5.3); },
  async (tok, S) => { cap('多加一條：y′ = y′', ''); ctr(pl, "補一條：y' = y'", 4.7); },
  async (tok, S) => { cap('第一列來自方程：y″ = −by′ − ky', ''); ctr(pl, "y'' = −b y' − k y　→ 第一列 [−b −k]", 4.1); },
  async (tok, S) => { cap('第二列：y′ = y′ → [1 0]', ''); ctr(hot, "u' = [−b −k; 1 0] u", 3.4); },
  async (tok, S) => { cap('5 階方程 → 5×5', '係數在第一列，下面放 1'); ctr(sm, '5 階 → 5×5：第一列是係數，次對角線全是 1', 2.7); },
  async (tok, S) => {
    const b = 3, k = 2, A = [[-b, -k], [1, 0]], rs = roots(charPoly(A)).map((z) => z[0]).sort((p, q) => q - p);
    cap('特徵值自然地連到原方程', '示意 b = 3、k = 2：λ² + 3λ + 2 = 0');
    ctr((t, x, y) => ok(nearV(charPoly(A), [1, b, k]) && nearV(rs, [-1, -2]), t, x, y), '示意 [−3 −2; 1 0]：λ² + 3λ + 2 → λ = −1、−2 ✓', 2.0);
  },
  async (tok, S) => { cap('次方 ↔ 指數：平行的兩講', '現在也會做指數了'); ctr(note, 'Aᵏ ↔ e^(At)', 1.2); },
]);
  }

  // ═══ egB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 6 章 — egB cued scenes：MIT 18.06 L24（Markov、Fourier）、L24b（Quiz 2 review）、L28（相似、Jordan）、
//     3Blue1Brown 第 14 集（eigenvectors）、第 15 集（mean–product trick） ───
// 每個特徵值、穩定狀態、相似、投影、行列式都由程式當場算，畫面顯示 ✓／✘；老師沒給數字的地方標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pre = (l) => { Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }); return l; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const nearV = (a, b, e = 1e-9) => a.length === b.length && a.every((v, i) => near(v, b[i], e));
const nearM = (A, B, e = 1e-9) => A.every((r, i) => nearV(r, B[i], e));
const nf = (x, d = 2) => { let v = Math.round(x * 10 ** d) / 10 ** d; if (Object.is(v, -0)) v = 0; return String(v).replace('-', '−'); };
const ff = (x) => fmt(Math.abs(x) < 1e-12 ? 0 : x).replace('-', '−');
const vs = (v) => '(' + v.map(ff).join(', ') + ')';
const ms2 = (M) => '[' + M.map((r) => r.map((x) => (typeof x === 'string' ? x : ff(x))).join(' ')).join('; ') + ']';
function mtx(M, x, y, cls = '') {
  const cells = M.map((r) => r.map((v) => (typeof v === 'string' ? v : ff(v))));
  const w = Math.max(...cells.flat().map((s) => s.length));
  return pre(tag(cells.map((r) => '[ ' + r.map((s) => s.padStart(w)).join('  ') + ' ]').join('\n'), cls, x, y));
}
const gkill = (g) => g.c.flat().forEach((m) => kill(m));
// left-aligned lines going down
function stack(x, yTop, dy = 0.54, z = 0) {
  const ls = [];
  const S = {
    ls,
    add(t, cls = '') { const l = tag(t, cls, x, yTop - ls.length * dy, z); l.center.set(0, 0.5); ls.push(l); return l; },
    ok(b, t) { return S.add(b ? t : t.replace(/✓/g, '✘'), b ? 'good' : 'bad'); },
    clear() { ls.forEach((l) => remove(l)); ls.length = 0; },
  };
  return S;
}
function slot(x, y, cls = '', z = 0) {
  const l = tag(' ', cls, x, y, z);
  l.set = (t, c) => { txt(l, t || ' '); if (c !== undefined) l.element.className = 'lab-label' + (c ? ' ' + c : ''); return l; };
  l.ok = (b, t) => l.set(b ? t : t.replace(/✓/g, '✘'), b ? 'good' : 'bad');
  return l;
}
// ── 計算 ──
const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const madd = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
const mscl = (A, k) => A.map((r) => r.map((v) => v * k));
const shift = (A, l) => A.map((r, i) => r.map((v, j) => v - (i === j ? l : 0)));
const mpow = (A, k) => { let R = eye(A.length); for (let i = 0; i < k; i++) R = mm(R, A); return R; };
const trace = (M) => M.reduce((s, r, i) => s + r[i], 0);
const colSums = (M) => M[0].map((_, j) => M.reduce((s, r) => s + r[j], 0));
const rankOf = (M) => rrefTol(M, 1e-9).rank;
function detN(M) {
  const A = M.map((r) => r.slice()), n = A.length; let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-12) return 0;
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; d = -d; }
    d *= A[c][c];
    for (let i = c + 1; i < n; i++) { const f = A[i][c] / A[c][c]; for (let j = c; j < n; j++) A[i][j] -= f * A[c][j]; }
  }
  return d;
}
function invN(M) {
  const n = M.length, A = M.map((r, i) => r.concat(eye(n)[i]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    [A[p], A[c]] = [A[c], A[p]];
    const pv = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= pv;
    for (let i = 0; i < n; i++) if (i !== c) { const f = A[i][c]; for (let j = 0; j < 2 * n; j++) A[i][j] -= f * A[c][j]; }
  }
  return A.map((r) => r.slice(n));
}
const realEigs = (M) => eigInfo(M).groups.flatMap((g) => Array(g.am).fill(g.re)).sort((a, b) => b - a);
const integ = (fn, N = 2000) => { let s = 0; const h = 2 * Math.PI / N; for (let k = 0; k < N; k++) s += fn((k + 0.5) * h); return s * h; };
const cpow = (z, k) => { let r = [1, 0]; for (let i = 0; i < k; i++) r = C_.mul(r, z); return r; };
const cdet2 = (M) => C_.sub(C_.mul(M[0][0], M[1][1]), C_.mul(M[0][1], M[1][0]));
// a scene = a list of step functions; each runs when the video reaches its cue
const CAM = [[0, 3.3, 11.5], [0, 3.1, 0]];
const FLAT = [[0, 10.5, 7.8], [0, 0, -0.4]];
function scene(id, title, steps, o = {}) {
  FRAG.push(['egB-' + id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    if (o.init) await o.init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// 2D plane on the floor whose grid and arrows follow a matrix
function plane2() {
  const F = flat2(0.62, 6, 8), G = F.grid(COL.a, 0.85);
  const W = { F, G, M: I2, items: [] };
  W.vec = (v, color, t) => { const a = F.arrow(v, color, t); const it = { a, v: v.slice() }; W.items.push(it); F.set(a, mulMV(W.M, v)); return it; };
  W.set = (M) => { W.M = M.map((r) => r.slice()); G.setM(M); W.items.forEach((it) => F.set(it.a, mulMV(M, it.v))); };
  W.to = (tok, M2, ms = 1500) => { const M0 = W.M.map((r) => r.slice()); return anim(tok, ms, (u) => W.set(lerpM(M0, M2, u))); };
  W.drop = (it) => { kill(it.a); if (it.a.lbl) remove(it.a.lbl); W.items = W.items.filter((x) => x !== it); };
  W.dropAll = (keep = []) => W.items.slice().forEach((it) => { if (!keep.includes(it)) W.drop(it); });
  return W;
}
const fslots = () => [slot(0, 0.4, 'ptr', -5.2), slot(0, 0.4, '', -6.1), slot(0, 0.4, '', 4.4)];
const crossZ = (a, b) => a[0] * b[1] - a[1] * b[0];
// vertical 2D board: math (x, y) → world (ox + x·s, oy + y·s, 0)
function board(ox, oy, s, xr, yr) {
  const B = { P: (x, y) => V3(ox + x * s, oy + y * s, 0) };
  line(ox + xr[0] * s, oy, ox + xr[1] * s, oy, 0, '#8a7b66'); line(ox, oy + yr[0] * s, ox, oy + yr[1] * s, 0, '#8a7b66');
  B.arrow = (v, color, from = [0, 0]) => arrow(B.P(...from), B.P(from[0] + v[0], from[1] + v[1]), color);
  return B;
}
function polyline(pts, color) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }

// ═════════════════════════ MIT 18.06 L24（8MF3pz-oYHo）Markov Matrices; Fourier Series ═════════════════════════
scene('l24-props', 'L24：Markov 矩陣的兩個性質', [
  async (tok, S) => { cap('Markov 矩陣：隨手寫一個 3×3', 'A = [.1 .01 .3; .2 .99 .3; .7 0 .4]'); S.g = mgrid(MK, -5.6, 5.4, 0, { size: 0.8, gap: 1.0, color: () => COL.a }); hd('A', -4.6, 6.2); },
  async (tok, S) => { cap('性質 1：每個元素 ≥ 0', '（機率不會是負的）'); S.g.c.flat().forEach((m) => glow(m, GREEN)); S.st = stack(-6.2, 1.8, 0.5); S.st.ok(MK.flat().every((v) => v >= 0), '性質 1：所有元素 ≥ 0 ✓'); },
  async (tok, S) => {
    S.g.clearGlow(); S.A2 = mm(MK, MK);
    cap('平方之後元素還是 ≥ 0', '我們關心的是冪次 Aᵏ');
    S.g2 = mgrid(S.A2.map((r) => r.map((v) => Math.round(v * 100) / 100)), 1.4, 5.4, 0, { size: 0.8, gap: 1.0, color: () => COL.c }); hd('A²（四捨五入）', 2.4, 6.2);
    S.st.ok(S.A2.flat().every((v) => v >= -1e-12), 'A² 的元素也都 ≥ 0 ✓');
  },
  async (tok, S) => {
    cap('性質 2：每一行加起來 = 1', '0.1 + 0.2 + 0.7 = 1'); const cs = colSums(MK);
    for (let j = 0; j < 3; j++) { S.g.col(j, GOLD); cube('Σ ' + ff(cs[j]), COL.g, [0.9, 0.45, 0.3], S.g.xs[j], 2.5, 0, 1.2); await wt(tok, 400); S.g.clearGlow(); }
    S.st.ok(cs.every((s) => near(s, 1)), '性質 2：每一行和 = 1 ✓');
  },
  async (tok, S) => { cap('A² 的每一行也加起來 = 1', 'A 的冪次全都是 Markov 矩陣'); const cs = colSums(S.A2); cs.forEach((s, j) => cube('Σ ' + ff(s), COL.g, [0.9, 0.45, 0.3], S.g2.xs[j], 2.5, 0, 1.2)); S.st.ok(cs.every((s) => near(s, 1)), 'A² 的每一行和也 = 1 ✓'); },
  async (tok, S) => { cap('要看特徵值、特徵向量和穩定狀態', 'u_k = Aᵏu₀：一直乘下去會停在哪？'); S.st.add('問題：u_k = Aᵏu₀ 最後停在哪？（steady state）', 'ptr'); },
  async (tok, S) => { cap('回想微分方程：λ = 0 給穩定狀態', 'e⁰ᵗ = 1，一直不變'); S.st.add('微分方程：λ = 0 → e⁰ᵗ = 1 不變 → 穩定'); },
  async (tok, S) => { cap('矩陣冪次：λ = 0 那一份一步就消失', '0ᵏ = 0（k ≥ 1）'); S.st.add('冪次 Aᵏ：λ = 0 → 0ᵏ = 0，一步就消失', 'bad'); },
  async (tok, S) => { cap('冪次裡真正重要的是 λ = 1', '1ᵏ = 1 永遠留著 → 穩定狀態 = λ = 1 的特徵向量'); S.st.add('λ = 1 → 1ᵏ = 1 → 穩定狀態 = 它的特徵向量', 'ptr alt'); },
]);

scene('l24-keys', 'L24：λ = 1 與其他 |λ| < 1', [
  async (tok, S) => { cap('行和 = 1 保證 λ = 1 是特徵值', '不用算 det(A − λI)'); mtx(MK, -4.8, 5.4); hd('A', -4.8, 6.5); S.st = stack(-1.6, 6.5, 0.66); S.st.ok(near(detN(shift(MK, 1)), 0, 1e-12), 'det(A − I) = 0 ✓：λ = 1 真的是特徵值'); },
  async (tok, S) => { cap('重點 1：λ = 1 是特徵值', ''); S.st.add('重點 1：λ₁ = 1', 'ptr'); },
  async (tok, S) => {
    S.ev = realEigs(MK); const oth = S.ev.filter((l) => !near(l, 1, 1e-6)); S.oth = oth;
    cap('重點 2：其他特徵值的絕對值 < 1', '這個 A：λ₂ ≈ ' + nf(oth[0], 3) + '、λ₃ ≈ ' + nf(oth[1], 3));
    S.st.add('重點 2：其他 |λ| < 1', 'ptr');
    S.st.ok(oth.length === 2 && oth.every((l) => Math.abs(l) < 1), 'λ₂ ≈ ' + nf(oth[0], 3) + '、λ₃ ≈ ' + nf(oth[1], 3) + '：|λ| < 1 ✓');
  },
  async (tok, S) => { cap('特例：可能另有 |λ| = 1', '但絕不會 |λ| &gt; 1'); S.st.add('（特例可能有 |λ| = 1，但絕不會 > 1）', 'idx'); },
  async (tok, S) => { cap('一直乘 A：u_k = Aᵏu₀', '考試很可能要你算 Aᵏ 或 Aᵏu₀'); S.st.clear(); S.st.add('λ₁ = 1；其他 |λ| < 1', 'ptr'); S.st.add('u_k = Aᵏ u₀'); },
  async (tok, S) => { cap('一般公式：每個特徵向量各乘 λᵏ', 'u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂ + c₃λ₃ᵏx₃'); S.st.add('= c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂ + c₃λ₃ᵏx₃', 'ptr'); },
  async (tok, S) => { cap('前提：要有完整的一組特徵向量', '不然 u₀ 拆不成特徵向量的組合'); S.st.add('前提：3 個獨立特徵向量（才拆得開 u₀）', 'note'); },
  async (tok, S) => {
    cap('λ₁ = 1；其他 |λ| < 1 → λᵏ → 0', '那些項隨 k 變大而消失');
    const ls = [1, ...S.oth], xs = [-5.6, -4.6, -3.6];
    const bs = ls.map((l, i) => { const m = lab.box([COL.d, COL.b, COL.c][i], [0.6, 1, 0.6]); m.position.set(xs[i], 0.5, 0); lab.world.add(m); return m; });
    ['1ᵏ', '|λ₂|ᵏ', '|λ₃|ᵏ'].forEach((t, i) => sm(t, xs[i], -0.35));
    const kl = hot('k = 0', -4.6, 3.0);
    const set = (k) => ls.forEach((l, i) => { const h = Math.max(0.02, Math.pow(Math.abs(l), k) * 2.2); bs[i].scale.y = h; bs[i].position.y = h / 2; });
    set(0); await anim(tok, 2200, (u) => { set(u * 12); txt(kl, 'k = ' + Math.round(u * 12)); });
  },
  async (tok, S) => { cap('剩下的就是穩定狀態 c₁x₁', 'u₀ 裡「x₁ 的那一份」'); S.st.add('u_∞ = c₁x₁', 'ptr alt'); },
  async (tok, S) => {
    const x1 = eigInfo(MK).groups.find((g) => near(g.re, 1, 1e-6)).vecs[0], sx = x1.reduce((a, b) => a + b, 0), xn = x1.map((v) => v / sx);
    cap('特徵向量 x₁ 的分量全都 ≥ 0', '從平均分配開始一直乘 A：收斂到 x₁');
    const xs = [3.4, 4.8, 6.2], H = 1.5;
    const bs = xs.map((x, i) => { const m = lab.box([COL.b, COL.a, COL.c][i], [1.0, 1, 1.0]); m.position.set(x, 0.5, 0); lab.world.add(m); sm('狀態 ' + (i + 1), x, -0.35); return m; });
    const ls = xs.map((x) => sm('', x, 1));
    const show = (v) => v.forEach((p, i) => { const h = Math.max(0.02, p * H); bs[i].scale.y = h; bs[i].position.y = h / 2; ls[i].position.y = h + 0.3; txt(ls[i], nf(p * 100, 1) + '%'); });
    const us = [[1 / 3, 1 / 3, 1 / 3]]; for (let k = 0; k < 20; k++) us.push(mulMV(MK, us[k]));
    await anim(tok, 2400, (u) => { const t = u * 20, k = Math.min(19, Math.floor(t)), f = t - k; show(us[k].map((v, i) => v + (us[k + 1][i] - v) * f)); });
    const okx = x1.every((v) => v * sx >= -1e-9) && nearV(xn, [0.6, 33, 0.7].map((v) => v / 34.3), 1e-6) && nearV(us[20], xn, 1e-2);
    S.st.ok(okx, 'x₁ ∝ (0.6, 33, 0.7)：分量都 ≥ 0 ✓');
  },
]);

scene('l24-why', 'L24：為什麼 λ = 1：A − I 是奇異的', [
  async (tok, S) => { cap('怎麼看出「行和 = 1」就保證 λ = 1？', ''); S.g = mgrid(MK, -5.6, 5.4, 0, { size: 0.8, gap: 1.0, color: () => COL.a }); S.h = hd('A', -4.6, 6.2); S.st = stack(-1.2, 6.3, 0.54); },
  async (tok, S) => {
    S.AI = shift(MK, 1); cap('對角線各減 1：A − I', '−0.9、−0.01、−0.6；其他元素不變');
    for (let i = 0; i < 3; i++) { S.g.set(i, i, Math.round(S.AI[i][i] * 100) / 100); P.tint(S.g.c[i][i], COL.r); await wt(tok, 300); }
    txt(S.h, 'A − I');
  },
  async (tok, S) => { cap('我們相信 A − I 是奇異的', 'A − I 奇異 ⇔ λ = 1 是特徵值'); S.st.add('猜：A − I 奇異 → λ = 1 是特徵值', 'ptr'); },
  async (tok, S) => { const cs = colSums(S.AI); cap('看行：每一行加起來變成 0', ''); cs.forEach((s, j) => cube('Σ ' + ff(s), COL.g, [0.9, 0.45, 0.3], S.g.xs[j], 2.5, 0, 1.2)); S.st.ok(cs.every((s) => near(s, 0, 1e-12)), '每一行和 = 0 ✓'); },
  async (tok, S) => { cap('奇異 ⇔ 行相依；也可以改看列', '哪個「列的組合」會得到零列？'); S.st.add('奇異 ⇔ 行相依 ⇔ 列相依'); },
  async (tok, S) => {
    cap('把三列加起來 = 零列', '1·列1 + 1·列2 + 1·列3 = (0, 0, 0)');
    for (let i = 0; i < 3; i++) { S.g.row(i, GOLD); await wt(tok, 350); }
    const rs = [0, 1, 2].map((j) => S.AI.reduce((s, r) => s + r[j], 0));
    mgrid([rs.map((v) => (Math.abs(v) < 1e-12 ? 0 : v))], -5.6, 1.3, 0, { size: 0.8, gap: 1.0, color: () => COL.d }); sm('列1 + 列2 + 列3', -4.6, 0.6);
    S.g.clearGlow(); S.st.ok(rs.every((v) => near(v, 0, 1e-12)), '三列相加 = 零列 ✓ → 列相依 → 奇異');
  },
  async (tok, S) => { const r = mulMV(T(S.AI), [1, 1, 1]); cap('(1, 1, 1) 在 left null space', '(1, 1, 1)ᵀ(A − I) = 0：它在 (A − I)ᵀ 的零空間'); S.st.ok(r.every((v) => near(v, 0, 1e-12)), '(A − I)ᵀ(1, 1, 1) = 0 ✓（left null space）'); },
  async (tok, S) => { cap('A − I 自己的零空間裡也有向量', '那就是 A 的特徵向量 x₁'); S.x = ['?', '?', '?'].map((t, i) => cube(t, COL.d, [0.8, 0.8, 0.3], -2.3, 5.4 - i, 0, 1.2)); hd('x₁', -2.3, 6.2); S.st.add('N(A − I) 裡的向量 = x₁（λ = 1 的特徵向量）'); },
  async (tok, S) => { cap('三行的某個組合 = 零行', '組合的係數就是 x₁，也就是穩定狀態'); S.x.forEach((m) => glow(m, GOLD)); S.st.add('(A − I)x₁ = 0 ⇒ Ax₁ = x₁ ⇒ x₁ = 穩定狀態', 'ptr alt'); },
]);

scene('l24-trans', 'L24：A 與 Aᵀ 特徵值相同；解出 x₁', [
  async (tok, S) => { cap('A 和 Aᵀ 的特徵值有什麼關係？', '答案：一樣'); S.st = stack(-6.2, 6.7, 0.46); S.st.add('A 和 Aᵀ 的特徵值相同', 'ptr alt'); },
  async (tok, S) => { cap('A 的特徵值：det(A − λI) = 0', ''); S.st.add('det(A − λI) = 0'); },
  async (tok, S) => { cap('行列式性質 10：det Mᵀ = det M', '把整個矩陣轉置'); S.st.add('⇔ det((A − λI)ᵀ) = 0　（性質 10）'); },
  async (tok, S) => { const a = charPoly(MK), b = charPoly(T(MK)); cap('(λI)ᵀ 還是 λI', '⇒ det(Aᵀ − λI) = 0：同一組 λ'); S.st.add('⇔ det(Aᵀ − λI) = 0'); S.st.ok(nearV(a, b, 1e-12), 'A、Aᵀ 的特徵多項式完全相同 ✓'); },
  async (tok, S) => { const r = mulMV(T(MK), [1, 1, 1]); cap('Aᵀ 的 λ = 1 特徵向量是 (1, 1, 1)', 'A 的 λ = 1 特徵向量是另一個（null space ≠ left null space）'); S.st.ok(nearV(r, [1, 1, 1], 1e-12), 'Aᵀ(1, 1, 1) = (1, 1, 1) ✓；A 的 x₁ 要另外找'); },
  async (tok, S) => {
    S.st.clear(); S.st.add('A、Aᵀ 特徵值相同；Aᵀ 的 λ = 1 特徵向量是 (1, 1, 1)', 'ptr alt');
    S.AI = shift(MK, 1); S.g = mgrid(S.AI.map((r) => r.map((v) => Math.round(v * 100) / 100)), -6.4, 1.8, 0, { size: 0.68, gap: 0.82, widths: [0.92, 0.82, 0.92], color: () => '#e7dcc8' }); sm('A − I', -5.2, 2.45);
    S.x = [cube('0.6', COL.d, [0.68, 0.68, 0.3], -3.0, 1.8, 0, 1), cube('?', COL.d, [0.68, 0.68, 0.3], -3.0, 0.98, 0, 1), cube('0.7', COL.d, [0.68, 0.68, 0.3], -3.0, 0.16, 0, 1)]; sm('x₁', -3.0, 2.45);
    const r3 = S.AI[2][0] * 0.6 + S.AI[2][2] * 0.7;
    cap('先放 0.6 和 0.7：第 3 列就成立', '0.7·0.6 + 0·x₂ − 0.6·0.7 = 0');
    S.c3 = slot(-2.3, 0.16).ok(near(r3, 0, 1e-12) && S.AI[2][1] === 0, '第 3 列：0.42 − 0.42 = 0 ✓'); S.c3.center.set(0, 0.5);
  },
  async (tok, S) => {
    const x2 = -(S.AI[0][0] * 0.6 + S.AI[0][2] * 0.7) / S.AI[0][1]; S.x2 = x2;
    cap('第 1 列：−0.54 + 0.01·x₂ + 0.21 = 0', '−0.33 + 0.01·x₂ = 0 → x₂ = 33');
    relabel(S.x[1], fmt(Math.round(x2 * 1e6) / 1e6)); glow(S.x[1], GOLD);
    const l = slot(-2.3, 1.8).ok(near(x2, 33, 1e-9), '第 1 列：x₂ = 0.33 / 0.01 = 33 ✓'); l.center.set(0, 0.5);
  },
  async (tok, S) => {
    const x = [0.6, S.x2, 0.7], r = mulMV(S.AI, x);
    cap('x₁ = (0.6, 33, 0.7)：分量全是正的', '跟理論預測的一樣');
    const l = slot(-2.3, 0.98).ok(r.every((v) => near(v, 0, 1e-9)), '第 2 列也 = 0 ✓'); l.center.set(0, 0.5);
    S.st.ok(r.every((v) => near(v, 0, 1e-9)) && x.every((v) => v > 0), '(A − I)(0.6, 33, 0.7) = 0 ✓，分量都 > 0');
  },
]);

scene('l24-calmass', 'L24：加州／麻州人口流動', [
  async (tok, S) => { cap('Markov 矩陣從哪裡來？', 'uₖ₊₁ = A uₖ，A 是 Markov'); S.s = [slot(-3.3, 5.8, 'ptr'), slot(-3.3, 5.1), slot(-3.3, 4.4), slot(-3.3, 3.7)]; S.s[0].set('uₖ₊₁ = A uₖ，A 是 Markov 矩陣'); },
  async (tok, S) => {
    cap('兩個狀態：California、Massachusetts', '看兩州的人口');
    S.H = 0.0032; const mk = (x, c) => { const m = lab.box(c, [1.5, 1, 1.3]); m.position.set(x, 0.01, 0); m.scale.y = 0.02; lab.world.add(m); return m; };
    S.bc = mk(1.6, COL.b); S.bm = mk(4.4, COL.a); sm('California', 1.6, -0.35, 0.8); sm('Massachusetts', 4.4, -0.35, 0.8);
    S.lc = sm('', 1.6, 0.4, 0.8); S.lm = sm('', 4.4, 0.4, 0.8);
    S.show = (u) => { [[S.bc, S.lc], [S.bm, S.lm]].forEach(([b, l], i) => { const h = Math.max(0.02, u[i] * S.H); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.35; txt(l, String(Math.round(u[i]))); }); S.u = u.slice(); };
  },
  async (tok, S) => { cap('元素是「搬家的比例」', '不會是負的；每行加起來 = 1：沒有人憑空消失或多出來'); S.s[1].set('比例 ≥ 0、每行和 = 1 → 總人口守恆'); },
  async (tok, S) => {
    cap('加州：90% 留下、10% 搬去麻州', '第 1 行 = (0.9, 0.1)，加起來 = 1');
    S.g = mgrid([[0.9, '?'], [0.1, '?']], 2.1, 6.3, 0, { size: 0.7, gap: 0.9, color: () => '#e7dcc8' }); hd('A', 1.2, 5.9); S.g.col(0, GOLD);
    sm('90% 留下', 1.6, 4.3); sm('10% →', 3.0, 3.9);
  },
  async (tok, S) => {
    S.A = [[0.9, 0.2], [0.1, 0.8]]; S.g.clearGlow(); S.g.set(0, 1, 0.2); S.g.set(1, 1, 0.8); S.g.col(1, GOLD);
    cap('麻州：80% 留下、20% 搬去加州', '第 2 行 = (0.2, 0.8)，加起來 = 1');
    sm('80% 留下', 4.4, 4.3); sm('← 20%', 3.0, 3.5);
    S.s[2].ok(colSums(S.A).every((s) => near(s, 1)) && S.A.flat().every((v) => v >= 0), 'A = [.9 .2; .1 .8]：Markov ✓');
  },
  async (tok, S) => { S.g.clearGlow(); cap('一開始：加州 0 人、麻州 1000 人', 'u₀ = (0, 1000)'); S.show([0, 0]); await anim(tok, 1000, (u) => S.show([0, 1000 * u])); S.s[3].set('u₀ = (0, 1000)', 'ptr alt'); },
  async (tok, S) => { cap('兩州加起來永遠是 1000', '人會搬來搬去，但總數不變'); S.s[1].set('u_Cal + u_Mass = 1000（永遠）'); },
  async (tok, S) => {
    S.flow = async (to) => {
      const from = S.u.slice(), d1 = dotBall(COL.b, 0.14), d2 = dotBall(COL.a, 0.14);
      await anim(tok, 1200, (t) => { S.show(from.map((v, i) => v + (to[i] - v) * t)); d1.position.set(1.6 + 2.8 * t, 3.4 + Math.sin(t * Math.PI) * 0.6, 0.8); d2.position.set(4.4 - 2.8 * t, 3.0 + Math.sin(t * Math.PI) * 0.4, 0.8); });
      kill(d1); kill(d2);
    };
    const u1 = mulMV(S.A, [0, 1000]); cap('一年後：乘一次 A', '1000 × 第 2 行 = (200, 800)');
    await S.flow(u1); S.s[2].ok(nearV(u1, [200, 800]), 'u₁ = A u₀ = (200, 800) ✓');
  },
  async (tok, S) => {
    const u2 = mulMV(S.A, S.u); cap('再乘一次：更多人搬去加州，也有人搬回來', '加州 > 200、麻州 < 800，總和還是 1000');
    await S.flow(u2); S.s[2].ok(nearV(u2, [340, 660]) && near(u2[0] + u2[1], 1000), 'u₂ = (340, 660)，總和 1000 ✓');
  },
  async (tok, S) => {
    S.s.forEach((l) => l.set(' ')); S.st = stack(-6.3, 6.0, 0.52); const ev = realEigs(S.A);
    cap('特徵值：λ₁ = 1（Markov 一定有）', 'trace = 1.7 → λ₂ = 1.7 − 1 = 0.7');
    S.st.add('λ₁ = 1；λ₂ = trace − 1 = 1.7 − 1 = 0.7', 'ptr');
    S.st.ok(nearV(ev, [1, 0.7], 1e-9) && near(det2(S.A), 0.7), 'det = 0.72 − 0.02 = 0.7 = λ₁λ₂ ✓');
  },
  async (tok, S) => { cap('λ₁ = 1：解 (A − I)x = 0', 'A − I = [−0.1 0.2; 0.1 −0.2] → x₁ = (2, 1)'); S.st.ok(nearV(mulMV(shift(S.A, 1), [2, 1]), [0, 0], 1e-12), 'x₁ = (2, 1)：(A − I)x₁ = 0 ✓，分量為正'); },
  async (tok, S) => {
    const ss = [2000 / 3, 1000 / 3]; cap('直接跳到無限遠：穩定狀態 = c₁x₁', '(2, 1) 加起來 3 → 1000 人分成 2/3、1/3');
    const from = S.u.slice(); await anim(tok, 1500, (t) => S.show(from.map((v, i) => v + (ss[i] - v) * t)));
    S.st.ok(nearV(mulMV(S.A, ss), ss, 1e-9), '穩定狀態 = 1000·(2/3, 1/3) ≈ (667, 333) ✓');
  },
  async (tok, S) => { cap('λ₂ = 0.7：解 (A − 0.7I)x = 0', 'A − 0.7I = [0.2 0.2; 0.1 0.1] → x₂ = (−1, 1)'); S.st.ok(nearV(mulMV(shift(S.A, 0.7), [-1, 1]), [0, 0], 1e-12), 'x₂ = (−1, 1)：(A − 0.7I)x₂ = 0 ✓'); },
  async (tok, S) => { cap('有限步數：u_k 的公式', 'u_k = c₁·1ᵏ·(2, 1) + c₂·0.7ᵏ·(−1, 1)'); S.st.add('u_k = c₁·1ᵏ·(2, 1) + c₂·0.7ᵏ·(−1, 1)', 'ptr'); },
  async (tok, S) => {
    const c = mulMV(inv2([[2, -1], [1, 1]]), [0, 1000]); S.c = c;
    cap('k = 0：要等於 u₀ = (0, 1000)', 'c₁(2, 1) + c₂(−1, 1) = (0, 1000) → c₁ = 1000/3、c₂ = 2000/3');
    S.st.ok(near(c[0], 1000 / 3) && near(c[1], 2000 / 3), 'c₁ = 1000/3、c₂ = 2000/3 ✓');
  },
  async (tok, S) => {
    cap('0.7ᵏ 那一項逐漸消失', '從 (0, 1000) 一路靠近 (667, 333)');
    const uk = (k) => [S.c[0] * 2 - S.c[1] * Math.pow(0.7, k), S.c[0] + S.c[1] * Math.pow(0.7, k)];
    const kl = hot('k = 0', 3.0, 5.0); S.show(uk(0));
    await anim(tok, 2400, (t) => { const k = t * 15; S.show(uk(k)); txt(kl, 'k = ' + Math.round(k)); });
    S.st.ok(nearV(uk(0), [0, 1000], 1e-9), '0.7ᵏ → 0：u_k → (1000/3)(2, 1) ✓');
  },
  async (tok, S) => { cap('有些書用列向量 u·A', '那時是「每一列加起來 = 1」：只是轉置'); S.st.add('別本書：列向量乘在左邊 → 每「列」和 = 1（轉置）', 'idx'); },
]);

scene('l24-ortho', 'L24：標準正交基底展開 xᵢ = qᵢᵀv', [
  async (tok, S) => {
    cap('標準正交基底 q₁, …, qₙ', 'qᵢᵀqⱼ = 0（i ≠ j）、qᵢᵀqᵢ = 1');
    S.Sp = space3(2.6, 2.4, 0, 1, 2.4); const R = rodrigues([1, 2, 2], 0.7); S.q = [0, 1, 2].map((j) => R.map((r) => r[j]));
    S.qa = S.q.map((v, i) => S.Sp.arrow(v, [COL.d, COL.r, COL.a][i], 'q' + '₁₂₃'[i])); S.st = stack(-6.6, 6.6, 0.5);
  },
  async (tok, S) => { S.v = [1.2, 0.8, 1.6]; S.Sp.arrow(S.v, COL.k, 'v'); cap('任何向量 v 都能用這組基底展開', 'v = x₁q₁ + x₂q₂ + x₃q₃'); S.st.add('v = x₁q₁ + x₂q₂ + x₃q₃', 'ptr'); },
  async (tok, S) => { cap('x₁ 是多少？', '基底是標準正交 → 應該有很簡單的公式'); S.st.add('x₁ = ?', 'ptr alt'); },
  async (tok, S) => { cap('整條式子跟 q₁ 做內積', 'q₁ᵀv = x₁q₁ᵀq₁ + x₂q₁ᵀq₂ + x₃q₁ᵀq₃'); S.qa[0].glow(GOLD); S.st.add('兩邊都跟 q₁ 做內積'); },
  async (tok, S) => { const d = [dot(S.q[0], S.q[1]), dot(S.q[0], S.q[2]), dot(S.q[0], S.q[0])]; cap('q₁ 跟 q₂、q₃ 的內積 = 0', 'q₁ 跟自己的內積 = 1'); S.st.ok(near(d[0], 0, 1e-12) && near(d[1], 0, 1e-12) && near(d[2], 1, 1e-12), 'q₁ᵀq₂ = 0、q₁ᵀq₃ = 0、q₁ᵀq₁ = 1 ✓'); },
  async (tok, S) => {
    const x = S.q.map((q) => dot(q, S.v)); S.x = x;
    cap('只剩一項：x₁ = q₁ᵀv', 'x = (' + x.map((v) => nf(v)).join(', ') + ')：三段接起來就是 v');
    let base = [0, 0, 0];
    for (let i = 0; i < 3; i++) { const a = S.Sp.arrow(scl(S.q[i], 0.001), [COL.d, COL.r, COL.a][i]); const b0 = base.slice(); await anim(tok, 600, (t) => S.Sp.set(a, scl(S.q[i], x[i] * t), b0)); base = addv(base, scl(S.q[i], x[i])); }
    S.st.ok(nearV(base, S.v, 1e-9), 'x₁ = q₁ᵀv = ' + nf(x[0]) + '；x₁q₁ + x₂q₂ + x₃q₃ = v ✓');
  },
  async (tok, S) => { cap('矩陣語言：Qx = v', 'Q 的行就是 q₁, q₂, q₃'); S.st.add('矩陣：Q x = v'); },
  async (tok, S) => { S.Q = T(S.q); cap('x = Q⁻¹v，而 Q⁻¹ 就是 Qᵀ', '行標準正交 ⇒ QᵀQ = I：不必真的求反矩陣'); S.st.add('x = Q⁻¹v = Qᵀv', 'ptr'); S.st.ok(nearM(mm(T(S.Q), S.Q), I3, 1e-12), 'QᵀQ = I ✓'); },
  async (tok, S) => { const x = mulMV(T(S.Q), S.v); cap('x 的第一個分量 = Qᵀ 第一列 · v', '= q₁ᵀv：跟剛剛一樣'); S.st.ok(near(x[0], S.x[0], 1e-12), '(Qᵀv)₁ = q₁ᵀv = ' + nf(x[0]) + ' ✓'); },
], { cam: [[0, 0, 0], [0, 2.4, 0]], init: () => cam(30, 22, 11.5, [0, 2.4, 0]) });

const FX0 = -5.6, FSX = 11.2 / (2 * Math.PI), FY0 = 2.4, FSY = 0.75;
const fp = (x, y) => V3(FX0 + x * FSX, FY0 + y * FSY, 0);
function fcurve(fn, color, n = 160) { const pts = []; for (let k = 0; k <= n; k++) { const x = k / n * 2 * Math.PI; pts.push(fp(x, fn(x))); } return polyline(pts, color); }
function farea(fn, c1, c2, n = 60) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) { const x = (k + 0.5) / n * 2 * Math.PI, v = fn(x), h = Math.abs(v) * FSY; const m = new THREE.Mesh(new THREE.BoxGeometry(11.2 / n * 0.9, Math.max(h, 0.001), 0.04), new THREE.MeshBasicMaterial({ color: v >= 0 ? c1 : c2, transparent: true, opacity: 0.45 })); m.position.set(FX0 + x * FSX, FY0 + (v >= 0 ? h / 2 : -h / 2), -0.1); g.add(m); }
  lab.world.add(g); return g;
}
const F24 = (x) => 0.5 + 1.2 * Math.cos(x) + 0.8 * Math.sin(x) + 0.4 * Math.cos(2 * x);
scene('l24-fourier', 'L24：Fourier 級數＝函數空間的正交展開', [
  async (tok, S) => {
    cap('Fourier 級數：把函數寫成 sin、cos 的組合', 'f(x) = a₀ + a₁cos x + b₁sin x + a₂cos 2x + b₂sin 2x + …');
    line(FX0, FY0, FX0 + 11.4, FY0, 0, '#a8987f'); sm('0', FX0, FY0 - 0.3); sm('π', 0, FY0 - 0.3); sm('2π', FX0 + 11.2, FY0 - 0.3);
    S.s = [slot(0, 6.4, 'ptr'), slot(0, 5.85), slot(0, 5.3)];
  },
  async (tok, S) => { cap('跟上面的向量展開比：這次有無限多項', '但「互相正交」這個關鍵性質還在'); S.s[0].set('無限多項，但 1、cos x、sin x、… 互相正交', 'ptr'); },
  async (tok, S) => {
    cap('Fourier 的想法：函數也是向量', '向量 v → 函數 f(x)；q₁, q₂, … → 1, cos x, sin x, cos 2x, …');
    S.basis = [];
    const fs = [[() => 1, COL.k, '1'], [Math.cos, COL.d, 'cos x'], [Math.sin, COL.r, 'sin x'], [(x) => Math.cos(2 * x), COL.c, 'cos 2x']];
    for (const [fn, c, nm] of fs) { S.basis.push(fcurve(fn, c), sm(nm, FX0 + 0.25 + S.basis.length * 0.8, FY0 + fn(0.05) * FSY + 0.3)); await wt(tok, 450); }
  },
  async (tok, S) => { cap('離開有限維：函數空間是無限維', '基底 1, cos x, sin x, cos 2x, sin 2x, …（無限多個）'); S.s[1].set('函數空間：無限維；基底 1, cos x, sin x, cos 2x, …'); },
  async (tok, S) => { S.basis.forEach((o) => kill(o)); cap('「正交」是什麼意思？先回想向量', 'vᵀw = v₁w₁ + v₂w₂ + … + vₙwₙ = 0'); S.s[1].set('向量的內積：vᵀw = v₁w₁ + … + vₙwₙ'); },
  async (tok, S) => {
    cap('兩個函數 f、g：不是 n 個點，是一整條曲線', '（示意）f = 0.5 + 1.2cos x + 0.8sin x + 0.4cos 2x、g = cos x');
    S.cf = fcurve(F24, COL.k); S.cg = fcurve(Math.cos, COL.d); S.lf = sm('f（示意）', FX0 + 0.6, FY0 + F24(0) * FSY + 0.35); S.lg = sm('g = cos x', FX0 + 3.0, FY0 - 0.6);
  },
  async (tok, S) => { cap('每個 x 都乘 f(x)g(x)，再把「加總」換成積分', 'f·g = ∫ f(x) g(x) dx'); S.s[1].set('每個 x 相乘 f(x)g(x)，加總 → 積分'); S.s[2].set('f·g = ∫ f(x) g(x) dx', 'ptr alt'); },
  async (tok, S) => {
    cap('sin、cos 的週期都是 2π → 從 0 積到 2π', 'f(x + 2π) = f(x)');
    S.s[2].set('f·g = ∫₀^(2π) f(x) g(x) dx（週期 2π）', 'ptr alt');
    S.rods = [rod(COL.g, 0.03).setW(fp(0, -2.4), fp(0, 2.6)), rod(COL.g, 0.03).setW(fp(2 * Math.PI, -2.4), fp(2 * Math.PI, 2.6))];
  },
  async (tok, S) => {
    [S.cf, S.cg, S.lf, S.lg].forEach((o) => kill(o));
    cap('檢查：∫₀^(2π) sin x cos x dx', '= [½ sin²x]₀^(2π) = 0：正負面積抵消');
    S.c1 = fcurve(Math.sin, COL.r); S.c2 = fcurve(Math.cos, COL.d); S.ar = farea((x) => Math.sin(x) * Math.cos(x), COL.d, COL.r);
    S.s[1].ok(near(integ((x) => Math.sin(x) * Math.cos(x)), 0, 1e-9), '∫₀^(2π) sin x cos x dx = 0 ✓ → 正交');
  },
  async (tok, S) => {
    cap('其他每一對也都正交', '（用三角恆等式就能算）');
    const z = [(x) => Math.cos(x) * Math.cos(2 * x), (x) => Math.sin(x) * Math.sin(2 * x), (x) => Math.cos(x), (x) => Math.sin(x) * Math.cos(2 * x)].every((fn) => near(integ(fn), 0, 1e-9));
    S.s[2].ok(z, '∫cos x·cos 2x = ∫sin x·sin 2x = ∫1·cos x = ∫sin x·cos 2x = 0 ✓');
  },
  async (tok, S) => {
    [S.c1, S.c2, S.ar].forEach((o) => kill(o));
    S.cf = fcurve(F24, COL.k); const a0 = integ(F24) / (2 * Math.PI);
    rod(COL.b, 0.025).setW(fp(0, a0), fp(2 * Math.PI, a0)); sm('平均值', FX0 + 11.6, FY0 + a0 * FSY);
    cap('a₁ = ？：f 裡有多少 cos x', 'a₀ 最簡單：a₀ = f 的平均值');
    S.s[1].set('a₁ = ？（f 裡有多少 cos x）'); S.s[2].ok(near(a0, 0.5, 1e-9), 'a₀ = (1/2π)∫ f dx = 0.5 = 平均值 ✓');
  },
  async (tok, S) => { cap('跟向量一樣：整條式子跟 cos x 做內積', '乘上 cos x，再從 0 積到 2π'); S.ar = farea((x) => F24(x) * Math.cos(x), COL.d, COL.r); S.s[1].set('兩邊乘 cos x，再積分'); },
  async (tok, S) => { const c2 = integ((x) => Math.cos(x) ** 2); cap('其他項全是 0，只剩 a₁∫cos²x dx', '∫₀^(2π) cos²x dx = π（cos x 長度的平方）'); S.s[2].ok(near(c2, Math.PI, 1e-9), '∫₀^(2π) cos²x dx = π ✓'); },
  async (tok, S) => { const a1 = integ((x) => F24(x) * Math.cos(x)) / Math.PI; cap('a₁ = (1/π)∫₀^(2π) f(x) cos x dx', '這個示意例子算出 ' + nf(a1, 4) + '：正是 cos x 前面的係數'); S.s[1].set('a₁ = (1/π)∫₀^(2π) f(x) cos x dx', 'ptr alt'); S.s[2].ok(near(a1, 1.2, 1e-9), 'a₁ = 1.2 ✓（示意 f 裡 cos x 的係數）'); },
  async (tok, S) => { cap('就是正交基底的展開', '同 x₁ = q₁ᵀv；cos x 長度² 是 π，所以除以 π'); S.s[0].set('Fourier 係數 = 正交展開（再除以基底長度²）', 'ptr alt'); },
]);

// ═════════════════════════ MIT 18.06 L24b（sFxA8eIS6tA）Quiz 2 Review ═════════════════════════
scene('qr-scope', 'L24b：小考 2 的範圍', [
  async (tok, S) => { cap('第 2 次小考範圍：第 4 章 正交', ''); S.st = stack(-5.6, 6.2, 0.62); S.hl = (l) => { S.st.ls.forEach((x) => { if (x.element.className === 'lab-label ptr alt') x.element.className = 'lab-label'; }); l.element.className = 'lab-label ptr alt'; }; S.hl(S.st.add('第 4 章 正交')); },
  async (tok, S) => { const Q = rot2(0.6); cap('行是標準正交向量 → 叫 Q', 'QᵀQ = I：內積不是 1 就是 0'); S.hl(S.st.add('Q 的行標準正交 ⇔ QᵀQ = I')); S.st.ok(nearM(mm(T(Q), Q), I2, 1e-12), '例：旋轉矩陣 QᵀQ = I ✓'); },
  async (tok, S) => { cap('投影到直線、子空間 → 最小平方', 'Ax = b 無解時找最好的 x̂'); S.hl(S.st.add('投影（直線、子空間）、最小平方 AᵀAx̂ = Aᵀb')); },
  async (tok, S) => { cap('Gram–Schmidt：獨立向量 → 標準正交', '減掉已有方向上的投影；會有很多根號'); S.hl(S.st.add('Gram–Schmidt：獨立基底 → 標準正交基底')); },
  async (tok, S) => { cap('第 5 章 行列式：性質 1–3 定義', '性質 4–10 是推論'); S.hl(S.st.add('第 5 章 行列式：性質 1–3、推論 4–10')); },
  async (tok, S) => { cap('大公式 n! 項：一半正、一半負', '還有 cofactor 公式 → A⁻¹ 的公式'); S.hl(S.st.add('大公式（n! 項）、cofactor、A⁻¹ = Cᵀ/det A')); },
  async (tok, S) => { cap('第 6 章只考 6.1、6.2', 'Ax = λx、AS = SΛ（n 個獨立特徵向量）、Aᵏ'); S.hl(S.st.add('6.1–6.2：Ax = λx、AS = SΛ、Aᵏ = SΛᵏS⁻¹')); },
  async (tok, S) => { cap('微分方程（6.3）不在這次', '留到第 3 次小考'); S.st.add('6.3 微分方程：不在這次範圍', 'bad'); },
]);

const QA = [2, 1, 2], QP = mscl([[4, 2, 4], [2, 1, 2], [4, 2, 4]], 1 / 9);
scene('qr-proj', 'L24b：投影到直線 a = (2, 1, 2)', [
  async (tok, S) => { cap('第 1 題：a = (2, 1, 2)', '求投影到「通過 a 的直線」的投影矩陣 P'); S.Sp = space3(0, 1.8, 0, 0.75, 2.6); S.line = S.Sp.line(QA, COL.g, 3.4); S.a = S.Sp.arrow(QA, COL.g, 'a'); S.st = stack(-6.4, 6.4, 0.52); },
  async (tok, S) => {
    const b = [1, 2, 0], p = scl(QA, dot(QA, b) / dot(QA, QA)); cap('把任何 b 投影到這條線上', '（示意 b = (1, 2, 0)）P 就是「乘上 b 就得到投影」的矩陣');
    S.Sp.arrow(b, COL.k, 'b（示意）'); const pa = S.Sp.arrow(scl(p, 0.001), COL.b, 'p'); await anim(tok, 1000, (t) => S.Sp.set(pa, scl(p, t))); rod(COL.r, 0.02).setW(S.Sp.w(b), S.Sp.w(p));
  },
  async (tok, S) => { cap('公式：P = A(AᵀA)⁻¹Aᵀ', 'A 只有一行 a → P = a aᵀ / aᵀa'); S.st.add('P = a aᵀ / (aᵀa)', 'ptr'); },
  async (tok, S) => {
    const P2 = mm(QP, QP), Pf = QA.map((x) => QA.map((y) => x * y / dot(QA, QA)));
    cap('aᵀa = 9；a aᵀ = [4 2 4; 2 1 2; 4 2 4]', 'P = (1/9)[4 2 4; 2 1 2; 4 2 4]');
    S.st.add('aᵀa = 4 + 1 + 4 = 9'); S.st.add('P = (1/9)[4 2 4; 2 1 2; 4 2 4]');
    S.st.ok(nearM(Pf, QP, 1e-12) && nearM(P2, QP, 1e-12), 'P² = P ✓（投影兩次跟一次一樣）');
  },
  async (tok, S) => { cap('P 的 rank？', '每一行都是 a 的倍數 → rank 1'); S.st.ok(rankOf(QP) === 1, 'rank P = 1 ✓'); },
  async (tok, S) => { S.line.material.color.set(COL.b); cap('行空間就是這條直線', 'C(P) = 通過 (2, 1, 2) 的直線'); S.st.add('C(P) = 通過 a = (2, 1, 2) 的直線'); },
  async (tok, S) => {
    cap('奇異 → 有 λ = 0；零空間 2 維 → λ = 0 重複兩次', '跟 a 垂直的整個平面都被送到 0');
    S.Sp.plane([1, -2, 0], [1, 0, -1], COL.c, 0.18);
    S.st.ok(3 - rankOf(QP) === 2 && nearV(mulMV(QP, [1, -2, 0]), [0, 0, 0], 1e-12) && nearV(mulMV(QP, [1, 0, -1]), [0, 0, 0], 1e-12), '零空間維度 = 3 − 1 = 2 → λ = 0, 0 ✓');
  },
  async (tok, S) => { const ev = realEigs(QP); cap('第三個特徵值：trace = 9/9 = 1', '特徵值總和 = trace'); S.st.ok(nearV(ev, [1, 0, 0], 1e-6) && near(trace(QP), 1, 1e-12), 'λ = 1, 0, 0；總和 = trace = 1 ✓'); },
  async (tok, S) => { S.a.glow(GOLD); cap('λ = 1 的特徵向量：不會動的那個 = a', 'Pa = a aᵀa / aᵀa = a'); S.st.ok(nearV(mulMV(QP, QA), QA, 1e-12), 'Pa = a ✓ → a 是 λ = 1 的特徵向量'); },
], { cam: [[3.5, 5.0, 10.5], [0, 2.4, 0]] });

scene('qr-iter', 'L24b：uₖ₊₁ = P uₖ', [
  async (tok, S) => { cap('解 uₖ₊₁ = P uₖ，u₀ = (9, 9, 0)', '求 u_k'); S.Sp = space3(3.4, 0.8, 0, 0.28, 3.4); S.Sp.line(QA, COL.g, 12); S.Sp.arrow(QA, COL.g, 'a'); S.Sp.arrow([9, 9, 0], COL.k, 'u₀'); S.st = stack(-6.4, 6.4, 0.52); },
  async (tok, S) => {
    const u1 = mulMV(QP, [9, 9, 0]); S.u1 = u1; cap('u₁ = P u₀ = a (aᵀu₀) / (aᵀa)', 'aᵀu₀ = 18 + 9 = 27、aᵀa = 9 → 3a = (6, 3, 6)');
    const a = S.Sp.arrow(scl(u1, 0.001), COL.b, 'u₁'); await anim(tok, 1200, (t) => S.Sp.set(a, scl(u1, t))); rod(COL.r, 0.02).setW(S.Sp.w([9, 9, 0]), S.Sp.w(u1));
    S.st.ok(nearV(u1, [6, 3, 6], 1e-12), 'u₁ = 27/9 · a = 3a = (6, 3, 6) ✓');
  },
  async (tok, S) => { const u2 = mulMV(QP, S.u1); cap('u₂ = P u₁：已經在線上了，不用再算', '投影一次就夠：u_k = (6, 3, 6)'); S.st.ok(nearV(u2, [6, 3, 6], 1e-12), 'u₂ = P u₁ = (6, 3, 6)，之後都一樣 ✓'); },
  async (tok, S) => { cap('投影矩陣：P² = P、P³ = P', '所以不用把特徵值、特徵向量全部算出來'); S.st.ok(nearM(mpow(QP, 3), QP, 1e-12), 'P² = P³ = P ✓'); },
  async (tok, S) => { cap('換成一般矩陣怎麼辦？', 'u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂ + c₃λ₃ᵏx₃'); S.st.add('一般矩陣：u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂ + c₃λ₃ᵏx₃', 'ptr'); },
  async (tok, S) => { cap('要做的事：求特徵值、特徵向量、再求 c', 'c 由 u₀ = c₁x₁ + c₂x₂ + c₃x₃ 決定'); S.st.add('工作：λ、x、c（用 u₀ 對出 c）'); },
  async (tok, S) => {
    const X = [[1, 1, 2], [-2, 0, 1], [0, -1, 2]], c = mulMV(invN(X), [9, 9, 0]);
    cap('投影矩陣：λ = 0, 0, 1', '兩個 λ = 0 的項直接丟掉，只剩 c₃x₃ = 3a = (6, 3, 6)');
    S.st.add('λ = 0：x₁ = (1, −2, 0)、x₂ = (1, 0, −1)'); S.st.add('λ = 1：x₃ = a');
    S.st.ok(nearV(c, [-3, 6, 3], 1e-9), 'u₀ = −3x₁ + 6x₂ + 3a ✓ → u_k = 3a = (6, 3, 6)');
  },
], { cam: [[3.5, 5.0, 10.5], [0, 2.4, 0]] });

scene('qr-lsq', 'L24b：最小平方——過原點的直線', [
  async (tok, S) => { cap('第 2 題：用過原點的直線去擬合資料點', ''); line(-5.8, 0.4, -1.7, 0.4, 0, '#8a7b66'); line(-5.8, 0.4, -5.8, 5.0, 0, '#8a7b66'); S.Q = (t, y) => V3(-5.8 + t * 1.1, 0.4 + y * 0.5, 0); sm('t', -1.7, 0.1); sm('y', -5.8, 5.2); S.st = stack(-0.6, 6.3, 0.52); },
  async (tok, S) => { cap('三個點：(1, 4)、(2, 5)、(3, 8)', ''); [[1, 4], [2, 5], [3, 8]].forEach(([t, y]) => { const b = dotBall(COL.r, 0.12); b.position.copy(S.Q(t, y)); sm('(' + t + ', ' + y + ')', S.Q(t, y).x + 0.55, S.Q(t, y).y); }); },
  async (tok, S) => { cap('y = Dt：只有一個未知數 D', '過原點 → 沒有常數項 C'); S.ln = rod(COL.k, 0.025); S.setD = (D) => S.ln.setW(S.Q(0, 0), S.Q(3.4, 3.4 * D)); S.setD(2); S.lt = sm('y = Dt（示意 D = 2）', -2.6, 4.0); },
  async (tok, S) => { cap('希望三個點都在線上：D = 4、2D = 5、3D = 8', '三個方程式要的 D 不一樣 → 無解'); S.st.add('D = 4、2D = 5、3D = 8'); S.st.add('需要 D = 4、2.5、8/3：沒有共同解 ✘', 'bad'); },
  async (tok, S) => { cap('寫成 Ax = b：A 只有一行', 'A = (1, 2, 3)ᵀ、x = D、b = (4, 5, 8)'); S.st.add('A = [1; 2; 3]、b = (4, 5, 8)：A D = b', 'ptr'); },
  async (tok, S) => { cap('最好的 D̂：AᵀA D̂ = Aᵀb', '這就是投影到一條線的公式'); S.st.add('AᵀA D̂ = Aᵀb'); },
  async (tok, S) => {
    const a = [1, 2, 3], b = [4, 5, 8], D = dot(a, b) / dot(a, a); S.D = D;
    cap('AᵀA = 14；Aᵀb = 4 + 10 + 24 = 38', 'AᵀA = 1 + 4 + 9 = 14 → D̂ = 38/14 = 19/7 ≈ 2.71');
    txt(S.lt, 'y = (19/7) t'); await anim(tok, 1200, (t) => S.setD(2 + (D - 2) * t));
    S.st.ok(dot(a, a) === 14 && dot(a, b) === 38 && near(D, 19 / 7), '14 D̂ = 38 → D̂ = 19/7 ✓');
  },
  async (tok, S) => { cap('剛剛把「哪個向量」投影到「哪條線」？', '最小平方有兩張圖'); S.st.add('兩張圖：① t–y 平面上的直線　② 向量投影'); },
  async (tok, S) => {
    const a = [1, 2, 3], b = [4, 5, 8], p = scl(a, S.D), e = b.map((v, i) => v - p[i]);
    cap('第二張圖：b 投影到 A 的行空間', '在 R³ 裡，行空間就是通過 (1, 2, 3) 的直線');
    S.st.ok(near(dot(e, a), 0, 1e-12), 'e = b − D̂a 跟 a 垂直：eᵀa = 0 ✓');
  },
  async (tok, S) => { cap('投影在 b 所在的 R³ 裡發生', 't–y 圖上看不到投影；D̂ 就是那個 x̂'); S.st.add('p = D̂·(1, 2, 3) = (19/7, 38/7, 57/7)', 'ptr alt'); },
]);

scene('qr-gs', 'L24b：Gram–Schmidt：a₁ = (1, 2, 3)、a₂ = (1, 1, 1)', [
  async (tok, S) => { cap('Gram–Schmidt：兩個向量變正交', 'a₁ = (1, 2, 3)、a₂ = (1, 1, 1)：在它們張成的平面裡找兩個正交向量'); S.Sp = space3(4.0, 0.8, 0, 0.62, 2.6); S.a1 = S.Sp.arrow([1, 2, 3], COL.d, 'a₁'); S.Sp.arrow([1, 1, 1], COL.a, 'a₂'); S.st = stack(-6.4, 6.4, 0.52); },
  async (tok, S) => { cap('兩個向量張成一個平面 = A 的行空間', '要找這個平面的正交基底'); S.Sp.plane([1, 2, 3], [1, 1, 1], COL.c, 0.16); S.st.add('平面 = C(A)，A = [a₁ a₂]'); },
  async (tok, S) => { S.a1.glow(GOLD); cap('答案不只一個；Gram–Schmidt：第一個留著', '先保留 a₁'); S.st.add('第一個向量：a₁ 不動'); },
  async (tok, S) => { cap('第二個：a₂ 減掉它在 a₁ 方向的投影', 'B = a₂ − (a₁ᵀa₂ / a₁ᵀa₁) a₁'); S.st.add('B = a₂ − (a₁ᵀa₂ / a₁ᵀa₁) a₁', 'ptr'); },
  async (tok, S) => {
    const a1 = [1, 2, 3], p = scl(a1, 6 / 14), Bv = [1, 1, 1].map((v, i) => v - p[i]); S.Bv = Bv;
    cap('a₂ 投影到 a₁ 的直線上：那是已經有的方向', '把它減掉，留下垂直的部分');
    const pa = S.Sp.arrow(scl(p, 0.001), COL.g, '投影'); await anim(tok, 900, (t) => S.Sp.set(pa, scl(p, t)));
    rod(COL.r, 0.02).setW(S.Sp.w(p), S.Sp.w([1, 1, 1]));
    const ba = S.Sp.arrow(scl(Bv, 0.001), COL.b, 'B'); await anim(tok, 900, (t) => S.Sp.set(ba, scl(Bv, t)));
  },
  async (tok, S) => { cap('代數字：a₁ᵀa₂ = 6、a₁ᵀa₁ = 14', 'B = (1, 1, 1) − (6/14)(1, 2, 3) = (4/7, 1/7, −2/7)'); S.st.add('B = (1, 1, 1) − (6/14)(1, 2, 3) = ' + vs(S.Bv)); S.st.ok(near(dot([1, 2, 3], S.Bv), 0, 1e-12), 'a₁ᵀB = 4/7 + 2/7 − 6/7 = 0 ✓'); },
  async (tok, S) => { cap('只要求「正交」，不用除以長度', '所以不必開根號'); S.st.add('只要正交：不必單位化（免開根號）', 'idx'); },
], { cam: [[3.5, 5.0, 10.5], [0, 2.4, 0]] });

scene('qr-eig4', 'L24b：4×4 矩陣的特徵值', [
  async (tok, S) => { cap('第 3 題：4×4 矩陣，特徵值 λ₁, λ₂, λ₃, λ₄', ''); S.st = stack(-6.2, 6.2, 0.6); S.st.add('A：4×4，特徵值 λ₁, λ₂, λ₃, λ₄', 'ptr'); },
  async (tok, S) => { cap('什麼時候 A 可逆？', '沒有任何 λ = 0（λ = 0 → Ax = 0 有非零解）'); S.st.add('可逆 ⇔ 沒有 λ = 0'); },
  async (tok, S) => { cap('det A⁻¹ = A⁻¹ 特徵值的乘積', 'A⁻¹ 的特徵值是 1/λ'); S.st.add('det A⁻¹ = (1/λ₁)(1/λ₂)(1/λ₃)(1/λ₄)'); },
  async (tok, S) => { cap('trace(A + I) = 特徵值總和', '加 I 讓每個特徵值都 +1'); S.st.add('trace(A + I) = (λ₁+1) + … + (λ₄+1) = Σλ + 4'); },
  async (tok, S) => {
    const A = [[2, 1, 0, 3], [0, -1, 2, 1], [0, 0, 3, 1], [0, 0, 0, 0.5]], ev = [2, -1, 3, 0.5];
    cap('加 I 把整個 trace 往上推 4', '（示意）用一個三角矩陣驗算：λ = 2, −1, 3, 0.5');
    mtx(A, 3.4, 2.3); sm('示意 A', 3.4, 3.5);
    const dInv = detN(invN(A)), tr = trace(madd(A, eye(4)));
    S.st.ok(near(dInv, 1 / ev.reduce((a, b) => a * b, 1), 1e-9) && near(tr, ev.reduce((a, b) => a + b, 0) + 4, 1e-12), '示意：det A⁻¹ = −1/3、trace(A + I) = 8.5 ✓');
  },
]);

const TRI = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (Math.abs(i - j) <= 1 ? 1 : 0)));
scene('qr-tri', 'L24b：三對角全 1 矩陣的行列式', [
  async (tok, S) => { cap('行列式題：三對角、全是 1', 'A₄ = 對角線、上下各一條都是 1'); S.g = mgrid(TRI(4), -6.2, 6.2, 0, { size: 0.55, gap: 0.66, color: () => COL.a }); hd('A₄', -5.2, 6.8); S.st = stack(-3.4, 6.3, 0.52); },
  async (tok, S) => { cap('用 cofactor 找出遞迴式', 'Dₙ = a·Dₙ₋₁ + b·Dₙ₋₂，找出 a、b（Dₙ = det Aₙ）'); S.st.add('Dₙ = a·Dₙ₋₁ + b·Dₙ₋₂：a, b = ?', 'ptr'); },
  async (tok, S) => { cap('沿第一列展開：1 × 它的 cofactor', '刪掉第 1 列第 1 行 → 剩下就是 Dₙ₋₁'); glow(S.g.c[0][0], GOLD); for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) glow(S.g.c[i][j], GREEN); S.st.add('第 1 項：1 · Dₙ₋₁'); },
  async (tok, S) => { S.g.clearGlow(); glow(S.g.c[0][1], RED); cap('(1, 2) 位置：cofactor 要帶負號', '(−1)¹⁺² = −1'); S.st.add('第 2 項：(1, 2) 的 cofactor 帶「−」'); },
  async (tok, S) => {
    cap('那個小行列式再沿第一行展開', '只剩 1 × Dₙ₋₂，整體是負的');
    const ok = [3, 4, 5, 6].every((n) => near(detN(TRI(n)), detN(TRI(n - 1)) - detN(TRI(n - 2)), 1e-9));
    S.st.add('Dₙ = Dₙ₋₁ − Dₙ₋₂（a = 1、b = −1）', 'ptr alt'); S.st.ok(ok, 'n = 3…6 直接算行列式驗證 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); cap('起點：D₁ = 1、D₂ = 0', '|1 1; 1 1| = 0'); S.st.ok(near(detN(TRI(1)), 1) && near(detN(TRI(2)), 0), 'D₁ = 1、D₂ = 0 ✓'); },
  async (tok, S) => { cap('寫成一階系統', '[Dₙ; Dₙ₋₁] = [1 −1; 1 0][Dₙ₋₁; Dₙ₋₂]'); S.st.add('[Dₙ; Dₙ₋₁] = [1 −1; 1 0] [Dₙ₋₁; Dₙ₋₂]'); },
  async (tok, S) => { const cp = charPoly([[1, -1], [1, 0]]); cap('特徵值：det [1−λ −1; 1 −λ] = 0', 'λ² − λ + 1 = 0'); S.st.ok(nearV(cp, [1, -1, 1]), 'λ² − λ + 1 = 0 ✓'); },
  async (tok, S) => { cap('不是 Fibonacci（多了一個負號）', 'D_n 會變大？趨近 0？還是繞圈？'); S.st.add('穩定？爆掉？週期？→ 看 |λ|', 'idx'); },
  async (tok, S) => {
    const r = roots([1, -1, 1]); S.r = r; cap('公式解：λ = (1 ± √(1 − 4))/2', 'λ = (1 ± √3 i)/2：複數');
    S.st.ok(r.every((z) => near(z[0], 0.5, 1e-6) && near(Math.abs(z[1]), Math.sqrt(3) / 2, 1e-6)), 'λ = 1/2 ± (√3/2) i ✓');
  },
  async (tok, S) => {
    S.st.clear(); S.st = stack(-3.4, 6.3, 0.52);
    cap('|λ| 是多少？', '實部² + 虛部² = 1/4 + 3/4 = 1：在單位圓上');
    S.O = [3.6, 2.0]; S.R = 1.5; const pt = (z) => V3(S.O[0] + z[0] * S.R, S.O[1] + z[1] * S.R, 0);
    line(S.O[0] - 2, S.O[1], S.O[0] + 2, S.O[1], 0, '#8a7b66'); line(S.O[0], S.O[1] - 1.9, S.O[0], S.O[1] + 1.9, 0, '#8a7b66');
    const cpts = []; for (let k = 0; k <= 72; k++) cpts.push(pt([Math.cos(k / 72 * 2 * Math.PI), Math.sin(k / 72 * 2 * Math.PI)])); polyline(cpts, COL.g);
    S.r.forEach((z) => { const b = dotBall(COL.r, 0.12); b.position.copy(pt(z)); }); S.pt = pt;
    S.st.ok(S.r.every((z) => near(Math.hypot(z[0], z[1]), 1, 1e-6)), '|λ|² = 1/4 + 3/4 = 1 ✓');
  },
  async (tok, S) => { cap('λ = cos θ ± i sin θ，θ = 60° = π/3', 'λ = e^(±iπ/3)'); S.st.ok(near(Math.atan2(Math.abs(S.r[0][1]), S.r[0][0]), Math.PI / 3, 1e-6), 'θ = π/3（60°）✓'); sm('60°', S.O[0] + 0.55, S.O[1] + 0.3); },
  async (tok, S) => {
    cap('六次方：轉 6 個 60° = 360°', 'λ⁶ = e^(2πi) = 1');
    const z = S.r.find((w) => w[1] > 0), d = dotBall(COL.b, 0.15);
    await anim(tok, 2400, (u) => { const a = u * 2 * Math.PI; d.position.copy(S.pt([Math.cos(a + Math.PI / 3), Math.sin(a + Math.PI / 3)])); });
    const z6 = cpow(z, 6); S.st.ok(near(z6[0], 1, 1e-6) && near(z6[1], 0, 1e-6), 'λ⁶ = 1 ✓');
  },
  async (tok, S) => { const A6 = mpow([[1, -1], [1, 0]], 6); cap('A⁶ 的特徵值是 1 和 1', '所以 A⁶ = I：跑 6 次就回到原點'); S.st.ok(nearM(A6, I2, 1e-12), 'A⁶ = I ✓'); },
  async (tok, S) => {
    const D = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => Math.round(detN(TRI(n))));
    cap('不趨近 0、也不爆掉', '週期 6 一直繞圈');
    S.st.ok(D.every((v, i) => v === [1, 0, -1, -1, 0, 1][i % 6]), 'D₁…D₉ = ' + D.map(ff).join(', ') + '：週期 6 ✓');
  },
]);

const A92 = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j === i + 1 ? i + 1 : i === j + 1 ? j + 1 : 0)));
scene('qr-92', 'L24b：1992 期末考的矩陣家族', [
  async (tok, S) => { cap('1992 期末考：一個矩陣家族', 'A₄ = [0 1 0 0; 1 0 2 0; 0 2 0 3; 0 0 3 0]'); S.g4 = mgrid(A92(4), -6.2, 6.2, 0, { size: 0.55, gap: 0.66, color: () => COL.a }); hd('A₄', -5.2, 6.8); S.st = stack(-6.2, 3.3, 0.5); },
  async (tok, S) => { cap('它是對稱的：A₄ = A₄ᵀ', '對角線全 0，旁邊是 1, 2, 3'); S.st.ok(nearM(A92(4), T(A92(4))), 'A₄ = A₄ᵀ ✓（對稱）'); },
  async (tok, S) => { cap('求 C(A₃) 的投影矩陣', 'A₃ = [0 1 0; 1 0 2; 0 2 0]'); S.g3 = mgrid(A92(3), 1.6, 6.2, 0, { size: 0.55, gap: 0.66, color: () => COL.c }); hd('A₃', 2.3, 6.8); },
  async (tok, S) => { const A = A92(3); cap('A₃ 奇異：第 3 行 = 2 × 第 1 行', '（也可以算行列式 = 0）'); S.g3.col(2, GOLD); S.g3.col(0, GOLD); S.st.ok(near(detN(A), 0) && A.every((r) => r[2] === 2 * r[0]), '第 3 行 = 2 × 第 1 行、det A₃ = 0 ✓'); },
  async (tok, S) => {
    S.g3.clearGlow(); const B = A92(3).map((r) => [r[0], r[1]]), Pm = mm(mm(B, invN(mm(T(B), B))), T(B));
    cap('投影到 C(A₃) 這個平面', '用 P = A(AᵀA)⁻¹Aᵀ（A 取獨立的前兩行）');
    S.st.add('P = (1/5)[1 0 2; 0 5 0; 2 0 4]（老師沒算完，畫面補算）');
    S.st.ok(nearM(mm(Pm, Pm), Pm, 1e-12) && nearM(mscl(Pm, 5), [[1, 0, 2], [0, 5, 0], [2, 0, 4]], 1e-9), 'P² = P ✓');
  },
  async (tok, S) => { S.st.clear(); S.st = stack(-6.2, 3.3, 0.5); cap('A₃ 的特徵值：det(A₃ − λI) = 0', '對角線減 λ'); S.st.add('det [−λ 1 0; 1 −λ 2; 0 2 −λ] = 0', 'ptr'); },
  async (tok, S) => { const cp = charPoly(A92(3)); cap('3×3 直接展開', '= −λ³ + 5λ（1·1 + 2·2 = 5）'); S.st.ok(nearV(cp, [1, 0, -5, 0], 1e-12), 'det(A₃ − λI) = −λ³ + 5λ ✓'); },
  async (tok, S) => { const ev = realEigs(A92(3)); cap('λ(−λ² + 5) = 0', 'λ = 0、√5、−√5'); S.st.ok(nearV(ev, [Math.sqrt(5), 0, -Math.sqrt(5)], 1e-6), 'λ = √5、0、−√5 ✓'); },
  async (tok, S) => { cap('用 trace 檢查：特徵值總和 = 對角線和', '0 + √5 − √5 = 0 = trace'); S.st.ok(near(trace(A92(3)), 0), '總和 0 = trace 0 ✓（但抓不到 5 寫錯成 4）'); },
  async (tok, S) => { S.st.clear(); S.st = stack(-6.2, 3.3, 0.5); cap('求 C(A₄) 的投影矩陣：「這題不難」', ''); S.g4.c.flat().forEach((m) => glow(m, GOLD)); S.st.add('C(A₄) 的投影矩陣 = ?', 'ptr'); },
  async (tok, S) => { cap('先問：A₄ 可逆嗎？', '可逆 → 行空間 = 整個 R⁴ → P = I'); S.st.add('若 A₄ 可逆：C(A₄) = R⁴ → P = I₄'); },
  async (tok, S) => { S.g4.clearGlow(); const d = detN(A92(4)); cap('用 cofactor：第一列只有一個 1', '一路展開 → det A₄ = 9'); S.st.ok(near(d, 9, 1e-9), 'det A₄ = 9 ≠ 0 ✓ → 可逆 → P = I'); },
  async (tok, S) => { const ds = [1, 2, 3, 4, 5, 6].map((n) => Math.round(detN(A92(n)))); cap('老師的猜測：奇數階奇異、偶數階可逆', '（畫面驗算到 n = 6）'); S.st.ok(ds.every((d, i) => (i % 2 === 0 ? d === 0 : d !== 0)), 'det A₁…A₆ = ' + ds.map(ff).join(', ') + ' ✓'); },
]);

// ═════════════════════════ MIT 18.06 L28（z_zYQHmrh08）Similar Matrices and Jordan Form ═════════════════════════
function bowl(M, ox, oy, oz, R = 1.2, k = 0.2) {
  const geo = new THREE.PlaneGeometry(2 * R, 2 * R, 24, 24);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL.c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.7 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(ox, oy, oz); lab.world.add(mesh);
  mesh.setM = (A) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (A[0][0] * x * x + (A[0][1] + A[1][0]) * x * y + A[1][1] * y * y) * k); } p.needsUpdate = true; geo.computeVertexNormals(); };
  mesh.setM(M); return mesh;
}
const PDA = [[2, 1], [1, 2]], PDB = [[1, 0], [0, 3]];
scene('l28-pd', 'L28：正定矩陣：A⁻¹、A + B', [
  async (tok, S) => { cap('先多講一點 positive definite（正定）', '這是很重要的主題'); S.st = stack(-6.3, 6.3, 0.52); S.st.add('正定矩陣（對稱）', 'ptr'); },
  async (tok, S) => {
    cap('正定：xᵀAx 永遠 > 0（x ≠ 0）', '測法：特徵值、pivot、行列式都 > 0');
    S.b = bowl(PDA, 3.4, 0.4, 0); sm('xᵀAx（示意 A = [2 1; 1 2]）', 3.4, 3.0);
    S.st.add('xᵀAx > 0（x ≠ 0）：像一個往上開的碗'); S.st.ok(realEigs(PDA).every((l) => l > 0), '示意 A：λ = 3, 1 > 0 ✓');
  },
  async (tok, S) => { cap('正定矩陣從哪裡來？', '最小平方：AᵀA'); S.st.add('來源：最小平方裡的 AᵀA'); },
  async (tok, S) => { cap('A 正定 → A⁻¹ 也正定嗎？', 'A⁻¹ 的 pivot 不好說……'); S.st.add('問：A 正定 ⇒ A⁻¹ 正定？', 'ptr'); },
  async (tok, S) => { const e = realEigs(inv2(PDA)); cap('看特徵值：A⁻¹ 的特徵值 = 1/λ', '正的 λ → 1/λ 也是正的'); S.st.ok(nearV(e, [1, 1 / 3], 1e-9), '示意：λ(A⁻¹) = 1, 1/3 > 0 ✓ → A⁻¹ 正定'); },
  async (tok, S) => { cap('A、B 都正定 → A + B 呢？', '希望是：像正數加正數'); S.st.add('問：A、B 正定 ⇒ A + B 正定？', 'ptr'); },
  async (tok, S) => { cap('不知道 A + B 的特徵值、也不知道 pivot', '要換一個角度'); S.st.add('λ(A + B)、pivot 都不知道 → 用 xᵀAx', 'idx'); },
  async (tok, S) => {
    const C = madd(PDA, PDB); cap('xᵀ(A + B)x = xᵀAx + xᵀBx > 0', '兩個正的加起來還是正的');
    await anim(tok, 1400, (t) => S.b.setM(lerpM(PDA, C, t)));
    S.st.add('xᵀ(A + B)x = xᵀAx + xᵀBx > 0', 'ptr alt'); S.st.ok(realEigs(C).every((l) => l > 0), '示意 B = [1 0; 0 3]：A + B 的 λ 都 > 0 ✓');
  },
], { cam: [[0, 5.0, 11], [0, 2.8, 0]] });

const ATA = [[1, 0], [1, 1], [1, 2]];
scene('l28-ata', 'L28：AᵀA 是正定的', [
  async (tok, S) => { cap('最後一個想法：最小平方裡的 AᵀA', ''); S.st = stack(-1.8, 6.3, 0.52); S.st.add('AᵀA（最小平方的關鍵組合）', 'ptr'); },
  async (tok, S) => { cap('A 是 m×n 長方形矩陣', '不可能正定：不對稱，甚至不是方陣'); mgrid(ATA, -6.0, 6.0, 0, { size: 0.6, gap: 0.72, color: () => COL.a }); sm('A（示意 3×2）', -5.6, 6.7); S.st.add('A：m×n 長方形（示意 3×2）'); },
  async (tok, S) => { const G = mm(T(ATA), ATA); S.G = G; cap('AᵀA：方陣、對稱', 'AᵀA 是 n×n'); mgrid(G, -6.0, 3.3, 0, { size: 0.6, gap: 0.72, color: () => COL.c }); sm('AᵀA', -5.6, 4.0); S.st.ok(nearM(G, T(G)), 'AᵀA = [3 3; 3 5]：對稱 ✓'); },
  async (tok, S) => { cap('它是正定的嗎？', '像「數字的平方」：希望 ≥ 0'); S.st.add('問：AᵀA 正定？', 'ptr'); },
  async (tok, S) => { cap('看 xᵀ(AᵀA)x', '不用特徵值、也不用 pivot'); S.st.add('看 xᵀAᵀAx'); },
  async (tok, S) => {
    const x = [1, -1], Ax = mulMV(ATA, x); cap('括號放對地方：(Ax)ᵀ(Ax)', '= ‖Ax‖²：長度平方，不可能是負的');
    S.st.add('= (Ax)ᵀ(Ax) = ‖Ax‖² ≥ 0', 'ptr alt'); S.st.ok(near(dot(x, mulMV(S.G, x)), dot(Ax, Ax)), '示意 x = (1, −1)：xᵀAᵀAx = ‖Ax‖² = 2 ✓');
  },
  async (tok, S) => { cap('= 0 只有一種可能：Ax = 0', '長度平方 = 0 ⇔ 向量本身 = 0'); S.st.add('= 0 ⇔ Ax = 0'); },
  async (tok, S) => { cap('A 的零空間只有 0 ⇔ rank = n（行獨立）', '這時 AᵀA 正定'); S.st.ok(rankOf(ATA) === 2 && realEigs(S.G).every((l) => l > 0), 'rank A = n = 2 → AᵀA 的 λ 都 > 0 ✓（正定）'); },
  async (tok, S) => { cap('正定矩陣消去時不用換列', '不會遇到太小或 0 的 pivot：最好算的矩陣'); S.st.add('數值上：不用換列、pivot 不會太小', 'idx'); },
]);

const SA = [[2, 1], [1, 2]], SM = [[1, 4], [0, 1]], SMi = [[1, -4], [0, 1]];
scene('l28-sim', 'L28：相似矩陣 B = M⁻¹AM', [
  async (tok, S) => { cap('相似矩陣：A、B 都是 n×n', '不再要求對稱'); S.st = stack(-6.2, 6.4, 0.5); S.st.add('A、B：n×n 方陣', 'ptr'); },
  async (tok, S) => { cap('A、B 相似：存在可逆的 M', 'B = M⁻¹AM'); S.st.add('相似 ⇔ 有可逆 M 使 B = M⁻¹AM', 'ptr alt'); },
  async (tok, S) => { cap('例子：A 有完整的特徵向量', 'S⁻¹AS = Λ'); S.st.add('A 有 n 個獨立特徵向量：S⁻¹AS = Λ'); },
  async (tok, S) => { cap('新說法：A 相似於 Λ', '這時 M 就是特徵向量矩陣 S'); S.st.add('⇒ A 相似於 Λ（M = S）'); },
  async (tok, S) => { cap('換別的 M：得到不是對角的 B', '但 B 也跟 A 相似'); S.st.add('別的 M → B 不對角，但也相似'); },
  async (tok, S) => { cap('相似矩陣 = 一個家族', '最漂亮的成員：對角的 Λ'); S.st.add('家族：彼此相似；最漂亮的是 Λ', 'ptr'); },
  async (tok, S) => {
    S.st.clear(); S.st = stack(-6.2, 3.5, 0.5);
    cap('A = [2 1; 1 2]：特徵值 3 和 1', 'A 相似於 Λ = [3 0; 0 1]');
    S.gA = mgrid(SA, -4.2, 5.8, 0, { color: () => COL.a }); hd('A', -3.8, 6.5);
    mgrid([[3, 0], [0, 1]], 3.9, 5.8, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); hd('Λ', 4.3, 6.5);
    S.st.ok(nearV(realEigs(SA), [3, 1], 1e-9), 'λ(A) = 3, 1 ✓');
  },
  async (tok, S) => {
    cap('隨便挑一個 M = [1 4; 0 1]', '三角矩陣 → M⁻¹ = [1 −4; 0 1]');
    mgrid(SMi, -6.2, 5.8, 0, { color: () => COL.c }); hd('M⁻¹', -5.8, 6.5); mgrid(SM, -2.2, 5.8, 0, { color: () => COL.c }); hd('M', -1.8, 6.5);
    S.st.ok(nearM(mm(SM, SMi), I2), 'M M⁻¹ = I ✓');
  },
  async (tok, S) => { const AM = mm(SA, SM); cap('先算 AM', 'AM = [2 9; 1 6]'); S.st.ok(nearM(AM, [[2, 9], [1, 6]]), 'AM = [2 9; 1 6] ✓'); },
  async (tok, S) => {
    const B = mm(SMi, mm(SA, SM)); S.B = B; cap('再左乘 M⁻¹：B = M⁻¹AM', '2 − 4 = −2、9 − 24 = −15 → B = [−2 −15; 1 6]');
    tag('=', 'val', -0.45, 5.4); mgrid(B, 0.2, 5.8, 0, { gap: 0.95, size: 0.82, color: () => COL.b }); hd('B', 0.7, 6.5);
    S.st.ok(nearM(B, [[-2, -15], [1, 6]]), 'B = [−2 −15; 1 6] ✓');
  },
  async (tok, S) => { cap('主要事實：相似矩陣的特徵值相同', 'A、B、Λ 有什麼共通點？'); S.st.add('相似 ⇒ 特徵值相同？', 'ptr'); },
  async (tok, S) => { cap('A：trace 4 = 3 + 1、det 3 = 3 × 1', '跟 Λ 對得起來'); S.st.ok(near(trace(SA), 4) && near(det2(SA), 3), 'A：trace 4、det 3 ✓'); },
  async (tok, S) => { cap('B：trace −2 + 6 = 4、det −12 + 15 = 3', '所以 B 的特徵值也是 3 和 1'); S.st.ok(near(trace(S.B), 4) && near(det2(S.B), 3) && nearV(realEigs(S.B), [3, 1], 1e-9), 'B：trace 4、det 3 → λ = 3, 1 ✓'); },
  async (tok, S) => { cap('寫下來：相似矩陣有相同的特徵值', '這就是我們關心相似的原因'); S.st.add('相似矩陣 ⇒ 相同特徵值', 'ptr alt'); },
]);

scene('l28-why', 'L28：為什麼相似矩陣特徵值相同', [
  async (tok, S) => { cap('家族：所有特徵值是 3 和 1 的 2×2 矩陣', '它們全都跟 A 相似'); S.st = stack(-6.2, 6.4, 0.52); S.st.add('家族 = 所有 λ = 3, 1 的 2×2 矩陣', 'ptr'); S.st.add('A = [2 1; 1 2]、B = [−2 −15; 1 6]、Λ = [3 0; 0 1]'); },
  async (tok, S) => { const C = [[3, 7], [0, 1]]; cap('再一個成員：三角矩陣', '（示意）[3 7; 0 1]：對角線就是特徵值'); S.st.ok(nearV(realEigs(C), [3, 1], 1e-9), '示意 [3 7; 0 1]：λ = 3, 1 ✓（同一家族）'); },
  async (tok, S) => { cap('證明：從 Ax = λx 出發', ''); S.st.add('Ax = λx', 'ptr'); },
  async (tok, S) => { cap('中間塞一個 MM⁻¹（= I）', '左邊沒變，右邊也不變'); S.st.add('A M M⁻¹ x = λx'); },
  async (tok, S) => { cap('兩邊左乘 M⁻¹', 'λ 是數字，可以提到前面'); S.st.add('M⁻¹AM (M⁻¹x) = λ (M⁻¹x)'); },
  async (tok, S) => { cap('M⁻¹AM 就是 B', 'B(M⁻¹x) = λ(M⁻¹x)：λ 也是 B 的特徵值'); S.st.add('B (M⁻¹x) = λ (M⁻¹x) ⇒ λ 也是 B 的特徵值', 'ptr alt'); },
  async (tok, S) => {
    const x = [1, 1], y = mulMV(SMi, x), By = mulMV(S.B || mm(SMi, mm(SA, SM)), y);
    cap('特徵向量變了：B 的特徵向量 = M⁻¹x', 'A 的 x = (1, 1) → M⁻¹x = (−3, 1)');
    const Bd = board(3.6, 1.0, 0.38, [-9.5, 3.8], [-0.5, 3.6]);
    Bd.arrow(x, COL.a); Bd.arrow(mulMV(SA, x), COL.d); Bd.arrow(y, COL.c); Bd.arrow(By, COL.b);
    sm('x', Bd.P(1, 1).x, Bd.P(1, 1).y + 0.3); sm('Ax = 3x', Bd.P(3, 3).x, Bd.P(3, 3).y + 0.3); sm('M⁻¹x', Bd.P(-3, 1).x, Bd.P(-3, 1).y + 0.3); sm('B(M⁻¹x)', Bd.P(-9, 3).x, Bd.P(-9, 3).y + 0.3);
    S.st.ok(nearV(By, scl(y, 3), 1e-12), 'B(−3, 1) = (−9, 3) = 3·(−3, 1) ✓');
  },
  async (tok, S) => { cap('對角化也是一樣：特徵值不變', 'Λ 的特徵向量是 (1, 0)、(0, 1)：變漂亮了'); S.st.ok(nearV(mulMV([[3, 0], [0, 1]], [1, 0]), [3, 0]) && nearV(mulMV([[3, 0], [0, 1]], [0, 1]), [0, 1]), 'Λ(1, 0) = 3(1, 0)、Λ(0, 1) = 1(0, 1) ✓'); },
]);

const J44 = [[4, 1], [0, 4]];
scene('l28-j2', 'L28：重根：4I 與 Jordan block [4 1; 0 4]', [
  async (tok, S) => { cap('特徵值 3、1 的家族很好', '因為兩個特徵值不同'); S.st = stack(-6.2, 4.3, 0.48); S.st.add('λ 不同（3、1）→ 好家族，可對角化'); },
  async (tok, S) => { cap('壞情況：兩個特徵值一樣', '可能缺特徵向量 → 不能對角化'); S.st.add('壞情況：λ₁ = λ₂', 'bad'); },
  async (tok, S) => { cap('例如 λ₁ = λ₂ = 4', '特徵值 4、4 的矩陣有哪些？'); S.st.add('λ₁ = λ₂ = 4', 'ptr'); },
  async (tok, S) => { cap('其中一個：4I', ''); mgrid([[4, 0], [0, 4]], -6.0, 6.0, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); hd('4I', -5.6, 6.7); },
  async (tok, S) => { cap('另一個：[4 1; 0 4]', ''); mgrid(J44, -3.4, 6.0, 0, { color: (i, j) => (i === j ? COL.g : i === 0 && j === 1 ? COL.b : '#e7dcc8') }); hd('[4 1; 0 4]', -3.0, 6.7); },
  async (tok, S) => { cap('重點：它們不在同一個家族', '特徵值 4、4 的矩陣分成兩個家族'); S.st.add('4I 和 [4 1; 0 4] 不相似！', 'ptr alt'); },
  async (tok, S) => { const M = [[2, 1], [1, 1]], R = mm(invN(M), mm(mscl(I2, 4), M)); cap('只有 4I 自己跟 4I 相似', 'M⁻¹(4I)M = 4M⁻¹M = 4I：不管 M 是什麼'); S.st.ok(nearM(R, mscl(I2, 4), 1e-12), '示意 M = [2 1; 1 1]：M⁻¹(4I)M = 4I ✓（一人家族）'); },
  async (tok, S) => { cap('其他特徵值 4、4 的矩陣', '全都在另一個大家族'); S.st.add('其他所有 λ = 4, 4 的矩陣 → 同一個大家族'); },
  async (tok, S) => { const g = eigInfo(J44).groups[0]; cap('[4 1; 0 4] 不能對角化', '只有一個特徵向量'); S.st.ok(g.am === 2 && g.gm === 1, '[4 1; 0 4]：λ = 4 重複 2 次，但只有 1 個特徵向量 ✓'); },
  async (tok, S) => { S.st.clear(); S.st = stack(-6.2, 4.3, 0.48); cap('它是這個家族裡最好的：Jordan form', '最接近對角，但上面有一個 1'); S.st.add('Jordan form：家族裡最接近對角的成員', 'ptr alt'); },
  async (tok, S) => { cap('以前是課程的高潮，現在不是了', '數值上很脆弱：特徵值、rank 稍微變一點，整個形式就變'); S.st.add('數值上不穩定：λ、rank 一點誤差就全變', 'idx'); },
  async (tok, S) => { const C = [[5, 1], [-1, 3]]; cap('更多成員：trace 要 8、det 要 16', '例如 [5 1; −1 3]'); mgrid(C, -0.8, 6.0, 0, { color: () => COL.b }); hd('[5 1; −1 3]', -0.4, 6.7); S.st.ok(near(trace(C), 8) && near(det2(C), 16), '[5 1; −1 3]：trace 8、det 16 → λ = 4, 4 ✓'); },
  async (tok, S) => { cap('它不能對角化', '若能，對角形式就得是 4I；但 4I 只跟自己相似'); S.st.add('若可對角化 → 跟 4I 相似 → 不可能', 'bad'); },
  async (tok, S) => { const C = [[4, 0], [17, 4]]; cap('再一個：[4 0; 17 4]', '全都跟 J 相似'); mgrid(C, 1.8, 6.0, 0, { color: () => COL.b }); hd('[4 0; 17 4]', 2.2, 6.7); S.st.ok(near(trace(C), 8) && near(det2(C), 16), '[4 0; 17 4]：trace 8、det 16 ✓'); },
  async (tok, S) => { cap('一般：對角線 a、8 − a，再調到 det = 16', '（不是 4I 的）全都相似'); mtx([['a', 'b'], ['c', '8−a']], 5.0, 5.6); sm('a(8−a) − bc = 16', 5.0, 4.6); S.st.add('[a b; c 8−a]，det = 16（不是 4I）→ 全部相似'); },
  async (tok, S) => {
    const fam = [J44, [[5, 1], [-1, 3]], [[4, 0], [17, 4]]]; cap('相似 ⇒ 特徵值相同、獨立特徵向量個數也相同', '這個家族：都只有 1 個');
    S.st.ok(fam.every((M) => { const g = eigInfo(M).groups; return g.length === 1 && near(g[0].re, 4, 1e-6) && g[0].gm === 1; }), '三個成員：λ = 4, 4，特徵向量都只有 1 個 ✓');
  },
]);

const JA = [[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], JA7 = [[0, 1, 7, 0], [0, 0, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], JB = [[0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 0, 0, 0]];
const jcol = (M, blocks) => (i, j) => { if (blocks) for (const [a, b, c] of blocks) if (i >= a && i <= b && j >= a && j <= b) return c; return M[i][j] ? COL.b : '#e7dcc8'; };
scene('l28-j4', 'L28：只數特徵向量還不夠（4×4）', [
  async (tok, S) => { cap('只數特徵向量還不夠', '看 4×4 的例子'); S.st = stack(-6.2, 3.4, 0.48); },
  async (tok, S) => { cap('4×4：對角線上方放兩個 1', '[0 1 0 0; 0 0 1 0; 0 0 0 0; 0 0 0 0]'); S.gA = mgrid(JA, -6.2, 6.2, 0, { size: 0.55, gap: 0.64, color: jcol(JA) }); hd('J₁', -5.2, 6.8); },
  async (tok, S) => { cap('特徵值：四個 0', '嚴格上三角 → 對角線全 0'); S.st.ok(near(detN(JA), 0) && nearM(mpow(JA, 4), mscl(eye(4), 0)), '特徵值 0, 0, 0, 0 ✓'); },
  async (tok, S) => { cap('有幾個特徵向量？看零空間', 'rank 2 → 零空間 4 − 2 = 2 維'); S.st.ok(rankOf(JA) === 2, 'rank 2 → 2 個獨立特徵向量 ✓'); },
  async (tok, S) => { cap('把一個 0 改成 7', 'λ 還是全 0，rank 還是 2 → 跟 J₁ 相似'); S.gA7 = mgrid(JA7, -2.0, 6.2, 0, { size: 0.55, gap: 0.64, color: jcol(JA7) }); glow(S.gA7.c[0][2], GOLD); hd('改一個 7', -1.0, 6.8); S.st.ok(rankOf(JA7) === 2 && near(detN(JA7), 0), '改成 7：rank 仍是 2 ✓（相似，但不如 J₁ 漂亮）'); },
  async (tok, S) => { cap('Jordan 的選法：每缺一個特徵向量', '就在對角線上方放一個 1（這裡缺 2 個 → 兩個 1）'); S.st.add('每缺 1 個特徵向量 → 上方放 1 個 1', 'ptr'); },
  async (tok, S) => { cap('第二個例子：把 1 移個位置', '[0 1 0 0; 0 0 0 0; 0 0 0 1; 0 0 0 0]'); S.gB = mgrid(JB, 2.2, 6.2, 0, { size: 0.55, gap: 0.64, color: jcol(JB) }); hd('J₂', 3.2, 6.8); },
  async (tok, S) => { cap('又是四個 0、rank 又是 2', '一樣是 2 個特徵向量、缺 2 個'); S.st.ok(rankOf(JB) === 2 && nearM(mpow(JB, 2), mscl(eye(4), 0)), 'J₂：λ 全 0、rank 2 ✓'); },
  async (tok, S) => { S.st.clear(); S.st = stack(-6.2, 3.4, 0.48); cap('但 J₂ 跟 J₁ 不相似！', '特徵向量個數一樣也不夠'); S.st.add('J₁ 和 J₂ 不相似！', 'bad'); },
  async (tok, S) => {
    cap('J₁ = 3×3 block + 1×1 block', 'J₂ = 2×2 block + 2×2 block');
    S.gA.c.forEach((r, i) => r.forEach((m, j) => P.tint(m, jcol(JA, [[0, 2, COL.c], [3, 3, COL.d]])(i, j))));
    S.gB.c.forEach((r, i) => r.forEach((m, j) => P.tint(m, jcol(JB, [[0, 1, COL.c], [2, 3, COL.d]])(i, j))));
    S.st.add('J₁：3×3 + 1×1　J₂：2×2 + 2×2（Jordan blocks）');
  },
  async (tok, S) => { cap('Jordan block：λ 在對角線、上方一排 1', '下面全是 0'); mtx([['λ', '1', '0'], ['0', 'λ', '1'], ['0', '0', 'λ']], 3.6, 1.6); sm('Jordan block', 3.6, 2.6); S.st.add('Jordan block：對角 λ、上方 1、下方 0', 'ptr'); },
  async (tok, S) => { const Jb = [[5, 1, 0], [0, 5, 1], [0, 0, 5]], g = { am: nearV(charPoly(Jb), [1, -15, 75, -125]) ? 3 : 0, gm: 3 - rankOf(shift(Jb, 5)) }; cap('一個 Jordan block 只有一個特徵向量', 'J₁、J₂ 各有兩個 block → 各 2 個特徵向量'); S.st.ok(g.am === 3 && g.gm === 1, '例：3×3 block（λ = 5）只有 1 個特徵向量 ✓'); },
  async (tok, S) => { cap('block 大小不同 → 不相似', '（畫面補充）J₁² 的 rank 是 1、J₂² 的 rank 是 0，相似矩陣不可能這樣'); S.st.ok(rankOf(mpow(JA, 2)) === 1 && rankOf(mpow(JB, 2)) === 0, '補充：rank J₁² = 1 ≠ rank J₂² = 0 ✓ → 不相似'); },
]);

const JX = [[5, 1, 0, 0, 0, 0], [0, 5, 0, 0, 0, 0], [0, 0, 2, 0, 0, 0], [0, 0, 0, 2, 1, 0], [0, 0, 0, 0, 2, 1], [0, 0, 0, 0, 0, 2]];
scene('l28-thm', 'L28：Jordan 定理', [
  async (tok, S) => { cap('Jordan 定理：每個方陣 A 都相似於一個 Jordan 矩陣 J', ''); S.st = stack(-0.6, 6.2, 0.52); S.st.add('每個方陣 A 都相似於一個 Jordan 矩陣 J', 'ptr alt'); },
  async (tok, S) => { cap('J = 對角上排著 Jordan blocks', 'J = diag(J₁, J₂, …, J_d)（示意 6×6）'); S.g = mgrid(JX, -6.4, 6.0, 0, { size: 0.5, gap: 0.58, color: jcol(JX, [[0, 1, COL.c], [2, 2, COL.d], [3, 5, COL.a]]) }); sm('示意 J', -5.0, 6.6); S.st.add('J = diag(J₁, J₂, …, J_d)'); },
  async (tok, S) => { cap('特徵值在對角線上', '有些 block 的對角線上方有 1'); for (let i = 0; i < 6; i++) glow(S.g.c[i][i], GOLD); S.st.add('對角線 = 特徵值；block 內上方是 1'); },
  async (tok, S) => {
    S.g.clearGlow(); const cnt = (6 - rankOf(shift(JX, 5))) + (6 - rankOf(shift(JX, 2)));
    cap('block 的個數 = 獨立特徵向量的個數', '每個 block 貢獻一個特徵向量');
    S.st.ok(cnt === 3, '示意 J：3 個 block ↔ 3 個獨立特徵向量 ✓');
  },
  async (tok, S) => { const A = [[1, 2], [0, 3]], e = eigInfo(A); cap('好情況：特徵值都不同 → J = Λ', 'n 個 block、n 個特徵向量：可對角化'); S.st.ok(e.diag && e.groups.length === 2, '例 [1 2; 0 3]：λ 相異 → J = Λ = [1 0; 0 3] ✓'); },
  async (tok, S) => { cap('Jordan 把所有情況都包含進來', '連重根、缺特徵向量也一樣'); S.st.add('重根、缺特徵向量的情況也涵蓋'); },
  async (tok, S) => { cap('怎麼算 J 不簡單', '期末考不會要你算 4 重根的 Jordan form'); S.st.add('計算 J 不容易：掌握定義與基本求法即可', 'idx'); },
]);

// ═════════════════════════ 3Blue1Brown 第 14 集（PFDu9oVAE-g）Eigenvectors and eigenvalues ═════════════════════════
const A3B = [[3, 1], [0, 2]];
scene('3b-span', '3B1B：留在自己 span 上的向量', [
  async (tok, S) => { cap('一個 2D 線性變換', '先看整個平面'); S.W = plane2(); S.i = S.W.vec([1, 0], '#2fa86a', 'î'); S.j = S.W.vec([0, 1], '#d64545', 'ĵ'); S.s = fslots(); },
  async (tok, S) => { cap('î → (3, 0)、ĵ → (1, 2)', 'A 的行就是 (3, 0) 和 (1, 2)'); await S.W.to(tok, A3B, 1800); S.s[0].set('A = [3 1; 0 2]', 'ptr'); },
  async (tok, S) => { cap('盯著一個向量和它的 span', 'span = 穿過原點和箭頭尖端的直線（示意 v = (1, 1)）'); await S.W.to(tok, I2, 800); S.v = S.W.vec([1, 1], '#c9a227', 'v'); S.ln = eigLine(S.W.F, [1, 1], '#bfb29c'); },
  async (tok, S) => { cap('大部分向量會被轉離自己的 span', ''); await S.W.to(tok, A3B, 1600); S.v.a.glow(RED); const w = mulMV(A3B, [1, 1]); S.s[1].set('A(1, 1) = ' + vs(w) + '：離開了自己的直線', near(crossZ(w, [1, 1]), 0) ? 'good' : 'bad'); },
  async (tok, S) => { cap('但有些特殊向量會留在自己的 span 上', '只被拉長或壓縮，像乘上一個數'); await S.W.to(tok, I2, 800); S.W.drop(S.v); kill(S.ln); S.s[1].set(' '); },
  async (tok, S) => { cap('î 就是一個：它的 span 是 x 軸', 'î → (3, 0) = 3î，還在 x 軸上'); S.lx = eigLine(S.W.F, [1, 0], COL.d); S.i.a.glow(GOLD); await S.W.to(tok, A3B, 1500); S.s[1].ok(nearV(mulMV(A3B, [1, 0]), [3, 0]), 'Aî = (3, 0) = 3î ✓'); },
  async (tok, S) => {
    cap('x 軸上的每個向量都只被拉長 3 倍', '線性的關係：整條線一起動'); await S.W.to(tok, I2, 700);
    S.xs = [[-1, 0], [1.6, 0]].map((v) => S.W.vec(v, COL.d)); await S.W.to(tok, A3B, 1300);
    S.s[1].ok([[-1, 0], [1.6, 0]].every((v) => nearV(mulMV(A3B, v), scl(v, 3))), 'x 軸上的向量：A v = 3v ✓');
  },
  async (tok, S) => {
    cap('比較狡猾的一個：(−1, 1)', '被拉長 2 倍：(−1, 1) → (−2, 2)'); await S.W.to(tok, I2, 700); S.xs.forEach((it) => S.W.drop(it));
    S.ld = eigLine(S.W.F, [-1, 1], COL.r); S.d = S.W.vec([-1, 1], COL.r, '(−1, 1)'); await S.W.to(tok, A3B, 1300);
    S.s[1].ok(nearV(mulMV(A3B, [-1, 1]), [-2, 2]), 'A(−1, 1) = (−2, 2) = 2·(−1, 1) ✓');
  },
  async (tok, S) => {
    cap('那條對角線上的向量都被拉長 2 倍', ''); await S.W.to(tok, I2, 700);
    S.ds = [[1, -1], [-1.6, 1.6]].map((v) => S.W.vec(v, COL.r)); await S.W.to(tok, A3B, 1300);
    S.s[1].ok([[1, -1], [-1.6, 1.6]].every((v) => nearV(mulMV(A3B, v), scl(v, 2))), '對角線上的向量：A v = 2v ✓');
  },
  async (tok, S) => {
    cap('就只有這兩條線；其他向量都會被轉走', '（示意）再丟幾個向量看看'); await S.W.to(tok, I2, 700);
    const others = [[2, 1], [0.5, 2], [-2, -1]]; S.os = others.map((v) => S.W.vec(v, COL.k)); await S.W.to(tok, A3B, 1300); S.os.forEach((it) => it.a.glow(RED));
    S.s[1].ok(others.every((v) => !near(crossZ(mulMV(A3B, v), v), 0, 1e-9)), '其他向量：都離開自己的 span ✓');
  },
  async (tok, S) => { cap('這些特殊向量叫 eigenvector（特徵向量）', '被拉長的倍數叫 eigenvalue（特徵值）：3 和 2'); S.s[2].ok(nearV(realEigs(A3B), [3, 2], 1e-9), 'eigenvalue：λ = 3（x 軸）、λ = 2（對角線）✓'); },
  async (tok, S) => {
    cap('特徵值也可以是負的', '（示意）λ = −½：翻轉、再壓成一半；但還是在同一條直線上');
    await S.W.to(tok, I2, 700); S.W.dropAll([S.i, S.j]); S.s[1].set(' ');
    const N = [[-0.5, 0], [0, 1.5]]; S.n = S.W.vec([3, 0], COL.b, '示意'); await S.W.to(tok, N, 1500);
    S.s[2].ok(nearV(mulMV(N, [3, 0]), [-1.5, 0]), '示意：(3, 0) → (−1.5, 0) = −½·(3, 0) ✓');
  },
], { cam: FLAT });

const ROT3 = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
scene('3b-rot3d', '3B1B：3D 旋轉的特徵向量 = 旋轉軸', [
  async (tok, S) => {
    cap('想一個 3D 旋轉', '（示意）A = [0 0 1; 1 0 0; 0 1 0]：x → y → z → x');
    S.Sp = space3(0, 2.6, 0, 1, 2.5); S.vs = [[1.6, 0, 0], [0, 1.6, 0], [0, 0, 1.6], [1, -1, 0.5], [1.2, 1.2, 1.2]];
    S.as = S.vs.map((v, i) => S.Sp.arrow(v, i === 4 ? COL.g : COL.k, i === 4 ? '(1, 1, 1)' : ''));
    await anim(tok, 2200, (t) => { const R = rodrigues([1, 1, 1], t * 2 * Math.PI / 3); S.as.forEach((a, i) => S.Sp.set(a, mulMV(R, S.vs[i]))); });
  },
  async (tok, S) => { S.Sp.line([1, 1, 1], COL.g, 2.6); S.as[4].glow(GOLD); cap('找到一個留在自己 span 上的向量', '那就是旋轉軸'); },
  async (tok, S) => { cap('用「軸 + 角度」想旋轉', '比看整個 3×3 矩陣簡單多了'); await orbit(tok, 2400, 30, 90, 20, 10.5, [0, 2.4, 0]); },
  async (tok, S) => { cap('這個特徵值一定是 1', '旋轉不會拉長也不會壓縮'); S.l = hot('', -3.0, 5.6); const ok = nearV(mulMV(ROT3, [1, 1, 1]), [1, 1, 1]) && nearM(rodrigues([1, 1, 1], 2 * Math.PI / 3), ROT3, 1e-9); txt(S.l, ok ? 'A(1, 1, 1) = (1, 1, 1)：λ = 1 ✓' : 'λ = 1 ✘'); S.l.element.className = 'lab-label ' + (ok ? 'good' : 'bad'); },
  async (tok, S) => { cap('看矩陣的行 = 看基底被送去哪', '找特徵向量、特徵值：更貼近變換本身，不依賴座標系'); },
], { cam: [[0, 0, 0], [0, 2.4, 0]], init: () => cam(30, 20, 10.5, [0, 2.4, 0]) });

const A3C = [[2, 2], [1, 3]];
scene('3b-detzero', '3B1B：det(A − λI) = 0 的由來', [
  async (tok, S) => { cap('用符號寫：Av = λv', 'A 是變換，v 是特徵向量，λ 是特徵值'); S.W = plane2(); S.s = fslots(); S.s[0].set('A v = λ v', 'ptr'); },
  async (tok, S) => { cap('左邊：矩陣 × 向量；右邊：數字 × 向量', '形式不一樣，不好處理'); S.s[1].set('左：矩陣 × 向量　右：數字 × 向量'); },
  async (tok, S) => { cap('把 λ 寫成矩陣：λI', '對角線放 λ、其他 0：每個向量都乘 λ（示意 λ = 2）'); S.s[1].set('λ v = (λI) v，λI = [λ 0; 0 λ]'); await S.W.to(tok, mscl(I2, 2), 1100); await S.W.to(tok, I2, 800); },
  async (tok, S) => { cap('移項、提出 v', '(A − λI) v = 0'); S.s[0].set('(A − λI) v = 0', 'ptr'); },
  async (tok, S) => { cap('v = 0 一定成立，但沒意思', '我們要的是非零的特徵向量'); S.s[1].set('v = 0 太無聊：要 v ≠ 0'); },
  async (tok, S) => {
    cap('非零向量被送到 0 ⇔ 空間被壓到更低維', '⇔ det = 0（示意：壓扁成一條線）');
    const Z = [[1, 2], [0.5, 1]]; await S.W.to(tok, Z, 1100); S.s[1].ok(near(det2(Z), 0), '示意：壓成一條線 → det = 0 ✓'); await S.W.to(tok, I2, 800);
  },
  async (tok, S) => { cap('具體例子：A 的行是 (2, 1) 和 (2, 3)', 'A = [2 2; 1 3]，對角線減掉 λ'); S.s[0].set('A − λI = [2−λ 2; 1 3−λ]', 'ptr'); await S.W.to(tok, A3C, 1300); S.s[1].set('λ = 0　det = ' + nf(det2(A3C))); },
  async (tok, S) => { cap('想像轉一個旋鈕，慢慢調 λ', 'λ 一變，矩陣變、行列式也變'); await anim(tok, 1800, (u) => { const l = 0.7 * u; S.W.set(shift(A3C, l)); S.s[1].set('λ = ' + nf(l) + '　det = ' + nf(det2(shift(A3C, l)))); }); },
  async (tok, S) => { cap('λ = 1：剛好壓扁', 'det(A − I) = 0'); await anim(tok, 900, (u) => { const l = 0.7 + 0.3 * u; S.W.set(shift(A3C, l)); S.s[1].set('λ = ' + nf(l) + '　det = ' + nf(det2(shift(A3C, l)))); }); S.s[2].ok(near(det2(shift(A3C, 1)), 0), 'λ = 1：det(A − I) = 0 ✓'); },
  async (tok, S) => {
    cap('換別的矩陣，甜蜜點不一定在 1', '（這個 A 調到 λ = 4 也會壓扁：det = (λ − 1)(λ − 4)）');
    await anim(tok, 1500, (u) => { const l = 1 + 3 * u; S.W.set(shift(A3C, l)); S.s[1].set('λ = ' + nf(l) + '　det = ' + nf(det2(shift(A3C, l)))); });
    S.s[2].ok(near(det2(shift(A3C, 4)), 0) && nearV(realEigs(A3C), [4, 1], 1e-9), 'λ = 4 也讓 det = 0 ✓');
  },
  async (tok, S) => {
    cap('回到 λ = 1：A − I 把平面壓成一條線', '所以有非零的 v 被送到 0');
    await anim(tok, 1000, (u) => { const l = 4 - 3 * u; S.W.set(shift(A3C, l)); S.s[1].set('λ = ' + nf(l) + '　det = ' + nf(det2(shift(A3C, l)))); });
    S.vf = S.W.F.arrow([2, -1], COL.b, 'v'); S.s[2].ok(nearV(mulMV(shift(A3C, 1), [2, -1]), [0, 0]), '(A − I)(2, −1) = (0, 0) ✓');
  },
  async (tok, S) => { cap('這代表 Av = λv：v 是特徵向量', '它留在自己的 span 上'); await S.W.to(tok, I2, 700); eigLine(S.W.F, [2, -1], COL.b); S.v2 = S.W.vec([2, -1], COL.b); await S.W.to(tok, A3C, 1500); S.s[2].ok(nearV(mulMV(A3C, [2, -1]), [2, -1]), 'A(2, −1) = (2, −1) ✓'); },
  async (tok, S) => { S.v2.a.glow(GOLD); cap('特徵值是 1：v 完全不動', '想不通可以暫停想一下'); S.s[0].set('λ = 1：v 停在原地', 'ptr alt'); },
], { cam: FLAT });

scene('3b-compute', '3B1B：算特徵值；旋轉、shear、2I', [
  async (tok, S) => { cap('回到一開始的 A = [3 1; 0 2]', ''); S.W = plane2(); S.s = fslots(); S.s[0].set('A = [3 1; 0 2]', 'ptr'); await S.W.to(tok, A3B, 1400); },
  async (tok, S) => { cap('對角線減 λ，算行列式', 'det(A − λI) = (3 − λ)(2 − λ)'); S.s[1].set('det(A − λI) = (3 − λ)(2 − λ) − 1·0'); },
  async (tok, S) => { cap('行列式 = 0 才可能是特徵值', '只可能 λ = 2 或 λ = 3'); S.s[2].ok(nearV(realEigs(A3B), [3, 2], 1e-9), 'λ = 3 或 2 ✓'); },
  async (tok, S) => {
    cap('λ = 2：解 (A − 2I)v = 0', '解在 (−1, 1) 那條對角線上');
    await S.W.to(tok, shift(A3B, 2), 1300); eigLine(S.W.F, [-1, 1], COL.r);
    S.s[2].ok(nearV(mulMV(shift(A3B, 2), [-1, 1]), [0, 0]), '(A − 2I)(−1, 1) = 0 ✓ → A 把它們拉長 2 倍');
  },
  async (tok, S) => {
    const R = [[0, -1], [1, 0]]; cap('2D 變換不一定有特徵向量', '例：轉 90°，每個向量都被轉離 span');
    await S.W.to(tok, I2, 700); S.vv = [[2, 0], [1, 1.5], [-1.5, 1]].map((v) => S.W.vec(v, COL.k)); await S.W.to(tok, R, 1500); S.vv.forEach((it) => it.a.glow(RED));
    S.s[0].set('旋轉 90°：[0 −1; 1 0]', 'ptr');
  },
  async (tok, S) => { const r = roots(charPoly([[0, -1], [1, 0]])); cap('det = λ² + 1 = 0', '根是 i 和 −i：沒有實數解 → 沒有特徵向量'); S.s[1].set('det(A − λI) = λ² + 1'); S.s[2].ok(r.every((z) => near(z[0], 0, 1e-6) && near(Math.abs(z[1]), 1, 1e-6)), 'λ = ±i（不是實數）✓'); },
  async (tok, S) => { cap('另一個例子：shear', 'î 不動、ĵ 往右移一格：[1 1; 0 1]'); await S.W.to(tok, I2, 700); S.W.dropAll(); await S.W.to(tok, [[1, 1], [0, 1]], 1400); S.s[0].set('shear：[1 1; 0 1]', 'ptr'); S.s[1].set(' '); },
  async (tok, S) => { const Sh = [[1, 1], [0, 1]], g = eigInfo(Sh).groups; cap('det = (1 − λ)² → 只有 λ = 1', 'x 軸上的向量不動，而且只有它們'); eigLine(S.W.F, [1, 0], COL.d); S.s[1].set('det(A − λI) = (1 − λ)²'); S.s[2].ok(g.length === 1 && near(g[0].re, 1) && g[0].gm === 1, 'λ = 1，特徵向量只有 x 軸一條 ✓'); },
  async (tok, S) => {
    const D = mscl(I2, 2); cap('只有一個特徵值，也可以不只一條線', '例：全部放大 2 倍：每個向量都是特徵向量');
    await S.W.to(tok, I2, 700); S.vv = [[1.5, 0], [1, 1], [-1, 1.5], [-1.2, -0.8]].map((v) => S.W.vec(v, COL.g)); await S.W.to(tok, D, 1400);
    S.s[0].set('2I = [2 0; 0 2]', 'ptr'); S.s[2].ok(rankOf(shift(D, 2)) === 0, 'λ = 2，整個平面都是特徵向量 ✓');
  },
], { cam: FLAT });

const SB = [[1, -1], [0, 1]];
scene('3b-eigenbasis', '3B1B：eigenbasis 與對角化', [
  async (tok, S) => { cap('最後一個想法：eigenbasis', '用到上一集的「換基底」'); S.W = plane2(); S.i = S.W.vec([1, 0], '#2fa86a', 'î'); S.j = S.W.vec([0, 1], '#d64545', 'ĵ'); S.s = fslots(); S.s[0].set('eigenbasis', 'ptr'); },
  async (tok, S) => { const D = [[-1, 0], [0, 2]]; cap('如果基底剛好就是特徵向量', '例：î 乘 −1、ĵ 乘 2'); await S.W.to(tok, D, 1500); S.s[1].ok(nearV(mulMV(D, [1, 0]), [-1, 0]) && nearV(mulMV(D, [0, 1]), [0, 2]), 'î → −î、ĵ → 2ĵ ✓'); },
  async (tok, S) => { cap('矩陣是對角的：對角線就是特徵值', '其他位置全是 0'); S.s[0].set('[−1 0; 0 2]：對角矩陣 = 特徵值在對角線', 'ptr'); },
  async (tok, S) => { cap('對角矩陣乘 100 次很容易', '每個基底乘 λ¹⁰⁰：(−1)¹⁰⁰ = 1、2¹⁰⁰ ≈ 1.27×10³⁰'); S.s[2].ok(nearM(mpow([[-1, 0], [0, 2]], 10), [[1, 0], [0, 1024]]), '例：[−1 0; 0 2]¹⁰ = [1 0; 0 1024] ✓（λ 各自乘方）'); },
  async (tok, S) => { cap('非對角矩陣的 100 次方？', '試試看就知道：惡夢'); await S.W.to(tok, I2, 700); await S.W.to(tok, A3B, 1300); S.s[0].set('A = [3 1; 0 2]：A¹⁰⁰ = ？', 'ptr'); S.s[2].set(' '); },
  async (tok, S) => { cap('很少這麼幸運；但如果特徵向量夠多', '多到能張成整個平面 → 換座標系，讓它們當基底'); S.l1 = eigLine(S.W.F, [1, 0], COL.d); S.l2 = eigLine(S.W.F, [-1, 1], COL.r); S.s[1].set('特徵向量 (1, 0)、(−1, 1) 能張成整個平面'); },
  async (tok, S) => { cap('換基底矩陣：特徵向量當行', 'S = [1 −1; 0 1]'); await S.W.to(tok, I2, 700); S.b2 = S.W.vec([-1, 1], '#c9a227', '(−1, 1)'); S.i.a.glow(GOLD); S.s[1].set('S = [1 −1; 0 1]（行 = 特徵向量）'); },
  async (tok, S) => { cap('夾起來：S⁻¹ A S', '右邊放 S、左邊放 S⁻¹'); S.s[0].set('S⁻¹ A S', 'ptr'); },
  async (tok, S) => { const L = mm(inv2(SB), mm(A3B, SB)); cap('結果是同一個變換，從新基底看', '一定是對角的，對角線 = 特徵值'); S.s[2].ok(nearM(L, [[3, 0], [0, 2]], 1e-12), 'S⁻¹AS = [3 0; 0 2] ✓'); },
  async (tok, S) => { cap('基底全是特徵向量 = eigenbasis', '在這組基底下，變換只是在拉長'); await S.W.to(tok, A3B, 1500); S.s[1].ok(nearV(mulMV(A3B, [-1, 1]), [-2, 2]) && nearV(mulMV(A3B, [1, 0]), [3, 0]), '(1, 0) → 3 倍、(−1, 1) → 2 倍 ✓'); },
  async (tok, S) => { const L5 = [[243, 0], [0, 32]], ok = nearM(mm(SB, mm(L5, inv2(SB))), mpow(A3B, 5), 1e-9); cap('算 A¹⁰⁰：換到 eigenbasis、算次方、再換回來', 'A¹⁰⁰ = S Λ¹⁰⁰ S⁻¹'); S.s[0].set('A¹⁰⁰ = S Λ¹⁰⁰ S⁻¹', 'ptr alt'); S.s[2].ok(ok, '驗算 k = 5：S Λ⁵ S⁻¹ = A⁵ ✓'); },
  async (tok, S) => { const g = eigInfo([[1, 1], [0, 1]]).groups[0]; cap('不是每個變換都可以', 'shear 的特徵向量不夠，張不滿整個平面'); await S.W.to(tok, I2, 600); kill(S.l2); S.W.drop(S.b2); await S.W.to(tok, [[1, 1], [0, 1]], 1300); S.s[2].ok(g.gm === 1, 'shear：只有 1 個特徵方向 → 沒有 eigenbasis ✓'); },
], { cam: FLAT });

// ═════════════════════════ 3Blue1Brown 第 15 集（e50Bj7jn9IQ）A quick trick for computing eigenvalues ═════════════════════════
// number line on y = 2.0 from lo to hi
function nline(lo, hi, y = 2.0) {
  const X = (v) => -5.5 + (v - lo) / (hi - lo) * 11;
  rod('#8a7b66', 0.02).setW(V3(-5.8, y, 0), V3(5.8, y, 0));
  for (let k = Math.ceil(lo); k <= hi; k++) { rod('#8a7b66', 0.015).setW(V3(X(k), y - 0.18, 0), V3(X(k), y + 0.18, 0)); sm(String(k).replace('-', '−'), X(k), y - 0.45); }
  return X;
}
const mean2 = (M) => (M[0][0] + M[1][1]) / 2;
async function mpSpread(tok, X, m, d, y = 2.0) {
  const c = dotBall(COL.k, 0.14); c.position.set(X(m), y, 0); sm('m', X(m), y + 0.5);
  const a = dotBall(COL.d, 0.16), b = dotBall(COL.r, 0.16);
  await anim(tok, 1200, (t) => { a.position.set(X(m + d * t), y, 0); b.position.set(X(m - d * t), y, 0); });
  hot('λ = ' + nf(m + d, 3), X(m + d), y + 1.0); hot('λ = ' + nf(m - d, 3), X(m - d), y + 1.0);
}
scene('tr-intro', '3B1B 15：快速算 2×2 特徵值', [
  async (tok, S) => { cap('給已經會特徵值的人：2×2 的快速算法', ''); S.st = stack(-5.6, 6.0, 0.6); S.st.add('2×2 矩陣：快速求特徵值', 'ptr alt'); },
  async (tok, S) => {
    cap('複習：特徵向量 v 只被拉長 λ 倍', 'Av = λv（示意 A = [3 1; 0 2]、v = (−1, 1)、λ = 2）');
    const B = board(-1.5, 1.2, 0.9, [-3, 1.5], [-0.5, 2.8]); B.arrow([-1, 1], COL.a); B.arrow(mulMV(A3B, [-1, 1]), COL.d, [0, 0]);
    sm('v', B.P(-1, 1).x - 0.3, B.P(-1, 1).y); sm('Av = 2v', B.P(-2, 2).x - 0.5, B.P(-2, 2).y + 0.2);
  },
  async (tok, S) => { cap('整理一下：(A − λI)v = 0，v ≠ 0', '⇒ det(A − λI) = 0'); S.st.add('(A − λI)v = 0（v ≠ 0）⇒ det(A − λI) = 0', 'ptr'); },
]);

const TM = [[3, 1], [4, 1]];
scene('tr-usual', '3B1B 15：一般的算法', [
  async (tok, S) => { cap('一般作法：對角線減 λ，令行列式 = 0', '例：[3 1; 4 1]'); mtx([['3−λ', '1'], ['4', '1−λ']], -3.5, 5.2); S.st = stack(-0.8, 5.8, 0.6); },
  async (tok, S) => { const cp = charPoly(TM); cap('展開、化簡：特徵多項式', '(3 − λ)(1 − λ) − 4 = λ² − 4λ − 1'); S.st.ok(nearV(cp, [1, -4, -1]), '(3 − λ)(1 − λ) − 4 = λ² − 4λ − 1 ✓'); },
  async (tok, S) => { const r = realEigs(TM); cap('根 = 特徵值：套公式解', 'λ = (4 ± √20)/2 = 2 ± √5'); S.st.ok(nearV(r, [2 + Math.sqrt(5), 2 - Math.sqrt(5)], 1e-9), 'λ = (4 ± √20)/2 = 2 ± √5 ✓'); },
  async (tok, S) => { cap('不難，但 2×2 有更直接的路', '只要知道三個事實'); S.st.add('更直接：三個事實', 'ptr alt'); },
]);

const T86 = [[8, 4], [2, 6]];
scene('tr-facts', '3B1B 15：三個事實 → λ = m ± √(m² − p)', [
  async (tok, S) => { cap('事實 1：trace = 特徵值的和', '⇒ 特徵值的平均 = 對角線的平均'); S.st = stack(-6.0, 6.3, 0.55); S.st.add('① 特徵值平均 m = 對角線平均', 'ptr'); },
  async (tok, S) => { cap('事實 2：det = 特徵值的乘積', 'p = λ₁λ₂ = ad − bc'); S.st.add('② 特徵值乘積 p = det', 'ptr'); },
  async (tok, S) => { cap('直覺：特徵值是各方向的拉伸倍率', 'det 是面積整體縮放的倍率'); S.st.add('（λ = 各方向拉伸；det = 面積縮放）', 'idx'); },
  async (tok, S) => { cap('例：對角線 8 和 6 → 平均 7', '（示意 A = [8 4; 2 6]）'); mgrid(T86, 2.2, 6.0, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); sm('示意 A', 2.9, 6.7); S.X = nline(0, 12); S.st.ok(near(mean2(T86), 7), 'm = (8 + 6)/2 = 7 ✓'); },
  async (tok, S) => { cap('行列式：48 − 8 = 40', '特徵值乘積 p = 40'); S.st.ok(near(det2(T86), 40), 'p = 8·6 − 4·2 = 48 − 8 = 40 ✓'); },
  async (tok, S) => { cap('事實 3：知道平均和乘積，怎麼找回兩個數？', '自己先想想看'); S.st.add('③ 已知平均、乘積 → 兩個數？', 'ptr'); },
  async (tok, S) => { cap('兩個數對稱地分在 7 的兩邊', '寫成 7 ± d（d 是距離）'); const c = dotBall(COL.k, 0.14); c.position.set(S.X(7), 2.0, 0); sm('7 ± d', S.X(7), 2.6); },
  async (tok, S) => { cap('乘積展開是平方差', '(7 + d)(7 − d) = 49 − d² = 40'); S.st.add('(7 + d)(7 − d) = 7² − d² = 40'); },
  async (tok, S) => { cap('d² = 49 − 40 = 9 → d = 3', '兩個特徵值 = 4 和 10'); await mpSpread(tok, S.X, 7, 3); S.st.ok(nearV(realEigs(T86), [10, 4], 1e-9), 'd = 3 → λ = 10、4 ✓（det(A − 4I) = 0）'); },
  async (tok, S) => { cap('包成通用公式', '平均 m、乘積 p：d² = m² − p'); S.st.add('一般：d² = m² − p'); },
  async (tok, S) => { cap('第三個事實', 'λ = m ± √(m² − p)'); S.st.add('λ = m ± √(m² − p)', 'ptr alt'); },
  async (tok, S) => { cap('其實就是平方差公式換個說法', '值得背起來，隨時拿來用'); S.st.add('（平方差公式的改寫，值得背）', 'idx'); },
]);

scene('tr-ex', '3B1B 15：用 mean–product 直接寫答案', [
  async (tok, S) => { cap('例：[3 1; 4 1]', '腦中先想好公式 λ = m ± √(m² − p)'); S.g = mgrid(TM, -6.0, 6.0, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); S.st = stack(-3.4, 6.2, 0.55); S.X = nline(-1, 5); },
  async (tok, S) => { cap('m = 3 和 1 的平均 = 2', '先寫下 2 ± √(2² − …)'); S.st.ok(near(mean2(TM), 2), 'm = (3 + 1)/2 = 2 ✓'); },
  async (tok, S) => { cap('p = det = 3·1 − 1·4 = −1', '最後填進去'); S.st.ok(near(det2(TM), -1), 'p = 3 − 4 = −1 ✓'); },
  async (tok, S) => { cap('λ = 2 ± √(4 + 1) = 2 ± √5', ''); await mpSpread(tok, S.X, 2, Math.sqrt(5)); S.st.ok(nearV(realEigs(TM), [2 + Math.sqrt(5), 2 - Math.sqrt(5)], 1e-9), 'λ = 2 ± √5 ✓'); },
  async (tok, S) => { cap('跟一開始同一個矩陣', '但直接多了'); S.st.add('跟特徵多項式算法答案一樣，但快很多', 'idx'); },
  async (tok, S) => {
    const M = [[2, 7], [1, 8]]; S.M = M;
    cap('再一個：[2 7; 1 8]', 'm = (2 + 8)/2 = 5'); gkill(S.g); S.g = mgrid(M, -6.0, 6.0, 0, { color: (i, j) => (i === j ? COL.g : '#e7dcc8') }); S.st.clear(); S.st = stack(-3.4, 6.2, 0.55);
    S.st.ok(near(mean2(M), 5), 'm = 5 ✓');
  },
  async (tok, S) => { cap('p = 2·8 − 7·1 = 9', ''); S.st.ok(near(det2(S.M), 9), 'p = 16 − 7 = 9 ✓'); },
  async (tok, S) => { cap('λ = 5 ± √(25 − 9) = 5 ± 4', '= 9 和 1'); S.X2 = nline(-1, 11, 0.6); await mpSpread(tok, S.X2, 5, 4, 0.6); S.st.ok(nearV(realEigs(S.M), [9, 1], 1e-9), 'λ = 9、1 ✓'); },
  async (tok, S) => { cap('盯著矩陣就能直接寫出特徵值', '最後只要一點點化簡'); S.st.add('看著矩陣直接寫答案', 'ptr alt'); },
]);

const C0 = [0, 0], C1 = [1, 0], Cm1 = [-1, 0], CI = [0, 1], CmI = [0, -1];
const PAULI = [[[C0, C1], [C1, C0]], [[C0, CmI], [CI, C0]], [[C1, C0], [C0, Cm1]]];
scene('tr-pauli', '3B1B 15：Pauli 自旋矩陣', [
  async (tok, S) => {
    cap('有趣的例子：量子力學的 Pauli spin matrices', 'σx = [0 1; 1 0]、σy = [0 −i; i 0]、σz = [1 0; 0 −1]');
    mtx([['0', '1'], ['1', '0']], -4.0, 5.4); mtx([['0', '−i'], ['i', '0']], 0, 5.4); mtx([['1', '0'], ['0', '−1']], 4.0, 5.4);
    sm('σx', -4.0, 6.3); sm('σy', 0, 6.3); sm('σz', 4.0, 6.3); S.st = stack(-5.6, 3.9, 0.55);
  },
  async (tok, S) => { cap('三個的對角線平均都是 0', '⇒ 特徵值平均 m = 0'); S.st.ok(PAULI.every((M) => near(M[0][0][0] + M[1][1][0], 0)), 'm = 0（三個都是）✓'); },
  async (tok, S) => { const ds = PAULI.map(cdet2); cap('行列式：0 − 1、0 − (−i)(i)、−1 − 0', '三個都是 −1（第二個要想一下：(−i)(i) = 1）'); S.st.ok(ds.every((d) => near(d[0], -1) && near(d[1], 0)), 'det σx = det σy = det σz = −1 ✓'); },
  async (tok, S) => { cap('λ = 0 ± √(0 − (−1)) = ±1', '其實平均 0、乘積 −1，一眼就看得出來'); S.st.ok(nearV(realEigs([[0, 1], [1, 0]]), [1, -1], 1e-9), 'λ = ±1 ✓'); },
  async (tok, S) => { cap('量子力學：量 x、y、z 方向的自旋', '只會量到 +1 或 −1，不會是中間的值'); S.st.add('物理意義：自旋量測只會得到 ±1', 'idx'); },
  async (tok, S) => { cap('不過這幾個用傳統方法也一樣快', 'det(σx − λI) = λ² − 1'); S.st.ok(nearV(charPoly([[0, 1], [1, 0]]), [1, 0, -1]), 'σx、σy：λ² − 1 = 0 ✓'); },
  async (tok, S) => { cap('σz 已經是對角矩陣', '對角線就是特徵值：1、−1'); S.st.add('σz 對角：直接讀出 1、−1'); },
  async (tok, S) => { cap('真正省力的是一般情況：組合起來', 'aσx + bσy + cσz = [c  a − bi; a + bi  −c]'); S.st.add('aσx + bσy + cσz = [c  a−bi; a+bi  −c]', 'ptr'); },
  async (tok, S) => { cap('(a, b, c) 是單位向量', 'a² + b² + c² = 1'); S.st.add('a² + b² + c² = 1'); },
  async (tok, S) => {
    const [a, b, c] = [0.48, 0.6, 0.64], M = [[[c, 0], [a, -b]], [[a, b], [-c, 0]]], d = cdet2(M);
    cap('平均還是 0；乘積 = −c² − (a² + b²) = −1', '所以特徵值還是 ±1');
    S.st.ok(near(a * a + b * b + c * c, 1, 1e-12) && near(d[0], -1, 1e-12) && near(d[1], 0, 1e-12), '示意 (a, b, c) = (0.48, 0.6, 0.64)：det = −1 → λ = ±1 ✓');
  },
  async (tok, S) => { cap('用特徵多項式就麻煩多了', '很難在腦中算'); S.st.add('特徵多項式算法：麻煩得多', 'idx'); },
]);

scene('tr-quad', '3B1B 15：mean–product 公式與二次方程式', [
  async (tok, S) => { cap('這跟解特徵多項式本質上一樣', '畢竟是同一個問題'); S.st = stack(-6.0, 6.6, 0.5); S.st.add('本質：解同一個二次方程式', 'ptr'); },
  async (tok, S) => { cap('mean–product 公式可以解任何二次方程式', ''); S.st.add('mean–product 公式 = 解二次方程式的方法'); },
  async (tok, S) => { cap('求二次式的根：其實是知道兩根的和與積', '要找回那兩個數'); S.st.add('二次式：已知兩根的「和」與「積」'); },
  async (tok, S) => { cap('首項係數 1 時：平均 = −½ × 一次項係數', '（示意 x² − 10x + 21）m = 5'); S.st.add('（示意）x² − 10x + 21：m = −½(−10) = 5'); },
  async (tok, S) => { cap('乘積就是常數項', 'p = 21 → 5 ± √(25 − 21) = 7、3'); S.X = nline(0, 10, 0.5); await mpSpread(tok, S.X, 5, 2, 0.5); const r = roots([1, -10, 21]); S.st.ok(r.every((z) => near(z[1], 0)) && nearV(r.map((z) => z[0]).sort((a, b) => b - a), [7, 3], 1e-6), 'x = 7、3 ✓（7 + 3 = 10、7 × 3 = 21）'); },
  async (tok, S) => { cap('像是輕量版的二次公式', '好處：每個符號都有意義'); S.st.add('比二次公式少記，而且每個符號有意義'); },
  async (tok, S) => { cap('矩陣直接讀出 m、p', '跳過寫特徵多項式這一步'); S.st.add('矩陣 → 直接讀 m、p → 寫出 λ', 'ptr alt'); },
  async (tok, S) => { cap('順便複習：trace = 和、det = 積', ''); S.st.add('trace = λ₁ + λ₂、det = λ₁λ₂', 'ptr'); },
  async (tok, S) => {
    const [a, b, c, d] = [5, 2, 3, 7], cp = charPoly([[a, b], [c, d]]);
    cap('想證明？展開一般 2×2 的特徵多項式', 'det(A − λI) = λ² − (a + d)λ + (ad − bc)');
    S.st.ok(nearV(cp, [1, -(a + d), a * d - b * c]), '一次項係數 = −trace、常數項 = det ✓（示意 [5 2; 3 7]）');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '線性代數・第 6 章',
    title: '特徵值與特徵向量',
    color: 'var(--la)',
    modes: [
      { id: 'find', name: '找特徵向量', enter: enterFind },
      { id: 'power', name: 'Aᵏ 疊代', enter: enterPower },
      { id: 'markov', name: 'Markov 人口流動', enter: enterMarkov },
      { id: 'diag', name: '對角化檢查', enter: enterDiag },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'eigen-intro', 'char-poly', 'rotation-complex', 'eigen-3d', 'trace-det-trick', 'row-ops-trap',
      'diag-as-slambda', 'powers-ak', 'stability', 'distinct-eigen', 'defective', 'uk-expansion', 'fibonacci-matrix', 'fibonacci-growth',
      'markov-props', 'markov-steady', 'markov-why-one', 'cal-mass', 'orthonormal-expand', 'fourier',
      'similar-matrices', 'jordan-form',
    ].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
