// 線性代數 第8章：對稱矩陣與二次型（Spectral theorem、正交對角化、xᵀAx 曲面、正定判斷、主軸）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片（MIT 18.06 L25–L27）尚無逐字稿，所有場景以 Strang 例題建立（標題標「課本」）：
//   S = [1 2; 2 4]、[2 1; 1 2]、f = 2x² + 12xy + cy²（c = 20 / 18 / 7）、5x² + 8xy + 5y² = 1、[2 −1 0; −1 2 −1; 0 −1 2]。
export default function (ctx) {
  const { THREE, lab, $, log, clearLog, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用：數學 ─────────────────────────
  const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
  const add = (u, v) => u.map((x, i) => x + v[i]);
  const sub = (u, v) => u.map((x, i) => x - v[i]);
  const mul = (k, u) => u.map((x) => k * x);
  const norm = (u) => Math.sqrt(dot(u, u));
  const unit = (u) => mul(1 / norm(u), u);
  const lerpV = (u, v, t) => u.map((x, i) => x + (v[i] - x) * t);
  const mv = (M, u) => M.map((r) => dot(r, u));
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  function frac(x) {
    if (!isFinite(x)) return '?';
    if (Math.abs(x) < 1e-9) return '0';
    const s = x < 0 ? '−' : '', a = Math.abs(x);
    if (Math.abs(a - Math.round(a)) < 1e-9) return s + Math.round(a);
    for (let d = 2; d <= 60; d++) { const n = Math.round(a * d); if (Math.abs(n / d - a) < 1e-9) return s + n + '/' + d; }
    const sq = a * a;
    for (let d = 1; d <= 30; d++) {
      const n = Math.round(sq * d);
      if (n > 0 && n <= 600 && Math.abs(n / d - sq) < 1e-9) {
        const r = Math.round(Math.sqrt(n)), rd = Math.round(Math.sqrt(d));
        if (r * r === n) return s + r + '/√' + d;
        if (d === 1) return s + '√' + n;
        if (rd * rd === d) return s + '√' + n + '/' + rd;
      }
    }
    return s + a.toFixed(2);
  }
  const f2 = (x) => { const v = Math.round(x * 100) / 100; return (Math.abs(v) < 1e-9 ? '' : v < 0 ? '−' : '') + Math.abs(v); };
  const vs = (u, f = frac) => '(' + u.map(f).join(', ') + ')';
  const ms = (M, f = f2) => '[' + M.map((r) => r.map(f).join(' ')).join('; ') + ']';
  // symmetric eigen-decomposition (cyclic Jacobi): returns values (descending) and unit eigenvectors
  function symEig(S) {
    const n = S.length, A = S.map((r) => r.slice()), V = S.map((_, i) => S.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((i, j) => A[j][j] - A[i][i]);
    return { vals: idx.map((i) => A[i][i]), vecs: idx.map((i) => V.map((r) => r[i])) };
  }
  function pivots(S) {
    const n = S.length, A = S.map((r) => r.slice()), p = [];
    for (let k = 0; k < n; k++) {
      p.push(A[k][k]);
      if (Math.abs(A[k][k]) < 1e-12) { for (let r = k + 1; r < n; r++) p.push(NaN); return p.slice(0, n); }
      for (let i = k + 1; i < n; i++) { const l = A[i][k] / A[k][k]; for (let j = k; j < n; j++) A[i][j] -= l * A[k][j]; }
    }
    return p;
  }
  function det(M) { const n = M.length; if (n === 1) return M[0][0]; if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0]; return M[0].reduce((s, x, j) => s + (j % 2 ? -1 : 1) * x * det(M.slice(1).map((r) => r.filter((_, k) => k !== j))), 0); }
  const minors = (S) => S.map((_, k) => det(S.slice(0, k + 1).map((r) => r.slice(0, k + 1))));
  function classify(vals) {
    const eps = 1e-9, pos = vals.every((v) => v > eps), neg = vals.every((v) => v < -eps), psd = vals.every((v) => v > -eps), nsd = vals.every((v) => v < eps);
    return pos ? '正定' : neg ? '負定' : psd ? '半正定' : nsd ? '半負定' : '不定（indefinite）';
  }

  // ───────────────────────── 共用：3D 小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const C = { a: '#4b9ee2', b: '#dd8238', p: '#2fc092', e: '#d64545', q: '#9b7ef4', c: '#31aab0', gray: '#b9a888', gold: '#c08a1f' };
  let gen = 0;
  function tween(ms, fn, done) {
    const g = gen, t0 = performance.now();
    const step = () => { if (g !== gen) return; const t = Math.min(1, (performance.now() - t0) / ms); fn(ease(t)); if (t < 1) setTimeout(step, 16); else if (done) done(); };
    step();
  }
  async function anim(tok, ms, fn) { const n = Math.max(6, Math.round(ms / 33)); for (let k = 1; k <= n; k++) { fn(ease(k / n)); await beat(tok, ms / n); } }
  function fresh(pos, look) { gen++; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const tagAt = (text, cls, p) => tag(text, cls, p.x, p.y, p.z);
  const txt = (l, t) => { l.element.textContent = t; };
  function kill(o) { if (!o) return; if (o.kill && o.g) { o.kill(); return; } lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); }
  function mtag(rows, x, y, z = 0, cls = '') {
    const cells = rows.map((r) => r.map((v) => (typeof v === 'number' ? frac(v) : String(v))));
    const w = Math.max(...cells.flat().map((s) => s.length));
    const l = tag(cells.map((r) => '[ ' + r.map((s) => s.padStart(w)).join('  ') + ' ]').join('\n'), cls, x, y, z);
    Object.assign(l.element.style, MONO); return l;
  }
  function arrow(color, r = 0.05) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
    shaft.castShadow = head.castShadow = true;
    const g = new THREE.Group(); g.add(shaft); g.add(head); lab.world.add(g);
    const A = { g, mat, from: V3(0, 0, 0), to: V3(0, 0, 0), lbl: null };
    A.set = (f, t) => {
      A.from.copy(f); A.to.copy(t);
      const d = t.clone().sub(f), L = d.length();
      if (L < 1e-4) { g.visible = false; if (A.lbl) A.lbl.visible = false; return A; }
      g.visible = true;
      const n = d.clone().divideScalar(L), hl = Math.min(0.28, L * 0.4);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      shaft.quaternion.copy(q); head.quaternion.copy(q);
      shaft.scale.set(1, Math.max(1e-3, L - hl), 1); shaft.position.copy(f).addScaledVector(n, (L - hl) / 2);
      head.scale.set(1, hl, 1); head.position.copy(f).addScaledVector(n, L - hl / 2);
      if (A.lbl) { A.lbl.visible = true; A.lbl.position.copy(t).addScaledVector(n, 0.3); }
      return A;
    };
    A.label = (text, cls) => { if (!A.lbl) { A.lbl = lab.label(text, cls || ''); lab.world.add(A.lbl); } else txt(A.lbl, text); A.set(A.from, A.to); return A; };
    A.glow = (c) => { mat.emissive = new THREE.Color(c || '#000000'); return A; };
    A.color = (c) => { mat.color.set(c); return A; };
    A.kill = () => { lab.world.remove(g); if (A.lbl) { lab.world.remove(A.lbl); A.lbl.element.remove(); } };
    return A;
  }
  function rod(color, r = 0.035) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.5 })); lab.world.add(m);
    m.set = (f, t) => { const d = t.clone().sub(f), L = d.length(); m.visible = L > 1e-4; if (!m.visible) return m; m.quaternion.setFromUnitVectors(UP, d.clone().divideScalar(L)); m.scale.set(1, L, 1); m.position.copy(f).add(t).multiplyScalar(0.5); return m; };
    return m;
  }
  function seg(a, b, color = '#b9a888', dashed = false) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geo, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.14, gapSize: 0.09 }) : new THREE.LineBasicMaterial({ color }));
    if (dashed) l.computeLineDistances();
    lab.world.add(l); return l;
  }
  function poly(pts, color = '#8a7a5c', closed = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(closed ? [...pts, pts[0]] : pts);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); lab.world.add(l);
    l.setPts = (ps) => { const at = geo.attributes.position; const arr = closed ? [...ps, ps[0]] : ps; arr.forEach((p, i) => at.setXYZ(i, p.x, p.y, p.z)); at.needsUpdate = true; geo.computeBoundingSphere(); };
    return l;
  }
  function rightAngle(c, u, v, s = 0.22, color = '#6e5f49') {
    const a = u.clone().normalize().multiplyScalar(s), b = v.clone().normalize().multiplyScalar(s);
    return poly([c.clone().add(a), c.clone().add(a).add(b), c.clone().add(b)], color);
  }
  function cube(text, color, size, x, y, z = 0) {
    const m = lab.box(color, size); m.position.set(x, y, z);
    if (text !== '' && text != null) { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    lab.world.add(m); return m;
  }
  function board2(ox, oy, S, xr, yr) {
    const P = (x, y) => V3(ox + S * x, oy + S * y, 0);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(S * (xr[1] - xr[0]) + 0.4, S * (yr[1] - yr[0]) + 0.4), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 1 }));
    bg.position.set(ox + S * (xr[0] + xr[1]) / 2, oy + S * (yr[0] + yr[1]) / 2, -0.03); bg.receiveShadow = true; lab.world.add(bg);
    for (let x = Math.ceil(xr[0]); x <= xr[1]; x++) seg(P(x, yr[0]), P(x, yr[1]), x === 0 ? '#9c8d70' : '#eadfca');
    for (let y = Math.ceil(yr[0]); y <= yr[1]; y++) seg(P(xr[0], y), P(xr[1], y), y === 0 ? '#9c8d70' : '#eadfca');
    return P;
  }
  const W2 = (P, u) => P(u[0], u[1]);
  const circlePts = (n = 72) => [...Array(n).keys()].map((k) => [Math.cos((k / n) * 2 * Math.PI), Math.sin((k / n) * 2 * Math.PI)]);
  const rotM = (r) => [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]];
  const lerpM = (A, B, t) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * t));
  const I2 = [[1, 0], [0, 1]];

  // ── 二次曲面 z = xᵀSx（polar 網格，floor 上方） ──
  function surface(R = 1, H0 = 2.6, Hs = 2.3, sx = 2.6) {
    const NR = 22, NT = 72, n = (NR + 1) * NT;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
      const a = i * NT + j, b = i * NT + ((j + 1) % NT), c2 = (i + 1) * NT + j, d = (i + 1) * NT + ((j + 1) % NT);
      idx.push(a, c2, b, b, c2, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.65, transparent: true, opacity: 0.93 }));
    mesh.castShadow = true; lab.world.add(mesh);
    const lo = new THREE.Color('#4b9ee2'), mid = new THREE.Color('#f3ead8'), hi = new THREE.Color('#dd8238'), tmp = new THREE.Color();
    const surf = { mesh, H0, Hs, sx, R, scale: 1, pt: null };
    surf.at = (x, y, f) => V3(sx * x, H0 + Hs * f * surf.scale, -sx * y);
    surf.set = (S, fixedScale) => {
      let mx = 1e-9; const F = (x, y) => S[0][0] * x * x + 2 * S[0][1] * x * y + S[1][1] * y * y;
      for (let j = 0; j < NT; j++) { const t = (j / NT) * 2 * Math.PI; mx = Math.max(mx, Math.abs(F(R * Math.cos(t), R * Math.sin(t)))); }
      surf.scale = fixedScale || 1 / mx;
      for (let i = 0; i <= NR; i++) for (let j = 0; j < NT; j++) {
        const r = (i / NR) * R, t = (j / NT) * 2 * Math.PI, x = r * Math.cos(t), y = r * Math.sin(t), f = F(x, y), h = Math.max(-1, Math.min(1, f * surf.scale));
        const k = (i * NT + j) * 3, p = surf.at(x, y, f);
        pos[k] = p.x; pos[k + 1] = H0 + Hs * h; pos[k + 2] = p.z;
        if (h >= 0) tmp.copy(mid).lerp(hi, h); else tmp.copy(mid).lerp(lo, -h);
        col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
      return surf.scale;
    };
    // base plate + axes
    const base = new THREE.Mesh(new THREE.CircleGeometry(sx * R * 1.08, 64), new THREE.MeshStandardMaterial({ color: '#efe5d2', roughness: 1, transparent: true, opacity: 0.85 }));
    base.rotation.x = -Math.PI / 2; base.position.y = H0 - 0.002; lab.world.add(base);
    seg(V3(-sx * R * 1.15, H0, 0), V3(sx * R * 1.15, H0, 0), '#9c8d70'); seg(V3(0, H0, sx * R * 1.15), V3(0, H0, -sx * R * 1.15), '#9c8d70');
    tag('x', 'idx', sx * R * 1.25, H0, 0); tag('y', 'idx', 0, H0, -sx * R * 1.25);
    return surf;
  }
  // level curve f = k on the base plate (pieces where g(θ) > 0)
  function levelCurve(S, k, sx, H0, R, color = C.q) {
    const out = [];
    let cur = [];
    const N = 180;
    for (let j = 0; j <= N; j++) {
      const t = (j / N) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t), g = S[0][0] * c * c + 2 * S[0][1] * c * s + S[1][1] * s * s;
      const r = g > 1e-9 ? Math.sqrt(k / g) : Infinity;
      if (r <= R * 1.05) cur.push(V3(sx * r * c, H0 + 0.01, -sx * r * s));
      else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out.map((pts) => poly(pts, color));
  }

  // ───────────────────────── 場景（課本）：對稱矩陣的特徵向量互相垂直 ─────────────────────────
  async function scSymEig(tok) {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const P = board2(0, 2.9, 0.62, [-6, 6], [-3.6, 3.8]);
    const S = [[1, 2], [2, 4]];
    tag('S =', 'idx', -4.6, 5.5); mtag(S, -3.6, 5.5, 0, 'ptr');
    const ln1 = rod(C.p, 0.025).set(W2(P, [-2.4, 1.2]), W2(P, [2.4, -1.2])), ln2 = rod(C.q, 0.025).set(W2(P, [-1.6, -3.2]), W2(P, [1.6, 3.2]));
    const ax = arrow(C.a, 0.055), aSx = arrow(C.b, 0.055); ax.label('x', 'ptr'); aSx.label('Sx', 'ptr alt');
    const showX = (deg) => { const r = (deg * Math.PI) / 180, x = [1.6 * Math.cos(r), 1.6 * Math.sin(r)], y = mv(S, x); ax.set(P(0, 0), W2(P, x)); aSx.set(P(0, 0), W2(P, mul(0.55, y))); return { x, y }; };
    say('S = [1 2; 2 4] 是對稱矩陣（Sᵀ = S）', '轉動 x，看 Sx 什麼時候和 x 同方向');
    showX(0); await beat(tok, 2200);
    await anim(tok, 2600, (t) => showX(t * 63.43));
    say('x = (1, 2)：Sx = 5x', 'λ₁ = 5（圖中 Sx 縮小 0.55 倍畫）');
    await beat(tok, 2600);
    await anim(tok, 2200, (t) => showX(63.43 - t * 90));
    say('x = (2, −1)：Sx = 0 = 0x', 'λ₂ = 0（S 是 singular）');
    await beat(tok, 2600);
    rightAngle(P(0, 0), W2(P, [1, 2]).sub(P(0, 0)), W2(P, [2, -1]).sub(P(0, 0)), 0.3);
    say('兩條特徵向量方向互相垂直', '(1, 2)·(2, −1) = 0：對稱矩陣的特徵向量正交');
    await beat(tok, 3200);
    // contrast: non-symmetric
    kill(ln1); kill(ln2);
    const A = [[1, 2], [0, 3]];
    const m2 = mtag(A, 3.6, 5.5, 0, 'ptr alt'); tag('對照 A =', 'idx', 2.2, 5.5);
    const l1 = rod(C.p, 0.025).set(W2(P, [-3, 0]), W2(P, [3, 0])), l2 = rod(C.q, 0.025).set(W2(P, [-2.4, -2.4]), W2(P, [2.4, 2.4]));
    say('不對稱的 A = [1 2; 0 3]', '特徵向量 (1, 0)、(1, 1)：夾 45°，不垂直');
    await beat(tok, 3200);
    say('譜定理：對稱 ⇒ 特徵值全是實數、特徵向量可選成正交', '補充：反對稱的旋轉 [0 −1; 1 0] 特徵值是 ±i');
    await beat(tok, 3200);
    void m2; void l1; void l2;
  }

  // ───────────────────────── 場景（課本）：S = QΛQᵀ（旋轉、伸縮、轉回） ─────────────────────────
  async function scSpectral(tok) {
    const S = (ctx.params && ctx.params.S) || [[2, 1], [1, 2]];
    const { vals, vecs } = symEig(S);
    let q1 = vecs[0], q2 = vecs[1]; if (q1[0] * q2[1] - q1[1] * q2[0] < 0) q2 = mul(-1, q2);
    const Q = [[q1[0], q2[0]], [q1[1], q2[1]]], L = [[vals[0], 0], [0, vals[1]]];
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const sc = Math.min(1.3, 2.4 / Math.max(1, ...vals.map(Math.abs)));
    const P = board2(0, 2.9, sc, [-5.6 / sc, 5.6 / sc], [-2.6 / sc, 2.6 / sc]);
    const cp = circlePts();
    const ref = poly(cp.map((u) => W2(P, u)), '#d8cfc0', true), cur = poly(cp.map((u) => W2(P, u)), C.q, true);
    const e1 = arrow(C.p, 0.05), e2 = arrow(C.a, 0.05);
    let M = I2;
    const draw = (Mx) => { M = Mx; cur.setPts(cp.map((u) => W2(P, mv(Mx, u)))); e1.set(P(0, 0), W2(P, mv(Mx, q1))); e2.set(P(0, 0), W2(P, mv(Mx, q2))); };
    draw(I2); e1.label('q₁', 'ptr'); e2.label('q₂', 'ptr');
    tag('S =', 'idx', -5.2, 5.6); mtag(S, -4.2, 5.6, 0, 'ptr');
    say('單位圓上的 q₁、q₂：S 的兩個正交特徵向量', 'λ₁ = ' + frac(vals[0]) + '，λ₂ = ' + frac(vals[1]));
    await beat(tok, 3000);
    const QT = tr(Q), ang = Math.atan2(Q[1][0], Q[0][0]);
    say('第一步 Qᵀ：轉到座標軸上', 'q₁ → (1, 0)，q₂ → (0, 1)');
    await anim(tok, 1600, (t) => draw(rotM(-ang * t)));
    await beat(tok, 1400);
    say('第二步 Λ：沿座標軸伸縮', '×' + frac(vals[0]) + ' 和 ×' + frac(vals[1]));
    await anim(tok, 1600, (t) => draw(mm(lerpM(I2, L, t), QT)));
    await beat(tok, 1400);
    say('第三步 Q：轉回原來的方向', 'S = QΛQᵀ');
    const LQT = mm(L, QT);
    await anim(tok, 1600, (t) => draw(mm(rotM(ang * t), LQT)));
    draw(mm(Q, LQT));
    e1.label('Sq₁ = ' + frac(vals[0]) + 'q₁', 'ptr'); e2.label('Sq₂ = ' + frac(vals[1]) + 'q₂', 'ptr');
    await beat(tok, 1200);
    const direct = poly(cp.map((u) => W2(P, mv(S, u))), C.b, true);
    say('和直接乘 S 的結果完全重合', '對稱矩陣 = 轉 → 沿垂直軸伸縮 → 轉回');
    await beat(tok, 3400);
    void ref; void direct; void M;
  }

  // ───────────────────────── 場景（課本）：S = λ₁q₁q₁ᵀ + λ₂q₂q₂ᵀ ─────────────────────────
  async function scSpectralSum(tok) {
    fresh([0, 3.0, 11], [0, 2.9, 0]);
    const P = board2(0, 2.6, 1.2, [-2.6, 2.6], [-1.6, 2.4]);
    const q1 = unit([1, 1]), q2 = unit([1, -1]), x = [1, 0];
    rod(C.p, 0.02).set(W2(P, mul(-2.2, q1)), W2(P, mul(3, q1))); rod(C.a, 0.02).set(W2(P, mul(-1.8, q2)), W2(P, mul(1.8, q2)));
    tag('S = [2 1; 1 2]', 'ptr', -3.6, 5.6);
    const ax = arrow(C.b, 0.055).set(P(0, 0), W2(P, x)).label('x = (1, 0)', 'ptr alt');
    say('S = 3·q₁q₁ᵀ + 1·q₂q₂ᵀ', '每一項 qqᵀ 是投影到一條特徵向量方向');
    await beat(tok, 3000);
    const c1 = mul(dot(q1, x), q1), c2 = mul(dot(q2, x), q2);
    const d1 = seg(W2(P, x), W2(P, c1), '#6e5f49', true), d2 = seg(W2(P, x), W2(P, c2), '#6e5f49', true);
    const p1 = arrow(C.p, 0.045); await anim(tok, 900, (t) => p1.set(P(0, 0), W2(P, mul(t, c1)))); p1.label('q₁q₁ᵀx', 'idx');
    const p2 = arrow(C.a, 0.045); await anim(tok, 900, (t) => p2.set(P(0, 0), W2(P, mul(t, c2)))); p2.label('q₂q₂ᵀx', 'idx');
    say('先把 x 拆成兩個正交分量', 'x = (1/2, 1/2) + (1/2, −1/2)');
    await beat(tok, 2800);
    kill(d1); kill(d2);
    await anim(tok, 1200, (t) => p1.set(P(0, 0), W2(P, mul(1 + 2 * t, c1))));
    p1.label('3 · (1/2, 1/2)', 'idx');
    say('q₁ 方向乘 λ₁ = 3，q₂ 方向乘 λ₂ = 1', '');
    await beat(tok, 2400);
    const p2b = arrow(C.a, 0.035); await anim(tok, 900, (t) => p2b.set(W2(P, mul(3, c1)), W2(P, add(mul(3, c1), mul(t, c2)))));
    const sx = arrow(C.e, 0.06); await anim(tok, 900, (t) => sx.set(P(0, 0), W2(P, mul(t, mv([[2, 1], [1, 2]], x))))); sx.label('Sx = (2, 1)', '');
    say('加起來 = Sx = (2, 1)', '<span class="ok">λ₁q₁q₁ᵀx + λ₂q₂q₂ᵀx = Sx</span>');
    await beat(tok, 3400);
    void ax; void p2;
  }

  // ───────────────────────── 場景（課本）：正交對角化 PᵀSP = D ─────────────────────────
  async function scOrthDiag(tok) {
    fresh([0, 3.4, 12.5], [0, 3.2, 0]);
    const S = [[6, 2], [2, 3]];
    const steps = [
      ['① 特徵方程式', 'det(S − λI) = λ² − 9λ + 14 = 0', 'λ = 7、2（實數）'],
      ['② 解特徵向量', '(S − 7I)x = 0 → (2, 1)', '(S − 2I)x = 0 → (1, −2)'],
      ['③ 檢查正交', '(2, 1)·(1, −2) = 0', '不同 λ 的特徵向量自動垂直'],
      ['④ 正規化', 'q₁ = (2, 1)/√5', 'q₂ = (1, −2)/√5'],
      ['⑤ 排成 P、D', 'P = (1/√5)[2 1; 1 −2]', 'D = [7 0; 0 2]'],
    ];
    tag('S =', 'idx', -5.0, 6.4); mtag(S, -4.0, 6.4, 0, 'ptr');
    say('考古題最愛：找正交矩陣 P 使 PᵀSP = D', 'S = [6 2; 2 3]');
    await beat(tok, 2800);
    const P = board2(3.2, 2.8, 0.75, [-2.6, 3.2], [-2.8, 2.2]);
    for (let k = 0; k < steps.length; k++) {
      const [h, a, b] = steps[k];
      const y = 5.4 - k * 1.05;
      const m = cube(h, k === 4 ? C.p : C.a, [2.4, 0.5, 0.5], -4.3, y + 2.5, 0);
      lab.dropTo(lab.addBody(m), V3(-4.3, y, 0));
      tag(a, 'idx', -1.2, y + 0.18); tag(b, 'idx', -1.2, y - 0.2);
      say(h, a + '；' + b);
      if (k === 1) { rod(C.p, 0.03).set(W2(P, [-2.4, -1.2]), W2(P, [3, 1.5])); rod(C.q, 0.03).set(W2(P, [-1.1, 2.2]), W2(P, [1.3, -2.6])); }
      if (k === 2) rightAngle(P(0, 0), W2(P, [2, 1]).sub(P(0, 0)), W2(P, [1, -2]).sub(P(0, 0)), 0.3);
      if (k === 3) { arrow(C.p, 0.05).set(P(0, 0), W2(P, unit([2, 1]))).label('q₁', 'ptr'); arrow(C.q, 0.05).set(P(0, 0), W2(P, unit([1, -2]))).label('q₂', 'ptr'); }
      await beat(tok, 2800);
    }
    say('驗證：PᵀSP = D，也就是 S = PDPᵀ', '補充：重根時，同一個特徵空間內要再做 Gram-Schmidt');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景（課本）：xᵀSx 的曲面 ─────────────────────────
  async function scQuadSurface(tok) {
    fresh([5.6, 7.4, 7.6], [0, 2.4, 0]);
    const surf = surface(1, 2.6, 2.2, 2.6);
    const cap = tag('', 'ptr', -4.6, 6.2);
    const setC = (c) => { surf.set([[2, 6], [6, c]]); txt(cap, 'f = 2x² + 12xy + ' + f2(c) + 'y²'); };
    setC(20);
    say('c = 20：f = 2x² + 12xy + 20y²', '碗（bowl）：除了原點處處 > 0 → 正定');
    await beat(tok, 3600);
    await anim(tok, 2000, (t) => setC(20 - 2 * t));
    say('c = 18：f = 2(x + 3y)²', '沿著 x = −3y 這條線 f = 0：槽（trough）→ 半正定');
    await beat(tok, 3600);
    await anim(tok, 2600, (t) => setC(18 - 11 * t));
    say('c = 7：馬鞍面（saddle）', 'f(1, −1) = 2 − 12 + 7 = −3 < 0 → 不定');
    await beat(tok, 3600);
    await anim(tok, 2200, (t) => setC(7 + 13 * t));
    say('分界點：det = 2c − 36 = 0 ⇒ c = 18', 'c > 18 正定、c = 18 半正定、c < 18 不定');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景（課本）：正定的四種判斷 ─────────────────────────
  async function scPDTests(tok) {
    fresh([0, 3.6, 12.5], [0, 3.0, 0]);
    const S = [[2, 6], [6, 20]];
    tag('S =', 'idx', -1.2, 6.4); mtag(S, 0, 6.4, 0, 'ptr');
    say('S = [2 6; 6 20] 是正定嗎？四種測試都會成立', '');
    await beat(tok, 2600);
    const ev = symEig(S).vals;
    const tests = [
      ['特徵值', ev, ['λ₁ ≈ ' + f2(ev[0]), 'λ₂ ≈ ' + f2(ev[1])], '全部 λ > 0'],
      ['Pivots', [2, 2], ['2', '20 − 3·6 = 2'], '全部 pivot > 0'],
      ['左上行列式', [2, 4], ['2', '40 − 36 = 4'], '全部 leading minor > 0'],
      ['xᵀSx', [2, 2], ['2(x + 3y)²', '+ 2y²'], 'x ≠ 0 時 > 0'],
    ];
    for (let k = 0; k < 4; k++) {
      const [nm, vals, lbs, cap] = tests[k], x0 = -5.1 + k * 3.4;
      tag(nm, 'ptr', x0 + 0.5, 0.2, 1.6);
      for (let j = 0; j < 2; j++) {
        const h = Math.min(3.6, 0.25 + Math.log2(1 + Math.abs(vals[j])) * 0.8);
        const m = lab.box(vals[j] > 0 ? C.p : C.e, [0.8, 1, 0.8]); m.scale.y = 0.01; m.position.set(x0 + j * 1.05, 0, 0); lab.world.add(m);
        await anim(tok, 500, (t) => { m.scale.y = h * t + 0.01; m.position.y = (h * t) / 2; });
        tag(lbs[j], 'idx', x0 + j * 1.05, h + 0.35, 0);
      }
      say(nm + '：' + cap, k === 3 ? '配方 = 消去法：3 是 ℓ₂₁，2 和 2 是 pivots' : '');
      await beat(tok, 2600);
    }
    say('四種測試等價：一個成立，全部成立', '高度為對數尺度；λ₂ ≈ 0.18 很小但 > 0');
    await beat(tok, 3000);
    say('把 20 改成 7：pivot 變 7 − 18 = −11', '<span class="no">det = −22 < 0</span>，有負特徵值 → 馬鞍面');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景（課本）：配方 = 消去法 ─────────────────────────
  async function scCompleteSquare(tok) {
    fresh([5.6, 7.4, 7.6], [0, 2.4, 0]);
    const surf = surface(1, 2.6, 2.2, 2.6);
    const cap = tag('', 'ptr', -4.6, 6.2);
    const fix = 1 / 26;
    const F = (w) => { surf.set([[2, 6], [6, 18 + 2 * w]], fix); txt(cap, 'f = 2(x + 3y)² + ' + f2(2 * w) + 'y²'); };
    F(0);
    say('先看第一個平方 2(x + 3y)²', '沿著 x + 3y = 0 是一條 0 的谷底');
    await beat(tok, 3200);
    await anim(tok, 2400, (t) => F(t));
    say('再加上 2y²：谷底被抬起來 → 碗', 'f = 2(x + 3y)² + 2y²，兩個平方係數 = 兩個 pivots');
    await beat(tok, 3400);
    say('對應消去法 S = LDLᵀ', 'L = [1 0; 3 1]、D = diag(2, 2)：ℓ₂₁ = 3 就是括號裡的 3');
    await beat(tok, 3400);
    await anim(tok, 2400, (t) => F(1 - 6.5 * t));
    say('c = 7：第二個係數變成 −11', '2(x + 3y)² − 11y²：一個方向往上、一個往下');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景（課本）：主軸定理 ─────────────────────────
  async function scPrincipalAxes(tok) {
    fresh([0, 3.0, 10.5], [0, 2.9, 0]);
    const P = board2(0, 2.9, 2.2, [-1.4, 1.4], [-1.1, 1.2]);
    const S = [[5, 4], [4, 5]];
    const ell = (R) => { const pts = []; for (let k = 0; k < 120; k++) { const t = (k / 120) * 2 * Math.PI; const u = [Math.cos(t) / 3, Math.sin(t)]; pts.push(W2(P, mv(R, u))); } return pts; };
    const R45 = rotM(Math.PI / 4);
    const e = poly(ell(R45), C.q, true);
    tag('5x² + 8xy + 5y² = 1', 'ptr', -3.2, 5.9);
    say('橢圓 5x² + 8xy + 5y² = 1', 'S = [5 4; 4 5]：xy 交叉項讓橢圓歪了');
    await beat(tok, 3000);
    const q1 = unit([1, 1]), q2 = unit([1, -1]);
    const a1 = arrow(C.p, 0.05), a2 = arrow(C.a, 0.05);
    await anim(tok, 1000, (t) => { a1.set(P(0, 0), W2(P, mul(t / 3, q1))); a2.set(P(0, 0), W2(P, mul(t, q2))); });
    a1.label('1/√9 = 1/3', 'ptr'); a2.label('1/√1 = 1', 'ptr');
    say('主軸 = 特徵向量方向', 'λ = 9 沿 (1, 1)，λ = 1 沿 (1, −1)；半軸長 = 1/√λ');
    await beat(tok, 3400);
    say('λ 越大，那個方向越「陡」→ 半軸越短', '');
    await beat(tok, 2400);
    await anim(tok, 1800, (t) => { const R = rotM((Math.PI / 4) * (1 - t)); e.setPts(ell(R)); a1.set(P(0, 0), W2(P, mul(1 / 3, mv(rotM(-(Math.PI / 4) * t), q1)))); a2.set(P(0, 0), W2(P, mv(rotM(-(Math.PI / 4) * t), q2))); });
    say('換成主軸座標 X、Y：9X² + Y² = 1', 'x = QX；xᵀSx = Xᵀ(QᵀSQ)X = XᵀΛX，交叉項消失');
    await beat(tok, 3600);
  }

  // ───────────────────────── 場景（課本）：3×3 正定與橢球 ─────────────────────────
  const K3 = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]];
  function ellipsoid(S, O, s, color = C.q) {
    const { vals, vecs } = symEig(S);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.4, transparent: true, opacity: 0.55 }));
    m.matrixAutoUpdate = false;
    // three = T · Q · diag(1/√λ)；T：數學 (x, y, z) → three (x, z, −y)，再乘 s
    const cols = vecs.map((v, k) => mul(s / Math.sqrt(vals[k]), [v[0], v[2], -v[1]]));
    m.matrix.set(cols[0][0], cols[1][0], cols[2][0], O.x, cols[0][1], cols[1][1], cols[2][1], O.y, cols[0][2], cols[1][2], cols[2][2], O.z, 0, 0, 0, 1);
    m.castShadow = true; lab.world.add(m);
    return { m, vals, vecs };
  }
  async function scPD3(tok) {
    fresh([4.8, 5.4, 8.2], [0.6, 2.7, 0]);
    tag('S =', 'idx', -4.6, 6.0); mtag(K3, -3.4, 6.0, 0, 'ptr');
    say('S = [2 −1 0; −1 2 −1; 0 −1 2]', '課本與 L27 的 3×3 例子');
    await beat(tok, 2600);
    const ps = pivots(K3), dm = minors(K3), ev = symEig(K3).vals;
    const rows = [['pivots', ps.map(frac)], ['左上行列式', dm.map(frac)], ['特徵值', ['2 − √2', '2', '2 + √2']]];
    for (let k = 0; k < 3; k++) {
      tag(rows[k][0] + '：' + rows[k][1].join('、'), 'ptr alt', -3.4, 4.6 - k * 0.6);
      say(rows[k][0] + '：' + rows[k][1].join('、'), '全部 > 0 → 正定');
      await beat(tok, 2200);
    }
    const O = V3(1.6, 2.9, 0), s = 1.8;
    const E = ellipsoid(K3, O, s);
    say('xᵀSx = 1 是一顆橢球', '');
    await beat(tok, 1600);
    const map = (v) => V3(v[0], v[2], -v[1]);
    for (let k = 0; k < 3; k++) {
      const d = map(E.vecs[k]).multiplyScalar(s / Math.sqrt(E.vals[k]));
      const A = arrow([C.e, C.p, C.a][k], 0.045).set(O.clone(), O.clone().add(d));
      A.label('λ = ' + ['2 + √2', '2', '2 − √2'][k] + '：半軸 ' + f2(1 / Math.sqrt(E.vals[k])), 'idx');
      say('主軸 ' + (k + 1) + '：特徵向量 ' + ['(1, −√2, 1)', '(1, 0, −1)', '(1, √2, 1)'][k], '半軸長 = 1/√λ ≈ ' + f2(1 / Math.sqrt(E.vals[k])));
      await beat(tok, 2400);
    }
    say('三個主軸互相垂直：S = QΛQᵀ 的 Q', 'det = 4 = λ₁λ₂λ₃ = 2·(3/2)·(4/3)（pivots 乘積）');
    await beat(tok, 3200);
    void ev;
  }

  // ───────────────────────── 場景（課本）：AᵀA 一定半正定 ─────────────────────────
  async function scATA(tok) {
    fresh([0, 3.0, 11], [0, 2.9, 0]);
    const P = board2(0, 2.9, 0.8, [-4.5, 4.5], [-2.9, 2.9]);
    const A = [[1, 1], [0, 1], [1, 0]]; // 3×2
    tag('A = [1 1; 0 1; 1 0]', 'ptr', -3.6, 5.8); tag('AᵀA = [2 1; 1 2]', 'ptr alt', 1.6, 5.8);
    say('任何 A，AᵀA 都是對稱矩陣', '(AᵀA)ᵀ = AᵀA');
    await beat(tok, 2600);
    const S = mm(tr(A), A);
    const ax = arrow(C.a, 0.05); ax.label('x', 'ptr');
    const val = tag('', 'ptr alt', 0, 0.5);
    const showX = (deg) => { const r = (deg * Math.PI) / 180, x = [2 * Math.cos(r), 2 * Math.sin(r)]; ax.set(P(0, 0), W2(P, x)); const Ax = mv(A, x); txt(val, 'xᵀAᵀAx = ‖Ax‖² = ' + f2(dot(Ax, Ax))); return Ax; };
    say('xᵀ(AᵀA)x = (Ax)ᵀ(Ax) = ‖Ax‖² ≥ 0', '長度平方不可能是負的');
    await anim(tok, 5000, (t) => showX(360 * t));
    say('A 的 columns 獨立 ⇒ Ax ≠ 0 ⇒ AᵀA 正定', 'columns 相依時只有半正定（least squares 就靠這個）');
    await beat(tok, 3400);
    void S;
  }

  // ───────────────────────── 模式 1：二次曲面 ─────────────────────────
  const qf = { S: [[2, 6], [6, 20]] };
  function enterSurface() {
    fresh([5.8, 7.6, 7.8], [0, 2.4, 0]);
    const S = qf.S, surf = surface(1, 2.6, 2.2, 2.6);
    surf.set(S);
    const { vals, vecs } = symEig(S);
    vecs.forEach((v, k) => { if (Math.abs(vals[k]) > 1e-9) { const d = V3(v[0], 0, -v[1]).multiplyScalar(2.6 * 1.05); rod(k ? C.a : C.p, 0.02).set(V3(0, 2.6, 0).sub(d), V3(0, 2.6, 0).add(d)); } });
    const mxF = Math.max(Math.abs(vals[0]), Math.abs(vals[1]));
    if (vals[0] > 1e-9) levelCurve(S, mxF * 0.25, 2.6, 2.6, 1);
    tag('f = ' + f2(S[0][0]) + 'x² + ' + f2(2 * S[0][1]) + 'xy + ' + f2(S[1][1]) + 'y²', 'ptr', -4.4, 6.3);
    controls('<label>a = <input id="sfA" size="3" value="' + S[0][0] + '"></label><label>b = <input id="sfB" size="3" value="' + S[0][1] + '"></label><label>c = <input id="sfC" size="3" value="' + S[1][1] + '"></label><button class="primary" id="sfGo">畫出來</button>'
      + '<button id="sfP1">碗 c=20</button><button id="sfP2">槽 c=18</button><button id="sfP3">馬鞍 c=7</button><button id="sfP4">倒碗</button>');
    on('sfGo', () => {
      const a = Number($('sfA').value.replace(/−/g, '-')), b = Number($('sfB').value.replace(/−/g, '-')), c = Number($('sfC').value.replace(/−/g, '-'));
      if (![a, b, c].every(isFinite) || [$('sfA').value, $('sfB').value, $('sfC').value].some((v) => v === '')) { log('a、b、c 都要是數字：S = [a b; b c]。', true); return; }
      if ([a, b, c].some((v) => Math.abs(v) > 50)) { log('數字請在 −50 到 50 之間。', true); return; }
      if (a === 0 && b === 0 && c === 0) { log('S = 0 時 f 處處為 0，沒有曲面可看。', true); return; }
      qf.S = [[a, b], [b, c]]; log('S = [' + a + ' ' + b + '; ' + b + ' ' + c + ']：' + classify(symEig(qf.S).vals)); enterSurface();
    });
    const preset = (S2, m) => { qf.S = S2; log(m); enterSurface(); };
    on('sfP1', () => preset([[2, 6], [6, 20]], 'c = 20：正定（碗）')); on('sfP2', () => preset([[2, 6], [6, 18]], 'c = 18：半正定（槽）'));
    on('sfP3', () => preset([[2, 6], [6, 7]], 'c = 7：不定（馬鞍）')); on('sfP4', () => preset([[-3, 1], [1, -2]], '負定：倒過來的碗'));
    const ps = pivots(S), dm = minors(S), cls = classify(vals);
    const ok = (b) => (b ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');
    setState('S = ' + ms(S) + '：' + cls, [
      ['特徵值', vals.map(f2).join('、') + ' ' + ok(vals.every((v) => v > 1e-9))],
      ['pivots', ps.map((p) => (isFinite(p) ? f2(p) : '—')).join('、') + ' ' + ok(ps.every((p) => p > 1e-9))],
      ['左上行列式', dm.map(f2).join('、') + ' ' + ok(dm.every((d) => d > 1e-9))],
      ['主軸（綠 λ₁、藍 λ₂）', vecs.map((v) => vs(v, f2)).join('、')]],
      '四項全 ✓ 才是正定；紫線是等高線 f = 定值');
  }

  // ───────────────────────── 模式 2：譜分解 ─────────────────────────
  const spm = { S: [[2, 1], [1, 2]], stage: 0 };
  function enterSpectral() {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const S = spm.S, { vals, vecs } = symEig(S);
    let q1 = vecs[0], q2 = vecs[1]; if (q1[0] * q2[1] - q1[1] * q2[0] < 0) q2 = mul(-1, q2);
    const Q = [[q1[0], q2[0]], [q1[1], q2[1]]], L = [[vals[0], 0], [0, vals[1]]];
    const mx = Math.max(1, ...vals.map(Math.abs)), sc = Math.min(1.4, 2.5 / mx), ang = Math.atan2(Q[1][0], Q[0][0]), QT = tr(Q), LQT = mm(L, QT);
    const P = board2(0, 2.9, sc, [-5.6 / sc, 5.6 / sc], [-2.7 / sc, 2.7 / sc]);
    const cp = circlePts();
    poly(cp.map((u) => W2(P, u)), '#d8cfc0', true);
    const stageAt = [(t) => I2, (t) => rotM(-ang * t), (t) => mm(lerpM(I2, L, t), QT), (t) => mm(rotM(ang * t), LQT)];
    const names = ['單位圓', 'Qᵀ：轉到座標軸', 'Λ：沿軸伸縮', 'Q：轉回 → S'];
    const shape = poly(cp.map((u) => W2(P, u)), C.q, true), e1 = arrow(C.p, 0.05), e2 = arrow(C.a, 0.05);
    tween(900, (t) => { const M = stageAt[spm.stage](t); shape.setPts(cp.map((u) => W2(P, mv(M, u)))); e1.set(P(0, 0), W2(P, mv(M, q1))); e2.set(P(0, 0), W2(P, mv(M, q2))); }, () => { e1.label('q₁ 的像', 'ptr'); e2.label('q₂ 的像', 'ptr'); });
    controls('<label>a = <input id="spA" size="3" value="' + S[0][0] + '"></label><label>b = <input id="spB" size="3" value="' + S[0][1] + '"></label><label>c = <input id="spC" size="3" value="' + S[1][1] + '"></label><button id="spGo">套用</button>'
      + '<button class="primary" id="spNext">下一步</button><button id="spReset">從頭</button><button id="spNS">試不對稱的</button>');
    on('spGo', () => {
      const v = ['spA', 'spB', 'spC'].map((id) => Number($(id).value.replace(/−/g, '-')));
      if (!v.every(isFinite) || ['spA', 'spB', 'spC'].some((id) => $(id).value === '')) { log('a、b、c 都要填數字。', true); return; }
      if (v.some((x) => Math.abs(x) > 6)) { log('請用 −6 到 6 的數字，不然橢圓會跑出舞台。', true); return; }
      spm.S = [[v[0], v[1]], [v[1], v[2]]]; spm.stage = 0; log('S = ' + ms(spm.S) + '，λ = ' + symEig(spm.S).vals.map(f2).join('、')); enterSpectral();
    });
    on('spNext', () => { if (spm.stage >= 3) { log('已經轉回來了：結果和直接乘 S 一樣。按「從頭」再看一次。', true); return; } spm.stage++; log(names[spm.stage]); enterSpectral(); });
    on('spReset', () => { spm.stage = 0; enterSpectral(); });
    on('spNS', () => { log('A = [1 2; 0 3] 不對稱：特徵向量 (1, 0)、(1, 1) 夾 45°，不能寫成 QΛQᵀ（Q 正交）。這個模式只接受對稱矩陣，b 同時放在右上與左下。', true); });
    setState('S = QΛQᵀ：' + names[spm.stage], [['S', ms(S)], ['λ₁、λ₂', vals.map(f2).join('、')], ['q₁', vs(q1, f2)], ['q₂', vs(q2, f2)], ['q₁·q₂', f2(dot(q1, q2))]],
      vals.some((v) => v < -1e-9) ? '有負的 λ：那個方向會翻面' : '對稱 ⇒ λ 實數、q 正交');
  }

  // ───────────────────────── 模式 3：3×3 正定測試 ─────────────────────────
  const pd = { S: K3.map((r) => r.slice()) };
  function enterPD() {
    fresh([4.2, 5.6, 10.5], [0, 2.8, 0]);
    const S = pd.S, ev = symEig(S), ps = pivots(S), dm = minors(S), cls = classify(ev.vals);
    const groups = [['pivots', ps], ['左上行列式', dm], ['特徵值', ev.vals]];
    groups.forEach(([nm, vals], g) => {
      const x0 = -5.4 + g * 2.6;
      tag(nm, 'ptr', x0 + 0.85, 0.15, 1.5);
      vals.forEach((v, j) => {
        const bad = !(v > 1e-9), h = isFinite(v) ? Math.min(3, 0.15 + Math.log2(1 + Math.abs(v)) * 0.8) : 0.15;
        const m = lab.box(bad ? C.e : C.p, [0.7, 1, 0.7]); m.scale.y = 0.01; m.position.set(x0 + j * 0.85, 0, 0); lab.world.add(m);
        tween(500, (t) => { m.scale.y = h * t + 0.01; m.position.y = (h * t) / 2; });
        tag(isFinite(v) ? f2(v) : '—', 'idx', x0 + j * 0.85, h + 0.3, 0);
      });
    });
    if (ev.vals.every((v) => v > 1e-6)) {
      const E = ellipsoid(S, V3(3.9, 2.4, 0), Math.min(1.5, 2 * Math.sqrt(ev.vals[2])));
      tag('xᵀSx = 1', 'idx', 3.9, 4.6); void E;
    } else tag('不是正定：xᵀSx = 1 不是橢球', 'ptr alt', 3.9, 2.4);
    const inp = (i, j) => '<input id="pd' + i + j + '" size="2" value="' + S[i][j] + '">';
    controls('<span>S = [' + inp(0, 0) + inp(0, 1) + inp(0, 2) + ' ; · ' + inp(1, 1) + inp(1, 2) + ' ; · · ' + inp(2, 2) + ']</span><button class="primary" id="pdGo">判斷</button><button id="pdK">課本例</button><button id="pdR">隨機</button>');
    on('pdGo', () => {
      const g = (i, j) => Number($('pd' + i + j).value.replace(/−/g, '-'));
      const v = [[g(0, 0), g(0, 1), g(0, 2)], [0, g(1, 1), g(1, 2)], [0, 0, g(2, 2)]];
      if (v.flat().some((x) => !isFinite(x))) { log('請填六個數字（對稱矩陣的上三角）。', true); return; }
      if (v.flat().some((x) => Math.abs(x) > 20)) { log('數字請在 −20 到 20 之間。', true); return; }
      v[1][0] = v[0][1]; v[2][0] = v[0][2]; v[2][1] = v[1][2];
      pd.S = v; const r = classify(symEig(v).vals); log('S = ' + ms(v) + '：' + r); enterPD();
    });
    on('pdK', () => { pd.S = K3.map((r) => r.slice()); enterPD(); });
    on('pdR', () => { const a = rnd(1, 4), b = rnd(-3, 3), c = rnd(-2, 2), d = rnd(1, 5), e = rnd(-3, 3), f = rnd(1, 5); pd.S = [[a, b, c], [b, d, e], [c, e, f]]; log('隨機 S = ' + ms(pd.S) + '：先自己猜，再看長條'); enterPD(); });
    setState('3×3：' + cls, [['S', ms(S)], ['pivots', ps.map((p) => (isFinite(p) ? f2(p) : '—')).join('、')], ['左上行列式', dm.map(f2).join('、')], ['特徵值', ev.vals.map(f2).join('、')]],
      '綠 = 正、紅 = 非正；正定 ⇔ 三組全綠（三種測試必定同時成立或同時失敗）');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const CLS = ['正定', '半正定', '不定（indefinite）', '負定'];
  function genQ() {
    const kind = rnd(0, 5);
    if (kind === 0) {
      let a, b, c; do { a = rnd(-3, 6); b = rnd(-4, 4); c = rnd(-3, 9); } while (a === 0 && b === 0);
      if (Math.random() < 0.25 && a !== 0) { c = (b * b) / a; if (!Number.isInteger(c)) { a = 1; c = b * b; } }
      const S = [[a, b], [b, c]], ans = classify(symEig(S).vals);
      const opts = CLS.includes(ans) ? CLS : [ans, ...CLS.slice(0, 3)];
      return { q: 'S = [' + a + ' ' + b + '; ' + b + ' ' + c + ']，xᵀSx 是？', opts, ans, why: 'a = ' + a + '，det = ' + a + '·' + c + ' − ' + b * b + ' = ' + (a * c - b * b) + '。2×2 正定 ⇔ a > 0 且 det > 0；det < 0 一定不定；det = 0 是半定。' };
    }
    if (kind === 1) {
      const a = rnd(1, 5), b = rnd(1, 6), th = (b * b) / a;
      const ans = 'c > ' + frac(th);
      const opts = [ans]; for (const w of ['c ≥ ' + frac(th), 'c > ' + frac(b), 'c > ' + frac(2 * b), 'c > ' + frac(th + 1), 'c > ' + frac(a), 'c > 0']) if (!opts.includes(w) && opts.length < 4) opts.push(w);
      return { q: '[' + a + ' ' + b + '; ' + b + ' c] 正定的條件是？', opts, ans, why: 'a = ' + a + ' > 0 已成立，還要 det = ' + a + 'c − ' + b * b + ' > 0。等號時只是半正定。' };
    }
    if (kind === 2) {
      const a = rnd(3, 9), b = rnd(1, a - 1);
      const ans = '(1, 1) 方向 1/√' + (a + b) + '，(1, −1) 方向 1/√' + (a - b);
      return { q: '橢圓 ' + a + 'x² + ' + 2 * b + 'xy + ' + a + 'y² = 1 的兩個半軸是？', opts: [ans, '(1, 1) 方向 1/√' + (a - b) + '，(1, −1) 方向 1/√' + (a + b), '(1, 0) 方向 1/√' + a + '，(0, 1) 方向 1/√' + a, '(1, 1) 方向 √' + (a + b) + '，(1, −1) 方向 √' + (a - b)], ans, why: 'S = [' + a + ' ' + b + '; ' + b + ' ' + a + ']，λ = ' + (a + b) + '（沿 (1, 1)）、' + (a - b) + '（沿 (1, −1)），半軸長 = 1/√λ：λ 大的方向反而短。' };
    }
    if (kind === 3) {
      const st = pick([['對稱矩陣的特徵值都是實數', true], ['對稱矩陣不同特徵值的特徵向量互相垂直', true], ['對稱矩陣一定可以寫成 QΛQᵀ', true], ['正定矩陣一定可逆', true]]);
      const wr = shuffle([['對稱矩陣一定可逆', false], ['特徵值全為正的矩陣一定對稱', false], ['正規矩陣（normal）一定對稱', false], ['正定矩陣的每個元素都 > 0', false], ['對稱矩陣的 pivots 等於特徵值', false]]).slice(0, 3);
      return { q: '下列敘述何者正確？', opts: [st[0], ...wr.map((x) => x[0])], ans: st[0], why: '譜定理：實對稱 ⇒ λ 實數、可正交對角化。反例：[1 1; 1 1] 對稱但不可逆；[1 −1; 1 1]/√2 正規但不對稱；[2 −1; −1 2] 正定但有負元素；pivots 只和特徵值同號（個數相同），不相等。' };
    }
    if (kind === 4) {
      const p = rnd(2, 6), q = rnd(1, 4);
      const ans = 'λ = ' + (p + q) + '、' + (p - q) + '，特徵向量 (1, 1)、(1, −1)';
      return { q: 'S = [' + p + ' ' + q + '; ' + q + ' ' + p + '] 的特徵值與特徵向量？', opts: [ans, 'λ = ' + p + '、' + q + '，特徵向量 (1, 0)、(0, 1)', 'λ = ' + (p + q) + '、' + (p - q) + '，特徵向量 (1, 0)、(1, 1)', 'λ = ' + p * p + '、' + q * q + '，特徵向量 (1, 1)、(1, −1)'], ans, why: 'S(1, 1) = (' + (p + q) + ', ' + (p + q) + ')、S(1, −1) = (' + (p - q) + ', ' + (q - p) + ')。兩個特徵向量垂直，正規化後就是 Q。' };
    }
    const S = pick([[[2, -1, 0], [-1, 2, -1], [0, -1, 2]], [[1, 1, 1], [1, 2, 2], [1, 2, 3]], [[1, 2, 0], [2, 1, 0], [0, 0, 1]], [[4, 2, 0], [2, 1, 0], [0, 0, 3]], [[3, 1, 1], [1, 3, 1], [1, 1, 3]], [[1, 2, 3], [2, 5, 4], [3, 4, 9]]]);
    const dm = minors(S), ans = classify(symEig(S).vals);
    const opts = CLS.includes(ans) ? CLS : [ans, ...CLS.slice(0, 3)];
    return { q: 'S = ' + ms(S, frac) + '，判斷正定性：', opts, ans, why: '左上行列式 = ' + dm.map(frac).join('、') + '；pivots = ' + pivots(S).map((x) => (isFinite(x) ? frac(x) : '—')).join('、') + '。全 > 0 才是正定；出現 0 要再看特徵值。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = shuffle(p.opts);
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

  const scenes = {
    'sym-real-eig': { title: '對稱矩陣：實特徵值、正交特徵向量（課本）', play: scSymEig },
    'spectral-thm': { title: '譜定理 S = QΛQᵀ：轉、伸縮、轉回（課本）', play: scSpectral },
    'spectral-sum': { title: 'S = λ₁q₁q₁ᵀ + λ₂q₂q₂ᵀ（課本）', play: scSpectralSum },
    'orth-diag': { title: '正交對角化流程：PᵀSP = D（課本）', play: scOrthDiag },
    'quad-surface': { title: 'xᵀSx 曲面：碗、槽、馬鞍（課本）', play: scQuadSurface },
    'pd-tests': { title: '正定的四種判斷：λ、pivots、行列式、xᵀSx（課本）', play: scPDTests },
    'complete-square': { title: '配方 = 消去法：2(x + 3y)² + 2y²（課本）', play: scCompleteSquare },
    'principal-axes': { title: '主軸定理：5x² + 8xy + 5y² = 1（課本）', play: scPrincipalAxes },
    'pd-3x3': { title: '3×3 正定與橢球 xᵀSx = 1（課本）', play: scPD3 },
    'ata-psd': { title: 'AᵀA 一定半正定：xᵀAᵀAx = ‖Ax‖²（課本）', play: scATA },
  };

  return {
    kicker: '線性代數・第 8 章',
    title: '對稱矩陣與二次型',
    color: 'var(--la)',
    modes: [
      { id: 'surface', name: '二次曲面', enter: enterSurface },
      { id: 'spectral', name: '譜分解', enter: () => { spm.stage = 0; enterSpectral(); } },
      { id: 'pd', name: '3×3 正定測試', enter: enterPD },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['sym-real-eig', 'spectral-thm', 'spectral-sum', 'orth-diag', 'quad-surface', 'pd-tests', 'complete-square', 'principal-axes', 'pd-3x3', 'ata-psd'],
    stop() { gen++; },
  };
}
