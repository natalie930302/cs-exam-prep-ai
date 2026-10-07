// 線性代數 第5章：線性變換（Linear Map、Matrix Representation、Kernel/Image、換基底、叉積的對偶觀點）。
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

  // ───────────────────────── 模式 1：2×2 變換 ─────────────────────────
  const P2 = {
    shear: { name: 'Shear [1 1; 0 1]', M: [[1, 1], [0, 1]] },
    rot: { name: '旋轉 90° [0 −1; 1 0]', M: [[0, -1], [1, 0]] },
    rot30: { name: '旋轉 30°', M: [[Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)], [Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)]] },
    scale: { name: '伸縮 [2 0; 0 0.5]', M: [[2, 0], [0, 0.5]] },
    refl: { name: '鏡射（對 x 軸）[1 0; 0 −1]', M: [[1, 0], [0, -1]] },
    proj: { name: '投影到 y = x [½ ½; ½ ½]', M: [[0.5, 0.5], [0.5, 0.5]] },
    tb: { name: '3B1B 例：[1 3; −2 0]', M: [[1, 3], [-2, 0]] },
    sing: { name: '壓扁 [1 2; 2 4]', M: [[1, 2], [2, 4]] },
  };
  const t2 = { key: 'tb', cur: I2, v: [-1, 2] };
  function enterT2() {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    t2.F = flat2(); t2.G = t2.F.grid(COL.a, 0.85); t2.sq = t2.F.square();
    t2.ai = t2.F.arrow([1, 0], COL.d, 'î'); t2.aj = t2.F.arrow([0, 1], COL.r, 'ĵ'); t2.av = t2.F.arrow(t2.v, COL.g, 'v');
    t2.cur = I2;
    const M = P2[t2.key].M;
    controls('<select id="t2P">' + Object.keys(P2).map((k) => '<option value="' + k + '">' + P2[k].name + '</option>').join('') + '</select>'
      + '<label>[a b; c d] = <input id="t2M" value="' + M.map((r) => r.map((x) => +x.toFixed(3)).join(' ')).join('; ') + '" style="width:120px"></label>'
      + '<label>v = <input id="t2V" value="' + t2.v.join(',') + '" style="width:56px"></label>'
      + '<button class="primary" id="t2Go">套用變換</button><button id="t2Back">回到原狀</button>');
    $('t2P').value = t2.key;
    $('t2P').onchange = (e) => { t2.key = e.target.value; enterT2(); };
    on('t2Go', safe(() => goT2()));
    on('t2Back', safe(() => animT2(I2)));
    log('矩陣的兩個欄 = î、ĵ 變換後落在哪裡。所有格線跟著走：保持平行、等距，原點不動。');
    stateT2(I2);
  }
  function readM2() {
    const M = parseM($('t2M').value);
    if (!M || M.length !== 2 || M[0].length !== 2) { log('矩陣格式：a b; c d（例如 1 3; -2 0）', true); return null; }
    if (M.flat().some((x) => Math.abs(x) > 4)) { log('每個數字請在 −4 到 4 之間，畫面才放得下。', true); return null; }
    return M;
  }
  async function animT2(M, tok) {
    const C = t2.cur;
    await tw(tok, 1400, (t) => { const N = lerpM(C, M, t); t2.G.setM(N); t2.sq.setM(N); t2.F.set(t2.ai, mulMV(N, [1, 0])); t2.F.set(t2.aj, mulMV(N, [0, 1])); t2.F.set(t2.av, mulMV(N, t2.v)); });
    t2.cur = M; stateT2(M);
  }
  async function goT2() {
    const M = readM2(); if (!M) return;
    const v = String($('t2V').value).split(/[\s,]+/).filter(Boolean).map(Number);
    if (v.length !== 2 || v.some((x) => !isFinite(x) || Math.abs(x) > 3)) { log('v 要兩個數字，絕對值 ≤ 3。', true); return; }
    t2.v = v; t2.F.set(t2.av, mulMV(t2.cur, v));
    await animT2(M);
    const d = det2(M);
    log('Mv = ' + v[0] + '·' + vstr(M.map((r) => r[0])) + ' + ' + v[1] + '·' + vstr(M.map((r) => r[1])) + ' = ' + vstr(mulMV(M, v)) + (Math.abs(d) < 1e-9 ? '；det = 0：平面被壓成一條線（或一點）。' : '；面積放大 |det| = ' + fmt(Math.abs(d)) + ' 倍' + (d < 0 ? '，方向翻面。' : '。')));
  }
  function stateT2(M) {
    const d = det2(M), r = rrefSteps(M).rank;
    setState('M = ' + mstr(M), [['î → 第 1 欄', vstr(M.map((x) => x[0]))], ['ĵ → 第 2 欄', vstr(M.map((x) => x[1]))], ['det（面積倍率）', fmt(Math.round(d * 1000) / 1000)], ['rank', String(r)], ['dim ker', String(2 - r)]],
      r === 2 ? '<span class="ok">可逆</span>：kernel = {0}，image = 整個 R²' : r === 1 ? '<span class="no">壓成一條線</span>：kernel 是一條線，image 是一條線（1 + 1 = 2）' : '全部壓到原點');
  }

  // ───────────────────────── 模式 2：3×3 變換 ─────────────────────────
  const P3 = {
    shear: { name: 'Shear [1 0 1; 0 1 0; 0 0 1]', M: [[1, 0, 1], [0, 1, 0], [0, 0, 1]] },
    rotz: { name: '繞 z 軸轉 90°', M: [[0, -1, 0], [1, 0, 0], [0, 0, 1]] },
    tilt: { name: '[1 0 ½; ½ 1 0; 0 ½ 1]', M: [[1, 0, 0.5], [0.5, 1, 0], [0, 0.5, 1]] },
    proj: { name: '投影到 xy 平面', M: [[1, 0, 0], [0, 1, 0], [0, 0, 0]] },
    scale: { name: '伸縮 diag(1.5, 1, 0.5)', M: [[1.5, 0, 0], [0, 1, 0], [0, 0, 0.5]] },
    refl: { name: '對 xy 平面鏡射', M: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
  };
  const t3 = { key: 'tilt', cur: I3 };
  function enterT3() {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(32, 22, 10.5, [0, 2.4, 0]);
    t3.S = space3(0, 2.6, 0, 1, 2.5);
    t3.G = grid3(t3.S, COL.a, 2, 0.5);
    t3.C = unitCube(t3.S);
    t3.ai = t3.S.arrow([1, 0, 0], COL.d, 'î'); t3.aj = t3.S.arrow([0, 1, 0], COL.r, 'ĵ'); t3.ak = t3.S.arrow([0, 0, 1], COL.a, 'k̂');
    t3.cur = I3;
    const M = P3[t3.key].M;
    controls('<select id="t3P">' + Object.keys(P3).map((k) => '<option value="' + k + '">' + P3[k].name + '</option>').join('') + '</select>'
      + '<label>M = <input id="t3M" value="' + M.map((r) => r.join(' ')).join('; ') + '" style="width:170px"></label>'
      + '<button class="primary" id="t3Go">套用變換</button><button id="t3Back">回到原狀</button>');
    $('t3P').value = t3.key;
    $('t3P').onchange = (e) => { t3.key = e.target.value; enterT3(); };
    on('t3Go', safe(() => goT3()));
    on('t3Back', safe(() => animT3(I3)));
    log('三個欄 = î、ĵ、k̂ 的落點；紫色單位方塊變成平行六面體，體積倍率 = det。');
    stateT3(I3);
  }
  async function animT3(M, tok) {
    const C = t3.cur;
    await tw(tok, 1500, (t) => { const N = lerpM(C, M, t); t3.G.setM(N); t3.C.set(...[0, 1, 2].map((j) => N.map((r) => r[j]))); [t3.ai, t3.aj, t3.ak].forEach((a, j) => t3.S.set(a, N.map((r) => r[j]))); });
    t3.cur = M; stateT3(M);
  }
  async function goT3() {
    const M = parseM($('t3M').value);
    if (!M || M.length !== 3 || M[0].length !== 3) { log('格式：三列、每列三個數，用分號分列。', true); return; }
    if (M.flat().some((x) => Math.abs(x) > 2)) { log('數字請在 −2 到 2 之間，畫面才放得下。', true); return; }
    await animT3(M);
  }
  function stateT3(M) {
    const d = det3(M), r = rrefSteps(M).rank;
    setState('M = ' + mstr(M), [['î →', vstr(M.map((x) => x[0]))], ['ĵ →', vstr(M.map((x) => x[1]))], ['k̂ →', vstr(M.map((x) => x[2]))], ['det（體積倍率）', fmt(Math.round(d * 1000) / 1000)], ['rank / dim ker', r + ' / ' + (3 - r)]],
      Math.abs(d) < 1e-9 ? '<span class="no">det = 0</span>：空間被壓扁，dim image = ' + r : '<span class="ok">可逆</span>' + (d < 0 ? '（方向翻轉）' : ''));
  }

  // ───────────────────────── 模式 3：合成 ─────────────────────────
  const cp = { a: 'rot', b: 'shear', cur: I2 };
  function enterCompose() {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    cp.F = flat2(); cp.G = cp.F.grid(COL.a, 0.85); cp.sq = cp.F.square();
    cp.ai = cp.F.arrow([1, 0], COL.d, 'î'); cp.aj = cp.F.arrow([0, 1], COL.r, 'ĵ');
    cp.cur = I2;
    const opt = (id, v) => '<select id="' + id + '">' + Object.keys(P2).filter((k) => k !== 'sing').map((k) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + P2[k].name + '</option>').join('') + '</select>';
    controls('先 ' + opt('cpA', cp.a) + ' 再 ' + opt('cpB', cp.b) + '<button class="primary" id="cpGo">一步一步做</button><button id="cpProd">直接用乘積</button><button id="cpSwap">順序對調</button>');
    $('cpA').onchange = (e) => { cp.a = e.target.value; enterCompose(); };
    $('cpB').onchange = (e) => { cp.b = e.target.value; enterCompose(); };
    on('cpGo', safe(async () => { await animCp(I2, 500); await animCp(P2[cp.a].M); await animCp(mm(P2[cp.b].M, P2[cp.a].M)); stateCp(); }));
    on('cpProd', safe(async () => { await animCp(I2, 500); await animCp(mm(P2[cp.b].M, P2[cp.a].M)); stateCp(); }));
    on('cpSwap', () => { [cp.a, cp.b] = [cp.b, cp.a]; enterCompose(); log('順序對調：一般來說 AB ≠ BA。'); });
    log('先做 A 再做 B = 乘積 BA（右邊的先作用，像函數合成 B(A(x))）。');
    stateCp();
  }
  async function animCp(M, ms = 1300) {
    const C = cp.cur;
    await tw(null, ms, (t) => { const N = lerpM(C, M, t); cp.G.setM(N); cp.sq.setM(N); cp.F.set(cp.ai, mulMV(N, [1, 0])); cp.F.set(cp.aj, mulMV(N, [0, 1])); });
    cp.cur = M;
  }
  function stateCp() {
    const A = P2[cp.a].M, B = P2[cp.b].M, BA = mm(B, A), AB = mm(A, B);
    const same = BA.every((r, i) => r.every((x, j) => Math.abs(x - AB[i][j]) < 1e-9));
    setState('先 A 再 B = BA', [['A', mstr(A)], ['B', mstr(B)], ['BA（先 A 後 B）', mstr(BA)], ['AB（先 B 後 A）', mstr(AB)]],
      same ? '<span class="ok">這兩個剛好可交換</span>：AB = BA' : '<span class="no">AB ≠ BA</span>：順序會改變結果');
  }

  // ───────────────────────── 模式 4：換基底 ─────────────────────────
  const cb = { b1: [2, 1], b2: [-1, 1], v: [-1, 2] };
  function enterBasis() {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    cb.F = flat2();
    controls('<label>b₁ = <input id="cbB1" value="' + cb.b1.join(',') + '" style="width:56px"></label><label>b₂ = <input id="cbB2" value="' + cb.b2.join(',') + '" style="width:56px"></label>'
      + '<label>新座標 [c₁, c₂] = <input id="cbV" value="' + cb.v.join(',') + '" style="width:56px"></label><button class="primary" id="cbGo">翻譯成標準座標</button><button id="cbRot">旋轉 90° 在新基底下的矩陣</button>');
    on('cbGo', safe(() => goBasis()));
    on('cbRot', () => rotBasis());
    drawBasis();
    log('Jennifer 的基底 b₁、b₂：她說的 [c₁, c₂] 其實是 c₁b₁ + c₂b₂。換基底矩陣 B = [b₁ b₂]。');
  }
  function readV(id, n = 2, lim = 3) { const v = String($(id).value).split(/[\s,]+/).filter(Boolean).map(Number); return v.length === n && v.every((x) => isFinite(x) && Math.abs(x) <= lim) ? v : null; }
  function drawBasis() {
    lab.clear();
    cb.F = flat2();
    const B = [[cb.b1[0], cb.b2[0]], [cb.b1[1], cb.b2[1]]];
    cb.G = cb.F.grid(COL.b, 0.8); cb.G.setM(B);
    cb.F.arrow(cb.b1, COL.d, 'b₁'); cb.F.arrow(cb.b2, COL.r, 'b₂');
    cb.B = B;
    const d = det2(B);
    setState('B = [b₁ b₂] = ' + mstr(B), [['det B', fmt(d)], ['B⁻¹', Math.abs(d) < 1e-9 ? '不存在' : mstr(inv2(B))]], Math.abs(d) < 1e-9 ? '<span class="no">b₁、b₂ 平行，不是基底</span>' : '新座標 → 標準座標：乘 B；反過來：乘 B⁻¹');
  }
  async function goBasis() {
    const b1 = readV('cbB1'), b2 = readV('cbB2'), v = readV('cbV');
    if (!b1 || !b2 || !v) { log('每個欄位兩個數字（絕對值 ≤ 3），用逗號分開。', true); return; }
    cb.b1 = b1; cb.b2 = b2; cb.v = v; drawBasis();
    if (Math.abs(det2(cb.B)) < 1e-9) { log('b₁、b₂ 平行：張不出整個平面，不能當基底。', true); return; }
    const p1 = arrow(COL.d, 0.07), p2 = arrow(COL.r, 0.07);
    const s1 = scl(b1, v[0]), w = mulMV(cb.B, v);
    if (Math.max(Math.abs(w[0]), Math.abs(w[1]), Math.abs(s1[0]), Math.abs(s1[1])) > 5.2) { log('結果 ' + vstr(w) + ' 超出畫面，請改小一點。', true); return; }
    await tw(null, 800, (t) => cb.F.set(p1, scl(s1, t)));
    await tw(null, 800, (t) => cb.F.set(p2, scl(b2, v[1] * t), s1));
    cb.F.arrow(w, COL.g, '標準座標 ' + vstr(w));
    log('[' + v.join(', ') + ']（新基底）= ' + v[0] + '·b₁ + ' + v[1] + '·b₂ = ' + vstr(w) + '（標準）。');
  }
  function rotBasis() {
    const B = cb.B; if (Math.abs(det2(B)) < 1e-9) { log('先給一組不平行的 b₁、b₂。', true); return; }
    const M = [[0, -1], [1, 0]], R = mm(inv2(B), mm(M, B));
    setState('旋轉 90° 在新基底下', [['M（標準）', mstr(M)], ['B', mstr(B)], ['B⁻¹MB', mstr(R)]], '讀法：B（翻成標準）→ M（轉）→ B⁻¹（翻回新基底）<br>B⁻¹MB 與 M 相似：同一個變換、不同語言');
    log('B⁻¹MB = ' + mstr(R) + '。');
  }

  // ───────────────────────── 模式 5：叉積 ─────────────────────────
  const cr = { v: [2, 0, 1], w: [0, 2, 1], x: [0.5, -0.5, 1.5] };
  function enterCross() {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(35, 22, 10.5, [0, 2.4, 0]);
    controls('<label>v = <input id="crV" value="' + cr.v.join(',') + '" style="width:70px"></label><label>w = <input id="crW" value="' + cr.w.join(',') + '" style="width:70px"></label>'
      + '<label>x = <input id="crX" value="' + cr.x.join(',') + '" style="width:80px"></label><button class="primary" id="crGo">畫出來</button>');
    on('crGo', () => { const v = readV('crV', 3, 2.5), w = readV('crW', 3, 2.5), x = readV('crX', 3, 2.5); if (!v || !w || !x) { log('每個向量三個數字，絕對值 ≤ 2.5。', true); return; } cr.v = v; cr.w = w; cr.x = x; drawCross(); });
    drawCross();
  }
  function drawCross() {
    const keep = lab.world.children.length; void keep;
    lab.clear();
    const S = space3(0, 2.6, 0, 0.55, 2.6);
    const { v, w, x } = cr, p = cross(v, w), A = norm(p);
    S.arrow(v, COL.a, 'v'); S.arrow(w, COL.b, 'w');
    pgram(S, v, w, COL.g, 0.3);
    const k = A > 4.5 ? 4.5 / A : 1;
    S.arrow(scl(p, k), COL.r, k < 1 ? 'v × w（縮小）' : 'v × w');
    S.arrow(x, COL.k, 'x');
    ppiped(S, x, v, w, COL.c, 0.14);
    const vol = det3([[x[0], v[0], w[0]], [x[1], v[1], w[1]], [x[2], v[2], w[2]]]);
    setState('v × w = ' + vstr(p), [['|v × w|（平行四邊形面積）', fmt(Math.round(A * 100) / 100)], ['(v×w)·v', fmt(dot(p, v))], ['(v×w)·w', fmt(dot(p, w))], ['det[x v w]', fmt(Math.round(vol * 100) / 100)], ['(v×w)·x', fmt(Math.round(dot(p, x) * 100) / 100)]],
      '<span class="ok">det[x v w] = (v × w)·x</span>：體積 = 底面積 × 高<br>v × w ⊥ v、w，長度 = 面積，方向用右手定則');
    log('v × w = ' + vstr(p) + '；跟 v、w 的內積都是 0（垂直）。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.14) {
      const L = [['T(x, y) = (2x + y, x − y)', '是'], ['T(x, y) = (x + 1, y)', '不是'], ['T(x, y) = (xy, x)', '不是'], ['T(x, y) = (0, 3x)', '是'], ['T(x, y) = (x², y)', '不是'], ['T(x, y, z) = (x − z, 2y)', '是'], ['T(x) = |x|', '不是'], ['T(f) = f′（微分）', '是']];
      const [s, a] = pick(L);
      return { q: s + ' 是線性變換嗎？', opts: ['是', '不是'], ans: a, why: a === '是' ? '每個分量都是變數的一次組合（沒有常數項、乘積、平方），T(u+v) = T(u)+T(v)、T(cu) = cT(u)。' : '不是線性：有常數項（T(0) ≠ 0）或乘積 / 平方 / 絕對值，加法或純量乘法不保持。' };
    }
    if (k < 0.3) {
      const a = [ri(-3, 3), ri(-3, 3)], b = [ri(-3, 3), ri(-3, 3)], v = [ri(-2, 3), ri(-2, 3)];
      const ans = vstr(addv(scl(a, v[0]), scl(b, v[1])));
      return { q: '線性變換把 î 送到 ' + vstr(a) + '、ĵ 送到 ' + vstr(b) + '。v = ' + vstr(v) + ' 被送到哪裡？', opts: [...new Set([ans, vstr(addv(scl(a, v[1]), scl(b, v[0]))), vstr([dot(a, v), dot(b, v)]), vstr(addv(a, b))])], ans, why: 'T(v) = ' + v[0] + '·T(î) + ' + v[1] + '·T(ĵ)。矩陣的欄就是 T(î)、T(ĵ)。' };
    }
    if (k < 0.44) {
      const A = [[ri(-2, 2), ri(-2, 2)], [ri(-2, 2), ri(-2, 2)]], B = [[ri(-2, 2), ri(-2, 2)], [ri(-2, 2), ri(-2, 2)]];
      const ans = mstr(mm(B, A));
      return { q: '先做 A = ' + mstr(A) + '，再做 B = ' + mstr(B) + '。合成的矩陣是？', opts: [...new Set([ans, mstr(mm(A, B)), mstr(A.map((r, i) => r.map((x, j) => x + B[i][j]))), mstr(A.map((r, i) => r.map((x, j) => x * B[i][j])))])], ans, why: '先 A 後 B：x → Ax → B(Ax) = (BA)x，右邊的先作用。' };
    }
    if (k < 0.58) {
      const m = ri(2, 5), n = ri(2, 6), r = ri(1, Math.min(m, n));
      const which = pick(['ker', 'im']);
      const ans = String(which === 'ker' ? n - r : r);
      return { q: 'T(x) = Ax，A 是 ' + m + '×' + n + '、rank ' + r + '。T 是從 R^' + n + ' 到 R^' + m + '。dim ' + (which === 'ker' ? 'ker T' : 'Im T') + ' = ？', opts: [...new Set([ans, String(m - r), String(n - r), String(r), String(n)])].slice(0, 4).concat([]).filter((x, i, arr) => arr.indexOf(x) === i), ans, why: 'dim Im T = rank = ' + r + '；dim ker T = n − rank = ' + (n - r) + '（dim ker + dim Im = 定義域維度 ' + n + '）。' };
    }
    if (k < 0.7) {
      const M = [[ri(-3, 3), ri(-3, 3)], [ri(-3, 3), ri(-3, 3)]], d = det2(M);
      const ans = String(Math.abs(d) * 2);
      return { q: 'M = ' + mstr(M) + '。面積 2 的圖形經過 M 之後面積變多少？', opts: [...new Set([ans, String(d * 2 + 1), String(Math.abs(M[0][0] * M[1][1]) * 2), String(Math.abs(d))])], ans, why: '面積倍率 = |det M| = ' + Math.abs(d) + (d === 0 ? '（壓成線，面積 0）' : '') + '。' };
    }
    if (k < 0.84) {
      const v = [ri(-2, 2), ri(-2, 2), ri(-2, 2)], w = [ri(-2, 2), ri(-2, 2), ri(-2, 2)];
      const ans = vstr(cross(v, w));
      return { q: 'v = ' + vstr(v) + '、w = ' + vstr(w) + '，v × w = ？', opts: [...new Set([ans, vstr(cross(w, v)), vstr([v[1] * w[2] + v[2] * w[1], v[2] * w[0] + v[0] * w[2], v[0] * w[1] + v[1] * w[0]]), vstr(v.map((x, i) => x * w[i]))])], ans, why: 'v × w = (v₂w₃ − v₃w₂, v₃w₁ − v₁w₃, v₁w₂ − v₂w₁)；w × v = −(v × w)。' };
    }
    const b1 = [ri(1, 3), ri(-1, 2)], b2 = [ri(-2, 1), ri(1, 3)], c = [ri(-2, 2), ri(-2, 2)];
    if (det2([[b1[0], b2[0]], [b1[1], b2[1]]]) === 0) return genQ();
    const ans = vstr(addv(scl(b1, c[0]), scl(b2, c[1])));
    return { q: '新基底 b₁ = ' + vstr(b1) + '、b₂ = ' + vstr(b2) + '。新座標 [' + c.join(', ') + '] 的向量，標準座標是？', opts: [...new Set([ans, vstr(c), vstr(addv(scl(b1, c[1]), scl(b2, c[0]))), vstr([dot(b1, c), dot(b2, c)])])], ans, why: '[c₁, c₂] = c₁b₁ + c₂b₂ = B c，B = [b₁ b₂]。' };
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
  // ─── BaM7OCEm3G0（3Blue1Brown：Cross products in the light of linear transformations）───
  const CV = [2, 0, 1], CW = [0, 2, 1], CP = cross(CV, CW); // (−2, −2, 4)，示範數字自訂
  async function scCrossRecap(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(35, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.55, 2.6);
    const av = S.arrow(CV, COL.a, 'v'), aw = S.arrow(CW, COL.b, 'w');
    say('上次的算法：一個怪怪的 3×3 行列式', 'det[ î v₁ w₁ ; ĵ v₂ w₂ ; k̂ v₃ w₃ ]');
    await beat(tok, 2800);
    say('v = (2, 0, 1)、w = (0, 2, 1)', '算出來 = −2î − 2ĵ + 4k̂ = (−2, −2, 4)');
    await beat(tok, 2600);
    const pg = pgram(S, CV, CW, COL.g, 0); await tw(tok, 700, (t) => (pg.material.opacity = 0.32 * t));
    const ap = S.arrow([0, 0, 0], COL.r, 'v × w');
    await tw(tok, 1300, (t) => S.set(ap, scl(CP, t)));
    say('長度 = v、w 張成的平行四邊形面積', '|v × w| = √24 ≈ 4.90');
    await beat(tok, 2600);
    say('方向同時垂直 v 和 w', '(v×w)·v = 0，(v×w)·w = 0');
    await orbit(tok, 3000, 35, 115, 14, 10.5, [0, 2.4, 0]);
    say('右手定則：食指 v、中指 w，拇指 = v × w', '蠻力計算可以驗證；這集要說「為什麼」');
    await beat(tok, 3000);
    void av; void aw;
  }
  async function scDuality(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(28, 24, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.75, 2.6);
    const p = [2, 1, 2], pn = norm(p), u = scl(p, 1 / pn);
    say('對偶性：R³ → 數線的線性變換', '可以用 1×3 矩陣 [2 1 2] 描述');
    await beat(tok, 2600);
    // 數線：沿著 p 的方向，刻度 k 放在 k/|p| 的位置
    S.line(p, COL.k, 3.4, [0, 0, 0], 0.025);
    for (let k = -6; k <= 9; k += 3) { const q = S.w(scl(u, k / pn)); tag(String(k), 'idx', q.x, q.y + 0.25, q.z); }
    const ap = S.arrow(p, COL.r, 'p = (2, 1, 2)');
    say('把矩陣立起來 → 向量 p', '[2 1 2]·x = p·x');
    await beat(tok, 2400);
    const ax = arrow(COL.a); ax.tag('x');
    const drop = rod(COL.g, 0.02), mark = dotBall(COL.g, 0.11);
    let cur = [1, 0, 0];
    for (const x of [[1, 0, 0], [0, 1, 0], [1, 1, 1], [-1, 0, 1]]) {
      const from = cur.slice();
      await tw(tok, 900, (t) => { const y = addv(from, scl(addv(x, scl(from, -1)), t)); S.set(ax, y); const pr = scl(u, dot(y, u)); drop.setW(S.w(y), S.w(pr)); mark.position.copy(S.w(pr)); });
      cur = x;
      const val = dot(p, x);
      say('x = ' + vstr(x) + ' → ' + val, '投影到 p 上的長度 × |p| = p·x = ' + val);
      await beat(tok, 1700);
    }
    say('(−1, 0, 1) ⊥ p → 送到 0', '每個 R³ → R 的線性變換都對應唯一的對偶向量');
    await beat(tok, 3000);
    void ap;
  }
  async function scDetVolume(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(20, 30, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.9, 2.6);
    const v = [2, 1, 0], w = [0.5, 1.5, 0];
    const av = S.arrow(v, COL.a, 'v'), aw = S.arrow(w, COL.b, 'w');
    const pg = pgram(S, v, w, COL.g, 0.3);
    say('2D：det[v w] = 平行四邊形面積', 'det[2 0.5; 1 1.5] = 3 − 0.5 = 2.5');
    await beat(tok, 2800);
    say('對調順序 → 面積變號', 'det[w v] = −2.5（定向相反）');
    await beat(tok, 2400);
    say('如果硬推到 3D：三個向量 u、v、w', 'det[u v w] = 平行六面體的體積');
    const u0 = [0.3, 0.4, 1.6];
    const au = S.arrow([0, 0, 0], COL.c, 'u');
    const box = ppiped(S, [0, 0, 0.001], v, w, COL.c, 0.18);
    await tw(tok, 1400, (t) => { const u = scl(u0, t); S.set(au, u); box.set(u, v, w); });
    say('體積 = 底面積 2.5 × 高 1.6 = 4', 'det[u v w] = 4');
    await orbit(tok, 2600, 20, 70, 20, 10.5, [0, 2.4, 0]);
    await tw(tok, 1400, (t) => { const u = addv(u0, scl([0, 0, -3.0], t)); S.set(au, u); box.set(u, v, w); });
    say('u 跑到另一側：違反右手定則 → 負號', 'det[u v w] = 2.5 × (−1.4) = −3.5');
    await beat(tok, 2600);
    say('但真正的叉積：輸入兩個向量、輸出一個向量', '不是三個向量 → 一個數');
    await beat(tok, 2800);
    void av; void aw; void pg;
  }
  async function scCrossFunction(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(38, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.55, 2.6);
    S.arrow(CV, COL.a, 'v'); S.arrow(CW, COL.b, 'w'); pgram(S, CV, CW, COL.g, 0.28);
    say('把 u 換成可變的 (x, y, z)，v、w 固定', 'f(x, y, z) = det[ (x,y,z)  v  w ]');
    await beat(tok, 3000);
    const ax = arrow(COL.k); ax.tag('(x, y, z)');
    const box = ppiped(S, [0, 0, 0.01], CV, CW, COL.c, 0.16);
    const out = tag('', 'ptr alt', 3.8, 5.6);
    let cur = [0, 0, 0.01];
    for (const x of [[0, 0, 1], [0, 0, 2], [1, 0, 1], [1, 1, 0]]) {
      const from = cur.slice();
      await tw(tok, 1000, (t) => { const y = addv(from, scl(addv(x, scl(from, -1)), t)); S.set(ax, y); box.set(y, CV, CW); txt(out, 'f = ' + (Math.round(dot(CP, y) * 10) / 10)); });
      cur = x;
      say('輸入 ' + vstr(x) + ' → 有向體積 ' + dot(CP, x), x[2] === 2 ? 'x 加倍 → 體積加倍：f 是線性的' : dot(CP, x) < 0 ? '跑到另一側 → 負的體積' : '這是 R³ → R 的函數');
      await beat(tok, 1700);
    }
    say('f 是線性的 → 可以寫成 1×3 矩陣', '→ 由對偶性，存在向量 p 使 f(x) = p·x');
    await beat(tok, 3200);
  }
  async function scCrossCompute(tok) {
    fresh([0, 3.4, 12], [0, 3.6, 0]);
    const g = mgrid([['x', 2, 0], ['y', 0, 2], ['z', 1, 1]], -5.6, 5.4, 0, { color: (i, j) => (j === 0 ? COL.k : j === 1 ? COL.a : COL.b) });
    tag('det', 'ptr', -6.4, 4.6);
    say('p·(x, y, z) = det[ (x,y,z) v w ]', 'v = (2, 0, 1)、w = (0, 2, 1)');
    await beat(tok, 2600);
    const terms = [
      [0, 'x·(0·1 − 1·2)', '= −2x', [1, 2]],
      [1, '− y·(2·1 − 1·0)', '= −2y', [0, 2]],
      [2, '+ z·(2·2 − 0·0)', '= +4z', [0, 1]],
    ];
    const lines = [];
    for (const [i, a, b, rows] of terms) {
      g.clearGlow(); glow(g.c[i][0], GOLD); rows.forEach((r) => { glow(g.c[r][1], GREEN); glow(g.c[r][2], GREEN); });
      lines.push(mono(tag(a + '  ' + b, '', 2.6, 5.2 - i * 0.7)));
      say('沿第 1 欄展開', a + ' ' + b);
      await beat(tok, 2000);
    }
    g.clearGlow();
    mono(tag('p·(x,y,z) = −2x − 2y + 4z', 'ptr alt', 2.6, 2.9));
    say('x、y、z 前面的係數就是 p 的座標', 'p = (−2, −2, 4)');
    await beat(tok, 2600);
    ['î', 'ĵ', 'k̂'].forEach((s, i) => relabel(g.c[i][0], s));
    say('把 î、ĵ、k̂ 塞進第 1 欄：只是提醒「係數要讀成向量」', '−2î − 2ĵ + 4k̂ = v × w');
    await beat(tok, 3200);
    void lines;
  }
  async function scCrossGeometry(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(40, 18, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.55, 2.6);
    S.arrow(CV, COL.a, 'v'); S.arrow(CW, COL.b, 'w'); pgram(S, CV, CW, COL.g, 0.3);
    say('幾何問題：哪個 p 讓 p·x = 平行六面體的體積？', '');
    await beat(tok, 2600);
    const x = [1.4, -1.2, 1.5];
    const ax = S.arrow(x, COL.k, 'x');
    const box = ppiped(S, x, CV, CW, COL.c, 0.14);
    say('體積 = 底面積 × 高', '高 = x 在「垂直 v、w 的方向」上的分量');
    await beat(tok, 2600);
    const n = scl(CP, 1 / norm(CP)), h = dot(x, n);
    const hr = rod(COL.r, 0.04);
    await tw(tok, 1000, (t) => hr.setW(S.w([0, 0, 0]), S.w(scl(n, h * t))));
    const hl = S.w(scl(n, h + 0.3)); tag('高 = ' + h.toFixed(2), 'ptr', hl.x, hl.y, hl.z);
    say('投影到垂直線上，再乘上面積', '這正是跟「⊥ v、w、長度 = 面積」的向量做內積');
    await beat(tok, 2800);
    const ap = S.arrow([0, 0, 0], COL.r, 'p');
    await tw(tok, 1200, (t) => S.set(ap, scl(CP, t * 0.6)));
    ap.tag('p = v × w（畫成 0.6 倍）');
    say('方向選對，正號 ⇔ (x, v, w) 符合右手定則', 'p·x = ' + fmt(Math.round(dot(CP, x) * 100) / 100) + ' = det[x v w]');
    await beat(tok, 2600);
    say('計算面與幾何面找的是同一個對偶向量', '所以 i/j/k 技巧算出的向量 = 垂直、長度為面積的那個');
    await orbit(tok, 3200, 40, 100, 18, 10.5, [0, 2.4, 0]);
    void ax; void box;
  }

  // ─── 課本補充（影片沒有逐字稿）───
  async function scLinearGrid(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.85);
    const ai = F.arrow([1, 0], COL.d, 'î'), aj = F.arrow([0, 1], COL.r, 'ĵ'), av = F.arrow([-1, 2], COL.g, 'v = (−1, 2)');
    say('線性變換 = 會動的空間', '格線保持平行、等距；原點不動');
    await beat(tok, 2400);
    say('v = −1·î + 2·ĵ', '只要知道 î、ĵ 去哪裡，就知道所有向量去哪裡');
    await beat(tok, 2400);
    const M = [[1, 3], [-2, 0]];
    await tw(tok, 2200, (t) => { const N = lerpM(I2, M, t); G.setM(N); F.set(ai, mulMV(N, [1, 0])); F.set(aj, mulMV(N, [0, 1])); F.set(av, mulMV(N, [-1, 2])); });
    ai.tag('î → (1, −2)'); aj.tag('ĵ → (3, 0)'); av.tag('v → (5, 2)');
    say('î → (1, −2)、ĵ → (3, 0)', '矩陣 [1 3; −2 0]：欄 = î、ĵ 的落點');
    await beat(tok, 2800);
    say('v → −1·(1, −2) + 2·(3, 0) = (5, 2)', '矩陣 × 向量 = 欄的線性組合');
    await beat(tok, 3000);
    say('（課本補充：3Blue1Brown 第 3 集的例子）', '');
    await beat(tok, 1600);
  }
  async function scGallery(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.85), sq = F.square();
    const ai = F.arrow([1, 0], COL.d, 'î'), aj = F.arrow([0, 1], COL.r, 'ĵ');
    const L = [['旋轉 90°', [[0, -1], [1, 0]], 'det = 1：面積不變'], ['Shear', [[1, 1], [0, 1]], 'î 不動、ĵ → (1, 1)；det = 1'], ['伸縮', [[2, 0], [0, 0.5]], 'x 方向 ×2、y 方向 ×½'], ['鏡射（對 x 軸）', [[1, 0], [0, -1]], 'det = −1：翻面'], ['投影到 x 軸', [[1, 0], [0, 0]], 'det = 0：平面壓成一條線']];
    let C = I2;
    const go = async (M) => { const C0 = C; await tw(tok, 1200, (t) => { const N = lerpM(C0, M, t); G.setM(N); sq.setM(N); F.set(ai, mulMV(N, [1, 0])); F.set(aj, mulMV(N, [0, 1])); }); C = M; };
    for (const [nm, M, f] of L) {
      say(nm + '：' + mstr(M), f);
      await go(M); await beat(tok, 1700);
      await go(I2); await beat(tok, 300);
    }
    say('綠色方塊的面積 = |det|', '每個矩陣的欄都告訴你 î、ĵ 去哪');
    await beat(tok, 2400);
  }
  async function scLinearity(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.85);
    const u = [2, 0.5], v = [0.5, 1.5];
    const au = F.arrow(u, COL.d, 'u'), avv = F.arrow(v, COL.r, 'v'), as = F.arrow(addv(u, v), COL.g, 'u + v');
    say('線性的定義：T(u + v) = T(u) + T(v)、T(cu) = cT(u)', '');
    await beat(tok, 2600);
    const M = [[1, -1], [0.5, 1]];
    await tw(tok, 1800, (t) => { const N = lerpM(I2, M, t); G.setM(N); F.set(au, mulMV(N, u)); F.set(avv, mulMV(N, v)); F.set(as, mulMV(N, addv(u, v))); });
    as.tag('T(u + v)');
    const g2 = F.arrow(mulMV(M, v), COL.r, '', '', mulMV(M, u));
    say('T(u) 接 T(v)，尖端剛好是 T(u + v)', '平行四邊形變換後還是平行四邊形');
    await beat(tok, 2800);
    lab.world.remove(g2);
    say('反例：平移 T(x) = x + (1, 1)', '原點被移走 → 不是線性（T(0) ≠ 0）');
    await tw(tok, 1500, (t) => { G.position.set(0.72 * t, 0, -0.72 * t); });
    await beat(tok, 2600);
    await tw(tok, 800, (t) => { G.position.set(0.72 * (1 - t), 0, -0.72 * (1 - t)); });
    say('判斷線性：沒有常數項、沒有乘積或平方', '例：(x + 1, y)、(xy, x) 都不是線性');
    await beat(tok, 3000);
  }
  async function scComposition(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.85), sq = F.square();
    const ai = F.arrow([1, 0], COL.d, 'î'), aj = F.arrow([0, 1], COL.r, 'ĵ');
    let C = I2;
    const go = async (M, ms = 1300) => { const C0 = C; await tw(tok, ms, (t) => { const N = lerpM(C0, M, t); G.setM(N); sq.setM(N); F.set(ai, mulMV(N, [1, 0])); F.set(aj, mulMV(N, [0, 1])); }); C = M; };
    const R = [[0, -1], [1, 0]], Sh = [[1, 1], [0, 1]];
    say('先旋轉 90°', 'R = [0 −1; 1 0]');
    await go(R); await beat(tok, 1300);
    say('再做 shear', 'S = [1 1; 0 1]');
    await go(mm(Sh, R)); await beat(tok, 1500);
    say('最後 î → (1, 1)、ĵ → (−1, 0)', '合成 = SR = [1 −1; 1 0]（右邊的先做）');
    await beat(tok, 2600);
    await go(I2, 700);
    say('直接套用 SR：一步到位，結果一樣', '矩陣乘法 = 變換的合成');
    await go(mm(Sh, R)); await beat(tok, 2000);
    await go(I2, 700);
    say('順序反過來：先 shear 再旋轉', 'RS = [0 −1; 1 1] ≠ SR');
    await go(Sh); await go(mm(R, Sh)); await beat(tok, 2600);
    say('矩陣乘法一般不可交換', '（課本補充：3Blue1Brown 第 4 集的例子）');
    await beat(tok, 2400);
  }
  async function scTransform3d(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(32, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const G = grid3(S, COL.a, 2, 0.5), C = unitCube(S);
    const ar = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, j) => S.arrow(e, [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j]));
    let cur = I3;
    const go = async (M) => { const C0 = cur; await tw(tok, 1600, (t) => { const N = lerpM(C0, M, t); G.setM(N); C.set(...[0, 1, 2].map((j) => N.map((r) => r[j]))); ar.forEach((a, j) => S.set(a, N.map((r) => r[j]))); }); cur = M; };
    say('3D 一樣：三個欄 = î、ĵ、k̂ 的落點', '3×3 矩陣');
    await beat(tok, 2200);
    const M = [[1, 0, 0.5], [0.5, 1, 0], [0, 0.5, 1]];
    await go(M);
    say('î → (1, ½, 0)、ĵ → (0, 1, ½)、k̂ → (½, 0, 1)', '單位方塊 → 平行六面體，體積 = det = 1.125');
    await orbit(tok, 3000, 32, 80, 22, 10.5, [0, 2.4, 0]);
    await go(I3);
    const Rz = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
    await go(Rz);
    say('繞 z 軸轉 90°：k̂ 不動', '[0 −1 0; 1 0 0; 0 0 1]');
    await beat(tok, 2400);
    await go(mm(M, Rz));
    say('先轉再做 M：合成 = M·Rz', '3D 的合成一樣是矩陣相乘');
    await beat(tok, 2800);
  }
  async function scKernelImage(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 20, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const C = ppiped(S, [1, 0, 0], [0, 1, 0], [0, 0, 1], COL.c, 0.2);
    const pts = [[1, 1, 1.5], [-1, 0.5, 1], [0.5, -1, -1], [0, 0, 1.8]].map((p) => S.arrow(p, COL.k));
    say('投影到 xy 平面：P = [1 0 0; 0 1 0; 0 0 0]', '');
    await beat(tok, 2200);
    const P = [[1, 0, 0], [0, 1, 0], [0, 0, 0]];
    const src = [[1, 1, 1.5], [-1, 0.5, 1], [0.5, -1, -1], [0, 0, 1.8]];
    await tw(tok, 1600, (t) => { const N = lerpM(I3, P, t); C.set([1, 0, 0], [0, 1, 0], mulMV(N, [0, 0, 1])); pts.forEach((a, i) => S.set(a, mulMV(N, src[i]))); });
    const im = S.plane([1, 0, 0], [0, 1, 0], COL.d, 0.2); const ip = S.w([2, 2, 0.2]); tag('Image = xy 平面', 'ptr', ip.x, ip.y, ip.z);
    say('所有輸出都落在 xy 平面：Image（像），dim 2', 'Im P = C(P)');
    await beat(tok, 2600);
    const k = S.line([0, 0, 1], COL.r, 2.4, [0, 0, 0], 0.05); const kp = S.w([0, 0, 2.7]); tag('Kernel = z 軸', 'ptr alt', kp.x, kp.y, kp.z);
    say('z 軸上的向量全被送到 0：Kernel（核），dim 1', 'ker P = N(P)');
    await beat(tok, 2600);
    say('dim ker + dim Im = 1 + 2 = 3', '= 定義域的維度（rank-nullity）');
    await beat(tok, 3000);
    void im; void k;
  }
  async function scNonsquare(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 3.2, 0, 0.5, 2.6);
    const G = grid3(S, COL.a, 2, 0.75);
    const ai = S.arrow([1, 0, 0], COL.d, 'î'), aj = S.arrow([0, 1, 0], COL.r, 'ĵ');
    say('3×2 矩陣：R² → R³', '輸入 2 個座標，輸出 3 個');
    await beat(tok, 2400);
    const M = [[2, 0], [-1, 1], [-2, 1]];
    const I32 = [[1, 0], [0, 1], [0, 0]];
    await tw(tok, 2000, (t) => { const N = lerpM(I32, M, t); G.setM(N); S.set(ai, N.map((r) => r[0])); S.set(aj, N.map((r) => r[1])); });
    ai.tag('î → (2, −1, −2)'); aj.tag('ĵ → (0, 1, 1)');
    say('整個平面被送進 R³ 裡的一個平面', 'Image = 欄張成的 2 維子空間');
    await orbit(tok, 2800, 30, 75, 22, 10.5, [0, 2.4, 0]);
    lab.clear(); cam(30, 30, 10.5, [0, 2.4, 0]);
    const S2 = space3(0, 2.6, 0, 1, 2.5);
    const C = unitCube(S2);
    say('2×3 矩陣：R³ → R²', '例 [1 0 1; 0 1 1]：三維被壓進平面');
    await beat(tok, 2000);
    const Q = [[1, 0, 1], [0, 1, 1], [0, 0, 0]];
    await tw(tok, 1800, (t) => { const N = lerpM(I3, Q, t); C.set(...[0, 1, 2].map((j) => N.map((r) => r[j]))); });
    say('至少有一條線被壓成 0：ker ≠ {0}', 'n > m 時一定不是一對一');
    await beat(tok, 2600);
    say('1×2 矩陣：平面 → 數線，例 [1 2]', '(x, y) → x + 2y，就是跟 (1, 2) 做內積');
    await beat(tok, 3000);
    void G;
  }
  async function scBasisMatrix(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.6);
    rod(COL.g, 0.035).setW(F.w([-4, -4], 0.1), F.w([4, 4], 0.1));
    const Pm = [[0.5, 0.5], [0.5, 0.5]];
    say('T = 投影到 45° 的直線', '選一組適合 T 的基底：v₁ 在線上、v₂ 垂直');
    const a1 = F.arrow([1, 1], COL.d, 'v₁ = (1, 1)'), a2 = F.arrow([-1, 1], COL.r, 'v₂ = (−1, 1)');
    await beat(tok, 2800);
    await tw(tok, 1500, (t) => { const N = lerpM(I2, Pm, t); G.setM(N); F.set(a1, mulMV(N, [1, 1])); F.set(a2, mulMV(N, [-1, 1])); });
    say('T(v₁) = v₁、T(v₂) = 0', '用 {v₁, v₂} 當基底：矩陣 = [1 0; 0 0]（對角！）');
    await beat(tok, 3000);
    await tw(tok, 800, (t) => { const N = lerpM(Pm, I2, t); G.setM(N); F.set(a1, mulMV(N, [1, 1])); F.set(a2, mulMV(N, [-1, 1])); });
    a1.visible = a2.visible = false; showL(a1.lbl, false); showL(a2.lbl, false);
    const ai = F.arrow([1, 0], COL.d, 'î'), aj = F.arrow([0, 1], COL.r, 'ĵ');
    await tw(tok, 1500, (t) => { const N = lerpM(I2, Pm, t); G.setM(N); F.set(ai, mulMV(N, [1, 0])); F.set(aj, mulMV(N, [0, 1])); });
    say('用標準基底：T(î) = T(ĵ) = (½, ½)', '矩陣 = [½ ½; ½ ½]');
    await beat(tok, 2800);
    say('同一個 T，基底不同 → 矩陣不同', '矩陣的第 j 欄 = T(第 j 個基底) 的座標');
    await beat(tok, 3000);
  }
  async function scChangeBasis(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2();
    const B = [[2, -1], [1, 1]];
    const G = F.grid(COL.b, 0.0); G.setM(B);
    F.arrow([1, 0], COL.a, 'î'); F.arrow([0, 1], COL.a, 'ĵ');
    say('Jennifer 用另一組基底：b₁ = (2, 1)、b₂ = (−1, 1)', '她的格子長這樣');
    await tw(tok, 900, (t) => (G.material.opacity = 0.8 * t));
    F.arrow([2, 1], COL.d, 'b₁'); F.arrow([-1, 1], COL.r, 'b₂');
    await beat(tok, 2200);
    const p1 = arrow(COL.d, 0.07), p2 = arrow(COL.r, 0.07);
    say('她說 [−1, 2]，意思是 −1·b₁ + 2·b₂', '');
    await tw(tok, 900, (t) => F.set(p1, scl([2, 1], -t)));
    await tw(tok, 900, (t) => F.set(p2, scl([-1, 1], 2 * t), [-2, -1]));
    F.arrow([-4, 1], COL.g, '我們說 (−4, 1)');
    say('翻譯成我們的語言：B[−1, 2] = (−4, 1)', 'B = [2 −1; 1 1]，欄 = 她的基底');
    await beat(tok, 2800);
    say('反過來翻譯：乘 B⁻¹', 'B⁻¹ = (1/3)[1 1; −1 2]');
    await beat(tok, 2400);
    say('旋轉 90° 在她的語言：B⁻¹MB', '= [1/3 −2/3; 5/3 −1/3]（先翻譯、再轉、再翻回）');
    await beat(tok, 3200);
    say('B⁻¹MB 與 M 相似：同一個變換的不同寫法', '（課本補充：3Blue1Brown 第 13 集的例子）');
    await beat(tok, 2600);
  }
  async function scOneOnto(tok) {
    fresh([0, 10.5, 7.8], [0, 0, -0.4]);
    const F = flat2(), G = F.grid(COL.a, 0.85);
    let C = I2;
    const go = async (M) => { const C0 = C; await tw(tok, 1300, (t) => G.setM(lerpM(C0, M, t))); C = M; };
    say('一對一（injective）⇔ ker T = {0}', '映成（onto）⇔ Im T = 整個對應域');
    await beat(tok, 2600);
    await go([[1, 1], [0, 1]]);
    say('可逆的 [1 1; 0 1]：一對一且映成', 'ker = {0}、Im = R²');
    await beat(tok, 2400);
    await go(I2);
    await go([[1, 2], [2, 4]]);
    say('[1 2; 2 4]：平面壓成一條線', '(2, −1) ↦ 0：ker ≠ {0} → 不是一對一；Im 是線 → 不是映成');
    await beat(tok, 3000);
    await go(I2);
    say('有限維、同維度（n×n）：一對一 ⇔ 映成 ⇔ 可逆', 'dim ker + dim Im = n');
    await beat(tok, 2600);
    say('3×2：可能一對一、不可能映成；2×3：可能映成、不可能一對一', 'rank ≤ min(m, n)');
    await beat(tok, 3000);
  }

  const scenes = {
    'cross-recap': { title: '叉積回顧：長度 = 面積、方向 ⊥ v、w', play: scCrossRecap },
    'duality-1x3': { title: '對偶性：1×3 矩陣 = 跟向量 p 做內積', play: scDuality },
    'det-volume': { title: '行列式 = 有向面積 / 體積', play: scDetVolume },
    'cross-function': { title: 'f(x) = det[x v w] 是線性函數', play: scCrossFunction },
    'cross-compute': { title: '計算面：展開行列式 → p = (−2, −2, 4)', play: scCrossCompute },
    'cross-geometry': { title: '幾何面：體積 = 面積 × 高 = p·x', play: scCrossGeometry },
    'linear-grid': { title: '（課本）線性變換：î、ĵ 的落點決定一切', play: scLinearGrid },
    'transform-gallery': { title: '（課本）旋轉、shear、伸縮、鏡射、投影', play: scGallery },
    'linearity-check': { title: '（課本）線性的定義與反例（平移）', play: scLinearity },
    'composition': { title: '（課本）合成 = 矩陣相乘，順序有差', play: scComposition },
    'transform-3d': { title: '（課本）3×3 矩陣：單位方塊 → 平行六面體', play: scTransform3d },
    'kernel-image': { title: '（課本）Kernel 與 Image：投影到平面', play: scKernelImage },
    'nonsquare': { title: '（課本）非方陣：不同維度之間的變換', play: scNonsquare },
    'basis-matrix': { title: '（課本）對基底的矩陣表示：投影的兩種矩陣', play: scBasisMatrix },
    'change-of-basis': { title: '（課本）換基底：B⁻¹MB', play: scChangeBasis },
    'one-to-one-onto': { title: '（課本）一對一、映成與 kernel、image', play: scOneOnto },
  };

  return {
    kicker: '線性代數・第 5 章',
    title: '線性變換',
    color: 'var(--la)',
    modes: [
      { id: 't2d', name: '2×2 變換', enter: enterT2 },
      { id: 't3d', name: '3×3 變換', enter: enterT3 },
      { id: 'compose', name: '合成', enter: enterCompose },
      { id: 'basis', name: '換基底', enter: enterBasis },
      { id: 'cross', name: '叉積', enter: enterCross },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'linear-grid', 'transform-gallery', 'linearity-check', 'composition', 'transform-3d',
      'kernel-image', 'nonsquare', 'one-to-one-onto', 'basis-matrix', 'change-of-basis',
      'cross-recap', 'duality-1x3', 'det-volume', 'cross-function', 'cross-compute', 'cross-geometry',
    ],
    stop() { gen++; },
  };
}
