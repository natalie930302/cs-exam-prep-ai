// 線性代數 第9章：SVD 與應用（旋轉-伸縮-旋轉、σ 從 AᵀA 來、四個子空間、低秩近似、pseudo-inverse）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 有逐字稿的只有 MIT 18.06 L33（Go2aLo7ZOlU：left / right inverse、pseudo-inverse），那部分場景照講課順序與內容；
// L29 SVD 等影片尚無逐字稿，SVD 本身的場景以 Strang 例題建立（標題標「課本」）：A = [3 0; 4 5]、[4 4; −3 3]、[4 3; 8 6]、旗子的 rank。
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
  function symEig(S) {
    const n = S.length, A = S.map((r) => r.slice()), V = S.map((_, i) => S.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 80; sweep++) {
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
  // thin SVD via eig(AᵀA): returns σ (descending), v's, u's (u = Av/σ for σ > 0)
  function svd(A) {
    const { vals, vecs } = symEig(mm(tr(A), A));
    const sig = vals.map((l) => Math.sqrt(Math.max(0, l)));
    const us = vecs.map((v, k) => (sig[k] > 1e-9 ? mul(1 / sig[k], mv(A, v)) : null));
    return { sig, vs: vecs, us };
  }
  // 2×2 SVD arranged for animation: V and U are rotations (det +1); s2 may be negative when det A < 0
  function svd2(A) {
    const r = svd(A);
    let v1 = r.vs[0], v2 = r.vs[1];
    if (v1[0] * v2[1] - v1[1] * v2[0] < 0) v2 = mul(-1, v2);
    const s1 = r.sig[0];
    const u1 = s1 > 1e-9 ? mul(1 / s1, mv(A, v1)) : [1, 0];
    const u2 = [-u1[1], u1[0]];
    const s2 = dot(u2, mv(A, v2)); // signed
    return { s1, s2, v1, v2, u1, u2, V: [[v1[0], v2[0]], [v1[1], v2[1]]], U: [[u1[0], u2[0]], [u1[1], u2[1]]] };
  }
  const rotM = (r) => [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]];
  const angOf = (M) => Math.atan2(M[1][0], M[0][0]);
  const I2 = [[1, 0], [0, 1]];
  function inv2(M) { const d = M[0][0] * M[1][1] - M[0][1] * M[1][0]; return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; }

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
    lab.world.add(l);
    l.setPts = (p, q) => { const at = geo.attributes.position; at.setXYZ(0, p.x, p.y, p.z); at.setXYZ(1, q.x, q.y, q.z); at.needsUpdate = true; geo.computeBoundingSphere(); if (dashed) l.computeLineDistances(); };
    return l;
  }
  function poly(pts, color = '#8a7a5c', closed = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(closed ? [...pts, pts[0]] : pts);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); lab.world.add(l);
    l.setPts = (ps) => { const at = geo.attributes.position; const arr = closed ? [...ps, ps[0]] : ps; arr.forEach((p, i) => at.setXYZ(i, p.x, p.y, p.z)); at.needsUpdate = true; geo.computeBoundingSphere(); };
    return l;
  }
  function quad(c, u, v, color, op = 0.18) {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([c.clone().sub(u).sub(v), c.clone().add(u).sub(v), c.clone().add(u).add(v), c.clone().sub(u).add(v)]);
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    lab.world.add(m); return m;
  }
  function rightAngle(c, u, v, s = 0.22, color = '#6e5f49') {
    const a = u.clone().normalize().multiplyScalar(s), b = v.clone().normalize().multiplyScalar(s);
    return poly([c.clone().add(a), c.clone().add(a).add(b), c.clone().add(b)], color);
  }
  function dotAt(p, color, r = 0.09) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    m.position.copy(p); m.castShadow = true; lab.world.add(m); return m;
  }
  function cube(text, color, size, x, y, z = 0) {
    const m = lab.box(color, size); m.position.set(x, y, z);
    if (text !== '' && text != null) { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    lab.world.add(m); return m;
  }
  function space3(S, O, L = 2.6) {
    const W = (u) => V3(O.x + S * u[0], O.y + S * u[2], O.z - S * u[1]);
    const D = (u) => V3(S * u[0], S * u[2], -S * u[1]);
    [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']].forEach(([e, n]) => {
      const d = D(e).normalize().multiplyScalar(L), dn = d.clone();
      if (e[2] === 1) dn.multiplyScalar(Math.min(1, (O.y - 0.05) / L));
      seg(O.clone().sub(dn), O.clone().add(d), '#cbbd9f');
      tagAt(n, 'idx', O.clone().add(d.clone().multiplyScalar(1.08)));
    });
    return { W, D, O, S };
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
  // infinite-looking line through the origin of a board along direction d (clipped to half-length L units)
  const lineThrough = (P, d, L, color, r = 0.022) => rod(color, r).set(W2(P, mul(-L, unit(d))), W2(P, mul(L, unit(d))));
  // a matrix of value tiles on the floor-facing wall; returns the cube grid
  function tiles(M, x0, y0, color, sz = 0.62, fmt = frac) {
    return M.map((r, i) => r.map((v, j) => cube(fmt(v), Math.abs(v) < 1e-9 ? '#e6dccb' : color, [sz * 0.92, sz * 0.92, 0.3], x0 + j * sz, y0 - i * sz, 0)));
  }

  // ── rotate–stretch–rotate of the unit circle (shared by the scene and the mode) ──
  function svdStages(A) {
    const s = svd2(A), aV = angOf(s.V), aU = angOf(s.U), S = [[s.s1, 0], [0, s.s2]];
    return { s, at: [(t) => I2, (t) => rotM(-aV * t), (t) => [[1 + (s.s1 - 1) * t, 0], [0, 1 + (s.s2 - 1) * t]], (t) => mm(rotM(aU * t), S)], post: [I2, I2, rotM(-aV), rotM(-aV)] };
  }

  // ───────────────────────── 場景（課本）：旋轉 → 伸縮 → 旋轉 ─────────────────────────
  async function scSvdCircle(tok) {
    const A = (ctx.params && ctx.params.A) || [[3, 0], [4, 5]];
    const st = svdStages(A), s = st.s;
    const sc = Math.min(1.2, 2.5 / Math.max(1, Math.abs(s.s1)));
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const P = board2(0, 2.9, sc, [-5.6 / sc, 5.6 / sc], [-2.7 / sc, 2.7 / sc]);
    const cp = circlePts();
    poly(cp.map((u) => W2(P, u)), '#d8cfc0', true);
    const shape = poly(cp.map((u) => W2(P, u)), C.q, true), a1 = arrow(C.p, 0.055), a2 = arrow(C.a, 0.055);
    let M = I2;
    const draw = (Mx) => { M = Mx; shape.setPts(cp.map((u) => W2(P, mv(Mx, u)))); a1.set(P(0, 0), W2(P, mv(Mx, s.v1))); a2.set(P(0, 0), W2(P, mv(Mx, s.v2))); };
    draw(I2); a1.label('v₁', 'ptr'); a2.label('v₂', 'ptr');
    tag('A =', 'idx', -5.6, 5.9); mtag(A, -4.6, 5.9, 0, 'ptr');
    say('A = UΣVᵀ：任何矩陣都是「轉、伸縮、轉」', '單位圓上找一對垂直的 v₁、v₂，A 把它們送到垂直的方向');
    await beat(tok, 3200);
    say('Vᵀ：把 v₁、v₂ 轉到座標軸', 'v₁ = ' + vs(s.v1, f2) + '，v₂ = ' + vs(s.v2, f2));
    await anim(tok, 1600, (t) => draw(st.at[1](t)));
    await beat(tok, 1200);
    const VT = rotM(-angOf(s.V));
    say('Σ：沿座標軸伸縮 σ₁、σ₂', 'σ₁ = ' + frac(s.s1) + ' ≈ ' + f2(s.s1) + '，σ₂ = ' + frac(Math.abs(s.s2)) + ' ≈ ' + f2(Math.abs(s.s2)) + (s.s2 < 0 ? '（det < 0：多一次反射）' : ''));
    await anim(tok, 1800, (t) => draw(mm(st.at[2](t), VT)));
    await beat(tok, 1200);
    say('U：再轉到 u₁、u₂ 的方向', 'u₁ = ' + vs(s.u1, f2) + '，u₂ = ' + vs(s.u2, f2));
    await anim(tok, 1600, (t) => draw(mm(st.at[3](t), VT)));
    a1.label('Av₁ = σ₁u₁', 'ptr'); a2.label('Av₂ = σ₂u₂', 'ptr');
    rightAngle(P(0, 0), W2(P, s.u1).sub(P(0, 0)), W2(P, mul(Math.sign(s.s2) || 1, s.u2)).sub(P(0, 0)), 0.3);
    await beat(tok, 1000);
    poly(cp.map((u) => W2(P, mv(A, u))), C.b, true);
    say('和直接乘 A 的橢圓重合', '橢圓的半軸長 = σ₁、σ₂；方向 = u₁、u₂');
    await beat(tok, 3400);
    void M;
  }

  // ───────────────────────── 場景（課本）：σ 從 AᵀA 來 ─────────────────────────
  async function scSvdATA(tok) {
    fresh([0, 3.4, 12.5], [0, 3.2, 0]);
    const A = [[3, 0], [4, 5]];
    tag('A =', 'idx', -5.0, 6.4); mtag(A, -4.0, 6.4, 0, 'ptr');
    say('手算 SVD：先算 AᵀA', 'A = [3 0; 4 5]（例子）');
    await beat(tok, 2600);
    const steps = [
      ['① AᵀA', 'AᵀA = [25 20; 20 25]', '對稱、半正定'],
      ['② 特徵值', 'λ = 45、5', 'σ₁ = √45、σ₂ = √5'],
      ['③ 特徵向量 → V', 'v₁ = (1, 1)/√2', 'v₂ = (−1, 1)/√2'],
      ['④ uᵢ = Avᵢ / σᵢ', 'u₁ = (1, 3)/√10', 'u₂ = (−3, 1)/√10'],
      ['⑤ 檢查', 'AAᵀ = [9 12; 12 41]', '特徵向量正好是 u₁、u₂'],
    ];
    const P = board2(3.4, 2.4, 0.42, [-3.6, 4.4], [-1.6, 7.6]);
    for (let k = 0; k < steps.length; k++) {
      const [h, a, b] = steps[k], y = 5.4 - k * 1.05;
      const m = cube(h, k === 3 ? C.p : C.a, [2.5, 0.5, 0.5], -4.3, y + 2.5, 0);
      lab.dropTo(lab.addBody(m), V3(-4.3, y, 0));
      tag(a, 'idx', -1.3, y + 0.18); tag(b, 'idx', -1.3, y - 0.2);
      say(h, a + '；' + b);
      if (k === 2) { arrow(C.p, 0.04).set(P(0, 0), W2(P, unit([1, 1]))).label('v₁', 'ptr'); arrow(C.a, 0.04).set(P(0, 0), W2(P, unit([-1, 1]))).label('v₂', 'ptr'); }
      if (k === 3) {
        const a1 = arrow(C.p, 0.05), a2 = arrow(C.a, 0.05);
        await anim(tok, 1200, (t) => { a1.set(P(0, 0), W2(P, mul(t, mv(A, unit([1, 1]))))); a2.set(P(0, 0), W2(P, mul(t, mv(A, unit([-1, 1]))))); });
        a1.label('Av₁ = √45 u₁', 'ptr alt'); a2.label('Av₂ = √5 u₂', 'ptr alt');
      }
      await beat(tok, 2800);
    }
    say('A = UΣVᵀ，σ₁σ₂ = √225 = 15 = |det A|', '常見錯誤：u 要由 Av/σ 算，不要另外解 AAᵀ 再亂配正負號');
    await beat(tok, 3600);
  }

  // ───────────────────────── 場景（課本）：rank 1 與四個子空間 ─────────────────────────
  async function scSvdSubspaces(tok) {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const A = [[4, 3], [8, 6]], Ad = mul(1 / 5, [4, 3, 8, 6]), As = [[Ad[0], Ad[1]], [Ad[2], Ad[3]]];
    const P = board2(-3.0, 2.9, 1.0, [-2.5, 2.5], [-2.4, 2.4]), Q = board2(3.0, 2.9, 1.0, [-2.5, 2.5], [-2.4, 2.4]);
    tag('輸入 ℝ²（row space 那邊）', 'idx', -3.0, 5.6); tag('輸出 ℝ²（column space 那邊）', 'idx', 3.0, 5.6);
    tag('A = [4 3; 8 6]（圖中縮小 1/5）', 'ptr', 0, 6.3);
    say('rank 1 的 A = [4 3; 8 6]', '第二列 = 2 × 第一列：AᵀA 有一個特徵值是 0');
    await beat(tok, 3000);
    const v1 = [0.8, 0.6], v2 = [-0.6, 0.8], u1 = unit([1, 2]), u2 = unit([2, -1]);
    lineThrough(P, v1, 2.3, C.p); lineThrough(P, v2, 2.3, C.e);
    tag('C(Aᵀ)', 'ptr', W2(P, mul(2.3, v1)).x, W2(P, mul(2.3, v1)).y + 0.25); tag('N(A)', 'ptr alt', W2(P, mul(2.3, v2)).x, W2(P, mul(2.3, v2)).y + 0.25);
    say('v₁ = (4, 3)/5 張成 row space，v₂ = (−3, 4)/5 張成 null space', 'σ₁ = √125 = 5√5，σ₂ = 0');
    const av1 = arrow(C.p, 0.05).set(P(0, 0), W2(P, v1)).label('v₁', ''), av2 = arrow(C.e, 0.05).set(P(0, 0), W2(P, v2)).label('v₂', '');
    await beat(tok, 3000);
    lineThrough(Q, u1, 2.3, C.p); lineThrough(Q, u2, 2.3, C.q);
    tag('C(A)', 'ptr', W2(Q, mul(2.2, u1)).x + 0.45, W2(Q, mul(2.2, u1)).y); tag('N(Aᵀ)', 'ptr alt', W2(Q, mul(2.3, u2)).x + 0.3, W2(Q, mul(2.3, u2)).y - 0.25);
    const bu1 = arrow(C.p, 0.05); await anim(tok, 1200, (t) => bu1.set(Q(0, 0), W2(Q, mul(t * Math.sqrt(5), u1)))); bu1.label('Av₁ = σ₁u₁', '');
    say('Av₁ = σ₁u₁：u₁ = (1, 2)/√5 張成 column space', 'u₂ = (2, −1)/√5 張成 N(Aᵀ)');
    await beat(tok, 3000);
    const cp = circlePts();
    poly(cp.map((u) => W2(P, u)), '#d8cfc0', true);
    const img = poly(cp.map((u) => W2(Q, u)), C.b, true);
    say('整個單位圓被 A 壓成一條線段', '');
    await anim(tok, 2000, (t) => img.setPts(cp.map((u) => W2(Q, lerpV(u, mv(As, u), t)))));
    await beat(tok, 1400);
    av2.glow('#6a4a00');
    say('null space 的 v₂ 被送到 0', 'A = σ₁u₁v₁ᵀ：rank 1 只要一項');
    await beat(tok, 3200);
    say('SVD 一次給出四個子空間的正交基', 'v₁…v_r｜v_{r+1}…v_n｜u₁…u_r｜u_{r+1}…u_m');
    await beat(tok, 3000);
    void A; void av1;
  }

  // ───────────────────────── 低秩近似：影像矩陣 ─────────────────────────
  const IMG = {
    smile: ['00111100', '01000010', '10100101', '10000001', '10100101', '10011001', '01000010', '00111100'],
    stripes: ['11110000', '11110000', '11110000', '11110000', '11110000', '11110000', '11110000', '11110000'],
    cross: ['00011000', '00011000', '00011000', '11111111', '11111111', '00011000', '00011000', '00011000'],
    tri: ['10000000', '11000000', '11100000', '11110000', '11111000', '11111100', '11111110', '11111111'],
  };
  const IMGN = { smile: '笑臉', stripes: '直條旗（rank 1）', cross: '十字旗（rank 2）', tri: '三角形（full rank）' };
  const toM = (rows) => rows.map((r) => [...r].map(Number));
  function lowRank(M, k, d) {
    const n = M.length, m = M[0].length, out = M.map((r) => r.map(() => 0));
    for (let i = 0; i < k; i++) { if (!d.us[i]) continue; for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) out[r][c] += d.sig[i] * d.us[i][r] * d.vs[i][c]; }
    return out;
  }
  function barGrid(M, x0, z0, sz, H = 1.4) {
    const g = M.map((r, i) => r.map((v, j) => { const m = lab.box(C.a, [sz * 0.86, 1, sz * 0.86]); m.position.set(x0 + j * sz, 0.5, z0 + i * sz); lab.world.add(m); return m; }));
    g.set = (A) => A.forEach((r, i) => r.forEach((v, j) => { const m = g[i][j], h = Math.max(0.02, Math.abs(v) * H); m.scale.y = h; m.position.y = h / 2; m.material.color.set(v < -0.02 ? C.e : v > 0.5 ? C.a : '#a9c9ea'); }));
    return g;
  }
  function sigmaBars(sig, x0, z, maxH = 3) {
    const mx = Math.max(...sig, 1e-9);
    return sig.map((s, i) => { const h = Math.max(0.02, (s / mx) * maxH); const m = lab.box('#d8cfc0', [0.28, h, 0.28]); m.position.set(x0 + i * 0.36, h / 2, z); lab.world.add(m); tag(f2(s), 'idx', x0 + i * 0.36, h + 0.25, z); return m; });
  }
  async function scFlags(tok) {
    fresh([0, 7.5, 9.5], [0, 0.4, 0.4]);
    tag('Strang：旗子的 rank', 'ptr', 0, 2.6, -2.6);
    const names = ['stripes', 'cross', 'tri'];
    for (let k = 0; k < 3; k++) {
      const M = toM(IMG[names[k]]), g = barGrid(M, -6 + k * 4.3, -1.3, 0.36, 0.7); g.set(M);
      const r = svd(M).sig.filter((s) => s > 1e-6).length;
      tag(IMGN[names[k]] + '：rank ' + r, 'ptr alt', -6 + k * 4.3 + 1.26, 0.2, 2.2);
      say(['直條：每一列都一樣 → rank 1', '十字：只有兩種不同的列 → rank 2', '三角形：每一列都不同且獨立 → rank 8'][k], ['A = u vᵀ：一項就夠', 'A = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ', '要 8 項才能完全還原'][k]);
      await beat(tok, 3200);
    }
    say('rank 越低，越少個 σuvᵀ 就能存下整張圖', '低秩近似：只留最大的幾個 σ');
    await beat(tok, 3000);
  }
  async function scLowRank(tok) {
    const key = (ctx.params && ctx.params.img) || 'smile';
    fresh([0, 7.2, 9.2], [0.6, 0.6, 0.3]);
    const M = toM(IMG[key] || IMG.smile), d = svd(M), r = d.sig.filter((s) => s > 1e-6).length;
    const g = barGrid(M, -4.8, -1.6, 0.48), tgt = barGrid(M, 0.9, -1.6, 0.25, 0.5);
    tgt.set(M); tag('原圖', 'idx', 1.8, 0.1, 0.8);
    sigmaBars(d.sig, 3.7, -1.0, 2.6); tag('σ₁ … σ₈', 'idx', 4.95, 0.1, -0.4);
    const cap = tag('', 'ptr', -2.9, 3.4, -1.6);
    say(IMGN[key] + '：8×8 矩陣，rank ' + r, 'A = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …（σ 由大到小）');
    g.set(M.map((row) => row.map(() => 0)));
    await beat(tok, 2600);
    const total = d.sig.reduce((s, x) => s + x * x, 0);
    for (let k = 1; k <= r; k++) {
      const prev = lowRank(M, k - 1, d), next = lowRank(M, k, d);
      await anim(tok, 900, (t) => g.set(prev.map((row, i) => row.map((v, j) => v + (next[i][j] - v) * t))));
      const err = d.sig.slice(k).reduce((s, x) => s + x * x, 0);
      txt(cap, 'A_' + k + '：前 ' + k + ' 項');
      say('加上第 ' + k + ' 項 σ' + k + 'u' + k + 'v' + k + 'ᵀ（σ' + k + ' = ' + f2(d.sig[k - 1]) + '）', '剩下的誤差 ‖A − A_k‖²_F = σ²_{k+1} + … = ' + f2(err) + '（總能量 ' + f2(total) + '）');
      await beat(tok, k <= 2 ? 2400 : 1500);
    }
    say('Eckart–Young：A_k 是所有 rank k 矩陣中最接近 A 的', '存 k 項只要 k(m + n + 1) 個數，不用 mn 個');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景（L33）：四種 inverse 情形 ─────────────────────────
  const CASES = [
    { m: 3, n: 3, r: 3, nm: 'r = m = n：two-sided inverse', f: 'AA⁻¹ = I = A⁻¹A（方陣、full rank）' },
    { m: 4, n: 2, r: 2, nm: 'r = n < m：left inverse', f: '(AᵀA)⁻¹Aᵀ A = I；N(A) = {0}，0 或 1 個解' },
    { m: 2, n: 4, r: 2, nm: 'r = m < n：right inverse', f: 'A Aᵀ(AAᵀ)⁻¹ = I；N(Aᵀ) = {0}，n − m 個 free variables' },
    { m: 3, n: 4, r: 2, nm: 'r < m 且 r < n：只有 pseudo-inverse', f: '四個子空間都在：r、n − r、r、m − r' },
  ];
  function bigPicture() {
    const U = 0.55, blocks = {};
    const mk = (key, color, x, label) => { const m = lab.box(color, [1.7, 1, 0.5]); m.position.set(x, 0.5, 0); lab.world.add(m); const l = tag(label, 'idx', x, 0, 0.8); blocks[key] = { m, l, x }; };
    mk('row', C.a, -3.6, 'C(Aᵀ)'); mk('nul', C.b, -3.6, 'N(A)'); mk('col', C.p, 3.6, 'C(A)'); mk('lnul', C.q, 3.6, 'N(Aᵀ)');
    const aA = arrow('#6e5f49', 0.05), aZ = arrow(C.e, 0.035), aZ2 = arrow(C.e, 0.035);
    const zero = tag('0', 'ptr', 0, 0.6, 0);
    const title = tag('', 'ptr alt', 0, 5.6), shape = tag('', 'idx', 0, 5.0);
    const set = (dims) => {
      const place = (b, base, h) => { const hh = Math.max(0.02, h * U); b.m.scale.y = hh; b.m.position.y = base + hh / 2; b.m.visible = h > 0; b.l.position.set(b.x, base + hh / 2, 0.9); txt(b.l, b.l.element.textContent.split('：')[0] + '：' + Math.round(h) + ' 維'); return base + hh; };
      const t1 = place(blocks.nul, 0.3, dims.n - dims.r), top1 = place(blocks.row, t1 + 0.25, dims.r);
      const t2 = place(blocks.lnul, 0.3, dims.m - dims.r), top2 = place(blocks.col, t2 + 0.25, dims.r);
      aA.set(V3(-2.6, (t1 + 0.25 + top1) / 2, 0), V3(2.6, (t2 + 0.25 + top2) / 2, 0)).label('A', 'ptr');
      aZ.set(V3(-2.7, 0.3 + Math.max(0.02, (dims.n - dims.r) * U) / 2, 0), V3(-0.25, 0.6, 0)); aZ.g.visible = dims.n - dims.r > 0.01;
      aZ2.set(V3(2.7, 0.3 + Math.max(0.02, (dims.m - dims.r) * U) / 2, 0), V3(0.25, 0.6, 0)); aZ2.g.visible = dims.m - dims.r > 0.01;
      return Math.max(top1, top2);
    };
    return { set, title, shape };
  }
  async function scInverseCases(tok) {
    fresh([0, 3.4, 11.5], [0, 2.4, 0]);
    const bp = bigPicture();
    const focus = ctx.params && ctx.params.focus;
    const list = focus === 'two-sided' ? [0] : [0, 1, 2, 3];
    say('m×n、rank r：四個基本子空間', 'row space ⟂ null space（ℝⁿ），column space ⟂ N(Aᵀ)（ℝᵐ）');
    let cur = { m: 3, n: 4, r: 2 }; bp.set(cur);
    await beat(tok, 3000);
    for (const k of list) {
      const c = CASES[k], from = { ...cur };
      txt(bp.title, c.nm); txt(bp.shape, c.m + '×' + c.n + '，rank ' + c.r);
      await anim(tok, 1200, (t) => bp.set({ m: from.m + (c.m - from.m) * t, n: from.n + (c.n - from.n) * t, r: from.r + (c.r - from.r) * t }));
      cur = { m: c.m, n: c.n, r: c.r };
      say(c.nm, c.f);
      await beat(tok, focus ? 4200 : 3400);
    }
    if (focus === 'two-sided') { say('兩個 null space 都消失 → 真正的反矩陣', '長方形矩陣不可能有 two-sided inverse'); await beat(tok, 3000); }
    else { say('長方形矩陣不可能有 two-sided inverse', 'A 或 Aᵀ 一定有 null space，被打成 0 的向量回不來'); await beat(tok, 3000); }
  }

  // ───────────────────────── 場景（L33）：left inverse ─────────────────────────
  const AL = [[1, 0], [0, 1], [1, 1]]; // 3×2，rank 2
  async function scLeftInverse(tok) {
    fresh([5.6, 6.0, 9.4], [0.6, 2.8, 0]);
    const sp = space3(0.7, V3(0, 2.5, 0), 2.6);
    const ATA = mm(tr(AL), AL), Lf = mm(inv2(ATA), tr(AL));
    const e1 = unit([1, 0, 1]), e2 = unit(sub([0, 1, 1], mul(dot([0, 1, 1], e1), e1)));
    quad(sp.O, sp.D(e1).multiplyScalar(2.0 / 0.7), sp.D(e2).multiplyScalar(2.0 / 0.7), C.p, 0.16);
    tag('A =', 'idx', -5.2, 6.0); mtag(AL, -4.2, 6.0, 0, 'ptr');
    say('Full column rank：3×2、rank 2', 'columns 獨立，N(A) = {0}；C(A) 是 ℝ³ 裡的平面');
    await beat(tok, 3000);
    say('AᵀA = [2 1; 1 2] 可逆', 'left inverse = (AᵀA)⁻¹Aᵀ = (1/3)[2 −1 1; −1 2 1]');
    tag('A⁻¹_left = 1/3 ×', 'idx', 2.4, 6.6); mtag([[2, -1, 1], [-1, 2, 1]], 4.6, 6.6, 0, 'ptr alt');
    await beat(tok, 3200);
    const x = [1, 2], Ax = mv(AL, x);
    const ax = arrow(C.a); await anim(tok, 900, (t) => ax.set(sp.O, sp.W(mul(t, Ax)))); ax.label('Ax = (1, 2, 3)', 'ptr');
    say('x = (1, 2) → Ax = (1, 2, 3) 在平面上', 'A⁻¹_left(Ax) = (1, 2)：x 回來了');
    await beat(tok, 3000);
    const b = [1, 2, 4], p = mv(AL, mv(Lf, b));
    const ab = arrow(C.b); await anim(tok, 900, (t) => ab.set(sp.O, sp.W(mul(t, b)))); ab.label('b = (1, 2, 4)', 'ptr alt');
    say('b 不在平面上：Ax = b 無解', 'A⁻¹_left b = x̂ = ' + vs(mv(Lf, b)) + '：最小平方解');
    const dl = seg(sp.W(b), sp.W(b), '#6e5f49', true);
    await anim(tok, 1200, (t) => dl.setPts(sp.W(b), sp.W(lerpV(b, p, t))));
    arrow(C.p, 0.06).set(sp.O, sp.W(p)).label('Ax̂', '');
    await beat(tok, 3200);
    say('這就是 least squares 的關鍵', 'normal equation AᵀAx̂ = Aᵀb 的係數矩陣可逆');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景（L33）：right inverse ─────────────────────────
  async function scRightInverse(tok) {
    fresh([5.6, 6.0, 9.4], [0.6, 2.8, 0]);
    const A = tr(AL), sp = space3(1.0, V3(0, 2.4, 0), 2.6);
    tag('A =', 'idx', -5.2, 6.0); mtag(A, -4.2, 6.0, 0, 'ptr');
    say('Full row rank：2×3、rank 2', 'rows 獨立，Ax = b 一定有解，而且有 n − m = 1 個 free variable');
    await beat(tok, 3200);
    const n = [1, 1, -1], b = [1, 2], R = mm(tr(A), inv2(mm(A, tr(A)))), xr = mv(R, b);
    tag('A⁻¹_right = Aᵀ(AAᵀ)⁻¹ = 1/3 ×', 'idx', 2.0, 6.6); mtag([[2, -1], [-1, 2], [1, 1]], 5.0, 6.2, 0, 'ptr alt');
    const e1 = unit([1, 0, 1]), e2 = unit(sub([0, 1, 1], mul(dot([0, 1, 1], e1), e1)));
    quad(sp.O, sp.D(e1).multiplyScalar(1.9), sp.D(e2).multiplyScalar(1.9), C.a, 0.13);
    tag('row space', 'idx', sp.W(mul(1.9, e1)).x + 0.2, sp.W(mul(1.9, e1)).y);
    say('Ax = (1, 2) 的所有解：一整條線', 'x = x_r + t·(1, 1, −1)，(1, 1, −1) 是 null space');
    rod(C.b, 0.03).set(sp.W(add(xr, mul(-1.3, n))), sp.W(add(xr, mul(1.3, n))));
    const pts = [-1, -0.5, 0.5, 1].map((t) => dotAt(sp.W(add(xr, mul(t, n))), C.b, 0.07));
    await beat(tok, 3000);
    const ax = arrow(C.p, 0.06); await anim(tok, 900, (t) => ax.set(sp.O, sp.W(mul(t, xr)))); ax.label('A⁻¹_right b = (0, 1, 1)', '');
    rightAngle(sp.W(xr), sp.D(mul(-1, xr)), sp.D(n), 0.2);
    say('right inverse 挑的是 row space 裡那一個解', 'x_r = (0, 1, 1) ⟂ (1, 1, −1)：所有解中最短');
    await beat(tok, 3400);
    say('A·A⁻¹_right = I（2×2）', '和 left inverse 完全對稱：AAᵀ 在這裡可逆');
    await beat(tok, 2800);
    void pts;
  }

  // ───────────────────────── 場景（L33）：反過來乘得到投影 ─────────────────────────
  async function scInvProjection(tok) {
    fresh([5.6, 6.0, 9.4], [0.6, 2.8, 0]);
    const sp = space3(0.7, V3(0, 2.4, 0), 2.6);
    const Pm = mm(AL, mm(inv2(mm(tr(AL), AL)), tr(AL)));
    const e1 = unit([1, 0, 1]), e2 = unit(sub([0, 1, 1], mul(dot([0, 1, 1], e1), e1)));
    const pl = quad(sp.O, sp.D(e1).multiplyScalar(2.0 / 0.7), sp.D(e2).multiplyScalar(2.0 / 0.7), C.p, 0.16);
    tag('A · A⁻¹_left = 1/3 ×', 'idx', -3.4, 6.6); mtag([[2, -1, 1], [-1, 2, 1], [1, 1, 2]], -1.2, 6.2, 0, 'ptr');
    say('左反矩陣放到右邊：A(AᵀA)⁻¹Aᵀ', '3×3，不是 I —— 它是 P！');
    await beat(tok, 3200);
    const bs = [[1, 2, 4], [3, -1, 1], [-1, 2, -1], [2, 2, 0]], cols = [C.b, C.e, C.q, C.gold];
    const ar = bs.map((b, k) => arrow(cols[k], 0.04).set(sp.O, sp.W(b)));
    say('投影到 column space：在平面上是 I，垂直方向是 0', '投影矩陣「想當 I」，但工作不可能完成');
    await anim(tok, 1800, (t) => ar.forEach((A, k) => A.set(sp.O, sp.W(lerpV(bs[k], mv(Pm, bs[k]), t)))));
    await beat(tok, 2800);
    pl.material.color.set(C.a);
    say('右反矩陣放到左邊：Aᵀ(AAᵀ)⁻¹A', '投影到 row space');
    await beat(tok, 3000);
    say('A⁻¹_left A = I，A A⁻¹_left = P_col', 'A A⁻¹_right = I，A⁻¹_right A = P_row');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景（L33）：row space ↔ column space 一對一 ─────────────────────────
  const AR1 = [[0.8, 0.6], [1.6, 1.2]]; // [4 3; 8 6] / 5：v₁ = (4,3)/5 → (1, 2)
  async function scPinvMap(tok) {
    const focus = (ctx.params && ctx.params.focus) || 'map';
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const P = board2(-3.0, 2.9, 0.95, [-2.6, 2.6], [-2.5, 2.5]), Q = board2(3.0, 2.9, 0.95, [-2.6, 2.6], [-2.5, 2.5]);
    const v1 = [0.8, 0.6], v2 = [-0.6, 0.8], u1 = unit([1, 2]), u2 = unit([2, -1]);
    lineThrough(P, v1, 2.4, C.a); lineThrough(P, v2, 2.4, C.b); lineThrough(Q, u1, 2.4, C.p); lineThrough(Q, u2, 2.4, C.q);
    tag('row space', 'ptr', W2(P, mul(2.3, v1)).x, W2(P, mul(2.3, v1)).y + 0.3); tag('N(A)', 'ptr alt', W2(P, mul(2.3, v2)).x, W2(P, mul(2.3, v2)).y + 0.3);
    tag('column space', 'ptr', W2(Q, mul(2.2, u1)).x + 0.5, W2(Q, mul(2.2, u1)).y); tag('N(Aᵀ)', 'ptr alt', W2(Q, mul(2.4, u2)).x + 0.3, W2(Q, mul(2.4, u2)).y - 0.3);
    tag('A = [4 3; 8 6] / 5，rank 1', 'idx', 0, 6.0);
    if (focus !== 'proof') {
      say('rank r < m、n：兩個 null space 都在', '被打成 0 的向量，inverse 救不回來');
      await beat(tok, 3000);
      const xs = [1.1, -0.8], cols = [C.a, C.gold];
      for (let k = 0; k < 2; k++) {
        const x = mul(xs[k], v1), y = mv(AR1, x);
        const ax = arrow(cols[k], 0.05).set(P(0, 0), W2(P, x)).label(k ? 'y' : 'x', 'ptr');
        const ay = arrow(cols[k], 0.05); await anim(tok, 1100, (t) => ay.set(Q(0, 0), W2(Q, mul(t, y)))); ay.label(k ? 'Ay' : 'Ax', 'ptr');
        void ax;
      }
      say('row space 的 x、y → column space 的 Ax、Ay', '兩邊都是 r 維；不同的 x 給出不同的 Ax');
      await beat(tok, 3200);
      const z = add(mul(1.1, v1), mul(1.2, v2));
      const az = arrow(C.e, 0.045).set(P(0, 0), W2(P, z)).label('x + n', '');
      seg(W2(P, z), W2(P, mul(1.1, v1)), '#6e5f49', true);
      say('加上 null space 的成分：Ax 不變', 'A 把 null space 的部分打掉');
      for (let k = 0; k < 3; k++) { az.glow('#6a4a00'); await beat(tok, 350); az.glow(null); await beat(tok, 350); }
      await beat(tok, 1600);
      say('限制在 row space → column space，A 可逆', '它的反方向就是 pseudo-inverse A⁺');
      const back = arrow(C.p, 0.06);
      await anim(tok, 1600, (t) => back.set(Q(0, 0).lerp(P(0, 0), t), Q(0, 0).lerp(P(0, 0), t).add(W2(Q, mul(1.1 * Math.sqrt(5), u1)).sub(Q(0, 0)).lerp(W2(P, mul(1.1, v1)).sub(P(0, 0)), t))));
      back.label('A⁺(Ax) = x', '');
      await beat(tok, 3200);
      say('A⁺ 把 N(Aᵀ) 送到 0', 'A 殺掉 N(A)，A⁺ 殺掉 N(Aᵀ)');
      await beat(tok, 2800);
    } else {
      say('證明：x、y 都在 row space，若 Ax = Ay …', '');
      const x = mul(1.0, v1), y = mul(1.0, v1);
      arrow(C.a, 0.05).set(P(0, 0), W2(P, x)).label('x', 'ptr');
      arrow(C.gold, 0.035).set(P(0, 0), W2(P, y)).label('y', 'ptr alt');
      arrow(C.a, 0.05).set(Q(0, 0), W2(Q, mv(AR1, x))).label('Ax = Ay', 'ptr');
      await beat(tok, 2600);
      say('A(x − y) = 0 → x − y 在 null space', '');
      const d = arrow(C.e, 0.05); await anim(tok, 1000, (t) => d.set(P(0, 0), W2(P, mul(1.5 * (1 - t) + 0.001, v2)))); d.label('x − y', '');
      await beat(tok, 2200);
      say('x − y 也在 row space（向量空間對減法封閉）', '');
      await beat(tok, 2400);
      dotAt(P(0, 0), C.e, 0.16);
      say('row space ∩ null space = {0} ⇒ x = y', '<span class="ok">從 row space 到 column space，A 是一對一</span>');
      await beat(tok, 3400);
    }
  }

  // ───────────────────────── 場景（L33＋課本補充）：rank 不足的 least squares ─────────────────────────
  async function scRankDefLS(tok) {
    fresh([0, 3.0, 11], [0, 2.9, 0]);
    const P = board2(0.8, 2.9, 2.2, [-0.6, 1.6], [-1.0, 1.25]);
    tag('A = [1 1; 2 2; 1 1]，b = (2, 1, 3)', 'ptr', -3.6, 5.9);
    say('重複的實驗：兩個 column 一模一樣', 'AᵀA = [6 6; 6 6] 是 singular，normal equation 解不唯一');
    await beat(tok, 3400);
    const k = 7 / 6; // x1 + x2 = a·b / a·a = 7/6
    rod(C.b, 0.035).set(W2(P, [k + 0.55, -0.55]), W2(P, [-0.5, k + 0.5]));
    tag('x₁ + x₂ = 7/6', 'idx', W2(P, [k + 0.55, -0.55]).x + 0.5, W2(P, [k + 0.55, -0.55]).y);
    say('所有最小平方解：x₁ + x₂ = 7/6（一整條線）', '(a·b)/(a·a) = 7/6，a = (1, 2, 1)');
    const pts = [0.1, 0.4, 0.85, 1.1].map((t) => dotAt(W2(P, [t, k - t]), C.b, 0.08));
    await beat(tok, 3000);
    rod(C.a, 0.02).set(W2(P, [-0.4, -0.4]), W2(P, [1.2, 1.2])); tag('row space (1, 1)', 'idx', W2(P, [1.2, 1.2]).x + 0.4, W2(P, [1.2, 1.2]).y + 0.2);
    const xp = [k / 2, k / 2];
    const ax = arrow(C.p, 0.06); await anim(tok, 1000, (t) => ax.set(P(0, 0), W2(P, mul(t, xp)))); ax.label('A⁺b = (7/12, 7/12)', '');
    rightAngle(W2(P, xp), W2(P, [1, 1]).sub(P(0, 0)).multiplyScalar(-1), W2(P, [1, -1]).sub(P(0, 0)), 0.22);
    say('A⁺b：在 row space 的那一個，也是最短的', '‖x⁺‖ 最小；統計學家需要的就是它');
    await beat(tok, 3600);
    void pts;
  }

  // ───────────────────────── 場景（L33）：Σ 的 pseudo-inverse ─────────────────────────
  async function scPinvSigma(tok) {
    fresh([0, 3.2, 12.5], [0, 2.9, 0]);
    const S = [[3, 0, 0, 0], [0, 2, 0, 0], [0, 0, 0, 0]], Sp = tr(S).map((r) => r.map((v) => (v ? 1 / v : 0)));
    tag('Σ（3×4，rank 2）', 'ptr', -4.7, 5.5); tiles(S, -5.8, 4.8, C.a);
    say('SVD 把麻煩都放進 Σ：r 個 σ，其他全 0', 'Σ 是 m×n、rank r 最簡單的例子');
    await beat(tok, 3200);
    tag('Σ⁺（4×3）', 'ptr alt', -0.4, 5.5); const sp = tiles(Sp, -1.0, 4.8, C.b);
    say('Σ⁺：形狀轉成 n×m，非零的 σ 取倒數', '1/σ₁ = 1/3、1/σ₂ = 1/2，其他保持 0');
    sp.flat().forEach((m) => { m.position.z = 1.2; }); await anim(tok, 900, (t) => sp.flat().forEach((m) => { m.position.z = 1.2 * (1 - t); }));
    await beat(tok, 2600);
    const SS = mm(S, Sp), SpS = mm(Sp, S);
    tag('ΣΣ⁺（3×3）', 'ptr', 3.8, 6.2); tiles(SS, 3.4, 5.5, C.p);
    say('ΣΣ⁺ = r 個 1、其他 0', '不是 I：是投影到 column space');
    await beat(tok, 3000);
    tag('Σ⁺Σ（4×4）', 'ptr', 3.8, 3.75); tiles(SpS, 3.1, 3.05, C.p);
    say('Σ⁺Σ（n×n）：投影到 row space', '左乘右乘都得不到 I，只得到投影');
    await beat(tok, 3200);
    say('Σ⁺ 其他位置放東西也不影響 ΣΣ⁺', '最小（多餘處全 0）的那個才是 pseudo-inverse');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景（L33）：A⁺ = VΣ⁺Uᵀ ─────────────────────────
  async function scPinvSvd(tok) {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const P = board2(-3.0, 2.9, 0.95, [-2.6, 2.6], [-2.5, 2.5]), Q = board2(3.0, 2.9, 0.95, [-2.6, 2.6], [-2.5, 2.5]);
    const v1 = [0.8, 0.6], u1 = unit([1, 2]), u2 = unit([2, -1]);
    lineThrough(P, v1, 2.4, C.a); lineThrough(Q, u1, 2.4, C.p); lineThrough(Q, u2, 2.4, C.q);
    tag('A = √5 u₁v₁ᵀ（[4 3; 8 6] / 5）', 'idx', 0, 6.0);
    say('A = UΣVᵀ ⇒ A⁺ = VΣ⁺Uᵀ', 'V⁻¹ = Vᵀ、U⁻¹ = Uᵀ 直接轉置；只有 Σ 要「pseudo」');
    await beat(tok, 3200);
    const cp = circlePts();
    poly(cp.map((u) => W2(Q, u)), '#d8cfc0', true);
    const img = poly(cp.map((u) => W2(P, [0, 0])), C.b, true);
    const src = poly(cp.map((u) => W2(Q, u)), C.b, true);
    const Ap = mul(1 / Math.sqrt(5), [v1[0] * u1[0], v1[0] * u1[1], v1[1] * u1[0], v1[1] * u1[1]]);
    const ApM = [[Ap[0], Ap[1]], [Ap[2], Ap[3]]];
    say('A⁺ 把輸出空間的單位圓送回 row space', 'u₁ 方向乘 1/σ₁ = 1/√5；N(Aᵀ) 的 u₂ 方向 → 0');
    await anim(tok, 2200, (t) => img.setPts(cp.map((u) => W2(P, mul(t, mv(ApM, u))))));
    await beat(tok, 1200);
    const b = mul(2, u1), xb = mv(ApM, b);
    const ab = arrow(C.p, 0.05).set(Q(0, 0), W2(Q, b)).label('b = 2u₁', 'ptr');
    const ax = arrow(C.a, 0.06); await anim(tok, 1000, (t) => ax.set(P(0, 0), W2(P, mul(t, xb)))); ax.label('A⁺b = (2/√5)v₁', 'ptr');
    say('A⁺ = (1/√5) v₁u₁ᵀ = (1/25)[4 8; 3 6]', 'A⁺A、AA⁺ 都是投影');
    await beat(tok, 3400);
    void src; void ab;
  }

  // ───────────────────────── 模式 1：SVD 幾何 ─────────────────────────
  const sg = { A: [[3, 0], [4, 5]], stage: 0 };
  function enterGeom() {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const A = sg.A, st = svdStages(A), s = st.s;
    const sc = Math.min(1.2, 2.5 / Math.max(1, Math.abs(s.s1)));
    const P = board2(0, 2.9, sc, [-5.6 / sc, 5.6 / sc], [-2.7 / sc, 2.7 / sc]);
    const cp = circlePts();
    poly(cp.map((u) => W2(P, u)), '#d8cfc0', true);
    if (sg.stage === 3) poly(cp.map((u) => W2(P, mv(A, u))), C.b, true);
    const shape = poly(cp.map((u) => W2(P, u)), C.q, true), a1 = arrow(C.p, 0.055), a2 = arrow(C.a, 0.055);
    const k = sg.stage, post = st.post[k];
    tween(900, (t) => { const M = mm(st.at[k](t), post); shape.setPts(cp.map((u) => W2(P, mv(M, u)))); a1.set(P(0, 0), W2(P, mv(M, s.v1))); a2.set(P(0, 0), W2(P, mv(M, s.v2))); }, () => { a1.label(k === 3 ? 'σ₁u₁' : 'v₁ 的像', 'ptr'); a2.label(k === 3 ? 'σ₂u₂' : 'v₂ 的像', 'ptr'); });
    const names = ['單位圓與 v₁、v₂', 'Vᵀ：轉到座標軸', 'Σ：伸縮 σ₁、σ₂', 'U：轉到 u₁、u₂ = A'];
    controls('<label>A = [<input id="sgA" size="2" value="' + A[0][0] + '"> <input id="sgB" size="2" value="' + A[0][1] + '">; <input id="sgC" size="2" value="' + A[1][0] + '"> <input id="sgD" size="2" value="' + A[1][1] + '">]</label><button id="sgGo">套用</button>'
      + '<button class="primary" id="sgNext">下一步</button><button id="sgReset">從頭</button><button id="sgL29">[4 4; −3 3]</button><button id="sgR1">rank 1</button>');
    on('sgGo', () => {
      const v = ['sgA', 'sgB', 'sgC', 'sgD'].map((id) => Number($(id).value.replace(/−/g, '-')));
      if (!v.every(isFinite) || ['sgA', 'sgB', 'sgC', 'sgD'].some((id) => $(id).value === '')) { log('四個格子都要填數字。', true); return; }
      if (v.some((x) => Math.abs(x) > 9)) { log('請用 −9 到 9 的數字。', true); return; }
      if (v.every((x) => x === 0)) { log('零矩陣的 σ 全是 0，單位圓會縮成一點。', true); return; }
      sg.A = [[v[0], v[1]], [v[2], v[3]]]; sg.stage = 0; const r = svd2(sg.A); log('A = ' + ms(sg.A) + '：σ₁ ≈ ' + f2(r.s1) + '，σ₂ ≈ ' + f2(Math.abs(r.s2))); enterGeom();
    });
    on('sgNext', () => { if (sg.stage >= 3) { log('已經是 A 的結果了（橙色是直接乘 A 的橢圓）。按「從頭」再看一次。', true); return; } sg.stage++; log(names[sg.stage]); enterGeom(); });
    on('sgReset', () => { sg.stage = 0; enterGeom(); });
    on('sgL29', () => { sg.A = [[4, 4], [-3, 3]]; sg.stage = 0; log('Strang L29 的例子：AᵀA = [25 7; 7 25]，σ = √32、√18。'); enterGeom(); });
    on('sgR1', () => { sg.A = [[4, 3], [8, 6]]; sg.stage = 0; log('rank 1：σ₂ = 0，圓被壓成線段。'); enterGeom(); });
    const ATA = mm(tr(A), A);
    setState('SVD：' + names[sg.stage], [['A', ms(A)], ['AᵀA', ms(ATA)], ['σ₁、σ₂', f2(s.s1) + '、' + f2(Math.abs(s.s2))], ['v₁、v₂', vs(s.v1, f2) + '、' + vs(s.v2, f2)], ['u₁、u₂', vs(s.u1, f2) + '、' + vs(Math.sign(s.s2) < 0 ? mul(-1, s.u2) : s.u2, f2)]],
      'σᵢ = √λᵢ(AᵀA)；uᵢ = Avᵢ/σᵢ' + (s.s2 < -1e-9 ? '；det A < 0：Σ 那步多一次翻面' : ''));
  }

  // ───────────────────────── 模式 2：低秩近似 ─────────────────────────
  const lr = { img: 'smile', k: 1 };
  function enterLowRank() {
    fresh([0, 7.2, 9.2], [0.6, 0.6, 0.3]);
    const M = toM(IMG[lr.img]), d = svd(M), r = d.sig.filter((s) => s > 1e-6).length;
    const g = barGrid(M, -4.8, -1.6, 0.48), tgt = barGrid(M, 0.9, -1.6, 0.25, 0.5);
    tgt.set(M); tag('原圖', 'idx', 1.8, 0.1, 0.8);
    const bars = sigmaBars(d.sig, 3.7, -1.0, 2.6); bars.forEach((b, i) => b.material.color.set(i < lr.k ? C.p : '#d8cfc0'));
    const Ak = lowRank(M, lr.k, d); g.set(Ak);
    tag('A_' + lr.k, 'ptr', -2.9, 3.0, -1.6);
    controls('<button id="lrM">− 一項</button><button class="primary" id="lrP">＋ 一項</button>' + Object.keys(IMG).map((k2) => '<button id="lr_' + k2 + '">' + IMGN[k2] + '</button>').join(''));
    on('lrP', () => { if (lr.k >= 8) { log('8×8 最多 8 項；已經是完整的 A。', true); return; } lr.k++; if (lr.k > r) log('σ' + lr.k + ' = 0：這一項是零，圖不會再變（rank = ' + r + '）。', true); else log('加入 σ' + lr.k + 'u' + lr.k + 'v' + lr.k + 'ᵀ，σ' + lr.k + ' ≈ ' + f2(d.sig[lr.k - 1])); enterLowRank(); });
    on('lrM', () => { if (lr.k <= 1) { log('至少保留 1 項。', true); return; } lr.k--; enterLowRank(); });
    Object.keys(IMG).forEach((k2) => on('lr_' + k2, () => { lr.img = k2; lr.k = 1; log('換成' + IMGN[k2]); enterLowRank(); }));
    const err = d.sig.slice(lr.k).reduce((s, x) => s + x * x, 0), total = d.sig.reduce((s, x) => s + x * x, 0);
    const neg = Ak.flat().some((v) => v < -0.02);
    setState(IMGN[lr.img] + '：rank ' + r, [['保留項數 k', String(lr.k)], ['‖A − A_k‖²_F', f2(err)], ['保留能量', f2(100 * (1 - err / total)) + '%'], ['儲存量', Math.min(64, lr.k * 17) + ' / 64 個數']],
      'A_k = Σᵢ≤k σᵢuᵢvᵢᵀ；誤差² = 捨去的 σ² 之和' + (neg ? '；紅柱 = 近似值為負' : ''));
  }

  // ───────────────────────── 模式 3：pseudo-inverse ─────────────────────────
  const pv = { A: [[0.8, 0.6], [1.6, 1.2]], b: [1, 2], name: 'rank 1：[4 3; 8 6]/5' };
  function pinv2(A) {
    const r = svd(A), out = [[0, 0], [0, 0]];
    for (let i = 0; i < 2; i++) if (r.sig[i] > 1e-9) for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) out[a][c] += (r.vs[i][a] * r.us[i][c]) / r.sig[i];
    return { Ap: out, r };
  }
  function enterPinv() {
    fresh([0, 3.0, 11.5], [0, 2.9, 0]);
    const P = board2(-3.0, 2.9, 0.75, [-3.2, 3.2], [-3.1, 3.1]), Q = board2(3.0, 2.9, 0.75, [-3.2, 3.2], [-3.1, 3.1]);
    tag('x 這邊（ℝ²）', 'idx', -3.0, 5.6); tag('b 這邊（ℝ²）', 'idx', 3.0, 5.6);
    const A = pv.A, { Ap, r } = pinv2(A), rank = r.sig.filter((s) => s > 1e-9).length;
    if (rank === 1) { lineThrough(P, r.vs[0], 3.0, C.a); lineThrough(P, r.vs[1], 3.0, C.b); lineThrough(Q, r.us[0], 3.0, C.p); lineThrough(Q, [-r.us[0][1], r.us[0][0]], 3.0, C.q); }
    const b = pv.b, x = mv(Ap, b), p = mv(A, x);
    arrow(C.b, 0.055).set(Q(0, 0), W2(Q, b)).label('b', 'ptr alt');
    const ap = arrow(C.p, 0.05), ax = arrow(C.a, 0.06);
    tween(800, (t) => { ap.set(Q(0, 0), W2(Q, mul(t, p))); ax.set(P(0, 0), W2(P, mul(t, x))); }, () => { ap.label('Ax⁺ = 投影', ''); ax.label('x⁺ = A⁺b', 'ptr'); });
    if (norm(sub(b, p)) > 1e-6) seg(W2(Q, b), W2(Q, p), '#6e5f49', true);
    if (rank === 1) {
      const n = r.vs[1];
      [-1.5, 1.5].forEach((t) => { const y = add(x, mul(t, n)); if (norm(y) < 3) dotAt(W2(P, y), C.b, 0.07); });
      rod(C.b, 0.02).set(W2(P, add(x, mul(-2.5, n))), W2(P, add(x, mul(2.5, n))));
    }
    controls('<label>b = <input id="pvB" size="6" value="' + b.map(f2).join(', ') + '"></label><button class="primary" id="pvGo">算 A⁺b</button><button id="pvR1">rank 1 矩陣</button><button id="pvF">可逆矩陣</button><button id="pvZ">對角 [2 0; 0 0]</button>');
    on('pvGo', () => {
      const v = $('pvB').value.replace(/−/g, '-').split(/[ ,，]+/).filter(Boolean).map(Number);
      if (v.length !== 2 || v.some((t) => !isFinite(t))) { log('b 要兩個數字，例如 1, 2', true); return; }
      if (v.some((t) => Math.abs(t) > 3)) { log('請用 −3 到 3 的數字，才放得進板子。', true); return; }
      pv.b = v; enterPinv(); log('b = ' + vs(v, f2) + ' → x⁺ = ' + vs(mv(pinv2(pv.A).Ap, v), f2));
    });
    on('pvR1', () => { pv.A = [[0.8, 0.6], [1.6, 1.2]]; pv.name = 'rank 1：[4 3; 8 6]/5'; enterPinv(); });
    on('pvF', () => { pv.A = [[1, 1], [-0.5, 1]]; pv.name = '可逆：[1 1; −0.5 1]'; log('可逆時 A⁺ = A⁻¹，Ax⁺ = b 剛好成立。'); enterPinv(); });
    on('pvZ', () => { pv.A = [[2, 0], [0, 0]]; pv.name = 'Σ = [2 0; 0 0]'; log('對角的 Σ：Σ⁺ = [1/2 0; 0 0]。'); enterPinv(); });
    setState('A⁺：' + pv.name, [['A', ms(A)], ['rank', String(rank)], ['A⁺', ms(Ap)], ['x⁺ = A⁺b', vs(x, f2)], ['‖b − Ax⁺‖', f2(norm(sub(b, p)))]],
      rank === 1 ? '橙線上每一點都是最小平方解；x⁺ 是在 row space（藍線）上、最短的那個' : 'full rank：A⁺ = A⁻¹');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  function genQ() {
    const kind = rnd(0, 5);
    if (kind === 0) {
      const base = pick([[[3, 0], [4, 5], '√45、√5'], [[4, 4], [-3, 3], '√32、√18'], [[2, 0], [0, -3], '3、2'], [[1, 1], [1, 1], '2、0'], [[0, 2], [1, 0], '2、1'], [[3, 4], [0, 0], '5、0']]);
      const A = [base[0], base[1]], ans = base[2], ATA = mm(tr(A), A);
      const wrong = shuffle(['√45、√5', '√32、√18', '3、2', '2、0', '2、1', '5、0', '45、5', '−3、2'].filter((x) => x !== ans)).slice(0, 3);
      return { q: 'A = ' + ms(A, frac) + ' 的 singular values σ₁、σ₂ = ？', opts: [ans, ...wrong], ans, why: 'AᵀA = ' + ms(ATA, frac) + '，σ = √(AᵀA 的特徵值)。σ 永遠 ≥ 0，不是 A 的特徵值（例如 [2 0; 0 −3] 的 σ 是 3、2）。' };
    }
    if (kind === 1) {
      const m = rnd(2, 6), n = rnd(2, 6), r = rnd(1, Math.min(m, n));
      const ans = r === m && r === n ? 'two-sided inverse' : r === n ? 'left inverse (AᵀA)⁻¹Aᵀ' : r === m ? 'right inverse Aᵀ(AAᵀ)⁻¹' : '只有 pseudo-inverse';
      return { q: 'A 是 ' + m + '×' + n + '、rank ' + r + '。下列哪個最能描述它的 inverse？', opts: ['two-sided inverse', 'left inverse (AᵀA)⁻¹Aᵀ', 'right inverse Aᵀ(AAᵀ)⁻¹', '只有 pseudo-inverse'], ans, why: 'r = m = n 才有兩邊的反矩陣；r = n（full column rank）有 left inverse；r = m（full row rank）有 right inverse；都不是時只剩 A⁺（任何矩陣都有）。' };
    }
    if (kind === 2) {
      const m = rnd(3, 8), n = rnd(3, 8), k = rnd(1, 3);
      const ans = String(k * (m + n + 1));
      const opts = [ans]; for (const w of [String(m * n), String(k * (m + n)), String(k * m * n), String(k * (m + n + 2)), String(m + n + 1)]) if (!opts.includes(w) && opts.length < 4) opts.push(w);
      return { q: m + '×' + n + ' 的影像只保留前 ' + k + ' 項 σuvᵀ，要存幾個數？', opts, ans, why: '每一項要存 σ（1 個）、u（' + m + ' 個）、v（' + n + ' 個）：k(m + n + 1)。' };
    }
    if (kind === 3) {
      const s = [rnd(4, 9), rnd(2, 3), rnd(1, 1), 0].sort((a, b) => b - a), k = rnd(1, 2);
      const err = s.slice(k).reduce((a, x) => a + x * x, 0);
      const ans = String(err);
      return { q: 'σ = ' + s.join('、') + '。rank ' + k + ' 最佳近似 A_' + k + ' 的 ‖A − A_' + k + '‖²_F = ？', opts: [ans, String(s[k]), String(s.slice(k).reduce((a, x) => a + x, 0)), String(s[0] * s[0])].filter((x, i, a) => a.indexOf(x) === i).concat(['0', '1', '100']).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4), ans, why: 'Eckart–Young：誤差平方 = 捨棄的 σ² 之和 = ' + s.slice(k).map((x) => x + '²').join(' + ') + '。（2-norm 的誤差則是 σ_{k+1}。）' };
    }
    if (kind === 4) {
      const a = rnd(2, 6), b = rnd(2, 5);
      const ans = '[1/' + a + ' 0; 0 1/' + b + '; 0 0]';
      return { q: 'Σ = [' + a + ' 0 0; 0 ' + b + ' 0]（2×3），Σ⁺ = ？', opts: [ans, '[1/' + a + ' 0 0; 0 1/' + b + ' 0]', '[' + a + ' 0; 0 ' + b + '; 0 0]', '不存在'], ans, why: 'Σ⁺ 是 n×m = 3×2，非零 σ 取倒數。每個矩陣都有 pseudo-inverse。' };
    }
    const st = pick(['A⁺ = VΣ⁺Uᵀ', 'AA⁺ 是投影到 C(A) 的矩陣', 'A⁺b 是最短的最小平方解', 'A 可逆時 A⁺ = A⁻¹']);
    const wr = shuffle(['A⁺A = I 永遠成立', 'A⁺ = UΣ⁺Vᵀ', 'σ 是 A 的特徵值的絕對值', 'A⁺ 只對方陣有定義', 'AA⁺ 是投影到 row space']).slice(0, 3);
    return { q: '關於 pseudo-inverse，何者正確？', opts: [st, ...wr], ans: st, why: 'A⁺ = VΣ⁺Uᵀ；AA⁺ 投影到 column space、A⁺A 投影到 row space（不一定是 I）；σ 是 AᵀA 特徵值的平方根，一般不是 |λ(A)|。' };
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
    'svd-circle': { title: 'SVD：單位圓 → 轉 → 伸縮 → 轉 → 橢圓（課本）', play: scSvdCircle },
    'svd-ata': { title: '手算 SVD：σ 從 AᵀA 來，u = Av/σ（課本）', play: scSvdATA },
    'svd-subspaces': { title: 'rank 1 的 SVD 與四個子空間（課本）', play: scSvdSubspaces },
    'flags-rank': { title: '旗子的 rank：1、2、full（課本）', play: scFlags },
    'low-rank': { title: '低秩近似：一項一項加回影像（課本）', play: scLowRank },
    'inverse-cases': { title: '四種情形：two-sided / left / right / pseudo', play: scInverseCases },
    'left-inverse': { title: 'Full column rank：left inverse (AᵀA)⁻¹Aᵀ', play: scLeftInverse },
    'right-inverse': { title: 'Full row rank：right inverse Aᵀ(AAᵀ)⁻¹', play: scRightInverse },
    'inverse-projection': { title: '反過來乘：得到投影矩陣', play: scInvProjection },
    'pinv-map': { title: 'row space ↔ column space 一對一：A⁺', play: scPinvMap },
    'rank-deficient-ls': { title: 'rank 不足的最小平方：A⁺b 最短', play: scRankDefLS },
    'pinv-sigma': { title: 'Σ⁺ 與 ΣΣ⁺、Σ⁺Σ', play: scPinvSigma },
    'pinv-svd': { title: 'A⁺ = VΣ⁺Uᵀ', play: scPinvSvd },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ sv.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, GOLD } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 9 章（MIT 18.06 L29 SVD 兩個錄影、SVD 逐步例題、L32 Quiz 3 複習、L33 left/right/pseudo-inverse、
//     L34 期末總複習）— cued scenes（sv）───
// 每個 σ、U、Σ、V、反矩陣、投影、特徵值都由程式現場計算，和老師口述的答案比對，畫面顯示 ✓／✘。
// 逐字稿沒給數字、由我們補上的例子，畫面標「示意」。符號慣例：σ ≥ 0、由大到小；u 由 Av = σu 決定（不另外解 AAᵀ 配符號）。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, x, y, t, z = 0) => { if (!b) log('✘ check failed: ' + t, true); return b ? good('✓ ' + t, x, y, z) : bad('✘ 程式檢查不符：' + t, x, y, z); };
const gone = (...os) => os.forEach((o) => {
  if (!o) return; if (Array.isArray(o)) return gone(...o);
  if (o.kill && o.g) return o.kill();            // 本章的 arrow()
  if (o.all && o.c) return gone(o.all);           // grid()
  if (o.element) return remove(o);                // label
  if (o.isObject3D) kill(o);
});
const CAM = [[0, 3.4, 13], [0, 3.2, 0]];
const CAM3 = [[5.6, 6.0, 9.4], [0.6, 2.8, 0]];
const VC = { a: '#4b9ee2', b: '#dd8238', c: '#9b7ef4', d: '#2fc092', r: '#d64545', g: '#c08a1f', k: '#6e5f49', gray: '#b9ad99', pale: '#e7dcc8', y: '#e9c53a' };
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── 數值工具（全部現場算）──
const R2 = Math.SQRT2;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const eqM = (A, B, e = 1e-9) => A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((x, j) => near(x, B[i][j], e)));
const eqV = (a, b, e = 1e-9) => a.length === b.length && a.every((x, i) => near(x, b[i], e));
const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
const dg = (m, n, d) => Array.from({ length: m }, (_, i) => Array.from({ length: n }, (__, j) => (i === j && i < d.length ? d[i] : 0)));
const msc = (A, c) => A.map((r) => r.map((x) => x * c));
const madd = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
const isSym = (A) => A.every((r, i) => r.every((x, j) => near(x, A[j][i])));
const colsM = (cs) => cs[0].map((_, i) => cs.map((c) => c[i]));   // columns → matrix
const det2 = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const det3 = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
function rref(M0) {
  const M = M0.map((r) => r.slice()), m = M.length, n = M[0].length, piv = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = r; for (let i = r + 1; i < m; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-10) continue;
    [M[r], M[p]] = [M[p], M[r]];
    const d = M[r][c]; M[r] = M[r].map((x) => x / d);
    for (let i = 0; i < m; i++) if (i !== r && Math.abs(M[i][c]) > 1e-14) { const f = M[i][c]; M[i] = M[i].map((x, j) => x - f * M[r][j]); }
    piv.push(c); r++;
  }
  return { R: M.map((row) => row.map((x) => (Math.abs(x) < 1e-12 ? 0 : x))), piv, rank: piv.length };
}
const rank = (M) => rref(M).rank;
const mpow = (A, k) => { let X = eye(A.length); for (let i = 0; i < k; i++) X = mm(X, A); return X; };
function expm(A, t) { // e^{At}（級數，夠用於小矩陣）
  const n = A.length, At = msc(A, t); let S = eye(n), T = eye(n);
  for (let k = 1; k < 80; k++) { T = msc(mm(T, At), 1 / k); S = madd(S, T); }
  return S;
}
// ── 畫面工具 ──
const mx = (M, x, y, cls = '') => mtag(M, x, y, 0, cls);
// 方塊矩陣：字串或數字都可以（'0' 或 0 的格子淡色）
function grid(M, x0, y0, color, sz = 0.6) {
  const c = M.map((r, i) => r.map((v, j) => {
    const s = typeof v === 'number' ? frac(v) : String(v);
    return cube(s, s === '0' || s === '' ? VC.pale : color, [sz * 0.92, sz * 0.92, 0.25], x0 + j * sz, y0 - i * sz, 0);
  }));
  return { c, all: c.flat() };
}
const setLbl = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
// 一列一列往下寫的推導（ledger）
function ledger(x, yTop, dy = 0.58) {
  const L = { ls: [], y: yTop };
  L.add = (t, cls = '') => { const l = tag(t, cls, x, L.y); L.y -= dy; L.ls.push(l); return l; };
  return L;
}
const W = (B, u) => W2(B, u);
async function grow(tok, A, from, to, ms = 700) { await anim(tok, ms, (u) => A.set(from, from.clone().lerp(to, u))); }

// ════════ L29（TX_vooSnhm8；另一個錄影 Nx0lRBaXoz4 內容相同、共用場景）：Singular Value Decomposition ════════
const A29 = [[4, 4], [-3, 3]];                 // 老師的例一
const A29v = [[1 / R2, 1 / R2], [1 / R2, -1 / R2]]; // 老師選的 v₁ = (1,1)/√2、v₂ = (1,−1)/√2（columns）
const A29s = [Math.sqrt(32), Math.sqrt(18)];
const A29uGood = A29v[0].map((_, k) => mul(1 / A29s[k], mv(A29, [A29v[0][k], A29v[1][k]]))); // u = Av/σ
const A29U = colsM(A29uGood);                  // [1 0; 0 −1]
const SVD29_OK = eqM(mm(A29U, mm(dg(2, 2, A29s), tr(A29v))), A29);
const A2 = [[4, 3], [8, 6]];                   // 老師的例二（rank 1）
const S2x = [[2, 1], [1, 2]], Q2x = [[1 / R2, -1 / R2], [1 / R2, 1 / R2]], L2x = dg(2, 2, [3, 1]); // 示意：對稱正定
const NS2 = [[1, 2], [0, 3]];                  // 示意：不對稱

scene('sv-l29-intro', 'L29：SVD = 正交 × 對角 × 正交', [
  async (tok, S) => { // @13.7
    S.t = hd('Singular Value Decomposition（SVD）', 0, 7.0);
    S.n = sm('線性代數「最後、也最好」的分解', 0, 6.3);
    cap('這一講：奇異值分解 SVD', '大家都叫它 SVD');
  },
  async (tok, S) => { // @36.9
    pl('A  =', -4.3, 4.7);
    S.U = cube('U', VC.a, [1.5, 1.5, 0.4], -2.4, 4.7, 0, 2); S.Sg = cube('Σ', VC.g, [1.5, 1.5, 0.4], 0, 4.7, 0, 2); S.V = cube('Vᵀ', VC.c, [1.5, 1.5, 0.4], 2.4, 4.7, 0, 2);
    sm('正交（orthogonal）', -2.4, 3.65); sm('對角（diagonal）', 0, 3.65); sm('正交（orthogonal）', 2.4, 3.65);
    cap('A = U Σ Vᵀ', '正交 × 對角 × 正交');
  },
  async (tok, S) => { // @53.0
    glow(S.U, GOLD); glow(S.V, GOLD);
    S.h = hot('新的地方：需要「兩個」（通常不同的）正交矩陣', 0, 2.8);
    cap('新重點：兩個正交矩陣', 'U 和 V 通常不一樣');
  },
  async (tok, S) => { // @58.5
    S.any = note('A 可以是任何矩陣：長方形、不可逆都可以', 0, 2.0);
    cap('任何矩陣都有 SVD', '中間一個對角矩陣，兩邊各一個正交矩陣');
  },
  async (tok, S) => { // @89.5
    gone(S.h, S.any); glow(S.U, null); glow(S.V, null);
    sm('上一章：對稱正定（示意 S）', -3.6, 2.7); mx(S2x, -3.6, 1.9, 'ptr');
    cap('它把上一章的對稱正定矩陣也串起來', '');
  },
  async (tok, S) => { // @120.4
    pl('=  Q Λ Qᵀ', -1.6, 1.9);
    sm('Q', 0.2, 1.35); mx(Q2x, 0.2, 0.75); sm('Λ', 2.4, 1.35); mx(L2x, 2.4, 0.75);
    const okQ = eqM(mm(Q2x, mm(L2x, tr(Q2x))), S2x) && eqM(mm(tr(Q2x), Q2x), eye(2));
    S.ok = ok(okQ, 0.4, -0.1, 'QΛQᵀ = S、QᵀQ = I；λ = 3、1 都 > 0');
    cap('對稱 → 特徵向量正交；正定 → λ > 0', '平常的 S 變成很好的 Q');
  },
  async (tok, S) => { // @143.6
    S.same = hot('對稱正定時這就是 SVD：U = V = Q，一個正交矩陣就夠', 0, 2.95);
    cap('這種情形 U = V = Q', '');
  },
  async (tok, S) => { // @157.8
    gone(S.same);
    const e1 = [1, 0], e2 = [1, 1];
    const okE = eqV(mv(NS2, e1), mul(1, e1)) && eqV(mv(NS2, e2), mul(3, e2));
    bad('一般 A = SΛS⁻¹ 不行：S 通常不是正交矩陣', 0, 2.95);
    S.ns = sm((okE ? '' : '✘') + '示意 [1 2; 0 3]：特徵向量 (1, 0)、(1, 1)，內積 = ' + dot(e1, e2) + ' ≠ 0', 0, 2.4);
    cap('一般矩陣：特徵向量矩陣不正交', '所以這條路走不通');
  },
  async (tok, S) => { // @169.8
    hot('要找的是：正交 × 對角 × 正交', 0, -0.9);
    cap('目標：正交 × 對角 × 正交', '接下來看它的意思與由來');
  },
]);

// 兩塊板子：左 = row space（輸入）、右 = column space（輸出）；例一 A = [4 4; −3 3]
function twoBoards(S, sc = 0.42, half = 5.5) {
  S.L = board2(-3.4, 3.0, sc, [-half, half], [-half, half]); S.R = board2(3.4, 3.0, sc, [-half, half], [-half, half]);
  sm('row space（輸入）', -3.4, 5.75); sm('column space（輸出）', 3.4, 5.75);
}
scene('sv-l29-goal', 'L29：row space 的正交基 → column space 的正交基', [
  async (tok, S) => { // @182.5
    twoBoards(S); S.Aarr = arrow(VC.k, 0.05).set(V3(-0.75, 6.4, 0), V3(0.75, 6.4, 0)).label('A', 'ptr');
    sm('（示意：用等一下的例子 A = [4 4; −3 3]）', 0, 6.95);
    cap('任何線性轉換的大圖', 'A 把 row space 送到 column space');
  },
  async (tok, S) => { // @199.4
    S.v1 = [1 / R2, 1 / R2];
    S.a1 = arrow(VC.a, 0.05).set(S.L(0, 0), W(S.L, S.v1)).label('v₁', 'ptr');
    S.b1 = arrow(VC.a, 0.05); await grow(tok, S.b1, S.R(0, 0), W(S.R, mv(A29, S.v1))); S.b1.label('Av₁', 'ptr');
    cap('row space 裡的 v₁ → column space 裡的 Av₁', '');
  },
  async (tok, S) => { // @217.3
    S.v2 = [1 / R2, -1 / R2];
    S.a2 = arrow(VC.b, 0.05).set(S.L(0, 0), W(S.L, S.v2)).label('v₂', 'ptr');
    S.b2 = arrow(VC.b, 0.05); await grow(tok, S.b2, S.R(0, 0), W(S.R, mv(A29, S.v2))); S.b2.label('Av₂', 'ptr');
    cap('另一個向量也被送過去', '');
  },
  async (tok, S) => { // @230.1
    rightAngle(S.L(0, 0), W(S.L, S.v1).sub(S.L(0, 0)), W(S.L, S.v2).sub(S.L(0, 0)), 0.3);
    rightAngle(S.R(0, 0), W(S.R, mv(A29, S.v1)).sub(S.R(0, 0)), W(S.R, mv(A29, S.v2)).sub(S.R(0, 0)), 0.3);
    ok(near(dot(S.v1, S.v2), 0) && near(dot(mv(A29, S.v1), mv(A29, S.v2)), 0), 0, 0.15, 'v₁ ⟂ v₂，而且 Av₁ ⟂ Av₂');
    cap('目標：正交基 → 還是正交基', '兩邊都是直角，很特別');
  },
  async (tok, S) => { // @273.8
    S.e = [arrow(VC.gray, 0.035).set(S.L(0, 0), W(S.L, [1, 0])).label('e₁', ''), arrow(VC.gray, 0.035).set(S.L(0, 0), W(S.L, [0, 1])).label('e₂', '')];
    S.gs = note('row space 的正交基很好找（Gram-Schmidt），例如 e₁、e₂', 0, -0.6);
    cap('只要正交基？Gram-Schmidt 就有', '');
  },
  async (tok, S) => { // @293.5
    const p = mv(A29, [1, 0]), q = mv(A29, [0, 1]);
    S.f = [arrow(VC.gray, 0.035).set(S.R(0, 0), W(S.R, p)).label('Ae₁', ''), arrow(VC.gray, 0.035).set(S.R(0, 0), W(S.R, q)).label('Ae₂', '')];
    gone(S.gs); S.gs = bad('但 Ae₁ = (4, −3)、Ae₂ = (4, 3)：內積 = ' + dot(p, q) + ' ≠ 0，不再垂直', 0, -0.6);
    cap('隨便一組正交基，乘 A 之後就不垂直了', '要找的是「特別的那一組」');
  },
  async (tok, S) => { // @314.5
    gone(S.e, S.f, S.gs);
    S.gs = note('null space 不麻煩：之後在 Σ 的對角線上變成 0（這個 A 可逆，沒有 null space）', 0, -0.6);
    cap('null space 呢？', '它們只會在 Σ 裡變成 0');
  },
  async (tok, S) => { // @380.4
    gone(S.gs);
    const cp = circlePts();
    S.circ = poly(cp.map((u) => W(S.L, u)), VC.c, true);
    S.gs = note('不只正交，還要 orthonormal：v 都是單位向量（在單位圓上）', 0, -0.6);
    cap('乾脆讓它們是單位向量', 'orthonormal');
  },
  async (tok, S) => { // @398.5
    const cp = circlePts();
    S.ell = poly(cp.map((u) => W(S.R, u)), VC.c, true);
    await anim(tok, 1400, (k) => S.ell.setPts(cp.map((u) => W(S.R, lerpV(u, mv(A29, u), k)))));
    S.u1 = arrow(VC.d, 0.06).set(S.R(0, 0), W(S.R, A29uGood[0])).label('u₁', 'ptr alt');
    gone(S.gs); S.gs = ok(near(norm(mv(A29, S.v1)), A29s[0]), 0, -0.6, 'Av₁ = σ₁u₁：u₁ 是單位向量，σ₁ = √32 是伸縮倍數');
    cap('Av₁ = σ₁ u₁', 'σ 是「伸縮的數」，不再叫 λ');
  },
  async (tok, S) => { // @422.0
    S.u2 = arrow(VC.d, 0.06).set(S.R(0, 0), W(S.R, A29uGood[1])).label('u₂', 'ptr alt');
    ok(near(norm(mv(A29, S.v2)), A29s[1]), 0, -1.2, 'Av₂ = σ₂u₂，σ₂ = √18：單位圓 → 橢圓，半軸 σ₁、σ₂');
    cap('同樣 Av₂ = σ₂ u₂', '圓變成橢圓：半軸就是 σ₁u₁、σ₂u₂');
  },
]);

scene('sv-l29-matrix', 'L29：把目標寫成矩陣 AV = UΣ', [
  async (tok, S) => { // @428.9
    hd('把目標寫成矩陣', 0, 7.2);
    pl('Av₁ = σ₁u₁　Av₂ = σ₂u₂　…　Av_r = σ_r u_r', 0, 6.5);
    cap('把目標寫成矩陣語言', '先想要什麼，再寫成矩陣乘法');
  },
  async (tok, S) => { // @443.7
    S.A = cube('A', VC.k, [0.8, 1.8, 0.3], -6.0, 4.3, 0);
    S.v = ['v₁', 'v₂', '⋯', 'v_r'].map((t, k) => cube(t, VC.a, [0.55, 1.8, 0.3], -5.1 + k * 0.62, 4.3, 0));
    pl('=', -2.3, 4.3);
    S.u = ['u₁', 'u₂', '⋯', 'u_r'].map((t, k) => cube(t, VC.d, [0.55, 1.8, 0.3], -1.6 + k * 0.62, 4.3, 0));
    cap('右邊先放 u₁、u₂ … u_r', '');
  },
  async (tok, S) => { // @453.9
    S.s = grid([['σ₁', '0', '0', '0'], ['0', 'σ₂', '0', '0'], ['0', '0', '⋱', '0'], ['0', '0', '0', 'σ_r']], 1.0, 5.2, VC.g, 0.6);
    cap('再乘一個放 σ 的對角矩陣', '');
  },
  async (tok, S) => { // @475.8
    glow(S.v[0], GOLD); glow(S.u[0], GOLD); glow(S.s.c[0][0], GOLD);
    S.t = pl('A × 第一個基底向量 = σ₁ × 另一邊的第一個基底向量', 0, 2.6);
    cap('A 乘 v₁ = σ₁ 乘 u₁', 'v 是 row space 的基底、u 是 column space 的基底');
  },
  async (tok, S) => { // @497.8
    glow(S.v[0], null); glow(S.u[0], null); glow(S.s.c[0][0], null);
    glow(S.v[3], GOLD); glow(S.u[3], GOLD); glow(S.s.c[3][3], GOLD);
    txt(S.t, 'Av₂ = σ₂u₂ … Av_r = σ_r u_r；後面可能還有一堆 0');
    cap('一路到 Av_r = σ_r u_r', '這就是核心');
  },
  async (tok, S) => { // @523.9
    glow(S.v[3], null); glow(S.u[3], null); glow(S.s.c[3][3], null);
    S.h = hot('A V = U Σ：兩邊都是 orthonormal basis，A 好像被「對角化」成 Σ', 0, 1.9);
    cap('A V = U Σ', '把 A 變成對角矩陣 Σ');
  },
  async (tok, S) => { // @548.1
    note('通常要允許兩組不同的基底；對稱正定才是 AQ = QΣ（V = U = Q）', 0, 1.2);
    cap('通常要兩組不同的基底', '只有對稱正定時 U = V');
  },
  async (tok, S) => { // @572.0
    sm('例一', -4.2, 0.4); S.mA = mx(A29, -2.9, 0.15, 'ptr');
    cap('例子：A = [4 4; −3 3]', '2 × 2');
  },
  async (tok, S) => { // @581.7
    ok(det2(A29) !== 0 && rank(A29) === 2, 0.6, 0.15, 'det = ' + det2(A29) + ' ≠ 0：可逆，rank 2');
    cap('它可逆，所以 rank 2', '');
  },
  async (tok, S) => { // @587.6
    pl('要找：v₁、v₂ ∈ ℝ²（row space）、u₁、u₂ ∈ ℝ²（column space）、σ₁、σ₂', 0, -0.6);
    cap('找 v₁ v₂、u₁ u₂ 和 σ₁ σ₂', 'v、u 各自 orthonormal，σ 是伸縮倍數');
  },
]);

scene('sv-l29-null', 'L29：null space 的部分只補上 0', [
  async (tok, S) => { // @639.0
    hd('如果有 null space 呢？', 0, 7.2);
    S.v = ['v₁', '⋯', 'v_r'].map((t, k) => cube(t, VC.a, [0.6, 1.8, 0.3], -5.6 + k * 0.68, 5.0, 0));
    sm('V', -4.9, 6.15);
    cap('談兩句 null space', '');
  },
  async (tok, S) => { // @655.4
    S.vn = ['v_{r+1}', '⋯', 'v_n'].map((t, k) => cube(t, VC.b, [0.8, 1.8, 0.3], -3.4 + k * 0.88, 5.0, 0));
    sm('null space 的 orthonormal basis', -2.5, 3.85);
    cap('補上 null space 的基底 v_{r+1} … v_n', 'n − r 維');
  },
  async (tok, S) => { // @675.2
    S.s = grid([['σ₁', '0', '0', '0'], ['0', 'σ_r', '0', '0'], ['0', '0', '0', '0'], ['0', '0', '0', '0']], 0.9, 5.9, VC.g, 0.55);
    sm('Σ：後面全是 0', 1.7, 3.45);
    cap('它們在 Σ 上只得到 0', '');
  },
  async (tok, S) => { // @684.3
    S.u = ['u₁', '⋯', 'u_r', 'u_{r+1}', '⋯', 'u_m'].map((t, k) => cube(t, k < 3 ? VC.d : VC.c, [0.62, 1.8, 0.3], 3.6 + k * 0.62, 5.0, 0));
    sm('U：補成 ℝᵐ 的 orthonormal basis', 5.1, 3.85);
    note('V 補成 ℝⁿ、U 補成 ℝᵐ 的 orthonormal basis；null space 完全不是問題', 0, 2.8);
    cap('V、U 都補成整個空間的基底', 'null space 只會配到 0');
  },
  async (tok, S) => { // @706.3
    const tr2 = A29[0][0] + A29[1][1], dt = det2(A29), disc = tr2 * tr2 - 4 * dt;
    sm('真正的難處：像 A = [4 4; −3 3] 這種', -2.6, 1.8); mx(A29, 1.4, 1.8, 'ptr');
    S.b = bad('不對稱：不能用它的特徵向量（λ² − ' + tr2 + 'λ + ' + dt + ' = 0，判別式 ' + disc + ' < 0，連實數特徵向量都沒有）', 0, 0.9);
    cap('真正的問題：A 不對稱', '它的特徵向量不正交（這個例子甚至是複數）');
  },
  async (tok, S) => { // @725.1
    hot('還是要找 orthonormal 的 v、u，使 Av₁ = σ₁u₁、Av₂ = σ₂u₂', 0, 0.1);
    cap('要另外找出這些 orthonormal 向量', '');
  },
]);

scene('sv-l29-ata', 'L29：讓 U 消失 —— AᵀA = VΣᵀΣVᵀ', [
  async (tok, S) => { // @754.0
    hd('怎麼找 U、V、Σ？', 0, 7.3);
    S.L = ledger(-3.4, 6.5, 0.62); S.L.add('A V = U Σ（U、V 都是正交矩陣）'); S.L.add('兩邊右乘 V⁻¹：A = U Σ V⁻¹');
    cap('兩邊乘 V⁻¹', 'A = U Σ V⁻¹');
  },
  async (tok, S) => { // @769.6
    S.L.add('正方形正交矩陣：V⁻¹ = Vᵀ → A = U Σ Vᵀ', 'ptr');
    cap('V⁻¹ 就是 Vᵀ', 'A = U Σ Vᵀ');
  },
  async (tok, S) => { // @788.3
    S.L.add('兩個正交矩陣不想一次找 → 先讓 U 消失', 'ptr alt');
    cap('兩個未知的正交矩陣', '想辦法讓 U 消失，只剩 V');
  },
  async (tok, S) => { // @819.9
    S.L.add('用 AᵀA：the great matrix（對稱、半正定）');
    cap('用 AᵀA', '對稱，而且（半）正定');
  },
  async (tok, S) => { // @841.1
    S.L.add('Aᵀ = V Σᵀ Uᵀ');
    cap('先轉置：Aᵀ = V Σᵀ Uᵀ', '');
  },
  async (tok, S) => { // @861.5
    S.L.add('AᵀA = V Σᵀ Uᵀ U Σ Vᵀ（六個因子）');
    cap('看起來更糟：六個東西乘在一起', '但它會整個縮起來');
  },
  async (tok, S) => { // @870.2
    S.R = ledger(3.6, 6.5, 0.62);
    S.R.add('UᵀU = I：U 不見了！', 'ptr alt');
    cap('UᵀU = I', 'U 不見了');
  },
  async (tok, S) => { // @881.5
    S.R.add('ΣᵀΣ = 對角：σ₁²、σ₂²、…');
    cap('ΣᵀΣ 是對角，放 σ²', '');
  },
  async (tok, S) => { // @892.0
    S.R.add('AᵀA = V [σ₁² 0; 0 σ₂²] Vᵀ', 'ptr');
    cap('AᵀA = V (σ²) Vᵀ', '只剩 V 要選');
  },
  async (tok, S) => { // @917.7
    S.R.add('= Q Λ Qᵀ：V 是 AᵀA 的特徵向量');
    cap('V 的 columns：AᵀA 的特徵向量', 'σ² 是它的特徵值');
  },
  async (tok, S) => { // @954.8
    S.R.add('AᵀA 半正定 → λ = σ² ≥ 0');
    cap('特徵值都 ≥ 0', '因為 AᵀA 正定（或半正定）');
  },
  async (tok, S) => { // @970.6
    S.R.add('U：反過來乘 AAᵀ = U ΣΣᵀ Uᵀ');
    cap('U 怎麼找？看 AAᵀ', 'V 夾在中間被消掉');
  },
  async (tok, S) => { // @986.6
    const ATA = mm(tr(A29), A29), chk = eqM(ATA, mm(A29v, mm(dg(2, 2, [32, 18]), tr(A29v))));
    hot('V = AᵀA 的特徵向量；U = AAᵀ 的特徵向量；σ = √λ（取正的）', 0, 0.6);
    ok(chk, 0, -0.1, '例一檢查：AᵀA = [25 7; 7 25] = V·diag(32, 18)·Vᵀ');
    cap('整體做法', 'V ← AᵀA，U ← AAᵀ，σ 取正平方根');
  },
]);

scene('sv-l29-ex1v', 'L29 例一：A = [4 4; −3 3] 的 V 與 Σ', [
  async (tok, S) => { // @1010.2
    hd('例一', -5.6, 7.2); S.mA = mx(A29, -3.9, 7.2, 'ptr'); sm('A =', -5.0, 7.2);
    S.B = board2(3.4, 3.2, 0.72, [-3, 3], [-3, 3]); sm('AᵀA 的特徵向量', 3.4, 5.75);
    cap('用例一實際做一次', '這是要會算的部分');
  },
  async (tok, S) => { // @1026.0
    sm('第一步：算 AᵀA（要它的特徵向量）', -3.4, 6.3);
    cap('第一步：算 AᵀA', '');
  },
  async (tok, S) => { // @1035.9
    sm('Aᵀ', -5.5, 5.6); mx(tr(A29), -5.5, 4.95); sm('A', -3.9, 5.6); mx(A29, -3.9, 4.95); pl('=', -2.9, 4.95);
    cap('Aᵀ = [4 −3; 4 3] 乘 A', '');
  },
  async (tok, S) => { // @1046.8
    S.r = grid([['25', ''], ['', '']], -2.2, 5.25, VC.a, 0.62);
    cap('16 + 9 = 25', '');
  },
  async (tok, S) => { // @1052.5
    setLbl(S.r.c[0][1], 7); setLbl(S.r.c[1][0], 7); tint(S.r.c[0][1], VC.a); tint(S.r.c[1][0], VC.a);
    cap('16 − 9 = 7', '應該要對稱');
  },
  async (tok, S) => { // @1061.0
    setLbl(S.r.c[1][1], 25); tint(S.r.c[1][1], VC.a);
    const M = mm(tr(A29), A29); S.ATA = M;
    ok(eqM(M, [[25, 7], [7, 25]]) && isSym(M), -3.4, 3.85, 'AᵀA = [25 7; 7 25]，對稱');
    cap('AᵀA = [25 7; 7 25]', '');
  },
  async (tok, S) => { // @1064.2
    note('特徵向量 → v；特徵值 → σ²', -3.4, 3.2);
    cap('它的特徵向量是 v，特徵值是 σ²', '');
  },
  async (tok, S) => { // @1089.9
    S.x1 = arrow(VC.a, 0.055).set(S.B(0, 0), W(S.B, [1, 1])).label('(1, 1)', 'ptr');
    cap('(1, 1) 是特徵向量', '');
  },
  async (tok, S) => { // @1107.1
    const y = mv(S.ATA, [1, 1]);
    S.l1 = rod(VC.a, 0.018).set(W(S.B, [-2.9, -2.9]), W(S.B, [2.9, 2.9]));
    ok(eqV(y, [32, 32]), -3.4, 2.5, 'AᵀA(1, 1) = (32, 32) = 32·(1, 1)：λ₁ = 32');
    cap('乘出來 (32, 32)', '= 32 × (1, 1)');
  },
  async (tok, S) => { // @1138.7
    S.x2 = arrow(VC.b, 0.055).set(S.B(0, 0), W(S.B, [1, -1])).label('(1, −1)', 'ptr');
    cap('(1, −1) 配哪個特徵值？', '');
  },
  async (tok, S) => { // @1149.1
    const y = mv(S.ATA, [1, -1]);
    rod(VC.b, 0.018).set(W(S.B, [-2.9, 2.9]), W(S.B, [2.9, -2.9]));
    ok(eqV(y, [18, -18]), -3.4, 1.9, 'AᵀA(1, −1) = (18, −18)：λ₂ = 18');
    cap('乘出來是 18 倍', '');
  },
  async (tok, S) => { // @1160.9
    await anim(tok, 900, (k) => { const s = 1 - k * (1 - 1 / R2); S.x1.set(S.B(0, 0), W(S.B, [s, s])); S.x2.set(S.B(0, 0), W(S.B, [s, -s])); });
    S.x1.label('v₁ = (1, 1)/√2', 'ptr'); S.x2.label('v₂ = (1, −1)/√2', 'ptr');
    cap('還沒單位化：除以長度 √2', '');
  },
  async (tok, S) => { // @1180.2
    ok(near(norm(unit([1, 1])), 1) && eqV(mv(S.ATA, unit([1, 1])), mul(32, unit([1, 1]))), -3.4, 1.3, '單位化後長度 1，特徵值還是 32、18');
    cap('單位化不改變 32 和 18', 'v 決定了');
  },
  async (tok, S) => { // @1202.0
    pl('A  =  U  ·  Σ  ·  Vᵀ', -3.4, 0.5); sm('U 還不知道', -4.1, -0.05);
    cap('拼起來：A = U Σ Vᵀ', 'U 還不知道');
  },
  async (tok, S) => { // @1233.5
    sm('Σ =', -1.6, -0.75); mx([['√32', '0'], ['0', '√18']], -0.5, -0.75, 'ptr');
    cap('σ = √32、√18', '取特徵值的平方根');
  },
  async (tok, S) => { // @1251.7
    sm('Vᵀ =', 1.6, -0.75); mx(tr(A29v), 2.9, -0.75, 'ptr');
    cap('Vᵀ：把 v₁、v₂ 放成兩列', '');
  },
]);

scene('sv-l29-ex1u', 'L29 例一：用 AAᵀ 找 U —— 符號出錯', [
  async (tok, S) => { // @1271.3
    hd('最後找 U', -3.4, 7.2); pl('A = U · Σ · Vᵀ', -3.4, 6.55);
    S.B = board2(3.4, 3.2, 0.72, [-3, 3], [-3, 3]); sm('AAᵀ 的特徵向量', 3.4, 5.75);
    cap('最後要找 U', '老師用 AAᵀ 的方法');
  },
  async (tok, S) => { // @1294.3
    pl('AAᵀ = UΣVᵀ·VΣᵀUᵀ = U ΣΣᵀ Uᵀ', -3.4, 5.9); sm('（中間 VᵀV = I）', -3.4, 5.4);
    cap('AAᵀ = U ΣΣᵀ Uᵀ', '中間 VᵀV = I');
  },
  async (tok, S) => { // @1356.2
    sm('A', -5.5, 4.85); mx(A29, -5.5, 4.25); sm('Aᵀ', -3.9, 4.85); mx(tr(A29), -3.9, 4.25); pl('=', -2.9, 4.25);
    S.r = grid([['', ''], ['', '']], -2.2, 4.55, VC.d, 0.62);
    cap('U 是 AAᵀ 的特徵向量', '算 AAᵀ');
  },
  async (tok, S) => { // @1395.5
    setLbl(S.r.c[0][0], 32); tint(S.r.c[0][0], VC.d);
    cap('16 + 16 = 32', '');
  },
  async (tok, S) => { // @1399.8
    setLbl(S.r.c[0][1], 0); setLbl(S.r.c[1][0], 0);
    cap('這格是 0', '');
  },
  async (tok, S) => { // @1401.6
    setLbl(S.r.c[1][1], 18); tint(S.r.c[1][1], VC.d); S.AAT = mm(A29, tr(A29));
    ok(eqM(S.AAT, [[32, 0], [0, 18]]), -3.4, 3.15, 'AAᵀ = [32 0; 0 18]：剛好是對角');
    cap('運氣好：AAᵀ 是對角矩陣', '');
  },
  async (tok, S) => { // @1419.0
    S.e1 = arrow(VC.d, 0.055).set(S.B(0, 0), W(S.B, [1, 0])).label('(1, 0)', 'ptr');
    ok(eqV(mv(S.AAT, [1, 0]), [32, 0]), -3.4, 2.55, 'AAᵀ(1, 0) = 32·(1, 0)');
    cap('(1, 0)：特徵值 32', '');
  },
  async (tok, S) => { // @1432.0
    S.e2 = arrow(VC.c, 0.055).set(S.B(0, 0), W(S.B, [0, 1])).label('(0, 1)', 'ptr');
    ok(eqV(mv(S.AAT, [0, 1]), [0, 18]), -3.4, 1.95, 'AAᵀ(0, 1) = 18·(0, 1)');
    cap('(0, 1)：特徵值 18', '');
  },
  async (tok, S) => { // @1454.2
    note('又是 32、18：AB 和 BA 的特徵值一樣', -3.4, 1.35);
    cap('又是 32 和 18', 'AB 與 BA 特徵值相同，不意外');
  },
  async (tok, S) => { // @1507.7
    sm('老師選的 U =', -5.0, 0.6); mx(eye(2), -3.6, 0.6, 'ptr'); sm('（最好的正交矩陣：I）', -1.6, 0.6);
    cap('U = I', '看起來最漂亮');
  },
  async (tok, S) => { // @1542.2
    const r1 = mm(eye(2), mm(dg(2, 2, A29s), tr(A29v)))[0];
    S.c1 = ok(eqV(r1, A29[0]), -3.4, -0.05, '第一列：√32·(1, 1)/√2 = (4, 4)，對');
    cap('檢查：√32 / √2 = 4', '第一列 (4, 4) 對了');
  },
  async (tok, S) => { // @1557.5
    const r2 = mm(eye(2), mm(dg(2, 2, A29s), tr(A29v)))[1];
    S.c2 = bad('第二列：√18·(1, −1)/√2 = (' + frac(r2[0]) + ', ' + frac(r2[1]) + ')，但 A 是 (−3, 3)', -3.4, -0.65);
    cap('第二列卻是 (3, −3)', 'A 的第二列是 (−3, 3)，符號反了');
  },
  async (tok, S) => { // @1594.3
    S.e2.kill(); S.e2 = arrow(VC.r, 0.055).set(S.B(0, 0), W(S.B, [0, -1])).label('−(0, 1)', 'ptr alt');
    ok(eqV(mv(S.AAT, [0, -1]), [0, -18]), 3.4, -0.1, '換號後還是特徵向量：AAᵀ(0, −1) = 18·(0, −1)');
    cap('特徵向量換號還是特徵向量', '可以在那裡放負號');
  },
  async (tok, S) => { // @1615.3
    const u2 = A29uGood[1];
    note('問題出在：AAᵀ 決定不了 u 的正負號（L32 複習課老師自己說明）', 0, -1.3);
    ok(eqV(u2, [0, -1]), 0, -1.9, '正確做法：u₂ = Av₂ / σ₂ = (0, −6/√2)/√18 = (0, −1)');
    cap('哪裡出錯？', '符號要由 Av = σu 決定');
  },
  async (tok, S) => { // @1649.6
    hot('U = [1 0; 0 −1] 時 UΣVᵀ = A' + (SVD29_OK ? ' ✓' : ' ✘') + '；σ 仍然是正的', 3.4, -0.75);
    cap('有了那個負號就全對', 'Σ 的對角線維持正數');
  },
]);

scene('sv-l29-ex2', 'L29 例二：rank 1 的 A = [4 3; 8 6]', [
  async (tok, S) => { // @1688.5
    hd('例二：singular 的矩陣（rank 1）', 0, 7.2);
    cap('第二個例子：singular', 'rank 1');
  },
  async (tok, S) => { // @1716.3
    sm('A =', -1.0, 6.45); mx(A2, 0.1, 6.45, 'ptr');
    ok(rank(A2) === 1, 2.9, 6.45, 'rank 1：第二列 = 2 × 第一列');
    cap('A = [4 3; 8 6]', 'rank 1');
  },
  async (tok, S) => { // @1730.8
    S.L = board2(-3.4, 3.0, 1.0, [-2.4, 2.4], [-2.4, 2.4]); S.R = board2(3.4, 3.0, 1.0, [-2.4, 2.4], [-2.4, 2.4]);
    sm('輸入 ℝ²', -3.4, 5.65); sm('輸出 ℝ²', 3.4, 5.65);
    cap('有 null space', 'row space、column space 都只有 1 維');
  },
  async (tok, S) => { // @1749.5
    lineThrough(S.L, [4, 3], 2.3, VC.a); sm('row space：(4, 3) 的倍數', -4.6, 5.25);
    cap('row space：(4, 3) 的倍數', '只是一條線');
  },
  async (tok, S) => { // @1769.2
    lineThrough(S.L, [-3, 4], 2.3, VC.b); sm('null space', -5.2, 1.0);
    ok(eqV(mv(A2, [3, -4]), [0, 0]), -3.4, 0.25, 'A(3, −4) = 0');
    cap('null space：垂直的那條線', '');
  },
  async (tok, S) => { // @1786.2
    lineThrough(S.R, [1, 2], 2.3, VC.d); sm('column space：(4, 8)、(3, 6) ∥ (1, 2)', 4.4, 5.25);
    cap('column space：(1, 2) 的倍數', '兩個 column 都在同一條線上');
  },
  async (tok, S) => { // @1821.4
    lineThrough(S.R, [2, -1], 2.3, VC.c); sm('N(Aᵀ)', 5.6, 1.6);
    cap('N(Aᵀ)：垂直的那條', '');
  },
  async (tok, S) => { // @1855.4
    S.v1 = arrow(VC.a, 0.06).set(S.L(0, 0), W(S.L, [0.8, 0.6])).label('v₁ = (.8, .6)', 'ptr');
    cap('v₁：把 (4, 3) 變成單位向量', '(0.8, 0.6)');
  },
  async (tok, S) => { // @1890.3
    S.u1 = arrow(VC.d, 0.06).set(S.R(0, 0), W(S.R, unit([1, 2]))).label('u₁ = (1, 2)/√5', 'ptr');
    cap('u₁：(1, 2) 除以 √5', '');
  },
  async (tok, S) => { // @1955.8
    sm('Σ =', -1.0, -0.4); S.Sg = mx([['σ₁', '0'], ['0', '0']], 0.1, -0.4, 'ptr');
    cap('Σ：只有一個 σ₁，其他是 0', 'rank 1');
  },
  async (tok, S) => { // @1990.5
    const M = mm(tr(A2), A2); S.ATA = M;
    sm('AᵀA =', -5.6, -0.4); mx(M, -4.3, -0.4);
    ok(eqM(M, [[80, 60], [60, 45]]) && rank(M) === 1, -4.6, -1.1, '16+64 = 80、12+48 = 60、9+36 = 45；rank 1');
    cap('σ 從 AᵀA 來', 'AᵀA = [80 60; 60 45]');
  },
  async (tok, S) => { // @2044.1
    const { vals } = symEig(S.ATA);
    gone(S.Sg); S.Sg = mx([['√125', '0'], ['0', '0']], 0.1, -0.4, 'ptr');
    ok(near(vals[0], 125, 1e-7) && near(vals[1], 0, 1e-7), 1.6, -1.1, 'λ = 125、0（trace 125、rank 1）→ σ₁ = √125');
    cap('特徵值 0 和 125', 'σ₁ = √125');
  },
  async (tok, S) => { // @2077.3
    S.v2 = arrow(VC.b, 0.06).set(S.L(0, 0), W(S.L, [0.6, -0.8])).label('v₂ = (.6, −.8)', 'ptr');
    cap('v₂：null space 方向', '(0.6, −0.8)');
  },
  async (tok, S) => { // @2116.6
    S.u2 = arrow(VC.c, 0.06).set(S.R(0, 0), W(S.R, unit([2, -1]))).label('u₂ = (2, −1)/√5', 'ptr');
    cap('u₂：補成 orthonormal basis', '(2, −1)/√5');
  },
  async (tok, S) => { // @2160.8
    const U = msc([[1, 2], [2, -1]], 1 / Math.sqrt(5)), Vt = [[0.8, 0.6], [0.6, -0.8]];
    const prod = mm(U, mm(dg(2, 2, [Math.sqrt(125), 0]), Vt));
    ok(eqM(prod, A2) && eqM(mm(U, tr(U)), eye(2)) && eqM(mm(Vt, tr(Vt)), eye(2)), 0, -1.75, 'UΣVᵀ = A：√125 / √5 = 5，乘回整數 [4 3; 8 6]');
    cap('乘回去：√5 消掉 → 5', '得到 A');
  },
  async (tok, S) => { // @2185.4
    S.v2.glow('#6a4a00'); dotAt(S.R(0, 0), VC.r, 0.13);
    ok(eqV(mv(A2, [0.6, -0.8]), [0, 0]), -3.4, 0.25 - 0.6, 'Av₂ = 0：null space 的向量乘到 0');
    cap('null space 的那些只乘到 0', '關鍵在 row space 與 column space');
  },
]);

scene('sv-l29-four', 'L29：SVD = 四個子空間的正交基', [
  async (tok, S) => { // @2245.6
    hd('其實是在替四個基本子空間選「對的」基底', 0, 7.2);
    const mk = (t, c, x, y) => { const m = cube('', c, [3.2, 1.3, 0.4], x, y, 0); return { m, l: hot(t, x, y + 0.95) }; };
    S.row = mk('row space（r 維）', VC.pale, -3.6, 4.6); S.nul = mk('null space（n − r 維）', VC.pale, -3.6, 1.8);
    S.col = mk('column space（r 維）', VC.pale, 3.6, 4.6); S.lnul = mk('N(Aᵀ)（m − r 維）', VC.pale, 3.6, 1.8);
    cap('SVD：四個子空間的對的基底', '');
  },
  async (tok, S) => { // @2257.0
    tint(S.row.m, VC.a); pl('v₁ … v_r', -3.6, 4.6);
    cap('v₁ … v_r：row space 的 orthonormal basis', '');
  },
  async (tok, S) => { // @2278.3
    tint(S.col.m, VC.d); pl('u₁ … u_r', 3.6, 4.6);
    cap('u₁ … u_r：column space 的基底', 'orthonormal basis');
  },
  async (tok, S) => { // @2289.1
    tint(S.nul.m, VC.b); pl('v_{r+1} … v_n', -3.6, 1.8);
    cap('v_{r+1} … v_n：null space', '');
  },
  async (tok, S) => { // @2305.4
    tint(S.lnul.m, VC.c); pl('u_{r+1} … u_m', 3.6, 1.8);
    cap('u_{r+1} … u_m：N(Aᵀ)', '左零空間');
  },
  async (tok, S) => { // @2335.0
    arrow(VC.k, 0.06).set(V3(-1.9, 4.6, 0), V3(1.9, 4.6, 0)).label('A vᵢ = σᵢ uᵢ', 'ptr');
    note('Gram-Schmidt 也給得出正交基；這裡要用特徵值，才能讓矩陣變對角', 0, 0.4);
    cap('Avᵢ = σᵢuᵢ', '要用特徵值，基底才會讓 A 變對角');
  },
  async (tok, S) => { // @2357.4
    arrow(VC.r, 0.04).set(V3(-1.9, 1.8, 0), V3(-0.25, 3.0, 0)); dotAt(V3(0, 3.1, 0), VC.r, 0.13); sm('0', 0, 3.5);
    sm('v 之間、u 之間互不牽扯：每個 v 只對到自己的 u', 0, -0.3);
    cap('沒有交叉牽連', '每個 v 只對到同一號的 u');
  },
  async (tok, S) => { // @2381.7
    const r = rank(A2);
    ok(r === 1, 0, -1.0, '維度：r、r、n − r、m − r（例二：' + r + '、' + r + '、' + (2 - r) + '、' + (2 - r) + '）');
    cap('維度：r、r、n − r、m − r', '要幾個基底向量就是幾維');
  },
]);

// ════════ f8DVtPvqtwc（SVD Step-By-Step）：A = [1 1; 1 0; 0 1] ════════
// 影片的 A 沒唸出來；由影片給的 AᵀA = [2 1; 1 2]、u₁、u₂、u₃、echelon form 反推，唯一就是這個 A（程式逐項核對）。
const AF = [[1, 1], [1, 0], [0, 1]];
const AF_ech = [AF[0], sub(AF[1], AF[0]), add(AF[2], sub(AF[1], AF[0]))]; // R2 − R1、R3 + (新 R2)
const AF_ATA = mm(tr(AF), AF);
const AF_v = [[1 / R2, 1 / R2], [-1 / R2, 1 / R2]];
const AF_s = [Math.sqrt(3), 1];
const AF_u = [mul(1 / AF_s[0], mv(AF, AF_v[0])), mul(1 / AF_s[1], mv(AF, AF_v[1])), mul(1 / Math.sqrt(3), [-1, 1, 1])];
const AF_U = colsM(AF_u), AF_V = colsM(AF_v), AF_S = dg(3, 2, AF_s);
const AF_OK = eqM(mm(AF_U, mm(AF_S, tr(AF_V))), AF) && eqM(mm(tr(AF_U), AF_U), eye(3)) && eqM(mm(tr(AF_V), AF_V), eye(2));
const AG = [[2, 2], [-1, 1]]; // 示意：畫「轉 → 伸縮 → 轉」用的 2×2

scene('sv-f8-sigma', 'SVD 結構（一）：Σ 是伸縮', [
  async (tok, S) => { // @24.4
    hd('SVD 的結構', -3.4, 7.2);
    cap('先看 SVD 的結構', '看懂結構，任何矩陣都會分解');
  },
  async (tok, S) => { // @40.4
    pl('A：任何 m × n 矩陣，rank r', -3.4, 6.5);
    cap('A 是任何 m × n、rank r 的矩陣', '');
  },
  async (tok, S) => { // @48.9
    pl('A =', -6.0, 5.4);
    S.U = cube('U', VC.a, [1.1, 1.1, 0.3], -4.8, 5.4, 0, 2); S.Sg = cube('Σ', VC.g, [1.1, 1.1, 0.3], -3.4, 5.4, 0, 2); S.V = cube('Vᵀ', VC.c, [1.1, 1.1, 0.3], -2.0, 5.4, 0, 2);
    cap('A = U Σ Vᵀ', '');
  },
  async (tok, S) => { // @66.9
    glow(S.Sg, GOLD);
    sm('第一個要找的：Σ（m × n 對角，和 A 一樣大）＝ 伸縮', -3.4, 4.45);
    S.B = board2(3.6, 3.0, 0.62, [-3.6, 3.6], [-3.4, 3.4]); sm('示意：Σ = diag(2√2, √2) 把圓沿座標軸拉長', 3.6, 5.45);
    const cp = circlePts(); poly(cp.map((u) => W(S.B, u)), '#d8cfc0', true);
    const sh = poly(cp.map((u) => W(S.B, u)), VC.g, true), s = svd2(AG);
    await anim(tok, 1500, (k) => sh.setPts(cp.map((u) => W(S.B, [u[0] * (1 + (s.s1 - 1) * k), u[1] * (1 + (s.s2 - 1) * k)]))));
    cap('第一步找 Σ', '它代表「伸縮」');
  },
  async (tok, S) => { // @82.7
    sm('對角線：σ₁、σ₂ … σ_r（singular values，都是正的）', -3.4, 3.85);
    cap('對角線上是 σ₁ … σ_r', '叫 singular values，都是正數');
  },
  async (tok, S) => { // @94.5
    const e1 = symEig(mm(tr(AG), AG)).vals, e2 = symEig(mm(AG, tr(AG))).vals;
    sm('σᵢ = √λᵢ，λᵢ = AᵀA 與 AAᵀ 的非零特徵值', -3.4, 3.25);
    ok(eqV(e1, e2, 1e-9), -3.4, 2.65, '示意 A = [2 2; −1 1]：AᵀA、AAᵀ 特徵值都是 ' + e1.map((x) => f2(x)).join('、'));
    cap('σᵢ = √λᵢ', 'AᵀA 和 AAᵀ 都對稱，非零特徵值相同');
  },
  async (tok, S) => { // @113.5
    S.g1 = grid([['σ₁', '0'], ['0', 'σ₂'], ['0', '0']], -6.2, 1.8, VC.g, 0.48); sm('m > n：多出 m − r 列 0', -5.7, 0.05);
    cap('A 的列比行多', 'Σ 下面多出 m − r 列 0');
  },
  async (tok, S) => { // @127.6
    S.g2 = grid([['σ₁', '0', '0'], ['0', 'σ₂', '0']], -3.6, 1.8, VC.g, 0.48); sm('m < n：多出 n − r 行 0', -3.1, 0.05);
    cap('行比列多', 'Σ 右邊多出 n − r 行 0');
  },
  async (tok, S) => { // @140.3
    S.g3 = grid([['σ₁', '0', '0'], ['0', 'σ₂', '0'], ['0', '0', '0']], -0.9, 1.8, VC.g, 0.48); sm('方陣、rank 2：m − r 列、n − r 行 0', -0.4, -0.5);
    cap('方陣但 rank 不足', '多出 m − r 列與 n − r 行的 0');
  },
]);

scene('sv-f8-uv', 'SVD 結構（二）：V、U 是旋轉或反射', [
  async (tok, S) => { // @153.3
    hd('第二個矩陣：V', -3.4, 7.2);
    S.st = svdStages(AG); S.s = S.st.s;
    S.B = board2(3.6, 3.0, 0.62, [-3.6, 3.6], [-3.4, 3.4]); sm('示意 A = [2 2; −1 1]：單位圓與 v₁、v₂', 3.6, 5.45);
    const cp = circlePts(); S.cp = cp; poly(cp.map((u) => W(S.B, u)), '#d8cfc0', true);
    S.sh = poly(cp.map((u) => W(S.B, u)), VC.c, true); S.a1 = arrow(VC.a, 0.05); S.a2 = arrow(VC.b, 0.05);
    S.draw = (M) => { S.sh.setPts(cp.map((u) => W(S.B, mv(M, u)))); S.a1.set(S.B(0, 0), W(S.B, mv(M, S.s.v1))); S.a2.set(S.B(0, 0), W(S.B, mv(M, S.s.v2))); };
    S.draw(I2); S.a1.label('v₁', 'ptr'); S.a2.label('v₂', 'ptr');
    cap('第二個要找的是 V', '');
  },
  async (tok, S) => { // @166.5
    pl('V：n × n 正交矩陣 ＝ 旋轉（或反射）', -3.4, 6.5);
    await anim(tok, 1500, (k) => S.draw(S.st.at[1](k)));
    S.a1.label('Vᵀv₁ = e₁', 'ptr'); S.a2.label('Vᵀv₂ = e₂', 'ptr');
    cap('V 是 n × n 正交矩陣', '代表旋轉或反射：Vᵀ 把 v₁、v₂ 轉到座標軸');
  },
  async (tok, S) => { // @176.5
    const V = colsM([S.s.v1, S.s.v2]);
    ok(eqM(mm(tr(V), V), eye(2)), -3.4, 5.9, 'V 的 columns 是 orthonormal：VᵀV = I');
    cap('V 的 columns 是 orthonormal 向量', '');
  },
  async (tok, S) => { // @180.4
    sm('前 r 個 columns：AᵀA 的單位特徵向量（right singular vectors）', -3.4, 5.3);
    cap('前 r 個：AᵀA 單位化的特徵向量', '叫 right singular vectors');
  },
  async (tok, S) => { // @191.6
    sm('後 n − r 個：A 的 null space 裡的單位向量', -3.4, 4.75);
    cap('後 n − r 個：在 A 的 null space 裡', '');
  },
  async (tok, S) => { // @199.7
    hd('最後一個：U', -3.4, 3.95);
    cap('最後要找的是 U', '');
  },
  async (tok, S) => { // @206.9
    pl('U：m × m 正交矩陣', -3.4, 3.35);
    cap('U 也是方陣：m × m 正交矩陣', '');
  },
  async (tok, S) => { // @211.4
    const VT = rotM(-angOf(S.s.V));
    await anim(tok, 1100, (k) => S.draw(mm(S.st.at[2](k), VT)));
    await anim(tok, 1100, (k) => S.draw(mm(S.st.at[3](k), VT)));
    S.a1.label('σ₁u₁', 'ptr alt'); S.a2.label('σ₂u₂', 'ptr alt');
    poly(S.cp.map((u) => W(S.B, mv(AG, u))), VC.b, true);
    ok(eqM(mm(S.s.U, mm([[S.s.s1, 0], [0, S.s.s2]], tr(S.s.V))), AG), 3.6, -0.6, '轉（Vᵀ）→ 伸縮（Σ）→ 轉（U）＝ 直接乘 A 的橢圓');
    cap('U 也代表旋轉或反射', '轉 → 伸縮 → 轉，就是 A');
  },
  async (tok, S) => { // @219.5
    sm('U 的 columns orthonormal；前 r 個：AAᵀ 的單位特徵向量', -3.4, 2.75);
    cap('U 的前 r 個：AAᵀ 的特徵向量', '');
  },
  async (tok, S) => { // @231.0
    note('注意：是 AAᵀ，不是找 V 用的 AᵀA', -3.4, 2.15);
    cap('注意是 AAᵀ', '和找 V 的 AᵀA 不一樣');
  },
  async (tok, S) => { // @238.8
    sm('後 m − r 個：Aᵀ 的 null space 裡的單位向量', -3.4, 1.55);
    cap('後 m − r 個：在 N(Aᵀ) 裡', '');
  },
  async (tok, S) => { // @247.8
    hot('實際上：用已經找到的 V 來算 U 比較簡單', -3.4, 0.85);
    cap('實務上由 V 算出 U', '比較容易');
  },
  async (tok, S) => { // @255.3
    pl('A = UΣVᵀ 兩邊右乘 V：AV = UΣ（VᵀV = I）', -3.4, 0.2);
    cap('兩邊乘 V：AV = UΣ', '因為 VᵀV = I');
  },
  async (tok, S) => { // @274.0
    const u1 = mul(1 / S.s.s1, mv(AG, S.s.v1));
    hot('Avᵢ = σᵢuᵢ ⇒ uᵢ = Avᵢ / σᵢ', -3.4, -0.45);
    ok(eqV(u1, S.s.u1), -3.4, -1.05, '示意例子：Av₁/σ₁ 正好是 u₁');
    cap('Avᵢ = σᵢuᵢ', '直接算出 uᵢ = Avᵢ / σᵢ');
  },
]);

scene('sv-f8-step1', '步驟一：三個矩陣的大小與 rank', [
  async (tok, S) => { // @287.6
    hd('例題：求 A 的 SVD', 0, 7.2);
    cap('了解結構後，開始做例題', '');
  },
  async (tok, S) => { // @299.6
    hot('步驟一：三個矩陣的大小、A 的 rank', 0, 6.5);
    cap('步驟一：大小與 rank', '');
  },
  async (tok, S) => { // @307.4
    sm('A =', -5.8, 5.2); S.mA = mx(AF, -4.8, 5.2, 'ptr'); pl('=  U  Σ  Vᵀ', -3.0, 5.2);
    sm('（影片沒唸出 A；由影片後面算出的 AᵀA、U、Σ、V 反推，唯一就是它）', 0, 3.95);
    cap('A 分解成 U、Σ、Vᵀ', '');
  },
  async (tok, S) => { // @318.1
    S.U = cube('U\n3×3', VC.a, [1.3, 1.3, 0.3], 0.2, 5.3, 0, 2);
    cap('A 是 3 × 2，所以 U 是 3 × 3', 'U 一定是方陣');
  },
  async (tok, S) => { // @327.1
    S.S = cube('Σ\n3×2', VC.g, [1.0, 1.3, 0.3], 1.8, 5.3, 0, 2);
    cap('Σ 和 A 一樣大：3 × 2', '');
  },
  async (tok, S) => { // @331.5
    S.V = cube('Vᵀ\n2×2', VC.c, [1.0, 1.0, 0.3], 3.2, 5.3, 0, 2);
    cap('V 也是方陣：2 × 2', '');
  },
  async (tok, S) => { // @337.4
    sm('rank：化成 echelon form，數 pivot', -3.0, 2.9);
    cap('求 rank：化成 echelon form', '數 pivot 有幾個');
  },
  async (tok, S) => { // @346.1
    sm('R₂ − R₁，R₃ + R₂ →', -4.2, 1.9); S.E = grid(AF_ech, -1.6, 2.4, VC.a, 0.6);
    cap('echelon form', '[1 1; 0 −1; 0 0]');
  },
  async (tok, S) => { // @352.4
    glow(S.E.c[0][0], GOLD); glow(S.E.c[1][1], GOLD);
    ok(rank(AF) === 2 && AF_ech[2].every((x) => x === 0), 2.6, 1.8, '兩個 pivot → r = 2');
    cap('圈出 pivot：兩個', 'r = 2');
  },
  async (tok, S) => { // @366.3
    note('知道 r，就知道 U、V 的向量要從哪裡來', 0, 0.3);
    cap('rank 決定 U、V 的向量從哪裡找', '');
  },
]);

scene('sv-f8-step2', '步驟二：求 Σ（σ = √λ(AᵀA)）', [
  async (tok, S) => { // @375.5
    hd('步驟二：求 Σ（3 × 2 對角）', -3.0, 7.2);
    S.G = grid([['', ''], ['', ''], ['', '']], 3.6, 6.6, VC.pale, 0.6); sm('Σ', 4.0, 7.3);
    cap('步驟二：求 Σ', '和 A 一樣是 3 × 2');
  },
  async (tok, S) => { // @385.8
    setLbl(S.G.c[0][0], 'σ₁'); setLbl(S.G.c[1][1], 'σ₂'); tint(S.G.c[0][0], VC.g); tint(S.G.c[1][1], VC.g);
    cap('rank 2：對角線上 σ₁、σ₂', '');
  },
  async (tok, S) => { // @397.6
    pl('σᵢ = √λᵢ，λᵢ：AᵀA 的非零特徵值', -3.0, 6.4);
    cap('σᵢ = √λᵢ', 'λ 是 AᵀA 的非零特徵值');
  },
  async (tok, S) => { // @408.8
    [0, 1].forEach((j) => setLbl(S.G.c[2][j], '0')); setLbl(S.G.c[0][1], '0'); setLbl(S.G.c[1][0], '0');
    cap('m > n：多一列 0', '');
  },
  async (tok, S) => { // @428.9
    sm('Aᵀ', -5.6, 5.6); mx(tr(AF), -5.6, 5.05); sm('A', -3.6, 5.6); mx(AF, -3.6, 4.85); pl('=', -2.5, 5.05);
    cap('先算 AᵀA', '');
  },
  async (tok, S) => { // @445.7
    S.mATA = mx(AF_ATA, -1.6, 5.05, 'ptr');
    ok(eqM(AF_ATA, [[2, 1], [1, 2]]), -1.6, 4.25, 'AᵀA = [2 1; 1 2]');
    cap('AᵀA = [2 1; 1 2]', '');
  },
  async (tok, S) => { // @457.4
    pl('det(AᵀA − λI) = 0', -3.0, 3.4);
    cap('特徵值：det(AᵀA − λI) = 0', '');
  },
  async (tok, S) => { // @467.5
    pl('|2 − λ  1; 1  2 − λ| = (2 − λ)² − 1 = 0', -3.0, 2.8);
    cap('(2 − λ)² − 1 = 0', '');
  },
  async (tok, S) => { // @480.2
    const { vals } = symEig(AF_ATA);
    ok(near(vals[0], 3) && near(vals[1], 1), -3.0, 2.2, 'λ = 3、1');
    cap('λ = 3 和 1', '');
  },
  async (tok, S) => { // @485.0
    note('SVD 慣例：第一個放最大的 → λ₁ = 3、λ₂ = 1', -3.0, 1.6);
    cap('最大的放第一個', 'λ₁ = 3，λ₂ = 1');
  },
  async (tok, S) => { // @500.0
    pl('σ₁ = √3，σ₂ = √1 = 1', -3.0, 1.0);
    cap('σ₁ = √3，σ₂ = 1', '');
  },
  async (tok, S) => { // @514.9
    setLbl(S.G.c[0][0], '√3'); setLbl(S.G.c[1][1], '1');
    ok(AF_s[0] >= AF_s[1] && AF_s[1] > 0, 3.9, 4.4, 'Σ = [√3 0; 0 1; 0 0]');
    cap('Σ = [√3 0; 0 1; 0 0]', '');
  },
]);

scene('sv-f8-step3', '步驟三：求 V（AᵀA 的單位特徵向量）', [
  async (tok, S) => { // @536.6
    hd('步驟三：求 V（2 × 2 正交）', -3.0, 7.2);
    S.B = board2(3.6, 3.2, 1.0, [-2, 2], [-2, 2]); sm('AᵀA 的特徵向量', 3.6, 5.55);
    cap('步驟三：求 V', '2 × 2 正交矩陣');
  },
  async (tok, S) => { // @549.7
    sm('這題 n = r = 2：V 就是 AᵀA 的兩個單位特徵向量', -3.0, 6.5);
    cap('這題 n = r', 'V 只需要 AᵀA 的單位特徵向量');
  },
  async (tok, S) => { // @570.3
    pl('解 (AᵀA − λI)x = 0：化成 reduced echelon form', -3.0, 5.85);
    cap('解 (AᵀA − λI)x = 0', '化成 reduced echelon form');
  },
  async (tok, S) => { // @589.6
    sm('λ₁ = 3：', -5.6, 5.0); mx(madd(AF_ATA, msc(eye(2), -3)), -4.4, 5.0);
    cap('λ₁ = 3', '[2−3 1; 1 2−3] = [−1 1; 1 −1]');
  },
  async (tok, S) => { // @604.9
    const R = rref(madd(AF_ATA, msc(eye(2), -3))).R;
    pl('→', -3.4, 5.0); mx(R, -2.4, 5.0, 'ptr');
    ok(eqM(R, [[1, -1], [0, 0]]), -0.4, 5.0, '');
    cap('rref = [1 −1; 0 0]', '');
  },
  async (tok, S) => { // @612.8
    pl('x₁ = x₂ → x = x₂(1, 1)', -3.0, 4.3);
    cap('x₁ = x₂', 'x = x₂ · (1, 1)');
  },
  async (tok, S) => { // @626.5
    S.x1 = arrow(VC.a, 0.055).set(S.B(0, 0), W(S.B, [1, 1])).label('(1, 1)', 'ptr');
    cap('取 x₂ = 1：x = (1, 1)', '');
  },
  async (tok, S) => { // @639.4
    await anim(tok, 800, (k) => { const s = 1 - k * (1 - 1 / R2); S.x1.set(S.B(0, 0), W(S.B, [s, s])); });
    S.x1.label('v₁ = (1/√2, 1/√2)', 'ptr');
    ok(near(norm([1, 1]), R2) && eqV(mv(AF_ATA, AF_v[0]), mul(3, AF_v[0])), -3.0, 3.7, '|x| = √2 → v₁ = (1/√2, 1/√2)，AᵀAv₁ = 3v₁');
    cap('長度 √2', '單位化：v₁ = (1/√2, 1/√2)');
  },
  async (tok, S) => { // @658.3
    sm('λ₂ = 1：', -5.6, 2.9); mx(madd(AF_ATA, msc(eye(2), -1)), -4.4, 2.9);
    cap('λ₂ = 1', '[1 1; 1 1]');
  },
  async (tok, S) => { // @675.2
    const R = rref(madd(AF_ATA, msc(eye(2), -1))).R;
    pl('→', -3.4, 2.9); mx(R, -2.4, 2.9, 'ptr'); pl('x₁ = −x₂', -0.4, 2.9);
    cap('rref = [1 1; 0 0]', 'x₁ = −x₂');
  },
  async (tok, S) => { // @687.1
    S.x2 = arrow(VC.b, 0.055).set(S.B(0, 0), W(S.B, [-1, 1])).label('(−1, 1)', 'ptr');
    await anim(tok, 800, (k) => { const s = 1 - k * (1 - 1 / R2); S.x2.set(S.B(0, 0), W(S.B, [-s, s])); });
    S.x2.label('v₂ = (−1/√2, 1/√2)', 'ptr');
    ok(eqV(mv(AF_ATA, AF_v[1]), AF_v[1]), -3.0, 2.2, 'x = (−1, 1)，|x| = √2 → v₂；AᵀAv₂ = v₂');
    cap('x = (−1, 1)', '單位化得 v₂ = (−1/√2, 1/√2)');
  },
  async (tok, S) => { // @709.6
    sm('V =', -5.4, 1.2); mx(AF_V, -4.0, 1.2, 'ptr');
    rightAngle(S.B(0, 0), W(S.B, AF_v[0]).sub(S.B(0, 0)), W(S.B, AF_v[1]).sub(S.B(0, 0)), 0.25);
    ok(eqM(mm(tr(AF_V), AF_V), eye(2)), -1.4, 1.2, 'VᵀV = I');
    cap('V = [v₁ v₂]', '');
  },
  async (tok, S) => { // @736.1
    note('若 n > r：再從 Ax = 0 補單位向量，多個時用 Gram-Schmidt 變正交', -0.6, 0.2);
    cap('補充：n > r 的情形', '從 Ax = 0 補，再 Gram-Schmidt');
  },
]);

scene('sv-f8-step4', '步驟四：求 U（uᵢ = Avᵢ/σᵢ，再補 N(Aᵀ)）', [
  async (tok, S) => { // @775.3
    S.sp = space3(1.15, V3(0, 2.4, 0), 2.6);
    hd('步驟四：求 U（3 × 3 正交）', -3.2, 7.0);
    cap('步驟四：求 U', '3 × 3 正交矩陣');
  },
  async (tok, S) => { // @783.0
    sm('m = 3 > r = 2：前 2 個用公式 uᵢ = Avᵢ/σᵢ，第 3 個從 Aᵀx = 0 來', -3.2, 6.4);
    cap('前 r 個用公式', '剩下 m − r = 1 個從 Aᵀx = 0');
  },
  async (tok, S) => { // @812.1
    pl('u₁ = (1/σ₁)·A v₁ = (1/√3)·A(1/√2, 1/√2)', -3.2, 5.8);
    cap('u₁ = A v₁ / σ₁', '');
  },
  async (tok, S) => { // @841.1
    S.a1 = arrow(VC.d, 0.05); await grow(tok, S.a1, S.sp.O, S.sp.W(AF_u[0])); S.a1.label('u₁', 'ptr');
    ok(eqV(AF_u[0], mul(1 / Math.sqrt(6), [2, 1, 1])), -3.2, 5.2, 'u₁ = (2/√6, 1/√6, 1/√6)');
    cap('u₁ = (2, 1, 1)/√6', '');
  },
  async (tok, S) => { // @856.5
    pl('u₂ = (1/σ₂)·A v₂，σ₂ = 1', -3.2, 4.6);
    cap('u₂ = A v₂ / σ₂', 'σ₂ = 1，更好算');
  },
  async (tok, S) => { // @884.8
    S.a2 = arrow(VC.c, 0.05); await grow(tok, S.a2, S.sp.O, S.sp.W(AF_u[1])); S.a2.label('u₂', 'ptr');
    ok(eqV(AF_u[1], [0, -1 / R2, 1 / R2]), -3.2, 4.0, 'u₂ = (0, −1/√2, 1/√2)');
    cap('u₂ = (0, −1, 1)/√2', '');
  },
  async (tok, S) => { // @889.5
    const e1 = AF_u[0], e2 = AF_u[1];
    quad(S.sp.O, S.sp.D(e1).multiplyScalar(2.2), S.sp.D(e2).multiplyScalar(2.2), VC.d, 0.14);
    ok(near(norm(e1), 1) && near(norm(e2), 1) && near(dot(e1, e2), 0), -3.2, 3.4, 'v 已單位化 → u 自動是單位向量，而且 u₁ ⟂ u₂');
    cap('u₁、u₂ 自動是單位向量', '（綠色平面 = column space）');
  },
  async (tok, S) => { // @906.8
    pl('u₃：解 Aᵀx = 0', -3.2, 2.8);
    cap('u₃ 從 Aᵀx = 0 來', '');
  },
  async (tok, S) => { // @933.5
    const R = rref(tr(AF)).R;
    mx(R, -4.6, 2.05, 'ptr');
    ok(eqM(R, [[1, 0, 1], [0, 1, -1]]), -1.6, 2.05, 'rref(Aᵀ)：x₁ = −x₃、x₂ = x₃');
    cap('rref：x₁ = −x₃，x₂ = x₃', '');
  },
  async (tok, S) => { // @955.3
    S.a3 = arrow(VC.b, 0.05); await grow(tok, S.a3, S.sp.O, S.sp.W([-1, 1, 1])); S.a3.label('(−1, 1, 1)', 'ptr');
    ok(eqV(mv(tr(AF), [-1, 1, 1]), [0, 0]), -3.2, 1.3, '取 x₃ = 1：x = (−1, 1, 1)，Aᵀx = 0');
    cap('x₃ = 1：x = (−1, 1, 1)', '');
  },
  async (tok, S) => { // @969.0
    await anim(tok, 800, (k) => S.a3.set(S.sp.O, S.sp.W(mul(1 - k * (1 - 1 / Math.sqrt(3)), [-1, 1, 1]))));
    S.a3.label('u₃', 'ptr alt');
    ok(near(dot(AF_u[2], AF_u[0]), 0) && near(dot(AF_u[2], AF_u[1]), 0), -3.2, 0.7, '|x| = √3 → u₃ = (−1, 1, 1)/√3，垂直於 column space');
    cap('長度 √3', 'u₃ = (−1, 1, 1)/√3');
  },
  async (tok, S) => { // @985.5
    note('若 m > r + 1：從 Aᵀx = 0 得到多個向量，再用 Gram-Schmidt', -3.2, 0.1);
    cap('補充：m > r + 1', '多個向量要 Gram-Schmidt');
  },
  async (tok, S) => { // @1016.0
    sm('U =', -5.2, -0.65); mx(AF_U.map((r) => r.map((x) => frac(x))), -3.4, -0.65, 'ptr');
    ok(eqM(mm(tr(AF_U), AF_U), eye(3)), -0.4, -0.65, 'UᵀU = I');
    cap('U = [u₁ u₂ u₃]', '');
  },
], { cam: CAM3 });

scene('sv-f8-step5', '步驟五：組合 A = UΣVᵀ 並檢查', [
  async (tok, S) => { // @1051.5
    S.sp = space3(1.0, V3(1.2, 2.4, 0), 2.6);
    hd('步驟五：寫出 A = UΣVᵀ', -3.2, 7.0);
    cap('最後一步最簡單', '把三個矩陣放在一起');
  },
  async (tok, S) => { // @1065.8
    sm('U', -5.6, 6.1); mx(AF_U.map((r) => r.map((x) => frac(x))), -5.6, 5.2, 'ptr');
    sm('Σ', -2.9, 6.1); mx(AF_S.map((r) => r.map((x) => frac(x))), -2.9, 5.2, 'ptr');
    cap('U、Σ', '');
  },
  async (tok, S) => { // @1069.2
    sm('Vᵀ（記得轉置！）', -0.9, 6.1); mx(tr(AF_V).map((r) => r.map((x) => frac(x))), -0.9, 5.2, 'ptr alt');
    cap('記得最後一個是 Vᵀ', 'V 要轉置');
  },
  async (tok, S) => { // @1097.4
    ok(AF_OK, -3.2, 3.9, '乘回去：UΣVᵀ = [1 1; 1 0; 0 1] = A');
    const cp = circlePts(), e = poly(cp.map(() => S.sp.W([0, 0, 0])), VC.b, true);
    await anim(tok, 1500, (k) => e.setPts(cp.map((u) => S.sp.W(mul(k, mv(AF, u))))));
    arrow(VC.d, 0.05).set(S.sp.O, S.sp.W(mul(AF_s[0], AF_u[0]))).label('√3 u₁', 'ptr');
    arrow(VC.c, 0.05).set(S.sp.O, S.sp.W(mul(AF_s[1], AF_u[1]))).label('1·u₂', 'ptr');
    sm('單位圓被 A 送成 ℝ³ 裡的橢圓：半軸 √3u₁、u₂', -3.2, 3.2);
    cap('乘回去檢查', '等於 A；圓 → 橢圓，半軸 σ₁u₁、σ₂u₂');
  },
], { cam: CAM3 });

// ════════ HgC1l_6ySkc（L32：Quiz 3 Review）════════
const AQ = [[0, -1, 0], [1, 0, -1], [0, 1, 0]];          // 老師的 du/dt = Au（對角 0、上面 −1、下面 +1）
const TQ = Math.PI * R2;                                  // 週期 π√2
const EAT_OK = eqM(expm(AQ, TQ), eye(3), 1e-8);
const QX = [[1, 1, 1], [1, -1, 0], [1, 1, -2]];          // 示意：互相垂直的特徵向量（逐字稿沒唸出）
const QN = QX.map((x) => unit(x)), QM = colsM(QN);
const Ac = (c) => mm(QM, mm(dg(3, 3, [0, c, 2]), tr(QM)));
const isProj = (M) => isSym(M) && eqM(mm(M, M), M, 1e-9);
const UQ = [[0.6, -0.8], [0.8, 0.6]], VQ = [[1 / R2, -1 / R2], [1 / R2, 1 / R2]]; // 示意的 U、V
const HN = unit([1, 1, 1]), HH = madd(eye(3), msc([HN.map((a) => HN.map((b) => a * b))][0], -2)); // 示意：I − 2nnᵀ

scene('sv-q3-topics', 'L32：Quiz 3 範圍 —— 第六章重點', [
  async (tok, S) => { // @7.5
    hd('Quiz 3 複習', -2.6, 7.2); S.L = ledger(-2.6, 6.4, 0.66);
    cap('第三次小考的複習', '');
  },
  async (tok, S) => { // @15.8
    S.L.add('範圍：到第六章為止（第七章線性轉換只考期末）', 'idx');
    cap('考到第六章', '第七章留到期末');
  },
  async (tok, S) => { // @56.1
    S.L.add('特徵值、特徵向量：det(A − λI) = 0（也有捷徑）');
    cap('特徵值：det(A − λI) = 0', '但常有更快的捷徑');
  },
  async (tok, S) => { // @87.3
    S.L.add('微分方程 du/dt = Au');
    cap('新內容從微分方程開始', '');
  },
  async (tok, S) => { // @98.8
    S.L.add('對稱矩陣：λ 是實數；特徵向量夠多、可選成正交');
    cap('對稱矩陣有什麼特別？', 'λ 是實數，特徵向量可以選成互相垂直');
  },
  async (tok, S) => { // @143.4
    S.L.add('A = Aᵀ ⇒ A = QΛQᵀ', 'ptr');
    cap('A = QΛQᵀ', '三個符號說完一個基本事實');
  },
  async (tok, S) => { // @167.1
    S.L.add('正定：特徵值都 > 0');
    cap('正定矩陣', '特徵值都是正的');
  },
  async (tok, S) => { // @175.7
    S.L.add('相似矩陣：B = M⁻¹AM（任何方陣）');
    cap('相似矩陣 B = M⁻¹AM', '同一個轉換、不同的基底');
  },
  async (tok, S) => { // @213.2
    const A = [[1, 2], [0, 3]], M = [[1, 1], [0, 1]], B = mm(inv2(M), mm(A, M));
    sm('示意：A = [1 2; 0 3]，M = [1 1; 0 1]', 4.0, 5.2); sm('B = M⁻¹AM =', 3.0, 4.3); mx(B, 4.9, 4.3, 'ptr');
    const okS = near(B[0][0] + B[1][1], 4) && near(det2(B), 3);
    ok(okS, 4.0, 3.5, 'B 的 trace 4、det 3 和 A 一樣 → λ 都是 1、3');
    cap('相似矩陣：特徵值相同', '');
  },
  async (tok, S) => { // @239.9
    const A = [[1, 2], [0, 3]], M = [[1, 1], [0, 1]], B = mm(inv2(M), mm(A, M));
    S.L.add('B^k = M⁻¹A^kM：一個成長、另一個也成長');
    ok(eqM(mpow(B, 3), mm(inv2(M), mm(mpow(A, 3), M))), 4.0, 2.8, 'B³ = M⁻¹A³M');
    cap('Bᵏ = M⁻¹AᵏM', 'M 改變特徵向量，不改變特徵值');
  },
  async (tok, S) => { // @261.0
    S.L.add('最後：SVD（singular value decomposition）', 'ptr alt');
    cap('最後是 SVD', '');
  },
]);

scene('sv-q3-ode', 'L32：du/dt = Au，A 是反對稱矩陣', [
  async (tok, S) => { // @273.8
    hd('考古題：du/dt = Au', -3.4, 7.2);
    cap('先做一題微分方程', '');
  },
  async (tok, S) => { // @286.2
    sm('A =', -5.8, 6.1); S.G = grid(AQ, -5.0, 6.5, VC.a, 0.6);
    sm('對角線 0、上面 −1、下面 +1', -4.4, 4.6);
    cap('3 × 3，形狀很特別', '對角線 0，上方 −1，下方 +1');
  },
  async (tok, S) => { // @311.9
    pl('u(t) = c₁e^{λ₁t}x₁ + c₂e^{λ₂t}x₂ + c₃e^{λ₃t}x₃', 1.6, 6.3);
    cap('一般解：三個純指數解的組合', 'c₁、c₂、c₃ 留給初始條件');
  },
  async (tok, S) => { // @382.5
    sm('先求特徵值、特徵向量，再用 u(0) 定出 c', 1.6, 5.7);
    cap('第一件工作：特徵值與特徵向量', '');
  },
  async (tok, S) => { // @403.4
    [0, 1, 2].forEach((j) => { glow(S.G.c[0][j], GOLD); glow(S.G.c[2][j], GOLD); });
    ok(near(det3(AQ), 0) && eqV(AQ[0], mul(-1, AQ[2])), 1.6, 5.0, '第一列 = −第三列 → singular → λ₁ = 0');
    cap('它 singular 嗎？', '第一列和第三列只差負號 → λ₁ = 0');
  },
  async (tok, S) => { // @459.9
    [0, 1, 2].forEach((j) => { glow(S.G.c[0][j], null); glow(S.G.c[2][j], null); });
    [0, 1, 2].forEach((i) => { setLbl(S.G.c[i][i], '−λ'); tint(S.G.c[i][i], VC.b); });
    sm('A − λI', -4.4, 4.1);
    cap('看 A − λI', '對角線放 −λ');
  },
  async (tok, S) => { // @472.2
    ok(eqM(tr(AQ), msc(AQ, -1)), 1.6, 4.3, 'Aᵀ = −A：反對稱（skew-symmetric）');
    cap('它一點也不對稱', 'Aᵀ = −A：反對稱');
  },
  async (tok, S) => { // @498.0
    S.B = board2(4.2, 1.6, 0.55, [-2.4, 2.4], [-2.4, 2.4]); sm('複數平面', 4.2, 3.2); sm('虛軸', 4.6, 2.9);
    note('反對稱 → 特徵值在虛軸上（純虛數）', 1.6, 3.6);
    cap('反對稱矩陣的特徵值', '都是純虛數：落在虛軸上');
  },
  async (tok, S) => { // @518.4
    ok(eqM(mpow(AQ, 3), msc(AQ, -2)), -3.0, 2.8, '−λ³ − 2λ = 0（驗證 A³ = −2A）');
    pl('λ(λ² + 2) = 0', -3.0, 2.2);
    cap('det(A − λI) = −λ³ − 2λ = 0', '提出 λ：λ(λ² + 2) = 0');
  },
  async (tok, S) => { // @567.5
    dotAt(S.B(0, 0), VC.r, 0.11); dotAt(S.B(0, R2), VC.r, 0.11); dotAt(S.B(0, -R2), VC.r, 0.11);
    sm('√2 i', 4.75, 1.6 + 0.55 * R2); sm('−√2 i', 4.8, 1.6 - 0.55 * R2); sm('0', 3.95, 1.75);
    pl('λ = 0、√2 i、−√2 i', -3.0, 1.6);
    cap('λ² = −2', 'λ = ±√2 i');
  },
  async (tok, S) => { // @600.6
    hot('u(t) = c₁x₁ + c₂e^{√2 i t}x₂ + c₃e^{−√2 i t}x₃', -2.0, 0.6);
    cap('代回一般解', 'e^{0t} = 1');
  },
]);

scene('sv-q3-period', 'L32：解不衰減也不爆炸，週期 T = π√2', [
  async (tok, S) => { // @618.3
    hd('解會衰減到 0 嗎？', 0, 7.2);
    S.B = board2(0, 3.0, 1.0, [-2.3, 2.3], [-2.3, 2.3]);
    const cp = circlePts(); poly(cp.map((u) => W(S.B, u)), VC.c, true); sm('單位圓 |z| = 1', 1.9, 5.2);
    S.d = dotAt(S.B(1, 0), VC.r, 0.13); S.r = arrow(VC.r, 0.04).set(S.B(0, 0), S.B(1, 0));
    S.th = 0; S.mv = async (tok, to, ms) => { const a = S.th; await anim(tok, ms, (k) => { const t = a + (to - a) * k; S.d.position.copy(S.B(Math.cos(t), Math.sin(t))); S.r.set(S.B(0, 0), S.B(Math.cos(t), Math.sin(t))); }); S.th = to; };
    cap('不會', '這不是會衰減的穩定問題');
  },
  async (tok, S) => { // @634.5
    await S.mv(tok, 1.4, 1500);
    S.lb = pl('e^{i√2 t}：大小永遠是 1，在單位圓上繞', 0, 0.3);
    cap('e^{i√2 t} 的大小是 1', '只是在單位圓上繞');
  },
  async (tok, S) => { // @651.3
    note('不會爆炸，也不會變成 0', -4.6, 4.8);
    cap('不爆炸、不衰減', '確切的解還要看初始條件');
  },
  async (tok, S) => { // @666.3
    sm('什麼時候回到出發點？（週期解）', -4.6, 4.1);
    cap('什麼時候回到初始值？', '這個解是週期的');
  },
  async (tok, S) => { // @709.7
    await S.mv(tok, 2 * Math.PI, 1500);
    pl('e^{2πi} = 1：繞一整圈回到原點', -4.6, 3.4);
    cap('e^{2πi} = 1', '繞完一圈就回來');
  },
  async (tok, S) => { // @726.3
    pl('√2 · T = 2π', -4.6, 2.7);
    cap('√2 T = 2π', '');
  },
  async (tok, S) => { // @744.3
    ok(EAT_OK, -4.0, 2.0, 'T = π√2；程式算 e^{A·π√2} = I');
    cap('T = π√2', '所有解都在 T 回到起點');
  },
]);

scene('sv-q3-normal', 'L32：特徵向量正交 ⇔ AAᵀ = AᵀA', [
  async (tok, S) => { // @769.9
    hd('特徵向量什麼時候互相垂直？', 0, 7.2);
    cap('這題的特徵向量是正交的', '');
  },
  async (tok, S) => { // @783.5
    pl('對稱、反對稱矩陣的特徵向量永遠正交', 0, 6.5);
    cap('對稱或反對稱：特徵向量正交', '');
  },
  async (tok, S) => { // @818.6
    hot('確切條件：A Aᵀ = Aᵀ A', 0, 5.8);
    ok(eqM(mm(AQ, tr(AQ)), mm(tr(AQ), AQ)), 0, 5.15, '剛才的 A：AAᵀ = AᵀA');
    cap('正交特徵向量 ⇔ AAᵀ = AᵀA', '');
  },
  async (tok, S) => { // @857.8
    const N = [[1, 2], [0, 3]];
    S.no = bad('大部分矩陣不行：示意 [1 2; 0 3] 的 AAᵀ ≠ AᵀA' + (eqM(mm(N, tr(N)), mm(tr(N), N)) ? '（✘）' : ''), 0, 4.45);
    cap('大部分矩陣不符合', '三個特徵向量但不正交');
  },
  async (tok, S) => { // @873.5
    cube('對稱\nAᵀ = A', VC.a, [2.6, 1.3, 0.4], -4.2, 2.6, 0, 2); sm('AAᵀ = A² = AᵀA', -4.2, 1.55);
    cap('對稱：兩邊都是 A²', '');
  },
  async (tok, S) => { // @885.5
    cube('反對稱\nAᵀ = −A', VC.b, [2.6, 1.3, 0.4], 0, 2.6, 0, 2); sm('AAᵀ = −A² = AᵀA', 0, 1.55);
    cap('反對稱：兩邊都是 −A²', '');
  },
  async (tok, S) => { // @904.3
    const t = 0.6, Q = [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]];
    cube('正交 Q', VC.d, [2.6, 1.3, 0.4], 4.2, 2.6, 0, 2); sm('QQᵀ = I = QᵀQ', 4.2, 1.55);
    ok(eqM(mm(Q, tr(Q)), eye(2)) && eqM(mm(tr(Q), Q), eye(2)), 4.2, 0.95, '示意旋轉矩陣');
    cap('正交矩陣：QᵀQ = QQᵀ = I', '也通過');
  },
  async (tok, S) => { // @929.8
    hot('三大類：對稱、反對稱、正交', 0, 0.1);
    cap('三個重要的特殊類別', '對稱、反對稱、正交');
  },
]);

scene('sv-q3-expat', 'L32：e^{At} = S e^{Λt} S⁻¹', [
  async (tok, S) => { // @954.4
    hd('怎麼求 e^{At}？', 0, 7.2);
    cap('矩陣指數 e^{At} 怎麼算？', '');
  },
  async (tok, S) => { // @990.1
    pl('u(t) = e^{At} u(0)', 0, 6.3);
    cap('微分方程的關鍵矩陣', 'u(t) = e^{At} u(0)');
  },
  async (tok, S) => { // @1027.7
    note('如果 A 可以對角化：A = SΛS⁻¹（不一定有足夠的特徵向量！）', 0, 5.5);
    cap('如果 A 可以對角化', '記得那個「如果」');
  },
  async (tok, S) => { // @1048.8
    sm('這題有三個不同特徵值 → 特徵向量夠', 0, 4.8);
    cap('這個例子特徵向量夠', '');
  },
  async (tok, S) => { // @1053.7
    hot('e^{At} = S e^{Λt} S⁻¹', 0, 4.0);
    cap('e^{At} = S e^{Λt} S⁻¹', 'S 在最前面，S⁻¹ 在最後面');
  },
  async (tok, S) => { // @1069.6
    S.g = grid([['e^{λ₁t}', '0', '0'], ['0', 'e^{λ₂t}', '0'], ['0', '0', 'e^{λ₃t}']], -1.3, 3.0, VC.g, 1.0);
    ok(EAT_OK, 0, -0.2, '上一題的 A：程式算出 e^{A·π√2} = I（週期 π√2）');
    cap('e^{Λt}：對角線放 e^{λt}', '');
  },
]);

scene('sv-q3-c', 'L32：已知特徵值 0、c、2 與正交特徵向量', [
  async (tok, S) => { // @1100.1
    hd('下一題：好幾個小題', 0, 7.2);
    cap('下一題', '');
  },
  async (tok, S) => { // @1113.0
    pl('3 × 3：λ = 0、c、2（c 未知）', -3.4, 6.4);
    S.x = QX.map((x, k) => sm('x' + '₁₂₃'[k] + ' = (' + x.join(', ') + ')', 3.2, 6.4 - k * 0.5));
    sm('（特徵向量示意：逐字稿沒唸出數字）', 3.2, 4.85);
    cap('給特徵值（一個是 c）和特徵向量', '問 A 的性質');
  },
  async (tok, S) => { // @1131.3
    S.L = ledger(-3.4, 5.6, 0.6); S.L.add('① 哪些 c 可以對角化？');
    cap('哪些 c 可以對角化？', '要說出「所有」可行的 c');
  },
  async (tok, S) => { // @1176.3
    S.L.add('　要三個獨立的特徵向量（λ 是多少不重要）', 'idx');
    cap('對角化看特徵向量', '要三個獨立的');
  },
  async (tok, S) => { // @1209.4
    ok(near(dot(QX[0], QX[1]), 0) && near(dot(QX[0], QX[2]), 0) && near(dot(QX[1], QX[2]), 0), 3.2, 4.2, '它們兩兩正交（內積 0）');
    cap('它們是正交的！', '當然獨立');
  },
  async (tok, S) => { // @1219.4
    S.L.add('　→ 所有 c 都可以', 'good');
    cap('答案：所有 c', '');
  },
  async (tok, S) => { // @1233.9
    S.L.add('② 哪些 c 是對稱？');
    cap('哪些 c 會對稱？', '');
  },
  async (tok, S) => { // @1262.4
    S.L.add('　c 是實數（正交特徵向量 + 實特徵值）', 'good');
    ok(isSym(Ac(1)) && isSym(Ac(-3)), 3.2, 3.5, '示意 c = 1、−3：A = QΛQᵀ 對稱');
    cap('所有實數 c', 'c = i 就不對稱');
  },
  async (tok, S) => { // @1289.1
    S.L.add('③ 正定？');
    cap('正定？', '');
  },
  async (tok, S) => { // @1323.3
    S.L.add('　不可能：有 λ = 0；c ≥ 0 時半正定', 'bad');
    cap('不可能正定', '有特徵值 0；c ≥ 0 時是半正定');
  },
  async (tok, S) => { // @1357.1
    S.L.add('④ Markov 矩陣？');
    cap('會是 Markov 矩陣嗎？', '');
  },
  async (tok, S) => { // @1385.3
    S.L.add('　不會：Markov 有 λ = 1、其他 |λ| ≤ 1，λ = 2 不行', 'bad');
    cap('不會', 'Markov 的特徵值不能是 2');
  },
  async (tok, S) => { // @1402.7
    S.L.add('⑤ A/2 會是投影矩陣嗎？');
    cap('A/2 可能是投影矩陣嗎？', '');
  },
  async (tok, S) => { // @1441.2
    S.L.add('　P² = P ⇒ λ² = λ ⇒ λ = 0 或 1', 'idx');
    cap('投影矩陣的特徵值只有 0、1', 'P² = P ⇒ λ² = λ');
  },
  async (tok, S) => { // @1490.7
    ok(isProj(msc(Ac(0), 0.5)), 3.2, 2.8, 'c = 0：A/2 的 λ = 0、0、1，(A/2)² = A/2');
    cap('c = 0 可以', '');
  },
  async (tok, S) => { // @1495.3
    S.L.add('　→ c = 0 或 c = 2', 'good');
    ok(isProj(msc(Ac(2), 0.5)) && !isProj(msc(Ac(1), 0.5)), 3.2, 2.1, 'c = 2 也可以（c = 1 就不行）');
    cap('c = 2 也可以', '除以 2 後特徵值變 0、1、1');
  },
  async (tok, S) => { // @1515.2
    note('關鍵：特徵向量正交，問題就只剩特徵值', 0, -0.4);
    cap('正交的特徵向量幫了大忙', '只剩看特徵值');
  },
]);

scene('sv-q3-svd1', 'L32：SVD 複習 —— AᵀA = VΣᵀΣVᵀ', [
  async (tok, S) => { // @1550.2
    hd('第三個主題：SVD', 0, 7.2);
    cap('接著複習 SVD', '');
  },
  async (tok, S) => { // @1573.3
    pl('A = U Σ Vᵀ：正交 × 對角 × 正交', 0, 6.4);
    cap('A = U Σ Vᵀ', '');
  },
  async (tok, S) => { // @1602.1
    sm('每一個 A 都有，長方形也可以', 0, 5.8);
    cap('每個矩陣都有 SVD', '長方形也一樣');
  },
  async (tok, S) => { // @1618.9
    hot('關鍵：看 AᵀA', 0, 5.0);
    cap('關鍵是 AᵀA', '');
  },
  async (tok, S) => { // @1627.4
    pl('AᵀA = (V Σᵀ Uᵀ)(U Σ Vᵀ)', 0, 4.2);
    cap('AᵀA = VΣᵀUᵀ · UΣVᵀ', '');
  },
  async (tok, S) => { // @1645.5
    pl('UᵀU = I ⇒ AᵀA = V (ΣᵀΣ) Vᵀ', 0, 3.4);
    cap('UᵀU = I', '中間剩 ΣᵀΣ');
  },
  async (tok, S) => { // @1668.7
    note('這是 AᵀA 自己的 SVD：它對稱，所以兩邊都是 V（U = V）', 0, 2.6);
    cap('AᵀA 的 SVD', '對稱矩陣：U 和 V 一樣');
  },
  async (tok, S) => { // @1714.8
    const ATA = mm(tr(A29), A29);
    hot('V = AᵀA 的特徵向量矩陣', 0, 1.7);
    ok(eqM(ATA, mm(A29v, mm(dg(2, 2, [32, 18]), tr(A29v)))), 0, 1.0, 'L29 的 A = [4 4; −3 3]：AᵀA = V·diag(32, 18)·Vᵀ');
    cap('V：AᵀA 的特徵向量', '');
  },
]);

scene('sv-q3-sign', 'L32：L29 的符號錯誤 —— u 要由 Av = σu 決定', [
  async (tok, S) => { // @1729.2
    hd('上次講 SVD 時出了錯', -3.4, 7.2); sm('A =', -5.2, 6.4); mx(A29, -4.0, 6.4, 'ptr');
    S.B = board2(3.4, 3.0, 0.62, [-3.4, 3.4], [-3.4, 3.4]);
    cap('L29 那次我遇到了麻煩', '');
  },
  async (tok, S) => { // @1756.8
    S.v1 = arrow(VC.a, 0.05).set(S.B(0, 0), W(S.B, [1 / R2, 1 / R2])).label('v₁', 'ptr'); S.v2 = arrow(VC.b, 0.05).set(S.B(0, 0), W(S.B, [1 / R2, -1 / R2])).label('v₂', 'ptr');
    ok(true, -3.4, 5.5, 'AᵀA 的特徵向量 v₁、v₂：沒問題');
    cap('AᵀA 的特徵向量找對了', '');
  },
  async (tok, S) => { // @1763.4
    pl('σ² = AᵀA 的特徵值 → σ = √32、√18（取正根）', -3.4, 4.9);
    cap('σ² 是 AᵀA 的特徵值', '取正的平方根');
  },
  async (tok, S) => { // @1816.5
    sm('最後一步找 U：「我沒看課本」', -3.4, 4.3);
    cap('問題出在最後一步：找 U', '');
  },
  async (tok, S) => { // @1840.6
    pl('AAᵀ = U ΣΣᵀ Uᵀ', -3.4, 3.7);
    cap('看 AAᵀ = UΣΣᵀUᵀ', '這沒錯');
  },
  async (tok, S) => { // @1884.0
    S.u1 = arrow(VC.d, 0.05).set(S.B(0, 0), W(S.B, [1, 0])).label('u₁', 'ptr'); S.u2 = arrow(VC.c, 0.05).set(S.B(0, 0), W(S.B, [0, 1])).label('u₂ ?', 'ptr');
    sm('U 的 columns = AAᵀ 的特徵向量：方向對', -3.4, 3.1);
    cap('U 是 AAᵀ 的特徵向量矩陣', '這也對');
  },
  async (tok, S) => { // @1898.3
    bad('錯在：一個正負號', -3.4, 2.5);
    cap('錯的是一個正負號', '');
  },
  async (tok, S) => { // @1916.4
    S.u2m = arrow(VC.r, 0.05).set(S.B(0, 0), W(S.B, [0, -1])).label('−u₂', 'ptr alt');
    sm('特徵向量整個換號，還是特徵向量 → AAᵀ 分不出要哪一個', -3.4, 1.9);
    cap('換號還是特徵向量', '只看 AAᵀ 決定不了符號');
  },
  async (tok, S) => { // @1929.0
    sm('一半一半的機會，那次剛好選錯一個', -3.4, 1.3);
    cap('五五波，我選錯了', '');
  },
  async (tok, S) => { // @1950.8
    pl('正確做法：先定好 v 的符號（任選一次）', -3.4, 0.7);
    cap('正確：先決定 v', 'v 的符號隨你選，但只選一次');
  },
  async (tok, S) => { // @1968.2
    const u2 = mul(1 / A29s[1], mv(A29, [1 / R2, -1 / R2]));
    hot('再用 Av = σu 算 u：u₂ = Av₂/σ₂', -3.4, 0.05);
    ok(eqV(u2, [0, -1]), -3.4, -0.6, 'Av₂ = (0, −6/√2) = √18·(0, −1) → u₂ = (0, −1)');
    S.u2.kill(); S.u2m.glow('#6a4a00'); S.u2m.label('u₂ = (0, −1)', 'ptr alt');
    cap('用 Av = σu 決定 u', '符號就完全確定');
  },
  async (tok, S) => { // @2000.2
    ok(SVD29_OK, 3.4, -0.6, 'AV = UΣ，乘回去 UΣVᵀ = A');
    cap('AV = UΣ 就是 SVD 的重點', '');
  },
]);

scene('sv-q3-sigma', 'L32：只看 Σ 也能讀出矩陣的性質', [
  async (tok, S) => { // @2034.0
    hd('給你 SVD 的零件，問 A 的性質', -3.4, 7.2);
    S.B = board2(3.6, 3.0, 0.55, [-3.8, 3.8], [-3.8, 3.8]);
    cap('考試可能叫你算 SVD', '也可能給零件、問 A 的性質');
  },
  async (tok, S) => { // @2087.9
    sm('Σ =', -5.8, 6.2); S.mS = mx([[3, 0], [0, 2]], -4.8, 6.2, 'ptr');
    sm('U、V：正交（示意）', -2.4, 6.2);
    cap('Σ = [3 0; 0 2]', 'U、V 的 columns 正交');
  },
  async (tok, S) => { // @2131.7
    const A1 = mm(UQ, mm(dg(2, 2, [3, 2]), tr(VQ)));
    const cp = circlePts(); poly(cp.map((u) => W(S.B, u)), '#d8cfc0', true);
    S.e = poly(cp.map((u) => W(S.B, u)), VC.b, true);
    await anim(tok, 1300, (k) => S.e.setPts(cp.map((u) => W(S.B, lerpV(u, mv(A1, u), k)))));
    ok(near(Math.abs(det2(A1)), 6), -3.4, 5.4, 'σ 都不是 0 → 可逆（|det A| = σ₁σ₂ = 6）');
    cap('σ = 3、2 都不是 0', 'A 可逆');
  },
  async (tok, S) => { // @2179.4
    S.m5 = bad('Σ = [3 0; 0 −5]？不是 SVD：σ 不可能是負的', -3.4, 4.7);
    cap('如果是 −5 呢？', '那不是 SVD：σ 不會是負數');
  },
  async (tok, S) => { // @2195.9
    gone(S.mS); S.mS = mx([[3, 0], [0, 0]], -4.8, 6.2, 'ptr alt');
    S.A0 = mm(UQ, mm(dg(2, 2, [3, 0]), tr(VQ)));
    const cp = circlePts();
    await anim(tok, 1300, (k) => S.e.setPts(cp.map((u) => W(S.B, mv(madd(msc(mm(UQ, mm(dg(2, 2, [3, 2]), tr(VQ))), 1 - k), msc(S.A0, k)), u)))));
    sm('Σ = [3 0; 0 0]：中間是 singular 矩陣 → A singular', -3.4, 4.0);
    cap('這個 A 呢？', 'Σ singular，所以 A singular：圓被壓成線段');
  },
  async (tok, S) => { // @2221.5
    ok(rank(S.A0) === 1, -3.4, 3.35, 'rank = 1（只有一個非零 σ）');
    cap('rank 是多少？', '1');
  },
  async (tok, S) => { // @2229.9
    pl('null space 的維度 = n − r = 1', -3.4, 2.7);
    cap('null space 的維度？', '2 − 1 = 1');
  },
  async (tok, S) => { // @2256.6
    const v2 = [VQ[0][1], VQ[1][1]];
    S.av = arrow(VC.b, 0.05).set(S.B(0, 0), W(S.B, v2)).label('v₂', 'ptr');
    dotAt(S.B(0, 0), VC.r, 0.12);
    ok(eqV(mv(S.A0, v2), [0, 0]), -3.4, 2.05, 'Av₂ = 0：v₂（配到 σ₂ = 0）在 null space');
    cap('null space 裡的向量？', 'v₂：它配到 0 那個 σ');
  },
  async (tok, S) => { // @2297.3
    const u1 = [UQ[0][0], UQ[1][0]], u2 = [UQ[0][1], UQ[1][1]];
    lineThrough(S.B, u1, 3.6, VC.d); lineThrough(S.B, u2, 3.6, VC.c);
    ok(eqV(mv(tr(S.A0), u2), [0, 0]), -3.4, 1.4, 'N(Aᵀ) = u₂ 方向；column space = u₁ 方向');
    note('SVD 把所有好東西都擺出來', -3.4, 0.7);
    cap('N(Aᵀ)、column space 也都在 SVD 裡', '算 SVD 比較花時間，但什麼都看得到');
  },
]);

scene('sv-q3-symorth', 'L32：又對稱又正交的矩陣', [
  async (tok, S) => { // @2334.8
    S.sp = space3(1.2, V3(1.6, 2.2, 0), 2.6);
    hd('是非題：A 對稱，而且正交', -3.0, 7.0);
    sm('示意 A = I − 2nnᵀ，n = (1, 1, 1)/√3：', -3.0, 6.4); mx(msc(HH, 3), -2.2, 5.6, 'ptr'); sm('× 1/3', -0.6, 5.6);
    ok(isSym(HH) && eqM(mm(tr(HH), HH), eye(3)), -3.0, 4.75, '對稱，而且 AᵀA = I');
    cap('A 對稱，而且正交', '兩大類的交集');
  },
  async (tok, S) => { // @2369.6
    pl('特徵值可能是多少？', -3.0, 4.2);
    cap('它的特徵值可能是？', '');
  },
  async (tok, S) => { // @2401.1
    sm('對稱 ⇒ λ 是實數', -3.0, 3.65);
    cap('對稱：λ 是實數', '');
  },
  async (tok, S) => { // @2443.4
    const x = [0.6, 1.1, 0.2], y = mv(HH, x);
    arrow(VC.a, 0.045).set(S.sp.O, S.sp.W(x)).label('x', 'ptr'); arrow(VC.b, 0.045).set(S.sp.O, S.sp.W(y)).label('Ax', 'ptr');
    ok(near(norm(x), norm(y)), -3.0, 3.1, '‖Qx‖ = ‖x‖ ⇒ |λ| = 1');
    cap('正交：Qx = λx 兩邊取長度', '長度不變 ⇒ |λ| = 1');
  },
  async (tok, S) => { // @2496.6
    const { vals } = symEig(HH);
    ok(vals.every((v) => near(Math.abs(v), 1, 1e-9)), -3.0, 2.5, '實數又 |λ| = 1 → λ = 1 或 −1（示意：' + vals.map((v) => f2(v)).join('、') + '）');
    cap('只剩兩種可能', 'λ = 1 或 −1');
  },
  async (tok, S) => { // @2521.4
    S.L = ledger(-3.0, 1.9, 0.55); S.L.add('一定正定？ ✘ 可能有 λ = −1', 'bad');
    cap('一定正定？', '錯：可能有 −1');
  },
  async (tok, S) => { // @2542.6
    S.L.add('沒有重複特徵值？ ✘ 3×3 以上一定重複', 'bad');
    cap('沒有重複特徵值？', '錯：只有 ±1 兩種，3 × 3 一定重複');
  },
  async (tok, S) => { // @2559.8
    S.L.add('可以對角化？ ✓ 而且可用正交的 Q', 'good');
    cap('可以對角化嗎？', '可以，還能用 Q 對角化');
  },
  async (tok, S) => { // @2589.2
    S.L.add('non-singular？ ✓ 正交矩陣一定可逆', 'good');
    cap('可逆嗎？', '可以：正交矩陣一定可逆');
  },
  async (tok, S) => { // @2608.6
    hot('證明：P = ½(A + I) 是投影矩陣', 1.6, 6.7);
    cap('證明 ½(A + I) 是投影矩陣', '');
  },
  async (tok, S) => { // @2651.4
    sm('投影矩陣：對稱 ✓（A 對稱）、P² = P', 1.6, 6.2);
    cap('投影：對稱，而且 P² = P', 'A 對稱，所以 P 對稱');
  },
  async (tok, S) => { // @2668.1
    pl('P² = ¼(A² + 2A + I)', 3.6, 5.5);
    cap('平方：¼(A² + 2A + I)', '');
  },
  async (tok, S) => { // @2701.6
    ok(eqM(mm(HH, HH), eye(3)), 3.6, 4.9, 'A² = I（A = Aᵀ = A⁻¹）');
    cap('A² 是什麼？', 'A = Aᵀ = A⁻¹，所以 A² = I');
  },
  async (tok, S) => { // @2749.0
    const Pm = msc(madd(HH, eye(3)), 0.5);
    ok(eqM(mm(Pm, Pm), Pm), 3.6, 4.3, '¼(2I + 2A) = ½(A + I) = P');
    S.Pm = Pm;
    cap('兩個 I／4、兩個 A／4', '正好等於 P');
  },
  async (tok, S) => { // @2765.8
    quad(S.sp.O, S.sp.D(unit([1, -1, 0])).multiplyScalar(2.6), S.sp.D(unit([1, 1, -2])).multiplyScalar(2.6), VC.d, 0.14);
    const b = [1.2, 0.3, 1.1], p = mv(S.Pm, b), ab = arrow(VC.g, 0.045).set(S.sp.O, S.sp.W(b)).label('b', 'ptr');
    await anim(tok, 1200, (k) => ab.set(S.sp.O, S.sp.W(lerpV(b, p, k)))); ab.label('Pb', 'ptr');
    ok(eqV(symEig(S.Pm).vals, [1, 1, 0], 1e-9), 3.6, 3.7, 'λ(A + I) = 0、2 → λ(P) = 0、1');
    cap('也可以看特徵值', 'A + I：0、2；除以 2：0、1');
  },
], { cam: CAM3 });

// ════════ RWvi4Vx4CDc（L34：Final Course Review）════════
const A34 = [[0, 0], [1, 0], [0, 1]];                      // 老師的例子（第二種答案）
const MK = [[0.2, 0.4, 0.3], [0.4, 0.2, 0.3], [0.4, 0.4, 0.4]]; // 老師唸的 Markov 矩陣（一行一行唸）
const LA = [[1, 0], [1, 1], [1, 2]], LB = [3, 4, 1];
const LXH = mv(inv2(mm(tr(LA), LA)), mv(tr(LA), LB));         // (11/3, −1)
const inSpan = (cols, b) => rank(colsM([...cols, b])) === rank(colsM(cols));

scene('sv-l34-rank', 'L34：Ax = b 無解／恰一解 ⇒ r = n < m = 3', [
  async (tok, S) => { // @64.3
    hd('期末複習：考古題', -3.0, 7.2);
    cap('用考古題複習整門課', '');
  },
  async (tok, S) => { // @75.1
    S.L = ledger(-3.0, 6.4, 0.62); S.L.add('A 是 3 × n 的矩陣');
    cap('A 是 3 × n', '');
  },
  async (tok, S) => { // @81.4
    S.L.add('Ax = (1, 0, 0) 無解');
    cap('已知：Ax = (1, 0, 0) 無解', '');
  },
  async (tok, S) => { // @92.6
    S.L.add('Ax = (0, 1, 0) 恰好一個解');
    cap('Ax = (0, 1, 0) 恰好一個解', '');
  },
  async (tok, S) => { // @111.9
    S.L.add('問：m、n、r 有什麼關係？', 'ptr');
    cap('m、n、r 能說什麼？', 'm 列、n 行、rank r');
  },
  async (tok, S) => { // @144.2
    S.L.add('m = 3（3 列）', 'good');
    cap('m 一定是 3', 'n 看不出來');
  },
  async (tok, S) => { // @168.6
    S.L.add('有 b 無解 ⇒ r < m', 'good');
    cap('有右邊無解', '⇒ r < m：有些列是別的列的組合');
  },
  async (tok, S) => { // @206.0
    sm('（如果每一列都有 pivot，任何 b 都解得出來）', -3.0, S.L.y + 0.25); S.L.y -= 0.35;
    cap('每列都有 pivot 就一定有解', '所以這裡不是');
  },
  async (tok, S) => { // @228.0
    S.L.add('有解時只有一個 ⇒ null space = {0}', 'good');
    cap('有解時只有一個', '不能再加 null space 的東西 ⇒ N(A) = {0}');
  },
  async (tok, S) => { // @269.1
    S.L.add('⇒ r = n：columns 獨立', 'good');
    cap('r = n', 'columns 線性獨立');
  },
  async (tok, S) => { // @279.7
    hot('結論：r = n < m = 3（n 只能是 1 或 2）', 3.0, 3.0);
    cap('r = n，而且都小於 m = 3', '');
  },
]);

scene('sv-l34-example', 'L34：舉例 —— A = [0; 1; 0] 或 [0 0; 1 0; 0 1]', [
  async (tok, S) => { // @301.7
    S.sp = space3(1.3, V3(1.2, 2.2, 0), 2.6);
    hd('寫一個符合條件的 A', -3.4, 7.0);
    cap('舉一個這樣的矩陣', '');
  },
  async (tok, S) => { // @334.2
    S.a1 = arrow(VC.a, 0.055); await grow(tok, S.a1, S.sp.O, S.sp.W([0, 1, 0])); S.a1.label('(0, 1, 0)', 'ptr');
    sm('(0, 1, 0) 要在 column space 裡（因為解得出來）', -3.4, 6.3);
    cap('(0, 1, 0) 要在 column space', '');
  },
  async (tok, S) => { // @347.8
    S.ln = rod(VC.a, 0.02).set(S.sp.W([0, -1.6, 0]), S.sp.W([0, 1.6, 0]));
    pl('A = [0; 1; 0]：m = 3、n = r = 1', -3.4, 5.6);
    ok(!inSpan([[0, 1, 0]], [1, 0, 0]) && rank([[0], [1], [0]]) === 1, -3.4, 5.0, '(1, 0, 0) 不在 column space → 無解');
    cap('其實這樣就夠了', 'A = [0; 1; 0]');
  },
  async (tok, S) => { // @370.0
    S.a2 = arrow(VC.d, 0.055); await grow(tok, S.a2, S.sp.O, S.sp.W([0, 0, 1])); S.a2.label('(0, 0, 1)', 'ptr');
    quad(S.sp.O, S.sp.D([0, 1, 0]).multiplyScalar(1.7), S.sp.D([0, 0, 1]).multiplyScalar(1.7), VC.d, 0.15);
    cap('不喜歡只有一行？', '加第二個 column (0, 0, 1)');
  },
  async (tok, S) => { // @391.0
    S.b = arrow(VC.r, 0.05); await grow(tok, S.b, S.sp.O, S.sp.W([1, 0, 0])); S.b.label('(1, 0, 0) 不在平面上', 'ptr alt');
    pl('A = [0 0; 1 0; 0 1]：r = n = 2，m = 3', -3.4, 4.3);
    ok(rank(A34) === 2 && !inSpan([[0, 1, 0], [0, 0, 1]], [1, 0, 0]) && inSpan([[0, 1, 0], [0, 0, 1]], [0, 1, 0]), -3.4, 3.7, '(0, 1, 0) 恰一解、(1, 0, 0) 無解');
    cap('r = n = 2', '(1, 0, 0) 還是不在 column space');
  },
], { cam: CAM3 });

scene('sv-l34-tf', 'L34：是非題 —— AᵀA 可逆、AAᵀ 正定、det', [
  async (tok, S) => { // @462.3
    hd('是非題（A：3 × n、r = n < 3）', -3.0, 7.2); S.L = ledger(-3.4, 6.4, 0.58);
    cap('對這種 A，下列敘述是真是假？', '');
  },
  async (tok, S) => { // @465.3
    S.t1 = S.L.add('① det(AᵀA) = det(AAᵀ)？');
    cap('① det(AᵀA) = det(AAᵀ)？', '');
  },
  async (tok, S) => { // @479.4
    S.t2 = S.L.add('② AᵀA 可逆？');
    cap('② AᵀA 可逆？', '');
  },
  async (tok, S) => { // @489.1
    S.t3 = S.L.add('③ AAᵀ 正定？');
    cap('③ AAᵀ 正定？', '把課程不同部分連起來');
  },
  async (tok, S) => { // @523.6
    S.t2.element.className = 'lab-label ptr alt';
    cap('先做第②題', '最愛的 AᵀA');
  },
  async (tok, S) => { // @558.6
    S.L.add('A 有非零的 null space ⇒ AᵀA 不可能可逆', 'idx');
    cap('A 有 null space ⇒ AᵀA 不可逆', '');
  },
  async (tok, S) => { // @574.5
    S.L.add('AᵀA 可逆 ⇔ r = n（A 的 columns 獨立）', 'ptr');
    cap('AᵀA 可逆 ⇔ r = n', '不用乘出來，看 rank 就知道');
  },
  async (tok, S) => { // @614.0
    txt(S.t2, '② AᵀA 可逆？ ✓ True（r = n）'); S.t2.element.className = 'lab-label good';
    cap('這裡 r = n', '② 是真的');
  },
  async (tok, S) => { // @629.8
    sm('A =', 2.4, 6.4); mx(A34, 3.4, 6.1, 'ptr');
    sm('AᵀA =', 2.4, 4.6); mx(mm(tr(A34), A34), 3.4, 4.6);
    ok(eqM(mm(tr(A34), A34), eye(2)), 4.4, 3.9, '例子：AᵀA = I（2 × 2）');
    cap('例子的 AᵀA 是 2 × 2', '而且就是 I');
  },
  async (tok, S) => { // @650.9
    S.L.add('AAᵀ：一定對稱、方陣，但是 3 × 3', 'idx');
    cap('AAᵀ 呢？', '3 × n 乘 n × 3 ⇒ 3 × 3');
  },
  async (tok, S) => { // @682.9
    txt(S.t3, '③ AAᵀ 正定？ ✘ False'); S.t3.element.className = 'lab-label bad';
    ok(rank(mm(A34, tr(A34))) === 2, -3.4, S.L.y, 'rank(AAᵀ) = rank(A) = 2 < 3 → 不正定'); S.L.y -= 0.58;
    cap('AAᵀ 的 rank 只有 2', '3 × 3 rank 2 ⇒ 不是正定');
  },
  async (tok, S) => { // @710.2
    const { vals } = symEig(mm(A34, tr(A34)));
    ok(vals.every((v) => v > -1e-12), -3.4, S.L.y, '但一定半正定（特徵值 ' + vals.map((v) => f2(v)).join('、') + ' ≥ 0）'); S.L.y -= 0.58;
    cap('改成「半正定」就永遠成立', '');
  },
  async (tok, S) => { // @737.6
    sm('AAᵀ =', 2.4, 2.9); S.g = grid(mm(A34, tr(A34)), 3.2, 3.4, VC.a, 0.5);
    [0, 1, 2].forEach((j) => glow(S.g.c[0][j], GOLD));
    cap('例子：AAᵀ 是 3 × 3', '第一列全是 0');
  },
  async (tok, S) => { // @773.5
    const d1 = det2(mm(tr(A34), A34)), d2 = det3(mm(A34, tr(A34)));
    txt(S.t1, '① det(AᵀA) = det(AAᵀ)？ ✘ False（' + d1 + ' ≠ ' + d2 + '）'); S.t1.element.className = 'lab-label bad';
    cap('① 呢？', 'AᵀA 可逆、AAᵀ 不可逆 ⇒ 假');
  },
  async (tok, S) => { // @809.8
    const A = [[1, 2], [3, 4]], B = [[0, 1], [5, -2]];
    ok(near(det2(mm(A, B)), det2(mm(B, A))), -3.4, S.L.y, '方陣時才對：det(AB) = det(BA)（示意 2 × 2）'); S.L.y -= 0.58;
    cap('如果是方陣就對', 'det(BA) = det(AB) = det A · det B');
  },
  async (tok, S) => { // @848.8
    note('A 不是方陣，det A 根本沒有定義', -3.4, S.L.y);
    cap('但只限方陣', '這題錯在 A 不是方陣');
  },
]);

scene('sv-l34-aty', 'L34：Aᵀy = c 永遠有解，而且無限多', [
  async (tok, S) => { // @880.3
    S.sp = space3(1.1, V3(1.4, 2.2, 0), 2.6);
    hd('Aᵀy = c', -3.4, 7.0);
    cap('換成 Aᵀ 的方程式', 'Aᵀy = c');
  },
  async (tok, S) => { // @890.9
    pl('證明：每個 c 至少一個解，而且有無限多個', -3.4, 6.4);
    cap('證明每個 c 都有解', '而且有無限多個解');
  },
  async (tok, S) => { // @929.6
    sm('Aᵀ 是 n × 3（n × m）', -3.4, 5.8); mx(tr(A34), -3.4, 5.15, 'ptr');
    cap('Aᵀ 是 n × m', '');
  },
  async (tok, S) => { // @961.3
    sm('什麼時候一定有解？full row rank：rows 獨立', -3.4, 4.5);
    cap('一定有解 ⇔ rows 獨立', 'full row rank');
  },
  async (tok, S) => { // @986.5
    ok(rank(tr(A34)) === 2, -3.4, 3.9, 'A 的 columns 獨立 ⇒ Aᵀ 的 rows 獨立（rank = n = 2）');
    cap('A 的 columns 獨立', '⇒ Aᵀ 的 rows 獨立 ⇒ 至少一個解');
  },
  async (tok, S) => { // @1007.8
    sm('無限多個？看 Aᵀ 的 null space', -3.4, 3.3);
    cap('為什麼無限多？', '看 null space');
  },
  async (tok, S) => { // @1043.9
    const c = [1, 2];
    rod(VC.b, 0.035).set(S.sp.W([-1.8, 1, 2]), S.sp.W([1.8, 1, 2]));
    [-1, 0, 1].forEach((t) => dotAt(S.sp.W([t, 1, 2]), VC.b, 0.08));
    ok(rank(A34) === 2 && eqV(mv(tr(A34), [0.7, 1, 2]), c) && eqV(mv(tr(A34), [-1.3, 1, 2]), c), -3.4, 2.6, 'dim N(Aᵀ) = m − r = 1 > 0：示意 c = (1, 2)，y = (t, 1, 2) 都是解');
    cap('dim N(Aᵀ) = m − r > 0', '每個解都能加上 null space 的向量');
  },
], { cam: CAM3 });

scene('sv-l34-cols', 'L34：A 的 columns v₁、v₂、v₃', [
  async (tok, S) => { // @1096.7
    S.sp = space3(1.3, V3(2.2, 2.2, 0), 2.6);
    hd('A 的三個 columns：v₁、v₂、v₃', -3.0, 7.0);
    cap('A 有三個 columns', 'v₁、v₂、v₃');
  },
  async (tok, S) => { // @1111.3
    pl('(a) 解 Ax = v₁ − v₂ + v₃', -3.4, 6.3);
    cap('(a) 解 Ax = v₁ − v₂ + v₃', '');
  },
  async (tok, S) => { // @1145.0
    sm('矩陣乘法「一次一個 column」：Ax = x₁v₁ + x₂v₂ + x₃v₃', -3.4, 5.7);
    cap('最基本的事實', 'Ax 是 columns 的組合');
  },
  async (tok, S) => { // @1158.0
    const V = colsM([[1, 0, 2], [0, 1, 1], [2, 1, 0]]);
    ok(eqV(mv(V, [1, -1, 1]), add(sub(col0(V, 0), col0(V, 1)), col0(V, 2))), -3.4, 5.1, 'x = (1, −1, 1)（示意 columns 驗證）');
    cap('x = (1, −1, 1)', '');
  },
  async (tok, S) => { // @1182.5
    pl('(b) 假設 v₁ − v₂ + v₃ = 0', -3.4, 4.4);
    cap('(b) 另一題：v₁ − v₂ + v₃ = 0', '解唯一嗎？');
  },
  async (tok, S) => { // @1240.2
    sm('解唯一 ⇔ null space 只有 0', -3.4, 3.8);
    cap('唯一性看 null space', '');
  },
  async (tok, S) => { // @1256.2
    const V = colsM([[1, 1, 0], [1, 2, 1], [0, 1, 1]]);
    ok(eqV(mv(V, [1, -1, 1]), [0, 0, 0]), -3.4, 3.2, '(1, −1, 1) 在 null space ⇒ 解永遠不唯一（示意 columns）');
    cap('(1, −1, 1) 在 null space', '加上它 Ax 不變 ⇒ 不唯一');
  },
  async (tok, S) => { // @1311.9
    pl('(c) 若 v₁、v₂、v₃ orthonormal', -3.4, 2.5);
    S.e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e, k) => arrow([VC.a, VC.d, VC.b][k], 0.055).set(S.sp.O, S.sp.W(e)).label('v' + '₁₂₃'[k], 'ptr'));
    cap('(c) 三個 orthonormal 向量', '通常叫 q₁、q₂、q₃');
  },
  async (tok, S) => { // @1338.6
    quad(S.sp.O, S.sp.D([1, 0, 0]).multiplyScalar(1.6), S.sp.D([0, 1, 0]).multiplyScalar(1.6), VC.d, 0.15);
    sm('v₁、v₂ 的哪個組合最接近 v₃？', -3.4, 1.9);
    cap('v₁、v₂ 平面上哪一點最接近 v₃？', '');
  },
  async (tok, S) => { // @1381.4
    sm('想成 x、y、z 軸：v₃ 在 z 軸上', -3.4, 1.3);
    cap('想成標準基底', 'x、y、z 軸');
  },
  async (tok, S) => { // @1403.6
    const p = [dot([0, 0, 1], [1, 0, 0]), dot([0, 0, 1], [0, 1, 0])];
    const a = arrow(VC.r, 0.04); await grow(tok, a, S.sp.W([0, 0, 1]), S.sp.O.clone().add(V3(0, 0.001, 0)));
    dotAt(S.sp.O, VC.r, 0.12);
    ok(p[0] === 0 && p[1] === 0, -3.4, 0.6, '投影 = 0·v₁ + 0·v₂ = 0：垂直地打在原點');
    cap('答案：0v₁ + 0v₂', 'v₃ 垂直於平面，投影就是 0');
  },
], { cam: CAM3 });
const col0 = (M, j) => M.map((r) => r[j]);

scene('sv-l34-markov', 'L34：Markov 矩陣 —— 特徵值 0、1、−0.2 與穩態', [
  async (tok, S) => { // @1435.2
    hd('Markov 矩陣：求特徵值', -3.4, 7.2);
    cap('寫一個 Markov 矩陣', '問它的特徵值');
  },
  async (tok, S) => { // @1453.0
    sm('A =', -5.8, 6.2); S.g = grid(MK.map((r) => r.map((x) => String(x).replace('0.', '.'))), -5.1, 6.6, VC.a, 0.62);
    ok([0, 1, 2].every((j) => near(MK[0][j] + MK[1][j] + MK[2][j], 1)), -3.4, 4.5, '每個 column 加起來都是 1');
    cap('A = [.2 .4 .3; .4 .2 .3; .4 .4 .4]', '每一行加起來 = 1');
  },
  async (tok, S) => { // @1473.0
    ok(eqV(add(col0(MK, 0), col0(MK, 1)), mul(2, col0(MK, 2))), -3.4, 3.9, 'column 1 + column 2 = 2 × column 3');
    cap('觀察：第一行 + 第二行 = 2 × 第三行', '');
  },
  async (tok, S) => { // @1510.7
    S.L = ledger(-3.4, 3.3, 0.5);
    ok(near(det3(MK), 0), -3.4, S.L.y, 'λ₁ = 0：singular（columns 相依）'); S.L.y -= 0.5;
    cap('一個特徵值：0', '矩陣 singular');
  },
  async (tok, S) => { // @1517.6
    ok(eqV(mv(tr(MK), [1, 1, 1]), [1, 1, 1]), -3.4, S.L.y, 'λ₂ = 1：Markov（Aᵀ(1, 1, 1) = (1, 1, 1)）'); S.L.y -= 0.5;
    cap('另一個：1', 'Markov 矩陣一定有 λ = 1');
  },
  async (tok, S) => { // @1536.4
    const t = MK[0][0] + MK[1][1] + MK[2][2];
    ok(near(t, 0.8), -3.4, S.L.y, 'trace = 0.8 = 0 + 1 + λ₃ ⇒ λ₃ = −0.2'); S.L.y -= 0.5;
    cap('第三個靠 trace', '0.8 − 0 − 1 = −0.2');
  },
  async (tok, S) => { // @1552.5
    S.u = [0, 10, 0];
    S.bars = [0, 1, 2].map((i) => { const m = lab.box([VC.a, VC.d, VC.b][i], [0.7, 1, 0.7]); m.position.set(2.4 + i * 1.2, 0.5, 0); lab.world.add(m); sm('狀態 ' + (i + 1), 2.4 + i * 1.2, -0.3); return m; });
    S.vals = [0, 1, 2].map((i) => sm('', 2.4 + i * 1.2, 0.2));
    S.set = (u) => S.bars.forEach((m, i) => { const h = Math.max(0.02, u[i] * 0.42); m.scale.y = h; m.position.y = h / 2; txt(S.vals[i], f2(u[i])); S.vals[i].position.y = h + 0.3; });
    S.set(S.u); S.k = sm('k = 0', 3.6, 5.6);
    cap('從 u₀ = (0, 10, 0) 開始', '十個人都在狀態 2；u_k = Aᵏu₀');
  },
  async (tok, S) => { // @1618.1
    pl('k → ∞ 會到哪裡？（穩態）', 3.6, 6.3);
    cap('穩態問題', 'k → ∞ 時 u_k 趨近什麼？');
  },
  async (tok, S) => { // @1635.0
    pl('u_k = c₁·0ᵏ·x₁ + c₂·1ᵏ·x₂ + c₃·(−0.2)ᵏ·x₃', -3.4, S.L.y); S.L.y -= 0.5;
    cap('u_k = Σ cᵢ λᵢᵏ xᵢ', '');
  },
  async (tok, S) => { // @1672.5
    for (let k = 1; k <= 6; k++) { const from = S.u.slice(), to = mv(MK, S.u); await anim(tok, 300, (q) => S.set(lerpV(from, to, q))); S.u = to; txt(S.k, 'k = ' + k); }
    sm('0ᵏ、(−0.2)ᵏ → 0：只剩 c₂x₂', -3.4, S.L.y); S.L.y -= 0.5;
    cap('k → ∞：只剩 c₂x₂', '其他兩項都消失');
  },
  async (tok, S) => { // @1727.7
    [0, 1, 2].forEach((i) => { setLbl(S.g.c[i][i], String(f2(MK[i][i] - 1)).replace('0.', '.')); tint(S.g.c[i][i], VC.b); }); sm('→ A − I（對角線減 1）', -4.5, 4.95);
    cap('找 λ = 1 的特徵向量 x₂', '對角線減 1');
  },
  async (tok, S) => { // @1760.0
    sm('(A − I)x = 0：有人看得出來嗎？', -3.4, S.L.y); S.L.y -= 0.5;
    cap('解 (A − I)x = 0', '它應該是 singular');
  },
  async (tok, S) => { // @1843.8
    ok(eqV(mv(MK, [3, 3, 4]), [3, 3, 4]), -3.4, S.L.y, 'x₂ = (3, 3, 4)：A x₂ = x₂'); S.L.y -= 0.5;
    cap('猜 (3, 3, 4)', '真的成立！');
  },
  async (tok, S) => { // @1879.1
    sm('總人數不變：0 + 10 + 0 = 10 = 3 + 3 + 4 ⇒ c₂ = 1', -3.4, S.L.y); S.L.y -= 0.5;
    cap('Markov 的好處：總數不變', '10 個人 ⇒ c₂ = 1');
  },
  async (tok, S) => { // @1905.1
    let u = S.u; for (let k = 0; k < 40; k++) u = mv(MK, u);
    const from = S.u.slice(); await anim(tok, 1200, (q) => S.set(lerpV(from, u, q))); txt(S.k, 'k → ∞');
    ok(eqV(u, [3, 3, 4], 1e-6), 3.6, 4.9, 'u∞ = (3, 3, 4)');
    cap('u∞ = (3, 3, 4)', '');
  },
]);

scene('sv-l34-quick', 'L34：2 × 2 快問快答', [
  async (tok, S) => { // @1935.6
    hd('2 × 2 矩陣：給性質，舉例或說不存在', 0, 7.2);
    S.B = board2(3.8, 2.6, 0.62, [-3.2, 3.2], [-3.2, 3.2]);
    cap('找 2 × 2 的例子', '或說明不存在');
  },
  async (tok, S) => { // @1950.8
    lineThrough(S.B, [4, -3], 3.0, VC.a); S.aa = arrow(VC.a, 0.05).set(S.B(0, 0), W(S.B, [1.6, -1.2])).label('a = (4, −3) 方向', 'ptr');
    pl('① 投影到過 a = (4, −3) 的直線', -3.4, 6.4);
    cap('① 投影到 a = (4, −3) 的直線', '一維的投影矩陣');
  },
  async (tok, S) => { // @1975.9
    pl('P = a aᵀ / (aᵀa)', -3.4, 5.8);
    cap('P = aaᵀ / aᵀa', '中間本來是 (AᵀA)⁻¹，這裡只是一個數');
  },
  async (tok, S) => { // @2003.2
    const a = [4, -3], P2 = msc([[16, -12], [-12, 9]], 1 / 25), Pc = msc([a.map((x) => x * a[0]), a.map((x) => x * a[1])], 1 / dot(a, a));
    sm('= (1/25)', -4.4, 5.15); mx([[16, -12], [-12, 9]], -2.9, 5.15, 'ptr');
    ok(eqM(Pc, P2) && eqM(mm(P2, P2), P2), -0.4, 5.15, 'P² = P');
    const b = [1, 2.4], p = mv(P2, b), ab = arrow(VC.g, 0.04).set(S.B(0, 0), W(S.B, b)).label('b', '');
    await anim(tok, 1000, (k) => ab.set(S.B(0, 0), W(S.B, lerpV(b, p, k)))); ab.label('Pb', 'ptr');
    cap('代入數字', 'P = [16 −12; −12 9] / 25');
  },
  async (tok, S) => { // @2019.9
    pl('② λ = 0 配 (1, 2)、λ = 3 配 (2, 1)', -3.4, 4.3);
    cap('② 已知特徵值與特徵向量', '0 ↔ (1, 2)，3 ↔ (2, 1)');
  },
  async (tok, S) => { // @2065.9
    pl('A = S Λ S⁻¹', -3.4, 3.7);
    cap('公式：A = SΛS⁻¹', 'S 放特徵向量，Λ 放特徵值');
  },
  async (tok, S) => { // @2099.8
    const Sx = [[1, 2], [2, 1]], A = mm(Sx, mm(dg(2, 2, [0, 3]), inv2(Sx)));
    sm('=', -4.6, 3.05); mx(A, -3.6, 3.05, 'ptr');
    ok(eqV(mv(A, [1, 2]), [0, 0]) && eqV(mv(A, [2, 1]), [6, 3]), -1.0, 3.05, '（我們算出來）A(1, 2) = 0、A(2, 1) = 3(2, 1)');
    cap('S Λ S⁻¹ 就是答案', '乘出來 [4 −2; 2 −1]');
  },
  async (tok, S) => { // @2105.7
    pl('③ 不能寫成 BᵀB 的實矩陣', -3.4, 2.3);
    cap('③ 不可能等於 BᵀB 的矩陣', '');
  },
  async (tok, S) => { // @2149.4
    const N = [[1, 2], [0, 1]];
    ok(!isSym(N), -3.4, 1.7, 'BᵀB 一定對稱 ⇒ 任何不對稱的都行（示意 [1 2; 0 1]）');
    cap('BᵀB 一定對稱', '隨便一個不對稱矩陣');
  },
  async (tok, S) => { // @2161.8
    pl('④ 特徵向量正交、但不對稱', -3.4, 1.0);
    cap('④ 特徵向量正交但不對稱', '還有哪些家族？');
  },
  async (tok, S) => { // @2207.4
    const K2 = [[0, 1], [-1, 0]];
    ok(eqM(tr(K2), msc(K2, -1)) && eqM(mm(K2, tr(K2)), mm(tr(K2), K2)), -3.4, 0.4, '反對稱 [0 1; −1 0]');
    cap('反對稱矩陣', '例如 [0 1; −1 0]');
  },
  async (tok, S) => { // @2230.1
    const t = 0.7, Q = [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]];
    ok(eqM(mm(Q, tr(Q)), eye(2)) && !isSym(Q), -3.4, -0.2, '正交矩陣 [cos −sin; sin cos]');
    cap('或正交矩陣', '旋轉矩陣');
  },
  async (tok, S) => { // @2241.3
    // 複數 [re, im]：K2 = [0 1; −1 0] 的特徵向量 x = (1, i)（λ = i）、y = (1, −i)（λ = −i）
    const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], cj = (a) => [a[0], -a[1]];
    const K2 = [[0, 1], [-1, 0]], x = [[1, 0], [0, 1]], y = [[1, 0], [0, -1]];
    const Kx = K2.map((r) => [r[0] * x[0][0] + r[1] * x[1][0], r[0] * x[0][1] + r[1] * x[1][1]]);
    const ix = x.map((z) => cm([0, 1], z));
    const ip = [0, 1].reduce((s, k) => { const t = cm(cj(x[k]), y[k]); return [s[0] + t[0], s[1] + t[1]]; }, [0, 0]);
    ok(Kx.every((z, k) => near(z[0], ix[k][0]) && near(z[1], ix[k][1])) && near(ip[0], 0) && near(ip[1], 0), -3.4, -0.8, '特徵向量 (1, i)、(1, −i)：複數內積 = 1 + i·i = 0，正交');
    cap('它們的特徵向量是複數', '但仍然正交');
  },
]);

scene('sv-l34-ls', 'L34：最小平方 —— Ĉ = 11/3、D̂ = −1', [
  async (tok, S) => { // @2269.4
    hd('最小平方：已經給你答案', -3.4, 7.2);
    cap('最小平方題', '像 Jeopardy：給答案，問問題');
  },
  async (tok, S) => { // @2303.0
    sm('A =', -5.8, 6.2); mx(LA, -4.9, 6.2, 'ptr'); sm('[C; D] = b =', -3.2, 6.2); mx(LB.map((x) => [x]), -2.0, 6.2, 'ptr');
    cap('Ax = b', 'A = [1 0; 1 1; 1 2]，b = (3, 4, 1)');
  },
  async (tok, S) => { // @2320.0
    ok(eqV(LXH, [11 / 3, -1]), -3.4, 5.1, 'Ĉ = 11/3、D̂ = −1（程式解 AᵀAx̂ = Aᵀb 核對）');
    cap('最小平方解：Ĉ = 11/3，D̂ = −1', '');
  },
  async (tok, S) => { // @2355.5
    pl('問 1：b 投影到 column space 的 p = ？', -3.4, 4.4);
    cap('p 是什麼？', 'b 在 column space 上的投影');
  },
  async (tok, S) => { // @2396.6
    const p = mv(LA, LXH);
    ok(eqV(p, [11 / 3, 8 / 3, 5 / 3]), -3.4, 3.8, 'p = (11/3)·col₁ − 1·col₂ = (11/3, 8/3, 5/3)');
    cap('p = Ax̂', '最接近 b 的 columns 組合');
  },
  async (tok, S) => { // @2422.8
    S.F = board2(3.4, 1.4, 0.95, [-0.6, 3.0], [-0.4, 4.6]); sm('t', 6.4, 1.1); sm('高度', 2.6, 6.0);
    pl('問 2：畫出對應的直線擬合', -3.4, 3.1);
    cap('對應的「擬合直線」問題', '');
  },
  async (tok, S) => { // @2438.5
    [[0, 3], [1, 4], [2, 1]].forEach(([t, y]) => { dotAt(S.F(t, y), VC.r, 0.11); sm('(' + t + ', ' + y + ')', S.F(t, y).x + 0.45, S.F(t, y).y + 0.2); });
    cap('t = 0、1、2 時高度 3、4、1', '三個點');
  },
  async (tok, S) => { // @2479.8
    const f = (t) => LXH[0] + LXH[1] * t;
    const l = rod(VC.a, 0.035); await anim(tok, 1000, (k) => l.set(S.F(-0.4, f(-0.4)), S.F(-0.4 + 3.3 * k, f(-0.4 + 3.3 * k))));
    [[0, 3], [1, 4], [2, 1]].forEach(([t, y]) => seg(S.F(t, y), S.F(t, f(t)), '#6e5f49', true));
    sm('y = 11/3 − t', S.F(2.6, f(2.6)).x, S.F(2.6, f(2.6)).y + 0.35);
    cap('最佳直線：截距 11/3、斜率 −1', '');
  },
  async (tok, S) => { // @2489.5
    pl('問 3：找 b ≠ 0，使最小平方解 = (0, 0)', -3.4, 2.4);
    cap('找一個 b，最小平方解是 0', '');
  },
  async (tok, S) => { // @2534.8
    sm('最好的組合是 0 ⇔ b 垂直於兩個 columns', -3.4, 1.8);
    cap('b 要垂直於 column space', '');
  },
  async (tok, S) => { // @2548.7
    const b = [1, -2, 1];
    ok(eqV(mv(tr(LA), b), [0, 0]), -3.4, 1.2, 'b = (1, −2, 1)：Aᵀb = 0 ⇒ x̂ = (0, 0)');
    cap('b = (1, −2, 1)', '和兩個 columns 都垂直');
  },
]);

// ════════ Go2aLo7ZOlU（L33：Left and Right Inverses; Pseudoinverse）════════
// 老師這一講沒有寫具體數字；畫面上的矩陣（AL = [1 0; 0 1; 1 1]、[4 3; 8 6]/5、[1 1; 2 2; 1 1]、σ = 3、2）都是示意。
function pinvG(A) { // 一般的 pseudo-inverse：A⁺ = Σ vᵢuᵢᵀ/σᵢ（σᵢ > 0）
  const r = svd(A), n = A[0].length, m = A.length, out = Array.from({ length: n }, () => new Array(m).fill(0));
  r.sig.forEach((s, k) => { if (s > 1e-9) for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[i][j] += (r.vs[k][i] * r.us[k][j]) / s; });
  return out;
}
const ALl = mm(inv2(mm(tr(AL), AL)), tr(AL));                // left inverse (1/3)[2 −1 1; −1 2 1]
const ARt = tr(AL), ARr = mm(tr(ARt), inv2(mm(ARt, tr(ARt)))); // right inverse of the 2×3
const PL = mm(AL, ALl), PR = mm(ARr, ARt);
const plane3 = (sp, k = 2.0) => { const e1 = unit([1, 0, 1]), e2 = unit(sub([0, 1, 1], mul(dot([0, 1, 1], e1), e1))); return quad(sp.O, sp.D(e1).multiplyScalar(k), sp.D(e2).multiplyScalar(k), VC.d, 0.15); };
const CAMBP = [[0, 3.4, 11.5], [0, 2.4, 0]];

scene('sv-l33-cases', 'L33：四個子空間與 two-sided inverse', [
  async (tok, S) => { // @85.0
    S.bp = bigPicture(); S.cur = { m: 3, n: 4, r: 2 }; S.bp.set(S.cur);
    txt(S.bp.title, '四個基本子空間'); txt(S.bp.shape, '示意：3 × 4，rank 2');
    cap('今天的主角：四個子空間', '最基本的大圖');
  },
  async (tok, S) => { // @92.0
    S.t = note('今天：left inverse、right inverse、pseudo-inverse', 0, 6.3);
    cap('left / right inverse', '還有 pseudo-inverse（課本第七章末）');
  },
  async (tok, S) => { // @117.1
    txt(S.bp.shape, 'm × n、rank r：r、n − r 維｜r、m − r 維');
    cap('m × n、rank r 的矩陣', '回到線性代數最基本的圖');
  },
  async (tok, S) => { // @134.5
    sm('row space ⟂ null space（在 ℝⁿ）', -3.6, -0.5); sm('column space ⟂ N(Aᵀ)（在 ℝᵐ）', 3.6, -0.5);
    cap('左邊兩個互為正交補、右邊兩個也是', '');
  },
  async (tok, S) => { // @150.3
    txt(S.bp.title, '什麼時候有真正的反矩陣？');
    cap('哪幾種情形？', '先看：真正的 two-sided inverse');
  },
  async (tok, S) => { // @172.7
    gone(S.t); S.t = hot('AA⁻¹ = I = A⁻¹A（左乘右乘都是 I）', 0, 6.3);
    cap('two-sided inverse', 'AA⁻¹ = I = A⁻¹A');
  },
  async (tok, S) => { // @215.7
    const from = { ...S.cur }, to = { m: 3, n: 3, r: 3 };
    await anim(tok, 1300, (k) => S.bp.set({ m: from.m + (to.m - from.m) * k, n: from.n + (to.n - from.n) * k, r: from.r + (to.r - from.r) * k }));
    txt(S.bp.shape, 'r = m = n：方陣、full rank'); txt(S.bp.title, '兩個 null space 都只剩 0');
    cap('r = m = n', '方陣、full rank：第二章的主角');
  },
], { cam: CAMBP });

scene('sv-l33-left', 'L33：Full column rank —— left inverse (AᵀA)⁻¹Aᵀ', [
  async (tok, S) => { // @233.5
    S.sp = space3(0.7, V3(0, 2.5, 0), 2.6);
    hd('第三章：不一定 full rank —— full column rank', -2.6, 7.0);
    cap('第三章：任意 rank', '先看 full column rank');
  },
  async (tok, S) => { // @262.8
    sm('這種情形有 left inverse', -2.6, 6.4);
    cap('這種情形有 left inverse', '');
  },
  async (tok, S) => { // @303.5
    pl('r = n', -5.0, 5.7);
    cap('full column rank：r = n', '');
  },
  async (tok, S) => { // @306.7
    sm('A =', -5.0, 4.9); mx(AL, -4.0, 4.9, 'ptr'); sm('（示意：3 × 2）', -4.0, 3.9);
    S.pl = plane3(S.sp);
    cap('n 個 columns 獨立', '通常列比較多（示意 3 × 2）');
  },
  async (tok, S) => { // @347.0
    ok(rank(AL) === 2 && rref(AL).piv.length === AL[0].length, -2.6, 3.3, 'null space 只有零向量');
    cap('null space = {0}', 'columns 獨立：只有零組合得到 0');
  },
  async (tok, S) => { // @403.1
    sm('沒有 null space ⇒ row space 就是整個 ℝⁿ', -2.6, 2.75);
    cap('row space 是整個 ℝⁿ', '');
  },
  async (tok, S) => { // @429.5
    const x = [1, 2], b = mv(AL, x);
    S.ab = arrow(VC.a, 0.05); await grow(tok, S.ab, S.sp.O, S.sp.W(b)); S.ab.label('b = A(1, 2) 在平面上', 'ptr');
    sm('Ax = b：0 或 1 個解（沒有 null space 可以加）', -2.6, 2.2);
    cap('Ax = b 有 0 或 1 個解', '有解時只有一個');
  },
  async (tok, S) => { // @465.5
    S.bb = arrow(VC.b, 0.05); await grow(tok, S.bb, S.sp.O, S.sp.W([1, 2, 4])); S.bb.label('b = (1, 2, 4) 不在平面上', 'ptr alt');
    sm('rows 不獨立：有些 b 消去後出現 0 = 非零 → 無解', -2.6, 1.65);
    cap('rows 可能不獨立', '有些 b 根本無解');
  },
  async (tok, S) => { // @491.0
    const M = mm(tr(AL), AL);
    ok(isSym(M) && near(det2(M), 3), -2.6, 1.05, 'AᵀA = [2 1; 1 2]：n × n、對稱、可逆（det 3）');
    cap('AᵀA：n × n、對稱、full rank', 'rank n ⇒ AᵀA 可逆');
  },
  async (tok, S) => { // @548.0
    pl('A⁻¹_left = (AᵀA)⁻¹Aᵀ =', 2.2, 6.4); mx(msc(ALl, 3), 3.4, 5.6, 'ptr alt'); sm('× 1/3', 5.0, 5.6);
    cap('left inverse = (AᵀA)⁻¹Aᵀ', '');
  },
  async (tok, S) => { // @581.0
    ok(eqM(mm(ALl, AL), eye(2)), 3.4, 4.7, '(AᵀA)⁻¹AᵀA = I（n × n）');
    cap('乘在 A 的左邊：得到 I', '括號一放就看出來');
  },
  async (tok, S) => { // @597.9
    const xh = mv(ALl, [1, 2, 4]), p = mv(AL, xh);
    const d = seg(S.sp.W([1, 2, 4]), S.sp.W([1, 2, 4]), '#6e5f49', true);
    await anim(tok, 1000, (k) => d.setPts(S.sp.W([1, 2, 4]), S.sp.W(lerpV([1, 2, 4], p, k))));
    ok(eqV(xh, [4 / 3, 7 / 3]), 3.4, 4.1, '最小平方：x̂ = A⁻¹_left b = (4/3, 7/3)');
    cap('這正是最小平方的關鍵', 'normal equation 的係數 AᵀA 可逆');
  },
  async (tok, S) => { // @630.4
    sm('換邊乘？A 是 m × n、A⁻¹_left 是 n × m、I 是 n × n', 2.2, 3.4);
    cap('反過來乘呢？', '尺寸：m × n、n × m');
  },
  async (tok, S) => { // @686.8
    ok(near(det3(mm(AL, tr(AL))), 0), 2.2, 2.8, 'AAᵀ（3 × 3）singular：這裡壞掉');
    cap('AᵀA 好，AAᵀ 壞', 'AAᵀ 不可逆');
  },
  async (tok, S) => { // @701.6
    bad('長方形矩陣不可能有 two-sided inverse：A 或 Aᵀ 一定有 null space', 0, -0.4);
    cap('長方形矩陣沒有 two-sided inverse', 'm ≠ n ⇒ 一定有 free variable');
  },
], { cam: CAM3 });

scene('sv-l33-right', 'L33：Full row rank —— right inverse Aᵀ(AAᵀ)⁻¹', [
  async (tok, S) => { // @728.9
    S.sp = space3(1.0, V3(0, 2.4, 0), 2.6);
    hd('反過來的情形：right inverse', -2.6, 7.0);
    cap('對應的另一種情形', 'right inverse');
  },
  async (tok, S) => { // @748.8
    pl('full row rank：r = m', -2.6, 6.4); sm('A =', -5.0, 5.6); mx(ARt, -3.6, 5.6, 'ptr'); sm('（示意 2 × 3）', -1.6, 5.6);
    cap('full row rank：r = m', 'm 個 rows 獨立，columns 不獨立');
  },
  async (tok, S) => { // @770.4
    ok(rank(ARt) === 2, -2.6, 4.9, 'N(Aᵀ) = {0}：rows 沒有組合會變成零列');
    cap('N(Aᵀ) 只有 0', '剛好和上一種情形翻過來');
  },
  async (tok, S) => { // @792.1
    sm('Ax = b 有幾個解？', -2.6, 4.35);
    cap('Ax = b 有幾個解？', '');
  },
  async (tok, S) => { // @818.2
    sm('永遠有解（消去不會出現 0 = 1），但太多了', -2.6, 3.8);
    cap('永遠有解', '但解太多：有 null space');
  },
  async (tok, S) => { // @859.1
    const b = [1, 2], xr = mv(ARr, b), nv = [1, 1, -1];
    rod(VC.b, 0.03).set(S.sp.W(add(xr, mul(-1.3, nv))), S.sp.W(add(xr, mul(1.3, nv))));
    [-1, 0.6].forEach((t) => dotAt(S.sp.W(add(xr, mul(t, nv))), VC.b, 0.07));
    ok(eqV(mv(ARt, nv), [0, 0]) && ARt[0].length - rank(ARt) === 1, -2.6, 3.2, 'n − m = 1 個 free variable：解是一整條線（b = (1, 2) 示意）');
    cap('n − m 個 free variables', '無限多個解');
  },
  async (tok, S) => { // @897.2
    pl('A · A⁻¹_right = I', -2.6, 2.55);
    cap('找一個乘在右邊的反矩陣', 'A·A⁻¹_right = I');
  },
  async (tok, S) => { // @941.4
    pl('A⁻¹_right = Aᵀ(AAᵀ)⁻¹ =', 2.6, 6.4); mx(msc(ARr, 3), 3.6, 5.4, 'ptr alt'); sm('× 1/3', 5.0, 5.4);
    const xr = mv(ARr, [1, 2]); S.ax = arrow(VC.p || VC.d, 0.06); await grow(tok, S.ax, S.sp.O, S.sp.W(xr)); S.ax.label('A⁻¹_right b = (0, 1, 1)', '');
    cap('這次好的是 AAᵀ', 'right inverse = Aᵀ(AAᵀ)⁻¹');
  },
  async (tok, S) => { // @960.8
    ok(eqM(mm(ARt, ARr), eye(2)), 2.6, 4.5, 'A·Aᵀ(AAᵀ)⁻¹ = I（m × m）');
    cap('和 left inverse 完全平行', '');
  },
  async (tok, S) => { // @989.5
    S.L = ledger(-2.6, 1.9, 0.55);
    S.L.add('情形 1（r = m = n）：兩個 null space 都消失', 'idx'); S.L.add('情形 2（r = n）：N(A) 消失', 'idx'); S.L.add('情形 3（r = m）：N(Aᵀ) 消失', 'idx');
    cap('前三種情形', '各有 null space 消失');
  },
  async (tok, S) => { // @1015.5
    S.L.add('情形 4（r < m、r < n）：四個子空間都在：r、n − r、r、m − r', 'ptr alt');
    cap('情形 4：最一般', '四個子空間全都在');
  },
], { cam: CAM3 });

scene('sv-l33-proj', 'L33：反過來乘 —— 得到投影矩陣', [
  async (tok, S) => { // @1048.9
    S.sp = space3(0.7, V3(0, 2.4, 0), 2.6); S.pl = plane3(S.sp);
    hd('回頭看 full column rank', -2.6, 7.0); sm('A =', -5.0, 6.2); mx(AL, -4.0, 6.2, 'ptr');
    cap('再看一下 full column rank', '');
  },
  async (tok, S) => { // @1073.5
    sm('A⁻¹_left · A = I；反過來乘呢？', -2.6, 5.2);
    cap('反過來乘得不到 I', '那得到什麼？');
  },
  async (tok, S) => { // @1092.0
    pl('A · A⁻¹_left = A(AᵀA)⁻¹Aᵀ =', -2.6, 4.6); mx(msc(PL, 3), -2.6, 3.7, 'ptr'); sm('× 1/3', -1.0, 3.7);
    cap('A·A⁻¹_left = A(AᵀA)⁻¹Aᵀ', '3 × 3');
  },
  async (tok, S) => { // @1132.6
    ok(isProj(PL), -2.6, 2.8, '是 P！投影到 column space（P² = P、對稱）');
    cap('大家都認得：P', '投影到 column space');
  },
  async (tok, S) => { // @1147.4
    const x = mv(AL, [1, 1]);
    S.a = arrow(VC.a, 0.05).set(S.sp.O, S.sp.W(x)).label('平面上的向量', '');
    ok(eqV(mv(PL, x), x), -2.6, 2.2, '平面上的向量：P 不動它（像 I）');
    cap('它想當單位矩陣', '在 column space 上就是 I');
  },
  async (tok, S) => { // @1160.2
    const nrm = [1, 1, -1], b = [1, 2, 4], p = mv(PL, b);
    const an = arrow(VC.r, 0.045).set(S.sp.O, S.sp.W(nrm)).label('垂直方向 → 0', 'ptr alt');
    const ab = arrow(VC.b, 0.05).set(S.sp.O, S.sp.W(b)).label('b', 'ptr');
    await anim(tok, 1300, (k) => { an.set(S.sp.O, S.sp.W(mul(1 - k + 0.001, nrm))); ab.set(S.sp.O, S.sp.W(lerpV(b, p, k))); });
    ab.label('Pb', 'ptr'); ok(eqV(mv(PL, nrm), [0, 0, 0]), -2.6, 1.6, '垂直方向：P 給 0');
    cap('能當 I 的地方就是 I', '其他方向是 0：不可能的任務');
  },
  async (tok, S) => { // @1181.0
    pl('right inverse 放左邊：Aᵀ(AAᵀ)⁻¹A', 2.6, 6.4); sm('（2 × 3 的 A = 上面 A 的轉置）', 2.6, 5.85);
    cap('right inverse 放到左邊', 'Aᵀ(AAᵀ)⁻¹A');
  },
  async (tok, S) => { // @1214.7
    ok(isProj(PR) && eqM(PR, PL), 2.6, 5.2, '也是投影：投影到 row space（這個例子剛好是同一個平面）');
    cap('也是投影', '投影到 row space');
  },
], { cam: CAM3 });

scene('sv-l33-map', 'L33：row space ↔ column space 一對一 —— A⁺', [
  async (tok, S) => { // @1338.4
    hd('最一般的情形：r < m 且 r < n', 0, 7.2);
    S.L = board2(-3.4, 3.0, 1.0, [-2.5, 2.5], [-2.4, 2.4]); S.R = board2(3.4, 3.0, 1.0, [-2.5, 2.5], [-2.4, 2.4]);
    sm('ℝⁿ（輸入）', -3.4, 5.65); sm('ℝᵐ（輸出）', 3.4, 5.65); sm('示意 A = [4 3; 8 6]/5，rank 1', 0, 6.5);
    cap('一般情形', '什麼才算合理的反矩陣？');
  },
  async (tok, S) => { // @1350.6
    S.v1 = [0.8, 0.6]; S.v2 = [-0.6, 0.8]; S.u1 = unit([1, 2]); S.u2 = unit([2, -1]);
    lineThrough(S.L, S.v1, 2.3, VC.a); lineThrough(S.L, S.v2, 2.3, VC.b); lineThrough(S.R, S.u1, 2.3, VC.d); lineThrough(S.R, S.u2, 2.3, VC.c);
    sm('row space', -1.7, 4.6); sm('N(A)', -5.0, 4.9); sm('column space', 4.6, 5.25); sm('N(Aᵀ)', 5.6, 1.6);
    cap('r < n：A 有 null space', 'r < m：Aᵀ 也有 null space');
  },
  async (tok, S) => { // @1364.8
    const n = mul(1.6, S.v2), a = arrow(VC.b, 0.05).set(S.L(0, 0), W(S.L, n)).label('n', 'ptr');
    dotAt(S.R(0, 0), VC.r, 0.13);
    S.ck = ok(eqV(mv(AR1, n), [0, 0]), 0, 0.15, 'An = 0：被打成 0 的向量，任何反矩陣都救不回來');
    S.n = a;
    cap('null space 害反矩陣不存在', 'A 把向量打成 0，就回不來了');
  },
  async (tok, S) => { // @1391.0
    S.n.kill(); S.x = mul(1.1, S.v1);
    S.ax = arrow(VC.a, 0.06).set(S.L(0, 0), W(S.L, S.x)).label('x', 'ptr');
    cap('取 row space 裡的 x', '乘上 A');
  },
  async (tok, S) => { // @1407.8
    S.axo = arrow(VC.a, 0.06); await grow(tok, S.axo, S.R(0, 0), W(S.R, mv(AR1, S.x))); S.axo.label('Ax', 'ptr');
    gone(S.ck); S.ck = ok(near(dot(mv(AR1, S.x), S.u2), 0), 0, 0.15, 'Ax 一定在 column space（columns 的組合）');
    cap('Ax 在哪裡？', '一定在 column space');
  },
  async (tok, S) => { // @1419.3
    const pts = [-1.8, -1.0, 0.6, 1.6];
    pts.forEach((t) => { dotAt(W(S.L, mul(t, S.v1)), VC.a, 0.06); dotAt(W(S.R, mv(AR1, mul(t, S.v1))), VC.d, 0.06); });
    cap('row space 的每個向量', '都被送到 column space');
  },
  async (tok, S) => { // @1440.4
    note('兩邊都是 r 維：這個對應是一對一', 0, -0.5);
    cap('一對一', '兩個空間的維度都是 r');
  },
  async (tok, S) => { // @1470.4
    const z = add(S.x, mul(1.2, S.v2));
    arrow(VC.r, 0.04).set(S.L(0, 0), W(S.L, z)).label('x + n', ''); seg(W(S.L, z), W(S.L, S.x), '#6e5f49', true);
    gone(S.ck); S.ck = ok(eqV(mv(AR1, z), mv(AR1, S.x)), 0, 0.15, 'A(x + n) = Ax：null space 的成分被殺掉');
    cap('大部分向量 = row 成分 + null 成分', 'A 殺掉 null space 的成分');
  },
  async (tok, S) => { // @1491.0
    S.y = mul(-0.8, S.v1);
    arrow(VC.g, 0.05).set(S.L(0, 0), W(S.L, S.y)).label('y', 'ptr');
    const ay = arrow(VC.g, 0.05); await grow(tok, ay, S.R(0, 0), W(S.R, mv(AR1, S.y))); ay.label('Ay', 'ptr');
    gone(S.ck); S.ck = ok(!eqV(mv(AR1, S.y), mv(AR1, S.x)), 0, 0.15, 'y ≠ x（都在 row space）⇒ Ay ≠ Ax');
    cap('row space 裡另一個 y', 'Ay 一定不會撞到 Ax');
  },
  async (tok, S) => { // @1566.3
    hot('限制在 row space → column space：A 是完美可逆的', 0, 6.0);
    cap('從 row space 到 column space', 'A 是完美的、可逆的');
  },
  async (tok, S) => { // @1576.4
    S.Ap = pinvG(AR1);
    const back = arrow(VC.d, 0.06), from = mv(AR1, S.x);
    await anim(tok, 1500, (k) => back.set(S.R(0, 0).lerp(S.L(0, 0), k), S.R(0, 0).lerp(S.L(0, 0), k).add(W(S.R, from).sub(S.R(0, 0)).lerp(W(S.L, S.x).sub(S.L(0, 0)), k))));
    back.label('反方向', 'ptr alt');
    cap('它的反方向', '就是 pseudo-inverse');
  },
  async (tok, S) => { // @1605.1
    gone(S.ck); S.ck = ok(eqV(mv(S.Ap, mv(AR1, S.x)), S.x) && eqV(mv(S.Ap, mv(AR1, S.y)), S.y), 0, 0.15, '記號 A⁺：A⁺(Ax) = x、A⁺(Ay) = y');
    cap('記號：A⁺', 'y = A⁺(Ay)');
  },
  async (tok, S) => { // @1635.2
    gone(S.ck); S.ck = ok(eqV(mv(S.Ap, S.u2), [0, 0]) && eqV(mv(AR1, S.v2), [0, 0]), 0, 0.15, 'A 殺掉 N(A)，A⁺ 殺掉 N(Aᵀ)');
    cap('A⁺ 把 N(Aᵀ) 送到 0', '重要的事都發生在 row space 與 column space');
  },
]);

scene('sv-l33-proof', 'L33：證明 Ax = Ay ⇒ x = y', [
  async (tok, S) => { // @1647.8
    hd('為什麼兩個 r 維空間之間 A 是完美的？', 0, 7.2);
    S.L = board2(-3.4, 3.7, 0.8, [-2.4, 2.4], [-2.2, 2.2]); S.R = board2(3.4, 3.7, 0.8, [-2.4, 2.4], [-2.2, 2.2]);
    S.v1 = [0.8, 0.6]; S.v2 = [-0.6, 0.8];
    lineThrough(S.L, S.v1, 2.2, VC.a); lineThrough(S.L, S.v2, 2.2, VC.b); lineThrough(S.R, unit([1, 2]), 2.2, VC.d);
    const q1 = W(S.L, mul(2.3, S.v1)), q2 = W(S.L, mul(2.3, S.v2)), q3 = W(S.R, mul(2.2, unit([1, 2])));
    sm('row space', q1.x + 0.3, q1.y + 0.2); sm('null space', q2.x - 0.3, q2.y + 0.2); sm('column space', q3.x + 0.5, q3.y); sm('示意 A = [4 3; 8 6]/5', 0, 6.5);
    cap('基本事實：row space → column space 是一對一', '為什麼？');
  },
  async (tok, S) => { // @1669.1
    hot('證明', -5.6, 6.5);
    cap('證明', '老師難得用這個字');
  },
  async (tok, S) => { // @1690.3
    S.x = mul(1.4, S.v1); S.y = mul(0.6, S.v1);
    arrow(VC.a, 0.06).set(S.L(0, 0), W(S.L, S.x)).label('x', 'ptr'); arrow(VC.g, 0.045).set(S.L(0, 0), W(S.L, S.y)).label('y', 'ptr');
    S.P = ledger(0, 1.3, 0.5); S.P.add('x ≠ y，兩個都在 row space');
    cap('x ≠ y，都在 row space', '要證：Ax ≠ Ay');
  },
  async (tok, S) => { // @1719.6
    S.P.add('假設 Ax = Ay');
    cap('反過來假設 Ax = Ay', '');
  },
  async (tok, S) => { // @1725.6
    S.P.add('⇒ A(x − y) = 0');
    cap('也就是 A(x − y) = 0', '');
  },
  async (tok, S) => { // @1747.5
    S.d = arrow(VC.r, 0.05).set(S.L(0, 0), W(S.L, sub(S.x, S.y))).label('x − y', 'ptr alt');
    S.P.add('⇒ x − y 在 null space');
    cap('x − y 在 null space', '');
  },
  async (tok, S) => { // @1760.9
    S.P.add('又：row space 是向量空間 ⇒ x − y 也在 row space');
    cap('x − y 也在 row space', '向量空間對減法封閉');
  },
  async (tok, S) => { // @1796.4
    await anim(tok, 900, (k) => S.d.set(S.L(0, 0), W(S.L, mul(1 - k + 0.001, sub(S.x, S.y)))));
    dotAt(S.L(0, 0), VC.r, 0.15);
    ok(near(dot(S.v1, S.v2), 0), 0, S.P.y, 'row space ⟂ null space：交集只有 0 ⇒ x − y = 0 ⇒ x = y');
    cap('同時在兩個互相垂直的空間', '只能是零向量 ⇒ x = y');
  },
  async (tok, S) => { // @1829.2
    hot('A：從 row space 到 column space 是可逆的對應', 0, S.P.y - 0.6);
    cap('A 是 row space → column space 的可逆對應', '只要 null space 別擋路，就有反矩陣');
  },
]);

scene('sv-l33-stats', 'L33：統計學家為什麼需要 A⁺', [
  async (tok, S) => { // @1843.1
    hd('pseudo-inverse 在應用上很有用', -2.6, 7.2);
    S.B = board2(3.0, 2.9, 2.0, [-0.6, 1.6], [-1.0, 1.25]);
    cap('這個反矩陣叫 pseudo-inverse', '應用上非常有用');
  },
  async (tok, S) => { // @1861.4
    S.L = ledger(-3.6, 6.3, 0.6); S.L.add('統計學家：最愛最小平方（linear regression）');
    cap('統計學家為什麼需要它？', '他們整天在做最小平方');
  },
  async (tok, S) => { // @1894.8
    S.L.add('可是 normal equation 要 full column rank 才行');
    cap('最小平方要 full column rank', '');
  },
  async (tok, S) => { // @1905.9
    S.A = [[1, 1], [2, 2], [1, 1]]; S.b = [2, 1, 3];
    S.L.add('重複做同一個實驗 → columns 不獨立（示意 A = [1 1; 2 2; 1 1]，b = (2, 1, 3)）');
    cap('萬一重複了同一個實驗', 'columns 就不獨立了');
  },
  async (tok, S) => { // @1917.6
    const M = mm(tr(S.A), S.A), k = dot([1, 2, 1], S.b) / dot([1, 2, 1], [1, 2, 1]);
    ok(near(det2(M), 0), -3.6, S.L.y, 'AᵀA = [6 6; 6 6] singular：x̂ 解不唯一'); S.L.y -= 0.6;
    rod(VC.b, 0.035).set(W(S.B, [k + 0.45, -0.45]), W(S.B, [-0.45, k + 0.45])); sm('x₁ + x₂ = 7/6：全部都是最小平方解', 3.0, 5.4);
    cap('AᵀA 變成 singular', '最小平方解有一整條線');
  },
  async (tok, S) => { // @1923.9
    const xp = mv(pinvG(S.A), S.b);
    const ax = arrow(VC.d, 0.06); await grow(tok, ax, S.B(0, 0), W(S.B, xp)); ax.label('A⁺b', 'ptr');
    ok(eqV(xp, [7 / 12, 7 / 12]), -3.6, S.L.y, '（補充）A⁺b = (7/12, 7/12)：在 row space、最短的那個解');
    cap('pseudo-inverse 剛好出現', '給出最短的最小平方解');
  },
]);

const SG = dg(3, 4, [3, 2]), SGp = tr(SG).map((r) => r.map((v) => (v ? 1 / v : 0)));
scene('sv-l33-sigma', 'L33：Σ⁺ —— Σ 的 pseudo-inverse', [
  async (tok, S) => { // @1950.2
    hd('怎麼找 A⁺？', 0, 7.2);
    cap('怎麼求出 A⁺？', '');
  },
  async (tok, S) => { // @1973.2
    pl('一個方法：從 SVD 出發', 0, 6.5);
    cap('從 SVD 出發', '');
  },
  async (tok, S) => { // @1982.7
    pl('A = U Σ Vᵀ（正交 × 對角 × 正交）', 0, 5.9);
    cap('A = UΣVᵀ', '');
  },
  async (tok, S) => { // @1995.9
    sm('Σ（示意 σ = 3、2）', -4.6, 5.3); S.g1 = grid(SG, -5.6, 4.8, VC.a, 0.55);
    cap('Σ：幾個非零的 σ，其他全是 0', 'σ 來自 AᵀA 與 AAᵀ');
  },
  async (tok, S) => { // @2038.1
    ok(rank(SG) === 2, -4.6, 2.75, 'm = 3 列、n = 4 行、rank r = 2');
    cap('Σ 的 rank 是 r', '一般情形最簡單的例子');
  },
  async (tok, S) => { // @2085.8
    sm('如果是可逆的對角矩陣：反矩陣就是 1/σ', 0, 5.3);
    cap('猜一下', '對角矩陣的反矩陣：每個取倒數');
  },
  async (tok, S) => { // @2108.3
    sm('Σ⁺', -0.6, 4.75); S.g2 = grid(SGp, -1.2, 4.3, VC.b, 0.55);
    cap('只取到 σ_r 的倒數', '其他還是 0');
  },
  async (tok, S) => { // @2117.0
    sm('Σ⁺ 是 n × m（4 × 3）：形狀轉過來', -0.2, 1.65);
    cap('Σ⁺ 是 n × m', '形狀和 Σ 轉置一樣');
  },
  async (tok, S) => { // @2147.8
    const M = mm(SG, SGp);
    sm('ΣΣ⁺（3 × 3）', 3.9, 5.3); S.g3 = grid(M, 3.4, 4.8, VC.d, 0.5);
    ok(eqM(M, dg(3, 3, [1, 1])), 3.9, 3.0, 'r 個 1、其他 0');
    cap('ΣΣ⁺ = r 個 1', 'm × m');
  },
  async (tok, S) => { // @2186.5
    sm('Σ⁺Σ（4 × 4）', 3.9, 2.45);
    cap('反過來乘：Σ⁺Σ', '');
  },
  async (tok, S) => { // @2221.9
    const M = mm(SGp, SG); S.g4 = grid(M, 3.3, 1.95, VC.d, 0.42);
    ok(eqM(M, dg(4, 4, [1, 1])), 3.9, 0.05, 'n × n：也是 r 個 1、其他 0');
    cap('Σ⁺Σ 是 n × n', '一樣是 1 和 0，但大小不同');
  },
  async (tok, S) => { // @2237.3
    note('ΣΣ⁺ 投影到 column space；Σ⁺Σ 投影到 row space', 0, -0.6);
    cap('它們都是投影矩陣', 'ΣΣ⁺ → column space，Σ⁺Σ → row space');
  },
  async (tok, S) => { // @2254.6
    hot('左乘右乘都不是 I：只把東西帶回兩個好空間，清掉 null space', 0, -1.3);
    cap('pseudo-inverse 能做到的最好', '左右都得不到 I，只得到投影');
  },
]);

scene('sv-l33-pinv', 'L33：A⁺ = VΣ⁺Uᵀ', [
  async (tok, S) => { // @2278.3
    hd('A 本身的 pseudo-inverse', 0, 7.2);
    S.L = board2(-3.4, 4.3, 0.95, [-1.8, 1.8], [-1.8, 1.8]); S.R = board2(3.4, 4.3, 0.95, [-1.8, 1.8], [-1.8, 1.8]);
    S.sy = sm('示意 A = [4 3; 8 6]/5 = √5·u₁v₁ᵀ', 0, 6.6); sm('row space（v₁ 方向）', -3.4, 2.3); sm('ℝᵐ：單位圓', 3.4, 2.3);
    lineThrough(S.L, [0.8, 0.6], 1.7, VC.a); lineThrough(S.R, unit([1, 2]), 1.7, VC.d); lineThrough(S.R, unit([2, -1]), 1.7, VC.c);
    S.Lg = ledger(0, 1.8, 0.5); S.Lg.add('A = U Σ Vᵀ');
    cap('A = UΣVᵀ 的 pseudo-inverse', '');
  },
  async (tok, S) => { // @2286.3
    S.Lg.add('Vᵀ 的反矩陣：V');
    cap('Vᵀ 的反矩陣？', 'V（正交矩陣）');
  },
  async (tok, S) => { // @2298.5
    S.Lg.add('Σ：所有麻煩都在這裡 → 用 Σ⁺');
    cap('Σ 承擔了所有麻煩', '它只有 pseudo-inverse');
  },
  async (tok, S) => { // @2310.3
    const Ap = pinvG(AR1);
    S.Lg.add('U 的反矩陣：Uᵀ ⇒ A⁺ = V Σ⁺ Uᵀ', 'ptr alt');
    const cp = circlePts(); poly(cp.map((u) => W(S.R, u)), VC.b, true);
    const img = poly(cp.map(() => S.L(0, 0)), VC.b, true);
    await anim(tok, 1400, (k) => img.setPts(cp.map((u) => W(S.L, mul(k, mv(Ap, u))))));
    ok(eqM(mm(AR1, mm(Ap, AR1)), AR1) && eqM(Ap, msc([[4, 8], [3, 6]], 1 / 25)), 0, -0.7, 'A⁺ = (1/25)[4 8; 3 6]；AA⁺A = A');
    cap('A⁺ = VΣ⁺Uᵀ', '單位圓被送回 row space 上一小段（長 1/σ₁）');
  },
  async (tok, S) => { // @2325.5
    S.Lg.add('rank 不足時最小平方壞掉 → SVD 把問題全放進 Σ', 'idx');
    cap('SVD 把所有問題放進對角矩陣', '在那裡怎麼做一目了然');
  },
  async (tok, S) => { // @2353.6
    const X = SGp.map((r) => r.slice()); X[3][2] = 5;
    ok(eqM(mm(SG, X), mm(SG, SGp)) && eqM(mm(X, SG), mm(SGp, SG)), 0, -1.2, '在 Σ⁺ 的「零區」多放東西（示意 5）：ΣΣ⁺、Σ⁺Σ 都不變');
    cap('其實還可以多放東西', '乘到 0，不會有影響');
  },
  async (tok, S) => { // @2386.3
    hot('不放多餘東西、最小的那個 = pseudo-inverse', 0, -1.7);
    cap('最小的那個才是 pseudo-inverse', '');
  },
  async (tok, S) => { // @2422.3
    gone(S.sy); note('pseudo-inverse 這個詞不會考；但這整張圖就是整門課', 0, 6.6);
    cap('不會考 pseudo-inverse', '但背後的圖就是第一到四章');
  },
]);

// ════════ xy3QyyhiuY4（Steve Brunton：SVD — Matrix Approximation）════════
// 影片沒有具體數字，畫面用「示意」的資料矩陣 X（n = 8、m = 4）：
// U = 8×8 Hadamard / √8 的 columns、V = 4×4 Hadamard / 2 的 columns、σ = 6、3、0.6、0.3（σ₃、σ₄ 故意很小，示範截斷）。
// 所有乘積、rank、誤差都由程式現場計算並打 ✓／✘。
const XH = (() => { let H = [[1]]; for (let k = 0; k < 3; k++) H = [...H.map((r) => [...r, ...r]), ...H.map((r) => [...r, ...r.map((x) => -x)])]; return H; })();
const XU = colsM([0, 4, 2, 6, 1, 5, 3, 7].map((j) => XH.map((r) => r[j] / Math.sqrt(8))));   // 8×8 orthogonal
const XV = colsM([0, 2, 1, 3].map((j) => [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]].map((r) => r[j] / 2))); // 4×4 orthogonal
const XS = [6, 3, 0.6, 0.3];
const XN = 8, XM = 4;
const Xcol = (A, j) => A.map((r) => r[j]);
const Xterm = (k) => Xcol(XU, k).map((a) => Xcol(XV, k).map((b) => XS[k] * a * b));      // σ_k u_k v_kᵀ
const Xsum = (ks) => ks.reduce((A, k) => madd(A, Xterm(k)), Array.from({ length: XN }, () => new Array(XM).fill(0)));
const XX = Xsum([0, 1, 2, 3]);
const fro = (A) => Math.sqrt(A.flat().reduce((s, x) => s + x * x, 0));
const XVM = 1.1;                                                                           // 色階：|值| ≥ 1.8 最深
const HPa = new THREE.Color('#f4ede1'), HBl = new THREE.Color('#2f7fd0'), HRd = new THREE.Color('#d6542a');
const heatCol = (v, vm) => HPa.clone().lerp(v >= 0 ? HBl : HRd, Math.min(1, Math.abs(v) / vm));
// 熱度圖矩陣（每格一塊小方塊，藍 = 正、橘 = 負、越深越大）
function heat(M, x0, y0, sz = 0.34, vm = XVM) {
  const c = M.map((r, i) => r.map((v, j) => cube('', '#f4ede1', [sz * 0.9, sz * 0.9, 0.16], x0 + j * sz, y0 - i * sz, 0)));
  const H = { c, all: c.flat() };
  H.set = (A) => A.forEach((r, i) => r.forEach((v, j) => c[i][j].material.color.copy(heatCol(v, vm))));
  H.set(M); return H;
}
const Xdiag = (n, m, d) => dg(n, m, d);
// Σ：對角格用金色（σ 的值寫在旁邊的說明裡，小格子放不下標籤）
function sigGrid(n, m, x0, y0, sz = 0.34) {
  const c = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (__, j) => (i === j ? cube('', VC.g, [sz * 0.9, sz * 0.9, 0.16], x0 + j * sz, y0 - i * sz, 0) : cube('', VC.pale, [sz * 0.9, sz * 0.9, 0.16], x0 + j * sz, y0 - i * sz, 0))));
  return { c, all: c.flat() };
}
const XOK = eqM(mm(XU, mm(Xdiag(XN, XM, XS), tr(XV))), XX) && eqM(mm(tr(XU), XU), eye(XN)) && eqM(mm(tr(XV), XV), eye(XM));
const XSV = svd(XX).sig;

scene('sv-xy-svd', 'SVD 回顧：X = UΣVᵀ 與奇異值的排序', [
  async (tok, S) => { // @6.6
    hd('SVD：X = U Σ Vᵀ（示意 n = 8、m = 4）', 0, 7.1);
    S.X = heat(XX, -5.6, 5.6); sm('X（n×m）', -5.09, 6.25);
    pl('=', -3.85, 4.4);
    S.U = heat(XU, -3.3, 5.6, 0.34, 0.4); sm('U（n×n）', -2.11, 6.25);
    S.Sg = sigGrid(XN, XM, -0.2, 5.6); sm('Σ（n×m）', 0.31, 6.25);
    S.V = heat(tr(XV), 1.5, 5.6, 0.34, 0.55); sm('Vᵀ（m×m）', 2.01, 6.25);
    S.ck = ok(XOK, 4.9, 4.4, 'UΣVᵀ = X');
    cap('資料矩陣 X 拆成三個矩陣相乘', 'X = U Σ Vᵀ');
  },
  async (tok, S) => { // @17.9
    S.L = ledger(0, 2.5, 0.7);
    S.L.add('U 的 columns：X 的 column space 的資訊　｜　V：X 的 row space 的資訊', 'idx');
    cap('U 管 column space，V 管 row space', 'Σ 是對角矩陣');
  },
  async (tok, S) => { // @32.9
    for (let k = 0; k < XM; k++) { glow(S.Sg.c[k][k], GOLD); S.U.c.forEach((r) => glow(r[k], GOLD)); await wt(tok, 450); S.U.c.forEach((r) => glow(r[k], null)); }
    S.L.add('σ₁ ≥ σ₂ ≥ σ₃ ≥ σ₄（6 ≥ 3 ≥ 0.6 ≥ 0.3）：u₁ 比 u₂ 重要，u₂ 比 u₃ 重要…', 'idx');
    cap('奇異值由大到小排', 'σ 代表對應的 u、v 有多重要');
  },
  async (tok, S) => { // @46.9
    S.V.c[0].forEach((m) => glow(m, GOLD));
    S.L.add('Vᵀ 的每一列 = V 的 column 躺平：v₁ᵀ、v₂ᵀ、v₃ᵀ、v₄ᵀ', 'idx');
    cap('把 V 的 columns 轉成橫的', 'Vᵀ 的列就是 v₁ᵀ、v₂ᵀ…');
  },
  async (tok, S) => { // @65.1
    S.V.c[0].forEach((m) => glow(m, null));
    S.X.all.forEach((m) => glow(m, GOLD));
    ok(rank(XX) <= XM && rank(XX) === 4, 0, S.L.y, 'X 只有 m = 4 個 columns → 在 ℝ⁸ 裡最多 4 個線性獨立'); S.L.y -= 0.7;
    cap('X 只有 m 個 columns', '最多 m 個線性獨立的方向');
  },
  async (tok, S) => { // @80.9
    S.X.all.forEach((m) => glow(m, null));
    S.U.c.forEach((r) => r.forEach((m, j) => { if (j >= XM) tint(m, VC.pale); }));
    hot('只有 U 的前 m 個 columns 用來表示資料', 0, S.L.y);
    cap('U 只有前 m 個 columns 有用', '後面的 columns 等一下會被丟掉');
  },
]);

scene('sv-xy-sum', 'SVD 展開成 rank-1 矩陣的和', [
  async (tok, S) => { // @113.5
    S.U = heat(XU, -6.2, 6.4, 0.34, 0.4); sm('U', -5.0, 6.95);
    S.Sg = sigGrid(XN, XM, -3.3, 6.4); sm('Σ', -2.79, 6.95);
    pl('=', -1.85, 5.2);
    S.US = heat(XU.map((r) => r.slice(0, XM).map(() => 0)), -1.3, 6.4, 0.34, 2.2); sm('UΣ', -0.79, 6.95);
    S.st = sm('先算 UΣ：Σ 是對角矩陣', -1.2, 3.45);
    cap('先看 U 乘 Σ', 'Σ 是對角矩陣');
  },
  async (tok, S) => { // @122.3
    S.U.c.forEach((r) => glow(r[0], GOLD)); glow(S.Sg.c[0][0], GOLD);
    const US = mm(XU, Xdiag(XN, XM, XS));
    await anim(tok, 800, (k) => S.US.set(US.map((r) => r.map((x, j) => (j === 0 ? x * k : 0)))));
    txt(S.st, 'UΣ 的第 1 行 = σ₁u₁（同一行的其他項都乘到 0）');
    cap('u₁ 只被 σ₁ 放大', '其他格都是 0');
  },
  async (tok, S) => { // @145.1
    S.U.c.forEach((r) => glow(r[0], null)); glow(S.Sg.c[0][0], null);
    const US = mm(XU, Xdiag(XN, XM, XS));
    await anim(tok, 900, (k) => S.US.set(US.map((r) => r.map((x, j) => (j === 0 ? x : x * k)))));
    const okC = [0, 1, 2, 3].every((j) => eqV(Xcol(US, j), mul(XS[j], Xcol(XU, j))));
    txt(S.st, (okC ? '✓ ' : '✘ ') + 'UΣ = [σ₁u₁  σ₂u₂  σ₃u₃  σ₄u₄]');
    cap('UΣ 的每一行都是 σᵢuᵢ', '');
  },
  async (tok, S) => { // @157.9
    pl('·', 0.25, 5.2);
    S.V = heat(tr(XV), 0.6, 6.4, 0.34, 0.55); sm('Vᵀ', 1.11, 6.95);
    S.US.c.forEach((r) => glow(r[0], GOLD)); S.V.c[0].forEach((m) => glow(m, GOLD));
    txt(S.st, '再乘 Vᵀ：σ₁u₁ 這一行只會碰到 v₁ᵀ 這一列');
    cap('乘上 Vᵀ', '第 i 行只配第 i 列');
  },
  async (tok, S) => { // @169.5
    S.US.c.forEach((r) => glow(r[0], null)); S.V.c[0].forEach((m) => glow(m, null));
    pl('=  X', 2.3, 5.2); S.X = heat(XX, 3.0, 6.4); sm('X', 3.51, 6.95);
    const xs = [-6.0, -3.6, -1.2, 1.2];
    S.T = xs.map((x, k) => { const H = heat(Xterm(k), x, 2.2, 0.32); sm('σ' + '₁₂₃₄'[k] + 'u' + '₁₂₃₄'[k] + 'v' + '₁₂₃₄'[k] + 'ᵀ', x + 0.48, 2.75); return H; });
    [-4.4, -2.0, 0.4].forEach((x) => pl('+', x, 1.1));
    ok(eqM(Xsum([0, 1, 2, 3]), XX), 4.6, 1.1, 'X = 四項加起來');
    txt(S.st, 'X = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + … + σ_m u_m v_mᵀ');
    cap('展開成 m 項的和', 'X = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + … + σ_m u_m v_mᵀ');
  },
  async (tok, S) => { // @205.7
    S.Sg.c.forEach((r, i) => { if (i >= XM) r.forEach((m) => glow(m, GOLD)); });
    sm('U 有 n = 8 個 columns，但 rank(X) ≤ m = 4：σ₅、σ₆ … 都是 0', 0, -0.85);
    cap('U 有 n 個 columns', '但非零的奇異值最多只有 m 個');
  },
  async (tok, S) => { // @238.2
    S.Sg.c.forEach((r, i) => { if (i >= XM) r.forEach((m) => { glow(m, null); tint(m, '#efe8dc'); }); });
    S.U.c.forEach((r) => r.forEach((m, j) => { if (j >= XM) tint(m, '#efe8dc'); }));
    hot('第 m 個之後的 u、v 都乘到 0 → 可以丟掉', 0, -1.55);
    cap('乘到 0 的部分全部丟掉', '');
  },
]);

scene('sv-xy-econ', 'Economy SVD：只留前 m 個 columns', [
  async (tok, S) => { // @248.2
    S.X = heat(XX, -5.6, 5.6); sm('X', -5.09, 6.25);
    pl('=', -3.85, 4.4);
    S.U = heat(XU, -3.3, 5.6, 0.34, 0.4); S.uL = sm('U（8×8）', -2.11, 6.25);
    S.Sg = sigGrid(XN, XM, -0.2, 5.6); S.sL = sm('Σ（8×4）', 0.31, 6.25);
    S.V = heat(tr(XV), 1.5, 5.6, 0.34, 0.55); sm('Vᵀ（4×4）', 2.01, 6.25);
    await wt(tok, 900);
    const out = [...S.U.c.flatMap((r) => r.slice(XM)), ...S.Sg.c.slice(XM).flat()];
    await anim(tok, 900, (k) => out.forEach((m) => { m.position.z = 2.5 * k; m.scale.setScalar(Math.max(0.01, 1 - k)); }));
    gone(out);
    cap('只留 U 的前 m 個 columns、Σ 的 m×m 區塊', 'V 完全不動');
  },
  async (tok, S) => { // @261.9
    txt(S.uL, 'Û（8×4）'); txt(S.sL, 'Σ̂（4×4）');
    cap('叫它們 Û、Σ̂', '');
  },
  async (tok, S) => { // @283.6
    const Uh = XU.map((r) => r.slice(0, XM)), Sh = Xdiag(XM, XM, XS);
    ok(eqM(mm(Uh, mm(Sh, tr(XV))), XX), 0, 2.5, 'X = ÛΣ̂Vᵀ：一點都沒少，還是精確相等');
    cap('X = UΣVᵀ = ÛΣ̂Vᵀ', '這是精確的，不是近似');
  },
  async (tok, S) => { // @302.0
    hot('這叫 economy SVD', 0, 1.8);
    cap('這叫 economy SVD', '幾乎所有情況都該用它');
  },
  async (tok, S) => { // @317.4
    const tall = cube('', VC.a, [0.32, 4.6, 0.3], 5.5, 3.5, 0);
    sm('tall skinny X', 5.5, 6.25); sm('n ≈ 100 萬像素', 5.5, 0.6);
    sm('m ≈ 1000 人：n ≫ m', 5.5, -0.1); void tall;
    note('一百萬像素 × 一千人 → 用 economy SVD', -0.5, 1.1);
    cap('高瘦矩陣：n 遠大於 m', '完整的 U 會是 n×n 的大怪物');
  },
  async (tok, S) => { // @345.6
    const c = code(["[U, S, V] = svd(X, 'econ');"], -1.0, 0.3);
    void c; sm('只回傳 U 的前 m 個 columns（對應非零 σ）', -1.0, -0.4);
    cap("MATLAB：svd(X, 'econ')", '不用回傳 n×n 的完整 U');
  },
]);

const OU = [1, 2, -1], OV = [3, 1, 0, 2];
const OUT = OU.map((a) => OV.map((b) => a * b));
scene('sv-xy-outer', '外積：每一項 σuvᵀ 都是 rank 1', [
  async (tok, S) => { // @378.1
    hd('X = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …', 0, 7.0);
    sm('每一項都是 rank-1 矩陣', 0, 6.35);
    cap('每一項都是 rank 1 的矩陣', '為什麼？');
  },
  async (tok, S) => { // @390.6
    S.u = grid(OU.map((x) => [x]), -3.6, 4.4, VC.a, 0.62); sm('u（column）', -5.1, 3.78);
    S.v = grid([OV], -2.6, 5.3, VC.c, 0.62); sm('vᵀ（row）', 0.6, 5.3);
    S.L = ledger(3.9, 4.6, 0.7);
    S.L.add('示意：u = (1, 2, −1)、vᵀ = (3 1 0 2)', 'idx');
    cap('u 是 column vector，vᵀ 是 row vector', 'σ 只是乘上一個數');
  },
  async (tok, S) => { // @422.1
    S.L.add('inner product：row × column = 一個數，例如 uᵀu = ' + dot(OU, OU), 'idx');
    cap('平常熟的是 inner product', '躺著的乘直的，得到一個數');
  },
  async (tok, S) => { // @434.1
    S.L.add('outer product：column × row = 3×4 的矩陣', 'ptr alt');
    cap('直的乘躺著的：outer product', '結果是矩陣');
  },
  async (tok, S) => { // @441.9
    S.R = [];
    for (let i = 0; i < OU.length; i++) {
      glow(S.u.c[i][0], GOLD); S.v.all.forEach((m) => glow(m, GOLD));
      S.R.push(OV.map((_, j) => cube(frac(OUT[i][j]), OUT[i][j] === 0 ? VC.pale : VC.d, [0.57, 0.57, 0.25], -2.6 + j * 0.62, 4.4 - i * 0.62, 0, 1.2)));
      await wt(tok, 900); glow(S.u.c[i][0], null); S.v.all.forEach((m) => glow(m, null));
    }
    S.L.add('第 i 列 = uᵢ × 整個 vᵀ', 'idx');
    cap('第 i 列：u 的第 i 個數乘整個 vᵀ', '一列一列做完就是矩陣');
  },
  async (tok, S) => { // @462.5
    ok(rank(OUT) === 1, 3.9, S.L.y, '每列都是 vᵀ 的倍數 → rank 1'); S.L.y -= 0.7;
    sm('只有一個獨立的 row、一個獨立的 column', 3.9, S.L.y);
    cap('rank 1', '每一列、每一行都跟 vᵀ、u 成倍數');
  },
]);

scene('sv-xy-trunc', '截斷 SVD：最佳 rank-r 近似（Eckart–Young）', [
  async (tok, S) => { // @488.1
    S.X = heat(XX, -6.0, 5.8, 0.4); sm('X', -5.4, 6.45);
    S.A = heat(XX.map((r) => r.map(() => 0)), -3.4, 5.8, 0.4); S.aL = sm('X̃ = 0　誤差 ' + f2(fro(XX)), -2.8, 6.45);
    S.bars = XS.map((s, k) => { const h = (s / XS[0]) * 2.8; const m = cube('', '#d8cfc0', [0.4, h, 0.3], 0.6 + k * 1.2, 3.0 + h / 2, 0); sm('σ' + '₁₂₃₄'[k] + ' = ' + f2(s), 0.6 + k * 1.2, 3.0 + h + 0.3); return m; });
    S.L = ledger(0.4, 2.3, 0.7);
    S.L.add('SVD 把 X 拆成依重要性排好的 rank-1 項', 'idx');
    ok(eqV(XSV, XS, 1e-9), 5.0, 5.6, 'svd(X) 算出 σ = 6、3、0.6、0.3');
    cap('rank-1 項依 σ 由大到小排好', '每多加一項，近似就更好');
  },
  async (tok, S) => { // @503.3
    tint(S.bars[0], VC.g);
    await anim(tok, 900, (k) => S.A.set(msc(Xsum([0]), k)));
    txt(S.aL, 'X̃ = σ₁u₁v₁ᵀ　誤差 ' + f2(fro(madd(XX, msc(Xsum([0]), -1)))));
    cap('只有一個 u、一個 v', 'σ₁u₁v₁ᵀ 是最好的 rank-1 近似');
  },
  async (tok, S) => { // @513.9
    tint(S.bars[1], VC.g);
    await anim(tok, 900, (k) => S.A.set(madd(Xsum([0]), msc(Xterm(1), k))));
    txt(S.aL, 'X̃ = 前 2 項　誤差 ' + f2(fro(madd(XX, msc(Xsum([0, 1]), -1)))));
    S.L.add('加上 σ₂u₂v₂ᵀ → 最好的 rank-2 近似；rank 3、4… 同理', 'idx');
    cap('再加 σ₂u₂v₂ᵀ', '得到最好的 rank-2 近似');
  },
  async (tok, S) => { // @550.1
    tint(S.bars[2], VC.r); tint(S.bars[3], VC.r);
    S.L.add('σ₃、σ₄ 很小（能量很低）→ 截斷在 r = 2', 'ptr alt');
    cap('後面的 σ 很小', '就在 r 截斷，只留前 r 個');
  },
  async (tok, S) => { // @568.4
    const Ut = XU.map((r) => r.slice(0, 2)), Vt = XV.map((r) => r.slice(0, 2));
    const Xt = mm(Ut, mm(Xdiag(2, 2, XS), tr(Vt)));
    S.L.add('Ũ（n×r）、Σ̃（r×r）、Ṽᵀ（r×m）：X ≈ ŨΣ̃Ṽᵀ', 'idx');
    ok(eqM(Xt, Xsum([0, 1])) && rank(Xt) === 2, 5.0, 4.9, 'ŨΣ̃Ṽᵀ = 前 2 項，rank 2');
    cap('X ≈ Ũ Σ̃ Ṽᵀ', '前 r 個 columns 的 U、V 與 r×r 的 Σ');
  },
  async (tok, S) => { // @619.4
    const e = fro(madd(XX, msc(Xsum([0, 1]), -1)));
    S.L.add('Eckart–Young（1936）：rank r 的矩陣裡，‖X − X̃‖_F 最小的就是截斷 SVD', 'ptr alt');
    ok(near(e, Math.sqrt(XS[2] ** 2 + XS[3] ** 2)), 5.0, 4.2, '誤差 = √(σ₃² + σ₄²) = ' + f2(e));
    cap('Eckart–Young 定理', 'argmin_{rank X̃ = r} ‖X − X̃‖_F = ŨΣ̃Ṽᵀ');
  },
  async (tok, S) => { // @687.4
    const other = Xsum([0, 2]), eo = fro(madd(XX, msc(other, -1))), e = fro(madd(XX, msc(Xsum([0, 1]), -1)));
    ok(rank(other) === 2 && eo > e, 0.4, S.L.y, '換一個 rank 2（例如留 σ₁、σ₃ 兩項）：誤差 ' + f2(eo) + ' > ' + f2(e));
    cap('任何 rank r 的矩陣都不會更好', '截斷 SVD 就是最佳近似');
  },
]);

const XUt = XU.map((r) => r.slice(0, 2));
scene('sv-xy-unitary', '截斷後：ŨᵀŨ = I，但 ŨŨᵀ ≠ I', [
  async (tok, S) => { // @720.1
    S.U = heat(XU, -6.0, 6.2, 0.3, 0.4); sm('U（n×n）', -4.95, 6.75);
    note('完整 SVD：U、V 是 unitary（實數就是 orthogonal）', 0, 0.3);
    cap('完整的 U、V 是 unitary', 'U 是 n×n，V 是 m×m');
  },
  async (tok, S) => { // @732.6
    heat(mm(tr(XU), XU), -2.6, 6.2, 0.3, 1); sm('UᵀU', -1.55, 6.75);
    heat(mm(XU, tr(XU)), 0.8, 6.2, 0.3, 1); sm('UUᵀ', 1.85, 6.75);
    ok(eqM(mm(tr(XU), XU), eye(8)) && eqM(mm(XU, tr(XU)), eye(8)), 4.9, 5.3, 'UᵀU = UUᵀ = I');
    cap('UUᵀ = UᵀU = I', '兩邊乘都是單位矩陣');
  },
  async (tok, S) => { // @739.5
    S.Ut = heat(XUt, -5.0, 3.0, 0.3, 0.4); sm('Ũ（8×2）', -4.85, 3.55);
    S.U.c.forEach((r) => r.forEach((m, j) => glow(m, j < 2 ? GOLD : null)));
    cap('截斷到 rank r：只留 r 個 columns', 'Ũ 不再是方陣');
  },
  async (tok, S) => { // @750.7
    S.U.all.forEach((m) => glow(m, null));
    heat(mm(tr(XUt), XUt), -2.2, 3.0, 0.3, 1); sm('ŨᵀŨ（2×2）', -2.05, 3.55);
    ok(eqM(mm(tr(XUt), XUt), eye(2)), 4.9, 1.9, 'ŨᵀŨ = I（r×r）');
    cap('ŨᵀŨ 還是 r×r 單位矩陣', 'columns 仍然 orthonormal');
  },
  async (tok, S) => { // @759.2
    const P = mm(XUt, tr(XUt));
    heat(P, 0.8, 3.0, 0.3, 0.3); sm('ŨŨᵀ（8×8）', 1.85, 3.55);
    bad('ŨŨᵀ ≠ I', 4.9, 1.2);
    cap('但 ŨŨᵀ 不是單位矩陣', '截斷前是，截斷後不是');
  },
  async (tok, S) => { // @780.9
    hot('很多人在證明裡忘了這點而寫錯（老師說他自己也犯過）', 0, -0.4);
    cap('這點非常重要', '很多錯誤的證明都栽在這裡');
  },
  async (tok, S) => { // @813.9
    const P = mm(XUt, tr(XUt));
    ok(rank(P) === 2 && eqM(mm(P, P), P), 0, -1.1, 'ŨŨᵀ 是 n×n、rank r：投影到 Ũ 的 column space（P² = P）');
    cap('ŨŨᵀ 是 n×n、rank r', '它是投影矩陣，不是 I');
  },
]);

scene('sv-xy-recap', '總結：full → economy → truncated SVD', [
  async (tok, S) => { // @824.4
    const row = (y, nm, sizes, cols) => { pl('X ' + (nm[3] || '='), -5.3, y); [-3.6, -2.2, -1.0].forEach((x, i) => cube(nm[i], cols[i], [sizes[i][0], sizes[i][1], 0.3], x, y, 0)); };
    S.row = row;
    row(5.6, ['U', 'Σ', 'Vᵀ'], [[1.6, 1.6], [0.8, 1.6], [0.8, 0.8]], [VC.a, VC.g, VC.c]);
    sm('full SVD：X = UΣVᵀ', 2.9, 5.95);
    cap('SVD：X = UΣVᵀ', '');
  },
  async (tok, S) => { // @834.4
    sm('= σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …：rank-1 項的和', 2.9, 5.25);
    cap('重排成 rank-1 項的和', 'σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …');
  },
  async (tok, S) => { // @849.7
    S.row(3.5, ['Û', 'Σ̂', 'Vᵀ'], [[0.8, 1.6], [0.8, 0.8], [0.8, 0.8]], [VC.a, VC.g, VC.c]);
    sm('economy SVD（高瘦 n ≫ m）：前 m 個', 2.9, 3.5);
    cap('高瘦資料矩陣：economy SVD', '只留前 m 個 columns，仍然精確');
  },
  async (tok, S) => { // @860.4
    S.row(1.5, ['Ũ', 'Σ̃', 'Ṽᵀ', '≈'], [[0.4, 1.6], [0.4, 0.4], [0.8, 0.4]], [VC.a, VC.g, VC.c]);
    sm('truncated：丟掉小的 σ，只留 r 個', 2.9, 1.5);
    cap('再丟掉小的奇異值', '得到 rank r 近似');
  },
  async (tok, S) => { // @876.6
    const e = fro(madd(XX, msc(Xsum([0, 1]), -1)));
    ok(near(e, Math.sqrt(XS[2] ** 2 + XS[3] ** 2)), 0, -0.3, 'Eckart–Young：截斷 SVD 是最佳 rank r 近似（示意 X：誤差 √(σ₃² + σ₄²)）');
    cap('Eckart–Young 保證它最好', '');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '線性代數・第 9 章',
    title: 'SVD 與 Pseudo-inverse',
    color: 'var(--la)',
    modes: [
      { id: 'geom', name: 'SVD 幾何', enter: () => { sg.stage = 0; enterGeom(); } },
      { id: 'lowrank', name: '低秩近似', enter: enterLowRank },
      { id: 'pinv', name: 'Pseudo-inverse', enter: enterPinv },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['svd-circle', 'svd-ata', 'svd-subspaces', 'flags-rank', 'low-rank', 'inverse-cases', 'left-inverse', 'right-inverse', 'inverse-projection', 'pinv-map', 'rank-deficient-ls', 'pinv-sigma', 'pinv-svd'].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
