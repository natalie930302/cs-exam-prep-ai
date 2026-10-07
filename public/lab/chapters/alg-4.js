// 演算法 第4章：動態規劃（進階）— Matrix-chain multiplication、Optimal BST、Coin change。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片（Abdul Bari 的 Matrix Chain／Optimal BST、MIT 6.006 L22／Rec22、Reliability Design）都還沒有逐字稿，
// 所以場景全部依課本（CLRS Ch15）建立，標題標「（課本）」：
//   CLRS 15.2：A1 10×100、A2 100×5、A3 5×50（7500 vs 75000）；6 個矩陣 p = 30 35 15 5 10 20 25 → m[1][6] = 15125，
//     ((A1(A2A3))((A4A5)A6))；小例子 p = 5 4 6 2 7 → m[1][4] = 158。
//   CLRS 15.5：p = .15 .10 .05 .10 .20、q = .05 .10 .05 .05 .05 .10 → 期望成本 2.75（root k2）；只算成功搜尋：key 10 20 30 40、次數 4 2 6 3 → 26。
//   Coin change：面額 1、3、4 湊 6（greedy 3 枚 vs DP 2 枚）；面額 1、2、5 湊 5 有 4 種組合。
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
    sceneOrder: ['mc-cost', 'mc-count', 'mc-loops', 'mc-table', 'mc-split', 'obst-cost', 'obst-table', 'obst-build', 'obst-success-only', 'coin-greedy-fail', 'coin-min', 'coin-ways'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
