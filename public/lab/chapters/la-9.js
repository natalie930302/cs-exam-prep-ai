// 線性代數 第9章：SVD 與應用（旋轉-伸縮-旋轉、σ 從 AᵀA 來、四個子空間、低秩近似、pseudo-inverse）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 有逐字稿的只有 MIT 18.06 L33（Go2aLo7ZOlU：left / right inverse、pseudo-inverse），那部分場景照講課順序與內容；
// L29 SVD 等影片尚無逐字稿，SVD 本身的場景以 Strang 例題建立（標題標「課本」）：A = [3 0; 4 5]、[4 4; −3 3]、[4 3; 8 6]、旗子的 rank。
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
    sceneOrder: ['svd-circle', 'svd-ata', 'svd-subspaces', 'flags-rank', 'low-rank', 'inverse-cases', 'left-inverse', 'right-inverse', 'inverse-projection', 'pinv-map', 'rank-deficient-ls', 'pinv-sigma', 'pinv-svd'],
    stop() { gen++; },
  };
}
