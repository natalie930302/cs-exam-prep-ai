// 演算法 第5章：貪婪演算法 Greedy。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自本章影片（有逐字稿的一支）：
//   Abdul Bari「Greedy Method - Introduction」：A 地到 B 地（走路／腳踏車／汽車／火車／飛機）、12 小時限制 → feasible、
//     成本最小 → optimal；Algorithm Greedy(a, n) 的 Select／Feasible；選車與 1000 人徵才的層層篩選。
// 其餘影片（交大江蕙如 Lec10–14、Abdul Bari Huffman／Knapsack／Job sequencing／Optimal merge）尚無逐字稿，依課本建立，標題標「（課本）」：
//   CLRS 16.1 activity selection（11 個活動 → a1 a4 a8 a11）、16.2 fractional vs 0/1 knapsack（w 10/20/30、v 60/100/120、W 50 → 240；0/1 greedy 160 vs 220）、
//   16.3 Huffman（a45 b13 c12 d16 e9 f5 → 224）；Horowitz job sequencing（p 100 10 15 27、d 2 1 2 1 → 127）；optimal merge（20 30 10 5 30 → 205）。
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
    sceneOrder: ['feasible-optimal', 'greedy-general', 'greedy-filter', 'activity-select', 'activity-proof', 'activity-wrong-rules', 'huffman-build', 'huffman-cost', 'frac-knapsack', 'knapsack-greedy-fail', 'job-sequencing', 'optimal-merge', 'greedy-or-dp'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
