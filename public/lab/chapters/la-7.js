// 線性代數 第7章：正交性（正交子空間、投影、最小平方、Gram-Schmidt、A = QR、正交矩陣）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 場景依 MIT 18.06 L17（0MtwqhIwdrI）與 Gram-Schmidt 習題課（HEQuN0QELSQ）的例子；
// L14–L16 與 3Blue1Brown Ch9 沒有逐字稿，相關場景以 Strang 例題建立（標題標「課本」）。
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
  const opt4 = (ans, wrongs) => { const o = [ans]; for (const w of wrongs) if (!o.includes(w) && o.length < 4) o.push(w); return o; };   // 重複的錯誤選項直接略過（不要補「看起來一樣」的選項）
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
      if (2 * b[1] === b[0] + b[2]) return genQ();   // 三點共線時「過頭尾的線」就是最小平方解，換一題
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ or.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 7 章：正交性 — cued scenes（or）───
// MIT 18.06 L14 / L15 / L16 / L17（Strang）、Gram-Schmidt 習題課、3Blue1Brown Ch9。
// 所有投影、P、x̂、Q、R、最佳直線都在程式裡算，畫面上用 ✓／✘ 顯示檢查結果；
// 老師沒給數字、自己補的例子在畫面上標「示意」。
// 註：kit 的 arrow 會蓋掉模組的 arrow，所以 3D 向量箭頭用下面的 vec()（同一份做法）。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (b, x, y, t, z = 0) => { if (!b && ctx.params && ctx.params.debug !== false && typeof process !== 'undefined') log('check failed: ' + t, true); return b ? tag(t, 'good', x, y, z) : tag(t.replace(/✓/g, '✘'), 'bad', x, y, z); };
const sy = (x, y, z = 0, t = '示意') => tag(t, 'note', x, y, z);
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const mono = (l) => { l.element.style.whiteSpace = 'pre'; l.element.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace'; return l; };
const gone = (...os) => os.forEach((o) => {
  if (!o) return; if (Array.isArray(o)) return gone(...o);
  if (o.g && typeof o.kill === 'function') return o.kill();
  if (o.ls && typeof o.kill === 'function') return o.kill();
  if (o.element) return remove(o);
  kill(o);
});
const Z = (x) => Math.abs(x) < 1e-9;
const isZ = (v) => v.every(Z);
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const isI = (M) => M.every((r, i) => r.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < 1e-9));
const sameM = (A, B) => A.length === B.length && A.every((r, i) => same(r, B[i]));
const mv = (A, x) => A.map((r) => dot(r, x));
const inv2 = (M) => { const d = M[0][0] * M[1][1] - M[0][1] * M[1][0]; return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; };
const projM = (A) => { const At = tr(A); return mm(mm(A, inv2(mm(At, A))), At); }; // A 有兩欄
const ms = (M) => '[' + M.map((r) => r.map(frac).join(' ')).join('; ') + ']';
const vv = (u) => vs(u);
// 3D 向量箭頭（同模組 arrow 的做法）
function vec(color, r = 0.05) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
  const g = new THREE.Group(); g.add(shaft); g.add(head); lab.world.add(g);
  const A = { g, mat, from: V3(0, 0, 0), to: V3(0, 0, 0), lbl: null };
  A.set = (f, t) => {
    A.from.copy(f); A.to.copy(t);
    const d = t.clone().sub(f), L = d.length();
    if (L < 1e-4) { g.visible = false; if (A.lbl) A.lbl.visible = false; return A; }
    g.visible = true;
    const n = d.clone().divideScalar(L), hl = Math.min(0.28, L * 0.4);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n);
    shaft.quaternion.copy(q); head.quaternion.copy(q);
    shaft.scale.set(1, Math.max(1e-3, L - hl), 1); shaft.position.copy(f).addScaledVector(n, (L - hl) / 2);
    head.scale.set(1, hl, 1); head.position.copy(f).addScaledVector(n, L - hl / 2);
    if (A.lbl) { A.lbl.visible = true; A.lbl.position.copy(t).addScaledVector(n, 0.3); }
    return A;
  };
  A.label = (text, cls) => { if (!A.lbl) { A.lbl = lab.label(text, cls || ''); lab.world.add(A.lbl); } else { A.lbl.element.textContent = text; if (cls !== undefined) setCls(A.lbl, cls); } A.set(A.from, A.to); return A; };
  A.glow = (c) => { mat.emissive = new THREE.Color(c || '#000000'); return A; };
  A.color = (c) => { mat.color.set(c); return A; };
  A.kill = () => { lab.world.remove(g); if (A.lbl) { lab.world.remove(A.lbl); A.lbl.element.remove(); } };
  return A;
}
async function growV(tok, A, f, t, ms = 700) { await anim(tok, ms, (k) => A.set(f, f.clone().lerp(t, k))); }
// a vector in a space (math coords): from → from + u
const av = (sp, u, color, name, cls = 'ptr', from = [0, 0, 0], r = 0.05) => { const A = vec(color, r).set(sp.W(from), sp.W(add(from, u))); if (name) A.label(name, cls); return A; };
async function gv(tok, sp, u, color, name, cls = 'ptr', from = [0, 0, 0], r = 0.05, msx = 700) { const A = vec(color, r); await growV(tok, A, sp.W(from), sp.W(add(from, u)), msx); if (name) A.label(name, cls); return A; }
const flash = async (tok, A, n = 2) => { for (let i = 0; i < n; i++) { A.glow('#6a4a00'); await wt(tok, 220); A.glow(null); await wt(tok, 160); } };
// a scene = list of step functions; each runs when the video reaches its cue
function scene(id, title, cam, setup, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(...cam);
    const S = {};
    if (setup) await setup(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM3 = [[5.4, 5.6, 9.4], [0.3, 2.8, 0]];
const CAMB = [[0, 3.3, 12.5], [0, 3.1, 0]];
const sub3 = (n) => '₀₁₂₃₄₅₆₇₈₉'[n];

// ════════ L17（0MtwqhIwdrI／uNsCkP9mgRk 同一堂課）：Orthogonal matrices 與 Gram-Schmidt ════════
const QC = QR3;                                   // Strang 的 (1,2,2)/3、(−2,−1,2)/3、(2,−2,1)/3
const QM3 = tr(QC);                               // 3×3：columns = q₁ q₂ q₃
const QM2 = tr([QC[0], QC[1]]);                   // 3×2

scene('or-l17-qdef', 'L17：orthonormal 向量 q₁…qₙ', CAM3, async (tok, S) => {
  S.sp = space3(1.6, V3(0, 2.3, 0), 2.2);
}, [
  async (tok, S) => {
    cap('上一章遇過：正交（垂直）的兩個向量', '夾角 90°，內積 = 0');
    const x = [1.1, 0.3, 0], y = [-0.3, 1.1, 0];
    S.x = await gv(tok, S.sp, x, C.a, 'x'); S.y = await gv(tok, S.sp, y, C.b, 'y', 'ptr alt');
    S.ra = rightAngle(S.sp.O, S.sp.D(x), S.sp.D(y), 0.25);
    S.k = ok(Z(dot(x, y)), -4.4, 6.0, 'xᵀy = 0 ✓'); S.n = sy(-4.4, 5.4);
  },
  async (tok, S) => {
    gone(S.x, S.y, S.ra, S.k);
    cap('也遇過正交的子空間', '例如 row space ⟂ null space');
    S.ln = rod(C.a, 0.03).set(S.sp.W([0, 0, -1.2]), S.sp.W([0, 0, 1.3]));
    S.ll = hd('一條線', S.sp.W([0, 0, 1.4]).x + 0.6, S.sp.W([0, 0, 1.4]).y);
    S.pq = quad(S.sp.O, S.sp.D([1.3, 0, 0]), S.sp.D([0, 1.3, 0]), C.b, 0.2);
    S.pl = hot('一個平面', S.sp.W([1.3, -1.3, 0]).x, S.sp.W([1.3, -1.3, 0]).y);
    S.ra = rightAngle(S.sp.O, S.sp.D([0, 0, 1]), S.sp.D([1, 0, 0]), 0.25);
  },
  async (tok, S) => {
    gone(S.ln, S.ll, S.pq, S.pl, S.ra, S.n);
    cap('今天：orthogonal basis 與 orthogonal matrix', '三個互相垂直的 q（Strang 稍後的例子）');
    S.q = [];
    for (let k = 0; k < 3; k++) S.q.push(await gv(tok, S.sp, QC[k], C.q, 'q' + sub3(k + 1), 'ptr', [0, 0, 0], 0.06, 500));
  },
  async (tok, S) => {
    cap('更精確的字：orthonormal', 'ortho（垂直）＋ normal（長度 1）');
    S.w = hd('orthonormal = ortho + normal', -3.6, 6.3);
  },
  async (tok, S) => {
    cap('每個 q 都和其他 q 垂直', 'qᵢᵀqⱼ = 0（i ≠ j）');
    S.ras = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => rightAngle(S.sp.O, S.sp.D(QC[i]), S.sp.D(QC[j]), 0.24));
    let mx = 0; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) mx = Math.max(mx, Math.abs(dot(QC[i], QC[j])));
    S.k1 = ok(mx < 1e-9, -4.4, 5.6, 'q₁ᵀq₂ = q₁ᵀq₃ = q₂ᵀq₃ = 0 ✓');
    for (const A of S.q) await flash(tok, A, 1);
  },
  async (tok, S) => {
    cap('自己和自己：qᵢᵀqᵢ = 1', '長度平方 = 1 → unit vector');
    S.gs = ghostSphere(S.sp.O, 1.6);
    S.k2 = ok(QC.every((q) => Math.abs(dot(q, q) - 1) < 1e-9), -4.4, 5.0, 'qᵢᵀqᵢ = 1 ✓（尖端都在單位球上）');
  },
  async (tok, S) => {
    cap('ortho：互相垂直；normal：長度 1', '兩個條件合起來 = orthonormal');
  },
  async (tok, S) => {
    cap('數值線性代數最愛 orthonormal 向量', '長度永遠是 1：不會 overflow / underflow');
    for (const A of S.q) await flash(tok, A, 1);
  },
  async (tok, S) => {
    cap('把它們放進矩陣 Q 的 columns', 'Q = [q₁ q₂ q₃]');
    S.qm = mtag(QM3.map((r) => r.map((x) => x * 3)), 3.4, 6.0, 0, 'ptr'); S.qt = sm('Q = 1/3 ×', 1.6, 6.0);
  },
  async (tok, S) => {
    cap('後半堂：A 的 columns 不 orthonormal 怎麼辦？', 'Gram-Schmidt 把它們變成 orthonormal');
    gone(S.k1, S.k2, S.w);
    S.a = await gv(tok, S.sp, [1.2, 0.2, 0.1], '#9c8d70', 'a（示意）', 'idx', [0, 0, 0], 0.035, 500);
    S.b = await gv(tok, S.sp, [0.9, 0.9, 0.2], '#9c8d70', 'b（示意）', 'idx', [0, 0, 0], 0.035, 500);
  },
]);

scene('or-l17-qtq', 'L17：QᵀQ = I（Q 不必是方陣）', [[0.6, 4.4, 12.6], [0.6, 3.0, 0]], async (tok, S) => {
  S.sp = space3(1.5, V3(-3.4, 2.4, 0), 1.9);
  S.q = QC.map((u, k) => av(S.sp, u, C.q, 'q' + sub3(k + 1), 'ptr', [0, 0, 0], 0.06));
  S.cell = {};
}, [
  async (tok, S) => {
    cap('把 q₁ … qₙ 放進 Q 的 columns', 'Strang 用字母 Q 代表「columns orthonormal」');
    S.Q = mono(hd('Q  = [ q₁  q₂  q₃ ]', 2.6, 6.6));
  },
  async (tok, S) => {
    cap('這一章一直在看 AᵀA，現在看 QᵀQ', '');
    S.QT = mono(hot('Qᵀ = [ q₁ᵀ ; q₂ᵀ ; q₃ᵀ ]', 2.6, 6.0));
  },
  async (tok, S) => {
    cap('Qᵀ 的 rows 就是 q₁ᵀ、q₂ᵀ、q₃ᵀ', '列 × 行 = 內積 qᵢᵀqⱼ');
    S.rows = [0, 1, 2].map((i) => sm('q' + sub3(i + 1) + 'ᵀ', 0.6, 4.9 - i * 1.05));
    S.cols = [0, 1, 2].map((j) => sm('q' + sub3(j + 1), 1.8 + j * 1.05, 5.55));
  },
  ...[[0, 0], [0, 1], [0, 2]].map(([i, j]) => async (tok, S) => {
    const v = dot(QC[i], QC[j]);
    cap('第 ' + (i + 1) + ' 列 × 第 ' + (j + 1) + ' 行 = ' + frac(v), i === j ? '自己和自己：長度² = 1' : '兩個不同的 q：垂直 → 0');
    S.q[i].glow('#6a4a00'); S.q[j].glow('#0f5a3a');
    S.cell[i + ',' + j] = cube(frac(v), Z(v) ? '#d8cfc0' : C.p, [0.9, 0.9, 0.4], 1.8 + j * 1.05, 4.9 - i * 1.05, 0, 1.6);
    await wt(tok, 700); S.q[i].glow(null); S.q[j].glow(null);
  }),
  async (tok, S) => {
    cap('對角線全是 1，其他全是 0', 'QᵀQ = I');
    const G = mm(tr(QM3), QM3);
    for (let i = 1; i < 3; i++) for (let j = 0; j < 3; j++) S.cell[i + ',' + j] = cube(frac(G[i][j]), Z(G[i][j]) ? '#d8cfc0' : C.p, [0.9, 0.9, 0.4], 1.8 + j * 1.05, 4.9 - i * 1.05, 0, 1.2);
    await wt(tok, 600);
    S.k = ok(isI(G), 2.9, 1.3, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    cap('Q 不必是方陣：只留兩個 columns', 'Q 是 3×2，QᵀQ 是 2×2');
    gone(S.q[2], S.cols[2], S.rows[2], S.k, S.QT); txt(S.Q, 'Q  = [ q₁  q₂ ]  （3×2）');
    for (const key of ['0,2', '1,2', '2,0', '2,1', '2,2']) gone(S.cell[key]);
    const G = mm(tr(QM2), QM2);
    S.k = ok(isI(G) && G.length === 2, 2.4, 1.9, 'QᵀQ = I（2×2）✓');
  },
  async (tok, S) => {
    cap('QᵀQ 和 AᵀA 一樣：列出所有內積', 'orthonormal 時得到最好的答案：I');
    for (const key of ['0,0', '1,1']) glow(S.cell[key], '#0f5a3a');
  },
]);

scene('or-l17-name', 'L17：新的一類矩陣與「orthogonal matrix」這個名字', CAMB, null, [
  async (tok, S) => {
    cap('以前見過：三角、對角、permutation 矩陣', '前幾章的老朋友');
    S.a = [mtag([[1, 2, 3], [0, 4, 5], [0, 0, 6]], -5.0, 6.0), mtag([[2, 0, 0], [0, 3, 0], [0, 0, 5]], -1.8, 6.0), mtag([[0, 1, 0], [0, 0, 1], [1, 0, 0]], 1.4, 6.0)];
    S.an = [sm('三角', -5.0, 7.0), sm('對角', -1.8, 7.0), sm('permutation', 1.4, 7.0)]; S.n0 = sy(4.4, 7.0);
  },
  async (tok, S) => {
    cap('還有 row echelon form、投影矩陣', '投影：P = aaᵀ/aᵀa，a = (1, 2, 2)');
    S.b = [mtag([[1, 2, 0, 3], [0, 0, 1, 4]], -4.2, 3.6), mtag([[1, 2, 2], [2, 4, 4], [2, 4, 4]], 1.2, 3.6)];
    S.bn = [sm('row echelon', -4.2, 4.6), sm('投影 P = 1/9 ×', 1.2, 4.6)];
  },
  async (tok, S) => {
    cap('新的一類：columns orthonormal 的矩陣 Q', '');
    S.c = mtag(QM3.map((r) => r.map((x) => x * 3)), -0.8, 1.2, 0, 'ptr alt'); S.cn = hot('Q = 1/3 ×', -2.8, 1.2);
    S.ck = ok(isI(mm(tr(QM3), QM3)), 2.6, 1.2, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    cap('最貼切的名字應該是 orthonormal matrix', 'Strang：可惜大家不這樣叫');
    S.nm = bub('orthonormal matrix？', -1.0, 0.1);
  },
  async (tok, S) => {
    cap('慣例：只有「方陣」才叫 orthogonal matrix', '長方形就說「columns orthonormal」');
    txt(S.nm, '方陣 → orthogonal matrix');
  },
  async (tok, S) => {
    cap('方陣才有反矩陣', '');
    S.inv = hd('Q 是方陣 ⇒ Q⁻¹ 存在', 3.6, 0.1);
  },
  async (tok, S) => {
    const ok1 = isI(mm(tr(QM3), QM3)) && isI(mm(QM3, tr(QM3)));
    cap('QᵀQ = I ⇒ Qᵀ = Q⁻¹', '好記：轉置就是反矩陣');
    S.k = ok(ok1, 3.6, -0.6, 'QᵀQ = QQᵀ = I ⇒ Qᵀ = Q⁻¹ ✓');
  },
]);

scene('or-l17-examples', 'L17：orthogonal matrix 的例子', [[0, 3.6, 12], [0, 3.0, 0]], async (tok, S) => {
  S.sp = space3(1.5, V3(-3.0, 2.2, 0), 2.0);
}, [
  async (tok, S) => {
    cap('例 1：permutation matrix', 'Q = [0 0 1; 1 0 0; 0 1 0]');
    S.PM = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
    S.m = mtag(S.PM, 2.6, 5.6, 0, 'ptr'); S.mn = sm('Q =', 1.0, 5.6);
    S.c = tr(S.PM).map((u, k) => av(S.sp, u, [C.a, C.b, C.p][k], '第 ' + (k + 1) + ' 行', 'idx', [0, 0, 0], 0.06));
  },
  async (tok, S) => {
    const G = mm(tr(S.PM), S.PM);
    cap('每個 column 是單位向量，而且互相垂直', '');
    S.ras = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => rightAngle(S.sp.O, S.sp.D(tr(S.PM)[i]), S.sp.D(tr(S.PM)[j]), 0.24));
    S.k1 = ok(isI(G), 2.6, 3.8, 'columns orthonormal ✓');
  },
  async (tok, S) => {
    cap('它的 transpose 也是 permutation', 'QᵀQ = I');
    S.t = mtag(tr(S.PM), 2.6, 2.4, 0, 'ptr alt'); S.tn = sm('Qᵀ =', 1.0, 2.4);
    S.k2 = ok(isI(mm(tr(S.PM), S.PM)), 2.6, 1.2, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    fresh([0, 3.2, 10.5], [0, 3.0, 0]);
    S.P = board2(-1.6, 2.9, 1.6, [-1.5, 1.6], [-1.5, 1.5]); circle2(S.P, 1);
    S.th = 30;
    S.c1 = vec(C.a, 0.06); S.c2 = vec(C.b, 0.06);
    S.rot = (deg, both) => { const r = (deg * Math.PI) / 180; S.c1.set(S.P(0, 0), S.P(Math.cos(r), Math.sin(r))); if (both) S.c2.set(S.P(0, 0), S.P(-Math.sin(r), Math.cos(r))); };
    S.rot(30, false); S.c2.g.visible = false; S.c1.label('(cos θ, sin θ)', 'ptr');
    cap('例 2：(cos θ, sin θ) 是單位向量', 'cos²θ + sin²θ = 1');
    S.m = mono(hd('Q = [ cos θ  −sin θ ]\n    [ sin θ   cos θ ]', 3.6, 5.6));
  },
  async (tok, S) => {
    cap('第二行 (−sin θ, cos θ)：內積 = 0', '−cos θ sin θ + sin θ cos θ = 0');
    S.rot(30, true); S.c2.label('(−sin θ, cos θ)', 'ptr alt');
    S.rk = sm('', 3.6, 3.8);
    await anim(tok, 1800, (t) => { const d = 30 + 90 * t, r = (d * Math.PI) / 180; S.rot(d, true); txt(S.rk, 'θ = ' + Math.round(d) + '°：內積 = ' + f2(-Math.cos(r) * Math.sin(r) + Math.sin(r) * Math.cos(r))); });
    S.k = ok(Z(dot([Math.cos(2.1), Math.sin(2.1)], [-Math.sin(2.1), Math.cos(2.1)])), 3.6, 3.1, '任何 θ 都垂直 ✓');
  },
  async (tok, S) => {
    gone(S.k, S.rk);
    S.rot(0, true); S.c1.set(S.P(0, 0), S.P(1, 1)); S.c2.set(S.P(0, 0), S.P(1, -1)); S.c1.label('(1, 1)', 'ptr'); S.c2.label('(1, −1)', 'ptr alt');
    txt(S.m, 'Q = [ 1   1 ]\n    [ 1  −1 ]');
    cap('Q = [1 1; 1 −1]：columns 垂直，但不是單位長', '');
    S.k = ok(Z(dot([1, 1], [1, -1])), 3.6, 3.8, '(1,1)·(1,−1) = 0 ✓'); S.k2 = tag('長度 = √2 ≠ 1 ✘', 'bad', 3.6, 3.1);
  },
  async (tok, S) => {
    cap('長度² = 1 + 1 = 2 → 除以 √2', '這樣才是 orthogonal matrix');
    await anim(tok, 1200, (t) => { const k = 1 + (Math.SQRT1_2 - 1) * t; S.c1.set(S.P(0, 0), S.P(k, k)); S.c2.set(S.P(0, 0), S.P(k, -k)); });
    S.c1.label('(1, 1)/√2', 'ptr'); S.c2.label('(1, −1)/√2', 'ptr alt'); txt(S.m, 'Q = 1/√2 [ 1   1 ]\n         [ 1  −1 ]');
    gone(S.k2); const q = [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]];
    S.k2 = ok(isI(mm(tr(q), q)), 3.6, 3.1, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    const d = -0.5 - 0.5;
    cap('Strang：差不多是 θ = π/4 的旋轉（負號位置不同）', '補充：det = ' + frac(d) + '，其實是「反射」');
    S.nt = tag('補充：det = −1 → 反射', 'note', 3.6, 2.4);
  },
  async (tok, S) => {
    fresh([0, 6.6, 8.6], [0, 0.6, 0]);
    S.H = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
    S.cells = S.H.map((r, i) => r.map((v, j) => cube(v > 0 ? '+1' : '−1', v > 0 ? C.a : C.b, [1, 0.3, 1], -1.65 + j * 1.1, 0.15, -1.65 + i * 1.1)));
    hd('[1 1; 1 −1] 重複，右下取負號', 0, 0.3, 3.0);
    cap('例 3：把 2×2 的 pattern 長成 4×4', '全是 ±1');
  },
  async (tok, S) => {
    cap('任兩個 column 的內積：兩正兩負 → 0', '');
    let allZ = true;
    for (const [j, k] of [[0, 1], [1, 3], [2, 3]]) {
      for (let i = 0; i < 4; i++) { S.cells[i][j].position.y = 0.45; S.cells[i][k].position.y = 0.45; }
      await wt(tok, 500);
      for (let i = 0; i < 4; i++) { S.cells[i][j].position.y = 0.15; S.cells[i][k].position.y = 0.15; }
    }
    for (let j = 0; j < 4; j++) for (let k = j + 1; k < 4; k++) if (!Z(S.H.reduce((s, r) => s + r[j] * r[k], 0))) allZ = false;
    S.k = ok(allZ, 0, 0.3, '6 對 columns 內積全是 0 ✓', -3.2);
  },
  async (tok, S) => {
    const G = mm(tr(S.H), S.H);
    cap('每個 column 長度 √4 = 2 → 除以 2', 'HᵀH = 4I');
    S.k2 = ok(G.every((r, i) => r.every((x, j) => Math.abs(x - (i === j ? 4 : 0)) < 1e-9)), 0, 0.3, 'HᵀH = 4I ⇒ (H/2)ᵀ(H/2) = I ✓', 3.9);
  },
  async (tok, S) => {
    cap('Hadamard matrix：2、4、16、64… 都做得出來', '哪些大小存在 ±1 的 orthogonal matrix：未解問題');
    bub('Hadamard', 3.4, 1.4, 0);
  },
]);

scene('or-l17-rect', 'L17：長方形的例子 (1/3)[1 −2; 2 −1; 2 2]', CAM3, async (tok, S) => {
  S.sp = space3(0.62, V3(0, 2.4, 0), 2.4);
}, [
  async (tok, S) => {
    cap('長方形的例子：columns (1, 2, 2)、(−2, −1, 2)', '');
    S.a = await gv(tok, S.sp, [1, 2, 2], C.q, '(1, 2, 2)'); S.b = await gv(tok, S.sp, [-2, -1, 2], C.q, '(−2, −1, 2)');
    S.ra = rightAngle(S.sp.O, S.sp.D([1, 2, 2]), S.sp.D([-2, -1, 2]), 0.25);
    S.k0 = ok(Z(dot([1, 2, 2], [-2, -1, 2])), -4.4, 6.2, '內積 = −2 − 2 + 4 = 0 ✓');
  },
  async (tok, S) => {
    cap('還沒正規化：長度² = 1 + 4 + 4 = 9', '除以 √9 = 3');
    S.gs = ghostSphere(S.sp.O, 0.62);
    await anim(tok, 1200, (t) => { const k = 1 - (2 / 3) * t; S.a.set(S.sp.O, S.sp.W(mul(k, [1, 2, 2]))); S.b.set(S.sp.O, S.sp.W(mul(k, [-2, -1, 2]))); });
    S.a.label('q₁ = (1, 2, 2)/3'); S.b.label('q₂ = (−2, −1, 2)/3');
    S.k1 = ok(Math.abs(norm(QC[0]) - 1) < 1e-9 && Math.abs(norm(QC[1]) - 1) < 1e-9, -4.4, 5.6, '‖q₁‖ = ‖q₂‖ = 1 ✓');
  },
  async (tok, S) => {
    cap('兩個 orthonormal columns：平面的 orthonormal basis', 'column space 是二維平面');
    S.pl = span2(S.sp, QC[0], QC[1], 1.9, C.q, 0.15);
    S.m = mtag([[1, -2], [2, -1], [2, 2]], 3.6, 6.0, 0, 'ptr'); S.mn = sm('Q = 1/3 ×', 2.0, 6.0);
  },
  async (tok, S) => {
    cap('orthonormal 向量一定線性獨立', '互成 90°：沒有組合會等於 0');
  },
  async (tok, S) => {
    cap('想要第三個 column：用同樣的 1、2、2 試試看', '調整正負號 → (2, −2, 1)');
    S.c = await gv(tok, S.sp, mul(3, QC[2]), C.c, '(2, −2, 1)', 'ptr alt');
  },
  async (tok, S) => {
    await anim(tok, 900, (t) => S.c.set(S.sp.O, S.sp.W(mul(3 - 2 * t, QC[2]))));
    S.c.label('q₃ = (2, −2, 1)/3');
    gone(S.m); S.m = mtag(QM3.map((r) => r.map((x) => x * 3)), 3.6, 6.0, 0, 'ptr');
    cap('三個 columns 都 orthonormal', 'Q 變成 3×3 orthogonal matrix');
    S.k2 = ok(isI(mm(tr(QM3), QM3)), -4.4, 5.0, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    cap('這裡沒有平方根，是少見的幸運', 'Gram-Schmidt 除以長度，通常會出現 √');
    S.n = tag('一般情況：√ 一定會出現', 'note', 3.4, 4.6);
  },
]);

// 投影到 C(Q)：示意 b = (1, −1, 5)
const QB7 = [1, -1, 5];
scene('or-l17-pqqt', 'L17：投影到 C(Q)：P = QQᵀ', CAM3, async (tok, S) => {
  S.sp = space3(0.6, V3(0, 2.4, 0), 2.4);
}, [
  async (tok, S) => {
    cap('Q 有 orthonormal columns：投影到它的 column space', '');
    S.pl = span2(S.sp, QC[0], QC[1], 1.8, C.q, 0.16);
    S.q1 = av(S.sp, mul(1.5, QC[0]), C.q, 'q₁'); S.q2 = av(S.sp, mul(1.5, QC[1]), C.q, 'q₂');
  },
  async (tok, S) => {
    cap('投影矩陣公式：A(AᵀA)⁻¹Aᵀ', 'A 換成 Q：Q(QᵀQ)⁻¹Qᵀ');
    S.f = mono(hd('P = Q (QᵀQ)⁻¹ Qᵀ', -3.8, 6.6));
  },
  async (tok, S) => {
    const PQ = mm(QM2, tr(QM2));
    cap('中間的 QᵀQ = I，不用求反矩陣', 'P = QQᵀ');
    txt(S.f, 'P = Q (I)⁻¹ Qᵀ = QQᵀ');
    S.pm = mtag(PQ.map((r) => r.map((x) => x * 9)), -3.4, 5.2, 0, 'ptr'); S.pn = sm('QQᵀ = 1/9 ×', -5.4, 5.2);
    S.k = ok(sameM(PQ, projM(QM2)), -3.6, 3.9, 'QQᵀ = Q(QᵀQ)⁻¹Qᵀ ✓');
  },
  async (tok, S) => {
    const p = mv(mm(QM2, tr(QM2)), QB7); S.p = p;
    cap('QQᵀ 把 b 投影到平面上', 'b = (1, −1, 5)（示意）→ Pb = ' + vv(p));
    S.n = sy(4.0, 6.4);
    S.B = await gv(tok, S.sp, QB7, C.b, 'b', 'ptr alt');
    S.dl = seg(S.sp.W(QB7), S.sp.W(QB7), '#6e5f49', true);
    await anim(tok, 900, (t) => S.dl.setPts(S.sp.W(QB7), S.sp.W(lerpV(QB7, p, t))));
    S.Pp = await gv(tok, S.sp, p, C.p, 'Pb = ' + vv(p), '', [0, 0, 0], 0.065, 500);
    S.E = av(S.sp, sub(QB7, p), C.e, 'e', '', p, 0.04);
    S.k2 = ok(Z(dot(sub(QB7, p), QC[0])) && Z(dot(sub(QB7, p), QC[1])), 3.4, 5.6, 'e ⟂ q₁、q₂ ✓');
  },
  async (tok, S) => {
    const PI3 = mm(QM3, tr(QM3));
    cap('極端情況：Q 是方陣 → column space 是整個空間', '投影到整個空間 = 不用動：P = I');
    S.q3 = await gv(tok, S.sp, mul(1.5, QC[2]), C.q, 'q₃');
    await anim(tok, 1200, (t) => { S.Pp.set(S.sp.O, S.sp.W(lerpV(S.p, QB7, t))); S.E.set(S.sp.W(lerpV(S.p, QB7, t)), S.sp.W(QB7)); S.pl.material.opacity = 0.16 * (1 - t); });
    S.k3 = ok(isI(PI3), 3.4, 4.9, 'Q 方陣：QQᵀ = I ✓');
  },
  async (tok, S) => {
    cap('不是方陣時：QQᵀ 不是 I', '只投影到平面');
    gone(S.q3, S.k3);
    await anim(tok, 1200, (t) => { S.Pp.set(S.sp.O, S.sp.W(lerpV(QB7, S.p, t))); S.E.set(S.sp.W(lerpV(QB7, S.p, t)), S.sp.W(QB7)); S.pl.material.opacity = 0.16 * t; });
    S.k3 = ok(!isI(mm(QM2, tr(QM2))), 3.4, 4.9, '3×2：QQᵀ ≠ I ✓');
  },
  async (tok, S) => {
    const PQ = mm(QM2, tr(QM2));
    cap('投影矩陣性質 1：對稱', '(QQᵀ)ᵀ = QQᵀ');
    setCls(S.pm, 'ptr alt');
    S.k4 = ok(sameM(PQ, tr(PQ)), -3.6, 3.2, 'Pᵀ = P ✓');
  },
  async (tok, S) => {
    const PQ = mm(QM2, tr(QM2));
    cap('性質 2：投影兩次 = 投影一次', '(QQᵀ)(QQᵀ) = QQᵀ');
    await flash(tok, S.Pp, 3);
    S.k5 = ok(sameM(mm(PQ, PQ), PQ), -3.6, 2.5, 'P² = P ✓');
  },
  async (tok, S) => {
    cap('中間坐著 QᵀQ = I，消掉', 'Q(QᵀQ)Qᵀ = QQᵀ');
    S.f2 = mono(hot('(QQᵀ)(QQᵀ) = Q(QᵀQ)Qᵀ = QQᵀ', -3.4, 1.8));
  },
]);

scene('or-l17-xhat', 'L17：normal equation 變簡單：x̂ = Qᵀb', CAM3, async (tok, S) => {
  S.sp = space3(0.6, V3(0, 2.4, 0), 2.4);
  span2(S.sp, QC[0], QC[1], 1.8, C.q, 0.14);
  rod(C.q, 0.02).set(S.sp.W(mul(-1, QC[0])), S.sp.W(mul(4, QC[0]))); rod(C.q, 0.02).set(S.sp.W(mul(-1, QC[1])), S.sp.W(mul(4, QC[1])));
  av(S.sp, QC[0], C.q, 'q₁', 'ptr', [0, 0, 0], 0.06); av(S.sp, QC[1], C.q, 'q₂', 'ptr', [0, 0, 0], 0.06);
  S.B = av(S.sp, QB7, C.b, 'b（示意）', 'ptr alt');
}, [
  async (tok, S) => {
    cap('這章最重要的方程：normal equation', 'AᵀA x̂ = Aᵀb');
    S.f = mono(hd('AᵀA x̂ = Aᵀb', -3.8, 6.5));
  },
  async (tok, S) => {
    cap('A 換成 Q', 'QᵀQ x̂ = Qᵀb');
    txt(S.f, 'QᵀQ x̂ = Qᵀb');
  },
  async (tok, S) => {
    const xh = mv(tr(QM2), QB7);
    cap('左邊 QᵀQ = I 直接消失', 'x̂ = Qᵀb：不用解聯立、不用反矩陣');
    txt(S.f, 'QᵀQ x̂ = Qᵀb  ⇒  x̂ = Qᵀb');
    S.k = ok(isI(mm(tr(QM2), QM2)), -3.8, 5.8, 'QᵀQ = I ✓');
    S.xh = xh;
  },
  ...[0, 1].map((k) => async (tok, S) => {
    const c = dot(QC[k], QB7), foot = mul(c, QC[k]);
    cap('x̂' + sub3(k + 1) + ' = q' + sub3(k + 1) + 'ᵀb = ' + frac(c), '沿著第 ' + (k + 1) + ' 個 basis 向量的分量 = 一個內積');
    const dl = seg(S.sp.W(QB7), S.sp.W(QB7), '#6e5f49', true);
    await anim(tok, 800, (t) => dl.setPts(S.sp.W(QB7), S.sp.W(lerpV(QB7, foot, t))));
    S['f' + k] = await gv(tok, S.sp, foot, C.p, 'x̂' + sub3(k + 1) + ' = ' + frac(c), '', [0, 0, 0], 0.05, 500);
    if (k === 1) {
      const p = add(mul(S.xh[0], QC[0]), mul(S.xh[1], QC[1]));
      S.p = av(S.sp, p, C.p, 'p = 3q₁ + 3q₂ = ' + vv(p), '', [0, 0, 0], 0.07);
      S.k2 = ok(same(p, mv(mm(QM2, tr(QM2)), QB7)), -3.8, 5.1, 'x̂₁q₁ + x̂₂q₂ = QQᵀb ✓');
    }
  }),
]);

// Gram-Schmidt 兩個向量（示意 a = (3, 1)、b = (1, 2)）
scene('or-l17-gs2', 'L17：Gram-Schmidt：B = b − (Aᵀb/AᵀA)A', [[0.6, 3.0, 10.5], [0.6, 2.8, 0]], async (tok, S) => {
  S.P = board2(-1.2, 1.4, 1.15, [-1.6, 3.6], [-0.9, 2.6]);
  S.a = [3, 1]; S.b = [1, 2]; S.k = dot(S.a, S.b) / dot(S.a, S.a); S.p = mul(S.k, S.a); S.B = sub(S.b, S.p);
}, [
  async (tok, S) => {
    cap('後半堂：從「獨立」的向量出發', '還不 orthonormal');
    S.n = sy(4.6, 5.0);
  },
  async (tok, S) => {
    cap('消去法的目標：三角形；這次的目標：正交', '把 columns 變成 orthonormal');
    S.t1 = sm('消去法 → 三角形 U', -4.6, 5.0); S.t2 = hot('Gram-Schmidt → orthonormal Q', -4.6, 4.4);
  },
  async (tok, S) => {
    cap('先看兩個向量 a、b', '可以在 2 維，也可以在 12 維');
    S.A = vec(C.a, 0.06); await growV(tok, S.A, S.P(0, 0), W2(S.P, S.a)); S.A.label('a', 'ptr');
    S.Bb = vec(C.b, 0.06); await growV(tok, S.Bb, S.P(0, 0), W2(S.P, S.b)); S.Bb.label('b', 'ptr alt');
  },
  async (tok, S) => {
    cap('a、b 線性獨立；目標：orthonormal 的 q₁、q₂', '');
  },
  async (tok, S) => {
    cap('第一個方向沒問題：A = a', '');
    S.A.label('A = a', 'ptr'); await flash(tok, S.A, 2);
  },
  async (tok, S) => {
    cap('關鍵一步：先做出垂直的 A、B', '最後再變成 q₁、q₂');
  },
  async (tok, S) => {
    const u = unit(S.a);
    cap('最後一步：除以長度（Strang：這是 Schmidt 的貢獻）', 'q₁ = A / ‖A‖');
    S.c = circle2(S.P, 1, '#cbbd9f');
    S.u = vec(C.q, 0.04); await growV(tok, S.u, S.P(0, 0), W2(S.P, u), 600); S.u.label('q₁', 'idx');
  },
  async (tok, S) => {
    const ang = Math.acos(dot(S.a, S.b) / norm(S.a) / norm(S.b)) * 180 / Math.PI;
    cap('問題在第二個方向：b 和 A 不垂直', 'a、b 夾角 ≈ ' + Math.round(ang) + '°，不是 90°');
    gone(S.u);
    S.k0 = ok(!Z(dot(S.a, S.b)), 3.6, 4.4, 'Aᵀb = ' + frac(dot(S.a, S.b)) + ' ≠ 0 ✓');
  },
  async (tok, S) => {
    cap('這章第一個計算：投影', 'b 在 A 方向的那一部分 p');
    S.dl = seg(W2(S.P, S.b), W2(S.P, S.b), '#6e5f49', true);
    await anim(tok, 900, (t) => S.dl.setPts(W2(S.P, S.b), W2(S.P, lerpV(S.b, S.p, t))));
    S.pp = vec(C.p, 0.045); await growV(tok, S.pp, S.P(0, 0), W2(S.P, S.p), 500); S.pp.label('p', 'idx');
  },
  async (tok, S) => {
    cap('我們要的是另一部分：投影那課的 e', '這就是 B，和 A 成 90°');
    S.e = vec(C.e, 0.06); await growV(tok, S.e, W2(S.P, S.p), W2(S.P, S.b), 600); S.e.label('e', '');
    S.ra = rightAngle(W2(S.P, S.p), W2(S.P, mul(-1, S.a)).sub(S.P(0, 0)), W2(S.P, S.B).sub(S.P(0, 0)), 0.2);
  },
  async (tok, S) => {
    cap('B = 原來的 b 減掉投影', '投影丟掉，留下垂直的部分');
    gone(S.ra);
    await anim(tok, 1000, (t) => S.e.set(W2(S.P, mul(1 - t, S.p)), W2(S.P, add(mul(1 - t, S.p), S.B))));
    S.e.label('B = b − p', '');
  },
  async (tok, S) => {
    cap('投影的倍數 = Aᵀb / AᵀA', 'B = b − (Aᵀb / AᵀA) A');
    S.f = mono(hd('B = b − (Aᵀb/AᵀA) A', -4.4, 3.6));
    S.k1 = ok(Math.abs(S.k - 0.5) < 1e-9, -4.4, 3.0, 'Aᵀb/AᵀA = 5/10 → B = ' + vv(S.B) + ' ✓');
  },
  async (tok, S) => {
    cap('檢查：AᵀB = Aᵀb − (Aᵀb/AᵀA)·AᵀA = 0', 'AᵀB = 3·(−1/2) + 1·(3/2) = 0');
    S.ra = rightAngle(S.P(0, 0), W2(S.P, S.a).sub(S.P(0, 0)), W2(S.P, S.B).sub(S.P(0, 0)), 0.25);
    S.k2 = ok(Z(dot(S.a, S.B)), -4.4, 2.4, 'AᵀB = 0 ✓');
  },
]);

scene('or-l17-gs3', 'L17：Gram-Schmidt：第三個向量 C', [[5.4, 6.2, 8.8], [0.4, 3.0, 0]], async (tok, S) => {
  S.sp = space3(1.0, V3(0, 2.6, 0), 2.6);
  const a = [2, 1, 0], b = [1, 2, 0], c = [1, 0.5, 2];
  S.A = a; S.Bv = sub(b, mul(dot(a, b) / dot(a, a), a)); S.c = c;
  S.pA = mul(dot(a, c) / dot(a, a), a); S.pB = mul(dot(S.Bv, c) / dot(S.Bv, S.Bv), S.Bv); S.Cv = sub(sub(c, S.pA), S.pB);
  sy(-4.4, 6.6);
}, [
  async (tok, S) => {
    cap('三個獨立向量 a、b、c → 垂直的 A、B、C', '最後 q₃ = C / ‖C‖');
    S.f = mono(hd('a, b, c → A, B, C → q₁, q₂, q₃', -3.2, 6.0));
  },
  async (tok, S) => {
    cap('A、B 已經做好，互相垂直', 'B = b − (Aᵀb/AᵀA)A');
    S.pl = span2(S.sp, S.A, S.Bv, 2.3, C.a, 0.14);
    S.a1 = av(S.sp, S.A, C.a, 'A', 'ptr', [0, 0, 0], 0.06); S.b1 = av(S.sp, S.Bv, C.a, 'B', 'ptr', [0, 0, 0], 0.06);
    S.ra = rightAngle(S.sp.O, S.sp.D(S.A), S.sp.D(S.Bv), 0.25);
  },
  async (tok, S) => {
    cap('c 要「跳出黑板」才會獨立', '');
    S.cv = await gv(tok, S.sp, S.c, C.c, 'c', 'ptr alt', [0, 0, 0], 0.06);
  },
  async (tok, S) => {
    cap('從 c 出發，減掉它在 A、B 方向的分量', 'C = c − … − …');
    txt(S.f, 'C = c − (Aᵀc/AᵀA)A − (Bᵀc/BᵀB)B');
  },
  async (tok, S) => {
    cap('減掉 (Aᵀc / AᵀA) A', 'c 在 A 方向的投影');
    S.dl = seg(S.sp.W(S.c), S.sp.W(S.c), '#6e5f49', true);
    await anim(tok, 1200, (t) => { const q = sub(S.c, mul(t, S.pA)); S.cv.set(S.sp.O, S.sp.W(q)); S.dl.setPts(S.sp.W(S.c), S.sp.W(q)); });
  },
  async (tok, S) => {
    cap('再減掉 (Bᵀc / BᵀB) B', 'c 在 B 方向的投影');
    await anim(tok, 1200, (t) => S.cv.set(S.sp.O, S.sp.W(sub(sub(S.c, S.pA), mul(t, S.pB)))));
    S.cv.label('C', 'ptr alt');
  },
  async (tok, S) => {
    cap('C 垂直 A，也垂直 B', '垂直整個 A、B 平面');
    S.r1 = rightAngle(S.sp.O, S.sp.D(S.A), S.sp.D(S.Cv), 0.25); S.r2 = rightAngle(S.sp.O, S.sp.D(S.Bv), S.sp.D(S.Cv), 0.25);
    S.k = ok(Z(dot(S.A, S.Cv)) && Z(dot(S.Bv, S.Cv)), -3.2, 5.4, 'AᵀC = 0、BᵀC = 0 ✓');
  },
  async (tok, S) => {
    cap('只差長度：除以 ‖C‖', 'q₃ = C / ‖C‖');
    await anim(tok, 900, (t) => S.cv.set(S.sp.O, S.sp.W(lerpV(S.Cv, unit(S.Cv), t))));
    S.cv.label('q₃ = C/‖C‖', 'ptr alt');
    S.k2 = ok(Math.abs(norm(unit(S.Cv)) - 1) < 1e-9, -3.2, 4.8, '‖q₃‖ = 1 ✓');
  },
]);

scene('or-l17-gs111', 'L17：Gram-Schmidt 例子 a = (1,1,1)、b = (1,0,2)', [[5.4, 6.0, 9], [0.3, 3.1, 0]], async (tok, S) => {
  S.sp = space3(1.1, V3(0, 2.5, 0), 2.4);
  S.a = [1, 1, 1]; S.b = [1, 0, 2];
}, [
  async (tok, S) => {
    cap('Strang 的數字：a = (1, 1, 1)、b = (1, 0, 2)', '');
    S.A1 = await gv(tok, S.sp, S.a, C.a, 'a = (1, 1, 1)', 'ptr', [0, 0, 0], 0.06);
    S.Bb = await gv(tok, S.sp, S.b, C.b, 'b = (1, 0, 2)', 'ptr alt', [0, 0, 0], 0.06);
    S.m = mtag([[1, 1], [1, 0], [1, 2]], -3.0, 6.0, 0, 'ptr'); S.mn = sm('A =', -4.3, 6.0);
  },
  async (tok, S) => {
    cap('故意不垂直，不然就不用 Gram-Schmidt', 'aᵀb = 1 + 0 + 2 = 3');
    S.k0 = ok(!Z(dot(S.a, S.b)), -3.0, 4.8, 'aᵀb = ' + dot(S.a, S.b) + ' ≠ 0 ✓');
  },
  async (tok, S) => {
    cap('A = a，不用改', '');
    S.A1.label('A = a = (1, 1, 1)', 'ptr'); await flash(tok, S.A1, 2);
  },
  async (tok, S) => {
    cap('B = 原來的 b 減掉 A 的某個倍數', 'B = b − (Aᵀb/AᵀA) A');
  },
  async (tok, S) => {
    const r = dot(S.a, S.b) / dot(S.a, S.a); S.r = r;
    cap('Aᵀb = 3、AᵀA = 3，比值 = ' + frac(r), 'Strang：「沒想到會這樣，但就是發生了」');
    S.k1 = ok(Math.abs(r - 1) < 1e-9, -3.0, 4.2, 'Aᵀb / AᵀA = 3/3 = 1 ✓');
    S.dl = seg(S.sp.W(S.b), S.sp.W(S.b), '#6e5f49', true);
    await anim(tok, 900, (t) => S.dl.setPts(S.sp.W(S.b), S.sp.W(lerpV(S.b, mul(S.r, S.a), t))));
  },
  async (tok, S) => {
    S.B = sub(S.b, mul(S.r, S.a));
    cap('B = (1, 0, 2) − (1, 1, 1) = ' + vv(S.B), '');
    S.Bv = vec(C.e, 0.06); await growV(tok, S.Bv, S.sp.W(S.a), S.sp.W(S.b), 600);
    await anim(tok, 900, (t) => S.Bv.set(S.sp.W(mul(1 - t, S.a)), S.sp.W(add(mul(1 - t, S.a), S.B))));
    S.Bv.label('B = ' + vv(S.B), '');
  },
  async (tok, S) => {
    cap('檢查：A 垂直 B', 'A·B = 0 − 1 + 1 = 0');
    gone(S.dl);
    S.ra = rightAngle(S.sp.O, S.sp.D(S.a), S.sp.D(S.B), 0.25);
    S.k2 = ok(Z(dot(S.a, S.B)), -3.0, 3.6, 'AᵀB = 0 ✓');
  },
  async (tok, S) => {
    const q1 = unit(S.a), q2 = unit(S.B), Q = tr([q1, q2]);
    cap('除以長度：A 除以 √3、B 除以 √2', 'Q = [1/√3 0; 1/√3 −1/√2; 1/√3 1/√2]');
    await anim(tok, 1000, (t) => { S.A1.set(S.sp.O, S.sp.W(lerpV(S.a, q1, t))); S.Bv.set(S.sp.O, S.sp.W(lerpV(S.B, q2, t))); });
    S.A1.label('q₁ = (1, 1, 1)/√3', 'ptr'); S.Bv.label('q₂ = (0, −1, 1)/√2', '');
    gone(S.m, S.mn); S.m = mtag([['1/√3', '0'], ['1/√3', '−1/√2'], ['1/√3', '1/√2']], -2.9, 6.0, 0, 'ptr'); S.mn = sm('Q =', -4.5, 6.0);
    S.k3 = ok(isI(mm(tr(Q), Q)), -3.0, 3.0, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    const n = cross(S.a, S.b);
    cap('C(Q) 和 C(A) 是同一個平面', 'B 是 a、b 的組合，沒有離開平面');
    S.pl = span2(S.sp, S.a, S.b, 1.85, C.a, 0.15);
    S.k4 = ok(Z(dot(n, unit(S.a))) && Z(dot(n, unit(S.B))), -3.0, 2.4, 'q₁、q₂ 都在 a、b 的平面上 ✓');
  },
  async (tok, S) => {
    cap('同一個平面，換成更好的 basis', 'orthonormal：之後的投影、計算都輕鬆');
    for (let k = 0; k < 2; k++) { S.pl.material.opacity = 0.32; await wt(tok, 300); S.pl.material.opacity = 0.15; await wt(tok, 300); }
  },
]);

scene('or-l17-qr', 'L17：A = QR：R 是上三角', [[1.2, 4.6, 12.4], [1.2, 2.8, 0]], async (tok, S) => {
  S.sp = space3(1.0, V3(-3.2, 2.0, 0), 2.0);
  S.a1 = [1, 1, 1]; S.a2 = [1, 0, 2]; S.q1 = unit(S.a1); S.q2 = unit([0, -1, 1]);
  S.Q1 = av(S.sp, S.q1, C.q, 'q₁', 'ptr', [0, 0, 0], 0.06); S.Q2 = av(S.sp, S.q2, C.q, 'q₂', 'ptr', [0, 0, 0], 0.06);
  S.A1 = av(S.sp, S.a1, C.a, 'a₁', 'idx', [0, 0, 0], 0.045); S.A2 = av(S.sp, S.a2, C.b, 'a₂', 'idx', [0, 0, 0], 0.045);
  S.R = [[dot(S.q1, S.a1), dot(S.q1, S.a2)], [dot(S.q2, S.a1), dot(S.q2, S.a2)]];
}, [
  async (tok, S) => {
    cap('消去法寫成矩陣語言：A = LU', '');
    S.lu = hd('消去法：A = LU', 2.4, 6.8);
  },
  async (tok, S) => {
    cap('Gram-Schmidt 寫成矩陣語言：A = QR', 'A 和 Q 的 column space 一樣，R 負責連接');
    S.qr = hot('Gram-Schmidt：A = QR', 2.4, 6.2);
  },
  async (tok, S) => {
    cap('[a₁ a₂] = [q₁ q₂] R（n = 2）', '');
    S.f = mono(hd('[ a₁  a₂ ] = [ q₁  q₂ ] R', 2.4, 5.5));
  },
  async (tok, S) => {
    cap('R 裡放著 √3、√2 之類的數字', 'Strang：「大概是這些」');
  },
  async (tok, S) => {
    cap('重點：R 是上三角，左下角是 0', '');
    S.zero = cube('0', '#d8cfc0', [1.1, 0.2, 0.6], 1.8, 3.6, 0, 1.5);
    hot('R', 0.9, 4.2);
  },
  async (tok, S) => {
    cap('R 的元素是內積：r₁₁ = q₁ᵀa₁、r₁₂ = q₁ᵀa₂、r₂₂ = q₂ᵀa₂', '');
    for (const [i, j] of [[0, 0], [0, 1], [1, 1]]) {
      const v = S.R[i][j];
      [S.Q1, S.Q2][i].glow('#6a4a00'); [S.A1, S.A2][j].glow('#0f5a3a');
      cube(frac(v), C.p, [1.1, 0.9, 0.6], 1.8 + j * 1.3, 4.8 - i * 1.2, 0, 1.5);
      await wt(tok, 600); [S.Q1, S.Q2][i].glow(null); [S.A1, S.A2][j].glow(null);
    }
  },
  async (tok, S) => {
    cap('左下角 = q₂ᵀa₁ = a₁ᵀq₂，為什麼是 0？', '');
    S.Q2.glow('#6a4a00'); S.A1.glow('#0f5a3a');
    S.ra = rightAngle(S.sp.O, S.sp.D(S.a1), S.sp.D(S.q2), 0.25);
    S.k = ok(Z(S.R[1][0]), 3.6, 2.2, 'q₂ᵀa₁ = ' + frac(S.R[1][0]) + ' ✓');
  },
  async (tok, S) => {
    cap('Gram-Schmidt 讓後面的 q 垂直前面所有的向量', 'q₂ ⟂ a₁（a₁ 就是 A）');
    S.Q2.glow(null); S.A1.glow(null);
  },
  async (tok, S) => {
    const Q = tr([S.q1, S.q2]), Rm = [[S.R[0][0], S.R[0][1]], [0, S.R[1][1]]];
    cap('獨立 columns → orthonormal Q，連接是三角的 R', 'A = QR');
    S.k2 = ok(sameM(mm(Q, Rm), tr([S.a1, S.a2])), 3.6, 1.5, 'QR = A ✓');
    const s1 = vec(C.p, 0.035); await growV(tok, s1, S.sp.O, S.sp.W(mul(S.R[0][1], S.q1)), 600);
    const s2 = vec(C.p, 0.035); await growV(tok, s2, S.sp.W(mul(S.R[0][1], S.q1)), S.sp.W(S.a2), 600);
  },
]);

// ════════ HEQuN0QELSQ：Gram-Schmidt 習題課（a = (1,0,0)、b = (2,0,3)、c = (4,5,6)）════════
const RA = [1, 0, 0], RB = [2, 0, 3], RC = [4, 5, 6];
const RAm = tr([RA, RB, RC]);
function ritaSetup(stage) {
  return async (tok, S) => {
    S.sp = space3(0.38, V3(0, 1.4, 0), 2.6);
    mtag(RAm, -3.6, 5.6, 0, 'ptr'); sm('A =', -4.8, 5.6);
    S.q1 = [1, 0, 0]; S.q2p = sub(RB, mul(dot(RB, S.q1), S.q1)); S.q2 = unit(S.q2p);
    S.q3p = sub(sub(RC, mul(dot(RC, S.q1), S.q1)), mul(dot(RC, S.q2), S.q2)); S.q3 = unit(S.q3p);
    S.Aa = av(S.sp, stage >= 1 ? S.q1 : RA, stage >= 1 ? C.q : C.a, stage >= 1 ? 'q₁ = (1, 0, 0)' : 'a = (1, 0, 0)', 'ptr');
    S.Ab = av(S.sp, stage >= 2 ? S.q2 : RB, stage >= 2 ? C.q : C.b, stage >= 2 ? 'q₂ = (0, 0, 1)' : 'b = (2, 0, 3)', 'ptr alt');
    S.Ac = av(S.sp, RC, C.c, 'c = (4, 5, 6)', '');
  };
}
scene('or-r-task', '習題：A 的 columns a、b、c → q₁、q₂、q₃，再寫成 QR', [[5.2, 5.4, 8.6], [0.4, 2.4, 0]], async (tok, S) => {
  S.sp = space3(0.38, V3(0, 1.4, 0), 2.6);
}, [
  async (tok, S) => {
    cap('矩陣 A 的三個 columns：a、b、c', 'A = [1 2 4; 0 0 5; 0 3 6]');
    mtag(RAm, -3.6, 5.6, 0, 'ptr'); sm('A =', -4.8, 5.6);
    S.a = await gv(tok, S.sp, RA, C.a, 'a', 'ptr', [0, 0, 0], 0.05, 400);
    S.b = await gv(tok, S.sp, RB, C.b, 'b', 'ptr alt', [0, 0, 0], 0.05, 400);
    S.c = await gv(tok, S.sp, RC, C.c, 'c', '', [0, 0, 0], 0.05, 400);
  },
  async (tok, S) => {
    cap('目標 1：做出 orthonormal 的 q₁、q₂、q₃', '');
    S.t1 = hd('① q₁, q₂, q₃（orthonormal）', 3.0, 6.2);
  },
  async (tok, S) => {
    cap('目標 2：A = QR', 'Q orthogonal、R upper triangular');
    S.t2 = hd('② A = QR', 3.0, 5.6);
  },
  async (tok, S) => {
    cap('orthogonal matrix：columns 是 orthonormal 向量', '');
    S.t3 = sm('Q 的 columns = q₁, q₂, q₃', 3.0, 5.0);
  },
]);
scene('or-r-q1', '習題：q₁ = a / ‖a‖', [[5.2, 5.4, 8.6], [0.4, 2.4, 0]], ritaSetup(0), [
  async (tok, S) => {
    cap('Gram-Schmidt 每一步：', '拿原本的向量，讓它和前面的 q 都垂直，再變成長度 1');
    S.f = mono(hd('qₖ′ = 原向量 − Σ(原向量·qᵢ)qᵢ ； qₖ = qₖ′/‖qₖ′‖', -1.0, 7.0));
  },
  async (tok, S) => {
    cap('先找 q₁', '');
    await flash(tok, S.Aa, 2);
  },
  async (tok, S) => {
    cap('從 a 出發；前面沒有別的向量', '不用減任何投影');
  },
  async (tok, S) => {
    cap('方向不用改，只要長度 = 1', 'q₁ = a / ‖a‖');
  },
  async (tok, S) => {
    cap('a = (1, 0, 0) 長度本來就是 1', 'q₁ = (1, 0, 0)');
    S.Aa.color(C.q); S.Aa.label('q₁ = (1, 0, 0)', 'ptr');
    S.k = ok(Math.abs(norm(RA) - 1) < 1e-9, 3.0, 6.0, '‖a‖ = 1 → q₁ = a ✓');
  },
]);
scene('or-r-q2', '習題：q₂：b 減掉在 q₁ 上的投影', [[5.2, 5.4, 8.6], [0.4, 2.4, 0]], ritaSetup(1), [
  async (tok, S) => {
    cap('q₂：從 b 出發', '先讓它垂直 q₁');
    await flash(tok, S.Ab, 2);
  },
  async (tok, S) => {
    cap('減掉 b 在 q₁ 上的投影', 'q₂′ = b − (b·q₁) q₁');
    S.f = mono(hd('q₂′ = b − (b·q₁) q₁', 3.0, 6.4));
  },
  async (tok, S) => {
    cap('平常投影要除以 ‖q₁‖²', 'q₁ 是單位向量，‖q₁‖² = 1 → 不用除');
  },
  async (tok, S) => {
    const c = dot(RB, S.q1);
    cap('b·q₁ = ' + frac(c), '(2, 0, 3) − 2·(1, 0, 0)');
    S.s = await gv(tok, S.sp, mul(c, S.q1), C.p, '2q₁', 'idx', [0, 0, 0], 0.035, 500);
  },
  async (tok, S) => {
    cap('q₂′ = ' + vv(S.q2p), '');
    await anim(tok, 1100, (t) => S.Ab.set(S.sp.O, S.sp.W(sub(RB, mul(2 * t, S.q1)))));
    S.Ab.label('q₂′ = ' + vv(S.q2p), 'ptr alt'); gone(S.s);
  },
  async (tok, S) => {
    cap('檢查：q₂′·q₁ = 0', '');
    S.ra = rightAngle(S.sp.O, S.sp.D(S.q1), S.sp.D(S.q2p), 0.3);
    S.k = ok(Z(dot(S.q2p, S.q1)), 3.0, 5.8, 'q₂′·q₁ = 0 ✓');
  },
  async (tok, S) => {
    cap('還要長度 1：這個只是 q₂′', '');
  },
  async (tok, S) => {
    cap('除以長度 ' + frac(norm(S.q2p)) + '：q₂ = ' + vv(S.q2), '');
    await anim(tok, 900, (t) => S.Ab.set(S.sp.O, S.sp.W(lerpV(S.q2p, S.q2, t))));
    S.Ab.color(C.q); S.Ab.label('q₂ = ' + vv(S.q2), 'ptr alt');
    S.k2 = ok(Math.abs(norm(S.q2) - 1) < 1e-9, 3.0, 5.2, '‖q₂‖ = 1 ✓');
  },
]);
scene('or-r-q3', '習題：q₃：c 減掉在 q₁、q₂ 上的投影', [[5.2, 5.4, 8.6], [0.4, 2.4, 0]], ritaSetup(2), [
  async (tok, S) => {
    cap('q₃：從 c 出發', '');
    await flash(tok, S.Ac, 2);
  },
  async (tok, S) => {
    cap('減掉 c 在 q₁ 和 q₂ 上的投影', 'q₃′ = c − (c·q₁)q₁ − (c·q₂)q₂');
    S.f = mono(hd('q₃′ = c − (c·q₁)q₁ − (c·q₂)q₂', 2.6, 6.4));
  },
  async (tok, S) => {
    const c1 = dot(RC, S.q1);
    cap('c·q₁ = ' + frac(c1) + '：減掉 4q₁', '');
    await anim(tok, 1100, (t) => S.Ac.set(S.sp.O, S.sp.W(sub(RC, mul(c1 * t, S.q1)))));
  },
  async (tok, S) => {
    const c1 = dot(RC, S.q1), c2 = dot(RC, S.q2);
    cap('c·q₂ = ' + frac(c2) + '：再減掉 6q₂', '(4, 5, 6) − 4(1, 0, 0) − 6(0, 0, 1) = ' + vv(S.q3p));
    await anim(tok, 1100, (t) => S.Ac.set(S.sp.O, S.sp.W(sub(sub(RC, mul(c1, S.q1)), mul(c2 * t, S.q2)))));
    S.Ac.label('q₃′ = ' + vv(S.q3p), '');
  },
  async (tok, S) => {
    cap('q₃′ 同時垂直 q₁、q₂，但長度還不是 1', '');
    S.r1 = rightAngle(S.sp.O, S.sp.D(S.q1), S.sp.D(S.q3p), 0.3); S.r2 = rightAngle(S.sp.O, S.sp.D(S.q2), S.sp.D(S.q3p), 0.3);
    S.k = ok(Z(dot(S.q3p, S.q1)) && Z(dot(S.q3p, S.q2)), 2.6, 5.8, 'q₃′·q₁ = q₃′·q₂ = 0 ✓');
  },
  async (tok, S) => {
    cap('除以長度 ' + frac(norm(S.q3p)) + '：q₃ = ' + vv(S.q3), '');
    await anim(tok, 900, (t) => S.Ac.set(S.sp.O, S.sp.W(lerpV(S.q3p, S.q3, t))));
    S.Ac.color(C.q); S.Ac.label('q₃ = ' + vv(S.q3), '');
    S.k2 = ok(isI(mm(tr(tr([S.q1, S.q2, S.q3])), tr([S.q1, S.q2, S.q3]))), 2.6, 5.2, 'q₁、q₂、q₃ orthonormal ✓');
  },
  async (tok, S) => {
    cap('這題很幸運：全是整數', '一般 Gram-Schmidt 會冒出很多平方根');
  },
]);
const RQ = tr([[1, 0, 0], [0, 0, 1], [0, 1, 0]]), RR = [[1, 2, 4], [0, 3, 6], [0, 0, 5]];
scene('or-r-qr', '習題：A = QR', [[0, 3.0, 12], [0, 2.8, 0]], null, [
  async (tok, S) => {
    cap('下一部分：寫成 A = QR', '');
    S.eq = hd('A = Q R', 0, 6.4);
  },
  async (tok, S) => {
    cap('A = [1 2 4; 0 0 5; 0 3 6]', '');
    S.A = RAm.map((r, i) => r.map((v, j) => cube(v, v === 0 ? '#e6dccb' : C.a, [0.8, 0.8, 0.4], -5.6 + j * 0.95, 3.6 - i * 0.95, 0))); hd('A', -4.6, 5.0); sm('=', -2.4, 2.6);
  },
  async (tok, S) => {
    cap('Q 的 columns 就是 q₁、q₂、q₃', 'Q = [1 0 0; 0 0 1; 0 1 0]');
    S.Q = RQ.map((r, i) => r.map((v, j) => cube(v, v === 0 ? '#e6dccb' : C.q, [0.8, 0.8, 0.4], -1.9 + j * 0.95, 3.6 - i * 0.95, 0))); hd('Q', -0.9, 5.0);
    S.k0 = ok(isI(mm(tr(RQ), RQ)), -0.9, 0.6, 'QᵀQ = I ✓');
  },
  async (tok, S) => {
    cap('還要一個上三角的 R 讓等式成立', '');
    S.Rn = hd('R = ?', 2.8, 5.0);
  },
  async (tok, S) => {
    cap('看看 Q：它是 permutation matrix', '');
    glow(S.Q[1][2], '#6a4a00'); glow(S.Q[2][1], '#6a4a00');
  },
  async (tok, S) => {
    cap('Q 的作用：交換 R 的第 2、3 列，得到 A', '');
    S.p = sm('Q × R = 「R 的第 2、3 列交換」', 1.0, 0.6);
  },
  async (tok, S) => {
    cap('所以 R = [1 2 4; 0 3 6; 0 0 5]', '第 2 列 = A 的第 3 列，第 3 列 = A 的第 2 列');
    txt(S.Rn, 'R');
    S.R = RR.map((r, i) => r.map((v, j) => cube(v, v === 0 ? '#e6dccb' : C.p, [0.8, 0.8, 0.4], 1.8 + j * 0.95, 3.6 - i * 0.95, 0, 1.4)));
    await wt(tok, 600);
    S.k = ok(sameM(mm(RQ, RR), RAm), 2.8, 0.0, 'QR = A ✓');
  },
  async (tok, S) => {
    cap('R 確實是上三角', 'Q orthogonal、R upper triangular');
    S.k2 = ok(RR.every((r, i) => r.every((v, j) => j >= i || v === 0)), 2.8, -0.6, 'R 左下全是 0 ✓');
  },
]);
scene('or-r-coef', '習題：R 的數字從哪來', [[5.2, 5.4, 8.6], [0.4, 2.4, 0]], async (tok, S) => {
  S.sp = space3(0.38, V3(0, 1.4, 0), 2.6);
  S.q = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];
  S.q.forEach((u, k) => av(S.sp, mul(1.4, u), C.q, 'q' + sub3(k + 1), 'ptr', [0, 0, 0], 0.05));
  mtag(RR, -3.6, 5.6, 0, 'ptr'); sm('R =', -4.8, 5.6);
}, [
  async (tok, S) => {
    cap('R 裡的數字是從哪裡來的？', '把 a、b、c 和 q₁、q₂、q₃ 標上去');
  },
  async (tok, S) => {
    cap('矩陣乘法：A 的第 1 行 = Q × R 的第 1 行', 'R 的每一行 = 組合係數');
  },
  ...[[0, 'a', C.a, 'a = 1·q₁ + 0·q₂ + 0·q₃'], [1, 'b', C.b, 'b = 2q₁ + 3q₂ + 0·q₃'], [2, 'c', C.c, 'c = 4q₁ + 6q₂ + 5q₃']].map(([j, nm, col, txtc]) => async (tok, S) => {
    const coefs = RR.map((r) => r[j]); let cur = [0, 0, 0]; const parts = [];
    cap(txtc, 'R 的第 ' + (j + 1) + ' 行 = (' + coefs.join(', ') + ')');
    for (let k = 0; k < 3; k++) { if (!coefs[k]) continue; const nx = add(cur, mul(coefs[k], S.q[k])); parts.push(await gv(tok, S.sp, mul(coefs[k], S.q[k]), col, coefs[k] + 'q' + sub3(k + 1), 'idx', cur, 0.035, 400)); cur = nx; }
    S['v' + j] = av(S.sp, cur, col, nm, 'ptr alt', [0, 0, 0], 0.06);
    S['k' + j] = ok(same(cur, [RA, RB, RC][j]), 3.2, 6.2 - j * 0.6, nm + ' = Q × (R 的第 ' + (j + 1) + ' 行) ✓');
    S['p' + j] = parts;
  }),
  async (tok, S) => {
    cap('回頭看：a = 1·q₁', 'a 本來就是單位向量：1 = ‖a‖');
    gone(S.p0, S.p1, S.p2); await flash(tok, S.v0, 2);
  },
  async (tok, S) => {
    cap('b = 2q₁ + 3q₂：2 = b·q₁，3 = ‖q₂′‖', 'q₂′ = 3q₂');
    await flash(tok, S.v1, 2);
    S.kb = ok(dot(RB, [1, 0, 0]) === 2 && norm(sub(RB, [2, 0, 0])) === 3, -3.6, 4.0, 'b·q₁ = 2、‖q₂′‖ = 3 ✓');
  },
  async (tok, S) => {
    cap('c = 4q₁ + 6q₂ + 5q₃：4 = c·q₁、6 = c·q₂、5 = ‖q₃′‖', 'q₃′ = 5q₃');
    await flash(tok, S.v2, 2);
    S.kc = ok(dot(RC, [1, 0, 0]) === 4 && dot(RC, [0, 0, 1]) === 6 && norm([0, 5, 0]) === 5, -3.6, 3.4, 'c·q₁ = 4、c·q₂ = 6、‖q₃′‖ = 5 ✓');
  },
  async (tok, S) => {
    cap('R 的對角線 = 每一步減完後剩下的長度', '對角線以上 = 內積 qᵢ·aⱼ');
  },
]);

// ════════ L14（YzZUIYRCE38）：Orthogonal vectors and subspaces ════════
function rankOf(M) { const A = M.map((r) => r.slice()); let r = 0; const m = A.length, n = A[0].length; for (let c = 0; c < n && r < m; c++) { let p = -1; for (let i = r; i < m; i++) if (Math.abs(A[i][c]) > 1e-9) { p = i; break; } if (p < 0) continue; [A[r], A[p]] = [A[p], A[r]]; for (let i = 0; i < m; i++) if (i !== r) { const f = A[i][c] / A[r][c]; for (let j = c; j < n; j++) A[i][j] -= f * A[r][j]; } r++; } return r; }
const A14 = [[1, 2, 5], [2, 4, 10]];            // 老師在 L14 用的 rank-1 例子
scene('or-l14-big', 'L14：四個子空間的大圖：兩對互相垂直', [[0.4, 4.6, 12.4], [0.4, 2.8, 0]], async (tok, S) => {
  S.sp = space3(0.9, V3(-3.4, 2.4, 0), 2.0);
  S.P = board2(3.4, 2.6, 0.75, [-2.4, 2.4], [-2.4, 2.4]);
  S.r = unit(A14[0]); S.n1 = unit([-2, 1, 0]); S.n2 = unit(cross(S.r, S.n1));
}, [
  async (tok, S) => {
    cap('18.06 的大圖：Rⁿ、Rᵐ 裡各有兩個子空間', '用 A = [1 2 5; 2 4 10] 示意（n = 3、m = 2）');
    hd('Rⁿ（n = 3）', -3.4, 5.6); hd('Rᵐ（m = 2）', 3.4, 5.0); sy(0, 6.4);
    S.row = rod(C.a, 0.035).set(S.sp.W(mul(-1.8, S.r)), S.sp.W(mul(1.8, S.r)));
    S.nul = span2(S.sp, S.n1, S.n2, 1.4, C.b, 0.2);
    S.col = rod(C.p, 0.035).set(W2(S.P, mul(-1.1, [1, 2])), W2(S.P, mul(1.1, [1, 2])));
    S.lnl = rod(C.e, 0.035).set(W2(S.P, mul(-1, [2, -1])), W2(S.P, mul(1, [2, -1])));
  },
  async (tok, S) => {
    const r = rankOf(A14);
    cap('row space 維度 r，null space 維度 n − r', 'r = ' + r + '，n − r = ' + (3 - r));
    S.l1 = sm('row space：dim ' + r, -5.6, 4.6); S.l2 = sm('null space：dim ' + (3 - r), -5.6, 0.3);
  },
  async (tok, S) => {
    const r = rankOf(A14);
    cap('column space 維度 r，N(Aᵀ) 維度 m − r', 'r = ' + r + '，m − r = ' + (2 - r));
    S.l3 = sm('column space：dim ' + r, 3.4, 4.4); S.l4 = sm('N(Aᵀ)：dim ' + (2 - r), 3.4, 0.6);
  },
  async (tok, S) => {
    cap('新的事實：row space 和 null space 夾 90°', '');
    S.ra = rightAngle(S.sp.O, S.sp.D(S.r), S.sp.D(S.n1), 0.3);
    S.k1 = ok(Z(dot(A14[0], [-2, 1, 0])) && Z(dot(A14[0], [-5, 0, 1])), -3.4, -0.4, 'row ⟂ null ✓');
  },
  async (tok, S) => {
    cap('column space 和 left null space 也夾 90°', '');
    S.rb = rightAngle(S.P(0, 0), W2(S.P, [1, 2]).sub(S.P(0, 0)), W2(S.P, [2, -1]).sub(S.P(0, 0)), 0.3);
    S.k2 = ok(Z(dot([1, 2], [2, -1])) && isZ(mv(tr(A14), [2, -1])), 3.4, -0.2, 'C(A) ⟂ N(Aᵀ) ✓');
  },
  async (tok, S) => {
    cap('以前會算 basis，現在多知道它們互相垂直', '理解四個子空間的重要一步');
  },
]);

scene('or-l14-pyth', 'L14：正交向量：xᵀy = 0 與畢氏定理', CAM3, async (tok, S) => {
  S.sp = space3(0.55, V3(0, 2.2, 0), 2.6);
  S.x = [1, 2, 3]; S.y = [2, -1, 0];
}, [
  async (tok, S) => {
    cap('orthogonal = perpendicular：夾角 90°', '在 n 維空間也一樣');
    S.X = await gv(tok, S.sp, S.x, C.a, 'x'); S.Y = await gv(tok, S.sp, S.y, C.b, 'y', 'ptr alt');
    S.ra = rightAngle(S.sp.O, S.sp.D(S.x), S.sp.D(S.y), 0.25);
  },
  async (tok, S) => {
    cap('x、y 和 x + y 形成直角三角形', 'x + y 是斜邊');
    S.Y2 = await gv(tok, S.sp, S.y, C.b, '', 'idx', S.x, 0.03, 500);
    S.H = await gv(tok, S.sp, add(S.x, S.y), C.p, 'x + y', '', [0, 0, 0], 0.05, 600);
  },
  async (tok, S) => {
    cap('古希臘人：畢氏定理', '');
    S.t0 = hd('Pythagoras', -4.4, 6.6);
  },
  async (tok, S) => {
    cap('垂直的檢驗：內積 xᵀy = 0', 'xᵀy = x₁y₁ + x₂y₂ + … + xₙyₙ');
    S.t1 = mono(hot('xᵀy = x₁y₁ + x₂y₂ + x₃y₃ = 0 ?', -3.6, 6.0));
  },
  async (tok, S) => {
    cap('畢氏定理：‖x‖² + ‖y‖² = ‖x + y‖²', '');
    S.t2 = mono(hd('‖x‖² + ‖y‖² = ‖x + y‖²', -3.6, 5.4));
  },
  async (tok, S) => {
    cap('注意：只有直角三角形才成立', '其他三角形不成立');
  },
  async (tok, S) => {
    cap('長度平方怎麼算？例：x = (1, 2, 3)', '');
    S.X.label('x = (1, 2, 3)');
  },
  async (tok, S) => {
    cap('‖x‖² = xᵀx = 1 + 4 + 9 = ' + dot(S.x, S.x), 'xᵀx 一定 ≥ 0，只有零向量是 0');
    S.k1 = ok(dot(S.x, S.x) === 14, 3.6, 6.2, '‖x‖² = 14 ✓');
  },
  async (tok, S) => {
    cap('做一個和 x 垂直的 y = (2, −1, 0)', '‖y‖² = 4 + 1 + 0 = ' + dot(S.y, S.y));
    S.Y.label('y = (2, −1, 0)', 'ptr alt');
    S.k2 = ok(dot(S.y, S.y) === 5, 3.6, 5.6, '‖y‖² = 5 ✓');
  },
  async (tok, S) => {
    const s = add(S.x, S.y);
    cap('x + y = ' + vv(s), '‖x + y‖² = 9 + 1 + 9 = ' + dot(s, s));
    S.H.label('x + y = ' + vv(s));
    S.k3 = ok(dot(s, s) === 19, 3.6, 5.0, '‖x + y‖² = 19 ✓');
  },
  async (tok, S) => {
    cap('xᵀy = 2 − 2 + 0 = 0，而且 14 + 5 = 19', '檢驗和畢氏定理對得上');
    S.k4 = ok(Z(dot(S.x, S.y)) && dot(S.x, S.x) + dot(S.y, S.y) === dot(add(S.x, S.y), add(S.x, S.y)), 3.6, 4.4, 'xᵀy = 0，14 + 5 = 19 ✓');
  },
  async (tok, S) => {
    cap('換成字母：xᵀx + yᵀy = (x + y)ᵀ(x + y)', '');
    gone(S.t2); S.t2 = mono(hd('xᵀx + yᵀy = (x+y)ᵀ(x+y)', -3.6, 5.4));
  },
  async (tok, S) => {
    cap('右邊展開：xᵀx + xᵀy + yᵀx + yᵀy', '矩陣乘法照規則展開');
    S.t3 = mono(pl('(x+y)ᵀ(x+y) = xᵀx + xᵀy + yᵀx + yᵀy', -3.6, 4.8));
  },
  async (tok, S) => {
    cap('xᵀx 和 yᵀy 兩邊消掉', '剩下 0 = xᵀy + yᵀx');
    S.t4 = mono(pl('0 = xᵀy + yᵀx', -3.6, 4.2));
  },
  async (tok, S) => {
    cap('實數向量：xᵀy = yᵀx', '所以 2xᵀy = 0 ⇒ xᵀy = 0');
    S.t5 = mono(hot('2xᵀy = 0  ⇒  xᵀy = 0', -3.6, 3.6));
    S.k5 = ok(dot(S.x, S.y) === dot(S.y, S.x), -3.6, 3.0, 'xᵀy = yᵀx ✓');
  },
  async (tok, S) => {
    cap('結論：正交向量的內積是 0', '畢氏定理 ⇔ xᵀy = 0');
  },
  async (tok, S) => {
    cap('零向量呢？0ᵀy = 0', '零向量和每個向量都正交');
    gone(S.k1, S.k2, S.k3, S.k4);
    S.z = dotAt(S.sp.O, C.gold, 0.14); S.zl = sm('0', S.sp.O.x - 0.4, S.sp.O.y - 0.3);
  },
]);

scene('or-l14-subsp', 'L14：兩個子空間正交是什麼意思？', [[5.6, 5.6, 9.4], [0.3, 2.4, 0]], async (tok, S) => {
  S.sp = space3(1.0, V3(0, 2.0, 0), 2.6);
}, [
  async (tok, S) => {
    cap('定義：子空間 S 和子空間 T 正交', '');
    S.d = mono(hd('S ⟂ T 的意思是？', -4.0, 6.6));
  },
  async (tok, S) => {
    cap('例子：黑板（延伸到無限遠）是一個平面', '三維空間裡的二維子空間');
    S.bd = quad(S.sp.O, S.sp.D([2.2, 0, 0]), S.sp.D([0, 0, 2.2]), C.a, 0.2); S.bl = hd('黑板', S.sp.W([-2, 0, 2]).x, S.sp.W([-2, 0, 2]).y);
  },
  async (tok, S) => {
    cap('地板是另一個平面；原點放在牆角', '');
    S.fl = quad(S.sp.O, S.sp.D([2.2, 0, 0]), S.sp.D([0, 2.2, 0]), C.b, 0.2); S.fll = hot('地板', S.sp.W([2, 2, 0]).x, S.sp.W([2, 2, 0]).y);
    S.o = dotAt(S.sp.O, C.gold, 0.1);
  },
  async (tok, S) => {
    cap('定義：S 裡每個向量都垂直 T 裡每個向量', '');
    txt(S.d, 'S ⟂ T：S 的每個 v 都 ⟂ T 的每個 w');
  },
  async (tok, S) => {
    cap('黑板和地板正交嗎？', '直覺說是，但照定義檢查看看');
  },
  async (tok, S) => {
    const v = [1, 0, 1], w = [1, 1, 0];
    cap('不是！黑板上 45° 的向量和地板上的向量', '內積 = ' + dot(v, w) + ' ≠ 0');
    S.v = await gv(tok, S.sp, v, C.a, 'v（黑板上）'); S.w = await gv(tok, S.sp, w, C.b, 'w（地板上）', 'ptr alt');
    S.k = ok(!Z(dot(v, w)), -4.0, 6.0, 'vᵀw = 1 ≠ 0 → 不正交 ✓');
  },
  async (tok, S) => {
    cap('更糟：交線（牆角那條縫）同時在兩個平面上', '它不會垂直自己');
    gone(S.v, S.w);
    S.cr = rod(C.e, 0.05).set(S.sp.W([-2.2, 0, 0]), S.sp.W([2.2, 0, 0]));
    S.u = await gv(tok, S.sp, [1.6, 0, 0], C.e, 'u（兩邊都有）', '');
    S.k2 = ok(dot([1, 0, 0], [1, 0, 0]) !== 0, -4.0, 5.4, 'uᵀu ≠ 0 ✓');
  },
  async (tok, S) => {
    cap('正交的子空間只會在 0 相交', '光是不相交還不夠');
    await anim(tok, 900, (t) => { S.bd.material.opacity = 0.2 * (1 - t) + 0.05; S.fl.material.opacity = 0.2 * (1 - t) + 0.05; });
  },
  async (tok, S) => {
    fresh([0, 3.0, 10], [0, 2.8, 0]);
    S.P = board2(0, 2.8, 1.0, [-3, 3], [-2.6, 2.6]);
    cap('R² 的子空間：{0}、過原點的直線、整個平面', '');
    S.o = dotAt(S.P(0, 0), C.gold, 0.12);
    S.L = rod(C.a, 0.04).set(S.P(-2.6, -1.3), S.P(2.6, 1.3));
  },
  async (tok, S) => {
    cap('直線 vs 整個平面：永遠不正交', '直線在平面裡面');
    S.n1 = tag('直線 ⟂ R²？✘ 永遠不會', 'bad', -3.6, 5.8);
  },
  async (tok, S) => {
    cap('直線 vs {0}：永遠正交', '0 和誰都正交');
    S.n2 = tag('直線 ⟂ {0}？✓ 永遠是', 'good', -3.6, 5.2);
  },
  async (tok, S) => {
    cap('兩條直線：要剛好夾 90°', '只在 0 相交，而且互相垂直');
    S.L2 = rod(C.b, 0.04).set(S.P(1.2, -2.4), S.P(-1.2, 2.4));
    S.ra = rightAngle(S.P(0, 0), S.P(2, 1).sub(S.P(0, 0)), S.P(-1, 2).sub(S.P(0, 0)), 0.3);
    S.n3 = ok(Z(dot([2, 1], [-1, 2])), -3.6, 4.6, '(2, 1)·(−1, 2) = 0 ✓');
  },
]);

const A14b = [[1, 2, 2], [2, -1, 0]];          // 示意：兩列獨立 → row space 是平面
scene('or-l14-rownull', 'L14：row space ⟂ null space（從 Ax = 0 直接看出來）', CAM3, async (tok, S) => {
  S.sp = space3(0.7, V3(0, 2.4, 0), 2.4);
  S.nv = cross(A14b[0], A14b[1]);                // (2, 4, −5)
  sy(-4.6, 6.8);
}, [
  async (tok, S) => {
    cap('定理：row space 和 null space 正交', '示意 A = [1 2 2; 2 −1 0]');
    S.m = mtag(A14b, -3.6, 6.0, 0, 'ptr'); S.mn = sm('A =', -4.9, 6.0);
    S.rp = span2(S.sp, A14b[0], A14b[1], 2.0, C.a, 0.18); S.rpl = hd('row space', 3.2, 1.0);
    S.nl = rod(C.b, 0.04).set(S.sp.W(mul(-0.35, S.nv)), S.sp.W(mul(0.35, S.nv))); S.nll = hot('null space', S.sp.W(mul(0.38, S.nv)).x + 0.8, S.sp.W(mul(0.38, S.nv)).y);
  },
  async (tok, S) => {
    const r = rankOf(A14b);
    cap('它們把空間切成兩個互相垂直的子空間', 'dim ' + r + ' + dim ' + (3 - r) + ' = 3');
    S.k0 = ok(r + 1 === 3, -3.6, 4.8, 'r + (n − r) = ' + r + ' + ' + (3 - r) + ' = 3 ✓');
  },
  async (tok, S) => {
    cap('null space 只知道一件事：Ax = 0', '');
    S.X = await gv(tok, S.sp, mul(0.3, S.nv), C.b, 'x', 'ptr alt');
    S.k1 = ok(isZ(mv(A14b, S.nv)), -3.6, 4.2, 'A·' + vv(S.nv) + ' = 0 ✓');
  },
  async (tok, S) => {
    cap('把 A 寫成一列一列', '[row 1; row 2] x = [0; 0]');
    S.r1 = av(S.sp, A14b[0], C.a, 'row 1'); S.r2 = av(S.sp, A14b[1], C.a, 'row 2');
    S.eq = mono(hd('[ row 1 ] x   [ 0 ]\n[ row 2 ]   = [ 0 ]', 3.4, 6.2));
  },
  async (tok, S) => {
    cap('row 1 · x = 0 → x 垂直第一列', '「列乘 x」就是內積');
    S.a1 = rightAngle(S.sp.O, S.sp.D(A14b[0]), S.sp.D(S.nv), 0.25); await flash(tok, S.r1, 2);
    S.k2 = ok(Z(dot(A14b[0], S.nv)), 3.4, 4.8, 'row 1 · x = 0 ✓');
  },
  async (tok, S) => {
    cap('row 2 · x = 0 → x 也垂直第二列', '每一列都一樣');
    S.a2 = rightAngle(S.sp.O, S.sp.D(A14b[1]), S.sp.D(S.nv), 0.25); await flash(tok, S.r2, 2);
    S.k3 = ok(Z(dot(A14b[1], S.nv)), 3.4, 4.2, 'row 2 · x = 0 ✓');
  },
  async (tok, S) => {
    cap('row space 不只有各列，還有它們的組合', '要檢查每個組合 c₁row₁ + c₂row₂');
  },
  async (tok, S) => {
    cap('(c₁row₁ + c₂row₂)ᵀx = c₁·0 + c₂·0 = 0', '');
    S.c = vec(C.p, 0.05); let cur = A14b[0]; let allZ = true;
    for (const [c1, c2] of [[1, 1], [-0.6, 1.2], [1.3, -0.4]]) { const tgt = add(mul(c1, A14b[0]), mul(c2, A14b[1])), from = cur; await anim(tok, 600, (t) => S.c.set(S.sp.O, S.sp.W(lerpV(from, tgt, t)))); cur = tgt; if (!Z(dot(tgt, S.nv))) allZ = false; }
    S.c.label('c₁row₁ + c₂row₂', '');
    S.k4 = ok(allZ, 3.4, 3.6, '每個組合 · x = 0 ✓');
  },
  async (tok, S) => {
    cap('回到大圖：現在知道子空間的方向了', '');
    gone(S.c, S.r1, S.r2);
  },
  async (tok, S) => {
    cap('同樣道理用在 Aᵀ：column space ⟂ N(Aᵀ)', 'Aᵀ 也是一個矩陣，證明一樣');
  },
  async (tok, S) => {
    cap('Rⁿ 切成 row space 和 null space', 'Rᵐ 切成 column space 和 N(Aᵀ)');
  },
]);

scene('or-l14-compl', 'L14：orthogonal complement：維度加起來是 n', CAM3, async (tok, S) => {
  S.sp = space3(0.75, V3(0, 2.4, 0), 2.4);
  S.r = A14[0]; S.s1 = [-2, 1, 0]; S.s2 = [-5, 0, 1];
}, [
  async (tok, S) => {
    cap('R³ 裡兩條互相垂直的直線', '它們會是 row space 和 null space 嗎？');
    S.l1 = rod(C.a, 0.035).set(S.sp.W([-2, 0, 0]), S.sp.W([2, 0, 0])); S.l2 = rod(C.b, 0.035).set(S.sp.W([0, -2, 0]), S.sp.W([0, 2, 0]));
    S.n = sy(-4.4, 6.6);
  },
  async (tok, S) => {
    cap('不行：維度要加起來 = n = 3', '1 + 1 ≠ 3');
    S.k0 = tag('dim 1 + dim 1 = 2 ≠ 3 ✘', 'bad', -4.4, 6.0);
  },
  async (tok, S) => {
    gone(S.l1, S.l2, S.n, S.k0);
    cap('Strang 的例子：A = [1 2 5; 2 4 10]', '');
    S.m = mtag(A14, -3.6, 5.4, 0, 'ptr'); S.mn = sm('A =', -4.9, 5.4);
  },
  async (tok, S) => {
    const r = rankOf(A14);
    cap('rank = ' + r + '：row space 是過 (1, 2, 5) 的直線', '');
    S.row = rod(C.a, 0.035).set(S.sp.W(mul(-0.55, S.r)), S.sp.W(mul(0.6, S.r)));
    S.R = await gv(tok, S.sp, mul(0.5, S.r), C.a, '(1, 2, 5)');
    S.k1 = ok(r === 1, 3.6, 6.4, 'rank A = 1 ✓');
  },
  async (tok, S) => {
    cap('null space 維度 = 3 − 1 = 2：一個平面', '');
    S.pl = span2(S.sp, S.s1, S.s2, 2.2, C.b, 0.18);
    S.N1 = av(S.sp, S.s1, C.b, '(−2, 1, 0)', 'idx'); S.N2 = av(S.sp, mul(0.5, S.s2), C.b, '(−5, 0, 1)/2', 'idx');
    S.k2 = ok(isZ(mv(A14, S.s1)) && isZ(mv(A14, S.s2)), 3.6, 5.8, 'A·(−2,1,0) = A·(−5,0,1) = 0 ✓');
  },
  async (tok, S) => {
    cap('是哪個平面？垂直 (1, 2, 5) 的那個', '');
    S.ra = rightAngle(S.sp.O, S.sp.D(S.r), S.sp.D(S.s1), 0.25);
    S.k3 = ok(Z(dot(S.r, S.s1)) && Z(dot(S.r, S.s2)), 3.6, 5.2, '(1,2,5) ⟂ 整個平面 ✓');
  },
  async (tok, S) => {
    cap('(2, 4, 10) 完全沒有影響', '只剩一個方程：x₁ + 2x₂ + 5x₃ = 0');
    S.e = mono(hd('x₁ + 2x₂ + 5x₃ = 0', -3.6, 4.4));
    S.k4 = ok(same(A14[1], mul(2, A14[0])), -3.6, 3.8, 'row 2 = 2 × row 1 ✓');
  },
  async (tok, S) => {
    cap('微積分的「法向量」n：就是 (1, 2, 5)', '');
    S.R.label('n = (1, 2, 5)（法向量）'); await flash(tok, S.R, 2);
  },
  async (tok, S) => {
    cap('null space ⟂ row space，維度加起來 = 3', '1 + 2 = 3');
    S.k5 = ok(rankOf(A14) + 2 === 3, -3.6, 3.2, 'dim 1 + dim 2 = 3 ✓');
  },
  async (tok, S) => {
    cap('orthogonal complement：「所有」垂直的向量', 'null space 含有所有垂直 row space 的向量');
    S.t = mono(hot('N(A) = (row space)^⟂', -3.6, 2.6));
  },
  async (tok, S) => {
    cap('線性代數基本定理第二部分：正交', '第一部分：維度；第三部分：orthogonal basis');
  },
]);

scene('or-l14-noisy', 'L14：Ax = b 無解時，還是要「解」', CAMB, async (tok, S) => {
  S.P = board2(1.6, 1.2, 0.75, [-0.5, 6.5], [-0.5, 6.5]);
}, [
  async (tok, S) => {
    cap('這章的主要問題：Ax = b 沒有解的時候', '');
    S.t1 = mono(hd('「解」Ax = b，但它無解', -5.4, 6.4));
  },
  async (tok, S) => {
    cap('也就是 b 不在 column space 裡', '');
    S.t2 = sm('b ∉ C(A)', -5.4, 5.8);
  },
  async (tok, S) => {
    cap('m 個方程 > n 個未知數：rank 不可能是 m', '很多 b 沒有解');
    S.t3 = sm('m > n ⇒ rank ≤ n < m', -5.4, 5.2);
  },
  async (tok, S) => {
    cap('例：追衛星，量一千次位置', '一千個方程，但只有大約六個參數');
    S.sat = sm('1000 個方程、6 個未知數', -5.4, 4.4);
  },
  async (tok, S) => {
    cap('量脈搏：只有一個未知數，量好幾次', '每次量都有雜訊（示意數字）');
    S.ms = [72, 75, 70, 74];
    S.dots = S.ms.map((v, k) => dotAt(S.P(1 + k * 1.4, (v - 66) / 2), C.b, 0.12));
    S.lb = S.ms.map((v, k) => sm(String(v), S.P(1 + k * 1.4, 0).x, S.P(0, (v - 66) / 2).y + 0.4));
    S.n = sy(1.6, 6.8);
    S.eq = mono(pl('x = 72\nx = 75\nx = 70\nx = 74', -5.4, 2.4));
  },
  async (tok, S) => {
    const mean = S.ms.reduce((a, b) => a + b, 0) / S.ms.length;
    cap('把雜訊和資訊分開', '四個方程一起看 → 最好的 x̂ = ' + mean + '（平均）');
    S.L = rod(C.p, 0.04).set(S.P(0.3, (mean - 66) / 2), S.P(6.2, (mean - 66) / 2));
    S.k = ok(Math.abs(mean - 72.75) < 1e-9, 1.6, 0.2, 'x̂ = Aᵀb / AᵀA = 291/4 = 72.75 ✓');
  },
  async (tok, S) => {
    cap('丟掉方程直到剩下方陣？不好', '憑什麼說某幾次量測完美、其他沒用？');
    S.dots.slice(1).forEach((d) => { d.material.transparent = true; d.material.opacity = 0.3; });
  },
  async (tok, S) => {
    cap('要用上全部的量測，拿到最多資訊', '');
    S.dots.forEach((d) => { d.material.opacity = 1; });
  },
  async (tok, S) => {
    cap('消去法只會得到「0 = 非零」', '告訴你無解，但不給最好的答案');
    S.z = mono(tag('0 = 3  ✘（示意）', 'bad', -5.4, 1.0));
  },
]);

scene('or-l14-ata', 'L14：關鍵矩陣 AᵀA', CAMB, null, [
  async (tok, S) => {
    cap('這章要搞懂的關鍵矩陣：AᵀA', '');
    S.t = mono(hd('AᵀA', 0, 6.6));
  },
  async (tok, S) => {
    cap('AᵀA 是方陣：(n×m)(m×n) = n×n', '');
    const box = (w, h, x, col, t) => { const m = cube('', col, [w * 0.5, h * 0.5, 0.3], x, 4.0, 0); sm(t, x, 4.0 + h * 0.25 + 0.4); return m; };
    S.b1 = box(3, 2, -4.2, C.a, 'Aᵀ（n×m）'); S.b2 = box(2, 3, -1.8, C.b, 'A（m×n）'); S.b3 = box(2, 2, 1.8, C.p, 'AᵀA（n×n）');
    sm('×', -3.0, 4.0); sm('=', 0.2, 4.0);
  },
  async (tok, S) => {
    const A = [[1, 1], [1, 2], [1, 5]], G = mm(tr(A), A);
    cap('AᵀA 是對稱的：(AᵀA)ᵀ = AᵀA', '轉置時順序反過來，Aᵀᵀ = A');
    S.s = mono(pl('(AᵀA)ᵀ = Aᵀ(Aᵀ)ᵀ = AᵀA', 0, 2.2));
    S.k = ok(sameM(G, tr(G)), 0, 1.5, '例：A = [1 1; 1 2; 1 5] → AᵀA = ' + ms(G) + ' 對稱 ✓');
  },
  async (tok, S) => {
    cap('想問：AᵀA 可逆嗎？null space 是什麼？', '');
  },
  async (tok, S) => {
    cap('Ax = b 兩邊乘上 Aᵀ', 'AᵀA x = Aᵀb：這章的中心方程');
    S.e = mono(hot('AᵀA x̂ = Aᵀb', 0, 0.6));
  },
  async (tok, S) => {
    cap('x 改名叫 x̂（x hat）：最好的解', '原本的 x 可能不存在；x̂ 希望有解');
  },
]);

scene('or-l14-ataex', 'L14：AᵀA 什麼時候可逆？', [[1.0, 4.4, 12.6], [1.0, 3.0, 0]], async (tok, S) => {
  S.sp = space3(0.45, V3(-3.6, 2.0, 0), 2.2);
  S.A = [[1, 1], [1, 2], [1, 5]];
}, [
  async (tok, S) => {
    cap('例：A = [1 1; 1 2; 1 5]', '');
    S.m = mtag(S.A, 1.6, 6.0, 0, 'ptr'); S.mn = sm('A =', 0.3, 6.0);
  },
  async (tok, S) => {
    const r = rankOf(S.A);
    cap('m = 3 列、n = 2 行，rank = ' + r, 'columns 獨立');
    S.k0 = ok(r === 2, 4.0, 6.0, 'rank 2 ✓');
  },
  async (tok, S) => {
    cap('Ax = b：三個方程、兩個未知數', '通常解不出來');
  },
  async (tok, S) => {
    cap('只有 b 在 column space 上才有解', 'column space 是一個平面，大部分 b 不在上面');
    S.pl = span2(S.sp, tr(S.A)[0], tr(S.A)[1], 2.8, C.a, 0.18);
    S.c1 = av(S.sp, tr(S.A)[0], C.a, '(1,1,1)', 'idx'); S.c2 = av(S.sp, tr(S.A)[1], C.a, '(1,2,5)', 'idx');
    S.b = await gv(tok, S.sp, [4, -1, 1], C.b, 'b（示意）', 'ptr alt');
    S.kb = ok(rankOf(tr([...tr(S.A), [4, -1, 1]])) === 3, -3.6, 5.6, 'b 不在平面上 ✓');
  },
  async (tok, S) => {
    const G = mm(tr(S.A), S.A);
    cap('AᵀA = ' + ms(G), '3 = 1+1+1、8 = 1+2+5、30 = 1+4+25');
    S.g = mtag(G, 1.6, 4.4, 0, 'ptr alt'); S.gn = sm('AᵀA =', 0.0, 4.4);
    S.k1 = ok(sameM(G, [[3, 8], [8, 30]]), 4.0, 4.4, '[3 8; 8 30] ✓');
  },
  async (tok, S) => {
    const G = mm(tr(S.A), S.A), d = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    cap('可逆：(3, 8) 不是 (8, 30) 的倍數', 'det = 90 − 64 = ' + d);
    S.k2 = ok(d !== 0, 4.0, 3.8, 'det = 26 ≠ 0 → 可逆 ✓');
  },
  async (tok, S) => {
    cap('但不能說 AᵀA 永遠可逆', '極端例子：A = 零矩陣');
  },
  async (tok, S) => {
    S.A2 = [[1, 3], [1, 3], [1, 3]]; const G = mm(tr(S.A2), S.A2);
    cap('換成 A = [1 3; 1 3; 1 3]', 'AᵀA = ' + ms(G));
    S.m2 = mtag(S.A2, 1.6, 2.4, 0, 'ptr'); sm('A =', 0.3, 2.4);
    S.g2 = mtag(G, 1.6, 0.9, 0, 'ptr alt'); sm('AᵀA =', 0.0, 0.9);
    S.k3 = ok(sameM(G, [[3, 9], [9, 27]]), 4.0, 0.9, '[3 9; 9 27] ✓');
  },
  async (tok, S) => {
    const G = mm(tr(S.A2), S.A2), d = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    cap('不可逆：A 只有 rank 1', '乘積的 rank 不會超過 1');
    S.k4 = ok(d === 0 && rankOf(S.A2) === 1, 4.0, 0.3, 'det = 81 − 81 = 0、rank 1 ✓');
  },
  async (tok, S) => {
    const G = mm(tr(S.A2), S.A2);
    cap('永遠成立：rank(AᵀA) = rank(A)', 'N(AᵀA) = N(A)');
    S.k5 = ok(rankOf(G) === rankOf(S.A2) && rankOf(mm(tr(S.A), S.A)) === rankOf(S.A) && isZ(mv(G, [3, -1])) && isZ(mv(S.A2, [3, -1])), -3.6, 6.4, 'rank 相等；(3, −1) 同在兩個 null space ✓');
  },
  async (tok, S) => {
    cap('結論：AᵀA 可逆 ⇔ A 的 columns 獨立', 'null space 只有 0');
    S.t = mono(hd('AᵀA 可逆 ⇔ N(A) = {0} ⇔ columns 獨立', 1.0, -0.6));
  },
  async (tok, S) => {
    cap('下一講：AᵀA 會出現在所有地方', '');
  },
]);

// ════════ L15（Y_Ac6KiQ1t0）：Projections onto subspaces ════════
const PA = [3, 1], PB = [2, 3];                  // 示意：投影到直線（老師沒給數字）
scene('or-l15-line', 'L15：把 b 投影到 a 這條線：x̂ = aᵀb / aᵀa', [[0.6, 3.2, 10.6], [0.6, 3.0, 0]], async (tok, S) => {
  S.P = board2(-1.5, 1.0, 1.2, [-0.8, 3.8], [-0.6, 3.6]);
  S.x = dot(PA, PB) / dot(PA, PA); S.p = mul(S.x, PA); S.e = sub(PB, S.p);
  sy(3.6, 5.6);
}, [
  async (tok, S) => {
    cap('把向量 b 投影到向量 a 上', '先在二維看清楚幾何');
    S.A = vec(C.a, 0.06); await growV(tok, S.A, S.P(0, 0), W2(S.P, PA)); S.A.label('a', 'ptr');
    S.B = vec(C.b, 0.06); await growV(tok, S.B, S.P(0, 0), W2(S.P, PB)); S.B.label('b', 'ptr alt');
  },
  async (tok, S) => {
    cap('過 a 的直線：一維子空間', '');
    S.L = rod(C.gray, 0.025).set(W2(S.P, mul(-0.25, PA)), W2(S.P, mul(1.25, PA)));
  },
  async (tok, S) => {
    cap('找直線上離 b 最近的點', '');
    S.d = dotAt(W2(S.P, mul(0.15, PA)), C.p, 0.09); S.dl = seg(W2(S.P, PB), S.d.position, '#6e5f49', true);
    const go = (k) => { S.d.position.copy(W2(S.P, mul(k, PA))); S.dl.setPts(W2(S.P, PB), S.d.position); };
    await anim(tok, 700, (t) => go(0.15 + 1.0 * t)); await anim(tok, 700, (t) => go(1.15 + (S.x - 1.15) * t));
  },
  async (tok, S) => {
    cap('這個最近的點就是投影 p', '');
    S.Pv = vec(C.p, 0.06); await growV(tok, S.Pv, S.P(0, 0), W2(S.P, S.p), 500); S.Pv.label('p', '');
  },
  async (tok, S) => {
    cap('正交在哪裡？誤差 e = b − p 垂直 a', '「差多少」的那段剛好成直角');
    S.E = vec(C.e, 0.045); await growV(tok, S.E, W2(S.P, S.p), W2(S.P, PB), 500); S.E.label('e = b − p', '');
    S.ra = rightAngle(W2(S.P, S.p), W2(S.P, mul(-1, PA)).sub(S.P(0, 0)), W2(S.P, S.e).sub(S.P(0, 0)), 0.2);
    S.k0 = ok(Z(dot(PA, S.e)), 3.6, 5.0, 'aᵀe = 0 ✓');
  },
  async (tok, S) => {
    cap('三角函數也能做（θ、sin、cos）', '但公式很醜；線性代數的公式漂亮多了');
    S.th = sm('θ', S.P(0.7, 0.55).x, S.P(0.7, 0.55).y);
  },
  async (tok, S) => {
    cap('p 在直線上：p 是 a 的某個倍數', 'p = x̂ a，要找的就是數字 x̂');
    S.f1 = mono(hd('p = x̂ a', -5.2, 6.0));
  },
  async (tok, S) => {
    cap('關鍵：a 垂直 e = b − x̂a', 'aᵀ(b − x̂ a) = 0');
    S.f2 = mono(hot('aᵀ(b − x̂ a) = 0', -5.2, 5.4));
  },
  async (tok, S) => {
    cap('整理：x̂ aᵀa = aᵀb', 'aᵀa 只是一個數字');
    S.f3 = mono(pl('x̂ aᵀa = aᵀb', -5.2, 4.8));
  },
  async (tok, S) => {
    cap('x̂ = aᵀb / aᵀa', '這裡 aᵀb = ' + dot(PA, PB) + '、aᵀa = ' + dot(PA, PA) + ' → x̂ = ' + frac(S.x));
    S.f4 = mono(hd('x̂ = aᵀb / aᵀa = ' + frac(S.x), -5.2, 4.2));
    S.k1 = ok(Z(dot(PA, sub(PB, mul(S.x, PA)))), -5.2, 3.6, '代回去 aᵀ(b − x̂a) = 0 ✓');
  },
  async (tok, S) => {
    cap('p = a x̂ = ' + vs(S.p, f2), '藏著 cos θ，但不用看角度');
    S.f5 = mono(hd('p = a x̂ = a (aᵀb / aᵀa)', -5.2, 3.0));
  },
  async (tok, S) => {
    cap('三個公式已經有兩個：x̂ 和 p', '第三個是投影矩陣 P');
  },
]);

const LA = [1, 2, 2], LB = [1, 1, 1];            // 課本例子（示意）
scene('or-l15-pline', 'L15：投影矩陣 P = aaᵀ / aᵀa', CAM3, async (tok, S) => {
  S.sp = space3(1.05, V3(0, 1.6, 0), 2.4);
  S.Pm = mm(LA.map((x) => [x]), [LA]).map((r) => r.map((x) => x / dot(LA, LA)));
  S.proj = (b) => mv(S.Pm, b);
  rod(C.gray, 0.02).set(S.sp.W(mul(-0.4, LA)), S.sp.W(mul(1.3, LA)));
  S.A = av(S.sp, LA, C.a, 'a = (1, 2, 2)'); sy(-4.6, 6.8);
  S.B = av(S.sp, LB, C.b, 'b = (1, 1, 1)', 'ptr alt');
}, [
  async (tok, S) => {
    const p = S.proj(LB);
    cap('p = a · (aᵀb / aᵀa)', 'b = (1, 1, 1)：aᵀb = 5、aᵀa = 9 → p = (5/9)a');
    S.p = await gv(tok, S.sp, p, C.p, 'p', '', [0, 0, 0], 0.065, 600);
    S.E = av(S.sp, sub(LB, p), C.e, 'e', '', p, 0.035);
    S.k0 = ok(Z(dot(LA, sub(LB, p))), -4.6, 6.2, 'aᵀe = 0 ✓');
  },
  async (tok, S) => {
    const p2 = S.proj(mul(2, LB));
    cap('b 變兩倍 → p 也變兩倍', '');
    gone(S.E);
    await anim(tok, 900, (t) => { S.B.set(S.sp.O, S.sp.W(mul(1 + t, LB))); S.p.set(S.sp.O, S.sp.W(mul(1 + t, S.proj(LB)))); });
    S.k1 = ok(same(p2, mul(2, S.proj(LB))), -4.6, 5.6, 'P(2b) = 2p ✓');
    await anim(tok, 600, (t) => { S.B.set(S.sp.O, S.sp.W(mul(2 - t, LB))); S.p.set(S.sp.O, S.sp.W(mul(2 - t, S.proj(LB)))); });
  },
  async (tok, S) => {
    const a2 = mul(2, LA), p2 = mul(dot(a2, LB) / dot(a2, a2), a2);
    cap('a 變兩倍 → p 完全不變', '直線沒變；上面多 4、下面也多 4，消掉');
    await anim(tok, 900, (t) => S.A.set(S.sp.O, S.sp.W(mul(1 + t, LA))));
    S.k2 = ok(same(p2, S.proj(LB)), -4.6, 5.0, '投影到 2a：p 一樣 ✓');
    await anim(tok, 600, (t) => S.A.set(S.sp.O, S.sp.W(mul(2 - t, LA))));
  },
  async (tok, S) => {
    cap('投影是一個矩陣在作用：p = P b', 'P 叫投影矩陣');
    S.f = mono(hd('p = P b', 3.2, 6.6));
  },
  async (tok, S) => {
    cap('P = aaᵀ / aᵀa', '上面 aaᵀ、下面 aᵀa，不能約掉');
    S.m = mtag([[1, 2, 2], [2, 4, 4], [2, 4, 4]], 3.6, 5.6, 0, 'ptr'); S.mn = sm('P = 1/9 ×', 1.8, 5.6);
    S.k3 = ok(same(mv(S.Pm, LB), S.proj(LB)) && sameM(S.Pm.map((r) => r.map((x) => x * 9)), [[1, 2, 2], [2, 4, 4], [2, 4, 4]]), 3.6, 4.4, 'Pb = p ✓');
  },
  async (tok, S) => {
    cap('aᵀa 是數字；aaᵀ 是 column × row', '得到 n×n 的矩陣');
  },
  async (tok, S) => {
    cap('P 的 rank？column space？', 'column space = 乘上任何 b 會落在哪裡');
  },
  async (tok, S) => {
    const bs = [[1.4, -0.4, 0.6], [-0.2, 1.2, 1.6], [0.9, 0.6, -0.3]];
    cap('任何 b 乘上 P，都落到 a 這條線上', 'C(P) = 過 a 的直線');
    S.bs = bs.map((b) => vec(C.c, 0.03).set(S.sp.O, S.sp.W(b)));
    await anim(tok, 1200, (t) => S.bs.forEach((A, k) => A.set(S.sp.O, S.sp.W(lerpV(bs[k], S.proj(bs[k]), t)))));
    S.k4 = ok(bs.every((b) => Z(norm(cross(S.proj(b), LA)))), 3.6, 3.8, '每個 Pb 都和 a 共線 ✓');
  },
  async (tok, S) => {
    cap('rank = 1：column × row 的 rank-one 矩陣', 'a 就是 column space 的 basis');
    S.k5 = ok(rankOf(S.Pm) === 1, 3.6, 3.2, 'rank P = 1 ✓');
  },
  async (tok, S) => {
    cap('P 對稱：Pᵀ = P', '(aaᵀ)ᵀ = aaᵀ');
    S.k6 = ok(sameM(S.Pm, tr(S.Pm)), 3.6, 2.6, 'Pᵀ = P ✓');
  },
  async (tok, S) => {
    cap('投影兩次：第二次完全不動', 'P² = P');
    await flash(tok, S.p, 3);
    S.k7 = ok(sameM(mm(S.Pm, S.Pm), S.Pm), 3.6, 2.0, 'P² = P ✓');
  },
  async (tok, S) => {
    cap('對稱、平方等於自己：投影矩陣的兩個性質', '');
  },
  async (tok, S) => {
    cap('三個公式：x̂、p、P', 'x̂ = aᵀb/aᵀa，p = a x̂，P = aaᵀ/aᵀa');
    S.f3 = mono(pl('x̂ = aᵀb/aᵀa   p = a x̂   P = aaᵀ/aᵀa', 0, 0.2));
  },
]);

const TA = [[1, 0], [1, 1], [1, 2]], TB = [6, 0, 0];   // 課本例子（示意）
const TAt = tr(TA), Txh = mv(inv2(mm(TAt, TA)), mv(TAt, TB)), Tp = mv(TA, Txh), Te = sub(TB, Tp);
const planeSetup = (withB = true) => async (tok, S) => {
  S.sp = space3(0.5, V3(0, 2.9, 0), 3.2);
  if (withB) S.B = av(S.sp, TB, C.b, 'b', 'ptr alt');
};
scene('or-l15-why', 'L15：為什麼要投影：Ax = b 無解', [[5.6, 6.4, 9.6], [0.6, 2.9, 0]], planeSetup(false), [
  async (tok, S) => {
    cap('換到更高維：投影到平面或 n 維子空間', '');
    S.pl = span2(S.sp, TAt[0], TAt[1], 2.2, C.a, 0.17);
  },
  async (tok, S) => {
    cap('為什麼要投影？Ax = b 沒有解', '');
    S.f = mono(hd('Ax = b  無解', -4.4, 6.6)); S.n = sy(-4.4, 6.0);
  },
  async (tok, S) => {
    cap('通常是方程太多：比未知數還多', '');
  },
  async (tok, S) => {
    cap('Ax 一定在 column space 裡，b 大概不在', '');
    S.ax = [[1, 0.5], [2, -1], [-0.5, 1.5]].map((x) => vec(C.a, 0.03).set(S.sp.O, S.sp.W(mv(TA, x))));
    S.B = await gv(tok, S.sp, TB, C.b, 'b', 'ptr alt');
    S.k = ok(rankOf(tr([...TAt, TB])) === 3, -4.4, 5.4, 'b ∉ C(A) ✓');
  },
  async (tok, S) => {
    cap('改成 column space 裡最近的 p', '解 Ax̂ = p');
    gone(S.ax);
    S.dl = seg(S.sp.W(TB), S.sp.W(TB), '#6e5f49', true);
    await anim(tok, 900, (t) => S.dl.setPts(S.sp.W(TB), S.sp.W(lerpV(TB, Tp, t))));
    S.p = av(S.sp, Tp, C.p, 'p', '', [0, 0, 0], 0.06);
    txt(S.f, 'Ax̂ = p  有解');
  },
  async (tok, S) => {
    cap('x̂ 戴帽子：不是不存在的 x，是最好的 x̂', '');
  },
]);
scene('or-l15-plane', 'L15：投影到平面：e 垂直整個平面', [[5.6, 6.4, 9.6], [0.6, 2.9, 0]], planeSetup(false), [
  async (tok, S) => {
    cap('三維空間：一個平面和不在平面上的 b', 'A = [1 0; 1 1; 1 2]、b = (6, 0, 0)（課本例子）');
    S.pl = span2(S.sp, TAt[0], TAt[1], 2.2, C.a, 0.17); S.n = sy(-4.4, 6.6);
    S.B = await gv(tok, S.sp, TB, C.b, 'b', 'ptr alt');
  },
  async (tok, S) => {
    cap('把 b 往下投影到平面上', '要找平面上最近的點');
    S.dl = seg(S.sp.W(TB), S.sp.W(TB), '#6e5f49', true);
    await anim(tok, 1000, (t) => S.dl.setPts(S.sp.W(TB), S.sp.W(lerpV(TB, Tp, t))));
  },
  async (tok, S) => {
    cap('一樣，直角是關鍵', '');
  },
  async (tok, S) => {
    cap('平面用 basis 描述：a₁、a₂', 'a₁ = (1, 1, 1)、a₂ = (0, 1, 2)');
    S.a1 = await gv(tok, S.sp, TAt[0], C.a, 'a₁'); S.a2 = await gv(tok, S.sp, TAt[1], C.a, 'a₂');
  },
  async (tok, S) => {
    cap('a₁、a₂ 不必垂直，但要獨立', '');
    S.k0 = ok(!Z(dot(TAt[0], TAt[1])) && rankOf(TA) === 2, -4.4, 6.0, 'a₁ᵀa₂ = 3 ≠ 0、獨立 ✓');
  },
  async (tok, S) => {
    cap('這個平面就是 A = [a₁ a₂] 的 column space', '');
    S.m = mtag(TA, -3.6, 5.2, 0, 'ptr'); S.mn = sm('A =', -4.8, 5.2);
  },
  async (tok, S) => {
    cap('兩個 columns 或 n 個 columns，都一樣', '答案用矩陣 A 寫');
  },
  async (tok, S) => {
    cap('b 大概不在 column space；如果在，p 就是 b', '');
  },
  async (tok, S) => {
    cap('誤差 e = b − p，通常不是 0', '');
    S.p = av(S.sp, Tp, C.p, 'p', '', [0, 0, 0], 0.06);
    S.E = await gv(tok, S.sp, Te, C.e, 'e', '', Tp, 0.04, 500);
  },
  async (tok, S) => {
    cap('e 垂直整個平面', '幾何、微積分、線性代數都這麼說');
    S.ra = rightAngle(S.sp.W(Tp), S.sp.D(mul(-1, TAt[0])), S.sp.D(Te), 0.22);
  },
  async (tok, S) => {
    cap('p 是 columns 的組合：p = x̂₁a₁ + x̂₂a₂ = Ax̂', '');
    S.f = mono(hd('p = x̂₁a₁ + x̂₂a₂ = Ax̂', 3.4, 6.4));
  },
  async (tok, S) => {
    cap('問題：找出組合 x̂，讓 e 垂直平面', '');
  },
]);
scene('or-l15-normal', 'L15：Aᵀ(b − Ax̂) = 0 → AᵀAx̂ = Aᵀb', [[5.6, 6.4, 9.6], [0.6, 2.9, 0]], async (tok, S) => {
  await planeSetup(true)(tok, S);
  S.pl = span2(S.sp, TAt[0], TAt[1], 2.2, C.a, 0.17);
  S.a1 = av(S.sp, TAt[0], C.a, 'a₁'); S.a2 = av(S.sp, TAt[1], C.a, 'a₂');
  S.p = av(S.sp, Tp, C.p, 'p = Ax̂', '', [0, 0, 0], 0.06); S.E = av(S.sp, Te, C.e, 'e', '', Tp, 0.04);
}, [
  async (tok, S) => {
    cap('p = Ax̂，要找 x̂', '');
    S.f = [mono(hd('p = Ax̂', -4.6, 6.8))];
  },
  async (tok, S) => {
    cap('關鍵：b − Ax̂（就是 e）垂直平面', '');
    S.f.push(mono(hot('e = b − Ax̂ ⟂ 平面', -4.6, 6.2)));
  },
  async (tok, S) => {
    cap('兩個未知數 x̂₁、x̂₂ → 需要兩個方程', '');
  },
  async (tok, S) => {
    cap('垂直平面 = 垂直 a₁ 也垂直 a₂', '');
    S.r1 = rightAngle(S.sp.W(Tp), S.sp.D(TAt[0]), S.sp.D(Te), 0.22); S.r2 = rightAngle(S.sp.W(Tp), S.sp.D(TAt[1]), S.sp.D(Te), 0.22);
  },
  async (tok, S) => {
    cap('a₁ᵀ(b − Ax̂) = 0、a₂ᵀ(b − Ax̂) = 0', '');
    S.f.push(mono(pl('a₁ᵀ(b − Ax̂) = 0\na₂ᵀ(b − Ax̂) = 0', -4.6, 5.4)));
    S.k0 = ok(Z(dot(TAt[0], Te)) && Z(dot(TAt[1], Te)), 3.6, 6.4, 'a₁ᵀe = a₂ᵀe = 0 ✓');
  },
  async (tok, S) => {
    cap('寫成矩陣：Aᵀ(b − Ax̂) = 0', 'Aᵀ 的 rows 就是 a₁ᵀ、a₂ᵀ');
    S.f.push(mono(hd('Aᵀ(b − Ax̂) = 0', -4.6, 4.5)));
  },
  async (tok, S) => {
    cap('一維的情形：A 只有一個 column a', '就是之前的 aᵀe = 0');
  },
  async (tok, S) => {
    cap('e 在哪個子空間？Aᵀe = 0 → e ∈ N(Aᵀ)', '');
    S.f.push(mono(hot('e ∈ N(Aᵀ)', -4.6, 3.9)));
    S.k1 = ok(isZ(mv(TAt, Te)), 3.6, 5.8, 'Aᵀe = 0 ✓');
  },
  async (tok, S) => {
    cap('上一講：N(Aᵀ) ⟂ column space', '所以 e ⟂ C(A)，完全吻合');
  },
  async (tok, S) => {
    const G = mm(TAt, TA), r = mv(TAt, TB);
    cap('整理：AᵀA x̂ = Aᵀb', '這裡：' + ms(G) + ' x̂ = ' + vv(r));
    S.f.push(mono(hd('AᵀA x̂ = Aᵀb', -4.6, 3.2)));
    S.k2 = ok(same(mv(G, Txh), r), 3.6, 5.2, ms(G) + ' (5, −3) = (6, 0) ✓');
  },
  async (tok, S) => {
    cap('一維時 aᵀa 是數字，x̂ 是比值', '現在 AᵀA 是 n×n 矩陣');
  },
]);
scene('or-l15-formulas', 'L15：三個公式：x̂、p、P = A(AᵀA)⁻¹Aᵀ', [[5.6, 6.4, 9.6], [0.6, 2.9, 0]], async (tok, S) => {
  await planeSetup(true)(tok, S);
  S.pl = span2(S.sp, TAt[0], TAt[1], 2.2, C.a, 0.17);
  S.Pm = projM(TA);
}, [
  async (tok, S) => {
    cap('x̂ = (AᵀA)⁻¹Aᵀb', 'x̂ = ' + vv(Txh));
    S.f1 = mono(hd('x̂ = (AᵀA)⁻¹Aᵀb = ' + vv(Txh), -4.4, 6.8));
    S.k1 = ok(same(mv(mm(TAt, TA), Txh), mv(TAt, TB)), -4.4, 6.2, 'AᵀAx̂ = Aᵀb ✓');
  },
  async (tok, S) => {
    cap('p = Ax̂ = ' + vv(Tp), 'x̂ 是 columns 的組合係數：5a₁ − 3a₂');
    S.s1 = await gv(tok, S.sp, mul(Txh[0], TAt[0]), C.p, '5a₁', 'idx', [0, 0, 0], 0.035, 600);
    S.s2 = await gv(tok, S.sp, mul(Txh[1], TAt[1]), C.p, '−3a₂', 'idx', mul(Txh[0], TAt[0]), 0.035, 600);
    S.p = av(S.sp, Tp, C.p, 'p = ' + vv(Tp), '', [0, 0, 0], 0.065);
    S.E = av(S.sp, Te, C.e, 'e', '', Tp, 0.04);
  },
  async (tok, S) => {
    cap('p = A(AᵀA)⁻¹Aᵀb', '看起來有點亂，但不難');
    gone(S.s1, S.s2);
    S.f2 = mono(pl('p = A(AᵀA)⁻¹Aᵀ b', -4.4, 5.6));
  },
  async (tok, S) => {
    cap('一維時是 aaᵀ / aᵀa', '矩陣不能「除」，所以寫成反矩陣');
  },
  async (tok, S) => {
    cap('投影矩陣 P = A(AᵀA)⁻¹Aᵀ', 'P = 1/6 [5 2 −1; 2 2 2; −1 2 5]');
    S.m = mtag(S.Pm.map((r) => r.map((x) => x * 6)), -3.4, 4.6, 0, 'ptr'); S.mn = sm('P = 1/6 ×', -5.4, 4.6);
    S.k2 = ok(same(mv(S.Pm, TB), Tp), -3.6, 3.4, 'Pb = ' + vv(Tp) + ' ✓');
  },
  async (tok, S) => {
    cap('誘惑：(AᵀA)⁻¹ = A⁻¹(Aᵀ)⁻¹，P 就變 I？', '');
    S.bad = mono(tag('A A⁻¹ (Aᵀ)⁻¹ Aᵀ = I ✘', 'bad', -3.6, 2.6));
  },
  async (tok, S) => {
    cap('錯：A 不是方陣，沒有 A⁻¹', '只有 AᵀA 是方陣，不能拆開');
    S.k3 = ok(!isI(S.Pm), -3.6, 2.0, 'P ≠ I（P 只投影到平面）✓');
  },
  async (tok, S) => {
    const sq = [[1, 0, 0], [1, 1, 0], [1, 2, 1]];
    cap('如果 A 是可逆方陣：column space 是整個 Rⁿ', 'P = I，b 不用動');
    S.k4 = ok(isI(mm(mm(sq, inv3(mm(tr(sq), sq))), tr(sq))), -3.6, 1.4, '方陣例子：A(AᵀA)⁻¹Aᵀ = I ✓');
  },
  async (tok, S) => {
    cap('性質 1：Pᵀ = P', '(AᵀA)⁻¹ 是對稱的');
    S.k5 = ok(sameM(S.Pm, tr(S.Pm)), 3.6, 6.6, 'Pᵀ = P ✓');
  },
  async (tok, S) => {
    cap('性質 2：P² = P', '中間的 AᵀA 碰到它的反矩陣，消掉');
    await flash(tok, S.p, 2);
    S.k6 = ok(sameM(mm(S.Pm, S.Pm), S.Pm), 3.6, 6.0, 'P² = P ✓');
  },
  async (tok, S) => {
    cap('三個公式到齊：x̂、p、P', '接下來要用它們');
  },
]);
function inv3(M) {
  const [a, b, c] = M[0], [d, e, f] = M[1], [g, h, i] = M[2];
  const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [Cc, -(a * h - b * g), a * e - b * d]].map((r) => r.map((x) => x / det));
}

const FIT = [[1, 1], [2, 2], [3, 2]];            // Strang 的三個點
const fitBoard = (S) => {
  S.P = board2(-2.6, 1.2, 1.25, [-0.5, 4.2], [-0.5, 3.2]);
  tag('t', 'idx', S.P(4.4, 0).x, S.P(0, 0).y); tag('b', 'idx', S.P(0, 0).x, S.P(0, 3.4).y);
};
scene('or-l15-fit', 'L15：最小平方的應用：用直線擬合三個點', [[0.4, 3.4, 11.2], [0.4, 3.2, 0]], async (tok, S) => { fitBoard(S); }, [
  async (tok, S) => {
    cap('什麼時候會有太多方程？', '');
  },
  async (tok, S) => {
    cap('最常見的例子：least squares 直線擬合', '');
    S.t = hd('least squares：擬合直線', 3.8, 6.4);
  },
  async (tok, S) => {
    cap('給一堆資料點：接近一條直線，但不在線上', '');
  },
  async (tok, S) => {
    cap('t = 1, 2, 3 時，b = 1, 2, 2', '');
    S.d = FIT.map(([t, b]) => dotAt(S.P(t, b), C.b, 0.13));
    S.l = FIT.map(([t, b]) => sm('(' + t + ', ' + b + ')', S.P(t, b).x + 0.55, S.P(t, b).y + 0.3));
  },
  async (tok, S) => {
    const [p1, p2, p3] = FIT, col = (p2[1] - p1[1]) * (p3[0] - p1[0]) - (p3[1] - p1[1]) * (p2[0] - p1[0]);
    cap('沒有一條直線同時通過三個點', '');
    S.k0 = ok(col !== 0, 3.8, 5.8, '三點不共線 ✓');
  },
  async (tok, S) => {
    cap('找最好的直線：三個誤差都盡量小', '（畫面上的線是示意）');
    const C0 = 0.8, D0 = 0.45;
    S.L = rod(C.gray, 0.035).set(S.P(-0.3, C0 - 0.3 * D0), S.P(4.0, C0 + 4 * D0));
    S.er = FIT.map(([t, b]) => rod(C.e, 0.045).set(S.P(t, C0 + D0 * t), S.P(t, b)));
    S.n = sy(3.8, 5.2);
  },
  async (tok, S) => {
    cap('直線：b = C + Dt', '要找 C、D');
    S.f = mono(hd('b = C + D t', -5.4, 6.6));
  },
  ...FIT.map(([t, b], k) => async (tok, S) => {
    cap('第 ' + (k + 1) + ' 點 t = ' + t + '：C + ' + (t === 1 ? '' : t) + 'D = ' + b, '直線若通過這點就要滿足');
    S['e' + k] = mono(pl('C + ' + (t === 1 ? ' ' : t) + 'D = ' + b, -5.4, 5.9 - k * 0.55));
    glow(S.d[k], '#6a4a00');
  }),
  async (tok, S) => {
    const A = FIT.map(([t]) => [1, t]), b = FIT.map((p) => p[1]);
    cap('Ax = b：A = [1 1; 1 2; 1 3]、x = (C, D)、b = (1, 2, 2)', '');
    S.m = mtag(A, -4.6, 3.6, 0, 'ptr'); S.mx = mono(pl('[C]   [1]\n[D] = [2]\n      [2]', -3.0, 3.6));
    S.k1 = ok(same(mv(A, [1, 1]), FIT.map(([t]) => 1 + t)), -4.6, 2.4, 'A(C, D) = (C + D, C + 2D, C + 3D) ✓');
  },
  async (tok, S) => {
    const A = FIT.map(([t]) => [1, t]), b = FIT.map((p) => p[1]);
    cap('三個方程、兩個未知數：無解', '改解 AᵀAx̂ = Aᵀb');
    S.k2 = ok(rankOf(tr([...tr(A), b])) === 3, -4.6, 1.8, 'b ∉ C(A) → 無解 ✓');
    S.ne = mono(hot('AᵀA x̂ = Aᵀb', -4.6, 1.2));
  },
  async (tok, S) => {
    cap('下一講：用數字算完這個例子', '');
  },
]);

// ════════ L16（osh80YCg_GM）：Projection matrices and least squares ════════
const A16 = FIT.map(([t]) => [1, t]), b16 = FIT.map((p) => p[1]);
const A16t = tr(A16), G16 = mm(A16t, A16), r16 = mv(A16t, b16), x16 = mv(inv2(G16), r16);
const p16 = mv(A16, x16), e16 = sub(b16, p16), P16 = projM(A16);
scene('or-l16-extremes', 'L16：投影矩陣的兩個極端：b 在 C(A) 裡、b ⟂ C(A)', [[5.6, 6.0, 9.6], [0.4, 2.8, 0]], async (tok, S) => {
  S.sp = space3(0.62, V3(0, 2.2, 0), 2.6);
  S.pl = span2(S.sp, A16t[0], A16t[1], 2.4, C.a, 0.16);
  S.c1 = av(S.sp, A16t[0], C.a, '(1,1,1)', 'idx'); S.c2 = av(S.sp, A16t[1], C.a, '(1,2,3)', 'idx');
}, [
  async (tok, S) => {
    cap('複習上一講的公式：P = A(AᵀA)⁻¹Aᵀ', '用 L16 的 A = [1 1; 1 2; 1 3] 示意');
    S.f = mono(hd('P = A(AᵀA)⁻¹Aᵀ', -4.4, 6.8)); S.n = sy(-4.4, 6.2);
  },
  async (tok, S) => {
    cap('Pb：把 b 投到 column space 上最近的點', '');
  },
  async (tok, S) => {
    const bin = mv(A16, [1, 1]);
    cap('極端 1：b 已經在 column space 裡', 'Pb = b');
    S.B = await gv(tok, S.sp, bin, C.b, 'b = ' + vv(bin), 'ptr alt');
    S.k1 = ok(same(mv(P16, bin), bin), -4.4, 5.6, 'b = A(1, 1)：Pb = b ✓');
  },
  async (tok, S) => {
    const bp = cross(A16t[0], A16t[1]);
    cap('極端 2：b 垂直 column space', '最近的點是 0：Pb = 0');
    gone(S.B);
    S.B = await gv(tok, S.sp, bp, C.e, 'b = ' + vv(bp), '');
    S.ra = rightAngle(S.sp.O, S.sp.D(A16t[0]), S.sp.D(bp), 0.25);
    S.k2 = ok(isZ(mv(P16, bp)), -4.4, 5.0, 'Pb = 0 ✓');
  },
  async (tok, S) => {
    cap('一般的 b：一部分在 C(A)、一部分垂直', 'P 保留前者、殺掉後者');
    gone(S.B, S.ra);
    S.B = await gv(tok, S.sp, b16, C.b, 'b', 'ptr alt');
    S.p = await gv(tok, S.sp, p16, C.p, 'p', '', [0, 0, 0], 0.06, 500);
    S.E = await gv(tok, S.sp, e16, C.e, 'e', '', p16, 0.04, 400);
  },
  async (tok, S) => {
    cap('垂直 column space 的向量 = N(Aᵀ) 裡的向量', '四個子空間的幾何');
    S.t = mono(pl('b ⟂ C(A)  ⇔  b ∈ N(Aᵀ)', -4.4, 4.4));
  },
  async (tok, S) => {
    const bp = cross(A16t[0], A16t[1]);
    cap('Aᵀb = 0 → 公式最右邊就是 0', 'Pb = A(AᵀA)⁻¹(Aᵀb) = 0');
    S.k3 = ok(isZ(mv(A16t, bp)), -4.4, 3.8, 'Aᵀ(1, −2, 1) = 0 ✓');
  },
  async (tok, S) => {
    cap('b 在 column space ⇔ b = Ax', 'column space 裡的向量都長成 A 乘某個 x');
    S.t2 = mono(pl('b ∈ C(A)  ⇔  b = Ax', -4.4, 3.2));
  },
  async (tok, S) => {
    const x = [1, 1];
    cap('P(Ax) = A(AᵀA)⁻¹(AᵀA)x = Ax', 'AᵀA 碰到反矩陣消掉');
    S.k4 = ok(same(mv(P16, mv(A16, x)), mv(A16, x)), -4.4, 2.6, 'P(Ax) = Ax ✓');
  },
  async (tok, S) => {
    cap('圖：column space 和垂直的 N(Aᵀ)', 'b = p + e');
    const n = cross(A16t[0], A16t[1]);
    S.nl = rod(C.e, 0.025).set(S.sp.W(mul(-0.8, n)), S.sp.W(mul(0.8, n)));
    S.k5 = ok(same(add(p16, e16), b16), 3.6, 6.4, 'p + e = b ✓');
  },
  async (tok, S) => {
    const IP = P16.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) - x));
    cap('投影到垂直空間的是 I − P', 'e = (I − P) b');
    S.k6 = ok(same(mv(IP, b16), e16), 3.6, 5.8, '(I − P)b = e ✓');
    await flash(tok, S.E, 2);
  },
  async (tok, S) => {
    const IP = P16.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) - x));
    cap('I − P 也是投影矩陣', '對稱，(I − P)² = I − P');
    S.k7 = ok(sameM(IP, tr(IP)) && sameM(mm(IP, IP), IP), 3.6, 5.2, '(I−P)ᵀ = I−P、(I−P)² = I−P ✓');
  },
]);

const lineAt = (S, Cc, Dd, col = C.gray) => rod(col, 0.035).set(S.P(-0.4, Cc - 0.4 * Dd), S.P(4.0, Cc + 4.0 * Dd));
scene('or-l16-setup', 'L16：最好的直線：誤差平方和最小', [[0.4, 3.4, 11.2], [0.4, 3.2, 0]], async (tok, S) => { fitBoard(S); }, [
  async (tok, S) => {
    cap('上一講結尾的問題：找最好的直線', '');
  },
  async (tok, S) => {
    cap('t = 1, 2, 3；高度 1, 2, 2', '');
    S.d = FIT.map(([t, b]) => dotAt(S.P(t, b), C.b, 0.13));
    S.l = FIT.map(([t, b]) => sm('(' + t + ', ' + b + ')', S.P(t, b).x + 0.55, S.P(t, b).y + 0.3));
  },
  async (tok, S) => {
    cap('前兩點像在 45° 的線上，第三點不在', '');
    S.g = lineAt(S, 0, 1, '#d8cfc0');
  },
  async (tok, S) => {
    cap('要找 y = C + Dt', '');
    gone(S.g); S.f = mono(hd('y = C + D t', -5.4, 6.6));
  },
  async (tok, S) => {
    cap('沒有直線通過三點，挑「整體誤差」最小的', '先要定義什麼叫整體誤差');
  },
  ...FIT.map(([t, b], k) => async (tok, S) => {
    cap('通過第 ' + (k + 1) + ' 點：C + ' + (t === 1 ? '' : t) + 'D = ' + b, '');
    S['e' + k] = mono(pl('C + ' + (t === 1 ? ' ' : t) + 'D = ' + b, -5.4, 5.9 - k * 0.55)); glow(S.d[k], '#6a4a00');
  }),
  async (tok, S) => {
    cap('Ax = b：A = [1 1; 1 2; 1 3]、b = (1, 2, 2)', '無解（Strang 口誤說成 1, 2, 3）');
    S.m = mtag(A16, -4.6, 3.6, 0, 'ptr');
    S.k0 = ok(rankOf(tr([...A16t, b16])) === 3, -4.6, 2.4, 'b ∉ C(A) → 無解 ✓');
  },
  async (tok, S) => {
    cap('3×2，兩個 columns 獨立', 'column space 的 basis，但不含 b');
    S.k1 = ok(rankOf(A16) === 2, -4.6, 1.8, 'rank A = 2 ✓');
  },
  async (tok, S) => {
    cap('最好 = 誤差平方的總和最小', 'least squares');
    S.ls = hot('least squares', 3.8, 6.4);
  },
  async (tok, S) => {
    cap('誤差向量 e = Ax − b，要讓 ‖e‖² 最小', '‖e‖ = 0 就是剛好有解');
    S.f2 = mono(pl('minimize ‖Ax − b‖² = ‖e‖²', 3.8, 5.8));
  },
  async (tok, S) => {
    const C0 = 0.8, D0 = 0.45;
    cap('在點與直線的圖上：誤差是垂直距離', 'e₁、e₂、e₃（線是示意）');
    S.L = lineAt(S, C0, D0); S.n = sy(3.8, 5.2);
    S.er = FIT.map(([t, b], k) => rod(C.e, 0.045).set(S.P(t, C0 + D0 * t), S.P(t, b)));
    S.el = FIT.map(([t, b], k) => sm('e' + sub3(k + 1), S.P(t, 0).x + 0.35, S.P(0, (b + C0 + D0 * t) / 2).y));
  },
  async (tok, S) => {
    cap('整體誤差 = e₁² + e₂² + e₃²', '');
    S.sq = mono(pl('E = e₁² + e₂² + e₃²', 3.8, 4.6));
  },
  async (tok, S) => {
    cap('統計學叫它 linear regression', '');
  },
  async (tok, S) => {
    const out = [...FIT, [0, 3]], f = lsq(out), f0 = lsq(FIT);
    cap('小心 outlier：t = 0 有一個離很遠的點', '平方會把它的影響放大（示意點）');
    S.o = dotAt(S.P(0, 3), C.e, 0.14);
    S.L2 = lineAt(S, f.C, f.D, C.e);
    S.k2 = ok(Math.abs(f.D - f0.D) > 0.3, 3.8, 4.0, '多一點 → 斜率 ' + f2(f0.D) + ' 變成 ' + f2(f.D) + ' ✓');
  },
  async (tok, S) => {
    cap('least squares 最常用，但對 outlier 過度反應', '先拿掉這一點，回到三個方程');
    gone(S.o, S.L2, S.k2);
  },
]);

scene('or-l16-pictures', 'L16：兩張圖：點與直線、R³ 裡的投影', [[0.2, 4.2, 13.4], [0.2, 2.8, 0]], async (tok, S) => {
  S.P = board2(-5.0, 1.2, 0.95, [-0.4, 3.8], [-0.4, 3.0]);
  S.sp = space3(0.62, V3(2.6, 2.0, 0), 2.2);
  S.d = FIT.map(([t, b]) => dotAt(S.P(t, b), C.b, 0.11));
}, [
  async (tok, S) => {
    cap('有兩張圖要看', '左：點和直線；右：R³ 裡的向量');
    hd('點與直線', -3.2, 5.0); hd('向量（R³）', 2.6, 6.4);
  },
  async (tok, S) => {
    cap('直線上的點高度 p₁、p₂、p₃', '');
    S.L = rod(C.p, 0.03).set(S.P(-0.3, x16[0] - 0.3 * x16[1]), S.P(3.7, x16[0] + 3.7 * x16[1]));
    S.pd = FIT.map(([t], k) => dotAt(S.P(t, p16[k]), C.p, 0.09));
    S.pl = FIT.map(([t], k) => sm('p' + sub3(k + 1), S.P(t, p16[k]).x - 0.35, S.P(t, p16[k]).y - 0.3));
  },
  async (tok, S) => {
    cap('給定的 b₁、b₂、b₃；e 是兩者的差', '');
    S.er = FIT.map(([t, b], k) => rod(C.e, 0.04).set(S.P(t, p16[k]), S.P(t, b)));
  },
  async (tok, S) => {
    cap('把 p₁、p₂、p₃ 放進方程：解得出來', '直線通過所有 p');
  },
  async (tok, S) => {
    cap('所以 (p₁, p₂, p₃) 在 column space 裡', '是 columns 最接近 b 的組合');
    S.k = ok(rankOf(tr([...A16t, p16])) === 2, -3.2, 0.2, 'p ∈ C(A) ✓');
  },
  async (tok, S) => {
    cap('右邊的圖：b = (1, 2, 2) 是 R³ 的向量', '');
    S.B = await gv(tok, S.sp, b16, C.b, 'b = (1, 2, 2)', 'ptr alt');
  },
  async (tok, S) => {
    cap('column space 由 (1,1,1)、(1,2,3) 張成', '');
    S.pq = span2(S.sp, A16t[0], A16t[1], 2.2, C.a, 0.16);
    S.c1 = av(S.sp, A16t[0], C.a, '', 'idx'); S.c2 = av(S.sp, A16t[1], C.a, '', 'idx');
  },
  async (tok, S) => {
    cap('p 是 column space 裡離 b 最近的點', '');
    S.p = await gv(tok, S.sp, p16, C.p, 'p', '', [0, 0, 0], 0.06, 500);
    S.E = av(S.sp, e16, C.e, 'e', '', p16, 0.04);
  },
  async (tok, S) => {
    cap('現在來算：x̂ = (Ĉ, D̂) 和 p', '戴帽子：是估計出來的最佳值');
  },
]);

scene('or-l16-solve', 'L16：解 normal equations：Ĉ = 2/3、D̂ = 1/2', [[0.4, 3.4, 11.2], [0.4, 3.2, 0]], async (tok, S) => {
  fitBoard(S);
  S.d = FIT.map(([t, b]) => dotAt(S.P(t, b), C.b, 0.13));
}, [
  async (tok, S) => {
    cap('x̂ 的方程：AᵀA x̂ = Aᵀb', '');
    S.f = mono(hd('AᵀA x̂ = Aᵀb', 3.8, 6.6));
  },
  async (tok, S) => {
    cap('Strang：統計與估計裡最重要的方程', '有雜訊、要用少數參數擬合時，第一個用它');
  },
  async (tok, S) => {
    cap('AᵀA = ' + ms(G16), '3 = 1+1+1、6 = 1+2+3、14 = 1+4+9');
    S.g = mtag(G16, -4.6, 6.4, 0, 'ptr'); S.gn = sm('AᵀA =', -6.0, 6.4);
    S.k1 = ok(sameM(G16, [[3, 6], [6, 14]]), -4.6, 5.6, '[3 6; 6 14] ✓');
  },
  async (tok, S) => {
    const d = G16[0][0] * G16[1][1] - G16[0][1] * G16[1][0];
    cap('對稱、可逆（之後還會說是 positive definite）', '');
    S.k2 = ok(sameM(G16, tr(G16)) && d !== 0, -4.6, 5.0, '對稱、det = ' + d + ' ≠ 0 ✓');
  },
  async (tok, S) => {
    cap('Aᵀb = ' + vv(r16), '5 = 1+2+2、11 = 1+4+6');
    S.k3 = ok(same(r16, [5, 11]), -4.6, 4.4, 'Aᵀb = (5, 11) ✓');
  },
  async (tok, S) => {
    cap('normal equations：3C + 6D = 5、6C + 14D = 11', '');
    S.ne = mono(hot('3C +  6D =  5\n6C + 14D = 11', -4.6, 3.5));
  },
  async (tok, S) => {
    cap('也可以用微積分：E = (C+D−1)² + (C+2D−2)² + (C+3D−2)²', '');
    S.E = mono(pl('E(C,D) = (C+D−1)² + (C+2D−2)² + (C+3D−2)²', 2.4, 0.4));
  },
  async (tok, S) => {
    const grad = (c, d) => [FIT.reduce((s, [t, b]) => s + 2 * (c + d * t - b), 0), FIT.reduce((s, [t, b]) => s + 2 * t * (c + d * t - b), 0)];
    cap('對 C、D 偏微分 = 0，得到同樣兩個方程', '平方的微分是線性的');
    S.k4 = ok(isZ(grad(x16[0], x16[1])), 2.4, -0.2, '∂E/∂C = ∂E/∂D = 0（在 x̂）✓');
  },
  async (tok, S) => {
    cap('消去：第二式減 2 倍第一式 → 2D = 1', 'D̂ = 1/2');
    S.el = mono(pl('2D = 1  ⇒  D = 1/2', -4.6, 2.4));
  },
  async (tok, S) => {
    cap('回代：3C + 3 = 5 → C = 2/3', '');
    S.bs = mono(pl('3C + 6(1/2) = 5  ⇒  C = 2/3', -4.6, 1.8));
    S.k5 = ok(Math.abs(x16[0] - 2 / 3) < 1e-9 && Math.abs(x16[1] - 0.5) < 1e-9, -4.6, 1.2, 'x̂ = (2/3, 1/2) ✓');
  },
  async (tok, S) => {
    cap('最好的直線：b = 2/3 + (1/2)t', '');
    S.L = vec(C.p, 0.035); await growV(tok, S.L, S.P(-0.4, x16[0] - 0.4 * x16[1]), S.P(4.0, x16[0] + 4.0 * x16[1]), 900);
    S.L.label('b = 2/3 + t/2', 'ptr');
  },
]);

scene('or-l16-pe', 'L16：p、e 與兩張圖是同一件事', [[0.2, 4.2, 13.4], [0.2, 2.8, 0]], async (tok, S) => {
  S.P = board2(-5.0, 1.2, 0.95, [-0.4, 3.8], [-0.4, 3.0]);
  S.sp = space3(0.62, V3(2.6, 2.0, 0), 2.2);
  S.d = FIT.map(([t, b]) => dotAt(S.P(t, b), C.b, 0.11));
  rod(C.p, 0.03).set(S.P(-0.3, x16[0] - 0.3 * x16[1]), S.P(3.7, x16[0] + 3.7 * x16[1]));
  S.pq = span2(S.sp, A16t[0], A16t[1], 2.2, C.a, 0.14);
  S.B = av(S.sp, b16, C.b, 'b', 'ptr alt');
}, [
  ...[0, 1, 2].map((k) => async (tok, S) => {
    const t = FIT[k][0];
    cap('t = ' + t + '：p' + sub3(k + 1) + ' = 2/3 + ' + frac(t / 2) + ' = ' + frac(p16[k]), '');
    dotAt(S.P(t, p16[k]), C.p, 0.09); sm('p' + sub3(k + 1) + ' = ' + frac(p16[k]), S.P(t, p16[k]).x + 0.2, S.P(t, p16[k]).y - 0.45);
    rod(C.e, 0.04).set(S.P(t, p16[k]), S.P(t, b16[k]));
  }),
  async (tok, S) => {
    cap('誤差：1/6、−1/3、1/6（先照「往上算」）', 'Strang 接著會修正正負號');
    S.e1 = mono(pl('p − b = (1/6, −1/3, 1/6)', -3.4, 6.4));
  },
  async (tok, S) => {
    cap('要 p + e = b：e = b − p = (−1/6, 1/3, −1/6)', '');
    txt(S.e1, 'e = b − p = ' + vv(e16));
    S.k0 = ok(same(e16, [-1 / 6, 1 / 3, -1 / 6]), -3.4, 5.8, 'e = (−1/6, 2/6, −1/6) ✓');
  },
  async (tok, S) => {
    cap('b = p + e', '(1, 2, 2) = (7/6, 5/3, 13/6) + (−1/6, 1/3, −1/6)');
    S.p = await gv(tok, S.sp, p16, C.p, 'p', '', [0, 0, 0], 0.06, 500);
    S.E = await gv(tok, S.sp, e16, C.e, 'e', '', p16, 0.04, 400);
    S.k1 = ok(same(add(p16, e16), b16), 2.6, 6.4, 'p + e = b ✓');
  },
  async (tok, S) => {
    cap('p 和 e 互相垂直', '(−7 + 20 − 13)/36 = 0');
    S.ra = rightAngle(S.sp.W(p16), S.sp.D(mul(-1, p16)), S.sp.D(e16), 0.2);
    S.k2 = ok(Z(dot(p16, e16)), 2.6, 5.8, 'pᵀe = 0 ✓');
  },
  async (tok, S) => {
    cap('e 不只垂直 p，還垂直整個 column space', '');
  },
  async (tok, S) => {
    cap('例如 (1, 1, 1)：−1/6 + 2/6 − 1/6 = 0', '');
    S.c1 = av(S.sp, A16t[0], C.a, '(1,1,1)', 'idx');
    S.k3 = ok(Z(dot(e16, A16t[0])), 2.6, 5.2, 'e·(1,1,1) = 0 ✓');
  },
  async (tok, S) => {
    cap('還有 (1, 2, 3)：−1/6 + 4/6 − 3/6 = 0', '');
    S.c2 = av(S.sp, A16t[1], C.a, '(1,2,3)', 'idx');
    S.k4 = ok(Z(dot(e16, A16t[1])), 2.6, 4.6, 'e·(1,2,3) = 0 ✓');
  },
  async (tok, S) => {
    cap('兩張圖是同一件事', 'C、D 是兩個 columns 的組合係數，組合出 p');
    S.s1 = await gv(tok, S.sp, mul(x16[0], A16t[0]), C.p, '(2/3)(1,1,1)', 'idx', [0, 0, 0], 0.03, 500);
    S.s2 = await gv(tok, S.sp, mul(x16[1], A16t[1]), C.p, '(1/2)(1,2,3)', 'idx', mul(x16[0], A16t[0]), 0.03, 500);
    S.k5 = ok(same(add(mul(x16[0], A16t[0]), mul(x16[1], A16t[1])), p16), 2.6, 4.0, 'Ĉ·col₁ + D̂·col₂ = p ✓');
  },
  async (tok, S) => {
    cap('作業：解 AᵀAx̂ = Aᵀb，再算 p = Ax̂', '');
  },
]);

const A16d = [[1, 2], [1, 2], [1, 2]];           // 示意：columns 相依
scene('or-l16-proof', 'L16：證明：A 的 columns 獨立 ⇒ AᵀA 可逆', CAMB, null, [
  async (tok, S) => {
    cap('一直說 AᵀA 可逆，現在證明', 'A 的 columns 獨立 ⇒ AᵀA 可逆');
    S.t = mono(hd('A 的 columns 獨立  ⇒  AᵀA 可逆', 0, 6.6));
  },
  async (tok, S) => {
    cap('為什麼？', '');
  },
  async (tok, S) => {
    cap('假設 AᵀA x = 0', '');
    S.l = [mono(pl('假設  AᵀA x = 0', -2.6, 5.6))];
  },
  async (tok, S) => {
    cap('要證明：x 一定是 0', '可逆 ⇔ null space 只有 0');
    S.l.push(mono(hot('目標：x = 0', 3.2, 5.6)));
  },
  async (tok, S) => {
    cap('想法：兩邊同乘 xᵀ', 'xᵀAᵀA x = 0');
    S.l.push(mono(pl('xᵀAᵀAx = 0', -2.6, 4.8)));
  },
  async (tok, S) => {
    cap('這就是 (Ax)ᵀ(Ax) = ‖Ax‖² = 0', '長度平方');
    S.l.push(mono(pl('(Ax)ᵀ(Ax) = ‖Ax‖² = 0', -2.6, 4.0)));
    const x = [1, -0.5];
    S.k0 = ok(Math.abs(dot(mv(A16, x), mv(A16, x)) - dot(x, mv(G16, x))) < 1e-9, 3.2, 4.0, '例：xᵀ(AᵀA)x = ‖Ax‖² ✓');
  },
  async (tok, S) => {
    cap('長度是 0 的向量只有零向量：Ax = 0', '');
    S.l.push(mono(pl('⇒  Ax = 0', -2.6, 3.2)));
  },
  async (tok, S) => {
    cap('用假設：columns 獨立，Ax = 0 只有 x = 0', '證完');
    S.l.push(mono(hot('columns 獨立  ⇒  x = 0', -2.6, 2.4)));
    S.k1 = ok(rankOf(A16) === 2, 3.2, 3.2, 'A = [1 1; 1 2; 1 3]：rank 2 → N(A) = {0} ✓');
    S.k2 = ok(isZ(mv(mm(tr(A16d), A16d), [2, -1])), 3.2, 2.4, '對照：相依的 [1 2; 1 2; 1 2]，x = (2, −1) 讓 AᵀAx = 0 ✓');
  },
  async (tok, S) => {
    cap('這就是 AᵀA 可逆的背後理論', '');
  },
]);

scene('or-l16-ortho', 'L16：預告：orthonormal columns', [[0, 3.6, 11], [0, 3.0, 0]], async (tok, S) => {
  S.sp = space3(1.4, V3(-3.0, 2.2, 0), 2.0);
}, [
  async (tok, S) => {
    cap('什麼時候 columns 一定獨立？互相垂直的時候', '');
  },
  async (tok, S) => {
    cap('要排除零向量：長度都定成 1', '');
  },
  async (tok, S) => {
    cap('例：(1,0,0)、(0,1,0)、(0,0,1)', '單位向量、互相垂直、一定獨立');
    S.v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((u, k) => av(S.sp, u, [C.a, C.b, C.p][k], vv(u), 'idx', [0, 0, 0], 0.06));
  },
  async (tok, S) => {
    cap('這個矩陣的 AᵀA = I', '');
    S.k = ok(isI(mm([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])), 2.6, 6.0, 'AᵀA = I ✓');
  },
  async (tok, S) => {
    cap('ortho（垂直）＋ normal（單位長）= orthonormal', '最好的 columns');
    S.t = hd('orthonormal', 2.6, 5.2);
  },
  async (tok, S) => {
    const th = 0.6, q1 = [Math.cos(th), Math.sin(th)], q2 = [-Math.sin(th), Math.cos(th)];
    cap('最愛的一對：(cos θ, sin θ)、(−sin θ, cos θ)', '');
    S.P = board2(3.0, 2.2, 1.3, [-1.3, 1.3], [-1.3, 1.3]); circle2(S.P, 1);
    S.a = vec(C.a, 0.05).set(S.P(0, 0), W2(S.P, q1)).label('(cos θ, sin θ)', 'idx'); S.b = vec(C.b, 0.05).set(S.P(0, 0), W2(S.P, q2)).label('(−sin θ, cos θ)', 'idx');
    S.k2 = ok(Z(dot(q1, q2)) && Math.abs(norm(q1) - 1) < 1e-9, 3.0, 0.4, '垂直、長度 1 ✓');
  },
  async (tok, S) => {
    cap('下一講：orthonormal 的好處，以及怎麼做出來', '');
  },
]);

// ════════ 3Blue1Brown Ch9（LyGKycYT2v0）：Dot products and duality ════════
scene('or-3b-num', '3B1B：內積的算法：對應座標相乘再相加', CAMB, null, [
  async (tok, S) => {
    cap('兩個同樣長度的數字列：對應座標配對', '每對相乘，再全部加起來');
    S.t = hd('v · w = v₁w₁ + v₂w₂ + …', 0, 6.6);
  },
  async (tok, S) => {
    const v = [1, 2], w = [3, 4], d = dot(v, w);
    cap('(1, 2) · (3, 4) = 1·3 + 2·4 = ' + d, '');
    v.forEach((x, i) => { cube(x, C.a, [0.8, 0.8, 0.4], -4.6 + i * 1.2, 5.0, 0, 1.2); cube(w[i], C.b, [0.8, 0.8, 0.4], -4.6 + i * 1.2, 4.0, 0, 1.2); });
    S.k1 = ok(d === 11, -1.6, 4.5, '= 11 ✓');
  },
  async (tok, S) => {
    const v = [6, 2, 8, 3], w = [1, 8, 5, 3], d = dot(v, w);
    cap('(6, 2, 8, 3) · (1, 8, 5, 3)', '6 + 16 + 40 + 9 = ' + d);
    v.forEach((x, i) => { cube(x, C.a, [0.8, 0.8, 0.4], -4.6 + i * 1.2, 2.4, 0, 1.2); cube(w[i], C.b, [0.8, 0.8, 0.4], -4.6 + i * 1.2, 1.4, 0, 1.2); });
    S.k2 = ok(d === 71, 0.6, 1.9, '= 71 ✓');
  },
]);

const DV = [2, 1], DW = [1, 2];                   // 示意向量
scene('or-3b-proj', '3B1B：內積 = 投影長度 × 長度（順序無所謂）', [[0.4, 3.2, 10.6], [0.4, 3.0, 0]], async (tok, S) => {
  S.P = board2(-1.2, 2.6, 1.0, [-2.6, 4.2], [-2.0, 3.0]);
  S.lv = seg(W2(S.P, mul(-1.2, DV)), W2(S.P, mul(2.0, DV)), '#cbbd9f');
  S.V = vec(C.a, 0.06).set(S.P(0, 0), W2(S.P, DV)).label('v', 'ptr');
  S.W = vec(C.b, 0.06).set(S.P(0, 0), W2(S.P, DW)).label('w', 'ptr alt');
  S.pr = rod(C.p, 0.07); S.dl = seg(S.P(0, 0), S.P(0, 0), '#8a7a5c', true);
  S.read = sm('', 3.0, 6.2);
  S.show = (v, w, onto = 'v', vn = 'v') => {   // vn：第一個向量的名字（放大後是 2v）
    const base = onto === 'v' ? v : w, other = onto === 'v' ? w : v;
    const s = dot(v, w) / norm(base), foot = mul(s, unit(base));
    S.pr.set(S.P(0, 0), W2(S.P, foot)); S.pr.material.color.set(s < -1e-6 ? C.e : C.p); S.dl.setPts(W2(S.P, other), W2(S.P, foot));
    txt(S.read, '投影長 ' + f2(s) + ' × ‖' + (onto === 'v' ? vn : 'w') + '‖ ' + f2(norm(base)) + ' = ' + f2(s * norm(base)) + '；' + (vn === 'v' ? 'v' : '(' + vn + ')') + '·w = ' + f2(dot(v, w)));
    return s * norm(base);
  };
  S.pr.visible = false;
}, [
  async (tok, S) => {
    cap('內積有很漂亮的幾何意義', 'v、w 是示意向量');
    sy(-3.6, 5.6);
  },
  async (tok, S) => {
    cap('把 w 投影到通過 v 的直線上', '');
    S.pr.visible = true; S.show(DV, DW);
  },
  async (tok, S) => {
    const r = S.show(DV, DW);
    cap('投影長度 × v 的長度 = v · w', '');
    S.k = ok(Math.abs(r - dot(DV, DW)) < 1e-9, 3.0, 5.6, '幾何 = 數字 ✓');
  },
  async (tok, S) => {
    cap('投影和 v 反方向時，內積是負的', '');
  },
  async (tok, S) => {
    cap('大致同方向：正', '');
    gone(S.k);
    await anim(tok, 900, (t) => { const a = Math.atan2(2, 1) - 0.6 * t, w = [Math.sqrt(5) * Math.cos(a), Math.sqrt(5) * Math.sin(a)]; S.W.set(S.P(0, 0), W2(S.P, w)); S.show(DV, w); });
  },
  async (tok, S) => {
    const a = Math.atan2(1, 2) + Math.PI / 2, w = [Math.sqrt(5) * Math.cos(a), Math.sqrt(5) * Math.sin(a)];
    cap('垂直：投影是零向量，內積 = 0', '');
    const a0 = Math.atan2(2, 1) - 0.6;
    await anim(tok, 900, (t) => { const b = a0 + (a - a0) * t, ww = [Math.sqrt(5) * Math.cos(b), Math.sqrt(5) * Math.sin(b)]; S.W.set(S.P(0, 0), W2(S.P, ww)); S.show(DV, ww); });
    S.k = ok(Math.abs(dot(DV, w)) < 1e-9, 3.0, 5.6, 'v·w = 0 ✓');
  },
  async (tok, S) => {
    const a0 = Math.atan2(1, 2) + Math.PI / 2, a1 = a0 + 0.9;
    cap('大致反方向：負', '');
    gone(S.k);
    await anim(tok, 900, (t) => { const b = a0 + (a1 - a0) * t, ww = [Math.sqrt(5) * Math.cos(b), Math.sqrt(5) * Math.sin(b)]; S.W.set(S.P(0, 0), W2(S.P, ww)); S.show(DV, ww); });
  },
  async (tok, S) => {
    cap('奇怪：這個說法對 v、w 很不對稱', '');
    S.W.set(S.P(0, 0), W2(S.P, DW)); S.show(DV, DW);
  },
  async (tok, S) => {
    cap('反過來把 v 投影到 w 上，結果一樣', '');
    S.lw = seg(W2(S.P, mul(-1.0, DW)), W2(S.P, mul(1.6, DW)), '#cbbd9f');
    const r = S.show(DV, DW, 'w');
    S.k = ok(Math.abs(r - dot(DV, DW)) < 1e-9, 3.0, 5.6, '投影到 w 也 = v·w ✓');
  },
  async (tok, S) => {
    cap('直覺：v、w 一樣長時，兩種投影互為鏡像', '');
    S.m = seg(S.P(0, 0), W2(S.P, mul(1.5, unit(add(unit(DV), unit(DW))))), C.gold, true);
    S.k2 = ok(Math.abs(norm(DV) - norm(DW)) < 1e-9, 3.0, 5.0, '‖v‖ = ‖w‖ ✓（對稱）');
  },
  async (tok, S) => {
    cap('把 v 放大 2 倍：對稱被打破', '');
    gone(S.m, S.k, S.k2);
    S.V2 = mul(2, DV);
    await anim(tok, 800, (t) => S.V.set(S.P(0, 0), W2(S.P, mul(1 + t, DV))));
    S.V.label('2v', 'ptr');
  },
  async (tok, S) => {
    const r = S.show(S.V2, DW, 'v', '2v');
    cap('w 投影到 2v：投影長不變，當尺的 2v 變 2 倍長', '內積變 2 倍');
    S.k = ok(Math.abs(r - 2 * dot(DV, DW)) < 1e-9, 3.0, 5.6, '(2v)·w = 2(v·w) ✓');
  },
  async (tok, S) => {
    const r = S.show(S.V2, DW, 'w', '2v');
    cap('2v 投影到 w：投影長變 2 倍，w 不變', '');
    S.k2 = ok(Math.abs(r - 2 * dot(DV, DW)) < 1e-9, 3.0, 5.0, '投影長 × ‖w‖ 也 = 2(v·w) ✓');
  },
  async (tok, S) => {
    cap('兩種看法，結果都是內積變 2 倍', '');
  },
]);

const T1 = [1, -2];                               // 3B1B：î → 1、ĵ → −2
scene('or-3b-lin', '3B1B：2D → 數線的線性變換是 1×2 矩陣', [[0, 3.4, 11.4], [0, 3.0, 0]], async (tok, S) => {
  S.P = board2(-2.4, 3.4, 0.6, [-4.5, 4.5], [-3, 3]);
  S.nl = seg(V3(-5.4, 0.6, 0), V3(5.4, 0.6, 0), '#6e5f49');
  for (let k = -8; k <= 8; k += 2) { seg(V3(k * 0.6, 0.5, 0), V3(k * 0.6, 0.7, 0), '#6e5f49'); sm(String(k), k * 0.6, 0.25); }
  S.nx = (v) => V3(Math.max(-5.3, Math.min(5.3, v * 0.6)), 0.6, 0);
}, [
  async (tok, S) => {
    cap('疑問：配對相乘相加，為什麼跟投影有關？', '');
  },
  async (tok, S) => {
    cap('答案藏在 duality（對偶）', '');
    S.t = hd('duality', 4.2, 6.4);
  },
  async (tok, S) => {
    cap('先看：從 2D 到數線（一維）的線性變換', '輸入 2D 向量，輸出一個數');
    S.tt = hd('L：R² → R（數線）', 4.2, 5.8);
  },
  async (tok, S) => {
    const pts = [0, 1, 2, 3, 4].map((k) => [-2 + k, -1 + 0.5 * k]);
    cap('線性的樣子：等距的點，變換後還是等距', '');
    S.dots = pts.map((p) => dotAt(W2(S.P, p), C.a, 0.08));
    S.outs = pts.map((p) => dotAt(S.nx(dot(T1, p)), C.a, 0.09));
    const o = pts.map((p) => dot(T1, p)), gaps = o.slice(1).map((x, i) => x - o[i]);
    S.k = ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), 4.2, 5.2, '輸出間距都 = ' + f2(gaps[0]) + ' ✓');
  },
  async (tok, S) => {
    const pts = [0, 1, 2, 3, 4].map((k) => [-2 + k, -1 + 0.5 * k]), f = (p) => 0.4 * p[0] * p[0] + p[1];
    cap('如果變得不等距，就不是線性', '（示意：f(x, y) = 0.4x² + y）');
    gone(S.outs, S.k);
    S.outs = pts.map((p) => dotAt(V3(f(p) * 0.6, 0.6, 0), C.e, 0.09));
    S.n = sy(4.2, 5.2);
  },
  async (tok, S) => {
    cap('線性變換由 î、ĵ 落在哪裡決定', '各落在一個數 → 1×2 矩陣');
    gone(S.outs, S.dots, S.n);
    S.i = vec(C.a, 0.05).set(S.P(0, 0), S.P(1, 0)).label('î', 'ptr'); S.j = vec(C.b, 0.05).set(S.P(0, 0), S.P(0, 1)).label('ĵ', 'ptr alt');
  },
  async (tok, S) => {
    cap('例：î → 1、ĵ → −2', '矩陣 [1 −2]');
    S.di = dotAt(S.nx(1), C.a, 0.11); S.dj = dotAt(S.nx(-2), C.b, 0.11);
    S.m = mono(hd('[ 1  −2 ]', 4.2, 4.6));
  },
  async (tok, S) => {
    cap('向量 (4, 3) = 4î + 3ĵ', '');
    S.v = vec(C.p, 0.05); await growV(tok, S.v, S.P(0, 0), S.P(4, 3), 600); S.v.label('(4, 3)', '');
  },
  async (tok, S) => {
    const out = 4 * T1[0] + 3 * T1[1];
    cap('線性：落在 4·1 + 3·(−2) = ' + out, '');
    S.o = dotAt(S.nx(out), C.p, 0.14); S.ol = sm('−2', S.nx(out).x, 1.0);
    S.k2 = ok(out === dot(T1, [4, 3]), 4.2, 4.0, '4·1 + 3·(−2) = −2 ✓');
  },
  async (tok, S) => {
    cap('這就是矩陣乘向量：[1 −2][4; 3] = −2', '');
    S.mv = mono(pl('[ 1  −2 ] [4]\n          [3]  = −2', 4.2, 3.2));
  },
  async (tok, S) => {
    cap('看起來就像內積：把 1×2 矩陣立起來就是向量', '[1 −2] ↔ (1, −2)');
    S.u = vec(C.gold, 0.05); await growV(tok, S.u, S.P(0, 0), W2(S.P, T1), 600); S.u.label('(1, −2)', 'ptr');
    S.k3 = ok(dot(T1, [4, 3]) === -2, 4.2, 2.2, '(1, −2)·(4, 3) = −2 ✓');
  },
  async (tok, S) => {
    cap('暗示：「把向量變成數的變換」和「向量」之間有關係', '');
  },
]);

const UH = [0.8, 0.6];                            // 示意：對角數線的方向 û
scene('or-3b-uhat', '3B1B：投影到對角數線 = 和 û 做內積', [[0, 3.2, 10.8], [0, 3.0, 0]], async (tok, S) => {
  S.P = board2(0, 3.0, 1.0, [-3.6, 3.6], [-2.6, 2.6]);
  S.on = (k) => W2(S.P, mul(k, UH));
}, [
  async (tok, S) => {
    cap('先假裝不知道內積和投影有關', '');
  },
  async (tok, S) => {
    cap('拿一條數線，斜斜放在平面上，0 在原點', '');
    S.L = seg(S.on(-3.4), S.on(3.4), '#6e5f49');
    S.ticks = [-3, -2, -1, 1, 2, 3].map((k) => sm(String(k), S.on(k).x - 0.18, S.on(k).y + 0.25));
    S.n = sy(-3.0, 6.0);
  },
  async (tok, S) => {
    cap('數字 1 那個點：單位向量 û', '');
    S.U = vec(C.gold, 0.06); await growV(tok, S.U, S.P(0, 0), S.on(1), 500); S.U.label('û', 'ptr');
  },
  async (tok, S) => {
    const w = [1.2, 2.0], s = dot(w, UH);
    cap('把 2D 向量直直投影到這條數線上', '得到一個數 → 一個函數');
    S.w = vec(C.b, 0.05).set(S.P(0, 0), W2(S.P, w)).label('w', 'ptr alt');
    S.dl = seg(W2(S.P, w), S.on(s), '#8a7a5c', true); S.d = dotAt(S.on(s), C.p, 0.1);
  },
  async (tok, S) => {
    const pts = [0, 1, 2, 3].map((k) => [-2 + 1.2 * k, 1.4 - 0.6 * k]), o = pts.map((p) => dot(p, UH)), g = o.slice(1).map((x, i) => x - o[i]);
    cap('這個函數是線性的：等距的點投影後還是等距', '');
    S.ds = pts.map((p) => dotAt(W2(S.P, p), C.a, 0.07)); S.os = o.map((x) => dotAt(S.on(x), C.a, 0.08));
    S.k = ok(g.every((x) => Math.abs(x - g[0]) < 1e-9), 3.0, 6.0, '等距 ✓');
  },
  async (tok, S) => {
    cap('輸出是「數」，不是 2D 向量', 'û 則是活在輸入空間的 2D 向量');
    gone(S.ds, S.os, S.k);
  },
  async (tok, S) => {
    cap('它是線性變換 → 一定有 1×2 矩陣', '看 î、ĵ 落在哪裡');
    gone(S.w, S.dl, S.d);
    S.i = vec(C.a, 0.05).set(S.P(0, 0), S.P(1, 0)).label('î', 'ptr'); S.j = vec(C.b, 0.05).set(S.P(0, 0), S.P(0, 1)).label('ĵ', 'ptr alt');
  },
  async (tok, S) => {
    cap('對稱：î 投到 û 的線 ↔ û 投到 x 軸', 'î 落在 û 的 x 座標 = ' + UH[0]);
    S.d1 = seg(S.P(1, 0), S.on(UH[0]), '#8a7a5c', true); S.d2 = seg(S.on(1), S.P(UH[0], 0), C.gold, true);
    S.k1 = ok(Math.abs(dot([1, 0], UH) - UH[0]) < 1e-9, 3.0, 6.0, 'î → ' + UH[0] + ' = u_x ✓');
  },
  async (tok, S) => {
    cap('同理：ĵ 落在 û 的 y 座標 = ' + UH[1], '');
    S.d3 = seg(S.P(0, 1), S.on(UH[1]), '#8a7a5c', true); S.d4 = seg(S.on(1), S.P(0, UH[1]), C.gold, true);
    S.k2 = ok(Math.abs(dot([0, 1], UH) - UH[1]) < 1e-9, 3.0, 5.4, 'ĵ → ' + UH[1] + ' = u_y ✓');
  },
  async (tok, S) => {
    cap('所以 1×2 矩陣就是 û 的座標', '[u_x  u_y] = [0.8  0.6]');
    S.m = mono(hd('[ 0.8  0.6 ]', -3.0, 5.2));
  },
  async (tok, S) => {
    const w = [1.2, 2.0], s = dot(w, UH);
    cap('對任何向量做這個變換 = 和 û 做內積', '');
    gone(S.d1, S.d2, S.d3, S.d4);
    S.w = vec(C.b, 0.05).set(S.P(0, 0), W2(S.P, w)).label('w = (1.2, 2)', 'ptr alt');
    S.dl = seg(W2(S.P, w), S.on(s), '#8a7a5c', true); S.d = dotAt(S.on(s), C.p, 0.1);
    S.k3 = ok(Math.abs(mv([UH], w)[0] - s) < 1e-9, 3.0, 4.8, '[0.8 0.6]w = û·w = ' + f2(s) + ' ✓');
  },
  async (tok, S) => {
    cap('和單位向量做內積 = 投影到它的直線上量長度', '');
  },
]);

scene('or-3b-scale', '3B1B：非單位向量與 duality', [[0, 3.2, 10.8], [0, 3.0, 0]], async (tok, S) => {
  S.P = board2(0, 3.0, 0.8, [-4.5, 4.5], [-3, 3]);
  S.on = (k) => W2(S.P, mul(k, UH));
  S.L = seg(S.on(-4.4), S.on(4.4), '#6e5f49');
  S.U = vec(C.gold, 0.06).set(S.P(0, 0), S.on(1)).label('û', 'ptr');
}, [
  async (tok, S) => {
    cap('非單位向量呢？把 û 放大 3 倍', '');
    await anim(tok, 800, (t) => S.U.set(S.P(0, 0), S.on(1 + 2 * t)));
    S.U.label('3û', 'ptr');
  },
  async (tok, S) => {
    cap('每個分量 ×3：矩陣變成 [2.4  1.8]', 'î、ĵ 落點都變 3 倍');
    S.m = mono(hd('[ 2.4  1.8 ]', -3.6, 5.6));
  },
  async (tok, S) => {
    const w = [1.5, 2.0], s = dot(w, UH);
    cap('解讀：先投影到數線，再把落點乘 3', '');
    S.w = vec(C.b, 0.05).set(S.P(0, 0), W2(S.P, w)).label('w', 'ptr alt');
    S.dl = seg(W2(S.P, w), S.on(s), '#8a7a5c', true); S.d = dotAt(S.on(s), C.p, 0.1);
    S.k = ok(Math.abs(dot(mul(3, UH), w) - 3 * s) < 1e-9, 3.0, 6.0, '(3û)·w = 3 × 投影長 ✓');
  },
  async (tok, S) => {
    cap('和非單位向量做內積 = 投影長 × 那個向量的長度', '');
  },
  async (tok, S) => {
    cap('回顧：這個變換只用「投影」定義', '沒有用到數字或內積');
  },
  async (tok, S) => {
    cap('但它是線性的 → 有 1×2 矩陣 → 立起來就是向量', '');
  },
  async (tok, S) => {
    const T = [-1, 2], v = [3, 1];
    cap('任何 2D → 數線的線性變換，都對應唯一一個向量', '套用變換 = 和那個向量做內積');
    S.k2 = ok(mv([T], v)[0] === dot(T, v), 3.0, 5.4, '示意：[−1 2](3,1) = (−1,2)·(3,1) = −1 ✓');
  },
  async (tok, S) => {
    cap('這就是 duality（對偶）', '兩種東西之間自然又意外的對應');
    S.t = hd('duality', -3.6, 6.4);
  },
  async (tok, S) => {
    cap('向量的 dual 是它代表的線性變換', '變換的 dual 是一個向量');
    S.t2 = mono(pl('向量 v  ↔  變換 x ↦ v·x', -3.6, 4.8));
  },
]);

scene('or-3b-sum', '3B1B：總結', CAMB, null, [
  async (tok, S) => {
    cap('表面上：內積是理解投影的工具', '也能檢查兩個向量是否同方向');
    S.a = hd('內積 = 投影 × 長度', 0, 6.0);
  },
  async (tok, S) => {
    cap('更深一層：內積把一個向量翻譯成變換', '');
    S.b = hot('向量 ↔ 線性變換（到數線）', 0, 5.0);
  },
  async (tok, S) => {
    cap('有時候把向量看成「變換的化身」更好懂', '');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
