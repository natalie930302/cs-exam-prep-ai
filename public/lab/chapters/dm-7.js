// 離散數學 第7章：圖論（基礎）— 名詞、度數與握手定理、特殊圖（Kₙ、Cₙ、Wₙ、Qₙ、K_{m,n}）、二分圖、同構、
// Euler 路徑／迴路、Hamilton 路徑／迴路、平面圖與 Euler 公式 v − e + f = 2、著色與色數。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec22–23、趙啟超 第18–19講）目前都沒有逐字稿，場景全部依課本（Rosen 第 10 章、Grimaldi 第 11 章）：
//   Rosen 慣例：自迴圈（loop）對度數貢獻 2；Wₙ = Cₙ 加一個中心點（共 n+1 點）；Qₙ 有 2ⁿ 點、n·2ⁿ⁻¹ 條邊。
//   Königsberg 七橋（度數 5、3、3、3）、一筆畫房子、Hamilton 的十二面體遊戲、K₂,₃ 沒有 Hamilton 迴路、
//   K₄ 與立方體攤平成平面圖、K₅（e ≤ 3v − 6）與 K₃,₃（e ≤ 2v − 4）不是平面圖、色數 χ。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let mtok = 0, busy = false;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const rnd = (n) => Math.floor(Math.random() * n);
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
    // turned so that no two of the 20 vertices (and their numbers) line up from the camera
    const ay = 1.56, ax = 0.34;
    const pos = raw.map(([x, y, z]) => { const X = x * Math.cos(ay) + z * Math.sin(ay), Z0 = -x * Math.sin(ay) + z * Math.cos(ay); const Y = y * Math.cos(ax) - Z0 * Math.sin(ax), Z = y * Math.sin(ax) + Z0 * Math.cos(ax); return V3(X * 1.55, 2.9 + Y * 1.55, Z * 1.55); });
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
    controls('<select id="sK"><option value="K">完全圖 Kₙ</option><option value="C">環 Cₙ</option><option value="W">輪 Wₙ</option><option value="Q">超立方體 Qₙ</option><option value="B">完全二分圖 Kₘ,ₙ</option><option value="P">Petersen 圖</option></select>'
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
    else if (sp.kind === 'B') { if (n < 1 || n > 5 || m < 1 || m > 5) return log('Kₘ,ₙ：m、n 請用 1～5。', true); D = kmn(m, n); info = ['K' + '₀₁₂₃₄₅'[m] + ',' + '₀₁₂₃₄₅'[n], (m + n) + ' 點', 'm·n = ' + m * n]; }
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
      const [s] = seqs[rnd(seqs.length)]; const sum = s.split(',').map(Number).reduce((a, b) => a + b, 0), ok = sum % 2 === 0;
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
    if (t === 6) { const v = 5 + rnd(10), f = 3 + rnd(Math.min(8, 2 * v - 6)), e = v + f - 2; /* f ≤ 2v − 4 keeps e ≤ 3v − 6 */ return { q: '一個連通平面圖有 ' + v + ' 個頂點、' + f + ' 個面（含外面），有幾條邊？', opts: uniq(e, [v + f, v + f + 2, v * f / 2 | 0]), ans: String(e), why: 'Euler 公式 v − e + f = 2 → e = v + f − 2 = ' + e + '。' }; }
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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    say('完全二分圖 K₃,₃：V 分兩群，邊只連不同群', 'Kₘ,ₙ 有 m·n 條邊 → 9');
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
    'bipartite-kmn': { title: '二分圖與 Kₘ,ₙ：沒有奇數環', play: scBipartite },
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ gr.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const icon = P.icon;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 7 章（清大 趙啟超 第18A–19C講、交大 易志偉 Lec22–23 Graphs）— cued scenes ───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師板書上的例子照用（點名、邊、數字）；板書看不到、為了畫面補的例子一律在舞台上標「示意」。
// 所有度數、邊數都由程式從真的邊算出來（deg()），不手寫。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const CAMG = [[0, 7.2, 11.2], [0, 1.3, 0]];
const CAMW = [[0, 8.2, 12.4], [0, 1.0, 0]];
const CAMT = [[0, 9.5, 8.6], [0, 0.4, 0.2]];
function scene(id, title, steps, cam = CAMG) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const MONOS = P.MONO;
const M = (t, x, y, z = 0, c = '') => { const l = L(t, c, x, y, z); Object.assign(l.element.style, MONOS); return l; };
const DEMO = (x, y, z = 0) => T('示意', 'idx', x, y, z);
// a board: lines appear one under another (left-aligned); the newest line is lit.
// At most `max` lines are kept: the oldest scrolls off the top.
function board(x, yTop, dy = 0.56, z = -2.6, max = 7) {
  // lines closer than this print over each other on the 640×360 stage; keep the board's height (fewer lines, they scroll off sooner)
  { const h = max * dy; dy = Math.max(dy, z < -3 ? 0.9 : 0.82); max = Math.max(3, Math.floor(h / dy + 0.35)); }
  const ls = []; let last = null;
  return {
    ls,
    add(t, c = 'note') {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      if (ls.length >= max) { kill(ls.shift()); ls.forEach((l) => { l.position.y += dy; }); }
      const l = L(t, c, x, yTop - ls.length * dy, z); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
    set(i, c) { cls(ls[i < 0 ? ls.length + i : i], c); },
    clear() { ls.forEach((l) => kill(l)); ls.length = 0; last = null; },
  };
}
// ── graphs on the floor (x–z plane): reuse the module's node()/addEdge()/paintE()/deg() ──
function gv(G, n, x, z, y = 0.5, color, r) { const p = V3(x, y, z); G.ix[n] = G.V.length; G.V.push({ name: String(n), p: p.clone(), m: node(n, p, color || COL.node, r || 0.3) }); return G.ix[n]; }
function gnew(spec, o = {}) { const G = { V: [], E: [], ix: {} }; spec.forEach(([n, x, z, y]) => gv(G, n, x, z, y === undefined ? 0.5 : y, o.color, o.r)); return G; }
const vi = (G, n) => (typeof n === 'number' ? n : G.ix[n]);
function ge(G, a, b, o = {}) { return addEdge(G, vi(G, a), vi(G, b), o.bend || 0, o.color, !!o.dir); }
// "ab ac bd" → edges (one-letter vertex names)
const ges = (G, s, o) => s.split(' ').map((p) => ge(G, p[0], p[1], o));
const vlab = (G, n, t) => txt(G.V[vi(G, n)].m.userData.lbl, String(t));
const vcol = (G, n, c) => G.V[vi(G, n)].m.material.color.set(c);
const vglow = (G, n, c) => glow(G.V[vi(G, n)].m, c);
const findE = (G, a, b) => G.E.find((e) => (e.u === vi(G, a) && e.v === vi(G, b)) || (e.v === vi(G, a) && e.u === vi(G, b)));
const degOf = (G, n) => deg(G)[vi(G, n)];
const sumDeg = (G) => deg(G).reduce((a, b) => a + b, 0);
function gkill(G) { G.E.forEach((e) => { kill(e.m); if (e.arrow) kill(e.arrow); }); G.V.forEach((v) => kill(v.m)); G.E.length = 0; G.V.length = 0; }
const showDeg = (G) => { const d = deg(G); G.V.forEach((v, i) => txt(v.m.userData.lbl, v.name + ':' + d[i])); };
const plainLab = (G) => G.V.forEach((v) => txt(v.m.userData.lbl, v.name));
async function mv(tok, G, target, ms = 1400) { await morph((m) => wt(tok, m), G, target, ms); }
function shift(G, dx, dz = 0) { G.V.forEach((v) => { v.p.add(V3(dx, 0, dz)); v.m.position.copy(v.p); }); updateEdges(G); }
function tokenAt(G, n) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: COL.hot }));
  m.position.copy(G.V[vi(G, n)].p).add(V3(0, 0.35, 0)); lab.world.add(m); return m;
}
async function walk(tok, G, tk, a, b, ms = 650, color = COL.gold) {
  const e = findE(G, a, b), fwd = e.u === vi(G, a);
  await anim(tok, ms, (u) => { const p = e.curve.getPoint(fwd ? u : 1 - u); tk.position.set(p.x, p.y + 0.35, p.z); });
  if (color) paintE(e, color, true);
  return e;
}
// a small matrix drawn as monospace rows; rows appear one by one with row(i)
function matrix(head, rows, x, yTop, dy = 0.48, z = -2.4) {
  dy = Math.max(dy, z < -2 ? 0.74 : dy);
  const H = M(head, x, yTop, z, 'say'); const R = [];
  return { H, R, row(i) { R[i] = M(rows[i], x, yTop - (i + 1) * dy, z, 'note'); if (i > 0 && R[i - 1]) cls(R[i - 1], 'say'); return R[i]; }, all() { rows.forEach((_, i) => { if (!R[i]) this.row(i); }); }, kill() { kill(H); R.forEach((l) => l && kill(l)); } };
}


// ════════ xDNyQRMyLCM（清大 趙啟超 第18A講：Directed / Undirected graph、Adjacency matrix、Isomorphism） ════════
const A4 = [['a', 1.0, -1.7], ['b', 4.4, -1.7], ['c', 1.0, 1.6], ['d', 4.4, 1.6]];
scene('gr-18a-def', 'Graph 的定義：G = (V, E)、directed graph', [
  async (tok, S) => { S.B = board(-6.6, 4.6); S.B.add('graph（圖）'); cap('什麼叫做 graph？', '先簡介定義'); },
  async (tok, S) => { S.B.add('第一種：directed graph（簡稱 digraph）'); cap('第一種：directed graph', '有方向的圖，簡稱 digraph'); },
  async (tok, S) => { S.B.add('一個 graph 有兩個集合'); cap('一個 graph 由兩個集合組成', ''); },
  async (tok, S) => { S.B.add('第一個集合：V'); S.vz = zone('V', 2.7, 0.02, 0, 5.6, 4.6, '#e3edf7'); cap('第一個集合叫 V', ''); },
  async (tok, S) => { S.B.add('V：finite、non-empty set（有限、非空）'); cap('V 是有限、而且不是空的集合', '至少要有一個點'); },
  async (tok, S) => {
    S.G = gnew(A4); DEMO(6.0, 0.4, 0.6);
    S.B.add('V 的元素叫 vertices（端點）'); cap('V 裡的元素叫做 vertices', '畫成小圓圈');
  },
  async (tok, S) => { S.vv = T('單數 vertex／複數 vertices', 'ptr', 2.7, 0.5, 3.8); cap('單數 vertex，複數 vertices', '中文：端點、頂點'); },
  async (tok, S) => { S.B.add('第二個集合：E'); cap('第二個集合叫 E', ''); },
  async (tok, S) => { S.B.add('directed graph：E ⊆ V × V'); cap('E 是 V × V 的子集合', 'V × V：Cartesian product'); },
  async (tok, S) => { S.B.add('V × V = 所有 ordered pair (u, v)'); kill(S.vv); T('(a,a) (a,b) … (d,d)：4 × 4 = 16 個', 'say', 2.7, 0.5, 3.8); cap('V × V：所有前後都在 V 裡的 ordered pair', '有順序的一對'); },
  async (tok, S) => {
    ge(S.G, 'a', 'b', { dir: true }); ge(S.G, 'b', 'd', { dir: true }); ge(S.G, 'c', 'a', { dir: true });
    S.B.add('E 的元素叫 edges（邊）'); cap('E 裡的元素叫做 edges（邊）', '單數 edge');
  },
  async (tok, S) => { S.B.add('graph = 端點集合 + 邊集合'); cap('一個 graph 就是這兩個集合', '端點的集合、邊的集合'); },
  async (tok, S) => { S.B.add('G = (V, E)', 'good'); cap('通常寫成 G = (V, E)', '寫出 V 和 E，圖就描述清楚了'); },
  async (tok, S) => {
    paintE(S.G.E[0], COL.hot, true); vglow(S.G, 'a', GOLD); vglow(S.G, 'b', GOLD);
    S.B.add('(a, b)：從 a 指向 b，有方向'); cap('directed graph：邊有方向', '(a, b) 是 a → b');
  },
], CAMW);

scene('gr-18a-undir', 'Undirected graph 與它的例子：4 個端點、5 條邊', [
  async (tok, S) => { S.B = board(-6.6, 4.6); S.B.add('另一種：undirected graph（無向圖）'); cap('另一種 graph：undirected graph', '邊沒有方向'); },
  async (tok, S) => { S.B.add('E 的元素是 unordered pair {u, v}'); cap('edge set 裡都是 unordered pair', '沒有順序：{u, v} = {v, u}'); },
  async (tok, S) => { S.B.add('→ undirected graph'); cap('這樣的 graph 叫 undirected graph', '有沒有方向，只看邊'); },
  async (tok, S) => { S.B.add('V：vertex set　E：edge set'); cap('V 叫 vertex set，E 叫 edge set', '大寫 V、大寫 E'); },
  async (tok, S) => { S.B.add('定義一個圖 = 描述這兩個集合'); cap('要定義一個圖', '就把這兩個集合描述清楚'); },
  async (tok, S) => { S.B.add('例：V = {a, b, c, d}'); S.G = gnew(A4); cap('舉例：四個端點 a、b、c、d', ''); },
  async (tok, S) => { S.B.add('E = {{a,b}, {a,c}, {a,d}, {b,d}, {c,d}}'); cap('edge set 是這五個集合', ''); },
  async (tok, S) => { S.B.add('每個元素都是集合 → 沒有順序', 'good'); cap('{a, b} 是集合，沒有順序', '所以這是 undirected graph'); },
  async (tok, S) => { T('端點畫成小圓圈', 'ptr', 2.7, 1.6, -2.7); cap('畫出來：端點用小圓圈', '有邊的地方連一條線'); },
  async (tok, S) => { paintE(ge(S.G, 'a', 'b'), COL.gold, true); cap('{a, b}：a、b 之間一條邊', ''); },
  async (tok, S) => {
    paintE(S.G.E[0], COL.edge, false);
    for (const s of ['ac', 'ad', 'bd', 'cd']) { ge(S.G, s[0], s[1]); await wt(tok, 260); }
    cap('還有 ac、ad、bd、cd', '');
  },
  async (tok, S) => { S.cnt = T('|V| = ' + S.G.V.length + '，|E| = ' + S.G.E.length, 'good', 2.7, 0.3, 3.1); cap('一共 ' + S.G.E.length + ' 條邊、' + S.G.V.length + ' 個端點', ''); },
  async (tok, S) => {
    const t = S.G.V.map((v) => v.p.clone()); t[0] = V3(2.7, 0.5, 3.2);
    await mv(tok, S.G, t, 1300); kill(S.cnt);
    cap('畫法不唯一：a 也可以畫在下面', '');
  },
  async (tok, S) => { T('同一個圖：只是畫法不同', 'good', 2.7, 2.2, -2.7); cap('數學定義是同一個圖', '只是怎麼畫而已'); },
], CAMW);

scene('gr-18a-direx', 'Directed graph 的例子：E ⊆ V × V', [
  async (tok, S) => { S.B = board(-6.6, 4.6); S.B.add('再舉一個 directed graph 的例子'); cap('再看一個例子：directed graph', ''); },
  async (tok, S) => { S.B.add('V = {a, b, c, d}：4 個 vertices'); S.G = gnew(A4); cap('vertex set 一樣是四個 vertices', ''); },
  async (tok, S) => { S.B.add('E = {(a,b), (a,c), (a,d), (b,d), (c,d)}'); cap('edge 也是五個', '這次寫成 ordered pair'); },
  async (tok, S) => { S.B.add('都是 ordered pair：E ⊆ V × V'); cap('ordered pair：是 V × V 的元素', ''); },
  async (tok, S) => { S.B.add('V × V 有 4 × 4 = 16 個，E 只取 5 個'); cap('全部可能的 ordered pair 有 16 個', '這裡只用 5 個：是一個 subset'); },
  async (tok, S) => { S.B.add('有順序 → directed graph', 'good'); cap('有順序關係', '所以是 directed graph'); },
  async (tok, S) => { cap('把它畫出來', ''); T('畫出來', 'ptr', 2.7, 1.6, -2.7); },
  async (tok, S) => { paintE(ge(S.G, 'a', 'b', { dir: true }), COL.hot, true); cap('(a, b)：從 a 到 b', '在邊上畫箭頭表示方向'); },
  async (tok, S) => {
    paintE(S.G.E[0], COL.edge, false);
    for (const s of ['ac', 'ad', 'bd', 'cd']) { ge(S.G, s[0], s[1], { dir: true }); await wt(tok, 260); }
    cap('a 到 c、a 到 d、b 到 d、c 到 d', '每條都有方向');
  },
  async (tok, S) => { S.B.add('差別：邊有沒有方向'); cap('directed 和 undirected 的差別', '就是邊有沒有方向'); },
  async (tok, S) => { S.B.add('描述 graph = 描述 V 和 E'); cap('不管哪一種', '定義 V 跟 E 兩個集合就定義了圖'); },
], CAMW);

const UND = ['0 1 1 1', '1 0 0 1', '1 0 0 1', '1 1 1 0'], DIR = ['0 1 1 1', '0 0 0 1', '0 0 0 1', '0 0 0 0'];
scene('gr-18a-adj', 'Adjacency matrix：無向圖對稱、有向圖不一定', [
  async (tok, S) => {
    S.G = gnew(A4.map(([n, x, z]) => [n, x + 0.6, z])); ges(S.G, 'ab ac ad bd cd');
    S.B = board(-6.6, 4.9, 0.5, -2.6, 4); S.B.add('也可以用一個矩陣表示'); cap('怎麼表示一個圖？', '除了寫出集合，也可以用矩陣');
  },
  async (tok, S) => { S.B.add('adjacency matrix（相鄰矩陣）'); cap('這個矩陣叫 adjacency matrix', 'adjacent：在旁邊、有邊連著'); },
  async (tok, S) => { S.B.add('0–1 矩陣：描述有哪些邊'); cap('它是一個 0、1 矩陣', ''); },
  async (tok, S) => { S.B.add('用前面的 undirected graph'); cap('繼續用前面那個 undirected graph', 'ab、ac、ad、bd、cd'); },
  async (tok, S) => { S.Mx = matrix('    a b c d', UND.map((r, i) => 'abcd'[i] + ' │ ' + r), -6.4, 2.6); S.B.add('先說好順序：a, b, c, d'); cap('先講好端點的順序', 'a、b、c、d'); },
  async (tok, S) => { S.Mx.row(0); ['b', 'c', 'd'].forEach((n) => paintE(findE(S.G, 'a', n), COL.gold, true)); cap('有 edge 標 1：a 跟 b、c、d 都有邊', 'a 跟 a 沒有：0'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.Mx.row(1); paintE(findE(S.G, 'b', 'a'), COL.gold, true); paintE(findE(S.G, 'b', 'd'), COL.gold, true); cap('b：ba 有邊、bd 有邊', ''); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.Mx.row(2); paintE(findE(S.G, 'c', 'a'), COL.gold, true); paintE(findE(S.G, 'c', 'd'), COL.gold, true); cap('c：ca 有邊、cd 有邊', ''); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.Mx.row(3); ['a', 'b', 'c'].forEach((n) => paintE(findE(S.G, 'd', n), COL.gold, true)); cap('d：跟 a、b、c 都有邊', ''); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.B.add('第 i 列第 j 行：兩點之間有沒有邊'); cap('矩陣描述兩個端點之間有沒有邊', '有邊寫 1、沒邊寫 0'); },
  async (tok, S) => { S.ex = ge(S.G, 'a', 'c', { bend: 0.8, color: COL.pink }); T('示意：若 a、c 之間有 2 條邊 → 寫 2', 'idx', 3.0, 2.4, 2.8); cap('有些 case 兩點之間不只一條邊', '例如 ac 有兩條，就寫 2'); },
  async (tok, S) => { removeEdge(S.G, S.ex); S.B.add('undirected：有 ab 就有 ba'); cap('undirected graph：有 ab 就有 ba', '邊沒有方向'); },
  async (tok, S) => { S.B.add('→ symmetric matrix（對稱矩陣）', 'good'); cap('所以矩陣一定是 symmetric', '沿著對角線兩邊對稱'); },
  async (tok, S) => { S.B.add('4 × 4 方陣'); cap('它是 4 × 4 的正方形矩陣', ''); },
  async (tok, S) => {
    S.Mx.kill(); S.G.E.slice().forEach((e) => removeEdge(S.G, e)); ['ab', 'ac', 'ad', 'bd', 'cd'].forEach((s) => ge(S.G, s[0], s[1], { dir: true }));
    S.Mx = matrix('    a b c d', DIR.map((r, i) => 'abcd'[i] + ' │ ' + r), -6.4, 2.6); S.B.add('再看 directed graph 的例子'); cap('再看 directed graph 的例子', '');
  },
  async (tok, S) => { S.Mx.row(0); cap('a 到 b、a 到 c、a 到 d 都有', 'a 那一列：0 1 1 1'); },
  async (tok, S) => { S.Mx.row(1); S.Mx.row(2); S.Mx.row(3); T('不對稱', 'bad', -3.0, 0.5, -2.4); cap('b 只到 d、c 只到 d、d 沒有出去的', '有方向：不一定對稱'); },
  async (tok, S) => { S.B.add('V 上的 binary relation ↔ digraph'); cap('以前講的 binary relation', '也可以畫成 directed graph'); },
  async (tok, S) => { S.B.add('那個 0–1 矩陣就是 adjacency matrix', 'good'); cap('relation 的 0、1 矩陣', '就是這裡的 adjacency matrix'); },
  async (tok, S) => { S.B.add('要記住一個圖：存這個矩陣就好'); cap('要把圖存起來', '把這個矩陣存起來就好'); },
], CAMW);

const G1P = [['a', -5.6, -1.6], ['b', -2.6, -1.6], ['c', -2.6, 1.5], ['d', -5.6, 1.5]];
const G2P = [['t', 2.4, -1.7], ['u', 5.4, 0.0], ['v', 2.4, 1.7], ['w', 5.6, 2.6]];
scene('gr-18a-iso', 'Isomorphic：存在保持邊的 bijection', [
  async (tok, S) => { S.B = board(-6.6, 5.2, 0.5, -3.4, 5); S.B.add('兩個 graph 之間的關係'); cap('接著講一些相關的性質', '有兩個 graph'); },
  async (tok, S) => { S.B.add('先只看 undirected graph'); cap('先侷限在 undirected graph', ''); },
  async (tok, S) => {
    S.G1 = gnew(G1P, { color: '#bcd3ee' }); ges(S.G1, 'ab ad bd bc cd'); T('G₁ = (V₁, E₁)', 'ptr', -4.1, 0.1, 2.8);
    S.G2 = gnew(G2P, { color: '#f2c6da' }); ges(S.G2, 'tv tu vw vu wu'); T('G₂ = (V₂, E₂)', 'ptr alt', 4.0, 0.1, 3.4);
    DEMO(0, 0.3, 3.4); cap('G₁ = (V₁, E₁)，G₂ = (V₂, E₂)', '');
  },
  async (tok, S) => { S.B.add('G₁ 和 G₂ 叫 isomorphic，如果…'); cap('什麼時候叫做 isomorphic？', '先寫定義，再講直覺'); },
  async (tok, S) => { S.B.add('存在一個 bijection（一對一且映成）'); cap('存在一個 bijection', ''); },
  async (tok, S) => { S.B.add('f : V₁ → V₂'); cap('f 把 V₁ 的端點對應到 V₂ 的端點', '一個對一個'); },
  async (tok, S) => {
    const pairs = [['a', 't'], ['b', 'v'], ['c', 'w'], ['d', 'u']];
    pairs.forEach(([x, y], i) => { vcol(S.G1, x, PAL[i]); vcol(S.G2, y, PAL[i]); });
    cap('f 要一對一、而且映成', '同色 = 互相對應');
  },
  async (tok, S) => { paintE(findE(S.G1, 'a', 'b'), COL.gold, true); S.B.add('{a, b} 是 G₁ 的邊'); cap('假設 ab 是 G₁ 裡的一條邊', ''); },
  async (tok, S) => { S.B.add('⇔（若且唯若）'); cap('若且唯若', '推過去、也推得回來'); },
  async (tok, S) => { paintE(findE(S.G2, 't', 'v'), COL.gold, true); S.B.add('{f(a), f(b)} 是 G₂ 的邊'); cap('a、b 對應到 f(a)、f(b)', '那兩點之間也要有邊'); },
  async (tok, S) => { S.B.add('兩邊互推都成立 → isomorphic', 'good'); cap('存在這樣的 f', '兩個圖就叫 isomorphic'); },
  async (tok, S) => { S.B.add('直覺：同一個圖，只是名字不同'); cap('意思是：其實是同一個圖', 'f 只是換名字的函數'); },
  async (tok, S) => { S.G1.E.forEach((e) => paintE(e, COL.gold, true)); S.G2.E.forEach((e) => paintE(e, COL.gold, true)); cap('有邊的換了名字還是邊', '換回來也一樣'); },
  async (tok, S) => { S.B.add('有時名字不同、有時畫法不同'); cap('看起來不一樣', '可能是名字不同，或畫法不同'); },
  async (tok, S) => { S.B.add('f 叫做 isomorphism（同構）', 'good'); cap('這個對應叫 isomorphism', '所有數學性質都一樣'); },
  async (tok, S) => { S.B.add('graph isomorphism'); cap('強調在 graph 上', '就叫 graph isomorphism'); },
], CAMW);


// ════════ vNXSZd63tuw（清大 趙啟超 第18B講：isomorphism 的例子、Petersen graph、應用） ════════
const MAP18 = [['a', 't'], ['b', 'v'], ['d', 'u'], ['c', 'w']];
scene('gr-18b-pair', '兩個圖 G₁、G₂：乍看不一樣', [
  async (tok, S) => { S.G1 = gnew(G1P, { color: '#bcd3ee' }); T('G₁', 'ptr', -4.1, 0.1, 2.8); cap('undirected graph G₁', '四個端點 a、b、c、d'); },
  async (tok, S) => { for (const s of ['ab', 'ad', 'bd', 'bc', 'cd']) { ge(S.G1, s[0], s[1]); await wt(tok, 220); } T('|E₁| = ' + S.G1.E.length, 'good', -4.1, 1.6, -2.6); cap('5 條邊：ab、ad、bd、bc、cd', ''); },
  async (tok, S) => { T('V₁ = {a, b, c, d}', 'say', -4.1, 3.4, -2.6); cap('V 和 E 兩個集合很容易寫出來', ''); },
  async (tok, S) => { S.G2 = gnew(G2P, { color: '#f2c6da' }); ges(S.G2, 'tv tu vw vu wu'); T('G₂', 'ptr alt', 4.0, 0.1, 3.4); DEMO(4.0, 2.4, -2.6); cap('另一個 graph G₂', '乍看之下好像不一樣'); },
], CAMW);

scene('gr-18b-iso', '找出 isomorphism：a→t、b→v、d→u、c→w', [
  async (tok, S) => {
    S.G1 = gnew(G1P, { color: '#bcd3ee' }); ges(S.G1, 'ab ad bd bc cd'); S.G2 = gnew(G2P, { color: '#f2c6da' }); ges(S.G2, 'tv tu vw vu wu');
    S.B = board(-1.6, 5.2, 0.5, -3.4, 5); S.B.add('其實 G₁、G₂ 是 isomorphic'); cap('這兩個 graph 其實是 isomorphic', '');
  },
  async (tok, S) => { S.B.add('必要：端點數一樣（4 = 4）'); cap('第一：端點數目一定要一樣', 'bijection 兩邊大小要相同'); },
  async (tok, S) => { S.B.add('必要：邊數一樣（5 = 5）'); cap('邊的數目也一定要一樣', '邊要一條對一條'); },
  async (tok, S) => { S.B.add('數目不同 → 一定不是 isomorphic'); cap('先數一數', '數目不一樣就一定不是'); },
  async (tok, S) => { S.B.add('一樣也還不一定是'); cap('四點五邊、四點五邊', '但這還不見得是 isomorphic'); },
  async (tok, S) => { S.B.add('要找到一個對應關係 f'); cap('根據定義要找到一個對應', '把名字換掉以後一模一樣'); },
  async (tok, S) => { ['a', 'b', 'c', 'd'].forEach((n) => vglow(S.G1, n, GOLD)); cap('a、b、c、d 各要對到哪一個？', ''); },
  async (tok, S) => { ['a', 'b', 'c', 'd'].forEach((n) => vglow(S.G1, n, null)); S.B.add('有邊 ⇔ 對應過去也有邊'); cap('ab 是邊，對應過去也要是邊', '兩邊要互推'); },
  async (tok, S) => { vcol(S.G1, 'a', PAL[0]); vcol(S.G2, 't', PAL[0]); S.B.add('a → t'); cap('先讓 a 對應到 t', '這不是唯一的選法，找到一個就好'); },
  async (tok, S) => { vcol(S.G1, 'b', PAL[1]); vcol(S.G2, 'v', PAL[1]); vcol(S.G1, 'd', PAL[2]); vcol(S.G2, 'u', PAL[2]); S.B.add('b → v，d → u'); cap('a 旁邊是 b、d；t 旁邊是 v、u', '所以 b → v、d → u'); },
  async (tok, S) => { vcol(S.G1, 'c', PAL[3]); vcol(S.G2, 'w', PAL[3]); S.B.add('剩下 c → w'); cap('剩下的 c 對應到 w', ''); },
  ...[['a', 'b', 't', 'v'], ['a', 'd', 't', 'u'], ['b', 'c', 'v', 'w'], ['b', 'd', 'v', 'u'], ['c', 'd', 'w', 'u']].map(([p, q, x, y], k) => async (tok, S) => {
    paintE(findE(S.G1, p, q), COL.green, true); paintE(findE(S.G2, x, y), COL.green, true);
    if (k === 4) T('5 條邊剛好全對上 ✔', 'good', 0, 1.2, 3.6);
    cap(p.toUpperCase() + q.toUpperCase() + ' 有邊 → ' + x.toUpperCase() + y.toUpperCase() + ' 有邊 ✔', k === 4 ? '五個邊剛剛好' : '');
  }),
  async (tok, S) => { S.B.add('G₁ ≅ G₂（isomorphic）', 'good'); cap('所以這兩個 graph 是 isomorphic', ''); },
  async (tok, S) => {
    const t = S.G2.V.map(() => null);
    MAP18.forEach(([p, q]) => { t[vi(S.G2, q)] = S.G1.V[vi(S.G1, p)].p.clone().add(V3(7.9, 0, 0)); });
    await mv(tok, S.G2, t, 1800);
    cap('把 c 折過去、整個翻過來', 'G₂ 就變得跟 G₁ 一樣');
  },
  async (tok, S) => { S.B.add('只是名字不同、畫法不同'); cap('數學性質都一樣', '只是名字或畫法不同'); },
], CAMW);

const K5ish = [['1', -5.4, -1.6], ['2', -2.4, -1.6], ['3', -2.4, 1.4], ['4', -5.4, 1.4], ['5', -3.9, 3.0]];
scene('gr-18b-noniso', '不是 isomorphic：邊數 8 ≠ 7', [
  async (tok, S) => { S.B = board(-1.8, 5.2, 0.5, -3.4, 4); S.B.add('再舉一個例子'); cap('再舉一個例子', ''); },
  async (tok, S) => { S.B.add('isomorphic 的圖：討論一個就好'); cap('兩個圖 isomorphic，數學性質都一樣', '討論其中一個就夠了'); },
  async (tok, S) => { S.B.add('挑看起來比較容易的那個'); cap('可以挑看起來比較容易的那一個來討論', ''); },
  async (tok, S) => {
    S.G1 = gnew(K5ish, { color: '#bcd3ee' }); S.G2 = gnew(K5ish.map(([n, x, z]) => [n, x + 7.6, z]), { color: '#f2c6da' });
    DEMO(0, 0.4, 3.6); cap('這兩個圖是不是 isomorphic？', '');
  },
  async (tok, S) => { T('5 個端點', 'ptr', -3.9, 0.1, -2.8); T('5 個端點', 'ptr alt', 3.7, 0.1, -2.8); cap('端點：5 個、5 個', '一樣'); },
  async (tok, S) => {
    const E1 = ['12', '13', '14', '23', '24', '34', '15', '25'], E2 = ['12', '13', '14', '23', '24', '15', '25'];
    for (let k = 0; k < 8; k++) { ge(S.G1, E1[k][0], E1[k][1]); if (k < 7) ge(S.G2, E2[k][0], E2[k][1]); await wt(tok, 200); }
    T('|E₁| = ' + S.G1.E.length, 'ptr', -3.9, 0.2, 4.6); T('|E₂| = ' + S.G2.E.length, 'ptr alt', 3.7, 0.2, 4.6);
    cap('數邊：' + S.G1.E.length + ' 條 vs ' + S.G2.E.length + ' 條', '');
  },
  async (tok, S) => { S.B.add('邊數不同 → 不是 isomorphic', 'bad'); cap('所以它們不是 isomorphic', ''); },
  async (tok, S) => { S.B.add('數一數就知道：最簡單'); cap('這個例子簡單', '數一數就不對'); },
  async (tok, S) => {
    ['1', '2', '3', '4'].forEach((n) => vglow(S.G1, n, GOLD)); S.G1.E.slice(0, 6).forEach((e) => paintE(e, COL.gold, true));
    T('1、2、3、4 兩兩相連', 'good', -3.9, 2.4, 0); T('3、4 之間少一條', 'bad', 3.7, 2.4, 0);
    cap('其他性質也不同', '左邊這四點每個都連到另外三個');
  },
], CAMW);

// Petersen: outer a–e, inner f–j; G2 = the same graph renamed by the lecturer's map a→1, b→2, c→7, d→5, e→6, f→8, g→3, h→10, i→4, j→9
const PET_MAP = { a: '1', b: '2', c: '7', d: '5', e: '6', f: '8', g: '3', h: '10', i: '4', j: '9' };
const PET_E = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'a'], ['a', 'f'], ['b', 'g'], ['c', 'h'], ['d', 'i'], ['e', 'j'], ['f', 'h'], ['h', 'j'], ['j', 'g'], ['g', 'i'], ['i', 'f']];
function petG(cx, color) { const o = ring(5, 2.4, 0.5, 0, cx, 0), n = ring(5, 1.1, 0.5, 0, cx, 0); return gnew('abcdefghij'.split('').map((c, i) => [c, (i < 5 ? o[i] : n[i - 5]).x, (i < 5 ? o[i] : n[i - 5]).z]), { color }); }
function petH(cx, color) { const R = ring(10, 2.5, 0.5, 0, cx, 0); return gnew(Array.from({ length: 10 }, (_, i) => [String(i + 1), R[i].x, R[i].z]), { color }); }
const petEdgesH = () => PET_E.map(([p, q]) => [PET_MAP[p], PET_MAP[q]]);
scene('gr-18b-petersen', 'Petersen graph：10 點、15 邊、每點 3 度', [
  async (tok, S) => { S.B = board(-6.8, 5.4, 0.48, -3.4, 4); S.B.add('說不是：找一個不一樣的性質'); cap('要說兩個圖不是 isomorphic', '找到一個不一樣的數學性質就好'); },
  async (tok, S) => { S.B.add('說是：要把對應關係找出來'); cap('要說它是', '就要把那個 isomorphism 找出來'); },
  async (tok, S) => { S.G = petG(-3.3, '#bcd3ee'); for (let k = 0; k < 5; k++) ge(S.G, PET_E[k][0], PET_E[k][1]); cap('看這個圖：外面一個正五邊形', ''); },
  async (tok, S) => { for (let k = 10; k < 15; k++) ge(S.G, PET_E[k][0], PET_E[k][1]); cap('裡面也是五個點', '這樣連（隔一個連一個）'); },
  async (tok, S) => { for (let k = 5; k < 10; k++) ge(S.G, PET_E[k][0], PET_E[k][1]); cap('內外對應的點再連起來', '標上名字 a～j'); },
  async (tok, S) => { S.B.add('Petersen graph', 'good'); cap('這個圖很有名：Petersen graph', ''); },
  async (tok, S) => { cap('很漂亮、很對稱', '有很多數學性質'); T('Petersen graph', 'ptr', -3.3, 0.1, 3.2); },
  async (tok, S) => { T('|V| = ' + S.G.V.length, 'ptr alt', -3.3, 3.6, -1.5); cap('有幾個端點？' + S.G.V.length + ' 個', ''); },
  async (tok, S) => { T('|E| = 5 + 5 + 5 = ' + S.G.E.length, 'ptr alt', -3.3, 3.0, -1.5); [0, 1, 2, 3, 4].forEach((k) => paintE(S.G.E[k], COL.blue, true)); [5, 6, 7, 8, 9].forEach((k) => paintE(S.G.E[k], COL.gold, true)); [10, 11, 12, 13, 14].forEach((k) => paintE(S.G.E[k], COL.pink, true)); cap('邊：外 5、內 5、中間 5', '共 ' + S.G.E.length + ' 條'); },
  async (tok, S) => { showDeg(S.G); S.B.add('每個端點都連 3 條邊（3 度）'); cap('每個端點都有 3 條邊相連', '非常對稱'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); plainLab(S.G); T('G₁', 'ptr', -3.3, 0.1, 2.6); cap('這是其中一個圖', ''); },
  async (tok, S) => {
    S.H = petH(3.4, '#f2c6da'); petEdgesH().forEach(([p, q]) => ge(S.H, p, q)); DEMO(3.4, 0.4, 3.2); showDeg(S.H);
    cap('另一個圖：也是 ' + S.H.V.length + ' 點、' + S.H.E.length + ' 邊', '每個端點也是 3 度');
  },
  async (tok, S) => { plainLab(S.H); S.B.add('這兩個是不是 isomorphic？'); cap('這兩個是不是 isomorphic？', ''); },
  async (tok, S) => { S.B.add('要證明是：找出對應、檢查邊'); cap('要證明是，就把對應關係找出來', '這邊有邊對過去還是邊，反之亦然'); },
  async (tok, S) => { S.B.add('先猜：是？不是？'); cap('要先猜猜看是不是', '猜不是，就去找不一樣的地方'); },
  async (tok, S) => { S.B.add('答案：是 isomorphic', 'good'); cap('這兩個是 isomorphic', ''); },
  async (tok, S) => {
    Object.entries(PET_MAP).forEach(([p, q], i) => { vcol(S.G, p, PAL[i % 8]); vcol(S.H, q, PAL[i % 8]); vlab(S.G, p, p + '→' + q); });
    cap('a→1、b→2、c→7、d→5、e→6', 'f→8、g→3、h→10、i→4、j→9');
  },
  async (tok, S) => { S.B.add('猜 → 找 → 不對就回來調'); cap('先從一個點開始對', '算下去不對，再回來調整'); },
  async (tok, S) => { S.B.add('檢查 isomorphic 其實有 algorithm'); cap('判斷兩圖是否 isomorphic', '其實有演算法在做（這門課不教）'); },
], CAMW);

scene('gr-18b-apps', 'Graph isomorphism 的應用與手算技巧', [
  async (tok, S) => { S.B = board(-6.8, 5.2, 0.5, -3.4, 5); S.B.add('graph isomorphism 有什麼應用？'); cap('graph isomorphism 有沒有應用？', '有'); },
  async (tok, S) => { icon('⚗️', '化學：molecular graph', -4.8, 2.2, 0); S.B.add('化學：分子圖是不是同一種分子'); cap('化學：用 molecular graph 描述分子', '比對兩個分子是不是一樣'); },
  async (tok, S) => { icon('🔌', '電路 layout', -2.0, 2.2, 0); S.B.add('電路：兩個 schematic 是否相同'); cap('電路 layout', 'check 兩個 schematic design 是不是一樣'); },
  async (tok, S) => { icon('🕵️', '抓抄襲', 0.8, 2.2, 0); S.B.add('抓抄襲：轉個方向還是同一個'); cap('還可以抓抄襲', '稍微轉個方向，其實是同一個 layout'); },
  async (tok, S) => { icon('🧬', 'bioinformatics', 3.4, 2.2, 0); icon('👁️', 'computer vision', 5.6, 2.2, 0); S.B.add('bioinformatics、computer vision'); cap('Bioinformatics 和 computer vision', '也都有應用'); },
  async (tok, S) => {
    lab.clear(); S.B = board(-6.8, 5.4, 0.48, -3.4, 3);
    S.G = petG(-3.3, '#bcd3ee'); PET_E.forEach(([p, q]) => ge(S.G, p, q)); S.H = petH(3.4, '#f2c6da'); petEdgesH().forEach(([p, q]) => ge(S.H, p, q)); DEMO(3.4, 0.4, 3.2);
    S.B.add('自己用手算試試看'); cap('回到剛剛的 Petersen 例子', '自己用手算試試看');
  },
  async (tok, S) => {
    vcol(S.G, 'a', COL.gold); vcol(S.H, '1', COL.gold);
    for (const n of ['e', 'f', 'b']) { vcol(S.G, n, COL.green); paintE(findE(S.G, 'a', n), COL.green, true); }
    for (const n of ['6', '8', '2']) { vcol(S.H, n, COL.green); paintE(findE(S.H, '1', n), COL.green, true); }
    S.B.add('a → 1：a 的鄰居 e、f、b → 1 的鄰居 6、8、2'); cap('a 對到 1，a 旁邊有 e、f、b', '它們一定對到 1 旁邊的 6、8、2');
  },
  async (tok, S) => {
    S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.H.E.forEach((e) => paintE(e, COL.edge, false));
    paintE(findE(S.G, 'c', 'b'), COL.pink, true); paintE(findE(S.H, '7', '2'), COL.pink, true);
    paintE(findE(S.G, 'j', 'g'), COL.blue, true); paintE(findE(S.H, '9', '3'), COL.blue, true);
    S.B.add('檢查：cb → 72 ✔、jg → 93 ✔'); cap('往前檢查幾條：cb 對到 72，有', 'jg 對到 93，也有');
  },
], CAMW);


// ════════ ue8V8aOKveE（清大 趙啟超 第19A講：simple graph／multigraph、degree、Σdeg = 2|E|、handshaking lemma） ════════
scene('gr-19a-simple', 'Simple graph 與 multigraph', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('先講清楚討論的範圍'); S.G = gnew([['u', 1.4, -1.0], ['v', 4.6, -1.0], ['w', 3.0, 1.8]]); cap('有時候要限制 graph 的範圍', ''); },
  async (tok, S) => { S.B.add('兩個不同端點之間最多一條 edge'); S.e1 = ge(S.G, 'u', 'v'); cap('兩個不同 vertex 之間只能有一條 edge', ''); },
  async (tok, S) => { S.B.add('→ simple graph', 'good'); cap('這樣的 graph 叫 simple graph', ''); },
  async (tok, S) => { S.lp = ge(S.G, 'w', 'w', { color: COL.purple }); S.x1 = T('✘ loop', 'bad', 4.9, 0.9, 2.2); S.B.add('distinct → 不能有 loop'); cap('「不同的」端點：所以不能有 loop', '自己繞一圈的邊叫 loop'); },
  async (tok, S) => { S.m2 = ge(S.G, 'u', 'v', { bend: 0.8, color: COL.pink }); S.x2 = T('✘ 兩條', 'bad', 3.0, 0.9, -2.0); S.B.add('也不能有兩條平行的邊'); cap('兩點之間也不能有兩條邊', ''); },
  async (tok, S) => { S.B.add('沒有 loop、沒有重邊 = simple graph', 'good'); cap('沒有 loop、任兩點最多一條邊', '就是 simple graph'); },
  async (tok, S) => { kill(S.x1); kill(S.x2); S.B.add('可以有 loop、多條邊 → multigraph'); cap('如果允許 loop、允許多條邊', '叫 multigraph'); },
  async (tok, S) => { ge(S.G, 'v', 'w'); ge(S.G, 'v', 'w', { bend: 0.7, color: COL.pink }); T('multigraph（更廣義）', 'ptr alt', 3.0, 0.1, 3.0); cap('multiple edges + loop', '這是更廣義的 graph 定義'); },
  async (tok, S) => { S.B.add('講的是哪一種，要先說清楚'); cap('為了講清楚範圍', '會特別說是 simple graph 還是 multigraph'); },
  async (tok, S) => { S.B.add('看書時先確定定義的範圍'); cap('別人沒講清楚時', '先確定他講的範圍，結論可能不同'); },
], CAMW);

const DGP = [['a', 0.6, -1.9], ['b', 5.0, -1.8], ['c', 2.8, -0.3], ['d', 5.0, 1.6], ['e', 0.4, 1.6], ['f', 2.6, 2.4]];
const DGE = [['a', 'a'], ['a', 'c'], ['c', 'b'], ['c', 'd'], ['b', 'd'], ['c', 'f']];
scene('gr-19a-degree', 'Vertex degree：loop 算 2', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('vertex degree（度數）'); cap('vertex degree', ''); },
  async (tok, S) => { S.G = gnew([['v', 2.8, 0.2], ['p', 0.6, -1.6], ['q', 5.0, -1.4], ['r', 4.6, 2.0]]); DEMO(2.8, 0.3, 3.2); S.B.add('每個 vertex 都有一個 degree'); cap('每個 vertex 可以定義一個 degree', ''); },
  async (tok, S) => { S.B.add('deg(v) = 與 v 相連的 edge 數'); cap('degree：跟 v 相連的 edge 有幾條', 'number of edges incident with v'); },
  async (tok, S) => { for (const n of ['p', 'q', 'r']) { paintE(ge(S.G, 'v', n), COL.gold, true); await wt(tok, 300); } vlab(S.G, 'v', 'v:' + degOf(S.G, 'v')); cap('v 連出去 3 條邊', 'deg(v) = ' + degOf(S.G, 'v')); },
  async (tok, S) => { S.B.add('simple graph、multigraph 都適用'); cap('這個定義在 simple graph、multigraph 都成立', ''); },
  async (tok, S) => { S.B.add('但 loop 要小心！', 'bad'); cap('有 loop 的時候算要小心', ''); },
  async (tok, S) => { S.lp = ge(S.G, 'v', 'v', { color: COL.purple }); cap('multigraph 可以有 loop', '這條 edge 只繞著 v'); },
  async (tok, S) => { S.B.add('loop 對 degree 貢獻 2'); vlab(S.G, 'v', 'v:' + degOf(S.G, 'v')); cap('loop 要算 2', 'deg(v) = 3 + 2 = ' + degOf(S.G, 'v')); },
  async (tok, S) => { S.B.add('一條 edge 有兩端，各貢獻 1', 'good'); cap('一條 edge 有兩個端點，各貢獻 1', 'loop 的兩端都是 v，所以 v 得到 2'); },
], CAMW);

scene('gr-19a-sum', '例子：Σ deg = 12 = 2 × 6，定理與證明', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('看一個例子'); cap('看一個例子', ''); },
  async (tok, S) => { S.G = gnew(DGP); DGE.forEach(([p, q]) => ge(S.G, p, q, p === q ? { color: COL.purple } : {})); DEMO(2.8, 0.3, 3.4); S.B.add('6 個 vertices：a, b, c, d, e, f'); cap('這個 graph 有 a～f 六個 vertices', '每個 vertex 的 degree 是多少？'); },
  async (tok, S) => { vlab(S.G, 'f', 'f:' + degOf(S.G, 'f')); paintE(findE(S.G, 'c', 'f'), COL.gold, true); cap('deg(f) = ' + degOf(S.G, 'f'), ''); },
  async (tok, S) => { paintE(findE(S.G, 'c', 'f'), COL.edge, false); vlab(S.G, 'a', 'a:' + degOf(S.G, 'a')); vglow(S.G, 'a', GOLD); cap('a：loop 貢獻 2，再加 1', 'deg(a) = ' + degOf(S.G, 'a')); },
  async (tok, S) => { vglow(S.G, 'a', null); S.tmp = ge(S.G, 'a', 'c', { bend: 0.8, color: COL.pink }); T('示意：多一條 → 兩端各 +1', 'idx', 1.7, 1.6, -2.4); cap('如果這邊再多一條邊', '兩端又各多 1'); },
  async (tok, S) => { removeEdge(S.G, S.tmp); showDeg(S.G); S.B.add('把所有 vertex 的 degree 加起來'); cap('把所有 vertex 的 degree 加起來', ''); },
  async (tok, S) => { S.B.add('Σ deg = ' + deg(S.G).join(' + ')); cap(deg(S.G).join(' + '), ''); },
  async (tok, S) => { S.B.add('= ' + sumDeg(S.G)); cap('= ' + sumDeg(S.G), '12 跟什麼有關？'); },
  async (tok, S) => { S.G.E.forEach((e, k) => paintE(e, PAL[k % 8], true)); T('|E| = ' + S.G.E.length, 'good', 2.8, 2.4, -2.6); cap('數邊：' + S.G.E.length + ' 條', ''); },
  async (tok, S) => { S.B.add(sumDeg(S.G) + ' = 2 × ' + S.G.E.length, 'good'); cap('12 = 2 × 6', '兩倍的 edge 個數'); },
  async (tok, S) => { S.B.add('定理：Σ deg(v) = 2|E|', 'good'); cap('定理：所有 vertex 的 degree 和', '等於 edge 個數的兩倍'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); plainLab(S.G); S.B.add('證明：為什麼是兩倍？'); cap('證明：為什麼是兩倍？', ''); S.cnt = deg(S.G).map(() => 0); },
  async (tok, S) => {
    for (const e of S.G.E) { if (e.u === e.v) continue; paintE(e, COL.gold, true); S.cnt[e.u]++; S.cnt[e.v]++; S.G.V.forEach((v, i) => vlab(S.G, i, v.name + ':' + S.cnt[i])); await wt(tok, 420); }
    cap('每條 edge 對兩端各貢獻 1', '');
  },
  async (tok, S) => { const e = S.G.E.find((x) => x.u === x.v); paintE(e, COL.purple, true); S.cnt[e.u] += 2; vlab(S.G, e.u, 'a:' + S.cnt[e.u]); cap('loop 對 a 貢獻 2', ''); },
  async (tok, S) => { S.B.add('每條 edge 剛好貢獻 2'); cap('每一條 edge 剛好貢獻 2', '給所有 degree 的總和'); },
  async (tok, S) => { S.B.add('總和 = 2 × edge 個數 ∎', 'good'); cap('所以總和 = 2 × edge 個數', ''); },
], CAMW);

scene('gr-19a-parity', '奇數度的端點有偶數個', [
  async (tok, S) => { S.G = gnew(DGP); DGE.forEach(([p, q]) => ge(S.G, p, q, p === q ? { color: COL.purple } : {})); showDeg(S.G); DEMO(2.8, 0.3, 3.4); S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('從這個定理推出另一個結果'); cap('從這個結果還可以推出另一個結果', ''); },
  async (tok, S) => { S.B.add('把 vertices 分成兩種'); cap('把 vertices 分成兩種', ''); },
  async (tok, S) => { const d = deg(S.G); d.forEach((x, i) => { if (x % 2) vcol(S.G, i, COL.pink); }); S.B.add('V_O = {v : deg(v) 是奇數}'); cap('V_O：degree 是奇數（odd）的 vertices', '粉紅'); },
  async (tok, S) => { const d = deg(S.G); d.forEach((x, i) => { if (!(x % 2)) vcol(S.G, i, COL.blue); }); S.B.add('V_E = {v : deg(v) 是偶數}'); cap('V_E：剩下 degree 是偶數（even）的', '藍色'); },
  async (tok, S) => { S.B.add('V_O、V_E 是 V 的一個 partition'); cap('V_O 和 V_E 是 V 的一個 partition', ''); },
  async (tok, S) => { S.B.add('聯集 = V，交集 = ∅'); cap('partition：聯集是 V、交集是空集合', '不是奇數就是偶數'); },
  async (tok, S) => { S.B.add('Σ_V deg = Σ over V_O deg + Σ over V_E deg'); cap('degree 總和拆成兩個 sum', ''); },
  async (tok, S) => { S.B.add('= 2|E|'); cap('最後等於 2 × edge 個數', ''); },
  async (tok, S) => { S.B.set(-1, 'good'); cap('2|E| 一定是偶數', ''); },
  async (tok, S) => { const d = deg(S.G); T('V_E 部分：' + d.filter((x) => !(x % 2)).join(' + ') + ' = 偶數', 'say', 2.8, 3.0, -2.6); cap('V_E 那一堆：每個都是偶數', '偶數加偶數還是偶數'); },
  async (tok, S) => { S.B.add('→ Σ over V_O deg 也必須是偶數'); cap('偶數 = ? + 偶數', '所以 V_O 那一堆的和也要是偶數'); },
  async (tok, S) => { const d = deg(S.G); T('V_O 部分：' + d.filter((x) => x % 2).join(' + ') + ' = ' + d.filter((x) => x % 2).reduce((a, b) => a + b, 0), 'say', 2.8, 2.4, -2.6); cap('但 V_O 裡每一個 degree 都是奇數', ''); },
  async (tok, S) => { const n = deg(S.G).filter((x) => x % 2).length; S.B.add('偶數個奇數相加才是偶數 → |V_O| 是偶數', 'good'); cap('奇數要有偶數個，加起來才是偶數', '這裡 |V_O| = ' + n); },
], CAMW);

const PARTY = [['A', 0, -2.4], ['B', 2.3, -1.2], ['C', 2.3, 1.3], ['D', 0, 2.5], ['E', -2.3, 1.3], ['F', -2.3, -1.2]].map(([n, x, z]) => [n, x + 2.6, z]);
scene('gr-19a-hand', 'Handshaking lemma：派對上的握手', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('Handshaking lemma（握手引理）', 'good'); cap('這個性質叫 handshaking lemma', ''); },
  async (tok, S) => { S.B.add('|V_O| 一定是偶數'); cap('degree 是奇數的 vertices', '個數一定是偶數'); },
  async (tok, S) => { S.B.add('為什麼叫 handshaking？'); cap('為什麼叫 handshaking？', ''); },
  async (tok, S) => { S.G = gnew(PARTY, { color: '#f3d9b0' }); DEMO(2.6, 0.3, 3.4); S.B.add('一場 party，有些人互相握手'); cap('一場 party', '有些人互相握手'); },
  async (tok, S) => { paintE(ge(S.G, 'A', 'B'), COL.gold, true); S.B.add('A 跟 B 握手：兩人各握了一次'); cap('A 跟 B 握手', 'A 握到 B 的手，B 也握到 A 的手'); },
  async (tok, S) => { paintE(S.G.E[0], COL.edge, false); for (const s of ['AC', 'AD', 'BE', 'CF', 'DE', 'EF']) { ge(S.G, s[0], s[1]); await wt(tok, 250); } S.B.add('人 = 端點，握過手 = 一條邊'); cap('每個人是一個端點', '握過手就連一條邊'); },
  async (tok, S) => { showDeg(S.G); S.B.add('跟奇數個人握過手的人數 = 偶數'); cap('跟奇數個人握過手的人', '這些人的個數一定是偶數'); },
  async (tok, S) => { cap('不管有多少人、怎麼握', '都成立'); T('degree = 握手次數', 'ptr', 2.6, 2.8, -2.6); },
  async (tok, S) => { const d = deg(S.G); d.forEach((x, i) => { if (x % 2) { vcol(S.G, i, COL.pink); vglow(S.G, i, RED); } }); T('奇數次：' + d.filter((x) => x % 2).length + ' 人', 'good', 6.0, 0.3, 2.6); cap('把跟奇數個人握手的人找出來', '數一數：一定是偶數'); },
  async (tok, S) => { S.B.add('那些人就是 V_O → 個數是偶數', 'good'); cap('這些人就是 V_O', '人數一定是偶數'); },
], CAMW);


// ════════ 2aH0dlnEhZ0（清大 趙啟超 第19B講：regular graph、Kₙ、Cₙ、Petersen、walk／trail／path／circuit／cycle） ════════
function ringG(n, cx, R = 2.2, o = {}) { const P = ring(n, R, 0.5, o.phase || 0, cx, o.cz || 0); return gnew(P.map((p, i) => [o.names ? o.names[i] : String(i + 1), p.x, p.z]), o); }
function completeE(G) { for (let i = 0; i < G.V.length; i++) for (let j = i + 1; j < G.V.length; j++) addEdge(G, i, j, 0, PAL[i % 8]); }
function cycleE(G) { const n = G.V.length; for (let i = 0; i < n; i++) addEdge(G, i, (i + 1) % n); }
scene('gr-19b-regular', 'Regular graph：每個端點 degree 都一樣', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('regular graph'); cap('接著看 regular graph', ''); },
  async (tok, S) => { S.G = ringG(4, 2.6, 2.2, { names: ['a', 'b', 'c', 'd'] }); completeE(S.G); showDeg(S.G); DEMO(2.6, 0.3, 3.2); S.B.add('undirected，所有端點 degree 都一樣'); cap('undirected graph', '所有端點的 degree 都一樣'); },
  async (tok, S) => { S.B.add('→ regular graph', 'good'); cap('這樣的 graph 叫 regular graph', ''); },
  async (tok, S) => { S.B.add('每點 degree 都是 r → r-regular'); T(deg(S.G)[0] + '-regular', 'good', 2.6, 2.4, -2.6); cap('每個 vertex 的 degree 都是 r', '叫做 r-regular'); },
  async (tok, S) => { S.B.add('下面看幾個常見例子'); cap('下面看幾個常見的 regular graph', ''); },
], CAMW);

scene('gr-19b-kn', 'Complete graph Kₙ：C(n,2) 條邊、(n−1)-regular', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('第一類：complete graph'); cap('第一類：complete graph（完全圖）', ''); },
  async (tok, S) => { S.B.add('n 個端點上的 complete graph：Kₙ'); cap('n 個 vertices 上的 complete graph', '符號 Kₙ'); },
  async (tok, S) => { S.B.add('任兩個不同端點之間恰好一條 edge'); cap('undirected，任兩個不同端點之間', '剛好一條 edge'); },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => async (tok, S) => {
    if (S.G) gkill(S.G); if (S.lb) kill(S.lb);
    S.G = n === 1 ? gnew([['1', 2.6, 0]]) : ringG(n, 2.6, n <= 3 ? 1.6 : 2.3);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { addEdge(S.G, i, j, 0, PAL[i % 8]); if (n <= 4) await wt(tok, 160); }
    S.lb = T('K' + n + '：' + n + ' 點、' + S.G.E.length + ' 邊', 'good', 2.6, 2.6, -2.6);
    cap('K' + n, n === 1 ? '只有一個端點' : n === 7 ? '以此類推' : '任兩點都連一條');
  }),
  async (tok, S) => { S.B.add('Kₙ 有 n 個端點'); cap('Kₙ 有幾個端點？n 個', ''); },
  async (tok, S) => { S.B.add('|E| = C(n, 2) = n(n−1)/2'); cap('任兩點恰一條邊：n 取 2', 'K₇：C(7,2) = ' + S.G.E.length); },
  async (tok, S) => { S.B.add('Kₙ 是 regular graph'); showDeg(S.G); cap('Kₙ 是 regular graph', ''); },
  async (tok, S) => { S.B.add('多少 regular？'); cap('Kₙ 是幾 regular？', ''); },
  async (tok, S) => { S.B.add('每點連到其他 n−1 點 → (n−1)-regular', 'good'); cap('每個 vertex 跟其他 n − 1 個都有邊', 'Kₙ 是 (n−1)-regular（K₇：6）'); },
], CAMW);

scene('gr-19b-cn', 'Cycle graph Cₙ（2-regular）與 Petersen graph（3-regular）', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('第二類：cycle graph'); cap('第二類：cycle graph', ''); },
  async (tok, S) => { S.B.add('Cₙ，從 n ≥ 3 開始'); cap('符號 Cₙ', 'n ≥ 3 才開始講'); },
  ...[3, 4, 5, 6].map((n) => async (tok, S) => {
    if (S.G) gkill(S.G); if (S.lb) kill(S.lb);
    S.G = ringG(n, 2.6, 2.1); for (let i = 0; i < n; i++) { addEdge(S.G, i, (i + 1) % n, 0, COL.blue); await wt(tok, 150); }
    S.lb = T('C' + n, 'good', 2.6, 2.6, -2.4); cap('C' + n, '繞一圈');
  }),
  async (tok, S) => { S.B.add('Cₙ 有 n 個端點'); cap('Cₙ 有 n 個端點', ''); },
  async (tok, S) => { S.B.add('也有 n 條 edges'); kill(S.lb); S.lb = T('C6：' + S.G.V.length + ' 點、' + S.G.E.length + ' 邊', 'good', 2.6, 2.6, -2.4); cap('edges：C₃ 有 3 條、C₄ 有 4 條…', 'Cₙ 有 n 條'); },
  async (tok, S) => { showDeg(S.G); S.B.add('也是 regular graph'); cap('每個端點的 degree 都一樣', ''); },
  async (tok, S) => { S.B.add('Cₙ 是 2-regular', 'good'); cap('相鄰的兩點有邊', '每點 degree 2：2-regular'); },
  async (tok, S) => { gkill(S.G); kill(S.lb); S.G = petG(2.6, '#e9dcc4'); PET_E.forEach(([p, q]) => ge(S.G, p, q)); cap('這個上次講過：叫什麼 graph？', ''); },
  async (tok, S) => { S.B.add('Petersen graph'); T('Petersen graph', 'ptr', 2.6, 0.1, 3.0); cap('Petersen graph', '後面還會再碰到'); },
  async (tok, S) => { T('|V| = ' + S.G.V.length, 'ptr alt', 2.6, 3.4, -1.6); cap('有幾個端點？' + S.G.V.length + ' 個', ''); },
  async (tok, S) => { T('|E| = ' + S.G.E.length, 'ptr alt', 2.6, 2.8, -1.6); cap('有幾個邊？' + S.G.E.length + ' 個', ''); },
  async (tok, S) => { showDeg(S.G); S.B.add('Petersen graph 是 3-regular', 'good'); cap('每個 vertex degree 都是 3', '3-regular'); },
], CAMW);

const WK = [['A', 0.6, -1.6], ['B', 3.0, -2.4], ['C', 3.2, 0.2], ['D', 5.4, 1.6], ['E', 2.6, 2.4]];
const wkG = () => { const G = gnew(WK); ges(G, 'AB BC CA CD DE EC'); return G; };
scene('gr-19b-walk', 'Walk：v₀ e₁ v₁ e₂ … eₙ vₙ', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('名詞：walk、trail、path'); cap('介紹幾個名詞', 'walk、trail、path'); },
  async (tok, S) => { S.B.add('分類照我們的教科書'); cap('這裡的分類照我們用的教科書', ''); },
  async (tok, S) => { S.B.add('不是每本書都一樣（看上下文）'); cap('每本書的分法不見得一樣', '看上下文大概知道意思'); },
  async (tok, S) => { S.B.add('第一個：walk'); S.G = wkG(); DEMO(3.0, 0.3, 3.3); cap('第一個：walk', ''); },
  async (tok, S) => { cap('walk 就是在圖上走來走去', ''); T('在圖上走來走去', 'ptr', 3.0, 2.6, -2.8); },
  async (tok, S) => { S.B.add('有限的交替序列'); cap('undirected graph 上的 walk', '是一個 finite alternating sequence'); },
  async (tok, S) => { S.tk = tokenAt(S.G, 'A'); vglow(S.G, 'A', GOLD); S.seq = T('v₀=A', 'say', 3.0, 3.5, -2.8); cap('從 v₀ 開始', 'v₀ = A'); },
  ...[['A', 'B', 'e₁', 'v₁'], ['B', 'C', 'e₂', 'v₂'], ['C', 'A', 'e₃', 'v₃']].map(([p, q, e, v], k) => async (tok, S) => {
    await walk(tok, S.G, S.tk, p, q, 650, PAL[k]); txt(S.seq, S.seq.element.textContent + ' ' + e + ' ' + v + '=' + q);
    cap('經過 ' + e + ' 到 ' + v, v + ' = ' + q);
  }),
  async (tok, S) => { await walk(tok, S.G, S.tk, 'A', 'B', 650, PAL[3]); txt(S.seq, S.seq.element.textContent + ' … eₙ vₙ=B'); vglow(S.G, 'B', GOLD); cap('…最後經過 eₙ 到 vₙ', '這裡 vₙ = B'); },
  async (tok, S) => { S.B.add('vertex、edge、vertex、edge… 交替'); cap('vertex、edge 交替出現', 'alternating'); },
  async (tok, S) => { S.B.add('起點 v₀，終點 vₙ'); cap('開始在 v₀、結束在 vₙ', '中間用到 e₁ … eₙ'); },
  async (tok, S) => { S.B.add('eᵢ 的端點是 vᵢ₋₁ 和 vᵢ'); cap('eᵢ 連接 vᵢ₋₁ 和 vᵢ', 'e₁ 連 v₀、v₁；e₂ 連 v₁、v₂…'); },
  async (tok, S) => { S.B.add('walk：沒有限制，照著邊走就對了', 'good'); cap('walk 沒有限制', 'A 走了兩次、AB 也走了兩次都可以'); },
], CAMW);

scene('gr-19b-closed', 'Walk 的長度；closed walk 與 open walk', [
  async (tok, S) => { S.G = wkG(); DEMO(3.0, 0.3, 3.3); S.B = board(-6.6, 4.8); S.B.add('walk 的長度 = edge 的個數'); S.tk = tokenAt(S.G, 'A'); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'B']]) await walk(tok, S.G, S.tk, p, q, 300, COL.gold); cap('walk 的長度', '就是它經過的 edge 個數'); },
  async (tok, S) => { S.B.add('v₀ e₁ … eₙ vₙ 的長度是 n'); T('A B C A B：長度 4', 'say', 3.0, 3.4, -2.8); cap('v₀ 到 vₙ 經過 n 條 edge', '長度 n（重複走也要算）'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.tk.position.copy(S.G.V[0].p).add(V3(0, 0.35, 0)); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'A']]) await walk(tok, S.G, S.tk, p, q, 450, COL.green); cap('如果起點跟終點一樣', 'A → B → C → A'); },
  async (tok, S) => { S.B.add('起點 = 終點 → closed walk', 'good'); cap('走出去又繞回原點', '叫 closed walk'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.tk.position.copy(S.G.V[0].p).add(V3(0, 0.35, 0)); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'D']]) await walk(tok, S.G, S.tk, p, q, 450, COL.blue); S.B.add('起點 ≠ 終點 → open walk', 'good'); cap('不是 closed', '就是 open walk：A → B → C → D'); },
  async (tok, S) => { S.B.add('不是 closed 就是 open'); cap('起點終點一樣叫 closed、不一樣叫 open', ''); },
], CAMW);

scene('gr-19b-trail', 'Trail、circuit、path、cycle', [
  async (tok, S) => { S.G = wkG(); DEMO(3.0, 0.3, 3.3); S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('walk 是最廣義的'); cap('剛才的 walk 是最廣義的', ''); },
  async (tok, S) => { S.B.add('端點可以重複'); vglow(S.G, 'A', GOLD); cap('端點可以重複', '走過再回來'); },
  async (tok, S) => { vglow(S.G, 'A', null); paintE(findE(S.G, 'A', 'B'), COL.hot, true); S.B.add('edge 也可以重複'); cap('edge 也可以重複', '同一條邊再走一次'); },
  async (tok, S) => { paintE(findE(S.G, 'A', 'B'), COL.edge, false); S.B.add('限制一：edge 不能重複'); cap('第一個限制：沒有 edge 重複', ''); },
  async (tok, S) => { S.tk = tokenAt(S.G, 'A'); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'C']]) await walk(tok, S.G, S.tk, p, q, 380, COL.gold); S.B.add('no edge repeated → trail', 'good'); cap('沒有 edge 重複的 walk 叫 trail', 'A B C D E C：C 經過兩次沒關係'); },
  async (tok, S) => { cap('trail：像健行走的小徑', ''); S.tn = T('trail（小徑）', 'ptr', 3.0, 2.8, -2.8); },
  async (tok, S) => { await walk(tok, S.G, S.tk, 'C', 'A', 450, COL.gold); S.B.add('closed trail'); cap('沒有 edge 重複、起點 = 終點', 'closed trail'); },
  async (tok, S) => { S.B.add('closed trail = circuit', 'good'); cap('closed trail 另一個名字', '叫 circuit'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.B.add('限制二：端點也不能重複'); cap('第二個限制：端點也不重複', ''); },
  async (tok, S) => { S.tk.position.copy(S.G.V[0].p).add(V3(0, 0.35, 0)); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'D']]) await walk(tok, S.G, S.tk, p, q, 450, COL.green); cap('每個端點最多出現一次', 'A B C D'); },
  async (tok, S) => { S.B.add('端點不重複 ⇒ edge 一定不重複'); cap('端點不重複，edge 就一定不重複', '要重複邊，端點一定得走兩次'); },
  async (tok, S) => { S.B.add('no vertex repeated → path', 'good'); cap('這樣的 walk 叫 path', ''); },
  async (tok, S) => { cap('通常說的「路徑」', '就是端點不重複的 walk'); kill(S.tn); T('path（路徑）', 'ptr', 3.0, 2.8, -2.8); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.tk.position.copy(S.G.V[0].p).add(V3(0, 0.35, 0)); for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'A']]) await walk(tok, S.G, S.tk, p, q, 450, COL.pink); S.B.add('closed path = cycle', 'good'); cap('closed path：只有起點 = 終點', '其他端點不重複：叫 cycle'); },
  async (tok, S) => { S.B.add('教科書的叫法，各書不統一'); cap('這是我們教科書的叫法', '別的地方 trail、path 可能不分'); },
], CAMW);

scene('gr-19b-table', '整理成表：walk／trail／path × open／closed', [
  async (tok, S) => {
    S.hd = [M('                 open          closed', -6.2, 3.6, -1.2, 'say')];
    cap('把剛剛的名詞整理一下', '');
  },
  async (tok, S) => { S.r1 = M('點可重複、邊可重複', -6.2, 2.9, -1.2, 'note'); cap('第一種：完全沒有限制', '可以重複端點、可以重複 edge'); },
  async (tok, S) => { M('open walk', -0.4, 2.9, -1.2, 'good'); cap('open 的叫 open walk', ''); },
  async (tok, S) => { M('closed walk', 3.2, 2.9, -1.2, 'good'); cap('closed 的叫 closed walk', '最廣義的是 walk'); },
  async (tok, S) => { cls(S.r1, 'say'); S.r2 = M('點可重複、邊不重複', -6.2, 2.0, -1.2, 'note'); cap('第二種：edge 不能重複', '端點可以重複'); },
  async (tok, S) => { M('trail', -0.4, 2.0, -1.2, 'good'); cap('open 的叫 trail', '中文：小徑'); },
  async (tok, S) => { M('circuit', 3.2, 2.0, -1.2, 'good'); cap('closed 的叫 circuit', ''); },
  async (tok, S) => { cls(S.r2, 'say'); S.r3 = M('點不重複（邊也不重複）', -6.2, 1.1, -1.2, 'note'); cap('第三種：端點不能重複', 'edge 也就一定不重複'); },
  async (tok, S) => { M('path', -0.4, 1.1, -1.2, 'good'); cap('open 的叫 path', ''); },
  async (tok, S) => { M('cycle', 3.2, 1.1, -1.2, 'good'); cap('closed 的叫 cycle', ''); },
  async (tok, S) => { cls(S.r3, 'say'); T('各書用法不統一，這門課照這張表', 'bad', 0, 0.2, 0.8); cap('各地方的叫法不統一', '至少這門課都照這張表用'); },
], CAMT);


// ════════ lyVL6rqj7gU（清大 趙啟超 第19C講：用 path 定義 equivalence relation、components、connected graph） ════════
// 依中文逐字稿逐句對齊。老師板書的圖看不到點名：舞台上的圖（1~5 一塊、6~8 一塊）是示意，標「示意」。
// 老師的例子：「12345 這五點是一個 component」、另一部分跟它沒連在一起 → 兩個 components。
const CC = [['1', -0.4, -1.8], ['2', 1.8, -2.2], ['3', 2.2, 0.0], ['4', 0.2, 0.6], ['5', -0.2, 2.4], ['6', 4.2, -1.6], ['7', 5.6, 0.2], ['8', 4.6, 2.2]];
const ccG = () => { const G = gnew(CC); ges(G, '12 23 34 45 24 67 78'); return G; };
const CCOL = ['#4b9ee2', '#e55a9b'];
const CA = ['1', '2', '3', '4', '5'], CB = ['6', '7', '8'];
const inA = (G, i) => CA.includes(G.V[i].name);
const ccPaint = (G) => { CA.forEach((n) => vcol(G, n, CCOL[0])); CB.forEach((n) => vcol(G, n, CCOL[1])); };
const ccEdges = (G, thick = true) => G.E.forEach((e) => paintE(e, CCOL[inA(G, e.u) ? 0 : 1], thick));
const ccTags = () => [T('{1,2,3,4,5}', 'ptr', 0.3, 0.2, 4.0), T('{6,7,8}', 'ptr', 5.0, 0.2, 3.8)];
async function walkPath(tok, G, ns, color = COL.gold, ms = 500) {
  const tk = tokenAt(G, ns[0]);
  for (let i = 0; i + 1 < ns.length; i++) await walk(tok, G, tk, ns[i], ns[i + 1], ms, color);
  return tk;
}

scene('gr-19c-path', '用「有沒有 path」定義一個 relation', [
  async (tok, S) => { S.G = ccG(); DEMO(2.6, 0.3, 3.4); S.B = board(-6.6, 4.8); S.B.add('u、v：graph 的兩個端點'); S.B.add('定義一個 binary relation'); vglow(S.G, '1', GOLD); vglow(S.G, '5', GOLD); T('u', 'ptr', -1.5, 0.5, -1.8); T('v', 'ptr', -1.3, 0.5, 2.6); cap('拿 graph 的兩個端點 u、v', '定義一個 binary relation'); },
  async (tok, S) => { S.tk = await walkPath(tok, S.G, ['1', '2', '4', '5'], COL.green); cap('如果兩點中間有一條 path', '可以從這一點一路走到那一點'); },
  async (tok, S) => { S.B.add('u R v ⇔ u、v 之間有 path', 'good'); cap('就說這兩個端點滿足這個 relation', 'u R v'); },
  async (tok, S) => { S.B.add('path：端點不重複、edge 不重複'); cap('path：端點不會重複', 'edge 也不會重複'); },
  async (tok, S) => { S.B.add('有路走得到 → 滿足 relation'); cap('有一條路可以從一點走到另一點', '這兩點就滿足這個 relation'); },
  async (tok, S) => { kill(S.tk); S.B.add('→ 它是 equivalence relation', 'good'); cap('很容易確認：這個 relation', '是一個 equivalence relation'); },
], CAMW);

scene('gr-19c-equiv', '「有 path」是 equivalence relation', [
  async (tok, S) => { S.G = ccG(); DEMO(2.6, 0.3, 3.4); S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.B.add('vertex set V：任拿兩個端點'); vglow(S.G, '1', GOLD); vglow(S.G, '7', GOLD); cap('在 vertex set V 裡', '任意拿兩個端點出來'); },
  async (tok, S) => { for (const [p, q] of [['1', '2'], ['2', '4'], ['4', '5']]) { paintE(findE(S.G, p, q), COL.green, true); await wt(tok, 250); } S.t1 = T('1、5：有 path → 滿足', 'good', -0.2, 2.0, 3.4); S.t2 = T('1、7：沒有 path → 不滿足', 'bad', 5.0, 2.0, -2.8); S.B.add('要嘛滿足、要嘛不滿足'); cap('兩點要嘛滿足這個 relation', '要嘛不滿足：看中間有沒有路徑'); },
  async (tok, S) => { kill(S.t1); kill(S.t2); vglow(S.G, '1', null); vglow(S.G, '7', null); S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.B.add('equivalence relation：檢查三個條件'); cap('這個 relation 是 equivalence relation', '要滿足三個條件'); },
  async (tok, S) => { S.B.add('① reflexive：A R A'); vglow(S.G, '3', GOLD); S.ra = T('A', 'ptr', 2.2, 1.4, 0.0); cap('① 自己跟自己要滿足', '點就在那裡，所以 OK'); },
  async (tok, S) => { vglow(S.G, '3', null); S.B.add('② symmetric：A R B ⇒ B R A'); cap('② A 跟 B 滿足', 'B 就要跟 A 滿足'); },
  async (tok, S) => { kill(S.ra); T('A', 'ptr', -0.4, 1.4, -1.8); T('B', 'ptr', 2.2, 1.9, 0.0); S.tk = await walkPath(tok, S.G, ['1', '2', '3'], COL.gold); cap('A R B：有一條路徑從 A 到 B', ''); },
  async (tok, S) => { await walk(tok, S.G, S.tk, '3', '2', 500, null); await walk(tok, S.G, S.tk, '2', '1', 500, null); kill(S.tk); cap('把路徑反過來走', '就是 B 到 A → B R A'); },
  async (tok, S) => { S.B.add('③ transitive：A R B、B R C ⇒ A R C'); cap('③ 遞移性：A 跟 B 滿足、B 跟 C 滿足', 'A 就要跟 C 滿足'); },
  async (tok, S) => { T('C', 'ptr', -1.3, 0.5, 2.6); S.tk = tokenAt(S.G, '1'); await walk(tok, S.G, S.tk, '1', '2', 450, COL.gold); await walk(tok, S.G, S.tk, '2', '3', 450, COL.gold); cap('A R B：有一條路徑 A 到 B', ''); },
  async (tok, S) => { await walk(tok, S.G, S.tk, '3', '4', 450, COL.green); await walk(tok, S.G, S.tk, '4', '5', 450, COL.green); cap('B R C：B 有一條路徑到 C', ''); },
  async (tok, S) => { kill(S.tk); T('A → B → C', 'good', 0.2, 0.3, 4.4); cap('接起來：就有一條路從 A 到 C', '所以 A R C'); },
  async (tok, S) => { S.B.add('transitive ✓'); cap('所以它也滿足 transitive condition', ''); },
  async (tok, S) => { S.B.add('reflexive、symmetric、transitive → equivalence relation', 'good'); cap('reflexive、symmetric、transitive 都滿足', '所以這是一個 equivalence relation'); },
], CAMW);

scene('gr-19c-class', 'Equivalence classes：把 V 分成幾塊', [
  async (tok, S) => { S.G = ccG(); DEMO(2.6, 0.3, 3.4); S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.B.add('equivalence relation → equivalence classes'); cap('一個 equivalence relation', '就會有 equivalence classes'); },
  async (tok, S) => { S.B.add('classes 是 V 的 partition'); cap('equivalence classes 會對原來的集合', '做一個 partition（分割）'); },
  async (tok, S) => { ccPaint(S.G); ccTags(); S.B.add('V = {1,2,3,4,5} ∪ {6,7,8}（示意）'); cap('整個 V 被 partition 成', '不同的 equivalence classes（同色 = 同一個 class）'); },
  async (tok, S) => { S.B.add('同一個 class：兩兩滿足 relation'); vglow(S.G, '1', GOLD); vglow(S.G, '3', GOLD); cap('在同一個 class 裡的端點', '兩兩都滿足這個 relation'); },
  async (tok, S) => { S.tk = await walkPath(tok, S.G, ['1', '2', '3'], COL.gold); cap('滿足 relation 的意思：', '兩點中間有一條路徑連起來'); },
  async (tok, S) => { kill(S.tk); vglow(S.G, '1', null); vglow(S.G, '3', null); S.B.add('同一個 class ⇔ 中間有 path', 'good'); cap('兩個 vertices 在同一個 class', '若且唯若 它們中間有一條 path'); },
], CAMW);

scene('gr-19c-comp', 'Components：G 分成 r 塊', [
  async (tok, S) => { S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.B.add('G = (V, E)'); S.G = ccG(); DEMO(2.6, 0.3, 3.4); cap('假設 graph 是 G', '兩個集合：vertex set V、edge set E'); },
  async (tok, S) => { S.B.add('undirected graph'); cap('它是 undirected graph', ''); },
  async (tok, S) => { S.B.add('用「有 path」的 relation'); cap('用剛才定義的 equivalence relation', '兩點中間有 path 就滿足'); },
  async (tok, S) => { ccPaint(S.G); S.B.add('V 被 partition 成 r 個 classes'); cap('V 被 partition 成 r 個 classes', '這張示意圖 r = 2'); },
  async (tok, S) => { ccEdges(S.G); cap('每個 class 裡的端點', '都有 path 連在一起'); },
  async (tok, S) => { T('之間沒有 path', 'bad', 2.9, -0.5, 4.8); cap('不同 class 的兩點之間就沒有 path', '有 path 的話就會在同一個 class'); },
  async (tok, S) => { T('V₁', 'ptr', 0.0, 0.2, 4.0); T('V₂', 'ptr', 4.6, 0.2, 3.8); S.B.add('V 分成 V₁, V₂, …, V_r'); cap('把 V 分成 V₁ 到 V_r 這些 subset', ''); },
  async (tok, S) => { S.B.add('Eᵢ：兩個端點都在 Vᵢ 的 edges'); T('E₁', 'ptr', 1.2, 0.2, 4.0); T('E₂', 'ptr', 5.8, 0.2, 3.8); cap('Eᵢ 包含哪些 edge？', '兩個端點都在 Vᵢ 裡的那些邊'); },
  async (tok, S) => { S.bad = ge(S.G, '3', '6', { color: COL.hot }); paintE(S.bad, COL.hot, true); S.q = T('跨兩塊的邊？', 'bad', 3.2, 1.6, -1.0); cap('會不會有一條邊一端在 V₁、一端在 V₂？', '不可能——為什麼？'); },
  async (tok, S) => { CB.forEach((n) => vcol(S.G, n, CCOL[0])); cap('如果有這種邊，它就像一座橋', '兩邊的點都走得到 → 變成同一個 class'); },
  async (tok, S) => { removeEdge(S.G, S.bad); kill(S.q); ccPaint(S.G); S.B.add('不會有跨兩個 class 的邊', 'bad'); cap('但它們本來在不同的 class', '所以不可能有這種邊'); },
  async (tok, S) => { S.B.add('E₁, …, E_r 也是 E 的 partition'); cap('E₁ 到 E_r 也是 E 的 partition', '合起來是全部的邊，兩兩交集是空集合'); },
  async (tok, S) => { S.B.add('Gᵢ = (Vᵢ, Eᵢ)'); cap('把 Vᵢ 跟 Eᵢ 這個圖', '叫做 Gᵢ'); },
  async (tok, S) => { S.B.add('Gᵢ 叫 G 的 component；G 有 r 個', 'good'); T('2 個 components', 'good', 2.6, 3.6, -2.6); cap('Gᵢ 就叫做 G 的一個 component', '這個圖被分成 r 個 components'); },
], CAMW);

scene('gr-19c-conn', 'Component 的直覺、connected graph', [
  async (tok, S) => { S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.G = ccG(); DEMO(2.6, 0.3, 3.4); ccPaint(S.G); ccEdges(S.G); S.B.add('每個 component 自己是一個 graph'); cap('每個 component', '它自己就是一個 graph'); },
  async (tok, S) => { S.B.add('跟其他 component 不會連在一起'); T('中間沒有邊', 'bad', 2.9, -0.5, 4.8); cap('它跟其他 component', '不會連在一起'); },
  async (tok, S) => { CB.forEach((n) => vcol(S.G, n, COL.dim)); S.G.E.forEach((e) => { if (!inA(S.G, e.u)) paintE(e, COL.dim, false); }); T('(V₁, E₁)', 'ptr', 0.3, 0.2, 4.0); cap('把所有 edge 放進來：', 'V₁、E₁ 就是一個 component'); },
  async (tok, S) => { CB.forEach((n) => vcol(S.G, n, CCOL[1])); S.G.E.forEach((e) => { if (!inA(S.G, e.u)) paintE(e, CCOL[1], true); }); T('(V₂, E₂)', 'ptr', 5.0, 0.2, 3.8); cap('V₂、E₂ 是另一個 component', ''); },
  async (tok, S) => { S.B.add('連在一起的那一整塊 = 一個 component', 'good'); cap('簡單講：連在一起的那一整塊', '就叫一個 component'); },
  async (tok, S) => { S.B.add('只有一個 component → connected', 'good'); cap('如果這個圖只有一個 component', '它就叫 connected'); },
  async (tok, S) => { S.B.add('connected graph（連通圖）'); cap('只有一個 component 的圖', '叫 connected graph'); },
], CAMW);

scene('gr-19c-ex', '例子：這個圖有幾個 component？', [
  async (tok, S) => { S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.G = ccG(); DEMO(2.6, 0.3, 3.4); S.B.add('用例子看（點名為示意）'); cap('用下面這個例子', '很簡單就看出來'); },
  async (tok, S) => { S.B.add('這個 graph 有幾個 component？'); cap('這個 graph 有幾個 component？', ''); },
  async (tok, S) => { CA.forEach((n) => vcol(S.G, n, CCOL[0])); S.G.E.forEach((e) => { if (inA(S.G, e.u)) paintE(e, CCOL[0], true); }); S.c1 = T('1~5：一個 component', 'ptr', 0.3, 0.2, 4.0); cap('1、2、3、4、5 這五點和它們的邊', '連在一起，是一個 component'); },
  async (tok, S) => { CB.forEach((n) => vcol(S.G, n, CCOL[1])); S.G.E.forEach((e) => { if (!inA(S.G, e.u)) paintE(e, CCOL[1], true); }); S.c2 = T('2 個 components', 'bad', 5.0, 0.2, 3.8); S.B.add('兩部分沒連在一起 → 2 個 components'); cap('另一部分跟它根本沒有連在一起', '所以有兩個 components'); },
  async (tok, S) => { S.B.add('相連的一部分 = 一個 component'); cap('相連的部分有幾塊', '就有幾個 component'); },
  async (tok, S) => { S.e = ge(S.G, '3', '6', { color: COL.gold }); paintE(S.e, COL.gold, true); S.G.V.forEach((v, i) => vcol(S.G, i, CCOL[0])); kill(S.c1); kill(S.c2); T('（示意）全部連在一起 → 1 個', 'good', 2.6, -0.5, 4.8); cap('如果全部連在一起', '就只有一個 component'); },
  async (tok, S) => { S.B.add('只有 1 個 component → connected graph', 'good'); cap('這個圖就叫 connected graph', ''); },
], CAMW);

scene('gr-19c-def2', 'Connected 的另一個定義：任兩點有 path', [
  async (tok, S) => { S.B = board(-6.6, 6.3, 0.52, -2.6, 6); S.G = ccG(); ge(S.G, '3', '6'); DEMO(2.6, 0.3, 3.4); S.G.V.forEach((v, i) => vcol(S.G, i, CCOL[0])); S.B.add('connected 的另一個定義（意思一樣）'); cap('connected graph 還有另一個定義', '意思是一樣的（equivalent）'); },
  async (tok, S) => { S.B.add('一個 component = 全在一個 class'); cap('connected：它是一個 component', '全部都在同一個 equivalence class 裡'); },
  async (tok, S) => { S.B.add('所有 vertex 兩兩滿足 relation'); cap('在同一個 class 裡', '所有 vertex 都滿足這個 equivalence relation'); },
  async (tok, S) => { vglow(S.G, '1', GOLD); vglow(S.G, '8', GOLD); S.tk = await walkPath(tok, S.G, ['1', '2', '3', '6', '7', '8'], COL.green, 380); cap('滿足 relation：任何兩點', '都有一條 path 連在一起'); },
  async (tok, S) => { kill(S.tk); S.B.add('a path between any two distinct vertices', 'good'); cap('connected：there is a path between', 'any two distinct vertices'); },
  async (tok, S) => { S.B.add('1 個 component ⇔ 1 個 class ⇔ 任兩點有 path'); cap('只有一個 component → 只有一個 class', '→ 任何兩點都有路徑連起來'); },
  async (tok, S) => { S.B.add('兩種定義是同樣的意思', 'good'); cap('用 component 定義、用 path 定義', '兩個是同樣的意思'); },
  async (tok, S) => { S.B.add('後面常假設：圖是 connected'); cap('後面常會假設「這個圖是 connected」', '這一段只是在解釋 component、connected 兩個名詞'); },
], CAMW);


// ════════ q0Vy0gQCB_g（交大 易志偉 Lec22：partial order、Hasse diagram、極大／最大、上界、lattice、topological sort；圖的定義、五種圖、degree、握手） ════════
// Hasse 圖畫在直立的面上（z = 0，y = 高度）：小的在下、大的在上。
const hv = (spec) => gnew(spec.map(([n, x, y]) => [n, x, 0, y]));
const hasseUp = (G, pairs, o = {}) => pairs.map(([p, q]) => ge(G, p, q, o));
scene('gr-l22-po-intro', 'Partial ordering：不是所有東西都能比', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('partial ordering（部分有序）'); cap('今天從 partial ordering 開始', ''); },
  async (tok, S) => { S.B.add('像 ≤，但不是所有東西都能比較'); cap('其實就是「小於等於」的概念', '加上：不是所有東西都能比'); },
  async (tok, S) => { T('實數：a < b、a = b、a > b 必有其一', 'say', 2.2, 3.4, -2.4); cap('以前的實數：三一律', '任兩數一定比得出大小'); },
  async (tok, S) => { S.B.add('有些東西之間沒有大小關係'); cap('現在的集合裡', '有些東西之間沒有關係'); },
  async (tok, S) => { icon('🍎', '蘋果 A', 0.6, 1.4, 0); icon('🍎', '蘋果 B', 2.4, 1.4, 0); icon('🍌', '香蕉', 4.8, 1.4, 0); T('同類可比，不同類很難比', 'ptr', 2.6, 0.2, 0.6); cap('水果：同一類的可以比好壞', '不同類的就很難講'); },
  async (tok, S) => { S.B.add('≤ 的三個特性：① reflexive 家族'); cap('≤ 有三個特性', '第一：reflexive（還有 irreflexive、non-reflexive）'); },
  async (tok, S) => { S.B.add('② symmetric 家族'); cap('第二：symmetric 這一類', ''); },
  async (tok, S) => { S.B.add('③ transitive'); cap('第三：transitive', ''); },
], CAMW);

scene('gr-l22-po-axioms', 'Partial order = reflexive + antisymmetric + transitive', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('≤ 應該選哪三個性質？'); cap('想一想：≤ 該有哪三個性質？', ''); },
  async (tok, S) => { S.l1 = T('a ≤ a', 'note', 2.6, 3.6, -2.0); cap('自己跟自己能不能比？', '可以：a ≤ a'); },
  async (tok, S) => { S.B.add('① reflexive：a ≤ a', 'good'); cap('所以要 reflexive', '集合裡每個東西都跟自己有關係'); },
  async (tok, S) => { S.B.add('② symmetric 還是 antisymmetric？'); cap('第二個：symmetric？', '還是 antisymmetric？'); },
  async (tok, S) => { cap('有一種叫 antisymmetric', ''); T('antisymmetric（反對稱）', 'ptr', 2.6, 2.9, -2.0); },
  async (tok, S) => { S.l2 = T('a ≤ b 且 b ≤ a', 'note', 2.6, 2.2, -2.0); cap('如果 a ≤ b 而且 b ≤ a', '應該怎樣？'); },
  async (tok, S) => { S.B.add('a ≤ b 且 b ≤ a ⇒ a = b', 'good'); cap('a、b 一定是同一個數', '這就是 antisymmetric'); },
  async (tok, S) => { T('symmetric：2 ≤ 3 ⇒ 3 ≤ 2 ✘', 'bad', 2.6, 1.5, -2.0); cap('symmetric 會說：2 ≤ 3 則 3 ≤ 2', '違反我們的概念'); },
  async (tok, S) => { S.B.add('③ transitive？'); cap('第三個：要不要 transitive？', ''); },
  async (tok, S) => { T('a ≤ b、b ≤ c ⇒ a ≤ c', 'note', 2.6, 0.8, -2.0); cap('a ≤ b 而且 b ≤ c', 'a 跟 c 應該是 a ≤ c'); },
  async (tok, S) => { S.B.add('③ transitive', 'good'); cap('越來越大：transitive', ''); },
  async (tok, S) => { S.B.add('三個都有 → partial order（部分有序）', 'good'); cap('reflexive + antisymmetric + transitive', '叫 partial order'); },
  async (tok, S) => { T('例：實數 vs 虛數不能比大小', 'say', 2.6, 0.1, -2.0); cap('但允許有些東西不能比', '自己跟自己一定 ≤'); },
], CAMW);

scene('gr-l22-po-ex', '例子：整除、⊆；total order', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('例：≤、≥ 都是'); cap('舉例：≤ 本身；≥ 反過來也是', ''); },
  async (tok, S) => { S.B.add('整除 |：最明顯的例子'); cap('整除也是一個 partial order', ''); },
  async (tok, S) => {
    S.G = hv([['2', 2.6, 0.6], ['4', 2.6, 2.2], ['8', 2.6, 3.8], ['3', 4.8, 0.6]]);
    ge(S.G, '2', '4', { dir: true }); ge(S.G, '4', '8', { dir: true }); await wt(tok, 300); paintE(ge(S.G, '2', '8', { dir: true, bend: 1.2 }), COL.green, true);
    cap('2 | 4、4 | 8 ⇒ 2 | 8', 'transitive');
  },
  async (tok, S) => { S.nd = T('2 ∤ 3：不能比', 'bad', 4.8, 1.5, 0); cap('2 可以整除 3 嗎？不行', '不是所有數之間都能比'); },
  async (tok, S) => { S.B.add('a | b 且 b | a ⇒ a = b（antisymmetric）'); cap('你整除我、我也整除你', '那一定是同一個數（正整數）'); },
  async (tok, S) => { S.B.add('a | a（reflexive）'); cap('任何數都整除自己', 'reflexive'); },
  async (tok, S) => { gkill(S.G); kill(S.nd); S.B.add('集合的包含 ⊆ 也是'); cap('集合的 ⊆ 也是 partial order', 'A ⊆ A'); },
  async (tok, S) => { S.B.add('A ⊆ B 且 B ⊆ A ⇒ A = B'); cap('互相包含 → 兩集合相等', '以前就這樣證明集合相等'); },
  async (tok, S) => { S.B.add('A ⊆ B、B ⊆ C ⇒ A ⊆ C'); cap('transitive 也成立', ''); },
  async (tok, S) => { S.B.add('total ordering（全序）', 'good'); cap('total ordering', ''); },
  async (tok, S) => { S.B.add('任兩個都能比較'); cap('任何兩個拿出來一定有大小', '沒有不能比的情況'); },
  async (tok, S) => { S.B.add('也叫 linear ordering：串成一串'); cap('又叫 linear ordering', '像實數、整數排成一條線'); },
  async (tok, S) => { for (let i = 0; i < 6; i++) { cube(['A', 'K', 'Q', 'J', '10', '9'][i], '#fdfaf3', [0.7, 0.05, 1.0], 0.4 + i * 0.95, 0.3, 0, 1.5); await wt(tok, 120); } T('撲克牌：一張接一張排好', 'ptr', 2.8, 1.5, 0); cap('撲克牌用花色 + 點數排大小', '52 張一定能疊成一疊'); },
], CAMW);

scene('gr-l22-lex', '兩個 poset 的直積與字典順序', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('poset = partially ordered set'); cap('集合 + partial order', '叫 poset（PO set）'); },
  async (tok, S) => { S.B.add('兩個 poset 可以做 Cartesian product'); cap('兩個 poset 可以做直積', '像一個二維平面'); },
  async (tok, S) => { S.B.add('例：A = {2, 3, 4, 6}，用整除'); cap('例：A = {2, 3, 4, 6}', '配上整除'); },
  async (tok, S) => { S.B.add('B（板書：1, 2, 3, …），也用整除'); cap('B 集合也配上整除', '兩個都是 poset'); },
  async (tok, S) => { S.B.add('A × B 上定義大小：'); cap('在 A × B 上再定義一個大小關係', ''); },
  async (tok, S) => { T('(a₁,b₁) ≼ (a₂,b₂) 若 a₁ ≺ a₂', 'note', 2.6, 3.6, -2.2); cap('如果 a₁ 本來就比 a₂ 小', '就比 a₁ 那一個小'); },
  async (tok, S) => { T('或 a₁ = a₂ 且 b₁ ≼ b₂', 'note', 2.6, 3.0, -2.2); cap('或者 a₁ = a₂ 一樣', '再比第二順位 b'); },
  async (tok, S) => { T('都不是 → 不能比', 'bad', 2.6, 2.4, -2.2); cap('兩個條件都不成立', '就沒有大小關係'); },
  async (tok, S) => { T('(2,1) vs (4,3)：2 | 4 → (2,1) ≼ (4,3)', 'good', 2.6, 1.6, -2.2); cap('(2, 1) 跟 (4, 3)', '2 整除 4：第一個就比得出 (4,3) 大'); },
  async (tok, S) => { T('(3,1) vs (2,4)：3、2 不能比 → 不能比', 'bad', 2.6, 1.0, -2.2); cap('(3, 1) 跟 (2, 4)', '3 和 2 不能比 → 整個不能比'); },
  async (tok, S) => { T('(3,1) vs (3,4)：3 = 3、1 | 4 → (3,4) 大', 'good', 2.6, 0.4, -2.2); cap('(3, 1) 跟 (3, 4)', '第一個一樣，比第二個：1 整除 4'); },
  async (tok, S) => { S.B.add('lexicographic order（字典順序）', 'good'); cap('這叫 lexicographic order', '字典順序'); },
], CAMW);

const CH4 = [['a', 0.4, 0.6], ['b', 4.4, 0.6], ['c', 4.4, 2.8], ['d', 0.4, 2.8]];
scene('gr-l22-hasse', '從關係圖化簡成 Hasse diagram', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 6); S.B.add('用圖來呈現 partial order'); cap('用圖來呈現 partial order', ''); },
  async (tok, S) => {
    S.G = hv(CH4); DEMO(2.4, 0.0, 0.6);
    for (const [p, q] of [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'c'], ['b', 'd'], ['a', 'd']]) ge(S.G, p, q, { dir: true });
    S.loops = ['a', 'b', 'c', 'd'].map((n) => ge(S.G, n, n, { color: COL.purple }));
    cap('這是一個 relation 的圖', '（例子是示意：a ≤ b ≤ c ≤ d）');
  },
  async (tok, S) => { S.loops.forEach((e) => paintE(e, COL.purple, true)); S.B.add('reflexive：每點都有自己的圈'); cap('reflexive？每個點都有一個圈', '有'); },
  async (tok, S) => { S.loops.forEach((e) => paintE(e, COL.purple, false)); S.B.add('antisymmetric：只有單行道'); cap('antisymmetric：單行道', '兩點之間最多一個方向'); },
  async (tok, S) => { paintE(findE(S.G, 'a', 'b'), COL.gold, true); paintE(findE(S.G, 'b', 'c'), COL.gold, true); paintE(findE(S.G, 'a', 'c'), COL.green, true); S.B.add('transitive：a→b、b→c 就有 a→c'); cap('transitive 比較難檢查', '有 a→b、b→c，就要有 a→c'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, e.u === e.v ? COL.purple : COL.edge, false)); S.B.add('→ partial order；連同集合叫 poset', 'good'); cap('驗證完：是 partial ordering', '這個集合加上關係叫 poset'); },
  async (tok, S) => { S.B.add('每次這樣畫很煩 → 簡化'); cap('每次畫這個圖很煩', '想辦法簡化'); },
  async (tok, S) => { S.loops.forEach((e) => removeEdge(S.G, e)); S.B.add('第一步：大家都有 → 擦掉自己的圈'); cap('大家都有 reflexive', '就不用畫：擦掉所有圈'); },
  async (tok, S) => { S.B.add('第二步：transitive 推得出的邊擦掉'); cap('transitive：a ≤ b、b ≤ c 推得出 a ≤ c', '推得出來的就擦掉'); },
  async (tok, S) => { removeEdge(S.G, findE(S.G, 'a', 'c')); cap('a→c 可以由 a→b→c 推出', '擦掉'); },
  async (tok, S) => { removeEdge(S.G, findE(S.G, 'b', 'd')); cap('b→d 可以由 b→c→d 推出', '擦掉'); },
  async (tok, S) => { removeEdge(S.G, findE(S.G, 'a', 'd')); cap('a→d 也推得出來', '擦完只剩最基本的'); },
  async (tok, S) => { S.B.add('擦圈、擦遞移邊'); cap('第一步擦圈、第二步擦遞移邊', ''); },
  async (tok, S) => { await mv(tok, S.G, [V3(3.6, 0.4, 0), V3(3.6, 1.3, 0), V3(3.6, 2.2, 0), V3(3.6, 3.1, 0)], 1500); S.B.add('第三步：小的在下、大的在上'); cap('像抓一把粽子提起來', '小的寫底下、大的寫上面'); },
  async (tok, S) => { S.G.E.slice().forEach((e) => { removeEdge(S.G, e); }); ['ab', 'bc', 'cd'].forEach((s) => ge(S.G, s[0], s[1])); S.B.add('第四步：箭頭也不用畫'); cap('大的都在上面了', '箭頭也擦掉'); },
  async (tok, S) => { S.B.add('Hasse diagram', 'good'); cap('最後這個就是 Hasse diagram', ''); },
], CAMW);

const HX = [['2', 1.4, 0.8], ['3', 4.6, 0.8], ['4', 0.4, 3.6], ['6', 2.2, 3.6], ['10', 4.0, 3.6], ['9', 5.8, 3.6]];
const HX0 = [['2', 1.0, 1.0], ['3', 3.2, 1.0], ['4', 5.4, 1.0], ['6', 1.0, 3.2], ['10', 3.2, 3.2], ['9', 5.4, 3.2]];   // 10 left of 9, so the two don't cross when moved to HX
scene('gr-l22-hasse-ex', '例：A = {2,3,4,6,9,10} 的整除 Hasse diagram', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('A = {2, 3, 4, 6, 9, 10}，整除'); cap('例：A = {2, 3, 4, 6, 9, 10}', '關係是整除'); },
  async (tok, S) => { S.B.add('先寫出所有有關係的配對'); cap('第一件事：寫出所有配對', '哪些整除？'); },
  async (tok, S) => { S.B.add('(2,2) (2,4) (2,6) (2,10)'); cap('2 整除 2、4、6、10', ''); },
  async (tok, S) => { S.B.add('(3,3) (3,6) (3,9)'); cap('3 整除 3、6、9', ''); },
  async (tok, S) => { S.B.add('(4,4) (6,6) (9,9) (10,10)'); cap('4、6、9、10 往上沒有了', '只有自己跟自己'); },
  async (tok, S) => { S.B.add('驗證：reflexive、antisymmetric、transitive ✔'); cap('自己驗證一下三個性質', ''); },
  async (tok, S) => { S.G = hv(HX0); cap('第二件事：畫出圖', '六個點'); },
  async (tok, S) => { S.loops = ['2', '3', '4', '6', '9', '10'].map((n) => ge(S.G, n, n, { color: COL.purple })); cap('自己跟自己都有關係', '每點一個圈'); },
  async (tok, S) => { for (const q of ['4', '6', '10']) { ge(S.G, '2', q, { dir: true }); await wt(tok, 250); } cap('2 ≼ 4、2 ≼ 6、2 ≼ 10', '這裡 ≼ 就是整除'); },
  async (tok, S) => { for (const q of ['6', '9']) { ge(S.G, '3', q, { dir: true }); await wt(tok, 250); } cap('3 ≼ 6、3 ≼ 9', ''); },
  async (tok, S) => { S.loops.forEach((e) => removeEdge(S.G, e)); S.B.add('化簡①：擦掉圈'); cap('開始化簡：先擦掉圈', ''); },
  async (tok, S) => { S.B.add('化簡②：沒有遞移邊（沒有 a≺b≺c）'); cap('再擦遞移邊：沒有 a→b→c 這種兩段的鏈', '沒有邊是推出來的：這關自動過'); },
  async (tok, S) => {
    const t = S.G.V.map((v) => { const h = HX.find(([n]) => n === v.name); return V3(h[1], h[2], 0); });
    await mv(tok, S.G, t, 1500); S.B.add('化簡③：2、3 在下面，大的放上面'); cap('像抓粽子：2、3 寫在底下', '比它們大的 4、6、9、10 放上面');
  },
  async (tok, S) => { const ed = S.G.E.map((e) => [S.G.V[e.u].name, S.G.V[e.v].name]); S.G.E.slice().forEach((e) => removeEdge(S.G, e)); ed.forEach(([p, q]) => ge(S.G, p, q)); S.B.add('化簡④：箭頭不要'); cap('箭頭都由下往上', '所以箭頭也不要'); },
  async (tok, S) => { paintE(findE(S.G, '2', '10'), COL.gold, true); paintE(findE(S.G, '3', '6'), COL.gold, true); cap('線可以交叉嗎？（2–10 和 3–6 交叉）', '沒關係，不會被誤解'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); S.B.add('Hasse diagram 完成', 'good'); cap('考試可能的考題之一', '照步驟做就好'); },
  async (tok, S) => { T('上面比較大', 'ptr', 3.1, 4.6, 0); cap('在上面的比較大', '線把小的牽上去'); },
  async (tok, S) => { vglow(S.G, '4', RED); vglow(S.G, '9', RED); T('4、9 沒有線連：不能比', 'bad', 3.1, 2.3, 1.0); cap('沒有上下線連著的', '例如 4 和 9：不能比大小'); },
], CAMW);

const MX = [['1', -1.4, 0.7], ['2', 1.0, 0.7], ['3', 3.4, 0.7], ['4', -0.2, 2.5], ['5', 2.2, 2.5], ['6', -1.2, 4.3], ['7', 1.2, 4.3]];
scene('gr-l22-maxmin', 'Maximal／greatest、minimal／least', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('再介紹一些名詞'); cap('再來介紹一些名詞', ''); },
  async (tok, S) => {
    const pts = []; for (let k = 0; k <= 40; k++) { const x = -0.6 + k * 0.12; pts.push(V3(x, 2.4 + 1.2 * Math.sin(k * 0.3) + 0.03 * k, -1.5)); }
    S.curve = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.blue })); lab.world.add(S.curve);
    cap('以前學函數：最大值、極大值', '');
  },
  async (tok, S) => { S.t1 = T('極大值：附近的都比它小（局部）', 'say', 2.0, 4.4, -1.5); cap('極大值：附近的都比我小', '區域性的概念'); },
  async (tok, S) => { S.t2 = T('最大值：整個區間都比它小', 'good', 2.0, 5.0, -1.5); cap('最大值：所有人都比它小', ''); },
  async (tok, S) => { S.t3 = T('極小值、最小值同理', 'say', 2.0, 0.4, -1.5); cap('極小值、最小值也一樣', ''); },
  async (tok, S) => { kill(S.curve); [S.t1, S.t2, S.t3].forEach(kill); S.B.add('maximal element（極大元素）'); cap('poset 裡：maximal element', '概念像極大值'); },
  async (tok, S) => { S.B.add('找不到比它大的（不能比也算）'); cap('找不到任何元素比 a 大', '可能是因為根本不能比'); },
  async (tok, S) => { S.B.add('greatest element（最大元素）'); cap('greatest element', '翻成最大值'); },
  async (tok, S) => { S.B.add('所有其他元素都 ≼ 它'); cap('所有其他元素都要小於等於它', ''); },
  async (tok, S) => { S.G = hv(MX); hasseUp(S.G, [['1', '4'], ['2', '4'], ['2', '5'], ['3', '5'], ['4', '6'], ['4', '7'], ['5', '7']]); DEMO(1.0, 0.0, 0.6); S.B.add('最大值可能不存在'); cap('poset 裡最大值可能不存在', '看這個圖'); },
  async (tok, S) => { vglow(S.G, '4', RED); cap('4 是 maximal 嗎？', '不行：有人比它大（6、7）'); },
  async (tok, S) => { vglow(S.G, '4', null); vcol(S.G, '6', COL.gold); cap('6 上面沒有人比它大', '是 maximal'); },
  async (tok, S) => { vcol(S.G, '7', COL.gold); cap('7 上面也沒有人', '也是 maximal'); },
  async (tok, S) => { T('沒有 greatest：6、7 不能比', 'bad', 0.0, 5.2, 0); cap('有沒有一個大家都比它小的？', '沒有：最大值不存在'); },
  async (tok, S) => { ['1', '2', '3'].forEach((n) => vcol(S.G, n, COL.green)); cap('有極大值；同理有極小值', '1、2、3 都是 minimal'); },
  async (tok, S) => { T('沒有 least', 'bad', 1.0, 0.2, 1.0); cap('有沒有最小值？', '沒有'); },
  async (tok, S) => { S.G.V.forEach((v) => { v.p.y += 0.8; v.m.position.copy(v.p); }); updateEdges(S.G); gv(S.G, '0', 1.0, 0, 0.5, COL.pink); ['1', '2', '3'].forEach((n) => ge(S.G, '0', n, { color: COL.pink })); cap('要有最小值：往下加一個點', '所有線都從它開始 → 它就是 least'); },
  async (tok, S) => { S.B.add('定理：有限非空 poset 一定有 maximal 和 minimal', 'good'); cap('有限、非空的 poset', '一定至少有一個極大、一個極小'); },
  async (tok, S) => { S.B.add('反例：(ℤ, ≤) 無限 → 沒有極大、極小'); cap('所有整數用 ≤', '10 上面有 20、25、100…沒有極大值'); },
  async (tok, S) => { S.B.add('證明：不是極小 → 找更小的；有限所以會停'); cap('證明：a 不是極小，就找比它小的', '有限集合，只能做有限次'); },
], CAMW);

const UB = [['a', 0.6, 0.6], ['b', 3.8, 0.6], ['c', 2.2, 1.8], ['d', 1.0, 3.0], ['e', 3.4, 3.0]];
scene('gr-l22-ub', 'Upper bound 與 least upper bound', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 6); S.B.add('upper bound（上界）'); S.G = hv(UB); hasseUp(S.G, [['a', 'c'], ['b', 'c'], ['c', 'd'], ['c', 'e']]); DEMO(4.8, 0.0, 0.6); cap('介紹 upper bound（上界）', ''); },
  async (tok, S) => { S.B.add('u 是集合 A 的上界：A 裡每個都 ≼ u'); cap('u 比集合裡所有元素都大', '就叫上界'); },
  async (tok, S) => { vcol(S.G, 'a', COL.blue); vcol(S.G, 'b', COL.blue); cap('看圖：取 a、b 兩個元素', ''); },
  async (tok, S) => { vcol(S.G, 'c', COL.gold); cap('c 比 a、b 都大', 'c 是 {a, b} 的上界'); },
  async (tok, S) => { vcol(S.G, 'd', COL.gold); cap('d 也比 a、b 都大', 'd 也是上界'); },
  async (tok, S) => { vcol(S.G, 'e', COL.gold); T('{a,b} 的上界：c、d、e', 'good', 2.0, -0.5, 1.4); cap('e 也是上界', '上界有 c、d、e'); },
  async (tok, S) => { S.B.add('上界可以在集合裡，也可以在外面'); cap('定義沒說上界一定在集合裡或外', ''); },
  async (tok, S) => { vcol(S.G, 'c', COL.blue); cap('{a, b, c}：c 是不是它的上界？', '是：c ≼ c'); },
  async (tok, S) => { S.B.add('least upper bound（最小上界）'); cap('有了上界，就有最小上界', ''); },
  async (tok, S) => { vcol(S.G, 'c', COL.green); S.B.add('{a, b} 的上界 c、d、e 中最小：c', 'good'); cap('{a, b} 的上界裡最小的是 c', 'c 是 a、b 的最小上界'); },
  async (tok, S) => { S.B.add('{a, b, c}：上界 c、d、e → LUB = c'); cap('練習：{a, b, c}', '最小上界還是 c'); },
  async (tok, S) => { vcol(S.G, 'd', COL.blue); S.B.add('{a, b, c, d}：上界只有 d → LUB = d'); cap('{a, b, c, d}：上界是 d', 'd 自己也是最小上界'); },
  async (tok, S) => { vcol(S.G, 'e', COL.blue); S.B.add('{a, b, c, d, e}：沒有上界 → 沒有 LUB', 'bad'); cap('{a, b, c, d, e}：d、e 不能比', '連上界都沒有，當然沒有最小上界'); },
], CAMW);

const LT = [['a', 1.0, 0.5], ['b', -0.8, 1.9], ['e', 1.0, 1.9], ['c', 2.8, 1.9], ['f', 0.1, 3.3], ['d', 2.8, 3.3], ['i', -0.8, 4.7], ['h', 1.6, 4.7]];
scene('gr-l22-lattice', 'Lattice：任兩元素都有 LUB 與 GLB', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 6); S.B.add('lattice'); cap('最後介紹 lattice', '前提：是一個 poset'); },
  async (tok, S) => { S.B.add('任兩個元素都有 LUB 和 GLB'); cap('任兩個元素都要有', '最小上界和最大下界'); },
  async (tok, S) => { S.G = hv(UB); hasseUp(S.G, [['a', 'c'], ['b', 'c'], ['c', 'd'], ['c', 'e']]); DEMO(1.0, 0.0, 0.6); cap('用剛才那個圖看', ''); },
  async (tok, S) => { vcol(S.G, 'd', COL.blue); vcol(S.G, 'e', COL.blue); vcol(S.G, 'c', COL.green); cap('d 和 e：最大下界是 c', ''); },
  async (tok, S) => { T('d、e 沒有上界 → 沒有 LUB', 'bad', 1.0, 5.0, 0); S.B.add('d、e 沒有 LUB → 不是 lattice', 'bad'); cap('但 d、e 沒有最小上界', '所以不是 lattice'); },
  async (tok, S) => { S.B.add('分成兩堆、不能比的也不是'); cap('分成兩堆、彼此不能比的', '也不會是 lattice'); },
  async (tok, S) => { gkill(S.G); lab.clear(); S.B = board(-6.8, 5.0, 0.5, -2.6, 6); S.G = hv(LT); hasseUp(S.G, [['a', 'b'], ['a', 'e'], ['a', 'c'], ['b', 'f'], ['e', 'f'], ['c', 'd'], ['f', 'i'], ['f', 'h'], ['d', 'h']]); DEMO(1.0, 0.0, 0.6); S.B.add('再看這個圖：是 lattice 嗎？'); cap('再看這個圖', '是不是 lattice？'); },
  async (tok, S) => { vcol(S.G, 'c', COL.blue); vcol(S.G, 'a', COL.blue); ['c', 'd', 'h'].forEach((n) => vglow(S.G, n, GOLD)); cap('c 和 a：同時比兩個都大的', '有 c、d、h'); },
  async (tok, S) => { vcol(S.G, 'c', COL.green); S.B.add('LUB(c, a) = c'); cap('其中最小的是 c', 'c 是最小上界'); },
  async (tok, S) => { S.B.add('GLB(c, a) = a'); cap('同時比 a、c 小的只有 a', 'a 是最大下界'); },
  async (tok, S) => { S.G.V.forEach((v, i) => { vcol(S.G, i, COL.node); vglow(S.G, i, null); }); S.B.add('要把所有配對都檢查過'); cap('必須把所有配對都檢查', ''); },
  async (tok, S) => { vcol(S.G, 'e', COL.blue); vcol(S.G, 'b', COL.blue); ['f', 'h', 'i'].forEach((n) => vglow(S.G, n, GOLD)); cap('e 和 b：比它們大的', '有 f、h、i'); },
  async (tok, S) => { vcol(S.G, 'f', COL.green); S.B.add('LUB(e, b) = f'); cap('f、h、i 裡最小的：f', ''); },
  async (tok, S) => { vcol(S.G, 'a', COL.green); S.B.add('GLB(e, b) = a'); cap('比 e、b 都小的只有 a', 'a 是最大下界'); },
  async (tok, S) => { S.G.V.forEach((v, i) => { vcol(S.G, i, COL.node); vglow(S.G, i, null); }); vcol(S.G, 'i', COL.blue); vcol(S.G, 'h', COL.blue); vcol(S.G, 'f', COL.green); cap('i 和 h：下界有 f、b、e、a', '最大下界是 f'); },
  async (tok, S) => { T('i、h 上面沒有共同的點', 'bad', 0.4, 5.4, 0); cap('i 和 h 有沒有上界？', '沒有，上面沒有合起來'); },
  async (tok, S) => { S.B.add('i、h 沒有 LUB → 不是 lattice', 'bad'); cap('所以這也不是 lattice', ''); },
  async (tok, S) => { S.B.add('lattice 的長相：上下都收起來'); cap('lattice 大概長這樣', '底下收起來、上面也收起來'); },
], CAMW);

const TP = [['A', 0.2, 0.5], ['B', 2.4, 0.5], ['C', 1.4, 1.6], ['D', 0.4, 2.7], ['E', 2.6, 2.7], ['F', 4.8, 0.5], ['G', 4.8, 2.2]];
const TPE = [['A', 'C'], ['B', 'C'], ['C', 'D'], ['C', 'E'], ['F', 'G']];
scene('gr-l22-topo', 'Topological sorting：每次挑一個 minimal element', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 6); S.B.add('工作之間有先後順序'); cap('搬家：要先拉網路線、先清空位置…', '工作之間有先後'); },
  async (tok, S) => { S.B.add('蓋大樓：鋼筋、水電管線、灌漿…'); cap('蓋大樓：綁鋼筋、拉管線、再灌漿', ''); },
  async (tok, S) => { S.B.add('一樓做完才能做二樓 → partial order'); cap('一樓做完才能做二樓', '工作之間就是 partial order'); },
  async (tok, S) => { S.B.add('能不能把所有工作排成一列？'); cap('能不能把一百個工作排成一列', '一次做一個'); },
  async (tok, S) => { S.B.add('第 1 個做完做第 2 個…'); cap('第一個先做、再做第二個…', '做完也不會有衝突'); },
  async (tok, S) => { S.B.add('這樣的排列：topological sorting', 'good'); cap('排出來的叫 topological sorting', '（拓撲排序）'); },
  async (tok, S) => { S.G = hv(TP); TPE.forEach(([p, q]) => ge(S.G, p, q, { dir: true })); DEMO(5.8, -0.2, 0.6); cap('例：A～G 七個工作', ''); },
  async (tok, S) => { ['A', 'C'].forEach((n) => vglow(S.G, n, GOLD)); cap('A 一定要比 C 早做', 'C 要比 D、E 早做'); },
  async (tok, S) => { ['A', 'C'].forEach((n) => vglow(S.G, n, null)); vglow(S.G, 'A', GOLD); vglow(S.G, 'B', GOLD); cap('沒有關係的兩個', '誰先誰後都可以'); },
  async (tok, S) => { vglow(S.G, 'A', null); vglow(S.G, 'B', null); S.o1 = T('A B C D E F G', 'good', 2.4, -0.3, 1.2); cap('一種答案：A B C D E F G', ''); },
  async (tok, S) => { S.B.add('能比的：小的在前、大的在後'); cap('可以比較的，小的一定在前面', ''); },
  async (tok, S) => { S.o2 = T('A B C D E F G 之外還有很多種', 'say', 2.4, -0.9, 1.2); cap('答案不只一種', ''); },
  async (tok, S) => { txt(S.o2, 'F G B A C E D 也 OK'); cap('F G B A C E D', '也符合條件'); },
  async (tok, S) => { S.B.add('演算法：每次挑剩下的 minimal element'); cap('演算法很簡單', '每次挑剩下來的一個極小元素'); },
  async (tok, S) => { S.B.add('finite poset 一定有 minimal'); cap('有限集合一定有 minimal element', '所以永遠挑得到'); },
  async (tok, S) => {
    S.out = []; const left = new Set(S.G.V.map((v) => v.name)); const done = new Set();
    while (left.size) {
      const m = [...left].find((n) => TPE.every(([p, q]) => q !== n || done.has(p)));
      left.delete(m); done.add(m); vcol(S.G, m, COL.green); S.out.push(m);
      cap('挑 ' + m + '，拿走', '排序：' + S.out.join(' ')); await wt(tok, 280);
    }
  },
  async (tok, S) => { kill(S.o2); T('topological sort：' + S.out.join(' '), 'good', 2.4, -0.9, 1.2); cap('從頭排到尾', '這就是 topological sorting'); },
], CAMW);

scene('gr-l22-gdef', '圖：節點與邊、有向與無向', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('graph：不是長條圖、折線圖'); cap('我們的「圖」不是趨勢圖、長條圖', ''); },
  async (tok, S) => { S.B.add('只有兩種東西：圈圈（節點）、線（邊）'); cap('就是之前的關係圖', '圈圈叫節點、線叫邊'); },
  async (tok, S) => { S.B.add('節點：vertex（複數 vertices）'); cap('節點：vertex', '複數 vertices'); },
  async (tok, S) => { const R = ring(10, 2.2, 0.5, 0, 2.6, 0); S.G0 = gnew('ABCDEFGHIJ'.split('').map((c, i) => [c, R[i].x, R[i].z])); S.B.add('V = {A, B, …, J}：節點集合'); cap('所有節點收集起來', '叫節點集合 V'); },
  async (tok, S) => { ge(S.G0, 'A', 'B'); ge(S.G0, 'C', 'F'); S.B.add('邊：連接兩個節點的那條線'); cap('邊：連接兩個節點之間的線', ''); },
  async (tok, S) => { ge(S.G0, 'D', 'H', { dir: true }); S.B.add('有箭頭：有向邊 → 有向圖'); cap('有箭頭的叫有向邊', '邊都有方向：有向圖'); },
  async (tok, S) => { S.B.add('不標方向：無向邊'); cap('不標方向的叫無向邊', '只是說這兩點連起來'); },
  async (tok, S) => { S.B.add('無向邊 {A, B}：大括號、不管順序'); cap('A、B 誰前誰後沒關係', '寫成 {A, B}'); },
  async (tok, S) => { gkill(S.G0); S.G = gnew([['A', 1.0, -1.0], ['B', 3.0, 1.4], ['C', 5.0, -1.0]]); S.e1 = ge(S.G, 'A', 'B'); S.e2 = ge(S.G, 'B', 'C'); S.B.add('例：V = {A, B, C}，E = {{A,B}, {B,C}}'); cap('例：三個節點 A、B、C', '邊 {A, B}、{B, C}'); },
  async (tok, S) => { T('e₁', 'ptr', 2.0, 0.9, 0.2); T('e₂', 'ptr', 4.0, 0.9, 0.2); S.B.add('邊可以取名字：e₁、e₂'); cap('寫起來很煩', '給邊取名字：e₁、e₂'); },
  async (tok, S) => { removeEdge(S.G, S.e1); removeEdge(S.G, S.e2); ge(S.G, 'B', 'A', { dir: true }); ge(S.G, 'B', 'C', { dir: true, bend: 0.5 }); ge(S.G, 'C', 'B', { dir: true, bend: 0.5 }); S.B.add('有向圖：(B, A)、(B, C)、(C, B)'); cap('有向圖：B 到 A、B 到 C', '還有 C 到 B'); },
  async (tok, S) => { S.B.add('小括號 = 有順序；大括號 = 沒順序', 'good'); cap('有方向用小括號（像座標）', '沒方向用大括號'); },
], CAMW);

const STATES = [['LA', 0.4, 1.4], ['AR', 0.6, -1.6], ['MS', 2.8, 0.2], ['AL', 5.0, 0.4]];
scene('gr-l22-simple', '五種圖之一：simple graph', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('五種圖的分類'); cap('底下定義五種不同的圖', ''); },
  async (tok, S) => { S.B.add('① simple graph（簡單圖）'); cap('第一種：simple graph', ''); },
  async (tok, S) => { S.B.add('邊 = unordered pair、兩端點不同'); cap('邊是 unordered pair', '而且兩個節點必須不一樣'); },
  async (tok, S) => { S.G = gnew([['a', 1.0, -1.4], ['b', 4.4, -1.4], ['c', 2.6, 1.6]]); ges(S.G, 'ab bc ca'); cap('畫出來長這樣', '邊都無向'); },
  async (tok, S) => { S.x1 = ge(S.G, 'a', 'b', { bend: 0.8, color: COL.pink }); S.t1 = T('✘ 兩條', 'bad', 2.7, 1.0, -2.6); cap('兩點之間最多一條線', '不能畫兩條'); },
  async (tok, S) => { S.x2 = ge(S.G, 'c', 'c', { color: COL.purple }); S.t2 = T('✘ 自己連自己', 'bad', 2.6, 2.6, 1.6); cap('自己跟自己不能連', ''); },
  async (tok, S) => { removeEdge(S.G, S.x1); removeEdge(S.G, S.x2); kill(S.t1); kill(S.t2); S.B.add('無向、最多一條、沒有自己連自己', 'good'); cap('抓住兩個重點：無向', '兩點最多一條線、不能自己連自己'); },
  async (tok, S) => { gkill(S.G); S.G = gnew(STATES, { color: '#d9e8c6' }); for (const [p, q] of [['LA', 'AR'], ['LA', 'MS'], ['AR', 'MS'], ['MS', 'AL']]) ge(S.G, p, q); DEMO(2.6, 0.3, 3.0); cap('例：州與州相鄰', '路易斯安那、密西西比、阿拉巴馬…'); },
  async (tok, S) => { S.B.add('像 symmetric relation，但不能有自己連自己'); cap('有點像 symmetric 的 binary relation', '但 relation 可以自己連自己，這裡不行'); },
], CAMW);


const eTag = (e, t, c = 'ptr') => { const p = e.curve.getPoint(0.5); return T(t, c, p.x, p.y + 0.45, p.z); };
scene('gr-l22-multi', '五種圖：multigraph、pseudograph', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('② multigraph（多重圖）'); cap('第二種：multigraph', ''); },
  async (tok, S) => { S.G = gnew([['a', 1.0, -1.6], ['b', 4.4, -1.6], ['c', 1.0, 1.6], ['d', 4.4, 1.6]]); ['0', '0.9', '-0.9'].forEach((b) => ge(S.G, 'a', 'b', { bend: Number(b) })); S.B.add('無向、兩點之間可以有好幾條邊'); cap('無向圖，兩點之間可以有好幾條邊', '例如 a、b 之間三條'); },
  async (tok, S) => { T('{a,b}, {a,b}, {a,b} ✘ 集合會合併', 'bad', 2.7, 2.6, -2.6); S.B.add('問題：集合寫 {a,b} 三次 = 一次'); cap('用集合寫：{a,b} 寫三次', '集合裡重複沒有意義，就完蛋了'); },
  async (tok, S) => { S.B.add('簡單寫法不適用 → 要給邊名字'); cap('最簡單的記法不適用', '要用進階的寫法'); },
  async (tok, S) => { gkill(S.G); lab.clear(); S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('例：V = {a, b, c, d}'); S.G = gnew([['a', 1.0, -1.6], ['b', 4.4, -1.6], ['c', 1.0, 1.6], ['d', 4.4, 1.6]]); cap('畫一個 multigraph（示意）', ''); DEMO(2.7, 0.3, 3.0); },
  async (tok, S) => { S.lp = ge(S.G, 'a', 'a', { color: COL.purple }); S.lt = T('✘ multigraph 不能自己連自己', 'bad', 1.0, 2.4, -2.4); cap('multigraph 一樣不能自己連自己', '這個是錯的'); },
  async (tok, S) => { removeEdge(S.G, S.lp); kill(S.lt); S.e = [ge(S.G, 'c', 'd', { bend: 0.5 }), ge(S.G, 'c', 'd', { bend: -0.5 }), ge(S.G, 'b', 'd', { bend: 0.5 }), ge(S.G, 'b', 'd', { bend: -0.5 })]; cap('c、d 之間兩條；b、d 之間兩條', ''); },
  async (tok, S) => { S.e.forEach((e, k) => eTag(e, 'e' + (k + 1))); S.B.add('每條邊取名字：e₁, e₂, e₃, e₄'); cap('給每條邊一個名字', 'e₁、e₂、e₃、e₄'); },
  async (tok, S) => { paintE(S.e[0], COL.gold, true); paintE(S.e[1], COL.gold, true); S.B.add('e₁、e₂ 都連 c、d'); cap('e₁ 連 c 和 d', 'e₂ 也連 c 和 d'); },
  async (tok, S) => { paintE(S.e[2], COL.green, true); paintE(S.e[3], COL.green, true); S.B.add('e₃、e₄ 都連 b、d'); cap('e₃ 連 b 和 d、e₄ 也是', '名字不同，就不會是同一件事'); },
  async (tok, S) => { S.B.add('G = (V, E, f)：f(e₁) = {c, d} …', 'good'); cap('再用一個函數 f', '告訴你每條邊連哪兩個點'); },
  async (tok, S) => { S.l1 = ge(S.G, 'a', 'a', { color: COL.purple }); S.l2 = ge(S.G, 'c', 'c', { color: COL.purple }); S.B.add('③ pseudograph：可以自己連自己'); cap('進階版：pseudograph', '允許自己連到自己（loop）'); },
  async (tok, S) => { eTag(S.l1, 'e₅', 'ptr alt'); eTag(S.l2, 'e₆', 'ptr alt'); cap('一樣每條邊都取名字', '再寫出每條從誰連到誰'); },
  async (tok, S) => { S.B.add('這三種（①②③）都是無向圖'); cap('simple、multi、pseudo', '三種都沒有方向'); },
], CAMW);

scene('gr-l22-dirtypes', '有向的兩種與分類表', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 4); S.B.add('④ directed graph（digraph）'); S.G = gnew([['a', 1.2, -1.6], ['b', 4.4, -1.6], ['c', 2.8, 1.4]]); ge(S.G, 'a', 'b', { dir: true }); ge(S.G, 'b', 'c', { dir: true }); ge(S.G, 'c', 'c', { color: COL.purple }); DEMO(2.8, 0.3, 3.0); cap('有方向的圖：directed graph', '懶人寫法 digraph'); },
  async (tok, S) => { S.B.add('就是以前的 binary relation 圖'); cap('有方向的圖', '就是以前 binary relation 的圖示法'); },
  async (tok, S) => { S.B.add('邊 (a, b)：小括號'); cap('邊從誰到誰', '用小括號'); },
  async (tok, S) => { ge(S.G, 'a', 'b', { dir: true, bend: 0.8, color: COL.pink }); S.B.add('⑤ directed multigraph：同向可多條'); cap('允許兩條邊同向推過去', 'directed multigraph：每條邊要編號'); },
  async (tok, S) => {
    gkill(S.G); lab.clear();
    const rows = ['類型               邊     多重邊  loop', 'simple graph       無向   ✘      ✘', 'multigraph         無向   ✔      ✘', 'pseudograph        無向   ✔      ✔', 'directed graph     有向   ✘      ✔', 'directed multigraph 有向  ✔      ✔'];
    S.Mx = matrix(rows[0], rows.slice(1), -5.6, 3.6, 0.6, -1.0); S.Mx.all(); cap('最後幫你分類一下', '');
  },
  async (tok, S) => { T('前三種無向、後兩種有向', 'good', 0, 0.2, 1.4); cap('前三個無向', '後兩個有方向'); },
  async (tok, S) => { T('多重邊：simple、directed graph 不行', 'say', 0, -0.0, 2.2); cap('兩點之間多條邊', 'simple 和 directed graph 不行，其他都可以'); },
  async (tok, S) => { T('loop：前兩種不行，後三種可以', 'say', 0, -0.2, 3.0); cap('能不能自己連自己', '前兩種不行、後三種可以'); },
], CAMT);

scene('gr-l22-terms', '無向圖的用語：adjacent、endpoint、incident', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 8); S.B.add('名詞解釋'); cap('接著是名詞解釋', ''); },
  async (tok, S) => { S.B.add('考題常是完整的英文句子'); cap('研究所考題都是完整句子', '不會像這裡用冒號、圖示'); },
  async (tok, S) => { S.B.add('要從動詞、名詞看出誰是節點、誰是邊'); cap('從敘述裡看出關係', '哪個是節點、哪個是邊'); },
  async (tok, S) => { S.G = gnew([['u', 1.2, 0], ['v', 4.6, 0]]); S.e = ge(S.G, 'u', 'v'); eTag(S.e, 'e'); S.B.add('undirected graph'); cap('在無向圖（undirected graph）裡', ''); },
  async (tok, S) => { S.B.add('e = {u, v}'); cap('u、v 是兩個節點', '邊 e 連著 u 和 v'); },
  async (tok, S) => { vglow(S.G, 'u', GOLD); vglow(S.G, 'v', GOLD); S.B.add('u、v adjacent（相鄰）／neighbors'); cap('u 和 v 是 adjacent（相鄰）', '或說互為 neighbors（鄰居）'); },
  async (tok, S) => { S.B.add('u、v 是 e 的 endpoints（端點）'); cap('u、v 是邊 e 的兩個 endpoints', ''); },
  async (tok, S) => { paintE(S.e, COL.gold, true); S.B.add('e is incident with u and v'); cap('e incident with u 和 v', 'incident：連接（形容詞）'); },
  async (tok, S) => { S.B.add('e connects u and v（動詞）'); cap('也可以說 e connects u and v', '寫法不同，意思都一樣'); },
], CAMW);

scene('gr-l22-degree', 'Degree、isolated、pendant 與握手定理', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 7); S.B.add('除了描述，還要會數數'); cap('除了會描述，還要會算數', ''); },
  async (tok, S) => { S.B.add('degree：連了幾條線出去'); cap('每個節點有一個 degree', '就是連了幾條線出去'); },
  async (tok, S) => { S.B.add('G 是無向圖'); S.G = gnew([['A', 0.6, -1.6], ['B', 2.8, -2.0], ['C', 2.6, 0.6], ['D', 5.0, -0.6], ['E', 5.0, 2.2]]); ges(S.G, 'BC CD BD'); DEMO(2.8, 0.3, 3.2); cap('先看無向圖（示意）', ''); },
  async (tok, S) => { S.B.add('deg(v) = 和 v 相接（incident）的邊數'); cap('deg(v)：有幾條邊跟 v 相連', '（loop 算兩次）'); },
  async (tok, S) => { S.B.add('deg = 0：isolated（孤立點）'); cap('沒有邊相連：degree = 0', '叫 isolated'); },
  async (tok, S) => { vcol(S.G, 'A', COL.pink); vcol(S.G, 'E', COL.pink); vlab(S.G, 'A', 'A:0'); cap('A 沒有人跟它連', 'A 是孤立點'); },
  async (tok, S) => { vlab(S.G, 'C', 'C:' + degOf(S.G, 'C')); cap('C 有兩條邊相連', 'deg(C) = ' + degOf(S.G, 'C')); },
  async (tok, S) => { S.B.add('deg = 1：pendant（懸吊點）'); cap('degree = 1 的節點', '叫 pendant'); },
  async (tok, S) => { ge(S.G, 'C', 'A', { color: COL.gold }); vcol(S.G, 'A', COL.gold); vlab(S.G, 'A', 'A:1'); vlab(S.G, 'C', 'C:' + degOf(S.G, 'C')); cap('從 C 拉一條線到 A：A 掛在別人身上', 'deg(A) = 1，C 變成 ' + degOf(S.G, 'C')); },
  async (tok, S) => { S.B.add('握手原理'); cap('degree 有一個很簡單的關係', '叫握手原理'); },
  async (tok, S) => { ge(S.G, 'D', 'E'); vcol(S.G, 'E', COL.node); S.G.E.forEach((e) => paintE(e, COL.edge, false)); paintE(S.G.E[0], COL.gold, true); vglow(S.G, 'B', GOLD); vglow(S.G, 'C', GOLD); cap('每一條邊都連兩個節點', ''); },
  async (tok, S) => { vglow(S.G, 'B', null); vglow(S.G, 'C', null); T(S.G.E.length + ' 條邊 → ' + 2 * S.G.E.length + ' 個線頭', 'say', 2.8, 2.8, -2.6); cap('一條邊有兩頭', S.G.E.length + ' 條邊總共 ' + 2 * S.G.E.length + ' 個連線點'); },
  async (tok, S) => { cap('換用節點來數', '每個節點數自己身上的線頭'); },
  async (tok, S) => { S.B.add('Σ over v∈V deg(v) = 2|E|', 'good'); cap('所有節點的 degree 加總', '等於兩倍的邊數'); },
  async (tok, S) => { icon('🤝', '舞會握手', 2.8, 3.8, -2.6); cap('像在舞會握手', '握一次手是兩個人的事'); },
  async (tok, S) => { S.G.E.forEach((e, k) => paintE(e, PAL[k % 8], true)); cap('驗證：總共幾條邊？', S.G.E.length + ' 條'); },
  async (tok, S) => { showDeg(S.G); cap('各點 degree', S.G.V.map((v, i) => v.name + '=' + deg(S.G)[i]).join('、')); },
  async (tok, S) => { S.B.add(deg(S.G).join(' + ') + ' = ' + sumDeg(S.G) + ' = 2 × ' + S.G.E.length, 'good'); cap('加起來 ' + sumDeg(S.G), '= 2 × ' + S.G.E.length + ' ✔'); },
], CAMW);

const DG5 = [['a', 0.6, -1.8], ['b', 3.0, -2.2], ['c', 3.4, 0.6], ['d', 0.6, 1.4], ['e', 5.6, 1.6]];
const DG5E = [['d', 'a'], ['d', 'b'], ['b', 'c'], ['d', 'c'], ['e', 'c'], ['c', 'e']];
scene('gr-l22-dir', '有向圖：initial／terminal、in-degree／out-degree', [
  async (tok, S) => { S.B = board(-6.6, 4.9, 0.52, -2.6, 7); S.B.add('有向圖（directed graph）'); cap('接著是有向圖', ''); },
  async (tok, S) => { S.B.add('動詞、介係詞要講方向'); cap('有向圖的動詞和介係詞稍微不一樣', '因為要講方向'); },
  async (tok, S) => { S.G = gnew([['u', 1.2, 0], ['v', 4.6, 0]]); S.e = ge(S.G, 'u', 'v', { dir: true }); S.B.add('u adjacent to v；v adjacent from u'); cap('邊 e 從 u 到 v', 'u adjacent to v、v adjacent from u'); },
  async (tok, S) => { S.B.add('e goes from u to v'); cap('e comes from u、goes to v', ''); },
  async (tok, S) => { vcol(S.G, 'u', COL.green); vcol(S.G, 'v', COL.pink); S.B.add('u：initial vertex　v：terminal vertex'); cap('u 是起始節點（initial vertex）', 'v 是終止節點（terminal vertex）'); },
  async (tok, S) => { S.B.add('degree 分「進來」和「出去」'); cap('一樣有 degree', '但有進有出，想分開算'); },
  async (tok, S) => {
    gkill(S.G); S.G = gnew(DG5); DG5E.forEach(([p, q], k) => ge(S.G, p, q, { dir: true, bend: (p === 'e' || q === 'e') && (p === 'c' || q === 'c') ? 0.5 : 0 })); DEMO(3.0, 0.3, 3.2);
    S.B.add('deg⁻(v)：in-degree　deg⁺(v)：out-degree'); cap('負號：in-degree（進來幾條）', '正號：out-degree（出去幾條）');
  },
  async (tok, S) => { const e = S.G.E.find((x) => S.G.V[x.v].name === 'a'); paintE(e, COL.gold, true); vlab(S.G, 'a', 'a: in 1'); cap('a 有一條邊進來', 'deg⁻(a) = 1'); },
  async (tok, S) => { vlab(S.G, 'a', 'a: in 1 out 0'); cap('a 有沒有邊出去？沒有', 'deg⁺(a) = 0'); },
  async (tok, S) => { vlab(S.G, 'b', 'b: in 1 out 1'); cap('b：進來 1 條、出去 1 條', ''); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, S.G.V[e.v].name === 'c' ? COL.gold : COL.edge, S.G.V[e.v].name === 'c')); vlab(S.G, 'c', 'c: in 3'); cap('c 進來幾條？1、2、3', 'deg⁻(c) = 3'); },
  async (tok, S) => { vlab(S.G, 'c', 'c: in 3 out 1'); cap('c 出去 1 條', 'deg⁺(c) = 1'); },
  async (tok, S) => { T('不寫正負：deg(c) = 3 + 1 = 4', 'say', 3.0, 2.8, -2.6); cap('沒寫正負號的 degree', '= 進 + 出'); },
  async (tok, S) => {
    const ind = S.G.V.map((_, i) => S.G.E.filter((e) => e.v === i).length), outd = S.G.V.map((_, i) => S.G.E.filter((e) => e.u === i).length);
    S.B.add('Σ deg⁻ = ' + ind.reduce((a, b) => a + b, 0) + ' = Σ deg⁺ = ' + outd.reduce((a, b) => a + b, 0) + ' = |E|', 'good');
    cap('握手定理：進來的總和 = 出去的總和', '= 邊數 ' + S.G.E.length + '（一進一出）');
  },
], CAMW);


// ════════ y4sLC9zeEvU（交大 易志偉 Lec23：Kₙ、Cₙ、Wₙ、Qₙ、二分圖、子圖、圖的表示法、同構） ════════
scene('gr-l23-list', '幾種特殊的圖', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('Kₙ：complete graph（完全圖）'); S.G = ringG(4, 2.8, 1.6); completeE(S.G); cap('complete graph：Kₙ', 'K 開頭'); },
  async (tok, S) => { S.B.add('Cₙ：cycle（環）'); cap('cycle：就是一個環', '用 Cₙ'); },
  async (tok, S) => { S.B.add('Wₙ：wheel（輪子）'); cap('wheel：輪子', '想想腳踏車輪子'); },
  async (tok, S) => { S.B.add('Qₙ：n-cube（超立方體）'); cap('n-cube：Qₙ', '這幾個裡面最難的一個'); },
  async (tok, S) => { S.B.add('超級電腦的架構會用到 n-cube'); cap('以前的超級電腦', '有些架構用 n-cube'); },
  async (tok, S) => { S.B.add('bipartite graph：二分圖'); cap('最後：bipartite graph', '二分圖'); },
], CAMW);

scene('gr-l23-kn', '完全圖 Kₙ：n 點、n(n−1)/2 邊', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('完全圖'); cap('完全圖，之所以叫「完全」', ''); },
  async (tok, S) => { S.G = ringG(3, 2.6, 1.8); cap('給三個節點：K₃', ''); },
  async (tok, S) => { for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { addEdge(S.G, i, j, 0, PAL[i]); await wt(tok, 250); } cap('把所有可能的邊全部畫上去', ''); },
  async (tok, S) => { S.lb = T('K₃：3 點 3 邊', 'good', 2.6, 2.6, -2.4); cap('這就是 K₃', ''); },
  async (tok, S) => { gkill(S.G); kill(S.lb); S.G = ringG(4, 2.6, 2.0); completeE(S.G); S.lb = T('K₄：4 點 ' + S.G.E.length + ' 邊', 'good', 2.6, 2.6, -2.4); cap('K₄ 長這樣', ''); },
  async (tok, S) => { S.B.add('任兩個不同節點之間都有邊'); cap('定義：V 裡任兩個不同節點之間', '邊都要畫上去'); },
  async (tok, S) => { S.B.add('Kₙ 有 n 個節點'); cap('Kₙ 有幾個節點？根據定義 n 個', 'K₄ 四個'); },
  async (tok, S) => { gkill(S.G); kill(S.lb); S.G = ringG(5, 2.6, 2.2); completeE(S.G); S.lb = T('K₅：5 點 ' + S.G.E.length + ' 邊', 'good', 2.6, 2.6, -2.4); cap('K₅ 五個節點', ''); },
  async (tok, S) => { S.B.add('|E| = n(n−1)/2', 'good'); cap('所有點跟點之間都畫：n(n−1)/2', 'K₅：5 × 4 / 2 = 10'); },
  async (tok, S) => { S.B.add('常考填充、是非'); cap('數數要記得', '常考填充、是非題'); },
], CAMW);

scene('gr-l23-cn', '環 Cₙ：n 點、n 邊', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('cycle：環'); cap('第二個：cycle，環', ''); },
  async (tok, S) => { S.B.add('下標 = 節點個數'); cap('下標表示有幾個節點', ''); },
  ...[5, 6, 7, 8].map((n) => async (tok, S) => {
    if (S.G) gkill(S.G); if (S.lb) kill(S.lb);
    S.G = ringG(n, 2.6, 2.2); for (let i = 0; i < n; i++) { addEdge(S.G, i, (i + 1) % n, 0, COL.blue); await wt(tok, 90); }
    S.lb = T('C' + n, 'good', 2.6, 2.6, -2.4); cap('C' + n + '：' + n + ' 個節點串成一圈', '');
  }),
  async (tok, S) => { S.B.add('C₈：|V| = ' + S.G.V.length); cap('C₈ 有幾個節點？8', ''); },
  async (tok, S) => { S.B.add('|E| = ' + S.G.E.length + '：邊數也是 n', 'good'); cap('邊數也是 8', ''); },
  async (tok, S) => { S.B.add('像圓形種樹：樹數 = 間隔數'); cap('像小學的種樹問題', '繞一圈：點數跟線段數一樣'); },
], CAMW);

scene('gr-l23-wn', '輪 Wₙ：n + 1 點、2n 邊', [
  async (tok, S) => { S.B = board(-6.6, 4.8); S.B.add('wheel：輪子'); cap('輪子：W 開頭', '定義要小心'); },
  async (tok, S) => { S.G = ringG(6, 2.6, 2.4); cycleE(S.G); S.G.E.forEach((e) => paintE(e, COL.blue, false)); S.B.add('W₆：外圈是 C₆'); cap('W₆：外面這一圈是 C₆', ''); },
  async (tok, S) => { S.hub = gv(S.G, 'h', 2.6, 0, 0.5, COL.gold); cap('加上中間一個輪軸', ''); },
  async (tok, S) => { for (let i = 0; i < 6; i++) { addEdge(S.G, i, S.hub, 0, COL.gold); await wt(tok, 160); } cap('輪軸連到每個點：鋼線', ''); },
  async (tok, S) => { S.B.add('|V| = 6 + 1 = ' + S.G.V.length); cap('W₆ 有幾個節點？6 + 1 = 7', ''); },
  async (tok, S) => { S.B.add('|E| = 6 + 6 = ' + S.G.E.length + '（2n）', 'good'); cap('邊：外面 6 條、中間 6 條', '2n = ' + S.G.E.length); },
], CAMW);

// n-cube: reuse the module's qn(n) layout, moved to the right; copies are split by the highest bit
function qG(n, dx = 2.6, maxBit = n) {
  const D = qn(n); const G = gnew(D.names.map((nm, i) => [nm, D.pos[i].x + dx, D.pos[i].z, D.pos[i].y - 0.4]), { r: 0.24 });
  D.edges.forEach(([u, v]) => { const b = Math.log2(u ^ v); if (b < maxBit) addEdge(G, u, v, 0, PAL[b]); });
  return G;
}
function qBit(tok, G, n, bit) { const D = qn(n); return D.edges.filter(([u, v]) => Math.log2(u ^ v) === bit).map(([u, v]) => addEdge(G, u, v, 0, COL.gold)); }
scene('gr-l23-qn', 'n-cube Qₙ：遞迴定義與邊數', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('Qₙ：遞迴定義'); cap('cube 是遞迴式的定義', ''); },
  async (tok, S) => { S.G = qG(3, 2.6, 2); cap('Q₃ 是兩個 Q₂', '一份在上、一份在下'); },
  async (tok, S) => { for (const e of qBit(tok, S.G, 3, 2)) { await wt(tok, 120); } S.B.add('Q₃ = 兩個 Q₂ + 對應點連邊'); cap('相對應的節點之間', '各連上一條邊 → Q₃'); },
  async (tok, S) => { gkill(S.G); S.G = qG(4, 2.6, 3); S.B.add('Q₄：Q₃ 複製兩份'); cap('Q₄ 從 Q₃ 來', '把它複製兩份'); },
  async (tok, S) => { for (const e of qBit(tok, S.G, 4, 3)) { await wt(tok, 80); } cap('同樣位置的節點兩兩連上一條邊', '這就是 Q₄'); },
  async (tok, S) => { gkill(S.G); S.G = gnew([['', 0.2, 0, 1.0]], { r: 0.26 }); T('Q₀', 'ptr', 0.2, 0.2, 0.8); S.B.add('Q₀：一個節點、沒有邊'); cap('最原始的 Q₀', '一個節點、沒有邊'); },
  async (tok, S) => { S.Q1 = gnew([['0', 1.4, 0, 1.0], ['1', 2.6, 0, 1.0]], { r: 0.24 }); ge(S.Q1, '0', '1', { color: PAL[0] }); T('Q₁', 'ptr', 2.0, 0.2, 0.8); cap('Q₁：Q₀ 複製兩份', '中間加一條邊'); },
  async (tok, S) => { S.Q2 = gnew([['00', 3.6, 0, 0.6], ['01', 4.8, 0, 0.6], ['10', 3.6, 0, 1.8], ['11', 4.8, 0, 1.8]], { r: 0.24 }); ge(S.Q2, '00', '01', { color: PAL[0] }); ge(S.Q2, '10', '11', { color: PAL[0] }); ge(S.Q2, '00', '10', { color: COL.gold }); ge(S.Q2, '01', '11', { color: COL.gold }); T('Q₂', 'ptr', 4.2, 0.2, 0.8); cap('Q₂：Q₁ 複製兩份', '相對應的加上邊'); },
  async (tok, S) => { S.B.add('節點數：Q₀ 1、Q₁ 2、Q₂ 4'); cap('節點個數：1、2、4', '每次兩倍'); },
  async (tok, S) => { S.B.add('Q₃：2³ = 8'); cap('Q₃ 的節點：2³ = 8', ''); },
  async (tok, S) => { S.B.add('Q₄：2⁴ = 16'); cap('Q₄ 再兩倍：16 個', ''); },
  async (tok, S) => { S.B.add('邊數：要寫遞迴關係式'); cap('邊的個數怎麼算？', '寫一個遞迴關係'); },
  async (tok, S) => { S.B.add('Q₂：2 × 1 + 2 = 4'); cap('Q₂ 的邊 = 兩倍 Q₁ 的邊 + Q₁ 的節點數', '2 × 1 + 2 = 4'); },
  async (tok, S) => { S.B.add('Q₃：2 × 4 + 4 = 12'); cap('Q₃：兩份 Q₂ 各 4 條', '再加 4 條對應邊：12'); },
  async (tok, S) => { S.B.add('Q₄：2 × 12 + 8 = 32'); cap('Q₄：兩份各 12 條 = 24', '加上 8 條對應邊：32'); },
  async (tok, S) => { S.B.add('節點：aₙ = 2aₙ₋₁，a₀ = 1 ⇒ aₙ = 2ⁿ', 'good'); cap('節點數 aₙ = 2aₙ₋₁', 'aₙ = 2ⁿ'); },
  async (tok, S) => { S.B.add('邊：eₙ = 2eₙ₋₁ + 2ⁿ⁻¹，e₀ = 0 ⇒ eₙ = n·2ⁿ⁻¹', 'good'); cap('邊數 eₙ = 2eₙ₋₁ + 2ⁿ⁻¹', '解出來 eₙ = n·2ⁿ⁻¹'); },
], CAMW);

scene('gr-l23-qdef', 'Qₙ 的正式寫法', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('比較正式的寫法'); cap('把邊和節點正式寫下來', ''); },
  async (tok, S) => { S.B.add('Q₀ = ({v₀}, ∅)'); cap('Q₀：只有一個節點 v₀', '邊是空集合'); },
  async (tok, S) => { S.G = gnew([['v1', 1.0, -1.2], ['v2', 1.0, 1.2]]); ge(S.G, 'v1', 'v2'); S.B.add('Qₙ = (V, E)，V = {v₁, …, v_k}'); cap('Qₙ 由節點集合 V 和邊集合 E 組成', '（右邊以 Q₁ 為例，示意）'); },
  async (tok, S) => { gv(S.G, "v1'", 4.4, -1.2, 0.5, COL.pink); gv(S.G, "v2'", 4.4, 1.2, 0.5, COL.pink); ge(S.G, "v1'", "v2'"); S.B.add("Qₙ₊₁ 的節點：V ∪ {v₁', …, v_k'}"); cap('Qₙ₊₁：節點複製一份', "像雙胞胎，頭上加一撇"); },
  async (tok, S) => { ge(S.G, 'v1', "v1'", { color: COL.gold }); ge(S.G, 'v2', "v2'", { color: COL.gold }); S.B.add("邊：E ∪ E' ∪ {{vᵢ, vᵢ'}}", 'good'); cap("原來的邊、雙胞胎的邊", "再加上每對 vᵢ、vᵢ' 之間一條"); },
], CAMW);

scene('gr-l23-bip', '二分圖與完全二分圖 Kₘ,ₙ', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('二分圖（bipartite graph）'); cap('二分圖', ''); },
  async (tok, S) => { S.B.add('節點分兩堆，邊只在兩堆之間'); cap('節點集合分成兩堆', '邊只存在兩堆之間'); },
  async (tok, S) => { S.B.add('所有可能的邊都加上 → 完全二分圖'); cap('把所有可能的邊都加上', '叫完全二分圖'); },
  async (tok, S) => { S.G = gnew([['a', 0.6, -1.6], ['b', 1.8, 1.4], ['c', 3.0, -1.6], ['d', 4.2, 1.4], ['e', 5.4, -1.6]]); ges(S.G, 'ab bc cd de'); cap('隨便舉一個圖：是不是二分圖？', '邊：ab、bc、cd、de'); },
  async (tok, S) => { cap('能不能把節點分成兩組', '同一組裡沒有邊？'); },
  async (tok, S) => { ['a', 'c', 'e'].forEach((n) => vcol(S.G, n, COL.orange)); ['b', 'd'].forEach((n) => vcol(S.G, n, '#f2d04a')); S.B.add('{a, c, e}、{b, d}'); cap('a、c、e 一組', 'b、d 一組'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.green, true)); cap('邊都在橘色和黃色之間', '同色之間沒有邊 → 二分圖'); },
  async (tok, S) => { await mv(tok, S.G, [V3(1.0, 0.5, -2.0), V3(4.6, 0.5, -1.0), V3(1.0, 0.5, 0), V3(4.6, 0.5, 1.0), V3(1.0, 0.5, 2.0)], 1400); cap('比較容易看的畫法', 'a、c、e 畫左邊；b、d 畫右邊'); },
  async (tok, S) => { S.B.add('左邊之間沒邊、右邊之間沒邊'); cap('邊只在兩邊中間', ''); },
  async (tok, S) => { gkill(S.G); S.G = gnew([['u1', 1.0, -1.0], ['u2', 1.0, 1.0], ['v1', 4.6, -1.0], ['v2', 4.6, 1.0]]); for (const p of ['u1', 'u2']) for (const q of ['v1', 'v2']) ge(S.G, p, q); S.lb = T('K₂,₂', 'good', 2.8, 2.4, -2.4); S.B.add('左 2、右 2，全部連上：K₂,₂'); cap('左邊兩個、右邊兩個', '能畫的全畫上：K₂,₂'); },
  async (tok, S) => { S.B.add('節點：2 + 2 = ' + S.G.V.length); cap('節點數：左邊 + 右邊', '2 + 2 = 4'); },
  async (tok, S) => { S.B.add('邊：2 × 2 = ' + S.G.E.length); cap('邊數：所有配對', '2 × 2 = 4'); },
  async (tok, S) => { gkill(S.G); kill(S.lb); S.G = gnew([['u1', 1.0, -1.0], ['u2', 1.0, 1.0], ['v1', 4.6, -1.8], ['v2', 4.6, 0], ['v3', 4.6, 1.8]]); for (const p of ['u1', 'u2']) for (const q of ['v1', 'v2', 'v3']) ge(S.G, p, q); T('K₂,₃', 'good', 2.8, 2.4, -2.4); S.B.add('K₂,₃：' + S.G.V.length + ' 點、' + S.G.E.length + ' 邊', 'good'); cap('K₂,₃：2 + 3 = 5 個節點', '2 × 3 = 6 條邊'); },
], CAMW);

scene('gr-l23-sub', '子圖與圖的聯集', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('子圖（subgraph）'); cap('子圖：這個名詞用得很廣', ''); },
  async (tok, S) => { S.G = gnew([['a', -0.8, -1.4], ['b', 1.6, -1.4], ['c', 1.6, 1.4], ['d', -0.8, 1.4]]); ges(S.G, 'ab bc cd da ac'); T('G', 'ptr', 0.4, 0.1, 2.6); S.H = gnew([['a', 3.4, -1.4], ['b', 5.8, -1.4], ['c', 5.8, 1.4]], { color: COL.blue }); ges(S.H, 'ab bc'); T('H', 'ptr alt', 4.6, 0.1, 2.6); cap('一個圖 G、一個圖 H', ''); },
  async (tok, S) => { S.B.add('H 是 G 的子圖：H 本身要是個圖'); cap('H 是 G 的子圖', '首先 H 要長得像一個圖'); },
  async (tok, S) => { S.B.add('每條邊兩頭都要有節點'); cap('由節點和邊組成', '邊的兩頭一定要有節點'); },
  async (tok, S) => { S.B.add('V(H) ⊆ V(G)'); cap('H 的節點是 G 節點的子集合', ''); },
  async (tok, S) => { S.B.add('E(H) ⊆ E(G)', 'good'); cap('H 的邊也是 G 邊的子集合', '定義就這樣'); },
  async (tok, S) => { S.bad = ge(S.H, 'c', 'a', { color: COL.hot }); kill(S.H.V[0].m); S.x = T('a 沒拿，卻留下邊 ca ✘', 'bad', 4.6, 2.4, -1.4); cap('如果這邊沒有節點 a', '卻把連到 a 的邊帶過來'); },
  async (tok, S) => { S.B.add('邊的兩頭節點必須都在裡面', 'bad'); cap('就不是一個圖', '不能叫子圖'); },
  async (tok, S) => { lab.clear(); S.B = board(-6.8, 5.0, 0.5, -2.6, 7); S.B.add('圖的聯集 G₁ ∪ G₂'); S.U = gnew([['a', 1.0, -1.4], ['b', 3.4, -1.4], ['c', 3.4, 1.4], ['d', 5.6, 0]]); ge(S.U, 'a', 'b', { color: COL.blue }); ge(S.U, 'b', 'c', { color: COL.blue }); ge(S.U, 'b', 'd', { color: COL.pink }); ge(S.U, 'c', 'd', { color: COL.pink }); S.B.add('V₁ ∪ V₂，E₁ ∪ E₂', 'good'); DEMO(3.3, 0.3, 2.8); cap('聯集：節點集合聯集', '邊集合也聯集（藍 = G₁、粉 = G₂）'); },
], CAMW);


const RP = [['A', 0.6, -1.8], ['B', 3.0, -0.4], ['C', 0.8, 1.4], ['D', 5.6, 2.2], ['E', 5.4, -1.8], ['F', 3.2, 2.2]];
const RPE = 'AB AC BC BE BF CF';
const rpG = () => { const G = gnew(RP); ges(G, RPE); return G; };
const nbrs = (G, n) => G.E.filter((e) => e.u === vi(G, n) || e.v === vi(G, n)).map((e) => G.V[e.u === vi(G, n) ? e.v : e.u].name).sort();
scene('gr-l23-rep', '圖的表示法：邊列表、adjacency list', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 4); S.B.add('圖的不同表示法'); cap('不同的表示法', '演算法課會更在意'); },
  async (tok, S) => { S.B.add('電腦裡怎麼存節點和邊？'); cap('節點和邊', '要怎麼在電腦裡寫出來？'); },
  async (tok, S) => { S.B.add('矩陣：最重要、最簡單'); cap('我們會的：矩陣', '相鄰矩陣是最重要、最簡單的'); },
  async (tok, S) => { S.G = rpG(); DEMO(3.0, 0.3, 3.2); S.B.add('例：V = {A, B, C, D, E, F}'); cap('以這個圖為例', '節點 A～F'); },
  async (tok, S) => { S.L = M('E = {AB, AC, BC, BE, BF, CF}', -6.6, 2.6, -2.6, 'note'); S.G.E.forEach((e) => paintE(e, COL.gold, true)); cap('最簡單：把所有邊寫下來', '無向圖：AB、AC、BC、BE、BF、CF'); },
  async (tok, S) => { S.G.E.forEach((e) => paintE(e, COL.edge, false)); cls(S.L, 'say'); S.B.add('adjacency list（相鄰清單）'); cap('adjacency list', '寫下每個節點的鄰居'); },
  ...['A', 'B', 'C', 'D', 'E', 'F'].map((n, k) => async (tok, S) => {
    S.G.V.forEach((v, i) => vglow(S.G, i, null)); vglow(S.G, n, GOLD); const nb = nbrs(S.G, n); nb.forEach((m) => vcol(S.G, m, COL.green));
    M(n + ' : ' + (nb.join(', ') || '（空）'), -6.6, 2.0 - k * 0.6, -2.6, 'note');
    cap(n + ' 的鄰居：' + (nb.join('、') || '沒有'), '');
    await wt(tok, 400); nb.forEach((m) => vcol(S.G, m, COL.node));
  }),
  async (tok, S) => { S.G.V.forEach((v, i) => vglow(S.G, i, null)); S.B.add('空間大約和邊數成正比（list）'); cap('每個表示法都有優缺點', 'list 的記憶體大約跟邊數成正比'); },
  async (tok, S) => { lab.clear(); S.B = board(-6.8, 5.0, 0.5, -2.6, 4); S.B.add('有向圖的 adjacency list'); S.G = gnew(RP); cap('有向圖要把方向考慮進去', ''); },
  async (tok, S) => { for (const [p, q] of [['A', 'B'], ['B', 'C'], ['C', 'B'], ['B', 'E'], ['C', 'A'], ['F', 'B'], ['F', 'C']]) ge(S.G, p, q, { dir: true, bend: (p === 'B' && q === 'C') || (p === 'C' && q === 'B') ? 0.4 : 0 }); DEMO(3.0, 0.3, 3.2); cap('每條邊加上方向（BF、CF 的方向是示意）', ''); },
  async (tok, S) => { S.B.add('只寫「從我出去」的邊的頭'); cap('清單裡寫的是邊的頭', '從這個節點出去，指到誰'); },
  async (tok, S) => {
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((n, k) => { const out = S.G.E.filter((e) => e.u === vi(S.G, n)).map((e) => S.G.V[e.v].name).sort(); M(n + ' → ' + (out.join(', ') || '（空）'), -6.6, 2.4 - k * 0.6, -2.6, k < 3 ? 'note' : 'say'); });
    cap('A → B；B → C、E；C → A、B', '');
  },
], CAMW);

function matMul(X, Y) { return X.map((r, i) => Y[0].map((_, j) => r.reduce((s, x, k) => s + x * Y[k][j], 0))); }
scene('gr-l23-mat', 'Adjacency matrix、incidence matrix、Aᵏ 數路徑', [
  async (tok, S) => { S.B = board(-6.8, 5.0, 0.5, -2.6, 4); S.B.add('兩種矩陣表示'); S.G = rpG(); cap('另外兩種：矩陣表示', ''); },
  async (tok, S) => {
    S.A = S.G.V.map((_, i) => S.G.V.map((_, j) => (findE(S.G, i, j) ? 1 : 0)));
    S.Mx = matrix('    A B C D E F', S.A.map((r, i) => 'ABCDEF'[i] + ' │ ' + r.join(' ')), -6.6, 2.8, 0.42, -2.6); S.Mx.all();
    S.B.add('adjacency matrix（相鄰矩陣）'); cap('adjacency matrix', '就是之前 relation 的矩陣表示法');
  },
  async (tok, S) => { S.B.add('無向 → 對稱', 'good'); cap('無向圖：A、B 相鄰，B、A 也相鄰', '是對稱矩陣'); },
  async (tok, S) => { S.B.add('有向圖：從列看到行，不一定對稱'); cap('有向圖要記方向', '從列看到行：不一定對稱'); },
  async (tok, S) => { S.Mx.kill(); lab.clear(); S.B = board(-6.8, 5.0, 0.5, -2.6, 3); S.B.add('incidence matrix（關聯矩陣）'); S.G = gnew([['v1', 1.0, -1.6], ['v2', 3.4, -2.0], ['v3', 2.0, 0.6], ['v4', 5.2, -0.4], ['v5', -0.2, 2.6], ['v6', 4.0, 2.4]]); DEMO(3.0, 0.3, 3.3); cap('另一種：incidence matrix', '物件不一樣'); },
  async (tok, S) => { cap('這個圖有 ' + S.G.V.length + ' 個節點', 'v1～v6'); },
  async (tok, S) => { S.IE = [['v1', 'v2'], ['v1', 'v3'], ['v2', 'v4'], ['v3', 'v5'], ['v3', 'v6']]; S.IE.forEach(([p, q], k) => eTag(ge(S.G, p, q), 'e' + (k + 1))); cap('5 條邊', '（e3～e5 的位置是示意）'); },
  async (tok, S) => { S.H = M('     v1 v2 v3 v4 v5 v6', -6.6, 2.55, -2.6, 'say'); T('Rosen 課本是轉置：列是節點、行是邊', 'idx', -3.6, 3.2, -2.6); cap('矩陣 5 列 6 行', '列是邊、行是節點（老師的寫法）'); },
  async (tok, S) => { S.IE.forEach(([p, q], k) => { if (k) return; M('e' + (k + 1) + ' │ ' + S.G.V.map((v) => (v.name === p || v.name === q ? ' 1' : ' 0')).join(' '), -6.6, 1.9 - k * 0.62, -2.6, 'note'); }); paintE(S.G.E[0], COL.gold, true); cap('e1 從 v1 連到 v2', 'v1、v2 那兩格是 1'); },
  async (tok, S) => { S.B.add('每一列恰好兩個 1', 'good'); cap('特色：每一列只有兩個 1', '一條邊兩個端點'); },
  async (tok, S) => { S.IE.forEach(([p, q], k) => { if (!k) return; M('e' + (k + 1) + ' │ ' + S.G.V.map((v) => (v.name === p || v.name === q ? ' 1' : ' 0')).join(' '), -6.6, 1.9 - k * 0.62, -2.6, k === 1 ? 'note' : 'say'); }); paintE(S.G.E[0], COL.edge, false); paintE(S.G.E[1], COL.gold, true); cap('e2 從 v1 連到 v3', ''); },
  async (tok, S) => { S.B.add('較少用；一眼看出每條邊的兩端'); cap('incidence matrix 用得比較少', '好處：很快看出邊連哪兩個節點'); },
  async (tok, S) => { lab.clear(); S.B = board(-6.8, 5.0, 0.5, -2.6, 4); S.G = rpG(); S.A = S.G.V.map((_, i) => S.G.V.map((_, j) => (findE(S.G, i, j) ? 1 : 0))); S.B.add('相鄰矩陣的次方 A²、A³…'); cap('回到相鄰矩陣：它的次方', '以前講 relation 的複合 R²、R³'); },
  async (tok, S) => { S.B.add('布林運算（1+1=1）：有沒有長度 3 的路'); cap('用布林代數 1 + 1 = 1', 'A³ 某格是 1 ⇔ 有長度 3 的 walk'); },
  async (tok, S) => { S.A3 = matMul(matMul(S.A, S.A), S.A); S.B.add('一般加法：A³ 的數字 = 長度 3 的 walk 條數', 'good'); cap('用一般加法 1 + 1 = 2', 'A³ 的數字 = 長度 3 的 walk 有幾條'); },
  async (tok, S) => {
    const n = S.A3[0][2]; T('A³[A][C] = ' + n, 'good', 6.4, 3.2, -2.4);
    const ws = []; const ix = (c) => 'ABCDEF'.indexOf(c);
    for (const x of 'ABCDEF') for (const y of 'ABCDEF') if (S.A[0][ix(x)] && S.A[ix(x)][ix(y)] && S.A[ix(y)][2]) ws.push('A' + x + y + 'C');
    T(ws.join('、'), 'say', 3.0, 2.6, -2.4); cap('例：A 到 C 長度 3 的 walk 有 ' + n + ' 條（示意圖）', 'A⁴ 就是長度 4 的條數');
  },
], CAMW);

const ISO1 = [['a', -5.4, -1.6], ['b', -4.2, 1.6], ['c', -3.0, -1.6], ['d', -1.8, 1.6], ['e', -0.6, -1.6]];
const ISO2 = [['x', 1.8, -1.8], ['y', 1.8, 0], ['z', 1.8, 1.8], ['s', 5.0, -0.9], ['t', 5.0, 0.9]];
const ISOM = { a: 'x', b: 's', c: 'y', d: 't', e: 'z' };
scene('gr-l23-iso', '同構：找出保持邊的對應', [
  async (tok, S) => { S.B = board(-6.8, 5.2, 0.48, -3.4, 4); S.G1 = gnew(ISO1, { color: '#bcd3ee' }); ges(S.G1, 'ab bc cd de'); T('G₁', 'ptr', -3.0, 0.1, 2.6); S.B.add('回到二分圖的例子'); cap('回到剛才二分圖的例子', ''); },
  async (tok, S) => { S.G2 = gnew(ISO2, { color: '#f2c6da' }); [['x', 's'], ['s', 'y'], ['y', 't'], ['t', 'z']].forEach(([p, q]) => ge(S.G2, p, q)); T('G₂', 'ptr alt', 3.4, 0.1, 2.8); cap('兩種畫法', '其實是同一件事'); },
  async (tok, S) => { S.B.add('怎麼說服別人兩圖本質相同？'); cap('你要怎麼說服我', '這兩個圖本質上一樣？'); },
  async (tok, S) => { cap('右邊的名字叫 x、y、z、s、t', ''); },
  async (tok, S) => { S.B.add('G₁ = (V₁, E₁)，G₂ = (V₂, E₂)'); cap('G₁、G₂ 各有節點集合和邊集合', ''); },
  async (tok, S) => { T('V₁ = {a, b, c, d, e}', 'say', -3.0, 3.0, -2.4); cap('V₁ = {a, b, c, d, e}', ''); },
  async (tok, S) => { T('V₂ = {x, y, z, s, t}', 'say', 3.4, 3.0, -2.4); cap('V₂ = {x, y, z, s, t}', '邊各 4 條'); },
  async (tok, S) => { S.B.add('找一個函式對應（替身）'); cap('要找一個函式的對應', '每個點在那邊都有一個替身'); },
  async (tok, S) => { Object.entries(ISOM).forEach(([p, q], i) => { vcol(S.G1, p, PAL[i]); vcol(S.G2, q, PAL[i]); }); cap('a→x、b→s、c→y、d→t、e→z', '同色互相對應'); },
  async (tok, S) => { S.B.add('f : V₁ → V₂'); cap('函式 f 從 V₁ 到 V₂', ''); },
  async (tok, S) => { S.B.add('一對一且映成（bijection）'); cap('必須一對一而且映成', ''); },
  async (tok, S) => { S.B.add('還要保證：邊對到邊'); cap('最重要：邊連的是哪兩個節點', '要保留下來'); },
  async (tok, S) => { paintE(findE(S.G1, 'a', 'b'), COL.gold, true); paintE(findE(S.G2, 'x', 's'), COL.gold, true); cap('ab 有邊', '替身 f(a)f(b) = xs 也要有邊'); },
  async (tok, S) => { S.B.add('{u,v} ∈ E₁ ⇔ {f(u),f(v)} ∈ E₂', 'good'); cap('對所有 u、v：若且唯若', ''); },
  async (tok, S) => { T('沒邊 ⇔ 沒邊', 'say', 0.0, 2.2, -2.4); cap('這邊沒邊，那邊也要沒邊', '這邊有邊，那邊也要有邊'); },
  async (tok, S) => { T('f(a)=x f(b)=s f(c)=y f(d)=t f(e)=z', 'note', 0.0, 3.6, -2.4); cap('給出這個函式', ''); },
  async (tok, S) => { for (const [p, q] of [['b', 'c'], ['c', 'd'], ['d', 'e']]) { paintE(findE(S.G1, p, q), COL.gold, true); paintE(findE(S.G2, ISOM[p], ISOM[q]), COL.gold, true); await wt(tok, 300); } cap('一條一條檢查邊', 'bc→sy、cd→yt、de→tz ✔'); },
  async (tok, S) => { S.B.add('isomorphism（同構）', 'good'); cap('兩個圖一模一樣', '叫 isomorphism：內部結構相同'); },
], CAMW);

const IA = [['a', -5.6, 0], ['b', -4.6, -1.8], ['c', -2.4, -1.8], ['d', -1.2, 0], ['e', -2.4, 1.8], ['f', -4.6, 1.8]];
const IAE = 'ab bc cd de ef fa be bd ce';
const IB = [['a', 3.0, -0.4], ['b', 1.4, 1.4], ['c', 4.8, 1.8], ['d', 5.8, -1.0], ['e', 2.2, -2.0], ['f', 0.8, -0.6]];
scene('gr-l23-inv', '怎麼判斷不同構：節點數、邊數、degree', [
  async (tok, S) => { S.B = board(-6.8, 5.2, 0.48, -3.4, 4); S.B.add('證明「不同構」要有簡單方法'); cap('真的要找函式很麻煩', '要有一些簡單方法判斷'); },
  async (tok, S) => { S.B.add('常用技巧：看不變的性質'); cap('常用的技巧', ''); },
  async (tok, S) => { S.B.add('① 節點數不同 → 不同構'); cap('節點數不一樣', '不可能有 bijection'); },
  async (tok, S) => { S.B.add('② 邊數也要一樣'); cap('邊的個數也要一樣', ''); },
  async (tok, S) => { S.B.add('③ degree（連線數）'); cap('還有 degree', ''); },
  async (tok, S) => { cap('這邊有 degree 5 的點', '那邊找不到 → 不同構'); },
  async (tok, S) => { S.B.add('④ 特殊子圖，例如 K₅'); cap('一邊有 K₅ 子圖、另一邊沒有', '也不會一樣'); },
  async (tok, S) => { S.G1 = gnew(IA, { color: '#bcd3ee' }); ges(S.G1, IAE); S.G2 = gnew(IB, { color: '#f2c6da' }); ges(S.G2, IAE); DEMO(0, 0.3, 3.2); cap('例一：兩個圖長得不太一樣', '要證明一樣就給對應'); },
  async (tok, S) => { showDeg(S.G1); showDeg(S.G2); ['c', 'd'].forEach((n) => { vcol(S.G1, n, COL.orange); vcol(S.G2, n, COL.orange); }); cap('看 degree 3 的點', '兩邊都只有兩個，要互相對應'); },
  async (tok, S) => { ['b', 'e'].forEach((n) => { vcol(S.G1, n, COL.purple); vcol(S.G2, n, COL.purple); }); ['a', 'f'].forEach((n) => { vcol(S.G1, n, COL.green); vcol(S.G2, n, COL.green); }); cap('degree 4 的兩個、degree 2 的兩個', '也各自對應'); },
  async (tok, S) => { cap('a→a、b→b、c→c、d→d、e→e、f→f', '（名字相同的對應）'); T('同名對應', 'ptr', 0, 2.6, -2.4); },
  async (tok, S) => { await mv(tok, S.G2, S.G1.V.map((v) => v.p.clone().add(V3(6.6, 0, 0))), 700); T('翻一翻：一模一樣 ✔', 'good', 3.0, 1.6, 2.8); cap('雖然長得不一樣', '對應之後一模一樣'); },
  async (tok, S) => { lab.clear(); S.B = board(-6.8, 5.2, 0.48, -3.4, 4); S.P = gnew([['a', -5.4, -1.4], ['b', -2.4, -1.4], ['c', -1.2, 1.0], ['d', -3.9, 2.4], ['e', -5.8, 0.8]], { color: '#bcd3ee' }); ges(S.P, 'ab bc cd de ea ac bd'); S.Q = gnew([['p', 1.8, -1.4], ['q', 5.4, -1.4], ['r', 1.4, 1.6], ['s', 3.6, 2.2], ['t', 5.8, 1.6]], { color: '#f2c6da' }); ges(S.Q, 'pq pr ps pt qr qs qt'); DEMO(0, 0.3, 3.2); cap('例二：這兩個', ''); },
  async (tok, S) => { T('5 點、' + S.P.E.length + ' 邊', 'ptr', -3.6, 3.4, -2.4); T('5 點、' + S.Q.E.length + ' 邊', 'ptr alt', 3.6, 3.4, -2.4); cap('都是 5 個節點', '邊數 ' + S.P.E.length + ' 和 ' + S.Q.E.length + '：一樣'); },
  async (tok, S) => { showDeg(S.P); showDeg(S.Q); const d2 = (G) => deg(G).filter((x) => x === 2).length; [S.P, S.Q].forEach((G) => deg(G).forEach((x, i) => { if (x === 2) vcol(G, i, COL.hot); })); cap('degree 2 的點', '左邊 ' + d2(S.P) + ' 個、右邊 ' + d2(S.Q) + ' 個'); },
  async (tok, S) => { S.B.add('degree 不同 → 不同構', 'bad'); cap('degree 的分布不一樣', '這兩個不同構'); },
], CAMW);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
