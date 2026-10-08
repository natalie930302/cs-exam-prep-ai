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
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, GRAY } = K;
// ─── hZjp35QI-40 / 0UGaXukC4b0（交大江蕙如 Lec10–11 Greedy：interval scheduling、interval partitioning、minimize lateness） ───
const gb = (tok, ms) => beat(tok, Math.round(ms * 1.35));
const GJ = { blue: '#4b9ee2', orange: '#dd8238', red: '#d64545', teal: '#2fc092', purple: '#9b7ef4', sand: '#c9b48e', paper: '#efe6d2', pink: '#e55a9b', gold: '#c08a1f', ink: '#6e5f49', gray: '#bdb3a2' };
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
const gOv = (a, b) => a[0] < b[1] && b[0] < a[1];
// 老師的 8 個 request（2→5 無縫接、1/3/4 跟 2 overlap、最多選 3 個）；數字為示意
const IS8 = [[0, 5], [1, 4], [3, 6], [2, 7], [4, 8], [5, 9], [6, 10], [8, 11]];
// interval partitioning 例子（I1..I10 依 s 排好，depth = 3；I1、I3 在 2 結束、I2 在 5 結束，與老師的水位 2/5/2 一致）
const IP10 = [[0, 2], [0, 5], [0, 2], [2, 6], [2, 7], [5, 8], [6, 9], [7, 10], [8, 10], [9, 11]];
const LCOL = [GJ.blue, GJ.orange, GJ.red];
function gPartition() { const fin = [0, 0, 0], lbl = []; IP10.forEach(([s, f]) => { const k = fin.findIndex((x) => x <= s); lbl.push(k); fin[k] = f; }); return lbl; }
// minimize lateness：Kleinberg–Tardos 的 6 個 job（EDF 後只有第 4 個遲交 1）
const LJ = [[3, 6], [2, 8], [1, 9], [4, 9], [3, 14], [2, 15]];
// 依序緊接著排；回傳每個 job 的 [start, finish]
function gPack(order, t0 = 0) { let t = t0; return order.map((i) => { const s = t; t += LJ[i][0]; return [s, t]; }); }

// ════════ hZjp35QI-40（Lec10：Greedy 概念、Interval scheduling） ════════
// 02:04 Greedy：每一步選當下最好、做了決定不回頭
FRAG.push(['grjiang1-myopic', 'Greedy：每步選當下最好、不回頭', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  const opts = [[3, 7, 5], [6, 2, 4], [1, 5, 8], [4, 9, 2]];
  say('一步一步兜出 solution', '每個 step 做一個 decision');
  await gb(tok, 1600);
  let prev = null;
  for (let s = 0; s < 4; s++) {
    const x = -4.5 + s * 3;
    tag('step ' + (s + 1), 'idx', x, 6.2);
    const cs = opts[s].map((v, k) => cube(v, GJ.paper, [0.9, 0.6, 0.6], x, 5.2 - k * 1.0, 0, 2));
    await gb(tok, 700);
    const best = opts[s].indexOf(Math.max(...opts[s]));
    if (s === 0) say('依 criterion 選當下最好', 'greedy rule：值最大者');
    glow(cs[best], GOLD); await gb(tok, 700);
    cs.forEach((c, k) => { if (k !== best) tint(c, GJ.gray); });
    tint(cs[best], GJ.teal);
    move(cs[best], x, 1.2, 0); await gb(tok, 600);
    if (prev) arrow(V3(prev + 0.5, 1.2, 0), V3(x - 0.5, 1.2, 0));
    if (s === 1) { say('做完決定就不再回頭看', '沒有反覆、所以跑得快'); tag('鎖定', 'ptr', x - 3, 0.4); }
    prev = x; await gb(tok, 900);
  }
  say('好寫、好懂、跑得快', '通常是一個 loop');
  await gb(tok, 2200);
  say('但 quality 常常不好', '要設計對的 rule 並證明 optimal');
  await gb(tok, 2800);
}]);

// 04:54 兩種證明法：stays ahead（一路領先）與 exchange argument（挖掉貼上）
FRAG.push(['grjiang1-two-proofs', '兩種證明：stays ahead 與 exchange argument', async (tok) => {
  fresh([0, 4, 14], [0, 3, 0]);
  tag('① greedy stays ahead', 'ptr alt', -3.6, 6.4);
  tag('greedy', 'idx', -6.3, 4.6); tag('OPT', 'idx', -6.3, 3.4);
  line(-5.6, 5.2, -5.6, 2.8); line(-0.8, 5.2, -0.8, 2.8, 0, '#c08a1f');
  const g = cube('G', GJ.teal, [0.6, 0.6, 0.6], -5.3, 4.6, 0), o = cube('O', GJ.purple, [0.6, 0.6, 0.6], -5.3, 3.4, 0);
  say('第一招：每一步都不輸', '一路領先到終點 = 冠軍');
  for (let k = 1; k <= 4; k++) { move(g, -5.3 + k * 1.15, 4.6, 0); move(o, -5.3 + k * 1.0, 3.4, 0); await gb(tok, 700); }
  glow(g, GOLD); await gb(tok, 1200);
  tag('② exchange argument', 'ptr alt', 3.4, 6.4);
  const blocks = ['o1', 'o2', 'o3', 'o4'].map((t, k) => cube(t, GJ.purple, [0.9, 0.7, 0.7], 1.4 + k * 1.1, 4.4, 0, 2));
  say('第二招：先假設神人給了 OPT', '我不管他怎麼找到的');
  await gb(tok, 1800);
  glow(blocks[1], RED);
  say('不符合 greedy rule 的部分', '挖掉它');
  await gb(tok, 1400); fly(blocks[1], V3(0, 6, 3)); await gb(tok, 700);
  const mine = cube('g', GJ.teal, [0.9, 0.7, 0.7], 2.5, 4.4, 0, 3);
  say('換成 greedy 的選擇貼上', 'cut and paste');
  await gb(tok, 1400);
  tag('quality 沒變差 → 仍是 optimal', 'ptr', 3.0, 3.2); glow(mine, GOLD);
  say('換完一樣 optimal 就證完', '第二招最常用，一定要會');
  await gb(tok, 3000);
}]);

// 08:46 Interval scheduling：single core、選最多個互相 compatible 的 request
FRAG.push(['grjiang1-is-problem', 'Interval scheduling：最多 compatible request', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5.5, 5.5, 0.8);
  say('每個 request 有 [s(i), f(i))', '左閉右開：頭尾可以無縫接');
  const B = IS8.map(([s, f], i) => { tag(String(i + 1), 'idx', -6.3, 5.6 - i * 0.6); return gBar(ax, '', s, f, 5.6 - i * 0.6, GJ.sand, 2.5); });
  for (let i = 0; i < 8; i++) { await gb(tok, 250); }
  await gb(tok, 1200);
  say('single core：一次只能跑一個', '選出的 interval 不能 overlap');
  await gb(tok, 2000);
  tint(B[1], GJ.teal); tint(B[4], GJ.teal);
  const l = line(ax.X(4), 6.0, ax.X(4), 0.8, 0, '#c08a1f');
  say('2 一結束馬上換 5：compatible', 'f(2) = s(5) = 4');
  await gb(tok, 2400); kill(l);
  [0, 2, 3].forEach((i) => glow(B[i], RED));
  say('選了 2 就不能選 1、3、4', '它們跟 2 overlap');
  await gb(tok, 2400);
  [0, 2, 3].forEach((i) => glow(B[i], null));
  [0, 2, 3, 5, 6].forEach((i) => tint(B[i], GJ.gray));
  tint(B[7], GJ.teal);
  tag('A = { 2, 5, 8 }', 'ptr alt', 0, 6.5);
  say('這個例子最多選 3 個', 'max |compatible subset| = 3');
  await gb(tok, 2600);
  say('演藝廳借場地也是這題', '讓最多社團表演，不是先到先贏');
  await gb(tok, 2800);
}]);

// 14:55 Greedy 模板：依 rule 選一個、reject overlap、重複；rule 有四個候選
FRAG.push(['grjiang1-is-template', 'Greedy 模板：選一個、刪 overlap、重複', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  const cd = code(['repeat', '  依 greedy rule 選 request i', '  accept i', '  reject 跟 i overlap 的', 'until 全部處理完'], -3.4, 6.0, 0.6);
  const ax = gAx(0, 9, 0.6, 6.6, 1.6);
  const D = [[0, 3], [2, 5], [4, 7], [6, 9]];
  const B = D.map(([s, f], i) => gBar(ax, String.fromCharCode(97 + i), s, f, 5.4 - i * 0.8, GJ.sand, 2));
  say('greedy 都是同一個 loop', 'step by step 做決定');
  await gb(tok, 1800);
  const steps = [[1, [0, 2]], [3, []]];
  for (const [pick, rej] of steps) {
    cd.hl(1); glow(B[pick], GOLD); say('依 rule 選一個 request', '當下看起來最好的'); await gb(tok, 1300);
    cd.hl(2); tint(B[pick], GJ.teal); glow(B[pick], null); await gb(tok, 800);
    cd.hl(3); if (rej.length) say('跟它 overlap 的全部 reject', '保持 compatible');
    rej.forEach((i) => fly(B[i], V3(2, 6, 3))); await gb(tok, 1200);
  }
  cd.hl(4); await gb(tok, 900);
  say('rule 要怎麼訂？四個候選', 'greedy rule = 何謂「最好」');
  const R = ['① 最早開始 s(i)', '② 最短 interval', '③ 最少 conflict', '④ 最早結束 f(i)'];
  for (let k = 0; k < 4; k++) { cube(R[k], GJ.paper, [2.9, 0.55, 0.7], -4.65 + k * 3.1, 0.3, 0, 2); await gb(tok, 450); }
  await gb(tok, 2600);
}]);

// 16:47 四個 rule：前三個舉反例推翻，只剩最早結束
FRAG.push(['grjiang1-four-rules', '四個 greedy rule：反例推翻前三個', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  let ax = gAx(0, 12, -6, 6, 0.8);
  // ① 最早開始
  tag('① 最早開始', 'ptr alt', 0, 6.4);
  const L = gBar(ax, '最早開始', 0, 11, 4.8, GJ.sand, 2);
  const S = [[1, 3], [3, 5], [5, 7], [7, 9]].map(([s, f]) => gBar(ax, '', s, f, 3.6, GJ.sand, 2));
  await gb(tok, 900);
  tint(L, GJ.teal); S.forEach((b) => glow(b, RED));
  say('最早開始的又很晚結束', '選它只有 1 個，別的選法有 4 個');
  await gb(tok, 2800);
  // ② 最短 interval
  fresh([0, 3.6, 13], [0, 3.2, 0]); ax = gAx(0, 12, -6, 6, 0.8);
  tag('② 最短 interval', 'ptr alt', 0, 6.4);
  const a = gBar(ax, '', 0, 6, 3.6, GJ.sand, 2), b = gBar(ax, '', 6, 12, 3.6, GJ.sand, 2), sh = gBar(ax, '短', 5, 7, 4.8, GJ.sand, 2);
  await gb(tok, 900);
  tint(sh, GJ.teal); glow(a, RED); glow(b, RED);
  say('短的卻跟兩個長的都打架', '選它得 1 個，最佳是 2 個');
  await gb(tok, 2800);
  // ③ 最少 conflict
  fresh([0, 3.6, 13], [0, 3.2, 0]); ax = gAx(0, 12, -6, 6, 0.8);
  tag('③ 最少 conflict', 'ptr alt', 0, 6.4);
  const top = [[0, 3], [3, 6], [6, 9], [9, 12]].map(([s, f]) => gBar(ax, '', s, f, 5.2, GJ.sand, 2));
  const mid = gBar(ax, '2', 5, 7, 4.4, GJ.sand, 2);
  const cp = [];
  for (let r = 0; r < 3; r++) { cp.push(gBar(ax, '', 2, 4, 3.6 - r * 0.6, GJ.sand, 2)); cp.push(gBar(ax, '', 8, 10, 3.6 - r * 0.6, GJ.sand, 2)); }
  await gb(tok, 900);
  [3, 4, 3, 3].forEach((c, i) => relabel(top[i], c));
  say('標出每個 request 的 conflict 數', '中間那個只跟 2 個打架');
  await gb(tok, 1800);
  tint(mid, GJ.teal); glow(top[1], RED); glow(top[2], RED);
  say('選它最多 3 個', '上面一排 4 個才是最佳');
  await gb(tok, 2000);
  glow(top[1], null); glow(top[2], null); tint(mid, GJ.gray); top.forEach((t) => tint(t, GJ.teal));
  await gb(tok, 1400);
  // ④ 最早結束
  cube('④ 最早結束 f(i) ✔', GJ.teal, [4.2, 0.7, 0.8], 0, 6.3, 0.5, 2);
  say('答案是第 4 個：最早結束', '直覺的 rule 不一定對，舉反例');
  await gb(tok, 3000);
}]);

// 21:07 選最早結束：最早把 resource 放出來；8 個 request 依 f 跑一次
FRAG.push(['grjiang1-eft-run', '最早結束優先：8 個 request 選出 2、5、8', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5.5, 5.5, 1.3);
  const ord = IS8.map((r, i) => i).sort((p, q) => IS8[p][1] - IS8[q][1]);
  const B = IS8.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.6, GJ.sand, 2));
  await gb(tok, 900);
  say('先依 finish time 排序', 'O(n log n)');
  ord.forEach((i, r) => move(B[i], ax.X((IS8[i][0] + IS8[i][1]) / 2), 6.0 - r * 0.6, 0));
  await gb(tok, 1800);
  const alive = new Set(ord), A = [];
  const At = tag('A = { }', 'ptr alt', 0, 0.3);
  for (const i of ord) {
    if (!alive.has(i)) continue;
    alive.delete(i); A.push(i + 1);
    glow(B[i], GOLD); tint(B[i], GJ.teal);
    const l = line(ax.X(IS8[i][1]), 6.4, ax.X(IS8[i][1]), 1.3, 0, '#c08a1f');
    say('選 ' + (i + 1) + '：剩下的裡面最早結束', 'f(' + (i + 1) + ') = ' + IS8[i][1] + '，最早釋放 resource');
    await gb(tok, 1600);
    const rej = [...alive].filter((j) => gOv(IS8[i], IS8[j]));
    if (rej.length) say('跟 ' + (i + 1) + ' overlap 的 reject', rej.map((j) => j + 1).join('、') + ' 被槓掉');
    rej.forEach((j) => { alive.delete(j); fly(B[j], V3(1, 6, 3)); });
    txt(At, 'A = { ' + A.join(', ') + ' }');
    await gb(tok, 1500); glow(B[i], null); kill(l);
  }
  say('resource 越早放出來越好', '剩下的人越有機會用到');
  await gb(tok, 2800);
}]);

// 22:50 Pseudocode：A ← ∅；while R 非空：選 f 最小、加入 A、刪掉它與 overlap；feasible
FRAG.push(['grjiang1-eft-code', 'Interval scheduling 的 pseudocode 與 feasible', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  const cd = code(['1 A ← ∅', '2 while R ≠ ∅', '3   選 i ∈ R，f(i) 最小', '4   A ← A ∪ {i}', '5   R ← R − {i} − X', '6 return A'], -3.6, 5.8, 0.62);
  tag('X：跟 i overlap 的 request', 'idx', -3.6, 1.6);
  const ax = gAx(0, 11, 0.6, 6.6, 0.8);
  const B = IS8.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 5.8 - i * 0.6, GJ.sand, 2));
  await gb(tok, 900);
  cd.hl(0); const At = tag('A = { }', 'ptr alt', 3.6, 6.6);
  say('R：還沒處理的 request', 'A：accepted，一開始空集合');
  await gb(tok, 1800);
  const alive = new Set(IS8.map((r, i) => i)), A = [];
  while (alive.size) {
    cd.hl(1); await gb(tok, 500);
    const i = [...alive].sort((p, q) => IS8[p][1] - IS8[q][1])[0];
    cd.hl(2); glow(B[i], GOLD); if (!A.length) say('每輪選 finish time 最小的', 'greedy rule：earliest finish'); await gb(tok, 1000);
    cd.hl(3); tint(B[i], GJ.teal); glow(B[i], null); A.push(i + 1); txt(At, 'A = { ' + A.join(', ') + ' }'); alive.delete(i); await gb(tok, 700);
    cd.hl(4); const rej = [...alive].filter((j) => gOv(IS8[i], IS8[j]));
    if (A.length === 1) say('第 5 行：連 overlap 一起扣掉', 'R ← R − {i} − X');
    rej.forEach((j) => { alive.delete(j); fly(B[j], V3(1, 6, 3)); }); await gb(tok, 1100);
  }
  cd.hl(5);
  say('feasible：A 一定互相 compatible', '因為第 5 行刪光 overlap');
  await gb(tok, 2600);
  say('接著要問：是最佳嗎？多快？', 'optimal? running time?');
  await gb(tok, 2600);
}]);

// 36:46 Stays ahead 的想法：只比個數，partial solution 每步都不輸
const SA_A = [[0, 2], [3, 5], [6, 8]], SA_O = [[1, 3], [3.5, 6], [6, 9]];
FRAG.push(['grjiang1-stays-ahead-idea', 'Stays ahead：只要 |A| = |O|', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 10, -5, 5, 1.2);
  tag('A（greedy）', 'idx', -6.2, 4.6); tag('O（optimal）', 'idx', -6.2, 3.0);
  const a = SA_A.map(([s, f], k) => gBar(ax, 'i' + (k + 1), s, f, 4.6, GJ.teal, 2));
  const o = SA_O.map(([s, f], k) => gBar(ax, 'j' + (k + 1), s, f, 3.0, GJ.purple, 2));
  await gb(tok, 900);
  say('O：某個神人找到的最佳解', 'A：greedy 吐出來的解');
  await gb(tok, 2200);
  say('不用證 A 跟 O 一模一樣', '只要個數一樣：|A| = |O|');
  await gb(tok, 2400);
  say('i 依選的順序，j 依時間排好', 'A = {i1..ik}，O = {j1..jm}');
  await gb(tok, 2200);
  for (let r = 0; r < 3; r++) {
    glow(a[r], GOLD); glow(o[r], GOLD);
    const l1 = line(ax.X(SA_A[r][1]), 5.0, ax.X(SA_A[r][1]), 1.2, 0, '#1f9e6e'), l2 = line(ax.X(SA_O[r][1]), 3.4, ax.X(SA_O[r][1]), 1.2, 0, '#9b7ef4');
    say('對齊第 ' + (r + 1) + ' 個比 finish', 'f(i' + (r + 1) + ') = ' + SA_A[r][1] + ' ≤ f(j' + (r + 1) + ') = ' + SA_O[r][1]);
    await gb(tok, 1700); glow(a[r], null); glow(o[r], null); kill(l1); kill(l2);
  }
  say('每一步都跑在前面', 'greedy always stays ahead');
  await gb(tok, 2800);
}]);

// 42:44 Lemma：f(i_r) ≤ f(j_r)；base case r = 1
FRAG.push(['grjiang1-lemma-base', 'Lemma f(i_r) ≤ f(j_r)：base case', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  tag('Lemma：r = 1..k，f(i_r) ≤ f(j_r)', 'ptr alt', 0, 6.5);
  const ax = gAx(0, 10, -5, 5, 0.8);
  const R = [[1, 3], [0, 2], [2, 4], [3.5, 6], [3, 5], [6, 9], [5, 7]];
  const B = R.map(([s, f], k) => gBar(ax, '', s, f, 5.6 - k * 0.62, GJ.sand, 2));
  await gb(tok, 900);
  say('用數學歸納法證 lemma', 'base：r = 1');
  await gb(tok, 1800);
  [0, 3, 5].forEach((k, n) => { tint(B[k], GJ.purple); relabel(B[k], 'j' + (n + 1)); });
  say('O 只是其中一個 subset', 'j1 = O 裡最早結束的');
  await gb(tok, 2200);
  tint(B[1], GJ.teal); relabel(B[1], 'i1'); glow(B[1], GOLD);
  say('i1 = 全部 request 裡最早結束', 'greedy 第一步就選它');
  await gb(tok, 2200);
  const l1 = line(ax.X(2), 6.1, ax.X(2), 0.8, 0, '#1f9e6e'), l2 = line(ax.X(3), 6.1, ax.X(3), 0.8, 0, '#9b7ef4');
  tag('f(i1)', 'idx', ax.X(2) - 0.4, 0.15); tag('f(j1)', 'idx', ax.X(3) + 0.4, 0.15);
  say('整體最小 ≤ subset 的最小', 'f(i1) ≤ f(j1)');
  await gb(tok, 2600);
  glow(B[1], null);
  say('r = 1 成立，接著做 inductive step', 'weak induction：每次前進一步');
  await gb(tok, 2600); kill(l1); kill(l2);
  await gb(tok, 300);
}]);

// 45:02 Inductive step：f(i_{r-1}) ≤ f(j_{r-1}) ≤ s(j_r) → j_r 還在 R → f(i_r) ≤ f(j_r)
FRAG.push(['grjiang1-lemma-induct', 'Inductive step：j_r 還在 R 裡', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 10, -5, 5, 1.2);
  tag('A', 'idx', -6, 4.6); tag('O', 'idx', -6, 3.0);
  const i1 = gBar(ax, 'i(r−1)', 0, 2, 4.6, GJ.teal, 2), j1 = gBar(ax, 'j(r−1)', 1, 3, 3.0, GJ.purple, 2), j2 = gBar(ax, 'j(r)', 3.5, 6, 3.0, GJ.purple, 2);
  await gb(tok, 900);
  say('假設 r−1 時成立', 'f(i(r−1)) ≤ f(j(r−1))');
  const la = line(ax.X(2), 5.0, ax.X(2), 1.2, 0, '#1f9e6e'), lb = line(ax.X(3), 3.4, ax.X(3), 1.2, 0, '#9b7ef4');
  await gb(tok, 2200);
  const lc = line(ax.X(3.5), 3.4, ax.X(3.5), 1.2, 0, '#c08a1f');
  say('O compatible：j(r−1) 結束才開始 j(r)', 'f(j(r−1)) ≤ s(j(r))');
  await gb(tok, 2400);
  glow(j2, GOLD);
  say('所以 j(r) 跟 i(r−1) 不 overlap', 'f(i(r−1)) ≤ s(j(r))');
  await gb(tok, 2200);
  const inR = tag('j(r) 沒被槓掉，仍在 R', 'ptr', ax.X(4.75), 2.2);
  say('選 i(r) 那輪，j(r) 還在 R', '第 5 行不會刪掉它');
  await gb(tok, 2400);
  const i2 = gBar(ax, 'i(r)', 3, 5, 4.6, GJ.teal, 2.5);
  await gb(tok, 700); glow(i2, GOLD);
  const ld = line(ax.X(5), 5.0, ax.X(5), 1.2, 0, '#1f9e6e'), le = line(ax.X(6), 3.4, ax.X(6), 1.2, 0, '#9b7ef4');
  say('i(r) 是 R 裡 f 最小的', 'f(i(r)) ≤ f(j(r))（同一個就等號）');
  await gb(tok, 2800);
  [la, lb, lc, ld, le, inR].forEach(kill);
  say('每一步都比 O 早結束', 'lemma 得證');
  await gb(tok, 2400);
}]);

// 52:26 反證：若 m > k，j(k+1) 在 i(k) 結束後仍在 R，loop 應繼續 → 矛盾
FRAG.push(['grjiang1-optimal-contra', '反證法：|A| = |O|', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 10, -5, 5, 1.2);
  tag('A', 'idx', -6, 4.6); tag('O', 'idx', -6, 3.0);
  say('假設 A 不是 optimal', '則 m > k');
  const a = [[0, 2], [3, 5]].map(([s, f], k) => gBar(ax, 'i' + (k + 1), s, f, 4.6, GJ.teal, 2));
  const o = [[1, 3], [3.5, 6], [6, 9]].map(([s, f], k) => gBar(ax, 'j' + (k + 1), s, f, 3.0, GJ.purple, 2));
  relabel(a[1], 'ik'); relabel(o[1], 'jk'); relabel(o[2], 'j(k+1)');
  await gb(tok, 2200);
  glow(o[2], GOLD);
  say('O 至少多一個 j(k+1)', '排在 jk 後面');
  await gb(tok, 2000);
  const l1 = line(ax.X(5), 5.0, ax.X(5), 1.2, 0, '#1f9e6e'), l2 = line(ax.X(6), 3.4, ax.X(6), 1.2, 0, '#9b7ef4');
  say('lemma + compatible 串起來', 'f(ik) ≤ f(jk) ≤ s(j(k+1))');
  await gb(tok, 2600);
  tag('i(k) 選完，R 裡還有 j(k+1)', 'ptr', ax.X(7.5), 2.2);
  say('ik 選完後 R 還不是空的', 'while loop 會再跑一輪');
  await gb(tok, 2400);
  const ghost = gBar(ax, 'i(k+1)?', 6, 9, 4.6, GJ.gray, 2.5);
  await gb(tok, 800); glow(ghost, RED);
  say('A 應有第 k+1 個 → 矛盾', '所以 A 是 optimal');
  await gb(tok, 2200);
  [l1, l2].forEach(kill); fly(ghost, V3(0, 6, 3));
  tag('|A| = |O| = k', 'ptr alt', 0, 6.4);
  say('greedy 一路領先到底', 'stays ahead 證完');
  await gb(tok, 2800);
}]);

// 59:54 直接實作：排序 O(n log n)，但第 5 行每輪跟剩下全部比 → O(n²)
FRAG.push(['grjiang1-naive-n2', '直接照 pseudocode 做：O(n²)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3, 0]);
  const n = 8;
  say('先依 finish time 排序', 'sorting：O(n log n)');
  const C = [];
  for (let i = 0; i < n; i++) { C.push(cube('r' + (i + 1), GJ.sand, [1.0, 0.55, 0.6], -4.9 + i * 1.4, 5.6, 0, 2)); await gb(tok, 200); }
  await gb(tok, 1000);
  say('第 5 行：要跟剩下的每個人比', 'finish 晚不代表不 overlap');
  await gb(tok, 2200);
  const cols = [];
  for (let k = 0; k < n - 1; k++) {
    glow(C[k], GOLD); tint(C[k], GJ.teal);
    const h = (n - 1 - k) * 0.45;
    cols.push(cube(String(n - 1 - k), GJ.orange, [0.9, Math.max(0.1, h), 0.6], -4.9 + k * 1.4, 0.3 + h / 2, 0, 1.5));
    if (k === 0) say('第 1 個比 n−1 次', 'worst case');
    if (k === 1) say('第 2 個比 n−2 次……', 'worst case');
    await gb(tok, 750); glow(C[k], null);
  }
  say('總共 (n−1)+(n−2)+…+1', '= n(n−1)/2 = O(n²)');
  await gb(tok, 2800);
  say('排序省不掉，第 5 行能更快嗎？', '目標：整體 O(n log n)');
  await gb(tok, 2800);
}]);

// 63:46 一次掃描：S = 依 finish 排序後的 starting time；只清 partial conflict，6 留給 5 來槓
const OP7 = [[0, 2], [1, 3], [3, 5], [4, 6], [6, 8], [1, 9], [7, 10]];
FRAG.push(['grjiang1-onepass', '只掃一次 R：partial reject，O(n)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 10, -5, 5, 1.6);
  const B = OP7.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.6, GJ.sand, 2));
  tag('S', 'idx', -6.2, 0.4);
  const S = OP7.map(([s], i) => cube(s, GJ.paper, [0.7, 0.5, 0.6], -4.5 + i * 1.5, 0.4, 0, 1.5));
  await gb(tok, 900);
  say('已依 finish 排好，記下 starting time', 'S = 對應的 s 序列');
  await gb(tok, 2200);
  const cur = tag('▲ scan', 'ptr', -4.5, -0.3);
  let p = 0, A = [];
  while (p < 7) {
    const i = p; glow(B[i], GOLD); tint(B[i], GJ.teal); tint(S[i], GJ.teal); A.push(i + 1);
    const l = line(ax.X(OP7[i][1]), 6.4, ax.X(OP7[i][1]), 1.6, 0, '#c08a1f');
    say('選 ' + (i + 1) + '，往後看 s 是否 < f(' + (i + 1) + ')', 'f(' + (i + 1) + ') = ' + OP7[i][1]);
    await gb(tok, 1500); glow(B[i], null);
    p++;
    while (p < 7 && OP7[p][0] < OP7[i][1]) {
      cur.position.x = -4.5 + p * 1.5; glow(S[p], RED);
      await gb(tok, 900);
      fly(B[p], V3(1, 6, 3)); tint(S[p], GJ.gray); glow(S[p], null); p++;
    }
    if (p < 7) {
      cur.position.x = -4.5 + p * 1.5; glow(S[p], GREEN);
      say('s(' + (p + 1) + ') ≥ f(' + (i + 1) + ')：停，不再往後比', '這一輪結束');
      await gb(tok, 1600); glow(S[p], null);
    }
    if (i === 0) { glow(B[5], RED); say('6 也跟 1 打架，但先不理', '後面一定有人幫忙槓掉'); await gb(tok, 2400); glow(B[5], null); }
    if (i === 4) { say('5 選起來時，6、7 才被槓掉', '沒有漏網之魚'); await gb(tok, 1800); }
    kill(l);
  }
  tag('A = { ' + A.join(', ') + ' }', 'ptr alt', 0, 6.6);
  say('cursor 只往前，不回頭', '第 5 行合計 O(n)，總共 O(n log n)');
  await gb(tok, 3000);
}]);

// 72:42 / Lec11 02:43 Interval partitioning：multiple resource、用最少台機器（coloring）
FRAG.push(['grjiang1-partition-intro', 'Interval partitioning：最少幾台機器', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5.5, 5.5, 0.6);
  const B = IP10.map(([s, f], i) => gBar(ax, 'I' + (i + 1), s, f, 6.0 - i * 0.5, GJ.sand, 2, 0.34));
  await gb(tok, 1000);
  say('每個 request 都要做完', '現在有 multiple resource');
  await gb(tok, 2200);
  say('目標：用最少台機器', 'overlap 的不能放同一台');
  await gb(tok, 2200);
  const lbl = gPartition(), Y = [4.4, 3.0, 1.6];
  ['resource 1', 'resource 2', 'resource 3'].forEach((t, k) => tag(t, 'idx', -6.4, Y[k]));
  say('一個 resource = 一種顏色', '也叫 interval coloring');
  for (let i = 0; i < 10; i++) { tint(B[i], LCOL[lbl[i]]); move(B[i], ax.X((IP10[i][0] + IP10[i][1]) / 2), Y[lbl[i]], 0); await gb(tok, 450); }
  await gb(tok, 900);
  say('這個例子 3 台就夠', '而且不可能更少');
  await gb(tok, 3000);
}]);

// ════════ 0UGaXukC4b0（Lec11：partitioning 的 depth、演算法、證明；minimize lateness） ════════
// 06:02 Depth：任一時間點最多幾個 interval overlap；resource ≥ depth
FRAG.push(['grjiang1-depth', 'Depth d：resource 的 lower bound', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5.5, 5.5, 0.6);
  const B = IP10.map(([s, f], i) => gBar(ax, 'I' + (i + 1), s, f, 6.0 - i * 0.5, GJ.sand, 2, 0.34));
  await gb(tok, 900);
  say('depth：某時間點最多幾個 overlap', '掃過整條時間軸取最大');
  const sw = line(0, 6.4, 0, 0.6, 0, '#c08a1f'); const cnt = tag('', 'ptr', 0, 6.7);
  let dmax = 0;
  for (const t of [0.5, 2.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]) {
    sw.position.x = ax.X(t); cnt.position.x = ax.X(t);
    const on = IP10.map((r, i) => i).filter((i) => IP10[i][0] <= t && t < IP10[i][1]);
    B.forEach((b, i) => glow(b, on.includes(i) ? GOLD : null));
    dmax = Math.max(dmax, on.length); txt(cnt, on.length + ' 個');
    await gb(tok, 950);
  }
  B.forEach((b) => glow(b, null));
  tag('depth d = ' + dmax, 'ptr alt', 0, 0);
  await gb(tok, 900);
  sw.position.x = ax.X(1); cnt.position.x = ax.X(1); txt(cnt, '3 個');
  [0, 1, 2].forEach((i) => glow(B[i], RED));
  say('時間 1：I1、I2、I3 同時要跑', '一定要放 3 台不同機器');
  await gb(tok, 2600);
  say('任何解都至少要 d 台', '#resource ≥ depth');
  await gb(tok, 2600);
  say('d 能在 O(n log n) 算出來嗎？', '回家想一想');
  await gb(tok, 2400);
}]);

// 13:48 策略：先求 lower bound，再設計剛好用 d 台的方法 → 一定 optimal
FRAG.push(['grjiang1-reach-bound', '策略：直接達到 lower bound d', async (tok) => {
  fresh([0, 3.4, 12], [0, 2.8, 0]);
  const d = 3, Y0 = 0.3;
  const l = line(-6, Y0 + d * 0.9, 6, Y0 + d * 0.9, 0, '#c08a1f');
  tag('lower bound d = 3', 'ptr alt', -4.6, Y0 + d * 0.9 + 0.4);
  say('不管誰來做，至少 d 台', 'depth = lower bound');
  await gb(tok, 2200);
  const sols = [['某解', 5], ['某解', 4], ['某解', 6]];
  for (let k = 0; k < 3; k++) {
    const [name, n] = sols[k];
    for (let r = 0; r < n; r++) cube('', GJ.purple, [1.0, 0.8, 0.8], -4.5 + k * 2.2, Y0 + 0.45 + r * 0.9, 0, 1.5);
    tag(name + '：' + n + ' 台', 'idx', -4.5 + k * 2.2, Y0 - 0.4);
    await gb(tok, 700);
  }
  say('別人的解都 ≥ d', '可能多，不可能少');
  await gb(tok, 2000);
  const g = [];
  for (let r = 0; r < d; r++) { g.push(cube('', GJ.teal, [1.0, 0.8, 0.8], 3.6, Y0 + 0.45 + r * 0.9, 0, 2)); await gb(tok, 500); }
  tag('greedy：剛好 d 台', 'ptr', 3.6, Y0 - 0.4);
  g.forEach((c) => glow(c, GOLD));
  say('若能只用 d 台做完全部', 'reach lower bound → optimal');
  await gb(tok, 2800);
  say('答案是 yes：greedy 做得到', '證明就變簡單了');
  await gb(tok, 2600);
}]);

// 16:06 演算法：依 s 排序；每個 interval 排除衝突的 label，指定一個空的
FRAG.push(['grjiang1-partition-code', 'Partitioning 演算法：依 s 排序、找空的 label', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  const cd = code(['1 依 s 排序 I1..In', '2 for j = 1..n', '3   排除跟 Ij overlap 的 label', '4   if 還有 label 沒被排除', '5     把 Ij 指定給它', '6   else 略過 Ij（不會發生）'], -3.3, 6.0, 0.62);
  const ax = gAx(0, 11, 0.8, 6.6, 0.8);
  const Y = [4.6, 3.4, 2.2];
  Y.forEach((y, k) => tag('label ' + (k + 1), 'idx', 0.2, y + 0.4));
  cd.hl(0); say('d 已知，準備 label 1..d', '先依 starting time 排序');
  await gb(tok, 2000);
  const lbl = gPartition();
  for (let j = 0; j < 5; j++) {
    const [s, f] = IP10[j];
    const b = gBar(ax, 'I' + (j + 1), s, f, 6.2, GJ.sand, 1.5, 0.34);
    cd.hl(1); await gb(tok, 500);
    cd.hl(2); if (j === 0) say('先刪掉會打架的 label', '同 label 的 interval 不能 overlap'); await gb(tok, 900);
    cd.hl(3); await gb(tok, 400);
    cd.hl(4); tint(b, LCOL[lbl[j]]); move(b, ax.X((s + f) / 2), Y[lbl[j]], 0);
    if (j === 0) say('有空的 label 就指定給它', 'linear scan 一次');
    await gb(tok, 900);
  }
  cd.hl(5);
  say('第 6 行是防呆，等一下證明不會發生', 'Ij 一定拿得到 label');
  await gb(tok, 3000);
}]);

// 21:14 / 23:10 實作：每個 label 記最後 finish（水位）；s_j ≥ 水位才可用；跑完 10 個
FRAG.push(['grjiang1-partition-run', '每個 label 記 finish 水位：10 個 interval 跑一次', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5, 6, 0.8);
  const Y = [4.6, 3.4, 2.2], fin = [0, 0, 0];
  const W = Y.map((y, k) => tag('L' + (k + 1) + ' 水位 0', 'ptr', -6.1, y));
  Y.forEach((y, k) => line(-5, y - 0.25, 6, y - 0.25, 0, LCOL[k]));
  say('每個 label 記最後的 finish time', '新 interval 的 s ≥ 水位才不衝突');
  await gb(tok, 2400);
  for (let j = 0; j < 10; j++) {
    const [s, f] = IP10[j];
    const b = gBar(ax, 'I' + (j + 1), s, f, 6.0, GJ.sand, 1.5, 0.34);
    const sl = line(ax.X(s), 6.2, ax.X(s), 0.8, 0, '#c08a1f');
    await gb(tok, 450);
    let k = 0;
    for (; k < 3; k++) {
      if (fin[k] <= s) break;
      W[k].element.className = 'lab-label ptr alt';
      if (j < 3) say('s = ' + s + ' < 水位 ' + fin[k] + '：L' + (k + 1) + ' 不行', '已經被佔到 ' + fin[k]);
      await gb(tok, j < 3 ? 1300 : 450);
      W[k].element.className = 'lab-label ptr';
    }
    fin[k] = f; tint(b, LCOL[k]); move(b, ax.X((s + f) / 2), Y[k], 0); txt(W[k], 'L' + (k + 1) + ' 水位 ' + f);
    if (j < 3) say('放進 L' + (k + 1) + '，水位更新成 ' + f, '水位 = ' + fin.join(' / '));
    await gb(tok, j < 3 ? 1500 : 650); kill(sl);
  }
  say('10 個都塞進 3 個 label', '每個 label 內都不 overlap');
  await gb(tok, 2200);
  say('只用了 depth = 3 個', '剛好達到 lower bound');
  await gb(tok, 2600);
}]);

// 29:14 算 depth：2n 個端點排序（同時刻先 finish 再 start），掃一次 d++/d--、記 dmax
FRAG.push(['grjiang1-depth-sweep', '算 depth：端點排序後掃一次', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const ev = [];
  IP10.forEach(([s, f], i) => { ev.push([s, 1, 's' + (i + 1)]); ev.push([f, 0, 'f' + (i + 1)]); });
  ev.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  say('2n 個端點一起排序', 'O(2n log 2n) = O(n log n)');
  const C = ev.map(([t, isS, nm], k) => { const c = cube(nm, isS ? GJ.teal : GJ.pink, [0.56, 0.5, 0.5], -6.0 + k * 0.63, 3.4, 0, 1.5); tag(String(t), 'idx', -6.0 + k * 0.63, 2.8); return c; });
  await gb(tok, 1600);
  const D = tag('d = 0', 'ptr alt', -2, 5.4), M = tag('dmax = 0', 'ptr alt', 2, 5.4);
  say('start 就 d++，finish 就 d−−', '每次更新 dmax');
  const cur = tag('▲', 'ptr', -6.0, 2.2);
  let d = 0, dm = 0;
  for (let k = 0; k < ev.length; k++) {
    cur.position.x = -6.0 + k * 0.63; d += ev[k][1] ? 1 : -1; dm = Math.max(dm, d);
    glow(C[k], GOLD); txt(D, 'd = ' + d); txt(M, 'dmax = ' + dm);
    await gb(tok, 420); glow(C[k], null);
  }
  await gb(tok, 900);
  say('同時刻：先 finish 再 start', '結束的那刻不佔 resource');
  [2, 3, 4, 5].forEach((k) => glow(C[k], RED));
  tag('若先 start：d 會多算成 5', 'ptr', -3.5, 1.4);
  await gb(tok, 2800);
  [2, 3, 4, 5].forEach((k) => glow(C[k], null));
  say('掃描 O(n)，跟 interval 總長度無關', '不必檢查每個時間點');
  await gb(tok, 2800);
}]);

// 37:50 Optimality 證明：每個 interval 都拿得到 label；overlap 的不同 label；用 d 個 → optimal
FRAG.push(['grjiang1-partition-proof', '證明：t + 1 ≤ d，一定剩一個 label', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const ax = gAx(0, 11, -5, 6, 0.8);
  const Y = [4.6, 3.4, 2.2], lbl = gPartition();
  Y.forEach((y, k) => tag('label ' + (k + 1), 'idx', -6.1, y));
  const B = IP10.slice(0, 7).map(([s, f], i) => { const b = gBar(ax, 'I' + (i + 1), s, f, Y[lbl[i]], LCOL[lbl[i]], 0, 0.34); return b; });
  const j = 7, [s, f] = IP10[j];
  const Ij = gBar(ax, 'I8', s, f, 6.0, GJ.sand, 2, 0.34);
  await gb(tok, 900);
  say('處理 Ij 時，前面 t 個跟它 overlap', '例：I8，s = 7');
  const sl = line(ax.X(s), 6.3, ax.X(s), 0.8, 0, '#c08a1f');
  await gb(tok, 1600);
  [5, 6].forEach((i) => glow(B[i], GOLD)); glow(Ij, GOLD);
  say('它們都穿過 s(Ij) 這一點', 't + 1 個同時 overlap，t = 2');
  await gb(tok, 2400);
  say('depth 是最大 overlap', 't + 1 ≤ d → t ≤ d − 1');
  await gb(tok, 2400);
  [5, 6].forEach((i) => glow(B[i], RED));
  say('最多排除 d − 1 個 label', '至少剩一個 → 第 6 行不會發生');
  await gb(tok, 2400);
  glow(Ij, null); tint(Ij, LCOL[lbl[j]]); move(Ij, ax.X((s + f) / 2), Y[lbl[j]], 0);
  await gb(tok, 1200); kill(sl);
  say('overlap 的 Ii 早已有 label', '處理 Ij 時那個 label 被排除');
  glow(B[5], RED); glow(Ij, RED);
  await gb(tok, 2600);
  [5, 6].forEach((i) => glow(B[i], null)); glow(Ij, null);
  say('合法解，而且只用 d 個 label', '= lower bound → optimal');
  await gb(tok, 2800);
}]);

// 47:26 Minimize lateness：t_i、d_i，ℓ_i = max(0, f_i − d_i)，L = max ℓ_i
const LX = (t) => -6 + t * 0.8;
function gJobs(order, y, drop = 0, t0 = 0) {
  const pk = gPack(order, t0);
  return order.map((i, k) => { const [s, f] = pk[k]; const m = cube('J' + (i + 1), [GJ.blue, GJ.orange, GJ.teal, GJ.purple, GJ.pink, GJ.sand][i], [(f - s) * 0.8 - 0.06, 0.5, 0.6], LX((s + f) / 2), y, 0, drop); m.userData.f = f; m.userData.i = i; return m; });
}
function gDead(i, y) { const x = LX(LJ[i][1]); line(x, y - 0.25, x, y + 0.45, 0, '#d64545'); }
FRAG.push(['grjiang1-lateness-def', 'Lateness：遲交多少、取最大值', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  line(LX(0), 1.2, LX(15), 1.2);
  for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.85);
  say('每個 request 只給長度 t 與 deadline d', '沒有 start / finish，要我們排');
  const T = LJ.map(([t, d], i) => tag('J' + (i + 1) + ': t=' + t + ', d=' + d, 'idx', -4.5 + (i % 3) * 4.5, 6.2 - Math.floor(i / 3) * 0.6));
  await gb(tok, 2600);
  const J = gJobs([0, 1, 2, 3, 4, 5], 2.2, 2);
  for (let i = 0; i < 6; i++) gDead(i, 3.3 + (i % 2) * 0.6);
  tag('紅線 = deadline', 'idx', 4.5, 4.6);
  await gb(tok, 1600);
  say('一個接一個做', '單一資源，一次一件');
  await gb(tok, 2000);
  glow(J[3], RED);
  const lt = tag('ℓ4 = 10 − 9 = 1', 'ptr', LX(9.5), 4.6);
  say('J4 在 10 才做完，deadline 9', 'ℓ_i = max(0, f_i − d_i)');
  await gb(tok, 2800);
  glow(J[0], GREEN); tag('ℓ1 = 0', 'ptr', LX(1.5), 4.6);
  say('沒遲交就算 0', 'J1 在 3 做完，d = 6');
  await gb(tok, 2200);
  say('目標：最大遲交量越小越好', 'minimize L = max ℓ_i（不是加總）');
  await gb(tok, 3000);
}]);

// 52:06 三個 rule：shortest first、smallest slack 都有反例
FRAG.push(['grjiang1-lateness-rules', 'Shortest first、smallest slack 的反例', async (tok) => {
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  const X = (t) => -5.5 + t * 0.95;
  const bar = (nm, s, f, y, c) => cube(nm, c, [(f - s) * 0.95 - 0.06, 0.5, 0.6], X((s + f) / 2), y, 0, 2);
  line(X(0), 1.2, X(12), 1.2); for (let t = 0; t <= 12; t += 2) tag(String(t), 'idx', X(t), 0.85);
  tag('① shortest first：t=(1,10)，d=(100,10)', 'ptr alt', 0, 6.4);
  let a = bar('t=1', 0, 1, 4.6, GJ.teal), b = bar('t=10', 1, 11, 4.6, GJ.orange);
  line(X(10), 4.2, X(10), 5.2, 0, '#d64545'); tag('d=100 →', 'idx', X(11.5), 5.3);
  say('先做短的：第 2 個 11 才完成', 'd = 10 → 遲交 1');
  glow(b, RED); await gb(tok, 2600);
  const b2 = bar('t=10', 0, 10, 3.2, GJ.orange), a2 = bar('t=1', 10, 11, 3.2, GJ.teal);
  say('先做急的那個就不遲交', '短但不急的可以晚點做');
  glow(b2, GREEN); await gb(tok, 2600);
  fresh([0, 3.4, 13], [0, 2.8, 0]);
  line(X(0), 1.2, X(12), 1.2); for (let t = 0; t <= 12; t += 2) tag(String(t), 'idx', X(t), 0.85);
  tag('② smallest slack：t=(1,10)，d=(2,10)', 'ptr alt', 0, 6.4);
  say('slack = d − t：1 和 0', '先做 slack 小的第 2 個');
  await gb(tok, 2200);
  b = bar('t=10', 0, 10, 4.6, GJ.orange); a = bar('t=1', 10, 11, 4.6, GJ.teal);
  line(X(2), 4.2, X(2), 5.2, 0, '#d64545');
  glow(a, RED); tag('ℓ = 11 − 2 = 9', 'ptr', X(11), 5.4);
  say('第 1 個 11 才做完', 'max lateness = 9');
  await gb(tok, 2400);
  const a3 = bar('t=1', 0, 1, 3.2, GJ.teal), b3 = bar('t=10', 1, 11, 3.2, GJ.orange);
  tag('ℓ = 11 − 10 = 1', 'ptr', X(6), 2.5);
  say('反過來只遲交 1', '1 < 9 → slack rule 也不行');
  await gb(tok, 2400);
  cube('③ earliest deadline first ✔', GJ.teal, [5, 0.6, 0.7], 0, 0.2, 0.6, 2);
  say('剩下：deadline 最早的先做', 'earliest deadline first');
  await gb(tok, 2800);
}]);

// 58:44 EDF：依 deadline 排序，緊接著做（沒有 idle time）
FRAG.push(['grjiang1-edf-run', 'Earliest deadline first：依 d 排、緊接著做', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  line(LX(0), 1.2, LX(15), 1.2);
  for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.85);
  say('依 deadline 從小排到大', 'd = 6, 8, 9, 9, 14, 15');
  const Q = LJ.map(([t, d], i) => cube('d=' + d, GJ.paper, [1.1, 0.5, 0.5], -4.5 + i * 1.8, 6.0, 0, 1.5));
  await gb(tok, 1800);
  const pk = gPack([0, 1, 2, 3, 4, 5]);
  let L = 0; const Lt = tag('L = 0', 'ptr alt', 4.5, 4.8);
  for (let i = 0; i < 6; i++) {
    glow(Q[i], GOLD);
    const [s, f] = pk[i];
    const m = cube('J' + (i + 1), [GJ.blue, GJ.orange, GJ.teal, GJ.purple, GJ.pink, GJ.sand][i], [(f - s) * 0.8 - 0.06, 0.5, 0.6], LX((s + f) / 2), 2.2, 0, 2);
    gDead(i, 3.3 + (i % 2) * 0.6);
    const l = Math.max(0, f - LJ[i][1]); L = Math.max(L, l);
    if (l > 0) glow(m, RED);
    if (i === 0) say('一個做完馬上做下一個', '中間沒有 idle time');
    if (i === 3) say('J4：f = 10，d = 9', 'ℓ4 = 1');
    txt(Lt, 'L = ' + L);
    await gb(tok, i === 3 ? 2200 : 1100); glow(Q[i], null); tint(Q[i], GJ.gray);
  }
  say('排完：最大遲交 L = 1', '只看急不急，不管長短');
  await gb(tok, 3000);
}]);

// 60:15 觀察：一定有 optimal schedule 沒有 idle time（d = 4, 6, 12 往左壓）
FRAG.push(['grjiang1-no-idle', '有 idle 的 optimal 可以壓成沒 idle', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  const X = (t) => -6 + t;
  line(X(0), 1.2, X(12), 1.2); for (let t = 0; t <= 12; t += 2) tag(String(t), 'idx', X(t), 0.85);
  const D = [[2, 4], [3, 6], [4, 12]], S0 = [0, 3, 7];
  D.forEach(([t, d], i) => { line(X(d), 3.3, X(d), 4.3, 0, '#d64545'); tag('d=' + d, 'idx', X(d), 4.6); });
  say('一個 optimal：三個都沒遲交', 'deadline = 4、6、12');
  const B = D.map(([t], i) => cube('J' + (i + 1), [GJ.blue, GJ.orange, GJ.teal][i], [t - 0.06, 0.5, 0.6], X(S0[i] + t / 2), 2.4, 0, 2));
  await gb(tok, 2200);
  const g1 = cube('idle', GJ.paper, [0.9, 0.3, 0.3], X(2.5), 2.0, 0), g2 = cube('idle', GJ.paper, [0.9, 0.3, 0.3], X(6.5), 2.0, 0);
  say('中間有 idle time', 'L = 0');
  await gb(tok, 2200);
  fly(g1, V3(0, 5, 3)); fly(g2, V3(0, 5, 3));
  let t = 0;
  for (let i = 0; i < 3; i++) { move(B[i], X(t + D[i][0] / 2), 2.4, 0); t += D[i][0]; await gb(tok, 700); }
  say('往左壓緊，誰都只會更早完成', 'lateness 不會變大');
  await gb(tok, 2600);
  say('所以存在沒有 idle time 的 optimal', 'greedy 的 schedule 也沒有 idle');
  await gb(tok, 2800);
}]);

// 63:07 Exchange argument 與 inversion：d_j < d_i 卻 j 排在 i 後面
FRAG.push(['grjiang1-inversion-def', 'Inversion：deadline 早的反而晚做', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  line(LX(0), 1.2, LX(15), 1.2);
  for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.85);
  say('exchange argument：從 O 出發', '把不符合 greedy 的部分換掉');
  await gb(tok, 2400);
  const J = gJobs([1, 0, 2, 3, 4, 5], 2.4, 2);
  tag('某個 schedule：J2 排在 J1 前面', 'idx', 0, 5.4);
  await gb(tok, 1600);
  glow(J[0], RED); glow(J[1], RED);
  tag('d=8', 'ptr', LX(1), 3.4); tag('d=6', 'ptr', LX(3.5), 3.4);
  arrow(V3(LX(3.5), 3.9, 0), V3(LX(1), 3.9, 0), 0xd64545);
  say('J1 的 d 比較早，卻比較晚做', '這就是一個 inversion');
  await gb(tok, 2800);
  say('EDF 的 schedule 沒有 inversion', '依 d 排好就不會反過來');
  await gb(tok, 2600);
  say('接著把 O 的 inversion 逐一消掉', '證明每次都不會變差');
  await gb(tok, 2600);
}]);

// 66:00 沒 inversion、沒 idle 的 schedule 都有一樣的 max lateness（只差同 deadline 的順序）
FRAG.push(['grjiang1-same-deadline', '同 deadline 的順序不影響 L', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  line(LX(0), 0.8, LX(15), 0.8);
  for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.45);
  tag('同學甲', 'idx', -6.3, 4.4); tag('同學乙', 'idx', -6.3, 2.4);
  const A = gJobs([0, 1, 2, 3, 4, 5], 4.4, 2), B = gJobs([0, 1, 3, 2, 4, 5], 2.4, 2);
  await gb(tok, 900);
  say('兩個 schedule 都沒 inversion、沒 idle', '只差 d 相同的 J3、J4 順序');
  [A[2], A[3], B[2], B[3]].forEach((m) => glow(m, GOLD));
  await gb(tok, 2800);
  const l1 = line(LX(5), 5.0, LX(5), 1.8, 0, '#c08a1f'), l2 = line(LX(10), 5.0, LX(10), 1.8, 0, '#c08a1f');
  line(LX(9), 5.0, LX(9), 1.8, 0, '#d64545'); tag('d = 9', 'ptr', LX(9) - 0.5, 5.4);
  say('這一坨整體都在 5 到 10', '不管 J3J4 還是 J4J3');
  await gb(tok, 2600);
  glow(A[3], RED); glow(B[2], RED);
  say('最晚完成的那個決定 lateness', '兩邊都是 10 − 9 = 1');
  await gb(tok, 2600);
  say('所以這些 schedule 一樣好', 'max lateness 相同');
  await gb(tok, 2600);
}]);

// 70:16 Swap 相鄰 inversion：ℓ'_i = f_j − d_i ≤ f_j − d_j = ℓ_j，max lateness 不變差
FRAG.push(['grjiang1-swap', '交換相鄰 inversion，L 不會變大', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  const X = (t) => -5 + t * 1.1;
  line(X(0), 1.0, X(9), 1.0); for (let t = 0; t <= 9; t++) tag(String(t), 'idx', X(t), 0.65);
  const blk = (nm, s, f, y, c) => cube(nm, c, [(f - s) * 1.1 - 0.06, 0.55, 0.6], X((s + f) / 2), y, 0, 2);
  blk('其他', 0, 2, 3.6, GJ.gray);
  let I = blk('i (d=8)', 2, 5, 3.6, GJ.orange), J = blk('j (d=5)', 5, 7, 3.6, GJ.blue);
  line(X(5), 4.1, X(5), 5.0, 0, '#d64545'); tag('d_j', 'idx', X(5), 5.3);
  line(X(8), 4.1, X(8), 5.0, 0, '#d64545'); tag('d_i', 'idx', X(8), 5.3);
  say('O 裡有相鄰 inversion：i 在 j 前', 'd_j < d_i');
  await gb(tok, 2400);
  glow(J, RED); const t1 = tag('ℓ_j = 7 − 5 = 2', 'ptr', X(6), 2.7);
  say('原本 j 很晚才做完', 'ℓ_j = f_j − d_j = 2');
  await gb(tok, 2400);
  say('把 i、j swap', '只動這兩個，其他人不變');
  move(J, X(3), 3.6, 0); move(I, X(5.5), 3.6, 0); glow(J, null); kill(t1);
  await gb(tok, 1600);
  glow(J, GREEN); tag('j 提早到 4 完成', 'ptr', X(3), 2.7);
  await gb(tok, 1400);
  glow(I, GOLD); tag("ℓ'_i = 7 − 8 → 0", 'ptr', X(6.5), 2.0);
  say('i 改在原本 f_j = 7 完成', "ℓ'_i = f_j − d_i ≤ f_j − d_j = ℓ_j");
  await gb(tok, 3000);
  say('max lateness 不會變大', 'inversion 少一個，仍是 optimal');
  await gb(tok, 2800);
}]);

// 76:36 一直 swap 直到沒有 inversion → 變成 greedy 的 schedule，仍 optimal
FRAG.push(['grjiang1-fix-all', '一直 swap 到沒有 inversion = EDF', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2.6, 0]);
  line(LX(0), 1.2, LX(15), 1.2);
  for (let t = 0; t <= 15; t += 3) tag(String(t), 'idx', LX(t), 0.85);
  let ord = [1, 0, 2, 3, 5, 4];
  const M = {};
  gJobs(ord, 3.0, 2).forEach((m) => { M[m.userData.i] = m; });
  const Lt = tag('O 的 L = 1', 'ptr alt', 0, 5.8);
  say('神人給的 optimal O（已壓緊）', '裡面有 2 個 inversion');
  await gb(tok, 2600);
  const place = () => { gPack(ord).forEach(([s, f], k) => move(M[ord[k]], LX((s + f) / 2), 3.0, 0)); };
  for (const [p, q] of [[0, 1], [4, 5]]) {
    glow(M[ord[p]], RED); glow(M[ord[q]], RED);
    say('相鄰 inversion：J' + (ord[p] + 1) + ' 與 J' + (ord[q] + 1), 'd = ' + LJ[ord[p]][1] + ' > ' + LJ[ord[q]][1]);
    await gb(tok, 1800);
    [ord[p], ord[q]] = [ord[q], ord[p]]; place();
    await gb(tok, 1200);
    glow(M[ord[p]], null); glow(M[ord[q]], null);
    const L = Math.max(...gPack(ord).map(([s, f], k) => Math.max(0, f - LJ[ord[k]][1])));
    txt(Lt, 'swap 後 L = ' + L);
    say('swap 完 L 沒變差', 'L = ' + L);
    await gb(tok, 1600);
  }
  Object.values(M).forEach((m) => glow(m, GOLD));
  say('沒有 inversion 了 = greedy 的解', '所以 EDF 也是 optimal');
  await gb(tok, 3000);
}]);

// 83:00 Interval graph：一個 interval 一個 node，overlap 就連 edge；partitioning = coloring
FRAG.push(['grjiang1-interval-graph', 'Interval graph：partitioning = coloring', async (tok) => {
  fresh([0, 3.4, 13], [0, 3, 0]);
  const ax = { sc: 0.45, X: (t) => -6.6 + t * 0.45 };
  line(ax.X(0), 0.6, ax.X(11), 0.6);
  const B = IP10.map(([s, f], i) => gBar(ax, String(i + 1), s, f, 6.0 - i * 0.55, GJ.sand, 2, 0.32));
  await gb(tok, 900);
  say('每個 interval 變成一個 node', 'interval graph');
  const P = IP10.map((r, i) => { const a = Math.PI / 2 - i * 2 * Math.PI / 10; return [3.4 + 2.6 * Math.cos(a), 3.4 + 2.6 * Math.sin(a)]; });
  const N = P.map(([x, y], i) => cube(String(i + 1), GJ.sand, [0.55, 0.55, 0.55], x, y, 0, 2));
  await gb(tok, 1600);
  say('兩個 interval overlap 就連一條 edge', '1 連 2、3；2 連 1、3、4、5');
  for (let i = 0; i < 10; i++) for (let k = i + 1; k < 10; k++) if (gOv(IP10[i], IP10[k])) {
    line(P[i][0], P[i][1], P[k][0], P[k][1], -0.1, '#a99470');
    if (i < 2) { glow(N[i], GOLD); glow(N[k], GOLD); await gb(tok, 400); glow(N[k], null); }
    else await gb(tok, 120);
  }
  N.forEach((n) => glow(n, null));
  await gb(tok, 900);
  say('塗色：相鄰的 node 不同色', 'interval partitioning = coloring');
  const lbl = gPartition();
  for (let i = 0; i < 10; i++) { tint(N[i], LCOL[lbl[i]]); tint(B[i], LCOL[lbl[i]]); await gb(tok, 300); }
  await gb(tok, 900);
  say('一般 graph 的 coloring 很難', '在 interval graph 上 greedy 就解得掉');
  await gb(tok, 3000);
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
