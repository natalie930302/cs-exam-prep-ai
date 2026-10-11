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
      if (p < 0) { steps.push({ text: '第 ' + (c + 1) + ' 欄在第 ' + (r + 1) + ' 列以下全是 0 → 自由欄', A: snap(), row: -1, col: c }); continue; }
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
    if (!(a >= 0 && a <= 1 && b >= 0 && b <= 1)) { log('留下的比例要在 0 到 1 之間（Markov：每欄非負、加起來 = 1）。', true); return; }
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
      'λ = 1 的特徵向量 = 穩定狀態；另一個 λ = ' + fmt(Math.round(l2 * 1000) / 1000) + ' 的部分每年乘 ' + fmt(Math.round(l2 * 1000) / 1000) + ' 消失<br>總人數不變（每欄和 = 1）');
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
      log('S 的欄 = 特徵向量（' + E.groups.map((x) => x.vecs.map(vstr).join(' ')).join(' ') + '），Λ 的對角 = 特徵值。');
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
      const a = ri(-2, 4), d = l1 + l2 - a, bc = a * d - l1 * l2; // 選 b、c 使 bc 符合
      const b = pick([1, -1, 2, -2].filter((x) => bc % x === 0)) || 1, c = bc / b;
      const ans = '{' + Math.max(l1, l2) + ', ' + Math.min(l1, l2) + '}';
      return { q: 'A = [' + a + ' ' + b + '; ' + c + ' ' + d + ']，特徵值是？', opts: [...new Set([ans, '{' + a + ', ' + d + '}', '{' + (l1 + 1) + ', ' + (l2 - 1) + '}', '{' + (-l1) + ', ' + (-l2) + '}'])], ans, why: 'λ₁ + λ₂ = trace = ' + (a + d) + '，λ₁λ₂ = det = ' + (a * d - b * c) + ' → λ² − ' + (a + d) + 'λ + ' + (a * d - b * c) + ' = 0。' };
    }
    if (k < 0.28) {
      const a = ri(-3, 4), d = ri(-3, 4), f = ri(-3, 4), b = ri(-5, 5), c = ri(-5, 5), e = ri(-5, 5);
      const ans = '{' + [a, d, f].join(', ') + '}';
      return { q: '上三角矩陣 [' + a + ' ' + b + ' ' + c + '; 0 ' + d + ' ' + e + '; 0 0 ' + f + '] 的特徵值是？', opts: [...new Set([ans, '{' + [b, c, e].join(', ') + '}', '{' + [a + b + c, d + e, f].join(', ') + '}', '{' + [a, d + e, f].join(', ') + '}'])], ans, why: '三角矩陣的 det(A − λI) = (a − λ)(d − λ)(f − λ)，特徵值就在對角線上。' };
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
      return { q: 'Markov 矩陣 A = [' + a + ' ' + fmt(Math.round((1 - b) * 10) / 10) + '; ' + fmt(Math.round((1 - a) * 10) / 10) + ' ' + b + ']，總人口 1000。長期下來第一個狀態有幾人（四捨五入）？', opts: [...new Set([ans, String(Math.round((1 - a) / (2 - a - b) * N)), '500', String(Math.round(a * N))])], ans, why: '穩定狀態 = λ = 1 的特徵向量 ∝ (' + fmt(Math.round((1 - b) * 10) / 10) + ', ' + fmt(Math.round((1 - a) * 10) / 10) + ')，再縮放成總和 1000。另一個特徵值 = trace − 1 = ' + fmt(Math.round((a + b - 1) * 10) / 10) + '。' };
    }
    if (k < 0.8) {
      const S = [['相似矩陣 B = M⁻¹AM 和 A 有相同的特徵值', '對'], ['列運算（例如 R2 − 2R1）不會改變特徵值', '錯'], ['A 和 Aᵀ 有相同的特徵值', '對'], ['A 和 Aᵀ 有相同的特徵向量', '錯'], ['特徵值都相異 ⇒ 特徵向量線性獨立', '對'], ['有重根 ⇒ 一定不能對角化', '錯'], ['Markov 矩陣一定有 λ = 1', '對'], ['實數矩陣的特徵值一定是實數', '錯']];
      const [s, a] = pick(S);
      return { q: '對或錯：' + s, opts: ['對', '錯'], ans: a, why: { '相似矩陣 B = M⁻¹AM 和 A 有相同的特徵值': 'det(M⁻¹AM − λI) = det(M⁻¹(A − λI)M) = det(A − λI)。', '列運算（例如 R2 − 2R1）不會改變特徵值': '列運算會改變特徵值：[2 1; 1 2] 的特徵值 3、1，做 R2 − ½R1 後變 [2 1; 0 1.5]，特徵值 2、1.5。', 'A 和 Aᵀ 有相同的特徵值': 'det(A − λI) = det((A − λI)ᵀ) = det(Aᵀ − λI)。', 'A 和 Aᵀ 有相同的特徵向量': '一般不同；例如 Markov：Aᵀ 的 λ = 1 特徵向量是 (1, 1, …, 1)，A 的是穩定狀態。', '特徵值都相異 ⇒ 特徵向量線性獨立': '相異特徵值對應的特徵向量一定獨立，所以一定可對角化。', '有重根 ⇒ 一定不能對角化': '單位矩陣 I 的特徵值全是 1，但每個向量都是特徵向量，本來就是對角矩陣。', 'Markov 矩陣一定有 λ = 1': 'A − I 每欄和為 0 → 列相加 = 零列 → 奇異。', '實數矩陣的特徵值一定是實數': '旋轉 90° [0 −1; 1 0] 的特徵值是 ±i。' }[s] };
    }
    const tr = ri(-3, 6), dt = ri(-6, 8);
    const which = pick(['sum', 'prod']);
    return { q: '2×2 矩陣 trace = ' + tr + '、det = ' + dt + '。特徵值的' + (which === 'sum' ? '和' : '乘積') + '是？', opts: [...new Set([String(which === 'sum' ? tr : dt), String(which === 'sum' ? dt : tr), String(-tr), String(tr * tr - 4 * dt)])], ans: String(which === 'sum' ? tr : dt), why: 'λ₁ + λ₂ = trace，λ₁λ₂ = det（3B1B 的快速算法：λ = m ± √(m² − p)，m = trace/2、p = det）。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
    say('有 n 個獨立特徵向量 → 放進 S 的欄', '示範用 A = [2 1; 1 2]：x₁ = (1, 1)、x₂ = (1, −1)');
    const gA = mgrid(A, -6.4, 5.2, 0, { color: () => COL.a }); tag('A', 'ptr', -6, 5.9);
    const gS = mgrid([[1, 1], [1, -1]], -4.4, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('S', 'ptr', -4, 5.9);
    tag('=', 'val', -2.5, 4.8);
    const R = mgrid([['', ''], ['', '']], -1.8, 5.2, 0, { color: (i, j) => [COL.d, COL.r][j] }); tag('AS', 'ptr', -1.4, 5.9);
    await beat(tok, 2800);
    const cols = [[[3, 3], 'A x₁ = (3, 3) = 3·x₁'], [[1, -1], 'A x₂ = (1, −1) = 1·x₂']];
    for (let j = 0; j < 2; j++) {
      gS.col(j, GOLD);
      cols[j][0].forEach((v, i) => R.set(i, j, v)); R.col(j, GOLD);
      say('一次算一欄：A 乘第 ' + (j + 1) + ' 個特徵向量', cols[j][1]);
      await beat(tok, 2200); gS.clearGlow(); R.clearGlow();
    }
    say('把 λ 從欄裡提出來，放到右邊', 'AS = [λ₁x₁ λ₂x₂] = SΛ');
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
    say('差分方程 u_{k+1} = A u_k', '答案：u_k = Aᵏu₀，但怎麼真的算出來？');
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
    say('Fibonacci：0, 1, 1, 2, 3, 5, 8, 13, …', 'F_{k+2} = F_{k+1} + F_k；F₁₀₀ 是多少？長多快？');
    const cs = [];
    for (let k = 0; k < F.length; k++) { cs.push(cube(F[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2)); tag('F' + k, 'idx', -6 + k * 0.9, 5.3); await beat(tok, 380); }
    await beat(tok, 1200);
    say('二階的純量方程 → 一階的 2×2 系統', '令 u_k = (F_{k+1}, F_k)，補一條 F_{k+1} = F_{k+1}');
    mono(tag('[F_{k+2}]   [1 1] [F_{k+1}]', '', -2.6, 4.1)); mono(tag('[F_{k+1}] = [1 0] [F_k    ]', '', -2.6, 3.55));
    await beat(tok, 3200);
    const g = mgrid([[1, 1], [1, 0]], 2.6, 4.2, 0, { color: () => COL.b }); tag('A', 'ptr', 3.0, 4.9);
    say('A = [1 1; 1 0]，u_{k+1} = A u_k', 'A 對稱 → 特徵值是實數');
    await beat(tok, 2600);
    mono(tag('det(A − λI) = λ² − λ − 1 = 0', 'ptr', 0, 2.5));
    say('跟遞迴式 F_{k+2} − F_{k+1} − F_k = 0 長得一樣', '');
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
      say('性質 2：每一欄加起來 = 1', MK.map((r) => r[j]).join(' + ') + ' = 1');
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
    say('對角線各減 1：A − I', '每一欄加起來變成 0');
    await beat(tok, 2600);
    say('欄和全 0 ⇒ 三列相加 = 零列', '(1, 1, 1) 乘上各列：列1 + 列2 + 列3 = 0');
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
    say('矩陣語言：Qx = v ⇒ x = Q⁻¹v = Qᵀv', 'Q 的欄標準正交 ⇒ Q⁻¹ = Qᵀ，不用解方程式');
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
    say('函數的內積：把 Σ vᵢwᵢ 換成 ∫₀^{2π} f(x)g(x) dx', '週期 2π');
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
    say('a₁ = (1/π)∫₀^{2π} f(x) cos x dx = 1.2', '跟 x₁ = q₁ᵀv 完全同一個想法');
    await beat(tok, 2800);
    say('a₀ = f 的平均值', '');
    await beat(tok, 2000);
  }

  // ─── 課本補充（沒有逐字稿的影片：L21、3Blue1Brown、L28）───
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
    say('地雷：不能先列運算再求特徵值', '列運算會改變特徵值（det 只看倍率，不看 λ）');
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
    say('另外兩個特徵值是複數 e^{±2πi/3}', '三個特徵值乘積 = det = 1，和 = trace = 0');
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
    say('（課本補充：Strang L28 的內容，影片無逐字稿）', '');
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
    say('列運算只保留 det 的資訊（甚至會變號）', 'trace、特徵值都不保留');
    await beat(tok, 2600);
  }

  const scenes = {
    'diag-as-slambda': { title: 'AS = SΛ：一次一欄', play: scDiagASSL },
    'powers-ak': { title: 'Aᵏ = SΛᵏS⁻¹：特徵值變 λᵏ', play: scPowers },
    'stability': { title: 'Aᵏ → 0 ⇔ 所有 |λ| < 1', play: scStability },
    'distinct-eigen': { title: '相異特徵值 ⇒ 獨立特徵向量；I 的重根', play: scDistinct },
    'defective': { title: '[2 1; 0 2]：代數重數 2、幾何重數 1', play: scDefective },
    'uk-expansion': { title: 'u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂', play: scUkExpansion },
    'fibonacci-matrix': { title: 'Fibonacci 化成 u_{k+1} = Au_k', play: scFibMatrix },
    'fibonacci-growth': { title: 'Fibonacci 的成長率 = 1.618', play: scFibGrowth },
    'markov-props': { title: 'Markov 矩陣：非負、欄和 = 1', play: scMarkovProps },
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
  scene('l22-diag', 'L22：AS = SΛ → A = SΛS⁻¹（一次一欄）', [
    async (tok, S) => { cap('第二講：怎麼用 Ax = λx', 'x = 特徵向量、λ = 特徵值'); ctr('上一講：Ax = λx', 6.3, hd); },
    async (tok, S) => { cap('第一步永遠是：找出 λ 和 x', '找到之後呢？'); },
    async (tok, S) => { cap('好方法：把矩陣對角化', 'diagonalize'); ctr('目標：對角化（diagonalize）', 3.2, hot); },
    async (tok, S) => {
      cap('特徵向量放進 S 的每一欄', '示意 A = [2 1; 1 2]：x₁ = (1, 1)、x₂ = (1, −1)');
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
      const y = mulMV(A, [1, 1]); cap('一次算一欄：A 乘第 1 個特徵向量', 'Ax₁ = λ₁x₁');
      S.gS.col(0, GOLD); y.forEach((v, i) => S.R.set(i, 0, v)); S.R.col(0, GOLD);
      S.c1 = ok(nearV(y, scl([1, 1], 3)), 'Ax₁ = (3, 3) = 3·x₁ ✓', -1.2, 2.5);
    },
    async (tok, S) => {
      const y = mulMV(A, [1, -1]); cap('第 2 欄、…、第 n 欄都一樣', 'Ax₂ = λ₂x₂'); S.gS.clearGlow(); S.R.clearGlow();
      S.gS.col(1, GOLD); y.forEach((v, i) => S.R.set(i, 1, v)); S.R.col(1, GOLD);
      S.c2 = ok(nearV(y, scl([1, -1], 1)), 'Ax₂ = (1, −1) = 1·x₂ ✓', -1.2, 1.8);
    },
    async (tok, S) => { S.gS.clearGlow(); S.R.clearGlow(); cap('下一步：把 λ 從 x 分開', 'AS = [λ₁x₁ λ₂x₂]'); },
    async (tok, S) => {
      cap('λ₁ 乘第一欄 → 放到右邊的對角矩陣', '第一個位置 λ₁，其他是 0');
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
  scene('l22-uk', 'L22：u_{k+1} = Au_k → u_k = c₁λ₁ᵏx₁ + c₂λ₂ᵏx₂', [
    async (tok, S) => { cap('可以對角化的重要情況', '來解一個方程式'); S.F = plane2(); S.F.line([1, 1], COL.d); S.F.line([1, -1], COL.r); row(sm, '示意 A = [1 0.5; 0.5 1]', 0); },
    async (tok, S) => { cap('從 u₀ 開始，每一步乘 A', 'u_{k+1} = Au_k'); S.au = S.F.arrow(u0, COL.k, 'u₀'); row(hd, 'u_{k+1} = A u_k', 1); },
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
  scene('l22-fib1', 'L22：Fibonacci 化成 u_{k+1} = Au_k；λ = (1 ± √5)/2', [
    async (tok, S) => { cap('例子：Fibonacci 數列', ''); S.cs = []; },
    async (tok, S) => { cap('F₀ = 0、F₁ = 1', ''); for (let k = 0; k < 2; k++) { S.cs.push(cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2)); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('下一個 = 前兩個相加', '0 + 1 = 1'); S.cs.push(cube(1, COL.a, [0.7, 0.7, 0.7], -6 + 2 * 0.9, 6.0, 0, 2)); sm('F2', -6 + 1.8, 5.3); },
    async (tok, S) => { cap('1 + 1 = 2、1 + 2 = 3', '看起來像 1, 2, 3, 4…？'); for (let k = 3; k <= 4; k++) { cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('不是：5、8、13…', ''); for (let k = 5; k <= 7; k++) { cube(fib[k], COL.a, [0.7, 0.7, 0.7], -6 + k * 0.9, 6.0, 0, 2); sm('F' + k, -6 + k * 0.9, 5.3); } },
    async (tok, S) => { cap('F₁₀₀ 是多少？', ''); hot('F₁₀₀ = ?', 2.0, 6.0); },
    async (tok, S) => { cap('長得多快？一定在長', '不穩定：特徵值不會都小於 1'); },
    async (tok, S) => { cap('答案在特徵值裡：先找出矩陣', ''); },
    async (tok, S) => { cap('F_{k+2} = F_{k+1} + F_k', '一條方程式、二階'); S.e1 = ctr(hd, 'F_{k+2} = F_{k+1} + F_k　（純量、二階）', 4.4); },
    async (tok, S) => { cap('小技巧：令 u_k = (F_{k+1}, F_k)', '把未知數變成向量'); ctr(pl, 'u_k = (F_{k+1}, F_k)', 3.7); },
    async (tok, S) => { cap('再加一條：F_{k+1} = F_{k+1}', '得到 2×2 的一階系統'); ctr(pl, '補一條：F_{k+1} = F_{k+1}', 3.0); },
    async (tok, S) => {
      cap('矩陣 A = [1 1; 1 0]', 'u_{k+1} = Au_k'); S.g = mgrid(A, 3.6, 4.6, 0, { color: () => COL.b }); tag('A', 'ptr', 4.0, 5.3);
      const u6 = mulMV(powM(A, 6), [1, 0]); ok(nearV(u6, [fib[7], fib[6]]), 'A⁶(1, 0) = (13, 8) ✓', 4.0, 3.1);
    },
    async (tok, S) => { cap('二階純量 → 一階 2×2 系統', ''); },
    async (tok, S) => { cap('A 對稱 → 特徵值是實數', '特徵向量互相垂直'); ctr(sm, 'A 對稱 → λ 實數、特徵向量垂直', 2.3); },
    async (tok, S) => { cap('λ₁ + λ₂ = trace = 1', 'λ₁λ₂ = det = −1'); ctr(pl, 'λ₁ + λ₂ = trace = ' + fmt(trM(A)) + '　λ₁λ₂ = det = ' + fmt(det2(A)), 1.6); },
    async (tok, S) => { cap('det(A − λI) = λ² − λ − 1', ''); ctr((t, x, y) => ok(nearV(charPoly(A), [1, -1, -1]), t, x, y), 'det(A − λI) = λ² − λ − 1 ✓', 0.9); },
    async (tok, S) => { cap('跟遞迴式長得一樣', 'F_{k+2} − F_{k+1} − F_k = 0'); S.g.c.forEach((r) => r.forEach((m) => glow(m, GOLD))); ctr(note, 'λ² − λ − 1 ↔ F_{k+2} − F_{k+1} − F_k', 0.2); },
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
  async (tok, S) => { cap('關鍵：解是指數函數 e^{λt}', '要找的是指數上的 λ 和前面的向量'); ctr(hot, '找 u = e^{λt}x', 4.6); },
  async (tok, S) => { cap('完全平行於矩陣的冪次', '上一講：Aᵏ、A¹⁰⁰'); ctr(pl, '上一講：u_{k+1} = Au_k → λᵏ', 3.4, -3); ctr(pl, '這一講：du/dt = Au → e^{λt}', 3.4, 3); },
  async (tok, S) => { cap('不是次方，而是指數', '微分方程自然的東西'); ctr(note, 'λᵏ（次方） ↔ e^{λt}（指數）', 2.2); },
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
  async (tok, S) => { cap('第二欄 = −2 × 第一欄', ''); row(ok, nearV([A23[0][1], A23[1][1]], scl([A23[0][0], A23[1][0]], -2)), '第 2 欄 = −2 × 第 1 欄 ✓', 4); },
  async (tok, S) => { cap('trace = −3 → 另一個 λ = −3', '0 + λ₂ = −3'); row(ok, trM(A23) === -3, 'trace = −1 − 2 = −3 → λ₂ = −3 ✓', 5); },
  async (tok, S) => { cap('照算：det(A − λI) = λ² + 3λ', ''); row(ok, nearV(charPoly(A23), [1, 3, 0]), 'det(A − λI) = λ² + 3λ ✓', 6); },
  async (tok, S) => { const rs = roots(charPoly(A23)).map((z) => z[0]).sort((a, b) => b - a); cap('λ(λ + 3)：λ₁ = 0、λ₂ = −3', ''); row(ok, nearV(rs, [0, -3]), 'λ(λ + 3) = 0 → λ₁ = 0、λ₂ = −3 ✓', 7); },
  async (tok, S) => { cap('e^{−3t} 會消失、e^{0t} = 1 不動', '→ 穩定狀態（steady state）'); S.nt = note('e^{−3t} → 0；e^{0t} = 1', 5.5, R(1)); },
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
scene('l23-sol', 'L23：u(t) = ⅓(2, 1) + ⅓e^{−3t}(1, −1)', [
  async (tok, S) => { cap('答案 u(t) 是什麼？', ''); S.F = plane2(-3.4, 3.0, 0.8, 3); S.F.line(X1, COL.d); S.F.line(X2, COL.r); },
  async (tok, S) => { cap('兩個純指數解', 'e^{λ₁t}x₁ 和 e^{λ₂t}x₂'); S.n = mark(); row(hd, '純解：e^{λ₁t}x₁、e^{λ₂t}x₂', 0); },
  async (tok, S) => { cap('一般解：兩個的組合', ''); row(hot, 'u(t) = c₁e^{λ₁t}x₁ + c₂e^{λ₂t}x₂', 1); },
  async (tok, S) => { cap('檢查：代進 du/dt = Au', '試 u = e^{λ₁t}x₁'); row(pl, '代入 du/dt = Au', 2); },
  async (tok, S) => {
    const t = 0.4, u = scl(X2, Math.exp(-3 * t)), lhs = scl(u, -3), rhs = mulMV(A23, u);
    cap('左邊：微分拿下一個 λ₁；右邊 Ax₁ = λ₁x₁', '兩邊一樣');
    row(ok, nearV(lhs, rhs, 1e-12), '例 e^{−3t}x₂：d/dt = −3e^{−3t}x₂ = A(e^{−3t}x₂) ✓', 3);
  },
  async (tok, S) => { cap('類比上一講的純冪次', 'λ₁ᵏx₁ ↔ e^{λ₁t}x₁'); row(note, '差分：λᵏx　微分：e^{λt}x', 4); },
  async (tok, S) => { cap('c₁、c₂ 是多少？', ''); },
  async (tok, S) => { cap('代入這個例子', 'λ₁ = 0：e^{0t} = 1；λ₂ = −3'); row(pl, 'u(t) = c₁·1·(2, 1) + c₂e^{−3t}(1, −1)', 5); },
  async (tok, S) => { cap('c 由初始條件決定', 'u(0) = (1, 0)'); },
  async (tok, S) => { cap('t = 0：c₁(2, 1) + c₂(1, −1) = (1, 0)', ''); row(pl, 't = 0：c₁(2, 1) + c₂(1, −1) = (1, 0)', 6); },
  async (tok, S) => { const c = mulMV(inv2(S23), [1, 0]); cap('都是 1 → (3, 0)；所以各取 1/3', 'c₁ = c₂ = 1/3'); row(ok, nearV(c, [1 / 3, 1 / 3]), 'c₁ = 1/3、c₂ = 1/3 ✓', 7); },
  async (tok, S) => {
    cap('答案：u(t) = ⅓(2, 1) + ⅓e^{−3t}(1, −1)', ''); const okk = [0, 0.3, 1].every((t) => nearV(du23(t), mulMV(A23, u23(t)), 1e-12)) && nearV(u23(0), [1, 0], 1e-12);
    wipe(S.n); row(hot, 'u(t) = ⅓(2, 1) + ⅓e^{−3t}(1, −1)', 0); row(ok, okk, 'u(0) = (1, 0)、du/dt = Au ✓', 1);
  },
  async (tok, S) => {
    cap('從 (1, 0) 出發，慢慢流向 u₂', '一部分「人」搬過去'); S.au = S.F.arrow(u23(0), COL.k, 'u(t)');
    await anim(tok, 2400, (s) => { const t = s * 2; S.F.set(S.au, u23(t)); });
    S.au.tag('u(2)');
  },
  async (tok, S) => { const ui = [2 / 3, 1 / 3]; cap('t → ∞：e^{−3t} 消失', '穩定狀態 u(∞) = (2/3, 1/3)'); S.F.dot(ui, COL.g, 0.12); row(ok, nearV(u23(40), ui, 1e-12), 'u(∞) = ⅓(2, 1) = (2/3, 1/3) ✓', 2); },
]);
// L23-4：穩定、穩定狀態、爆掉（複數平面）
scene('l23-stab', 'L23：穩定 ⇔ Re λ < 0（複數平面）', [
  async (tok, S) => { cap('不一定有穩定狀態', '可能趨近 0，也可能爆掉'); S.F = plane2(-3.4, 3.0, 0.3, 7.5); S.F.lab('Re', [7.4, -0.6]); S.F.lab('Im', [0.7, 7.2]); },
  async (tok, S) => { cap('穩定：u(t) → 0', '不管初始條件'); row(hd, '穩定：u(t) → 0', 0); },
  async (tok, S) => { cap('負的特徵值', 'e^{λt} → 0'); S.F.dot([-3, 0], COL.d, 0.13); row(pl, 'λ < 0：e^{λt} → 0', 1); },
  async (tok, S) => { cap('如果 λ 是複數呢？', ''); },
  async (tok, S) => { cap('例：λ = −3 + 6i', ''); S.F.dot([-3, 6], COL.c, 0.13); S.F.lab('−3 + 6i', [-3, 6.9], 'ptr'); },
  async (tok, S) => {
    const t = 0.5, re = Math.exp(-3 * t) * Math.cos(6 * t), im = Math.exp(-3 * t) * Math.sin(6 * t);
    cap('|e^{(−3+6i)t}| = e^{−3t}', '虛部不影響大小'); row(ok, near(Math.hypot(re, im), Math.exp(-3 * t), 1e-12), 't = 0.5：|e^{(−3+6i)t}| = e^{−1.5} ✓', 2);
  },
  async (tok, S) => {
    cap('e^{6it} = cos 6t + i sin 6t', '在單位圓上繞，大小永遠 1'); const c = new THREE.Mesh(new THREE.RingGeometry(1 * S.F.s - 0.012, 1 * S.F.s + 0.012, 48), new THREE.MeshBasicMaterial({ color: COL.k })); c.position.copy(S.F.w([0, 0], 0.02)); lab.world.add(c);
    const d = S.F.dot([1, 0], COL.b, 0.1); await anim(tok, 2000, (s) => d.position.copy(S.F.w([Math.cos(6 * s), Math.sin(6 * s)], 0.08)));
    row(ok, near(Math.cos(6) ** 2 + Math.sin(6) ** 2, 1), 'cos² + sin² = 1 ✓', 3);
  },
  async (tok, S) => { cap('重要的是實部：Re λ < 0', ''); S.lh = rect(S.F, [-7.5, -7.5], [0, 7.5], COL.d, 0.14); row(hot, '穩定 ⇔ 所有 Re λ < 0', 4); },
  async (tok, S) => { cap('虛部只讓兩個分量來回振盪', ''); row(sm, '虛部 → 振盪', 5); },
  async (tok, S) => { cap('穩定狀態：λ₁ = 0、其他 Re λ < 0', '剛才的例子：0 和 −3'); S.F.dot([0, 0], COL.g, 0.15); row(pl, '穩定狀態：λ₁ = 0，其他 Re λ < 0', 6); },
  async (tok, S) => { cap('任何一個 Re λ > 0 → 爆掉', ''); rect(S.F, [0, -7.5], [7.5, 7.5], COL.r, 0.1); row(bad, '有 Re λ > 0 → 爆掉', 7); },
  async (tok, S) => {
    const E = eigInfo(sclM(A23, -1)).groups.map((g) => g.re); cap('把 A 全部變號：特徵值也變號', '−A：λ = 0、+3 → e^{3t} 爆掉');
    S.F.dot([3, 0], COL.r, 0.13); row(ok, nearV(E, [3, 0]), '−A 的 λ = 3、0 ✓ → e^{3t} 爆掉', 5);
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
    const B = [[-2, 0], [0, 1]], E = eigInfo(B).groups.map((g) => g.re); cap('[−2 0; 0 1]：trace = −1', '但 λ = 1 → e^{t} 爆掉');
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
scene('l23-uncouple', 'L23：u = Sv：解耦 → u(t) = Se^{Λt}S⁻¹u(0)', [
  async (tok, S) => { cap('核心步驟：解這個系統', '找 λ、找 x、找 c'); ctr(hd, '找 λ → 找 x → 找 c', 6.0); },
  async (tok, S) => { cap('求 c 的那兩條方程式', '寫成矩陣形式'); ctr(pl, 'c₁(2, 1) + c₂(1, −1) = (1, 0)', 5.3); },
  async (tok, S) => { cap('矩陣就是 S：特徵向量矩陣', 'Sc = u(0)'); ctr((t, x, y) => ok(nearV(mulMV(S23, [1 / 3, 1 / 3]), [1, 0]), t, x, y), 'S = [2 1; 1 −1]：Sc = u(0)，c = (1/3, 1/3) ✓', 4.6); },
  async (tok, S) => { cap('c 說每個純指數佔多少', '起點對了，之後各走各的'); },
  async (tok, S) => { cap('A 把 u₁、u₂ 綁在一起（coupled）', '特徵向量把它們解開（uncouple）'); ctr(note, 'coupled → uncouple = 對角化', 3.9); },
  async (tok, S) => { cap('du/dt = Au，令 u = Sv', ''); ctr(hot, 'du/dt = Au，令 u = Sv', 3.2); },
  async (tok, S) => { cap('S 是常數：S dv/dt = ASv', ''); ctr(pl, 'S dv/dt = A S v', 2.6); },
  async (tok, S) => { cap('左乘 S⁻¹：dv/dt = S⁻¹ASv = Λv', ''); ctr((t, x, y) => ok(nearM(mm(inv2(S23), mm(A23, S23)), diagM([0, -3])), t, x, y), 'dv/dt = S⁻¹AS v = Λv，Λ = diag(0, −3) ✓', 2.0); },
  async (tok, S) => { cap('dv₁/dt = λ₁v₁、…：彼此不相連', ''); ctr(pl, 'dv₁/dt = λ₁v₁　dv₂/dt = λ₂v₂', 1.4); },
  async (tok, S) => { cap('每條都好解：v(t) = e^{Λt}v(0)', ''); ctr(pl, 'v(t) = e^{Λt} v(0)', 0.8); },
  async (tok, S) => {
    cap('u(t) = Se^{Λt}S⁻¹u(0)', ''); const okk = [0.2, 1].every((t) => nearV(mulMV(eAt(t), [1, 0]), u23(t), 1e-12));
    ok(okk, 'u(t) = S e^{Λt} S⁻¹ u(0) ✓', 3.6, 0.1);
  },
  async (tok, S) => { cap('Se^{Λt}S⁻¹ 就是 e^{At}', ''); hot('e^{At} = S e^{Λt} S⁻¹', -3.6, 0.1); },
  async (tok, S) => { cap('可是「e 的矩陣次方」是什麼意思？', '接下來定義它'); },
]);
// L23-7：e^{At} 的級數
scene('l23-exp', 'L23：e^{At} = I + At + (At)²/2! + … = Se^{Λt}S⁻¹', [
  async (tok, S) => { cap('矩陣的指數是什麼？', ''); ctr(hd, 'e^{At} = ?', 6.1); },
  async (tok, S) => { cap('回到冪級數', 'e^x = 1 + x + x²/2 + x³/6 + …'); ctr(pl, 'eˣ = 1 + x + x²/2 + x³/6 + …', 5.5); },
  async (tok, S) => { cap('換成矩陣：1 → I、x → At', ''); ctr(hot, 'e^{At} = I + At + (At)²/2 + (At)³/6 + …', 4.9); },
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
  async (tok, S) => { [S.g1, S.g2, S.g3].forEach(ln); cap('主角是 e^{At}', '怎麼看出它 = Se^{Λt}S⁻¹？'); },
  async (tok, S) => { cap('用這章的基本公式 A = SΛS⁻¹', 'At = SΛS⁻¹t'); ctr(pl, 'At = SΛS⁻¹ t', 2.2, -3); },
  async (tok, S) => { cap('A²t²/2 = SΛ²S⁻¹ t²/2', 'S⁻¹S 消掉'); ctr(pl, '(At)²/2 = SΛ²S⁻¹ t²/2', 1.6, -3); },
  async (tok, S) => { cap('把 S 拉到左邊、S⁻¹ 拉到右邊', 'I 寫成 SS⁻¹'); ctr(pl, 'I = SS⁻¹', 1.0, -3); },
  async (tok, S) => {
    const t = 0.5, lhs = expSeries(sclM(A23, t)), rhs = eAt(t); cap('中間剩 I + Λt + (Λt)²/2 + … = e^{Λt}', 'e^{At} = Se^{Λt}S⁻¹');
    ctr((a, x, y) => ok(nearM(lhs, rhs, 1e-10), a, x, y), 't = 0.5：級數 = S e^{Λt} S⁻¹ ✓', 1.6, 3);
  },
  async (tok, S) => { cap('這個公式永遠成立嗎？', '前提：A 可以對角化'); ctr(note, '前提：n 個獨立特徵向量', 1.0, 3); },
  async (tok, S) => { cap('特徵向量不夠的矩陣：S⁻¹ 不存在', '只能化成三角形（之後講）'); ctr(sm, '級數定義永遠可用；SΛS⁻¹ 版本不一定', 0.3); },
]);
// L23-8：e^{Λt}、穩定區域
scene('l23-region', 'L23：e^{Λt} 是對角的；穩定區域：左半平面 vs 單位圓', [
  async (tok, S) => { cap('e^{Λt} 是什麼？', ''); S.F = plane2(-3.4, 3.0, 0.62, 3.8); S.F.lab('Re', [3.7, -0.4]); S.F.lab('Im', [0.4, 3.6]); },
  async (tok, S) => { cap('Λ 是對角矩陣：λ₁ … λₙ', ''); row(hd, 'Λ = diag(λ₁, …, λₙ)', 0); },
  async (tok, S) => {
    const t = 0.7, E = expSeries(sclM(diagM([0, -3]), t)); cap('對角矩陣的指數：各自取指數', 'e^{Λt} = diag(e^{λ₁t}, …)');
    row(ok, nearM(E, diagM([1, Math.exp(-3 * t)]), 1e-12), '例 Λ = diag(0, −3)：e^{Λt} = diag(1, e^{−3t}) ✓', 1);
  },
  async (tok, S) => { cap('就是前半堂具體例子的公式版', ''); },
  async (tok, S) => { cap('e^{At} 什麼時候 → 0？', 'S、S⁻¹ 不動，看 e^{Λt}'); },
  async (tok, S) => { cap('每個 e^{λt} 都要 → 0', '所有 Re λ < 0'); row(hot, 'e^{At} → 0 ⇔ 所有 Re λ < 0', 2); },
  async (tok, S) => { cap('畫出複數平面', '橫軸實部、縱軸虛部'); },
  async (tok, S) => { cap('微分方程的穩定區域：左半平面', 'Re λ < 0'); rect(S.F, [-3.8, -3.8], [0, 3.8], COL.d, 0.18); row(pl, '微分方程：左半平面 Re λ < 0', 3); },
  async (tok, S) => { cap('冪次的穩定區域：單位圓內', '|λ| < 1'); disk(S.F, 1, COL.b, 0.3); row(pl, '冪次 Aᵏ：單位圓內 |λ| < 1', 4); },
  async (tok, S) => {
    cap('|λ| < 1 → Aᵏ → 0；Re λ < 0 → e^{At} → 0', '兩個平行的故事');
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
  async (tok, S) => { cap('次方 ↔ 指數：平行的兩講', '現在也會做指數了'); ctr(note, 'Aᵏ ↔ e^{At}', 1.2); },
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
