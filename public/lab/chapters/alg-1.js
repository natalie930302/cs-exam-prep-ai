// 演算法 第1章：複雜度與遞迴（frequency count、迴圈分析、O/Ω/Θ、遞迴式、Master Theorem、攤銷）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 場景依影片段落：Abdul Bari 1.x / 2.x、MIT 6.006 L8/L9/Rec10；課本補充場景以 CLRS 為準。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const C = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', pink: '#e55a9b', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e' };
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const lg = (x) => Math.log2(x);
  const fmt = (x) => !isFinite(x) ? '∞' : Math.abs(x) >= 1e6 ? x.toExponential(1) : Number.isInteger(x) ? String(x) : (Math.round(x * 100) / 100).toString();
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
  const cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => cls(l, k === i ? 'ptr alt' : '')); }, set(i, s) { txt(ls[i], s.padEnd(w, ' ')); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function setBar(m, h, y0 = 0) { m.scale.y = Math.max(0.001, h); m.position.y = y0 + Math.max(0.001, h) / 2; }
  function growBar(tok, m, h, ms, y0 = 0) { const h0 = m.scale.y; return anim(tok, ms, (t) => setBar(m, h0 + (h - h0) * t, y0)); }
  function line(x1, y1, x2, y2, z = 0, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function ghostBox(color, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    lab.world.add(m); return m;
  }
  // a 2D plot standing on the floor: thick tube curves so they read well on a small stage
  function plot(x0, y0, w, h, xmax, ymax, xl = 'n') {
    line(x0, y0, x0 + w + 0.3, y0, 0, '#6e5f49'); line(x0, y0, x0, y0 + h + 0.3, 0, '#6e5f49');
    tag(xl, 'idx', x0 + w + 0.6, y0);
    const X = (n) => x0 + n / xmax * w, Y = (v) => y0 + Math.max(0, Math.min(v, ymax)) / ymax * h;
    const pts = (fn, a, b) => { const p = []; for (let i = 0; i <= 90; i++) { const n = a + (b - a) * i / 90; p.push(V3(X(n), Y(fn(n)), 0)); } return p; };
    const P = {
      X, Y,
      curve(fn, color, a = 0, b = xmax) {
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(fn, a, b)), 90, 0.045, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
        lab.world.add(m); m.userData.redo = (f2) => { m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(f2, a, b)), 90, 0.045, 6); };
        return m;
      },
      vmark(n, color = '#c08a1f', text) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), new THREE.MeshBasicMaterial({ color })); m.position.set(X(n), y0 + h / 2, 0); lab.world.add(m); const l = text ? tag(text, 'idx', X(n), y0 - 0.45) : null; return { m, l }; },
      zone(a, b, color = '#2fc092') { const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, 0.02), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false })); m.scale.x = Math.max(0.01, X(b) - X(a)); m.position.set((X(a) + X(b)) / 2, y0 + h / 2, -0.05); lab.world.add(m); return m; },
    };
    return P;
  }

  // ───────────────────────── 迴圈計數器（互動） ─────────────────────────
  const LOOPS = {
    inc: { name: 'i++', code: ['for (i = 0; i < n; i++)', '  stmt;'], run: (n) => { const s = []; for (let i = 0; i < n; i++) s.push(i); return s; }, big: 'O(n)', why: 'i 一次加 1，走 n 步' },
    dec: { name: 'i--', code: ['for (i = n; i > 0; i--)', '  stmt;'], run: (n) => { const s = []; for (let i = n; i > 0; i--) s.push(i); return s; }, big: 'O(n)', why: '從 n 走回 1，步數一樣是 n' },
    step2: { name: 'i += 2', code: ['for (i = 0; i < n; i += 2)', '  stmt;'], run: (n) => { const s = []; for (let i = 0; i < n; i += 2) s.push(i); return s; }, big: 'O(n)', why: 'n/2 次，次數仍是 1' },
    dbl: { name: 'i *= 2', code: ['for (i = 1; i < n; i *= 2)', '  stmt;'], run: (n) => { const s = []; for (let i = 1; i < n; i *= 2) s.push(i); return s; }, big: 'O(log n)', why: '2ᵏ ≥ n 時停 → ⌈log₂ n⌉ 次' },
    half: { name: 'i /= 2', code: ['for (i = n; i >= 1; i = i / 2)', '  stmt;'], run: (n) => { const s = []; for (let i = n; i >= 1; i = Math.floor(i / 2)) s.push(i); return s; }, big: 'O(log n)', why: 'n/2ᵏ < 1 時停 → ⌊log₂ n⌋ + 1 次' },
    sq: { name: 'i*i < n', code: ['for (i = 0; i * i < n; i++)', '  stmt;'], run: (n) => { const s = []; for (let i = 0; i * i < n; i++) s.push(i); return s; }, big: 'O(√n)', why: 'i² ≥ n 時停 → ⌈√n⌉ 次' },
    pinc: { name: 'p += i', code: ['for (i = 1, p = 0; p <= n; i++)', '  p = p + i;'], run: (n) => { const s = []; for (let i = 1, p = 0; p <= n; i++) { p += i; s.push(p); } return s; }, big: 'O(√n)', why: 'k(k+1)/2 > n 時停 → k ≈ √(2n)' },
    tri: { name: 'j < i', code: ['for (i = 0; i < n; i++)', '  for (j = 0; j < i; j++)', '    stmt;'], run: (n) => { const s = []; for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) s.push(i); return s; }, big: 'O(n²)', why: '0 + 1 + … + (n−1) = n(n−1)/2' },
    nlog: { name: 'n × log n', code: ['for (i = 0; i < n; i++)', '  for (j = 1; j < n; j *= 2)', '    stmt;'], run: (n) => { const s = []; for (let i = 0; i < n; i++) for (let j = 1; j < n; j *= 2) s.push(i); return s; }, big: 'O(n log n)', why: 'n 次外層 × ⌈log₂ n⌉ 次內層' },
    loglog: { name: 'log log n', code: ['for (p = 0, i = 1; i < n; i *= 2) p++;', 'for (j = 1; j < p; j *= 2)', '  stmt;'], run: (n) => { let p = 0; for (let i = 1; i < n; i *= 2) p++; const s = []; for (let j = 1; j < p; j *= 2) s.push(j); return s; }, big: 'O(log log n)', why: 'p = log n，第二個迴圈 log p 次' },
  };
  const lp = { kind: 'dbl', n: 10, running: false, cubes: [] };
  function enterLoops() {
    fresh([0, 7.5, 13.5], [0, 1.8, 0]);
    lp.cubes = [];
    controls('<select id="lpK">' + Object.keys(LOOPS).map((k) => '<option value="' + k + '">' + LOOPS[k].name + '</option>').join('') + '</select>'
      + '<label>n = <input id="lpN" type="number" min="1" max="64" value="' + lp.n + '"></label><button class="primary" id="lpRun">執行並計數</button>');
    $('lpK').value = lp.kind;
    $('lpK').onchange = (e) => { lp.kind = e.target.value; clearLog(); enterLoops(); };
    $('lpN').onchange = (e) => {
      const v = Number(e.target.value);
      if (!Number.isInteger(v) || v < 1 || v > 64) { log('n 要是 1～64 的整數（太大方塊會擠不下）；已改回 ' + lp.n + '。', true); e.target.value = lp.n; return; }
      lp.n = v; clearLog(); enterLoops();
    };
    on('lpRun', () => runLoops());
    const L = LOOPS[lp.kind];
    lp.panel = code(L.code, -2.8, 6.4, 0.5);
    lp.seq = tag('', 'idx', 0, 4.6);
    log('程式：' + L.code.join(' ⏎ ') + '。按「執行並計數」：每顆方塊 = stmt 執行一次。');
    loopState(0);
  }
  function loopState(k) {
    const L = LOOPS[lp.kind], total = L.run(lp.n).length;
    setState('迴圈計數（n = ' + lp.n + '）', [['迴圈', L.name], ['已執行', String(k)], ['總次數', String(total)], ['參考', 'log₂n = ' + fmt(lg(lp.n)) + '、√n = ' + fmt(Math.sqrt(lp.n))]],
      '<span class="ok">' + L.big + '</span>：' + L.why);
  }
  async function runLoops() {
    if (lp.running) { log('還在跑，等它跑完再按。', true); return; }
    lp.running = true;
    lp.cubes.forEach(kill); lp.cubes = [];
    const L = LOOPS[lp.kind], s = L.run(lp.n), tot = s.length;
    const cols = Math.max(8, Math.ceil(Math.sqrt(tot * 1.6)));
    const sz = Math.min(0.7, 11 / cols);
    const delay = Math.max(15, Math.min(260, 2600 / Math.max(tot, 1)));
    txt(lp.seq, '值：' + s.slice(0, 14).join(', ') + (s.length > 14 ? ', …' : ''));
    if (tot > 300) {
      const b = bar(C.blue, 2, 2, 0, -1.5); lp.cubes.push(b);
      try { for (let t = 1; t <= 20; t++) { setBar(b, 6 * t / 20); loopState(Math.round(tot * t / 20)); await sleep(60); } } finally { lp.running = false; }
      log('n = ' + lp.n + '：stmt 執行 ' + tot + ' 次（太多了，用柱子代替方塊）→ ' + L.big + '（' + L.why + '）');
      return;
    }
    try {
      for (let k = 0; k < tot; k++) {
        const r = Math.floor(k / cols), c = k % cols;
        lp.cubes.push(cube('', C.blue, [sz * 0.85, sz * 0.7, sz * 0.85], (c - (cols - 1) / 2) * sz, sz * 0.35, -1.5 + r * sz, 4));
        loopState(k + 1);
        await sleep(delay);
      }
      log('n = ' + lp.n + '：stmt 執行 ' + tot + ' 次 → ' + L.big + '（' + L.why + '）');
    } finally { lp.running = false; }
  }

  // ───────────────────────── O / Ω / Θ 夾擠（互動） ─────────────────────────
  const GF = { n: { name: 'n', f: (n) => n }, n2: { name: 'n²', f: (n) => n * n }, log: { name: 'log₂ n', f: (n) => Math.log2(Math.max(n, 1)) }, one: { name: '1', f: () => 1 } };
  const bd = { a: 2, b: 3, g: 'n', c1: 1, c2: 5, n0: 1 };
  function enterBounds() {
    fresh([0, 5, 15], [0, 3.8, 0]);
    controls('f(n) = <input id="bdA" type="number" min="1" max="6" value="' + bd.a + '">n + <input id="bdB" type="number" min="0" max="30" value="' + bd.b + '">'
      + ' g(n) = <select id="bdG"><option value="n">n</option><option value="n2">n²</option><option value="log">log n</option><option value="one">1</option></select>'
      + '<label>c₁ <input id="bdC1" type="range" min="0.5" max="8" step="0.5" value="' + bd.c1 + '" style="width:80px"></label>'
      + '<label>c₂ <input id="bdC2" type="range" min="0.5" max="12" step="0.5" value="' + bd.c2 + '" style="width:80px"></label>'
      + '<label>n₀ <input id="bdN" type="range" min="0" max="15" value="' + bd.n0 + '" style="width:80px"></label>');
    $('bdG').value = bd.g;
    const read = () => {
      const a = Number($('bdA').value), b = Number($('bdB').value);
      if (!(a >= 1 && a <= 6) || !(b >= 0 && b <= 30)) { log('a 要在 1～6、b 要在 0～30 之間。', true); $('bdA').value = bd.a; $('bdB').value = bd.b; return; }
      const c1 = Number($('bdC1').value), c2 = Number($('bdC2').value), n0 = Number($('bdN').value);
      if (!(c1 > 0) || !(c2 > 0) || !(n0 >= 0)) { log('c₁、c₂ 要是正數，n₀ ≥ 0。', true); return; }
      Object.assign(bd, { a, b, g: GF[$('bdG').value] ? $('bdG').value : 'n', c1, c2, n0 });
      drawBounds();
    };
    ['bdA', 'bdB', 'bdG'].forEach((id) => { $(id).onchange = read; });
    ['bdC1', 'bdC2', 'bdN'].forEach((id) => { $(id).oninput = read; });
    log('調 c₁、c₂、n₀：要讓 n ≥ n₀ 時 c₁·g(n) ≤ f(n) ≤ c₂·g(n)。紅 = f，綠 = c₂·g（上界），紫 = c₁·g（下界）。');
    drawBounds();
  }
  function drawBounds() {
    lab.clear();
    const f = (n) => bd.a * n + bd.b, g = GF[bd.g].f;
    const P = plot(-6, 0, 11.5, 7.2, 20, 80);
    P.curve(f, C.red); P.curve((n) => bd.c2 * g(n), C.green); P.curve((n) => bd.c1 * g(n), C.purple);
    tag('f(n) = ' + bd.a + 'n + ' + bd.b, 'ptr', P.X(20) - 0.8, Math.min(P.Y(f(20)) + 0.5, 7.6));
    P.vmark(bd.n0, '#c08a1f', 'n₀ = ' + bd.n0);
    // check far beyond the plot as well (asymptotic!)
    let up = true, lo = true;
    for (let n = Math.max(bd.n0, 1e-9); n < 1e7; n = n < 50 ? n + 0.25 : n * 1.05) { const fn = f(n), gn = g(n); if (fn > bd.c2 * gn + 1e-9) up = false; if (fn < bd.c1 * gn - 1e-9) lo = false; }
    P.zone(bd.n0, 20, up && lo ? C.green : up || lo ? C.gold : C.red);
    const gn = GF[bd.g].name;
    const why = [];
    if (!up) why.push(bd.g === 'log' || bd.g === 'one' ? 'f 長得比 ' + gn + ' 快，任何 c₂ 都會被追過' : '上界不成立：加大 c₂ 或把 n₀ 往右');
    if (!lo) why.push(bd.g === 'n2' ? gn + ' 長得比 f 快，任何 c₁ > 0 終究會超過 f' : '下界不成立：調小 c₁ 或 n₀ 往右');
    setState('f(n) = ' + bd.a + 'n + ' + bd.b + ' 與 g(n) = ' + gn, [['f ≤ c₂·g（n ≥ n₀）', up ? '成立 → O(' + gn + ')' : '不成立'], ['f ≥ c₁·g（n ≥ n₀）', lo ? '成立 → Ω(' + gn + ')' : '不成立'], ['Θ(' + gn + ')', up && lo ? '成立' : '不成立']],
      (up && lo ? '<span class="ok">' + bd.c1 + '·' + gn + ' ≤ f(n) ≤ ' + bd.c2 + '·' + gn + '，n ≥ ' + bd.n0 + ' → Θ(' + gn + ')</span>' : '<span class="no">' + why.join('；') + '</span>') + '<br>（檢查一路到 n = 10⁷，漸近是看 n 很大時）');
  }

  // ───────────────────────── 遞迴樹（互動） ─────────────────────────
  const rt = { a: 2, b: 2, k: 1 };
  function enterRTree() {
    fresh([0, 4.8, 16], [0, 3.4, 0]);
    controls('T(n) = <input id="rtA" type="number" min="1" max="4" value="' + rt.a + '">T(n/<input id="rtB" type="number" min="2" max="4" value="' + rt.b + '">) + n^<input id="rtK" type="number" min="0" max="2" value="' + rt.k + '"><button class="primary" id="rtGo">一層一層長出來</button>');
    on('rtGo', () => {
      const a = Number($('rtA').value), b = Number($('rtB').value), k = Number($('rtK').value);
      if (![1, 2, 3, 4].includes(a) || ![2, 3, 4].includes(b) || ![0, 1, 2].includes(k)) { log('a 只能 1～4、b 只能 2～4、k 只能 0～2（整數），畫面才放得下。', true); return; }
      Object.assign(rt, { a, b, k }); growRT();
    });
    log('每個方塊寫的是「這一塊自己要花的工作量」；右邊橫條是每一層的總和。');
    setState('遞迴樹', [['a', String(rt.a)], ['b', String(rt.b)], ['f(n)', 'n^' + rt.k]], '按「一層一層長出來」');
  }
  async function growRT(tok) {
    lab.clear();
    const { a, b, k } = rt, L = b === 2 ? 4 : b === 3 ? 3 : 2, n = Math.pow(b, L);
    const costs = [];
    for (let d = 0; d <= L; d++) costs.push(Math.pow(a, d) * Math.pow(n / Math.pow(b, d), k));
    const maxC = Math.max(...costs);
    let total = 0; const rows = [];
    for (let d = 0; d <= L; d++) {
      const cnt = Math.pow(a, d), size = n / Math.pow(b, d), each = Math.pow(size, k), y = 6.6 - d * 1.45, shown = Math.min(cnt, 16);
      for (let i = 0; i < shown; i++) {
        const x = shown === 1 ? -2 : -6.3 + (i + 0.5) * 8.6 / shown;
        cube(shown <= 8 ? fmt(each) : '', d === L ? C.purple : C.blue, [Math.min(1.2, 7.6 / shown), 0.42, 0.6], x, y, 0, 2.5);
      }
      if (cnt > shown) tag('…共 ' + cnt + ' 塊', 'idx', -2, y - 0.5);
      total += costs[d];
      const hb = lab.box(d === L ? C.purple : C.orange, [1, 0.42, 0.6]); hb.scale.x = 0.05 + 3.2 * costs[d] / maxC; hb.position.set(3.4 + hb.scale.x / 2, y, 0); lab.world.add(hb);
      tag('第 ' + d + ' 層 ' + fmt(costs[d]), d === L ? 'ptr alt' : 'ptr', 5.6, y + 0.45);
      rows.push(['第 ' + d + ' 層', cnt + ' × ' + fmt(each) + ' = ' + fmt(costs[d])]);
      setState('T(n) = ' + a + 'T(n/' + b + ') + n^' + k + '（n = ' + n + '）', rows, '目前總和 ' + fmt(total));
      if (tok !== undefined) await beat(tok, 1100); else await sleep(600);
    }
    const r = masterDiv(a, b, k);
    const trend = Math.abs(costs[1] - costs[0]) < 1e-9 ? '每層一樣 → 乘上層數 log n' : costs[1] > costs[0] ? '越往下越大 → 葉子主導' : '越往下越小 → 根主導';
    setState('T(n) = ' + a + 'T(n/' + b + ') + n^' + k + '（n = ' + n + '）', rows, '總和 ' + fmt(total) + '<br><span class="ok">' + trend + ' → ' + r.ans + '</span>');
    log(trend + ' → ' + r.ans);
  }

  // ───────────────────────── Master Theorem（互動：dividing / decreasing） ─────────────────────────
  const powN = (e) => e === 0 ? '1' : e === 1 ? 'n' : 'n^' + e;
  function masterDiv(a, b, k) {
    const e = Math.log(a) / Math.log(b), E = +e.toFixed(3);
    if (Math.abs(e - k) < 1e-9) return { c: 2, e: E, ans: k === 0 ? 'Θ(log n)' : 'Θ(' + powN(k) + ' log n)', why: 'n^(log_b a) = n^k：每層一樣多' };
    if (e > k) return { c: 1, e: E, ans: 'Θ(' + powN(E) + ')', why: 'log_b a = ' + E + ' > k：葉子主導' };
    return { c: 3, e: E, ans: 'Θ(' + powN(k) + ')', why: 'k > log_b a：根主導（regularity a(n/b)^k ≤ c·n^k 成立）' };
  }
  function masterDec(a, b, k) {
    const nk = powN(k);
    if (a < 1) return { c: 1, ans: 'O(' + nk + ')', why: 'a < 1：就是 O(f(n))' };
    if (a === 1) return { c: 2, ans: 'O(' + powN(k + 1) + ')', why: 'a = 1：f(n) 乘上 n' };
    const pw = b === 1 ? 'n' : 'n/' + b;
    return { c: 3, ans: 'O(' + (k === 0 ? '' : nk + '·') + a + '^(' + pw + '))', why: 'a > 1：f(n) 乘上 a^(n/b)' };
  }
  const ms = { form: 'div', a: 2, b: 2, k: 1, bars: [] };
  function enterMaster() {
    fresh([0, 4.5, 14.5], [0, 3, 0]);
    controls('<select id="msF"><option value="div">T(n) = aT(n/b) + n^k</option><option value="dec">T(n) = aT(n−b) + n^k</option></select>'
      + ' a <input id="msA" type="number" min="0.5" max="9" step="0.5" value="' + ms.a + '"> b <input id="msB" type="number" min="1" max="4" value="' + ms.b + '"> k <input id="msK" type="number" min="0" max="3" value="' + ms.k + '"><button class="primary" id="msGo">判定</button>');
    $('msF').value = ms.form;
    on('msGo', () => {
      const f = $('msF').value, a = Number($('msA').value), b = Number($('msB').value), k = Number($('msK').value);
      if (!(a > 0) || !(k >= 0) || !Number.isInteger(k)) { log('a 要 > 0，k 要是 ≥ 0 的整數。', true); return; }
      if (f === 'div' && (a < 1 || !(b >= 2) || !Number.isInteger(b))) { log('Dividing 型要 a ≥ 1、b ≥ 2 的整數：每次至少切成一個子問題，規模要變小。', true); return; }
      if (f === 'dec' && (!(b >= 1) || !Number.isInteger(b))) { log('Decreasing 型的 b 是每次減掉的量，要是 ≥ 1 的整數。', true); return; }
      Object.assign(ms, { form: f, a, b, k }); drawMaster();
    });
    log('Dividing：比較 n^(log_b a)（葉子）與 n^k（每層額外工作）。Decreasing：看 a 小於、等於、大於 1。');
    drawMaster();
  }
  function drawMaster() {
    lab.clear();
    const { form, a, b, k } = ms, L = 6;
    const costs = [];
    for (let d = 0; d <= L; d++) {
      if (form === 'div') costs.push(Math.pow(a, d) * Math.pow(Math.pow(b, L - d), k));
      else costs.push(Math.pow(a, d) * Math.pow(Math.max(1, (L - d) * b), k));
    }
    const mx = Math.max(...costs);
    costs.forEach((c, d) => {
      const m = bar(d === L ? C.purple : C.blue, 1.2, 1.2, -5.4 + d * 1.6, 0); setBar(m, 0.1 + 5.5 * c / mx);
      tag('第 ' + d + ' 層', 'idx', -5.4 + d * 1.6, 0, 1.1);
    });
    const r = form === 'div' ? masterDiv(a, b, k) : masterDec(a, b, k);
    tag('每一層的總工作量（相對高度）', 'ptr', 0, 6.6);
    tag((form === 'div' ? 'T(n) = ' + a + 'T(n/' + b + ') + n^' + k : 'T(n) = ' + a + 'T(n−' + b + ') + n^' + k) + ' → ' + r.ans, 'ptr alt', 0, 7.3);
    setState('Master Theorem（' + (form === 'div' ? 'dividing' : 'decreasing') + '）', form === 'div'
      ? [['a, b, k', a + ', ' + b + ', ' + k], ['log_b a', String(r.e)], ['情況', 'case ' + r.c]]
      : [['a, b, k', a + ', ' + b + ', ' + k], ['情況', r.c === 1 ? 'a < 1' : r.c === 2 ? 'a = 1' : 'a > 1']], '<span class="ok">' + r.ans + '</span><br>' + r.why);
    log((form === 'div' ? 'T(n) = ' + a + 'T(n/' + b + ') + n^' + k : 'T(n) = ' + a + 'T(n−' + b + ') + n^' + k) + ' → ' + r.ans + '：' + r.why);
  }

  // ───────────────────────── 攤銷分析（互動：table doubling、binary counter） ─────────────────────────
  const am = { kind: 'table', policy: 'quarter', m: 4, n: 0, ops: 0, total: 0, hist: [], bits: [], cnt: 0 };
  const POL = { plus1: '滿了 m+1（錯誤示範）', double: '滿了 ×2，不縮', half: '×2；n = m/2 就縮半（會抖動）', quarter: '×2；n = m/4 才縮半（MIT 做法）' };
  function enterAmort() {
    fresh([0, 6.5, 14], [0, 1.8, 0]);
    Object.assign(am, { m: 4, n: 0, ops: 0, total: 0, hist: [], cnt: 0 });
    controls('<select id="amK"><option value="table">Table doubling</option><option value="counter">Binary counter</option></select>'
      + (am.kind === 'table' ? '<select id="amP">' + Object.keys(POL).map((k) => '<option value="' + k + '">' + POL[k] + '</option>').join('') + '</select><button class="primary" id="amIns">插入</button><button id="amDel">刪除</button><button id="amIns8">連續插入 8 次</button>'
        : '<button class="primary" id="amInc">INCREMENT</button><button id="amInc8">連按 8 次</button>') + '<button id="amReset">重來</button>');
    $('amK').value = am.kind;
    $('amK').onchange = (e) => { am.kind = e.target.value; clearLog(); enterAmort(); };
    on('amReset', () => { clearLog(); enterAmort(); });
    if (am.kind === 'table') {
      $('amP').value = am.policy;
      $('amP').onchange = (e) => { am.policy = e.target.value; clearLog(); enterAmort(); };
      on('amIns', () => tableOp(+1)); on('amDel', () => tableOp(-1));
      on('amIns8', async () => { for (let i = 0; i < 8; i++) { tableOp(+1); await sleep(140); } });
      log('每次插入成本 1；擴大或縮小時要把 n 個 item 全部 rehash 到新 table，成本 n。');
    } else {
      am.bits = []; for (let i = 0; i < 8; i++) am.bits.push({ v: 0, m: cube('0', GRAY, [0.9, 0.9, 0.9], 3.15 - i * 0.9, 3.2, 0) });
      for (let i = 0; i < 8; i++) tag('A[' + i + ']', 'idx', 3.15 - i * 0.9, 2.5);
      on('amInc', () => counterInc()); on('amInc8', async () => { for (let i = 0; i < 8; i++) { counterInc(); await sleep(160); } });
      log('INCREMENT：從 A[0] 開始把連續的 1 翻成 0，再把第一個 0 翻成 1；成本 = 翻轉的位元數。');
    }
    drawAmort();
  }
  function tableOp(dir) {
    if (dir < 0 && am.n === 0) { log('table 是空的，沒有東西可以刪。', true); return; }
    if (am.m >= 64 && dir > 0 && am.n >= am.m) { log('畫面只放得下 64 格，先刪一些或按重來。', true); return; }
    let cost = 1, note = '';
    am.n += dir;
    if (dir > 0 && am.n > am.m) { cost += am.n - 1; const m0 = am.m; am.m = am.policy === 'plus1' ? am.m + 1 : am.m * 2; note = '擴大 ' + m0 + ' → ' + am.m + '，rehash ' + (am.n - 1) + ' 個'; }
    if (dir < 0 && ((am.policy === 'half' && am.n <= am.m / 2 && am.m > 4) || (am.policy === 'quarter' && am.n <= am.m / 4 && am.m > 4))) { const m0 = am.m; am.m /= 2; cost += am.n; note = '縮小 ' + m0 + ' → ' + am.m + '，rehash ' + am.n + ' 個'; }
    am.ops++; am.total += cost; am.hist.push(cost); if (am.hist.length > 32) am.hist.shift();
    log((dir > 0 ? '插入' : '刪除') + '：成本 ' + cost + (note ? '（' + note + '）' : ''), cost > 8);
    drawAmort();
  }
  function counterInc() {
    let i = 0, flips = 0;
    while (i < 8 && am.bits[i].v === 1) { am.bits[i].v = 0; relabel(am.bits[i].m, 0); tint(am.bits[i].m, GRAY); i++; flips++; }
    if (i < 8) { am.bits[i].v = 1; relabel(am.bits[i].m, 1); tint(am.bits[i].m, C.green); flips++; }
    am.cnt++; am.ops++; am.total += flips; am.hist.push(flips); if (am.hist.length > 32) am.hist.shift();
    log('第 ' + am.cnt + ' 次 INCREMENT：翻了 ' + flips + ' 個位元');
    drawAmort();
  }
  function drawAmort() {
    for (const o of [...lab.world.children]) if (o.userData.amTmp) kill(o);
    const add = (o) => { o.userData.amTmp = true; return o; };
    if (am.kind === 'table') {
      for (let s = 0; s < am.m; s++) {
        const r = Math.floor(s / 16), c = s % 16;
        const t = add(lab.box(s < am.n ? C.blue : '#efe6d2', [0.36, s < am.n ? 0.36 : 0.06, 0.36]));
        t.position.set(-5.6 + c * 0.42, s < am.n ? 0.18 : 0.03, 2.2 + r * 0.42); lab.world.add(t);
      }
      add(tag('m = ' + am.m + '、n = ' + am.n, 'ptr alt', 3.6, 0.4, 2.4));
    }
    am.hist.forEach((c, i) => { const m = add(lab.box(c > 1 ? C.red : C.green, [0.3, 1, 0.3])); setBar(m, 0.06 + Math.min(c, 40) * 0.13); m.position.x = -6 + i * 0.38; m.position.z = -1.2; lab.world.add(m); });
    add(tag('最近每次操作的成本', 'idx', -0.2, 0, -2));
    const amz = am.ops ? am.total / am.ops : 0;
    if (am.kind === 'table') setState('Table doubling：' + POL[am.policy], [['操作次數', String(am.ops)], ['總成本', String(am.total)], ['平均（攤銷）', fmt(amz)], ['load n/m', am.m ? fmt(am.n / am.m) : '0']],
      am.policy === 'plus1' ? '<span class="no">每次都要重建 → 總成本 Θ(n²)</span>' : am.policy === 'half' ? '在 m/2 附近來回插刪會 <span class="no">一直抖動</span>，每次 Θ(n)' : '<span class="ok">任意 k 次操作總成本 O(k) → amortized O(1)</span>');
    else setState('Binary counter（8 bits）', [['計數值', String(am.cnt)], ['總翻轉', String(am.total)], ['2n 上界', String(2 * am.cnt)], ['平均', fmt(amz)]],
      'A[i] 每 2ⁱ 次才翻一次：總翻轉 &lt; n·(1 + 1/2 + 1/4 + …) = 2n<br><span class="ok">aggregate 分析：每次 amortized O(1)</span>');
  }

  // ───────────────────────── 文字頁：小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function uniq4(ans, pool) { const s = [ans]; for (const p of pool) if (!s.includes(p) && s.length < 4) s.push(p); const extra = ['以上皆非', '無法判斷', '視輸入而定']; while (s.length < 4) s.push(extra.shift()); return s; }
  function genQ() {
    const t = Math.random();
    if (t < 0.18) {
      const k = pick(Object.keys(LOOPS)), L = LOOPS[k];
      return { q: '這段程式 stmt 執行次數的漸近複雜度？\n' + L.code.join('\n'), opts: uniq4(L.big, ['O(n)', 'O(log n)', 'O(√n)', 'O(n²)', 'O(n log n)', 'O(log log n)']), ans: L.big, why: L.why };
    }
    if (t < 0.3) {
      const n = ri(5, 100), cnt = LOOPS.dbl.run(n).length;
      return { q: 'for (i = 1; i < n; i = i * 2) stmt;  當 n = ' + n + ' 時 stmt 執行幾次？', opts: uniq4(String(cnt), [String(Math.floor(lg(n))), String(cnt + 1), String(Math.round(n / 2)), String(cnt - 1)]), ans: String(cnt), why: 'i = 1, 2, 4, …；2ᵏ ≥ ' + n + ' 時停 → ⌈log₂ ' + n + '⌉ = ' + cnt + ' 次。' };
    }
    if (t < 0.4) {
      const n = ri(10, 80), cnt = LOOPS.pinc.run(n).length;
      return { q: 'for (i = 1, p = 0; p <= n; i++) p = p + i;  當 n = ' + n + ' 時迴圈本體執行幾次？', opts: uniq4(String(cnt), [String(Math.round(Math.sqrt(n))), String(cnt + 1), String(n), String(cnt - 1)]), ans: String(cnt), why: '執行 k 次後 p = k(k+1)/2；最小的 k 使 k(k+1)/2 > ' + n + ' 是 ' + cnt + '（約 √(2n)）。' };
    }
    if (t < 0.58) {
      const presets = [[2, 2, 1], [4, 2, 1], [1, 2, 0], [8, 2, 2], [9, 3, 1], [3, 2, 2], [7, 2, 2], [2, 2, 2], [4, 2, 2], [3, 4, 1], [16, 4, 2], [1, 3, 1]];
      const [a, b, k] = pick(presets), r = masterDiv(a, b, k);
      return { q: 'T(n) = ' + (a === 1 ? '' : a) + 'T(n/' + b + ') + ' + (k === 0 ? '1' : k === 1 ? 'n' : 'n^' + k) + '，用 Master Theorem：', opts: uniq4(r.ans, ['Θ(' + powN(k) + ')', 'Θ(' + powN(k) + ' log n)', 'Θ(' + powN(r.e) + ')', 'Θ(n log n)', 'Θ(log n)', 'Θ(n)', 'Θ(n²)']), ans: r.ans, why: 'log_' + b + ' ' + a + ' = ' + r.e + '，和 k = ' + k + ' 比 → case ' + r.c + '：' + r.why };
    }
    if (t < 0.68) {
      const [a, b, k] = pick([[1, 1, 0], [1, 1, 1], [2, 1, 0], [2, 1, 1], [3, 1, 0], [1, 1, 2], [2, 2, 0], [0.5, 1, 1]]), r = masterDec(a, b, k);
      return { q: 'T(n) = ' + (a === 1 ? '' : a) + 'T(n−' + b + ') + ' + (k === 0 ? '1' : k === 1 ? 'n' : 'n^' + k) + ' 的解？', opts: uniq4(r.ans, ['O(n)', 'O(n^2)', 'O(2^(n))', 'O(n·2^(n))', 'O(n^3)', 'O(2^(n/2))', 'O(1)']), ans: r.ans, why: r.why };
    }
    if (t < 0.8) {
      const all = ['1', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', 'n!'];
      const idx = []; while (idx.length < 4) { const i = ri(0, all.length - 1); if (!idx.includes(i)) idx.push(i); }
      const big = Math.random() < 0.5, want = big ? Math.max(...idx) : Math.min(...idx);
      return { q: '下列哪一個成長得' + (big ? '最快' : '最慢') + '？', opts: idx.map((i) => all[i]), ans: all[want], why: '1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n!' };
    }
    if (t < 0.9) {
      const a = ri(2, 6), b = ri(1, 9);
      const S = [['f(n) = O(n²)', true], ['f(n) = Ω(log n)', true], ['f(n) = Θ(n)', true], ['f(n) = O(log n)', false], ['f(n) = Ω(n²)', false], ['f(n) = Θ(n²)', false]];
      const wrong = pick(S.filter((s) => !s[1]))[0], rights = S.filter((s) => s[1]).map((s) => s[0]);
      return { q: 'f(n) = ' + a + 'n + ' + b + '，下列哪一個敘述是錯的？', opts: [wrong, ...rights], ans: wrong, why: a + 'n + ' + b + ' 屬於 n 這一類：上界可以是 n、n²…，下界可以是 n、log n…，Θ 只能是 n。' };
    }
    const n = pick([16, 32, 64, 128]);
    return { q: 'Table doubling 從 m = 1 開始，連續插入 ' + n + ' 個（每次插入成本 1，擴大時 rehash 全部），總成本最接近？', opts: [String(n + n - 1), String(n * n / 2), String(n * lg(n)), String(n)], ans: String(n + n - 1), why: '重建成本 1 + 2 + 4 + … + ' + n / 2 + ' = ' + (n - 1) + '，加上 ' + n + ' 次插入 → ' + (2 * n - 1) + ' < 3n，攤銷 O(1)。' };
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
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 跟著影片的場景 ═════════════════════════

  // ─── FbYzBWdhMb0：演算法的五個特性（用做菜程序類比） ───
  async function scRecipe(tok) {
    fresh([0, 6, 13.5], [0, 1.8, 0]);
    const pot = cube('', '#6e5f49', [2.2, 1.2, 2.2], 0, 0.6, 0);
    tag('procedure', 'ptr', 0, 1.6);
    const cap = tag('', 'ptr alt', 0, 6.4);
    txt(cap, 'Input：0 個或多個'); say('Input：可以有 0 個或多個輸入', '食材、藥品、儀器 → 都是 input');
    const ing = [];
    for (let i = 0; i < 3; i++) { ing.push(cube(['米', '水', '鹽'][i], [C.gold, C.teal, '#efe6d2'][i], [0.8, 0.6, 0.8], -4 + i * 1.1, 0.3, 2, 3)); await beat(tok, 500); }
    await beat(tok, 600);
    for (const m of ing) { move(m, 0, 1.6, 0); await beat(tok, 350); }
    ing.forEach(kill);
    txt(cap, 'Output：至少 1 個'); say('Output：至少要產生一個結果', '像 C 函數：沒參數可以，但一定做出某件事');
    const dish = cube('output', C.green, [1.4, 0.5, 1.4], 0, 1.4, 0); move(dish, 4.2, 0.25, 1.5);
    await beat(tok, 2400);
    txt(cap, 'Definiteness：每一步只有一種意義'); say('Definiteness：敘述要清楚、意義唯一', '');
    const s1 = cube('加 2 匙鹽', C.green, [2.2, 0.5, 0.9], -4.4, 0.25, -1.5, 3); await beat(tok, 900);
    const s2 = cube('加 √−1 匙糖', C.red, [2.4, 0.5, 0.9], -4.4, 0.85, -1.5, 3); await beat(tok, 900);
    say('√−1 不是實數：人都解不出來的步驟，不能要電腦做', 'Definiteness 不成立 → 刪掉');
    await beat(tok, 1600); fly(s2, V3(-3, 7, 3)); await beat(tok, 800); kill(s1);
    txt(cap, 'Finiteness：一定會停'); say('Finiteness：有限步驟後一定停', '左：做菜（procedure）右：資料庫 server（service）');
    tag('做菜：procedure', 'idx', -4.2, 0, 3.2); tag('Web / DB server：service', 'idx', 4.2, 0, -2.6);
    const sv = [];
    for (let t = 0; t < 10; t++) {
      if (t < 5) cube('', C.blue, [1.4, 0.35, 1], -4.2, 0.18 + t * 0.4, 2.3, 3);
      if (t === 5) tag('完成 ✓', 'ptr alt', -4.2, 2.6, 2.3);
      sv.push(cube('', C.orange, [1.4, 0.35, 1], 4.2, 0.18 + sv.length * 0.4, -1.8, 3));
      if (sv.length > 5) { fly(sv.shift(), V3(2, 6, 2)); sv.forEach((m, q) => move(m, 4.2, 0.18 + q * 0.4, -1.8)); }
      await beat(tok, 380);
    }
    say('一直跑到被關掉的 server 是 service，不是演算法', '演算法必須終止');
    await beat(tok, 2200);
    txt(cap, 'Effectiveness：不做多餘的事'); say('Effectiveness：每一步都要有用途', '');
    const veg = cube('切好的紅蘿蔔', C.orange, [2.4, 0.5, 1], -2.2, 0.25, 2.8, 3);
    await beat(tok, 1300);
    say('切了卻沒放進菜裡 → 多餘的步驟', '演算法裡不要有不必要的敘述');
    glow(veg, RED); await beat(tok, 1200); fly(veg, V3(-2, 7, 4));
    await beat(tok, 1200);
    say('五個特性缺一不可', 'Input ≥ 0、Output ≥ 1、Definiteness、Finiteness、Effectiveness');
    await beat(tok, 3000);
  }

  // ─── 0IAPZzGSbME：Algorithm vs Program ───
  async function scAlgoVsProgram(tok) {
    fresh([0, 6, 14], [0, 2.8, 0]);
    tag('Algorithm', 'ptr', -3.2, 7.2); tag('Program', 'ptr alt', 3.2, 7.2);
    const arrow = lab.box(C.sand, [8, 0.1, 0.1]); arrow.position.set(0, 6.6, 0); lab.world.add(arrow);
    tag('design →', 'idx', -3.2, 6.25); tag('→ implementation', 'idx', 3.2, 6.25);
    say('Algorithm：解決計算問題的 step-by-step procedure', 'Program 也是步驟——差在哪？');
    await beat(tok, 2600);
    const R = [['Design 階段', 'Implementation 階段', '先設計、再實作；不能用試錯法蓋東西'], ['有 domain knowledge 的人', 'Programmer', '會計系統找會計、醫院系統找醫護行政'], ['任何語言、數學符號', 'C / C++ / Java / Python', '團隊看得懂就好 vs 一定要合語法'], ['與 HW / OS 無關', '依賴 HW / OS', 'Linux 還是 Windows？演算法不在乎'], ['Analyze（分析）', 'Test（測試）', '分析時間空間 vs 直接執行看結果']];
    for (let r = 0; r < R.length; r++) {
      const y = 5.3 - r * 1.1;
      cube(R[r][0], C.blue, [4.6, 0.7, 1], -3.2, y, 0, 3);
      await beat(tok, 500);
      cube(R[r][1], C.orange, [4.6, 0.7, 1], 3.2, y, 0, 3);
      say(R[r][0] + ' vs ' + R[r][1], R[r][2]);
      await beat(tok, 2300);
    }
    say('演算法寫在設計時期，程式寫在實作時期', '本課程用類似 C 的語法寫演算法');
    await beat(tok, 3000);
  }

  // ─── -JTq1BFBwmo：Priori analysis vs Posteriori testing ───
  async function scPriori(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    tag('Priori analysis（對演算法）', 'ptr', -3.6, 6.8); tag('Posteriori testing（對程式）', 'ptr alt', 3.6, 6.8);
    const alg = cube('Algorithm', C.blue, [2.4, 0.8, 1.2], -3.6, 5, 0, 3);
    say('Priori：研究演算法怎麼運作，得到時間與空間', '與語言、硬體無關');
    await beat(tok, 1800);
    move(alg, -3.6, 3.2, 0); await beat(tok, 700);
    cube('f(n) = 2n + 3', C.green, [2.6, 0.6, 1.2], -3.6, 1.8, 0, 3); await beat(tok, 700);
    cube('S(n) = n + 3', C.green, [2.6, 0.6, 1.2], -3.6, 0.9, 0, 3);
    say('結果是 time function 與 space function', '不是幾秒、幾毫秒');
    await beat(tok, 2600);
    const pc1 = cube('Linux PC', '#6e5f49', [2.2, 1, 1.4], 2.2, 0.5, 0, 3), pc2 = cube('Windows PC', '#6e5f49', [2.2, 1, 1.4], 5, 0.5, 0, 3);
    say('Posteriori：把程式實際跑起來量', '語言、硬體、OS、環境都會影響');
    await beat(tok, 1500);
    const t1 = tag('', 'ptr alt', 2.2, 2), t2 = tag('', 'ptr alt', 5, 2);
    for (let i = 1; i <= 10; i++) { txt(t1, (0.32 * i).toFixed(1) + ' ms'); txt(t2, (0.51 * i).toFixed(1) + ' ms'); await beat(tok, 160); }
    tag('4 096 bytes', 'idx', 2.2, 2.7); tag('5 120 bytes', 'idx', 5, 2.7);
    glow(pc1, GOLD); glow(pc2, GOLD);
    say('同一個程式，換台機器時間就不同', '測試得到的是牆鐘時間與 bytes');
    await beat(tok, 2600);
    say('考試要的「複雜度」是 priori analysis 的函數', 'f(n)、S(n) → 再寫成 O(n)');
    await beat(tok, 3000);
  }

  // ─── 1U3Uwct45IY：Frequency count：陣列求和 ───
  const SUMA = [8, 3, 9, 7, 2];
  async function scFreqSum(tok) {
    fresh([0, 6, 14], [0, 2.6, 0]);
    const cd = code(['Algorithm Sum(A, n)', '{', '  s = 0;', '  for (i = 0; i < n; i++)', '    s = s + A[i];', '  return s;', '}'], -3.4, 6.8, 0.5);
    const fq = [null, null, tag('', 'ptr alt', -0.2, 5.8), tag('', 'ptr alt', -0.2, 5.3), tag('', 'ptr alt', -0.2, 4.8), tag('', 'ptr alt', -0.2, 4.3)];
    const xs = (k) => -5 + k * 1.2;
    const cs = SUMA.map((v, k) => { tag('A[' + k + ']', 'idx', xs(k), 0, 0.95); return cube(v, C.blue, [1, 0.7, 1], xs(k), 0.35, 0); });
    const ip = tag('i', 'ptr', xs(0), 1.5);
    const stk = { 3: [], 4: [] };
    const sx = { 3: 3.2, 4: 4.6 };
    tag('條件檢查', 'idx', 3.2, 0, 1.2); tag('迴圈本體', 'idx', 4.6, 0, 1.2);
    const push = (ln, col) => { stk[ln].push(cube('', col, [1, 0.32, 1], sx[ln], 0.17 + stk[ln].length * 0.36, 0, 2.5)); };
    say('n = 5：每個敘述執行一次算 1 單位', 'frequency count method');
    await beat(tok, 2200);
    cd.hl(2); txt(fq[2], '1'); say('s = 0：1 次', ''); await beat(tok, 1200);
    let s = 0;
    for (let i = 0; i <= 5; i++) {
      cd.hl(3); move(ip, i < 5 ? xs(i) : xs(5), 1.5, 0); push(3, i < 5 ? C.purple : C.red);
      txt(fq[3], String(stk[3].length));
      say(i < 5 ? 'i = ' + i + '：' + i + ' < 5 成立' : 'i = 5：5 < 5 不成立 → 離開迴圈', '條件已檢查 ' + stk[3].length + ' 次');
      await beat(tok, 750);
      if (i < 5) {
        cd.hl(4); s += SUMA[i]; glow(cs[i], GOLD); push(4, C.blue); txt(fq[4], String(stk[4].length));
        say('s = s + A[' + i + '] = ' + s, '本體已執行 ' + stk[4].length + ' 次');
        await beat(tok, 650); glow(cs[i], null);
      }
    }
    cd.hl(5); txt(fq[5], '1'); say('return s：1 次', 's = 29');
    await beat(tok, 1200);
    txt(fq[3], 'n + 1'); txt(fq[4], 'n'); cd.hl(-1);
    say('條件 6 次 = n + 1：成立 5 次、不成立 1 次', 'i = 0 和 i++ 也算的話更多，但習慣只寫 n + 1');
    await beat(tok, 2800);
    say('f(n) = 1 + (n + 1) + n + 1 = 2n + 3', '多項式次數 1 → O(n)');
    await beat(tok, 2600);
    say('空間：A 佔 n 個 word，n、s、i 各 1 個', 'S(n) = n + 3 → O(n)');
    cs.forEach((m) => glow(m, GOLD));
    ['n', 's', 'i'].forEach((v, k) => cube(v, C.teal, [0.8, 0.6, 0.8], 2.6 + k * 1, 0.3, 2.4, 3));
    await beat(tok, 3200);
  }

  // ─── 1U3Uwct45IY：矩陣相加與相乘的 frequency count ───
  async function scFreqMatrix(tok) {
    const only = (ctx.params || {}).kind;
    const runOne = async (mul) => {
      fresh([0, 6.5, 14], [0, 2.4, 0]);
      const lines = mul
        ? ['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++) {', '    C[i][j] = 0;', '    for (k = 0; k < n; k++)', '      C[i][j] += A[i][k] * B[k][j];', '  }']
        : ['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    C[i][j] = A[i][j] + B[i][j];'];
      const freq = mul ? ['n + 1', 'n(n + 1)', 'n²', 'n²(n + 1)', 'n³', ''] : ['n + 1', 'n(n + 1)', 'n²'];
      const cd = code(lines, -2.8, 6.8, 0.48);
      const fl = lines.map((_, i) => tag('', 'ptr alt', 2.6, 6.8 - i * 0.48));
      const n = 3, cell = (i, j) => [-1.2 + j * 1.2, (i - 1) * 1.2];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = cell(i, j); ctx.tile(V3(x, 0.04, z), 1, 1); }
      tag('C（n = 3）', 'ptr', -3.4, 0.2, 0);
      say(mul ? '兩個 n×n 矩陣相乘：三層迴圈' : '兩個 n×n 矩陣相加：兩層迴圈', 'n = 3：一顆方塊 = 最內層敘述執行一次');
      await beat(tok, 2200);
      let cnt = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const [x, z] = cell(i, j);
        if (!mul) { cd.hl(2); cube('', C.green, [0.8, 0.35, 0.8], x, 0.25, z, 3); cnt++; await beat(tok, 260); }
        else for (let k = 0; k < n; k++) { cd.hl(4); cube('', C.purple, [0.8, 0.3, 0.8], x, 0.23 + k * 0.34, z, 3); cnt++; await beat(tok, 120); }
      }
      cd.hl(-1);
      say('最內層敘述共 ' + cnt + ' 次 = n' + (mul ? '³' : '²'), '');
      await beat(tok, 1500);
      for (let i = 0; i < lines.length; i++) { if (!freq[i]) continue; cd.hl(i); txt(fl[i], freq[i]); await beat(tok, 900); }
      cd.hl(-1);
      say(mul ? 'f(n) = 2n³ + 3n² + 2n + 1 → O(n³)' : 'f(n) = 2n² + 2n + 1 → O(n²)', mul ? '空間 S(n) = 3n² + 4 → O(n²)' : '空間 S(n) = 3n² + 3 → O(n²)');
      await beat(tok, 3400);
    };
    if (only !== 'mul') await runOne(false);
    await runOne(true);
    say('時間 O(n³)，空間仍是 O(n²)', '時間與空間要分開分析');
    await beat(tok, 2600);
  }

  // ─── 9TlHvipP5yA：i++、i--、i += 2、i += 20 都是 O(n) ───
  async function scLoopVariants(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const n = 40;
    const L = [['i++', n, C.blue], ['i--', n, C.purple], ['i += 2', n / 2, C.green], ['i += 20', n / 20, C.orange]];
    const focus = (ctx.params || {}).focus;
    if (focus !== 'nested') {
      say('n = 40：四種單層迴圈各執行幾次？', '一顆方塊 = stmt 一次');
      L.forEach(([nm], r) => tag(nm, 'ptr', -6.2, 0.2, -2.4 + r * 1.6));
      await beat(tok, 1800);
      for (let r = 0; r < 4; r++) {
        const [nm, c, col] = L[r];
        for (let k = 0; k < c; k++) { cube('', col, [0.24, 0.3, 0.6], -5.2 + k * 0.28, 0.15, -2.4 + r * 1.6, 2); if (k % 4 === 3) await beat(tok, 40); }
        tag(c + ' 次', 'ptr alt', 6.4, 0.3, -2.4 + r * 1.6);
        say(nm + '：' + c + ' 次', r === 1 ? '1 → 10 和 10 → 1 步數一樣' : r >= 2 ? 'n/' + (r === 2 ? 2 : 20) + '：次數仍是 1' : '');
        await beat(tok, 1200);
      }
      say('四種都是 O(n)', 'n、n/2、n/20 都是 n 的一次式');
      await beat(tok, 2800);
      fresh([0, 7, 12], [0, 1, 0]);
    }
    const m = 6;
    say('巢狀：外層 n 次，每次內層 n 次', 'n = 6');
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { cube('', C.blue, [0.7, 0.4, 0.7], -2.5 + j * 1, 0.2, -2.5 + i * 1, 3); await beat(tok, 70); }
    say('6 × 6 = 36 = n² → O(n²)', '');
    await beat(tok, 3000);
  }

  // ─── 9TlHvipP5yA：j < i 的三角形 ───
  async function scTriangle(tok) {
    fresh([0, 6.5, 13], [0, 1.8, 0]);
    const n = 6;
    code(['for (i = 0; i < n; i++)', '  for (j = 0; j < i; j++)', '    stmt;'], -3.5, 6.6, 0.5);
    const tot = tag('累計 0 次', 'ptr alt', 3.6, 6.2);
    say('內層 j < i：和 n × n 不一樣', '用追蹤表算每個 i 跑幾次（n = 6）');
    await beat(tok, 2200);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      tag('i = ' + i, 'ptr', -5.6, 0.2, -2.5 + i * 0.9);
      for (let j = 0; j < i; j++) { cube('j=' + j, C.blue, [0.85, 0.35, 0.7], -4.2 + j * 0.95, 0.18, -2.5 + i * 0.9, 3); sum++; txt(tot, '累計 ' + sum + ' 次'); await beat(tok, 200); }
      tag(i + ' 次', 'idx', 1.4, 0.2, -2.5 + i * 0.9);
      say('i = ' + i + '：j = ' + (i === 0 ? '（無）' : Array.from({ length: i }, (_, q) => q).join(', ')) + ' → ' + i + ' 次', '0 + 1 + … + ' + i + ' = ' + sum);
      await beat(tok, 1000);
    }
    say('0 + 1 + … + (n−1) = n(n−1)/2 = 15', '影片近似成 1 + 2 + … + n = n(n+1)/2');
    await beat(tok, 2800);
    say('(n² + n)/2 的次數是 2 → O(n²)', '只有一半，但同階');
    await beat(tok, 2800);
  }

  // ─── 9TlHvipP5yA：p += i，k 次後 p = k(k+1)/2 > n ───
  async function scPPlusI(tok) {
    fresh([0, 5, 14], [0, 3.6, 0]);
    const n = 25, SY = 0.22;
    code(['for (i = 1, p = 0; p <= n; i++)', '  p = p + i;'], -2.6, 7.6, 0.5);
    const wall = lab.box(C.red, [11, 0.05, 0.05]); wall.position.set(0.2, n * SY, 0); lab.world.add(wall);
    tag('n = 25', 'ptr alt', 6.3, n * SY);
    say('條件看的是 p，不是 i：不能直接說 n 次', 'n = 25：追蹤 p 的值');
    await beat(tok, 2400);
    let p = 0;
    for (let k = 1; ; k++) {
      p += k;
      const x = -5 + (k - 1) * 1.4;
      const m = bar(p > n ? C.red : C.blue, 1, 1, x, 0);
      await growBar(tok, m, p * SY, 450);
      tag('p=' + p, 'idx', x, p * SY + 0.35); tag('k=' + k, 'idx', x, 0, 0.9);
      say('第 ' + k + ' 次：p = 1 + … + ' + k + ' = ' + p, p > n ? p + ' > 25 → 停！' : p + ' ≤ 25，繼續');
      await beat(tok, 900);
      if (p > n) break;
    }
    say('執行 k 次後 p = k(k+1)/2', '停止條件 k(k+1)/2 > n');
    await beat(tok, 2600);
    say('k² ≈ n → k ≈ √n（精確約 √(2n) = 7.07）', 'n = 25 跑了 7 次 → O(√n)');
    await beat(tok, 3200);
  }

  // ─── 9SgLBjXqwd4：i *= 2，n = 8 與 n = 10，取 ceil ───
  async function scDoubling(tok) {
    fresh([0, 6, 13.5], [0, 1.6, 0]);
    const X = (v) => -5.6 + v * 0.7;
    code(['for (i = 1; i < n; i = i * 2)', '  stmt;'], -2, 6.4, 0.5);
    for (let v = 0; v <= 16; v += 2) tag(String(v), 'idx', X(v), 0, 3.4);
    const runRow = async (n, z) => {
      const w = lab.box(C.red, [0.08, 1.6, 1.2]); w.position.set(X(n), 0.8, z); lab.world.add(w);
      tag('n = ' + n, 'ptr alt', X(n), 1.9, z);
      let c = 0;
      for (let i = 1; ; i *= 2) {
        const ok = i < n;
        const m = cube('i=' + i, ok ? C.blue : C.red, [0.6, 0.6, 0.6], X(Math.min(i, 16)), 0.3, z, 3);
        if (ok) c++;
        say('n = ' + n + '：i = ' + i + (ok ? ' < ' + n + ' → 執行（第 ' + c + ' 次）' : ' ≥ ' + n + ' → 停'), 'i = 1, 2, 2², 2³ …');
        await beat(tok, 900);
        if (!ok) { glow(m, RED); break; }
      }
      tag(c + ' 次', 'ptr', 6.2, 0.4, z);
      return c;
    };
    say('i 每次乘 2：設 k 次後 2ᵏ ≥ n 停', '2ᵏ = n → k = log₂ n');
    await beat(tok, 2400);
    await runRow(8, -1);
    say('n = 8：3 次 = log₂ 8', '');
    await beat(tok, 1600);
    await runRow(10, 1.6);
    say('n = 10：4 次，但 log₂ 10 ≈ 3.32', '→ 次數是 ⌈log₂ n⌉，要取 ceil');
    await beat(tok, 3000);
    say('計數變數是「乘」的迴圈 → O(log n)', 'i *= 3 就是 log₃ n');
    await beat(tok, 2600);
  }

  // ─── 9SgLBjXqwd4：i /= 2 與 i*i < n ───
  async function scHalvingSqrt(tok) {
    fresh([0, 6, 13.5], [0, 2, 0]);
    code(['for (i = n; i >= 1; i = i / 2)', '  stmt;'], -3.6, 6.6, 0.5);
    const n = 32;
    say('i 從 n 開始每次除以 2', 'n = 32：n, n/2, n/2², …');
    await beat(tok, 2000);
    let c = 0;
    for (let i = n; i >= 1; i = Math.floor(i / 2)) {
      c++;
      const m = bar(C.blue, 0.9, 0.9, -5.6 + (c - 1) * 1.1, -1); await growBar(tok, m, i * 0.14, 400);
      tag('i=' + i, 'idx', -5.6 + (c - 1) * 1.1, i * 0.14 + 0.35, -1);
      say('第 ' + c + ' 次：i = ' + i, '');
      await beat(tok, 450);
    }
    say('n/2ᵏ < 1 停：令 n/2ᵏ = 1 → k = log₂ n', 'n = 32 跑 6 次（log₂32 + 1）→ O(log n)');
    await beat(tok, 2800);
    const cd2 = code(['for (i = 0; i * i < n; i++)', '  stmt;'], 3, 6.6, 0.5);
    say('另一種：條件是 i × i < n', 'n = 25');
    await beat(tok, 1600);
    for (let i = 0; i * i <= 25; i++) {
      const ok = i * i < 25;
      for (let r = 0; r < i; r++) for (let q = 0; q < i; q++) if (r === i - 1 || q === i - 1) cube('', ok ? C.green : C.red, [0.4, 0.3, 0.4], 2.4 + q * 0.45, 0.15, -1.6 + r * 0.45, 2);
      say('i = ' + i + '：i² = ' + i * i + (ok ? ' < 25 → 執行' : ' ≥ 25 → 停'), '方塊面積 = i²');
      await beat(tok, 900);
    }
    cd2.hl(0);
    say('i² = n 時停 → i = √n', 'n = 25 跑 5 次 → O(√n)');
    await beat(tok, 3000);
  }

  // ─── 9SgLBjXqwd4：獨立迴圈 2n、p = log n 再 log p ───
  async function scLogLog(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    say('先看兩個一前一後的獨立迴圈', 'for i < n {…}  for j < n {…}');
    const n1 = 12;
    for (let k = 0; k < n1; k++) { cube('', C.blue, [0.4, 0.4, 0.6], -5.6 + k * 0.46, 0.2, -2.4, 2); await beat(tok, 60); }
    for (let k = 0; k < n1; k++) { cube('', C.purple, [0.4, 0.4, 0.6], -5.6 + (k + n1) * 0.46, 0.2, -2.4, 2); await beat(tok, 60); }
    tag('n + n = 2n → O(n)，不是 n²', 'ptr alt', 0, 1, -2.4);
    await beat(tok, 2400);
    code(['for (p = 0, i = 1; i < n; i = i * 2)', '  p++;', 'for (j = 1; j < p; j = j * 2)', '  stmt;'], -2.6, 6.8, 0.5);
    say('第一個迴圈：i 乘 2，p 數它跑了幾次', 'n = 256');
    let p = 0;
    for (let i = 1; i < 256; i *= 2) { p++; cube('i=' + i, C.teal, [0.95, 0.45, 0.8], -5.3 + (p - 1) * 1.05, 0.23, 0.6, 3); await beat(tok, 380); }
    const pl = tag('p = ' + p + ' = log₂ 256', 'ptr alt', 3.5, 1.3, 0.6);
    await beat(tok, 1800);
    say('第二個迴圈：j 乘 2，直到 j ≥ p = 8', '跑 log p 次');
    let c = 0;
    for (let j = 1; j < p; j *= 2) { c++; cube('j=' + j, C.orange, [0.95, 0.45, 0.8], -5.3 + (c - 1) * 1.05, 0.23, 2.2, 3); await beat(tok, 700); }
    tag('stmt ' + c + ' 次 = log₂ 8', 'ptr', 0.2, 1, 2.2);
    cls(pl, 'ptr alt');
    say('p = log n 代入 → log p = log log n', 'n = 256：log log n = 3 → O(log log n)');
    await beat(tok, 3400);
  }

  // ─── 9SgLBjXqwd4：外層 n、內層 j *= 2 ───
  async function scNLogN(tok) {
    fresh([0, 7, 12.5], [0, 1.2, 0]);
    code(['for (i = 0; i < n; i++)', '  for (j = 1; j < n; j = j * 2)', '    stmt;'], -2.4, 6.4, 0.5);
    const n = 8;
    say('外層 n 次；內層 j 乘 2，每次 log n 次', 'n = 8');
    await beat(tok, 2000);
    for (let i = 0; i < n; i++) {
      tag('i=' + i, 'idx', -4.6, 0.2, -2.8 + i * 0.75);
      for (let j = 1, q = 0; j < n; j *= 2, q++) { cube('j=' + j, C.purple, [1.1, 0.35, 0.6], -3 + q * 1.3, 0.18, -2.8 + i * 0.75, 2.5); await beat(tok, 110); }
      if (i === 0) { say('i = 0：j = 1, 2, 4 → 3 次 = log₂ 8', ''); await beat(tok, 1400); }
    }
    say('8 列 × 3 = 24 = n log n', '總計約 2n log n + n → O(n log n)');
    await beat(tok, 3200);
  }

  // ─── 9SgLBjXqwd4：總整理 ───
  async function scLoopSummary(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    const n = 64;
    const R = [['i++', 64, 'O(n)', C.blue], ['i += 2', 32, 'O(n)', C.blue], ['i--', 64, 'O(n)', C.blue], ['i *= 2', 6, 'O(log₂ n)', C.green], ['i *= 3', 4, 'O(log₃ n)', C.green], ['i /= 2', 7, 'O(log₂ n)', C.green]];
    say('n = 64：常見迴圈各跑幾次', '');
    await beat(tok, 1600);
    for (let r = 0; r < R.length; r++) {
      const [nm, c, big, col] = R[r], x = -5.5 + r * 2.2;
      tag(nm, 'ptr', x, 0, 1.4);
      const m = bar(col, 1.3, 1.3, x, 0); await growBar(tok, m, 0.15 + c * 0.085, 500);
      tag(c + ' 次', 'idx', x, 0.4 + c * 0.085);
      tag(big, 'ptr alt', x, 1.1 + c * 0.085);
      say(nm + '：' + c + ' 次 → ' + big, r === 1 ? 'n/2 也是 O(n)' : r === 4 ? 'log₃ 64 ≈ 3.8 → 4 次' : '');
      await beat(tok, 1300);
    }
    say('加減 → O(n)；乘除 → O(log n)', 'O 寫的是次數：n/2、n/200 都是 O(n)');
    await beat(tok, 3200);
  }

  // ─── 5v-tKX2uRAk：函數類別比較表 ───
  async function scClassTable(tok) {
    const focus = (ctx.params || {}).focus;
    if (focus !== 'n100') {
      fresh([0, 5.5, 15], [0, 3.4, 0]);
      tag('1 < log n < √n < n < n log n < n² < n³ < … < 2ⁿ < 3ⁿ < nⁿ', 'ptr', 0, 7.6);
      const F = [['log n', (n) => lg(n), C.green], ['n', (n) => n, C.blue], ['n²', (n) => n * n, C.orange], ['2ⁿ', (n) => Math.pow(2, n), C.red]];
      F.forEach(([nm, , col], q) => { const t = tag(nm, 'ptr', -6 + q * 0.9, 6.6); t.element.style.color = col; });
      say('代幾個 n 進去比比看', '高度用對數尺度：每高一格 ×2');
      await beat(tok, 2200);
      const NS = [1, 2, 4, 8, 9];
      for (let c = 0; c < NS.length; c++) {
        const n = NS[c], x0 = -5.2 + c * 2.6;
        tag('n = ' + n, 'ptr alt', x0 + 0.6, 0, 1.4);
        const vals = F.map(([, f]) => f(n));
        for (let q = 0; q < 4; q++) {
          const v = vals[q], h = 0.08 + lg(v + 1) * 0.62;
          const m = bar(F[q][2], 0.45, 0.6, x0 + q * 0.42, 0); await growBar(tok, m, h, 200);
          tag(fmt(v), 'idx', x0 + q * 0.42, h + 0.3 + (q % 2) * 0.32);
        }
        say(n === 2 || n === 4 ? 'n = ' + n + '：n² = 2ⁿ = ' + n * n + '，剛好相等' : n === 8 ? 'n = 8：n² = 64、2ⁿ = 256，突然拉開' : n === 9 ? 'n = 9：81 vs 512，差距越來越大' : 'n = 1：log n = 0', '');
        await beat(tok, n >= 8 ? 2200 : 1600);
      }
      say('小 n 時可能相等甚至顛倒，從某點之後順序就固定', '2ⁿ 永遠贏過 n²');
      await beat(tok, 2800);
    }
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    say('n¹⁰⁰ vs 2ⁿ：n 要想成很大', '比 log₁₀ 值（位數）');
    const NS2 = [10, 100, 500, 1000, 2000];
    for (let c = 0; c < NS2.length; c++) {
      const n = NS2[c], x = -5 + c * 2.5, a = 100 * Math.log10(n), b = n * Math.log10(2);
      tag('n = ' + n, 'ptr alt', x, 0, 1.4);
      const m1 = bar(C.purple, 0.8, 0.8, x - 0.45, 0), m2 = bar(C.red, 0.8, 0.8, x + 0.45, 0);
      await growBar(tok, m1, a / 120, 300); await growBar(tok, m2, b / 120, 300);
      tag('10^' + Math.round(a), 'idx', x - 0.45, a / 120 + 0.3); tag('10^' + Math.round(b), 'idx', x + 0.45, b / 120 + 0.65);
      say('n = ' + n + '：n¹⁰⁰ ≈ 10^' + Math.round(a) + '，2ⁿ ≈ 10^' + Math.round(b), b > a ? '2ⁿ 已經超過' : 'n¹⁰⁰ 還比較大');
      await beat(tok, 1500);
    }
    tag('紫 = n¹⁰⁰、紅 = 2ⁿ', 'ptr', 0, 6.6);
    say('交點約在 n ≈ 996，之後 2ⁿ 永遠比較大', '任何 nᵏ 最後都輸給 2ⁿ');
    await beat(tok, 3200);
  }

  // ─── -FElVPKykgw：依成長率排序，取 log 比較 ───
  async function scOrderByLog(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    const F = [['n⁴', 'n⁴', 3], ['C(n, 3)', 'Θ(n³)', 2], ['n + log⁴ n', 'Θ(n)', 1], ['n^(log n)', 'n^(log n)', 4], ['2ⁿ', '2ⁿ', 5]];
    const ms = F.map(([nm], k) => cube(nm, C.blue, [2, 0.7, 1], -5 + k * 2.5, 0.35, 1.6, 3));
    say('把函數依漸近成長率排序：先化簡', '');
    await beat(tok, 1800);
    relabel(ms[1], 'n(n−1)(n−2)/6'); say('C(n, 3) = n(n−1)(n−2)/6', '≈ n³/6 → Θ(n³)'); await beat(tok, 2000); relabel(ms[1], 'Θ(n³)'); tint(ms[1], C.purple);
    relabel(ms[2], 'Θ(n)'); tint(ms[2], C.purple); say('n + log⁴ n：log 的多項式仍被 n 主導', '→ Θ(n)'); await beat(tok, 2200);
    say('依序擺好：最小的在左邊', '');
    const order = [2, 1, 0, 3, 4];
    order.forEach((k, pos) => move(ms[k], -5 + pos * 2.5, 0.35 + pos * 0.25, -1));
    await beat(tok, 1800);
    glow(ms[3], GOLD); glow(ms[4], GOLD);
    say('n^(log n) 和 2ⁿ 誰大？兩邊取 log', 'log 單調遞增，取完大小關係不變');
    await beat(tok, 2400);
    relabel(ms[3], 'log² n'); relabel(ms[4], 'n');
    say('取 log 後：log² n 對上 n', 'log(n^(log n)) = log n · log n = log² n；log(2ⁿ) = n');
    await beat(tok, 2200);
    const v1 = Math.pow(lg(1024), 2), v2 = 1024;
    tag('n = 1024：log² n = ' + v1 + '、n = ' + v2, 'ptr alt', 1, 4.2);
    say('n 遠大於 log² n → 2ⁿ 比較大', '');
    await beat(tok, 2200);
    relabel(ms[3], 'n^(log n)'); relabel(ms[4], '2ⁿ'); glow(ms[3], null); glow(ms[4], GREEN);
    say('n + log⁴n < C(n,3) < n⁴ < n^(log n) < 2ⁿ', '有階乘的用 Stirling：n! ≈ √(2πn)(n/e)ⁿ');
    await beat(tok, 3400);
  }

  // ─── A03oI0znAoc：Big-O：2n + 3 ≤ 10n、5n、5n² ───
  async function scBigO5n(tok) {
    fresh([0, 5, 15], [0, 3.8, 0]);
    const P = plot(-6, 0, 11.5, 7.2, 10, 70);
    const f = (n) => 2 * n + 3;
    P.curve(f, C.red); tag('f(n) = 2n + 3', 'ptr', P.X(10) + 0.2, P.Y(23) - 0.3);
    say('Big-O：找 c、n₀ 讓 f ≤ c·g', 'f(n) = O(g(n)) ⇔ 存在 c、n₀，n ≥ n₀ 時 f(n) ≤ c·g(n)；f(n) = 2n + 3');
    await beat(tok, 2800);
    const g10 = P.curve((n) => 10 * n, C.green, 0, 7); const l10 = tag('10n', 'ptr alt', P.X(7) - 0.4, P.Y(70) + 0.2);
    P.vmark(1, '#c08a1f', 'n₀ = 1');
    say('右邊寫「一項」乘係數：10n', 'n = 1：10 ≥ 5 ✓ → c = 10、g(n) = n');
    await beat(tok, 2600);
    say('7n、1000n 也行，只要比 f 大', '學生常卡在要寫多少——其實寫什麼都可以');
    await beat(tok, 2400);
    kill(g10); kill(l10);
    P.curve((n) => 5 * n, C.green); tag('5n', 'ptr alt', P.X(10) + 0.2, P.Y(50));
    say('快速法：每一項都變成 n 的倍數', '2n + 3 ≤ 2n + 3n = 5n，n ≥ 1');
    await beat(tok, 2600);
    tag('n = 1：5 = 5', 'idx', P.X(1) + 0.8, P.Y(5) + 0.5);
    say('n = 1 時兩邊都是 5，之後 5n 都比較大', 'f(n) = O(n)');
    await beat(tok, 2600);
    P.curve((n) => 5 * n * n, C.purple, 0, 3.74); tag('5n²', 'ptr', P.X(3.74), P.Y(70) + 0.3);
    say('2n + 3 ≤ 2n² + 3n² = 5n² 也成立', 'f(n) = O(n²)：對，但不是最接近的');
    await beat(tok, 3200);
  }

  // ─── A03oI0znAoc：上界／下界的類別階梯 ───
  async function scBoundLadder(tok) {
    fresh([0, 5, 15], [0, 2, 0]);
    const CL = ['1', 'log log n', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', 'nⁿ'];
    const ms = CL.map((nm, k) => cube(nm, GRAY, [1.15, 0.5 + k * 0.12, 1], -5.85 + k * 1.3, (0.5 + k * 0.12) / 2, 0, 3));
    const fm = cube('2n + 3', C.red, [1.15, 0.5, 1], -5.85 + 4 * 1.3, 4.4, 0);
    const big = tag('', 'ptr alt', 0, 6.4);
    say('函數類別從小排到大；f(n) = 2n + 3 屬於 n 這一類', '');
    move(fm, -5.85 + 4 * 1.3, 2.6, 0);
    await beat(tok, 2600);
    const focus = (ctx.params || {}).focus;
    if (focus !== 'omega') {
      txt(big, 'Big-O：上界');
      for (let k = 4; k < CL.length; k++) { tint(ms[k], C.green); await beat(tok, 250); }
      say('n 和右邊每一類都是上界：O(n)、O(n²)、O(2ⁿ) 都對', '');
      await beat(tok, 2600);
      glow(ms[2], RED); say('O(log n) 是錯的：log n 在下界那一側', ''); await beat(tok, 2200); glow(ms[2], null);
      glow(ms[4], GREEN); say('寫最接近的：O(n)', '寫太大的不算錯，但沒有用');
      await beat(tok, 2600);
      ms.forEach((m) => { tint(m, GRAY); glow(m, null); });
    }
    txt(big, 'Big-Ω：下界');
    say('Ω 只把不等號反過來：f(n) ≥ c·g(n)', '2n + 3 ≥ 1·n，n ≥ 1');
    for (let k = 4; k >= 0; k--) { tint(ms[k], C.purple); await beat(tok, 250); }
    await beat(tok, 1600);
    glow(ms[6], RED); say('Ω(log n)、Ω(√n) 都對；Ω(n²) 錯', ''); await beat(tok, 2200); glow(ms[6], null);
    glow(ms[4], GREEN); say('下界也寫最接近的：Ω(n)', '');
    await beat(tok, 2200);
    ms.forEach((m, k) => { tint(m, k === 4 ? C.green : GRAY); glow(m, null); });
    txt(big, 'Θ：只有 n 這一格');
    say('Θ：上下界同時是 n，只能寫 Θ(n)', '能寫 Θ 就寫 Θ');
    await beat(tok, 3200);
  }

  // ─── A03oI0znAoc：Θ 夾擠 1·n ≤ 2n + 3 ≤ 5n ───
  async function scThetaSandwich(tok) {
    fresh([0, 5, 15], [0, 3.8, 0]);
    const P = plot(-6, 0, 11.5, 7.2, 12, 64);
    P.curve((n) => 2 * n + 3, C.red); tag('2n + 3', 'ptr', P.X(12) + 0.4, P.Y(27));
    say('Θ：c₁·g(n) ≤ f(n) ≤ c₂·g(n)，n ≥ n₀', '');
    await beat(tok, 2000);
    P.curve((n) => 5 * n, C.green); tag('5n（c₂ = 5）', 'ptr alt', P.X(12) + 0.6, P.Y(60));
    say('上界：2n + 3 ≤ 5n', ''); await beat(tok, 1600);
    P.curve((n) => n, C.purple); tag('1·n（c₁ = 1）', 'ptr', P.X(12) + 0.6, P.Y(12));
    say('下界：2n + 3 ≥ 1·n', ''); await beat(tok, 1600);
    P.vmark(1, '#c08a1f', 'n₀ = 1'); P.zone(1, 12);
    say('兩邊的 g(n) 都是 n → f(n) = Θ(n)', '1·n ≤ 2n + 3 ≤ 5n，n ≥ 1');
    await beat(tok, 2800);
    const bad = P.curve((n) => 0.25 * n * n, C.gold, 0, 12); const bl = tag('0.25·n²', 'ptr alt', P.X(11), P.Y(36) + 0.5);
    say('想說 Θ(n²)？下界 c₁·n² 遲早超過 f', '再小的 c₁ 都一樣 → Θ(n²) 錯');
    await beat(tok, 3000);
    kill(bad); kill(bl);
    say('不要把 O 當 worst case、Ω 當 best case', '符號是函數的界，跟 case analysis 是兩回事');
    await beat(tok, 3000);
  }

  // ─── 4V30R3I1vLI：tracing tree of test(3) ───
  async function scTraceTest3(tok) {
    fresh([0, 5.5, 14], [0, 3.2, 0]);
    const cd = code(['void test(int n) {', '  if (n > 0) {', '    printf("%d", n);', '    test(n - 1);', '  }', '}'], -4, 7, 0.48);
    const out = tag('輸出：', 'ptr alt', 3.2, 7.2);
    const cnt = tag('呼叫 0 次・印 0 次', 'ptr', 3.2, 6.5);
    let calls = 0, prints = 0, outs = '';
    say('呼叫 test(3)：追蹤每一次呼叫', '');
    await beat(tok, 1800);
    for (let n = 3; n >= 0; n--) {
      const x = -0.8 + (3 - n) * 1.9, y = 5.2 - (3 - n) * 1.4;
      calls++;
      cube('test(' + n + ')', n === 0 ? C.orange : C.blue, [1.7, 0.55, 1], x, y, 0, 2);
      if (n < 3) line(x - 1.9, y + 1.15, x, y + 0.3);
      cd.hl(1);
      await beat(tok, 600);
      if (n > 0) {
        cd.hl(2); prints++; outs += n + ' ';
        cube(String(n), C.green, [0.6, 0.5, 0.6], x - 1.3, y - 0.9, 0, 2);
        txt(out, '輸出：' + outs); say(n + ' > 0：印出 ' + n + '，再呼叫 test(' + (n - 1) + ')', '');
        await beat(tok, 900); cd.hl(3);
      } else { say('test(0)：0 不大於 0 → 不印、不再呼叫，停止', ''); }
      txt(cnt, '呼叫 ' + calls + ' 次・印 ' + prints + ' 次');
      await beat(tok, 700);
    }
    cd.hl(-1);
    say('印 3 次、呼叫 4 次', '傳入 n → 呼叫 n + 1 次、印 n 次');
    await beat(tok, 2600);
    say('時間取決於呼叫次數：f(n) = n + 1', '→ O(n)，也可寫 Θ(n)');
    await beat(tok, 3000);
  }

  // ─── 4V30R3I1vLI：back substitution T(n) = T(n−1) + 1 ───
  async function scBackSubDec(tok) {
    fresh([0, 5, 14], [0, 3.2, 0]);
    const eq = code(['T(n) = T(n−1) + 1', '', '', '', '', ''], -2.6, 7, 0.62);
    const rem = lab.box(C.blue, [1, 1, 1.2]); rem.position.set(3.4, 0, 0); lab.world.add(rem);
    const rl = tag('T(n)', 'ptr', 3.4, 4);
    setBar(rem, 3.6);
    const ones = [];
    say('寫遞迴式：printf 1 單位 + test(n−1) 花 T(n−1)', 'T(n) = T(n−1) + 1；T(0) = 1');
    await beat(tok, 2600);
    const steps = [['T(n) = [T(n−2) + 1] + 1', 'T(n) = T(n−2) + 2'], ['T(n) = [T(n−3) + 1] + 2', 'T(n) = T(n−3) + 3']];
    for (let s = 0; s < steps.length; s++) {
      eq.set(1 + s * 2, steps[s][0]); eq.hl(1 + s * 2);
      say('把 T(n−' + (s + 1) + ') 用遞迴式換掉', steps[s][0]);
      await beat(tok, 1800);
      eq.set(2 + s * 2, steps[s][1]); eq.hl(2 + s * 2);
      ones.push(cube('+1', C.green, [1, 0.5, 1.2], 5, 0.25 + ones.length * 0.55, 0, 3));
      await anim(tok, 400, (t) => setBar(rem, 3.6 - (s + 1) * 0.6 * t - s * 0.6 * (1 - t)));
      txt(rl, 'T(n−' + (s + 1) + ')'); rl.position.y = rem.scale.y + 0.4;
      await beat(tok, 1300);
    }
    eq.set(5, 'k 次後：T(n) = T(n−k) + k'); eq.hl(5);
    for (let k = 3; k < 6; k++) { ones.push(cube('+1', C.green, [1, 0.5, 1.2], 5, 0.25 + ones.length * 0.55, 0, 3)); await anim(tok, 300, (t) => setBar(rem, 3.6 - (k + t) * 0.6)); }
    txt(rl, 'T(n−k)'); rl.position.y = rem.scale.y + 0.4;
    say('代 k 次：T(n) = T(n−k) + k', '');
    await beat(tok, 2200);
    await anim(tok, 500, (t) => setBar(rem, Math.max(0.15, 0.0 + rem.scale.y * (1 - t))));
    txt(rl, 'T(0) = 1'); rl.position.y = 0.6;
    say('要碰到已知的 T(0)：令 n − k = 0 → k = n', 'T(n) = T(0) + n = 1 + n');
    await beat(tok, 2800);
    say('T(n) = n + 1 → Θ(n)', '和 tracing tree 的 n + 1 次呼叫一致');
    await beat(tok, 3000);
  }

  // ─── CyknhZbfMqc：遞減型 Master Theorem ───
  async function scMasterDec(tok) {
    fresh([0, 5.5, 14.5], [0, 2.6, 0]);
    const bins = [['a < 1', 'O(nᵏ) = O(f(n))', -4.4, C.green], ['a = 1', 'O(nᵏ⁺¹) = O(n·f(n))', 0, C.blue], ['a > 1', 'O(nᵏ·a^(n/b))', 4.4, C.red]];
    const ansT = bins.map(([nm, ans, x]) => { ctx.tile(V3(x, 0.04, 0), 3.8, 2.6, '#efe6d2'); tag(nm, 'ptr', x, 0.2, 1.7); const t = tag(ans, 'ptr alt', x, 6.3); showL(t, false); return t; });
    tag('T(n) = aT(n − b) + f(n)，f(n) = O(nᵏ)', 'ptr', 0, 7.2);
    say('先看已經解過的遞減式', '');
    await beat(tok, 1800);
    const EX = [['T(n−1) + 1', 'O(n)', 1], ['T(n−1) + n', 'O(n²)', 1], ['T(n−1) + log n', 'O(n log n)', 1], ['2T(n−1) + 1', 'O(2ⁿ)', 2], ['3T(n−1) + 1', 'O(3ⁿ)', 2], ['2T(n−1) + n', 'O(n·2ⁿ)', 2], ['0.5T(n−1) + n', 'O(n)', 0]];
    const cnt = [0, 0, 0];
    for (const [r, a, bi] of EX) {
      const x = bins[bi][2], y = 0.35 + cnt[bi] * 0.75; cnt[bi]++;
      const m = cube(r + ' → ' + a, bins[bi][3], [3.4, 0.6, 1.2], 0, 5, 0);
      say(r + ' → ' + a, bi === 1 ? 'a = 1：f(n) 被乘上 n' : bi === 2 ? 'a > 1：f(n) 被乘上 aⁿ' : 'a < 1：就是 f(n)');
      await beat(tok, 900); move(m, x, y, 0); await beat(tok, 1300);
    }
    ansT.forEach((t) => showL(t, true));
    say('三種情況：看 a 跟 1 比', '若是 T(n−2)：aⁿ 變成 a^(n/2)');
    await beat(tok, 3200);
    say('定理是從例子觀察出來的：自己動手解幾題', '');
    await beat(tok, 2400);
  }

  // ─── 1K9ebQJosvo：T(n) = 2T(n/2) + n 的遞迴樹 ───
  async function scTree2Half(tok) {
    fresh([0, 5, 15.5], [0, 3.4, 0]);
    const n = 8, W = 8.8;
    tag('T(n) = 2T(n/2) + n（n = 8）', 'ptr', 0, 7.6);
    say('每個節點只寫「這一塊的工作量」', '根：n');
    let total = 0;
    for (let d = 0; d <= 3; d++) {
      const cnt = Math.pow(2, d), size = n / cnt, y = 6.2 - d * 1.6, w = W / cnt;
      for (let i = 0; i < cnt; i++) cube(size, d === 3 ? C.purple : C.blue, [w * 0.92, 0.55, 0.9], -2 - W / 2 + w * (i + 0.5), y, 0, 2);
      total += n;
      const s = tag(cnt + ' × ' + size + ' = ' + n, 'ptr alt', 4.6, y);
      say(d === 3 ? '葉子：8 個 T(1)，每個 1' : '第 ' + d + ' 層：' + cnt + ' 塊，每塊 n/' + cnt + ' = ' + size, '這層總和 = ' + n);
      await beat(tok, 1700);
      if (d === 3) cls(s, 'ptr');
    }
    tag('寬度一樣 = 每層都是 n', 'idx', -2, 0, 1.2);
    say('每一層加起來都是 n', 'n/2 + n/2 = n、4 × n/4 = n、8 × n/8 = n');
    await beat(tok, 2800);
    say('n/2ᵏ = 1 → k = log₂ n 層（這裡 3 層 + 葉子）', 'T(n) = n log n + n = 24 + 8 = 32');
    await beat(tok, 2800);
    say('T(n) = Θ(n log n)', 'merge sort 就是這個遞迴式');
    await beat(tok, 2600);
  }

  // ─── 1K9ebQJosvo：back substitution 2ᵏT(n/2ᵏ) + kn ───
  async function scBackSubDiv(tok) {
    fresh([0, 5, 14], [0, 3.2, 0]);
    const eq = code(['T(n) = 2T(n/2) + n', '', '', '', '', ''], -2.6, 7, 0.62);
    const L = [['T(n) = 2[2T(n/2²) + n/2] + n', 'T(n) = 2²T(n/2²) + 2n'], ['T(n) = 2²[2T(n/2³) + n/2²] + 2n', 'T(n) = 2³T(n/2³) + 3n']];
    const ns = [];
    const addN = () => ns.push(cube('n', C.green, [1.6, 0.5, 1.2], 4.6, 0.25 + ns.length * 0.55, 0, 3));
    const coef = tag('', 'ptr alt', 4.6, 6.2);
    say('T(n/2) = 2T(n/2²) + n/2', '代回原式');
    addN(); txt(coef, '係數 2');
    await beat(tok, 2200);
    for (let s = 0; s < 2; s++) {
      eq.set(1 + s * 2, L[s][0]); eq.hl(1 + s * 2); await beat(tok, 1700);
      eq.set(2 + s * 2, L[s][1]); eq.hl(2 + s * 2); addN(); txt(coef, '係數 2^' + (s + 2));
      say(L[s][1], '每代一次多一個 n');
      await beat(tok, 1700);
    }
    eq.set(5, 'k 次：T(n) = 2ᵏT(n/2ᵏ) + kn'); eq.hl(5); txt(coef, '係數 2ᵏ');
    say('代 k 次：2ᵏT(n/2ᵏ) + kn', '');
    await beat(tok, 2200);
    say('令 n/2ᵏ = 1 → n = 2ᵏ，k = log n', 'T(n) = n·T(1) + n log n = n + n log n');
    for (let i = 0; i < 2; i++) { addN(); await beat(tok, 250); }
    await beat(tok, 2400);
    say('最高項 n log n → Θ(n log n)', '樹法、代入法答案一致');
    await beat(tok, 3000);
  }

  // ─── 課本補充（CLRS 4.5）：Master Theorem（dividing）三種情況 ───
  async function scMasterDiv(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    tag('T(n) = aT(n/b) + f(n)：比 n^(log_b a) 與 f(n)', 'ptr', 0, 7.4);
    const CASES = [
      ['9T(n/3) + n', 9, 3, 1, 'case 1：越往下越大，葉子主導', 'n^(log₃9) = n² 比 f = n 大多項式倍', 'Θ(n²)'],
      ['T(2n/3) + 1', 1, 1.5, 0, 'case 2：每層一樣', 'n^(log_{3/2}1) = 1 與 f 同階 → 乘 lg n', 'Θ(lg n)'],
      ['3T(n/4) + n lg n', 3, 4, 1.05, 'case 3：越往下越小，根主導', 'f 比 n^0.79 大，且 3(n/4)lg(n/4) ≤ ¾·n lg n', 'Θ(n lg n)'],
      ['2T(n/2) + n lg n', 2, 2, 1.0001, 'gap：落在 case 2 與 3 之間', 'n lg n 只比 n 大 lg n 倍，不是多項式倍', 'Master 不適用（Θ(n lg² n)）'],
    ];
    say('教科書版本（CLRS）：看每層成本往下怎麼變', '方塊高度 = 遞迴樹每一層的總成本');
    await beat(tok, 2400);
    for (const [nm, a, b, k, why, detail, ans] of CASES) {
      for (const o of [...lab.world.children]) if (o.userData.tmp) kill(o);
      const t = tag(nm, 'ptr alt', 0, 6.6); t.userData.tmp = true;
      const L = 6, costs = [];
      for (let d = 0; d <= L; d++) costs.push(Math.pow(a, d) * Math.pow(Math.pow(b, L - d), Math.floor(k)) * (k % 1 ? Math.max(1, L - d) : 1));
      const mx = Math.max(...costs);
      for (let d = 0; d <= L; d++) { const m = bar(d === L ? C.purple : C.blue, 1.2, 1.2, -5.4 + d * 1.6, 0); m.userData.tmp = true; await growBar(tok, m, 0.12 + 5 * costs[d] / mx, 160); }
      say(why, nm + ' → ' + ans + '；' + detail);
      await beat(tok, 3600);
    }
    say('case 1 葉子主導、case 2 每層一樣、case 3 根主導', 'case 3 還要檢查 regularity：a·f(n/b) ≤ c·f(n)，c < 1');
    await beat(tok, 3200);
  }

  // ─── 課本補充（CLRS 4.3）：substitution method ───
  async function scSubstitution(tok) {
    fresh([0, 5, 14.5], [0, 3.2, 0]);
    const eq = code(['T(n) = 2T(⌊n/2⌋) + n', '猜 T(n) ≤ c·n lg n', '', '', '', ''], -3.2, 7.2, 0.6);
    say('Substitution：先猜答案，再用數學歸納法證', 'T(n) = 2T(⌊n/2⌋) + n，猜 O(n lg n)');
    await beat(tok, 2800);
    eq.set(2, '假設 T(⌊n/2⌋) ≤ c⌊n/2⌋lg⌊n/2⌋'); eq.hl(2); say('歸納假設：較小的 n 都成立', ''); await beat(tok, 2000);
    eq.set(3, 'T(n) ≤ 2c(n/2)lg(n/2) + n'); eq.hl(3); say('代進遞迴式', ''); await beat(tok, 1800);
    eq.set(4, '     = cn lg n − cn + n'); eq.hl(4); say('lg(n/2) = lg n − 1', ''); await beat(tok, 1800);
    eq.set(5, '     ≤ cn lg n   （c ≥ 1）'); eq.hl(5); say('只要 c ≥ 1，−cn + n ≤ 0', '形式要「一模一樣」，不能只得到 O(…)');
    await beat(tok, 2600);
    eq.hl(-1);
    say('邊界：T(1) = 1，但 c·1·lg1 = 0 → 不成立', '改從 n₀ = 2 開始：T(2) = 4、T(3) = 5');
    const vals = { 1: 1 }; for (let n = 2; n <= 16; n++) vals[n] = 2 * vals[Math.floor(n / 2)] + n;
    for (let n = 2; n <= 16; n++) {
      const x = -5.6 + (n - 2) * 0.8;
      const m1 = bar(C.blue, 0.32, 0.6, x - 0.17, 1.6), m2 = bar(C.green, 0.32, 0.6, x + 0.17, 1.6);
      setBar(m1, vals[n] * 0.045); setBar(m2, 2 * n * lg(n) * 0.045);
      tag(String(n), 'idx', x, 0, 2.3);
      await beat(tok, 120);
    }
    tag('藍 = T(n)、綠 = 2n lg n', 'ptr alt', 0, 4.4, 1.6);
    say('取 c = 2：n ≥ 2 時 T(n) ≤ 2n lg n 都成立', 'T(n) = O(n lg n)');
    await beat(tok, 3200);
  }

  // ─── 課本補充（CLRS 4.4）：不平均的遞迴樹 T(n/3) + T(2n/3) + cn ───
  async function scTreeUneven(tok) {
    fresh([0, 5, 15], [0, 3.4, 0]);
    tag('T(n) = T(n/3) + T(2n/3) + cn', 'ptr', 0, 7.6);
    const W = 9;
    let segs = [[0, 1]];
    for (let d = 0; d <= 4; d++) {
      const y = 6.4 - d * 1.4;
      let sum = 0;
      for (const [s, w] of segs) { if (w * 81 < 1) continue; sum += w; cube('', d % 2 ? C.purple : C.blue, [Math.max(0.05, W * w * 0.94), 0.45, 0.8], -2 - W / 2 + W * (s + w / 2), y, 0, 2); }
      tag('≤ cn', 'ptr alt', 4.6, y);
      say(d === 0 ? '根 cn：切成 1/3 與 2/3' : '第 ' + d + ' 層：寬度加起來 ' + (sum > 0.999 ? '= cn' : '≤ cn（短的那支已到底）'), '每層總和最多 cn');
      await beat(tok, 1500);
      segs = segs.flatMap(([s, w]) => [[s, w / 3], [s + w / 3, 2 * w / 3]]);
    }
    say('最短路徑一直走 1/3：log₃ n 層', '最長路徑一直走 2/3：log_{3/2} n 層');
    await beat(tok, 3000);
    say('總和 ≤ cn × log_{3/2} n → O(n lg n)', '再用 substitution 驗證猜測');
    await beat(tok, 3000);
  }

  // ─── -FElVPKykgw：T(n) = T(√n) + 1 ───
  async function scTreeSqrt(tok) {
    fresh([0, 5, 14], [0, 3.4, 0]);
    tag('T(n) = T(√n) + 1', 'ptr', -3, 7.4);
    const S = [65536, 256, 16, 4, 2];
    const PW = ['n', 'n^(1/2)', 'n^(1/4)', 'n^(1/8)', 'n^(1/16)'];
    say('每個節點成本 1，規模 n → √n → ⁴√n …', '例：n = 65536 = 2¹⁶');
    await beat(tok, 2200);
    for (let h = 0; h < S.length; h++) {
      const y = 6.2 - h * 1.35;
      cube(String(S[h]), h === S.length - 1 ? C.purple : C.blue, [2.2 - h * 0.3, 0.6, 1], -3, y, 0, 2);
      if (h) line(-3, y + 1.05, -3, y + 0.3);
      tag(PW[h], 'idx', -0.8, y); tag('成本 1', 'ptr alt', 1.8, y);
      say('第 ' + h + ' 層：規模 ' + PW[h] + ' = ' + S[h], '');
      await beat(tok, 1200);
    }
    say('一直展開到常數為止', '第 h 層規模 n^(1/2ʰ)；令 n^(1/2ʰ) = n^(1/log n) = 2');
    await beat(tok, 3000);
    say('2ʰ = log n → h = log log n', 'log log 65536 = log 16 = 4 層');
    await beat(tok, 2600);
    say('每層 1 → T(n) = Θ(log log n)', '沒給 base case 時：T(常數) = Θ(1)');
    await beat(tok, 3000);
  }

  // ─── 課本補充（CLRS 4.3）：change of variables ───
  async function scChangeVar(tok) {
    fresh([0, 5, 14], [0, 3, 0]);
    const eq = code(['T(n) = 2T(√n) + lg n', '', '', '', ''], -2.4, 6.8, 0.65);
    say('看起來很怪：規模開根號', '換變數 m = lg n（n = 2^m）');
    await beat(tok, 2600);
    eq.set(1, 'T(2^m) = 2T(2^(m/2)) + m'); eq.hl(1); say('√n = 2^(m/2)', ''); await beat(tok, 2200);
    eq.set(2, '令 S(m) = T(2^m)'); eq.hl(2); await beat(tok, 1400);
    eq.set(3, 'S(m) = 2S(m/2) + m  → Θ(m lg m)'); eq.hl(3); say('變成熟悉的 merge sort 遞迴式', 'S(m) = Θ(m lg m)');
    for (let d = 0; d < 4; d++) { const c = Math.pow(2, d); for (let i = 0; i < c; i++) cube('', C.blue, [3.6 / c * 0.9, 0.35, 0.7], 3.6 - 1.8 + (i + 0.5) * 3.6 / c, 3.6 - d * 0.75, 0, 2); await beat(tok, 300); }
    await beat(tok, 2000);
    eq.set(4, '換回 m = lg n：T(n) = Θ(lg n · lg lg n)'); eq.hl(4);
    say('換回去：T(n) = Θ(lg n lg lg n)', '');
    await beat(tok, 3200);
  }

  // ─── -FElVPKykgw：假硬幣的決策樹下界 ───
  async function scCoin(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const fake = 6;
    const coins = []; for (let i = 0; i < 9; i++) coins.push(cube(String(i + 1), i === fake ? '#e9d48a' : C.gold, [0.7, 0.25, 0.7], -4 + i * 1, 0.13, 2.6));
    const beam = lab.box('#6e5f49', [6, 0.12, 0.4]); beam.position.set(0, 3.2, -1); lab.world.add(beam);
    const post = lab.box('#6e5f49', [0.2, 3.2, 0.2]); post.position.set(0, 1.6, -1); lab.world.add(post);
    say('9 枚金幣，其中一枚是較輕的假幣', '天平有 <、=、> 三種結果');
    await beat(tok, 2400);
    const weigh = async (L, R, tilt, cap) => {
      L.forEach((i, q) => move(coins[i], -2.6 + q * 0.75, 3.45, -1)); R.forEach((i, q) => move(coins[i], 1.1 + q * 0.75, 3.45, -1));
      await beat(tok, 900);
      await anim(tok, 500, (t) => { beam.rotation.z = tilt * 0.18 * t; });
      L.forEach((i, q) => move(coins[i], -2.6 + q * 0.75, 3.45 + Math.sin(beam.rotation.z) * (-2.6 + q * 0.75), -1));
      R.forEach((i, q) => move(coins[i], 1.1 + q * 0.75, 3.45 + Math.sin(beam.rotation.z) * (1.1 + q * 0.75), -1));
      say(cap[0], cap[1]); await beat(tok, 2200);
      beam.rotation.z = 0;
    };
    await weigh([0, 1, 2], [3, 4, 5], 0, ['第 1 次：{1,2,3} vs {4,5,6} → 平衡', '假幣在 {7,8,9}——「=」也是有用的答案']);
    [0, 1, 2, 3, 4, 5].forEach((i) => { move(coins[i], -4 + i * 1, 0.13, 2.6); tint(coins[i], GRAY); });
    await beat(tok, 800);
    await weigh([6], [7], -1, ['第 2 次：7 vs 8 → 7 比較輕', '找到假幣：2 次 = log₃ 9']);
    glow(coins[fake], GREEN);
    await beat(tok, 1200);
    fresh([0, 5, 14], [0, 3.4, 0]);
    say('任何演算法都可畫成決策樹：每次秤重分 3 支', 'h 次秤重 → 最多 3ʰ 個答案（葉子）');
    let xs = [0];
    for (let d = 0; d <= 3; d++) {
      const y = 6.4 - d * 1.9, nx = [];
      xs.forEach((x) => { cube('', d === 3 ? C.green : C.blue, [d === 3 ? 0.3 : 0.6, 0.35, 0.4], x, y, 0, 2); if (d < 3) { const sp = 4.2 / Math.pow(3, d); [-sp, 0, sp].forEach((dx) => { nx.push(x + dx); line(x, y - 0.2, x + dx, y - 1.7); }); } });
      tag(Math.pow(3, d) + ' 個', 'ptr alt', 6.2, y);
      xs = nx; await beat(tok, 900);
    }
    say('3 次最多分辨 27 枚；30 枚就不夠', '3ʰ ≥ N → h ≥ log₃ N：任何演算法的下界');
    await beat(tok, 3200);
    say('下界也提示策略：每次分三堆', '同樣論證：比較排序 ≥ log₂ n! = Ω(n log n)');
    await beat(tok, 3000);
  }

  // ─── -FElVPKykgw：兩個已排序陣列的第 k 小 ───
  async function scKthTwo(tok) {
    fresh([0, 6, 14], [0, 1.8, 0]);
    const A = [5, 13, 22, 43, 56, 62, 81, 86, 87], B = [2, 3, 7, 9, 15, 19, 24, 28, 32];
    const X = (i) => -5.2 + i * 1.3;
    const ma = A.map((v, i) => { tag('A' + (i + 1), 'idx', X(i), 0, -1.2); return cube(v, C.blue, [1, 0.6, 0.9], X(i), 0.3, -2); });
    const mb = B.map((v, i) => { tag('B' + (i + 1), 'idx', X(i), 0, 2.2); return cube(v, C.purple, [1, 0.6, 0.9], X(i), 0.3, 1.4); });
    let k = 10, ia = 0, ib = 0;
    const kl = tag('找第 k = 10 小', 'ptr alt', 0, 4.2);
    say('兩個已排序陣列，找合併後第 10 小', 'merge 到第 k 個是 O(k)；能不能更快？');
    await beat(tok, 2600);
    while (k > 1) {
      const h = Math.floor(k / 2);
      const pa = Math.min(ia + h, A.length) - 1, pb = Math.min(ib + h, B.length) - 1;
      glow(ma[pa], GOLD); glow(mb[pb], GOLD);
      say('兩邊各看第 ' + h + ' 個：' + A[pa] + ' vs ' + B[pb], 'k = ' + k);
      await beat(tok, 1800);
      if (A[pa] < B[pb]) {
        for (let i = ia; i <= pa; i++) { tint(ma[i], GRAY); glow(ma[i], null); }
        say(A[pa] + ' 比較小：它和左邊的都排不到第 ' + k + '，丟掉', '丟 ' + (pa - ia + 1) + ' 個');
        k -= pa - ia + 1; ia = pa + 1; glow(mb[pb], null);
      } else {
        for (let i = ib; i <= pb; i++) { tint(mb[i], GRAY); glow(mb[i], null); }
        say(B[pb] + ' 比較小：它和左邊的都排不到第 ' + k + '，丟掉', '丟 ' + (pb - ib + 1) + ' 個');
        k -= pb - ib + 1; ib = pb + 1; glow(ma[pa], null);
      }
      txt(kl, '剩下找第 k = ' + k + ' 小');
      await beat(tok, 2000);
    }
    const ans = A[ia] < B[ib] ? ma[ia] : mb[ib];
    glow(ans, GREEN); tint(ans, C.green);
    say('k = 1：兩邊開頭較小的就是答案 = ' + Math.min(A[ia], B[ib]), '2,3,5,7,9,13,15,19,22,24 → 第 10 個是 24');
    await beat(tok, 2600);
    say('每輪丟掉約 k/2 個 → O(log k)', '比 O(log(N₁ + N₂)) 更緊');
    await beat(tok, 3000);
  }

  // ─── BRO7mVIFt08：table doubling vs m + 1 ───
  async function scTableDoubling(tok) {
    fresh([0, 5, 14.5], [0, 2.6, 0]);
    const N = 32, X = (i) => -6 + i * 0.37;
    tag('m + 1', 'ptr', -6.8, 0.2, -1.6); tag('× 2', 'ptr alt', -6.8, 0.2, 1.6);
    const t1 = tag('總成本 0', 'ptr', 4.8, 4.2, -1.6), t2 = tag('總成本 0', 'ptr alt', 4.8, 2.6, 1.6);
    say('從 m = 8 開始連續插入 32 個', '插入 1；table 滿了要 rehash 全部 n 個');
    await beat(tok, 2600);
    let m1 = 8, m2 = 8, s1 = 0, s2 = 0;
    for (let i = 1; i <= N; i++) {
      let c1 = 1, c2 = 1;
      if (i > m1) { c1 += i - 1; m1 += 1; }
      if (i > m2) { c2 += i - 1; m2 *= 2; }
      s1 += c1; s2 += c2;
      const b1 = bar(c1 > 1 ? C.red : C.green, 0.3, 0.6, X(i), -1.6); setBar(b1, 0.06 + c1 * 0.12);
      const b2 = bar(c2 > 1 ? C.red : C.green, 0.3, 0.6, X(i), 1.6); setBar(b2, 0.06 + c2 * 0.12);
      txt(t1, '總成本 ' + s1); txt(t2, '總成本 ' + s2);
      if (i === 9) { say('第 9 個：兩邊都要重建（8 個 rehash）', 'm + 1 → 9；×2 → 16'); await beat(tok, 2000); }
      else if (i === 12) { say('m + 1：之後每次插入都要重建！', '成本 1 + 2 + 3 + … → Θ(n²)'); await beat(tok, 2000); }
      else if (i === 17) { say('×2：到 17 才重建（16 個）', '重建成本 8、16、32… 等比級數'); await beat(tok, 2000); }
      else await beat(tok, 140);
    }
    say('32 次插入：m + 1 共 ' + s1 + '，×2 共 ' + s2, '×2：重建只有 log n 次，總和 Θ(n)');
    await beat(tok, 3000);
    say('Amortized：k 次操作總時間 ≤ k·T(n)', '房租月付 = 每天付 1/30；這裡每次插入 amortized Θ(1)');
    await beat(tok, 3200);
    say('rehash 成本跟 table 滿或空無關：都是 Θ(m)', 'Python list.append 也是這樣：constant amortized');
    await beat(tok, 3000);
  }

  // ─── BRO7mVIFt08：縮表要在 1/4 ───
  async function scShrinkQuarter(tok) {
    fresh([0, 5, 14.5], [0, 2.4, 0]);
    const ops = ['+', '+', '−', '+', '−', '+', '−', '+', '−', '+'];
    const run = async (rule, z, lbl) => {
      tag(lbl, rule === 'half' ? 'ptr' : 'ptr alt', -6.6, 0.2, z);
      let n = 7, m = 8, tot = 0;
      const ml = tag('', 'idx', 5.6, 0.2, z);
      for (let i = 0; i < ops.length; i++) {
        let c = 1;
        if (ops[i] === '+') { n++; if (n > m) { c += n - 1; m *= 2; } }
        else { n--; if ((rule === 'half' && n <= m / 2) || (rule === 'quarter' && n <= m / 4)) { c += n; m /= 2; } }
        tot += c;
        const b = bar(c > 1 ? C.red : C.green, 0.7, 0.7, -5.2 + i * 1.05, z); await growBar(tok, b, 0.08 + c * 0.22, 160);
        tag(ops[i] === '+' ? '插入' : '刪除', 'idx', -5.2 + i * 1.05, 0, z + 0.7);
        txt(ml, 'm = ' + m + '、總 ' + tot);
        await beat(tok, 260);
      }
    };
    say('n = 8 附近反覆插入、刪除', '上：n = m/2 就縮半；下：n = m/4 才縮半');
    await beat(tok, 2400);
    await run('half', -1.6, 'm/2 縮');
    say('n = m/2 就縮：8 ↔ 16 來回，每次 Θ(n)', 'thrashing');
    await beat(tok, 2400);
    await run('quarter', 1.6, 'm/4 縮');
    say('n = m/4 才縮成 m/2：縮完半滿', '要再插入 m/2 個才會再擴大');
    await beat(tok, 2800);
    say('維持 n ≤ m ≤ 4n → 空間線性、amortized O(1)', '刪除的門檻要比插入的門檻寬');
    await beat(tok, 3000);
  }

  // ─── 課本補充（CLRS 17.1–17.2）：binary counter 的 aggregate 與 accounting ───
  async function scBinaryCounter(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const K = 5, bits = [];
    for (let i = 0; i < K; i++) { bits.push({ v: 0, m: cube('0', GRAY, [1, 1, 1], 2.6 - i * 1.3, 4.6, 0) }); tag('A[' + i + ']', 'idx', 2.6 - i * 1.3, 3.8); }
    const tot = tag('總翻轉 0', 'ptr alt', 5.4, 5.2);
    const coins = [];
    say('k 位元計數器 INCREMENT：最壞一次翻 k 個', '那 n 次就是 O(nk) 嗎？');
    await beat(tok, 2600);
    let total = 0;
    for (let n = 1; n <= 16; n++) {
      let i = 0, f = 0;
      while (i < K && bits[i].v === 1) { bits[i].v = 0; relabel(bits[i].m, 0); tint(bits[i].m, GRAY); if (coins[i]) { fly(coins[i], V3(0, 5, 3)); coins[i] = null; } i++; f++; }
      if (i < K) { bits[i].v = 1; relabel(bits[i].m, 1); tint(bits[i].m, C.green); f++; coins[i] = cube('$1', C.gold, [0.5, 0.2, 0.5], 2.6 - i * 1.3, 5.25, 0, 1.5); }
      total += f; txt(tot, '總翻轉 ' + total);
      const b = bar(f > 2 ? C.red : C.blue, 0.5, 0.6, -5.6 + (n - 1) * 0.72, 2.4); setBar(b, f * 0.45);
      if (n <= 4 || n === 8 || n === 16) { say('第 ' + n + ' 次：翻 ' + f + ' 個位元', n === 1 ? 'Accounting：設 1 時付 $2，$1 付翻轉、$1 存在該位元上' : '把 1 清成 0 的費用由存款支付'); await beat(tok, 1500); }
      else await beat(tok, 450);
    }
    say('Aggregate：A[i] 每 2ⁱ 次才翻一次', '總翻轉 ≤ n(1 + 1/2 + 1/4 + …) < 2n');
    await beat(tok, 3000);
    say('16 次共翻 ' + total + ' 次 < 32 → 每次 amortized O(1)', '存款永遠 = 1 的個數 ≥ 0（potential 法：Φ = 1 的個數）');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'recipe-procedure': { title: '演算法的五個特性：用做菜程序類比', play: scRecipe },
    'algo-vs-program': { title: 'Algorithm vs Program：設計 vs 實作', play: scAlgoVsProgram },
    'priori-posteriori': { title: 'Priori analysis vs Posteriori testing', play: scPriori },
    'freq-sum': { title: 'Frequency count：陣列求和 2n + 3', play: scFreqSum },
    'freq-matrix': { title: '矩陣相加 2n² + 2n + 1、相乘 O(n³)', play: scFreqMatrix },
    'loop-variants': { title: 'i++、i−−、i += 2 都是 O(n)；巢狀 n²', play: scLoopVariants },
    'triangle-trace': { title: '內層 j < i：0 + 1 + … = n(n−1)/2', play: scTriangle },
    'p-plus-i': { title: 'p += i：k(k+1)/2 > n → O(√n)', play: scPPlusI },
    'doubling-ceil': { title: 'i *= 2：⌈log₂ n⌉ 次（n = 8 vs 10）', play: scDoubling },
    'halving-sqrt': { title: 'i /= 2 → log n；i·i < n → √n', play: scHalvingSqrt },
    'loglog-p': { title: '獨立迴圈 2n；p = log n 再 log p', play: scLogLog },
    'nlogn-nested': { title: '外層 n × 內層 log n = n log n', play: scNLogN },
    'loop-summary': { title: '迴圈複雜度總整理（n = 64）', play: scLoopSummary },
    'class-table': { title: '函數類別：log n、n、n²、2ⁿ 代值比較', play: scClassTable },
    'order-by-log': { title: '依成長率排序：取 log 比 n^(log n) 與 2ⁿ', play: scOrderByLog },
    'bigo-5n': { title: 'Big-O：2n + 3 ≤ 5n（也 ≤ 5n²）', play: scBigO5n },
    'bound-ladder': { title: '上界、下界與 Θ：類別階梯', play: scBoundLadder },
    'theta-sandwich': { title: 'Θ：1·n ≤ 2n + 3 ≤ 5n', play: scThetaSandwich },
    'trace-test3': { title: 'test(3) 的 tracing tree：呼叫 n + 1 次', play: scTraceTest3 },
    'back-sub-decreasing': { title: 'Back substitution：T(n) = T(n−1) + 1', play: scBackSubDec },
    'master-decreasing': { title: '遞減型 Master Theorem：a 跟 1 比', play: scMasterDec },
    'tree-2t-half': { title: '遞迴樹 T(n) = 2T(n/2) + n：每層 n', play: scTree2Half },
    'back-sub-dividing': { title: 'Back substitution：2ᵏT(n/2ᵏ) + kn', play: scBackSubDiv },
    'master-dividing': { title: '課本：Master Theorem 三種情況與 gap（CLRS）', play: scMasterDiv },
    'substitution-induction': { title: '課本：Substitution method（猜 + 歸納）', play: scSubstitution },
    'tree-uneven': { title: '課本：不平均遞迴樹 T(n/3) + T(2n/3) + cn', play: scTreeUneven },
    'tree-sqrt': { title: 'T(n) = T(√n) + 1 → Θ(log log n)', play: scTreeSqrt },
    'change-variable': { title: '課本：換變數 T(n) = 2T(√n) + lg n', play: scChangeVar },
    'coin-decision-tree': { title: '假硬幣：決策樹下界 log₃ N', play: scCoin },
    'kth-two-lists': { title: '兩個已排序陣列找第 k 小：O(log k)', play: scKthTwo },
    'table-doubling': { title: 'Table doubling vs m + 1：攤銷 O(1)', play: scTableDoubling },
    'shrink-quarter': { title: '縮表要在 n = m/4：避免來回抖動', play: scShrinkQuarter },
    'binary-counter': { title: '課本：Binary counter 的攤銷分析', play: scBinaryCounter },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 1 章',
    title: '複雜度與遞迴',
    color: 'var(--alg)',
    modes: [
      { id: 'loops', name: '迴圈計數器', enter: () => { clearLog(); enterLoops(); } },
      { id: 'bounds', name: 'O / Ω / Θ 夾擠', enter: enterBounds },
      { id: 'rtree', name: '遞迴樹', enter: enterRTree },
      { id: 'master', name: 'Master Theorem', enter: enterMaster },
      { id: 'amort', name: '攤銷分析', enter: enterAmort },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'recipe-procedure', 'algo-vs-program', 'priori-posteriori',
      'freq-sum', 'freq-matrix', 'loop-variants', 'triangle-trace', 'p-plus-i', 'doubling-ceil', 'halving-sqrt', 'loglog-p', 'nlogn-nested', 'loop-summary',
      'class-table', 'order-by-log', 'bigo-5n', 'bound-ladder', 'theta-sandwich',
      'trace-test3', 'back-sub-decreasing', 'master-decreasing', 'tree-2t-half', 'back-sub-dividing', 'master-dividing', 'substitution-induction', 'tree-uneven', 'tree-sqrt', 'change-variable',
      'coin-decision-tree', 'kth-two-lists',
      'table-doubling', 'shrink-quarter', 'binary-counter',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
