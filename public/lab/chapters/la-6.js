// 線性代數 第6章：特徵值與特徵向量（det(A − λI) = 0、對角化 A = SΛS⁻¹、Aᵏ、Fibonacci、Markov、相似與 Jordan form）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 座標慣例：3D 的 (x, y, z) 畫成 world (x, z, −y)；2D 平面平放在地上，(x, y) → world (x, 0, −y)。
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
    ],
    stop() { gen++; },
  };
}
