// 演算法 第5章：貪婪演算法 Greedy。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自本章影片（有逐字稿的一支）：
//   Abdul Bari「Greedy Method - Introduction」：A 地到 B 地（走路／腳踏車／汽車／火車／飛機）、12 小時限制 → feasible、
//     成本最小 → optimal；Algorithm Greedy(a, n) 的 Select／Feasible；選車與 1000 人徵才的層層篩選。
// 其餘影片（交大江蕙如 Lec10–14、Abdul Bari Huffman／Knapsack／Job sequencing／Optimal merge）尚無逐字稿，依課本建立，標題標「（課本）」：
//   CLRS 16.1 activity selection（11 個活動 → a1 a4 a8 a11）、16.2 fractional vs 0/1 knapsack（w 10/20/30、v 60/100/120、W 50 → 240；0/1 greedy 160 vs 220）、
//   16.3 Huffman（a45 b13 c12 d16 e9 f5 → 224）；Horowitz job sequencing（p 100 10 15 27、d 2 1 2 1 → 127）；optimal merge（20 30 10 5 30 → 205）。
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

  function rodMesh(a, b, color = SAND, r = 0.03) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len), 8), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    return m;
  }
  function bar(color, w, h, d, x, y, z = 0) { const m = lab.box(color, [1, 1, 1]); m.scale.set(w, h, d); m.position.set(x, y, z); lab.world.add(m); return m; }

  // ───────────────────────── Abdul Bari：Greedy 導論 ─────────────────────────
  async function scFeasible(tok) {
    fresh([0, 4.4, 14], [0, 2.8, 0]);
    const OPT = [['走路', 7.2, 0], ['腳踏車', 5.6, 0], ['開車', 4.4, 3], ['火車', 2.4, 2], ['飛機', 1.2, 6]];
    const xs = (k) => -5 + k * 2.5;
    say('問題 P：從 A 地到 B 地', '可以有很多種 solution');
    const bars = OPT.map(([nm], k) => { tag(nm, 'ptr', xs(k), 0, 1.3); const m = bar(BLUE, 1.3, 0.001, 1, xs(k), 0); return m; });
    await wait(tok, 1800);
    for (let k = 0; k < 5; k++) {
      const h = OPT[k][1];
      await anim(tok, 400, (t) => { bars[k].scale.y = h * t; bars[k].position.y = h * t / 2; });
      tag('solution ' + (k + 1), 'idx', xs(k), h + 0.35);
    }
    say('柱高 = 花費的時間', '');
    await wait(tok, 1600);
    const lim = bar(RED, 12.6, 0.05, 1.3, 0, 3.6);
    tag('限制：12 小時內到達', 'ptr alt', 5.6, 4.0);
    say('加上限制：12 小時內到', '');
    await wait(tok, 1800);
    for (let k = 0; k < 5; k++) { const ok = OPT[k][1] < 3.6; tint(bars[k], ok ? TEAL : GRAY); }
    say('滿足限制的解：feasible solution', '火車、飛機是 feasible；其他太慢');
    await wait(tok, 2800);
    say('再要求「花費最少」：最小化問題', '');
    const coins = [];
    for (const k of [3, 4]) for (let c = 0; c < OPT[k][2]; c++) { coins.push(cube('', '#c08a1f', [0.5, 0.12, 0.5], xs(k) + 0.95, 0.06 + c * 0.14, 0.6, 1.5)); await wait(tok, 160); }
    await wait(tok, 1200);
    glow(bars[3], GREEN); tag('optimal', 'ptr alt', xs(3), OPT[3][1] + 1.0);
    say('feasible 又最便宜：optimal', '火車 = optimal solution');
    await wait(tok, 2800);
    say('求最小或最大 = 最佳化問題', '補充：最佳值唯一，但達到它的解可以不只一個');
    await wait(tok, 3000);
    kill(lim);
    fresh([0, 4.4, 14], [0, 2.8, 0]);
    say('解最佳化問題的三種策略', '板書：Greedy、Dynamic Programming、Branch & Bound（推斷）');
    const S = [['Greedy', TEAL], ['DP', BLUE], ['Branch & Bound', PURPLE]];
    S.forEach(([nm, c], k) => { cube(nm, c, [3, 1.2, 1.2], -4.2 + k * 4.2, 0.6, 0, 3); });
    await wait(tok, 2600);
    say('有的問題只適合其中一種，有的三種都行', '先學 Greedy');
    await wait(tok, 3000);
  }
  async function scGreedyGeneral(tok) {
    fresh([0, 4.6, 14], [0, 3.4, 0]);
    const cd = code(['Algorithm Greedy(a, n)', '  for i = 1 to n', '    x = Select(a)', '    if Feasible(x)', '      Solution = Solution + x'], -3.4, 7.2, 0.5);
    const A = [7, 3, 9, 4, 6, 2], cap = 15;
    const xs = (k) => -4.6 + k * 1.3;
    const cs = A.map((v, k) => cube(v, BLUE, [1, 0.6, 0.8], xs(k), 0.3, 1.2));
    tag('inputs a', 'ptr', xs(0) - 1.5, 0.3, 1.2);
    const box = bar('#e9dcc4', 2.2, 0.1, 1.6, 4.6, 0.05);
    tag('Solution（總和 ≤ 15）', 'ptr alt', 4.6, 0, 1.6);
    const sumL = tag('總和 0', 'ptr', 4.6, 4.6);
    say('一次一個 stage，每次考慮一個 input', '示意：Select = 挑最大、Feasible = 總和不超過 15');
    await wait(tok, 3000);
    const left = A.map((v, k) => ({ v, m: cs[k] }));
    let sum = 0, h = 0;
    for (let st = 1; st <= A.length; st++) {
      cd.hl(1); await wait(tok, 500);
      left.sort((a, b) => b.v - a.v);
      const x = left.shift();
      cd.hl(2); glow(x.m, GOLD); move(x.m, x.m.position.x, 1.6, 1.2);
      say('stage ' + st + '：Select 挑出 ' + x.v, '');
      await wait(tok, 1000);
      cd.hl(3);
      if (sum + x.v <= cap) {
        sum += x.v; cd.hl(4);
        move(x.m, 4.6, 0.4 + h * 0.65, 0); h++; glow(x.m, GREEN); tint(x.m, TEAL);
        txt(sumL, '總和 ' + sum);
        say('Feasible：放進 Solution', '總和 ' + sum + ' ≤ 15');
      } else {
        glow(x.m, null); tint(x.m, GRAY); move(x.m, x.m.position.x, 0.3, 2.6);
        say('不 feasible：丟掉 ' + x.v, sum + ' + ' + x.v + ' > 15');
      }
      await wait(tok, 1300);
    }
    cd.hl(-1);
    say('所有 feasible 的 input 組成解', '補充：Select 的規則要能證明最佳，才保證 optimal');
    await wait(tok, 3200);
  }
  async function scFilter(tok) {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    // car example
    const rowY = [0.25, 0.25, 0.25, 0.25];
    const stagesCar = [['全部車款', 40], ['挑品牌', 10], ['頂級型號', 3], ['最新、口碑好', 1]];
    say('買「最好的車」：看遍所有車款？', '太花時間');
    const cars = [];
    for (let k = 0; k < 40; k++) cars.push(cube('', [BLUE, PURPLE, ORANGE, PINK, '#31aab0'][k % 5], [0.38, 0.3, 0.6], -6 + (k % 10) * 0.45, 0.15, -1.2 + Math.floor(k / 10) * 0.75, 1.5));
    tag('全部車款', 'ptr', -4, 0, 2.2);
    await wait(tok, 2400);
    let alive = cars.slice();
    for (let s = 1; s < 4; s++) {
      const keep = stagesCar[s][1];
      alive.forEach((m, k) => { if (k >= keep) fly(m, V3(0, 5, 3)); });
      alive = alive.slice(0, keep);
      const x0 = -1.6 + (s - 1) * 2.6;
      alive.forEach((m, k) => move(m, x0 + (k % 5) * 0.45 - (Math.min(keep, 5) - 1) * 0.225, 0.15, Math.floor(k / 5) * 0.75 - 0.4));
      tag(stagesCar[s][0], 'ptr', x0, 0, 2.2);
      say('篩選：' + stagesCar[s][0], '剩 ' + keep + ' 台');
      await wait(tok, 1700);
    }
    glow(alive[0], GREEN);
    say('照自己的選擇方法，直接選出最好的', '這就是 greedy approach');
    await wait(tok, 2600);
    // hiring example
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    const ST = [['應徵者', 1000, 48], ['筆試', 300, 18], ['技術測驗', 80, 8], ['團體討論', 20, 4], ['面試', 1, 1]];
    say('1000 人應徵，只錄取 1 人', '方塊數為示意');
    let ppl = [];
    for (let k = 0; k < 48; k++) ppl.push(cube('', BLUE, [0.3, 0.45, 0.3], -6.2 + (k % 8) * 0.38, 0.23, -1.4 + Math.floor(k / 8) * 0.45, 1.4));
    tag('1000 人', 'ptr', -4.9, 0, 1.6);
    await wait(tok, 2200);
    let tests = 1000;
    const tl = tag('考試場次 1000', 'ptr alt', 3.2, 4.2);
    for (let s = 1; s < 5; s++) {
      const keep = ST[s][2];
      ppl.forEach((m, k) => { if (k >= keep) fly(m, V3(0, 5, 3)); });
      ppl = ppl.slice(0, keep);
      const x0 = -3 + (s - 1) * 2.6;
      ppl.forEach((m, k) => move(m, x0 + (k % 4) * 0.38 - 0.57, 0.23, Math.floor(k / 4) * 0.45 - 0.6));
      tag(ST[s][0] + '（剩 ' + ST[s][1] + '）', 'ptr', x0, 0, 1.6);
      if (s < 4) tests += ST[s][1];
      txt(tl, '考試場次 ' + tests);
      say(ST[s][0] + '：只讓過關的人往下一關', '剩 ' + ST[s][1] + ' 人');
      await wait(tok, 1700);
    }
    glow(ppl[0], GREEN);
    say('層層篩選：約 ' + tests + ' 場考試', '每人都考完 4 關要 4000 場：太耗時、太貴');
    await wait(tok, 3200);
    say('照已知的篩選程序快速解題 = greedy', '依這套程序，選出的人就是最好的');
    await wait(tok, 3000);
  }

  // ───────────────────────── Activity selection（CLRS 16.1） ─────────────────────────
  const ACT = [[1, 4], [3, 5], [0, 6], [5, 7], [3, 9], [5, 9], [6, 10], [8, 11], [8, 12], [2, 14], [12, 16]];
  const TX = (t) => -5.6 + t * 0.72;
  function actBoard(acts, yTop, dy, showAxis = true) {
    const bars = acts.map(([s, f], k) => {
      const y = yTop - k * dy;
      tag('a' + (k + 1), 'idx', TX(0) - 0.6, y);
      const m = cube('', BLUE, [(f - s) * 0.72 - 0.06, Math.min(0.34, dy * 0.7), 0.4], TX((s + f) / 2), y, 0);
      return m;
    });
    if (showAxis) {
      plate(0, yTop - acts.length * dy - 0.05, 12.2, 0.06, '#6e5f49', 0);
      for (let t = 0; t <= 16; t += 2) tag(String(t), 'idx', TX(t), yTop - acts.length * dy - 0.35);
    }
    return bars;
  }
  function selectByRule(acts, rule) {
    const idx = acts.map((_, k) => k);
    const key = { finish: (k) => acts[k][1], start: (k) => acts[k][0], short: (k) => acts[k][1] - acts[k][0] }[rule];
    idx.sort((a, b) => key(a) - key(b) || acts[a][1] - acts[b][1]);
    const chosen = [];
    for (const k of idx) if (chosen.every((c) => acts[c][1] <= acts[k][0] || acts[k][1] <= acts[c][0])) chosen.push(k);
    return { order: idx, chosen };
  }
  async function runActivity(tok, acts, rule, ms, yTop = 7.0, dy = 0.5) {
    const bars = actBoard(acts, yTop, dy);
    const R = selectByRule(acts, rule);
    const line = plate(TX(0), yTop - (acts.length - 1) * dy / 2, 0.05, acts.length * dy + 0.4, ORANGE, 0.25);
    const chosen = [];
    for (const k of R.order) {
      const [s, f] = acts[k];
      glow(bars[k], GOLD);
      const ok = chosen.every((c) => acts[c][1] <= s || f <= acts[c][0]);
      if (ok) { chosen.push(k); tint(bars[k], TEAL); glow(bars[k], GREEN); if (rule === 'finish') line.position.x = TX(f); }
      else tint(bars[k], GRAY);
      say(ok ? '選 a' + (k + 1) + '（[' + s + ', ' + f + ')）' : 'a' + (k + 1) + ' 跟已選的衝突：跳過', rule === 'finish' ? (ok ? '下一個必須 s ≥ ' + f : 's = ' + s + ' < 目前結束時間') : '');
      if (tok === undefined) log((ok ? '選 ' : '跳過 ') + 'a' + (k + 1) + ' [' + s + ', ' + f + ')');
      await wait(tok, ms);
      glow(bars[k], ok ? GREEN : null);
    }
    return { bars, chosen };
  }
  async function scActivity(tok) {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    say('Activity selection：11 個活動', '一間教室，挑最多個互不重疊的活動（CLRS，已依 f 排序）');
    const bars0 = actBoard(ACT, 7.0, 0.5); await wait(tok, 2800);
    lab.clear();
    say('Greedy：每次選「最早結束」且不衝突的', '留下最多時間給剩下的活動');
    const { chosen } = await runActivity(tok, ACT, 'finish', 1250);
    say('選到 ' + chosen.map((k) => 'a' + (k + 1)).join('、') + '：4 個', '排序 O(n log n) + 掃一遍 O(n)');
    await wait(tok, 3200);
    void bars0;
  }
  async function scActivityProof(tok) {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    say('為什麼「最早結束」一定對？', '交換論證（exchange argument）');
    await wait(tok, 2400);
    const yA = 5.2, yB = 3.2;
    tag('某個最佳解 A', 'ptr', -6.1, yA + 0.7); tag('A′', 'ptr alt', -6.1, yB + 0.7);
    for (let t = 0; t <= 16; t += 2) tag(String(t), 'idx', TX(t), 1.6);
    plate(0, 1.9, 12.2, 0.06, '#6e5f49', 0);
    const A = [1, 3, 8, 10];
    const ma = A.map((k) => { const [s, f] = ACT[k]; tag('a' + (k + 1), 'idx', TX((s + f) / 2), yA + 0.45); return cube('', BLUE, [(f - s) * 0.72 - 0.06, 0.4, 0.4], TX((s + f) / 2), yA, 0, 1.4); });
    say('A = {a2, a4, a9, a11}：4 個', 'A 的第一個活動是 a2（f = 5）');
    await wait(tok, 2800);
    glow(ma[0], GOLD);
    const a1 = cube('a1', TEAL, [3 * 0.72 - 0.06, 0.4, 0.4], TX(2.5), yB, 0, 2);
    say('a1 最早結束：f₁ = 4 ≤ 5', '把 a2 換成 a1');
    await wait(tok, 2600);
    A.slice(1).forEach((k) => { const [s, f] = ACT[k]; cube('', BLUE, [(f - s) * 0.72 - 0.06, 0.4, 0.4], TX((s + f) / 2), yB, 0, 1.2); });
    say('a1 比 a2 更早結束，不會撞到後面的活動', 'A′ 仍然合法，個數一樣 → 也是最佳解');
    await wait(tok, 3000);
    glow(a1, GREEN);
    say('一定有含 a1 的最佳解', 'greedy choice；選完 a1 剩下同型子問題（optimal substructure）');
    await wait(tok, 3400);
  }
  async function scActivityWrong(tok) {
    fresh([0, 4.2, 14], [0, 3.6, 0]);
    const ex1 = [[0, 10], [1, 3], [4, 6], [7, 9]];
    say('換成別的貪婪規則行不行？', '');
    await wait(tok, 1600);
    say('規則：最早開始', '');
    let r = await runActivity(tok, ex1, 'start', 900, 6.4, 0.7);
    say('最早開始只選到 ' + r.chosen.length + ' 個，最佳是 3 個', '一個長活動把其他全擋住');
    await wait(tok, 2800);
    lab.clear();
    const ex2 = [[0, 5], [4, 7], [6, 11]];
    say('規則：最短的先選', '');
    r = await runActivity(tok, ex2, 'short', 900, 6.4, 0.9);
    say('最短的 [4,7) 擋住兩個：只選到 ' + r.chosen.length + ' 個', '最佳是 [0,5) 與 [6,11) 兩個');
    await wait(tok, 2800);
    lab.clear();
    say('最早結束：同一組資料', '');
    r = await runActivity(tok, ex2, 'finish', 900, 6.4, 0.9);
    say('最早結束選到 ' + r.chosen.length + ' 個 ✓', 'Greedy 規則要證明，不能憑直覺');
    await wait(tok, 3000);
  }

  // ───────────────────────── Huffman（CLRS 16.3）與 optimal merge 共用的森林 ─────────────────────────
  const hHeight = (t) => (t.L ? 1 + Math.max(hHeight(t.L), hHeight(t.R)) : 0);
  const hLeaves = (t) => (t.L ? hLeaves(t.L) + hLeaves(t.R) : 1);
  function forest(o) {
    const F = { trees: [], unit: o.unit, dy: o.dy, baseY: o.baseY, gap: o.gap || 0.35, leafLbl: o.leafLbl, bits: o.bits !== false };
    F.build = (t) => {
      const g = new THREE.Group(), H = hHeight(t); let li = 0;
      (function place(n, d) {
        if (!n.L) n.lx = li++ * F.unit + F.unit / 2; else { place(n.L, d + 1); place(n.R, d + 1); n.lx = (n.L.lx + n.R.lx) / 2; }
        n.ly = (H - d) * F.dy;
      })(t, 0);
      (function draw(n) {
        const m = lab.box(n.L ? TEAL : n.color || BLUE, [n.L ? 0.62 : F.unit * 0.86, 0.45, 0.4]);
        m.position.set(n.lx, n.ly, 0); m.castShadow = true;
        m.userData.lbl = lab.label(n.L ? String(n.f) : F.leafLbl(n), 'val'); m.add(m.userData.lbl);
        g.add(m); n.m = m;
        if (n.L) for (const [c, bit] of [[n.L, '0'], [n.R, '1']]) {
          g.add(rodMesh(V3(n.lx, n.ly - 0.22, -0.05), V3(c.lx, c.ly + 0.22, -0.05), SAND, 0.025));
          if (F.bits) { const bl = lab.label(bit, 'ptr alt'); bl.position.set((n.lx + c.lx) / 2 + (bit === '0' ? -0.18 : 0.18), (n.ly + c.ly) / 2 + 0.12, 0.1); g.add(bl); }
          draw(c);
        }
      })(t);
      t.g = g; t.w = hLeaves(t) * F.unit; lab.world.add(g);
      return g;
    };
    F.targets = () => {
      const total = F.trees.reduce((s, t) => s + t.w, 0) + F.gap * (F.trees.length - 1);
      let x = -total / 2; const out = [];
      for (const t of F.trees) { out.push(x); x += t.w + F.gap; }
      return out;
    };
    F.layout = async (tok, ms) => {
      const tg = F.targets(), from = F.trees.map((t) => t.g.position.clone());
      await anim(tok, ms, (u) => F.trees.forEach((t, k) => { t.g.position.x = from[k].x + (tg[k] - from[k].x) * u; t.g.position.y = from[k].y + (F.baseY - from[k].y) * u; }));
    };
    F.init = (items) => {
      F.trees = items.map((it) => ({ ...it })).sort((a, b) => a.f - b.f);
      F.trees.forEach((t) => F.build(t));
      const tg = F.targets(); F.trees.forEach((t, k) => t.g.position.set(tg[k], F.baseY, 0));
    };
    F.mergeOnce = async (tok, ms, say2) => {
      const a = F.trees[0], b = F.trees[1];
      a.m.material.emissive = new THREE.Color(GOLD); b.m.material.emissive = new THREE.Color(GOLD);
      if (say2) say2(a, b);
      await anim(tok, ms * 0.4, (u) => { a.g.position.y = F.baseY + u * 0.9; b.g.position.y = F.baseY + u * 0.9; });
      await wait(tok, ms * 0.3);
      const z = { f: a.f + b.f, L: a, R: b };
      const x = a.g.position.x;
      kill(a.g); kill(b.g);
      F.trees.splice(0, 2);
      F.build(z); z.g.position.set(x, F.baseY + 0.9, 0);
      z.m.material.emissive = new THREE.Color(GREEN);
      let pos = F.trees.findIndex((t) => t.f > z.f); if (pos < 0) pos = F.trees.length;
      F.trees.splice(pos, 0, z);
      await F.layout(tok, ms * 0.3);
      z.m.material.emissive = new THREE.Color('#000000');
      return z;
    };
    return F;
  }
  const HUFF = [['a', 45], ['b', 13], ['c', 12], ['d', 16], ['e', 9], ['f', 5]];
  function huffCodes(t, pre = '', out = {}) { if (!t.L) out[t.sym] = pre || '0'; else { huffCodes(t.L, pre + '0', out); huffCodes(t.R, pre + '1', out); } return out; }
  async function scHuffman(tok) {
    fresh([0, 4.0, 14.5], [0, 3.2, 0]);
    say('Huffman code：字元頻率（千次）', 'a 45、b 13、c 12、d 16、e 9、f 5（CLRS）');
    const F = forest({ unit: 1.0, dy: 1.05, baseY: 0.7, leafLbl: (n) => n.sym + ':' + n.f });
    F.init(HUFF.map(([sym, f]) => ({ sym, f })));
    await wait(tok, 2800);
    say('放進 min-priority queue', '由小到大；每次取出兩個最小的合併');
    await wait(tok, 2400);
    for (let k = 0; k < HUFF.length - 1; k++) {
      await F.mergeOnce(tok, 2200, (a, b) => say('取出最小兩個：' + a.f + ' 與 ' + b.f, '合併成新節點 ' + (a.f + b.f) + '，左 0、右 1'));
      await wait(tok, 700);
    }
    const codes = huffCodes(F.trees[0]);
    say('5 次合併：Huffman tree 完成', Object.keys(codes).sort().map((c) => c + '=' + codes[c]).join('  '));
    await wait(tok, 3600);
    say('頻率越高離 root 越近 → 編碼越短', '用 binary heap：O(n log n)');
    await wait(tok, 3000);
  }
  async function scHuffCost(tok) {
    fresh([0, 4.4, 14.5], [0, 3.4, 0]);
    const F = forest({ unit: 0.9, dy: 1.0, baseY: 2.2, leafLbl: (n) => n.sym + ':' + n.f });
    F.init(HUFF.map(([sym, f]) => ({ sym, f })));
    for (let k = 0; k < 5; k++) { const a = F.trees[0], b = F.trees[1], z = { f: a.f + b.f, L: a, R: b }; kill(a.g); kill(b.g); F.trees.splice(0, 2); let p = F.trees.findIndex((t) => t.f > z.f); if (p < 0) p = F.trees.length; F.trees.splice(p, 0, z); }
    const T = F.trees[0]; F.build(T); T.g.position.set(-T.w / 2 - 2.2, F.baseY, 0);
    const codes = huffCodes(T);
    say('B(T) = Σ f(c) × 編碼長度', '總共需要幾個 bit');
    await wait(tok, 2200);
    const cl = tag('B(T) = 0', 'ptr alt', 4.4, 7.4);
    let B = 0, row = 0;
    for (const [c, f] of HUFF) {
      const d = codes[c].length; B += f * d;
      tag(c + '：' + codes[c] + '  ' + f + '×' + d + ' = ' + f * d, 'ptr', 4.4, 6.6 - row * 0.6); row++;
      txt(cl, 'B(T) = ' + B);
      say(c + ' 的編碼 ' + codes[c] + '（長度 ' + d + '）', f + ' × ' + d + ' = ' + f * d);
      await wait(tok, 1100);
    }
    say('Huffman 224、固定長度 300', '單位：千 bit；省下約 25%');
    await wait(tok, 3000);
    // decode 001011101
    const bits = '001011101';
    say('解碼 ' + bits, '從 root 走，碰到葉子就輸出；prefix code 不會有歧義');
    await wait(tok, 2400);
    let n = T, out = '';
    const tk = cube('', ORANGE, [0.3, 0.3, 0.3], T.g.position.x + T.lx, F.baseY + T.ly + 0.55, 0.4);
    for (const b of bits) {
      n = b === '0' ? n.L : n.R;
      move(tk, T.g.position.x + n.lx, F.baseY + n.ly + 0.55, 0.4);
      await wait(tok, 600);
      if (!n.L) { out += n.sym; glow(n.m, GREEN); say('走到葉子 ' + n.sym, '目前輸出：' + out); await wait(tok, 900); glow(n.m, null); n = T; move(tk, T.g.position.x + T.lx, F.baseY + T.ly + 0.55, 0.4); await wait(tok, 400); }
    }
    say('解碼結果：' + out, '001011101 = 0·0·101·1101');
    await wait(tok, 3000);
  }

  // ───────────────────────── Knapsack：fractional 與 0/1 ─────────────────────────
  const KS = { items: [[10, 60], [20, 100], [30, 120]], W: 50 };
  function knapBoard(items, W, xBag, title) {
    const k = 5.2 / W;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(1.8, W * k + 0.1, 1.4), new THREE.MeshStandardMaterial({ color: '#e9dcc4', transparent: true, opacity: 0.35, depthWrite: false }));
    bag.position.set(xBag, (W * k + 0.1) / 2, 0); lab.world.add(bag);
    tag(title + '（W = ' + W + '）', 'ptr', xBag, W * k + 0.6);
    return k;
  }
  function itemBlocks(items, k, x0, dx) {
    return items.map(([w, v], i) => {
      const m = cube('', [BLUE, PURPLE, ORANGE, PINK, '#31aab0'][i % 5], [1.3, w * k, 1.1], x0 + i * dx, w * k / 2, 0);
      tag('#' + (i + 1) + ' w' + w + ' v' + v, 'idx', x0 + i * dx, 0, 1);
      tag('v/w = ' + +(v / w).toFixed(2), 'idx', x0 + i * dx, w * k + 0.35);
      return m;
    });
  }
  function fracSolve(items, W) {
    const order = items.map((_, i) => i).sort((a, b) => items[b][1] / items[b][0] - items[a][1] / items[a][0]);
    let cap = W, val = 0; const take = [];
    for (const i of order) { if (cap <= 0) break; const [w, v] = items[i]; const x = Math.min(1, cap / w); take.push([i, x]); cap -= x * w; val += x * v; }
    return { order, take, val };
  }
  function zeroOneBest(items, W) {
    let best = { val: -1, set: [] };
    for (let mask = 0; mask < 1 << items.length; mask++) {
      let w = 0, v = 0; const set = [];
      items.forEach(([wi, vi], i) => { if (mask >> i & 1) { w += wi; v += vi; set.push(i); } });
      if (w <= W && v > best.val) best = { val: v, set };
    }
    return best;
  }
  function zeroOneGreedy(items, W) {
    const order = items.map((_, i) => i).sort((a, b) => items[b][1] / items[b][0] - items[a][1] / items[a][0]);
    let cap = W, val = 0; const set = [];
    for (const i of order) if (items[i][0] <= cap) { cap -= items[i][0]; val += items[i][1]; set.push(i); }
    return { val, set, left: cap };
  }
  async function fillBag(tok, blocks, items, k, xBag, takes, ms, sumL) {
    let h = 0, val = 0;
    for (const [i, x] of takes) {
      const [w, v] = items[i], m = blocks[i];
      glow(m, GOLD);
      if (x < 1) {
        const part = cube('', m.material.color.getStyle(), [1.3, w * x * k, 1.1], m.position.x, w * x * k / 2, 0);
        m.scale.y = 1 - x; m.position.y = w * (1 - x) * k / 2; tint(m, GRAY); glow(m, null);
        move(part, xBag, h + w * x * k / 2, 0); h += w * x * k; val += v * x;
        say('只剩 ' + +(w * x).toFixed(1) + '：切下 ' + (Math.round(x * 100) / 100) + ' 份', '價值 ' + v + ' × ' + +x.toFixed(3) + ' = ' + +(v * x).toFixed(1));
      } else {
        move(m, xBag, h + w * k / 2, 0); h += w * k; val += v; glow(m, null);
        say('放入 #' + (i + 1) + '（w ' + w + '、v ' + v + '）', '價值 v/w = ' + +(v / w).toFixed(2));
      }
      if (sumL) txt(sumL, '總價值 ' + +val.toFixed(2));
      await wait(tok, ms);
    }
    return val;
  }
  async function scFrac(tok) {
    fresh([0, 4.4, 14], [0, 2.8, 0]);
    const { items, W } = KS;
    say('Fractional knapsack：物品可以切', 'CLRS：w = 10、20、30，v = 60、100、120，W = 50');
    const k = knapBoard(items, W, 4.2, '背包');
    const blocks = itemBlocks(items, k, -4.6, 2.2);
    const sumL = tag('總價值 0', 'ptr alt', 4.2, -0.2, 1.4);
    await wait(tok, 3000);
    say('Greedy：依單位價值 v/w 由大到小拿', '6 > 5 > 4');
    await wait(tok, 2200);
    const S = fracSolve(items, W);
    const val = await fillBag(tok, blocks, items, k, 4.2, S.take, 1900, sumL);
    say('總價值 60 + 100 + 80 = ' + val, '排序 O(n log n)；fractional 用 greedy 是最佳');
    await wait(tok, 3400);
  }
  async function scKnapFail(tok) {
    fresh([0, 4.4, 14.5], [0, 2.8, 0]);
    const { items, W } = KS;
    say('0/1 knapsack：每件只能整件拿或不拿', '同一組物品，W = 50');
    const k = 5.2 / W;
    knapBoard(items, W, -1.2, 'Greedy（照 v/w）');
    knapBoard(items, W, 4.8, '最佳');
    const A = itemBlocks(items, k, -6.2, 1.55);
    await wait(tok, 2600);
    const G = zeroOneGreedy(items, W);
    const gl = tag('', 'ptr alt', -1.2, -0.2, 1.4);
    await fillBag(tok, A, items, k, -1.2, G.set.map((i) => [i, 1]), 1500, gl);
    glow(A[2], GOLD);
    say('#3（w 30）放不下：剩 ' + G.left + ' 的空間浪費掉', 'Greedy 只得 ' + G.val);
    await wait(tok, 2800);
    glow(A[2], null);
    const Bst = zeroOneBest(items, W);
    const B = Bst.set.map((i) => { const [w] = items[i]; return cube('', [BLUE, PURPLE, ORANGE][i], [1.3, w * k, 1.1], 4.8, 0, 0); });
    let h = 0;
    for (let q = 0; q < B.length; q++) { const w = items[Bst.set[q]][0]; B[q].position.y = 6 + h; move(B[q], 4.8, h + w * k / 2, 0); h += w * k; await wait(tok, 900); }
    tag('總價值 ' + Bst.val, 'ptr alt', 4.8, -0.2, 1.4);
    say('最佳是 #2 + #3 = ' + Bst.val, '背包剛好裝滿');
    await wait(tok, 3000);
    say('0/1 knapsack 沒有 greedy-choice property', '要用 DP（第 3 章的 V[i][w] 表）');
    await wait(tok, 3200);
  }

  // ───────────────────────── Job sequencing with deadlines ─────────────────────────
  const JOBS = { p: [100, 10, 15, 27], d: [2, 1, 2, 1] };
  function jobSolve(p, d) {
    const n = p.length, maxD = Math.max(...d), slot = new Array(maxD + 1).fill(-1), order = p.map((_, i) => i).sort((a, b) => p[b] - p[a] || a - b), trace = [];
    for (const i of order) {
      let t = Math.min(maxD, d[i]);
      while (t >= 1 && slot[t] !== -1) t--;
      if (t >= 1) slot[t] = i;
      trace.push({ i, t: t >= 1 ? t : 0 });
    }
    const profit = slot.reduce((s, i) => s + (i >= 0 ? p[i] : 0), 0);
    return { order, slot, trace, profit, maxD };
  }
  async function runJobs(tok, p, d, ms) {
    const S = jobSolve(p, d), n = p.length;
    const sw = Math.min(1.8, 10 / S.maxD);
    const sx = (t) => -(S.maxD - 1) * sw / 2 + (t - 1) * sw;
    for (let t = 1; t <= S.maxD; t++) { plate(sx(t), 1.0, sw * 0.92, 1.0, '#e9dcc4', -0.1); tag('時段 ' + t, 'idx', sx(t), 0.2); }
    tag('時間軸（每個工作花 1 單位）', 'ptr', 0, 2.0);
    const jw = Math.min(1.5, 11 / n);
    const jm = p.map((pi, i) => { const x = -(n - 1) * jw / 2 + i * jw; tag('d=' + d[i], 'idx', x, 5.0); return cube('J' + (i + 1) + ' ' + pi, [BLUE, PURPLE, ORANGE, PINK, '#31aab0', '#c08a1f', '#5c7a4a'][i % 7], [jw * 0.85, 0.6, 0.6], x, 5.6, 0); });
    say('依利潤由大到小考慮', '順序：' + S.order.map((i) => 'J' + (i + 1)).join(' → '));
    await wait(tok, ms * 1.3);
    let profit = 0;
    for (const { i, t } of S.trace) {
      glow(jm[i], GOLD);
      if (t) {
        profit += p[i];
        say('J' + (i + 1) + '（d = ' + d[i] + '）放在時段 ' + t, '盡量往後放：≤ deadline 的最晚空位；利潤 ' + profit);
        move(jm[i], sx(t), 1.0, 0.2); tint(jm[i], TEAL);
      } else {
        say('J' + (i + 1) + '：時段 1…' + Math.min(d[i], S.maxD) + ' 都滿了', '放不下 → 捨棄');
        tint(jm[i], GRAY); move(jm[i], jm[i].position.x, 3.6, 1.5);
      }
      if (tok === undefined) log(t ? 'J' + (i + 1) + ' → 時段 ' + t : 'J' + (i + 1) + ' 捨棄');
      await wait(tok, ms);
      glow(jm[i], null);
    }
    return S;
  }
  async function scJobs(tok) {
    fresh([0, 4.4, 13], [0, 3.0, 0]);
    say('Job sequencing with deadlines', '4 個工作：利潤 100、10、15、27；期限 2、1、2、1（Horowitz）');
    await wait(tok, 2800);
    const S = await runJobs(tok, JOBS.p, JOBS.d, 1900);
    say('選 J1、J4：總利潤 ' + S.profit, '可行性：每個工作都在 deadline 前完成');
    await wait(tok, 3400);
  }

  // ───────────────────────── Optimal merge pattern ─────────────────────────
  const MERGE = [20, 30, 10, 5, 30];
  async function scMerge(tok) {
    fresh([0, 4.0, 14], [0, 3.0, 0]);
    say('合併 5 個排序檔：20 30 10 5 30', '合併大小 x、y 的檔案成本 = x + y');
    const F = forest({ unit: 1.25, dy: 1.1, baseY: 0.7, leafLbl: (n) => String(n.f), bits: false });
    F.init(MERGE.map((f) => ({ f, color: PURPLE })));
    await wait(tok, 2800);
    say('Greedy：每次合併最小的兩個', '跟 Huffman 一模一樣');
    await wait(tok, 2000);
    let cost = 0; const cl = tag('總成本 0', 'ptr alt', 5.2, 6.4);
    for (let k = 0; k < MERGE.length - 1; k++) {
      const z = await F.mergeOnce(tok, 2000, (a, b) => say('合併 ' + a.f + ' 與 ' + b.f, '成本 + ' + (a.f + b.f)));
      cost += z.f; txt(cl, '總成本 ' + cost);
      await wait(tok, 600);
    }
    say('最小總成本 ' + cost, '= Σ 檔案大小 × 深度（weighted external path length）');
    await wait(tok, 3000);
    say('照輸入順序合併要 270', '50 + 60 + 65 + 95 = 270；greedy 的 205 比較好');
    await wait(tok, 3200);
  }

  // ───────────────────────── Greedy 還是 DP？ ─────────────────────────
  async function scChoice(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    say('能用 greedy 的兩個條件', 'greedy-choice property + optimal substructure');
    await wait(tok, 2800);
    plate(-3.2, 0.06, 5.6, 3.2, '#d9efe4', 0); plate(3.2, 0.06, 5.6, 3.2, '#f3e1c8', 0);
    lab.world.children.slice(-2).forEach((m) => { m.rotation.x = -Math.PI / 2; m.position.y = 0.04; });
    tag('Greedy 就夠', 'ptr', -3.2, 0.3, 2.2); tag('要用 DP', 'ptr', 3.2, 0.3, 2.2);
    const CASES = [
      ['Activity selection', -1, '最早結束一定在某個最佳解裡'],
      ['Fractional knapsack', -1, '可以切：v/w 最大的先拿'],
      ['0/1 knapsack', 1, '整件拿：greedy 會浪費空間'],
      ['Huffman code', -1, '最小的兩個一定可以當兄弟'],
      ['找零 1、3、4', 1, '4+1+1 輸給 3+3'],
      ['Job sequencing', -1, '利潤大的先排、盡量往後放'],
      ['LCS／矩陣鏈', 1, '要比較所有子問題'],
    ];
    let L = 0, R = 0;
    for (const [nm, side, why] of CASES) {
      const k = side < 0 ? L++ : R++;
      cube(nm, side < 0 ? TEAL : ORANGE, [2.5, 0.42, 0.7], side * 3.2 + (k % 2 ? 1.35 : -1.35), 0.21 + Math.floor(k / 2) * 0.46, -0.8 + Math.floor(k / 2) * 0.05, 3);
      say(nm + (side < 0 ? '：greedy' : '：DP'), why);
      await wait(tok, 1700);
    }
    say('Greedy：做一次選擇，只剩一個子問題', 'DP：每個選擇都試，比較子問題的答案');
    await wait(tok, 3600);
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  const acM = { acts: ACT.map((a) => a.slice()), rule: 'finish' };
  function enterActivity() {
    fresh([0, 4.2, 14], [0, 3.8, 0]);
    controls('<select id="aR"><option value="finish">最早結束</option><option value="start">最早開始</option><option value="short">最短優先</option></select>'
      + '<button class="primary" id="aGo">開始選</button><button id="aRnd">隨機一組</button><button id="aClrs">CLRS 例子</button>');
    $('aR').value = acM.rule;
    $('aR').onchange = (e) => { acM.rule = e.target.value; draw(); };
    const info = (cnt) => {
      const best = selectByRule(acM.acts, 'finish').chosen.length;
      setState('Activity selection', [['規則', { finish: '最早結束', start: '最早開始', short: '最短優先' }[acM.rule]], ['活動數', String(acM.acts.length)], ['選到', cnt === undefined ? '?' : String(cnt)], ['最佳（最早結束）', String(best)]],
        cnt === undefined ? '依規則排序，衝突就跳過' : cnt === best ? '<span class="ok">達到最佳</span>' : '<span class="no">少了 ' + (best - cnt) + ' 個</span>：這個規則不保證最佳');
    };
    const draw = () => { lab.clear(); actBoard(acM.acts, 7.0, Math.min(0.5, 5.4 / acM.acts.length)); info(); };
    on('aGo', () => runOp(async () => { lab.clear(); const r = await runActivity(undefined, acM.acts, acM.rule, 450, 7.0, Math.min(0.5, 5.4 / acM.acts.length)); info(r.chosen.length); }));
    on('aRnd', () => {
      if (busy) { log('上一個動作還在播，等它做完。', true); return; }
      const n = 7 + rnd(4); acM.acts = [];
      for (let k = 0; k < n; k++) { const s = rnd(14), len = 1 + rnd(rnd(2) ? 3 : 8); acM.acts.push([s, Math.min(16, s + len)]); }
      acM.acts.sort((a, b) => a[1] - b[1]); clearLog(); log('新的一組 ' + n + ' 個活動（依結束時間編號）。'); draw();
    });
    on('aClrs', () => { if (busy) { log('上一個動作還在播，等它做完。', true); return; } acM.acts = ACT.map((a) => a.slice()); clearLog(); draw(); });
    log('換規則比較看看：只有「最早結束」保證最多。');
    draw();
  }
  const huM = { items: HUFF.map(([sym, f]) => ({ sym, f })), F: null };
  function enterHuffman() {
    fresh([0, 4.0, 14.5], [0, 3.2, 0]);
    controls('<label>字元:頻率 <input id="hI" value="' + huM.items.map((x) => x.sym + ':' + x.f).join(' ') + '" style="width:200px"></label><button id="hSet">套用</button>'
      + '<button class="primary" id="hStep">合併一次</button><button id="hAll">全部合併</button><button id="hCode">編碼表</button>');
    const build = () => { lab.clear(); const n = huM.items.length; huM.F = forest({ unit: Math.min(1.0, 10 / n), dy: Math.min(1.05, 5.4 / (n - 1)), baseY: 0.7, leafLbl: (x) => x.sym + ':' + x.f }); huM.F.init(huM.items); info(); };
    const info = () => {
      const F = huM.F, done = F.trees.length === 1;
      setState('Huffman（' + huM.items.length + ' 個字元）', [['queue 內', F.trees.map((t) => t.f).join(', ')], ['已合併', (huM.items.length - F.trees.length) + ' / ' + (huM.items.length - 1)]],
        done ? '完成：按「編碼表」看每個字元的編碼與 B(T)' : '每次 EXTRACT-MIN 兩次，合併後 INSERT 回去');
    };
    const step = async (ms) => { if (huM.F.trees.length < 2) { log('只剩一棵樹了：Huffman tree 完成。', true); return false; } const z = await huM.F.mergeOnce(undefined, ms, null); log('合併 ' + z.L.f + ' + ' + z.R.f + ' = ' + z.f); info(); return true; };
    on('hSet', () => {
      if (busy) { log('上一個動作還在播，等它做完。', true); return; }
      const its = $('hI').value.trim().split(/\s+/).map((s) => s.split(':')).map(([c, f]) => ({ sym: c, f: Number(f) }));
      if (its.length < 2 || its.length > 8 || its.some((x) => !x.sym || x.sym.length > 2 || !(x.f >= 1 && x.f <= 999 && Number.isInteger(x.f)))) { log('格式：字元:頻率，空白分開，2～8 個，頻率 1～999 的整數。', true); return; }
      huM.items = its; clearLog(); build();
    });
    on('hStep', () => runOp(() => step(1400)));
    on('hAll', () => runOp(async () => { while (await step(700)); }));
    on('hCode', () => {
      if (huM.F.trees.length > 1) { log('還沒合併完：先把所有樹合成一棵。', true); return; }
      const T = huM.F.trees[0], codes = huffCodes(T); let B = 0, tot = 0;
      for (const x of huM.items) { B += x.f * codes[x.sym].length; tot += x.f; log(x.sym + '：' + codes[x.sym] + '（' + x.f + ' × ' + codes[x.sym].length + '）'); }
      const fixed = Math.max(1, Math.ceil(Math.log2(huM.items.length)));
      log('B(T) = ' + B + '；固定長度 ' + fixed + ' bit 要 ' + fixed * tot + '；平均 ' + (B / tot).toFixed(3) + ' bit/字元');
    });
    log('CLRS 例子：a45 b13 c12 d16 e9 f5（單位：千次）。');
    build();
  }
  const ksM = { items: KS.items.map((x) => x.slice()), W: KS.W };
  function enterKnapsack() {
    fresh([0, 4.4, 14.5], [0, 2.8, 0]);
    controls('<label>物品 w:v <input id="kI" value="' + ksM.items.map((x) => x.join(':')).join(' ') + '" style="width:150px"></label><label>W = <input id="kW" type="number" min="1" max="100" value="' + ksM.W + '"></label><button id="kSet">套用</button>'
      + '<button class="primary" id="kFrac">Fractional（greedy）</button><button id="kG01">0/1 照 v/w greedy</button><button id="kBest">0/1 最佳</button>');
    const draw = () => { lab.clear(); const k = knapBoard(ksM.items, ksM.W, 4.4, '背包'); ksM.k = k; ksM.blocks = itemBlocks(ksM.items, k, -5.6 + (ksM.items.length < 4 ? 1 : 0), Math.min(2.2, 8.4 / ksM.items.length)); ksM.sumL = tag('總價值 0', 'ptr alt', 4.4, -0.2, 1.4); };
    const info = (rows) => setState('Knapsack（W = ' + ksM.W + '）', [['物品 (w,v)', ksM.items.map((x) => '(' + x + ')').join(' ')], ...rows], 'fractional：v/w 由大到小，最後一件可以切<br>0/1：greedy 不保證最佳 → DP');
    on('kSet', () => {
      if (busy) { log('上一個動作還在播，等它做完。', true); return; }
      const its = $('kI').value.trim().split(/\s+/).map((s) => s.split(':').map(Number)), W = Number($('kW').value);
      if (its.length < 1 || its.length > 5 || its.some((x) => x.length !== 2 || !(x[0] >= 1 && x[0] <= 100) || !(x[1] >= 1 && x[1] <= 999))) { log('物品格式 w:v，最多 5 件，重量 1～100、價值 1～999。', true); return; }
      if (!(W >= 1 && W <= 100) || its.some((x) => x[0] > W * 1.6)) { log('W 請填 1～100，且物品不要比背包大太多（畫面放不下）。', true); return; }
      ksM.items = its; ksM.W = W; clearLog(); draw(); info([]);
    });
    on('kFrac', () => runOp(async () => { draw(); const S = fracSolve(ksM.items, ksM.W); const v = await fillBag(undefined, ksM.blocks, ksM.items, ksM.k, 4.4, S.take, 900, ksM.sumL); log('Fractional greedy：' + +v.toFixed(2)); info([['fractional', String(+v.toFixed(2))]]); }));
    on('kG01', () => runOp(async () => { draw(); const G = zeroOneGreedy(ksM.items, ksM.W); await fillBag(undefined, ksM.blocks, ksM.items, ksM.k, 4.4, G.set.map((i) => [i, 1]), 900, ksM.sumL); const B = zeroOneBest(ksM.items, ksM.W); log('0/1 照 v/w greedy：' + G.val + '（剩 ' + G.left + ' 空間）；最佳是 ' + B.val + (G.val < B.val ? ' → greedy 失敗' : '（這組剛好一樣）')); info([['0/1 greedy', String(G.val)], ['0/1 最佳', String(B.val)]]); }));
    on('kBest', () => runOp(async () => { draw(); const B = zeroOneBest(ksM.items, ksM.W); await fillBag(undefined, ksM.blocks, ksM.items, ksM.k, 4.4, B.set.map((i) => [i, 1]), 900, ksM.sumL); log('0/1 最佳：' + B.val + '（放 ' + B.set.map((i) => '#' + (i + 1)).join('、') + '）'); info([['0/1 最佳', String(B.val)]]); }));
    log('同一組物品比較三種做法：fractional 一定 ≥ 0/1 最佳 ≥ 0/1 greedy。');
    draw(); info([]);
  }
  const jbM = { p: JOBS.p.slice(), d: JOBS.d.slice() };
  function enterJobs() {
    fresh([0, 4.4, 13], [0, 3.0, 0]);
    controls('<label>利潤:期限 <input id="jI" value="' + jbM.p.map((p, i) => p + ':' + jbM.d[i]).join(' ') + '" style="width:200px"></label><button id="jSet">套用</button><button class="primary" id="jGo">排程</button><button id="jAB">換 5 個工作的例子</button>');
    const show = () => { lab.clear(); const S = jobSolve(jbM.p, jbM.d); setState('Job sequencing', [['工作數', String(jbM.p.length)], ['最大期限', String(S.maxD)], ['最大利潤', '?']], '利潤由大到小；放在 ≤ deadline 的最晚空位<br>簡單做法 O(n²)，用 disjoint set 可近 O(n log n)'); };
    on('jSet', () => {
      if (busy) { log('上一個動作還在播，等它做完。', true); return; }
      const its = $('jI').value.trim().split(/\s+/).map((s) => s.split(':').map(Number));
      if (its.length < 1 || its.length > 7 || its.some((x) => x.length !== 2 || !(x[0] >= 1 && x[0] <= 999) || !(Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= 6))) { log('格式 利潤:期限，最多 7 個，期限 1～6 的整數。', true); return; }
      jbM.p = its.map((x) => x[0]); jbM.d = its.map((x) => x[1]); clearLog(); show();
    });
    on('jAB', () => { if (busy) { log('上一個動作還在播，等它做完。', true); return; } jbM.p = [20, 15, 10, 5, 1]; jbM.d = [2, 2, 1, 3, 3]; $('jI').value = '20:2 15:2 10:1 5:3 1:3'; clearLog(); show(); });
    on('jGo', () => runOp(async () => { lab.clear(); const S = await runJobs(undefined, jbM.p, jbM.d, 900); log('總利潤 ' + S.profit + '：' + S.slot.slice(1).map((i, t) => '時段 ' + (t + 1) + ' = ' + (i >= 0 ? 'J' + (i + 1) : '空')).join('，')); setState('Job sequencing', [['工作數', String(jbM.p.length)], ['最大期限', String(S.maxD)], ['最大利潤', String(S.profit)]], '利潤由大到小；放在 ≤ deadline 的最晚空位'); }));
    log('Horowitz 例子：利潤 100 10 15 27，期限 2 1 2 1。');
    show();
  }
  const mgM = { sizes: MERGE.slice(), F: null, cost: 0 };
  function enterMerge() {
    fresh([0, 4.0, 14], [0, 3.0, 0]);
    controls('<label>檔案大小 <input id="gI" value="' + mgM.sizes.join(' ') + '" style="width:160px"></label><button id="gSet">套用</button><button class="primary" id="gStep">合併最小兩個</button><button id="gAll">全部合併</button>');
    const naive = () => { let s = mgM.sizes[0], c = 0; for (let k = 1; k < mgM.sizes.length; k++) { s += mgM.sizes[k]; c += s; } return c; };
    const info = () => setState('Optimal merge pattern', [['剩下的檔案', mgM.F.trees.map((t) => t.f).join(', ')], ['目前成本', String(mgM.cost)], ['照順序合併', String(naive())]], '每次合併最小的兩個（同 Huffman）<br>總成本 = Σ 大小 × 深度');
    const build = () => { lab.clear(); mgM.cost = 0; const n = mgM.sizes.length; mgM.F = forest({ unit: Math.min(1.25, 10 / n), dy: Math.min(1.1, 5.4 / (n - 1)), baseY: 0.7, leafLbl: (x) => String(x.f), bits: false }); mgM.F.init(mgM.sizes.map((f) => ({ f, color: PURPLE }))); info(); };
    const step = async (ms) => { if (mgM.F.trees.length < 2) { log('只剩一個檔案：合併完成，總成本 ' + mgM.cost + '。', true); return false; } const z = await mgM.F.mergeOnce(undefined, ms, null); mgM.cost += z.f; log('合併 ' + z.L.f + ' + ' + z.R.f + '，成本 +' + z.f + ' = ' + mgM.cost); info(); return true; };
    on('gSet', () => {
      if (busy) { log('上一個動作還在播，等它做完。', true); return; }
      const s = $('gI').value.trim().split(/[\s,]+/).map(Number);
      if (s.length < 2 || s.length > 8 || s.some((x) => !Number.isInteger(x) || x < 1 || x > 999)) { log('請填 2～8 個 1～999 的整數。', true); return; }
      mgM.sizes = s; clearLog(); build();
    });
    on('gStep', () => runOp(() => step(1300)));
    on('gAll', () => runOp(async () => { while (await step(700)); }));
    log('合併兩個大小 x、y 的排序檔，成本 x + y。');
    build();
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  function mkOpts(ans, cands) {
    const o = [String(ans)];
    for (const c of cands) { const s = String(c); if (!o.includes(s)) o.push(s); if (o.length === 4) break; }
    let k = 1; while (o.length < 4) { const s = String(Number(ans) + k * 3 + 1); if (!o.includes(s)) o.push(s); k++; }
    return o;
  }
  function huffCost(fs) {
    const q = fs.slice().sort((a, b) => a - b); let c = 0;
    while (q.length > 1) { const a = q.shift(), b = q.shift(); c += a + b; let p = q.findIndex((x) => x > a + b); if (p < 0) p = q.length; q.splice(p, 0, a + b); }
    return c;
  }
  function genQ() {
    const t = rnd(7);
    if (t === 0) {
      const fs = Array.from({ length: 5 }, () => 1 + rnd(20)), ans = huffCost(fs), tot = fs.reduce((a, b) => a + b, 0);
      return { q: '5 個字元頻率 ' + fs.join('、') + '，Huffman 編碼總 bit 數 B(T) = ?', opts: mkOpts(ans, [3 * tot, ans + Math.min(...fs), tot * 2]), ans: String(ans), why: 'B(T) 等於每次合併的新節點值總和 = ' + ans + '；固定長度 3 bit 要 ' + 3 * tot + '。' };
    }
    if (t === 1) {
      const n = 6, acts = [];
      for (let k = 0; k < n; k++) { const s = rnd(10), len = 1 + rnd(5); acts.push([s, s + len]); }
      const ans = selectByRule(acts, 'finish').chosen.length, st = selectByRule(acts, 'start').chosen.length, sh = selectByRule(acts, 'short').chosen.length;
      return { q: '活動 ' + acts.map(([s, f]) => '[' + s + ',' + f + ')').join(' ') + '，最多能選幾個互不重疊的？', opts: mkOpts(ans, [st, sh, ans + 1, ans - 1]), ans: String(ans), why: '依結束時間排序，能選就選：' + ans + ' 個。（最早開始得 ' + st + '、最短優先得 ' + sh + '）' };
    }
    if (t === 2) {
      const items = Array.from({ length: 3 }, () => [2 + rnd(9), 5 + rnd(40)]), W = 6 + rnd(10), S = fracSolve(items, W), ans = +S.val.toFixed(2);
      const B = zeroOneBest(items, W);
      return { q: 'Fractional knapsack：W = ' + W + '，(w, v) = ' + items.map((x) => '(' + x + ')').join(' ') + '，最大價值？', opts: mkOpts(ans, [B.val, +(ans + 2).toFixed(2), items.reduce((s, x) => s + x[1], 0)]), ans: String(ans), why: '依 v/w 由大到小拿，最後一件切一部分：' + ans + '（不能切的 0/1 最佳只有 ' + B.val + '）。' };
    }
    if (t === 3) {
      const n = 5, p = Array.from({ length: n }, () => 5 + rnd(60)), d = Array.from({ length: n }, () => 1 + rnd(3)), S = jobSolve(p, d);
      return { q: '工作利潤 ' + p.join('、') + '，期限 ' + d.join('、') + '（每個花 1 單位時間），最大總利潤？', opts: mkOpts(S.profit, [p.reduce((a, b) => a + b, 0), Math.max(...p), S.profit - Math.min(...p)]), ans: String(S.profit), why: '利潤由大到小，放在 ≤ deadline 的最晚空位：' + S.profit + '。' };
    }
    if (t === 4) {
      const s = Array.from({ length: 4 }, () => 2 + rnd(30)), ans = huffCost(s);
      let a = s[0], c = 0; for (let k = 1; k < 4; k++) { a += s[k]; c += a; }
      return { q: '合併大小 ' + s.join('、') + ' 的 4 個排序檔（合併 x、y 成本 x+y），最小總成本？', opts: mkOpts(ans, [c, s.reduce((x, y) => x + y, 0) * 2, ans + 5]), ans: String(ans), why: '每次合併最小兩個（optimal merge pattern）：' + ans + '；照輸入順序要 ' + c + '。' };
    }
    if (t === 5) {
      const P = [
        { q: '滿足問題限制條件的解叫做？', opts: ['feasible solution', 'optimal solution', 'greedy solution', 'dummy solution'], ans: 'feasible solution', why: 'Abdul Bari：12 小時內到達的交通方式都是 feasible；其中成本最小的是 optimal。' },
        { q: 'Greedy 的一般演算法中，每個 stage 做的事是？', opts: ['Select 一個 input，若 Feasible 就加入解', '列舉所有子集合', '遞迴分成兩半再合併', '填一張二維表'], ans: 'Select 一個 input，若 Feasible 就加入解', why: 'for i = 1 to n：x = Select(a)；if Feasible(x) then Solution = Solution + x。' },
        { q: 'Activity selection 中，哪個貪婪規則保證最佳？', opts: ['最早結束', '最早開始', '最短的先選', '衝突最少的先選'], ans: '最早結束', why: '交換論證：最早結束的活動一定可以換進某個最佳解。其他規則都有反例。' },
        { q: '為什麼 0/1 knapsack 不能照 v/w 貪婪？', opts: ['物品不能切，可能浪費剩下的空間', '因為 v/w 算不出來', '因為要排序太慢', '其實可以，一定最佳'], ans: '物品不能切，可能浪費剩下的空間', why: 'CLRS：W = 50，greedy 拿 #1、#2 得 160，最佳 #2+#3 = 220。' },
        { q: 'CLRS 例子 a45 b13 c12 d16 e9 f5 的 Huffman 編碼總長？', opts: ['224（千 bit）', '300（千 bit）', '250（千 bit）', '200（千 bit）'], ans: '224（千 bit）', why: '45×1 + 13×3 + 12×3 + 16×3 + 9×4 + 5×4 = 224；固定 3 bit 要 300。' },
        { q: 'Huffman code 為什麼解碼不會有歧義？', opts: ['它是 prefix code：沒有編碼是另一個的前綴', '每個編碼一樣長', '編碼都以 1 結尾', '因為用 ASCII'], ans: '它是 prefix code：沒有編碼是另一個的前綴', why: '字元都在葉子上，從 root 走到葉子就能唯一確定。' },
        { q: 'Huffman 演算法用 binary min-heap 的時間？', opts: ['O(n log n)', 'O(n)', 'O(n²)', 'O(2ⁿ)'], ans: 'O(n log n)', why: 'n − 1 次合併，每次 EXTRACT-MIN × 2 + INSERT，各 O(log n)。' },
        { q: '能用 greedy 的兩個性質是？', opts: ['greedy-choice property + optimal substructure', 'overlapping subproblems + optimal substructure', '子問題互不重疊 + 可平行', '輸入已排序 + 無負邊'], ans: 'greedy-choice property + optimal substructure', why: 'overlapping subproblems 是 DP 的條件；greedy 需要「局部最佳選擇能導向全域最佳」。' },
      ];
      return P[rnd(P.length)];
    }
    const sets = [[1, 3, 4, 6], [1, 5, 6, 10], [1, 3, 4, 7]];
    const [a, b, c, A] = sets[rnd(sets.length)];
    const coins = [a, b, c];
    const dp = [0]; for (let x = 1; x <= A; x++) dp[x] = 1 + Math.min(...coins.filter((y) => y <= x).map((y) => dp[x - y]));
    const cs = [...coins].sort((x, y) => y - x); let r = A, g = 0; for (const y of cs) while (r >= y) { r -= y; g++; }
    return { q: '硬幣 ' + coins.join('、') + ' 湊 ' + A + ' 元，先拿最大面額的 greedy 用幾枚？最少要幾枚？', opts: [g + ' 枚；最少 ' + dp[A] + ' 枚', dp[A] + ' 枚；最少 ' + dp[A] + ' 枚', g + ' 枚；最少 ' + g + ' 枚', (g + 1) + ' 枚；最少 ' + dp[A] + ' 枚'].filter((v, i, arr) => arr.indexOf(v) === i).concat(['都湊不出來']).slice(0, 4), ans: g + ' 枚；最少 ' + dp[A] + ' 枚', why: 'greedy 不一定最佳：這組面額沒有 greedy-choice property，要用 DP。' };
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
    'feasible-optimal': { title: '最佳化問題：feasible 與 optimal solution', play: scFeasible },
    'greedy-general': { title: 'Greedy 一般演算法：Select、Feasible、加入解', play: scGreedyGeneral },
    'greedy-filter': { title: '選車與徵人：照既定程序層層篩選', play: scFilter },
    'activity-select': { title: '（課本）Activity selection：選最早結束的', play: scActivity },
    'activity-proof': { title: '（課本）交換論證：最早結束一定在某個最佳解裡', play: scActivityProof },
    'activity-wrong-rules': { title: '（課本）錯的貪婪規則：最早開始、最短優先', play: scActivityWrong },
    'huffman-build': { title: '（課本）Huffman tree：每次合併最小的兩個', play: scHuffman },
    'huffman-cost': { title: '（課本）Huffman 編碼長度 224 vs 300 與解碼', play: scHuffCost },
    'frac-knapsack': { title: '（課本）Fractional knapsack：依 v/w 拿，最後切一塊', play: scFrac },
    'knapsack-greedy-fail': { title: '（課本）反例：0/1 knapsack 用 greedy 只得 160', play: scKnapFail },
    'job-sequencing': { title: '（課本）Job sequencing with deadlines：利潤 127', play: scJobs },
    'optimal-merge': { title: '（課本）Optimal merge pattern：20 30 10 5 30 → 205', play: scMerge },
    'greedy-or-dp': { title: '（課本）什麼時候用 greedy、什麼時候用 DP', play: scChoice },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ grjiang1.js ═══
  {
// ─── hZjp35QI-40 / 0UGaXukC4b0（交大江蕙如 Lec10–11 Greedy：interval scheduling、interval partitioning、minimize lateness） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in each
// step comment is the transcript time where the lecturer starts saying it). Motion between steps is short;
// nothing loops or replays. Little buddies react to what happens.
// 老師的例子：8 個 request 選 2、5、8；四個 rule 的反例；I1..I10（depth 3，水位 2/5/2）；minimize lateness 的
// 兩組反例 (t=1,10; d=100,10) 與 (t=1,10; d=2,10)；idle 例子 d = 4、6、12；interval graph 1 連 2、3，2 連 1、3、4、5。
// 示意值：8 個 request 與一次掃描 1–7 的確切時間、I4–I10 的時間、KT 的 6 個 job、idle 例子的長度 2、3、4。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove } = K;
const GJ = { blue: '#4b9ee2', orange: '#dd8238', red: '#d64545', teal: '#2fc092', purple: '#9b7ef4', sand: '#c9b48e', paper: '#efe6d2', pink: '#e55a9b', gold: '#c08a1f', ink: '#6e5f49', gray: '#bdb3a2', cyan: '#31aab0' };
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a little helper character standing in front of the picture
const pal = (name, x, color = '#f4a56a', z = 1.6, size = 0.75, y = 0) => buddy(name, '', color, x, y, z, size);
const walk = (tok, b, x, ms = 900) => { const x0 = b.g.position.x; return anim(tok, ms, (u) => { b.g.position.x = x0 + (x - x0) * u; }); };
// 時間軸：t0..t1 映到 xa..xb，回傳 { X(t), sc }
function gAx(t0, t1, xa, xb, y, every = 1) {
  const sc = (xb - xa) / (t1 - t0), X = (t) => xa + (t - t0) * sc;
  line(xa, y, xb, y, 0, '#a99470');
  for (let t = t0; t <= t1; t += every) tag(String(t), 'idx', X(t), y - 0.35);
  return { X, sc, y };
}
// 一個 interval [s, f) 的長條
function gBar(ax, name, s, f, y, col, drop = 0, h = 0.38) {
  const m = cube(name, col, [Math.max(0.14, (f - s) * ax.sc - 0.08), h, 0.5], ax.X((s + f) / 2), y, 0, drop);
  m.userData.s = s; m.userData.f = f; return m;
}
const vline = (ax, t, y1, y2, c = '#c08a1f') => line(ax.X(t), y1, ax.X(t), y2, 0, c);
const gOv = (a, b) => a[0] < b[1] && b[0] < a[1];
// 老師的 8 個 request（2→5 無縫接、1/3/4 跟 2 overlap、最多選 3 個）；數字為示意
const IS8 = [[0, 5], [1, 4], [3, 6], [2, 7], [4, 8], [5, 9], [6, 10], [8, 11]];
const IS8ord = IS8.map((r, i) => i).sort((p, q) => IS8[p][1] - IS8[q][1]);
// interval partitioning 例子（I1..I10 依 s 排好，depth = 3；I1、I3 在 2 結束、I2 在 5 結束，與老師的水位 2/5/2 一致）
const IP10 = [[0, 2], [0, 5], [0, 2], [2, 6], [2, 7], [5, 8], [6, 9], [7, 10], [8, 10], [9, 11]];
const LCOL = [GJ.blue, GJ.orange, GJ.red];
function gPartition() { const fin = [0, 0, 0], lbl = []; IP10.forEach(([s, f]) => { const k = fin.findIndex((x) => x <= s); lbl.push(k); fin[k] = f; }); return lbl; }
// minimize lateness：Kleinberg–Tardos 的 6 個 job（EDF 後只有第 4 個遲交 1）
const LJ = [[3, 6], [2, 8], [1, 9], [4, 9], [3, 14], [2, 15]];
const JCOL = [GJ.blue, GJ.orange, GJ.teal, GJ.purple, GJ.pink, GJ.sand];
// 依序緊接著排；回傳每個 job 的 [start, finish]
function gPack(order, t0 = 0) { let t = t0; return order.map((i) => { const s = t; t += LJ[i][0]; return [s, t]; }); }
// 一排「每步選一個」的小方塊：step s 的三個選項掉下來，選最大的那個放到下面
async function pickStep(tok, s, opts, x, keep) {
  const cs = opts.map((v, k) => cube(v, GJ.paper, [0.9, 0.6, 0.6], x, 5.2 - k * 1.0, 0, 2));
  await beat(tok, 700);
  const best = opts.indexOf(Math.max(...opts));
  glow(cs[best], GOLD); await beat(tok, 500);
  cs.forEach((c, k) => { if (k !== best) tint(c, GJ.gray); });
  tint(cs[best], GJ.teal); glow(cs[best], null);
  move(cs[best], x, 1.2, 0);
  if (keep) keep.push(cs[best]);
  return cs[best];
}
// 兩種證明的小人：greedy 與 OPT 賽跑
function racers(y0 = 0, xs = -6.2) {
  const lane = [line(xs, y0 + 0.02, -0.6, y0 + 0.02, 1.2, '#a99470'), line(xs, y0 + 0.02, -0.6, y0 + 0.02, -0.2, '#a99470')];
  line(-0.8, y0, -0.8, y0 + 1.6, 0.5, '#c08a1f');
  const g = pal('greedy', xs, GJ.teal, 1.2, 0.6, y0), o = pal('OPT', xs, GJ.purple, -0.2, 0.6, y0);
  return { g, o, lane };
}
async function race(tok, r, xs = -6.2, xe = -1.6, ms = 2000) {
  await anim(tok, ms, (u) => { r.g.g.position.x = xs + (xe - xs) * u; r.o.g.position.x = xs + (xe - 0.6 - xs) * u; });
}

// ════════ hZjp35QI-40（Lec10：Greedy 概念、Interval scheduling） ════════
// 02:04 Greedy：每一步選當下最好、做了決定不回頭
FRAG.push(['grjiang1-myopic', 'Greedy：每步選當下最好、不回頭', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  const opts = [[3, 7, 5], [6, 2, 4], [1, 5, 8], [4, 9, 2]], xs = [-3.4, -0.9, 1.6, 4.1], keep = [];
  await step(tok);                                   // 126.0 為什麼叫 greedy：短視近利
  const me = pal('greedy', -6, GJ.orange, 1.8, 0.8); me.mood('happy');
  const b1 = bub('眼前最好的先拿！', -6, 2.4, 1.8);
  say('Greedy：短視近利的方法', '只看眼前、不想以後');
  await step(tok);                                   // 140.0 step by step 兜出 solution
  remove(b1);
  xs.forEach((x, s) => tag('step ' + (s + 1), 'idx', x, 6.4));
  say('step by step 兜出最後的 solution', '每個 step 做一個 decision');
  await step(tok);                                   // 149.0 每個 step 選當下看到最好的
  me.look(0.6);
  await pickStep(tok, 0, opts[0], xs[0], keep);
  say('每一步都選「當下看起來最好」的', 'step 1：選 7');
  await step(tok);                                   // 174.0 「最好」要靠一個 criterion 定義
  const cr = pkt('criterion：數字最大 = 最好', -0.2, 7.2);
  say('什麼叫最好？要給一個 criterion', '這個 rule 是需要設計的');
  await step(tok);                                   // 200.0 很容易想出 greedy：直覺、一個 loop
  await pickStep(tok, 1, opts[1], xs[1], keep);
  arrow(V3(xs[0] + 0.5, 1.2, 0), V3(xs[1] - 0.5, 1.2, 0));
  say('任何問題都很容易想出一個 greedy', '直覺，通常一個 loop 就寫完');
  await step(tok);                                   // 232.0 做完決定就不再回頭
  await pickStep(tok, 2, opts[2], xs[2], keep);
  arrow(V3(xs[1] + 0.5, 1.2, 0), V3(xs[2] - 0.5, 1.2, 0));
  const lk = note('鎖定，不回頭', xs[0], 0.4);
  say('做完決定就不再回頭看', '沒有反覆猶豫');
  await step(tok);                                   // 245.0 跑得快、好寫、好懂
  await pickStep(tok, 3, opts[3], xs[3], keep);
  arrow(V3(xs[2] + 0.5, 1.2, 0), V3(xs[3] - 0.5, 1.2, 0));
  await me.hop(tok);
  say('跑得快、好寫、好懂', '發展起來也很簡單');
  await step(tok);                                   // 254.0 但 solution quality 常常很差
  me.mood('sad'); remove(cr);
  const q = bad('solution quality 常常很差', 0.4, 7.2);
  say('壞就壞在：解常常不好', '短視的選擇不一定最後最好');
  await step(tok);                                   // 261.0 有些問題它就能拿到最佳解
  remove(q); me.mood('happy');
  keep.forEach((c) => glow(c, GOLD));
  good('有些問題用它就能得到 optimal', 0.4, 7.2);
  say('但不是永遠運氣這麼背', '有些問題 greedy 就是最佳解');
  await step(tok);                                   // 278.0 挑戰：設計出 optimal 的 greedy 並證明
  remove(lk);
  pkt('挑戰：設計對的 greedy rule ＋ 證明它 optimal', 0.4, 0.2, 1.2);
  say('挑戰：為問題設計出 optimal 的 greedy', '而且要證明它');
}]);

// 04:54 兩種證明法：stays ahead（一路領先）與 exchange argument（挖掉貼上）
FRAG.push(['grjiang1-two-proofs', '兩種證明：stays ahead 與 exchange argument', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  await step(tok);                                   // 294.0 證明 greedy 最佳常用兩招
  tag('① greedy stays ahead', 'ptr alt', -3.6, 6.4);
  tag('② exchange argument', 'ptr alt', 3.4, 6.4);
  say('證明 greedy 是最佳解：兩招', '兩招都很常用');
  await step(tok);                                   // 304.0 第一招：每一步都做決定、選當下最好
  const r = racers(2.4);
  say('第一招：greedy stays ahead', '每一步都拿來跟 OPT 比');
  await step(tok);                                   // 325.0 一路第一名，像 100 公尺短跑
  await race(tok, r);
  r.g.mood('happy'); r.g.glow(GOLD); await r.g.hop(tok);
  say('一路都是第一名，到終點就是冠軍', '像 100 公尺短跑');
  await step(tok);                                   // 340.0 第二招更常用：exchange argument
  const star = pkt('更常用，一定要學會', 3.4, 5.6);
  say('第二招：exchange argument', '用「交換」的概念');
  await step(tok);                                   // 379.0 先假設神人找到最佳解
  remove(star);
  const god = pal('神人', 6.2, GJ.purple, 1.6, 0.6, 2.4); god.mood('happy');
  const blocks = ['o1', 'o2', 'o3', 'o4'].map((t, k) => cube(t, GJ.purple, [0.9, 0.7, 0.7], 1.4 + k * 1.1, 4.4, 0, 2));
  say('先假設有個神人找到 OPT', '我不管他怎麼找到的');
  await step(tok);                                   // 413.0 OPT 裡可能有不符合 greedy 選法的部分
  glow(blocks[1], RED);
  bub('這塊不是 greedy 會選的', 2.5, 5.4);
  say('OPT 裡有些部分不符合我的選法', '找出來');
  await step(tok);                                   // 422.0 把它挖掉
  fly(blocks[1], V3(0, 6, 3));
  say('把不符合的那塊挖掉', 'cut');
  await step(tok);                                   // 430.0 換成我的貼上去
  const mine = cube('g', GJ.teal, [0.9, 0.7, 0.7], 2.5, 4.4, 0, 3);
  say('換成 greedy 的選擇貼上去', 'paste');
  await step(tok);                                   // 446.0 換完一樣是 optimal → 證完
  glow(mine, GOLD); god.mood('wow');
  good('quality 沒變差 → 仍是 optimal', 3.0, 3.1);
  say('換完解一樣好，還是 optimal', '就證完了');
  await step(tok);                                   // 492.0 很常用，其他課本也大多用第二招
  pkt('★ 其他課本也大多用第二招', 3.4, 7.2);
  say('第二招是很 general 的證法', '建議一定要學會');
}]);

// 08:30 Interval scheduling：single core、選最多個互相 compatible 的 request
FRAG.push(['grjiang1-is-problem', 'Interval scheduling：最多 compatible request', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  await step(tok);                                   // 510.0 第一個問題 interval scheduling
  tag('Interval scheduling', 'ptr alt', 0, 6.6);
  say('第一個問題：interval scheduling', '用 stays ahead 來證明');
  await step(tok);                                   // 545.0 幫 single core CPU 排程
  const cpu = prop('cpu', 5.8, 0, 2.2, 0.8, 'single core');
  say('背景：幫 CPU 排程', '早期只有一個 core');
  await step(tok);                                   // 566.0 有 n 個 request，各有開始與結束時間
  const ax = gAx(0, 11, -5.5, 5.5, 0.8);
  const B = IS8.map(([s, f], i) => { tag(String(i + 1), 'idx', -6.3, 5.6 - i * 0.6); return gBar(ax, '', s, f, 5.6 - i * 0.6, GJ.sand, 2.5); });
  say('n 個 request：開始、結束時間都先知道', '每個對應時間軸上一段 interval');
  await step(tok);                                   // 612.0 第 i 個：s(i) 開始、f(i) 結束
  glow(B[1], GOLD);
  const sl = note('s(2)', ax.X(1), 5.3), fl = note('f(2)', ax.X(4), 5.3);
  say('第 i 個 request：s(i) 開始，f(i) 結束', '例：request 2');
  await step(tok);                                   // 620.0 左閉右開，頭尾可以無縫接起來
  txt(sl, '[ s(2)'); txt(fl, 'f(2) )');
  say('佔用 [s(i), f(i))：左閉右開', '頭尾可以無縫接起來');
  await step(tok);                                   // 648.0 選最多 request，彼此不能 overlap
  glow(B[1], null); remove(sl); remove(fl);
  say('目標：選最多個 request 來執行', '選出的 interval 不能 overlap');
  await step(tok);                                   // 677.0 這例子最多選 3 個
  [1, 4, 7].forEach((i) => tint(B[i], GJ.teal));
  const At = tag('最多 3 個：{ 2, 5, 8 }', 'ptr alt', 3.2, 6.1);
  say('這個例子最多選 3 個', 'compatible 的 request');
  await step(tok);                                   // 698.0 2 一結束馬上切去 5
  const l4 = vline(ax, 4, 6.0, 0.8);
  say('2 一結束馬上切去執行 5', 'f(2) = s(5) = 4，允許無縫接');
  await step(tok);                                   // 707.0 選了 2 就不能選 1、3、4
  kill(l4);
  [0, 2, 3].forEach((i) => glow(B[i], RED));
  say('選了 2 就不能選 1、3、4', '它們跟 2 overlap');
  await step(tok);                                   // 741.0 演藝廳借場地也是這題
  [0, 2, 3].forEach((i) => glow(B[i], null));
  kill(cpu);
  const hall = prop('warehouse', 5.8, 0, 2.4, 0.7, '演藝廳'); bob(hall, 0.03);
  const cl = [-5.2, -4.2, -3.2].map((x, k) => pal('', x, [GJ.pink, GJ.blue, GJ.orange][k], 2.4, 0.5));
  say('學校借演藝廳也是這個問題', '每個社團想好要哪一段時間');
  await step(tok);                                   // 789.0 想讓最多社團表演，first come first serve 不一定最好
  cl.forEach((c) => c.mood('happy'));
  bub('先到先贏 ≠ 最多社團能表演', 0, 7.2);
  say('要讓最多社團表演', 'first come first serve 不一定最好');
}]);

// 14:55 Greedy 模板：依 rule 選一個、reject overlap、重複
FRAG.push(['grjiang1-is-template', 'Greedy 模板：選一個、刪 overlap、重複', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  const D = [[0, 3], [2, 5], [4, 7], [6, 9]];
  let cd, ax, B;
  await step(tok);                                   // 899.5 要怎麼 select 適當的 request？
  cd = code(['repeat', '  依 greedy rule 選 request i', '  accept i', '  reject 跟 i overlap 的', 'until 全部處理完'], -3.4, 6.0, 0.6);
  ax = gAx(0, 9, 0.6, 6.6, 1.6);
  B = D.map(([s, f], i) => gBar(ax, String.fromCharCode(97 + i), s, f, 5.4 - i * 0.8, GJ.sand, 2));
  say('要怎麼選出適當的 request？', '先看 greedy 的一般流程');
  await step(tok);                                   // 923.0 「當下最好」要有規範：greedy rule
  pkt('greedy rule = 何謂「當下最好」', -3.4, 2.6);
  say('先訂一個 criterion', '這叫 greedy rule');
  await step(tok);                                   // 940.0 repeat：依想法選一個 request
  cd.hl(1); glow(B[1], GOLD);
  say('repeat：依 rule 選一個 request', '例：選 b');
  await step(tok);                                   // 955.0 選出來去執行它
  cd.hl(2); tint(B[1], GJ.teal); glow(B[1], null);
  say('選出來就 accept 它', '去執行它');
  await step(tok);                                   // 963.5 跟它 overlap 的先 reject
  cd.hl(3); [0, 2].forEach((i) => fly(B[i], V3(2, 6, 3)));
  say('跟它 overlap 的全部 reject', '只能留 compatible 的');
  await step(tok);                                   // 970.0 剩下的依同樣 rule 再選
  cd.hl(1); glow(B[3], GOLD); await beat(tok, 600);
  cd.hl(2); tint(B[3], GJ.teal); glow(B[3], null);
  say('再從剩下的用同樣的 rule 選', '選 d');
  await step(tok);                                   // 978.0 再 reject overlap，直到做完
  cd.hl(4);
  say('沒有人跟 d overlap 了', '全部處理完就結束');
  await step(tok);                                   // 987.0 greedy 大概都這樣做
  cd.hl(-1);
  good('A = { b, d }', 3.6, 6.5);
  say('greedy algorithm 大概都長這樣', '一個 loop，step by step');
  await step(tok);                                   // 999.0 rule 想出四種
  for (let k = 0; k < 4; k++) cube('rule ' + (k + 1) + '？', GJ.paper, [2.6, 0.55, 0.7], -4.65 + k * 3.1, 0.3, 0, 1.5);
  say('rule 怎麼訂？想出四種', '大家來討論哪個好');
}]);

// 16:51 四個 rule：前三個舉反例推翻，只剩最早結束
FRAG.push(['grjiang1-four-rules', '四個 greedy rule：反例推翻前三個', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const R = ['① 最早開始', '② 最短 interval', '③ 最少 conflict', '④ 最早結束'];
  const card = (k) => cube(R[k], GJ.paper, [2.8, 0.6, 0.7], -4.65 + k * 3.1, 5.6, 0, 2);
  const C = [];
  await step(tok);                                   // 1011.0 ① 先開始的先選
  C.push(card(0));
  say('rule ①：最早開始的先選', '');
  await step(tok);                                   // 1022.0 ② shortest interval
  C.push(card(1));
  say('rule ②：shortest interval', '佔用時間短，好像比較不會打架');
  await step(tok);                                   // 1043.0 ③ fewest conflicts
  C.push(card(2));
  say('rule ③：最少 conflict 的先選', '最少跟人打架');
  await step(tok);                                   // 1052.8 ④ 最早結束
  C.push(card(3));
  say('rule ④：最早結束的先選', '');
  await step(tok);                                   // 1061.0 大家來表決
  const voters = [-4.6, -1.5, 1.6, 4.7].map((x, k) => { const b = pal('', x, [GJ.blue, GJ.pink, GJ.orange, GJ.cyan][k], 1.8, 0.5, 3.0); return b; });
  voters[2].mood('happy'); bub('③ 比較少打架，很安全！', 1.6, 4.4, 1.8);
  say('大家來表決', '很多人選 ③');
  await step(tok);                                   // 1091.0 答案是 ④，很不直覺
  tint(C[3], GJ.teal); glow(C[3], GOLD); voters[3].mood('wow'); await voters[3].hop(tok);
  say('答案是 ④：最早結束', '真正能得最佳解的 rule 通常不直覺');
  await step(tok);                                   // 1125.0 前三個為什麼不行：舉反例就好
  [0, 1, 2].forEach((k) => glow(C[k], RED));
  say('前三個為什麼不行？舉反例就好', '一個 case 不 optimal 就不能 guarantee');
  // ① 最早開始
  let ax, L, S, a, b, sh, top, mid;
  await step(tok);                                   // 1151.0 反例①：最早開始卻很晚結束
  fresh([0, 3.6, 13], [0, 3.2, 0]); ax = gAx(0, 12, -6, 6, 0.8);
  tag('反例 ① 最早開始', 'ptr alt', 0, 6.4);
  L = gBar(ax, '最早開始', 0, 11, 4.8, GJ.sand, 2);
  S = [[1, 3], [3, 5], [5, 7], [7, 9]].map(([s, f]) => gBar(ax, '', s, f, 3.6, GJ.sand, 2));
  say('它最早開始，但也很晚結束', '');
  await step(tok);                                   // 1160.0 選它只有 1 個，別的選法 4 個
  tint(L, GJ.teal); S.forEach((x) => glow(x, RED));
  await beat(tok, 900);
  tint(L, GJ.gray); S.forEach((x) => { glow(x, null); tint(x, GJ.teal); });
  say('選它只有 1 個', '不選它可以有 4 個');
  // ② 最短 interval
  await step(tok);                                   // 1173.0 反例②：shortest interval
  fresh([0, 3.6, 13], [0, 3.2, 0]); ax = gAx(0, 12, -6, 6, 0.8);
  tag('反例 ② 最短 interval', 'ptr alt', 0, 6.4);
  a = gBar(ax, '', 0, 6, 3.6, GJ.sand, 2); b = gBar(ax, '', 6, 12, 3.6, GJ.sand, 2);
  say('兩個長的 request', '雖然長，但彼此 compatible');
  await step(tok);                                   // 1194.5 有一個很短，但跟兩個都打架
  sh = gBar(ax, '短', 5, 7, 4.8, GJ.sand, 2);
  await beat(tok, 700); glow(a, RED); glow(b, RED);
  say('一個很短的', '可是它跟兩個人都打架');
  await step(tok);                                   // 1208.0 選它只有 1 個，最佳是 2 個
  tint(sh, GJ.gray); glow(a, null); glow(b, null); tint(a, GJ.teal); tint(b, GJ.teal);
  say('選短的只有 1 個', '最佳是 2 個');
  // ③ 最少 conflict
  await step(tok);                                   // 1214.0 反例③：最少 conflict
  fresh([0, 3.6, 13], [0, 3.2, 0]); ax = gAx(0, 12, -6, 6, 0.8);
  tag('反例 ③ 最少 conflict', 'ptr alt', 0, 6.4);
  top = [[0, 3], [3, 6], [6, 9], [9, 12]].map(([s, f]) => gBar(ax, '', s, f, 5.2, GJ.sand, 2));
  mid = gBar(ax, '', 5, 7, 4.4, GJ.sand, 2);
  for (let r = 0; r < 3; r++) { gBar(ax, '', 2, 4, 3.6 - r * 0.6, GJ.sand, 2); gBar(ax, '', 8, 10, 3.6 - r * 0.6, GJ.sand, 2); }
  say('很多 request 擺在這裡', '看每個跟幾個人打架');
  await step(tok);                                   // 1238.0 它只跟兩個人 conflict
  [3, 4, 4, 3].forEach((c, i) => relabel(top[i], c)); relabel(mid, 2);
  tint(mid, GJ.teal); glow(top[1], RED); glow(top[2], RED);
  say('中間那個 conflict 最少：只有 2', '選它，上面兩個就不能選');
  await step(tok);                                   // 1249.5 其實可以選上面這四個
  glow(top[1], null); glow(top[2], null); tint(mid, GJ.gray); top.forEach((t) => tint(t, GJ.teal));
  say('其實上面這 4 個才是最佳', '選 conflict 最少的只能湊到 3 個');
  await step(tok);                                   // 1258.0 答案就是最後一個
  cube('④ 最早結束 ✔', GJ.teal, [3.6, 0.7, 0.8], 0, 7.0, 0.5, 2);
  say('剩下的答案：④ 最早結束', '');
}]);

// 21:27 選最早結束：最早把 resource 放出來；8 個 request 依 f 跑一次
FRAG.push(['grjiang1-eft-run', '最早結束優先：8 個 request 選出 2、5、8', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, B, At, alive, A = [];
  const pick = (i) => { alive.delete(i); A.push(i + 1); glow(B[i], GOLD); tint(B[i], GJ.teal); txt(At, 'A = { ' + A.join(', ') + ' }'); return vline(ax, IS8[i][1], 6.4, 1.3); };
  const reject = (i) => { const rej = [...alive].filter((j) => gOv(IS8[i], IS8[j])); rej.forEach((j) => { alive.delete(j); fly(B[j], V3(1, 6, 3)); }); glow(B[i], null); return rej; };
  await step(tok);                                   // 1287.0 最早結束的人最早把 resource 放出來
  ax = gAx(0, 11, -5.5, 5.5, 1.3);
  B = IS8.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.6, GJ.sand, 2));
  const res = prop('cpu', 6.1, 0, 2.4, 0.6, 'resource');
  say('最早結束 = 最早把 resource 放出來', '讓給後面的人用');
  await step(tok);                                   // 1326.0 先依 finish time 排序
  IS8ord.forEach((i, r) => move(B[i], ax.X((IS8[i][0] + IS8[i][1]) / 2), 6.0 - r * 0.6, 0));
  alive = new Set(IS8ord); At = tag('A = { }', 'ptr alt', 0, 0.3);
  say('先把 request 依 finish time 排序', '從小排到大');
  let l;
  await step(tok);                                   // 1333.0 選最早結束的 accept
  l = pick(1);
  say('選最早結束的：2', 'f(2) = 4，accept');
  await step(tok);                                   // 1340.0 跟它 conflict 的砍掉
  kill(l); reject(1);
  say('跟 2 打架的砍掉', '1、3、4 出局');
  await step(tok);                                   // 1346.1 剩下的再選最早結束、再砍
  l = pick(4); await beat(tok, 900); kill(l); reject(4);
  say('剩下的再選最早結束：5', '6、7 跟 5 打架，砍掉');
  await step(tok);                                   // 1354.0 選最早把 resource 放出來的
  l = pick(7); await beat(tok, 700); kill(l); reject(7);
  say('最後選 8', 'A = { 2, 5, 8 }');
  await step(tok);                                   // 1362.0 resource 越早放出來，剩下的人越有機會
  bob(res, 0.05);
  bub('越早放出來，後面越多人用得到', 3.2, 0.3, 2.4);
  say('resource 越早釋放越好', '剩下的 request 越有機會用到');
}]);

// 22:57 Pseudocode：A ← ∅；while R 非空：選 f 最小、加入 A、刪掉它與 overlap；feasible
const EFTCODE = ['1 A ← ∅', '2 while R ≠ ∅', '3   選 i ∈ R，f(i) 最小', '4   A ← A ∪ {i}', '5   R ← R − {i} − X', '6 return A'];
function eftSetup(withCode = true) {
  const cd = withCode ? code(EFTCODE, -3.6, 5.8, 0.62) : null;
  const ax = gAx(0, 11, 0.6, 6.6, 0.8);
  const B = IS8.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 5.8 - i * 0.6, GJ.sand, 2));
  return { cd, ax, B };
}
function eftRound(st, A, alive, At) {
  const i = [...alive].sort((p, q) => IS8[p][1] - IS8[q][1])[0];
  return {
    i,
    choose() { st.cd && st.cd.hl(2); glow(st.B[i], GOLD); },
    accept() { st.cd && st.cd.hl(3); tint(st.B[i], GJ.teal); glow(st.B[i], null); A.push(i + 1); alive.delete(i); txt(At, 'A = { ' + A.join(', ') + ' }'); },
    remove() { st.cd && st.cd.hl(4); const rej = [...alive].filter((j) => gOv(IS8[i], IS8[j])); rej.forEach((j) => { alive.delete(j); fly(st.B[j], V3(1, 6, 3)); }); return rej; },
  };
}
FRAG.push(['grjiang1-eft-code', 'Interval scheduling 的 pseudocode 與 feasible', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  let st, At, cd;
  const alive = new Set(IS8.map((r, i) => i)), A = [];
  await step(tok);                                   // 1379.0 輸入 R：所有 request，各有 s、f
  const ax = gAx(0, 11, 0.6, 6.6, 0.8);
  const B = IS8.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 5.8 - i * 0.6, GJ.sand, 2));
  st = { ax, B, cd: null };
  tag('R', 'ptr', 0.1, 6.4);
  say('輸入 R：所有 request 的 set', '每個有 s 和 f');
  await step(tok);                                   // 1392.0 輸出 A：accepted 的 set
  At = tag('A = ?', 'ptr alt', 3.6, 6.6);
  say('輸出 A：被 accept 的 request', '');
  await step(tok);                                   // 1405.0 寫成程式很簡單：loop ＋ if-else
  cd = code(EFTCODE, -3.6, 5.8, 0.62); st.cd = cd;
  say('greedy 寫成程式很簡單', '一個 while／for loop 加 if-else');
  await step(tok);                                   // 1425.0 A 先清成空集合
  cd.hl(0); txt(At, 'A = { }');
  say('第 1 行：A 先設成空集合 ∅', '裡面沒有任何 element');
  await step(tok);                                   // 1495.0 一輪一輪選目前最好的放進 A
  say('接著一輪一輪選目前最好的', '放進 A，最後吐出 A');
  await step(tok);                                   // 1510.0 只要 R 還有 request 沒處理
  cd.hl(1);
  say('第 2 行：只要 R 還不是空的', '就繼續處理');
  let rd = eftRound(st, A, alive, At);
  await step(tok);                                   // 1528.0 選 finish time 最小的
  rd.choose();
  say('第 3 行：選 f(i) 最小的', '最早結束的是 2');
  await step(tok);                                   // 1548.0 accept 它，放進 A
  rd.accept();
  say('第 4 行：accept，把 2 放進 A', '');
  await step(tok);                                   // 1571.0 R 扣掉 i，也扣掉 overlap 的 X
  rd.remove();
  say('第 5 行：R 扣掉 2，也扣掉 X', 'X = 跟 2 overlap 的 1、3、4');
  await step(tok);                                   // 1593.0 再從剩下的選最早結束
  cd.hl(1); rd = eftRound(st, A, alive, At); rd.choose(); await beat(tok, 700); rd.accept(); await beat(tok, 500); rd.remove();
  say('下一輪：選 5，扣掉 6、7', '');
  await step(tok);                                   // 1608.0 一直做到 R 空了，吐出 A
  cd.hl(1); rd = eftRound(st, A, alive, At); rd.choose(); await beat(tok, 600); rd.accept(); await beat(tok, 500); cd.hl(5);
  say('選 8，R 空了就 return A', 'A = { 2, 5, 8 }');
  await step(tok);                                   // 1632.0 第一個問題：feasible 嗎？
  const fq = pkt('feasible？A 互相 compatible 嗎？', 3.6, 0.0);
  say('先問：它 feasible 嗎？', '吐出來的 A 合不合法');
  await step(tok);                                   // 1658.0 一定合法：第 5 行扣掉 overlap
  cd.hl(4); remove(fq);
  good('✔ feasible：第 5 行刪光 overlap', 3.6, 0.0);
  say('一定合法', '每次都把 overlap 的扣掉了');
  await step(tok);                                   // 1684.0 接著問：是最佳解嗎？
  cd.hl(-1);
  pkt('optimal？', -3.6, 1.6);
  say('接著問：它是最佳解嗎？', '是不是最大的 set');
  await step(tok);                                   // 1698.0 efficiency：run time？
  pkt('running time？', -1.2, 1.6);
  say('還要問：跑多快？', '下次用 stays ahead 證明');
}]);

// 28:54 第二堂：複習 interval scheduling 與 procedure
FRAG.push(['grjiang1-is-review', '複習：interval scheduling 與 earliest finish', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  let st, At, cd, cards;
  const alive = new Set(IS8.map((r, i) => i)), A = [];
  await step(tok);                                   // 1734.0 複習：每個 request 有開始結束時間
  st = eftSetup(false);
  say('複習：每個 request 有開始和結束時間', '在時間軸上形成一段 interval');
  await step(tok);                                   // 1764.0 只有一台機器，同時只能跑一個
  const cpu = prop('cpu', -4.6, 3.2, 0, 1.0, '只有一台機器');
  say('只有一台機器', '同一時間只能跑一個 request');
  await step(tok);                                   // 1776.0 不能 overlap，越多越好
  [1, 4, 7].forEach((i) => tint(st.B[i], GJ.teal));
  say('選出的 interval 不能 overlap', '目標：選越多越好');
  await step(tok);                                   // 1831.0 何謂最好：greedy rule
  [1, 4, 7].forEach((i) => tint(st.B[i], GJ.sand));
  const gr = pkt('greedy rule = 何謂最好', -4.6, 1.4);
  say('greedy：每步選當下看起來最好的', '「最好」由 greedy rule 定義');
  At = tag('A = { }', 'ptr alt', 3.6, 6.6);
  let rd = eftRound(st, A, alive, At);
  await step(tok);                                   // 1851.0 依原則挑出第一個 request
  rd.choose(); await beat(tok, 600); rd.accept();
  say('依 rule 挑出第一個 request', '');
  await step(tok);                                   // 1870.0 overlap 的先去掉
  rd.remove();
  say('跟它 overlap 的先去掉', '剩下的都還 compatible');
  await step(tok);                                   // 1884.0 剩下的再依同樣 rule 選第二個
  rd = eftRound(st, A, alive, At); rd.choose(); await beat(tok, 600); rd.accept(); await beat(tok, 500); rd.remove();
  rd = eftRound(st, A, alive, At); await beat(tok, 300); rd.choose(); await beat(tok, 500); rd.accept();
  say('剩下的依同樣 rule 選，直到做完', '');
  await step(tok);                                   // 1912.0 四種 rule
  kill(cpu); remove(gr);
  cards = ['① 最早開始', '② 最短', '③ 最少 conflict', '④ 最早結束'].map((t, k) => cube(t, GJ.paper, [2.6, 0.5, 0.6], -4.2, 5.6 - k * 0.8, 0, 1.5));
  say('上次想了四種 rule', '');
  await step(tok);                                   // 1952.0 舉反例把前三種拒絕
  [0, 1, 2].forEach((k) => { tint(cards[k], GJ.gray); glow(cards[k], RED); });
  say('前三種都被反例推翻', '舉一個反例就夠了');
  await step(tok);                                   // 1969.0 採用最早結束時間：早點 release resource
  [0, 1, 2].forEach((k) => glow(cards[k], null));
  tint(cards[3], GJ.teal); glow(cards[3], GOLD);
  say('採用最早結束時間', '比較早把 resource release 出來');
  await step(tok);                                   // 2010.0 寫成 procedure
  cards.forEach(kill);
  cd = code(EFTCODE, -3.6, 5.8, 0.62);
  say('照這個 rule 就有一個 procedure', '');
  await step(tok);                                   // 2023.0 R：還沒處理的；A 一開始空集合
  cd.hl(0);
  say('R = 還沒處理的 request', 'A 一開始是空集合');
  await step(tok);                                   // 2049.0 選最早結束的，放進 A
  cd.hl(2); await beat(tok, 700); cd.hl(3);
  say('每輪選最早結束的', '把它放進 A');
  await step(tok);                                   // 2079.0 R 扣掉它，也扣掉 overlap 的 X
  cd.hl(4);
  say('R 扣掉它，也扣掉 X', 'X = 跟它 overlap 的人');
  await step(tok);                                   // 2118.0 先證合理：第 5 行保證 compatible
  good('✔ 合法：第 5 行刪光 overlap', 3.6, 0.0);
  say('先證合理：A 一定 compatible', '第 5 行保證');
  await step(tok);                                   // 2184.0 接著：會不會到達最佳解？
  cd.hl(-1);
  pkt('optimal？', -3.6, 1.6);
  say('接著要證：它是最佳解嗎？', '');
}]);

// 36:46 Stays ahead 的想法：只比個數，partial solution 每步都不輸
const SA_A = [[0, 2], [3, 5], [6, 8]], SA_O = [[1, 3], [3.5, 6], [6, 9]];
FRAG.push(['grjiang1-stays-ahead-idea', 'Stays ahead：只要 |A| = |O|', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, a, o, ra, ro;
  await step(tok);                                   // 2208.0 第一種證法：stays ahead
  tag('the greedy algorithm stays ahead', 'ptr alt', 0, 6.6);
  ra = pal('A', -6.3, GJ.teal, 1.0, 0.55, 4.0); ro = pal('O', -6.3, GJ.purple, 1.0, 0.55, 2.4);
  say('第一種證法：greedy stays ahead', '一路都是第一名');
  await step(tok);                                   // 2234.0 題目：最大 size 的 compatible subset
  ax = gAx(0, 10, -5, 5, 1.2);
  a = SA_A.map(([s, f], k) => gBar(ax, 'i' + (k + 1), s, f, 4.6, GJ.teal, 2));
  o = SA_O.map(([s, f], k) => gBar(ax, 'j' + (k + 1), s, f, 3.0, GJ.purple, 2));
  say('題目要的是最大 size 的 compatible subset', '上：greedy 的 A；下：另一個解');
  await step(tok);                                   // 2250.0 只關心個數
  const ca = note('3 個', 5.8, 4.6), co = note('3 個', 5.8, 3.0);
  say('我們只關心選了幾個', '你 3 個、我 3 個，就一樣好');
  await step(tok);                                   // 2290.0 假設有人找到最佳解 O
  ro.mood('happy'); relabelBuddy(ro, 'O（optimal）');
  say('假設有人找到最佳解，叫它 O', 'big O 這個 set');
  await step(tok);                                   // 2317.0 不用一模一樣，只要個數一樣
  pkt('不必 A = O，只要 |A| = |O|', 0, 0.2);
  say('不用證 A 跟 O 一模一樣', '只要個數一樣就好');
  await step(tok);                                   // 2365.0 step by step 比 partial solution
  glow(a[0], GOLD); glow(o[0], GOLD);
  const l1 = vline(ax, 2, 5.0, 1.2, '#1f9e6e'), l2 = vline(ax, 3, 3.4, 1.2, '#9b7ef4');
  say('step by step 比 A 和 O 的 partial solution', '第 1 個：A 比較早結束');
  await step(tok);                                   // 2389.0 每一步 greedy 都不比 O 差
  glow(a[0], null); glow(o[0], null); kill(l1); kill(l2);
  for (let r = 1; r < 3; r++) { glow(a[r], GOLD); glow(o[r], GOLD); await beat(tok, 900); glow(a[r], null); glow(o[r], null); }
  ra.mood('happy'); await ra.hop(tok);
  say('每一步 greedy 都不比 O 差', 'always stays ahead');
}]);
function relabelBuddy(b, t) { if (b.name) b.name.element.textContent = t; }

// 40:07 Lemma：f(i_r) ≤ f(j_r)；base case r = 1
FRAG.push(['grjiang1-lemma-base', 'Lemma f(i_r) ≤ f(j_r)：base case', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, B, lem, l1, l2;
  const R = [[1, 3], [0, 2], [2, 4], [3.5, 6], [3, 5], [6, 9], [5, 7]];
  await step(tok);                                   // 2406.4 目標：|A| = |O|
  tag('目標：|A| = |O|', 'ptr alt', 0, 6.6);
  say('最後要證：A 的個數 = O 的個數', '');
  await step(tok);                                   // 2419.0 分兩步，先證一個小 lemma
  note('① 先證小 lemma　② 再證 |A| = |O|', 0, 6.0);
  say('拆成兩步', '先證一個小 lemma');
  await step(tok);                                   // 2436.0 A = {i1..ik}，依選的順序
  ax = gAx(0, 10, -5, 5, 0.8);
  B = R.map(([s, f], k) => gBar(ax, '', s, f, 5.4 - k * 0.62, GJ.sand, 2));
  note('A = { i1, i2, …, ik }（依 greedy 選的順序）', -2.6, -0.2);
  say('A = { i1 … ik }：k 個', '照 greedy 選進來的順序編號');
  await step(tok);                                   // 2478.0 O = {j1..jm}，個數未知
  [0, 3, 5].forEach((k) => tint(B[k], GJ.purple));
  note('O = { j1, …, jm }', 3.6, -0.2);
  say('O = { j1 … jm }：m 個', '現在還不知道 m、k 誰大');
  await step(tok);                                   // 2531.0 把 O 依時間從小排到大
  [0, 3, 5].forEach((k, n) => relabel(B[k], 'j' + (n + 1)));
  say('O 互相不 overlap', '所以可以依時間從小排到大');
  await step(tok);                                   // 2578.0 Lemma：f(i_r) ≤ f(j_r)
  lem = pkt('Lemma：r = 1..k，f(i_r) ≤ f(j_r)', 0, 7.2);
  say('Lemma：對齊第 r 個比', 'A 的 finish ≤ O 的 finish');
  await step(tok);                                   // 2609.0 直覺：i1 是全部裡最早結束的
  tint(B[1], GJ.teal); relabel(B[1], 'i1'); glow(B[1], GOLD);
  say('i1 是「全部」request 裡最早結束的', 'greedy 第一步就選它');
  await step(tok);                                   // 2613.0 j1 只是 O 裡最早結束的
  glow(B[0], GOLD);
  say('j1 只是 O 這個 subset 裡最早結束的', '');
  await step(tok);                                   // 2642.0 用數學歸納法
  glow(B[0], null); glow(B[1], null);
  note('數學歸納法：base → inductive step', 0, 6.0);
  say('用數學歸納法（induction）證', '先做 base：r = 1');
  await step(tok);                                   // 2659.0 base：全部的最小 ≤ subset 的最小
  l1 = vline(ax, 2, 5.9, 0.8, '#1f9e6e'); l2 = vline(ax, 3, 5.9, 0.8, '#9b7ef4');
  tag('f(i1)', 'idx', ax.X(2) - 0.4, 6.2); tag('f(j1)', 'idx', ax.X(3) + 0.4, 6.2);
  say('整體的最小值 ≤ subset 的最小值', '');
  await step(tok);                                   // 2693.0 所以 f(i1) ≤ f(j1)
  good('r = 1：f(i1) ≤ f(j1) ✔', 3.8, 1.6);
  say('所以 f(i1) ≤ f(j1)', 'base case 成立');
}]);

// 45:01 Inductive step：f(i_{r-1}) ≤ f(j_{r-1}) ≤ s(j_r) → j_r 還在 R → f(i_r) ≤ f(j_r)
FRAG.push(['grjiang1-lemma-induct', 'Inductive step：j_r 還在 R 裡', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, i1, j1, j2, x, la, lb, lc, i2, inR, ghost;
  await step(tok);                                   // 2701.3 inductive step：weak induction
  ax = gAx(0, 10, -5, 5, 1.2);
  tag('A', 'idx', -6, 4.6); tag('O', 'idx', -6, 3.0);
  i1 = gBar(ax, 'i(r−1)', 0, 2, 4.6, GJ.teal, 2); j1 = gBar(ax, 'j(r−1)', 1, 3, 3.0, GJ.purple, 2); j2 = gBar(ax, 'j(r)', 3.5, 6, 3.0, GJ.purple, 2);
  say('inductive step：weak induction', '每次前進一步');
  await step(tok);                                   // 2718.0 假設 r−1 時成立
  la = vline(ax, 2, 5.0, 1.2, '#1f9e6e'); lb = vline(ax, 3, 3.4, 1.2, '#9b7ef4');
  say('假設 r−1 時成立', 'f(i(r−1)) ≤ f(j(r−1))，要推到 r');
  await step(tok);                                   // 2762.0 怕 i(r) 會比 j(r) 晚結束？
  ghost = gBar(ax, 'i(r)?', 5, 8, 4.6, GJ.gray, 2);
  bub('i(r) 會不會比 j(r) 晚結束？', 3.6, 6.2);
  say('會不會下一個 i(r) 反而比 j(r) 晚？', '不用擔心，往下推');
  await step(tok);                                   // 2806.6 O compatible：f(j(r−1)) ≤ s(j(r))
  kill(ghost);
  lc = vline(ax, 3.5, 3.4, 1.2);
  say('O 是 compatible set', 'f(j(r−1)) ≤ s(j(r))');
  await step(tok);                                   // 2848.0 f(i(r−1)) 更小 → 也 compatible
  glow(j2, GOLD);
  say('f(i(r−1)) 又更早', '所以 j(r) 跟 i(r−1) 也 compatible');
  await step(tok);                                   // 2866.6 procedure：選 i(r−1) 時 reject overlap 的
  x = gBar(ax, '', 1.5, 4, 5.6, GJ.sand, 2);
  await beat(tok, 700); glow(x, RED); await beat(tok, 500); fly(x, V3(0, 6, 3));
  say('選 i(r−1) 時，跟它 overlap 的被 reject', '');
  await step(tok);                                   // 2905.0 j(r) 沒被槓掉，還在 R
  inR = note('j(r) 沒被槓掉，仍在 R', ax.X(4.75), 2.2);
  say('j(r) 跟它不 overlap，沒被槓掉', '選 i(r) 那輪，j(r) 還在 R');
  await step(tok);                                   // 3000.0 i(r) 是 R 裡 finish 最小的
  i2 = gBar(ax, 'i(r)', 3, 5, 4.6, GJ.teal, 2.5);
  await beat(tok, 600); glow(i2, GOLD);
  say('i(r) 選的是 R 裡 finish 最小的', 'j(r) 也在 R 裡給它挑');
  await step(tok);                                   // 3068.0 可能剛好同一個 → 等號
  note('同一個 → 等號', ax.X(4.5), 6.0);
  say('可能剛好選到 j(r)', '那就是等號');
  await step(tok);                                   // 3083.0 不一樣 → f(j(r)) 比較大
  const ld = vline(ax, 5, 5.0, 1.2, '#1f9e6e'), le = vline(ax, 6, 3.4, 1.2, '#9b7ef4');
  say('沒選到 j(r)，表示 j(r) 結束比較晚', 'f(i(r)) ≤ f(j(r))');
  await step(tok);                                   // 3101.0 結論：對齊比，每個都比 O 早或一樣
  [la, lb, lc, ld, le].forEach(kill); remove(inR);
  good('Lemma 得證：每一個都不比 O 晚結束', 0, 6.6);
  say('對齊比較，每個都比 O 早或一樣', 'lemma 證完');
}]);

// 52:52 反證：若 m > k，j(k+1) 在 i(k) 結束後仍在 R，loop 應繼續 → 矛盾
FRAG.push(['grjiang1-optimal-contra', '反證法：|A| = |O|', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, a, o, l1, l2, l3, rt, ghost;
  await step(tok);                                   // 3172.0 用反證法
  tag('第二部分：反證法', 'ptr alt', 0, 6.6);
  say('第二部分：用反證法', 'by contradiction');
  await step(tok);                                   // 3193.0 假設 A 不是 optimal
  ax = gAx(0, 10, -5, 5, 1.2);
  tag('A', 'idx', -6, 4.6); tag('O', 'idx', -6, 3.0);
  a = [[0, 2], [3, 5]].map(([s, f], k) => gBar(ax, k ? 'ik' : 'i1', s, f, 4.6, GJ.teal, 2));
  o = [[1, 3], [3.5, 6], [6, 9]].map(([s, f], k) => gBar(ax, ['j1', 'jk', 'j(k+1)'][k], s, f, 3.0, GJ.purple, 2));
  say('假設 A 不是 optimal', '那 O 會選得比較多');
  await step(tok);                                   // 3218.0 所以 m > k
  note('m > k', 5.8, 3.0);
  say('O 有 m 個、A 有 k 個', '所以 m > k');
  await step(tok);                                   // 3238.0 由 lemma：f(i_k) ≤ f(j_k)
  l1 = vline(ax, 5, 5.0, 1.2, '#1f9e6e'); l2 = vline(ax, 6, 3.4, 1.2, '#9b7ef4');
  say('由 lemma：f(ik) ≤ f(jk)', '對齊來看 A 都比較早結束');
  await step(tok);                                   // 3288.5 m 比較多 → 存在 j(k+1)
  glow(o[2], GOLD);
  say('m 比較多，一定有 j(k+1)', '排在 jk 後面');
  await step(tok);                                   // 3341.0 O compatible：s(j(k+1)) ≥ f(jk)
  say('O 是 compatible set', 's(j(k+1)) ≥ f(jk)');
  await step(tok);                                   // 3413.0 串起來：f(ik) ≤ s(j(k+1))
  note('f(ik) ≤ f(jk) ≤ s(j(k+1))', 0, 0.2);
  say('串起來：f(ik) ≤ s(j(k+1))', 'j(k+1) 跟 ik 也 compatible');
  await step(tok);                                   // 3437.0 ik 選完，j(k+1) 槓不掉
  rt = note('ik 選完，R 裡還有 j(k+1)', ax.X(7.5), 2.2);
  say('選完 ik，j(k+1) 不會被槓掉', 'R 裡還有人');
  await step(tok);                                   // 3478.0 while loop 會再跑 → 應有 i(k+1)
  ghost = gBar(ax, 'i(k+1)?', 6, 9, 4.6, GJ.gray, 2.5);
  say('while loop 還會再跑一輪', 'A 應該還有 i(k+1)');
  await step(tok);                                   // 3499.0 但 A 只有 k 個 → 矛盾
  glow(ghost, RED);
  bad('矛盾！A 只有 k 個', 3.6, 6.0);
  say('可是 A 只有 k 個', '跟 procedure 矛盾');
  await step(tok);                                   // 3528.0 所以 A 是 optimal，|A| = |O|
  [l1, l2].forEach(kill); fly(ghost, V3(0, 6, 3)); remove(rt);
  good('|A| = |O|：A 是 optimal', 0, 6.0);
  say('假設錯了，A 是 optimal', '個數一樣多');
  await step(tok);                                   // 3563.0 stays ahead：greedy 都跑在前方
  const g = pal('greedy', -6.2, GJ.teal, 1.8, 0.6); g.mood('happy'); await g.hop(tok);
  say('這就是 stays ahead', 'greedy 一路跑在前方到底');
}]);

// 59:59 直接實作：排序 O(n log n)，但第 5 行每輪跟剩下全部比 → O(n²)
FRAG.push(['grjiang1-naive-n2', '直接照 pseudocode 做：O(n²)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3, 0]);
  const n = 8, C = [], cols = [];
  const bar = (k) => { const h = (n - 1 - k) * 0.45; glow(C[k], GOLD); tint(C[k], GJ.teal); cols.push(cube(String(n - 1 - k), GJ.orange, [0.9, Math.max(0.1, h), 0.6], -4.9 + k * 1.4, 0.3 + h / 2, 0, 1.5)); };
  await step(tok);                                   // 3600.0 implementation：efficiency 多高
  const cd = code(EFTCODE, -3.0, 7.2, 0.4);
  say('接著寫程式：implementation', '要花多少時間？');
  await step(tok);                                   // 3655.0 每次選最早結束 → 先依 finish 排序
  cd.hl(2);
  for (let i = 0; i < n; i++) C.push(cube('r' + (i + 1), GJ.sand, [1.0, 0.55, 0.6], -4.9 + i * 1.4, 4.6, 0, 2));
  say('要每次選最早結束', '先依 finish time 從小排到大');
  await step(tok);                                   // 3669.0 排序需要 O(n log n)
  note('sorting：O(n log n)', 4.6, 5.6);
  say('排序需要 O(n log n)', '之後的課再講為什麼');
  await step(tok);                                   // 3703.0 第 5 行：去掉 overlap 的
  cd.hl(4);
  say('第 5 行：要把 overlap 的都去掉', '怎麼檢查？');
  await step(tok);                                   // 3718.0 finish 晚不代表不 overlap
  bub('finish 晚，start 也可能很早', 2.6, 3.4);
  say('finish 比較晚不代表不 overlap', 'starting time 可能很早');
  await step(tok);                                   // 3731.0 第 1 個要跟 n−1 個比
  bar(0);
  say('選出第 1 個，要跟剩下 n−1 個比', '');
  await step(tok);                                   // 3749.0 第 2 個跟 n−2 個比
  glow(C[0], null); bar(1);
  say('第 2 個跟 n−2 個比', 'worst case');
  await step(tok);                                   // 3756.0 第 3 個 n−3、第 4 個 n−4…
  glow(C[1], null);
  for (let k = 2; k < n - 1; k++) { bar(k); await beat(tok, 300); glow(C[k], null); }
  say('第 3 個 n−3、第 4 個 n−4……', '');
  await step(tok);                                   // 3767.5 加起來
  note('(n−1)+(n−2)+…+1 = n(n−1)/2', 0, 6.4);
  say('全部加起來', '(n−1)+(n−2)+…+1');
  await step(tok);                                   // 3773.0 O(n²)
  bad('第 5 行累計 O(n²)', 4.6, 2.6);
  say('= O(n²)', '整個演算法變成 O(n²)');
  await step(tok);                                   // 3799.0 能改進嗎？排序省不掉
  say('這樣好嗎？顯然可以改進', '排序 O(n log n) 省不掉');
  await step(tok);                                   // 3818.0 目標：其他部分不超過 n log n
  pkt('目標：整體 O(n log n)', 4.6, 1.6);
  say('目標：其他步驟都不超過 n log n', '');
}]);

// 63:53 一次掃描的想法：S = 依 finish 排序後的 starting time；只往前掃
const OP7 = [[0, 2], [1, 3], [3, 5], [4, 6], [6, 8], [1, 9], [7, 10]];
FRAG.push(['grjiang1-onepass-idea', '只掃一次 R：starting time sequence', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const X = (i) => -4.5 + i * 1.5;
  let S, cur;
  await step(tok);                                   // 3835.0 另外 maintain starting time sequence S
  tag('S', 'idx', -6.2, 3.0);
  S = OP7.map((r, i) => cube('', GJ.paper, [0.8, 0.55, 0.6], X(i), 3.0, 0, 1.5));
  say('另外維護一個 starting time sequence S', '');
  await step(tok);                                   // 3853.0 依 finish 排好的順序記下 s
  tag('依 finish 排好：r1 … r7', 'idx', 0, 4.2);
  OP7.forEach(([s], i) => relabel(S[i], s));
  say('依已排好的 finish 順序', '把每個人的 starting time 記下來');
  await step(tok);                                   // 3874.0 重點：第 3–5 行怎麼做
  say('重點是後面第 3、4、5 行', '');
  await step(tok);                                   // 3881.0 不要每次從頭到尾掃
  cur = pkt('▲', X(0), 2.2);
  await travel(tok, cur, V3(X(0), 2.2, 0), V3(X(6), 2.2, 0), 900);
  await travel(tok, cur, V3(X(6), 2.2, 0), V3(X(1), 2.2, 0), 900);
  const back = bad('來回反覆掃 → n²', 0, 1.4);
  say('原本每輪都把 R 從頭掃到尾', '來回走路，才會 n²');
  await step(tok);                                   // 3903.0 只要從頭到尾掃一次
  remove(back);
  await travel(tok, cur, V3(X(1), 2.2, 0), V3(X(0), 2.2, 0), 400);
  await travel(tok, cur, V3(X(0), 2.2, 0), V3(X(6), 2.2, 0), 1600);
  say('希望 R 從頭到尾只掃一次', '指標只往前、不回頭');
  await step(tok);                                   // 3912.0 第 5 行合計 O(n)
  good('第 5 行合計 O(n)', 0, 1.4);
  say('這樣第 5 行全部加起來 O(n)', '');
  await step(tok);                                   // 3921.0 不破壞 n log n
  note('總共 = O(n log n) + O(n) = O(n log n)', 0, 6.4);
  say('O(n) 沒破壞 n log n', '整體還是 O(n log n)');
  await step(tok);                                   // 3938.0 只 reject partially conflicting 的
  say('關鍵：第 5 行不清得很徹底', '只 reject 一部分衝突的');
  await step(tok);                                   // 3976.0 選定後往後看 starting time
  cur.position.set(X(1), 2.2, 0); glow(S[0], GOLD);
  say('選定一個後，往後看 starting time', '有沒有跟它 overlap');
  await step(tok);                                   // 3991.0 比到超過 finish time 就停
  glow(S[1], RED); await beat(tok, 600); cur.position.x = X(2); glow(S[2], GREEN);
  say('比到 starting time 不再衝突就停', '不再往後比');
}]);

// 66:49 一次掃描的例子：只清 partial conflict，6 留給 5 來槓
FRAG.push(['grjiang1-onepass', '只掃一次 R 的例子：partial reject', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const XS = (i) => -4.5 + i * 1.5;
  let ax, B, S, cur, l;
  const A = [];
  const pick = (i) => { glow(B[i], GOLD); tint(B[i], GJ.teal); tint(S[i], GJ.teal); A.push(i + 1); return vline(ax, OP7[i][1], 6.4, 1.6); };
  const rej = (j) => { cur.position.x = XS(j); glow(S[j], RED); fly(B[j], V3(1, 6, 3)); tint(S[j], GJ.gray); };
  const stop = (j) => { cur.position.x = XS(j); glow(S[j], GREEN); };
  await step(tok);                                   // 4009.0 先花 n log n 依 finish 排好
  ax = gAx(0, 10, -5, 5, 1.6);
  B = OP7.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.6, GJ.sand, 2));
  tag('S', 'idx', -6.2, 0.4);
  S = OP7.map(([s], i) => cube(s, GJ.paper, [0.7, 0.5, 0.6], XS(i), 0.4, 0, 1.5));
  say('先花 O(n log n) 依 finish time 排好', '');
  await step(tok);                                   // 4032.0 starting time 可能凸出去很多
  glow(B[5], GOLD);
  say('starting time 可能凸出去很多', '例如 6 很早就開始');
  await step(tok);                                   // 4040.1 選 finish 最小的 1
  glow(B[5], null); l = pick(0);
  cur = pkt('▲', XS(1), -0.3);
  say('選 finish 最小的：1', 'f(1) = 2');
  await step(tok);                                   // 4059.0 用 1 的資訊檢查後面的 starting time
  glow(B[0], null);
  say('用 f(1) 去檢查後面的 starting time', '');
  await step(tok);                                   // 4077.0 s(2) < f(1) → 一定 overlap
  rej(1);
  say('s(2) = 1 < f(1)：一定 overlap', '2 槓掉');
  await step(tok);                                   // 4089.0 3 安全，停下來
  stop(2);
  say('s(3) = 3 ≥ f(1)：安全', '停下來，不再往後比');
  await step(tok);                                   // 4113.0 其實 6 也該被 1 槓掉
  glow(B[5], RED);
  say('其實 6 也跟 1 打架', '照原本的第 5 行要槓掉它');
  await step(tok);                                   // 4120.0 先不理它，後面一定有人槓掉
  glow(B[5], null);
  const later = note('6：先不理，交給後面', ax.X(5), 2.6);
  say('先不理它', '後面一定會有人把它槓掉');
  await step(tok);                                   // 4145.2 下一輪選 3
  kill(l); glow(S[2], null); l = pick(2);
  say('下一輪選 3', 'f(3) = 5');
  await step(tok);                                   // 4160.0 4 的 starting time 在 f(3) 之前 → 槓掉
  glow(B[2], null); rej(3); await beat(tok, 500); stop(4);
  say('s(4) = 4 < f(3)：槓掉 4', '5 安全，停');
  await step(tok);                                   // 4175.1 選 5
  kill(l); glow(S[4], null); l = pick(4);
  say('再選 5', 'f(5) = 8');
  await step(tok);                                   // 4189.0 6、7 都比 f(5) 早開始 → 槓掉
  glow(B[4], null); rej(5); await beat(tok, 600); rej(6);
  remove(later);
  say('s(6) = 1、s(7) = 7 都 < 8', '6、7 被槓掉');
  await step(tok);                                   // 4200.0 6 被 5 收拾掉了
  say('選 1 時沒槓的 6，現在被 5 收拾了', '後面總會有人幫忙');
  await step(tok);                                   // 4222.0 6 從 f(1) 之前一路佔到後面
  kill(l);
  const ghost = gBar(ax, '6', 1, 9, 2.6, GJ.gray, 0);
  say('6 在 f(1) 之前就開始，一路佔到很後面', '一定會跟後面選到的人打架');
  await step(tok);                                   // 4283.2 不用每輪都清得乾乾淨淨
  kill(ghost);
  tag('A = { ' + A.join(', ') + ' }', 'ptr alt', 0, 6.6);
  say('不用每輪都把衝突清乾淨', 'partially 清掉就好');
  await step(tok);                                   // 4313.2 只清 partial，R 只掃一遍
  good('cursor 只往前：第 5 行合計 O(n)', 3.0, -0.6);
  say('每輪只清 partial conflict', 'R 從頭到尾只掃一遍');
  await step(tok);                                   // 4337.0 總時間由排序決定 O(n log n)
  pkt('總共 O(n log n)', -3.0, -0.6);
  say('時間都花在一開始的排序', '總共 O(n log n)');
}]);

// 72:46 / Lec11 02:45 Interval partitioning：multiple resource、用最少台機器（coloring）
function cpuRow(n, x0 = 4.6, z = 2.4, dx = 1.1) { const out = []; for (let k = 0; k < n; k++) out.push(prop('cpu', x0 + (k - (n - 1) / 2) * dx, 0, z, 0.55)); return out; }
function ipBars(ax, drop = 2) { return IP10.map(([s, f], i) => gBar(ax, 'I' + (i + 1), s, f, 6.0 - i * 0.5, GJ.sand, drop, 0.34)); }
function ipColor(ax, B) { const lbl = gPartition(), Y = [4.4, 3.0, 1.6]; ['resource 1', 'resource 2', 'resource 3'].forEach((t, k) => tag(t, 'idx', -6.4, Y[k])); B.forEach((b, i) => { tint(b, LCOL[lbl[i]]); move(b, ax.X((IP10[i][0] + IP10[i][1]) / 2), Y[lbl[i]], 0); }); }
FRAG.push(['grjiang1-partition-intro', 'Interval partitioning：最少幾台機器', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, B, cpus;
  await step(tok);                                   // 4366.0 下一題：interval partitioning
  tag('Interval partitioning（interval coloring）', 'ptr alt', 0, 6.7);
  say('下一題：interval partitioning', '也叫 interval coloring：幫 interval 塗色');
  await step(tok);                                   // 4409.0 前一題只有一顆 core
  cpus = cpuRow(1);
  say('前一題只有一個 core', '只能挑出最大的 compatible set');
  await step(tok);                                   // 4431.3 現在有 multiple resource
  cpus.forEach(kill); cpus = cpuRow(3);
  say('現在有 multiple resource', '好幾個 core');
  await step(tok);                                   // 4451.0 最少需要多少 core 才能全部做完
  ax = gAx(0, 11, -5.5, 5.5, 0.6); B = ipBars(ax);
  say('反過來問：最少要幾個 core', '才能把所有 request 都做完');
  await step(tok);                                   // 4483.0 分成越少越好的 compatible subset
  ipColor(ax, B);
  say('把 request 分成 compatible subset', '分越少，用的 resource 越少');
  await step(tok);                                   // 4499.3 這例子三個 core 就夠
  cpus.forEach((c, k) => bob(c, 0.04));
  good('這例子：3 個 core', 3.8, 6.0);
  say('剛剛的例子只需要三個 core', '');
}]);

// ════════ 0UGaXukC4b0（Lec11：partitioning 的 depth、演算法、證明；minimize lateness） ════════
// 00:15 複習：greedy 的長相、上次用 stays ahead，今天用 exchange argument
FRAG.push(['grjiang1-review11', '複習：greedy 與兩種證明', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  const opts = [[3, 7, 5], [6, 2, 4], [1, 5, 8]], xs = [-3.4, -0.9, 1.6];
  let me, r;
  await step(tok);                                   // 15.9 複習：greedy step by step
  me = pal('greedy', -6, GJ.orange, 1.8, 0.8); me.mood('happy');
  xs.forEach((x, s) => tag('step ' + (s + 1), 'idx', x, 6.4));
  say('複習：greedy 一步一步兜出解', 'step by step');
  await step(tok);                                   // 45.0 每個 step 選當下最好的
  await pickStep(tok, 0, opts[0], xs[0]);
  say('每個 step 做一個 decision', '選當下看到最好的');
  await step(tok);                                   // 67.0 procedure 是 loop 的形式
  await pickStep(tok, 1, opts[1], xs[1]);
  await pickStep(tok, 2, opts[2], xs[2]);
  note('一個 loop：每個 iteration select 最好的', 0, 0.3);
  say('procedure 通常是一個 loop', '每個 iteration 選最好的');
  await step(tok);                                   // 82.5 重點：何謂當下最好
  pkt('何謂「當下最好」？ → greedy rule', 0, 7.2);
  say('重點：什麼叫當下最好', '要配合適當的 greedy rule');
  await step(tok);                                   // 98.0 要證明才能確認 optimal
  bub('還要證明它真的 optimal', -6, 2.4, 1.8);
  say('要透過證明確認', '它真的能到達最佳解');
  await step(tok);                                   // 114.0 上次用第一招：stays ahead
  fresh([0, 4, 14], [0, 3, 0]);
  tag('① greedy stays ahead（上次）', 'ptr alt', -3.6, 6.4);
  r = racers(2.4);
  await race(tok, r, -6.2, -1.6, 1800); r.g.mood('happy');
  say('上次用第一招：stays ahead', '一路第一名，最後拿冠軍');
  await step(tok);                                   // 136.0 今天另外兩個 interval 問題
  tag('今天：interval partitioning、minimize lateness', 'idx', 3.4, 5.4);
  say('今天兩個 interval graph 的問題', '');
  await step(tok);                                   // 147.0 改用 exchange argument：更 general
  tag('② exchange argument（今天）', 'ptr alt', 3.4, 6.4);
  const blocks = ['o1', 'o2', 'o3'].map((t, k) => cube(t, GJ.purple, [0.9, 0.7, 0.7], 2.2 + k * 1.1, 3.4, 0, 2));
  await beat(tok, 700); fly(blocks[1], V3(0, 6, 3));
  cube('g', GJ.teal, [0.9, 0.7, 0.7], 3.3, 3.4, 0, 2.5);
  say('今天用第二招：exchange argument', '比較 general 的證法');
}]);

// 02:45 Interval partitioning：multiple resource、用最少台機器（coloring）
FRAG.push(['grjiang1-partition-intro2', 'Interval partitioning：最少幾台機器', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, B, cpus;
  await step(tok);                                   // 165.0 interval partitioning
  tag('Interval partitioning', 'ptr alt', 0, 6.7);
  say('今天第一個問題：interval partitioning', '');
  await step(tok);                                   // 177.0 也叫 interval coloring：著色
  tag('= interval coloring（著色問題）', 'idx', 0, 6.25);
  say('又叫 interval coloring', '在 interval graph 上塗顏色');
  await step(tok);                                   // 194.0 每個 request 佔一段 interval
  ax = gAx(0, 11, -5.5, 5.5, 0.6); B = ipBars(ax);
  say('一樣：每個 request 有開始和結束', '在時間軸上佔一段 interval');
  await step(tok);                                   // 201.0 之前只有 single resource
  cpus = cpuRow(1);
  say('之前只有 single resource', '一台機器');
  await step(tok);                                   // 213.0 現在有 multiple resource
  cpus.forEach(kill); cpus = cpuRow(3);
  say('現在有 multiple resource', '好幾台電腦可以用');
  await step(tok);                                   // 241.0 目標：最少台電腦完成
  say('目標：用最少台電腦', '完成所有 request');
  await step(tok);                                   // 266.0 每個 request 都要完成
  pkt('每個 request 都要做完', 3.8, 6.0);
  say('跟前題不同：每個 request 都要完成', '只是用的機器越少越好');
  await step(tok);                                   // 282.0 一個 resource 想成一種顏色
  ['resource 1 = 藍', 'resource 2 = 橘', 'resource 3 = 紅'].forEach((t, k) => tag(t, 'idx', -4 + k * 4, 0.0));
  say('一個 resource 想成一種顏色', '所以叫 coloring');
  await step(tok);                                   // 303.0 overlap 的不能放同一台
  [0, 1, 2].forEach((i) => glow(B[i], RED));
  say('overlap 的 request 不能放同一台', '要分散到不同機器');
  await step(tok);                                   // 328.0 三個 resource 就做完
  [0, 1, 2].forEach((i) => glow(B[i], null));
  ipColor(ax, B);
  say('這例子三台機器就做完', '均勻分散在三個 resource');
  await step(tok);                                   // 344.0 不可能更少；解可能不只一種
  good('最佳：3 台，不可能更少', 3.8, 6.6);
  say('沒辦法比 3 台更少', '解可以不只一種，但都是 3 台');
}]);

// 06:02 Depth：任一時間點最多幾個 interval overlap；resource ≥ depth
FRAG.push(['grjiang1-depth', 'Depth d：resource 的 lower bound', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, B, sw, cnt, dt, cpus;
  const at = (t) => { if (sw) kill(sw); sw = line(ax.X(t), 6.3, ax.X(t), 0.6, 0, '#c08a1f'); cnt.position.x = ax.X(t); const on = IP10.map((r, i) => i).filter((i) => IP10[i][0] <= t && t < IP10[i][1]); B.forEach((b, i) => glow(b, on.includes(i) ? GOLD : null)); txt(cnt, on.length + ' 個'); return on.length; };
  await step(tok);                                   // 362.3 先找 resource 數目的 lower bound
  ax = gAx(0, 11, -5.5, 5.5, 0.6); B = ipBars(ax);
  say('先問：至少需要幾台？', 'resource 數目的 lower bound');
  await step(tok);                                   // 409.0 介紹 depth（深度）
  tag('depth（深度）', 'ptr alt', 0, 6.9);
  say('為了找 lower bound', '介紹一個概念：depth');
  await step(tok);                                   // 424.0 任一時間點有多少 request overlap
  cnt = tag('', 'ptr', ax.X(0), 6.55);
  at(0.5);
  say('看任一個時間點：有幾個 overlap', '時間 0.5：3 個');
  await step(tok);                                   // 437.0 depth = overlap 程度最高的數字
  say('depth = 整條時間軸上', 'overlap 最多的那個數字');
  await step(tok);                                   // 454.0 時間軸掃一次
  await anim(tok, 2200, (u) => at(0.5 + u * 10));
  say('把時間軸掃過一次', '每個時間點數一數');
  await step(tok);                                   // 465.0 這個例子最多 3 個 → depth 3
  B.forEach((b) => glow(b, null));
  dt = tag('depth d = 3', 'ptr alt', 4.6, 6.9);
  say('這個例子最多 3 個同時 overlap', 'depth = 3');
  await step(tok);                                   // 491.0 depth 就是 resource 的 lower bound
  pkt('#resource ≥ depth', -4.2, 6.9);
  say('depth 就是 resource 的 lower bound', '');
  await step(tok);                                   // 502.0 時間 1：三個 interval overlap
  at(1);
  [0, 1, 2].forEach((i) => glow(B[i], RED));
  say('例如時間 1：I1、I2、I3 同時要跑', '');
  await step(tok);                                   // 513.0 一定要分散到三台機器
  cpus = cpuRow(3, 4.6, 2.4);
  say('它們一定要分散到不同機器', '這一刻至少要 3 台');
  await step(tok);                                   // 542.0 Property：至少需要 depth 這麼多
  [0, 1, 2].forEach((i) => glow(B[i], null));
  say('Property：任何 instance', '都至少需要 depth 個 resource');
  await step(tok);                                   // 650.0 證明：I1..Id 在某時間點同時 overlap
  at(1);
  say('證明：depth = d', '表示某時間點有 I1 … Id 同時 overlap');
  await step(tok);                                   // 672.0 每個都需要自己的 resource
  cpus.forEach((c) => bob(c, 0.05));
  say('每一個都要一台自己的 resource', '');
  await step(tok);                                   // 699.0 至少 d 個；夠不夠等一下看
  B.forEach((b) => glow(b, null));
  note('至少 d 個；夠不夠？等一下看', 0, 0.1);
  say('所以至少要 d 個', '它只是 lower bound，夠不夠再看');
  await step(tok);                                   // 736.0 回家想：O(n log n) 內算出 d
  bub('能在 O(n log n) 內算出 d 嗎？', 0, 7.4);
  say('回家想：怎麼在 O(n log n) 算出 d', '排序免不了');
}]);

// 13:58 策略：先求 lower bound，再設計剛好用 d 台的方法 → 一定 optimal
FRAG.push(['grjiang1-reach-bound', '策略：直接達到 lower bound d', async (tok) => {
  fresh([0, 3.4, 12], [0, 2.8, 0]);
  const d = 3, Y0 = 0.3;
  let g = [];
  await step(tok);                                   // 838.0 depth d = resource 的 lower bound
  line(-6, Y0 + d * 0.9, 6, Y0 + d * 0.9, 0, '#c08a1f');
  tag('lower bound d = 3', 'ptr alt', -4.6, Y0 + d * 0.9 + 0.4);
  say('depth d 是需要 resource 的 lower bound', '');
  await step(tok);                                   // 856.0 不知道這個 lower bound 多 tight
  const sols = [5, 4, 6];
  sols.forEach((n, k) => { for (let r = 0; r < n; r++) cube('', GJ.purple, [1.0, 0.8, 0.8], -4.5 + k * 2.2, Y0 + 0.45 + r * 0.9, 0, 1.5); tag('某解：' + n + ' 台', 'idx', -4.5 + k * 2.2, Y0 - 0.4); });
  say('不知道它有多 tight', '別人的解可能都比 d 多');
  await step(tok);                                   // 864.0 能不能只用 d 個就做完？
  for (let r = 0; r < d; r++) g.push(cube('?', GJ.gray, [1.0, 0.8, 0.8], 3.6, Y0 + 0.45 + r * 0.9, 0, 2));
  say('能不能只用 d 個 resource', '就把全部做完？');
  await step(tok);                                   // 870.0 答案是 yes
  g.forEach((c) => { tint(c, GJ.teal); relabel(c, ''); });
  tag('greedy：剛好 d 台', 'ptr', 3.6, Y0 - 0.4);
  const me = pal('greedy', 5.6, GJ.teal, 1.4, 0.55); me.mood('happy');
  say('答案是 yes', '');
  await step(tok);                                   // 897.0 不管誰來做，至少要這麼多
  say('lower bound：不管誰來做都至少要這麼多', '所有解都 ≥ d');
  await step(tok);                                   // 909.0 我的方法直接 reach lower bound
  g.forEach((c) => glow(c, GOLD)); await me.hop(tok);
  say('我的方法剛好 reach 這個 lower bound', '');
  await step(tok);                                   // 919.0 所以一定是最好的
  good('reach lower bound → optimal', 0, 6.0);
  say('所以一定是最佳解', '證明就變簡單了');
}]);

// 16:04 演算法：依 s 排序；每個 interval 排除衝突的 label，指定一個空的
const PCODE = ['1 依 s 排序 I1..In', '2 for j = 1..n', '3   排除跟 Ij overlap 的 label', '4   if 還有 label 沒被排除', '5     把 Ij 指定給它', '6   else 略過 Ij'];
FRAG.push(['grjiang1-partition-code', 'Partitioning 演算法：依 s 排序、找空的 label', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  let cd, ax;
  const Y = [4.6, 3.4, 2.2], lbl = gPartition(), bars = [];
  const place = (j) => { const [s, f] = IP10[j]; const b = bars[j]; tint(b, LCOL[lbl[j]]); move(b, ax.X((s + f) / 2), Y[lbl[j]], 0); };
  const drop = (j) => { const [s, f] = IP10[j]; bars[j] = gBar(ax, 'I' + (j + 1), s, f, 6.2, GJ.sand, 1.5, 0.34); };
  await step(tok);                                   // 964.0 resource 編號 1..d（label）
  ax = gAx(0, 11, 0.8, 6.6, 0.8);
  Y.forEach((y, k) => tag('label ' + (k + 1), 'idx', 0.2, y + 0.4));
  say('已知 depth d，準備 d 個 resource', '編號 1 … d，叫 label');
  await step(tok);                                   // 981.0 每個 interval 指派一個 label
  say('每個 interval 指派一個 label', '');
  await step(tok);                                   // 995.0 overlap 的要在不同 label
  say('overlap 的 interval', '一定要放在不同 label');
  await step(tok);                                   // 1009.0 procedure 共六行
  cd = code(PCODE, -3.3, 6.0, 0.62);
  say('procedure 一共六行', '');
  await step(tok);                                   // 1023.0 先依 starting time 排序
  cd.hl(0);
  say('第 1 行：依 starting time 排序', 'I1 最早開始，In 最晚開始');
  await step(tok);                                   // 1048.3 第 2–6 行：for loop，linear scan
  cd.hl(1);
  say('第 2–6 行：一個 for loop', 'linear scan 一次');
  await step(tok);                                   // 1069.2 第一輪：拿最早開始的出來看
  drop(0);
  say('第一輪：拿最早開始的 I1 出來看', '');
  await step(tok);                                   // 1081.0 先把跟它不 compatible 的 label 槓掉
  cd.hl(2);
  say('第 3 行：槓掉跟它打架的 label', '現在每個 label 都還空著');
  await step(tok);                                   // 1100.0 有剩下的 label 就指派給它
  cd.hl(3); await beat(tok, 500); cd.hl(4); place(0);
  say('第 4、5 行：還有 label 就指派給它', 'I1 → label 1');
  await step(tok);                                   // 1108.0 第 6 行：全部都衝突就先略過
  cd.hl(5);
  say('第 6 行：全部衝突就先 skip', '等一下會證明這不會發生');
  await step(tok);                                   // 1132.8 依序一一拿出來指派
  for (let j = 1; j < 4; j++) { cd.hl(1); drop(j); await beat(tok, 350); cd.hl(4); place(j); await beat(tok, 350); }
  say('依 starting time 一個一個拿出來', '指派一個不打架的 label');
}]);

// 19:53 實作：每個 label 記 finish 水位；s_j ≥ 水位才可用；跑完 10 個
FRAG.push(['grjiang1-partition-run', '每個 label 記 finish 水位：10 個 interval 跑一次', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax, W;
  const Y = [4.6, 3.4, 2.2], fin = [0, 0, 0];
  const lit = (k, on) => { W[k].element.className = 'lab-label ' + (on ? 'ptr alt' : 'ptr'); };
  const put = (j, k) => { const [s, f] = IP10[j]; const b = gBar(ax, 'I' + (j + 1), s, f, Y[k], LCOL[k], 1.5, 0.34); fin[k] = f; txt(W[k], 'L' + (k + 1) + ' 水位 ' + f); return b; };
  const firstFree = (s) => fin.findIndex((x) => x <= s);
  await step(tok);                                   // 1195.0 實作的問題在第 3、4 行
  ax = gAx(0, 11, -5, 6, 0.8);
  Y.forEach((y, k) => line(-5, y - 0.25, 6, y - 0.25, 0, LCOL[k]));
  W = Y.map((y, k) => tag('L' + (k + 1), 'ptr', -6.1, y));
  say('實作的難處在第 3、4 行', '怎麼檢查跟某個 label 會不會 conflict？');
  await step(tok);                                   // 1281.5 每個 level 對應一個 resource
  say('每個 label 對應一個 resource', '');
  await step(tok);                                   // 1294.8 每個 label 記最後的 finish time
  W.forEach((w, k) => txt(w, 'L' + (k + 1) + ' 水位 0'));
  say('每個 label 記一個「水位」', '= 裡面最後一個 finish time');
  await step(tok);                                   // 1336.0 新 interval 拿 starting time 跟水位比
  const demo = gBar(ax, 'Ij', 3, 6, 6.0, GJ.sand, 1.5, 0.34);
  const sl = vline(ax, 3, 6.3, 0.8);
  say('新 interval j：拿 s(j) 跟水位比', '');
  await step(tok);                                   // 1356.0 開始得比水位早 → 一定 overlap
  bad('s(j) < 水位 → conflict', 3.4, 6.7);
  say('開始時間比水位早', '一定 overlap，這個 label 不能用');
  await step(tok);                                   // 1372.0 開始時間 ≥ 水位 → compatible
  good('s(j) ≥ 水位 → compatible', -2.6, 6.7);
  say('開始時間 ≥ 水位', '就 compatible，可以指派');
  await step(tok);                                   // 1395.0 例子：依 starting time 排好 I1..I10
  kill(demo); kill(sl);
  const names = IP10.map(([s], i) => tag('I' + (i + 1) + '：s=' + s, 'idx', -5 + i * 1.1, 0.05));
  say('例子：依 starting time 排好', 'I1 … I10，depth = 3');
  await step(tok);                                   // 1454.0 一開始水位都是 0，I1 放 L1
  lit(0, true); put(0, 0); await beat(tok, 600); lit(0, false);
  say('一開始水位都是 0', 'I1 放 label 1，水位變 2');
  await step(tok);                                   // 1475.0 I2：開始時間 0，L1 水位已到 2 → 不行
  lit(0, true);
  const nb = bad('I2：s = 0 < 2', -6.1, 5.3);
  say('I2 從 0 開始', 'L1 水位已經 2 → 不行');
  await step(tok);                                   // 1521.0 第二個顏色可以 → 放 L2
  lit(0, false); remove(nb); put(1, 1);
  say('換看 L2：水位 0，可以', 'I2 放 L2，水位變 5');
  await step(tok);                                   // 1536.0 I3：L1、L2 都不行 → L3，水位 2/5/2
  lit(0, true); lit(1, true); await beat(tok, 700); lit(0, false); lit(1, false); put(2, 2);
  say('I3：L1、L2 都不行，放 L3', '水位 = 2 / 5 / 2');
  await step(tok);                                   // 1560.0 第四個拿下來看
  put(3, firstFree(IP10[3][0]));
  say('I4 從 2 開始', 'L1 水位 2 ≤ 2，可以放');
  await step(tok);                                   // 1572.0 第五、六……第十依此類推
  for (let j = 4; j < 10; j++) { put(j, firstFree(IP10[j][0])); await beat(tok, 380); }
  names.forEach(remove);
  say('I5 … I10 依此類推', '每個都找到水位夠低的 label');
  await step(tok);                                   // 1621.0 靠水位就能快速檢查
  say('每個 label 都記水位', '檢查只要比大小，很快');
  await step(tok);                                   // 1672.0 第 6 行永遠不會發生
  good('第 6 行從來沒用到', 3.4, 6.7);
  say('第 6 行永遠不會發生', '每個人都塞得到適當的顏色');
  await step(tok);                                   // 1742.0 每個 resource 不 overlap，只用 3 個
  W.forEach((w, k) => lit(k, true));
  pkt('只用 3 個 = depth（lower bound）', -2.4, 6.7);
  say('每個 label 內都不 overlap', '只用 3 個 = lower bound');
}]);

// 29:16 算 depth：2n 個端點排序（同時刻先 finish 再 start），掃一次 d++/d--、記 dmax
FRAG.push(['grjiang1-depth-sweep', '算 depth：端點排序後掃一次', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const ev = [];
  IP10.forEach(([s, f], i) => { ev.push([s, 1, 's' + (i + 1)]); ev.push([f, 0, 'f' + (i + 1)]); });
  ev.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const EX = (k) => -6.0 + k * 0.63;
  let C, D, M, cur, d = 0, dm = 0, k = 0;
  const adv = (n) => { for (let e = 0; e < n && k < ev.length; e++, k++) { cur.position.x = EX(k); d += ev[k][1] ? 1 : -1; dm = Math.max(dm, d); C.forEach((c) => glow(c, null)); glow(C[k], GOLD); txt(D, 'd = ' + d); txt(M, 'dmax = ' + dm); } };
  await step(tok);                                   // 1757.0 回到怎麼算 depth
  tag('怎麼算 depth？', 'ptr alt', 0, 6.4);
  say('回到上次的問題：怎麼算 depth d', '');
  await step(tok);                                   // 1804.3 overlap 只在 start / finish 時變化
  say('overlap 的程度只在 start 或 finish 時改變', '中間切多細都一樣');
  await step(tok);                                   // 1828.0 start 與 finish 一起排序，2n 個數
  C = ev.map(([t, isS, nm], q) => { const c = cube(nm, isS ? GJ.teal : GJ.pink, [0.56, 0.5, 0.5], EX(q), 3.4, 0, 1.5); tag(String(t), 'idx', EX(q), 2.8); return c; });
  say('把 start 和 finish 一起排序', '共 2n 個數字');
  await step(tok);                                   // 1850.0 start 那刻佔用、finish 那刻不佔
  note('綠 = start（佔用）　粉 = finish（不佔）', 0, 4.4);
  say('start 那一刻開始佔用', 'finish 那一刻就不佔了');
  await step(tok);                                   // 1939.0 2n 個排序仍是 O(n log n)
  note('O(2n log 2n) = O(n log n)', 0, 5.6);
  say('排 2n 個數', '還是 O(n log n)');
  await step(tok);                                   // 1962.0 linear scan，維護 d 與 dmax
  D = tag('d = 0', 'ptr alt', -2, 6.4); M = tag('dmax = 0', 'ptr alt', 2, 6.4);
  say('linear scan，維護兩個變數', 'd = 目前 overlap，dmax = 答案');
  await step(tok);                                   // 1987.0 一開始都是 0
  cur = pkt('▲', EX(0) - 0.63, 2.2);
  say('一開始 d 和 dmax 都是 0', '');
  await step(tok);                                   // 2009.0 遇到 s1：d 加 1
  adv(1);
  say('遇到 s1：d++', 'd = 1');
  await step(tok);                                   // 2051.0 d 比 dmax 大 → 更新 dmax
  say('d 比目前的 dmax 大', 'dmax 也更新成 1');
  await step(tok);                                   // 2066.0 s2、s3 也都加 1
  adv(1); await beat(tok, 500); adv(1);
  say('s2、s3 也是 start：d++', 'd = 3，dmax = 3');
  await step(tok);                                   // 2077.0 遇到 finish：d 減 1
  adv(1); await beat(tok, 500); adv(1);
  say('遇到 finish：釋放 resource，d−−', 'd = 1');
  await step(tok);                                   // 2102.0 依此類推做完
  while (k < ev.length) { adv(1); await beat(tok, 140); }
  C.forEach((c) => glow(c, null));
  say('依此類推掃完', 'dmax = 3 = depth');
  await step(tok);                                   // 2125.0 小心：同一時刻有 finish 也有 start
  [3, 4, 5, 6].forEach((q) => glow(C[q], RED));
  say('要小心：同一時刻', '有人 finish、也有人 start');
  await step(tok);                                   // 2161.0 先 finish 再 start，否則會多算
  note('同時刻：先 finish 再 start（不然 d 會多算成 5）', 0, 1.4);
  say('同一時間：先排 finish 再排 start', '不然會多算');
  await step(tok);                                   // 2223.0 算 dmax 只要 O(n)
  [3, 4, 5, 6].forEach((q) => glow(C[q], null));
  good('掃描 O(n)', 4.6, 0.6);
  say('排序 O(n log n)，掃描只要 O(n)', '');
  await step(tok);                                   // 2252.0 跟 interval 總長度無關
  say('不必檢查每個時間點', '跟 interval 有多長無關');
}]);

// 38:12 Optimality 證明（一）：每個 interval 都拿得到 label
FRAG.push(['grjiang1-partition-proof', '證明：t + 1 ≤ d，一定剩一個 label', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const Y = [4.6, 3.4, 2.2], lbl = gPartition(), j = 7, [s, f] = IP10[j];
  let ax, B, Ij, sl;
  await step(tok);                                   // 2292.0 策略：先 lower bound，再 reach 它
  ax = gAx(0, 11, -5, 6, 0.8);
  Y.forEach((y, k) => tag('label ' + (k + 1), 'idx', -6.1, y));
  B = IP10.slice(0, 7).map(([s0, f0], i) => gBar(ax, 'I' + (i + 1), s0, f0, Y[lbl[i]], LCOL[lbl[i]], 0, 0.34));
  say('策略：先找 lower bound', '再證演算法正確、而且 reach 它');
  await step(tok);                                   // 2341.0 分兩部分證
  note('要證：① 每個 interval 都有 label　② overlap 的不同 label', 0, 6.9);
  say('要證它是合法解', '分兩部分');
  await step(tok);                                   // 2356.0 每個 interval 有 label、overlap 不同 label
  say('① 每個 interval 都拿到 label', '② overlap 的不在同一個 label');
  await step(tok);                                   // 2394.0 先證：第 6 行不會發生
  pkt('先證 ①：第 6 行不會發生', 0, 0.1);
  say('先證第一件事', '第 6 行（skip）不會發生');
  await step(tok);                                   // 2432.0 假設 Ij 跟前面 t 個 overlap
  Ij = gBar(ax, 'Ij（I8）', s, f, 6.0, GJ.sand, 2, 0.34);
  [5, 6].forEach((i) => glow(B[i], GOLD));
  say('假設 Ij 跟前面 t 個 interval overlap', '例：I8，t = 2');
  await step(tok);                                   // 2458.4 看 Ij 的 starting time 那一點
  sl = vline(ax, s, 6.3, 0.8);
  say('抓 Ij 的 starting time 這一點', 's(Ij) = 7');
  await step(tok);                                   // 2473.0 這 t + 1 個一定同時穿過這一點
  glow(Ij, GOLD);
  say('這 t + 1 個 interval', '一定同時穿過這一點');
  await step(tok);                                   // 2489.0 depth：最大 overlap
  note('depth d = 最大的 overlap', 3.6, 0.6);
  say('depth 是整條時間軸的最大 overlap', '');
  await step(tok);                                   // 2511.0 所以 t + 1 ≤ d
  say('所以 t + 1 ≤ d', '');
  await step(tok);                                   // 2551.8 前 t 個各自已經有顏色
  [5, 6].forEach((i) => glow(B[i], RED));
  say('第 3 行：前面 t 個各有 label', '那些 label 被排除');
  await step(tok);                                   // 2558.0 t ≤ d − 1
  say('t ≤ d − 1', '最多排除 d − 1 個 label');
  await step(tok);                                   // 2582.0 至少剩一個 → 第 4 行一定能指派
  glow(Ij, null); kill(sl); tint(Ij, LCOL[lbl[j]]); move(Ij, ax.X((s + f) / 2), Y[lbl[j]], 0);
  say('d 個 label 至少剩一個', '第 4 行一定指派得到');
  await step(tok);                                   // 2617.4 第 6 行可以不用寫
  [5, 6].forEach((i) => glow(B[i], null));
  good('① 成立：第 6 行可以不寫', 0, 0.1);
  say('每個 interval 都有 label', '程式不寫第 6 行也沒關係');
}]);

// 43:57 Optimality 證明（二）：overlap 的不同 label → 用 d 個 → optimal
FRAG.push(['grjiang1-partition-proof2', '證明：overlap 的不同 label → optimal', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const Y = [4.6, 3.4, 2.2], lbl = gPartition();
  let ax, B, Ij, x;
  await step(tok);                                   // 2637.2 兩個 overlapping 不會到同一個 label
  ax = gAx(0, 11, -5, 6, 0.8);
  Y.forEach((y, k) => tag('label ' + (k + 1), 'idx', -6.1, y));
  B = IP10.slice(0, 7).map(([s0, f0], i) => gBar(ax, 'I' + (i + 1), s0, f0, Y[lbl[i]], LCOL[lbl[i]], 0, 0.34));
  pkt('② overlap 的不會在同一個 label', 0, 6.9);
  say('第二件事：兩個 overlap 的 interval', '不會被指派到同一個 label');
  await step(tok);                                   // 2667.5 兩個 overlap 的 Ii、Ij
  Ij = gBar(ax, 'Ij', 7, 10, 6.0, GJ.sand, 2, 0.34);
  glow(B[6], GOLD); glow(Ij, GOLD);
  say('拿兩個 overlap 的：Ii、Ij', '');
  await step(tok);                                   // 2681.0 Ii 在前、Ij 在後
  relabel(B[6], 'Ii');
  say('一定一個在前、一個在後', 'Ii 在前，Ij 在後');
  await step(tok);                                   // 2713.0 處理 Ij 時，Ii 已經有 label
  glow(B[6], RED);
  say('處理 Ij 時，Ii 已經有 label 了', '（第一部分：每個都有 label）');
  await step(tok);                                   // 2734.0 第 3 行會排除 Ii 用的 label
  x = bad('✗ label 1（Ii 在用）', -2.0, 6.0);
  say('第 3 行會把 Ii 用的 label 排除', '');
  await step(tok);                                   // 2749.0 Ij 絕對不會跟 Ii 同色
  glow(Ij, null); tint(Ij, LCOL[lbl[7]]); move(Ij, ax.X(8.5), Y[lbl[7]], 0);
  say('所以 Ij 一定拿不同的 label', '');
  await step(tok);                                   // 2772.0 兩部分合起來 → 合法解
  glow(B[6], null); remove(x);
  good('① ＋ ② → 合法解', -2.0, 6.0);
  say('兩部分合起來', '輸出是合法解');
  await step(tok);                                   // 2791.0 只設 d 個 label，d 是 lower bound
  note('只用 d = 3 個 label = lower bound', 3.4, 0.1);
  say('總共只設 d 個 label', 'd 又是 lower bound');
  await step(tok);                                   // 2835.0 always 用最少 → optimal
  B.forEach((b) => glow(b, GOLD));
  say('永遠用最少可能的 label 數', '所以是 optimal');
}]);

// 47:57 Minimize lateness：t_i、d_i，ℓ_i = max(0, f_i − d_i)，L = max ℓ_i
const LX = (t) => -6 + t * 0.8;
function gJobs(order, y, drop = 0, t0 = 0) {
  const pk = gPack(order, t0);
  return order.map((i, k) => { const [s, f] = pk[k]; const m = cube('J' + (i + 1), JCOL[i], [(f - s) * 0.8 - 0.06, 0.5, 0.6], LX((s + f) / 2), y, 0, drop); m.userData.f = f; m.userData.i = i; return m; });
}
function gDead(i, y) { const x = LX(LJ[i][1]); return line(x, y - 0.25, x, y + 0.45, 0, '#d64545'); }
function lxAxis(y = 1.2) { line(LX(0), y, LX(15), y); for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), y - 0.35); }
FRAG.push(['grjiang1-lateness-def', 'Lateness：遲交多少、取最大值', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  let me, T, J, lt;
  await step(tok);                                   // 2877.0 第三題：minimize lateness
  tag('Scheduling to minimize lateness', 'ptr alt', 0, 6.9);
  me = pal('我', -6.2, GJ.orange, 1.8, 0.7);
  say('第三題：minimize lateness', '用 exchange argument 證');
  await step(tok);                                   // 2906.0 沒有 start / finish，要我們排
  bub('什麼時候做？我自己決定', -6.2, 2.2, 1.8);
  say('request 沒有 start、finish time', '要由我們決定什麼時候做');
  await step(tok);                                   // 2924.0 每個 request 有 deadline
  T = LJ.map(([t, d], i) => tag('J' + (i + 1) + '：d = ' + d, 'idx', -4.5 + (i % 3) * 4.5, 6.2 - Math.floor(i / 3) * 0.6));
  say('每個 request 有 deadline', '像各科作業各有不同的 deadline');
  await step(tok);                                   // 2943.0 每個要花的時間 t 不同
  LJ.forEach(([t, d], i) => txt(T[i], 'J' + (i + 1) + '：t = ' + t + '，d = ' + d));
  say('每個要花的時間也不一樣', 't_i');
  await step(tok);                                   // 2965.0 全部都要做完
  lxAxis();
  J = gJobs([0, 1, 2, 3, 4, 5], 2.2, 2);
  for (let i = 0; i < 6; i++) gDead(i, 3.3 + (i % 2) * 0.6);
  tag('紅線 = deadline', 'idx', 4.5, 4.7);
  say('每個都要做完', '一次做一件');
  await step(tok);                                   // 2987.0 目標：minimize 遲交程度
  say('目標：遲交的程度越小越好', '最好都不遲交');
  await step(tok);                                   // 3018.0 只取最大遲交量，不加總
  pkt('lateness 只看最大的那個，不加總', 0, 5.0);
  say('有好幾個遲交時', '只取最大的遲交量');
  await step(tok);                                   // 3037.0 第四個晚了一天
  glow(J[3], RED); me.mood('sad');
  lt = bad('ℓ4 = 10 − 9 = 1', LX(9.5), 4.0);
  say('J4 在 10 才做完，deadline 是 9', '晚了 1 → lateness = f − d = 1');
  await step(tok);                                   // 3058.0 第一個早早做完 → 0
  glow(J[0], GREEN);
  good('ℓ1 = 0', LX(1.5), 4.0);
  say('J1 在 3 做完，deadline 6', '沒遲交就算 0');
  await step(tok);                                   // 3075.0 ℓ = max(0, f − d)，L = max ℓ
  note('ℓ_i = max(0, f_i − d_i)　L = max ℓ_i', 0, 0.2);
  say('ℓ_i = max(0, f_i − d_i)', 'L = 所有 ℓ_i 取最大');
  await step(tok);                                   // 3091.0 六個都遲交一天 = 一個遲交一天
  bub('六個都晚一天 = 一個晚一天？', -6.2, 2.2, 1.8); me.mood('wow');
  say('所以六個都遲交一天，跟只遲交一個一天', '在這個題目一樣差（不太真實）');
}]);

// 52:28 三個 rule：shortest first、smallest slack 都有反例
FRAG.push(['grjiang1-lateness-rules', 'Shortest first、smallest slack 的反例', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const X = (t) => -5.5 + t * 0.95;
  const bar = (nm, s, f, y, c) => cube(nm, c, [(f - s) * 0.95 - 0.06, 0.5, 0.6], X((s + f) / 2), y, 0, 2);
  const axis = () => { line(X(0), 1.2, X(12), 1.2); for (let t = 0; t <= 12; t += 2) tag(String(t), 'idx', X(t), 0.85); };
  let R, a, b, a2, b2;
  await step(tok);                                   // 3148.0 shortest first、smallest slack first
  R = ['① shortest interval first', '② smallest slack first', '③ earliest deadline first'].map((t, k) => cube(t, GJ.paper, [3.8, 0.6, 0.7], -4.3 + k * 4.3, 5.4, 0, 2));
  relabel(R[2], '③ ?');
  say('想幾個 greedy rule', '① shortest first ② smallest slack first');
  await step(tok);                                   // 3157.7 earliest deadline first
  relabel(R[2], '③ earliest deadline first');
  say('③ earliest deadline first', '事有輕重緩急');
  await step(tok);                                   // 3170.0 ① 最容易做的先挑
  glow(R[0], GOLD);
  say('①：哪件最容易做，先挑它', '花時間最少的先做');
  await step(tok);                                   // 3183.0 ② slack = d − t 最小的
  glow(R[0], null); glow(R[1], GOLD);
  note('slack = d_i − t_i', -0.0, 4.4);
  say('②：slack = d − t 最小的先做', '餘裕越少好像越急');
  await step(tok);                                   // 3234.0 ③ 直接看誰最急
  glow(R[1], null); glow(R[2], GOLD);
  say('③：直接看 deadline', '誰最急先做誰');
  await step(tok);                                   // 3251.3 舉反例反駁自己
  glow(R[2], null);
  say('再來舉反例', '看哪個 rule 會壞掉');
  // ① shortest first 的反例
  await step(tok);                                   // 3275.0 兩個 request：t = 1、10
  fresh([0, 3.4, 13], [0, 2.8, 0]); axis();
  tag('反例 ①：shortest first', 'ptr alt', 0, 6.4);
  note('#1：t = 1　　#2：t = 10', -3.0, 5.6);
  say('兩個 request', '要花 1 天和 10 天');
  await step(tok);                                   // 3288.0 deadline：100 和 10
  note('d = 100　　d = 10', 3.4, 5.6);
  line(X(10), 4.2, X(10), 5.0, 0, '#d64545');
  say('#1 的 deadline 是 100', '#2 的 deadline 是 10');
  await step(tok);                                   // 3304.0 shortest first：先做 1
  a = bar('#1', 0, 1, 4.6, GJ.teal);
  say('shortest first：先做簡單的 #1', '時間 1 做完');
  await step(tok);                                   // 3318.0 #2 從 1 做到 11
  b = bar('#2', 1, 11, 4.6, GJ.orange);
  say('再做 #2：從 1 做到 11', '');
  await step(tok);                                   // 3326.0 第 10 天就要交 → 遲交
  glow(b, RED); bad('ℓ = 11 − 10 = 1', X(11), 5.3);
  say('#2 第 10 天就要交', '遲交了');
  await step(tok);                                   // 3350.0 應該先做 #2 再做 #1
  b2 = bar('#2', 0, 10, 3.2, GJ.orange); a2 = bar('#1', 10, 11, 3.2, GJ.teal);
  glow(b2, GREEN); good('都不遲交', X(6), 2.5);
  say('其實先做 #2 再做 #1', '兩個都準時');
  // ② smallest slack 的反例
  await step(tok);                                   // 3368.7 smallest slack
  fresh([0, 3.4, 13], [0, 2.8, 0]); axis();
  tag('反例 ②：smallest slack', 'ptr alt', 0, 6.4);
  say('再看 smallest slack', '');
  await step(tok);                                   // 3378.0 t = 1、d = 2；t = 10、d = 10
  note('#1：t = 1，d = 2　　#2：t = 10，d = 10', 0, 5.6);
  line(X(2), 4.2, X(2), 5.0, 0, '#d64545'); line(X(10), 2.8, X(10), 3.6, 0, '#d64545');
  say('#1：花 1 天，第 2 天要交', '#2：花 10 天，第 10 天要交');
  await step(tok);                                   // 3395.4 slack：1 和 0
  note('slack：1　　0', 0, 5.0);
  say('slack：#1 = 2 − 1 = 1', '#2 = 10 − 10 = 0');
  await step(tok);                                   // 3421.0 先做 slack 小的 #2
  b = bar('#2', 0, 10, 4.6, GJ.orange);
  say('slack 小的先做：#2', '做到 10，準時交');
  await step(tok);                                   // 3442.0 10 之後才做 #1，11 完成
  a = bar('#1', 10, 11, 4.6, GJ.teal);
  say('10 之後才做 #1', '11 才做完');
  await step(tok);                                   // 3453.0 lateness 11 − 2 = 9
  glow(a, RED); bad('ℓ = 11 − 2 = 9', X(11), 5.4);
  say('#1 第 2 天就要交', 'lateness = 9');
  await step(tok);                                   // 3460.0 倒過來：先做 #1
  a2 = bar('#1', 0, 1, 3.2, GJ.teal); b2 = bar('#2', 1, 11, 3.2, GJ.orange);
  say('倒過來：先做 #1', '#1 準時，#2 做到 11');
  await step(tok);                                   // 3482.0 lateness 只有 1
  glow(b2, GOLD); good('ℓ = 11 − 10 = 1', X(6), 2.5);
  say('最大 lateness 只有 1', '1 < 9');
  await step(tok);                                   // 3500.2 所以 slack rule 也不好
  bad('smallest slack ✗', -3.6, 6.4);
  say('所以 smallest slack 也不行', '');
}]);

// 58:28 EDF：依 deadline 排序，緊接著做（沒有 idle time）
FRAG.push(['grjiang1-edf-run', 'Earliest deadline first：依 d 排、緊接著做', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  let Q, Lt, L = 0;
  const drop = (i) => { const [s, f] = gPack([0, 1, 2, 3, 4, 5])[i]; const m = cube('J' + (i + 1), JCOL[i], [(f - s) * 0.8 - 0.06, 0.5, 0.6], LX((s + f) / 2), 2.2, 0, 2); gDead(i, 3.3 + (i % 2) * 0.6); const l = Math.max(0, f - LJ[i][1]); L = Math.max(L, l); if (l > 0) glow(m, RED); glow(Q[i], null); tint(Q[i], GJ.gray); txt(Lt, 'L = ' + L); return m; };
  await step(tok);                                   // 3508.0 earliest deadline first：越急越先做
  tag('earliest deadline first', 'ptr alt', 0, 6.9);
  const me = pal('我', -6.2, GJ.orange, 1.8, 0.7);
  say('剩下第三個：earliest deadline first', '越急的越先做');
  await step(tok);                                   // 3546.1 （學生問）加起來是另一題
  bub('遲交加總？那是另一個題目', -6.2, 2.2, 1.8);
  say('有同學問：遲交加總呢？', '那就變另一個題目');
  await step(tok);                                   // 3573.0 先依 deadline 從小排到大
  lxAxis();
  Q = LJ.map(([t, d], i) => cube('d=' + d, GJ.paper, [1.1, 0.5, 0.5], -4.5 + i * 1.8, 6.0, 0, 1.5));
  Lt = tag('L = 0', 'ptr alt', 4.5, 4.9);
  say('先依 deadline 從小排到大', 'd = 6, 8, 9, 9, 14, 15');
  await step(tok);                                   // 3580.0 照順序丟下來
  for (let i = 0; i < 3; i++) { glow(Q[i], GOLD); drop(i); await beat(tok, 450); }
  say('照 deadline 的順序排下去', '');
  await step(tok);                                   // 3600.0 一個做完馬上做下一個
  for (let i = 3; i < 6; i++) { glow(Q[i], GOLD); drop(i); await beat(tok, 450); }
  me.mood('happy');
  say('第一個做完馬上做第二個', '只有 J4 遲交 1：L = 1');
  await step(tok);                                   // 3606.0 中間沒有空檔，壓得很緊
  note('中間沒有空檔', LX(7.5), 0.3);
  say('壓得很緊', '中間沒有 idle time');
}]);

// 60:25 觀察：一定有 optimal schedule 沒有 idle time（d = 4, 6, 12 往左壓）
FRAG.push(['grjiang1-no-idle', '有 idle 的 optimal 可以壓成沒 idle', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  const X = (t) => -6 + t;
  const D = [[2, 4], [3, 6], [4, 12]], S0 = [0, 3, 7];
  let B, g1, g2;
  await step(tok);                                   // 3625.0 先探討幾個好的 property
  tag('證明前：先看幾個 property', 'ptr alt', 0, 6.4);
  say('要證它最好', '先探討幾個好的 property');
  await step(tok);                                   // 3654.0 greedy 的 schedule 沒有 idle time
  note('觀察 1：greedy 的 schedule 沒有 idle time', 0, 5.8);
  say('greedy 一個做完緊接著做下一個', '中間沒有 idle time');
  await step(tok);                                   // 3691.0 一定存在一個沒有 idle 的 optimal
  pkt('Property：存在沒有 idle time 的 optimal', 0, 5.2);
  say('一定存在一個 optimal schedule', '中間沒有空檔');
  await step(tok);                                   // 3711.3 例子：deadline 4、6、12
  line(X(0), 1.2, X(12), 1.2); for (let t = 0; t <= 12; t += 2) tag(String(t), 'idx', X(t), 0.85);
  D.forEach(([t, d]) => { line(X(d), 3.0, X(d), 3.8, 0, '#d64545'); tag('d=' + d, 'idx', X(d), 4.1); });
  B = D.map(([t], i) => cube('J' + (i + 1), [GJ.blue, GJ.orange, GJ.teal][i], [t - 0.06, 0.5, 0.6], X(S0[i] + t / 2), 2.4, 0, 2));
  say('假設這是一個最佳解', 'deadline 4、6、12');
  await step(tok);                                   // 3718.0 都沒遲交，中間還休息
  g1 = cube('idle', GJ.paper, [0.9, 0.3, 0.3], X(2.5), 1.9, 0); g2 = cube('idle', GJ.paper, [0.9, 0.3, 0.3], X(6.5), 1.9, 0);
  say('都沒遲交，中間還能休息', 'lateness = 0');
  await step(tok);                                   // 3731.1 壓一下：往左靠，不休息
  fly(g1, V3(0, 5, 3)); fly(g2, V3(0, 5, 3));
  let t = 0;
  for (let i = 0; i < 3; i++) { move(B[i], X(t + D[i][0] / 2), 2.4, 0); t += D[i][0]; await beat(tok, 450); }
  say('把它往左壓緊', '中間都不休息');
  await step(tok);                                   // 3747.0 一樣沒遲交 → 也是 optimal
  B.forEach((b) => glow(b, GREEN));
  good('L 還是 0 → 也是 optimal', X(9), 3.0);
  say('每個都更早完成，一樣沒遲交', '也是 optimal');
  await step(tok);                                   // 3768.0 壓縮不會改變 optimality
  say('有空檔的 optimal 壓緊後還是 optimal', '看圖就知道');
}]);

// 63:07 Exchange argument 與 inversion：d_j < d_i 卻 j 排在 i 後面
FRAG.push(['grjiang1-inversion-def', 'Inversion：deadline 早的反而晚做', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  let J, god;
  await step(tok);                                   // 3787.0 接著看：沒有 inversion
  tag('觀察 2：沒有 inversion', 'ptr alt', 0, 6.4);
  say('接下來看 inversion', '先講 exchange argument');
  await step(tok);                                   // 3801.0 exchange argument
  say('exchange argument', '用交換來證明');
  await step(tok);                                   // 3808.0 用交換把一個解慢慢換成我要的
  note('把別人的解，一步步換成我的樣子', 0, 5.8);
  say('用交換的方式', '把一個 solution 慢慢換成我想要的');
  await step(tok);                                   // 3824.0 假設有人找到 optimal（不是 greedy）
  lxAxis();
  god = pal('神人', -6.3, GJ.purple, 1.8, 0.6); god.mood('happy');
  J = gJobs([1, 0, 2, 3, 4, 5], 2.4, 2);
  tag('O：神人的 optimal schedule', 'idx', 0, 4.9);
  say('假設有人找到 optimal O', '不是用 greedy rule 找的');
  await step(tok);                                   // 3861.0 不符合 greedy 的部分挖掉換成我的
  glow(J[0], GOLD); glow(J[1], GOLD);
  say('不符合 greedy rule 的部分挖掉', '換成我的，證明沒變差');
  await step(tok);                                   // 3916.0 介紹 inversion
  glow(J[0], null); glow(J[1], null);
  say('介紹 inversion', '排序時是依 deadline 先後排的');
  await step(tok);                                   // 3936.0 deadline 早的反而比較晚做
  glow(J[0], RED); glow(J[1], RED);
  tag('d=8', 'ptr', LX(1), 3.4); tag('d=6', 'ptr', LX(3.5), 3.4);
  arrow(V3(LX(3.5), 3.9, 0), V3(LX(1), 3.9, 0), 0xd64545);
  say('deadline 比較早，卻比較晚做', '這就是一個 inversion');
  await step(tok);                                   // 3943.0 i、j：d_j 較早，j 卻排在後面
  note('inversion：d_j < d_i，j 卻排在 i 後面', 0, 0.2);
  say('i、j 兩個：d_j 比較早', 'j 卻排在 i 後面');
}]);

// 65:56 沒 inversion、沒 idle 的 schedule 都有一樣的 max lateness（只差同 deadline 的順序）
FRAG.push(['grjiang1-same-deadline', '同 deadline 的順序不影響 L', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  let A, B, p1, p2;
  await step(tok);                                   // 3956.0 第一個 property
  tag('Property：沒 inversion、沒 idle → L 都一樣', 'ptr alt', 0, 6.6);
  say('第一個要證的 property', '');
  await step(tok);                                   // 3968.0 所有 schedule 只要沒有 inversion
  note('✔ 沒有 inversion', -3.0, 6.0);
  say('所有 schedule，只要沒有 inversion', '');
  await step(tok);                                   // 3972.0 而且沒有 idle time
  note('✔ 沒有 idle time', 3.0, 6.0);
  say('而且沒有 idle time', '都壓緊');
  await step(tok);                                   // 3983.0 一定有相同的 max lateness
  say('它們的 max lateness 都一樣', '一樣好或一樣差');
  await step(tok);                                   // 4010.0 兩個同學各找到一個 schedule
  line(LX(0), 0.8, LX(15), 0.8); for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.45);
  p1 = pal('甲', -6.4, GJ.blue, 0.2, 0.5, 4.0); p2 = pal('乙', -6.4, GJ.pink, 0.2, 0.5, 2.0);
  A = gJobs([0, 1, 2, 3, 4, 5], 4.4, 2); B = gJobs([0, 1, 3, 2, 4, 5], 2.4, 2);
  say('兩個同學各找到一個 schedule', '都沒 inversion、沒 idle');
  await step(tok);                                   // 4043.0 都照 deadline 排，為何不同？
  say('都照 deadline 排好了', '為什麼還會不一樣？');
  await step(tok);                                   // 4050.0 只可能是同樣 deadline 的先後
  [A[2], A[3], B[2], B[3]].forEach((m) => glow(m, GOLD));
  say('只可能是 deadline 相同的那幾個', 'J3、J4 都是 d = 9，先後不同');
  await step(tok);                                   // 4107.0 這一坨的 lateness 算最後一個
  vline({ X: LX }, 5, 5.0, 1.8); vline({ X: LX }, 10, 5.0, 1.8);
  line(LX(9), 5.0, LX(9), 1.8, 0, '#d64545'); tag('d = 9', 'ptr', LX(9) - 0.5, 5.4);
  say('同 deadline 的這一坨', 'lateness 看最後做完的那個');
  await step(tok);                                   // 4155.0 一定是最晚做的那個
  glow(A[3], RED); glow(B[2], RED);
  say('最晚做的那個 lateness 最大', '甲是 J4、乙是 J3');
  await step(tok);                                   // 4191.4 ABC 或 CBA，整坨結束時間一樣
  note('整坨都在 5 到 10：10 − 9 = 1', LX(7.5), 0.1);
  say('不管 ABC 還是 CBA', '整坨結束時間都一樣');
  await step(tok);                                   // 4208.0 lateness 的值沒改變
  p1.mood('happy'); p2.mood('happy');
  say('所以兩個 schedule 的 L 一樣', '一樣好');
}]);

// 70:16 Swap 相鄰 inversion：ℓ'_i = f_j − d_i ≤ f_j − d_j = ℓ_j，max lateness 不變差
FRAG.push(['grjiang1-swap', '交換相鄰 inversion，L 不會變大', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  const X = (t) => -5 + t * 1.1;
  const blk = (nm, s, f, y, c) => cube(nm, c, [(f - s) * 1.1 - 0.06, 0.55, 0.6], X((s + f) / 2), y, 0, 2);
  let I, J, I2, J2, o1, o2;
  await step(tok);                                   // 4216.0 存在沒 inversion、沒 idle 的 optimal
  tag('Property：存在沒 inversion、沒 idle 的 optimal', 'ptr alt', 0, 6.6);
  say('第二個 property', '一定存在沒 inversion、沒 idle 的 optimal');
  await step(tok);                                   // 4242.0 有 idle 就 pack 一下
  note('idle：前面已經會壓緊了', -3.0, 6.0);
  say('idle time 的部分沒問題', '壓緊就好');
  await step(tok);                                   // 4265.3 不是所有 optimal 都沒 inversion
  note('不是「全部」，而是「找得到一個」', 3.0, 6.0);
  say('不是所有 optimal 都沒 inversion', '而是一定找得到一個');
  await step(tok);                                   // 4286.0 假設 optimal O 有 inversion
  line(X(0), 3.0, X(9), 3.0); for (let t = 0; t <= 9; t++) tag(String(t), 'idx', X(t), 2.7);
  tag('O', 'idx', -6, 3.6);
  o1 = blk('其他', 0, 2, 3.6, GJ.gray);
  I = blk('i (d=8)', 2, 5, 3.6, GJ.orange); J = blk('j (d=5)', 5, 7, 3.6, GJ.blue);
  say('假設 optimal O（已壓緊）', '裡面有 inversion');
  await step(tok);                                   // 4313.0 抓最相鄰的兩個
  glow(I, GOLD); glow(J, GOLD);
  say('inversion 可能好幾個', '抓最相鄰的兩個 i、j');
  await step(tok);                                   // 4318.0 j 的 deadline 比較早卻比較晚做
  line(X(5), 4.1, X(5), 4.9, 0, '#d64545'); tag('d_j', 'idx', X(5), 5.2);
  line(X(8), 4.1, X(8), 4.9, 0, '#d64545'); tag('d_i', 'idx', X(8), 5.2);
  glow(I, null); glow(J, RED);
  say('j 的 deadline 比較早', '卻比較晚做');
  await step(tok);                                   // 4333.0 swap 之後少一個 inversion
  line(X(0), 0.6, X(9), 0.6); tag('swap 後', 'idx', -6, 1.2);
  blk('其他', 0, 2, 1.2, GJ.gray);
  J2 = blk('j', 2, 4, 1.2, GJ.blue); I2 = blk('i', 4, 7, 1.2, GJ.orange);
  say('把 i、j swap', 'inversion 少一個');
  await step(tok);                                   // 4361.6 要證 max lateness 不會變大
  pkt('要證：swap 後 L 不會變大', 3.4, 0.0);
  say('要證：swap 後 max lateness', '不會比原來大');
  await step(tok);                                   // 4408.0 原本：ℓ_i = f_i − d_i、ℓ_j = f_j − d_j
  bad('ℓ_j = f_j − d_j = 7 − 5 = 2', X(6), 4.6);
  say('原本 j 在 f_j = 7 才完成', 'ℓ_j = 7 − 5 = 2');
  await step(tok);                                   // 4426.0 swap 後 i 的新 finish = 原本的 f_j
  glow(I2, GOLD); line(X(7), 3.3, X(7), 0.9, 0, '#c08a1f');
  note("f'_i = f_j = 7", X(7.8), 2.0);
  say('swap 後 i 的新 finish time', '就是原本的 f_j');
  await step(tok);                                   // 4474.0 j 提前完成，lateness 變小
  glow(J, null); glow(J2, GREEN);
  good('j 提早到 4 完成：ℓ = 0', X(3), 0.0);
  say('j 提前完成', '它的 lateness 變小');
  await step(tok);                                   // 4488.0 i 變晚，但不超過原本 ℓ_j
  note("ℓ'_i = f_j − d_i ≤ f_j − d_j = ℓ_j", 0, 6.0);
  say('i 變晚了，會不會更糟？', "ℓ'_i = f_j − d_i ≤ f_j − d_j = ℓ_j");
  await step(tok);                                   // 4518.0 只動這兩個，其他人不變
  say('只有這兩個被動到', '其他人的 lateness 都不變');
  await step(tok);                                   // 4545.0 swap 不會讓 optimal 變差
  glow(I2, null);
  good('swap 不會變差：仍是 optimal', -2.6, 0.0);
  say('swap 後 max lateness 不會變大', '原本 optimal，換完也還是');
}]);

// 76:42 一直 swap 直到沒有 inversion → 變成 greedy 的 schedule，仍 optimal
FRAG.push(['grjiang1-fix-all', '一直 swap 到沒有 inversion = EDF', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  let ord = [1, 0, 2, 3, 5, 4];
  const M = {};
  let Lt, god;
  const place = () => { gPack(ord).forEach(([s, f], k) => move(M[ord[k]], LX((s + f) / 2), 3.0, 0)); };
  const Lnow = () => Math.max(...gPack(ord).map(([s, f], k) => Math.max(0, f - LJ[ord[k]][1])));
  const swapAt = (p) => { [ord[p], ord[p + 1]] = [ord[p + 1], ord[p]]; place(); txt(Lt, 'swap 後 L = ' + Lnow()); };
  await step(tok);                                   // 4602.3 綜合起來證 greedy 是 optimal
  tag('綜合起來：EDF 是 optimal', 'ptr alt', 0, 6.6);
  say('把前面綜合起來', '證 greedy schedule 是 optimal');
  await step(tok);                                   // 4616.0 有人找到一個 optimal schedule
  lxAxis();
  god = pal('神人', -6.3, GJ.purple, 1.8, 0.6);
  gJobs(ord, 3.0, 2).forEach((m) => { M[m.userData.i] = m; });
  Lt = tag('O 的 L = ' + Lnow(), 'ptr alt', 0, 5.6);
  say('假設有人找到一個 optimal schedule', '');
  await step(tok);                                   // 4630.0 有 idle 就先壓緊
  say('有 idle time？先壓緊再說', '這張已經壓緊');
  await step(tok);                                   // 4637.0 沒 inversion → 跟我的一樣
  note('沒 inversion → 跟 greedy 只差同 deadline 的順序', 0, 0.2);
  say('如果沒有 inversion', '就跟 greedy 的一樣好');
  await step(tok);                                   // 4662.1 有 inversion 怎麼辦？
  glow(M[1], RED); glow(M[0], RED);
  say('如果有 inversion 呢？', 'J2 (d=8) 排在 J1 (d=6) 前');
  await step(tok);                                   // 4674.2 swap：不增加 lateness，inversion 減少
  swapAt(0); glow(M[1], null); glow(M[0], null);
  say('swap 它', 'L 沒變大，inversion 少一個');
  await step(tok);                                   // 4691.0 兩兩交換直到沒有 inversion
  glow(M[5], RED); glow(M[4], RED); await beat(tok, 800);
  swapAt(4); await beat(tok, 600); glow(M[5], null); glow(M[4], null);
  say('一直兩兩交換', '直到一個 inversion 都沒有');
  await step(tok);                                   // 4706.0 修完就是 greedy 的 solution
  Object.values(M).forEach((m) => glow(m, GOLD));
  say('修完的就是 greedy 吐出來的解', '依 deadline 排、沒有空檔');
  await step(tok);                                   // 4722.0 沒比 optimal 差 → 也是 optimal
  god.mood('wow');
  good('greedy 的 L = optimal 的 L → EDF optimal', 0, 0.2);
  say('greedy 的解沒有比 optimal 差', '所以也是 optimal');
  await step(tok);                                   // 4742.0 這就是 exchange argument 的做法
  say('這就是一般 exchange argument', '的做法');
}]);

// 79:28 總結：exchange argument 的 basic idea、greedy 的兩招
FRAG.push(['grjiang1-summary', '總結：greedy 與兩種證明', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  let blocks, mine, me, r;
  await step(tok);                                   // 4771.0 cut and paste
  tag('exchange argument', 'ptr alt', 3.4, 6.4);
  blocks = ['o1', 'o2', 'o3', 'o4'].map((t, k) => cube(t, GJ.purple, [0.9, 0.7, 0.7], 1.4 + k * 1.1, 4.4, 0, 2));
  await beat(tok, 700); glow(blocks[2], RED); await beat(tok, 500); fly(blocks[2], V3(0, 6, 3));
  mine = cube('g', GJ.teal, [0.9, 0.7, 0.7], 3.6, 4.4, 0, 3);
  say('不符合的挖掉，換成我的貼上', 'cut and paste');
  await step(tok);                                   // 4778.0 貼上之後沒有變糟
  glow(mine, GOLD); good('沒有變糟', 3.4, 3.2);
  say('再推論：換完沒有變糟', '');
  await step(tok);                                   // 4792.0 約 90% 用這個 strategy
  pkt('證 greedy 約 90% 用這招', 3.4, 7.2);
  say('證 greedy 大概 90% 用這招', '普遍性最高');
  await step(tok);                                   // 4817.0 greedy：step by step 選目前最好
  me = pal('greedy', -4.6, GJ.orange, 1.8, 0.8);
  say('總結：greedy step by step', '每步選目前看起來最好的');
  await step(tok);                                   // 4836.0 要先設計 criterion
  bub('先設計 criterion', -4.6, 2.5, 1.8);
  say('要先設計一個 criterion', '判斷什麼叫最好');
  await step(tok);                                   // 4849.0 大部分問題沒那麼幸運
  me.mood('sad');
  say('大部分問題沒那麼幸運', 'greedy 很難拿到最佳解');
  await step(tok);                                   // 4864.0 可以的話：快到不行
  me.mood('happy'); await me.hop(tok);
  say('如果能用，就趕快用', 'running time 快到不行');
  await step(tok);                                   // 4895.0 第一招 stays ahead
  tag('① stays ahead', 'ptr alt', -3.6, 6.4);
  r = racers(4.6, -6.2);
  await race(tok, r, -6.2, -1.6, 1800);
  say('第一招：stays ahead', '每一步都第一名，一路領先');
  await step(tok);                                   // 4914.0 第二招：比較常見、彈性大
  say('第二招：exchange argument', '比較常見、彈性比較大');
  await step(tok);                                   // 4935.9 把別人的 optimal 換成我的樣子
  blocks.forEach((b) => { if (b.parent) tint(b, GJ.teal); });
  say('把別人的 optimal 慢慢換成', '我的 greedy 長相');
  await step(tok);                                   // 4951.0 不損失 solution quality
  blocks.forEach((b) => { if (b.parent) glow(b, GOLD); });
  say('過程中 quality 沒損失', '所以 greedy 也是 optimal');
}]);

// 83:04 Interval graph：一個 interval 一個 node，overlap 就連 edge；partitioning = coloring
FRAG.push(['grjiang1-interval-graph', 'Interval graph：partitioning = coloring', async (tok) => {
  fresh([0, 3.4, 13], [0, 3, 0]);
  const ax = { sc: 0.45, X: (t) => -6.6 + t * 0.45 };
  const P = IP10.map((r, i) => { const a = Math.PI / 2 - i * 2 * Math.PI / 10; return [3.4 + 2.6 * Math.cos(a), 3.4 + 2.6 * Math.sin(a)]; });
  let B, N;
  const E = [];
  for (let i = 0; i < 10; i++) for (let k = i + 1; k < 10; k++) if (gOv(IP10[i], IP10[k])) E.push([i, k]);
  const edge = ([i, k]) => line(P[i][0], P[i][1], P[k][0], P[k][1], -0.1, '#a99470');
  const lbl = gPartition();
  await step(tok);                                   // 4984.0 補充：為什麼叫 interval graph
  line(ax.X(0), 0.6, ax.X(11), 0.6);
  B = IP10.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.55, GJ.sand, 2, 0.32));
  say('補充：為什麼叫 interval graph？', '');
  await step(tok);                                   // 5001.0 投影片上沒看到 graph
  say('投影片上只看到時間軸和 interval', '沒看到 graph');
  await step(tok);                                   // 5009.9 每個 interval 用一個 node
  N = P.map(([x, y], i) => cube(String(i + 1), GJ.sand, [0.55, 0.55, 0.55], x, y, 0, 2));
  say('每個 interval 用一個 node 代表', '');
  await step(tok);                                   // 5035.0 overlap 就建一條 edge
  say('兩個 interval overlap', '就建一條 edge');
  await step(tok);                                   // 5042.0 1 連 2、3；2 連 1、3、4、5
  E.filter(([i]) => i < 2).forEach((e) => { edge(e); glow(N[e[1]], GOLD); });
  glow(N[0], GOLD); glow(N[1], GOLD);
  say('1 跟 2、3 overlap', '2 跟 1、3、4、5 overlap');
  await step(tok);                                   // 5060.0 會打架的都建 edge
  N.forEach((n) => glow(n, null));
  E.filter(([i]) => i >= 2).forEach(edge);
  say('所有會打架的都連起來', '');
  await step(tok);                                   // 5067.6 這就叫 interval graph
  tag('interval graph', 'ptr alt', 3.4, 6.6);
  say('這就叫 interval graph', '');
  await step(tok);                                   // 5084.6 也叫 intersection graph
  tag('= intersection graph', 'idx', 3.4, 6.15);
  say('也有人叫它 intersection graph', '表達有沒有重疊');
  await step(tok);                                   // 5100.6 coloring：相鄰的點要不同顏色
  say('graph coloring：有 edge 相連的兩點', '要塗不同顏色');
  await step(tok);                                   // 5141.0 interval partitioning = 在這張圖上 coloring
  say('interval partitioning', '就是在這張圖上做 coloring');
  await step(tok);                                   // 5161.0 1 號藍、2 號橘、3 號紅
  for (let i = 0; i < 3; i++) { tint(N[i], LCOL[lbl[i]]); tint(B[i], LCOL[lbl[i]]); await beat(tok, 400); }
  say('1 號塗藍、2 號塗橘、3 號塗紅', '');
  await step(tok);                                   // 5178.0 其他的也塗不同顏色
  for (let i = 3; i < 10; i++) { tint(N[i], LCOL[lbl[i]]); tint(B[i], LCOL[lbl[i]]); await beat(tok, 250); }
  say('相鄰的都塗不同顏色', '');
  await step(tok);                                   // 5192.0 interval graph 上 greedy 就解得掉
  good('interval graph：greedy 就解得掉', 3.4, 0.1);
  say('interval graph 有很好的特性', 'coloring 用 greedy 就能解');
  await step(tok);                                   // 5205.0 一般 graph 的 coloring 很難
  bad('一般 graph 的 coloring：困難', -3.4, 0.1);
  say('但一般 graph 的 coloring', '是困難的問題');
}]);
  }

  // ═══ grjiang2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED } = K;
// ─── 交大江蕙如 Lec12（yWZHGsd06dA）：證明策略、Dijkstra（小例子、loop invariant 證明、CLRS 例子）
// ─── 交大江蕙如 Lec13（trkaH2uLxHw）：Dijkstra 實作、priority queue、heap（insert／pop／heapify／build／heapsort）、MST 定義
const J2 = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', exp: '#2fc092', dim: '#e4dccb', bad: '#d64545', blue: '#4b9ee2', gray: '#cfc6b4', ok: '#2fc092' };
const j2Cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
const j2F = (d) => (d === Infinity ? '∞' : String(d));
// a graph in the x-y plane: P = {k: [x, y]}, E = [[u, v, w, off]]; directed arrows unless o.undirected
function j2Graph(P, E, o = {}) {
  const N = {}, D = {}, ES = [];
  for (const k of Object.keys(P)) {
    const [x, y] = P[k];
    N[k] = cube(k, o.nodeColor || J2.node, [0.8, 0.8, 0.8], x, y, 0, o.drop || 0);
    D[k] = tag('', 'ptr', x, y + (o.tagDy || 0.85), 0);
  }
  for (const [u, v, w, off = 0] of E) {
    const [x1, y1] = P[u], [x2, y2] = P[v];
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux;
    const a = V3(x1 + ux * 0.55 + px * off, y1 + uy * 0.55 + py * off, 0), b = V3(x2 - ux * 0.55 + px * off, y2 - uy * 0.55 + py * off, 0);
    const obj = o.undirected ? line(a.x, a.y, b.x, b.y, 0, J2.edge) : arrow(a, b, J2.edge);
    const lo = off ? off * 2.4 : 0.3;
    const lb = tag(String(w), 'idx', (x1 + x2) / 2 + px * lo, (y1 + y2) / 2 + py * lo, 0.1);
    ES.push({ u, v, w, obj, lb, set(c) { if (o.undirected) obj.material.color.set(c); else obj.setColor(c); } });
  }
  const e = (u, v) => ES.find((x) => (x.u === u && x.v === v) || (o.undirected && x.u === v && x.v === u));
  return { N, D, E: ES, e, P };
}
function j2Explore(G, k) { tint(G.N[k], J2.exp); const [x, y] = G.P[k]; move(G.N[k], x, y, 0.5); j2Cls(G.D[k], 'ptr alt'); }

// 小例子（Lec12 21:29）：s→u 1、s→v 2、s→x 4、u→x 1、u→y 3、v→z 3、x→y 1、x→z 2
const J2S_P = { s: [-5.2, 3], u: [-2, 5.4], v: [-2, 0.6], x: [1.2, 3], y: [4.6, 5.4], z: [4.6, 0.6] };
const J2S_E = [['s', 'u', 1], ['s', 'v', 2], ['s', 'x', 4], ['u', 'x', 1], ['u', 'y', 3], ['v', 'z', 3], ['x', 'y', 1], ['x', 'z', 2]];
// CLRS 圖 24.6（Lec12 50:40、Lec13 05:32）
const J2C_P = { s: [-5.2, 2.8], t: [-1.4, 5.4], x: [3.6, 5.4], y: [-1.4, 0.4], z: [3.6, 0.4] };
const J2C_E = [['s', 't', 10], ['s', 'y', 5], ['t', 'x', 1], ['t', 'y', 2, -0.22], ['y', 't', 3, -0.22], ['y', 'x', 9], ['y', 'z', 2], ['x', 'z', 4, -0.22], ['z', 'x', 6, -0.22], ['z', 's', 7]];

// ── complete-binary-tree heap view: tree on top, array row at the bottom
const HX = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return -5.6 + (i - c + 0.5) * 11.2 / c; };
const HY = (i) => 6.0 - Math.floor(Math.log2(i)) * 1.35;
const AX = (i) => -5.9 + i * 1.12;
function j2Heap(vals, o = {}) {
  const H = { A: [null, ...vals], T: [null], R: [null], n: o.n === undefined ? vals.length : o.n, lines: [], idx: [] };
  const cap = o.cap || vals.length;
  if (o.zero) { cube('', J2.gray, [0.9, 0.55, 0.55], AX(0), 0.4, 0); H.idx.push(tag('0', 'idx', AX(0), -0.3)); }
  for (let i = 1; i <= cap; i++) {
    if (o.cells !== false) H.idx.push(tag(String(i), 'idx', AX(i), -0.3));
    if (i > vals.length) { cube('', '#ece4d2', [0.9, 0.55, 0.55], AX(i), 0.4, -0.2); continue; }
    const c = i <= H.n ? J2.blue : J2.gray;
    H.R[i] = cube(vals[i - 1], c, [0.9, 0.55, 0.55], AX(i), 0.4, 0, o.drop || 0);
    H.T[i] = i <= H.n || o.keepTree ? cube(vals[i - 1], c, [0.8, 0.7, 0.6], HX(i), HY(i), 0, o.drop || 0) : null;
  }
  H.edges = () => { H.lines.forEach(kill); H.lines = []; for (let i = 2; i <= H.n; i++) H.lines.push(line(HX(i >> 1), HY(i >> 1) - 0.35, HX(i), HY(i) + 0.35, -0.1)); };
  H.edges();
  H.place = (i) => { if (H.T[i]) move(H.T[i], HX(i), HY(i), 0); if (H.R[i]) move(H.R[i], AX(i), 0.4, 0); };
  H.swap = (i, j) => { [H.A[i], H.A[j]] = [H.A[j], H.A[i]]; [H.T[i], H.T[j]] = [H.T[j], H.T[i]]; [H.R[i], H.R[j]] = [H.R[j], H.R[i]]; H.place(i); H.place(j); };
  H.hi = (i, c) => { if (H.T[i]) glow(H.T[i], c); if (H.R[i]) glow(H.R[i], c); };
  H.tint = (i, c) => { if (H.T[i]) tint(H.T[i], c); if (H.R[i]) tint(H.R[i], c); };
  H.unhi = () => { for (let i = 1; i < H.A.length; i++) H.hi(i, null); };
  // sift down from i inside heap size n; each swap plays with a caption
  H.sift = async (tok, i, ms, quiet) => {
    for (;;) {
      const l = 2 * i, r = l + 1; let m = i;
      if (l <= H.n && H.A[l] > H.A[m]) m = l;
      if (r <= H.n && H.A[r] > H.A[m]) m = r;
      H.unhi(); H.hi(i, GOLD); if (l <= H.n) H.hi(l, RED); if (r <= H.n) H.hi(r, RED);
      const kids = [l, r].filter((k) => k <= H.n).map((k) => H.A[k]);
      if (m === i) { if (!quiet) say(kids.length ? H.A[i] + ' ≥ 小孩 ' + kids.join('、') : H.A[i] + ' 已是 leaf', '停下來'); await beat(tok, ms); H.unhi(); return; }
      if (!quiet) say(H.A[i] + ' 比小孩小：和較大的 ' + H.A[m] + ' 交換', 'index ' + i + ' ↔ ' + m);
      await beat(tok, ms * 0.5);
      H.swap(i, m); H.hi(m, GOLD);
      await beat(tok, ms * 0.5);
      i = m;
    }
  };
  return H;
}

// ═════════════ Lec12 ═════════════

// 00:17 回顧：證明 greedy 最佳的兩招
FRAG.push(['grjiang2-proof-strategies', '證明 greedy 最佳的兩招：stays ahead 與 exchange argument', async (tok) => {
  fresh([0, 3.6, 14], [0, 3.2, 0]);
  say('Greedy：每步依 criterion 選當下最好', '要證明它能到 optimal');
  await beat(tok, 2600);
  say('第一招：greedy stays ahead', '每一步都不落後於其他解');
  tag('greedy', 'ptr alt', -6.1, 6.2); tag('其他解', 'ptr', -6.1, 4.9);
  const g = [1, 2, 3, 4, 5], q = [1, 1, 2, 3, 4];
  for (let k = 0; k < 5; k++) {
    const x = -4.4 + k * 1.1;
    cube('', J2.exp, [0.8, g[k] * 0.32, 0.6], x, 5.6 + g[k] * 0.16, 0, 1);
    cube('', J2.blue, [0.8, q[k] * 0.32, 0.6], x, 4.3 + q[k] * 0.16 - 0.9, 0.6, 1);
    await beat(tok, 500);
  }
  say('一路領先，最後也不輸', '第 k 步 greedy ≥ 其他解（示意）');
  await beat(tok, 2600);
  say('第二招：exchange argument', '先假設有人給了一個 optimal solution');
  const opt = [];
  const ok = [true, false, true, false, true];
  for (let k = 0; k < 5; k++) opt.push(cube('O' + (k + 1), ok[k] ? J2.blue : J2.bad, [1.2, 0.7, 0.7], 0.6 + k * 1.35, 1.6, 0, 2));
  tag('optimal（別的方法找到）', 'ptr', 3.3, 2.6);
  await beat(tok, 2800);
  say('紅色：不符合 greedy rule 的部分', '挑出來、砍掉');
  for (const k of [1, 3]) glow(opt[k], GOLD);
  await beat(tok, 2200);
  for (const k of [1, 3]) {
    fly(opt[k]);
    await beat(tok, 700);
    opt[k] = cube('G' + (k + 1), J2.exp, [1.2, 0.7, 0.7], 0.6 + k * 1.35, 1.6, 0, 2.5);
    say('換成 greedy 選的，貼回去', '1. 仍然 feasible　2. 品質不變差');
    await beat(tok, 2200);
  }
  say('一路換完 = greedy 的解', '品質沒損失 → greedy 也是 optimal');
  for (const m of opt) glow(m, GREEN);
  await beat(tok, 3200);
}]);

// 11:00 single-source shortest path 問題
FRAG.push(['grjiang2-sssp-def', 'Single-source shortest path：輸入、目標、路徑長度', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('輸入：directed graph G', 'edge 有方向；undirected 就看成兩個方向');
  const G = j2Graph(J2S_P, J2S_E, { drop: 2 });
  await beat(tok, 2800);
  say('edge 上的 weight ℓ(e)：距離', '也可以是時間、機票錢等 cost');
  for (const e of G.E) j2Cls(e.lb, 'ptr');
  await beat(tok, 2800);
  for (const e of G.E) j2Cls(e.lb, 'idx');
  glow(G.N.s, GOLD); txt(G.D.s, 'source s');
  say('再給起點 source s', 'single-source shortest path（SSSP）');
  await beat(tok, 2600);
  for (const [u, v] of [['s', 'u'], ['u', 'x'], ['x', 'y']]) { G.e(u, v).set(J2.hot); await beat(tok, 500); }
  say('路徑長度 = 經過的 edge 長度總和', 's→u→x→y：1 + 1 + 1 = 3');
  await beat(tok, 3000);
  for (const e of G.E) e.set(J2.edge);
  say('目標：s 到「所有其他點」的最短距離', '不給終點：一次全部算出來');
  for (const k of ['u', 'v', 'x', 'y', 'z']) { glow(G.N[k], GOLD); txt(G.D[k], '最短？'); await beat(tok, 350); }
  await beat(tok, 2600);
}]);

// 15:48 Dijkstra 的 procedure：集合 S 與 d 值
FRAG.push(['grjiang2-dijkstra-procedure', 'Dijkstra 的 procedure：S 集合、d 值、每輪選最近的新點', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.2, 0]);
  const cd = code(['Dijkstra(G, ℓ)', '1 S = {s}; d(s) = 0', '2 while S ≠ V', "3   選 v ∉ S 使 d'(v) 最小", "4   d'(v) = min (d(u) + ℓ(u,v)), u∈S", '5   S = S ∪ {v}; d(v) = d\'(v)'], -3.4, 6.6, 0.56);
  say('Dijkstra：greedy algorithm', '1959；要維護兩樣東西：集合 S 與 d 值');
  await beat(tok, 3000);
  const S = ghostBox('#e55a9b', 3.4, 2.2, 0.6); S.position.set(-3.6, 1.4, 0);
  tag('S：已算好最短距離', 'ptr', -3.6, 2.85);
  const s = cube('s', J2.exp, [0.7, 0.7, 0.7], -4.6, 1.4, 0, 1.5);
  const ds = tag('d=?', 'ptr alt', -4.6, 0.4);
  cd.hl(1);
  say('一開始只知道 s 到 s 是 0', 'S = {s}，d(s) = 0');
  txt(ds, 'd=0');
  await beat(tok, 2800);
  const u = cube('u', J2.exp, [0.7, 0.7, 0.7], -2.6, 1.4, 0, 1.5); tag('d=1', 'ptr alt', -2.6, 0.4);
  await beat(tok, 600);
  const cands = [['a', 3.0, 3.0, 'd(u)+ℓ = 1+4 = 5'], ['b', 3.0, 1.4, 'd(s)+ℓ = 0+2 = 2'], ['c', 3.0, -0.2, 'd(u)+ℓ = 1+3 = 4']];
  const cm = [], ar = [];
  cd.hl(3);
  say('每輪：從 S 往外看一條 edge', '能 reach 到的新點，算 d(u) + ℓ(e)');
  for (const [k, x, y, f] of cands) {
    cm.push(cube(k, J2.node, [0.7, 0.7, 0.7], x, y, 0, 1.2));
    ar.push(arrow(V3(k === 'b' ? -4.2 : -2.2, 1.4, 0), V3(x - 0.45, y, 0), J2.hot));
    tag(f, 'idx', x + 2.0, y);
    await beat(tok, 900);
  }
  await beat(tok, 1600);
  cd.hl(4);
  say('第 4 行：這個和取最小 = d\'(v)', '括號：d(u) + ℓ(e) 是一整項');
  glow(cm[1], GOLD);
  await beat(tok, 2600);
  cd.hl(5);
  ar.forEach(kill);
  tint(cm[1], J2.exp); move(cm[1], -0.6, 1.4, 0); glow(cm[1], null);
  S.scale.x = 1.6; S.position.x = -2.5;
  say('最近的 b 放進 S，d(b) = 2 定案', '放進 S 後不再改變');
  await beat(tok, 2800);
  cd.hl(2);
  say('重複到所有點都在 S（或走不下去）', 'greedy：由近到遠');
  await beat(tok, 2800);
}]);

// 21:29 小例子 step by step
FRAG.push(['grjiang2-dijkstra-small', 'Dijkstra 小例子：s→u→v→x→y→z 由近到遠', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2S_P, J2S_E);
  const Sl = tag('S = { }', 'ptr alt', -3.6, -0.6);
  const setS = (a) => txt(Sl, 'S = { ' + a.join(', ') + ' }');
  say('directed graph，source = s', 'edge 長度都已給定');
  await beat(tok, 2400);
  j2Explore(G, 's'); txt(G.D.s, 'd=0'); setS(['s']);
  say('s 到 s 是 0 距離', 'S = {s}，d(s) = 0');
  await beat(tok, 2400);
  const look = async (list) => { for (const [k, from, val] of list) { G.e(from, k).set(J2.hot); txt(G.D[k], "d'=" + val); glow(G.N[k], GOLD); } };
  await look([['u', 's', 1], ['v', 's', 2], ['x', 's', 4]]);
  say('從 s 往外看：u、v、x', "0+1 = 1、0+2 = 2、0+4 = 4");
  await beat(tok, 3000);
  const pick = async (k, d, from, S, f) => {
    for (const e of G.E) if (e.obj && !G.tree?.includes(e)) e.set(J2.edge);
    for (const kk of Object.keys(G.N)) glow(G.N[kk], null);
    (G.tree ||= []).push(G.e(from, k));
    for (const e of G.tree) e.set(J2.tree);
    j2Explore(G, k); txt(G.D[k], 'd=' + d); setS(S);
    say('最小的是 ' + k + '：走過去，放進 S', f);
    await beat(tok, 2600);
  };
  await pick('u', 1, 's', ['s', 'u'], '1 < 2 < 4 → d(u) = 1 定案');
  await pick('v', 2, 's', ['s', 'u', 'v'], '再長到 v：d(v) = 2');
  await look([['x', 'u', 2], ['y', 'u', 4], ['z', 'v', 5]]);
  say('粉紅區 = {s, u, v}：往外看', "x：1+1 = 2　y：1+3 = 4　z：2+3 = 5");
  await beat(tok, 3400);
  await pick('x', 2, 'u', ['s', 'u', 'v', 'x'], '2、4、5 最小 → d(x) = 2，不再改變');
  await look([['y', 'x', 3], ['z', 'x', 4]]);
  say('經過 x 可以更近', "y：2+1 = 3 < 4　z：2+2 = 4 < 5");
  await beat(tok, 3000);
  await pick('y', 3, 'x', ['s', 'u', 'v', 'x', 'y'], '3 < 4 → 放 y');
  await pick('z', 4, 'x', ['s', 'u', 'v', 'x', 'y', 'z'], '最後放 z，procedure 結束');
  await beat(tok, 2200);
}]);

// 25:36 觀察：d 值從 ∞ 只降不升；explore 順序 d 遞增
FRAG.push(['grjiang2-dijkstra-observe', 'Dijkstra 的兩個觀察：d 只降不升、由近到遠', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('觀察一：d 值從 ∞ 不斷下降', '降到真正最短距離就 freeze');
  const H = [['x', [Infinity, 4, 2]], ['y', [Infinity, 4, 3]], ['z', [Infinity, 5, 4]]];
  const hgt = (d) => (d === Infinity ? 5.2 : d * 1.0);
  const bars = [];
  for (let r = 0; r < 3; r++) {
    const x = -5 + r * 2.4;
    tag(H[r][0], 'ptr', x, -0.4);
    const b = cube('', J2.blue, [1.2, 1, 0.7], x, 0, 0); b.scale.y = hgt(Infinity); b.position.y = hgt(Infinity) / 2;
    bars.push([b, tag('∞', 'ptr alt', x, hgt(Infinity) + 0.4)]);
  }
  await beat(tok, 2400);
  for (let st = 1; st < 3; st++) {
    for (let r = 0; r < 3; r++) {
      const [b, l] = bars[r], from = b.scale.y, to = hgt(H[r][1][st]);
      await anim(tok, 500, (t) => { b.scale.y = from + (to - from) * t; b.position.y = b.scale.y / 2; l.position.y = b.scale.y + 0.4; });
      txt(l, String(H[r][1][st]));
    }
    say(st === 1 ? '經過 u、v：x 4、y 4、z 5' : '經過 x：x 2、y 3、z 4', st === 1 ? '新 explore 的點帶來更近的走法' : '放進 S 後就不再動');
    await beat(tok, 2400);
  }
  for (const [b] of bars) tint(b, J2.exp);
  say('觀察二：explore 的順序', 'd 值由小到大：greedy，由近走到遠');
  const ord = [['s', 0], ['u', 1], ['v', 2], ['x', 2], ['y', 3], ['z', 4]];
  line(1.0, 0.3, 6.6, 0.3, 0, '#6e5f49');
  for (let k = 0; k < ord.length; k++) {
    const [n, d] = ord[k], x = 1.2 + d * 1.3;
    cube(n, J2.exp, [0.6, 0.6, 0.6], x, 0.7 + (k === 3 ? 0.7 : 0), 0, 1.5);
    tag(String(d), 'idx', x, -0.1);
    await beat(tok, 600);
  }
  await beat(tok, 1600);
  say('難點：第 3、4 行每輪都要取 min', '要有好的 data structure 配合');
  await beat(tok, 3000);
}]);

// 29:21 正確性：loop invariant + induction on |S|
FRAG.push(['grjiang2-loop-invariant', 'Dijkstra 正確性：loop invariant 與對 |S| 做 induction', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('要證：每點最後的 d 就是最短距離', '用 greedy stays ahead');
  await beat(tok, 2600);
  tag('Loop invariant：S 裡每個點的 d 都是最短距離', 'ptr alt', 0, 6.4);
  say('while loop 有不變的性質', 'loop 結束時 S = V → 全部都對');
  await beat(tok, 3000);
  const ord = [['s', 0], ['u', 1], ['v', 2], ['x', 2], ['y', 3], ['z', 4]];
  const box = ghostBox('#e55a9b', 1.6, 2.0, 0.8); box.position.set(-4.6, 2.4, 0);
  tag('S', 'ptr', -5.9, 3.7);
  const kl = tag('|S| = 1', 'ptr', 3.8, 4.6);
  for (let k = 0; k < ord.length; k++) {
    const x = -4.6 + k * 1.8;
    const m = cube(ord[k][0], k === 0 ? J2.exp : J2.node, [0.8, 0.8, 0.8], x, 2.4, 0, k === 0 ? 1.5 : 0);
    tag('d=' + ord[k][1], 'idx', x, 1.3);
    if (k === 0) {
      say('Basis：S 只有 s', 'd(s) = 0 一定對（trivial）');
      await beat(tok, 3000);
      say('Inductive step：weak induction', '假設 |S| = k 成立，證 k + 1 也成立');
      await beat(tok, 3200);
      continue;
    }
    glow(m, GOLD);
    await beat(tok, 700);
    tint(m, J2.exp); glow(m, null);
    const w = 1.6 + k * 1.8; box.scale.x = w / 1.6; box.position.x = -4.6 - 0.8 + w / 2;
    txt(kl, '|S| = ' + (k + 1));
    say('每輪 S 只多一個點', '|S| = ' + k + ' 對 → |S| = ' + (k + 1) + ' 也對');
    await beat(tok, 1200);
  }
  say('歸納到 S = V', '所有點的 d 都是最短距離 ∎');
  await beat(tok, 3000);
}]);

// 35:36 inductive step：紅色 P_v 與綠色另一條路
FRAG.push(['grjiang2-dijkstra-proof', 'Inductive step：另一條路一定不比 P_v 短', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const S = ghostBox('#e55a9b', 6.0, 5.2, 0.6); S.position.set(-3.2, 3.0, 0);
  tag('S（k 個點，d 都正確）', 'ptr', -3.2, 6.0);
  const P = { s: [-5.2, 3], u: [-2.0, 1.4], x: [-1.4, 4.6], v: [3.2, 1.4], y: [2.6, 4.6] };
  const N = {};
  for (const k of Object.keys(P)) N[k] = cube(k, ['s', 'u', 'x'].includes(k) ? J2.exp : J2.node, [0.75, 0.75, 0.75], P[k][0], P[k][1], 0, 1.4);
  say('第 k+1 輪選中 v：經過 u 進來', "d(v) = d(u) + ℓ(u,v) 是所有候選裡最小");
  await beat(tok, 3200);
  const seg = (a, b, c) => { const [x1, y1] = P[a], [x2, y2] = P[b]; const l = line(x1, y1, x2, y2, 0.3, c); return l; };
  seg('s', 'u', J2.bad); arrow(V3(-1.55, 1.4, 0.3), V3(2.75, 1.4, 0.3), 0xd64545);
  tag('P_v（紅）', 'ptr alt', 0.6, 0.7);
  say('紅色路徑 P_v：s ⇝ u → v', 's ⇝ u 已是最短（induction hypothesis）');
  await beat(tok, 3200);
  seg('s', 'x', '#1f9e6e'); arrow(V3(-0.95, 4.6, 0.3), V3(2.15, 4.6, 0.3), 0x1f9e6e); seg('y', 'v', '#1f9e6e');
  tag('另一條路（綠）', 'ptr', 0.6, 5.3);
  say('假設還有綠色路徑到 v', '它一定在某處離開 S：x → y');
  glow(N.x, GOLD); glow(N.y, GOLD);
  await beat(tok, 3400);
  const f = tag('', 'ptr alt', 0.6, -0.6);
  txt(f, "d(x) + ℓ(x,y) ≥ d(u) + ℓ(u,v) = d(v)");
  say('第 4 行選了 v、沒選 y', '所以 s ⇝ x → y 這段已經 ≥ d(v)');
  await beat(tok, 3600);
  glow(N.y, null); glow(N.v, GOLD);
  txt(f, '綠色 = (s⇝y) + (y⇝v) ≥ d(v) + 0');
  say('剩下 y ⇝ v 這段長度 ≥ 0', '加上去只會更大');
  await beat(tok, 3400);
  tint(N.v, J2.exp); glow(N.v, GREEN);
  say('綠色總長 ≥ 紅色：d(v) 是最短', '|S| = k+1 時 invariant 仍成立');
  await beat(tok, 3200);
}]);

// 44:32 只適用非負 edge weight（反例是補充）
FRAG.push(['grjiang2-negative-weight', '為什麼 Dijkstra 要求 edge weight ≥ 0', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('證明關鍵：y ⇝ v 那段 ≥ 0', '靠的是 ℓ(e) ≥ 0');
  await beat(tok, 2800);
  say('放進 S 就不再回頭改', 'greedy：決定了就不 revisit');
  await beat(tok, 2600);
  const G = j2Graph({ s: [-4.4, 3], a: [1.2, 5.2], b: [1.2, 0.8] }, [['s', 'a', 2], ['s', 'b', 3], ['b', 'a', -2]], { drop: 1.5 });
  tag('補充反例：有負的 edge', 'ptr', 4.4, 6.2);
  G.E[2].set(J2.bad); j2Cls(G.E[2].lb, 'ptr');
  await beat(tok, 1600);
  j2Explore(G, 's'); txt(G.D.s, 'd=0'); txt(G.D.a, "d'=2"); txt(G.D.b, "d'=3");
  say('從 s 出發：a = 2、b = 3', '');
  await beat(tok, 2400);
  G.e('s', 'a').set(J2.tree); j2Explore(G, 'a'); txt(G.D.a, 'd=2 定案');
  say('a 最近：d(a) = 2 定案', '放進 S，不再改');
  await beat(tok, 2600);
  G.e('s', 'b').set(J2.tree); j2Explore(G, 'b'); txt(G.D.b, 'd=3');
  G.e('b', 'a').set(J2.hot); glow(G.N.a, GOLD);
  say('其實 s→b→a = 3 + (−2) = 1', '比 2 還短，但 a 已經 freeze');
  await beat(tok, 3400);
  tint(G.N.a, J2.bad);
  say('結果錯：負的 weight 不能用 Dijkstra', '有負 weight → 之後的 Bellman-Ford（DP）');
  await beat(tok, 3400);
}]);

// 47:11 ／ Lec13 12:36 min-priority queue 的操作次數與三種實作
FRAG.push(['grjiang2-pq-costs', 'Min-priority queue：操作次數與 array／binary heap／Fibonacci heap', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.2, 0]);
  say('d 值當 key 放進 min-PQ', '每輪 Extract-Min，再 update 鄰居');
  await beat(tok, 2800);
  const cols = [-5.2, -2.4, -0.4, 2.4, 5.0];
  ['operation', '次數', 'array', 'binary heap', 'Fibonacci'].forEach((h, c) => tag(h, 'ptr', cols[c], 6.2));
  const rows = [['Insert', 'n', 'O(1)', 'O(log n)', 'O(1)'], ['ExtractMin', 'n', 'O(n)', 'O(log n)', 'O(log n)*'], ['ChangeKey', 'm', 'O(1)', 'O(log n)', 'O(1)*'], ['IsEmpty', 'n', 'O(1)', 'O(1)', 'O(1)']];
  const cells = [];
  for (let r = 0; r < rows.length; r++) {
    const y = 5.2 - r * 0.95;
    cells.push(rows[r].map((v, c) => { const l = tag(v, c < 2 ? 'ptr alt' : 'idx', cols[c], y); if (c >= 2) showL(l, false); return l; }));
  }
  say('每個點 insert 一次、extract 一次', 'n 個點 → 各 n 次');
  await beat(tok, 2800);
  say('只 update 鄰居：總共 m 次 ChangeKey', 'm = edge 總數');
  await beat(tok, 2800);
  for (let r = 0; r < rows.length; r++) showL(cells[r][2], true);
  say('Array：每次 Extract-Min 要掃一遍', 'n · O(n) → O(n²)');
  const t1 = tag('O(n²)', 'ptr alt', cols[2], 1.0);
  await beat(tok, 3200);
  for (let r = 0; r < rows.length; r++) showL(cells[r][3], true);
  say('Binary heap：每個操作 O(log n)', '(n + m) log n（課本 O(m log n)）');
  tag('O((n+m) log n)', 'ptr alt', cols[3], 1.0);
  await beat(tok, 3200);
  for (let r = 0; r < rows.length; r++) showL(cells[r][4], true);
  say('Fibonacci heap：理論最快、常數大', '補充：O(m + n log n)，*為 amortized');
  tag('O(m + n log n)', 'ptr alt', cols[4], 1.0);
  await beat(tok, 3200);
  void t1;
  say('本課重點：會用 binary heap 實作', '資料量不大時 Fibonacci heap 不一定快');
  await beat(tok, 2800);
}]);

// 50:40 ／ Lec13 05:32 CLRS 例子：min-priority queue 版本
FRAG.push(['grjiang2-dijkstra-clrs', 'Dijkstra（CLRS 例子）：Extract-Min 依序 0、5、7、8、9', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const p = (ctx.params || {});
  const G = j2Graph(J2C_P, J2C_E);
  const d = { s: 0, t: Infinity, x: Infinity, y: Infinity, z: Infinity }, par = {}, done = new Set();
  const Q = tag('', 'ptr', -0.8, -0.7);
  const cnt = tag('', 'ptr alt', 4.6, -0.7);
  let upd = 0;
  const showQ = () => { txt(Q, 'min-PQ：' + Object.keys(d).filter((k) => !done.has(k)).sort((a, b) => d[a] - d[b]).map((k) => k + ':' + j2F(d[k])).join('  ')); if (p.count) txt(cnt, 'update 次數 ' + upd); };
  for (const k of Object.keys(d)) txt(G.D[k], j2F(d[k]));
  showQ();
  say('圈圈裡的數字 = 當下的 d 值', 's = 0，其他人都是 ∞');
  await beat(tok, 2800);
  while (done.size < 5) {
    const u = Object.keys(d).filter((k) => !done.has(k)).sort((a, b) => d[a] - d[b])[0];
    done.add(u); j2Explore(G, u); if (par[u]) G.e(par[u], u).set(J2.tree);
    showQ();
    say('Extract-Min 吐出 ' + u + '（d = ' + d[u] + '）', '變黑 = 放進 S，d 不再改變');
    await beat(tok, 2000);
    for (const e of G.E.filter((x) => x.u === u && !done.has(x.v))) {
      const nd = d[u] + e.w, v = e.v;
      e.set(J2.hot); glow(G.N[v], GOLD); upd++;
      const better = nd < d[v];
      say(u + ' → ' + v + '：' + d[u] + ' + ' + e.w + ' = ' + nd, better ? nd + ' < ' + j2F(d[v]) + ' → update' : nd + ' ≥ ' + d[v] + ' → 不變');
      if (better) { if (par[v]) G.e(par[v], v).set(J2.edge); d[v] = nd; par[v] = u; txt(G.D[v], String(nd)); }
      showQ();
      await beat(tok, 1500);
      e.set(par[v] === u ? J2.tree : J2.edge); glow(G.N[v], null);
    }
  }
  say('explore 順序 s、y、z、t、x', 'd = 0、5、7、8、9：由近到遠');
  await beat(tok, 2800);
  if (p.count) { say('只 update 往外連出的 edge', '總 update 次數 ≤ m（edge 總數）'); await beat(tok, 2800); }
}]);

// ═════════════ Lec13 ═════════════

// 01:52 實作：從 edge 的角度取 min → 每個點記 d（shortest-path estimate）
FRAG.push(['grjiang2-edge-vs-vertex', '實作加速：對 edge 取 min 改成每個點記 d 值', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2S_P, J2S_E);
  for (const [k, d] of [['s', 0], ['u', 1], ['v', 2]]) { j2Explore(G, k); txt(G.D[k], 'd=' + d); }
  G.e('s', 'u').set(J2.tree); G.e('s', 'v').set(J2.tree);
  say('S = {s, u, v} 時，原始寫法：', '把每條跨出 S 的 edge 都算一次');
  await beat(tok, 2600);
  const cross = [['s', 'x', '0+4=4'], ['u', 'x', '1+1=2'], ['u', 'y', '1+3=4'], ['v', 'z', '2+3=5']];
  const ls = [];
  for (let k = 0; k < cross.length; k++) {
    const [a, b, f] = cross[k]; G.e(a, b).set(J2.hot);
    ls.push(tag(a + '→' + b + '：' + f, 'idx', -4.4 + k * 2.9, -0.7));
    await beat(tok, 800);
  }
  say('對所有 edge 取 min：每輪都很慢', 'take minimum 的對象是 edge');
  await beat(tok, 2800);
  ls.forEach(kill);
  for (const [a, b] of cross) G.e(a, b).set(J2.edge);
  say('改成每個點記一個 d 值', 'shortest-path estimate：多個來源先取 min');
  for (const [k, v] of [['x', 2], ['y', 4], ['z', 5]]) { txt(G.D[k], 'd=' + v); glow(G.N[k], GOLD); await beat(tok, 700); }
  await beat(tok, 2000);
  for (const k of ['x', 'y', 'z']) glow(G.N[k], null);
  say('一開始除了 s 都是 ∞，只降不升', 'unreachable 的點就一直是 ∞');
  await beat(tok, 2800);
  glow(G.N.x, GREEN);
  say('take minimum 的對象變成點', 'x、y、z 三個 key 裡挑最小：x = 2');
  await beat(tok, 3000);
}]);

// 19:49 priority queue：max／min 與四種操作（OS process 例子）
FRAG.push(['grjiang2-pq-ops', 'Priority queue：Find／Extract／Insert／ChangeKey', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('每筆 data 帶一個 key = priority', 'max-PQ：key 大優先　min-PQ：key 小優先');
  await beat(tok, 2800);
  tag('max-priority queue（OS 的 process，key 為示意）', 'ptr', 0, 6.3);
  let q = [['P1', 9], ['P2', 7], ['P3', 4], ['P4', 2]];
  const ms = {};
  const lay = () => q.forEach(([n], k) => move(ms[n], -3.6 + k * 2.2, 3.2, 0));
  q.forEach(([n, v], k) => { ms[n] = cube(n + ':' + v, J2.blue, [1.8, 0.8, 0.8], -3.6 + k * 2.2, 3.2, 0, 1.5); });
  await beat(tok, 1600);
  glow(ms.P1, GOLD);
  say('Find-Max：看 priority 最高的', 'P1（key 9）');
  await beat(tok, 2600);
  say('Extract-Max：找到並移除（處理掉）', '剩下的還要維持 priority queue');
  fly(ms.P1); q = q.slice(1); await beat(tok, 900); lay();
  await beat(tok, 2000);
  say('Insert：新 process（例如開影片）', 'key 8');
  ms.P5 = cube('P5:8', J2.exp, [1.8, 0.8, 0.8], 0, 3.2, 0, 3);
  q.unshift(['P5', 8]); await beat(tok, 700); lay();
  await beat(tok, 2200);
  say('ChangeKey：P4 等太久快 starving', '把 priority 提高：2 → 10');
  glow(ms.P4, GOLD); relabel(ms.P4, 'P4:10');
  q = [['P4', 10], ...q.filter(([n]) => n !== 'P4')]; await beat(tok, 900); lay();
  await beat(tok, 2600);
  glow(ms.P4, null);
  say('Dijkstra 用 min-PQ', '以下 heap 用 max heap 講，min 對稱');
  await beat(tok, 2800);
}]);

// 25:18 max heap 定義、complete binary tree
FRAG.push(['grjiang2-heap-def', 'Max heap：每個點 ≥ 小孩，complete binary tree', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([14, 12, 7, 10, 8, 6], { cells: false, drop: 2 });
  H.R.forEach((m) => m && kill(m));
  say('Max heap：一棵 binary tree', '每個點的 key ≥ 小孩的 key');
  await beat(tok, 2600);
  for (const [p, cs] of [[1, [2, 3]], [2, [4, 5]], [3, [6]]]) {
    H.hi(p, GOLD); cs.forEach((c) => H.hi(c, RED));
    say(H.A[p] + ' ≥ ' + cs.map((c) => H.A[c]).join('、'), '');
    await beat(tok, 1500); H.unhi();
  }
  H.hi(1, GREEN);
  say('最大值一定在 root', 'max = 14');
  await beat(tok, 2400);
  H.unhi(); for (const i of [4, 5, 6]) H.hi(i, GOLD);
  say('最小值一定在某個 leaf', '不在 leaf 就有小孩比它小 → 矛盾');
  await beat(tok, 3000);
  H.unhi();
  const ix = [];
  for (let i = 1; i <= 6; i++) { ix.push(tag(String(i), 'idx', HX(i) + 0.62, HY(i) + 0.4)); await beat(tok, 350); }
  say('Complete binary tree', '由上而下、由左而右編號；只有最後一層右邊可缺');
  await beat(tok, 3000);
  const hole = cube('', J2.bad, [0.8, 0.7, 0.6], HX(7) + 0.0, HY(7), 0, 1.5); tint(H.T[6], J2.gray);
  say('中間有洞（缺 6 卻有 7）', '就不是 heap，建錯了');
  await beat(tok, 2800);
  kill(hole); tint(H.T[6], J2.blue);
  say('Min heap 對稱：每個點 ≤ 小孩', 'root 是最小值');
  await beat(tok, 2600);
}]);

// 29:21 用 array 存 heap：index 從 1 開始
FRAG.push(['grjiang2-heap-array', 'Heap 存在 array：小孩 2i、2i+1，parent ⌊i/2⌋', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([14, 12, 7, 10, 8, 6], { cap: 10, zero: true, drop: 1.5 });
  say('宣告成 array，心中把它當 heap', 'index 0 空著不用，從 1 開始');
  await beat(tok, 3000);
  H.hi(1, GOLD); H.hi(2, RED); H.hi(3, RED);
  say('root 在 index 1，小孩在 2、3', 'left = 2i，right = 2i + 1');
  await beat(tok, 2800);
  H.unhi(); H.hi(2, GOLD); H.hi(4, RED); H.hi(5, RED);
  say('index 2 的小孩：4、5', '找到 10 和 8');
  await beat(tok, 2800);
  H.unhi(); H.hi(4, RED); H.hi(5, RED); H.hi(2, GOLD);
  say('反過來：parent = ⌊i / 2⌋', '⌊4/2⌋ = ⌊5/2⌋ = 2');
  await beat(tok, 2800);
  H.unhi();
  const hs = tag('heap size = 6', 'ptr alt', AX(3.5), -1.1);
  const cp = tag('capacity = 10（array 長度）', 'ptr', AX(8), -1.1);
  say('heap size：前幾筆維持 heap', 'capacity：宣告的 array 長度');
  await beat(tok, 3000);
  say('超過 heap size 的格子不理它', '在 array 裡，但不在 heap 裡');
  void hs; void cp;
  await beat(tok, 2800);
}]);

// 33:28 insert 1、insert 21
FRAG.push(['grjiang2-heap-insert', 'Heap insert：放尾巴、往上浮（insert 1、insert 21）', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([20, 15, 2, 14, 10], { cap: 7, drop: 1.5 });
  say('Max heap：20 15 2 14 10', 'insert key 1');
  await beat(tok, 2600);
  const ins = async (v) => {
    const i = ++H.n; H.A[i] = v;
    H.T[i] = cube(v, J2.exp, [0.8, 0.7, 0.6], HX(i), HY(i), 0, 2.5); H.R[i] = cube(v, J2.exp, [0.9, 0.55, 0.55], AX(i), 0.4, 0, 2.5);
    H.edges();
    say('先塞在最尾巴：index ' + i, '維持 complete binary tree');
    await beat(tok, 2200);
    let k = i;
    while (k > 1) {
      const pr = k >> 1; H.unhi(); H.hi(k, GOLD); H.hi(pr, RED);
      if (H.A[k] <= H.A[pr]) { say(H.A[k] + ' ≤ parent ' + H.A[pr], '大小關係正確：結束'); await beat(tok, 2400); break; }
      say(H.A[k] + ' > parent ' + H.A[pr] + '：交換', '往上浮一層');
      await beat(tok, 1300);
      H.swap(k, pr); k = pr;
      await beat(tok, 1300);
    }
    if (k === 1) { H.unhi(); H.hi(1, GREEN); say('浮到 root 才停', H.A.slice(1).join(' ')); await beat(tok, 2400); }
    H.unhi(); H.tint(k, J2.blue);
  };
  await ins(1);
  say('再 insert key 21', '');
  await beat(tok, 1400);
  await ins(21);
  say('最多浮到 root：O(log n)', '高度 = log n');
  await beat(tok, 2800);
}]);

// 37:23 pop（Extract-Max）
FRAG.push(['grjiang2-heap-pop', 'Heap pop：拔 root、尾巴補上、往下沉', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([21, 15, 20, 14, 10, 1, 2], { drop: 1.5 });
  say('Remove 一定是拔 priority 最大的', 'max heap：remove root（21）');
  await beat(tok, 2600);
  H.hi(1, GOLD); await beat(tok, 800);
  fly(H.T[1]); fly(H.R[1]); H.T[1] = H.R[1] = null; H.A[1] = null;
  await beat(tok, 1200);
  say('root 空了：叫最尾巴的 2 補上', 'O(1)；heap size 7 → 6');
  H.swap(1, 7); H.n = 6; H.edges(); H.A.length = 7; H.T.length = 7; H.R.length = 7;
  await beat(tok, 2400);
  say('只有新 root 不對，其餘仍是 heap', '跟左右小孩比，和較大的換');
  await beat(tok, 2400);
  await H.sift(tok, 1, 2600);
  say('結果：20 15 2 14 10 1', '最多沉到 leaf：O(log n)');
  await beat(tok, 3000);
}]);

// 41:44 ／ 50:31 MAX-HEAPIFY：左右 subtree 已是 heap，只修自己
FRAG.push(['grjiang2-max-heapify', 'MAX-HEAPIFY：假設兩個 subtree 都是 heap，只修正自己', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([1, 15, 2, 14, 10], { drop: 1.5 });
  say('MAX-HEAPIFY(i)', '假設左右 subtree 已是 heap，只處理 i 跟兩個小孩');
  await beat(tok, 3000);
  say('從最後一個 leaf 的 parent 開始', 'n = 5 → ⌊5/2⌋ = 2');
  await beat(tok, 2400);
  await H.sift(tok, 2, 2400);
  say('換 root：左右 subtree 都是 heap 了', '1 和小孩 15、2 比');
  await beat(tok, 2200);
  await H.sift(tok, 1, 2400);
  H.hi(1, GREEN);
  say('修正完成：15 14 2 1 10', '時間 = 這個點的高度 O(h)');
  await beat(tok, 3000);
}]);

// 53:16 BUILD-MAX-HEAP（CLRS 例子）
FRAG.push(['grjiang2-build-heap', 'Build max heap：i = ⌊n/2⌋ 到 1 依序 MAX-HEAPIFY', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([4, 1, 3, 2, 16, 9, 10, 14, 8, 7], { drop: 1.5 });
  say('10 筆亂放的資料：不是 heap', '4 1 3 2 16 9 10 14 8 7');
  await beat(tok, 2800);
  const it = tag('', 'ptr alt', 4.2, 6.6);
  for (let i = 5; i >= 1; i--) {
    txt(it, 'MAX-HEAPIFY(' + i + ')');
    say('i = ' + i + '：修正 ' + H.A[i], i === 5 ? '最後一筆在 10 → parent 是 index 5' : '下面的 subtree 都已是 heap');
    await beat(tok, 1500);
    await H.sift(tok, i, 1500);
  }
  txt(it, '完成');
  for (let i = 1; i <= 10; i++) H.hi(i, GREEN);
  say('Bottom-up：數學歸納法的想法', '16 14 10 8 7 9 3 2 4 1');
  await beat(tok, 3200);
}]);

// 56:12 build heap 的時間（老師說 n log n；更緊的界是 O(n)）
FRAG.push(['grjiang2-build-heap-cost', 'Build heap 的時間：每點最多換「高度」次', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([16, 14, 10, 8, 7, 9, 3, 2, 4, 1], { cells: false });
  H.R.forEach((m) => m && kill(m));
  say('MAX-HEAPIFY 一個點：最多換到底', '次數 = 它的高度 h');
  await beat(tok, 2800);
  const hgt = (i) => { let h = 0; while (2 * i <= 10) { i *= 2; h++; } return h; };
  let sum = 0; const sl = tag('Σ 高度 = 0', 'ptr alt', 0, 0.2);
  for (let i = 5; i >= 1; i--) {
    const h = hgt(i); sum += h;
    H.hi(i, GOLD); tag('h=' + h, 'ptr', HX(i), HY(i) + 0.75);
    txt(sl, 'Σ 高度 = ' + sum);
    say('index ' + i + '：最多換 ' + h + ' 次', h === 1 ? 'leaf 的 parent：下面只有一層' : '越上面的點越少');
    await beat(tok, 1700);
    H.hi(i, null);
  }
  say('老師：每點 O(log n)，共 O(n log n)', '這是正確的上界');
  await beat(tok, 3000);
  say('補充：高度 h 的點約 n / 2^(h+1) 個', 'Σ h · n / 2^(h+1) = O(n)（CLRS）');
  await beat(tok, 3600);
  say('n = 10：最多 ' + sum + ' 次交換', '≤ n：build heap 其實是線性時間');
  await beat(tok, 3000);
}]);

// 58:47 heapsort
FRAG.push(['grjiang2-heapsort', 'Heapsort：root 換到尾巴、heap size − 1、MAX-HEAPIFY', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([16, 14, 10, 8, 7, 9, 3, 2, 4, 1], { keepTree: true });
  say('第一階段：build max heap', '16 14 10 8 7 9 3 2 4 1');
  await beat(tok, 2600);
  let first = true;
  while (H.n > 1) {
    const n = H.n;
    H.unhi(); H.hi(1, GOLD); H.hi(n, RED);
    if (first) { say('root 16 是最大：和尾巴的 1 交換', '16 放到最後，位置確定'); await beat(tok, 2200); }
    H.swap(1, n);
    H.n = n - 1; H.edges(); H.tint(n, J2.gray);
    if (H.T[n]) { kill(H.T[n]); H.T[n] = null; }
    if (first) { say('heap size 10 → 9', '只剩 root 不對：MAX-HEAPIFY(1)'); await beat(tok, 2400); }
    else { say('取出 ' + H.A[n] + '，heap size → ' + (n - 1), ''); await beat(tok, 500); }
    await H.sift(tok, 1, first ? 1800 : 700, !first);
    first = false;
  }
  H.unhi(); H.tint(1, J2.gray); if (H.T[1]) kill(H.T[1]);
  say('由小排到大：1 2 3 4 7 8 9 10 14 16', 'build + n 次 heapify：O(n log n)');
  await beat(tok, 3000);
  say('只用原本的 array：in-place sorting', '同樣 n log n 的還有 merge sort');
  await beat(tok, 2800);
}]);

// 65:35 MST：第四台拉線的例子（圖與數字為示意）
const J2M_P = { A: [-4.6, 4.6], B: [0, 5.6], C: [4.6, 4.6], D: [-3.6, 0.6], E: [0.6, 1.6], F: [4.8, 0.6] };
const J2M_E = [['A', 'B', 4], ['A', 'D', 2], ['B', 'D', 5], ['B', 'E', 3], ['B', 'C', 6], ['C', 'E', 2], ['C', 'F', 4], ['E', 'F', 5], ['D', 'E', 7]];
FRAG.push(['grjiang2-mst-cable', 'Minimum spanning tree：用最少的線連到每一戶', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  say('第四台業者要拉線到每個客戶家', '線越長越貴（圖與數字為示意）');
  const G = j2Graph(J2M_P, J2M_E, { undirected: true, drop: 1.5, tagDy: 0.8 });
  await beat(tok, 2800);
  say('輸入：undirected graph', 'edge cost ≥ 0；有 edge = 可以拉線的兩戶');
  for (const e of G.E) j2Cls(e.lb, 'ptr');
  await beat(tok, 2800);
  say('選一個 edge 的 subset T', '每一戶都要 connected、總 cost 最小');
  const pickA = [['A', 'B'], ['B', 'D'], ['B', 'C'], ['C', 'F'], ['D', 'E']];
  for (const [a, b] of pickA) { G.e(a, b).set(J2.hot); await beat(tok, 450); }
  say('這樣也連得到每一戶', '4 + 5 + 6 + 4 + 7 = 26');
  await beat(tok, 2600);
  for (const e of G.E) e.set(J2.edge);
  const best = [['A', 'D'], ['C', 'E'], ['B', 'E'], ['A', 'B'], ['C', 'F']];
  for (const [a, b] of best) { G.e(a, b).set(J2.tree); await beat(tok, 450); }
  for (const k of Object.keys(G.N)) tint(G.N[k], J2.exp);
  say('最便宜的選法：總 cost 15', '2 + 2 + 3 + 4 + 4 = 15');
  await beat(tok, 3000);
  say('spanning 蓋住所有點、minimum 最便宜', 'Prim、Kruskal、Reverse-delete 三種方法');
  await beat(tok, 3200);
}]);

// 70:30 為什麼解一定是 tree：有 cycle 就剪掉一條
FRAG.push(['grjiang2-mst-tree', '為什麼答案是 tree：有 cycle 就剪一條，仍 connected 且更便宜', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2M_P, J2M_E, { undirected: true, tagDy: 0.8 });
  const sel = [['A', 'B'], ['A', 'D'], ['D', 'E'], ['B', 'E'], ['C', 'E'], ['C', 'F']];
  for (const [a, b] of sel) G.e(a, b).set(J2.tree);
  const cost = tag('total = 4+2+7+3+2+4 = 22', 'ptr alt', 0, -0.6);
  say('假設選出的 subgraph 有 cycle', 'A–B–E–D–A');
  await beat(tok, 2800);
  for (const [a, b] of [['A', 'B'], ['B', 'E'], ['D', 'E'], ['A', 'D']]) { G.e(a, b).set(J2.hot); await beat(tok, 500); }
  await beat(tok, 1400);
  say('cycle 上隨便剪掉一條 edge', '剪 D–E（7）');
  G.e('D', 'E').set(J2.dim); j2Cls(G.e('D', 'E').lb, 'idx');
  await beat(tok, 2600);
  for (const [a, b] of [['A', 'B'], ['B', 'E'], ['A', 'D']]) G.e(a, b).set(J2.tree);
  say('剩下的變一條線：仍然 connected', 'D 還是能經過 A、B 到 E');
  for (const k of ['D', 'A', 'B', 'E']) { glow(G.N[k], GOLD); await beat(tok, 450); }
  await beat(tok, 1400);
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  txt(cost, 'total = 22 − 7 = 15');
  say('cost 只會變低（cost ≥ 0）', '所以最佳解沒有 cycle');
  await beat(tok, 3000);
  say('connected + 沒有 cycle = tree', '問題叫 minimum spanning tree');
  await beat(tok, 3000);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 5 章',
    title: '貪婪演算法 Greedy',
    color: 'var(--alg)',
    modes: [
      { id: 'activity', name: 'Activity selection', enter: enterActivity },
      { id: 'huffman', name: 'Huffman code', enter: enterHuffman },
      { id: 'knapsack', name: 'Knapsack 比較', enter: enterKnapsack },
      { id: 'jobs', name: 'Job sequencing', enter: enterJobs },
      { id: 'merge', name: 'Optimal merge', enter: enterMerge },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['feasible-optimal', 'greedy-general', 'greedy-filter', 'activity-select', 'activity-proof', 'activity-wrong-rules', 'huffman-build', 'huffman-cost', 'frac-knapsack', 'knapsack-greedy-fail', 'job-sequencing', 'optimal-merge', 'greedy-or-dp'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
