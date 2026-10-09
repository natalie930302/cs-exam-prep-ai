// 演算法 第4章：動態規劃（進階）— Matrix-chain multiplication、Optimal BST、Coin change。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片（Abdul Bari 的 Matrix Chain／Optimal BST、MIT 6.006 L22／Rec22、Reliability Design）都還沒有逐字稿，
// 所以場景全部依課本（CLRS Ch15）建立，標題標「（課本）」：
//   CLRS 15.2：A1 10×100、A2 100×5、A3 5×50（7500 vs 75000）；6 個矩陣 p = 30 35 15 5 10 20 25 → m[1][6] = 15125，
//     ((A1(A2A3))((A4A5)A6))；小例子 p = 5 4 6 2 7 → m[1][4] = 158。
//   CLRS 15.5：p = .15 .10 .05 .10 .20、q = .05 .10 .05 .05 .05 .10 → 期望成本 2.75（root k2）；只算成功搜尋：key 10 20 30 40、次數 4 2 6 3 → 26。
//   Coin change：面額 1、3、4 湊 6（greedy 3 枚 vs DP 2 枚）；面額 1、2、5 湊 5 有 4 種組合。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', GRAY = '#d8cfc0';
  const BLUE = '#4b9ee2', TEAL = '#2fc092', PURPLE = '#9b7ef4', ORANGE = '#dd8238', PINK = '#e55a9b', RED = '#d64545', SAND = '#c9b48e', PAPER = '#efe6d2';
  const OKC = '#1f9e6e', TRY = '#c9a35a';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function fresh(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    fn().catch((err) => { if (!/changed/.test(err.message)) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z + 0.9); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m && m.material && m.material.emissive) m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { if (m && m.material) m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
  const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => setCls(l, k === i ? 'ptr alt' : '')); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function rod(a, b, color = SAND, r = 0.03) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len), 8), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    lab.world.add(m); return m;
  }
  function arrow(a0, b0, color = '#c08a1f', r = 0.035) {
    const A = a0.clone(), B = b0.clone(), d = B.clone().sub(A);
    let len = d.length(); d.normalize();
    const s = Math.min(0.3, len * 0.22); A.addScaledVector(d, s); B.addScaledVector(d, -s); len = A.distanceTo(B);
    const head = Math.min(0.26, len * 0.45), mat = new THREE.MeshBasicMaterial({ color });
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len - head), 8), mat); sh.position.y = (len - head) / 2;
    const co = new THREE.Mesh(new THREE.ConeGeometry(r * 3.2, head, 12), mat); co.position.y = len - head / 2;
    g.add(sh, co); g.position.copy(A); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d);
    lab.world.add(g); return g;
  }
  // a curved arrow from a to b bulging h units along y (negative = below)
  function arc(a, b, h, color = '#c08a1f', r = 0.03) {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += h;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const pts = curve.getPoints(24).slice(2, 23);
    const path = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.MeshBasicMaterial({ color });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, r, 6, false), mat));
    const end = pts[pts.length - 1], tan = curve.getTangent(0.92);
    const co = new THREE.Mesh(new THREE.ConeGeometry(r * 3.4, 0.24, 12), mat);
    co.position.copy(end).addScaledVector(tan, 0.08); co.quaternion.setFromUnitVectors(V3(0, 1, 0), tan);
    g.add(co); lab.world.add(g); return g;
  }
  function plate(x, y, w, h, color = PAPER, z = -0.05) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    t.position.set(x, y, z); t.receiveShadow = true; lab.world.add(t); return t;
  }
  // an upright DP table: cells fall into their slot; arrows show which cells a cell was computed from
  function grid(o) {
    const g = { o, cells: {}, plates: {}, arrows: [] };
    g.pos = (r, c) => V3(o.x0 + c * o.cw, o.y0 - r * o.ch, 0);
    for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) { const p = g.pos(r, c); g.plates[r + ',' + c] = plate(p.x, p.y, o.cw * 0.94, o.ch * 0.92); }
    (o.colHdr || []).forEach((t, c) => { if (t !== null && t !== '') tag(String(t), o.colCls || 'idx', g.pos(0, c).x, o.y0 + o.ch * 0.8); });
    (o.rowHdr || []).forEach((t, r) => { if (t !== null && t !== '') tag(String(t), o.rowCls || 'idx', o.x0 - o.cw * 0.6 - (o.rowDx || 0.45), g.pos(r, 0).y); });
    g.set = (r, c, v, color = BLUE, dropH = 1.4) => {
      const k = r + ',' + c; if (g.cells[k]) kill(g.cells[k]);
      const p = g.pos(r, c);
      return (g.cells[k] = cube(v, color, [o.cw * 0.8, o.ch * 0.72, 0.32], p.x, p.y, 0.2, dropH));
    };
    g.get = (r, c) => g.cells[r + ',' + c];
    g.arrow = (r1, c1, r2, c2, color) => { const a = g.pos(r1, c1), b = g.pos(r2, c2); a.z = b.z = 0.6; const h = arrow(a, b, color); g.arrows.push(h); return h; };
    g.arc = (r1, c1, r2, c2, color, below = true) => {
      const a = g.pos(r1, c1), b = g.pos(r2, c2), s = below ? -1 : 1;
      a.z = b.z = 0.6; a.y += s * o.ch * 0.3; b.y += s * o.ch * 0.3;
      const h = arc(a, b, s * (0.3 + 0.16 * Math.abs(c2 - c1)), color); g.arrows.push(h); return h;
    };
    g.clearArrows = () => { g.arrows.forEach(kill); g.arrows = []; };
    g.mark = (r, c, color) => { const p = g.plates[r + ',' + c]; if (p) p.material.color.set(color || PAPER); };
    g.unglow = () => Object.values(g.cells).forEach((m) => glow(m, null));
    return g;
  }
  // play one table step: arrows from the cells it depends on, then the value drops in
  async function playStep(g, s, tok, ms, quiet) {
    g.clearArrows(); g.unglow();
    for (const d of s.deps || []) {
      const col = d.best ? OKC : TRY;
      if (d.arc) g.arc(d.r, d.c, s.r, s.c, col, d.arc !== 'up'); else g.arrow(d.r, d.c, s.r, s.c, col);
      const m = g.get(d.r, d.c); if (m) glow(m, d.best ? GREEN : GOLD);
    }
    for (const h of s.hi || []) { const m = g.get(h[0], h[1]); if (m) glow(m, GOLD); }
    if (!quiet) say(s.cap, s.formula);
    if (tok === undefined && s.log) log(s.log);
    await wait(tok, ms * 0.55);
    g.set(s.r, s.c, s.v, s.color || BLUE);
    if (s.also) for (const a of s.also) g.set(a[0], a[1], a[2], a[3] || PURPLE);
    await wait(tok, ms * 0.45);
  }
  const fmtV = (v) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : String(v));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (n) => Math.floor(Math.random() * n);

  // ───────────────────────── Matrix-chain multiplication（CLRS 15.2） ─────────────────────────
  const MC_P = [30, 35, 15, 5, 10, 20, 25];   // CLRS 圖 15.5：A1 30×35 … A6 20×25
  const MC_P4 = [5, 4, 6, 2, 7];               // 小例子：A1 5×4、A2 4×6、A3 6×2、A4 2×7
  function mcmSolve(p) {
    const n = p.length - 1, m = [], s = [], steps = [];
    for (let i = 0; i <= n + 1; i++) { m[i] = new Array(n + 2).fill(0); s[i] = new Array(n + 2).fill(0); }
    for (let l = 2; l <= n; l++) for (let i = 1; i <= n - l + 1; i++) {
      const j = i + l - 1; let best = Infinity, bk = 0; const c = [];
      for (let k = i; k < j; k++) {
        const v = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j];
        c.push({ k, v, a: m[i][k], b: m[k + 1][j], x: p[i - 1] * p[k] * p[j] });
        if (v < best) { best = v; bk = k; }
      }
      m[i][j] = best; s[i][j] = bk;
      const deps = [];
      for (const x of c) { deps.push({ r: i - 1, c: x.k - 1, best: x.k === bk }); deps.push({ r: x.k, c: j - 1, best: x.k === bk }); }
      steps.push({ r: i - 1, c: j - 1, i, j, l, v: best, cands: c, bk, color: TEAL, deps,
        cap: 'm[' + i + '][' + j + ']：A' + i + '…A' + j + ' 試 k = ' + i + '…' + (j - 1),
        formula: 'min(' + c.map((x) => x.v).join(', ') + ') = ' + best + '（k = ' + bk + '）',
        log: 'm[' + i + '][' + j + '] = ' + best + '，s = ' + bk + '（' + c.map((x) => 'k=' + x.k + ':' + x.v).join('，') + '）' });
    }
    return { n, m, s, steps };
  }
  const parens = (s, i, j) => (i === j ? 'A' + i : '(' + parens(s, i, s[i][j]) + parens(s, s[i][j] + 1, j) + ')');
  function mcmGrid(p, x0, y0, cw, ch) {
    const n = p.length - 1;
    const g = grid({ rows: n, cols: n, cw, ch, x0, y0, colHdr: Array.from({ length: n }, (_, k) => 'j=' + (k + 1)), rowHdr: Array.from({ length: n }, (_, k) => 'i=' + (k + 1)), rowDx: 0.35 });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (j < i) g.mark(i, j, '#ddd2bf'); }
    for (let i = 0; i < n; i++) g.set(i, i, 0, GRAY, 0);
    return g;
  }
  function dimsRow(p, y, unit) {
    const n = p.length - 1, out = [];
    const w = Math.min(1.35, 11 / n);
    for (let k = 1; k <= n; k++) {
      const x = (k - (n + 1) / 2) * w;
      out.push(cube('A' + k, k % 2 ? BLUE : PURPLE, [w * 0.82, 0.5, 0.4], x, y, 0));
      tag(p[k - 1] + '×' + p[k], 'idx', x, y - 0.5);
    }
    return out;
  }
  async function scMcCost(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    say('A 是 p×q、B 是 q×r：C = AB 是 p×r', 'C 的每一格要做 q 次乘法');
    const p = 2, q = 4, r = 3, s = 0.5;
    const A = [], B = [];
    for (let i = 0; i < p; i++) for (let k = 0; k < q; k++) A.push(cube('', BLUE, [0.42, 0.12, 0.42], -5 + k * s, 0.06, -0.5 + i * s));
    for (let k = 0; k < q; k++) for (let j = 0; j < r; j++) B.push(cube('', PURPLE, [0.42, 0.12, 0.42], -1.4 + j * s, 0.06, -1 + k * s));
    tag('A：2×4', 'ptr', -4.2, 0.2, 1.2); tag('B：4×3', 'ptr', -0.9, 0.2, 1.5);
    await wait(tok, 2400);
    tag('C：2×3', 'ptr alt', 3.2, 0.2, 1.2);
    let cnt = 0; const cl = tag('乘法 0 次', 'ptr alt', 3.2, 3.6);
    for (let i = 0; i < p; i++) for (let j = 0; j < r; j++) {
      for (let k = 0; k < q; k++) {
        cube('', TEAL, [0.42, 0.18, 0.42], 2.6 + j * s, 0.1 + k * 0.2, -0.5 + i * s, 1.2);
        cnt++; txt(cl, '乘法 ' + cnt + ' 次');
        A.forEach((m, z) => glow(m, Math.floor(z / q) === i && z % q === k ? GOLD : null));
        B.forEach((m, z) => glow(m, Math.floor(z / r) === k && z % r === j ? GOLD : null));
        await wait(tok, 160);
      }
      say('C[' + (i + 1) + '][' + (j + 1) + '] = 第 ' + (i + 1) + ' 列 · 第 ' + (j + 1) + ' 行', 'q = 4 次乘法疊成一柱');
    }
    A.concat(B).forEach((m) => glow(m, null));
    say('共 2·4·3 = 24 次純量乘法', '矩陣乘法的成本 = p·q·r');
    await wait(tok, 3000);
    fresh([0, 4.6, 14], [0, 3.4, 0]);
    say('A1 10×100、A2 100×5、A3 5×50', '乘法有結合律：括號怎麼加結果都一樣');
    tag('((A1A2)A3)', 'ptr', -3, 0.3, 1.2); tag('(A1(A2A3))', 'ptr', 3, 0.3, 1.2);
    await wait(tok, 2600);
    const H = (v) => v / 75000 * 6;
    const b1 = cube('', TEAL, [1.6, 1, 1.2], -3, 0, 0); b1.scale.y = 0.001;
    const b2 = cube('', RED, [1.6, 1, 1.2], 3, 0, 0); b2.scale.y = 0.001;
    const grow = async (m, from, to, x) => anim(tok, 700, (t) => { const h = H(from + (to - from) * t); m.scale.y = Math.max(0.001, h); m.position.y = h / 2; });
    say('先算 A1A2：10·100·5 = 5000', '得到 10×5，再乘 A3：10·5·50 = 2500');
    await grow(b1, 0, 5000, -3); await wait(tok, 600); await grow(b1, 5000, 7500, -3);
    tag('7,500', 'ptr alt', -3, H(7500) + 0.5);
    await wait(tok, 1800);
    say('先算 A2A3：100·5·50 = 25000', '得到 100×50，再乘：10·100·50 = 50000');
    await grow(b2, 0, 25000, 3); await wait(tok, 600); await grow(b2, 25000, 75000, 3);
    tag('75,000', 'ptr alt', 3, H(75000) + 0.5);
    await wait(tok, 2000);
    say('同樣的結果，成本差 10 倍', '問題：怎麼加括號，乘法次數最少？');
    await wait(tok, 3400);
  }
  const catalan = (n) => { const P = [0, 1]; for (let k = 2; k <= n; k++) { P[k] = 0; for (let x = 1; x < k; x++) P[k] += P[x] * P[k - x]; } return P[n]; };
  async function scMcCount(tok) {
    fresh([0, 4.4, 14], [0, 3.4, 0]);
    say('暴力法：把所有括號方式都試一遍？', 'P(n) = Σ P(k)·P(n−k)，k = 1…n−1');
    const ALL4 = ['((A1A2)A3)A4', '(A1(A2A3))A4', '(A1A2)(A3A4)', 'A1((A2A3)A4)', 'A1(A2(A3A4))'];
    tag('n = 4 的 5 種括法', 'ptr', 0, 7.2);
    for (let k = 0; k < 5; k++) { const l = tag(ALL4[k], 'ptr alt', -4.6 + (k % 3) * 4.6, 6.4 - Math.floor(k / 3) * 0.7); Object.assign(l.element.style, MONO); await wait(tok, 700); }
    await wait(tok, 1200);
    for (let n = 1; n <= 10; n++) {
      const v = catalan(n), h = 0.3 + Math.log10(v) * 1.1, x = -5.4 + (n - 1) * 1.2;
      const m = cube('', n <= 4 ? BLUE : ORANGE, [0.9, 1, 0.9], x, 0, 0); m.scale.y = h; m.position.y = h / 2;
      tag('n=' + n, 'idx', x, 0, 0.9); tag(String(v), 'idx', x, h + 0.35);
      say('n = ' + n + '：' + v + ' 種', '高度用對數尺度');
      await wait(tok, 520);
    }
    say('Catalan 數：Ω(4ⁿ / n^{3/2})，指數成長', '暴力法不可行 → 用 DP');
    await wait(tok, 3200);
  }
  async function playMcmStepDetail(g, st, p, tok, ms) {
    g.clearArrows(); g.unglow();
    for (const x of st.cands) {
      g.clearArrows(); g.unglow();
      g.arrow(st.i - 1, x.k - 1, st.r, st.c, x.k === st.bk ? OKC : TRY);
      g.arrow(x.k, st.j - 1, st.r, st.c, x.k === st.bk ? OKC : TRY);
      glow(g.get(st.i - 1, x.k - 1), GOLD); glow(g.get(x.k, st.j - 1), GOLD);
      say('k = ' + x.k + '：(A' + st.i + '…A' + x.k + ')(A' + (x.k + 1) + '…A' + st.j + ')', 'm[' + st.i + '][' + x.k + '] + m[' + (x.k + 1) + '][' + st.j + '] + p' + (st.i - 1) + 'p' + x.k + 'p' + st.j + ' = ' + x.a + ' + ' + x.b + ' + ' + x.x + ' = ' + x.v);
      await wait(tok, ms);
    }
    g.clearArrows(); g.unglow();
    g.arrow(st.i - 1, st.bk - 1, st.r, st.c, OKC); g.arrow(st.bk, st.j - 1, st.r, st.c, OKC);
    g.set(st.r, st.c, st.v, TEAL);
    say('m[' + st.i + '][' + st.j + '] = ' + st.v + '，s = ' + st.bk, '取最小的 k');
    await wait(tok, ms);
  }
  async function scMcLoops(tok) {
    fresh([0, 4.4, 14], [0, 3.6, 0]);
    const cd = code(['for l = 2 to n            // 鏈長', '  for i = 1 to n − l + 1', '    j = i + l − 1;  m[i][j] = ∞', '    for k = i to j − 1', '      q = m[i][k] + m[k+1][j] + p[i−1]·p[k]·p[j]', '      if q < m[i][j]: m[i][j] = q; s[i][j] = k'], 0, 7.6, 0.45);
    dimsRow(MC_P4, 4.6);
    const g = mcmGrid(MC_P4, -2.2, 3.2, 1.45, 0.78);
    say('A1 5×4、A2 4×6、A3 6×2、A4 2×7', 'm[i][j] = Aᵢ…Aⱼ 最少的乘法次數');
    await wait(tok, 2600);
    cd.hl(2); say('對角線 m[i][i] = 0', '單一矩陣不用乘');
    await wait(tok, 1800);
    const S = mcmSolve(MC_P4);
    let lastL = 0;
    for (const st of S.steps) {
      if (st.l !== lastL) { lastL = st.l; cd.hl(0); say('鏈長 l = ' + st.l + '：一條對角線', '短的鏈先算，長的鏈才用得到'); await wait(tok, 1400); }
      cd.hl(4);
      await playMcmStepDetail(g, st, MC_P4, tok, st.l === 2 ? 1300 : 1500);
    }
    g.clearArrows(); g.unglow(); cd.hl(-1);
    say('m[1][4] = ' + S.m[1][4] + '：' + parens(S.s, 1, 4), '三層迴圈：Θ(n³) 時間、Θ(n²) 空間');
    await wait(tok, 3400);
  }
  async function scMcTable(tok) {
    fresh([0, 4.4, 15], [0, 3.6, 0]);
    dimsRow(MC_P, 7.3);
    const g = mcmGrid(MC_P, -3.3, 5.6, 1.32, 0.82);
    say('CLRS 例子：6 個矩陣', 'p = 30, 35, 15, 5, 10, 20, 25');
    await wait(tok, 2800);
    say('m[i][j]：試每個切點 k', 'min_k { m[i][k] + m[k+1][j] + pᵢ₋₁pₖpⱼ }；來源：同列左邊、同行下面');
    await wait(tok, 3000);
    const S = mcmSolve(MC_P);
    for (const st of S.steps) {
      if (st.i === 1 && st.j === 3) await playMcmStepDetail(g, st, MC_P, tok, 1500);
      else await playStep(g, st, tok, st.l === 2 ? 900 : 1300, st.l === 2);
    }
    g.clearArrows(); g.unglow();
    g.mark(0, 5, '#9fe0c4');
    say('m[1][6] = 15,125 次純量乘法', '右上角就是答案');
    await wait(tok, 3200);
  }
  async function scMcSplit(tok) {
    fresh([0, 4.4, 15], [0, 3.6, 0]);
    const S = mcmSolve(MC_P), n = 6;
    const g = grid({ rows: n, cols: n, cw: 0.62, ch: 0.5, x0: -6.2 + 0.7, y0: 6.6, colHdr: [1, 2, 3, 4, 5, 6], rowHdr: [1, 2, 3, 4, 5, 6], rowDx: 0.1 });
    tag('s[i][j]', 'ptr', -4.0, 7.4);
    for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) { if (j > i) g.set(i - 1, j - 1, S.s[i][j], PURPLE, 0); else g.mark(i - 1, j - 1, '#ddd2bf'); }
    say('s[i][j] 記下最好的切點 k', '從 s[1][6] 一路往下拆');
    await wait(tok, 2600);
    // build split tree on the right
    const lx = (k) => 0.4 + (k - 1) * 1.1;
    async function build(i, j, d, px, py) {
      const x = (lx(i) + lx(j)) / 2, y = 6.6 - d * 1.35;
      if (py !== undefined) rod(V3(px, py - 0.25, -0.05), V3(x, y + 0.25, -0.05), SAND, 0.025);
      if (i === j) { cube('A' + i, BLUE, [0.85, 0.5, 0.4], x, y, 0, 1.2); await wait(tok, 500); return; }
      const k = S.s[i][j];
      g.mark(i - 1, j - 1, '#f3d27a'); glow(g.get(i - 1, j - 1), GOLD);
      cube(i + '..' + j, TEAL, [0.95, 0.5, 0.4], x, y, 0, 1.2);
      say('s[' + i + '][' + j + '] = ' + k, '切成 (A' + i + '…A' + k + ')(A' + (k + 1) + '…A' + j + ')');
      await wait(tok, 1500);
      glow(g.get(i - 1, j - 1), null);
      await build(i, k, d + 1, x, y); await build(k + 1, j, d + 1, x, y);
    }
    await build(1, n, 0);
    say(parens(S.s, 1, n), 'PRINT-OPTIMAL-PARENS 遞迴印出');
    await wait(tok, 3600);
  }

  // ───────────────────────── Optimal BST（CLRS 15.5） ─────────────────────────
  const OB_P = [0, 0.15, 0.10, 0.05, 0.10, 0.20];
  const OB_Q = [0.05, 0.10, 0.05, 0.05, 0.05, 0.10];
  const fmt2 = (v, int) => (int ? String(Math.round(v)) : (Math.round(v * 100) / 100).toFixed(2));
  function obstSolve(p, q) {
    const n = p.length - 1, e = [], w = [], root = [], steps = [];
    const int = p.every((x) => Number.isInteger(x)) && q.every((x) => Number.isInteger(x));
    for (let i = 1; i <= n + 1; i++) { e[i] = []; w[i] = []; root[i] = []; e[i][i - 1] = q[i - 1]; w[i][i - 1] = q[i - 1]; }
    for (let l = 1; l <= n; l++) for (let i = 1; i <= n - l + 1; i++) {
      const j = i + l - 1;
      w[i][j] = w[i][j - 1] + p[j] + q[j];
      let best = Infinity, br = 0; const c = [];
      for (let r = i; r <= j; r++) { const t = e[i][r - 1] + e[r + 1][j] + w[i][j]; c.push({ r, t }); if (t < best - 1e-9) { best = t; br = r; } }
      e[i][j] = best; root[i][j] = br;
      const deps = [];
      for (const x of c) { deps.push({ r: i - 1, c: x.r - 1, best: x.r === br }); deps.push({ r: x.r, c: j, best: x.r === br }); }
      steps.push({ r: i - 1, c: j, v: fmt2(best, int), color: TEAL, deps, i, j, br, l,
        cap: 'e[' + i + '][' + j + ']：k' + i + '…k' + j + ' 輪流當 root',
        formula: 'w = ' + fmt2(w[i][j], int) + '；min(' + c.map((x) => fmt2(x.t, int)).join(', ') + ') = ' + fmt2(best, int) + '，root = k' + br,
        log: 'e[' + i + '][' + j + '] = ' + fmt2(best, int) + '，w = ' + fmt2(w[i][j], int) + '，root = ' + br });
    }
    return { n, e, w, root, steps, int };
  }
  function obstGrid(p, q, x0, y0, cw, ch) {
    const n = p.length - 1, S0 = obstSolve(p, q);
    const g = grid({ rows: n + 1, cols: n + 1, cw, ch, x0, y0, colHdr: Array.from({ length: n + 1 }, (_, k) => 'j=' + k), rowHdr: Array.from({ length: n + 1 }, (_, k) => 'i=' + (k + 1)), rowDx: 0.35 });
    for (let i = 1; i <= n + 1; i++) for (let j = 0; j <= n; j++) if (j < i - 1) g.mark(i - 1, j, '#ddd2bf');
    for (let i = 1; i <= n + 1; i++) g.set(i - 1, i - 1, fmt2(q[i - 1], S0.int), GRAY, 0);
    return g;
  }
  // tree spec → laid-out nodes (keys k_i and dummy leaves d_i), in-order x
  function obstTree(spec, n, x0, dx, yTop, dy) {
    const nodes = [];
    (function walk(t, d, lo, hi) {
      if (!t) return;
      nodes.push({ key: t.k, d, x: x0 + (2 * t.k - 1) * dx, y: yTop - d * dy, parent: t.parent });
      const me = nodes[nodes.length - 1];
      if (t.L) { t.L.parent = me; walk(t.L, d + 1); } else nodes.push({ dummy: t.k - 1, d: d + 1, x: x0 + (2 * (t.k - 1)) * dx, y: yTop - (d + 1) * dy, parent: me });
      if (t.R) { t.R.parent = me; walk(t.R, d + 1); } else nodes.push({ dummy: t.k, d: d + 1, x: x0 + (2 * t.k) * dx, y: yTop - (d + 1) * dy, parent: me });
    })(spec, 0);
    return nodes;
  }
  function specFromRoot(root, i, j) { if (i > j) return null; const r = root[i][j]; return { k: r, L: specFromRoot(root, i, r - 1), R: specFromRoot(root, r + 1, j) }; }
  async function drawObst(tok, nodes, p, q, ms, sumL, labels) {
    let sum = 0;
    const keyName = labels || ((k) => 'k' + k);
    for (const nd of nodes.slice().sort((a, b) => a.d - b.d)) {
      if (nd.parent) rod(V3(nd.parent.x, nd.parent.y - 0.22, -0.05), V3(nd.x, nd.y + 0.22, -0.05), SAND, 0.02);
      const pr = nd.dummy !== undefined ? q[nd.dummy] : p[nd.key];
      if (nd.dummy !== undefined && !pr && !q.some((x) => x)) continue;
      nd.m = nd.dummy !== undefined ? cube('d' + nd.dummy, GRAY, [0.62, 0.4, 0.36], nd.x, nd.y, 0, ms ? 1 : 0) : cube(keyName(nd.key), BLUE, [0.72, 0.48, 0.42], nd.x, nd.y, 0, ms ? 1 : 0);
      if (ms) {
        sum += (nd.d + 1) * pr;
        tag((nd.d + 1) + '×' + pr, 'idx', nd.x, nd.y - 0.45);
        if (sumL) txt(sumL, '期望成本 = ' + (Number.isInteger(sum) ? sum : sum.toFixed(2)));
        await wait(tok, ms);
      }
    }
    return sum;
  }
  const SPEC_A = () => ({ k: 2, L: { k: 1 }, R: { k: 4, L: { k: 3 }, R: { k: 5 } } });
  const SPEC_B = () => ({ k: 2, L: { k: 1 }, R: { k: 5, L: { k: 4, L: { k: 3 } } } });
  async function scObstCost(tok) {
    fresh([0, 4.4, 15], [0, 3.8, 0]);
    say('5 個 key kᵢ、6 個 dummy dᵢ', '搜尋機率 p = .15 .10 .05 .10 .20；落空 q = .05 .10 .05 .05 .05 .10');
    await wait(tok, 3000);
    say('搜尋成本 = depth + 1', 'E[cost] = Σ (depth(kᵢ)+1)·pᵢ + Σ (depth(dᵢ)+1)·qᵢ');
    await wait(tok, 3000);
    const lA = tag('期望成本 = 0', 'ptr alt', -3.6, 0.7), lB = tag('期望成本 = 0', 'ptr alt', 3.6, 0.7);
    tag('樹 (a)', 'ptr', -3.6, 7.6); tag('樹 (b)', 'ptr', 3.6, 7.6);
    const a = await drawObst(tok, obstTree(SPEC_A(), 5, -6.1, 0.45, 6.8, 1.25), OB_P, OB_Q, 420, lA);
    say('樹 (a)：期望成本 ' + a.toFixed(2), '看起來很平衡');
    await wait(tok, 2000);
    const b = await drawObst(tok, obstTree(SPEC_B(), 5, 1.1, 0.45, 6.8, 1.25), OB_P, OB_Q, 420, lB);
    say('樹 (b)：' + b.toFixed(2) + ' 比較小，而且是最佳', '高度最小 ≠ 期望成本最小；root 也不一定是機率最大的 key');
    await wait(tok, 3600);
  }
  async function scObstTable(tok) {
    fresh([0, 4.4, 15], [0, 3.8, 0]);
    const g = obstGrid(OB_P, OB_Q, -3.2, 6.6, 1.3, 0.86);
    say('e[i][j]：kᵢ…kⱼ 的最佳期望成本', '空樹 e[i][i−1] = qᵢ₋₁（對角線）');
    await wait(tok, 3000);
    say('選 k_r 當 root：左右子樹各深一層', 'e[i][j] = min_r ( e[i][r−1] + e[r+1][j] ) + w(i, j)');
    await wait(tok, 3200);
    const S = obstSolve(OB_P, OB_Q);
    for (const st of S.steps) await playStep(g, st, tok, st.l === 1 ? 1300 : st.l === 2 ? 1500 : 1300, false);
    g.clearArrows(); g.unglow(); g.mark(0, 5, '#9fe0c4');
    say('e[1][5] = 2.75，root[1][5] = k2', 'w(i,j) = Σpₗ + Σqₗ；三層迴圈 Θ(n³)');
    await wait(tok, 3400);
  }
  async function scObstBuild(tok) {
    fresh([0, 4.4, 15], [0, 3.8, 0]);
    const S = obstSolve(OB_P, OB_Q), n = 5;
    const g = grid({ rows: n, cols: n, cw: 0.62, ch: 0.5, x0: -5.5, y0: 6.6, colHdr: [1, 2, 3, 4, 5], rowHdr: [1, 2, 3, 4, 5], rowDx: 0.1 });
    tag('root[i][j]', 'ptr', -4.2, 7.4);
    for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) { if (j >= i) g.set(i - 1, j - 1, S.root[i][j], PURPLE, 0); else g.mark(i - 1, j - 1, '#ddd2bf'); }
    say('用 root 表遞迴建樹', 'root[1][5] = 2 → 左 k1、右 k3…k5');
    await wait(tok, 2600);
    const spec = specFromRoot(S.root, 1, n);
    const nodes = obstTree(spec, n, 0.6, 0.5, 6.8, 1.15);
    const order = [];
    (function walk(i, j) { if (i > j) return; order.push([i, j, S.root[i][j]]); walk(i, S.root[i][j] - 1); walk(S.root[i][j] + 1, j); })(1, n);
    for (const [i, j, r] of order) {
      g.mark(i - 1, j - 1, '#f3d27a'); glow(g.get(i - 1, j - 1), GOLD);
      const nd = nodes.find((x) => x.key === r);
      if (nd.parent) rod(V3(nd.parent.x, nd.parent.y - 0.22, -0.05), V3(nd.x, nd.y + 0.22, -0.05), SAND, 0.022);
      cube('k' + r, BLUE, [0.72, 0.48, 0.42], nd.x, nd.y, 0, 1.2);
      say('root[' + i + '][' + j + '] = ' + r + ' → k' + r, i === j ? '只剩一個 key' : 'k' + r + ' 當 k' + i + '…k' + j + ' 的 root，再遞迴處理左右');
      await wait(tok, 1700);
      glow(g.get(i - 1, j - 1), null);
    }
    for (const nd of nodes) if (nd.dummy !== undefined) { rod(V3(nd.parent.x, nd.parent.y - 0.22, -0.05), V3(nd.x, nd.y + 0.2, -0.05), GRAY, 0.015); cube('d' + nd.dummy, GRAY, [0.55, 0.36, 0.3], nd.x, nd.y, 0, 1); }
    say('最佳樹：期望成本 2.75', '就是前面比較時的樹 (b)');
    await wait(tok, 3400);
  }
  async function scObstSucc(tok) {
    fresh([0, 4.4, 15], [0, 3.8, 0]);
    const keys = [10, 20, 30, 40], f = [0, 4, 2, 6, 3], q0 = [0, 0, 0, 0, 0];
    say('只考慮成功搜尋：key 10 20 30 40', '搜尋次數 4 2 6 3（qᵢ 全為 0）');
    const g = obstGrid(f, q0, -5.4, 6.4, 0.95, 0.72);
    await wait(tok, 2800);
    const S = obstSolve(f, q0);
    for (const st of S.steps) await playStep(g, st, tok, 1150, st.l === 1);
    g.clearArrows(); g.unglow();
    say('cost(1,4) = ' + S.e[1][4] + '，root = ' + keys[S.root[1][4] - 1], '公式一樣，只是 q 都是 0');
    await wait(tok, 2400);
    const spec = specFromRoot(S.root, 1, 4);
    const nodes = obstTree(spec, 4, 0.3, 0.6, 6.4, 1.3).filter((x) => x.dummy === undefined);
    const sumL = tag('總成本 = 0', 'ptr alt', 3.2, 1.0);
    let sum = 0;
    for (const nd of nodes.sort((a, b) => a.d - b.d)) {
      if (nd.parent) rod(V3(nd.parent.x, nd.parent.y - 0.22, -0.05), V3(nd.x, nd.y + 0.22, -0.05), SAND, 0.022);
      cube(keys[nd.key - 1], BLUE, [0.8, 0.5, 0.42], nd.x, nd.y, 0, 1.2);
      sum += (nd.d + 1) * f[nd.key]; tag('層 ' + (nd.d + 1) + ' × ' + f[nd.key], 'idx', nd.x, nd.y - 0.5);
      txt(sumL, '總成本 = ' + sum);
      await wait(tok, 1000);
    }
    say('30 搜尋最多次，放在 root', '6×1 + 4×2 + 3×2 + 2×3 = 26');
    await wait(tok, 3400);
  }

  // ───────────────────────── Coin change ─────────────────────────
  function coinMin(coins, A) {
    const dp = [0], from = [null], steps = [];
    for (let a = 1; a <= A; a++) {
      dp[a] = Infinity; from[a] = null;
      for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) { dp[a] = dp[a - c] + 1; from[a] = c; }
      const deps = coins.filter((c) => c <= a).map((c) => ({ r: 0, c: a - c, arc: true, best: c === from[a] }));
      steps.push({ r: 0, c: a, v: fmtV(dp[a]), color: dp[a] === Infinity ? GRAY : TEAL, deps,
        cap: '湊 ' + a + '：最後一枚試 ' + coins.filter((c) => c <= a).join('、'),
        formula: deps.length ? 'dp[' + a + '] = 1 + min(' + coins.filter((c) => c <= a).map((c) => 'dp[' + (a - c) + ']').join(', ') + ') = ' + fmtV(dp[a]) : '沒有硬幣 ≤ ' + a + '：∞',
        log: 'dp[' + a + '] = ' + fmtV(dp[a]) + (from[a] ? '（最後一枚 ' + from[a] + '）' : '') });
    }
    return { dp, from, steps };
  }
  function coinGreedy(coins, A) { const cs = [...coins].sort((a, b) => b - a), used = []; let r = A; for (const c of cs) while (r >= c) { r -= c; used.push(c); } return { used, ok: r === 0 }; }
  function coinWays(coins, A) {
    const n = coins.length, W = [new Array(A + 1).fill(0)], steps = [];
    W[0][0] = 1;
    for (let i = 1; i <= n; i++) {
      W[i] = [1];
      const c = coins[i - 1];
      for (let a = 1; a <= A; a++) {
        W[i][a] = W[i - 1][a] + (a >= c ? W[i][a - c] : 0);
        const deps = [{ r: i - 1, c: a, best: true }]; if (a >= c) deps.push({ r: i, c: a - c, best: true });
        steps.push({ r: i, c: a, v: W[i][a], color: TEAL, deps,
          cap: a >= c ? '不用 ' + c + ' 元 + 至少用一枚 ' + c + ' 元' : c + ' 元太大：只能不用它',
          formula: 'W[' + i + '][' + a + '] = ' + W[i - 1][a] + (a >= c ? ' + ' + W[i][a - c] : '') + ' = ' + W[i][a],
          log: 'W[' + i + '][' + a + '] = ' + W[i][a] });
      }
    }
    return { W, steps };
  }
  function coinRow(A, y0) {
    const cw = Math.min(1.2, 11.6 / (A + 1));
    return grid({ rows: 1, cols: A + 1, cw, ch: 0.9, x0: -cw * A / 2, y0, colHdr: Array.from({ length: A + 1 }, (_, k) => k) });
  }
  async function showCoins(tok, list, x0, y, color) {
    const ms = [];
    for (let k = 0; k < list.length; k++) { ms.push(cube(list[k], color, [0.7, 0.18, 0.7], x0 + k * 0.85, y, 0.8, 1.6)); await wait(tok, 380); }
    return ms;
  }
  async function scCoinGreedy(tok) {
    fresh([0, 5, 13], [0, 2.4, 0]);
    say('找零：硬幣 1、3、4，湊出 6 元', '用最少枚數');
    await wait(tok, 2200);
    say('Greedy：每次拿面額最大、還放得下的', '4 → 剩 2 → 1 → 1');
    tag('Greedy', 'ptr', -3.2, 3.4);
    await showCoins(tok, [4, 1, 1], -4.1, 1.5, ORANGE);
    tag('3 枚', 'ptr alt', -3.2, 0.4, 0.8);
    await wait(tok, 1800);
    say('其實 3 + 3 只要 2 枚', 'greedy 在這組面額不是最佳');
    tag('最佳', 'ptr', 3.2, 3.4);
    await showCoins(tok, [3, 3], 2.8, 1.5, TEAL);
    tag('2 枚', 'ptr alt', 3.2, 0.4, 0.8);
    await wait(tok, 2800);
    say('1、5、10、50 這種面額 greedy 剛好正確', '一般面額要用 DP 才保證最佳');
    await wait(tok, 3200);
  }
  async function scCoinMin(tok) {
    fresh([0, 4.4, 14], [0, 3.4, 0]);
    const coins = [1, 3, 4], A = 6;
    say('dp[a] = 湊出 a 元最少要幾枚', '猜最後一枚是哪個面額 c');
    const g = coinRow(A, 4.2);
    tag('硬幣 1、3、4', 'ptr', 0, 6.4);
    g.set(0, 0, 0, TEAL);
    await wait(tok, 2600);
    const S = coinMin(coins, A);
    for (const st of S.steps) await playStep(g, st, tok, 1900);
    g.clearArrows(); g.unglow();
    const used = []; let a = A; while (a > 0) { used.push(S.from[a]); g.mark(0, a, '#f3d27a'); a -= S.from[a]; }
    say('dp[6] = 2：往回追最後一枚 → ' + used.join(' + '), '時間 Θ(A·k)，k = 面額種類數');
    await showCoins(tok, used, -0.45, 1.4, TEAL);
    await wait(tok, 3000);
  }
  async function scCoinWays(tok) {
    fresh([0, 4.4, 14], [0, 3.6, 0]);
    const coins = [1, 2, 5], A = 5;
    const cw = 1.3;
    const g = grid({ rows: 4, cols: A + 1, cw, ch: 0.9, x0: -cw * A / 2 + 0.6, y0: 5.8, colHdr: Array.from({ length: A + 1 }, (_, k) => 'a=' + k), rowHdr: ['不用硬幣', '{1}', '{1,2}', '{1,2,5}'], rowDx: 0.8 });
    say('另一種問法：湊出 5 元有幾種組合？', '硬幣 1、2、5，每種可重複用');
    g.set(0, 0, 1, TEAL, 0); for (let a = 1; a <= A; a++) g.set(0, a, 0, GRAY, 0);
    await wait(tok, 2600);
    say('W[i][a]：前 i 種硬幣湊 a 的方法數', '= 不用第 i 種 + 至少用一枚第 i 種');
    await wait(tok, 2800);
    const S = coinWays(coins, A);
    for (const st of S.steps) await playStep(g, st, tok, st.r === 3 ? 1500 : 800, st.r < 3 && st.c > 2);
    g.clearArrows(); g.unglow(); g.mark(3, A, '#9fe0c4');
    say('W[3][5] = 4：5、2+2+1、2+1+1+1、1×5', '依硬幣種類一列一列算 → 組合不會重複計數');
    await wait(tok, 3600);
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  const tm = { g: null, steps: [], k: 0, after: null, info: null };
  function tableControls(extra, onBuild, afterName = '回溯答案') {
    controls(extra + '<button class="primary" id="tStep">填下一格</button><button id="tAuto">自動填完</button><button id="tAfter">' + afterName + '</button><button id="tReset">重來</button>');
    on('tStep', () => runOp(async () => { if (tm.k >= tm.steps.length) { log('表已經填完了，按「' + afterName + '」。', true); return; } await playStep(tm.g, tm.steps[tm.k++], undefined, 800); tm.info(); }));
    on('tAuto', () => runOp(async () => { while (tm.k < tm.steps.length) await playStep(tm.g, tm.steps[tm.k++], undefined, 260, true); tm.g.clearArrows(); tm.g.unglow(); tm.info(); }));
    on('tAfter', () => runOp(async () => { if (tm.k < tm.steps.length) { log('還有 ' + (tm.steps.length - tm.k) + ' 格沒填：整張表填完才知道答案。', true); return; } tm.g.clearArrows(); tm.g.unglow(); await tm.after(); }));
    on('tReset', () => { clearLog(); onBuild(); });
  }
  const mcM = { p: MC_P4.slice() };
  function enterMcm() {
    fresh([0, 4.4, 15], [0, 3.6, 0]);
    const build = () => {
      lab.clear();
      const n = mcM.p.length - 1;
      dimsRow(mcM.p, 7.3);
      const cw = Math.min(1.45, 8.4 / n);
      tm.g = mcmGrid(mcM.p, -cw * (n - 1) / 2, 5.6, cw, Math.min(0.85, 4.8 / n));
      const S = mcmSolve(mcM.p); tm.steps = S.steps; tm.k = 0;
      tm.after = async () => {
        const str = n === 1 ? 'A1' : parens(S.s, 1, n);
        tag(str, 'ptr alt', 0, 0.5, 0.6);
        log('最佳括法 ' + str + '，m[1][' + n + '] = ' + S.m[1][n] + ' 次乘法');
      };
      tm.info = () => setState('Matrix chain（n = ' + n + '）', [['維度 p', mcM.p.join(', ')], ['已填', tm.k + ' / ' + tm.steps.length], ['m[1][n]', tm.k >= tm.steps.length ? String(S.m[1][n]) : '?']],
        'm[i][j] = min_k (m[i][k] + m[k+1][j] + pᵢ₋₁pₖpⱼ)<br>依鏈長由短到長填；Θ(n³) 時間、Θ(n²) 空間');
      tm.info();
    };
    tableControls('<label>維度 p <input id="mP" value="' + mcM.p.join(' ') + '" style="width:150px"></label><button id="mSet">套用</button><button id="mAll">列出所有括法</button>', build, '最佳括法');
    on('mSet', () => {
      const p = $('mP').value.trim().split(/[\s,]+/).map(Number);
      if (p.length < 3 || p.length > 7 || p.some((x) => !Number.isInteger(x) || x < 1 || x > 99)) { log('p 請填 3～7 個 1～99 的整數（n 個矩陣要 n+1 個維度，最多 6 個矩陣）。', true); return; }
      mcM.p = p; clearLog(); build();
    });
    on('mAll', () => {
      const n = mcM.p.length - 1;
      if (n > 5) { log('6 個矩陣有 42 種括法，太多了：先把維度改成 5 個矩陣以內再列。', true); return; }
      const all = (i, j) => { if (i === j) return [{ s: 'A' + i, c: 0, r: mcM.p[i - 1], q: mcM.p[i] }]; const out = []; for (let k = i; k < j; k++) for (const a of all(i, k)) for (const b of all(k + 1, j)) out.push({ s: '(' + a.s + b.s + ')', c: a.c + b.c + a.r * a.q * b.q, r: a.r, q: b.q }); return out; };
      const L = all(1, n).sort((a, b) => a.c - b.c);
      log('共 ' + L.length + ' 種括法（Catalan 數）：');
      L.forEach((x, k) => log((k === 0 ? '★ ' : '') + x.s + ' = ' + x.c));
    });
    log('一格一格填 m[i][j]：每格試所有切點 k。');
    build();
  }
  const obM = { p: OB_P.slice(), q: OB_Q.slice() };
  function enterObst() {
    fresh([0, 4.4, 15], [0, 3.8, 0]);
    const build = () => {
      lab.clear();
      const n = obM.p.length - 1;
      const cw = Math.min(1.3, 7.6 / (n + 1));
      tm.g = obstGrid(obM.p, obM.q, -3.2 - (cw * n) / 2 + 3.2, 6.6, cw, Math.min(0.86, 5.6 / (n + 1)));
      const S = obstSolve(obM.p, obM.q); tm.steps = S.steps; tm.k = 0;
      tm.after = async () => {
        lab.clear();
        const spec = specFromRoot(S.root, 1, n);
        const nodes = obstTree(spec, n, -(2 * n) * 0.55 / 2, 0.55, 6.6, 1.2);
        const sumL = tag('期望成本 = 0', 'ptr alt', 0, 0.6);
        const sum = await drawObst(undefined, nodes, obM.p, obM.q, 250, sumL);
        log('最佳 BST：root = k' + S.root[1][n] + '，期望成本 ' + fmt2(sum, S.int) + '（表上 e[1][' + n + '] = ' + fmt2(S.e[1][n], S.int) + '）');
      };
      tm.info = () => setState('Optimal BST（n = ' + n + '）', [['p₁…pₙ', obM.p.slice(1).join(' ')], ['q₀…qₙ', obM.q.join(' ')], ['已填', tm.k + ' / ' + tm.steps.length], ['e[1][n]', tm.k >= tm.steps.length ? fmt2(S.e[1][n], S.int) : '?']],
        'e[i][j] = min_r (e[i][r−1] + e[r+1][j]) + w(i,j)<br>e[i][i−1] = qᵢ₋₁；w(i,j) = Σpₗ + Σqₗ');
      tm.info();
    };
    tableControls('<label>p <input id="oP" value="' + obM.p.slice(1).join(' ') + '" style="width:140px"></label><label>q <input id="oQ" value="' + obM.q.join(' ') + '" style="width:150px"></label><button id="oSet">套用</button><button id="oSucc">只算成功搜尋</button>', build, '建出最佳樹');
    on('oSet', () => {
      const p = $('oP').value.trim().split(/[\s,]+/).map(Number), q = $('oQ').value.trim().split(/[\s,]+/).map(Number);
      if (p.length < 1 || p.length > 6 || p.some((x) => !(x >= 0))) { log('p 請填 1～6 個非負數。', true); return; }
      if (q.length !== p.length + 1 || q.some((x) => !(x >= 0))) { log('q 要比 p 多一個（q₀…qₙ），全部非負；只算成功搜尋就全填 0。', true); return; }
      obM.p = [0, ...p]; obM.q = q; clearLog(); build();
    });
    on('oSucc', () => { obM.p = [0, 4, 2, 6, 3]; obM.q = [0, 0, 0, 0, 0]; clearLog(); log('key 10、20、30、40，搜尋次數 4、2、6、3，q 全 0。'); build(); });
    log('CLRS 例子：p = .15 .10 .05 .10 .20，q = .05 .10 .05 .05 .05 .10。');
    build();
  }
  const coM = { coins: [1, 3, 4], A: 6, kind: 'min' };
  function enterCoin() {
    fresh([0, 4.4, 14], [0, 3.6, 0]);
    const build = () => {
      lab.clear();
      if (coM.kind === 'min') {
        tm.g = coinRow(coM.A, 4.2); tm.g.set(0, 0, 0, TEAL, 0);
        const S = coinMin(coM.coins, coM.A); tm.steps = S.steps; tm.k = 0;
        tm.after = async () => {
          if (S.dp[coM.A] === Infinity) { log('湊不出 ' + coM.A + ' 元。', true); return; }
          const used = []; let a = coM.A; while (a > 0) { used.push(S.from[a]); tm.g.mark(0, a, '#f3d27a'); a -= S.from[a]; }
          await showCoins(undefined, used, -used.length * 0.85 / 2, 1.4, TEAL);
          const gr = coinGreedy(coM.coins, coM.A);
          log('DP：' + used.length + ' 枚（' + used.join(' + ') + '）；greedy：' + (gr.ok ? gr.used.length + ' 枚（' + gr.used.join(' + ') + '）' : '湊不出來') + (gr.ok && gr.used.length === used.length ? '，這組剛好一樣' : '，greedy 不是最佳'));
        };
        tm.info = () => setState('最少硬幣（A = ' + coM.A + '）', [['面額', coM.coins.join('、')], ['已填', tm.k + ' / ' + tm.steps.length], ['dp[A]', tm.k >= tm.steps.length ? fmtV(S.dp[coM.A]) : '?']],
          'dp[a] = 1 + min_c dp[a − c]（c ≤ a）<br>dp[0] = 0；Θ(A·k)');
      } else {
        const n = coM.coins.length, cw = Math.min(1.3, 9.6 / (coM.A + 1));
        tm.g = grid({ rows: n + 1, cols: coM.A + 1, cw, ch: Math.min(0.9, 5.4 / (n + 1)), x0: -cw * coM.A / 2 + 0.6, y0: 6, colHdr: Array.from({ length: coM.A + 1 }, (_, k) => k), rowHdr: ['∅', ...coM.coins.map((c, k) => '前 ' + (k + 1) + ' 種')], rowDx: 0.7 });
        tm.g.set(0, 0, 1, TEAL, 0); for (let a = 1; a <= coM.A; a++) tm.g.set(0, a, 0, GRAY, 0);
        const S = coinWays(coM.coins, coM.A); tm.steps = S.steps; tm.k = 0;
        tm.after = async () => { tm.g.mark(n, coM.A, '#9fe0c4'); log('湊出 ' + coM.A + ' 元共有 ' + S.W[n][coM.A] + ' 種組合'); };
        tm.info = () => setState('組合數（A = ' + coM.A + '）', [['面額', coM.coins.join('、')], ['已填', tm.k + ' / ' + tm.steps.length], ['W[n][A]', tm.k >= tm.steps.length ? String(S.W[n][coM.A]) : '?']],
          'W[i][a] = W[i−1][a] + W[i][a − cᵢ]<br>先依硬幣種類分列 → 只算組合、不算排列');
      }
      tm.info();
    };
    tableControls('<select id="cK"><option value="min">最少枚數</option><option value="ways">組合數</option></select><label>面額 <input id="cC" value="' + coM.coins.join(' ') + '" style="width:90px"></label><label>A = <input id="cA" type="number" min="1" max="12" value="' + coM.A + '"></label><button id="cSet">套用</button>', build, '看答案');
    $('cK').value = coM.kind;
    $('cK').onchange = (e) => { coM.kind = e.target.value; clearLog(); build(); };
    on('cSet', () => {
      const c = [...new Set($('cC').value.trim().split(/[\s,]+/).map(Number))].sort((a, b) => a - b), A = Number($('cA').value);
      if (!c.length || c.length > 4 || c.some((x) => !Number.isInteger(x) || x < 1 || x > 12)) { log('面額請填 1～4 種、1～12 的整數。', true); return; }
      if (!(A >= 1 && A <= 12)) { log('A 請填 1～12。', true); return; }
      coM.coins = c; coM.A = A; clearLog(); build();
    });
    log('硬幣 1、3、4 湊 6：greedy 會拿 4+1+1，DP 找到 3+3。');
    build();
  }
  // p×q×r cube: why multiplying costs pqr
  const pqrM = { p: 2, q: 3, r: 4 };
  function enterPqr() {
    fresh([0, 7, 12], [0, 1.2, 0]);
    controls('<label>p <input id="xP" type="number" min="1" max="6" value="' + pqrM.p + '"></label><label>q <input id="xQ" type="number" min="1" max="6" value="' + pqrM.q + '"></label><label>r <input id="xR" type="number" min="1" max="6" value="' + pqrM.r + '"></label><button class="primary" id="xGo">相乘</button>');
    on('xGo', () => runOp(async () => {
      const p = Number($('xP').value), q = Number($('xQ').value), r = Number($('xR').value);
      if (![p, q, r].every((x) => Number.isInteger(x) && x >= 1 && x <= 6)) { log('p、q、r 請填 1～6 的整數。', true); return; }
      Object.assign(pqrM, { p, q, r });
      lab.clear();
      const s = 0.55;
      for (let i = 0; i < p; i++) for (let k = 0; k < q; k++) cube('', BLUE, [0.45, 0.1, 0.45], -5.6 + k * s, 0.05, -1 + i * s);
      for (let k = 0; k < q; k++) for (let j = 0; j < r; j++) cube('', PURPLE, [0.45, 0.1, 0.45], -2.2 + j * s, 0.05, -1.5 + k * s);
      tag('A ' + p + '×' + q, 'ptr', -5.6 + (q - 1) * s / 2, 0.2, 2.3); tag('B ' + q + '×' + r, 'ptr', -2.2 + (r - 1) * s / 2, 0.2, 2.6);
      let cnt = 0;
      for (let i = 0; i < p; i++) for (let j = 0; j < r; j++) { for (let k = 0; k < q; k++) { cube('', TEAL, [0.45, 0.2, 0.45], 1.6 + j * s, 0.1 + k * 0.22, -1 + i * s, 1); cnt++; } await wait(undefined, 140); }
      tag('C ' + p + '×' + r, 'ptr alt', 1.6 + (r - 1) * s / 2, 0.2, 2.3);
      setState('A(p×q) · B(q×r)', [['C 的格數', p + '×' + r + ' = ' + p * r], ['每格乘法', String(q)], ['總乘法', String(cnt)]], '純量乘法次數 = p·q·r');
      log(p + '×' + q + ' 乘 ' + q + '×' + r + '：' + p * r + ' 格 × 每格 ' + q + ' 次 = ' + cnt + ' 次乘法');
    }));
    setState('A(p×q) · B(q×r)', [['p, q, r', '設定後按「相乘」']], '純量乘法次數 = p·q·r');
    log('右邊每一柱 = C 的一格，柱高 = q 次乘法。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  function mkOpts(ans, cands) {
    const o = [String(ans)];
    for (const c of cands) { const s = String(c); if (!o.includes(s)) o.push(s); if (o.length === 4) break; }
    let k = 1; while (o.length < 4) { const s = String(Number(ans) + k * 7 + 1); if (!o.includes(s)) o.push(s); k++; }
    return o;
  }
  function genQ() {
    const t = rnd(7);
    if (t === 0) {
      const p = Array.from({ length: 4 }, () => 2 + rnd(9) * 2), S = mcmSolve(p), ans = S.m[1][3];
      const left = p[0] * p[1] * p[2] + p[0] * p[2] * p[3], right = p[1] * p[2] * p[3] + p[0] * p[1] * p[3];
      return { q: 'A1 ' + p[0] + '×' + p[1] + '、A2 ' + p[1] + '×' + p[2] + '、A3 ' + p[2] + '×' + p[3] + '，相乘最少要幾次純量乘法？', opts: mkOpts(ans, [Math.max(left, right), left + right, p[0] * p[1] * p[2] * p[3]]), ans: String(ans), why: '((A1A2)A3) = ' + left + '，(A1(A2A3)) = ' + right + '，取小的 ' + ans + '。' };
    }
    if (t === 1) {
      const p = Array.from({ length: 5 }, () => 1 + rnd(9)), S = mcmSolve(p), ans = S.m[1][4];
      return { q: '維度 p = ' + p.join(', ') + '（4 個矩陣），m[1][4] = ?', opts: mkOpts(ans, [S.m[1][3] + p[0] * p[3] * p[4], S.m[2][4] + p[0] * p[1] * p[4], ans + p[0]]), ans: String(ans), why: '依鏈長填表；最佳括法 ' + parens(S.s, 1, 4) + '，m[1][4] = ' + ans + '。' };
    }
    if (t === 2) {
      const n = 3 + rnd(4), ans = catalan(n);
      return { q: n + ' 個矩陣相乘，共有幾種不同的完整括號方式？', opts: mkOpts(ans, [catalan(n - 1), 2 ** (n - 1), n * (n - 1) / 2]), ans: String(ans), why: 'P(n) = Σ P(k)P(n−k) = Catalan 數 C(n−1)：1, 1, 2, 5, 14, 42, 132 …' };
    }
    if (t === 3) {
      const f = [0, 1 + rnd(6), 1 + rnd(6), 1 + rnd(6)], S = obstSolve(f, [0, 0, 0, 0]), ans = S.e[1][3];
      const bal = f[2] + 2 * (f[1] + f[3]);
      return { q: '3 個 key k1<k2<k3，成功搜尋次數 ' + f.slice(1).join('、') + '（不考慮失敗搜尋），最佳 BST 的總比較次數（Σ 層數×次數）？', opts: mkOpts(ans, [bal, ans + 1, f[1] + f[2] + f[3]]), ans: String(ans), why: '5 種形狀取最小；最佳 root = k' + S.root[1][3] + '，成本 ' + ans + '（以 k2 為 root 的平衡樹是 ' + bal + '）。' };
    }
    if (t === 4) {
      const sets = [[1, 3, 4], [1, 5, 6], [1, 4, 6], [1, 3, 5], [1, 2, 5]];
      const coins = sets[rnd(sets.length)], A = 6 + rnd(7), S = coinMin(coins, A), gr = coinGreedy(coins, A);
      return { q: '硬幣 ' + coins.join('、') + '，湊 ' + A + ' 元最少要幾枚？', opts: mkOpts(S.dp[A], [gr.used.length, S.dp[A] + 1, Math.ceil(A / coins[2])]), ans: String(S.dp[A]), why: 'dp[a] = 1 + min dp[a − c]；dp[' + A + '] = ' + S.dp[A] + '。greedy 拿 ' + gr.used.join('+') + '（' + gr.used.length + ' 枚）' + (gr.used.length > S.dp[A] ? '，不是最佳。' : '，這題剛好最佳。') };
    }
    if (t === 5) {
      const coins = [1, 2, 5], A = 4 + rnd(6), S = coinWays(coins, A), ans = S.W[3][A];
      return { q: '硬幣 1、2、5（不計順序），湊 ' + A + ' 元有幾種組合？', opts: mkOpts(ans, [ans + 1, ans - 1, S.W[2][A]]), ans: String(ans), why: 'W[i][a] = W[i−1][a] + W[i][a−cᵢ]；W[3][' + A + '] = ' + ans + '。' };
    }
    const P = [
      { q: 'Matrix-chain 的 DP 時間與空間複雜度？', opts: ['Θ(n³) 時間、Θ(n²) 空間', 'Θ(n²) 時間、Θ(n) 空間', 'Θ(2ⁿ) 時間', 'Θ(n log n) 時間'], ans: 'Θ(n³) 時間、Θ(n²) 空間', why: 'Θ(n²) 格，每格試 O(n) 個 k。' },
      { q: 'm[i][j] 的遞迴式是？', opts: ['min_k (m[i][k] + m[k+1][j] + pᵢ₋₁pₖpⱼ)', 'min_k (m[i][k] + m[k][j] + pᵢpₖpⱼ)', 'max_k (m[i][k] + m[k+1][j])', 'm[i][j−1] + pᵢ₋₁pⱼ₋₁pⱼ'], ans: 'min_k (m[i][k] + m[k+1][j] + pᵢ₋₁pₖpⱼ)', why: 'Aᵢ…Aₖ 是 pᵢ₋₁×pₖ、Aₖ₊₁…Aⱼ 是 pₖ×pⱼ，最後一次相乘成本 pᵢ₋₁pₖpⱼ。' },
      { q: 'Matrix-chain 填表的順序？', opts: ['依鏈長 l = 2…n 由短到長（一條一條對角線）', '一列一列由上到下', '一行一行由左到右', '任意順序都可以'], ans: '依鏈長 l = 2…n 由短到長（一條一條對角線）', why: 'm[i][j] 要用到 m[i][k] 與 m[k+1][j]，它們的鏈都比較短。' },
      { q: 'Optimal BST 中，以 k_r 為 root 時 e[i][j] 為什麼要加 w(i,j)？', opts: ['左右子樹每個節點都深了一層，期望成本各多一次機率總和', '因為要加上 root 自己的機率而已', '為了把機率正規化', 'w 是 root 的深度'], ans: '左右子樹每個節點都深了一層，期望成本各多一次機率總和', why: 'e[i][j] = p_r + (e[i][r−1] + w(i,r−1)) + (e[r+1][j] + w(r+1,j)) = e[i][r−1] + e[r+1][j] + w(i,j)。' },
      { q: 'CLRS 例子（p = .15 .10 .05 .10 .20，q = .05 .10 .05 .05 .05 .10）最佳 BST 的期望搜尋成本？', opts: ['2.75', '2.80', '3.00', '2.35'], ans: '2.75', why: 'root = k2，右子樹 root = k5；那棵看起來平衡的樹 (a) 是 2.80。' },
      { q: '最佳 BST 的 root 一定是機率最大的 key 嗎？', opts: ['不一定', '一定是', '一定是中位數', '一定是最小的 key'], ans: '不一定', why: 'CLRS 例子機率最大的是 k5（0.20），但最佳 root 是 k2。' },
      { q: '硬幣 1、3、4 湊 6 元，greedy（先拿大面額）會用幾枚？最佳呢？', opts: ['3 枚；最佳 2 枚', '2 枚；最佳 2 枚', '3 枚；最佳 3 枚', '4 枚；最佳 2 枚'], ans: '3 枚；最佳 2 枚', why: 'greedy：4+1+1；最佳：3+3。這組面額 greedy 不正確，要用 DP。' },
    ];
    return P[rnd(P.length)];
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = shuffle([...p.opts]);
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

  const scenes = {
    'mc-cost': { title: '（課本）矩陣相乘成本 pqr：括號不同差 10 倍', play: scMcCost },
    'mc-count': { title: '（課本）括號方式有 Catalan 數那麼多', play: scMcCount },
    'mc-loops': { title: '（課本）m[i][j] 依鏈長填表：5×4、4×6、6×2、2×7', play: scMcLoops },
    'mc-table': { title: '（課本）CLRS 6 個矩陣：m[1][6] = 15125', play: scMcTable },
    'mc-split': { title: '（課本）用 s 表還原括號：((A1(A2A3))((A4A5)A6))', play: scMcSplit },
    'obst-cost': { title: '（課本）BST 的期望搜尋成本：2.80 vs 2.75', play: scObstCost },
    'obst-table': { title: '（課本）Optimal BST：e[i][j] 與 w(i,j) 填表', play: scObstTable },
    'obst-build': { title: '（課本）用 root 表建出最佳 BST', play: scObstBuild },
    'obst-success-only': { title: '（課本）只考慮成功搜尋的 OBST：10 20 30 40', play: scObstSucc },
    'coin-greedy-fail': { title: '（課本）找零：greedy 用 3 枚、DP 只要 2 枚', play: scCoinGreedy },
    'coin-min': { title: '（課本）最少硬幣：dp[a] = 1 + min dp[a − c]', play: scCoinMin },
    'coin-ways': { title: '（課本）湊錢組合數：W[i][a] 填表', play: scCoinWays },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dp4bari.js ═══
  {
// ─── Abdul Bari：_WncuhSJZyA（Matrix chain，d = 3 2 4 2 5 → 58）、prx1psByp7U（4.3，5×4 4×6 6×2 2×7 → 158）、
//     eKkXU3uu2zk（4.3.1 程式追蹤）、vLS-zRCHo-Y（OBST 只算成功：10 20 30 40 頻率 4 2 6 3 → 26）、
//     wAy6nDMPYAE（4.6.2 OBST：p = 3 3 1 1、q = 2 3 1 1 1（×16）→ 32/16 = 2）、uJOmqBwENB8（4.8 Reliability design） ───
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, code, anim, line, ghostBox, tnode, GOLD, GREEN, GRAY } = K;
const { say, beat } = ctx;
const DRED = '#7a1010';
const prm = () => ctx.params || {};
const mono = (l) => { Object.assign(l.element.style, K.MONO); return l; };
const fr = (x) => String(+x.toFixed(4));

// ── 共用：Matrix chain 的兩張表（成本 C/M 與切點 K/S） ──
function mcStage(p, cn, kn) {
  const n = p.length - 1, S = mcmSolve(p);
  dimsRow(p, 7.6);
  const gm = mcmGrid(p, -5.0, 5.5, 1.15, 0.8);
  const gk = grid({ rows: n, cols: n, cw: 0.9, ch: 0.8, x0: 1.9, y0: 5.5, colHdr: Array.from({ length: n }, (_, k) => 'j=' + (k + 1)), rowHdr: Array.from({ length: n }, (_, k) => 'i=' + (k + 1)), rowDx: 0.3 });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (j <= i) gk.mark(i, j, '#ddd2bf');
  tag(cn + ' 表', 'ptr', -6.5, 6.3); tag(kn + ' 表', 'ptr', 1.0, 6.5);
  return { n, S, gm, gk };
}
async function mcCell(st, o, tok, ms) {
  const { gm, gk, p, cn, kn } = o;
  (o.lines || []).forEach(kill); o.lines = [];
  for (let t = 0; t < st.cands.length; t++) {
    const x = st.cands[t];
    gm.clearArrows(); gm.unglow();
    gm.arrow(st.i - 1, x.k - 1, st.r, st.c, TRY); gm.arrow(x.k, st.j - 1, st.r, st.c, TRY);
    glow(gm.get(st.i - 1, x.k - 1), GOLD); glow(gm.get(x.k, st.j - 1), GOLD);
    o.lines.push(mono(tag('k=' + x.k + ': ' + x.a + ' + ' + x.b + ' + ' + p[st.i - 1] + '·' + p[x.k] + '·' + p[st.j] + ' = ' + x.v, '', -2.2, 2.3 - t * 0.5)));
    say(cn + '(' + st.i + ',' + st.j + ')：k = ' + x.k, cn + '(' + st.i + ',' + x.k + ') + ' + cn + '(' + (x.k + 1) + ',' + st.j + ') + d' + (st.i - 1) + '·d' + x.k + '·d' + st.j + ' = ' + x.v);
    await beat(tok, ms);
  }
  gm.clearArrows(); gm.unglow();
  setCls(o.lines[st.cands.findIndex((x) => x.k === st.bk)], 'ptr alt');
  gm.set(st.r, st.c, st.v, TEAL); gk.set(st.r, st.c, st.bk, PURPLE);
  say(cn + '(' + st.i + ',' + st.j + ') = ' + st.v, (st.cands.length > 1 ? '最小的是 k = ' : 'k = ') + st.bk + ' → 寫進 ' + kn + ' 表');
  await beat(tok, ms);
}
// 依 j−i 由小到大的順序；cells 之前的格子先直接填好
function prefillOrder(order, cells) {
  const key = (c) => c[0] + ',' + c[1];
  const want = new Set((cells || order).map(key));
  const first = order.findIndex((c) => want.has(key(c)));
  return { before: order.slice(0, Math.max(0, first)), anim: (cells || order).slice() };
}

// ── 共用：遞迴展開樹（C(1,4) / c(0,3)） ──
async function exTree(tok, o) {
  const pairs = (i, j) => { const out = []; if (o.mc) for (let k = i; k < j; k++) out.push([k, [i, k], [k + 1, j]]); else for (let k = i + 1; k <= j; k++) out.push([k, [i, k - 1], [k, j]]); return out; };
  const lb = (a) => o.nm + '(' + a[0] + ',' + a[1] + ')';
  const all = [];
  const node = (a, x, y, color) => { const m = cube(lb(a), color, [1.05, 0.48, 0.4], x, y, 0, 1.2); m.userData.key = lb(a); all.push(m); return m; };
  node([o.i0, o.j0], 0, 6.8, TEAL);
  say(lb([o.i0, o.j0]) + '：k 每個值都試', o.mc ? 'k = ' + o.i0 + '…' + (o.j0 - 1) : 'k = ' + (o.i0 + 1) + '…' + o.j0);
  await beat(tok, 1800);
  const P1 = pairs(o.i0, o.j0), cxs = [-4.4, 0, 4.4];
  let expX = 0;
  for (let t = 0; t < P1.length; t++) {
    const [k, a, b] = P1[t], cx = cxs[t];
    all.push(line(0, 6.55, cx, 5.45));
    all.push(tag('k=' + k, 'idx', cx, 5.95));
    node(a, cx - 0.62, 5.2, BLUE); node(b, cx + 0.62, 5.2, PURPLE);
    if (lb(b) === lb(o.exp)) expX = cx + 0.62;
    if (lb(a) === lb(o.exp)) expX = cx - 0.62;
    say('k = ' + k + '：' + lb(a) + ' 和 ' + lb(b), o.mc ? '+ d' + (o.i0 - 1) + '·d' + k + '·d' + o.j0 : '左子樹 + 右子樹');
    await beat(tok, 1400);
  }
  if (!o.mc) { all.push(tag('最後加 w(' + o.i0 + ',' + o.j0 + ')', 'ptr alt', 0, 4.4)); say('取 min 後再加 w(' + o.i0 + ',' + o.j0 + ')', 'w = 這段所有 p、q 的和'); await beat(tok, 1600); }
  say(lb(o.exp) + ' 還不知道：再展開', '公式套公式，越展越多');
  const P2 = pairs(o.exp[0], o.exp[1]);
  for (let t = 0; t < P2.length; t++) {
    const [k, a, b] = P2[t], cx = expX + (t - (P2.length - 1) / 2) * 2.5;
    all.push(line(expX, 4.95, cx, 3.75));
    node(a, cx - 0.58, 3.5, BLUE); node(b, cx + 0.58, 3.5, PURPLE);
    await beat(tok, 1000);
  }
  const rep = all.filter((m) => m.userData.key === lb(o.rep));
  rep.forEach((m) => glow(m, GOLD));
  say(lb(o.rep) + ' 出現不只一次', '同一個子問題被重複需要');
  await beat(tok, 2400);
  all.forEach((m) => fly(m));
  await beat(tok, 700);
  for (let d = 0; d <= o.j0 - o.i0; d++) {
    const row = []; for (let i = o.i0; i + d <= o.j0; i++) row.push([i, i + d]);
    const y = 1.0 + d * 1.25;
    tag('j − i = ' + d, 'idx', -6.0, y);
    row.forEach((a, t) => cube(lb(a), d === o.j0 - o.i0 ? TEAL : d === 0 ? GRAY : BLUE, [1.1, 0.5, 0.4], (t - (row.length - 1) / 2) * 1.5, y, 0, 1.5));
    say('j − i = ' + d + '：' + row.length + ' 個子問題', row.map(lb).join('、') + (d === 0 ? '：先算最小的' : '：用到的都已算好'));
    await beat(tok, 1400);
  }
  say('由小到大填表：就是 DP', '每個值只算一次，存起來重複用');
  await beat(tok, 2800);
}

// ── 共用：MCM 切割樹（依 s 表） ──
async function mcTree(tok, s, n, xL, yTop, dy, ms, onNode) {
  const nodes = [];
  async function walk(i, j, d, par) {
    const x = (xL(i) + xL(j)) / 2, y = yTop - d * dy;
    const nd = { i, j, x, y, d, par };
    nodes.push(nd);
    if (par) line(par.x, par.y - 0.25, x, y + 0.25);
    nd.m = i === j ? cube('A' + i, BLUE, [0.8, 0.45, 0.4], x, y, 0, ms ? 1.2 : 0) : cube(i + '..' + j, TEAL, [0.95, 0.45, 0.4], x, y, 0, ms ? 1.2 : 0);
    if (onNode) await onNode(nd);
    if (ms) await beat(tok, ms);
    if (i < j) { nd.L = await walk(i, s[i][j], d + 1, nd); nd.R = await walk(s[i][j] + 1, j, d + 1, nd); }
    return nd;
  }
  const root = await walk(1, n, 0, null);
  return { root, nodes };
}

// ═════════ Abdul Bari matrix chain（prx1psByp7U、eKkXU3uu2zk、_WncuhSJZyA）：逐句 cue ═════════
// 每個場景吃 params.seq：一個元素 = 老師說的一句話（await step(tok) 等到那一刻），元素裡是要做的 ops。
// 元素可以是字串（一個 op）或陣列（多個 op，每個 op 是字串或 [名稱, 參數…]）。beat 只剩動作本身。
const { step, buddy, prop, relabel } = K;
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const nte = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const guide = (x, z, s = 0.7) => buddy('', '', '#ffc56b', x, 0, z, s);
// 一個會被換掉的對話泡泡
function slot(x, y, z = 0, cls = 'say') { let l = null; return (t, x2, y2) => { kill(l); l = t ? tag(t, cls, x2 ?? x, y2 ?? y, z) : null; return l; }; }
async function runSeq(tok, seq, ops) {
  for (const e of seq) {
    await step(tok);
    for (const o of (typeof e === 'string' ? [e] : e)) {
      const a = typeof o === 'string' ? [o] : o;
      const f = ops[a[0]];
      if (!f) throw new Error('unknown op ' + a[0]);
      await f(...a.slice(1));
    }
  }
}
// A_i…A_j 的括號寫法（中間不再細分）
const grpStr = (i, j) => (i === j ? 'A' + i : '(' + Array.from({ length: j - i + 1 }, (_, t) => 'A' + (i + t)).join('') + ')');
const splitStr = (i, k, j) => { const s = grpStr(i, k) + grpStr(k + 1, j); return j - i === 1 ? 'A' + i + 'A' + j : s; };

// ── 兩個矩陣相乘：乘法次數 ──
FRAG.push(['dp4bari-mm-cost', '兩個矩陣相乘：乘法次數 = p·q·r', async (tok) => {
  const P = prm(), p = P.p || 2, q = P.q || 3, r = P.r || 2;
  const seq = P.seq || ['dims', 'cond', 'cell1', 'C', 'rest', 'total'];
  fresh([0, 6.2, 13], [0, 1.4, 0]);
  const s = 0.5, ax = -5.8, bx = -2.4, cx = 1.6, z0 = -1.2;
  const gd = guide(5.6, 1.2, 0.75), sb = slot(4.2, 4.6);
  const A = [], B = [], done = new Set();
  let tA = null, tB = null, tC = null, cnt = null, Cm = false, c = 0;
  const ensureC = () => {
    if (Cm) return; Cm = true;
    for (let i = 0; i < p; i++) for (let j = 0; j < r; j++) cube('', '#e9dfcb', [0.44, 0.03, 0.44], cx + j * s, 0.015, z0 + i * s);
    tC = tag('C：' + p + '×' + r, 'ptr alt', cx + (r - 1) * s / 2, 0.3, z0 + p * s + 0.3);
  };
  const ensureCnt = () => { if (!cnt) cnt = tag('乘法 0 次', 'ptr alt', 4.2, 3.2); };
  const lit = (i, j, k) => {
    A.forEach((m, z) => glow(m, i >= 0 && Math.floor(z / q) === i && z % q === k ? GOLD : null));
    B.forEach((m, z) => glow(m, i >= 0 && Math.floor(z / r) === k && z % r === j ? GOLD : null));
  };
  async function cell(i, j, per) {
    ensureC(); ensureCnt();
    for (let k = 0; k < q; k++) {
      cube('', TEAL, [0.42, 0.18, 0.42], cx + j * s, 0.1 + k * 0.2, z0 + i * s, 1.0);
      lit(i, j, k); c++; txt(cnt, '乘法 ' + c + ' 次');
      await beat(tok, per);
    }
    done.add(i + ',' + j);
  }
  const ops = {
    dims: () => {
      for (let i = 0; i < p; i++) for (let k = 0; k < q; k++) A.push(cube('', BLUE, [0.42, 0.12, 0.42], ax + k * s, 0.06, z0 + i * s, 0.8));
      for (let k = 0; k < q; k++) for (let j = 0; j < r; j++) B.push(cube('', PURPLE, [0.42, 0.12, 0.42], bx + j * s, 0.06, z0 + k * s, 0.8));
      tA = tag('A：' + p + '×' + q, 'ptr', ax + (q - 1) * s / 2, 0.3, z0 + p * s + 0.3);
      tB = tag('B：' + q + '×' + r, 'ptr', bx + (r - 1) * s / 2, 0.3, z0 + q * s + 0.3);
      gd.mood('wow');
      say('A 是 ' + p + '×' + q + '、B 是 ' + q + '×' + r, p + ' 列 ' + q + ' 行，乘上 ' + q + ' 列 ' + r + ' 行');
    },
    cond: () => {
      setCls(tA, 'ptr alt'); setCls(tB, 'ptr alt'); gd.mood('calm');
      sb('A 的 column ' + q + ' = B 的 row ' + q + ' ✓');
      say('能相乘的條件', 'A 的 column 數 = B 的 row 數');
    },
    swap: () => {
      tag('B×A：' + q + '×' + r + ' · ' + p + '×' + q, 'bad', -1.4, 2.4);
      sb(r + ' ≠ ' + p + '：B×A 不能乘'); gd.mood('sad');
      say('反過來 B×A 呢？', r + ' ≠ ' + p + '：A×B 能乘不代表 B×A 能乘');
    },
    C: () => { ensureC(); gd.mood('wow'); sb('C 是 ' + p + '×' + r + '：取兩端的維度'); say('結果 C = AB 是 ' + p + '×' + r, 'row 數取 A、column 數取 B'); },
    count: () => { ensureC(); gd.mood('calm'); sb('C 共 ' + p + '×' + r + ' = ' + p * r + ' 個元素'); say('C 裡有 ' + p * r + ' 個元素', '每個元素都要算出來'); },
    cell1: async () => {
      gd.mood('calm'); sb('一個元素 = ' + q + ' 次乘法');
      say('C[1][1]：A 第 1 列 · B 第 1 行', q + ' 對元素相乘再相加');
      await cell(0, 0, Math.min(600, 2400 / q));
    },
    cell2: async () => { say('C[1][2]：第 1 列 · 第 2 行', '又是 ' + q + ' 次乘法'); await cell(0, 1, Math.min(600, 2400 / q)); },
    rest: async () => {
      const left = [];
      for (let i = 0; i < p; i++) for (let j = 0; j < r; j++) if (!done.has(i + ',' + j)) left.push([i, j]);
      say('每個元素都是 ' + q + ' 次乘法', p * r + ' 格，每格 ' + q + ' 次');
      const per = Math.max(30, 2400 / Math.max(1, left.length * q));
      for (const [i, j] of left) await cell(i, j, per);
      lit(-1);
    },
    total: async () => {
      ensureCnt(); lit(-1); txt(cnt, '乘法 ' + p * q * r + ' 次'); setCls(cnt, 'good');
      sb(p + '·' + q + '·' + r + ' = ' + p * q * r); gd.mood('happy');
      say('共 ' + p + '·' + q + '·' + r + ' = ' + p * q * r + ' 次乘法', '三個維度相乘');
      await gd.hop(tok);
    },
    cost: () => { nte('兩矩陣相乘的成本 = 乘法次數', -1.2, 4.6); say('成本 = 做了幾次乘法', p + '×' + q + ' 乘 ' + q + '×' + r + '：' + p * q * r + ' 次'); },
    pt1: () => { lit(-1); setCls(tA, 'ptr alt'); setCls(tB, 'ptr alt'); sb('① 中間兩個 ' + q + ' 要相等'); say('重點一：什麼時候能乘', '第一個的 column 數 = 第二個的 row 數'); },
    pt2: () => { ensureC(); setCls(tC, 'good'); sb('② 結果 ' + p + '×' + r + '：取兩端'); say('重點二：結果的維度', p + '×' + r + '：A 的 row 數、B 的 column 數'); },
    pt3: () => { sb('③ 乘法次數 = ' + p + '×' + q + '×' + r); say('重點三：要做幾次乘法', p + '·' + q + '·' + r + ' = ' + p * q * r); },
    dims4: () => { pkt(p + '×' + q + ' · ' + q + '×' + r + '：4 個數', -3.6, 3.4); say('兩個矩陣寫下來有 4 個維度', p + '、' + q + '、' + q + '、' + r); },
    dims3: async () => { tag('不同的維度：' + p + '、' + q + '、' + r, 'good', -3.6, 2.6); gd.mood('happy'); say('中間那個共用 → 只有 3 個不同的維度', '後面 matrix chain 會一直用到'); await gd.hop(tok); },
  };
  await runSeq(tok, seq, ops);
}]);

// ── 三個矩陣兩種括法：40 vs 36 ──
FRAG.push(['dp4bari-chain3', '三個矩陣兩種括法：40 vs 36', async (tok) => {
  const P = prm(), seq = P.seq || ['abc', 'way1', 'l1', 'l2', 'sum1'];
  fresh([0, 4.8, 14], [0, 3.4, 0]);
  const gd = guide(-6.3, 1.6, 0.7), sb = slot(0, 4.9);
  const d = [2, 3, 4, 2], X = [-2.4, 0, 2.4];
  const H = (v) => v / 40 * 3.8;
  let mats = [], top = [], tens = [], fast = false;
  const L = {}, R = {};
  const seg = (color, x, y0) => { const m = cube('', color, [1.6, 1, 1.2], x, y0, 0); m.scale.y = 0.001; return m; };
  async function grow(m, y0, v) { const h = H(v); if (fast) { m.scale.y = h; m.position.y = y0 + h / 2; return; } await anim(tok, 800, (t) => { m.scale.y = Math.max(0.001, h * t); m.position.y = y0 + h * t / 2; }); }
  const ops = {
    abc: () => {
      mats = X.map((x, k) => cube('A' + (k + 1), k % 2 ? PURPLE : BLUE, [1.4, 0.55, 0.45], x, 7.0, 0, fast ? 0 : 1.5));
      X.forEach((x, k) => top.push(tag(d[k] + '×' + d[k + 1], 'idx', x, 7.6)));
      gd.mood('wow'); say('三個矩陣 A1、A2、A3 要相乘', '2×3、3×4、4×2');
    },
    check: () => { top.push(tag('3 = 3 ✓', 'good', -1.2, 8.2), tag('4 = 4 ✓', 'good', 1.2, 8.2)); gd.mood('calm'); say('先檢查能不能乘', '相鄰的維度都對得上'); },
    dlab: () => { d.forEach((v, k) => top.push(tag('d' + k + '=' + v, 'idx', -3.6 + k * 2.4, 6.4))); say('維度標成 d0、d1、d2、d3', '共用的維度只標一次'); },
    two: () => { sb('一次只能乘兩個'); say('三個能一起乘嗎？不行', '一次只能乘兩個矩陣'); },
    way1: () => { tag('(A1A2)A3', 'ptr', -3, 0.25, 1.3); mats.forEach((m, k) => glow(m, k < 2 ? GOLD : null)); say('方法一：A1 先乘 A2，結果再乘 A3', '(A1A2)A3'); },
    way2: () => { tag('A1(A2A3)', 'ptr', 3, 0.25, 1.3); mats.forEach((m, k) => glow(m, k ? GOLD : null)); say('方法二：A2 先乘 A3，A1 再乘結果', 'A1(A2A3)'); },
    assoc: () => { mats.forEach((m) => glow(m, null)); sb('結合律：兩種算法答案一樣'); say('兩種的結果一樣嗎？一樣', '矩陣乘法有結合律'); },
    effort: () => { sb('不看元素，只數乘法次數'); gd.mood('wow'); say('我們不真的去乘', '只在乎要做多少次乘法'); },
    l1: async () => { L.a = seg(TEAL, -3, 0); say('A1A2：2·3·4 = 24 次', '2×3 乘 3×4'); await grow(L.a, 0, 24); tag('24', 'idx', -4.2, H(12)); },
    l0: () => { tag('+ 0（A3 單獨）', 'idx', -1.0, H(24)); say('A3 自己不用乘：0 次', ''); },
    res: () => { pkt('A1A2 → 2×4', -5.2, 4.6); say('A1A2 的結果是 2×4', '列數取 A1、行數取 A2'); },
    l2: async () => { L.b = seg(ORANGE, -3, H(24)); say('2×4 乘 A3（4×2）：2·4·2 = 16 次', ''); await grow(L.b, H(24), 16); tag('16', 'idx', -4.2, H(32)); },
    sum1: () => { tag('40', 'ptr alt', -3, H(40) + 0.5); gd.mood('calm'); say('(A1A2)A3 共 24 + 0 + 16 = 40 次', ''); },
    r1: async () => { R.a = seg(TEAL, 3, 0); pkt('A2A3 → 3×2', 5.2, 4.6); say('A2A3：3·4·2 = 24 次', '結果是 3×2'); await grow(R.a, 0, 24); tag('24', 'idx', 4.2, H(12)); },
    r0: () => { tag('+ 0（A1 單獨）', 'idx', 1.0, H(24)); say('A1 這邊不用乘：0 次', ''); },
    r2: async () => { R.b = seg(ORANGE, 3, H(24)); say('A1（2×3）乘 3×2：2·3·2 = 12 次', ''); await grow(R.b, H(24), 12); tag('12', 'idx', 4.2, H(30)); },
    sum2: () => { tag('36', 'ptr alt', 3, H(36) + 0.5); say('A1(A2A3) 共 24 + 0 + 12 = 36 次', ''); },
    cmp: async () => { glow(R.a, GREEN); glow(R.b, GREEN); gd.mood('happy'); sb('答案一樣，成本 40 vs 36'); say('結果相同，成本不同', 'A1(A2A3) 比較省'); await gd.hop(tok); },
    diff4: () => { tag('差 4 次', 'note', 0, 2.4); say('才 3 個矩陣就差了 4 次', '矩陣越多，差距越大'); },
    ten: async () => {
      [...mats, ...top].forEach(kill);
      tens = Array.from({ length: 10 }, (_, k) => cube('A' + (k + 1), k % 2 ? PURPLE : BLUE, [0.85, 0.5, 0.4], -4.725 + k * 1.05, 7.0, 0, 1.2));
      gd.mood('wow'); say('如果有 A1 一直到 A10？', '直接從左乘到右可能非常貴');
      await beat(tok, 400);
    },
    first: () => { sb('① 先決定怎麼乘　② 再真的去乘'); gd.mood('calm'); say('先找出怎麼乘最省', '再真的去乘'); },
    mcm: () => { tag('Matrix Chain Multiplication', 'ptr alt', 0, 8.1); say('這就是 matrix chain multiplication', '找讓總乘法次數最少的括法'); },
    dp: () => { gd.mood('happy'); sb('DP：試過所有括法，挑最好的'); say('DP 的想法', '試過所有可能的括法，挑最好的'); },
    many: () => { tens.forEach((m) => glow(m, GOLD)); gd.mood('sad'); sb('10 個矩陣：括法太多 → 需要公式'); say('3 個只有 2 種，10 個就太多了', '不能手動列舉 → 需要公式'); },
  };
  if (P.pre) { fast = true; for (const o of ['abc', 'dlab', 'way1', 'way2', 'l1', 'l0', 'l2', 'sum1']) await ops[o](); mats.forEach((m) => glow(m, null)); gd.mood('calm'); fast = false; }
  await runSeq(tok, seq, ops);
}]);

// ── prx1psByp7U：問題與括號樹 ──
FRAG.push(['dp4bari-trees4', '四個矩陣：括號 = 二元樹，共 5 種', async (tok) => {
  const p = [5, 4, 6, 2, 7], seq = prm().seq || ['dims', 'pA', 'treeA', 'five', 'dp'];
  fresh([0, 4.4, 14.5], [0, 3.6, 0]);
  const gd = guide(-6.4, 1.8, 0.65), sb = slot(-0.4, 4.4);
  const all = []; let nodesB = [];
  const sA = [], sB = [];
  for (let i = 0; i <= 5; i++) { sA[i] = []; sB[i] = []; }
  sA[1][4] = 3; sA[1][3] = 2; sA[1][2] = 1;
  sB[1][4] = 2; sB[1][2] = 1; sB[3][4] = 3;
  function tree(sp, xL, yTop, dy) {
    const nodes = [];
    (function walk(i, j, d, par) {
      const x = (xL(i) + xL(j)) / 2, y = yTop - d * dy, nd = { i, j, x, y };
      if (par) all.push(line(par.x, par.y - 0.25, x, y + 0.25));
      nd.m = i === j ? cube('A' + i, BLUE, [0.8, 0.45, 0.4], x, y, 0, 1.0) : cube('×', TEAL, [0.6, 0.45, 0.4], x, y, 0, 1.0);
      nodes.push(nd); all.push(nd.m);
      if (i < j) { walk(i, sp[i][j], d + 1, nd); walk(sp[i][j] + 1, j, d + 1, nd); }
    })(1, 4, 0, null);
    return nodes;
  }
  const ops = {
    dims: () => { dimsRow(p, 7.6); tag('4=4、6=6、2=2 ✓', 'good', 4.6, 7.6); gd.mood('wow'); say('4 個矩陣：5×4、4×6、6×2、2×7', '相鄰維度都相同 → 可以相乘'); },
    ask: () => { sb('不是要乘出答案'); gd.mood('calm'); say('問題不是把它們乘出來', '一次只能乘一對：該先乘哪一對？'); },
    how: () => { sb('要知道「怎麼乘」：怎麼加括號'); say('Matrix chain：決定怎麼加括號', '讓總成本最小'); },
    pA: () => { all.push(tag('((A1A2)A3)A4', 'ptr', -4.35, 1.0, 0.6)); say('方法一：((A1A2)A3)A4', '一個接一個乘'); },
    pB: () => { all.push(tag('(A1A2)(A3A4)', 'ptr', 3.55, 1.0, 0.6)); say('方法二：(A1A2)(A3A4)', '兩兩各乘，再相乘'); },
    treeB: () => { nodesB = tree(sB, (k) => 1.6 + (k - 1) * 1.3, 6.2, 1.3); say('畫成樹：A1A2、A3A4 各乘，再相乘', '每個 × 是一次兩矩陣相乘'); },
    three: () => { nodesB.forEach((nd) => glow(nd.m, nd.i < nd.j ? GOLD : null)); sb('3 次乘法 → 3 個節點'); say('4 個矩陣 → 3 次乘法 → 3 個節點', ''); },
    treeA: () => { nodesB.forEach((nd) => glow(nd.m, null)); tree(sA, (k) => -6.0 + (k - 1) * 1.1, 6.2, 1.2); say('((A1A2)A3)A4 也是一棵樹', '樹的形狀 = 括法'); },
    count: () => { sb('n 個節點的二元樹：C(2n,n)/(n+1) 種'); say('3 個節點能畫出幾種樹？', 'n 個節點：C(2n,n)/(n+1) 種'); },
    five: () => { sb('n = 3：C(6,3)/4 = 5 種括法'); gd.mood('wow'); say('n = 3 → 5 種括法', '要挑出成本最小的那一種'); },
    tryall: () => { sb('5 種全部算一遍再挑？'); gd.mood('sad'); say('要把 5 種都算出來再挑嗎？', '不用這樣做'); },
    dp: async () => { sb('DP：有系統地試過所有可能'); gd.mood('happy'); say('DP：試過所有可能，挑最好的', '而且不會漏掉任何一種'); await gd.hop(tok); },
    tables: () => {
      all.forEach(kill); sb('');
      const hd = (pre) => Array.from({ length: 4 }, (_, k) => pre + (k + 1));
      const gm = grid({ rows: 4, cols: 4, cw: 1.15, ch: 0.8, x0: -5.0, y0: 5.5, colHdr: hd('j='), rowHdr: hd('i='), rowDx: 0.35 });
      const gs = grid({ rows: 4, cols: 4, cw: 0.9, ch: 0.8, x0: 1.9, y0: 5.5, colHdr: hd('j='), rowHdr: hd('i='), rowDx: 0.3 });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if (j < i) gm.mark(i, j, '#ddd2bf'); if (j <= i) gs.mark(i, j, '#ddd2bf'); }
      tag('M 表', 'ptr', -6.5, 6.3); tag('S 表', 'ptr', 1.0, 6.5);
      gd.mood('calm'); say('DP 用 tabulation：兩張表', 'M 存成本、S 存切點');
    },
  };
  await runSeq(tok, seq, ops);
}]);

// ── prx1psByp7U：把填表的式子寫成一般公式 ──
FRAG.push(['dp4bari-formula', '一般公式：m(i,j) = min{ m(i,k) + m(k+1,j) + d(i−1)·d(k)·d(j) }', async (tok) => {
  const P = prm(), p = P.p || [5, 4, 6, 2, 7], nm = P.nm || 'm', n = p.length - 1;
  const seq = P.seq || ['start', 'ik', 'plus', 'dlab', 'd0', 'full'];
  fresh([0, 4.4, 14.5], [0, 3.6, 0]);
  const gd = guide(-6.4, 1.8, 0.65), sb = slot(3.8, 1.2);
  const w = Math.min(1.35, 11 / n), xk = (k) => (k - (n + 1) / 2) * w;
  dimsRow(p, 7.4);
  const fx = mono(tag('', 'ptr alt', 0, 5.6));
  let rows = [], dT = [];
  const L = nm + '(i,k) + ' + nm + '(k+1,j)';
  const ops = {
    start: () => { txt(fx, nm + '(i,j) = min {  …  }'); gd.mood('wow'); say('先把用過的式子寫成一般公式', nm + '(i,j) = min{ … }'); },
    ik: () => {
      rows = [1, 2, 3].map((k) => mono(tag(nm + '(1,' + k + ') + ' + nm + '(' + (k + 1) + ',' + n + ')', '', -2.6, 4.6 - (k - 1) * 0.6)));
      say('回頭看 ' + nm + '(1,4) 的三項', '1,1 和 2,4；1,2 和 3,4；1,3 和 4,4');
    },
    glowik: () => {
      rows.forEach((l, t) => tag('k=' + (t + 1) + '：i..k = 1..' + (t + 1) + '，k+1..j = ' + (t + 2) + '..' + n, 'idx', 2.2, 4.6 - t * 0.6));
      txt(fx, nm + '(i,j) = min { ' + L + '  … }');
      say('左邊 i 到 k、右邊 k+1 到 j', '所以寫成 ' + L);
    },
    plus: () => {
      rows.forEach((l, t) => txt(l, nm + '(1,' + (t + 1) + ') + ' + nm + '(' + (t + 2) + ',' + n + ') + ' + p[0] + '·' + p[t + 1] + '·' + p[n]));
      txt(fx, nm + '(i,j) = min { ' + L + ' + ?·?·? }');
      say('還要加上兩段相乘的成本', '例子裡是 5·4·7、5·6·7、5·2·7');
    },
    dlab: () => { for (let k = 1; k <= n; k++) dT[k] = tag('d' + k, 'ptr', xk(k) + w / 2, 8.2); say('把維度編號：d1、d2、d3、d4', '每個矩陣右邊那個維度'); },
    d0: () => { dT[0] = tag('d0', 'ptr alt', xk(1) - w / 2, 8.2); gd.mood('wow'); say('最前面那個叫 d0', '4 個矩陣有 5 個維度：d0…d4'); },
    dim1: () => { dT.forEach((l) => setCls(l, 'ptr')); setCls(dT[0], 'ptr alt'); setCls(dT[1], 'ptr alt'); sb('A_i 的 row 數是 d(i−1)'); say('第 i 個矩陣是 d(i−1) × d(i)', '所以開頭要用 i − 1'); },
    full: async () => {
      txt(fx, nm + '(i,j) = min { ' + L + ' + d(i−1)·d(k)·d(j) }'); setCls(fx, 'good');
      tag('i ≤ k < j', 'ptr', 0, 6.3); sb(''); gd.mood('happy');
      say('合併成本 = d(i−1)·d(k)·d(j)', 'k 從 i 試到 j − 1，取最小');
      await gd.hop(tok);
    },
  };
  await runSeq(tok, seq, ops);
}]);

// ── _WncuhSJZyA：從 3 個矩陣的例子推出公式 ──
FRAG.push(['dp4bari-derive', '從 40 和 36 兩個算式推出 C(i,j) 公式', async (tok) => {
  const seq = prm().seq || ['c13', 'C12', 'C33', 'd023', 'k', 'full', 'min'];
  fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  const gd = guide(-6.5, 1.8, 0.6), sb = slot(3.8, 0.4);
  const d = [2, 3, 4, 2], X = [-2.4, 0, 2.4], PX = [-3.0, -0.4, 2.4];
  X.forEach((x, k) => { cube('A' + (k + 1), k % 2 ? PURPLE : BLUE, [1.4, 0.5, 0.45], x, 7.4); tag(d[k] + '×' + d[k + 1], 'idx', x, 8.0); });
  const dT = d.map((v, k) => tag('d' + k + '=' + v, 'idx', -3.6 + k * 2.4, 6.8));
  let head = null, r1 = [], r2 = [], g = [], gLbl = null;
  const row = (y, lbl, vals) => {
    tag(lbl, 'ptr', -5.3, y);
    const ps = vals.slice(0, 3).map((v, t) => cube(String(v), [BLUE, PURPLE, ORANGE][t], [2.1, 0.55, 0.45], PX[t], y, 0, 1.0));
    tag('+', 'val', -1.7, y); tag('+', 'val', 1.0, y);
    ps.res = tag('= ' + vals[3], 'ptr alt', 4.6, y);
    return ps;
  };
  const hi = (ks) => dT.forEach((l, k) => setCls(l, ks.includes(k) ? 'ptr alt' : 'idx'));
  const ops = {
    c13: () => {
      head = tag('C(1,3) = min { 40, 36 }', 'ptr alt', 0, 6.1);
      r1 = row(5.0, '(A1A2)A3', [24, 0, 16, 40]); r2 = row(3.7, 'A1(A2A3)', [0, 24, 12, 36]);
      gd.mood('wow'); say('要求 C(1,3)：A1…A3 的最小成本', '先看剛才兩種算法的算式');
    },
    C12: () => { relabel(r1[0], 'C(1,2)'); glow(r1[0], GOLD); say('24 就是 A1A2 的成本', '寫成 C(1,2)'); },
    C33: () => { glow(r1[0], null); relabel(r1[1], 'C(3,3)'); glow(r1[1], GOLD); say('0 是 A3 自己的成本', 'C(3,3) = 0：單一矩陣不用乘'); },
    d023: () => { glow(r1[1], null); relabel(r1[2], 'd0·d2·d3'); glow(r1[2], GOLD); hi([0, 2, 3]); say('最後相乘：2×4 乘 4×2', 'd0·d2·d3 = 2·4·2 = 16'); },
    C11: () => { glow(r1[2], null); hi([]); relabel(r2[0], 'C(1,1)'); glow(r2[0], GOLD); say('另一式也改寫：0 是 C(1,1)', 'A1 自己不用乘'); },
    C23: () => { glow(r2[0], null); relabel(r2[1], 'C(2,3)'); glow(r2[1], GOLD); say('24 是 A2A3 的成本：C(2,3)', '3·4·2 = 24'); },
    d013: () => { glow(r2[1], null); relabel(r2[2], 'd0·d1·d3'); glow(r2[2], GOLD); hi([0, 1, 3]); say('最後相乘：2×3 乘 3×2', 'd0·d1·d3 = 2·3·2 = 12'); },
    ij: () => { glow(r2[2], null); hi([]); txt(head, 'C(i,j)：i = 1、j = 3'); sb('兩式頭尾都是 1 和 3 → i、j'); say('兩式的頭尾都是 1 和 3', '叫它們 i 和 j'); },
    dij: () => { hi([0, 3]); sb('d0 = d(i−1)、d3 = d(j)'); say('兩式都有 d0 和 d3', 'd0 = d(i−1)、d3 = d(j)'); },
    k: () => {
      gLbl = tag('C(i,j) = min', 'ptr alt', -5.3, 2.2);
      g = ['C(i,k)', 'C(k+1,j)'].map((s, t) => cube(s, [BLUE, PURPLE][t], [2.1, 0.55, 0.45], PX[t], 2.2, 0, 1.0));
      tag('+', 'val', -1.7, 2.2);
      tag('k=2', 'idx', -5.3, 4.55); tag('k=1', 'idx', -5.3, 3.25);
      say('中間切開的地方叫 k', '左邊 C(i,k)、右邊 C(k+1,j)');
    },
    dk: () => { hi([1, 2]); sb('中間的維度 d(k)：k=2 → d2、k=1 → d1'); say('中間那個維度就是 d(k)', 'k = 2 用 d2，k = 1 用 d1'); },
    full: () => {
      hi([]); g.push(cube('d(i−1)·d(k)·d(j)', ORANGE, [2.1, 0.55, 0.45], PX[2], 2.2, 0, 1.0)); tag('+', 'val', 1.0, 2.2);
      sb(''); gd.mood('happy'); say('公式：左邊 + 右邊 + 合併', 'C(i,k) + C(k+1,j) + d(i−1)·d(k)·d(j)');
    },
    krange: () => { tag('i ≤ k < j', 'ptr', 4.6, 2.2); say('k 從 i 試到 j − 1', '例子裡 k = 1、2'); },
    min: () => { r2.forEach((m) => glow(m, GREEN)); setCls(r2.res, 'good'); txt(head, 'C(1,3) = min { 40, 36 } = 36'); say('兩個裡面取最小', 'min{40, 36} = 36'); },
    idea: async () => {
      r2.forEach((m) => glow(m, null));
      say('左、右、合併的成本', '都是「三個維度相乘」算出來的');
      for (const m of g) { glow(m, GOLD); await beat(tok, 500); glow(m, null); }
    },
    tryall: async () => { sb('試所有 k，挑最好的'); say('矩陣越多，k 能取的值越多', '10 個矩陣 k 就從 1 試到 9'); await gd.hop(tok); },
  };
  await runSeq(tok, seq, ops);
}]);

// ── _WncuhSJZyA：四個矩陣有 5 種括法（module 的 mc-count 的逐句版） ──
FRAG.push(['dp4bari-mc-count', '四個矩陣 5 種括法：Catalan 數', async (tok) => {
  const seq = prm().seq || ['mats', 'p1', ['p2', 'p34', 'p5'], 'five', 'catalan', 'calc4', 'calc5'];
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const gd = guide(-6.5, 1.8, 0.6), sb = slot(-3.0, 1.4);
  const ALL4 = ['A1(A2(A3A4))', 'A1((A2A3)A4)', '(A1A2)(A3A4)', '(A1(A2A3))A4', '((A1A2)A3)A4'];
  let mats = [], ls = [], t = 0;
  const addP = () => { const l = mono(tag(ALL4[t], 'ptr alt', -3.0, 5.9 - t * 0.6)); ls.push(l); t++; };
  const bar = (v, x, lbl) => { const h = v * 0.15, m = cube('', ORANGE, [0.9, 1, 0.9], x, 0, 0); m.scale.y = h; m.position.y = h / 2; tag(lbl, 'idx', x, h + 0.35); return m; };
  const ops = {
    mats: () => {
      mats = [0, 1, 2, 3].map((k) => cube('A' + (k + 1), k % 2 ? PURPLE : BLUE, [1.4, 0.5, 0.45], -3.3 + k * 2.2, 7.4, 0, 1.2));
      [0, 1, 2, 3].forEach((k) => tag('d' + k + '×d' + (k + 1), 'idx', -3.3 + k * 2.2, 8.0));
      gd.mood('wow'); say('四個矩陣，維度 d0…d4', '用公式之前，先看有幾種乘法');
    },
    ask: () => { sb('先找出最省力的括法'); say('有哪些相乘的方法？', '真的乘之前先知道哪種最省'); },
    p1: () => { addP(); say('A1 乘上 A2(A3A4) 的結果', ALL4[0]); },
    p2: () => { addP(); say('A3 先乘 A2，再乘 A4，最後 A1', ALL4[1]); },
    p34: () => { addP(); addP(); say('(A1A2)(A3A4)，或 A4 留到最後', ALL4[2] + '、' + ALL4[3]); },
    p5: () => { addP(); say('從左一路乘到右', ALL4[4]); },
    five: () => { tag('共 5 種', 'good', -3.0, 2.6); gd.mood('calm'); say('4 個矩陣有 5 種括法', ''); },
    catalan: () => { tag('Catalan 數：C(2n,n)/(n+1)', 'ptr', 3.2, 5.9); say('括法數用 Catalan 數算', 'C(2n,n)/(n+1)'); },
    nminus1: () => { tag('n 要取「矩陣數 − 1」', 'note', 3.2, 5.3); gd.mood('wow'); say('注意：n 要取矩陣數 − 1', '4 個矩陣 → n = 3'); },
    mod: () => { tag('C(2(n−1), n−1) / n（n = 矩陣數）', 'ptr', 3.2, 4.7); say('改寫成用矩陣數 n 的版本', 'C(2(n−1), n−1) / n'); },
    calc4: () => { tag('4 個：6C3 / 4 = 20 / 4 = 5', 'good', 3.2, 4.0); bar(5, 2.4, '5'); gd.mood('happy'); say('4 個矩陣：6C3 / 4 = 5', '和剛才列出來的一樣'); },
    calc5: () => { tag('5 個：8C4 / 5 = 70 / 5 = 14', 'good', 3.2, 3.4); bar(14, 4.2, '14'); gd.mood('wow'); say('5 個矩陣：8C4 / 5 = 14 種括法', '矩陣一多，括法就暴增'); },
    pick: () => { ls.forEach((l) => setCls(l, 'ptr')); sb('從 5 種裡挑最小 → 用公式'); gd.mood('calm'); say('要從這些括法中挑出最省的', '用剛推出來的公式'); },
  };
  await runSeq(tok, seq, ops);
}]);

// ── _WncuhSJZyA：直接展開 C(1,4)：子問題重複 → 由小到大 ──
FRAG.push(['dp4bari-expand14', '直接展開 C(1,4)：子問題重複 → 由小到大', async (tok) => {
  const seq = prm().seq || ['root', 'k1', 'k2', 'k3', 'exp24', 'layer', 'rep'];
  fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  const gd = guide(-6.5, 1.8, 0.6), sb = slot(4.6, 1.4);
  const all = [], pars = [], cxs = [-4.4, 0, 4.4];
  const lb = (a, b) => 'C(' + a + ',' + b + ')';
  const node = (a, b, x, y, color) => { const m = cube(lb(a, b), color, [1.05, 0.48, 0.4], x, y, 0, 1.0); m.userData.key = lb(a, b); all.push(m); return m; };
  const kOp = (k) => {
    const cx = cxs[k - 1];
    line(0, 7.35, cx, 6.25); tag('k=' + k, 'idx', cx, 6.75);
    node(1, k, cx - 0.62, 6.0, BLUE); node(k + 1, 4, cx + 0.62, 6.0, PURPLE);
    tag('+ d0·d' + k + '·d4', 'idx', cx, 5.45);
    say('k = ' + k + '：' + lb(1, k) + ' + ' + lb(k + 1, 4), '+ d0·d' + k + '·d4');
  };
  const PS = ['A1(A2A3A4)', '(A1A2)(A3A4)', '(A1A2A3)A4'];
  const ops = {
    root: () => { node(1, 4, 0, 7.6, TEAL); gd.mood('wow'); say('套公式求 C(1,4)', 'i = 1、j = 4'); },
    ks: () => { sb('k ≥ 1 且 k < 4：k = 1、2、3'); say('k 可以是 1、2、3', 'k ≥ i 且 k < j'); },
    k1: () => kOp(1), k2: () => kOp(2), k3: () => kOp(3),
    min: () => { tag('min { 三項 }', 'ptr alt', 2.0, 7.6); sb(''); say('三項取最小', '等於試過所有括法'); },
    par: (k) => { pars.push(tag(PS[k - 1], 'ptr', cxs[k - 1], 4.95)); say('k = ' + k + ' 代表 ' + PS[k - 1], k === 1 ? 'A1 單獨，A2…A4 一組' : k === 2 ? '在 A2 後面切開' : 'A4 單獨'); },
    known: () => {
      all.filter((m) => m.userData.key === lb(1, 1) || m.userData.key === lb(4, 4)).forEach((m) => { tint(m, GRAY); relabel(m, m.userData.key + '=0'); });
      gd.mood('calm'); say('C(1,1)、C(4,4) 已知 = 0', '單一矩陣不用乘');
    },
    exp24: () => {
      pars.forEach(kill);
      const ex = cxs[0] + 0.62;
      [[2, [2, 2], [3, 4]], [3, [2, 3], [4, 4]]].forEach(([k, a, b], t) => {
        const cx = ex + (t - 0.5) * 2.5;
        line(ex, 5.75, cx, 4.05); tag('k=' + k, 'idx', cx, 4.6);
        node(a[0], a[1], cx - 0.58, 3.8, BLUE); node(b[0], b[1], cx + 0.58, 3.8, PURPLE);
      });
      say('C(2,4) 不知道：再套一次公式', 'k = 2、3');
    },
    again: () => { all.forEach((m) => { const k = m.userData.key; glow(m, [lb(2, 3), lb(3, 4), lb(1, 2), lb(1, 3)].includes(k) ? GOLD : null); }); gd.mood('sad'); say('每一項又要再套公式', '一路展開下去太長了'); },
    small: () => { all.forEach((m) => glow(m, null)); sb('先算小的，再算大的'); gd.mood('wow'); say('為什麼不先算小的？', '小的先算好，大的直接用'); },
    diff: () => { sb('j−i = 3：3 項　2：2 項　1：1 項'); say('大小看 j − i', 'j − i 越大，要比的項越多'); },
    layer: () => {
      for (let d = 0; d <= 3; d++) {
        const rw = []; for (let i = 1; i + d <= 4; i++) rw.push([i, i + d]);
        const y = 0.3 + d * 0.6;
        tag('j−i=' + d, 'idx', -4.0, y);
        rw.forEach((a, t) => cube(lb(a[0], a[1]), d === 3 ? TEAL : d === 0 ? GRAY : BLUE, [1.0, 0.42, 0.35], (t - (rw.length - 1) / 2) * 1.15, y, 0, 1.0));
      }
      sb(''); say('先算 j − i = 0，再 1、2、3', '由小到大填');
    },
    rep: async () => {
      all.forEach((m) => glow(m, m.userData.key === lb(3, 4) ? GOLD : null));
      gd.mood('happy'); say('C(3,4) 在好幾個地方都要用', '算一次存起來，到處重複用');
      await gd.hop(tok);
    },
  };
  await runSeq(tok, seq, ops);
}]);

// ── 填表：成本表 C/M + 切點表 K/S，一句一格 ──
FRAG.push(['dp4bari-mc-fill', 'Matrix chain 填表：成本表 + 切點表（逐句）', async (tok) => {
  const P = prm(), p = P.p || [3, 2, 4, 2, 5], cn = P.cn || 'C', kn = P.kn || 'K';
  const seq = P.seq || [[['pick', 1, 2]], [['set', 1, 2]], [['kset', 1, 2]], [['pick', 1, 3]], [['k', 1, 3, 1, 0], ['k', 1, 3, 2, 0]], [['kv', 1, 3, 1], ['kv', 1, 3, 2]], [['min', 1, 3], ['kset', 1, 3]]];
  const n = p.length - 1, S = mcmSolve(p);
  fresh([0, 4.4, 15], [0, 4.0, 0]);
  const gd = guide(-6.4, 1.8, 0.65), sb = slot(4.6, 0.6);
  const w = Math.min(1.35, 11 / n), xk = (k) => (k - (n + 1) / 2) * w;
  let dims = null, gm = null, gk = null, cnT = null, ghost = null, hiCells = [];
  let lines = {}, plist = [];
  const stp = (i, j) => S.steps.find((z) => z.i === i && z.j === j);
  const hd = (pre) => Array.from({ length: n }, (_, k) => pre + (k + 1));
  const clearLines = () => { Object.values(lines).forEach(kill); lines = {}; plist.forEach(kill); plist = []; };
  const unhi = () => { hiCells.forEach(([r, c]) => { if (gm) gm.mark(r, c); if (gk) gk.mark(r, c); }); hiCells = []; };
  const hiCell = (r, c) => { if (gm) gm.mark(r, c, '#f3d27a'); if (gk) gk.mark(r, c, '#f3d27a'); hiCells.push([r, c]); };
  const lineTxt = (i, j, k, lvl) => {
    const c = stp(i, j).cands.find((z) => z.k === k), h = 'k=' + k + ':  ';
    const sub = cn + '(' + i + ',' + k + ') + ' + cn + '(' + (k + 1) + ',' + j + ')';
    if (lvl === 0) return h + sub + ' + d' + (i - 1) + '·d' + k + '·d' + j;
    if (lvl === 1) return h + sub + ' + ' + p[i - 1] + '·' + p[k] + '·' + p[j];
    if (lvl === 2) return h + c.a + ' + ' + c.b + ' + ' + p[i - 1] + '·' + p[k] + '·' + p[j];
    return h + c.a + ' + ' + c.b + ' + ' + c.x + ' = ' + c.v;
  };
  const ops = {
    dims: () => { if (dims) return; dims = dimsRow(p, 7.6); tag(p.map((v, k) => 'd' + k + '=' + v).join(' '), 'ptr', 5.0, 7.6); say('例題：d0…d4 = ' + p.join('、'), '4 個矩陣、5 個維度'); },
    mgrid: () => {
      if (gm) return;
      gm = grid({ rows: n, cols: n, cw: 1.15, ch: 0.8, x0: -5.0, y0: 5.5, colHdr: hd('j='), rowHdr: hd('i='), rowDx: 0.35 });
      for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) gm.mark(i, j, '#ddd2bf');
      cnT = tag(cn + ' 表', 'ptr', -6.5, 6.3);
      gd.mood('wow'); say('準備一張 ' + n + '×' + n + ' 的表', 'row 是 i、column 是 j');
    },
    kgrid: () => {
      if (gk) return;
      gk = grid({ rows: n, cols: n, cw: 0.9, ch: 0.8, x0: 1.9, y0: 5.5, colHdr: hd('j='), rowHdr: hd('i='), rowDx: 0.3 });
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) gk.mark(i, j, '#ddd2bf');
      tag(kn + ' 表', 'ptr', 1.0, 6.5);
      say('再準備一張 ' + n + '×' + n + ' 的表', '記錄取到最小值的 k');
    },
    z: (i) => { gm.set(i - 1, i - 1, 0, GRAY, 1.4); if (dims) dims.forEach((m, k) => glow(m, k === i - 1 ? GOLD : null)); say(cn + '(' + i + ',' + i + ') = 0', '只有 A' + i + '，沒有乘任何東西'); },
    zall: async () => {
      if (dims) dims.forEach((m) => glow(m, null));
      say(cn + '(i,i) = 0', '單一矩陣不用乘');
      for (let i = 0; i < n; i++) if (!gm.get(i, i)) { gm.set(i, i, 0, GRAY, 1.4); await beat(tok, 250); }
    },
    diag: (dd) => {
      unhi(); for (let i = 0; i + dd < n; i++) hiCell(i, i + dd);
      say('j − i = ' + dd + ' 的對角線', dd === 1 ? '兩個矩陣一組' : (dd + 1) + ' 個矩陣一組');
    },
    pick: (i, j) => {
      clearLines(); unhi(); hiCell(i - 1, j - 1); if (gm) gm.clearArrows();
      kill(ghost);
      if (dims) {
        ghost = ghostBox('#f3d27a', (j - i + 1) * w, 0.9, 0.8); ghost.position.set((xk(i) + xk(j)) / 2, 7.6, 0);
        dims.forEach((m, k) => glow(m, k + 1 >= i && k + 1 <= j ? GOLD : null));
      }
      gd.mood('wow');
      say(cn + '(' + i + ',' + j + ')：A' + i + '…A' + j, j - i === 1 ? '兩個矩陣相乘' : 'k = ' + i + '…' + (j - 1) + ' 都要試');
    },
    paren: (i, j) => {
      plist.forEach(kill); plist = [];
      const xs = []; for (let k = i; k < j; k++) xs.push(splitStr(i, k, j));
      xs.forEach((s, t) => plist.push(pkt('k=' + (i + t) + '  ' + s, 4.6, 2.3 - t * 0.55)));
      say(j - i + 1 + ' 個矩陣有 ' + xs.length + ' 種切法', xs.join(' 或 '));
    },
    look: () => {
      const [i, j] = (hiCells[0] || [0, 0]).map((v) => v + 1);
      for (let k = i; k < j; k++) { glow(gm.get(i - 1, k - 1), GOLD); glow(gm.get(k, j - 1), GOLD); }
      sb('小問題的值：直接查表'); gd.mood('happy');
      say('小問題的答案都在表裡', '直接拿來用，不用重算');
    },
    k: (i, j, k, lvl = 0) => {
      gm.clearArrows(); gm.unglow();
      gm.arrow(i - 1, k - 1, i - 1, j - 1, TRY); gm.arrow(k, j - 1, i - 1, j - 1, TRY);
      if (gm.get(i - 1, k - 1)) glow(gm.get(i - 1, k - 1), GOLD);
      if (gm.get(k, j - 1)) glow(gm.get(k, j - 1), GOLD);
      const t = k - i;
      if (!lines[k]) lines[k] = mono(tag('', '', -1.4, 2.2 - t * 0.5));
      txt(lines[k], lineTxt(i, j, k, lvl));
      const c = stp(i, j).cands.find((z) => z.k === k);
      if (lvl < 2) say(cn + '(' + i + ',' + j + ')，k = ' + k, '左 ' + cn + '(' + i + ',' + k + ')、右 ' + cn + '(' + (k + 1) + ',' + j + ')');
      else say('k = ' + k + '：' + lineTxt(i, j, k, lvl).split(':  ')[1], lvl === 3 ? '左邊 + 右邊 + 最後相乘' : '值從表裡查');
      return c;
    },
    kv: (i, j, k) => ops.k(i, j, k, 3),
    min: async (i, j) => {
      const st = stp(i, j);
      gm.clearArrows(); gm.unglow();
      for (const c of st.cands) { if (!lines[c.k]) lines[c.k] = mono(tag(lineTxt(i, j, c.k, 3), '', -1.4, 2.2 - (c.k - i) * 0.5)); txt(lines[c.k], lineTxt(i, j, c.k, 3)); setCls(lines[c.k], c.k === st.bk ? 'ptr alt' : ''); }
      gm.set(i - 1, j - 1, st.v, TEAL); unhi();
      if (dims) dims.forEach((m) => glow(m, null)); kill(ghost); ghost = null;
      gd.mood('happy');
      say(cn + '(' + i + ',' + j + ') = ' + st.v, st.cands.length > 1 ? '最小的是 k = ' + st.bk : '只有一種切法');
      await gd.hop(tok);
    },
    set: (i, j) => {
      const st = stp(i, j);
      clearLines(); gm.clearArrows();
      lines[0] = mono(tag('A' + i + 'A' + j + ':  ' + p[i - 1] + '·' + p[i] + '·' + p[j] + ' = ' + st.v, 'ptr alt', -1.4, 2.2));
      gm.set(i - 1, j - 1, st.v, TEAL); unhi();
      if (dims) dims.forEach((m) => glow(m, null)); kill(ghost); ghost = null;
      gd.mood('happy');
      say(cn + '(' + i + ',' + j + ') = ' + p[i - 1] + '·' + p[i] + '·' + p[j] + ' = ' + st.v, 'A' + i + ' 乘 A' + j);
    },
    kset: (i, j) => {
      const st = stp(i, j);
      gk.set(i - 1, j - 1, st.bk, PURPLE); gk.mark(i - 1, j - 1);
      say(kn + '(' + i + ',' + j + ') = ' + st.bk, '記下取到最小值的 k');
    },
    setk: (i, j) => { ops.set(i, j); ops.kset(i, j); say(cn + '(' + i + ',' + j + ') = ' + stp(i, j).v + '，' + kn + ' = ' + stp(i, j).bk, p[i - 1] + '·' + p[i] + '·' + p[j]); },
    note: (a, b, bt) => { if (bt !== undefined) sb(bt); say(a, b || ''); },
    mood: (m) => gd.mood(m),
    done: async () => {
      gm.mark(0, n - 1, '#9fe0c4'); gd.mood('happy');
      say(cn + '(1,' + n + ') = ' + S.m[1][n] + '：最少乘法次數', kn + '(1,' + n + ') = ' + S.s[1][n]);
      await gd.hop(tok);
    },
  };
  // 開場就在的東西
  if (P.built !== false) { ops.dims(); ops.mgrid(); ops.kgrid(); }
  if (gm && P.zeros !== false) for (let i = 0; i < n; i++) gm.set(i, i, 0, GRAY, 0);
  for (const [i, j] of P.pre || []) { const st = stp(i, j); gm.set(i - 1, j - 1, st.v, TEAL, 0); gk.set(i - 1, j - 1, st.bk, PURPLE, 0); }
  say(cn + ' 表與 ' + kn + ' 表', cn + '(i,j) = min{' + cn + '(i,k) + ' + cn + '(k+1,j) + d_{i−1}d_k d_j}');
  await runSeq(tok, seq, ops);
}]);

// ── 從切點表加括號（逐句） ──
FRAG.push(['dp4bari-paren', '從切點表加括號', async (tok) => {
  const P = prm(), p = P.p || [3, 2, 4, 2, 5], kn = P.kn || 'K';
  const n = p.length - 1, S = mcmSolve(p);
  const seq = P.seq || ['tab', [['split', 1, 4]], [['split', 1, 3]], [['split', 2, 3]], 'order', 'str'];
  fresh([0, 4.4, 15], [0, 3.8, 0]);
  const gd = guide(-6.5, 1.8, 0.6), sb = slot(-3.6, 1.6);
  const g = grid({ rows: n, cols: n, cw: 0.72, ch: 0.58, x0: -5.4, y0: 6.4, colHdr: Array.from({ length: n }, (_, k) => k + 1), rowHdr: Array.from({ length: n }, (_, k) => k + 1), rowDx: 0.1 });
  tag(kn + ' 表', 'ptr', -4.3, 7.3);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) { if (j > i) g.set(i - 1, j - 1, S.s[i][j], PURPLE, 0); else g.mark(i - 1, j - 1, '#ddd2bf'); }
  const xL = (k) => 0.4 + (k - 1) * (5.6 / Math.max(1, n - 1));
  const nodes = {};
  let lastCell = null, strT = null;
  const mk = (i, j, d, par) => {
    const key = i + ',' + j; if (nodes[key]) return nodes[key];
    const x = (xL(i) + xL(j)) / 2, y = 6.6 - d * 1.35, nd = { i, j, x, y, d, par };
    if (par) line(par.x, par.y - 0.25, x, y + 0.25);
    nd.m = i === j ? cube('A' + i, BLUE, [0.8, 0.45, 0.4], x, y, 0, 1.2) : cube(i + '..' + j, TEAL, [0.95, 0.45, 0.4], x, y, 0, 1.2);
    nodes[key] = nd; return nd;
  };
  const post = () => { const out = []; (function w(nd) { if (!nd || nd.i === nd.j) return; w(nodes[nd.i + ',' + S.s[nd.i][nd.j]]); w(nodes[(S.s[nd.i][nd.j] + 1) + ',' + nd.j]); out.push(nd); })(nodes['1,' + n]); return out; };
  const ops = {
    tab: () => { for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) glow(g.get(i - 1, j - 1), GOLD); gd.mood('wow'); sb('括號要看 ' + kn + ' 表'); say('要知道怎麼加括號：看 ' + kn + ' 表', kn + '(i,j) = 最佳切點 k'); },
    split: (i, j) => {
      for (let a = 1; a <= n; a++) for (let b = a + 1; b <= n; b++) glow(g.get(a - 1, b - 1), null);
      if (lastCell) g.mark(lastCell[0], lastCell[1]);
      const k = S.s[i][j], nd = mk(i, j, 0, null);
      g.mark(i - 1, j - 1, '#f3d27a'); glow(g.get(i - 1, j - 1), GOLD); lastCell = [i - 1, j - 1];
      tag('k=' + k, 'idx', nd.x + 0.8, nd.y + 0.3);
      mk(i, k, nd.d + 1, nd); mk(k + 1, j, nd.d + 1, nd);
      gd.mood('calm'); sb(i + '..' + j + ' → ' + splitStr(i, k, j));
      say(kn + '(' + i + ',' + j + ') = ' + k + '：在 A' + k + ' 後面切', grpStr(i, k) + ' 和 ' + grpStr(k + 1, j));
    },
    two: () => { sb('只剩兩個矩陣：不用再分'); say('A2、A3 只有兩個', '直接相乘，不用再看'); },
    leaves: () => { Object.values(nodes).forEach((nd) => glow(nd.m, nd.i === nd.j ? GOLD : null)); say('葉子就是 A1、A2、A3、A4', '樹的形狀 = 括號'); },
    order: async () => {
      Object.values(nodes).forEach((nd) => glow(nd.m, null));
      say('由下往上乘：A2A3 → 乘 A1 → 乘 A4', '先乘樹的最底層');
      let t = 0;
      for (const nd of post()) { t++; glow(nd.m, GREEN); tag('第' + t + '次', 'pkt', nd.x - 0.95, nd.y + 0.35); await beat(tok, 650); }
      gd.mood('happy');
    },
    inorder: async () => {
      const out = mono(tag('', 'ptr alt', 0, 0.5, 0.6)); let s = '';
      say('對這棵樹做 in-order traversal', '進節點印 (、葉子印 A、離開印 )');
      async function walk(nd) {
        if (nd.i === nd.j) { s += 'A' + nd.i; txt(out, s); await beat(tok, 200); return; }
        s += '('; txt(out, s); await beat(tok, 120);
        await walk(nodes[nd.i + ',' + S.s[nd.i][nd.j]]); await walk(nodes[(S.s[nd.i][nd.j] + 1) + ',' + nd.j]);
        s += ')'; txt(out, s); await beat(tok, 120);
      }
      await walk(nodes['1,' + n]);
    },
    str: async () => {
      if (!strT) strT = tag(parens(S.s, 1, n), 'good', 0, 0.5, 0.6);
      gd.mood('happy'); say(parens(S.s, 1, n), '最少 ' + S.m[1][n] + ' 次乘法');
      await gd.hop(tok);
    },
    recap: async () => {
      say('再看一次：' + kn + '(1,' + n + ') = ' + S.s[1][n] + '，' + kn + '(1,' + S.s[1][n] + ') = ' + S.s[1][S.s[1][n]], '一層一層往下切');
      for (const nd of Object.values(nodes).filter((z) => z.i < z.j).sort((a, b) => a.d - b.d)) { glow(nd.m, GOLD); glow(g.get(nd.i - 1, nd.j - 1), GOLD); await beat(tok, 500); glow(nd.m, null); glow(g.get(nd.i - 1, nd.j - 1), null); }
    },
    note: (a, b, bt) => { if (bt !== undefined) sb(bt); say(a, b || ''); },
  };
  await runSeq(tok, seq, ops);
}]);

// ── 填表時間：n² 格 × 每格 ≤ n 個 k（逐句） ──
FRAG.push(['dp4bari-mc-time', '填表時間：n² 格 × 每格 ≤ n 個 k', async (tok) => {
  const P = prm(), n = P.n || 4, p = P.p || [5, 4, 6, 2, 7], S = mcmSolve(p), big = P.big || 'O';
  const seq = P.seq || ['show', 'fill', 'n2', 'k', 'n3'];
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const gd = guide(-6.5, 1.8, 0.6), sb = slot(0.6, 6.8);
  const cw = 1.0, ch = 0.75, x0 = -5.4, y0 = 6.2;
  let g = null, cl = null, tl = null, cnt = 0;
  const tx = (i, j) => 3.6 + ((i + j) - (n + 1)) * 0.6, ty = (i, j) => 1.2 + (j - i) * 0.8;
  const ops = {
    show: () => {
      g = grid({ rows: n, cols: n, cw, ch, x0, y0, colHdr: Array.from({ length: n }, (_, k) => 'j=' + (k + 1)), rowHdr: Array.from({ length: n }, (_, k) => 'i=' + (k + 1)), rowDx: 0.3 });
      for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) g.mark(i, j, '#ddd2bf');
      gd.mood('wow'); say('填這張表要花多少時間？', '數一數有幾格、每格做多少事');
    },
    fill: async () => {
      if (!g) ops.show();
      cl = cl || tag('0 格', 'ptr alt', -3.9, 3.2);
      say('只填半張表', n + ' + … + 1 = n(n+1)/2 格');
      for (let l = 1; l <= n; l++) {
        for (let i = 0; i + l - 1 < n; i++) { g.set(i, i + l - 1, '', l === 1 ? GRAY : TEAL, 1.2); cnt++; }
        txt(cl, cnt + ' 格 = ' + n + '·' + (n + 1) + '/2'); await beat(tok, 450);
      }
    },
    diag0: () => { for (let i = 0; i < n; i++) glow(g.get(i, i), GOLD); sb('對角線都是 0：算不算都行'); say('對角線都是 0', 'n(n+1)/2 或 n(n−1)/2 都可以'); },
    n2: () => { for (let i = 0; i < n; i++) glow(g.get(i, i), null); tag('≈ n² 格', 'ptr alt', -3.9, 2.5); say('格子數約 n²', 'n(n+1)/2 → n²'); },
    k: async () => {
      tl = tag('試 k 共 0 次', 'ptr alt', -3.9, 1.8); let tries = 0;
      say('每一格要試所有 k 再取最小', '最多 n 個 k');
      for (let l = 2; l <= n; l++) for (let i = 0; i + l - 1 < n; i++) {
        const p0 = g.pos(i, i + l - 1);
        for (let k = 0; k < l - 1; k++) cube('', ORANGE, [0.2, 0.2, 0.2], p0.x - 0.35 + k * 0.25, p0.y + 0.38, 0.4, 0.8);
        tries += l - 1; txt(tl, '試 k 共 ' + tries + ' 次'); await beat(tok, 300);
      }
    },
    n3: async () => { tag('n² × n = ' + big + '(n³)', 'good', -3.9, 1.1); gd.mood('happy'); say('n² 格 × 每格最多 n → ' + big + '(n³)', big === 'O' ? '這是上界' : 'matrix chain 的時間複雜度'); await gd.hop(tok); },
    both: () => { sb('真的把矩陣乘出來也是 n³'); say('乘矩陣是 n³', '找最佳括法也是 n³'); },
    less: () => { sb('k 不一定有 n 個：實際比 n³ 少一點'); gd.mood('calm'); say('k 不是每次都有 n 個值', '細算會比 n³ 少一點；n³ 是上界'); },
    tri: () => {
      for (let i = 1; i <= n; i++) for (let j = i; j <= n; j++) cube('', '#efe6d2', [0.95, 0.7, 0.1], tx(i, j), ty(i, j), -0.1);
      for (let i = 1; i <= n; i++) tag('i=' + i, 'idx', tx(i, i) - 0.55, ty(i, i) - 0.55);
      gd.mood('wow'); say('換個畫法：把表轉成三角形', '下半張用不到，乾脆不畫');
    },
    trij: () => { for (let j = 1; j <= n; j++) tag('j=' + j, 'idx', tx(j, j) + 0.55, ty(j, j) - 0.55); say('一邊看是 row i、另一邊是 column j', 'i=1 那一列沿著斜邊往上'); },
    trivals: async () => {
      say('三角形裡的值', '最上面 ' + S.m[1][n] + '，最底下一排是 0');
      for (let d = n - 1; d >= 0; d--) { for (let i = 1; i + d <= n; i++) cube(String(S.m[i][i + d]), d === 0 ? GRAY : TEAL, [0.8, 0.55, 0.3], tx(i, i + d), ty(i, i + d), 0.15, 1.0); await beat(tok, 400); }
      gd.mood('happy');
    },
  };
  await runSeq(tok, seq, ops);
}]);

// ═════════ eKkXU3uu2zk：程式追蹤（逐句） ═════════
const MC_CODE = ['p[] = {5,4,6,2,7};  n = 5;', 'm[5][5] = {0};  s[5][5] = {0};', 'for (d = 1; d < n-1; d++)', ' for (i = 1; i < n-d; i++) {', '  j = i + d;  min = INT_MAX;', '  for (k = i; k <= j-1; k++) {', '   q = m[i][k] + m[k+1][j]', '       + p[i-1]*p[k]*p[j];', '   if (q < min) { min = q; s[i][j] = k; }', '  }', '  m[i][j] = min;', ' }'];
FRAG.push(['dp4bari-code', '程式：d 是對角線、i 是列、j = i + d、k 求 min', async (tok) => {
  const P = prm(), p = [5, 4, 6, 2, 7], S = mcmSolve(p);
  const seq = P.seq || ['p', 'ms', 'diag0', [['d', 2]], [['i', 1]], 'kl', [['k', 1, 2]], [['k', 2, 2]], [['kv', 1, 2]], 'min', 'sset'];
  fresh([0, 4.2, 15], [0, 4.0, 0]);
  const gd = guide(-6.6, 1.8, 0.55), sb = slot(5.0, 2.6);
  let cd = null, gm = null, gs = null, pc = null, pT = [], dTag = null, mL = null, cur = null, mats = [], tmp = [];
  let D = 0, I = 0, J = 0, Q = {};
  const hdr = Array.from({ length: 5 }, (_, k) => k);
  const ensureCode = () => { if (!cd) cd = code(MC_CODE, -2.0, 7.9, 0.41); };
  const ensureP = (drop) => { if (!pc) pc = p.map((v, k) => cube(v, ORANGE, [0.5, 0.4, 0.4], 3.6 + k * 0.65, 6.9, 0, drop ? 1.2 : 0)); };
  const ensurePT = () => { if (!pT.length) pT = p.map((v, k) => tag('p[' + k + ']', 'idx', 3.6 + k * 0.65, 6.45)); };
  const ensureG = () => {
    if (gm) return;
    gm = grid({ rows: 5, cols: 5, cw: 0.7, ch: 0.46, x0: -5.0, y0: 2.5, colHdr: hdr, rowHdr: hdr, rowDx: 0.1 });
    gs = grid({ rows: 5, cols: 5, cw: 0.7, ch: 0.46, x0: 0.2, y0: 2.5, colHdr: hdr, rowHdr: hdr, rowDx: 0.1 });
    tag('m', 'ptr', -6.3, 3.0); tag('s', 'ptr', -0.9, 3.0);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (j < i && i > 0 && j > 0) { gm.mark(i, j, '#ddd2bf'); gs.mark(i, j, '#ddd2bf'); }
  };
  const markZero = () => { for (let k = 0; k < 5; k++) for (const g of [gm, gs]) { g.mark(0, k, '#c9bfae'); g.mark(k, 0, '#c9bfae'); } };
  const unmarkUpper = () => { for (let i = 1; i < 5; i++) for (let j = i + 1; j < 5; j++) { gm.mark(i, j); gs.mark(i, j); } };
  const clearQ = () => { Object.values(Q).forEach(kill); Q = {}; };
  const qTxt = (k, lvl) => {
    const a = S.m[I][k], b = S.m[k + 1][J], x = p[I - 1] * p[k] * p[J], h = 'k=' + k + ': ';
    if (lvl === 0) return h + 'm[' + I + '][' + k + ']+m[' + (k + 1) + '][' + J + ']+p' + (I - 1) + '·p' + k + '·p' + J;
    if (lvl === 1) return h + 'm[' + I + '][' + k + ']+m[' + (k + 1) + '][' + J + ']+' + p[I - 1] + '·' + p[k] + '·' + p[J];
    if (lvl === 2) return h + a + ' + ' + b + ' + ' + p[I - 1] + '·' + p[k] + '·' + p[J];
    return h + a + ' + ' + b + ' + ' + x + ' = ' + (a + b + x);
  };
  const ops = {
    // ── 問題（還沒看程式） ──
    prob: () => {
      mats = [0, 1, 2, 3].map((k) => cube('A' + (k + 1), k % 2 ? PURPLE : BLUE, [1.4, 0.5, 0.45], -3.3 + k * 2.2, 5.6, 0, 1.2));
      mats.forEach((m, k) => tag(p[k] + '×' + p[k + 1], 'idx', -3.3 + k * 2.2, 6.2));
      gd.mood('wow'); say('例子：4 個矩陣要相乘', '5×4、4×6、6×2、2×7');
    },
    how: () => { sb('不是乘出答案，是決定「怎麼乘」', 0, 4.4); say('問題不是去乘', '是先決定怎麼加括號，讓乘法最少'); },
    pair: () => { glow(mats[0], GOLD); glow(mats[1], GOLD); tag('一次只能乘一對', 'note', -2.2, 7.0); say('不能一次全部乘', '一次乘一對：先乘哪一對？'); },
    inst: () => { mats.forEach((m) => glow(m, null)); prop('monitor', 3.6, 0.2, 0, 1.1, 'p[] = {5,4,6,2,7}'); gd.mood('calm'); say('程式裡直接寫好這組維度', '只解這一個例子'); },
    input: () => { prop('keyboard', 0.6, 0.2, 1.2, 1.0, '換資料：改值重編譯，或讀輸入'); say('想解別的例子？', '改程式裡的值，或自己加輸入'); },
    // ── 程式結構 ──
    p: () => { ensureCode(); cd.hl(0); ensureP(true); gd.mood('wow'); say('維度存在陣列 p', '相鄰共用的維度只存一次'); },
    pidx: () => { ensurePT(); pc.forEach((m) => glow(m, GOLD)); say('p[0] … p[4] 共 5 個', '4 個矩陣 → 5 個維度'); },
    ms: () => { ensureCode(); cd.hl(1); if (pc) pc.forEach((m) => glow(m, null)); ensureG(); gd.mood('calm'); say('m、s 開 5×5 的二維陣列', 'm 存成本、s 存切點'); },
    why5: () => { sb('開 5 → 索引 0…4，A4 用得到 4'); say('為什麼是 5×5？', '開 4 只有 0…3，用不到 4'); },
    zero: () => { markZero(); sb('第 0 列、第 0 行用不到'); say('第 0 列、第 0 行用不到', '陣列一開始全部設成 0'); },
    diag0: () => { ensureG(); for (let i = 1; i < 5; i++) if (!gm.get(i, i)) gm.set(i, i, 0, GRAY, 1.2); say('對角線 m[i][i] = 0', '單一矩陣不用乘'); },
    diag: (dd) => {
      unmarkUpper(); sb('');
      const cs = []; for (let i = 1; i + dd < 5; i++) { gm.mark(i, i + dd, '#f3d27a'); gs.mark(i, i + dd, '#f3d27a'); cs.push('(' + i + ',' + (i + dd) + ')'); }
      say('要填的格子：j − i = ' + dd, cs.join(' '));
    },
    dloop: () => { ensureCode(); cd.hl(2); unmarkUpper(); dTag = dTag || tag('d = 1, 2, 3', 'ptr alt', 4.9, 5.95); say('最外層 d：j − i 的差', 'd < n − 1 = 4 → d = 1、2、3'); },
    jcalc: () => {
      cd.hl(4);
      for (let i = 1; i < 5; i++) for (let j = i + 1; j < 5; j++) { const q0 = gm.pos(i, j); tmp.push(tag(i + '+' + (j - i), 'idx', q0.x, q0.y, 0.4)); }
      say('j = i + d', '例：1 + 2 = 3、2 + 2 = 4、1 + 3 = 4');
    },
    iloop: async () => {
      cd.hl(3); tmp.forEach(kill); tmp = [];
      sb('i：1 … n − d − 1（越上面越短）');
      say('中層 i 是列：到 n − d − 1', 'd = 1：3 列，d = 2：2 列，d = 3：1 列');
      for (let dd = 1; dd <= 3; dd++) { unmarkUpper(); for (let i = 1; i + dd < 5; i++) gm.mark(i, i + dd, '#f3d27a'); await beat(tok, 600); }
      unmarkUpper();
    },
    kloop: () => { cd.hl(6); sb('最內層 k：套公式求 min'); say('最內層迴圈就是 DP 公式', '試每個 k，取最小值'); },
    // ── 追蹤 ──
    set: (i, j) => {
      gm.set(i, j, S.m[i][j], TEAL); gm.mark(i, j); gs.mark(i, j);
      sb('m[' + i + '][' + j + '] = ' + p[i - 1] + '·' + p[i] + '·' + p[j] + ' = ' + S.m[i][j]);
      say('m[' + i + '][' + j + '] = ' + p[i - 1] + '·' + p[i] + '·' + p[j] + ' = ' + S.m[i][j], 'A' + i + ' 乘 A' + j + '，直接填值');
    },
    pick: (i, j) => { gm.mark(i, j, '#f3d27a'); say('先填 m[' + i + '][' + j + ']', 'A' + i + ' 和 A' + j + ' 兩個矩陣'); },
    sall: async () => { say('s 表也填上 1、2、3', '兩個矩陣只有一種切法：k = i'); for (let i = 1; i <= 3; i++) { gs.set(i, i + 1, i, PURPLE); gs.mark(i, i + 1); await beat(tok, 400); } },
    d: (dd) => { ensureCode(); cd.hl(2); D = dd; dTag = dTag || tag('', 'ptr alt', 4.9, 5.95); txt(dTag, 'd = ' + dd); sb(''); gd.mood('wow'); say('d 變成 ' + dd, '下一條對角線'); },
    i: (ii) => {
      cd.hl(4); I = ii; J = ii + D; clearQ(); gm.clearArrows(); gm.unglow();
      gm.mark(I, J, '#f3d27a'); gs.mark(I, J, '#f3d27a');
      const q0 = gm.pos(I, J); kill(cur); cur = tag('i=' + I + ' j=' + J, 'ptr alt', q0.x, q0.y + 0.42, 0.4);
      mL = mL || mono(tag('', 'ptr', 4.9, 5.45)); txt(mL, 'min = INT_MAX');
      say('i = ' + I + '，j = i + d = ' + J, '求 m[' + I + '][' + J + ']');
    },
    kl: () => { cd.hl(5); const ks = []; for (let k = I; k < J; k++) ks.push(k); sb('k = ' + ks.join('、')); say('k 從 i 到 j − 1', 'k = ' + ks.join('、')); },
    two: () => { sb('k 迴圈跑 ' + (J - I) + ' 次'); say('k 迴圈跑 ' + (J - I) + ' 次', '每次用公式算一個 q'); },
    minrule: () => { cd.hl(10); sb('最小的 q → m[' + I + '][' + J + ']'); say('每次算公式，留下最小的', '最小值放進 m[i][j]'); },
    k: (k, lvl = 0) => {
      cd.hl(6); gm.clearArrows(); gm.unglow(); if (pc) pc.forEach((m) => glow(m, null));
      gm.arrow(I, k, I, J, TRY); gm.arrow(k + 1, J, I, J, TRY);
      if (gm.get(I, k)) glow(gm.get(I, k), GOLD); if (gm.get(k + 1, J)) glow(gm.get(k + 1, J), GOLD);
      if (lvl >= 1 && pc) [I - 1, k, J].forEach((z) => glow(pc[z], GOLD));
      if (!Q[k]) Q[k] = mono(tag('', '', 4.9, 4.9 - (k - I) * 0.55));
      txt(Q[k], qTxt(k, lvl));
      say('k = ' + k + '：' + (I === k ? 'A' + I : 'A' + I + '…A' + k) + ' | ' + (k + 1 === J ? 'A' + J : 'A' + (k + 1) + '…A' + J), qTxt(k, lvl).split(': ')[1]);
    },
    kp: (k) => ops.k(k, 1),
    kparen: (...ks) => { const xs = ks.map((k) => 'k=' + k + '：' + splitStr(I, k, J)); sb(xs.join('　')); say(xs.length > 1 ? '兩種括法' : '這代表的括法', xs.join('、')); },
    kv: (...ks) => {
      cd.hl(7);
      for (const k of ks) { if (!Q[k]) Q[k] = mono(tag('', '', 4.9, 4.9 - (k - I) * 0.55)); txt(Q[k], qTxt(k, 3)); }
      const last = ks[ks.length - 1];
      say(ks.map((k) => qTxt(k, 3).split('= ').pop()).join('、'), '從表裡查值算出來');
      return last;
    },
    min: async () => {
      cd.hl(10); gm.clearArrows(); gm.unglow(); if (pc) pc.forEach((m) => glow(m, null));
      const bk = S.s[I][J];
      for (let k = I; k < J; k++) { if (!Q[k]) Q[k] = mono(tag(qTxt(k, 3), '', 4.9, 4.9 - (k - I) * 0.55)); setCls(Q[k], k === bk ? 'ptr alt' : ''); }
      txt(mL, 'min = ' + S.m[I][J]);
      gm.set(I, J, S.m[I][J], TEAL); gm.mark(I, J);
      gd.mood('happy'); say('m[' + I + '][' + J + '] = ' + S.m[I][J], '最小的是 k = ' + bk);
      await gd.hop(tok);
    },
    sset: () => { cd.hl(8); gs.set(I, J, S.s[I][J], PURPLE); gs.mark(I, J); say('s[' + I + '][' + J + '] = ' + S.s[I][J], '找最小值時順便記下 k'); },
    note: (a, b, bt) => { if (bt !== undefined) sb(bt); say(a, b || ''); },
  };
  // 開場狀態
  if (!P.intro) {
    ensureCode();
    if (P.full) { ensureP(false); ensurePT(); ensureG(); markZero(); for (let i = 1; i < 5; i++) gm.set(i, i, 0, GRAY, 0); }
    for (const [i, j] of P.pre || []) { gm.set(i, j, S.m[i][j], TEAL, 0); gs.set(i, j, S.s[i][j], PURPLE, 0); }
    if (P.d) { D = P.d; dTag = tag('d = ' + D, 'ptr alt', 4.9, 5.95); }
  }
  await runSeq(tok, seq, ops);
}]);

// ═════════ vLS-zRCHo-Y / wAy6nDMPYAE：BST 與搜尋 ═════════
const BST7 = { 40: [0, 6.2, null], 20: [-2.8, 4.9, 40], 60: [2.8, 4.9, 40], 10: [-4.2, 3.6, 20], 30: [-1.4, 3.6, 20], 50: [1.4, 3.6, 60], 70: [4.2, 3.6, 60] };
const BST_EXT = [['−∞~9', -4.9], ['11~19', -3.5], ['21~29', -2.1], ['31~39', -0.7], ['41~49', 0.7], ['51~59', 2.1], ['61~69', 3.5], ['71~∞', 4.9]];
FRAG.push(['dp4bari-bst-search', 'BST 搜尋：成功與失敗', async (tok) => {
  const P = prm(), targets = P.targets || [50, 45];
  fresh([0, 4.2, 13.5], [0, 3.6, 0]);
  const nd = {};
  for (const k of [40, 20, 60, 10, 30, 50, 70]) { const [x, y, par] = BST7[k]; nd[k] = tnode(k, x, y, 0, par ? nd[par] : null, BLUE); }
  for (const k of [10, 30, 50, 70]) for (const s of [-1, 1]) line(BST7[k][0], 3.35, BST7[k][0] + s * 0.7, 2.6, 0, '#c9bfae');
  const ext = BST_EXT.map(([lbl, x]) => { const m = cube('', GRAY, [0.4, 0.4, 0.4], x, 2.4, 0); if (P.ext) tag(lbl, 'idx', x, 1.85); return m; });
  say('左子樹都比較小、右子樹都比較大', '每個節點都成立');
  await beat(tok, 2400);
  if (P.ext) {
    say('方形節點 = 搜尋失敗的落點', 'n = 7 個 key → n + 1 = 8 個 external node');
    for (const m of ext) { glow(m, GOLD); await beat(tok, 250); glow(m, null); }
    await beat(tok, 1200);
  }
  const cur = tag('', 'ptr alt', 0, 7.0);
  for (const t of targets) {
    let k = 40, cnt = 0, x = 0, y = 6.2;
    txt(cur, '找 ' + t);
    while (true) {
      cnt++;
      [x, y] = BST7[k]; cur.position.set(x, y + 0.75, 0); glow(nd[k], GOLD);
      if (t === k) { tint(nd[k], TEAL); glow(nd[k], GREEN); say('找到 ' + t + '：比較 ' + cnt + ' 次', '成功搜尋'); await beat(tok, 2000); tint(nd[k], BLUE); glow(nd[k], null); break; }
      say(t + (t < k ? ' < ' : ' > ') + k + '：往' + (t < k ? '左' : '右'), '第 ' + cnt + ' 次比較');
      await beat(tok, 1100); glow(nd[k], null);
      const kids = Object.keys(BST7).map(Number).filter((c) => BST7[c][2] === k && (t < k ? c < k : c > k));
      if (!kids.length) {
        const ex = ext.reduce((a, m) => (Math.abs(m.position.x - (x + (t < k ? -0.7 : 0.7))) < Math.abs(a.position.x - (x + (t < k ? -0.7 : 0.7))) ? m : a));
        cur.position.set(ex.position.x, 3.0, 0); glow(ex, DRED);
        say('碰到 null：' + t + ' 不在樹裡', '失敗搜尋，比較了 ' + cnt + ' 次');
        await beat(tok, 2200); glow(ex, null); break;
      }
      k = kids[0];
    }
  }
  kill(cur);
  say('比較次數最多 = 樹的層數（高度）', '平衡的 BST 約 log n');
  await beat(tok, 2800);
}]);

const T5 = [
  [[10, -0.75, 1, null], [20, 0, 2, 10], [30, 0.75, 3, 20]],
  [[10, -0.75, 1, null], [30, 0.75, 2, 10], [20, 0, 3, 30]],
  [[20, 0, 1, null], [10, -0.75, 2, 20], [30, 0.75, 2, 20]],
  [[30, 0.75, 1, null], [10, -0.75, 2, 30], [20, 0, 3, 10]],
  [[30, 0.75, 1, null], [20, 0, 2, 30], [10, -0.75, 3, 20]],
];
FRAG.push(['dp4bari-bst5', '3 個 key 的 5 棵 BST：比較成本', async (tok) => {
  const P = prm(), f = P.freq, metric = P.metric || 'avg';
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const cxs = [-5.4, -2.7, 0, 2.7, 5.4], LY = [0, 6.2, 5.0, 3.8];
  if (f) { say('key 10、20、30，搜尋頻率 ' + f.join('、'), '成本 = Σ 層數 × 頻率'); [10, 20, 30].forEach((k, t) => tag(k + '：' + f[t] + ' 次', 'ptr', -2.4 + t * 2.4, 7.4)); }
  else say('同樣 3 個 key：10、20、30', '有幾種 BST？C(6,3)/4 = 5');
  await beat(tok, 2400);
  const costs = [], sums = [];
  for (let t = 0; t < 5; t++) {
    const nodes = {};
    let sum = 0, mx = 0;
    const parts = [];
    for (const [k, dx, lv, par] of T5[t]) {
      const x = cxs[t] + dx, y = LY[lv];
      nodes[k] = tnode(k, x, y, 0, par ? nodes[par] : null, BLUE);
      const fk = f ? f[[10, 20, 30].indexOf(k)] : 1;
      sum += lv * fk; mx = Math.max(mx, lv); parts.push(f ? lv + '×' + fk : String(lv));
      if (f) tag(lv + '×' + fk, 'idx', x + 0.62, y);
    }
    const val = f ? String(sum) : metric === 'height' ? String(mx) : (sum === 6 ? '6/3 = 2' : sum + '/3');
    costs.push(f ? sum : metric === 'height' ? mx : sum); sums.push(nodes);
    tag(val, 'ptr alt', cxs[t], 2.7);
    say('第 ' + (t + 1) + ' 棵：' + (f ? '成本 ' + sum : metric === 'height' ? '最多比較 ' + mx + ' 次' : '平均比較 ' + val), f ? parts.join(' + ') + ' = ' + sum : metric === 'height' ? '= 層數' : '(' + parts.join('+') + ')/3');
    await beat(tok, 2000);
  }
  const best = costs.indexOf(Math.min(...costs));
  Object.values(sums[best]).forEach((m) => glow(m, GREEN));
  if (f) say('最佳：30 當 root，成本 17', '不平衡，但頻率高的 30 放最上面');
  else say('平衡的那棵最好', metric === 'height' ? '高度 2：最多比較 2 次' : '平均 5/3 次比較');
  await beat(tok, 3200);
}]);

// ── Horowitz 形式的 OBST：c(i,j)、w(i,j)、r(i,j)，0 ≤ i ≤ j ≤ n ──
function hobst(p1, q) {
  const n = p1.length, p = [0, ...p1], qq = q || new Array(n + 1).fill(0);
  const w = [], c = [], r = [], steps = [];
  for (let i = 0; i <= n; i++) { w[i] = []; c[i] = []; r[i] = []; w[i][i] = qq[i]; c[i][i] = 0; r[i][i] = 0; }
  for (let d = 1; d <= n; d++) for (let i = 0; i + d <= n; i++) {
    const j = i + d; w[i][j] = w[i][j - 1] + p[j] + qq[j];
    let best = Infinity, bk = 0; const cands = [];
    for (let k = i + 1; k <= j; k++) { const v = c[i][k - 1] + c[k][j]; cands.push({ k, a: c[i][k - 1], b: c[k][j], v }); if (v < best) { best = v; bk = k; } }
    c[i][j] = best + w[i][j]; r[i][j] = bk;
    steps.push({ i, j, d, w: w[i][j], c: c[i][j], r: bk, min: best, cands });
  }
  return { n, p, q: qq, w, c, r, steps };
}
function obGrid(n, layout, x0, y0, cw, ch) {
  const ij = layout !== 'diag';
  const g = grid({ rows: n + 1, cols: n + 1, cw, ch, x0, y0, colHdr: Array.from({ length: n + 1 }, (_, k) => (ij ? 'j=' : 'i=') + k), rowHdr: Array.from({ length: n + 1 }, (_, k) => (ij ? 'i=' : 'j−i=') + k), rowDx: ij ? 0.3 : 0.55 });
  g.at = (i, j) => (ij ? [i, j] : [j - i, i]);
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) if (ij ? b < a : b > n - a) g.mark(a, b, '#ddd2bf');
  return g;
}

FRAG.push(['dp4bari-obst-fill', 'OBST 填表：c(i,j) = min + w(i,j)', async (tok) => {
  const P = prm(), keys = P.keys || [10, 20, 30, 40], layout = P.layout || 'ij', ms = P.ms || 1500;
  const H = hobst(P.p || [4, 2, 6, 3], P.q), n = H.n, showW = layout === 'diag';
  fresh([0, 4.4, 15], [0, 3.8, 0]);
  const cw = 1.15, ch = showW ? 1.0 : 0.85;
  const g = obGrid(n, layout, -4.6, 6.4, cw, ch);
  const extra = {};
  const putTag = (i, j, s) => { const k = i + ',' + j; if (extra[k]) kill(extra[k]); const [a, b] = g.at(i, j), q0 = g.pos(a, b); extra[k] = tag(s, 'idx', q0.x, q0.y - ch * 0.42, 0.4); };
  const info = (i, j, withC) => (showW ? 'w' + H.w[i][j] + (withC ? ' r' + H.r[i][j] : '') : (withC && j > i ? 'r=' + H.r[i][j] : ''));
  const setC = (i, j, drop, color) => { const [a, b] = g.at(i, j); g.set(a, b, H.c[i][j], color || (j === i ? GRAY : TEAL), drop); };
  tag('key ' + keys.join(' '), 'ptr', 4.4, 7.3);
  tag('p ' + H.p.slice(1).join(' '), 'idx', 4.4, 6.8);
  if (P.q) tag('q ' + H.q.join(' '), 'idx', 4.4, 6.35);
  for (let i = 0; i <= n; i++) { setC(i, i, 0); if (showW) putTag(i, i, info(i, i, false)); }
  if (P.wfill) {
    say('對角線：w = qᵢ，c = r = 0', '空樹：沒有 key 可當 root');
    await beat(tok, 2600);
    for (let d = 1; d <= n; d++) {
      for (let i = 0; i + d <= n; i++) { const j = i + d; putTag(i, j, 'w' + H.w[i][j]); }
      const i = 0, j = d;
      say('j − i = ' + d + '：w 整列填好', 'w(' + i + ',' + j + ') = w(' + i + ',' + (j - 1) + ') + p' + j + ' + q' + j + ' = ' + H.w[i][j - 1] + ' + ' + H.p[j] + ' + ' + H.q[j] + ' = ' + H.w[i][j]);
      await beat(tok, 1900);
    }
    say('w(0,' + n + ') = ' + H.w[0][n] + '：全部機率和', '接著由 j − i = 1 開始算 c 和 r');
    await beat(tok, 2800);
    return;
  }
  if (showW) for (const st of H.steps) putTag(st.i, st.j, 'w' + st.w);
  const order = H.steps.map((s) => [s.i, s.j]);
  const { before, anim: cells } = prefillOrder(order, P.cells);
  for (const [i, j] of before) { setC(i, j, 0); putTag(i, j, info(i, j, true)); }
  if (P.cells && P.cells[0][1] - P.cells[0][0] === 1 && !showW) { say('c(i,i) = 0：沒有 key', '對角線先填 0'); await beat(tok, 1800); }
  else { say('c(i,j)：每個 key k 輪流當 root', 'c(i,j) = min{c(i,k−1) + c(k,j)} + w(i,j)，i < k ≤ j'); await beat(tok, 2200); }
  let lines = [], last = null;
  for (const [i, j] of cells) {
    const st = H.steps.find((s) => s.i === i && s.j === j);
    lines.forEach(kill); lines = [];
    const [ta, tb] = g.at(i, j);
    g.mark(ta, tb, '#f3d27a');
    lines.push(mono(tag('w(' + i + ',' + j + ') = ' + st.w, 'ptr', 4.3, 5.6)));
    say('c(' + i + ',' + j + ')：key ' + keys.slice(i, j).join('、'), 'w(' + i + ',' + j + ') = ' + (showW ? 'w(' + i + ',' + (j - 1) + ') + p' + j + ' + q' + j + ' = ' : H.p.slice(i + 1, j + 1).join(' + ') + ' = ') + st.w);
    await beat(tok, ms);
    for (let t = 0; t < st.cands.length; t++) {
      const x = st.cands[t];
      g.clearArrows(); g.unglow();
      const A = g.at(i, x.k - 1), B = g.at(x.k, j);
      g.arrow(A[0], A[1], ta, tb, TRY); g.arrow(B[0], B[1], ta, tb, TRY);
      glow(g.get(A[0], A[1]), GOLD); glow(g.get(B[0], B[1]), GOLD);
      lines.push(mono(tag('k=' + x.k + ': ' + x.a + ' + ' + x.b + ' = ' + x.v, '', 4.3, 5.0 - t * 0.5)));
      say('root = k' + x.k + '（' + keys[x.k - 1] + '）', 'c(' + i + ',' + (x.k - 1) + ') + c(' + x.k + ',' + j + ') = ' + x.a + ' + ' + x.b + ' = ' + x.v);
      await beat(tok, st.cands.length > 2 ? ms * 0.9 : ms);
    }
    g.clearArrows(); g.unglow(); g.mark(ta, tb);
    setCls(lines[1 + st.cands.findIndex((x) => x.k === st.r)], 'ptr alt');
    setC(i, j, 1.4); putTag(i, j, info(i, j, true));
    say('c(' + i + ',' + j + ') = ' + st.min + ' + ' + st.w + ' = ' + st.c, 'r(' + i + ',' + j + ') = ' + st.r + '：key ' + keys[st.r - 1] + ' 當 root');
    await beat(tok, ms);
    last = st;
  }
  if (last && last.i === 0 && last.j === n) {
    const [a, b] = g.at(0, n); g.mark(a, b, '#9fe0c4');
    say('c(0,' + n + ') = ' + last.c + '，root = ' + keys[last.r - 1], P.scale ? last.c + ' / ' + P.scale + ' = ' + fr(last.c / P.scale) + '（機率乘了 ' + P.scale + '）' : '最佳 BST 的總成本');
  }
  await beat(tok, 2800);
}]);

FRAG.push(['dp4bari-obst-two', '兩個 key：兩種樹比成本', async (tok) => {
  const P = prm(), keys = P.keys || [10, 20, 30, 40], f = P.f || [4, 2, 6, 3], pairs = P.pairs || [[1, 2]];
  fresh([0, 4.4, 14], [0, 3.8, 0]);
  for (const [a, b] of pairs) {
    const ka = keys[a - 1], kb = keys[b - 1], fa = f[a - 1], fb = f[b - 1];
    const all = [];
    say('c(' + (a - 1) + ',' + b + ')：key ' + ka + '、' + kb, '頻率 ' + fa + '、' + fb + '；兩種 BST');
    await beat(tok, 1800);
    const r1 = tnode(ka, -3, 5.8, 0, null, BLUE), c1 = tnode(kb, -2.0, 4.5, 0, r1, BLUE);
    all.push(r1, c1, r1.userData.edge, c1.userData.edge, tag('1×' + fa, 'idx', -3.75, 5.8), tag('2×' + fb, 'idx', -1.25, 4.5));
    const v1 = fa + 2 * fb; all.push(tag(String(v1), 'ptr alt', -2.5, 3.3));
    say('k' + a + '（' + ka + '）當 root', '1×' + fa + ' + 2×' + fb + ' = ' + v1);
    await beat(tok, 2000);
    const r2 = tnode(kb, 3, 5.8, 0, null, BLUE), c2 = tnode(ka, 2.0, 4.5, 0, r2, BLUE);
    all.push(r2, c2, c2.userData.edge, tag('1×' + fb, 'idx', 3.75, 5.8), tag('2×' + fa, 'idx', 1.25, 4.5));
    const v2 = fb + 2 * fa; all.push(tag(String(v2), 'ptr alt', 2.5, 3.3));
    say('k' + b + '（' + kb + '）當 root', '1×' + fb + ' + 2×' + fa + ' = ' + v2);
    await beat(tok, 2000);
    const win = v1 <= v2 ? [r1, c1] : [r2, c2];
    win.forEach((m) => glow(m, GREEN));
    say('c(' + (a - 1) + ',' + b + ') = ' + Math.min(v1, v2) + '，r = ' + (v1 <= v2 ? a : b), '頻率大的放 root');
    await beat(tok, 2200);
    if (P.formula) {
      const w = fa + fb;
      all.push(mono(tag('c(' + (a - 1) + ',' + (a - 1) + ') + c(' + a + ',' + b + ') + w = 0 + ' + fb + ' + ' + w + ' = ' + v1, '', 0, 2.2)));
      say('公式驗證：root = k' + a, 'w(' + (a - 1) + ',' + b + ') = ' + fa + ' + ' + fb + ' = ' + w);
      await beat(tok, 2400);
      all.push(mono(tag('c(' + (a - 1) + ',' + a + ') + c(' + b + ',' + b + ') + w = ' + fa + ' + 0 + ' + w + ' = ' + v2, '', 0, 1.6)));
      say('root = k' + b + '：也對得上', '同一個公式，答案一樣');
      await beat(tok, 2400);
    }
    if (pairs.length > 1) { all.forEach((m) => { if (m) kill(m); }); await beat(tok, 400); }
  }
  await beat(tok, 1600);
}]);

FRAG.push(['dp4bari-obst-build', '用 r 表建出最佳 BST', async (tok) => {
  const P = prm(), keys = P.keys || [10, 20, 30, 40], layout = P.layout || 'ij';
  const H = hobst(P.p || [4, 2, 6, 3], P.q), n = H.n;
  fresh([0, 4.4, 15], [0, 3.8, 0]);
  const g = obGrid(n, layout, -5.3, 6.3, 0.72, 0.62);
  tag('r 表', 'ptr', -4.0, 7.3);
  for (let i = 0; i <= n; i++) for (let j = i; j <= n; j++) { const [a, b] = g.at(i, j); g.set(a, b, H.r[i][j], j === i ? GRAY : PURPLE, 0); }
  say('r(0,' + n + ') 是整棵樹的 root', 'root k 的左邊 (i, k−1)、右邊 (k, j)');
  await beat(tok, 2400);
  const xk = (k) => 0.6 + (k - 1) * 1.5;
  async function build(i, j, d, par) {
    if (i === j) {
      if (par) { const xx = par.x + (i < par.k ? -0.55 : 0.55); line(par.x, par.y - 0.25, xx, par.y - 1.0); cube('', GRAY, [0.3, 0.3, 0.3], xx, par.y - 1.1, 0); }
      return;
    }
    const k = H.r[i][j], x = xk(k), y = 6.4 - d * 1.35;
    const [a, b] = g.at(i, j); g.mark(a, b, '#f3d27a'); glow(g.get(a, b), GOLD);
    const nd = tnode(keys[k - 1], x, y, 0, par ? par.m : null, BLUE);
    say('r(' + i + ',' + j + ') = ' + k + ' → ' + keys[k - 1], '左 (' + i + ',' + (k - 1) + ')、右 (' + k + ',' + j + ')');
    await beat(tok, 1700);
    glow(g.get(a, b), null);
    const me = { x, y, k, m: nd };
    await build(i, k - 1, d + 1, me); await build(k, j, d + 1, me);
  }
  await build(0, n, 0, null);
  say('最佳 BST：root ' + keys[H.r[0][n] - 1], P.scale ? '成本 ' + H.c[0][n] + ' / ' + P.scale + ' = ' + fr(H.c[0][n] / P.scale) : '總成本 c(0,' + n + ') = ' + H.c[0][n]);
  await beat(tok, 3000);
}]);

FRAG.push(['dp4bari-obst-prob', '成功機率 pᵢ 與失敗機率 qᵢ', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.0, 0]);
  const keys = [10, 20, 30, 40], p = [0.1, 0.2, 0.1, 0.2], q = [0.1, 0.05, 0.15, 0.05, 0.05];
  const rng = ['−∞~9', '11~19', '21~29', '31~39', '41~∞'];
  say('4 個 key → 5 個方形節點', 'n 個 key 有 n + 1 個失敗區間');
  const xs = (t) => -5.6 + t * 1.4;
  for (let t = 0; t <= 8; t++) {
    const isKey = t % 2 === 1, idx = (t - (isKey ? 1 : 0)) / 2;
    const x = xs(t);
    if (isKey) { cube(keys[idx], BLUE, [0.9, 0.6, 0.6], x, 0.3, 0, 1.2); tag('p' + (idx + 1), 'idx', x, -0.25 + 0.0, 0.8); }
    else { cube('', GRAY, [0.6, 0.45, 0.45], x, 0.22, 0, 1.2); tag(rng[idx], 'idx', x, 0.9); tag('q' + idx, 'idx', x, -0.25, 0.8); }
    await beat(tok, 350);
  }
  await beat(tok, 1600);
  say('pᵢ：搜尋 key i 的機率', 'qᵢ：要找的值落在兩個 key 之間（失敗）');
  await beat(tok, 2600);
  const H = (v) => v * 18;
  for (let t = 0; t <= 8; t++) {
    const isKey = t % 2 === 1, idx = (t - (isKey ? 1 : 0)) / 2, v = isKey ? p[idx] : q[idx];
    const m = cube('', isKey ? TEAL : ORANGE, [0.5, 1, 0.5], xs(t), 1.4, -0.6); m.scale.y = 0.001;
    await anim(tok, 350, (u) => { m.scale.y = Math.max(0.001, H(v) * u); m.position.y = 1.4 + H(v) * u / 2; });
    tag(String(v), 'ptr alt', xs(t), 1.75 + H(v), -0.6);
  }
  say('像店裡的商品：常賣的放櫃台', '常被問但沒有的，也要很快回答「沒有」');
  await beat(tok, 2800);
  say('Σpᵢ + Σqᵢ = 1', '0.6 + 0.4 = 1');
  await beat(tok, 2800);
}]);

FRAG.push(['dp4bari-obst-cost21', '一棵 BST 的期望成本 = 2.1', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.6, 0]);
  const L = { 20: [0, 6.4, null, 1, 0.2], 10: [-2.6, 5.0, 20, 2, 0.1], 30: [2.6, 5.0, 20, 2, 0.1], 40: [4.2, 3.6, 30, 3, 0.2] };
  const nd = {};
  for (const k of [20, 10, 30, 40]) { const [x, y, par] = L[k]; nd[k] = tnode(k, x, y, 0, par ? nd[par] : null, BLUE); }
  const E = [['E0', -3.4, 3.6, -2.6, 5.0, 3, 0.1], ['E1', -1.8, 3.6, -2.6, 5.0, 3, 0.05], ['E2', 1.8, 3.6, 2.6, 5.0, 3, 0.15], ['E3', 3.4, 2.2, 4.2, 3.6, 4, 0.05], ['E4', 5.0, 2.2, 4.2, 3.6, 4, 0.05]];
  const em = E.map(([lbl, x, y, px, py]) => { line(px, py - 0.4, x, y + 0.25, 0, '#c9bfae'); return cube(lbl, GRAY, [0.55, 0.42, 0.42], x, y, 0); });
  [1, 2, 3, 4].forEach((lv) => tag('level ' + lv, 'idx', -6.0, [0, 6.4, 5.0, 3.6, 2.2][lv]));
  say('key 的成本：層數 × pᵢ', '方形節點：(層數 − 1) × qᵢ，到那裡不用再比');
  await beat(tok, 2800);
  const sumL = tag('cost = 0', 'ptr alt', -3.6, 1.0, 0.6);
  let sum = 0;
  for (const k of [20, 10, 30, 40]) {
    const [x, y, , lv, pv] = L[k]; glow(nd[k], GOLD); sum += lv * pv;
    tag(lv + '×' + pv, 'idx', x + 0.75, y + 0.3); txt(sumL, 'cost = ' + fr(sum));
    say('key ' + k + '：level ' + lv + ' × ' + pv, '= ' + fr(lv * pv));
    await beat(tok, 1300); glow(nd[k], null);
  }
  for (let t = 0; t < E.length; t++) {
    const [lbl, x, y, , , lv, qv] = E[t]; glow(em[t], GOLD); sum += (lv - 1) * qv;
    tag((lv - 1) + '×' + qv, 'idx', x, y - 0.45); txt(sumL, 'cost = ' + fr(sum));
    say(lbl + '：level ' + lv + '，算 ' + (lv - 1) + ' × ' + qv, '= ' + fr((lv - 1) * qv));
    await beat(tok, 1200); glow(em[t], null);
  }
  say('這棵樹的期望成本 = 2.1', 'Σ pᵢ·level(aᵢ) + Σ qᵢ·(level(Eᵢ) − 1)');
  await beat(tok, 3200);
}]);

FRAG.push(['dp4bari-obst-expand', '展開 c(0,3) 與 w 的遞迴', async (tok) => {
  const part = prm().part || 0;
  fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  if (part !== 2) {
    await exTree(tok, { nm: 'c', mc: false, i0: 0, j0: 3, exp: [1, 3], rep: [2, 3] });
    if (part === 1) return;
    fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  }
  say('w(i,j) 要算很多次', 'w(i,j) = q_i + Σ(p + q)：找遞迴關係');
  const seq = ['q0', 'p1', 'q1', 'p2', 'q2', 'p3', 'q3'];
  const xs = (t) => -4.8 + t * 1.5;
  seq.forEach((s, t) => cube(s, s[0] === 'p' ? TEAL : GRAY, [0.9, 0.55, 0.5], xs(t), 3.0, 0, 1.2));
  await beat(tok, 2200);
  const g1 = ghostBox(BLUE, 1.5 * 5, 1.0, 0.9); g1.position.set((xs(0) + xs(4)) / 2, 3.0, 0);
  tag('w(0,2)', 'ptr', (xs(0) + xs(4)) / 2, 4.0);
  say('w(0,2)：key 1、2 這一段', 'w(0,2) = q0 + p1 + q1 + p2 + q2');
  await beat(tok, 2200);
  const g2 = ghostBox(ORANGE, 1.5 * 7 + 0.2, 1.3, 1.1); g2.position.set((xs(0) + xs(6)) / 2, 3.0, 0);
  tag('w(0,3)', 'ptr alt', (xs(0) + xs(6)) / 2, 4.6);
  say('w(0,3) 只多了 p3 + q3', 'w(i,j) = w(i,j−1) + p_j + q_j');
  await beat(tok, 3000);
  say('每格要記：w、c、root r', 'r = 取到 min 的 k');
  await beat(tok, 2800);
}]);

// ═════════ uJOmqBwENB8：Reliability design ═════════
FRAG.push(['dp4bari-rel-series', '串聯系統：可靠度相乘', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.6, 0]);
  line(-6.6, 2.6, 6.6, 2.6, 0, '#6e5f49');
  const ds = [];
  for (let k = 0; k < 4; k++) { const x = -4.5 + k * 3; ds.push(cube('D' + (k + 1), BLUE, [1.3, 0.9, 0.9], x, 2.6, 0, 1.5)); tag('c' + (k + 1) + '、r=0.9', 'idx', x, 1.7); await beat(tok, 450); }
  say('系統 = 裝置 D1…D4 串聯', '每個裝置有 cost cᵢ 和 reliability rᵢ');
  await beat(tok, 2600);
  const pl = tag('R = 1', 'ptr alt', 0, 5.2);
  const cur = tag('●', 'ptr', -6.2, 3.3);
  let R = 1;
  for (let k = 0; k < 4; k++) {
    cur.position.set(-4.5 + k * 3, 3.3, 0); glow(ds[k], GOLD);
    R *= 0.9; txt(pl, 'R = 0.9^' + (k + 1) + ' = ' + fr(R));
    say('經過 D' + (k + 1) + '：再乘 0.9', 'R = ' + fr(R));
    await beat(tok, 1300); glow(ds[k], null);
  }
  kill(cur);
  tint(ds[2], RED); glow(ds[2], DRED);
  say('任何一個壞掉，系統就停', '每個 0.9，系統只有 0.6561');
  await beat(tok, 2600);
  say('約 35% 機率系統失敗', '要提高整體 reliability');
  await beat(tok, 2800);
}]);

FRAG.push(['dp4bari-rel-stage', '一個 stage 放多份並聯：1 − (1−r)^m', async (tok) => {
  const P = prm(), r = P.r || 0.9, m = P.m || 3;
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const ys = Array.from({ length: m }, (_, k) => 5.8 - k * 1.4);
  line(-5.5, 3.6 + 0, -2.5, 3.6, 0, '#6e5f49'); line(2.5, 3.6, 5.5, 3.6, 0, '#6e5f49');
  line(-2.5, ys[0], -2.5, ys[m - 1]); line(2.5, ys[0], 2.5, ys[m - 1]);
  const cs = ys.map((y, k) => { line(-2.5, y, 2.5, y, 0, '#6e5f49'); return cube('D1 #' + (k + 1), BLUE, [1.5, 0.8, 0.8], 0, y, 0, 1.4); });
  say('同一個 stage 放 ' + m + ' 份 D1 並聯', '一份壞了，另一份頂上');
  await beat(tok, 2600);
  say('每份正常：' + r + '，壞掉：' + fr(1 - r), '1 − r₁ = ' + fr(1 - r));
  await beat(tok, 2200);
  for (const c of cs) { tint(c, RED); glow(c, DRED); await beat(tok, 700); }
  const fail = Math.pow(1 - r, m);
  say(m + ' 份全壞：' + fr(1 - r) + '^' + m + ' = ' + fr(fail), '機率很小');
  await beat(tok, 2400);
  cs.forEach((c) => { tint(c, TEAL); glow(c, null); });
  tag('stage = ' + fr(1 - fail), 'ptr alt', 0, 7.0);
  say('stage = 1 − (1 − r)^m', '1 − ' + fr(fail) + ' = ' + fr(1 - fail) + '，比 ' + r + ' 高很多');
  await beat(tok, 3000);
  say('代價：要多花錢買副本', '預算有限 → 每種買幾份？');
  await beat(tok, 2600);
}]);

const RD = { c: [30, 15, 20], r: [0.9, 0.8, 0.5], C: 105, u: [2, 3, 3] };
FRAG.push(['dp4bari-rel-bound', '預算 105：每種裝置最多幾份 uᵢ', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.0, 0]);
  const sc = 11 / RD.C, x0 = -5.5;
  for (let k = 0; k < 3; k++) { cube('D' + (k + 1), [BLUE, PURPLE, ORANGE][k], [1.4, 0.8, 0.8], -3 + k * 3, 6.2, 0, 1.4); tag('\u0024' + RD.c[k] + '、r=' + RD.r[k], 'idx', -3 + k * 3, 5.5); }
  say('3 種裝置，總預算 C = \u0024105', 'c = 30、15、20；r = 0.9、0.8、0.5');
  await beat(tok, 2800);
  let x = x0;
  for (let k = 0; k < 3; k++) { const w = RD.c[k] * sc; cube('\u0024' + RD.c[k], [BLUE, PURPLE, ORANGE][k], [w - 0.05, 0.6, 0.8], x + w / 2, 3.0, 0, 1.2); x += w; await beat(tok, 500); }
  const rest = RD.C - 65, rw = rest * sc;
  const restM = cube('剩 \u0024' + rest, GRAY, [rw - 0.05, 0.6, 0.8], x + rw / 2, 3.0, 0, 1.2);
  say('每種至少買 1 份：\u002465', '105 − 65 = 剩 \u002440 可以買副本');
  await beat(tok, 2800);
  for (let k = 0; k < 3; k++) {
    const extra = Math.floor(rest / RD.c[k]);
    glow(restM, GOLD);
    const ms = [];
    for (let t = 0; t < extra; t++) ms.push(cube('', [BLUE, PURPLE, ORANGE][k], [RD.c[k] * sc - 0.08, 0.4, 0.6], x + (t + 0.5) * RD.c[k] * sc, 1.6, 0, 1.2));
    tag('u' + (k + 1) + ' = ' + RD.u[k], 'ptr alt', -3 + k * 3, 7.1);
    say('D' + (k + 1) + '：40 全花在它，多 ' + extra + ' 份', 'u' + (k + 1) + ' = ⌊40 / ' + RD.c[k] + '⌋ + 1 = ' + RD.u[k]);
    await beat(tok, 2200);
    ms.forEach((m) => fly(m));
    glow(restM, null);
  }
  say('uᵢ = ⌊(C − Σcⱼ) / cᵢ⌋ + 1', '上限 2、3、3');
  await beat(tok, 3000);
}]);

function relStages() {
  let S = [{ r: 1, c: 0, prev: null, m: 0 }];
  const out = [];
  for (let s = 0; s < 3; s++) {
    const rest = RD.c.slice(s + 1).reduce((a, b) => a + b, 0), rows = [];
    let all = [];
    for (let m = 1; m <= RD.u[s]; m++) {
      const rr = 1 - Math.pow(1 - RD.r[s], m), cc = m * RD.c[s];
      const prs = S.map((x) => ({ r: x.r * rr, c: x.c + cc, ok: x.c + cc + rest <= RD.C, m, prev: x }));
      rows.push({ m, rr, cc, prs }); all = all.concat(prs.filter((z) => z.ok));
    }
    const sorted = all.slice().sort((a, b) => a.c - b.c || b.r - a.r), keep = [], drop = [];
    for (const z of sorted) { if (keep.length && z.r <= keep[keep.length - 1].r) { z.by = keep.find((k) => k.r >= z.r); drop.push(z); } else keep.push(z); }
    out.push({ s: s + 1, rest, rows, all, sorted, keep, drop, prev: S });
    S = keep;
  }
  return out;
}
const pr = (z) => '(' + fr(z.r) + ', ' + z.c + ')';
FRAG.push(['dp4bari-rel-sets', 'Reliability design：(r, cost) 有序對集合', async (tok) => {
  const step = prm().step || 2;
  fresh([0, 4.4, 15], [0, 3.8, 0]);
  const ST = relStages();
  const col = (title, list, x, cls, drop) => { tag(title, cls || 'ptr', x, 7.3); return list.map((z, t) => { const m = cube(pr(z), TEAL, [1.75, 0.45, 0.4], x, 6.5 - t * 0.7, 0, drop ? 1.2 : 0); m.userData.z = z; return m; }); };
  if (step === 1 || step === 2 || step === 4) {
    const s = { 1: 0, 2: 1, 4: 2 }[step], stg = ST[s];
    col('S' + (stg.s - 1), stg.prev, -5.6);
    say(step === 1 ? 'S0 = {(1, 0)}：還沒買' : '上一步的集合 S' + (stg.s - 1), step === 1 ? 'r 用乘的，所以從 1 開始' : '每一對都要配這個裝置的份數');
    await beat(tok, 2400);
    for (const row of stg.rows) {
      const y = 6.5 - (row.m - 1) * 1.9;
      tag('D' + stg.s + ' × ' + row.m + '：r = ' + fr(row.rr) + '，\u0024' + row.cc, 'ptr', 1.2, y + 0.55);
      say('D' + stg.s + ' 買 ' + row.m + ' 份：r = ' + fr(row.rr), row.m === 1 ? 'cost \u0024' + row.cc : '1 − (1 − ' + RD.r[s] + ')^' + row.m + ' = ' + fr(row.rr) + '，\u0024' + row.cc);
      await beat(tok, 1500);
      for (let t = 0; t < row.prs.length; t++) {
        const z = row.prs[t], x = -1.6 + t * 2.0;
        if (!z.ok) {
          const m = cube('\u0024' + z.c, RED, [1.75, 0.45, 0.4], x, y, 0, 1.2); glow(m, DRED);
          say('\u0024' + z.c + (stg.rest ? ' + 還要買 D3 \u0024' + stg.rest : '') + ' > 105', '不可行：直接刪掉，不用算 r');
          await beat(tok, 1300); fly(m); continue;
        }
        cube(pr(z), TEAL, [1.75, 0.45, 0.4], x, y, 0, 1.2);
        say('r 相乘、cost 相加', fr(z.prev.r) + ' × ' + fr(row.rr) + ' = ' + fr(z.r) + '；' + z.prev.c + ' + ' + row.cc + ' = ' + z.c);
        await beat(tok, 1100);
      }
    }
    if (step === 1) { col('S1', stg.keep, 5.9, 'ptr alt', true); say('S1 有兩對', 'S1 = {(0.9, 30), (0.99, 60)}，像 0/1 knapsack 的集合法'); }
    else say('合併得到 S' + stg.s + ' 的候選', '下一步：用 dominance rule 刪除');
    await beat(tok, 2800);
    return;
  }
  if (step === 3 || step === 5) {
    const stg = ST[step === 3 ? 1 : 2];
    say('依 cost 排好 S' + stg.s, 'cost 增加，r 也要增加');
    const ms = stg.sorted.map((z, t) => { const m = cube(pr(z), TEAL, [1.9, 0.45, 0.4], -2.5, 6.6 - t * 0.75, 0, 1.2); m.userData.z = z; return m; });
    await beat(tok, 2400);
    for (let t = 1; t < ms.length; t++) {
      const z = ms[t].userData.z;
      glow(ms[t], GOLD); glow(ms[t - 1], GOLD);
      if (z.by) {
        const bm = ms.find((m) => m.userData.z === z.by);
        glow(ms[t], DRED); tint(ms[t], RED); glow(bm, GREEN);
        say(pr(z) + ' 被支配', pr(z.by) + ' 更便宜、r 更高 → 刪');
        await beat(tok, 2000); fly(ms[t]); glow(bm, null);
      } else { say(pr(z) + ' 保留', 'cost 增加、r 也增加'); await beat(tok, 1000); glow(ms[t], null); }
      glow(ms[t - 1], null);
    }
    const res = col('S' + stg.s, stg.keep, 3.6, 'ptr alt', true);
    if (step === 5) { const best = res[res.length - 1]; glow(best, GREEN); say('最大 reliability 0.648', '成本 \u0024100 ≤ 105'); }
    else say('S2 剩 3 對', '(0.792, 75) 被 (0.864, 60) 支配');
    await beat(tok, 3000);
    return;
  }
  // step 6：回溯
  const cols = ST.map((stg, s) => col('S' + stg.s, stg.keep, -4.6 + s * 4.6));
  say('從最後的 (0.648, 100) 往回找', '它是怎麼乘出來的？');
  await beat(tok, 2200);
  let z = ST[2].keep[ST[2].keep.length - 1];
  for (let s = 2; s >= 0; s--) {
    const m = cols[s].find((q) => q.userData.z === z);
    glow(m, GREEN);
    tag('D' + (s + 1) + ' × ' + z.m, 'ptr alt', m.position.x, m.position.y - 0.45, 0.4);
    say('D' + (s + 1) + ' 買 ' + z.m + ' 份', fr(z.prev.r) + ' × ' + fr(1 - Math.pow(1 - RD.r[s], z.m)) + ' = ' + fr(z.r));
    await beat(tok, 2000);
    if (s > 0) { const pm = cols[s - 1].find((q) => q.userData.z === z.prev); arrow(V3(m.position.x - 0.9, m.position.y, 0.3), V3(pm.position.x + 0.9, pm.position.y, 0.3)); }
    z = z.prev;
  }
  say('D1×1、D2×2、D3×2', '0.9 × 0.96 × 0.75 = 0.648，\u002430 + 30 + 40 = 100');
  await beat(tok, 3200);
}]);

FRAG.push(['dp4bari-obst-brute', '暴力法：BST 的數量爆炸', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.4, 0]);
  say('Optimal BST：期望成本最小的樹', '給定 key 與成功、失敗機率');
  await beat(tok, 2400);
  for (let n = 1; n <= 9; n++) {
    const v = catalan(n + 1), h = 0.3 + Math.log10(v) * 1.2, x = -5.2 + (n - 1) * 1.3;
    const m = cube('', n === 4 ? ORANGE : BLUE, [0.9, 1, 0.9], x, 0, 0); m.scale.y = h; m.position.y = h / 2;
    tag(n + ' 個 key', 'idx', x, 0, 0.9); tag(String(v), n === 4 ? 'ptr alt' : 'idx', x, h + 0.35);
    say(n + ' 個 key：' + v + ' 棵 BST', '(2n C n)/(n+1)，高度用對數尺度');
    await beat(tok, n === 4 ? 1800 : 600);
  }
  say('40 個 key：約 2.6×10²¹ 棵', '一棵一棵畫出來算成本，不可能');
  await beat(tok, 2800);
  say('DP：不直接列舉，間接試過全部', '小範圍的最佳解存起來，大範圍直接拿來用');
  await beat(tok, 3200);
}]);
  }

  // ═══ dp4mit.js ═══
  {
// ─── MIT 6.006 Fall 2011：L22 tp4_UXaVyx8（DP IV：Guitar Fingering, Tetris, Super Mario Bros.）、Rec22 PptQgy89cN8（DDR） ───
// 只用 K 與 ctx。老師的例子：五步驟、knapsack 多記剩餘容量、DP(i, f) = min_g DP(i+1, g) + d(i, f, i+1, g)、
// n×F 的 DAG（完全二分 + 0 權重 source）、Θ(nF²)、(手指, 弦) → nF²S²、和弦 pose (F+1)^F、
// Tetris skyline (h+1)^w × 4w 種放法、Mario configuration c^{wh}·S·T；DDR 譜 ↑ ↑↓ ↓ ↑↓ ↑ ↑↓ ←→ ← ←→ →、
// δ(from, to) ∈ [0, 1]、腳位 25 / 50 / 75、空白 note ○、(i, L, R) → (i+1, Lj, Rj)、source / sink 0 權重、DAG shortest path。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say;
// 每一拍放慢 1.5 倍，讓每個場景落在 15–25 秒
const beat = (tok, ms) => ctx.beat(tok, ms * 1.5);
const Q = { blue: '#4b9ee2', teal: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', brown: '#6e5f49', gold: '#c08a1f', key: '#f4efe4', ink: '#3a3328' };
const qBox = (t, c, x, y, w = 0.8, h = 0.8, d = 0.5, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const qX = (n, gap, cx = 0) => (i) => cx - (n - 1) * gap / 2 + i * gap;
// C columns × R rows of small node cubes; returns { g[c][r], X(c), Y(r) }
function qGrid(C, R, dx, dy, cx, cy, color, lf, s = 0.5) {
  const X = qX(C, dx, cx), Y = (r) => cy + (R - 1) * dy / 2 - r * dy, g = [];
  for (let c = 0; c < C; c++) { g[c] = []; for (let r = 0; r < R; r++) g[c][r] = qBox(lf ? lf(c, r) : '', color || Q.sand, X(c), Y(r), s, s, 0.3); }
  return { g, X, Y };
}
const qOff = (G) => G.g.forEach((col) => col.forEach((m) => glow(m, null)));
// guitar fretboard: 6 strings (1 on top … 6 at the bottom), frets 0…nf
function qFret(nf, x0, w, yTop, dy) {
  const fx = (j) => x0 + j * w, sy = (k) => yTop - (k - 1) * dy;
  for (let k = 1; k <= 6; k++) { line(fx(0), sy(k), fx(nf), sy(k), 0, Q.brown); tag(String(k), 'idx', fx(0) - 0.45, sy(k)); }
  for (let j = 0; j <= nf; j++) line(fx(j), sy(1) + 0.15, fx(j), sy(6) - 0.15, 0, j === 0 ? Q.ink : Q.sand);
  for (let j = 1; j <= nf; j++) if (j % 2 === 1 || j === nf) tag(String(j), 'idx', fx(j) - w / 2, sy(6) - 0.5);
  return { at: (k, j) => V3(j === 0 ? fx(0) - 0.25 : fx(j) - w / 2, sy(k), 0.25), fx, sy };
}
// DDR pad (upright): ↑ ↓ ← → and centre ·
const QDIR = { U: '↑', D: '↓', L: '←', R: '→', C: '·' };
function qPad(cx, cy, s = 1.0, big = 0.8) {
  const P = { U: [cx, cy + s], D: [cx, cy - s], L: [cx - s, cy], R: [cx + s, cy], C: [cx, cy] }, m = {};
  for (const k in P) m[k] = qBox(QDIR[k], k === 'C' ? Q.paper : Q.sand, P[k][0], P[k][1], big, big, 0.16);
  return { P, m };
}
function qFeet(pad, l, r) {
  const at = (k, dx) => [pad.P[k][0] + dx, pad.P[k][1]];
  const a = at(l, l === r ? -0.18 : 0), b = at(r, l === r ? 0.18 : 0);
  const L = qBox('L', Q.pink, a[0], a[1], 0.36, 0.36, 0.3, 0, 0.3), R = qBox('R', Q.blue, b[0], b[1], 0.36, 0.36, 0.3, 0, 0.3);
  return { L, R, put(l2, r2) { const p = at(l2, l2 === r2 ? -0.18 : 0), q = at(r2, l2 === r2 ? 0.18 : 0); move(L, p[0], p[1], 0.3); move(R, q[0], q[1], 0.3); } };
}

// ════════════════ tp4_UXaVyx8（MIT 6.006 L22：DP IV） ════════════════

// 00:42 五步驟複習
FRAG.push(['dp4mit-five-steps', 'DP 五步驟：子問題、猜、遞迴、建 DP、原問題', async (tok) => {
  fresh([0, 3.6, 13], [0, 3, 0]);
  const S = ['1. 定義子問題 subproblems', '2. 猜 guess（試所有可能）', '3. 遞迴式 recurrence', '4. memo 遞迴 / bottom-up', '5. 解原問題'];
  const cd = code(S, -1.6, 6.2, 0.8);
  const caps = [['第一步：定義子問題', 'suffix / prefix / substring 最常見'], ['第二步：猜一個特徵', '不知道就全部試'],
    ['第三步：用猜測寫遞迴式', '取 min / max，把子問題連起來'], ['第四步：memo 或 bottom-up', '遞迴要 acyclic；bottom-up 要拓撲順序'],
    ['第五步：解原問題', '通常是某個子問題，有時要看好幾個']];
  for (let i = 0; i < 5; i++) {
    cd.hl(i); say(caps[i][0], caps[i][1]);
    qBox(String(i + 1), i === 3 ? Q.orange : Q.teal, 4.4, 0.4 + i * 0.85, 1.2, 0.7, 0.7, 2.5);
    await beat(tok, 2300);
  }
  cd.hl(-1);
  tag('總時間 = #子問題 × 每個子問題的時間', 'ptr alt', 0, 1.2, 0.6);
  say('總時間怎麼算？', '#subproblems × time / subproblem');
  await beat(tok, 3000);
}]);

// 01:33 兩種猜法：knapsack 的子問題多記剩餘容量
FRAG.push(['dp4mit-knap-remember', '第二種猜：子問題多記一點（knapsack 的容量）', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.8, 0]);
  const X = qX(6, 1.2, -0.6);
  const it = [1, 2, 3, 4, 5, 6].map((v, i) => qBox('i' + v, Q.blue, X(i), 5.6, 0.85, 0.7, 0.6, 1.5));
  tag('背包容量 S', 'ptr', 5.6, 5.6);
  say('一般的猜：猜用哪個子問題', '遞迴式裡對選項取 min / max');
  await beat(tok, 2600);
  say('Knapsack：物品有 size、value', 'suffix i… 是最直覺的子問題');
  const gb = ghostBox(Q.gold, 4 * 1.2, 1.1, 0.9); gb.position.set((X(2) + X(5)) / 2, 5.6, 0);
  for (let i = 2; i < 6; i++) glow(it[i], GOLD);
  await beat(tok, 2600);
  tint(it[0], GRAY); tint(it[1], GRAY);
  const qm = tag('用掉多少容量？', 'ptr alt', (X(0) + X(1)) / 2, 6.7);
  say('只記 suffix 不夠', '跳過的前綴用掉多少容量不知道');
  await beat(tok, 2800);
  kill(qm);
  say('每個 suffix 再乘 S+1 種剩餘容量', 'DP(i, X)：剩 X 單位時的最佳值');
  for (let x = 0; x <= 4; x++) {
    qBox('X=' + (4 - x), Q.teal, (X(2) + X(5)) / 2, 0.5 + x * 0.75, 2.4, 0.6, 0.5, 1.4);
    await beat(tok, 450);
  }
  tag('同一個 suffix 解 S+1 次', 'idx', 4.2, 2.2);
  await beat(tok, 1600);
  say('第二種猜：子問題多記住過去', '加更多子問題 = 記住解的更多特徵');
  await beat(tok, 3000);
}]);

// 05:25 指法問題：n 個音、手指 1…F、難度 d(p, f, q, g)
FRAG.push(['dp4mit-finger-d', '鋼琴指法：難度 d(p, f, q, g)', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.4, 0]);
  const KX = qX(12, 0.82);
  const keys = KX ? Array.from({ length: 12 }, (_, i) => qBox('', Q.key, KX(i), 0.6, 0.74, 1.2, 0.5)) : [];
  const FX = qX(5, 0.9, 0), fing = [1, 2, 3, 4, 5].map((v, i) => qBox(v, Q.orange, FX(i), 4.8, 0.6, 0.6, 0.4, 1.5));
  tag('手指 1…F', 'idx', 3.4, 4.8);
  say('給 n 個音，每個音指定一根手指', '手指編號 1…F（右手：F = 5）');
  await beat(tok, 2800);
  const p = 3, q = 6;
  tag('p', 'ptr', KX(p), 1.7); tag('q', 'ptr', KX(q), 1.7);
  glow(keys[p], GOLD); move(fing[0], KX(p), 1.6);
  say('用手指 f = 1 彈音 p', 'p 是 pitch');
  await beat(tok, 2000);
  glow(keys[q], GOLD); move(fing[2], KX(q), 1.6);
  const a = arrow(V3(KX(p), 2.3, 0.3), V3(KX(q), 2.3, 0.3), Q.gold);
  const dl = tag('d(p, f, q, g)', 'ptr alt', (KX(p) + KX(q)) / 2, 3.0);
  say('轉換難度 d(p, f, q, g)', 'f 彈 p → 換 g 彈 q 有多難');
  await beat(tok, 3000);
  kill(a); move(fing[2], FX(2), 4.8); glow(keys[q], null);
  const q2 = 11; glow(keys[q2], GOLD); move(fing[1], KX(q2), 1.6);
  say('p 比 q 小很多：stretch，難', '要拉開就用相距遠的手指');
  txt(dl, 'stretch：d 大');
  await beat(tok, 2600);
  move(fing[1], FX(1), 4.8); glow(keys[q2], null);
  say('legato：同一根手指不能連奏', 'f = g 時，p 必須等於 q');
  txt(dl, 'f = g ⇒ p = q');
  await beat(tok, 2600);
  move(fing[0], FX(0), 4.8); glow(keys[p], null);
  glow(fing[2], RED); glow(fing[3], RED); txt(dl, '3 ↔ 4：盡量避免');
  say('弱手指：3 和 4 之間的轉換很彆扭', 'd 是一張大表，數字照自己習慣填');
  await beat(tok, 3000);
}]);

// 09:53 老師的吉他示範：空弦 → 第 5 弦第 1 格（食指）→ 底弦第 3 格（中指）
FRAG.push(['dp4mit-guitar-demo', '吉他示範：哪根手指按哪一格', async (tok) => {
  fresh([0, 3, 13], [0, 2.8, 0]);
  const F = qFret(6, -4.8, 1.5, 5.2, 0.62);
  say('吉他單音：每個音也要決定手指', '弦 1 在上、弦 6（底弦）在下');
  await beat(tok, 2400);
  const o = [5, 4].map((k) => qBox('0', Q.paper, F.at(k, 0).x, F.at(k, 0).y, 0.36, 0.36, 0.3, 0, 0.25));
  o.forEach((m) => glow(m, GOLD));
  say('前幾個音是空弦', '不用按，最簡單');
  await beat(tok, 2400);
  o.forEach((m) => glow(m, null));
  const p1 = F.at(5, 1), f1 = qBox('1', Q.orange, p1.x, p1.y, 0.42, 0.42, 0.3, 1.5, 0.25);
  say('第 5 弦第 1 格：食指', '大家都愛用食指');
  await beat(tok, 2600);
  const p2 = F.at(6, 3), f2 = qBox('2', Q.orange, p2.x, p2.y, 0.42, 0.42, 0.3, 1.5, 0.25);
  const a = arrow(V3(p1.x, p1.y, 0.5), V3(p2.x, p2.y, 0.5), Q.gold);
  say('接著底弦第 3 格：中指', '試過很多指法，這組最順');
  await beat(tok, 2800);
  kill(a); glow(f1, null);
  const p4 = F.at(2, 4), f4 = qBox('4', Q.purple, p4.x, p4.y, 0.42, 0.42, 0.3, 1.5, 0.25);
  const a2 = arrow(V3(p4.x, p4.y, 0.5), V3(F.at(6, 1).x, F.at(6, 1).y, 0.5), Q.red);
  glow(f4, RED);
  say('小指在上面時，很難伸到下面', '這種難度一樣寫進 d');
  await beat(tok, 3200);
  kill(a2); glow(f4, null); kill(f2);
}]);

// 11:42 子問題 suffix、猜 note i 的手指 → 遞迴寫不出來
FRAG.push(['dp4mit-finger-naive', '只猜 note i 的手指：遞迴寫不出來', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.6, 0]);
  const X = qX(6, 1.3, 0);
  const notes = [0, 1, 2, 3, 4, 5].map((i) => qBox('♪', Q.blue, X(i), 0.8, 0.8, 0.8, 0.6, 1.5));
  notes.forEach((_, i) => tag('i=' + i, 'idx', X(i), 0.05, 0.4));
  say('子問題：suffix notes[i:]', '從左往右彈，剩下的永遠是 suffix');
  const gb = ghostBox(Q.gold, 4 * 1.3, 1.2, 1); gb.position.set((X(2) + X(5)) / 2, 0.8, 0);
  await beat(tok, 2800);
  const FY = (f) => 1.9 + f * 0.62;
  const fs = [1, 2, 3, 4, 5].map((f) => qBox(f, Q.orange, X(2), FY(f - 1), 0.5, 0.5, 0.4, 1.2));
  say('猜：note i 用哪根手指 f', '每根都試，取 min');
  for (let k = 0; k < 5; k++) { fs.forEach((m, j) => glow(m, j === k ? GOLD : null)); await beat(tok, 450); }
  fs.forEach((m) => glow(m, null));
  const cd = code(['DP(i) = min over f:', '   DP(i+1) + d(i, f, i+1, ?)'], 0, 6.6, 0.55);
  const qm = qBox('?', Q.red, X(3), FY(1), 0.6, 0.6, 0.4, 1.4); glow(qm, RED);
  say('轉換成本要知道 note i+1 的手指', '可是 DP(i+1) 沒告訴我們');
  cd.hl(1);
  await beat(tok, 3200);
  say('這樣寫不出來', '只猜一件事不夠 → 要加子問題');
  await beat(tok, 3000);
}]);

// 16:34 DP(i, f)：猜 g，for i reversed、for f
FRAG.push(['dp4mit-finger-recur', 'DP(i, f) = min_g DP(i+1, g) + d(…)', async (tok) => {
  fresh([0, 3.6, 14], [0, 3.2, 0]);
  const cd = code(['DP(i, f) = min over g:', '   DP(i+1, g) + d(note[i], f, note[i+1], g)', 'for i in reversed(range(n)):', '   for f in 1…F:  算 DP(i, f)'], 0, 7.6, 0.5);
  const G = qGrid(5, 5, 1.5, 0.66, 0.4, 2.4, Q.sand, (c, r) => '', 0.5);
  for (let c = 0; c < 5; c++) tag('i=' + c, 'idx', G.X(c), G.Y(0) + 0.6);
  for (let r = 0; r < 5; r++) tag('f=' + (r + 1), 'idx', G.X(0) - 0.9, G.Y(r));
  cd.hl(0);
  say('DP(i, f)：note i 指定用手指 f', '還是 suffix，只是多記一個參數');
  await beat(tok, 3000);
  cd.hl(1);
  glow(G.g[2][1], GOLD);
  const as = [];
  say('猜 note i+1 的手指 g', '付 d(i, f → i+1, g)，再接 DP(i+1, g)');
  for (let r = 0; r < 5; r++) {
    as.push(arrow(V3(G.X(2), G.Y(1), 0.3), V3(G.X(3), G.Y(r), 0.3), Q.gold)); glow(G.g[3][r], GREEN);
    await beat(tok, 500);
  }
  await beat(tok, 1600);
  as.forEach(kill); qOff(G);
  cd.hl(2);
  say('拓撲順序：i 由右往左', '外層 i reversed，內層 f');
  for (let c = 4; c >= 0; c--) {
    for (let r = 0; r < 5; r++) { tint(G.g[c][r], c === 4 ? Q.purple : Q.teal); relabel(G.g[c][r], ''); cd.hl(3); await beat(tok, 170); }
    cd.hl(2);
  }
  say('迴圈對調就錯：DP(i+1, ·) 要先算好', '多記手指 f：magic of more subproblems');
  await beat(tok, 3200);
}]);

// 22:00 原問題 min_f DP(0, f) + DAG 觀點（完全二分、0 權重 source）
FRAG.push(['dp4mit-finger-dag', '指法 DAG：最短路徑 = 最佳指法', async (tok) => {
  fresh([0, 3.4, 14], [0, 2.8, 0]);
  const G = qGrid(5, 5, 1.6, 0.85, 0.6, 2.9, Q.sand, null, 0.42);
  for (let c = 0; c < 5; c++) tag('i=' + c, 'idx', G.X(c), G.Y(0) + 0.6);
  for (let r = 0; r < 5; r++) tag('f=' + (r + 1), 'idx', G.X(4) + 0.8, G.Y(r));
  say('原問題：第一個音用哪根手指？', 'DP(0, ·) 要給手指 → 全部試');
  await beat(tok, 2600);
  say('DAG：每個 (i, f) 是一個點', '相鄰兩欄是完全二分圖');
  for (let c = 0; c < 4; c++) {
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) line(G.X(c), G.Y(a), G.X(c + 1), G.Y(b), 0, Q.sand);
    await beat(tok, 500);
  }
  tag('權重 d(note i, f, note i+1, g)', 'ptr', 0.6, 0.0);
  await beat(tok, 2000);
  const s = qBox('s', Q.purple, -5.6, G.Y(2), 0.6, 0.6, 0.4, 1.4);
  for (let r = 0; r < 5; r++) line(-5.6, G.Y(2), G.X(0), G.Y(r), 0, Q.purple);
  tag('0', 'idx', -4.8, G.Y(0) - 0.2);
  say('沒有單一起點：加一個 source s', '連到第 0 欄，權重都是 0');
  await beat(tok, 2800);
  const path = [1, 0, 2, 2, 1];
  glow(s, GOLD);
  let prev = V3(-5.6, G.Y(2), 0.3);
  say('最短路徑 = min_f DP(0, f)', '路徑上每一點就是那個音的手指');
  for (let c = 0; c < 5; c++) {
    const nx = V3(G.X(c), G.Y(path[c]), 0.3);
    arrow(prev, nx, Q.gold); glow(G.g[c][path[c]], GOLD); prev = nx;
    await beat(tok, 600);
  }
  await beat(tok, 2600);
}]);

// 26:09 時間 Θ(nF²)、接著談和弦
FRAG.push(['dp4mit-finger-time', '指法 DP 的時間：Θ(n·F²)', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const G = qGrid(6, 5, 0.9, 0.7, -2.2, 3.0, Q.teal, null, 0.45);
  tag('n × F 個子問題', 'ptr', -2.2, 5.2);
  say('子問題 n·F 個', 'n 個音 × F 根手指');
  await beat(tok, 2600);
  glow(G.g[2][2], GOLD);
  const as = [];
  for (let r = 0; r < 5; r++) as.push(arrow(V3(G.X(2), G.Y(2), 0.3), V3(G.X(3), G.Y(r), 0.3), Q.gold));
  say('每個子問題試 F 個 g', 'min 迴圈：Θ(F)');
  await beat(tok, 2600);
  as.forEach(kill); glow(G.g[2][2], null);
  const t = tag('Θ(n·F) × Θ(F) = Θ(n·F²)', 'ptr alt', 3.6, 3.0);
  say('總時間 Θ(n·F²)', 'F 很小 → 幾乎是線性');
  await beat(tok, 3000);
  kill(t);
  const ch = [0, 1, 2].map((k) => qBox('♪', Q.blue, 4.2, 1.6 + k * 0.9, 0.7, 0.7, 0.5, 1.4));
  tag('和弦', 'ptr', 4.2, 4.6);
  say('現實：常常同時彈好幾個音', '同一個和弦也有好幾種指法');
  await beat(tok, 2600);
  ch.forEach((m) => glow(m, GOLD));
  say('選哪種指法，要看下一個和弦', '要放進更一般的 DP');
  await beat(tok, 2800);
}]);

// 29:16 同一個音可以在不同弦：狀態 = (手指, 弦)，Θ(n·F²·S²)
FRAG.push(['dp4mit-guitar-strings', '吉他同音多弦：狀態 (手指, 弦)', async (tok) => {
  fresh([0, 3.2, 13.5], [0, 3, 0]);
  const F = qFret(11, -5.6, 1.0, 6.4, 0.5);
  say('吉他：同一個音可以在不同弦上彈', '標準調音下這三格都是同一個音');
  const pos = [[3, 10], [2, 6], [1, 1]], ms = [];
  for (const [k, j] of pos) { const p = F.at(k, j); const m = qBox('♪', Q.orange, p.x, p.y, 0.4, 0.4, 0.3, 1.4, 0.25); glow(m, GOLD); ms.push(m); await beat(tok, 800); }
  tag('第 3 弦第 10 格', 'ptr', F.at(3, 10).x - 0.6, 7.0);
  await beat(tok, 2200);
  say('把「手指」推廣成（手指, 弦）', '手指 F 種 × 弦 S 種');
  const G = qGrid(6, 5, 0.6, 0.5, -1, 1.2, Q.teal, null, 0.36);
  tag('F × S 種狀態', 'idx', 2.4, 1.2);
  await beat(tok, 2800);
  tag('Θ(n·F²·S²)', 'ptr alt', 4.6, 2.0);
  say('時間 Θ(n·F²·S²)', '狀態數變 F·S，轉換數變 (F·S)²');
  await beat(tok, 3000);
}]);

// 30:42 多音（和弦）：pose = 每根手指在哪個音或不用，(F+1)^F
FRAG.push(['dp4mit-chord-pose', '和弦指法：pose 有 (F+1)^F 種', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const notes = ['a', 'b', 'c'].map((v, i) => qBox(v, Q.blue, -1.2 + i * 1.2, 5.4, 0.8, 0.7, 0.5, 1.5));
  tag('notes[i] = 一組同時彈的音', 'ptr', 0, 6.5);
  say('輸入變成一串 multi-note', 'notes[i] 最多 F 個音');
  await beat(tok, 2600);
  const FX = qX(5, 1.3, 0);
  const fing = [1, 2, 3, 4, 5].map((f, i) => { tag('指 ' + f, 'idx', FX(i), 1.0); return qBox('—', Q.orange, FX(i), 2.2, 0.8, 0.7, 0.5, 1.5); });
  say('pose：每根手指在哪個音，或不用', '每指 F+1 種選擇');
  const opts = ['a', 'b', 'c', '—'];
  const poses = [['a', 'b', 'c', '—', '—'], ['—', 'a', 'b', 'c', '—'], ['a', '—', 'b', '—', 'c'], ['—', '—', 'a', 'b', 'c']];
  for (const p of poses) { fing.forEach((m, i) => { relabel(m, p[i]); glow(m, p[i] === '—' ? null : GOLD); }); await beat(tok, 900); }
  const cnt = tag('(F+1)^F = 6⁵ = 7776', 'ptr alt', 4.6, 3.6);
  say('pose 總數 (F+1)^F', 'F = 5：6⁵ = 7776，對 F 是指數');
  await beat(tok, 3000);
  say('DP(i, pose)：猜下一個 pose', '時間 Θ(n·((F+1)^F)²)');
  txt(cnt, 'Θ(n·((F+1)^F)²)');
  await beat(tok, 3200);
  void opts;
}]);

// Tetris 盤面：寬 w = 6；cell (c, r) 的中心
const TW = 6, TS = 0.6, TX = (c) => -3.5 + c * TS, TY = (r) => 0.3 + r * TS;
function qBoard() {
  line(TX(0) - 0.3, 0, TX(TW - 1) + 0.3, 0, 0, Q.ink);
  line(TX(0) - 0.3, 0, TX(0) - 0.3, 7.2, 0, Q.ink); line(TX(TW - 1) + 0.3, 0, TX(TW - 1) + 0.3, 7.2, 0, Q.ink);
}
const qCell = (c, r, color, drop = 0) => qBox('', color, TX(c), TY(r), TS * 0.94, TS * 0.94, 0.5, drop);

// 35:24 Tetris 的限制條件
FRAG.push(['dp4mit-tetris-rules', 'Tetris 的假設：已知序列、直接落下、不消列', async (tok) => {
  fresh([0, 4, 14], [0, 3.6, 0]);
  qBoard();
  const seq = ['O', 'I', 'T', 'L', 'S'];
  seq.forEach((s, i) => qBox(s, i === 0 ? Q.gold : Q.purple, 3.2, 6.2 - i * 0.9, 0.7, 0.7, 0.5, 1.5));
  tag('n 塊的順序', 'ptr', 3.2, 7.2);
  say('事先知道全部 n 塊的順序', '比較像 Tetris 謎題');
  await beat(tok, 2800);
  say('每塊從頂端直接落地', '不能最後一刻轉一下塞進去');
  for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) qCell(c, r, Q.gold, 5);
  await beat(tok, 2200);
  for (let c = 2; c < 6; c++) qCell(c, 0, Q.teal, 5);
  await beat(tok, 900);
  const full = tag('滿了也不消除', 'ptr alt', TX(3), 2.0);
  say('排滿的列不會消除', '遲早會死：能撐過這 n 塊嗎？');
  await beat(tok, 3000);
  kill(full);
  tag('寬 w 很小（真實 w = 10）', 'idx', TX(2.5), -0.5);
  say('寬度 w 小、盤面一開始是空的', 'DP 對 w 會是指數');
  await beat(tok, 2600);
  say('拿掉這些假設就是 NP-complete', '有這些假設 → DP 可解');
  await beat(tok, 3000);
}]);

// 37:57 子問題：suffix i + skyline，洞可以補滿
FRAG.push(['dp4mit-tetris-skyline', 'Tetris 子問題：suffix + skyline', async (tok) => {
  fresh([0, 4, 14], [0, 3.6, 0]);
  qBoard();
  const cells = [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 0], [5, 0]];
  for (const [c, r] of cells) qCell(c, r, Q.teal);
  say('子問題：怎麼放 piece i 以後的塊', '只記 suffix 不夠：還要知道盤面');
  await beat(tok, 2800);
  const hole = qCell(2, 0, Q.red); tint(hole, '#f2d0d0'); glow(hole, RED);
  say('盤面可能有洞', '但塊都從天上掉：洞永遠填不到');
  await beat(tok, 2800);
  tint(hole, GRAY); glow(hole, null);
  const H = [1, 2, 2, 2, 0, 1];
  H.forEach((h, c) => { tag(String(h), 'ptr alt', TX(c), TY(h) + 0.1); line(TX(c) - 0.3, h * TS, TX(c) + 0.3, h * TS, 0.3, Q.gold); });
  say('把洞補滿 → 只看每欄高度', '這就是 skyline');
  await beat(tok, 3000);
  tag('每欄 0…h：h+1 種', 'idx', 3.6, 5.0);
  tag('(h+1)^w 種 skyline', 'ptr', 3.6, 4.2);
  say('子問題 = n × (h+1)^w', '對 h 還好，對 w 是指數');
  await beat(tok, 3200);
}]);

// 40:18 猜 piece i 怎麼放（4 旋轉 × w 位置）、時間、能不能活 = max
const T_ROT = [[[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [0, 1]]];
FRAG.push(['dp4mit-tetris-guess', 'Tetris：猜 piece i 的旋轉與位置', async (tok) => {
  fresh([0, 4, 14], [0, 3.6, 0]);
  qBoard();
  const H = [1, 2, 2, 2, 0, 1];
  H.forEach((h, c) => { for (let r = 0; r < h; r++) qCell(c, r, Q.teal); });
  const hl = H.map((h, c) => tag(String(h), 'idx', TX(c), -0.4));
  say('猜：piece i 怎麼放', '旋轉 0…3 次 × 從哪一欄落下');
  let piece = [];
  const show = (rot, c0) => { piece.forEach(kill); piece = T_ROT[rot].map(([dx, dy]) => qCell(c0 + dx, 9 + dy, Q.purple)); };
  const tr = tag('', 'ptr alt', 3.6, 6.0);
  for (const [rot, c0] of [[0, 0], [1, 2], [2, 3], [3, 4], [0, 3]]) { show(rot, c0); txt(tr, '旋轉 ' + rot + '、欄 ' + c0); await beat(tok, 900); }
  await beat(tok, 900);
  say('大約 4·w 種選擇', '4 種旋轉 × w 個位置');
  await beat(tok, 2400);
  piece.forEach(kill); piece = [];
  const rot = 0, c0 = 3, sh = T_ROT[rot];
  let base = 0; for (const [dx, dy] of sh) base = Math.max(base, H[c0 + dx] - dy);
  for (const [dx, dy] of sh) qCell(c0 + dx, base + dy, Q.purple, 4);
  const H2 = H.slice(); for (const [dx, dy] of sh) H2[c0 + dx] = Math.max(H2[c0 + dx], base + dy + 1);
  H2.forEach((h, c) => txt(hl[c], String(h)));
  say('落下後更新 skyline', '→ 子問題 (i+1, 新 skyline)');
  await beat(tok, 2800);
  tag('O(n·w·(h+1)^w)', 'ptr alt', 3.6, 4.8);
  say('時間 = 子問題數 × 4w', 'O(n·w·(h+1)^w)');
  await beat(tok, 2800);
  say('問的是能不能活：true / false', '當成 1 / 0，遞迴式取 max');
  await beat(tok, 3000);
}]);

// 42:58 Super Mario Bros.：離開畫面就消失
FRAG.push(['dp4mit-mario-screen', 'Super Mario：離開畫面就重設', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.4, 0]);
  for (let x = -6.4; x <= 6.5; x += 0.8) qBox('', Q.brown, x, 0.2, 0.78, 0.4, 0.8);
  qBox('?', Q.gold, -2.2, 3.0, 0.6, 0.6, 0.6); qBox('', Q.orange, -1.4, 3.0, 0.6, 0.6, 0.6); qBox('', Q.orange, 3.6, 3.0, 0.6, 0.6, 0.6);
  const goomba = qBox('怪', Q.red, -2.8, 0.75, 0.6, 0.7, 0.6);
  const mario = qBox('M', Q.pink, -5.4, 0.85, 0.5, 0.9, 0.5);
  const scr = ghostBox(Q.blue, 5.2, 4.4, 1.2); scr.position.set(-3.6, 2.4, 0);
  const st = tag('螢幕 w × h', 'ptr', -3.6, 4.9);
  say('NES Super Mario Bros. 1', '畫面只能往右捲');
  await beat(tok, 2600);
  say('東西出現在畫面上才開始動', '一離開畫面就從世界消失');
  for (let k = 1; k <= 6; k++) {
    const sx = -3.6 + k * 0.65; scr.position.set(sx, 2.4, 0); st.position.set(sx, 4.9, 0);
    move(mario, -5.4 + k * 0.75, 0.85);
    await beat(tok, 380);
  }
  fly(goomba, V3(-3, 4, 2));
  await beat(tok, 1600);
  say('離開畫面 = 那段關卡回到初始狀態', '只需要記住螢幕上的東西');
  await beat(tok, 2800);
  say('關卡 n bits、螢幕 w × h 不大', '目標：最高分，或最短時間');
  await beat(tok, 3000);
}]);

// 45:01 configuration 有幾種：c^{wh} × 速度 × S × T × 螢幕位置
FRAG.push(['dp4mit-mario-config', 'Mario 的 configuration 數', async (tok) => {
  fresh([0, 3.4, 13], [0, 3, 0]);
  const types = [Q.paper, Q.orange, Q.gold, Q.red, Q.pink], W = 8, Hh = 5;
  const G = qGrid(W, Hh, 0.62, 0.62, -2.6, 3.4, Q.paper, null, 0.56);
  tag('螢幕 w × h', 'ptr', -2.6, 5.4);
  say('configuration：螢幕上每一格的狀態', '磚塊、? 箱、怪物、Mario…');
  const seeds = [[1, 1, 1], [2, 1, 2], [4, 2, 3], [6, 4, 4], [3, 3, 1]];
  for (const [c, r, k] of seeds) { tint(G.g[c][r], types[k]); await beat(tok, 450); }
  await beat(tok, 900);
  const fs = ['c^{w·h}', '× 速度（常數種）', '× 分數 S', '× 剩餘時間 T', '× 螢幕在關卡的位置'];
  const ls = [];
  say('每格常數種狀態 → c^{w·h}', '再乘上其他要記的東西');
  for (let i = 0; i < fs.length; i++) { ls.push(tag(fs[i], i === 0 ? 'ptr alt' : 'ptr', 4.4, 5.2 - i * 0.8)); await beat(tok, 900); }
  await beat(tok, 1200);
  say('S、T 是整數：偽多項式', 'pseudo-polynomial；對 w、h 是指數');
  await beat(tok, 3200);
}]);

// 47:31 configuration 圖：常數出邊、最短路徑 / DP、只算走得到的
FRAG.push(['dp4mit-mario-graph', 'Mario：configuration 圖上的 DP', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const L = [[0], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2], [0]];
  const X = qX(5, 2.6), Y = (n, r) => 2.8 + (n - 1) * 0.6 - r * 1.2;
  const N = L.map((col, c) => col.map((r) => qBox('', c === 0 ? Q.pink : Q.sand, X(c), Y(col.length, r), 0.5, 0.5, 0.3)));
  tag('起始狀態', 'idx', X(0), Y(1, 0) - 0.6);
  say('每個 configuration 是一個點', '時間一直往下數 → 沒有環');
  await beat(tok, 2600);
  const btn = ['A', 'B', '→', '←'];
  say('每一步：按 / 放某個按鈕', '常數個選擇 → 常數個出邊');
  for (let c = 0; c < 4; c++) {
    N[c].forEach((a, i) => N[c + 1].forEach((b, j) => { if (Math.abs(i - j) <= 1 || N[c].length === 1 || N[c + 1].length === 1) line(a.position.x, a.position.y, b.position.x, b.position.y, 0, Q.sand); }));
    tag(btn[c], 'idx', (X(c) + X(c + 1)) / 2, 5.0);
    await beat(tok, 600);
  }
  await beat(tok, 1400);
  say('這些就是子問題：沒有 suffix', '最大分數 = 取 max 的 DP / 最短路徑');
  const path = [0, 1, 2, 1, 0];
  for (let c = 0; c < 5; c++) { glow(N[c][path[c]], GOLD); await beat(tok, 450); }
  await beat(tok, 1400);
  for (let c = 1; c < 5; c++) N[c].forEach((m, i) => { if (i === N[c].length - 1 && c === 2) tint(m, GRAY); });
  say('時間 = config 數 × O(1)', '遞迴 + memo：只算走得到的 config');
  await beat(tok, 3200);
}]);

// ════════════════ PptQgy89cN8（MIT 6.006 Rec22：DDR） ════════════════
const DDR_SHEET = ['↑', '↑↓', '↓', '↑↓', '↑', '↑↓', '←→', '←', '←→', '→'];

// 00:26 DDR 模型：四塊踏板 + 中間、note 譜、↑ 只限制一隻腳
FRAG.push(['dp4mit-ddr-board', 'DDR：踏板與 note 譜', async (tok) => {
  fresh([0, 3.2, 12], [0, 3, 0]);
  const pad = qPad(-2.4, 3.0, 1.15, 0.9);
  const sh = DDR_SHEET.map((s, i) => qBox(s, Q.paper, 3.4, 6.6 - i * 0.62, 1.1, 0.5, 0.3, 1.2));
  tag('note 譜', 'ptr', 3.4, 7.3);
  say('DDR：上下左右四塊感應板 + 中間', '還有一張 note 譜');
  await beat(tok, 2800);
  const ft = qFeet(pad, 'C', 'C');
  glow(sh[0], GOLD); glow(pad.m.U, GOLD);
  ft.put('U', 'C');
  say('↑：某一隻腳要踩 ↑', '另一隻腳放哪都可以');
  await beat(tok, 2800);
  glow(sh[0], null); glow(pad.m.U, null);
  glow(sh[1], GOLD); glow(pad.m.U, GOLD); glow(pad.m.D, GOLD);
  ft.put('U', 'D');
  say('↑↓：兩隻腳分別踩上、下', '');
  await beat(tok, 1800);
  ft.put('D', 'U');
  say('哪隻腳踩哪塊都行', '踏板是對稱的');
  await beat(tok, 2200);
  glow(sh[1], null); glow(pad.m.U, null); glow(pad.m.D, null);
  ft.put('C', 'U');
  say('沒有 note 時多踩也不扣分', '想踩幾次都可以');
  await beat(tok, 3000);
}]);

// 02:18 可能的目標；機率相乘 → 取 log
FRAG.push(['dp4mit-ddr-logs', 'DDR 的目標：失敗機率要取 log', async (tok) => {
  fresh([0, 3.4, 13], [0, 3, 0]);
  const cd = code(['給定技術，最大化分數', '全部踩到，最小化力氣', '動作最好看（娛樂效果）', '只有一首：最小化失敗機率'], -3.2, 6.4, 0.6);
  for (let i = 0; i < 4; i++) { cd.hl(i); say(['目標 1：最大化分數', '目標 2：全部踩到、最省力', '目標 3：最好看', '目標 4：最小化失敗機率'][i], i === 3 ? '比賽只有一首歌' : 'DP 就是在 max / min 某個東西'); await beat(tok, 1700); }
  const ps = ['.99991', '.99992', '.98', '.95', '.99'];
  const X = qX(5, 1.1, 2.4);
  const ms = ps.map((p, i) => qBox(p, Q.teal, X(i), 3.0, 0.95, 0.6, 0.5, 1.4));
  const op = tag('成功機率 = Π pᵢ', 'ptr alt', 2.4, 4.1);
  say('整首成功 = 每一步成功機率相乘', '是乘積，不是總和');
  await beat(tok, 2800);
  ms.forEach((m, i) => relabel(m, 'log ' + ps[i]));
  txt(op, 'max Σ log pᵢ');
  say('取 log：乘積變總和', '就是一般的 DP / 最短路徑');
  await beat(tok, 2800);
  glow(ms[0], GOLD); glow(ms[1], GOLD);
  say('很多接近 1 的數相乘會數值不穩', '99.991% 和 99.992% 乘一乘就分不出來');
  await beat(tok, 3200);
}]);

// 08:12 力氣 δ(from, to)；用圖：state = 點、move = 邊
FRAG.push(['dp4mit-ddr-delta', 'DDR：δ(from, to) 與 state / move', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const A = qPad(-3.4, 3.4, 0.95, 0.75), B = qPad(3.4, 3.4, 0.95, 0.75);
  tag('from', 'ptr', -3.4, 5.2); tag('to', 'ptr', 3.4, 5.2);
  say('目標：全部踩到、總力氣最小', '先定義一步的力氣');
  await beat(tok, 2400);
  const fa = qFeet(A, 'U', 'C');
  say('from：左腳 ↑、右腳在中間', '');
  await beat(tok, 2000);
  const fb = qFeet(B, 'C', 'U');
  say('to：左腳中間、右腳 ↑', '');
  await beat(tok, 2000);
  arrow(V3(-1.9, 3.4, 0.4), V3(1.9, 3.4, 0.4), Q.gold);
  const d = tag('δ(from, to) ∈ [0, 1]', 'ptr alt', 0, 4.0);
  say('δ(from, to)：0 很輕鬆、1 很難', '要跳一下 → 不是 0');
  await beat(tok, 3000);
  const s1 = qBox('state', Q.purple, -3.4, 0.6, 1.4, 0.6, 0.4, 1.4), s2 = qBox('state', Q.purple, 3.4, 0.6, 1.4, 0.6, 0.4, 1.4);
  arrow(V3(-2.6, 0.6, 0.3), V3(2.6, 0.6, 0.3), Q.brown); tag('move（權重 δ）', 'idx', 0, 1.1);
  say('用圖解：state 是點、move 是邊', '像西洋棋：盤面 = state，走一步 = move');
  await beat(tok, 3200);
  void fa; void fb; void d; void s1; void s2;
}]);

// 11:05 每步難度獨立 → 最佳走法併進 δ：兩個 note 之間一個 move 就夠
FRAG.push(['dp4mit-ddr-direct', 'DDR：最佳走法併進 δ，一步就夠', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const A = qPad(-4.3, 4.2, 0.75, 0.6), M = qPad(0, 1.6, 0.75, 0.6), B = qPad(4.3, 4.2, 0.75, 0.6);
  qFeet(A, 'U', 'D'); tag('↑↓', 'ptr', -4.3, 5.6);
  qFeet(B, 'L', 'R'); tag('←→', 'ptr', 4.3, 5.6);
  say('從 ↑↓ 到 ←→', '可以直接跳，也可以中途停一下');
  await beat(tok, 2600);
  const a1 = arrow(V3(-3.2, 4.6, 0.4), V3(3.2, 4.6, 0.4), Q.gold); tag('直接', 'idx', 0, 5.0);
  await beat(tok, 1400);
  qFeet(M, 'U', 'R'); tag('↑→', 'ptr', 0, 0.2);
  const a2 = arrow(V3(-3.6, 3.2, 0.4), V3(-1.0, 2.0, 0.4), Q.purple), a3 = arrow(V3(1.0, 2.0, 0.4), V3(3.6, 3.2, 0.4), Q.purple);
  say('或先到 ↑→，再到 ←→', '哪條比較輕鬆？');
  await beat(tok, 2600);
  say('每一步的難度互相獨立', '最好的走法每次都一樣');
  await beat(tok, 2600);
  tag('δ(↑↓, ←→) = min(直接, 經 ↑→)', 'ptr alt', 0, 6.6);
  say('把最佳走法直接算進 δ', '兩個 note 之間：一個 move 就夠');
  await beat(tok, 3200);
  void a1; void a2; void a3;
}]);

// 17:19 holds 先不管；回中間需要中間 state：每兩個 note 之間加一個
FRAG.push(['dp4mit-ddr-center', 'DDR：回到中間要一個中間 state', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 3, 0]);
  const seq = ['←', '→', '←', '→', '←', '→'];
  const X = qX(6, 0.9, 2.6);
  const ns = seq.map((s, i) => qBox(s, Q.paper, X(i), 6.4, 0.7, 0.5, 0.3, 1.2));
  const pad = qPad(-2.6, 3.0, 1.1, 0.85);
  const ft = qFeet(pad, 'L', 'R');
  say('譜：← → ← → ← →', 'hold 先不管');
  await beat(tok, 2400);
  const jc = tag('跳 0 次', 'ptr alt', 2.6, 3.8);
  say('只能在 note 上動：腳一直卡在 ← →', '每個 note 都要跳一下');
  for (let i = 0; i < 4; i++) { glow(ns[i], GOLD); txt(jc, '跳 ' + (i + 1) + ' 次'); ft.put('L', 'R'); await beat(tok, 650); glow(ns[i], null); }
  await beat(tok, 1200);
  txt(jc, '中間 state：回到中間');
  ft.put('C', 'C');
  say('想在空檔回中間', '兩個 note 之間要一個中間 state');
  await beat(tok, 1600);
  for (let i = 0; i < 4; i++) {
    glow(ns[i], GOLD); ft.put(i % 2 ? 'C' : 'L', i % 2 ? 'R' : 'C'); await beat(tok, 650);
    glow(ns[i], null); ft.put('C', 'C'); await beat(tok, 450);
  }
  say('一個中間 state 就夠', '可以回中心，也可以左右 rock');
  await beat(tok, 3000);
}]);

// 22:04 記重心：腳位 25 → 50 → 75
FRAG.push(['dp4mit-ddr-count', 'DDR 腳位數：25、50、75', async (tok) => {
  fresh([0, 3.4, 13], [0, 3, 0]);
  const D = ['↑', '↓', '←', '→', '·'];
  const grid = async (cx, col, name) => {
    const G = qGrid(5, 5, 0.46, 0.46, cx, 3.0, col, null, 0.38);
    D.forEach((d, i) => { tag(d, 'idx', G.X(i), 4.3); tag(d, 'idx', cx - 1.5, G.Y(i)); });
    tag(name, 'ptr', cx, 5.0);
    await beat(tok, 300); return G;
  };
  say('兩隻腳各在 5 格之一', '左腳 5 種 × 右腳 5 種 = 25');
  await grid(-4.2, Q.teal, '只記腳位');
  tag('左腳 ↓ 右腳 →', 'idx', -4.2, 1.2);
  await beat(tok, 2600);
  say('要記重心在哪隻腳：W ∈ {L, R}', '單腳點地 vs 要整個人跳起來');
  const g2 = await grid(0, Q.pink, 'W = L');
  await beat(tok, 900);
  const g3 = await grid(4.2, Q.blue, 'W = R');
  const t = tag('25 × 2 = 50', 'ptr alt', 0, 0.6);
  await beat(tok, 2600);
  say('重心放中間？最佳解不會用', '要加也行：25 × 3 = 75，DP 會自己忽略');
  txt(t, '加上中間：25 × 3 = 75');
  qOff(g2); qOff(g3);
  await beat(tok, 3200);
}]);

// 26:45 決策 = 新腳位；state = (note i, 落地後的腳位)
FRAG.push(['dp4mit-ddr-state', 'DDR 的 state：(note i, 落地後腳位)', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const n1 = qBox('note 1', Q.paper, -3.2, 6.4, 1.6, 0.5, 0.3, 1.2), n2 = qBox('note 2：←→', Q.paper, 2.8, 6.4, 2.2, 0.5, 0.3, 1.2);
  say('每次決策：落地後兩腳在哪', '不是選 / 不選，跟 knapsack 不同');
  await beat(tok, 2800);
  const s = qBox('(2, ←, →)', Q.teal, 2.8, 3.2, 2.0, 0.7, 0.4, 1.4);
  say('要知道落地時是第幾個 note', '譜事先知道 → 一個 index 就夠');
  glow(n2, GOLD);
  await beat(tok, 2600);
  const a = qBox('(1, ↑, ↓)', Q.sand, -3.2, 4.6, 2.0, 0.7, 0.4, 1.4), b = qBox('(1, ←, →)', Q.sand, -3.2, 1.8, 2.0, 0.7, 0.4, 1.4);
  arrow(V3(-2.1, 4.5, 0.3), V3(1.7, 3.4, 0.3), Q.gold); arrow(V3(-2.1, 1.9, 0.3), V3(1.7, 3.0, 0.3), Q.purple);
  tag('δ(↑↓ → ←→)', 'idx', -0.2, 4.5); tag('δ(←→ → ←→)', 'idx', -0.2, 1.9);
  say('從 ↑↓ 來，還是從 ←→ 來？', '要比較就得知道之前的腳位');
  glow(n1, GOLD);
  await beat(tok, 3000);
  glow(s, GOLD);
  say('state = (i, 落地腳位)', 'δ(之前腳位, 現在腳位) 才算得出來');
  await beat(tok, 3200);
  void a; void b;
}]);

// 32:32 在每兩個 note 之間插入空白 note ○（改輸入）→ 最短路徑
FRAG.push(['dp4mit-ddr-blank', 'DDR：插入空白 note ○', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const seq = ['↑', '↑↓', '↓', '↑↓', '←→'];
  const X5 = qX(5, 1.6), X9 = qX(9, 1.15);
  const ns = seq.map((s, i) => qBox(s, Q.paper, X5(i), 5.4, 0.9, 0.6, 0.4, 1.2));
  say('原本的譜', '中間狀態要怎麼表示？');
  await beat(tok, 2400);
  ns.forEach((m, i) => move(m, X9(2 * i), 5.4));
  const bl = [];
  for (let i = 0; i < 4; i++) { bl.push(qBox('○', Q.teal, X9(2 * i + 1), 5.4, 0.7, 0.6, 0.4, 1.6)); await beat(tok, 400); }
  say('每兩個 note 之間插入空白 note ○', '○ 沒有限制：腳愛放哪就放哪');
  await beat(tok, 2800);
  say('改的是輸入，演算法不用改', '只要處理「note 到 note」的轉移');
  const nd = [];
  for (let i = 0; i < 9; i++) nd.push(qBox('', i % 2 ? Q.teal : Q.sand, X9(i), 2.6, 0.45, 0.45, 0.3, 1.2));
  for (let i = 0; i < 8; i++) arrow(V3(X9(i) + 0.25, 2.6, 0.2), V3(X9(i + 1) - 0.25, 2.6, 0.2), Q.gold);
  await beat(tok, 2600);
  tag('路徑長 = Σ δ', 'ptr alt', 0, 1.6);
  say('路徑長 = 力氣總和', '→ 跑最短路徑就是答案');
  await beat(tok, 3000);
}]);

// 37:15 點 = (i, L, R)；note 是限制：←→ 2 種、○ 25 種、↑↓ 2 種
FRAG.push(['dp4mit-ddr-admit', 'DDR 的點：note 允許哪些腳位', async (tok) => {
  fresh([0, 3.2, 13.5], [0, 3, 0]);
  tag('←→', 'ptr', -4.4, 6.2); tag('○', 'ptr', 0, 6.2); tag('↑↓', 'ptr', 4.4, 6.2);
  say('點 = (i, 左腳, 右腳)', 'note 是限制條件');
  await beat(tok, 2400);
  const A = [qBox('L← R→', Q.sand, -4.4, 3.9, 1.5, 0.5, 0.3, 1.3), qBox('L→ R←', Q.sand, -4.4, 2.3, 1.5, 0.5, 0.3, 1.3)];
  say('←→ 只允許 2 種腳位', '左←右→，或左右對調');
  await beat(tok, 2400);
  const G = qGrid(5, 5, 0.5, 0.5, 0, 3.1, Q.teal, null, 0.32);
  say('○ 允許全部 25 種', '中間狀態：想站哪都行');
  await beat(tok, 2400);
  const B = [qBox('L↑ R↓', Q.sand, 4.4, 3.9, 1.5, 0.5, 0.3, 1.3), qBox('L↓ R↑', Q.sand, 4.4, 2.3, 1.5, 0.5, 0.3, 1.3)];
  say('↑↓ 也只有 2 種', '只有 ↑ 一個箭頭時就不只 2 種');
  await beat(tok, 2400);
  say('出度很大 → 中間一大片 → 入度很大', '每條邊權重要看確切的落地腳位');
  for (const a of A) for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) line(a.position.x + 0.75, a.position.y, G.X(c), G.Y(r), 0, Q.sand);
  await beat(tok, 900);
  for (const b of B) for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) line(G.X(c), G.Y(r), b.position.x - 0.75, b.position.y, 0, Q.sand);
  await beat(tok, 3000);
}]);

// 46:49 邊：(i, L, R) → (i+1, Lj, Rj)，權重 δ；最大化就加負號
FRAG.push(['dp4mit-ddr-edges', 'DDR 的邊：權重 δ((L,R), (Lj,Rj))', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const cd = code(['(i, L, R) → (i+1, Lj, Rj)', '  對所有 note i+1 允許的 (Lj, Rj)', '  權重 = δ((L, R), (Lj, Rj))'], 0, 7.0, 0.5);
  tag('note i：↑↓', 'ptr', -3.6, 5.1); tag('note i+1：←→', 'ptr', 3.6, 5.1);
  const A = [qBox('L↑ R↓', Q.sand, -3.6, 4.0, 1.5, 0.5, 0.3, 1.3), qBox('L↓ R↑', Q.sand, -3.6, 1.6, 1.5, 0.5, 0.3, 1.3)];
  const B = [qBox('L← R→', Q.teal, 3.6, 4.0, 1.5, 0.5, 0.3, 1.3), qBox('L→ R←', Q.teal, 3.6, 1.6, 1.5, 0.5, 0.3, 1.3)];
  cd.hl(0);
  say('從 (i, L, R) 出發畫邊', '連到 note i+1 的每一種腳位');
  await beat(tok, 2600);
  cd.hl(1);
  const ws = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    arrow(V3(-2.8, A[i].position.y, 0.3), V3(2.8, B[j].position.y, 0.3), Q.gold);
    ws.push(tag('δ', 'idx', -0.6 + j * 1.2, (A[i].position.y * 0.6 + B[j].position.y * 0.4) + 0.2));
    glow(A[i], GOLD); glow(B[j], GOLD); await beat(tok, 700); glow(A[i], null); glow(B[j], null);
  }
  cd.hl(2);
  say('權重 = δ(前腳位, 新腳位)', '最小化力氣 → 直接當最短路徑');
  await beat(tok, 2800);
  ws.forEach((l) => txt(l, '−δ'));
  say('如果是最大化（例如分數）', '權重加負號再跑最短路徑');
  await beat(tok, 3000);
}]);

// 50:23 source / sink（權重 0）與 DAG shortest path
FRAG.push(['dp4mit-ddr-dagsp', 'DDR：source、sink 與 DAG 最短路徑', async (tok) => {
  fresh([0, 3.2, 13.5], [0, 3, 0]);
  const cols = [4, 2, 5, 2], X = qX(4, 2.6, 0), Y = (n, r) => 3.2 + (n - 1) * 0.5 - r * 1.0;
  const N = cols.map((n, c) => Array.from({ length: n }, (_, r) => qBox('', c === 0 ? Q.purple : Q.sand, X(c), Y(n, r), 0.42, 0.42, 0.3)));
  tag('note 0：所有腳位', 'idx', X(0), 5.4); tag('最後一個 note', 'idx', X(3), 5.4);
  for (let c = 0; c < 3; c++) N[c].forEach((a) => N[c + 1].forEach((b) => line(a.position.x, a.position.y, b.position.x, b.position.y, 0, Q.sand)));
  say('起點腳位自己選：加一個 note 0', 'note 0 放所有可能的腳位');
  await beat(tok, 2800);
  const s = qBox('s', Q.gold, -6.2, 3.2, 0.6, 0.6, 0.4, 1.4);
  N[0].forEach((m) => line(-6.2, 3.2, m.position.x, m.position.y, 0, Q.gold));
  tag('0', 'idx', -5.4, 4.3);
  say('source s 連到 note 0，權重 0', '選起始站姿，再踩第一個 note');
  await beat(tok, 2800);
  const t = qBox('t', Q.gold, 6.2, 3.2, 0.6, 0.6, 0.4, 1.4);
  N[3].forEach((m) => line(m.position.x, m.position.y, 6.2, 3.2, 0, Q.gold));
  tag('0', 'idx', 5.4, 4.3);
  say('最後一個 note 的所有點連到 sink t', '權重也是 0');
  await beat(tok, 2600);
  say('Dijkstra？Bellman-Ford？', 'δ ∈ [0, 1] 不為負……');
  await beat(tok, 2200);
  const cur = tag('relax', 'ptr alt', -6.2, 2.3);
  glow(s, GOLD);
  for (let c = 0; c < 4; c++) { move(cur, X(c), 0.6); N[c].forEach((m) => glow(m, GOLD)); await beat(tok, 700); }
  move(cur, 6.2, 2.3); glow(t, GOLD);
  say('答案：都不用，這是 DAG', 'DAG shortest path：拓撲順序 relax 一次');
  await beat(tok, 3200);
}]);
  }
  // ═══ dp4bari2.js ═══
  {
// ─── Abdul Bari（cued）：wAy6nDMPYAE（4.6.2 OBST 成功＋失敗：p = 3 3 1 1、q = 2 3 1 1 1（×16）→ 32/16 = 2）、
//     vLS-zRCHo-Y（OBST 只算成功：10 20 30 40 頻率 4 2 6 3 → 26）、uJOmqBwENB8（4.8 Reliability design → 0.648、$100）
// Every `await step(tok)` waits for the sentence that shows it (notes "cues"); motion between steps is short.
const { V3, tag, cube, kill, glow, tint, txt, anim, line, ghostBox, tnode, travel, step, buddy, prop, bob, icon, relabel } = K;
const say = (a, b = '') => ctx.say(a, b);
const mono = (l) => { Object.assign(l.element.style, K.MONO); return l; };
const cls = (l, c) => { if (l) l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
const fr = (x) => String(+(+x).toFixed(4));
const DRED = '#7a1010', MARK = '#f3d27a', DONE = '#9fe0c4', LINEC = '#c9bfae';
// one function per lecturer sentence: wait for its cue, then show it
async function run(tok, acts) { for (const a of acts) { await step(tok); await a(); } }
// a column of monospace lines (the lecturer's working on the board)
function pad(x, y0, dy = 0.5) {
  const P = { ls: [] };
  P.add = (t, c = '') => { const l = mono(tag(t, c, x, y0 - P.ls.length * dy, 0.3)); P.ls.push(l); return l; };
  P.clear = () => { P.ls.forEach(kill); P.ls = []; };
  return P;
}
const goTo = (tok, l, x, y, ms = 450) => travel(tok, l, l.position.clone(), V3(x, y, l.position.z), ms);

// ── BST：7 個 key 的範例樹 ──
const B7 = { 40: [0, 6.2, null], 20: [-2.8, 4.9, 40], 60: [2.8, 4.9, 40], 10: [-4.2, 3.6, 20], 30: [-1.4, 3.6, 20], 50: [1.4, 3.6, 60], 70: [4.2, 3.6, 60] };
const B7_ORDER = [40, 20, 60, 10, 30, 50, 70];
const EXT7 = [-4.9, -3.5, -2.1, -0.7, 0.7, 2.1, 3.5, 4.9];
function bst7() { const nd = {}; for (const k of B7_ORDER) { const [x, y, p] = B7[k]; nd[k] = tnode(k, x, y, 0, p ? nd[p] : null, BLUE); } return nd; }
function ext7() { return EXT7.map((x, t) => { const px = B7[[10, 30, 50, 70][t >> 1]][0]; line(px, 3.2, x, 2.62, 0, LINEC); return cube(' ', GRAY, [0.46, 0.42, 0.42], x, 2.4, 0, 1.0); }); }
const above = (k) => [B7[k][0], B7[k][1] + 0.85];

// ── 3 個 key（10、20、30）的 5 棵 BST ──
const T5 = [
  [[10, -0.75, 1, null], [20, 0, 2, 10], [30, 0.75, 3, 20]],
  [[10, -0.75, 1, null], [30, 0.75, 2, 10], [20, 0, 3, 30]],
  [[20, 0, 1, null], [10, -0.75, 2, 20], [30, 0.75, 2, 20]],
  [[30, 0.75, 1, null], [10, -0.75, 2, 30], [20, 0, 3, 10]],
  [[30, 0.75, 1, null], [20, 0, 2, 30], [10, -0.75, 3, 20]],
];
const T5X = [-5.4, -2.7, 0, 2.7, 5.4], T5Y = [0, 6.2, 5.0, 3.8];
function drawT5(t, all) {
  const nd = {};
  for (const [k, dx, lv, par] of T5[t]) { nd[k] = tnode(k, T5X[t] + dx, T5Y[lv], 0, par ? nd[par] : null, BLUE); nd[k].userData.lv = lv; all.push(nd[k]); if (nd[k].userData.edge) all.push(nd[k].userData.edge); }
  return nd;
}
// a small tree of little cubes: spec = [[key, dx, depth, parentKey], …]
function miniTree(spec, cx, yTop, dy, all, s = 0.5) {
  const nd = {};
  for (const [k, dx, d, par] of spec) {
    const x = cx + dx, y = yTop - d * dy;
    if (par) all.push(line(nd[par].position.x, nd[par].position.y, x, y, 0, LINEC));
    nd[k] = cube(k, BLUE, [s, s, s], x, y, 0, 0.8); all.push(nd[k]);
  }
  return nd;
}

// ── Horowitz 形式的 OBST：c(i,j)、w(i,j)、r(i,j)，0 ≤ i ≤ j ≤ n ──
function obSolve(p1, q) {
  const n = p1.length, p = [0, ...p1], qq = q || new Array(n + 1).fill(0);
  const w = [], c = [], r = [];
  for (let i = 0; i <= n; i++) { w[i] = []; c[i] = []; r[i] = []; w[i][i] = qq[i]; c[i][i] = 0; r[i][i] = 0; }
  for (let d = 1; d <= n; d++) for (let i = 0; i + d <= n; i++) {
    const j = i + d; w[i][j] = w[i][j - 1] + p[j] + qq[j];
    let best = Infinity, bk = 0;
    for (let k = i + 1; k <= j; k++) { const v = c[i][k - 1] + c[k][j]; if (v < best) { best = v; bk = k; } }
    c[i][j] = best + w[i][j]; r[i][j] = bk;
  }
  return { n, p, q: qq, w, c, r };
}
const HB = obSolve([3, 3, 1, 1], [2, 3, 1, 1, 1]);   // wAy6nDMPYAE（×16）
const HV = obSolve([4, 2, 6, 3]);                     // vLS-zRCHo-Y（頻率）
// DP 表：layout 'diag'（列 = j − i、行 = i，格內 w / c / r）或 'ij'（列 i、行 j，格內 c / r）
function obTable(n, o) {
  o = Object.assign({ layout: 'diag', X0: -5.5, Y0: 6.5, CW: 1.3, CH: 1.15, w: true }, o);
  const D = o.layout === 'diag';
  const T = { o, pl: {}, c: {}, w: {}, r: {}, arrows: [], hot: null };
  const key = (i, j) => i + ',' + j;
  T.pos = (i, j) => (D ? V3(o.X0 + i * o.CW, o.Y0 - (j - i) * o.CH, 0) : V3(o.X0 + j * o.CW, o.Y0 - i * o.CH, 0));
  for (let i = 0; i <= n; i++) for (let j = i; j <= n; j++) { const p = T.pos(i, j); T.pl[key(i, j)] = plate(p.x, p.y, o.CW * 0.94, o.CH * 0.92); }
  for (let k = 0; k <= n; k++) {
    tag((D ? 'i=' : 'j=') + k, 'idx', o.X0 + k * o.CW, o.Y0 + o.CH * 0.75);
    tag((D ? 'j−i=' : 'i=') + k, 'idx', o.X0 - o.CW * 0.5 - (D ? 0.55 : 0.35), o.Y0 - k * o.CH);
  }
  T.setW = (i, j, v, hot) => {
    const k = key(i, j); if (T.w[k]) kill(T.w[k]);
    const p = T.pos(i, j); T.w[k] = tag('w ' + v, 'idx', p.x, p.y + o.CH * 0.3, 0.3);
    if (hot) T.hotW(i, j);
    return T.w[k];
  };
  T.hotW = (i, j) => { if (T.hot) cls(T.hot, 'idx'); T.hot = T.w[key(i, j)]; cls(T.hot, 'ptr alt'); };
  T.coolW = () => { if (T.hot) cls(T.hot, 'idx'); T.hot = null; };
  T.setC = (i, j, v, drop = 1.2, color) => {
    const k = key(i, j); if (T.c[k]) kill(T.c[k]);
    const p = T.pos(i, j);
    return (T.c[k] = cube(v, color || (i === j ? GRAY : TEAL), [o.CW * 0.5, o.CH * 0.36, 0.3], p.x, p.y + (o.w ? -0.02 : 0.1), 0.2, drop));
  };
  T.setR = (i, j, v) => { const k = key(i, j); if (T.r[k]) kill(T.r[k]); const p = T.pos(i, j); return (T.r[k] = tag('r ' + v, 'idx', p.x, p.y - o.CH * 0.33, 0.3)); };
  T.mark = (i, j, c) => { const pl = T.pl[key(i, j)]; if (pl) pl.material.color.set(c || PAPER); };
  T.arrow = (i1, j1, i2, j2, c) => { const a = T.pos(i1, j1), b = T.pos(i2, j2); a.z = b.z = 0.6; const h = K.arrow(a, b, c || TRY); T.arrows.push(h); return h; };
  T.glowC = (i, j, c) => { const m = T.c[key(i, j)]; if (m) glow(m, c || GOLD); };
  T.clear = () => { T.arrows.forEach(kill); T.arrows = []; Object.values(T.c).forEach((m) => glow(m, null)); };
  return T;
}
// fill cells instantly: what = 'wcr' letters
function put(T, H, i, j, what) {
  if (what.includes('w')) T.setW(i, j, H.w[i][j]);
  if (what.includes('c')) T.setC(i, j, H.c[i][j], 0);
  if (what.includes('r')) T.setR(i, j, H.r[i][j]);
}
// all cells, in the lecturer's order (j − i = 0, 1, 2, …; left to right)
function cellsOf(n) { const out = []; for (let d = 0; d <= n; d++) for (let i = 0; i + d <= n; i++) out.push([i, i + d]); return out; }
function fillBefore(T, H, stop, wAll, what) {
  const n = H.n, cs = cellsOf(n);
  if (wAll) cs.forEach(([i, j]) => T.setW(i, j, H.w[i][j]));
  for (const [i, j] of cs) { if (stop && i === stop[0] && j === stop[1]) break; put(T, H, i, j, what); }
}
const kText = (H, i, j, k, v) => 'k=' + k + ': c(' + i + ',' + (k - 1) + ') + c(' + k + ',' + j + ')' + (v ? ' = ' + H.c[i][k - 1] + ' + ' + H.c[k][j] + ' = ' + (H.c[i][k - 1] + H.c[k][j]) : '');
const kArrows = (T, i, j, k) => { T.arrow(i, k - 1, i, j); T.arrow(k, j, i, j); };
const minOf = (H, i, j) => { let b = Infinity; for (let k = i + 1; k <= j; k++) b = Math.min(b, H.c[i][k - 1] + H.c[k][j]); return b; };
function stageB(H, stop, what) {
  K.fresh([0, 4.4, 15], [0, 3.8, 0]);
  const T = obTable(H.n, {});
  mono(tag('key  10  20  30  40', 'ptr', 3.6, 7.4));
  mono(tag('p      3   3   1   1', 'idx', 3.6, 6.95));
  mono(tag('q    2   3   1   1   1', 'idx', 3.6, 6.5));
  fillBefore(T, H, stop, true, what || 'cr');
  return T;
}
function stageV(H, stop) {
  K.fresh([0, 4.4, 15], [0, 3.8, 0]);
  const T = obTable(H.n, { layout: 'ij', w: false, X0: -5.2, Y0: 6.4, CW: 1.15, CH: 1.0 });
  mono(tag('key   10  20  30  40', 'ptr', 3.4, 7.4));
  mono(tag('freq   4   2   6   3', 'idx', 3.4, 6.95));
  fillBefore(T, H, stop, false, 'cr');
  return T;
}

// ═════════════════ wAy6nDMPYAE：4.6.2 Optimal BST（成功＋失敗） ═════════════════
FRAG.push(['dp4bari2-bst-search', 'BST 搜尋：找 30、9、47', async (tok) => {
  K.fresh([0, 4.2, 13.5], [0, 3.6, 0]);
  let nd, cur, cnt;
  const unglow = () => B7_ORDER.forEach((k) => glow(nd[k], null));
  const goto = async (k, n) => { const [x, y] = above(k); await goTo(tok, cur, x, y); glow(nd[k], GOLD); txt(cnt, '比較 ' + n + ' 次'); };
  const start = (t) => { unglow(); if (cur) kill(cur); cur = tag('找 ' + t, 'pkt', 0, 7.05); glow(nd[40], GOLD); txt(cnt, '比較 1 次'); cls(cnt, 'ptr alt'); };
  const nullAt = async (x, px) => { line(px, 3.2, x, 2.62, 0, LINEC); const m = cube('', RED, [0.42, 0.42, 0.42], x, 2.4, 0, 0.8); glow(m, DRED); await goTo(tok, cur, x, 3.1, 400); };
  await run(tok, [
    () => { nd = bst7(); cnt = tag(' ', 'ptr alt', -5.8, 7.0); say('一棵 binary search tree', '每個節點放一個 key'); },
    () => { [10, 20, 30].forEach((k) => tint(nd[k], TEAL)); [50, 60, 70].forEach((k) => tint(nd[k], PURPLE)); tag('10、20、30 < 40', 'good', -2.8, 6.95); tag('50、60、70 > 40', 'note', 2.8, 6.95); say('40 的左邊都比較小、右邊都比較大'); },
    () => { B7_ORDER.forEach((k) => tint(nd[k], BLUE)); glow(nd[60], GOLD); tint(nd[50], TEAL); tint(nd[70], PURPLE); say('60 也一樣', '50 < 60 在左、70 > 60 在右'); },
    () => { tint(nd[50], BLUE); tint(nd[70], BLUE); start(30); say('找 30：從 root 開始', '40 是 30 嗎？不是'); },
    async () => { say('30 < 40 → 一定在左邊'); await goto(20, 2); glow(nd[40], null); },
    async () => { say('30 > 20 → 往右邊'); await goto(30, 3); glow(nd[20], null); },
    () => { tint(nd[30], TEAL); glow(nd[30], GREEN); say('找到 30！'); },
    () => { cls(cnt, 'ptr'); say('找 30 一共比較 3 次', '40、20、30 各比一次'); },
    () => { tint(nd[30], BLUE); unglow(); kill(cur); cur = null; B7_ORDER.forEach((k) => { const [x, y] = B7[k]; tag((y > 6 ? 1 : y > 4 ? 2 : 3) + ' 次', 'idx', x + 0.8, y + 0.25); }); say('10 要 3 次、20 要 2 次、40 只要 1 次'); },
    () => { [6.2, 4.9, 3.6].forEach((y, t) => tag('level ' + (t + 1), 'ptr', -6.3, y)); say('最多比較 3 次 = 樹的高度', '3 層 → 最多比 3 次'); },
    () => { tag('找得到：successful search ✓', 'good', 3.4, 7.45); say('找得到 → successful search（成功搜尋）'); },
    async () => { start(9); say('找 9：9 < 40、9 < 20、9 < 10', '一路往左'); await goto(20, 2); await goto(10, 3); },
    async () => { await nullAt(-4.9, -4.2); tag('null', 'bad', -4.9, 1.8); say('10 的左邊什麼都沒有（null）', '9 不在樹裡 → unsuccessful search'); },
    () => { cls(cnt, 'ptr'); say('失敗搜尋也比較了 3 次', '40、20、10'); },
    async () => { start(47); say('找 47：47 > 40 → 往右'); await goto(60, 2); },
    async () => { say('47 < 60 → 往左'); await goto(50, 3); },
    async () => { await nullAt(0.7, 1.4); tag('null', 'bad', 0.7, 1.8); say('47 < 50 → 往左：沒有了', '失敗搜尋，比較 3 次'); },
    () => { unglow(); tag('成功、失敗都要比較 → 比較次數 = 搜尋成本', 'say', 0, 0.9); say('比較次數 = 搜尋的成本', '成功、失敗都要算'); },
  ]);
}]);

FRAG.push(['dp4bari2-bst-ext', '方形節點：失敗搜尋的區間', async (tok) => {
  K.fresh([0, 4.2, 13.5], [0, 3.4, 0]);
  const nd = bst7(); let ex = [], cur = null;
  const RNG = ['−∞~9', '11~19', '21~29', '31~39', '41~49', '51~59', '61~69', '71~+∞'], labs = [];
  const lab = (t) => (labs[t] = labs[t] || tag(RNG[t], 'note', EXT7[t], 1.75));
  const path = async (v, keys, t) => {
    if (cur) kill(cur); cur = tag('找 ' + v, 'pkt', 0, 7.05);
    for (const k of keys) { const [x, y] = above(k); await goTo(tok, cur, x, y, 380); }
    await goTo(tok, cur, EXT7[t], 3.1, 380); glow(ex[t], GOLD);
  };
  await run(tok, [
    () => { ex = ext7(); say('圓形節點放 key；小方塊是另一種節點'); },
    () => { ex.forEach((m) => glow(m, GOLD)); say('方塊裡沒有 key', '那它代表什麼？'); },
    async () => { ex.forEach((m) => glow(m, null)); say('找 11：11 < 40、11 < 20、11 > 10', '停在 10 的右邊'); await path(11, [40, 20, 10], 1); },
    async () => { glow(ex[1], null); say('找 12：12 < 40、12 < 20、12 > 10', '也停在同一個方塊'); await path(12, [40, 20, 10], 1); },
    () => { lab(1); say('找 11 到 19 都會停在這裡', '這個方塊代表 11~19'); },
    () => { glow(ex[1], null); lab(0); glow(ex[0], GOLD); say('最左邊的方塊：−∞~9', '比 10 小的都停在這裡'); },
    () => { kill(cur); glow(ex[0], null); ex.forEach((m) => relabel(m, 'null')); say('方塊其實就是 null', '走到這裡就知道：找不到'); },
    () => { for (let t = 0; t < 8; t++) lab(t); say('每個方塊都代表一段找不到的 key'); },
    () => { glow(ex[7], GOLD); say('最右邊：71~+∞', '比 70 大的都停在這裡'); },
    () => { glow(ex[7], null); ex.forEach((m) => glow(m, GOLD)); tag('7 個 key → 8 個方塊（dummy node）', 'say', 0, 0.9); say('失敗搜尋畫成 dummy node', '每個代表一段區間，不是一個值'); },
  ]);
}]);

FRAG.push(['dp4bari2-bst-shape', '同樣的 key，很多棵 BST；高度越小越好', async (tok) => {
  K.fresh([0, 4.2, 14], [0, 3.8, 0]);
  const all = []; let trees = []; const chain = [];
  await run(tok, [
    () => { trees = [0, 1, 2, 3, 4].map((t) => drawT5(t, all)); say('3 個 key：10、20、30', '這 5 棵都是 BST'); },
    () => { all.push(mono(tag('n 個 key：(2n C n) / (n + 1) 棵', 'ptr', 0, 2.0))); say('有幾棵？公式 (2n C n) / (n + 1)'); },
    () => { all.push(mono(tag('n = 3：6C3 / 4 = 20 / 4 = 5', 'ptr alt', 0, 1.4))); say('n = 3：6C3 / 4 = 5 棵'); },
    () => { [3, 3, 2, 3, 3].forEach((h, t) => all.push(tag('最多 ' + h + ' 次', 'idx', T5X[t], 2.75))); say('最多比較次數：3、3、2、3、3'); },
    () => { Object.values(trees[2]).forEach((m) => glow(m, GREEN)); all.push(tag('比較好 ✓', 'good', 0, 7.0)); say('中間那棵最好', '最多只要比 2 次'); },
    async () => {
      all.forEach(kill);
      say('7 個 key 也能排成一直往左的樹', '70 → 60 → 50 → … → 10');
      [70, 60, 50, 40, 30, 20, 10].forEach((k, t) => chain.push(tnode(k, 2.4 - t * 0.8, 6.6 - t * 0.8, 0, chain[t - 1] || null, BLUE)));
      await anim(tok, 300, () => {});
    },
    () => { chain.forEach((m, t) => tag('第 ' + (t + 1) + ' 層', 'idx', m.position.x + 0.95, m.position.y)); say('數一數：一共 7 層'); },
    () => { chain.forEach((m) => glow(m, DRED)); tag('找 10 要比 7 次 ✗', 'bad', 4.0, 3.0); say('最多要比 7 次', '成本很高'); },
    () => { chain.forEach((m) => glow(m, null)); tag('高度越小 → 比較次數越少', 'good', 4.0, 2.2); say('樹的高度要越小越好'); },
  ]);
}]);

FRAG.push(['dp4bari2-prob', '成功機率 p 與失敗機率 q：開店的比喻', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.4, 0]);
  const keys = [10, 20, 30, 40], p = [0.1, 0.2, 0.1, 0.2], q = [0.1, 0.05, 0.15, 0.05, 0.05];
  const xs = (t) => -5.6 + t * 1.4, YL = 6.0;
  const km = [], sq = [], shop = [];
  let boss, cust;
  const walkTo = async (b, x, ms = 700) => { const x0 = b.g.position.x; b.look(x > x0 ? 1 : -1); await anim(tok, ms, (u) => { b.g.position.x = x0 + (x - x0) * u; }); };
  await run(tok, [
    () => { keys.forEach((k, t) => km.push(cube(k, BLUE, [0.9, 0.6, 0.6], xs(2 * t + 1), YL, 0, 1.2))); tag('4 個 key → 可以畫出 14 棵 BST', 'ptr', 0, 7.35); say('4 個 key：10、20、30、40', '可以畫出 14 棵 BST'); },
    () => { for (let t = 0; t <= 4; t++) sq.push(cube('', GRAY, [0.5, 0.45, 0.45], xs(2 * t), YL - 0.05, 0, 1.2)); say('方塊代表失敗搜尋：1、2、3、4、5 個'); },
    () => { tag('n 個 key → n + 1 個方塊', 'ptr alt', 0, 4.95); say('n 個 key → n + 1 個方塊'); },
    () => {
      shop.push(cube('櫃台', SAND, [2.6, 0.7, 1.0], -3.6, 0.35, 0.8));
      const wh = prop('warehouse', 4.0, 0, -0.3, 1.0, '倉庫'); shop.push(wh);
      boss = buddy('老闆', '', ORANGE, -3.6, 0, -0.5, 0.75);
      say('想像你開一家小店', '櫃台在門口，倉庫在後面');
    },
    () => { const a = prop('parcel', -4.4, 0.7, 0.8, 0.5), b = prop('parcel', -2.8, 0.7, 0.8, 0.5), c = prop('parcel', 2.8, 0, 0.6, 0.5); bob(a, 0.04); shop.push(a, b, c); say('有的商品放櫃台、有的放倉庫'); },
    async () => { say('櫃台的東西伸手就拿到', '倉庫的要走過去，比較花時間'); await walkTo(boss, 2.4, 900); await walkTo(boss, -3.6, 900); },
    () => { shop.push(tag('常賣 → 放櫃台', 'good', -3.6, 2.1), tag('少賣 → 放倉庫', 'note', 3.6, 2.8)); say('怎麼擺？看賣出的頻率', '頻率就是機率'); },
    () => { shop.push(tag('商品 = key；找商品 = 搜尋', 'say', 0, 3.7)); km.forEach((m) => glow(m, GOLD)); say('key 就像商品，找它就是搜尋'); },
    () => { km.forEach((m) => glow(m, null)); cust = buddy('客人', '', PINK, 0.6, 0, 1.2, 0.7); cust.look(-1); shop.push(tag('有賣 X 嗎？', 'say', 0.6, 2.0, 1.2)); boss.mood('wow'); say('客人要的東西，店裡沒有'); },
    () => { sq.forEach((m) => glow(m, GOLD)); say('「被問但沒有」的頻率也要考慮', '= 失敗搜尋的機率'); },
    async () => { sq.forEach((m) => glow(m, null)); say('跑去倉庫找半天才說「沒有」', '很浪費時間'); await walkTo(boss, 2.4, 900); boss.mood('sad'); await walkTo(boss, -3.6, 900); cust.mood('sad'); },
    async () => {
      shop.forEach(kill); kill(boss.g); kill(cust.g);
      const ms = [];
      for (let t = 0; t <= 8; t++) {
        const isK = t % 2 === 1, v = isK ? p[(t - 1) / 2] : q[t / 2];
        const m = cube('', isK ? TEAL : ORANGE, [0.5, 1, 0.5], xs(t), 0.8, 0); m.scale.y = 0.001; ms.push([m, v]);
        tag(String(v), 'ptr alt', xs(t), 1.2 + v * 16);
      }
      say('成功、失敗的機率都很重要', '每個 key、每個方塊都有機率');
      await anim(tok, 1200, (u) => ms.forEach(([m, v]) => { const h = v * 16 * u; m.scale.y = Math.max(0.001, h); m.position.y = 0.8 + h / 2; }));
    },
    () => { tag('全部加起來 = 1', 'good', 4.6, 4.4); say('機率用小數，全部加起來 = 1', '0.6 + 0.4 = 1'); },
    () => { keys.forEach((k, t) => tag('p' + (t + 1), 'ptr', xs(2 * t + 1), 0.35)); say('成功機率：p1、p2、p3、p4'); },
    () => { q.forEach((v, t) => tag('q' + t, t === 0 ? 'ptr alt' : 'ptr', xs(2 * t), 0.35)); say('失敗機率多一個：q0 … q4', '所以從 0 開始編號'); },
    () => { glow(sq[0], GOLD); tag('−∞~9', 'note', xs(0), YL + 0.7); say('q0：要找比 10 小的值'); },
    () => { glow(sq[0], null); glow(sq[4], GOLD); tag('41~+∞', 'note', xs(8), YL + 0.7); say('q4：要找比 40 大的值'); },
    () => { glow(sq[4], null); ['11~19', '21~29', '31~39'].forEach((s, t) => tag(s, 'note', xs(2 * t + 2), YL + 0.7)); say('每個 q 代表一整段 key', '每個 p 只代表一個 key'); },
  ]);
}]);

FRAG.push(['dp4bari2-cost21', '一棵 BST 的期望成本 = 2.1', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.6, 0]);
  const L = { 20: [0, 6.4, null, 1, 0.2], 10: [-2.6, 5.0, 20, 2, 0.1], 30: [2.6, 5.0, 20, 2, 0.1], 40: [4.2, 3.6, 30, 3, 0.2] };
  const E = [['E0', -3.4, 3.6, -2.6, 5.0, 3, 0.1], ['E1', -1.8, 3.6, -2.6, 5.0, 3, 0.05], ['E2', 1.8, 3.6, 2.6, 5.0, 3, 0.15], ['E3', 3.4, 2.2, 4.2, 3.6, 4, 0.05], ['E4', 5.0, 2.2, 4.2, 3.6, 4, 0.05]];
  const nd = {}; let em = [], sumK, sumE, tot, f1, total = 0;
  const kT = [], eT = [];
  const off = () => { Object.values(nd).forEach((m) => glow(m, null)); em.forEach((m) => glow(m, null)); };
  const addK = (k) => { const [x, y, , lv, pv] = L[k]; off(); glow(nd[k], GOLD); total += lv * pv; kT.push(lv + '×' + pv); txt(sumK, 'key ：' + kT.join(' + ')); txt(tot, 'cost = ' + fr(total)); tag(lv + '×' + pv, 'ptr alt', x + 0.95, y + 0.25); };
  const addE = (t) => { const e = E[t]; glow(em[t], GOLD); total += (e[5] - 1) * e[6]; eT.push((e[5] - 1) + '×' + e[6]); txt(sumE, '方塊：' + eT.join(' + ')); txt(tot, 'cost = ' + fr(total)); tag((e[5] - 1) + '×' + e[6], 'ptr alt', e[1], e[2] - 0.95); };
  await run(tok, [
    () => {
      for (const k of [20, 10, 30, 40]) { const [x, y, par] = L[k]; nd[k] = tnode(k, x, y, 0, par ? nd[par] : null, BLUE); }
      em = E.map(([lbl, x, y, px, py]) => { line(px, py - 0.4, x, y + 0.25, 0, LINEC); return cube(lbl, GRAY, [0.55, 0.42, 0.42], x, y, 0, 1.0); });
      say('用這棵樹算搜尋成本', '圓 = key、方塊 = 失敗搜尋');
    },
    () => { [1, 2, 3, 4].forEach((lv) => tag('level ' + lv, 'ptr', -6.1, [0, 6.4, 5.0, 3.6, 2.2][lv])); say('20 在 level 1；10、30 在 level 2', '40 在 level 3'); },
    () => {
      for (const k of [20, 10, 30, 40]) { const [x, y, , , pv] = L[k]; tag('p=' + pv, 'note', x - 0.95, y + 0.25); }
      E.forEach(([, x, y, , , , qv]) => tag('q=' + qv, 'note', x, y - 0.45));
      sumK = mono(tag(' ', 'ptr', -1.6, 0.85)); sumE = mono(tag(' ', 'ptr', -1.6, 0.3)); tot = tag('cost = 0', 'pkt', 4.6, 7.2);
      say('每個 key、每個方塊都標上機率');
    },
    () => { addK(20); say('20：level 1 → 1 × 0.2', '比 1 次就找到'); },
    () => { addK(10); say('10：level 2 → 2 × 0.1'); },
    () => { addK(30); say('30：level 2 → 2 × 0.1'); },
    () => { addK(40); say('40：level 3 → 3 × 0.2', '要比 3 次'); },
    () => { off(); glow(em[0], GOLD); glow(nd[10], GOLD); tag('比完 10 就知道沒有', 'say', -4.6, 7.2); say('E0 在 level 3，但到那裡不用再比', '比完 10 就停了'); },
    () => { off(); addE(0); say('方塊算 (level − 1) × q', 'E0：2 × 0.1'); },
    () => { off(); addE(1); addE(2); say('E1：2 × 0.05、E2：2 × 0.15'); },
    () => { off(); addE(3); addE(4); say('E3、E4：3 × 0.05、3 × 0.05'); },
    () => { off(); glow(em[3], GOLD); glow(em[4], GOLD); glow(nd[40], GOLD); say('E3、E4 畫在 level 4', '但比較停在 level 3 的 40：算 3'); },
    () => { off(); cls(tot, 'good'); txt(tot, 'cost = 1.2 + 0.9 = 2.1'); say('全部加起來 = 2.1', 'key 1.2 + 方塊 0.9'); },
    () => { kill(sumK); kill(sumE); f1 = mono(tag('cost = Σ pᵢ·level(aᵢ)', 'ptr', 0, 0.8)); say('寫成公式：每個 key 是 p × level'); },
    () => { txt(f1, 'cost = Σ pᵢ·level(aᵢ) + Σ qᵢ·level(Eᵢ)'); say('再加上每個方塊：q × level'); },
    () => { txt(f1, 'cost = Σ pᵢ·level(aᵢ) + Σ qᵢ·(level(Eᵢ) − 1)'); say('方塊的 level 要減 1'); },
    () => { txt(f1, 'cost = Σ(i=1..n) pᵢ·level(aᵢ) + Σ(i=0..n) qᵢ·(level(Eᵢ) − 1)'); say('p 從 1 加到 n；q 從 0 加到 n'); },
    () => { tag('已知一棵樹 → 算出它的成本', 'say', 0, 0.2); say('這是「已知一棵樹」算成本的公式'); },
  ]);
}]);

FRAG.push(['dp4bari2-brute', 'Optimal BST：暴力法試不完', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.4, 0]);
  let all = [], mini = [], think;
  const SP = [
    [[20, 0, 0, null], [10, -0.7, 1, 20], [30, 0.7, 1, 20], [40, 1.2, 2, 30]],
    [[30, 0, 0, null], [20, -0.7, 1, 30], [40, 0.7, 1, 30], [10, -1.2, 2, 20]],
    [[40, 0, 0, null], [30, -0.6, 1, 40], [20, -1.1, 2, 30], [10, -1.6, 3, 20]],
  ];
  await run(tok, [
    () => { all.push(mono(tag('key 10 20 30 40｜p .1 .2 .1 .2｜q .1 .05 .15 .05 .05', 'ptr', 0, 7.35))); say('Optimal BST：給定 key 和 p、q'); },
    () => { all.push(tag('剛才那棵 cost = 2.1：能不能更小？', 'say', 0, 6.75)); say('要找一棵樹，讓 cost 最小'); },
    () => { SP.forEach((s, t) => mini.push(miniTree(s, [-4.0, 0.2, 4.6][t], 5.7, 0.8, all, 0.55))); say('root 可以是 20、30、40…', '每個 key 的 level 都不一樣'); },
    () => { [-4.0, 0.2, 4.6].forEach((x) => all.push(tag('cost = ?', 'note', x, 2.55))); say('算出來的 cost 都不一樣'); },
    async () => {
      all.forEach(kill); all = [];
      for (let t = 0; t < 14; t++) all.push(cube('', BLUE, [0.7, 0.7, 0.7], -3.9 + (t % 7) * 1.3, t < 7 ? 5.4 : 4.2, 0, 1.0));
      all.push(tag('4 個 key → 14 棵 BST', 'ptr', 0, 6.6));
      say('4 個 key：一共 14 棵 BST');
      await anim(tok, 300, () => {});
    },
    () => { all.push(tag('問題：給定 key 和機率，做出 cost 最小的 BST', 'say', 0, 2.9)); say('問題：做出 cost 最小的 BST'); },
    async () => {
      say('暴力法：14 棵都畫出來，各算 cost', '再挑最小的');
      const cs = all.filter((m) => m.isMesh);
      await anim(tok, 1800, (u) => { const k = Math.min(13, Math.floor(u * 14)); cs.forEach((m, t) => glow(m, t <= k ? GOLD : null)); });
      cs.forEach((m) => glow(m, null)); glow(cs[9], GREEN); all.push(tag('最小', 'good', cs[9].position.x, 3.45));
    },
    async () => {
      all.forEach(kill); all = [];
      const bars = [];
      for (let n = 1; n <= 9; n++) {
        const v = catalan(n + 1), h = 0.3 + Math.log10(v) * 1.2, x = -5.2 + (n - 1) * 1.3;
        const m = cube('', n === 4 ? ORANGE : BLUE, [0.9, 1, 0.9], x, 0, 0); m.scale.y = 0.001; bars.push([m, h]);
        tag(n + ' 個 key', 'idx', x, 0.0, 0.9); tag(String(v), n === 4 ? 'ptr alt' : 'idx', x, h + 0.35);
      }
      say('(2n C n)/(n+1)：key 一多，數量爆炸', '高度用對數尺度');
      await anim(tok, 1500, (u) => bars.forEach(([m, h]) => { m.scale.y = Math.max(0.001, h * u); m.position.y = h * u / 2; }));
    },
    () => { tag('40 個 key：約 2.6 × 10²¹ 棵 ✗', 'bad', 3.8, 6.6); say('40 個 key：根本不可能全部試'); },
    () => { think = buddy('DP', '?', TEAL, -4.6, 4.2, 0.6, 0.8); think.mood('wow'); say('能不能不全部畫出來', '也找到最好的那棵？'); },
    async () => { think.set('✓'); think.mood('happy'); tag('DP：間接地試過全部', 'good', -4.6, 6.6); say('DP：試過全部，但不是直接試', '是間接地試'); await think.hop(tok); },
  ]);
}]);

FRAG.push(['dp4bari2-expand', '展開 c(0,3)：要大的，先要小的', async (tok) => {
  K.fresh([0, 4.4, 14.5], [0, 3.8, 0]);
  let all = [], kk, c00, c33, exX;
  const lb = (a) => 'c(' + a[0] + ',' + a[1] + ')';
  const node = (a, x, y, color) => { const m = cube(lb(a), color, [1.05, 0.48, 0.4], x, y, 0, 1.0); m.userData.key = lb(a); all.push(m); return m; };
  const cxs = [-4.4, 0, 4.4];
  const branch = (t, k, a, b) => { const cx = cxs[t]; all.push(line(0, 6.25, cx, 5.45), tag('k=' + k, 'idx', cx, 5.95)); return [node(a, cx - 0.62, 5.2, BLUE), node(b, cx + 0.62, 5.2, PURPLE)]; };
  const row = (d) => { const r = []; for (let i = 0; i + d <= 3; i++) r.push([i, i + d]); const y = 1.0 + d * 1.25; r.forEach((a, t) => cube(lb(a), d === 3 ? TEAL : d === 0 ? GRAY : BLUE, [1.1, 0.5, 0.4], (t - (r.length - 1) / 2) * 1.5, y, 0, 1.2)); return y; };
  await run(tok, [
    () => { mono(tag('c(i,j) = min{ c(i,k−1) + c(k,j) } + w(i,j)，i < k ≤ j', 'ptr', 0, 7.4)); node([0, 3], 0, 6.5, TEAL); say('用公式算 3 個 key 的 c(0,3)'); },
    () => { kk = tag('k = 1、2、3', 'ptr alt', 2.6, 6.5); all.push(kk); say('0 < k ≤ 3：k 可以是 1、2、3'); },
    () => { c00 = branch(0, 1, [0, 0], [1, 3])[0]; exX = cxs[0] + 0.62; say('k = 1：c(0,0) + c(1,3)'); },
    () => { branch(1, 2, [0, 1], [2, 3]); say('k = 2：c(0,1) + c(2,3)'); },
    () => { c33 = branch(2, 3, [0, 2], [3, 3])[1]; say('k = 3：c(0,2) + c(3,3)'); },
    () => { all.push(tag('三個取 min，再 + w(0,3)', 'ptr alt', 0, 4.4)); say('取最小的，再加 w(0,3)', 'w(0,3) = 所有 p、q 的和'); },
    () => { [c00, c33].forEach((m) => { tint(m, GRAY); relabel(m, lb([m === c00 ? 0 : 3, m === c00 ? 0 : 3]) + '=0'); }); say('c(0,0)、c(3,3) 都是 0', '其他的還不知道'); },
    async () => {
      say('c(1,3) 不知道 → 再展開', 'k = 2、3');
      [[2, [1, 1], [2, 3]], [3, [1, 2], [3, 3]]].forEach(([k, a, b], t) => {
        const cx = exX + (t - 0.5) * 2.5;
        all.push(line(exX, 4.95, cx, 3.75), tag('k=' + k, 'idx', cx, 4.05));
        node(a, cx - 0.58, 3.5, BLUE); node(b, cx + 0.58, 3.5, PURPLE);
      });
      await anim(tok, 300, () => {});
    },
    () => { all.filter((m) => m.userData.key === 'c(2,3)' || m.userData.key === 'c(3,3)').forEach((m) => glow(m, GOLD)); all.push(tag('越展越多，還一再重複', 'bad', 3.6, 3.0)); say('每個都要再展開，越展越多', '同樣的子問題重複出現'); },
    () => { all.push(tag('要知道大的，得先知道小的', 'good', 3.6, 2.3)); say('範圍越來越小：0~3 → 1~3', '先算小的，大的就能算'); },
    () => { all.forEach(kill); all = []; const y = row(0); tag('j − i = 0', 'idx', -5.8, y); say('需要 c(0,0)、c(1,1)、c(2,2)、c(3,3)'); },
    () => { const y = row(1); tag('j − i = 1', 'idx', -5.8, y); say('再來差 1：c(0,1)、c(1,2)、c(2,3)'); },
    () => { const y = row(2); tag('j − i = 2', 'idx', -5.8, y); say('差 2：c(0,2)、c(1,3)'); },
    () => { const y = row(3); tag('j − i = 3', 'idx', -5.8, y); say('最後才是 c(0,3)'); },
    () => { tag('依 j − i = 0、1、2、3 的順序算', 'good', 3.6, 5.6); say('照 j − i = 0、1、2、3 的順序計算', 'i 一定比 j 小'); },
  ]);
}]);

FRAG.push(['dp4bari2-wcr', '每格要記 w、c、r；w 的遞迴', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.6, 0]);
  let cell, sl = [], seq = [];
  const xs = (t) => -4.8 + t * 1.5;
  await run(tok, [
    () => { obTable(4, { X0: -5.4, Y0: 6.5, CW: 0.95, CH: 0.8 }); cell = plate(3.6, 5.6, 3.2, 2.2); sl.push(tag('c(i,j) = 成本', 'ptr', 3.6, 5.6, 0.2)); tag('一格', 'idx', 3.6, 6.95); say('不再展開公式：改成填表'); },
    () => { sl.push(tag('r = 給出 min 的 k（root）', 'ptr alt', 3.6, 4.95, 0.2)); say('還要記下：哪個 k 給出最小值', '那個 k 就是 root'); },
    () => { sl.push(tag('w = ?', 'ptr', 3.6, 6.25, 0.2)); say('公式裡還有 w，也要算'); },
    () => {
      ['q0', 'p1', 'q1', 'p2', 'q2', 'p3', 'q3'].forEach((s, t) => seq.push(cube(s, s[0] === 'p' ? TEAL : GRAY, [0.9, 0.55, 0.5], xs(t), 1.8, 0, 1.2)));
      const g = ghostBox(BLUE, 1.5 * 5, 0.95, 0.9); g.position.set((xs(0) + xs(4)) / 2, 1.8, 0);
      tag('w(0,2) = q0 + p1 + q1 + p2 + q2', 'ptr', (xs(0) + xs(4)) / 2, 2.65);
      say('w(0,2) = q0 + p1 + q1 + p2 + q2');
    },
    () => { const g = ghostBox(ORANGE, 1.5 * 7 + 0.2, 1.25, 1.1); g.position.set((xs(0) + xs(6)) / 2, 1.8, 0); glow(seq[5], GOLD); glow(seq[6], GOLD); tag('w(0,3) 只多了 p3 + q3', 'ptr alt', 2.4, 3.15); say('w(0,3)：前面都一樣，只多了 p3 + q3'); },
    () => { mono(tag('w(0,3) = w(0,2) + p3 + q3', 'ptr', 0, 0.75)); say('所以 w(0,3) = w(0,2) + p3 + q3'); },
    () => { mono(tag('w(i,j) = w(i,j−1) + p_j + q_j', 'ptr alt', 0, 0.2)); say('一般式：w(i,j) = w(i,j−1) + p_j + q_j', '知道前一格，馬上算出下一格'); },
    () => { cell.material.color.set(MARK); sl.forEach((l) => cls(l, 'good')); say('每一格都要算：cost、weight、root'); },
  ]);
}]);

// ── 例題（×16）：p = 3 3 1 1、q = 2 3 1 1 1 ──
FRAG.push(['dp4bari2-wtab', '例題：先填 w', async (tok) => {
  K.fresh([0, 4.4, 15], [0, 3.8, 0]);
  const H = HB, P = pad(3.6, 5.3, 0.5); let T;
  const wStep = (i, j) => {
    T.arrows.forEach(kill); T.arrows = [];
    T.arrow(i, j - 1, i, j); T.setW(i, j, H.w[i][j], true);
    P.clear(); P.add('w(' + i + ',' + j + ') = w(' + i + ',' + (j - 1) + ') + p' + j + ' + q' + j); P.add('       = ' + H.w[i][j - 1] + ' + ' + H.p[j] + ' + ' + H.q[j] + ' = ' + H.w[i][j], 'ptr alt');
    say('w(' + i + ',' + j + ') = ' + H.w[i][j - 1] + ' + ' + H.p[j] + ' + ' + H.q[j] + ' = ' + H.w[i][j]);
  };
  await run(tok, [
    () => { mono(tag('key  10  20  30  40', 'ptr', 3.6, 7.4)); say('例題：4 個 key：10、20、30、40'); },
    () => { mono(tag('p      3   3   1   1', 'idx', 3.6, 6.95)); say('成功機率 p1 … p4'); },
    () => { mono(tag('q    2   3   1   1   1', 'idx', 3.6, 6.5)); say('失敗機率 q0 … q4：從 0 開始'); },
    () => { tag('都乘了 16（總和 16），避開小數', 'note', 3.6, 6.0); say('數值是機率 × 16', '全部加起來 16'); },
    () => { T = obTable(4, {}); say('每格放 w、c、r', '第一列 j − i = 0'); },
    () => { T.setW(0, 0, H.w[0][0], true); say('w(0,0) = q0 = 2'); },
    () => { T.setW(1, 1, H.w[1][1], true); say('w(1,1) = q1 = 3'); },
    () => { T.coolW(); for (let i = 2; i <= 4; i++) T.setW(i, i, H.w[i][i]); say('w(i,i) = qᵢ：2、3、1、1、1'); },
    () => { for (let i = 0; i <= 4; i++) T.setC(i, i, 0); say('c(i,i) = 0', '沒有 k 可以選'); },
    () => { for (let i = 0; i <= 4; i++) T.setR(i, i, 0); say('root 也都是 0'); },
    () => { P.add('w(i,j) = w(i,j−1) + p_j + q_j', 'ptr'); say('下一列用 w(i,j) = w(i,j−1) + p_j + q_j'); },
    ...[[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [1, 3], [2, 4], [0, 3], [1, 4], [0, 4]].map(([i, j]) => () => wStep(i, j)),
  ]);
}]);

FRAG.push(['dp4bari2-tab1', 'j − i = 1：c 就等於 w', async (tok) => {
  const H = HB, T = stageB(H, [0, 1]), P = pad(3.6, 5.6, 0.5);
  await run(tok, [
    () => { for (let i = 0; i < 4; i++) T.mark(i, i + 1, MARK); say('開始算 c：先算 j − i = 1 這一列'); },
    () => { P.add('c(i,j) = min{c(i,k−1) + c(k,j)} + w(i,j)', 'ptr'); P.add('k：i < k ≤ j'); say('對照公式來算'); },
    () => { P.clear(); for (let i = 1; i < 4; i++) T.mark(i, i + 1); P.add('c(0,1)：0 < k ≤ 1 → k = 1'); say('c(0,1)：k 只能是 1'); },
    () => { P.add('= c(0,0) + c(1,1) + w(0,1)'); kArrows(T, 0, 1, 1); say('= c(0,0) + c(1,1) + w(0,1)'); },
    () => { T.glowC(0, 0); T.glowC(1, 1); P.add('= 0 + 0 + w(0,1)'); say('c(0,0) = 0、c(1,1) = 0', '表裡已經有了'); },
    () => { T.hotW(0, 1); P.add('= 0 + ' + H.w[0][1]); say('w(0,1) = 8'); },
    () => { T.clear(); T.coolW(); T.setC(0, 1, H.c[0][1]); T.mark(0, 1); cls(P.ls[P.ls.length - 1], 'ptr alt'); say('c(0,1) = 0 + 8 = 8'); },
    () => { P.add('只有一個 k → c = w', 'good'); say('只有一個 k，結果就是 w'); },
    () => { P.clear(); P.add('c(1,2)：k = 2'); P.add('= c(1,1) + c(2,2) + w(1,2)'); kArrows(T, 1, 2, 2); say('c(1,2) = c(1,1) + c(2,2) + w(1,2)'); },
    () => { T.clear(); P.add('= 0 + 0 + ' + H.w[1][2] + ' = ' + H.c[1][2], 'ptr alt'); T.setC(1, 2, H.c[1][2]); say('c(1,2) = 0 + 0 + 7 = 7'); },
    () => { T.setC(2, 3, H.c[2][3]); T.setC(3, 4, H.c[3][4]); P.add('c(2,3) = 3、c(3,4) = 3'); say('c(2,3)、c(3,4) 也直接等於 w', '3、3'); },
    () => { for (let i = 0; i < 4; i++) T.setR(i, i + 1, H.r[i][i + 1]); say('root 依序是 1、2、3、4', '只有一個 key 可以當 root'); },
  ]);
}]);

FRAG.push(['dp4bari2-tab02', 'c(0,2) = 19', async (tok) => {
  const H = HB, T = stageB(H, [0, 2]), P = pad(3.6, 5.6, 0.5); let l1, l2;
  await run(tok, [
    () => { T.mark(0, 2, MARK); P.add('c(0,2)：0 < k ≤ 2 → k = 1、2'); say('c(0,2)：k 可以是 1、2'); },
    () => { l1 = P.add(kText(H, 0, 2, 1)); kArrows(T, 0, 2, 1); say('k = 1：c(0,0) + c(1,2)'); },
    () => { l2 = P.add(kText(H, 0, 2, 2)); kArrows(T, 0, 2, 2); say('k = 2：c(0,1) + c(2,2)'); },
    () => { P.add('取 min 後 + w(0,2) = ' + H.w[0][2]); T.hotW(0, 2); say('最後加上 w(0,2) = 12'); },
    () => { T.glowC(0, 0); T.glowC(1, 2); txt(l1, kText(H, 0, 2, 1, true)); say('k = 1：0 + 7 = 7', '小的格子已經算好，直接拿來用'); },
    () => { T.glowC(0, 1); T.glowC(2, 2); txt(l2, kText(H, 0, 2, 2, true)); say('k = 2：8 + 0 = 8'); },
    () => { cls(l1, 'ptr alt'); say('7 和 8，最小的是 7'); },
    () => { T.clear(); T.coolW(); T.setC(0, 2, H.c[0][2]); T.mark(0, 2); P.add('c(0,2) = 7 + 12 = ' + H.c[0][2], 'ptr alt'); say('c(0,2) = 7 + 12 = 19'); },
    () => { T.setR(0, 2, H.r[0][2]); say('k = 1 給出最小值 → root = 1'); },
    () => { P.add('給出 min 的 k → 當 root', 'good'); say('誰給出最小值，誰就是 root'); },
  ]);
}]);

FRAG.push(['dp4bari2-tab13', 'c(1,3)、c(2,4)、c(0,3) = 25、c(1,4)', async (tok) => {
  const H = HB, T = stageB(H, [1, 3]), P = pad(3.6, 5.6, 0.5); let L = [];
  await run(tok, [
    () => { T.setC(1, 3, H.c[1][3]); T.setR(1, 3, H.r[1][3]); P.add('c(1,3) = 12，r = 2（同樣方法）'); say('c(1,3) = 12，root 2', '照同一個公式算'); },
    () => { T.setC(2, 4, H.c[2][4]); T.setR(2, 4, H.r[2][4]); P.add('c(2,4) = 8，r = 3'); say('c(2,4) = 8，root 3'); },
    () => { P.clear(); T.mark(0, 3, MARK); P.add('c(0,3)：k = 1、2、3'); say('c(0,3)：k 可以是 1、2、3'); },
    () => { L[1] = P.add(kText(H, 0, 3, 1)); kArrows(T, 0, 3, 1); say('k = 1：c(0,0) + c(1,3)'); },
    () => { L[2] = P.add(kText(H, 0, 3, 2)); L[3] = P.add(kText(H, 0, 3, 3)); kArrows(T, 0, 3, 2); kArrows(T, 0, 3, 3); say('k = 2：c(0,1) + c(2,3)', 'k = 3：c(0,2) + c(3,3)'); },
    () => { P.add('取 min 後 + w(0,3) = ' + H.w[0][3]); T.hotW(0, 3); say('最後加上 w(0,3)'); },
    () => { txt(L[1], kText(H, 0, 3, 1, true)); say('k = 1：0 + 12 = 12'); },
    () => { txt(L[2], kText(H, 0, 3, 2, true)); say('k = 2：8 + 3 = 11'); },
    () => { txt(L[3], kText(H, 0, 3, 3, true)); say('k = 3：19 + 0 = 19'); },
    () => { P.add('min(12, 11, 19) + 14'); cls(L[2], 'ptr alt'); say('min(12, 11, 19) + w(0,3) = 11 + 14'); },
    () => { T.clear(); T.coolW(); T.setC(0, 3, H.c[0][3]); T.mark(0, 3); P.add('c(0,3) = 11 + 14 = ' + H.c[0][3], 'ptr alt'); say('c(0,3) = 25'); },
    () => { T.setR(0, 3, H.r[0][3]); say('給出 25 的是 k = 2 → root 2'); },
    () => { T.setC(1, 4, H.c[1][4]); T.setR(1, 4, H.r[1][4]); P.add('c(1,4) = 19，r = 2'); say('c(1,4) = 19，root 2'); },
    () => { P.add('c(1,4)：k 從 2 開始試（2、3、4）', 'good'); say('c(1,4) 的 k 從 2 開始，不是從 1'); },
  ]);
}]);

FRAG.push(['dp4bari2-tab04', 'c(0,4) = 32 → 成本 2', async (tok) => {
  const H = HB, T = stageB(H, [0, 4]), P = pad(3.6, 5.6, 0.5); const L = [];
  await run(tok, [
    () => { T.mark(0, 4, MARK); P.add('c(0,4)：0 < k ≤ 4 → k = 1、2、3、4'); say('c(0,4)：k 可以是 1、2、3、4'); },
    () => { L[1] = P.add(kText(H, 0, 4, 1)); kArrows(T, 0, 4, 1); say('k = 1：c(0,0) + c(1,4)'); },
    () => { L[2] = P.add(kText(H, 0, 4, 2)); L[3] = P.add(kText(H, 0, 4, 3)); kArrows(T, 0, 4, 2); kArrows(T, 0, 4, 3); say('k = 2：c(0,1) + c(2,4)', 'k = 3：c(0,2) + c(3,4)'); },
    () => { L[4] = P.add(kText(H, 0, 4, 4)); kArrows(T, 0, 4, 4); P.add('取 min 後 + w(0,4) = ' + H.w[0][4]); T.hotW(0, 4); say('k = 4：c(0,3) + c(4,4)', '最後 + w(0,4)'); },
    () => { txt(L[1], kText(H, 0, 4, 1, true)); say('k = 1：0 + 19 = 19'); },
    () => { txt(L[2], kText(H, 0, 4, 2, true)); say('k = 2：8 + 8 = 16'); },
    () => { txt(L[3], kText(H, 0, 4, 3, true)); say('k = 3：19 + 3 = 22'); },
    () => { txt(L[4], kText(H, 0, 4, 4, true)); say('k = 4：25 + 0 = 25'); },
    () => { P.add('min(19, 16, 22, 25) + 16'); cls(L[2], 'ptr alt'); say('min(19, 16, 22, 25) + w(0,4) = 16 + 16'); },
    () => { T.clear(); T.coolW(); T.setC(0, 4, H.c[0][4]); T.mark(0, 4, DONE); P.add('c(0,4) = 16 + 16 = ' + H.c[0][4], 'ptr alt'); say('c(0,4) = 32'); },
    () => { T.setR(0, 4, H.r[0][4]); say('給出最小值的是 k = 2 → root 2'); },
    async () => {
      say('從小的算到大的', '算大的時候，小的都已經在表裡');
      const cs = cellsOf(4);
      await anim(tok, 1600, (u) => { const d = Math.min(4, Math.floor(u * 5)); cs.forEach(([i, j]) => T.mark(i, j, j - i === d ? MARK : j - i === 4 ? DONE : PAPER)); });
      cs.forEach(([i, j]) => T.mark(i, j, j - i === 4 ? DONE : PAPER));
    },
    () => { P.add('tabular approach：由小到大填表', 'good'); say('這就是 DP 的 tabular approach'); },
    () => { P.add('數值乘過 16 → 32 / 16 = 2', 'ptr alt'); say('機率乘了 16：真正的成本 32 / 16 = 2'); },
    () => { P.add('每格都取 min → 間接試過所有 root', 'good'); say('每次都取最小', '等於間接試過所有的樹'); },
  ]);
}]);

FRAG.push(['dp4bari2-tbuild', '用 r 表建出最佳 BST', async (tok) => {
  const H = HB, T = stageB(H, null, 'cr');
  const KY = [10, 20, 30, 40]; let lt, rt;
  const sqAt = (x, y, px, py) => { line(px, py - 0.4, x, y + 0.2, 0, LINEC); cube('', GRAY, [0.36, 0.36, 0.36], x, y, 0, 0.8); };
  const nd = {};
  await run(tok, [
    () => { Object.values(T.r).forEach((l) => cls(l, 'ptr')); say('用表裡的 r 決定樹的形狀'); },
    () => { T.mark(0, 4, MARK); tag('整棵樹 = key 1…4 → 看 r(0,4)', 'say', 3.6, 7.4); say('整棵樹：看 r(0,4)', 'i 從 0 開始，配合 q0'); },
    () => { nd[20] = tnode(20, 3.6, 6.3, 0, null, TEAL); tag('r(0,4) = 2 → 第 2 個 key', 'note', 5.6, 6.6); say('r(0,4) = 2 → 第 2 個 key 20 當 root'); },
    () => { lt = tag('左：(i, k−1)', 'idx', 2.0, 5.75); rt = tag('右：(k, j)', 'idx', 5.2, 5.75); say('root 是 k：左邊 (i, k−1)、右邊 (k, j)'); },
    () => { txt(lt, '左：(0,1)'); txt(rt, '右：(2,4)'); cls(lt, 'ptr'); cls(rt, 'ptr'); say('左邊 (0,1)，右邊 (2,4)'); },
    () => { T.mark(0, 4); T.mark(0, 1, MARK); nd[10] = tnode(10, 2.0, 4.9, 0, nd[20], BLUE); say('r(0,1) = 1 → 10 在左邊'); },
    () => { T.mark(0, 1); T.mark(2, 4, MARK); say('(2,4)：還有 30、40 兩個 key', '表會告訴你誰當 root'); },
    () => { nd[30] = tnode(30, 5.2, 4.9, 0, nd[20], BLUE); say('r(2,4) = 3 → 30'); },
    () => { T.mark(2, 4); nd[40] = tnode(40, 6.3, 3.5, 0, nd[30], BLUE); say('剩下 40 → 放在 30 的右邊'); },
    () => { T.mark(3, 4, MARK); sqAt(1.5, 3.7, 2.0, 4.9); sqAt(2.5, 3.7, 2.0, 4.9); sqAt(4.6, 3.7, 5.2, 4.9); sqAt(5.8, 2.3, 6.3, 3.5); sqAt(6.8, 2.3, 6.3, 3.5); say('r(3,4) = 4 ✓', '其他位置是 null（方塊）'); },
    () => { T.mark(3, 4); Object.values(nd).forEach((m) => glow(m, GREEN)); say('最佳 BST：20 當 root', '10 在左、30 在右、40 在 30 的右邊'); },
    () => { tag('好像試過所有的樹，挑了最好的', 'good', 4.0, 1.4); say('就像試過所有 BST 再挑最好的'); },
    () => { tag('同類問題 → 同一套 DP 策略', 'say', 4.0, 0.8); say('類似的問題，可以用同樣的 DP 策略'); },
  ]);
}]);

// ═════════════════ vLS-zRCHo-Y：Optimal BST（只考慮成功搜尋的頻率） ═════════════════
FRAG.push(['dp4bari2-bst2', 'BST：建樹與搜尋 50、45', async (tok) => {
  K.fresh([0, 4.2, 13.5], [0, 3.4, 0]);
  const row = {}, nd = {}; let cur, ex;
  const keysIn = [40, 20, 10, 30, 60, 50, 70];
  const place = async (ks) => {
    await Promise.all(ks.map((k) => { const [x, y] = B7[k]; return travel(tok, row[k], row[k].position.clone(), V3(x, y, 0), 900); }));
    ks.forEach((k) => { nd[k] = row[k]; const par = B7[k][2]; if (par) line(B7[par][0], B7[par][1], B7[k][0], B7[k][1]); });
  };
  const goto = async (k) => { const [x, y] = above(k); await goTo(tok, cur, x, y); glow(nd[k], GOLD); };
  await run(tok, [
    () => { [10, 20, 30, 40, 50, 60, 70].forEach((k, t) => (row[k] = cube(k, BLUE, [0.9, 0.9, 0.9], -4.5 + t * 1.5, 1.0, 0, 1.2))); say('給一組 key，目的是搜尋'); },
    () => { tag('linear search、binary search… binary tree 也能用來搜尋嗎？', 'say', 0, 7.3); say('除了 linear、binary search', 'binary tree 能不能拿來搜尋？'); },
    async () => { say('排成 binary tree：40 當 root', '20 在左邊，10 在 20 的左邊'); await place([40, 20, 10]); },
    async () => { say('30 在 20 右邊；右邊是 60、50、70'); await place([30, 60, 50, 70]); },
    () => { [10, 20, 30].forEach((k) => tint(nd[k], TEAL)); [50, 60, 70].forEach((k) => tint(nd[k], PURPLE)); say('任何節點：左邊都比它小、右邊都比它大'); },
    () => { keysIn.forEach((k) => tint(nd[k], BLUE)); cur = tag('找 50', 'pkt', 0, 7.05); glow(nd[40], GOLD); say('找 50：從 root 開始', '40 是 50 嗎？不是'); },
    async () => { say('50 > 40 → 一定在右邊'); await goto(60); glow(nd[40], null); },
    async () => { say('50 < 60 → 往左：找到了'); await goto(50); glow(nd[60], null); tint(nd[50], TEAL); glow(nd[50], GREEN); },
    () => { glow(nd[50], null); tint(nd[50], BLUE); [6.2, 4.9, 3.6].forEach((y, t) => tag('level ' + (t + 1), 'ptr', -6.2, y)); say('最多比較次數 = 樹的高度', '要找的在 leaf 時最久'); },
    () => { tag('高度最小 ≈ log n', 'good', 4.6, 7.3); say('最小高度約 log n', '搜尋時間 O(log n)'); },
    async () => { kill(cur); cur = tag('找 45', 'pkt', 0, 7.05); glow(nd[40], GOLD); say('找 45：45 > 40 → 往右'); await goto(60); glow(nd[40], null); },
    async () => { say('45 < 60、45 < 50 → 往左', '沒有了：停在這裡'); await goto(50); glow(nd[60], null); line(1.4, 3.2, 0.7, 2.62, 0, LINEC); ex = cube('', RED, [0.42, 0.42, 0.42], 0.7, 2.4, 0, 0.8); glow(ex, DRED); await goTo(tok, cur, 0.7, 3.1, 400); },
    () => { tag('unsuccessful search', 'bad', 0.7, 1.75); say('找不到：unsuccessful search', '搜尋可能成功，也可能失敗'); },
  ]);
}]);

FRAG.push(['dp4bari2-bst5avg', '3 個 key 的 5 棵 BST：平均比較次數', async (tok) => {
  K.fresh([0, 4.2, 14], [0, 3.8, 0]);
  const all = []; const tr = [];
  const avg = (t) => { const s = T5[t].reduce((a, x) => a + x[2], 0); tag(s + '/3' + (s === 6 ? ' = 2' : ''), s < 6 ? 'good' : 'ptr alt', T5X[t], 2.7); };
  await run(tok, [
    () => { [10, 20, 30].forEach((k, t) => all.push(cube(k, BLUE, [0.8, 0.8, 0.8], -1.5 + t * 1.5, 1.2, 0, 1.2))); say('3 個 key：可以建出幾種 BST？'); },
    () => { all.forEach(kill); tr[0] = drawT5(0, all); say('10 當 root，20 在右，30 再右'); },
    async () => { for (let t = 1; t < 5; t++) { tr[t] = drawT5(t, all); await anim(tok, 300, () => {}); } say('10、30、20；20 在中間；30 當 root…'); },
    () => { tag('3 個 key → 5 棵 BST', 'ptr', 0, 7.3); say('3 個 key 一共 5 種 BST'); },
    () => { mono(tag('n 個 key：(2n C n) / (n + 1)', 'ptr', 0, 1.9)); say('n 個 key：(2n C n) / (n + 1) 棵'); },
    () => { mono(tag('n = 3：6C3 / 4 = 5', 'ptr alt', 0, 1.35)); say('n = 3：6C3 / 4 = 5'); },
    () => { tag('成本 = 比較次數', 'say', -4.3, 7.3); say('搜尋成本看比較次數'); },
    () => { Object.values(tr[0]).forEach((m) => tag(m.userData.lv + ' 次', 'idx', m.position.x + 0.75, m.position.y + 0.2)); say('root 比 1 次、第 2 層 2 次、第 3 層 3 次'); },
    () => { avg(0); say('第 1 棵平均：(1 + 2 + 3) / 3 = 2'); },
    () => { avg(1); say('第 2 棵：一樣是 6/3 = 2'); },
    () => { avg(2); say('第 3 棵：(1 + 2 + 2) / 3 = 5/3', '比 2 小'); },
    () => { avg(3); say('第 4 棵：6/3 = 2'); },
    () => { avg(4); say('第 5 棵：6/3 = 2'); },
    () => { Object.values(tr[2]).forEach((m) => glow(m, GREEN)); say('5 棵裡，這棵平均比較次數最少'); },
    () => { tag('高度小 → balanced BST', 'good', 0, 7.3); say('因為它的高度最小：height balanced BST'); },
  ]);
}]);

FRAG.push(['dp4bari2-bst5freq', '加上搜尋頻率：成本 17 的樹最好', async (tok) => {
  K.fresh([0, 4.2, 14], [0, 3.8, 0]);
  const f = [3, 2, 5], fk = (k) => f[[10, 20, 30].indexOf(k)];
  const all = [], tr = [], bars = []; let km = [];
  const cost = (t) => {
    const parts = T5[t].map(([k, , lv]) => lv + '×' + fk(k)), v = T5[t].reduce((a, [k, , lv]) => a + lv * fk(k), 0);
    Object.values(tr[t]).forEach((m) => tag(m.userData.lv + '×' + fk(+m.userData.lbl.element.textContent), 'idx', m.position.x + 0.7, m.position.y + 0.2));
    tag(String(v), v === 17 ? 'good' : 'ptr alt', T5X[t], 2.7);
    return parts.join(' + ') + ' = ' + v;
  };
  await run(tok, [
    () => { km = [10, 20, 30].map((k, t) => cube(k, BLUE, [0.8, 0.8, 0.8], -2 + t * 2, 1.2, 0, 1.2)); say('Optimal BST：還要看每個 key 的搜尋頻率'); },
    () => { km.forEach((m, t) => all.push(tag('頻率 ' + f[t], 'note', m.position.x, 0.45))); say('10 搜尋 3 次、20 搜尋 2 次、30 搜尋 5 次'); },
    async () => {
      const ms = km.map((m, t) => { const b = cube('', ORANGE, [0.5, 1, 0.5], m.position.x + 0.75, 0.8, 0); b.scale.y = 0.001; bars.push(b); return [b, f[t] * 0.4]; });
      say('不是每個 key 都一樣常被找', '有的常用、有的很少用');
      await anim(tok, 900, (u) => ms.forEach(([b, h]) => { b.scale.y = Math.max(0.001, h * u); b.position.y = 0.8 + h * u / 2; }));
    },
    () => { glow(km[2], GOLD); say('30 的頻率最高'); },
    () => { km.concat(bars).concat(all).forEach(kill); for (let t = 0; t < 5; t++) tr[t] = drawT5(t, []); tag('成本 = Σ 層數 × 頻率', 'ptr', 0, 7.3); say('哪一種樹的安排最好？', '成本 = Σ 層數 × 頻率'); },
    () => { const s = cost(0); tag('影片口算 18，實為 22', 'bad', T5X[0], 2.1); say('第 1 棵：' + s); },
    () => { say('第 2 棵：' + cost(1)); },
    () => { say('第 3 棵：' + cost(2)); },
    () => { say('第 4 棵：' + cost(3)); },
    () => { say('第 5 棵：' + cost(4)); },
    () => { Object.values(tr[3]).forEach((m) => glow(m, GREEN)); tag('optimal ✓', 'good', T5X[3], 7.0); say('30 當 root 的這棵成本 17 最小', '它就是 optimal BST'); },
    () => { tag('balanced 但 18', 'note', T5X[2], 2.1); say('它不是高度平衡的', '但依頻率算，成本最小'); },
    () => { tag('問題：給定 key 和頻率 → 找成本最小的 BST', 'say', 0, 1.3); say('問題：給定 key 和頻率', '找成本最小的 BST'); },
  ]);
}]);

FRAG.push(['dp4bari2-ftab', 'DP 表：先填一個 key 的格子', async (tok) => {
  const H = HV; let T; const P = pad(3.4, 5.8, 0.5);
  K.fresh([0, 4.4, 15], [0, 3.8, 0]);
  await run(tok, [
    () => { mono(tag('key   10  20  30  40', 'ptr', 3.4, 7.4)); mono(tag('freq   4   2   6   3', 'idx', 3.4, 6.95)); say('例題：key 10、20、30、40', '頻率 4、2、6、3'); },
    () => { T = obTable(4, { layout: 'ij', w: false, X0: -5.2, Y0: 6.4, CW: 1.15, CH: 1.0 }); say('畫一張表，填好後就能建出樹'); },
    () => { P.add('表從 0 開始；key 從 1 開始', 'note'); say('key 是 1~4，表卻從 0 開始', '這樣才配合公式'); },
    () => { P.add('row = i、column = j'); say('列叫 i、行叫 j'); },
    () => { for (let i = 0; i <= 4; i++) T.mark(i, i, MARK); P.add('先填 j − i = 0：c(0,0)…c(4,4)'); say('先算 j − i = 0 的格子', '0−0、1−1、2−2…'); },
    () => { for (let i = 0; i <= 4; i++) { T.mark(i, i); T.setC(i, i, 0); } say('對角線全部填 0', '沒有 key，成本 0'); },
    () => { for (let i = 0; i < 4; i++) T.mark(i, i + 1, MARK); P.add('再來 j − i = 1'); say('下一條對角線：j − i = 1'); },
    () => { P.add('c(0,1)、c(1,2)、c(2,3)、c(3,4)'); say('要算 c(0,1)、c(1,2)、c(2,3)、c(3,4)'); },
    () => { T.mark(0, 1); T.setC(0, 1, H.c[0][1]); T.setR(0, 1, 1); P.add('c(0,1)：只有 10 → 頻率 4', 'ptr alt'); say('c(0,1)：只看 key 10', '成本 = 頻率 4'); },
    () => { T.mark(1, 2); T.setC(1, 2, H.c[1][2]); T.setR(1, 2, 2); say('c(1,2)：只有 20 → 2'); },
    () => { T.mark(2, 3); T.setC(2, 3, H.c[2][3]); T.setR(2, 3, 3); say('c(2,3)：只有 30 → 6'); },
    () => { T.mark(3, 4); T.setC(3, 4, H.c[3][4]); T.setR(3, 4, 4); P.add('一個 key：成本 = 它的頻率', 'good'); say('c(3,4)：只有 40 → 3', '4、2、6、3'); },
  ]);
}]);

// two small trees for two keys a < b: left = a as root, right = b as root
function twoTrees(ka, kb, fa, fb, all) {
  const a1 = tnode(ka, 1.9, 5.9, 0, null, BLUE), b1 = tnode(kb, 2.8, 4.7, 0, a1, BLUE);
  const b2 = tnode(kb, 5.4, 5.9, 0, null, BLUE), a2 = tnode(ka, 4.5, 4.7, 0, b2, BLUE);
  all.push(a1, b1, b1.userData.edge, b2, a2, a2.userData.edge);
  return { A: [a1, b1], B: [b2, a2], vA: fa + 2 * fb, vB: fb + 2 * fa };
}
FRAG.push(['dp4bari2-two02', '兩個 key：c(0,2) = 8', async (tok) => {
  const H = HV, T = stageV(H, [0, 2]), P = pad(3.6, 3.2, 0.5), all = []; let tt, l1, l2;
  await run(tok, [
    () => { [[0, 2], [1, 3], [2, 4]].forEach(([i, j]) => T.mark(i, j, MARK)); say('j − i = 2：c(0,2)、c(1,3)、c(2,4)', '每次看兩個 key'); },
    () => { T.mark(1, 3); T.mark(2, 4); say('先算 c(0,2)'); },
    () => { all.push(tag('key 10、20；頻率 4、2', 'say', 3.6, 6.65)); say('不看 0，從 1 開始：key 10、20', '頻率 4、2'); },
    () => { tt = twoTrees(10, 20, 4, 2, all); say('兩個 key：兩種 BST', '10 當 root，或 20 當 root'); },
    () => { all.push(tag('1×4 + 2×2 = ' + tt.vA, 'ptr alt', 2.35, 3.9)); say('10 當 root：1×4 + 2×2 = 8'); },
    () => { all.push(tag('1×2 + 2×4 = ' + tt.vB, 'ptr alt', 4.95, 3.9)); say('20 當 root：1×2 + 2×4 = 10'); },
    () => { tt.A.forEach((m) => glow(m, GREEN)); T.mark(0, 2); T.setC(0, 2, H.c[0][2]); T.setR(0, 2, H.r[0][2]); say('最小是 8：c(0,2) = 8', 'root = 第 1 個 key'); },
    () => { P.add('w(i,j) = 這段 key 的頻率和'); P.add('w(0,2) = 4 + 2 = 6'); say('用公式看看：先認識 w', 'w = 這段 key 的頻率總和'); },
    () => { l1 = P.add('root 1：c(0,0) + c(1,2) + w(0,2)'); kArrows(T, 0, 2, 1); say('root 1：c(0,0) + c(1,2) + w(0,2)', '左子樹 + 右子樹 + w'); },
    () => { T.glowC(0, 0); T.glowC(1, 2); txt(l1, 'root 1：0 + 2 + w(0,2)'); say('從表裡查：c(0,0) = 0、c(1,2) = 2'); },
    () => { txt(l1, 'root 1：0 + 2 + 6 = 8 ✓'); cls(l1, 'ptr alt'); say('w(0,2) = 6 → 0 + 2 + 6 = 8', '和直接算的一樣'); },
    () => { T.clear(); l2 = P.add('root 2：c(0,1) + c(2,2) + w(0,2)'); kArrows(T, 0, 2, 2); say('root 2：c(0,1) + c(2,2) + w(0,2)'); },
    () => { T.glowC(0, 1); T.glowC(2, 2); txt(l2, 'root 2：4 + 0 + 6 = 10 ✓'); say('4 + 0 + 6 = 10', '也和直接算的一樣'); },
    () => { T.clear(); P.add('取 min → 8', 'good'); say('最小的是 8，就寫進表裡'); },
  ]);
}]);

FRAG.push(['dp4bari2-two1324', '兩個 key：c(1,3) = 10、c(2,4) = 12', async (tok) => {
  const H = HV, T = stageV(H, [1, 3]); let all = [], tt;
  await run(tok, [
    () => { T.mark(1, 3, MARK); all.push(tag('c(1,3)：key 20、30', 'say', 3.6, 6.65)); say('c(1,3)：不看 1，看 key 2、3', '20、30'); },
    () => { tt = twoTrees(20, 30, 2, 6, all); all.push(tag('頻率 2、6', 'note', 3.6, 6.2)); say('頻率 2、6：兩種樹'); },
    () => { all.push(tag('1×2 + 2×6 = ' + tt.vA, 'ptr alt', 2.35, 3.9)); say('20 當 root：2 + 12 = 14'); },
    () => { all.push(tag('1×6 + 2×2 = ' + tt.vB, 'ptr alt', 4.95, 3.9)); say('30 當 root：6 + 4 = 10'); },
    () => { tt.B.forEach((m) => glow(m, GREEN)); T.mark(1, 3); T.setC(1, 3, H.c[1][3]); T.setR(1, 3, H.r[1][3]); say('c(1,3) = 10', '第 3 個 key 當 root'); },
    () => { all.forEach(kill); all = []; T.mark(2, 4, MARK); all.push(tag('c(2,4)：key 30、40；頻率 6、3', 'say', 3.6, 6.65)); say('c(2,4)：key 30、40', '頻率 6、3'); },
    () => { tt = twoTrees(30, 40, 6, 3, all); say('30 當 root，或 40 當 root'); },
    () => { all.push(tag('1×6 + 2×3 = ' + tt.vA, 'ptr alt', 2.35, 3.9)); say('30 當 root：6 + 6 = 12'); },
    () => { all.push(tag('1×3 + 2×6 = ' + tt.vB, 'ptr alt', 4.95, 3.9)); say('40 當 root：3 + 12 = 15'); },
    () => { tt.A.forEach((m) => glow(m, GREEN)); T.mark(2, 4); T.setC(2, 4, H.c[2][4]); T.setR(2, 4, H.r[2][4]); say('c(2,4) = 12', '第 3 個 key 當 root'); },
    () => { [[0, 2], [1, 3], [2, 4]].forEach(([i, j]) => T.mark(i, j, DONE)); say('j − i = 2 這條對角線填好了'); },
  ]);
}]);

// Formula working for c(i,j) in the ij table: lines per root k, then values, then min
function rootLines(T, H, P, i, j) {
  const L = {};
  L.add = (ks) => ks.forEach((k) => { L[k] = P.add('root ' + k + '：c(' + i + ',' + (k - 1) + ') + c(' + k + ',' + j + ')'); kArrows(T, i, j, k); });
  L.val = (k) => { T.clear(); T.glowC(i, k - 1); T.glowC(k, j); txt(L[k], 'root ' + k + '：' + H.c[i][k - 1] + ' + ' + H.c[k][j] + ' = ' + (H.c[i][k - 1] + H.c[k][j])); };
  return L;
}
FRAG.push(['dp4bari2-three03', '三個 key：c(0,3) = 20', async (tok) => {
  const H = HV, T = stageV(H, [0, 3]), P = pad(3.6, 3.6, 0.48), all = []; let L;
  const MT = [
    [[10, 0, 0, null], [20, 0.4, 1, 10], [30, 0.8, 2, 20]],
    [[10, 0, 0, null], [30, 0.4, 1, 10], [20, 0, 2, 30]],
    [[20, 0, 0, null], [10, -0.4, 1, 20], [30, 0.4, 1, 20]],
    [[30, 0, 0, null], [20, -0.4, 1, 30], [10, -0.8, 2, 20]],
    [[30, 0, 0, null], [10, -0.4, 1, 30], [20, 0, 2, 10]],
  ];
  const tx = [1.0, 2.4, 3.8, 5.2, 6.4];
  await run(tok, [
    () => { T.mark(0, 3, MARK); T.mark(1, 4, MARK); say('j − i = 3：c(0,3)、c(1,4)', '每次看三個 key'); },
    () => { T.mark(1, 4); all.push(tag('c(0,3)：key 10、20、30；頻率 4、2、6', 'say', 3.6, 6.65)); say('c(0,3)：key 10、20、30', '頻率 4、2、6'); },
    () => { miniTree(MT[0], tx[0], 6.0, 0.6, all, 0.42); say('10 當 root：20、30 在右邊'); },
    () => { miniTree(MT[1], tx[1], 6.0, 0.6, all, 0.42); say('10 當 root：30、20'); },
    () => { miniTree(MT[2], tx[2], 6.0, 0.6, all, 0.42); say('20 當 root：10 在左、30 在右'); },
    () => { miniTree(MT[3], tx[3], 6.0, 0.6, all, 0.42); miniTree(MT[4], tx[4], 6.0, 0.6, all, 0.42); say('30 當 root：兩種'); },
    () => { all.push(tag('3 個 key → 5 棵：直接用公式', 'note', 3.6, 4.3)); say('一共 5 棵：這次直接用公式'); },
    () => { P.add('w(0,3) = 4 + 2 + 6 = 12'); say('w(0,3) = 4 + 2 + 6 = 12'); L = rootLines(T, H, P, 0, 3); },
    () => { L.add([1]); say('root 1：c(0,0) + c(1,3) + 12'); },
    () => { L.add([2, 3]); say('root 2：c(0,1) + c(2,3) + 12', 'root 3：c(0,2) + c(3,3) + 12'); },
    () => { L.val(1); txt(L[1], L[1].element.textContent + ' → +12 = 22'); say('0 + 10 + 12 = 22'); },
    () => { L.val(2); txt(L[2], L[2].element.textContent + ' → +12 = 22'); say('4 + 6 + 12 = 22'); },
    () => { L.val(3); txt(L[3], L[3].element.textContent + ' → +12 = 20'); cls(L[3], 'ptr alt'); say('8 + 0 + 12 = 20'); },
    () => { T.clear(); T.mark(0, 3); T.setC(0, 3, H.c[0][3]); T.setR(0, 3, H.r[0][3]); say('c(0,3) = 20', '第 3 個 key 當 root'); },
  ]);
}]);

FRAG.push(['dp4bari2-c14', '三個 key：c(1,4) = 16', async (tok) => {
  const H = HV, T = stageV(H, [1, 4]), P = pad(3.6, 5.6, 0.5); let L;
  await run(tok, [
    () => { T.mark(1, 4, MARK); P.add('c(1,4)：key 20、30、40', 'say'); say('c(1,4)：不看 1，從第 2 個 key 開始', '20、30、40'); },
    () => { P.add('頻率 2、6、3：直接用公式', 'note'); say('頻率 2、6、3', '不畫樹，直接用公式'); },
    () => { P.add('w(1,4) = 2 + 6 + 3 = 11'); say('w(1,4) = 2 + 6 + 3 = 11'); L = rootLines(T, H, P, 1, 4); },
    () => { L.add([2]); say('root 2：c(1,1) + c(2,4)'); },
    () => { L.add([3, 4]); say('root 3：c(1,2) + c(3,4)', 'root 4：c(1,3) + c(4,4)'); },
    () => { L.val(2); say('0 + 12 = 12'); },
    () => { L.val(3); say('2 + 3 = 5'); },
    () => { L.val(4); say('10 + 0 = 10'); },
    () => { T.clear(); cls(L[3], 'ptr alt'); P.add('min 5 + 11 = 16', 'ptr alt'); say('最小 5 → 5 + 11 = 16'); },
    () => { T.mark(1, 4); T.setC(1, 4, H.c[1][4]); T.setR(1, 4, H.r[1][4]); say('c(1,4) = 16', 'root 又是 3'); },
  ]);
}]);

FRAG.push(['dp4bari2-c04', '四個 key：c(0,4) = 26', async (tok) => {
  const H = HV, T = stageV(H, [0, 4]), P = pad(3.6, 5.6, 0.48); let L;
  await run(tok, [
    () => { T.mark(0, 4, MARK); P.add('j − i = 4：c(0,4)', 'say'); say('最後 j − i = 4：c(0,4)', '全部四個 key'); },
    () => { P.add('key 10 20 30 40；頻率 4 2 6 3', 'note'); say('直接用公式：key 10、20、30、40'); },
    () => { P.add('w(0,4) = 4 + 2 + 6 + 3 = 15'); L = rootLines(T, H, P, 0, 4); say('w(0,4) = 15'); },
    () => { L.add([1]); say('root 1：c(0,0) + c(1,4)'); },
    () => { L.add([2]); say('root 2：c(0,1) + c(2,4)'); },
    () => { L.add([3, 4]); say('root 3：c(0,2) + c(3,4)', 'root 4：c(0,3) + c(4,4)'); },
    () => { P.add('每個都 + 15'); say('每一個都要加上 w(0,4) = 15'); },
    () => { L.val(1); say('0 + 16 = 16'); },
    () => { L.val(2); say('4 + 12 = 16'); },
    () => { L.val(3); say('8 + 3 = 11'); },
    () => { L.val(4); say('20 + 0 = 20'); },
    () => { T.clear(); cls(L[3], 'ptr alt'); P.add('min(16, 16, 11, 20) + 15 = 26', 'ptr alt'); say('最小 11 → 11 + 15 = 26'); },
    () => { T.mark(0, 4, DONE); T.setC(0, 4, H.c[0][4]); T.setR(0, 4, H.r[0][4]); say('c(0,4) = 26，root = 3', '最佳 BST 的成本'); },
  ]);
}]);

FRAG.push(['dp4bari2-build2', '用 root 建出最佳 BST', async (tok) => {
  const H = HV, T = stageV(H, null); const nd = {}; let lt, rt;
  const sqAt = (x, y, px, py) => { line(px, py - 0.4, x, y + 0.2, 0, LINEC); cube('', GRAY, [0.36, 0.36, 0.36], x, y, 0, 0.8); };
  await run(tok, [
    () => { T.mark(0, 4, MARK); Object.values(T.r).forEach((l) => cls(l, 'ptr')); say('成本 26、root 3：接著建出樹'); },
    () => { nd[30] = tnode(30, 3.9, 6.3, 0, null, TEAL); tag('r(0,4) = 3：第 3 個 key', 'note', 3.9, 7.3); say('r(0,4) = 3 → 第 3 個 key = 30', '3 是 key 的編號'); },
    () => { lt = tag('左 r(0,2)', 'ptr', 2.2, 5.75); rt = tag('右 r(3,4)', 'ptr', 5.6, 5.75); say('左邊看 r(0,2)、右邊看 r(3,4)'); },
    () => { T.mark(0, 4); T.mark(0, 2, MARK); nd[10] = tnode(10, 2.2, 4.9, 0, nd[30], BLUE); sqAt(1.6, 3.6, 2.2, 4.9); say('r(0,2) = 1 → 10', '它的左邊 (0,0) 是空的'); },
    () => { T.mark(0, 2); T.mark(1, 2, MARK); nd[20] = tnode(20, 3.0, 3.5, 0, nd[10], BLUE); say('右邊看 r(1,2) = 2 → 20'); },
    () => { T.mark(1, 2); sqAt(2.5, 2.3, 3.0, 3.5); sqAt(3.5, 2.3, 3.0, 3.5); say('r(1,1)、r(2,2) = 0', '空的'); },
    () => { T.mark(3, 4, MARK); nd[40] = tnode(40, 5.6, 4.9, 0, nd[30], BLUE); say('r(3,4) = 4 → 40'); },
    () => { T.mark(3, 4); sqAt(5.0, 3.6, 5.6, 4.9); sqAt(6.2, 3.6, 5.6, 4.9); say('r(3,3)、r(4,4) = 0', '空的'); },
    () => { kill(lt); kill(rt); Object.values(nd).forEach((m) => glow(m, GREEN)); say('30 當 root；左 10，10 的右邊 20', '右邊 40'); },
    () => { tag('依頻率，搜尋成本最小', 'good', 3.9, 1.4); say('這就是 optimal BST', '依頻率算，搜尋成本最小'); },
    () => { mono(tag('c(i,j) = min{ c(i,k−1) + c(k,j) } + w(i,j)', 'ptr', 3.6, 0.8)); say('填表用的公式', 'c(i,j) = min{c(i,k−1) + c(k,j)} + w(i,j)'); },
    () => { tag('i < k ≤ j：所以表從 0 開始編', 'note', 3.6, 0.2); say('k 從 i + 1 開始', '所以 i 從 0 寫起'); },
  ]);
}]);

// ═════════════════ uJOmqBwENB8：4.8 Reliability design ═════════════════
const RD = { c: [30, 15, 20], r: [0.9, 0.8, 0.5], C: 105 };
const pr = (r, c) => '(' + fr(r) + ', ' + c + ')';
const pairBox = (r, c, x, y, drop = 1.0, color = TEAL) => cube(pr(r, c), color, [1.75, 0.45, 0.4], x, y, 0, drop);
const badBox = (c, x, y) => { const m = cube('$' + c + ' ✗', RED, [1.75, 0.45, 0.4], x, y, 0, 0.8); glow(m, DRED); return m; };
function setCol(title, list, x, yTop = 5.6, dy = 0.7) { tag(title, 'ptr', x, yTop + 0.65); return list.map(([r, c], t) => pairBox(r, c, x, yTop - t * dy, 0)); }

FRAG.push(['dp4bari2-rel-series', '串聯系統：可靠度相乘', async (tok) => {
  K.fresh([0, 4.4, 13], [0, 2.8, 0]);
  const X = (k) => -4.5 + k * 3, NM = [['📋', '白板'], ['📷', '相機'], ['💡', '燈'], ['🖊️', '白板筆']];
  const ds = []; let me, rt = [];
  await run(tok, [
    () => { line(-6.6, 2.6, 6.6, 2.6, 0, '#6e5f49'); tag('開始 →', 'idx', -6.2, 3.0); tag('→ 系統正常', 'idx', 6.0, 3.0); me = buddy('錄影的人', '', ORANGE, 0, 4.9, -0.8, 0.7); say('要架設一個系統'); },
    () => { for (let k = 0; k < 4; k++) ds.push(cube('D' + (k + 1), BLUE, [1.3, 0.9, 0.9], X(k), 2.6, 0, 1.5)); say('系統由裝置 D1、D2、D3、D4 組成'); },
    () => { NM.forEach(([g, n], k) => icon(g, n, X(k), 3.9, 0, 'sm')); say('例如錄影室：白板、相機、燈、筆…', '這些都叫裝置（device）'); },
    () => { for (let k = 0; k < 4; k++) tag('cost c' + (k + 1), 'idx', X(k), 1.75); say('每個裝置有成本 cᵢ'); },
    () => { [['可靠度高', 'good'], ['', ''], ['比較低', 'note'], ['更低', 'bad']].forEach(([t, c], k) => { if (t) rt.push(tag(t, c, X(k), 1.25)); }); say('reliability：正常運作的機率', '白板很可靠；燈、筆比較容易出問題'); },
    () => { rt.forEach(kill); for (let k = 0; k < 4; k++) tag('r = 0.9', 'ptr', X(k), 1.25); say('假設每個裝置的 reliability 都是 0.9'); },
    async () => {
      const cur = tag('R = 1', 'pkt', -6.2, 3.45); let R = 1;
      say('系統的 reliability = 全部相乘', '0.9 × 0.9 × 0.9 × 0.9');
      for (let k = 0; k < 4; k++) { await goTo(tok, cur, X(k), 3.45, 450); R *= 0.9; glow(ds[k], GOLD); txt(cur, 'R = ' + fr(R)); }
    },
    () => { ds.forEach((m) => glow(m, null)); tag('每個 0.9，整個系統只有 0.6561', 'say', 0, 6.3); say('每個都 0.9，系統卻只有 0.65'); },
    () => { tint(ds[2], RED); glow(ds[2], DRED); me.mood('sad'); tag('燈壞了 → 錄影中斷', 'bad', X(2), 0.6); say('約 35% 的機率系統會停', '任何一個壞掉就得停'); },
    () => { tint(ds[2], BLUE); glow(ds[2], null); me.mood('happy'); tag('目標：讓系統 reliability 最大', 'good', -3.0, 0.6); say('目標：讓整個系統最可靠'); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-stage', '一個 stage 放多份並聯：1 − (1−r)^m', async (tok) => {
  K.fresh([0, 4.4, 13], [0, 3.6, 0]);
  const X = (k) => -4.5 + k * 3, main = [], cps = []; let tmp, cs = [];
  await run(tok, [
    () => {
      line(-6.6, 6.0, 6.6, 6.0, 0, '#6e5f49');
      for (let k = 0; k < 4; k++) { main.push(cube('D' + (k + 1), BLUE, [1.2, 0.7, 0.8], X(k), 6.0, 0)); cps.push([1, 2].map((c) => cube('D' + (k + 1), '#9cc8f0', [1.1, 0.6, 0.7], X(k), 6.0 - c * 1.0, 0, 1.2))); }
      say('辦法：每種裝置多準備幾份');
    },
    () => { tint(main[1], RED); glow(main[1], DRED); glow(cps[1][0], GREEN); tmp = tag('相機壞了 → 備用的頂上', 'say', X(1), 3.2); say('一台相機壞了，就換另一台繼續錄'); },
    () => {
      kill(tmp); tint(main[1], BLUE); glow(main[1], null); glow(cps[1][0], null);
      for (let k = 0; k < 4; k++) { line(X(k) - 0.8, 6.0, X(k) - 0.8, 4.0, 0, '#6e5f49'); line(X(k) + 0.8, 6.0, X(k) + 0.8, 4.0, 0, '#6e5f49'); }
      tag('原本：series（串聯）→ 每種改成 parallel（並聯）', 'ptr', 0, 7.2); say('原本串聯；同一種裝置改成並聯');
    },
    () => { for (let k = 0; k < 4; k++) { const g = ghostBox(ORANGE, 2.0, 2.8, 1.2); g.position.set(X(k), 5.0, 0); tag('stage ' + (k + 1), 'ptr alt', X(k), 3.2); } say('每一組叫一個 stage'); },
    () => { main.forEach((m) => glow(m, GREEN)); tag('一份在工作，其他當 backup', 'note', 0, 2.4); say('一份在工作，其他份當 backup', '它壞了，backup 接手'); },
    () => {
      K.fresh([0, 4.4, 13], [0, 3.6, 0]);
      const ys = [5.6, 4.3, 3.0];
      line(-5.5, 4.3, -2.5, 4.3, 0, '#6e5f49'); line(2.5, 4.3, 5.5, 4.3, 0, '#6e5f49'); line(-2.5, 5.6, -2.5, 3.0, 0, '#6e5f49'); line(2.5, 5.6, 2.5, 3.0, 0, '#6e5f49');
      cs = ys.map((y, k) => { line(-2.5, y, 2.5, y, 0, '#6e5f49'); return cube('D1 #' + (k + 1), BLUE, [1.5, 0.8, 0.8], 0, y, 0, 1.4); });
      tag('stage 1：3 份 D1 並聯', 'ptr', 0, 6.7); say('一個 stage 放 3 份 D1', '每份 reliability 0.9');
    },
    () => { cs.forEach((m) => tag('r = 0.9', 'idx', 1.5, m.position.y)); tag('壞掉的機率：1 − 0.9 = 0.1', 'note', 0, 7.3); say('一份正常 0.9；壞掉的機率 1 − 0.9 = 0.1'); },
    async () => { say('3 份同時壞：0.1 × 0.1 × 0.1 = 0.001', '機率很小'); for (const m of cs) { tint(m, RED); glow(m, DRED); await anim(tok, 300, () => {}); } tag('三份全壞：0.1³ = 0.001', 'bad', 0, 2.0); },
    () => { cs.forEach((m) => { tint(m, TEAL); glow(m, null); }); tag('stage = 1 − (1 − r)³ = 0.999', 'good', 0, 1.4); say('至少一份正常：1 − 0.001 = 0.999'); },
    async () => {
      const b = [[0.9, 4.6, '1 份'], [0.999, 5.8, '3 份']].map(([v, x, n]) => { const m = cube('', v > 0.95 ? TEAL : BLUE, [0.8, 1, 0.8], x, 2.4, 0); m.scale.y = 0.001; tag(n + ' ' + v, 'ptr alt', x, 2.6 + v * 3.6); return [m, v * 3.4]; });
      say('0.9 → 0.999：可靠很多');
      await anim(tok, 900, (u) => b.forEach(([m, h]) => { m.scale.y = Math.max(0.001, h * u); m.position.y = 2.4 + h * u / 2; }));
    },
    () => { icon('💰', '要多花錢買副本', -4.6, 5.6); say('副本越多越可靠', '但要多準備錢'); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-bound', '預算 105：每種裝置最多幾份 uᵢ', async (tok) => {
  K.fresh([0, 4.4, 13.5], [0, 3.0, 0]);
  const sc = 11 / RD.C, x0 = -5.5, DX = (k) => -1.6 + k * 3, COL = [BLUE, PURPLE, ORANGE];
  let A, B, x = x0, rest, ut = [], extra = [];
  const extraFor = (k) => { extra.forEach((m) => kill(m)); extra = []; const n = Math.floor(40 / RD.c[k]); for (let t = 0; t < n; t++) extra.push(cube('D' + (k + 1), COL[k], [RD.c[k] * sc - 0.08, 0.4, 0.6], x + (t + 0.5) * RD.c[k] * sc, 1.9, 0, 1.2)); glow(rest, GOLD); return n; };
  await run(tok, [
    () => { icon('👛', '預算 C = $105', -5.0, 5.9); const g = ghostBox(GRAY, 11, 0.6, 0.8); g.position.set(0, 3.0, 0); tag('$0', 'idx', -5.5, 2.45); tag('$105', 'idx', 5.5, 2.45); say('手上總共有 C 元'); },
    () => { tag('每種買幾份 → 系統 reliability 最大？', 'say', 0, 4.2); say('每種裝置買幾份，才能最可靠？'); },
    () => { for (let k = 0; k < 3; k++) { cube('D' + (k + 1), COL[k], [1.3, 0.8, 0.8], DX(k), 6.0, 0, 1.4); tag('$' + RD.c[k], 'ptr', DX(k), 5.3); } say('例題：3 種裝置，成本 $30、$15、$20'); },
    () => { for (let k = 0; k < 3; k++) tag('r = ' + RD.r[k], 'idx', DX(k), 4.85); say('reliability 0.9、0.8、0.5'); },
    () => { for (let k = 0; k < 3; k++) ut.push(tag('u' + (k + 1) + ' = ?', 'ptr alt', DX(k), 7.0)); say('uᵢ：每種最多能買幾份（上限）'); },
    async () => { say('每種至少要買 1 份', '30 + 15 + 20 = 65'); for (let k = 0; k < 3; k++) { const w = RD.c[k] * sc; cube('$' + RD.c[k], COL[k], [w - 0.05, 0.6, 0.8], x + w / 2, 3.0, 0, 1.2); x += w; await anim(tok, 300, () => {}); } },
    () => { A = mono(tag('剩下的錢 = C − Σcᵢ', 'ptr', 0, 1.0)); say('剩下的錢 = C − Σcᵢ', '可以拿來買副本'); },
    () => { const rw = 40 * sc; rest = cube('剩 $40', GRAY, [rw - 0.05, 0.6, 0.8], x + rw / 2, 3.0, 0, 1.2); txt(A, '105 − 65 = 40'); say('105 − 65 = 剩 $40'); },
    () => { extraFor(0); say('40 全花在 D1：40 / 30 → 只能多買 1 份'); },
    () => { B = mono(tag('uᵢ = ⌊(C − Σcⱼ) / cᵢ⌋ + 1', 'ptr alt', 0, 0.4)); say('公式：剩下的錢 ÷ cᵢ 取 floor', '再 + 已經買的那 1 份'); },
    () => { txt(ut[0], 'u1 = ⌊40/30⌋ + 1 = 2'); cls(ut[0], 'good'); say('u1 = ⌊40 / 30⌋ + 1 = 2'); },
    () => { extraFor(1); txt(ut[1], 'u2 = ⌊40/15⌋ + 1 = 3'); cls(ut[1], 'good'); say('D2：40 / 15 → 多 2 份', 'u2 = 2 + 1 = 3'); },
    () => { extraFor(2); txt(ut[2], 'u3 = ⌊40/20⌋ + 1 = 3'); cls(ut[2], 'good'); say('D3：40 / 20 → 多 2 份', 'u3 = 2 + 1 = 3'); },
    () => { extra.forEach((m) => kill(m)); glow(rest, null); say('上限：2、3、3', '接著找出每種該買幾份'); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-s1', '集合法：S0 與 S1', async (tok) => {
  K.fresh([0, 4.4, 13.5], [0, 3.6, 0]);
  let s0, a, b, h1;
  await run(tok, [
    () => { icon('🎒', '0/1 knapsack 的集合法', -4.8, 6.2); say('解法和 0/1 knapsack 的集合法一樣'); },
    () => { tag('有序對 (reliability, cost)', 'ptr', 0.8, 7.2); say('用有序對：(reliability, cost)'); },
    () => { tag('S0', 'ptr', -5.0, 4.75); s0 = pairBox(1, 0, -5.0, 4.1, 1.2); say('S0 = {(1, 0)}', '還沒買任何東西'); },
    () => { tag('r 用乘的 → 從 1 開始', 'note', -5.0, 3.3); tag('（從 0 開始，乘起來永遠是 0）', 'idx', -5.0, 2.8); say('reliability 會一直相乘', '所以從 1 開始，不從 0'); },
    () => { tag('D1：r 0.9、$30、最多 2 份', 'say', 1.4, 6.4); say('考慮 D1：最多可以買 2 份'); },
    async () => { tag('D1 × 1：r = 0.9、$30', 'ptr', 0.2, 5.4); const p = tag('(1, 0)', 'pkt', -5.0, 4.1); await goTo(tok, p, 2.6, 4.8, 700); kill(p); a = pairBox(0.9, 30, 2.6, 4.8); say('買 1 份：r 乘 0.9、cost 加 30', '(0.9, 30)'); },
    () => { tag('D1 × 2：1 − (1 − 0.9)² = 0.99', 'ptr', 0.2, 3.5); say('買 2 份：1 − 0.1² = 0.99'); },
    async () => { const p = tag('(1, 0)', 'pkt', -5.0, 4.1); await goTo(tok, p, 2.6, 2.9, 700); kill(p); b = pairBox(0.99, 60, 2.6, 2.9); say('cost 30 × 2 = 60', '(0.99, 60)'); },
    async () => { tag('S1', 'ptr alt', 5.6, 4.75); await Promise.all([goTo(tok, a, 5.6, 4.1, 700), goTo(tok, b, 5.6, 3.4, 700)]); say('合起來：S1 = {(0.9, 30), (0.99, 60)}'); },
  ]);
}]);

// one row of a stage: header + resulting pairs (or ✗ when the money is not enough)
function relRow(P, y, hdr) { tag(hdr, 'ptr', 0.6, y + 0.6); return y; }
FRAG.push(['dp4bari2-rel-d2', '第二個裝置：S2 的候選', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.6, 0]);
  const S1 = setCol('S1', [[0.9, 30], [0.99, 60]], -5.4, 5.0); let x8;
  const from = async (t, x, y) => { const p = tag(S1[t].userData.lbl.element.textContent, 'pkt', -5.4, 5.0 - t * 0.7); await goTo(tok, p, x, y, 600); kill(p); };
  await run(tok, [
    () => { tag('D2：r 0.8、$15、最多 3 份', 'say', 0.8, 7.35); say('考慮第二個裝置 D2'); },
    () => { relRow(null, 5.8, 'D2 × 1：(0.8, 15)'); say('D2 買 1 份：r 0.8、cost 15'); },
    async () => { await from(0, -0.6, 5.8); pairBox(0.72, 45, -0.6, 5.8); say('0.8 × 0.9 = 0.72；30 + 15 = 45'); },
    async () => { await from(1, 2.8, 5.8); pairBox(0.792, 75, 2.8, 5.8); say('0.8 × 0.99 = 0.792；60 + 15 = 75'); },
    () => { relRow(null, 3.9, 'D2 × 2：1 − 0.2² = 0.96，$30'); say('D2 買 2 份：1 − (1 − 0.8)² = 0.96', 'cost 30'); },
    async () => { await from(0, -0.6, 3.9); pairBox(0.864, 60, -0.6, 3.9); say('0.9 × 0.96 = 0.864；30 + 30 = 60'); },
    async () => { await from(1, 2.8, 3.9); x8 = pairBox(0.9504, 90, 2.8, 3.9); say('0.99 × 0.96 = 0.9504；60 + 30 = 90'); },
    async () => { tint(x8, RED); glow(x8, DRED); tag('90 + D3 的 20 > 105 ✗', 'bad', 2.8, 3.2); say('花到 90，只剩 15', '買不起 D3（20）→ 不可行，刪掉'); await anim(tok, 700, () => {}); K.fly(x8); },
    () => { tag('先算 cost：不可行就不用算 r', 'note', 0.8, 0.6); say('之後先看 cost', '不可行的就不用算 reliability'); },
    () => { relRow(null, 2.0, 'D2 × 3：1 − 0.2³ = 0.992，$45'); say('D2 買 3 份：0.992，cost 45'); },
    async () => { await from(0, -0.6, 2.0); pairBox(0.8928, 75, -0.6, 2.0); say('30 + 45 = 75 還買得起 D3', '0.9 × 0.992 = 0.8928'); },
    async () => { const m = badBox(105, 2.8, 2.0); tag('60 + 45 = 105，買不起 D3', 'bad', 2.8, 1.35); say('60 + 45 = 105：買不起 D3', '不可行，連算都不用'); await anim(tok, 700, () => {}); K.fly(m); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-dom', 'Dominance rule：刪掉被支配的', async (tok) => {
  K.fresh([0, 4.4, 13.5], [0, 3.6, 0]);
  const L = [[0.72, 45], [0.792, 75], [0.864, 60], [0.8928, 75]]; let ms = [], t1, t2;
  await run(tok, [
    () => { tag('S2 的候選', 'ptr', -2.5, 6.85); ms = L.map(([r, c], t) => pairBox(r, c, -2.5, 6.2 - t * 0.9, 1.2)); say('D2 之後得到 4 個有序對'); },
    () => { glow(ms[0], GOLD); glow(ms[1], GOLD); t1 = tag('r ↑、cost ↑ ✓', 'good', 0.6, 5.75); say('0.72 → 0.792：r 增加，cost 也增加', '合理'); },
    () => { glow(ms[0], null); glow(ms[2], GOLD); tint(ms[1], RED); t2 = tag('r ↑ 但 cost 75 → 60 ✗', 'bad', 0.9, 4.85); say('0.792 → 0.864：r 增加，cost 卻減少', '不合理'); },
    async () => { glow(ms[2], GREEN); tag('dominance rule：又貴又不可靠的刪掉', 'say', 2.6, 3.4); say('(0.792, 75) 比 (0.864, 60) 貴又不可靠', '依 dominance rule 刪掉'); await anim(tok, 700, () => {}); K.fly(ms[1]); },
    () => { glow(ms[2], null); glow(ms[3], null); kill(t1); kill(t2); setCol('S2', [[0.72, 45], [0.864, 60], [0.8928, 75]], 4.4, 6.2, 0.9); say('S2 剩 3 對'); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-d3', '第三個裝置：S3 的候選', async (tok) => {
  K.fresh([0, 4.4, 14], [0, 3.6, 0]);
  const S2 = [[0.72, 45], [0.864, 60], [0.8928, 75]]; setCol('S2', S2, -5.4, 5.0);
  const X = [-1.6, 0.7, 3.0];
  const out = (t, y, rr, cc) => { const [r, c] = S2[t]; pairBox(r * rr, c + cc, X[t], y); };
  const bad = async (t, y, cc) => { const m = badBox(S2[t][1] + cc, X[t], y); await anim(tok, 500, () => {}); K.fly(m); };
  await run(tok, [
    () => { tag('D3：r 0.5、$20', 'say', 0.7, 7.35); relRow(null, 5.8, 'D3 × 1：(0.5, 20)'); say('第三個裝置 D3 買 1 份', 'r 0.5、cost 20'); },
    () => { out(0, 5.8, 0.5, 20); say('0.72 × 0.5 = 0.36；45 + 20 = 65'); },
    () => { out(1, 5.8, 0.5, 20); say('0.864 × 0.5 = 0.432；60 + 20 = 80'); },
    () => { out(2, 5.8, 0.5, 20); say('0.8928 × 0.5 = 0.4464；75 + 20 = 95'); },
    () => { relRow(null, 3.9, 'D3 × 2：1 − 0.5² = 0.75，$40'); say('D3 買 2 份：1 − 0.5² = 0.75', 'cost 40'); },
    () => { out(0, 3.9, 0.75, 40); say('0.72 × 0.75 = 0.54；45 + 40 = 85'); },
    () => { out(1, 3.9, 0.75, 40); say('0.864 × 0.75 = 0.648；60 + 40 = 100'); },
    async () => { say('75 + 40 = 115 > 105', '超過預算，刪掉'); await bad(2, 3.9, 40); },
    () => { relRow(null, 2.0, 'D3 × 3：1 − 0.5³ = 0.875，$60'); say('D3 買 3 份：1 − 0.5³ = 0.875', 'cost 60'); },
    () => { out(0, 2.0, 0.875, 60); say('0.72 × 0.875 = 0.63；45 + 60 = 105'); },
    async () => { say('60 + 60 = 120、75 + 60 = 135', '都超過預算'); await Promise.all([bad(1, 2.0, 60), bad(2, 2.0, 60)]); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-merge', '合併 S3 並刪除被支配的', async (tok) => {
  K.fresh([0, 4.4, 13.5], [0, 3.6, 0]);
  const L = [[0.36, 65], [0.432, 80], [0.4464, 95], [0.54, 85], [0.63, 105], [0.648, 100]]; let ms = [];
  await run(tok, [
    () => { tag('S3 的候選（合併後）', 'ptr', -2.0, 7.1); ms = L.map(([r, c], t) => pairBox(r, c, -2.0, 6.4 - t * 0.8, 1.2)); say('全部合併成 S3，同時刪掉不合理的'); },
    () => { [0, 1, 2].forEach((t) => glow(ms[t], GOLD)); tag('r ↑、cost ↑ ✓', 'good', 1.4, 5.6); say('前三個：r 增加、cost 也增加', '沒問題'); },
    async () => { [0, 1].forEach((t) => glow(ms[t], null)); tint(ms[2], RED); glow(ms[3], GREEN); tag('(0.4464, 95) 被 (0.54, 85) 支配', 'bad', 1.9, 4.4); say('0.54 的 cost 85 比 95 還便宜', '(0.4464, 95) 刪掉'); await anim(tok, 700, () => {}); K.fly(ms[2]); },
    async () => { glow(ms[3], null); tint(ms[4], RED); glow(ms[5], GREEN); tag('(0.63, 105) 被 (0.648, 100) 支配', 'bad', 1.9, 2.8); say('0.63 要 105，0.648 只要 100', '(0.63, 105) 刪掉'); await anim(tok, 700, () => {}); K.fly(ms[4]); },
    () => { glow(ms[5], null); setCol('S3', [[0.36, 65], [0.432, 80], [0.54, 85], [0.648, 100]], 5.0, 6.2, 0.8); say('S3 剩 4 對'); },
    () => { tag('最大 reliability 0.648、cost $100', 'good', 5.0, 2.6); say('最大 reliability = 0.648', 'cost $100'); },
  ]);
}]);

FRAG.push(['dp4bari2-rel-back', '回溯：每種裝置買幾份', async (tok) => {
  K.fresh([0, 4.4, 13.5], [0, 3.6, 0]);
  const c1 = setCol('S1', [[0.9, 30], [0.99, 60]], -4.6, 5.6), c2 = setCol('S2', [[0.72, 45], [0.864, 60], [0.8928, 75]], 0, 5.6), c3 = setCol('S3', [[0.36, 65], [0.432, 80], [0.54, 85], [0.648, 100]], 4.6, 5.6);
  const ar = (a, b) => K.arrow(V3(a.position.x - 0.95, a.position.y, 0.3), V3(b.position.x + 0.95, b.position.y, 0.3), 0x0f5a3a);
  await run(tok, [
    () => { tag('每種裝置該買幾份？', 'say', 0, 7.2); say('答案 (0.648, 100)：每種買幾份？'); },
    () => { glow(c3[3], GREEN); tag('D3 × 2', 'ptr alt', 4.6, 2.6); say('(0.648, 100) 是 D3 買 2 份得到的'); },
    () => { glow(c2[1], GREEN); ar(c3[3], c2[1]); say('它是 (0.864, 60) 乘出來的'); },
    () => { tag('D2 × 2', 'ptr alt', 0, 2.6); say('(0.864, 60) 來自 D2 買 2 份'); },
    () => { glow(c1[0], GREEN); ar(c2[1], c1[0]); tag('D1 × 1', 'ptr alt', -4.6, 2.6); say('再往前是 (0.9, 30)', 'D1 買 1 份'); },
    () => { tag('答案：D1 × 1、D2 × 2、D3 × 2', 'good', 0, 1.7); say('D1 買 1 份、D2 買 2 份、D3 買 2 份'); },
    () => { mono(tag('0.9 × 0.96 × 0.75 = 0.648；30 + 30 + 40 = 100', 'ptr', 0, 1.1)); say('reliability 相乘 = 0.648', 'cost 相加 = 100'); },
    () => { tag('和 0/1 knapsack 的集合法一樣', 'note', 0, 0.5); say('多買副本，系統更可靠', '做法就是 0/1 knapsack 的集合法'); },
  ]);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 4 章',
    title: '動態規劃（進階）',
    color: 'var(--alg)',
    modes: [
      { id: 'pqr', name: '矩陣相乘成本', enter: enterPqr },
      { id: 'mcm', name: 'Matrix chain', enter: enterMcm },
      { id: 'obst', name: 'Optimal BST', enter: enterObst },
      { id: 'coin', name: 'Coin change', enter: enterCoin },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['mc-cost', 'mc-count', 'mc-loops', 'mc-table', 'mc-split', 'obst-cost', 'obst-table', 'obst-build', 'obst-success-only', 'coin-greedy-fail', 'coin-min', 'coin-ways'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
