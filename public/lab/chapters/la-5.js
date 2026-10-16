// 線性代數 第5章：線性變換（Linear Map、Matrix Representation、Kernel/Image、換基底、叉積的對偶觀點）。
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
    log('矩陣的兩個行 = î、ĵ 變換後落在哪裡。所有格線跟著走：保持平行、等距，原點不動。');
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
    setState('M = ' + mstr(M), [['î → 第 1 行', vstr(M.map((x) => x[0]))], ['ĵ → 第 2 行', vstr(M.map((x) => x[1]))], ['det（面積倍率）', fmt(Math.round(d * 1000) / 1000)], ['rank', String(r)], ['dim ker', String(2 - r)]],
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
    log('三個行 = î、ĵ、k̂ 的落點；紫色單位方塊變成平行六面體，體積倍率 = det。');
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
      return { q: '線性變換把 î 送到 ' + vstr(a) + '、ĵ 送到 ' + vstr(b) + '。v = ' + vstr(v) + ' 被送到哪裡？', opts: [...new Set([ans, vstr(addv(scl(a, v[1]), scl(b, v[0]))), vstr([dot(a, v), dot(b, v)]), vstr(addv(a, b))])], ans, why: 'T(v) = ' + v[0] + '·T(î) + ' + v[1] + '·T(ĵ)。矩陣的行就是 T(î)、T(ĵ)。' };
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
      say('沿第 1 行展開', a + ' ' + b);
      await beat(tok, 2000);
    }
    g.clearGlow();
    mono(tag('p·(x,y,z) = −2x − 2y + 4z', 'ptr alt', 2.6, 2.9));
    say('x、y、z 前面的係數就是 p 的座標', 'p = (−2, −2, 4)');
    await beat(tok, 2600);
    ['î', 'ĵ', 'k̂'].forEach((s, i) => relabel(g.c[i][0], s));
    say('把 î、ĵ、k̂ 塞進第 1 行：只是提醒「係數要讀成向量」', '−2î − 2ĵ + 4k̂ = v × w');
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
    say('î → (1, −2)、ĵ → (3, 0)', '矩陣 [1 3; −2 0]：行 = î、ĵ 的落點');
    await beat(tok, 2800);
    say('v → −1·(1, −2) + 2·(3, 0) = (5, 2)', '矩陣 × 向量 = 行的線性組合');
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
    say('綠色方塊的面積 = |det|', '每個矩陣的行都告訴你 î、ĵ 去哪');
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
    say('3D 一樣：三個行 = î、ĵ、k̂ 的落點', '3×3 矩陣');
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
    say('整個平面被送進 R³ 裡的一個平面', 'Image = 行張成的 2 維子空間');
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
    say('同一個 T，基底不同 → 矩陣不同', '矩陣的第 j 行 = T(第 j 個基底) 的座標');
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
    say('翻譯成我們的語言：B[−1, 2] = (−4, 1)', 'B = [2 −1; 1 1]，行 = 她的基底');
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ lt.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat. The kit's arrow is P.arrow (kArrow); the module's thick 3D arrow
//  is still used through flat2 / space3 (F.arrow, S.arrow) and arrow(color) below.)
// ─── 線性代數 第 5 章 線性變換 — cued scenes（lt-）───
// 影片：3Blue1Brown 第 3 集（矩陣 = 變換）、3D 變換、非方陣、換基底、叉積的對偶觀點；MIT 18.06 L30（變換與矩陣）、L31（換基底、影像壓縮）。
// 每個矩陣、落點、換基底結果都由程式算出來，再和老師說的數字比對，畫面顯示 ✓／✘。
// 老師沒給數字的地方用自己挑的例子，畫面標「示意」。
const kArrow = P.arrow;
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ok = (b, t, x, y, z = 0) => { if (!b) log('check failed: ' + t, true); return b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z); };
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const gone = (...os) => os.forEach((o) => {
  if (!o) return; if (Array.isArray(o)) return gone(...o);
  if (o.kill && o.ls) return o.kill();
  if (o.lbl) remove(o.lbl); if (o.edge) kill(o.edge); if (o.edges) kill(o.edges);
  if (o.element) remove(o); else kill(o);
});
const hide = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return hide(...o); o.visible = false; if (o.lbl) showL(o.lbl, false); if (o.edge) o.edge.visible = false; if (o.edges) o.edges.visible = false; if (o.element) showL(o, false); });
const CAMF = [[0, 10.5, 7.8], [0, 0, -0.4]];
const CAMB = [[0, 3.4, 12], [0, 3.6, 0]];
const LOOK3 = [0, 2.4, 0];
const orb = (tok, ms, a0, a1, el = 22, d = 10.5) => anim(tok, ms, (u) => cam(a0 + (a1 - a0) * u, el, d, LOOK3));
// a scene = a list of step functions; each runs when the video reaches its cue
function sc(id, title, init, steps) {
  FRAG.push([id, title, async (tok) => {
    const S = {};
    await init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 計算 ──
const eqv = (a, b) => a.length === b.length && a.every((x, i) => (Array.isArray(x) ? eqv(x, b[i]) : Math.abs(x - b[i]) < 1e-9));
const colOf = (M, j) => M.map((r) => r[j]);
const fromCols = (...cs) => cs[0].map((_, i) => cs.map((c) => c[i]));
const cl = (x) => (Math.abs(x) < 1e-12 ? 0 : x);
function inv(A) {   // Gauss–Jordan
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let i = 0; i < n; i++) if (i !== c) { const k = M[i][c]; for (let j = 0; j < 2 * n; j++) M[i][j] -= k * M[c][j]; }
  }
  return M.map((r) => r.slice(n).map(cl));
}
const rot2 = (deg) => { const a = deg * Math.PI / 180; return [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]].map((r) => r.map(cl)); };
const rotY = (deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]].map((r) => r.map(cl)); };
const rotX = (deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]].map((r) => r.map(cl)); };
const rnd = (x) => Math.round(x * 1e9) / 1e9;
const vs = (v) => vstr(v.map(rnd));
const ms = (M) => mstr(M.map((r) => r.map(rnd)));
const lin = (cs, vsx) => vsx[0].map((_, i) => vsx.reduce((s, v, k) => s + cs[k] * v[i], 0));
// ── 2D 平面（flat2）：整個格子 + î、ĵ + 追蹤的向量跟著矩陣走 ──
function plane(S, o = {}) {
  fresh(CAMF[0], CAMF[1]);
  const n0 = lab.world.children.length;
  const F = flat2(o.s || 0.72, o.B || 5.4, o.n || 8);
  S.axes = lab.world.children.slice(n0);
  S.F = F; S.M = I2; S.trk = []; S.hooks = [];
  S.G = F.grid(COL.a, o.gop == null ? 0.85 : o.gop);
  if (o.basis !== false) { S.ai = F.arrow([1, 0], COL.d, 'î'); S.aj = F.arrow([0, 1], COL.r, 'ĵ'); }
  S.track = (v, color, t, from) => { const a = F.arrow(v, color, t); a.v0 = v.slice(); a.f0 = from ? from.slice() : null; S.trk.push(a); S.place(a, S.M); return a; };
  S.place = (a, N) => F.set(a, mulMV(N, a.v0), a.f0 ? mulMV(N, a.f0) : [0, 0]);
  S.apply = (N) => {
    S.G.setM(N);
    if (S.ai) { F.set(S.ai, mulMV(N, [1, 0])); F.set(S.aj, mulMV(N, [0, 1])); }
    S.trk.forEach((a) => S.place(a, N));
    if (S.sq) S.sq.setM(N);
    S.hooks.forEach((h) => h(N));
  };
  S.go = async (tok, M, ms_ = 1500) => { const C = S.M; await anim(tok, ms_, (u) => S.apply(lerpM(C, M, u))); S.M = M; };
  S.untrack = (a) => { S.trk = S.trk.filter((x) => x !== a); gone(a); };
  S.pt = (p, h = 0.4) => F.w(p, h);
  S.lbl = (t, p, cls = 'ptr', h = 0.4) => { const w = F.w(p, h); return tag(t, cls, w.x, w.y, w.z); };
  return F;
}
// 一條在平面上、經過函數 g 彎曲的折線（看非線性）
function curveLine(F, a, b, color, g = (p) => p, n = 40) {
  const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
  lab.world.add(l);
  l.setG = (gg) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; const p = gg([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); if (Math.abs(p[0]) <= F.B && Math.abs(p[1]) <= F.B) pts.push(F.w(p, 0.1)); } setPts(l, pts.length > 1 ? pts : [V3(0, -1, 0), V3(0, -1, 0)]); };
  l.setG(g); return l;
}
// 整個格子經過一般（可能非線性）的函數 g
function warpGrid(F, g, color = COL.a, n = 6) {
  const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  lab.world.add(l);
  l.setG = (gg) => {
    const pts = [], N = 30;
    const seg = (p, q) => { const a = gg(p), b = gg(q); if ([a[0], a[1], b[0], b[1]].some((x) => Math.abs(x) > F.B)) return; pts.push(F.w(a, 0.07), F.w(b, 0.07)); };
    for (let k = -n; k <= n; k++) for (let i = 0; i < N; i++) { const s0 = -n + (2 * n * i) / N, s1 = -n + (2 * n * (i + 1)) / N; seg([k, s0], [k, s1]); seg([s0, k], [s1, k]); }
    setPts(l, pts.length ? pts : [V3(0, -1, 0), V3(0, -1, 0)]);
  };
  l.setG(g); return l;
}
const lerpP = (g, u) => (p) => { const q = g(p); return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; };
// ── 3D 空間（space3）：格子 + 單位方塊 + î、ĵ、k̂ ──
function space(S, o = {}) {
  fresh([0, 0, 0], LOOK3); cam(o.ang == null ? 32 : o.ang, o.el == null ? 22 : o.el, o.d || 10.5, LOOK3);
  const Sp = space3(o.ox || 0, o.oy || 2.6, 0, o.s || 1, o.ext || 2.5);
  S.S = Sp; S.M = I3; S.trk = []; S.hooks = [];
  if (o.grid !== false) S.G = grid3(Sp, COL.a, 2, 0.45);
  if (o.cube !== false) S.C = unitCube(Sp);
  S.ar = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, j) => Sp.arrow(e, [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j]));
  S.track = (v, color, t, from) => { const a = Sp.arrow(v, color, t); a.v0 = v.slice(); a.f0 = from ? from.slice() : null; S.trk.push(a); S.place(a, S.M); return a; };
  S.place = (a, N) => Sp.set(a, mulMV(N, a.v0), a.f0 ? mulMV(N, a.f0) : null);
  S.apply = (N) => {
    if (S.G) S.G.setM(N);
    if (S.C) S.C.set(...[0, 1, 2].map((j) => colOf(N, j)));
    S.ar.forEach((a, j) => Sp.set(a, colOf(N, j)));
    S.trk.forEach((a) => S.place(a, N));
    S.hooks.forEach((h) => h(N));
  };
  S.go = async (tok, M, ms_ = 1600) => { const C = S.M; await anim(tok, ms_, (u) => S.apply(lerpM(C, M, u))); S.M = M; };
  S.spin = async (tok, f, ms_ = 1800) => { const C = S.M; await anim(tok, ms_, (u) => S.apply(mm(f(u), C))); S.M = mm(f(1), C); };
  S.untrack = (a) => { S.trk = S.trk.filter((x) => x !== a); gone(a); };
  S.lbl = (t, p, cls = 'ptr') => { const w = Sp.w(p); return tag(t, cls, w.x, w.y, w.z); };
  return Sp;
}
// 一個面對鏡頭的小 2D 平面（非方陣場景用）：math (x, y) → world (ox + x·s, oy + y·s, 0)
function panel2(ox, oy, s, n = 3, title) {
  const W = { s, n, w: (p) => V3(ox + p[0] * s, oy + p[1] * s, 0.0) };
  const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#c9b99c', transparent: true, opacity: 0.7 }));
  const pts = []; for (let k = -n; k <= n; k++) pts.push(W.w([k, -n]), W.w([k, n]), W.w([-n, k]), W.w([n, k]));
  setPts(l, pts); lab.world.add(l); W.grid = l;
  rod('#8a7b66', 0.02).setW(W.w([-n - 0.3, 0]), W.w([n + 0.3, 0]));
  rod('#8a7b66', 0.02).setW(W.w([0, -n - 0.3]), W.w([0, n + 0.3]));
  if (title) { const p = W.w([0, n + 0.8]); W.title = tag(title, 'ptr', p.x, p.y, p.z); }
  W.arrow = (v, color, t, cls) => { const a = arrow(color, 0.05); a.v = v.slice(); if (t) a.tag(t, cls); a.setW(W.w([0, 0]), W.w(v)); return a; };
  W.set = (a, v, from = [0, 0]) => { a.v = v.slice(); a.setW(W.w(from), W.w(addv(from, v))); };
  W.ball = (p, color, r = 0.09) => { const b = dotBall(color, r); b.position.copy(W.w(p)); return b; };
  return W;
}
// 一排長條（R⁸ 的向量）：值 → 高度 v·k；labels 用 txt(原始數字)
function bar8(vals, x0, base, o = {}) {
  const k = o.k || 0.3, w = o.w || 0.22, gap = o.gap || 0.3, z = o.z || 0;
  const ms_ = vals.map((v, i) => { const m = lab.box(o.color || COL.a, [w, 1, w]); m.position.set(x0 + i * gap, base, z); lab.world.add(m); return m; });
  const ls = o.noNum ? [] : vals.map((v, i) => tag('', 'idx', x0 + i * gap, base, z + 0.2));
  const plank = new THREE.Mesh(new THREE.BoxGeometry(gap * vals.length, 0.02, 0.3), new THREE.MeshBasicMaterial({ color: '#a8987f' }));
  plank.position.set(x0 + (gap * (vals.length - 1)) / 2, base, z); lab.world.add(plank);
  const B = {
    ms: ms_, ls, plank, vals: vals.slice(),
    set(v, shown) {
      B.vals = v.slice();
      v.forEach((x, i) => { const h = x * k; ms_[i].scale.y = Math.max(Math.abs(h), 0.001); ms_[i].position.y = base + h / 2; ms_[i].visible = Math.abs(h) > 0.002; if (ls[i]) { ls[i].position.set(x0 + i * gap, base + h + (h >= 0 ? 0.18 : -0.18), z + 0.2); txt(ls[i], shown ? String(shown[i]) : fmt(Math.round(x * 100) / 100)); } });
    },
    color(c, i) { (i == null ? ms_ : [ms_[i]]).forEach((m) => tint(m, c)); },
    glow(c, i) { (i == null ? ms_ : [ms_[i]]).forEach((m) => glow(m, c)); },
    kill() { ms_.forEach(kill); ls.forEach(remove); kill(plank); },
    mid: x0 + (gap * (vals.length - 1)) / 2,
  };
  B.set(vals, o.shown);
  return B;
}
// 房子（MIT L30）：外框 + 門，用細桿畫在平面上
const HOUSE = [[[0, 0], [1.6, 0]], [[1.6, 0], [1.6, 1.2]], [[1.6, 1.2], [0.8, 2]], [[0.8, 2], [0, 1.2]], [[0, 1.2], [0, 0]], [[0.6, 0], [0.6, 0.7]], [[0.6, 0.7], [1, 0.7]], [[1, 0.7], [1, 0]]];
function house(F, color = COL.b) {
  const rs = HOUSE.map(() => rod(color, 0.035));
  const H = { rs, setM(N) { HOUSE.forEach(([a, b], i) => rs[i].setW(F.w(mulMV(N, a), 0.11), F.w(mulMV(N, b), 0.11))); } };
  H.setM(I2); return H;
}

// 左側說明行（平面場景）：第 i 行文字；同一行再寫一次就換字
function pane(S, i, t, cls = 'ptr') {
  S.pn = S.pn || [];
  if (cls === 'good' && /✘/.test(t)) log('check failed: ' + t, true);
  if (S.pn[i]) { txt(S.pn[i], t); setCls(S.pn[i], cls); return S.pn[i]; }
  const l = tag(t, cls, -5.0, 0.5, -3.3 + i * 0.62); mono(l); S.pn[i] = l; return l;
}

// ═══════════════════════ 3Blue1Brown 第 3 集：Linear transformations and matrices ═══════════════════════
const MX = [[1, -1], [0.5, 1]];                  // 示意：前兩段用來「看移動」的變換
const KV = [1.5, 1];
const KIN = [[1, 0], [0, 1], [-1, 1], [2, -1], [-1.5, -1], [0.5, 2], [-2, 0.5], [1, -2]];
sc('lt-k-move', '3B1B 第 3 集：transformation = 讓向量移動的函數', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false;
}, [
  async (tok, S) => { cap('先拆開這個詞：linear transformation', '先看 transformation'); S.h = hot('linear transformation', 0, 0.5, -4.5); },
  async (tok, S) => {
    cap('transformation 就是 function（函數）', '吃進一個向量 → 吐出另一個向量');
    S.in = S.F.arrow(KV, COL.g, '輸入 v'); S.out = S.F.arrow(mulMV(MX, KV), COL.c, '輸出 T(v)');
    note('示意的變換', 4.4, 0.4, -3.6);
  },
  async (tok, S) => {
    cap('用「移動」來想像', '輸入向量一路移到輸出向量的位置');
    hide(S.out); const a = KV, b = mulMV(MX, KV);
    await anim(tok, 1400, (u) => S.F.set(S.in, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]));
    S.in.tag('v 移到 T(v)');
  },
  async (tok, S) => {
    cap('想像所有輸入向量同時移到各自的輸出', '整個變換一次看完');
    gone(S.in, S.out);
    S.many = KIN.map((v) => S.F.arrow(v, COL.k));
    await anim(tok, 1800, (u) => S.many.forEach((a, i) => S.F.set(a, lerpM([KIN[i]], [mulMV(MX, KIN[i])], u)[0])));
  },
  async (tok, S) => {
    cap('箭頭太擠了 → 每個向量只畫「尖端的點」', '一個點 = 尖端在那裡的向量');
    gone(S.many);
    S.tips = KIN.map((v) => { const b = dotBall(COL.g, 0.11); b.position.copy(S.F.w(v, 0.12)); return b; });
  },
  async (tok, S) => {
    cap('對無限大格子上的每個點都這樣做', '看整個空間怎麼被拉、被推');
    gone(S.tips);
    S.lat = []; for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) { const b = dotBall(COL.a, 0.08); b.p = [x, y]; b.position.copy(S.F.w([x, y], 0.12)); S.lat.push(b); }
    S.G.visible = true;
    S.hooks.push((N) => S.lat.forEach((b) => b.position.copy(S.F.w(mulMV(N, b.p), 0.12))));
    await S.go(tok, MX, 2000);
  },
  async (tok, S) => {
    cap('背景留一份原本的格子', '比較「從哪裡出發、落到哪裡」');
    const bg = S.axes[0]; bg.material.color.set('#8a7b66'); bg.material.opacity = 0.9;
    note('灰色 = 原本的格子', 4.4, 0.4, -3.0);
  },
  async (tok, S) => {
    cap('任意的變換可能非常複雜', '線性代數只研究一種好懂的：linear transformation');
    gone(S.lat); S.hooks.length = 0; S.G.visible = false;
    const g = (p) => [p[0] + 0.45 * Math.sin(p[1] * 0.9), p[1] + 0.45 * Math.sin(p[0] * 0.9)];
    S.W = warpGrid(S.F, (p) => p, COL.c, 5);
    await anim(tok, 1800, (u) => S.W.setG(lerpP(g, u)));
    note('一般（非線性）變換：示意', 4.4, 0.4, -2.4);
  },
]);

const gCurvy = (p) => [p[0] + 0.08 * p[1] * p[1], p[1] + 0.08 * p[0] * p[0]];
const gShift = (p) => [p[0] + 1, p[1] + 0.6];
const gTrick = (p) => [p[0] + 0.15 * p[0] * p[1], p[1]];
const colin = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
sc('lt-k-linear', '3B1B 第 3 集：線性 = 直線保持直線、原點不動', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false;
  S.W = warpGrid(S.F, (p) => p, COL.c, 5); S.W.visible = false;
  S.o = dotBall(COL.r, 0.13); S.o.position.copy(S.F.w([0, 0], 0.14));
}, [
  async (tok, S) => {
    cap('視覺上，「線性」要滿足兩件事', '① 所有直線變換後還是直線　② 原點不動');
    pane(S, 0, '① 直線 → 直線（不彎）'); pane(S, 1, '② 原點固定不動');
  },
  async (tok, S) => {
    cap('反例：線全變彎了', '→ 不是線性變換');
    S.W.visible = true; await anim(tok, 1600, (u) => S.W.setG(lerpP(gCurvy, u)));
    S.b1 = bad('✘ 線變彎（示意）', 3.2, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('反例：線都直的，但整個平面被平移', '原點被移走 → 不是線性');
    gone(S.b1); S.W.setG((p) => p);
    await anim(tok, 1500, (u) => { S.W.setG(lerpP(gShift, u)); S.o.position.copy(S.F.w([gShift([0, 0])[0] * u, gShift([0, 0])[1] * u], 0.14)); });
    S.b2 = bad('✘ 原點移到 (1, 0.6)（示意）', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('這個：原點不動，水平線和垂直線看起來還是直的', '但只是因為只畫了水平、垂直的格線');
    gone(S.b2); S.W.setG((p) => p); S.o.position.copy(S.F.w([0, 0], 0.14));
    await anim(tok, 1600, (u) => S.W.setG(lerpP(gTrick, u)));
    const h = [-2, 0, 2].map((x) => gTrick([x, 1]));
    S.b3 = ok(Math.abs(colin(...h)) < 1e-9 && eqv(gTrick([0, 0]), [0, 0]), 'y = 1 的像仍是直線、原點不動 ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('看一條對角線 y = x 就露餡了', '它被彎成曲線 → 根本不是線性');
    S.D = curveLine(S.F, [-4, -4], [4, 4], COL.r);
    await anim(tok, 1400, (u) => S.D.setG(lerpP(gTrick, u)));
    const d = [0, 1, 2].map((t) => gTrick([t, t]));
    gone(S.b3); ok(Math.abs(colin(...d)) > 1e-6, '✘ 對角線變成拋物線 x = t + 0.15t²（示意）', 2.6, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('一般原則：線性變換讓格線保持平行、等距', '原點也不動');
    S.W.visible = false; S.D.visible = false; S.G.visible = true;
    await S.go(tok, [[1, 1], [0, 1]], 1600);
    good('✓ 平行、等距、原點不動（示意）', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('有些很好描述，例如繞原點旋轉', '');
    await S.go(tok, rot2(45), 1600);
  },
  async (tok, S) => {
    cap('有些就比較難用文字講清楚', '→ 需要用數字來描述');
    await S.go(tok, [[1, -0.5], [1, 1.5]], 1600);
  },
]);

const KM = [[1, 3], [-2, 0]], KVV = [-1, 2];
sc('lt-k-ijhat', '3B1B 第 3 集：只要知道 î、ĵ 落在哪裡', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('怎麼用數字描述一個變換？', '給一個向量的座標 → 要算出它落點的座標'); },
  async (tok, S) => { cap('只要記錄兩個基底向量 î、ĵ 落在哪裡', '其他每個向量都跟著決定'); S.ai.glow(GOLD); S.aj.glow(GOLD); },
  async (tok, S) => {
    S.ai.glow(null); S.aj.glow(null);
    cap('例：v = (−1, 2)', '意思是 v = −1·î + 2·ĵ');
    S.c1 = S.track([-1, 0], COL.d, ''); S.c2 = S.track([0, 2], COL.r, '', [-1, 0]); S.v = S.track(KVV, COL.g, 'v');
    pane(S, 0, 'v = −1·î + 2·ĵ');
  },
  async (tok, S) => { cap('播放變換，追蹤 î、ĵ、v 三個向量', ''); await S.go(tok, KM, 2200); },
  async (tok, S) => { cap('v 的落點 = −1 ×（î 的落點）+ 2 ×（ĵ 的落點）', '頭接尾還是接得起來'); S.c1.glow(GOLD); S.c2.glow(GOLD); },
  async (tok, S) => {
    cap('一開始是 î、ĵ 的某個線性組合', '最後是「落點」的同一個線性組合');
    pane(S, 1, '格線平行、等距 ⇒ 組合係數不變', 'good');
  },
  async (tok, S) => { cap('從背景格子讀出：î 落在 (1, −2)', ''); S.ai.tag('î → ' + vs(colOf(KM, 0))); },
  async (tok, S) => { cap('ĵ 落在 x 軸上的 (3, 0)', ''); S.aj.tag('ĵ → ' + vs(colOf(KM, 1))); },
  async (tok, S) => { cap('所以 v 落在 −1·(1, −2) + 2·(3, 0)', ''); pane(S, 2, 'T(v) = −1·(1, −2) + 2·(3, 0)'); },
  async (tok, S) => {
    const r = lin(KVV, [colOf(KM, 0), colOf(KM, 1)]);
    cap('加起來 = (−1 + 6, 2 + 0) = (5, 2)', '');
    pane(S, 3, '= ' + vs(r) + (eqv(r, [5, 2]) && eqv(r, mulMV(KM, KVV)) ? ' ✓' : ' ✘'), eqv(r, [5, 2]) ? 'good' : 'bad');
    S.v.tag('T(v) = ' + vs(r));
  },
  async (tok, S) => {
    cap('因為整個變換都畫出來了，直接看也看得到 (5, 2)', '');
    S.dot = dotBall(COL.g, 0.16); S.dot.position.copy(S.F.w([5, 2], 0.14)); S.v.glow(GOLD);
  },
  async (tok, S) => {
    cap('厲害的是：只要知道 î、ĵ 的落點', '不必看變換的過程，就能推出任何向量的落點');
    S.G.visible = false; S.v.glow(null); gone(S.dot);
  },
  async (tok, S) => { cap('一般的向量 (x, y)', '落在 x·(1, −2) + y·(3, 0)'); pane(S, 4, '(x, y) → x·(1, −2) + y·(3, 0)'); },
  async (tok, S) => {
    cap('= (1x + 3y, −2x + 0y)', '給任何向量，都能用這個公式算落點');
    const f = (x, y) => [1 * x + 3 * y, -2 * x + 0 * y];
    pane(S, 5, '= (1x + 3y, −2x + 0y)' + (eqv(f(-1, 2), [5, 2]) ? ' ✓（代 (−1, 2) 得 (5, 2)）' : ' ✘'), 'good');
  },
]);

const KA = [[3, 2], [-2, 1]], KX = [5, 7];     // 示意：矩陣乘向量的例子
sc('lt-k-matrix', '3B1B 第 3 集：2×2 矩陣的行 = î、ĵ 的落點', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => {
    cap('2D 線性變換只要 4 個數字就完全描述', 'î 落點的 2 個座標 + ĵ 落點的 2 個座標');
    S.t1 = hd('î → (1, −2)', -4.6, 6.4); S.t2 = hd('ĵ → (3, 0)', -2.2, 6.4);
  },
  async (tok, S) => {
    cap('把這 4 個數字裝進 2×2 的方格', '叫做 2×2 矩陣');
    S.g = mgrid(KM, -4.6, 5.3, 0, { color: (i, j) => (j === 0 ? COL.d : COL.r) }); hd('M =', -5.6, 4.9);
  },
  async (tok, S) => { cap('讀法：第 1 行 = î 的落點，第 2 行 = ĵ 的落點', ''); sm('î 落點', -4.6, 3.6); sm('ĵ 落點', -3.8, 3.2); },
  async (tok, S) => {
    cap('給一個矩陣和一個向量：它被送到哪？', '例（示意）：[3 2; −2 1] 乘 (5, 7)');
    S.g2 = mgrid(KA, 0.6, 5.3, 0, { color: (i, j) => (j === 0 ? COL.d : COL.r) });
    S.x = mgrid([[KX[0]], [KX[1]]], 2.4, 5.3, 0, { color: () => COL.g });
    note('示意', 3.6, 6.2);
  },
  async (tok, S) => { cap('向量的座標分別乘上對應的行', ''); S.l1 = mono(hd('5·(3, −2) + 7·(2, 1)', 1.8, 3.4)); },
  async (tok, S) => {
    const r = lin(KX, [colOf(KA, 0), colOf(KA, 1)]);
    cap('再加起來', '= (15 + 14, −10 + 7)');
    ok(eqv(r, mulMV(KA, KX)) && eqv(r, [29, -3]), '= ' + vs(r) + ' ✓', 1.8, 2.7);
  },
  async (tok, S) => { cap('這就是「把縮放過的新基底向量加起來」', '新基底 = î、ĵ 的落點'); S.g2.col(0, GOLD); S.g2.col(1, GOLD); },
  async (tok, S) => {
    S.g2.clearGlow();
    cap('最一般的情況：矩陣 [a b; c d]', '');
    S.G = mgrid([['a', 'b'], ['c', 'd']], -4.6, 2.2, 0, { color: (i, j) => (j === 0 ? COL.d : COL.r) });
  },
  async (tok, S) => { cap('第 1 行 (a, c) = 第一個基底向量的落點', ''); S.G.col(0, GOLD); sm('(a, c) = î 落點', -4.6, 0.5); },
  async (tok, S) => { cap('第 2 行 (b, d) = 第二個基底向量的落點', ''); S.G.clearGlow(); S.G.col(1, GOLD); sm('(b, d) = ĵ 落點', -2.4, 0.5); },
  async (tok, S) => { S.G.clearGlow(); cap('作用在 (x, y) 上', '= x·(a, c) + y·(b, d)'); mono(hd('x·(a, c) + y·(b, d)', 1.8, 1.8)); },
  async (tok, S) => {
    cap('整理起來 = (ax + by, cx + dy)', '');
    const [a, b, c, d] = [3, 2, -2, 1], [x, y] = KX;
    ok(eqv([a * x + b * y, c * x + d * y], mulMV(KA, KX)), '= (ax + by, cx + dy) ✓', 1.8, 1.1);
  },
  async (tok, S) => { cap('這就可以當成「矩陣乘向量」的定義', '矩陣寫在左邊，像函數 f(x) 一樣'); hot('M v ＝ 把變換 M 作用在 v 上', 1.8, 0.3); },
  async (tok, S) => {
    cap('與其死背公式，不如把行看成「變換後的基底向量」', '結果 = 它們適當的線性組合');
    S.G.col(0, GOLD); S.G.col(1, GOLD); S.g.col(0, GOLD); S.g.col(1, GOLD);
  },
]);

const R90 = [[0, -1], [1, 0]], SH = [[1, 1], [0, 1]], KC = [[1, 3], [2, 1]], KD = [[2, -2], [1, -1]];
sc('lt-k-examples', '3B1B 第 3 集：旋轉、shear、由矩陣看變換、壓成一條線', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('練習：用矩陣描述幾個線性變換', ''); },
  async (tok, S) => { cap('把整個空間逆時針轉 90°', ''); await S.go(tok, R90, 1800); },
  async (tok, S) => { cap('î 落在 (0, 1)', ''); S.ai.tag('î → ' + vs(colOf(R90, 0))); },
  async (tok, S) => { cap('ĵ 落在 (−1, 0)', ''); S.aj.tag('ĵ → ' + vs(colOf(R90, 1))); },
  async (tok, S) => {
    cap('矩陣的兩行就是這兩個落點', '[0 −1; 1 0]');
    const T2 = fromCols(mulMV(rot2(90), [1, 0]), mulMV(rot2(90), [0, 1]));
    pane(S, 0, '旋轉 90°：' + ms(T2) + (eqv(T2, R90) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('任何向量轉 90° 後在哪？乘上這個矩陣就好', '例（示意）：(2, 1) → (−1, 2)');
    S.v = S.track([2, 1], COL.g, '(2, 1) → ' + vs(mulMV(R90, [2, 1])));
  },
  async (tok, S) => {
    cap('另一個有名字的變換：shear（錯切）', '');
    S.untrack(S.v); S.ai.tag('î'); S.aj.tag('ĵ');
    await S.go(tok, I2, 700); await S.go(tok, SH, 1600);
  },
  async (tok, S) => { cap('î 不動 → 第 1 行是 (1, 0)', ''); S.ai.tag('î → (1, 0)'); },
  async (tok, S) => { cap('ĵ 移到 (1, 1) → 第 2 行', ''); S.aj.tag('ĵ → ' + vs(colOf(SH, 1))); },
  async (tok, S) => { cap('shear 對某個向量做什麼？就是矩陣乘那個向量', ''); pane(S, 1, 'shear：' + ms(SH)); },
  async (tok, S) => {
    cap('反過來：給矩陣，想像它的變換', '行是 (1, 2) 和 (3, 1)');
    S.ai.tag('î'); S.aj.tag('ĵ'); await S.go(tok, I2, 700);
    pane(S, 2, '給定矩陣 ' + ms(KC));
  },
  async (tok, S) => { cap('先把 î 移到 (1, 2)', '整個空間跟著，格線保持平行等距'); await S.go(tok, [[1, 0], [2, 1]], 1500); S.ai.tag('î → (1, 2)'); },
  async (tok, S) => { cap('再把 ĵ 移到 (3, 1)', ''); await S.go(tok, KC, 1500); S.aj.tag('ĵ → (3, 1)'); },
  async (tok, S) => {
    cap('如果兩個落點線性相依（一個是另一個的倍數）', '例（示意）：[2 −2; 1 −1]');
    S.ai.tag('î'); S.aj.tag('ĵ'); await S.go(tok, I2, 600); await S.go(tok, KD, 1700);
    pane(S, 3, ms(KD) + '：det = ' + fmt(det2(KD)) + (det2(KD) === 0 ? ' ✓ 相依' : ''), 'good');
  },
  async (tok, S) => {
    cap('整個 2D 平面被壓到那一條線上', '就是兩個向量張成的 1 維 span');
    rod(COL.g, 0.04).setW(S.F.w([-5.2, -2.6], 0.13), S.F.w([5.2, 2.6], 0.13));
    S.ai.tag('î → (2, 1)'); S.aj.tag('ĵ → (−2, −1)');
  },
]);

// ═══════════════════════ 3Blue1Brown：Three-dimensional linear transformations ═══════════════════════
const M3 = [[1, 0, 0.5], [0.5, 1, 0], [0, 0.5, 1]];   // 示意：老師沒講數字的 3D 變換
const RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];          // 繞 y 軸轉 90°（老師給的三個落點）
const RV = [2, 1, 1];                                    // 示意向量
sc('lt-r-3d', '3B1B：3×3 矩陣的三行 = î、ĵ、k̂ 的落點', async (tok, S) => {
  space(S);
}, [
  async (tok, S) => { cap('3D 向量 → 3D 向量的線性變換', '輸入、輸出都是三維'); },
  async (tok, S) => {
    cap('把空間所有點「揉一揉」', '格線保持平行等距、原點不動');
    await S.go(tok, M3, 2000); S.n = note('示意的變換', -4.2, 6.2);
  },
  async (tok, S) => {
    cap('每個移動的點，代表尖端在那裡的向量', '其實是「輸入向量移到輸出向量」');
    S.vv = S.track([1, 1, 1], COL.g, '某個向量');
  },
  async (tok, S) => {
    cap('跟 2D 一樣：只看基底向量去哪裡就完全決定', '');
    S.untrack(S.vv); await S.go(tok, I3, 1200);
  },
  async (tok, S) => { cap('x 方向的單位向量：î', ''); S.ar[0].glow(GOLD); },
  async (tok, S) => { cap('y 方向的單位向量：ĵ', ''); S.ar[0].glow(null); S.ar[1].glow(GOLD); },
  async (tok, S) => { cap('新成員：z 方向的單位向量 k̂', ''); S.ar[1].glow(null); S.ar[2].glow(GOLD); },
  async (tok, S) => {
    cap('整個 3D 格子太亂', '只追蹤三個基底向量比較好想');
    S.ar[2].glow(null); S.G.visible = false;
  },
  async (tok, S) => {
    cap('背景留著原本的座標軸', '讀出三個基底向量落點的座標');
    await S.go(tok, M3, 1800);
    S.ar.forEach((a, j) => a.tag(['î', 'ĵ', 'k̂'][j] + ' → ' + vs(colOf(M3, j))));
  },
  async (tok, S) => {
    cap('把三組座標記成 3×3 矩陣的三個行', '');
    S.P = code(M3.map((r) => '[ ' + r.map((x) => fmt(x).padStart(4)).join(' ') + ' ]'), -4.3, 6.0);
  },
  async (tok, S) => { cap('只用 9 個數字就完全描述這個變換', ''); S.n9 = sm('3 × 3 = ' + 3 * 3 + ' 個數字', -4.3, 4.1); },
  async (tok, S) => {
    cap('簡單的例子：繞 y 軸旋轉 90°', '');
    gone(S.P, S.n9, S.n); S.ar.forEach((a, j) => a.tag(['î', 'ĵ', 'k̂'][j]));
    await S.go(tok, I3, 600);
    await S.spin(tok, (u) => rotY(90 * u), 2000);
  },
  async (tok, S) => { cap('î 被帶到 z 軸上的 (0, 0, −1)', ''); S.ar[0].tag('î → ' + vs(colOf(S.M, 0))); },
  async (tok, S) => { cap('ĵ 不動，還在 (0, 1, 0)', ''); S.ar[1].tag('ĵ → ' + vs(colOf(S.M, 1))); },
  async (tok, S) => { cap('k̂ 移到 x 軸上的 (1, 0, 0)', ''); S.ar[2].tag('k̂ → ' + vs(colOf(S.M, 2))); },
  async (tok, S) => {
    cap('三組座標當成行 → 這個旋轉的矩陣', '[0 0 1; 0 1 0; −1 0 0]');
    S.P = code(RY.map((r) => '[ ' + r.map((x) => fmt(x).padStart(3)).join(' ') + ' ]'), -4.3, 6.0);
    ok(eqv(S.M, RY) && eqv(rotY(90), RY), '= R_y(90°) ✓', -4.3, 4.1);
  },
  async (tok, S) => {
    cap('向量 (x, y, z) 落在哪？推理跟 2D 一樣', '座標 = 「各基底向量縮放幾倍再相加」的指示');
    S.ar.forEach((a, j) => a.tag(['î', 'ĵ', 'k̂'][j]));
    await S.go(tok, I3, 900);
    S.c1 = S.track([2, 0, 0], COL.d, ''); S.c2 = S.track([0, 1, 0], COL.r, '', [2, 0, 0]); S.c3 = S.track([0, 0, 1], COL.a, '', [2, 1, 0]);
    S.vv = S.track(RV, COL.g, 'v = 2î + ĵ + k̂（示意）');
  },
  async (tok, S) => {
    cap('重點：這個「縮放再相加」在變換前後都成立', '');
    await S.spin(tok, (u) => rotY(90 * u), 2000);
  },
  async (tok, S) => {
    const r = lin(RV, [0, 1, 2].map((j) => colOf(RY, j)));
    cap('所以：座標乘上對應的行，三個結果加起來', '2·(0, 0, −1) + 1·(0, 1, 0) + 1·(1, 0, 0)');
    ok(eqv(r, mulMV(RY, RV)) && eqv(r, mulMV(S.M, RV)), '= ' + vs(r) + ' ✓', -4.3, 3.4);
    S.vv.tag('v → ' + vs(r));
  },
]);

const RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];   // 示意：第二個旋轉（繞 x 軸 90°）
sc('lt-r-compose', '3B1B：3×3 矩陣相乘 = 先做右邊、再做左邊', async (tok, S) => {
  space(S, { grid: false });
}, [
  async (tok, S) => {
    cap('兩個 3×3 矩陣相乘', '例（示意）：M₂M₁ = R_x(90°)·R_y(90°)');
    S.P = mono(hd('M₂ M₁', -4.3, 6.0)); note('示意', -4.3, 5.4);
  },
  async (tok, S) => { cap('先做右邊那個：M₁ = 繞 y 軸轉 90°', ''); await S.spin(tok, (u) => rotY(90 * u), 2000); },
  async (tok, S) => { cap('再做左邊那個：M₂ = 繞 x 軸轉 90°', ''); await S.spin(tok, (u) => rotX(90 * u), 2000); },
  async (tok, S) => { cap('電腦繪圖、機器人都常用', '複雜的 3D 旋轉 = 幾個簡單旋轉的合成'); await orb(tok, 2200, 32, 70); },
  async (tok, S) => {
    const Pm = mm(RX, RY);
    cap('數值上的乘法跟 2D 差不多', 'M₂M₁ = [0 0 1; 1 0 0; 0 1 0]');
    S.Q = code(Pm.map((r) => '[ ' + r.map((x) => fmt(x).padStart(3)).join(' ') + ' ]'), -4.3, 5.0);
    ok(eqv(Pm, S.M), '行 = 三個箭頭現在的位置 ✓', -4.3, 3.2);
    S.ar.forEach((a, j) => a.tag(['î', 'ĵ', 'k̂'][j] + ' → ' + vs(colOf(Pm, j))));
  },
  async (tok, S) => {
    cap('自我測驗：想想看乘法的每一行怎麼來', 'M₂M₁ 的第 j 行 = M₂ ×（M₁ 的第 j 行）');
    const Pm = mm(RX, RY);
    ok([0, 1, 2].every((j) => eqv(colOf(Pm, j), mulMV(RX, colOf(RY, j)))), '第 j 行 = M₂·(M₁ 第 j 行) ✓', -4.3, 2.6);
  },
]);

// ═══════════════════════ 3Blue1Brown：Nonsquare matrices as transformations ═══════════════════════
const VM = [[2, 0], [-1, 1], [-2, 1]], I32 = [[1, 0], [0, 1], [0, 0]];
sc('lt-v-3x2', '3B1B：3×2 矩陣 = 把 2D 送進 3D', async (tok, S) => {
  fresh([0, 0, 0], [0, 2.8, 0]); cam(14, 14, 12, [0, 2.8, 0]);
  S.W = panel2(-4.3, 2.8, 0.45, 3, '輸入：2D');
  S.Sp = space3(2.6, 3.2, 0, 0.5, 2.4, ['x', 'y', 'z'], '輸出：3D');
  S.G = grid3(S.Sp, COL.a, 2, 0.6); S.G.setM(I32); S.G.visible = false;
  S.ai = S.W.arrow([1, 0], COL.d, 'î'); S.aj = S.W.arrow([0, 1], COL.r, 'ĵ');
}, [
  async (tok, S) => { cap('變換也可以跨維度', '例如：2D 向量 → 3D 向量'); },
  async (tok, S) => {
    cap('線性的條件不變：格線平行等距', '原點送到原點');
    S.G.visible = true; await anim(tok, 1800, (u) => S.G.setM(lerpM(I32, VM, u)));
  },
  async (tok, S) => { cap('左邊是輸入空間（就是 2D 平面）', '右邊是變換的輸出（3D）'); setCls(S.W.title, 'ptr alt'); },
  async (tok, S) => {
    cap('這次不畫「輸入移到輸出」', '2D 的輸入和 3D 的輸出住在兩個不相連的空間');
    note('兩個不同的空間', 0, 6.4);
  },
  async (tok, S) => { cap('編碼成矩陣：一樣看每個基底向量落在哪', '落點座標寫成矩陣的行'); S.ai.glow(GOLD); S.aj.glow(GOLD); },
  async (tok, S) => { cap('î 落在 (2, −1, −2)', ''); S.ai.glow(null); S.o1 = S.Sp.arrow(colOf(VM, 0), COL.d, 'î → ' + vs(colOf(VM, 0))); },
  async (tok, S) => { cap('ĵ 落在 (0, 1, 1)', ''); S.aj.glow(null); S.o2 = S.Sp.arrow(colOf(VM, 1), COL.r, 'ĵ → ' + vs(colOf(VM, 1))); },
  async (tok, S) => {
    cap('這個矩陣有 3 列、2 行', '標準說法：3×2 矩陣');
    S.P = code(VM.map((r) => '[ ' + r.map((x) => fmt(x).padStart(3)).join(' ') + ' ]'), -4.3, 6.4);
    sm(VM.length + ' × ' + VM[0].length, -4.3, 4.6);
  },
  async (tok, S) => {
    cap('column space（所有向量落點的集合）', '是 3D 空間裡穿過原點的一個 2D 平面');
    S.pl = S.Sp.plane(colOf(VM, 0), colOf(VM, 1), COL.d, 0.18);
  },
  async (tok, S) => {
    const r = rrefSteps(VM).rank;
    cap('但它仍是 full rank', 'column space 的維度 = 輸入空間的維度 = 2');
    ok(r === 2, 'rank = ' + r + ' = 輸入維度 ✓', -4.3, 4.0);
  },
  async (tok, S) => { cap('看到 3×2 矩陣：就是把 2D 送到 3D', '2 行 → 輸入空間有 2 個基底向量'); S.ai.glow(GOLD); S.aj.glow(GOLD); },
  async (tok, S) => { cap('3 列 → 每個落點要用 3 個座標描述', ''); S.o1.glow(GOLD); S.o2.glow(GOLD); },
]);

const VQ = [[1, 0, 1], [0, 1, 1]];   // 示意的 2×3 矩陣
sc('lt-v-2x3', '3B1B：2×3 矩陣 = 把 3D 壓到 2D', async (tok, S) => {
  fresh([0, 0, 0], [0, 2.8, 0]); cam(14, 16, 12, [0, 2.8, 0]);
  S.Sp = space3(-2.8, 2.8, 0, 0.75, 2.0, ['x', 'y', 'z'], '輸入：3D');
  S.W = panel2(3.6, 2.8, 0.55, 3, '輸出：2D');
  S.C = unitCube(S.Sp);
  S.ar = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, j) => S.Sp.arrow(e, [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j]));
}, [
  async (tok, S) => {
    cap('那 2×3 矩陣（2 列、3 行）是什麼意思？', '例（示意）：[1 0 1; 0 1 1]');
    S.P = code(VQ.map((r) => '[ ' + r.map((x) => fmt(x).padStart(2)).join(' ') + ' ]'), 0.4, 6.4);
  },
  async (tok, S) => { cap('3 行 → 輸入空間有 3 個基底向量', '所以從 3D 出發'); S.ar.forEach((a) => a.glow(GOLD)); },
  async (tok, S) => { cap('2 列 → 每個基底向量的落點只用 2 個座標', ''); S.ar.forEach((a) => a.glow(null)); },
  async (tok, S) => {
    cap('所以落點都在 2D 平面上', '');
    S.o = [0, 1, 2].map((j) => S.W.arrow(colOf(VQ, j), [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j] + ' → ' + vs(colOf(VQ, j))));
  },
  async (tok, S) => {
    cap('這是把 3D 空間壓到 2D 平面的變換', '');
    const Q3 = [...VQ, [0, 0, 0]];
    await anim(tok, 2000, (u) => { const N = lerpM(I3, Q3, u); S.C.set(...[0, 1, 2].map((j) => colOf(N, j))); S.ar.forEach((a, j) => S.Sp.set(a, colOf(N, j))); });
  },
  async (tok, S) => {
    cap('想像自己經歷這種壓扁…很不舒服', '');
    const k = [-1, -1, 1];
    ok(eqv(mulMV(VQ, k), [0, 0]), '整條 (−1, −1, 1) 方向被壓成 0 ✓', 0.4, 5.2);
  },
]);

const VL = [2, 1];   // 示意的 1×2 矩陣
const NL = (x) => V3(1.4 + 0.42 * x, 0.9, 0);
sc('lt-v-1x2', '3B1B：1×2 矩陣 = 把 2D 送到數線', async (tok, S) => {
  fresh([0, 0, 0], [0, 2.8, 0]); cam(0, 10, 12, [0, 2.8, 0]);
  S.W = panel2(-3.8, 3.4, 0.5, 3, '輸入：2D');
  S.ai = S.W.arrow([1, 0], COL.d, 'î'); S.aj = S.W.arrow([0, 1], COL.r, 'ĵ');
}, [
  async (tok, S) => { cap('也可以從 2D 變到 1D', ''); },
  async (tok, S) => {
    cap('1D 空間就是數線', '');
    rod('#8a7b66', 0.025).setW(NL(-3.3), NL(10.5));
    for (let x = -2; x <= 10; x += 2) { const p = NL(x); rod('#8a7b66', 0.012).setW(p.clone().add(V3(0, -0.12, 0)), p.clone().add(V3(0, 0.12, 0))); sm(String(x), p.x, p.y - 0.35, 0); }
    hd('輸出：數線', NL(4).x, 1.9);
  },
  async (tok, S) => {
    const v = [1, 1], val = dot(VL, v);
    cap('吃進 2D 向量、吐出一個數字', '例：(1, 1) → ' + val + '（示意）');
    S.v = S.W.arrow(v, COL.g, '(1, 1)'); S.m = dotBall(COL.g, 0.12); S.m.position.copy(NL(val));
    S.ml = sm(String(val), NL(val).x, 1.35);
  },
  async (tok, S) => {
    cap('「格線保持平行等距」在這裡很亂', '因為整個平面都被壓扁了');
    S.W.grid.material.opacity = 0.25; gone(S.v, S.m, S.ml);
  },
  async (tok, S) => {
    cap('線性的意思變成：一排等距的點', '送到數線上之後仍然等距');
    const pts = [0, 1, 2, 3, 4, 5, 6].map((k) => [-1 + 0.5 * k, 0.5 * k]);
    const vals = pts.map((p) => dot(VL, p));
    S.ds = pts.map((p) => S.W.ball(p, COL.c, 0.1));
    const from = pts.map((p) => S.W.w(p));
    await anim(tok, 2000, (u) => S.ds.forEach((d, i) => d.position.lerpVectors(from[i], NL(vals[i]), u)));
    const gaps = vals.slice(1).map((x, i) => x - vals[i]);
    ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), '間距都是 ' + fmt(gaps[0]) + ' ✓', NL(4).x, 2.5);
  },
  async (tok, S) => {
    cap('這種變換用 1×2 矩陣表示', '兩個行，每行只有一個數');
    S.P = mono(hd('[ ' + VL.join('  ') + ' ]', -3.8, 6.0)); note('示意', -2.6, 6.0);
  },
  async (tok, S) => {
    cap('兩個行 = 兩個基底向量落在數線上的哪個數', 'î → 2、ĵ → 1');
    [[VL[0], 'î → ' + VL[0], COL.d], [VL[1], 'ĵ → ' + VL[1], COL.r]].forEach(([x, t, c], i) => { const b = dotBall(c, 0.14); b.position.copy(NL(x)); tag(t, 'ptr', NL(x).x, 0.25 - i * 0.0, 0.3); });
    S.ai.glow(GOLD); S.aj.glow(GOLD);
  },
  async (tok, S) => {
    cap('這種變換跟內積（dot product）關係很深', '下一集的主題');
    const x = [3, -1];
    ok(dot(VL, x) === 2 * x[0] + 1 * x[1], '[2 1]·(x, y) = 2x + y = (2, 1)·(x, y) ✓', -1.0, 6.6);
  },
]);

// ═══════════════════════ 3Blue1Brown：Change of basis ═══════════════════════
const JB1 = [2, 1], JB2 = [-1, 1], JA = fromCols(JB1, JB2), JAi = inv(JA);   // Jennifer 的基底（老師給的數字）
const JV = [3, 2];
sc('lt-p-coords', '3B1B 換基底：座標 = 縮放 î、ĵ 的倍數', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('2D 空間裡的一個向量', '標準的描述方法：座標 (3, 2)'); S.v = S.F.arrow(JV, COL.g, 'v = (3, 2)'); },
  async (tok, S) => {
    cap('從尾到頭：往右 3 格、往上 2 格', '');
    S.p1 = S.F.arrow([0, 0], COL.k); S.p2 = S.F.arrow([0, 0], COL.k);
    await anim(tok, 1000, (u) => S.F.set(S.p1, [3 * u, 0]));
    await anim(tok, 900, (u) => S.F.set(S.p2, [0, 2 * u], [3, 0]));
  },
  async (tok, S) => { cap('更線代的看法：每個座標是一個 scalar（純量）', '用來拉長或縮短向量'); gone(S.p1, S.p2); },
  async (tok, S) => {
    cap('第一個座標縮放 î', 'î：長度 1、指向右邊');
    S.s1 = S.F.arrow([1, 0], COL.d, '3·î'); await anim(tok, 1200, (u) => S.F.set(S.s1, [1 + 2 * u, 0]));
  },
  async (tok, S) => {
    cap('第二個座標縮放 ĵ', 'ĵ：長度 1、指向正上方');
    S.s2 = S.F.arrow([0, 1], COL.r, '2·ĵ', [3, 0]); await anim(tok, 1200, (u) => S.F.set(S.s2, [0, 1 + u], [3, 0]));
  },
  async (tok, S) => {
    cap('兩個縮放後的向量頭接尾加起來', '就是座標要描述的那個向量');
    ok(eqv(lin(JV, [[1, 0], [0, 1]]), JV), '3·î + 2·ĵ = (3, 2) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('î、ĵ 藏著座標系統所有的隱含假設', '第一個數往右、第二個數往上、一單位多長');
    S.ai.glow(GOLD); S.aj.glow(GOLD);
  },
  async (tok, S) => {
    cap('在向量和一組數字之間翻譯的方法 = 座標系統', 'î、ĵ 叫做標準座標系統的基底向量');
    pane(S, 0, 'coordinate system（座標系統）'); pane(S, 1, 'basis vectors：î、ĵ');
  },
]);

sc('lt-p-jennifer', '3B1B 換基底：Jennifer 的基底 b₁、b₂', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('如果換一組不同的基底向量呢？', ''); },
  async (tok, S) => { cap('朋友 Jennifer 用另一組基底', '叫它們 b₁、b₂'); pane(S, 0, 'Jennifer 的基底：b₁、b₂'); },
  async (tok, S) => { cap('她的 b₁：往右上一點', ''); S.b1 = S.F.arrow(JB1, COL.c, 'b₁'); },
  async (tok, S) => { cap('她的 b₂：往左上', ''); S.b2 = S.F.arrow(JB2, COL.b, 'b₂'); },
  async (tok, S) => { cap('再看剛剛那個向量', '我們說它是 (3, 2)（用 î、ĵ）'); S.v = S.F.arrow(JV, COL.g, '(3, 2)'); },
  async (tok, S) => {
    const J = mulMV(JAi, JV);
    cap('Jennifer 會說它的座標是 (5/3, 1/3)', '');
    pane(S, 1, '她的座標：' + vs(J) + (eqv(J, [5 / 3, 1 / 3]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('意思是：b₁ 乘 5/3、b₂ 乘 1/3，再加起來', '');
    S.q1 = S.F.arrow([0, 0], COL.c); S.q2 = S.F.arrow([0, 0], COL.b);
    const a = scl(JB1, 5 / 3), b = scl(JB2, 1 / 3);
    await anim(tok, 1000, (u) => S.F.set(S.q1, scl(a, u)));
    await anim(tok, 900, (u) => S.F.set(S.q2, scl(b, u), a));
    ok(eqv(addv(a, b), JV), '(5/3)·b₁ + (1/3)·b₂ = (3, 2) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => { cap('一般來說：她的第一個座標縮放 b₁、第二個縮放 b₂', '再把結果加起來'); },
  async (tok, S) => {
    cap('結果通常跟「我們以為的同一組座標」完全不同', '');
    S.ghost = S.F.arrow([5 / 3, 1 / 3], COL.gray, '我們會誤讀成這個');
  },
  async (tok, S) => { cap('更精確地說：在我們的座標裡，b₁ = (2, 1)', ''); gone(S.ghost, S.q1, S.q2); S.b1.tag('b₁ = (2, 1)'); },
  async (tok, S) => { cap('b₂ = (−1, 1)', ''); S.b2.tag('b₂ = (−1, 1)'); },
  async (tok, S) => {
    cap('但在她的系統裡，它們就是 (1, 0) 和 (0, 1)', '是它們定義了她的座標的意義');
    S.b1.tag('b₁：她說 (1, 0)'); S.b2.tag('b₂：她說 (0, 1)');
    ok(eqv(mulMV(JAi, JB1), [1, 0]) && eqv(mulMV(JAi, JB2), [0, 1]), '在她的語言 b₁ = (1, 0)、b₂ = (0, 1) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => { cap('所以我們在說不同的「語言」', '看的是同一批向量，用的字和數字不一樣'); },
]);

sc('lt-p-grid', '3B1B 換基底：格子只是畫出來的，原點大家一樣', async (tok, S) => {
  plane(S);
  S.HG = S.F.grid(COL.b, 0); S.HG.setM(JA);
}, [
  async (tok, S) => { cap('畫 2D 空間時，通常用這個方格子', ''); },
  async (tok, S) => { cap('但格子只是視覺化座標系統的工具', '它取決於我們選的基底'); },
  async (tok, S) => {
    cap('空間本身沒有內建的格子', '');
    const bg = S.axes[0];
    await anim(tok, 1200, (u) => { S.G.material.opacity = 0.85 * (1 - u); bg.material.opacity = 0.5 * (1 - u); });
    hide(S.ai, S.aj);
  },
  async (tok, S) => {
    cap('Jennifer 可以畫她自己的格子', '一樣只是幫忙看懂她座標的工具');
    S.b1 = S.F.arrow(JB1, COL.c, 'b₁'); S.b2 = S.F.arrow(JB2, COL.b, 'b₂');
    await anim(tok, 1200, (u) => { S.HG.material.opacity = 0.8 * u; });
  },
  async (tok, S) => {
    cap('不過她的原點跟我們的一樣', '大家對 (0, 0) 的意思沒有異議');
    S.o = dotBall(COL.r, 0.16); S.o.position.copy(S.F.w([0, 0], 0.14));
  },
  async (tok, S) => {
    cap('原點 = 任何向量乘 0 得到的東西', '');
    await anim(tok, 1100, (u) => S.F.set(S.b1, scl(JB1, 1 - u)));
    await anim(tok, 900, (u) => S.F.set(S.b1, scl(JB1, u)));
    ok(eqv(scl(JB1, 0), [0, 0]) && eqv(mulMV(JA, [0, 0]), [0, 0]), '0·b₁ = 0·î = 原點 ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('但她的軸方向和格線間距跟我們不同', '取決於她選的基底向量');
    await anim(tok, 1200, (u) => { S.G.material.opacity = 0.5 * u; });
  },
]);

sc('lt-p-translate', '3B1B 換基底：用 A = [b₁ b₂] 把她的座標翻成我們的', async (tok, S) => {
  plane(S);
  S.HG = S.F.grid(COL.b, 0.6); S.HG.setM(JA);
  S.b1 = S.F.arrow(JB1, COL.c, 'b₁'); S.b2 = S.F.arrow(JB2, COL.b, 'b₂');
}, [
  async (tok, S) => { cap('怎麼在兩個座標系統之間翻譯？', '例：Jennifer 說一個向量是 (−1, 2)'); pane(S, 0, '她說：(−1, 2)'); },
  async (tok, S) => { cap('在我們的座標系統裡它是什麼？', '從她的語言翻成我們的'); },
  async (tok, S) => { cap('她的座標意思是：−1·b₁ + 2·b₂', ''); pane(S, 1, '= −1·b₁ + 2·b₂'); },
  async (tok, S) => { cap('從我們的角度：b₁ = (2, 1)、b₂ = (−1, 1)', ''); pane(S, 2, 'b₁ = (2, 1)、b₂ = (−1, 1)'); },
  async (tok, S) => {
    cap('用我們的座標算 −1·b₁ + 2·b₂', '');
    S.q1 = S.F.arrow([0, 0], COL.c); S.q2 = S.F.arrow([0, 0], COL.b);
    await anim(tok, 1000, (u) => S.F.set(S.q1, scl(JB1, -u)));
    await anim(tok, 1000, (u) => S.F.set(S.q2, scl(JB2, 2 * u), scl(JB1, -1)));
  },
  async (tok, S) => {
    const r = lin([-1, 2], [JB1, JB2]);
    cap('算出來是 (−4, 1)', '這就是我們對「她的 (−1, 2)」的描述');
    S.r = S.F.arrow(r, COL.g, '我們說 ' + vs(r));
    pane(S, 3, '= ' + vs(r) + (eqv(r, [-4, 1]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('這就是矩陣乘向量', '矩陣的行 = 用我們的語言寫的 b₁、b₂');
    pane(S, 4, 'A = ' + ms(JA) + '：A·(−1, 2) = ' + vs(mulMV(JA, [-1, 2])) + (eqv(mulMV(JA, [-1, 2]), [-4, 1]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('把 A 看成一個變換', '它把我們的 î、ĵ 移到 Jennifer 的 b₁、b₂');
    gone(S.q1, S.q2, S.r); hide(S.b1, S.b2); S.HG.material.opacity = 0.25;
    await S.go(tok, JA, 2000);
    S.ai.tag('î → b₁'); S.aj.tag('ĵ → b₂');
  },
  async (tok, S) => {
    cap('拿我們會想成 (−1, 2) 的那個向量來走一遍', '');
    S.ai.tag('î'); S.aj.tag('ĵ'); await S.go(tok, I2, 900);
    S.v = S.track([-1, 2], COL.g, '我們誤會的 (−1, 2)');
  },
  async (tok, S) => {
    cap('變換前：它是 −1·î + 2·ĵ', '');
    S.c1 = S.track([-1, 0], COL.d, ''); S.c2 = S.track([0, 2], COL.r, '', [-1, 0]);
  },
  async (tok, S) => {
    cap('變換後：同一個組合，只是換成新基底', '−1·(î 的落點) + 2·(ĵ 的落點) = −1·b₁ + 2·b₂');
    await S.go(tok, JA, 2000);
    const r = mulMV(S.M, [-1, 2]);
    S.v.tag('她真正指的 ' + vs(r));
    ok(eqv(r, [-4, 1]), '落在 (−4, 1) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => { cap('這個矩陣把「我們對她的誤會」', '變成她真正指的那個向量'); },
  async (tok, S) => {
    cap('剛學時常覺得方向反了', '');
    pane(S, 5, '幾何上：我們的格子 → 她的格子');
    pane(S, 6, '數值上：她的語言 → 我們的語言');
  },
  async (tok, S) => {
    cap('想通的關鍵：它把「用同樣數字、但在我們系統裡的誤會」', '轉成她真正的意思');
    S.v.glow(GOLD);
  },
]);

sc('lt-p-inverse', '3B1B 換基底：反方向用 A⁻¹', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('那反方向呢？', '從我們的語言翻成她的'); },
  async (tok, S) => {
    cap('開頭的例子：我們的 (3, 2)', '怎麼算出她的 (5/3, 1/3)？');
    S.v = S.F.arrow(JV, COL.g, '我們的 (3, 2)');
  },
  async (tok, S) => {
    cap('先拿把她的語言翻成我們的那個換基底矩陣 A', '再取它的反矩陣 A⁻¹');
    pane(S, 0, 'A = ' + ms(JA) + '　→　A⁻¹');
  },
  async (tok, S) => {
    cap('反矩陣 = 把原本的變換倒著播放', '');
    await S.go(tok, JA, 1000); await S.go(tok, I2, 1500);
  },
  async (tok, S) => { cap('實際上（尤其超過二維時）', '通常交給電腦算反矩陣'); },
  async (tok, S) => {
    cap('這裡 A⁻¹ 的兩行是 (1/3, −1/3) 和 (1/3, 2/3)', '');
    const want = fromCols([1 / 3, -1 / 3], [1 / 3, 2 / 3]);
    pane(S, 1, 'A⁻¹ = ' + ms(JAi) + (eqv(JAi, want) && eqv(mm(JA, JAi), I2) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    const J = mulMV(JAi, JV);
    cap('A⁻¹ 乘 (3, 2)', '= (5/3, 1/3)：就是她的座標');
    pane(S, 2, 'A⁻¹·(3, 2) = ' + vs(J) + (eqv(J, [5 / 3, 1 / 3]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('總結：A 把她的語言翻成我們的', 'A⁻¹ 把我們的翻成她的');
    pane(S, 3, '她 → 我們：乘 A'); pane(S, 4, '我們 → 她：乘 A⁻¹');
  },
]);

const JM = R90, JMB = mm(JAi, mm(JM, JA));
sc('lt-p-rotation', '3B1B 換基底：旋轉 90° 在 Jennifer 的語言 = A⁻¹MA', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('用座標描述的不只是向量', '變換也是'); },
  async (tok, S) => { cap('例：逆時針旋轉 90°', ''); await S.go(tok, JM, 2000); },
  async (tok, S) => { cap('我們用矩陣表示它時，追蹤 î、ĵ 去哪', ''); S.ai.glow(GOLD); S.aj.glow(GOLD); },
  async (tok, S) => { cap('î 到了 (0, 1)', ''); S.ai.tag('î → ' + vs(colOf(JM, 0))); },
  async (tok, S) => { cap('ĵ 到了 (−1, 0)', ''); S.aj.tag('ĵ → ' + vs(colOf(JM, 1))); },
  async (tok, S) => { cap('這兩組座標變成矩陣的行', ''); pane(S, 0, '我們的 M = ' + ms(JM)); },
  async (tok, S) => { cap('這個表示法跟我們選的基底綁在一起', '追蹤的是 î、ĵ，記錄也用我們的座標'); },
  async (tok, S) => {
    cap('Jennifer 會怎麼描述同一個 90° 旋轉？', '');
    S.ai.glow(null); S.aj.glow(null); S.ai.tag('î'); S.aj.tag('ĵ');
    await S.go(tok, I2, 900);
    S.HG = S.F.grid(COL.b, 0.55); S.HG.setM(JA);
    S.b1 = S.F.arrow(JB1, COL.c, 'b₁'); S.b2 = S.F.arrow(JB2, COL.b, 'b₂');
  },
  async (tok, S) => {
    const naive = fromCols(mulMV(JAi, colOf(JM, 0)), mulMV(JAi, colOf(JM, 1)));
    cap('直接把 M 的行翻成她的語言？', '不對！');
    pane(S, 1, '只翻譯 M 的行 = ' + ms(naive) + (eqv(naive, JMB) ? '' : ' ✘'), 'bad');
  },
  async (tok, S) => {
    cap('那些行是「我們的」基底去哪', '她要的是「她的」b₁、b₂ 落在哪，而且用她的語言');
    S.r1 = S.F.arrow(mulMV(JM, JB1), COL.c, '轉後的 b₁'); S.r2 = S.F.arrow(mulMV(JM, JB2), COL.b, '轉後的 b₂');
  },
  async (tok, S) => {
    cap('常見的想法：從她語言裡的任一個向量開始', '例：她的 (−1, 2)');
    gone(S.r1, S.r2); pane(S, 2, '① 她的向量：(−1, 2)');
  },
  async (tok, S) => {
    const w = mulMV(JA, [-1, 2]);
    cap('先用換基底矩陣 A 翻成我們的語言', '同一個向量，現在用我們的話寫');
    S.w = S.F.arrow(w, COL.g, vs(w));
    pane(S, 3, '② A·(−1, 2) = ' + vs(w) + (eqv(w, [-4, 1]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    const w = mulMV(JA, [-1, 2]), r = mulMV(JM, w);
    cap('再乘上變換矩陣 M（乘在左邊）', '得到落點，但還是我們的語言');
    await anim(tok, 1600, (u) => S.F.set(S.w, mulMV(rot2(90 * u), w)));
    S.w.tag(vs(r));
    pane(S, 4, '③ M·(−4, 1) = ' + vs(r) + (eqv(r, [-1, -4]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    const r = mulMV(JAi, mulMV(JM, mulMV(JA, [-1, 2])));
    cap('最後乘 A⁻¹：翻回她的語言', '');
    pane(S, 5, '④ A⁻¹·(−1, −4) = ' + vs(r), 'good');
  },
  async (tok, S) => { cap('任何她的向量都能這樣做', '三個矩陣合成 A⁻¹MA = 她語言裡的變換矩陣'); pane(S, 6, 'A⁻¹ M A：先翻譯、再轉、再翻回'); },
  async (tok, S) => {
    const want = fromCols([1 / 3, 5 / 3], [-2 / 3, -1 / 3]);
    cap('這個例子算出來：行是 (1/3, 5/3) 和 (−2/3, −1/3)', '');
    pane(S, 7, 'A⁻¹MA = ' + ms(JMB) + (eqv(JMB, want) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    const a = mulMV(JMB, [-1, 2]), b = mulMV(JAi, mulMV(JM, mulMV(JA, [-1, 2])));
    cap('Jennifer 把這個矩陣乘她的座標', '就得到轉 90° 後的向量（用她的座標）');
    ok(eqv(a, b), '(A⁻¹MA)·(−1, 2) = ' + vs(a) + ' = 步驟④ ✓', 3.0, 0.5, -4.3);
  },
]);

sc('lt-p-empathy', '3B1B 換基底：A⁻¹MA = 換個角度看同一個變換', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
  S.c = ['A⁻¹', 'M', 'A'].map((t, i) => cube(t, [COL.b, COL.r, COL.b][i], [1.2, 0.9, 0.5], -2.2 + i * 1.6, 4.6, 0));
}, [
  async (tok, S) => { cap('看到 A⁻¹ M A 這種式子', '代表一種數學上的「同理心」'); },
  async (tok, S) => { cap('中間的 M：你眼中的那個變換', ''); glow(S.c[1], GOLD); sm('你看到的變換', -0.6, 3.6); },
  async (tok, S) => { cap('外面兩個：同理心 = 視角的轉換', ''); glow(S.c[0], GOLD); glow(S.c[2], GOLD); sm('換視角', -2.2, 3.6); sm('換視角', 1.0, 3.6); },
  async (tok, S) => {
    cap('整個乘積：同一個變換，換成別人看到的樣子', '');
    S.g = mgrid(JMB, 3.4, 5.0, 0, { color: () => COL.c }); hd('=', 2.6, 4.6);
    ok(eqv(mm(JA, JMB), mm(JM, JA)), 'A·(A⁻¹MA) = M·A ✓', 3.9, 2.9);
  },
  async (tok, S) => { cap('為什麼要在乎別的座標系統？', '下一集特徵向量會給重要的例子'); },
]);

// ═══════════════════════ 3Blue1Brown：Cross products in the light of linear transformations ═══════════════════════
// v = (2, 0, 1)、w = (0, 2, 1) 是示範用的數字（影片只用一般的 v、w）；CV、CW、CP 來自模組。
const cof1 = (v, w) => [det2([[v[1], w[1]], [v[2], w[2]]]), -det2([[v[0], w[0]], [v[2], w[2]]]), det2([[v[0], w[0]], [v[1], w[1]]])];
const pgArea = (v, w) => Math.sqrt(dot(v, v) * dot(w, w) - dot(v, w) ** 2);
const fvol = (x) => det3(fromCols(x, CV, CW));
function crossStage(S, s = 0.55, ang = 35, el = 22) {
  fresh([0, 0, 0], LOOK3); cam(ang, el, 10.5, LOOK3);
  S.Sp = space3(0, 2.6, 0, s, 2.6);
  S.av = S.Sp.arrow(CV, COL.a, 'v'); S.aw = S.Sp.arrow(CW, COL.b, 'w');
}
sc('lt-c-recap', '叉積回顧：怪行列式算法 + 長度 = 面積、方向 ⊥ v、w', async (tok, S) => {
  crossStage(S);
}, [
  async (tok, S) => { cap('上次說到：三維叉積 v × w 怎麼算', 'v = (2, 0, 1)、w = (0, 2, 1)（示意）'); },
  async (tok, S) => {
    cap('寫一個矩陣：第 2 行放 v、第 3 行放 w', '');
    S.P = code(['[ ?  ' + CV[0] + '  ' + CW[0] + ' ]', '[ ?  ' + CV[1] + '  ' + CW[1] + ' ]', '[ ?  ' + CV[2] + '  ' + CW[2] + ' ]'], -4.4, 6.2);
  },
  async (tok, S) => {
    cap('第 1 行放的卻是符號 î、ĵ、k̂', '計算時假裝它們是數字');
    ['î', 'ĵ', 'k̂'].forEach((s, i) => txt(S.P.ls[i], '[ ' + s + '  ' + CV[i] + '  ' + CW[i] + ' ]'));
  },
  async (tok, S) => { cap('拿這個怪矩陣去算行列式', ''); S.P.ls.forEach((l) => setCls(l, 'ptr alt')); hd('det', -5.6, 5.6); },
  async (tok, S) => {
    const p = cof1(CV, CW);
    cap('照算下去：某數·î + 某數·ĵ + 某數·k̂', '這裡 = −2î − 2ĵ + 4k̂');
    ok(eqv(p, CP) && eqv(p, [-2, -2, 4]), '= −2î − 2ĵ + 4k̂ ✓', -4.4, 4.2);
  },
  async (tok, S) => {
    cap('三個數解讀成一個向量的座標', 'v × w = (−2, −2, 4)');
    S.ap = S.Sp.arrow([0, 0, 0.001], COL.r, 'v × w');
    await anim(tok, 1300, (u) => S.Sp.set(S.ap, scl(CP, Math.max(0.01, u))));
  },
  async (tok, S) => { cap('接著學生通常被要求「相信」它的幾何性質', ''); },
  async (tok, S) => {
    cap('長度 = v、w 張成的平行四邊形面積', '|v × w| = √24 ≈ 4.90');
    S.pg = pgram(S.Sp, CV, CW, COL.g, 0); await anim(tok, 800, (u) => (S.pg.material.opacity = 0.32 * u));
    ok(Math.abs(norm(CP) - pgArea(CV, CW)) < 1e-9, '|v × w| = 面積 = √' + fmt(dot(CP, CP)) + ' ✓', -4.4, 3.5);
  },
  async (tok, S) => {
    cap('方向同時垂直於 v 和 w', '');
    ok(dot(CP, CV) === 0 && dot(CP, CW) === 0, '(v×w)·v = 0、(v×w)·w = 0 ✓', -4.4, 2.9);
  },
  async (tok, S) => {
    cap('方向遵守右手定則', '食指指 v、中指指 w，拇指 = v × w');
    await orb(tok, 2500, 35, 110);
  },
  async (tok, S) => { cap('可以用蠻力計算驗證這些性質', '但這集要分享一條很優雅的推理'); },
  async (tok, S) => { cap('需要的背景：第 5 集（行列式）', '和第 7 集（對偶性 duality）'); },
]);

const DP = [2, 1, 2];   // 示意的 1×3 矩陣 [2 1 2]
sc('lt-c-dual', '對偶性：R³ → 數線的線性變換 = 跟向量 p 做內積', async (tok, S) => {
  fresh([0, 0, 0], LOOK3); cam(28, 24, 10.5, LOOK3);
  S.Sp = space3(0, 2.6, 0, 0.75, 2.6);
}, [
  async (tok, S) => {
    cap('對偶性：每個「空間 → 數線」的線性變換', '都對應空間中唯一的一個向量');
    const pn = norm(DP), u = scl(DP, 1 / pn);
    S.Sp.line(DP, COL.k, 3.4, [0, 0, 0], 0.025);
    for (let k = -6; k <= 9; k += 3) { const q = S.Sp.w(scl(u, k / pn)); sm(String(k), q.x, q.y + 0.25, q.z); }
  },
  async (tok, S) => { cap('做這個變換 = 跟那個向量做內積', ''); },
  async (tok, S) => {
    cap('數值上：這種變換是只有一列的矩陣', '每一行 = 一個基底向量落在哪個數（示意 [2 1 2]）');
    S.P = mono(hd('[ 2  1  2 ]', -4.4, 6.0)); sm('î ↦ 2、ĵ ↦ 1、k̂ ↦ 2', -4.4, 5.4);
  },
  async (tok, S) => {
    cap('矩陣乘向量 = 跟「把矩陣立起來」的向量做內積', '');
    S.ap = S.Sp.arrow(DP, COL.r, 'p = (2, 1, 2)');
    mono(hd('[2 1 2]·x = p·x', -4.4, 4.7));
  },
  async (tok, S) => {
    const x = [1, 1, 1], u = scl(DP, 1 / norm(DP));
    cap('找到任何到數線的線性變換', '都能配上一個對偶向量（dual vector）');
    S.ax = S.Sp.arrow([1, 0, 0], COL.a, 'x'); S.drop = rod(COL.g, 0.02); S.mk = dotBall(COL.g, 0.11);
    await anim(tok, 1200, (t) => { const y = addv([1, 0, 0], scl(addv(x, [-1, 0, 0]), t)); S.Sp.set(S.ax, y); const pr = scl(u, dot(y, u)); S.drop.setW(S.Sp.w(y), S.Sp.w(pr)); S.mk.position.copy(S.Sp.w(pr)); });
    ok(dot(DP, x) === 5 && mulMV([DP], x)[0] === 5, 'x = (1, 1, 1)：[2 1 2]x = p·x = 5 ✓', -4.4, 4.0);
  },
  async (tok, S) => { cap('叉積就是這個過程很漂亮的例子', '要花點力氣，但很值得'); },
  async (tok, S) => { cap('計畫：用 v、w 定義一個 3D → 數線的線性變換', ''); hd('f：R³ → R（由 v、w 決定）', -4.4, 3.2); },
  async (tok, S) => { cap('它在 3D 空間的對偶向量', '就會是 v × w'); hot('f 的對偶向量 = v × w', -4.4, 2.6); },
  async (tok, S) => { cap('理解這個變換，就能看清', '叉積的「算法」和「幾何」之間的關係'); },
]);

sc('lt-c-det', '行列式 = 有向面積 / 有向體積', async (tok, S) => {
  fresh([0, 0, 0], LOOK3); cam(20, 30, 10.5, LOOK3);
  S.Sp = space3(0, 2.6, 0, 0.9, 2.6);
  S.v = [2, 1, 0]; S.w = [0.5, 1.5, 0];
  S.av = S.Sp.arrow(S.v, COL.a, 'v'); S.aw = S.Sp.arrow(S.w, COL.b, 'w');
}, [
  async (tok, S) => { cap('回想 2D 版的「叉積」', 'v 的座標當第 1 行、w 當第 2 行（示意 v = (2, 1)、w = (0.5, 1.5)）'); },
  async (tok, S) => {
    const d = det2([[2, 0.5], [1, 1.5]]);
    cap('算行列式：就是一個普通的數字', 'det[2 0.5; 1 1.5] = 3 − 0.5');
    ok(d === 2.5, 'det[v w] = ' + fmt(d) + ' ✓', -4.4, 6.0);
  },
  async (tok, S) => {
    cap('幾何意義：v、w 張成的平行四邊形面積', '');
    S.pg = pgram(S.Sp, S.v, S.w, COL.g, 0); await anim(tok, 800, (u) => (S.pg.material.opacity = 0.3 * u));
  },
  async (tok, S) => {
    const d = det2([[0.5, 2], [1.5, 1]]);
    cap('可能是負的：看兩個向量的方向（定向）', '把 v、w 順序對調');
    ok(d === -2.5, 'det[w v] = ' + fmt(d) + ' ✓', -4.4, 5.4);
  },
  async (tok, S) => { cap('如果硬要推廣到 3D…', '三個 3D 向量 u、v、w 當 3×3 矩陣的行，再取行列式'); },
  async (tok, S) => {
    const u0 = [0.3, 0.4, 1.6];
    cap('第 5 集：這是 u、v、w 張成的平行六面體體積', '');
    S.au = S.Sp.arrow([0, 0, 0.001], COL.c, 'u'); S.box = ppiped(S.Sp, [0, 0, 0.001], S.v, S.w, COL.c, 0.18);
    await anim(tok, 1400, (t) => { const u = scl(u0, Math.max(0.01, t)); S.Sp.set(S.au, u); S.box.set(u, S.v, S.w); });
    const d = det3(fromCols(u0, S.v, S.w));
    ok(Math.abs(d - 4) < 1e-9, 'det[u v w] = 2.5 × 1.6 = ' + fmt(d) + ' ✓', -4.4, 4.8);
  },
  async (tok, S) => {
    const u0 = [0.3, 0.4, 1.6], u1 = addv(u0, [0, 0, -3]);
    cap('正負號看右手定則的定向', 'u 跑到另一側 → 負的');
    await anim(tok, 1400, (t) => { const u = addv(u0, scl([0, 0, -3], t)); S.Sp.set(S.au, u); S.box.set(u, S.v, S.w); });
    const d = det3(fromCols(u1, S.v, S.w));
    ok(Math.abs(d + 3.5) < 1e-9, 'det[u v w] = 2.5 × (−1.4) = ' + fmt(d) + ' ✓', -4.4, 4.2);
  },
  async (tok, S) => { cap('當然，這不是 3D 叉積', ''); bad('✘ 三個向量 → 一個數', -4.4, 3.4); },
  async (tok, S) => { cap('真正的 3D 叉積：吃兩個向量、吐一個向量', ''); good('兩個向量 → 一個向量', -4.4, 2.8); },
  async (tok, S) => { cap('但這個想法已經非常接近真正的叉積了', ''); },
]);

sc('lt-c-func', '把第一個向量換成變數：f(x) = det[x v w] 是線性函數', async (tok, S) => {
  crossStage(S, 0.55, 38, 22);
  S.pg = pgram(S.Sp, CV, CW, COL.g, 0.28);
}, [
  async (tok, S) => { cap('把第一個向量 u 換成變數 (x, y, z)', 'v、w 保持固定'); },
  async (tok, S) => { cap('這樣得到一個函數：三維 → 數線', ''); },
  async (tok, S) => {
    cap('輸入 (x, y, z)，輸出一個數', '= 第 1 行是 (x, y, z)、另兩行是 v、w 的行列式');
    S.P = mono(hd('f(x, y, z) = det[ (x,y,z)  v  w ]', -3.6, 6.2));
    S.ax = arrow(COL.k); S.ax.tag('(x, y, z)'); S.box = ppiped(S.Sp, [0, 0, 0.01], CV, CW, COL.c, 0.16);
    S.out = hot(' ', 3.6, 5.6); S.cur = [0, 0, 0.01]; S.Sp.set(S.ax, S.cur);
  },
  async (tok, S) => {
    const x = [0, 0, 1];
    cap('幾何意義：(x, y, z)、v、w 張成的平行六面體', '回傳它的體積');
    await moveX(tok, S, x);
    ok(fvol(x) === dot(CP, x) && fvol(x) === 4, '(0, 0, 1) → 體積 ' + fvol(x) + ' ✓', -3.6, 5.5);
  },
  async (tok, S) => {
    const x = [1, 1, 0];
    cap('帶正負號：看定向', '');
    await moveX(tok, S, x);
    ok(fvol(x) === -4, '(1, 1, 0) → ' + fvol(x) + '（另一側：負）✓', -3.6, 4.9);
  },
  async (tok, S) => { cap('這個函數看起來有點突然：它從哪來？', '先接受它，玩玩看它的性質'); },
  async (tok, S) => {
    const x = [0, 0, 2];
    cap('最重要的事實：這個函數是線性的', '（由行列式的性質可以推得）');
    await moveX(tok, S, x);
    ok(fvol(x) === 2 * fvol([0, 0, 1]), '輸入加倍 → 體積 ' + fvol(x) + ' = 2 × 4 ✓', -3.6, 4.3);
  },
  async (tok, S) => { cap('知道它是線性的，就能用上對偶性', ''); },
  async (tok, S) => { cap('線性 ⇒ 一定能寫成矩陣乘法', ''); },
  async (tok, S) => { cap('從三維到一維：是一個 1×3 矩陣', ''); mono(hd('f(x) = [ ?  ?  ? ] x', -3.6, 3.6)); },
  async (tok, S) => { cap('對偶性：把矩陣立起來', '整個變換 = 跟某個向量做內積'); },
  async (tok, S) => { cap('要找的向量叫 p', 'p·(x, y, z) = det[(x, y, z) v w]'); hot('找 p：p·(x,y,z) = det[(x,y,z) v w]', -3.6, 3.0); },
]);
async function moveX(tok, S, x) {
  const from = S.cur.slice();
  await anim(tok, 1200, (t) => { const y = addv(from, scl(addv(x, scl(from, -1)), t)); S.Sp.set(S.ax, y); S.box.set(y, CV, CW); txt(S.out, 'f = ' + Math.round(fvol(y) * 10) / 10); });
  S.cur = x.slice();
}

sc('lt-c-comp', '計算面：展開行列式，係數就是 p 的座標', async (tok, S) => {
  fresh([0, 3.4, 12], [0, 3.6, 0]);
  S.g = mgrid([['x', CV[0], CW[0]], ['y', CV[1], CW[1]], ['z', CV[2], CW[2]]], -5.6, 5.4, 0, { color: (i, j) => (j === 0 ? COL.k : j === 1 ? COL.a : COL.b) });
  tag('det', 'ptr', -6.4, 4.6);
}, [
  async (tok, S) => { cap('先從計算的角度想', 'v = (2, 0, 1)、w = (0, 2, 1)（示意）'); },
  async (tok, S) => { cap('左邊：p·(x, y, z) = p₁x + p₂y + p₃z', '係數就是 p 的座標'); mono(hd('p·(x,y,z) = p₁x + p₂y + p₃z', 2.6, 6.3)); },
  async (tok, S) => termStep(S, 0, 'x·(' + CV[1] + '·' + CW[2] + ' − ' + CW[1] + '·' + CV[2] + ')', '沿第 1 行展開：x 的係數'),
  async (tok, S) => termStep(S, 1, '− y·(' + CV[0] + '·' + CW[2] + ' − ' + CW[0] + '·' + CV[2] + ')', 'y 的係數（注意負號）'),
  async (tok, S) => termStep(S, 2, '+ z·(' + CV[0] + '·' + CW[1] + ' − ' + CW[0] + '·' + CV[1] + ')', 'z 的係數'),
  async (tok, S) => {
    S.g.clearGlow();
    const p = cof1(CV, CW);
    cap('這些常數（v、w 座標的組合）就是 p 的座標', '');
    mono(hd('det = ' + fmt(p[0]) + 'x ' + (p[1] < 0 ? '− ' : '+ ') + fmt(Math.abs(p[1])) + 'y ' + (p[2] < 0 ? '− ' : '+ ') + fmt(Math.abs(p[2])) + 'z', 2.6, 3.0));
    ok(eqv(p, CP), 'p = ' + vs(p) + ' ✓', 2.6, 2.3);
  },
  async (tok, S) => { cap('做過叉積計算的人，應該覺得很眼熟', ''); },
  async (tok, S) => {
    cap('把 x、y、z 前面的係數收集起來', '跟「第 1 行塞進 î、ĵ、k̂」完全一樣');
    ['î', 'ĵ', 'k̂'].forEach((s, i) => relabel(S.g.c[i][0], s)); S.g.col(0, GOLD);
  },
  async (tok, S) => { cap('塞 î、ĵ、k̂ 只是提醒：', '這些係數要讀成一個向量的座標'); hot('−2î − 2ĵ + 4k̂ = v × w', 2.6, 1.5); },
  async (tok, S) => {
    cap('所以這個怪算法在回答：', '哪個 p 讓 p·(x,y,z) = det[(x,y,z) v w]？');
    S.g.clearGlow();
  },
]);
async function termStep(S, i, a, sub) {
  const rows = [0, 1, 2].filter((r) => r !== i);
  const minor = det2(rows.map((r) => [[CV, CW][0][r], [CV, CW][1][r]]));
  const coef = (i === 1 ? -1 : 1) * minor;
  S.g.clearGlow(); glow(S.g.c[i][0], GOLD); rows.forEach((r) => { glow(S.g.c[r][1], GREEN); glow(S.g.c[r][2], GREEN); });
  cap(sub, a + ' = ' + fmt(coef) + ['x', 'y', 'z'][i]);
  const l = mono(hd(a + ' = ' + (coef >= 0 && i ? '+' : '') + fmt(coef) + ['x', 'y', 'z'][i], 2.6, 5.4 - i * 0.7));
  if (coef !== CP[i]) log('check failed: term ' + i, true);
  return l;
}

sc('lt-c-geo', '幾何面：體積 = 面積 × 高 = p·x，p ⊥ v、w', async (tok, S) => {
  crossStage(S, 0.55, 40, 18);
  S.pg = pgram(S.Sp, CV, CW, COL.g, 0.3);
}, [
  async (tok, S) => { cap('精彩的部分：把它和叉積的幾何連起來', ''); },
  async (tok, S) => { cap('同一個問題，這次用幾何來回答', ''); },
  async (tok, S) => {
    S.x = [1.4, -1.2, 1.5];
    cap('哪個 p 讓 p·(x, y, z)', '= (x, y, z)、v、w 的平行六面體有向體積？');
    S.ax = S.Sp.arrow(S.x, COL.k, 'x'); S.box = ppiped(S.Sp, S.x, CV, CW, COL.c, 0.14);
  },
  async (tok, S) => { cap('內積的幾何：把另一個向量投影到 p 上', '再乘上 p 的長度'); },
  async (tok, S) => {
    cap('體積的另一種算法：先取 v、w 平行四邊形的面積', '再乘「x 垂直於平行四邊形的分量」');
    S.pg.material.opacity = 0.5;
  },
  async (tok, S) => {
    const n = scl(CP, 1 / norm(CP)), h = dot(S.x, n);
    cap('也就是：把 x 投影到垂直 v、w 的直線上', '投影長度 × 面積');
    S.Sp.line(CP, COL.r, 2.4, [0, 0, 0], 0.012);
    S.hr = rod(COL.r, 0.04); await anim(tok, 1000, (t) => S.hr.setW(S.Sp.w([0, 0, 0]), S.Sp.w(scl(n, h * Math.max(0.01, t)))));
    const hl = S.Sp.w(scl(n, h + 0.3)); hd('高 = ' + h.toFixed(2), hl.x, hl.y, hl.z);
  },
  async (tok, S) => {
    cap('這正是跟一個「⊥ v、w、長度 = 面積」的向量做內積', '');
    S.ap = S.Sp.arrow([0, 0, 0.001], COL.r, 'p'); await anim(tok, 1200, (t) => S.Sp.set(S.ap, scl(CP, 0.6 * Math.max(0.01, t))));
    S.ap.tag('p（畫成 0.6 倍）');
  },
  async (tok, S) => {
    const x2 = [-1, 1, -1.2];
    cap('方向選對：內積為負的情況', '剛好就是 (x, v, w) 不符合右手定則的情況');
    ok(dot(CP, x2) < 0 && fvol(x2) < 0, '另一側的 x：p·x、det 都是負的 ✓', -4.4, 5.6);
  },
  async (tok, S) => {
    const d = fvol(S.x), pd = dot(CP, S.x);
    cap('找到了：p·(x, y, z) = det[(x, y, z) v w]', '');
    ok(Math.abs(d - pd) < 1e-9, 'p·x = ' + fmt(Math.round(pd * 100) / 100) + ' = det[x v w] ✓', -4.4, 5.0);
  },
  async (tok, S) => {
    cap('所以先前用符號技巧算出的向量', '幾何上一定就是這個向量');
    ok(eqv(cof1(CV, CW), CP) && Math.abs(norm(CP) - pgArea(CV, CW)) < 1e-9, '算法的 p = 幾何的 p ✓', -4.4, 4.4);
  },
  async (tok, S) => { cap('這就是叉積的「算法」和「幾何」相關的根本原因', ''); await orb(tok, 2500, 40, 100, 18); },
]);

// ═══════════════════════ MIT 18.06 L30：Linear Transformations and Their Matrices ═══════════════════════
const MA = [2, 1];                                  // 示意：投影的那條線的方向
const prj = (a) => (v) => scl(a, dot(a, v) / dot(a, a));
const PR = prj(MA);
function projStage(S) {
  plane(S, { basis: false }); S.G.visible = false;
  S.ln = rod(COL.k, 0.03); S.ln.setW(S.F.w([-5.2, -2.6], 0.1), S.F.w([5.2, 2.6], 0.1));
}
function setVT(S, v) {   // v、T(v) 和垂直的投影線
  S.F.set(S.av, v); S.F.set(S.at, PR(v)); S.drop.setW(S.F.w(v, 0.11), S.F.w(PR(v), 0.11));
}
sc('lt-m-proj', 'MIT L30：例一 投影——不用矩陣也能描述的變換', async (tok, S) => {
  projStage(S); S.ln.visible = false;
}, [
  async (tok, S) => { cap('例一：投影（projection）', '不用講任何矩陣就能描述'); },
  async (tok, S) => { cap('它把 R² 的每個向量', '送到平面上的另一個向量'); },
  async (tok, S) => {
    cap('規則：取一條通過 a 的直線', '把每個向量都投影到這條線上');
    S.ln.visible = true; S.a = S.F.arrow(MA, COL.k, 'a（示意）');
  },
  async (tok, S) => {
    const v = [1, 2];
    cap('取一個向量 v，投影產生 T(v)', '');
    S.av = S.F.arrow(v, COL.g, 'v'); S.at = S.F.arrow([0, 0], COL.r, 'T(v)'); S.drop = rod(COL.gray, 0.02);
    await anim(tok, 1200, (u) => { const p = PR(v); S.F.set(S.at, scl(p, Math.max(0.01, u))); S.drop.setW(S.F.w(v, 0.11), S.F.w(addv(v, scl(addv(p, scl(v, -1)), u)), 0.11)); });
    ok(Math.abs(dot(addv(v, scl(PR(v), -1)), MA)) < 1e-9, 'v − T(v) ⊥ 直線 ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => { cap('T 就像一個函數：給輸入、產生輸出', 'transformation 有時也叫 map、mapping'); },
  async (tok, S) => {
    const w = [-0.5, 2];
    cap('再取一個向量 w：T(w) 是什麼？', '一樣投影到那條線上');
    S.bw = S.F.arrow(w, COL.c, 'w'); S.bt = S.F.arrow(PR(w), COL.b, 'T(w)'); rod(COL.gray, 0.02).setW(S.F.w(w, 0.11), S.F.w(PR(w), 0.11));
  },
  async (tok, S) => {
    cap('這裡完全沒有座標', '老師把畫好的座標軸擦掉：根本不需要');
    await anim(tok, 1000, (u) => S.axes.forEach((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - u; } }));
    S.axes.forEach((o) => (o.visible = false));
  },
]);

sc('lt-m-rules', 'MIT L30：線性的規則 T(cv + dw) = cT(v) + dT(w)', async (tok, S) => {
  projStage(S);
  S.av = S.F.arrow([1, 2], COL.g, 'v'); S.at = S.F.arrow(PR([1, 2]), COL.r, 'T(v)'); S.drop = rod(COL.gray, 0.02); setVT(S, [1, 2]);
}, [
  async (tok, S) => { cap('變換有很多種', '這門課要的是「線性」變換'); },
  async (tok, S) => {
    cap('規則跟向量的兩種運算有關：相加、乘純量', '');
    pane(S, 0, 'T(v + w) = T(v) + T(w)'); pane(S, 1, 'T(cv) = c·T(v)');
  },
  async (tok, S) => {
    const v = [1, 2];
    cap('投影是線性的：v 變兩倍長，投影也變兩倍長', '');
    await anim(tok, 1200, (u) => setVT(S, scl(v, 1 + u)));
    S.av.tag('2v'); S.at.tag('T(2v)');
    ok(eqv(PR(scl(v, 2)), scl(PR(v), 2)), 'T(2v) = 2T(v) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    const v = [1, 2];
    cap('v 換成 −v，投影也變成負的', '');
    await anim(tok, 1500, (u) => setVT(S, scl(v, 2 - 3 * u)));
    S.av.tag('−v'); S.at.tag('T(−v)');
    ok(eqv(PR(scl(v, -1)), scl(PR(v), -1)), 'T(−v) = −T(v) ✓', 3.0, 0.5, -3.7);
  },
  async (tok, S) => {
    const v = [1, 2];
    cap('c = 2、c = −1…任何 c 都成立', '');
    S.av.tag('cv'); S.at.tag('T(cv)');
    await anim(tok, 1800, (u) => setVT(S, scl(v, -1 + 2.2 * u)));
    ok([-1, 0.5, 1.2, 3].every((c) => eqv(PR(scl(v, c)), scl(PR(v), c))), 'T(cv) = cT(v)（任何 c）✓', 3.0, 0.5, -3.1);
  },
  async (tok, S) => {
    const v = [1, 2], w = [-0.5, 2];
    cap('兩條合成一條：線性組合進去', '同樣的線性組合出來');
    setVT(S, v); S.av.tag('v'); S.at.tag('T(v)');
    S.F.arrow(w, COL.c, 'w'); S.F.arrow(addv(v, w), COL.d, 'v + w'); S.F.arrow(PR(addv(v, w)), COL.b, 'T(v + w)');
    pane(S, 2, 'T(cv + dw) = cT(v) + dT(w)');
    ok(eqv(PR(addv(scl(v, 2), scl(w, -1))), addv(scl(PR(v), 2), scl(PR(w), -1))) && eqv(PR(addv(v, w)), addv(PR(v), PR(w))), 'T(v + w) = T(v) + T(w) ✓', 3.0, 0.5, -2.5);
  },
]);

const V0 = [1.5, 0.5];   // 示意：平移量 v₀
const SHF = (v) => addv(v, V0);
const vlen = (v) => Math.sqrt(dot(v, v));
sc('lt-m-nonex', 'MIT L30：反例——平移整個平面、取長度', async (tok, S) => {
  plane(S, { basis: false });
  S.o = dotBall(COL.r, 0.14); S.o.position.copy(S.F.w([0, 0], 0.14));
}, [
  async (tok, S) => {
    cap('例二：把整個平面平移', '每個向量都加上同一個 v₀（示意 v₀ = (1.5, 0.5)）');
    await anim(tok, 1500, (u) => { S.G.position.set(V0[0] * 0.72 * u, 0, -V0[1] * 0.72 * u); S.o.position.copy(S.F.w(scl(V0, u), 0.14)); });
  },
  async (tok, S) => {
    const v = [1, 1];
    cap('T(v) = v + v₀', '');
    S.v = S.F.arrow(v, COL.g, 'v'); S.v0 = S.F.arrow(V0, COL.k, 'v₀', v); S.tv = S.F.arrow(SHF(v), COL.r, 'T(v)');
  },
  async (tok, S) => { cap('看起來是個合理又簡單的變換', '它是線性的嗎？'); },
  async (tok, S) => { cap('答案：不是', ''); S.nb = bad('✘ 不是線性', 3.0, 0.5, -4.3); },
  async (tok, S) => {
    const v = [1, 1], a = SHF(scl(v, 2)), b = scl(SHF(v), 2);
    cap('v 變兩倍，T(v) 有變兩倍嗎？沒有', '還是只加一個 v₀，不是兩個');
    S.F.arrow(a, COL.r, 'T(2v) = ' + vs(a)); S.F.arrow(b, COL.gray, '2T(v) = ' + vs(b));
    ok(!eqv(a, b), '✘ T(2v) ≠ 2T(v)（檢查 ✓）', 3.0, 0.5, -3.7);
  },
  async (tok, S) => { cap('其實有個特別值得注意的情況', '線性變換的 T(0) 是什麼？'); },
  async (tok, S) => { cap('線性變換一定把零向量送到零向量', '原點不能動'); pane(S, 0, '線性 ⇒ T(0) = 0', 'good'); },
  async (tok, S) => { cap('取 v = 0、c = 3：T(0) = 3T(0)', '所以 T(0) 只能是 0'); pane(S, 1, 'T(3·0) = 3T(0) ⇒ T(0) = 0'); },
  async (tok, S) => {
    cap('平移：T(0) = v₀ ≠ 0', '所以平移整個平面不是線性變換');
    glow(S.o, RED); ok(!eqv(SHF([0, 0]), [0, 0]), '✘ T(0) = ' + vs(SHF([0, 0])) + ' ≠ 0（檢查 ✓）', -1.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('另一個反例：T(v) = ‖v‖（長度）', '從 R³ 送到 R¹（實數）');
    pane(S, 2, 'T(v) = ‖v‖：R³ → R¹'); pane(S, 3, '例（示意）v = (1, 2, 2)，‖v‖ = ' + vlen([1, 2, 2]));
  },
  async (tok, S) => {
    const v = [1, 2, 2];
    cap('零向量確實送到 0', '向量變兩倍，長度也變兩倍');
    pane(S, 4, '‖0‖ = 0、‖2v‖ = ' + vlen(scl(v, 2)) + ' = 2‖v‖' + (vlen(scl(v, 2)) === 2 * vlen(v) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    const v = [1, 2, 2];
    cap('但乘上 −2：長度只是變兩倍', '不會乘上 −2 → 不是線性');
    pane(S, 5, '‖−2v‖ = ' + vlen(scl(v, -2)) + ' ≠ −2‖v‖ = ' + (-2 * vlen(v)) + (vlen(scl(v, -2)) !== -2 * vlen(v) ? '（✘ 不線性）' : ''), 'bad');
  },
]);

const R45 = rot2(45);
sc('lt-m-rot', 'MIT L30：例 旋轉 45°，整棟房子跟著轉', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false;
}, [
  async (tok, S) => { cap('一個「是」線性變換的例子', ''); },
  async (tok, S) => { cap('旋轉，轉 45°', '把整個平面送到整個平面'); pane(S, 0, 'T = 旋轉 45°'); },
  async (tok, S) => {
    const v = [2, 1];
    cap('輸入 v，輸出把 v 轉 45°', '一樣不需要座標');
    S.v = S.F.arrow(v, COL.g, 'v'); S.t = S.F.arrow(v, COL.r, 'T(v)');
    await anim(tok, 1400, (u) => S.F.set(S.t, mulMV(rot2(45 * u), v)));
  },
  async (tok, S) => {
    const v = [2, 1];
    cap('v 變兩倍，轉完也就兩倍遠', '');
    S.F.set(S.v, scl(v, 2)); S.v.tag('2v'); S.t.tag('T(2v)');
    await anim(tok, 1000, (u) => S.F.set(S.t, scl(mulMV(R45, v), 1 + u)));
    ok(eqv(mulMV(R45, scl(v, 2)), scl(mulMV(R45, v), 2)), 'T(2v) = 2T(v) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    const v = [2, 1], w = [-1, 1];
    cap('v + w：先各自轉再加 = 先加再轉', '');
    S.F.set(S.v, v); S.v.tag('v'); S.F.set(S.t, mulMV(R45, v)); S.t.tag('T(v)');
    S.F.arrow(w, COL.c, 'w'); S.F.arrow(mulMV(R45, w), COL.b, 'T(w)', mulMV(R45, v));
    S.F.arrow(mulMV(R45, addv(v, w)), COL.d, 'T(v + w)');
    ok(eqv(mulMV(R45, addv(v, w)), addv(mulMV(R45, v), mulMV(R45, w))), 'T(v + w) = T(v) + T(w) ✓', 3.0, 0.5, -3.7);
  },
  async (tok, S) => {
    cap('課本 7.1 節（和封面）有個圖：', '線性變換作用在一棟房子上');
    S.clear = lab.world.children.length;
  },
  async (tok, S) => {
    cap('在 R² 裡畫一棟小房子', '房子外框 = 一大堆點（向量）');
    lab.clear(); fresh(CAMF[0], CAMF[1]);
    const S2 = {}; plane(S2, { basis: false }); Object.assign(S, S2);
    S.H = house(S.F); S.hooks.push((N) => S.H.setM(N));
  },
  async (tok, S) => { cap('一次看它對所有點做了什麼', '不必一個向量一個向量看'); S.H.rs.forEach((r) => glow(r, GOLD)); },
  async (tok, S) => {
    cap('整棟房子跟著轉 45°', '');
    S.H.rs.forEach((r) => glow(r, null));
    await S.go(tok, R45, 2000);
  },
]);

const MFL = [[1, 0], [0, -1]];
sc('lt-m-matA', 'MIT L30：例三 T(v) = Av；A = [1 0; 0 −1] 把房子上下翻', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false;
}, [
  async (tok, S) => { cap('例三（很重要）：來自一個矩陣 A', ''); },
  async (tok, S) => { cap('變換就是「乘上 A」', '每個矩陣都產生一個線性變換'); pane(S, 0, 'T(v) = A v'); },
  async (tok, S) => {
    const A = [[2, -1], [3, 0.5]], v = [1, 2], w = [-3, 1], c = 4;
    cap('它是線性的：A(v + w) = Av + Aw', 'A(cv) = c(Av)');
    ok(eqv(mulMV(A, addv(v, w)), addv(mulMV(A, v), mulMV(A, w))) && eqv(mulMV(A, scl(v, c)), scl(mulMV(A, v), c)), 'A(v + w) = Av + Aw、A(cv) = cAv ✓（隨意的 A 驗證）', 2.6, 0.5, -4.3);
  },
  async (tok, S) => { cap('整個平面都被矩陣乘法變換', '平面上每個向量都乘上 A'); S.G.visible = true; },
  async (tok, S) => { cap('如果 A 是旋轉矩陣，圖就是旋轉', '如果是投影矩陣，圖就是投影'); },
  async (tok, S) => {
    cap('換一個矩陣：A = [1 0; 0 −1]', '房子（所有向量）會怎樣？');
    pane(S, 1, 'A = ' + ms(MFL));
    S.H = house(S.F); S.hooks.push((N) => S.H.setM(N));
  },
  async (tok, S) => { cap('A 是對角矩陣：很簡單', 'x 分量不變，y 分量變號'); },
  async (tok, S) => {
    const tip = [0.8, 2], to = mulMV(MFL, tip);
    cap('屋頂尖端：x 不變、y 變號', '跑到下面');
    S.tp = dotBall(COL.r, 0.14); await anim(tok, 1400, (u) => S.tp.position.copy(S.F.w(lerpM([tip], [to], u)[0], 0.14)));
    S.lt = S.lbl(vs(tip) + ' → ' + vs(to), to, 'ptr');
  },
  async (tok, S) => { cap('結果：房子上下顛倒', '門也倒過來了'); await S.go(tok, MFL, 2000); },
  async (tok, S) => { cap('線性變換就像是矩陣乘法的抽象描述', ''); },
  async (tok, S) => { cap('目標：找出每個線性變換背後的矩陣', '為此要引入座標，也就是選基底'); pane(S, 2, '下一步：選基底 → 座標 → 矩陣'); },
]);

const MT = [[1, 2, 0], [0, 1, 1]];   // 示意的 2×3 矩陣
sc('lt-m-r3r2', 'MIT L30：T 從 R³ 到 R²，需要 2×3 矩陣', async (tok, S) => {
  fresh([0, 0, 0], [0, 2.8, 0]); cam(14, 16, 12, [0, 2.8, 0]);
  S.Sp = space3(-2.8, 2.8, 0, 0.75, 2.0, ['x', 'y', 'z'], '輸入 R³');
  S.W = panel2(3.6, 2.8, 0.55, 3, '輸出 R²');
}, [
  async (tok, S) => { cap('從現在起 T 都代表線性變換', '非線性的不管'); },
  async (tok, S) => {
    cap('假設輸入是 R³ 的向量', '');
    S.ar = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, j) => S.Sp.arrow(e, [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j]));
  },
  async (tok, S) => { cap('輸出是 R² 的向量', ''); setCls(S.W.title, 'ptr alt'); },
  async (tok, S) => { cap('例子：任何「大小對」的矩陣都可以', 'T(v) = Av 一定是線性的'); },
  async (tok, S) => { cap('A 要什麼形狀？', 'v 要有 3 個分量（輸入在 R³）'); S.q = hot('A 是 ? × ?', 0.4, 6.4); },
  async (tok, S) => {
    cap('2×3 矩陣：乘 R³ 的向量，輸出在 R²', '例（示意）');
    txt(S.q, 'A 是 2 × 3'); S.P = code(MT.map((r) => '[ ' + r.map((x) => fmt(x).padStart(2)).join(' ') + ' ]'), 0.4, 5.6);
    S.o = [0, 1, 2].map((j) => S.W.arrow(colOf(MT, j), [COL.d, COL.r, COL.a][j], ['î', 'ĵ', 'k̂'][j] + ' → ' + vs(colOf(MT, j))));
    ok(MT.length === 2 && MT[0].length === 3 && mulMV(MT, [1, 1, 1]).length === 2, '(2×3)·(R³ 向量) = R² 向量 ✓', 0.4, 4.4);
  },
  async (tok, S) => { cap('每個 2×3 矩陣都給一個例子', '反過來：每個線性變換都對應一個矩陣'); },
]);

const TI = [[1, -0.5], [0.5, 1]];   // 示意：老師心中的某個線性變換
const IV1 = [2, 1], IV2 = [-1, 1];
sc('lt-m-info', 'MIT L30：只要知道 T 對一組基底做了什麼', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false;
}, [
  async (tok, S) => {
    cap('如果我只告訴你 T 對一個向量 v₁ 做了什麼', '（示意的 T）');
    S.F.arrow(IV1, COL.c, 'v₁'); S.F.arrow(mulMV(TI, IV1), COL.c, 'T(v₁)').glow(GOLD);
  },
  async (tok, S) => { cap('只知道一個向量不夠', '再告訴你 v₂ 的結果'); S.F.arrow(IV2, COL.b, 'v₂'); S.F.arrow(mulMV(TI, IV2), COL.b, 'T(v₂)').glow(GOLD); },
  async (tok, S) => {
    const c = [1, 1.5], v = lin(c, [IV1, IV2]), tv = lin(c, [mulMV(TI, IV1), mulMV(TI, IV2)]);
    cap('其實你知道的更多：所有線性組合都知道了', '例：v = v₁ + 1.5v₂');
    S.F.arrow(v, COL.g, 'v'); S.F.arrow(tv, COL.r, 'T(v)');
    ok(eqv(tv, mulMV(TI, v)), 'T(v₁ + 1.5v₂) = T(v₁) + 1.5T(v₂) ✓', 3.0, 0.5, -4.3);
  },
  async (tok, S) => {
    cap('前提：v₁、v₂ 獨立', '如果 v₂ = 6v₁，T(v₂) 就沒有新資訊');
    ok(eqv(mulMV(TI, scl(IV1, 6)), scl(mulMV(TI, IV1), 6)), 'v₂ = 6v₁ ⇒ T(v₂) = 6T(v₁) ✓', 3.0, 0.5, -3.7);
  },
  async (tok, S) => { cap('知道 T 對基底中每個向量做了什麼', '就知道 T 的一切'); pane(S, 0, '需要的資訊：T(v₁), …, T(vₙ)'); },
  async (tok, S) => { cap('因為每個 v 都是基底的組合', ''); pane(S, 1, 'v = c₁v₁ + … + cₙvₙ'); },
  async (tok, S) => { cap('由線性：T(v) 只能是這個', '沒有別的選擇'); pane(S, 2, 'T(v) = c₁T(v₁) + … + cₙT(vₙ)', 'good'); },
]);

const CB = [[1, 1, 0], [0, 1, 1], [1, 0, 1]];   // 示意的另一組基底 b₁, b₂, b₃
const CVV = [3, 2, 4], CBc = mulMV(inv(fromCols(...CB)), CVV);
sc('lt-m-coords', 'MIT L30：座標來自基底', async (tok, S) => {
  fresh([0, 0, 0], LOOK3); cam(30, 20, 10.5, LOOK3);
  S.Sp = space3(0, 1.6, 0, 0.6, 3.0, ['x', 'y', 'z']);
}, [
  async (tok, S) => { cap('從不需要座標的線性變換', '要怎麼走到矩陣？'); },
  async (tok, S) => { cap('矩陣來自座標系統', ''); },
  async (tok, S) => { cap('選定一組基底，座標就有了', ''); },
  async (tok, S) => { cap('v 寫成基底的組合，方法唯一', '組合裡用的那些數字 = 座標'); },
  async (tok, S) => { cap('換基底，座標就跟著換', ''); },
  async (tok, S) => {
    cap('我們一直假設用標準基底', '例：v = (3, 2, 4)');
    S.v = S.Sp.arrow(CVV, COL.g, 'v = (3, 2, 4)');
    S.e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, j) => S.Sp.arrow(e, [COL.d, COL.r, COL.a][j], ''));
  },
  async (tok, S) => {
    cap('意思是 3 倍第一個座標向量 + 2 倍第二個 + 4 倍第三個', '');
    S.p = [S.Sp.arrow([3, 0, 0], COL.d, ''), S.Sp.arrow([0, 2, 0], COL.r, ''), S.Sp.arrow([0, 0, 4], COL.a, '')];
    S.Sp.set(S.p[1], [0, 2, 0], [3, 0, 0]); S.Sp.set(S.p[2], [0, 0, 4], [3, 2, 0]);
  },
  async (tok, S) => {
    cap('但你不能這樣斷定：我可能用別的基底', '例（示意）：b₁ = (1, 1, 0)、b₂ = (0, 1, 1)、b₃ = (1, 0, 1)');
    gone(S.p, S.e);
    S.b = CB.map((b, j) => S.Sp.arrow(b, [COL.c, COL.b, COL.d][j], 'b' + '₁₂₃'[j]));
  },
  async (tok, S) => {
    cap('（例如某個矩陣的特徵向量）', '同一個 v，座標變成 (1/2, 3/2, 5/2)');
    const parts = CB.map((b, j) => scl(b, CBc[j]));
    let from = [0, 0, 0];
    parts.forEach((p, j) => { const a = S.Sp.arrow([0, 0, 0.001], [COL.c, COL.b, COL.d][j], ''); S.Sp.set(a, p, from); from = addv(from, p); });
    ok(eqv(CBc, [1 / 2, 3 / 2, 5 / 2]) && eqv(lin(CBc, CB), CVV), '新座標 ' + vs(CBc) + ' ✓', -4.4, 6.2);
  },
  async (tok, S) => { cap('座標 = 每個基底向量用了多少', ''); },
]);

sc('lt-m-twobases', 'MIT L30：建矩陣要兩組基底（輸入、輸出）', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('現在要建立代表 T 的矩陣 A', ''); hot('線性變換 T　→　矩陣 A', 0, 6.6); },
  async (tok, S) => {
    cap('T 可以是投影、旋轉、或任何線性變換', '一般是從 n 維空間送到 m 維空間');
    hd('T：Rⁿ → Rᵐ', 0, 5.9);
  },
  async (tok, S) => {
    cap('其實需要兩組基底', '輸入一組、輸出一組');
    S.in = cube('輸入 Rⁿ', COL.a, [2.4, 1.2, 0.6], -4.0, 3.9, 0); S.out = cube('輸出 Rᵐ', COL.b, [2.4, 1.2, 0.6], 4.0, 3.9, 0);
  },
  async (tok, S) => { cap('輸入的基底：v₁, …, vₙ', ''); sm('基底 v₁, …, vₙ', -4.0, 2.9); },
  async (tok, S) => { cap('輸出的基底：w₁, …, wₘ', ''); sm('基底 w₁, …, wₘ', 4.0, 2.9); },
  async (tok, S) => {
    cap('取一個向量 v，用輸入基底寫出它的座標 c', '');
    kArrow(V3(-4.0, 2.5, 0), V3(-4.0, 1.4, 0)); hd('座標 c = (c₁, …, cₙ)', -4.0, 1.0);
  },
  async (tok, S) => {
    cap('乘上正確的矩陣 A', '得到輸出（用輸出基底寫）的座標');
    S.A = cube('A', COL.r, [0.9, 0.9, 0.5], 0, 1.0, 0);
    kArrow(V3(-1.8, 1.0, 0), V3(-0.55, 1.0, 0)); kArrow(V3(0.55, 1.0, 0), V3(1.8, 1.0, 0));
    hd('A c = T(v) 的座標', 4.0, 1.0);
  },
]);

const S45 = Math.SQRT1_2, U1 = [S45, S45], U2 = [-S45, S45];
const P45 = prj([1, 1]), PM = fromCols(P45([1, 0]), P45([0, 1]));
function projStage45(S, basis) {
  plane(S, { basis, s: 1.05, B: 3.6, n: 5 }); S.G.visible = false;
  S.ln = rod(COL.k, 0.03); S.ln.setW(S.F.w([-3.4, -3.4], 0.1), S.F.w([3.4, 3.4], 0.1)); S.ln.visible = false;
}
sc('lt-m-projgood', 'MIT L30：投影用「好基底」——矩陣是對角的 [1 0; 0 0]', async (tok, S) => {
  projStage45(S, false);
}, [
  async (tok, S) => { cap('回到投影的例子', 'n = m = 2：平面送到平面'); },
  async (tok, S) => { cap('這是我們要投影上去的那條線', '（45° 線）'); S.ln.visible = true; },
  async (tok, S) => { cap('選一組比標準基底更喜歡的基底', '輸入、輸出用同一組'); },
  async (tok, S) => { cap('第一個基底向量：在線上的單位向量', ''); S.a1 = S.F.arrow(U1, COL.c, 'v₁'); },
  async (tok, S) => { cap('第二個基底向量：垂直那條線的單位向量', ''); S.a2 = S.F.arrow(U2, COL.b, 'v₂'); },
  async (tok, S) => { cap('輸出也用這組基底', ''); pane(S, 0, '輸入基底 = 輸出基底 = {v₁, v₂}'); },
  async (tok, S) => {
    cap('輸入 v₁，輸出是什麼？還是 v₁', '投影不動它');
    S.a1.glow(GOLD); ok(eqv(P45(U1), U1), 'T(v₁) = v₁ ✓', 2.4, 0.5, -3.4);
  },
  async (tok, S) => {
    cap('輸入 v₂ 呢？被殺掉，送到 0', '');
    S.t2 = S.F.arrow(U2, COL.b); await anim(tok, 1200, (u) => S.F.set(S.t2, scl(U2, 1 - u)));
    ok(eqv(P45(U2), [0, 0]), 'T(v₂) = 0 ✓', 2.4, 0.5, -2.8);
  },
  async (tok, S) => {
    const c = [1.5, 1], v = lin(c, [U1, U2]);
    cap('組合 c₁v₁ + c₂v₂：v₂ 的部分被殺掉，v₁ 的部分留下', '例（示意）1.5v₁ + 1·v₂');
    S.v = S.F.arrow(v, COL.g, 'v'); S.F.arrow(P45(v), COL.r, 'T(v) = 1.5v₁'); rod(COL.gray, 0.02).setW(S.F.w(v, 0.11), S.F.w(P45(v), 0.11));
    ok(eqv(P45(v), scl(U1, 1.5)), 'T(1.5v₁ + v₂) = 1.5v₁ ✓', 2.4, 0.5, -2.2);
  },
  async (tok, S) => { cap('所以要找的矩陣：輸入座標 (c₁, c₂)', '→ 輸出座標 (c₁, 0)'); pane(S, 1, '(c₁, c₂) → (c₁, 0)'); },
  async (tok, S) => {
    const Bi = inv(fromCols(U1, U2)), A = fromCols(mulMV(Bi, P45(U1)), mulMV(Bi, P45(U2)));
    cap('矩陣 A = [1 0; 0 0]', 'A 乘輸入座標，得到正確的輸出座標');
    pane(S, 2, 'A = ' + ms(A) + (eqv(A, [[1, 0], [0, 0]]) && eqv(mulMV(A, [1.5, 1]), [1.5, 0]) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => { cap('這組基底其實是投影的特徵向量', '結果矩陣是對角的 = Λ'); pane(S, 3, '特徵向量基底 → 對角矩陣 Λ'); },
  async (tok, S) => {
    cap('特徵值是 1 和 0', '那就是我們得到的矩陣');
    ok(eqv(P45(U1), scl(U1, 1)) && eqv(P45(U2), scl(U2, 0)), 'λ₁ = 1、λ₂ = 0 ✓', 2.4, 0.5, -1.6);
  },
]);

sc('lt-m-projstd', 'MIT L30：同一個投影用標準基底——P = [½ ½; ½ ½]', async (tok, S) => {
  projStage45(S, true); S.ai.tag('v₁ = î'); S.aj.tag('v₂ = ĵ'); hide(S.ai, S.aj);
}, [
  async (tok, S) => { cap('如果用標準基底做同一個投影呢？', '也做得到'); },
  async (tok, S) => { cap('一樣投影到 45° 線', ''); S.ln.visible = true; },
  async (tok, S) => {
    cap('標準基底：v₁ = (1, 0)、v₂ = (0, 1)', '輸出也用同一組');
    S.F.set(S.ai, [1, 0]); S.F.set(S.aj, [0, 1]);
  },
  async (tok, S) => { cap('就是第四章的投影矩陣公式', 'P = aaᵀ / (aᵀa)，a = (1, 1)'); pane(S, 0, 'P = a aᵀ / (aᵀa)，a = (1, 1)'); },
  async (tok, S) => {
    const a = [1, 1], F = [[a[0] * a[0], a[0] * a[1]], [a[1] * a[0], a[1] * a[1]]].map((r) => r.map((x) => x / dot(a, a)));
    cap('算出來 = [½ ½; ½ ½]', '');
    pane(S, 1, 'P = ' + ms(F) + (eqv(F, [[0.5, 0.5], [0.5, 0.5]]) && eqv(F, PM) ? ' ✓' : ' ✘'), 'good');
  },
  async (tok, S) => {
    cap('輸入 (1, 0)，輸出 (½, ½)', '正是正確的投影');
    S.t1 = S.F.arrow([1, 0], COL.d); await anim(tok, 1200, (u) => S.F.set(S.t1, lerpM([[1, 0]], [P45([1, 0])], u)[0]));
    S.t1.tag('T(1, 0) = ' + vs(mulMV(PM, [1, 0])));
  },
  async (tok, S) => {
    cap('輸入 (0, 1)，輸出也是 (½, ½)', '');
    S.t2 = S.F.arrow([0, 1], COL.r); await anim(tok, 1200, (u) => S.F.set(S.t2, lerpM([[0, 1]], [P45([0, 1])], u)[0]));
    ok(eqv(mulMV(PM, [0, 1]), [0.5, 0.5]), 'T(0, 1) = (1/2, 1/2) ✓', 2.4, 0.5, -3.4);
  },
  async (tok, S) => { cap('矩陣對，但當然不是對角的', '因為選的是最順手、不是最好的基底'); },
  async (tok, S) => {
    cap('它也不錯：對稱，而且 P² = P', '但在最好的基底裡這些都一眼看出來');
    ok(eqv(PM, T(PM)) && eqv(mm(PM, PM), PM), 'Pᵀ = P、P² = P ✓', 2.4, 0.5, -2.8);
  },
]);

const GA = [['a₁₁', 'a₁₂', '…'], ['a₂₁', 'a₂₂', '…'], ['⋮', '⋮', ''], ['aₘ₁', 'aₘ₂', '…']];
sc('lt-m-rule', 'MIT L30：找矩陣的規則——第 j 行 = T(vⱼ) 用輸出基底的係數', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
  S.g = mgrid(GA.map((r) => r.map(() => '')), -5.4, 5.6, 0, { widths: [0.8, 0.8, 0.8], color: () => '#e9dcc4' });
  hd('A =', -6.3, 4.4);
}, [
  async (tok, S) => { cap('把找矩陣 A 的規則寫下來', ''); },
  async (tok, S) => { cap('給定輸入基底 v₁…vₙ、輸出基底 w₁…wₘ', '沒有基底就沒辦法建矩陣'); hd('給定：v₁…vₙ（輸入）、w₁…wₘ（輸出）', 2.0, 6.6); },
  async (tok, S) => { cap('A 的第一行：看第一個基底向量 v₁ 發生什麼事', '把 T 作用在 v₁ 上'); S.g.col(0, GOLD); },
  async (tok, S) => {
    cap('T(v₁) 在輸出空間：是 w 們的組合', '組合的係數就放進第一行');
    mono(hd('T(v₁) = a₁₁w₁ + a₂₁w₂ + … + aₘ₁wₘ', 2.0, 5.6));
    GA.forEach((r, i) => S.g.set(i, 0, r[0]));
  },
  async (tok, S) => {
    cap('第二行：取 v₂，作用 T，用輸出基底展開', '係數放進第二行');
    S.g.clearGlow(); S.g.col(1, GOLD);
    mono(hd('T(v₂) = a₁₂w₁ + a₂₂w₂ + … + aₘ₂wₘ', 2.0, 4.9));
    GA.forEach((r, i) => S.g.set(i, 1, r[1]));
  },
  async (tok, S) => { cap('依此類推，就得到整個矩陣', ''); S.g.clearGlow(); GA.forEach((r, i) => S.g.set(i, 2, r[2])); },
  async (tok, S) => { cap('照矩陣乘法的規則：', 'A ×（輸入座標）就正確地得到（輸出座標）'); hot('A ·（輸入座標）=（輸出座標）', 2.0, 3.9); },
  async (tok, S) => {
    const A = [[2, -1, 0], [1, 3, 5]];   // 示意的數字矩陣
    cap('檢查第一行：輸入座標 (1, 0, …, 0) 就是 v₁', 'A 乘它 = A 的第一行 = T(v₁) 的輸出座標');
    S.g.col(0, GOLD);
    ok(eqv(mulMV(A, [1, 0, 0]), colOf(A, 0)), 'A·(1, 0, 0) = A 的第 1 行 ✓（示意數字驗證）', 2.0, 3.1);
  },
  async (tok, S) => { cap('每個基底向量都對了', '由線性，每個向量都對'); S.g.clearGlow(); },
]);

const DM = [[0, 1, 0], [0, 0, 2]], DP3 = [3, 5, 4];   // 微分矩陣；示意多項式 3 + 5x + 4x²
const dpoly = (c) => c.slice(1).map((x, k) => (k + 1) * x);
sc('lt-m-deriv', 'MIT L30：微分是線性變換——矩陣 [0 1 0; 0 0 2]', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('另一個不同的線性變換：取導數', '微分是線性的'); hot('T = d/dx', 0, 6.6); },
  async (tok, S) => {
    cap('輸入空間：所有 c₁ + c₂x + c₃x²', '基底是這幾個簡單的函數 1、x、x²');
    ['1', 'x', 'x²'].forEach((t, i) => cube(t, COL.a, [0.9, 0.8, 0.4], -5.2 + i * 1.1, 5.4, 0));
    mono(hd('輸入：c₁ + c₂x + c₃x²', -4.1, 4.5));
  },
  async (tok, S) => { cap('輸出就是導數', 'c₂ + 2c₃x'); mono(hd('輸出：c₂ + 2c₃x', 3.4, 4.5)); },
  async (tok, S) => { cap('輸出基底取 1、x', ''); ['1', 'x'].forEach((t, i) => cube(t, COL.b, [0.9, 0.8, 0.4], 2.9 + i * 1.1, 5.4, 0)); },
  async (tok, S) => { cap('從 3 維的輸入空間', '到 2 維的輸出空間'); hd('3 維 → 2 維', 0, 5.4); },
  async (tok, S) => { cap('如果微分不是線性的，求導數會沒完沒了', '學會幾個函數的導數，所有組合都能算'); },
  async (tok, S) => { cap('矩陣是什麼？', '要把輸入座標 (c₁, c₂, c₃) 變成輸出座標'); },
  async (tok, S) => { cap('應該是 2×3 矩陣', ''); S.g = mgrid([['', '', ''], ['', '', '']], -1.0, 3.2, 0, { color: () => COL.c }); hd('A =', -1.9, 2.8); },
  async (tok, S) => { cap('第一個輸出要是 c₂：0, 1, 0', ''); DM[0].forEach((x, j) => S.g.set(0, j, x)); S.g.row(0, GOLD); },
  async (tok, S) => { cap('第二個要是 2c₃：0, 0, 2', ''); S.g.clearGlow(); DM[1].forEach((x, j) => S.g.set(1, j, x)); S.g.row(1, GOLD); },
  async (tok, S) => {
    const r = mulMV(DM, DP3), d = dpoly(DP3);
    cap('這就是這組基底下「微分」的矩陣', '例（示意）3 + 5x + 4x²');
    S.g.clearGlow();
    ok(eqv(r, d) && eqv(r, [5, 8]), 'A·(3, 5, 4) = ' + vs(r) + ' → 5 + 8x = (3 + 5x + 4x²)′ ✓', 1.6, 1.4);
  },
  async (tok, S) => {
    cap('重點：反矩陣對應反變換', '矩陣相乘對應變換的合成——矩陣乘法就是從這裡來的');
  },
]);

// ═══════════════════════ MIT 18.06 L31：Change of Basis; Image Compression ═══════════════════════
const SUB = (n) => String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const grayHex = (g) => { const h = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0'); return '#' + h + h + h; };
sc('lt-g-pixels', 'MIT L31：一張圖 = 很長的向量（512² 個像素）', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('壓縮是什麼意思？', '先想一張靜止的圖'); },
  async (tok, S) => {
    cap('一張黑白圖片', '');
    S.px = []; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const g = 70 + 14 * i + 9 * j; const c = cube('', grayHex(g), [0.42, 0.42, 0.2], -5.6 + j * 0.5, 6.3 - i * 0.5, 0); c.g = g; S.px.push(c); }
    note('示意：8×8（實際是 512×512）', -3.85, 2.2);
  },
  async (tok, S) => { cap('有些壓縮完全不失真（lossless）', '利用資料裡的重複'); },
  async (tok, S) => { cap('這裡講的是會失真的壓縮（lossy）', ''); },
  async (tok, S) => {
    cap('圖由很多小像素組成，例如 512 × 512', '= 2⁹ × 2⁹');
    ok(512 === 2 ** 9, '512 = 2⁹ ✓', 2.6, 6.2);
  },
  async (tok, S) => { cap('這是第 (1, 1) 個像素', ''); glow(S.px[0], GOLD); },
  async (tok, S) => {
    cap('黑白圖：每個像素是一個灰階值', '從 0 到 255');
    relabel(S.px[0], S.px[0].g); hd('像素值 xᵢ ∈ [0, 255]', 2.6, 5.5);
  },
  async (tok, S) => { cap('2⁸ 種可能 → 8 個 bit', ''); ok(256 === 2 ** 8, '256 = 2⁸ → 8 bits ✓', 2.6, 4.8); },
  async (tok, S) => {
    cap('整張圖是 Rⁿ 裡的一個向量 x', 'n = 512²：問題就在這裡');
    ok(512 * 512 === 262144, 'n = 512² = ' + 512 * 512 + ' ✓', 2.6, 4.1);
  },
  async (tok, S) => {
    cap('彩色圖每個像素要 3 個數', '長度變 3 倍');
    ok(3 * 512 * 512 === 786432, '彩色：3 × 512² = ' + 3 * 512 * 512 + ' ✓', 2.6, 3.4);
  },
  async (tok, S) => { cap('資訊量巨大，不壓縮根本送不出去', ''); bad('不壓縮 → 系統塞爆', 2.6, 2.7); },
  async (tok, S) => { cap('標準的壓縮方法：JPEG', 'Joint Photographic Experts Group'); hot('JPEG', 2.6, 2.0); },
]);

const PX8 = [121, 124, 123, 122, 40, 42, 41, 43];   // 示意：藍襯衫四格、領帶四格
sc('lt-g-basis', 'MIT L31：換個更好的基底——全 1、正負交錯、半正半負', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('JPEG 在做的，就是換基底', ''); hot('壓縮 = 換基底', 0, 6.7); },
  async (tok, S) => {
    cap('現在的「標準基底」：每個像素給一個值', '例（示意）一列 8 個像素');
    S.b = bar8(PX8, -4.2, 3.2, { k: 0.012, gap: 0.42, w: 0.3 }); hd('標準基底的座標 = 像素值', -2.7, 5.4);
  },
  async (tok, S) => {
    cap('相鄰像素很接近（同一件藍襯衫）', '領帶開始才變；這種相關性讓壓縮成為可能');
    S.b.color(COL.a); [4, 5, 6, 7].forEach((i) => S.b.color(COL.r, i));
  },
  async (tok, S) => {
    cap('上課前空白的黑板：每個像素幾乎一樣', '');
    S.b.color(COL.k); const a = PX8.slice();
    await anim(tok, 1400, (u) => S.b.set(a.map((x) => x + (180 - x) * u)));
  },
  async (tok, S) => { cap('這種圖，標準基底很糟', '一個灰色要寫 8 次'); bad('標準基底：8 個數都要送', 3.6, 5.6); },
  async (tok, S) => {
    cap('很希望基底裡有「全部是 1」的向量', '');
    S.w1 = bar8([1, 1, 1, 1, 1, 1, 1, 1], -5.8, 1.0, { k: 0.45, gap: 0.3, color: COL.d }); sm('(1, 1, …, 1)', -4.75, 0.2);
  },
  async (tok, S) => {
    cap('只用這一個向量，就能描述整張純色的圖', '');
    ok(eqv(scl([1, 1, 1, 1, 1, 1, 1, 1], 180), S.b.vals.map((x) => Math.round(x))), '黑板 = 180 ·(1, …, 1) ✓', 3.6, 4.9);
  },
  async (tok, S) => {
    cap('極端的另一個：1, −1, 1, −1, …', '像棋盤，整張棋盤圖只要它');
    S.w2 = bar8([1, -1, 1, -1, 1, -1, 1, -1], -2.4, 1.0, { k: 0.45, gap: 0.3, color: COL.r }); sm('(1, −1, 1, −1, …)', -1.35, 0.2);
  },
  async (tok, S) => {
    cap('更常見：半張暗、半張亮', '→ 一半 1、一半 −1');
    S.w3 = bar8([1, 1, 1, 1, -1, -1, -1, -1], 1.0, 1.0, { k: 0.45, gap: 0.3, color: COL.c }); sm('(1,1,1,1,−1,−1,−1,−1)', 2.05, 0.2);
  },
  async (tok, S) => { cap('基底可以自由選', '選哪一組是價值數十億的決定'); },
]);

const X8 = [121, 124, 126, 127, 127, 125, 122, 120];   // 示意：平滑的一列像素
const DCT = Array.from({ length: 8 }, (_, k) => Array.from({ length: 8 }, (_, n) => (k ? Math.sqrt(2 / 8) : Math.sqrt(1 / 8)) * Math.cos((Math.PI * (2 * n + 1) * k) / 16)));
const DC = mulMV(DCT, X8);
const KEEP = DC.map((c, i) => [Math.abs(c), i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((p) => p[1]);
const DCh = DC.map((c, i) => (KEEP.includes(i) ? c : 0));
const XH = mulMV(T(DCT), DCh);
const r1 = (x) => Math.round(x * 10) / 10;
sc('lt-g-jpeg', 'MIT L31：JPEG——換基底（不失真）→ 丟掉小係數（失真）', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('最有名的基底：Fourier 基底', 'JPEG 用的就是它'); hot('Fourier 基底（JPEG）', 0, 6.7); },
  async (tok, S) => {
    cap('它包含常數向量（全部是 1）', '電機的人叫它 DC 向量');
    S.one = bar8([1, 1, 1, 1, 1, 1, 1, 1], 3.0, 5.4, { k: 0.4, gap: 0.3, color: COL.d, noNum: true }); sm('DC = (1, …, 1)', 4.05, 4.9);
  },
  async (tok, S) => {
    cap('通常切成 8 × 8 的小塊', '');
    ok(512 / 8 === 64, '512 ÷ 8 = 64 → 每邊 64 塊 ✓', 4.0, 4.3);
  },
  async (tok, S) => { cap('每塊 64 個像素', '在這 64 維空間裡換基底'); },
  async (tok, S) => {
    cap('進來訊號 x → 換基底 → 係數 c', '64 個像素進、64 個係數出：不失真');
    S.x = bar8(X8, -5.8, 3.4, { k: 0.016, gap: 0.42, w: 0.3 }); hd('x（示意：一列 8 個像素）', -4.3, 5.9);
    S.c = bar8(DC.map(r1), -1.4, 2.0, { k: 0.007, gap: 0.42, w: 0.3, color: COL.c }); hd('係數 c（8 點 DCT，示意）', 0.1, 5.9);
    ok(eqv(mulMV(T(DCT), DC).map((v) => Math.round(v * 1e6) / 1e6), X8), '用 c 可以完全還原 x ✓', 0.1, 1.2);
  },
  async (tok, S) => { cap('接下來是壓縮步驟：會失真', '會丟掉資訊'); },
  async (tok, S) => {
    cap('最簡單：把小的係數丟掉', '叫做 thresholding（設門檻）');
    DC.forEach((c, i) => { if (!KEEP.includes(i)) S.c.color(COL.gray, i); });
  },
  async (tok, S) => {
    cap('得到 ĉ：很多 0', '');
    S.c.set(DCh.map(r1));
    sm('只留 ' + KEEP.length + ' 個', 0.1, 0.6);
  },
  async (tok, S) => {
    cap('全 1 向量的係數通常很大，很少丟', '快速交錯（高頻）的係數在平滑的圖裡很小');
    S.c.glow(GOLD, 0); S.c.glow(RED, 7);
    ok(Math.abs(DC[0]) > 10 * Math.max(...DC.slice(1).map(Math.abs)), 'c₀（DC）遠大於其他 ✓', 4.0, 3.6);
  },
  async (tok, S) => {
    const err = Math.max(...XH.map((v, i) => Math.abs(v - X8[i])));
    cap('用剩下的少數係數重建訊號', '不再是 64 項相加，只剩兩三項');
    S.xh = bar8(XH.map(r1), 3.0, 1.0, { k: 0.012, gap: 0.42, w: 0.3, color: COL.b }); hd('重建 x̂', 4.5, 2.9);
    ok(err < 1, '最大誤差 ' + r1(err) + ' 個灰階 ✓', 4.5, 0.4);
  },
  async (tok, S) => { cap('64 個係數只留 3 個', '壓縮比大約 21 : 1'); ok(Math.floor(64 / 3) === 21, '64 ÷ 3 ≈ ' + r1(64 / 3) + ' → 21 : 1 ✓', 4.0, 3.0); },
]);

const HW = [[1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, -1, -1, -1, -1], [1, 1, -1, -1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, -1, -1],
  [1, -1, 0, 0, 0, 0, 0, 0], [0, 0, 1, -1, 0, 0, 0, 0], [0, 0, 0, 0, 1, -1, 0, 0], [0, 0, 0, 0, 0, 0, 1, -1]];   // 8 個 Haar 小波（當列寫）
const WM = T(HW);                     // 行 = 小波
const P8 = [121, 124, 126, 127, 127, 125, 122, 120];   // 示意像素
const WC = mulMV(inv(WM), P8);
const wrow = (S, i) => { S.wr = S.wr || []; S.wr[i] = bar8(HW[i], -5.4, 6.4 - i * 0.68, { k: 0.24, gap: 0.27, w: 0.19, color: COL.c, noNum: true }); sm('w' + SUB(i + 1), -6.1, 6.4 - i * 0.68); };
sc('lt-g-wavelet', 'MIT L31：小波（wavelet）基底：8 個向量', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('Fourier 的競爭對手：小波（wavelets）', '看 8 × 8 情況（一列 8 個）的小波基底'); },
  async (tok, S) => { cap('第一個：8 個 1', ''); wrow(S, 0); },
  async (tok, S) => { cap('四個 1、四個 −1', ''); wrow(S, 1); },
  async (tok, S) => { cap('兩個 1、兩個 −1、四個 0', ''); wrow(S, 2); },
  async (tok, S) => { cap('四個 0、兩個 1、兩個 −1', ''); wrow(S, 3); },
  async (tok, S) => { cap('再來是 1, −1 加六個 0', '1, −1 依序搬到後面，再三個'); [4, 5, 6, 7].forEach((i) => wrow(S, i)); },
  async (tok, S) => {
    cap('這是 8 維空間裡的 8 個向量', '叫做 wavelets（最簡單的一種）');
    ok(rrefSteps(WM).rank === 8, 'rank = 8：真的是 R⁸ 的基底 ✓', 2.6, 6.6);
  },
  async (tok, S) => {
    cap('跟 Fourier 比：最快的那個 (1, −1, 1, −1, …)', '用小波怎麼組合出來？');
    S.f = bar8([1, -1, 1, -1, 1, -1, 1, -1], 1.6, 5.3, { k: 0.3, gap: 0.3, color: COL.r, noNum: true }); sm('Fourier 最快的向量', 2.65, 4.7);
  },
  async (tok, S) => {
    const s = lin([0, 0, 0, 0, 1, 1, 1, 1], HW);
    cap('就是最後四個小波相加', '');
    [4, 5, 6, 7].forEach((i) => S.wr[i].glow(GOLD));
    ok(eqv(s, [1, -1, 1, -1, 1, -1, 1, -1]), '= w₅ + w₆ + w₇ + w₈ ✓', 2.6, 4.1);
  },
  async (tok, S) => {
    cap('給一列 8 個像素值 p₁ … p₈', '這是它在標準基底的座標');
    [4, 5, 6, 7].forEach((i) => S.wr[i].glow(null));
    S.p = bar8(P8, 1.6, 1.4, { k: 0.012, gap: 0.3, w: 0.22, color: COL.a }); sm('p（示意）', 2.65, 0.8);
  },
  async (tok, S) => { cap('要把 p 寫成小波的組合', 'p = c₁w₁ + c₂w₂ + … + c₈w₈'); mono(hot('p = c₁w₁ + … + c₈w₈', 2.6, 3.3)); },
]);

const WN = HW.map((r) => scl(r, 1 / norm(r)));   // 正規化（當列）
sc('lt-g-wmatrix', 'MIT L31：c = W⁻¹p；好基底要「快」又要「少數幾項就夠」', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => { cap('寫成矩陣：p = 小波矩陣的行的組合', ''); },
  async (tok, S) => {
    cap('W 的 8 個行 = 8 個小波', 'p = W c');
    S.g = mgrid(WM, -6.3, 6.5, 0, { size: 0.38, gap: 0.45, color: (i, j) => (WM[i][j] > 0 ? COL.d : WM[i][j] < 0 ? COL.r : '#e9dcc4') });
    hd('W', -6.8, 4.9);
  },
  async (tok, S) => { cap('換基底 = 解方程式 p = W c', ''); mono(hd('p = W c', 2.4, 6.6)); },
  async (tok, S) => {
    cap('係數 c = W⁻¹ p', '');
    mono(hd('c = W⁻¹p = (' + WC.map(fmt).join(', ') + ')', 2.4, 6.0));
    ok(eqv(mulMV(WM, WC), P8), 'W c = p ✓（示意 p）', 2.4, 5.4);
  },
  async (tok, S) => { cap('關鍵：好的基底要有又好又快的反矩陣', ''); },
  async (tok, S) => { cap('第一個要求：快', 'Fourier 有 FFT，小波也有快速小波轉換'); hd('① 快：W、W⁻¹ 都要能快速相乘', 2.4, 4.7); },
  async (tok, S) => { cap('這些向量只有 1、−1、0', '用二進位乘很快'); },
  async (tok, S) => {
    const G = mm(HW, WM);
    cap('還有更棒的性質：它們互相正交', '任兩個做內積都是 0');
    ok(G.every((r, i) => r.every((x, j) => (i === j) || x === 0)), 'WᵀW 是對角矩陣 → 正交 ✓', 2.4, 4.1);
  },
  async (tok, S) => {
    const L = HW.map(norm);
    cap('但不是單位長度：除以長度就好', '長度分別是 √8、√4、√2');
    ok(Math.abs(L[0] - Math.sqrt(8)) < 1e-9 && L[1] === Math.sqrt(8) && L[2] === 2 && Math.abs(L[4] - Math.SQRT2) < 1e-9, '長度 √8, √8, 2, 2, √2 … ✓', 2.4, 3.5);
  },
  async (tok, S) => {
    const Wn = T(WN);
    cap('行正規正交 ⇒ 反矩陣 = 轉置', '第 4.4 節');
    ok(eqv(mm(T(Wn), Wn).map((r) => r.map((x) => Math.round(x * 1e9) / 1e9)), Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0)))), 'W⁻¹ = Wᵀ（正規化後）✓', 2.4, 2.9);
  },
  async (tok, S) => { cap('第二個要求：好不好用？', '最快的其實是根本不換基底'); hd('② 少數幾個基底向量就接近原圖', 2.4, 2.3); },
  async (tok, S) => {
    cap('留在標準基底、丟掉 90% 的像素', '圖就變黑了');
    S.std = bar8(P8.map((x, i) => (i === 0 ? x : 0)), -6.0, 0.6, { k: 0.008, gap: 0.42, w: 0.3, color: COL.gray });
    bad('標準基底只留 1 個 → 其餘全黑', -4.5, 1.9);
  },
  async (tok, S) => {
    const ch = WC.map((c, i) => (i < 4 ? c : 0)), ph = mulMV(WM, ch);
    const err = Math.max(...ph.map((x, i) => Math.abs(x - P8[i])));
    cap('小波基底：丟掉 c₅、c₆、c₇、c₈', '丟的只是很小的起伏');
    S.wv = bar8(ph, -1.6, 0.6, { k: 0.008, gap: 0.42, w: 0.3, color: COL.b });
    ok(err <= 1.5, '只留 c₁…c₄：最大誤差 ' + fmt(err) + ' 個灰階 ✓', -0.1, 1.9);
  },
  async (tok, S) => { cap('所以第二個要求：少數幾個基底向量', '就足以重現影像'); },
  async (tok, S) => { cap('JPEG-2000 會納入小波', 'FBI 用更平滑的小波（不是 1 跳到 −1）'); },
]);

sc('lt-g-cob', 'MIT L31：換基底 x = W c', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('回到數學：複習換基底', '（示意：2D 的例子）'); },
  async (tok, S) => { cap('同一個向量，從一組基底換到另一組', ''); S.x = S.F.arrow(JV, COL.g, 'x = (3, 2)（舊基底）'); },
  async (tok, S) => {
    cap('讓 W 的行 = 新的基底向量', '');
    S.F.arrow(JB1, COL.c, 'w₁'); S.F.arrow(JB2, COL.b, 'w₂'); pane(S, 0, 'W = [w₁ w₂] = ' + ms(JA));
  },
  async (tok, S) => { cap('換基底要用到 W⁻¹', ''); pane(S, 1, 'W⁻¹ = ' + ms(JAi)); },
  async (tok, S) => {
    const c = mulMV(JAi, JV);
    cap('舊基底的 x、新基底的 c：x = W c', '所以 c = W⁻¹x');
    pane(S, 2, 'c = W⁻¹x = ' + vs(c) + '；W c = ' + vs(mulMV(JA, c)) + (eqv(mulMV(JA, c), JV) ? ' ✓' : ' ✘'), 'good');
  },
]);

const GB = JA, GAm = R90, GBm = mm(inv(GB), mm(GAm, GB));
sc('lt-g-similar', 'MIT L31：同一個 T、兩組基底 → 相似矩陣 B = M⁻¹AM', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => { cap('最後的問題', ''); },
  async (tok, S) => { cap('有一個線性變換 T', '例（示意）：旋轉 90°'); await S.go(tok, GAm, 1800); },
  async (tok, S) => {
    cap('對第一組基底 v₁, v₂（這裡用標準基底）', 'T 的矩陣叫 A');
    pane(S, 0, 'A = ' + ms(GAm));
  },
  async (tok, S) => {
    const B = fromCols(...[0, 1].map((j) => mulMV(inv(GB), mulMV(GAm, colOf(GB, j)))));
    cap('對第二組基底 w₁ = (2, 1)、w₂ = (−1, 1)', 'T 的矩陣叫 B（T(wⱼ) 用 w 展開的係數）');
    S.ai.tag('î'); S.aj.tag('ĵ'); await S.go(tok, I2, 900);
    S.F.arrow(JB1, COL.c, 'w₁'); S.F.arrow(JB2, COL.b, 'w₂');
    pane(S, 1, 'B = ' + ms(B)); S.B = B;
  },
  async (tok, S) => { cap('A 和 B 有什麼關係？', 'T 是同一個'); },
  async (tok, S) => {
    cap('答案：A 和 B 相似（similar）', 'B = M⁻¹ A M');
    pane(S, 2, 'M⁻¹AM = ' + ms(GBm) + (eqv(GBm, S.B) ? ' = B ✓' : ' ✘'), 'good');
  },
  async (tok, S) => { cap('這個 M 就是換基底矩陣', 'M 的行 = 新基底（這裡 M = W）'); pane(S, 3, 'M = W = ' + ms(GB)); },
  async (tok, S) => {
    cap('換基底時兩件事一起發生：', '每個向量有新座標、每個變換有新（相似的）矩陣');
    ok(Math.abs(det2(GAm) - det2(GBm)) < 1e-9 && Math.abs(GAm[0][0] + GAm[1][1] - GBm[0][0] - GBm[1][1]) < 1e-9, '相似：det、trace 都一樣 ✓', 3.0, 0.5, -4.3);
  },
]);

function grid8(S, x0 = -2.2, y0 = 6.2) { S.g = mgrid(Array.from({ length: 8 }, () => Array(8).fill('')), x0, y0, 0, { size: 0.5, gap: 0.56, color: () => '#e9dcc4' }); hd('A =', x0 - 0.9, y0 - 2.0); }
sc('lt-g-recipe', 'MIT L31：T 的矩陣 A——第 j 行 = T(vⱼ) 用 v 展開的係數', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]); grid8(S);
}, [
  async (tok, S) => { cap('A 是什麼？用基底 v₁ … v₈', ''); },
  async (tok, S) => { cap('知道 T 對 8 個基底向量做什麼', '就完全知道 T'); },
  async (tok, S) => { cap('因為每個 x 都是基底的組合（唯一）', ''); mono(hd('x = c₁v₁ + … + c₈v₈', -4.6, 1.2)); },
  async (tok, S) => { cap('由線性：', 'T(x) = c₁T(v₁) + … + c₈T(v₈)'); mono(hd('T(x) = c₁T(v₁) + … + c₈T(v₈)', -4.6, 0.6)); },
  async (tok, S) => { cap('但這些輸出也要用這組基底寫', ''); },
  async (tok, S) => {
    cap('T(v₁) = a₁₁v₁ + a₂₁v₂ + … + a₈₁v₈', '這些數放進第一行');
    for (let i = 0; i < 8; i++) S.g.set(i, 0, 'a' + SUB(i + 1) + '₁'); S.g.col(0, GOLD);
  },
  async (tok, S) => {
    cap('T(v₂) 展開的係數放進第二行', '一行一行建出 A');
    S.g.clearGlow(); for (let i = 0; i < 8; i++) S.g.set(i, 1, 'a' + SUB(i + 1) + '₂'); S.g.col(1, GOLD);
  },
  async (tok, S) => {
    cap('食譜：對每個基底向量算 T、用基底展開', '得到 64 個數 = A');
    S.g.clearGlow(); for (let j = 2; j < 8; j++) for (let i = 0; i < 8; i++) S.g.set(i, j, '·');
    ok(8 * 8 === 64, '8 × 8 = 64 個數 ✓', 3.6, 1.2);
  },
]);

sc('lt-g-eigen', 'MIT L31：特徵向量基底 → 對角矩陣 Λ', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]); grid8(S);
}, [
  async (tok, S) => { cap('最好的例子：用特徵向量當基底', ''); },
  async (tok, S) => { cap('T(vᵢ) = λᵢ vᵢ', '輸出跟輸入同方向'); mono(hd('T(vᵢ) = λᵢvᵢ', -4.6, 1.2)); },
  async (tok, S) => { cap('A 是什麼？一起走一遍', ''); },
  async (tok, S) => { cap('第一個基底向量 v₁', 'T 作用後 = λ₁v₁'); S.g.col(0, GOLD); },
  async (tok, S) => {
    cap('λ₁v₁ 用基底寫：λ₁ 乘 v₁、其他都 0', '第一行 = (λ₁, 0, …, 0)');
    for (let i = 0; i < 8; i++) S.g.set(i, 0, i === 0 ? 'λ₁' : '0');
  },
  async (tok, S) => {
    cap('v₂ → λ₂v₂', '第二行 = (0, λ₂, 0, …, 0)');
    S.g.clearGlow(); S.g.col(1, GOLD); for (let i = 0; i < 8; i++) S.g.set(i, 1, i === 1 ? 'λ₂' : '0');
  },
  async (tok, S) => {
    cap('在特徵向量基底裡，矩陣是對角的', 'A = Λ');
    S.g.clearGlow(); for (let j = 2; j < 8; j++) for (let i = 0; i < 8; i++) S.g.set(i, j, i === j ? 'λ' + SUB(j + 1) : '0');
    const L = [[3, 0], [0, -1]], Vv = fromCols([1, 1], [1, -1]), A2 = mm(Vv, mm(L, inv(Vv)));
    ok(eqv(mm(inv(Vv), mm(A2, Vv)), L), '2×2 驗證：V⁻¹AV = Λ ✓（示意）', 3.6, 1.2);
  },
  async (tok, S) => { cap('完美的基底，但求像素矩陣的特徵向量太貴', '所以改用便宜又接近的：小波'); },
]);

// ═══════════════════════ 補上的教學段落：總結、開場的觀念、壓縮的應用 ═══════════════════════
// 叉積（BaM7OCEm3G0）總結：兩條路找到同一個 dual vector p
sc('lt-c-sum', '叉積總結：算法的 p ＝ 幾何的 p', async (tok, S) => {
  crossStage(S, 0.55, 40, 18);
}, [
  async (tok, S) => {
    cap('用 v、w 定義一個 3D → 數線的線性變換', 'T(x) = det[x v w]（示意 v = (2, 0, 1)、w = (0, 2, 1)）');
    S.L = [mono(hd('T(x) = det[ x  v  w ]：3D → 數線', -4.6, 2.0))];
  },
  async (tok, S) => {
    cap('它的 dual vector p：套用 T = 跟 p 做內積', 'T(x) = p · x');
    S.L.push(mono(hd('dual vector p：T(x) = p · x', -4.6, 1.0)));
  },
  async (tok, S) => {
    const p = cof1(CV, CW);
    cap('計算面：第 1 行放 î、ĵ、k̂，算行列式', '得到 p = (−2, −2, 4)');
    ok(eqv(p, CP) && eqv(p, [-2, -2, 4]), '算法：det[ î ĵ k̂ | v | w ] → p = (−2, −2, 4) ✓', -4.6, 0.0);
  },
  async (tok, S) => {
    cap('幾何面：p 垂直 v、w，長度 = 平行四邊形面積', '');
    S.pg = pgram(S.Sp, CV, CW, COL.g, 0.3);
    S.ap = S.Sp.arrow([0, 0, 0.001], COL.r, 'p'); await anim(tok, 1200, (t) => S.Sp.set(S.ap, scl(CP, 0.6 * Math.max(0.01, t))));
    S.ap.tag('p（畫成 0.6 倍）');
    ok(Math.abs(dot(CP, CV)) < 1e-9 && Math.abs(dot(CP, CW)) < 1e-9 && Math.abs(norm(CP) - pgArea(CV, CW)) < 1e-9, '幾何：p ⊥ v、w，|p| = 面積 = √24 ✓', -4.6, -1.0);
  },
  async (tok, S) => {
    cap('兩種方法找的是同一個變換的 dual vector', '所以一定是同一個向量');
    const x = [1.4, -1.2, 1.5];
    ok(Math.abs(fvol(x) - dot(CP, x)) < 1e-9, '同一個 p：p · x = det[x v w] ✓', -4.6, -2.0);
  },
]);

// 3B1B 第 3 集（kYB8IZa5AuE）總結：變換 ↔ 矩陣
const SUMA = [[1, -1], [0.5, 1]], SUMV = [1.5, 1];
sc('lt-k-sum', '總結：矩陣的行 = î、ĵ 的落點，矩陣 = 空間的變換', async (tok, S) => {
  plane(S);
}, [
  async (tok, S) => {
    cap('線性變換：格線保持平行、等距，原點不動', '示意 A = [1 −1; 0.5 1]');
    await S.go(tok, SUMA, 1800);
    pane(S, 0, '格線平行且等距、原點不動');
  },
  async (tok, S) => {
    cap('只要幾個數字就能描述它', '基底向量落在哪裡');
    S.ai.tag('î → (1, 0.5)'); S.aj.tag('ĵ → (−1, 1)');
    pane(S, 1, 'î → (1, 0.5)、ĵ → (−1, 1)');
  },
  async (tok, S) => {
    cap('矩陣的行就是這些座標', 'A = [1 −1; 0.5 1]');
    ok(eqv(colOf(SUMA, 0), [1, 0.5]) && eqv(colOf(SUMA, 1), [-1, 1]), 'A 的行 = î、ĵ 的落點 ✓', -5.0, 0.5, -3.3 + 2 * 0.62);
  },
  async (tok, S) => {
    const r = mulMV(SUMA, SUMV);
    cap('矩陣乘向量：算出變換把這個向量送到哪', 'A(1.5, 1) = 1.5·(1, 0.5) + 1·(−1, 1) = (0.5, 1.75)');
    S.track(SUMV, COL.g, 'Av');
    ok(eqv(r, [0.5, 1.75]), 'A(1.5, 1) = (0.5, 1.75) ✓', -5.0, 0.5, -3.3 + 3 * 0.62);
  },
  async (tok, S) => {
    const R = [[0, -1], [1, 0]];
    cap('每看到一個矩陣，都可以讀成空間的一個變換', '例：[0 −1; 1 0] = 逆時針轉 90°');
    S.ai.tag('î'); S.aj.tag('ĵ');
    await S.go(tok, I2, 1200); await S.go(tok, R, 1600);
    pane(S, 4, '[0 −1; 1 0]：整個平面轉 90°');
  },
]);

// MIT L30（Ts3o2I8_Mxc）開場：不用座標也能談線性變換；要計算才引入座標 → 矩陣
const TSA = [[1, -1], [0.5, 1]], TSV = [1.5, 1], TSW = [-1, 1.2];
sc('lt-m-intro', 'L30 開場：線性變換不需要座標；要計算才有矩陣', async (tok, S) => {
  plane(S, { basis: false }); S.G.visible = false; hide(S.axes);
}, [
  async (tok, S) => {
    cap('線性變換 T：吃一個向量、吐一個向量', '這裡先不畫座標（示意的 T）');
    S.v = S.F.arrow(TSV, COL.g, 'v'); S.tv = S.F.arrow(mulMV(TSA, TSV), COL.c, 'T(v)');
    pane(S, 0, 'T：向量 → 向量');
  },
  async (tok, S) => {
    cap('不需要矩陣、不需要數字也說得通', '只看整個空間怎麼動（物理學家喜歡這樣）');
    S.w = S.F.arrow(TSW, COL.b, 'w'); S.tw = S.F.arrow(mulMV(TSA, TSW), COL.r, 'T(w)');
    pane(S, 1, 'T(v + w) = T(v) + T(w)、T(cv) = cT(v)');
    ok(eqv(mulMV(TSA, [TSV[0] + TSW[0], TSV[1] + TSW[1]]), mulMV(TSA, TSV).map((x, i) => x + mulMV(TSA, TSW)[i])), '線性 ✓', -5.0, 0.5, -3.3 + 2 * 0.62);
  },
  async (tok, S) => {
    cap('要算東西，就引入座標（選基底）', '每個線性變換就對應一個矩陣 A');
    S.axes.forEach((o) => { o.visible = true; }); S.G.visible = true;
    gone(S.w, S.tw);
    await anim(tok, 1600, (u) => S.G.setM(lerpM(I2, TSA, u)));
    pane(S, 3, '有了座標：T(x) = Ax，A = [1 −1; 0.5 1]');
  },
  async (tok, S) => {
    cap('零空間、行列式、特徵值…都從矩陣算出來', '但背後的主角是線性變換');
    pane(S, 4, 'N(A)、C(A)、det、λ 都從 A 來；背後是 T', 'ptr alt');
  },
]);

// MIT L31（vGkn-3NFGck）：FBI 指紋要選基底；影片 = 預測 + 修正
const FP = [...Array(8).keys()].map((i) => [...Array(8).keys()].map((j) => (Math.round(Math.hypot(i - 3.5, j - 4) * 1.15) % 2)));
const vidFrame = (k) => [...Array(6).keys()].map((i) => [...Array(6).keys()].map((j) => (i === 0 ? (j % 2) : (i >= 2 && i <= 3 && (j === k || j === k + 1) ? 1 : 0))));
function pix(M, x0, y0, sz, on = COL.k, off = '#efe6d6') {
  return M.map((r, i) => r.map((v, j) => cube('', v > 0 ? on : v < 0 ? COL.r : off, [sz * 0.9, sz * 0.9, 0.14], x0 + j * sz, y0 - i * sz, 0)));
}
sc('lt-g-video', 'L31：FBI 指紋與影片壓縮——選基底、預測 + 修正', async (tok, S) => {
  fresh(CAMB[0], CAMB[1]);
}, [
  async (tok, S) => {
    cap('FBI 有幾千萬份指紋', '以前是紙本檔案，查一次要等一個星期');
    S.fp = pix(FP, -5.6, 4.4, 0.3); S.l1 = sm('指紋影像（示意）', -4.55, 4.95);
    S.ic = P.icon('🗄️', '3000 萬份指紋', -1.2, 3.4);
  },
  async (tok, S) => {
    cap('數位化之後每張還是太大', '要壓縮：FBI 必須決定用哪一組基底');
    S.n1 = sm('每張 512 × 512 像素：資訊量太大，沒辦法快速搜尋', 0, 1.4);
    S.n2 = note('壓縮 = 換一組好的基底（FBI 用的是 wavelet 類的基底）', 0, 0.7);
  },
  async (tok, S) => {
    cap('影片是一張接一張的影像', '一張一張各自壓縮不是最好的做法');
    gone(S.fp.flat(), S.l1, S.ic, S.n1, S.n2);
    S.F = [0, 1, 2, 3].map((k) => { const x0 = -6.2 + k * 2.3; sm('第 ' + (k + 1) + ' 張', x0 + 0.75, 4.95); return pix(vidFrame(k), x0, 4.4, 0.3, COL.a); });
    S.n3 = sm('影片 = 影像序列（示意：上排是黑板、中間是移動的老師）', -2.0, 2.0);
  },
  async (tok, S) => {
    cap('相鄰兩張影像高度相關', '幾乎一樣，只差一點點');
    const same = vidFrame(0).flat().filter((v, i) => v === vidFrame(1).flat()[i]).length;
    S.n4 = sm('第 1、2 張有 ' + same + ' / 36 格完全相同', -2.0, 1.3);
  },
  async (tok, S) => {
    cap('預測 + 修正：先假設下一張一樣', '只對「修正量」編碼、壓縮');
    const D = vidFrame(1).map((r, i) => r.map((v, j) => v - vidFrame(0)[i][j]));
    sm('修正量 = 第 2 張 − 第 1 張', 4.35, 4.95); pix(D, 3.6, 4.4, 0.3, COL.d);
    const nz = D.flat().filter((v) => v !== 0).length;
    ok(nz === 4, '只有 ' + nz + ' 格要記（其他 32 格是 0）✓', 2.0, 0.6);
  },
  async (tok, S) => {
    cap('壓縮永遠在利用相關性', '時間、空間上變化平滑 → 由前一個值預測下一個');
    hot('利用相關性：東西不會瞬間改變', 0, -0.1);
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
