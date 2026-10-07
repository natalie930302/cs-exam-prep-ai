// 線性代數 第7章：正交性（正交子空間、投影、最小平方、Gram-Schmidt、A = QR、正交矩陣）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 場景依 MIT 18.06 L17（0MtwqhIwdrI）與 Gram-Schmidt 習題課（HEQuN0QELSQ）的例子；
// L14–L16 與 3Blue1Brown Ch9 沒有逐字稿，相關場景以 Strang 課本例題建立（標題標「課本」）。
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
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
  const f2 = (x) => { const v = Math.round(x * 100) / 100; return (v < 0 ? '−' : '') + Math.abs(v); };
  const vs = (u, f = frac) => '(' + u.map(f).join(', ') + ')';

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
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat); lab.world.add(m);
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
  // 3D 座標：數學 (x, y, z) → three (x, z, −y)，z 朝上
  function space3(S, O, L = 2.6, axes = true) {
    const W = (u) => V3(O.x + S * u[0], O.y + S * u[2], O.z - S * u[1]);
    const D = (u) => V3(S * u[0], S * u[2], -S * u[1]);
    if (axes) [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']].forEach(([e, n]) => {
      const d = D(e).normalize().multiplyScalar(L), dn = d.clone();
      if (e[2] === 1) dn.multiplyScalar(Math.min(1, (O.y - 0.05) / L));
      seg(O.clone().sub(dn), O.clone().add(d), '#cbbd9f');
      tagAt(n, 'idx', O.clone().add(d.clone().multiplyScalar(1.08)));
    });
    return { W, D, O, S };
  }
  // 2D 板子（直立在 z = 0）
  function board2(ox, oy, S, xr, yr) {
    const P = (x, y) => V3(ox + S * x, oy + S * y, 0);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(S * (xr[1] - xr[0]) + 0.4, S * (yr[1] - yr[0]) + 0.4), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 1 }));
    bg.position.set(ox + S * (xr[0] + xr[1]) / 2, oy + S * (yr[0] + yr[1]) / 2, -0.03); bg.receiveShadow = true; lab.world.add(bg);
    for (let x = Math.ceil(xr[0]); x <= xr[1]; x++) seg(P(x, yr[0]), P(x, yr[1]), x === 0 ? '#9c8d70' : '#eadfca');
    for (let y = Math.ceil(yr[0]); y <= yr[1]; y++) seg(P(xr[0], y), P(xr[1], y), y === 0 ? '#9c8d70' : '#eadfca');
    return P;
  }
  const W2 = (P, u) => P(u[0], u[1]);
  function circle2(P, r = 1, color = '#cbbd9f', n = 64) { const pts = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push(P(r * Math.cos(a), r * Math.sin(a))); } return poly(pts, color, true); }
  function ghostSphere(c, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: '#9b7ef4', wireframe: true, transparent: true, opacity: 0.12 }));
    m.position.copy(c); lab.world.add(m); return m;
  }
  // a plane through the origin spanned by math vectors u, v (any), drawn with an orthonormal frame
  function span2(sp, u, v, half, color = '#4b9ee2', op = 0.16) {
    const e1 = unit(u), e2 = unit(sub(v, mul(dot(v, e1), e1)));
    return quad(sp.O, sp.D(e1).multiplyScalar(half / sp.S), sp.D(e2).multiplyScalar(half / sp.S), color, op);
  }
  async function grow(tok, A, from, to, ms = 700) { await anim(tok, ms, (t) => A.set(from, from.clone().lerp(to, t))); }

  // ───────────────────────── 場景（課本）：內積 = 投影長 × 長度 ─────────────────────────
  async function scDotProj(tok) {
    fresh([0.6, 3.1, 11.5], [0.6, 2.9, 0]);
    const P = board2(-0.6, 1.4, 1.0, [-3.4, 4.2], [-1.1, 3.4]);
    const v = [3, 1], vl = norm(v), vh = unit(v);
    seg(W2(P, mul(-1.1, v)), W2(P, mul(1.35, v)), '#cbbd9f');
    const av = arrow(C.a).set(P(0, 0), W2(P, v)).label('v = (3, 1)', 'ptr');
    const aw = arrow(C.b), pr = rod(C.p, 0.07), dl = seg(P(0, 0), P(0, 0), '#8a7a5c', true);
    aw.label('w', 'ptr alt');
    let phi = 70;
    function upd(deg) {
      phi = deg; const r = (deg * Math.PI) / 180, w = [2.6 * Math.cos(r), 2.6 * Math.sin(r)];
      const s = dot(v, w) / vl, foot = mul(s, vh);
      aw.set(P(0, 0), W2(P, w)); pr.set(P(0, 0), W2(P, foot)); pr.material.color.set(s < -1e-6 ? C.e : C.p);
      dl.setPts(W2(P, w), W2(P, foot));
      say(s > 0.05 ? '夾角 < 90°：內積為正' : s < -0.05 ? '夾角 > 90°：內積為負' : '垂直：內積 = 0',
        'v·w = (w 在 v 上的投影長 ' + f2(s) + ') × ‖v‖ ' + f2(vl) + ' = ' + f2(dot(v, w)));
    }
    upd(70);
    await beat(tok, 2600);
    await anim(tok, 1800, (t) => upd(70 + (30 - 70) * t)); await beat(tok, 2200);
    await anim(tok, 2200, (t) => upd(30 + (108.43 - 30) * t)); await beat(tok, 2600);
    await anim(tok, 1600, (t) => upd(108.43 + (160 - 108.43) * t)); await beat(tok, 2400);
    say('內積 = 沿著 v 的「影子」長度乘上 ‖v‖', 'v·w = ‖v‖‖w‖cos θ；θ = 90° ⇔ v·w = 0');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景（課本）：正交向量與正交子空間 ─────────────────────────
  async function scOrthSub(tok) {
    fresh([5.2, 6.4, 9.6], [0, 2.6, 0]);
    const sp = space3(0.55, V3(0, 2.8, 0), 2.6);
    const x = [1, 2, 3], y = [2, -1, 0];
    const ax = arrow(C.a), ay = arrow(C.b);
    say('x = (1, 2, 3)、y = (2, −1, 0)', 'xᵀy = 1·2 + 2·(−1) + 3·0 = 0 → 垂直');
    await grow(tok, ax, sp.O, sp.W(x)); ax.label('x', 'ptr');
    await grow(tok, ay, sp.O, sp.W(y)); ay.label('y', 'ptr alt');
    const ra = rightAngle(sp.O, sp.D(x), sp.D(y), 0.25);
    await beat(tok, 2600);
    const ay2 = arrow(C.b, 0.035); await grow(tok, ay2, sp.W(x), sp.W(add(x, y)));
    const axy = arrow(C.p); await grow(tok, axy, sp.O, sp.W(add(x, y))); axy.label('x + y', '');
    say('直角三角形：畢氏定理', '‖x‖² + ‖y‖² = 14 + 5 = 19 = ‖x + y‖²');
    await beat(tok, 3200);
    [ay, ay2, axy, ra].forEach(kill);
    say('A = [1 2 3; 2 4 6]：row space 是 x 這條線', 'rank 1：第二列 = 2 × 第一列');
    const mt = mtag([[1, 2, 3], [2, 4, 6]], -3.6, 5.2, 0, 'ptr');
    const rl = rod(C.a, 0.025).set(sp.W(mul(-1.2, x)), sp.W(mul(1.25, x)));
    await beat(tok, 2600);
    const n = unit(x), e1 = unit(y), e2 = cross(n, e1);
    const pl = quad(sp.O, sp.D(e1).multiplyScalar(4), sp.D(e2).multiplyScalar(4), C.b, 0.2);
    say('null space：所有 Ax = 0 的 x，是一個平面', 'x₁ + 2x₂ + 3x₃ = 0（每一列都和 x 內積為 0）');
    await beat(tok, 2400);
    const n1 = arrow(C.b); await grow(tok, n1, sp.O, sp.W([2, -1, 0])); n1.label('(2, −1, 0)', 'idx');
    const n2 = arrow(C.b); await grow(tok, n2, sp.O, sp.W([3, 0, -1])); n2.label('(3, 0, −1)', 'idx');
    rightAngle(sp.O, sp.D(x), sp.D([3, 0, -1]), 0.25);
    say('null space 裡每個向量都垂直 row space', 'row space ⟂ N(A)，維度 1 + 2 = 3 = n');
    await beat(tok, 3400);
    say('它們是 ℝ³ 中的正交補（orthogonal complements）', 'N(A) = C(Aᵀ)^⊥');
    void mt; void pl;
    await beat(tok, 2600);
  }

  // ───────────────────────── 場景（課本）：投影到直線 ─────────────────────────
  async function scProjLine(tok) {
    fresh([5.4, 5.6, 9.2], [0.4, 2.8, 0]);
    const sp = space3(1.3, V3(0, 1.4, 0), 2.4);
    const a = [1, 2, 2], b = [1, 1, 1];
    const xh = dot(a, b) / dot(a, a), p = mul(xh, a), e = sub(b, p);
    rod(C.gray, 0.02).set(sp.W(mul(-0.3, a)), sp.W(mul(1.25, a)));
    const aa = arrow(C.a).set(sp.O, sp.W(a)).label('a = (1, 2, 2)', 'ptr');
    const ab = arrow(C.b); await grow(tok, ab, sp.O, sp.W(b)); ab.label('b = (1, 1, 1)', 'ptr alt');
    say('把 b 投影到 a 這條線上', '找線上離 b 最近的點 p = x̂a');
    await beat(tok, 2600);
    const dl = seg(sp.W(b), sp.W(b), '#6e5f49', true), dt = dotAt(sp.W(b), C.p, 0.07);
    await anim(tok, 1400, (t) => { const q = lerpV(b, p, t); dl.setPts(sp.W(b), sp.W(q)); dt.position.copy(sp.W(q)); });
    const ap = arrow(C.p, 0.065); await grow(tok, ap, sp.O, sp.W(p)); ap.label('p', '');
    const ae = arrow(C.e, 0.04); await grow(tok, ae, sp.W(p), sp.W(b), 500); ae.label('e = b − p', '');
    rightAngle(sp.W(p), sp.D(mul(-1, a)), sp.D(e), 0.2);
    say('關鍵：誤差 e 垂直 a', 'aᵀ(b − x̂a) = 0 ⇒ x̂ = aᵀb / aᵀa = 5/9');
    await beat(tok, 3400);
    say('p = (5/9)a = (5/9, 10/9, 10/9)', 'e = b − p = (4/9, −1/9, −1/9)，aᵀe = 4/9 − 2/9 − 2/9 = 0');
    await beat(tok, 3400);
    say('把 a 拉長兩倍：p 不變', '投影只看「直線」，不看 a 多長');
    await anim(tok, 1200, (t) => aa.set(sp.O, sp.W(mul(1 + t, a))));
    await beat(tok, 1400);
    await anim(tok, 800, (t) => aa.set(sp.O, sp.W(mul(2 - t, a))));
    say('p = a (aᵀb / aᵀa)', '<span class="ok">x̂ = 5/9，p ⟂ e</span>');
    await beat(tok, 2600);
  }

  // ───────────────────────── 場景（課本）：投影矩陣 P ─────────────────────────
  async function scProjMatrix(tok) {
    fresh([5.4, 5.6, 9.2], [0.2, 2.8, 0]);
    const sp = space3(1.3, V3(0, 1.4, 0), 2.4);
    const a = [1, 2, 2], P = (u) => mul(dot(a, u) / 9, a);
    rod(C.a, 0.03).set(sp.W(mul(-0.35, a)), sp.W(mul(1.3, a)));
    arrow(C.a).set(sp.O, sp.W(a)).label('a', 'ptr');
    const mt = mtag([[1, 2, 2], [2, 4, 4], [2, 4, 4]], -3.2, 5.3, 0, 'ptr');
    tag('P = aaᵀ / aᵀa = 1/9 ×', 'idx', -3.2, 6.3);
    say('投影矩陣 P = aaᵀ / aᵀa：p = Pb', 'rank 1，column space 就是 a 這條線');
    await beat(tok, 3000);
    const bs = [[1, 1, 1], [1.4, -0.4, 0.6], [-0.2, 1.2, 1.6], [0.9, 0.6, -0.3]];
    const cols = [C.b, '#e55a9b', C.c, C.gold];
    const arr = bs.map((b, k) => arrow(cols[k], 0.04).set(sp.O, sp.W(b)));
    say('任何 b 乘上 P，都落到這條線上', 'C(P) = 直線 a');
    await beat(tok, 1600);
    await anim(tok, 1600, (t) => arr.forEach((A, k) => A.set(sp.O, sp.W(lerpV(bs[k], P(bs[k]), t)))));
    await beat(tok, 1800);
    say('再投影一次：完全不動', 'P²b = P(Pb) = Pb ⇒ P² = P');
    for (let k = 0; k < 3; k++) { arr.forEach((A) => A.glow('#6a4a00')); await beat(tok, 350); arr.forEach((A) => A.glow(null)); await beat(tok, 350); }
    await beat(tok, 1600);
    mt.element.className = 'lab-label ptr alt';
    say('P 是對稱矩陣', 'Pᵀ = (aaᵀ)ᵀ / aᵀa = P');
    await beat(tok, 2600);
    say('一般的子空間：P = A(AᵀA)⁻¹Aᵀ', '投影矩陣兩個性質：Pᵀ = P、P² = P');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景（課本）：投影到平面 ─────────────────────────
  async function scProjPlane(tok) {
    fresh([5.6, 6.4, 9.6], [0.6, 2.9, 0]);
    const sp = space3(0.5, V3(0, 2.9, 0), 3.2);
    const a1 = [1, 1, 1], a2 = [0, 1, 2], b = [6, 0, 0];
    const p = [5, 2, -1], e = [1, -2, 1];
    span2(sp, a1, a2, 2.2, C.a, 0.17);
    const A1 = arrow(C.a).set(sp.O, sp.W(a1)).label('a₁', 'ptr'), A2 = arrow(C.a).set(sp.O, sp.W(a2)).label('a₂', 'ptr');
    const mt = mtag([[1, 0], [1, 1], [1, 2]], -4, 5.4, 0, 'ptr');
    tag('A =', 'idx', -4.9, 5.4);
    say('A 的兩個 columns 張成一個平面 C(A)', 'b = (6, 0, 0) 不在平面上 → Ax = b 無解');
    const B = arrow(C.b); await grow(tok, B, sp.O, sp.W(b)); B.label('b', 'ptr alt');
    await beat(tok, 2800);
    say('要找平面上離 b 最近的 p = Ax̂', 'e = b − Ax̂ 要垂直 a₁ 和 a₂：Aᵀ(b − Ax̂) = 0');
    const dl = seg(sp.W(b), sp.W(b), '#6e5f49', true), dt = dotAt(sp.W(b), C.p, 0.08);
    await anim(tok, 1600, (t) => { const q = lerpV(b, p, t); dl.setPts(sp.W(b), sp.W(q)); dt.position.copy(sp.W(q)); });
    await beat(tok, 1600);
    say('Normal equation：AᵀA x̂ = Aᵀb', '[3 3; 3 5] x̂ = (6, 0) ⇒ x̂ = (5, −3)');
    await beat(tok, 3200);
    const s1 = arrow(C.p, 0.035); await grow(tok, s1, sp.O, sp.W(mul(5, a1)), 900); s1.label('5a₁', 'idx');
    const s2 = arrow(C.p, 0.035); await grow(tok, s2, sp.W(mul(5, a1)), sp.W(p), 900); s2.label('−3a₂', 'idx');
    const P1 = arrow(C.p, 0.065); await grow(tok, P1, sp.O, sp.W(p), 700); P1.label('p = (5, 2, −1)', '');
    say('p = 5a₁ − 3a₂ = (5, 2, −1)', '');
    await beat(tok, 2400);
    kill(s1); kill(s2);
    const E = arrow(C.e, 0.045); await grow(tok, E, sp.W(p), sp.W(b), 600); E.label('e = (1, −2, 1)', '');
    rightAngle(sp.W(p), sp.D(mul(-1, a1)), sp.D(e), 0.22);
    say('e = b − p = (1, −2, 1) 垂直整個平面', 'a₁·e = 1 − 2 + 1 = 0，a₂·e = 0 − 2 + 2 = 0');
    await beat(tok, 3600);
    void A1; void A2; void mt;
  }

  // ───────────────────────── 場景（課本／L16）：最小平方擬合直線 ─────────────────────────
  function lsq(pts) {
    const n = pts.length; let st = 0, stt = 0, sb = 0, stb = 0;
    for (const [t, b] of pts) { st += t; stt += t * t; sb += b; stb += t * b; }
    const det = n * stt - st * st;
    if (Math.abs(det) < 1e-9) return null;
    const D = (n * stb - st * sb) / det;
    return { C: (sb - D * st) / n, D, ata: [[n, st], [st, stt]], atb: [sb, stb] };
  }
  async function scLeastSq(tok) {
    const pts = (ctx.params && ctx.params.pts) || [[0, 6], [1, 0], [2, 0]];
    const fit = lsq(pts);
    const ts = pts.map((p) => p[0]), bs = pts.map((p) => p[1]);
    const xr = [Math.min(0, ...ts) - 0.8, Math.max(...ts) + 0.8], yr = [Math.min(0, ...bs) - 1, Math.max(...bs) + 1.2];
    const S = Math.min(9 / (xr[1] - xr[0]), 5.2 / (yr[1] - yr[0]));
    const ox = -S * (xr[0] + xr[1]) / 2, oy = 0.6 - S * yr[0];
    fresh([0, 0.6 + S * (yr[1] - yr[0]) / 2 + 0.6, 11.5], [0, 0.6 + S * (yr[1] - yr[0]) / 2, 0]);
    const P = board2(ox, oy, S, xr, yr);
    tag('t', 'idx', ox + S * xr[1] + 0.3, oy); tag('b', 'idx', ox, oy + S * yr[1] + 0.3);
    pts.forEach(([t, b]) => { dotAt(P(t, b), C.b, 0.13); tag('(' + frac(t) + ', ' + frac(b) + ')', 'idx', P(t, b).x + 0.55, P(t, b).y + 0.3); });
    say(pts.length + ' 個點不在同一條直線上', pts.map(([t, b]) => 'C + ' + frac(t) + 'D = ' + frac(b)).join('，') + ' → 無解');
    await beat(tok, 3400);
    const ln = rod(C.gray, 0.04), res = pts.map(() => rod(C.e, 0.05));
    const sq = pts.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: C.e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })); lab.world.add(m); return m; });
    const sse = tag('', 'ptr alt', ox + S * xr[1] - 1.2, oy + S * yr[1] - 0.4);
    function draw(Cc, Dd) {
      const [t0, t1] = clipLine(Cc, Dd, xr, yr);
      ln.set(P(t0, Cc + Dd * t0), P(t1, Cc + Dd * t1));
      let s = 0;
      pts.forEach(([t, b], k) => {
        const q = Cc + Dd * t, r = b - q; s += r * r;
        res[k].set(P(t, q), P(t, b));
        const side = Math.abs(r) * S; sq[k].visible = side > 0.02; sq[k].scale.set(side, side, 1);
        sq[k].position.set(P(t, 0).x + side / 2 + 0.06, P(0, (b + q) / 2).y, -0.01);
      });
      txt(sse, '‖e‖² = ' + f2(s)); return s;
    }
    const mean = bs.reduce((x, y) => x + y, 0) / bs.length;
    draw(mean, 0);
    say('先試一條水平線 b = ' + f2(mean), '紅線 = 誤差 eᵢ = bᵢ − (C + Dtᵢ)，方塊 = eᵢ²');
    await beat(tok, 3200);
    say('Normal equation：AᵀA x̂ = Aᵀb', mtxt(fit.ata) + ' (C, D) = (' + frac(fit.atb[0]) + ', ' + frac(fit.atb[1]) + ')');
    await beat(tok, 2800);
    await anim(tok, 2200, (t) => { draw(mean + (fit.C - mean) * t, fit.D * t); ln.material.color.set(t > 0.98 ? C.p : C.gray); });
    const best = draw(fit.C, fit.D);
    const e = pts.map(([t, b]) => b - fit.C - fit.D * t);
    say('最佳直線 b = ' + frac(fit.C) + (fit.D < 0 ? ' − ' : ' + ') + frac(Math.abs(fit.D)) + 't', '誤差平方和最小 = ' + frac(best) + '；e = ' + vs(e));
    await beat(tok, 3600);
    say('e 垂直 A 的兩個 columns', 'Σeᵢ = 0、Σtᵢeᵢ = 0（就是 Aᵀe = 0）');
    await beat(tok, 3200);
  }
  // the part of b = C + Dt with t in xr whose height stays inside yr
  function clipLine(Cc, Dd, xr, yr) {
    let t0 = xr[0], t1 = xr[1];
    if (Math.abs(Dd) > 1e-9) { const ta = (yr[0] - Cc) / Dd, tb = (yr[1] - Cc) / Dd; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb)); }
    return [t0, t1];
  }
  const mtxt = (m) => '[' + m.map((r) => r.map(frac).join(' ')).join('; ') + ']';

  // ───────────────────────── 場景（L17）：orthonormal 向量 ─────────────────────────
  const QR3 = [[1, 2, 2], [-2, -1, 2], [2, -2, 1]].map((c) => mul(1 / 3, c)); // Strang 的例子：(1/3)[1 −2 2; 2 −1 −2; 2 2 1] 的 columns
  async function scOrthonormal(tok) {
    fresh([4.6, 5.0, 7.6], [0, 2.6, 0]);
    const sp = space3(1.7, V3(0, 2.6, 0), 2.2);
    ghostSphere(sp.O, 1.7);
    say('Orthonormal：互相垂直、長度都是 1', 'qᵢᵀqⱼ = 0（i ≠ j），qᵢᵀqᵢ = 1');
    await beat(tok, 2200);
    const names = ['q₁ = (1, 2, 2)/3', 'q₂ = (−2, −1, 2)/3', 'q₃ = (2, −2, 1)/3'];
    const qs = [];
    for (let k = 0; k < 3; k++) {
      const A = arrow(C.q, 0.06); await grow(tok, A, sp.O, sp.W(QR3[k]), 700); A.label(names[k], k === 1 ? 'ptr alt' : 'ptr'); qs.push(A);
      say(names[k], 'q' + '₁₂₃'[k] + 'ᵀq' + '₁₂₃'[k] + ' = 1 → 尖端落在單位球上');
      await beat(tok, 1600);
      for (let j = 0; j < k; j++) {
        rightAngle(sp.O, sp.D(QR3[j]), sp.D(QR3[k]), 0.28);
        say('q' + '₁₂₃'[j] + 'ᵀq' + '₁₂₃'[k] + ' = 0', vs(mul(3, QR3[j])) + '·' + vs(mul(3, QR3[k])) + ' / 9 = 0');
        qs[j].glow('#6a4a00'); A.glow('#6a4a00'); await beat(tok, 1500); qs[j].glow(null); A.glow(null);
      }
    }
    say('三個方向互成 90°：最乾淨的 basis', '數值計算最愛它：不會 overflow / underflow');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景（L17）：QᵀQ = I ─────────────────────────
  async function scQtQ(tok) {
    fresh([0.4, 4.6, 12.5], [0.4, 2.8, 0]);
    const sp = space3(1.6, V3(-2.8, 2.6, 0), 2.0);
    const q = [QR3[0], QR3[1]];
    const qa = q.map((u, k) => arrow(C.q, 0.06).set(sp.O, sp.W(u)).label('q' + '₁₂'[k], 'ptr'));
    tag('Q = (1/3) ×', 'idx', 1.2, 6.0);
    mtag([[1, -2], [2, -1], [2, 2]], 2.4, 6.0, 0, 'ptr');
    say('Q 有 orthonormal columns（這裡 3×2，不必是方陣）', 'Strang 的例子：(1/3)[1 −2; 2 −1; 2 2]');
    await beat(tok, 3000);
    tag('QᵀQ', 'ptr alt', 3.3, 4.4);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      qa[i].glow('#6a4a00'); qa[j].glow('#0f5a3a');
      const v = dot(q[i], q[j]);
      const m = cube(frac(v), Math.abs(v) > 0.5 ? C.p : '#d8cfc0', [0.9, 0.9, 0.5], 2.8 + j * 1.05, 3.4 - i * 1.05 + 2.5, 0);
      const b = lab.addBody(m); lab.dropTo(b, V3(2.8 + j * 1.05, 3.4 - i * 1.05, 0));
      say('第 ' + (i + 1) + ' 列 × 第 ' + (j + 1) + ' 行 = q' + '₁₂'[i] + 'ᵀq' + '₁₂'[j] + ' = ' + frac(v), i === j ? '自己和自己：長度² = 1' : '不同的 q：垂直 → 0');
      await beat(tok, 1700);
      qa[i].glow(null); qa[j].glow(null);
    }
    say('QᵀQ = I（2×2）', '<span class="ok">對角線 1、其他 0</span>');
    await beat(tok, 2600);
    tag('QQᵀ = 1/9 ×', 'idx', 1.0, 1.0);
    const qq = mtag([[5, 4, -2], [4, 5, 2], [-2, 2, 8]], 2.6, 1.0, 0, 'ptr');
    say('反過來乘 QQᵀ（3×3）不是 I', '<span class="no">QQᵀ ≠ I</span>：它是投影到 C(Q) 的投影矩陣');
    await beat(tok, 3400);
    const q3 = arrow(C.q, 0.06); await grow(tok, q3, sp.O, sp.W(QR3[2])); q3.label('q₃', 'ptr');
    txt(qq, 'QQᵀ = I'); qq.element.className = 'lab-label ptr alt';
    say('補上 q₃ = (2, −2, 1)/3：Q 變方陣', '方陣：QᵀQ = I ⇒ Qᵀ = Q⁻¹，這才叫 orthogonal matrix');
    await beat(tok, 3600);
  }

  // ───────────────────────── 場景（L17）：orthogonal matrix 的例子 ─────────────────────────
  async function scQExamples(tok) {
    fresh([4.6, 5.0, 7.8], [0, 2.6, 0]);
    let sp = space3(1.7, V3(0, 2.6, 0), 2.2);
    const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], T = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
    const cols = [C.a, C.b, C.p];
    const ar = E.map((u, k) => arrow(cols[k], 0.06).set(sp.O, sp.W(u)).label('第 ' + (k + 1) + ' 行', 'idx'));
    const mt = mtag([[0, 0, 1], [1, 0, 0], [0, 1, 0]], -3.4, 5.0, 0, 'ptr');
    say('例 1：permutation matrix', 'columns 都是單位向量、互相垂直');
    await beat(tok, 1600);
    await anim(tok, 1800, (t) => ar.forEach((A, k) => A.set(sp.O, sp.W(unit(lerpV(E[k], T[k], t))))));
    say('它的 transpose 也是 permutation：QᵀQ = I', '[0 0 1; 1 0 0; 0 1 0]');
    await beat(tok, 2800);
    // 2D rotation
    fresh([0, 3.0, 9.5], [0, 2.8, 0]);
    const P = board2(0, 2.8, 1.6, [-1.6, 1.6], [-1.5, 1.5]);
    circle2(P, 1);
    const c1 = arrow(C.a, 0.06), c2 = arrow(C.b, 0.06); c1.label('(cos θ, sin θ)', 'ptr'); c2.label('(−sin θ, cos θ)', 'ptr alt');
    const rot = (deg) => { const r = (deg * Math.PI) / 180; c1.set(P(0, 0), P(Math.cos(r), Math.sin(r))); c2.set(P(0, 0), P(-Math.sin(r), Math.cos(r))); say('例 2：旋轉 θ = ' + Math.round(deg) + '°', '內積 = −cos θ sin θ + sin θ cos θ = 0'); };
    rot(0); await beat(tok, 1200);
    await anim(tok, 2600, (t) => rot(t * 120)); await beat(tok, 1600);
    await anim(tok, 1000, (t) => rot(120 - 120 * t));
    say('例 3：[1 1; 1 −1]', 'columns 垂直，但長度 = √2');
    c1.set(P(0, 0), P(1, 1)); c2.set(P(0, 0), P(1, -1)); c1.label('(1, 1)', 'ptr'); c2.label('(1, −1)', 'ptr alt');
    await beat(tok, 2600);
    await anim(tok, 1200, (t) => { const k = 1 + (1 / Math.SQRT2 - 1) * t; c1.set(P(0, 0), P(k, k)); c2.set(P(0, 0), P(k, -k)); });
    c1.label('(1, 1)/√2', 'ptr'); c2.label('(1, −1)/√2', 'ptr alt');
    say('除以 √2 才是 orthogonal matrix', '補充：det = −1，這個其實是「反射」');
    await beat(tok, 3000);
    // Hadamard 4×4
    fresh([0, 6.5, 9], [0, 0.6, 0]);
    const H = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
    const cells = H.map((r, i) => r.map((v, j) => cube(v > 0 ? '+1' : '−1', v > 0 ? C.a : C.b, [1, 0.3, 1], -1.65 + j * 1.1, 0.15, -1.65 + i * 1.1)));
    tag('Hadamard 4×4（再除以 2）', 'ptr', 0, 0.3, 3.0);
    say('例 4：把 [1 1; 1 −1] 的 pattern 重複，右下取負號', '全是 ±1；每個 column 長度 √4 = 2 → 除以 2');
    await beat(tok, 3000);
    for (const [j, k] of [[0, 1], [1, 3], [2, 3]]) {
      for (let i = 0; i < 4; i++) { cells[i][j].position.y = 0.45; cells[i][k].position.y = 0.45; }
      const prods = H.map((r) => r[j] * r[k]);
      say('第 ' + (j + 1) + ' 行 · 第 ' + (k + 1) + ' 行', prods.map((x) => (x > 0 ? '+1' : '−1')).join(' ') + ' = 0（兩正兩負）');
      await beat(tok, 1900);
      for (let i = 0; i < 4; i++) { cells[i][j].position.y = 0.15; cells[i][k].position.y = 0.15; }
    }
    say('Hadamard 矩陣：2、4、16、64… 都做得出來', '哪些大小存在 ±1 的 orthogonal matrix，還是未解問題');
    await beat(tok, 3000);
    void mt; void sp;
  }

  // ───────────────────────── 場景（課本）：正交矩陣保持長度 ─────────────────────────
  const FSHAPE = [[0, 0], [0, 2], [1.2, 2], [1.2, 1.6], [0.4, 1.6], [0.4, 1.1], [1, 1.1], [1, 0.7], [0.4, 0.7], [0.4, 0]];
  async function scPreserve(tok) {
    fresh([0, 3.2, 11], [0, 3.0, 0]);
    const S = 0.62, P = board2(0, 3.0, S, [-7, 7.5], [-3.6, 4.2]);
    const x0 = [3, 4];
    const ax = arrow(C.a, 0.06), sh = poly(FSHAPE.map((u) => W2(P, add([-5.6, -2.6], u))), C.q, true);
    const ghost = poly(FSHAPE.map((u) => W2(P, add([-5.6, -2.6], u))), '#d8cfc0', true);
    ax.label('x = (3, 4)', 'ptr');
    const app = (M, u) => [M[0][0] * u[0] + M[0][1] * u[1], M[1][0] * u[0] + M[1][1] * u[1]];
    const lerpM = (A, B, t) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * t));
    let cur = [[1, 0], [0, 1]];
    const show = (M) => { const y = app(M, x0); ax.set(P(0, 0), W2(P, y)); sh.setPts(FSHAPE.map((u) => W2(P, add([-5.6, -2.6], app(M, add(u, [0, 0])))))); return norm(y); };
    show(cur);
    say('‖x‖ = 5', '看 Qx 的長度會不會變');
    await beat(tok, 2200);
    const rotM = (deg) => { const r = (deg * Math.PI) / 180; return [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]]; };
    await anim(tok, 2200, (t) => { const L = show(rotM(50 * t)); say('旋轉 ' + Math.round(50 * t) + '°', '‖Qx‖ = ' + f2(L)); });
    cur = rotM(50);
    await beat(tok, 1600);
    const refl = [[0, 1], [1, 0]];
    await anim(tok, 1600, (t) => { const L = show(lerpM(cur, refl, t)); if (t > 0.99) say('對 y = x 反射', '‖Qx‖ = ' + f2(L)); });
    cur = refl;
    say('旋轉、反射：長度和形狀都不變', '‖Qx‖² = xᵀQᵀQx = xᵀx');
    await beat(tok, 3000);
    const shear = [[1, 1], [0, 1]];
    ax.color(C.e);
    await anim(tok, 1800, (t) => { const L = show(lerpM(cur, shear, t)); say('換成不是 orthogonal 的 [1 1; 0 1]', '‖Ax‖ = ' + f2(L)); });
    say('剪切矩陣：長度 5 → √65 ≈ 8.06，F 也變形', '<span class="no">AᵀA ≠ I</span> 就不保持長度');
    await beat(tok, 3200);
    void ghost;
  }

  // ───────────────────────── 場景（L17）：P = QQᵀ ─────────────────────────
  const QB = [1, -1, 5]; // = 3q₁ + 3q₂ + 3q₃，投影 (−1, 1, 4)
  async function scProjQQt(tok) {
    fresh([5.6, 5.8, 9.2], [0.2, 3.0, 0]);
    const sp = space3(0.6, V3(0, 2.4, 0), 2.4);
    const pl = span2(sp, QR3[0], QR3[1], 1.7, C.q, 0.17);
    const q1 = arrow(C.q, 0.06).set(sp.O, sp.W(mul(1.5, QR3[0]))).label('q₁', 'ptr'), q2 = arrow(C.q, 0.06).set(sp.O, sp.W(mul(1.5, QR3[1]))).label('q₂', 'ptr');
    const pm = mtag([[5, 4, -2], [4, 5, 2], [-2, 2, 8]], -3.6, 5.6, 0, 'ptr'); tag('P = QQᵀ = 1/9 ×', 'idx', -3.6, 6.6);
    say('投影到 C(Q)：A(AᵀA)⁻¹Aᵀ 裡的 QᵀQ = I', 'P = Q(QᵀQ)⁻¹Qᵀ = QQᵀ，不用求反矩陣');
    await beat(tok, 3200);
    const p = [-1, 1, 4], e = sub(QB, p);
    const B = arrow(C.b); await grow(tok, B, sp.O, sp.W(QB)); B.label('b = (1, −1, 5)', 'ptr alt');
    const dl = seg(sp.W(QB), sp.W(QB), '#6e5f49', true);
    await anim(tok, 1400, (t) => dl.setPts(sp.W(QB), sp.W(lerpV(QB, p, t))));
    const ap = arrow(C.p, 0.065); await grow(tok, ap, sp.O, sp.W(p)); ap.label('Pb = (−1, 1, 4)', '');
    const ae = arrow(C.e, 0.04).set(sp.W(p), sp.W(QB)).label('e', '');
    say('Pb = (−1, 1, 4)', 'e = (2, −2, 1) 垂直 q₁、q₂');
    await beat(tok, 3000);
    say('投影矩陣性質 1：對稱', '(QQᵀ)ᵀ = QQᵀ');
    pm.element.className = 'lab-label ptr alt'; await beat(tok, 2200);
    say('性質 2：投影兩次 = 投影一次', '(QQᵀ)(QQᵀ) = Q(QᵀQ)Qᵀ = QQᵀ');
    for (let k = 0; k < 3; k++) { ap.glow('#6a4a00'); await beat(tok, 350); ap.glow(null); await beat(tok, 350); }
    await beat(tok, 1400);
    const q3 = arrow(C.q, 0.06); await grow(tok, q3, sp.O, sp.W(mul(1.5, QR3[2]))); q3.label('q₃', 'ptr');
    say('如果 Q 是方陣：C(Q) 是整個空間', 'P = QQᵀ = I，b 不用動');
    await anim(tok, 1400, (t) => { ap.set(sp.O, sp.W(lerpV(p, QB, t))); ae.set(sp.W(lerpV(p, QB, t)), sp.W(QB)); pl.material.opacity = 0.17 * (1 - t); });
    txt(pm, 'P = I');
    await beat(tok, 3000);
    void q1; void q2; void e;
  }

  // ───────────────────────── 場景（L17）：x̂ᵢ = qᵢᵀb ─────────────────────────
  async function scXhatDot(tok) {
    fresh([5.6, 5.8, 9.2], [0.2, 3.0, 0]);
    const sp = space3(0.6, V3(0, 2.4, 0), 2.4);
    span2(sp, QR3[0], QR3[1], 1.7, C.q, 0.14);
    rod(C.q, 0.02).set(sp.W(mul(-1, QR3[0])), sp.W(mul(4, QR3[0])));
    rod(C.q, 0.02).set(sp.W(mul(-1, QR3[1])), sp.W(mul(4, QR3[1])));
    arrow(C.q, 0.06).set(sp.O, sp.W(QR3[0])).label('q₁', 'ptr'); arrow(C.q, 0.06).set(sp.O, sp.W(QR3[1])).label('q₂', 'ptr');
    const B = arrow(C.b).set(sp.O, sp.W(QB)).label('b', 'ptr alt');
    say('Normal equation：QᵀQ x̂ = Qᵀb', '左邊 QᵀQ = I 直接消失 → x̂ = Qᵀb');
    await beat(tok, 3200);
    const xs = [];
    for (let k = 0; k < 2; k++) {
      const c = dot(QR3[k], QB), foot = mul(c, QR3[k]);
      const dl = seg(sp.W(QB), sp.W(QB), '#6e5f49', true);
      await anim(tok, 1100, (t) => dl.setPts(sp.W(QB), sp.W(lerpV(QB, foot, t))));
      const A = arrow(C.p, 0.05); await grow(tok, A, sp.O, sp.W(foot), 700); A.label('x̂' + '₁₂'[k] + ' = q' + '₁₂'[k] + 'ᵀb = ' + frac(c), '');
      say('x̂' + '₁₂'[k] + ' = q' + '₁₂'[k] + 'ᵀb = ' + frac(c), '沿著第 ' + (k + 1) + ' 個 basis 向量的分量 = 一個內積');
      xs.push(A); await beat(tok, 2200);
      kill(dl);
    }
    const s2 = arrow(C.p, 0.035); await grow(tok, s2, sp.W(mul(3, QR3[0])), sp.W([-1, 1, 4]), 700);
    const ap = arrow(C.p, 0.07); await grow(tok, ap, sp.O, sp.W([-1, 1, 4]), 700); ap.label('p = 3q₁ + 3q₂', '');
    say('p = x̂₁q₁ + x̂₂q₂ = (−1, 1, 4)', '<span class="ok">x̂ = Qᵀb = (3, 3)，不必解聯立方程</span>');
    await beat(tok, 3400);
    void B;
  }

  // ───────────────────────── 場景（L17）：Gram-Schmidt 兩個向量 ─────────────────────────
  async function scGSTwo(tok) {
    fresh([0.6, 2.9, 10], [0.6, 2.7, 0]);
    const P = board2(-1.2, 1.4, 1.15, [-1.6, 3.6], [-0.9, 2.6]);
    const a = [3, 1], b = [1, 2];
    const k = dot(a, b) / dot(a, a), p = mul(k, a), B = sub(b, p);
    const A = arrow(C.a, 0.06).set(P(0, 0), W2(P, a)).label('a', 'ptr');
    const Bb = arrow(C.b, 0.06).set(P(0, 0), W2(P, b)).label('b', 'ptr alt');
    say('兩個獨立但不垂直的向量 a、b', '目標：做出 orthonormal 的 q₁、q₂');
    await beat(tok, 2600);
    A.label('A = a', 'ptr');
    say('第一個方向不用改：A = a', '');
    await beat(tok, 2000);
    const dl = seg(W2(P, b), W2(P, b), '#6e5f49', true);
    await anim(tok, 1300, (t) => dl.setPts(W2(P, b), W2(P, lerpV(b, p, t))));
    const ap = arrow(C.p, 0.045); await grow(tok, ap, P(0, 0), W2(P, p), 600); ap.label('投影 p', 'idx');
    say('b 在 A 方向的投影', 'p = (Aᵀb / AᵀA) A = (5/10) A');
    await beat(tok, 2600);
    const ae = arrow(C.e, 0.06); await grow(tok, ae, W2(P, p), W2(P, b), 700); ae.label('e', '');
    say('要的是另一部分：投影那課的 error e', 'B = e = b − (Aᵀb / AᵀA) A');
    await beat(tok, 2800);
    await anim(tok, 1200, (t) => ae.set(W2(P, mul(1 - t, p)), W2(P, add(mul(1 - t, p), B))));
    ae.label('B = (−1/2, 3/2)', '');
    const ra = rightAngle(P(0, 0), W2(P, a).sub(P(0, 0)), W2(P, B).sub(P(0, 0)), 0.25);
    kill(dl); kill(ap);
    say('檢查：AᵀB = Aᵀb − (Aᵀb/AᵀA)·AᵀA = 0', 'AᵀB = 3·(−1/2) + 1·(3/2) = 0');
    await beat(tok, 3000);
    circle2(P, 1, '#cbbd9f');
    await anim(tok, 1300, (t) => { A.set(P(0, 0), W2(P, lerpV(a, unit(a), t))); ae.set(P(0, 0), W2(P, lerpV(B, unit(B), t))); });
    A.label('q₁ = A/‖A‖', 'ptr'); ae.label('q₂ = B/‖B‖', ''); A.color(C.q); ae.color(C.q);
    say('最後除以長度（Strang：這是 Schmidt 的貢獻）', 'q₁ = A/√10，q₂ = B/√(5/2)');
    await beat(tok, 3200);
    void Bb; void ra;
  }

  // ───────────────────────── 場景（L17）：Gram-Schmidt 第三個向量 ─────────────────────────
  async function scGSThree(tok) {
    fresh([5.4, 6.2, 8.8], [0.4, 3.0, 0]);
    const sp = space3(1.0, V3(0, 2.6, 0), 2.6);
    const a = [2, 1, 0], b = [1, 2, 0], c = [1, 0.5, 2];
    const A = a, B = sub(b, mul(dot(A, b) / dot(A, A), A));
    const pA = mul(dot(A, c) / dot(A, A), A), pB = mul(dot(B, c) / dot(B, B), B), Cv = sub(sub(c, pA), pB);
    const pl = span2(sp, A, B, 2.3, C.a, 0.14);
    arrow(C.a, 0.06).set(sp.O, sp.W(A)).label('A', 'ptr');
    const ab = arrow(C.b, 0.04).set(sp.O, sp.W(b)).label('b', 'idx');
    const aB = arrow(C.a, 0.06).set(sp.O, sp.W(B)).label('B', 'ptr');
    rightAngle(sp.O, sp.D(A), sp.D(B), 0.25);
    say('A、B 已經垂直（上一步做好的）', 'B = b − (Aᵀb/AᵀA)A');
    await beat(tok, 2600);
    kill(ab);
    const ac = arrow(C.c, 0.06); await grow(tok, ac, sp.O, sp.W(c)); ac.label('c', 'ptr alt');
    say('第三個向量 c「跳出黑板」', '要減掉它在 A 和 B 方向的分量');
    await beat(tok, 2600);
    const dl = seg(sp.W(c), sp.W(c), '#6e5f49', true);
    say('減掉 (Aᵀc/AᵀA)A', 'c − ' + frac(dot(A, c) / dot(A, A)) + 'A');
    await anim(tok, 1500, (t) => { const q = sub(c, mul(t, pA)); ac.set(sp.O, sp.W(q)); dl.setPts(sp.W(c), sp.W(q)); });
    await beat(tok, 1200);
    say('再減掉 (Bᵀc/BᵀB)B', 'C = c − (Aᵀc/AᵀA)A − (Bᵀc/BᵀB)B');
    await anim(tok, 1500, (t) => { const q = sub(sub(c, pA), mul(t, pB)); ac.set(sp.O, sp.W(q)); });
    ac.label('C', 'ptr alt');
    rightAngle(sp.O, sp.D(A), sp.D(Cv), 0.25); rightAngle(sp.O, sp.D(B), sp.D(Cv), 0.25);
    say('C 同時垂直 A 和 B（垂直整個平面）', 'AᵀC = 0、BᵀC = 0');
    await beat(tok, 3000);
    say('最後 q₃ = C / ‖C‖', '每一步：減掉前面所有方向的投影，再除以長度');
    await anim(tok, 1000, (t) => ac.set(sp.O, sp.W(lerpV(Cv, unit(Cv), t))));
    await beat(tok, 2600);
    void pl; void aB;
  }

  // ───────────────────────── 場景（L17）：a = (1,1,1)、b = (1,0,2) ─────────────────────────
  async function scGS111(tok) {
    fresh([5.4, 6.0, 9], [0.3, 3.1, 0]);
    const sp = space3(1.1, V3(0, 2.5, 0), 2.4);
    const a = [1, 1, 1], b = [1, 0, 2], B = [0, -1, 1];
    const pl = span2(sp, a, b, 1.85, C.a, 0.15);
    const A1 = arrow(C.a, 0.06).set(sp.O, sp.W(a)).label('a = (1, 1, 1)', 'ptr');
    const Bb = arrow(C.b, 0.06).set(sp.O, sp.W(b)).label('b = (1, 0, 2)', 'ptr alt');
    say('Strang 的數字例子：a = (1, 1, 1)、b = (1, 0, 2)', '故意不垂直：a·b = 3');
    await beat(tok, 3000);
    say('Aᵀb = 3，AᵀA = 3，比值 = 1', 'B = b − (3/3)A');
    const dl = seg(sp.W(b), sp.W(b), '#6e5f49', true);
    await anim(tok, 1300, (t) => dl.setPts(sp.W(b), sp.W(lerpV(b, a, t))));
    await beat(tok, 1400);
    const aB = arrow(C.e, 0.06); await grow(tok, aB, sp.W(a), sp.W(b), 700);
    await anim(tok, 1200, (t) => aB.set(sp.W(mul(1 - t, a)), sp.W(add(mul(1 - t, a), B))));
    aB.label('B = (0, −1, 1)', '');
    rightAngle(sp.O, sp.D(a), sp.D(B), 0.25);
    say('B = (1, 0, 2) − (1, 1, 1) = (0, −1, 1)', 'A·B = 0 − 1 + 1 = 0 ✓');
    await beat(tok, 3200);
    kill(dl);
    await anim(tok, 1300, (t) => { A1.set(sp.O, sp.W(lerpV(a, unit(a), t))); aB.set(sp.O, sp.W(lerpV(B, unit(B), t))); });
    A1.label('q₁ = (1, 1, 1)/√3', 'ptr'); aB.label('q₂ = (0, −1, 1)/√2', '');
    tag('Q =', 'idx', -4.4, 5.6); mtag([['1/√3', '0'], ['1/√3', '−1/√2'], ['1/√3', '1/√2']], -2.9, 5.6, 0, 'ptr');
    say('除以長度：√3 和 √2', '平方根是 Gram-Schmidt 的「代價」');
    await beat(tok, 3200);
    say('C(Q) 和 C(A) 是同一個平面', '只是換成互相垂直的 basis');
    for (let k = 0; k < 3; k++) { pl.material.opacity = 0.32; await beat(tok, 350); pl.material.opacity = 0.15; await beat(tok, 350); }
    await beat(tok, 1800);
    void Bb;
  }

  // ───────────────────────── 場景（L17）：A = QR ─────────────────────────
  async function scQR(tok) {
    fresh([1.2, 4.6, 12], [1.2, 2.8, 0]);
    const sp = space3(1.0, V3(-3.0, 2.0, 0), 2.0);
    const a1 = [1, 1, 1], a2 = [1, 0, 2], q1 = unit(a1), q2 = unit([0, -1, 1]);
    const Q1 = arrow(C.q, 0.06).set(sp.O, sp.W(q1)).label('q₁', 'ptr'), Q2 = arrow(C.q, 0.06).set(sp.O, sp.W(q2)).label('q₂', 'ptr');
    const A1 = arrow(C.a, 0.045).set(sp.O, sp.W(a1)).label('a₁', 'idx'), A2 = arrow(C.b, 0.045).set(sp.O, sp.W(a2)).label('a₂', 'idx');
    tag('[a₁ a₂] = [q₁ q₂] R', 'ptr', 2.6, 6.2);
    say('消去法 → A = LU；Gram-Schmidt → A = QR', 'R 記錄每個 a 用了多少 q');
    await beat(tok, 3000);
    const slots = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const R = [[dot(q1, a1), dot(q1, a2)], [dot(q2, a1), dot(q2, a2)]];
    const nm = [['q₁ᵀa₁', 'q₁ᵀa₂'], ['q₂ᵀa₁', 'q₂ᵀa₂']];
    for (const [i, j] of slots) {
      const qa = [Q1, Q2][i], aa = [A1, A2][j];
      qa.glow('#6a4a00'); aa.glow('#0f5a3a');
      const v = R[i][j], zero = Math.abs(v) < 1e-9;
      const m = cube(frac(v), zero ? '#d8cfc0' : C.p, [1.1, zero ? 0.2 : 0.9, 0.6], 1.8 + j * 1.3, 6, 0);
      lab.dropTo(lab.addBody(m), V3(1.8 + j * 1.3, 4.6 - i * 1.2, 0));
      say('r' + '₁₂'[i] + '₁₂'[j] + ' = ' + nm[i][j] + ' = ' + frac(v), zero ? 'q₂ 是做成垂直 a₁ 的 → 0' : '');
      await beat(tok, 2200);
      qa.glow(null); aa.glow(null);
    }
    tag('R', 'ptr alt', 1.0, 4.0);
    say('R = [√3 √3; 0 √2]：上三角', '後面的 q 垂直前面所有的 a → 左下全是 0');
    await beat(tok, 2800);
    const s1 = arrow(C.p, 0.035); await grow(tok, s1, sp.O, sp.W(mul(Math.sqrt(3), q1)), 800);
    const s2 = arrow(C.p, 0.035); await grow(tok, s2, sp.W(mul(Math.sqrt(3), q1)), sp.W(a2), 800);
    say('a₂ = √3 q₁ + √2 q₂', 'R 的第 2 行就是 a₂ 的組合係數');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景（習題課）：a、b、c → q₁、q₂、q₃ ─────────────────────────
  async function scGSRita(tok) {
    const stop = ctx.params && ctx.params.stop !== undefined ? ctx.params.stop : 3;
    fresh([5.2, 5.4, 8.6], [0.4, 2.4, 0]);
    const sp = space3(0.38, V3(0, 1.4, 0), 2.6);
    const a = [1, 0, 0], b = [2, 0, 3], c = [4, 5, 6];
    tag('A =', 'idx', -4.8, 5.6); mtag([[1, 2, 4], [0, 0, 5], [0, 3, 6]], -3.6, 5.6, 0, 'ptr');
    const Aa = arrow(C.a, 0.05).set(sp.O, sp.W(a)).label('a = (1, 0, 0)', 'ptr');
    const Ab = arrow(C.b, 0.05).set(sp.O, sp.W(b)).label('b = (2, 0, 3)', 'ptr alt');
    const Ac = arrow(C.c, 0.05).set(sp.O, sp.W(c)).label('c = (4, 5, 6)', '');
    say('A 的 columns：a、b、c', '每一步：減掉前面所有 q 的投影，再除以長度');
    await beat(tok, 3000);
    if (stop < 1) { await beat(tok, 1500); return; }
    // q1
    say('q₁ = a / ‖a‖', 'a 長度本來就是 1 → q₁ = (1, 0, 0)');
    Aa.color(C.q); Aa.label('q₁ = (1, 0, 0)', 'ptr');
    await beat(tok, 2800);
    if (stop < 2) { await beat(tok, 1500); return; }
    // q2
    say('q₂′ = b − (b·q₁)q₁', 'b·q₁ = 2 → (2, 0, 3) − 2(1, 0, 0)');
    const s = arrow(C.p, 0.035); await grow(tok, s, sp.O, sp.W([2, 0, 0]), 700); s.label('2q₁', 'idx');
    await anim(tok, 1400, (t) => Ab.set(sp.O, sp.W(sub(b, mul(2 * t, a)))));
    Ab.label('q₂′ = (0, 0, 3)', 'ptr alt'); kill(s);
    say('q₂′ = (0, 0, 3)，和 q₁ 內積為 0', '不用除以 q₁·q₁：q₁ 已是單位向量');
    await beat(tok, 2800);
    await anim(tok, 1000, (t) => Ab.set(sp.O, sp.W([0, 0, 3 - 2 * t])));
    Ab.color(C.q); Ab.label('q₂ = (0, 0, 1)', 'ptr alt');
    say('除以長度 3：q₂ = (0, 0, 1)', '');
    await beat(tok, 2400);
    if (stop < 3) { await beat(tok, 1500); return; }
    // q3
    say('q₃′ = c − (c·q₁)q₁ − (c·q₂)q₂', 'c·q₁ = 4、c·q₂ = 6');
    await anim(tok, 1300, (t) => Ac.set(sp.O, sp.W(sub(c, [4 * t, 0, 0]))));
    await anim(tok, 1300, (t) => Ac.set(sp.O, sp.W(sub(c, [4, 0, 6 * t]))));
    Ac.label('q₃′ = (0, 5, 0)', '');
    say('(4, 5, 6) − 4(1, 0, 0) − 6(0, 0, 1) = (0, 5, 0)', '同時垂直 q₁ 和 q₂');
    await beat(tok, 3000);
    await anim(tok, 1000, (t) => Ac.set(sp.O, sp.W([0, 5 - 4 * t, 0])));
    Ac.color(C.q); Ac.label('q₃ = (0, 1, 0)', '');
    say('除以 5：q₃ = (0, 1, 0)', '這題很幸運：沒有平方根');
    await beat(tok, 3000);
  }
  async function scQRRita(tok) {
    const focus = (ctx.params && ctx.params.focus) || 'all';
    if (focus !== 'coef') {
      fresh([0, 3.0, 12], [0, 2.8, 0]);
      const A = [[1, 2, 4], [0, 0, 5], [0, 3, 6]], Q = [[1, 0, 0], [0, 0, 1], [0, 1, 0]], R = [[1, 2, 4], [0, 3, 6], [0, 0, 5]];
      const grid = (M, x0, color, nm) => { tag(nm, 'ptr', x0 + 1, 5.0); return M.map((r, i) => r.map((v, j) => cube(v, v === 0 ? '#e6dccb' : color, [0.8, 0.8, 0.4], x0 + j * 0.95, 3.6 - i * 0.95, 0))); };
      grid(A, -5.6, C.a, 'A'); tag('=', 'idx', -2.4, 2.6);
      const qg = grid(Q, -1.9, C.q, 'Q');
      const rg = grid(R, 1.8, C.p, 'R');
      say('A = QR：Q 的 columns 是 q₁、q₂、q₃', 'Q = [1 0 0; 0 0 1; 0 1 0]');
      await beat(tok, 3200);
      say('這個 Q 是 permutation matrix', '作用：交換 R 的第 2、3 列');
      qg[1][2].material.emissive = new THREE.Color('#6a4a00'); qg[2][1].material.emissive = new THREE.Color('#6a4a00');
      await beat(tok, 2400);
      const rowY = (i) => 3.6 - i * 0.95;
      const b1 = rg[1].map((m) => lab.addBody(m)), b2 = rg[2].map((m) => lab.addBody(m));
      b1.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(2), 0.6)));
      b2.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(1), -0.6)));
      await beat(tok, 900);
      b1.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(2), 0)));
      b2.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(1), 0)));
      say('交換後就是 A：所以 R = [1 2 4; 0 3 6; 0 0 5]', '');
      await beat(tok, 2600);
      b1.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(1), 0)));
      b2.forEach((b, j) => lab.springTo(b, V3(1.8 + j * 0.95, rowY(2), 0)));
      say('R 是上三角', '<span class="ok">Q orthogonal、R upper triangular</span>');
      await beat(tok, 2800);
    }
    if (focus !== 'factor') {
      fresh([5.2, 5.4, 8.6], [0.4, 2.4, 0]);
      const sp = space3(0.38, V3(0, 1.4, 0), 2.6);
      const q = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];
      q.forEach((u, k) => arrow(C.q, 0.05).set(sp.O, sp.W(mul(1.4, u))).label('q' + '₁₂₃'[k], 'ptr'));
      say('R 的每一行 = 組合係數', 'A 的第 j 行 = Q × R 的第 j 行');
      await beat(tok, 2600);
      const chain = async (coefs, color, name, cap) => {
        let cur = [0, 0, 0]; const parts = [];
        for (let k = 0; k < 3; k++) {
          if (!coefs[k]) continue;
          const nx = add(cur, mul(coefs[k], q[k]));
          const A = arrow(color, 0.04); await grow(tok, A, sp.W(cur), sp.W(nx), 700); A.label(coefs[k] + 'q' + '₁₂₃'[k], 'idx'); parts.push(A);
          cur = nx;
        }
        const T = arrow(color, 0.06); await grow(tok, T, sp.O, sp.W(cur), 600); T.label(name, 'ptr alt');
        say(cap, '');
        await beat(tok, 2600);
        parts.forEach(kill);
      };
      await chain([1, 0, 0], C.a, 'a', 'a = 1·q₁');
      await chain([2, 3, 0], C.b, 'b', 'b = 2q₁ + 3q₂（2 = b·q₁，3 = ‖q₂′‖）');
      await chain([4, 6, 5], C.c, 'c', 'c = 4q₁ + 6q₂ + 5q₃（4 = c·q₁，6 = c·q₂，5 = ‖q₃′‖）');
      say('R 的對角線 = 每一步減完後剩下的長度', 'rᵢⱼ = qᵢ·aⱼ（i < j）');
      await beat(tok, 3000);
    }
  }

  // ───────────────────────── 模式 1：投影實驗 ─────────────────────────
  const pj = { kind: 'line', b: [1, 1, 1] };
  function enterProj() {
    fresh([5.6, 6.0, 9.6], [0.4, 2.6, 0]);
    const sp = space3(0.55, V3(0, 2.4, 0), 3.0);
    const isLine = pj.kind === 'line';
    const a = [1, 2, 2], A = [[1, 1, 1], [0, 1, 2]];
    if (isLine) { rod(C.a, 0.025).set(sp.W(mul(-1.5, a)), sp.W(mul(1.6, a))); arrow(C.a).set(sp.O, sp.W(a)).label('a = (1, 2, 2)', 'ptr'); }
    else { span2(sp, A[0], A[1], 3.0, C.a, 0.17); A.forEach((u, k) => arrow(C.a).set(sp.O, sp.W(u)).label('a' + '₁₂'[k], 'ptr')); }
    const b = pj.b;
    let p, xh;
    if (isLine) { xh = [dot(a, b) / dot(a, a)]; p = mul(xh[0], a); }
    else {
      const M = [[3, 3], [3, 5]], r = [dot(A[0], b), dot(A[1], b)], det = 6;
      xh = [(M[1][1] * r[0] - M[0][1] * r[1]) / det, (M[0][0] * r[1] - M[1][0] * r[0]) / det];
      p = add(mul(xh[0], A[0]), mul(xh[1], A[1]));
    }
    const e = sub(b, p);
    arrow(C.b).set(sp.O, sp.W(b)).label('b', 'ptr alt');
    const ap = arrow(C.p, 0.06), ae = arrow(C.e, 0.04);
    tween(700, (t) => { ap.set(sp.O, sp.W(mul(t, p))); ae.set(sp.W(lerpV(b, p, t)), sp.W(b)); }, () => { ap.label('p', ''); ae.label('e', ''); });
    if (norm(e) > 1e-6 && norm(p) > 1e-6) rightAngle(sp.W(p), sp.D(mul(-1, p)), sp.D(e), 0.2);
    controls('<button id="pjLine"' + (isLine ? ' class="primary"' : '') + '>投影到直線 a</button><button id="pjPlane"' + (!isLine ? ' class="primary"' : '') + '>投影到平面 C(A)</button>'
      + '<label>b = <input id="pjB" value="' + b.map(f2).join(', ') + '" size="10"></label><button id="pjGo">套用</button><button id="pjRnd">隨機 b</button>');
    on('pjLine', () => { pj.kind = 'line'; enterProj(); });
    on('pjPlane', () => { pj.kind = 'plane'; enterProj(); });
    on('pjGo', () => {
      const v = $('pjB').value.replace(/−/g, '-').split(/[ ,，]+/).filter(Boolean).map(Number);
      if (v.length !== 3 || v.some((x) => !isFinite(x))) { log('b 要輸入三個數字，例如 1, 1, 1', true); return; }
      if (v.some((x) => Math.abs(x) > 6)) { log('每個分量請在 −6 到 6 之間，不然會跑出舞台。', true); return; }
      pj.b = v; log('b = ' + vs(v, f2)); enterProj();
    });
    on('pjRnd', () => { pj.b = [rnd(-3, 5), rnd(-3, 4), rnd(-1, 5)]; log('隨機 b = ' + vs(pj.b)); enterProj(); });
    const rows = isLine
      ? [['子空間', '直線 a = (1, 2, 2)'], ['x̂ = aᵀb / aᵀa', frac(xh[0])], ['p = x̂a', vs(p)], ['e = b − p', vs(e)], ['aᵀe', frac(dot(a, e))]]
      : [['子空間', '平面 C(A)，A = [1 0; 1 1; 1 2]'], ['x̂（AᵀAx̂ = Aᵀb）', vs(xh)], ['p = Ax̂', vs(p)], ['e = b − p', vs(e)], ['Aᵀe', vs([dot(A[0], e), dot(A[1], e)])]];
    setState('投影：p 是子空間裡離 b 最近的點', rows, isLine ? 'P = aaᵀ/aᵀa = 1/9 [1 2 2; 2 4 4; 2 4 4]' : 'P = A(AᵀA)⁻¹Aᵀ；<span class="ok">e ⟂ 子空間</span>');
    if (norm(e) < 1e-9) log('b 已經在子空間裡：p = b、e = 0。');
  }

  // ───────────────────────── 模式 2：最小平方 ─────────────────────────
  const ls = { pts: [[0, 6], [1, 0], [2, 0]], sel: 0, man: null };
  function enterLS() {
    fresh([0, 4.4, 12.2], [0, 3.6, 0]);
    const xr = [-0.6, 6.4], yr = [-1.4, 7.4], S = 0.72, ox = -S * (xr[0] + xr[1]) / 2, oy = 0.7 - S * yr[0];
    const P = board2(ox, oy, S, xr, yr);
    tag('t', 'idx', ox + S * xr[1] + 0.3, oy); tag('b', 'idx', ox, oy + S * yr[1] + 0.3);
    ls.pts.forEach(([t, b], k) => { dotAt(P(t, b), k === ls.sel ? C.gold : C.b, k === ls.sel ? 0.17 : 0.13); });
    const fit = lsq(ls.pts);
    const line = (Cc, Dd, color, dashed) => {
      const [t0, t1] = clipLine(Cc, Dd, xr, yr); if (t1 <= t0) return;
      if (dashed) seg(P(t0, Cc + Dd * t0), P(t1, Cc + Dd * t1), color, true); else rod(color, 0.04).set(P(t0, Cc + Dd * t0), P(t1, Cc + Dd * t1));
    };
    let sse = null;
    if (fit) {
      line(fit.C, fit.D, C.p);
      sse = 0;
      ls.pts.forEach(([t, b]) => {
        const q = fit.C + fit.D * t, r = b - q; sse += r * r;
        rod(C.e, 0.05).set(P(t, q), P(t, b));
        const side = Math.abs(r) * S;
        if (side > 0.02) { const m = new THREE.Mesh(new THREE.PlaneGeometry(side, side), new THREE.MeshBasicMaterial({ color: C.e, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })); m.position.set(P(t, 0).x + side / 2 + 0.06, P(0, (b + q) / 2).y, -0.01); lab.world.add(m); }
      });
    }
    let mse = null;
    if (ls.man) { line(ls.man[0], ls.man[1], '#6e5f49', true); mse = ls.pts.reduce((s, [t, b]) => s + Math.pow(b - ls.man[0] - ls.man[1] * t, 2), 0); }
    controls('<button id="lsPrev">◀ 選點</button><button id="lsNext">選點 ▶</button><button id="lsUp">↑</button><button id="lsDn">↓</button><button id="lsL">←</button><button id="lsR">→</button>'
      + '<button id="lsAdd">加一點</button><button id="lsDel">刪這點</button>'
      + '<label>自己的線 C = <input id="lsC" size="3" value="' + (ls.man ? f2(ls.man[0]) : '') + '"></label><label>D = <input id="lsD" size="3" value="' + (ls.man ? f2(ls.man[1]) : '') + '"></label><button id="lsTry">比比看</button>');
    const mv = (dt, db) => { const p = ls.pts[ls.sel]; const nt = p[0] + dt, nb = p[1] + db; if (nt < 0 || nt > 6 || nb < -1 || nb > 7) { log('點要留在 t ∈ [0, 6]、b ∈ [−1, 7] 的範圍裡。', true); return; } ls.pts[ls.sel] = [nt, nb]; enterLS(); };
    on('lsPrev', () => { ls.sel = (ls.sel + ls.pts.length - 1) % ls.pts.length; enterLS(); });
    on('lsNext', () => { ls.sel = (ls.sel + 1) % ls.pts.length; enterLS(); });
    on('lsUp', () => mv(0, 0.5)); on('lsDn', () => mv(0, -0.5)); on('lsL', () => mv(-0.5, 0)); on('lsR', () => mv(0.5, 0));
    on('lsAdd', () => { if (ls.pts.length >= 7) { log('最多 7 個點。', true); return; } ls.pts.push([rnd(0, 6), rnd(0, 6)]); ls.sel = ls.pts.length - 1; log('加入點 (' + ls.pts[ls.sel].join(', ') + ')'); enterLS(); });
    on('lsDel', () => { if (ls.pts.length <= 2) { log('至少要留 2 個點才能決定直線。', true); return; } ls.pts.splice(ls.sel, 1); ls.sel = 0; enterLS(); });
    on('lsTry', () => {
      const c = Number($('lsC').value.replace(/−/g, '-')), d = Number($('lsD').value.replace(/−/g, '-'));
      if (!isFinite(c) || !isFinite(d) || $('lsC').value === '' || $('lsD').value === '') { log('C 和 D 都要填數字。', true); return; }
      ls.man = [c, d]; enterLS();
      if (fit) log('你的線 ‖e‖² = ' + f2(mse) + '；最佳線 ‖e‖² = ' + f2(sse) + (mse + 1e-9 < sse ? '（不可能！）' : Math.abs(mse - sse) < 1e-6 ? '：一樣好，你找到最佳解了。' : '：最小平方解一定最小。'));
    });
    if (!fit) log('所有點的 t 都一樣：A 的兩個 columns 相依，AᵀA 不可逆，直線不唯一。', true);
    setState('最小平方：b ≈ C + Dt', [
      ['點數 m', String(ls.pts.length)], ['選中的點', '(' + ls.pts[ls.sel].map(f2).join(', ') + ')'],
      ['最佳線', fit ? 'b = ' + f2(fit.C) + (fit.D < 0 ? ' − ' : ' + ') + f2(Math.abs(fit.D)) + 't' : '不唯一'],
      ['‖e‖²（最佳）', sse === null ? '—' : f2(sse)], ['‖e‖²（你的線）', mse === null ? '—' : f2(mse)]],
      fit ? 'AᵀA = ' + mtxt(fit.ata.map((r) => r.map((x) => Math.round(x * 100) / 100))) + '，Aᵀb = (' + f2(fit.atb[0]) + ', ' + f2(fit.atb[1]) + ')' : '<span class="no">AᵀA 奇異</span>');
  }

  // ───────────────────────── 模式 3：Gram-Schmidt 一步步 ─────────────────────────
  const gs = { vecs: [[1, 0, 0], [2, 0, 3], [4, 5, 6]], step: 0 };
  // steps: 0 show; 1 q1; 2 b − proj q1; 3 q2; 4 c − proj q1; 5 c − proj q2; 6 q3
  function gsCompute() {
    const [a, b, c] = gs.vecs, out = { q: [], R: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], cur: [a.slice(), b.slice(), c.slice()], bad: null };
    const st = gs.step;
    if (st >= 1) { const L = norm(a); if (L < 1e-9) { out.bad = 'a 是零向量'; return out; } out.R[0][0] = L; out.q[0] = mul(1 / L, a); out.cur[0] = out.q[0]; }
    if (st >= 2) { out.R[0][1] = dot(out.q[0], b); out.cur[1] = sub(b, mul(out.R[0][1], out.q[0])); }
    if (st >= 3) { const L = norm(out.cur[1]); if (L < 1e-9) { out.bad = 'b 和 a 共線，減完變零向量'; return out; } out.R[1][1] = L; out.q[1] = mul(1 / L, out.cur[1]); out.cur[1] = out.q[1]; }
    if (st >= 4) { out.R[0][2] = dot(out.q[0], c); out.cur[2] = sub(c, mul(out.R[0][2], out.q[0])); }
    if (st >= 5) { out.R[1][2] = dot(out.q[1], c); out.cur[2] = sub(out.cur[2], mul(out.R[1][2], out.q[1])); }
    if (st >= 6) { const L = norm(out.cur[2]); if (L < 1e-9) { out.bad = 'c 落在 a、b 的平面上，減完變零向量'; return out; } out.R[2][2] = L; out.q[2] = mul(1 / L, out.cur[2]); out.cur[2] = out.q[2]; }
    return out;
  }
  const GS_TXT = ['三個原始向量', 'q₁ = a / ‖a‖', 'b 減掉 (q₁·b) q₁', 'q₂ = 剩下的 / 長度', 'c 減掉 (q₁·c) q₁', 'c 再減掉 (q₂·c) q₂', 'q₃ = 剩下的 / 長度'];
  function enterGS() {
    fresh([5.4, 5.6, 9], [0.4, 2.6, 0]);
    const mx = Math.max(...gs.vecs.flat().map(Math.abs), 1);
    const sp = space3(Math.min(1.1, 2.6 / mx), V3(0, 2.2, 0), 2.7);
    const r = gsCompute();
    const cols = [C.a, C.b, C.c], nm = ['a', 'b', 'c'];
    gs.vecs.forEach((v, k) => arrow('#d8cfc0', 0.03).set(sp.O, sp.W(v)).label(nm[k], 'idx'));
    r.cur.forEach((v, k) => { const done = r.q[k] !== undefined; if (norm(v) > 1e-9) arrow(done ? C.q : cols[k], 0.06).set(sp.O, sp.W(v)).label(done ? 'q' + '₁₂₃'[k] : nm[k] + '′', done ? 'ptr' : 'ptr alt'); });
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (r.q[i] && r.q[j]) rightAngle(sp.O, sp.D(r.q[i]), sp.D(r.q[j]), 0.22);
    if (r.q[0] && r.q[1] && gs.step < 6) span2(sp, r.q[0], r.q[1], 2.2, C.q, 0.1);
    controls('<label>a = <input id="gsA" size="7" value="' + gs.vecs[0].join(', ') + '"></label><label>b = <input id="gsB" size="7" value="' + gs.vecs[1].join(', ') + '"></label><label>c = <input id="gsC" size="7" value="' + gs.vecs[2].join(', ') + '"></label>'
      + '<button id="gsSet">套用</button><button class="primary" id="gsNext">下一步</button><button id="gsReset">重來</button><button id="gs111">Strang 例子</button>');
    on('gsSet', () => {
      const parse = (id) => $(id).value.replace(/−/g, '-').split(/[ ,，]+/).filter(Boolean).map(Number);
      const v = ['gsA', 'gsB', 'gsC'].map(parse);
      if (v.some((u) => u.length !== 3 || u.some((x) => !isFinite(x) || Math.abs(x) > 9))) { log('每個向量要三個 −9 到 9 的數字，例如 1, 0, 2', true); return; }
      gs.vecs = v; gs.step = 0; clearLog(); log('新的向量：a = ' + vs(v[0]) + '，b = ' + vs(v[1]) + '，c = ' + vs(v[2])); enterGS();
    });
    on('gsNext', () => {
      if (r.bad) { log('卡住了：' + r.bad + '。Gram-Schmidt 需要線性獨立的向量。', true); return; }
      if (gs.step >= 6) { log('已經做完：Q 的三個 columns 都是單位向量、互相垂直。按「重來」再做一次。', true); return; }
      gs.step++; const r2 = gsCompute();
      if (r2.bad) { log('第 ' + gs.step + ' 步：' + r2.bad + ' → 向量相依，無法正規化。', true); gs.step--; return; }
      log('第 ' + gs.step + ' 步：' + GS_TXT[gs.step] + (gs.step === 2 ? '（q₁·b = ' + frac(r2.R[0][1]) + '）' : gs.step === 4 ? '（q₁·c = ' + frac(r2.R[0][2]) + '）' : gs.step === 5 ? '（q₂·c = ' + frac(r2.R[1][2]) + '）' : '（長度 ' + frac(r2.R[Math.floor((gs.step - 1) / 2)][Math.floor((gs.step - 1) / 2)]) + '）'));
      enterGS();
    });
    on('gsReset', () => { gs.step = 0; clearLog(); enterGS(); });
    on('gs111', () => { gs.vecs = [[1, 1, 1], [1, 0, 2], [1, 2, 0]]; gs.step = 0; clearLog(); log('Strang 的 a = (1,1,1)、b = (1,0,2)，再加一個 c = (1,2,0)。'); enterGS(); });
    const Rt = r.R.map((row) => '[ ' + row.map((x) => frac(x).padStart(5)).join(' ') + ' ]').join('<br>');
    setState('Gram-Schmidt：第 ' + gs.step + ' / 6 步', [['這一步', GS_TXT[gs.step]], ['q₁', r.q[0] ? vs(r.q[0]) : '—'], ['q₂', r.q[1] ? vs(r.q[1]) : '—'], ['q₃', r.q[2] ? vs(r.q[2]) : '—']],
      'R（逐步填入）：<br><span style="font-family:ui-monospace,monospace;white-space:pre">' + Rt + '</span>');
  }

  // ───────────────────────── 模式 4：正交矩陣保長度 ─────────────────────────
  const om = { M: [[1, 0], [0, 1]] };
  function enterOrth() {
    fresh([0, 3.2, 11], [0, 3.0, 0]);
    const S = 0.62, P = board2(0, 3.0, S, [-7, 7.5], [-3.6, 4.2]);
    circle2(P, 5, '#d8cfc0');
    const x0 = [3, 4], y0 = [-2, 1];
    const app = (M, u) => [M[0][0] * u[0] + M[0][1] * u[1], M[1][0] * u[0] + M[1][1] * u[1]];
    const ax = arrow(C.a, 0.06), ay = arrow(C.b, 0.05), sh = poly(FSHAPE.map((u) => W2(P, u)), C.q, true);
    const M = om.M, Mx = app(M, x0), My = app(M, y0);
    const MtM = [[M[0][0] * M[0][0] + M[1][0] * M[1][0], M[0][0] * M[0][1] + M[1][0] * M[1][1]], [0, M[0][1] * M[0][1] + M[1][1] * M[1][1]]]; MtM[1][0] = MtM[0][1];
    const isQ = Math.abs(MtM[0][0] - 1) < 1e-9 && Math.abs(MtM[1][1] - 1) < 1e-9 && Math.abs(MtM[0][1]) < 1e-9;
    ax.color(isQ ? C.a : C.e);
    const prev = om.prev || M;
    tween(600, (t) => {
      const L = prev.map((r, i) => r.map((v, j) => v + (M[i][j] - v) * t));
      ax.set(P(0, 0), W2(P, app(L, x0))); ay.set(P(0, 0), W2(P, app(L, y0)));
      sh.setPts(FSHAPE.map((u) => W2(P, add([-5.6, -2.6], app(L, u)))));
    }, () => { ax.label('Mx', 'ptr'); ay.label('My', 'ptr alt'); });
    om.prev = M;
    const ang = (u, v) => (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / norm(u) / norm(v)))) * 180) / Math.PI;
    const rot = (deg) => { const r = (deg * Math.PI) / 180; return [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]]; };
    const mm = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
    controls('<button id="omR">旋轉 +30°</button><button id="omL">旋轉 −30°</button><button id="omF">對 y = x 反射</button><button id="omS">剪切 [1 1; 0 1]</button><button id="omK">放大 ×1.2</button><button id="omZ">重設</button>');
    const apply = (T, name) => {
      const N = mm(T, om.M);
      if (Math.max(...N.flat().map(Math.abs)) > 3) { log('矩陣太大會跑出舞台，先按「重設」。', true); return; }
      om.M = N; log('乘上 ' + name); enterOrth();
    };
    on('omR', () => apply(rot(30), '旋轉 +30°')); on('omL', () => apply(rot(-30), '旋轉 −30°'));
    on('omF', () => apply([[0, 1], [1, 0]], '反射 [0 1; 1 0]')); on('omS', () => apply([[1, 1], [0, 1]], '剪切 [1 1; 0 1]（不是 orthogonal）'));
    on('omK', () => apply([[1.2, 0], [0, 1.2]], '1.2I（不是 orthogonal）'));
    on('omZ', () => { om.M = [[1, 0], [0, 1]]; om.prev = null; clearLog(); enterOrth(); });
    setState(isQ ? 'M 是 orthogonal matrix' : 'M 不是 orthogonal matrix', [
      ['M', '[' + M.map((r) => r.map(f2).join(' ')).join('; ') + ']'], ['MᵀM', '[' + MtM.map((r) => r.map(f2).join(' ')).join('; ') + ']'],
      ['‖x‖ → ‖Mx‖', '5 → ' + f2(norm(Mx))], ['x、y 夾角 → Mx、My 夾角', f2(ang(x0, y0)) + '° → ' + f2(ang(Mx, My)) + '°'], ['det M', f2(M[0][0] * M[1][1] - M[0][1] * M[1][0])]],
      isQ ? '<span class="ok">MᵀM = I</span>：長度、夾角都保持（‖Qx‖² = xᵀQᵀQx = xᵀx）' : '<span class="no">MᵀM ≠ I</span>：長度或夾角會變');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const opt4 = (ans, wrongs) => { const o = [ans]; for (const w of wrongs) if (!o.includes(w) && o.length < 4) o.push(w); let k = 1; while (o.length < 4) { const f = ans + ' '.repeat(k++); o.push(f); } return o; };
  function genQ() {
    const kind = rnd(0, 5);
    if (kind === 0) {
      let a, b; do { a = [rnd(-2, 3), rnd(-2, 3)]; b = [rnd(-3, 4), rnd(-3, 4)]; } while (dot(a, a) === 0 || dot(a, b) === 0 || dot(b, b) === 0);
      const p = mul(dot(a, b) / dot(a, a), a);
      return { q: '把 b = ' + vs(b) + ' 投影到 a = ' + vs(a) + ' 的直線上，p = ？', opts: opt4(vs(p), [vs(mul(dot(a, b) / dot(b, b), b)), vs(mul(dot(a, b), a)), vs(sub(b, p))]), ans: vs(p), why: 'p = (aᵀb / aᵀa) a = (' + dot(a, b) + '/' + dot(a, a) + ') a。注意除的是 aᵀa，不是 bᵀb；b − p 是誤差 e。' };
    }
    if (kind === 1) {
      let a, b; do { a = [rnd(-1, 2), rnd(-1, 2), rnd(0, 2)]; b = [rnd(-2, 3), rnd(-2, 3), rnd(-2, 3)]; } while (dot(a, a) === 0 || Math.abs(dot(a, b)) < 1 || norm(cross(a, b)) < 1e-9);
      const B = sub(b, mul(dot(a, b) / dot(a, a), a));
      return { q: 'Gram-Schmidt：A = a = ' + vs(a) + '，b = ' + vs(b) + '。正交化後（還沒除長度）的 B = ？', opts: opt4(vs(B), [vs(sub(b, mul(dot(a, b), a))), vs(add(b, mul(dot(a, b) / dot(a, a), a))), vs(mul(dot(a, b) / dot(a, a), a))]), ans: vs(B), why: 'B = b − (Aᵀb/AᵀA)A，Aᵀb = ' + dot(a, b) + '、AᵀA = ' + dot(a, a) + '。檢查 AᵀB = 0。' };
    }
    if (kind === 2) {
      const good = pick(['[0 1; 1 0]', '(1/√2)[1 1; 1 −1]', '(1/5)[3 −4; 4 3]', '(1/3)[1 −2 2; 2 −1 −2; 2 2 1]', '[0 0 1; 1 0 0; 0 1 0]']);
      const bad = shuffle(['[1 1; 1 −1]', '[1 1; 0 1]', '(1/5)[3 4; 4 3]', '(1/2)[1 1; 1 1]', '[2 0; 0 1/2]']).slice(0, 3);
      return { q: '哪一個是 orthogonal matrix（QᵀQ = I）？', opts: [good, ...bad], ans: good, why: 'columns 要互相垂直且長度為 1。[1 1; 1 −1] 長度 √2；(1/5)[3 4; 4 3] 兩行內積 24/25 ≠ 0；剪切與縮放都改變長度。' };
    }
    if (kind === 3) {
      const b = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
      const f = lsq([[0, b[0]], [1, b[1]], [2, b[2]]]);
      const ans = 'C = ' + frac(f.C) + '，D = ' + frac(f.D);
      return { q: '用 b = C + Dt 擬合 (0, ' + b[0] + ')、(1, ' + b[1] + ')、(2, ' + b[2] + ') 的最小平方解：', opts: opt4(ans, ['C = ' + frac(b[0]) + '，D = ' + frac((b[2] - b[0]) / 2), 'C = ' + frac((b[0] + b[1] + b[2]) / 3) + '，D = 0', 'C = ' + frac(f.C + 1) + '，D = ' + frac(f.D)]), ans, why: 'AᵀA = [3 3; 3 5]，Aᵀb = (' + (b[0] + b[1] + b[2]) + ', ' + (b[1] + 2 * b[2]) + ')，解 normal equation。只過頭尾兩點的直線不是最小平方解。' };
    }
    if (kind === 4) {
      const a = pick([[1, 2, 2], [2, 1, 2], [1, 1, 1], [3, 0, 4]]);
      const st = pick([['P² = P', true], ['Pᵀ = P', true], ['P 的 rank = 1', true], ['P 可逆', false], ['P = I', false], ['P² = 0', false]]);
      const wrong = shuffle([['P 可逆', false], ['P = I', false], ['P² = 0', false], ['P 的 trace = 0', false], ['Pᵀ = −P', false]]).filter((x) => x[0] !== st[0]).slice(0, 3);
      const right = st[1] ? st[0] : 'P² = P';
      return { q: 'P = aaᵀ / aᵀa，a = ' + vs(a) + '。下列何者正確？', opts: [right, ...wrong.map((x) => x[0])], ans: right, why: '投影到直線：P 對稱、P² = P、rank 1、trace 1；它把整個空間壓到一條線，所以不可逆。' };
    }
    const a1 = pick([[3, 4], [4, 3], [0, 5], [5, 0], [6, 8]]), a2 = [rnd(-3, 4), rnd(-3, 4)];
    const q1 = unit(a1), r12 = dot(q1, a2), r11 = norm(a1), rest = sub(a2, mul(r12, q1)), r22 = norm(rest);
    if (r22 < 1e-9) return genQ();
    const ans = 'R = [' + frac(r11) + ' ' + frac(r12) + '; 0 ' + frac(r22) + ']';
    return { q: 'A 的 columns a₁ = ' + vs(a1) + '、a₂ = ' + vs(a2) + '，A = QR 的 R = ？', opts: opt4(ans, ['R = [' + frac(r11) + ' 0; ' + frac(r12) + ' ' + frac(r22) + ']', 'R = [1 ' + frac(r12) + '; 0 1]', 'R = [' + frac(r11) + ' ' + frac(dot(a1, a2)) + '; 0 ' + frac(r22) + ']']), ans, why: 'r₁₁ = ‖a₁‖、r₁₂ = q₁ᵀa₂、r₂₂ = a₂ 減掉 q₁ 分量後的長度；左下 q₂ᵀa₁ = 0，所以是上三角。' };
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
    'dot-projection': { title: '內積 = 投影長 × 長度（課本）', play: scDotProj },
    'orth-subspaces': { title: '正交向量與正交子空間：row space ⟂ N(A)（課本）', play: scOrthSub },
    'proj-line': { title: '投影到直線：p = (aᵀb/aᵀa)a，e ⟂ a（課本）', play: scProjLine },
    'proj-matrix': { title: '投影矩陣 P：Pᵀ = P、P² = P（課本）', play: scProjMatrix },
    'proj-plane': { title: '投影到平面：AᵀAx̂ = Aᵀb（課本）', play: scProjPlane },
    'least-squares': { title: '最小平方擬合直線：誤差看得見（課本）', play: scLeastSq },
    'orthonormal-def': { title: 'Orthonormal 向量 q₁、q₂、q₃', play: scOrthonormal },
    'qtq-identity': { title: 'QᵀQ = I，但長方形 QQᵀ ≠ I', play: scQtQ },
    'q-examples': { title: 'Orthogonal matrix 的例子：permutation、旋轉、Hadamard', play: scQExamples },
    'q-preserve-length': { title: '正交矩陣保持長度與夾角（課本）', play: scPreserve },
    'proj-qqt': { title: '投影到 C(Q)：P = QQᵀ', play: scProjQQt },
    'xhat-dot': { title: 'Orthonormal basis：x̂ᵢ = qᵢᵀb', play: scXhatDot },
    'gs-two': { title: 'Gram-Schmidt：B = b − (Aᵀb/AᵀA)A', play: scGSTwo },
    'gs-three': { title: 'Gram-Schmidt：第三個向量 C', play: scGSThree },
    'gs-example-111': { title: 'Gram-Schmidt 例子：(1,1,1)、(1,0,2)', play: scGS111 },
    'qr-factor': { title: 'A = QR：R 是上三角', play: scQR },
    'gs-rita': { title: '習題：a、b、c → q₁、q₂、q₃', play: scGSRita },
    'qr-rita': { title: '習題：A = QR 與 R 的係數', play: scQRRita },
  };

  return {
    kicker: '線性代數・第 7 章',
    title: '正交性：投影、最小平方、Gram-Schmidt',
    color: 'var(--la)',
    modes: [
      { id: 'proj', name: '投影', enter: enterProj },
      { id: 'ls', name: '最小平方', enter: enterLS },
      { id: 'gs', name: 'Gram-Schmidt', enter: () => { clearLog(); enterGS(); } },
      { id: 'orth', name: '正交矩陣', enter: () => { om.prev = null; enterOrth(); } },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'dot-projection', 'orth-subspaces', 'proj-line', 'proj-matrix', 'proj-plane', 'least-squares',
      'orthonormal-def', 'qtq-identity', 'q-examples', 'q-preserve-length', 'proj-qqt', 'xhat-dot',
      'gs-two', 'gs-three', 'gs-example-111', 'qr-factor', 'gs-rita', 'qr-rita',
    ],
    stop() { gen++; },
  };
}
