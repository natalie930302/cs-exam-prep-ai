// 離散數學 第7章：圖論（基礎）— 名詞、度數與握手定理、特殊圖（Kₙ、Cₙ、Wₙ、Qₙ、K_{m,n}）、二分圖、同構、
// Euler 路徑／迴路、Hamilton 路徑／迴路、平面圖與 Euler 公式 v − e + f = 2、著色與色數。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec22–23、趙啟超 第18–19講）目前都沒有逐字稿，場景全部依課本（Rosen 第 10 章、Grimaldi 第 11 章）：
//   Rosen 慣例：自迴圈（loop）對度數貢獻 2；Wₙ = Cₙ 加一個中心點（共 n+1 點）；Qₙ 有 2ⁿ 點、n·2ⁿ⁻¹ 條邊。
//   Königsberg 七橋（度數 5、3、3、3）、一筆畫房子、Hamilton 的十二面體遊戲、K₂,₃ 沒有 Hamilton 迴路、
//   K₄ 與立方體攤平成平面圖、K₅（e ≤ 3v − 6）與 K₃,₃（e ≤ 2v − 4）不是平面圖、色數 χ。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let mtok = 0, busy = false;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const COL = { node: '#cdbfa6', edge: '#9c8b70', hot: '#d64545', gold: '#c08a1f', green: '#2fc092', blue: '#4b9ee2', pink: '#e55a9b', purple: '#9b7ef4', orange: '#dd8238', dim: '#e6ddcf' };
  const PAL = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a'];
  const GOLD = '#6a4a00', RED = '#5a1010', GREEN = '#0f5a3a';
  const LET = 'abcdefghijklmnopqrstuvwxyz';

  // ───────────────────────── 共用小工具 ─────────────────────────
  function fresh(pos, look) { stopTimer(); mtok++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); } else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, p) => lab.springTo(bodyOf(o), p);
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m && m.material) m.material.emissive = new THREE.Color(c || '#000000'); };
  const txt = (l, t) => { l.element.textContent = t; };
  const ease = (t) => t * t * (3 - 2 * t);
  async function tween(w, ms, fn) { const steps = 14; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  async function wait(my, ms) { await sleep(ms); if (my !== mtok) throw new Error('stale'); }
  function guard(fn) {
    return async (...a) => {
      if (busy) { log('上一個動畫還在跑，等它跑完再按。', true); return; }
      busy = true; const my = mtok;
      try { await fn((ms) => wait(my, ms), ...a); } catch (e) { if (e.message !== 'stale') console.error(e); } finally { if (my === mtok) busy = false; }
    };
  }
  const ring = (n, R, y = 0.5, phase = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => { const a = phase + 2 * Math.PI * i / n; return V3(cx + R * Math.sin(a), y, cz - R * Math.cos(a)); });

  // ───────────────────────── 圖：頂點＝球，邊＝管子（可彎、可移動） ─────────────────────────
  function node(name, p, color = COL.node, r = 0.32) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    m.castShadow = true; m.position.copy(p);
    m.userData.lbl = lab.label(String(name), 'val'); m.add(m.userData.lbl);
    lab.world.add(m); return m;
  }
  function edgeCurve(a, b, bend) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const d = b.clone().sub(a);
    let perp = new THREE.Vector3().crossVectors(d, UP); if (perp.lengthSq() < 1e-6) perp = V3(1, 0, 0); perp.normalize();
    return new THREE.QuadraticBezierCurve3(a.clone(), mid.addScaledVector(perp, bend), b.clone());
  }
  function loopCurve(p) { // a little vertical loop above the vertex
    const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2; pts.push(V3(p.x + Math.sin(t) * 0.32, p.y + 0.32 + 0.32 - Math.cos(t) * 0.32, p.z)); }
    return new THREE.CatmullRomCurve3(pts, true);
  }
  function edgeMeshFor(e, G) {
    const a = G.V[e.u].p, b = G.V[e.v].p;
    e.curve = e.u === e.v ? loopCurve(a) : edgeCurve(a, b, e.bend);
    const geo = new THREE.TubeGeometry(e.curve, e.u === e.v ? 24 : 14, e.r, 6, e.u === e.v);
    if (e.m) { e.m.geometry.dispose(); e.m.geometry = geo; } else { e.m = new THREE.Mesh(geo, e.mat); e.m.castShadow = true; lab.world.add(e.m); }
    if (e.arrow) { const p = e.curve.getPoint(0.72), t = e.curve.getTangent(0.72); e.arrow.position.copy(p); e.arrow.quaternion.setFromUnitVectors(UP, t); }
  }
  function mkGraph(names, pos, edges, o = {}) {
    const G = { V: [], E: [] };
    names.forEach((nm, i) => G.V.push({ name: String(nm), p: pos[i].clone(), m: node(nm, pos[i], o.color || COL.node, o.r || 0.32) }));
    edges.forEach((e) => addEdge(G, e[0], e[1], e[2] || 0, o.edgeColor));
    return G;
  }
  function addEdge(G, u, v, bend = 0, color, directed = false) {
    const e = { u, v, bend, r: 0.05, mat: new THREE.MeshStandardMaterial({ color: color || COL.edge, roughness: 0.55 }), used: false };
    if (directed) { e.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 12), e.mat); lab.world.add(e.arrow); }
    edgeMeshFor(e, G); G.E.push(e); return e;
  }
  function removeEdge(G, e) { kill(e.m); if (e.arrow) kill(e.arrow); G.E.splice(G.E.indexOf(e), 1); }
  const updateEdges = (G) => G.E.forEach((e) => edgeMeshFor(e, G));
  function paintE(e, color, thick) { e.mat.color.set(color); const r = thick ? 0.1 : 0.05; if (r !== e.r) { e.r = r; e.m.geometry.dispose(); e.m.geometry = new THREE.TubeGeometry(e.curve, e.u === e.v ? 24 : 14, r, 6, e.u === e.v); } }
  const paintV = (G, i, color) => G.V[i].m.material.color.set(color);
  async function morph(w, G, target, ms = 1400) {
    const from = G.V.map((v) => v.p.clone());
    await tween(w, ms, (t) => { const k = ease(t); G.V.forEach((v, i) => { v.p.lerpVectors(from[i], target[i], k); v.m.position.copy(v.p); }); updateEdges(G); });
  }
  const deg = (G) => { const d = G.V.map(() => 0); G.E.forEach((e) => { d[e.u]++; d[e.v]++; }); return d; };
  const adjOf = (G) => { const A = G.V.map(() => []); G.E.forEach((e, i) => { A[e.u].push([e.v, i]); if (e.u !== e.v) A[e.v].push([e.u, i]); }); return A; };
  function components(G) {
    const A = adjOf(G), seen = G.V.map(() => false); let c = 0;
    for (let s = 0; s < G.V.length; s++) { if (seen[s]) continue; c++; const st = [s]; seen[s] = true; while (st.length) { const v = st.pop(); for (const [u] of A[v]) if (!seen[u]) { seen[u] = true; st.push(u); } } }
    return c;
  }
  function triangles(G) { const n = G.V.length, M = Array.from({ length: n }, () => Array(n).fill(false)); G.E.forEach((e) => { if (e.u !== e.v) { M[e.u][e.v] = M[e.v][e.u] = true; } }); let t = 0; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) if (M[a][b] && M[b][c] && M[a][c]) t++; return t; }
  function bipart(G) { // BFS 2-colouring; returns {ok, color, bad}
    const A = adjOf(G), col = G.V.map(() => -1);
    for (let s = 0; s < G.V.length; s++) {
      if (col[s] >= 0) continue; col[s] = 0; const q = [s];
      while (q.length) { const v = q.shift(); for (const [u, ei] of A[v]) { if (col[u] < 0) { col[u] = 1 - col[v]; q.push(u); } else if (col[u] === col[v]) return { ok: false, color: col, bad: ei }; } }
    }
    return { ok: true, color: col };
  }
  function eulerTrail(G) {
    const d = deg(G), odd = d.map((x, i) => (x % 2 ? i : -1)).filter((i) => i >= 0);
    const nz = d.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    if (!nz.length) return null;
    // edges must live in one component
    const A = adjOf(G), seen = new Set([nz[0]]), st = [nz[0]];
    while (st.length) { const v = st.pop(); for (const [u] of A[v]) if (!seen.has(u)) { seen.add(u); st.push(u); } }
    if (nz.some((i) => !seen.has(i))) return { ok: false, odd, why: '邊不在同一個連通塊裡' };
    if (odd.length !== 0 && odd.length !== 2) return { ok: false, odd, why: '奇點有 ' + odd.length + ' 個（要 0 或 2 個）' };
    const used = G.E.map(() => false), ptr = G.V.map(() => 0);
    const start = odd.length ? odd[0] : nz[0];
    const stack = [[start, -1]], path = [];
    while (stack.length) {
      const [v] = stack[stack.length - 1];
      while (ptr[v] < A[v].length && used[A[v][ptr[v]][1]]) ptr[v]++;
      if (ptr[v] < A[v].length) { const [u, ei] = A[v][ptr[v]]; used[ei] = true; stack.push([u, ei]); } else path.push(stack.pop());
    }
    path.reverse();
    return { ok: true, odd, circuit: odd.length === 0, verts: path.map((p) => p[0]), edges: path.slice(1).map((p) => p[1]) };
  }
  function hamSearch(G, cycle, start = 0, cap = 400000) {
    const n = G.V.length, A = adjOf(G).map((l) => l.filter(([u]) => u !== -1));
    const path = [start], inP = G.V.map(() => false), steps = []; inP[start] = true; let cnt = 0, found = null;
    const closes = (v) => A[v].some(([u]) => u === start);
    const rec = (v) => {
      if (found || ++cnt > cap) return;
      if (path.length === n) { if (!cycle || closes(v)) found = [...path]; return; }
      for (const [u, ei] of A[v]) { if (inP[u]) continue; inP[u] = true; path.push(u); steps.push(['+', u, ei]); rec(u); if (found) return; path.pop(); inP[u] = false; steps.push(['-', u, ei]); }
    };
    rec(start);
    return { found, steps, exhausted: cnt <= cap };
  }
  function chroma(G) {
    const n = G.V.length, A = adjOf(G);
    for (let k = 1; k <= n; k++) {
      const c = Array(n).fill(-1);
      const ok = (v, x) => A[v].every(([u]) => u === v || c[u] !== x);
      const rec = (v) => { if (v === n) return true; for (let x = 0; x < k; x++) if (ok(v, x)) { c[v] = x; if (rec(v + 1)) return true; c[v] = -1; } return false; };
      if (rec(0)) return { k, c };
    }
    return { k: n, c: [...Array(n).keys()] };
  }
  function findIso(G, H) {
    const n = G.V.length; if (n !== H.V.length || G.E.length !== H.E.length) return null;
    const gd = deg(G), hd = deg(H);
    const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
    const HE = new Set(H.E.map((e) => key(e.u, e.v)));
    const f = Array(n).fill(-1), used = Array(n).fill(false);
    const rec = (i) => {
      if (i === n) return G.E.every((e) => HE.has(key(f[e.u], f[e.v])));
      for (let j = 0; j < n; j++) if (!used[j] && gd[i] === hd[j]) { f[i] = j; used[j] = true; if (rec(i + 1)) return true; used[j] = false; }
      return false;
    };
    return rec(0) ? [...f] : null;
  }
  // degree token stacks above vertices (handshake)
  function stackPos(G, i, k) { const p = G.V[i].p; return V3(p.x + 0.42, p.y - 0.15 + k * 0.2, p.z); }

  // ───────────────────────── 圖庫 ─────────────────────────
  const PHI = (1 + Math.sqrt(5)) / 2;
  function dodeca() {
    const raw = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) raw.push([x, y, z]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { raw.push([0, a / PHI, b * PHI]); raw.push([a / PHI, b * PHI, 0]); raw.push([a * PHI, 0, b / PHI]); }
    const pos = raw.map(([x, y, z]) => V3(x * 1.55, 2.9 + y * 1.55, z * 1.55));
    const E = []; for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) { const d = Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1], raw[i][2] - raw[j][2]); if (Math.abs(d - 2 / PHI) < 1e-6) E.push([i, j]); }
    return { names: pos.map((_, i) => i + 1), pos, edges: E };
  }
  const CUBE_C = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  function cube3() { // 0..3 top, 4..7 bottom
    const pos = [...CUBE_C.map(([x, z]) => V3(x * 1.8, 3.8, z * 1.8)), ...CUBE_C.map(([x, z]) => V3(x * 1.8, 0.5, z * 1.8))];
    const E = []; for (let i = 0; i < 4; i++) { E.push([i, (i + 1) % 4]); E.push([4 + i, 4 + (i + 1) % 4]); E.push([i, 4 + i]); }
    return { names: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], pos, edges: E, posP: [...CUBE_C.map(([x, z]) => V3(x * 3, 0.4, z * 3)), ...CUBE_C.map(([x, z]) => V3(x * 1.2, 0.4, z * 1.2))],
      faces: [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
  }
  function octa() {
    const pos = [V3(2.2, 2.6, 0), V3(0, 2.6, 2.2), V3(0, 4.8, 0), V3(0, 0.4, 0), V3(-2.2, 2.6, 0), V3(0, 2.6, -2.2)];
    const opp = [4, 5, 3, 2, 0, 1];
    const E = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (opp[i] !== j) E.push([i, j]);
    const out = ring(3, 3.4, 0.4, 0), inn = ring(3, 1.3, 0.4, Math.PI / 3);
    // inner 3 between outer 0,1 ; 4 between 1,2 ; 5 between 2,0
    return { names: ['a', 'b', 'c', 'd', 'e', 'f'], pos, edges: E, posP: [out[0], out[1], out[2], inn[0], inn[1], inn[2]],
      faces: [[3, 4, 5], [0, 1, 3], [1, 2, 4], [2, 0, 5], [1, 4, 3], [2, 5, 4], [0, 3, 5]] };
  }
  function prism() {
    const b = ring(3, 2.6, 0.5, 0), t = ring(3, 2.6, 3.4, 0);
    const E = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
    return { names: ['a', 'b', 'c', 'd', 'e', 'f'], pos: [...b, ...t], edges: E, posP: [...ring(3, 3.4, 0.4, 0), ...ring(3, 1.3, 0.4, 0)],
      faces: [[3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]] };
  }
  function k4() {
    return { names: ['a', 'b', 'c', 'd'], pos: [V3(-2.2, 0.5, 2.2), V3(2.2, 0.5, 2.2), V3(2.2, 0.5, -2.2), V3(-2.2, 0.5, -2.2)], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]],
      posP: [V3(-3, 0.4, 2.2), V3(3, 0.4, 2.2), V3(0, 0.4, -3.2), V3(0, 0.4, 0.4)], faces: [[0, 1, 3], [1, 2, 3], [2, 0, 3]] };
  }
  const tetra = () => ({ names: ['a', 'b', 'c', 'd'], pos: [V3(0, 3.9, 0), V3(2.4, 0.5, 1.4), V3(-2.4, 0.5, 1.4), V3(0, 0.5, -2.8)], edges: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]] });
  const kn = (n, R = 2.8) => { const E = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) E.push([i, j]); return { names: LET.slice(0, n).split(''), pos: ring(n, R, 0.5).map((p, i) => (n >= 5 ? p.setY(0.5 + (i % 2) * 1.3) : p)), edges: E }; };
  const cn = (n, R = 2.8) => ({ names: LET.slice(0, n).split(''), pos: ring(n, R, 0.5), edges: Array.from({ length: n }, (_, i) => [i, (i + 1) % n]) });
  const wn = (n) => { const c = cn(n); return { names: [...c.names, LET[n]], pos: [...c.pos, V3(0, 1.9, 0)], edges: [...c.edges, ...Array.from({ length: n }, (_, i) => [i, n])] }; };
  function qn(n) {
    const N = 1 << n, pos = [];
    for (let v = 0; v < N; v++) {
      const b = (k) => (v >> k) & 1;
      if (n === 1) pos.push(V3(b(0) ? 2 : -2, 0.6, 0));
      else if (n === 2) pos.push(V3(b(0) ? 2 : -2, 0.6, b(1) ? -2 : 2));
      else { const s = n === 4 && b(3) ? 0.9 : 1.9; pos.push(V3((b(0) ? 1 : -1) * s, 2.5 + (b(2) ? 1 : -1) * s, (b(1) ? -1 : 1) * s)); }
    }
    const E = []; for (let v = 0; v < N; v++) for (let k = 0; k < n; k++) { const u = v ^ (1 << k); if (u > v) E.push([v, u]); }
    return { names: Array.from({ length: N }, (_, v) => v.toString(2).padStart(n, '0')), pos, edges: E };
  }
  function kmn(m, n) {
    const row = (k, z) => Array.from({ length: k }, (_, i) => V3((i - (k - 1) / 2) * 1.45, 0.5, z));
    const E = []; for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) E.push([i, m + j]);
    return { names: [...Array.from({ length: m }, (_, i) => 'u' + (i + 1)), ...Array.from({ length: n }, (_, j) => 'v' + (j + 1))], pos: [...row(m, -1.9), ...row(n, 1.9)], edges: E };
  }
  function petersen() {
    const out = ring(5, 3.0, 0.5), inn = ring(5, 1.4, 1.7);
    const E = []; for (let i = 0; i < 5; i++) { E.push([i, (i + 1) % 5]); E.push([i, i + 5]); E.push([5 + i, 5 + (i + 2) % 5]); }
    return { names: Array.from({ length: 10 }, (_, i) => i + 1), pos: [...out, ...inn], edges: E };
  }
  function house() {
    return { names: ['1', '2', '3', '4', '5'], pos: [V3(-1.7, 0.45, 0), V3(1.7, 0.45, 0), V3(1.7, 3.6, 0), V3(-1.7, 3.6, 0), V3(0, 5.6, 0)], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [3, 4], [2, 4]] };
  }
  function konig() {
    return { names: ['A', 'B', 'C', 'D'], pos: [V3(-0.8, 0.45, 0), V3(-0.8, 0.45, -3.1), V3(-0.8, 0.45, 3.1), V3(3.2, 0.45, 0)], edges: [[0, 1, 0.9], [0, 1, -0.9], [0, 2, 0.9], [0, 2, -0.9], [0, 3, 0], [1, 3, 0], [2, 3, 0]] };
  }
  const bowtie = () => ({ names: ['a', 'b', 'c', 'd', 'e'], pos: [V3(0, 1.2, 0), V3(-2.8, 0.5, -1.6), V3(-2.8, 0.5, 1.6), V3(2.8, 0.5, -1.6), V3(2.8, 0.5, 1.6)], edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 0]] });
  const build = (D, o) => mkGraph(D.names, D.pos, D.edges, o);

  // ───────────────────────── mode 1：度數與握手定理 ─────────────────────────
  const dg = { G: null, stacks: [] };
  function dgRefresh() {
    const G = dg.G, d = deg(G), sum = d.reduce((a, b) => a + b, 0), odd = d.filter((x) => x % 2).length;
    G.V.forEach((v, i) => { v.m.material.color.set(d[i] % 2 ? COL.pink : COL.node); txt(v.m.userData.lbl, v.name + ':' + d[i]); });
    setState('握手定理', [['頂點', G.V.length], ['邊 |E|', G.E.length], ['Σ deg(v)', sum], ['奇數度頂點', odd + ' 個']],
      'Σ deg = ' + d.join(' + ') + ' = ' + sum + ' = 2 × ' + G.E.length + (sum === 2 * G.E.length ? ' <span class="ok">✔</span>' : '') + '<br>奇數度的頂點（粉紅）一定有偶數個');
  }
  function dgTokens(e) {
    const G = dg.G, mid = e.curve.getPoint(0.5);
    for (const i of [e.u, e.v]) {
      const k = dg.stacks[i].length;
      const m = lab.box(COL.gold, [0.16, 0.16, 0.16]); m.position.copy(mid); lab.addBody(m); move(m, stackPos(G, i, k)); dg.stacks[i].push(m);
    }
  }
  function enterDegree() {
    fresh([0, 6.5, 11], [0, 1.4, 0]);
    const n = 7, pos = ring(n, 3.0, 0).map((p) => p.setY(0.5 + Math.random() * 2.2));
    dg.G = mkGraph(LET.slice(0, n).split(''), pos, []);
    dg.stacks = pos.map(() => []);
    pos.forEach((p) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, p.y, 6), new THREE.MeshBasicMaterial({ color: '#cbbd9f' })); s.position.set(p.x, p.y / 2, p.z); lab.world.add(s); });
    const key = (u, v) => Math.min(u, v) + '-' + Math.max(u, v);
    const addRandom = (allowLoop) => {
      const G = dg.G, have = new Set(G.E.map((e) => key(e.u, e.v)));
      const cand = []; for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (!have.has(key(u, v))) cand.push([u, v]);
      if (allowLoop) { const u = rnd(n); const e = addEdge(G, u, u, 0, COL.purple); dgTokens(e); log('加一個自迴圈在 ' + G.V[u].name + '：它的度數 +2（Rosen 慣例：loop 算 2）'); dgRefresh(); return; }
      if (!cand.length) { log('已經是完全圖 K' + n + ' 了，沒有新的邊可以加（簡單圖不能有重邊）。', true); return; }
      const [u, v] = cand[rnd(cand.length)];
      const e = addEdge(G, u, v); dgTokens(e);
      log('加邊 {' + G.V[u].name + ', ' + G.V[v].name + '}：兩端各 +1，總度數 +2');
      dgRefresh();
    };
    controls('<button class="primary" id="hAdd">加一條邊</button><button id="hDel">刪一條邊</button><button id="hLoop">加自迴圈</button><button id="hRand">隨機 8 條邊</button><button id="hClr">清空</button>');
    on('hAdd', () => addRandom(false));
    on('hLoop', () => addRandom(true));
    on('hDel', () => {
      const G = dg.G; if (!G.E.length) { log('沒有邊可以刪。', true); return; }
      const e = G.E[rnd(G.E.length)];
      for (const i of [e.u, e.v]) { const t = dg.stacks[i].pop(); if (t) fly(t, V3(0, 5, 2)); }
      log('刪邊 {' + G.V[e.u].name + ', ' + G.V[e.v].name + '}：兩端各 −1');
      removeEdge(G, e); dgRefresh();
    });
    on('hRand', guard(async (w) => { for (let k = 0; k < 8; k++) { addRandom(false); await w(260); } }));
    on('hClr', () => enterDegree());
    log('每條邊有兩個端點：加一條邊，就有兩個頂點的度數各 +1（金色方塊）。');
    dgRefresh();
  }

  // ───────────────────────── mode 2：特殊圖 ─────────────────────────
  const sp = { kind: 'K', n: 5, m: 3, G: null };
  function enterSpecial() {
    fresh([0, 7, 11], [0, 1.6, 0]);
    controls('<select id="sK"><option value="K">完全圖 Kₙ</option><option value="C">環 Cₙ</option><option value="W">輪 Wₙ</option><option value="Q">超立方體 Qₙ</option><option value="B">完全二分圖 K_{m,n}</option><option value="P">Petersen 圖</option></select>'
      + ' n = <input id="sN" type="number" min="1" max="8" value="' + sp.n + '"> m = <input id="sM" type="number" min="1" max="5" value="' + sp.m + '">'
      + '<button class="primary" id="sBip">檢查二分圖</button>');
    $('sK').value = sp.kind;
    const reset = () => { sp.kind = $('sK').value; sp.n = Number($('sN').value) || 3; sp.m = Number($('sM').value) || 3; enterSpecial(); };
    ['sK', 'sN', 'sM'].forEach((id) => { $(id).onchange = reset; });
    const n = sp.n, m = sp.m;
    let D, info;
    if (sp.kind === 'K') { if (n < 1 || n > 8) return log('Kₙ：n 請用 1～8。', true); D = kn(n); info = ['Kₙ', n + ' 點', 'n(n−1)/2 = ' + n * (n - 1) / 2]; }
    else if (sp.kind === 'C') { if (n < 3 || n > 8) return log('Cₙ 至少要 3 個點（n = 3～8）。', true); D = cn(n); info = ['Cₙ', n + ' 點', 'n = ' + n]; }
    else if (sp.kind === 'W') { if (n < 3 || n > 8) return log('Wₙ：n = 3～8（環上 n 點 + 中心 1 點）。', true); D = wn(n); info = ['Wₙ', (n + 1) + ' 點', '2n = ' + 2 * n]; }
    else if (sp.kind === 'Q') { if (n < 1 || n > 4) return log('Qₙ：畫面放得下 n = 1～4。', true); D = qn(n); info = ['Qₙ', (1 << n) + ' 點', 'n·2ⁿ⁻¹ = ' + n * (1 << (n - 1))]; }
    else if (sp.kind === 'B') { if (n < 1 || n > 5 || m < 1 || m > 5) return log('K_{m,n}：m、n 請用 1～5。', true); D = kmn(m, n); info = ['K_{' + m + ',' + n + '}', (m + n) + ' 點', 'm·n = ' + m * n]; }
    else { D = petersen(); info = ['Petersen', '10 點', '15（3-正則）']; }
    sp.G = build(D, { r: sp.kind === 'Q' && n === 4 ? 0.26 : 0.32 });
    const d = deg(sp.G);
    setState(info[0], [['頂點數', info[1]], ['邊數', info[2]], ['度數', [...new Set(d)].sort((a, b) => a - b).join('、')]], '用握手定理驗算：Σdeg = ' + d.reduce((a, b) => a + b, 0) + ' = 2 × ' + sp.G.E.length);
    on('sBip', () => {
      const r = bipart(sp.G);
      sp.G.V.forEach((v, i) => paintV(sp.G, i, r.color[i] === 1 ? COL.pink : COL.blue));
      sp.G.E.forEach((e) => paintE(e, COL.edge, false));
      if (r.ok) log('可以兩色著色：每條邊都連藍↔粉 → 是二分圖。');
      else { paintE(sp.G.E[r.bad], COL.hot, true); log('紅色這條邊兩端同色：圖裡有奇數長度的環 → 不是二分圖。', true); }
    });
    log(info[0] + '：' + info[1] + '、' + info[2] + ' 條邊。可以拖曳旋轉看立體結構。');
  }

  // ───────────────────────── mode 3：同構 ─────────────────────────
  const ISO = {
    c5: { name: 'C₅ vs 五角星', G: () => cn(5, 1.9), H: () => ({ names: ['1', '2', '3', '4', '5'], pos: ring(5, 1.9, 0.5), edges: [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]] }) },
    c6: { name: 'C₆ vs 兩個三角形', G: () => cn(6, 1.9), H: () => ({ names: ['1', '2', '3', '4', '5', '6'], pos: [...ring(3, 1.2, 0.5, 0, 0, -1.1), ...ring(3, 1.2, 0.5, Math.PI, 0, 1.1)], edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]] }) },
    k33: { name: 'K₃,₃ vs 三角柱', G: () => { const D = kmn(3, 3); D.pos = D.pos.map((p) => V3(p.x * 0.8, p.y, p.z * 0.8)); return D; }, H: () => { const b = ring(3, 1.7, 0.5), t = ring(3, 1.7, 2.9); return { names: ['1', '2', '3', '4', '5', '6'], pos: [...b, ...t], edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]] }; } },
    q3: { name: 'Q₃ 立方體 vs 兩排畫法', G: () => { const D = cube3(); D.pos = D.pos.map((p) => V3(p.x * 0.75, 0.5 + (p.y - 0.5) * 0.75, p.z * 0.75)); return D; }, H: () => { const top = [0, 3, 5, 6], bot = [1, 2, 4, 7]; const pos = Array(8); top.forEach((v, i) => { pos[v] = V3((i - 1.5) * 1.1, 0.5, -1.4); }); bot.forEach((v, i) => { pos[v] = V3((i - 1.5) * 1.1, 0.5, 1.4); }); const E = []; for (let v = 0; v < 8; v++) for (let k = 0; k < 3; k++) { const u = v ^ (1 << k); if (u > v) E.push([v, u]); } return { names: ['1', '2', '3', '4', '5', '6', '7', '8'], pos, edges: E }; } },
  };
  const iso = { key: 'c5', G: null, H: null };
  function shiftD(D, dx) { return { ...D, pos: D.pos.map((p) => p.clone().add(V3(dx, 0, 0))) }; }
  function invariants(G) { const d = deg(G).sort((a, b) => b - a); return { v: G.V.length, e: G.E.length, seq: d.join(','), comp: components(G), tri: triangles(G), bip: bipart(G).ok }; }
  function enterIso() {
    fresh([0, 7.5, 10.5], [0, 1.0, 0]);
    controls('<select id="iK">' + Object.keys(ISO).map((k) => '<option value="' + k + '">' + ISO[k].name + '</option>').join('') + '</select><button class="primary" id="iInv">比較不變量</button><button id="iMap">找對應並重新標號</button><button id="iRe">重來</button>');
    $('iK').value = iso.key;
    $('iK').onchange = () => { iso.key = $('iK').value; enterIso(); };
    on('iRe', () => enterIso());
    const P = ISO[iso.key];
    iso.G = build(shiftD(P.G(), -3.4), { color: '#bcd3ee' });
    iso.H = build(shiftD(P.H(), 3.4), { color: '#f2c6da' });
    tag('G', 'ptr', -3.4, 0, 3.2); tag('H', 'ptr alt', 3.4, 0, 3.2);
    on('iInv', () => {
      const a = invariants(iso.G), b = invariants(iso.H);
      const row = (k, nm) => [nm, a[k] + ' │ ' + b[k] + (String(a[k]) === String(b[k]) ? '' : ' ✘')];
      setState('G │ H 的不變量', [row('v', '頂點數'), row('e', '邊數'), row('seq', '度數序列'), row('comp', '連通塊'), row('tri', '三角形數'), row('bip', '二分圖')],
        Object.keys(a).every((k) => String(a[k]) === String(b[k])) ? '不變量都一樣 → 還不能確定，要找出對應' : '<span class="no">有不變量不同 → 一定不同構</span>');
      log('同構會保留頂點數、邊數、度數序列、連通性、環的長度…；只要有一項不同就不同構。');
    });
    on('iMap', guard(async (w) => {
      const f = findIso(iso.G, iso.H);
      if (!f) { log('找遍所有保持度數的對應都不行 → G 和 H 不同構。', true); setState('G │ H', [['結果', '不同構']], '<span class="no">沒有任何雙射能保住所有邊</span>'); return; }
      log('對應：' + f.map((j, i) => iso.G.V[i].name + '→' + iso.H.V[j].name).join('，'));
      const target = iso.H.V.map(() => null);
      f.forEach((j, i) => { target[j] = iso.G.V[i].p.clone().add(V3(6.8, 0, 0)); });
      await morph(w, iso.H, target, 1600);
      f.forEach((j, i) => { paintV(iso.H, j, PAL[i % 8]); paintV(iso.G, i, PAL[i % 8]); });
      setState('G │ H', [['結果', '同構'], ['對應', f.map((j, i) => iso.G.V[i].name + '→' + iso.H.V[j].name).join(' ')]], '<span class="ok">把 H 的點照對應搬過去，長得跟 G 一模一樣</span>');
    }));
    setState('G │ H：' + P.name, [['問題', '同構嗎？']], '先比不變量，再找對應');
    log('同構（isomorphic）：存在一對一對應 f，使 {u,v} 是 G 的邊 ⇔ {f(u),f(v)} 是 H 的邊。');
  }

  // ───────────────────────── mode 4：Euler ─────────────────────────
  const EU = { konig: ['Königsberg 七橋', konig], house: ['一筆畫房子', house], octa: ['八面體（全是 4 度）', octa], bowtie: ['蝴蝶結（兩個三角形）', bowtie], k4: ['K₄ 四面體', tetra], k5: ['K₅', () => kn(5)] };
  const eu = { key: 'konig', G: null, cur: -1, steps: 0, tokn: null };
  function euDeco(key) {
    if (key !== 'konig') return;
    const water = new THREE.Mesh(new THREE.BoxGeometry(12, 0.03, 9), new THREE.MeshStandardMaterial({ color: '#a9cbe8', transparent: true, opacity: 0.6 }));
    water.position.set(0, 0.015, 0); lab.world.add(water);
    for (const [x, z, w, d] of [[-0.8, -3.6, 9, 1.6], [-0.8, 3.6, 9, 1.6], [-0.8, 0, 2.2, 1.4], [3.4, 0, 1.8, 3.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshStandardMaterial({ color: '#d9c7a0' })); l.position.set(x, 0.05, z); lab.world.add(l); }
  }
  function euState() {
    const G = eu.G, d = deg(G), odd = d.filter((x) => x % 2).length, used = G.E.filter((e) => e.used).length;
    G.V.forEach((v, i) => { if (i !== eu.cur) v.m.material.color.set(d[i] % 2 ? COL.pink : COL.node); txt(v.m.userData.lbl, v.name + ':' + d[i]); });
    setState(EU[eu.key][0], [['度數', G.V.map((v, i) => v.name + '=' + d[i]).join(' ')], ['奇數度頂點', odd + ' 個'], ['已走', used + ' / ' + G.E.length + ' 條邊']],
      odd === 0 ? '<span class="ok">0 個奇點 → 有 Euler 迴路</span>（從任一點出發回到原點）' : odd === 2 ? '<span class="ok">2 個奇點 → 有 Euler 路徑</span>（從一個奇點走到另一個）' : '<span class="no">' + odd + ' 個奇點 → 沒有 Euler 路徑</span>');
  }
  async function walkEdge(w, G, ei, from, ms, color) {
    const e = G.E[ei], tokn = eu.tokn;
    const fwd = e.u === from;
    await tween(w, ms, (t) => { const p = e.curve.getPoint(fwd ? t : 1 - t); tokn.position.set(p.x, p.y + 0.3, p.z); });
    e.used = true; paintE(e, color, true);
    return fwd ? e.v : e.u;
  }
  function enterEuler() {
    fresh([0, 8, 10.5], [0.4, 1.6, 0]);
    controls('<select id="eK">' + Object.keys(EU).map((k) => '<option value="' + k + '">' + EU[k][0] + '</option>').join('') + '</select><button class="primary" id="eAuto">自動一筆畫</button> 走到 <input id="eTo" style="width:60px" placeholder="頂點"><button id="eGo">走</button><button id="eRe">重來</button>');
    $('eK').value = eu.key;
    $('eK').onchange = () => { eu.key = $('eK').value; enterEuler(); };
    on('eRe', () => enterEuler());
    if (eu.key === 'house') lab.frameCamera([0, 3.5, 12], [0, 2.8, 0]);
    euDeco(eu.key);
    eu.G = build(EU[eu.key][1]()); eu.cur = -1; eu.steps = 0;
    eu.tokn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: COL.hot })); eu.tokn.visible = false; lab.world.add(eu.tokn);
    on('eAuto', guard(async (w) => {
      const r = eulerTrail(eu.G);
      if (!r || !r.ok) { log('走不出一筆畫：' + (r ? r.why : '沒有邊') + '。', true); return; }
      eu.G.E.forEach((e) => { e.used = false; paintE(e, COL.edge, false); });
      let v = r.verts[0]; eu.tokn.visible = true; eu.tokn.position.copy(eu.G.V[v].p);
      log((r.circuit ? 'Euler 迴路' : 'Euler 路徑') + '（Hierholzer）：' + r.verts.map((i) => eu.G.V[i].name).join(' → '));
      for (let k = 0; k < r.edges.length; k++) { v = await walkEdge(w, eu.G, r.edges[k], v, 520, PAL[k % 8]); eu.cur = v; euState(); }
    }));
    on('eGo', guard(async (w) => {
      const nm = String($('eTo').value || '').trim();
      const t = eu.G.V.findIndex((v) => v.name.toLowerCase() === nm.toLowerCase());
      if (t < 0) { log('沒有叫「' + nm + '」的頂點。', true); return; }
      if (eu.cur < 0) { eu.cur = t; eu.tokn.visible = true; eu.tokn.position.copy(eu.G.V[t].p).add(V3(0, 0.3, 0)); glow(eu.G.V[t].m, GOLD); log('從 ' + nm + ' 出發。'); euState(); return; }
      const ei = eu.G.E.findIndex((e) => !e.used && ((e.u === eu.cur && e.v === t) || (e.v === eu.cur && e.u === t)));
      if (ei < 0) { log(eu.G.V[eu.cur].name + ' 和 ' + nm + ' 之間沒有還沒走過的邊（每條邊只能走一次）。', true); return; }
      glow(eu.G.V[eu.cur].m, null);
      eu.cur = await walkEdge(w, eu.G, ei, eu.cur, 450, PAL[eu.steps++ % 8]);
      glow(eu.G.V[eu.cur].m, GOLD);
      const left = eu.G.E.filter((e) => !e.used).length;
      const stuck = left && !eu.G.E.some((e) => !e.used && (e.u === eu.cur || e.v === eu.cur));
      log('走到 ' + nm + (left ? (stuck ? '：卡住了！還剩 ' + left + ' 條邊沒走' : '') : '：所有邊都走完了'), stuck);
      euState();
    }));
    log('Euler 路徑：每條邊恰好走一次。先數奇數度頂點（粉紅）。');
    euState();
  }

  // ───────────────────────── mode 5：Hamilton ─────────────────────────
  const HA = { dodeca: ['十二面體（Hamilton 的遊戲）', dodeca], cube: ['立方體 Q₃', cube3], petersen: ['Petersen 圖', petersen], k23: ['K₂,₃', () => kmn(2, 3)], k4: ['K₄', tetra], house: ['房子', house] };
  const ha = { key: 'dodeca', G: null };
  function enterHamilton() {
    fresh([0, 6.5, 11.5], [0, 2.4, 0]);
    controls('<select id="aK">' + Object.keys(HA).map((k) => '<option value="' + k + '">' + HA[k][0] + '</option>').join('') + '</select><select id="aT"><option value="c">找 Hamilton 迴路</option><option value="p">找 Hamilton 路徑</option></select><button class="primary" id="aGo">回溯搜尋</button>');
    $('aK').value = ha.key;
    $('aK').onchange = () => { ha.key = $('aK').value; enterHamilton(); };
    if (ha.key === 'house') lab.frameCamera([0, 3.5, 12], [0, 2.8, 0]);
    ha.G = build(HA[ha.key][1](), { r: ha.key === 'dodeca' ? 0.27 : 0.32 });
    const n = ha.G.V.length, d = deg(ha.G), dirac = d.every((x) => x >= n / 2);
    setState(HA[ha.key][0], [['頂點', n], ['邊', ha.G.E.length], ['最小度數', Math.min(...d)], ['Dirac 條件 δ ≥ n/2', dirac ? '成立' : '不成立']], dirac ? 'Dirac 成立 → 一定有 Hamilton 迴路' : 'Dirac 不成立 → 不能下結論（它只是充分條件）');
    on('aGo', guard(async (w) => {
      const cyc = $('aT').value === 'c';
      const G = ha.G;
      G.E.forEach((e) => paintE(e, COL.edge, false)); G.V.forEach((v, i) => { paintV(G, i, COL.node); glow(v.m, null); });
      let res = null, start = 0;
      for (let s = 0; s < (cyc ? 1 : n) && !(res && res.found); s++) { res = hamSearch(G, cyc, s); start = s; }
      const show = res.steps.slice(0, 160);
      const ekey = (a, b) => G.E.findIndex((e) => (e.u === a && e.v === b) || (e.v === a && e.u === b));
      const path = [start]; paintV(G, start, COL.gold);
      for (const [op, u, ei] of show) {
        if (op === '+') { paintE(G.E[ei], COL.gold, true); paintV(G, u, COL.gold); path.push(u); }
        else { paintE(G.E[ei], COL.edge, false); paintV(G, u, COL.node); path.pop(); }
        await w(70);
      }
      G.E.forEach((e) => paintE(e, COL.edge, false)); G.V.forEach((v, i) => paintV(G, i, COL.node));
      if (res.found) {
        const P = res.found;
        for (let k = 0; k < P.length; k++) {
          paintV(G, P[k], PAL[k % 8]);
          if (k) paintE(G.E[ekey(P[k - 1], P[k])], COL.green, true);
          await w(140);
        }
        if (cyc) paintE(G.E[ekey(P[P.length - 1], P[0])], COL.green, true);
        log('找到 Hamilton ' + (cyc ? '迴路' : '路徑') + '：' + P.map((i) => G.V[i].name).join(' → ') + (cyc ? ' → ' + G.V[P[0]].name : '') + '（回溯 ' + res.steps.length + ' 步）');
      } else log('回溯 ' + res.steps.length + ' 步、試完所有可能：沒有 Hamilton ' + (cyc ? '迴路' : '路徑') + '。', true);
    }));
    log('Hamilton：每個「頂點」恰好經過一次。沒有像 Euler 那樣的簡單判斷法，只能搜尋。');
  }

  // ───────────────────────── mode 6：平面圖與著色 ─────────────────────────
  const PL = { k4: ['K₄（有交叉的畫法）', k4], cube: ['立方體 Q₃', cube3], prism: ['三角柱', prism], octa: ['八面體', octa], k5: ['K₅', () => kn(5)], k33: ['K₃,₃', () => kmn(3, 3)], petersen: ['Petersen 圖', petersen] };
  const pl = { key: 'k4', G: null, D: null, flat: false, faces: [] };
  function faceFill(G, cyc, color, y = 0.06) {
    const pts = cyc.map((i) => G.V[i].p);
    const c = pts.reduce((a, p) => a.add(p.clone()), V3(0, 0, 0)).multiplyScalar(1 / pts.length);
    const arr = [];
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; arr.push(c.x, y, c.z, a.x, y, a.z, b.x, y, b.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
    lab.world.add(m); return m;
  }
  function outerFace(color) { const m = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.02, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false })); m.position.y = 0.02; lab.world.add(m); return m; }
  async function countFaces(w, G, D, slow = 900) {
    const ff = [];
    for (let k = 0; k < D.faces.length; k++) { ff.push(faceFill(G, D.faces[k], PAL[k % 8])); say('第 ' + (k + 1) + ' 個面', ''); await w(slow); }
    ff.push(outerFace(PAL[D.faces.length % 8]));
    say('外面那一大片也算一個面', 'f = ' + (D.faces.length + 1));
    await w(slow + 300);
    return ff;
  }
  function enterPlanar() {
    fresh([0, 9, 9], [0, 0.8, 0]);
    controls('<select id="lK">' + Object.keys(PL).map((k) => '<option value="' + k + '">' + PL[k][0] + '</option>').join('') + '</select><button class="primary" id="lFlat">攤平成平面圖</button><button id="lFace">數面 v − e + f</button><button id="lCol">著色（求 χ）</button><button id="lIneq">檢查 e ≤ 3v − 6</button>');
    $('lK').value = pl.key;
    $('lK').onchange = () => { pl.key = $('lK').value; enterPlanar(); };
    pl.D = PL[pl.key][1](); pl.G = build(pl.D); pl.flat = false; pl.faces = [];
    const v = pl.G.V.length, e = pl.G.E.length;
    on('lFlat', guard(async (w) => {
      if (!pl.D.posP) { log(PL[pl.key][0] + ' 不是平面圖：怎麼畫都會有邊交叉' + (pl.key === 'petersen' ? '（它含 K₃,₃ 的細分；最短環長 5 → e ≤ 5(v−2)/3 ≈ 13 < 15）。' : '（用「檢查 e ≤ 3v − 6」看原因）。'), true); return; }
      await morph(w, pl.G, pl.D.posP, 1800); pl.flat = true;
      log('攤平了：沒有任何兩條邊交叉 → 平面圖（planar graph）。');
    }));
    on('lFace', guard(async (w) => {
      if (!pl.flat) { log('先「攤平成平面圖」，面（region）才看得清楚。', true); return; }
      pl.faces.forEach(kill); pl.faces = await countFaces(w, pl.G, pl.D, 500);
      const f = pl.D.faces.length + 1;
      setState('Euler 公式', [['v', v], ['e', e], ['f（含外面）', f]], 'v − e + f = ' + v + ' − ' + e + ' + ' + f + ' = <span class="ok">' + (v - e + f) + '</span>');
    }));
    on('lCol', guard(async (w) => {
      const r = chroma(pl.G);
      pl.G.V.forEach((_, i) => paintV(pl.G, i, COL.node));
      for (let i = 0; i < v; i++) { paintV(pl.G, i, PAL[r.c[i]]); await w(260); }
      log('相鄰頂點不同色，最少要 ' + r.k + ' 色 → χ = ' + r.k + '（回溯搜尋：' + (r.k - 1) + ' 色不夠）');
      setState('著色', [['色數 χ(G)', r.k], ['頂點', v]], '每條邊兩端顏色不同；平面圖一定 χ ≤ 4（四色定理）');
    }));
    on('lIneq', () => {
      const tri = triangles(pl.G) > 0, bound = tri ? 3 * v - 6 : 2 * v - 4;
      const okb = e <= bound;
      log((tri ? '連通簡單平面圖（v ≥ 3）必有 e ≤ 3v − 6' : '沒有三角形的平面圖，每個面至少 4 條邊 → e ≤ 2v − 4') + '：e = ' + e + (okb ? ' ≤ ' : ' > ') + bound + (okb ? '（不違反，但這只是必要條件）' : ' → 一定不是平面圖'), !okb);
      setState('平面圖的必要條件', [['v', v], ['e', e], [tri ? '3v − 6' : '2v − 4', bound]], okb ? '<span class="ok">e ≤ ' + bound + '</span>：沒被排除' : '<span class="no">e > ' + bound + '</span>：不可能是平面圖');
    });
    setState(PL[pl.key][0], [['v', v], ['e', e]], pl.D.posP ? '可以攤平成平面圖' : '不是平面圖');
    log('平面圖：可以畫在平面上、邊不交叉。攤平後數面：v − e + f = 2。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function uniq(ans, cands) { const s = [String(ans)]; for (const c of cands) { const v = String(c); if (!s.includes(v) && s.length < 4) s.push(v); } let d = 1; while (s.length < 4) { const v = String(Number(ans) + d * 2); if (!s.includes(v)) s.push(v); d++; } return s; }
  function genQ() {
    const t = rnd(9);
    if (t === 0) { const n = 6 + rnd(10), k = 2 + rnd(5); if ((n * k) % 2) return genQ(); const ans = n * k / 2; return { q: '一個圖有 ' + n + ' 個頂點、每個頂點的度數都是 ' + k + '，共有幾條邊？', opts: uniq(ans, [n * k, n + k, n * (n - 1) / 2]), ans: String(ans), why: '握手定理：Σdeg = 2|E| → ' + n + '×' + k + ' = 2|E| → |E| = ' + ans + '。' }; }
    if (t === 1) {
      const seqs = [['3,3,3,3,2', false], ['3,3,2,2,2', true], ['4,3,3,2,2,1', false], ['3,3,3,3,3,3', true], ['5,3,3,3', true], ['2,2,2,1', false]];
      const [s, ok] = seqs[rnd(seqs.length)]; const sum = s.split(',').map(Number).reduce((a, b) => a + b, 0);
      return { q: '度數序列 (' + s + ') 能不能是某個圖（允許重邊）的度數？看奇偶就好。', opts: ['可以：總和為偶數', '不行：總和為奇數', '不行：一定要每點度數相同', '可以：只要最大度數 < 頂點數'], ans: ok ? '可以：總和為偶數' : '不行：總和為奇數', why: '總和 = ' + sum + '；握手定理要求總和 = 2|E| 為偶數，奇數度頂點必須有偶數個。' };
    }
    if (t === 2) { const n = 3 + rnd(8); const ans = n * (n - 1) / 2; return { q: '完全圖 K' + n + ' 有幾條邊？', opts: uniq(ans, [n * (n - 1), n, n * n]), ans: String(ans), why: '任兩點都連：C(' + n + ',2) = ' + ans + '。' }; }
    if (t === 3) { const n = 2 + rnd(4); const ans = n * (1 << (n - 1)); return { q: '超立方體 Q' + n + ' 有幾條邊？', opts: uniq(ans, [1 << n, n * (1 << n), (1 << n) - 1]), ans: String(ans), why: '2^' + n + ' 個頂點，每點度數 ' + n + '：' + (1 << n) + '×' + n + '/2 = ' + ans + '。' }; }
    if (t === 4) {
      const G = [['Königsberg（度數 5,3,3,3）', '都沒有'], ['K₅（每點 4 度）', '有 Euler 迴路'], ['K₄（每點 3 度）', '都沒有'], ['房子圖（度數 3,3,4,4,2）', '有 Euler 路徑但沒有迴路'], ['C₆', '有 Euler 迴路'], ['K₂,₄', '有 Euler 迴路'], ['K₂,₃', '有 Euler 路徑但沒有迴路']];
      const [g, a] = G[rnd(G.length)];
      return { q: g + '：有沒有 Euler 迴路／路徑？', opts: ['有 Euler 迴路', '有 Euler 路徑但沒有迴路', '都沒有', '無法判斷'], ans: a, why: '連通圖：0 個奇點 → Euler 迴路；恰 2 個奇點 → Euler 路徑（起訖在兩個奇點）；其他 → 都沒有。' };
    }
    if (t === 5) {
      const G = [['K₂,₃', '沒有', '二分圖兩邊點數不同，迴路必須兩邊交替 → 不可能'], ['立方體 Q₃', '有', 'a→b→c→d→h→g→f→e→a 之類的迴路'], ['Petersen 圖', '沒有', 'Petersen 圖是著名的沒有 Hamilton 迴路的 3-正則圖'], ['K₅', '有', 'Dirac：每點度數 4 ≥ 5/2'], ['十二面體', '有', 'Hamilton 的 Icosian game 正是要找它'], ['有一個 1 度頂點的圖', '沒有', '1 度頂點進去就出不來，不可能在迴路上']];
      const [g, a, why] = G[rnd(G.length)];
      return { q: g + ' 有沒有 Hamilton 迴路？', opts: ['有', '沒有', '要看畫法', '和 Euler 迴路一樣用奇點判斷'], ans: a, why };
    }
    if (t === 6) { const v = 5 + rnd(10), f = 3 + rnd(8), e = v + f - 2; return { q: '一個連通平面圖有 ' + v + ' 個頂點、' + f + ' 個面（含外面），有幾條邊？', opts: uniq(e, [v + f, v + f + 2, v * f / 2 | 0]), ans: String(e), why: 'Euler 公式 v − e + f = 2 → e = v + f − 2 = ' + e + '。' }; }
    if (t === 7) {
      const G = [['K₅', '不是平面圖', 'e = 10 > 3v − 6 = 9'], ['K₃,₃', '不是平面圖', '沒有三角形 → e ≤ 2v − 4 = 8，但 e = 9'], ['K₄', '是平面圖', '把一點拉到三角形裡面就沒交叉'], ['Q₃', '是平面圖', '外框大正方形、內框小正方形'], ['K₂,₅', '是平面圖', 'e = 10 ≤ 2v − 4 = 10，而且畫得出來']];
      const [g, a, why] = G[rnd(G.length)];
      return { q: g + ' 是不是平面圖？', opts: ['是平面圖', '不是平面圖', '要看畫法', '頂點太少無法判斷'], ans: a, why };
    }
    const G = [['C₅', 3], ['C₆', 2], ['K₄', 4], ['K₃,₃', 2], ['W₅（C₅ 加中心點）', 4], ['W₆', 3], ['Petersen 圖', 3], ['任一棵樹（≥ 2 點）', 2]];
    const [g, k] = G[rnd(G.length)];
    return { q: g + ' 的色數 χ 是多少？', opts: uniq(k, [k + 1, k - 1, 5].filter((x) => x > 0)), ans: String(k), why: '奇數環要 3 色、偶數環與二分圖 2 色、Kₙ 要 n 色；輪圖 = 環的色數 + 1（中心點和環上每點相鄰）。' };
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
        const pick = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pick === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 場景（課本） ═════════════════════════
  async function scTerms(tok) {
    fresh([0, 6.5, 10.5], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    const pos = [V3(-2.6, 0.5, 1.4), V3(0, 1.8, -1.6), V3(2.6, 0.5, 1.4), V3(0, 0.5, 2.6)];
    const G = mkGraph(['a', 'b', 'c', 'd'], pos, []);
    say('圖 G = (V, E)：頂點集合 V、邊集合 E', 'V = {a, b, c, d}');
    await w(2400);
    for (const [u, v] of [[0, 1], [1, 2], [2, 3], [0, 3]]) { addEdge(G, u, v); await w(500); }
    say('邊 {a, b}：a、b 相鄰（adjacent），邊和 a 相接（incident）', '簡單圖：沒有重邊、沒有自迴圈');
    glow(G.V[0].m, GOLD); glow(G.V[1].m, GOLD); paintE(G.E[0], COL.gold, true);
    await w(3000);
    glow(G.V[0].m, null); glow(G.V[1].m, null); paintE(G.E[0], COL.edge, false);
    const m1 = addEdge(G, 0, 1, 0.7, COL.pink), m2 = addEdge(G, 0, 1, -0.7, COL.pink);
    say('兩點之間多條邊 → 多重圖（multigraph）', '');
    await w(2400);
    const lp = addEdge(G, 2, 2, 0, COL.purple);
    say('自己連到自己 → 自迴圈（loop）：虛擬圖（pseudograph）', 'deg(c)：loop 算 2 → deg(c) = 2 + 2 = 4');
    txt(G.V[2].m.userData.lbl, 'c:4');
    await w(3200);
    [m1, m2, lp].forEach((e) => removeEdge(G, e)); txt(G.V[2].m.userData.lbl, 'c');
    G.E.forEach((e) => { e.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 12), e.mat); lab.world.add(e.arrow); edgeMeshFor(e, G); });
    say('邊有方向 → 有向圖（directed graph）', '(u, v)：u 出發、v 結束；分入度 deg⁻ 與出度 deg⁺');
    await w(3400);
  }
  async function scHandshake(tok) {
    fresh([0, 6.5, 11], [0, 1.6, 0]);
    const w = (ms) => beat(tok, ms);
    const pos = [V3(-3, 0.6, 0.8), V3(-1.4, 2.4, -1.8), V3(1.2, 1.2, -2.4), V3(3, 2.0, 0.2), V3(1.4, 0.5, 2.4), V3(-1.2, 1.4, 2.0)];
    dg.G = mkGraph(['a', 'b', 'c', 'd', 'e', 'f'], pos, []); dg.stacks = pos.map(() => []);
    pos.forEach((p) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, p.y, 6), new THREE.MeshBasicMaterial({ color: '#cbbd9f' })); s.position.set(p.x, p.y / 2, p.z); lab.world.add(s); });
    say('每加一條邊，兩個端點各得 1 個度數', '金色方塊 = 度數');
    await w(2200);
    const E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 5], [2, 4], [1, 3]];
    for (let k = 0; k < E.length; k++) {
      const e = addEdge(dg.G, E[k][0], E[k][1]); dgTokens(e); dgRefresh();
      say('第 ' + (k + 1) + ' 條邊：金色方塊 +2', 'Σ deg = ' + 2 * (k + 1) + ' = 2 × ' + (k + 1));
      await w(k < 3 ? 1300 : 650);
    }
    say('握手定理：Σ deg(v) = 2|E|', '每條邊被兩個端點各算一次');
    await w(2800);
    lab.clear();
    const R = ring(10, 3.0, 0.5);
    const G = mkGraph(Array.from({ length: 10 }, (_, i) => i + 1), R, [], { r: 0.26 });
    say('例：10 個頂點，每點度數 6，幾條邊？', '2|E| = 10 × 6 = 60');
    for (let s = 1; s <= 3; s++) { for (let i = 0; i < 10; i++) addEdge(G, i, (i + s) % 10, 0, PAL[s]); await w(900); }
    say('|E| = 60 / 2 = 30', '畫出來：每點連到距離 1、2、3 的 6 個點');
    await w(3200);
  }
  async function scOddEven(tok) {
    fresh([0, 6.5, 11], [0, 1.6, 0]);
    const w = (ms) => beat(tok, ms);
    const pos = ring(6, 2.9, 0).map((p, i) => p.setY(0.6 + (i % 3) * 0.8));
    dg.G = mkGraph(['a', 'b', 'c', 'd', 'e', 'f'], pos, []); dg.stacks = pos.map(() => []);
    const cnt = tag('奇數度頂點：0 個', 'ptr alt', 0, 4.4, 0);
    say('Σ deg 是偶數 → 奇數度的頂點必有偶數個', '粉紅 = 奇數度');
    await w(2400);
    const E = [[0, 1], [1, 2], [0, 3], [2, 5], [3, 4], [1, 4], [4, 5], [0, 2]];
    for (const [u, v] of E) {
      const e = addEdge(dg.G, u, v); dgTokens(e); dgRefresh();
      const odd = deg(dg.G).filter((x) => x % 2).length;
      txt(cnt, '奇數度頂點：' + odd + ' 個');
      say('加 {' + 'abcdef'[u] + ',' + 'abcdef'[v] + '}：兩端奇偶各翻一次', '奇點數只會 +2、−2 或不變 → 永遠偶數');
      await w(1300);
    }
    say('度數序列 (3,3,3,2,2)：總和 13 是奇數', '不可能是任何圖的度數 ✘');
    await w(3200);
  }
  async function scKn(tok) {
    fresh([0, 7, 11], [0, 1.4, 0]);
    const w = (ms) => beat(tok, ms);
    say('完全圖 Kₙ：任兩點之間都有一條邊', '|E| = C(n,2) = n(n−1)/2');
    let G = null;
    for (let n = 1; n <= 6; n++) {
      if (G) lab.clear();
      const D = kn(n);
      G = mkGraph(D.names, D.pos, []);
      for (const [u, v] of D.edges) { addEdge(G, u, v, 0, PAL[u % 8]); if (n <= 4) await w(220); }
      tag('K' + n, 'ptr alt', 0, 3.6, 0);
      say('K' + n + '：' + n + ' 個點', n + '(' + n + '−1)/2 = ' + n * (n - 1) / 2 + ' 條邊');
      await w(n < 6 ? 1500 : 2600);
    }
    say('Kₙ 每個點的度數都是 n − 1', 'Σdeg = n(n−1) = 2|E| ✔');
    await w(2800);
  }
  async function scCnWnQn(tok) {
    fresh([0, 7, 11], [0, 1.6, 0]);
    const w = (ms) => beat(tok, ms);
    let D = cn(6), G = mkGraph(D.names, D.pos, []);
    for (const [u, v] of D.edges) { addEdge(G, u, v, 0, COL.blue); await w(300); }
    say('環 C₆：繞一圈，每點度數 2', 'Cₙ（n ≥ 3）有 n 個點、n 條邊');
    await w(2400);
    const hub = V3(0, 1.9, 0); G.V.push({ name: 'g', p: hub.clone().add(V3(0, 3, 0)), m: node('g', hub.clone().add(V3(0, 3, 0)), COL.gold) });
    await morph(w, G, [...G.V.slice(0, 6).map((v) => v.p.clone()), hub], 700);
    for (let i = 0; i < 6; i++) { addEdge(G, i, 6, 0, COL.gold); await w(220); }
    say('輪 W₆：C₆ 加一個中心點連到每個點', 'Wₙ 有 n + 1 個點、2n 條邊');
    await w(2600);
    lab.clear();
    D = qn(3); G = mkGraph(D.names, D.pos, [], { r: 0.3 });
    for (const [u, v] of D.edges) { addEdge(G, u, v, 0, PAL[Math.log2(u ^ v)]); await w(160); }
    say('超立方體 Q₃：頂點 = 3 位元字串', '只差一個 bit 的兩點相連');
    await w(2600);
    say('Qₙ：2ⁿ 個點、每點度數 n', '|E| = n·2ⁿ⁻¹ → Q₃ 有 12 條邊');
    await w(3000);
  }
  async function scBipartite(tok) {
    fresh([0, 7, 11], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    let D = kmn(3, 3), G = mkGraph(D.names, D.pos, []);
    G.V.forEach((v, i) => paintV(G, i, i < 3 ? COL.blue : COL.pink));
    for (const [u, v] of D.edges) { addEdge(G, u, v); await w(200); }
    say('完全二分圖 K₃,₃：V 分兩群，邊只連不同群', 'K_{m,n} 有 m·n 條邊 → 9');
    await w(2800);
    lab.clear();
    D = cn(6); G = mkGraph(D.names, D.pos, D.edges);
    say('C₆ 是二分圖嗎？用 BFS 輪流塗兩色', '');
    await w(1600);
    const r6 = bipart(G);
    for (let i = 0; i < 6; i++) { paintV(G, i, r6.color[i] ? COL.pink : COL.blue); await w(380); }
    say('相鄰都不同色 → 二分圖', '偶數環可以兩色');
    await w(2400);
    lab.clear();
    D = cn(5); G = mkGraph(D.names, D.pos, D.edges);
    const cols = [0, 1, 0, 1, 0];
    for (let i = 0; i < 5; i++) { paintV(G, i, cols[i] ? COL.pink : COL.blue); await w(450); }
    paintE(G.E[4], COL.hot, true);
    say('C₅：繞回來 e、a 同色 → 衝突', '圖是二分圖 ⇔ 沒有奇數長度的環');
    await w(3400);
  }
  async function scIsoRelabel(tok) {
    fresh([0, 7.5, 10.5], [0, 1.0, 0]);
    const w = (ms) => beat(tok, ms);
    const P = ISO.c5;
    const G = build(shiftD(P.G(), -3.4), { color: '#bcd3ee' }), H = build(shiftD(P.H(), 3.4), { color: '#f2c6da' });
    tag('G：五邊形', 'ptr', -3.4, 0, 3.0); tag('H：五角星', 'ptr alt', 3.4, 0, 3.0);
    say('兩張圖長得很不一樣……', '都是 5 點、5 條邊、每點 2 度');
    await w(2800);
    const f = findIso(G, H);
    f.forEach((j, i) => { paintV(G, i, PAL[i]); paintV(H, j, PAL[i]); });
    say('找對應 f：同色的點互相對應', f.map((j, i) => G.V[i].name + '→' + H.V[j].name).join('  '));
    await w(3000);
    const target = H.V.map(() => null); f.forEach((j, i) => { target[j] = G.V[i].p.clone().add(V3(6.8, 0, 0)); });
    say('把 H 的點搬到對應的位置', '');
    await morph(w, H, target, 2200);
    say('H 變成五邊形：G ≅ H（同構）', '{u,v} ∈ E(G) ⇔ {f(u),f(v)} ∈ E(H)');
    await w(3400);
  }
  async function scIsoInv(tok) {
    fresh([0, 7.5, 10.5], [0, 1.0, 0]);
    const w = (ms) => beat(tok, ms);
    let G = build(shiftD(ISO.c6.G(), -3.4)), H = build(shiftD(ISO.c6.H(), 3.4));
    say('C₆ vs 兩個三角形：6 點、6 邊、每點 2 度', '不變量都一樣？');
    await w(2800);
    H.E.slice(0, 3).forEach((e) => paintE(e, COL.hot, true));
    say('H 不連通、有三角形；G 連通、沒有三角形', '<span class="no">連通塊數不同 → 不同構</span>');
    await w(3200);
    lab.clear();
    G = build(shiftD(ISO.k33.G(), -3.4)); H = build(shiftD(ISO.k33.H(), 3.4));
    say('K₃,₃ vs 三角柱：都是 6 點、9 邊、3-正則', '度數序列一樣');
    await w(2800);
    H.E.slice(0, 3).forEach((e) => paintE(e, COL.hot, true));
    say('三角柱有三角形；K₃,₃ 是二分圖，沒有奇數環', '<span class="no">不同構</span>：度數序列相同不代表同構');
    await w(3400);
  }
  async function scKonig(tok) {
    fresh([0, 8, 10.5], [0.4, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    euDeco('konig');
    const G = build(konig()); eu.G = G;
    eu.tokn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: COL.hot })); lab.world.add(eu.tokn);
    say('Königsberg：四塊陸地、七座橋', '每座橋恰好走一次，可能嗎？');
    await w(2800);
    say('陸地 = 頂點、橋 = 邊（有重邊）', 'deg(A) = 5，deg(B) = deg(C) = deg(D) = 3');
    G.V.forEach((v, i) => { txt(v.m.userData.lbl, v.name + ':' + deg(G)[i]); paintV(G, i, COL.pink); });
    await w(3000);
    say('試走看看：B → A → C → A → D → B → A', '');
    let v = 1; eu.tokn.position.copy(G.V[1].p);
    for (const ei of [0, 2, 3, 4, 5, 1]) { v = await walkEdge(w, G, ei, v, 700, PAL[ei]); }
    say('回到 A 卡住了：A 的 5 座橋都走過，C–D 那座還沒走', '');
    await w(2400);
    say('中途經過一點要「進一次、出一次」→ 用掉偶數條邊', '只有起點、終點可以是奇數度');
    await w(3000);
    say('4 個奇點 > 2 → 不可能（Euler, 1736）', '連通圖：0 個奇點 ⇔ Euler 迴路；2 個 ⇔ Euler 路徑');
    await w(3400);
  }
  async function scEulerCircuit(tok) {
    fresh([0, 6.5, 11], [0, 2.4, 0]);
    const w = (ms) => beat(tok, ms);
    const G = build(octa()); eu.G = G;
    eu.tokn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: COL.hot })); lab.world.add(eu.tokn);
    G.V.forEach((v, i) => txt(v.m.userData.lbl, v.name + ':4'));
    say('八面體：6 個頂點，每點度數 4', '全是偶數 → 有 Euler 迴路');
    await w(2800);
    const r = eulerTrail(G);
    let v = r.verts[0]; eu.tokn.position.copy(G.V[v].p);
    for (let k = 0; k < r.edges.length; k++) {
      v = await walkEdge(w, G, r.edges[k], v, 420, PAL[k % 8]);
      say('第 ' + (k + 1) + ' / 12 條邊', r.verts.slice(0, k + 2).map((i) => G.V[i].name).join('→'));
    }
    say('12 條邊各走一次，回到起點 ' + G.V[r.verts[0]].name, 'Euler 迴路');
    await w(3200);
  }
  async function scEulerHouse(tok) {
    fresh([0, 3.5, 12], [0, 2.8, 0]);
    const w = (ms) => beat(tok, ms);
    const G = build(house()); eu.G = G;
    eu.tokn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: COL.hot })); lab.world.add(eu.tokn);
    const d = deg(G);
    G.V.forEach((v, i) => { txt(v.m.userData.lbl, v.name + ':' + d[i]); paintV(G, i, d[i] % 2 ? COL.pink : COL.node); });
    say('一筆畫房子：度數 3, 3, 4, 4, 2', '恰好 2 個奇點（左下 1、右下 2）');
    await w(3000);
    const r = eulerTrail(G);
    let v = r.verts[0]; eu.tokn.position.copy(G.V[v].p);
    say('從一個奇點出發', '');
    await w(1200);
    for (let k = 0; k < r.edges.length; k++) { v = await walkEdge(w, G, r.edges[k], v, 600, PAL[k % 8]); }
    say('結束在另一個奇點：Euler 路徑', r.verts.map((i) => G.V[i].name).join(' → '));
    await w(3000);
    say('從 4 度的點出發就會失敗', '有 2 個奇點時，路徑必定從一個奇點走到另一個');
    await w(3000);
  }
  async function scDodeca(tok) {
    fresh([0, 5.5, 11], [0, 2.9, 0]);
    const w = (ms) => beat(tok, ms);
    const G = build(dodeca(), { r: 0.26 });
    say('Hamilton 的遊戲：十二面體的 20 個頂點', '每個頂點恰好經過一次、回到起點');
    await w(3000);
    const r = hamSearch(G, true, 0);
    const P = r.found;
    const ek = (a, b) => G.E.findIndex((e) => (e.u === a && e.v === b) || (e.v === a && e.u === b));
    for (let k = 0; k < P.length; k++) {
      paintV(G, P[k], COL.gold);
      if (k) paintE(G.E[ek(P[k - 1], P[k])], COL.green, true);
      say('第 ' + (k + 1) + ' / 20 個頂點', '');
      await w(420);
    }
    paintE(G.E[ek(P[19], P[0])], COL.green, true);
    say('回到起點：Hamilton 迴路', '經過每個「頂點」一次（Euler 是每條「邊」一次）');
    await w(3000);
    say('沒有簡單的充要條件', 'Dirac：每點度數 ≥ n/2 → 一定有（只是充分條件）');
    await w(3200);
  }
  async function scHamFail(tok) {
    fresh([0, 7, 10.5], [0, 1.0, 0]);
    const w = (ms) => beat(tok, ms);
    let D = kmn(2, 3), G = mkGraph(D.names, D.pos, D.edges);
    G.V.forEach((v, i) => paintV(G, i, i < 2 ? COL.blue : COL.pink));
    say('K₂,₃ 有沒有 Hamilton 迴路？', '藍 2 個、粉紅 3 個');
    await w(2600);
    const tryP = [2, 0, 3, 1, 4];
    const ek = (a, b) => G.E.findIndex((e) => (e.u === a && e.v === b) || (e.v === a && e.u === b));
    for (let k = 1; k < tryP.length; k++) { paintE(G.E[ek(tryP[k - 1], tryP[k])], COL.gold, true); await w(700); }
    say('迴路一定藍、粉交替 → 兩邊點數要相等', '粉 v3 → 藍？藍都用完了 ✘');
    await w(3200);
    lab.clear();
    D = cube3(); G = mkGraph(D.names, D.pos, D.edges);
    say('Q₃：每點度數 3 < 8/2，Dirac 不成立', '但還是有 Hamilton 迴路');
    await w(2400);
    const r = hamSearch(G, true, 0), P = r.found;
    const ek2 = (a, b) => G.E.findIndex((e) => (e.u === a && e.v === b) || (e.v === a && e.u === b));
    for (let k = 1; k <= P.length; k++) { paintE(G.E[ek2(P[k - 1], P[k % P.length])], COL.green, true); paintV(G, P[k - 1], COL.gold); await w(380); }
    say('Dirac 只是充分條件，不是必要條件', P.map((i) => G.V[i].name).join('→') + '→' + G.V[P[0]].name);
    await w(3400);
  }
  async function scPlanarK4(tok) {
    fresh([0, 9, 9], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    const D = k4(), G = build(D);
    paintE(G.E[4], COL.hot, true); paintE(G.E[5], COL.hot, true);
    say('K₄ 畫成正方形：兩條對角線交叉', '換個畫法能不能不交叉？');
    await w(2800);
    say('把 d 拉進三角形 abc 裡面', '');
    await morph(w, G, D.posP, 2000);
    G.E.forEach((e) => paintE(e, COL.edge, false));
    say('沒有交叉了 → K₄ 是平面圖', '');
    await w(2000);
    await countFaces(w, G, D, 1100);
    say('v − e + f = 4 − 6 + 4 = 2', 'Euler 公式（連通平面圖）');
    await w(3400);
  }
  async function scCubeFaces(tok) {
    fresh([0, 9, 9], [0, 1.4, 0]);
    const w = (ms) => beat(tok, ms);
    const D = cube3(), G = build(D);
    say('立方體：8 個頂點、12 條邊、6 個面', '把它壓扁成平面圖');
    await w(2800);
    say('從上面那個面往下壓', '上面的正方形變大、下面的變小');
    await morph(w, G, D.posP, 2400);
    await w(800);
    await countFaces(w, G, D, 900);
    say('外框那一面 = 原本上面那一面', 'v − e + f = 8 − 12 + 6 = 2');
    await w(3400);
  }
  async function scNonPlanar(tok) {
    fresh([0, 8, 10], [0, 1.0, 0]);
    const w = (ms) => beat(tok, ms);
    let D = kn(5), G = build(D);
    say('K₅ 是平面圖嗎？', 'v = 5，e = 10');
    await w(2400);
    say('平面圖每個面至少 3 條邊：3f ≤ 2e', '代入 Euler 公式 → e ≤ 3v − 6');
    await w(3000);
    G.E.forEach((e) => paintE(e, COL.hot, false));
    say('K₅：e = 10 > 3·5 − 6 = 9', '<span class="no">不可能是平面圖</span>');
    await w(3000);
    lab.clear();
    D = kmn(3, 3); G = build(D);
    G.V.forEach((v, i) => paintV(G, i, i < 3 ? COL.blue : COL.pink));
    say('K₃,₃：e = 9 ≤ 3·6 − 6 = 12，沒被排除', '但它沒有三角形');
    await w(3000);
    say('沒有三角形 → 每面至少 4 條邊：4f ≤ 2e', 'e ≤ 2v − 4 = 8 < 9 → 不是平面圖');
    G.E.forEach((e) => paintE(e, COL.hot, false));
    await w(3200);
    say('Kuratowski：非平面 ⇔ 含 K₅ 或 K₃,₃ 的細分', '這兩個是「最小」的非平面圖');
    await w(3200);
  }
  async function scColoring(tok) {
    fresh([0, 7, 10.5], [0, 1.4, 0]);
    const w = (ms) => beat(tok, ms);
    say('著色：相鄰的頂點不同色', '色數 χ(G) = 最少要幾色');
    await w(2400);
    const show = async (D, cap, f, x) => {
      const G = build({ ...D, pos: D.pos.map((p) => p.clone().multiplyScalar(0.62).add(V3(x, 0.2, 0))) }, { r: 0.28 });
      const r = chroma(G);
      for (let i = 0; i < G.V.length; i++) { paintV(G, i, PAL[r.c[i]]); await w(300); }
      tag(cap + '：χ = ' + r.k, 'ptr alt', x, 0, 2.6);
      say(cap + '：χ = ' + r.k, f);
      await w(2200);
    };
    await show(cn(6), 'C₆', '偶數環、二分圖：2 色', -4.4);
    await show(cn(5), 'C₅', '奇數環：2 色不夠 → 3', 0);
    await show(tetra(), 'K₄', '兩兩相鄰：4 色', 4.4);
    lab.clear();
    const D = octa(); const G = build({ ...D, pos: D.posP });
    say('平面圖（八面體攤平）', '四色定理：平面圖一定 χ ≤ 4');
    await w(2200);
    const r = chroma(G);
    for (let i = 0; i < G.V.length; i++) { paintV(G, i, PAL[r.c[i]]); await w(400); }
    say('這張只要 ' + r.k + ' 色', '地圖著色：國家 = 頂點、相鄰 = 邊');
    await w(3200);
  }

  const scenes = {
    'graph-terms': { title: '圖的名詞：簡單圖、多重圖、自迴圈、有向圖', play: scTerms },
    'handshake': { title: '握手定理：Σdeg(v) = 2|E|', play: scHandshake },
    'odd-degree-even': { title: '奇數度的頂點一定有偶數個', play: scOddEven },
    'special-kn': { title: '完全圖 Kₙ：n(n−1)/2 條邊', play: scKn },
    'special-cn-wn-qn': { title: '環 Cₙ、輪 Wₙ、超立方體 Qₙ', play: scCnWnQn },
    'bipartite-kmn': { title: '二分圖與 K_{m,n}：沒有奇數環', play: scBipartite },
    'iso-relabel': { title: '同構：五邊形與五角星重新標號', play: scIsoRelabel },
    'iso-invariants': { title: '不變量不同 → 不同構', play: scIsoInv },
    'konigsberg': { title: 'Königsberg 七橋：4 個奇點 → 不可能', play: scKonig },
    'euler-circuit-walk': { title: 'Euler 迴路：八面體每點 4 度', play: scEulerCircuit },
    'euler-path-house': { title: 'Euler 路徑：一筆畫房子（2 個奇點）', play: scEulerHouse },
    'hamilton-dodecahedron': { title: 'Hamilton 迴路：十二面體遊戲', play: scDodeca },
    'hamilton-fail': { title: 'K₂,₃ 沒有 Hamilton 迴路；Dirac 只是充分條件', play: scHamFail },
    'planar-k4': { title: 'K₄ 是平面圖：v − e + f = 2', play: scPlanarK4 },
    'euler-formula-cube': { title: '立方體壓成平面圖：8 − 12 + 6 = 2', play: scCubeFaces },
    'nonplanar-k5-k33': { title: 'K₅、K₃,₃ 不是平面圖', play: scNonPlanar },
    'graph-coloring': { title: '著色與色數 χ', play: scColoring },
  };

  return {
    kicker: '離散數學・第 7 章',
    title: '圖論（基礎）：度數、Euler、Hamilton、平面圖',
    color: 'var(--dm)',
    modes: [
      { id: 'degree', name: '度數與握手', enter: enterDegree },
      { id: 'special', name: '特殊圖', enter: enterSpecial },
      { id: 'iso', name: '同構', enter: enterIso },
      { id: 'euler', name: 'Euler 路徑', enter: enterEuler },
      { id: 'hamilton', name: 'Hamilton 路徑', enter: enterHamilton },
      { id: 'planar', name: '平面圖與著色', enter: enterPlanar },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'graph-terms', 'handshake', 'odd-degree-even',
      'special-kn', 'special-cn-wn-qn', 'bipartite-kmn',
      'iso-relabel', 'iso-invariants',
      'konigsberg', 'euler-circuit-walk', 'euler-path-house',
      'hamilton-dodecahedron', 'hamilton-fail',
      'planar-k4', 'euler-formula-cube', 'nonplanar-k5-k33', 'graph-coloring',
    ],
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
