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
  function plate(x, y, w, h, color = PAPER, z = -0.05) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    t.position.set(x, y, z); t.receiveShadow = true; lab.world.add(t); return t;
  }
  // an upright DP table: cells fall into their slot; arrows show which cells a cell was computed from
  // play one table step: arrows from the cells it depends on, then the value drops in
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
    const sets = [[1, 3, 4, 6], [1, 5, 6, 10], [1, 4, 5, 8]];
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
  // ═══ grbari.js ═══
  {
// ─── Abdul Bari：Greedy 導論、3.1 Knapsack、3.2 Job sequencing、3.3 Optimal merge pattern、Huffman coding ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in each
// step comment is the transcript time where the lecturer starts saying it). Motion between steps is short;
// nothing loops or replays. Little buddies react to what happens.
// Bari 的例子：A→B 旅行（12 小時、成本最小）；選車、1000 人徵才；
//   knapsack n = 7、m = 15、P = 10 5 15 7 6 18 3、W = 2 3 5 7 1 4 1（x = 1 2/3 1 0 1 1 1）；
//   job sequencing p = 20 15 10 5 1、d = 2 2 1 3 3 → 40；第二題 p = 35 30 25 20 15 12 5、d = 3 4 4 2 3 1 2 → 110；
//   merge A = 3 8 12 20、B = 5 9 11 16；四個 list 6 5 2 3 → 40 / 32 / 31；檔案 20 30 10 5 30 → 205；
//   Huffman 訊息 BCCABBDDAECCBBAEDDCC（A3 B5 C6 D4 E2）→ 160 / 115 / 97 bits。
// 示意值：Greedy 一般演算法的 6 個 input（7 3 9 4 6 2，Select = 最大、Feasible = 總和 ≤ 15）、車子與應徵者的方塊數。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, step, buddy, prop, bob, travel, remove } = K;
const GB = { blue: '#4b9ee2', orange: '#dd8238', red: '#d64545', teal: '#2fc092', purple: '#9b7ef4', sand: '#c9b48e', paper: '#efe6d2', pink: '#e55a9b', gold: '#c08a1f', ink: '#6e5f49', gray: '#bdb3a2', cyan: '#31aab0', green: '#7cc66b' };
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ptr = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const alt = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const pal = (name, x, color = '#f4a56a', z = 1.6, size = 0.75, y = 0) => buddy(name, '', color, x, y, z, size);
const walkTo = (tok, b, x, ms = 900) => { const x0 = b.g.position.x; return anim(tok, ms, (u) => { b.g.position.x = x0 + (x - x0) * u; }); };
const gone = (...xs) => xs.flat().forEach((o) => { if (o) kill(o.g && o.mood ? o.g : o); });
// an upright bar that grows from the floor
function col(color, w, d, x, z = 0) { const m = lab.box(color, [1, 1, 1]); m.scale.set(w, 0.001, d); m.position.set(x, 0, z); lab.world.add(m); return m; }
const grow = (tok, bars, hs, ms = 1200) => anim(tok, ms, (u) => bars.forEach((m, k) => { m.scale.y = Math.max(0.001, hs[k] * u); m.position.y = (hs[k] * u) / 2; }));
// a merge tree drawn bottom-up: leaves in a row, each merge puts the parent above its two children
function mtree(leaves, o) {
  const N = leaves.map((L, k) => ({ f: L.f, x: o.x0 + k * o.dx, y: o.y0, lv: 0 }));
  N.forEach((n, k) => { n.m = cube(leaves[k].t, leaves[k].c || o.color || GB.blue, [o.w || 0.9, 0.5, 0.5], n.x, n.y, 0, o.drop || 0); });
  const T = { N, bitsL: [] };
  T.merge = (a, b, color = GB.teal) => {
    const A = N[a], B = N[b], lv = Math.max(A.lv, B.lv) + 1;
    const n = { f: A.f + B.f, x: (A.x + B.x) / 2, lv, L: a, R: b };
    n.y = o.y0 + lv * o.dy;
    n.m = cube(String(n.f), color, [0.8, 0.5, 0.5], n.x, n.y, 0, 1.2);
    n.e = [line(n.x, n.y - 0.25, A.x, A.y + 0.25, 0, GB.ink), line(n.x, n.y - 0.25, B.x, B.y + 0.25, 0, GB.ink)];
    glow(A.m, null); glow(B.m, null);
    N.push(n); return N.length - 1;
  };
  T.bits = () => N.forEach((n) => { if (n.L === undefined) return; for (const [c, b] of [[N[n.L], '0'], [N[n.R], '1']]) T.bitsL.push(alt(b, (n.x + c.x) / 2 + (b === '0' ? -0.25 : 0.25), (n.y + c.y) / 2 + 0.1, 0.3)); });
  T.pos = (i) => V3(N[i].x, N[i].y + 0.5, 0.4);
  return T;
}

// ════════ ARvQcqJ_-NY（Greedy Method - Introduction） ════════
// 00:00 Greedy 是一種策略；最佳化問題；A → B 的 feasible 與 optimal
FRAG.push(['grbari-feasible', 'A 地到 B 地：feasible 與 optimal solution', async (tok) => {
  fresh([0, 4.4, 14], [0, 3, 0]);
  await step(tok);                                   // 0.5 greedy method 是一種解題策略，像 divide and conquer
  const s1 = cube('Divide & Conquer', GB.blue, [3.2, 0.9, 0.9], -2.4, 3.6, 0, 2);
  const s2 = cube('Greedy', GB.teal, [2.2, 0.9, 0.9], 2.2, 3.6, 0, 2.5);
  const me = pal('我', -6, GB.orange, 1.8, 0.7); me.mood('happy');
  say('Greedy：一種解題策略', '就像 divide and conquer');
  await step(tok);                                   // 28.0 用來解 optimization problem：要求最小或最大
  const op = pkt('最佳化問題：要最小 or 最大的結果', 0, 5.4);
  say('Greedy 用來解最佳化問題', 'optimization problem：求 min 或 max');
  await step(tok);                                   // 53.0 問題 P：從 A 地旅行到 B 地
  gone(s1, s2, op);
  alt('A', -6, 0.2, 1.8); alt('B', 6.2, 0.2, 1.8);
  line(-5.6, 0.05, 5.8, 0.05, 1.8, GB.ink);
  await walkTo(tok, me, -4.6, 700);
  say('問題 P：從 A 地到 B 地', '這段路要怎麼走完？');
  await step(tok);                                   // 75.8 解法：走路、腳踏車、汽車、火車、飛機
  const OPT = [['走路', 7.2], ['腳踏車', 5.6], ['開車', 4.4], ['火車', 2.4], ['飛機', 1.2]];
  const xs = (k) => -4.4 + k * 2.2;
  const bars = OPT.map(([nm], k) => { ptr(nm, xs(k), -0.1, 0.9); return col(GB.blue, 1.2, 0.8, xs(k)); });
  await grow(tok, bars, OPT.map((o) => o[1]), 1400);
  OPT.forEach((o, k) => idx('solution ' + (k + 1), xs(k), o[1] + 0.35));
  say('一個問題可以有很多 solution', '柱子高度 = 要花的時間');
  await step(tok);                                   // 103.2 限制：12 小時內到
  line(-5.6, 3.6, 5.6, 3.6, 0.5, GB.red);
  const lim = bad('限制：12 小時內到', 5.0, 4.1);
  say('加上 constraint：12 小時內要到', '這是題目給的條件');
  await step(tok);                                   // 112.8 走路、開車來不及，只剩火車、飛機
  bars.forEach((m, k) => tint(m, OPT[k][1] < 3.6 ? GB.teal : GB.gray));
  me.mood('wow');
  say('走路、開車都來不及', '只剩火車、飛機做得到');
  await step(tok);                                   // 125.2 滿足條件的解 = feasible solution
  const f1 = good('feasible', xs(3), 3.1), f2 = good('feasible', xs(4), 1.9);
  me.mood('happy');
  say('滿足條件的解：feasible solution', '火車、飛機都是 feasible');
  await step(tok);                                   // 162.0 再要求成本最小 → minimization problem
  const coins = [];
  [[3, 2], [4, 6]].forEach(([k, n]) => { for (let c = 0; c < n; c++) coins.push(cube('', GB.gold, [0.5, 0.12, 0.5], xs(k) + 0.95, 0.06 + c * 0.14, 0.6, 1.2 + c * 0.2)); });
  ptr('$ 成本', xs(4) + 1.4, 1.4, 0.6);
  say('再要求「成本最少」', '這就變成 minimization problem');
  await step(tok);                                   // 193.0 火車成本最小 → optimal solution
  glow(bars[3], GREEN); remove(f1);
  const ob = alt('optimal', xs(3), 3.2);
  await me.hop(tok);
  say('feasible 又最便宜：optimal solution', '火車就是 optimal');
  await step(tok);                                   // 227.0 最佳解只有一個（最小值只有一個）
  const one = note('min 只有一個值', xs(3) - 0.2, 4.6);
  say('optimal：最小的成本只有一個', 'feasible 可以很多個');
  await step(tok);                                   // 250.7 有的問題要求最大 → 統稱 optimization problem
  remove(one); void ob; void lim; void f2;
  pkt('要求 min 或 max 的問題 = optimization problem', 0, 6.0);
  say('有的問題要最小、有的要最大', '都叫 optimization problem');
  await step(tok);                                   // 278.0 複習：feasible、optimal、optimization
  note('feasible：滿足 constraint', -3.4, 5.1); note('optimal：達成目標（min/max）', 3.0, 5.1);
  say('複習三個名詞', 'feasible、optimal、optimization problem');
}]);

// 05:08 解最佳化問題的三種策略
FRAG.push(['grbari-three', '解最佳化問題的三種策略', async (tok) => {
  fresh([0, 4.4, 14], [0, 2.8, 0]);
  await step(tok);                                   // 308.3 greedy 用來解 optimization problem
  const g = cube('Greedy', GB.teal, [2.6, 1.1, 1.1], -4.2, 2.4, 0, 3);
  pkt('最佳化問題', 0, 5.6);
  say('Greedy method：解最佳化問題', 'optimization problem');
  await step(tok);                                   // 315.7 這三種方法都用來解最佳化問題
  cube('Dynamic Programming', GB.blue, [3.4, 1.1, 1.1], 0, 2.4, 0, 3);
  cube('Branch & Bound', GB.purple, [3.0, 1.1, 1.1], 4.3, 2.4, 0, 3);
  note('板書三種（推斷）', 4.3, 3.6);
  say('解最佳化問題的三種策略', '做法不同，目的一樣');
  await step(tok);                                   // 336.7 有的題只適合一種，有的三種都能用
  const ps = [['題 1', -4.2], ['題 2', 0], ['題 3', 4.3]].map(([t, x]) => pal(t, x, GB.sand, 2.0, 0.55));
  ps.forEach((p) => p.look(0));
  ps[2].mood('happy');
  bub('三種都能用', 4.3, 1.6, 2.0);
  say('有的題目只適合其中一種', '有的題目三種都能用');
  await step(tok);                                   // 355.0 一題一題學，先從 greedy 開始
  glow(g, GOLD); ps[0].mood('wow'); await ps[0].hop(tok);
  say('之後一題一題學', '先從 greedy method 開始');
}]);

// 06:15 Greedy 的一般演算法
FRAG.push(['grbari-general', 'Greedy 一般演算法：Select、Feasible、加入解', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.2, 0]);
  const A = [7, 3, 9, 4, 6, 2], cap = 15, xs = (k) => -5.4 + k * 1.2;
  await step(tok);                                   // 375.0 greedy 的 general method：寫成一個演算法
  const cd = code(['Algorithm Greedy(a, n)', '{', '  for i = 1 to n do', '  {', '    x = Select(a);', '    if Feasible(x) then', '      Solution = Solution + x;', '  }', '}'], -3.0, 7.4, 0.48);
  say('Greedy 的 general method', '先看整體的演算法');
  await step(tok);                                   // 382.0 分成 stages，每個 stage 考慮一個 input
  const cs = A.map((v, k) => cube(v, GB.blue, [0.9, 0.6, 0.8], xs(k), 0.3, 1.2, 1.5));
  ptr('inputs a', xs(0), -0.3, 2.2);
  await beat(tok, 600);
  glow(cs[0], GOLD);
  say('分成 stages：每次考慮一個 input', 'stage by stage');
  await step(tok);                                   // 390.0 這個 input feasible 就放進 solution
  glow(cs[0], null);
  const box = cube('', '#e9dcc4', [2.4, 0.1, 1.8], 4.8, 0.05, 0);
  alt('Solution', 4.8, -0.2, 1.4);
  const sumL = ptr('總和 0（≤ 15 才 feasible）', 4.6, 4.4);
  say('如果 feasible，就放進 solution', '示意：Feasible = 總和 ≤ 15');
  await step(tok);                                   // 399.0 把所有 feasible 的 input 都放進來 → optimal
  pkt('全部 feasible 的 input → optimal solution', 0.6, 5.4, 1.2);
  say('一個個收進 feasible 的 input', '最後得到 optimal solution');
  await step(tok);                                   // 420.0 問題的 input 大小 n，放在 a 裡
  cd.hl(0);
  ptr('n = 6', xs(5) + 1.2, 0.3, 1.2);
  say('Greedy(a, n)：a 是 input、n 是個數', '這裡 n = 6');
  await step(tok);                                   // 431.5 for i = 1 to n 走過所有 input
  cd.hl(2);
  const iL = alt('i = 1', -6.2, 2.0);
  say('for i = 1 to n', '一共做 n 個 stage');
  await step(tok);                                   // 434.0 每次從 a 選一個，叫它 x
  cd.hl(4);
  const left = A.map((v, k) => ({ v, m: cs[k] })).sort((p, q) => q.v - p.v);
  const x1 = left.shift(); glow(x1.m, GOLD); move(x1.m, x1.m.position.x, 1.8, 1.2);
  say('x = Select(a)：選一個 input', '示意：Select = 挑最大的 9');
  await step(tok);                                   // 440.3 x feasible 就放進 solution（其餘 stage 照做）
  cd.hl(6);
  let sum = x1.v, h = 1;
  move(x1.m, 4.8, 0.4, 0); tint(x1.m, GB.teal); glow(x1.m, GREEN); txt(sumL, '總和 ' + sum);
  await beat(tok, 500);
  let i = 1;
  for (const x of left) {
    i++; txt(iL, 'i = ' + i);
    if (sum + x.v <= cap) { sum += x.v; move(x.m, 4.8, 0.4 + h * 0.65, 0); h++; tint(x.m, GB.teal); txt(sumL, '總和 ' + sum); }
    else { tint(x.m, GB.gray); move(x.m, x.m.position.x, 0.3, 2.8); }
    await beat(tok, 380);
  }
  cd.hl(-1); void box;
  say('Feasible 就加入解，否則丟掉', '9 + 6 = 15；其他都會超過');
}]);

// 07:35 例子：買一台最好的車
FRAG.push(['grbari-car', '選車：照自己的方法層層篩選', async (tok) => {
  fresh([0, 5.4, 14], [0, 2.4, 0]);
  const me = pal('買車的人', -6, GB.orange, 2.6, 0.7);
  await step(tok);                                   // 455.1 想買一台「最好的車」（看功能）
  bub('我要最好的車！', -6, 1.4, 2.6); me.mood('happy');
  say('例子：買一台最好的車', '「最好」是看功能（features）');
  await step(tok);                                   // 487.2 一種方法：看遍所有品牌、所有型號
  const cars = [];
  for (let k = 0; k < 40; k++) cars.push(cube('', [GB.blue, GB.purple, GB.orange, GB.pink, GB.cyan][k % 5], [0.38, 0.3, 0.6], -4.6 + (k % 10) * 0.45, 0.15, -1.2 + Math.floor(k / 10) * 0.75, 1.5));
  ptr('全世界／全市的車', -2.6, 0, 2.0);
  say('方法一：看遍所有品牌、所有型號', '全部看完再挑最好的');
  await step(tok);                                   // 509.2 這樣非常花時間
  me.mood('sad');
  bad('每一台都要看：太花時間', -2.6, 3.0);
  say('這樣非常花時間', '每個品牌、每個型號都要比');
  await step(tok);                                   // 526.4 實際做法：先篩品牌（Toyota、Hyundai）
  me.mood('calm');
  const stage = async (keep, x0, name) => {
    const alive = cars.filter((m) => m.parent);
    alive.forEach((m, k) => { if (k >= keep) fly(m, V3(0, 5, 3)); });
    alive.slice(0, keep).forEach((m, k) => move(m, x0 + (k % 5) * 0.45 - (Math.min(keep, 5) - 1) * 0.225, 0.15, Math.floor(k / 5) * 0.75 - 0.4));
    ptr(name, x0, 0, 1.6);
    await beat(tok, 900);
  };
  await stage(10, 2.2, '品牌：Toyota、Hyundai');
  say('實際上：先挑喜歡的品牌', '例如 Toyota 或 Hyundai');
  await step(tok);                                   // 545.0 再挑頂級型號
  await stage(3, 4.4, '頂級型號');
  say('在這些品牌裡，只看頂級型號', '低階型號不看');
  await step(tok);                                   // 552.0 最後挑最新、口碑好的那台
  await stage(1, 6.0, '最新、口碑好');
  const best = cars.find((m) => m.parent);
  if (best) glow(best, GREEN);
  me.mood('happy'); await me.hop(tok);
  say('最後挑最新、口碑好的那台', '對你來說就是最好的車');
  await step(tok);                                   // 568.0 你用的就是 greedy approach：自己的選擇方法
  pkt('自己的選擇方法 → 結果 = greedy approach', 0.4, 5.6);
  say('你用的方法就是 greedy approach', '照自己的選擇方法得到結果');
  await step(tok);                                   // 587.7 不用浪費時間檢查市面上每一台
  good('不用檢查每一台車', 3.6, 3.4);
  say('不必浪費時間看完所有車', '選幾台，就說這是最好的');
}]);

// 10:05 例子：1000 人應徵，錄取一人
FRAG.push(['grbari-hire', '徵人：1000 人層層篩選錄取一人', async (tok) => {
  fresh([0, 5.4, 14], [0, 2.4, 0]);
  const boss = pal('公司', 6.0, GB.purple, 2.6, 0.7);
  let ppl = [];
  const filter = async (keep, x0, name) => {
    ppl.forEach((m, k) => { if (k >= keep) fly(m, V3(0, 5, 3)); });
    ppl = ppl.slice(0, keep);
    ppl.forEach((m, k) => move(m, x0 + (k % 4) * 0.38 - 0.57, 0.23, Math.floor(k / 4) * 0.45 - 0.6));
    ptr(name, x0, 0, 1.4);
    await beat(tok, 900);
  };
  await step(tok);                                   // 605.2 開公司要徵人，1000 人來面試
  for (let k = 0; k < 48; k++) ppl.push(cube('', GB.blue, [0.3, 0.45, 0.3], -6.2 + (k % 8) * 0.38, 0.23, -1.4 + Math.floor(k / 8) * 0.45, 1.4));
  ptr('1000 人', -4.9, 0, 1.6);
  bub('登了徵才廣告', 6.0, 1.4, 2.6);
  say('開公司徵人：1000 人來應徵', '只要錄取一個人');
  await step(tok);                                   // 615.0 先筆試
  await filter(18, -2.2, '筆試');
  say('第一關：筆試（written test）', '只讓過關的人往下走');
  await step(tok);                                   // 619.5 技術測驗、團體討論…好幾關
  await filter(8, 0.4, '技術測驗');
  await filter(4, 2.6, '團體討論');
  say('再來技術測驗、團體討論', '好幾個階段一層層篩');
  await step(tok);                                   // 625.6 最後選出一人：這是最好的
  await filter(1, 4.4, '面試');
  glow(ppl[0], GREEN);
  boss.mood('happy');
  say('最後選出一個人', '說他是 1000 人裡最好的');
  await step(tok);                                   // 629.0 真的最好嗎？照你的程序，是
  const ok = good('照這套篩選程序：他就是最好的', 0.4, 3.4);
  await boss.hop(tok);
  say('他真的最好嗎？照你的程序，是', '得到的就是 optimal solution');
  await step(tok);                                   // 657.2 若每個人都考完所有關卡再挑：太耗時、太貴
  remove(ok);
  const cnt = bad('每人都考完 4 關：4000 場考試', 0.4, 4.6);
  boss.mood('sad');
  say('如果讓每個人都考完所有關卡', '1000 人 × 4 關：又慢又貴');
  await step(tok);                                   // 676.0 我們只是層層篩選：greedy approach
  remove(cnt); boss.mood('happy');
  pkt('層層篩選 → 選最好的 = greedy approach', 0.4, 4.6);
  say('實際上只做篩選，再選最好的', '這就是 greedy approach');
  await step(tok);                                   // 690.1 照已知的方法快速解題 = greedy
  good('照已知的方法，快速解題', 0.4, 3.4);
  say('照已知的選擇方法、很快解完', '這種做法就叫 greedy');
}]);

// ════════ oTTzNMHM05I（3.1 Knapsack Problem - Greedy Method） ════════
const KP = [10, 5, 15, 7, 6, 18, 3], KW = [2, 3, 5, 7, 1, 4, 1], KM = 15;
const KR = ['5', '1.67', '3', '1', '6', '4.5', '3'];
const kx = (k) => -5.6 + k * 1.45;
// 7 個物品（紙箱，高度跟重量成比例）＋ 標籤
function ksItems(y = 0.4, withTags = true) {
  return KP.map((p, k) => {
    const s = 0.55 + KW[k] * 0.07;
    const g = prop('parcel', kx(k), y, 0, s);
    const t = withTags ? [idx(String(k + 1), kx(k), y + 1.25 * s + 0.15), ptr('p ' + p, kx(k), y - 0.35, 0.6), ptr('w ' + KW[k], kx(k), y - 0.85, 0.6)] : [];
    return { g, t, k };
  });
}
// 背包：一個半透明高箱，裡面依序疊上放進去的重量
function ksBag(x = 5.6) {
  const kk = 0.3, H = KM * kk;
  const bag = lab.box('#e9dcc4', [1.6, H + 0.1, 1.3]); bag.material.transparent = true; bag.material.opacity = 0.35; bag.material.depthWrite = false;
  bag.position.set(x, H / 2, 0); lab.world.add(bag);
  ptr('knapsack m = 15', x, H + 0.5);
  const B = { x, kk, used: 0, blocks: [] };
  B.put = (w, label, color = GB.teal) => { const h = w * kk; const m = cube(label, color, [1.4, h - 0.03, 1.1], x, B.used * kk + h / 2, 0, 1.5); B.used += w; B.blocks.push(m); return m; };
  return B;
}

// 00:00 問題：7 個物品、背包容量 15、最大化 profit
FRAG.push(['grbari-ks-problem', 'Knapsack 問題：7 個物品、容量 15', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.4, 0]);
  await step(tok);                                   // 0.4 knapsack：有名的問題，greedy 可以用在這裡
  const me = pal('搬運工', -6.2, GB.orange, 2.4, 0.65); me.mood('happy');
  pkt('Knapsack problem（greedy）', 0, 5.6);
  say('Knapsack problem', '看問題、怎麼解、為什麼是 greedy');
  await step(tok);                                   // 18.6 7 個物品，每個有 profit 和 weight
  const it = ksItems(0.6);
  say('7 個物品：每個有 profit、weight', 'P = 10 5 15 7 6 18 3、W = 2 3 5 7 1 4 1');
  await step(tok);                                   // 41.0 一個背包（knapsack），容量 15 kg
  const B = ksBag(5.8); void B;
  say('背包叫 knapsack：容量 m = 15', '單位就當 kg');
  await step(tok);                                   // 70.0 把物品裝進背包，運到別處賣掉，就賺到 profit
  await walkTo(tok, me, -6.6, 400);
  bub('運過去賣掉 → 賺 profit', -6.0, 1.5, 2.4);
  say('裝進背包、運到別的地方賣', '賣掉就得到 profit');
  await step(tok);                                   // 95.1 也可以叫 container：container loading problem
  note('container loading problem', 5.8, 6.4);
  say('背包也可以叫 container', '日常的貨運就是這種問題');
  await step(tok);                                   // 114.0 總重量超過容量時，才是問題
  bad('總重 2+3+5+7+1+4+1 = 23 > 15', 0, 4.8);
  me.mood('wow');
  say('總重量比容量大，才有問題', '23 kg 裝不進 15 kg 的包');
  await step(tok);                                   // 142.5 裝出最大 profit：maximization problem
  good('目標：profit 最大', -3.6, 6.2);
  say('要讓 profit 最大', '這是最佳化中的 maximization problem');
  await step(tok);                                   // 170.1 constraint：總重量 ≤ 15
  alt('constraint：總重 ≤ 15', 2.2, 6.2);
  say('限制：裝進去的總重 ≤ 15 kg', '這是題目的 constraint');
  await step(tok);                                   // 182.0 很多解：只放一個不夠多；全放放不下（不 feasible）
  glow(it[4].g.children[0], GOLD);
  note('只放一個？profit 不是最大', kx(4), 3.4);
  me.mood('calm');
  say('只放一個？不是最大', '全部放？放不下，不 feasible');
  await step(tok);                                   // 201.1 給最大結果的那個 feasible 解 = optimal
  glow(it[4].g.children[0], null);
  pkt('feasible 中 profit 最大的 = optimal', 0, 3.6, 1.6);
  say('解很多，profit 最大的才是 optimal', '接下來看怎麼解');
}]);

// 03:29 x 介於 0..1（可以切）；選擇標準 profit / weight
FRAG.push(['grbari-ks-ratio', '可以切的物品：依 profit / weight 挑', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.4, 0]);
  const it = ksItems(0.9);
  await step(tok);                                   // 209.0 每個物品寫一個 x：放不放、放多少
  const xl = KP.map((p, k) => alt('x' + (k + 1), kx(k), -1.4, 0.6));
  say('每個物品寫一個 x', 'x 表示放不放、放多少');
  await step(tok);                                   // 230.0 x 從 0 到 1：可以只拿一部分
  pkt('0 ≤ x ≤ 1：可以拿一部分', 0, 5.4);
  say('x 可以是 0 到 1 之間', '也就是可以拿「一部分」');
  await step(tok);                                   // 245.3 這種 knapsack 的物品可以切
  const cut = cube('5 kg', GB.sand, [1.2, 0.6, 0.6], 5.4, 3.6, 0, 1.5);
  await beat(tok, 500);
  move(cut, 5.4, 3.0, 0);
  const piece = cube('2 kg', GB.green, [0.6, 0.6, 0.6], 6.4, 3.0, 0, 1.0);
  say('物品可以切：5 kg 只拿 2 kg 也行', '這版 knapsack 是 divisible objects');
  await step(tok);                                   // 262.0 例如蔬菜：馬鈴薯、番茄
  const v = bub('蔬菜：馬鈴薯 7 kg、番茄 5 kg', 5.6, 4.6);
  say('例如蔬菜', '7 kg 馬鈴薯，可以只拿 2 kg');
  await step(tok);                                   // 283.2 不是不可分的東西：攪拌機、洗衣機
  remove(v); kill(cut); kill(piece);
  bad('洗衣機不能拿一半', 5.6, 4.0);
  say('不是洗衣機這種不能切的東西', '洗衣機只能整台拿');
  await step(tok);                                   // 306.0 用什麼標準挑？profit 最高的先放？
  const a = pal('你', -6.4, GB.purple, 2.4, 0.6); a.mood('happy');
  const ba = bub('profit 最高的先放！', -6.0, 1.5, 2.4);
  glow(it[5].g.children[0], GOLD);
  say('怎麼挑？profit 最高的先放？', '18 最大，先放物品 6');
  await step(tok);                                   // 326.0 或者：先放重量小的，能裝更多個
  glow(it[5].g.children[0], null);
  const b = pal('我', 6.3, GB.cyan, 2.4, 0.6); b.mood('happy');
  bub('輕的先放，裝更多個！', 5.8, 1.5, 2.4);
  [4, 6].forEach((k) => glow(it[k].g.children[0], GOLD));
  say('還是重量小的先放？', '輕的多裝幾個，profit 也多');
  await step(tok);                                   // 357.0 正確：看 profit / weight（每 kg 賺多少）
  [4, 6].forEach((k) => glow(it[k].g.children[0], null));
  remove(ba);
  note('18 是 4 kg 的 profit，每 kg 多少？', -1.0, 4.6);
  a.mood('wow'); b.mood('wow');
  say('兩個都不對：要看 profit / weight', '每 kg 能賺多少');
  await step(tok);                                   // 387.0 算出每個物品的 profit / weight
  const rl = KR.map((r, k) => tag(r, 'val', kx(k), 2.9, 0.6));
  ptr('p / w', kx(0) - 0.9, 2.9, 0.6);
  void xl; void rl;
  say('算每個物品的 p / w', '5、1.67、3、1、6、4.5、3');
  await step(tok);                                   // 415.0 依 profit / weight 由大到小放：正確的選法
  [4, 0, 5].forEach((k) => glow(it[k].g.children[0], GREEN));
  a.mood('happy'); b.mood('happy'); await a.hop(tok);
  good('p / w 最大的先放', 0, 6.2);
  say('依 p / w 由大到小放進背包', '這就是 greedy 的選擇標準');
}]);

// 07:19 照 p/w 由大到小放：5、1、6、3、7、2（2/3）
FRAG.push(['grbari-ks-fill', 'Greedy 裝背包：依 p/w 放，最後切一塊', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.4, 0]);
  const it = ksItems(0.9);
  KR.forEach((r, k) => tag(r, 'val', kx(k), 2.9, 0.6));
  const B = ksBag(5.9);
  const xl = KP.map((p, k) => alt('x' + (k + 1) + ' = ?', kx(k), -1.4, 0.6));
  const remL = ptr('剩 15 kg', 5.9, 5.6);
  const put = async (k, take, rem, label) => {
    glow(it[k].g.children[0], GOLD);
    await travel(tok, it[k].g, it[k].g.position.clone(), V3(5.9, 5.2, 0), 700);
    kill(it[k].g);
    B.put(take, label || ('#' + (k + 1)), take < KW[k] ? GB.green : GB.teal);
    txt(remL, '剩 ' + rem + ' kg');
  };
  await step(tok);                                   // 439.0 greedy：先決定怎麼選，再一個個選
  pkt('先決定怎麼選（p / w），再一個一個選', -0.6, 5.6);
  say('Greedy：先決定選法', '再照選法一個一個放');
  await step(tok);                                   // 463.0 p/w 最大是物品 5（6）：整個放，15 − 1 = 14
  await put(4, 1, 14); txt(xl[4], 'x5 = 1');
  say('p/w 最大：物品 5（6）', '整個放：15 − 1 = 14');
  await step(tok);                                   // 486.0 下一個是物品 1：14 − 2 = 12
  await put(0, 2, 12); txt(xl[0], 'x1 = 1');
  say('下一個：物品 1（5）', '整個放：14 − 2 = 12');
  await step(tok);                                   // 500.0 第三大：物品 6，12 − 4 = 8
  await put(5, 4, 8); txt(xl[5], 'x6 = 1');
  say('第三大：物品 6（4.5）', '整個放：12 − 4 = 8');
  await step(tok);                                   // 522.4 兩個都是 3，挑物品 3：8 − 5 = 3
  await put(2, 5, 3); txt(xl[2], 'x3 = 1');
  say('兩個 p/w = 3：先挑物品 3', '別看重量，看 p/w：8 − 5 = 3');
  await step(tok);                                   // 554.2 再來物品 7：3 − 1 = 2
  await put(6, 1, 2); txt(xl[6], 'x7 = 1');
  say('物品 7（3）：1 kg', '3 − 1 = 2');
  await step(tok);                                   // 564.5 物品 2 要 3 kg，只剩 2 kg → 拿 2/3
  await put(1, 2, 0, '#2 的 2/3'); txt(xl[1], 'x2 = 2/3');
  note('3 kg 只拿 2 kg', kx(1), 2.2);
  say('物品 2 重 3 kg，只剩 2 kg', '只拿 2/3：2 − 2 = 0');
  await step(tok);                                   // 597.5 物品可切，所以拿一部分；物品 4 沒放
  txt(xl[3], 'x4 = 0');
  tint(it[3].g.children[0], GB.gray);
  say('能切，才能只拿一部分', '物品 4（p/w = 1）沒放：x4 = 0');
  await step(tok);                                   // 609.5 這就是解：哪些物品、放多少
  good('x = (1, 2/3, 1, 0, 1, 1, 1)', -0.8, 5.0);
  say('解：x = (1, 2/3, 1, 0, 1, 1, 1)', '接下來算 profit');
}]);

// 10:32 驗證：Σ xᵢwᵢ = 15、Σ xᵢpᵢ = 55.33（影片 54.6）
FRAG.push(['grbari-ks-sum', '驗算：總重 15、總 profit', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  const X = ['1', '2/3', '1', '0', '1', '1', '1'];
  X.forEach((x, k) => { alt('x' + (k + 1) + '=' + x, kx(k), 6.6); ptr('p ' + KP[k] + '  w ' + KW[k], kx(k), 6.0); });
  const B = ksBag(6.0);
  [[1, '#5'], [2, '#1'], [4, '#6'], [5, '#3'], [1, '#7']].forEach(([w, l]) => B.put(w, l));
  B.put(2, '2/3', GB.green);
  await step(tok);                                   // 632.0 總重：Σ xᵢ × wᵢ
  const wl = X.map((x, k) => tag(x + '×' + KW[k], 'val', kx(k), 4.6, 0.6));
  say('先驗算重量：Σ xᵢ × wᵢ', '每個 x 乘上它的重量');
  await step(tok);                                   // 675.0 2+2+5+0+1+4+1 = 15 ≤ 15
  ['2', '2', '5', '0', '1', '4', '1'].forEach((v, k) => txt(wl[k], v));
  good('Σ xᵢwᵢ = 15 ≤ 15', -0.8, 3.8);
  say('2+2+5+0+1+4+1 = 15', 'Σ xᵢwᵢ ≤ 15：剛好裝滿');
  await step(tok);                                   // 702.6 profit：Σ xᵢ × pᵢ
  const pl = X.map((x, k) => tag(x + '×' + KP[k], 'val', kx(k), 2.6, 0.6));
  say('再算 profit：Σ xᵢ × pᵢ', '每個 x 乘上它的 profit');
  await step(tok);                                   // 750.5 10 + 3.33 + 15 + 6 + 18 + 3 = 55.33（影片 54.6）
  ['10', '3.33', '15', '0', '6', '18', '3'].forEach((v, k) => txt(pl[k], v));
  good('Σ xᵢpᵢ = 55.33', -0.8, 1.6);
  note('影片用 1.3 算出 54.6；5/3 ≈ 1.67 → 55.33', 2.0, 0.8);
  const me = pal('', -6.4, GB.orange, 1.6, 0.6); me.mood('happy'); await me.hop(tok);
  say('總 profit 約 55.33', '影片寫 54.6：把 5/3 算成 1.3');
}]);

// 12:56 constraint 與 objective；為什麼是 greedy
FRAG.push(['grbari-ks-recap', '滿足 constraint、達成 objective', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  const B = ksBag(5.6);
  [[1, '#5'], [2, '#1'], [4, '#6'], [5, '#3'], [1, '#7']].forEach(([w, l]) => B.put(w, l));
  B.put(2, '2/3', GB.green);
  const me = pal('', -6.2, GB.orange, 1.8, 0.65);
  await step(tok);                                   // 776.0 constraint：Σ xᵢwᵢ ≤ m，已滿足 → feasible
  alt('constraint：Σ xᵢwᵢ ≤ m', -1.6, 6.0);
  good('15 ≤ 15 ✓ → feasible', -1.6, 5.2);
  say('constraint：Σ xᵢwᵢ ≤ m', '15 ≤ 15，滿足 → feasible');
  await step(tok);                                   // 811.0 objective：Σ xᵢpᵢ 最大，也達成了
  alt('objective：max Σ xᵢpᵢ', -1.6, 4.0);
  good('兩個都做到 → optimal', -1.6, 3.2);
  me.mood('happy');
  say('objective：讓 Σ xᵢpᵢ 最大', 'constraint 和 objective 都達成');
  await step(tok);                                   // 827.7 greedy 的做法：先定好選擇標準
  pkt('先定選擇標準：p / w', -1.6, 1.6, 1.0);
  say('Greedy：先決定選擇的標準', '再照標準一個一個放');
  await step(tok);                                   // 852.0 沒有一一試，但方法本身就是最好的
  bub('沒試每種組合也知道最好？', -6.0, 1.3, 1.8);
  await me.hop(tok);
  say('不用一一試所有組合', '每 kg 最值錢的先放，profit 一定最大');
}]);

// 14:37 0/1 knapsack 不一樣：不能切
FRAG.push(['grbari-ks-01', 'Fractional vs 0/1 knapsack', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.6, 0]);
  await step(tok);                                   // 877.8 還有一個 0/1 knapsack problem，不一樣
  alt('這支：fractional knapsack', -3.4, 5.8); alt('0/1 knapsack', 3.4, 5.8);
  line(0, 0, 0, 5.4, 0, GB.ink);
  say('還有 0/1 knapsack problem', '跟這支不一樣');
  await step(tok);                                   // 884.0 這裡可以拿一部分；0/1 不能切
  const c = cube('5 kg', GB.sand, [1.2, 0.6, 0.6], -3.8, 2.4, 0, 1.5);
  cube('2 kg', GB.green, [0.6, 0.6, 0.6], -2.6, 2.4, 0, 1.0);
  const wm = prop('parcel', 3.4, 1.8, 0, 1.2); void wm;
  bad('不能切', 3.4, 3.8);
  void c;
  say('這裡物品可以切一部分', '0/1 的物品不能切');
  await step(tok);                                   // 891.0 蔬菜水果 vs 不可分：整個拿或不拿
  bub('蔬菜、水果：可以分', -3.4, 1.2);
  bub('x = 0 或 1：整個拿或不拿', 3.4, 1.0);
  say('能分的貨：fractional', '0/1：整個拿或完全不拿');
}]);

// ════════ zPtI8q9gvX8（3.2 Job Sequencing with Deadlines） ════════
const J1P = [20, 15, 10, 5, 1], J1D = [2, 2, 1, 3, 3];
const J2P = [35, 30, 25, 20, 15, 12, 5], J2D = [3, 4, 4, 2, 3, 1, 2];
// 時間格：slot k 是 [k, k+1]
function jSlots(n, x0, w, y) {
  const S = { n, x0, w, y, cells: [], who: [] };
  for (let k = 0; k < n; k++) {
    const x = x0 + k * w + w / 2;
    S.cells.push(cube('', GB.paper, [w - 0.1, 0.12, 1.0], x, y, 0));
    idx(k + '–' + (k + 1), x, y - 0.4);
  }
  idx('0', x0, y + 0.4); S.X = (k) => x0 + k * w + w / 2;
  return S;
}
// 找 deadline 之前最晚的空格（從 d−1 往前）
function jFree(S, d) { for (let k = Math.min(d, S.n) - 1; k >= 0; k--) if (!S.who[k]) return k; return -1; }
function jCards(P, D, y, x0 = -5.6, dx = 1.25) {
  return P.map((p, k) => {
    const x = x0 + k * dx;
    const c = cube('J' + (k + 1), GB.blue, [1.0, 0.6, 0.6], x, y, 0, 1.2);
    return { c, x, y, t: [ptr('p ' + p, x, y - 0.6, 0.4), ptr('d ' + D[k], x, y - 1.05, 0.4)] };
  });
}
async function jPlace(tok, S, cards, k, d, ms = 700) {
  const s = jFree(S, d);
  glow(cards[k].c, GOLD);
  if (s < 0) { await beat(tok, 300); tint(cards[k].c, GB.gray); glow(cards[k].c, null); return -1; }
  S.who[s] = k + 1;
  move(cards[k].c, S.X(s), S.y + 0.4, 0);
  await beat(tok, ms);
  tint(cards[k].c, GB.teal); glow(cards[k].c, GREEN);
  return s;
}

// 00:00 問題：5 個 job、profit、deadline；每個 job 一單位時間
FRAG.push(['grbari-js-problem', 'Job sequencing：profit 與 deadline', async (tok) => {
  fresh([0, 4.4, 14], [0, 2.8, 0]);
  await step(tok);                                   // 1.7 job sequencing with deadlines，用 greedy 解
  pkt('Job sequencing with deadlines（greedy）', 0, 6.2);
  say('Job sequencing with deadlines', '用 greedy method 解');
  await step(tok);                                   // 26.2 5 個 job，完成就拿到 profit
  const ppl = J1P.map((p, k) => buddy('J' + (k + 1), p, [GB.blue, GB.purple, GB.orange, GB.pink, GB.cyan][k], -4.8 + k * 2.4, 0, 1.0, 0.75));
  idx('profit', -6.4, 0.4, 1.0);
  say('5 個 job：做完就拿到 profit', 'profit = 20 15 10 5 1');
  await step(tok);                                   // 41.0 每個 job 要在 deadline 之前做完
  const dl = J1D.map((d, k) => alt('d = ' + d, -4.8 + k * 2.4, 1.6, 1.0));
  say('每個 job 要在 deadline 前完成', 'deadline = 2 2 1 3 3');
  await step(tok);                                   // 73.0 只有一台機器，每個 job 花一單位時間
  const pc = prop('monitor', 5.6, 0, -1.4, 1.0, '一台機器');
  note('每個 job 都花 1 單位時間（1 小時）', 0, 4.6);
  say('只有一台機器：一次做一個', '每個 job 都花 1 單位時間');
  await step(tok);                                   // 109.9 例如打字行：每份文件一小時
  const typ = pal('打字員', 4.0, GB.green, -1.4, 0.6);
  void pc; void typ;
  say('想像一位打字員', '每份文件都打一小時');
  await step(tok);                                   // 138.0 早上開店，5 個人已經在排隊
  ppl.forEach((p) => p.mood('calm'));
  await ppl[0].hop(tok);
  say('早上一開店，5 個人在等', '每人都有自己的工作');
  await step(tok);                                   // 154.0 每人有自己的期限：只等 1 小時 / 願意等 3 小時
  ppl[2].mood('wow'); ppl[3].mood('happy');
  bub('第一個小時就要！', -4.8 + 2 * 2.4, 2.4, 1.0);
  bub('我能等 3 小時', -4.8 + 3 * 2.4, 2.9, 1.0);
  say('每個人的 deadline 不同', '9 點來，等到 10 點／12 點');
  await step(tok);                                   // 187.0 誰先做？deadline 最早的？
  glow(ppl[2].body, GOLD);
  say('誰先做？deadline 最早的嗎？', 'J3 只等 1 小時');
  await step(tok);                                   // 202.0 profit 最高的要先做
  glow(ppl[2].body, null); glow(ppl[0].body, GREEN); await ppl[0].hop(tok);
  say('不，profit 最高的先做', '做 J1 拿 20 比 J3 的 10 多');
  await step(tok);                                   // 208.0 挑一組能準時完成的 job，profit 最大
  void dl;
  good('目標：準時完成的 job，profit 總和最大', -0.4, 5.4);
  bad('限制：要在 deadline 前完成', -0.4, 4.6);
  say('選一組能準時做完的 job', 'profit 最大：maximization problem');
}]);

// 04:05 3 個 slot；依 profit 由大到小，放在 deadline 前最晚的空位
FRAG.push(['grbari-js-slots', '依 profit 排：J1 J2 J4 → 40', async (tok) => {
  fresh([0, 4.4, 14], [0, 2.8, 0]);
  const cards = jCards(J1P, J1D, 5.6, -5.0, 1.6);
  let S = null;
  await step(tok);                                   // 245.0 打字員有幾個小時？最晚 deadline 3
  const me = pal('打字員', -6.2, GB.green, 1.6, 0.6);
  alt('max deadline = 3', 4.6, 3.6);
  say('有幾個小時可以用？', '最晚的 deadline 是 3');
  await step(tok);                                   // 275.3 時段 0–1、1–2、2–3
  S = jSlots(3, -2.4, 1.8, 0.4);
  say('時段：0–1、1–2、2–3', '一格做一個 job');
  await step(tok);                                   // 306.3 只有 3 格 → 5 個 job 最多做 3 個
  note('9–10、10–11、11–12', 0.3, 1.6);
  say('只有 3 格 → 最多做 3 個 job', '5 個裡挑 3 個，profit 最大');
  await step(tok);                                   // 318.8 依 profit 由大到小挑
  cards.forEach((c, k) => glow(c.c, k === 0 ? GOLD : null));
  say('Greedy：依 profit 由大到小挑', '已經排好：20 15 10 5 1');
  await step(tok);                                   // 341.0 J1：d = 2，放在 1–2
  await jPlace(tok, S, cards, 0, 2);
  say('J1（20）：願意等 2 小時', '放在最晚的 1–2');
  await step(tok);                                   // 362.3 J2：d = 2，1–2 被占，往前放 0–1
  await jPlace(tok, S, cards, 1, 2);
  say('J2（15）：1–2 被占了', '往前找：放 0–1');
  await step(tok);                                   // 388.4 J3：d = 1，0–1 已滿 → 不做
  await jPlace(tok, S, cards, 2, 1);
  bad('J3 沒位子', cards[2].x, 6.6);
  say('J3（10）：只能在 0–1，已滿', 'J3 拒絕');
  await step(tok);                                   // 408.3 J4：d = 3，放 2–3
  await jPlace(tok, S, cards, 3, 3);
  say('J4（5）：d = 3', '放在 2–3');
  await step(tok);                                   // 421.7 J5：3 格都滿 → 不做
  await jPlace(tok, S, cards, 4, 3);
  say('J5（1）：沒有空格了', 'J5 拒絕');
  await step(tok);                                   // 434.8 解：J2、J1、J4；J1 J2 可以對調
  good('順序：J2 → J1 → J4（或 J1 → J2 → J4）', 0.3, 3.0);
  me.mood('happy');
  say('解：做 J1、J2、J4', 'J1、J2 都等 2 小時，可以對調');
  await step(tok);                                   // 471.0 profit = 20 + 15 + 5 = 40
  pkt('profit = 20 + 15 + 5 = 40', 0.3, 7.2);
  await me.hop(tok);
  say('總 profit：20 + 15 + 5 = 40', '');
}]);

// 08:11 用表格一步步記：考慮的 job、分到的 slot、solution、profit
FRAG.push(['grbari-js-table', '表格：每考慮一個 job 記一列', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.2, 0]);
  const hx = [-4.8, -2.0, 1.4, 4.8];
  ['考慮的 job', 'slot', 'solution', 'profit'].forEach((h, c) => alt(h, hx[c], 7.0));
  const S = jSlots(3, 2.2, 1.4, 0.3);
  const cards = J1P.map((p, k) => ({ c: cube('J' + (k + 1), GB.blue, [0.9, 0.5, 0.5], -6.0 + k * 1.05, 0.4, 0, 1.0), x: -6.0 + k * 1.05 }));
  let sol = [], prof = 0, row = 0;
  const addRow = (job, slot) => { const y = 6.3 - row * 0.62; row++; [job, slot, '{' + sol.join(', ') + '}', String(prof)].forEach((v, c) => tag(v, 'val', hx[c], y)); };
  await step(tok);                                   // 491.0 一開始什麼都沒有，profit 0
  addRow('—', '—');
  say('一開始：solution 空的，profit 0', 'slot 有 0–1、1–2、2–3');
  const go = async (k) => {
    const s = await jPlace(tok, S, cards, k, J1D[k], 600);
    if (s >= 0) { sol.push('J' + (k + 1)); prof += J1P[k]; }
    addRow('J' + (k + 1), s >= 0 ? '[' + s + ', ' + (s + 1) + ']' : '沒有');
  };
  await step(tok);                                   // 496.0 J1：d = 2 → slot [1, 2]，profit 20
  await go(0);
  say('J1：deadline 2 → slot [1, 2]', 'solution {J1}，profit 20');
  await step(tok);                                   // 531.0 J2：slot [0, 1]，profit 35
  await go(1);
  say('J2：slot [0, 1]', 'solution {J1, J2}，20 + 15 = 35');
  await step(tok);                                   // 567.3 J3：0–1 已占 → 沒有 slot
  await go(2);
  say('J3：deadline 1，0–1 已占', '不放：還是 35');
  await step(tok);                                   // 593.0 J4：slot [2, 3]，profit 40
  await go(3);
  say('J4：slot [2, 3]', 'solution {J1, J2, J4}，40');
  await step(tok);                                   // 619.5 J5：不能選，總 profit 40
  await go(4);
  good('最大 profit = 40', -2.0, 2.0);
  say('J5：沒有位子', '總 profit = 40');
}]);

// 10:37 第二題：7 個 job、最晚 deadline 4 → 110
FRAG.push(['grbari-js-ex2', '第二題：7 個 job、4 個 slot → 110', async (tok) => {
  fresh([0, 4.4, 14], [0, 2.8, 0]);
  const cards = jCards(J2P, J2D, 5.6, -5.4, 1.5);
  let S = null;
  const tot = ptr('profit 0', 4.6, 3.4);
  let P = 0;
  const go = async (k) => { const s = await jPlace(tok, S, cards, k, J2D[k]); if (s >= 0) { P += J2P[k]; txt(tot, 'profit ' + P); } return s; };
  await step(tok);                                   // 637.0 再一題：依 profit 由大到小挑
  say('再一題：7 個 job', '一樣依 profit 由大到小挑');
  await step(tok);                                   // 655.0 最晚 deadline 4 → 4 個 slot
  S = jSlots(4, -3.6, 1.8, 0.4);
  alt('max deadline = 4 → 4 格', -0.0, 1.6);
  say('最晚 deadline 4', '所以有 4 個 slot');
  await step(tok);                                   // 690.0 J1：d = 3 → 2–3，35
  await go(0);
  say('J1（35）：d = 3', '放 2–3');
  await step(tok);                                   // 707.7 J2：d = 4 → 3–4，30
  await go(1);
  say('J2（30）：d = 4', '放 3–4');
  await step(tok);                                   // 715.4 J3：d = 4，3–4 被占，往前放 1–2
  await go(2);
  say('J3（25）：3–4、2–3 都被占', '往前放 1–2');
  await step(tok);                                   // 734.1 可以提早做：願意等 4 小時不代表一定最後才做
  const nb = note('願意等 4 小時，也可以提早做', -0.6, 2.6);
  say('願意等，也可以提早做', '後面的時段已經給別人了');
  await step(tok);                                   // 757.0 J4：d = 2，1–2 被占 → 0–1，20
  remove(nb);
  await go(3);
  say('J4（20）：d = 2，1–2 被占', '往前放 0–1');
  await step(tok);                                   // 772.2 J5、J6、J7：格子都滿了，不用檢查
  for (const k of [4, 5, 6]) { tint(cards[k].c, GB.gray); }
  bad('格子全滿：J5、J6、J7 不做', 1.6, 7.0);
  say('4 格全滿', 'J5、J6、J7 不用檢查了');
  await step(tok);                                   // 789.0 總 profit = 110
  good('35 + 30 + 25 + 20 = 110', -0.4, 3.4);
  say('總 profit = 110', '35 + 30 + 25 + 20');
}]);

// ════════ HHIc5JZyenI（3.3 Optimal Merge Pattern） ════════
// 00:00 合併兩個已排序的 list：A = 3 8 12 20、B = 5 9 11 16
FRAG.push(['grbari-om-merge2', '合併兩個排序好的 list：m + n', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  const A = [3, 8, 12, 20], B = [5, 9, 11, 16];
  await step(tok);                                   // 0.0 optimal merge pattern：greedy，也是 Huffman 的基礎
  pkt('Optimal merge pattern（greedy）→ Huffman coding', 0, 6.4);
  say('Optimal merge pattern', '學會它，就能懂 Huffman coding');
  await step(tok);                                   // 18.0 先懂 merging：兩個 list A、B
  const ma = A.map((v, k) => cube(v, GB.blue, [0.8, 0.6, 0.6], -5.4 + k * 0.95, 4.2, 0, 1.2));
  const mb = B.map((v, k) => cube(v, GB.purple, [0.8, 0.6, 0.6], 2.6 + k * 0.95, 4.2, 0, 1.2));
  alt('A', -6.4, 4.2); alt('B', 1.6, 4.2);
  say('先了解 merging', '兩個 list：A 和 B');
  await step(tok);                                   // 30.0 兩個已排序的 list 合成第三個排序 list
  for (let k = 0; k < 8; k++) cube('', GB.paper, [0.8, 0.1, 0.6], -3.3 + k * 0.95, 1.0, 0);
  alt('C（合併結果）', -4.6, 1.0);
  say('兩個都已排序', '合成一個新的排序 list');
  await step(tok);                                   // 38.0 比較兩邊第一個，小的寫下來：3
  const all = [...A.map((v, k) => [v, ma[k]]), ...B.map((v, k) => [v, mb[k]])].sort((p, q) => p[0] - q[0]);
  glow(ma[0], GOLD); glow(mb[0], GOLD);
  await beat(tok, 500);
  move(all[0][1], -3.3, 1.5, 0); glow(ma[0], null);
  say('比較兩邊第一個：3 和 5', '3 比較小，寫下來');
  await step(tok);                                   // 49.0 5、8、9、11、12、16、20 一個一個寫下
  for (let k = 1; k < 8; k++) { glow(mb[0], null); move(all[k][1], -3.3 + k * 0.95, 1.5, 0); await beat(tok, 300); }
  say('再比下一對：5、8、9、11…', '每次寫下比較小的那個');
  await step(tok);                                   // 72.0 每次兩邊各比一個 → 一個排序好的 list
  good('得到一個排序好的 list', 0.3, 3.0);
  say('兩邊各拿一個比，小的先寫', '最後得到一個 sorted list');
  await step(tok);                                   // 77.4 只有排序好的 list 才能這樣 merge
  note('前提：兩個 list 都排序好', 0.3, 5.4);
  say('merging 只能用在排序好的 list', '');
  await step(tok);                                   // 80.5 時間 m + n：4 + 4 = 8 個元素
  pkt('時間 = m + n = 4 + 4 = 8', 0.3, -0.2, 1.0);
  say('花多少時間？m + n', '4 個 + 4 個 = 8 個元素');
  await step(tok);                                   // 98.1 時間取決於 list 的大小
  say('合併時間取決於 list 的大小', '下面就用「大小」當成本');
}]);

// 01:43 四個 list 6 5 2 3：三種合併順序 40、32、31
FRAG.push(['grbari-om-patterns', '6 5 2 3：合併順序不同，成本 40 / 32 / 31', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 2.6, 0]);
  const L = [['A', 6], ['B', 5], ['C', 2], ['D', 3]];
  const mk = (cx) => mtree(L.map(([n, f]) => ({ t: n + ':' + f, f })), { x0: cx - 1.35, dx: 0.9, y0: 0.4, dy: 1.15, w: 0.8, drop: 1.2 });
  let T1 = null, T2 = null, T3 = null, c1;
  await step(tok);                                   // 103.3 超過兩個 list：4 個 list，大小 6 5 2 3
  T1 = mk(-4.6);
  say('4 個 list，大小 6、5、2、3', '只看大小，不看元素');
  await step(tok);                                   // 121.0 可以四路合併；但這裡只做兩兩合併
  note('一次只合併兩個（two-way merging）', 0, 6.4);
  say('一次只合併兩個 list', 'two-way merging');
  await step(tok);                                   // 137.3 順序一：先 6 + 5 = 11
  const a = T1.merge(0, 1);
  say('照順序合併：6 + 5 = 11', '');
  await step(tok);                                   // 147.0 11 + 2 = 13
  const b = T1.merge(a, 2);
  say('11 + 2 = 13', '');
  await step(tok);                                   // 153.0 13 + 3 = 16
  T1.merge(b, 3);
  say('13 + 3 = 16', '最後得到 16 個元素');
  await step(tok);                                   // 163.0 成本 = 11 + 13 + 16 = 40
  c1 = alt('11 + 13 + 16 = 40', -4.6, 5.1);
  say('總成本：11 + 13 + 16 = 40', '每一次合併都要花時間');
  await step(tok);                                   // 185.2 換一種：6+5、2+3、再合 → 11 + 5 + 16
  T2 = mk(0);
  const p = T2.merge(0, 1), q = T2.merge(2, 3); T2.merge(p, q);
  say('換一種：6+5=11、2+3=5', '再 11 + 5 = 16');
  await step(tok);                                   // 213.0 成本 32
  alt('11 + 5 + 16 = 32', 0, 5.1);
  say('總成本：11 + 5 + 16 = 32', '比 40 少');
  await step(tok);                                   // 231.0 從另一邊：2+3=5、5+5=10、10+6=16
  T3 = mk(4.6);
  const r = T3.merge(2, 3), s = T3.merge(1, r); T3.merge(0, s);
  say('從右邊開始：2+3=5、5+5=10', '再 10 + 6 = 16');
  await step(tok);                                   // 248.4 成本 5 + 10 + 16 = 31
  const c3 = good('5 + 10 + 16 = 31', 4.6, 5.1);
  say('總成本：5 + 10 + 16 = 31', '又更少了');
  await step(tok);                                   // 265.0 31 最小：每次都挑兩個最小的
  void c1; void c3; void T1; void T2;
  glow(T3.N[2].m, GOLD); glow(T3.N[3].m, GOLD);
  say('31 最小：每次都挑最小的兩個', '6 被留到最後才合併');
  await step(tok);                                   // 285.0 greedy：每次合併最小的一對
  pkt('Greedy：每次合併最小的兩個 list', 0, 6.4, 0.6);
  say('Greedy 方法：每次合併最小的一對', '總合併時間最少');
}]);

// 05:20 例題：x1..x5 = 20 30 10 5 30 → 205
FRAG.push(['grbari-om-example', '5 個檔案 20 30 10 5 30：合併成 95', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 2.8, 0]);
  const F = [['x1', 20], ['x2', 30], ['x3', 10], ['x4', 5], ['x5', 30]];
  let raw = [], T = null, rem = null;
  await step(tok);                                   // 320.0 5 個檔案 x1..x5 和它們的大小
  raw = F.map(([n, f], k) => cube(n + ':' + f, GB.blue, [1.1, 0.5, 0.5], -4.4 + k * 2.2, 5.6, 0, 1.2));
  say('5 個檔案 x1～x5', '大小 20、30、10、5、30');
  await step(tok);                                   // 343.0 找總成本最小的合併方式；每次挑最小的一對
  pkt('每次挑最小的兩個合併', 0, 7.0);
  say('目標：總合併成本最小', 'Greedy：每次挑最小的一對');
  await step(tok);                                   // 356.0 先依大小排成遞增：5 10 20 30 30
  raw.forEach(kill);
  T = mtree([['x4', 5], ['x3', 10], ['x1', 20], ['x2', 30], ['x5', 30]].map(([n, f]) => ({ t: n + ':' + f, f })), { x0: -4.4, dx: 2.2, y0: 0.4, dy: 1.25, w: 1.1, drop: 1.0 });
  rem = ptr('剩下：5 10 20 30 30', 4.6, 6.0);
  say('先依大小排好', '5、10、20、30、30');
  await step(tok);                                   // 367.0 5 + 10 = 15
  glow(T.N[0].m, GOLD); glow(T.N[1].m, GOLD); await beat(tok, 400);
  const a = T.merge(0, 1); txt(rem, '剩下：15 20 30 30');
  say('最小兩個：5 + 10 = 15', '得到一個 15 的新檔案');
  await step(tok);                                   // 387.0 15 + 20 = 35
  glow(T.N[a].m, GOLD); glow(T.N[2].m, GOLD); await beat(tok, 400);
  const b = T.merge(a, 2); txt(rem, '剩下：35 30 30');
  say('15、20 最小：15 + 20 = 35', '');
  await step(tok);                                   // 411.0 35 30 30 → 30 + 30 = 60
  glow(T.N[3].m, GOLD); glow(T.N[4].m, GOLD); await beat(tok, 400);
  const c = T.merge(3, 4); txt(rem, '剩下：35 60');
  say('35、30、30：挑兩個 30', '30 + 30 = 60');
  await step(tok);                                   // 427.0 35 + 60 = 95
  T.merge(b, c); txt(rem, '合併完成：95');
  say('最後 35 + 60 = 95', '全部合成一個檔案');
}]);

// 07:16 總成本：內部節點相加 = Σ dᵢ xᵢ = 205
FRAG.push(['grbari-om-cost', '總成本 205：內部節點和 = Σ 距離 × 大小', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 2.8, 0]);
  const T = mtree([['x4', 5], ['x3', 10], ['x1', 20], ['x2', 30], ['x5', 30]].map(([n, f]) => ({ t: n + ':' + f, f })), { x0: -4.8, dx: 2.0, y0: 0.4, dy: 1.25, w: 1.1 });
  const a = T.merge(0, 1), b = T.merge(a, 2), c = T.merge(3, 4), d = T.merge(b, c);
  const sumL = ptr('總成本 = ?', 4.8, 6.2);
  await step(tok);                                   // 436.0 總成本：每次合併的大小 15、35、60、95
  [a, b, c, d].forEach((i) => glow(T.N[i].m, GOLD));
  txt(sumL, '15 + 35 + 60 + 95');
  say('每次合併的成本：15、35、60、95', '就是圓圈（內部節點）裡的數字');
  await step(tok);                                   // 469.0 內部節點相加 = 205
  txt(sumL, '15 + 35 + 60 + 95 = 205');
  good('內部節點加總 = 205', 4.8, 5.4);
  say('內部節點加起來：205', '這就是最小的合併總成本');
  await step(tok);                                   // 474.0 另一種算法：5 被合併了幾次？3 次
  [a, b, c, d].forEach((i) => glow(T.N[i].m, null));
  glow(T.N[0].m, GOLD);
  const dd = [3, 3, 2, 2, 2];
  T.N.slice(0, 5).forEach((n, k) => idx('d = ' + dd[k], n.x, -0.3));
  say('換個算法：5 被合併了幾次？', '從根走到它：距離 3');
  await step(tok);                                   // 490.0 5×3 + 10×3 + 20×2 + 30×2 + 30×2
  glow(T.N[0].m, null);
  const fl = alt('5×3 + 10×3 + 20×2 + 30×2 + 30×2', 0, 7.0);
  say('每個檔案：大小 × 距離', '5×3 + 10×3 + 20×2 + 30×2 + 30×2');
  await step(tok);                                   // 519.0 也是 205：Σ dᵢ × xᵢ
  txt(fl, '15 + 30 + 40 + 60 + 60 = 205');
  pkt('總成本 = Σ dᵢ × xᵢ', 4.8, 4.6);
  say('一樣是 205', '公式：Σ dᵢ × xᵢ（外部節點）');
  await step(tok);                                   // 563.0 問題很簡單，但 Huffman coding 會用到
  bub('下一支：Huffman coding', -4.8, 5.2);
  say('Huffman coding 會用到它', '下一支影片');
}]);

// ════════ co4_ahEDCho（Huffman Coding - Greedy Method） ════════
const HMSG = 'BCCABBDDAECCBBAEDDCC';
const HC = { A: '001', B: '10', C: '11', D: '01', E: '000' };
const HF = [['E', 2], ['A', 3], ['D', 4], ['B', 5], ['C', 6]];
function hMsg(y, show = true) { return HMSG.split('').map((ch, k) => cube(show ? ch : '', GB.paper, [0.5, 0.5, 0.4], -5.7 + k * 0.6, y, 0)); }
// Bari 的 Huffman tree（葉子依次數排：E2 A3 D4 B5 C6）
function hTree(o = {}) {
  const T = mtree(HF.map(([c, f]) => ({ t: c + ':' + f, f })), Object.assign({ x0: -3.2, dx: 1.6, y0: 0.4, dy: 1.3, w: 1.0 }, o));
  T.build = () => { const ea = T.merge(0, 1), n9 = T.merge(ea, 2), n11 = T.merge(3, 4); T.merge(n9, n11); return T; };
  return T;
}

// 00:00 壓縮；20 個字元用 ASCII：160 bits
FRAG.push(['grbari-hf-ascii', '20 個字元用 ASCII：160 bits', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  await step(tok);                                   // 1.0 Huffman coding：壓縮技術，減少資料大小
  const f = prop('file', -4.6, 2.6, 0, 1.6);
  const me = pal('', -6.2, GB.orange, 1.6, 0.6); me.mood('happy');
  pkt('Huffman coding = 壓縮', 0, 6.4);
  say('Huffman coding：一種壓縮技術', '讓資料或訊息變小');
  await step(tok);                                   // 12.0 存檔變小、網路傳送成本變低
  const pc = prop('disk', -1.6, 2.6, 0, 1.0);
  const net = bub('網路傳送：越小越便宜', 3.2, 4.4);
  say('存成檔案：檔案變小', '網路傳送：傳輸成本變低');
  await step(tok);                                   // 27.3 比較：一般訊息、fixed size、variable size
  gone(f, pc, net);
  ['一般（ASCII）', 'fixed size code', 'variable size（Huffman）'].forEach((t, k) => alt(t, -4.2 + k * 4.2, 6.0));
  say('先看一般訊息要多少 bits', '再看 fixed size、variable size');
  await step(tok);                                   // 41.0 這是一則訊息
  const ms = hMsg(4.4);
  say('一則訊息：要存檔或傳出去', 'BCCABBDDAECCBBAEDDCC');
  await step(tok);                                   // 57.0 大小用 bits 計算；長度 20
  idx('長度 20', 6.4, 4.4);
  say('訊息大小用 bits 算', '一共 20 個字元');
  await step(tok);                                   // 71.8 用 ASCII code 傳送：每個字元 8 bits
  note('電腦用 ASCII code：每個字元 8 bits', 0, 3.2);
  say('電腦用 ASCII code 表示字元', '每個字元 8 bits');
  await step(tok);                                   // 95.3 A = 65 = 01000001、B = 66 …
  ['A = 65 = 01000001', 'B = 66 = 01000010', 'C = 67', 'D = 68', 'E = 69'].forEach((t, k) => ptr(t, -4.0 + (k % 3) * 4.0, 1.8 - Math.floor(k / 3) * 0.7));
  say('A 的 ASCII 是 65', '二進位 01000001：8 個 bits');
  await step(tok);                                   // 141.0 8 × 20 = 160 bits
  ms.forEach((m) => tint(m, GB.sand));
  good('8 × 20 = 160 bits', 0, 0.2, 1.0);
  await me.hop(tok);
  say('20 個字元 × 8 bits', '訊息大小 160 bits');
}]);

// 02:42 自己定 3-bit 的 fixed size code：60 + 表格 55 = 115
FRAG.push(['grbari-hf-fixed', 'Fixed size code：60 + 55 = 115 bits', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  const ms = hMsg(6.2);
  await step(tok);                                   // 169.1 可以用自己的 code，不用 ASCII？只有 5 個字母
  const only5 = note('只用到 A～E 五個字母', 0, 7.0);
  say('能不能不用 ASCII，用自己的 code？', '只有 5 個字母，不需要 8 bits');
  await step(tok);                                   // 212.0 每個字母出現幾次：A3 B5 C6 D4 E2
  const cnt = [['A', 3], ['B', 5], ['C', 6], ['D', 4], ['E', 2]];
  cnt.forEach(([c, n], k) => { ptr(c, -5.6, 4.9 - k * 0.7); cube(n, GB.blue, [0.6, 0.45, 0.4], -4.7, 4.9 - k * 0.7, 0, 1.0); });
  ms.forEach((m, k) => { if (HMSG[k] === 'A') glow(m, GOLD); });
  idx('count', -4.7, 5.6);
  say('數每個字母出現幾次', 'A 3、B 5、C 6、D 4、E 2，共 20');
  await step(tok);                                   // 249.3 要幾個 bit？1 bit 只能表示 2 個
  ms.forEach((m) => glow(m, null));
  const bl = alt('1 bit：0、1 → 2 個', 1.6, 4.9);
  say('code 要幾個 bit？', '1 bit：0 或 1，只能表示 2 個');
  await step(tok);                                   // 275.0 2 bits：00 01 10 11 → 4 個，不夠
  txt(bl, '2 bits：00 01 10 11 → 4 個，不夠 5 個');
  say('2 bits：4 種組合', '還是不夠 5 個字母');
  await step(tok);                                   // 288.0 3 bits：8 種，取 5 個：A 000 … E 100
  txt(bl, '3 bits：8 種，取 5 個');
  const FX = ['000', '001', '010', '011', '100'];
  const codes = cnt.map(([c], k) => cube(FX[k], GB.teal, [0.9, 0.45, 0.4], -3.5, 4.9 - k * 0.7, 0, 1.2));
  void codes;
  say('3 bits：8 種組合，取 5 個', 'A 000、B 001、C 010、D 011、E 100');
  await step(tok);                                   // 331.0 用這些 code 編碼：B 寫 001、C 寫 010 …
  // 3-bit codes are wider than letters: the message re-flows into two rows of 10
  remove(only5);
  ms.forEach((m, k) => { relabel(m, ['000', '001', '010', '011', '100']['ABCDE'.indexOf(HMSG[k])]); tint(m, GB.teal); m.scale.x = 2; move(m, -5.6 + (k % 10) * 1.24, k < 10 ? 7.1 : 6.25, 0); });
  say('照表編碼：B → 001、C → 010…', '每個字母都換成 3 bits');
  await step(tok);                                   // 342.1 訊息大小 20 × 3 = 60 bits
  good('訊息：20 × 3 = 60 bits', 2.6, 1.2);
  say('訊息只剩 20 × 3 = 60 bits', '');
  await step(tok);                                   // 359.9 但接收的人怎麼知道 code？要附上表格
  const rc = pal('接收者', 6.2, GB.purple, 1.6, 0.6); rc.mood('wow');
  bub('000 是誰？', 6.0, 1.5, 1.6);
  say('接收的人怎麼知道哪個 code 是誰？', '要把 code 表一起送過去');
  await step(tok);                                   // 414.0 表格：5 × 8 = 40 + 5 × 3 = 15 → 55
  alt('表格：字母 5 × 8 = 40', 2.0, 3.6); alt('code 5 × 3 = 15', 2.0, 2.9);
  say('表格：5 個字母的 ASCII 5 × 8 = 40', '再加 5 個 code × 3 = 15，共 55');
  await step(tok);                                   // 468.0 總共 60 + 55 = 115（從 160 降約 35–40%）
  rc.mood('happy');
  pkt('60 + 55 = 115 bits（原本 160）', 0, 0.2, 1.2);
  say('訊息 + 表格 = 115 bits', '從 160 降到 115');
}]);

// 08:36 Huffman：依次數排序，照 optimal merge pattern 建樹；左 0 右 1
FRAG.push(['grbari-hf-tree', 'Huffman tree：每次合併次數最小的兩個', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.0, 0]);
  let T = null;
  await step(tok);                                   // 516.7 variable size code：Huffman coding
  alt('variable size code', 0, 7.2);
  say('改用 variable size code', 'Huffman coding：還能再變小');
  await step(tok);                                   // 531.0 出現多的字母給短 code
  bub('出現多 → code 短；出現少 → code 長', 0, 6.3);
  say('出現次數多的字母，給它短 code', '整則訊息就會變小');
  await step(tok);                                   // 550.0 照次數，用 optimal merge pattern
  pkt('跟 optimal merge pattern 一樣做', 0, 5.4);
  say('Huffman 用的就是 optimal merge pattern', '把次數當成大小');
  await step(tok);                                   // 577.8 依次數遞增排好：E2 A3 D4 B5 C6
  T = hTree({ drop: 1.2 });
  say('依次數由小到大排', 'E 2、A 3、D 4、B 5、C 6');
  await step(tok);                                   // 595.0 合併最小兩個：2 + 3 = 5
  glow(T.N[0].m, GOLD); glow(T.N[1].m, GOLD); await beat(tok, 400);
  const ea = T.merge(0, 1);
  say('最小兩個：E 2 + A 3 = 5', '做成一個新節點');
  await step(tok);                                   // 606.3 剩 5 4 5 6：取 4 和 5 → 9
  glow(T.N[2].m, GOLD); glow(T.N[ea].m, GOLD); await beat(tok, 400);
  const n9 = T.merge(ea, 2);
  say('剩 5、4、5、6：挑 4 和 5', '有兩個 5，任選一個：9');
  await step(tok);                                   // 624.0 剩 9 5 6：5 + 6 = 11
  glow(T.N[3].m, GOLD); glow(T.N[4].m, GOLD); await beat(tok, 400);
  const n11 = T.merge(3, 4);
  say('剩 9、5、6：5 + 6 = 11', '');
  await step(tok);                                   // 634.2 最後 9 + 11 = 20
  T.merge(n9, n11);
  say('最後 9 + 11 = 20', '20 就是訊息長度');
  await step(tok);                                   // 641.6 這就是 optimal merge pattern 的樹（greedy）
  good('每次挑最小的兩個 = greedy', 4.6, 5.4);
  say('得到 optimal merge pattern 的樹', '每次挑最小兩個：greedy');
  await step(tok);                                   // 658.3 左邊的邊標 0、右邊標 1
  T.bits();
  say('左邊的邊標 0，右邊的邊標 1', '');
  await step(tok);                                   // 672.8 從 root 走到字母：A 001、B 10、C 11、D 01、E 000
  const ord = ['E', 'A', 'D', 'B', 'C'];
  ord.forEach((c, k) => tag(HC[c], 'val', T.N[k].x, -0.35, 0.4));
  const hand = alt('▼', T.N[8].x, T.N[8].y + 0.7);
  await travel(tok, hand, hand.position.clone(), V3(T.N[1].x, T.N[1].y + 0.7, 0), 1200);
  say('從 root 走到字母，把 0/1 串起來', 'A 001、B 10、C 11、D 01、E 000');
}]);

// 11:44 Huffman 後的大小：訊息 45 + 表格 52 = 97
FRAG.push(['grbari-hf-size', 'Huffman：45 + 52 = 97 bits', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.0, 0]);
  const rows = [['A', 3], ['B', 5], ['C', 6], ['D', 4], ['E', 2]];
  rows.forEach(([c, n], k) => { ptr(c, -5.8, 5.8 - k * 0.75); cube(n, GB.blue, [0.6, 0.45, 0.4], -4.9, 5.8 - k * 0.75, 0); cube(HC[c], GB.teal, [0.9, 0.45, 0.4], -3.7, 5.8 - k * 0.75, 0); });
  idx('count', -4.9, 6.5); idx('code', -3.7, 6.5);
  const pr = [];
  await step(tok);                                   // 704.0 variable size：有的 3 bits、有的 2 bits
  note('A、E 3 bits；B、C、D 2 bits', 1.4, 6.6);
  say('code 長短不一：variable size', '有的 3 bits、有的 2 bits');
  await step(tok);                                   // 719.5 用新 code 編碼：B 10、C 11、C 11、A 001 …
  const ms = HMSG.slice(0, 8).split('').map((ch, k) => cube(HC[ch], GB.teal, [0.62, 0.45, 0.4], -1.4 + k * 0.72, 4.8, 0, 1.0));
  idx('B C C A B B D D …', 1.1, 4.2); void ms;
  say('照新 code 編碼', 'B 10、C 11、C 11、A 001…');
  await step(tok);                                   // 743.9 A：3 bits × 3 次 = 9
  pr.push(ptr('A：3 × 3 = 9', -1.0, 3.2));
  say('算大小：A 的 code 3 bits', '出現 3 次：3 × 3 = 9');
  await step(tok);                                   // 756.1 B 5×2=10、C 6×2=12、D 4×2=8、E 2×3=6
  ['B：5 × 2 = 10', 'C：6 × 2 = 12', 'D：4 × 2 = 8', 'E：2 × 3 = 6'].forEach((t, k) => pr.push(ptr(t, -1.0 + ((k + 1) % 3) * 2.8, 3.2 - Math.floor((k + 1) / 3) * 0.7)));
  say('B 10、C 12、D 8、E 6', '次數 × code 長度');
  await step(tok);                                   // 778.0 合計 45 bits
  good('訊息 = 45 bits', 1.6, 1.6);
  say('加起來：訊息只要 45 bits', '');
  await step(tok);                                   // 804.0 還要附上表格（或樹）才能解碼
  const rc = pal('接收者', 6.2, GB.purple, 1.6, 0.6); rc.mood('wow');
  bub('要有表格才能解碼', 6.0, 1.5, 1.6);
  say('一樣要附上 code 表（或樹）', '才能解碼');
  await step(tok);                                   // 836.0 表格：5 × 8 = 40 + code 共 12 bits = 52
  alt('表格：5 × 8 = 40 + code 3+2+2+2+3 = 12 → 52', 0.6, 0.6, 1.0);
  say('表格：40 + 12 = 52 bits', 'code 本身共 12 bits');
  await step(tok);                                   // 881.6 總共 45 + 52 = 97（比 fixed 的 115 還小）
  rc.mood('happy'); await rc.hop(tok);
  pkt('45 + 52 = 97 bits（fixed 115、ASCII 160）', 0.6, -0.4, 1.4);
  say('總共 45 + 52 = 97 bits', '比 fixed size 的 115 更小');
}]);

// 15:00 從樹直接算大小：Σ dᵢ × fᵢ
FRAG.push(['grbari-hf-formula', '從樹算大小：Σ 距離 × 次數 = 45', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.0, 0]);
  const T = hTree().build(); T.bits();
  const dd = [3, 3, 2, 2, 2];
  await step(tok);                                   // 902.6 也能從樹算出 45：距離 × 次數
  T.N.slice(0, 5).forEach((n, k) => idx('d = ' + dd[k], n.x, -0.35));
  glow(T.N[0].m, GOLD);
  say('也能直接從樹算訊息大小', 'E 的距離 3，次數 2：3 × 2');
  await step(tok);                                   // 918.0 Σ dᵢ × fᵢ = 3×2 + 3×3 + 2×4 + 2×5 + 2×6
  glow(T.N[0].m, null);
  const fl = alt('3×2 + 3×3 + 2×4 + 2×5 + 2×6', 0, 7.0);
  say('每個字母：距離 × 次數，再加總', 'Σ dᵢ × fᵢ');
  await step(tok);                                   // 947.0 = 45，跟前面一樣；optimal merge 的公式
  txt(fl, '6 + 9 + 8 + 10 + 12 = 45');
  good('= 45 bits，跟剛剛一樣', 4.4, 5.6);
  say('結果 45：跟前面算的一樣', '就是 optimal merge pattern 的公式');
}]);

// 16:07 解碼：從 root 照 bit 走，到葉子就輸出
FRAG.push(['grbari-hf-decode', '解碼：照 bit 從 root 走到葉子', async (tok) => {
  fresh([0, 4.0, 14.5], [0, 3.0, 0]);
  const T = hTree({ y0: 0.2 }).build(); T.bits();
  const bits = '001' + '11' + '11' + '01';
  const bl = alt('收到：' + bits.split('').join(' ') + ' …', 0, 7.2);
  const outL = ptr('輸出：', 4.8, 6.3);
  const tk = cube('', GB.orange, [0.32, 0.32, 0.32], T.N[8].x, T.N[8].y + 0.6, 0.4);
  let out = '';
  const walk = async (path) => {
    let n = 8;
    for (const b of path) { n = b === '0' ? T.N[n].L : T.N[n].R; move(tk, T.N[n].x, T.N[n].y + 0.6, 0.4); await beat(tok, 380); }
    glow(T.N[n].m, GREEN); out += HF[n][0]; txt(outL, '輸出：' + out);
    await beat(tok, 300); move(tk, T.N[8].x, T.N[8].y + 0.6, 0.4); glow(T.N[n].m, null);
  };
  await step(tok);                                   // 967.0 解碼：收到一串 bits，手上要有樹
  void bl;
  say('解碼：收到的是一串 bits', '手上一定要有這棵樹');
  await step(tok);                                   // 982.4 從 root：0 左、0 左、1 右 → 到葉子
  await walk('001');
  say('從 root：0 左、0 左、1 右', '走到葉子就輸出它（這棵樹是 A）');
  await step(tok);                                   // 995.3 回到 root：1 右、1 右 → C
  await walk('11');
  say('回到 root：1 右、1 右', '到葉子 C');
  await step(tok);                                   // 1005.0 再一次 1、1 → C
  await walk('11');
  say('再從 root：1、1', '又是 C');
  await step(tok);                                   // 1010.0 0 左、1 右 → D
  await walk('01');
  say('0 左、1 右', '到葉子 D');
  await step(tok);                                   // 1018.0 這樣就能解回原本的字元（ASCII）
  good('一路解碼，換回 ASCII 字元', -3.2, 5.6);
  say('照這樣就能解出整則訊息', '再換回 ASCII，像解壓縮 zip');
}]);
  }

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
  glow(A[3], RED); glow(B[3], RED);
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
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, step, buddy, prop, bob, travel, remove } = K;
// ─── 交大江蕙如 Lec12（yWZHGsd06dA）：證明策略、Dijkstra（procedure、小例子、loop invariant 證明、CLRS 例子）
// ─── 交大江蕙如 Lec13（trkaH2uLxHw）：Dijkstra 實作、priority queue、Heap（insert／pop／heapify／build／heapsort）、MST 定義
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in each
// step comment is the transcript time where the lecturer starts saying it). Motion between steps is short;
// nothing loops or replays. Each section has its own scene (the Lec12 / Lec13 retellings are separate scenes).
const J2 = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', exp: '#2fc092', dim: '#e4dccb', bad: '#d64545', blue: '#4b9ee2', gray: '#cfc6b4', ok: '#2fc092', ice: '#bfe3f5', pink: '#e55a9b' };
const j2Cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
const j2F = (d) => (d === Infinity ? '∞' : String(d));
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a little character that walks (x, y) in ms
async function walk(tok, b, x, y, ms = 700) {
  const a = b.g.position.clone();
  await anim(tok, ms, (u) => b.g.position.set(a.x + (x - a.x) * u, a.y + (y - a.y) * u, a.z));
}
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

// ── complete-binary-tree Heap view: tree on top, array row at the bottom
const HX = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return -5.6 + (i - c + 0.5) * 11.2 / c; };
const HY = (i) => 6.0 - Math.floor(Math.log2(i)) * 1.35;
const AX = (i) => -5.9 + i * 1.12;
function j2Heap(vals, o = {}) {
  const H = { A: [null, ...vals], T: [null], R: [null], n: o.n === undefined ? vals.length : o.n, lines: [], idx: [], swaps: 0 };
  const cap = o.cap || vals.length;
  if (o.zero) { H.z0 = cube('', J2.gray, [0.9, 0.55, 0.55], AX(0), 0.4, 0); H.idx.push(tag('0', 'idx', AX(0), -0.3)); }
  for (let i = 1; i <= cap; i++) {
    if (o.cells !== false) H.idx.push(tag(String(i), 'idx', AX(i), -0.3));
    if (i > vals.length) { cube('', '#ece4d2', [0.9, 0.55, 0.55], AX(i), 0.4, -0.2); continue; }
    const c = i <= H.n ? J2.blue : J2.gray;
    H.R[i] = o.noRow ? null : cube(vals[i - 1], c, [0.9, 0.55, 0.55], AX(i), 0.4, 0, o.drop || 0);
    H.T[i] = i <= H.n || o.keepTree ? cube(vals[i - 1], c, [0.8, 0.7, 0.6], HX(i), HY(i), 0, o.drop || 0) : null;
  }
  H.edges = () => { H.lines.forEach(kill); H.lines = []; for (let i = 2; i <= H.n; i++) H.lines.push(line(HX(i >> 1), HY(i >> 1) - 0.35, HX(i), HY(i) + 0.35, -0.1)); };
  H.edges();
  H.place = (i) => { if (H.T[i]) move(H.T[i], HX(i), HY(i), 0); if (H.R[i]) move(H.R[i], AX(i), 0.4, 0); };
  H.swap = (i, j) => { [H.A[i], H.A[j]] = [H.A[j], H.A[i]]; [H.T[i], H.T[j]] = [H.T[j], H.T[i]]; [H.R[i], H.R[j]] = [H.R[j], H.R[i]]; H.place(i); H.place(j); H.swaps++; };
  H.hi = (i, c) => { if (H.T[i]) glow(H.T[i], c); if (H.R[i]) glow(H.R[i], c); };
  H.tint = (i, c) => { if (H.T[i]) tint(H.T[i], c); if (H.R[i]) tint(H.R[i], c); };
  H.unhi = () => { for (let i = 1; i < H.A.length; i++) H.hi(i, null); };
  H.big = (i) => { const l = 2 * i, r = l + 1; let m = i; if (l <= H.n && H.A[l] > H.A[m]) m = l; if (r <= H.n && H.A[r] > H.A[m]) m = r; return m; };
  // one sift-down swap at i (returns the new index, or 0 when i is already fine)
  H.down = (i) => { const m = H.big(i); if (m === i) return 0; H.swap(i, m); return m; };
  // quiet sift-down from i with short motion beats
  H.sink = async (tok, i, ms = 350) => { for (let m = H.down(i); m; m = H.down(m)) await beat(tok, ms); };
  return H;
}

// ═════════════ Lec12（yWZHGsd06dA） ═════════════

// 00:47 回顧：證明 greedy 最佳的兩招
FRAG.push(['grjiang2-proof-strategies', '證明 greedy 最佳的兩招：stays ahead 與 exchange argument', async (tok) => {
  fresh([0, 3.6, 14], [0, 3.2, 0]);
  const g = buddy('greedy', '', '#7cd1a8', -5.6, 0, 1.4, 0.75);
  const ch = [3, 7, 5].map((v, k) => cube(v, J2.node, [0.8, 0.7, 0.6], -3.4 + k * 1.2, 0.35, 0.6));
  await step(tok);                                   // 47 每一步選當下看到最好的解
  glow(ch[1], GOLD); g.look(0.7); g.mood('happy');
  say('Greedy：每一步選當下看起來最好的', '');
  await step(tok);                                   // 53 要靠設計好的 criterion
  const cr = note('criterion：怎樣才叫「最好」？', -2.2, 1.7, 0.6);
  say('「最好」靠一把設計好的尺：criterion', 'criterion 需要特別設計');
  await step(tok);                                   // 70 能證明 property → optimal
  fly(ch[0]); fly(ch[2]); txt(cr, 'criterion 設計對了 → optimal');
  await g.hop(tok);
  say('若能證明 criterion 的 property', 'greedy 就能到達 optimal solution');
  await step(tok);                                   // 88 第一招 stays ahead
  kill(ch[1]); remove(cr);
  tag('第一招：greedy stays ahead', 'ptr alt', -3.6, 6.9);
  tag('greedy', 'ptr', -6.2, 5.6); tag('其他解', 'ptr', -6.2, 3.9);
  const gv = [1, 2, 3, 4, 5], qv = [1, 1, 2, 3, 4], gb = [], qb = [];
  for (let k = 0; k < 5; k++) {
    const x = -4.8 + k * 0.95;
    gb.push(cube('', J2.exp, [0.7, 0.01, 0.5], x, 4.9, 0)); qb.push(cube('', J2.blue, [0.7, 0.01, 0.5], x, 3.2, 0));
  }
  say('第一招：greedy stays ahead', '證明每一步都不落後於其他解');
  await step(tok);                                   // 104 每一步都超越，一路領先
  await anim(tok, 2000, (u) => {
    for (let k = 0; k < 5; k++) {
      const s = Math.max(0, Math.min(1, u * 5 - k));
      gb[k].scale.y = 1 + s * gv[k] * 32; gb[k].position.y = 4.9 + gb[k].scale.y * 0.005;
      qb[k].scale.y = 1 + s * qv[k] * 32; qb[k].position.y = 3.2 + qb[k].scale.y * 0.005;
    }
  });
  g.mood('happy');
  say('每一步都領先，最後也不會輸', '（柱高為示意）');
  await step(tok);                                   // 111 第二招 exchange argument
  tag('第二招：exchange argument', 'ptr alt', 3.4, 6.9);
  const smart = buddy('高手', '', '#9fb8ff', 6.2, 0, 1.4, 0.7);
  say('第二招：exchange argument（交換法）', '證明 greedy 時最常用');
  await step(tok);                                   // 133 有人先得到 optimal solution
  const ok = [true, false, true, false, true], opt = [];
  for (let k = 0; k < 5; k++) opt.push(cube('O' + (k + 1), J2.blue, [1.0, 0.7, 0.7], 0.9 + k * 1.15, 4.6, 0, 2));
  note('高手用別的方法找到的 optimal', 3.2, 5.6);
  smart.mood('happy'); smart.look(-0.6);
  say('先假設有個高手找到 optimal solution', '但他用的是別的方法');
  await step(tok);                                   // 145 勢必有部分不符合 greedy rule
  for (let k = 0; k < 5; k++) if (!ok[k]) { tint(opt[k], J2.bad); glow(opt[k], RED); }
  say('它裡面一定有部分不符合 greedy rule', '紅色 = 不是 greedy 會選的');
  await step(tok);                                   // 164 挑出來砍掉
  for (const k of [1, 3]) fly(opt[k]);
  smart.mood('wow');
  say('把不符合的部分挑出來、砍掉', '');
  await step(tok);                                   // 171.6 換成 greedy 選的貼回去
  for (const k of [1, 3]) opt[k] = cube('G' + (k + 1), J2.exp, [1.0, 0.7, 0.7], 0.9 + k * 1.15, 4.6, 0, 2.2);
  g.mood('happy');
  say('換成 greedy 選的，貼回去', '砍掉 + 貼回 = 一次交換');
  await step(tok);                                   // 189 要件一：仍然 feasible
  good('① 仍是 feasible（合理的解）', 3.4, 3.1);
  say('每次交換要證：解仍然 feasible', '第一要件');
  await step(tok);                                   // 196 要件二：quality 不變差
  good('② solution quality 不變差', 3.4, 2.3);
  say('第二要件：品質不會變差', '');
  await step(tok);                                   // 219 原本是最佳解，改了又沒損失
  for (const m of opt) glow(m, GOLD);
  say('原本就是最佳解，交換又沒損失品質', '所以交換後還是最佳解');
  await step(tok);                                   // 224 改成 greedy 的解也是 optimal
  for (const m of opt) { tint(m, J2.exp); glow(m, GREEN); }
  smart.mood('happy'); await g.hop(tok);
  say('一路換完 = greedy 的解，也是 optimal', '證明完成');
}]);

// 11:11 single-source shortest path 問題
FRAG.push(['grjiang2-sssp-def', 'Single-source shortest path：輸入、目標、路徑長度', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let G = null;
  await step(tok);                                   // 671 input：directed graph
  G = j2Graph(J2S_P, J2S_E, { drop: 2 });
  for (const e of G.E) showL(e.lb, false);
  say('Input：一個 directed graph', 'edge 有方向（箭頭）');
  await step(tok);                                   // 686 undirected = 兩個方向
  const two = note('undirected 的一條線 = 兩個方向的箭頭', 0, -0.9);
  say('undirected graph 怎麼辦？', '一條 edge 想成兩個方向各一條');
  await step(tok);                                   // 716 edge 有 weight
  remove(two);
  for (const e of G.E) { showL(e.lb, true); j2Cls(e.lb, 'ptr'); }
  say('這次 edge 上有 weight（比重）', '在 shortest path 裡代表距離');
  await step(tok);                                   // 739 點 = 地點、edge = 一段路
  for (const e of G.E) j2Cls(e.lb, 'idx');
  for (const k of Object.keys(G.N)) { const h = prop('warehouse', G.P[k][0] + 0.75, G.P[k][1] - 0.4, -0.9, 0.35); bob(h, 0.03); }
  say('點 = 地點或 building，edge = 一小段路', '數字 = 兩地之間的距離');
  await step(tok);                                   // 763 也可以是時間、機票錢
  const alt = bub('也可以是：開車時間、機票錢…', 0, 7.2);
  say('weight 也可以換成時間或 cost', '例如兩個城市間的機票錢');
  await step(tok);                                   // 799 給定起點 source s
  remove(alt);
  glow(G.N.s, GOLD); txt(G.D.s, 'source s');
  const me = buddy('', '', '#f4a56a', -5.2, 1.6, 0.9, 0.55);
  say('再給定一個起點 source s', 'single-source shortest path（SSSP）');
  await step(tok);                                   // 816 目標：到剩下所有點的最短距離
  for (const k of ['u', 'v', 'x', 'y', 'z']) { glow(G.N[k], GOLD); txt(G.D[k], '最短？'); await beat(tok, 250); }
  me.look(1);
  say('目標：s 到「剩下所有點」的最短距離', '');
  await step(tok);                                   // 839 path 長度 = edge 總和
  for (const k of ['u', 'v', 'x', 'y', 'z']) { glow(G.N[k], null); txt(G.D[k], ''); }
  const path = [['s', 'u'], ['u', 'x'], ['x', 'y']];
  for (const [a, b] of path) G.e(a, b).set(J2.hot);
  for (const [, b] of path) await walk(tok, me, G.P[b][0], G.P[b][1] - 1.4, 550);
  txt(G.D.y, '1 + 1 + 1 = 3');
  say('路徑長度 = 經過的 edge 長度加起來', 's→u→x→y：1 + 1 + 1 = 3');
  await step(tok);                                   // 864 只給起點、不限終點
  for (const e of G.E) e.set(J2.edge);
  txt(G.D.y, '');
  await walk(tok, me, -5.2, 1.6, 700);
  const q = bub('終點呢？', -4.0, 1.8, 1.2);
  me.mood('wow');
  say('奇怪：只給起點，沒給終點', '平常用地圖都是有起點有終點');
  await step(tok);                                   // 896 Dijkstra 一次算出到所有點
  remove(q); me.mood('happy');
  for (const k of ['u', 'v', 'x', 'y', 'z']) glow(G.N[k], GREEN);
  say('因為 Dijkstra 能一次算出到所有點', '所以問題乾脆不給終點');
}]);

// 15:52 Dijkstra 的 procedure：集合 S 與 d 值
FRAG.push(['grjiang2-dijkstra-procedure', 'Dijkstra 的 procedure：S 集合、d 值、每輪選最近的新點', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.2, 0]);
  const dj = buddy('Dijkstra', '', '#f4a56a', 5.8, 3.6, 0.6, 0.7);
  let cd = null, S = null, Sl = null;
  await step(tok);                                   // 953 基本精神是 greedy
  dj.mood('happy');
  say('Dijkstra\'s algorithm：本質是 greedy', '做起來非常簡單');
  await step(tok);                                   // 966 input：directed graph 與長度 ℓ
  cd = code(['Dijkstra(G, ℓ)', '1 S = {s}; d(s) = 0', '2 while S ≠ V', "3   選 v ∉ S 使 d'(v) 最小", "4   d'(v) = min (d(u) + ℓ(u,v)), u∈S", "5   S = S ∪ {v}; d(v) = d'(v)"], -3.4, 6.8, 0.52);
  cd.hl(0);
  say('Input：directed graph G 與長度 ℓ', 'ℓ(e) = 每條 edge 的長度');
  await step(tok);                                   // 980 要 maintain：S 集合
  S = ghostBox(J2.pink, 2.2, 2.0, 0.6); S.position.set(-4.4, 1.2, 0);
  Sl = tag('S', 'ptr', -4.4, 2.5);
  say('要 maintain 兩樣東西：第一，集合 S', '');
  await step(tok);                                   // 987 S = 已算好最短距離的點
  txt(Sl, 'S：已算好最短距離的點');
  say('S 裡放：已算好「從 s 出發最短距離」的點', '');
  await step(tok);                                   // 1005 所有點都進 S → 結束
  cd.hl(2);
  const end = note('所有點都進 S → 結束', 3.0, 2.6);
  say('最後所有點都放進 S，algorithm 就結束', '');
  await step(tok);                                   // 1019 每個點有 d 值
  remove(end);
  const dd = tag('每個點都有一個 d 值', 'ptr alt', 3.0, 2.6);
  say('第二：每個點 maintain 一個 d 值', 'd = 從 source 到它的最短距離');
  await step(tok);                                   // 1067 s 到 s 是 0
  const s = cube('s', J2.exp, [0.7, 0.7, 0.7], -4.8, 1.2, 0, 1.5);
  const ds = tag('d=0', 'ptr alt', -4.8, 0.3);
  remove(dd);
  say('一開始就知道：s 到 s 是 0 距離', '站在起點，自己到自己');
  await step(tok);                                   // 1082 先把 s 放進 S、d(s) = 0
  cd.hl(1); glow(s, GREEN);
  say('所以一開始 S = {s}，d(s) = 0', '第 1 行');
  await step(tok);                                   // 1109 每輪從 S 往外找最近的新點
  const u = cube('u', J2.exp, [0.7, 0.7, 0.7], -3.8, 1.2, 0, 1.5); tag('d=1', 'ptr alt', -3.8, 0.3);
  const cands = [['a', 1.4, 3.4, 'd(u)+ℓ = 1+4 = 5', -3.4], ['b', 1.4, 1.2, 'd(s)+ℓ = 0+2 = 2', -4.4], ['c', 1.4, -1.0, 'd(u)+ℓ = 1+3 = 4', -3.4]];
  const cm = [], ar = [], fm = [];
  for (const [k, x, y, , fx] of cands) {
    cm.push(cube(k, J2.node, [0.7, 0.7, 0.7], x, y, 0, 1.2));
    ar.push(arrow(V3(fx, 1.2, 0), V3(x - 0.45, y, 0), J2.hot));
  }
  note('（假設 u 已在 S，d(u) = 1）', -4.2, -0.6);
  say('每個 iteration：從 S 往外看', '找能 reach 到、最近的新點');
  await step(tok);                                   // 1130 找到最近的，走過去放進 S
  const qs = cands.map(([, x, y]) => bub('多遠？', x + 1.1, y + 0.3));
  dj.look(-1);
  say('找到最近的那個新點，就走過去', '放進 S，它的 d 就確定了');
  await step(tok);                                   // 1157 第 3、4 行最複雜
  cd.hl(3);
  say('最複雜的是第 3、4 行', '其實是同一句話，拆開來看');
  await step(tok);                                   // 1197 加一個括號：是一整項
  cd.hl(4);
  const par = note('(d(u) + ℓ(u,v)) 加括號：是一整項', 2.2, 4.4);
  say('第 4 行請加括號：d(u) + ℓ(u,v) 是一項', '對這一項取 min');
  await step(tok);                                   // 1205 S 的點 d 已知 + 一條 edge
  qs.forEach(remove); remove(par);
  cands.forEach(([, x, y, f]) => fm.push(tag(f, 'idx', x + 2.3, y)));
  say('S 裡點的 d 已確定，再加一條 edge 長度', '加起來最小的那個');
  await step(tok);                                   // 1238.5 選出來的叫 v
  glow(cm[1], GOLD); relabel(cm[1], 'v');
  say('最小的是 2：把它選出來，叫它 v', '');
  await step(tok);                                   // 1253 v 放進 S，d(v) 定案
  cd.hl(5);
  ar.forEach(kill); fm.forEach(remove);
  tint(cm[1], J2.exp); glow(cm[1], null); move(cm[1], -2.8, 1.2, 0);
  tag('d=2', 'ptr alt', -2.8, 0.3);
  await anim(tok, 700, (t) => { S.scale.x = 1 + t * 0.5; S.position.x = -4.4 + t * 0.55; });
  say('v 放進 S，d(v) = 剛算出的 2', '放進 S 後不再改變');
  await step(tok);                                   // 1267 重複到全部算完或走不下去
  cd.hl(2); dj.mood('happy'); await dj.hop(tok);
  say('一直重複，到所有點都進 S', '或 s 再也走不下去就停');
  void ds;
}]);

// 21:29 小例子 step by step
FRAG.push(['grjiang2-dijkstra-small', 'Dijkstra 小例子：s→u→v→x→y→z 由近到遠', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2S_P, J2S_E);
  const Sl = tag('S = { }', 'ptr alt', -3.6, -0.7);
  const inS = [];
  const setS = () => txt(Sl, 'S = { ' + inS.join(', ') + ' }');
  const me = buddy('', '', '#f4a56a', -5.2, 1.6, 0.9, 0.5);
  const at = (k) => walk(tok, me, G.P[k][0], G.P[k][1] - 1.4, 650);
  const dP = (k, v) => { txt(G.D[k], "d'=" + v); glow(G.N[k], GOLD); };
  const put = async (k, d, from) => {
    for (const kk of Object.keys(G.N)) glow(G.N[kk], null);
    for (const e of G.E) if (!e.tree) e.set(J2.edge);
    const e = G.e(from, k); e.tree = true; e.set(J2.tree);
    j2Explore(G, k); txt(G.D[k], 'd=' + d); inS.push(k); setS();
    await at(k);
  };
  await step(tok);                                   // 1294 directed graph、source、距離已給
  glow(G.N.s, GOLD);
  say('Directed graph，source 是 s', '每條 edge 的距離都已給定');
  await step(tok);                                   // 1310 d(s) = 0
  glow(G.N.s, null); j2Explore(G, 's'); txt(G.D.s, 'd=0'); inS.push('s'); setS();
  say('s 到 s 是 0：d(s) = 0', 'S = {s}');
  await step(tok);                                   // 1325 往外看到 u、v、x
  for (const k of ['u', 'v', 'x']) G.e('s', k).set(J2.hot);
  me.look(1);
  say('從 s 往外看：看得到 u、v、x', '因為有 edge 連過去');
  await step(tok);                                   // 1342 0+1 到 u
  dP('u', '0+1=1');
  say('到 u：0 + 1 = 1', '');
  await step(tok);                                   // 1347 0+4 到 x、0+2 到 v
  dP('x', '0+4=4'); dP('v', '0+2=2');
  say('到 x：0 + 4 = 4，到 v：0 + 2 = 2', '');
  await step(tok);                                   // 1356 1、2、4 誰最近？
  const q = bub('1、2、4 誰最近？', -3.2, 2.2, 1.2);
  say('1、2、4：誰最近？', '');
  await step(tok);                                   // 1364 選 u，走過去
  remove(q);
  await put('u', 1, 's');
  say('選最小的 1：走到 u', 'd(u) = 1 定案');
  await step(tok);                                   // 1371 S 長大：{s, u}
  const pinkS = ghostBox(J2.pink, 4.4, 6.2, 0.9); pinkS.position.set(-3.6, 3.0, 0);
  pinkS.scale.y = 0.6; pinkS.position.y = 4.2;
  say('S 長大了：S = {s, u}', '');
  await step(tok);                                   // 1388 再長到 v
  dP('v', 2); await beat(tok, 300);
  await put('v', 2, 's');
  pinkS.scale.y = 1; pinkS.position.y = 3.0;
  say('依此類推：下一個長到 v', 'd(v) = 2');
  await step(tok);                                   // 1395 粉紅色 = 這三個點已確認
  glow(G.N.s, GREEN); glow(G.N.u, GREEN); glow(G.N.v, GREEN);
  say('粉紅色區 = S：這三個點的最短距離已確認', '剩下的人怎麼繼續 explore？');
  await step(tok);                                   // 1418 x：1 + 1 = 2
  for (const k of ['s', 'u', 'v']) glow(G.N[k], null);
  G.e('u', 'x').set(J2.hot); dP('x', '1+1=2');
  say("x：經過 u，1 + 1 = 2", "d'(x) = 2");
  await step(tok);                                   // 1426 y：1 + 3 = 4
  G.e('u', 'y').set(J2.hot); dP('y', '1+3=4');
  say("y：1 + 3 = 4", '');
  await step(tok);                                   // 1435 z：2 + 3 = 5
  G.e('v', 'z').set(J2.hot); dP('z', '2+3=5');
  say("z：經過 v，2 + 3 = 5", '目前看起來：2、4、5');
  await step(tok);                                   // 1453 最近的 x 走過去
  await put('x', 2, 'u');
  pinkS.scale.x = 1.45; pinkS.position.x = -2.6;
  say('最近的是 x：走過去，放進 S', '');
  await step(tok);                                   // 1466 d(x) = 2 不再改變
  glow(G.N.x, GREEN);
  const fz = note('放進 S 就不會再變', 1.2, 1.9);
  say('d(x) = 2 確認：放進 S 就不再改變', '');
  await step(tok);                                   // 1493 經過 x：y 2+1 = 3
  remove(fz); glow(G.N.x, null);
  G.e('x', 'y').set(J2.hot); dP('y', '2+1=3');
  say('經過 x 可以更近：y = 2 + 1 = 3', '比 4 小 → 暫時改成 3');
  await step(tok);                                   // 1512.7 z：2+2 = 4 < 5
  G.e('x', 'z').set(J2.hot); dP('z', '2+2=4');
  say('z：2 + 2 = 4，比原來的 5 小', '也往下降');
  await step(tok);                                   // 1519 3 < 4 → 放 y
  await put('y', 3, 'x');
  say('3 跟 4 比，3 比較小 → 放 y', 'd(y) = 3');
  await step(tok);                                   // 1528 最後放 z，結束
  await put('z', 4, 'x');
  pinkS.scale.x = 2.6; pinkS.position.x = -0.1;
  me.mood('happy');
  say('最後放 z，procedure 結束', 'd = 0、1、2、2、3、4');
}]);

// 25:47 觀察：d 值從 ∞ 只降不升；explore 順序 d 遞增；實作難點
FRAG.push(['grjiang2-dijkstra-observe', 'Dijkstra 的觀察：d 只降不升、由近到遠、第 3、4 行要快', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const hgt = (d) => (d === Infinity ? 5.0 : Math.max(0.05, d * 1.0));
  const mk = (name, x, d, c) => {
    tag(name, 'ptr', x, -0.4);
    const b = cube('', c, [1.0, 1, 0.7], x, 0, 0); b.scale.y = hgt(d); b.position.y = hgt(d) / 2;
    return { b, l: tag(j2F(d), 'ptr alt', x, hgt(d) + 0.4) };
  };
  const to = async (bar, d) => {
    const { b, l } = bar, from = b.scale.y, t = hgt(d);
    await anim(tok, 450, (u) => { b.scale.y = from + (t - from) * u; b.position.y = b.scale.y / 2; l.position.y = b.scale.y + 0.4; });
    txt(l, j2F(d));
  };
  let bars = [];
  await step(tok);                                   // 1547 一開始只確定 s 是 0
  const s = mk('s', -5.6, 0, J2.exp);
  say('一開始只確定：s 到 s 是 0', '');
  await step(tok);                                   // 1556 其他人像 ∞
  bars = [mk('x', -4.0, Infinity, J2.blue), mk('y', -2.6, Infinity, J2.blue), mk('z', -1.2, Infinity, J2.blue)];
  say('剩下的人還不確定：想成 ∞', '');
  await step(tok);                                   // 1563 d 值不斷下降
  await to(bars[0], 4); await to(bars[0], 2); await to(bars[1], 4); await to(bars[2], 5);
  say('運算過程中 d 值會不斷下降', 'x：經 s 是 4、經 u 降到 2；y 4、z 5');
  await step(tok);                                   // 1572 新 explore 的點帶來更近的走法
  await to(bars[1], 3); await to(bars[2], 4);
  say('新 explore 的點帶來更近的走法', '經過 x：y 降到 3、z 降到 4');
  await step(tok);                                   // 1589 放進 S 就 freeze
  for (const { b } of [s, ...bars]) tint(b, J2.ice);
  note('降到最短距離 → freeze', -3.2, 6.2);
  say('降到真正的最短距離後就不再改變', '放進 S 就 freeze');
  await step(tok);                                   // 1598 為什麼叫 greedy
  line(0.8, 0.3, 6.8, 0.3, 0, '#6e5f49');
  tag('距離 →', 'idx', 6.4, -0.3);
  say('為什麼叫 greedy？看它 explore 的順序', '');
  await step(tok);                                   // 1629 d 小的先、d 大的後
  const ord = [['s', 0], ['u', 1], ['v', 2], ['x', 2], ['y', 3], ['z', 4]];
  for (let k = 0; k < ord.length; k++) {
    const [n, d] = ord[k], x = 1.1 + d * 1.3;
    cube(n, J2.exp, [0.6, 0.6, 0.6], x, 0.7 + (k === 3 ? 0.7 : 0), 0, 1.2);
    tag(String(d), 'idx', x, -0.1);
    await beat(tok, 300);
  }
  say('d 值由小到大：從近的走到遠的', '這就是 greedy 的想法');
  await step(tok);                                   // 1657 寫程式的困難在第 3、4 行
  const cd = code(["3 選 v ∉ S 使 d'(v) 最小", "4 d'(v) = min (d(u) + ℓ(u,v))"], 0.6, 6.6, 0.55);
  cd.hl(0);
  const dev = buddy('寫程式的人', '', '#9fb8ff', 5.8, 2.2, 0.8, 0.6);
  dev.mood('wow');
  say('真的寫程式時，難在第 3、4 行', '需要特別的 data structure 配合');
  await step(tok);                                   // 1678 要知道 S 有誰
  note('① 要知道 S 裡已經有誰', 2.6, 4.9);
  say('第一：要隨時知道 S 裡有哪些人', '');
  await step(tok);                                   // 1689 每輪選出最近的點
  cd.hl(1);
  note('② 每輪找出距離最近的點', 2.6, 4.2);
  say('第二：每一輪要選出目前最近的點', '這個點要怎麼找？');
  await step(tok);                                   // 1704 每個 S 點都往外 reach 一次 → 很慢
  for (let k = 0; k < 5; k++) arrow(V3(3.4, 3.1, 0.3), V3(4.2 + k * 0.5, 3.6 - (k % 2) * 0.7, 0.3), 0xd64545);
  bad('照字面：S 每個點都往外 reach 一次 → 很慢', 2.6, 2.6);
  dev.mood('sad');
  say('照字面：S 裡每個點都要往外看一次', '每輪 checking 很複雜');
  await step(tok);                                   // 1730 希望 take minimum 很快
  pkt('希望：take minimum 一下就好', 2.6, 1.6);
  dev.mood('happy');
  say('希望第 3、4 行取 min 可以很快', '怎麼做？證明完再回來看');
}]);

// 29:21 正確性：loop invariant + induction on |S|
FRAG.push(['grjiang2-loop-invariant', 'Dijkstra 正確性：loop invariant 與對 |S| 做 induction', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const dj = buddy('Dijkstra', '', '#f4a56a', -6.0, 4.4, 0.6, 0.6);
  const ord = [['s', 0], ['u', 1], ['v', 2], ['x', 2], ['y', 3], ['z', 4]];
  const NX = (k) => -4.2 + k * 1.8;
  let box = null, kl = null; const ns = [];
  const fit = (k) => { const w = 1.4 + (k - 1) * 1.8; box.scale.x = w / 1.4; box.position.x = NX(0) - 0.7 + w / 2; txt(kl, '|S| = ' + k); };
  await step(tok);                                   // 1761 要證明它是對的
  const q = bub('我算的真的對嗎？', -4.6, 6.0, 0.6);
  say('Procedure 有了，接著要證明它是對的', '');
  await step(tok);                                   // 1766 final d 就是最短距離
  remove(q);
  tag('要證：每個點最後的 d = s 到它的最短距離', 'ptr alt', 0.6, 6.6);
  say('要證：每點最後的 d 一定是最短距離', '');
  await step(tok);                                   // 1785 兩招，這裡用 stays ahead
  note('兩招：交換法、stays ahead → 這次用 stays ahead', 0.6, 5.9);
  say('證明有兩招：這裡用 greedy stays ahead', '');
  await step(tok);                                   // 1797 有一個 while loop
  const cd = code(['while S ≠ V', '  選最近的 v', '  S = S ∪ {v}'], -1.6, 4.9, 0.5);
  cd.hl(0);
  say('Procedure 裡有一個 while loop', '');
  await step(tok);                                   // 1845 loop invariant
  const li = pkt('loop invariant：每一圈都不變的性質', 3.6, 4.4);
  say('iterative 的 procedure：證 loop invariant', 'loop 每一圈都保持的 property');
  await step(tok);                                   // 1884 S 裡每個點的 d 已確定
  txt(li, 'invariant：S 裡每點的 d 都已是最短距離');
  say('這裡的 invariant：S 裡每個點的 d', '都已是最短距離，不會再改變');
  await step(tok);                                   // 1904 loop 何時結束？所有點都進 S
  for (let k = 0; k < ord.length; k++) {
    ns.push(cube(ord[k][0], J2.node, [0.8, 0.8, 0.8], NX(k), 1.4, 0, 1));
    tag('d=' + ord[k][1], 'idx', NX(k), 0.4);
  }
  box = ghostBox(J2.pink, 1.4, 1.6, 0.9); box.position.set(NX(0), 1.4, 0);
  kl = tag('|S| = 1', 'ptr', 5.2, 2.6);
  await anim(tok, 1200, (u) => fit(1 + Math.round(u * 5)));
  cd.hl(0);
  say('loop 什麼時候結束？所有點都進 S', 'S = V');
  await step(tok);                                   // 1928 結束時所有 d 都正確
  ns.forEach((m) => { tint(m, J2.exp); glow(m, GREEN); });
  say('invariant 成立 → 結束時所有 d 都正確', '這就是要的結果');
  await step(tok);                                   // 1968 S 從少長到多 → 數學歸納法
  ns.forEach((m, k) => { glow(m, null); if (k) tint(m, J2.node); });
  fit(1);
  say('S 從 1 個點一個一個長大', '最適合用數學歸納法（induction）');
  await step(tok);                                   // 1989 對 |S| 做 induction
  j2Cls(kl, 'ptr alt');
  say('對 S 裡的點數 |S| 做 induction', '');
  await step(tok);                                   // 2041 basis：S 只有 source
  glow(ns[0], GOLD);
  tag('Basis', 'ptr', NX(0), 3.0);
  say('Basis：一開始 S 只有 source s', '');
  await step(tok);                                   // 2051 d(s)=0 成立，trivial
  glow(ns[0], GREEN);
  good('d(s) = 0 ✓（trivial）', NX(0) + 0.6, -0.5);
  say('source 到自己是 0：成立', 'trivial');
  await step(tok);                                   // 2061 困難的是 inductive step
  glow(ns[0], null);
  const st = bub('weak？strong？', -1.6, 3.2, 0.8);
  dj.mood('wow');
  say('困難在 inductive step', '要用 weak 還是 strong induction？');
  await step(tok);                                   // 2079 weak：每輪只加一個點
  txt(st, 'weak：每輪只加一個點');
  dj.mood('happy');
  say('用 weak induction', '每個 iteration S 只多一個點');
  await step(tok);                                   // 2094 假設 |S| = k 成立
  remove(st);
  for (let k = 1; k < 3; k++) tint(ns[k], J2.exp);
  fit(3); txt(kl, '|S| = k（成立）');
  for (let k = 0; k < 3; k++) glow(ns[k], GREEN);
  say('假設：|S| = k 時，S 裡的 d 都正確', 'induction hypothesis');
  await step(tok);                                   // 2101.5 證 k+1 也成立
  glow(ns[3], GOLD); bub('?', NX(3), 2.5, 0.5);
  txt(kl, '|S| = k+1：也對嗎？');
  say('要證：多放一個點（k + 1）仍成立', '');
}]);

// 35:46 inductive step：紅色 P_v 與綠色另一條路
FRAG.push(['grjiang2-dijkstra-proof', 'Inductive step：另一條路一定不比 P_v 短', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const P = { s: [-5.2, 3], u: [-2.0, 1.4], x: [-1.4, 4.6], v: [3.2, 1.4], y: [2.6, 4.6] };
  const N = {};
  const mk = (k, c) => (N[k] = cube(k, c, [0.75, 0.75, 0.75], P[k][0], P[k][1], 0, 1.4));
  mk('s', J2.exp);
  const f = tag('', 'ptr alt', 0.6, -0.7);
  let S = null;
  await step(tok);                                   // 2154 這一輪要加入 v
  mk('v', J2.node); glow(N.v, GOLD);
  say('設第 k+1 輪想加入的點叫 v', '');
  await step(tok);                                   // 2168.7 S：已確認 d 的人
  S = ghostBox(J2.pink, 6.0, 5.2, 0.6); S.position.set(-3.2, 3.0, 0);
  tag('S（k 個點，d 都正確）', 'ptr', -3.2, 6.0);
  say('任何時刻都有 S：裡面的 d 都已確認', '');
  await step(tok);                                   // 2194 v 是第 3、4 行選出的
  note("v：d + ℓ 總和最小的那個", 3.2, 0.3);
  say('v 為什麼被選？第 3、4 行', 'd 值 + edge 長度，總和最小');
  await step(tok);                                   // 2208 經過 u 走到 v
  mk('u', J2.exp);
  arrow(V3(-1.55, 1.4, 0.3), V3(2.75, 1.4, 0.3), 0xd64545);
  say('假設 v 是經過 u 走過來的', "d(v) = d(u) + ℓ(u,v)");
  await step(tok);                                   // 2240 s 到 u 的路已找到
  line(P.s[0], P.s[1], P.u[0], P.u[1], 0.3, J2.bad);
  say('u 的 d 已確認：s 到 u 的路已找到', '畫成一條紅線');
  await step(tok);                                   // 2265 叫它 P_v
  tag('P_v（紅）', 'ptr alt', 0.6, 0.7);
  say('紅色整條 s ⇝ u → v 叫 P_v', '');
  await step(tok);                                   // 2291 要證 P_v 真的最短
  const dj = buddy('', '', '#f4a56a', 5.6, 1.0, 0.8, 0.55); dj.mood('wow');
  say('要確認：P_v 真的最短，不會再被改', '');
  await step(tok);                                   // 2334 induction hypothesis：s ⇝ u 最短
  glow(N.u, GREEN);
  say('by induction hypothesis：S 裡都正確', '所以 s ⇝ u 這段一定最短');
  await step(tok);                                   // 2395 另一條綠色路
  mk('x', J2.exp); mk('y', J2.node);
  line(P.s[0], P.s[1], P.x[0], P.x[1], 0.3, '#1f9e6e'); arrow(V3(-0.95, 4.6, 0.3), V3(2.15, 4.6, 0.3), 0x1f9e6e); line(P.y[0], P.y[1], P.v[0], P.v[1], 0.3, '#1f9e6e');
  tag('另一條路（綠）', 'ptr', 0.6, 5.4);
  say('假設還有另一條綠色的路到 v', '');
  await step(tok);                                   // 2427 一定在某處離開 S
  bub('這裡跨出 S！', 0.6, 3.9, 0.6);
  say('綠色的路從 s 出發、最後到 v', '一定在某處離開 S');
  await step(tok);                                   // 2443 跨出去的叫 y、前一個叫 x
  glow(N.x, GOLD); glow(N.y, GOLD);
  say('跨出去的點叫 y，它前面那個叫 x', '');
  await step(tok);                                   // 2466 x 在 S 裡：s ⇝ x 也最短
  glow(N.x, GREEN);
  say('x 在 S 裡：s ⇝ x 也已是最短', '');
  await step(tok);                                   // 2487 為什麼選 v 沒選 y？
  dj.look(-1);
  say('第 k+1 輪為什麼選 v、不選 y？', '因為第 4 行的選擇');
  await step(tok);                                   // 2504 d(u)+ℓ(u,v) ≤ d(x)+ℓ(x,y)
  txt(f, 'd(u) + ℓ(u,v) ≤ d(x) + ℓ(x,y)');
  say('v 的總和是所有人裡最小的', '所以 ≤ x 的 d + ℓ(x,y)');
  await step(tok);                                   // 2532 紅色總長 = d(v)
  txt(f, '紅色總長 = d(u) + ℓ(u,v) = d(v)　≤　d(x) + ℓ(x,y)');
  say('紅色 P_v 的總長 = d(u) + ℓ(u,v) = d(v)', '');
  await step(tok);                                   // 2602 要比整條紅色和整條綠色
  say('真正要比：整條紅色 vs 整條綠色', '');
  await step(tok);                                   // 2615 s ⇝ y 這段已經比較大
  glow(N.y, null); glow(N.v, GOLD);
  txt(f, '綠色的 s ⇝ x → y　≥　d(v)');
  say('綠色走到 y 這一段，已經 ≥ d(v)', '');
  await step(tok);                                   // 2623 y ⇝ v 一定 ≥ 0
  txt(f, '綠色 = (s ⇝ y) + (y ⇝ v)　≥　d(v) + 0');
  note('y ⇝ v ≥ 0', 3.6, 3.0);
  say('後面 y ⇝ v 這段一定 ≥ 0', '加上去只會更大');
  await step(tok);                                   // 2646 綠色 ≥ 紅色
  txt(f, '綠色總長　≥　紅色總長 = d(v)');
  say('所以綠色總長一定 ≥ 紅色', '');
  await step(tok);                                   // 2664 d(v) 是最短 → k+1 成立
  tint(N.v, J2.exp); glow(N.v, GREEN); dj.mood('happy');
  await anim(tok, 700, (t) => { S.scale.x = 1 + t * 0.55; S.position.x = -3.2 + t * 1.65; });
  say('v 記錄的 d 確實是最短距離', '|S| = k+1 時也成立 ∎');
}]);

// 44:32 只適用非負 edge weight（Lec12）
FRAG.push(['grjiang2-negative-weight', '為什麼 Dijkstra 要求 edge weight ≥ 0', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let lw = null, G = null;
  await step(tok);                                   // 2672 ℓ(e) = 兩地之間的長度
  const a = cube('', J2.node, [0.7, 0.7, 0.7], -5.6, 5.4, 0), b = cube('', J2.node, [0.7, 0.7, 0.7], -2.6, 5.4, 0);
  arrow(V3(-5.1, 5.4, 0), V3(-3.1, 5.4, 0), J2.edge);
  lw = tag('ℓ(e)', 'ptr', -4.1, 5.9);
  say('ℓ(e)：一開始設定是兩地之間的長度', '');
  await step(tok);                                   // 2684 紅色：≥ 0
  txt(lw, 'ℓ(e) ≥ 0'); j2Cls(lw, 'bad');
  say('這個版本假設 ℓ(e) ≥ 0', '投影片特別用紅色標出');
  await step(tok);                                   // 2702 放進 S 就不再改
  const S = ghostBox(J2.pink, 3.4, 2.0, 0.6); S.position.set(-4.4, 2.4, 0);
  const sv = cube('v', J2.exp, [0.7, 0.7, 0.7], -4.4, 2.4, 0, 1.2);
  const lk = prop('lock', -3.5, 2.5, 0.5, 0.8);
  say('點一放進 S，答案就固定不再改', '');
  await step(tok);                                   // 2716 為什麼不用再改？
  const me = buddy('', '', '#9fb8ff', -6.0, 0, 1.0, 0.55); me.mood('wow');
  bub('為什麼不用再改？', -4.4, 1.0, 1.0);
  say('奇怪：為什麼不需要再改它？', '');
  await step(tok);                                   // 2735 前面那段已經比較長
  const seg1 = cube('', '#1f9e6e', [3.0, 0.4, 0.4], 2.0, 4.6, 0);
  const t1 = tag('s ⇝ y：已經 ≥ d(v)', 'ptr', 2.0, 5.2);
  say('證明裡：別條路前面那段已經比較長', '');
  await step(tok);                                   // 2743 後面那段一定 ≥ 0
  const seg2 = cube('', '#7fd1a8', [1.6, 0.4, 0.4], 4.3, 4.6, 0);
  const t2 = tag('y ⇝ v：≥ 0', 'ptr alt', 4.6, 3.9);
  say('後面那段要 ≥ 0，不等式才會對', '');
  await step(tok);                                   // 2758 因為所有 edge 長度 ≥ 0
  glow(seg2, GREEN);
  const t3 = good('所有 edge 長度 ≥ 0 → 後段 ≥ 0 ✓', 2.6, 3.0);
  me.mood('happy');
  say('因為所有 edge 長度都 ≥ 0', '放進 S 的點不會被改得更好');
  await step(tok);                                   // 2788 只在這個設定下才對
  const t4 = pkt('適用時機：edge weight 非負', 2.6, 2.2);
  say('Dijkstra 只在這個設定下才對', '請注意它的適用時機');
  await step(tok);                                   // 2807 有負數就不要用（補充反例）
  [a, b, seg1, seg2].forEach(kill); [t1, t2, t3].forEach(remove); t4.position.set(-3.2, -1.2, 0);
  G = j2Graph({ s: [0.6, 0.6], p: [4.2, 2.2], q: [4.2, -0.9] }, [['s', 'p', 2], ['s', 'q', 3], ['q', 'p', -2]], { drop: 1.2, tagDy: 0.75 });
  G.E[2].set(J2.bad); j2Cls(G.E[2].lb, 'bad');
  note('補充反例', 0.6, -0.6);
  say('edge weight 有負數：請不要用它', '（右邊是補充的小反例）');
  await step(tok);                                   // 2814.5 會產生錯誤結果
  j2Explore(G, 's'); txt(G.D.s, '0');
  G.e('s', 'p').set(J2.tree); j2Explore(G, 'p'); txt(G.D.p, 'd=2 定案');
  G.e('q', 'p').set(J2.hot); tint(G.N.p, J2.bad);
  bad('s→q→p = 3 + (−2) = 1 < 2', 2.4, 3.5);
  me.mood('sad');
  say('p 先以 2 定案，其實 s→q→p 只要 1', '產生錯誤結果');
  await step(tok);                                   // 2821 DP 再介紹別的演算法
  pkt('有負 weight → 之後 DP 章節的其他演算法', 2.6, -1.9);
  me.mood('happy');
  say('有負數怎麼辦？等 dynamic programming', '再介紹其他 shortest path 演算法');
  void sv; void lk;
}]);

// 47:35 實作：每個點記 d、放進 min-priority queue；三種實作（Lec12）
FRAG.push(['grjiang2-pq-lec12', '實作：把 d 值放進 min-priority queue，三種實作方式', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.2, 0]);
  const L = ['s', 't', 'x', 'y', 'z'], NX = (k) => -5.8 + k * 1.3;
  const ns = {}, ds = {};
  let mach = null, out = null;
  await step(tok);                                   // 2862 讓第 4 行很快找出最小
  const c4 = code(["4 d'(v) = min (d(u) + ℓ(u,v))"], -2.6, 6.8);
  c4.hl(0);
  say('要讓第 4 行很快找出最小的那個', '');
  await step(tok);                                   // 2869 需要很好的 data structure
  mach = prop('printer', 4.4, 0.6, 0, 1.4, '吐出最小值的機器');
  say('需要一個好的 data structure', '能很快吐出所有人裡的最小值');
  await step(tok);                                   // 2889 原來：從 S 往外看
  const S = ghostBox(J2.pink, 2.4, 1.4, 0.8); S.position.set(-4.6, 3.6, 0);
  tag('S', 'ptr', -5.6, 4.5);
  for (let k = 0; k < 3; k++) arrow(V3(-3.6, 3.6, 0), V3(-1.8, 2.8 + k * 0.8, 0), J2.hot);
  say('原本的寫法：以 S 的觀點往外看', '誰距離最近？');
  await step(tok);                                   // 2898 換角度：每個點身上記目前最短距離
  for (let k = 0; k < L.length; k++) { ns[L[k]] = cube(L[k], J2.node, [0.7, 0.7, 0.7], NX(k), 1.0, 0, 1.2); ds[L[k]] = tag('d=?', 'ptr alt', NX(k), 1.8); }
  say('實作時換個角度：每個點身上', '隨時記著「目前知道的最短距離」');
  await step(tok);                                   // 2918 一開始設 ∞
  txt(ds.s, 'd=0'); for (const k of L.slice(1)) txt(ds[k], 'd=∞');
  say('一開始不知道怎麼走：先設 ∞', '（source 自己是 0）');
  await step(tok);                                   // 2924 往下降到最短就停
  const fin = { t: 8, x: 9, y: 5, z: 7 };
  for (const k of ['t', 'x', 'y', 'z']) { txt(ds[k], 'd=' + fin[k]); await beat(tok, 300); }
  for (const k of L) tint(ns[k], J2.exp);
  say('運算中一路往下降', '降到 shortest path length 就停住');
  await step(tok);                                   // 2941 min priority queue
  if (mach.userData.label) mach.userData.label.element.textContent = 'min-priority queue';
  say('要實作的是 min-priority queue', '');
  await step(tok);                                   // 2945 所有點都放進去
  for (const k of L) { await travel(tok, ds[k], ds[k].position.clone(), V3(3.4 + Math.random() * 2, 2.4, 0.3), 260); }
  for (const k of L) showL(ds[k], false);
  say('把所有點（帶著 d 值）都放進去', 'd 值就是 key');
  await step(tok);                                   // 2963 吐出最小並 remove
  out = pkt('吐出：s（d = 0）', 4.4, -0.6, 0.6);
  await travel(tok, out, V3(4.4, 1.2, 0.6), V3(4.4, -0.6, 0.6), 600);
  say('它能很快吐出最小值的那個點', '順便把它 remove');
  await step(tok);                                   // 2985 很多種實作：array
  remove(out); kill(S);
  for (const k of L) kill(ns[k]);
  tag('三種實作', 'ptr alt', -3.0, 5.6);
  const arr = [0, '∞', '∞', '∞', '∞'].map((v, k) => cube(v, J2.blue, [0.8, 0.55, 0.55], -5.6 + k * 0.9, 4.4, 0, 1));
  tag('array', 'ptr', -6.3, 5.0);
  say('實作方式有很多種：第一種 array', '');
  await step(tok);                                   // 2993 array 每次找最小都要掃一遍
  const scan = pkt('掃 →', -5.6, 3.6);
  await travel(tok, scan, V3(-5.6, 3.6, 0), V3(-2.0, 3.6, 0), 1200);
  bad('每次找最小都掃一遍：慢', -3.6, 3.0);
  say('array：大家存在一起', '每次找最小值都要整個掃一遍');
  await step(tok);                                   // 3001 binary heap：tree，存成 sequence
  tag('binary heap', 'ptr', -6.0, 2.0);
  const tx = [-4.4, -5.2, -3.6], ty = [1.6, 0.6, 0.6];
  for (let k = 0; k < 3; k++) cube(['0', '5', '8'][k], J2.exp, [0.6, 0.5, 0.5], tx[k], ty[k], 0, 1);
  line(-4.4, 1.35, -5.2, 0.85, -0.1); line(-4.4, 1.35, -3.6, 0.85, -0.1);
  note('Binary tree 的樣子，存成一串 sequence', -1.0, 1.0);
  say('binary heap：binary tree 的形式', '用一個 sequence 記錄');
  await step(tok);                                   // 3020 Fibonacci heap 更快一些
  tag('Fibonacci heap：更高級、再快一些', 'ptr', -3.0, -0.4);
  say('更高級的：Fibonacci heap', '速度再快一些');
  await step(tok);                                   // 3028 至少要會 binary heap
  good('這門課：至少要會用 binary heap 實作', -3.0, -1.3);
  say('這門課至少要會：用 binary heap', '實作 min-priority queue');
  void arr; void scan;
}]);

// CLRS 例子共用：圖、d 值、min-PQ 列、Extract-Min 與 relax
function j2Clrs(o = {}) {
  const G = j2Graph(J2C_P, J2C_E, { drop: o.drop || 0 });
  const d = { s: 0, t: Infinity, x: Infinity, y: Infinity, z: Infinity }, par = {}, done = new Set();
  const Q = tag('', 'ptr', -0.8, -0.8);
  const C = { G, d, done, Q, checked: 0 };
  C.showD = () => { for (const k of Object.keys(d)) txt(G.D[k], j2F(d[k])); };
  C.showQ = () => txt(Q, 'min-PQ：' + Object.keys(d).filter((k) => !done.has(k)).sort((a, b) => d[a] - d[b]).map((k) => k + ':' + j2F(d[k])).join('  '));
  C.extract = (u) => {
    for (const k of Object.keys(G.N)) glow(G.N[k], null);
    for (const e of G.E) if (!e.tree) e.set(J2.edge);
    done.add(u); tint(G.N[u], '#8a8478'); move(G.N[u], G.P[u][0], G.P[u][1], 0.5); j2Cls(G.D[u], 'ptr alt');
    if (par[u]) { const e = G.e(par[u], u); e.tree = true; e.set(J2.tree); }
    C.showQ();
  };
  C.relax = (u, v) => {
    const e = G.e(u, v), nd = d[u] + e.w; C.checked++;
    e.set(J2.hot); glow(G.N[v], GOLD);
    if (nd < d[v]) { d[v] = nd; par[v] = u; txt(G.D[v], d[u] + '+' + e.w + '=' + nd); }
    C.showQ();
    return nd;
  };
  return C;
}

// 50:57 CLRS 例子（Lec12）
FRAG.push(['grjiang2-dijkstra-clrs', 'Dijkstra（CLRS 例子）：Extract-Min 依序 0、5、7、8、9', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let C = null;
  await step(tok);                                   // 3057 例子取自 CLRS
  const book = prop('file', 5.8, 5.2, 0, 1.0, 'CLRS 課本');
  bob(book, 0.04);
  say('這個例子取自 Cormen 的書（CLRS）', '看實作時 Dijkstra 怎麼運作');
  await step(tok);                                   // 3069 directed graph、edge 有距離
  C = j2Clrs({ drop: 1.5 });
  say('一開始：一個 directed graph', 'edge 上有距離');
  await step(tok);                                   // 3083.5 圈圈數字 = 當下 d 值
  note('點上的數字 = 當下記錄的 d 值', 0.4, 7.0);
  say('每個點上的數字 = 當下記錄的 d 值', '');
  await step(tok);                                   // 3089 source 是 0
  txt(C.G.D.s, '0'); glow(C.G.N.s, GOLD);
  say('source 自己到自己：d = 0', '一開始就確認');
  await step(tok);                                   // 3103 其他人都 ∞
  C.showD();
  say('其他人還走不到：都設成 ∞', '');
  await step(tok);                                   // 3112 全部放進 min-PQ
  C.showQ();
  say('所有點都放進 min-priority queue', '');
  await step(tok);                                   // 3117 每次 Extract-Min
  const ex = pkt('Extract-Min：吐出最小的', 4.6, -1.6);
  say('每次 Extract-Min：把最小值吐出來、砍掉', '');
  await step(tok);                                   // 3126 吐出 s
  glow(C.G.N.s, null); C.extract('s');
  say('一開始吐出 s（0），從 s 開始做', '');
  await step(tok);                                   // 3133 黑色 = 放進 S
  note('黑色 = 正在處理、已放進 S', -4.6, -1.6);
  say('變成黑色 = 正在處理，已放進 S', '');
  await step(tok);                                   // 3154 看能不能 update 別人
  say('接著看：透過 s 能不能 update 別人', '');
  await step(tok);                                   // 3162 t：0 + 10 = 10
  C.relax('s', 't');
  say('s → t：0 + 10 = 10，比 ∞ 好', 't 降成 10');
  await step(tok);                                   // 3177 y：0 + 5 = 5
  C.relax('s', 'y');
  say('s → y：0 + 5 = 5', '從 ∞ 降到 5');
  await step(tok);                                   // 3192 剩四個點，吐出 5
  C.extract('y');
  say('PQ 剩四個點：最小的是 5 → 吐出 y', '放進 S');
  await step(tok);                                   // 3214 5 + 3 = 8 < 10
  C.relax('y', 't');
  say('y → t：5 + 3 = 8，比 10 好', 't 被 update 成 8');
  await step(tok);                                   // 3230 5 + 9 = 14
  C.relax('y', 'x');
  say('y → x：5 + 9 = 14', '比 ∞ 好');
  await step(tok);                                   // 3237 5 + 2 = 7
  C.relax('y', 'z');
  say('y → z：5 + 2 = 7', '也 update');
  await step(tok);                                   // 3250 吐出 7（z）
  C.extract('z');
  say('剩三個：吐出最小的 7（z）', '');
  await step(tok);                                   // 3264 7 + 6 = 13 < 14
  C.relax('z', 'x');
  say('z → x：7 + 6 = 13，比 14 好', '');
  await step(tok);                                   // 3270 吐出 8（t），8 + 1 = 9
  C.extract('t'); C.relax('t', 'x');
  say('8 跟 13：吐出 t（8）', 't → x：8 + 1 = 9');
  await step(tok);                                   // 3287 直到所有人都確認
  C.extract('x');
  say('最後吐出 x（9）', '所有人都放進 S，結束');
  await step(tok);                                   // 3301 d 從 ∞ 往下降
  note('每個 d：∞ → 往下降 → 停住', -2.0, 7.0);
  say('每個點的 d 都從 ∞ 往下降', '降到最後就不再動');
  await step(tok);                                   // 3307 visit 順序 d 遞增
  const ord = [['s', 0], ['y', 5], ['z', 7], ['t', 8], ['x', 9]];
  for (let k = 0; k < ord.length; k++) { cube(ord[k][0] + ':' + ord[k][1], J2.exp, [1.0, 0.5, 0.5], 1.6 + k * 1.15, -1.6, 0.6, 1); await beat(tok, 250); }
  say('explore 的順序：0、5、7、8、9', 'd 值由小到大');
  await step(tok);                                   // 3329 greedy：由近到遠
  good('greedy：從近的走到遠的', 3.9, -2.4);
  say('從比較近的走到比較遠的', '這就是 greedy 的 idea');
  void ex;
}]);

// ═════════════ Lec13（trkaH2uLxHw） ═════════════

// 00:15 回顧：只適用非負 weight（Lec13）
FRAG.push(['grjiang2-negative-review', '回顧：Dijkstra 只適用非負 edge weight', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph({ s: [-4.8, 3], a: [1.0, 5.4], b: [1.0, 0.6] }, [['s', 'a', 2], ['s', 'b', 3], ['b', 'a', 2]], { drop: 1.5 });
  const me = buddy('Dijkstra', '', '#f4a56a', -4.8, 1.2, 0.9, 0.6);
  await step(tok);                                   // 15 適用時機：weight 非負
  pkt('適用時機：edge weight ≥ 0', 4.4, 6.6);
  say('Dijkstra：有名的 shortest path algorithm', '適用時機：edge weight 一定要非負');
  await step(tok);                                   // 45 greedy 本質
  j2Explore(G, 's'); txt(G.D.s, '0'); txt(G.D.a, '2'); txt(G.D.b, '3');
  say('它的本質是 greedy', '');
  await step(tok);                                   // 53 決定了就不回頭
  G.e('s', 'a').set(J2.tree); j2Explore(G, 'a'); txt(G.D.a, '2 定案');
  const lk = prop('lock', 1.9, 5.0, 0.5, 0.7);
  await walk(tok, me, 1.0, 3.6, 800);
  say('決定之後不會回頭 revisit', 'a 定案、上鎖');
  await step(tok);                                   // 61 如果 edge weight 是負的
  relabel(G.N.b, 'b'); txt(G.E[2].lb, '−2'); j2Cls(G.E[2].lb, 'bad'); G.E[2].set(J2.bad);
  say('如果 edge weight 是負的…', '會影響後續的決定');
  await step(tok);                                   // 67 整個 algorithm 運作錯誤
  G.e('s', 'b').set(J2.tree); j2Explore(G, 'b');
  await walk(tok, me, 1.0, -0.8, 800);
  G.e('b', 'a').set(J2.hot); tint(G.N.a, J2.bad);
  bad('s→b→a = 3 − 2 = 1 < 2，但 a 已鎖住', 4.2, 2.9);
  me.mood('sad');
  say('a 已經鎖住，更短的 1 改不回去', '整個 algorithm 就錯了（補充例子）');
  await step(tok);                                   // 83 出現負數怎麼辦？
  bub('那有負數怎麼辦？', -3.0, 1.0, 1.2);
  say('同學問：edge weight 出現負數怎麼辦？', '');
  await step(tok);                                   // 94 後續章節的其他演算法
  pkt('之後的章節：可處理 negative weight 的演算法', 0.0, -1.8);
  me.mood('happy');
  say('有些問題允許負的 weight', '後續章節會介紹其他演算法處理');
  void lk;
}]);

// 01:57 實作：每個點記 d（shortest-path estimate）；從 edge 的角度改成點的角度
FRAG.push(['grjiang2-edge-vs-vertex', '實作加速：對 edge 取 min 改成每個點記 d 值', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2S_P, J2S_E);
  const ls = [];
  await step(tok);                                   // 126 每個點都記一個 d
  for (const k of Object.keys(G.N)) txt(G.D[k], 'd');
  say('整個過程中，每個點都記一個 d 值', '');
  await step(tok);                                   // 137 d = 估計值 estimate
  note('d = shortest path 距離的「估計值」', 0.0, -0.8);
  say('d 是最短距離的估計值（estimate）', '');
  await step(tok);                                   // 145 一開始除了 source 都 ∞
  txt(G.D.s, 'd=0'); for (const k of ['u', 'v', 'x', 'y', 'z']) txt(G.D[k], 'd=∞');
  say('一開始除了 source，其他都是 ∞', '');
  await step(tok);                                   // 152 慢慢往下降，降到最低就停
  for (const [k, v] of [['u', 1], ['v', 2]]) { txt(G.D[k], 'd=' + v); glow(G.N[k], GOLD); await beat(tok, 400); }
  say('隨著演算法進行，估計值往下降', '降到真正的最短長度就不再改變');
  await step(tok);                                   // 180 確認後 mark explored = 放進 S
  for (const k of ['s', 'u', 'v']) { glow(G.N[k], null); j2Explore(G, k); }
  G.e('s', 'u').set(J2.tree); G.e('s', 'v').set(J2.tree);
  say('確認後 mark 成 explored', '也就是放進 S');
  await step(tok);                                   // 198 原本的版本：不是每點記 d
  for (const k of ['x', 'y', 'z']) txt(G.D[k], '');
  say('但原本的版本，並不是每個點都記 d', '');
  await step(tok);                                   // 213 從已 reach 的點往外擴散
  const cross = [['s', 'x', '0+4=4'], ['u', 'x', '1+1=2'], ['u', 'y', '1+3=4'], ['v', 'z', '2+3=5']];
  for (let k = 0; k < cross.length; k++) { const [a, b, f] = cross[k]; G.e(a, b).set(J2.hot); ls.push(tag(a + '→' + b + '：' + f, 'idx', -4.6 + k * 3.0, -1.6)); await beat(tok, 300); }
  say('每次都從已 reach 的點往外擴散', '看所有人裡的最低點');
  await step(tok);                                   // 234 以 edge 的角度
  ls.forEach((l) => j2Cls(l, 'ptr'));
  say('所以原始想法是以 edge 的角度出發', '對每條 edge 算 d + ℓ');
  await step(tok);                                   // 269 複雜度很高
  const slow = bad('對所有 edge 取 min：很慢', 0.0, 7.0);
  say('對 edge take minimum', '實作時複雜度會變非常高');
  await step(tok);                                   // 274 加速
  txt(slow, '加速！'); j2Cls(slow, 'pkt');
  say('實作時有一個加速的辦法', '');
  await step(tok);                                   // 292 反過來：每個點記 d
  ls.forEach(remove);
  for (const [a, b] of cross) G.e(a, b).set(J2.edge);
  for (const [k, v] of [['x', 2], ['y', 4], ['z', 5]]) { txt(G.D[k], 'd=' + v); glow(G.N[k], GOLD); await beat(tok, 300); }
  say('反過來，改成以點的角度', '每個點記自己的 d 值');
  await step(tok);                                   // 309 多個來源先取 min 當自己的 d
  G.e('s', 'x').set(J2.hot); G.e('u', 'x').set(J2.hot);
  note('x 有兩個來源：min(0+4, 1+1) = 2', 1.2, 1.8);
  say('有多個來源？先取最小，當作自己的 d', 'x：min(4, 2) = 2');
  await step(tok);                                   // 324 take minimum 的對象變成點
  G.e('s', 'x').set(J2.edge); G.e('u', 'x').set(J2.edge);
  for (const k of ['y', 'z']) glow(G.N[k], null);
  glow(G.N.x, GREEN); j2Cls(slow, 'good'); txt(slow, '取 min 的對象：點（x、y、z 裡挑 x）');
  say('take minimum 的對象從 edge 變成點', '運算就快多了');
}]);

// 05:32 CLRS 例子：只 update 鄰居（Lec13）
FRAG.push(['grjiang2-clrs-update', 'CLRS 例子：Extract-Min 與只 update 鄰居（≤ m 次）', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const C = j2Clrs();
  const cnt = tag('', 'ptr alt', 4.8, -1.6);
  const showCnt = () => txt(cnt, '檢查過的 edge：' + C.checked + ' / m = 10');
  await step(tok);                                   // 338 數字 = shortest-path estimate
  note('點上的數字 = shortest-path estimate', 0.4, 7.0);
  say('圈圈裡的數字 = 當下的 shortest-path estimate', '');
  await step(tok);                                   // 349 source 是 0
  txt(C.G.D.s, '0');
  say('唯一能確定的：source 是 0', '自己走到自己');
  await step(tok);                                   // 355 其他設 ∞
  C.showD();
  say('其他人還不知道要走多遠：設 ∞', '');
  await step(tok);                                   // 365 unreachable 的 ∞ 不會變
  const ur = cube('w', J2.gray, [0.7, 0.7, 0.7], 6.2, 2.8, 0, 1.2), urT = tag('∞', 'ptr', 6.2, 3.6);
  const urN = note('（示意）到不了的點：一直是 ∞', 5.2, 1.8);
  say('有些 ∞ 降不下來：s 根本到不了', 'unreachable，無路可走');
  await step(tok);                                   // 385 有路可走就會降到最短
  kill(ur); remove(urT); remove(urN);
  say('其他人只要有路可走', '一定會降到最短距離');
  await step(tok);                                   // 394 d 當 key 放進 PQ
  C.showQ();
  say('把每個點的 d 當成 key', '丟進 priority queue');
  await step(tok);                                   // 411 隨時吐出最小
  const m = prop('printer', 5.6, -0.2, 0.6, 0.9, '吐最小');
  say('要求：隨時都能吐出最小的那個', '');
  await step(tok);                                   // 437 吐出 s
  C.extract('s');
  say('現在只有 s 是 0：吐出 s', '從 s 出發');
  await step(tok);                                   // 446 順便 update
  say('順便 update：透過 s 往外', '誰的 d 可以往下降？');
  await step(tok);                                   // 468 t：0 + 10 = 10
  C.relax('s', 't'); showCnt();
  say('s → t：0 + 10，∞ 改成 10', '');
  await step(tok);                                   // 476 y 改成 5
  C.relax('s', 'y'); showCnt();
  say('同樣道理，y 改成 5', '');
  await step(tok);                                   // 484 PQ 也跟著 update
  for (const k of ['t', 'y']) glow(C.G.N[k], null);
  say('min-priority queue 也跟著 update', '');
  await step(tok);                                   // 502 吐出 y
  C.extract('y');
  say('再叫它吐最小的：吐出 y（5）', '');
  await step(tok);                                   // 519 黑色 = explored
  note('黑色 = explored：不會再往下降', -4.6, -1.6);
  say('吐出來 = 確認最短距離，不會再降', '圖上 mark 成黑色 = explored');
  await step(tok);                                   // 529 丟到 S 不再改變
  say('也就是丟進 S，從此不再改變', '');
  await step(tok);                                   // 548 經過 y 看到更多人
  for (const e of C.G.E.filter((x) => x.u === 'y')) e.set(J2.hot);
  say('經過 y 又能看到更多人', 't、x、z');
  await step(tok);                                   // 571 5 + 3 = 8
  C.relax('y', 't'); showCnt();
  say('y → t：5 + 3 = 8，比 10 小', '');
  await step(tok);                                   // 579 找到更短的路，10 → 8
  bub('找到更短的路！', -1.4, 7.0, 0.6);
  say('找到另一條到 t 更短的路', '10 降成 8');
  await step(tok);                                   // 588 x、z 從 ∞ 降下來
  C.relax('y', 'x'); C.relax('y', 'z'); showCnt();
  say('經過 y，x 和 z 也從 ∞ 降下來', 'x = 14、z = 7');
  await step(tok);                                   // 601 每輪吐出最小的
  C.extract('z');
  say('每個 iteration：吐出 d 最小的', '吐出 z（7）');
  await step(tok);                                   // 622 處理完要為後面的人 update
  C.relax('z', 'x'); C.relax('z', 's'); showCnt();
  say('處理它之後，為後面的人做 update', 'z → x：7 + 6 = 13');
  await step(tok);                                   // 637 只 update 鄰居
  C.extract('t');
  for (const e of C.G.E.filter((x) => x.u === 't')) e.set(J2.hot);
  say('update 只會動誰？只有它連出去的鄰居', '吐出 t（8）：只看 t→x、t→y');
  await step(tok);                                   // 655 直到所有人 explore 完
  C.relax('t', 'x'); C.relax('t', 'y'); showCnt();
  C.extract('x'); C.relax('x', 'z'); showCnt();
  say('直到所有人都 explore 完成就停', 'x：8 + 1 = 9，最後吐出 x');
  await step(tok);                                   // 713 每次 take 一個點再 update 鄰居
  j2Cls(cnt, 'pkt');
  say('每次 take 一個點，再 update 它的鄰居', '');
  await step(tok);                                   // 720 update 總數 = edge 數 m
  j2Cls(cnt, 'good'); txt(cnt, 'update 的總次數 ≤ edge 總數 m = 10');
  say('每條 edge 只會被看一次', 'update 總次數 = edge 總數 m');
  await step(tok);                                   // 743 比 high-level 版本快
  good('比一開始 high-level 的版本快', 0.4, 7.0);
  say('比一開始 high-level 的演算法更快', '');
  void m;
}]);

// 12:40 min-priority queue 的操作次數與三種實作（Lec13）
FRAG.push(['grjiang2-pq-costs', 'Min-priority queue：操作次數與 array／binary heap／Fibonacci heap', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.2, 0]);
  const cols = [-5.2, -2.6, -0.4, 2.4, 5.0];
  const rows = [['Insert', 'n', 'O(1)', 'O(log n)', 'O(1)'], ['ExtractMin', 'n', 'O(n)', 'O(log n)', 'O(log n)*'], ['ChangeKey', 'm', 'O(1)', 'O(log n)', 'O(1)*'], ['IsEmpty', 'n', 'O(1)', 'O(1)', 'O(1)']];
  const cells = rows.map((r, ri) => r.map((v, c) => { const l = tag(v, c < 2 ? 'ptr alt' : 'idx', cols[c], 5.2 - ri * 0.95); showL(l, false); return l; }));
  const head = ['operation', '次數', 'array', 'binary heap', 'Fibonacci'].map((h, c) => { const l = tag(h, 'ptr', cols[c], 6.2); showL(l, false); return l; });
  const showRow = (r, upto) => { for (let c = 0; c <= upto; c++) showL(cells[r][c], true); };
  const showCol = (c) => { showL(head[c], true); for (let r = 0; r < 4; r++) showL(cells[r][c], true); };
  const dj = buddy('', '', '#f4a56a', -6.2, -1.4, 0.9, 0.55);
  await step(tok);                                   // 760 min-PQ 要怎麼做才快？
  dj.mood('wow');
  bub('min-PQ 怎麼做才快？', -4.4, -0.6, 0.9);
  say('留下的尾巴：min-priority queue', '要怎麼做才會快？');
  await step(tok);                                   // 782 Dijkstra 對 min-PQ 做哪些操作
  showL(head[0], true); showL(head[1], true);
  say('先列出 Dijkstra 對 min-PQ 做的 operation', '');
  await step(tok);                                   // 797 Insert：n 次
  showRow(0, 1);
  say('Insert：一開始所有點都丟進去', 'n 個點 → n 次');
  await step(tok);                                   // 825 Extract-Min：n 次
  showRow(1, 1);
  say('每個 iteration 一次 Extract-Min', '每個點都要被吐出來 → n 次');
  await step(tok);                                   // 851 ChangeKey：m 次
  showRow(2, 1);
  say('update 鄰居 = ChangeKey', '鄰居加起來 = edge 總數 → m 次');
  await step(tok);                                   // 881 IsEmpty
  showRow(3, 1);
  say('還有 IsEmpty：每輪確認做完了沒', 'n 次');
  await step(tok);                                   // 918 三種選擇：array
  showCol(2);
  say('實作的三種選擇，第一種：array', '最簡單，排成一排');
  await step(tok);                                   // 970 Extract-Min 要掃完整個 array
  glow(dj.body, null); j2Cls(cells[1][2], 'bad');
  say('Extract-Min：要掃完整個 array', '才知道最小在哪 → O(n)');
  await step(tok);                                   // 991 ChangeKey 直接 indexing 很快
  j2Cls(cells[2][2], 'good');
  say('ChangeKey：直接 indexing 改值', '很快，O(1)');
  await step(tok);                                   // 1015 array 總共 n × n = O(n²)
  tag('O(n²)', 'ptr alt', cols[2], 1.1);
  say('用 array：n 次 × O(n) = O(n²)', '');
  await step(tok);                                   // 1055 理論最快 Fibonacci heap
  showCol(4);
  tag('O(m + n log n)', 'ptr alt', cols[4], 1.1);
  say('理論上最快：Fibonacci heap', '（* 為 amortized；總和依課本補上）');
  await step(tok);                                   // 1097 係數很大
  bad('係數很大：資料量小時不一定快', 4.4, 0.2);
  say('但它前面的係數很大', '資料量不大時，不見得比較快');
  await step(tok);                                   // 1119 一般最好用 binary heap
  showCol(3);
  say('一般最好用的：binary heap', '每個操作 O(log n)');
  await step(tok);                                   // 1135 Heap 還能順便排序
  pkt('Heap 還能順便做 n log n 的排序', -2.6, -0.6);
  say('學 Heap 的好處：還能順便排序', '只要 n log n');
  await step(tok);                                   // 1161 Dijkstra 的 min-PQ 用 binary heap
  tag('O((n+m) log n)', 'ptr alt', cols[3], 1.1);
  dj.mood('happy');
  say('Dijkstra 的 min-PQ 也能用 binary heap 做', '總共 O((n + m) log n)；點都走得到時 = O(m log n)');
}]);

// 19:51 priority queue：max／min 與四種操作（OS process 例子）
FRAG.push(['grjiang2-pq-ops', 'Priority queue：Find／Extract／Insert／ChangeKey', async (tok) => {
  fresh([0, 3.6, 14], [0, 3.0, 0]);
  const P = {};
  let q = [];
  const lay = async () => { const from = q.map(([n]) => P[n].g.position.x); await anim(tok, 600, (u) => q.forEach(([n], k) => { P[n].g.position.x = from[k] + (-4.6 + k * 1.9 - from[k]) * u; })); };
  await step(tok);                                   // 1191 Heap：宣告成 array，操作像 Heap
  const row = [9, 7, 4, 2].map((v, k) => cube(v, J2.blue, [0.8, 0.5, 0.5], -1.6 + k * 0.9, 6.4, 0, 1));
  note('Heap：宣告成 array，操作起來像 Heap', 0.0, 5.6);
  say('Heap 宣告成 array，但操作起來像 Heap', '硬體上的結構非常簡單');
  await step(tok);                                   // 1224 兩種極端
  row.forEach(kill);
  tag('priority queue：兩種', 'ptr alt', 0, 6.4);
  say('Priority queue 有兩種', '值小的優先，或值大的優先');
  await step(tok);                                   // 1286 每筆 data 帶 key
  q = [['P1', 9], ['P2', 7], ['P3', 4], ['P4', 2]];
  const col = ['#f4a56a', '#9fb8ff', '#7cd1a8', '#e8cf8a'];
  q.forEach(([n, v], k) => { P[n] = buddy(n, v, col[k], -4.6 + k * 1.9, 1.4, 0.4, 0.75); });
  say('每筆 data 都帶一個 key value', 'key 的大小 = priority 的高低');
  await step(tok);                                   // 1310 max-PQ／min-PQ
  note('key 大優先 = max-PQ　key 小優先 = min-PQ', 0, 5.6);
  say('key 越大越優先：max priority queue', 'key 越小越優先：min priority queue');
  await step(tok);                                   // 1325 Dijkstra 用 min，例子用 max
  pkt('Dijkstra 用 min；以下例子用 max（對稱）', 0, 4.8);
  say('Dijkstra 用的是 min-PQ', '接下來的例子用 max-PQ，min 對稱');
  await step(tok);                                   // 1356 Find-Max
  P.P1.glow(GOLD); P.P1.mood('happy');
  say('Find-Max：看 priority 最高的是誰', 'P1（key 9）');
  await step(tok);                                   // 1384 Extract：find and remove
  say('Extract-Max：找到它，處理完再移除', 'find and remove');
  await step(tok);                                   // 1397 OS 先處理 priority 高的 process
  const cpu = prop('cpu', 5.6, 1.4, 0.4, 0.9, 'CPU');
  const p1 = P.P1.g, a = p1.position.clone();
  await anim(tok, 800, (u) => p1.position.set(a.x + (5.6 - a.x) * u, a.y + Math.sin(u * Math.PI) * 1.2, a.z));
  p1.visible = false; q = q.slice(1);
  say('像 OS 處理 process：先拿 priority 高的', '處理完就從 queue 移開');
  await step(tok);                                   // 1426 剩下的維持 PQ
  await lay();
  say('移除後，剩下的人還要維持 priority queue', '');
  await step(tok);                                   // 1442 Insert：新 process
  P.P5 = buddy('P5（看影片）', 8, '#f4a6c8', 5.6, 3.4, 0.4, 0.75);
  await walk(tok, P.P5, 5.6, 1.4, 600);
  q.unshift(['P5', 8]); await lay();
  say('Insert：突然開一個 video', '多一個新的 process，key 8');
  await step(tok);                                   // 1465 ChangeKey
  P.P4.glow(GOLD);
  say('ChangeKey：改變某筆 data 的 key', '');
  await step(tok);                                   // 1477 priority 太低一直被插隊 → starving
  P.P4.mood('sad');
  bub('我一直被插隊…', 2.6, 3.2, 0.6);
  say('P4 priority 太低，一直被插隊', '等太久會 starving（餓死）');
  await step(tok);                                   // 1499 promote 到最前面
  P.P4.set(10); P.P4.mood('happy'); P.P4.glow(null);
  q = [['P4', 10], ...q.filter(([n]) => n !== 'P4')]; await lay();
  say('把它的 priority 提高（2 → 10）', '從後面拉到最前面，趕快處理');
  void cpu;
}]);

// 25:20 max heap 定義、complete binary tree
FRAG.push(['grjiang2-heap-def', 'Max heap：每個點 ≥ 小孩，complete binary tree', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null;
  await step(tok);                                   // 1520 Heap 是一棵可愛的 binary tree
  H = j2Heap([14, 12, 7, 10, 8, 6], { cells: false, noRow: true, drop: 2 });
  say('Heap 長相很可愛：就是一棵 binary tree', '以下看 max heap');
  await step(tok);                                   // 1567 每個點 = 一筆 data 的 key
  note('每個點 = 一筆 data，存它的 key value', 0, 1.6);
  say('tree 的每個點是一筆 data', '存著它的 key（priority）');
  await step(tok);                                   // 1580 max heap：自己 ≥ 小孩
  tag('max heap：每個點 ≥ 小孩', 'ptr alt', 0, 7.0);
  say('Max heap：每個點的 key ≥ 小孩的 key', '');
  await step(tok);                                   // 1598 root 比小孩大：14 > 12、7
  H.hi(1, GOLD); H.hi(2, RED); H.hi(3, RED);
  say('root 一定比下一層大', '14 > 12，14 > 7');
  await step(tok);                                   // 1605 12 > 10、8；7 > 6
  H.unhi(); H.hi(2, GOLD); H.hi(4, RED); H.hi(5, RED); H.hi(3, GOLD); H.hi(6, RED);
  say('12 > 10、12 > 8；7 > 6', '維持一路往下變小的關係');
  await step(tok);                                   // 1614 min heap 相反
  H.unhi();
  note('min heap 相反：每個點 ≤ 小孩（例 2 → 5、9）', 0, 0.8);
  say('Min heap 相反：自己 ≤ 小孩', '');
  await step(tok);                                   // 1636 最大值在 root
  H.hi(1, GREEN);
  say('Max heap 的最大值在哪？一定在 root', 'max = 14');
  await step(tok);                                   // 1646 最小值在某個 leaf
  H.unhi(); for (const i of [4, 5, 6]) H.hi(i, GOLD);
  say('最小值一定在某個 leaf', '只是不確定是哪一個');
  await step(tok);                                   // 1663 不在 leaf 就矛盾
  bub('不在 leaf → 有小孩比它小 → 矛盾！', 3.0, 2.0, 0.6);
  say('如果不在 leaf，就有小孩比它更小', '和定義矛盾');
  await step(tok);                                   // 1684 complete binary tree
  H.unhi();
  tag('complete binary tree', 'ptr', -4.6, 7.0);
  say('Heap 是一棵 complete binary tree', '（完整的 binary tree）');
  await step(tok);                                   // 1696 編號 1；小孩 2、3；4、5…
  for (let i = 1; i <= 6; i++) { tag(String(i), 'idx', HX(i) + 0.62, HY(i) + 0.4); await beat(tok, 250); }
  say('root 編號 1，小孩 2、3', '2 的小孩 4、5…一層一層編下去');
  await step(tok);                                   // 1715 上層都滿，只有最後一層右邊可缺
  for (let i = 1; i <= 3; i++) H.hi(i, GREEN);
  note('上層都塞滿；只有最後一層的右半段可能缺', 0, 0.0);
  say('上面每層都塞滿', '只有最後一層的右半段可能缺');
  await step(tok);                                   // 1738 有缺漏就不是 heap
  H.unhi();
  const hole = cube('?', J2.bad, [0.8, 0.7, 0.6], HX(7), HY(7), 0, 1.5); tint(H.T[6], J2.gray);
  bad('缺 6 卻有 7：建錯了，不是 heap', HX(7) - 0.4, HY(7) - 0.9);
  say('中間有缺漏，就不是 heap', '那是建錯了');
  void hole;
}]);

// 29:23 用 array 存 Heap：index 從 1 開始
FRAG.push(['grjiang2-heap-array', 'Heap 存在 array：小孩 2i、2i+1，parent ⌊i/2⌋', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null;
  await step(tok);                                   // 1770 用 array 就行
  const dev = buddy('', '', '#9fb8ff', -6.4, 2.6, 0.6, 0.5);
  say('實作很簡單：就用 array', '');
  await step(tok);                                   // 1776 index 連續 1..n
  H = j2Heap([14, 12, 7, 10, 8, 6], { cap: 10, drop: 1.5 });
  say('complete binary tree 的編號是連續的', '1、2、3…n，沒有斷開');
  await step(tok);                                   // 1805 index 0 捨棄不用
  cube('', J2.gray, [0.9, 0.55, 0.55], AX(0), 0.4, 0, 1); tag('0', 'idx', AX(0), -0.3);
  bad('不用', AX(0), 1.1);
  say('投影片把 index 0 空下來不用', '從 1 開始，比較好對應');
  await step(tok);                                   // 1821 6 筆 data，後面空的
  for (let i = 7; i <= 10; i++) tag('空', 'idx', AX(i), 1.1);
  say('這是 6 筆 data 的 max heap', '後面的格子是空的');
  await step(tok);                                   // 1837 宣告 array，心中是 Heap
  bub('宣告的是 array，心中把它當 Heap', -3.4, 3.2, 0.6);
  dev.mood('happy');
  say('宣告時是 array', '但心中要知道它是一個 Heap');
  await step(tok);                                   // 1867 root index 1，小孩 2、3
  H.hi(1, GOLD); H.hi(2, RED); H.hi(3, RED);
  say('root 是 index 1', '它的小孩在 index 2、3');
  await step(tok);                                   // 1885 2 的小孩 4、5：2i、2i+1
  H.unhi(); H.hi(2, GOLD); H.hi(4, RED); H.hi(5, RED);
  const rule = pkt('小孩：2i、2i+1', 3.6, 3.2);
  say('index 2 的小孩：4、5', '兩倍、兩倍加 1');
  await step(tok);                                   // 1893 找到 10 和 8
  say('所以找到 10 和 8 這兩筆', '');
  await step(tok);                                   // 1903 反過來：parent = 除以 2
  H.unhi(); H.hi(4, GOLD); H.hi(2, RED);
  txt(rule, '小孩：2i、2i+1　parent：i / 2');
  say('反過來，4 號的 parent？', '自己的 index 除以 2：4 ÷ 2 = 2');
  await step(tok);                                   // 1918 5 號的 parent 也是 2 → 取下限
  H.unhi(); H.hi(5, GOLD); H.hi(2, RED);
  txt(rule, '小孩：2i、2i+1　parent：⌊i/2⌋');
  say('5 號的 parent 也是 2', '除以 2 取下限：⌊5/2⌋ = 2');
  await step(tok);                                   // 1952 heap size
  H.unhi();
  const hs = ghostBox('#2f7fd0', AX(6) - AX(1) + 1.0, 0.9, 0.9); hs.position.set((AX(1) + AX(6)) / 2, 0.4, 0);
  tag('heap size = 6', 'ptr alt', AX(3.5), -1.1);
  say('heap size：從 index 1 開始', '有幾筆維持 Heap 的形式');
  await step(tok);                                   // 1971 capacity
  tag('capacity = 10（array 長度，可能宣告 100 萬）', 'ptr', AX(7), -1.8);
  say('capacity：宣告的 array 長度', '可能宣告 100 萬，只放 5 筆');
  await step(tok);                                   // 1990 heap size 決定誰在 PQ 裡
  glow(dev.body, null);
  say('heap size 告訴我們：', '有多少筆在 priority queue 裡');
  await step(tok);                                   // 1999 超出範圍的不理
  for (let i = 7; i <= 10; i++) bad('✗', AX(i), 1.7);
  say('超出 heap size 的格子完全不理', '在 array 裡，但不在 Heap 裡');
}]);

// 33:33 insert 1、insert 21
FRAG.push(['grjiang2-heap-insert', 'Heap insert：放尾巴、往上浮（insert 1、insert 21）', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([20, 15, 2, 14, 10], { cap: 7 });
  const nw = { v: 0, T: null, R: null };
  const add = (v) => {
    const i = ++H.n; H.A[i] = v;
    H.T[i] = cube(v, J2.exp, [0.8, 0.7, 0.6], HX(i), HY(i), 0, 2.5); H.R[i] = cube(v, J2.exp, [0.9, 0.55, 0.55], AX(i), 0.4, 0, 2.5);
    H.edges(); return i;
  };
  let k = 0, card = null;
  await step(tok);                                   // 2019 insert 一筆新的 data
  say('最簡單的操作：insert 一筆新 data', 'max heap：20 15 2 14 10');
  await step(tok);                                   // 2025 key value = 1
  card = pkt('新 data：key 1', 4.6, 6.6);
  say('要 insert 的 key value 是 1', '它應該放在哪裡？');
  await step(tok);                                   // 2053 complete binary tree 要接在尾巴
  const slot = ghostBox(J2.exp, 0.9, 0.8, 0.7); slot.position.set(HX(6), HY(6), 0);
  say('它是 complete binary tree', '5 筆變 6 筆：第 6 個位置');
  await step(tok);                                   // 2065 先塞在最尾巴
  kill(slot); remove(card);
  k = add(1);
  say('先塞在最尾巴：index 6', '');
  await step(tok);                                   // 2072 可能違反大小關係
  H.hi(k, GOLD);
  say('塞進去可能會違反 max heap 的大小關係', '要檢查一下');
  await step(tok);                                   // 2088 一塞就對：1 ≤ parent 2
  H.hi(3, RED);
  say('1 沒有比 parent 2 大', '還是 max heap');
  await step(tok);                                   // 2107 只要確認和 parent 的關係
  H.unhi(); H.tint(k, J2.blue);
  good('只要確認新來的和 parent ✓', 3.6, 2.0);
  say('其他人本來就對，只要確認新的和 parent', 'insert 結束');
  await step(tok);                                   // 2119 再 insert 21
  card = pkt('新 data：key 21', 4.6, 6.6);
  say('再 insert 一筆：key 21', '');
  await step(tok);                                   // 2134 開新欄位塞進去
  remove(card);
  k = add(21);
  say('一樣先開新欄位、塞在尾巴', 'index 7');
  await step(tok);                                   // 2143 比 parent 大
  H.hi(k, GOLD); H.hi(3, RED);
  say('21 比 parent 2 大', '不維持 max heap 的關係');
  await step(tok);                                   // 2159 跟 parent 交換，跳上來
  H.swap(7, 3); k = 3; H.unhi(); H.hi(3, GOLD);
  say('和 parent 交換：21 跳上來', '');
  await step(tok);                                   // 2166 繼續往上 check
  H.hi(1, RED);
  say('繼續往上和 parent 比', '21 vs 20');
  await step(tok);                                   // 2172 21 > 20 再換，到 root
  H.swap(3, 1); k = 1; H.unhi(); H.hi(1, GREEN);
  say('21 還是比 20 大，再換', '最差一路升到 root 才停');
  await step(tok);                                   // 2191 insert：放尾巴、往上飄
  H.unhi();
  note('insert：放最尾巴 → 一層一層往上浮', 0, -1.2);
  say('insert：先放最尾巴，再往上飄', 'worst case 飄到頂端');
  await step(tok);                                   // 2205 複雜度多高？
  const qq = bub('要飄幾層？', HX(7), HY(7) - 1, 0.6);
  say('這樣的 complexity 有多高？', '');
  await step(tok);                                   // 2232 log n
  remove(qq);
  tag('最多跳到 root：高度 = log n → O(log n)', 'ptr alt', 0, -2.0);
  say('最多跳到 root 就停', 'log n 次 → O(log n)');
  void nw;
}]);

// 37:27 pop（Extract-Max）
FRAG.push(['grjiang2-heap-pop', 'Heap pop：拔 root、尾巴補上、往下沉', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([21, 15, 20, 14, 10, 1, 2]);
  await step(tok);                                   // 2247 pop = remove
  say('接著是 pop：把 data 拿出來處理', '處理完就離開 = remove');
  await step(tok);                                   // 2267 一定先處理 priority 最高的
  say('它是 priority queue', '每次一定先處理 priority 最高的');
  await step(tok);                                   // 2291 max heap：remove root
  H.hi(1, GOLD);
  say('Max heap 要 remove 誰？', 'remove root（21）');
  await step(tok);                                   // 2306 還要維持大小關係
  note('remove 後，剩下的還要是 max heap', 0, -1.2);
  say('remove 後還要讓剩下的人', '維持正常的 max heap 大小關係');
  await step(tok);                                   // 2325 現在 7 筆
  tag('7 筆 → 6 筆', 'ptr alt', 4.6, 6.6);
  say('現在有 7 筆，pop 後應該剩 6 筆', '');
  await step(tok);                                   // 2343 拔掉：上面一個洞
  fly(H.T[1]); fly(H.R[1]); H.T[1] = H.R[1] = null; H.A[1] = null;
  const hole = ghostBox(J2.bad, 0.9, 0.8, 0.7); hole.position.set(HX(1), HY(1), 0);
  say('拔掉 root：上面空了一個洞', '');
  await step(tok);                                   // 2355 最尾巴的人填上去
  kill(hole);
  H.hi(7, GOLD); H.swap(1, 7);
  await beat(tok, 600);
  H.n = 6; H.edges(); H.A.length = 7; H.T.length = 7; H.R.length = 7;
  say('叫排名最尾巴的 2 先填到 root', '先把洞塞住');
  await step(tok);                                   // 2369 heap size 對了，只是大小不正常
  say('heap size 對了：6 筆', '只是大小關係不正常');
  await step(tok);                                   // 2384 只有新 root 錯
  for (let i = 2; i <= 6; i++) H.hi(i, GREEN);
  say('除了新 root，其他人原本就是 max heap', '只要修正它');
  await step(tok);                                   // 2399 往下換
  H.unhi(); H.hi(1, GOLD);
  say('跟 insert 往上浮很像', '這次是往下換');
  await step(tok);                                   // 2420 左右小孩比，大的有資格
  H.hi(2, RED); H.hi(3, RED);
  say('跟左右兩個小孩都比一下', '15 和 20：大的那個有資格交換');
  await step(tok);                                   // 2435 20 跳上來
  H.unhi(); H.swap(1, 3); H.hi(3, GOLD);
  say('20 跳上來，2 換下去', '');
  await step(tok);                                   // 2443 2 再往下 check，正常就停
  H.hi(6, RED);
  await beat(tok, 500);
  H.unhi(); H.hi(1, GREEN);
  say('2 再往下 check：2 ≥ 1，正常', '停下來：20 15 2 14 10 1');
  await step(tok);                                   // 2456 拔 root O(1)
  H.unhi();
  note('① 拔 root：O(1)', -4.0, -1.2);
  say('Complexity：拔掉 root 是 O(1)', '');
  await step(tok);                                   // 2464 搬尾巴 O(1)
  note('② 尾巴搬上來：O(1)', 0, -1.2);
  say('把尾巴搬上來也是 O(1)', '');
  await step(tok);                                   // 2477 沉到 leaf：log n
  tag('③ 最多沉到 leaf：O(log n)', 'ptr alt', 4.0, -1.2);
  say('最花時間的：一路沉到 leaf', 'log n 次 → O(log n)');
}]);

// 41:45 MAX-HEAPIFY 的想法
FRAG.push(['grjiang2-max-heapify', 'MAX-HEAPIFY：假設兩個 subtree 都是 heap，只修正自己', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null, cnt = null, sub = [];
  const st = buddy('', '', '#f4a56a', 6.2, 0, 1.2, 0.55);
  await step(tok);                                   // 2509 很重要的 operation
  tag('MAX-HEAPIFY', 'ptr alt', 0, 7.0);
  say('Heap 很重要的 operation：MAX-HEAPIFY', '');
  await step(tok);                                   // 2527 -ify：使它變成 heap
  note('-ify = 動詞：使它變成 heap', 0, 6.3);
  say('-ify 是動詞：讓資料變成 max heap 的形式', '');
  await step(tok);                                   // 2553 min heap 也有 MIN-HEAPIFY
  note('min heap 對應 MIN-HEAPIFY', 0, 5.6);
  say('min priority queue 就有對應的', 'MIN-HEAPIFY');
  await step(tok);                                   // 2562 亂放的 array 怎麼修？
  H = j2Heap([1, 5, 2, 9, 8, 7, 6], { drop: 1.5 });
  st.mood('wow');
  say('給一堆亂放在 array 裡的數字', '要怎麼修成 max heap？');
  await step(tok);                                   // 2607 直覺：root 先拿出來和小孩比
  H.hi(1, GOLD); H.hi(2, RED); H.hi(3, RED);
  say('第一個直覺：root 先拿出來看', '和它的小孩比一比');
  await step(tok);                                   // 2623 不對就換上來，下面又違反再換
  H.unhi(); H.swap(1, 2); await beat(tok, 500); H.swap(2, 4); await beat(tok, 500);
  cnt = tag('已交換 2 次', 'ptr', 4.6, 6.4);
  H.hi(1, RED); H.hi(2, RED);
  say('不對就換上來；換下去又違反，再換', '');
  await step(tok);                                   // 2640 很多 redundant 交換
  bad('上面又壞了（5 < 9）→ 還要再換', 0.0, 1.6);
  txt(cnt, '換了又換…');
  st.mood('sad');
  say('這樣會做很多 redundant 的交換', '');
  await step(tok);                                   // 2687 同學：用遞迴？
  H.unhi();
  bub('用遞迴（recursive）？', 4.6, 1.6, 1.2);
  say('同學說：用遞迴', '那真正是從誰開始修？');
  await step(tok);                                   // 2723 bottom-up
  pkt('↑ bottom-up：從下面修上來', -4.8, 2.4);
  st.mood('happy');
  say('真正的修正是 bottom-up', '從下面修上來');
  await step(tok);                                   // 2732 也可以 iterative
  note('recursive 和 iterative 可以互換', -4.8, 1.6);
  say('可以 recursive，也可以 iterative', '從最下層一個一個掃上來');
  await step(tok);                                   // 2757 本質是數學歸納法
  tag('本質：數學歸納法', 'ptr alt', 4.6, 5.6);
  say('這個 operation 本質上就是', '數學歸納法的 idea');
  await step(tok);                                   // 2772 修自己時假設小孩正常
  H.T.forEach((m) => m && kill(m)); H.R.forEach((m) => m && kill(m)); H.lines.forEach(kill); H.idx.forEach(remove);
  H = j2Heap([3, 9, 8, 5, 4, 7, 6], { drop: 1.2 });
  H.hi(1, GOLD);
  say('修正自己時：先假設下面的小孩都正常', '');
  await step(tok);                                   // 2794 左右 subtree 各自是 heap
  for (const [x, y] of [[HX(2), HY(2) - 0.7], [HX(3), HY(3) - 0.7]]) { const g = ghostBox('#1f9e6e', 5.0, 2.4, 1.0); g.position.set(x, y, -0.2); sub.push(g); }
  good('左 subtree 是 heap', HX(2), HY(5) - 0.9); good('右 subtree 是 heap', HX(3), HY(7) - 0.9);
  say('假設左、右 subtree 各自已是 heap', '');
  await step(tok);                                   // 2816 只處理我和兩個小孩
  H.hi(2, RED); H.hi(3, RED);
  say('只要處理「我」和左右兩個小孩', '這樣看就簡單多了');
  await step(tok);                                   // 2823 不是最大就和最大的小孩換
  H.unhi(); H.swap(1, 2); H.hi(2, GOLD);
  say('三個人裡誰最大？我不是最大', '就和最大的小孩交換：9 上來');
  await step(tok);                                   // 2829 再往下比，沉到底
  H.hi(4, RED); H.hi(5, RED); await beat(tok, 500);
  H.unhi(); H.swap(2, 4); H.hi(4, GOLD);
  say('換下去後再和下面的小孩比', '不對再沉，一路沉到底');
  await step(tok);                                   // 2884 base case：最簡單的在哪？
  H.unhi(); sub.forEach(kill);
  say('數學歸納法先看 base case', '在 tree 的哪裡最簡單？');
  await step(tok);                                   // 2915 最下面：leaf 的 parent
  for (const i of [2, 3]) H.hi(i, GOLD);
  say('最下面要修的是：leaf 的 parent', '');
  await step(tok);                                   // 2928 一個 node 就是一個 heap
  for (const i of [4, 5, 6, 7]) H.hi(i, GREEN);
  note('leaf：只有一個 node，自己就是 heap', 0, 0.0);
  say('leaf 下面沒人：一個 node 自己就是 heap', '');
  await step(tok);                                   // 2944 從 leaf 的 parent 開始做
  H.unhi(); H.hi(3, GOLD); H.hi(2, GOLD);
  say('所以從 leaf 的 parent 開始做', '它的兩個小孩一定是 heap');
  await step(tok);                                   // 2963 往上一層，下面一定是 heap
  H.unhi(); H.hi(1, GOLD); for (let i = 2; i <= 7; i++) H.hi(i, GREEN);
  say('修完再往上一層：下面一定都是 heap', '每次只要檢查自己和小孩');
  await step(tok);                                   // 3009 時間看這個點多高
  H.unhi();
  tag('時間 = 這個點的高度（最多換到底）', 'ptr alt', 0, -1.2);
  say('修正一個點要多久？', '看它在多高：最多換到底');
}]);

// 50:40 MAX-HEAPIFY 例子：5 個點
FRAG.push(['grjiang2-heapify-example', 'MAX-HEAPIFY 例子：從 ⌊n/2⌋ 開始，root 的 1 一路沉到底', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([1, 15, 2, 14, 10], { drop: 1.5 });
  const it = tag('', 'ptr alt', 4.2, 6.6);
  await step(tok);                                   // 3043 從 leaf 端開始修
  say('實際做的時候：先從 leaf 端開始修正', '');
  await step(tok);                                   // 3058 最後一個 leaf 的 parent：n/2
  pkt('從 ⌊n/2⌋ 開始（最後一個 leaf 的 parent）', -2.6, -1.2);
  say('從最後一個 leaf 的 parent 開始', 'heap size = n → 從 n/2 開始');
  await step(tok);                                   // 3069 從右側往上修
  say('從右邊往上一個一個修正', '');
  await step(tok);                                   // 3078 這裡 5 個點
  for (let i = 1; i <= 5; i++) { H.hi(i, GOLD); await beat(tok, 150); }
  H.unhi();
  say('這裡只有 5 個點', '');
  await step(tok);                                   // 3086 5 的 parent 在 index 2
  H.hi(5, RED); H.hi(2, GOLD); txt(it, 'MAX-HEAPIFY(2)');
  say('最後一個 leaf 是 index 5', 'parent 在 ⌊5/2⌋ = 2');
  await step(tok);                                   // 3093 看 15 和小孩 14、10
  H.hi(4, RED);
  say('看 15 和它的小孩 14、10', '');
  await step(tok);                                   // 3103 已經是 max heap，沒事
  H.unhi(); H.hi(2, GREEN);
  say('15 ≥ 14、10：已經是 max heap', '沒事');
  await step(tok);                                   // 3118 往上到 root
  H.unhi(); H.hi(1, GOLD); txt(it, 'MAX-HEAPIFY(1)');
  say('再往上：直接到 root', '');
  await step(tok);                                   // 3127 1 和 15、2 不正常
  H.hi(2, RED); H.hi(3, RED);
  say('1 和小孩 15、2：大小關係不正常', '');
  await step(tok);                                   // 3134 大的換上來，1 沉下去
  H.unhi(); H.swap(1, 2); H.hi(2, GOLD);
  say('較大的 15 換上來，1 沉下去', '');
  await step(tok);                                   // 3142 再往下確認，沉到底
  H.hi(4, RED); H.hi(5, RED); await beat(tok, 500);
  H.unhi(); H.swap(2, 4); H.hi(4, GOLD);
  await beat(tok, 400);
  H.unhi(); H.hi(1, GREEN);
  say('1 再和 14、10 比：還是不對，再沉', '沉到底：15 14 2 1 10');
  await step(tok);                                   // 3150 complexity 看高度
  H.unhi();
  tag('最多沉到底：看這個點的高度', 'ptr', 0, -1.9);
  say('Complexity 看當下這個點的高度', 'worst case 沉到底');
  await step(tok);                                   // 3166 這就是 MAX-HEAPIFY
  txt(it, '這就是 MAX-HEAPIFY');
  say('假設小孩都是 heap，修正自己一個人', '這個 operation 叫 MAX-HEAPIFY');
}]);

// 53:16 BUILD-MAX-HEAP（CLRS 例子）
FRAG.push(['grjiang2-build-heap', 'Build max heap：i = ⌊n/2⌋ 到 1 依序 MAX-HEAPIFY', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null;
  const it = tag('', 'ptr alt', 4.4, 6.9);
  const bld = buddy('', '', '#f4a56a', -6.4, 4.6, 0.6, 0.5);
  await step(tok);                                   // 3196 用 MAX-HEAPIFY build 整個 heap
  bld.mood('happy');
  say('會 MAX-HEAPIFY 之後', '就能 build up 整個 heap');
  await step(tok);                                   // 3210 反覆用，從 leaf 的 parent 開始
  note('反覆 MAX-HEAPIFY，從 leaf 的 parent 開始', 0, -1.2);
  say('反覆使用 MAX-HEAPIFY', '從 leaf 的 parent 開始用');
  await step(tok);                                   // 3238 10 筆資料
  H = j2Heap([4, 1, 3, 2, 16, 9, 10, 14, 8, 7], { drop: 1.5 });
  say('例子：10 筆資料，array 開 10 格', '4 1 3 2 16 9 10 14 8 7');
  await step(tok);                                   // 3252 不維持 max heap
  H.hi(2, RED); H.hi(5, RED);
  say('它不維持 max heap 的關係', '只是一堆亂七八糟的數字');
  await step(tok);                                   // 3272 最後一筆在 10，parent 是 5（16）
  H.unhi(); H.hi(10, RED); H.hi(5, GOLD); txt(it, 'MAX-HEAPIFY(5)');
  say('最後一筆在 index 10', 'parent 在 index 5：16');
  await step(tok);                                   // 3286 直接符合
  H.unhi(); H.hi(5, GREEN);
  say('16 ≥ 7：直接符合，結束', '');
  await step(tok);                                   // 3294 5、4、3、2、1 往上
  H.unhi();
  for (let i = 5; i >= 1; i--) { tag('i=' + i, 'ptr', HX(i) + 0.7, HY(i) + 0.45); await beat(tok, 200); }
  say('接下來就是 5、4、3、2、1 往上做', '');
  await step(tok);                                   // 3301 index 4：2 和 14、8 → swap
  txt(it, 'MAX-HEAPIFY(4)'); H.hi(4, GOLD);
  await H.sink(tok, 4, 500); H.unhi();
  say('index 4 是 2：和 14、8 不對', 'swap：14 上來');
  await step(tok);                                   // 3313 index 3 swap
  txt(it, 'MAX-HEAPIFY(3)'); H.hi(3, GOLD);
  await H.sink(tok, 3, 500); H.unhi();
  say('index 3 是 3：也 swap 一下', '10 上來');
  await step(tok);                                   // 3320 index 2：左右都是 heap
  txt(it, 'MAX-HEAPIFY(2)'); H.hi(2, GOLD); H.hi(4, GREEN); H.hi(5, GREEN);
  say('index 2 比較複雜', '左右都是 heap，自己和小孩不對');
  await step(tok);                                   // 3335 16 換上來
  H.unhi(); H.down(2); H.hi(5, GOLD);
  say('先和較大的小孩換：16 換上來', '');
  await step(tok);                                   // 3344 1 再和 7 換，沉到底
  H.down(5); H.unhi(); H.hi(2, GREEN);
  say('1 沉下來後再和 7 換', '一路沉到底');
  await step(tok);                                   // 3352 最後修 root
  H.unhi(); txt(it, 'MAX-HEAPIFY(1)'); H.hi(1, GOLD); H.hi(2, GREEN); H.hi(3, GREEN);
  say('最後修正 root', '左右 subtree 都已是 heap');
  await step(tok);                                   // 3359 大的換上來，4 換下去
  H.unhi(); H.down(1); H.hi(2, GOLD);
  say('大的 16 換上來，4 換下去', '');
  await step(tok);                                   // 3366 再一路修到底，結束
  await H.sink(tok, 2, 500);
  H.unhi(); for (let i = 1; i <= 10; i++) H.hi(i, GREEN);
  txt(it, '完成：16 14 10 8 7 9 3 2 4 1');
  say('4 再一路往下修到底', '整個 heap 建好了');
  await step(tok);                                   // 3373 就是數學歸納法
  H.unhi();
  pkt('build up = 數學歸納法', -4.0, 6.9);
  say('這個 build up 的過程', '本身就是數學歸納法的做法');
  await step(tok);                                   // 3399 basis：leaf 的 parent
  for (const i of [6, 7, 8, 9, 10]) H.hi(i, GREEN);
  say('Basis：leaf 本身就是 heap', 'leaf 的 parent 可以直接 apply');
  await step(tok);                                   // 3407 iterative 做到 root
  H.unhi(); H.hi(1, GREEN);
  bld.mood('happy'); await bld.hop(tok);
  say('一個一個往上做到 root', 'Heap 就改建完成');
}]);

// 57:00 build heap 的時間（老師說 n log n；更緊的界是 O(n)）
FRAG.push(['grjiang2-build-heap-cost', 'Build heap 的時間：每點最多換「高度」次', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const H = j2Heap([16, 14, 10, 8, 7, 9, 3, 2, 4, 1], { cells: false, noRow: true });
  const hgt = (i) => { let h = 0; while (2 * i <= 10) { i *= 2; h++; } return h; };
  const sl = tag('', 'ptr alt', 0, 0.6);
  await step(tok);                                   // 3425 老師：n log n
  tag('build heap：n log n？', 'ptr alt', 0, 7.0);
  say('仔細算：build up 整個 heap', '老師說需要 n log n');
  await step(tok);                                   // 3443 看每一層
  for (let i = 1; i <= 10; i++) tag('h=' + hgt(i), 'idx', HX(i) + 0.65, HY(i) + 0.4);
  say('算法：看每一層', '每個點下面有幾層（高度 h）');
  await step(tok);                                   // 3451 leaf 的 parent 最多換一次
  const byH = [1, 2, 3].map((h) => [1, 2, 3, 4, 5].filter((i) => hgt(i) === h));
  for (const i of byH[0]) H.hi(i, GOLD);
  txt(sl, '換 1 次的：' + byH[0].length + ' 個點');
  say('leaf 的 parent 下面只有一層', '最多換 1 次');
  await step(tok);                                   // 3465 上面一層最多換兩次、三次…
  for (const i of byH[1]) H.hi(i, RED);
  for (const i of byH[2]) H.hi(i, GREEN);
  txt(sl, byH.map((g, k) => '換 ' + (k + 1) + ' 次：' + g.length + ' 個').join('　'));
  say('再上一層最多 2 次，再上去 3 次…', '');
  await step(tok);                                   // 3474 每種各有多少 node
  say('分別數：換 1 次的有幾個 node', '換 2 次、3 次的又有幾個');
  await step(tok);                                   // 3481 一路算到 root
  txt(sl, '總共 ≤ ' + byH.map((g, k) => (k + 1) + '×' + g.length).join(' + ') + ' = ' + byH.reduce((s, g, k) => s + (k + 1) * g.length, 0) + ' 次交換');
  say('一路算到 root', '把每層的交換次數加起來');
  await step(tok);                                   // 3488 加總：n log n
  H.unhi();
  tag('老師：O(n log n)（正確的上界）', 'ptr', 0, -0.4);
  note('補充：Σ h · n/2^(h+1) = O(n)，更緊（CLRS 6.3）', 0, -1.3);
  say('加總得到 n log n 的 order', '補充：更仔細算其實是 O(n)');
}]);

// 58:51 heapsort
FRAG.push(['grjiang2-heapsort', 'Heapsort：root 換到尾巴、heap size − 1、MAX-HEAPIFY', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null;
  const sorter = buddy('', '', '#9fb8ff', -6.4, 4.6, 0.6, 0.5);
  const takeOut = (n) => { H.swap(1, n); H.n = n - 1; H.edges(); H.tint(n, J2.gray); if (H.T[n]) { kill(H.T[n]); H.T[n] = null; } };
  const hs = tag('', 'ptr alt', 4.4, 6.9);
  await step(tok);                                   // 3531 能不能用 heap 從小排到大？
  sorter.mood('wow');
  bub('建好 max heap 後，能排序嗎？', -4.4, 6.0, 0.6);
  say('建好 max heap 之後', '能不能用它從小排到大？');
  await step(tok);                                   // 3553 小的在前、大的在後
  const arr = [1, 2, 3, 4, 7].map((v, k) => cube(v, J2.gray, [0.8, 0.5, 0.5], -1.6 + k * 0.9, -1.0, 0.4, 1));
  say('希望 output 的 array', '最小的在最前面、最大的在最後面');
  await step(tok);                                   // 3589 會 extract max、會 build heap
  arr.forEach(kill);
  note('已經會：extract max、build heap', 0, -1.2);
  say('我們已經會：extract max', '拿出最大值後剩下還能恢復成 heap');
  await step(tok);                                   // 3604 最大值 16 應該在最尾巴
  pkt('16 → 最後一格', 4.6, 2.2);
  say('最大值是誰？16', '它應該在 output 的最尾巴');
  await step(tok);                                   // 3669 第一階段：build heap
  H = j2Heap([16, 14, 10, 8, 7, 9, 3, 2, 4, 1], { drop: 1.5 });
  txt(hs, '第一階段：build max heap');
  say('第一階段：把亂放的數字 build 成 max heap', '16 14 10 8 7 9 3 2 4 1');
  await step(tok);                                   // 3680 第二階段：排序
  txt(hs, '第二階段：從小排到大');
  say('第二階段：讓它從小排到大', '');
  await step(tok);                                   // 3690 root 最大，放尾端
  H.hi(1, GOLD); H.hi(10, RED);
  say('root 是最大值', '一定要放在 output 的尾端');
  await step(tok);                                   // 3705 16 和尾巴的 1 交換
  H.unhi(); H.swap(1, 10); H.hi(10, GREEN);
  say('先把 16 和尾巴的 1 交換', '16 就站在正確的位置');
  await step(tok);                                   // 3721 剩下的人要 re-structure
  H.hi(1, GOLD);
  say('1 換上來了', '剩下的人要重新修正成 heap');
  await step(tok);                                   // 3730 左右都是 heap，只有 1 不對
  for (let i = 2; i <= 9; i++) H.hi(i, GREEN);
  say('左邊是 heap、右邊也是 heap', '只有換上來的 1 不對');
  await step(tok);                                   // 3738 MAX-HEAPIFY on root
  H.unhi(); H.hi(1, GOLD);
  tag('MAX-HEAPIFY(1)', 'ptr', -4.2, 6.9);
  say('所以要做：MAX-HEAPIFY on root', '');
  await step(tok);                                   // 3752 heap size 改成 9
  H.n = 9; H.edges(); H.tint(10, J2.gray); kill(H.T[10]); H.T[10] = null;
  txt(hs, 'heap size：10 → 9');
  say('先把 heap size 改成 9', '第 10 個人已經不在 heap 裡');
  await step(tok);                                   // 3774 MAX-HEAPIFY 修下去
  await H.sink(tok, 1, 400); H.unhi();
  say('MAX-HEAPIFY on root，一路修下去', '');
  await step(tok);                                   // 3784 root 又是剩下的最大
  H.hi(1, GOLD);
  say('修完後 root 又是剩下的人裡最大的', '14');
  await step(tok);                                   // 3790 放到第 9 格，再 heapify
  H.unhi(); takeOut(9); await beat(tok, 400);
  await H.sink(tok, 1, 300);
  txt(hs, 'heap size：9 → 8');
  say('把它放到第 9 個位置', '換上來的人再做 MAX-HEAPIFY');
  await step(tok);                                   // 3800 iteratively，一個個固定
  for (let n = 8; n >= 2; n--) { takeOut(n); await beat(tok, 90); await H.sink(tok, 1, 70); txt(hs, 'heap size：' + (n - 1)); }
  H.unhi(); H.tint(1, J2.gray); if (H.T[1]) kill(H.T[1]);
  H.lines.forEach(kill);
  txt(hs, '1 2 3 4 7 8 9 10 14 16');
  say('iteratively 一直做', '一個一個把位置都固定好');
  await step(tok);                                   // 3806 build n log n + 第二階段 n log n
  tag('build：n log n　＋　第二階段：n log n', 'ptr', 0, 6.0);
  say('前面 build heap：n log n', '第二階段 restructure：也是 n log n');
  await step(tok);                                   // 3824 這叫 heapsort
  tag('Heapsort：O(n log n)', 'ptr alt', 0, 5.0);
  sorter.mood('happy');
  say('用 Heap 完成排序：叫 heapsort', '整體 O(n log n)');
  await step(tok);                                   // 3840 最快；merge sort 也一樣快
  note('沒有額外資訊時已是最快；merge sort 一樣快', 0, 4.1);
  say('沒有額外資訊幫忙時，heapsort 就是最快', 'merge sort 也一樣快');
  await step(tok);                                   // 3858 資料結構很簡單：array
  good('data structure 很簡單：就是 array', 0, 3.2);
  say('heapsort 很好做', '它的 data structure 很簡單，就是 array');
  await step(tok);                                   // 3866 只開這個 array，省 memory
  for (let i = 1; i <= 10; i++) glow(H.R[i], GREEN);
  say('從頭到尾只用這個 array', '沒有開其他 data structure → 省 memory');
  await step(tok);                                   // 3892 in-place sorting
  for (let i = 1; i <= 10; i++) glow(H.R[i], null);
  pkt('in-place sorting：當場排好', 0, 2.3);
  await sorter.hop(tok);
  say('直接對 input 的 array 操作', '這叫 in-place sorting');
}]);

// 65:09 min heap 對稱 → 自己的 Dijkstra implementation
FRAG.push(['grjiang2-minheap-dijkstra', 'Min heap 與 Dijkstra：用 min heap 實作 min-priority queue', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let H = null;
  const dj = buddy('Dijkstra', '', '#f4a56a', 5.6, 0.4, 1.0, 0.65);
  await step(tok);                                   // 3909 max heap 和 min heap 對稱
  H = j2Heap([0, 5, 7, 8, 9], { cells: false, noRow: true, drop: 1.5 });
  for (let i = 1; i <= 5; i++) H.tint(i, J2.exp);
  tag('min heap：每個點 ≤ 小孩，root 最小', 'ptr alt', 0, 7.0);
  say('max heap 和 min heap 是對稱的', '往另一個方向推，就是 min heap');
  await step(tok);                                   // 3920 寫出自己的 Dijkstra
  dj.mood('happy');
  bub('我可以自己寫 Dijkstra 了！', 3.6, 2.2, 1.0);
  say('這樣就能寫出屬於自己的', 'Dijkstra implementation');
  await step(tok);                                   // 3926 min heap 做 min-PQ
  H.hi(1, GREEN);
  pkt('min heap → min-priority queue → Extract-Min 就拿 root', 0, -0.8);
  await dj.hop(tok);
  say('用 min heap 實作 min-priority queue', 'Extract-Min 就是拿 root');
}]);

// 65:40 MST：第四台拉線的例子（圖與數字為示意）
const J2M_P = { A: [-4.6, 4.6], B: [0, 5.6], C: [4.6, 4.6], D: [-3.6, 0.6], E: [0.6, 1.6], F: [4.8, 0.6] };
const J2M_E = [['A', 'B', 4], ['A', 'D', 2], ['B', 'D', 5], ['B', 'E', 3], ['B', 'C', 6], ['C', 'E', 2], ['C', 'F', 4], ['E', 'F', 5], ['D', 'E', 7]];
FRAG.push(['grjiang2-mst-cable', 'Minimum spanning tree：用最少的線連到每一戶', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  let G = null;
  const title = tag('', 'ptr alt', 0, 7.2);
  const ppl = buddy('', '', '#f4a56a', -6.4, -1.4, 1.2, 0.55);
  await step(tok);                                   // 3940 最後一個問題：MST
  txt(title, 'Minimum spanning tree（MST）');
  say('本單元最後一個問題：minimum spanning tree', '演算法裡非常重要的主題');
  await step(tok);                                   // 3956 Prim's
  const m1 = note('① Prim\'s algorithm', -4.0, 6.4);
  say('會介紹三個方法：第一個是 Prim 提出的', 'Prim\'s algorithm');
  await step(tok);                                   // 3968 Kruskal's
  const m2 = note('② Kruskal\'s algorithm', 0, 6.4);
  say('第二個是 Kruskal 提出的', 'Kruskal\'s algorithm');
  await step(tok);                                   // 3977 reverse-delete：對但很少人用
  const m3 = note('③ reverse-delete（很耗時）', 4.0, 6.4);
  say('第三個：reverse-delete', '是對的，但很耗時，現在沒人用');
  await step(tok);                                   // 3994 第四台的例子
  [m1, m2, m3].forEach(remove);
  G = j2Graph(J2M_P, J2M_E, { undirected: true, drop: 1.5, tagDy: 0.8 });
  for (const e of G.E) showL(e.lb, false);
  for (const k of Object.keys(G.N)) { const h = prop('warehouse', G.P[k][0] + 0.75, G.P[k][1] - 0.4, -0.9, 0.35); bob(h, 0.03); }
  say('例子：搬到新家，想裝第四台', '');
  await step(tok);                                   // 4024 從最近的線路拉一條過來
  G.e('A', 'D').set(J2.hot);
  say('業者會從已有線路裡最近的點', '拉一條線到你家');
  await step(tok);                                   // 4041 很多使用者，要建整個網路
  G.e('A', 'D').set(J2.edge);
  ppl.mood('happy');
  say('業者有很多使用者', '要建一個健全的 cable 網路');
  await step(tok);                                   // 4058 cost 跟長度有關，總長最短
  for (const e of G.E) showL(e.lb, true);
  say('cable 很貴，cost 跟長度有關', '希望用總長最短的線送到每一戶');
  await step(tok);                                   // 4083 greedy 可以達到 optimal
  good('greedy 就能到 optimal', 4.6, -1.4);
  say('這個問題運氣很好', '用 greedy 就能達到 optimal solution');
  await step(tok);                                   // 4099 隨便怎麼 greedy 都對
  bub('直覺的 greedy 都會對！', -4.6, -0.3, 1.2);
  say('很直覺的 greedy 方法都會對', '不需要特別精細的 criterion');
  await step(tok);                                   // 4131 input：沒有方向的 graph
  txt(title, 'Input：undirected graph');
  say('Input：一個 graph，沒有方向性', '拉線不分方向');
  await step(tok);                                   // 4143 點和點之間有 cost
  for (const e of G.E) j2Cls(e.lb, 'ptr');
  say('點和點之間有 cost', 'cable 費用或距離；造橋鋪路也一樣');
  await step(tok);                                   // 4164 cost 非負
  for (const e of G.E) j2Cls(e.lb, 'idx');
  note('每條 edge cost ≥ 0：拉線就要花錢', 0, -1.4);
  say('每條 edge 的 cost 都非負', '只要拉線就要花錢');
  await step(tok);                                   // 4180 有 edge = 可以拉線
  say('有 edge = 兩戶之間可以拉線', '沒有 edge：可能太遠、不適合拉');
  await step(tok);                                   // 4220 選一些 edge 的 subset
  const pickA = [['A', 'B'], ['B', 'D'], ['B', 'C'], ['C', 'F'], ['D', 'E']];
  for (const [a, b] of pickA) { G.e(a, b).set(J2.hot); await beat(tok, 300); }
  const tot = tag('total = 4 + 5 + 6 + 4 + 7 = 26', 'ptr', 0, 7.2);
  txt(title, '');
  say('從這些 edge 裡選一個 subset 出來', '');
  await step(tok);                                   // 4227 total cost 越低越好
  say('目標只有一個：total cost 越低越好', '');
  await step(tok);                                   // 4237 每一戶都要連到
  for (const k of Object.keys(G.N)) { glow(G.N[k], GOLD); await beat(tok, 150); }
  say('而且每一個客戶都要連到', '不能有人收不到訊號');
  await step(tok);                                   // 4253 選出的 subgraph 要 connected
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  say('選出的 edge 把所有點連起來', '這個 subgraph 是 connected');
  await step(tok);                                   // 4263 minimum spanning graph
  for (const e of G.E) e.set(J2.edge);
  const best = [['A', 'D'], ['C', 'E'], ['B', 'E'], ['A', 'B'], ['C', 'F']];
  for (const [a, b] of best) { G.e(a, b).set(J2.tree); await beat(tok, 300); }
  for (const k of Object.keys(G.N)) tint(G.N[k], J2.exp);
  txt(tot, 'total = 2 + 2 + 3 + 4 + 4 = 15（最便宜，數字為示意）');
  say('要找的是 minimum spanning graph', '');
  await step(tok);                                   // 4277 spanning = 蓋住所有點
  for (const k of Object.keys(G.N)) glow(G.N[k], GREEN);
  say('spanning：蓋住所有的點', '');
  await step(tok);                                   // 4282 minimum = total cost 最低
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  j2Cls(tot, 'ptr alt');
  await ppl.hop(tok);
  say('minimum：total cost 最低', '');
}]);

// 71:31 為什麼解一定是 tree：有 cycle 就剪掉一條
FRAG.push(['grjiang2-mst-tree', '為什麼答案是 tree：有 cycle 就剪一條，仍 connected 且更便宜', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const G = j2Graph(J2M_P, J2M_E, { undirected: true, tagDy: 0.8 });
  const sel = [['A', 'B'], ['A', 'D'], ['D', 'E'], ['B', 'E'], ['C', 'E'], ['C', 'F']];
  const cyc = [['A', 'B'], ['B', 'E'], ['D', 'E'], ['A', 'D']];
  const title = tag('', 'ptr alt', 0, 7.2);
  let cost = null;
  await step(tok);                                   // 4291 再進一步看要找什麼
  say('開始設計演算法之前', '再看清楚：我們真正要找的是什麼');
  await step(tok);                                   // 4305 final subgraph 是 general graph？
  txt(title, '要找的 subgraph：一般的 graph？');
  say('最後找的 subgraph 長什麼樣？', '是一般的 graph 嗎？');
  await step(tok);                                   // 4312 只要是一棵 tree
  txt(title, '推敲後：只要是一棵 tree');
  say('仔細推敲：只要是一棵 tree 就行', '');
  await step(tok);                                   // 4333 所以叫 MST
  txt(title, 'minimum spanning tree，不是 …graph');
  say('所以問題叫 minimum spanning tree', '而不是 minimum spanning graph');
  await step(tok);                                   // 4344 選出的 edge 存在 T，黏起所有點
  for (const [a, b] of sel) G.e(a, b).set(J2.tree);
  cost = tag('T：4 + 2 + 7 + 3 + 2 + 4 = 22', 'ptr', 0, -0.8);
  say('選出的 edge 存在 subset T 裡', '要把所有點黏起來');
  await step(tok);                                   // 4376 一定沒有 cycle
  txt(title, '這個 graph 一定沒有 cycle');
  say('這樣的 graph 一定沒有 cycle', '為什麼？');
  await step(tok);                                   // 4384 假設有 cycle
  for (const [a, b] of cyc) { G.e(a, b).set(J2.hot); await beat(tok, 300); }
  say('假設選出來的有 cycle', 'A–B–E–D–A 串成一圈');
  await step(tok);                                   // 4398 隨便剪掉一條 edge
  G.e('D', 'E').set(J2.dim); j2Cls(G.e('D', 'E').lb, 'bad');
  const sc = bub('剪！', -1.4, 1.6, 0.6);
  say('cycle 上隨便找一條 edge 剪掉', '剪 D–E（7）');
  await step(tok);                                   // 4406 剩下變一條線，仍 connected
  remove(sc);
  for (const [a, b] of [['A', 'B'], ['B', 'E'], ['A', 'D']]) G.e(a, b).set(J2.tree);
  for (const k of ['D', 'A', 'B', 'E']) { glow(G.N[k], GOLD); await beat(tok, 300); }
  say('剩下的變成一條線：仍然 connected', 'D 還是能經過 A、B 到 E');
  await step(tok);                                   // 4416 所有 cycle 都能這樣剪
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  note('每個 cycle 都至少能剪掉一條', 0, -1.6);
  say('所有的 cycle 都能這樣剪掉一條 edge', '還是維持 connected');
  await step(tok);                                   // 4444 cost 變低
  txt(cost, 'T：22 − 7 = 15');
  good('cost 變低了', 4.4, -0.8);
  say('剪掉後還是 connected', '但 cost 變低了（那條 edge 的錢省下來）');
  await step(tok);                                   // 4457 只要一棵 tree
  for (const k of Object.keys(G.N)) tint(G.N[k], J2.exp);
  txt(title, '不需要 graph：解就是一棵 tree');
  say('所以不需要建一個 graph', '對應的解只是一棵 tree');
  await step(tok);                                   // 4475 summary：undirected graph + weight
  txt(title, 'Summary：undirected graph，edge 有 weight');
  say('Summary：給一個 undirected graph', 'edge 上有 weight');
  await step(tok);                                   // 4490 蓋住所有點、connected
  for (const k of Object.keys(G.N)) glow(G.N[k], GREEN);
  say('選 edge 的 subset：蓋住所有點', '彼此 connected');
  await step(tok);                                   // 4498 形成 tree：spanning tree
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  txt(title, 'spanning tree：蓋住所有點的 tree');
  say('形成一棵 tree：spanning tree', '');
  await step(tok);                                   // 4504 total cost 最小
  txt(title, 'minimum spanning tree：total cost 最小');
  j2Cls(cost, 'ptr alt');
  say('total cost 越小越好：minimum', '合起來就是 minimum spanning tree');
  await step(tok);                                   // 4519 有趣 property → 三種演算法
  pkt('有趣的 property → Prim、Kruskal、reverse-delete', 0, -2.4);
  say('這個問題有一些有趣的 property', '由它延伸出三種演算法');
}]);
  }

  // ═══ grjiang3.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, step, buddy, prop, bob, travel, remove, zone } = K;
// ─── 交大江蕙如 Lec14（iKhB0YbBRDI）Greedy 5/5：MST 的 Kruskal、Prim、reverse-delete；cut property（兩版證明）、
//     cycle property；實作：Prim = Dijkstra 改一行（min priority queue）、Kruskal + union-find（union by rank、path compression）。
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in each
// step comment is the transcript time where the lecturer starts saying it). Motion between steps is short;
// nothing loops or replays.
// 老師的例子圖（7 點 A–G、11 條 edge：AD 5、CE 5、DF 6、AB 7、BE 7、BC 8、EF 8、BD 9、EG 9、FG 11、DE 15）：
//   Kruskal 依序加 AD CE DF AB BE、跳過 8 8 9、加 EG 9；Prim 從 D 開始；reverse-delete 拔 15 11 9、EG 9 會讓 G 變孤兒。
// 示意：cut property 證明的抽象圖（點名、cost）、union-find 的樹形（7 在第 2 層、9 掛在 4 底下）。
const C3 = { node: '#cbbd9f', edge: '#b9ab90', hot: '#e8b02a', tree: '#2fa36b', bad: '#d64545', off: '#ece6d8', cut: '#e55a9b', S: '#7fb6ea', R: '#f0a868', seed: '#8fd18a', done: '#2fc092', blue: '#4b9ee2', paper: '#efe6d2' };
const COMP3 = { A: '#e57373', B: '#64b5f6', C: '#ffb74d', D: '#ba68c8', E: '#4dd0e1', F: '#f06292', G: '#a1887f' };
const cls3 = (l, c) => { if (l) l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pal3 = (name, x, y, color, size = 0.6, z = 1.2) => buddy(name, '', color, x, y, z, size);
// a thick undirected edge: a thin box from (x1, y1) to (x2, y2)
function g3Bar(x1, y1, x2, y2, color, th = 0.1) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const m = cube('', color, [L, th, th], (x1 + x2) / 2, (y1 + y2) / 2, -0.1);
  m.rotation.z = Math.atan2(y2 - y1, x2 - x1); return m;
}
// a weighted undirected graph in the x-y plane: P = {k: [x, y]}, E = [[u, v, w]]
//   o.sx/o.dx/o.sy/o.dy map positions, o.size = node size, o.noW hides weights, o.drop drops the nodes in
function g3Graph(P, E, o = {}) {
  const sx = o.sx || 1, sy = o.sy || 1, dx = o.dx || 0, dy = o.dy || 0, s = o.size || 0.75;
  const Q = {}, N = {}, ES = [];
  for (const k of Object.keys(P)) { Q[k] = [P[k][0] * sx + dx, P[k][1] * sy + dy]; N[k] = cube(o.name ? o.name(k) : k, o.color || C3.node, [s, s, s], Q[k][0], Q[k][1], 0, o.drop || 0); }
  for (const [u, v, w] of E) {
    const [x1, y1] = Q[u], [x2, y2] = Q[v];
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, r = s * 0.55;
    const bar = g3Bar(x1 + ux * r, y1 + uy * r, x2 - ux * r, y2 - uy * r, C3.edge, o.th || 0.1);
    const lb = o.noW ? null : tag(String(w), 'val', (x1 + x2) / 2 - uy * 0.36, (y1 + y2) / 2 + ux * 0.36, 0.1);
    ES.push({ u, v, w, bar, lb, set(c, th = 1) { tint(bar, c); bar.scale.y = th; bar.scale.z = th; } });
  }
  const e = (u, v) => ES.find((x) => (x.u === u && x.v === v) || (x.u === v && x.v === u));
  return { N, E: ES, e, P: Q };
}
const eTree = (e) => e.set(C3.tree, 2.2);
const eHot = (e) => e.set(C3.hot, 2.0);
const eOff = (e) => e.set(C3.off, 0.5);
const eNorm = (e) => e.set(C3.edge, 1);
const eBad = (e) => e.set(C3.bad, 2.0);
const eCut = (e) => e.set(C3.cut, 2.0);
// the lecturer's example graph (edges sorted by cost, ties in the lecturer's order)
const G3P = { A: [-4, 5.8], B: [-0.5, 5.8], C: [3.4, 5.8], D: [-5.2, 3.2], E: [0.6, 3.4], F: [-3.2, 0.8], G: [3.8, 0.8] };
const G3E = [['A', 'D', 5], ['C', 'E', 5], ['D', 'F', 6], ['A', 'B', 7], ['B', 'E', 7], ['B', 'C', 8], ['E', 'F', 8], ['B', 'D', 9], ['E', 'G', 9], ['F', 'G', 11], ['D', 'E', 15]];
const G3MST = [['A', 'D'], ['C', 'E'], ['D', 'F'], ['A', 'B'], ['B', 'E'], ['E', 'G']];
// Kruskal's small trees: each component gets one colour; a lone point is a green seedling
function g3Forest(G) {
  const par = {}; Object.keys(G.N).forEach((k) => { par[k] = k; });
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  const paint = () => { const ks = Object.keys(G.N); for (const k of ks) { const r = find(k), n = ks.filter((q) => find(q) === r).length; tint(G.N[k], n === 1 ? C3.seed : COMP3[r]); } };
  return { find, paint, same: (a, b) => find(a) === find(b), union(a, b) { par[find(a)] = find(b); paint(); } };
}
// a column of tags (a sorted edge list) at x from yTop down
function g3List(items, x, yTop, dy = 0.55) { return items.map((s, i) => tag(s, 'idx', x, yTop - i * dy, 0.2)); }
const g3Name = (e) => e[0] + e[1] + ' ' + e[2];
// Prim: edges with exactly one end in the tree
const g3Front = (G, inT) => G.E.filter((e) => inT.has(e.u) !== inT.has(e.v));
async function g3PrimPick(tok, G, inT, ms = 600, cut = false) {
  const fr = g3Front(G, inT); fr.forEach(cut ? eCut : eHot);
  await beat(tok, ms);
  const m = fr.reduce((a, b) => (b.w < a.w ? b : a));
  fr.forEach((e) => { if (e !== m) eNorm(e); });
  eTree(m); const nk = inT.has(m.u) ? m.v : m.u; inT.add(nk); tint(G.N[nk], C3.done); glow(G.N[nk], GREEN);
  await beat(tok, 250); glow(G.N[nk], null);
  return m;
}
// a scissors tag that cuts down along x, leaving a pink cut line
async function g3Cut(tok, x, yTop = 6.8, yBot = 0, ms = 900) {
  const sc = pkt('✂ cut', x, yTop, 0.4);
  const bar = cube('', C3.cut, [0.07, yTop - yBot, 0.07], x, (yTop + yBot) / 2, 0.25);
  bar.scale.y = 0.01;
  await anim(tok, ms, (u) => { sc.position.y = yTop - (yTop - yBot) * u; bar.scale.y = Math.max(0.01, u); bar.position.y = yTop - (yTop - yBot) * u / 2; });
  sc.position.y = yTop + 0.3;
  return { sc, bar };
}
// moves a label along a path of points
async function g3Walk(tok, l, pts, ms = 500) { for (let i = 1; i < pts.length; i++) await travel(tok, l, pts[i - 1], pts[i], ms); }
const g3At = (G, k, dz = 0.6) => V3(G.P[k][0], G.P[k][1] + 0.7, dz);

// ════════ iKhB0YbBRDI（Lec14 Greedy 5/5） ════════

// 00:16 MST 回顧與 Kruskal 的想法
FRAG.push(['grjiang3-mst-review', 'MST 回顧：用最少 cost 把所有點連起來', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const kid = pal3('', -6.4, -1.3, '#f4a56a');
  let G = null, tot = null, kr = null;
  await step(tok);                                   // 16 今天：MST、三個演算法、實作
  txt(title, 'Minimum spanning tree：三個演算法 + 實作');
  say('今天：minimum spanning tree', '三個演算法，最後講怎麼實作');
  await step(tok);                                   // 28.8 review：undirected graph，edge 有 weight
  G = g3Graph(G3P, G3E, { drop: 1.5 });
  say('快速回顧：一個 undirected graph', 'edge 上有 weight（cost）');
  await step(tok);                                   // 46 cost：距離、造橋鋪路、鋪電線
  const house = prop('warehouse', 5.8, -0.9, 0.6, 0.45); bob(house, 0.03);
  for (const e of G.E) cls3(e.lb, 'ptr');
  say('cost 可能是距離', '或造橋鋪路、鋪電線要花的錢');
  await step(tok);                                   // 52 選一些 edge 把所有點連起來
  for (const e of G.E) cls3(e.lb, 'val');
  for (const [u, v] of G3MST) { eHot(G.e(u, v)); await beat(tok, 200); }
  say('從 edge 裡選一些出來', '把所有的點連起來');
  await step(tok);                                   // 66 spanning tree、total cost 最小
  for (const [u, v] of G3MST) eTree(G.e(u, v));
  for (const k of Object.keys(G.N)) tint(G.N[k], C3.done);
  tot = tag('total = 5 + 5 + 6 + 7 + 7 + 9 = 39', 'ptr', 0, -0.5);
  kid.mood('happy');
  say('蓋住所有點的一棵 tree：spanning tree', 'total cost 最小：minimum');
  await step(tok);                                   // 82 三種演算法，第一種 Kruskal
  for (const e of G.E) eNorm(e);
  for (const k of Object.keys(G.N)) tint(G.N[k], C3.node);
  remove(tot);
  txt(title, '第一種：Kruskal\'s algorithm（greedy）');
  kr = pal3('Kruskal', 6.2, -1.3, '#7cd1a8');
  say('課本介紹三種常見的演算法', '第一種：Kruskal，全部都是 greedy');
  await step(tok);                                   // 107 喜歡用 cost 低的 edge
  for (const e of G.E) if (e.w <= 6) { eHot(e); cls3(e.lb, 'ptr alt'); }
  kr.mood('happy'); kr.look(-0.6);
  say('目標是 total cost 最小', '所以先從 cost 低的 edge 開始選');
  await step(tok);                                   // 123 不能造成 cycle
  for (const e of G.E) { eNorm(e); cls3(e.lb, 'val'); }
  eTree(G.e('A', 'D')); eTree(G.e('A', 'B')); eBad(G.e('B', 'D'));
  const cy = bad('A–B–D 繞成一圈：cycle ✗', -2.6, 2.0, 0.6);
  kr.mood('wow');
  say('加進來的過程不能造成 cycle', 'tree 是沒有 cycle 的圖');
  await step(tok);                                   // 138 所有點連起來就停
  remove(cy);
  for (const e of G.E) eNorm(e);
  for (const [u, v] of G3MST) eTree(G.e(u, v));
  for (const k of Object.keys(G.N)) tint(G.N[k], C3.done);
  kr.mood('happy'); await kr.hop(tok);
  say('直到所有的點都連起來為止', '就停下來');
}]);

// 02:23 Kruskal demo：從小排到大，一條一條加，遇到 cycle 就跳過
FRAG.push(['grjiang3-kruskal-demo', 'Kruskal demo：從小到大加 edge，cycle 就跳過', async (tok) => {
  fresh([0.4, 3.4, 14.4], [0.4, 3.0, 0]);
  const G = g3Graph(G3P, G3E);
  const F = g3Forest(G);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  let L = null;
  const add = (i) => { const [u, v] = G3E[i]; eTree(G.e(u, v)); F.union(u, v); cls3(L[i], 'good'); };
  const skip = async (i) => {
    const [u, v] = G3E[i], e = G.e(u, v);
    cls3(L[i], 'ptr alt'); eHot(e); await beat(tok, 500);
    eBad(e); const t = bad('cycle！跳過', (G.P[u][0] + G.P[v][0]) / 2, (G.P[u][1] + G.P[v][1]) / 2 - 0.6, 0.8);
    kr.mood('wow'); await beat(tok, 900);
    remove(t); eOff(e); cls3(L[i], 'bad'); kr.mood('calm');
  };
  await step(tok);                                   // 143 一開始只有點，edge 是空的
  for (const e of G.E) eOff(e);
  F.paint();
  say('一開始只有點', '選進來的 edge 是空的');
  await step(tok);                                   // 153 edge 依 cost 從小排到大
  for (const e of G.E) eNorm(e);
  L = g3List(G3E.map(g3Name), 6.4, 6.6, 0.52);
  for (const l of L) cls3(l, 'ptr');
  say('把所有 edge 依 cost 從小排到大', '然後一條一條檢視');
  await step(tok);                                   // 167 兩條 5 誰先都可以：先加 AD
  add(0); kr.mood('happy');
  say('最小是兩條 cost 5，誰先誰後沒關係', '加進 AD：A、D 連起來了');
  await step(tok);                                   // 183 再把 C、E 連起來
  add(1);
  say('下一條 5：把 C 和 E 連起來', '');
  await step(tok);                                   // 185 接下來 6
  add(2);
  say('接下來 cost 6：DF', '');
  await step(tok);                                   // 192 接下來兩條 7，都可以加
  add(3); await beat(tok, 500); add(4);
  say('接著兩條 7：AB、BE 都可以加', '連起來的點越來越多');
  await step(tok);                                   // 208 8 的 edge 形成 cycle → 跳過
  await skip(5);
  say('BC 8：B、C 早就連通了，會形成 cycle', '這條 edge 不需要，跳過');
  await step(tok);                                   // 229 另一條 8 也是 cycle
  await skip(6);
  say('另一條 8（EF）也會形成 cycle', '沒有作用，又違反 tree 的形態 → 跳過');
  await step(tok);                                   // 242 9 也是 cycle
  await skip(7);
  say('BD 9：也是 cycle，跳過', '');
  await step(tok);                                   // 247 下一條 9：所有點都連起來了
  add(8); kr.mood('happy'); await kr.hop(tok);
  for (let i = 9; i < L.length; i++) cls3(L[i], 'idx');
  say('EG 9 加進來：所有點都連起來', '形成一棵 tree，結束');
  await step(tok);                                   // 263 可以證明是最佳解
  tag('total = 5 + 5 + 6 + 7 + 7 + 9 = 39（最小）', 'ptr alt', 0, -0.5);
  say('可以證明 Kruskal 會得到最佳解', '用最小的 total cost 連起所有點');
}]);

// 04:32 Kruskal 的長法：很多小苗慢慢合併成一棵大樹
FRAG.push(['grjiang3-kruskal-forest', 'Kruskal 的長法：很多小苗合併成一棵大樹', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  const F = g3Forest(G);
  const kr = pal3('Kruskal', 6.2, -1.3, '#7cd1a8');
  const sprouts = [];
  const add = (u, v) => { eTree(G.e(u, v)); F.union(u, v); };
  await step(tok);                                   // 272 透過 demo 看 Kruskal 的 idea
  txt(title, 'Kruskal 的 idea：從小苗長成大樹');
  for (const e of G.E) eOff(e);
  say('透過剛剛的 demo，看一件有趣的事', 'Kruskal 是怎麼「長」的');
  await step(tok);                                   // 283 每個點是一顆小種子，目標長成大樹
  for (const k of Object.keys(G.N)) {
    tint(G.N[k], C3.seed);
    const s = cube('', '#3f9a3a', [0.16, 0.35, 0.16], G.P[k][0] + 0.12, G.P[k][1] + 0.55, 0); s.rotation.z = -0.4; bob(s, 0.04, 3); sprouts.push(s);
  }
  note('目標：長成一棵大樹', -2.4, -0.5);
  say('想像每個點是一顆小種子', '最後要長成一棵大樹');
  await step(tok);                                   // 291 每加一條 edge，兩棵小樹連在一起
  for (const e of G.E) eNorm(e);
  bub('每加一條 edge = 兩棵小樹接在一起', 2.4, -0.5, 0.6);
  say('每次加進一條 edge', '就把兩棵小樹連在一起');
  await step(tok);                                   // 302 一開始都只有種子
  for (const k of Object.keys(G.N)) glow(G.N[k], GREEN);
  await beat(tok, 500);
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  say('一開始都只有種子（小苗）', '7 個點 = 7 棵小樹');
  await step(tok);                                   // 312 兩顆小苗 merge 成一棵小樹
  add('A', 'D'); kr.mood('happy');
  say('加 AD：兩顆小苗 merge', '變成一棵比較大的小樹');
  await step(tok);                                   // 319 另外一棵小樹
  add('C', 'E');
  say('一樣的，CE 形成另外一棵小樹', '');
  await step(tok);                                   // 324 再長大一些，直到一棵大樹
  for (const [u, v] of [['D', 'F'], ['A', 'B'], ['B', 'E'], ['E', 'G']]) { add(u, v); await beat(tok, 500); }
  await kr.hop(tok);
  say('小樹再長大、再合併', '直到所有點形成一棵大樹，停下來');
  await step(tok);                                   // 337 為什麼這樣看：跟 Prim 長法不同
  pkt('Prim：從頭到尾只有一棵樹往外長', 0, 7.2 - 0.7);
  say('為什麼要這樣看？', '因為 Prim 的長法跟它不一樣');
}]);

// 05:44 Prim's algorithm：只維持一棵樹，往外伸觸角
FRAG.push(['grjiang3-prim-demo', 'Prim demo：從 D 開始，每次接上最便宜的觸角', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  for (const e of G.E) eOff(e);
  const pr = pal3('Prim', 6.2, -1.3, '#9fb8ff');
  const inT = new Set();
  let h1 = null, h2 = null;
  await step(tok);                                   // 344 第二個演算法 Prim's
  txt(title, '第二種：Prim\'s algorithm');
  say('第二個演算法：Prim\'s algorithm', '');
  await step(tok);                                   // 350 發表比 Dijkstra 早一些，大約平行
  h1 = note('Prim：發表比 Dijkstra 早一些', -3.2, -0.5);
  say('Prim 發表得比 Dijkstra 還早一些', '那個年代管道不暢通，大約是平行發展');
  await step(tok);                                   // 369 MST 歸給 Prim、shortest path 歸給 Dijkstra
  txt(h1, 'MST → Prim；shortest path → Dijkstra');
  h2 = good('本質是同一個演算法', 3.2, -0.5);
  say('MST 的功勞歸給 Prim', 'shortest path 歸給 Dijkstra；本質是同一個');
  await step(tok);                                   // 384 idea：只維持一棵樹
  remove(h1); remove(h2);
  bub('從頭到尾只維持一棵樹', 3.0, -0.5, 0.6);
  say('Prim 的 idea：最後長成一棵大樹', '過程中 always 只維持一棵樹');
  await step(tok);                                   // 396 從任何一點開始都可以
  for (const k of Object.keys(G.N)) glow(G.N[k], GOLD);
  await beat(tok, 600);
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  say('隨便從哪一點開始都沒關係', '反正最後一定會連到所有的點');
  await step(tok);                                   // 417 往外擴張，一樣是 greedy
  for (const e of G.E) eNorm(e);
  say('從起點慢慢往外擴張，讓樹長大', '一樣 greedy：用 cost 小的 edge');
  await step(tok);                                   // 431 每一步往外看伸出去的觸角
  bub('往外看：哪條觸角最便宜？', -3.0, -0.5, 0.6);
  pr.look(-0.8);
  say('每一步從現在這棵樹往外看', '伸出去的觸角（edge）哪條最便宜');
  await step(tok);                                   // 450 random pick 起點 D
  inT.add('D'); tint(G.N.D, C3.done); glow(G.N.D, GREEN);
  say('隨便挑一個起點：D', '');
  await step(tok);                                   // 454 從 D 往外看，選 cost 最低的
  glow(G.N.D, null);
  await g3PrimPick(tok, G, inT, 900);
  pr.mood('happy');
  say('從 D 往外看出去的觸角', '選 cost 最低的 5：長到 A');
  await step(tok);                                   // 474 樹變大，看到四條，選 6
  await g3PrimPick(tok, G, inT, 900);
  say('樹變大了，往外看到四條 edge', '最小的是 cost 6：長到 F');
  await step(tok);                                   // 489 每次往外多長一個點
  glow(G.N.F, GOLD); await beat(tok, 600); glow(G.N.F, null);
  say('每次都往外多接一個點進來', '這棵樹慢慢長大');
  await step(tok);                                   // 496 看到更多條，還是選當下最小
  await g3PrimPick(tok, G, inT, 800);
  say('往外看到更多條 edge', '還是選當下最小的：AB 7');
  await step(tok);                                   // 505 依此類推，長完一整棵樹
  for (let r = 0; r < 3; r++) await g3PrimPick(tok, G, inT, 350);
  await pr.hop(tok);
  say('依此類推：BE 7、CE 5、EG 9', '長完一整棵樹（total 一樣是 39）');
}]);

// 08:40 Prim vs Kruskal：一棵樹往外長 vs 很多小樹合併
FRAG.push(['grjiang3-prim-vs-kruskal', 'Prim vs Kruskal：一棵樹往外長 vs 很多小樹合併', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const map = { sx: 0.52, sy: 0.62, dy: 1.4, size: 0.5, noW: true, th: 0.08 };
  const GP = g3Graph(G3P, G3E, Object.assign({ dx: -3.6 }, map));
  const GK = g3Graph(G3P, G3E, Object.assign({ dx: 3.7 }, map));
  for (const e of GP.E.concat(GK.E)) eOff(e);
  tag('Prim', 'ptr alt', -3.6, 6.4); tag('Kruskal', 'ptr alt', 3.7, 6.4);
  const pr = pal3('', -6.4, -1.2, '#9fb8ff', 0.55), kr = pal3('', 6.4, -1.2, '#7cd1a8', 0.55);
  const F = g3Forest(GK);
  await step(tok);                                   // 519 Prim：always 一棵樹，每次加一條 edge / 一個點
  const inT = new Set(['D']); tint(GP.N.D, C3.done);
  for (let r = 0; r < 6; r++) { const fr = g3Front(GP, inT); const m = fr.reduce((a, b) => (b.w < a.w ? b : a)); eTree(m); const nk = inT.has(m.u) ? m.v : m.u; inT.add(nk); tint(GP.N[nk], C3.done); await beat(tok, 350); }
  pr.mood('happy');
  note('只有一棵樹，每輪多接一個點', -3.6, -0.3);
  say('Prim：always 只有一棵樹', '每個 iteration 多一條 edge、一個點');
  await step(tok);                                   // 546 Kruskal：一開始很多小樹
  F.paint();
  say('Kruskal 不一樣：', '一開始 maintain 很多小樹（小苗）');
  await step(tok);                                   // 555 每輪引進 cost 低的 edge，把兩棵小樹 merge
  for (const [u, v] of [['A', 'D'], ['C', 'E'], ['D', 'F'], ['A', 'B']]) { eTree(GK.e(u, v)); F.union(u, v); await beat(tok, 450); }
  note('每輪把兩棵小樹接起來', 3.7, -0.3);
  say('每個 iteration 引進一條 cost 低的 edge', '把兩棵小樹 merge 起來');
  await step(tok);                                   // 564 最後 merge 成一整棵大樹
  for (const [u, v] of [['B', 'E'], ['E', 'G']]) { eTree(GK.e(u, v)); F.union(u, v); await beat(tok, 450); }
  kr.mood('happy'); await kr.hop(tok);
  say('最後 merge 成一整棵大樹', '兩種長法不同，答案一樣');
}]);

// 09:33 Reverse-delete：從整張圖開始，從大的 cost 拔起
FRAG.push(['grjiang3-reverse-delete', 'Reverse-delete：從貴的 edge 開始拔，不能拔斷', async (tok) => {
  fresh([0.4, 3.4, 14.4], [0.4, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const rv = pal3('reverse', -6.4, -1.3, '#e8a0c8');
  const DESC = G3E.slice().reverse();
  let G = null, L = null, msg = null;
  const pull = async (i, ok) => {
    const [u, v] = DESC[i], e = G.e(u, v);
    cls3(L[i], 'ptr alt'); eHot(e); await beat(tok, 450); eOff(e);
    if (ok) { cls3(L[i], 'bad'); return; }
    await beat(tok, 300);
    const t = bad('G 變孤兒！', G.P.G[0] + 0.6, G.P.G[1] - 0.8, 0.8); glow(G.N.G, RED); rv.mood('sad');
    await beat(tok, 1000);
    eNorm(e); glow(G.N.G, null); remove(t); cls3(L[i], 'good'); rv.mood('calm');
  };
  await step(tok);                                   // 573 第三種：反向操作
  txt(title, '第三種：reverse-delete（反向操作）');
  bub('前兩種：加 edge、加點慢慢長', -2.6, 3.0, 0.6);
  say('前兩種都是加 edge、加點慢慢長大', '第三種反向操作');
  await step(tok);                                   // 588 一開始是整張圖
  G = g3Graph(G3P, G3E, { drop: 1.2 });
  for (const e of G.E) e.set(C3.blue, 1.6);
  say('reverse-delete：一開始是整張圖', '');
  await step(tok);                                   // 599 把不需要的 edge 拔掉
  const sc = pkt('✂', -5.6, 0.6, 1.2); bob(sc, 0.06);
  rv.look(0.6);
  say('想法：把不需要的 edge 拔掉', '反過來拔');
  await step(tok);                                   // 609 n 個點只要 n−1 條
  msg = note('7 個點只要 6 條 edge → 11 條要拔掉 5 條', 0.4, -0.5);
  say('什麼叫不需要？n 個點只要 n−1 條 edge', '多的 edge 都可以拔光');
  await step(tok);                                   // 621 從 cost 高的拔起
  for (const e of G.E) if (e.w >= 9) cls3(e.lb, 'ptr alt');
  say('當然從 cost 比較高的 edge 開始拔', '所以叫 reverse delete');
  await step(tok);                                   // 651 拔了會 disconnected 就不能拔
  for (const e of G.E) cls3(e.lb, 'val');
  txt(msg, '拔了會 disconnected（有人變孤兒）→ 不可以拔');
  rv.mood('wow');
  say('不可以拔的：拔了會讓圖 disconnected', '有人變成孤兒，再也連不起來');
  await step(tok);                                   // 676 cost 從大排到小
  rv.mood('calm'); remove(msg);
  for (const e of G.E) eNorm(e);
  L = g3List(DESC.map(g3Name), 6.4, 6.6, 0.52);
  for (const l of L) cls3(l, 'ptr');
  say('demo：一樣先排序，這次從大排到小', '');
  await step(tok);                                   // 682 拔 15：還是 connected，安全
  await pull(0, true);
  say('最大是 DE 15：拔掉', '整張圖還是 connected → 安全');
  await step(tok);                                   // 696 拔 11：安全
  await pull(1, true);
  say('下一條 FG 11：拔掉還是安全', '');
  await step(tok);                                   // 702 拔 9（BD）：安全
  await pull(2, true);
  say('BD 9：拔了還是安全', '');
  await step(tok);                                   // 712 拔 9（EG）：G 變孤兒 → 恢復
  await pull(3, false);
  say('EG 9 拔了之後，G 變孤兒', '完全 disconnected → 不能拔，恢復');
  await step(tok);                                   // 720 下一條 BC 8：安全
  await pull(4, true);
  say('下一條 BC 8：拔掉也安全', '');
  await step(tok);                                   // 729 再拔 EF 8：完成
  await pull(5, true);
  for (const e of G.E) if (e.bar.scale.y > 0.9) eTree(e);
  rv.mood('happy');
  say('再拔 EF 8：也可以', '剩 6 條，已經做好了');
  await step(tok);                                   // 750 再拔就會 disconnected
  for (let i = 6; i < DESC.length; i++) { cls3(L[i], 'good'); await beat(tok, 200); }
  say('剩下的 edge 再拔就會 disconnected', '拔了又要貼回去 → 全部保留，結束');
  await step(tok);                                   // 763 前兩種好做，第三種難做
  txt(title, '實作：前兩種好做，第三種難做');
  good('Kruskal、Prim：好做', -2.6, -0.5); bad('reverse-delete：難做', 2.6, -0.5);
  say('課本的三種方法裡', '實作上前兩種好做，第三種難做');
  await step(tok);                                   // 778 很難檢查拔掉後是否還 connected
  rv.mood('sad');
  bub('每拔一條都要檢查還 connected 嗎？', 0.4, 0.4, 0.8);
  say('每拔一條都要檢查是否仍 connected', '很難做得快 → 實務上沒人用');
}]);

// 13:15 兩個重要 property：cut property 與 cycle property
FRAG.push(['grjiang3-two-properties', '兩個 property：cut 撐起 Prim/Kruskal，cycle 撐起 reverse-delete', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const pr = pal3('Prim', -5.2, -0.6, '#9fb8ff', 0.65, 0.6);
  const kr = pal3('Kruskal', -2.4, -0.6, '#7cd1a8', 0.65, 0.6);
  const rv = pal3('reverse', 3.8, -0.6, '#e8a0c8', 0.65, 0.6);
  let cut = null, cyc = null;
  await step(tok);                                   // 795 兩個非常重要的 property
  cut = cube('Cut property', C3.cut, [3.6, 1.0, 0.6], -3.8, 4.6, 0, 1.5);
  cyc = cube('Cycle property', C3.S, [3.6, 1.0, 0.6], 3.8, 4.6, 0, 1.5);
  say('MST 的兩個非常重要的 property', '');
  await step(tok);                                   // 815 不管哪一種演算法，對的原因都來自它們
  bub('任何 MST 演算法：為什麼會對？', 0, 6.6, 0.4);
  say('不管哪一種 MST 演算法', '會對的原因都根據這兩個 property');
  await step(tok);                                   // 820 cut property → Prim、Kruskal
  glow(cut, GOLD);
  line(-3.8, 4.0, -5.2, 0.9, 0.3, C3.cut); line(-3.8, 4.0, -2.4, 0.9, 0.3, C3.cut);
  pr.mood('happy'); kr.mood('happy');
  say('cut property：', 'Prim 和 Kruskal 為什麼會對');
  await step(tok);                                   // 829 cycle property → reverse-delete
  glow(cut, null); glow(cyc, GOLD);
  line(3.8, 4.0, 3.8, 0.9, 0.3, C3.blue);
  rv.mood('happy'); await rv.hop(tok);
  say('cycle property：', 'reverse-delete 為什麼會對');
  await step(tok);                                   // 840 其他類似的長法也基於這兩個
  glow(cyc, null);
  const o = pal3('其他', 6.2, -0.6, '#f4d06f', 0.55, 0.6);
  line(-3.8, 4.0, 6.2, 0.8, 0.2, '#c9b48e');
  o.mood('wow');
  say('其他類似的 MST 長法', '大概也都是從這兩個 property 發展出來');
}]);

// 14:08 Cut property 的敘述：剪一刀，被剪到的 edge 中最便宜的一定安全
const G3Q = { a: [-5, 5.2], b: [-2.6, 3.4], c: [-5, 1.4], d: [2.8, 5.2], e: [5.2, 3.4], f: [2.8, 1.4] };
const G3QE = [['d', 'e', 2], ['b', 'c', 3], ['a', 'b', 4], ['c', 'f', 5], ['e', 'f', 6], ['b', 'd', 7], ['a', 'd', 9], ['a', 'c', 10], ['b', 'e', 12]];
FRAG.push(['grjiang3-cut-statement', 'Cut property：剪一刀，被剪到的最便宜 edge 一定安全', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  let G = null, sc = null, S = null, R = null, h = null;
  const left = ['a', 'b', 'c'], right = ['d', 'e', 'f'];
  const cross = (e) => left.includes(e.u) !== left.includes(e.v);
  const kid = pal3('', -6.4, -1.3, '#f4a56a');
  await step(tok);                                   // 848 cut property；先做一個簡化的假設
  txt(title, 'Cut property');
  G = g3Graph(G3Q, G3QE, { drop: 1.2 });
  say('第一個：cut property', '為了好分析，先做一個簡單的假設');
  await step(tok);                                   // 866 假設所有 cost 都不一樣
  for (const e of G.E) cls3(e.lb, 'ptr');
  h = note('假設：所有 cost 都不一樣', 0, -0.5);
  say('假設所有的 cost 都不一樣', '（一樣的話也能分析，只是先簡化）');
  await step(tok);                                   // 881 什麼時候一條 edge 一定可以放進 MST？
  for (const e of G.E) cls3(e.lb, 'val');
  txt(h, '哪一條 edge 放進 MST 一定沒問題？');
  kid.mood('wow');
  say('問題：什麼時候一條 edge', '放進 minimum spanning tree 一定沒問題？');
  await step(tok);                                   // 902 這樣的 edge 叫 safe edge
  txt(h, '這樣的 edge 叫 safe edge（安全的 edge）');
  say('它應該要被加進去', '這樣的 edge 叫 safe edge');
  await step(tok);                                   // 918 用剪刀把點切成兩半：S
  remove(h);
  sc = await g3Cut(tok, 0, 6.6, 0.2);
  for (const k of left) tint(G.N[k], C3.S);
  S = tag('S', 'ptr', -3.8, 6.6);
  say('用剪刀把點切成兩半', '其中一半放在 set S');
  await step(tok);                                   // 940 剩下的在 V−S
  for (const k of right) tint(G.N[k], C3.R);
  R = tag('V − S', 'ptr', 3.8, 6.6);
  say('剩下的點在 V − S', '');
  await step(tok);                                   // 959 剪刀一定會剪到一些 edge
  for (const e of G.E) if (cross(e)) { eCut(e); await beat(tok, 250); }
  say('這把剪刀一定會從中間剪到一些 edge', '粉紅色 = 被剪到的 edge');
  await step(tok);                                   // 968 被剪到的裡面 cost 最小的一定安全
  const m = G.e('c', 'f'); eTree(m); cls3(m.lb, 'ptr alt');
  good('cut 上最便宜：cf 5 → 一定在 MST 裡', 0, -0.5);
  kid.mood('happy');
  say('被剪到的 edge 中 cost 最小的那條', '一定安全，而且一定要放進 MST');
  await step(tok);                                   // 986 用 exchange argument 證明
  note('證明：exchange argument', 0, -1.4);
  say('怎麼證明？', '用 exchange argument');
}]);

// 16:32 第一版證明：別人的 tree 用 f 跨過 cut，換成 e 比較便宜
const G3P1 = { a: [-4.8, 5.2], b: [-2.2, 5.6], v: [-3.4, 1.8], x: [2.4, 5.6], y: [5, 3.8], w: [2.6, 1.8] };
const G3P1E = [['v', 'w', 2], ['a', 'b', 3], ['b', 'v', 4], ['x', 'y', 5], ['y', 'w', 6], ['b', 'x', 8], ['a', 'x', 9]];
FRAG.push(['grjiang3-cut-proof1', 'Cut property 第一版證明：砍掉 f、貼上 e', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P1, G3P1E, { name: (k) => (k === 'x' || k === 'y' ? '' : k) });
  const T = [['a', 'b'], ['b', 'v'], ['b', 'x'], ['x', 'y'], ['y', 'w']];
  for (const k of ['a', 'b', 'v']) tint(G.N[k], C3.S);
  for (const k of ['x', 'y', 'w']) tint(G.N[k], C3.R);
  const e = G.e('v', 'w'), f = G.e('b', 'x');
  const me = pal3('我', -6.4, -1.3, '#7cd1a8'), other = pal3('別人', 6.4, -1.3, '#c9a0f0');
  let cost = null, q = null, tg = null;
  await step(tok);                                   // 992 MST 蓋住所有點，是 connected 的 tree
  txt(title, '想法：MST 蓋住所有點，而且 connected');
  for (const [u, v] of T) eTree(G.e(u, v));
  say('目標是一棵 minimum spanning tree', '蓋住所有點，是 connected 的 tree');
  await step(tok);                                   // 1010 不管怎麼切，一定剪到一條 tree edge
  await g3Cut(tok, 0, 6.6, 0.2);
  eCut(f);
  tg = bub('一定剪到至少一條 tree edge', 0, -0.4, 0.6);
  say('不管怎麼切，一定至少剪到一條 tree edge', '不然兩半黏不起來，就不是 tree');
  await step(tok);                                   // 1039 這條 edge 長什麼樣？最便宜的那條
  eTree(f); remove(tg);
  eHot(e); cls3(e.lb, 'ptr alt');
  say('隨便剪一刀，踩過的 edge 裡', 'cost 最小的那條（e）應該放在 MST 裡');
  await step(tok);                                   // 1062 第一版證明：不含 e 的 spanning tree 比較貴
  txt(title, '第一版證明（exchange argument）');
  say('第一個版本的證明：', '要說不包含 e 的 spanning tree 比較貴');
  await step(tok);                                   // 1087 T：別人隨意產生、不含 e 的 spanning tree
  eOff(e); cls3(e.lb, 'val');
  tag('T：別人做的 spanning tree（沒有 e）', 'ptr', 0, -0.4);
  other.mood('happy');
  cost = tag('cost(T) = 3 + 4 + 8 + 5 + 6 = 26', 'ptr', 0, -1.2);
  say('假設 T 是別人做的 spanning tree', '它沒有放 cut 上 cost 最低的 e');
  await step(tok);                                   // 1129 T 勢必透過另一條 edge f 連起 S 與 V−S
  eCut(f); tg = tag('f', 'ptr alt', -0.2, 6.3);
  say('T 一定透過另一條 edge 連起 S 和 V−S', '這條叫 f');
  await step(tok);                                   // 1159 f 的 cost 比 e 高
  eTree(f);
  q = note('f = 8 > e = 2', 2.6, 0.6, 0.6);
  say('f 也在這個 cut 上，又不是最小的', '所以 f 的 cost 比 e 高');
  await step(tok);                                   // 1181 exchange argument：剪掉別人的、貼上我的
  const sc = pkt('✂ 剪掉 → 貼上', -6.4, 0.3, 1.2);
  me.mood('happy'); other.mood('wow');
  say('exchange argument：別人的解不符合 greedy rule', '就剪掉，貼上我的');
  await step(tok);                                   // 1209 把 f 砍掉，換成 e
  remove(sc); remove(tg);
  eBad(f); await beat(tok, 500); eOff(f);
  eTree(e); cls3(e.lb, 'ptr alt');
  say('把 f 砍掉，換成 e 貼上去', '');
  await step(tok);                                   // 1232 cost 比較便宜
  txt(cost, 'cost = 26 − 8 + 2 = 20（比較便宜）');
  cls3(cost, 'ptr alt');
  say('減掉一個大數字，加上一個小數字', '得到 cost 比較低的結果');
  await step(tok);                                   // 1249 這個證明不大對
  bad('這版證明有小瑕疵！', 0, 1.0, 0.8);
  other.mood('calm'); me.mood('wow');
  say('但這個證明不大對', '抓到了 key idea，可是有小瑕疵');
  await step(tok);                                   // 1278 換完還是不是 tree？不確定
  remove(q);
  bub('換完之後……還是一棵 tree 嗎？', 2.6, 0.4, 0.8);
  say('只能說 cost 比較便宜', '但換完還是不是一棵 tree？不確定');
}]);

// 21:32 第一版哪裡錯：exchange 要保證兩件事；反例：G 變孤兒
const G3P2 = { a: [-4.6, 5.2], b: [-2.2, 3.8], v: [-4.4, 1.6], w: [3, 1.6], g: [3.4, 5.4] };
const G3P2E = [['b', 'w', 2], ['a', 'b', 3], ['a', 'v', 4], ['b', 'g', 5], ['v', 'w', 6]];
FRAG.push(['grjiang3-cut-proof1-bug', '第一版的漏洞：換完不一定是 tree（G 變孤兒）', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const me = pal3('greedy', -6.4, -1.3, '#7cd1a8');
  let G = null, c1 = null, c2 = null;
  await step(tok);                                   // 1292 exchange argument：挖掉不符合的，換成 greedy 的
  txt(title, 'Exchange argument 的兩個要求');
  const blocks = [0, 1, 2, 3].map((i) => cube(i === 2 ? '✗' : '', i === 2 ? C3.bad : C3.blue, [0.9, 0.7, 0.6], -2.4 + i * 1.3, 4.6, 0, 1.5));
  await beat(tok, 700);
  fly(blocks[2]); blocks[2] = cube('✓', C3.done, [0.9, 0.7, 0.6], 0.2, 4.6, 0, 1.5);
  say('exchange argument：不符合想像的地方挖掉', '換成 greedy rule 會做的事，貼上去');
  await step(tok);                                   // 1316 要保證兩件事：① 比較好
  c1 = good('① cost 要比較好（不變差）', 0, 2.8);
  say('挖掉換上去之後要保證兩件事', '第一：cost 要比較好');
  await step(tok);                                   // 1327 ② 仍是 feasible solution
  c2 = good('② 還是一個 feasible solution', 0, 2.0);
  me.mood('wow');
  say('第二：換完還是一個合法解（feasible）', '換完壞掉 = 白做工');
  await step(tok);                                   // 1342 第一版沒照顧到 tree 的特性：反例
  blocks.forEach(kill); remove(c1); remove(c2);
  txt(title, '反例：第一版沒照顧到 tree 的特性');
  G = g3Graph(G3P2, G3P2E, { drop: 1.2 });
  for (const [u, v] of [['a', 'b'], ['a', 'v'], ['b', 'g'], ['v', 'w']]) eTree(G.e(u, v));
  say('為什麼不對？沒有照顧到 tree 的特性', '舉一個反例：綠色是一棵 tree');
  await step(tok);                                   // 1368 S 是隨便剪的；右邊 V−S 沒有 connected
  await g3Cut(tok, 0, 6.6, 0.2);
  for (const k of ['a', 'b', 'v']) tint(G.N[k], C3.S);
  for (const k of ['w', 'g']) tint(G.N[k], C3.R);
  note('右邊 V − S 自己沒有 connected', 3.4, -0.4);
  say('S 是隨便剪的：剪成左邊 S、右邊 V−S', '右邊這一側自己沒有 connected');
  await step(tok);                                   // 1395 e 最便宜但沒選到；選到的是 f
  const e = G.e('b', 'w'), f = G.e('b', 'g');
  eHot(e); cls3(e.lb, 'ptr alt'); tag('e', 'ptr alt', 0.6, 2.3);
  eCut(f); tag('f', 'ptr', 0.6, 5.2);
  eCut(G.e('v', 'w'));
  say('跨過 cut 的有三條，e（2）最便宜', '但 T 沒選 e，選到的是 f');
  await step(tok);                                   // 1418 砍 f 換 e：G 變孤兒
  eTree(G.e('v', 'w'));
  eBad(f); await beat(tok, 500); eOff(f); eTree(e);
  glow(G.N.g, RED); bad('G 變孤兒：disconnected！', 3.4, 6.4);
  me.mood('sad');
  say('砍掉 f、換成 e：e 確實比 f 便宜', '但 G 這部分變孤兒，disconnected');
  await step(tok);                                   // 1442 證明不完整
  bad('不能保證 feasible → 第一版證明不完整', 0, -1.2);
  say('不能證明造出來的還是 feasible solution', '所以這個證明不完整，是錯的');
}]);

// 24:07 正確版證明（上）：沿著 T 裡 v 到 w 的 path P 找 e'
const G3P3 = { a: [-4.8, 5.4], vp: [-1.8, 4.8], v: [-3.4, 1.8], wp: [1.8, 4.8], b: [4.8, 5.4], w: [3.4, 1.8] };
const G3P3E = [['v', 'w', 2], ['v', 'vp', 3], ['wp', 'w', 4], ['a', 'vp', 5], ['b', 'wp', 6], ['vp', 'wp', 7]];
const g3n3 = (k) => (k === 'vp' ? "v'" : k === 'wp' ? "w'" : k);
FRAG.push(['grjiang3-cut-proof2-setup', '正確版證明：P 穿過 cut 的 e\'，換成 e', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const T = [['v', 'vp'], ['vp', 'wp'], ['wp', 'w'], ['a', 'vp'], ['b', 'wp']];
  const me = pal3('', -6.4, -1.3, '#7cd1a8');
  let G = null, e = null, ep = null, cost = null, h = null;
  await step(tok);                                   // 1447 第二版：比較正確的證明
  txt(title, 'Cut property：比較正確的第二版證明');
  say('證明要寫得嚴謹一點', '第二個、比較正確的版本');
  await step(tok);                                   // 1466 特別注意維持 tree / connected
  h = note('重點：換完要維持 tree（connected、沒有 cycle）', 0, -0.4);
  say('idea 跟前面很像', '但要特別注意維持 tree、connected 的特性');
  await step(tok);                                   // 1473 T 是別人的 spanning tree，沒有 e
  remove(h);
  G = g3Graph(G3P3, G3P3E, { name: g3n3, drop: 1.2 });
  for (const k of ['a', 'vp', 'v']) tint(G.N[k], C3.S);
  for (const k of ['b', 'wp', 'w']) tint(G.N[k], C3.R);
  for (const [u, v] of T) eTree(G.e(u, v));
  e = G.e('v', 'w'); ep = G.e('vp', 'wp');
  eOff(e); tag('e', 'ptr alt', 0, 2.3);
  cost = tag('cost(T) = 3 + 7 + 4 + 5 + 6 = 25', 'ptr', 0, -0.4);
  say('一樣假設 T 是別人做的 spanning tree', '它沒有包含 cut 上最便宜的 e');
  await step(tok);                                   // 1496 e 連 v、w；T 裡一定有別的路
  glow(G.N.v, GOLD); glow(G.N.w, GOLD);
  say('e 連的是 v 和 w', 'T 是 spanning tree：v、w 一定有別的路黏起來');
  await step(tok);                                   // 1523 tree 上任兩點的 path 存在且唯一
  glow(G.N.v, null); glow(G.N.w, null);
  h = note('tree：任兩點之間的 path 存在，而且唯一', 0, -1.2);
  say('tree 是 connected graph：任兩點之間有 path', '而且在 tree 裡，這條 path 是唯一的');
  await step(tok);                                   // 1547 這條 path 叫 P
  remove(h);
  for (const [u, v] of [['v', 'vp'], ['vp', 'wp'], ['wp', 'w']]) eHot(G.e(u, v));
  const p = pkt('P', G.P.v[0], G.P.v[1] + 0.7, 0.6);
  await g3Walk(tok, p, [g3At(G, 'v'), g3At(G, 'vp'), g3At(G, 'wp'), g3At(G, 'w')], 550);
  say('這條 v 到 w 的 path 叫 P', 'v → v\' → w\' → w');
  await step(tok);                                   // 1552 P 一定穿過 cut boundary
  remove(p);
  await g3Cut(tok, 0, 6.6, 0.2);
  say('P 繞另一條路把 v、w 連起來', '所以一定會穿過 S 和 V−S 的 cut boundary');
  await step(tok);                                   // 1567 穿過 boundary 的 edge 叫 e'，端點 v'、w'
  eCut(ep); tag("e'", 'ptr alt', 0, 5.6);
  say('P 穿過 boundary 的那條 edge 叫 e\'', 'e\' 的兩端是 v\' 和 w\'');
  await step(tok);                                   // 1588 e' 的 cost 比較高
  note("e' = 7 > e = 2", -2.6, 3.4, 0.6);
  say('e 是 cut 上最小的', '所以 e\' 的 cost 比較高');
  await step(tok);                                   // 1607 拔掉 e'，貼上 e → T'
  me.mood('happy');
  eBad(ep); await beat(tok, 500); eOff(ep);
  eTree(e); cls3(e.lb, 'ptr alt');
  say('exchange argument：把 e\' 拔掉、e 貼上', '得到新的 T\'');
  await step(tok);                                   // 1621 要證：T' 是 spanning tree，而且比較便宜
  h = note("要證：① T' 是 spanning tree（feasible）② 比較便宜", 0, -1.2);
  say('要先說 T\' 是 spanning tree（feasible）', '再說它比較便宜，這樣才對');
  await step(tok);                                   // 1634 比較便宜：沒問題
  txt(cost, "cost(T') = 25 − 7 + 2 = 20 ✓"); cls3(cost, 'good');
  say('比較便宜沒問題：', '剪掉的 e\' 比較貴，貼上的 e 最便宜');
}]);

// 27:26 正確版證明（下）：T' connected、沒有 cycle → 是 tree
FRAG.push(['grjiang3-cut-proof2-feasible', 'T\' 仍是 tree：繞路還連得到、也沒有新 cycle', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P3, G3P3E, { name: g3n3 });
  for (const k of ['a', 'vp', 'v']) tint(G.N[k], C3.S);
  for (const k of ['b', 'wp', 'w']) tint(G.N[k], C3.R);
  cube('', C3.cut, [0.07, 6.4, 0.07], 0, 3.4, 0.25);
  const Tp = [['v', 'vp'], ['wp', 'w'], ['a', 'vp'], ['b', 'wp'], ['v', 'w']];
  for (const [u, v] of Tp) eTree(G.e(u, v));
  const ep = G.e('vp', 'wp'); eOff(ep);
  const me = pal3('', -6.4, -1.3, '#7cd1a8');
  let h = null, p = null;
  await step(tok);                                   // 1646 ① T' 一定是 connected
  txt(title, "① T' 是 connected 嗎？");
  say('新的 T\' 一定是 connected', '為什麼？');
  await step(tok);                                   // 1676 只影響原本靠 e' 連起來的點
  glow(G.N.vp, GOLD); glow(G.N.wp, GOLD);
  h = bub("e' 不見了：v' 和 w' 還連得到嗎？", 0, 6.3, 0.6);
  say('拔掉 e\' 只會影響原本靠 e\' 連起來的點', '要確認它們有沒有別的路');
  await step(tok);                                   // 1700 重新繞路：v' → v → e → w → w'
  remove(h);
  p = pkt('繞路', G.P.vp[0], G.P.vp[1] + 0.7, 0.6);
  await g3Walk(tok, p, [g3At(G, 'vp'), g3At(G, 'v'), g3At(G, 'w'), g3At(G, 'wp')], 600);
  glow(G.N.vp, null); glow(G.N.wp, null);
  good('v\' → v → e → w → w\'：連得到 ✓', 0, -0.4);
  say('沒關係，re-route：往下彎一下', 'v\' → v → e → w → w\'，一樣連得起來');
  await step(tok);                                   // 1728 ② 沒有 cycle
  remove(p);
  txt(title, '② T\' 沒有 cycle 嗎？');
  say('第二件事：tree 除了 connected', '還要沒有 cycle');
  await step(tok);                                   // 1764 唯一的 cycle 要靠 e'，而 e' 被砍掉了
  for (const [u, v] of [['v', 'vp'], ['wp', 'w'], ['v', 'w']]) eHot(G.e(u, v));
  eBad(ep); await beat(tok, 900);
  eOff(ep);
  for (const [u, v] of [['v', 'vp'], ['wp', 'w'], ['v', 'w']]) eTree(G.e(u, v));
  good('唯一可能的 cycle 需要 e\'，但 e\' 已砍掉 ✓', 0, -1.2);
  say('T\' 加上 e\' 才會有 cycle（只有這一圈）', '但 e\' 被砍掉了 → 沒有引進 cycle');
  await step(tok);                                   // 1796 connected + 沒 cycle + edge 數一樣 → tree，又比較便宜
  txt(title, "T' 是 tree，而且比較便宜 → MST 一定包含 e");
  for (const k of Object.keys(G.N)) glow(G.N[k], GREEN);
  me.mood('happy'); await me.hop(tok);
  for (const k of Object.keys(G.N)) glow(G.N[k], null);
  say('connected、沒有 cycle、edge 數一樣 → 還是 tree', 'cost 又比較低：MST 要包含 cut 上最便宜的 edge');
  await step(tok);                                   // 1828 cut property 很重要：Prim、Kruskal 都 based on 它
  const pr = pal3('Prim', 4.6, -1.3, '#9fb8ff', 0.5), kr = pal3('Kruskal', 6.4, -1.3, '#7cd1a8', 0.5);
  pr.mood('happy'); kr.mood('happy');
  say('cut property 很重要', 'Prim 和 Kruskal 都是 based on 它推出來的');
}]);

// 30:45 Cycle property：cycle 上最貴的 edge 可以安全砍掉
FRAG.push(['grjiang3-cycle-property', 'Cycle property：cycle 上最貴的 edge 可以砍掉', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const rv = pal3('reverse', 6.2, -1.3, '#e8a0c8');
  let G = null, h = null;
  await step(tok);                                   // 1846 第二個：cycle property
  txt(title, 'Cycle property');
  G = g3Graph(G3P, G3E, { drop: 1.2 });
  say('第二個 property：cycle property', '');
  await step(tok);                                   // 1850 跟 cut property 相反：哪些 edge 可以砍
  good('cut property：哪條 edge 可以放心「加」', -2.8, -0.4);
  bad('cycle property：哪條 edge 可以放心「砍」', 2.8, -1.1);
  say('跟 cut property 是相反的兩個極端', 'cut 談加 edge；cycle 談砍 edge');
  await step(tok);                                   // 1871 graph 裡有一個 cycle
  for (const [u, v] of [['A', 'B'], ['B', 'D'], ['A', 'D']]) { eHot(G.e(u, v)); await beat(tok, 300); }
  h = note('A–B–D 是一個 cycle', -2.6, 2.1, 0.6);
  say('假設 graph 裡有一個 cycle', '例如 A–B–D（edge 串成一圈）');
  await step(tok);                                   // 1887 cycle 上 cost 最高的可以安全砍掉
  const m = G.e('B', 'D'); eBad(m); cls3(m.lb, 'ptr alt');
  await beat(tok, 700); eOff(m);
  txt(h, 'BD 9 最貴 → 砍掉，不需要放在 MST');
  rv.mood('happy');
  say('cycle 上 cost 最高的那條（BD 9）', '可以非常安全地砍掉，不需要放在 MST 裡');
  await step(tok);                                   // 1900 證明一樣用 exchange argument（參考課本）
  note('證明：exchange argument，跟 cut property 很像（看課本）', 0, -1.9);
  say('證明一樣用 exchange argument', '課堂不講，可以參考課本');
  await step(tok);                                   // 1923 要小心：改完還是一棵 tree
  for (const [u, v] of G3MST) eTree(G.e(u, v));
  rv.look(-0.6); await rv.hop(tok);
  say('要小心的地方一樣：', '證明過程中，改完還要是一棵 tree');
}]);

// 32:17 實作：Prim 用 min priority queue、Kruskal 用 disjoint set
FRAG.push(['grjiang3-impl-overview', '實作：Prim 用 priority queue，Kruskal 用 union-find', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const dev = pal3('寫程式', 0, -0.6, '#f4a56a', 0.7, 0.8);
  const mon = prop('monitor', 1.6, -0.6, 0.6, 0.7);
  let b1 = null, b2 = null;
  await step(tok);                                   // 1937 演算法講完，接下來看 implementation
  txt(title, 'Implementation：寫程式要怎麼做？');
  dev.look(0.6);
  say('演算法講完了', '接下來看要怎麼實作');
  await step(tok);                                   // 1952 用到兩種特別的 data structure
  b1 = cube('?', C3.paper, [3.4, 1.2, 0.8], -3.6, 4.4, 0, 1.5);
  b2 = cube('?', C3.paper, [3.4, 1.2, 0.8], 3.6, 4.4, 0, 1.5);
  say('主要會用到兩種比較特別的', 'data structure');
  await step(tok);                                   // 1960 Prim：min priority queue（跟 Dijkstra 一樣）
  relabel(b1, 'min priority queue'); tint(b1, C3.S);
  pal3('Prim', -3.6, 1.6, '#9fb8ff', 0.6, 0.4).mood('happy');
  note('Prim 跟 Dijkstra 99% 一樣', -3.6, 6.2);
  say('Prim 用 min priority queue', 'procedure 跟 Dijkstra 99% 一模一樣');
  await step(tok);                                   // 1978 Kruskal：disjoint set（union-find）
  relabel(b2, 'disjoint set（union-find）'); tint(b2, C3.R);
  const k = pal3('Kruskal', 3.6, 1.6, '#7cd1a8', 0.6, 0.4); k.mood('happy');
  dev.mood('happy');
  say('Kruskal 需要 disjoint set', '它的實作也有人叫 union-find');
}]);

// 33:08 Prim 配合 cut property：S = 目前的樹，每輪選 cut 上最便宜的
FRAG.push(['grjiang3-prim-cut', 'Prim 為什麼對：S = 目前的樹，選 cut 上最便宜的', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  const pr = pal3('Prim', 6.2, -1.3, '#9fb8ff');
  const inT = new Set();
  let h = null;
  const showCut = () => { for (const e of g3Front(G, inT)) eCut(e); for (const k of inT) tint(G.N[k], C3.done); };
  await step(tok);                                   // 1988 用 cut property 看 Prim
  txt(title, 'Prim + cut property');
  say('很快來看 Prim', '配合剛剛介紹的 cut property');
  await step(tok);                                   // 2005 cut property 回顧
  h = note('cut property：S 和 V−S 之間被剪到的 edge，最便宜的一定安全', 0, -0.4);
  say('把點分成 S 和 V−S', '被剪到的 edge 中 cost 最低的一定安全');
  await step(tok);                                   // 2023 Prim：從一點開始，往外看最便宜的觸角
  txt(h, 'Prim：從一點開始，每次往外接最便宜的觸角');
  say('Prim 的 basic idea：從一個點開始', '每次往外看，用最便宜的 edge 伸出觸角');
  await step(tok);                                   // 2044 從 D 開始：S = {D}，cut 在這裡
  inT.add('D'); showCut();
  txt(h, 'S = 目前長出的樹 = {D}；粉紅 = cut 上的 edge');
  say('從 D 開始。每個 iteration，S = 目前的樹', '現在 S 只有 D，cut 在這裡');
  await step(tok);                                   // 2067 選 cut 上最便宜的，加進來
  await g3PrimPick(tok, G, inT, 500, true);
  pr.mood('happy');
  say('選這個 cut 上 cost 最便宜的：DA 5', '把它加進來');
  await step(tok);                                   // 2073 第二輪：S = 樹，cut 往外移
  showCut();
  txt(h, 'S = {D, A}：cut 跟著樹往外移');
  say('第二個 iteration：樹在哪裡，S 就在哪裡', 'cut 就往外看一下');
  await step(tok);                                   // 2085 選 cut 上 cost 最低的
  await g3PrimPick(tok, G, inT, 500, true);
  say('選 cut 上 cost 最低的 edge：DF 6', '');
  await step(tok);                                   // 2090 cut 改變，一樣選最低
  showCut(); await beat(tok, 600);
  await g3PrimPick(tok, G, inT, 300, true);
  say('cut 變了，一樣在裡面選最低的', 'AB 7');
  await step(tok);                                   // 2100 直到所有點都加進來
  for (let r = 0; r < 3; r++) { showCut(); await g3PrimPick(tok, G, inT, 300, true); }
  for (const k of inT) tint(G.N[k], C3.done);
  say('cut 再變、再選最低……', '直到所有點都加進來');
  await step(tok);                                   // 2106 為什麼對：cut property
  txt(h, '每一步選的都是某個 cut 上最便宜的 → cut property 保證安全');
  cls3(h, 'good');
  await pr.hop(tok);
  say('為什麼會對？', 'cut property 告訴我們每一步這樣加都沒問題');
}]);

// 35:16 Prim 的 procedure = Dijkstra 改一行（d 值的設計）
FRAG.push(['grjiang3-prim-vs-dijkstra', 'Prim = Dijkstra 改一行：d[v] 只看 w(u,v)', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.4);
  const cd = code([
    'DIJKSTRA(G, w, s)',
    '1  for each v ∈ V: d[v] = ∞;  d[s] = 0',
    '2  Q = V          // min-priority queue, key = d',
    '3  while Q ≠ ∅: u = EXTRACT-MIN(Q)',
    '4    for v ∈ Adj[u]: d[v] = min(d[v], d[u] + w(u,v))',
  ], -1.0, 6.6);
  const tree = cube('s … u', C3.done, [1.6, 0.7, 0.6], -3.6, 1.2, 0);
  const vv = cube('v', C3.node, [0.7, 0.7, 0.7], 1.2, 1.2, 0);
  const ed = g3Bar(-2.7, 1.2, 0.8, 1.2, C3.edge, 0.1);
  const pr = pal3('Prim', 6.0, -1.3, '#9fb8ff'), dj = pal3('Dijkstra', 4.4, -1.3, '#f4d06f');
  let wl = null, du = null, dv = null, h = null;
  await step(tok);                                   // 2116 這裡放的是 Dijkstra 的 procedure
  txt(title, '這是 Dijkstra 的 procedure');
  dj.mood('happy');
  say('這邊放的 procedure 其實是 Dijkstra', '它跟 Prim 基本上一模一樣');
  await step(tok);                                   // 2134 只有一行不一樣：第四行
  cd.hl(4);
  say('到底哪裡不一樣？', '只有一行不一樣：第四行');
  await step(tok);                                   // 2159 d-value 的設計不一樣
  h = note('不一樣的是 d-value 的設計', 3.2, 3.0, 0.4);
  say('只有 d-value 的設計不一樣', '');
  await step(tok);                                   // 2167 題目不一樣，做法就要改
  txt(h, '題目不一樣 → 要想怎麼修正，不能閉眼套');
  say('題目不一樣，做法當然要不一樣', '不能閉上眼睛直接套');
  await step(tok);                                   // 2182 Dijkstra：d = 從 source 到這點的最短距離
  remove(h);
  du = tag('d[u] = 7', 'ptr', -3.6, 2.1);
  wl = tag('w(u,v) = 3', 'val', -1.0, 1.7, 0.1);
  dj.look(-0.8);
  say('Dijkstra 的 d-value：', '從 source 到目前這個點的最短距離');
  await step(tok);                                   // 2200 前一點的最短距離再延伸一條 edge
  dv = tag('Dijkstra：d[v] = d[u] + w = 7 + 3 = 10', 'ptr alt', 2.6, 2.3);
  const p = pkt('7 + 3', -3.6, 1.8, 0.6);
  await travel(tok, p, V3(-3.6, 1.8, 0.6), V3(1.2, 1.8, 0.6), 900);
  remove(p);
  say('前一點的最短距離，再往後延伸一條 edge', '才是新點的 d-value');
  await step(tok);                                   // 2218 Prim 考慮的不是 source 的最短距離
  txt(title, 'Prim：用最少 cost 把所有點連起來');
  pr.mood('wow');
  say('Prim 考慮的不是 source 到每點的最短距離', '目標是用最少 cost 把所有點連起來');
  await step(tok);                                   // 2236 只看這棵樹有沒有便宜的觸角
  glow(tree, GREEN); glow(ed, GOLD);
  say('只要看當下長出來的這棵樹', '有沒有最便宜的觸角可以往外伸');
  await step(tok);                                   // 2253 不用加前面的 d 值，只看黏上去的 cost
  glow(tree, null); glow(ed, null);
  kill(du);
  const pv = tag('Prim：d[v] = w(u,v) = 3', 'good', 2.6, 3.1);
  pr.mood('happy');
  say('不用管 root 在哪、不用加前面的 d-value', '只看黏上這棵樹的 edge cost');
  await step(tok);                                   // 2278 每個點的 d：跟樹上誰的 edge 最近
  tint(vv, C3.S);
  note('d[v] = v 接到目前這棵樹的最便宜 edge', 2.6, 4.0, 0.4);
  say('每個點 maintain：往回看目前的樹', '跟誰的 edge 最便宜，那就是它的 d-value');
  await step(tok);                                   // 2298 改這一行就變 Prim；一樣用 min priority queue
  txt(cd.ls[0], 'PRIM(G, w, s)                                      ');
  txt(cd.ls[4], '4    for v ∈ Adj[u], v ∈ Q: d[v] = min(d[v], w(u,v))');
  await pr.hop(tok);
  say('寫好 Dijkstra，只要改這一行就變 Prim', '都用 min priority queue，complexity 也很像');
}]);

// 38:44 Kruskal 的 procedure：排序、只有點、兩端不在同一棵樹才加
FRAG.push(['grjiang3-kruskal-proc', 'Kruskal 的 procedure：兩端不在同一棵樹才加', async (tok) => {
  fresh([0.4, 3.4, 14.4], [0.4, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  const F = g3Forest(G);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  let L = null, h = null;
  const add = (i) => { const [u, v] = G3E[i]; eTree(G.e(u, v)); F.union(u, v); if (L) cls3(L[i], 'good'); };
  await step(tok);                                   // 2324 Kruskal：每輪加一條 edge，merge 兩棵小樹
  txt(title, 'Kruskal 的 procedure');
  say('Kruskal：每個 iteration 加一條 edge', '把兩棵小樹 merge 在一起');
  await step(tok);                                   // 2336 把剛剛口述的步驟寫成 procedure
  h = note('把 demo 的步驟寫成 procedure', 0, -0.4);
  say('下面的 procedure 就是把剛剛口述的方式', '一步一步寫出來');
  await step(tok);                                   // 2349 edge 依 cost 從小排到大
  L = g3List(G3E.map(g3Name), 6.4, 6.6, 0.52);
  for (const l of L) cls3(l, 'ptr');
  txt(h, '第 1 步：edge 依 cost 從小排到大');
  say('一開始先把所有 edge 的 cost', '從小排到大');
  await step(tok);                                   // 2356 一開始只有點，沒有 edge
  for (const e of G.E) eOff(e);
  F.paint();
  txt(h, '一開始：只有點，沒有 edge');
  say('一開始只看到點', '沒有 edge');
  await step(tok);                                   // 2360 每輪加一條，把對應的兩棵樹 merge
  for (const e of G.E) eNorm(e);
  for (let i = 0; i < 5; i++) { add(i); await beat(tok, 350); }
  txt(h, '每加一條 edge：對應的兩棵樹 merge 成一棵');
  say('每個 iteration 加一條 edge', '把對應的兩棵樹 merge 成一棵');
  await step(tok);                                   // 2378 什麼時候可以加？demo 時：不要產生 cycle
  const bc = G.e('B', 'C'); eHot(bc); cls3(L[5], 'ptr alt');
  txt(h, '什麼時候可以安全加進來？demo：不要產生 cycle');
  kr.look(0.5);
  say('什麼樣的狀況這條 edge 可以安全放進來？', 'demo 時用圖看：不要產生 cycle');
  await step(tok);                                   // 2389 簡單說：兩端在目前的解裡沒有 connected
  glow(G.N.B, GOLD); glow(G.N.C, GOLD);
  txt(h, '實際上：這條 edge 的兩端，現在還沒有 connected');
  say('簡單地說：這條 edge 的兩端', '在目前的解當中還沒有 connected');
  await step(tok);                                   // 2401 已經 connected 再加 → 馬上 cycle
  eBad(bc); kr.mood('wow');
  const t = bad('B、C 已在同一棵樹 → 加了就 cycle', 0.6, 2.2, 0.8);
  say('如果原本已經 connected 再加進去', '馬上就形成 cycle');
  await step(tok);                                   // 2422 iterative 做到所有點都加進來
  glow(G.N.B, null); glow(G.N.C, null); remove(t);
  eOff(bc); cls3(L[5], 'bad');
  for (const i of [6, 7]) { eOff(G.e(G3E[i][0], G3E[i][1])); cls3(L[i], 'bad'); await beat(tok, 300); }
  add(8); kr.mood('happy'); await kr.hop(tok);
  txt(h, '重複做，直到所有點都連進來');
  say('iterative 這樣做', '直到所有點都加進來就停');
}]);

// 41:15 下一堂：回顧 Kruskal（小苗、樹枝、同一棵樹的兩點會造成 cycle）
FRAG.push(['grjiang3-kruskal-recap', '回顧 Kruskal：樹枝只能接在兩棵不同的樹之間', async (tok) => {
  fresh([0.4, 3.4, 14.4], [0.4, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  for (const e of G.E) eOff(e);
  const F = g3Forest(G);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  let L = null, h = null;
  const add = (i) => { const [u, v] = G3E[i]; eTree(G.e(u, v)); F.union(u, v); if (L) cls3(L[i], 'good'); };
  await step(tok);                                   // 2475 今天先把 Kruskal 的實作講完
  txt(title, '（新的一堂）先把 Kruskal 的實作講完');
  say('今天一開始先把 Kruskal 的實作講完', '再進入新的單元');
  await step(tok);                                   // 2496 一開始每個點都是一棵小樹（小苗）
  F.paint();
  for (const k of Object.keys(G.N)) { const s = cube('', '#3f9a3a', [0.16, 0.35, 0.16], G.P[k][0] + 0.12, G.P[k][1] + 0.55, 0); s.rotation.z = -0.4; bob(s, 0.04, 3); }
  say('Kruskal 的 idea：一開始每個點', '都是一棵小樹，像一顆小苗');
  await step(tok);                                   // 2512 每輪選一條 edge 當樹枝，接起兩顆小苗
  h = note('每輪選一條 edge（樹枝），把兩棵連起來', 0, -0.4);
  say('每個 iteration 選一條 edge', '像樹枝一樣把兩顆小苗連起來');
  await step(tok);                                   // 2525 每輪都這樣，直到一棵大樹
  txt(h, '一直 merge，直到所有點建成一棵大樹');
  say('每個 iteration 都把兩棵現有的樹 merge', '直到所有點都建成一棵大樹');
  await step(tok);                                   // 2542 從 cost 比較小的樹枝開始選
  txt(h, '選樹枝：從 cost 比較小的開始');
  say('怎麼選長出去的樹枝？', '從 cost 比較小的 branch 開始選');
  await step(tok);                                   // 2559 例子：先從小排到大
  for (const e of G.E) eNorm(e);
  L = g3List(G3E.map(g3Name), 6.4, 6.6, 0.52);
  for (const l of L) cls3(l, 'ptr');
  txt(h, '先把 edge 從小排到大，一一檢視');
  say('上次看過的例子：先依 cost 從小排到大', '再一一檢視這些 edge');
  await step(tok);                                   // 2583 最小 5：merge A、D；依此類推
  for (let i = 0; i < 5; i++) { add(i); await beat(tok, 380); }
  kr.mood('happy');
  say('從最小的開始：cost 5 把 A、D merge', '依此類推，小樹慢慢 merge 出來');
  await step(tok);                                   // 2600 每次都跨在兩棵小樹之間
  txt(h, '每條加進來的 edge，都跨在兩棵不同的小樹之間');
  glow(G.N.G, GOLD); await beat(tok, 600); glow(G.N.G, null);
  say('每次加進來的 edge', '都是跨在目前的兩棵小樹之間');
  await step(tok);                                   // 2618 若接在同一棵樹的兩點 → cycle
  txt(h, '若兩端在同一棵樹裡 → 造成 cycle，就不是 tree');
  kr.mood('wow');
  say('如果接在同一棵樹裡的兩個點', '會造成 cycle：不是 tree，cost 反而更高');
  await step(tok);                                   // 2639 例如這條 8：兩端同屬一棵樹 → 不需要
  const bc = G.e('B', 'C'); cls3(L[5], 'ptr alt'); eHot(bc);
  await beat(tok, 500); eBad(bc);
  const t = bad('cost 8：兩端早就連在一起 → 不需要', 1.6, 6.6, 0.8);
  say('例如這條 cost 8 的 edge：兩端同屬一棵樹', '本來就已經連在一起，不必多花 cost');
  await step(tok);                                   // 2672 跳過，繼續到全部 merge 成一棵樹
  remove(t); eOff(bc); cls3(L[5], 'bad');
  for (const i of [6, 7]) { eOff(G.e(G3E[i][0], G3E[i][1])); cls3(L[i], 'bad'); await beat(tok, 300); }
  add(8); kr.mood('happy'); await kr.hop(tok);
  txt(h, '跳過它，繼續，直到所有點 merge 成一棵樹');
  say('所以跳過它，繼續下去', '直到所有點都 merge 成一棵樹');
}]);

// 44:45 Kruskal pseudocode：sort、T = ∅、for loop（line 3–5）
FRAG.push(['grjiang3-kruskal-code', 'Kruskal pseudocode：排序、T = ∅、line 3–5 一條條檢視', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const cd = code([
    'KRUSKAL(G, w)',
    '1  sort edges: w(e1) ≤ w(e2) ≤ … ≤ w(em)',
    '2  T = ∅',
    '3  for i = 1 to m:          // ei = (u, v)',
    '4    if u、v 不在同一棵 tree:',
    '5      T = T ∪ {ei}         // 兩棵 tree 合併',
    '6  return T',
  ], -2.4, 6.8, 0.52);
  const G = g3Graph(G3P, G3E, { sx: 0.55, sy: 0.5, dx: 3.6, dy: -0.7, size: 0.5, th: 0.08 });
  for (const e of G.E) cls3(e.lb, 'idx');
  for (const e of G.E) eOff(e);
  { const l = G.e('D', 'E').lb; l.position.y -= 0.7; } // small graph: DE's weight goes under its edge, away from BD's
  const F = g3Forest(G);
  const Tt = tag('', 'ptr', -3.2, 2.4);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  const T = [];
  const showT = () => txt(Tt, 'T = { ' + T.join(', ') + ' }');
  const add = (i) => { const [u, v] = G3E[i]; eTree(G.e(u, v)); F.union(u, v); T.push(u + v); showT(); };
  const skip = (i) => { const [u, v] = G3E[i]; eBad(G.e(u, v)); };
  let h = null;
  await step(tok);                                   // 2685 寫成 procedure
  say('把這些動作寫成 procedure', '就是下面這樣簡單的樣子');
  await step(tok);                                   // 2696 第一件事：edge 從小排到大，e1 最小、em 最大
  cd.hl(1);
  for (const e of G.E) { eNorm(e); cls3(e.lb, 'val'); }
  h = note('e1 = 最小 cost 的 edge … em = 最大的', -2.4, 0.9);
  say('第一件事：所有 edge 依 cost 從小排到大', 'e1 最小，em 是 cost 最大的');
  await step(tok);                                   // 2714 一開始只有點：T = ∅
  cd.hl(2); remove(h);
  F.paint(); showT();
  say('Kruskal 從只有點開始', 'T 放選定的 edge，一開始是空集合');
  await step(tok);                                   // 2736 line 3–5 的 for loop：每輪加一條進 T
  cd.hl(3);
  h = note('line 3–5：每個 iteration 加一條 edge 到 T', -2.4, 0.9);
  say('透過 line 3–5 的 for loop', '每個 iteration 加一條新的 edge 到 T');
  await step(tok);                                   // 2752 依排序一一檢視
  remove(h);
  for (let i = 0; i < 5; i++) { add(i); await beat(tok, 380); }
  say('依排好的順序，從小到大一一檢視', '樹慢慢長出來');
  await step(tok);                                   // 2763 兩端已在同一棵 tree → discard
  cd.hl(4); skip(5);
  h = bad('BC：B、C 已同屬一棵 tree → discard', -2.4, 0.9);
  kr.mood('wow');
  say('如果這條 edge 的兩端已經同屬一棵 tree', '就不要理它：discard');
  await step(tok);                                   // 2791 不在同一棵 → 放進來，兩棵合併
  remove(h); eOff(G.e('B', 'C'));
  for (const i of [6, 7]) { skip(i); await beat(tok, 250); eOff(G.e(G3E[i][0], G3E[i][1])); }
  cd.hl(5); add(8); kr.mood('happy');
  h = good('EG：兩端不在同一棵 → 放進 T', -2.4, 0.9);
  say('兩端不同屬一棵 tree：就放進來', '把現有的兩棵小樹長成一棵比較大的');
  await step(tok);                                   // 2815 iteratively 做到結束
  cd.hl(6); remove(h);
  h = tag('total = 39', 'ptr alt', -2.4, 0.9);
  say('iteratively 這樣做', '直到結束就停下來');
  await step(tok);                                   // 2820 概念式；真的寫程式要配合 data structure
  cd.hl(4); remove(h);
  bub('「同一棵 tree 嗎？」程式要怎麼判斷？', -2.4, 0.9, 0.6);
  kr.look(0.4);
  say('這樣寫還是概念式的', '真的寫成程式，背後要配合 data structure');
}]);

// 47:18 Union-find：disjoint set，每個 set 有代表人；三個 operation
FRAG.push(['grjiang3-disjoint-set', 'Disjoint set：每個 set 有代表人（像班代）', async (tok) => {
  fresh([0, 3.6, 14], [0, 2.6, 0]);
  const title = tag('', 'ptr alt', 0, 7.0);
  const zs = [zone('set 1', -4.6, 0.95, 0, 3.6, 2.2), zone('set 2', 0, 0.95, 0, 3.6, 2.2), zone('set 3', 4.6, 0.95, 0, 3.6, 2.2)];
  zs.forEach((z) => z.userData.name.position.set(z.position.x - 1.6, 0.45, 1.25)); // set names under the front edge, clear of the members
  const COL = ['#e57373', '#64b5f6', '#81c784'];
  const SP = [[[-5.6, 0.2], [-4.6, -0.5], [-3.6, 0.3]], [[-0.8, -0.2], [0.8, 0.2]], [[3.8, 0.1], [5.4, -0.3]]];
  const VAL = [['1', '5', '7'], ['2', '6'], ['3', '4']];
  const st = [];
  const reps = [];
  let h = null;
  await step(tok);                                   // 2839 回顧 Data Structure 學過的 union-find
  txt(title, 'Union-find（Data Structure 學過）');
  say('很快 review：Data Structure 介紹過的', 'union-find 這個 data structure');
  await step(tok);                                   // 2848 專門實作 disjoint set；Kruskal 的每棵小樹 = 一個 set
  h = note('Kruskal：當下的每一棵小樹 = 一個 disjoint set', 0, 6.3);
  say('它專門用來 implement disjoint set', 'Kruskal 當下的每棵小樹就是一個 disjoint set');
  await step(tok);                                   // 2870 一堆集合，元素不重複
  remove(h);
  SP.forEach((g, s) => g.forEach(([x, z], i) => { st.push({ s, b: pal3('', x, 1.0, COL[s], 0.5, z) }); st[st.length - 1].b.set(VAL[s][i]); }));
  say('disjoint set：一堆集合', '每個元素只屬於一個 set，不重複');
  await step(tok);                                   // 2903 每個 set 有一個代表人（representative）
  for (let s = 0; s < 3; s++) { const b = st.find((q) => q.s === s).b; b.glow(GOLD); reps.push(tag('代表人', 'pkt', SP[s][0][0], 2.3, SP[s][0][1])); }
  say('每一個 set 會有一個代表人', 'representative');
  await step(tok);                                   // 2916 例子：學籍，每人只屬於一個系
  ['電子系', '資工系', '電機系'].forEach((n, s) => txt(zs[s].userData.name, n));
  say('舉例：學校裡每個學生都有學籍', '每個人只屬於一個系，不會同時屬於兩個');
  await step(tok);                                   // 2962 一個系級 = 一個 set；全校 = 很多 disjoint set
  h = note('一個系級 = 一個 set；全校 = 很多 disjoint set', 0, 6.3);
  st.forEach((q) => q.b.mood('happy'));
  say('一個系級就是一個 set', '全校學生 = 很多不重複的 set 組成');
  await step(tok);                                   // 2977 每個系級有代表人：班代
  reps.forEach((r) => txt(r, '班代'));
  say('每個系級通常有代表人', '就是班代');
  await step(tok);                                   // 2991 用代表人判斷是否同一個 set
  remove(h);
  h = bub('5 和 2 同班嗎？問班代：1 ≠ 2 → 不同', 0, 6.3, 0.4);
  st[1].b.look(1); st[3].b.look(-1);
  say('為什麼代表人很重要？', '用代表人判斷兩個 element 是不是同一個 set');
  await step(tok);                                   // 3007 三個 operation：make set
  remove(h);
  const ops = [tag('MAKE-SET(x)', 'ptr alt', -4.2, 6.3), tag('FIND(x)', 'ptr', 0, 6.3), tag('UNION(x, y)', 'ptr', 4.2, 6.3)];
  const nb = pal3('', 5.6, 1.0, '#ffd54f', 0.5, 1.4); nb.set('8'); nb.mood('wow');
  say('常用的三個 operation', '第一個：MAKE-SET，create 一個新的 set');
  await step(tok);                                   // 3034 find：問它屬於哪個 set → 回傳代表人
  cls3(ops[0], 'ptr'); cls3(ops[1], 'ptr alt');
  const p = pkt('FIND(7)', SP[0][2][0], 2.2, SP[0][2][1]);
  await travel(tok, p, V3(SP[0][2][0], 2.2, SP[0][2][1]), V3(SP[0][0][0], 2.9, SP[0][0][1]), 800);
  txt(p, 'FIND(7) = 1（代表人）');
  say('FIND：給一個 element，問它屬於哪個 set', '吐出那個 set 的 representative');
  await step(tok);                                   // 3071 union：合併兩個 set，選新的代表人
  remove(p); cls3(ops[1], 'ptr'); cls3(ops[2], 'ptr alt');
  const mv = st.filter((q) => q.s === 2);
  await anim(tok, 1200, (u) => mv.forEach((q, i) => { q.b.g.position.x = SP[2][i][0] + (SP[1][i][0] + 0.4 - SP[2][i][0]) * u; q.b.g.position.z = SP[2][i][1] + (0.9 - SP[2][i][1]) * u; }));
  mv.forEach((q) => q.b.glow(null));
  remove(reps[2]); zs[2].visible = false; remove(zs[2].userData.name);
  say('UNION：把兩個 set 合併成比較大的 set', '原本各有代表人，要重新選一個');
}]);

// 51:39 用 tree 表示 set：root 是代表人，find 往上走，union 把 root 指過去
const UFB = { 0: [-5, 5.6], 6: [-6, 4.1], 8: [-4, 4.1], 7: [-6, 2.6], 4: [-2, 5.6], 1: [-2.8, 4.1], 9: [-1.2, 4.1] };
const UFA = { 0: [3.2, 5.6], 6: [1.4, 4.1], 8: [3.2, 4.1], 4: [5, 4.1], 7: [1.4, 2.6], 1: [4.2, 2.6], 9: [5.8, 2.6] };
function g3UF(P, par, color) {
  const N = {}, A = [];
  for (const k of Object.keys(P)) N[k] = cube(k, color(k), [0.7, 0.7, 0.7], P[k][0], P[k][1], 0);
  const draw = () => {
    A.forEach(kill); A.length = 0;
    for (const k of Object.keys(par)) if (par[k] !== k) { const a = N[k].position, b = N[par[k]].position; const d = b.clone().sub(a).normalize(); A.push(arrow(a.clone().addScaledVector(d, 0.45), b.clone().addScaledVector(d, -0.45), 0x6e5f49)); }
  };
  draw();
  return { N, par, draw };
}
FRAG.push(['grjiang3-uf-trees', 'Union-find 的樹：root 是代表人，淺的接到深的', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.4, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const s1 = new Set(['0', '6', '7', '8']);
  const col = (k) => (s1.has(k) ? '#e57373' : '#64b5f6');
  let B = null, A = null, h = null, c0 = null, c4 = null;
  const me = pal3('', 0, -1.2, '#f4a56a', 0.55);
  await step(tok);                                   // 3099 左邊紅色 set S1 = {0, 6, 7, 8}
  txt(title, '用 tree 表示每一個 set');
  B = g3UF({ 0: UFB[0], 6: UFB[6], 8: UFB[8], 7: UFB[7] }, { 0: '0', 6: '0', 8: '0', 7: '6' }, col);
  tag('S1', 'ptr', -5, 6.5);
  say('紅色是一個 set，叫 S1', 'member 有 0、6、7、8');
  await step(tok);                                   // 3111 S2 = {1, 4, 9}
  const B2 = g3UF({ 4: UFB[4], 1: UFB[1], 9: UFB[9] }, { 4: '4', 1: '4', 9: '4' }, col);
  Object.assign(B.N, B2.N);
  tag('S2', 'ptr', -2, 6.5);
  say('另一個 set 是 S2', 'member 是 1、4、9');
  await step(tok);                                   // 3116 union(S1, S2) 長成右邊這樣
  A = g3UF(UFA, { 0: '0', 6: '0', 8: '0', 4: '0', 7: '6', 1: '4', 9: '4' }, col);
  tag('UNION(S1, S2) →', 'say', 0.2, 6.5);
  say('UNION(S1, S2)：merge 在一起', '長成右邊這個樣子');
  await step(tok);                                   // 3128 每個 set 用一棵 tree；root = 代表人
  c0 = pkt('代表人', UFB[0][0], 6.3, 0.4); c4 = pkt('代表人', UFB[4][0], 6.3, 0.4);
  glow(B.N[0], GOLD); glow(B.N[4], GOLD);
  say('常見的實作：每個 set 用一棵 tree 表示', 'tree 的 root 就是 set 的 representative');
  await step(tok);                                   // 3146 find(7)：往上找 parent，直到 root → 0
  const p = pkt('FIND(7)', UFB[7][0], UFB[7][1] + 0.6, 0.6);
  await g3Walk(tok, p, [V3(UFB[7][0], UFB[7][1] + 0.6, 0.6), V3(UFB[6][0], UFB[6][1] + 0.6, 0.6), V3(UFB[0][0], UFB[0][1] + 0.6, 0.6)], 600);
  txt(p, 'FIND(7) = 0');
  say('FIND(7)：往上問 parent，直到 root', '找到代表人 0');
  await step(tok);                                   // 3177 find(9) → 4
  remove(p);
  const p2 = pkt('FIND(9)', UFB[9][0], UFB[9][1] + 0.6, 0.6);
  await travel(tok, p2, V3(UFB[9][0], UFB[9][1] + 0.6, 0.6), V3(UFB[4][0], UFB[4][1] + 0.6, 0.6), 600);
  txt(p2, 'FIND(9) = 4');
  say('FIND(9)：回應說屬於 4 這個 set', '');
  await step(tok);                                   // 3187 union：把一棵的 root 指向另一棵的 root
  remove(p2);
  glow(A.N[4], GOLD);
  h = bub('4 的 root 指向 0', 4.4, 5.4, 0.6);
  say('UNION 最簡單：把一棵樹的 root', '指向另一個 set 的 root');
  await step(tok);                                   // 3212 新的代表人 = 原本比較大的 set 的代表人
  glow(A.N[4], null); glow(A.N[0], GOLD);
  txt(h, '新的代表人 = 0（原本比較大的 set）');
  pkt('代表人', UFA[0][0], 6.3, 0.4);
  say('也表示 merge 後的代表人', '是原本比較大那個 set 的代表人');
  await step(tok);                                   // 3227 左邊比較深，find(7) 要走很久；右邊淺
  remove(h);
  tag('深度 2：FIND(7) 走 2 步', 'bad', -5.4, 1.6);
  tag('深度 1：FIND(9) 走 1 步', 'good', -1.8, 3.1);
  me.mood('wow');
  say('左邊紅色比較深：FIND(7) 要往上走很長一段', '右邊淺：問一次就好');
  await step(tok);                                   // 3256 若把左邊併到右邊，左邊每點加深一層
  h = bad('反過來接（0 指向 4）：FIND(7) 要走 3 步', 3.2, 1.4);
  say('如果把左邊併到右邊', '左邊整棵加深一層：FIND(7) 要走 1、2、3 步');
  await step(tok);                                   // 3282 常見做法：淺的 merge 到深的
  txt(h, '所以：淺的 set 接到深的 set 上 ✓'); cls3(h, 'good');
  me.mood('happy'); await me.hop(tok);
  say('常見做法：比較淺的 set merge 到比較深的', '之後的 query 會比較均勻');
}]);

// 54:56 兩個技巧：union by rank + path compression → 幾乎 constant
const UFC = { 0: [0, 6.0], 6: [-2.4, 4.5], 8: [0, 4.5], 4: [2.4, 4.5], 7: [-2.4, 3.0], 1: [1.6, 3.0], 9: [3.2, 3.0], 2: [-5.4, 4.5], 3: [-6.2, 3.0], 5: [-4.6, 3.0] };
FRAG.push(['grjiang3-uf-tricks', 'Union by rank + path compression：幾乎 constant time', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.4, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const col = (k) => ('0678'.includes(k) ? '#e57373' : '149'.includes(k) ? '#64b5f6' : '#81c784');
  const U = g3UF(UFC, { 0: '0', 6: '0', 8: '0', 4: '0', 7: '6', 1: '4', 9: '4', 2: '2', 3: '2', 5: '2' }, col);
  const tj = pal3('Tarjan', 6.2, -1.2, '#c9a0f0', 0.6);
  let h = null, p = null;
  const at = (k) => V3(U.N[k].position.x, U.N[k].position.y + 0.6, 0.6);
  await step(tok);                                   // 3296 disjoint set = forest，代表人在 root
  txt(title, 'Disjoint set = forest（很多小樹）');
  pkt('代表人', UFC[0][0], 6.75, 0.4); pkt('代表人', UFC[2][0], 5.25, 0.4);
  say('最常見的實作：每個 set 長成一棵 tree', '很多 set → 一片 forest；代表人在 root');
  await step(tok);                                   // 3324 兩個常見技巧；Tarjan 的理論分析
  h = note('兩個技巧合起來 → operation 非常快（Tarjan 分析）', 0, -0.5);
  tj.mood('happy');
  say('介紹兩個常見的 technique，很容易理解', 'Tarjan 他們分析：合起來 operation 非常快');
  await step(tok);                                   // 3366 union by rank：小的樹併到大的
  txt(h, '① union by rank：小（淺）的樹併到大（深）的樹');
  say('第一個：union by rank', '剛剛說的，把比較小的樹併到比較大的');
  await step(tok);                                   // 3380 path compression
  txt(h, '② path compression');
  say('第二個：path compression', '');
  await step(tok);                                   // 3390 union 完之後，想 find(9)
  glow(U.N[9], GOLD);
  txt(h, 'S1、S2 union 完了；現在 FIND(9)');
  say('假設 S1、S2 已經 union 起來', '現在想要 FIND(9)');
  await step(tok);                                   // 3408 往上找 parent，直到 root → 0
  p = pkt('FIND(9)', 0, 0, 0);
  await g3Walk(tok, p, [at(9), at(4), at(0)], 650);
  txt(p, 'FIND(9) = 0');
  say('往上找 parent，再往上，直到 root', '回應說：屬於 0 這個 set');
  await step(tok);                                   // 3425 走幾步看它多深
  txt(h, '要走幾步？看它多深：越下面越多次');
  say('往上走多久？看它多深', '越下面，backtrack 的次數越多');
  await step(tok);                                   // 3437 做過一次 find，就把路上的人直接指向 root
  remove(p); glow(U.N[9], null);
  txt(h, 'path compression：find 過一次，路上每個人直接指向 root');
  say('Tarjan 提出 compression：做過一次 FIND', '路上所有人的 parent 指標都改指向 root');
  await step(tok);                                   // 3456 9 → 4 → 0 變成 9 直接 → 0
  U.par[9] = '0';
  U.N[9].position.set(4.6, 4.5, 0);
  U.draw();
  good('9 → 0：直接指向 root', 4.8, 5.6);
  say('原本 9 → 4 → 0', '做過 FIND(9) 後，9 直接指向 root 0');
  await step(tok);                                   // 3484 很深的話，整條路都指向 root，之後很快
  p = pkt('FIND(7)', 0, 0, 0);
  await g3Walk(tok, p, [at(7), at(6), at(0)], 500);
  remove(p);
  U.par[7] = '0'; U.N[7].position.set(-1.0, 4.5, 0); U.draw();
  say('如果點在很下面，路上會經過很多人', 'compression 後全部直接指向 root，之後 FIND 很快');
  await step(tok);                                   // 3506 動作很小，分攤（amortized）複雜度很低
  txt(h, '看起來很小的動作 → 以分攤的角度看，complexity 非常低');
  say('這個動作看起來很小', '但以分攤的角度看，complexity 非常低');
  await step(tok);                                   // 3529 兩個一起用 → 每個 operation O(α(n))
  txt(h, 'union by rank + path compression → 每個 operation O(α(n))');
  cls3(h, 'ptr alt');
  tj.mood('wow'); await tj.hop(tok);
  say('兩個技巧一起用：MAKE-SET、FIND、UNION', '幾乎 constant：O(α(n))');
  await step(tok);                                   // 3565 α 成長非常慢，實際上 < 5
  note('α(n)：成長非常緩慢，實際的 n 算出來都 < 5', 0, -1.3);
  say('α 是成長非常緩慢的函式', '實際會處理的 n，算出來都小於 5');
  await step(tok);                                   // 3594 總結
  txt(h, 'disjoint set：forest + union by rank + path compression');
  cls3(h, 'good');
  say('總結：用 forest 實作 disjoint set', 'union by rank；FIND 後做 path compression');
}]);

// 60:34 Kruskal + union-find：make-set、find 兩端、不同才 union
FRAG.push(['grjiang3-kruskal-uf', 'Kruskal + union-find：FIND 兩端，不同才 UNION', async (tok) => {
  fresh([0.4, 3.4, 14.4], [0.4, 3.0, 0]);
  const title = tag('', 'ptr alt', 0, 7.2);
  const G = g3Graph(G3P, G3E);
  const F = g3Forest(G);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  let crowns = [], L = null, h = null;
  const showReps = () => { crowns.forEach(remove); crowns = []; const rs = new Set(Object.keys(G.N).map(F.find)); for (const r of rs) crowns.push(pkt('代表', G.P[r][0] - 0.75, G.P[r][1] + 0.55, 0.5)); };
  const add = (i) => { const [u, v] = G3E[i]; eTree(G.e(u, v)); F.union(u, v); cls3(L[i], 'good'); showReps(); };
  await step(tok);                                   // 3635 Kruskal 實作用 union-find 處理小樹
  txt(title, 'Kruskal 的實作：disjoint set（union-find）');
  for (const e of G.E) eOff(e);
  say('Kruskal 的實作就是利用 union-find', '來處理這些小樹');
  await step(tok);                                   // 3648 一開始只有小苗：每點 MAKE-SET → n 個 set
  F.paint(); showReps();
  h = note('每個點 MAKE-SET 一次 → n 棵小樹 = n 個 set', 0, -0.4);
  say('一開始只有小苗：每個點都是一個 set', '每點 MAKE-SET 一次 → n 個 set');
  await step(tok);                                   // 3668 依 cost 排序，每輪看一條 edge
  for (const e of G.E) eNorm(e);
  L = g3List(G3E.map(g3Name), 6.4, 6.6, 0.52);
  for (const l of L) cls3(l, 'ptr');
  for (let i = 0; i < 5; i++) { add(i); await beat(tok, 350); }
  txt(h, '依 cost 從小到大，每個 iteration 看一條 edge');
  say('依 edge cost 從小排到大', '每個 iteration 拿一條出來看');
  await step(tok);                                   // 3678 FIND 兩端：代表人一樣 → discard
  const bc = G.e('B', 'C'); eHot(bc); cls3(L[5], 'ptr alt');
  txt(h, 'FIND(B) = FIND(C)：代表人一樣 → 同一棵樹 → discard');
  await beat(tok, 700); eBad(bc); kr.mood('wow');
  say('對兩端各做一次 FIND', '代表人是同一個 → 同一棵樹 → discard');
  await step(tok);                                   // 3704 代表人不同 → UNION
  eOff(bc); cls3(L[5], 'bad');
  for (const i of [6, 7]) { eOff(G.e(G3E[i][0], G3E[i][1])); cls3(L[i], 'bad'); }
  add(8); kr.mood('happy');
  txt(h, 'FIND(E) ≠ FIND(G)：不同樹 → UNION，merge 起來');
  say('代表人不一樣 → 屬於不同棵樹', '做 UNION 把它們 merge 起來');
  await step(tok);                                   // 3721 一般就是這樣做
  txt(h, 'Kruskal = 排序 + disjoint set（MAKE-SET、FIND、UNION）');
  cls3(h, 'good'); await kr.hop(tok);
  say('一般就是這樣配合 disjoint set', '來實作 Kruskal');
}]);

const KCODE = [
  'KRUSKAL(G, w)',
  '1  sort edges by w（小 → 大）',
  '2  T = ∅;  for each v ∈ V: MAKE-SET(v)',
  '3  for each edge (u, v)（依排序）:',
  '4    if FIND(u) ≠ FIND(v):',
  '5      T = T ∪ {(u, v)};  UNION(u, v)',
  '6  return T',
];
// 62:13 時間（上）：line 1 用 heapsort，O(m log m) = O(m log n)
FRAG.push(['grjiang3-kruskal-sort', 'Kruskal 的排序：heapsort O(m log n)', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const cd = code(KCODE, -2.6, 6.8, 0.56);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  const hp = [[3.6, 2.4], [2.6, 1.4], [4.6, 1.4], [2.1, 0.4], [3.1, 0.4]].map(([x, y], i) => cube([5, 6, 5, 7, 7][i], C3.S, [0.6, 0.5, 0.5], x, y, 0, 1));
  hp.slice(1).forEach((c, i) => { const p = K.land(hp[[0, 0, 1, 1][i]]), q = K.land(c); line(p.x, p.y - 0.25, q.x, q.y + 0.25, -0.1); });
  const ht = tag('', 'ptr', 3.6, 3.2);
  let r1 = null;
  await step(tok);                                   // 3733 line 1：用 Heap 做 heapsort
  cd.hl(1); txt(ht, 'Heap → heapsort');
  say('第一行：從小排到大', '可以用上次學的 Heap 做 heapsort');
  await step(tok);                                   // 3751 heapsort：n log n；這裡的 n 是 edge 數 m
  r1 = tag('sort：O(m log m)（m = edge 數）', 'ptr alt', 0, -0.5);
  say('heapsort 的 complexity：n log n', '但這裡排的是 edge：m 條 → O(m log m)');
  await step(tok);                                   // 3769 m ≤ n²：log m ≤ 2 log n → O(m log n)
  txt(r1, 'm ≤ n² → log m ≤ 2 log n → sort：O(m log n)');
  say('m 的 upper bound 是 n²', 'log n² 的 2 可以提下來 → O(m log n)');
  await step(tok);                                   // 3782 line 3–5 的 iteration；先 T = ∅、MAKE-SET n 次
  cd.hl(2);
  note('MAKE-SET 每個點一次 → n 個 set', 3.2, 4.2, 0.4);
  say('接著 line 3–5 的 for loop', '之前先 T = ∅，每個點 MAKE-SET → n 個 set');
  await step(tok);                                   // 3823 一一拿出來：FIND(u) ≠ FIND(v) 就加進 T
  cd.hl(4); await beat(tok, 700); cd.hl(5);
  kr.mood('happy');
  say('依排序一一拿出 edge：FIND(u) ≠ FIND(v)', '就不屬於同一個 set → 接起來丟進 T');
}]);

// 64:31 時間（下）：2m 次 FIND、n−1 次 UNION → O(m log n)；linear sort 可以更快
FRAG.push(['grjiang3-kruskal-total', 'Kruskal 的時間：O(m log n)，排序變 linear 就更快', async (tok) => {
  fresh([0, 3.4, 14], [0, 3.0, 0]);
  const cd = code(KCODE, -2.6, 6.8, 0.56);
  const kr = pal3('Kruskal', -6.4, -1.3, '#7cd1a8');
  const rows = [];
  const row = (t, c = 'ptr') => { const l = tag(t, c, 3.4, 2.6 - rows.length * 0.62); rows.push(l); return l; };
  let tot = null;
  await step(tok);                                   // 3871 complexity 多高？line 1 排序 m log n
  cd.hl(1);
  row('line 1 sort：O(m log n)');
  say('complexity 有多高？', 'line 1 排序：m log m，也就是 O(m log n)');
  await step(tok);                                   // 3901 line 3：每條 edge 拿出來檢查 → m 次
  cd.hl(3);
  row('line 3：m 條 edge 各看一次');
  say('line 3：把每一條 edge 拿出來', '一一檢視 → m 次');
  await step(tok);                                   // 3919 每條要做兩次 FIND
  cd.hl(4);
  row('line 4：每條 2 次 FIND → 2m 次');
  say('每一條 edge 兩個端點各做一次 FIND', '每條 2 次 FIND');
  await step(tok);                                   // 3935 line 5 會做幾次？
  cd.hl(5);
  const q = row('line 5：UNION 幾次？', 'say');
  kr.look(0.5);
  say('line 5：兩端不一樣才加進來', '這一行總共會做幾次？');
  await step(tok);                                   // 3965 MST 只有 n−1 條 edge → n−1 次 UNION
  txt(q, 'line 5：只有 n − 1 次 UNION'); cls3(q, 'ptr');
  bub('MST 只有 n − 1 條 edge', 3.4, 4.0, 0.4);
  say('不要算成 m 次：最後的 MST', '只有 n−1 條 edge → exactly n−1 次 UNION');
  await step(tok);                                   // 4015 每個 operation ≈ α(n) → 總共 O(m log n)
  tot = tag('total：O(m log n)', 'ptr alt', 0, -0.6);
  say('union by rank + path compression：', '每個 operation 約 α(n) → 整體 O(m log n)');
  await step(tok);                                   // 4040 不滿意？排序是 comparison-based
  cd.hl(1);
  txt(rows[0], 'line 1：comparison-based sort ≥ n log n');
  kr.mood('wow');
  say('不夠滿意？可以改進排序', '只靠比較的 comparison-based sort 最快 n log n');
  await step(tok);                                   // 4065 有其他資訊 → linear time sort
  txt(rows[0], 'line 1：counting / radix sort → linear time');
  cls3(rows[0], 'good');
  say('配合其他 information', '可以做 linear time 的排序：counting sort、radix sort');
  await step(tok);                                   // 4090 for loop：m α(n) → 幾乎 linear
  cd.hl(3);
  txt(rows[1], 'line 3–5：O(m α(n))，幾乎 linear');
  cls3(rows[1], 'good');
  say('後面的 for loop 最多 m 個 iteration', '每個幾乎 constant → m α(n)，幾乎 linear');
  await step(tok);                                   // 4121 前提：linear sort + union-find
  txt(tot, '前提：linear sort + union-find → 幾乎 linear');
  kr.mood('happy'); await kr.hop(tok);
  say('前提：用 linear sorting', '再加上 union-find');
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
    quiz: genQ,
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['feasible-optimal', 'greedy-general', 'greedy-filter', 'activity-select', 'activity-proof', 'activity-wrong-rules', 'huffman-build', 'huffman-cost', 'frac-knapsack', 'knapsack-greedy-fail', 'job-sequencing', 'optimal-merge', 'greedy-or-dp'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
