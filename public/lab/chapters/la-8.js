// 線性代數 第8章：對稱矩陣與二次型（Spectral theorem、正交對角化、xᵀAx 曲面、正定判斷、主軸）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 標「課本」的場景以 Strang 例題建立；跟著影片的場景在下面的 sp 片段（MIT 18.06 L25–L27）：
//   S = [1 2; 2 4]、[2 1; 1 2]、f = 2x² + 12xy + cy²（c = 20 / 18 / 7）、5x² + 8xy + 5y² = 1、[2 −1 0; −1 2 −1; 0 −1 2]。
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ sp.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// 這個片段用模組自己的 3D 箭頭 arrow(color, r)（.set / .label / .kill），所以不從 kit 取 arrow；kit 沒有 beat：短暫停用 ctx.beat。
// 也直接用模組的 surface()、levelCurve()、ellipsoid()、symEig()、pivots()、minors()、det()、frac()、f2()、mtag()、board2()。
// ─── 線性代數 第 8 章 — cued scenes（sp）───
//   MIT 18.06 L25（UCc9q_cAhho；同一堂課另一個錄影 umt6BB1nJ4w 共用這些場景）：對稱矩陣、實特徵值、QΛQᵀ、投影和、pivot 正負號、正定入門
//   MIT 18.06 L26（M0Sa8fLOajA）：複數向量長度 zᴴz、Hermitian、unitary、Fourier 矩陣、單位根、FFT
//   MIT 18.06 L27（vF7eyJ2g3kU）：正定四種判斷、[2 6; 6 c]、xᵀAx 曲面（碗／槽／馬鞍）、配方 = 消去、Hessian、3×3 與橢球
// 每個特徵值、pivot、行列式、內積、曲面都由程式算出來再和講者說的數字比對，畫面顯示 ✓／✘。
// 講者只寫符號、或沒有給數字的地方，用的數字是自己選的，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const nt = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ok = (b, t, x, y, z = 0) => (b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (typeof o.kill === 'function' && (o.g || o.ls)) return o.kill(); kill(o); });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const eqM = (A, B, e = 1e-9) => A.every((r, i) => r.every((v, j) => Math.abs(v - B[i][j]) < e));
const hl = (l, cls) => { l.element.className = 'lab-label ' + cls; };
const CAM = [[0, 3.2, 11.5], [0, 3.2, 0]];
const CAM3 = [[5.6, 7.4, 7.6], [0, 2.4, 0]];
// a scene = a list of step functions; each runs when the video reaches its cue
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 複數 ──
const cx = (re, im = 0) => ({ re, im });
const cAdd = (a, b) => cx(a.re + b.re, a.im + b.im);
const cMul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cConj = (a) => cx(a.re, -a.im);
const cAbs2 = (a) => a.re * a.re + a.im * a.im;
const cExp = (th) => cx(Math.cos(th), Math.sin(th));
const cPow = (a, k) => { let r = cx(1); for (let i = 0; i < k; i++) r = cMul(r, a); return r; };
const cNear = (a, b, e = 1e-9) => Math.abs(a.re - b.re) < e && Math.abs(a.im - b.im) < e;
function cs(a) {
  const r = Math.abs(a.re) < 1e-9 ? 0 : a.re, m = Math.abs(a.im) < 1e-9 ? 0 : a.im;
  if (m === 0) return frac(r);
  const mag = Math.abs(m), fm = frac(mag), sl = fm.indexOf('/');
  // 分數寫成 i/2、3i/2，不寫 1/2i（容易誤讀成 1/(2i)）
  const I = near(mag, 1) ? 'i' : sl < 0 ? fm + 'i' : (fm.slice(0, sl) === '1' ? '' : fm.slice(0, sl)) + 'i' + fm.slice(sl);
  if (r === 0) return (m < 0 ? '−' : '') + I;
  return frac(r) + (m < 0 ? '−' : '+') + I;
}
const cdotH = (u, v) => u.reduce((s, x, k) => cAdd(s, cMul(cConj(x), v[k])), cx(0)); // uᴴv
const cdotT = (u, v) => u.reduce((s, x, k) => cAdd(s, cMul(x, v[k])), cx(0)); // uᵀv（沒有共軛）
const cmm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => cAdd(s, cMul(a, B[k][j])), cx(0))));
const cmv = (A, v) => A.map((r) => r.reduce((s, a, k) => cAdd(s, cMul(a, v[k])), cx(0)));
const cHerm = (A) => A[0].map((_, j) => A.map((r) => cConj(r[j])));
const cEye = (A, e = 1e-9) => A.every((r, i) => r.every((v, j) => cNear(v, cx(i === j ? 1 : 0), e)));
const cmat = (A) => A.map((r) => r.map(cs));
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((d) => SUP[d] || d).join('');
// ── 畫圖小零件 ──
function ball(p, color, r = 0.1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  m.position.copy(p); lab.world.add(m); return m;
}
// complex plane: a board with the unit circle
function cplane(ox, oy, s, R = 1.35) {
  const Pp = board2(ox, oy, s, [-R, R], [-R, R]);
  poly(circlePts(96).map((u) => W2(Pp, u)), '#c9b48e', true);
  sm('Re', ...Pp(R + 0.2, 0).toArray()); sm('Im', ...Pp(0, R + 0.18).toArray());
  return Pp;
}
// a signed bar (pivot / eigenvalue / determinant) on a baseline y0: green > 0, red < 0, gray = 0
function bar(x, y0, v, lbl, z = 0, w = 0.55) {
  const h = Math.max(0.06, Math.min(1.7, 0.2 + Math.log2(1 + Math.abs(v)) * 0.6));
  const col = v > 1e-9 ? C.p : v < -1e-9 ? C.e : C.gray;
  const m = lab.box(col, [w, near(v, 0) ? 0.06 : h, w]);
  m.position.set(x, near(v, 0) ? y0 : y0 + (v > 0 ? h / 2 : -h / 2), z); lab.world.add(m);
  const l = sm(lbl, x, near(v, 0) ? y0 + 0.3 : v > 0 ? y0 + h + 0.28 : y0 - h - 0.28, z);
  return [m, l];
}
// 3-D math space: (x, y, z) math → three (x, z, −y), scaled by s around O
function space3(O, s, L = 1.4) {
  const T = (v) => V3(O.x + s * v[0], O.y + s * v[2], O.z - s * v[1]);
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, k) => {
    seg(T(e.map((x) => -x * L)), T(e.map((x) => x * L)), '#9c8d70');
    sm(['x', 'y', 'z'][k], ...T(e.map((x) => x * (L + 0.18))).toArray());
  });
  return T;
}
const vecA = (T, v, color, r = 0.05) => arrow(color, r).set(T([0, 0, 0]), T(v));
// a translucent plane through the origin spanned by unit u, v (math coords)
function planeOf(T, u, v, size = 1.3, color = '#9b7ef4') {
  const g = new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => T(u.map((x, k) => size * (a * x + b * v[k])))));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  lab.world.add(m); return m;
}
// a curve on a surface() along direction d (unit, math coords), same clamp as surf.set
function pathOn(surf, S, d, color = C.e) {
  const F = (x, y) => S[0][0] * x * x + 2 * S[0][1] * x * y + S[1][1] * y * y;
  const pts = [];
  for (let k = 0; k <= 40; k++) {
    const r = -1 + (2 * k) / 40, x = r * d[0], y = r * d[1], h = Math.max(-1, Math.min(1, F(x, y) * surf.scale));
    pts.push(V3(surf.sx * x, surf.H0 + surf.Hs * h + 0.02, -surf.sx * y));
  }
  return poly(pts, color);
}
const onSurf = (surf, S, x, y) => { const f = S[0][0] * x * x + 2 * S[0][1] * x * y + S[1][1] * y * y; return V3(surf.sx * x, surf.H0 + surf.Hs * Math.max(-1, Math.min(1, f * surf.scale)) + 0.08, -surf.sx * y); };
const qf2 = (S, x, y) => S[0][0] * x * x + 2 * S[0][1] * x * y + S[1][1] * y * y;
// a 2-line text panel at the top-left of a 3-D surface view
function panel3(lines, x = -4.7, y = 6.3, dy = 0.5) { return lines.map((t, k) => { const l = tag(t, k ? 'idx' : 'ptr', x, y - k * dy, 0); return l; }); }

// ═════════════════════════ MIT 18.06 L25：Symmetric Matrices and Positive Definiteness ═════════════════════════
const A3 = [[1, 2, 3], [2, 4, 5], [3, 5, 6]]; // 示意（老師這段只寫符號）
const residualOK = (M, vals, vecs) => vals.every((l, k) => mv(M, vecs[k]).every((x, i) => Math.abs(x - l * vecs[k][i]) < 1e-8));
// 6 steps
scene('sp-l25-facts', 'L25：對稱矩陣的兩大事實', [
  (tok, S) => {
    sm('A =', -5.7, 5.0); S.m = mtag(A3, -4.3, 5.0, 0, 'ptr');
    ok(eqM(A3, tr(A3)), 'Aᵀ = A ✓（沿對角線鏡射）', -4.3, 3.8); nt('數字是示意', -4.3, 3.25);
    cap('對稱矩陣：A = Aᵀ', '最重要的一類矩陣');
  },
  (tok, S) => { S.q1 = hot('特徵值有什麼特別？', 0.6, 6.1); S.q2 = hot('特徵向量有什麼特別？', 0.6, 5.55); cap('看到特殊的矩陣，就問：', '它的特徵值、特徵向量有什麼特別？'); },
  (tok, S) => { sm('對照：Markov 矩陣 → 一定有 λ = 1', 0.6, 4.95); cap('像 Markov 矩陣一定有 λ = 1', '特殊的矩陣 → 特殊的特徵值'); },
  async (tok, S) => {
    const { vals, vecs } = symEig(A3); S.vecs = vecs; S.vals = vals;
    const y = 1.3, x0 = -3.2, sc = 0.42; S.y = y; S.x0 = x0;
    rod('#9c8d70', 0.02).set(V3(-5.6, y, 0), V3(2.4, y, 0)); sm('實數線', 2.9, y);
    for (const k of [0, 4, 8, 12]) { rod('#9c8d70', 0.012).set(V3(x0 + sc * k, y - 0.1, 0), V3(x0 + sc * k, y + 0.1, 0)); sm(String(k), x0 + sc * k, y - 0.35); }
    for (let k = 0; k < 3; k++) { const b = ball(V3(x0 + sc * vals[k], y + 1.2, 0), C.p, 0.12); await anim(tok, 350, (t) => { b.position.y = y + 1.2 * (1 - t); }); sm('λ ≈ ' + f2(vals[k]), x0 + sc * vals[k] + (k === 2 ? -0.75 : k === 1 ? 0.7 : 0), y + 0.4); }
    ok(residualOK(A3, vals, vecs), '三個 λ 都落在實數線上 ✓', -1.6, 0.4);
    txt(S.q1, '① 特徵值都是實數');
    cap('事實一：對稱矩陣的特徵值都是實數', '程式算：Ax = λx 驗證過');
  },
  (tok, S) => {
    const R = [[0, -1], [1, 0]], i = cx(0, 1), chk = [i, cx(0, -1)].every((l) => cNear(cAdd(cMul(l, l), cx(1)), cx(0)));
    ball(V3(S.x0, S.y + 0.95, 0), C.e, 0.1); ball(V3(S.x0, S.y - 0.95, 0), C.e, 0.1);
    sm('i', S.x0 - 0.3, S.y + 0.95); sm('−i', S.x0 - 0.35, S.y - 0.95);
    ok(chk, '對照：旋轉 [0 −1; 1 0] 的 λ² + 1 = 0 → λ = ±i ✓（不在線上）', -2.4, 2.75);
    void R; cap('旋轉矩陣的特徵值是複數', '對稱矩陣不會發生這種事');
  },
  async (tok, S) => {
    const T = space3(V3(4.3, 3.0, 0), 0.95, 1.3), cols = [C.a, C.b, C.q];
    const as = S.vecs.map((v, k) => arrow(cols[k], 0.045));
    await anim(tok, 900, (t) => as.forEach((a, k) => a.set(T([0, 0, 0]), T(mul(1.1 * t, S.vecs[k])))));
    as.forEach((a, k) => a.label('q' + '₁₂₃'[k], 'idx'));
    const d = [dot(S.vecs[0], S.vecs[1]), dot(S.vecs[0], S.vecs[2]), dot(S.vecs[1], S.vecs[2])];
    ok(d.every((x) => near(x, 0, 1e-9)), 'q₁·q₂ = q₁·q₃ = q₂·q₃ = 0 ✓', 4.3, 0.7);
    txt(S.q2, '② 特徵向量互相垂直');
    cap('事實二：特徵向量互相垂直（orthogonal）', '三支箭頭兩兩成直角');
  },
], [[0, 3.4, 11.5], [0, 3.3, 0]]);

// 7 steps
const B3 = [[3, 1, 0], [1, 3, 0], [0, 0, 2]]; // 示意：λ = 4, 2, 2
const DIRS = [[1, 0.3, 0.2], [-0.4, 1, 0.5], [0.3, -0.6, 1], [0.8, 0.8, -0.4], [-0.9, -0.2, -0.6], [0.2, -1, -0.3], [-0.5, 0.6, -0.9], [0.9, -0.5, 0.7]].map(unit);
scene('sp-l25-chosen', 'L25：特徵向量「可以選成」互相垂直', [
  (tok, S) => {
    S.T = space3(V3(0.8, 2.8, 0), 1.5, 1.5);
    S.iL = sm('I =', -5.6, 5.6); S.m = mtag([[1, 0, 0], [0, 1, 0], [0, 0, 1]], -4.5, 5.6, 0, 'ptr');
    S.c = sm('λ = 1, 1, 1：全部是實數', -4.5, 4.5);
    cap('例：單位矩陣 I 也是對稱的', '特徵值全是 1');
  },
  async (tok, S) => {
    S.many = DIRS.map(() => arrow(C.gray, 0.035));
    await anim(tok, 900, (t) => S.many.forEach((a, k) => a.set(S.T([0, 0, 0]), S.T(mul(1.2 * t, DIRS[k])))));
    ok(DIRS.every((v) => mv([[1, 0, 0], [0, 1, 0], [0, 0, 1]], v).every((x, i) => near(x, v[i]))), 'Ix = x：每個向量都是特徵向量 ✓', -4.5, 3.9);
    cap('單位矩陣：每個向量都是特徵向量', '那「垂直」是什麼意思？');
  },
  async (tok, S) => {
    gone(S.many);
    S.ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, k) => arrow([C.a, C.b, C.q][k], 0.05));
    await anim(tok, 700, (t) => S.ax.forEach((a, k) => a.set(S.T([0, 0, 0]), S.T(mul(1.2 * t, [[1, 0, 0], [0, 1, 0], [0, 0, 1]][k])))));
    hot('「可以選成」互相垂直', -4.5, 3.3);
    cap('意思是：可以挑出互相垂直的特徵向量', 'can be chosen perpendicular');
  },
  async (tok, S) => {
    gone(S.ax, S.m, S.c);
    S.m = mtag(A3, -4.5, 5.6, 0, 'ptr'); txt(S.iL, '示意 A =');
    const { vals, vecs } = symEig(A3);
    S.lines = vecs.map((v, k) => rod([C.a, C.b, C.q][k], 0.025).set(S.T(mul(-1.3, v)), S.T(mul(1.3, v))));
    S.ll = vecs.map((v, k) => sm('λ ≈ ' + f2(vals[k]), ...S.T(mul(1.5, v)).toArray()));
    ok(residualOK(A3, vals, vecs) && near(dot(vecs[0], vecs[1]), 0) && near(dot(vecs[1], vecs[2]), 0), '三個不同 λ → 三條互相垂直的直線 ✓', -4.3, 2.7);
    cap('一般情況：特徵值都不同', '每個 λ 一條特徵向量直線，三條互相垂直');
  },
  async (tok, S) => {
    gone(S.lines, S.m, S.ll);
    S.m = mtag(B3, -4.5, 5.6, 0, 'ptr');
    const ev = symEig(B3).vals, u = unit([1, -1, 0]), w = [0, 0, 1], q = unit([1, 1, 0]); S.u = u; S.w = w; S.q = q;
    S.line = rod(C.b, 0.025).set(S.T(mul(-1.4, q)), S.T(mul(1.4, q))); sm('λ = 4', ...S.T(mul(1.6, q)).toArray());
    S.pl = planeOf(S.T, u, w, 1.25, C.q);
    const mix = [0.6 * u[0] + 0.8 * w[0], 0.6 * u[1] + 0.8 * w[1], 0.6 * u[2] + 0.8 * w[2]];
    const inPlane = [u, w, mix].every((v) => mv(B3, v).every((x, i) => near(x, 2 * v[i])));
    ok(near(ev[0], 4) && near(ev[1], 2) && near(ev[2], 2) && inPlane, 'λ = 4, 2, 2：λ = 2 的特徵向量鋪滿一整個平面 ✓', -3.0, 1.2);
    cap('重根：λ = 2 出現兩次', '整個平面上的向量都是特徵向量');
  },
  async (tok, S) => {
    const a = arrow(C.q, 0.05), b = arrow(C.a, 0.05);
    await anim(tok, 800, (t) => { a.set(S.T([0, 0, 0]), S.T(mul(1.15 * t, S.u))); b.set(S.T([0, 0, 0]), S.T(mul(1.15 * t, S.w))); });
    rightAngle(S.T([0, 0, 0]), S.T(S.u).sub(S.T([0, 0, 0])), S.T(S.w).sub(S.T([0, 0, 0])), 0.3);
    ok(near(dot(S.u, S.w), 0), '在平面裡挑兩支垂直的 ✓', 3.6, 5.2);
    cap('在這個平面裡，挑兩支互相垂直的', '這就是「可以選成」的自由');
  },
  async (tok, S) => {
    const c = arrow(C.b, 0.05); await anim(tok, 700, (t) => c.set(S.T([0, 0, 0]), S.T(mul(1.15 * t, S.q))));
    const Q = [S.q, S.u, S.w], all = Q.every((x, i) => Q.every((y, j) => near(dot(x, y), i === j ? 1 : 0)));
    ok(all, '完整的一組：3 支互相垂直的單位特徵向量 ✓', 3.6, 4.6);
    cap('對稱矩陣永遠有完整的一組', 'n 個互相垂直的特徵向量');
  },
], [[2.5, 5.0, 10.5], [0, 3.0, 0]]);

// 10 steps
const S2 = [[2, 1], [1, 2]]; // 示意
scene('sp-l25-qlq', 'L25：A = QΛQᵀ（譜定理）', [
  (tok, S) => {
    S.F = hot('A = S Λ S⁻¹', -3.4, 6.0);
    sm('S 的欄 = 特徵向量，Λ = 特徵值', -3.4, 5.4);
    S.P = board2(3.2, 3.0, 0.95, [-2.4, 2.4], [-2.3, 2.3]);
    cap('一般矩陣（有完整特徵向量）', 'A = SΛS⁻¹');
  },
  (tok, S) => {
    sm('A =', -5.6, 4.4); mtag(S2, -4.6, 4.4, 0, 'ptr'); sm('Λ =', -3.2, 4.4); mtag([[3, 0], [0, 1]], -2.2, 4.4, 0, 'ptr alt'); nt('示意', -0.9, 4.4);
    const ev = symEig(S2).vals; ok(near(ev[0], 3) && near(ev[1], 1), 'λ = 3, 1 ✓ 實數，放在對角線', -3.4, 3.5);
    cap('對稱的情況：λ 是實數', '還是放在 Λ 的對角線上');
  },
  async (tok, S) => {
    S.a1 = arrow(C.a, 0.05); S.a2 = arrow(C.q, 0.05);
    await anim(tok, 800, (t) => { S.a1.set(S.P(0, 0), W2(S.P, mul(t, [1, 1]))); S.a2.set(S.P(0, 0), W2(S.P, mul(t, [1, -1]))); });
    S.a1.label('(1, 1)', 'idx'); S.a2.label('(1, −1)', 'idx');
    S.ra = rightAngle(S.P(0, 0), W2(S.P, [1, 1]).sub(S.P(0, 0)), W2(S.P, [1, -1]).sub(S.P(0, 0)), 0.3);
    ok(dot([1, 1], [1, -1]) === 0 && eqM([mv(S2, [1, 1]), mv(S2, [1, -1])], [[3, 3], [1, -1]]), '(1, 1)·(1, −1) = 0 ✓ 互相垂直', 3.2, 0.3);
    cap('特徵向量互相垂直', '');
  },
  async (tok, S) => {
    const s = 1 / Math.SQRT2;
    await anim(tok, 800, (t) => { const k = 1 + (s - 1) * t; S.a1.set(S.P(0, 0), W2(S.P, mul(k, [1, 1]))); S.a2.set(S.P(0, 0), W2(S.P, mul(k, [1, -1]))); });
    S.a1.label('q₁ = (1, 1)/√2', 'idx'); S.a2.label('q₂ = (1, −1)/√2', 'idx');
    ok(near(norm(mul(s, [1, 1])), 1), '長度縮成 1 ✓：orthonormal', 3.2, -0.25);
    cap('再把長度縮成 1', '單位向量 + 互相垂直 = orthonormal');
  },
  (tok, S) => {
    txt(S.F, 'A = Q Λ Q⁻¹');
    sm('Q =', -5.6, 2.6); S.Q = [[1 / Math.SQRT2, 1 / Math.SQRT2], [1 / Math.SQRT2, -1 / Math.SQRT2]]; mtag(S.Q, -4.2, 2.6, 0, 'ptr');
    cap('特徵向量矩陣改叫 Q', 'Q 的欄 = orthonormal 的特徵向量');
  },
  (tok, S) => {
    ok(eqM(mm(tr(S.Q), S.Q), [[1, 0], [0, 1]]), 'QᵀQ = I ✓ ⇒ Q⁻¹ = Qᵀ', -3.4, 1.6);
    cap('Q 的反矩陣就是 Qᵀ', 'orthonormal 的欄 ⇒ QᵀQ = I');
  },
  (tok, S) => {
    txt(S.F, 'A = Q Λ Qᵀ');
    ok(eqM(mm(S.Q, mm([[3, 0], [0, 1]], tr(S.Q))), S2), 'QΛQᵀ = [2 1; 1 2] ✓', -3.4, 1.0);
    cap('對稱矩陣的分解：A = QΛQᵀ', '正交 × 對角 × 正交的轉置');
  },
  (tok, S) => {
    const M = mm(S.Q, mm([[3, 0], [0, 1]], tr(S.Q)));
    ok(eqM(tr(M), M), '(QΛQᵀ)ᵀ = QΛᵀQᵀ = QΛQᵀ ✓ 一定對稱', -3.4, 0.4);
    cap('反過來：這種乘積轉置後不變', '所以一定是對稱的');
  },
  (tok, S) => { sm('spectral theorem（譜定理）', -3.4, -0.2); cap('這叫 spectral theorem（譜定理）', 'spectrum = 特徵值的集合（像光譜）'); },
  async (tok, S) => {
    const cp = circlePts(), ang = Math.PI / 4, L = [[3, 0], [0, 1]];
    poly(cp.map((u) => W2(S.P, u)), '#d8cfc0', true); const sh = poly(cp.map((u) => W2(S.P, u)), C.b, true);
    const draw = (M) => sh.setPts(cp.map((u) => W2(S.P, mv(M, u))));
    await anim(tok, 700, (t) => draw(rotM(-ang * t)));
    await anim(tok, 800, (t) => draw(mm(lerpM([[1, 0], [0, 1]], L, t), rotM(-ang))));
    await anim(tok, 700, (t) => draw(mm(rotM(ang * t), mm(L, rotM(-ang)))));
    hd('principal axis theorem（主軸定理）', 3.2, 5.6);
    ok(eqM(mm(rotM(ang), mm(L, rotM(-ang))), S2), '轉 → 沿主軸伸縮 ×3、×1 → 轉回 = A ✓', 3.2, 5.05);
    cap('力學裡叫 principal axis theorem', '沿著對的軸看，方向之間不互相牽連');
  },
]);

// 12 steps
scene('sp-l25-real', 'L25：為什麼對稱矩陣的特徵值是實數', [
  (tok, S) => {
    const W = 30; S.ln = []; S.put = (k, t, cls = 'idx') => { const l = tag(t.padEnd(W, ' '), cls, -2.7, 6.1 - k * 0.6); Object.assign(l.element.style, MONO); S.ln[k] = l; return l; };
    S.put(0, '(1) Ax = λx', 'ptr');
    S.Pc = cplane(3.9, 3.0, 1.35);
    cap('只能從 Ax = λx 出發', '');
  },
  (tok, S) => {
    S.l = ball(W2(S.Pc, [0.6, 0.7]), C.e, 0.11); S.lt = sm('λ？', ...W2(S.Pc, [0.85, 0.95]).toArray());
    S.nt = nt('示意：還不知道 λ 在哪', 3.9, 0.7);
    cap('目前 λ 可能是複數，x 也可能是', '要證明：λ 其實是實數');
  },
  async (tok, S) => {
    S.put(1, '(2) Āx̄ = λ̄x̄  全部取共軛');
    S.lb = ball(W2(S.Pc, [0.6, 0.7]), C.q, 0.11);
    await anim(tok, 800, (t) => S.lb.position.copy(W2(S.Pc, [0.6, 0.7 - 1.4 * t])));
    S.lbt = sm('λ̄', ...W2(S.Pc, [0.85, -0.95]).toArray()); S.dash = seg(W2(S.Pc, [0.6, 0.7]), W2(S.Pc, [0.6, -0.7]), '#6e5f49', true);
    cap('整條式子取共軛：每個 i 換成 −i', 'a + ib → a − ib');
  },
  (tok, S) => { S.put(2, '    A 是實數 ⇒ Ax̄ = λ̄x̄'); cap('A 是實矩陣，Ā = A', '所以 λ̄ 也是特徵值，特徵向量 x̄'); },
  (tok, S) => {
    const pr = [cx(0, 1), cx(0, -1)].every((l) => cNear(cAdd(cMul(l, l), cx(1)), cx(0)));
    ball(W2(S.Pc, [0, 1]), C.b, 0.08); ball(W2(S.Pc, [0, -1]), C.b, 0.08);
    ok(pr, '旋轉 [0 −1; 1 0]：λ = i 和 −i 成對 ✓', 3.9, 5.3);
    cap('實矩陣的複數特徵值一定成對：λ、λ̄', '');
  },
  (tok, S) => { S.put(3, '(3) x̄ᵀAᵀ = λ̄x̄ᵀ  轉置'); cap('把 (2) 轉置', 'λ̄ 只是一個數，放哪都可以'); },
  (tok, S) => { S.put(4, '    Aᵀ = A ⇒ x̄ᵀA = λ̄x̄ᵀ', 'ptr alt'); cap('這裡用到對稱：Aᵀ = A', ''); },
  (tok, S) => { S.put(5, '(4) x̄ᵀAx = λ x̄ᵀx  (1) 左乘 x̄ᵀ'); cap('(1) 兩邊左乘 x̄ᵀ', ''); },
  (tok, S) => { S.put(6, '(5) x̄ᵀAx = λ̄ x̄ᵀx  (3) 右乘 x'); cap('對稱後的 (3) 兩邊右乘 x', ''); },
  (tok, S) => { hl(S.ln[5], 'ptr alt'); hl(S.ln[6], 'ptr alt'); S.put(7, '(6) λ x̄ᵀx = λ̄ x̄ᵀx  左邊一樣'); cap('(4)、(5) 左邊一模一樣', '所以右邊也相等'); },
  (tok, S) => { hl(S.ln[5], 'idx'); hl(S.ln[6], 'idx'); S.put(8, '(7) x̄ᵀx ≠ 0 ⇒ λ = λ̄', 'ptr'); cap('x̄ᵀx 不是 0，可以約掉', 'λ = λ̄'); },
  async (tok, S) => {
    gone(S.dash, S.lt, S.lbt, S.nt);
    await anim(tok, 900, (t) => { S.l.position.copy(W2(S.Pc, [0.6, 0.7 * (1 - t)])); S.lb.position.copy(W2(S.Pc, [0.6, -0.7 * (1 - t)])); });
    good('λ = λ̄：虛部是 0 → λ 是實數 ✓', 3.9, 5.3);
    cap('一個數等於自己的共軛 → 它是實數', '對稱矩陣的 λ 都是實數');
  },
]);

// 8 steps
const XC = [cx(3, 4), cx(1, -2)]; // 示意
scene('sp-l25-xbarx', 'L25：x̄ᵀx 是複數向量的長度平方', [
  (tok, S) => {
    S.F = hot('x̄ᵀx = ?', -3.2, 6.0);
    sm('x = (x₁, x₂, …, xₙ)：每個分量是複數', -3.2, 5.4); nt('示意 x = (3+4i, 1−2i)', -3.2, 4.85);
    S.P = board2(3.6, 3.0, 0.3, [-5.4, 5.4], [-5.4, 5.4]); sm('Re', ...S.P(5.9, 0).toArray()); sm('Im', ...S.P(0, 5.9).toArray());
    cap('剛才約掉的那個量：x̄ᵀx', '要確定它不是 0');
  },
  (tok, S) => { sm('x̄ᵀ = (x̄₁, …, x̄ₙ)：轉置 + 共軛', -3.2, 4.25); sm('示意：(3−4i, 1+2i)', -3.2, 3.75); cap('x̄ᵀ：轉置，也取共軛', ''); },
  async (tok, S) => {
    const a = arrow(C.a, 0.05); await anim(tok, 700, (t) => a.set(S.P(0, 0), W2(S.P, [3 * t, 4 * t])));
    S.leg = [seg(S.P(0, 0), S.P(3, 0), C.gray, true), seg(S.P(3, 0), S.P(3, 4), C.gray, true)];
    ok(3 * 3 + 4 * 4 === 25, '實數向量 (3, 4)：xᵀx = 9 + 16 = 25 = 5² ✓', -3.2, 3.1);
    S.a = a; cap('平常 xᵀx = x₁² + x₂² + …', '= 長度平方（畢氏定理）');
  },
  (tok, S) => { sm('複數：x̄₁x₁ + x̄₂x₂ + ⋯ + x̄ₙxₙ', -3.2, 2.5); cap('複數向量：每一項都是 x̄ₖxₖ', '其中一個要取共軛'); },
  async (tok, S) => {
    gone(S.leg); S.a.label('3+4i', 'idx');
    const b = arrow(C.q, 0.05); await anim(tok, 700, (t) => b.set(S.P(0, 0), W2(S.P, [3, -4 * t]))); b.label('3−4i', 'idx');
    cap('一個是 a + ib，另一個是 a − ib', '在複數平面上互為鏡像');
  },
  (tok, S) => {
    const p = cMul(cConj(XC[0]), XC[0]);
    ok(cNear(p, cx(25, 0)), '(3−4i)(3+4i) = 9 + 16 = 25 ✓ 虛部消掉', -3.2, 1.9);
    cap('(a − ib)(a + ib) = a² + b²', 'i·(−i) = +1，±iab 互相抵消');
  },
  (tok, S) => {
    const h = cdotH(XC, XC), t = cdotT(XC, XC);
    ok(cNear(h, cx(30, 0)), 'x̄ᵀx = 25 + 5 = 30 > 0 ✓（只有 x = 0 才是 0）', -3.2, 1.3);
    ok(false, '不取共軛：xᵀx = ' + cs(t) + '，不能當長度', -3.2, 0.7);
    cap('每一項都 ≥ 0 → 總和 > 0', '所以可以放心約掉');
  },
  (tok, S) => { txt(S.F, 'x̄ᵀx = ‖x‖²'); cap('複數向量的長度平方 = x̄ᵀx', '下一講會再仔細講'); },
]);

// 7 steps
const HM = [[cx(2), cx(3, 1)], [cx(3, -1), cx(5)]]; // 下一講（L26）老師的例子
scene('sp-l25-good', 'L25：好矩陣：實數用對稱、複數用 Āᵀ = A', [
  (tok, S) => { hot('證明裡用到對稱的地方：Aᵀ = A', -2.6, 5.9); sm('x̄ᵀAᵀ = λ̄x̄ᵀ → x̄ᵀA = λ̄x̄ᵀ', -2.6, 5.3); cap('對稱用在哪？', '轉置那一步'); },
  (tok, S) => { sm('如果 A 是複數：共軛後是 Āx̄ = λ̄x̄', -2.6, 4.6); cap('如果 A 本身是複數', '共軛那一步要寫 Ā'); },
  (tok, S) => { hot('轉置：x̄ᵀĀᵀ = λ̄x̄ᵀ → 需要 Āᵀ = A', -2.6, 4.0); cap('轉置後得到 Āᵀ', '證明要成立，需要 Āᵀ = A'); },
  (tok, S) => { cube('好矩陣：λ 是實數、特徵向量垂直', C.p, [5.6, 0.55, 0.5], 2.4, 2.9, 0, 2); cap('「好矩陣」', '實數 λ ＋ 垂直的特徵向量'); },
  (tok, S) => { cube('實矩陣：A = Aᵀ', C.a, [2.7, 0.5, 0.5], 1.0, 2.1, 0, 2); cap('實矩陣：好 = 對稱', ''); },
  (tok, S) => {
    cube('複矩陣：Āᵀ = A', C.q, [2.7, 0.5, 0.5], 3.9, 2.1, 0, 2);
    sm('A =', -5.4, 2.6); mtag(cmat(HM), -3.9, 2.6, 0, 'ptr alt'); nt('示意（下一講的例子）', -3.9, 1.95);
    const tr2 = 7, dt = cMul(HM[0][0], HM[1][1]).re - cAbs2(HM[0][1]), disc = Math.sqrt(tr2 * tr2 - 4 * dt), l1 = (tr2 + disc) / 2, l2 = (tr2 - disc) / 2;
    const v7 = [cx(3, 1), cx(5)], v0 = [cx(3, 1), cx(-2)];
    const eig = cmv(HM, v7).every((z, i) => cNear(z, cMul(cx(7), v7[i]))) && cmv(HM, v0).every((z) => cNear(z, cx(0)));
    ok(cHerm(HM).every((r, i) => r.every((z, j) => cNear(z, HM[i][j]))) && near(l1, 7) && near(l2, 0) && eig, 'Āᵀ = A；λ = 7、0 都是實數 ✓', -3.9, 1.35);
    cap('複矩陣：轉置再共軛要等於自己', 'Āᵀ = A');
  },
  (tok, S) => { sm('99% 的應用都是實矩陣 → 對稱是關鍵', 2.4, 1.2); cap('絕大多數應用是實矩陣', '對稱就是關鍵性質'); },
]);

// 8 steps
scene('sp-l25-proj', 'L25：A = λ₁q₁q₁ᵀ + λ₂q₂q₂ᵀ（投影的組合）', [
  (tok, S) => {
    S.F = hot('A = [q₁ q₂] [λ₁ 0; 0 λ₂] [q₁ᵀ; q₂ᵀ]', -2.8, 6.0); nt('示意 A = [2 1; 1 2]：λ = 3, 1', -2.8, 5.4);
    S.P = board2(3.4, 3.0, 1.2, [-1.6, 2.3], [-1.5, 1.9]);
    cap('把 QΛQᵀ 拆開來看', '');
  },
  (tok, S) => { sm('ΛQᵀ 的第一列 = λ₁q₁ᵀ', -2.8, 4.8); cap('Λ 乘 Qᵀ：第一列是 λ₁q₁ᵀ', ''); },
  (tok, S) => {
    txt(S.F, 'A = λ₁q₁q₁ᵀ + λ₂q₂q₂ᵀ');
    const q1 = unit([1, 1]), q2 = unit([1, -1]); S.q1 = q1; S.q2 = q2;
    S.P1 = [[q1[0] * q1[0], q1[0] * q1[1]], [q1[1] * q1[0], q1[1] * q1[1]]]; S.P2 = [[q2[0] * q2[0], q2[0] * q2[1]], [q2[1] * q2[0], q2[1] * q2[1]]];
    hd('3 ·', -6.1, 3.45); mtag(S.P1, -4.8, 3.8, 0, 'ptr'); hd('+ 1 ·', -3.25, 3.45); mtag(S.P2, -1.7, 3.8, 0, 'ptr');
    const sum = S.P1.map((r, i) => r.map((v, j) => 3 * v + S.P2[i][j]));
    ok(eqM(sum, S2), '= [2 1; 1 2] ✓', -3.4, 2.9);
    cap('欄 × 列：一次一項', 'λ₁q₁q₁ᵀ + λ₂q₂q₂ᵀ');
  },
  (tok, S) => { sm('每個對稱矩陣都拆成這樣的小塊', -3.4, 2.3); cap('每個對稱矩陣都能這樣拆', '實數 λ × orthonormal 特徵向量'); },
  async (tok, S) => {
    rod(C.a, 0.02).set(W2(S.P, mul(-1.5, S.q1)), W2(S.P, mul(2.5, S.q1))); sm('q₁', ...W2(S.P, mul(2.7, S.q1)).toArray());
    S.x = arrow(C.b, 0.05); await anim(tok, 600, (t) => S.x.set(S.P(0, 0), W2(S.P, [t, 0]))); S.x.label('x = (1, 0) 示意', 'idx');
    cap('單位向量 × 自己的轉置：qqᵀ', '這是什麼矩陣？');
  },
  async (tok, S) => {
    const p = mv(S.P1, [1, 0]); S.p = p;
    seg(W2(S.P, [1, 0]), W2(S.P, p), '#6e5f49', true);
    S.pa = arrow(C.a, 0.05); await anim(tok, 700, (t) => S.pa.set(S.P(0, 0), W2(S.P, mul(t, p)))); S.pa.label('q₁q₁ᵀx', 'idx');
    hd('q₁q₁ᵀ = 投影矩陣（projection）', 3.4, 5.6);
    cap('qqᵀ 是投影矩陣', '把 x 投影到 q 那條直線上');
  },
  (tok, S) => {
    ok(eqM(mm(S.P1, S.P1), S.P1) && eqM(tr(S.P1), S.P1), 'P² = P、Pᵀ = P ✓（因為 q₁ᵀq₁ = 1）', 3.4, 5.05);
    cap('對稱，而且平方後不變', 'q₁ᵀq₁ = 1');
  },
  async (tok, S) => {
    rod(C.q, 0.02).set(W2(S.P, mul(-1.4, S.q2)), W2(S.P, mul(1.4, S.q2)));
    const p2 = mv(S.P2, [1, 0]), b = arrow(C.q, 0.045); await anim(tok, 500, (t) => b.set(S.P(0, 0), W2(S.P, mul(t, p2))));
    const r = arrow(C.e, 0.06), Ax = mv(S2, [1, 0]);
    await anim(tok, 800, (t) => r.set(S.P(0, 0), W2(S.P, mul(t, add(mul(3, S.p), p2)))));
    ok(eqM([add(mul(3, S.p), p2)], [Ax]), '3·(1/2, 1/2) + 1·(1/2, −1/2) = (2, 1) = Ax ✓', 3.4, 0.5);
    cap('對稱矩陣 = 互相垂直的投影的組合', '每個方向乘上自己的 λ');
  },
]);

// 9 steps
const B3s = [[1, 2, 0], [2, 1, 0], [0, 0, 3]]; // 示意
scene('sp-l25-signs', 'L25：pivots 的正負號 = 特徵值的正負號', [
  (tok, S) => { S.F = hot('λ 是實數 → 正的還是負的？', -2.4, 6.0); cap('λ 是實數，接著問：正或負？', ''); },
  (tok, S) => { S.t2 = sm('微分方程：λ 的正負決定穩定或不穩定', -2.4, 5.4); cap('微分方程裡，這決定穩不穩定', ''); },
  (tok, S) => {
    S.g = []; for (let k = 0; k < 50; k++) S.g.push(cube('', C.gray, [0.32, 0.32, 0.32], -4.5 + (k % 10) * 0.42, 3.9 - Math.floor(k / 10) * 0.42, 0));
    S.t50 = sm('50×50：50 個特徵值', -2.6, 1.6);
    cap('50×50 的矩陣：要算 50 個特徵值', '手算是一輩子的工作');
  },
  (tok, S) => { S.bd = bad('det(A − λI) = 0：50 次多項式求根 → 很不穩定 ✘', 2.6, 4.4); cap('解 50 次多項式？', '很糟、很不穩定的方法'); },
  (tok, S) => { S.gd = good('消去法求 50 個 pivots：又快又穩 ✓', 2.6, 3.7); cap('但 MATLAB 很樂意算 50 個 pivots', 'pivots ≠ 特徵值，可是……'); },
  async (tok, S) => {
    for (let k = 0; k < 50; k++) { S.g[k].material.color.set(k < 28 ? C.p : C.e); if (k % 10 === 9) await wt(tok, 60); }
    S.t28 = sm('28 個 pivots > 0、22 個 < 0 ⇒ 28 個 λ > 0、22 個 λ < 0', -2.6, 1.0);
    cap('28 個正 pivots → 28 個正特徵值', '22 個負的 → 22 個負的');
  },
  (tok, S) => {
    gone(S.g, S.t50, S.bd, S.gd, S.t28, S.t2);
    const pv = pivots(B3s), ev = symEig(B3s).vals; S.pv = pv; S.ev = ev;
    mtag(B3s, -4.6, 3.9, 0, 'ptr'); nt('示意 A', -4.6, 2.9);
    pv.forEach((v, k) => bar(-2.6 + k * 0.75, 2.3, v, frac(v))); sm('pivots', -1.85, 0.2);
    ev.forEach((v, k) => bar(0.2 + k * 0.75, 2.3, v, f2(v))); sm('特徵值', 0.95, 0.2);
    const cnt = (a) => a.filter((v) => v > 1e-9).length;
    ok(cnt(pv) === cnt(ev) && pv.length - cnt(pv) === ev.length - cnt(ev), '正的個數 2 = 2、負的個數 1 = 1 ✓', -0.8, -0.5);
    cap('對稱矩陣：pivots 的正負號 = λ 的正負號', '數值不同，個數相同');
  },
  (tok, S) => {
    const sh = B3s.map((r, i) => r.map((v, j) => v - (i === j ? 2 : 0))), pv = pivots(sh);
    pv.forEach((v, k) => bar(3.0 + k * 0.75, 2.3, v, frac(v))); sm('A − 2I 的 pivots', 3.75, 0.2);
    const neg = pv.filter((v) => v < -1e-9).length, below = S.ev.filter((v) => v < 2).length;
    ok(neg === below, '1 個負 pivot ⇒ A 有 1 個 λ < 2 ✓', 3.75, 4.5); nt('老師說移 7I；這裡用 2I 示意', 3.75, 5.0);
    cap('把 A 移成 A − 7I（這裡用 2I）', '數 pivots 就知道幾個 λ 比 7 小');
  },
  (tok, S) => {
    const pp = S.pv.reduce((a, b) => a * b, 1), pe = S.ev.reduce((a, b) => a * b, 1);
    ok(near(pp, det(B3s)) && near(pe, det(B3s), 1e-8), 'pivots 乘積 = λ 乘積 = det = ' + frac(det(B3s)) + ' ✓', -1.6, 5.35);
    cap('乘積一樣：都等於 det', '但正負號的事實多告訴我們每一個的符號');
  },
]);

// 12 steps
const A5 = [[5, 2], [2, 3]];
scene('sp-l25-pd', 'L25：正定矩陣入門：[5 2; 2 3]', [
  (tok, S) => { hot('positive definite（正定）矩陣', -2.8, 6.0); cap('最後幾分鐘：正定矩陣', ''); },
  (tok, S) => { sm('首先：一定是對稱的', -2.8, 5.4); cap('首先，它一定是對稱的', ''); },
  (tok, S) => { cube('對稱矩陣（好）', C.a, [4.2, 0.5, 0.5], 3.0, 5.5, 0, 2); cube('正定（最棒）', C.p, [2.4, 0.5, 0.5], 3.0, 4.9, 0, 2); cap('對稱矩陣是好的', '正定是其中最棒的一群'); },
  (tok, S) => { S.t1 = sm('① 所有特徵值 > 0', -2.8, 4.7); cap('測試一：所有 λ > 0', ''); },
  (tok, S) => { S.t2 = sm('② 所有 pivots > 0 ？', -2.8, 4.15); cap('pivots 呢？', ''); },
  (tok, S) => { sm('A =', -5.6, 3.1); mtag(A5, -4.6, 3.1, 0, 'ptr'); ok(eqM(A5, tr(A5)), '對稱 ✓', -5.9, 2.5); cap('例子：A = [5 2; 2 3]', '對稱，λ 一定是實數'); },
  (tok, S) => { txt(S.t2, '② 所有 pivots > 0（和 λ 同號）'); cap('pivot 和 λ 同號', '所以 λ 全正 ⇔ pivots 全正'); },
  (tok, S) => { S.pv = pivots(A5); S.b1 = bar(-2.4, 1.0, S.pv[0], '5'); sm('pivots', -2.0, 0.3); cap('第一個 pivot：5', ''); },
  (tok, S) => {
    bar(-1.6, 1.0, S.pv[1], '11/5');
    ok(near(det(A5), 11) && near(S.pv[1], 11 / 5) && near(S.pv[0] * S.pv[1], 11), 'det = 15 − 4 = 11 ⇒ 第二個 pivot = 11/5 ✓', -2.0, -0.4);
    cap('pivots 乘積 = det = 11', '第二個 pivot = 11/5，兩個都 > 0');
  },
  (tok, S) => { ok(5 + 3 === 8 && near(det(A5), 11), 'λ² − 8λ + 11 = 0（8 = trace、11 = det）✓', 2.4, 3.4); cap('特徵方程式：λ² − 8λ + 11 = 0', 'trace 8、det 11'); },
  (tok, S) => {
    const ev = symEig(A5).vals; bar(1.8, 1.0, ev[0], '4 + √5'); bar(2.6, 1.0, ev[1], '4 − √5'); sm('特徵值', 2.2, 0.3);
    ok(near(ev[0], 4 + Math.sqrt(5)) && near(ev[1], 4 - Math.sqrt(5)), 'λ = 4 ± √5 ≈ ' + f2(ev[0]) + '、' + f2(ev[1]) + ' 都 > 0 ✓', 2.4, -0.4);
    cap('λ = 4 ± √5，都是正的', '算起來不漂亮，pivots 簡單多了');
  },
  (tok, S) => { sm('微分方程：知道 λ 的正負 → 知道穩不穩定', 2.4, 4.05); cap('微分方程最想要的就是這種矩陣', ''); },
]);

// 10 steps
const BN = [[-1, 0], [0, -3]];
scene('sp-l25-dets', 'L25：行列式測試要看「每個左上角」', [
  (tok, S) => { hot('行列式呢？', -3.0, 6.0); sm('A =', -5.6, 4.9); mtag(A5, -4.6, 4.9, 0, 'ptr'); cap('再加一個相關的事實：行列式', ''); },
  (tok, S) => { const ev = symEig(A5).vals; ok(near(ev[0] * ev[1], det(A5)) && det(A5) > 0, '正定 ⇒ det = λ₁λ₂ = 11 > 0 ✓', -3.0, 4.0); cap('λ 全正 → det 也是正的', ''); },
  (tok, S) => { sm('B =', 1.2, 4.9); mtag(BN, 2.3, 4.9, 0, 'ptr alt'); cap('可是看這個：B = [−1 0; 0 −3]', ''); },
  (tok, S) => { ok(det(BN) === 3, 'det B = 3 > 0 ✓', 2.3, 4.0); cap('B 的行列式也是正的：3', ''); },
  (tok, S) => {
    pivots(BN).forEach((v, k) => bar(1.5 + k * 0.7, 2.9, v, frac(v))); sm('pivots', 1.85, 3.45);
    symEig(BN).vals.forEach((v, k) => bar(3.4 + k * 0.7, 2.9, v, frac(v))); sm('特徵值', 3.75, 3.45);
    bad('pivots、λ 都是負的 → 不是正定 ✘', 2.6, 0.75);
    cap('B 的 pivots 和 λ 都是負的', '只看整個 det 不夠');
  },
  (tok, S) => { sm('還要看左上角的小行列式：1×1、2×2', -3.0, 3.3); cap('要檢查左上角的「子行列式」', '從左上往下'); },
  (tok, S) => { hot('③ 所有左上子行列式 > 0', -3.0, 2.7); cap('全部 n 個都要 > 0', '不是只有最大的那個'); },
  (tok, S) => { const m = minors(A5); ok(m[0] === 5 && m[1] === 11, 'A：5 > 0、11 > 0 → 通過 ✓', -3.0, 2.0); cap('A：5 和 11 都 > 0', '通過'); },
  (tok, S) => { const m = minors(BN); ok(false, 'B：−1 < 0 → 不通過 ✓（雖然 det = ' + m[1] + '）', -3.0, 1.4); cap('B：第一個就是 −1', '不通過'); },
  (tok, S) => { cube('pivots', C.a, [1.5, 0.5, 0.5], -3.4, -0.2, 0, 2); cube('行列式', C.b, [1.5, 0.5, 0.5], -1.6, -0.2, 0, 2); cube('特徵值', C.q, [1.5, 0.5, 0.5], 0.2, -0.2, 0, 2); cap('pivots、行列式、特徵值', '在對稱矩陣這裡全部連起來'); },
]);

// ═════════════════════════ MIT 18.06 L26：Complex Matrices; Fast Fourier Transform ═════════════════════════
const { relabel } = P;
const I_ = cx(0, 1);
const fourier = (n) => { const w = cExp((2 * Math.PI) / n); return Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, k) => cPow(w, j * k))); };
const colC = (M, j) => M.map((r) => r[j]);
// 8 steps
scene('sp-l26-intro', 'L26：複數進場：Fourier 矩陣與 FFT', [
  (tok, S) => { S.F = hot('這一講：複數向量、複數矩陣', -3.2, 6.0); cap('這一講複數要正式進場', ''); },
  async (tok, S) => {
    S.Pc = cplane(3.7, 3.4, 1.3);
    const chk = [I_, cx(0, -1)].every((l) => cNear(cAdd(cMul(l, l), cx(1)), cx(0)));
    for (const [y, t] of [[1, 'i'], [-1, '−i']]) { const b = ball(W2(S.Pc, [0, 0]), C.e, 0.11); await anim(tok, 500, (u) => b.position.copy(W2(S.Pc, [0, y * u]))); sm(t, ...W2(S.Pc, [0.3, y]).toArray()); }
    ok(chk, '實矩陣 [0 −1; 1 0]：λ² + 1 = 0 → λ = ±i ✓', 3.7, 0.9);
    cap('實矩陣也可能有複數特徵值', '例如旋轉 90°');
  },
  (tok, S) => { sm('複數向量的長度？兩個複數向量的內積？', -3.2, 5.4); cap('向量、矩陣變成複數時要改什麼？', '長度、內積'); },
  (tok, S) => { cube('Fourier 矩陣 F', C.a, [2.6, 0.55, 0.5], -3.6, 4.6, 0, 2); cap('最重要的複數矩陣：Fourier 矩陣', ''); },
  (tok, S) => { cube('FFT', C.b, [1.2, 0.55, 0.5], -1.4, 4.6, 0, 2); cap('還有 FFT：fast Fourier transform', '每台電腦裡都在用'); },
  (tok, S) => {
    S.g = []; for (let j = 0; j < 8; j++) for (let k = 0; k < 8; k++) S.g.push(cube('', C.a, [0.3, 0.3, 0.3], -5.0 + k * 0.38, 3.5 - j * 0.38, 0));
    sm('n×n 全滿 → 乘一次要 n² = 64 次乘法', -3.7, 0.15);
    cap('乘一個 n×n 的滿矩陣：n² 次乘法', '這裡 n = 8：64 個');
  },
  (tok, S) => { good('而且它的欄（columns）互相正交 ✓', -2.6, -0.45); cap('它的欄互相正交', '幾乎是「最好的矩陣」'); },
  async (tok, S) => {
    const keep = 8 * Math.log2(8);
    for (let k = keep; k < 64; k++) { S.g[k].material.color.set('#ece3d3'); if (k % 8 === 7) await wt(tok, 60); }
    hot('FFT：n² → n log₂ n（8 × 3 = ' + keep + '）', -3.7, -1.05);
    cap('FFT 把 n² 降成 n log n', '這一招改變了整個產業');
  },
]);

// 13 steps
const Z1 = [cx(1), cx(0, 1)];
scene('sp-l26-length', 'L26：複數向量的長度：z̄ᵀz = zᴴz', [
  (tok, S) => { S.F = hot('複數向量 z 的長度？', -3.4, 6.0); cap('重點：長度怎麼算？', ''); },
  (tok, S) => {
    sm('z = (z₁, z₂, …, zₙ) 在 Cⁿ 裡', -3.4, 5.4);
    S.p1 = cplane(1.9, 2.6, 0.8); S.p2 = cplane(4.6, 2.6, 0.8); hd('z₁', 1.9, 4.1); hd('z₂', 4.6, 4.1);
    cap('z 的每個分量都是複數', '不在 Rⁿ，而在 Cⁿ');
  },
  (tok, S) => { S.l1 = sm('zᵀz = z₁² + ⋯ + zₙ²？', -3.4, 4.8); cap('zᵀz 行不行？', '長度平方一定要是正的'); },
  async (tok, S) => {
    S.a1 = arrow(C.a, 0.045); S.a2 = arrow(C.a, 0.045);
    await anim(tok, 700, (t) => { S.a1.set(S.p1(0, 0), W2(S.p1, [t, 0])); S.a2.set(S.p2(0, 0), W2(S.p2, [0, t])); });
    S.a1.label('1', 'idx'); S.a2.label('i', 'idx');
    const zt = cdotT(Z1, Z1);
    ok(false, 'z = (1, i)：zᵀz = 1 + i² = ' + cs(zt) + '，可是 z ≠ 0', -3.4, 4.2);
    cap('例：z = (1, i)', 'zᵀz = 1 + i² = 0，不對！');
  },
  (tok, S) => { sm('要的是 z̄₁z₁ = |z₁|²', -3.4, 3.6); cap('真正要的是 z̄₁z₁', '= |z₁|²，像 3²、5² 那樣'); },
  async (tok, S) => {
    const b = arrow(C.q, 0.045); await anim(tok, 600, (t) => b.set(S.p2(0, 0), W2(S.p2, [0, -t]))); b.label('ī = −i', 'idx');
    ok(cNear(cMul(cConj(I_), I_), cx(1)), '(−i)(i) = 1 ✓', 4.6, 0.9);
    cap('分量 i：共軛是 −i', '(−i)·i = +1');
  },
  (tok, S) => { sm('z̄ᵀz = |z₁|² + |z₂|² + ⋯ + |zₙ|²', -3.4, 3.0); cap('z̄ᵀz：每一項都是模長平方', ''); },
  (tok, S) => { sm('= 0 只發生在 z = 0', -3.4, 2.4); cap('只有零向量是 0', '其他向量都 > 0：正確的長度'); },
  (tok, S) => { const h = cdotH(Z1, Z1); ok(cNear(h, cx(2)), 'z = (1, i)：z̄ᵀz = 1 + 1 = 2 → 長度 √2 ✓', -3.4, 1.8); cap('z = (1, i) 的長度', '1 + 1 = 2，長度 √2'); },
  (tok, S) => { txt(S.F, 'zᴴz = z̄ᵀz（H：Hermitian）'); cap('轉置時一律取共軛：記成 H', 'zᴴ 念 z Hermitian（數學家 Hermite）'); },
  (tok, S) => { sm('內積：yᴴx（不再是 yᵀx）', -3.4, 1.2); cap('內積：yᴴx', '轉置的那個要取共軛'); },
  (tok, S) => { const y = [cx(1), cx(1)], h = cdotH(y, Z1); nt('示意 y = (1, 1)、x = (1, i)：yᴴx = ' + cs(h), -3.4, 0.6); cap('內積通常是複數', ''); },
  (tok, S) => { good('y = x = z：zᴴz = ‖z‖² ✓', -3.4, 0.0); cap('自己跟自己的內積 = 長度平方', '這個定義是被逼出來的'); },
]);

// 14 steps
const HM2 = [[cx(2), cx(3, 1)], [cx(3, -1), cx(5)]];
scene('sp-l26-herm', 'L26：Hermitian（Aᴴ = A）與 unitary（QᴴQ = I）', [
  (tok, S) => { S.F = hot('對稱矩陣的複數版本？', -3.0, 6.0); cap('還要改「對稱」的定義', ''); },
  (tok, S) => { sm('實數：Aᵀ = A（複數時不夠好）', -3.0, 5.4); cap('對稱：Aᵀ = A', '複數矩陣這樣不行'); },
  (tok, S) => { txt(S.F, '複數版對稱：Āᵀ = A'); cap('要轉置「再取共軛」等於自己', ''); },
  (tok, S) => { sm('A =', -5.6, 4.0); S.m = mtag([['2', '·'], ['·', '5']], -4.4, 4.0, 0, 'ptr'); cap('對角線必須是實數', '翻過去、取共軛還要是自己'); },
  (tok, S) => { gone(S.m); S.m = mtag(cmat(HM2), -4.2, 4.0, 0, 'ptr'); sm('3+i 翻過去 → 共軛 3−i', -4.2, 3.2); cap('右上 3+i ⇒ 左下一定是 3−i', ''); },
  (tok, S) => { const h = cHerm(HM2).every((r, i) => r.every((z, j) => cNear(z, HM2[i][j]))); ok(h, 'Aᴴ = A ✓：Hermitian 矩陣', -4.2, 2.5); cap('這種矩陣叫 Hermitian', 'Aᴴ = A'); },
  (tok, S) => {
    const t = 7, d = cMul(HM2[0][0], HM2[1][1]).re - cAbs2(HM2[0][1]), r = Math.sqrt(t * t - 4 * d); S.ev = [(t + r) / 2, (t - r) / 2];
    ok(near(S.ev[0], 7) && near(S.ev[1], 0), 'λ² − 7λ + 0 = 0 → λ = 7、0：實數 ✓（程式算）', -2.2, 1.8);
    cap('Hermitian 矩陣的特徵值是實數', '');
  },
  (tok, S) => {
    const v7 = [cx(3, 1), cx(5)], v0 = [cx(3, 1), cx(-2)];
    const e = cmv(HM2, v7).every((z, i) => cNear(z, cMul(cx(7), v7[i]))) && cmv(HM2, v0).every((z) => cNear(z, cx(0)));
    ok(e && cNear(cdotH(v0, v7), cx(0)), 'x₇ = (3+i, 5)、x₀ = (3+i, −2)：x₀ᴴx₇ = 0 ✓', -2.2, 1.2);
    cap('特徵向量互相垂直', '垂直要用 xᴴy = 0 來檢查');
  },
  (tok, S) => { S.d = hot('q₁, q₂, …, qₙ：互相垂直的單位向量', 3.2, 5.4); cap('垂直的單位向量 q₁ … qₙ', 'orthonormal basis'); },
  (tok, S) => { sm('q̄ᵢᵀqⱼ = qᵢᴴqⱼ = 0（i ≠ j）、1（i = j）', 3.2, 4.8); cap('檢查垂直：qᵢᴴqⱼ', '轉置之外還要共軛'); },
  (tok, S) => {
    const v0 = [cx(3, 1), cx(-2)], v7 = [cx(3, 1), cx(5)], n0 = Math.sqrt(cdotH(v0, v0).re), n7 = Math.sqrt(cdotH(v7, v7).re);
    const Q = [[cMul(v0[0], cx(1 / n0)), cMul(v7[0], cx(1 / n7))], [cMul(v0[1], cx(1 / n0)), cMul(v7[1], cx(1 / n7))]];
    ok(cEye(cmm(cHerm(Q), Q)), 'QᵀQ = I → QᴴQ = I ✓（用上面兩個特徵向量 ÷ 長度 √14、√35）', 3.2, 4.2);
    cap('原本 QᵀQ = I', '現在變成 QᴴQ = I');
  },
  (tok, S) => {
    const rows = [['Rⁿ', 'Cⁿ'], ['xᵀy', 'xᴴy'], ['‖x‖² = xᵀx', '‖x‖² = xᴴx'], ['對稱 Aᵀ = A', 'Hermitian Aᴴ = A']];
    rows.forEach(([a, b], k) => { sm(a, 2.2, 3.4 - k * 0.5); sm('→', 3.5, 3.4 - k * 0.5); sm(b, 4.9, 3.4 - k * 0.5); });
    cap('實數 ↔ 複數 的對照字典', '');
  },
  (tok, S) => { sm('正交 QᵀQ = I', 2.2, 1.4); sm('→', 3.5, 1.4); hot('unitary QᴴQ = I', 4.9, 1.4); cap('orthogonal 也改名：unitary', ''); },
  (tok, S) => { good('unitary：方陣、欄互相垂直、長度 1（用共軛算）', 3.4, 0.7); cap('unitary 矩陣', '就是複數版的正交矩陣'); },
]);

// 10 steps
const W6 = cExp((2 * Math.PI) / 6);
scene('sp-l26-fourier', 'L26：Fourier 矩陣 (F)ⱼₖ = wʲᵏ', [
  (tok, S) => { S.F = hot('Fourier 矩陣：最有名的複數矩陣', 3.4, 6.0); cap('最有名的複數矩陣', '它的欄互相正交'); },
  (tok, S) => {
    S.c = []; for (let j = 0; j < 6; j++) { S.c.push([]); for (let k = 0; k < 6; k++) S.c[j].push(cube('', '#e6dccb', [0.62, 0.62, 0.3], -3.4 + k * 0.72, 5.0 - j * 0.72, 0)); }
    nt('n = 6 示意', -1.6, 0.4);
    cap('先看 n×n 的情況', '');
  },
  (tok, S) => { for (let j = 0; j < 6; j++) { relabel(S.c[j][0], '1'); glow(S.c[j][0], '#3a2a00'); } cap('第一欄：全部是 1', ''); },
  (tok, S) => { for (let k = 0; k < 6; k++) { sm(String(k), -3.4 + k * 0.72, 5.6); sm(String(k), -4.1, 5.0 - k * 0.72); } sm('從 0 開始數（電機系習慣）', 3.4, 5.4); cap('電機系從 0 開始數', '第 0 欄、第 1 欄 … 第 n−1 欄'); },
  (tok, S) => { for (let j = 0; j < 6; j++) { glow(S.c[j][0], null); relabel(S.c[j][1], j ? 'w' + (j > 1 ? sup(j) : '') : '1'); glow(S.c[j][1], '#3a2a00'); } cap('第 1 欄：1, w, w², …, wⁿ⁻¹', 'w 的次方'); },
  (tok, S) => { for (let j = 0; j < 6; j++) { glow(S.c[j][1], null); relabel(S.c[j][2], j ? 'w' + sup(2 * j) : '1'); glow(S.c[j][2], '#3a2a00'); } cap('第 2 欄：w² 的次方', '1, w², w⁴, w⁶, …'); },
  (tok, S) => {
    for (let j = 0; j < 6; j++) { glow(S.c[j][2], null); for (let k = 0; k < 6; k++) relabel(S.c[j][k], j * k ? 'w' + (j * k > 1 ? sup(j * k) : '') : '1'); }
    const F = fourier(6); ok(F.every((r, j) => r.every((z, k) => cNear(z, F[k][j]))), 'Fᵀ = F ✓（對稱，但不是 Hermitian）', 3.4, 4.8);
    cap('沿著列看也一樣：F 是對稱的', '數字是複數，所以不是 Hermitian');
  },
  (tok, S) => { glow(S.c[2][3], '#5a1a00'); hot('(F)ⱼₖ = wʲᵏ（j, k 從 0 到 n−1）', 3.4, 4.2); sm('例：第 2 列、第 3 欄 = w⁶', 3.4, 3.6); cap('第 j 列、第 k 欄的元素 = w 的 jk 次方', ''); },
  (tok, S) => { ok(cNear(cPow(W6, 6), cx(1)), 'wⁿ = 1 ✓（n = 6：w⁶ = 1）', 3.4, 2.9); cap('w 是 n 次方等於 1 的那個特別的數', ''); },
  (tok, S) => { hd('w = e^(i·2π/n)', 3.4, 2.2); cap('w = e 的 i 乘 2π/n 次方', '角度 2π/n'); },
]);

// 10 steps
scene('sp-l26-roots', 'L26：單位根：w⁶ = 1、F₄ 的 w = i', [
  async (tok, S) => {
    S.Pc = cplane(0.6, 3.0, 2.0); S.b = [];
    S.w = ball(W2(S.Pc, [1, 0]), C.e, 0.13);
    await anim(tok, 700, (t) => S.w.position.copy(W2(S.Pc, [Math.cos((t * Math.PI) / 3), Math.sin((t * Math.PI) / 3)])));
    S.wl = sm('w', ...W2(S.Pc, [0.65, 1.0]).toArray());
    cap('w 在複數平面的單位圓上', '');
  },
  (tok, S) => {
    const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
    S.d = [seg(W2(S.Pc, [c, s]), W2(S.Pc, [c, 0]), '#6e5f49', true), seg(W2(S.Pc, [c, s]), W2(S.Pc, [0, s]), '#6e5f49', true)];
    sm('w = cos(2π/n) + i sin(2π/n)', -4.4, 5.6);
    cap('寫成實部 + 虛部', 'cos(2π/n) + i sin(2π/n)');
  },
  (tok, S) => { gone(S.d); hot('取次方用 e^(iθ)：w¹⁰ = e^(i·20π/n)', -4.0, 5.0); cap('但取次方時，用 e^(iθ) 的形式', '角度直接乘 10'); },
  (tok, S) => { const arc = []; for (let k = 0; k <= 20; k++) { const a = (k / 20) * (Math.PI / 3); arc.push(W2(S.Pc, [0.35 * Math.cos(a), 0.35 * Math.sin(a)])); } poly(arc, C.b); sm('60°', ...W2(S.Pc, [0.5, 0.2]).toArray()); hd('n = 6：w = e^(2πi/6)', -4.0, 4.4); cap('n = 6：w 在 60°', '繞一圈的六分之一'); },
  async (tok, S) => {
    const b = ball(S.w.position.clone(), C.q, 0.11); S.b.push(b);
    await anim(tok, 700, (t) => { const a = (Math.PI / 3) * (1 + t); b.position.copy(W2(S.Pc, [Math.cos(a), Math.sin(a)])); });
    sm('w²', ...W2(S.Pc, [-0.62, 1.05]).toArray()); ok(near(cAbs2(cPow(W6, 2)), 1), '|w²| = 1，角度加倍到 120° ✓', -4.0, 3.8);
    cap('平方：長度還是 1，角度加倍', 'w² 在 120°');
  },
  async (tok, S) => {
    for (let k = 3; k <= 5; k++) { const a = (k * Math.PI) / 3, b = ball(W2(S.Pc, [Math.cos(a), Math.sin(a)]), C.q, 0.11); S.b.push(b); sm('w' + sup(k), ...W2(S.Pc, [1.25 * Math.cos(a), 1.2 * Math.sin(a)]).toArray()); await wt(tok, 250); }
    cap('w³、w⁴、w⁵ 一個接一個', '每次再轉 60°');
  },
  (tok, S) => { const b = ball(W2(S.Pc, [1, 0]), C.p, 0.13); S.b.push(b); sm('w⁶ = 1', ...W2(S.Pc, [1.3, -0.15]).toArray()); ok(cNear(cPow(W6, 6), cx(1)), 'w⁶ = 1 ✓ 回到原點', -4.0, 3.2); cap('w⁶ 轉回 1', ''); },
  (tok, S) => { S.hex = poly([0, 1, 2, 3, 4, 5].map((k) => W2(S.Pc, [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)])), C.q, true); sm('1 的六個 6 次方根；w 是 primitive（第一個）', -4.0, 2.6); cap('1 的六個六次方根', 'w 是 primitive root'); },
  (tok, S) => {
    gone(S.b, S.hex, S.w, S.wl);
    const w4 = cExp(Math.PI / 2); S.w4 = w4;
    S.w = ball(W2(S.Pc, [0, 1]), C.e, 0.13);
    ok(cNear(w4, I_), 'n = 4：w = e^(2πi/4) = e^(iπ/2) = i ✓', -4.0, 1.9);
    cap('換成 n = 4', 'w = i：四分之一圈');
  },
  async (tok, S) => {
    const pts = [[0, 1], [-1, 0], [0, -1], [1, 0]], nm = ['i', 'i² = −1', 'i³ = −i', 'i⁴ = 1'];
    for (let k = 1; k < 4; k++) { ball(W2(S.Pc, pts[k]), C.q, 0.11); sm(nm[k], ...W2(S.Pc, [pts[k][0] * 1.4, pts[k][1] * 1.25]).toArray()); await wt(tok, 250); }
    ok([1, 2, 3, 4].every((k) => cNear(cPow(S.w4, k), [I_, cx(-1), cx(0, -1), cx(1)][k - 1])), 'w, w², w³, w⁴ = i, −1, −i, 1 ✓', -4.0, 1.3);
    cap('次方：i、−1、−i、1', '');
  },
]);

// 14 steps
const F4 = fourier(4);
scene('sp-l26-f4', 'L26：F₄ 的欄互相正交，反矩陣 = 共軛轉置', [
  (tok, S) => {
    S.c = []; for (let j = 0; j < 4; j++) { S.c.push([]); for (let k = 0; k < 4; k++) S.c[j].push(cube(j * k ? 'i' + (j * k > 1 ? sup(j * k) : '') : '1', '#e6dccb', [0.75, 0.75, 0.3], -4.6 + k * 0.88, 4.8 - j * 0.88, 0)); }
    sm('F₄ =', -5.9, 3.5);
    cap('寫出 4×4 的 Fourier 矩陣', 'w = i');
  },
  (tok, S) => { for (let k = 0; k < 4; k++) { sm(String(k), -4.6 + k * 0.88, 5.5); sm(String(k), -5.25, 4.8 - k * 0.88); } hot('次方 = 列號 × 欄號（從 0 數）', -3.3, 0.9); cap('指數 = 列號 × 欄號', '例如右下角 i⁹'); },
  (tok, S) => {
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) relabel(S.c[j][k], cs(F4[j][k]));
    const o = cx(1), m = cx(-1), p = I_, q = cx(0, -1), want = [[o, o, o, o], [o, p, m, q], [o, m, o, m], [o, q, m, p]];
    ok(F4.every((r, j) => r.every((z, k) => cNear(z, want[j][k]))), '代入 i² = −1、i³ = −i … ✓', -3.3, 0.3);
    cap('代入數字', '1、i、−1、−i');
  },
  (tok, S) => { sm('y = F₄x：四點 Fourier 轉換；反轉換乘 F₄⁻¹', 2.8, 5.6); cap('四點 Fourier 轉換：乘 F₄', '逆轉換：乘 F₄⁻¹'); },
  (tok, S) => { sm('Fourier 知道反矩陣：因為欄互相正交', 2.8, 5.0); cap('反矩陣很好算', '因為欄互相正交'); },
  (tok, S) => { sm('Fourier 沒發現：F 能拆成很多 0 的因子 → FFT', 2.8, 4.4); cap('他沒注意到的：可以拆成很多 0 的因子', '乘起來非常快'); },
  (tok, S) => { const g = (k, c) => S.c.forEach((r) => glow(r[k], c)); g(0, '#3a2a00'); g(1, '#3a2a00'); ok(cNear(cdotH(colC(F4, 0), colC(F4, 1)), cx(0)), '第 0 欄 · 第 1 欄 = 1 + i − 1 − i = 0 ✓', 2.8, 3.6); S.g = g; cap('檢查欄互相正交', ''); },
  (tok, S) => { S.g(1, null); S.g(2, '#3a2a00'); ok(cNear(cdotH(colC(F4, 0), colC(F4, 2)), cx(0)), '第 0 欄 · 第 2 欄 = 1 − 1 + 1 − 1 = 0 ✓', 2.8, 3.0); cap('第 0 欄和第 2 欄也正交', ''); },
  (tok, S) => { S.g(0, null); S.g(2, null); S.g(1, '#5a1a00'); S.g(3, '#5a1a00'); const t = cdotT(colC(F4, 1), colC(F4, 3)); ok(false, '第 1 欄 × 第 3 欄，不取共軛：1 + 1 + 1 + 1 = ' + cs(t) + ' ≠ 0', 2.8, 2.4); cap('第 1 欄和第 3 欄：直接乘', '1·1 + i·(−i) + … = 4？'); },
  (tok, S) => { ok(cNear(cdotH(colC(F4, 1), colC(F4, 3)), cx(0)), '先取共軛：1 − 1 + 1 − 1 = 0 ✓', 2.8, 1.8); cap('內積要先取共軛', 'i 變 −i，結果就是 0'); },
  (tok, S) => { S.g(1, null); S.g(3, null); ok([0, 1, 2, 3].every((k) => cNear(cdotH(colC(F4, k), colC(F4, k)), cx(4))), '每一欄：長度² = 4，長度 = 2 ✓', 2.8, 1.2); cap('每一欄長度是 2', '還不是單位長度'); },
  (tok, S) => { for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) relabel(S.c[j][k], cs(cMul(F4[j][k], cx(0.5)))); sm('除以 2：½F₄ 的欄 orthonormal', 2.8, 0.6); cap('全部除以 2', '欄變成 orthonormal'); },
  (tok, S) => { const H = F4.map((r) => r.map((z) => cMul(z, cx(0.5)))); ok(cEye(cmm(cHerm(H), H)), '(½F₄)ᴴ(½F₄) = I ✓', 2.8, 0.0); cap('共軛轉置 × 自己 = I', ''); },
  (tok, S) => { const H = F4.map((r) => r.map((z) => cMul(z, cx(0.5)))); ok(cEye(cmm(H, cHerm(H))), '反矩陣 = 共軛轉置 ✓（像正交矩陣的 Q⁻¹ = Qᵀ）', 2.8, -0.6); cap('反矩陣 = 共軛轉置', 'F 的好性質，反矩陣也都有'); },
]);

// 13 steps
scene('sp-l26-fft', 'L26：FFT 的關鍵一步：F₆₄ ↔ 兩個 F₃₂', [
  (tok, S) => { S.F = hot('fast Fourier transform（FFT）', -2.8, 6.0); cap('最後：FFT', ''); },
  (tok, S) => { sm('F₆ ↔ F₃、F₈ ↔ F₄、F₆₄ ↔ F₃₂：大小差一半', -2.8, 5.4); cap('F₆₄ 和 F₃₂ 有一個漂亮的關係', ''); },
  async (tok, S) => {
    S.Pc = cplane(3.9, 3.3, 1.35);
    const a = (2 * Math.PI) / 64; S.w64 = ball(W2(S.Pc, [1, 0]), C.e, 0.1);
    await anim(tok, 600, (t) => S.w64.position.copy(W2(S.Pc, [Math.cos(a * t), Math.sin(a * t)])));
    sm('w₆₄：1/64 圈', ...W2(S.Pc, [1.45, 0.25]).toArray());
    cap('F₆₄ 的 w：繞 1/64 圈', '');
  },
  async (tok, S) => {
    const a = (2 * Math.PI) / 32; S.w32 = ball(W2(S.Pc, [1, 0]), C.q, 0.1);
    await anim(tok, 600, (t) => S.w32.position.copy(W2(S.Pc, [Math.cos(a * t), Math.sin(a * t)])));
    sm('w₃₂：1/32 圈（兩倍遠）', ...W2(S.Pc, [1.3, 0.55]).toArray());
    cap('F₃₂ 的 w：1/32 圈', '角度是兩倍');
  },
  (tok, S) => { ok(cNear(cPow(cExp((2 * Math.PI) / 64), 2), cExp((2 * Math.PI) / 32)), '(w₆₄)² = w₃₂ ✓', 3.9, 0.95); cap('w₆₄ 平方 = w₃₂', '角度加倍'); },
  (tok, S) => {
    const y = 2.6; S.y = y;
    cube('F₆₄', C.a, [1.3, 1.3, 0.3], -5.4, y, 0); sm('=', -4.5, y);
    S.L = cube('?', '#e6dccb', [1.3, 1.3, 0.3], -3.7, y, 0);
    S.m = [cube('F₃₂', C.b, [0.62, 0.62, 0.3], -2.37, y + 0.33, 0), cube('0', '#f4efe5', [0.62, 0.62, 0.3], -1.73, y + 0.33, 0), cube('0', '#f4efe5', [0.62, 0.62, 0.3], -2.37, y - 0.33, 0), cube('F₃₂', C.b, [0.62, 0.62, 0.3], -1.73, y - 0.33, 0)];
    S.R = cube('?', '#e6dccb', [1.3, 1.3, 0.3], -0.6, y, 0);
    cap('F₆₄ 和兩個 F₃₂ 連起來', '');
  },
  (tok, S) => { glow(S.m[1], '#3a2a00'); glow(S.m[2], '#3a2a00'); cap('關鍵：一半是 0', ''); },
  (tok, S) => { glow(S.m[1], null); glow(S.m[2], null); relabel(S.L, 'fix-up'); relabel(S.R, 'fix-up'); cap('兩邊還要各乘一個修正因子', '這兩個幾乎全是 0'); },
  (tok, S) => { ok(64 * 64 === 4096 && 2 * 32 * 32 + 32 === 2080, '64² = 4096 → 2·32² + 32 = 2080 ✓', -3.0, 1.2); cap('原本 64² 次', '現在 2 × 32² 再加修正'); },
  (tok, S) => {
    relabel(S.R, 'P'); const ev = [...Array(64).keys()].filter((k) => k % 2 === 0), od = [...Array(64).keys()].filter((k) => k % 2);
    sm('Px = (x₀, x₂, x₄, …, x₆₂ | x₁, x₃, …, x₆₃)', -3.0, 0.6);
    ok(ev.length === 32 && od.length === 32, '偶數號 32 個、奇數號 32 個 ✓', -3.0, 0.0);
    cap('右邊是排列矩陣 P', '先放偶數號，再放奇數號');
  },
  (tok, S) => { relabel(S.L, '[I D; I −D]'); cap('左邊的修正：[I D; I −D]', '偶數、奇數各做 F₃₂，再拼回去'); },
  (tok, S) => { sm('D = diag(1, w, w², …, w³¹)：只要 32 次乘法', -3.0, 4.6); cap('D 是對角矩陣：w 的次方', '乘 D 只要 32 次乘法'); },
  (tok, S) => {
    const w = I_, D = [cx(1), w], Z = cx(0), F2 = fourier(2);
    const Lm = [[cx(1), Z, D[0], Z], [Z, cx(1), Z, D[1]], [cx(1), Z, cMul(cx(-1), D[0]), Z], [Z, cx(1), Z, cMul(cx(-1), D[1])]];
    const M = [[F2[0][0], F2[0][1], Z, Z], [F2[1][0], F2[1][1], Z, Z], [Z, Z, F2[0][0], F2[0][1]], [Z, Z, F2[1][0], F2[1][1]]];
    const Pm = [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]].map((r) => r.map((v) => cx(v)));
    const R = cmm(Lm, cmm(M, Pm));
    ok(R.every((r, j) => r.every((z, k) => cNear(z, F4[j][k]))), '用 n = 4 驗算：F₄ = [I D; I −D][F₂ 0; 0 F₂]P ✓', -2.8, 4.0);
    cap('真正的工作：兩個 F₃₂', '2 × 32² 取代 64²');
  },
]);

// 15 steps
scene('sp-l26-count', 'L26：遞迴到底：½ n log₂ n', [
  (tok, S) => {
    S.row = (labels, y, cls) => labels.map((t, k) => cube(t, cls[k], [Math.max(0.9, t.length * 0.16 + 0.3), 0.6, 0.3], -5.6 + labels.slice(0, k).reduce((s, u) => s + Math.max(0.9, u.length * 0.16 + 0.3) + 0.12, 0) + Math.max(0.9, t.length * 0.16 + 0.3) / 2, y, 0));
    S.r1 = S.row(['F₆₄', '=', '[I D; I −D]', 'F₃₂ ⊕ F₃₂', 'P₆₄'], 5.6, ['#4b9ee2', '#f4efe5', '#e6dccb', '#dd8238', '#e6dccb']);
    cap('剛才的關鍵一步', 'F₆₄ = 修正 × 兩個 F₃₂ × 排列');
  },
  (tok, S) => { S.r2 = S.row(['F₃₂', '=', '[I D; I −D]', 'F₁₆ ⊕ F₁₆', 'P₃₂'], 4.8, ['#dd8238', '#f4efe5', '#e6dccb', '#9b7ef4', '#e6dccb']); cap('下一步：F₃₂ 也拆成兩個 F₁₆', ''); },
  (tok, S) => { hot('Recursion（遞迴）：同一招一直用', 3.4, 5.2); cap('同一個想法一直重複：遞迴', ''); },
  (tok, S) => {
    const grp = (r) => [...Array(16).keys()].filter((k) => k % 4 === r).map((k) => 'x' + String(k).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[d]).join('')).join(' ');
    [['偶偶', 0], ['偶奇', 2], ['奇偶', 1], ['奇奇', 3]].forEach(([nm, r], k) => sm(nm + '：' + grp(r) + ' …', -2.8, 3.9 - k * 0.45));
    cap('兩次排列：先分偶奇，再各自分偶奇', '0, 4, 8, 12 / 2, 6, 10, 14 / …');
  },
  (tok, S) => { ok(32 * 32 === 1024 && 2 * 16 * 16 + 16 === 528, '32² = 1024 → 2·16² + 16 = 528 ✓', 3.0, 3.9); cap('32² 又被換成 2·16² + 16', ''); },
  async (tok, S) => {
    S.L = []; S.R = [];
    for (let k = 0; k < 6; k++) { S.L.push(cube('', '#e6dccb', [0.45, 0.6, 0.3], -5.4 + k * 0.52, 1.4, 0)); S.R.push(cube('', '#f4efe5', [0.45, 0.6, 0.3], 0.8 + k * 0.52, 1.4, 0)); await wt(tok, 120); }
    S.mid = cube('F₁ …', '#9b7ef4', [1.4, 0.6, 0.3], -1.25, 1.4, 0);
    cap('一直遞迴下去', '中間越來越簡單，兩邊的因子越來越多');
  },
  (tok, S) => { S.L.forEach((m) => relabel(m, '32')); S.R.forEach((m) => relabel(m, 'P')); sm('左：修正因子，每個 32 次乘法', -3.9, 0.7); sm('右：排列（幾乎不花時間）', 2.1, 0.7); cap('右邊只是排列', '左邊每個修正花 32 次'); },
  (tok, S) => { ok(Math.log2(64) === 6, '64 → 32 → 16 → 8 → 4 → 2 → 1：log₂64 = 6 步 ✓', -1.2, 0.1); cap('有幾個修正因子？', 'log₂ 64 = 6'); },
  (tok, S) => { ok(6 * 32 === 192, '總共 6 × 32 = 192 次乘法 ✓', -1.2, -0.5); cap('最後只剩 6 × 32', ''); },
  (tok, S) => { ok(0.5 * 64 * Math.log2(64) === 192, '= ½ n log₂ n（n = 64）✓', 3.6, 3.1); cap('一般公式：½ n log₂ n', '取代 n²'); },
  (tok, S) => { sm('典型：n = 2¹⁰ = 1024', 3.6, 2.5); cap('典型的例子：n = 2¹⁰', ''); },
  (tok, S) => { ok(1024 * 1024 === 1048576 && 1048576 > 1e6, 'n² = 1,048,576（超過一百萬）', 3.6, 1.95); cap('n² 超過一百萬', ''); },
  (tok, S) => { ok(0.5 * 1024 * 10 === 5120, '½ · 1024 · 10 = 5 × 1024 = 5120 ✓', 3.6, 1.4); cap('½ n log₂ n = 5 × 1024', ''); },
  (tok, S) => { const r = (1024 * 1024) / 5120; ok(near(r, 204.8), '1024² ÷ 5120 = ' + r + ' ≈ 200 倍 ✓', 3.6, 0.85); cap('快了大約 200 倍', '只是把矩陣拆對了'); },
  (tok, S) => { good('關鍵：F 是欄 orthonormal 的特殊矩陣', 3.6, 0.3); cap('一切都靠 F 的特殊結構', '欄互相正交'); },
]);

// ═════════════════════════ MIT 18.06 L27：Positive Definite Matrices and Minima ═════════════════════════
const S7 = [[2, 6], [6, 7]], S18 = [[2, 6], [6, 18]], S19 = [[2, 6], [6, 19]], S20 = [[2, 6], [6, 20]];
const isPD = (M) => symEig(M).vals.every((v) => v > 1e-9);
// level set f = k drawn at its height on a surface() (pieces inside the disc)
function slice(surf, S, k, color = C.q) {
  const out = []; let cur = [];
  for (let j = 0; j <= 240; j++) {
    const t = (j / 240) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t), g = S[0][0] * c * c + 2 * S[0][1] * c * s + S[1][1] * s * s;
    const r = g * k > 1e-12 ? Math.sqrt(k / g) : Infinity;
    if (r <= surf.R) cur.push(V3(surf.sx * r * c, surf.H0 + surf.Hs * k * surf.scale + 0.015, -surf.sx * r * s));
    else { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out.map((p) => poly(p, color));
}
function disc(surf, h, color = '#9b7ef4') {
  const m = new THREE.Mesh(new THREE.CircleGeometry(surf.sx * surf.R * 1.05, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = h; lab.world.add(m); return m;
}
const randPts = [[0.3, -0.7], [1.2, 0.4], [-0.9, 2.1], [2.5, -1.3], [-1.7, -0.6]];
const sameF = (f, g) => randPts.every(([x, y]) => near(f(x, y), g(x, y), 1e-9));
// 8 steps
scene('sp-l27-intro', 'L27：正定矩陣把整門課串起來', [
  (tok, S) => { hot('positive definite（正定）矩陣', -2.8, 6.0); cap('這一講：正定矩陣', ''); },
  (tok, S) => { ['pivots', '行列式', '特徵值'].forEach((t, k) => cube(t, [C.a, C.b, C.q][k], [1.5, 0.55, 0.5], -4.6 + k * 1.7, 4.8, 0, 2)); cap('pivots、行列式、特徵值', '整門課在這裡會合'); },
  (tok, S) => { cube('xᵀAx', C.e, [1.5, 0.55, 0.5], 0.5, 4.8, 0, 2); sm('（還有穩定性）', 0.5, 4.2); cap('還有新東西：xᵀAx', '這一講要盯著它'); },
  (tok, S) => { sm('目標一：給一個 5×5，怎麼判斷正定？', -2.8, 3.4); cap('第一個目標：怎麼判斷', ''); },
  (tok, S) => { sm('目標二：正定到底代表什麼？為什麼重要？', -2.8, 2.8); cap('更重要：它代表什麼？', ''); },
  (tok, S) => {
    S.P = board2(4.0, 2.4, 0.8, [-1.9, 1.9], [-1.9, 1.9]);
    const E = [[2, 1], [1, 2]], pts = []; for (let k = 0; k < 120; k++) { const t = (k / 120) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t), r = Math.sqrt(1 / qf2(E, c, s)); pts.push(W2(S.P, [r * c, r * s])); }
    poly(pts, C.p, true); good('正定 → 橢圓 ✓', 4.0, 4.4); nt('示意：2x² + 2xy + 2y² = 1', 4.0, 0.15);
    cap('最後是幾何：橢圓', '');
  },
  (tok, S) => {
    for (const sg of [1, -1]) { const pts = []; for (let k = -12; k <= 12; k++) { const u = k / 9; pts.push(W2(S.P, [sg * Math.cosh(u), Math.sinh(u)])); } poly(pts, C.e); }
    bad('不定 → 雙曲線', 4.0, 3.85); nt('示意：x² − y² = 1', 4.0, -0.4);
    cap('雙曲線跟正定無關', '');
  },
  (tok, S) => { hot('應用：怎麼認出「最小值」', -2.8, 2.1); cap('主要是線性代數', '以及怎麼判斷最小值'); },
]);

// 10 steps
scene('sp-l27-tests', 'L27：2×2 正定的四種測試', [
  (tok, S) => { sm('A =', -5.6, 5.4); S.m = mtag([['a', 'b'], ['b', 'c']], -4.5, 5.4, 0, 'ptr'); sm('對稱', -4.5, 4.6); cap('先看 2×2，矩陣一定對稱', '這個矩陣是正定嗎？'); },
  (tok, S) => { hot('① 特徵值：λ₁ > 0、λ₂ > 0', 1.0, 5.6); cap('測試一：特徵值全正', ''); },
  (tok, S) => { S.box1 = cube('a', C.b, [0.6, 0.6, 0.3], -4.95, 5.6, 0.2); hot('② a > 0（1×1 行列式）', 1.0, 4.9); cap('a 本身就是 1×1 的行列式', ''); },
  (tok, S) => { kill(S.box1); sm('並且 ac − b² > 0（2×2 行列式）', 1.0, 4.35); cap('再看 2×2 的行列式', 'ac − b²'); },
  (tok, S) => { sm('左上角（northwest）的子矩陣，每一個的行列式都要 > 0', 1.0, 3.8); cap('從左上角長出來的子矩陣', '全部的行列式都要正'); },
  (tok, S) => { hot('③ pivots：a > 0', 1.0, 3.1); cap('測試三：pivots', '第一個 pivot 就是 a'); },
  (tok, S) => { sm('第二個 pivot = (ac − b²)/a > 0', 1.0, 2.55); cap('pivot 乘積 = 行列式', '第二個 pivot = det / a'); },
  (tok, S) => { hot('④ xᵀAx > 0（x ≠ 0）★', 1.0, 1.85); cap('我最喜歡的新想法：xᵀAx > 0', ''); },
  (tok, S) => { sm('多數書：④ 是定義，①②③ 是判斷方法', 1.0, 1.25); cap('④ 通常當成定義', '①②③ 是檢查它的方法'); },
  (tok, S) => { sm('為什麼這些測試挑出同一群矩陣？→ 看例子', 1.0, 0.65); cap('怎麼知道它們挑出同樣的矩陣？', '先做幾個例子'); },
]);

// 12 steps
scene('sp-l27-c', 'L27：[2 6; 6 c]：c 要多大才正定？', [
  (tok, S) => { sm('A =', -5.6, 5.3); S.m = mtag([[2, 6], [6, '?']], -4.5, 5.3, 0, 'ptr'); cap('例：[2 6; 6 ?]', ''); },
  (tok, S) => { hot('右下角要放多大才正定？', 1.0, 5.6); cap('右下角放多大的數才正定？', '用行列式或 pivot 測試，不用求 λ'); },
  (tok, S) => { S.p1 = bar(-4.9, 2.2, 2, 'pivot 2'); good('第一個 pivot 2 > 0 ✓', -4.5, 4.0); cap('第一個 pivot 2 > 0', '這一關一定過'); },
  (tok, S) => { sm('det = 2c − 36 > 0 ⇒ c > 18', 1.0, 5.0); cap('c 必須大於 18', '2c > 36'); },
  (tok, S) => {
    gone(S.m); S.m = mtag(S19, -4.5, 5.3, 0, 'ptr');
    ok(near(det(S19), 2) && isPD(S19), 'c = 19：det = 38 − 36 = 2 > 0 → 正定 ✓', 1.0, 4.4);
    cap('c = 19：38 − 36 = 2', '正定');
  },
  (tok, S) => { gone(S.m); S.m = mtag(S18, -4.5, 5.3, 0, 'ptr alt'); ok(near(det(S18), 0), 'c = 18：det = 36 − 36 = 0 ✓ 邊界', 1.0, 3.8); cap('c = 18：剛好在邊界上', ''); },
  (tok, S) => { hot('positive semi-definite（半正定）', 1.0, 3.15); cap('叫做半正定', ''); },
  (tok, S) => { const ev = symEig(S18).vals; S.ev = ev; bar(-1.6, 2.2, ev[1], 'λ = 0'); ok(near(ev[1], 0), 'singular ⇒ 有一個 λ = 0 ✓', 1.0, 2.55); cap('奇異矩陣：一個特徵值是 0', ''); },
  (tok, S) => { bar(-0.8, 2.2, S.ev[0], 'λ = 20'); ok(near(S.ev[0], 20), '另一個 = trace = 2 + 18 = 20 ✓', 1.0, 1.95); sm('特徵值', -1.2, 0.6); cap('另一個特徵值看 trace：20', 'λ ≥ 0 → 半正定'); },
  (tok, S) => { const pv = pivots(S18); S.pv = pv; sm('pivots', -4.5, 0.6); ok(near(pv[0], 2), 'pivots：2，然後……', 1.0, 1.35); cap('pivots：第一個是 2', ''); },
  (tok, S) => { bar(-4.1, 2.2, S.pv[1], '沒有'); ok(near(S.pv[1], 0), '18 − 3·6 = 0：沒有第二個 pivot ✓', 1.0, 0.75); cap('沒有第二個 pivot', ''); },
  (tok, S) => { ok(S18[1][0] === 3 * S18[0][0] && S18[1][1] === 3 * S18[0][1], 'rank 1：(6, 18) = 3 × (2, 6) ✓', 1.0, 0.15); cap('rank 1 矩陣：只有一個 pivot', 'pivot 測試沒過'); },
]);

// 12 steps
scene('sp-l27-xax', 'L27：xᵀAx = 2x₁² + 12x₁x₂ + 18x₂²', [
  (tok, S) => { S.F = hot('xᵀAx：這一講的新東西', -2.4, 6.0); cap('現在看 xᵀAx', ''); },
  (tok, S) => { sm('x = (x₁, x₂)：任何向量', -2.4, 5.4); cap('x 是任何向量', '分量 x₁、x₂'); },
  (tok, S) => { sm('A =', -5.6, 4.4); mtag(S18, -4.5, 4.4, 0, 'ptr'); cap('用剛才的例子：[2 6; 6 18]', ''); },
  (tok, S) => { S.e = sm('xᵀAx = [x₁ x₂] A [x₁; x₂]', 0.8, 4.6); cap('回到實數矩陣', '把三個乘起來'); },
  (tok, S) => { sm('Ax = (2x₁ + 6x₂, 6x₁ + 18x₂)', 0.8, 4.0); cap('先算 Ax', '2x₁ + 6x₂ 和 6x₁ + 18x₂'); },
  (tok, S) => { S.t = sm('= 2x₁²', 0.8, 3.3); cap('2x₁²：來自左上的 2', ''); },
  (tok, S) => { txt(S.t, '= 2x₁² + 12x₁x₂'); sm('6 + 6 = 12（兩個 6 各貢獻一次）', 0.8, 2.75); cap('交叉項：6 + 6 = 12', ''); },
  (tok, S) => { txt(S.t, '= 2x₁² + 12x₁x₂ + 18x₂²'); ok(sameF((x, y) => qf2(S18, x, y), (x, y) => 2 * x * x + 12 * x * y + 18 * y * y), '隨機代 5 個點檢查 ✓', 0.8, 2.2); cap('x₂ × 18x₂ = 18x₂²', ''); },
  (tok, S) => { hot('ax² + 2bxy + cy²', 0.8, 1.55); sm('a = 2、2b = 12、c = 18', 0.8, 1.0); cap('一般形式：ax² + 2bxy + cy²', '矩陣的數字直接出現'); },
  (tok, S) => { sm('quadratic form：全是二次項（沒有一次項、常數）', -2.4, 0.45); cap('二次型（quadratic form）', 'Ax 是線性的，多了 xᵀ 變成二次'); },
  (tok, S) => { txt(S.F, '正定 ⇔ 對所有 x ≠ 0，xᵀAx > 0'); cap('問題：它對所有 x 都是正的嗎？', '這就是正定的定義'); },
  (tok, S) => { ok(near(qf2(S18, 3, -1), 0), '差一點：x = (3, −1) 時 18 − 36 + 18 = 0 ✓（不是 > 0）', -2.4, -0.15); cap('剛好沒過', '有不是 0 的 x 讓它等於 0'); },
]);

// 18 steps
scene('sp-l27-saddle', 'L27：c = 7：馬鞍面（saddle）', [
  (tok, S) => { S.L = panel3(['A = [2 6; 6 7]（18 改成 7）', '', '', '']); cap('把 18 改成 7', '這下完全失敗'); },
  (tok, S) => { txt(S.L[1], '正定嗎？絕對不是'); cap('這個是正定嗎？', '絕對不是'); },
  (tok, S) => { const ev = symEig(S7).vals; ok(ev.filter((v) => v < 0).length === 1, '有一個 λ < 0 ✓', -4.7, 4.3); cap('不知道 λ 是多少', '但一定有一個是負的'); },
  (tok, S) => { txt(S.L[2], 'pivots：2，…'); cap('pivots：第一個 2', '第二個 = det / 2'); },
  (tok, S) => { ok(near(det(S7), -22), 'det = 14 − 36 = −22 ✓', -4.7, 3.8); cap('行列式 = 14 − 36 = −22', ''); },
  (tok, S) => { const pv = pivots(S7); ok(near(pv[0], 2) && near(pv[1], -11), 'pivots = 2、−11 ✓（乘積 −22）', -4.7, 3.3); txt(S.L[2], 'pivots：2，−11'); cap('pivots：2 和 −11', '不是正定'); },
  (tok, S) => { txt(S.L[3], 'f = 2x² + 12xy + 7y²'); cap('看 xᵀAx', '一定有某個 x 讓它是負的'); },
  (tok, S) => { sm('試 x = (1, −1)？', -4.7, 2.8); cap('試試 (1, −1)', ''); },
  (tok, S) => { ok(near(qf2(S7, 1, -1), -3), 'f(1, −1) = 2 − 12 + 7 = −3 < 0 ✓', -4.7, 2.3); cap('2 − 12 + 7 = −3', '是負的'); },
  async (tok, S) => {
    S.surf = surface(1, 2.6, 2.2, 2.6);
    await anim(tok, 1200, (t) => S.surf.set([[2 * t, 6 * t], [6 * t, 7 * t]].map((r) => r.map((v) => v || 1e-6))));
    S.surf.set(S7);
    cap('畫出 z = f(x, y) 的圖', '');
  },
  (tok, S) => { S.o = ball(V3(0, 2.68, 0), C.gold, 0.1); good('f(0, 0) = 0：通過原點', 0.5, 2.0); cap('一定通過原點', ''); },
  (tok, S) => { S.px = pathOn(S.surf, S7, [1, 0], C.p); sm('x 方向：2x² 往上', ...onSurf(S.surf, S7, 1, 0).add(V3(0.4, 0.3, 0)).toArray()); cap('沿 x 軸：2x²，往上的拋物線', ''); },
  (tok, S) => { pathOn(S.surf, S7, [0, 1], C.p); sm('y 方向：7y² 往上', ...onSurf(S.surf, S7, 0, 1).add(V3(0, 0.4, 0)).toArray()); cap('沿 y 軸：7y²，也往上', ''); },
  (tok, S) => { const d = unit([1, 1]); pathOn(S.surf, S7, d, C.p); ok(qf2(S7, 1, 1) === 21, 'x = y：2 + 12 + 7 = 21 > 0 往上 ✓', -4.7, 1.8); cap('45° 方向：也往上', ''); },
  async (tok, S) => {
    const d = unit([1, -1]); pathOn(S.surf, S7, d, C.e);
    const b = ball(V3(0, 2.68, 0), C.e, 0.11); await anim(tok, 900, (t) => b.position.copy(onSurf(S.surf, S7, d[0] * t, d[1] * t)));
    bad('x = −y 方向：往下！', ...b.position.clone().add(V3(0.3, 0.4, 0)).toArray());
    cap('沿 x = −y 方向：往下', '失敗的方向');
  },
  (tok, S) => { hot('saddle point（鞍點）', -4.7, 1.3); cap('有的方向往上、有的方向往下', '這叫馬鞍面'); },
  (tok, S) => { sm('某些方向是最大值、某些方向是最小值', 4.4, 6.3); cap('鞍點：某些方向最大、某些方向最小', ''); },
  (tok, S) => {
    const { vals, vecs } = symEig(S7);
    vecs.forEach((v, k) => { rod(k ? C.e : C.a, 0.025).set(V3(-2.7 * v[0], 2.62, 2.7 * v[1]), V3(2.7 * v[0], 2.62, -2.7 * v[1])); sm('λ ≈ ' + f2(vals[k]), 3.0 * v[0], 2.9, -3.0 * v[1]); });
    ok(residualOK(S7, vals, vecs), '最好看的方向 = 特徵向量方向 ✓', 4.4, 5.8);
    cap('最該看的方向：特徵向量', '一個 λ > 0 往上、一個 λ < 0 往下');
  },
], CAM3);

// 16 steps
scene('sp-l27-bowl', 'L27：c = 20：碗與最小值', [
  async (tok, S) => {
    S.L = panel3(['A = [2 6; 6 20]（7 改成 20）', '', '']);
    S.surf = surface(1, 2.6, 2.2, 2.6);
    await anim(tok, 1500, (t) => S.surf.set(lerpM(S7, S20, t)));
    cap('把 7 改成 20', '讓它真正正定');
  },
  (tok, S) => { const pv = pivots(S20); ok(near(pv[0], 2) && near(pv[1], 2), 'pivots：2、2 > 0 ✓', -4.7, 4.8); cap('pivot 測試：通過', ''); },
  (tok, S) => { txt(S.L[1], '不求 λ，怎麼知道 λ > 0？'); cap('不算出 λ，怎麼知道它們是正的？', ''); },
  (tok, S) => { const ev = symEig(S20).vals; S.ev = ev; ok(near(ev[0] * ev[1], 4) && near(det(S20), 4), 'λ₁λ₂ = det = 40 − 36 = 4 > 0 ✓', -4.7, 4.3); cap('λ₁λ₂ = 行列式 = 4', '同號：都正或都負'); },
  (tok, S) => { ok(near(S.ev[0] + S.ev[1], 22), 'λ₁ + λ₂ = trace = 22 > 0 ⇒ 都是正的 ✓', -4.7, 3.8); cap('λ₁ + λ₂ = trace = 22', '都負的話加不出 22'); },
  (tok, S) => { txt(S.L[2], 'xᵀAx > 0（除了 x = 0）'); cap('所以 xᵀAx 除了原點都 > 0', ''); },
  (tok, S) => { sm('f = 2x² + 12xy + 20y²', -4.7, 3.3); cap('它的圖長什麼樣？', ''); },
  (tok, S) => { sm('平方項（2x²、20y²）壓過可正可負的 12xy', -4.7, 2.8); cap('純平方項夠大', '就能壓過 12xy'); },
  async (tok, S) => {
    const b = ball(onSurf(S.surf, S20, 0.15, 0.4), C.e, 0.11);
    await anim(tok, 1200, (t) => b.position.copy(onSurf(S.surf, S20, 0.15 * (1 - t), 0.4 * (1 - t))));
    cap('離開原點往哪走都是往上', '原點是最低點');
  },
  (tok, S) => { hot('像一個碗（bowl）', -4.7, 2.3); cap('圖形像一個碗', '最小值在原點'); },
  (tok, S) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ color: C.a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 2.62, 0); lab.world.add(m);
    sm('原點的切平面是水平的：一階導數 = 0', 4.4, 6.3); cap('原點：一階導數都是 0', '切平面是平的');
  },
  (tok, S) => { hot('決定一切的是二階導數', 4.4, 5.8); cap('但這不夠：要看二階導數', ''); },
  (tok, S) => { sm('微積分：f′(x) = 0，還要看 f″', 4.4, 5.3); cap('微積分怎麼判斷最小值？', 'f′ = 0 只說明是平的'); },
  (tok, S) => { pathOn(S.surf, S20, [1, 0], C.e); good('f″ > 0：曲線往上彎 → 最小值 ✓', 4.4, 4.8); cap('二階導數 > 0：往上彎', '斜率越來越大'); },
  (tok, S) => { hot('多變數：二階導數矩陣要正定', 4.4, 4.3); cap('n 個變數：二階導數矩陣正定', ''); },
  (tok, S) => { sm('一個數 > 0  ↔  一個矩陣正定', 4.4, 3.8); cap('「正的數」變成「正定的矩陣」', 'pivots、行列式、λ、最小值，全連在一起'); },
], CAM3);

// 15 steps
scene('sp-l27-square', 'L27：配方：2(x + 3y)² + 2y²', [
  (tok, S) => { S.L = panel3(['f = 2x² + 12xy + 20y²', '', '']); S.surf = surface(1, 2.6, 2.2, 2.6); S.surf.set(S20); cap('圖往上：為什麼它一定是正的？', ''); },
  (tok, S) => { txt(S.L[1], '寫成平方和 → 一定 ≥ 0'); cap('寫成平方的和', '平方不可能是負的'); },
  (tok, S) => { sm('麻煩來自 12xy（x、y 可以異號）', -4.7, 4.8); cap('麻煩全來自 xy 這一項', '把它塞進一個平方裡'); },
  (tok, S) => { hot('completing the square（配方）', -4.7, 4.3); cap('配方', ''); },
  (tok, S) => { S.e = sm('2(x + ? y)²', -4.7, 3.8); cap('2(x + ?y)²', '2x² 已經對了'); },
  (tok, S) => { txt(S.e, '2(x + 3y)² = 2x² + 12xy + 18y²'); ok(sameF((x, y) => 2 * (x + 3 * y) ** 2, (x, y) => 2 * x * x + 12 * x * y + 18 * y * y), '? = 3：2·2·3 = 12 ✓', -4.7, 3.3); cap('放 3：交叉項 2·6xy = 12xy ✓', ''); },
  (tok, S) => { sm('這個平方帶出 18y²（又是 18！）', -4.7, 2.8); cap('平方裡出來 18y²', '18 正是剛才的關鍵數字'); },
  (tok, S) => { txt(S.L[2], 'f = 2(x + 3y)² + 2y²'); ok(sameF((x, y) => qf2(S20, x, y), (x, y) => 2 * (x + 3 * y) ** 2 + 2 * y * y), '20 − 18 = 2：f = 2(x + 3y)² + 2y² ✓', -4.7, 2.3); cap('要 20，還剩 2y²', '配方完成'); },
  (tok, S) => { good('兩個平方相加，係數 > 0 → f > 0', -4.7, 1.8); cap('兩個平方加起來', '不可能是負的'); },
  async (tok, S) => {
    await anim(tok, 1500, (t) => S.surf.set(lerpM(S20, S7, t)));
    txt(S.L[2], 'c = 7：f = 2(x + 3y)² − 11y²');
    ok(sameF((x, y) => qf2(S7, x, y), (x, y) => 2 * (x + 3 * y) ** 2 - 11 * y * y), '7 − 18 = −11 ✓ → 馬鞍', -4.7, 1.3);
    cap('如果是 7：要減掉 11y²', '一個負號 → 馬鞍面');
  },
  async (tok, S) => {
    await anim(tok, 1200, (t) => S.surf.set(lerpM(S7, S18, t)));
    txt(S.L[2], 'c = 18：f = 2(x + 3y)²');
    S.v = pathOn(S.surf, S18, unit([-3, 1]), C.e); sm('谷底 x = −3y：f = 0', 4.4, 6.3);
    cap('18 是邊界：什麼都不剩', '沿著 x = −3y 是 0 的谷底');
  },
  async (tok, S) => { gone(S.v); await anim(tok, 1200, (t) => S.surf.set(lerpM(S18, S20, t))); txt(S.L[2], 'f = 2(x + 3y)² + 2y²'); cap('回到 20：碗往上', ''); },
  (tok, S) => { const h = S.surf.H0 + S.surf.Hs * 0.15 * S.surf.scale; S.d = disc(S.surf, h); cap('用一個水平面去切碗', 'z = 常數（老師說 z = 1）'); },
  (tok, S) => { S.c1 = slice(S.surf, S20, 0.15, C.q); S.c2 = levelCurve(S20, 0.15, S.surf.sx, S.surf.H0, S.surf.R); hd('切口是橢圓', 4.4, 5.8); cap('切口是一個橢圓', 'f = 常數 的曲線'); },
  async (tok, S) => {
    gone(S.c1, S.c2, S.d);
    await anim(tok, 1500, (t) => S.surf.set(lerpM(S20, S7, t)));
    const k = 0.12 * Math.max(...symEig(S7).vals.map(Math.abs));
    slice(S.surf, S7, k, C.q); slice(S.surf, S7, -k, C.e);
    bad('切馬鞍面 → 雙曲線', 4.4, 5.3);
    cap('切馬鞍面得到雙曲線', '');
  },
], CAM3);

// 11 steps
scene('sp-l27-elim', 'L27：配方 = 消去法（pivots 在外、乘數在內）', [
  (tok, S) => {
    S.parts = [['2', 'ptr alt'], ['(x + ', 'idx'], ['3', 'ptr alt'], ['y)² + ', 'idx'], ['2', 'ptr alt'], ['y²', 'idx']];
    S.t = S.parts.map(([t, c], k) => tag(t, c, -4.6 + [0, 0.75, 1.5, 2.2, 3.05, 3.7][k], 5.6));
    cap('看這幾個數字：外面 2、裡面 3、外面 2', '');
  },
  (tok, S) => { sm('它們都來自消去法', -2.6, 5.0); cap('這些數字不是巧合', '它們來自消去法（Gaussian elimination）'); },
  (tok, S) => { sm('A =', -5.6, 3.8); S.m = mtag(S20, -4.5, 3.8, 0, 'ptr'); cap('對 [2 6; 6 20] 做消去', '第一個 pivot 是 2'); },
  (tok, S) => { ok(6 / 2 === 3, '乘數 ℓ₂₁ = 6 / 2 = 3 ✓：第 2 列減 3 倍第 1 列', -1.6, 3.8); cap('第 2 列要減掉幾倍第 1 列？', '3 倍'); },
  (tok, S) => { hl(S.t[0], 'ptr'); hl(S.t[4], 'ptr'); hl(S.t[2], 'ptr alt'); sm('pivots 在括號外，乘數在括號裡', -2.6, 4.5); cap('配方：pivots 在外面', '乘數在括號裡面'); },
  (tok, S) => { const pv = pivots(S20); ok(near(pv[1], 2), '第二個 pivot = 20 − 3·6 = 2 ✓', -1.6, 3.2); cap('20 − 18 = 2', '第二個 pivot 也是 2'); },
  (tok, S) => {
    const L = [[1, 0], [3, 1]], U = [[2, 6], [0, 2]];
    sm('L =', -5.6, 2.2); mtag(L, -4.6, 2.2, 0, 'ptr'); sm('U =', -3.3, 2.2); mtag(U, -2.3, 2.2, 0, 'ptr');
    ok(eqM(mm(L, U), S20), 'LU = A ✓', -0.6, 2.2);
    cap('U = [2 6; 0 2]、L = [1 0; 3 1]', '');
  },
  (tok, S) => { hot('配方 = 消去法', -2.6, 1.3); cap('配方就是消去法', ''); },
  (tok, S) => { sm('消去法對 n×n 都能做 → 配方也能推到 n 維', -2.6, 0.7); cap('消去法 n×n 都會做', '所以配方也能推廣'); },
  (tok, S) => { sm('xᵀAx = Σ pivotₖ ×（含乘數的式子）²', -2.6, 0.1); cap('括號外的數字就是 pivots', ''); },
  async (tok, S) => {
    const ch = ['pivots > 0', '平方和', 'f > 0', '碗往上', '原點最小'];
    for (let k = 0; k < ch.length; k++) { cube(ch[k], [C.a, C.q, C.p, C.b, C.c][k], [1.75, 0.5, 0.5], -4.6 + k * 2.0, -0.6, 0, 1.5); await wt(tok, 200); }
    cap('全部連在一起', 'pivots > 0 → 平方和 → 往上 → 最小值');
  },
]);

// 10 steps
const fq = (x, y) => qf2(S20, x, y);
const d2 = (f, i, j, h = 1e-3) => { const e = (k, s) => [k === 0 ? s : 0, k === 1 ? s : 0]; const p = (a, b) => f(a[0] + b[0], a[1] + b[1]); return (p(e(i, h), e(j, h)) - p(e(i, h), e(j, -h)) - p(e(i, -h), e(j, h)) + p(e(i, -h), e(j, -h))) / (4 * h * h); };
scene('sp-l27-hess', 'L27：二階導數矩陣（Hessian）要正定', [
  (tok, S) => { sm('二階導數矩陣 =', -4.8, 5.3); S.m = mtag([['fxx', 'fxy'], ['fyx', 'fyy']], -2.6, 5.3, 0, 'ptr'); cap('二維：二階導數排成 2×2 矩陣', ''); },
  (tok, S) => { sm('fxx：x 方向的二階導數', 1.8, 5.6); cap('fxx：沿 x 方向的二階導數', ''); },
  (tok, S) => { sm('fyy：y 方向的二階導數', 1.8, 5.1); cap('fyy：沿 y 方向', ''); },
  (tok, S) => { hot('最小值：fxx > 0、fyy > 0', 1.8, 4.5); cap('最小值：這兩個要 > 0', ''); },
  (tok, S) => { sm('但不夠：要大到壓過交叉的 fxy', 1.8, 3.95); cap('不夠：要壓過交叉導數 fxy', ''); },
  (tok, S) => {
    const a = d2(fq, 0, 1), b = d2(fq, 1, 0);
    ok(near(a, b, 1e-6), 'fxy = fyx ✓：微分順序可以交換 → 對稱', 1.8, 3.4); cap('為什麼對稱？', '先 x 後 y、先 y 後 x 一樣');
  },
  (tok, S) => { hot('最小值 ⇔ 這個矩陣正定', 1.8, 2.8); cap('判斷：這個矩陣要正定', ''); },
  (tok, S) => { sm('18.02 的條件：一階導數 = 0，而且……', 1.8, 2.25); cap('微積分：一階導數先要是 0', ''); },
  (tok, S) => {
    const H = [[d2(fq, 0, 0), d2(fq, 0, 1)], [d2(fq, 1, 0), d2(fq, 1, 1)]].map((r) => r.map((v) => Math.round(v * 1e4) / 1e4));
    sm('示意：f = 2x² + 12xy + 20y² →', -4.6, 3.8); mtag(H, -1.8, 3.8, 0, 'ptr alt');
    ok(eqM(H, [[4, 12], [12, 40]], 1e-3) && 4 * 40 > 12 * 12, 'fxx·fyy = 160 > fxy² = 144 ✓（就是 2×2 行列式 > 0）', -2.2, 2.8);
    cap('fxx·fyy > fxy²', '就是 2×2 的行列式測試');
  },
  (tok, S) => { good('n×n：消去法、特徵值、n 個平方和 → 都能判斷', -1.4, 1.4); cap('現在 3×3、n×n 也會了', '消去法、特徵值、平方和'); },
]);

// 13 steps
scene('sp-l27-k3', 'L27：3×3：[2 −1 0; −1 2 −1; 0 −1 2]', [
  (tok, S) => { hot('3×3 的例子', -3.4, 6.6); cap('3×3 的例子', ''); },
  (tok, S) => { sm('A =', -5.9, 5.9); S.m = mtag(K3, -4.3, 5.9, 0, 'ptr'); cap('老朋友：[2 −1 0; −1 2 −1; 0 −1 2]', ''); },
  (tok, S) => { sm('問題：正定嗎？xᵀAx 是什麼？原點是最小值嗎？幾何？', 2.6, 6.2); cap('要問的事：', '正定？xᵀAx？最小值？幾何？'); },
  (tok, S) => { S.dm = minors(K3); bar(-5.6, 1.6, S.dm[0], '2'); sm('左上行列式', -5.0, 0.3); ok(near(S.dm[0], 2), '1×1：2 ✓', 3.0, 5.4); cap('先算行列式：1×1 是 2', ''); },
  (tok, S) => { bar(-5.0, 1.6, S.dm[1], '3'); ok(near(S.dm[1], 3), '2×2：4 − 1 = 3 ✓', 3.0, 4.9); cap('2×2：3', ''); },
  (tok, S) => { bar(-4.4, 1.6, S.dm[2], '4'); ok(near(S.dm[2], 4), '3×3：4 ✓（2、3、4 線性增加）', 3.0, 4.4); cap('3×3：4', '這類矩陣的行列式 2、3、4…'); },
  (tok, S) => { S.pv = pivots(K3); ['2', '3/2', '4/3'].forEach((t, k) => bar(-3.6 + k * 0.6, 1.6, S.pv[k], t)); sm('pivots', -3.0, 0.3); ok(near(S.pv[1], 1.5) && near(S.pv[2], 4 / 3), 'pivots = 2、3/2、4/3 ✓', 3.0, 3.9); cap('pivots：2、3/2、4/3', ''); },
  (tok, S) => { ok(near(S.pv[0] * S.pv[1], 3) && near(S.pv[0] * S.pv[1] * S.pv[2], 4), 'pivot 乘積 = 2、3、4 = 行列式 ✓', 3.0, 3.4); cap('前幾個 pivot 相乘 = 行列式', ''); },
  (tok, S) => { sm('特徵值：要解三次方程式', 3.0, 2.9); cap('特徵值：三次方程式', ''); },
  (tok, S) => { sm('相信：全部 > 0', 3.0, 2.4); cap('今天的結論：它們全是正的', ''); },
  (tok, S) => {
    S.ev = symEig(K3).vals.slice().reverse(); ['2−√2', '2', '2+√2'].forEach((t, k) => bar(-1.6 + k * 0.6, 1.6, S.ev[k], t)); sm('特徵值', -1.0, 0.3);
    ok(near(S.ev[0], 2 - Math.SQRT2) && near(S.ev[1], 2) && near(S.ev[2], 2 + Math.SQRT2), 'λ = 2 − √2、2、2 + √2 ✓', 3.0, 1.75);
    cap('λ = 2 − √2、2、2 + √2', '');
  },
  (tok, S) => { ok(near(S.ev.reduce((a, b) => a + b, 0), 6), '檢查 trace：和 = 6 = 2 + 2 + 2 ✓', 3.0, 1.2); cap('檢查一：trace = 6', ''); },
  (tok, S) => { ok(near((2 - Math.SQRT2) * 2 * (2 + Math.SQRT2), 4), '檢查 det：(4 − 2)·2 = 4 ✓', 3.0, 0.65); cap('檢查二：乘積 = det = 4', ''); },
]);

// 16 steps
const fK = (x) => 2 * x[0] * x[0] + 2 * x[1] * x[1] + 2 * x[2] * x[2] - 2 * x[0] * x[1] - 2 * x[1] * x[2];
const rnd3 = [[0.3, -1.2, 0.8], [1.5, 0.4, -0.7], [-2.1, 1.1, 0.6], [0.9, 2.2, -1.4]];
scene('sp-l27-ellip', 'L27：xᵀAx = 1 是一顆橢球（主軸 = 特徵向量）', [
  (tok, S) => { S.L = panel3(['xᵀAx = ?', ''], -4.6, 6.4); cap('3×3 的 xᵀAx', ''); },
  (tok, S) => { txt(S.L[0], 'xᵀAx = 2x₁² + 2x₂² + 2x₃²'); cap('對角線給平方項', '2x₁²、2x₂²、2x₃²'); },
  (tok, S) => { txt(S.L[0], 'xᵀAx = 2x₁² + 2x₂² + 2x₃² − 2x₁x₂'); cap('兩個 −1 合起來：−2x₁x₂', ''); },
  (tok, S) => {
    txt(S.L[0], 'xᵀAx = 2x₁² + 2x₂² + 2x₃² − 2x₁x₂ − 2x₂x₃');
    ok(rnd3.every((x) => near(dot(x, mv(K3, x)), fK(x))), '沒有 x₁x₃ 項；隨機代點檢查 ✓', -4.6, 5.9);
    cap('沒有 x₁x₃，還有 −2x₂x₃', '');
  },
  (tok, S) => { txt(S.L[1], '相信：除了 0 以外永遠 > 0'); cap('它永遠是正的', ''); },
  (tok, S) => { sm('圖形：4 維空間裡的碗（畫不出來）', -4.6, 5.4); cap('圖形是一個碗', '可是在 4 維空間'); },
  (tok, S) => {
    const sq = (x) => 2 * (x[0] - x[1] / 2) ** 2 + 1.5 * (x[1] - (2 / 3) * x[2]) ** 2 + (4 / 3) * x[2] ** 2;
    ok(rnd3.every((x) => near(sq(x), fK(x))), '= 2(x₁ − ½x₂)² + 3/2(x₂ − ⅔x₃)² + 4/3 x₃² ✓', -4.6, 4.9);
    cap('配方：三個平方 × 三個 pivots', 'pivots 全正 → 往上的碗');
  },
  (tok, S) => { hot('在高度 1 切開：xᵀAx = 1', -4.6, 4.4); cap('在高度 1 切開', ''); },
  async (tok, S) => {
    S.O = V3(0.6, 2.7, 0); S.s = 1.6; S.E = ellipsoid(K3, S.O, S.s); S.E.m.scale.set(0.01, 0.01, 0.01);
    const M0 = S.E.m.matrix.clone();
    await anim(tok, 900, (t) => { S.E.m.matrix.copy(M0).multiply(new THREE.Matrix4().makeScale(t + 1e-3, t + 1e-3, t + 1e-3)); S.E.m.matrixWorldNeedsUpdate = true; });
    cap('得到一個橢球（ellipsoid）', '像一顆歪的橄欖球');
  },
  (tok, S) => { ball(S.O, C.gold, 0.08); sm('一個中心、三個主方向', -4.6, 3.9); cap('有中心，還有三個主方向', ''); },
  (tok, S) => { S.sp = ellipsoid([[1, 0, 0], [0, 1, 0], [0, 0, 1]], V3(4.6, 4.9, 0), 0.55, C.a); sm('I：球（三個 λ 一樣）', 4.6, 5.8); nt('示意', 4.6, 4.1); cap('如果是球：所有方向一樣', '對應 I：λ 全相等'); },
  (tok, S) => { S.rb = ellipsoid([[1, 0, 0], [0, 4, 0], [0, 0, 4]], V3(4.6, 2.6, 0), 0.75, C.b); sm('橄欖球：兩個 λ 相等', 4.6, 3.6); nt('示意 diag(1, 4, 4)', 4.6, 1.6); cap('橄欖球：兩個 λ 一樣', '一個長方向，另兩個一樣'); },
  (tok, S) => { gone(S.sp.m, S.rb.m); sm('這裡三個 λ 都不同：長軸、中軸、短軸', -4.6, 3.4); cap('一般情況：三個 λ 都不同', '長軸、中軸、短軸'); },
  async (tok, S) => {
    const map = (v) => V3(v[0], v[2], -v[1]);
    for (let k = 0; k < 3; k++) {
      const d = map(S.E.vecs[k]).multiplyScalar(S.s / Math.sqrt(S.E.vals[k])), A = arrow([C.e, C.p, C.a][k], 0.045);
      await anim(tok, 500, (t) => A.set(S.O.clone(), S.O.clone().add(d.clone().multiplyScalar(t))));
      A.label('λ ≈ ' + f2(S.E.vals[k]), 'idx');
    }
    cap('三個軸的方向 = 特徵向量', '長度由特徵值決定');
  },
  (tok, S) => { hot('A = QΛQᵀ：principal axis theorem', -4.6, 2.9); cap('A = QΛQᵀ：主軸定理', 'Q 給方向，Λ 給長度'); },
  (tok, S) => {
    const okAx = S.E.vecs.every((v, k) => { const x = mul(1 / Math.sqrt(S.E.vals[k]), v); return near(dot(x, mv(K3, x)), 1); });
    ok(okAx, '半軸長 = 1/√λ ✓（端點代入 xᵀAx = 1）', -4.6, 2.4);
    sm('半軸 ≈ ' + S.E.vals.map((v) => f2(1 / Math.sqrt(v))).join('、'), -4.6, 1.9);
    cap('半軸長是 1/√λ', 'λ 越大，那個方向越短');
  },
], [[4.8, 5.4, 8.2], [0.6, 2.9, 0]]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['sym-real-eig', 'spectral-thm', 'spectral-sum', 'orth-diag', 'quad-surface', 'pd-tests', 'complete-square', 'principal-axes', 'pd-3x3', 'ata-psd'].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
