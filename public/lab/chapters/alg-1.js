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
  // ═══ algbari1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove, zone } = K;
// ─── Abdul Bari 1.1 / 1.4 / 1.5.x / 1.6 / 1.7 / 1.8.1 與 交大江蕙如 Lec05（Chapter 2 (2/2)）───
// Abdul Bari 的場景是「跟著講者走」的 cued scene：每個 await step(tok) 等講者說到那一句才動。
// 老師自己的例子：矩陣 n = 3；while (i < n) 的 n = 10；GCD (6,3)、(5,5)、(16,2)；log 取 ceil 的 n = 8、10；
// 代值 n = 1、2、4、8、9；2n + 3 ≤ 10n、5n、5n²，≥ 1·n。
// 老師沒給數字的地方（陣列內容、n = 40、n = 25…）用「示意」數字並在畫面上標明。
// Gale-Shapley：ManPref 1:[1,2,3] 2:[2,1,3] 3:[1,2,3]、Current = [1,3,0]、
// WomanPref[1] = 3 1 4 5 6 2、未婚夫 m6 排第 5、m1 排第 2；取 log 比 n^(1/3)、lg n、2^√(lg n)。
const AB = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', red: '#d64545', teal: '#31aab0', gold: '#c08a1f', sand: '#c9b48e', pink: '#e55a9b' };
function abBar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0.0005, z); lab.world.add(m); return m; }
function abSet(m, h) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = v / 2; }
async function abGrow(tok, m, h, ms) { const h0 = m.scale.y; await anim(tok, ms, (t) => abSet(m, h0 + (h - h0) * t)); }
const AB_GS = [
  '1 Initialize all m, w to be free',
  "2 while (∃ free m who hasn't proposed to all)",
  "3   w = highest-ranked woman m hasn't proposed to",
  '4   if (w is free)',
  '5     (m, w) become engaged',
  '6   else if (w prefers m to her fiancé m′)',
  '7     (m, w) engaged, m′ becomes free',
  '8   else w rejects m',
  '9 return the set S of engaged pairs',
];
// friendly labels: a speech bubble, a sticky note, a ✓ / ✗ verdict
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const okT = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const abRange = (a, b, s) => { const o = []; for (let i = a; s > 0 ? i < b : i > b; i += s) o.push(i); return o; };

// ═══ -JTq1BFBwmo：1.1 Priori analysis / Posteriori testing ═══
FRAG.push(['algbari1-priori', 'Priori analysis vs Posteriori testing', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.2, 0]);
  zone('Priori analysis：對「演算法」', -3.3, 0, 0, 5.8, 4.8, '#dfe9f5');
  zone('Posteriori testing：對「程式」', 3.3, 0, 0, 5.8, 4.8, '#f3e3cf');
  say('兩個名詞：一個用在演算法，一個用在程式', '');
  await step(tok);                                   // 9.7 pre-analysis is done over the algorithm
  const alg = prop('file', -4.8, 0.05, -1, 1.1, '演算法（步驟）'); bob(alg, 0.05);
  const me = buddy('分析的人', '', AB.blue, -2.4, 0, -0.8, 0.8); me.look(-1);
  const q = bub('它是怎麼運作的？', -2.4, 2.1, -0.8);
  say('Priori analysis：仔細研究演算法怎麼運作', '靠「想」和「算」，不用執行');
  await step(tok);                                   // 18.8 results: time and space consumed
  remove(q);
  const ft = cube('時間', AB.green, [1.8, 0.55, 0.9], -4.4, 0.28, 1.3, 3);
  const sp = cube('空間', AB.teal, [1.8, 0.55, 0.9], -2.3, 0.28, 1.3, 3);
  me.mood('happy');
  say('分析的結果：演算法要花多少時間、多少空間', '');
  await step(tok);                                   // 29.4 testing is done on the program
  prop('monitor', 2.2, 0.05, -1, 0.9, '把程式跑起來');
  const pg = note('程式.c', 5.6, 0.6, -1);
  await travel(tok, pg, V3(5.6, 0.6, -1), V3(2.2, 1.0, -0.6), 900);
  say('Posteriori testing：把「程式」實際執行來檢查', '');
  await step(tok);                                   // 34.4 watch time: seconds, milliseconds
  const clk = pkt('⏱ 0.0 ms', 1.8, 0.4, 1.0);
  say('量到的是「牆鐘時間」：花了幾秒、幾毫秒', '');
  await anim(tok, 1500, (u) => txt(clk, '⏱ ' + (3.2 * u).toFixed(1) + ' ms'));
  await step(tok);                                   // 42.8 memory in bytes
  pkt('💾 4 096 bytes', 1.8, 0.4, 2.0);
  say('還有佔了多少記憶體（幾個 bytes）', '');
  await step(tok);                                   // 54.8 algorithms: language / hardware independent
  okT('不綁程式語言 ✓', -4.4, 0.2, 2.4); okT('不綁硬體 ✓', -2.2, 0.2, 2.4);
  await me.hop(tok);
  say('演算法不是用某種語言寫的，也不為某台機器而寫', 'language independent、hardware independent');
  await step(tok);                                   // 71.8 programs depend on hardware, language, OS
  prop('monitor', 4.8, 0.05, -1, 0.7, '另一台電腦');
  pkt('⏱ 5.1 ms', 4.8, 0.4, 1.0);
  noT('程式：依賴硬體、語言、OS、環境', 3.4, 3.2, -1);
  say('程式就不同：換硬體、語言、作業系統，結果就變', '同一個程式，這台 3.2 ms、那台 5.1 ms');
  await step(tok);                                   // 91.8 not watch time: time function, space function
  relabel(ft, 'time function'); relabel(sp, 'space function'); glow(ft, GOLD); glow(sp, GOLD);
  txt(clk, '✗ 不是幾分幾秒');
  me.mood('happy'); await me.hop(tok);
  say('Priori analysis 得到的不是「3 分鐘、5 秒」', '而是 time function 和 space function');
}]);

// ═══ 1U3Uwct45IY：1.4 Frequency count ═══
const AB_A = [8, 3, 9, 7, 2];
// part 'trace'：數條件檢查幾次；part 'func'：本體、return、時間與空間函數
FRAG.push(['algbari1-freq-sum', 'Frequency count：陣列求和 2n + 3', async (tok) => {
  const part = (ctx.params || {}).part || 'trace';
  fresh([0, 6.5, 14], [0, 2.4, 0]);
  const L = ['Algorithm Sum(A, n)', '{', '  s = 0;', '  for (i = 0; i < n; i++)', '    s = s + A[i];', '  return s;', '}'];
  const xs = (k) => -5 + k * 1.2;
  const fq = {}; [2, 3, 4, 5].forEach((r) => { fq[r] = tag('', 'ptr alt', 0.4, 6.8 - r * 0.5); });
  const stk = { 3: [], 4: [] }, SX = { 3: 3.0, 4: 4.4 };
  const push = (ln, col) => { stk[ln].push(cube('', col, [1, 0.3, 1], SX[ln], 0.15 + stk[ln].length * 0.34, 0, 2.5)); };
  let cd = null, cs = [];
  const showCode = () => { cd = code(L, -3.4, 6.8, 0.5); tag('條件 i < n', 'idx', SX[3], 0, 1.2); tag('迴圈本體', 'idx', SX[4], 0, 1.2); };
  const showArr = (drop) => { cs = AB_A.map((v, k) => { tag('A[' + k + ']', 'idx', xs(k), 0, 0.95); return cube(v, AB.blue, [1, 0.7, 1], xs(k), 0.35, 0, drop ? 3 : 0); }); tag('n = 5（內容是示意）', 'ptr', -2.6, 1.6, -1); };
  if (part === 'trace') {
    say('Frequency count method', '先看一個例子：陣列求和');
    await step(tok);                                 // 12.8 algorithm for the sum of all elements
    showCode();
    say('Sum：把陣列 A 的所有元素加起來', '');
    await step(tok);                                 // 19.8 an array of size five
    showArr(true);
    say('A 是大小 n = 5 的陣列，裡面放一些數字', '');
    await step(tok);                                 // 55.8 one unit of time for each statement
    const clerk = buddy('計時員', 0, AB.gold, 6.0, 0, -1.6, 0.75); clerk.look(-1);
    const bb = bub('每行做一次 = 1 單位時間', 6.0, 2.1, -1.6);
    say('每個敘述執行一次，就算 1 單位時間', '重複的敘述，就數它執行幾次（frequency）');
    await step(tok);                                 // 78.8 a repeating statement → find its frequency
    cd.hl(4); txt(bb, '這行會重複！數它做幾次'); clerk.mood('wow');
    say('這行在迴圈裡，會重複好幾次', '數出次數，就知道花了多少時間');
    await step(tok);                                 // 92.8 s = 0: one unit
    cd.hl(2); txt(fq[2], '1'); txt(bb, 's = 0：1 次'); clerk.set(1); clerk.mood('happy');
    say('s = 0 是簡單敘述：1 單位時間', '');
    await step(tok);                                 // 107.8 condition checked n + 1 times
    cd.hl(3); txt(fq[3], '? 次'); txt(bb, '條件 i < n 檢查幾次？'); clerk.mood('calm');
    const ip = pkt('i', xs(0), 1.6, 0);
    say('for 的條件會被檢查 n + 1 次', '用 n = 5 追蹤看看');
    await step(tok);                                 // 115.8 i = 0, 1, 2 < 5
    for (let i = 0; i < 3; i++) { ip.position.set(xs(i), 1.6, 0); txt(ip, 'i = ' + i); push(3, AB.purple); txt(fq[3], stk[3].length + ' 次'); clerk.set(stk[3].length); await beat(tok, 550); }
    say('i = 0、1、2：都 < 5，條件成立', '條件已檢查 3 次');
    await step(tok);                                 // 133.8 3, 4 < 5; 5 is not → stop
    for (let i = 3; i <= 5; i++) { ip.position.set(xs(i), 1.6, 0); txt(ip, 'i = ' + i); push(3, i < 5 ? AB.purple : AB.red); txt(fq[3], stk[3].length + ' 次'); clerk.set(stk[3].length); await beat(tok, 550); }
    glow(stk[3][5], RED); clerk.mood('wow');
    say('i = 3、4 成立；i = 5 時 5 < 5 不成立 → 停', '');
    await step(tok);                                 // 142.8 six times = 5 + 1
    txt(fq[3], 'n + 1'); txt(bb, '成立 5 次 + 不成立 1 次 = 6'); clerk.mood('happy'); await clerk.hop(tok);
    say('條件檢查了 6 次 = 5 + 1 = n + 1', '成立 n 次，最後 1 次不成立才離開');
    await step(tok);                                 // 163.8 2n + 2 in detail, but we write n + 1
    note('細算 i = 0、i++ → 2n + 2', 4.2, 3.6, -1);
    say('連 i = 0、i++ 都算，會是 2n + 2', '但只在乎跟 n 有關的部分 → 習慣寫 n + 1');
    return;
  }
  // part 'func'：條件已經數好了，接著數本體和 return
  showCode(); showArr(false);
  txt(fq[2], '1'); txt(fq[3], 'n + 1');
  for (let i = 0; i <= 5; i++) push(3, i < 5 ? AB.purple : AB.red);
  say('條件 n + 1 次已經數好；接著看迴圈本體', '');
  await step(tok);                                   // 200.8 the statement inside the loop: n times
  cd.hl(4); let s = 0;
  const sv = buddy('s', 0, AB.orange, 6.0, 0, -1.4, 0.7);
  for (let i = 0; i < 5; i++) { s += AB_A[i]; glow(cs[i], GOLD); push(4, AB.blue); txt(fq[4], stk[4].length + ' 次'); sv.set(s); await beat(tok, 420); glow(cs[i], null); }
  txt(fq[4], 'n'); sv.mood('happy');
  say('迴圈裡的 s = s + A[i] 跟著迴圈做 n 次', '');
  await step(tok);                                   // 222.8 the loop n + 1, the last statement once
  cd.hl(5); txt(fq[5], '1');
  say('迴圈本身 n + 1 次；最後的 return 做 1 次', '');
  await step(tok);                                   // 228.8 f(n) = 2n + 3
  cd.hl(-1);
  const fx = tag('f(n) = 1 + (n + 1) + n + 1 = 2n + 3', 'ptr', -1.6, 2.8, 2.4);
  say('全部加起來：時間函數 f(n) = 2n + 3', '');
  await step(tok);                                   // 242.8 degree one → order of n
  txt(fx, 'f(n) = 2n + 3 → 次數 1 → O(n)'); glow(cs[2], null);
  say('多項式的最高次數是 1 → 時間是 order of n', 'O(n)');
  await step(tok);                                   // 258.8 not saying Big-O or Theta yet
  note('先說 order；Big-O、Θ 之後再學', -1.6, 2.1, 2.4);
  say('這裡只說 order of n', 'Big-O、Θ 的正式定義後面的影片才講');
  await step(tok);                                   // 264.8 space: the variables used
  cs.forEach((m) => glow(m, GOLD));
  buddy('n', 5, AB.teal, 4.8, 0, 2.2, 0.6); buddy('i', 5, AB.teal, 6.0, 0, 2.2, 0.6);
  say('空間：用到哪些變數？A、n、s、i', '');
  await step(tok);                                   // 282.8 A is n words, the others one word each
  tag('A：n 個 word', 'ptr alt', -2.6, 1.0, 1.6);
  note('n、s、i：各 1 個 word', 5.4, 1.6, 3.0);
  say('A 有 n 格 → n 個 word；n、s、i 各 1 個 word', '合起來 n + 3');
  await step(tok);                                   // 291.8 S(n) = n + 3 → O(n)
  okT('S(n) = n + 3 → O(n)', -1.6, 1.4, 2.4);
  sv.mood('happy'); await sv.hop(tok);
  say('空間 S(n) = n + 3 → 也是 O(n)', '時間 O(n)、空間 O(n)');
}]);

FRAG.push(['algbari1-mat-add', '矩陣相加：f(n) = 2n² + 2n + 1', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.4, 0]);
  const n = 3;
  const grid = (x0, col, lbl) => { const ms = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ms.push(cube('', col, [0.7, 0.12, 0.7], x0 + j * 0.8, 0.06, 0.6 + i * 0.8, 2)); tag(lbl, 'ptr', x0 + 0.8, 0.2, -0.3); return ms; };
  say('下一個：兩個矩陣相加', '');
  await step(tok);                                   // 316.8 n×n square matrices, e.g. 3×3
  const GA = grid(-5.8, AB.blue, 'A（n = 3）'); tag('+', 'ptr alt', -3.1, 0.3, 1.4);
  const GB = grid(-2.4, AB.orange, 'B'); tag('=', 'ptr alt', 0.3, 0.3, 1.4);
  const GC = grid(1.0, GRAY, 'C');
  say('A、B 都是 n×n 的方陣，例如 3×3', '就是二維陣列');
  await step(tok);                                   // 339.8 the algorithm
  const cd = code(['Algorithm Add(A, B, n)', '{', '  for (i = 0; i < n; i++)', '    for (j = 0; j < n; j++)', '      C[i][j] = A[i][j] + B[i][j];', '}'], -1.4, 7, 0.5);
  const fq = [2, 3, 4].map((r) => tag('', 'ptr alt', 4.6, 7 - r * 0.5));
  const cnt = buddy('加法次數', 0, AB.gold, 5.6, 0, 1.0, 0.7);
  say('相加的演算法：兩層 for', '來數每一行做幾次');
  await step(tok);                                   // 346.8 outer for: n + 1
  cd.hl(2); txt(fq[0], 'n + 1');
  say('外層 for：條件 n + 1 次', '');
  await step(tok);                                   // 355.8 everything inside: n times
  const ins = note('裡面每一行 × n', 4.6, 6.0, -1);
  say('外層迴圈裡面的每一行，都會跑 n 次', '');
  await step(tok);                                   // 370.8 inner for: n(n + 1)
  cd.hl(3); txt(fq[1], 'n(n + 1)'); remove(ins);
  say('內層 for 本身也是迴圈：每次 n + 1', '被外層帶著跑 n 次 → n(n + 1)');
  await step(tok);                                   // 378.8 the addition: n × n
  cd.hl(4);
  for (let k = 0; k < n * n; k++) { tint(GC[k], AB.green); glow(GA[k], GOLD); glow(GB[k], GOLD); cnt.set(k + 1); txt(fq[2], (k + 1) + ' 次'); await beat(tok, 200); glow(GA[k], null); glow(GB[k], null); }
  txt(fq[2], 'n × n = n²'); cnt.mood('happy');
  say('C[i][j] = A[i][j] + B[i][j] 在兩層迴圈裡', 'n × n = 9 次');
  await step(tok);                                   // 385.8 f(n) = 2n² + 2n + 1
  cd.hl(-1);
  const fx = tag('f(n) = (n+1) + n(n+1) + n² = 2n² + 2n + 1', 'ptr', 1.2, 3.6, -1);
  say('時間函數 f(n) = 2n² + 2n + 1', '');
  await step(tok);                                   // 403.8 highest degree 2 → O(n²)
  okT('最高次數 2 → O(n²)', 1.2, 3.0, -1);
  await cnt.hop(tok);
  say('最高次數是 2 → O(n²)', '');
  await step(tok);                                   // 419.8 not "equal to"; just the degree
  note('O(n²)：寫的是次數，不是說 f(n) 等於 n²', 1.2, 2.4, -1);
  say('O(n²) 不是說 f(n) 等於 n²', '只是說這個多項式的次數是 2');
  await step(tok);                                   // 430.8 space: A, B, C, i, j
  [...GA, ...GB, ...GC].forEach((m) => glow(m, GOLD));
  say('空間：用到 A、B、C 和 n、i、j', '');
  await step(tok);                                   // 454.8 A, B, C are matrices: n² each
  [-5.0, -1.6, 1.8].forEach((x) => tag('n² 個 word', 'idx', x, 0.1, 3.1));
  say('A、B、C 是矩陣，各佔 n² 個 word', '');
  await step(tok);                                   // 464.8 n, i, j scalars → 3n² + 3
  ['n', 'i', 'j'].forEach((v, k) => buddy(v, '', AB.teal, 3.9 + k * 1.0, 0, 3.0, 0.5));
  tag('S(n) = 3n² + 3', 'ptr', 5.0, 2.0, 3.0);
  say('n、i、j 是一般變數，各 1 個 word', 'S(n) = 3n² + 3');
  await step(tok);                                   // 485.8 degree → space O(n²)
  okT('空間 O(n²)、時間 O(n²)', 5.0, 2.6, 3.0);
  cnt.mood('happy'); await cnt.hop(tok);
  say('空間也是 O(n²)', '這個演算法：時間 O(n²)、空間 O(n²)');
}]);

FRAG.push(['algbari1-mat-mul', '矩陣相乘：f(n) = 2n³ + 3n² + 2n + 1', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  const n = 3, cell = (i, j) => [-3.4 + j * 1.1, 0.6 + i * 1.0];
  const tiles = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = cell(i, j); tiles.push(cube('', GRAY, [0.9, 0.08, 0.8], x, 0.04, z)); }
  tag('C（n = 3）', 'ptr', -2.3, 0.2, -0.3);
  say('下一個：兩個矩陣相乘', '');
  await step(tok);                                   // 515.8 three nested loops
  const cd = code(['for (i = 0; i < n; i++)', '{', '  for (j = 0; j < n; j++)', '  {', '    C[i][j] = 0;', '    for (k = 0; k < n; k++)', '      C[i][j] += A[i][k] * B[k][j];', '  }', '}'], -2.2, 7.6, 0.46);
  const fq = {}; [0, 2, 4, 5, 6].forEach((r) => { fq[r] = tag('', 'ptr alt', 3.4, 7.6 - r * 0.46); });
  const cnt = buddy('乘法次數', 0, AB.gold, 4.6, 0, 1.4, 0.7);
  say('三層迴圈，一層包一層', '一樣一行一行數');
  await step(tok);                                   // 534.8 n + 1
  cd.hl(0); txt(fq[0], 'n + 1');
  say('外層 for：n + 1 次', '');
  await step(tok);                                   // 540.8 everything inside: n times
  const ins = note('裡面每一行 × n', 5.6, 6.6, -1);
  say('外層裡面的每一行，都跑 n 次', '');
  await step(tok);                                   // 553.8 again a loop: n(n + 1)
  cd.hl(2); txt(fq[2], 'n(n + 1)');
  say('第二層 for：n + 1，再乘 n → n(n + 1)', '');
  await step(tok);                                   // 565.8 inside it: n × n
  txt(ins, '再裡面 × n × n');
  say('第二層裡面的每一行：n × n 次', '');
  await step(tok);                                   // 576.8 the third loop: n²(n + 1)
  cd.hl(5); txt(fq[5], 'n²(n + 1)');
  say('第三層 for：n + 1，再乘 n² → n²(n + 1)', '');
  await step(tok);                                   // 587.8 the statement inside all 3 loops: n³
  cd.hl(6); remove(ins);
  let c = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = cell(i, j); for (let k = 0; k < n; k++) { cube('', AB.purple, [0.75, 0.3, 0.65], x, 0.23 + k * 0.34, z, 2); c++; cnt.set(c); txt(fq[6], c + ' 次'); await beat(tok, 70); } }
  txt(fq[6], 'n³'); cnt.mood('wow');
  say('最內層的乘加在三層迴圈裡', 'n × n × n = 27 次 = n³');
  await step(tok);                                   // 602.8 C[i][j] = 0: inside two loops → n²
  cd.hl(4); txt(fq[4], 'n²'); tiles.forEach((m) => glow(m, GOLD));
  say('C[i][j] = 0 只在前兩層裡 → n² 次', '');
  await step(tok);                                   // 614.8 f(n)
  cd.hl(-1); tiles.forEach((m) => glow(m, null));
  tag('f(n) = 2n³ + 3n² + 2n + 1', 'ptr', 4.4, 3.4, -1);
  say('全部加起來：f(n) = 2n³ + 3n² + 2n + 1', '');
  await step(tok);                                   // 645.8 degree 3 → O(n³)
  okT('次數 3 → 時間 O(n³)', 4.4, 2.8, -1); await cnt.hop(tok);
  say('最高次數 3 → 時間 O(n³)', '');
  await step(tok);                                   // 662.8 space: A, B, C, i, j, k
  ['A', 'B', 'C'].forEach((v, k) => cube(v + '：n²', AB.blue, [1.3, 0.5, 0.8], -5.6 + k * 1.45, 0.25, 4.0, 3));
  ['n', 'i', 'j', 'k'].forEach((v, k) => buddy(v, '', AB.teal, -0.6 + k * 0.85, 0, 4.0, 0.45));
  say('空間：A、B、C 三個矩陣，加上 n、i、j、k', '');
  await step(tok);                                   // 683.8 3n² + 4 → O(n²)
  tag('S(n) = 3n² + 4 → O(n²)', 'ptr', -2.2, 1.5, 4.0);
  say('矩陣各 n²，變數各 1 → S(n) = 3n² + 4', '空間 O(n²)');
  await step(tok);                                   // 693.8 time O(n³), space O(n²)
  note('時間 O(n³) ≠ 空間 O(n²)：要分開算', 4.4, 2.2, -1);
  say('時間是 O(n³)，空間只有 O(n²)', '時間和空間要分開分析');
  await step(tok);                                   // 723.8 three algorithms: n, n², n³
  [['O(n)', 0.5], ['O(n²)', 1.3], ['O(n³)', 2.4]].forEach(([s, h], k) => { const b = abBar([AB.green, AB.orange, AB.purple][k], 0.8, 0.8, 4.6 + k * 1.0, 4.0); abSet(b, h); tag(s, 'idx', 4.6 + k * 1.0, h + 0.3, 4.0); });
  tag('求和、相加、相乘', 'ptr alt', 5.6, 3.2, 4.0);
  say('三個演算法：O(n)、O(n²)、O(n³)', '花的時間各不相同');
}]);

// ═══ 9TlHvipP5yA：1.5.1 Time Complexity #1 ═══
FRAG.push(['algbari1-loop-variants', 'i++、i--、i += 2 都是 O(n)；巢狀 n²', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const n = 40, Z = (r) => -2.6 + r * 1.5, X = (k) => -4.9 + k * 0.26;
  let cd = null;
  const show = (lines, x = -2.2, y = 7.2) => { if (cd) cd.kill(); cd = code(lines, x, y, 0.5); };
  const row = async (r, qs, col, ms = 1500) => { const per = ms / qs.length; for (const q of qs) { cube('', col, [0.22, 0.3, 0.6], X(q), 0.15, Z(r), 2); await beat(tok, per); } };
  const name = (r, t) => tag(t, 'ptr', -6.3, 0.2, Z(r));
  const cntT = (r, t) => tag(t, 'ptr alt', 6.3, 0.3, Z(r));
  say('看幾段程式碼，找出時間複雜度', '');
  await step(tok);                                   // 7.8 a simple loop with one statement
  show(['for (i = 0; i < n; i++)', '  stmt;']); name(0, 'i++');
  say('一個簡單的迴圈，裡面一個敘述', '');
  await step(tok);                                   // 15.8 n + 1 and n
  const f0 = tag('n + 1', 'ptr alt', 1.8, 7.2), f1 = tag('n', 'ptr alt', 1.8, 6.7);
  say('條件 n + 1 次，stmt n 次', '前一支影片算過');
  await step(tok);                                   // 20.8 n + 1 does not change the degree
  txt(f0, 'n + 1（不影響次數）');
  note('只要數 stmt 做幾次就好', 4.2, 5.8, 0);
  say('寫 order 只看最高次數，n + 1 和 n 一樣', '所以只要知道 stmt 做了幾次');
  await step(tok);                                   // 35.4 → O(n)
  await row(0, abRange(0, n, 1), AB.blue); cntT(0, '40 次 → O(n)');
  say('stmt 做 n 次 → O(n)', '這裡 n = 40（示意），一顆 = stmt 一次');
  await step(tok);                                   // 47.6 starting from n, decrementing
  show(['for (i = n; i > 0; i--)', '  stmt;']); name(1, 'i--');
  await row(1, abRange(n - 1, -1, -1), AB.purple); cntT(1, '40 次 → O(n)');
  say('從 n 往下減的迴圈：一樣 n 次', '');
  await step(tok);                                   // 69.9 1 → 10 or 10 → 1: same steps
  const wa = pkt('1 → 10', X(0), 0.9, Z(0)), wb = pkt('10 → 1', X(39), 0.9, Z(1));
  await anim(tok, 1600, (u) => { wa.position.x = X(0) + u * (X(39) - X(0)); wb.position.x = X(39) - u * (X(39) - X(0)); });
  say('1 走到 10、10 走回 1：都是 10 步', '遞增、遞減，次數一樣');
  await step(tok);                                   // 82.8 from 1, i += 2
  show(['for (i = 1; i < n; i += 2)', '  stmt;']); name(2, 'i += 2'); remove(wa); remove(wb);
  say('i 每次加 2', '');
  await step(tok);                                   // 96.2 n/2 times
  await row(2, abRange(0, n, 2), AB.green); const c2 = cntT(2, '20 次 = n/2');
  say('只跑一半：n/2 次', '每次跳兩格');
  await step(tok);                                   // 104.8 n/2: degree is 1 → O(n)
  txt(c2, 'n/2 → O(n)');
  say('n/2 的次數還是 1 → O(n)', 'O 不寫係數');
  await step(tok);                                   // 120.4 i += 20: still O(n)
  show(['for (i = 1; i < n; i += 20)', '  stmt;']); name(3, 'i += 20');
  await row(3, [0, 20], AB.orange, 600); cntT(3, 'n/20 → O(n)');
  say('每次加 20 也一樣：n/20 → O(n)', '加多少都不改變次數');
  await step(tok);                                   // 139.8 two nested loops
  fresh([0, 7, 12], [0, 1, 0]); cd = null;
  show(['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    stmt;'], -2.6, 6.4);
  tag('n = 6（示意）', 'ptr', 3.6, 0.2, -3.4);
  say('兩層 for，一層包一層', '');
  await step(tok);                                   // 145.8 n times, and n times inside
  for (let i = 0; i < 6; i++) { tag('i=' + i, 'idx', -3.8, 0.2, -2.5 + i); for (let j = 0; j < 6; j++) { cube('', AB.blue, [0.7, 0.4, 0.7], -2.5 + j, 0.2, -2.5 + i, 3); await beat(tok, 50); } }
  say('外層 n 次，每次內層又 n 次', '');
  await step(tok);                                   // 155.8 → O(n²)
  okT('6 × 6 = 36 = n² → O(n²)', 3.6, 1.4, 0);
  say('n × n = n² → O(n²)', '');
}]);

FRAG.push(['algbari1-triangle', '內層 j < i：1 + 2 + … + n → O(n²)', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  const n = 6, Z = (i) => -2.5 + i * 0.9;
  const cd = code(['for (i = 0; i < n; i++)', '  for (j = 0; j < i; j++)', '    stmt;'], -3.2, 6.6, 0.5);
  const tot = buddy('stmt 累計', 0, AB.gold, 5.4, 0, -1.4, 0.75);
  say('又是兩層 for……', '');
  await step(tok);                                   // 172.9 but j < i
  cd.hl(1); const hint = bub('內層是 j < i，不是 j < n！', 2.8, 6.0, 0); tot.mood('wow');
  say('看起來很像，但內層條件是 j < i', '');
  await step(tok);                                   // 183.8 trace i and j
  remove(hint);
  tag('i', 'ptr', -5.6, 0.2, -3.4); tag('j 跑過的值', 'ptr', -2.2, 0.2, -3.4); tag('stmt 次數', 'ptr', 1.6, 0.2, -3.4);
  say('用追蹤表：一列一個 i，看 j 跑幾次', 'n = 6（示意）');
  let sum = 0;
  const rowI = async (i, ms) => {
    tag('i = ' + i, 'ptr', -5.6, 0.2, Z(i));
    for (let j = 0; j < i; j++) { cube('j=' + j, AB.blue, [0.85, 0.35, 0.7], -4.2 + j * 0.95, 0.18, Z(i), 3); sum++; tot.set(sum); await beat(tok, ms); }
    tag(i + ' 次', 'idx', 1.6, 0.2, Z(i));
  };
  await step(tok);                                   // 197.3 i = 0: 0 < 0 no → 0 times
  await rowI(0, 0); tot.mood('calm');
  say('i = 0：0 < 0 不成立，stmt 一次也沒做', '0 次');
  await step(tok);                                   // 219.9 i = 1: j = 0 → once
  await rowI(1, 300);
  say('i = 1：j = 0 成立，j = 1 不成立', '1 次');
  await step(tok);                                   // 242 i = 2: j = 0, 1
  await rowI(2, 300);
  say('i = 2：j = 0、1', '2 次');
  await step(tok);                                   // 255.3 i = 3: j = 0, 1, 2
  await rowI(3, 300);
  say('i = 3：j = 0、1、2', '3 次');
  await step(tok);                                   // 267.8 0, 1, 2, 3 … so on up to n
  await rowI(4, 120); await rowI(5, 120); tot.mood('happy');
  say('i 多 1，stmt 就多做 1 次……一直到 n', '0、1、2、3、4、5');
  await step(tok);                                   // 307.6 1 + 2 + … + n = n(n + 1)/2
  tag('1 + 2 + … + n = n(n + 1)/2', 'ptr alt', 3.6, 3.4, -1);
  say('總共 1 + 2 + 3 + … + n = n(n + 1)/2', '（精確是 0 + 1 + … + (n−1)，這裡 = 15）');
  await step(tok);                                   // 321.5 degree 2 → O(n²)
  okT('f(n) = (n² + n)/2 → O(n²)', 3.6, 2.8, -1); await tot.hop(tok);
  say('展開是 (n² + n)/2，最高次數 2', 'O(n²)');
  await step(tok);                                   // 337.7 not the same as n×n, still n²
  const gb = ghostBox(AB.blue, 5.9, 0.5, 5.6); gb.position.set(-1.8, 0.25, -0.25);
  note('n × n 的一半左右，但一樣是 n²', -1.8, 1.4, 2.6);
  say('跟上一題 n × n 不一樣，只有一半', '但次數一樣是 2 → O(n²)');
}]);

FRAG.push(['algbari1-p-plus-i', 'p = p + i：k(k+1)/2 > n → O(√n)', async (tok) => {
  fresh([0, 5, 14], [0, 3.4, 0]);
  const n = 25, SY = 0.2, BX = (k) => -5 + (k - 1) * 1.3;
  say('下一段：條件換了', '');
  await step(tok);                                   // 354.8 the condition is p <= n, not i <= n
  const cd = code(['p = 0;', 'for (i = 1; p <= n; i++)', '  p = p + i;'], -3.4, 7.8, 0.5);
  cd.hl(1);
  const hint = bub('條件看的是 p，不是 i！', 2.6, 7.6, 0);
  say('條件是 p <= n，不是 i <= n', '所以不會剛好跑 n 次');
  await step(tok);                                   // 364.8 every time i is added to p
  cd.hl(2); remove(hint);
  const pb = buddy('p', 0, AB.orange, 5.0, 0, 2.2, 0.7), ib = buddy('i', 1, AB.blue, 6.3, 0, 2.2, 0.7);
  say('每一圈都把 i 加進 p，i 也一直變大', '跑幾次？還不知道');
  await step(tok);                                   // 374.9 trace i and p
  pkt('追蹤 i、p', -5.6, 0.3, 1.8);
  say('來追蹤 i 和 p 的值', '');
  let p = 0, k = 0;
  const one = async () => { k++; p += k; const b = abBar(p > n ? AB.red : AB.blue, 1, 1, BX(k), 0); await abGrow(tok, b, p * SY, 380); tag('p=' + p, 'idx', BX(k), p * SY + 0.35); tag('i=' + k, 'idx', BX(k), 0, 0.9); pb.set(p); ib.set(k + 1); return b; };
  await step(tok);                                   // 385.8 1, then 1 + 2 = 3
  await one(); await one();
  say('第 1 圈 p = 1；第 2 圈 p = 1 + 2 = 3', '');
  await step(tok);                                   // 395 1 + 2 + 3, 1 + 2 + 3 + 4 …
  await one(); await one();
  say('接著 p = 1 + 2 + 3 = 6、1 + 2 + 3 + 4 = 10', '一直加下去');
  await step(tok);                                   // 409.8 k times: 1 + 2 + … + k
  tag('跑 k 次：p = 1 + 2 + … + k', 'ptr alt', 1.6, 4.6, -1);
  say('假設跑了 k 次，p = 1 + 2 + … + k', '');
  await step(tok);                                   // 440 stops when p > n
  const wall = lab.box(AB.red, [10.5, 0.05, 0.05]); wall.position.set(-0.4, n * SY, 0); lab.world.add(wall);
  tag('n = 25（示意）', 'ptr alt', 5.6, n * SY + 0.3);
  await one(); await one(); const last = await one(); glow(last, RED); pb.mood('wow');
  say('p 一超過 n 就停', 'p = 28 > 25 → 停');
  await step(tok);                                   // 465.5 p = k(k + 1)/2
  tag('p = k(k + 1)/2', 'ptr', 1.6, 6.2, -1);
  say('1 + 2 + … + k = k(k + 1)/2', '');
  await step(tok);                                   // 477.7 k(k + 1)/2 > n
  tag('停：k(k + 1)/2 > n', 'ptr alt', 1.6, 6.8, -1);
  say('停止條件：k(k + 1)/2 > n', '');
  await step(tok);                                   // 490 k² ≈ n → k ≈ √n
  okT('k² ≈ n → k ≈ √n → O(√n)', 1.6, 7.4, -1); pb.mood('happy'); await pb.hop(tok);
  say('大約 k² > n → k ≈ √n', 'O(√n)；n = 25 跑了 7 次');
  await step(tok);                                   // 514.4 recap: a different condition → trace it
  note('條件不同 → 要追蹤才知道跑幾次', -3.4, 6.0, 0);
  say('重點：條件不是 i < n 的時候', '要追蹤才知道跑幾次');
}]);

// ═══ 9SgLBjXqwd4：1.5.2 Time Complexity Example #2 ═══
FRAG.push(['algbari1-doubling', 'i = i * 2：⌈log₂ n⌉ 次', async (tok) => {
  const part = (ctx.params || {}).part || 'log';
  if (part === 'log') {
    fresh([0, 5.5, 14], [0, 3.0, 0]);
    const BX = (q) => -4.8 + q * 1.4, SY = 0.42;
    const host = buddy('i', 1, AB.blue, 5.6, 0, -1.2, 0.75);
    say('下一段程式碼', '');
    await step(tok);                                 // 0.6 i is multiplied by two
    const cd = code(['for (i = 1; i < n; i = i * 2)', '  stmt;'], -2.4, 7.6, 0.5);
    cd.hl(0);
    say('i 從 1 開始，每次乘 2', '');
    await step(tok);                                 // 18.8 we cannot blindly say n times
    const q = bub('跑 n 次？不一定！', 5.6, 2.2, -1.2); host.mood('wow');
    say('不能直接說它跑 n 次', '要分析看看');
    const bar = async (q2, v, lbl) => { const b = abBar(AB.blue, 1, 1, BX(q2), 0); await abGrow(tok, b, v * SY, 350); tag(lbl, 'idx', BX(q2), v * SY + 0.35); host.set(v); return b; };
    await step(tok);                                 // 32.6 1, 1×2 = 2, 2×2 = 2²
    remove(q); host.mood('calm');
    await bar(0, 1, 'i = 1'); await bar(1, 2, '1×2 = 2'); await bar(2, 4, '2×2 = 2²');
    say('追蹤 i：1、2、2²', '每次都乘 2');
    await step(tok);                                 // 47.8 2³ … goes on
    await bar(3, 8, '2²×2 = 2³'); tag('…', 'ptr alt', BX(4), 0.4);
    say('接著 2³……一直乘下去', '');
    await step(tok);                                 // 55.9 after k times: 2ᵏ
    tag('第 k 次：i = 2ᵏ', 'ptr alt', BX(4) + 0.4, 5.0);
    say('假設跑了 k 次，i 就是 2ᵏ', '');
    await step(tok);                                 // 71.9 stops when i ≥ n
    const wall = lab.box(AB.red, [8.6, 0.05, 0.05]); wall.position.set(-0.6, 5.8, 0); lab.world.add(wall);
    tag('n', 'ptr', 4.2, 6.1);
    say('i ≥ n 時迴圈結束', '');
    await step(tok);                                 // 86.9 i = 2ᵏ → 2ᵏ ≥ n
    tag('2ᵏ ≥ n 時停', 'ptr alt', 1.0, 6.8);
    say('i 是 2ᵏ，所以 2ᵏ ≥ n 時停', '');
    await step(tok);                                 // 101.8 2ᵏ = n → k = log₂ n
    tag('令 2ᵏ = n → k = log₂ n', 'ptr', 1.0, 7.4, -0.6);
    say('取 2ᵏ = n，k 就是 log₂ n', '');
    await step(tok);                                 // 112.8 → O(log₂ n)
    okT('O(log₂ n)', 5.6, 2.4, -1.2); host.mood('happy'); await host.hop(tok);
    say('stmt 執行 O(log₂ n) 次', '');
    await step(tok);                                 // 121.1 multiplied by 2 or 3 → log
    note('計數變數是用「乘」的 → log', -4.0, 6.4, 0);
    say('計數變數不是加，而是乘（乘 2、乘 3）', '→ log 次');
    await step(tok);                                 // 141.9 compare: +1 k times = n → k = n
    for (let k = 0; k < 12; k++) { cube('', AB.green, [0.36, 0.3, 0.6], -5.2 + k * 0.42, 0.15, 2.6, 2); await beat(tok, 60); }
    tag('+1 +1 +1 …（k 次）= n → k = n', 'ptr alt', -2.6, 0.9, 2.6);
    say('對照 i++：每次加 1，加 k 次到 n', 'k = n');
    await step(tok);                                 // 176.8 ×2 k times = 2ᵏ = n → k = log₂ n
    tag('×2 ×2 ×2 …（k 次）= 2ᵏ = n → k = log₂ n', 'ptr', -1.4, 0.9, 1.3);
    say('i *= 2：乘 k 次 2 → 2ᵏ = n', 'k = log₂ n');
    await step(tok);                                 // 222.8 take it as a formula
    okT('公式：乘 → log n', 5.6, 3.0, -1.2); await host.hop(tok);
    say('記成公式：計數變數用乘的 → log n', '');
    return;
  }
  // part 'ceil'：n = 8 與 n = 10
  fresh([0, 6, 13.5], [0, 1.6, 0]);
  const X = (v) => -5.6 + v * 0.7;
  const cd = code(['for (i = 1; i < n; i = i * 2)', '  stmt;'], -2, 6.4, 0.5);
  for (let v = 0; v <= 16; v += 2) tag(String(v), 'idx', X(v), 0, 3.4);
  const me = buddy('', '?', AB.gold, 6.2, 0, -2.6, 0.6);
  say('log n 可能是小數', '');
  await step(tok);                                   // 248.8 floor or ceil?
  bub('⌊ ⌋ 還是 ⌈ ⌉？', 6.2, 1.4, -2.6); me.mood('wow');
  say('log n 可能有小數：要取 floor 還是 ceil？', '用例子檢查');
  let c = 0;
  const wallAt = (n, z) => { const w = lab.box(AB.red, [0.08, 1.6, 1.2]); w.position.set(X(n), 0.8, z); lab.world.add(w); tag('n = ' + n, 'ptr alt', X(n), 1.9, z); };
  const put = async (i, n, z) => { const ok = i < n; const m = cube('i=' + i, ok ? AB.blue : AB.red, [0.6, 0.6, 0.6], X(Math.min(i, 16)), 0.3, z, 3); if (ok) c++; else glow(m, RED); await beat(tok, 450); };
  await step(tok);                                   // 259.8 n = 8
  wallAt(8, -1); c = 0;
  say('例：n = 8', '');
  await step(tok);                                   // 272.8 1, 2, 4 < 8
  await put(1, 8, -1); await put(2, 8, -1); await put(4, 8, -1);
  say('i = 1、2、4 都 < 8 → 執行', '');
  await step(tok);                                   // 285.8 8 is not < 8 → stop: 3 times
  await put(8, 8, -1); tag('3 次', 'ptr', 6.4, 0.4, -1);
  say('i = 8：8 < 8 不成立 → 停', '一共 3 次');
  await step(tok);                                   // 300.3 n = 10
  wallAt(10, 1.6); c = 0;
  say('再試 n = 10', '');
  await step(tok);                                   // 306.8 1, 2, 4, 8 < 10
  for (const i of [1, 2, 4, 8]) await put(i, 10, 1.6);
  say('i = 1、2、4、8 都 < 10', '');
  await step(tok);                                   // 320.8 16 → stop: 4 times
  await put(16, 10, 1.6); tag('4 次', 'ptr', 6.4, 0.4, 1.6);
  say('i = 16 不 < 10 → 停', '一共 4 次');
  await step(tok);                                   // 334.7 log₂ 8 = 3
  okT('log₂ 8 = 3 ✓', 3.0, 1.2, -1);
  say('log₂ 8 = 3，剛好對上 3 次', '');
  await step(tok);                                   // 350.8 log₂ 10 ≈ 3.32, but 4 times
  noT('log₂ 10 ≈ 3.32，但跑了 4 次', 3.0, 1.2, 2.6);
  say('10 不是 2 的次方：log₂ 10 ≈ 3.32', '可是實際跑了 4 次');
  await step(tok);                                   // 371.8 → ceil
  okT('次數 = ⌈log₂ n⌉', 6.2, 1.4, -1.4); me.set('⌈ ⌉'); me.mood('happy'); await me.hop(tok);
  say('所以要取 ceil：⌈log₂ n⌉', '3.32 → 4');
}]);

FRAG.push(['algbari1-halving-sqrt', 'i /= 2 → log n；i·i < n → √n', async (tok) => {
  fresh([0, 6, 13.5], [0, 2, 0]);
  const SY = 0.14, BX = (c) => -5.6 + c * 1.1;
  say('另一段程式碼', '');
  await step(tok);                                   // 392 i starts from n
  const cd = code(['for (i = n; i >= 1; i = i / 2)', '  stmt;'], -3.6, 6.8, 0.5);
  const ib = buddy('i', 'n', AB.blue, -0.6, 0, 2.6, 0.7);
  say('i 從 n 開始，每次除以 2', '');
  let c = 0;
  const bar = async (v, lbl, col = AB.blue) => { const b = abBar(col, 0.9, 0.9, BX(c), -1); await abGrow(tok, b, Math.max(0.06, v * SY), 350); tag(lbl, 'idx', BX(c), v * SY + 0.35, -1); c++; ib.set(v); return b; };
  await step(tok);                                   // 397.8 n, n/2, n/2², n/2³
  await bar(32, 'n = 32'); await bar(16, 'n/2'); await bar(8, 'n/2²'); await bar(4, 'n/2³');
  say('i：n、n/2、n/2²、n/2³……', 'n = 32（示意）');
  await step(tok);                                   // 407.8 after k times: n/2ᵏ
  await bar(2, 'n/2⁴'); await bar(1, 'n/2⁵');
  tag('k 次後 i = n/2ᵏ', 'ptr alt', 0.4, 5.0, -1);
  say('假設跑 k 次，i = n/2ᵏ', '');
  await step(tok);                                   // 418.8 stops when i < 1
  const z = cube('i = 0', AB.red, [0.9, 0.12, 0.9], BX(c), 0.06, -1, 2); glow(z, RED); ib.set(0); ib.mood('wow');
  tag('i < 1 → 停', 'ptr', BX(c), 0.8, -1);
  say('i 小於 1 時停', '');
  await step(tok);                                   // 429.8 n/2ᵏ = 1 → k = log₂ n
  tag('n/2ᵏ = 1 → n = 2ᵏ → k = log₂ n', 'ptr', 0.4, 5.6, -1);
  say('令 n/2ᵏ = 1 → n = 2ᵏ', 'k = log₂ n');
  await step(tok);                                   // 449.6 → O(log n)
  okT('除 2 也是 O(log n)', 0.4, 6.2, -1); ib.mood('happy');
  say('除以 2 的迴圈也是 O(log n)', '乘 2 從 1 往上、除 2 從 n 往下，都是 log n');
  await step(tok);                                   // 474.8 i * i < n
  const cd2 = code(['for (i = 0; i * i < n; i++)', '  stmt;'], 3.4, 6.8, 0.5);
  cd2.hl(0);
  say('第 7 個例子：條件是 i * i < n', '');
  await step(tok);                                   // 487.8 runs while i*i < n
  for (let i = 1; i <= 5; i++) {
    const ok = i * i < 25;
    for (let r = 0; r < i; r++) for (let q = 0; q < i; q++) if (r === i - 1 || q === i - 1) cube('', ok ? AB.green : AB.red, [0.4, 0.3, 0.4], 2.4 + q * 0.45, 0.15, 0.4 + r * 0.45, 2);
    await beat(tok, 380);
  }
  tag('i = 5：25 ≥ 25 → 停', 'ptr alt', 3.3, 1.2, 3.0);
  say('i² < n 就繼續；i² ≥ n 就停', 'n = 25（示意）：方塊面積 = i²');
  await step(tok);                                   // 502.8 i² = n → i = √n
  okT('i² = n → i = √n → O(√n)', 3.4, 4.4, 0);
  say('i² = n 時停 → i = √n', 'O(√n)');
}]);

FRAG.push(['algbari1-loglog', '獨立迴圈 2n；p = log n 再 log p', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  say('兩個 for 迴圈', '');
  let cd = null;
  await step(tok);                                   // 519.8 two independent loops, one after another
  cd = code(['for (i = 0; i < n; i++)  stmt;', 'for (j = 0; j < n; j++)  stmt;'], -2.4, 7.2, 0.5);
  say('兩個迴圈一前一後，彼此獨立', '不是一個包一個');
  await step(tok);                                   // 531.4 first loop: n times
  cd.hl(0);
  for (let k = 0; k < 12; k++) { cube('', AB.blue, [0.4, 0.4, 0.6], -5.6 + k * 0.46, 0.2, -2.4, 2); await beat(tok, 70); }
  say('第一個迴圈：n 次 → O(n)', 'n = 12（示意）');
  await step(tok);                                   // 540.8 second loop: n times
  cd.hl(1);
  for (let k = 0; k < 12; k++) { cube('', AB.purple, [0.4, 0.4, 0.6], -5.6 + (k + 12) * 0.46, 0.2, -2.4, 2); await beat(tok, 70); }
  say('第二個迴圈也是 n 次', '接在後面');
  await step(tok);                                   // 546.8 n + n = 2n → O(n)
  cd.hl(-1); okT('n + n = 2n → O(n)', -0.4, 1.2, -2.4);
  say('合起來 n + n = 2n → O(n)', '');
  await step(tok);                                   // 559.8 not n²
  noT('不是 n²（沒有巢狀）', 4.0, 1.2, -2.4);
  say('不是 n²：它們是相加，不是相乘', '');
  await step(tok);                                   // 566.8 next: two loops with p
  cd.kill();
  cd = code(['p = 0;', 'for (i = 1; i < n; i = i * 2)', '  p++;', 'for (j = 1; j < p; j = j * 2)', '  stmt;'], -2.4, 7.6, 0.46);
  const pb = buddy('p', 0, AB.orange, 5.4, 0, 0.6, 0.7);
  say('下一個：也是兩個獨立迴圈', '要算 stmt 做幾次');
  await step(tok);                                   // 573.9 second loop alone: j *= 2, j < p → log p
  cd.hl(3); tag('j 乘 2、j < p → log p 次', 'ptr alt', 3.6, 6.3);
  say('先只看第二個：j 每次乘 2，條件 j < p', '→ 跑 log p 次');
  await step(tok);                                   // 590.8 what is p? counted in the first loop
  cd.hl(1);
  let p = 0;
  for (let i = 1; i < 256; i *= 2) { p++; cube('i=' + i, AB.teal, [0.95, 0.45, 0.8], -5.3 + (p - 1) * 1.05, 0.23, 0.6, 3); pb.set(p); await beat(tok, 250); }
  say('p 是什麼？第一個迴圈每跑一次 p 就 +1', 'n = 256（示意）：p = 8');
  await step(tok);                                   // 605.8 i *= 2 → log n → p = log n
  tag('p = log₂ n', 'ptr alt', 3.6, 1.4, 0.6); pb.mood('happy');
  say('第一個迴圈 i 乘 2 → 跑 log n 次', '所以 p = log n');
  await step(tok);                                   // 619.8 stmt repeats log p times
  cd.hl(4);
  let c2 = 0;
  for (let j = 1; j < p; j *= 2) { c2++; cube('j=' + j, AB.orange, [0.95, 0.45, 0.8], -5.3 + (c2 - 1) * 1.05, 0.23, 2.2, 3); await beat(tok, 400); }
  tag('stmt ' + c2 + ' 次 = log₂ 8', 'ptr', -0.6, 1, 2.2);
  say('第二個迴圈：stmt 做 log p 次', 'p = 8 → 3 次');
  await step(tok);                                   // 629.4 log p = log log n
  okT('log p = log log n → O(log log n)', 3.2, 2.0, 2.2); await pb.hop(tok);
  say('p = log n 代進去：log p = log log n', 'O(log log n)');
}]);

FRAG.push(['algbari1-nlogn', '外層 n × 內層 log n = n log n', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.2, 0]);
  const n = 8, Z = (i) => -2.8 + i * 0.75;
  const cd = code(['for (i = 0; i < n; i++)', '  for (j = 1; j < n; j = j * 2)', '    stmt;'], -2.4, 6.4, 0.5);
  const cnt = buddy('stmt', 0, AB.gold, 5.2, 0, -1.6, 0.75);
  say('巢狀迴圈', '');
  await step(tok);                                   // 643.8 outer loop: O(n)
  cd.hl(0); tag('n 次', 'ptr alt', 2.4, 6.4);
  say('外層 i++：O(n)', '');
  await step(tok);                                   // 649.8 everything inside: n times
  for (let i = 0; i < n; i++) tag('i=' + i, 'idx', -4.6, 0.2, Z(i));
  say('裡面的每一行都跑 n 次', 'n = 8（示意）：8 列');
  let c = 0;
  const rowJ = async (i, ms) => { for (let j = 1, q = 0; j < n; j *= 2, q++) { cube('j=' + j, AB.purple, [1.1, 0.35, 0.6], -3 + q * 1.3, 0.18, Z(i), 2.5); c++; cnt.set(c); await beat(tok, ms); } };
  await step(tok);                                   // 662.8 inner loop: j *= 2 → log n
  cd.hl(1); tag('log n 次', 'ptr alt', 3.0, 5.9);
  await rowJ(0, 300);
  say('內層 j 每次乘 2 → log n 次', 'j = 1、2、4 → 3 次 = log₂ 8');
  await step(tok);                                   // 672.9 the statement inside: log n each time
  cd.hl(2); tag('n log n 次', 'ptr alt', 1.6, 5.4);
  say('裡面的 stmt，每一列也是 log n 次', '');
  await step(tok);                                   // 682.8 all rows; n + 1 makes no difference
  for (let i = 1; i < n; i++) await rowJ(i, 70);
  note('n + 1 寫不寫都沒差', 4.6, 1.2, 1.2);
  say('8 列都做完：8 × 3 = 24', '條件寫 n + 1 或 n 都一樣');
  await step(tok);                                   // 688.5 2n log n + n → O(n log n)
  cd.hl(-1); okT('2n log n + n → O(n log n)', 4.6, 2.0, 1.2); cnt.mood('happy'); await cnt.hop(tok);
  say('總共約 2n log n + n，最高項是 n log n', 'O(n log n)');
}]);

FRAG.push(['algbari1-loop-summary', '迴圈複雜度總整理（n = 64）', async (tok) => {
  fresh([0, 5, 14.5], [0, 3, 0]);
  const R = [['i++', 64, 'O(n)', AB.blue], ['i += 2', 32, 'O(n)', AB.blue], ['i--', 64, 'O(n)', AB.blue], ['i *= 2', 6, 'O(log₂ n)', AB.green], ['i *= 3', 4, 'O(log₃ n)', AB.green], ['i /= 2', 6, 'O(log₂ n)', AB.green]];
  tag('n = 64（示意）：常見迴圈各跑幾次', 'ptr', 0, 7.6);
  say('把到目前的迴圈整理一下', '');
  const one = async (r, sub) => {
    const [nm, c, big, col] = R[r], x = -5.5 + r * 2.2;
    tag(nm, 'ptr', x, 0, 1.4);
    const m = abBar(col, 1.3, 1.3, x, 0); await abGrow(tok, m, 0.15 + c * 0.085, 500);
    tag(c + ' 次', 'idx', x, 0.4 + c * 0.085); tag(big, 'ptr alt', x, 1.1 + c * 0.085);
    say(nm + '：' + c + ' 次 → ' + big, sub);
  };
  await step(tok);                                   // 721 i++ → O(n)
  await one(0, '遞增迴圈');
  await step(tok);                                   // 727.8 i += 2 → n/2 → O(n)
  await one(1, 'n/2 也是 O(n)');
  await step(tok);                                   // 741.8 i-- → O(n)
  await one(2, '遞減也是 O(n)');
  await step(tok);                                   // 757.8 i *= 2 → log₂ n
  await one(3, '乘 2 → log₂ n');
  await step(tok);                                   // 769.8 i *= 3 → log₃ n
  await one(4, 'log₃ 64 ≈ 3.8 → 4 次');
  await step(tok);                                   // 785 i /= 2 → log₂ n
  await one(5, 'i 從 n 開始除 2，i > 1 就繼續');
  await step(tok);                                   // 806.8 +1, +2, +10, +100 → O(n)
  note('加或減（1、2、10、100）→ O(n)', -3.3, 7.0, 0);
  say('當公式記：用加減的 → O(n)', '每次加 1、2、10、100 都一樣');
  await step(tok);                                   // 817.8 n/2, n/200 → O(n)
  note('n/2、n/200 都寫 O(n)', -3.3, 6.4, 0);
  say('n/2、n/200 也都是 O(n)', '寫的是多項式的次數');
  await step(tok);                                   // 833.8 n²/2 → n²
  note('n²/2 → 寫 n²', 3.3, 6.7, 0);
  say('n²/2 就寫 n²', '只寫那一項，不寫係數');
}]);

// ═══ p1EnSvS3urU：1.5.3 while、if ═══
FRAG.push(['algbari1-loop-kinds', 'for、while、do-while、repeat-until', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.4, 0]);
  const X = [-4.8, -1.6, 1.6, 4.8];
  const head = (q, a, b) => { tag(a, 'ptr', X[q], 6.6); tag(b, 'idx', X[q], 6.0); };
  const cnt = X.map((x) => tag('', 'ptr alt', x, 5.0));
  say('上一支講 for；這支講 while 和 if', '');
  await step(tok);                                   // 8.7 while loops or conditional statements
  const topic = pkt('今天：while 迴圈、if 條件句', 0, 3.4, 0);
  const host = buddy('', '?', AB.gold, 0, 0, 1.6, 0.8);
  say('怎麼分析 while 迴圈和 if 條件句？', '');
  await step(tok);                                   // 18.5 C: while and do-while differ
  remove(topic);
  head(1, 'while', 'while (cond) {…}'); head(2, 'do-while', 'do {…} while (cond);');
  say('C 語言的迴圈：for、while、do-while', 'while 和 do-while 有差別');
  await step(tok);                                   // 27.2 do-while ≥ 1; for and while are the same
  note('至少執行 1 次', X[2], 4.3, 0);
  note('C 的 for ⇄ while 可以互換', X[1], 4.3, 0);
  say('do-while 至少做 1 次', 'for 能做的 while 都能做，反過來也是');
  await step(tok);                                   // 43.1 before C, for looked different
  head(0, 'Pascal 的 for', '');
  say('C 以前的語言，for 長得不一樣', '');
  await step(tok);                                   // 48.8 for i := 1 to n do
  tag('for i := 1 to n do', 'idx', X[0], 6.0);
  say('Pascal：for i := 1 to n do', '');
  await step(tok);                                   // 65.3 i goes 1 to n, +1 at a time
  for (let i = 1; i <= 5; i++) { cube('i=' + i, AB.blue, [1.3, 0.4, 0.9], X[0], 0.2 + (i - 1) * 0.45, 0, 3); txt(cnt[0], i + ' 次'); await beat(tok, 300); }
  say('i 從 1 到 n，一次只能加 1', 'n = 5（示意）');
  await step(tok);                                   // 84.3 step 2: 1, 3, 5
  [1, 3, 5].forEach((i, k) => cube('i=' + i, AB.teal, [1.3, 0.4, 0.9], X[0], 0.2 + k * 0.45, 1.8, 3));
  tag('step 2', 'idx', X[0], 1.6, 1.8);
  say('要加 2 得寫 step 2：i = 1、3、5……', '還是線性增加');
  await step(tok);                                   // 124.8 such a for: n times, condition n + 1
  txt(cnt[0], '本體 n 次、條件 n + 1');
  say('這種 for：本體 n 次、條件 n + 1 次', '');
  await step(tok);                                   // 138.8 while: repeats while true, stops when false
  const g1 = cube('cond？', AB.sand, [1.4, 0.5, 0.9], X[1], 0.25, 0, 3);
  say('while：條件 true 就繼續，false 就停', '');
  await step(tok);                                   // 157.1 we have to study when it stops
  const q1 = bub('何時停？跑幾次？', X[1], 2.0, 0); host.mood('wow');
  say('得研究它什麼時候停、跑了幾次', '再做分析');
  await step(tok);                                   // 168.8 old for: blindly n; while: cannot say n
  remove(q1);
  okT('直接說 n', X[0], 3.6, 0); noT('不能直接說 n', X[1], 3.6, 0);
  say('舊式 for 可以直接說 n', 'while 沒研究過不能說 n');
  await step(tok);                                   // 186 do-while: post-tested, runs once even if false
  cube('body', AB.purple, [1.4, 0.45, 0.9], X[2], 0.23, 0, 3);
  const g2 = cube('false', AB.sand, [1.4, 0.5, 0.9], X[2], 0.75, 0, 3); glow(g2, RED); txt(cnt[2], '1 次');
  say('do-while：先做，再檢查（post-tested）', '條件一開始就 false，也做了 1 次');
  await step(tok);                                   // 211.8 while with false at the start: 0 times
  glow(g1, RED); relabel(g1, 'false'); txt(cnt[1], '0 次');
  say('同樣一開始就 false：while 一次都不做', 'do-while 做 1 次');
  await step(tok);                                   // 221.8 old languages: repeat … until
  head(3, 'repeat-until', 'repeat … until (cond)');
  say('舊語言還有 repeat … until', '');
  await step(tok);                                   // 243.8 repeats while false, stops when true
  const seq = ['false', 'false', 'true'];
  for (let k = 0; k < 3; k++) {
    cube('body', AB.orange, [1.4, 0.4, 0.9], X[3], 0.2 + k * 0.45, 0, 3); txt(cnt[3], (k + 1) + ' 次');
    const g = cube(seq[k], k < 2 ? AB.sand : AB.green, [1.2, 0.38, 0.8], X[3], 0.19 + k * 0.42, 1.8, 2);
    if (k === 2) glow(g, GREEN);
    await beat(tok, 600);
  }
  say('repeat-until：條件 false 就繼續，true 就停', '');
  await step(tok);                                   // 257.9 like do-while ≥ 1, but opposite condition
  note('do-while：true 繼續｜repeat-until：true 停', 3.2, 3.6, 0);
  say('跟 do-while 一樣至少做 1 次', '但條件相反');
  await step(tok);                                   // 294.8 all three: study them (n, log n, √n…)
  host.set('n？log n？'); host.mood('calm');
  okT('for → 直接 O(n)', X[0], 2.9, 0); note('while 這三種：要研究，可能 n、log n、√n…', 1.6, 2.6, 1.8);
  say('while、do-while、repeat-until 都得研究', '可能是 n、log n、√n……');
}]);

FRAG.push(['algbari1-while-3n2', 'while (i < n) i++：f(n) = 3n + 2', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const SX = { 1: 1.6, 3: 3.2, 4: 4.8 }, st = { 1: 0, 3: 0, 4: 0 };
  let cd = null, fq = null, ib = null;
  const push = (r, col) => { cube('', col, [1.1, 0.24, 1], SX[r], 0.12 + st[r] * 0.27, 0, 2.5); st[r]++; txt(fq[r], String(st[r])); };
  say('用 while 寫的程式', '');
  await step(tok);                                   // 319.6 a piece of code using a while loop
  cd = code(['i = 0;', 'while (i < n)', '{', '  stmt;', '  i++;', '}'], -3.8, 7, 0.5);
  fq = { 0: tag('', 'ptr alt', -1.6, 7), 1: tag('', 'ptr alt', -1.6, 6.5), 3: tag('', 'ptr alt', -1.6, 5.5), 4: tag('', 'ptr alt', -1.6, 5) };
  tag('條件', 'idx', SX[1], 0, 1.2); tag('stmt', 'idx', SX[3], 0, 1.2); tag('i++', 'idx', SX[4], 0, 1.2);
  ib = buddy('i', '', AB.blue, -4.6, 0, 1.6, 0.7);
  say('stmt 會執行幾次？', '');
  await step(tok);                                   // 330.8 i = 0: one unit
  cd.hl(0); txt(fq[0], '1'); ib.set(0);
  say('i = 0：1 單位時間', '');
  await step(tok);                                   // 338.8 i++: just +1 each time → n times
  cd.hl(4); txt(fq[4], 'n');
  say('i++ 每次只加 1', '不用追蹤也知道：n 次');
  await step(tok);                                   // 345.8 stmt: n times
  cd.hl(3); txt(fq[3], 'n');
  say('stmt 也是 n 次', '');
  await step(tok);                                   // 351.6 the condition: n + 1
  cd.hl(1); txt(fq[1], 'n + 1');
  say('條件 i < n：n + 1 次', '');
  await step(tok);                                   // 359.8 n true + 1 false; example n = 10
  for (let i = 0; i < 10; i++) { ib.set(i); push(1, AB.purple); push(3, AB.blue); push(4, AB.green); await beat(tok, 220); }
  say('例：n = 10，i = 0 ～ 9 條件都成立', '條件、stmt、i++ 各 10 次');
  await step(tok);                                   // 375.8 i = 10 → stop
  ib.set(10); push(1, AB.red); ib.mood('wow');
  say('i = 10：10 < 10 不成立 → 停', '條件比 stmt 多 1 次 = n + 1');
  await step(tok);                                   // 383.8 3n + 2
  txt(fq[1], 'n + 1'); txt(fq[3], 'n'); txt(fq[4], 'n'); cd.hl(-1);
  const fx = tag('f(n) = 1 + (n+1) + n + n = 3n + 2', 'ptr', 3.2, 4.4, -1);
  say('加起來 1 + (n + 1) + n + n', 'f(n) = 3n + 2');
  await step(tok);                                   // 391.8 → Θ(n), O(n)
  okT('3n + 2 → Θ(n)，也就是 O(n)', 3.2, 3.8, -1); ib.mood('happy');
  say('f(n) = 3n + 2 → Θ(n)，也就是 O(n)', '');
  await step(tok);                                   // 402.8 the same code with a C for
  const cf = code(['for (i = 0; i < n; i++)', '  stmt;'], -3.8, 3.6, 0.5);
  cf.hl(0);
  say('同一段用 C 的 for 寫', '');
  await step(tok);                                   // 423.8 counting everything: also 3n + 2
  tag('1 + (n+1) + n + n = 3n + 2', 'ptr alt', -3.8, 2.4);
  say('每一部分都數：一樣 3n + 2', '');
  await step(tok);                                   // 436.8 we ignored i = 0, i++ → 2n + 1
  note('寫 for 時習慣省略 i = 0、i++ → 2n + 1', -3.8, 1.8);
  say('以前寫 for 時省略那兩項，記成 2n + 1', '');
  await step(tok);                                   // 451.2 only the degree → O(n)
  okT('只在乎次數 → 都是 O(n)', -3.8, 1.2); await ib.hop(tok);
  say('我們只在乎最高次數 → 都是 O(n)', 'while 能寫的，for 也能寫');
}]);

FRAG.push(['algbari1-while-double', 'while：a *= 2、i /= 2 → log n', async (tok) => {
  const part = (ctx.params || {}).part || 'double';
  fresh([0, 6, 14], [0, 2.6, 0]);
  const SY = 0.3, BX = (k) => -2.6 + k * 1.5;
  const bar = async (k, v, lbl, nm) => { const b = abBar(AB.blue, 1, 1, BX(k), 0); await abGrow(tok, b, v * SY, 350); tag(lbl, 'idx', BX(k), v * SY + 0.35); return b; };
  if (part === 'double') {
    say('下一段程式', '');
    await step(tok);                                 // 463.8 a = 1; while (a < b) a = a * 2; no n
    const cd = code(['a = 1;', 'while (a < b) {', '  stmt;', '  a = a * 2;', '}'], -4.4, 7.2, 0.5);
    cd.hl(1);
    const ab = buddy('a', '', AB.blue, -5.4, 0, 2.0, 0.7);
    bub('條件裡沒有 n！', -2.0, 7.4, 0);
    say('a 從 1 開始，每次乘 2', '條件裡沒有 n：跑幾次不知道');
    await step(tok);                                 // 488.9 trace: a is 1
    cd.hl(3); ab.set(1); await bar(0, 1, 'a = 1');
    say('追蹤：a 一開始是 1', '');
    await step(tok);                                 // 500.7 1×2 = 2, 2×2 = 2²
    ab.set(2); await bar(1, 2, '1×2 = 2'); ab.set(4); await bar(2, 4, '2×2 = 2²');
    say('a = 1 × 2 = 2，再來 2 × 2 = 2²', '');
    await step(tok);                                 // 515.8 2² × 2 = 2³ …
    ab.set(8); await bar(3, 8, '2³'); tag('…', 'ptr alt', BX(4), 0.4);
    say('再來 2³……一直乘下去', '');
    await step(tok);                                 // 525.4 stops somewhere: 2ᵏ, k times
    tag('跑 k 次：a = 2ᵏ', 'ptr alt', 3.6, 3.4);
    say('假設在某處停下，那時 a = 2ᵏ', '跑了 k 次，要求出 k');
    await step(tok);                                 // 544.8 ends when a ≥ b
    const lim = lab.box(AB.red, [8.5, 0.05, 0.05]); lim.position.set(1.4, 16 * SY, 0); lab.world.add(lim);
    tag('b', 'ptr', 5.9, 16 * SY + 0.3); ab.mood('wow');
    say('a ≥ b 時結束', '');
    await step(tok);                                 // 567.8 2ᵏ = b → k = log₂ b
    tag('2ᵏ ≥ b → 令 2ᵏ = b → k = log₂ b', 'ptr', 1.6, 6.0, -1);
    say('2ᵏ ≥ b，取等號 2ᵏ = b', 'k = log₂ b');
    await step(tok);                                 // 585.8 call b n → O(log n)
    okT('把 b 叫做 n → O(log n)', 1.6, 6.6, -1); ab.mood('happy'); await ab.hop(tok);
    say('習慣用 n：把 b 叫做 n', 'O(log n)');
    await step(tok);                                 // 605.8 the same with a for loop
    tag('for (a = 1; a < b; a = a * 2)', 'ptr alt', 1.6, 7.3, -1);
    say('之前用 for 寫過同一件事', 'for (a = 1; a < b; a = a * 2)');
    await step(tok);                                 // 656 C's for: write anything, as long as it stops
    note('C 的 for：三個部分想寫什麼都行，只要會停', -2.2, 1.0, 2.4);
    say('C 的 for 很自由：初始化、條件、更新都能隨便寫', '只要迴圈有限步會停');
    return;
  }
  // part 'halve'
  say('再一個 while', '');
  await step(tok);                                   // 702 i starts from n and is divided by 2
  const cd = code(['i = n;', 'while (i > 1) {', '  stmt;', '  i = i / 2;', '}'], -4.4, 7.2, 0.5);
  cd.hl(3);
  const ib = buddy('i', 'n', AB.blue, -5.4, 0, 2.0, 0.7);
  for (const [k, v, l] of [[0, 16, 'n'], [1, 8, 'n/2'], [2, 4, 'n/2²'], [3, 2, 'n/2³']]) { ib.set(v); await bar(k, v, l); }
  say('i 從 n 開始，每次除以 2', 'n = 16（示意）');
  await step(tok);                                   // 709.6 → log n (a formula already)
  okT('除 2 → O(log n)', 3.6, 5.6); ib.mood('happy');
  say('上一支已經當公式：除 2 的迴圈是 log n', '');
  await step(tok);                                   // 716.8 the same with a for loop
  tag('for (i = n; i > 1; i = i / 2)', 'ptr alt', 1.2, 7.3, -1);
  say('也能寫成 for (i = n; i > 1; i = i / 2)', '');
  await step(tok);                                   // 732.1 the same thing → the same time
  note('for 或 while 寫，時間一樣', 3.6, 4.6);
  await ib.hop(tok);
  say('同一件事用 for 或 while 寫', '時間都一樣');
}]);

FRAG.push(['algbari1-while-ksum', 'k = k + i：m(m+1)/2 ≥ n → √n', async (tok) => {
  fresh([0, 5.5, 14], [0, 3.2, 0]);
  const N = 20, SY = 0.22, BX = (m) => -2.4 + (m - 1) * 1.3;
  say('再一個迴圈', '');
  await step(tok);                                   // 745.8 k < n; k grows by i; i grows by 1
  const cd = code(['i = 1; k = 1;', 'while (k < n) {', '  stmt;', '  k = k + i;', '  i++;', '}'], -4.2, 7.6, 0.48);
  cd.hl(3);
  say('k 每次加上 i，i 每次也加 1', '跑幾次看不出來');
  await step(tok);                                   // 761.8 i and k both start at 1
  const ib = buddy('i', 1, AB.blue, -5.6, 0, 0.6, 0.65), kb = buddy('k', 1, AB.orange, -5.6, 0, 2.2, 0.65);
  say('追蹤 i、k：一開始都是 1', '');
  const SUM = ['1 + 1', '2 + 2', '2 + 2 + 3', '2+2+3+4', '2+…+5', '2+…+6'];
  let i = 1, k = 1, m = 0;
  const one = async () => { k += i; i++; m++; const b = abBar(k >= N ? AB.red : AB.blue, 1, 1, BX(m), 0); await abGrow(tok, b, k * SY, 380); tag('k=' + k, 'idx', BX(m), k * SY + 0.35); tag('i=' + i, 'idx', BX(m), 0, 0.9); kb.set(k); ib.set(i); return b; };
  await step(tok);                                   // 771.9 k = 1 + 1 = 2, i = 2
  cd.hl(3); await one();
  say('第 1 次：k = 1 + 1 = 2，i 變 2', '');
  await step(tok);                                   // 787.8 k = 2 + 2, i = 3
  await one();
  say('第 2 次：k = 2 + 2 = 4，i 變 3', '');
  await step(tok);                                   // 800.8 2 + 2 + 3, 2 + 2 + 3 + 4 …
  await one(); await one();
  say('k = 2 + 2 + 3 = 7，再 2 + 2 + 3 + 4 = 11', '一直加下去');
  await step(tok);                                   // 816.8 call it m times
  await one();
  tag('跑了 m 次：k = 2 + 2 + 3 + … + m', 'ptr alt', 1.6, 6.4, -1);
  say('跑幾次不知道，叫它 m 次', 'k = 2 + 2 + 3 + … + m');
  await step(tok);                                   // 826.8 ≈ 1 + 2 + … + m = m(m + 1)/2
  tag('≈ 1 + 2 + … + m = m(m + 1)/2', 'ptr', 1.6, 7.0, -1);
  say('把開頭的 2 看成 1：就是 1 + 2 + … + m', '= m(m + 1)/2');
  await step(tok);                                   // 856.8 stops when k ≥ n
  const lim = lab.box(AB.red, [9.5, 0.05, 0.05]); lim.position.set(1.4, N * SY, 0); lab.world.add(lim);
  tag('n = 20（示意）', 'ptr alt', 5.6, N * SY + 0.4);
  const last = await one(); glow(last, RED); kb.mood('wow');
  say('k < n 就繼續；k ≥ n 就停', 'k = 22 ≥ 20 → 停');
  await step(tok);                                   // 869.8 m(m + 1)/2 ≥ n → m² ≈ n
  tag('m(m + 1)/2 ≥ n → m² ≈ n', 'ptr', 1.6, 7.6, -1);
  say('停止時 m(m + 1)/2 ≥ n', '大約 m² ≈ n');
  await step(tok);                                   // 876.8 m ≈ √n → O(√n)
  okT('m ≈ √n → O(√n)', 5.6, 6.2, -1); kb.mood('happy'); await kb.hop(tok);
  say('m 大約是 √n → O(√n)', 'n = 20 跑了 6 次');
  await step(tok);                                   // 902.9 also with a for, harder to read
  note('for (k = 1, i = 1; k < n; i++) k = k + i;', -2.0, 1.4, 2.6);
  say('也能用 for 寫：兩個初始化、兩個更新', '一樣 O(√n)，只是比較難讀');
}]);

FRAG.push(['algbari1-gcd-sub', '減法 GCD：最少 0 次、最多約 n/2 次', async (tok) => {
  fresh([0, 5.5, 14], [0, 3, 0]);
  const SY = 0.27;
  say('求最大公因數的程式', '');
  await step(tok);                                   // 960.8 GCD of two numbers m and n
  const cd = code(['while (m != n) {', '  if (m > n) m = m - n;', '  else       n = n - m;', '}', 'return m;'], -3.4, 7.4, 0.48);
  const cnt = tag('', 'ptr alt', 3.6, 7);
  say('用減法求 m、n 的 GCD', '');
  await step(tok);                                   // 974.8 repeat until m = n: that is the gcd
  cd.hl(0); note('m ≠ n：大的減小的；相等就停 → 那就是 GCD', 3.4, 6.2, -1);
  say('m、n 不相等就一直減，相等就停', '停下時的 m（= n）就是 GCD');
  const mk = (m0, n0, x0) => {
    const bm = abBar(AB.blue, 0.8, 0.8, x0 - 0.5, 0), bn = abBar(AB.orange, 0.8, 0.8, x0 + 0.5, 0);
    abSet(bm, m0 * SY); abSet(bn, n0 * SY);
    const o = { m: m0, n: n0, c: 0, bm, bn, lm: tag('m=' + m0, 'idx', x0 - 0.5, m0 * SY + 0.35), ln: tag('n=' + n0, 'idx', x0 + 0.5, n0 * SY + 0.35) };
    tag('(' + m0 + ', ' + n0 + ')', 'ptr', x0, 0, 1.3); txt(cnt, '迴圈 0 次'); return o;
  };
  const sub = async (o, times, ms) => {
    for (let t = 0; t < times && o.m !== o.n; t++) {
      if (o.m > o.n) { cd.hl(1); o.m -= o.n; await abGrow(tok, o.bm, o.m * SY, ms); } else { cd.hl(2); o.n -= o.m; await abGrow(tok, o.bn, o.n * SY, ms); }
      o.c++; txt(o.lm, 'm=' + o.m); o.lm.position.y = o.m * SY + 0.35; txt(o.ln, 'n=' + o.n); o.ln.position.y = o.n * SY + 0.35; txt(cnt, '迴圈 ' + o.c + ' 次');
    }
  };
  let A = null;
  await step(tok);                                   // 985.8 trace m = 6, n = 3
  A = mk(6, 3, -4.6);
  say('追蹤：m = 6、n = 3', '');
  await step(tok);                                   // 993.9 6 − 3 = 3 → equal: once
  await sub(A, 9, 500); cd.hl(4);
  say('6 > 3 → m = 6 − 3 = 3，相等了', '只跑 1 次，GCD = 3');
  await step(tok);                                   // 1012.8 m = n = 5 → 0 times
  mk(5, 5, -1.2); cd.hl(0);
  say('m = n = 5：一開始就相等，不進迴圈', '0 次');
  await step(tok);                                   // 1024.2 minimum 0 or 1; m = 16, n = 2
  okT('最少：0 或 1 次', -2.9, 3.4, 0);
  A = mk(16, 2, 2.6);
  say('最少只跑 0 或 1 次', '再試 m = 16、n = 2');
  await step(tok);                                   // 1034.8 16 − 2 = 14, then 12
  await sub(A, 2, 450);
  say('16 > 2 → 14，再減 → 12', '');
  await step(tok);                                   // 1055.8 10, 8, 6, 4, 2 → stop
  await sub(A, 9, 300); cd.hl(4);
  say('10、8、6、4、2：m = n = 2 → 停', '');
  await step(tok);                                   // 1069.8 seven times ≈ 16/2
  tag('7 次 ≈ 16/2', 'ptr alt', 2.6, 5.2);
  say('數一數：7 次，大約 16/2', '');
  await step(tok);                                   // 1086.6 n/2 → O(n) at most
  okT('最多：約 n/2 次 → O(n)', 3.4, 5.6, -1);
  say('最多約 n/2 次 → O(n)', '');
  await step(tok);                                   // 1100.8 minimum O(1)
  okT('最少：O(1)', -2.9, 4.0, 0);
  say('最少只跑 1 次 → O(1)', '最多 O(n)、最少 O(1)');
  await step(tok);                                   // 1116.8 the same with a for loop
  note('for ( ; m != n; ) { … }', -3.4, 4.6, 0.6);
  say('也能寫成 for：沒有初始化、沒有更新', '只留條件');
  await step(tok);                                   // 1148.8 C's for: study it like a while
  note('C 的 for：除非明顯是 n，否則當 while 研究', 0, 1.4, 2.6);
  say('C 的 for 也要當 while 一樣研究', '除非一眼就看得出是 n');
}]);

FRAG.push(['algbari1-if-cases', 'if 讓時間分成 best / worst case', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  say('最後看條件句 if', '');
  await step(tok);                                   // 1162.8 a random code: Test(n)
  const cd = code(['Algorithm Test(n)', '{', '  if (n < 5)', '    printf("%d", n);', '  else', '  {', '    for (i = 0; i < n; i++)', '      stmt;', '  }', '}'], -3.6, 7.4, 0.46);
  const me = buddy('', '?', AB.gold, 5.6, 0, -1.8, 0.7);
  say('隨手寫的 Test(n)，沒有特別意義', '');
  await step(tok);                                   // 1175.8 n < 5 → print; else → the loop
  cd.hl(2);
  note('n < 5：印出 n', -0.2, 6.5, 0); note('n ≥ 5：進 else 跑迴圈', -0.2, 4.6, 0);
  say('n < 5 就印出 n；n ≥ 5 就進 else 跑迴圈', '');
  await step(tok);                                   // 1195.8 the loop: n times; the print: once
  cd.hl(6); tag('n 次', 'ptr alt', 2.2, 4.64); tag('1 次', 'ptr alt', 2.2, 6.02);
  say('迴圈跑 n 次；印出只做 1 次', '');
  await step(tok);                                   // 1206.7 conditions decide different amounts of time
  cd.hl(-1); bub('時間要看條件！', 5.6, 1.8, -1.8); me.mood('wow');
  say('有條件句時，花的時間可能依條件而不同', '');
  const run = async (n, z) => {
    tag('n = ' + n, 'ptr alt', -0.4, 0.2, z);
    cd.hl(2); await beat(tok, 400);
    if (n < 5) { cd.hl(3); cube('print', AB.green, [1.0, 0.5, 0.8], 1.2, 0.25, z, 3); await beat(tok, 500); }
    else { cd.hl(6); for (let i = 0; i < n; i++) { cube('', AB.purple, [0.42, 0.5, 0.8], 1.0 + i * 0.5, 0.25, z, 2.5); await beat(tok, 140); } }
  };
  await step(tok);                                   // 1218.8 true → one statement → O(1)
  await run(3, 0.6);
  tag('O(1)', 'ptr', 3.2, 0.4, 0.6);
  say('條件成立（例 n = 3）：只做一個敘述', 'O(1)');
  await step(tok);                                   // 1227.2 false → n times → O(n)
  await run(10, 2.2);
  tag('O(n)', 'ptr', 6.4, 0.4, 2.2);
  say('條件不成立（例 n = 10）：迴圈跑 n 次', 'O(n)');
  await step(tok);                                   // 1235.3 best case / worst case
  okT('best case', 3.2, 1.0, 0.6); noT('worst case', 6.4, 1.0, 2.2); me.mood('happy');
  say('前者是 best case，後者是 worst case', '');
  await step(tok);                                   // 1263.9 not a rule
  note('有 if ≠ 一定有 best / worst case', 5.4, 3.4, -1.8);
  say('但這不是規則', '有 if 不代表一定會有最好、最壞');
  await step(tok);                                   // 1274.2 change the condition: only one case
  txt(cd.ls[2], '  if (n > 5)        '); cd.hl(2);
  note('改成：n > 5 才跑迴圈，否則什麼都不做 → 只有一種情況', -0.6, 3.1, 3.4);
  me.mood('calm');
  say('改一下條件：n > 5 就跑 n 次', '沒有最好最壞之分，只剩一種情況');
}]);

// ═══ w7t4_JUUTeg：1.6 Classes of Functions ═══
FRAG.push(['algbari1-classes', '函數類別：constant、log、linear…', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.6, 0]);
  const COLS = [['O(1)', 'constant', AB.teal], ['O(log n)', 'logarithmic', AB.green], ['O(n)', 'linear', AB.blue], ['O(n²)', 'quadratic', AB.purple], ['O(n³)', 'cubic', AB.orange], ['O(2ⁿ)', 'exponential', AB.red]];
  const X = (c) => -5.5 + c * 2.2, h = [0, 0, 0, 0, 0, 0];
  const col = (c) => { tag(COLS[c][0], 'ptr', X(c), 0.1, 1.6); tag(COLS[c][1], 'idx', X(c), 0.1, 2.4); };
  const ex = async (c, s) => { cube(s, COLS[c][2], [2, 0.55, 1.1], X(c), 0.28 + h[c] * 0.6, 0, 3); h[c]++; await beat(tok, 350); };
  const sorter = buddy('分類員', '', AB.gold, 0, 0, 4.2, 0.7);
  say('到目前為止得到哪些時間複雜度？', '');
  await step(tok);                                   // 3.8 the types of time functions so far
  pkt('時間函數有哪幾種？', 0, 5.6, 0);
  say('整理一下目前得到的時間函數', '');
  await step(tok);                                   // 8.8 O(1): constant
  col(0);
  say('O(1) 叫 constant（常數）', '');
  await step(tok);                                   // 17.8 2, 5, 5000: all constant
  await ex(0, '2'); await ex(0, '5'); await ex(0, '5000');
  say('時間是 2、5，甚至 5000，都叫 constant', '');
  await step(tok);                                   // 32.8 constant = not dependent on n
  note('constant：跟 n 無關，不是「等於 1」', X(0) + 1.4, 3.4, 0);
  sorter.mood('wow');
  say('constant 的意思：跟輸入大小 n 無關', '不是說值等於 1');
  await step(tok);                                   // 43.8 log n (any base): logarithmic
  col(1); await ex(1, 'log₂ n'); await ex(1, 'log₃ n'); sorter.mood('calm');
  say('log n：底數 2、3 都一樣，叫 logarithmic', '');
  await step(tok);                                   // 64.8 O(n): linear
  col(2);
  say('O(n) 叫 linear（線性）', '');
  await step(tok);                                   // 72.8 2n + 3, 500n + 700 → O(n)
  await ex(2, '2n + 3'); await ex(2, '500n + 700');
  say('2n + 3、500n + 700 都是 O(n)', '');
  await step(tok);                                   // 82.8 n/5000 + 6 → O(n)
  await ex(2, 'n/5000 + 6');
  say('連 n/5000 + 6 也是 O(n)', '');
  await step(tok);                                   // 95.8 degree 1 → write the term n
  note('次數都是 1 → 寫 n 這一項', X(2), 2.6 + 0.6 * h[2], 0);
  await sorter.hop(tok);
  say('它們都是次數 1 的多項式', '寫的是那一項 n，不寫係數');
  await step(tok);                                   // 112.8 n²: quadratic
  col(3); await ex(3, 'n²'); tag('例：矩陣相加', 'idx', X(3), 1.1, 0.9);
  say('n² 叫 quadratic', '矩陣相加');
  await step(tok);                                   // 123.8 n³: cubic (matrix multiplication)
  col(4); await ex(4, 'n³'); tag('例：矩陣相乘', 'idx', X(4), 1.1, 0.9);
  say('n³ 叫 cubic', '矩陣相乘');
  await step(tok);                                   // 131.8 2ⁿ: exponential
  col(5); await ex(5, '2ⁿ');
  say('2ⁿ 叫 exponential（指數）', '之後的影片會遇到');
  await step(tok);                                   // 151.8 2ⁿ, 3ⁿ, nⁿ
  await ex(5, '3ⁿ'); await ex(5, 'nⁿ');
  say('2ⁿ、3ⁿ、nⁿ……都是 exponential', '');
  await step(tok);                                   // 161.8 classes of functions
  okT('classes of functions（函數的類別）', 0, 6.4, 0); sorter.mood('happy'); await sorter.hop(tok);
  say('這些就叫 classes of functions', 'linear class、logarithmic class……');
}]);

// ═══ 5v-tKX2uRAk：1.7 Compare Class of Functions ═══
FRAG.push(['algbari1-class-values', '代值比較：log n、n、n²、2ⁿ', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.2]);
  const X = [-2.1, -0.3, 1.5, 3.3], COL = [AB.green, AB.blue, AB.purple, AB.red];
  const rows = {};
  const ROW = { 1: ['0', '1', '1', '2'], 2: ['1', '2', '4', '4'], 4: ['2', '4', '16', '16'], 8: ['3', '8', '64', '256'], 9: ['≈3.17', '9', '81', '512'] };
  let r = 0;
  const put = async (n) => { const z = -2.3 + r * 1.15; r++; tag(String(n), 'ptr', -4.2, 0.2, z); rows[n] = ROW[n].map((s, q) => cube(s, COL[q], [1.5, 0.45, 0.85], X[q], 0.23, z, 2.5)); await beat(tok, 600); return rows[n]; };
  say('把類別依大小排好', '');
  await step(tok);                                   // 0.8 classes in increasing order
  tag('1 < log n < √n < n < n log n < n² < n³', 'ptr', 0, 2.4, -4.6);
  say('依成長速度排好大小', '1 < log n < √n < n < n log n < n² < n³');
  await step(tok);                                   // 18.8 n³ … n¹⁰⁰ < 2ⁿ < 3ⁿ < nⁿ
  tag('< … < n¹⁰⁰ < 2ⁿ < 3ⁿ < nⁿ', 'ptr alt', 0, 2.4, -4.0);
  say('n⁴、n⁵ 甚至 n¹⁰⁰ 都小於 2ⁿ', '2ⁿ < 3ⁿ < nⁿ');
  await step(tok);                                   // 34.8 take log n, n, n², 2ⁿ
  ['log n', 'n', 'n²', '2ⁿ'].forEach((hd, q) => tag(hd, 'ptr alt', X[q], 0.2, -3.3));
  tag('n', 'ptr alt', -4.2, 0.2, -3.3);
  say('挑 log n、n、n²、2ⁿ，代數字進去比', '');
  await step(tok);                                   // 47.8 n = 1
  await put(1);
  say('n = 1：log 1 = 0、n = 1、n² = 1、2ⁿ = 2', '');
  await step(tok);                                   // 59 n = 2
  await put(2);
  say('n = 2：1、2、4、4', 'n² 和 2ⁿ 一樣大');
  await step(tok);                                   // 66.8 n = 4
  await put(4);
  say('n = 4：2、4、16、16', '又一樣大');
  await step(tok);                                   // 90.5 n = 8: 2ⁿ jumps
  const r8 = await put(8); glow(r8[3], RED);
  say('n = 8：3、8、64、256', '2ⁿ 突然拉開');
  await step(tok);                                   // 122.8 these two were equal here and here
  [2, 4].forEach((n) => { glow(rows[n][2], GOLD); glow(rows[n][3], GOLD); });
  say('前面 n² 和 2ⁿ 曾經相等', '有時小、有時相等');
  await step(tok);                                   // 138.8 from here on 2ⁿ grows faster
  note('從這裡開始，2ⁿ 永遠比較快', 5.6, 0.3, 1.2);
  say('但從某個 n 之後，2ⁿ 一定長得比較快', '');
  await step(tok);                                   // 143 n = 9
  const r9 = await put(9); glow(r9[3], RED);
  say('n = 9：log 約 3.17、n² = 81、2ⁿ = 512', '');
  await step(tok);                                   // 159.6 n² only +17, 2ⁿ doubles
  tag('+17', 'idx', X[2], 0.9, 2.3); tag('×2', 'idx', X[3], 0.9, 2.3);
  say('n 從 8 到 9：n² 只多 17', '2ⁿ 直接翻倍');
  await step(tok);                                   // 184.8 so they are arranged in this order
  okT('log n < n < n² < 2ⁿ', 0, 0.3, 3.3);
  say('所以順序是 log n < n < n² < 2ⁿ', '小 n 時也許相等，之後就固定');
}]);

FRAG.push(['algbari1-n100', 'n¹⁰⁰ 與 2ⁿ：n 要想得夠大', async (tok) => {
  fresh([0, 4.5, 14], [0, 3.2, 0]);
  const NS2 = [10, 100, 500, 1000, 2000];
  let c = 0;
  const pair = async () => {
    const n = NS2[c], x = -5 + c * 2.5, a = 100 * Math.log10(n), b = n * Math.log10(2);
    tag('n = ' + n, 'ptr alt', x, 0, 1.4);
    const m1 = abBar(AB.purple, 0.8, 0.8, x - 0.45, 0), m2 = abBar(AB.red, 0.8, 0.8, x + 0.45, 0);
    await abGrow(tok, m1, a / 120, 300); await abGrow(tok, m2, b / 120, 300);
    tag('10^' + Math.round(a), 'idx', x - 0.45, a / 120 + 0.3); tag('10^' + Math.round(b), 'idx', x + 0.45, b / 120 + 0.65);
    c++; return [m1, m2];
  };
  say('就算 n 的次方很大呢？', '');
  await step(tok);                                   // 194.8 even n¹⁰⁰ < 2ⁿ
  tag('紫 = n¹⁰⁰、紅 = 2ⁿ（高度 = 位數）', 'ptr', 0, 7.2);
  const kid = buddy('', 'n¹⁰⁰？', AB.purple, 5.8, 0, -1.8, 0.7);
  say('n¹⁰⁰ 也比 2ⁿ 小', 'nᵏ 的 k 再大都一樣');
  await step(tok);                                   // 213.8 do not think of n as 1, 2, 10
  await pair();
  bub('n = 10：n¹⁰⁰ 大多了啊？', 5.8, 1.9, -1.8); kid.mood('wow');
  say('n = 10 時 n¹⁰⁰ ≈ 10¹⁰⁰，2ⁿ ≈ 10³', '別把 n 想成 1、2、10 這種小數字');
  await step(tok);                                   // 223.8 n can be anything up to infinity
  await pair(); await pair();
  say('n 可以從 0 一直到無限大', '');
  await step(tok);                                   // 228.8 at some point n¹⁰⁰ falls behind
  const [, b4] = await pair(); glow(b4, GOLD);
  say('n = 1000：2ⁿ 已經超過 n¹⁰⁰', '');
  await step(tok);                                   // 238.5 from then on 2ⁿ is always larger
  await pair();
  okT('交點約 n ≈ 996，之後 2ⁿ 永遠比較大', 0, 6.4); kid.mood('calm');
  say('從某個 n 開始，2ⁿ 永遠比較大', '交點大約在 n ≈ 996');
  await step(tok);                                   // 247.9 a graph: log n, n, n², n³, 2ⁿ
  fresh([0, 5, 15], [0, 3.6, 0]);
  const P = plot(-6, 0, 11.5, 7.2, 8, 64);
  const F = [['log n', (n) => Math.log2(Math.max(n, 1)), AB.green], ['n', (n) => n, AB.blue], ['n²', (n) => n * n, AB.purple], ['n³', (n) => n * n * n, AB.orange], ['2ⁿ', (n) => Math.pow(2, n), AB.red]];
  const cs = [];
  for (const [nm, f, col] of F) { cs.push(P.curve(f, col, 0.01, Math.min(8, nm === 'n³' ? 4 : nm === '2ⁿ' ? 6 : nm === 'n²' ? 8 : 8))); const xe = nm === 'n³' ? 4 : nm === '2ⁿ' ? 6 : 8; tag(nm, 'ptr', P.X(xe) + 0.4, P.Y(f(xe)) + 0.1); await beat(tok, 300); }
  say('畫成圖：log n、n、n²、n³、2ⁿ', '');
  await step(tok);                                   // 267.5 2ⁿ may start smaller, but grows fastest
  glow(cs[4], RED);
  note('2ⁿ 一開始不一定最大，但長得最快', P.X(5.5), P.Y(60), 0.3);
  say('2ⁿ 一開始可能比較小', '但成長速度最快，一下就衝上去');
  await step(tok);                                   // 299.8 this order is very important
  okT('1 < log n < √n < n < n log n < n² < n³ < … < 2ⁿ < 3ⁿ < nⁿ', 0, 8.0);
  say('這個大小順序非常重要', '');
}]);

// ═══ A03oI0znAoc：1.8.1 Asymptotic notations ═══
const AB_CL = ['1', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', '3ⁿ', 'nⁿ'];
FRAG.push(['algbari1-ladder', '類別階梯：2n + 3 的上界與下界', async (tok) => {
  const mode = (ctx.params || {}).mode || 'O';
  fresh([0, 5, 15], [0, 2, 0]);
  const X = (k) => -5.85 + k * 1.3, H = (k) => 0.5 + k * 0.12;
  let ms = [];
  const ladder = (drop) => { ms = AB_CL.map((nm, k) => cube(nm, GRAY, [1.15, H(k), 1], X(k), H(k) / 2, 0, drop ? 3 : 0)); tag('小 ←　函數類別　→ 大', 'idx', 0, 0.1, 1.4); };
  const big = tag('', 'ptr alt', 0, 6.6);
  if (mode === 'intro') {
    say('Asymptotic notation（漸近符號）', '');
    await step(tok);                                 // 15.8 it comes from mathematics
    const f = buddy('f(n)', '2n + 3', AB.red, -4.8, 0, 3.0, 0.8);
    note('來自數學：函數本來就是數學的東西', 0, 5.4, 0);
    say('這個主題來自數學', '時間複雜度用的是函數，所以也用它');
    await step(tok);                                 // 30.8 shows the class of a function
    ladder(true);
    say('符號用來表示「函數屬於哪一類」', '類別已經排好大小');
    await step(tok);                                 // 40.8 this function belongs to some class
    await travel(tok, f.g, V3(-4.8, 0, 3.0), V3(X(3), 0, 2.6), 1000); glow(ms[3], GOLD); f.mood('happy');
    say('例如 2n + 3 屬於 n 這一類', '');
    await step(tok);                                 // 62.8 not a lengthy function every time
    note('不用每次寫一長串函數 → 寫個簡單符號', 3.2, 4.6, 0);
    say('不可能每次都寫一長串函數', '需要簡單、好溝通的寫法');
    await step(tok);                                 // 78.8 Big-O: upper bound
    txt(big, 'Big-O：upper bound（上界）');
    for (let k = 3; k < AB_CL.length; k++) { tint(ms[k], AB.green); await beat(tok, 120); }
    say('Big-O：函數的上界', '');
    await step(tok);                                 // 92.8 Big-Ω: lower bound
    txt(big, 'Big-Ω：lower bound（下界）');
    ms.forEach((m) => tint(m, GRAY));
    for (let k = 3; k >= 0; k--) { tint(ms[k], AB.purple); await beat(tok, 150); }
    say('Big-Ω：函數的下界', '');
    await step(tok);                                 // 110.8 Θ: average bound
    txt(big, 'Θ：average bound（tight bound）');
    ms.forEach((m, k) => tint(m, k === 3 ? AB.gold : GRAY));
    say('Θ：average bound', '課本叫 tight bound，和 average case 無關');
    await step(tok);                                 // 120.8 any function: upper, lower or average
    tag('O', 'good', X(6), H(6) + 0.6); tag('Ω', 'good', X(1), H(1) + 0.6); tag('Θ', 'good', X(3), H(3) + 0.9);
    say('任何函數都能用上界、下界或 average bound 表示', '');
    await step(tok);                                 // 126.8 the useful one: Θ
    glow(ms[3], GOLD); await f.hop(tok);
    say('三個裡最有用的是 Θ', '直接說出它是哪一類');
    await step(tok);                                 // 138.8 why O? when the exact place is unknown
    bub('那 O、Ω 幹嘛用？', 4.6, 3.2, 2.0);
    say('那為什麼要上界？', '定不出確切位置時，至少說出上界');
    await step(tok);                                 // 151.8 one of these, or a multiple of these
    note('複雜度通常是這些類別之一，或它們的乘積', -2.0, 4.0, 0);
    say('算出的時間複雜度通常是這些之一', '或是它們的乘積');
    await step(tok);                                 // 161.8 otherwise use O or Ω
    okT('能寫 Θ 就寫 Θ；寫不出來才用 O 或 Ω', 0, 7.3);
    say('寫不出確切的 Θ 時', '才用 O 或 Ω');
    return;
  }
  ladder(false);
  const f = buddy('f(n)', '2n + 3', AB.red, X(3), 0, 2.6, 0.8);
  if (mode === 'omega') {
    say('Big-Ω 的定義', '');
    await step(tok);                                 // 594.8 f ≥ c·g for n ≥ n₀
    txt(big, 'f(n) = Ω(g(n)) ⇔ 存在 c、n₀：n ≥ n₀ 時 f(n) ≥ c·g(n)');
    say('Ω：存在正常數 c、n₀', 'n ≥ n₀ 時 f(n) ≥ c·g(n)');
    await step(tok);                                 // 610.8 only the inequality flips
    note('跟 Big-O 比：只把 ≤ 換成 ≥', 0, 5.6, 0);
    say('跟 Big-O 比只換了不等號方向', '≤ 變成 ≥');
    await step(tok);                                 // 624.8 2n + 3 ≥ 1·n
    const fm = tag('2n + 3 ≥ 1·n', 'ptr', 3.6, 4.6, 0);
    say('同一個例子：2n + 3 ≥ 1·n', '取 c = 1 就好');
    await step(tok);                                 // 648.8 for all n ≥ 1 (even from 0)
    txt(fm, '2n + 3 ≥ 1·n，n ≥ 1（從 0 也成立）');
    say('n ≥ 1 都成立，從 0 開始也可以', '');
    await step(tok);                                 // 683.8 → Ω(n)
    for (let k = 3; k >= 0; k--) { tint(ms[k], AB.purple); await beat(tok, 200); }
    okT('Ω(n) ✓', X(3), H(3) + 0.9); f.mood('happy');
    say('所以 f(n) = Ω(n)', '');
    await step(tok);                                 // 697.8 Ω(log n) is also true
    okT('Ω(log n) ✓', X(1), H(1) + 0.9);
    say('換成 log n 呢？2n + 3 ≥ log n 也成立', 'Ω(log n) 也對');
    await step(tok);                                 // 713.8 it belongs to n's class: not beyond
    glow(ms[3], GOLD);
    say('f 屬於 n 這一類', '下界不能超過 n 這一格');
    await step(tok);                                 // 725.8 Ω(n²) is wrong
    glow(ms[5], RED); noT('Ω(n²) ✗：n² 是上界', X(5), H(5) + 0.9); f.mood('sad');
    say('Ω(n²) 錯：n² 是上界，不是下界', '');
    await step(tok);                                 // 735.8 log log n, √n, log n: all true
    okT('Ω(√n) ✓', X(2), H(2) + 1.5); f.mood('calm');
    say('n 左邊的都對：log log n、√n、log n', '');
    await step(tok);                                 // 747.8 the nearest one is useful
    glow(ms[5], null); glow(ms[3], GREEN); await f.hop(tok);
    say('最有用的是最接近的那個：Ω(n)', '更小的雖然對，但沒用');
    return;
  }
  // mode 'O'
  say('2n + 3 的上界有很多', '');
  await step(tok);                                   // 430 O(n), O(n²) both true
  tint(ms[3], AB.green); tint(ms[5], AB.green);
  txt(big, '2n + 3 ≤ 5n、也 ≤ 5n²');
  say('O(n) 對，O(n²) 也對', 'n、n² 都是它的上界');
  await step(tok);                                   // 442.8 f belongs to n's class
  glow(ms[3], GOLD); f.mood('happy');
  say('f(n) 本身屬於 n 這一類', '');
  await step(tok);                                   // 456.8 n and everything larger: upper bounds
  for (let k = 3; k < AB_CL.length; k++) { tint(ms[k], AB.green); await beat(tok, 150); }
  txt(big, 'n 和右邊全部 = 上界（upper bound）');
  say('n 和右邊所有更大的類別', '都是上界');
  await step(tok);                                   // 472.8 n and everything smaller: lower bounds
  for (let k = 2; k >= 0; k--) { tint(ms[k], AB.purple); await beat(tok, 200); }
  tag('左邊 = 下界', 'ptr alt', X(1), 3.0);
  say('n 和左邊所有更小的類別', '都是下界');
  await step(tok);                                   // 481.8 n itself: the average bound
  tint(ms[3], AB.gold);
  tag('n = average（tight）bound', 'ptr', X(3), 3.6);
  say('n 自己就是 average bound', '');
  await step(tok);                                   // 509.8 O(n), O(n²), O(2ⁿ): all true
  okT('O(n) ✓', X(3), H(3) + 1.6); okT('O(n²) ✓', X(5), H(5) + 0.9); okT('O(2ⁿ) ✓', X(7), H(7) + 0.9);
  say('O(n)、O(n²)、O(2ⁿ) 都對', '');
  await step(tok);                                   // 522.8 O(log n) is wrong
  glow(ms[1], RED); noT('O(log n) ✗', X(1), H(1) + 0.9); f.mood('sad');
  say('但 O(log n) 錯', 'log n 在下界那一邊');
  await step(tok);                                   // 552.8 write the closest function
  glow(ms[1], null); glow(ms[3], GREEN); f.mood('happy'); await f.hop(tok);
  say('寫 Big-O 時，寫最接近的函數', 'O(n)');
  await step(tok);                                   // 574.8 larger ones: true but not useful
  note('寫更大的不算錯，但沒有用', X(7), 4.6, 0);
  say('寫更大的不算錯', '但沒有用');
}]);

FRAG.push(['algbari1-bigo-5n', 'Big-O：2n + 3 ≤ 10n、5n、5n²', async (tok) => {
  fresh([0, 5, 15], [0, 3.8, 0]);
  const P = plot(-6, 0, 11.5, 7.2, 10, 70);
  say('Big-O 的定義', '');
  await step(tok);                                   // 179.8 the definition
  tag('f(n) = O(g(n)) ⇔ 存在正常數 c、n₀：n ≥ n₀ 時 f(n) ≤ c·g(n)', 'ptr', 0, 8.2);
  say('存在正常數 c 和 n₀', '讓所有 n ≥ n₀ 都有 f(n) ≤ c·g(n)');
  await step(tok);                                   // 204.8 example f(n) = 2n + 3
  P.curve((n) => 2 * n + 3, AB.red); tag('f(n) = 2n + 3', 'ptr', P.X(10) + 0.2, P.Y(23) - 0.3);
  say('例子：f(n) = 2n + 3', '');
  await step(tok);                                   // 215.8 2n + 3 ≤ something
  const q = bub('2n + 3 ≤ ？', P.X(3), P.Y(45), 0);
  say('2n + 3 ≤ 右邊要寫什麼？', '要比它大或相等');
  await step(tok);                                   // 236.8 a single term, with a coefficient
  note('右邊只寫「一項」，可以帶係數 c', P.X(3), P.Y(58), 0);
  say('右邊不能寫好幾項', '只寫一項，可以帶係數');
  await step(tok);                                   // 251.8 10n; n = 1: 10 > 5
  remove(q);
  const g10 = P.curve((n) => 10 * n, AB.green, 0, 7); const l10 = tag('10n', 'ptr alt', P.X(7) - 0.4, P.Y(70) + 0.2);
  tag('n = 1：10 ≥ 5', 'idx', P.X(1) + 0.9, P.Y(10) + 0.4);
  say('寫 10n：n = 1 時 10 > 5', '');
  await step(tok);                                   // 264.8 for all n ≥ 1
  P.vmark(1, '#c08a1f', 'n₀ = 1');
  say('從 n = 1 開始都成立', 'n₀ = 1');
  await step(tok);                                   // 272.8 c = 10, g(n) = n → O(n)
  okT('c = 10、g(n) = n → f(n) = O(n)', P.X(5), P.Y(66), 0);
  say('c = 10、g(n) = n', 'f(n) = O(n)');
  await step(tok);                                   // 305.8 7n, 1000n: anything works
  const g7 = P.curve((n) => 7 * n, AB.teal, 0, 10); const l7 = tag('7n', 'ptr alt', P.X(10) + 0.2, P.Y(70));
  say('寫 7n、1000n 也都可以', '只要從某個 n 起比 f(n) 大');
  await step(tok);                                   // 339.8 easy way: 2n + 3n = 5n
  kill(g10); kill(l10); kill(g7); kill(l7);
  P.curve((n) => 5 * n, AB.green); tag('5n', 'ptr alt', P.X(10) + 0.2, P.Y(50));
  say('簡單做法：3 也寫成 3n', '2n + 3 ≤ 2n + 3n = 5n');
  await step(tok);                                   // 360.8 n = 1: both 5
  tag('n = 1：兩邊都是 5', 'idx', P.X(1) + 1.0, P.Y(5) + 0.5);
  say('n = 1 時兩邊都是 5', 'n 再大，5n 一定比較大');
  await step(tok);                                   // 378.8 make every term a multiple of n
  note('技巧：每一項都變成 n 的倍數', P.X(3), P.Y(52), 0);
  say('技巧：把每一項都變成 n 的倍數', '');
  await step(tok);                                   // 384.8 2n² + 3n² = 5n²
  P.curve((n) => 5 * n * n, AB.purple, 0, 3.74); tag('5n²', 'ptr', P.X(3.74), P.Y(70) + 0.3);
  say('也可以 2n + 3 ≤ 2n² + 3n² = 5n²', 'n ≥ 1 一樣成立');
  await step(tok);                                   // 408.8 g(n) = n² → O(n²) also true
  okT('g(n) = n² → f(n) = O(n²) 也對', P.X(5), P.Y(60), 0);
  say('g(n) = n²：f(n) = O(n²) 也對', '');
}]);

FRAG.push(['algbari1-theta', 'Θ：1·n ≤ 2n + 3 ≤ 5n', async (tok) => {
  fresh([0, 5, 15], [0, 3.8, 0]);
  const P = plot(-6, 0, 11.5, 7.2, 12, 64);
  say('Θ 的定義', '');
  await step(tok);                                   // 781.8 c₁·g(n) ≤ f(n) ≤ c₂·g(n)
  tag('f(n) = Θ(g(n)) ⇔ 存在 c₁、c₂、n₀：c₁·g(n) ≤ f(n) ≤ c₂·g(n)', 'ptr', 0, 8.2);
  say('存在 c₁、c₂、n₀', '讓 c₁·g(n) ≤ f(n) ≤ c₂·g(n)');
  await step(tok);                                   // 796.8 the same example 2n + 3
  P.curve((n) => 2 * n + 3, AB.red); tag('2n + 3', 'ptr', P.X(12) + 0.4, P.Y(27));
  say('同一個例子：2n + 3', '');
  await step(tok);                                   // 807.8 lower bound 1·n
  P.curve((n) => n, AB.purple); tag('1·n（c₁ = 1）', 'ptr', P.X(12) + 0.6, P.Y(12));
  say('下界前面找過了：1·n', '');
  await step(tok);                                   // 812.8 upper bound 5·n
  P.curve((n) => 5 * n, AB.green); tag('5n（c₂ = 5）', 'ptr alt', P.X(12) + 0.6, P.Y(60));
  say('上界也找過了：5·n', '');
  await step(tok);                                   // 828.8 both sides g(n) = n → Θ(n)
  P.vmark(1, '#c08a1f', 'n₀ = 1'); P.zone(1, 12);
  okT('兩邊都是 n → f(n) = Θ(n)', P.X(4), P.Y(56), 0);
  say('兩邊的 g(n) 都是 n', 'f(n) = Θ(n)');
  await step(tok);                                   // 841.8 average bound: exactly this class
  note('f 被夾在中間：它就是 n 這一類', P.X(4), P.Y(48), 0);
  say('Θ 是 average bound', '說的就是 f 剛好屬於 n 這一類');
  await step(tok);                                   // 850.8 Θ(n²) is wrong
  const bad = P.curve((n) => 0.25 * n * n, AB.gold, 0, 12); const bl = tag('0.25·n²', 'ptr alt', P.X(11), P.Y(36) + 0.5);
  noT('Θ(n²) ✗', P.X(8), P.Y(30), 0);
  say('Θ(n²) 不行：下界 c₁·n² 遲早超過 f', '');
  await step(tok);                                   // 865.8 Θ(log n) is wrong too
  kill(bad); kill(bl);
  P.curve((n) => 4 * Math.log2(n + 1), AB.teal, 0, 12); tag('4·log n', 'ptr alt', P.X(12) + 0.6, P.Y(15) - 0.4);
  noT('Θ(log n) ✗：c₂·log n 蓋不住 f', P.X(8), P.Y(22), 0);
  say('Θ(log n) 也不行：上界 c₂·log n 蓋不住 f', '兩邊只能用 n');
  await step(tok);                                   // 880.8 Θ is recommended
  okT('能寫 Θ 最好；做不到才用 O 或 Ω', P.X(4), P.Y(64), 0);
  say('能寫 Θ 就寫 Θ', '做不到才用 O 或 Ω');
  await step(tok);                                   // 896.8 do not mix with best / worst case
  const mix = buddy('', 'O = worst？', AB.orange, 5.6, 0, 2.6, 0.7); mix.mood('wow');
  say('不要把它們和 best case、worst case 混在一起', '');
  await step(tok);                                   // 914.8 O ≠ worst case, Ω ≠ best case
  mix.set('✗'); mix.mood('sad');
  noT('O ≠ worst case、Ω ≠ best case', 3.6, 2.4, 2.6);
  say('很多人以為 O 是 worst case、Ω 是 best case', '不對：任何 case 都能用任何符號');
  await step(tok);                                   // 935.8 just bounds of a function
  mix.set('界'); mix.mood('happy'); await mix.hop(tok);
  say('這些符號只是函數的「界」', '跟 case analysis 是兩回事');
}]);

// ═══ tTFolqL1TX4：交大江蕙如 Lec05 ═══
FRAG.push(['algbari1-abuse-eq', 'O、Ω、Θ 回顧：「=」其實是「∈」', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.4, 0]);
  const T = [['Big-O', 'upper bound', AB.green], ['Big-Ω', 'lower bound', AB.purple], ['Θ', 'tight bound', AB.gold]];
  say('上次的三個 notation', 'upper bound、lower bound、tight bound');
  for (let k = 0; k < 3; k++) { const x = -3.6 + k * 3.6; cube(T[k][0], T[k][2], [2.4, 0.7, 1], x, 0.35, -2.2, 3); tag(T[k][1], 'idx', x, 1.2, -2.2); await beat(tok, 700); }
  await beat(tok, 1200);
  say('證明要 by definition', '找出適當的 c 和 n₀，讓不等式成立');
  await beat(tok, 2800);
  const gb = ghostBox(AB.green, 7.4, 1.6, 2.4); gb.position.set(0, 0.8, 1.6);
  tag('O(f(n))：一群函數（集合）', 'ptr alt', 0, 2.1, 1.6);
  const mem = ['g₁(n)', 'g₂(n)', 'g₃(n)'].map((s, k) => cube(s, AB.blue, [1.5, 0.5, 0.9], -2.4 + k * 1.6, 0.25, 1.6, 2.5));
  say('O(f(n)) 是一個集合', '所有以 f(n) 為上界的函數');
  await beat(tok, 2600);
  const t = cube('T(n)', AB.red, [1.5, 0.5, 0.9], 2.6, 0.25, 1.6, 4);
  say('習慣寫 T(n) = O(f(n))', '這個等號其實是 abuse');
  await beat(tok, 2400);
  glow(t, GOLD); mem.forEach((m) => glow(m, null));
  tag('T(n) ∈ O(f(n))', 'ptr', 2.6, 1.2, 2.9);
  say('寫等號，心裡要知道是「屬於」', 'T(n) = O(f(n))  ≡  T(n) ∈ O(f(n))');
  await beat(tok, 3200);
}]);

FRAG.push(['algbari1-props', 'O、Ω、Θ 的性質：遞移、對稱、反身', async (tok) => {
  const which = (ctx.params || {}).which;
  const bars = (spec) => spec.map(([nm, h, col, x]) => { const b = abBar(col, 1.2, 1.2, x, 0); tag(nm, 'ptr', x, 0, 1.2); return { b, h, x, nm }; });
  if (which !== 'sym') {
    fresh([0, 5, 14], [0, 2.6, 0]);
    const B = bars([['f', 1.6, AB.blue, -3.4], ['g', 3.2, AB.purple, 0], ['h', 4.8, AB.red, 3.4]]);
    say('三個函數 f、g、h', 'transitivity（遞移性）');
    for (const o of B) await abGrow(tok, o.b, o.h, 400);
    await beat(tok, 1000);
    const top = (o) => V3(o.x, o.h + 0.2, 0);
    let a1 = arrow(top(B[0]), top(B[1])); tag('f = O(g)', 'ptr alt', -1.7, 3.2);
    say('g 是 f 的 upper bound', 'f(n) = O(g(n))'); await beat(tok, 2200);
    arrow(top(B[1]), top(B[2])); tag('g = O(h)', 'ptr alt', 1.7, 4.8);
    say('h 是 g 的 upper bound', 'g(n) = O(h(n))'); await beat(tok, 2200);
    kill(a1);
    const a3 = arrow(V3(-3.4, 1.9, 0.8), V3(3.4, 5.1, 0.8), 0xc08a1f); tag('f = O(h)', 'ptr', 0, 6.2);
    say('所以 h 也是 f 的 upper bound', 'f = O(g)、g = O(h) ⇒ f = O(h)'); await beat(tok, 2600);
    say('lower bound 也一樣：比它小、再比它小', 'O、Ω、Θ 都有遞移性'); await beat(tok, 3000);
    kill(a3);
    if (which === 'trans') return;
  }
  fresh([0, 5, 14], [0, 2.6, 0]);
  const B2 = bars([['f', 1.8, AB.blue, -4.2], ['g', 4, AB.purple, -1.8]]);
  for (const o of B2) await abGrow(tok, o.b, o.h, 350);
  tag('g 是 f 的上界', 'ptr alt', -1.8, 4.6); tag('f 是 g 的下界', 'ptr alt', -4.2, 2.4);
  say('transpose symmetry', 'f = O(g) ⇔ g = Ω(f)'); await beat(tok, 2800);
  const B3 = bars([['f', 2.8, AB.teal, 1.2]]); await abGrow(tok, B3[0].b, 2.8, 350);
  tag('f = O(f) = Ω(f) = Θ(f)', 'ptr alt', 1.2, 3.4);
  say('reflexivity：自己是自己的界', 'upper、lower、tight 都是'); await beat(tok, 2800);
  const B4 = bars([['f', 3, AB.orange, 3.6], ['g', 3, AB.gold, 5.2]]);
  await abGrow(tok, B4[0].b, 3, 500); await abGrow(tok, B4[1].b, 3, 500);
  tag('f = Θ(g) ⇔ g = Θ(f)', 'ptr alt', 4.4, 3.6);
  say('symmetry（只對 Θ）：表現一模一樣', 'f = Θ(g) ⇔ g = Θ(f)'); await beat(tok, 2800);
  say('每一條都能 by definition 證明', '回家挑幾條試試'); await beat(tok, 2600);
}]);

FRAG.push(['algbari1-rule-sums', 'Rule of sums：加起來 = 取 max', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  const L = [['line 1', 'O(1)', 0.4, AB.teal], ['line 2', 'O(n)', 1.6, AB.blue], ['line 3', 'O(n²)', 5, AB.red], ['line 4', 'O(n)', 1.6, AB.blue]];
  say('algorithm 有很多行，每行難度不同', '每行的 running time 不一樣');
  const ms = [];
  for (let r = 0; r < L.length; r++) {
    const [nm, big, w, col] = L[r], y = 6 - r * 1.0;
    tag(nm, 'ptr', -5.2, y); tag(big, 'idx', -4, y);
    const m = cube('', col, [w, 0.6, 1], -3 + w / 2, y, 0); ms.push(m);
    await beat(tok, 700);
  }
  await beat(tok, 1200);
  say('整個 algorithm = 每行時間加起來', 'f₁ + f₂ + …');
  let x = -6;
  for (let r = 0; r < L.length; r++) { const w = L[r][2]; move(ms[r], x + w / 2, 0.3, 1.2); x += w + 0.05; await beat(tok, 500); }
  tag('total', 'ptr alt', -6.6, 0.3, 2.2);
  await beat(tok, 1600);
  glow(ms[2], RED);
  say('結果等於最花時間的那一行', 'f₁ + f₂ = O(max(g₁, g₂))'); await beat(tok, 3000);
  say('bottleneck 綁在最慢的步驟', '這裡：O(1) + O(n) + O(n²) + O(n) = O(n²)'); await beat(tok, 3000);
}]);

FRAG.push(['algbari1-rule-products', 'Rule of products：迴圈 = 圈數 × 每圈', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.4, 0]);
  code(['for (…)            // 跑 f₁ 圈', '{', '  每圈要做的事    // 每圈 f₂', '}'], -1.8, 6.8, 0.5);
  say('for / while loop 的長相', '先看跑幾圈，再看每圈做多少');
  await beat(tok, 2400);
  const R = 5, W = 3;
  tag('f₁ = 5 圈（示意）', 'ptr alt', -5, 0.2, -2.6);
  for (let r = 0; r < R; r++) { tag('第 ' + (r + 1) + ' 圈', 'idx', -4.6, 0.2, -1.8 + r * 0.9); }
  await beat(tok, 1400);
  say('每一圈內部做 f₂ 的工作', 'f₂ = 3（示意）');
  for (let r = 0; r < R; r++) { for (let c = 0; c < W; c++) { cube('', AB.purple, [0.9, 0.4, 0.7], -2.6 + c * 1.1, 0.2, -1.8 + r * 0.9, 2.5); await beat(tok, 120); } await beat(tok, 200); }
  tag('5 × 3 = 15', 'ptr', 2.4, 0.4, 0);
  say('total = f₁ × f₂', '');
  await beat(tok, 2200);
  say('f₁ = O(g₁)、f₂ = O(g₂)', '⇒ f₁·f₂ = O(g₁·g₂)；Ω、Θ 也成立');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-poly-ladder', '常見複雜度：polynomial 與更高', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.2, 0]);
  const P1 = [['O(1)', 'constant'], ['O(log n)', 'logarithmic'], ['O(n^0.5)', 'sublinear'], ['O(n)', 'linear'], ['O(n log n)', 'loglinear'], ['O(n²)', 'quadratic'], ['O(n³)', 'cubic'], ['O(n⁴)', 'quartic']];
  say('polynomial time：O(p(n))', 'p(n) 是 nᵈ 的形式，d 是常數');
  await beat(tok, 2600);
  const ms = [];
  for (let k = 0; k < P1.length; k++) {
    const x = -5.6 + k * 1.6, h = 0.4 + k * 0.28;
    ms.push(cube(P1[k][0], AB.blue, [1.4, h, 1], x, h / 2, 0, 3)); tag(P1[k][1], 'idx', x, 0.1, 1.0);
    say(P1[k][0] + '：' + P1[k][1], k === 0 ? 'n⁰ = 1：跟 input size 無關' : k === 2 ? '√n：還不到 n¹，比 linear 小' : k === 4 ? 'linear × log' : '');
    await beat(tok, k === 0 || k === 2 ? 2000 : 1200);
  }
  tag('n¹⁰⁰、n^10000000 也是 polynomial', 'ptr alt', 0, 3.4, 0);
  say('n 的超大次方仍是 polynomial', '理論上符合，實務上用不了');
  await beat(tok, 2600);
  const NP = [['O(2ⁿ)', 'exponential'], ['O(n!)', 'factorial'], ['O(nⁿ)', '']];
  for (let k = 0; k < NP.length; k++) { const x = -2.4 + k * 2.4; cube(NP[k][0], AB.red, [1.8, 0.8, 1], x, 0.4, 2.8, 3); if (NP[k][1]) tag(NP[k][1], 'idx', x, 0.1, 3.7); await beat(tok, 700); }
  say('2ⁿ、3ⁿ…都叫 exponential', 'n! factorial、nⁿ 更大');
  await beat(tok, 2400);
  for (let k = 0; k < 6; k++) glow(ms[k], GREEN);
  say('實作上希望做到 n² 以下', '才能處理蠻大的 problem size');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-review', 'Gale-Shapley 回顧：性質', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.8, 0]);
  const cd = code(AB_GS, -1.6, 7.6, 0.48);
  say('回到 Gale-Shapley algorithm', '今天要看它的 running time');
  await beat(tok, 2400);
  cd.hl(1); say('每圈：一個 free man 向還沒求過的', '最喜歡的女生求婚'); await beat(tok, 2200);
  cd.hl(3); await beat(tok, 700); cd.hl(5); say('女生依喜好 accept 或 reject', ''); await beat(tok, 1800);
  cd.hl(8); say('沒有 free man → 跳出，engaged 變 married', ''); await beat(tok, 2000);
  cd.hl(-1);
  const P = [['≤ n² 次 iteration 必停', AB.blue], ['perfect matching', AB.green], ['stable', AB.green], ['man-optimal', AB.purple], ['woman-pessimal', AB.pink], ['求婚順序不影響結果', AB.orange]];
  for (let k = 0; k < P.length; k++) {
    const x = -4 + (k % 3) * 4, z = k < 3 ? 1.2 : 2.8;
    cube(P[k][0], P[k][1], [3.6, 0.5, 1.1], x, 0.25, z, 3);
    say(P[k][0], k === 0 ? 'n 個男生、n 個女生' : k === 3 ? '男生配到最好的 valid partner' : k === 4 ? '女生只配到最差的 valid partner' : '');
    await beat(tok, 1500);
  }
  say('今天重點：第一項 termination', '只知道 ≤ n² 圈，還不知道 running time');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-budget', 'GS 的 running time：n² 圈 × O(1)', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.8, 0]);
  const cd = code(AB_GS, -1.6, 7.6, 0.48);
  say('用 rule of sums：每段時間加起來', '分三大段：line 1、2–8、9');
  await beat(tok, 2400);
  cd.hl(0); tag('O(n)', 'ptr alt', 5.2, 7.6); say('line 1：把所有人設成 free', '每人掃一次 → O(n)'); await beat(tok, 2200);
  cd.hl(8); tag('O(n)', 'ptr alt', 5.2, 3.76); say('line 9：輸出每個男生配誰', '有記錄配對 → O(n)'); await beat(tok, 2200);
  cd.hl(1); tag('≤ n² 圈 × ?', 'ptr alt', 5.2, 7.12); say('line 2–8：while 最多 n² 圈', 'rule of products：圈數 × 每圈時間'); await beat(tok, 2800);
  cd.hl(-1);
  const b1 = abBar(AB.teal, 1.2, 1.2, -3.6, 1.8), b2 = abBar(AB.red, 1.2, 1.2, 0, 1.8), b3 = abBar(AB.teal, 1.2, 1.2, 3.6, 1.8);
  tag('line 1', 'idx', -3.6, 0, 3); tag('n² × O(1)', 'idx', 0, 0, 3); tag('line 9', 'idx', 3.6, 0, 3);
  await abGrow(tok, b1, 0.8, 300); await abGrow(tok, b3, 0.8, 300);
  say('每圈最快也只能 O(1)', '目標：每個 iteration 都做到 O(1)');
  await abGrow(tok, b2, 3, 700);
  await beat(tok, 2200);
  glow(b2, GOLD);
  say('取 max：O(n) + O(n²) + O(n)', '= O(n²)');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-four-ops', 'line 2、3、4、6 各要 O(1)', async (tok) => {
  fresh([0, 6.5, 13.5], [0, 2.6, 0]);
  const cd = code(AB_GS, -1.6, 7.6, 0.48);
  say('line 5、7、8 只是簡單指定', '難處理的是 line 2、3、4、6');
  await beat(tok, 2600);
  const OPS = [[1, 'L2：O(1) 找出一個 free man', '哪個 free man 先都可以'], [2, 'L3：O(1) 找他還沒求過的第一名', 'highest-ranked woman'], [3, 'L4：O(1) w 是 free 嗎？未婚夫是誰？', '要知道 fiancé m′'], [5, 'L6：O(1) w 比較喜歡 m 還是 m′', '給一個女生、兩個男生']];
  for (let k = 0; k < OPS.length; k++) {
    const [ln, card, sub] = OPS[k];
    cd.hl(ln);
    cube(card, [AB.blue, AB.green, AB.purple, AB.red][k], [5.6, 0.5, 1], k % 2 ? 3 : -3, 0.25, k < 2 ? 1.2 : 2.8, 3);
    say(card.slice(0, 2) + ' 的需求', sub);
    await beat(tok, 2800);
  }
  cd.hl(-1);
  say('四件事都 O(1) → 整體 O(n²)', '接下來：選 data structure');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-arrays', '男生女生編號 1..n、ManPref 用 array', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.8, 0]);
  const MX = [-5, -3.9, -2.8], WX = [2.8, 3.9, 5];
  tag('男生', 'ptr', -3.9, 1.2, -2.8); tag('女生', 'ptr', 3.9, 1.2, -2.8);
  const men = ['X', 'Y', 'Z'].map((s, k) => cube(s, AB.blue, [1, 0.6, 0.9], MX[k], 0.3, -2.8, 3));
  const wom = ['Amy', 'Bertha', 'Clare'].map((s, k) => cube(s, AB.pink, [1, 0.6, 0.9], WX[k], 0.3, -2.8, 3));
  say('不存名字，用數字代表', 'n 個男生、n 個女生');
  await beat(tok, 2400);
  men.forEach((m, k) => relabel(m, k + 1)); wom.forEach((m, k) => relabel(m, k + 1));
  say('男生 1..n、女生也 1..n', '兩邊 index 不會打架，不用 n+1..2n');
  await beat(tok, 2800);
  tag('兩個長度 n 的 array', 'ptr alt', 0, 1.6, -2.8);
  await beat(tok, 1400);
  tag('ManPref', 'ptr', -3.6, 0.3, -0.6);
  const PREF = [[1, 2, 3], [2, 1, 3], [1, 2, 3]], NAMES = ['Amy', 'Bertha', 'Clare'];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    tag('男 ' + (r + 1), 'ptr alt', -3.6, 0.3, 0.5 + r * 1.1);
    cells.push(PREF[r].map((w, c) => cube(NAMES[w - 1], AB.sand, [1.3, 0.45, 0.85], -1.6 + c * 1.5, 0.23, 0.5 + r * 1.1, 2.5)));
    await beat(tok, 600);
  }
  say('男生 1：Amy、Bertha、Clare', '名字換成編號');
  await beat(tok, 1800);
  for (let r = 0; r < 3; r++) { cells[r].forEach((m, c) => relabel(m, PREF[r][c])); await beat(tok, 500); }
  say('1：1 2 3、2：2 1 3、3：1 2 3', '只剩數字');
  await beat(tok, 2600);
  say('每個男生後面串一個 n 格 array', 'preference list 長度固定 → array 就好');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-free-why', 'free man 數量會變：不適合 static array', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1, 0]);
  const n = 5, X = (k) => -4 + k * 1.6;
  tag('男生 1..5 的狀態', 'ptr', 0, 0.4, -2.6);
  const ms = [];
  for (let k = 0; k < n; k++) ms.push(cube(String(k + 1), AB.green, [1.2, 0.6, 1], X(k), 0.3, -1.4, 3));
  const cnt = tag('free：5 人', 'ptr alt', 0, 1.6, -1.4);
  say('line 2：要很快判斷有沒有 free man', '希望 O(1) 取出一個');
  await beat(tok, 2600);
  const EV = [[0, false, '男 1 訂婚'], [1, false, '男 2 訂婚'], [0, true, '男 1 被甩，又變 free'], [2, false, '男 3 訂婚']];
  let free = 5;
  for (const [k, toFree, s] of EV) {
    tint(ms[k], toFree ? AB.green : GRAY); free += toFree ? 1 : -1; txt(cnt, 'free：' + free + ' 人');
    say(s, 'free 人數 = ' + free);
    await beat(tok, 1600);
  }
  say('free 名單長度一直在變（dynamic）', '→ 不適合 static array');
  await beat(tok, 2600);
  tag('ManPref[1]：長度固定 n', 'ptr', 0, 0.4, 1.2);
  [1, 2, 3, 4, 5].forEach((v, k) => cube(String(v), AB.sand, [1.2, 0.45, 0.9], X(k), 0.23, 2.3, 2.5));
  say('preference list 長度不變 → array OK', '');
  await beat(tok, 2400);
  say('free 名單用 linked list', '誰先處理不重要；insert / delete O(1)');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-free-list', 'free man 的 linked list：取出與放回', async (tok) => {
  const phase = (ctx.params || {}).phase;
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const XS = [-2.8, -0.2, 2.4], Y = 0.4;
  const nodes = XS.map((x, k) => lnode(k + 1, x, Y, 0, AB.blue));
  const links = [];
  const linkArrow = (xa, xb) => arrow(V3(xa + 0.95, Y, 0), V3(xb - 0.55, Y, 0));
  tag('first', 'ptr', -5.6, Y + 0.9);
  let firstA = arrow(V3(-5.6, Y + 0.6, 0), V3(XS[0] - 0.55, Y, 0));
  links.push(linkArrow(XS[0], XS[1]), linkArrow(XS[1], XS[2]));
  tag('NULL', 'ptr alt', 4.6, Y);
  links.push(arrow(V3(XS[2] + 0.95, Y, 0), V3(4.1, Y, 0)));
  if (phase !== 'ops') {
    say('單向 linked list：一串名單', '一開始所有男生都是 free');
    await beat(tok, 2400);
    glow(nodes[0].userData.data, GOLD);
    say('first pointer 指向第一筆', ''); await beat(tok, 2000); glow(nodes[0].userData.data, null);
    const dt = tag('data：男生編號', 'idx', XS[0], Y + 1.1, 0), lk = tag('link → 下一筆', 'idx', XS[0] + 0.9, Y - 0.9, 0);
    say('每筆資料：data 欄位 + link 欄位', 'link 是 pointer，指向下一筆'); await beat(tok, 2800);
    kill(dt); kill(lk);
    say('最後一筆的 link 是 NULL', '1 → 2 → 3 → NULL'); await beat(tok, 2200);
    say('first == NULL → 沒有 free man', '→ while 結束'); await beat(tok, 2400);
    if (phase === 'build') { await beat(tok, 600); return; }
  }
  say('有 free man：取第一個就好', '順序不重要'); await beat(tok, 2000);
  glow(nodes[0].userData.data, GOLD);
  move(nodes[0], XS[0], 3.6, -1); kill(links[0]); kill(firstA);
  firstA = arrow(V3(-5.6, Y + 0.6, 0), V3(XS[1] - 0.55, Y, 0));
  say('delete：first = first→next', '男 1 去 propose，離開名單'); await beat(tok, 3000);
  say('男 1 被甩 → 又變 free', 'insert 回名單最前面'); await beat(tok, 2000);
  move(nodes[0], XS[0], Y, 0); await beat(tok, 900);
  links[0] = linkArrow(XS[0], XS[1]);
  say('新節點的 next = 原本的 first', ''); await beat(tok, 1800);
  kill(firstA); firstA = arrow(V3(-5.6, Y + 0.6, 0), V3(XS[0] - 0.55, Y, 0));
  glow(nodes[0].userData.data, null);
  say('first 指向新節點', ''); await beat(tok, 1600);
  say('只重綁一兩個 pointer，跟 n 無關', 'insert / delete 都是 O(1)'); await beat(tok, 3000);

}]);

FRAG.push(['algbari1-gs-next', 'Next[m]：下一個要求婚的名次', async (tok) => {
  fresh([0, 8, 10.5], [0, 0.4, 0.4]);
  const PREF = [[1, 2, 3], [2, 1, 3], [1, 2, 3]], Z = (r) => -1.2 + r * 1.4, CX = (c) => -2.6 + c * 1.3;
  tag('ManPref（第 1、2、3 名）', 'ptr', -1.3, 0.3, -2.4); tag('Next', 'ptr', 2.6, 0.3, -2.4);
  for (let r = 0; r < 3; r++) { tag('男 ' + (r + 1), 'ptr alt', -4.6, 0.3, Z(r)); PREF[r].forEach((w, c) => cube('女' + w, AB.sand, [1.1, 0.45, 0.9], CX(c), 0.23, Z(r))); }
  say('line 3：O(1) 找到下一個求婚對象', '每個男生多開一個欄位 Next');
  await beat(tok, 2600);
  const nx = [0, 1, 2].map((r) => cube('1', AB.gold, [0.9, 0.5, 0.9], 2.6, 0.25, Z(r), 3));
  say('一開始 Next 全部 = 1', 'n 個男生各填一次 → O(n)，不影響 O(n²)');
  await beat(tok, 2800);
  const cur = tag('▼', 'ptr alt', CX(0), 1.1, Z(0));
  const step = async (r, c, acc, cap, sub) => {
    cur.position.set(CX(c), 1.1, Z(r)); await beat(tok, 700);
    say(cap, sub);
    relabel(nx[r], c + 2); glow(nx[r], GOLD); await beat(tok, 500); glow(nx[r], null);
    await beat(tok, 1600);
  };
  await step(0, 0, true, '男 1 向第 1 名（女 1）求婚：accept', 'propose 完 Next[1] = 2');
  await step(1, 0, true, '男 2 向第 1 名（女 2）求婚：accept', 'Next[2] = 2');
  await step(2, 0, false, '男 3 向女 1 求婚：被 reject', 'Next[3] = 2');
  await step(2, 1, false, '男 3 向女 2 求婚：又被 reject', 'Next[3] = 3');
  cur.position.set(CX(2), 1.1, Z(2)); glow(nx[2], GREEN);
  say('男 3 現在是 free：查 Next = 3', '直接找第 3 名 → O(1)');
  await beat(tok, 2600);
  say('只要 propose 了就 Next++', 'accept 或 reject 都一樣');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-current', 'Current[w]：女生目前的未婚夫', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.6, 0.4]);
  const Z = (r) => -1.4 + r * 1.5;
  tag('Current', 'ptr', 1.2, 0.3, -2.6);
  const cs = [];
  for (let r = 0; r < 3; r++) { cube('女 ' + (r + 1), AB.pink, [1.2, 0.6, 1], -1.6, 0.3, Z(r)); cs.push(cube('0', AB.gold, [1.0, 0.5, 0.9], 1.2, 0.25, Z(r), 3)); }
  say('line 4：O(1) 知道 w 是否 free', '是 engaged 的話，也要知道 fiancé 是誰');
  await beat(tok, 2800);
  say('跟 Next 一樣：女生多開欄位 Current', '一開始都沒對象 → 填 0');
  await beat(tok, 2800);
  const EV = [[0, 1], [1, 3], [2, 0]];
  for (const [r, m] of EV) {
    if (m) { cube('男 ' + m, AB.blue, [1.2, 0.6, 1], 4, 0.3, Z(r), 3); relabel(cs[r], m); glow(cs[r], GOLD); }
    say(m ? '女 ' + (r + 1) + ' 跟男 ' + m + ' 訂婚' : '女 3 還是 free', 'Current[' + (r + 1) + '] = ' + m);
    await beat(tok, 2000); glow(cs[r], null);
  }
  say('Current = [1, 3, 0]', '0 號 = 沒有 fiancé；查詢 O(1)');
  await beat(tok, 3000);
}]);

const AB_WP = [3, 1, 4, 5, 6, 2], AB_RK = [2, 6, 1, 3, 4, 5];
FRAG.push(['algbari1-gs-scan', 'line 6：掃 preference list 是 O(n)', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.6, 0]);
  const X = (k) => -3.75 + k * 1.5;
  tag('WomanPref[1]（第 1 → 6 名）', 'ptr', 0, 0.3, -2.4);
  const cs = AB_WP.map((m, k) => { tag('第 ' + (k + 1) + ' 名', 'idx', X(k), 0.1, -1.6); return cube('男 ' + m, AB.sand, [1.3, 0.5, 0.9], X(k), 0.25, -0.6, 3); });
  tag('Current[1] = 6', 'ptr alt', -2.8, 0.3, 2.2);
  say('女 1 的偏好：3 1 4 5 6 2', '目前和男 6 訂婚');
  await beat(tok, 2600);
  const cur = tag('▼', 'ptr alt', X(0), 1.2, -0.6);
  const prop = cube('男 1 求婚', AB.blue, [2, 0.6, 1], 2.8, 0.3, 2.2, 3);
  say('男 1 來求婚：她比較喜歡誰？', '要知道兩人的名次');
  await beat(tok, 2000);
  const scan = async (target) => {
    for (let k = 0; k < AB_WP.length; k++) {
      cur.position.set(X(k), 1.2, -0.6); glow(cs[k], GOLD); await beat(tok, 380); glow(cs[k], null);
      if (AB_WP[k] === target) { glow(cs[k], GREEN); return k; }
    }
    return -1;
  };
  let k6 = await scan(6); say('掃到男 6：排第 ' + (k6 + 1) + ' 名', '掃了 ' + (k6 + 1) + ' 格'); await beat(tok, 1800);
  let k1 = await scan(1); say('男 1：排第 ' + (k1 + 1) + ' 名', '2 < 5 → accept 男 1'); await beat(tok, 2400);
  glow(cs[k6], null); glow(cs[k1], null); relabel(prop, '男 2 求婚');
  const k2 = await scan(2);
  say('若是男 2 求婚：要掃到最後', '第 ' + (k2 + 1) + ' 名 → worst case O(n)');
  await beat(tok, 2600);
  say('每圈 O(n) × n² 圈 = O(n³)', '不能接受 → 要換做法');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-ranking', 'Ranking[w][m]：反過來存名次，O(1)', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.6, 0]);
  const X = (k) => -3.75 + k * 1.5;
  tag('WomanPref[1]：依名次存男生', 'ptr', 0, 0.3, -2.9);
  AB_WP.forEach((m, k) => cube('男 ' + m, AB.sand, [1.3, 0.45, 0.8], X(k), 0.23, -2, 2));
  say('改成：依男生編號存他的名次', '反過來存（inverse）');
  await beat(tok, 2600);
  tag('Ranking[1][m]：m 排第幾', 'ptr', 0, 0.3, -0.6);
  const rs = AB_RK.map((r, k) => { tag('m=' + (k + 1), 'idx', X(k), 0.1, 1.3); return cube(r, AB.gold, [1.3, 0.5, 0.9], X(k), 0.25, 0.4, 3); });
  await beat(tok, 1200);
  say('意義相同：男 3 第 1、男 1 第 2…', 'Ranking = [2, 6, 1, 3, 4, 5]');
  await beat(tok, 2800);
  tag('Current[1] = 6', 'ptr alt', -2.8, 0.3, 2.6);
  glow(rs[5], GOLD);
  say('未婚夫男 6：直接看第 6 格', 'Ranking[1][6] = 5 → indexing O(1)');
  await beat(tok, 2600);
  cube('男 1 求婚', AB.blue, [2, 0.6, 1], 2.8, 0.3, 2.6, 3);
  glow(rs[0], GREEN);
  say('男 1 求婚：看第 1 格 = 2', '2 < 5 → accept，O(1)');
  await beat(tok, 2800);
  say('line 6 也做到 O(1)', '唯一要動腦的地方：反過來存');
  await beat(tok, 2600);
}]);

FRAG.push(['algbari1-gs-build-rank', '建 Ranking：O(n²)，只做一次', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.6, 0]);
  const X = (k) => -3.75 + k * 1.5;
  tag('WomanPref[1]', 'ptr', 0, 0.3, -2.9);
  const ps = AB_WP.map((m, k) => cube('男 ' + m, AB.sand, [1.3, 0.45, 0.8], X(k), 0.23, -2, 2));
  tag('Ranking[1]', 'ptr', 0, 0.3, -0.6);
  for (let k = 0; k < 6; k++) { tag('m=' + (k + 1), 'idx', X(k), 0.1, 1.3); cube('', GRAY, [1.3, 0.08, 0.9], X(k), 0.04, 0.4); }
  say('Ranking 要先建好：多做的工作', '開始前 preprocess 一次');
  await beat(tok, 2400);
  const cur = tag('▼', 'ptr alt', X(0), 1.1, -2);
  for (let k = 0; k < 6; k++) {
    const m = AB_WP[k];
    cur.position.set(X(k), 1.1, -2); glow(ps[k], GOLD);
    cube(String(k + 1), AB.gold, [1.2, 0.5, 0.85], X(m - 1), 0.3, 0.4, 3);
    say('第 ' + (k + 1) + ' 名是男 ' + m, 'Ranking[1][' + m + '] = ' + (k + 1));
    await beat(tok, k < 2 ? 1500 : 800); glow(ps[k], null);
  }
  say('邊掃邊填：每個女生 O(n)', 'n 個女生 → O(n²)');
  await beat(tok, 2600);
  const R = [['Ranking 初始化', 'O(n²)'], ['line 1、line 9', 'O(n)'], ['while：n² 圈 × O(1)', 'O(n²)']];
  for (let r = 0; r < 3; r++) { cube(R[r][0] + '：' + R[r][1], [AB.purple, AB.teal, AB.red][r], [4.2, 0.45, 0.8], -3 + (r % 2) * 5.4, 0.23, 2.4 + (r > 1 ? 1 : 0), 3); await beat(tok, 900); }
  say('總共：O(n²) ✓', '沒有破壞目標');
  await beat(tok, 3000);
}]);

FRAG.push(['algbari1-gs-compare', 'Data structure 決定 running time', async (tok) => {
  const summary = (ctx.params || {}).summary;
  fresh([0, 5.5, 13.5], [0, 2.6, 0]);
  if (summary) {
    const S = [['Efficient = polynomial running time', AB.green], ['先想清楚 running time 再寫程式', AB.blue], ['Data structure 很重要', AB.purple], ['Preprocessing 值得：代價要承受得起', AB.orange]];
    say('這個單元學到什麼？', '');
    await beat(tok, 1800);
    for (let k = 0; k < S.length; k++) {
      cube(S[k][0], S[k][1], [7.4, 0.6, 1], 0, 0.3 + k * 0.7, 0, 3);
      say(S[k][0], k === 0 ? 'upper bound 落在 polynomial' : k === 1 ? '作業發下來別馬上亂打' : k === 2 ? 'GS：Ranking 讓每圈 O(1)' : '例：先花 O(n²) 建 Ranking');
      await beat(tok, 2800);
    }
    await beat(tok, 1600);
    return;
  }
  const b1 = abBar(AB.red, 1.6, 1.6, -2.4, 0), b2 = abBar(AB.green, 1.6, 1.6, 2.4, 0);
  tag('line 6 用 preference list 掃', 'ptr', -2.4, 0, 1.6); tag('line 6 用 Ranking 查', 'ptr', 2.4, 0, 1.6);
  say('同一個 procedure、不同 data structure', '');
  await beat(tok, 2000);
  await abGrow(tok, b1, 5.4, 900); tag('每圈 O(n) → O(n³)', 'ptr alt', -2.4, 6);
  say('preference list：每圈 O(n)', '總共 O(n³)'); await beat(tok, 2200);
  await abGrow(tok, b2, 2.4, 700); tag('每圈 O(1) → O(n²)', 'ptr alt', 2.4, 3);
  say('Ranking（inverse）：每圈 O(1)', '總共 O(n²)'); await beat(tok, 2400);
  say('不同人寫程式，running time 可能不同', '差在 data structure 選得對不對'); await beat(tok, 2800);
  say('沒有絕對最好的 data structure', 'array、linked list 都看 operation 而定'); await beat(tok, 3000);
}]);

FRAG.push(['algbari1-log-compare', '取 log 比成長率：n^(1/3)、lg n、2^√lg n', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.4, 0]);
  const X = [-4, 0, 4], NM = ['f₁', 'f₂', 'f₃'];
  const fs = ['n^(1/3)', 'lg n', '2^√(lg n)'].map((s, k) => { tag(NM[k], 'ptr', X[k], 5.6); return cube(s, AB.blue, [2.8, 0.7, 1], X[k], 4.6, 0, 3); });
  say('依 growth rate 排大小', 'lg = log₂（log₁₀ 另外區分）');
  await beat(tok, 2600);
  say('長得差很多：先取 log', 'log 單調遞增，大小關係不變');
  await beat(tok, 2400);
  tag('令 z = lg n', 'ptr alt', 0, 6.6);
  const L = [['lg f₁ = (1/3) lg n', 'z/3'], ['lg f₂ = lg lg n', 'lg z'], ['lg f₃ = √(lg n)·lg 2', '√z']];
  for (let k = 0; k < 3; k++) {
    relabel(fs[k], L[k][0]); tint(fs[k], AB.purple);
    say(L[k][0], '= ' + L[k][1]); await beat(tok, 2200);
    relabel(fs[k], L[k][1]);
  }
  say('現在長得像了：z/3、lg z、√z', 'linear、log、根號');
  await beat(tok, 2200);
  const vals = [64 / 3, 6, 8], txtv = ['21.3', '6', '8'];
  say('代 z = 64 檢查（n = 2⁶⁴）', '');
  const bs = X.map((x, k) => { const b = abBar([AB.orange, AB.green, AB.teal][k], 1.2, 1.2, x, 0); return b; });
  for (let k = 0; k < 3; k++) { await abGrow(tok, bs[k], vals[k] * 0.17, 400); tag(txtv[k], 'idx', X[k], vals[k] * 0.17 + 0.35, 0.8); }
  await beat(tok, 1600);
  move(fs[1], -4, 4.6, 0); move(fs[2], 0, 4.6, 0); move(fs[0], 4, 4.6, 0);
  fs.forEach((m, k) => { relabel(m, ['n^(1/3)', 'lg n', '2^√(lg n)'][k]); tint(m, AB.blue); });
  say('lg z < √z < z/3', 'lg n < 2^√(lg n) < n^(1/3)');
  await beat(tok, 3200);
}]);
  }

  // ═══ algbari2.js ═══
  {
const { arrow, tnode } = K;
// ─── Abdul Bari 1.8.2 – 2.5 + Tower of Hanoi + Master's Theorem Explained（algbari2）───
// 用老師自己的例子：2n² + 3n + 4 ≤ 9n²、n!、log n!、性質 2n² + 5 ×7、log 比較題、
// linear search [8 6 12 5 9 7 4 3 16 18]、BST 20/10/30/5/15/25/40、各種遞迴式與 Master Theorem 例題、TOH(3,1,2,3)。
// 這裡沿用模組上方的 fresh/tag/cube/code/plot/bar… 等工具（code() 有 set()）。
const AB2_B = (tok, k = 1.05) => (ms) => beat(tok, ms * k);
const AB2_P = () => ctx.params || {};

// ═════════ 漸近符號影片（1.8.2、1.9、1.10.x、1.11、Simplified）：cued scenes ═════════
// 每個 await step(tok) 等老師講到那一句；step 之間只有短短的動作（≤ 3 秒），講完就停住。
// 函數用小角色（buddy）表示，會跳、會開心或失望；說明用 'say'/'note'/'good'/'bad' 標籤，資料移動用 'pkt'。
const { step, buddy, prop, bob, travel } = K;
const S2 = (a, b = '') => say(a, b);
// 依照 plan（一串動作名稱）一步一步播：每個動作前先等老師講到
async function AB2_run(tok, plan, A) { for (const k of plan) { await step(tok); await A[k](); } }
function AB2_marks() { const ls = []; const f = (t, cls, x, y, z = 0) => { const l = tag(t, cls, x, y, z); ls.push(l); return l; }; f.clear = () => { ls.forEach(kill); ls.length = 0; }; return f; }
const AB2_rename = (b, t) => { if (b && b.name) b.name.element.textContent = t; };
const AB2_walk = (tok, b, x, y, z, ms = 800) => travel(tok, b.g, b.g.position.clone(), V3(x, y, z), ms);

// ───────── 1. 上下界夾擠：plot c₁·g ≤ f ≤ c₂·g ─────────
const AB2_BP = {
  q4: { f: (n) => 2 * n * n + 3 * n + 4, fl: '2n² + 3n + 4', a: 0, xmax: 6, ymax: 330, g: 'n²',
    hi: { fn: (n) => 9 * n * n, l: '9n²', c: '9', why: '加起來：2n² + 3n + 4 ≤ 9n²', sw: '2n² + 3n + 4 ≤ 2n² + 3n² + 4n²' },
    lo: { fn: (n) => n * n, l: '1·n²', why: '另一邊：2n² + 3n + 4 ≥ 1·n²' } },
  q1: { f: (n) => 2 * n * n + 3 * n + 1, fl: '2n² + 3n + 1', a: 0, xmax: 6, ymax: 330, g: 'n²',
    hi: { fn: (n) => 6 * n * n, l: '6n²', c: '6', why: '加起來：2n² + 3n + 1 ≤ 6n²', sw: '2n² + 3n + 1 ≤ 2n² + 3n² + n²' },
    hi2: { fn: (n) => 6 * Math.pow(2, n), l: '6·2ⁿ', sw: '2n² + 3n + 1 ≤ 2·2ⁿ + 3·2ⁿ + 2ⁿ' },
    lo: { fn: (n) => n * n, l: '1·n²', why: '每一項只留 n²：2n² + 3n + 1 ≥ 1·n²' } },
  nlog: { f: (n) => n * n * lg(n) + n, fl: 'n² log n + n', a: 1, xmax: 8, ymax: 420, g: 'n² log n',
    hi: { fn: (n) => 10 * n * n * lg(n), l: '10·n² log n', c: '10', why: '隨便寫一個更大的係數：≤ 10·n² log n' },
    lo: { fn: (n) => n * n * lg(n), l: '1·n² log n', why: '另一邊：≥ 1·n² log n' } },
};
const AB2_BP_PLAN = {
  q4: ['f', 'swap', 'hi', 'n0', 'O', 'lo', 'W', 'T'],
  nlog: ['f', 'hi', 'lo', 'sides', 'all3'],
  q1O: ['def', 'ineq', 'f', 'swap', 'hi', 'n0', 'O', 'swap2', 'hi2', 'O2', 'upAll'],
  q1W: ['def', 'ineq', 'f', 'lo', 'W', 'Wboth', 'T', 'sum'],
};
async function ab2BoundPlot(tok) {
  const p = AB2_P(), ex = p.ex || 'q4', part = p.part || '', E = AB2_BP[ex] || AB2_BP.q4, W = part === 'W';
  const plan = AB2_BP_PLAN[ex === 'q1' ? (W ? 'q1W' : 'q1O') : ex] || AB2_BP_PLAN.q4;
  fresh([0, 5.4, 16], [0, 4, 0]);
  const P = plot(-6.2, 0, 10, 7, E.xmax, E.ymax);
  const lim = (fn) => { let b = E.xmax; while (b > E.a + 0.2 && fn(b) > E.ymax) b -= 0.05; return b; };
  const draw = (fn, color, l, dy = 0.3) => { const b = lim(fn); P.curve(fn, color, E.a, b); return tag(l, 'ptr alt', Math.min(5.0, P.X(b) + 0.6), P.Y(fn(b)) + dy); };
  let card = null, fb = null, nm = 0;
  const board = (t) => { if (card) kill(card); card = tag(t, 'say', -1.0, 8.1); };
  const mark = (t, cls = 'good') => tag(t, cls, 6.0, 2.0 + 0.7 * nm++);
  const fly2 = async (t) => { const pk = tag(t, 'pkt', -5, 8.8); await travel(tok, pk, V3(-5, 8.8, 0), V3(2.5, 8.8, 0), 1300); kill(pk); };
  const A = {
    def: () => { board(W ? 'f(n) = Ω(g(n)) ⇔ 存在正常數 c、n₀' : 'f(n) = O(g(n)) ⇔ 存在正常數 c、n₀'); S2(W ? 'Ω 的正式定義（下界）' : 'Big-O 的正式定義（上界）', ''); },
    ineq: () => { board(W ? '對所有 n ≥ n₀：f(n) ≥ c·g(n)' : '對所有 n ≥ n₀：f(n) ≤ c·g(n)'); S2(W ? '從 n₀ 起，f(n) 一直在 c·g(n) 上面' : '從 n₀ 起，f(n) 一直在 c·g(n) 下面', ''); },
    f: async () => { draw(E.f, C.red, 'f(n)', -0.25); fb = buddy('f(n)', '', C.red, 6.0, 0, 0.9, 0.7); board('f(n) = ' + E.fl); S2('例：f(n) = ' + E.fl, '紅線就是 f(n)'); await fb.hop(tok); },
    swap: async () => { board(E.hi.sw); S2('每一項都換成 ' + E.g + '：只會變大', E.hi.sw); await fly2('每一項 → ' + E.g); },
    hi: () => { draw(E.hi.fn, C.green, E.hi.l); board(E.fl + ' ≤ ' + E.hi.l); fb.look(-1); S2(E.hi.why, '綠線 ' + E.hi.l + ' 蓋在紅線上面'); },
    n0: () => { P.vmark(1, '#c08a1f', 'n₀ = 1'); S2('從 n = 1 起都成立', 'n₀ = 1'); },
    O: async () => { mark('O(' + E.g + ')'); fb.mood('happy'); S2('c = ' + E.hi.c + '、g(n) = ' + E.g + ' → f(n) = O(' + E.g + ')', 'f(n) ≤ c·g(n)'); await fb.hop(tok); },
    swap2: async () => { board(E.hi2.sw); S2('也可以把每一項都換成 2ⁿ', E.hi2.sw + ' = 6·2ⁿ'); await fly2('每一項 → 2ⁿ'); },
    hi2: () => { draw(E.hi2.fn, C.purple, E.hi2.l, 0.7); board(E.fl + ' ≤ 6·2ⁿ'); S2('從某個 n 起，f(n) ≤ 6·2ⁿ 也成立', '紫線'); },
    O2: () => { mark('O(2ⁿ) 也對'); S2('c = 6、g(n) = 2ⁿ → f(n) = O(2ⁿ)', '對，但不是最接近的上界'); },
    upAll: () => { board('≥ n² 的類別都是上界：O(n²)、O(n³)、O(2ⁿ)…'); S2('開頭說「≥ n² 的都是上界」就是這個意思', ''); },
    lo: () => { draw(E.lo.fn, C.blue, E.lo.l, -0.45); board(E.fl + ' ≥ ' + E.lo.l); fb.look(-1); S2(E.lo.why, '藍線在紅線下面'); },
    W: async () => { mark('Ω(' + E.g + ')'); fb.mood('happy'); S2('c = 1、g(n) = ' + E.g + ' → f(n) = Ω(' + E.g + ')', 'f(n) ≥ c·g(n)'); await fb.hop(tok); },
    Wboth: () => { draw(E.hi.fn, C.green, E.hi.l); mark('O(' + E.g + ')'); S2('前面已經得到 O(' + E.g + ')，現在又有 Ω(' + E.g + ')', E.lo.l + ' ≤ f(n) ≤ ' + E.hi.l); },
    T: async () => { P.zone(1, E.xmax); mark('Θ(' + E.g + ')', 'note'); board(E.lo.l + ' ≤ f(n) ≤ ' + E.hi.l); S2('夾在兩條 ' + E.g + ' 中間 → Θ(' + E.g + ')', '上下界相同 = tight bound'); fb.mood('happy'); await fb.hop(tok); },
    sides: () => { P.zone(1, E.xmax); board(E.lo.l + ' ≤ f(n) ≤ ' + E.hi.l); S2('兩邊都是 ' + E.g, ''); },
    all3: async () => { mark('O(' + E.g + ')'); mark('Ω(' + E.g + ')'); mark('Θ(' + E.g + ')', 'note'); fb.mood('happy'); S2('O、Ω、Θ 三個都是 ' + E.g, ''); await fb.hop(tok); },
    sum: () => { board('漸近符號 = 上界 O、下界 Ω、tight bound Θ'); S2('漸近符號就是：上界、下界、tight bound', ''); },
  };
  await AB2_run(tok, plan, A);
}

// ───────── 2. 類別階梯 ─────────
const AB2_CL = ['1', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', '3ⁿ', 'nⁿ'];
const AB2_CL7 = ['1', 'log n', 'n', 'n log n', 'n²', 'n³', '2ⁿ'];
const AB2_LD_PLAN = {
  classes: ['intro', 'g1', 'g2', 'g3', 'any', 'fq'],
  nlog: ['none', 'insert', 'own'],
  fact: ['fa', 'fb', 'fc', 'fd', 'fe', 'ff'],
  q2: ['show', 'order', 'fq2', 'deg', 'up', 'lo', 'tight', 'O1', 'O2', 'O3', 'again', 'up', 'lo', 'tight', 'Ob', 'Oany', 'W1', 'W2', 'list', 'T'],
  n5: ['fq5', 'up', 'lo5'],
};
async function ab2Ladder(tok) {
  const ex = AB2_P().ex || 'q2', plan = AB2_LD_PLAN[ex] || AB2_LD_PLAN.q2;
  fresh([0, 5, 15], [0, 2.6, 0]);
  const L = ex === 'classes' ? AB2_CL7 : AB2_CL, N = L.length;
  const X = (k, n = N) => -6 + k * 12 / (n - 1), H = (k) => 0.5 + k * 0.12;
  const ms = [];
  const mk = (k) => { ms[k] = cube(L[k], GRAY, [1.1, H(k), 1], X(k), H(k) / 2, 0, 3); };
  if (ex !== 'classes') L.forEach((_, k) => mk(k));
  const mark = AB2_marks();
  const k0 = ex === 'n5' ? 3 : 5;
  let fb = null;
  const goTo = (k, n, ms2 = 900) => AB2_walk(tok, fb, X(k, n), 0, 1.8, ms2);
  const paint = (fn) => ms.forEach((m, k) => { if (m) tint(m, fn(k)); });
  const up = () => paint((k) => (k >= k0 ? C.green : GRAY));
  const lo = () => paint((k) => (k > k0 ? C.green : k < k0 ? C.purple : C.teal));
  const A = {
    // 常見類別（Simplified 開頭）
    intro: () => { fb = buddy('演算法', '', C.teal, 0, 0, 2.4, 0.8); mark('我要跑多久？', 'say', 0, 2.1, 2.4); S2('漸近符號：用來表示演算法的時間複雜度', ''); },
    g1: () => { mk(0); mk(1); S2('時間可能是常數 1，或對數 log n', ''); },
    g2: () => { mk(2); mk(3); mk(4); S2('也可能是線性 n、n log n、平方 n²', ''); },
    g3: () => { mk(5); mk(6); S2('還有立方 n³、指數 2ⁿ', '1 < log n < n < n log n < n² < n³ < 2ⁿ'); },
    any: async () => { mark.clear(); S2('任何演算法都是其中一類，或它們的組合、倍數', ''); await goTo(4); glow(ms[4], GOLD); await fb.hop(tok); },
    fq: () => { glow(ms[4], null); mark('frequency count：數每個敘述執行幾次', 'say', 0, 4.2); S2('先用 frequency count 算幾個演算法', ''); },
    // n² log n 自成一類
    none: () => { fb = buddy('n² log n', '', C.gold, 0, 0, 2.4, 0.7); fb.mood('wow'); mark('？', 'say', 0, 2.0, 2.4); S2('類別表上沒有 n² log n', ''); },
    insert: async () => {
      mark.clear(); ms.forEach((m, k) => move(m, X(k >= 6 ? k + 1 : k, 11), m.position.y, 0));
      ms.push(cube('n² log n', C.gold, [1.1, 1.17, 1], X(6, 11), 0.58, 0, 3));
      S2('n² log n 比 n² 大、比 n³ 小', 'n² < n² log n < n³'); await goTo(6, 11);
    },
    own: async () => { glow(ms[ms.length - 1], GOLD); mark('n² × log n：自成一類', 'good', X(6, 11), 2.4); fb.mood('happy'); S2('它是 n² 與 log n 的組合，可以另立一類', ''); await fb.hop(tok); },
    // n! 找不到位置
    fa: () => { fb = buddy('n!', '', C.red, X(0), 0, 1.8, 0.7); S2('n! 找不到 tight bound（Θ）', ''); },
    fb: () => { fb.mood('wow'); mark('n! 在哪一格？', 'say', 0, 3.6); S2('想把 n! 放進類別表：表上沒有它', ''); },
    fc: async () => { mark.clear(); S2('n 小時靠近小的類別，n 大時一路往上逼近 nⁿ', '找不到固定的一格'); await goTo(9, N, 2400); },
    fd: async () => { mark('n¹⁰ < n! < n¹¹ ？ ✗', 'bad', 0, 3.6); fb.mood('sad'); S2('不能說 n! 永遠大於 n¹⁰、又小於 n¹¹', ''); await goTo(5, N, 1200); },
    fe: () => { mark.clear(); tint(ms[0], C.purple); tint(ms[9], C.green); mark('下界 1', 'good', X(0), 1.6); mark('上界 nⁿ', 'good', X(9), 2.6); fb.mood('calm'); S2('能確定的只有：1 ≤ n! ≤ nⁿ', 'O(nⁿ)、Ω(1)'); },
    ff: () => { mark('找不到 Θ → 用 O、Ω', 'note', 0, 3.6); S2('找不到 Θ 時，才退而用上界 O、下界 Ω', '這就是 O 與 Ω 的用處'); },
    // 2n² + 3n + 2：上界、下界、tight bound
    show: () => { S2('時間複雜度會是表上其中一類', '1 < log n < √n < n < … < 2ⁿ < 3ⁿ < nⁿ'); },
    order: async () => { S2('類別已經照大小排好：左小右大', ''); const pk = tag('由小到大 →', 'pkt', X(0), 2.4); await travel(tok, pk, V3(X(0), 2.4, 0), V3(X(9), 2.4, 0), 1600); kill(pk); },
    fq2: async () => { fb = buddy('f = 2n² + 3n + 2', '', C.red, 0, 0, 3.0, 0.75); S2('例：f(n) = 2n² + 3n + 2', ''); await fb.hop(tok); },
    deg: async () => { S2('最高次項是 n² → 它站在 n² 這格', ''); await goTo(k0); glow(ms[k0], GOLD); },
    up: () => { up(); S2('≥ ' + L[k0] + ' 的類別（含 ' + L[k0] + '）都是上界', 'upper bound（綠）'); },
    lo: () => { lo(); S2('≤ ' + L[k0] + ' 的類別（含 ' + L[k0] + '）都是下界', 'lower bound（紫）'); },
    tight: async () => { tint(ms[k0], C.gold); mark('tight bound', 'note', X(k0), 2.3); fb.mood('happy'); S2(L[k0] + ' 兩邊都有 → tight bound', ''); await fb.hop(tok); },
    O1: () => { mark.clear(); paint((k) => (k >= k0 ? C.green : GRAY)); mark('f = O(n²)', 'good', X(k0), 2.3); S2('上界用 Big-O 表示：f = O(n²)', ''); },
    O2: () => { mark('O(n³) ✓', 'good', X(6), 3.0); S2('f = O(n³)：也對', ''); },
    O3: () => { mark('O(2ⁿ) ✓', 'good', X(7), 3.7); S2('f = O(2ⁿ)：也對', '≥ n² 的都能寫'); },
    again: async () => { mark.clear(); paint(() => GRAY); glow(ms[k0], null); AB2_rename(fb, 'f = 2n² + 3n + 1'); fb.mood('calm'); S2('再看 f(n) = 2n² + 3n + 1：最高次一樣是 n²', ''); await fb.hop(tok); glow(ms[k0], GOLD); },
    Ob: () => { mark.clear(); paint((k) => (k >= k0 ? C.green : GRAY)); mark('f = O(n²)', 'good', X(k0), 2.3); S2('f = O(n²)：Big-O 表示上界', ''); },
    Oany: () => { mark('O(n³)、O(2ⁿ)…', 'good', X(7.5), 3.2); S2('任何 ≥ n² 的類別都能當上界', ''); },
    W1: () => { lo(); tint(ms[k0], C.gold); mark('f = Ω(n²)', 'good', X(k0), 3.0); S2('下界用 Ω：f = Ω(n²)', ''); },
    W2: () => { mark('Ω(n)、Ω(log n)…', 'good', X(1.5), 2.0); S2('f = Ω(n)、Ω(log n) 也都對', '比 n² 小的都是下界'); },
    list: () => { S2('上界、下界只在這張排好的類別表裡找', '比 f 的最高次大 → 上界；小 → 下界'); },
    T: async () => { mark('Θ(n²)', 'note', X(k0), 3.7); fb.mood('happy'); S2('O 和 Ω 都是 n² → f = Θ(n²)', ''); await fb.hop(tok); },
    fq5: async () => { fb = buddy('f = n + 5', '', C.red, 0, 0, 3.0, 0.75); S2('再一例：f(n) = n + 5，最高次 n', ''); await goTo(k0); glow(ms[k0], GOLD); },
    lo5: async () => { lo(); tint(ms[k0], C.gold); mark('tight bound', 'note', X(k0), 2.0); fb.mood('happy'); S2('≤ n 的都是下界；n 本身是 tight bound', 'f = Θ(n)'); await fb.hop(tok); },
  };
  await AB2_run(tok, plan, A);
}

// ───────── 3. n! 與 log n! 的上下界（例 n = 5） ─────────
const AB2_FA_PLAN = {
  n: ['f', 'desc', 'rev', 'upN', 'askLo', 'lo1', 'upB', 'notSame', 'OW'],
  log: ['f', 'desc', 'upN', 'lo1', 'nlogn', 'noT'],
  dds: ['f', 'notIn', 'desc', 'upN', 'O', 'askLo', 'lo1', 'W1', 'cmp', 'diff', 'logRow', 'Wn', 'noT2', 'tightDef'],
};
async function ab2Factorial(tok) {
  const p = AB2_P(), ex = p.log ? 'log' : (p.ex || 'n'), isLog = ex === 'log', plan = AB2_FA_PLAN[ex] || AB2_FA_PLAN.n;
  fresh([0, 5, 14.5], [0, 3.4, 0]);
  const xs = (k) => -4.0 + k * 1.3, Y = { up: 5.6, mid: 3.4, lo: 1.2 };
  const mark = AB2_marks();
  let fb = null, mid = [], lo = [], upT = null, loT = null, ask = null;
  const A = {
    f: async () => { fb = buddy(isLog ? 'log n!' : 'n!', '', C.red, -6.0, 0, 1.6, 0.7); S2(isLog ? '再一例：log n!' : '例：時間是 n!', isLog ? '' : 'n! 讀作 n 階乘'); await fb.hop(tok); },
    notIn: () => { mark('n! 不在常見類別表上', 'say', 0, 7.2); fb.mood('wow'); S2('n! 不在類別表裡：它的上界是什麼？', ''); },
    desc: () => {
      const vs = isLog ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
      mid = vs.map((v, k) => cube(v, C.blue, [0.9, 0.7, 0.9], xs(k), Y.mid, 0, 2.5));
      if (isLog) { tag('log(', 'ptr', -5.4, Y.mid); tag(') = log n!', 'ptr alt', 3.6, Y.mid); S2('log n! = log(1·2·3·…·n)', '例：n = 5'); }
      else { tag('= n!', 'ptr alt', 3.4, Y.mid); S2('n! = n·(n−1)·(n−2)·…·2·1', '例：n = 5 → 5·4·3·2·1 = 120'); }
    },
    rev: () => { mid.forEach((m, k) => move(m, xs(4 - k), Y.mid, 0)); S2('倒過來寫：1·2·3·…·n', '乘法順序不影響'); },
    upN: async () => {
      if (isLog) { tag('log(', 'ptr', -5.4, Y.up); }
      for (let k = 0; k < 5; k++) { const c = cube(k + 1, C.green, [0.9, 0.7, 0.9], xs(k), Y.mid, 0.6); move(c, xs(k), Y.up, 0); await beat(tok, 240); relabel(c, 'n'); }
      upT = tag(isLog ? ') = log nⁿ' : '= nⁿ', 'ptr alt', 3.6, Y.up);
      S2('照慣例：每個因數都換成 n（只會變大）', isLog ? 'log n! ≤ log(n·n·…·n) = log nⁿ' : 'n! ≤ n·n·…·n = nⁿ');
    },
    O: () => { mark('O(nⁿ)', 'good', 5.6, Y.up); S2('n! ≤ nⁿ → f(n) = O(nⁿ)', ''); },
    askLo: () => { ask = tag('≥ ？', 'say', 0, Y.lo); S2('那下界呢？要換成更小的數', ''); },
    lo1: async () => {
      if (ask) { kill(ask); ask = null; }
      if (isLog) tag('log(', 'ptr', -5.4, Y.lo);
      for (let k = 0; k < 5; k++) { const c = cube(k + 1, C.purple, [0.9, 0.7, 0.9], xs(k), Y.mid, -0.6); lo.push(c); move(c, xs(k), Y.lo, 0); await beat(tok, 240); relabel(c, '1'); }
      loT = tag(isLog ? ') = log 1 = 0 → 寫 1' : '= 1', 'ptr alt', 3.6, Y.lo);
      S2('每個因數都換成 1（只會變小）', isLog ? 'log 1 = 0，但時間習慣寫成 1' : 'n! ≥ 1·1·…·1 = 1');
    },
    W1: () => { mark('Ω(1)', 'good', 5.6, Y.lo); S2('n! ≥ 1 → f(n) = Ω(1)', ''); },
    upB: () => { mark('上界 nⁿ', 'good', 5.6, Y.up); mark('下界 1', 'good', 5.6, Y.lo); S2('上界 nⁿ、下界 1', ''); },
    notSame: () => { fb.mood('sad'); mark('nⁿ ≠ 1', 'bad', 5.6, Y.mid); S2('上下兩邊不一樣', '一樣的話才能寫 Θ'); },
    OW: () => { mark('O(nⁿ)、Ω(1)', 'good', 0, 7.2); S2('所以只能寫 O(nⁿ)、Ω(1)', '下界 1、上界 nⁿ：找不到 tight bound'); },
    nlogn: () => { txt(upT, ') = log nⁿ = n log n'); S2('log nⁿ = n log n（次方拿下來當係數）', 'log n! ≤ n log n'); },
    noT: () => { fb.mood('sad'); mark('O(n log n)、Ω(1)', 'good', 0, 7.2); S2('老師：上界 n log n、下界 1，沒有 tight bound', '補充：其實 log n! = Θ(n log n)'); },
    cmp: () => { mark('上一題：O(n²)、Ω(n²) → Θ(n²)', 'say', 0, 7.2); S2('上一題 O 和 Ω 都是 n² → Θ(n²)', ''); },
    diff: () => { fb.mood('sad'); mark('這題：O(nⁿ) ≠ Ω(1)', 'bad', 0, 6.5); S2('這題 O 是 nⁿ、Ω 是 1：不一樣', ''); },
    logRow: async () => {
      for (const c of lo) { tint(c, C.teal); relabel(c, 'log n'); await beat(tok, 200); }
      txt(loT, '= (log n)ⁿ');
      S2('老師：每個因數換成 log n', '乘起來其實是 (log n)ⁿ，不是 n log n');
    },
    Wn: () => { mark('Ω(n log n)、Ω(n) 也對', 'good', 3.6, 0.3); S2('n! ≥ n log n、n! ≥ n 都成立', 'Ω(n log n)、Ω(n) 都對'); },
    noT2: () => { mark('沒有 Θ', 'bad', 5.6, Y.mid); S2('nⁿ ≠ 1、nⁿ ≠ n log n → n! 沒有 Θ', ''); },
    tightDef: () => { mark('tight bound：O 與 Ω 相同', 'note', -1.8, 7.2); S2('tight bound 要 O 和 Ω 是同一個', '有些函數只找得到上界、下界'); },
  };
  await AB2_run(tok, plan, A);
}

// ───────── 4. 買手機的估價：最接近的界才有用 ─────────
function ab2PhoneModel(x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const body = lab.box('#3d4450', [0.9, 1.6, 0.12]); body.position.y = 0.8; g.add(body);
  const scr = lab.box('#9fd3f0', [0.76, 1.3, 0.02]); scr.position.set(0, 0.84, 0.07); g.add(scr);
  const btn = lab.box('#d8cfc0', [0.18, 0.06, 0.02]); btn.position.set(0, 0.12, 0.07); g.add(btn);
  lab.world.add(g); return g;
}
async function ab2Phone(tok) {
  fresh([0, 4.8, 14], [0, 2.6, 0]);
  const mark = AB2_marks();
  let max = 30000, ticks = [], axis = [], items = [];
  const X = (v) => -6 + v / max * 12;
  const drawTicks = () => { ticks.forEach(kill); ticks = []; for (let i = 0; i <= 3; i++) ticks.push(tag((max / 3 * i).toLocaleString('en-US'), 'idx', X(max / 3 * i), -0.3)); };
  const item = (v, color, h) => { const m = cube(v >= 100000 ? (v / 100000) + ' lakh' : (v / 1000) + 'k', color, [0.95, 0.55, 0.9], X(v), 0.5 + h, 0, 3); m.userData.v = v; m.userData.h = h; items.push(m); return m; };
  let bT = null, bO = null, bW = null, you = null;
  const A = {
    th: async () => { bT = buddy('Θ', 'tight', C.gold, -4, 0, 0.6, 0.85); mark('能找到 Θ 就用 Θ', 'good', -4, 2.0, 0.6); S2('能求出 Θ 最好：它是 tight bound', ''); await bT.hop(tok); },
    ow: () => { bO = buddy('O', '上界', C.green, -0.6, 0, 0.6, 0.85); bW = buddy('Ω', '下界', C.purple, 2.8, 0, 0.6, 0.85); mark('別給太大的', 'say', -0.6, 2.0, 0.6); mark('別給太小的', 'say', 2.8, 2.0, 0.6); S2('用 O、Ω 時也要給最接近的值', '上界別太大、下界別太小'); },
    n2: () => { mark('f(n) = n² → 就寫 n²', 'note', 0, 4.6); mark('寫 n log n、n√n：對，但沒用', 'bad', 0, 3.8); bW.mood('sad'); S2('函數是 n² 就寫 n²', '寫 n log n、n√n 雖然對，但沒有意義'); },
    phone: () => {
      mark.clear(); [bT, bO, bW].forEach((b) => kill(b.g));
      axis.push(line(-6, 0.2, 6, 0.2, 0, '#6e5f49')); drawTicks();
      const ph = ab2PhoneModel(4.6, 3.2, -0.5, 1); bob(ph, 0.08);
      you = buddy('你', '', C.blue, -5.6, 0.25, 2.0, 0.65);
      S2('比喻：我想買一支手機，大概要多少錢？', '');
    },
    near: async () => { item(20000, C.gold, 0); mark('大約 20,000', 'say', -5.6, 1.6, 2.0); you.mood('happy'); S2('「大約 20,000」：最接近的答案 → 像 Θ', ''); await you.hop(tok); },
    close: () => { mark.clear(); item(18000, C.purple, 1.2); item(19000, C.purple, 2.2); item(21000, C.green, 1.2); item(24000, C.green, 2.2); S2('最少 18k、19k；最多 21k、24k：都還接近', '接近的下界與上界'); },
    far1: async () => {
      max = 210000; drawTicks(); items.forEach((m) => move(m, X(m.userData.v), 0.5 + m.userData.h, 0));
      await beat(tok, 700);
      item(2000, C.purple, 3.4); item(3000, C.purple, 4.4); mark('對，但沒用', 'bad', -3.6, 5.6); you.mood('sad');
      S2('最少 2,000、3,000：沒錯，但對我沒用', '太遠的下界 Ω');
    },
    far2: () => { item(100000, C.green, 1.2); item(200000, C.green, 2.4); mark('對，但沒意義', 'bad', 3.6, 4.0); S2('最多 1 lakh、2 lakh：也對，但沒意義', '太遠的上界 O（1 lakh = 10 萬）'); },
    best: async () => { items.forEach((m) => { if (m.userData.v !== 20000) glow(m, null); }); glow(items[0], GOLD); you.mood('happy'); S2('函數是 n² 就說 n²：Θ 是最完美的答案', ''); await you.hop(tok); },
    sure: () => { mark('Θ = 保證精確', 'good', -4.4, 3.2); S2('Θ 保證是精確的類別；O、Ω 可能離真值很遠', ''); },
    unsure: () => { mark('不確定時：O、Ω（例：n!、log n!）', 'note', 0, 6.4); S2('不確定精確值時才用 O、Ω', '例如 n!、log n!'); },
    free: () => { you.mood('calm'); S2('沒有規定只能用 Θ：三種符號都能用', 'Ω：至少這麼久；Θ：就是這麼久'); },
  };
  await AB2_run(tok, ['th', 'ow', 'n2', 'phone', 'near', 'close', 'far1', 'far2', 'best', 'sure', 'unsure', 'free'], A);
}

// ───────── 5. 漸近符號的性質 ─────────
const AB2_PC = ['1', 'log n', 'n', 'n²', 'n³', '2ⁿ'];
const AB2_PR_PLAN = {
  scale: ['rule', 'f', 'a7', 'deg', 'all3'],
  reflex: ['rule', 'ex', 'up', 'lo', 'is'],
  trans: ['rule', 'ex', 'two', 'three', 'all'],
  sym: ['rule', 'only', 'ex', 'back'],
  transpose: ['rule', 'ex', 'O', 'W', 'vice'],
  both: ['O', 'W', 'same', 'T', 'eq'],
  sum: ['rule', 'ex', 'Os', 'add', 'max', 'swap', 'rule2'],
  prod: ['rule', 'ex', 'rule2'],
};
async function ab2Props(tok) {
  const p = AB2_P().p || 'scale', plan = AB2_PR_PLAN[p] || AB2_PR_PLAN.scale;
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const X = (k) => -5 + k * 2;
  const cls6 = AB2_PC.map((nm, k) => cube(nm, GRAY, [1.6, 0.5, 1], X(k), 0.25, -0.8, 2));
  const mark = AB2_marks();
  let card = null;
  const board = (t) => { if (card) kill(card); card = tag(t, 'say', 0, 6.4); };
  const bud = (nm, color, x, size = 0.7) => buddy(nm, '', color, x, 0, 1.4, size);
  const hd = (b) => b.g.position.clone().add(V3(0, 1.1, 0));
  const arc = (a, b, color) => arrow(hd(a), hd(b), color);
  const B = {};
  const A = {
    // 乘上常數
    scale_rule: () => { board('f(n) = O(g(n)) ⇒ a·f(n) = O(g(n))'); S2('一般性質：乘上常數 a，上界不變', ''); },
    scale_f: async () => { B.f = bud('f = 2n² + 5', C.blue, X(3) - 1.3); mark('O(n²)', 'good', X(3) - 1.3, 2.3, 1.4); S2('例：f(n) = 2n² + 5 = O(n²)', ''); await B.f.hop(tok); },
    scale_a7: async () => { B.g = bud('7f = 14n² + 35', C.purple, X(3) + 1.3); const pk = tag('× 7', 'pkt', X(3) - 1.3, 1.8, 1.4); await travel(tok, pk, V3(X(3) - 1.3, 1.8, 1.4), V3(X(3) + 1.3, 1.8, 1.4), 900); kill(pk); S2('乘上 a = 7', '7(2n² + 5) = 14n² + 35'); },
    scale_deg: async () => { glow(cls6[3], GOLD); mark('O(n²)', 'good', X(3) + 1.3, 2.3, 1.4); B.g.mood('happy'); S2('最高次還是 n² → 7f = O(n²)', '常數倍不改變類別'); await B.g.hop(tok); },
    scale_all3: () => { mark('Ω、Θ 也成立', 'note', 0, 5.6); S2('Ω、Θ 也一樣', '三種符號都有這個性質'); },
    // 反身性
    reflex_rule: () => { board('Reflexive：f(n) = O(f(n))'); S2('反身性：f(n) = O(f(n))', ''); },
    reflex_ex: async () => { B.f = bud('f = n²', C.blue, X(3)); S2('例：f(n) = n² → n² = O(n²)', ''); await B.f.hop(tok); },
    reflex_up: () => { glow(cls6[3], GREEN); mark('上界：≥（含等號）', 'good', X(3), 2.3, 1.4); S2('上界是「≥」：含等號，自己就是自己的上界', 'n² ≤ 1·n²'); },
    reflex_lo: () => { glow(cls6[3], GOLD); mark('下界：≤（也含等號）', 'good', X(3), 3.0, 1.4); B.f.mood('happy'); S2('下界「≤」也含等號 → f = Ω(f)', '所以 f = Θ(f)'); },
    reflex_is: () => { mark('「=」讀作 is（屬於）', 'note', 0, 5.6); S2('這裡的「=」讀作 is：屬於這一類', ''); },
    // 遞移性
    trans_rule: () => { board('f = O(g)、g = O(h) ⇒ f = O(h)'); S2('遞移性 transitive', ''); },
    trans_ex: () => { B.f = bud('f = n', C.blue, X(2), 0.6); B.g = bud('g = n²', C.purple, X(3), 0.6); B.h = bud('h = n³', C.red, X(4), 0.6); S2('例：f = n、g = n²、h = n³', ''); },
    trans_two: () => { arc(B.f, B.g, 0x0f5a3a); arc(B.g, B.h, 0x0f5a3a); mark('O', 'good', X(2.5), 2.1, 1.4); mark('O', 'good', X(3.5), 2.1, 1.4); S2('n = O(n²)、n² = O(n³)', 'g 是 f 的上界、h 是 g 的上界'); },
    trans_three: async () => { arrow(hd(B.f).add(V3(0, 1.0, 0)), hd(B.h).add(V3(0, 1.0, 0)), 0xc08a1f); mark('O', 'note', X(3), 3.3, 1.4); B.f.mood('happy'); B.h.mood('happy'); S2('所以 n = O(n³)：h 也是 f 的上界', 'f = O(g)、g = O(h) ⇒ f = O(h)'); await B.f.hop(tok); },
    trans_all: () => { mark('Ω、Θ 也成立', 'note', 0, 5.6); S2('O、Ω、Θ 都有遞移性', '老師只示範 O'); },
    // 對稱性
    sym_rule: () => { board('Symmetric：f = Θ(g) ⇒ g = Θ(f)'); S2('對稱性 symmetric', ''); },
    sym_only: () => { mark('只對 Θ 成立', 'note', 0, 5.6); S2('這個性質只對 Θ 成立', ''); },
    sym_ex: () => { B.f = bud('f = n²', C.blue, X(3) - 1.2, 0.65); B.g = bud('g = n²', C.purple, X(3) + 1.2, 0.65); arc(B.f, B.g, 0xc08a1f); mark('f = Θ(g)', 'good', X(3), 2.6, 1.4); S2('例：f = n²、g = n² → f = Θ(g)', ''); },
    sym_back: async () => { arrow(hd(B.g).add(V3(0, -0.3, 0.3)), hd(B.f).add(V3(0, -0.3, 0.3)), 0xc08a1f); mark('g = Θ(f)', 'good', X(3), 3.3, 1.4); B.f.mood('happy'); B.g.mood('happy'); S2('反過來 g = Θ(f) 也對', '兩個互為 Θ'); await Promise.all([B.f.hop(tok), B.g.hop(tok)]); },
    // 轉置對稱
    transpose_rule: () => { board('f = O(g) ⇔ g = Ω(f)'); S2('轉置對稱 transpose symmetric：O 與 Ω', ''); },
    transpose_ex: () => { B.f = bud('f = n', C.blue, X(2), 0.65); B.g = bud('g = n²', C.purple, X(3) + 0.6, 0.65); S2('例：f = n、g = n²', ''); },
    transpose_O: () => { arc(B.f, B.g, 0x0f5a3a); mark('n² 是 n 的上界', 'good', X(2.8), 2.3, 1.4); S2('n = O(n²)：n² 是 n 的上界', ''); },
    transpose_W: () => { arrow(hd(B.g).add(V3(0, -0.4, 0.3)), hd(B.f).add(V3(0, -0.4, 0.3)), 0x9b7ef4); mark('n 是 n² 的下界', 'good', X(2.8), 3.0, 1.4); S2('n² = Ω(n)：n 是 n² 的下界', ''); },
    transpose_vice: async () => { B.f.mood('happy'); B.g.mood('happy'); S2('一個是另一個的上界 ⇔ 反過來就是下界', 'f = O(g) ⇔ g = Ω(f)'); await B.f.hop(tok); },
    // O 與 Ω 同一個 g
    both_O: () => { board('f = O(g) 而且 f = Ω(g)'); B.f = bud('f(n)', C.blue, X(3)); tint(cls6[3], C.green); mark('g：上界', 'good', X(3) + 1.4, 0.9, 0); S2('若 f = O(g)：g 是 f 的上界', ''); },
    both_W: () => { mark('g：也是下界', 'good', X(3) + 1.4, 1.6, 0); S2('又 f = Ω(g)：同一個 g 也是下界', ''); },
    both_same: () => { tint(cls6[3], C.gold); S2('同一個 g 同時是上界、也是下界', ''); },
    both_T: async () => { mark('f = Θ(g)', 'note', X(3), 2.4, 1.4); B.f.mood('happy'); S2('所以 f = Θ(g)', ''); await B.f.hop(tok); },
    both_eq: () => { S2('上界含「≥」、下界含「≤」：兩個都成立 → 同一類', ''); },
    // 相加取 max
    sum_rule: () => { board('f = O(g)、d = O(e) → f + d = ？'); S2('兩個函數相加，上界是什麼？', ''); },
    sum_ex: () => { B.f = bud('f = n', C.blue, X(2), 0.6); B.d = bud('d = n²', C.purple, X(3), 0.6); S2('例：f = n、d = n²', ''); },
    sum_Os: () => { mark('O(n)', 'good', X(2), 1.9, 1.4); mark('O(n²)', 'good', X(3), 1.9, 1.4); S2('f = O(n)、d = O(n²)', ''); },
    sum_add: async () => { mark.clear(); B.s = buddy('f + d = n + n²', '', C.red, X(4.4), 0, 1.4, 0.7); S2('f + d = n + n²', ''); await B.s.hop(tok); },
    sum_max: async () => { glow(cls6[3], GOLD); S2('取比較大的那一項 → O(n²)', ''); await AB2_walk(tok, B.s, X(3) + 1.0, 0, 2.6, 900); mark('O(n²)', 'good', X(3) + 1.0, 1.9, 2.6); },
    sum_swap: () => { AB2_rename(B.f, 'f = n²'); AB2_rename(B.d, 'd = n'); S2('n² 和 n 對調，答案一樣是 n²', ''); },
    sum_rule2: () => { board('f + d = O(max(g, e))'); S2('f + d = O(max(g, e))', '大的那個說了算'); },
    // 相乘
    prod_rule: () => { board('f = O(g)、d = O(e) → f·d = ？'); S2('兩個函數相乘呢？', ''); },
    prod_ex: async () => { B.f = bud('f = n', C.blue, X(2), 0.6); B.d = bud('d = n²', C.purple, X(3), 0.6); B.p = bud('f·d = n³', C.red, X(4) + 0.4, 0.7); glow(cls6[4], GOLD); S2('例：n · n² = n³', ''); await B.p.hop(tok); },
    prod_rule2: () => { board('f·d = O(g·e)'); mark('上界也相乘', 'note', 0, 5.6); S2('f·d = O(g·e)', '上界也跟著相乘'); },
  };
  const AA = {}; for (const k of plan) AA[k] = A[p + '_' + k];
  await AB2_run(tok, plan, AA);
}

// ───────── 6. 代值比較 n² 與 n³ ─────────
async function ab2Sample(tok) {
  fresh([0, 4.5, 14], [0, 2.6, 0]);
  const mark = AB2_marks();
  let b2 = null, b3 = null;
  const xs = [-2.5, 1, 4.5];
  const col = async (i, n) => {
    const x = xs[i];
    tag('n = ' + n, 'ptr', x, -0.3, 1);
    const a = bar(C.blue, 0.9, 0.9, x - 0.6, 0), b = bar(C.red, 0.9, 0.9, x + 0.6, 0);
    await growBar(tok, a, n * n * 0.09, 500); tag(String(n * n), 'idx', x - 0.6, n * n * 0.09 + 0.35);
    await growBar(tok, b, n * n * n * 0.09, 700); tag(String(n * n * n), 'idx', x + 0.6, n * n * n * 0.09 + 0.35);
    b3.mood('happy'); b2.mood('calm');
  };
  const A = {
    intro: () => { mark('比較兩個函數：誰是上界、誰是下界？', 'say', 0, 6.4); S2('比較兩個函數（時間或空間）', '誰大、誰小？'); },
    two: async () => { b2 = buddy('n²', '', C.blue, -6.2, 0, 1.2, 0.6); b3 = buddy('n³', '', C.red, -5.0, 0, 1.2, 0.6); S2('例：n² 和 n³', ''); await b3.hop(tok); },
    how: () => { mark('一看就知道…但怎麼證明？', 'say', 0, 5.6); S2('一看就知道 n³ 大，但要怎麼檢查？', ''); },
    n2: async () => { mark.clear(); S2('方法一：代值。n = 2：4 < 8', '2² = 4、2³ = 8'); await col(0, 2); },
    n3: async () => { S2('n = 3：9 < 27', '3² = 9、3³ = 27'); await col(1, 3); },
    n4: async () => { S2('n = 4：16 < 64', '4² = 16、4³ = 64'); await col(2, 4); },
    done: async () => { mark('n³ 一直比較大', 'good', 1, 6.6); S2('代三個值就看得出：n³ 一直比 n² 大', '方法一：sample 幾個 n 代入'); await b3.hop(tok); },
  };
  await AB2_run(tok, ['intro', 'two', 'how', 'n2', 'n3', 'n4', 'done'], A);
}

// ───────── 7. 對數公式 ─────────
async function ab2LogRules(tok) {
  fresh([0, 5, 14], [0, 3.4, 0]);
  const R = [
    ['log(a·b) = log a + log b', 'log(a·b)', ['log a', '+', 'log b'], '公式 1：乘變加'],
    ['log(a/b) = log a − log b', 'log(a/b)', ['log a', '−', 'log b'], '公式 2：除變減'],
    ['log aᵇ = b·log a', 'log aᵇ', ['b', '·', 'log a'], '公式 3：次方拿下來當係數'],
    ['a^(log_c b) = b^(log_c a)', 'a^(log_c b)', ['b', '^', '(log_c a)'], '公式 4：a、b 可以互換'],
    ['aᵇ = n ⇔ b = log_a n', 'aᵇ = n', ['b', '=', 'log_a n'], '公式 5：次方就是 log'],
  ];
  const cd = code(R.map((r) => r[0]), -3.6, 6.4, 0.75);
  cd.ls.forEach((l) => showL(l, false));
  let old = [];
  const show = async (i) => {
    old.forEach((o) => kill(o)); old = [];
    showL(cd.ls[i], true); cd.hl(i);
    S2(R[i][3], R[i][0]);
    const L = cube(R[i][1], C.blue, [2.6, 0.7, 1], 3.6, 4.6, 0, 2);
    await beat(tok, 900);
    fly(L, V3(0, 6, -2));
    old = R[i][2].map((s, k) => (s.length <= 1 ? tag(s, 'ptr', 1.9 + k * 1.7, 2.3) : cube(s, k === 0 ? C.green : C.purple, [1.5, 0.6, 1], 1.9 + k * 1.7, 2.3, 0, 2)));
  };
  const A = { r0: () => show(0), r1: () => show(1), r2: () => show(2), r3: () => show(3), r4: () => show(4),
    end: () => { cd.hl(-1); cd.ls.forEach((l) => showL(l, true)); S2('這些 log 公式在比較函數時會用到', 'log 預設以 2 為底'); } };
  await AB2_run(tok, ['r0', 'r1', 'r2', 'r3', 'r4', 'end'], A);
}

// ───────── 8. 取 log 比較兩個函數：天平上的兩個小角色 ─────────
// 每一步 { L, R：兩邊盤子上的式子, c：說明, s：公式行, t：傾斜（1 = g 重、−1 = f 重、0 = 平）, n：便條 }
const AB2_LC = {
  n2n3: { f: 'n²', g: 'n³', st: [
    { c: '方法二：兩邊都取 log', s: '', log: 1 },
    { L: 'log n²', R: 'log n³', c: '兩邊都取 log', s: 'log n²　vs　log n³' },
    { L: '2 log n', R: '3 log n', c: '次方拿下來變係數', s: '2 log n　vs　3 log n' },
    { t: 1, c: '2 log n < 3 log n → n² < n³', s: 'n² = O(n³)' },
    { n: '函數很複雜時特別好用', c: '這個方法在函數很複雜時特別有用', s: '' }] },
  n2logn: { f: 'n² log n', g: 'n (log n)¹⁰', st: [
    { c: '比較 f(n) = n² log n 與 g(n) = n·(log n)¹⁰', s: '' },
    { wob: 1, n: '次方 10 好像很大？', c: '次方 10 讓 g 看起來比較大，判斷不出來', s: '' },
    { L: 'log(n² log n)', R: 'log(n (log n)¹⁰)', log: 1, c: '判斷不出來 → 兩邊取 log', s: '' },
    { L: 'log n² + log log n', c: '公式 1：log(a·b) = log a + log b', s: '左邊：log n² + log log n' },
    { R: 'log n + log (log n)¹⁰', c: '右邊也用公式 1', s: '右邊：log n + log (log n)¹⁰' },
    { L: '2 log n + log log n', c: '公式 3：次方拿下來', s: 'log n² = 2 log n' },
    { R: 'log n + 10 log log n', c: '右邊的次方 10 也拿下來', s: 'log (log n)¹⁰ = 10 log log n' },
    { n: '先比大的項：2 log n > log n', c: '先比大的項：2 log n > log n', s: '' },
    { n: 'log log n 很小：像零錢（paisa）', c: 'log log n 很小，像零錢對上整數的錢', s: '2 盧比多一點 vs 1 盧比多一點' },
    { t: -1, c: 'f(n) 較大', s: 'g(n) = O(f(n))' }] },
  root3: { f: '3·n^√n', g: '2^(√n·log n)', st: [
    { c: '比較 f(n) = 3·n^√n 與 g(n) = 2^(√n·log n)', s: '' },
    { R: '2^(log n^√n)', c: '公式 3 反過來：√n·log n = log n^√n', s: 'g(n) = 2^(log n^√n)' },
    { n: 'log 預設以 2 為底', c: 'log 預設以 2 為底', s: '2^(log₂ n^√n)' },
    { R: '(n^√n)^(log₂ 2)', c: '公式 4：底數和 log 裡面互換', s: 'a^(log_c b) = b^(log_c a)' },
    { R: 'n^√n', c: 'log₂ 2 = 1 → g(n) = n^√n', s: '3·n^√n　vs　n^√n' },
    { n: '這題沒有兩邊取 log，只用公式化簡', c: '這題沒有兩邊取 log，只用了 log 公式', s: '' },
    { n: '只差一個係數 3', c: '兩邊一樣是 n^√n，只差係數 3', s: '' },
    { t: 0, c: '就像 2n² 與 n²：係數可以忽略', s: '' },
    { t: 0, eq: 1, c: '漸近上兩者相等；只是數值上 f 較大', s: 'f(n) = Θ(g(n))' }] },
  nlogn: { f: 'n^(log n)', g: '2^√n', st: [
    { c: '比較 n^(log n) 與 2^√n', s: '' },
    { L: 'log n^(log n)', R: 'log 2^√n', log: 1, c: '兩邊取 log', s: '' },
    { L: 'log n · log n', R: '√n · log 2', c: '公式 3：次方拿下來', s: '' },
    { L: 'log² n', R: '√n', c: 'log₂ 2 = 1：log² n vs √n', s: '還是看不出來' },
    { n: '再取一次 log！', log: 1, c: '還看不出來，就再取一次 log', s: '' },
    { L: '2 log log n', R: '½ log n', c: '再取一次 log', s: 'log(log² n) = 2 log log n、log √n = ½ log n' },
    { t: 1, c: 'log log n < log n → 2^√n 較大', s: 'n^(log n) = O(2^√n)' },
    { n: '取 log 只是為了好比較', c: '取 log 只是為了好比較，沒有固定公式', s: '' }] },
  pow2: { f: '2^(log n)', g: 'n^√n', st: [
    { L: 'log n · log 2 = log n', R: '√n · log n', log: 1, c: '兩邊取 log', s: 'log n　vs　√n·log n' },
    { t: 1, c: 'log n 較小 → 2^(log n) 較小', s: '其實 2^(log n) = n' }] },
  coef: { f: '2n', g: '3n', st: [
    { c: '比較 f(n) = 2n 與 g(n) = 3n', s: '' },
    { L: 'Θ(n)', R: 'Θ(n)', c: '直接看函數時，係數 2、3 可以忽略', s: '' },
    { t: 0, eq: 1, c: 'O(n)、Θ(n) 都一樣 → 兩者相等', s: '2n = Θ(3n)' }] },
  exp2: { f: '2ⁿ', g: '2²ⁿ', st: [
    { wob: 1, log: 1, c: '2ⁿ vs 2²ⁿ：先兩邊取 log', s: '' },
    { L: 'log 2ⁿ', R: 'log 2²ⁿ', c: '兩邊取 log', s: '' },
    { L: 'n · log 2 = n', R: '2n · log 2 = 2n', c: '次方拿下來，log₂ 2 = 1', s: 'n　vs　2n' },
    { bad: '取 log 後不能刪係數！', c: '別說「一樣」：取 log 後不能刪掉係數', s: '直接看函數才能刪係數' },
    { t: 1, c: '2n > n → 2²ⁿ 較大', s: '2ⁿ = O(2²ⁿ)' },
    { n: '其實 2²ⁿ = 4ⁿ', c: '其實 2²ⁿ = 4ⁿ，本來就比 2ⁿ 大', s: '' }] },
};
async function ab2LogCompare(tok) {
  const E = AB2_LC[AB2_P().ex] || AB2_LC.n2n3;
  fresh([0, 4.6, 14], [0, 3, 0]);
  cube('', '#8a7350', [0.3, 2.4, 0.3], 0, 1.2, 0);
  const beam = cube('', '#a99470', [7.6, 0.18, 0.4], 0, 2.5, 0);
  const pans = [-1, 1].map((s) => cube('', s < 0 ? C.blue : C.red, [2.4, 0.18, 1.4], s * 3.6, 2.0, 0));
  const bs = [buddy('f(n)', '', C.blue, -3.6, 2.1, 0, 0.6), buddy('g(n)', '', C.red, 3.6, 2.1, 0, 0.6)];
  const lbs = [-1, 1].map((s) => tag('', 'ptr', s * 3.6, 4.0));
  let rz = 0;
  const setTilt = (r) => { rz = r; beam.rotation.z = r; [-1, 1].forEach((s, i) => { const y = 2.5 + s * 3.6 * Math.sin(r); pans[i].position.y = y - 0.5; bs[i].g.position.y = y - 0.4; lbs[i].position.y = y + 1.5; }); };
  const tiltTo = (r, ms) => { const r0 = rz; return anim(tok, ms, (t) => setTilt(r0 + (r - r0) * t)); };
  setTilt(0);
  txt(lbs[0], E.f); txt(lbs[1], E.g);
  let note = null;
  const A = {};
  const plan = E.st.map((s, i) => { A[i] = async () => {
    if (note) { kill(note); note = null; }
    S2(s.c, s.s);
    if (s.L) txt(lbs[0], s.L);
    if (s.R) txt(lbs[1], s.R);
    if (s.n) note = tag(s.n, 'note', 0, 6.4);
    if (s.bad) note = tag(s.bad, 'bad', 0, 6.4);
    if (s.log) { const pk = [-1, 1].map((sg) => tag('log', 'pkt', sg * 3.6, 6.4)); await Promise.all(pk.map((l, k) => travel(tok, l, V3((k ? 1 : -1) * 3.6, 6.4, 0), V3((k ? 1 : -1) * 3.6, 4.6, 0), 700))); pk.forEach(kill); }
    if (s.wob) { await tiltTo(-0.07, 350); await tiltTo(0.07, 500); await tiltTo(0, 300); }
    if (s.t !== undefined) {
      await tiltTo(s.t === 0 ? 0 : -s.t * 0.2, 900);
      if (s.t === 0) { bs.forEach((b) => b.mood(s.eq ? 'happy' : 'calm')); if (s.eq) pans.forEach((m) => glow(m, GOLD)); }
      else { const w = s.t > 0 ? 1 : 0; bs[w].mood('happy'); bs[1 - w].mood('sad'); glow(pans[w], GOLD); await bs[w].hop(tok); }
    }
  }; return i; });
  await AB2_run(tok, plan, A);
}

// ───────── 9. 分段函數 g1、g2 ─────────
async function ab2Piecewise(tok) {
  fresh([0, 4.6, 14], [0, 2.6, 0]);
  const mark = AB2_marks();
  let g1 = null, g2 = null;
  const Z = [[-4, 3, 2], [0, 2, 2], [4, 2, 3]];
  const bars = [];
  const zoneBars = async (i) => {
    const [x, h1, h2] = Z[i];
    const a = bar(C.blue, 0.9, 0.9, x - 0.6, 0), b = bar(C.red, 0.9, 0.9, x + 0.6, 0);
    await Promise.all([growBar(tok, a, h1 * 1.2, 700), growBar(tok, b, h2 * 1.2, 700)]);
    tag(h1 === 3 ? 'n³' : 'n²', 'idx', x - 0.6, h1 * 1.2 + 0.35); tag(h2 === 3 ? 'n³' : 'n²', 'idx', x + 0.6, h2 * 1.2 + 0.35);
    bars.push(a, b);
  };
  const A = {
    two: async () => { g1 = buddy('g₁', '', C.blue, -6.3, 0, 2.2, 0.55); g2 = buddy('g₂', '', C.red, -5.1, 0, 2.2, 0.55); S2('比較兩個函數 g₁、g₂：誰比較大？', ''); await g1.hop(tok); },
    d1: () => { tag('g₁ = n³（n < 100）、n²（n ≥ 100）', 'ptr', -0.6, 6.6); S2('g₁：n < 100 時是 n³，之後變成 n²', '越來越小'); },
    d2: () => { tag('g₂ = n²（n ≤ 10,000）、n³（之後）', 'ptr alt', -0.6, 6.0); S2('g₂：到 10,000 都是 n²，之後變成 n³', ''); },
    axis: () => { line(-6, 0.05, 6.2, 0.05, 0, '#6e5f49'); tag('n', 'idx', 6.6, 0.1); [[-2, '100'], [2, '10,000'], [6, '∞']].forEach(([x, l]) => { line(x, 0, x, 4.8, 0, '#c9b48e'); tag(l, 'idx', x, -0.35); }); S2('畫一條 n 的數線：100、10,000', '藍 g₁　紅 g₂'); },
    z1: async () => { g1.mood('happy'); S2('n < 100：g₁ = n³ 較大', ''); await zoneBars(0); },
    z2: async () => { g1.mood('calm'); g2.mood('calm'); S2('100 到 10,000：兩個都是 n²，一樣大', ''); await zoneBars(1); },
    z3: async () => { g2.mood('happy'); g1.mood('sad'); S2('超過 10,000：g₂ = n³ 較大', ''); await zoneBars(2); },
    win: async () => { glow(bars[5], GOLD); const m = ghostBox('#2fc092', 3.8, 4.6, 1.6); m.position.set(4, 2.3, 0); mark('g₂ 從 10,000 起永遠較大', 'good', 4, 5.6); S2('從 10,000 起一直都是 g₂ 大 → g₂ 較大', 'g₁ = O(g₂)'); await g2.hop(tok); },
    large: () => { mark('不看小的 n', 'note', -4, 5.6); S2('比較函數不看小的 n', '只要從某一點起永遠較大，就算較大'); },
    inf: async () => { S2('10,000 之後一直到無限大都不會變', '所以 g₂ 永遠比 g₁ 大'); const pk = tag('→ ∞', 'pkt', 2.2, 4.6); await travel(tok, pk, V3(2.2, 4.6, 0), V3(6, 4.6, 0), 1500); },
  };
  await AB2_run(tok, ['two', 'd1', 'd2', 'axis', 'z1', 'z2', 'z3', 'win', 'large', 'inf'], A);
}

// ───────── 10. 是非題 ─────────
async function ab2TrueFalse(tok) {
  fresh([0, 5, 14], [0, 3.4, 0]);
  const S = [
    ['(n + k)ᵐ = Θ(nᵐ)', true],
    ['2ⁿ⁺¹ = O(2ⁿ)', true],
    ['2²ⁿ = O(2ⁿ)', false],
    ['√(log n) = O(log log n)', false],
    ['n^(log n) = O(2ⁿ)', true],
  ];
  const rows = [];
  let jd = null, note = null;
  const yy = (i) => 6.2 - i * 1.25;
  const row = (i) => { rows[i] = cube(S[i][0], GRAY, [4.6, 0.7, 1], -1.6, yy(i), 0, 2); };
  const say2 = (t, cls = 'say', i = 0) => { if (note) kill(note); note = tag(t, cls, 3.6, yy(i) + 0.55); };
  const verdict = async (i) => { const ok = S[i][1]; tint(rows[i], ok ? C.green : C.red); tag(ok ? '✓ 對' : '✗ 錯', ok ? 'good' : 'bad', 1.4, yy(i)); jd.mood(ok ? 'happy' : 'sad'); if (ok) await jd.hop(tok); };
  const A = {
    intro: async () => { jd = buddy('判官', '', C.teal, 5.6, 0, 1.6, 0.75); S2('考古題：判斷這些敘述是對還是錯', ''); await jd.hop(tok); },
    r0: () => { row(0); jd.mood('wow'); S2('(n + k)ᵐ：把二項式展開', '最高次項是 nᵐ'); },
    r0e: () => { say2('(n + 3)² = n² + 6n + 9', 'say', 0); S2('像 (n + 3)²：最高項是 n²', ''); },
    r0v: async () => { S2('所以 (n + k)ᵐ = Θ(nᵐ)：對', '老師口誤說成 Θ(n²)，應為 Θ(nᵐ)'); await verdict(0); },
    r1: () => { row(1); jd.mood('wow'); say2('2ⁿ⁺¹ = 2·2ⁿ', 'say', 1); S2('2ⁿ⁺¹ = 2·2ⁿ', ''); },
    r1v: async () => { S2('係數 2 可以忽略：2ⁿ⁺¹ = Θ(2ⁿ)，O 當然也對', '對'); await verdict(1); },
    r2: () => { row(2); jd.mood('wow'); say2('2²ⁿ = 4ⁿ > 2ⁿ', 'say', 2); S2('2²ⁿ = 4ⁿ，比 2ⁿ 大', ''); },
    r2v: async () => { S2('比較小的 2ⁿ 不能當上界 → 錯', '應該是 O(4ⁿ)'); await verdict(2); },
    r3: () => { row(3); jd.mood('wow'); say2('兩邊取 log', 'say', 3); S2('√(log n) vs log log n：兩邊取 log', ''); },
    r3v: async () => { say2('½ log log n > log log log n', 'say', 3); S2('右邊比較小：小的不能當上界 → 錯', ''); await verdict(3); },
    r4: async () => { row(4); say2('log² n < n', 'say', 4); S2('n^(log n) vs 2ⁿ：取 log 得 log² n vs n', 'n 比較大 → 對'); await verdict(4); },
  };
  await AB2_run(tok, ['intro', 'r0', 'r0e', 'r0v', 'r1', 'r1v', 'r2', 'r2v', 'r3', 'r3v', 'r4'], A);
}

// ───────── 11. Linear search ─────────
const AB2_LS = [8, 6, 12, 5, 9, 7, 4, 3, 16, 18];
async function ab2LinearSearch(tok) {
  const p = AB2_P(), cases = p.mode === 'cases';
  fresh([0, 5, 13], [0, 1.6, 0]);
  const xs = (i) => -5.4 + i * 1.2;
  let cs = [];
  const mark = AB2_marks();
  const list = () => { cs = AB2_LS.map((v, i) => { tag(String(i), 'idx', xs(i), -0.25, 0.8); return cube(v, C.blue, [1, 0.8, 1], xs(i), 0.4, 0, 2); }); };
  if (cases) list();
  let kb = null;
  const reset = () => cs.forEach((m) => { tint(m, C.blue); glow(m, null); });
  const keyAt = (i) => V3(xs(i), 0.85, 1.5);
  // the key walks along the list, comparing one cell at a time
  const scan = async (from, to, msEach, key) => {
    for (let i = from; i <= to; i++) {
      await travel(tok, kb.g, kb.g.position.clone(), keyAt(i), msEach * 0.6);
      glow(cs[i], GOLD);
      if (AB2_LS[i] === key) { tint(cs[i], C.green); kb.mood('happy'); return i; }
      await beat(tok, msEach * 0.4); glow(cs[i], null);
    }
    return -1;
  };
  const A = {
    intro: () => { mark('linear search：在一串元素裡找 key', 'say', 0, 4.6); S2('Linear search：在一串元素裡找某個 key', ''); },
    list: () => { list(); S2('這裡有 10 個元素', '[8, 6, 12, 5, 9, 7, 4, 3, 16, 18]'); },
    key7: async () => { mark.clear(); kb = buddy('key', 7, C.gold, -6.6, 0, 1.5, 0.6); S2('要找 key = 7', ''); await kb.hop(tok); },
    scan7: async () => { S2('從左邊開始，一次比一個：是 7 嗎？不是…', ''); await scan(0, 4, 450, 7); },
    found7: async () => { await scan(5, 5, 450, 7); mark('比較 6 次', 'good', xs(5), 2.6); S2('第 6 次比較，在 index 5 找到 7', '成功的搜尋'); await kb.hop(tok); },
    key20: async () => { reset(); mark.clear(); kb.set(20); kb.mood('calm'); S2('換成找 key = 20', ''); await travel(tok, kb.g, kb.g.position.clone(), V3(-6.6, 0, 1.5), 700); },
    scan20: async () => { S2('第一個不是、下一個、下一個…', ''); await scan(0, 9, 240, 20); },
    fail: () => { kb.mood('sad'); mark('比完 10 個都沒有', 'bad', 0, 2.6); S2('整串比完都沒有 → 失敗的搜尋', '比較了 n = 10 次'); },
    both: () => { mark.clear(); mark('key 7：成功（index 5）', 'good', -3, 3.4); mark('key 20：失敗', 'bad', 3, 3.4); S2('搜尋可能成功，也可能失敗', ''); },
    // best / worst
    bw: () => { mark('best case？worst case？', 'say', 0, 4.6); S2('什麼是 best case？什麼是 worst case？', ''); },
    best: () => { mark.clear(); glow(cs[0], GOLD); mark('第一個 index', 'note', xs(0), 2.0); S2('best case：要找的 key 剛好在第一個 index', ''); },
    key8: async () => { kb = buddy('key', 8, C.gold, -6.6, 0, 1.5, 0.6); S2('例：找 8，比 1 次就找到', '常數時間'); await scan(0, 0, 500, 8); await kb.hop(tok); },
    B: () => { mark('B(n) = 1 → O(1)', 'good', -2, 3.6); S2('best case 時間 B(n) = 1 → O(1)', ''); },
    worst: () => { reset(); glow(cs[9], GOLD); mark('最後一個 index', 'note', xs(9), 2.0); kb.mood('calm'); S2('worst case：key 在最後一個 index', '花最多時間'); },
    key18: async () => { kb.set(18); S2('例中最後一個是 18', ''); await travel(tok, kb.g, kb.g.position.clone(), V3(-6.6, 0, 1.5), 700); },
    scan18: async () => { S2('要把 n 個元素都比過才找到', ''); await scan(0, 9, 240, 18); },
    W: async () => { mark('W(n) = n → O(n)', 'good', 2.5, 3.6); S2('worst case 時間 W(n) = n → O(n)', ''); await kb.hop(tok); },
  };
  const plan = cases ? ['bw', 'best', 'key8', 'B', 'worst', 'key18', 'scan18', 'W'] : ['intro', 'list', 'key7', 'scan7', 'found7', 'key20', 'scan20', 'fail', 'both'];
  await AB2_run(tok, plan, A);
}

// ───────── 12. 平均情況 (n + 1)/2 ─────────
async function ab2LsAverage(tok) {
  fresh([0, 4.6, 13], [0, 2, 0]);
  const xs = (i) => -5.4 + i * 1.2, H = 0.42;
  const mark = AB2_marks();
  const bs = [];
  const A = {
    def: () => { mark('A(n) = 所有情況的時間總和 ÷ 情況數', 'say', 0, 5.4); S2('average case：所有情況的時間加起來，除以情況數', ''); },
    hard: () => { mark('要列出每一種情況：很難', 'bad', 0, 4.6); S2('要列出所有情況、算每個的時間：很困難', '很多演算法做不到'); },
    worst: () => { mark('平均通常和 worst case 差不多', 'note', 0, 3.8); S2('平均時間通常和 worst case 差不多', '所以多半分析 worst case'); },
    cases: () => { mark.clear(); AB2_LS.forEach((v, i) => { tag(String(v), 'idx', xs(i), -0.3, 0.9); }); S2('linear search 的情況：key 在第 1、2、…、n 格', '每一格都可能是 key'); },
    grow: async () => {
      S2('key 在第 i 格 → 比較 i 次', '1、2、3、…、n');
      for (let i = 0; i < 10; i++) { const b = bar(i === 0 ? C.green : i === 9 ? C.red : C.blue, 0.9, 0.9, xs(i), 0); bs.push(b); await growBar(tok, b, (i + 1) * H, 180); tag(String(i + 1), 'idx', xs(i), (i + 1) * H + 0.3); }
    },
    n: () => { mark('共 n 種情況　總和 n(n + 1)/2', 'say', 0, 5.4); S2('一共 n 種情況：1 + 2 + … + n = n(n + 1)/2', 'n = 10：55'); },
    avg: async () => {
      S2('除以 n：(n + 1)/2', 'n = 10：55 ÷ 10 = 5.5');
      await anim(tok, 1500, (t) => bs.forEach((b, i) => setBar(b, ((i + 1) + (5.5 - (i + 1)) * t) * H)));
      line(-6, 5.5 * H, 6, 5.5 * H, 0, '#c08a1f'); tag('5.5', 'ptr alt', 6.4, 5.5 * H);
    },
    cmp: () => { mark('時間 = 比較次數', 'note', 0, 4.6); S2('這裡的時間都用「比較次數」來算', 'A(n) = (n + 1)/2'); },
  };
  await AB2_run(tok, ['def', 'hard', 'worst', 'cases', 'grow', 'n', 'avg', 'cmp'], A);
}

// ───────── 13. case 與符號無關 ─────────
async function ab2CaseNotation(tok) {
  fresh([0, 5, 13.5], [0, 3.2, 0]);
  const cols = ['O', 'Ω', 'Θ'];
  const rows = [['B(n) = 1', '1', 5], ['A(n) = (n+1)/2', 'n', 3.5], ['W(n) = n', 'n', 2]];
  const mark = AB2_marks();
  const fn = (i) => cube(rows[i][0], i === 0 ? C.green : i === 1 ? C.blue : C.red, [3.2, 0.7, 1], -4.2, rows[i][2], 0, 2);
  const nt = (i, j) => cube(cols[j] + '(' + rows[i][1] + ')', C.green, [1.8, 0.6, 0.9], 0.4 + j * 2.1, rows[i][2], 0, 2);
  const A = {
    intro: () => { cols.forEach((c, j) => tag(c, 'ptr', 0.4 + j * 2.1, 6.3)); mark('符號描述函數；case 是一種分析', 'say', 0, 7.0); S2('case 和符號是兩回事', '符號描述函數；case 是對演算法做的分析'); },
    B: () => { fn(0); nt(0, 0); S2('best case B(n) = 1：可以寫 O(1)', ''); },
    B3: () => { nt(0, 1); nt(0, 2); S2('也可以寫 Ω(1)、Θ(1)', ''); },
    cls: () => { mark('1 是常數函數 → 常數類', 'note', 4.6, 5.6); S2('1 是常數函數，屬於常數類', '所以三種都對'); },
    W: () => { mark.clear(); fn(2); S2('worst case W(n) = n：屬於線性類', ''); },
    W3: async () => { for (let j = 0; j < 3; j++) { nt(2, j); await beat(tok, 300); } S2('O(n)、Ω(n)、Θ(n) 都對', ''); },
    none: () => { S2('沒有固定哪個 case 要用哪個符號', '任何 case 都能用任何符號'); },
    bad: async () => { const b = cube('O = worst、Ω = best？', C.red, [4.4, 0.7, 1], 0.6, 0.4, 1.2, 2); mark('✗ 錯', 'bad', 3.4, 0.9, 1.2); S2('「O 就是 worst、Ω 就是 best」：錯！', ''); await beat(tok, 1400); fly(b); },
    Av: async () => { mark.clear(); fn(1); for (let j = 0; j < 3; j++) { nt(1, j); await beat(tok, 300); } S2('average (n + 1)/2 也屬線性類：三種都能用', ''); },
  };
  await AB2_run(tok, ['intro', 'B', 'B3', 'cls', 'W', 'W3', 'none', 'bad', 'Av'], A);
}

// ───────── 14. BST 的 best / worst ─────────
async function ab2BstCases(tok) {
  const skew = !!AB2_P().skew;
  fresh([0, 4.8, 14], [0, 3.4, 0]);
  const mk = (spec, ox, sc) => { const M = {}; for (const [v, x, y, par] of spec) M[v] = tnode(v, ox + x * sc, y, 0, par ? M[par] : null, C.blue); return M; };
  const BAL = [[20, 0, 6.2], [10, -2.4, 4.6, 20], [30, 2.4, 4.6, 20], [5, -3.6, 3.0, 10], [15, -1.2, 3.0, 10], [25, 1.2, 3.0, 30], [40, 3.6, 3.0, 30]];
  const mark = AB2_marks();
  let M = null, kb = null;
  const near = (v) => M[v].position.clone().add(V3(0.95, -0.45, 0.4));
  const go = (v, ms = 800) => travel(tok, kb.g, kb.g.position.clone(), near(v), ms);
  if (!skew) {
    const A = {
      tree: () => { M = mk(BAL, 0, 1); S2('binary search tree：用來搜尋', ''); },
      rule: () => { mark('左邊都比較小', 'say', -3.2, 6.6); mark('右邊都比較大', 'say', 3.2, 6.6); S2('每個節點：左邊都比它小、右邊都比它大', ''); },
      s15: async () => { mark.clear(); kb = buddy('key', 15, C.gold, -5.6, 5.6, 0.4, 0.5); S2('搜尋 15：從 root 20 開始', ''); await go(20); glow(M[20], GOLD); },
      left: async () => { S2('15 < 20 → 往左；遇到 10', ''); await go(10); glow(M[10], GOLD); },
      right: async () => { S2('15 > 10 → 往右：找到 15！', ''); await go(15); glow(M[15], GOLD); tint(M[15], C.green); kb.mood('happy'); await kb.hop(tok); },
      cnt: () => { mark('比較 3 次', 'good', 5.4, 6.4); S2('總共比較 3 次', '20、10、15'); },
      h: () => { line(5.0, 6.2, 5.0, 3.0, 0, '#c08a1f'); mark('= 樹高', 'note', 5.8, 4.6); S2('3 次剛好等於樹的高度', ''); },
      logn: () => { mark('7 個 ≈ 8 個：log 8 = 3', 'note', 5.0, 2.2); S2('樹高約 log n：7 個元素 ≈ 8，log 8 = 3', '花的時間 = log n'); },
      bw: () => { mark.clear(); [20, 10, 15].forEach((v) => { glow(M[v], null); tint(M[v], C.blue); }); kb.mood('calm'); S2('那 best case、worst case 呢？', ''); },
      best: async () => { tint(M[20], C.green); kb.set(20); S2('best case：要找的就在 root', ''); await go(20); },
      B1: async () => { mark('B(n) = 1', 'good', 0, 7.2); kb.mood('happy'); S2('找 20：看 root 一次就找到 → B(n) = 1', ''); await kb.hop(tok); },
      worst: () => { kb.mood('calm'); S2('worst case：要找的在 leaf（最底下那層）', ''); },
      leaves: async () => { for (const v of [5, 15, 25, 40]) { tint(M[v], C.red); await beat(tok, 250); } S2('leaf 是 5、15、25、40', '找它們要比最多次'); },
      W: () => { mark('W(n) = 樹高 = log n', 'good', 0, 1.6); S2('worst case 時間 = 樹高 = log n', ''); },
    };
    await AB2_run(tok, ['tree', 'rule', 's15', 'left', 'right', 'cnt', 'h', 'logn', 'bw', 'best', 'B1', 'worst', 'leaves', 'W'], A);
    return;
  }
  mk(BAL.map(([v, x, y, p]) => [v, x, y - 0.6, p]), -3.2, 0.62);
  tag('平衡樹', 'ptr alt', -3.2, 0.9);
  const SK = [[40, 0, 6.6], [30, -0.7, 5.75, 40], [25, -1.4, 4.9, 30], [20, -2.1, 4.05, 25], [15, -2.8, 3.2, 20], [10, -3.5, 2.35, 15], [5, -4.2, 1.5, 10]];
  const S = {};
  const add = async (from, to) => { for (let k = from; k <= to; k++) { const [v, x, y, par] = SK[k]; S[v] = tnode(v, 6 + x, y, 0, par ? S[par] : null, C.purple); await beat(tok, 300); } };
  const A = {
    root: async () => { S2('同樣 7 個元素，也可以這樣建：root 是 40', ''); await add(0, 0); },
    a: async () => { S2('40 的左邊 30、再左邊 25、再左邊 20', ''); await add(1, 3); },
    b: async () => { S2('再來 15、10、5：每個都往左掛', '左斜樹（left skewed）'); await add(4, 6); tag('左斜樹', 'ptr alt', 4.6, 0.6); },
    hts: () => { mark('高度最小：log n', 'good', -3.2, 5.6); mark('高度最大：n', 'good', 1.2, 6.8); S2('平衡樹是最矮的，左斜樹是最高的', ''); },
    best: () => { tint(S[40], C.green); S2('best case 一樣：要找的在 root', 'B(n) = 1'); },
    worst: () => { tint(S[5], C.red); S2('worst case：找唯一的 leaf 5', ''); },
    dep: async () => { S2('時間取決於樹高：這棵的高度是 n', ''); for (const v of [40, 30, 25, 20, 15, 10, 5]) { glow(S[v], GOLD); await beat(tok, 220); } },
    mm: () => { mark.clear(); mark('minimum worst case：log n', 'good', -3.2, 5.6); mark('maximum worst case：n', 'good', 1.2, 6.8); S2('最小的 worst case 時間 log n、最大的 n', ''); },
    rep: () => { S2('再說一次：worst case = 找 leaf，leaf 在最底層', '所以時間看樹高'); },
    hr: () => { S2('BST 的高度最小是 log n、最大是 n', ''); },
    h: () => { mark('W(n) = h，log n ≤ h ≤ n', 'note', 0, 0.2); S2('worst case 時間寫成樹高 h', 'log n ≤ h ≤ n'); },
    any: () => { S2('best、worst 都能用 O、Ω、Θ 任一種表示', ''); },
  };
  await AB2_run(tok, ['root', 'a', 'b', 'hts', 'best', 'worst', 'dep', 'mm', 'rep', 'hr', 'h', 'any'], A);
}

// ───────── 15. Binary search 的 frequency：3 log n + 2 ─────────
async function ab2BinSearch(tok) {
  fresh([0, 5.5, 14], [0, 3, 0]);
  const L = ['i = 1;', 'j = n;', 'while (i < j) {', '  mid = (i + j) / 2;', '  if (key == A[mid]) return mid;', '  else if (key < A[mid]) j = mid − 1;', '  else i = mid + 1;', '}'];
  const cd = code(L, -2.8, 7.2, 0.5);
  const fq = L.map((_, i) => tag('', 'ptr alt', 2.8, 7.2 - i * 0.5));
  const n = 16, xs = (k) => -5.6 + k * 0.75;
  for (let k = 1; k <= n; k++) { ctx.tile(V3(xs(k - 1), 0.04, 1.2), 0.68, 0.9, '#efe6d2'); tag(String(k), 'idx', xs(k - 1), -0.3, 1.9); }
  const zone = ghostBox('#2fc092', 1, 0.9, 1.0);
  const setZone = (i, j) => { zone.scale.x = (j - i + 1) * 0.75; zone.position.set((xs(i - 1) + xs(j - 1)) / 2, 0.45, 1.2); };
  const pi = tag('i', 'ptr', xs(0), 1.3, 1.2), pj = tag('j', 'ptr', xs(n - 1), 1.3, 1.2), pm = tag('mid', 'ptr alt', 0, 1.9, 1.2);
  setZone(1, n);
  const cnt = tag('', 'ptr alt', 4.8, 3.6);
  const A = {
    init: () => { cd.hl(0); txt(fq[0], '1'); txt(fq[1], '1'); S2('binary search：i = 1、j = n 各執行 1 次', '例：n = 16，key 比所有元素都大'); },
    halve: async () => {
      S2('每次取中間 (i + j)/2：範圍砍一半', 'n = 16 → 8 → 4 → 2 → 1');
      let i = 1, j = n, c = 0;
      while (i < j) {
        c++; cd.hl(3); txt(cnt, '第 ' + c + ' 圈');
        const mid = Math.floor((i + j) / 2); pm.position.x = xs(mid - 1); await beat(tok, 300);
        cd.hl(6); i = mid + 1; pi.position.x = xs(i - 1); setZone(i, j); await beat(tok, 300);
      }
      cd.hl(-1);
    },
    logn: () => { cd.hl(2); txt(fq[2], 'log n'); txt(fq[3], 'log n'); S2('所以迴圈重複 log n 次', '16 → 4 圈 = log₂ 16'); },
    either: () => { cd.hl(4); txt(fq[4], 'log n（if / else 只走一個）'); S2('if 或 else 每圈只會執行其中一個', '所以也只算 log n'); },
    f: () => { cd.hl(-1); tag('f(n) = 3 log n + 2', 'note', 4.6, 2.6); S2('加起來：f(n) = 3 log n + 2', ''); },
    cls: () => { S2('最高項是 log n → 對數時間', 'Θ(log n)'); },
  };
  await AB2_run(tok, ['init', 'halve', 'logn', 'either', 'f', 'cls'], A);
}

// ───────── 16. Frequency count（Simplified 用的 cued 版本）：Sum、矩陣 ─────────
async function ab2FreqSum(tok) {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const mark = AB2_marks();
  const SUMA = [8, 3, 9, 7, 2];
  let cd = null, fq = [], ip = null, cs = [];
  const xs = (k) => -5 + k * 1.2;
  const A = {
    method: () => { mark('frequency count：數每個敘述執行幾次', 'say', 0, 6.6); S2('方法：算每個敘述執行幾次', 'frequency count'); },
    one: () => { mark('只有一個敘述 → f = 1：常數', 'note', 0, 5.8); S2('只有一個敘述：f = 1 → 常數時間', ''); },
    sum: () => {
      mark.clear();
      cd = code(['Algorithm Sum(A, n)', '{', '  s = 0;', '  for (i = 0; i < n; i++)', '    s = s + A[i];', '  return s;', '}'], -3.4, 6.8, 0.5);
      fq = [null, null, tag('', 'ptr alt', -0.2, 5.8), tag('', 'ptr alt', -0.2, 5.3), tag('', 'ptr alt', -0.2, 4.8), tag('', 'ptr alt', -0.2, 4.3)];
      cs = SUMA.map((v, k) => { tag('A[' + k + ']', 'idx', xs(k), 0, 0.95); return cube(v, C.blue, [1, 0.7, 1], xs(k), 0.35, 0, 2); });
      cd.hl(2); txt(fq[2], '1'); txt(fq[3], 'n + 1');
      S2('陣列求和：s = 0 執行 1 次、for 執行 n + 1 次', '例：n = 5');
    },
    body: () => { cd.hl(4); txt(fq[4], 'n'); txt(fq[5], '1'); S2('迴圈裡 s = s + A[i] 執行 n 次、return 1 次', ''); },
    why: async () => {
      cd.hl(3); S2('for 為什麼是 n + 1？i 走到 n 還要再檢查一次才停', 'i = 0、1、2、3、4 成立，i = 5 不成立');
      ip = tag('i', 'ptr', xs(0), 1.5);
      for (let i = 0; i <= 5; i++) { ip.position.x = xs(Math.min(i, 5)); cube('', i < 5 ? C.purple : C.red, [0.8, 0.3, 0.8], 4.4, 0.17 + i * 0.34, 0, 2); if (i < 5) glow(cs[i], GOLD); await beat(tok, 380); }
      tag('檢查 6 次 = n + 1', 'ptr alt', 4.4, 2.6);
    },
    tot: () => { cd.hl(-1); mark('f(n) = 1 + (n + 1) + n + 1 = 2n + 3', 'note', 2.6, 6.6); S2('加起來：f(n) = 2n + 3', ''); },
    poly: () => { S2('一行一行算，得到的是一個多項式', '2n + 3'); },
    lin: () => { mark('最高次 n → 線性', 'good', 2.6, 5.9); S2('最高次是 n → 線性時間', 'O(n)'); },
  };
  await AB2_run(tok, ['method', 'one', 'sum', 'body', 'why', 'tot', 'poly', 'lin'], A);
}
async function ab2FreqMatrix(tok) {
  let cd = null, fl = [];
  const n = 3, cell = (i, j) => [-1.2 + j * 1.2, (i - 1) * 1.2];
  const setup = (mul) => {
    fresh([0, 6.5, 14], [0, 2.4, 0]);
    const lines = mul
      ? ['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++) {', '    C[i][j] = 0;', '    for (k = 0; k < n; k++)', '      C[i][j] += A[i][k] * B[k][j];', '  }']
      : ['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    C[i][j] = A[i][j] + B[i][j];'];
    cd = code(lines, -2.8, 6.8, 0.48);
    fl = lines.map((_, i) => tag('', 'ptr alt', 2.8, 6.8 - i * 0.48));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = cell(i, j); ctx.tile(V3(x, 0.04, z), 1, 1); }
    tag('C（n = 3）', 'ptr', -3.4, 0.2, 0);
  };
  const A = {
    add: () => { setup(false); cd.hl(0); txt(fl[0], 'n + 1'); txt(fl[1], 'n(n + 1)'); S2('矩陣相加：外層 n + 1、內層 n(n + 1)', '內層在外層裡面，所以乘 n'); },
    body: async () => {
      cd.hl(2); S2('最內層敘述執行 n² 次', 'n = 3 → 9 次（一顆方塊 = 一次）');
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = cell(i, j); cube('', C.green, [0.8, 0.35, 0.8], x, 0.25, z, 3); await beat(tok, 180); }
      txt(fl[2], 'n²');
    },
    f2: () => { cd.hl(-1); tag('f(n) = 2n² + 2n + 1', 'note', 3.6, 3.6); S2('f(n) = 2n² + 2n + 1', ''); },
    quad: () => { tag('最高次 n² → 平方', 'good', 3.6, 2.9); S2('最高次 n² → 平方時間（quadratic）', 'O(n²)'); },
    mul: () => { setup(true); cd.hl(0); txt(fl[0], 'n + 1'); txt(fl[1], 'n(n + 1)'); txt(fl[2], 'n²'); S2('矩陣相乘：三層迴圈', 'n + 1、n(n + 1)、n²'); },
    inner: async () => {
      cd.hl(4); txt(fl[3], 'n²(n + 1)'); S2('第三層 n²(n + 1)、最內層 n³ 次', 'n = 3 → 27 次');
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) { const [x, z] = cell(i, j); cube('', C.purple, [0.8, 0.3, 0.8], x, 0.23 + k * 0.34, z, 3); await beat(tok, 80); }
      txt(fl[4], 'n³');
    },
    f3: () => { cd.hl(-1); tag('f(n) = 2n³ + 3n² + 2n + 1', 'note', 3.6, 3.6); S2('f(n) = 2n³ + 3n² + 2n + 1', ''); },
    cubic: () => { tag('最高次 n³ → 立方', 'good', 3.6, 2.9); S2('最高次 n³ → 立方時間（cubic）', 'O(n³)'); },
  };
  await AB2_run(tok, ['add', 'body', 'f2', 'quad', 'mul', 'inner', 'f3', 'cubic'], A);
}

// ───────── 17. 遞迴函數 T(n) = 2T(n−1) + 1（Simplified 用的 cued 版本） ─────────
async function ab2WriteRR2T(tok) {
  fresh([0, 5, 14], [0, 3.2, 0]);
  const cd = code(['void Test(int n) {', '  if (n > 0) {', '    printf("%d", n);', '    Test(n − 1);', '    Test(n − 1);', '  }', '}'], -3.6, 6.8, 0.55);
  const cost = (ln, c, k) => { tag(c, 'ptr alt', 0.8, 6.8 - ln * 0.55); return cube(c, c.startsWith('T') ? C.purple : C.green, [1.6, 0.6, 1], 2.4 + k * 1.75, 0.3, 0, 3); };
  let fb = null, rr = null;
  const A = {
    T: async () => { cd.hl(0); fb = buddy('Test(n)', 'T(n)', C.teal, -5.8, 0, 1.6, 0.7); S2('遞迴函數：設 Test(n) 花 T(n) 時間', ''); await fb.hop(tok); },
    one: () => { cd.hl(2); cost(2, '1', 0); cd.hl(3); cost(3, 'T(n−1)', 1); S2('printf 花 1；呼叫自己 Test(n−1) 花 T(n−1)', '規模少 1 的同一個問題'); },
    two: () => { cd.hl(4); cost(4, 'T(n−1)', 2); S2('再呼叫一次：又是 T(n−1)', ''); },
    rr: () => { cd.hl(-1); rr = tag('T(n) = 2T(n−1) + 1', 'note', 3.8, 2.4); S2('全部加起來：T(n) = 2T(n−1) + 1', '這叫遞迴式（recurrence relation）'); },
    sol: () => { tag('解出來 ≈ 2ⁿ', 'good', 3.8, 1.6); S2('解出這個遞迴式，會得到 2ⁿ', '解法在其他影片'); },
    exp: async () => { fb.mood('wow'); S2('2ⁿ → 指數時間（exponential）', ''); await fb.hop(tok); },
  };
  await AB2_run(tok, ['T', 'one', 'two', 'rr', 'sol', 'exp'], A);
}

// ───────── 16. 從程式寫出遞迴式 ─────────
const AB2_RR = {
  n: { code: ['void Test(int n) {', '  if (n > 0) {', '    for (i = 0; i < n; i++)', '      printf("%d", n);', '    Test(n − 1);', '  }', '}'], costs: [[1, '1'], [2, 'n + 1'], [3, 'n'], [4, 'T(n−1)']], rr: 'T(n) = T(n−1) + 2n + 2', rr2: 'T(n) = T(n−1) + n', why2: '2n + 2 取漸近 → n', base: 'T(0) = 1' },
  logn: { code: ['void Test(int n) {', '  if (n > 0) {', '    for (i = 1; i < n; i = i * 2)', '      printf("%d", i);', '    Test(n − 1);', '  }', '}'], costs: [[3, 'log n'], [4, 'T(n−1)']], rr: 'T(n) = T(n−1) + log n', why1: 'i 每次 ×2 → printf 執行 log n 次', base: 'T(0) = 1' },
  twoT: { code: ['void Test(int n) {', '  if (n > 0) {', '    printf("%d", n);', '    Test(n − 1);', '    Test(n − 1);', '  }', '}'], costs: [[2, '1'], [3, 'T(n−1)'], [4, 'T(n−1)']], rr: 'T(n) = 2T(n−1) + 1', base: 'T(0) = 1' },
  half1: { code: ['void Test(int n) {', '  if (n > 1) {', '    printf("%d", n);', '    Test(n / 2);', '  }', '}'], costs: [[2, '1'], [3, 'T(n/2)']], rr: 'T(n) = T(n/2) + 1', base: 'T(1) = 1（除到最後是 1）' },
  twohalf: { code: ['void Test(int n) {', '  if (n > 1) {', '    for (i = 0; i < n; i++)', '      stmt;', '    Test(n / 2);', '    Test(n / 2);', '  }', '}'], costs: [[3, 'n'], [4, 'T(n/2)'], [5, 'T(n/2)']], rr: 'T(n) = 2T(n/2) + n', base: 'T(1) = 1（除到最後是 1）' },
  root: { code: ['void Test(int n) {', '  if (n > 2) {', '    stmt;', '    Test(√n);', '  }', '}'], costs: [[2, '1'], [3, 'T(√n)']], rr: 'T(n) = T(√n) + 1', base: 'T(2) = 1（開根號的最小值取 2）' },
};
async function ab2WriteRR(tok) {
  const B = AB2_B(tok, 1.15), E = AB2_RR[AB2_P().ex] || AB2_RR.n;
  fresh([0, 5, 14], [0, 3.2, 0]);
  const cd = code(E.code, -3.6, 6.8, 0.55);
  say('設 Test(n) 花 T(n) 時間', '逐行看每個敘述花多少');
  cd.hl(0); await B(2000);
  const cubes = [];
  for (const [ln, c] of E.costs) {
    cd.hl(ln); tag(c, 'ptr alt', 0.6, 6.8 - ln * 0.55);
    const isT = c.startsWith('T');
    cubes.push(cube(c, isT ? C.purple : C.green, [1.6, 0.6, 1], 2.0 + cubes.length * 1.7, 0.3, 0, 3));
    say(isT ? '遞迴呼叫：規模變小 → ' + c : (E.why1 && ln === E.costs[0][0] ? E.why1 : '這行執行 ' + c + ' 次'), '');
    await B(1700);
  }
  cd.hl(-1);
  const rr = tag(E.rr, 'ptr', 3.8, 2.6);
  say('全部加起來', E.rr);
  await B(2600);
  if (E.rr2) {
    txt(rr, E.rr2); cubes.filter((c) => !c.userData.lbl.element.textContent.startsWith('T')).forEach((c, k) => { if (k === 0) relabel(c, 'n'); else fly(c); });
    say(E.why2, E.rr2);
    await B(2800);
  }
  tag(E.base, 'ptr alt', 3.8, 1.8);
  say('邊界：不做事也記成常數 1', E.base);
  await B(2800);
  say('遞迴式：' + (E.rr2 || E.rr), '常數都可以寫成 1（或 c）');
  await B(2600);
}

// ───────── 17. 遞迴樹（tree method） ─────────
const AB2_RT = {
  n: { lv: [['T(n)', 'n', 1], ['T(n−1)', 'n−1', 0.86], ['T(n−2)', 'n−2', 0.72], ['…', '…', null], ['T(2)', '2', 0.2], ['T(1)', '1', 0.1], ['T(0)', '0', 0]],
    end: [['每層的時間加起來', '0 + 1 + 2 + … + n'], ['= n(n + 1)/2', '三角形面積 ≈ n²/2'], ['T(n) = Θ(n²)', '']] },
  logn: { lv: [['T(n)', 'log n', 1], ['T(n−1)', 'log(n−1)', 0.97], ['T(n−2)', 'log(n−2)', 0.94], ['…', '…', null], ['T(2)', 'log 2', 0.3], ['T(1)', 'log 1', 0.02], ['T(0)', '', 0]],
    end: [['加起來：log n + … + log 1', '= log(n·(n−1)·…·1) = log n!'], ['log n! ≤ log nⁿ = n log n', '上界'], ['T(n) = O(n log n)', '']] },
  half1: { lv: [['T(n)', '1', 0.22], ['T(n/2)', '1', 0.22], ['T(n/2²)', '1', 0.22], ['T(n/2³)', '1', 0.22], ['…', '…', null], ['T(n/2ᵏ)', '1', 0.22]],
    end: [['一直除到 1：n/2ᵏ = 1', 'n = 2ᵏ → k = log₂ n（像 2⁵ = 32 ⇔ 5 = log₂ 32）'], ['每層 1，共 k 層', 'T(n) = k = log n'], ['T(n) = Θ(log n)', '']] },
  halfn: { lv: [['T(n)', 'n', 1], ['T(n/2)', 'n/2', 0.5], ['T(n/2²)', 'n/2²', 0.25], ['T(n/2³)', 'n/2³', 0.125], ['…', '…', null], ['T(n/2ᵏ)', 'n/2ᵏ', 0.03]],
    end: [['加起來：n + n/2 + n/2² + …', '= n(1 + 1/2 + 1/2² + …)'], ['括號裡 < 2', '½ + ¼ + ⅛ + … 是一整個圓'], ['T(n) < 2n → O(n)', '']] },
};
async function ab2RTree(tok) {
  const B = AB2_B(tok), ex = AB2_P().ex || 'n';
  fresh([0, 5, 14.5], [0, 3.4, 0]);
  if (ex === 'twoT') {
    tag('T(n) = 2T(n−1) + 1', 'ptr', -1.4, 7.4);
    say('每次呼叫：印 1 次、再呼叫自己 2 次', '');
    await B(2000);
    let prev = [];
    for (let d = 0; d <= 3; d++) {
      const cnt = 1 << d, w = 8.8 / cnt, y = 6.3 - d * 1.5, cur = [];
      for (let i = 0; i < cnt; i++) {
        const x = -1.4 - 4.4 + w * (i + 0.5);
        const m = cube(d ? 'n−' + d : 'n', C.blue, [Math.min(1.0, w * 0.85), 0.5, 0.7], x, y, 0, 2);
        if (d) { const pp = prev[i >> 1]; line(pp.position.x, pp.position.y - 0.25, x, y + 0.25); }
        cur.push(m);
      }
      tag(cnt + ' = 2' + ['⁰', '¹', '²', '³'][d], 'ptr alt', 5.0, y);
      say('第 ' + d + ' 層：' + cnt + ' 次呼叫，每個 1', '');
      await B(1500);
      prev = cur;
    }
    tag('…　2ᵏ', 'ptr alt', 5.0, 0.4);
    say('一直到 T(0)：共 k 層', '1 + 2 + 2² + … + 2ᵏ');
    await B(2600);
    say('等比級數 = 2ᵏ⁺¹ − 1', 'n − k = 0 → k = n');
    await B(2600);
    say('T(n) = 2ⁿ⁺¹ − 1 = Θ(2ⁿ)', '');
    await B(3000);
    return;
  }
  const E = AB2_RT[ex] || AB2_RT.n;
  const y0 = 6.6, dy = Math.min(1.05, 6.0 / E.lv.length);
  say('遞迴樹：每個節點寫出這次呼叫做的事', '');
  await B(1800);
  let py = null;
  for (let d = 0; d < E.lv.length; d++) {
    const [nm, cost, w] = E.lv[d], y = y0 - d * dy;
    if (w === null) { tag('⋮', 'ptr', -4.6, y); tag('⋮', 'ptr', 0.6, y); py = null; await B(600); continue; }
    cube(nm, C.purple, [1.6, 0.5, 0.8], -4.6, y, 0, 2);
    if (py !== null) line(-4.6, py - 0.25, -4.6, y + 0.25);
    py = y;
    if (w > 0) { const m = lab.box(C.green, [1, 0.4, 0.8]); m.scale.x = Math.max(0.05, w * 6.4); m.position.set(-3.4 + w * 3.2, y, 0); lab.world.add(m); }
    if (cost) tag(cost, 'ptr alt', 5.4, y);
    say(nm + '：' + (cost ? '做 ' + cost : '不做事，停'), '');
    await B(1200);
  }
  for (const [a, b] of E.end) { say(a, b); await B(2700); }
  await B(800);
}

// ───────── 18. Back substitution（各種遞迴式） ─────────
const AB2_BS = {
  n: [['T(n) = T(n−1) + n', '要知道 T(n−1)', 'T(n−1) = T(n−2) + (n−1)', 'n'],
    ['T(n) = T(n−2) + (n−1) + n', '代回去；不要把項加起來', '保留規律才能看出公式', 'n−1'],
    ['T(n) = T(n−3) + (n−2) + (n−1) + n', '再代一次', '', 'n−2'],
    ['T(n) = T(n−k) + (n−k+1) + … + n', '代 k 次', '', '…'],
    ['n − k = 0：T(0) + 1 + 2 + … + n', '假設碰到 T(0)：k = n', '', null],
    ['T(n) = 1 + n(n+1)/2 = Θ(n²)', '和遞迴樹一樣（多 1 是 T(0)）', '', null]],
  logn: [['T(n) = T(n−1) + log n', '展開 T(n−1)', 'T(n−1) = T(n−2) + log(n−1)', 'log n'],
    ['T(n) = T(n−2) + log(n−1) + log n', '第二式', '', 'log(n−1)'],
    ['T(n) = T(n−3) + log(n−2) + log(n−1) + log n', '第三式', '', 'log(n−2)'],
    ['T(n) = T(n−k) + log 1 + log 2 + … + log n', '代 k 次，一路減到 1', '', '…'],
    ['n − k = 0：T(n) = T(0) + log n!', 'k = n', '', null],
    ['T(n) = 1 + log n! = O(n log n)', '和遞迴樹答案相同', '', null]],
  twoT: [['T(n) = 2T(n−1) + 1', '展開 T(n−1) = 2T(n−2) + 1', '', '1'],
    ['T(n) = 2²T(n−2) + 2 + 1', '2[2T(n−2) + 1] + 1', '', '2'],
    ['T(n) = 2³T(n−3) + 2² + 2 + 1', '再代一次', '', '2²'],
    ['T(n) = 2ᵏT(n−k) + 2ᵏ⁻¹ + … + 2 + 1', '代 k 次', '', '…'],
    ['k = n：T(n) = 2ⁿ·T(0) + 2ⁿ − 1', 'n − k = 0；等比級數 = 2ᵏ − 1', '', null],
    ['T(n) = 2ⁿ⁺¹ − 1 = Θ(2ⁿ)', '', '', null]],
  half1: [['T(n) = T(n/2) + 1', 'T(n/2) = T(n/2²) + 1', '', '1'],
    ['T(n) = T(n/2²) + 2', '常數可以直接相加', '', '1'],
    ['T(n) = T(n/2³) + 3', '再代一次', '', '1'],
    ['T(n) = T(n/2ᵏ) + k', '代 k 次', '', '…'],
    ['n/2ᵏ = 1 → n = 2ᵏ → k = log n', '假設除到 1', '', null],
    ['T(n) = T(1) + log n = 1 + log n', 'Θ(log n)', '', null]],
  halfn: [['T(n) = T(n/2) + n', 'T(n/2) = T(n/2²) + n/2', '', 'n'],
    ['T(n) = T(n/2²) + n/2 + n', '第二式', '', 'n/2'],
    ['T(n) = T(n/2³) + n/2² + n/2 + n', '第三式', '', 'n/2²'],
    ['T(n) = T(n/2ᵏ) + n/2ᵏ⁻¹ + … + n/2 + n', '代 k 次', '', '…'],
    ['n/2ᵏ = 1：T(1) + n(1/2ᵏ⁻¹ + … + 1/2 + 1)', '括號是 1 + ½ + ¼ + …', '', null],
    ['T(n) ≈ 1 + 2n = O(n)', '和樹法答案相同', '', null]],
  root: [['T(n) = T(n^(1/2)) + 1', '√n 寫成 n 的 1/2 次方', '', '1'],
    ['T(n) = T(n^(1/2²)) + 2', '再開一次根號', '', '1'],
    ['T(n) = T(n^(1/2³)) + 3', '第三式', '', '1'],
    ['T(n) = T(n^(1/2ᵏ)) + k', '代 k 次', '', '…']],
};
async function ab2BackSub(tok) {
  const B = AB2_B(tok), ex = AB2_P().ex || 'n', E = AB2_BS[ex] || AB2_BS.n;
  fresh([0, 5, 14.5], [0, 3.3, 0]);
  const eq = code(E.map(() => ''), -2.4, 7.0, 0.66);
  const terms = [];
  const tlab = tag('累積的項', 'idx', 5.4, 0, 1);
  say('Back substitution：一直代回去', E[0][0]);
  await B(1600);
  for (let i = 0; i < E.length; i++) {
    const [ln, cap, fm, add] = E[i];
    eq.set(i, ln); eq.hl(i);
    if (add) terms.push(cube(add, add === '…' ? GRAY : C.green, [1.7, 0.5, 1], 5.4, 0.3 + terms.length * 0.56, 0, 3));
    say(cap || ln, fm || ln);
    await B(i >= E.length - 2 ? 2800 : 2200);
  }
  eq.hl(E.length - 1);
  terms.forEach((m) => glow(m, GOLD));
  txt(tlab, E.length < 6 ? '接下來處理 n^(1/2ᵏ)' : '累積的項');
  await B(E.length < 6 ? 3600 : 2400);
}

// ───────── 19. a = 1 的遞減遞迴：乘上 n ─────────
async function ab2DecShortcut(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 14.5], [0, 3.3, 0]);
  const R = [['T(n−1) + 1', '1', 'O(n)'], ['T(n−1) + n', 'n', 'O(n²)'], ['T(n−1) + log n', 'log n', 'O(n log n)'], ['T(n−1) + n²', 'n²', 'O(n³)'], ['T(n−2) + 1', '1', 'n/2 = O(n)'], ['T(n−100) + n', 'n', 'O(n²)'], ['2T(n−1) + 1', '?', '有係數：下一部']];
  say('前幾題的答案放在一起看', 'T(n) = T(n−1) + f(n)');
  await B(2200);
  for (let i = 0; i < R.length; i++) {
    const y = 6.4 - i * 0.95, [r, f, a] = R[i];
    const m = cube(r, i === 6 ? C.red : C.blue, [3.4, 0.6, 1], -3.4, y, 0, 2);
    await B(500);
    tag(i === 6 ? '≠' : '× n', 'ptr', 0.4, y);
    const ans = cube(a, i === 6 ? GRAY : C.green, [2.8, 0.6, 1], 3.6, y, 0, 2);
    say(i === 6 ? '前面有係數 2，就不是單純乘 n' : i === 4 ? '每次減 2：n/2 次，仍是 O(n)' : i === 5 ? '減 100 也一樣：n 很大時' : f + ' × n → ' + a, i < 4 ? 'f(n) 重複 n 次' : '');
    await B(i >= 4 ? 2600 : 1700);
    if (i === 6) glow(m, RED); else glow(ans, null);
  }
  await B(2200);
}

// ───────── 20. 等比級數 1 + 2 + 4 + … + 2ᵏ ─────────
async function ab2GpSum(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 14], [0, 3, 0]);
  const cd = code(['a + ar + ar² + … + arᵏ = a(rᵏ⁺¹ − 1)/(r − 1)', 'a = 1、r = 2：2ᵏ⁺¹ − 1', 'k = n：2ⁿ⁺¹ − 1 = O(2ⁿ)'], -0.6, 7.0, 0.6);
  cd.ls.forEach((l) => showL(l, false));
  say('1 + 2 + 2² + … + 2ᵏ 是等比級數', '例：k = 3');
  await B(2000);
  const col = [-5, -3.6, -1.8, 0.6];
  let tot = 0;
  for (let k = 0; k <= 3; k++) {
    const c = 1 << k;
    for (let i = 0; i < c; i++) { cube('', C.blue, [0.5, 0.36, 0.5], col[k] + (i % 4) * 0.55 - (c > 4 ? 0.8 : Math.min(c, 4) * 0.27 - 0.27), 0.18 + Math.floor(i / 4) * 0.4, 0, 2); tot++; }
    tag('2' + ['⁰', '¹', '²', '³'][k] + ' = ' + c, 'ptr alt', col[k], 1.4);
    say('加上 ' + c + '：共 ' + tot, '');
    await B(1300);
  }
  const g = ghostBox('#c08a1f', 0.5, 0.36, 0.5); g.position.set(4.4, 0.18, 0);
  tag('+1 → 16 = 2⁴', 'ptr', 4.4, 1.0);
  say('再補 1 個就是 16 = 2⁴', '所以 1 + 2 + 4 + 8 = 2⁴ − 1 = 15');
  await B(2800);
  showL(cd.ls[0], true); cd.hl(0); say('公式：首項 a、公比 r', 'a(rᵏ⁺¹ − 1)/(r − 1)'); await B(2600);
  showL(cd.ls[1], true); cd.hl(1); say('a = 1、r = 2', '分母 r − 1 = 1 → 2ᵏ⁺¹ − 1'); await B(2600);
  showL(cd.ls[2], true); cd.hl(2); say('k = n 代入', 'T(n) = 2ⁿ⁺¹ − 1 = Θ(2ⁿ)'); await B(3000);
}

// ───────── 21. ½ + ¼ + ⅛ + … = 一個圓 ─────────
async function ab2HalfSeries(tok) {
  const B = AB2_B(tok);
  fresh([0, 4.5, 13], [0, 3.2, 0]);
  const cx = -2.4, cy = 3.4, r = 2.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.06, 64), new THREE.MeshBasicMaterial({ color: '#6e5f49' })); ring.position.set(cx, cy, 0); lab.world.add(ring);
  const sum = tag('', 'ptr alt', 3.8, 5.4);
  say('T(n) = n(1 + ½ + ¼ + …)：括號是多少？', '用一個圓來看');
  await B(2200);
  const cols = [C.blue, C.green, C.purple, C.orange, C.teal, C.pink, C.gold];
  let start = 0, s = 0, str = '';
  const NM = ['½', '¼', '⅛', '1/16', '1/32', '1/64', '1/128'];
  for (let i = 0; i < 7; i++) {
    const frac = 1 / (2 << i);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 48, start * Math.PI * 2, frac * Math.PI * 2), new THREE.MeshStandardMaterial({ color: cols[i], side: THREE.DoubleSide }));
    m.position.set(cx, cy, 0.02); lab.world.add(m);
    start += frac; s += frac; str += (i ? ' + ' : '') + NM[i];
    if (i < 4) { txt(sum, str); say('加上 ' + NM[i], '已填滿 ' + Math.round(s * 1000) / 10 + '%'); await B(1500); } else await B(400);
  }
  txt(sum, '½ + ¼ + ⅛ + … = 1');
  say('一直加下去剛好是一個圓', '½ + ¼ + ⅛ + … → 1');
  await B(2800);
  tag('再加第一項 1 → 2', 'ptr', 3.8, 4.4);
  say('級數從 1 開始：1 + (½ + ¼ + …) → 2', '老師說「約等於 1」是省略了首項');
  await B(3200);
  say('T(n) ≤ 2n → O(n)', '常數不影響漸近');
  await B(2800);
}

// ───────── 22. Master Theorem 的遞迴樹：2T(n/2) + n² ─────────
async function ab2MtTree(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 15], [0, 3.4, 0]);
  tag('T(n) = aT(n/b) + f(n)，a ≥ 1、b > 1', 'ptr', 0, 7.6);
  say('a = 2、b = 2、f(n) = n²', 'f(n) 要漸近為正（n 夠大時 > 0）');
  await B(2400);
  const NM = ['n²', '(n/2)²', '(n/4)²', '1'];
  const SUM = ['n²', 'n²/2', 'n²/4', 'n^(log_b a)'];
  let prev = [];
  for (let d = 0; d <= 3; d++) {
    const cnt = 1 << d, w = 9 / cnt, y = 6.3 - d * 1.6, cur = [];
    for (let i = 0; i < cnt; i++) {
      const x = -1.6 - 4.5 + w * (i + 0.5);
      const m = cube(NM[d], d === 3 ? C.purple : C.blue, [Math.min(1.6, w * 0.85), 0.5, 0.8], x, y, 0, 2);
      if (d) { const pp = prev[i >> 1]; line(pp.position.x, pp.position.y - 0.25, x, y + 0.25); }
      cur.push(m);
    }
    tag('這層 ' + SUM[d], 'ptr alt', 5.2, y);
    say(d === 0 ? '根：遞迴之外的工作 f(n) = n²' : d === 1 ? 'a = 2：分成 2 個子問題；b = 2：規模減半' : d === 2 ? '每層再分、再減半' : '最底層：n/bᵏ = 1', '');
    await B(1900);
    prev = cur;
  }
  tag('深度 k = log_b n', 'ptr', -6.2, 3.2);
  say('n/bᵏ = 1 → 深度 k = log_b n', '');
  await B(2600);
  say('葉子數 = aᵏ = a^(log_b n)', '= n^(log_b a)（log 公式 4）');
  await B(2800);
  say('n^(log_b a)：遞迴部分的量', '拿它跟 f(n) 比 → 三種情況');
  await B(3000);
}

// ───────── 23. 三種情況：遞迴部分 vs f(n) ─────────
async function ab2MtCases(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 14], [0, 3, 0]);
  const L = bar(C.blue, 1.6, 1.2, -2, 0), Rb = bar(C.red, 1.6, 1.2, 2, 0);
  tag('n^(log_b a)', 'ptr', -2, -0.4, 0.8); tag('f(n)', 'ptr', 2, -0.4, 0.8);
  const head = tag('', 'ptr alt', 0, 6.6), ans = tag('', 'ptr', 0, 5.9);
  const CS = [
    ['case 1：遞迴部分大很多', 5, 2, 'f(n) 比 n^(log_b a) 小多項式倍', 'Θ(n^(log_b a))'],
    ['case 2：兩邊同階', 3.5, 3.6, 'f(n) 多 logᵏ n 也算 case 2', 'Θ(n^(log_b a) · logᵏ⁺¹ n)'],
    ['case 3：f(n) 大很多', 2, 5, '還要檢查 regularity：a·f(n/b) ≤ c·f(n)，c < 1', 'Θ(f(n))'],
  ];
  say('比較遞迴部分與非遞迴部分', '誰主導，答案就是誰');
  await B(2200);
  for (const [h, a, b, why, an] of CS) {
    txt(head, h); txt(ans, '');
    await Promise.all([growBar(tok, L, a, 700), growBar(tok, Rb, b, 700)]);
    say(h, why); await B(2600);
    txt(ans, an); say('答案 ' + an, why); await B(2600);
  }
  say('先算 n^(log_b a)，再跟 f(n) 比', '');
  await B(2400);
}

// ───────── 24. Master Theorem 例題分類 ─────────
const AB2_MS = {
  sl: [['T(n/2) + 1', 1, 2, 0, 0, 'Θ(log n)'], ['2T(n/2) + n', 2, 2, 1, 0, 'Θ(n log n)'], ['2T(n/2) + n log n', 2, 2, 1, 1, 'Θ(n log² n)'], ['2T(n/4) + n^0.51', 2, 4, 0.51, 0, 'Θ(n^0.51)']],
  c1: [['2T(n/2) + 1', 2, 2, 0, 0, 'Θ(n)'], ['4T(n/2) + n', 4, 2, 1, 0, 'Θ(n²)'], ['8T(n/2) + n', 8, 2, 1, 0, 'Θ(n³)'], ['8T(n/2) + n²', 8, 2, 2, 0, 'Θ(n³)'], ['9T(n/3) + 1', 9, 3, 0, 0, 'Θ(n²)'], ['9T(n/3) + n', 9, 3, 1, 0, 'Θ(n²)'], ['9T(n/3) + n²', 9, 3, 2, 0, 'Θ(n² log n)'], ['8T(n/2) + n log n', 8, 2, 1, 1, 'Θ(n³)']],
  c2: [['2T(n/2) + n', 2, 2, 1, 0, 'Θ(n log n)'], ['4T(n/2) + n²', 4, 2, 2, 0, 'Θ(n² log n)'], ['4T(n/2) + n² log n', 4, 2, 2, 1, 'Θ(n² log² n)'], ['4T(n/2) + n² log² n', 4, 2, 2, 2, 'Θ(n² log³ n)'], ['8T(n/2) + n³', 8, 2, 3, 0, 'Θ(n³ log n)']],
  c2p: [['2T(n/2) + n/log n', 2, 2, 1, -1, 'Θ(n log log n)'], ['2T(n/2) + n/log² n', 2, 2, 1, -2, 'Θ(n)']],
  c3: [['T(n/2) + n²', 1, 2, 2, 0, 'Θ(n²)'], ['2T(n/2) + n²', 2, 2, 2, 0, 'Θ(n²)'], ['2T(n/2) + n² log n', 2, 2, 2, 1, 'Θ(n² log n)'], ['2T(n/2) + n² log² n', 2, 2, 2, 2, 'Θ(n² log² n)'], ['4T(n/2) + n³', 4, 2, 3, 0, 'Θ(n³)'], ['4T(n/2) + n³/log n', 4, 2, 3, -1, 'O(n³)']],
  k1: [['2T(n/2) + 1', 2, 2, 0, 0, 'Θ(n)'], ['4T(n/2) + 1', 4, 2, 0, 0, 'Θ(n²)'], ['4T(n/2) + n', 4, 2, 1, 0, 'Θ(n²)'], ['8T(n/2) + n²', 8, 2, 2, 0, 'Θ(n³)'], ['16T(n/2) + n²', 16, 2, 2, 0, 'Θ(n⁴)']],
  k3: [['T(n/2) + n', 1, 2, 1, 0, 'Θ(n)'], ['2T(n/2) + n²', 2, 2, 2, 0, 'Θ(n²)'], ['2T(n/2) + n² log n', 2, 2, 2, 1, 'Θ(n² log n)'], ['4T(n/2) + n³ log² n', 4, 2, 3, 2, 'Θ(n³ log² n)'], ['2T(n/2) + n²/log n', 2, 2, 2, -1, 'O(n²)']],
  k2: [['T(n/2) + 1', 1, 2, 0, 0, 'Θ(log n)'], ['2T(n/2) + n', 2, 2, 1, 0, 'Θ(n log n)'], ['2T(n/2) + n log n', 2, 2, 1, 1, 'Θ(n log² n)'], ['4T(n/2) + n²', 4, 2, 2, 0, 'Θ(n² log n)'], ['4T(n/2) + (n log n)²', 4, 2, 2, 2, 'Θ(n² log³ n)'], ['2T(n/2) + n/log n', 2, 2, 1, -1, 'Θ(n log log n)'], ['2T(n/2) + n/log² n', 2, 2, 1, -2, 'Θ(n)']],
};
async function ab2MtSort(tok) {
  const B = AB2_B(tok, (ctx.params || {}).set === 'c2p' ? 1.4 : (ctx.params || {}).set === 'c1' || (ctx.params || {}).set === 'k2' ? 0.85 : 1), set = AB2_P().set || 'c1', E = AB2_MS[set] || AB2_MS.c1;
  fresh([0, 5.5, 15], [0, 3, 0]);
  const BX = [-4.5, 0, 4.5], BN = ['case 1：log_b a > k', 'case 2：log_b a = k', 'case 3：log_b a < k'], BC = [C.green, C.blue, C.red];
  BX.forEach((x, i) => { ctx.tile(V3(x, 0.04, 0), 4.2, 2.4, '#efe6d2'); tag(BN[i], 'ptr', x, 0.2, 1.6); });
  tag('T(n) = aT(n/b) + Θ(nᵏ logᵖ n)', 'ptr alt', 0, 7.4);
  say('比 log_b a 與 k（n 的次方）', '');
  await B(2000);
  const stacks = [[], [], []];
  for (const [r, a, b, k, p, ans] of E) {
    const lba = Math.log(a) / Math.log(b), ci = Math.abs(lba - k) < 1e-9 ? 1 : lba > k ? 0 : 2;
    const m = cube('T(n) = ' + r, GRAY, [3.9, 0.6, 1], 0, 5.6, 0, 2);
    const lbs = (Math.round(lba * 100) / 100).toString();
    say('T(n) = ' + r, 'log_' + b + ' ' + a + ' = ' + lbs + '，k = ' + k + (p ? '，p = ' + p : ''));
    await B(2000);
    if (stacks[ci].length >= 5) fly(stacks[ci].shift());
    stacks[ci].forEach((o, j) => move(o, BX[ci], 0.4 + j * 0.7, 0));
    tint(m, BC[ci]); relabel(m, r + ' → ' + ans);
    move(m, BX[ci], 0.4 + stacks[ci].length * 0.7, 0); stacks[ci].push(m);
    const why = ci === 0 ? '取 n^(log_b a)' : ci === 1 ? (p > -1 ? 'f(n) 再乘一個 log n' : p === -1 ? 'p = −1 → log log n' : 'p < −1 → 只留 nᵏ') : (p >= 0 ? '直接取 f(n)' : 'p < 0 → O(nᵏ)');
    say(ans, why);
    await B(1800);
  }
  await B(2400);
}

// ───────── 25. Bari 版 Master Theorem 條件表 ─────────
async function ab2MtRules(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 14.5], [0, 3.2, 0]);
  const L = ['T(n) = aT(n/b) + f(n)，a ≥ 1、b > 1', 'f(n) = Θ(nᵏ logᵖ n)', 'case 1：log_b a > k → Θ(n^(log_b a))', 'case 2：log_b a = k', '  p > −1 → Θ(nᵏ logᵖ⁺¹ n)', '  p = −1 → Θ(nᵏ log log n)', '  p < −1 → Θ(nᵏ)', 'case 3：log_b a < k', '  p ≥ 0 → Θ(nᵏ logᵖ n)', '  p < 0 → O(nᵏ)'];
  const cd = code(L, -2.6, 7.4, 0.52);
  const X = (v) => 2.2 + v * 1.4;
  line(X(0), 0.3, X(3), 0.3, 0, '#6e5f49');
  [0, 1, 2, 3].forEach((v) => tag(String(v), 'idx', X(v), 0, 0.8));
  const ma = cube('log_b a', C.blue, [1.3, 0.5, 0.7], X(2), 0.9, 0), mk = cube('k', C.red, [0.7, 0.5, 0.7], X(1), 1.6, 0);
  cd.hl(0); say('一般式：a ≥ 1、b > 1', ''); await B(2200);
  cd.hl(1); say('f(n) 寫成 nᵏ logᵖ n', '先算兩個數：log_b a 與 k'); await B(2400);
  cd.hl(2); say('log_b a 較大 → 取 n^(log_b a)', ''); await B(2600);
  move(mk, X(2), 1.6, 0); cd.hl(3); say('相等 → 再看 p', ''); await B(2000);
  for (const i of [4, 5, 6]) { cd.hl(i); say(['p > −1：多乘一個 log n', 'p = −1：變成 log log n', 'p < −1：log 丟掉'][i - 4], L[i].trim()); await B(1900); }
  move(mk, X(3), 1.6, 0); cd.hl(7); say('k 較大 → 看 f(n) 本身', ''); await B(2000);
  for (const i of [8, 9]) { cd.hl(i); say(i === 8 ? 'p ≥ 0：f(n) 原樣' : 'p < 0：只寫 O(nᵏ)', L[i].trim()); await B(1900); }
  cd.hl(-1); say('先比 log_b a 與 k，再看 p', ''); await B(2400);
}

// ───────── 26. 根號遞迴：設 n = 2ᵐ ─────────
async function ab2Root2m(tok) {
  const B = AB2_B(tok);
  fresh([0, 5, 14], [0, 3.2, 0]);
  const eq = code(['T(n) = T(n^(1/2ᵏ)) + k', '', '', '', '', ''], -2.2, 7.0, 0.66);
  const W = 9.6, b = lab.box(C.blue, [1, 0.6, 1]); b.scale.x = W; b.position.set(-6 + W / 2, 0.3, 0); lab.world.add(b);
  const bl = tag('m', 'ptr alt', -6 + W / 2, 1.0);
  const kk = tag('k = 0', 'ptr', 5.4, 2.4);
  say('最小值是 2：假設 n 是 2 的次方', '設 n = 2ᵐ');
  eq.set(1, '設 n = 2ᵐ'); eq.hl(1); await B(2400);
  eq.set(2, 'T(2ᵐ) = T(2^(m/2ᵏ)) + k'); eq.hl(2); say('每開一次根號，指數 m 減半', '√(2ᵐ) = 2^(m/2)'); await B(2400);
  const NM = ['m/2', 'm/4', 'm/8', '1'];
  for (let k = 1; k <= 4; k++) {
    const w = k < 4 ? W / Math.pow(2, k) : W / 12;
    await anim(tok, 500, (t) => { const cw = b.scale.x + (w - b.scale.x) * t; b.scale.x = cw; b.position.x = -6 + cw / 2; });
    txt(bl, NM[k - 1]); bl.position.x = -6 + w / 2; txt(kk, 'k = ' + (k < 4 ? k : 'k'));
    say(k < 4 ? '指數 ' + NM[k - 1] : '指數變成 1：到 T(2) 了', ''); await B(900);
  }
  eq.set(3, '到 T(2)：m/2ᵏ = 1 → m = 2ᵏ'); eq.hl(3); say('T(2^(m/2ᵏ)) = T(2¹)', 'm/2ᵏ = 1'); await B(2400);
  eq.set(4, 'k = log m，而 m = log n'); eq.hl(4); say('k = log m', 'n = 2ᵐ → m = log n'); await B(2400);
  eq.set(5, 'T(n) = 1 + log log n = Θ(log log n)'); eq.hl(5); say('k = log log n → Θ(log log n)', ''); await B(2600);
  say('補充：Master Theorem 不能直接套 T(√n)', '要先換變數 S(m) = S(m/2) + 1，再套');
  await B(3200);
}

// ───────── 27. Tower of Hanoi ─────────
function ab2Towers(x0, sc, n) {
  const px = [x0 - 4 * sc, x0, x0 + 4 * sc], dh = 0.42 * sc;
  cube('', '#a99470', [11 * sc, 0.2, 1.6], x0, 0.1, 0);
  px.forEach((x, i) => { cube('', '#8a7350', [0.14, 3.2 * sc, 0.14], x, 0.2 + 1.6 * sc, 0); tag(['A', 'B', 'C'][i] + '（' + (i + 1) + '）', 'idx', x, -0.3, 1); });
  const cols = [C.green, C.blue, C.purple, C.orange];
  const disks = []; for (let k = 1; k <= n; k++) disks[k] = cube(k, cols[k - 1], [(0.9 + 0.75 * k) * sc, dh * 0.95, 1.1], 0, 0, 0);
  const st = [[], [], []];
  const pos = (t, h) => [px[t], 0.2 + (h + 0.5) * dh];
  for (let k = n; k >= 1; k--) { const [x, y] = pos(0, st[0].length); disks[k].position.set(x, y, 0); st[0].push(k); }
  const top = 0.4 + 3.4 * sc;
  const T = {
    st,
    async move(tok, a, b) { const k = st[a].pop(); const d = disks[k]; move(d, px[a], top, 0); await beat(tok, 320); move(d, px[b], top, 0); await beat(tok, 380); const [x, y] = pos(b, st[b].length); move(d, x, y, 0); st[b].push(k); await beat(tok, 380); return k; },
    async group(tok, cnt, a, b) {
      const ks = st[a].splice(st[a].length - cnt, cnt); const lift = top - pos(a, st[a].length)[1];
      ks.forEach((k, i) => move(disks[k], px[a], pos(a, st[a].length + i)[1] + lift, 0)); await beat(tok, 380);
      ks.forEach((k, i) => move(disks[k], px[b], pos(a, st[a].length + i)[1] + lift, 0)); await beat(tok, 420);
      ks.forEach((k, i) => { const [x, y] = pos(b, st[b].length + i); move(disks[k], x, y, 0); }); st[b].push(...ks); await beat(tok, 420);
    },
  };
  return T;
}
async function ab2Hanoi(tok) {
  const B = AB2_B(tok), p = AB2_P(), n = p.n || 3;
  const NM = ['A', 'B', 'C'];
  if (n === 1 || n === 2) {
    fresh([0, 4.5, 13], [0, 1.8, 0]);
    let T = ab2Towers(0, 1, 1);
    say('規則：一次搬一個，大的不能壓在小的上', '把 A 上的盤子全部搬到 C，B 是輔助');
    await B(2600);
    await T.move(tok, 0, 2); say('只有 1 個盤子：A → C 一步', ''); await B(2400);
    fresh([0, 4.5, 13], [0, 1.8, 0]);
    T = ab2Towers(0, 1, 2);
    say('2 個盤子', ''); await B(1500);
    const S = [[0, 1, 'A → B using C'], [0, 2, 'A → C'], [1, 2, 'B → C using A']];
    for (const [a, b, cap] of S) { await T.move(tok, a, b); say('Move disk ' + cap, a === 0 && b === 2 ? '直接放到目的地' : '經過輔助柱'); await B(1800); }
    say('2 個盤子只要 3 步', '小問題：很簡單');
    await B(2600);
    return;
  }
  fresh([0, 4.5, 13], [0, 1.8, 0]);
  const T = ab2Towers(0, 1, 3);
  if (p.macro) {
    say('3 個盤子：把上面 2 個當成一組', '「搬 2 個」用剛才的 3 步');
    await B(2600);
    await T.group(tok, 2, 0, 1); say('① Move 2 disks A → B using C', '遞迴：怎麼搬 2 個已經會了'); await B(2400);
    await T.move(tok, 0, 2); say('② Move 1 disk A → C', '最大的直接到目的地'); await B(2200);
    await T.group(tok, 2, 1, 2); say('③ Move 2 disks B → C using A', '再一次遞迴'); await B(2400);
    say('n 個盤子：n−1 個 A→B、1 個 A→C、n−1 個 B→C', '這三步就是遞迴演算法');
    await B(3200);
    return;
  }
  const MV = [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]];
  const lst = tag('', 'ptr alt', 0, 5.6);
  let s = '';
  say('照 TOH(3, 1, 2, 3) 印出的 7 步搬', '');
  await B(2000);
  for (let i = 0; i < MV.length; i++) {
    const [a, b] = MV[i];
    await T.move(tok, a, b);
    s += (i ? '  ' : '') + (a + 1) + '→' + (b + 1); txt(lst, s);
    say('第 ' + (i + 1) + ' 步：' + NM[a] + '(' + (a + 1) + ') → ' + NM[b] + '(' + (b + 1) + ')', '');
    await B(700);
  }
  say('3 個盤子全部到 C', '補充：n 個盤子要 2ⁿ − 1 步');
  await B(3200);
}
async function ab2HanoiTrace(tok) {
  const B = AB2_B(tok), part = AB2_P().part;
  if (part === 'code') {
    fresh([0, 4.8, 14], [0, 2.8, 0]);
    const cd = code(['TOH(n, A, B, C) {', '  if (n > 0) {', '    TOH(n−1, A, C, B);', '    printf("Move %c → %c", A, C);', '    TOH(n−1, B, A, C);', '  }', '}'], -3.6, 6.9, 0.55);
    const T = ab2Towers(3.2, 0.55, 3);
    say('三個步驟寫成遞迴演算法', 'A = 來源、B = 中繼（using）、C = 目的');
    cd.hl(0); await B(2400);
    cd.hl(1); say('n > 0 才做；0 個盤子什麼都不做', ''); await B(1800);
    cd.hl(2); await T.group(tok, 2, 0, 1); say('n−1 個：A → B，C 當中繼', 'TOH(n−1, A, C, B)'); await B(2200);
    cd.hl(3); await T.move(tok, 0, 2); say('最大的：A → C', 'printf'); await B(2000);
    cd.hl(4); await T.group(tok, 2, 1, 2); say('n−1 個：B → C，A 當中繼', 'TOH(n−1, B, A, C)'); await B(2200);
    cd.hl(-1); say('中間那個參數永遠是 using 的柱子', '');
    await B(2800);
    return;
  }
  fresh([0, 4.8, 14.5], [0, 3.6, 0]);
  const NODE = (l, x, y, par) => { const m = cube(l, C.blue, [1.7, 0.5, 0.6], x, y, 0, 2); if (par) line(par.position.x, par.position.y - 0.25, x, y + 0.25); return m; };
  const PR = [], row = [];
  const PRT = async (l, x, y, par) => { const m = cube(l, C.gold, [0.9, 0.45, 0.6], x, y, 0, 2); line(par.position.x, par.position.y - 0.25, x, y + 0.22); PR.push(m); say('印出 ' + l, '收集到第 ' + PR.length + ' 步'); await B(900); };
  say('追蹤 TOH(3, 1, 2, 3)', '每個呼叫展開成：左呼叫、印、右呼叫');
  const r = NODE('TOH(3,1,2,3)', 0, 6.8, null); await B(1600);
  const L1 = NODE('TOH(2,1,3,2)', -3.4, 5.2, r); say('TOH(n−1, A, C, B) = TOH(2,1,3,2)', ''); await B(1300);
  const a = NODE('TOH(1,1,2,3)', -5.2, 3.6, L1); await B(600); await PRT('1→3', -5.2, 2.2, a);
  await PRT('1→2', -3.4, 3.6, L1);
  const b = NODE('TOH(1,3,1,2)', -1.6, 3.6, L1); await B(600); await PRT('3→2', -1.6, 2.2, b);
  await PRT('1→3', 0, 5.2, r);
  const R1 = NODE('TOH(2,2,1,3)', 3.4, 5.2, r); say('TOH(n−1, B, A, C) = TOH(2,2,1,3)', ''); await B(1300);
  const c = NODE('TOH(1,2,3,1)', 1.6, 3.6, R1); await B(600); await PRT('2→1', 1.6, 2.2, c);
  await PRT('2→3', 3.4, 3.6, R1);
  const d = NODE('TOH(1,1,2,3)', 5.2, 3.6, R1); await B(600); await PRT('1→3', 5.2, 2.2, d);
  say('TOH(0, …) 什麼都不做 → 停', '');
  await B(1400);
  PR.forEach((m, i) => move(m, -5.4 + i * 1.8, 0.4, 1.2));
  say('依序收集：7 個 printf', '1→3, 1→2, 3→2, 1→3, 2→1, 2→3, 1→3');
  await B(3400);
}

FRAG.push(['algbari2-bound-plot', '上下界夾擠：c₁·g(n) ≤ f(n) ≤ c₂·g(n)', ab2BoundPlot]);
FRAG.push(['algbari2-ladder', '類別階梯：上界、下界、tight bound', ab2Ladder]);
FRAG.push(['algbari2-factorial', 'n! 與 log n! 的上下界', ab2Factorial]);
FRAG.push(['algbari2-phone-price', '估手機價格：最接近的界才有用', ab2Phone]);
FRAG.push(['algbari2-props', '漸近符號的性質', ab2Props]);
FRAG.push(['algbari2-sample', '代值比較 n² 與 n³', ab2Sample]);
FRAG.push(['algbari2-log-rules', '比較函數用的 log 公式', ab2LogRules]);
FRAG.push(['algbari2-log-compare', '取 log 比較兩個函數（天平）', ab2LogCompare]);
FRAG.push(['algbari2-piecewise', '分段函數：只看夠大的 n', ab2Piecewise]);
FRAG.push(['algbari2-true-false', '漸近符號是非題', ab2TrueFalse]);
FRAG.push(['algbari2-linear-search', 'Linear search：成功、失敗、best、worst', ab2LinearSearch]);
FRAG.push(['algbari2-ls-average', 'Linear search 平均情況 (n + 1)/2', ab2LsAverage]);
FRAG.push(['algbari2-case-notation', 'Case 與 O/Ω/Θ 無關', ab2CaseNotation]);
FRAG.push(['algbari2-bst-cases', 'BST 的 best / worst case 與樹高', ab2BstCases]);
FRAG.push(['algbari2-binsearch-count', 'Binary search：3 log n + 2', ab2BinSearch]);
FRAG.push(['algbari2-freq-sum', 'Frequency count：陣列求和 2n + 3（逐句）', ab2FreqSum]);
FRAG.push(['algbari2-freq-matrix', '矩陣相加 2n² + 2n + 1、相乘 2n³ + …（逐句）', ab2FreqMatrix]);
FRAG.push(['algbari2-write-rr-2t', '遞迴函數 T(n) = 2T(n−1) + 1（逐句）', ab2WriteRR2T]);
FRAG.push(['algbari2-write-rr', '從程式寫出遞迴式', ab2WriteRR]);
FRAG.push(['algbari2-rtree', '遞迴樹：逐層加總', ab2RTree]);
FRAG.push(['algbari2-backsub', 'Back substitution：代 k 次', ab2BackSub]);
FRAG.push(['algbari2-dec-shortcut', 'T(n−1) + f(n)：答案是 n·f(n)', ab2DecShortcut]);
FRAG.push(['algbari2-gp-sum', '等比級數 1 + 2 + … + 2ᵏ = 2ᵏ⁺¹ − 1', ab2GpSum]);
FRAG.push(['algbari2-half-series', '½ + ¼ + ⅛ + … = 一個圓', ab2HalfSeries]);
FRAG.push(['algbari2-mt-tree', 'Master Theorem：深度 log_b n、葉子 n^(log_b a)', ab2MtTree]);
FRAG.push(['algbari2-mt-cases', 'Master Theorem 三種情況：誰主導', ab2MtCases]);
FRAG.push(['algbari2-mt-sort', 'Master Theorem 例題分類', ab2MtSort]);
FRAG.push(['algbari2-mt-rules', 'Master Theorem（log_b a vs k、p）條件表', ab2MtRules]);
FRAG.push(['algbari2-root-2m', 'T(√n) + 1：設 n = 2ᵐ → log log n', ab2Root2m]);
FRAG.push(['algbari2-hanoi', 'Tower of Hanoi：1、2、3 個盤子', ab2Hanoi]);
FRAG.push(['algbari2-hanoi-trace', 'TOH 演算法與 TOH(3,1,2,3) 追蹤', ab2HanoiTrace]);
  }

  // ═══ algjiang1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, GOLD, GREEN, RED, GRAY } = K;
// ─── 7a28lIQIHJQ / kxIQ86qMtfk（交大江蕙如 Lec01–02）、FbYzBWdhMb0 / xGYsEqe9Vl0 / 0IAPZzGSbME（Abdul Bari 1 / 1.2 / 1.3） ───
const J = { blue: '#4b9ee2', pink: '#e55a9b', green: '#2fc092', orange: '#dd8238', purple: '#9b7ef4', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', brown: '#6e5f49', eng: '#2a6fd6' };
const jCard = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6) => cube(t, c, [w, h, 1], x, y, z, drop);
function jLine3(x1, y1, z1, x2, y2, z2, color = '#a99470') {
  const T = ctx.THREE; const l = new T.Line(new T.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new T.LineBasicMaterial({ color }));
  lab.world.add(l); return l;
}
// 一列 card：xs 等距排開
async function jRow(tok, items, y, col, w, gap, z = 0, ms = 350) {
  const n = items.length, x0 = -(n - 1) * gap / 2, out = [];
  for (let i = 0; i < n; i++) { out.push(jCard(items[i], col, x0 + i * gap, y, z, w, 2.5)); await beat(tok, ms); }
  return out;
}

// ── stable matching 共用版面：男生在左、女生在右；偏好表「左 → 右 = 最喜歡 → 最不喜歡」 ──
function jBoard(Mp, Fp, o = {}) {
  const men = Object.keys(Mp), wom = Object.keys(Fp), n = men.length;
  const dy = o.dy || (n > 3 ? 1.0 : 1.2), y0 = o.y0 || (n > 3 ? 5.4 : 4.8), xm = o.xm || -1.6, xw = o.xw || 1.6, s = 0.5, gap = 0.62;
  const B = { men, wom, n, M: {}, W: {}, ML: {}, WL: {}, links: {}, y: {} };
  men.forEach((m, i) => {
    const y = y0 - i * dy; B.y[m] = y;
    B.M[m] = cube(m, J.blue, [0.8, 0.7, 0.8], xm, y, 0); B.ML[m] = {};
    Mp[m].split('').forEach((w, k) => { B.ML[m][w] = cube(w, J.paper, [s, s, s], xm - 1.2 - (n - 1 - k) * gap, y, 0); });
  });
  wom.forEach((w, i) => {
    const y = y0 - i * dy; B.y[w] = y;
    B.W[w] = cube(w, J.pink, [0.8, 0.7, 0.8], xw, y, 0); B.WL[w] = {};
    Fp[w].split('').forEach((m, k) => { B.WL[w][m] = cube(m, J.paper, [s, s, s], xw + 1.2 + k * gap, y, 0); });
  });
  if (!o.noHead) {
    tag('男生偏好：左 = 最愛', 'idx', xm - 1.2 - (n - 1) * gap / 2, y0 + 0.75);
    tag('女生偏好：左 = 最愛', 'idx', xw + 1.2 + (n - 1) * gap / 2, y0 + 0.75);
  }
  B.link = (m, w, col) => { B.unlink(m); const a = B.M[m].position, b = B.W[w].position; B.links[m] = { w, l: line(a.x + 0.42, a.y, b.x - 0.42, b.y, 0.05, col || J.eng) }; return B.links[m]; };
  B.unlink = (m) => { if (B.links[m]) { kill(B.links[m].l); delete B.links[m]; } };
  B.partner = (w) => { for (const m in B.links) if (B.links[m].w === w) return m; return null; };
  B.off = () => { for (const m of men) { glow(B.M[m], null); for (const k in B.ML[m]) glow(B.ML[m][k], null); } for (const w of wom) { glow(B.W[w], null); for (const k in B.WL[w]) glow(B.WL[w][k], null); } };
  return B;
}
// Kevin Wayne / Kleinberg–Tardos 的投影片例子（老師的 3×3 與 5×5 demo）
const SM3M = { X: 'ABC', Y: 'BAC', Z: 'ABC' }, SM3F = { A: 'YXZ', B: 'XYZ', C: 'XYZ' };
const SM5M = { V: 'BADEC', W: 'DBACE', X: 'BECDA', Y: 'ADCBE', Z: 'BDAEC' };
const SM5F = { A: 'ZVWYX', B: 'XWYVZ', C: 'WXYZV', D: 'VZYXW', E: 'YWZXV' };
// Gale–Shapley（每次挑編號最小的 free man）；回傳每一步 [m, w, 'accept'|'dump'|'reject', 對手]
function jGS(Mp, Fp) {
  const men = Object.keys(Mp), n = men.length, nx = {}, fi = {}, hm = {}, st = [];
  men.forEach((m) => { nx[m] = 0; });
  for (;;) {
    const m = men.find((q) => !hm[q] && nx[q] < n); if (!m) break;
    const w = Mp[m][nx[m]++];
    if (!fi[w]) { fi[w] = m; hm[m] = w; st.push([m, w, 'accept', null]); }
    else if (Fp[w].indexOf(m) < Fp[w].indexOf(fi[w])) { const o = fi[w]; delete hm[o]; fi[w] = m; hm[m] = w; st.push([m, w, 'dump', o]); }
    else st.push([m, w, 'reject', fi[w]]);
  }
  return { st, hm };
}

// ════════ FbYzBWdhMb0（Abdul Bari 1.2：Characteristics of Algorithm） ════════
// 00:11 Input ≥ 0、Output ≥ 1：像 C 的函數
FRAG.push(['algjiang1-io-func', 'Input ≥ 0、Output ≥ 1：像 C 函數', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const xs = [-4.2, 0, 4.2], ins = [[], ['a'], ['a', 'b', 'c']];
  const fs = xs.map((x, i) => cube('Algo ' + (i + 1), J.purple, [2.2, 1.2, 1.4], x, 0.6, 0));
  say('演算法可以有 0 個或多個 input', 'input ≥ 0');
  await beat(tok, 1800);
  for (let i = 0; i < 3; i++) {
    tag(ins[i].length + ' 個 input', 'idx', xs[i], 2.1, 0);
    for (let k = 0; k < ins[i].length; k++) {
      const c = cube(ins[i][k], J.teal, [0.6, 0.5, 0.6], xs[i] - 0.7 + k * 0.7, 3.4, 0, 2);
      await beat(tok, 450); move(c, xs[i], 1.0, 0); await beat(tok, 350); kill(c);
    }
    await beat(tok, 400);
  }
  say('output 至少要有 1 個', 'output ≥ 1，否則寫它沒意義');
  for (const x of xs) { const o = cube('result', J.green, [1.3, 0.45, 0.9], x, 0.6, 0); move(o, x, 0.23, 2.4); await beat(tok, 500); }
  await beat(tok, 1400);
  const cd = code(['void show()', '{', '  printf("Hi");', '}'], 0, 6.2, 0.5);
  say('像 C 函數：可以沒參數', '回傳 void，也一定做了某件事');
  cd.hl(2); await beat(tok, 2600);
  cd.kill();
  const bad = cube('什麼都不產生', GRAY, [2.6, 0.8, 1], 0, 4.6, 0, 2);
  await beat(tok, 900); glow(bad, RED);
  say('沒有任何結果 → 不是演算法', 'input ≥ 0、output ≥ 1');
  await beat(tok, 1300); fly(bad, V3(0, 6, 3));
  await beat(tok, 2600);
}]);

// 01:04 Definiteness：每個敘述只有一種確定意義（√−1 的例子）
FRAG.push(['algjiang1-definite-sqrt', 'Definiteness：√−1 不能當實數用', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  say('Definiteness：每個敘述意義唯一', 'unambiguous、single exact meaning');
  const L = [['x ← 4', J.blue], ['y ← √x', J.blue], ['z ← √−1', J.orange], ['w ← z + 3', J.orange]];
  const cs = [];
  for (let i = 0; i < L.length; i++) { cs.push(jCard(L[i][0], L[i][1], -2.6, 5 - i * 1.0, 0, 3, 3)); await beat(tok, 500); }
  await beat(tok, 900);
  const val = tag('', 'ptr alt', 2.4, 5);
  glow(cs[0], GREEN); txt(val, 'x = 4'); say('x ← 4：意思只有一個', ''); await beat(tok, 1500);
  glow(cs[1], GREEN); val.position.set(2.4, 4, 0); txt(val, 'y = 2'); say('√4 = 2：結果確定', ''); await beat(tok, 1500);
  glow(cs[2], RED); val.position.set(2.4, 3, 0); txt(val, 'z = ?'); say('√−1 是虛數：不能當實數用', 'unknown value → 不 definite');
  await beat(tok, 2400);
  glow(cs[3], RED); say('後面用到 z 的也跟著不明確', '人都解不出來，就不能要電腦做');
  await beat(tok, 2400);
  fly(cs[3], V3(3, 6, 2)); await beat(tok, 300); fly(cs[2], V3(3, 6, 2)); kill(val);
  say('每個敘述都要給出清楚、唯一的意義', 'Definiteness');
  await beat(tok, 2800);
}]);

// 02:14 Finiteness：演算法一定會停；server 是 service
FRAG.push(['algjiang1-finite-server', 'Finiteness：演算法會停，server 不停', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  tag('Algorithm（procedure）', 'ptr', -3.6, 6.6); tag('Server（service）', 'ptr alt', 3.6, 6.6);
  say('Finiteness：有限步驟後一定停', '10 個或 10 000 個敘述都行，但要有限');
  const st = [];
  for (let i = 0; i < 6; i++) { st.push(jCard('statement ' + (i + 1), J.blue, -3.6, 5.2 - i * 0.7, 0, 2.6, 0, 0.5)); }
  const pc = tag('▶', 'ptr', -5.3, 5.2);
  const sv = ['Oracle', 'SQL Server', 'Web server'].map((s, i) => cube(s, J.orange, [2.4, 0.7, 1], 3.6, 4.8 - i * 1.2, 0));
  const cnt = tag('requests: 0', 'ptr alt', 3.6, 1.0);
  let r = 0;
  for (let i = 0; i < 6; i++) {
    pc.position.set(-5.3, 5.2 - i * 0.7, 0); glow(st[i], GOLD); if (i) glow(st[i - 1], null);
    r += 37; txt(cnt, 'requests: ' + r); sv.forEach((m, k) => glow(m, (i + k) % 2 ? GOLD : null));
    await beat(tok, 650);
  }
  glow(st[5], null);
  const done = cube('return 結果 ✓', J.green, [2.6, 0.6, 1], -3.6, 0.3, 0, 2);
  say('演算法跑完最後一步就停下、回傳結果', 'algorithm is a procedure → must stop');
  for (let i = 0; i < 6; i++) { r += 41; txt(cnt, 'requests: ' + r); sv.forEach((m, k) => glow(m, (i + k) % 2 ? GOLD : null)); await beat(tok, 450); }
  say('Server 一直跑到被手動關掉', '那是 service，不是演算法');
  for (let i = 0; i < 8; i++) { r += 53; txt(cnt, 'requests: ' + r + ' …'); sv.forEach((m, k) => glow(m, (i + k) % 2 ? GOLD : null)); await beat(tok, 400); }
  sv.forEach((m) => glow(m, null)); glow(done, GREEN);
  say('演算法必須在有限時間內終止', 'Finiteness');
  await beat(tok, 2800);
}]);

// 03:14 Effectiveness：不寫沒有用途的敘述
FRAG.push(['algjiang1-effective-unneeded', 'Effectiveness：不寫多餘的敘述', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  say('Effectiveness：每個敘述都要有用途', '不要寫 unnecessary statements');
  const L = ['s ← 0', 'for i ← 1 to n', '    s ← s + A[i]', 't ← 100', 'return s'];
  const cs = [];
  for (let i = 0; i < L.length; i++) { cs.push(jCard(L[i], J.blue, -1.2, 5.4 - i * 0.9, 0, 3.4, 3, 0.55)); await beat(tok, 450); }
  await beat(tok, 800);
  const use = tag('', 'ptr alt', 3.4, 5.4);
  const why = ['s 是答案', '走過每個 A[i]', '累加到 s', 't 之後沒人用', '輸出 s'];
  for (let i = 0; i < L.length; i++) {
    use.position.set(3.4, 5.4 - i * 0.9, 0); txt(use, why[i]);
    glow(cs[i], i === 3 ? RED : GREEN);
    say(i === 3 ? 't ← 100：沒有任何作用' : L[i].trim() + '：有用途', i === 3 ? '多餘的敘述' : '');
    await beat(tok, i === 3 ? 2200 : 1100);
  }
  fly(cs[3], V3(5, 6, 2)); kill(use);
  await beat(tok, 600);
  for (let i = 4; i < 5; i++) move(cs[i], -1.2, 5.4 - 3 * 0.9, 0);
  say('刪掉多餘敘述，每一步都在解題', 'Effectiveness');
  await beat(tok, 2800);
}]);

// 03:37 用實驗與食譜類比：input、output、definiteness、finiteness、effectiveness
FRAG.push(['algjiang1-lab-recipe', '化學實驗、物理實驗、食譜都是 procedure', async (tok) => {
  fresh([0, 6.5, 14.5], [0, 2.6, 0]);
  const xs = [-4.4, 0, 4.4], nm = ['化學實驗', '物理實驗', '做菜食譜'];
  const pots = xs.map((x, i) => { tag(nm[i], 'ptr', x, 6.6); return cube('', J.brown, [2.2, 1.0, 1.6], x, 0.5, 0); });
  say('三種 procedure 都需要 input', '藥品＋器材、儀器、食材');
  const IN = [['藥品', '器材'], ['儀器'], ['食材', '調味']];
  for (let i = 0; i < 3; i++) for (let k = 0; k < IN[i].length; k++) {
    const c = jCard(IN[i][k], J.teal, xs[i] - 0.6 + k * 1.2, 4.6, 0, 1.1, 2, 0.5); await beat(tok, 350);
    move(c, xs[i], 1.3, 0); await beat(tok, 300); kill(c);
  }
  say('Output：一定要得到結果', '做了實驗沒溶液、煮了沒菜 → 不行');
  const OUT = ['溶液', '實驗結果', '一道菜'];
  for (let i = 0; i < 3; i++) { const o = jCard(OUT[i], J.green, xs[i], 1.2, 0, 1.6, 0, 0.45); move(o, xs[i], 0.23, 2.4); await beat(tok, 450); }
  await beat(tok, 1500);
  say('Definiteness：每一步都是已知步驟', '沒有任何「魔法」');
  const mg = jCard('魔法步驟 ?', J.purple, 0, 4.2, 0, 2.2, 2); await beat(tok, 1200); glow(mg, RED); await beat(tok, 900); fly(mg, V3(0, 7, 3));
  say('Finiteness：到某個時間點就完成', '菜好了、溶液做好了 → 停');
  const tm = xs.map((x) => tag('', 'ptr alt', x, 2.6));
  for (let t = 1; t <= 6; t++) { tm.forEach((l, i) => txt(l, t <= 3 + i ? t * 5 + ' 分' : '完成 ✓')); await beat(tok, 380); }
  await beat(tok, 900);
  say('Effectiveness：不做沒用的事', '煮了不用的藥品、切了不放的菜');
  const w1 = jCard('煮了沒用的藥品', J.orange, -4.4, 4.2, 0, 2.6, 2), w2 = jCard('切了沒放的蔬菜', J.orange, 4.4, 4.2, 0, 2.6, 2);
  await beat(tok, 1200); glow(w1, RED); glow(w2, RED); await beat(tok, 1000); fly(w1, V3(-3, 7, 3)); fly(w2, V3(3, 7, 3));
  say('演算法就像這些 procedure', 'input、output、definite、finite、effective');
  pots.forEach((p) => glow(p, GOLD));
  await beat(tok, 3000);
}]);

// ════════ 0IAPZzGSbME（Abdul Bari 1：Introduction）— Algorithm vs Program 對照表，params.row = 0..4 ════════
FRAG.push(['algjiang1-avp-row', 'Algorithm vs Program：逐項對照', async (tok) => {
  const row = Math.max(0, Math.min(4, ((ctx.params || {}).row) | 0));
  fresh([0, 6, 14.5], [0, 3, 0]);
  tag('Algorithm', 'ptr', -3.6, 7.0); tag('Program', 'ptr alt', 3.6, 7.0);
  const R = [['Design time', 'Implementation time'], ['懂 domain 的設計者', 'Programmer'], ['任何語言、數學符號', 'C / C++ / Java / Python'], ['與 HW / OS 無關', '依賴 HW / OS'], ['Analyze', 'Testing']];
  const Y = (r) => 6.2 - r * 0.85;
  for (let r = 0; r < row; r++) { jCard(R[r][0], GRAY, -3.6, Y(r), -1.5, 3.6, 0, 0.5); jCard(R[r][1], GRAY, 3.6, Y(r), -1.5, 3.6, 0, 0.5); }
  const L = jCard(R[row][0], J.blue, -3.6, Y(row), -1.5, 3.6, 3, 0.5); await beat(tok, 400);
  const Rr = jCard(R[row][1], J.orange, 3.6, Y(row), -1.5, 3.6, 3, 0.5);
  const yb = 1.0, tmp = [];
  if (row === 0) {
    say('Algorithm：解決計算問題的步驟', 'step-by-step procedure；program 也是');
    await beat(tok, 2400);
    say('工程：先設計，再施工', '蓋錯拆掉重來？不行');
    for (let i = 0; i < 3; i++) { tmp.push(cube('', J.sand, [1.4, 0.5, 1.2], 0, 0.25 + i * 0.5, 1.5, 2)); await beat(tok, 300); }
    glow(tmp[2], RED); await beat(tok, 900); tmp.forEach((m) => fly(m, V3(0, 6, 3))); tmp.length = 0;
    await beat(tok, 600);
    say('設計階段：在紙上用類英文寫', '不講究 syntax → 這就是 algorithm');
    const p = jCard('紙 / Notepad：類英文步驟', J.paper, -3.6, yb, 1.5, 3.8, 2); await beat(tok, 1800);
    say('實作階段：把設計轉成程式', 'algorithm → program');
    const a = arrow(V3(-1.5, yb, 1.5), V3(1.4, yb, 1.5)); const q = jCard('C 程式', J.orange, 3.6, yb, 1.5, 2.6, 2);
    await beat(tok, 2200); glow(L, GOLD); glow(Rr, GOLD);
  } else if (row === 1) {
    say('誰來寫演算法？懂 domain 的人', 'domain knowledge：懂問題與解法');
    const e1 = jCard('會計系統 → 會計師', J.blue, -3.6, 2.2, 1.5, 3.6, 2); await beat(tok, 1600);
    const e2 = jCard('醫院系統 → 醫師、行政', J.blue, -3.6, 1.2, 1.5, 3.6, 2); await beat(tok, 1800);
    say('程式由 programmer 寫', '');
    const pg = cube('programmer', J.orange, [2.2, 0.8, 1], 3.6, 1.6, 1.5, 2); await beat(tok, 1800);
    say('programmer 也懂 domain 時', '他就同時當 designer');
    move(pg, -0.2, 1.6, 1.5); glow(pg, GOLD); await beat(tok, 2200);
  } else if (row === 2) {
    say('演算法可以用任何語言寫', '類英文、或更好：數學符號');
    jCard('English-like', J.blue, -4.6, 2.0, 1.5, 2.2, 2); await beat(tok, 500);
    jCard('Σ、←、數學符號', J.blue, -2.4, 2.0, 1.5, 2.2, 2); await beat(tok, 1400);
    say('條件：團隊看得懂就好', 'designer、programmer 都要能讀');
    await beat(tok, 2000);
    say('程式只能用程式語言', '');
    ['C', 'C++', 'Java', 'Python'].forEach((s, i) => jCard(s, J.orange, 2.1 + i * 1.05, 2.0, 1.5, 0.95, 2));
    await beat(tok, 2200);
  } else if (row === 3) {
    say('演算法不管機器與 OS', 'hardware & OS independent');
    const al = jCard('Algorithm', J.blue, -3.6, 1.8, 1.5, 2.4, 2); await beat(tok, 1800);
    say('程式要選定硬體與作業系統', 'Linux 或 Windows，做法與環境都不同');
    const m1 = cube('Linux', J.brown, [1.8, 1, 1.2], 2.4, 0.5, 1.5, 2), m2 = cube('Windows', J.brown, [1.8, 1, 1.2], 4.8, 0.5, 1.5, 2);
    await beat(tok, 900);
    const p1 = jCard('程式 v1', J.orange, 2.4, 1.6, 1.5, 1.5, 2, 0.45), p2 = jCard('程式 v2', J.orange, 4.8, 1.6, 1.5, 1.5, 2, 0.45);
    await beat(tok, 2200);
  } else {
    say('寫完演算法：分析它', '時間、空間上有沒有效率');
    jCard('time？', J.blue, -4.6, 1.8, 1.5, 1.8, 2); await beat(tok, 400); jCard('space？', J.blue, -2.6, 1.8, 1.5, 1.8, 2);
    await beat(tok, 2000);
    say('程式不用研究：直接跑起來測', 'testing');
    const pc = cube('run', J.brown, [1.8, 1, 1.2], 3.6, 0.5, 1.5, 2); const t = tag('', 'ptr alt', 3.6, 1.8, 1.5);
    for (let i = 1; i <= 5; i++) { txt(t, 'test ' + i + ' ✓'); glow(pc, i % 2 ? GOLD : null); await beat(tok, 450); }
  }
  glow(L, GOLD); glow(Rr, GOLD);
  say(R[row][0] + ' vs ' + R[row][1], '演算法 vs 程式');
  await beat(tok, 2800);
}]);

// ════════ xGYsEqe9Vl0（Abdul Bari 1.3：How to Write and Analyze Algorithm） ════════
// 00:00 Swap 的寫法：沒有 data type、沒有宣告；begin/end、:= 或 ← 都可以
FRAG.push(['algjiang1-swap-write', 'Algorithm Swap(a, b)：沒有固定語法', async (tok) => {
  fresh([0, 6, 14], [0, 2.8, 0]);
  const cd = code(['Algorithm Swap(a, b)', '{', '    temp = a;', '    a = b;', '    b = temp;', '}'], -3.4, 6.4, 0.55);
  const xs = { a: 1.4, b: 3.4, temp: 5.4 };
  const box = {}; for (const v in xs) { tag(v, 'idx', xs[v], 0, 1.0); box[v] = cube('', GRAY, [1.2, 0.2, 1.2], xs[v], 0.1, 0); }
  const va = cube('x', J.blue, [0.9, 0.7, 0.9], xs.a, 0.55, 0, 2), vb = cube('y', J.orange, [0.9, 0.7, 0.9], xs.b, 0.55, 0, 2);
  say('C 語言風格寫的 Swap', '開頭寫 Algorithm：表示不是程式');
  cd.hl(0); await beat(tok, 2200);
  cd.hl(2); const ct = cube('x', J.blue, [0.9, 0.7, 0.9], xs.a, 0.55, 0); move(ct, xs.temp, 0.55, 0); say('temp = a', ''); await beat(tok, 1300);
  cd.hl(3); relabel(va, 'y'); tint(va, J.orange); say('a = b', ''); await beat(tok, 1300);
  cd.hl(4); relabel(vb, 'x'); tint(vb, J.blue); say('b = temp：交換完成', ''); await beat(tok, 1500);
  cd.hl(0); const n1 = tag('← 參數沒有 data type', 'ptr alt', 1.6, 6.4);
  say('沒寫 data type：寫程式時才決定', ''); await beat(tok, 2200);
  cd.hl(2); n1.position.set(0.8, 5.3, 0); txt(n1, '← temp 沒宣告');
  say('temp 沒宣告也直接用', '語言細節演算法不在意'); await beat(tok, 2200);
  kill(n1); cd.kill();
  const c2 = code(['Algorithm Swap(a, b)', 'begin', '    temp := a;', '    a := b;', '    b := temp;', 'end'], -3.4, 6.4, 0.55);
  say('也可以寫 begin / end', '用 :=（Pascal）或 ← 表示指定'); c2.hl(1); await beat(tok, 2400);
  c2.hl(2); await beat(tok, 1200);
  say('沒有固定語法：相關的人看得懂就好', 'no fixed syntax for algorithms');
  c2.hl(-1); await beat(tok, 3000);
}]);

// 02:00 / 03:30 分析的準則：time、space（主要）＋ data transfer、power、registers；params.part = 0 | 1
FRAG.push(['algjiang1-criteria', '分析演算法的準則：time、space …', async (tok) => {
  const part = ((ctx.params || {}).part) | 0;
  fresh([0, 6, 14], [0, 2.6, 0]);
  const al = cube('Algorithm', J.purple, [2.4, 1, 1.4], 0, 0.5, 0);
  say('用什麼準則分析演算法？', '');
  await beat(tok, 1500);
  const t = jCard('Time', J.blue, -4.2, 5.4, 0, 2.2, 3);
  if (part === 0) {
    say('第一個準則：time', '手算或交給機器，都要看花多久');
    await beat(tok, 2200);
    const f = jCard('time function f(n)', J.blue, -4.2, 4.4, 0, 3, 2, 0.5); await beat(tok, 900);
    const w = jCard('牆鐘幾秒', GRAY, -4.2, 3.5, 0, 2.2, 2, 0.5); await beat(tok, 700); glow(w, RED);
    say('得到的是 time function', '不是手錶量的時間'); await beat(tok, 2400); fly(w, V3(-4, 6, 3));
  }
  const s = jCard('Space', J.blue, 4.2, 5.4, 0, 2.2, 3);
  say('第二個準則：space', '轉成程式在機器上跑，要用多少記憶體');
  await beat(tok, 2400);
  glow(t, GOLD); glow(s, GOLD);
  say('time、space：兩個主要準則', 'two major criteria');
  await beat(tok, 2200);
  if (part === 1) {
    const E = [['Data transfer', 'web / cloud：傳多少資料'], ['Power', '手機、平板：耗電'], ['CPU registers', 'device driver、系統程式']];
    for (let i = 0; i < 3; i++) {
      const c = jCard(E[i][0], J.teal, -4.2 + i * 4.2, 2.6, 1.5, 2.6, 3); await beat(tok, 500);
      say('其他準則：' + E[i][0], E[i][1]); await beat(tok, 2200);
    }
    say('還要看哪些，依專案需求決定', 'depends on your requirement');
    await beat(tok, 2000);
  }
  glow(al, GOLD);
  await beat(tok, 2600);
}]);

// 05:36 時間分析：每個簡單敘述 1 單位 → f(n) = 3；x = 5a + 6b 也算 1
FRAG.push(['algjiang1-swap-time', '時間分析：每個敘述 1 單位，f(n) = 3', async (tok) => {
  fresh([0, 6, 14], [0, 2.8, 0]);
  const cd = code(['Algorithm Swap(a, b)', '{', '    temp = a;', '    a = b;', '    b = temp;', '}'], -3.4, 6.4, 0.55);
  const fq = [2, 3, 4].map((i) => tag('', 'ptr alt', -0.6, 6.4 - i * 0.55));
  const stk = [];
  say('每個簡單敘述 = 1 單位時間', '不是牆鐘時間');
  await beat(tok, 2000);
  for (let k = 0; k < 3; k++) {
    cd.hl(k + 2); txt(fq[k], '1'); stk.push(cube('1', J.blue, [1, 0.4, 1], 3.6, 0.2 + k * 0.45, 0, 2.5));
    say(['temp = a', 'a = b', 'b = temp'][k] + '：1 單位', '累計 ' + (k + 1)); await beat(tok, 1100);
  }
  cd.hl(-1);
  say('f(n) = 3：常數', '3 或 30 都是常數 → O(1)');
  await beat(tok, 2400);
  cd.kill(); fq.forEach(kill); stk.forEach(kill);
  const st = jCard('x = 5 * a + 6 * b', J.blue, -3, 5.2, 0, 3.6, 3);
  say('換成 x = 5a + 6b 呢？', '分析時一樣算 1 單位');
  await beat(tok, 2200);
  const MC = ['MUL t1, 5, a', 'MUL t2, 6, b', 'ADD t3, t1, t2', 'STORE x, t3'];
  for (let i = 0; i < 4; i++) { jCard(MC[i], J.orange, 3, 5.2 - i * 0.8, 0, 3.2, 2, 0.5); await beat(tok, 500); }
  say('真的變成機器碼大約 4 個指令', '2 個乘、1 個加、1 個指定');
  await beat(tok, 2600);
  glow(st, GOLD);
  say('我們不深入到機器碼', '每個敘述就記 1 單位');
  await beat(tok, 2800);
}]);

// 08:00 分析要多深：去朋友家 vs 登陸火星
FRAG.push(['algjiang1-car-mars', '分析深淺：去朋友家 vs 登陸火星', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  tag('去朋友家', 'ptr', -3.8, 6.4); tag('登陸火星', 'ptr alt', 3.8, 6.4);
  const home = cube('家', J.sand, [1, 0.8, 1], -6, 0.4, 0), fr = cube('朋友家', J.green, [1.4, 0.8, 1], -1.6, 0.4, 0);
  const car = cube('車', J.blue, [0.9, 0.5, 0.7], -6, 1.1, 0);
  say('去朋友家：開車出發就好', '不需要詳細規劃');
  await anim(tok, 2000, (t) => car.position.set(-6 + t * 4.4, 1.1, 0));
  await beat(tok, 800);
  say('登陸火星：每個細節都要規劃', '分析、設計、完整計畫');
  const P = ['軌道計算', '燃料', '材料', '通訊', '測試', '備援'];
  const cs = [];
  for (let i = 0; i < P.length; i++) { cs.push(jCard(P[i], J.orange, 2.6 + (i % 2) * 2.4, 5.2 - Math.floor(i / 2) * 0.9, 0, 2.2, 2, 0.5)); await beat(tok, 450); }
  const rk = cube('火箭', J.purple, [0.8, 1.6, 0.8], 3.8, 0.8, 0, 2);
  await beat(tok, 1600);
  cs.forEach((c) => glow(c, GREEN)); await beat(tok, 600);
  await anim(tok, 1600, (t) => rk.position.set(3.8, 0.8 + t * 4.5, 0));
  say('分析深淺看需求', '本課程做簡要分析：每敘述 1 單位');
  await beat(tok, 3000);
}]);

// 09:09 空間分析：a、b、temp 三個 word → S(n) = 3 → O(1)
FRAG.push(['algjiang1-swap-space', '空間分析：3 個 word → O(1)', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const cd = code(['Algorithm Swap(a, b)', '{', '    temp = a;', '    a = b;', '    b = temp;', '}'], -3.4, 6.4, 0.55);
  say('空間：用到哪些變數？', '');
  await beat(tok, 1600);
  const V = [['a', '參數', 0], ['b', '參數', 0], ['temp', '區域變數', 2]];
  const cs = [];
  for (let i = 0; i < 3; i++) {
    cd.hl(V[i][2]); cs.push(cube(V[i][0], J.teal, [1.2, 1.0, 1.2], 1.6 + i * 1.8, 0.5, 0, 3)); tag(V[i][1], 'idx', 1.6 + i * 1.8, 0, 1.0);
    say(V[i][0] + '：' + V[i][1] + '，1 word', '目前 ' + (i + 1) + ' 個 word'); await beat(tok, 1300);
  }
  cd.hl(-1);
  say('S(n) = 3：常數', '常數寫成 O(1)');
  await beat(tok, 2400);
  const big = tag('3 → O(1)', 'ptr alt', 3.4, 2.6);
  await beat(tok, 900); txt(big, '3000 → 還是 O(1)');
  say('3 或 3000 都記為 O(1)', '1 代表「常數」');
  await beat(tok, 2400);
  const ty = tag('', 'ptr', 1.6, 2.0);
  for (const s of ['int ?', 'float ?', 'double ?', 'int ?', 'float ?', 'double ?']) { txt(ty, s); await beat(tok, 350); }
  say('型別未定，不知道幾 bytes', '所以用 word 當單位');
  await beat(tok, 3000);
}]);

// ════════ 7a28lIQIHJQ（江蕙如 Lec01 課程介紹） ════════
// 02:34 解題：抽絲剝繭，萃取 essential 部分，再用 generalization 處理瑣碎部分
FRAG.push(['algjiang1-essence', '解題：先萃取問題的本質', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  say('剛遇到的問題：亂七八糟沒有線索', '');
  const pos = [[-4.5, 1, -1], [-3, 2.2, 1], [-1.2, 0.6, -2], [0.5, 2.8, 0], [2, 1.2, 2], [3.6, 3, -1], [4.8, 0.8, 1], [-2.2, 3.6, 0], [1.4, 4.2, -2], [3, 0.5, -2.5], [-4, 3, 2], [0, 1.4, 2.5]];
  const ess = [3, 5, 8];
  const cs = pos.map((p, i) => cube('', [J.blue, J.orange, J.purple, J.teal, J.pink][i % 5], [0.7, 0.7, 0.7], p[0], p[1], p[2], 2));
  await beat(tok, 2200);
  say('抽絲剝繭：找出本質的難題', 'extract the essential part');
  ess.forEach((i) => glow(cs[i], GOLD));
  await beat(tok, 2000);
  cs.forEach((c, i) => { if (!ess.includes(i)) { tint(c, GRAY); move(c, -6 + (i % 6) * 0.8, 0.35, -3.2 + Math.floor(i / 6) * 0.8); } });
  ess.forEach((i, k) => move(cs[i], -1 + k * 1, 3, 0));
  say('瑣碎的事先不管', '問題變單純');
  await beat(tok, 2200);
  const al = cube('algorithm', J.green, [3.4, 0.6, 1.4], 0, 1.8, 0, 2);
  say('針對核心設計適當的演算法', '成功的一半在理出頭緒');
  await beat(tok, 2400);
  say('再用 generalization / extension', '把瑣碎部分也納進來');
  cs.forEach((c, i) => { if (!ess.includes(i)) { tint(c, J.sand); move(c, -3.3 + (i % 9) * 0.82, 0.35, 1.4 + Math.floor(i / 9) * 0.8); } });
  await beat(tok, 2200);
  glow(al, GOLD);
  say('問題就完整解決了', '');
  await beat(tok, 2600);
}]);

// 05:39 課程地圖；params.part = 0（簡介、分析、graph）| 1（四大技巧）| 2（難題與對策）
FRAG.push(['algjiang1-syllabus', '這學期的課程地圖', async (tok) => {
  const part = Math.max(0, Math.min(2, ((ctx.params || {}).part) | 0));
  fresh([0, 6.5, 14.5], [0, 2.6, 0]);
  const rows = [
    [['Stable matching', '用有趣的問題介紹演算法'], ['分析：快？對？記憶體？', '先懂遊戲規則再設計'], ['Graph', '很多問題用 graph 表示']],
    [['Greedy', '簡單又快，但不是每題都對'], ['Divide & Conquer', '拆小、分別解，再合併（最難）'], ['Dynamic Prog.', 'programming = 最佳化，不是寫程式'], ['Network Flow', '像水管裡的水流：資源分配']],
    [['NP-complete', '目前沒人能在合理時間求最佳解'], ['PSPACE-complete', 'AI、game playing 的難度'], ['Approximation', '保證至少 90 分的答案'], ['Local search', '對付困難問題'], ['Randomized', '執行中隨機挑選']],
  ];
  const ys = [5.6, 3.6, 1.4];
  for (let r = 0; r < 3; r++) {
    const n = rows[r].length, gap = n > 4 ? 2.6 : 3.3;
    rows[r].forEach((it, i) => { const c = jCard(it[0], r === part ? [J.blue, J.orange, J.purple][r] : GRAY, -(n - 1) * gap / 2 + i * gap, ys[r], 0, gap - 0.2, 0, 0.6); rows[r][i].c = c; });
  }
  tag(['① 簡介與背景', '② 演算法核心技巧', '③ 難題與對策'][part], 'ptr alt', 0, ys[part] + 0.9);
  say(['先介紹問題、分析工具與 graph', '四種代表性的設計技巧', '比較難的問題怎麼辦'][part], '');
  await beat(tok, 2000);
  for (const it of rows[part]) {
    glow(it.c, GOLD); say(it[0], it[1]);
    if (part === 1 && it[0] === 'Divide & Conquer') {
      const x = it.c.position.x, kids = [-1, 0, 1].map((d) => cube('', J.orange, [0.6, 0.4, 0.6], x, ys[1] - 0.8, 1.2));
      await beat(tok, 500); kids.forEach((k, d) => move(k, x + (d - 1) * 0.9, ys[1] - 1.2, 1.2)); await beat(tok, 1200);
      kids.forEach((k) => move(k, x, ys[1] - 0.8, 1.2)); await beat(tok, 900); kids.forEach(kill);
    } else await beat(tok, 2300);
    glow(it.c, null); tint(it.c, J.green);
  }
  say(['之後才進入核心技巧', '學了演算法一定要會 DP', '最後：永遠不停的演算法'][part], '');
  await beat(tok, 2800);
}]);

// 21:42 Knuth：finite、definite、effective、output（input 可以沒有）
FRAG.push(['algjiang1-knuth-props', 'Knuth：finite、definite、effective', async (tok) => {
  fresh([0, 6.2, 14.5], [0, 2.8, 0]);
  const io = cube('procedure', J.purple, [2.6, 1, 1.4], 0, 5.4, 0);
  const i1 = jCard('input（可能沒有）', J.teal, -4.4, 5.4, 0, 2.8, 2), o1 = jCard('output（一定要有）', J.green, 4.4, 5.4, 0, 2.8, 2);
  arrow(V3(-2.9, 5.4, 0), V3(-1.4, 5.4, 0)); arrow(V3(1.4, 5.4, 0), V3(2.9, 5.4, 0));
  say('先想清楚 input 與 output', '本課的問題大多都有 input');
  await beat(tok, 2600);
  // finite
  tag('Finite', 'ptr', -4.6, 3.6);
  const lp = jCard('while (true) …', J.blue, -4.6, 2.6, 0, 2.6, 2); const cnt = tag('', 'ptr alt', -4.6, 1.6);
  say('Finite：有限步驟內一定停', '');
  for (let i = 1; i <= 8; i++) { txt(cnt, '第 ' + i * 125 + ' 圈 …'); await beat(tok, 260); }
  glow(lp, RED); say('程式落入無窮迴圈 → 不算演算法', ''); await beat(tok, 1800);
  // definite
  tag('Definite', 'ptr', 0, 3.6);
  const ins = jCard('「把大的放前面」', J.blue, 0, 2.6, 0, 2.8, 2);
  say('Definite：描述乾淨，不會誤解', ''); await beat(tok, 1300);
  const sa = jCard('A：由大到小排', J.orange, -0.8, 1.6, 1.4, 2.2, 2, 0.45), sb = jCard('B：最大的移到第一格', J.orange, 0.8, 0.9, 1.4, 2.6, 2, 0.45);
  say('A、B 同學做出不同的事', '會誤解 → 不 definite'); glow(ins, RED); await beat(tok, 2400);
  // effective
  tag('Effective', 'ptr', 4.6, 3.6);
  const e1 = jCard('紙筆可模擬的步驟', J.green, 4.6, 2.6, 0, 2.8, 2); await beat(tok, 700);
  const e2 = jCard('「直接猜出答案」', J.blue, 4.6, 1.6, 0, 2.8, 2);
  say('Effective：每步都能用紙筆做出來', '做不到的 operation 不算'); await beat(tok, 1600); glow(e2, RED); glow(e1, GREEN);
  await beat(tok, 1600);
  say('Knuth：finite、definite、effective', '而且一定要產生 output');
  glow(io, GOLD);
  await beat(tok, 3000);
}]);

// 24:20 CLRS：well-defined procedure，把 input 轉成期待的 output；作業要寫、證、析
FRAG.push(['algjiang1-clrs-def', 'CLRS：把 input 轉成 output 的 procedure', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const pr = cube('well-defined procedure', J.purple, [3.4, 1.2, 1.4], 0, 4.6, 0, 2);
  say('CLRS：定義明確的 procedure', '把給定的 input 轉成期待的 output');
  await beat(tok, 1800);
  const inp = jCard('input', J.teal, -5, 4.6, 0, 1.6, 2);
  await beat(tok, 600);
  move(inp, -2, 4.6, 0); await beat(tok, 700); kill(inp);
  const out = jCard('output', J.green, 2, 4.6, 0, 1.6); move(out, 5, 4.6, 0);
  await beat(tok, 1800);
  say('不是 formal 定義，但要記住原則', '明確、做得到、乾淨');
  await beat(tok, 2400);
  const H = [['① 寫下 procedure', '給題目，自己設計演算法'], ['② 證明它正確', 'correctness'], ['③ 分析跑多快', '給執行時間一個合理的 bound']];
  for (let i = 0; i < 3; i++) { const c = jCard(H[i][0], J.blue, -4.2 + i * 4.2, 1.6, 0, 3.4, 3); say('作業：' + H[i][0], H[i][1]); await beat(tok, 2000); glow(c, GOLD); }
  await beat(tok, 2800);
}]);

// ════════ kxIQ86qMtfk（江蕙如 Lec02：Chapter 1 Introduction） ════════
// 00:16 遇到問題到得到演算法的流程
FRAG.push(['algjiang1-design-flow', '設計演算法的流程：問題 → 證明 → 分析', async (tok) => {
  fresh([0, 6.5, 14.5], [0, 2.6, 0]);
  const S = [['實際的問題', '真的遇到了才想解'], ['Formulate', '萃取本質，乾淨描述'], ['設計演算法', '演算法本身也要乾淨'], ['證明正確', '吐出正確結果／最佳解'], ['分析時間', '寫成程式要跑多久'], ['額外性質', 'bonus']];
  const cs = [];
  for (let i = 0; i < S.length; i++) {
    const x = -5.5 + i * 2.2, y = 5 - i * 0.7;
    cs.push(jCard(S[i][0], i === 5 ? J.sand : J.blue, x, y, 0, 2.0, 3, 0.55));
    if (i) arrow(V3(x - 1.5, y + 0.7, 0), V3(x - 0.9, y + 0.15, 0));
    say((i + 1) + '. ' + S[i][0], S[i][1]); glow(cs[i], GOLD); if (i) glow(cs[i - 1], null);
    await beat(tok, 2000);
  }
  glow(cs[5], null);
  say('哪一步最難？定義問題', '');
  const ms = jCard('碩士：學會解題技巧', J.teal, -3.2, 0.8, 1.5, 3.2, 2), phd = jCard('博士：學會定義問題', J.orange, 3.2, 0.8, 1.5, 3.2, 2);
  await beat(tok, 1600); glow(cs[1], GOLD); glow(phd, GOLD);
  say('Formulate 反而最困難', '把亂七八糟的問題理出本質');
  await beat(tok, 3000);
}]);

// 06:54 Stable matching：交友公司，100 男 100 女，每人完整排序
FRAG.push(['algjiang1-sm-dating', 'Stable matching：交友公司的配對', async (tok) => {
  fresh([0, 6.5, 14.5], [0, 2.6, 0]);
  const men = [], wom = [];
  for (let i = 0; i < 10; i++) { men.push(cube('', J.blue, [0.5, 0.5, 0.5], -5.4 + i * 0.6, 0.25, -1.2, 2)); wom.push(cube('', J.pink, [0.5, 0.5, 0.5], 0.0 + i * 0.6 + 0.2, 0.25, -1.2, 2)); }
  tag('100 位男生客戶（示意 10）', 'idx', -2.7, 0, 0); tag('100 位女生客戶（示意 10）', 'idx', 2.9, 0, 0);
  say('你是交友公司老闆', '100 位男生、100 位女生要配對');
  await beat(tok, 2400);
  say('每個人都替對面 100 人排名次', 'preference list：1st choice … 100th');
  const pl = []; for (let k = 0; k < 6; k++) pl.push(cube(k < 5 ? String(k + 1) : '…', J.paper, [0.45, 0.45, 0.45], -5.4, 1.0 + k * 0.5, -1.2, 2));
  const pr = []; for (let k = 0; k < 6; k++) pr.push(cube(k < 5 ? String(k + 1) : '…', J.paper, [0.45, 0.45, 0.45], 0.2, 1.0 + k * 0.5, -1.2, 2));
  await beat(tok, 2600);
  pl.forEach(kill); pr.forEach(kill);
  say('條件一：全部配完，一對一', '不能有人落單、不能一對多');
  for (let i = 0; i < 10; i++) { move(wom[i], -5.4 + i * 0.6, 0.25, 1.4); await beat(tok, 180); }
  const ls = []; for (let i = 0; i < 10; i++) ls.push(jLine3(-5.4 + i * 0.6, 0.25, -1.0, -5.4 + i * 0.6, 0.25, 1.2, J.eng));
  await beat(tok, 1800);
  say('條件二：happy and stable', '不存在一對男女：比起配到的人更喜歡彼此');
  glow(men[2], RED); glow(wom[6], RED);
  jLine3(-5.4 + 2 * 0.6, 0.3, -1.0, -5.4 + 6 * 0.6, 0.3, 1.2, J.red);
  await beat(tok, 2800);
  say('有這種一對就會「劈腿」', '→ unstable');
  await beat(tok, 2800);
}]);

// 11:37 3×3 例子：Z→A、Y→B、X→C；X 與 B 互相更喜歡 → unstable
FRAG.push(['algjiang1-sm-unstable-xyz', '先隨便配：X–B 會劈腿，不 stable', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.8, 0]);
  const B = jBoard(SM3M, SM3F);
  say('input 就是這兩張偏好表', '3 個男生 XYZ、3 個女生 ABC');
  await beat(tok, 2600);
  const steps = [['Z', 'A', 'Z 配他最喜歡的 A'], ['Y', 'B', 'Y 配他最喜歡的 B'], ['X', 'C', 'A、B 都被配走：X 只能配 C']];
  for (const [m, w, s] of steps) { glow(B.ML[m][w], GOLD); B.link(m, w); say(s, ''); await beat(tok, 1800); }
  B.off();
  say('這樣 happy and stable 嗎？', 'X 一定不開心');
  await beat(tok, 2000);
  glow(B.ML.X.B, RED); glow(B.ML.X.C, GRAY);
  say('X 喜歡 B 勝過配到的 C', 'X：A > B > C');
  await beat(tok, 2200);
  glow(B.WL.B.X, RED);
  say('B 也喜歡 X 勝過配到的 Y', 'B：X > Y > Z');
  const bl = line(B.M.X.position.x + 0.42, B.y.X, B.W.B.position.x - 0.42, B.y.B, 0.2, J.red);
  glow(B.M.X, RED); glow(B.W.B, RED);
  await beat(tok, 2400);
  say('X 和 B 會劈腿 → unstable', '不是 stable marriage');
  await beat(tok, 3000);
}]);

// 17:22 名詞：perfect matching（每人剛好一個）＋ stable（沒有 unstable pair）
FRAG.push(['algjiang1-sm-perfect-stable', 'Perfect matching ＋ 沒有 unstable pair', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.8, 0]);
  const B = jBoard(SM3M, SM3F);
  say('Perfect matching：每個人剛好配到一個', '不是幸福的意思，只是「都配完了」');
  B.link('X', 'A'); B.link('Y', 'A', J.red); glow(B.W.A, RED);
  await beat(tok, 2000);
  say('一個女生配兩個男生 → 不行', 'one-to-one');
  await beat(tok, 1600);
  B.unlink('X'); B.unlink('Y'); glow(B.W.A, null);
  B.link('X', 'A'); B.link('Y', 'B'); glow(B.M.Z, RED); glow(B.W.C, RED);
  say('有人落單 → 也不 perfect', '');
  await beat(tok, 1800);
  glow(B.M.Z, null); glow(B.W.C, null); B.link('Z', 'C');
  say('X–A、Y–B、Z–C：perfect', '再檢查 stable');
  await beat(tok, 2000);
  const chk = [['Z', 'A', 'A 更愛 Y 勝過 Z → 不成立'], ['Z', 'B', 'B 更愛 Y 勝過 Z → 不成立']];
  for (const [m, w, s] of chk) {
    glow(B.ML[m][w], GOLD); glow(B.WL[w][m], RED);
    const l = line(B.M[m].position.x + 0.42, B.y[m], B.W[w].position.x - 0.42, B.y[w], 0.2, J.gold);
    say('Z 想要 ' + w + '，但 ' + w + ' 不想', s); await beat(tok, 2200); kill(l); B.off();
  }
  say('沒有 unstable pair → stable', 'stable matching = perfect ＋ stable');
  for (const m of B.men) glow(B.M[m], GREEN);
  await beat(tok, 3000);
}]);

// 21:12 直覺法：隨便配，有 unstable 就 swap —— 可能繞成 cycle 停不下來
FRAG.push(['algjiang1-swap-cycle', '直覺法：有 unstable 就 swap → 可能繞圈', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.8, 0]);
  const Mp = { X: 'ABC', Y: 'BAC', Z: 'ABC' }, Fp = { A: 'YZX', B: 'ZYX', C: 'XYZ' };
  const B = jBoard(Mp, Fp);
  tag('（示意例子：會繞圈的偏好表）', 'idx', 0, 6.3);
  const cur = { X: 'A', Y: 'B', Z: 'C' };
  for (const m in cur) B.link(m, cur[m]);
  say('1. 先隨便配一組', '2. 有 unstable pair 就 swap　3. 重複');
  await beat(tok, 2600);
  const swaps = [['Z', 'B'], ['Z', 'A'], ['Y', 'A'], ['Y', 'B']];
  const cnt = tag('swap 0 次', 'ptr alt', 0, 0.4);
  let k = 0;
  for (let round = 0; round < 2; round++) for (const [m, w] of swaps) {
    const l = line(B.M[m].position.x + 0.42, B.y[m], B.W[w].position.x - 0.42, B.y[w], 0.2, J.red);
    glow(B.M[m], RED); glow(B.W[w], RED);
    say('unstable：' + m + ' 與 ' + w, '把他們換成一對');
    await beat(tok, round ? 700 : 1300);
    let m0 = null; for (const q in cur) if (cur[q] === w) m0 = q;
    const w0 = cur[m]; cur[m] = w; cur[m0] = w0; B.link(m, w); B.link(m0, w0); kill(l);
    glow(B.M[m], null); glow(B.W[w], null);
    k++; txt(cnt, 'swap ' + k + ' 次');
    if (k === 4) { say('4 次 swap 後回到最初的配對！', '解掉一個，又產生新的 unstable'); await beat(tok, 2600); }
    else await beat(tok, round ? 500 : 900);
  }
  say('swap 可能形成 cycle，永遠停不下來', '違反 finite → 不是有效的 procedure');
  await beat(tok, 3000);
}]);

// 26:51 Gale–Shapley：free → engaged（可毀約）→ married；deferred decision making
FRAG.push(['algjiang1-gs-states', 'Gale–Shapley：free → engaged → married', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const xs = [-4.4, 0, 4.4], nm = ['free', 'engaged', 'married'];
  xs.forEach((x, i) => { cube('', [J.sand, J.eng, J.green][i], [3.2, 0.2, 2.6], x, 0.1, 0); tag(nm[i], 'ptr', x, 0, 1.8); });
  const m = cube('m', J.blue, [0.8, 0.8, 0.8], -5, 0.6, -0.5, 2), m2 = cube('m′', J.blue, [0.8, 0.8, 0.8], -3.8, 0.6, -0.5, 2), w = cube('w', J.pink, [0.8, 0.8, 0.8], -4.4, 0.6, 0.7, 2);
  say('一開始每個人都是 free', 'Gale & Shapley 1962；2012 諾貝爾經濟學獎');
  await beat(tok, 2600);
  say('m 向 w propose，w 先 accept', '男生 propose；女生只能 accept / reject');
  await beat(tok, 900); move(m, -0.5, 0.6, -0.5); move(w, -0.5, 0.6, 0.7); await beat(tok, 2000);
  say('engaged 只是訂婚：可以毀約', 'deferred decision making');
  await beat(tok, 2200);
  say('更喜歡的 m′ 來 propose：w 換人', 'm 被 dump，回到 free');
  move(m2, 0.5, 0.6, -0.5); await beat(tok, 700); move(m, -5, 0.6, -0.5); glow(m, RED); move(w, 0.5, 0.6, 0.7);
  await beat(tok, 2200); glow(m, null);
  say('m 再向下一位 propose', '男生可能 free ↔ engaged 來回好幾次');
  const w2 = cube('w2', J.pink, [0.8, 0.8, 0.8], -4.4, 0.6, 1.0, 2); await beat(tok, 800);
  move(m, -1.0, 0.6, 1.4); move(w2, -1.0, 0.6, 2.4); await beat(tok, 2000);
  say('全部 engaged、不再改變 → 轉成 married', '');
  move(m2, 4.0, 0.6, -0.5); move(w, 4.0, 0.6, 0.7); move(m, 5.0, 0.6, -0.5); move(w2, 5.0, 0.6, 0.7);
  await beat(tok, 3000);
}]);

// 30:35 GS 的 pseudocode：三種 case（用 demo 的 V→B、X→B、Y→A）
FRAG.push(['algjiang1-gs-code', 'Gale–Shapley pseudocode：三種 case', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.8, 0]);
  const cd = code(['1 initialize each person to be free', '2 while (some man is free and', '         hasn\'t proposed to every woman)', '3   choose such a man m', '4   w = 1st woman on m\'s list', '        not yet proposed to', '5   if w is free: m, w engaged', '6   else if w prefers m to fiancé m\'', '7       m, w engaged; m\' free', '8   else w rejects m', '9 output engaged pairs as married'], -3.6, 6.6, 0.5);
  const H = (i) => cd.hl(i);
  const wB = cube('B', J.pink, [0.8, 0.7, 0.8], 3.2, 4.4, 0), wA = cube('A', J.pink, [0.8, 0.7, 0.8], 3.2, 2.0, 0);
  const lB = 'XWYVZ'.split('').map((m, k) => cube(m, J.paper, [0.45, 0.45, 0.45], 4.2 + k * 0.55, 4.4, 0));
  const lA = 'ZVWYX'.split('').map((m, k) => cube(m, J.paper, [0.45, 0.45, 0.45], 4.2 + k * 0.55, 2.0, 0));
  tag('B 的偏好', 'idx', 5.3, 5.0); tag('A 的偏好', 'idx', 5.3, 2.6);
  H(0); say('Line 1：每個人都 free', ''); await beat(tok, 1800);
  H(1); say('Line 2–8：propose、accept / reject', '有 free 且還沒求完婚的男生就繼續'); await beat(tok, 2200);
  const V = cube('V', J.blue, [0.7, 0.6, 0.7], 0.8, 4.4, 1.2, 2);
  H(4); say('V 向他最喜歡的 B propose', ''); await beat(tok, 1500);
  H(6); move(V, 2.2, 4.4, 0); say('case 1：B 是 free → accept', 'V–B engaged'); await beat(tok, 2200);
  const X = cube('X', J.blue, [0.7, 0.6, 0.7], 0.8, 4.4, 1.6, 2);
  H(7); glow(lB[0], GOLD); glow(lB[3], GRAY);
  say('case 2：X 來 propose，B 更愛 X', 'B 的偏好：X 第 1、V 第 4'); await beat(tok, 2400);
  H(8); move(X, 2.2, 4.4, 0); move(V, 0.8, 3.2, 1.4); glow(V, RED); say('B dump V，改和 X engaged', 'V 回到 free'); await beat(tok, 2200);
  glow(lB[0], null); glow(lB[3], null); glow(V, null);
  move(V, 2.2, 2.0, 0); say('V 改向下一位 A propose，A free → accept', ''); H(6); await beat(tok, 2000);
  const Y = cube('Y', J.blue, [0.7, 0.6, 0.7], 0.8, 2.0, 1.6, 2);
  H(9); glow(lA[1], GOLD); glow(lA[3], GRAY);
  say('case 3：Y 向 A propose，A 更愛 V', 'A reject Y；Y 維持 free'); await beat(tok, 1500);
  move(Y, 2.4, 2.0, 1.2); await beat(tok, 700); move(Y, 0.8, 0.8, 1.6); glow(Y, RED); await beat(tok, 1600);
  H(10); say('沒有 free man 可求婚 → engaged 轉 married', '下一講再證明：會停、正確、stable');
  await beat(tok, 3000);
}]);

// 37:17 5×5 demo：V W X Y Z × A B C D E
FRAG.push(['algjiang1-gs-demo5', 'Gale–Shapley demo：5 男 5 女', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  const B = jBoard(SM5M, SM5F);
  say('5 男 VWXYZ、5 女 ABCDE', '一開始全部 free');
  await beat(tok, 2400);
  const { st } = jGS(SM5M, SM5F);
  const cnt = tag('', 'ptr alt', 0, 0);
  let k = 0;
  for (const [m, w, kind, o] of st) {
    k++; txt(cnt, '第 ' + k + ' 次 propose');
    glow(B.ML[m][w], GOLD); glow(B.M[m], GOLD);
    const pl = line(B.M[m].position.x + 0.42, B.y[m], B.W[w].position.x - 0.42, B.y[w], 0.2, J.green);
    say(m + ' → ' + w + '（propose）', kind === 'accept' ? w + ' 是 free' : w + ' 目前和 ' + o + ' engaged');
    await beat(tok, 900); kill(pl);
    if (kind === 'reject') { glow(B.WL[w][m], RED); glow(B.WL[w][o], GREEN); say(w + ' 比較喜歡 ' + o + ' → reject ' + m, m + ' 維持 free'); }
    else if (kind === 'dump') { glow(B.WL[w][m], GREEN); glow(B.WL[w][o], RED); B.unlink(o); B.link(m, w); say(w + ' 更愛 ' + m + ' → dump ' + o, o + ' 回到 free'); }
    else { B.link(m, w); say(w + ' accept ' + m, m + '–' + w + ' engaged'); }
    await beat(tok, 1200); B.off();
  }
  kill(cnt);
  say('全部 engaged → stable matching', 'V–A、W–C、X–B、Y–E、Z–D');
  for (const m of B.men) glow(B.M[m], GREEN);
  await beat(tok, 3200);
}]);

// 43:00 / 84:05 兩個方向：男生從最愛往下 propose；女生的對象一路 trade up
FRAG.push(['algjiang1-gs-directions', '男生由最愛往下求婚；女生一路往上換', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  const B = jBoard(SM5M, SM5F);
  const { st } = jGS(SM5M, SM5F);
  const pm = tag('', 'ptr', 0, 0), pw = tag('', 'ptr alt', 0, 0);
  showL(pm, false); showL(pw, false);
  say('觀察 1：男生從最喜歡的開始求婚', '被拒才往下一位');
  showL(pm, true);
  let p = B.ML.Y.A.position; pm.position.set(p.x, p.y + 0.6, 0); txt(pm, 'Y');
  for (const [m, w] of st) if (m === 'Y') { p = B.ML.Y[w].position; pm.position.set(p.x, p.y + 0.6, 0); glow(B.ML.Y[w], GOLD); await beat(tok, 900); }
  say('Y：A → D → C → B → E', '只會往右（越來越不喜歡）');
  await beat(tok, 2200);
  say('觀察 2：女生一 engaged 就不再 free', '只會換到更喜歡的人');
  showL(pw, true); txt(pw, 'D');
  for (const [m, w, kind] of st) if (w === 'D' && kind !== 'reject') { p = B.WL.D[m].position; pw.position.set(p.x, p.y + 0.6, 0); glow(B.WL.D[m], GREEN); await beat(tok, 1100); }
  say('D：W → Y → Z', '從後面一路 trade up 到前面');
  await beat(tok, 2200);
  say('兩個方向相反', '男生往下、女生往上');
  await beat(tok, 2200);
  say('男生 propose：對男生最好', '對女生最差；女生 propose 則相反');
  await beat(tok, 3000);
}]);

// 46:28 應用：大學聯考分發（考生 = 提出方）、醫學院畢業生選醫院
FRAG.push(['algjiang1-gs-admission', '應用：考生 propose，系所 accept / reject', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const S = ['S1', 'S2', 'S3', 'S4'], D = { 甲系: 1, 乙系: 2, 丙系: 1 };
  const SP = { S1: ['甲系', '乙系'], S2: ['甲系', '丙系'], S3: ['乙系', '甲系', '丙系'], S4: ['甲系', '乙系'] };
  const DR = { 甲系: ['S2', 'S1', 'S4', 'S3'], 乙系: ['S1', 'S4', 'S3', 'S2'], 丙系: ['S2', 'S3', 'S1', 'S4'] };
  tag('（示意例子）', 'idx', 0, 6.6);
  const sc = {}; S.forEach((s, i) => { sc[s] = cube(s, J.blue, [0.8, 0.7, 0.8], -5, 5 - i * 1.2, 0, 2); });
  const dx = { 甲系: -0.4, 乙系: 2.4, 丙系: 5.2 }, hold = { 甲系: [], 乙系: [], 丙系: [] };
  for (const d in D) { cube(d + '（名額 ' + D[d] + '）', J.pink, [2.4, 0.6, 1.2], dx[d], 0.3, 0); }
  say('考生像 GS 的男生：主動 propose', '系所像女生：只能 accept / reject');
  await beat(tok, 2600);
  const nx = { S1: 0, S2: 0, S3: 0, S4: 0 }, free = [...S];
  const place = (d) => hold[d].forEach((s, k) => move(sc[s], dx[d] - 0.45 + k * 0.9, 1.2, 0));
  while (free.length) {
    const s = free.shift(); const d = SP[s][nx[s]++];
    move(sc[s], dx[d], 2.6, 1); say(s + ' 填 ' + d, ''); await beat(tok, 900);
    hold[d].push(s); hold[d].sort((a, b) => DR[d].indexOf(a) - DR[d].indexOf(b));
    if (hold[d].length > D[d]) {
      const out = hold[d].pop(); glow(sc[out], RED);
      say(d + ' 名額滿：退掉排名最後的 ' + out, out + ' 改填下一志願');
      place(d); move(sc[out], -5, 5 - S.indexOf(out) * 1.2, 0); free.push(out);
      await beat(tok, 1500); glow(sc[out], null);
    } else { place(d); say(d + ' 暫時保留 ' + s, '還可以再換更好的'); await beat(tok, 1100); }
  }
  say('放榜：以考生的最大利益為出發點', '大考分發本質上仍是 Gale–Shapley');
  await beat(tok, 3000);
}]);

// 50:02 / 52:49 interval scheduling（選最多）與 weighted（weight 和最大）；params.weighted
FRAG.push(['algjiang1-interval', 'Interval scheduling：不重疊、選最多', async (tok) => {
  const wt = !!(ctx.params || {}).weighted;
  fresh([0, 6, 14], [0, 2.8, 0]);
  const J6 = [['A', 0, 3, 1], ['B', 2, 5, 5], ['C', 4, 7, 1], ['D', 6, 9, 5], ['E', 8, 11, 1], ['F', 1, 10, 2]];
  const X = (t) => -5.5 + t;
  line(X(0), 0.05, X(11), 0.05, 2.6, '#6e5f49');
  for (let t = 0; t <= 11; t++) tag(String(t), 'idx', X(t), 0, 3.0);
  tag('時間 →', 'idx', X(11) + 0.9, 0, 2.6);
  const bars = {};
  J6.forEach(([n, s, f, w], i) => {
    const y = 5.6 - i * 0.85;
    bars[n] = cube(wt ? n + '（w=' + w + '）' : n, J.blue, [f - s - 0.06, 0.55, 0.9], X((s + f) / 2), y, 0, 2);
  });
  say(wt ? 'Weighted：每個工作有 weight' : '一台機器、一次只能做一件事', wt ? '重要性或賺到的錢' : '每個工作有開始、結束時間');
  await beat(tok, 2600);
  say('選 A 就不能選 B', '區間 overlap'); glow(bars.A, GREEN); glow(bars.B, RED);
  await beat(tok, 2200); glow(bars.A, null); glow(bars.B, null);
  const pick = wt ? ['B', 'D'] : ['A', 'C', 'E'];
  say(wt ? '目標：weight 總和最大' : '目標：選越多工作越好', '選出的工作不能重疊');
  await beat(tok, 1800);
  let tot = 0;
  for (const n of pick) {
    const j = J6.find((q) => q[0] === n); tot += wt ? j[3] : 1;
    glow(bars[n], GOLD); move(bars[n], X((j[1] + j[2]) / 2), 0.4, 1.4);
    say('選 ' + n + '：[' + j[1] + ', ' + j[2] + ']', wt ? '總 weight = ' + tot : '目前 ' + tot + ' 個'); await beat(tok, 1500);
  }
  if (wt) { say('只選 2 個，weight = 10', '選 A、C、E 三個只有 3'); }
  else { say('最佳解：A、C、E 共 3 個', 'Greedy 就能求到最佳解'); }
  await beat(tok, 3000);
}]);

// 55:28 Bipartite matching：有連線才能配；要配出最多對（maximum cardinality）
FRAG.push(['algjiang1-bipartite', 'Bipartite matching：配出最多對', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const L = ['A', 'B', 'C', 'D'], R = ['E', 'F', 'G', 'H'];
  const P = {}; L.forEach((v, i) => { P[v] = cube(v, J.blue, [0.8, 0.7, 0.8], -2.6, 5 - i * 1.3, 0, 2); }); R.forEach((v, i) => { P[v] = cube(v, J.pink, [0.8, 0.7, 0.8], 2.6, 5 - i * 1.3, 0, 2); });
  const E = [['A', 'E'], ['A', 'F'], ['B', 'E'], ['C', 'F'], ['C', 'G'], ['D', 'G'], ['D', 'H']];
  const ln = {};
  say('有連線 = 這兩人可以配在一起', '沒有完整排名，只看能不能接受');
  for (const [a, b] of E) { ln[a + b] = line(-2.2, P[a].position.y, 2.2, P[b].position.y, 0, '#a99470'); await beat(tok, 300); }
  await beat(tok, 1600);
  say('有些人之間不存在配對可能', '例：B 只能配 E');
  glow(P.B, GOLD); glow(P.E, GOLD); await beat(tok, 2000); glow(P.B, null); glow(P.E, null);
  say('目標：配出的對數越多越好', 'maximum cardinality（cardinality = 數量）');
  await beat(tok, 2000);
  const M = [['B', 'E'], ['A', 'F'], ['C', 'G'], ['D', 'H']];
  let k = 0;
  for (const [a, b] of M) { k++; kill(ln[a + b]); line(-2.2, P[a].position.y, 2.2, P[b].position.y, 0.05, J.eng); glow(P[a], GREEN); glow(P[b], GREEN); say(a + '–' + b, '目前 ' + k + ' 對'); await beat(tok, 1100); }
  say('4 對：每人都配到 → perfect matching', 'Network Flow 可以解');
  await beat(tok, 3000);
}]);

// 58:27 Independent set：選出彼此沒有連線的點，越多越好（1、4、5、6）
FRAG.push(['algjiang1-indep-set', 'Independent set：選彼此沒連線的點', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const pos = { 1: [-1.5, 3], 2: [-3.4, 0.8], 3: [0.4, 0.8], 4: [-5, -1.6], 5: [-2.5, -1.6], 6: [2.2, -1.6], 7: [0, -3.4] };
  const E = [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7], [4, 7], [5, 7], [6, 7]];
  const N = {};
  for (const v in pos) N[v] = cube(v, J.blue, [0.8, 0.8, 0.8], pos[v][0], 0.4, pos[v][1], 2);
  for (const [a, b] of E) jLine3(pos[a][0], 0.4, pos[a][1], pos[b][0], 0.4, pos[b][1]);
  say('點 = 物體或人；連線 = 有關係', 'independent = 沒有關係');
  await beat(tok, 2600);
  glow(N[1], GREEN); say('選了 1', '');
  await beat(tok, 1200);
  tint(N[2], GRAY); tint(N[3], GRAY); say('和 1 相連的 2、3 不能選', ''); await beat(tok, 2000);
  say('4、5、6、7 跟 1 沒有關係', '都可以考慮'); await beat(tok, 1800);
  for (const v of [4, 5, 6]) { glow(N[v], GREEN); say('選 ' + v, ''); await beat(tok, 900); }
  tint(N[7], GRAY); say('7 和 4、5、6 都相連 → 不能選', ''); await beat(tok, 2000);
  say('最大 independent set：{1, 4, 5, 6}', '4 個點；這題是 NP-complete');
  await beat(tok, 3000);
}]);

// 60:28 Competitive facility location：兩人輪流拿，拿了的鄰居不能再拿
FRAG.push(['algjiang1-facility', 'Competitive facility location：輪流拿分', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const V = [10, 1, 5, 15, 5, 1, 5, 1, 15, 10];
  const X = (i) => -5.85 + i * 1.3;
  const cs = V.map((v, i) => cube(v, J.sand, [0.9, 0.7, 0.9], X(i), 0.35, 0, 2));
  for (let i = 0; i < 9; i++) line(X(i) + 0.45, 0.35, X(i + 1) - 0.45, 0.35, 0);
  tag('（示意分數）', 'idx', 0, 0, 1.4);
  say('一條線上的點，各有分數', '兩位玩家輪流拿');
  await beat(tok, 2400);
  say('規則：拿走一點後，它的鄰居不能再拿', '不管是誰拿的');
  await beat(tok, 2200);
  const moves = [[3, 'P1'], [8, 'P2'], [0, 'P1'], [6, 'P2']];
  const sc = { P1: 0, P2: 0 }; const blk = new Set();
  const st = tag('P1 = 0　P2 = 0', 'ptr alt', 0, 3.2);
  for (const [i, p] of moves) {
    sc[p] += V[i]; tint(cs[i], p === 'P1' ? J.blue : J.orange); move(cs[i], X(i), 1.3, 0);
    const nb = [i - 1, i + 1].filter((j) => j >= 0 && j < V.length && !blk.has(j));
    say(p + ' 拿 ' + V[i], nb.length ? '鄰居 ' + nb.map((j) => V[j]).join('、') + ' 不能再拿' : '');
    await beat(tok, 900); nb.forEach((j) => { blk.add(j); tint(cs[j], GRAY); });
    txt(st, 'P1 = ' + sc.P1 + '　P2 = ' + sc.P2); await beat(tok, 1300);
  }
  say('沒得拿了：這一局 P2 拿到 20', '問題：後手最多能保證拿幾分？');
  await beat(tok, 2400);
  say('老師：後手可以保證 20 分', '這題是 PSPACE-complete');
  await beat(tok, 3000);
}]);

// 63:02 五個代表性問題：難易度與對應技巧
FRAG.push(['algjiang1-five-map', '五個代表性問題：難易度與技巧', async (tok) => {
  fresh([0, 6, 14], [0, 2.8, 0]);
  const P = [['Interval scheduling', 'Greedy', 1], ['Weighted interval', 'Dynamic Programming', 1], ['Bipartite matching', 'Network Flow', 1], ['Independent set', 'NP-complete', 0], ['Facility location', 'PSPACE-complete', 0]];
  say('五個代表性問題，難度不同', '');
  await beat(tok, 1600);
  for (let i = 0; i < 5; i++) {
    const y = 5.6 - i * 1.1, ez = P[i][2];
    jCard(P[i][0], J.blue, -3.2, y, 0, 3.6, 3, 0.6); await beat(tok, 500);
    const a = arrow(V3(-1.2, y, 0), V3(0.8, y, 0));
    const t = jCard(P[i][1], ez ? J.green : J.red, 3.2, y, 0, 3.6, 2, 0.6);
    say(P[i][0] + ' → ' + P[i][1], ez ? '有效率的時間內可解' : '屬於比較難的問題');
    await beat(tok, 1700);
  }
  say('前三個「簡單」、後兩個「難」', 'NP-complete、PSPACE-complete 學期後面再談');
  await beat(tok, 3000);
}]);

// 69:40 Formulation：人名換成 1..n，偏好表只剩一串數字；接著要證的事
FRAG.push(['algjiang1-pref-numbers', 'Formulation：偏好表只剩一串數字', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.8, 0]);
  const B = jBoard(SM3M, SM3F);
  say('input：n 個男生、n 個女生', '加上每個人完整、不平手的偏好表');
  await beat(tok, 2600);
  const num = { X: 1, Y: 2, Z: 3, A: 1, B: 2, C: 3 };
  say('男女都編號成 1 到 n', '偏好表就只是 a sequence of numbers');
  for (const m of B.men) { relabel(B.M[m], num[m]); for (const w in B.ML[m]) relabel(B.ML[m][w], num[w]); await beat(tok, 500); }
  for (const w of B.wom) { relabel(B.W[w], num[w]); for (const m in B.WL[w]) relabel(B.WL[w][m], num[m]); await beat(tok, 500); }
  await beat(tok, 1800);
  const G = ['停得下來：≤ n² 次', 'perfect matching', 'stable', '對男生最好', '順序不影響結果'];
  const cs = [];
  for (let i = 0; i < G.length; i++) { cs.push(jCard(G[i], i < 3 ? J.blue : J.sand, -5.2 + i * 2.6, 0.6, 1.6, 2.4, 3, 0.55)); await beat(tok, 400); }
  say('接下來要證明：會停、perfect、stable', '再看額外性質');
  await beat(tok, 3000);
}]);

// 73:38 Pseudocode 的寫法：名稱、編號、關鍵字；先證明分析再寫程式
FRAG.push(['algjiang1-pseudo-style', 'Pseudocode 怎麼寫：名稱、行號、關鍵字', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.8, 0]);
  const cd = code(['Gale-Shapley(preference lists)', '1 initialize each person to be free', '2 while (some man is free and ...)', '3   choose such a man m', '4   w = 1st woman m hasn\'t proposed to', '5   if w is free', '6     (m, w) engaged', '7   else if w prefers m to fiancé m\'', '8     (m, w) engaged; m\' free', '9 return engaged pairs'], -2.4, 6.4, 0.55);
  const nt = tag('', 'ptr alt', 4.2, 6.4);
  const steps = [[0, '名稱(input / output 參數)', '先替 procedure 取名字'], [1, '每一行都要編號', '討論時說「第 2 行」不會誤解'], [2, 'while / for / if / else / return', '用關鍵字寫比較容易'], [4, '一行 = C 的好幾行', '抽象層次比較高'], [5, '任何人照做結果都一樣', '而且紙筆做得到']];
  for (const [i, t, s] of steps) { cd.hl(i); nt.position.set(4.2, 6.4 - i * 0.55, 0); txt(nt, '← ' + t); say(t, s); await beat(tok, 2400); }
  cd.hl(-1); kill(nt);
  const a = jCard('證明正確', J.blue, -3.6, 0.6, 1.4, 2.4, 3, 0.55), b = jCard('分析夠快', J.blue, 0, 0.6, 1.4, 2.4, 3, 0.55), c = jCard('才寫程式', J.green, 3.6, 0.6, 1.4, 2.4, 3, 0.55);
  arrow(V3(-2.3, 0.6, 1.4), V3(-1.3, 0.6, 1.4)); arrow(V3(1.3, 0.6, 1.4), V3(2.3, 0.6, 1.4));
  say('先有 procedure、證明、分析', '不要一開始就打開電腦寫程式');
  await beat(tok, 3200);
}]);

// 79:02 Termination：每圈一次 propose，每個男生最多 n 次 → ≤ n² 圈
FRAG.push(['algjiang1-n2-proposals', 'GS 最多 n² 次 iteration 就停', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  const men = 'VWXYZ'.split(''), wom = 'ABCDE'.split('');
  const X = (k) => -2 + k * 1.0, Y = (i) => 5.2 - i * 1.0;
  men.forEach((m, i) => tag(m, 'ptr', -3.3, Y(i)));
  wom.forEach((w, k) => tag(w, 'idx', X(k), 6.1));
  const cell = {};
  men.forEach((m, i) => wom.forEach((w, k) => { cell[m + w] = cube('', J.paper, [0.85, 0.2, 0.85], X(k), Y(i), 0); }));
  say('數 free man 有幾次？不好算', '男生會 free ↔ engaged 來回');
  await beat(tok, 2600);
  say('換個角度：每圈一定恰好一次 propose', '一格 = 一個 (男, 女) proposal');
  await beat(tok, 2200);
  const { st } = jGS(SM5M, SM5F);
  const cnt = tag('', 'ptr alt', 4.6, 3.2);
  let k = 0;
  for (const [m, w, kind] of st) { k++; const c = cell[m + w]; tint(c, kind === 'reject' ? J.red : J.green); c.scale.y = 3; txt(cnt, 'iteration ' + k); await beat(tok, 420); }
  say('demo 用了 14 次，沒有一格用兩次', '男生不會向同一個女生求婚兩次');
  await beat(tok, 2400);
  say('每個男生最多 n 次，共 n 個男生', '最多 n × n = n² 次 → 一定會停');
  txt(cnt, '≤ 5 × 5 = 25');
  await beat(tok, 3000);
}]);

// 88:05 Perfect matching 的反證法
FRAG.push(['algjiang1-perfect-proof', '反證：結束時不會有男生 free', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const men = 'VWXYZ'.split(''), wom = 'ABCDE'.split('');
  const Mx = (i) => -4 + i * 2, M = {}, W = {};
  men.forEach((m, i) => { M[m] = cube(m, J.blue, [0.8, 0.7, 0.8], Mx(i), 4.6, 0); });
  wom.forEach((w, i) => { W[w] = cube(w, J.pink, [0.8, 0.7, 0.8], Mx(i), 0.6, 0); });
  say('反證法：先假設相反的結果', '假設結束時有男生 m 是 free');
  glow(M.Z, RED); await beat(tok, 2600);
  for (const [a, b] of [['V', 'A'], ['W', 'B'], ['X', 'C'], ['Y', 'D']]) line(M[a].position.x, 4.25, W[b].position.x, 0.95, 0, J.eng);
  say('while 停了 → 條件不成立', 'Z 是 free，所以 Z 已向所有女生求過婚');
  const ar = []; for (const w of wom) { ar.push(line(M.Z.position.x, 4.25, W[w].position.x, 0.95, 0.15, J.green)); await beat(tok, 300); }
  await beat(tok, 1800);
  ar.forEach(kill);
  say('n 個男生、n 個女生，有男生 free', '→ 至少有一個女生 free');
  glow(W.E, RED); await beat(tok, 2400);
  say('女生被求過婚就一直 engaged', '所以 E 從來沒被求婚過');
  await beat(tok, 2400);
  const ll = line(M.Z.position.x, 4.25, W.E.position.x, 0.95, 0.15, J.red);
  say('但 Z 已向所有女生求過婚，包括 E', '矛盾！');
  await beat(tok, 2600);
  kill(ll); glow(M.Z, GREEN); glow(W.E, GREEN); line(M.Z.position.x, 4.25, W.E.position.x, 0.95, 0, J.eng);
  say('假設錯誤：結束時每個男生都配到', 'GS 的結果是 perfect matching');
  await beat(tok, 3000);
}]);

// 96:01 Stable matching 不唯一：男生 propose vs 女生 propose
FRAG.push(['algjiang1-two-stable', 'Stable matching 不唯一', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.8, 0]);
  const B = jBoard(SM3M, SM3F);
  say('同一個 input，stable matching 唯一嗎？', '');
  await beat(tok, 2200);
  const r1 = jGS(SM3M, SM3F).hm;
  for (const m of B.men) { B.link(m, r1[m], J.eng); await beat(tok, 600); }
  say('男生 propose：X–A、Y–B、Z–C', 'stable，而且對男生最好');
  await beat(tok, 2600);
  const r2 = jGS(SM3F, SM3M).hm;
  const L2 = []; for (const w in r2) { const m = r2[w]; L2.push(line(B.M[m].position.x + 0.42, B.y[m] - 0.15, B.W[w].position.x - 0.42, B.y[w] - 0.15, 0.2, J.orange)); await beat(tok, 600); }
  say('女生 propose：A–Y、B–X、C–Z', '這也是 stable');
  await beat(tok, 2800);
  say('至少兩種 → stable matching 不唯一', '男生 propose → 男生最優；女生 propose → 女生最優');
  await beat(tok, 3000);
}]);
  }

  // ═══ algjiang2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── OVhJHBYJLSE：交大江蕙如 Lec03 Ch1 Stable Matching 證明；rP2wm4bEfXo：Lec04 Ch2 Algorithm Analysis ───
const J2 = { man: '#4b9ee2', wom: '#e55a9b', ok: '#2fc092', bad: '#d64545', sand: '#c9b48e', gold: '#c08a1f', purple: '#9b7ef4', orange: '#dd8238' };
const j2p = (name, color, x, y, drop = 0) => cube(name, color, [1.2, 0.8, 0.8], x, y, 0, drop);
const j2link = (a, b, color) => line(a.position.x + (a.position.x < b.position.x ? 0.62 : -0.62), a.position.y, b.position.x + (a.position.x < b.position.x ? -0.62 : 0.62), b.position.y, 0, color || '#3a3226');
const j2bar = (label, color, x, h, w = 1.2) => { const m = cube('', color, [w, Math.max(0.05, h), 1], x, Math.max(0.05, h) / 2); const l = tag(label, 'idx', x, -0.45); return { m, l }; };

// ══════════ Lec03：Stable Matching 證明 ══════════
FRAG.push(['algjiang2-gs-states', 'Gale-Shapley 回顧：free → engaged → married', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const cd = code(['1  所有人 free', '2  while 有 free 男生 m 還沒求過所有人', '3    m 向還沒求過、排最前的 w propose', '4-8  w free → accept；否則比較 m 與 fiancé', '9  output 所有 engaged 配對 = S'], 0, 8.0, 0.48);
  const m1 = j2p('m1', J2.man, -3.2, 4.4, 4), m2 = j2p('m2', J2.man, -3.2, 2.0, 4);
  const w1 = j2p('w1', J2.wom, 3.2, 4.4, 4), w2 = j2p('w2', J2.wom, 3.2, 2.0, 4);
  const st = { m1: tag('free', 'idx', -5.4, 4.4), m2: tag('free', 'idx', -5.4, 2.0), w1: tag('free', 'idx', 5.4, 4.4), w2: tag('free', 'idx', 5.4, 2.0) };
  tag('m1、m2：w1 > w2', 'idx', -3.2, 0.7); tag('w1：m2 > m1｜w2：m1 > m2', 'idx', 3.2, 0.7);
  cd.hl(0);
  say('一開始大家都是 free', '補充小例子：2 男 2 女');
  await beat(tok, 2200);
  cd.hl(2); let a = arrow(V3(-2.5, 4.6, 0), V3(2.5, 4.6, 0), 0x2f6fb0);
  say('m1 向最愛的 w1 propose', 'w1 是 free → 馬上 accept');
  await beat(tok, 1600);
  kill(a); let L1 = j2link(m1, w1); txt(st.m1, 'engaged'); txt(st.w1, 'engaged');
  await beat(tok, 1000);
  cd.hl(3); a = arrow(V3(-2.5, 2.2, 0), V3(2.5, 4.1, 0), 0x2f6fb0); glow(w1, GOLD);
  say('m2 也向 w1 propose', 'w1 比較：m2 > 目前的 fiancé m1');
  await beat(tok, 2400);
  kill(a); kill(L1); j2link(m2, w1); glow(w1, null); glow(m1, RED);
  txt(st.m1, 'free'); txt(st.m2, 'engaged');
  say('w1 換人：dump 掉 m1', '女生一直 engaged，只是對象會換');
  await beat(tok, 2600);
  glow(m1, null); cd.hl(2); j2link(m1, w2); txt(st.m1, 'engaged'); txt(st.w2, 'engaged');
  say('m1 改求下一位 w2 → accept', '男生在 free 與 engaged 之間切換');
  await beat(tok, 2400);
  cd.hl(4); for (const k in st) txt(st[k], 'married');
  [m1, m2, w1, w2].forEach((p) => glow(p, GREEN));
  say('沒有 free 男生 → 全部 married', 'S = {(m1, w2), (m2, w1)}');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-n2-proposals', 'Termination：最多 n² 次 propose', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.3]);
  const N = 4, X = (j) => -2.4 + j * 1.6, Z = (i) => -2.4 + i * 1.6, cells = [];
  for (let i = 0; i < N; i++) { tag('m' + (i + 1), 'ptr', -4.3, 0.2, Z(i)); tag('w' + (i + 1), 'ptr alt', X(i), 0.2, -4.1); }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const t = cube('', GRAY, [1.3, 0.12, 1.3], X(j), 0.06, Z(i)); cells.push({ i, j, t }); }
  const cnt = tag('propose 0 次', 'ptr alt', 4.6, 0.4, 0);
  say('要證兩件事：正確 + 會停', 'correct = perfect + stable；termination');
  await beat(tok, 2600);
  say('每個 iteration 一定有一個男生 propose', '同一個男生不會向同一位女生求兩次');
  const order = [[0, 0], [1, 0], [2, 1], [1, 2], [3, 0], [0, 1]]; let k = 0;
  for (const [i, j] of order) { cube('', J2.man, [1.0, 0.5, 1.0], X(j), 0.4, Z(i), 3); k++; txt(cnt, 'propose ' + k + ' 次'); await beat(tok, 550); }
  say('倒過來數：可能的 proposal 有幾個？', '每格 (m, w) 最多用一次');
  await beat(tok, 2200);
  for (const c of cells) { if (order.some(([i, j]) => i === c.i && j === c.j)) continue; cube('', J2.orange, [1.0, 0.5, 1.0], X(c.j), 0.4, Z(c.i), 3); k++; txt(cnt, 'propose ' + k + ' 次'); await beat(tok, 220); }
  say('最差：每個男生都向每個女生求過', 'n × n 格用完 → n = 4 時 ≤ 16 次');
  await beat(tok, 2600);
  say('所以最多 n² 次 iteration 一定停', 'Perfect（每人都配到）上次用反證法證過');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-not-greedy', 'Gale-Shapley 是 greedy 嗎？', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.6, 0]);
  tag('Greedy algorithm', 'ptr', -4, 6.2); tag('Gale-Shapley', 'ptr alt', 3.6, 6.2);
  line(0, 0, 0, 6.6, 0, '#a99470');
  say('同學問：GS 很像 greedy？', '男生從最愛開始求，女生只挑更喜歡的');
  await beat(tok, 2600);
  const ds = [];
  for (let k = 0; k < 3; k++) { ds.push(cube('d' + (k + 1), J2.sand, [1.1, 0.8, 1.0], -5.4 + k * 1.6, 3.2, 0, 3)); await beat(tok, 500); }
  say('Greedy：step by step，每步選當下最好', '');
  await beat(tok, 2000);
  ds.forEach((d) => tint(d, J2.ok)); tag('決定後不反悔', 'idx', -3.8, 2.2);
  say('而且做完決定就不再反悔', '可證明每步都會留在最終 optimal 解裡');
  await beat(tok, 2800);
  const m1 = j2p('m1', J2.man, 1.8, 4.2, 3), w1 = j2p('w1', J2.wom, 5.2, 3.2, 3);
  let L = j2link(m1, w1);
  say('GS：w1 先 accept m1', '');
  await beat(tok, 1800);
  const m2 = j2p('m2', J2.man, 1.8, 2.2, 3);
  await beat(tok, 700);
  kill(L); j2link(m2, w1); glow(m1, RED);
  say('之後遇到更喜歡的 m2 就換人', '<span class="no">之前的決定被 revisit</span>');
  await beat(tok, 2800);
  say('有 greedy 本質，但不算 greedy', 'greedy 會在後面章節正式介紹');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-contradiction', '反證法：假設相反 → 推出矛盾', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.4, 0]);
  const P = ctx.params || {};
  const xs = [-4.8, -1.6, 1.6, 4.8];
  const a = cube('假設 ¬P', J2.bad, [2.2, 0.9, 1.1], xs[0], 2.0, 0, 4);
  say(P.principles ? '一樣用反證法，先假設相反' : '本章的證明招數：反證法', '要證 P：先 suppose 相反的 ¬P');
  await beat(tok, 2400);
  const ar1 = arrow(V3(xs[0] + 1.2, 2, 0), V3(xs[1] - 1.2, 2, 0));
  const b = cube('推演', J2.sand, [2.0, 0.9, 1.1], xs[1], 2.0, 0, 4);
  say('從假設出發做 deduction', P.principles ? '理由一定要來自 procedure 的某一行' : '每一步都要有根據');
  await beat(tok, 2400);
  const ar2 = arrow(V3(xs[1] + 1.1, 2, 0), V3(xs[2] - 1.1, 2, 0));
  const c = cube('⇄ 矛盾', J2.bad, [2.0, 0.9, 1.1], xs[2], 2.0, 0, 4); glow(c, RED);
  say('推出矛盾（兩個相反的箭頭）', 'contradiction');
  await beat(tok, 2400);
  fly(a, V3(-2, 8, 3));
  const d = cube('P 成立', J2.ok, [2.0, 0.9, 1.1], xs[3], 2.0, 0, 4); arrow(V3(xs[2] + 1.1, 2, 0), V3(xs[3] - 1.1, 2, 0));
  say('矛盾來自假設 → 假設錯', '所以 P 成立，得證');
  await beat(tok, 2600);
  if (P.principles) {
    const cd = code(['證演算法正確性：', '1. 理由要咬著 procedure 的 statement', '2. 用上所有條件：定義、procedure 行為'], 0, 6.4, 0.5);
    cd.hl(1);
    say('不能用 procedure 以外的理由', '否則證的就不是這個演算法');
    await beat(tok, 2800);
    cd.hl(2);
    say('多半靠定義推出結論', '例：valid partner、best(m) 的定義');
    await beat(tok, 2800);
  } else {
    tag('要證：line 9 輸出的 S 是 stable', 'ptr alt', 0, 4.6);
    say('證明通常不超過一頁投影片', '接著：假設 S 不 stable');
    await beat(tok, 3000);
  }
}]);

function j2four(drop = 3) {
  const m = j2p('m', J2.man, -3.2, 5.0, drop), mp = j2p('m′', J2.man, -3.2, 2.8, drop);
  const w = j2p('w', J2.wom, 3.2, 5.0, drop), wp = j2p('w′', J2.wom, 3.2, 2.8, drop);
  return { m, mp, w, wp };
}
FRAG.push(['algjiang2-unstable-pair', 'Stability 證明：假設 S 裡有 unstable pair', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  say('反證：假設 GS 輸出的 S 不 stable', 'S = line 9 輸出的 engaged 配對');
  const P = j2four(4);
  await beat(tok, 2400);
  j2link(P.m, P.w); j2link(P.mp, P.wp);
  say('黑線：S 的配對結果', 'm–w、m′–w′');
  await beat(tok, 2200);
  line(-2.6, 4.9, 2.6, 2.9, 0, '#c0392b'); glow(P.m, RED); glow(P.wp, RED);
  say('一定找得到一對 m、w′ 互相更喜歡', 'm：w′ > w；w′：m > m′');
  await beat(tok, 3000);
  glow(P.m, null); glow(P.wp, null);
  const xs = [-3.0, -1.0, 1.0, 3.0], names = ['x', 'y', 'z', 'w'], cs = [];
  tag('m 的 propose 順序', 'idx', -5.2, 7.4);
  for (let k = 0; k < 4; k++) cs.push(cube(names[k], k === 3 ? J2.wom : GRAY, [1.0, 0.6, 0.6], xs[k], 7.4, 0));
  const cur = tag('▼', 'ptr', xs[0], 8.2);
  say('m 由愛到不愛依序 propose', '被拒絕就換下一位');
  for (let k = 0; k < 3; k++) { cur.position.x = xs[k]; await beat(tok, 700); glow(cs[k], RED); await beat(tok, 300); }
  cur.position.x = xs[3]; glow(cs[3], GREEN);
  await beat(tok, 900);
  say('m 最後停在最後 propose 的 w', '問題：m 之前有沒有向 w′ propose 過？');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-stable-cases', 'Stability 證明：兩種 case 都矛盾', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.4, 0]);
  const P = j2four(0);
  j2link(P.m, P.w); j2link(P.mp, P.wp); line(-2.6, 4.9, 2.6, 2.9, 0, '#c0392b');
  say('分 case：m 有沒有向 w′ propose 過？', 'm、w′ 互相更喜歡對方（假設）');
  await beat(tok, 2600);
  const l1 = cube('w', J2.wom, [0.9, 0.6, 0.6], -4.2, 7.4, 0, 2), l2 = cube('w′', GRAY, [0.9, 0.6, 0.6], -2.6, 7.4, 0, 2), lt = tag('m 的 list：w 排在 w′ 前', 'idx', -3.4, 6.6);
  say('Case 1：沒求過 w′ 就停在 w', 'm 由愛到不愛 → m 喜歡 w 勝過 w′');
  await beat(tok, 2600);
  glow(l1, RED); glow(l2, RED);
  say('跟「m 喜歡 w′」相反 ⇄ 矛盾', '');
  await beat(tok, 2000);
  [l1, l2, lt].forEach(kill);
  const ar = arrow(V3(-2.5, 4.6, 0), V3(2.5, 3.1, 0), 0xc0392b);
  say('Case 2：求過 w′，但被 w′ 拒絕', '女生拒絕一定是因為更喜歡的 m″');
  await beat(tok, 2400);
  kill(ar);
  const mpp = j2p('m″', J2.purple, -3.2, 0.8, 4); const Lpp = line(-2.6, 0.9, 2.6, 2.7, 0, '#c08a1f');
  await beat(tok, 1200);
  glow(P.mp, GOLD);
  say('若 m″ 就是 m′：w′ 喜歡 m′ 勝過 m', '⇄ 假設 w′ 喜歡 m 勝過 m′');
  await beat(tok, 2800);
  glow(P.mp, null);
  const lad = [tag('w′ 的 list', 'idx', 5.6, 6.6), tag('m′', 'ptr alt', 5.6, 5.9), tag('m″', 'ptr', 5.6, 5.2), tag('m', 'ptr', 5.6, 4.5)];
  say('若 m″ 是別人：w′ 最後配到 m′', '女生只會換更喜歡的 → m′ > m″ > m');
  await beat(tok, 3000);
  glow(P.wp, RED);
  say('又得到 w′ 喜歡 m′ 勝過 m ⇄ 矛盾', '');
  await beat(tok, 2200);
  [mpp, Lpp, ...lad].forEach(kill); glow(P.wp, null);
  [P.m, P.mp, P.w, P.wp].forEach((p) => glow(p, GREEN));
  say('兩種 case 都矛盾 → S 是 stable', '≤ n² 次一定停 + 輸出 stable matching');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-valid-best', 'Valid partner、best(m) 與 male-optimal', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.6, 0]);
  say('Stable matching 不是唯一解', '同樣的 preference list 可能有好幾種 stable 結果');
  await beat(tok, 2600);
  tag('m 的 preference list（左 = 最愛）', 'ptr', 0, 4.6);
  const ws = [];
  for (let k = 0; k < 6; k++) { ws.push(cube('w' + (k + 1), J2.wom, [1.2, 0.8, 0.8], -5 + k * 2, 2.6, 0, 3)); await beat(tok, 250); }
  say('m 的女生由最愛排到最不愛', '');
  await beat(tok, 1600);
  [0, 1, 5].forEach((k) => tint(ws[k], GRAY)); [2, 3, 4].forEach((k) => tint(ws[k], J2.ok));
  const vz = ghostBox('#2fc092', 6.0, 1.4, 1.2); vz.position.set(1, 2.6, 0); tag('valid partners', 'idx', 1, 1.6);
  say('valid partner：有 stable 解能配在一起', '前幾名可能永遠追不到');
  await beat(tok, 3000);
  glow(ws[2], GOLD); tag('best(m)', 'ptr alt', ws[2].position.x, 3.6);
  say('valid 裡排最前面的 = best(m)', '');
  await beat(tok, 2200);
  say('S*：每個男生都配到自己的 best(m)', 'GS 的輸出就是 S* → male-optimal');
  await beat(tok, 2800);
  say('best(m) 唯一 → 誰執行結果都一樣', '對女生則是最差的（female-pessimal）');
  await beat(tok, 3000);
  say('男女互換、改由女生 propose', '結果就變成對女生 optimal');
  await beat(tok, 2600);
}]);

FRAG.push(['algjiang2-mopt-first-reject', 'Male-optimal 證明（1）：第一次被 valid partner 拒絕', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.4, 0]);
  say('反證：某次執行 E 有男生沒配到 best', 'suppose 與要證的結果相反');
  await beat(tok, 2400);
  tag('執行 E 的 iterations', 'idx', -5.6, 7.9);
  const its = [];
  for (let k = 0; k < 8; k++) its.push(cube('', J2.sand, [0.9, 0.5, 0.6], -5.6 + k * 1.6, 7.2, 0));
  say('他一定曾被某個 valid partner 拒絕', '否則由愛到不愛求，一定配到 best');
  await beat(tok, 1400);
  [3, 5, 6].forEach((k) => tint(its[k], J2.bad));
  await beat(tok, 1600);
  glow(its[3], GOLD); tag('第一次', 'ptr alt', its[3].position.x, 8.0);
  say('只挑整個 E 中第一次 valid 拒絕', '那次的男生叫 m、女生叫 w');
  await beat(tok, 2800);
  const m = j2p('m', J2.man, -3.2, 4.6, 3), w = j2p('w', J2.wom, 3.2, 4.6, 3);
  const ar = arrow(V3(-2.5, 4.6, 0), V3(2.5, 4.6, 0), 0xc0392b);
  await beat(tok, 900);
  tag('w = best(m)', 'ptr alt', 3.2, 5.6);
  say('第一次被 valid 拒絕 → w = best(m)', 'best(m) 是 valid 裡排最前面的');
  await beat(tok, 2600);
  kill(ar);
  const mp = j2p('m′', J2.man, -3.2, 2.4, 3); j2link(mp, w);
  say('w 拒絕 m 是因為更喜歡的 m′', '結論 1：w 喜歡 m′ 勝過 m');
  await beat(tok, 2800);
  const sp = ghostBox('#9b7ef4', 4.0, 1.3, 1.2); sp.position.set(4.6, 1.2, 0); tag('S′：m–w 配在一起', 'ptr', 4.6, 1.2);
  say('w 是 valid → 存在 stable matching S′', 'S′ 裡 m 跟 w 配在一起');
  await beat(tok, 3000);
  glow(m, null);
}]);

FRAG.push(['algjiang2-mopt-contra', 'Male-optimal 證明（2）：S′ 裡出現 unstable pair', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.2, 0]);
  tag('S′', 'ptr', -3.3, 6.4);
  const m = j2p('m', J2.man, -5.3, 4.6, 3), w = j2p('w', J2.wom, -1.4, 4.6, 3);
  const mp = j2p('m′', J2.man, -5.3, 2.2, 3), wp = j2p('w′', J2.wom, -1.4, 2.2, 3);
  j2link(m, w);
  say('切到 S′：m 與 w 配在一起', 'S′ 是 stable matching');
  await beat(tok, 2400);
  j2link(mp, wp);
  say('S′ 裡 m′ 總要配到某人 w′', '→ w′ 是 m′ 的 valid partner');
  await beat(tok, 2600);
  tag('回到 E：m′ 的 list', 'ptr alt', 3.6, 6.4);
  const xs = [1.4, 2.9, 4.4, 5.9], L = [];
  ['?', '?', 'w', ''].forEach((s, k) => L.push(cube(s, k === 2 ? J2.wom : J2.sand, [1.1, 0.7, 0.7], xs[k], 4.6, 0, 3)));
  say('E 中 m′ 與 w engaged 的那一刻', '還沒有人被 valid partner 拒絕過');
  await beat(tok, 2800);
  [0, 1].forEach((k) => { tint(L[k], GRAY); relabel(L[k], '✗'); }); tag('invalid', 'idx', 2.15, 3.7);
  say('w 前面的人都拒絕過 m′', '→ 她們都是 invalid（不是 valid）');
  await beat(tok, 2800);
  relabel(L[3], 'w′'); tint(L[3], J2.ok);
  say('w′ 是 valid → 只能排在 w 後面', '結論 2：m′ 喜歡 w 勝過 w′');
  await beat(tok, 2800);
  line(-4.7, 2.3, -2.0, 4.5, 0, '#c0392b'); glow(mp, RED); glow(w, RED);
  say('S′ 裡 m′、w 互相更喜歡對方', '<span class="no">S′ unstable ⇄ S′ 是 stable</span>');
  await beat(tok, 3000);
  say('矛盾 → 每個男生都配到 best(m)', '證明在 E 與 S′ 之間來回切換');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-effective-efficient', '好的演算法：Effective + Efficient', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.6, 0]);
  const v2 = (ctx.params || {}).v === 2;
  say(v2 ? '好演算法第一件事：正確' : 'Stable matching 教我們什麼？', v2 ? '答案錯了就沒有快慢之分' : '先釐清問題的本質，再設計演算法');
  await beat(tok, 2400);
  const L = cube('', J2.ok, [2.2, 0.1, 1.4], -3.2, 0.05, 0);
  tag(v2 ? 'Correct' : 'Effective', 'ptr', -3.2, 5.0);
  await anim(tok, 1200, (t) => { L.scale.y = 1 + t * 39; L.position.y = (0.1 * L.scale.y) / 2; });
  say('靠 logical proof 保證正確', v2 ? '上一單元：反證法、直接推導' : '反證法：簡單、複雜的都能證');
  await beat(tok, 2400);
  if (!v2) {
    tag('yes/no 問題 → 證正確', 'idx', -3.2, 4.4); tag('最佳化問題 → 還要證最佳解', 'idx', -3.2, 3.8);
    say('之後還會談 solution quality', '不只合理，還要證是最好的答案');
    await beat(tok, 2800);
  }
  tag('Efficient', 'ptr alt', 3.2, 5.0);
  const t1 = cube('run time', J2.man, [2.4, 0.9, 1.2], 3.2, 0.45, 0, 4), t2 = cube('memory', J2.purple, [2.4, 0.9, 1.2], 3.2, 1.4, 0, 6);
  say('Efficient：跑得快、memory 用得少', v2 ? 'time complexity + space complexity' : '下一單元細談 efficiency');
  await beat(tok, 2800);
  if (v2) {
    const s = cube('5 對', J2.sand, [1.0, 0.6, 1.0], 1.4, 2.6, 0, 3), b = cube('100 對', J2.orange, [1.0, 2.4, 1.0], 5.0, 3.5, 0, 3);
    say('時間跟 input size 有關', '5 對 vs 100 對：看成長的幅度');
    await beat(tok, 2800);
    [s, b].forEach(kill); glow(t1, GOLD);
    say('本課重點：running time', '用 complexity 看，不用幾分幾秒');
    await beat(tok, 3000);
  } else {
    say('好演算法：effective 又 efficient', '');
    await beat(tok, 2600);
  }
  glow(t2, null);
}]);

// ══════════ Lec04：Algorithm Analysis ══════════
FRAG.push(['algjiang2-trinity', 'Algorithm、Data Structure、Programming 一體三面', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.8, 0]);
  say('本單元兩件事', '① 怎麼分析 efficiency　② GS 怎麼實作才快');
  await beat(tok, 2600);
  const A = cube('Algorithm', J2.gold, [2.8, 0.9, 1.2], 0, 5.0, 0, 3), D = cube('Data Structure', J2.man, [3.2, 0.9, 1.2], -3.6, 1.4, 0, 3), Pg = cube('Programming', J2.purple, [3.0, 0.9, 1.2], 3.6, 1.4, 0, 3);
  await beat(tok, 900);
  line(-0.9, 4.6, -3.0, 1.9); line(0.9, 4.6, 3.0, 1.9); line(-2.0, 1.4, 2.1, 1.4);
  say('三件事是一體三面', '');
  await beat(tok, 2000);
  glow(A, GOLD);
  say('先從 high level 設計演算法', 'logical proof 正確、run time 合理 → 再 implement');
  await beat(tok, 2800);
  glow(A, null); glow(D, RED);
  say('好演算法配錯 data structure → 拖慢', '別人寫很快，你的卻很慢');
  await beat(tok, 2800);
  glow(D, null); glow(Pg, GOLD);
  say('寫程式時三件事同時發生', '所以 programming 實作上最難');
  await beat(tok, 2600);
  glow(Pg, null);
  tag('爛演算法 + 100 分 programmer → 最多 70 分', 'ptr', 0, 7.0); tag('好演算法 + 合理實作 → 85～90 分', 'ptr alt', 0, 6.3);
  say('演算法決定上限', '寫得再好也受限於演算法本身');
  await beat(tok, 3200);
}]);

FRAG.push(['algjiang2-babbage-crank', 'Babbage：轉幾圈 = running time', async (tok) => {
  fresh([0, 4.0, 12], [0, 2.4, 0]);
  const THREE = ctx.THREE;
  cube('Analytical Engine', J2.sand, [4.2, 2.6, 2.0], -1.2, 1.3, 0);
  const g = new THREE.Group(); g.position.set(1.6, 1.6, 1.05); ctx.lab.world.add(g);
  const arm = ctx.lab.box('#6e5f49', [0.25, 1.4, 0.2]); arm.position.set(0, 0.55, 0); g.add(arm);
  const knob = ctx.lab.box(J2.gold, [0.35, 0.35, 0.5]); knob.position.set(0, 1.2, 0.2); g.add(knob);
  const cnt = tag('轉 0 圈', 'ptr alt', 3.6, 3.6);
  say('19 世紀 Babbage：Analytical Engine', '想做一台能運算的機器（經費一直不順）');
  await beat(tok, 2800);
  say('右邊有搖桿，每轉一圈機器動一次', '後人依手稿把機器做出來，真的會動');
  await beat(tok, 2600);
  const spin = async (n, label) => {
    for (let k = 1; k <= n; k++) { await anim(tok, 450, (t) => { g.rotation.z = -2 * Math.PI * (k - 1 + t); }); txt(cnt, label + '：轉 ' + k + ' 圈'); }
  };
  say('完成 task A 要轉幾圈？', '');
  await spin(3, 'A');
  await beat(tok, 800);
  say('task B 要轉更多圈', '');
  await spin(8, 'B');
  await beat(tok, 600);
  say('轉越多圈 → running time 越長', 'A：3 圈 < B：8 圈');
  await beat(tok, 2600);
  say('最早把 efficiency 具體化的想法', '數「步驟」，而不是量幾秒');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-def1-flaws', 'Proposal 1：「在 real input 上跑得快」不夠精確', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.8, 0]);
  say('Proposal 1：real input 上跑得快', 'efficient = 寫成程式後跑真實 instance 很快');
  await beat(tok, 2800);
  tag('同一個程式', 'ptr', -3.8, 6.4);
  const a = j2bar('高速電腦中心', J2.ok, -5.0, 0.8, 1.3), b = j2bar('3 年前 notebook', J2.bad, -2.6, 4.2, 1.3);
  say('換一台機器，run time 差很多', '→ 定義要跟機器無關');
  await beat(tok, 2800);
  const q = [];
  for (let k = 0; k < 3; k++) q.push(cube('?', GRAY, [0.8, 0.8, 0.8], 0.6 + k * 1.0, 5.4, 0, 2));
  say('使用者會餵什麼 input？不知道', '→ 定義要跟 instance 無關');
  await beat(tok, 2800);
  q.forEach(kill);
  tag('A 同學 vs B 同學', 'ptr alt', 3.6, 6.4);
  const A1 = j2bar('A n=100', J2.man, 1.4, 0.6, 0.9), B1 = j2bar('B n=100', J2.purple, 2.6, 0.65, 0.9);
  say('n = 100 時 A、B 跑得差不多', '');
  await beat(tok, 2200);
  const A2 = j2bar('A n=10⁶', J2.man, 4.4, 1.6, 0.9), B2 = j2bar('B n=10⁶', J2.purple, 5.6, 5.0, 0.9); glow(B2.m, RED);
  say('n = 100 萬才分出高下', '→ 要看 run time 隨 input size 的成長');
  await beat(tok, 2800);
  say('三個要求', '跟機器無關、跟 instance 無關、成長趨勢可預測');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-input-2n2', 'Stable matching 的 input size = 2n²', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0, 0.3]);
  const N = 4, X = (base, j) => base + j * 1.1, Z = (i) => -1.8 + i * 1.1;
  say('Stable matching 的 input size？', 'n 個男生、n 個女生，加上 preference lists');
  await beat(tok, 3500);
  tag('男生的 lists', 'ptr', -3.6, 0.3, -3.2); tag('女生的 lists', 'ptr alt', 3.0, 0.3, -3.2);
  for (let i = 0; i < N; i++) { tag('m' + (i + 1), 'idx', -6.2, 0.2, Z(i)); for (let j = 0; j < N; j++) cube('w' + (j + 1), J2.man, [0.95, 0.4, 0.95], X(-5.2, j), 0.2, Z(i), 2); await beat(tok, 400); }
  say('每個男生的 list 長 n', '男生共 n × n 格');
  await beat(tok, 2700);
  for (let i = 0; i < N; i++) { tag('w' + (i + 1), 'idx', 6.4, 0.2, Z(i)); for (let j = 0; j < N; j++) cube('m' + (j + 1), J2.wom, [0.95, 0.4, 0.95], X(1.4, j), 0.2, Z(i), 2); await beat(tok, 400); }
  say('女生也是 n × n 格', 'input size = 2n²');
  await beat(tok, 3500);
  say('running time 寫成 input size 的函數', 'T(n)：給定 n 就能推估，不是一個固定數字');
  await beat(tok, 4000);
}]);

FRAG.push(['algjiang2-worst-avg', 'Worst case vs Average case', async (tok) => {
  fresh([0, 4.0, 13], [0, 2.6, 0]);
  const hs = [1.8, 3.1, 1.2, 5.2, 2.4, 1.6, 3.6, 2.0], bars = [];
  say('不知道使用者會遇到哪些 instance', '公平一點：大家都拿最差的來比');
  await beat(tok, 2600);
  for (let k = 0; k < 8; k++) { bars.push(j2bar('I' + (k + 1), J2.sand, -5.25 + k * 1.5, hs[k], 1.0)); await beat(tok, 300); }
  glow(bars[3].m, RED); tag('worst case', 'ptr', bars[3].m.position.x, 5.9);
  say('Worst case：最差也不過如此', '最差都能接受 → 平常的表現會更滿意');
  await beat(tok, 3000);
  const avg = hs.reduce((s, h) => s + h, 0) / hs.length;
  line(-6.2, avg, 6.2, avg, 0.6, '#2f6fb0'); tag('average', 'ptr alt', 6.0, avg + 0.4);
  say('Average case 要先知道 input 的分布', '理論分析時通常不知道 → 說不清楚');
  await beat(tok, 3000);
  [0, 1, 2].forEach((k) => tint(bars[k].m, J2.ok));
  say('程式競賽：主辦單位給 benchmark', '在這組上取平均 → 實務上會用');
  await beat(tok, 3000);
  say('理論上用 worst-case running time', '某個 instance 跑很好，另一個可能很差');
  await beat(tok, 2800);
}]);

FRAG.push(['algjiang2-brute-baseline', 'Brute force：拿來比較的基準', async (tok) => {
  fresh([0, 4.0, 13], [0, 2.6, 0]);
  const v2 = (ctx.params || {}).v === 2;
  if (!v2) {
    say('跟誰比？找個肉腳：brute force', '把每個可能的答案都試一遍，再挑最好的');
    await beat(tok, 2800);
    const cs = [];
    for (let k = 0; k < 12; k++) cs.push(cube('', GRAY, [0.7, 0.7, 0.7], -5.5 + (k % 6) * 1.0, 5.0 - Math.floor(k / 6) * 1.0, 0));
    const cur = tag('試', 'ptr alt', -5.5, 6.0);
    for (let k = 0; k < 12; k++) { cur.position.set(cs[k].position.x, cs[k].position.y + 0.8, 0); glow(cs[k], GOLD); await beat(tok, 200); glow(cs[k], null); tint(cs[k], J2.sand); }
    glow(cs[7], GREEN);
    say('沒有任何 idea 時只能這樣做', '已經試遍所有可能 → 最低標準');
    await beat(tok, 2600);
  } else {
    say('Proposal 2：worst case 要 qualitatively 更好', '比較對象：brute force');
    await beat(tok, 2800);
  }
  const bf = j2bar('brute force', J2.bad, 2.4, 5.0, 1.4), me = j2bar('你的演算法', J2.ok, 4.6, 1.4, 1.4);
  say(v2 ? 'Worst-case performance 跟它比' : '你的演算法至少要比它好', v2 ? '要用可分析的 model 去量化' : '用了大腦之後改善多少？');
  await beat(tok, 2800);
  if (v2) {
    say('但還沒說 input size 變大時怎麼成長', '要看 scalability → Proposal 3');
    await beat(tok, 3000);
  } else {
    say('常常稍微花點心思就大幅改善', '');
    await beat(tok, 2600);
  }
}]);

FRAG.push(['algjiang2-poly-cnd', 'Polynomial running time：T(n) ≤ c·nᵈ', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.6, 0]);
  const P = plot(-6, 0, 11.2, 7, 10, 100);
  say('Polynomial running time', 'T(n) ≤ c·nᵈ，c、d 是大於 0 的常數');
  await beat(tok, 3300);
  P.curve((n) => 10 * n, J2.man); tag('d = 1', 'ptr', P.X(10) + 0.5, P.Y(100));
  say('d = 1：跟 input size 成正比', '');
  await beat(tok, 2800);
  P.curve((n) => n * n, J2.bad); tag('d = 2', 'ptr', P.X(10) + 0.5, P.Y(100) - 0.7);
  say('d = 2：二次成長', '同樣 c，d 越大長越快');
  await beat(tok, 3100);
  P.curve((n) => 10 * Math.sqrt(n), J2.ok); tag('d = 1/2（√n）', 'ptr alt', P.X(10) + 0.6, P.Y(32));
  say('d = 1/2：根號，成長更慢', 'd 壓得越低越好');
  await beat(tok, 3300);
  say('單位：primitive computational step', '算 procedure 一共要幾個步驟');
  await beat(tok, 3900);
}]);

FRAG.push(['algjiang2-primitive-step', 'Primitive computational step：跟 input size 無關', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  const cd = code(['① 一行組合語言 instruction ≈ 1 cycle', '② 一行高階語言：a > b、a = b + c', '③ 只要跟 input size 無關就算 1 步'], -2.6, 7.0, 0.55);
  cd.hl(0);
  say('一個步驟怎麼算？', '操作型定義：一行 assembly，RISC 一個 cycle');
  await beat(tok, 2600);
  cd.hl(1);
  say('一行高階語言也可以算一步', '一次比較、一次簡單 assignment');
  await beat(tok, 2600);
  cd.hl(2);
  say('重點：刻度大小無所謂', '一步 = 100 個 cycle 也行，只要跟 n 無關');
  await beat(tok, 2800);
  const a = cube('32-bit', J2.man, [1.3, 0.7, 0.8], 1.6, 4.4, 0, 3), b = cube('32-bit', J2.man, [1.3, 0.7, 0.8], 3.2, 4.4, 0, 3);
  const c1 = tag('步驟：0', 'ptr alt', 5.6, 4.4);
  await beat(tok, 900);
  move(b, 1.6, 4.4, 0); kill(b); relabel(a, 'a + b'); tint(a, J2.ok); txt(c1, '步驟：1');
  say('兩個 32-bit 數相加 = 1 步', '每個數都 32 bit → 跟 n 無關');
  await beat(tok, 2600);
  kill(a); kill(c1);
  const xs = [-4.5, -3.0, -1.5, 0, 1.5, 3.0], cs = xs.map((x, k) => cube('x' + (k + 1), J2.sand, [1.1, 0.6, 0.8], x, 1.2, 0, 2));
  const c2 = tag('加法：0 次', 'ptr alt', 5.4, 1.2);
  await beat(tok, 800);
  say('n 個數相加還是 1 步嗎？', '加法器一次只加兩個數');
  for (let k = 1; k < 6; k++) { move(cs[k], xs[0], 1.2, 0); await beat(tok, 350); kill(cs[k]); relabel(cs[0], 'Σ' + (k + 1)); txt(c2, '加法：' + k + ' 次'); await beat(tok, 250); }
  tint(cs[0], J2.bad);
  say('n = 6 → 5 次：n − 1 步', '跟 n 有關 → 太大，要切細');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-poly-exceptions', 'Definition 3：polynomial 就算 efficient（與例外）', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  tag('Efficient ⇔ polynomial worst-case running time', 'ptr alt', 0, 7.0);
  say('Definition 3', '不用再拿 brute force 來比');
  await beat(tok, 2800);
  say('經驗上 c、d 都不大 → 算是快', '');
  await beat(tok, 2000);
  const big = cube('6.02×10²³ · n²⁰', J2.bad, [3.6, 1.0, 1.2], -3.4, 4.6, 0, 3);
  say('例外 1：是 polynomial，但 c、d 太大', '實際上不可行');
  await beat(tok, 2800);
  const lad = [tag('n²：最好不要超過', 'ptr', -3.4, 3.2), tag('n² log n：勉強', 'idx', -3.4, 2.5), tag('n³ 以上：大 input 跑不動', 'idx', -3.4, 1.8)];
  say('老師建議：最好不超過 n²', '真的不行就 n² log n');
  await beat(tok, 2800);
  const s1 = cube('Simplex method', J2.ok, [3.0, 0.9, 1.2], 3.4, 4.6, 0, 3), s2 = cube('Unix grep', J2.ok, [3.0, 0.9, 1.2], 3.4, 3.2, 0, 3);
  tag('worst case 2ⁿ 等級', 'idx', 3.4, 2.2);
  say('例外 2：worst case 指數，實務卻很快', '一般 input 不容易撞到 worst case');
  await beat(tok, 3000);
  say('理論看 worst case，實務可能有落差', '記住這些例外');
  await beat(tok, 2800);
}]);

FRAG.push(['algjiang2-runtime-table', 'Running time 表：每秒 10⁶ 個指令', async (tok) => {
  fresh([0, 4.2, 14], [0, 4.0, 0]);
  const cols = [['n', (n) => Math.log10(n)], ['n log n', (n) => Math.log10(n * Math.log2(n))], ['n²', (n) => 2 * Math.log10(n)], ['n³', (n) => 3 * Math.log10(n)],
    ['1.5ⁿ', (n) => n * Math.log10(1.5)], ['2ⁿ', (n) => n * Math.log10(2)], ['n!', (n) => { let s = 0; for (let k = 2; k <= n; k++) s += Math.log10(k); return s; }]];
  const rows = [10, 30, 50, 100, 1000, 10000, 100000, 1000000];
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = (k) => String(k).split('').map((d) => SUP[+d]).join('');
  const fmtT = (lg) => {
    const s = Math.pow(10, lg - 6);
    if (lg - 6 > 40) return 'very long';
    if (s < 1) return '< 1 s'; if (s < 60) return Math.round(s) + ' s'; if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400) return Math.round(s / 3600) + ' hr'; if (s < 3.156e7) return Math.round(s / 86400) + ' 天';
    const ly = lg - 6 - Math.log10(3.156e7);
    if (ly > 25) return 'very long'; if (ly < 5) return Math.round(Math.pow(10, ly)).toLocaleString('en-US') + ' 年';
    const e = Math.floor(ly); return Math.round(Math.pow(10, ly - e)) + '×10' + sup(e) + ' 年';
  };
  const X = (j) => -4.5 + j * 1.75, Y = (i) => 7.0 - i * 0.78, cells = [];
  cols.forEach(([h], j) => tag(h, 'ptr', X(j), 7.9));
  say('假想機器：每秒 10⁶ 個指令', 'high-level instruction；n 從 10 到 1,000,000');
  await beat(tok, 2600);
  for (let i = 0; i < rows.length; i++) {
    tag('n = ' + rows[i].toLocaleString('en-US'), 'idx', -6.4, Y(i));
    cells.push(cols.map(([, f], j) => { const v = fmtT(f(rows[i])); return tag(v, v === '< 1 s' ? 'idx' : '', X(j), Y(i)); }));
    await beat(tok, 450);
  }
  say('n log n、n²：這範圍還等得下去', '');
  await beat(tok, 2400);
  cells[6][3].element.className = 'lab-label ptr alt';
  say('n³：n = 10 萬就要 32 年', 'VLSI 的 input 動輒百萬、甚至 billion');
  await beat(tok, 3000);
  const gz = ghostBox('#d64545', 5.4, 6.6, 0.2); gz.position.set(X(5), Y(3.5), -0.3);
  say('1.5ⁿ、2ⁿ、n!：n 很小就受不了', '寫不成 c·nᵈ → non-polynomial');
  await beat(tok, 3000);
  say('有 poly-time 演算法 → 問題較簡單', '一直找不到 → 相對難');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-drop-terms', 'T(n) = 1.62n² + 3.5n + 8：只留 n²', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  const eq = tag('T(n) = 1.62n² + 3.5n + 8', 'ptr alt', 0, 7.2);
  say('把每一行的步驟算得很精細', 'T(n) = 1.62n² + 3.5n + 8');
  await beat(tok, 2600);
  const ns = [10, 100, 1000], H = 5, parts = [];
  ns.forEach((n, k) => {
    const a = 1.62 * n * n, b = 3.5 * n, c = 8, s = a + b + c, x = -3.6 + k * 3.6;
    const ha = H * a / s, hb = H * b / s, hc = Math.max(0.04, H * c / s);
    const ma = cube('', J2.bad, [1.6, ha, 1], x, ha / 2), mb = cube('', J2.man, [1.6, hb, 1], x, ha + hb / 2), mc = cube('', J2.ok, [1.6, hc, 1], x, ha + hb + hc / 2);
    tag('n = ' + n, 'idx', x, -0.45); tag(Math.round(1000 * a / s) / 10 + '%', 'ptr', x + 1.4, ha / 2);
    parts.push({ ma, mb, mc });
  });
  tag('紅：1.62n²　藍：3.5n　綠：8', 'idx', 0, 6.2);
  say('n 變大，n² 項幾乎佔全部', 'n = 10：79%；n = 1000：99.8%');
  await beat(tok, 3200);
  parts.forEach((p) => { fly(p.mb, V3(0, 8, 4)); fly(p.mc, V3(0, 8, 4)); });
  txt(eq, 'T(n) ≈ 1.62n²');
  say('丟掉 low-order terms', '太細反而沒重點');
  await beat(tok, 2600);
  txt(eq, 'T(n) ~ n²');
  say('係數也不重要：跟步驟的刻度有關', '換個算法係數會變，次方不會變');
  await beat(tok, 3000);
  say('就說它是 n² 的表現', '都被 n² 界住的演算法 → 同一個 class');
  await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-bounds-def', 'O、Ω、Θ 的定義：找 c 與 n₀', async (tok) => {
  fresh([0, 4.4, 14.5], [0, 3.6, 0]);
  const T = (n) => 1.62 * n * n + 3.5 * n + 8;
  const P = plot(-6, 0, 11, 7, 20, 820);
  P.curve(T, '#3a3226'); tag('T(n)', 'ptr', P.X(20) + 0.5, P.Y(T(20)) - 0.2);
  say('T(n)：input size n 的 worst-case 步驟數', '例：T(n) = 1.62n² + 3.5n + 8');
  await beat(tok, 2800);
  P.curve((n) => 2 * n * n, J2.bad); tag('2n²', 'ptr', P.X(20) + 0.5, P.Y(800));
  say('Big-O：n ≥ n₀ 時 T(n) ≤ c·f(n)', '');
  await beat(tok, 2400);
  P.vmark(12, '#c08a1f', 'n₀ = 12'); const z = P.zone(12, 20, '#d64545');
  say('c = 2：n ≥ 12 起 2n² 壓住 T(n)', 'T(n) = O(n²)；前段沒壓住沒關係');
  await beat(tok, 3000);
  P.curve((n) => n * n, J2.man); tag('1·n²', 'ptr alt', P.X(20) + 0.5, P.Y(400));
  say('Big-Ω：n ≥ n₀ 時 T(n) ≥ c·f(n)', 'c = 1 → T(n) = Ω(n²)');
  await beat(tok, 2800);
  say('Θ：上界、下界同時成立', 'c₁ = 1、c₂ = 2 可以不同 → T(n) = Θ(n²)');
  await beat(tok, 3000);
  say('也可用極限：T(n)/f(n) → 常數', 'lim T(n)/n² = 1.62 → 互為 Θ');
  await beat(tok, 3000);
  z.visible = true;
}]);

FRAG.push(['algjiang2-nine-quiz', '九題 yes/no：T(n) = 1.62n² + 3.5n + 8', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.4, 0]);
  tag('T(n) = 1.62n² + 3.5n + 8', 'ptr alt', 0, 7.3);
  const fs = ['n', 'n²', 'n³'], ops = ['O', 'Ω', 'Θ'], ans = [[0, 1, 1], [1, 1, 0], [0, 1, 0]];
  const X = (j) => -3.4 + j * 3.4, Y = (i) => 5.6 - i * 1.9, g = [];
  for (let i = 0; i < 3; i++) { g.push([]); for (let j = 0; j < 3; j++) g[i].push(cube(ops[i] + '(' + fs[j] + ')', J2.sand, [2.2, 0.9, 1.0], X(j), Y(i), 0)); }
  const mark = (i, j) => { tint(g[i][j], ans[i][j] ? J2.ok : J2.bad); relabel(g[i][j], ops[i] + '(' + fs[j] + ') ' + (ans[i][j] ? '✓' : '✗')); };
  say('九題 yes/no', 'O 上界、Ω 下界、Θ 兩者都要');
  await beat(tok, 2400);
  mark(0, 0); say('T(n) = O(n)？No', '找不到常數 c 讓 c·n 一直壓住 1.62n²'); await beat(tok, 2800);
  mark(0, 1); say('O(n²)：Yes', '要真的找到 c 與 n₀，例如 c = 2，n₀ = 12'); await beat(tok, 2800);
  mark(0, 2); glow(g[0][2], GOLD); say('O(n³)：也是 Yes', 'c·n³ 很容易超過 → 對，但不夠 tight'); await beat(tok, 3000);
  glow(g[0][2], null);
  mark(1, 0); mark(1, 1); say('Ω(n)、Ω(n²)：Yes', '係數取小一點就成立'); await beat(tok, 2600);
  mark(1, 2); say('Ω(n³)：No', 'c·n³ 壓不到 T(n) 下面'); await beat(tok, 2400);
  say('Θ：同時檢查 O 與 Ω 那兩題', '例：Θ(n) 看第 1、4 題'); await beat(tok, 2400);
  mark(2, 0); mark(2, 1); mark(2, 2); say('只有 Θ(n²) 成立', ''); await beat(tok, 2400);
  say('寫 Big-O，心裡要追求 Θ 等級', '明明是 n²，說成 n³ 人家會生氣'); await beat(tok, 3000);
}]);

FRAG.push(['algjiang2-set-notation', 'O(n³) 是集合：「=」其實是「∈」', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  const f = cube('f(n) = 5n³', J2.bad, [2.6, 0.9, 1.0], -4.2, 6.0, 0, 3), g = cube('g(n) = 3n²', J2.man, [2.6, 0.9, 1.0], 4.2, 6.0, 0, 3);
  say('f(n) = 5n³，g(n) = 3n²', '');
  await beat(tok, 2700);
  const set = ghostBox('#c08a1f', 8.0, 3.4, 2.0); set.position.set(0, 2.0, 0); tag('O(n³)', 'ptr alt', -3.4, 3.4);
  move(f, -1.8, 2.4, 0); move(g, 1.8, 2.4, 0);
  say('f(n) = O(n³)、g(n) = O(n³) 都對', '');
  await beat(tok, 3200);
  glow(f, RED); glow(g, RED);
  say('但不能推出 f(n) = g(n)', '<span class="no">5n³ ≠ 3n²</span>');
  await beat(tok, 3200);
  glow(f, null); glow(g, null);
  ['n²', 'n log n', '7'].forEach((s, k) => cube(s, J2.sand, [1.4, 0.6, 0.8], -2.4 + k * 2.4, 1.0, 0, 4));
  say('O(n³)：所有被 n³ 界住的函數的集合', '正確寫法：f(n) ∈ O(n³)');
  await beat(tok, 3700);
  say('數學家 abuse 了「=」這個 notation', '亞里斯多德是人，但人不一定是亞里斯多德');
  await beat(tok, 3700);
}]);
  }

  // ═══ algmit1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── MIT 6.006 Fall 2011：L1 HtSuA80QTyo、L2 Zc54gFhdpLA、Rec1 P7frcB_-g4w、Rec2 QFcyt8fgQMU ───
// 這段影片的動畫放慢 1.5 倍（anim 仍用 kit 的節奏）
const beat = (tok, ms) => ctx.beat(tok, ms * 1.5);
const M = { blue: '#4b9ee2', pink: '#e55a9b', green: '#2fc092', orange: '#dd8238', purple: '#9b7ef4', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e', paper: '#efe6d2', brown: '#6e5f49' };
const mBox = (t, c, x, y, w = 0.8, h = 0.8, d = 0.8, drop = 0, z = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const mX = (n, gap, cx = 0) => (i) => cx - (n - 1) * gap / 2 + i * gap;
function mRow(vals, y, o = {}) {
  const gap = o.gap || 1, s = o.s || 0.8, X = mX(vals.length, gap, o.cx || 0);
  return vals.map((v, i) => mBox(v, typeof o.col === 'function' ? o.col(v, i) : (o.col || M.blue), X(i), y, s, s, s, o.drop || 0, o.z || 0));
}
// 長條：底部貼地 (y = 0)，高 h
function mBar(v, h, col, x, z = 0, w = 0.7) { const H = Math.max(0.05, h); return cube(v, col, [w, H, w], x, H / 2, z); }
function mSetH(m, h) { const H = Math.max(0.05, h); m.scale.y = H / m.geometry.parameters.height; m.position.y = H / 2; }
function mPoly(pts, col) {
  const T = ctx.THREE; const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: col }));
  lab.world.add(l); return l;
}
// 函數圖：x ∈ [0, X] → [ox, ox + W]；y ∈ [0, Y] → [oy, oy + H]
function mPlot(fn, X, Y, col, P = {}) {
  const ox = P.ox ?? -5, oy = P.oy ?? 0.3, W = P.W ?? 10, H = P.H ?? 5.6, N = P.N ?? 160, pts = [];
  for (let k = 0; k <= N; k++) { const x = X * k / N; const y = Math.max(0, Math.min(1.08, fn(x) / Y)); pts.push(V3(ox + W * k / N, oy + H * y, 0)); }
  return mPoly(pts, col);
}
function mAxes(xl, yl, P = {}) {
  const ox = P.ox ?? -5, oy = P.oy ?? 0.3, W = P.W ?? 10, H = P.H ?? 5.6;
  line(ox, oy, ox + W, oy, 0, M.brown); line(ox, oy, ox, oy + H, 0, M.brown);
  return [tag(xl, 'idx', ox + W, oy - 0.45), tag(yl, 'idx', ox - 0.5, oy + H)];
}
// L1 / Rec1 的 2D peak 例子（老師板書：14 13 12 / 15 9 11 / 16 17 19 20；其餘格子為補上的值）
const PK = [[10, 8, 10, 10], [14, 13, 12, 11], [15, 9, 11, 10], [16, 17, 19, 20]];
function mGrid(G, gx = 1.3, gy = 1.1, y0 = 5.0, cx = 0) {
  const C = G[0].length, X = mX(C, gx, cx);
  const cells = G.map((row, r) => row.map((v, c) => mBox(v, M.sand, X(c), y0 - r * gy, 0.95, 0.85, 0.6)));
  return { cells, X, Y: (r) => y0 - r * gy, R: G.length, C };
}
const mOff = (g) => g.cells.forEach((row) => row.forEach((m) => glow(m, null)));
const isPeak1 = (A, i) => (i === 0 || A[i] >= A[i - 1]) && (i === A.length - 1 || A[i] >= A[i + 1]);

// ════════ HtSuA80QTyo（MIT 6.006 L1：Algorithmic Thinking, Peak Finding） ════════
// 02:52 大輸入：10⁹ 線性掃描可以，cubic 變 10²⁷
FRAG.push(['algmit1-scale-n3', '大輸入：n = 10⁹ 時 n³ = 10²⁷', async (tok) => {
  fresh([0, 4.6, 15], [0, 3.4, 0]);
  const s = 0.33;
  say('「large」的定義一直在變大', '10³ → 10⁶ → 10¹² → 10¹⁸');
  const eras = [['10³', 3, '當年'], ['10⁶', 6, 'Eric 當年'], ['10¹²', 12, '現在'], ['10¹⁸', 18, '未來']];
  for (let i = 0; i < eras.length; i++) {
    const x = -5.6 + i * 1.25; mBar(eras[i][0], eras[i][1] * s, M.teal, x, 0, 0.8);
    tag(eras[i][2], 'idx', x, -0.4); await beat(tok, 700);
  }
  await beat(tok, 1400);
  say('線性掃過 10⁹ 個元素：幾秒鐘', 'Θ(n)，n = 10⁹');
  mBar('n', 9 * s, M.green, 1.6, 0, 1.0); tag('10⁹ 步', 'ptr', 1.6, 9 * s + 0.5);
  await beat(tok, 2400);
  say('cubic 演算法：10²⁷ 步', 'Θ(n³) = (10⁹)³ = 10²⁷');
  const b2 = mBar('n³', 0.05, M.red, 4.2, 0, 1.0);
  await anim(tok, 1800, (t) => mSetH(b2, 0.05 + (27 * s - 0.05) * t));
  tag('10²⁷ 步：跑不完', 'ptr alt', 4.2, 27 * s + 0.5); glow(b2, RED);
  await beat(tok, 2400);
  say('輸入越大，效率越重要', 'scalability：n 變大時怎麼成長');
  await beat(tok, 1900);
}]);

// 15:57 1D peak 的定義
FRAG.push(['algmit1-peak1d-def', '1D peak：b ≥ a 且 b ≥ c', async (tok) => {
  fresh([0, 3.8, 13], [0, 1.6, 0]);
  const L = 'abcdefghi'.split(''), X = mX(9, 1.15);
  const cs = L.map((v, i) => mBox(v, M.sand, X(i), 0.45, 0.85, 0.85, 0.85, 2 + i * 0.15));
  L.forEach((_, i) => tag(String(i + 1), 'idx', X(i), -0.35));
  say('一維 peak finding：9 個位置', '陣列 a, b, …, i');
  await beat(tok, 2400);
  say('位置 2 是 peak：b 不小於兩鄰', 'b ≥ a  且  b ≥ c');
  glow(cs[1], GOLD);
  let a1 = arrow(V3(X(1), 1.9), V3(X(0), 1.05)), a2 = arrow(V3(X(1), 1.9), V3(X(2), 1.05));
  await beat(tok, 3000); kill(a1); kill(a2); glow(cs[1], null);
  say('邊界只要看一邊', '位置 9 是 peak ⇔ i ≥ h');
  glow(cs[8], GOLD); a1 = arrow(V3(X(8), 1.9), V3(X(7), 1.05));
  await beat(tok, 3000); kill(a1); glow(cs[8], null);
  say('代入數字看看', '[3, 5, 4, 2, 6, 7, 1, 2, 8]');
  const A = [3, 5, 4, 2, 6, 7, 1, 2, 8];
  for (let i = 0; i < 9; i++) { relabel(cs[i], A[i]); await beat(tok, 180); }
  await beat(tok, 900);
  for (let i = 0; i < 9; i++) if (isPeak1(A, i)) { glow(cs[i], GREEN); tag('peak', 'ptr', X(i), 1.5); await beat(tok, 700); }
  say('peak 是局部性質，可能不只一個', '只要找到「一個」peak');
  await beat(tok, 1900);
}]);

// 18:00 find a peak if it exists：≥ 一定有，> 不一定
FRAG.push(['algmit1-peak-exists', '≥ 定義一定有 peak；> 可能沒有', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.0, 0]);
  const X = mX(5, 1.2);
  say('定義用 ≥：任何陣列都有 peak', '全域最大值一定 ≥ 兩鄰');
  const ra = mRow([2, 5, 3, 7, 4], 3.4, { gap: 1.2, col: M.sand, drop: 2 });
  tag('≥ 定義', 'ptr', -4.6, 3.4);
  await beat(tok, 1600); glow(ra[3], GREEN); tag('max → peak', 'idx', X(3), 4.3);
  await beat(tok, 2600);
  say('改用 >（嚴格大於）呢？', '[3, 3, 3, 3]');
  const rb = mRow([3, 3, 3, 3], 0.7, { gap: 1.2, col: M.sand, drop: 2 });
  tag('> 定義', 'ptr', -4.6, 0.7);
  await beat(tok, 1600);
  for (const m of rb) { glow(m, RED); await beat(tok, 350); }
  say('全部相等：沒有 peak', '嚴格定義下 peak 可能不存在');
  await beat(tok, 2600);
  say('所以題目寫 if it exists', '≥ 版可省略；> 版要能回報「不存在」');
  await beat(tok, 1900);
}]);

// 22:11 直接法：從左往右走，最壞 Θ(n)
FRAG.push(['algmit1-peak1d-linear', '直接法：從左走到右，最壞 Θ(n)', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.2, 0]);
  const X = mX(9, 1.1);
  async function walk(A, col) {
    const bs = A.map((v, i) => mBar(v, v * 0.5, col, X(i)));
    const cur = tag('▼', 'ptr', X(0), 5.4); let steps = 0;
    for (let i = 0; i < A.length; i++) {
      cur.position.set(X(i), A[i] * 0.5 + 0.6, 0); glow(bs[i], GOLD); steps++;
      await beat(tok, 450);
      if (isPeak1(A, i)) { glow(bs[i], GREEN); break; }
      glow(bs[i], null);
    }
    return { bs, cur, steps };
  }
  say('直接法：從最左邊開始往右走', '每格看左右兩鄰');
  await beat(tok, 1200);
  let r = await walk([1, 3, 5, 7, 9, 6, 4, 2, 1], M.blue);
  let t = tag('看了 ' + r.steps + ' 格 ≈ n/2', 'ptr alt', 0, 6.0);
  say('peak 在中間：看大約 n/2 個', '≈ n/2');
  await beat(tok, 2400);
  r.bs.forEach(kill); kill(r.cur); kill(t);
  say('最壞情況：1, 2, …, n 一路遞增', 'peak 在最右邊');
  r = await walk([1, 2, 3, 4, 5, 6, 7, 8, 9], M.orange);
  t = tag('看了 ' + r.steps + ' = n 格', 'ptr alt', 0, 6.0);
  await beat(tok, 1600);
  say('最壞情況 Θ(n)：線性', 'Θ = 上界 + 下界；O 只是上界');
  await beat(tok, 1900);
}]);

// 27:20 divide & conquer：看 n/2，往比較大的那邊走
FRAG.push(['algmit1-peak1d-binary', 'Divide & conquer：看 n/2，往大的那邊', async (tok) => {
  fresh([0, 4.6, 15], [0, 3.6, 0]);
  const A = [2, 3, 4, 5, 6, 8, 9, 7, 1], X = mX(9, 1.1);
  const bs = A.map((v, i) => mBar(v, v * 0.5, M.blue, X(i)));
  A.forEach((_, i) => tag(String(i + 1), 'idx', X(i), -0.35));
  const cd = code(['if a[n/2] < a[n/2−1]: 只看左半 1 … n/2−1', 'elif a[n/2] < a[n/2+1]: 只看右半 n/2+1 … n', 'else: n/2 是 peak'], 0, 7.9, 0.55);
  say('Divide & conquer：先看中間', 'n = 9，中間 = 位置 5');
  await beat(tok, 1800);
  // 第一輪：位置 5（值 6）
  glow(bs[4], GOLD); let cur = tag('n/2', 'ptr', X(4), 3.6);
  await beat(tok, 1200);
  cd.hl(0); glow(bs[3], '#333333'); say('左鄰 5 不比 6 大', 'a[5] = 6 ≥ a[4] = 5');
  await beat(tok, 2000); glow(bs[3], null);
  cd.hl(1); glow(bs[5], RED); say('右鄰 8 > 6 → 只看右半', 'a[5] = 6 < a[6] = 8');
  await beat(tok, 2000);
  for (let i = 0; i <= 4; i++) { tint(bs[i], GRAY); glow(bs[i], null); await beat(tok, 150); }
  glow(bs[5], null); kill(cur);
  // 第二輪：位置 6–9，中間 = 位置 7（值 9）
  say('子問題：位置 6 … 9，再看中間', '中間 = 位置 7');
  glow(bs[6], GOLD); cur = tag('mid', 'ptr', X(6), 5.1);
  await beat(tok, 1800);
  cd.hl(2); glow(bs[6], GREEN); say('9 ≥ 8 且 9 ≥ 7 → 找到 peak', '兩個條件都不成立 → done');
  await beat(tok, 2400);
  say('每一步丟掉一半', '只看了 2 個位置就結束');
  await beat(tok, 1900);
}]);

// 32:08 遞迴式 T(n) = T(n/2) + Θ(1) → Θ(log n)；10⁷ 筆：13 s vs 0.001 s
FRAG.push(['algmit1-peak1d-recur', 'T(n) = T(n/2) + Θ(1) = Θ(log n)', async (tok) => {
  fresh([0, 4.0, 14], [0, 3.0, 0]);
  say('每層只做兩次比較：Θ(1)', 'T(n) = T(n/2) + Θ(1)');
  const lv = ['n', 'n/2', 'n/4', 'n/8', '1'], ws = [6, 3, 1.5, 0.75, 0.3];
  for (let k = 0; k < lv.length; k++) {
    const y = 6.0 - k * 1.25; cube(lv[k], M.blue, [ws[k], 0.6, 0.8], -2.6, y, 0, 1.5);
    tag(k < 4 ? 'Θ(1)' : 'T(1) = Θ(1)', 'idx', 1.4, y); await beat(tok, 750);
  }
  say('一直切半到剩 1 個', 'log₂ n 層');
  const br = tag('log₂ n 層', 'ptr alt', -6.0, 3.5);
  await beat(tok, 2200);
  say('加起來：Θ(1) × log₂ n', 'T(n) = Θ(log n)');
  await beat(tok, 2400);
  kill(br);
  say('n = 10⁷ 實測：Θ(n) 版 13 秒', 'Θ(log n) 版 0.001 秒');
  const b1 = mBar('13 s', 0.05, M.orange, 3.4, 0, 1.0), b2 = mBar('', 0.05, M.green, 5.4, 0, 1.0);
  tag('Θ(n)', 'idx', 3.4, -0.4); tag('Θ(log n)', 'idx', 5.4, -0.4);
  await anim(tok, 1600, (t) => mSetH(b1, 0.05 + 5.15 * t));
  tag('0.001 s', 'ptr', 5.4, 0.6);
  await beat(tok, 2200);
  say('n 越大差距越誇張', 'Θ(n) vs Θ(log n)：指數級差距');
  await beat(tok, 1900);
}]);

// 36:15 2D peak 定義 + greedy ascent（12 → 13 → 14 → 15 → 16 → 17 → 19 → 20）
FRAG.push(['algmit1-greedy-ascent', 'Greedy ascent：從 12 一路爬到 20', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.2, 0]);
  const g = mGrid(PK);
  say('2D peak：≥ 上下左右四個鄰居', 'a ≥ b, c, d, e');
  glow(g.cells[2][2], GOLD); for (const [r, c] of [[1, 2], [3, 2], [2, 1], [2, 3]]) glow(g.cells[r][c], '#333333');
  await beat(tok, 2600); mOff(g);
  say('Greedy ascent：往比較大的鄰居走', '從中間的 12 出發，先往左');
  const path = [[1, 2], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
  const cur = tag('●', 'ptr alt', g.X(2), g.Y(1) + 0.75);
  let prev = null;
  for (const [r, c] of path) {
    cur.position.set(g.X(c), g.Y(r) + 0.75, 0); glow(g.cells[r][c], GOLD);
    if (prev) line(g.X(prev[1]), g.Y(prev[0]), g.X(c), g.Y(r), 0.4, M.red);
    prev = [r, c]; await beat(tok, 750);
  }
  glow(g.cells[3][3], GREEN);
  say('20 ≥ 19、20 ≥ 10：是 2D peak', '12 → 13 → 14 → 15 → 16 → 17 → 19 → 20');
  await beat(tok, 2600);
  say('最壞情況：幾乎每一格都走過', 'Θ(nm)；n = m 時 Θ(n²)');
  await beat(tok, 1900);
}]);

// 42:12 錯誤的嘗試：中間 column 找 1D peak，再在那一列找 1D peak → 14 不是 2D peak
FRAG.push(['algmit1-2d-flawed', '錯誤嘗試：column 1D peak 再 row 1D peak', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.2, 0]);
  const g = mGrid(PK);
  say('把 binary search 硬套到 2D', '選中間 column j = m/2，找 1D peak');
  const col = ghostBox(0x4b9ee2, 1.15, 4.4, 0.9); col.position.set(g.X(2), 3.35, 0);
  await beat(tok, 2200);
  glow(g.cells[1][2], GOLD); glow(g.cells[0][2], '#333333'); glow(g.cells[2][2], '#333333');
  say('這一欄的 1D peak：12', '12 ≥ 10、12 ≥ 11（19 更大，但沒選到）');
  await beat(tok, 2800);
  kill(col); glow(g.cells[0][2], null); glow(g.cells[2][2], null);
  const row = ghostBox(0xdd8238, 5.6, 1.0, 0.9); row.position.set(0, g.Y(1), 0);
  say('再在第 i 列找 1D peak', 'row i：14 13 12 11 → 14');
  const cur = tag('◀', 'ptr', g.X(2), g.Y(1) + 0.75);
  for (const c of [1, 0]) { await beat(tok, 700); cur.position.set(g.X(c), g.Y(1) + 0.75, 0); glow(g.cells[1][c], GOLD); }
  await beat(tok, 1400);
  glow(g.cells[2][0], RED); glow(g.cells[1][0], RED);
  say('但 14 下面是 15：不是 2D peak', '2D peak 不一定在 row i 上');
  await beat(tok, 2800);
  say('有效率（log n）但不正確', '正確但慢 > 快但錯');
  await beat(tok, 1900);
}]);

// 47:09 正確版：中間 column 找全域最大，往較大的鄰居那半邊遞迴
FRAG.push(['algmit1-2d-colmax', '正確版：column 全域最大 → 比左右 → 遞迴半邊', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.6, 0]);
  const g = mGrid(PK, 1.3, 1.05, 4.5);
  const cd = code(['j = m/2，找 column j 的全域最大 (i, j)', '比較 (i, j−1)、(i, j)、(i, j+1)', '左大 → 左半；右大 → 右半（欄數減半）', '都不大 → (i, j) 是 2D peak', '只剩一欄 → 最大值就是 peak'], 0, 8.4, 0.5);
  async function colMax(c, rows) {
    const cur = tag('▶', 'ptr', g.X(c) - 0.8, g.Y(0)); let best = 0;
    for (let r = 0; r < rows; r++) { cur.position.set(g.X(c) - 0.8, g.Y(r), 0); glow(g.cells[r][c], '#333333'); await beat(tok, 380); if (PK[r][c] > PK[best][c]) best = r; }
    for (let r = 0; r < rows; r++) glow(g.cells[r][c], null);
    kill(cur); glow(g.cells[best][c], GOLD); return best;
  }
  say('第 2 欄（j = m/2）：掃整欄找最大', '8, 13, 9, 17 → max = 17');
  cd.hl(0); let r = await colMax(1, 4);
  await beat(tok, 900);
  cd.hl(1); glow(g.cells[r][0], '#333333'); glow(g.cells[r][2], RED);
  say('左 16、右 19：右邊比較大', '19 > 17 → 往右半');
  await beat(tok, 2000);
  cd.hl(2); for (const c of [0, 1]) for (let k = 0; k < 4; k++) { tint(g.cells[k][c], GRAY); glow(g.cells[k][c], null); }
  await beat(tok, 900);
  say('剩第 3、4 欄：看第 3 欄', '10, 12, 11, 19 → max = 19');
  cd.hl(0); r = await colMax(2, 4);
  cd.hl(1); glow(g.cells[r][3], RED);
  say('右鄰 20 > 19 → 往右', '欄數再減半');
  await beat(tok, 1800);
  cd.hl(2); for (let k = 0; k < 4; k++) { tint(g.cells[k][2], GRAY); glow(g.cells[k][2], null); }
  say('只剩一欄：最大值就是 peak', '10, 11, 10, 20 → 20');
  cd.hl(4); r = await colMax(3, 4); glow(g.cells[r][3], GREEN);
  await beat(tok, 1600);
  say('20 是整欄最大，又 ≥ 左邊 19', '→ 2D peak');
  await beat(tok, 1900);
}]);

// 51:12 遞迴式 T(n, m) = T(n, m/2) + Θ(n) → Θ(n log m)（params.swap：Rec1 的記號，m 列 n 欄）
FRAG.push(['algmit1-2d-recur', '2D 遞迴式：每層掃一欄，log 層', async (tok) => {
  const p = ctx.params || {};
  const R = p.swap ? 'm' : 'n', C = p.swap ? 'n' : 'm';
  const rec = p.swap ? 'T(n, m) = Θ(m) + T(n/2, m)' : 'T(n, m) = T(n, m/2) + Θ(n)';
  const base = p.swap ? 'T(1, m) = Θ(m)' : 'T(n, 1) = Θ(n)';
  const ans = p.swap ? 'Θ(m log n)' : 'Θ(n log m)';
  fresh([0, 4.0, 14], [0, 3.4, 0]);
  say(R + ' 列 × ' + C + ' 欄：每次欄數減半', rec);
  const cnt = [8, 4, 2, 1];
  for (let k = 0; k < cnt.length; k++) {
    const y = 6.4 - k * 1.7, X = mX(cnt[k], 0.55, -1.6);
    for (let c = 0; c < cnt[k]; c++) {
      const m = cube('', c === Math.floor((cnt[k] - 1) / 2) ? M.gold : M.sand, [0.42, 1.2, 0.42], X(c), y, 0, 1.2);
      if (c === Math.floor((cnt[k] - 1) / 2)) glow(m, GOLD);
    }
    tag(cnt[k] === 1 ? C + '/' + C + ' = 1 欄' : (k === 0 ? C : C + '/' + (1 << k)) + ' 欄', 'idx', -5.6, y);
    tag('掃一欄 Θ(' + R + ')', 'ptr', 3.4, y);
    await beat(tok, 1300);
  }
  say('只剩一欄：找最大即可', base);
  await beat(tok, 2400);
  say('共 log₂ ' + C + ' 層，每層 Θ(' + R + ')', 'T = Θ(' + R + ') × log₂ ' + C);
  await beat(tok, 2400);
  say('比 greedy ascent 的 Θ(nm) 快', ans);
  await beat(tok, 1900);
}]);

// ════════ Zc54gFhdpLA（MIT 6.006 L2：Models of Computation, Document Distance） ════════
// 02:15 algorithm ↔ program、pseudocode ↔ 程式語言、model of computation ↔ computer
FRAG.push(['algmit1-analogy', 'Algorithm ↔ Program、Model ↔ Computer', async (tok) => {
  fresh([0, 3.8, 13], [0, 2.8, 0]);
  tag('數學世界', 'ptr', -3.2, 6.1); tag('真實電腦', 'ptr', 3.2, 6.1);
  const P = [['Algorithm', 'Computer program', '演算法 = 程式的數學版', 'input → algorithm → output'],
    ['Pseudocode', 'Programming language', '用 pseudocode 寫演算法', 'structured English'],
    ['Model of computation', 'Computer', '計算模型 ↔ 電腦', '規定能做哪些操作']];
  const left = [];
  for (let i = 0; i < 3; i++) {
    const y = 4.8 - i * 1.5;
    say(P[i][2], P[i][3]);
    left.push(cube(P[i][0], M.purple, [3.2, 0.7, 0.9], -3.2, y, 0, 2));
    await beat(tok, 700);
    cube(P[i][1], M.teal, [3.2, 0.7, 0.9], 3.2, y, 0, 2);
    await beat(tok, 600); line(-1.55, y, 1.55, y, 0, M.brown); tag('↔', 'idx', 0, y + 0.3);
    await beat(tok, 1600);
  }
  glow(left[2], GOLD);
  say('每種操作規定 cost', 'running time = Σ 各操作的 cost');
  await beat(tok, 2400);
  say('兩種模型：RAM 與 Pointer machine', '本課用 Python 的 cost model');
  cube('RAM', M.blue, [2.2, 0.6, 0.8], -2.4, 0.3, 0, 2); await beat(tok, 500);
  cube('Pointer machine', M.blue, [2.8, 0.6, 0.8], 2.4, 0.3, 0, 2);
  await beat(tok, 1900);
}]);

// 07:51 RAM：load 常數個 word → 計算 → store，都是 Θ(1)
FRAG.push(['algmit1-ram', 'Random access machine：load / compute / store', async (tok) => {
  fresh([0, 3.8, 13], [0, 2.6, 0]);
  const V = [7, 3, 9, 1, 4, 6, 2, 0], X = mX(8, 1.1);
  const mem = V.map((v, i) => mBox(v, M.sand, X(i), 0.5, 0.9, 0.8, 0.8, 1.5));
  V.forEach((_, i) => tag(String(i), 'idx', X(i), -0.3));
  tag('address', 'idx', -5.6, -0.3); tag('…', 'idx', 5.2, 0.5);
  say('RAM：記憶體是一個大 array of words', '用 address 存取任何一格：Θ(1)');
  await beat(tok, 2400);
  const RX = [-2.4, 0, 2.4]; RX.forEach((x, i) => { cube('', '#e8dcc2', [1.0, 0.9, 0.9], x, 4.2, 0); tag('r' + (i + 1), 'idx', x, 5.0); });
  say('Θ(1) 時間 load 常數個 word', 'r1 ← M[5]、r2 ← M[2]');
  glow(mem[5], GOLD); const c1 = mBox(6, M.blue, X(5), 0.5); move(c1, RX[0], 4.2); await beat(tok, 900);
  glow(mem[2], GOLD); const c2 = mBox(9, M.blue, X(2), 0.5); move(c2, RX[1], 4.2); await beat(tok, 1500);
  glow(mem[5], null); glow(mem[2], null);
  say('對暫存器做常數次運算', 'r3 ← r1 + r2 = 15');
  const c3 = mBox(15, M.green, 0, 4.2, 0.8, 0.8, 0.8); move(c3, RX[2], 4.2); await beat(tok, 1800);
  say('再 store 回記憶體', 'M[7] ← r3');
  move(c3, X(7), 1.6); await beat(tok, 900); kill(c3); relabel(mem[7], 15); glow(mem[7], GREEN);
  await beat(tok, 1600);
  say('一個 word = w bits', 'w ≥ lg(記憶體大小)：裝得下 address');
  await beat(tok, 2600);
  say('peak 判斷 = 跟鄰居比幾個 word', '所以是 Θ(1)');
  await beat(tok, 1900);
}]);

// 13:16 Pointer machine：object、常數個 field、pointer / null
FRAG.push(['algmit1-pointer-machine', 'Pointer machine：雙向 linked list', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.6, 0]);
  function node(v, x, y) {
    return { p: mBox('prev', '#d8c29b', x - 1.0, y, 0.9, 0.7, 0.8, 2), d: mBox(v, M.blue, x, y, 1.0, 0.7, 0.8, 2), n: mBox('next', '#d8c29b', x + 1.0, y, 0.9, 0.7, 0.8, 2) };
  }
  say('Pointer machine：動態 object', '每個 object 只有常數個 field');
  const n1 = node(5, -2.6, 3); await beat(tok, 1200);
  const n2 = node(8, 2.6, 3); await beat(tok, 1600);
  say('field 是 word 或 pointer', 'pointer 可以是 null（Python 的 None）');
  arrow(V3(-1.15, 3.2, 0), V3(1.15, 3.2, 0), 0x0f5a3a); tag('next', 'idx', 0, 3.55);
  await beat(tok, 900);
  arrow(V3(1.15, 2.8, 0), V3(-1.15, 2.8, 0), 0x6a4a00); tag('prev', 'idx', 0, 2.45);
  await beat(tok, 900);
  tag('null', 'ptr', 5.0, 3); tag('null', 'ptr', -5.0, 3);
  tag('head', 'ptr alt', -2.6, 5.0); arrow(V3(-2.6, 4.75, 0), V3(-2.6, 3.45, 0));
  await beat(tok, 2200);
  say('x = x.next：跟著 pointer 走一步', 'Θ(1)');
  const x = tag('x', 'ptr alt', -2.6, 1.9); glow(n1.d, GOLD);
  await beat(tok, 1200);
  await anim(tok, 1000, (t) => x.position.set(-2.6 + 5.2 * t, 1.9, 0));
  glow(n1.d, null); glow(n2.d, GOLD);
  await beat(tok, 1600);
  say('比 RAM 弱：pointer 不能做加法', 'RAM 可模擬它：pointer = array index');
  await beat(tok, 1900);
}]);

// 17:42 Python 的 list 是 array：L[i] = L[j] + 5 是 Θ(1)
FRAG.push(['algmit1-py-list-array', 'Python list = array：L[i] = L[j] + 5', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.4, 0]);
  const V = [5, 8, 2, 9, 4, 7, 1, 3], X = mX(8, 1.1);
  const cs = V.map((v, i) => mBox(v, M.sand, X(i), 1.2, 0.9, 0.8, 0.8, 1.5));
  V.forEach((_, i) => tag('L[' + i + ']', 'idx', X(i), 0.4));
  const cd = code(['L[i] = L[j] + 5     # i = 6, j = 2'], 0, 5.6);
  say('Python 的 list 其實是 array', '不是 linked list');
  await beat(tok, 2200);
  cd.hl(0);
  say('random access：直接跳到 index', '讀 L[2] = 2：Θ(1)');
  glow(cs[2], GOLD); await beat(tok, 1400);
  const c = mBox(7, M.green, X(2), 2.6); tag('2 + 5', 'idx', X(2), 3.4);
  await beat(tok, 900); move(c, X(6), 2.6); await beat(tok, 1000);
  move(c, X(6), 1.2); await beat(tok, 500); kill(c); relabel(cs[6], 7); glow(cs[6], GREEN);
  say('整行只做常數個基本操作', 'Θ(1)');
  await beat(tok, 2000); glow(cs[2], null); glow(cs[6], null);
  say('若是 linked list：要一格格走到 i', 'Θ(i)，最壞 Θ(n)');
  const cur = tag('▼', 'ptr alt', X(0), 2.1);
  for (let i = 0; i <= 6; i++) { cur.position.set(X(i), 2.1, 0); glow(cs[i], '#333333'); await beat(tok, 320); glow(cs[i], null); }
  await beat(tok, 1200);
  say('x = x.next 也是 Θ(1)', '常數個 attribute → pointer machine');
  await beat(tok, 1900);
}]);

// 22:19 L.append 與 L1 + L2
FRAG.push(['algmit1-py-concat', 'L.append 是 Θ(1)、L1 + L2 是 Θ(|L1| + |L2|)', async (tok) => {
  fresh([0, 3.8, 13], [0, 2.8, 0]);
  say('L.append(x)：放進下一格', 'Θ(1)（table doubling，第 9 講）');
  const X0 = mX(8, 1.0);
  const tmp = [];
  for (let i = 0; i < 8; i++) { const gb = ghostBox(0x6e5f49, 0.86, 0.86, 0.86); gb.position.set(X0(i), 4.2, 0); tmp.push(gb); }
  for (let i = 0; i < 5; i++) tmp.push(mBox('abcde'[i], M.blue, X0(i), 4.2));
  await beat(tok, 1000);
  const nx = mBox('x', M.green, X0(5), 4.2, 0.8, 0.8, 0.8, 2.5); tmp.push(nx);
  await beat(tok, 3000);
  tmp.forEach(kill);
  const cd = code(['L = L1 + L2   # 等價於：', 'L = []', 'for x in L1: L.append(x)', 'for x in L2: L.append(x)'], 0, 7.4, 0.5);
  say('L1 + L2：+ 不是一個 Θ(1) 操作', '展開成 append 迴圈來算');
  const L1 = mRow(['a', 'b', 'c'], 4.0, { cx: -3.0, col: M.blue }), L2 = mRow(['d', 'e'], 4.0, { cx: 3.0, col: M.orange });
  tag('L1', 'ptr', -5.0, 4.0); tag('L2', 'ptr', 4.6, 4.0); tag('L', 'ptr', -3.6, 1.2);
  cd.hl(1); await beat(tok, 1400);
  const XL = mX(5, 1.0, 0.0), cnt = tag('copy 0 次', 'ptr alt', 4.6, 1.2);
  const src = [...L1, ...L2];
  for (let k = 0; k < 5; k++) {
    cd.hl(k < 3 ? 2 : 3); glow(src[k], GOLD);
    const c = mBox(src[k].userData.lbl.element.textContent, k < 3 ? M.blue : M.orange, src[k].position.x, 4.0);
    move(c, XL(k), 1.2); await beat(tok, 650); glow(src[k], null); txt(cnt, 'copy ' + (k + 1) + ' 次');
  }
  await beat(tok, 900);
  say('時間 ∝ 兩個 list 的長度', 'Θ(1 + |L1| + |L2|)');
  await beat(tok, 1900);
}]);

// 25:36 x in L、len(L)、L.sort()
FRAG.push(['algmit1-py-in-len-sort', 'x in L 是 Θ(n)、len 是 Θ(1)、sort 是 Θ(n log n)', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.4, 0]);
  const V = [5, 8, 2, 9, 4, 7, 1], X = mX(7, 1.1, 0.6);
  const cs = V.map((v, i) => mBox(v, M.sand, X(i), 1.6, 0.9, 0.8, 0.8, 1.5));
  await beat(tok, 900);
  say('6 in L：一個一個比', '最壞 Θ(n)：list 沒排序');
  const q = mBox(6, M.orange, X(0), 4.0);
  for (let i = 0; i < 7; i++) { move(q, X(i), 3.0); glow(cs[i], RED); await beat(tok, 420); glow(cs[i], null); }
  tag('比了 7 次：不在裡面', 'ptr alt', X(3), 4.3);
  await beat(tok, 1800); kill(q);
  say('len(L)：list 內建長度計數', 'Θ(1)：直接讀出來');
  const ln = mBox('len = 7', M.green, -5.0, 1.6, 1.4, 0.8, 0.8, 2); glow(ln, GOLD);
  await beat(tok, 2400); glow(ln, null);
  say('L.sort()：comparison sort', 'Θ(n log n)（第 3、4、7 講）');
  const order = V.map((v, i) => i).sort((a, b) => V[a] - V[b]);
  order.forEach((idx, pos) => move(cs[idx], X(pos), 1.6));
  await beat(tok, 2200);
  say('看起來一行，cost 差很多', '要知道每個操作怎麼實作');
  await beat(tok, 1900);
}]);

// 27:46 dict、long 整數、heapq
FRAG.push(['algmit1-py-dict-long', 'dict Θ(1) w.h.p.、long 加法與乘法', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.6, 0]);
  say('dict：D[key] = val', 'Θ(1) w.h.p.（hash table，第 8–10 講）');
  const X = mX(6, 1.0, 1.2), slots = [];
  for (let i = 0; i < 6; i++) { slots.push(mBox('', '#e8dcc2', X(i), 4.6, 0.9, 0.7, 0.7)); tag(String(i), 'idx', X(i), 3.95); }
  const keys = [['cat', 4], ['dog', 1], ['the', 3]];
  for (const [k, s] of keys) { const c = mBox(k, M.blue, -4.8, 5.8, 0.9, 0.6, 0.6); await beat(tok, 300); move(c, X(s), 5.4); glow(slots[s], GOLD); await beat(tok, 700); }
  await beat(tok, 1600);
  say('long 整數：x 佔 |x| 個 word', 'x + y：Θ(|x| + |y|)');
  const xs = mRow(Array(5).fill('w'), 2.2, { gap: 0.7, s: 0.6, cx: -2.0, col: M.teal }), ys = mRow(Array(3).fill('w'), 1.2, { gap: 0.7, s: 0.6, cx: -0.6, col: M.pink });
  tag('x', 'ptr', -4.2, 2.2); tag('y', 'ptr', -2.0, 1.2);
  await beat(tok, 2400);
  say('x · y：小學乘法 Θ(|x|·|y|)', 'Python：Karatsuba Θ((|x|+|y|)^lg 3)');
  for (const a of xs) glow(a, GOLD);
  for (const b of ys) { glow(b, GOLD); await beat(tok, 400); }
  tag('lg 3 ≈ 1.58 < 2', 'ptr alt', 3.4, 1.7);
  await beat(tok, 2200);
  say('heapq 也內建（第 4 講）', 'Python 的很多功能背後就是演算法');
  await beat(tok, 1900);
}]);

// 32:18 Document distance 問題、用途、word 的定義
FRAG.push(['algmit1-doc-words', 'Document distance：把文件切成 words', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.8, 0]);
  say('兩份文件有多像？', 'document distance d(D1, D2)');
  const d1 = cube('D1', M.purple, [1.4, 1.8, 0.3], -1.2, 4.6, 0, 2), d2 = cube('D2', M.purple, [1.4, 1.8, 0.3], 1.2, 4.6, 0, 2);
  await beat(tok, 2000);
  say('用途：重複網頁、抄襲、搜尋排序', 'duplicate pages · cheating · web search');
  const U = ['重複網頁', '作業抄襲', '搜尋：query 也是短文件'];
  for (let i = 0; i < 3; i++) { tag(U[i], 'ptr', -4 + i * 4, 2.6); await beat(tok, 800); }
  await beat(tok, 1400);
  kill(d1); kill(d2);
  say('word = 連續的英數字元', 'a–z、0–9；空白與標點把它們切開');
  const s = cube('"Introduction, to algorithms!"', M.paper, [6.2, 0.7, 0.4], 0, 5.0, 0, 2);
  await beat(tok, 1800);
  const W = ['Introduction', 'to', 'algorithms'], X = mX(3, 2.8);
  for (let i = 0; i < 3; i++) { mBox(W[i], M.blue, X(i), 1.0, 2.4, 0.7, 0.7, 2.5); await beat(tok, 600); }
  glow(s, GOLD);
  say('文件 = 一串 words', '用「共同的 words」來定義距離');
  await beat(tok, 1900);
}]);

// 36:20 文件向量：the cat、the dog；內積
FRAG.push(['algmit1-doc-vectors', '文件向量與內積：the cat vs the dog', async (tok) => {
  fresh([4.5, 4.5, 11], [0.5, 1.8, 0.5]);
  const O = V3(-1.5, 0.3, -1), U = 3;
  arrow(O, V3(-1.5 + 4, 0.3, -1), 0x6e5f49); arrow(O, V3(-1.5, 4.3, -1), 0x6e5f49); arrow(O, V3(-1.5, 0.3, 3), 0x6e5f49);
  tag('the', 'idx', 2.8, 0.3, -1); tag('cat', 'idx', -1.5, 4.7, -1); tag('dog', 'idx', -1.5, 0.3, 3.4);
  say('D[w] = 單字 w 在文件中出現幾次', '每份文件 = 一個向量');
  await beat(tok, 2200);
  say('D1 = "the cat" = (1, 1, 0)', 'the 1、cat 1、dog 0');
  arrow(O, V3(-1.5 + U, 0.3 + U, -1), 0x9b7ef4); tag('D1', 'ptr', -1.5 + U + 0.3, 0.3 + U + 0.3, -1);
  await beat(tok, 2000);
  say('D2 = "the dog" = (1, 0, 1)', 'the 1、cat 0、dog 1');
  arrow(O, V3(-1.5 + U, 0.3, -1 + U), 0xdd8238); tag('D2', 'ptr', -1.5 + U + 0.3, 0.6, -1 + U);
  await beat(tok, 2000);
  say('內積 d′ = Σ D1[w]·D2[w]', '1·1 + 1·0 + 0·1 = 1');
  await beat(tok, 2600);
  say('問題：長文件的內積天生很大', '百萬字、一半相同 → 500,000');
  const b1 = mBar('500,000', 0.05, M.orange, 5.0, -1, 0.9), b2 = mBar('100', 0.3, M.green, 6.4, -1, 0.9);
  await anim(tok, 1200, (t) => mSetH(b1, 0.05 + 4.6 * t));
  await beat(tok, 1400);
  say('完全相同的 100 字文件才 100', '不是 scale invariant');
  glow(b2, RED);
  await beat(tok, 1900);
}]);

// 40:31 除以長度 → cos θ；θ = arccos
FRAG.push(['algmit1-doc-angle', '除以長度：兩向量夾角 θ', async (tok) => {
  fresh([4.5, 4.5, 11], [0.5, 1.8, 0.5]);
  const O = V3(-1.5, 0.3, -1), U = 3;
  arrow(O, V3(2.5, 0.3, -1), 0x6e5f49); arrow(O, V3(-1.5, 4.3, -1), 0x6e5f49); arrow(O, V3(-1.5, 0.3, 3), 0x6e5f49);
  tag('the', 'idx', 2.8, 0.3, -1); tag('cat', 'idx', -1.5, 4.7, -1); tag('dog', 'idx', -1.5, 0.3, 3.4);
  arrow(O, V3(-1.5 + U, 0.3 + U, -1), 0x9b7ef4); tag('D1', 'ptr', -1.5 + U + 0.3, 0.3 + U + 0.3, -1);
  arrow(O, V3(-1.5 + U, 0.3, -1 + U), 0xdd8238); tag('D2', 'ptr', -1.5 + U + 0.3, 0.6, -1 + U);
  say('修正：除以兩個向量的長度', 'd″ = D1·D2 / (‖D1‖·‖D2‖)');
  await beat(tok, 2600);
  say('‖D1‖ = ‖D2‖ = √2', '1 / (√2 · √2) = 1/2');
  await beat(tok, 3200);
  const a = V3(1, 1, 0).normalize(), b = V3(1, 0, 1).normalize(), pts = [];
  for (let k = 0; k <= 20; k++) { const v = a.clone().lerp(b, k / 20).normalize().multiplyScalar(1.6); pts.push(O.clone().add(v)); }
  mPoly(pts, '#c08a1f'); tag('θ', 'ptr alt', -0.3, 1.2, -0.2);
  say('這就是夾角的 cos θ', 'θ = arccos(1/2) = 60°');
  await beat(tok, 3200);
  say('θ = 0°：幾乎一樣；90°：完全不同', '距離 = arccos(d″)，早在 1975 年就有');
  await beat(tok, 1900);
}]);

// 42:10 三個步驟 + 8 個版本的實測時間
FRAG.push(['algmit1-docdist-times', '三步驟；8 個版本 228.1 s → 0.2 s', async (tok) => {
  fresh([0, 3.6, 14], [0, 2.8, 0]);
  const S = ['① 切成 words', '② 算 word 頻率', '③ 內積 → 角度'];
  say('演算法三步驟', 'split → frequencies → dot product');
  for (let i = 0; i < 3; i++) { cube(S[i], M.purple, [2.8, 0.6, 0.8], -4.7, 5.6 - i * 1.0, 0, 2); await beat(tok, 700); }
  await beat(tok, 1200);
  say('8 個實作版本（1 MB 文件）', '228.1 s → 0.2 s：快 1000 倍');
  const T = [228.1, 164, 123, 71, 18.3, 11.5, 1.8, 0.2], X = mX(8, 0.85, 2.3);
  for (let i = 0; i < 8; i++) {
    const h = (Math.log10(T[i]) + 1) * 1.4;
    const b = mBar('', 0.05, i < 4 ? M.orange : M.green, X(i), 0, 0.6);
    await anim(tok, 350, (t) => mSetH(b, 0.05 + (h - 0.05) * t));
    tag(String(T[i]), 'idx', X(i), h + 0.35); tag('v' + (i + 1), 'idx', X(i), -0.35);
  }
  tag('對數刻度', 'idx', 5.6, 5.4);
  await beat(tok, 1400);
  say('v1 → v8：快約 1000 倍', '228.1 / 0.2 ≈ 1140');
  await beat(tok, 1800);
  say('有的是常數優化，有的是 n² → n log n', '輸入變 1 GB，慢版永遠跑不完');
  await beat(tok, 1900);
}]);

// 45:17 用 dict 數頻率（線性 w.h.p.）、排序再數、掃描切字
FRAG.push(['algmit1-doc-count-dict', '用 dict 數 word 頻率：線性時間', async (tok) => {
  fresh([0, 3.8, 13], [0, 2.8, 0]);
  const W = ['the', 'cat', 'and', 'the', 'dog'], X = mX(5, 1.3);
  say('split：掃過字元，非英數就切開', 'Θ(文件長度)；re 不保證線性');
  cube('"the cat and the dog"', M.paper, [5.2, 0.6, 0.4], 0, 6.2, 0, 2);
  await beat(tok, 900);
  const ws = W.map((w, i) => mBox(w, M.blue, X(i), 4.6, 1.0, 0.6, 0.6, 1.5));
  await beat(tok, 1800);
  say('用 dict 數每個 word', 'count[word] += 1：Θ(1) w.h.p.');
  const keys = ['the', 'cat', 'and', 'dog'], KX = mX(4, 1.8), bins = {}, cnt = {};
  keys.forEach((k, i) => { bins[k] = mBox(k + ' : 0', '#e8dcc2', KX(i), 1.2, 1.5, 0.7, 0.7); cnt[k] = 0; });
  for (let i = 0; i < 5; i++) {
    const k = W[i]; glow(ws[i], GOLD); move(ws[i], KX(keys.indexOf(k)), 2.3); await beat(tok, 700);
    kill(ws[i]); cnt[k]++; relabel(bins[k], k + ' : ' + cnt[k]); glow(bins[k], GOLD); await beat(tok, 300); glow(bins[k], null);
  }
  say('總時間 ∝ 所有 word 長度和', '= 文件長度 → 線性 w.h.p.');
  await beat(tok, 2400);
  say('另一法：先排序，再數連續相同', 'sort 之後相同 word 排在一起');
  await beat(tok, 1900);
}]);

// ════════ P7frcB_-g4w（MIT 6.006 Rec1：Asymptotic Complexity, Peak Finding） ════════
// 01:56 只留主導項：放大尺度後雜訊看不見
FRAG.push(['algmit1-dominant-term', '放大尺度：只剩主導項 x²', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.0, 0]);
  const g = (x) => 1.1 * x * x + 8 * Math.pow(x, 1.5) * Math.sin(x), f = (x) => x * x;
  const ax = mAxes('x', 'y');
  say('小尺度：g(x) 抖得很厲害', 'x ∈ [0, 20]');
  const sc = tag('0 … 20', 'idx', 0, -0.2);
  let l1 = mPlot(g, 20, 1300, '#dd8238'), l2 = mPlot(f, 20, 1300, '#4b9ee2');
  tag('g(x)', 'ptr', -5.6, 4.6); tag('x²', 'ptr', -5.6, 3.8);
  await beat(tok, 3200);
  say('把尺度放大一萬倍', 'x ∈ [0, 200000]');
  kill(l1); kill(l2); txt(sc, '0 … 200000');
  l1 = mPlot(g, 2e5, 5.0e10, '#dd8238'); l2 = mPlot(f, 2e5, 5.0e10, '#4b9ee2');
  await beat(tok, 3000);
  say('雜訊（低次項）完全看不見', '低次項成長得比 x² 慢');
  await beat(tok, 2600);
  say('只留主導項，常數也丟掉', 'g(x) = Θ(x²)');
  await beat(tok, 1900);
  void ax;
}]);

// 04:39 Θ：上下界只差常數倍（x² 與 1.2x²）
FRAG.push(['algmit1-theta-bounds', 'Θ：x² ≤ g ≤ 1.2x² 夾住', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.0, 0]);
  mAxes('x', 'y');
  const g = (x) => 1.1 * x * x + 0.6 * Math.pow(x, 1.5) * Math.sin(x);
  say('一個複雜的 g(x)', '≈ 1.1x² 加上抖動的低次項');
  mPlot(g, 100, 1.3e4, '#dd8238', { N: 220 });
  await beat(tok, 2400);
  say('下界：x²', 'g(x) ≥ 1·x²（x 夠大）');
  mPlot((x) => x * x, 100, 1.3e4, '#2fc092'); tag('x²', 'ptr', 5.5, 0.3 + 5.6 * 1e4 / 1.3e4);
  await beat(tok, 2400);
  say('上界：1.2x²', 'g(x) ≤ 1.2·x²');
  mPlot((x) => 1.2 * x * x, 100, 1.3e4, '#9b7ef4'); tag('1.2x²', 'ptr', 5.7, 5.5);
  await beat(tok, 2400);
  say('上下界只差常數倍 → Θ', 'g(x) = Θ(x²)');
  await beat(tok, 2400);
  say('筆記常寫 O，多半其實指 Θ', 'Ω 下界、O 上界、Θ 兩者都有');
  await beat(tok, 1900);
}]);

// 07:25 O：x(1 + sin x) ≤ 2x，但沒有好的下界
FRAG.push(['algmit1-bigo-sine', 'O：x(1 + sin x) ≤ 2x', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.0, 0]);
  mAxes('x', 'y');
  say('g(x) = x(1 + sin x)', '無限多次碰到 0');
  mPlot((x) => x * (1 + Math.sin(x)), 30, 64, '#dd8238', { N: 240 });
  await beat(tok, 3000);
  say('但永遠不超過 2x', 'g(x) ≤ 2x');
  mPlot((x) => 2 * x, 30, 64, '#9b7ef4'); tag('2x', 'ptr', 5.5, 5.6);
  await beat(tok, 2400);
  say('下界只能是 0 → 只有上界', 'g(x) = O(x)，不是 Θ(x)');
  await beat(tok, 3200);
  say('實務最在意 worst case 保證', '例：搜尋要在 200 ms 內回應');
  await beat(tok, 1900);
}]);

// 10:41 沒有 Θ：(1 + sin x)·x^1.5 + x^1.4 介於 x^1.4 與 3x^1.5
FRAG.push(['algmit1-no-theta', '上下界指數不同 → 沒有 Θ', async (tok) => {
  fresh([0, 3.4, 12], [0, 3.0, 0]);
  mAxes('x', 'y');
  const X = 60, Y = 1450;
  say('一個抖動很大的函數', 'g(x) = (1 + sin x)·x^1.5 + x^1.4');
  mPlot((x) => (1 + Math.sin(x)) * Math.pow(x, 1.5) + Math.pow(x, 1.4), X, Y, '#dd8238', { N: 260 });
  await beat(tok, 2600);
  say('下界 x^1.4（sin x = −1 時碰到）', 'g(x) ≥ x^1.4');
  mPlot((x) => Math.pow(x, 1.4), X, Y, '#2fc092'); tag('x^1.4', 'ptr', 5.7, 0.3 + 5.6 * Math.pow(60, 1.4) / Y);
  await beat(tok, 2400);
  say('上界 3·x^1.5', 'g(x) ≤ 2x^1.5 + x^1.4 ≤ 3x^1.5');
  mPlot((x) => 3 * Math.pow(x, 1.5), X, Y, '#9b7ef4'); tag('3x^1.5', 'ptr', 5.7, 5.6);
  await beat(tok, 2400);
  say('兩個界的指數不同：不只差常數', '寫不出 Θ(·)');
  await beat(tok, 2400);
  say('只能寫 Ω 與 O', 'g = Ω(x^1.4)，g = O(x^1.5)');
  await beat(tok, 1900);
}]);

// 13:30 本課常見的五種 + 15:23 練習：10⁸⁰、(20n)⁷、log n¹⁰⁰、log₅ n
FRAG.push(['algmit1-asym-ex1', '化簡練習：10⁸⁰、(20n)⁷、log n¹⁰⁰、log₅ n', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.0, 0]);
  const R = [['10⁸⁰', 'Θ(1)', '10⁸⁰ ≈ 宇宙原子數，仍是常數', '跟 n 無關 → Θ(1)'],
    ['(20n)⁷', 'Θ(n⁷)', '指數分配進去', '20⁷·n⁷，20⁷ 是常數'],
    ['log n¹⁰⁰', 'Θ(log n)', '指數拉到 log 前面', '= 100·log n'],
    ['log₅ n', 'Θ(log n)', '換底只差常數倍', '= log n / log 5']];
  for (let i = 0; i < 4; i++) {
    const y = 5.6 - i * 1.4;
    say(R[i][2], R[i][3]);
    cube(R[i][0], M.paper, [2.4, 0.7, 0.8], -2.8, y, 0, 2);
    await beat(tok, 1500);
    line(-1.5, y, 1.4, y, 0, M.brown); tag('→', 'idx', 0, y + 0.3);
    const a = cube(R[i][1], M.green, [2.2, 0.7, 0.8], 2.8, y, 0, 2); glow(a, GREEN);
    await beat(tok, 1900); glow(a, null);
  }
  say('log 裡的指數與底數 → 常數', '本課答案多半是 1、log n、n、n log n、n²');
  await beat(tok, 1900);
}]);

// 20:18 CS 的 log 底數是 2；log log n 的兩題
FRAG.push(['algmit1-loglog', 'log 的底數與 log log n', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.0, 0]);
  say('CS 的「自然」底數是 2', 'log n = log₂ n；ln = 底數 e');
  cube('lg n = log₂ n', M.teal, [3.2, 0.7, 0.8], 0, 6.0, 0, 2);
  await beat(tok, 2400);
  say('底數拿掉、指數拿掉', 'log(log₁₀₀ n) = log(log n / log 100)');
  const a = cube('log(log₁₀₀ n)', M.paper, [5.6, 0.7, 0.8], 0, 4.4, 0, 2);
  await beat(tok, 1800);
  relabel(a, 'log log n − log log 100'); await beat(tok, 1600);
  relabel(a, 'Θ(log log n)'); glow(a, GREEN);
  await beat(tok, 2000);
  say('難一點：log₅(log n¹⁰⁰)', '底數 5 只是常數倍');
  const b = cube('log₅(log n¹⁰⁰)', M.paper, [5.6, 0.7, 0.8], 0, 2.6, 0, 2);
  await beat(tok, 1800);
  say('裡面的 100 變成乘法', '≈ log(100·log n)');
  relabel(b, '≈ log(100 · log n)'); await beat(tok, 1800);
  say('log 把乘法變加法', '= log 100 + log log n');
  relabel(b, 'log 100 + log log n'); await beat(tok, 1800);
  say('常數項被 log log n 蓋過', 'Θ(log log n)');
  relabel(b, 'Θ(log log n)'); glow(b, GREEN);
  await beat(tok, 1900);
}]);

// 24:01 log C(n, n/2) 用 Stirling → Θ(n)
FRAG.push(['algmit1-log-binom', 'log C(n, n/2) = Θ(n)（Stirling）', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.4, 0]);
  const S = [['log C(n, n/2)', '目標：化簡這個式子', '先展開組合數'],
    ['= log [ n! / ((n/2)!)² ]', 'C(n, k) = n! / (k!(n−k)!)', 'k = n/2'],
    ['n! ≈ √(2πn) · (n/e)ⁿ', 'Stirling 近似', '套到 n! 和 (n/2)!'],
    ['C(n, n/2) ≈ 2ⁿ / √(πn/2)', '(n/e)ⁿ ÷ (n/2e)ⁿ = 2ⁿ', '根號部分剩 √(πn/2)'],
    ['log ≈ n − ½·log n + 常數', 'log 2ⁿ − log √(πn/2)', '½ log n 比 n 小很多'],
    ['= Θ(n)', '只留主導項', '果然是常見的五種之一']];
  for (let i = 0; i < S.length; i++) {
    say(S[i][1], S[i][2]);
    const c = cube(S[i][0], i === S.length - 1 ? M.green : M.paper, [5.8, 0.7, 0.8], 0, 6.6 - i * 1.15, 0, 2);
    if (i === S.length - 1) glow(c, GREEN);
    await beat(tok, 2600);
  }
  await beat(tok, 1400);
}]);

// 31:37 1D peak 的 pseudocode：3 4 5 6 7 6 5 4
FRAG.push(['algmit1-rec-peak1d', '1D peak：3 4 5 6 7 6 5 4', async (tok) => {
  fresh([0, 4.4, 14], [0, 3.4, 0]);
  const A = [3, 4, 5, 6, 7, 6, 5, 4], X = mX(8, 1.1);
  const bs = A.map((v, i) => mBar(v, v * 0.6, M.blue, X(i)));
  const cd = code(['1. 看中間元素                         Θ(1)', '2. 看兩鄰：是 local peak 就結束       Θ(1)', '3. 否則往較大的鄰居那半遞迴          T(n/2)'], 0, 7.6, 0.55);
  say('像 binary search 一樣', '陣列 3 4 5 6 7 6 5 4');
  await beat(tok, 1800);
  cd.hl(0); glow(bs[3], GOLD); let cur = tag('mid', 'ptr', X(3), 4.4);
  say('中間是 6', '看 a[4] = 6'); await beat(tok, 1500);
  cd.hl(1); glow(bs[4], RED); say('右鄰 7 > 6：不是 peak', '兩邊都要檢查'); await beat(tok, 1900);
  cd.hl(2); for (let i = 0; i <= 3; i++) { tint(bs[i], GRAY); glow(bs[i], null); } glow(bs[4], null); kill(cur);
  say('往右半遞迴：7 6 5 4', '問題大小剩 n/2'); await beat(tok, 1600);
  cd.hl(0); glow(bs[5], GOLD); cur = tag('mid', 'ptr', X(5), 4.4); await beat(tok, 1200);
  cd.hl(1); glow(bs[4], RED); say('左鄰 7 > 6：往左', '剩一個元素：7'); await beat(tok, 1800);
  for (let i = 5; i < 8; i++) { tint(bs[i], GRAY); glow(bs[i], null); } kill(cur);
  glow(bs[4], GREEN); tag('peak', 'ptr alt', X(4), 5.0);
  say('只剩一個元素 → 一定是 peak', 'base case');
  await beat(tok, 2000);
  say('每一步的時間加起來', 'T(n) = Θ(1) + Θ(1) + T(n/2)');
  await beat(tok, 1900);
}]);

// 38:30 展開遞迴式：i·c + T(n/2ⁱ)，令 n/2ⁱ = 1
FRAG.push(['algmit1-rec-unroll', '展開 T(n) = c + T(n/2) → Θ(log n)', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.2, 0]);
  const S = [['T(n) = c + T(n/2)', 'Θ(1) 寫成常數 c', '用定義展開'],
    ['= 2c + T(n/4)', '再展開一次', 'T(n/2) = c + T(n/4)'],
    ['= i·c + T(n/2ⁱ)', '看出規律', '展開 i 次'],
    ['n/2ⁱ = 1 ⇒ i = log n', '停在 base case：T(1) = Θ(1)', '一個元素一定是 peak'],
    ['T(n) = c·log n + Θ(1)', '代回 i = log n', '= Θ(log n)']];
  const ws = [3.2, 1.6, 0.8, 0.4, 0.2];
  for (let i = 0; i < S.length; i++) {
    say(S[i][1], S[i][2]);
    const c = cube(S[i][0], i === S.length - 1 ? M.green : M.paper, [4.8, 0.7, 0.8], -2.4, 6.4 - i * 1.25, 0, 2);
    cube(i < 4 ? ['n', 'n/2', 'n/4', '1'][i] : '', M.blue, [ws[i], 0.5, 0.6], 3.6, 6.4 - i * 1.25, 0, 1.5);
    if (i === S.length - 1) glow(c, GREEN);
    await beat(tok, 2800);
  }
  say('log n 主導常數', 'T(n) = Θ(log n)');
  await beat(tok, 1900);
}]);

// 52:42 變形：column 改找 1D peak（binary search）→ log m 取代 m
FRAG.push(['algmit1-variation', '變形：column 改用 1D peak，Θ(m) → Θ(log m)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const V = [1, 3, 4, 6, 8, 9, 12, 14, 15, 13, 11, 10, 7, 5, 2, 0], dy = 0.38;
  const colA = V.map((v, i) => mBox(v, M.sand, -3.0, 6.4 - i * dy, 0.7, 0.34, 0.5));
  const colB = V.map((v, i) => mBox(v, M.sand, 3.0, 6.4 - i * dy, 0.7, 0.34, 0.5));
  tag('找最大：掃 m 格', 'ptr', -3.0, 7.0); tag('1D peak：binary search', 'ptr', 3.0, 7.0);
  say('原版：每層掃整欄找最大', 'Θ(m) per level');
  for (const c of colA) { glow(c, GOLD); await beat(tok, 120); }
  glow(colA[8], GREEN); await beat(tok, 1200);
  say('變形：每層只找 column 的 1D peak', 'Θ(log m) per level');
  for (const i of [7, 11, 9, 8]) { glow(colB[i], GOLD); await beat(tok, 700); }
  glow(colB[8], GREEN);
  tag('16 格 vs 4 格', 'ptr alt', 0, 0.2);
  await beat(tok, 1800);
  say('每層 Θ(m) 變 Θ(log m)', 'Θ(m log n) → Θ(log m · log n)');
  await beat(tok, 2600);
  say('m = 10⁶ 時快約 m / log m 倍', '≈ 10⁶ / 20 = 5×10⁴；正確性要另外證明');
  await beat(tok, 1900);
}]);

// ════════ QFcyt8fgQMU（MIT 6.006 Rec2：Python Cost Model, Document Distance） ════════
const FOX1 = ['the', 'fox', 'is', 'in', 'the', 'hat'], FOX2 = ['the', 'fox', 'is', 'outside'];
// 01:30 D1 = The fox is in the hat.、D2 = The fox is outside. → 文件向量
FRAG.push(['algmit1-fox-vectors', '文件向量：The fox is in the hat.', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.0, 0]);
  cube('D1 = "The fox is in the hat."', M.paper, [5.6, 0.6, 0.4], 0, 6.9, 0, 2);
  cube('D2 = "The fox is outside."', M.paper, [5.6, 0.6, 0.4], 0, 6.1, 0, 2);
  say('兩份文件', '先切成 words');
  await beat(tok, 1800);
  async function build(words, keys, y, yb) {
    const X = mX(words.length, 1.05), KX = mX(keys.length, 1.5), bins = {}, cnt = {};
    const ws = words.map((w, i) => mBox(w, M.blue, X(i), y, 0.95, 0.55, 0.55, 1.2));
    await beat(tok, 900);
    keys.forEach((k, i) => { bins[k] = mBox(k + ' 0', '#e8dcc2', KX(i), yb, 1.35, 0.6, 0.6); cnt[k] = 0; });
    for (let i = 0; i < words.length; i++) {
      const k = words[i]; move(ws[i], KX(keys.indexOf(k)), yb + 0.8); await beat(tok, 380);
      kill(ws[i]); cnt[k]++; relabel(bins[k], k + ' ' + cnt[k]);
    }
    return bins;
  }
  say('全部轉小寫、去掉標點', '"The" 和 "the" 算同一個');
  const b1 = await build(FOX1, ['the', 'fox', 'is', 'in', 'hat'], 4.8, 3.6);
  glow(b1.the, GOLD); tag('D1', 'ptr', -4.6, 3.6);
  say('D1 的向量：the 出現 2 次', 'the 2、fox 1、is 1、in 1、hat 1');
  await beat(tok, 2200);
  const b2 = await build(FOX2, ['the', 'fox', 'is', 'outside'], 2.0, 0.8);
  tag('D2', 'ptr', -4.6, 0.8);
  say('D2 的向量', 'the 1、fox 1、is 1、outside 1');
  await beat(tok, 1900);
  void b2;
}]);

// 04:48 內積：只走一個向量，到另一個去查
FRAG.push(['algmit1-fox-inner', '內積：走 D1、到 D2 查，= 4', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.8, 0]);
  const K1 = [['the', 2], ['fox', 1], ['is', 1], ['in', 1], ['hat', 1]], K2 = { the: 1, fox: 1, is: 1, outside: 1 };
  const X1 = [-4, -2, 0, 2, 4], X2 = { the: -4, fox: -2, is: 0, outside: 3 };
  const r1 = K1.map(([k, c], i) => mBox(k + ' ' + c, M.blue, X1[i], 4.2, 1.5, 0.6, 0.6, 1.5));
  const r2 = {}; for (const k in K2) r2[k] = mBox(k + ' ' + K2[k], M.orange, X2[k], 1.6, 1.5, 0.6, 0.6, 1.5);
  tag('D1', 'ptr', -6.0, 4.2); tag('D2', 'ptr', -6.0, 1.6);
  const sum = tag('sum = 0', 'ptr alt', 0, 6.2);
  say('只走一個向量，到另一個查', '查不到的 word 貢獻 0');
  await beat(tok, 2000);
  let s = 0;
  for (let i = 0; i < K1.length; i++) {
    const [k, c] = K1[i]; glow(r1[i], GOLD); await beat(tok, 500);
    if (K2[k]) { glow(r2[k], GOLD); s += c * K2[k]; say(k + '：' + c + ' × ' + K2[k], 'sum = ' + s); }
    else say(k + '：D2 沒有', '貢獻 0');
    txt(sum, 'sum = ' + s); await beat(tok, 1300);
    glow(r1[i], null); if (K2[k]) glow(r2[k], null);
  }
  say('inner product = 4', '2·1 + 1·1 + 1·1 = 4');
  await beat(tok, 1900);
}]);

// 07:07 由上而下讀 docdist1：main 的呼叫樹
FRAG.push(['algmit1-call-tree', 'docdist1 的呼叫樹（top-down）', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const N = (t, x, y, c) => cube(t, c || M.paper, [3.0, 0.6, 0.6], x, y, 0, 1.5);
  say('讀大程式：從 main 開始往下看', '畫出「誰呼叫誰」');
  const m = N('main', 0, 6.4, M.purple); await beat(tok, 1400);
  const a = N('word_freq_for_file ×2', -3.2, 4.8); line(0, 6.1, -3.2, 5.1); await beat(tok, 900);
  const b = N('vector_angle', 3.2, 4.8); line(0, 6.1, 3.2, 5.1); await beat(tok, 900);
  say('第 7、8 行：兩份文件各做步驟 ①②', '第 9 行：vector_angle 做步驟 ③');
  await beat(tok, 2200);
  N('get_words_from_line_list', -4.4, 3.0); line(-3.2, 4.5, -4.4, 3.3); await beat(tok, 700);
  N('count_frequency', -1.1, 3.0); line(-3.2, 4.5, -1.1, 3.3); await beat(tok, 700);
  N('get_words_from_string', -4.4, 1.3); line(-4.4, 2.7, -4.4, 1.6); await beat(tok, 700);
  N('inner_product ×3', 3.2, 3.0); line(3.2, 4.5, 3.2, 3.3);
  say('讀檔不管，只看演算法部分', 'vector_angle 呼叫 inner_product 三次');
  await beat(tok, 2600);
  say('父函式時間 = 子函式時間加總', '每個版本做一張 scorecard');
  glow(m, GOLD); glow(a, GOLD); glow(b, GOLD);
  await beat(tok, 1900);
}]);

// 12:18 get_words_from_string：每行 cost × 執行次數
FRAG.push(['algmit1-gwfs-cost', 'get_words_from_string：cost × times = O(n)', async (tok) => {
  fresh([0, 3.6, 13.5], [0, 3.8, 0]);
  const L = [' 9 word_list = []', '10 character_list = []', '11 for c in line:', '12   if c.isalnum():', '13     character_list.append(c)',
    '14   elif len(character_list) > 0:', '15     word = "".join(character_list)', '16     word = word.lower()', '17     word_list.append(word)',
    '18     character_list = []', '19 if len(character_list) > 0:', '20   word = "".join(character_list)', '21   word = word.lower()',
    '22   word_list.append(word)', '23 return word_list'];
  const C = [['1', '1'], ['1', '1'], ['1', 'n'], ['1', 'n'], ['1', 'n·w/(w+1)'], ['1', 'n/(w+1)'], ['w', 'n/(w+1)'], ['w', 'n/(w+1)'], ['1', 'n/(w+1)'], ['1', 'n/(w+1)'],
    ['1', '1'], ['w', '1'], ['w', '1'], ['1', '1'], ['1', '1']];
  const dy = 0.44, y0 = 7.4, cd = code(L, -2.4, y0, dy);
  tag('cost', 'ptr', 2.6, y0 + 0.55); tag('times', 'ptr', 4.6, y0 + 0.55);
  say('一行 n 個字元、每個 word w 個字元', '約 n/(w+1) 個 word');
  await beat(tok, 2400);
  const notes = { 2: ['for：每個字元一次', 'n 次'], 4: ['append：Θ(1)', 'table doubling'], 6: ['join / lower：Θ(w)', '每個 word 一次'], 10: ['19–22：收最後一個 word', '最多一次'] };
  for (let i = 0; i < L.length; i++) {
    cd.hl(i); if (notes[i]) say(notes[i][0], notes[i][1]);
    tag(C[i][0], 'idx', 2.6, y0 - i * dy); tag(C[i][1], 'idx', 4.6, y0 - i * dy);
    await beat(tok, notes[i] ? 1500 : 550);
  }
  cd.hl(-1);
  say('cost × times 全部加起來', 'O(n + 1) = O(n)（w 是常數）');
  await beat(tok, 1900);
}]);

// 18:40 跑一次 "The fox is␣␣outside"：連續空白靠長度檢查、最後一個 word 靠 19–22 行
FRAG.push(['algmit1-gwfs-trace', '追蹤 "The fox is␣␣outside"', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const S = 'The fox is  outside', X = mX(S.length, 0.36);
  const ch = S.split('').map((c, i) => mBox(c === ' ' ? '␣' : c, c === ' ' ? GRAY : M.paper, X(i), 6.0, 0.32, 0.4, 0.32));
  tag('character_list', 'ptr', -4.6, 4.2); tag('word_list', 'ptr', -4.6, 1.6);
  const cur = tag('▼', 'ptr alt', X(0), 6.6);
  say('一個字元一個字元掃', '英數字元 → 放進 character_list');
  let buf = [], words = 0;
  async function flush(last) {
    const w = buf.map((m) => m.userData.lbl.element.textContent).join('').toLowerCase();
    buf.forEach(kill); buf = [];
    const m = mBox(w, last ? M.orange : M.blue, -2.6 + words * 1.8, 1.6, 1.6, 0.6, 0.6, 1.5); glow(m, GOLD); words++;
    await beat(tok, 500); glow(m, null);
  }
  for (let i = 0; i < S.length; i++) {
    cur.position.set(X(i), 6.6, 0);
    if (S[i] !== ' ') {
      buf.push(mBox(S[i], M.blue, -2.6 + buf.length * 0.45, 4.2, 0.4, 0.45, 0.4)); await beat(tok, 200);
    } else if (buf.length) {
      if (!words) say('遇到空白：join + lower → word', '"The" → "the"');
      glow(ch[i], GOLD); await beat(tok, 350); await flush(false); glow(ch[i], null);
      if (!words || words === 1) await beat(tok, 900);
    } else {
      glow(ch[i], RED);
      say('連續空白：character_list 是空的', 'len(character_list) > 0 擋掉空 word');
      await beat(tok, 2400); glow(ch[i], null);
    }
  }
  say('迴圈結束，outside 還留在 buffer', '19–22 行：把最後一個 word 收進來');
  await beat(tok, 1800); await flush(true);
  say('得到 4 個 word', 'word_list = [the, fox, is, outside]');
  await beat(tok, 1900);
}]);

// 32:06 + 與 extend：c = a + b 複製 1003 個；a.extend(b) 只花 3
FRAG.push(['algmit1-plus-vs-extend', 'a + b 複製全部；a.extend(b) 只花 |b|', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.0, 0]);
  const a = cube('a = [1, 2, …, 1000]', M.blue, [6.0, 0.7, 0.8], -2.2, 5.0, 0, 2);
  const b = mRow([1, 2, 3], 3.6, { cx: 4.0, gap: 0.8, s: 0.7, col: M.orange, drop: 2 }); tag('b', 'ptr', 2.6, 3.6);
  say('c = a + b：a、b 都不能被改', '只好建立新 list，全部複製');
  await beat(tok, 2000);
  const c = cube('', M.green, [0.1, 0.7, 0.8], -5.2, 1.6, 0); tag('c', 'ptr', -5.9, 1.6);
  const cnt = tag('複製 0', 'ptr alt', 3.6, 1.6);
  glow(a, GOLD);
  await anim(tok, 2200, (t) => { const w = 0.1 + 7.9 * t; c.scale.x = w / 0.1; c.position.x = -5.2 + w / 2; txt(cnt, '複製 ' + Math.round(1003 * t)); });
  glow(a, null);
  say('cost = 1000 + 3 = 1003', 'Θ(|a| + |b|)');
  await beat(tok, 2400);
  say('a.extend(b)：逐一 append', 'Θ(|b|) = 3');
  for (let i = 0; i < 3; i++) { const m = mBox(i + 1, M.orange, b[i].position.x, 3.6); move(m, 1.3 + i * 0.8, 5.0); glow(b[i], GOLD); await beat(tok, 600); }
  await beat(tok, 1400);
  say('a 有一百萬個也一樣只花 3', '迴圈裡累積 list 要用 extend');
  await beat(tok, 1900);
}]);

// 34:11 word_list = word_list + words_in_line：k + 2k + … + zk = Θ(W²)
FRAG.push(['algmit1-quadratic-concat', '迴圈裡用 +：k + 2k + … + zk = Θ(W²)', async (tok) => {
  fresh([0, 3.8, 14], [0, 3.0, 0]);
  cube('for line in L: word_list = word_list + words_in_line', M.paper, [9.2, 0.6, 0.4], 0, 7.0, 0, 2);
  say('z 行，每行 k 個 word', '第 t 次 + 要複製 (t−1)k + k = tk 個');
  const z = 6, X = mX(z, 1.2), bs = [];
  await beat(tok, 1800);
  for (let t = 1; t <= z; t++) {
    const b = mBar('', 0.05, M.orange, X(t - 1), 0, 0.8); bs.push(b);
    await anim(tok, 400, (u) => mSetH(b, 0.05 + (t * 0.8 - 0.05) * u));
    tag(t + 'k', 'idx', X(t - 1), t * 0.8 + 0.35); tag('line ' + t, 'idx', X(t - 1), -0.35);
    await beat(tok, 250);
  }
  say('總共 k(1 + 2 + … + z)', '= Θ(z²k)');
  await beat(tok, 2400);
  say('W = z·k 個 word，k（每行字數）是常數', 'Θ(W² / k) = Θ(W²)');
  await beat(tok, 2600);
  say('改成 extend：每行只花 k', '總共 Θ(W)（docdist2）');
  for (const b of bs) tint(b, M.green);
  await anim(tok, 1200, (u) => bs.forEach((b, i) => mSetH(b, (i + 1) * 0.8 + (0.8 - (i + 1) * 0.8) * u)));
  await beat(tok, 1900);
}]);

// 40:31 inner_product 的兩層迴圈：L1 × L2 次比較；字串 == 是 Θ(w)
FRAG.push(['algmit1-inner-nested', 'inner_product：兩層迴圈 Θ(L1·L2)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.2, 0]);
  const cd = code(['def inner_product(L1, L2):', '  sum = 0.0', '  for word1, count1 in L1:', '    for word2, count2 in L2:', '      if word1 == word2:', '        sum += count1 * count2', '  return sum'], -3.4, 6.8, 0.5);
  const A = ['the', 'fox', 'is', 'in', 'hat'], B = ['the', 'fox', 'is', 'out'], gx = 0.8, gy = 0.62;
  const X = mX(4, gx, 3.6), Y = (i) => 6.0 - i * gy;
  B.forEach((w, j) => tag(w, 'idx', X(j), 6.6)); A.forEach((w, i) => tag(w, 'idx', 1.7, Y(i)));
  const cells = A.map((_, i) => B.map((_, j) => mBox('', '#e8dcc2', X(j), Y(i), 0.6, 0.45, 0.45)));
  say('L1 的每個 word × L2 的每個 word', '第 4–6 行跑 L1·L2 次');
  cd.hl(3); await beat(tok, 1400);
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    const hit = A[i] === B[j]; glow(cells[i][j], hit ? GREEN : GOLD); if (hit) tint(cells[i][j], M.green);
    await beat(tok, 160); if (!hit) glow(cells[i][j], null);
  }
  say('5 × 4 = 20 次比較', 'Θ(L1·L2)');
  await beat(tok, 2000);
  cd.hl(4);
  say('字串 == 不是 Θ(1)', '"fox" vs "foy"：比到第 3 個字元');
  const f1 = mRow(['f', 'o', 'x'], 1.6, { cx: 1.6, gap: 0.6, s: 0.5, col: M.blue }), f2 = mRow(['f', 'o', 'y'], 0.8, { cx: 1.6, gap: 0.6, s: 0.5, col: M.blue });
  for (let k = 0; k < 3; k++) { glow(f1[k], k < 2 ? GREEN : RED); glow(f2[k], k < 2 ? GREEN : RED); await beat(tok, 600); }
  tag('Θ(w)', 'ptr alt', 3.6, 1.2);
  await beat(tok, 1600);
  cd.hl(5);
  say('sum += 數字：Θ(1)', '這裡的 + 是數字相加，不是 list');
  await beat(tok, 1900);
}]);

// 45:11 vector_angle 呼叫三次 → L1·L2 + L1² + L2²；main 總時間
FRAG.push(['algmit1-total-cost', 'docdist1 總時間：Θ(W1² + W2²)', async (tok) => {
  fresh([0, 3.6, 13.5], [0, 3.4, 0]);
  const S = [['inner_product(L1, L2)  →  L1·L2', 'vector_angle：分子', '第 2 行'],
    ['inner_product(L1, L1)  →  L1²', '分母還要算兩次', '第 3 行：自己跟自己'],
    ['inner_product(L2, L2)  →  L2²', 'L1 = 1000、L2 = 1 時', 'L1² 項不能丟掉'],
    ['word_freq_for_file ×2  →  W1² + W2²', '兩份文件字數不同', '不能都寫成 W²'],
    ['main = W1² + W2² + L1·L2 + L1² + L2²', '把所有部分加起來', 'L = 不重複字數 ≤ W']];
  for (let i = 0; i < S.length; i++) {
    say(S[i][1], S[i][2]);
    cube(S[i][0], M.paper, [7.4, 0.65, 0.6], 0, 6.6 - i * 1.1, 0, 2);
    await beat(tok, 2500);
  }
  const f = cube('= Θ(W1² + W2²)', M.green, [4.4, 0.7, 0.6], 0, 0.9, 0, 2); glow(f, GREEN);
  say('L 項都被 W 項蓋過', 'L1² ≤ W1²，L1·L2 ≤ (W1² + W2²)/2');
  await beat(tok, 1900);
}]);
  }

  // ═══ algmit2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY } = K;
// ─── MIT 6.006（Fall 2011）：Rec5 Recursion Trees / BST（r5pXu1PAUkI）、L8 Hashing with Chaining（0M_kIqhwbFo）、
//     L9 Table Doubling / Karp-Rabin（BRO7mVIFt08）、L10 Open Addressing / Cryptographic Hashing（rvdJDijO2Ro）───
// 老師自己的例子：BST 23 / 8 / 42 / 4 / 16 / 15、insert 14 與 5、delete 15 / 16 / 8、augment 存 min 再 insert 3；
// direct access 的 key 2、4；hash('\0B') = hash('\0\0C') = 64；m = 8 開始、第 9 個觸發 grow；s = '6006'；
// open addressing 7 格：586→1、133、204→4、481→6、496 試 4 → 1 → 3；linear probing 42 … 57。
// 老師沒給數字的地方（merge sort 陣列、heap、division/multiplication/universal 的 key、t 字串、mod 17）標「示意」。
const M2 = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', red: '#d64545', teal: '#31aab0', gold: '#c08a1f', sand: '#c9b48e', pink: '#e55a9b' };
function m2bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0.0005, z); lab.world.add(m); return m; }
function m2set(m, h) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = v / 2; }
// BST：spec = [[key, x, y, parentKey]]（父節點先列）
function m2tree(spec, color) {
  const N = {};
  for (const [k, x, y, p] of spec) {
    N[k] = cube(k, color || M2.blue, [0.9, 0.9, 0.9], x, y, 0);
    if (p !== null) N[k].userData.edge = line(N[p].position.x, N[p].position.y, x, y, -0.05);
  }
  return N;
}
const M2BST = [[23, 0, 6.2, null], [8, -3, 4.7, 23], [42, 3, 4.7, 23], [4, -4.6, 3.2, 8], [16, -1.4, 3.2, 8], [15, -2.2, 1.7, 16]];
async function m2go(tok, cur, x, y, ms = 450) { const a = cur.position.clone(), b = V3(x, y + 0.85, 0); await anim(tok, ms, (t) => cur.position.lerpVectors(a, b, t)); }
async function m2goN(tok, cur, m, ms) { await m2go(tok, cur, m.position.x, m.position.y, ms); }
// 一排 hash table 格子（沿 x），回傳 X(i)
function m2row(m, x0, dx, z, w = 0.9, idx = (i) => String(i)) {
  for (let i = 0; i < m; i++) { cube('', GRAY, [w, 0.12, w], x0 + i * dx, 0.06, z); tag(idx(i), 'idx', x0 + i * dx, 0, z + w / 2 + 0.35); }
  return (i) => x0 + i * dx;
}
const m2item = (v, color, x, z, drop = 0, w = 0.9, y = 0.45) => cube(v, color, [w, 0.6, w], x, y, z, drop);

// ══════════════ r5pXu1PAUkI：Rec5 Recursion Trees, Binary Search Trees ══════════════
FRAG.push(['algmit2-ms-recurrence', 'Merge sort 的遞迴式：2T(n/2) + Θ(n)', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const X = (i) => -4.2 + i * 1.2;
  const cs = [5, 2, 4, 7, 1, 3, 2, 6].map((v, i) => cube(v, M2.sand, [1, 0.8, 0.8], X(i), 6, 0));
  tag('大小 n', 'ptr', 5.9, 6);
  say('Merge sort：陣列切成兩半', '示意 n = 8');
  await beat(tok, 2200);
  cs.forEach((c, i) => move(c, X(i) + (i < 4 ? -0.6 : 0.6), 4.2));
  tag('T(n/2)', 'ptr alt', -2.4, 3.3); tag('T(n/2)', 'ptr alt', 2.4, 3.3);
  say('兩半各呼叫一次 merge sort', '呼叫兩次 → 係數 2 不能漏');
  await beat(tok, 2600);
  const L = [2, 4, 5, 7], R = [1, 2, 3, 6];
  for (let i = 0; i < 4; i++) { relabel(cs[i], L[i]); relabel(cs[i + 4], R[i]); tint(cs[i], M2.green); tint(cs[i + 4], M2.green); }
  say('假設遞迴回來兩半都排好', 'base case：1 個元素已排好，T(1) = Θ(1)');
  await beat(tok, 2600);
  say('合併：兩根手指比大小', '每步放好一個 → merge = Θ(n)');
  let i = 0, j = 0;
  for (let k = 0; k < 8; k++) {
    const takeL = j >= 4 || (i < 4 && L[i] <= R[j]);
    const c = takeL ? cs[i] : cs[4 + j];
    glow(c, GOLD); await beat(tok, 350);
    move(c, X(k), 1.2); glow(c, null);
    if (takeL) i++; else j++;
    await beat(tok, 450);
  }
  say('T(n) = 2T(n/2) + Θ(n)', '切開是 O(1) 或 O(n) 都不影響答案');
  await beat(tok, 3000);
}]);

const M2LV = [{ y: 6.2, cnt: 1, lab: 'cn', sz: 'n/2⁰' }, { y: 4.7, cnt: 2, lab: 'cn/2', sz: 'n/2¹' }, { y: 3.2, cnt: 4, lab: 'cn/4', sz: 'n/2²' }, { y: 1.0, cnt: 8, lab: 'c', sz: '1' }];
function m2msLevel(rows, l) {
  const L = M2LV[l], xs = [], ms = [];
  for (let k = 0; k < L.cnt; k++) {
    const x = -4.6 + (k + 0.5) * 9.2 / L.cnt; xs.push(x);
    ms.push(cube(L.lab, l === 3 ? M2.green : M2.blue, [l === 3 ? 0.9 : 1.3, 0.6, 0.6], x, L.y, 0));
    if (l > 0 && l < 3) line(rows[l - 1].xs[k >> 1], M2LV[l - 1].y - 0.3, x, L.y + 0.3);
  }
  if (l === 3) { tag('⋮', 'ptr', -2.3, 2.1); tag('⋮', 'ptr', 2.3, 2.1); }
  rows.push({ xs, ms });
  return rows[l];
}

FRAG.push(['algmit2-ms-rtree', '遞迴樹：節點成本 cn、層數 log n + 1', async (tok) => {
  fresh([0, 3.8, 14], [0, 3.4, 0]);
  const rows = [];
  m2msLevel(rows, 0);
  say('根：這次呼叫自己的成本', '不含子呼叫；Θ(n) 改寫成 cn');
  await beat(tok, 2600);
  say('為什麼寫 cn 不寫 Θ(n)？', '無限多個 Θ 不能直接相加；用 c 永遠不會錯');
  await beat(tok, 2600);
  m2msLevel(rows, 1);
  say('兩個子呼叫，大小 n/2', '成本各 c·n/2');
  await beat(tok, 2200);
  m2msLevel(rows, 2);
  say('再往下：c·n/4', '一直切到 base case');
  await beat(tok, 2000);
  m2msLevel(rows, 3);
  say('葉子：大小 1，成本 c', 'T(1) = Θ(1)');
  await beat(tok, 2200);
  M2LV.forEach((L, l) => { tag(L.sz, 'idx', 6.0, L.y); tag(l === 3 ? 'L' : 'ℓ = ' + (l + 1), 'ptr', -6.2, L.y); });
  say('第 ℓ 層大小 = n / 2^(ℓ−1)', '看出規律；兩層不夠就多展開幾層');
  await beat(tok, 3000);
  rows[3].ms.forEach((m) => glow(m, GOLD));
  say('最底層大小 = 1', 'n / 2^(L−1) = 1 → n = 2^(L−1)');
  await beat(tok, 2800);
  say('指數的反函數是 log', 'L − 1 = log n → L = log n + 1 ≈ log n');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit2-rtree-sum', '遞迴樹逐層加總：cn × (log n + 1)', async (tok) => {
  fresh([0, 3.8, 14], [0, 3.4, 0]);
  const rows = []; for (let l = 0; l < 4; l++) m2msLevel(rows, l);
  tag('L = log n + 1 層', 'ptr', -5.2, 7.2);
  say('T(n) = 所有節點成本的總和', '同一層成本相同 → 逐層加最容易');
  await beat(tok, 2600);
  const S = ['cn', '2 · cn/2 = cn', '4 · cn/4 = cn', 'n · c = cn'];
  const CAP = ['第 1 層：只有根', '第 2 層：2 個 cn/2', '第 3 層：4 個 cn/4', '最底層：n 個大小 1'];
  for (let l = 0; l < 4; l++) {
    rows[l].ms.forEach((m) => glow(m, GOLD));
    tag(S[l], 'ptr alt', 5.3, M2LV[l].y);
    say(CAP[l], S[l]);
    await beat(tok, 1900);
    rows[l].ms.forEach((m) => glow(m, null));
  }
  say('質量守恆：每層大小加起來都是 n', '少了 n 就是哪裡弄丟了元素');
  await beat(tok, 2600);
  say('T(n) = cn · L', '= cn (log n + 1) = Θ(n log n)');
  await beat(tok, 3000);
  say('成本不平均的樹也一樣逐層加', '可能集中在根，也可能集中在葉子');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit2-rep-invariant', 'Rep invariant：sorted array 與 binary search', async (tok) => {
  fresh([0, 4.5, 13], [0, 2.4, 0]);
  tag('query：只問、不改', 'ptr', -3.4, 5.8); tag('update：insert / delete', 'ptr alt', 3.4, 5.8);
  say('Data structure = queries + updates', '先 update 放資料，再 query 問問題');
  await beat(tok, 2600);
  const X = (i) => -4.5 + i * 1.5;
  const cs = [4, 8, 15, 16, 23, 42].map((v, i) => cube(v, M2.blue, [1.2, 0.8, 0.9], X(i), 2.4, 0, 2));
  for (let i = 0; i < 7; i++) tag('[' + i + ']', 'idx', X(i), 1.6);
  say('Rep invariant：陣列要排好序', 'a[i] < a[i+1]（示意數字）');
  await beat(tok, 2400);
  glow(cs[0], GREEN); glow(cs[5], GREEN);
  say('min 看頭、max 看尾', 'O(1)');
  await beat(tok, 2200); glow(cs[0], null); glow(cs[5], null);
  const cur = tag('▼', 'ptr alt', X(2), 3.3);
  for (const [m, msg] of [[2, '15 < 16 → 往右'], [4, '23 > 16 → 往左'], [3, '找到 16：O(log n)']]) {
    cur.position.set(X(m), 3.3, 0); glow(cs[m], m === 3 ? GREEN : GOLD);
    say('Binary search 找 16', msg);
    await beat(tok, 1500); glow(cs[m], null);
  }
  relabel(cs[2], 42); relabel(cs[5], 15); tint(cs[2], M2.red); tint(cs[5], M2.red);
  say('RI 被破壞：陣列沒排好', '再找 15 試試');
  await beat(tok, 2000);
  for (const [m, msg] of [[2, '42 > 15 → 往左'], [0, '4 < 15 → 往右'], [1, '8 < 15 → 往右 → 沒了']]) {
    cur.position.set(X(m), 3.3, 0); glow(cs[m], GOLD);
    say('Binary search 找 15', msg);
    await beat(tok, 1400); glow(cs[m], null);
  }
  glow(cs[5], RED);
  say('回答「不存在」，但 15 明明在！', 'RI 不成立 → query 可能答錯');
  await beat(tok, 2600);
  glow(cs[5], null); relabel(cs[2], 15); relabel(cs[5], 42); tint(cs[2], M2.blue); tint(cs[5], M2.blue);
  for (let i = 5; i >= 2; i--) move(cs[i], X(i + 1), 2.4);
  await beat(tok, 700);
  cube(10, M2.green, [1.2, 0.8, 0.9], X(2), 2.4, 0, 2.5);
  say('insert 10：後面全部右移騰位置', 'update 結束時 RI 必須仍成立');
  await beat(tok, 2600);
  say('不能偷懶直接 append 到尾端', '正確性證明：RI 開頭成立 ⇒ 結尾也成立');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit2-heap-checkri', 'Max heap 的 insert 與 checkRI 除錯', async (tok) => {
  fresh([0, 3.8, 13.5], [0, 3.6, 0]);
  const P = [[0, 6.2], [-3, 4.7], [3, 4.7], [-4.5, 3.2], [-1.5, 3.2], [1.5, 3.2], [4.5, 3.2], [-5.3, 1.7]];
  const v = [50, 30, 40, 10, 20, 35, 25], ms = [];
  for (let i = 0; i < 7; i++) { ms.push(cube(v[i], M2.purple, [0.9, 0.9, 0.9], P[i][0], P[i][1], 0)); if (i) line(P[(i - 1) >> 1][0], P[(i - 1) >> 1][1], P[i][0], P[i][1], -0.05); }
  glow(ms[0], GOLD);
  say('Max heap 的 RI：父 ≥ 子', 'query max：看根 → O(1)（示意數字）');
  await beat(tok, 2600); glow(ms[0], null);
  line(P[3][0], P[3][1], P[7][0], P[7][1], -0.05);
  ms.push(cube(45, M2.green, [0.9, 0.9, 0.9], P[7][0], P[7][1], 0, 2)); v.push(45);
  say('insert 45：只能加在最底層', '加在 array 尾端');
  await beat(tok, 2200);
  let i = 7;
  while (i > 0) {
    const p = (i - 1) >> 1;
    glow(ms[i], GOLD); glow(ms[p], GOLD);
    await beat(tok, 900);
    glow(ms[i], null); glow(ms[p], null);
    if (v[i] <= v[p]) { say(v[i] + ' ≤ ' + v[p] + '：停', 'RI 恢復'); await beat(tok, 1600); break; }
    [v[i], v[p]] = [v[p], v[i]]; relabel(ms[i], v[i]); relabel(ms[p], v[p]); tint(ms[p], M2.green); tint(ms[i], M2.purple);
    say(v[p] + ' > ' + v[i] + ' → swap', 'array 裡 parent = index / 2，只 swap 不搬移');
    await beat(tok, 1500);
    i = p;
  }
  say('insert = O(height)', 'full binary tree：height = log n');
  await beat(tok, 2400);
  const cur = tag('▼', 'ptr alt', 0, 7);
  say('checkRI：走遍整個結構檢查', '每個父節點都要比孩子大');
  for (let k = 0; k < 8; k++) { cur.position.set(P[k][0], P[k][1] + 0.85, 0); glow(ms[k], GREEN); await beat(tok, 260); }
  say('checkRI 是 O(n)', '每次 update 都呼叫 → O(log n) 變 O(n)');
  await beat(tok, 2600);
  say('debug 時每次 update 後呼叫', '確定正確後，交作業前拿掉');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit2-bst-find', 'BST 的 RI 與 find：O(h)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.6, 0]);
  const N = m2tree(M2BST);
  say('Binary tree：每個節點最多兩個孩子', '節點存 key、left、right、parent');
  await beat(tok, 2400);
  [8, 4, 16, 15].forEach((k) => tint(N[k], M2.teal)); tint(N[42], M2.orange); glow(N[23], GOLD);
  say('看 23：左邊都較小、右邊都較大', '每個節點都成立 → BST 的 RI');
  await beat(tok, 2800);
  [8, 4, 16, 15, 42].forEach((k) => tint(N[k], M2.blue)); glow(N[23], null);
  const cur = tag('▼', 'ptr alt', 0, 7.05);
  const walk = async (path, goal, caps) => {
    for (let s = 0; s < path.length; s++) {
      await m2goN(tok, cur, N[path[s]]); glow(N[path[s]], path[s] === goal ? GREEN : GOLD);
      say('find(' + goal + ')', caps[s]); await beat(tok, 1300);
    }
    path.forEach((k) => glow(N[k], null));
  };
  await walk([23, 8, 16], 16, ['16 < 23 → 往左', '16 > 8 → 往右', '找到 16']);
  await walk([23, 42], 42, ['42 > 23 → 往右', '找到 42']);
  await walk([23, 8, 16, 15], 14, ['14 < 23 → 往左', '14 > 8 → 往右', '14 < 16 → 往左', '14 < 15 → 往左']);
  await m2go(tok, cur, -2.9, 0.2);
  const no = tag('None：不存在', 'ptr', -2.9, 0.2);
  say('find(14)：走到死路', '回報不存在；就像 binary search');
  await beat(tok, 2400); kill(no);
  say('find 只走一條路徑往下', 'O(h)，h = 樹高；還不是 O(log n)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-bst-degenerate', '退化的 BST：一直變大的插入 → O(n)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.6, 0]);
  const ks = [5, 10, 15, 20, 25];
  let prev = null;
  say('依序插入 5, 10, 15, …', '每個都比前面大');
  for (let i = 0; i < ks.length; i++) {
    const x = -4 + i * 2, y = 6.2 - i * 1.3;
    if (prev) line(prev[0], prev[1], x, y, -0.05);
    cube(ks[i], M2.red, [0.9, 0.9, 0.9], x, y, 0, 2);
    prev = [x, y];
    await beat(tok, 900);
  }
  say('一直往右 → 變成一條 list', 'h = n');
  await beat(tok, 2400);
  say('最壞情況 find 是 O(n)', '所以寫 O(h)，不直接寫 O(log n)');
  await beat(tok, 2600);
  say('隨機資料的樹高約 log n', '之後用 balanced tree 保證 h = O(log n)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-bst-insert', 'BST insert：沿 find 的路徑走到死路', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const N = m2tree(M2BST);
  const cur = tag('▼', 'ptr alt', 0, 7.05);
  const ins = async (key, path, caps, x, y, parent) => {
    for (let s = 0; s < path.length; s++) {
      await m2goN(tok, cur, N[path[s]]); glow(N[path[s]], GOLD);
      say('insert ' + key, caps[s]); await beat(tok, 1200);
    }
    path.forEach((k) => glow(N[k], null));
    await m2go(tok, cur, x, y);
    N[key] = cube(key, M2.green, [0.9, 0.9, 0.9], x, y, 0, 2);
    line(N[parent].position.x, N[parent].position.y, x, y, -0.05);
  };
  await ins(14, [23, 8, 16, 15], ['14 < 23 → 往左', '14 > 8 → 往右', '14 < 16 → 往左', '14 < 15 → 往左：空的'], -2.9, 0.4, 15);
  say('死路就是 14 的位置', '下次 find(14) 會走同一條路找到它');
  await beat(tok, 2400);
  await ins(5, [23, 8, 4], ['5 < 23 → 往左', '5 < 8 → 往左', '5 > 4 → 往右：空的'], -3.8, 1.7, 4);
  say('5：小、小、大 → 4 的右孩子', '不需要 swap 任何節點');
  await beat(tok, 2400);
  say('insert = find 的程式碼 + 在死路建新節點', 'O(h)');
  await beat(tok, 2600);
  say('重複的 key？', '要存多個值就在節點掛一個 list');
  await beat(tok, 2600);
}]);

FRAG.push(['algmit2-bst-successor', 'next_larger（successor）的兩種情況', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const N = m2tree(M2BST);
  const cur = tag('▼', 'ptr alt', 0, 7.05);
  const visit = async (k, color, cap, f, ms = 1300) => { await m2goN(tok, cur, N[k]); glow(N[k], color); say(cap, f); await beat(tok, ms); };
  const clear = () => Object.values(N).forEach((m) => glow(m, null));
  await visit(8, RED, 'next_larger(8)：8 有右子樹', 'case 1：往右一步');
  await visit(16, GOLD, '到 16，接著一路往左', '= 右子樹的 min');
  await visit(15, GREEN, '15 沒有左孩子 → 答案 15', 'next_larger(8) = 15', 2200);
  clear();
  await visit(4, RED, 'next_larger(4)：沒有右子樹', 'case 2：往上走');
  await visit(8, GREEN, '4 是 8 的左孩子 → 答案 8', '往「右上」走一步就停', 2200);
  clear();
  await visit(16, RED, 'next_larger(16)（示意）', '沒有右子樹 → 往上');
  await visit(8, GOLD, '16 是右孩子 → 繼續往上', '一直往左上走，大家都比 16 小');
  await visit(23, GREEN, '8 是 23 的左孩子 → 停', 'next_larger(16) = 23', 2200);
  clear();
  await visit(42, RED, 'next_larger(42)', '往上：42 是右孩子');
  await visit(23, GOLD, '走到根都沒轉彎', '沒有 successor（42 是最大）', 2200);
  clear();
  await visit(23, RED, 'predecessor：鏡像', 'left ↔ right、min ↔ max');
  await visit(8, GOLD, '先往左一步', '再找左子樹的 max');
  await visit(16, GREEN, '一路往右 → 16', 'prev_smaller(23) = 16', 2600);
}]);

FRAG.push(['algmit2-bst-delete', 'BST delete 三種情況（刪 15、16、8）', async (tok) => {
  const CAM = [[0, 3.6, 13], [0, 3.4, 0]];
  fresh(...CAM); let N = m2tree(M2BST);
  glow(N[15], RED);
  say('刪 15：leaf', 'case 1：直接拿掉');
  await beat(tok, 1800);
  kill(N[15].userData.edge); fly(N[15]);
  await beat(tok, 2000);
  fresh(...CAM); N = m2tree(M2BST);
  glow(N[16], RED);
  say('刪 16：只有一個孩子 15', 'case 2：把孩子的子樹接上來');
  await beat(tok, 2000);
  kill(N[16].userData.edge); kill(N[15].userData.edge); fly(N[16]);
  move(N[15], -1.4, 3.2); line(-3, 4.7, -1.4, 3.2, -0.05);
  say('改 8 的 right、15 的 parent', '直線或 zigzag 都一樣處理');
  await beat(tok, 2600);
  fresh(...CAM); N = m2tree(M2BST);
  glow(N[8], RED);
  say('刪 8：左右都有子樹', 'case 3：不能直接拿子樹頂替');
  await beat(tok, 2400);
  const cur = tag('▼', 'ptr alt', -3, 5.55);
  await m2goN(tok, cur, N[16]); glow(N[16], GOLD);
  await m2goN(tok, cur, N[15]); glow(N[15], GREEN);
  say('找 successor：右子樹的 min = 15', 'successor 一定沒有左孩子');
  await beat(tok, 2600);
  glow(N[16], null); relabel(N[8], 15); tint(N[8], M2.green); glow(N[8], null);
  say('把 15 這個 key 搬上去', '左邊 4 < 15 < 右邊 16');
  await beat(tok, 2200);
  kill(N[15].userData.edge); fly(N[15]); kill(cur);
  say('再刪原本的 15：容易的 case', 'successor 最多一個子樹 → 不會無限遞迴');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-bst-delete-cost', 'delete 的程式碼與 O(h)', async (tok) => {
  fresh([0, 4, 13.5], [0, 3.4, 0]);
  const cd = code([
    ' 1 def delete(self):',
    ' 3   if self.left is None or self.right is None:',
    ' 4     if self is self.parent.left:',
    ' 5-7     接上唯一的孩子（改 left/parent）',
    ' 9-11  else: 鏡像，left ↔ right',
    '12     return self',
    '14   else:',
    '15     s = self.next_larger(); 交換 key',
    '16     return s.delete()',
  ], -2.4, 6.6, 0.56);
  cd.hl(1);
  say('lines 3–12：happy case', '少一個孩子 → 改幾個 link，O(1)');
  await beat(tok, 2800);
  cd.hl(7);
  say('lines 14–16：sad case', '找 successor、換 key、刪 successor');
  await beat(tok, 2800);
  cd.hl(-1);
  const B = [['find key', 2.6, 3.2, M2.blue], ['successor', 2.6, 4.5, M2.purple], ['改 link', 0.35, 5.9, M2.green]];
  for (const [nm, h, x, c] of B) { const b = m2bar(c, 1, 0.9, x, 1.4); tag(nm, 'idx', x, 0, 2.3); await anim(tok, 700, (t) => m2set(b, h * t)); }
  tag('O(h)', 'ptr', 3.2, 3.0, 1.4); tag('O(h)', 'ptr', 4.5, 3.0, 1.4); tag('O(1)', 'ptr', 5.9, 0.75, 1.4);
  say('先 find：O(h)；再 successor：O(h)', '最後改 link：O(1)');
  await beat(tok, 2800);
  say('delete = O(h)', 'insert 也是 O(h)');
  await beat(tok, 2400);
  say('BST.delete 先 find 再呼叫 node.delete', '直接給 node 就省掉 find；是根要更新 root');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-bst-augment', 'Augment：每個節點存子樹 min', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const N = m2tree([[23, 0, 6.2, null], [15, -3, 4.7, 23], [42, 3, 4.7, 23], [4, -4.6, 3.2, 15], [16, -1.4, 3.2, 15]]);
  const mt = {};
  for (const k of [23, 15, 42, 4, 16]) mt[k] = tag('min ?', 'idx', N[k].position.x + 1.05, N[k].position.y);
  say('Augment：節點多存一點資訊', '例：存子樹的 min → O(1) 回答');
  await beat(tok, 2400);
  const setMin = async (k, v, f) => { glow(N[k], GOLD); txt(mt[k], 'min ' + v); say('由孩子算自己：O(1)', f); await beat(tok, 1200); glow(N[k], null); };
  await setMin(4, 4, 'leaf：min = 自己 4');
  await setMin(16, 16, 'leaf：min = 16');
  await setMin(42, 42, 'leaf：min = 42');
  await setMin(15, 4, 'min(15, 左 4, 右 16) = 4');
  await setMin(23, 4, 'min(23, 左 4, 右 42) = 4');
  const cur = tag('▼', 'ptr alt', 0, 7.05);
  for (const k of [23, 15, 4]) { await m2goN(tok, cur, N[k]); glow(N[k], GOLD); say('insert 3', '沿 find 的路徑往下'); await beat(tok, 700); }
  N[3] = cube(3, M2.green, [0.9, 0.9, 0.9], -5.4, 1.7, 0, 2); line(-4.6, 3.2, -5.4, 1.7, -0.05);
  mt[3] = tag('min 3', 'idx', -5.4, 0.95);
  say('只有路徑上的子樹變了', '路徑外的節點都不用動');
  await beat(tok, 2400);
  for (const k of [4, 15, 23]) { await m2goN(tok, cur, N[k]); txt(mt[k], 'min 3'); glow(N[k], GREEN); say('往回走、重算 min', '3、3、3'); await beat(tok, 900); }
  say('delete 也一樣：沿路往上重算', 'O(h)');
  await beat(tok, 2600);
  say('f 能由孩子 O(1) 算出 → 都能這樣 augment', '不只 min，作業會用到別的 f');
  await beat(tok, 3000);
}]);

// ══════════════ 0M_kIqhwbFo：L8 Hashing with Chaining ══════════════
FRAG.push(['algmit2-dict-adt', 'Dictionary ADT：insert、delete、exact search', async (tok) => {
  fresh([0, 5, 13], [0, 1.8, 0]);
  const g = ghostBox(M2.sand, 9.5, 2.6, 4); g.position.set(0, 1.3, 0);
  tag('dictionary：一組 items', 'ptr', 0, 3.4, -1.8);
  say('Dictionary：每個 item 有一個 key', 'insert(item)、delete(item)、search(key)');
  await beat(tok, 2600);
  const it = {};
  const POS = { cat: [-3, -0.6], the: [0, 0.6], hash: [3, -0.6] };
  for (const [k, v] of [['cat', 1], ['the', 3], ['hash', 2]]) {
    it[k] = cube(k + ': ' + v, M2.blue, [2, 0.7, 1], POS[k][0], 0.35, POS[k][1], 3);
    say("D[key] = val：insert", "D['" + k + "'] = " + v + '（示意：字數統計）'); await beat(tok, 1100);
  }
  relabel(it.cat, 'cat: 5'); glow(it.cat, GOLD);
  say('同一個 key 再 insert → 覆蓋', "D['cat'] = 5；key 保證唯一");
  await beat(tok, 2400); glow(it.cat, null);
  glow(it.hash, GREEN);
  say('search 是 exact search', "D['hash'] → 2");
  await beat(tok, 2200); glow(it.hash, null);
  const q = tag("D['dog'] → KeyError", 'ptr', 0, 2.2, 2.4);
  say('找不到就回報不存在', '不像 BST 能找 successor / predecessor');
  await beat(tok, 2600); kill(q);
  fly(it.the);
  say("del D['the']：delete", 'D.items() → (key, value) pairs');
  await beat(tok, 2200);
  say('AVL tree：全部 O(log n)', '今天目標：O(1)（randomized，w.h.p.）');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-direct-access', 'Direct access table：key 當 index', async (tok) => {
  fresh([0, 6, 11], [0, 0.6, 0.4]);
  const X = m2row(10, -4.5, 1, 0);
  const nones = [];
  for (let i = 0; i < 10; i++) if (i !== 2 && i !== 4) nones.push(tag('None', 'idx', X(i), 0.35, -0.2));
  say('Direct access table：key 當 index', 'T[key] = item');
  await beat(tok, 2200);
  const a = m2item('item2', M2.blue, X(2), 0, 3);
  say('key 2 → 放第 2 格', '用不到的 key 都是 None');
  await beat(tok, 1600);
  m2item('item4', M2.blue, X(4), 0, 3);
  say('key 4 → 放第 4 格', '');
  await beat(tok, 1800);
  glow(a, GREEN);
  say('insert / delete / search 都 O(1)', 'delete = 設回 None；search = 看是不是 None');
  await beat(tok, 2600); glow(a, null);
  const q = tag("'cat' → 第幾格？", 'ptr', 3, 2.2, 0);
  say('問題 1：key 不一定是整數', '字串、物件怎麼辦？');
  await beat(tok, 2600); kill(q);
  const g = ghostBox(M2.red, 13, 0.3, 0.9); g.position.set(0.3, 0.15, 2.4);
  tag('2⁶⁴ 格', 'ptr alt', 5.6, 0.8, 2.4);
  say('問題 2：超級吃記憶體', '64-bit key → 2⁶⁴ 格，只為了存幾個 item');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-prehash', 'Prehash：任何 key → 非負整數', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.6, 0]);
  say('Prehash：把 key 對應到非負整數', '理論上：任何東西都是一串 bits = 整數');
  await beat(tok, 2600);
  const rows = [['42', '42', 5.4], ["'\\0B'", '64', 3.9], ["'\\0\\0C'", '64', 2.4]];
  const outs = [];
  for (const [k, v, y] of rows) {
    cube(k, M2.sand, [2.2, 0.8, 0.8], -4, y, 0, 2);
    arrow(V3(-2.7, y, 0), V3(0.9, y, 0));
    outs.push(cube(v, M2.blue, [1.2, 0.8, 0.8], 1.8, y, 0));
    say(k === '42' ? 'Python 的 hash() 其實是 prehash' : '字串也算出一個整數', k === '42' ? 'hash(42) = 42' : 'hash(' + k + ') = ' + v);
    await beat(tok, 1700);
  }
  glow(outs[1], RED); glow(outs[2], RED);
  say('理想：prehash 相等 ⇔ key 相等', "Python 沒完全做到：'\\0B' 與 '\\0\\0C' 都是 64");
  await beat(tok, 3000);
  glow(outs[1], null); glow(outs[2], null);
  const X = m2row(4, 3.4, 1, 1.6, 0.8, (i) => String(i + 3));
  m2item('key', M2.green, X(1), 1.6, 2, 0.8);
  say('prehash = 4 → 放第 4 格', '自訂物件：__hash__；預設用 id（記憶體位置）');
  await beat(tok, 2400);
  const a = arrow(V3(4.9, 2.6, 1.6), V3(X(2), 0.8, 1.6), 0xb03030);
  say('之後 prehash 變成 5 → 去第 5 格找', '空的 → 找不到！');
  await beat(tok, 2600); kill(a);
  say('prehash 值絕對不能隨時間改變', '所以 list 這種 mutable 物件不能當 key');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-hash-universe', 'Hashing：巨大 key space → m 格的 table', async (tok) => {
  fresh([0, 4.8, 12.5], [0, 2.8, 0]);
  const g = ghostBox(M2.sand, 5.6, 5.2, 1.4); g.position.set(-3.4, 3, 0);
  tag('key space U（巨大）', 'ptr', -3.4, 6.1);
  for (let i = 0; i < 18; i++) cube('', '#b9ab90', [0.22, 0.22, 0.22], -5.8 + ((i * 7) % 18) * 0.27, 0.8 + ((i * 5) % 9) * 0.5, 0);
  const SL = (i) => 5.6 - i * 0.92, TX = 3.6;
  const slots = [];
  for (let i = 0; i < 6; i++) { slots.push(cube('', GRAY, [1.6, 0.7, 0.7], TX, SL(i), 0)); tag(String(i), 'idx', TX + 1.2, SL(i)); }
  tag('table T（m 格）', 'ptr alt', TX, 6.5);
  say('Hash function h：U → {0, 1, …, m−1}', 'm = hash table 的大小');
  await beat(tok, 2600);
  const K4 = [['k1', -4.6, 4.6, 5], ['k2', -2.4, 5.0, 0], ['k3', -3.6, 2.4, 3], ['k4', -1.8, 1.6, 1]];
  for (const [nm, x, y, s] of K4) {
    cube(nm, M2.blue, [0.75, 0.55, 0.55], x, y, 0.3);
    arrow(V3(x + 0.4, y, 0.3), V3(TX - 0.85, SL(s), 0.2), 0x2f6fb0);
    relabel(slots[s], 'item' + nm.slice(1)); tint(slots[s], M2.blue);
    if (nm === 'k2') { say('目前存的 keys：k1…k4', 'h(k2) = 0 → item 2 放第 0 格'); await beat(tok, 2200); }
    else if (nm === 'k3') { say('h(k3) = 3 → item 3 放第 3 格', '其餘兩個是示意'); await beat(tok, 2000); }
    else await beat(tok, 700);
  }
  say('希望 m = Θ(n)', 'n = 目前存的 key 數 → 空間線性');
  await beat(tok, 2600);
  const ki = cube('ki', M2.red, [0.75, 0.55, 0.55], -5.0, 3.4, 0.3), kj = cube('kj', M2.red, [0.75, 0.55, 0.55], -1.6, 3.6, 0.3);
  arrow(V3(-4.6, 3.4, 0.3), V3(TX - 0.85, SL(2), 0.2), 0xb03030); arrow(V3(-1.2, 3.6, 0.3), V3(TX - 0.85, SL(2), 0.2), 0xb03030);
  glow(slots[2], RED); glow(ki, RED); glow(kj, RED);
  say('鴿籠原理：一定有 collision', 'h(ki) = h(kj) 但 ki ≠ kj');
  await beat(tok, 3000);
  say('hash = 切碎再攪拌', '撞在一起還是要能找得到 → chaining');
  await beat(tok, 2600);
}]);

FRAG.push(['algmit2-chaining', 'Chaining：撞同一格就串成 linked list', async (tok) => {
  const recap = !!(ctx.params || {}).recap;
  fresh([0, 8.5, 9.5], [0, 0, 0.8]);
  const m = 6, X = (i) => -4.5 + i * 1.8, Z0 = -3;
  for (let i = 0; i < m; i++) { cube('', GRAY, [1.3, 0.2, 1.0], X(i), 0.1, Z0); tag(String(i), 'idx', X(i), 0, Z0 - 0.9); }
  tag('T', 'ptr', -6.2, 0.2, Z0);
  const chains = recap ? [[1, ['k1', 'k4', 'k2']], [4, ['k3']]] : [[1, ['k1', 'k2']], [3, ['k3']]];
  const addChain = async (slot, keys, color, ms) => {
    let pz = Z0 + 0.5;
    for (let j = 0; j < keys.length; j++) {
      const z = Z0 + 1.5 + j * 1.4;
      arrow(V3(X(slot), 0.35, pz), V3(X(slot), 0.35, z - 0.5));
      lnode(keys[j], X(slot) - 0.3, 0.35, z, color);
      pz = z + 0.5;
      await beat(tok, ms);
    }
  };
  say(recap ? '回顧：k1、k4、k2 都撞到第 1 格' : 'k1、k2 碰撞：都到第 1 格', recap ? '串成 linked list，順序不重要' : '第 1 格存一條 linked list');
  await addChain(chains[0][0], chains[0][1], M2.blue, 700);
  await beat(tok, 1200);
  await addChain(chains[1][0], chains[1][1], M2.teal, 600);
  for (let i = 0; i < m; i++) if (i !== chains[0][0] && i !== chains[1][0]) tag('null', 'idx', X(i), 0.35, Z0 + 1.0);
  say('k3 自己一格：list 只有一個 item', '空的格子存 null');
  await beat(tok, 2400);
  if (recap) {
    say('空間 = n + m', 'table m 格 + 所有 list 長度總和 n');
    await beat(tok, 2600);
    say('期望 chain 長度 α = n/m', '操作時間 O(1 + α)；α 常數 → O(1)');
    await beat(tok, 3000);
  } else {
    say('最壞：所有 key 都撞同一格', '固定 h，總找得到一堆撞在一起的 key');
    await addChain(5, ['k5', 'k6', 'k7', 'k8', '…'], M2.red, 350);
    say('退化成長度 n 的 list', '最壞 Θ(n)：任何 hashing 都一樣');
    await beat(tok, 2600);
    say('實務上很好用：靠隨機化', '大部分 chain 都只有常數長度');
    await beat(tok, 2800);
  }
}]);

FRAG.push(['algmit2-suh-alpha', 'Simple uniform hashing：期望 chain 長度 α', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.6, 0]);
  const X = (i) => -3 + i * 2;
  for (let i = 0; i < 4; i++) { cube('', GRAY, [1.3, 0.12, 1.3], X(i), 0.06, 0); tag(String(i), 'idx', X(i), 0, 1.1); }
  say('Simple uniform hashing（假設）', '每個 key 均勻、彼此獨立地落到各格');
  await beat(tok, 2600);
  const seq = [2, 0, 3, 1, 1, 2, 0, 2, 3, 1, 0, 2], cnt = [0, 0, 0, 0];
  const nt = tag('n = 0', 'ptr alt', 5.6, 0.4);
  for (let k = 0; k < seq.length; k++) {
    const s = seq[k];
    cube('k' + (k + 1), M2.blue, [1.1, 0.5, 1.1], X(s), 0.37 + cnt[s] * 0.56, 0, 2.5);
    cnt[s]++; txt(nt, 'n = ' + (k + 1));
    await beat(tok, 320);
  }
  say('假設不太實際，但分析很方便', 'm = 4、n = 12（示意）');
  await beat(tok, 2200);
  const g = ghostBox(M2.gold, 8, 0.05, 1.8); g.position.set(0, 0.1 + 3 * 0.56, 0);
  tag('α = n/m = 3', 'ptr alt', 5.4, 1.8);
  say('期望 chain 長度 = n · (1/m)', 'load factor α = n/m');
  await beat(tok, 2800);
  say('search：算 h、走 chain', 'Θ(1 + α)；1 = 算 hash + 第一個指標');
  await beat(tok, 2800);
  say('m = Θ(n) → α 是常數', 'α = 10 也沒關係，仍是 O(1)');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit2-division', 'Division method：h(k) = k mod m', async (tok) => {
  fresh([0, 7.5, 10], [0, 0, 0.3]);
  const keys = [10, 22, 34, 16, 28, 40, 12, 6];
  const run = async (m, z, x0) => {
    const X = m2row(m, x0, 1.2, z, 0.9);
    tag('m = ' + m, 'ptr', x0 - 1.4, 0.2, z);
    const cnt = Array(m).fill(0), used = [];
    for (const k of keys) { const s = k % m; cube(k, m === 8 ? M2.orange : M2.green, [0.8, 0.45, 0.8], X(s), 0.35 + cnt[s] * 0.5, z, 2); cnt[s]++; used[s] = 1; await beat(tok, 280); }
    return { X, used };
  };
  say('Division method：h(k) = k mod m', '最直接的做法');
  await beat(tok, 2200);
  const A = await run(8, -1.6, -4.2);
  for (let s = 1; s < 8; s += 2) { const g = ghostBox(M2.red, 0.9, 0.4, 0.9); g.position.set(A.X(s), 0.25, -1.6); }
  say('key 全是偶數、m = 8 也是偶數', '只用到偶數格 → 浪費一半（示意 key）');
  await beat(tok, 2800);
  await run(7, 1.8, -3.6);
  say('m 取質數 7', '分散多了');
  await beat(tok, 2200);
  say('m 選質數、不靠近 2 或 10 的次方', '實務常用，但理論上證不了什麼');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-multiplication', 'Multiplication method：取乘積中間的 r 位元', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.4, 0]);
  const w = 8, r = 3, k = 181, a = 155, P = k * a, h = (P % 256) >> (w - r);
  const BX = (b) => -3.75 + (15 - b) * 0.5;
  const row = (val, n, y, shift, color) => { const ms = []; for (let b = 0; b < n; b++) ms[b] = cube((val >> b) & 1, color, [0.42, 0.42, 0.42], BX(b + shift), y, 0); return ms; };
  row(k, 8, 6.4, 0, M2.blue); tag('k = 181', 'ptr', -2.3, 6.4);
  row(a, 8, 5.8, 0, M2.purple); tag('a = 155', 'ptr', -2.3, 5.8);
  say('Multiplication method', 'h(k) = [(a·k) mod 2ʷ] >> (w − r)；示意 w = 8、r = 3');
  await beat(tok, 3000);
  let y = 5.0;
  for (let b = 0; b < 8; b++) if ((a >> b) & 1) { row(k, 8, y, b, M2.sand); await beat(tok, 450); y -= 0.5; }
  say('a 的每個 1 → 一份左移的 k', '相加時進位把 k 各段混在一起');
  await beat(tok, 2600);
  const pm = row(P, 16, 1.6, 0, M2.teal);
  tag('a·k = ' + P, 'ptr alt', -5.4, 2.3);
  say('乘積最多 2w 位元', '中間的位元混得最勻');
  await beat(tok, 2400);
  for (let b = 8; b < 16; b++) tint(pm[b], GRAY);
  const g = ghostBox(M2.gold, 4.1, 0.7, 0.7); g.position.set(2.0, 1.6, 0);
  say('mod 2ʷ：只留右邊那個 word', '左邊那個 word 丟掉');
  await beat(tok, 2400);
  for (let b = 5; b < 8; b++) glow(pm[b], GOLD);
  tag('h(k) = ' + h, 'ptr', 0.75, 0.6);
  say('>> (w − r)：留下這個 word 最左的 r 位', 'h(k) = ' + h + '，m = 2ʳ = 8');
  await beat(tok, 3000);
  say('a 要是奇數、不要靠近 2 的次方', '實務好用，但理論上仍有壞輸入');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit2-universal', 'Universal hashing：((ak + b) mod p) mod m', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.2, 0]);
  const p = 17, m = 4, k1 = 3, k2 = 7;
  const H = (aa, bb, kk) => ((aa * kk + bb) % p) % m;
  tag('h(k) = ((a·k + b) mod p) mod m', 'ptr', 0, 6.6);
  say('Universal hashing', 'p：比 universe 大的質數；a、b 隨機');
  await beat(tok, 2600);
  tag('k1 = ' + k1, 'ptr alt', 0.6, 6.0); tag('k2 = ' + k2, 'ptr alt', 2.2, 6.0);
  say('示意：p = 17、m = 4', '兩個固定（最壞）的 key：3 與 7');
  await beat(tok, 2200);
  const draws = [[5, 2], [11, 9], [2, 14], [7, 0], [13, 6], [4, 11]];
  let y = 5.3;
  for (const [aa, bb] of draws) {
    const h1 = H(aa, bb, k1), h2 = H(aa, bb, k2), hit = h1 === h2;
    tag('a = ' + aa + ', b = ' + bb, 'idx', -2.6, y);
    cube(h1, hit ? M2.red : M2.blue, [0.7, 0.5, 0.5], 0.6, y, 0, 1.5); cube(h2, hit ? M2.red : M2.blue, [0.7, 0.5, 0.5], 2.2, y, 0, 1.5);
    tag(hit ? '撞了' : '沒撞', hit ? 'ptr' : 'idx', 4.0, y);
    say('隨機選一組 (a, b)', 'h(3) = ' + h1 + '、h(7) = ' + h2);
    await beat(tok, 1100); y -= 0.75;
  }
  let c = 0, t = 0;
  for (let aa = 1; aa < p; aa++) for (let bb = 0; bb < p; bb++) { t++; if (H(aa, bb, k1) === H(aa, bb, k2)) c++; }
  tag('所有 (a, b)：' + c + '/' + t + ' ≈ ' + (c / t).toFixed(2), 'ptr alt', 1.2, 0.6);
  say('機率來自「隨機選 hash function」', 'Pr[h(k1) = h(k2)] ≤ 1/m = 0.25');
  await beat(tok, 3000);
  say('最壞的 key、隨機的 h', '期望 chain 長度仍是 O(1 + α)');
  await beat(tok, 2800);
}]);

// ══════════════ BRO7mVIFt08：L9 Table Doubling, Karp-Rabin ══════════════
FRAG.push(['algmit2-m-theta-n', 'm 要多大：太小變慢、太大浪費', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  say('剩下的問題：m 要多大？', 'n 隨插入一直變，事先不知道');
  await beat(tok, 2400);
  const XL = (i) => -5.4 + i * 1.05;
  for (let i = 0; i < 4; i++) cube('', GRAY, [0.9, 0.12, 0.9], XL(i), 0.06, 0);
  tag('m = 4', 'ptr', -3.8, 0.2, 1.4);
  for (let k = 0; k < 16; k++) { cube('', M2.blue, [0.8, 0.4, 0.8], XL(k % 4), 0.32 + Math.floor(k / 4) * 0.45, 0, 2); await beat(tok, 150); }
  tag('α = 16/4 = 4', 'ptr alt', -3.8, 2.6);
  say('m 太小：α 變大 → 變慢', 'm = Ω(n) 才能讓 α 是常數');
  await beat(tok, 2600);
  for (let i = 0; i < 32; i++) cube('', GRAY, [0.5, 0.1, 0.5], 1.2 + (i % 8) * 0.6, 0.05, -1.2 + Math.floor(i / 8) * 0.6);
  for (const i of [3, 10, 20, 29]) cube('', M2.blue, [0.45, 0.35, 0.45], 1.2 + (i % 8) * 0.6, 0.27, -1.2 + Math.floor(i / 8) * 0.6, 2);
  tag('32 格只放 4 個', 'ptr alt', 3.3, 1.4);
  say('m 太大：浪費空間', 'm = O(n) 才是線性空間');
  await beat(tok, 2600);
  say('目標：m = Θ(n)', 'm 從常數開始（老師說 7、8），需要時 grow / shrink');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-rehash', 'Grow：建新 table、用 h′ 全部 rehash', async (tok) => {
  fresh([0, 7.8, 10], [0, 0, 0.3]);
  const X = m2row(8, -3.5, 1, -2.6, 0.85);
  tag('T（m = 8）', 'ptr', -5.4, 0.2, -2.6);
  const keys = [16, 9, 2, 11, 20, 13, 22, 31], it = {};
  for (const k of keys) it[k] = m2item(k, M2.blue, X(k % 8), -2.6, 0, 0.75);
  say('m = 8，已經放了 8 個', 'h(k) = k mod 8（示意 key）');
  await beat(tok, 2400);
  it[25] = m2item(25, M2.orange, 5.4, -2.6, 3, 0.75);
  say('insert 第 9 個：n > m', '要 grow 成 m′');
  await beat(tok, 2400);
  const X2 = m2row(16, -6, 0.8, 1.6, 0.65);
  tag("T′（m′ = 16）", 'ptr alt', 0, 0.2, 3.0);
  say('配置新 table T′', '初始化 m′ 格：Θ(m′)');
  await beat(tok, 2200);
  say("每個 item 用新的 h′ 重新 insert", "h′(k) = k mod 16");
  const cnt = {};
  for (const k of [...keys, 25]) {
    const s = k % 16, c = cnt[s] || 0; cnt[s] = c + 1;
    glow(it[k], GOLD); move(it[k], X2(s), 0.45 + c * 0.62, 1.6);
    await beat(tok, 420); glow(it[k], null);
  }
  say('25 與 9 在新表撞在第 9 格', 'chaining 照樣串起來');
  await beat(tok, 2200);
  say('一定要換 hash function', '舊的 h 只會用到前 8 格');
  await beat(tok, 2600);
  say('成本 Θ(n + m + m′)', '走過每格、每條 list、建新表；= Θ(n)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-amortized', 'Amortized：把偶爾的昂貴操作攤平', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.2, 0]);
  const N = 24, XB = (i) => -5.75 + i * 0.48, S = 0.2, bars = [], cost = [];
  let m = 8, tot = 0;
  say('從 m = 8 開始連續 insert', '紅色 = 這次觸發 rebuild');
  for (let i = 1; i <= N; i++) {
    let c = 1; if (i > m) { c += i - 1; m *= 2; }
    cost.push(c); tot += c;
    const b = m2bar(c > 1 ? M2.red : M2.green, 0.36, 0.6, XB(i), 0); m2set(b, c * S); bars.push(b);
    await beat(tok, c > 1 ? 900 : 110);
  }
  tag('9', 'idx', XB(9), 9 * S + 0.3); tag('17', 'idx', XB(17), 17 * S + 0.3);
  say('單次 insert 可能要 Θ(n)', '但昂貴的只有 log n 次，其他都常數');
  await beat(tok, 2600);
  say('Amortized：k 次操作總時間 ≤ k · T(n)', '不是對單一操作的保證');
  await beat(tok, 2800);
  const avg = tot / N;
  await anim(tok, 1600, (t) => bars.forEach((b, i) => m2set(b, (cost[i] + (avg - cost[i]) * t) * S)));
  bars.forEach((b) => tint(b, M2.blue));
  tag('平均 = ' + tot + ' / ' + N + ' = ' + avg, 'ptr alt', 3.6, 1.4);
  say('像房租：月付一次 ≈ 每天付一點', '把貴的攤到每一次');
  await beat(tok, 2800);
  say('Table doubling：k 次 insert 共 Θ(k)', '每次 insert amortized Θ(1)');
  await beat(tok, 2800);
  say('只在乎總時間就夠用', 'real-time 系統才在乎單次最壞');
  await beat(tok, 2600);
  say('delete 不縮表：只會更划算', '但 n 次 insert 再 n 次 delete → m 仍很大');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-python-list', 'Python list：table doubling 的 resizable array', async (tok) => {
  fresh([0, 6.5, 11], [0, 0.4, 0.6]);
  const X = m2row(8, -4.2, 1.2, -1.2, 1.0);
  tag('capacity 8', 'ptr', -6.2, 0.2, -1.2);
  const L = ['a', 'b', 'c', 'd', 'e'].map((v, i) => m2item(v, M2.blue, X(i), -1.2, 0, 0.9));
  say('Python list = 可變長的 array', 'L[i]：O(1) random access');
  await beat(tok, 2400);
  L.push(m2item('f', M2.green, X(5), -1.2, 3, 0.9));
  say('append：放在尾端', 'O(1)');
  await beat(tok, 1800);
  fly(L.pop());
  say('pop()：拿掉最後一個', 'O(1)');
  await beat(tok, 1800);
  fly(L.shift());
  await beat(tok, 500);
  L.forEach((c, i) => move(c, X(i), 0.45, -1.2));
  say('pop(0)：刪第一個', '後面全部往前搬 → O(n)');
  await beat(tok, 2400);
  for (const v of ['p', 'q', 'r', 's']) { L.push(m2item(v, M2.blue, X(L.length), -1.2, 2.5, 0.9)); await beat(tok, 350); }
  say('滿了再 append', 'table doubling：搬到 2 倍大的 array');
  await beat(tok, 1800);
  const X2 = m2row(16, -6, 0.8, 2.2, 0.7);
  for (let i = 0; i < L.length; i++) { move(L[i], X2(i), 0.45, 2.2); await beat(tok, 200); }
  m2item('t', M2.green, X2(8), 2.2, 2.5, 0.7);
  say('所以 append、pop 是 constant amortized', '不是最壞 O(1)');
  await beat(tok, 2800);
  say('想要最壞 O(1)？', '快滿時就在旁邊先建 2 倍大的新表');
  await beat(tok, 2600);
  say('每次 insert 順便搬幾個過去', '滿的那刻正好搬完 → 直接切換（很難寫）');
  await beat(tok, 3000);
}]);

const M2T = '160060061', M2S = '6006';
FRAG.push(['algmit2-naive-match', 'String matching：暴力比對 O(|s|·|t|)', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.4, 0]);
  code(['any(s == t[i : i+len(s)]', '    for i in range(len(t) − len(s) + 1))'], 0, 6.3, 0.5);
  const X = (i) => -4 + i * 1.0;
  const T = [...M2T].map((c, i) => cube(c, M2.sand, [0.85, 0.7, 0.7], X(i), 1.0, 0));
  [...M2T].forEach((c, i) => tag(String(i), 'idx', X(i), 0.3, 0.6));
  const S = [...M2S].map((c, j) => cube(c, M2.blue, [0.85, 0.7, 0.7], X(j), 2.6, 0));
  tag('s', 'ptr', -5.4, 2.6); tag('t', 'ptr', -5.4, 1.0);
  say('s 有沒有出現在 t 裡？', "s = '6006'；t 示意（例：整個信箱）");
  await beat(tok, 2600);
  let comps = 0;
  for (let i = 0; i + 4 <= M2T.length; i++) {
    S.forEach((c, j) => move(c, X(i + j), 2.6));
    await beat(tok, 500);
    let ok = true, j = 0;
    for (; j < 4; j++) {
      comps++;
      const same = M2T[i + j] === M2S[j];
      glow(T[i + j], same ? GOLD : RED); glow(S[j], same ? GOLD : RED);
      await beat(tok, 230);
      if (!same) { ok = false; break; }
    }
    say('i = ' + i + (ok ? '：全部相同 → match' : '：第 ' + (j + 1) + ' 個字元不同'), '已比較 ' + comps + ' 個字元');
    if (ok) for (let q = 0; q < 4; q++) glow(T[i + q], GREEN);
    await beat(tok, ok ? 1500 : 900);
    for (let q = 0; q < 4; q++) { if (!ok) glow(T[i + q], null); glow(S[q], null); }
  }
  say('每個位置最多比 |s| 個字元', 'O(|s| · (|t| − |s|)) ≈ O(|s| · |t|)');
  await beat(tok, 2800);
  say('目標：用 hashing 變成線性', 'O(|s| + |t|)');
  await beat(tok, 2600);
}]);

FRAG.push(['algmit2-rolling-window', 'Rolling hash ADT：append、skip、r()', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.4, 0]);
  const X = (i) => -4 + i * 1.0;
  [...M2T].forEach((c, i) => cube(c, M2.sand, [0.85, 0.7, 0.7], X(i), 1.0, 0));
  const win = ghostBox(M2.gold, 4.0, 1.0, 1.0); win.position.set(X(1.5), 1.0, 0);
  tag('r 維護的字串 x', 'ptr', -5.0, 3.4);
  let xs = [...M2T.slice(0, 4)].map((c, j) => cube(c, M2.blue, [0.85, 0.7, 0.7], X(j), 3.4, 0));
  say('滑動視窗：每次換一個字元', '相鄰兩個視窗共用 |s| − 1 個字元');
  await beat(tok, 2600);
  for (let i = 4; i < 7; i++) {
    glow(xs[0], RED); say('r.skip(c)：刪掉開頭字元', "c = t[i − |s|] = '" + M2T[i - 4] + "'"); await beat(tok, 1300);
    fly(xs.shift(), V3(-2, 6, 2));
    await anim(tok, 500, (t) => { win.position.x = X(i - 4 + 1.5) + t; });
    xs.forEach((c, j) => move(c, X(i - 3 + j), 3.4));
    xs.push(cube(M2T[i], M2.green, [0.85, 0.7, 0.7], X(i), 3.4, 0, 2.5));
    say('r.append(c)：尾端加一個字元', "c = t[i] = '" + M2T[i] + "'");
    await beat(tok, 1500);
  }
  say('r()：目前字串 x 的 hash 值', '三個操作都要 O(1)');
  await beat(tok, 2800);
  say('這樣每換一個視窗只要 O(1)', '不必重算整段 O(|s|)');
  await beat(tok, 2600);
}]);

FRAG.push(['algmit2-karp-rabin', 'Karp-Rabin：比 hash，相等才逐字比', async (tok) => {
  fresh([0, 4.8, 13], [0, 2.8, 0]);
  const MOD = 17, hv = (str) => Number(str) % MOD;
  const cd = code(['1 for c in s: rs.append(c)', '2 for c in t[:len(s)]: rt.append(c)', '3 for i in range(len(s), len(t)):', '4   rt.skip(t[i−len(s)]); rt.append(t[i])', '5   if rs() == rt():', '6     逐字檢查 s == t[i−len(s)+1 : i+1]'], -1.6, 6.9, 0.48);
  const X = (i) => -4 + i * 1.0;
  const T = [...M2T].map((c, i) => cube(c, M2.sand, [0.85, 0.7, 0.7], X(i), 1.0, 0));
  tag('rs() = 6006 mod 17 = ' + hv(M2S), 'ptr alt', 4.0, 3.6);
  cd.hl(0);
  say('rs：s 的 rolling hash', '示意：十進位、mod 17');
  await beat(tok, 2400);
  const win = ghostBox(M2.gold, 4.0, 1.0, 1.0); win.position.set(X(1.5), 1.0, 0);
  const rt = tag('', 'ptr', X(1.5), 2.2);
  for (let i = 0; i + 4 <= M2T.length; i++) {
    const sub = M2T.slice(i, i + 4), h = hv(sub);
    win.position.x = X(i + 1.5); rt.position.x = X(i + 1.5);
    txt(rt, 'rt() = ' + sub + ' mod 17 = ' + h);
    cd.hl(i === 0 ? 1 : 3);
    if (h !== hv(M2S)) { say('i = ' + i + '：hash ' + h + ' ≠ 5', '不用比字元'); await beat(tok, 1300); continue; }
    cd.hl(5);
    const real = sub === M2S;
    for (let q = 0; q < 4; q++) glow(T[i + q], real ? GREEN : RED);
    say(real ? 'hash 相等 → 逐字比：真的 match' : 'hash 相等但字串不同', real ? 'O(|s|) 花得值得' : "'0600' ≠ '6006'：collision（假警報）");
    await beat(tok, 2200);
    if (!real) for (let q = 0; q < 4; q++) glow(T[i + q], null);
  }
  cd.hl(-1);
  say('假警報機率 ≤ 1/|s| → 期望 O(1)', 'm 選隨機質數 ≥ |s|');
  await beat(tok, 2800);
  say('總時間 O(|s| + |t| + #match · |s|)', '只找第一個 match → 線性');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-rolling-math', 'Rolling hash 實作：a 進位數 mod m', async (tok) => {
  fresh([0, 4.2, 12], [0, 3.2, 0]);
  const X = (i) => -2.4 + i * 1.1;
  say('把字串看成 a 進位的數', 'a = 字母表大小（ASCII 256；示意 a = 10）');
  let ds = [...'1600'].map((c, i) => cube(c, M2.blue, [0.9, 0.8, 0.8], X(i), 4.6, 0));
  const u = tag('u = 1600', 'ptr', -5.0, 4.6), r = tag('r = 1600 mod 17 = 2', 'ptr alt', 5.0, 4.6);
  await beat(tok, 2600);
  glow(ds[0], RED);
  say('skip(c)：u → u − c·a^(|u|−1)', '1600 − 1·10³ = 600');
  await beat(tok, 2400);
  fly(ds.shift(), V3(-3, 6, 2)); txt(u, 'u = 600');
  await beat(tok, 900);
  txt(r, 'r = (2 − 1·14) mod 17 = 5');
  say('全部 mod m 算', '10³ mod 17 = 14；600 mod 17 = 5 ✓');
  await beat(tok, 2800);
  ds.forEach((c, i) => move(c, X(i), 4.6));
  ds.push(cube('6', M2.green, [0.9, 0.8, 0.8], X(3), 4.6, 0, 2));
  txt(u, 'u = 6006');
  say('append(c)：u → u·a + ord(c)', '600·10 + 6 = 6006');
  await beat(tok, 2600);
  txt(r, 'r = (5·10 + 6) mod 17 = 5');
  say('mod 版本：一次乘法、一次加法', '6006 mod 17 = 5 ✓');
  await beat(tok, 2600);
  tag('r 存：hash 值、a^|u| mod m', 'idx', 0, 2.6);
  say('r 只存兩個數 → 每個操作 O(1)', 'r() 直接回傳存好的 hash 值');
  await beat(tok, 2600);
  say('m：隨機質數，至少 |s|', 'Karp-Rabin 證明：division method 就夠');
  await beat(tok, 3000);
}]);

// ══════════════ rvdJDijO2Ro：L10 Open Addressing, Cryptographic Hashing ══════════════
const M2OA = (z = 0) => m2row(7, -4.5, 1.5, z, 1.2);
FRAG.push(['algmit2-oa-perm', 'Open addressing：probe 序列要是 permutation', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const X = M2OA();
  say('Open addressing：只用一個 array', '一格最多一個 item → m ≥ n');
  await beat(tok, 2600);
  const perm = [4, 1, 3, 0, 6, 2, 5];
  say('h(k, i)：第 i 次 trial 試哪一格', 'h：U × {trial} → {0, …, m−1}');
  for (let i = 0; i < 7; i++) { tag('#' + (i + 1), 'ptr alt', X(perm[i]), 1.4); await beat(tok, 450); }
  say('h(k,1) … h(k,m) 要是 0 … m−1 的排列', '示意序列 4, 1, 3, 0, 6, 2, 5');
  await beat(tok, 2800);
  const its = [];
  for (let s = 0; s < 7; s++) if (s !== 5) its.push([s, m2item('', M2.blue, X(s), 0, 2, 1.0)]);
  say('table 只剩一格（第 5 格）是空的', '');
  await beat(tok, 1800);
  for (let i = 0; i < 7; i++) {
    const s = perm[i], hit = its.find(([q]) => q === s);
    if (hit) { glow(hit[1], RED); await beat(tok, 380); glow(hit[1], null); }
    else { m2item('k', M2.green, X(s), 0, 2.5, 1.0); say('第 7 次 trial 試到第 5 格', 'permutation → 最後一格也一定找得到'); await beat(tok, 2600); }
  }
  say('每一格都是「機會均等」的格子', '只要 probe 夠久就能用到整個 table');
  await beat(tok, 2600);
}]);

FRAG.push(['algmit2-oa-insert', 'Open addressing insert：586、133、204、481、496', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const X = M2OA();
  const T = {};
  const put = async (k, s, cap, f, ms) => { T[s] = m2item(k, M2.blue, X(s), 0, 3, 1.0); say(cap, f); await beat(tok, ms); };
  await put(586, 1, 'insert 586：h(586, 1) = 1', '空的 → 第一次 trial 就成功', 2200);
  await put(133, 2, 'insert 133', 'table 還很空：第一次就成功', 900);
  await put(204, 4, 'insert 204 → 第 4 格', '', 900);
  await put(481, 6, 'insert 481：h(481, 1) = 6', '', 1600);
  const k = cube(496, M2.orange, [1.0, 0.6, 1.0], X(4), 2.2, 0, 1.5);
  glow(T[4], RED);
  say('insert 496：h(496, 1) = 4', '有 204 → 失敗（不是 None 就是被佔）');
  await beat(tok, 2400); glow(T[4], null);
  move(k, X(1), 2.2); await beat(tok, 600); glow(T[1], RED);
  say('h(496, 2) = 1', '有 586 → 又失敗');
  await beat(tok, 2200); glow(T[1], null);
  move(k, X(3), 2.2); await beat(tok, 600);
  move(k, X(3), 0.45); glow(k, GREEN);
  say('h(496, 3) = 3：空的 → 放進去', '第 3 次 trial 成功');
  await beat(tok, 2400);
  say('insert：一直 probe 到空格為止', 'm ≥ n + permutation → 一定放得進去');
  await beat(tok, 3000);
}]);

function m2oaFill(X) { const T = {}; for (const [k, s] of [[586, 1], [133, 2], [496, 3], [204, 4], [481, 6]]) T[s] = m2item(k, M2.blue, X(s), 0, 0, 1.0); return T; }
FRAG.push(['algmit2-oa-search', 'Open addressing search：遇到 k 或 None 才停', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const X = M2OA(), T = m2oaFill(X);
  const cur = tag('▼', 'ptr alt', X(4), 1.6);
  say('search：跟 insert 走同一個 probe 順序', '');
  await beat(tok, 2000);
  for (const [s, cap, f, c] of [[4, 'search 496：h(496,1) = 4', '204 ≠ 496 → 下一個 trial', RED], [1, 'h(496,2) = 1', '586 ≠ 496 → 下一個 trial', RED], [3, 'h(496,3) = 3', '找到 496 → 回傳', GREEN]]) {
    cur.position.set(X(s), 1.6, 0); glow(T[s], c); say(cap, f); await beat(tok, 1800); glow(T[s], null);
  }
  for (const [s, cap, f] of [[2, 'search 700（示意）：h = 2', '133 ≠ 700 → 下一個 trial'], [5, 'h(700, 2) = 5：空格', '遇到 None → 700 不在 table 裡']]) {
    cur.position.set(X(s), 1.6, 0); if (T[s]) glow(T[s], RED); say(cap, f); await beat(tok, 2000); if (T[s]) glow(T[s], null);
  }
  say('遇到 k → 成功；遇到 None → 失敗', '中間被佔用的格子就繼續 probe');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-oa-delete', 'Open addressing delete：DeleteMe 旗標', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const X = M2OA(), T = m2oaFill(X);
  const cur = tag('▼', 'ptr alt', X(1), 1.6);
  glow(T[1], RED);
  say('delete 586：直接設成 None？', '');
  await beat(tok, 1800);
  fly(T[1]); const none = tag('None', 'ptr', X(1), 0.4);
  await beat(tok, 1200);
  cur.position.set(X(4), 1.6, 0); glow(T[4], RED);
  say('search 496：h(496,1) = 4 → 204', '下一個 trial');
  await beat(tok, 1700); glow(T[4], null);
  cur.position.set(X(1), 1.6, 0);
  say('h(496,2) = 1：None → 停', '誤判不存在！496 明明在第 3 格');
  await beat(tok, 2800);
  kill(none);
  T[1] = cube('DeleteMe', M2.purple, [1.25, 0.6, 1.0], X(1), 0.45, 0, 2);
  say('改放 DeleteMe 旗標', '跟 None 不一樣');
  await beat(tok, 2200);
  for (const [s, cap, f, c] of [[4, '再 search 496：4 → 204', '下一個 trial', RED], [1, '第 1 格是 DeleteMe', 'search：當作有東西，繼續找', GOLD], [3, '第 3 格：找到 496', '正確！', GREEN]]) {
    cur.position.set(X(s), 1.6, 0); glow(T[s], c); say(cap, f); await beat(tok, 1700); glow(T[s], null);
  }
  fly(T[1]); await beat(tok, 400);
  m2item(999, M2.green, X(1), 0, 2.5, 1.0);
  say('insert：DeleteMe 當作 None', '空間可以重用（例：999 放進來）');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-linear-probing', 'Linear probing 與 clustering', async (tok) => {
  fresh([0, 6.5, 10], [0, 0, 0.4]);
  const X = m2row(20, -5.7, 0.6, 0, 0.5, (i) => ((i + 40) % 5 === 0 || i === 2 || i === 17 ? String(i + 40) : ''));
  for (let s = 42; s <= 56; s++) cube('', M2.blue, [0.5, 0.4, 0.5], X(s - 40), 0.32, 0);
  say('Linear probing：往下一格一格試', 'h(k,i) = (h′(k) + i) mod m → 是 permutation');
  await beat(tok, 2800);
  say('問題：clustering', '連續被佔的格子越來越長');
  await beat(tok, 2200);
  const cur = tag('▼', 'ptr alt', X(2), 1.1), cnt = tag('', 'ptr', 3.6, 1.6, -1.2);
  for (let s = 42; s <= 57; s++) { cur.position.set(X(s - 40), 1.1, 0); txt(cnt, '第 ' + (s - 41) + ' 次 trial：' + s); await beat(tok, s === 42 ? 1200 : 230); }
  cube('k', M2.orange, [0.5, 0.4, 0.5], X(17), 0.32, 0, 2);
  say('h′(k) = 42 → 43 → … → 57', '笨笨地多試了 15 次才找到空格');
  await beat(tok, 2600);
  say('而且 cluster 又長了一格', '大 cluster 更容易被撞到 → 更大');
  await beat(tok, 2600);
  say('100 格裡有 4 格的 cluster', '掉進去機率 4/100，是一般格子的 4 倍');
  await beat(tok, 2800);
  say('α < 0.99 時就有 Θ(log n) 長的 cluster', '不再是期望 O(1)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-double-hashing', 'Double hashing：h2(k) 與 m 互質', async (tok) => {
  fresh([0, 6.8, 10], [0, 0, 0.4]);
  const m = 8;
  say('Double hashing：跳 h2(k) 格', 'h(k,i) = (h1(k) + i·h2(k)) mod m');
  await beat(tok, 2800);
  const run = async (h2, z, color) => {
    const X = m2row(m, -4.2, 1.2, z, 0.9);
    tag('h2 = ' + h2, 'ptr', -6.0, 0.2, z);
    const seen = new Set();
    for (let i = 0; i < m; i++) {
      const s = (3 + i * h2) % m, again = seen.has(s); seen.add(s);
      tag('#' + (i + 1), again ? 'idx' : 'ptr alt', X(s) + (again ? 0.3 : 0), 1.0 + (again ? 0.5 : 0), z);
      if (!again) cube('', color, [0.8, 0.3, 0.8], X(s), 0.27, z);
      await beat(tok, 350);
    }
    return seen.size;
  };
  const a = await run(3, -1.6, M2.green);
  say('h1 = 3、h2 = 3（示意）', '3 和 8 互質 → 走遍 ' + a + ' 格');
  await beat(tok, 2600);
  const b = await run(2, 1.8, M2.red);
  say('h2 = 2：和 8 有公因數', '只走到 ' + b + ' 格 → 不是 permutation');
  await beat(tok, 2800);
  say('做法：m = 2ʳ、h2(k) 永遠是奇數', '實務上效果很好');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-oa-cost', 'Uniform hashing：期望 probe 數 ≤ 1/(1−α)', async (tok) => {
  fresh([0, 5.2, 12.5], [0, 2.2, 0]);
  say('Uniform hashing assumption', '每個 key 的 probe 順序：m! 種排列等機率');
  await beat(tok, 2800);
  say('不同於 simple uniform hashing', '很難做到；double hashing 很接近');
  await beat(tok, 2600);
  const X = m2row(10, -4.5, 1, 2.2, 0.8);
  const occ = [0, 1, 3, 4, 6, 7, 9], cs = {};
  occ.forEach((s) => { cs[s] = m2item('', M2.blue, X(s), 2.2, 0, 0.8); });
  say('第一次 trial 成功機率 p = (m − n)/m', '= 1 − α（示意 m = 10、n = 7 → 0.3）');
  await beat(tok, 2800);
  const cur = tag('▼', 'ptr alt', X(4), 1.5, 2.2);
  for (const s of [4, 9, 0, 5]) {
    cur.position.set(X(s), 1.5, 2.2);
    if (cs[s]) { glow(cs[s], RED); await beat(tok, 600); glow(cs[s], null); }
    else { m2item('k', M2.green, X(s), 2.2, 2, 0.8); await beat(tok, 800); }
  }
  say('每次成功機率至少 p', '期望 trial 數 ≤ 1/p = 1/(1 − α)');
  await beat(tok, 2800);
  const A = [[0.5, 2], [0.7, 3.3], [0.9, 10], [0.99, 100]];
  for (let q = 0; q < A.length; q++) {
    const [al, v] = A[q], x = -3 + q * 2, b = m2bar(q === 3 ? M2.red : M2.orange, 1.1, 0.9, x, -1.2);
    tag('α = ' + al, 'idx', x, 0, -0.4); tag(String(v), 'ptr', x, Math.min(5.2, v * 0.45) + 0.4, -1.2);
    await anim(tok, 600, (t) => m2set(b, Math.min(5.2, v * 0.45) * t));
  }
  say('α = 0.99 → 平均 100 次 probe', '仍是常數，但很糟');
  await beat(tok, 2800);
  say('實務：α 到 0.5～0.6 就 resize', 'DeleteMe 也算負擔；resize 時清掉');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit2-password', 'Cryptographic hash：密碼只存 h(x)', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  tag('/etc/passwd', 'ptr', -4.2, 6.2);
  say('Cryptographic hash（不考，FYI）', '例：密碼怎麼存');
  await beat(tok, 2400);
  const row = cube('srini : 明文密碼', M2.red, [3.6, 0.7, 0.8], -4.0, 5.2, 0, 2);
  say('笨方法：明文存在檔案裡', '連 sysadmin 都看得到');
  await beat(tok, 2600);
  relabel(row, 'srini : 9f3a…'); tint(row, M2.blue);
  say('只存 h(x)', 'one-way：給 h(x) 很難找出 x');
  await beat(tok, 2800);
  const login = async (typed, out, ok) => {
    const x = cube(typed, M2.sand, [1.8, 0.7, 0.8], -4.0, 2.4, 0, 2);
    const hb = cube('h( )', M2.purple, [1.2, 0.9, 0.9], 0, 2.4, 0);
    arrow(V3(-3.0, 2.4, 0), V3(-0.7, 2.4, 0));
    await beat(tok, 900);
    const o = cube(out, ok ? M2.green : M2.red, [1.6, 0.7, 0.8], 3.6, 2.4, 0, 1.5);
    arrow(V3(0.7, 2.4, 0), V3(2.7, 2.4, 0));
    glow(row, ok ? GREEN : RED);
    return [x, hb, o];
  };
  let objs = await login("x′（輸入）", '9f3a…', true);
  say('登入：把輸入的 x′ 再 hash 一次', 'h(x′) = 存的值 → 放行');
  await beat(tok, 2800);
  objs.forEach(kill); glow(row, null);
  objs = await login('打錯的 x′', '41c7…', false);
  say('打錯 → hash 不同 → 拒絕', '系統從頭到尾不需要知道 x');
  await beat(tok, 2800);
  say('還要 collision resistance 等性質', '也用來偵測檔案是否被竄改或損毀');
  await beat(tok, 2800);
}]);
  }

  // ═══ algmit3.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, tnode, GOLD, GREEN, RED, GRAY } = K;
// ─── MIT 6.006 Rec9（Rolling Hashes、Amortized）、Rec10（Quiz 1 Review）、Rec11（Principles of Algorithm Design）───
// 老師自己的例子：文件 "the fox is" 找 "the"；base 100 的 3 14 15 92 65 35 89 79 31、視窗 5、p = 23（11 → 6）；
// 6⁻¹ ≡ 4 (mod 23)、6·7 → 19 → ×4 → 7；mod 8 的 3·3、3·5、3·7；table 大小 1、2、4、4、8…；
// 兩個串列 13 22 43 56 72 81 86 87 / 2 3 7 9 15 24 28 32、比 15 與 43；
// shifted array 7 9 12 1 3 5 6；min-heap 2 5 7 6 9 8；range-min 陣列 6 7 2 5 3 8 9 4。
// 老師沒給的（bunker 地圖數字、BST 形狀、第 k 小的 k）用「示意」資料並在畫面上標明。
const M3 = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', red: '#d64545', teal: '#31aab0', gold: '#c08a1f', sand: '#c9b48e', pink: '#e55a9b' };
function m3Bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0.0005, z); lab.world.add(m); return m; }
function m3Set(m, h) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = v / 2; }
const m3mod = (a, p) => ((a % p) + p) % p;

// ═══ w6nuXg0BISo：Rec9 Rolling Hashes ═══
FRAG.push(['algmit3-window-the', '滑動視窗：在 "the fox is" 找 "the"', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const D = 'the fox is'.split(''), X = (i) => -4.5 + i;
  const cs = D.map((c, i) => { tag(String(i), 'idx', X(i), 0, 0.9); return cube(c === ' ' ? '␣' : c, M3.sand, [0.85, 0.5, 0.85], X(i), 0.25, 0); });
  ['t', 'h', 'e'].forEach((c, i) => cube(c, M3.blue, [0.85, 0.5, 0.85], -1 + i, 3.4, -1.5));
  tag('key（k = 3）', 'ptr', -3.4, 3.4, -1.5);
  tag('h(key)', 'ptr alt', 2.6, 3.4, -1.5);
  say('大文件裡找一個小字串', '暴力：每個位置逐字比 → O(n·k)');
  await beat(tok, 2800);
  const win = ghostBox(M3.gold, 3.1, 0.9, 1.3); win.position.set(X(1), 0.4, 0);
  const hw = tag('', 'ptr', X(1), 1.7, 0);
  for (let s = 0; s <= 7; s++) {
    win.position.x = X(s + 1); hw.position.x = X(s + 1);
    const w = D.slice(s, s + 3).join('').replace(/ /g, '␣');
    if (s === 0) {
      txt(hw, 'h("the") = h(key)');
      say('視窗 "the"：hash 相同', '還要逐字比對 O(k)');
      await beat(tok, 2200);
      cs.slice(0, 3).forEach((m) => glow(m, GREEN));
      say('逐字相同：真的 match', 'hash 相同不代表字串相同');
      await beat(tok, 2400);
    } else if (s === 1) {
      txt(hw, 'h("' + w + '") ≠ h(key)');
      say('右滑一格：拿掉 t、放進空白', 'hash 不同 → 一定不是 "the"，O(1)');
      await beat(tok, 2800);
    } else if (s === 7) {
      txt(hw, 'h("' + w + '") = h(key)？');
      say('假設這裡 hash 剛好撞到', '一樣要逐字比對');
      await beat(tok, 2200);
      cs.slice(7, 10).forEach((m) => glow(m, RED));
      say('字串不同：false positive', '比完不是，繼續往右滑');
      await beat(tok, 2400);
    } else { txt(hw, 'h("' + w + '") ≠'); await beat(tok, 550); }
  }
  say('hash 不同就跳過，相同才比對', 'Karp-Rabin 字串比對');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-collision', 'Collision 一定有：輸入遠多於輸出', async (tok) => {
  fresh([0, 6, 13], [0, 2.4, 0]);
  const U = ghostBox(M3.blue, 4.4, 4.4, 1); U.position.set(-3.7, 2.6, 0);
  const O = ghostBox(M3.green, 1.8, 2.8, 1); O.position.set(3.7, 2.6, 0);
  tag('輸入：1MB 字串', 'ptr', -3.7, 5.3); tag('256^(10⁶) 種', 'idx', -3.7, 0.1, 0.9);
  tag('輸出：一個 word', 'ptr', 3.7, 4.5); tag('2³² ≈ 40 億種', 'idx', 3.7, 0.9, 0.9);
  say('hash 的輸入、輸出各有幾種？', 'ASCII 256 字元；32-bit word');
  await beat(tok, 2800);
  const IX = (i) => -4.7 + (i % 2) * 2, IY = (i) => 1.1 + Math.floor(i / 2) * 1.4, OY = (j) => 1.6 + j * 0.62;
  const ins = [], outs = [];
  for (let i = 0; i < 6; i++) ins.push(cube('x' + (i + 1), M3.blue, [0.7, 0.4, 0.4], IX(i), IY(i), 0, 1.5));
  for (let j = 0; j < 4; j++) outs.push(cube('', M3.green, [0.5, 0.4, 0.4], 3.7, OY(j), 0, 1.5));
  await beat(tok, 900);
  const ar = [], to = [0, 1, 2, 3, 1, 3];
  for (let i = 0; i < 6; i++) {
    ar.push(arrow(V3(IX(i) + 0.4, IY(i), 0), V3(3.4, OY(to[i]), 0)));
    if (i === 3) { say('每個輸入連到一個輸出…', '輸出很快就用完了'); await beat(tok, 1800); }
    else await beat(tok, 600);
  }
  glow(ins[1], RED); glow(ins[4], RED); glow(outs[1], RED);
  say('x₁ ≠ x₂ 但 h(x₁) = h(x₂)', 'collision：鴿籠原理，躲不掉');
  await beat(tok, 3000);
  say('好的 hash 看起來像隨機', 'false positive 約每 |O| = 2³² 次一次');
  await beat(tok, 2800);
  ar.forEach(kill);
  say('match 才付 O(k)，其他 O(1)', '總時間 = #match·O(k) + #其他·O(1) ≈ O(n)');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-rh-ops', 'Rolling hash：append、skip、hash()', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const box = ghostBox(M3.gold, 5.2, 1.3, 1.5); box.position.set(0, 0.65, 0);
  tag('rolling hash', 'ptr', 0, 2.2, 0);
  const XS = (n, i) => -(n - 1) * 0.55 + i * 1.1;
  const arr = ['T', 'H', 'E'].map((c, i) => cube(c, M3.sand, [0.9, 0.55, 0.9], XS(3, i), 0.3, 0));
  say('rolling hash 裡放著一串字元', '對應 sliding window 的內容');
  await beat(tok, 2600);
  const nw = cube('␣', M3.blue, [0.9, 0.55, 0.9], XS(4, 3), 0.3, 0, 3); arr.push(nw);
  arr.forEach((m, i) => move(m, XS(4, i), 0.3, 0));
  say('append(c)：從右邊加進一個字元', '要 O(1)');
  await beat(tok, 2600);
  fly(arr.shift(), V3(-6, 5, 0));
  arr.forEach((m, i) => move(m, XS(3, i), 0.3, 0));
  say('skip()（想成 pop）：拿掉最左邊', '講義叫 skip，也要 O(1)');
  await beat(tok, 2600);
  arr.forEach((m) => glow(m, GOLD));
  const q = tag('hash() = h("HE␣")', 'ptr alt', 0, 3.4, 0);
  say('query：hash() 回傳視窗內的 hash', '也要 O(1)，比對才會快');
  await beat(tok, 2800);
  kill(q); arr.forEach((m) => glow(m, null));
  say('視窗滑一格 = append 新的 + skip 舊的', '三個操作都 O(1) → 每個位置 O(1)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-base100', 'Base 100 的數字：視窗 5、mod 23', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const D = [3, 14, 15, 92, 65, 35, 89, 79, 31], X = (i) => -4.8 + i * 1.2;
  const cs = D.map((d, i) => cube(d, M3.sand, [1.05, 0.55, 0.9], X(i), 0.28, 0, 1 + i * 0.3));
  say('字元就是數字：用 base 100 方便手算', '一格 = 一個 base-100 digit');
  await beat(tok, 2800);
  const win = ghostBox(M3.gold, 6.1, 1.0, 1.3); win.position.set(X(2), 0.5, 0);
  const nT = tag('n = 314159265', 'ptr', X(2), 1.8, 0);
  const hT = tag('', 'ptr alt', X(2), 2.6, 0);
  cs.slice(0, 5).forEach((m) => tint(m, M3.blue));
  say('視窗大小 k = 5', 'n = 03 14 15 92 65');
  await beat(tok, 2600);
  txt(hT, 'hash = n mod 23 = 11');
  say('hash = n mod p，p 取質數 23', '314159265 mod 23 = 11');
  await beat(tok, 2800);
  tint(cs[0], M3.sand); tint(cs[5], M3.blue);
  win.position.x = X(3); nT.position.x = X(3); hT.position.x = X(3);
  txt(nT, 'n = 1415926535'); txt(hT, 'hash = ?');
  say('視窗往右滑一格', '1415926535 mod 23 = ?');
  await beat(tok, 2600);
  txt(hT, 'hash = 6');
  say('第二個視窗的 hash = 6', '每次重算 n mod p 要 O(k)');
  await beat(tok, 2600);
  say('能不能從 11 直接算到 6？', '→ 定義 slide(old, new)');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-slide-n', 'slide：去掉 old、乘 base、加 new', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.6, 0]);
  const X = (i) => -3.3 + i * 1.3;
  const arr = [3, 14, 15, 92, 65].map((d, i) => cube(d, M3.blue, [1.1, 0.6, 0.9], X(i), 0.3, 0));
  const nT = tag('n = 314159265', 'ptr', 0, 2.2, 0);
  tag('old = 3', 'idx', X(0), 1.1, 0.8); tag('new = 35', 'idx', X(5), 1.1, 0.8);
  say('從舊的 n 變成新的 n', '314159265 → 1415926535');
  await beat(tok, 2800);
  glow(arr[0], RED);
  say('先減掉 old 和它後面的 0', '3 後面 8 個 0 = 3·100⁴');
  await beat(tok, 2600);
  fly(arr.shift(), V3(-5, 6, 0));
  txt(nT, 'n = 314159265 − 3·100⁴ = 14159265');
  say('n − old·base^(k−1)', '= 14159265');
  await beat(tok, 2800);
  arr.forEach((m, i) => move(m, X(i), 0.3, 0));
  txt(nT, 'n = 14159265 × 100 = 1415926500');
  say('整體左移一格 = 乘上 base', '× 100：後面多兩個 0');
  await beat(tok, 2800);
  arr.push(cube(35, M3.green, [1.1, 0.6, 0.9], X(4), 0.3, 0, 3));
  txt(nT, 'n = 1415926500 + 35 = 1415926535');
  say('再加上 new = 35', '對了：1415926535');
  await beat(tok, 2800);
  tag('n ← (n − old·base^(k−1))·base + new', 'ptr alt', 0, 3.5, 0);
  say('寫成一般式，把 base 分配進去', 'n·base − old·base^size + new（size = k）');
  await beat(tok, 3400);
}]);

FRAG.push(['algmit3-hash-magic', 'hash = (hash·base − old·magic + new) mod p', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 2, 0]);
  tag('hash = (n·base − old·base^size + new) mod p', 'ptr', 0, 5.2, 0);
  const nB = cube('n = 1415926535…', M3.red, [3.2, 0.7, 1], -3.4, 2.4, 0, 2);
  const bB = cube('base^size = 100⁵', M3.red, [3.2, 0.7, 1], 3.4, 2.4, 0, 2);
  say('兩邊 mod 23：hash 等於 n mod p', '只有 n、base^size 是大數');
  await beat(tok, 3000);
  ['base', 'old', 'new', 'p'].forEach((s, i) => cube(s, M3.green, [1, 0.45, 0.8], -2.4 + i * 1.6, 0.23, 1.6, 1.5));
  say('base、old、new、p 都是小數字', '大數的運算不是 O(1)');
  await beat(tok, 2600);
  relabel(nB, 'n mod p = hash'); tint(nB, M3.blue);
  say('n mod p 就是目前的 hash', '大數 n 不用存');
  await beat(tok, 2600);
  say('base^size：快速冪也要 O(log size)', 'repeated squaring；size 跟輸入一起變大');
  await beat(tok, 3000);
  relabel(bB, 'magic = 100⁵ mod 23 = 16'); tint(bB, M3.blue);
  say('先算好存起來，叫它 magic', 'magic = base^size mod p');
  await beat(tok, 2800);
  const r = tag('(11·100 − 3·16 + 35) mod 23', 'ptr alt', 0, 4.1, 0);
  say('代回去：hash = 11、old = 3、new = 35', '1100 − 48 + 35 = 1087');
  await beat(tok, 2800);
  txt(r, '1087 mod 23 = 6 ✓'); glow(nB, GREEN);
  say('得到 6，跟直接算一樣', '只用小數字運算 → O(1)');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-append', 'init 與 append：hash、magic 都 mod p', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.8, 0]);
  const cd = code(['init(base, p):', '  hash = 0', '  magic = 1', 'append(new):', '  hash = (hash·base + new) mod p', '  magic = magic·base mod p'], -3, 6.2, 0.6);
  const hT = tag('hash = 0', 'ptr', 3.6, 5.4), mT = tag('magic = 1', 'ptr alt', 3.6, 4.6), sT = tag('size = 0', 'idx', 3.6, 3.9);
  cd.hl(1);
  say('一開始是空的：hash = 0', 'base = 100，p = 23');
  await beat(tok, 2400);
  cd.hl(2);
  say('size = 0：base⁰ = 1', 'magic = base^size mod p = 1');
  await beat(tok, 2400);
  const D = [3, 14, 15, 92, 65], X = (i) => -2.6 + i * 1.3;
  let h = 0, mg = 1;
  for (let i = 0; i < D.length; i++) {
    cube(D[i], M3.blue, [1.1, 0.6, 0.9], X(i), 0.3, 0.6, 3);
    const h0 = h; h = (h * 100 + D[i]) % 23; mg = (mg * 100) % 23;
    cd.hl(4); txt(hT, 'hash = ' + h); txt(sT, 'size = ' + (i + 1));
    say('append(' + D[i] + ')', '(' + h0 + '·100 + ' + D[i] + ') mod 23 = ' + h);
    await beat(tok, i < 2 ? 2400 : 1500);
    cd.hl(5); txt(mT, 'magic = ' + mg);
    if (i === 0) { say('size 多 1 → magic 乘 base', 'magic = 1·100 mod 23 = 8'); await beat(tok, 2400); }
    else await beat(tok, 700);
  }
  cd.hl(-1);
  say('hash = 11、magic = 16', '跟 314159265 mod 23 一樣');
  await beat(tok, 2800);
  say('mod p 一定要寫！', '不然 Python 會默默算大數，越跑越慢');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-skip-neg', 'skip：減掉 old·magic，先補 p·base', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.4, 0]);
  const D = [3, 14, 15, 92, 65, 35], X = (i) => -3.4 + i * 1.3;
  const arr = D.map((d, i) => cube(d, M3.blue, [1.1, 0.6, 0.9], X(i), 0.3, 0.6));
  const hT = tag('hash = 8', 'ptr', -3, 5.4), mT = tag('magic = 13', 'ptr alt', 1.2, 5.4), sT = tag('size = 6', 'idx', 4.4, 5.4);
  say('append(35) 之後：視窗有 6 個', 'hash = 31415926535 mod 23 = 8');
  await beat(tok, 2800);
  glow(arr[0], RED);
  say('skip(3)：old 的權重是 base^(size−1)', '所以先把 magic 降一階');
  await beat(tok, 2800);
  txt(mT, 'magic = 13·ibase mod 23 = 16'); txt(sT, 'size = 5');
  say('magic ← magic·ibase mod p', 'ibase = 100⁻¹ mod 23 = 3；13·3 = 39 ≡ 16');
  await beat(tok, 3000);
  const r = tag('8 − 3·16 = −40', 'ptr alt', 0, 3.6, 0);
  say('hash − old·magic 變成負數了', '−40 < 0');
  await beat(tok, 2600);
  const m1 = tag('數學：−3 mod 23 = 20', 'idx', -2.6, 2.6, 0), m2 = tag('C／Java：−3 % 23 = −3', 'idx', 2.6, 2.6, 0);
  say('數學上 mod 永遠是正的', '程式語言的 % 可能回傳負數');
  await beat(tok, 3000);
  kill(m1); kill(m2);
  txt(r, '(−40 + 23·100) mod 23 = 2260 mod 23 = 6');
  say('加上 p 的倍數，mod p 結果不變', 'old·magic < base·p → 加 p·base 一定夠');
  await beat(tok, 3200);
  fly(arr.shift(), V3(-6, 5, 0));
  arr.forEach((m, i) => move(m, X(i), 0.3, 0.6));
  txt(hT, 'hash = 6');
  say('hash = 6 = h(14 15 92 65 35) ✓', 'hash = (hash − old·magic + p·base) mod p');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-inverse', '乘法反元素：6⁻¹ ≡ 4 (mod 23)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.4, 0]);
  const CX = -1.6, CY = 3.6, R = 3.1;
  const P = (i) => { const a = Math.PI / 2 - (2 * Math.PI * i) / 23; return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };
  const ring = [];
  for (let i = 0; i < 23; i++) { const [x, y] = P(i); ring.push(cube(i, M3.sand, [0.5, 0.42, 0.42], x, y, 0)); }
  tag('mod 23', 'ptr', CX, CY, 0);
  const eq = tag('', 'ptr alt', 4.6, 5.6, 0);
  say('mod 質數 p：1..p−1 都有反元素 a⁻¹', 'a · a⁻¹ ≡ 1 (mod p)');
  await beat(tok, 2800);
  glow(ring[6], GOLD); glow(ring[4], GOLD);
  txt(eq, '6 · 4 = 24 ≡ 1');
  say('6 的反元素是 4', '6·4 = 24 = 23 + 1');
  await beat(tok, 2800);
  glow(ring[6], null); glow(ring[4], null);
  glow(ring[7], GREEN);
  say('從 7 開始：先乘 6', '');
  await beat(tok, 1600);
  const [x7, y7] = P(7), [x19, y19] = P(19);
  const a1 = arrow(V3(x7, y7, 0.4), V3(x19, y19, 0.4), 0xdd8238);
  glow(ring[19], GOLD); txt(eq, '7 · 6 = 42 ≡ 19');
  say('7·6 = 42 ≡ 19 (mod 23)', '');
  await beat(tok, 2400);
  const a2 = arrow(V3(x19, y19, 0.6), V3(x7, y7, 0.6), 0x2fc092);
  txt(eq, '19 · 4 = 76 ≡ 7');
  say('再乘 4：76 = 69 + 7 ≡ 7', '回到 7：乘 a⁻¹ 抵銷乘 a');
  await beat(tok, 3000);
  kill(a1); kill(a2); glow(ring[19], null); glow(ring[7], null);
  txt(eq, 'magic ← magic · base⁻¹ mod p');
  say('skip 要把 magic「除以 base」', '改成乘 base⁻¹，仍是整數');
  await beat(tok, 2800);
  glow(ring[8], GOLD); glow(ring[3], GOLD);
  txt(eq, 'ibase = 100⁻¹ ≡ 8⁻¹ ≡ 3');
  say('base 不變 → ibase 在 init 算一次', '100 ≡ 8，8·3 = 24 ≡ 1');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-rh-code', '完整 rolling hash：每個操作 O(1)', async (tok) => {
  fresh([0, 4.5, 13], [0, 3.2, 0]);
  const cd = code([
    'init(base, p):',
    '  hash = 0;  magic = 1',
    '  ibase = base⁻¹ mod p',
    'append(new):',
    '  hash = (hash·base + new) mod p',
    '  magic = magic·base mod p',
    'skip(old):',
    '  magic = magic·ibase mod p',
    '  hash = (hash − old·magic + p·base) mod p',
    'hash():',
    '  return hash',
  ], -1.2, 6.6, 0.55);
  const cost = tag('', 'ptr alt', 4.8, 6, 0);
  say('把三個操作寫成 pseudocode', 'invariant：magic = base^size mod p');
  await beat(tok, 2800);
  const parts = [[0, 2, 'init：只做一次', 'base⁻¹ 慢也沒關係'], [3, 5, 'append：O(1)', '只有小數字的乘、加、mod'], [6, 8, 'skip：O(1)', 'magic 先乘 ibase，再減 old·magic'], [9, 10, 'hash()：O(1)', 'hash 一直都算好了，直接回傳']];
  for (const [a, b, cap, fm] of parts) {
    for (let i = a; i <= b; i++) { cd.hl(i); await beat(tok, 450); }
    cost.position.y = 6.6 - ((a + b) / 2) * 0.55; txt(cost, cap.split('：')[1]);
    say(cap, fm);
    await beat(tok, 2600);
  }
  cd.hl(-1);
  cube('hash < p', M3.blue, [1.6, 0.5, 0.8], -2, 0.25, 1.5, 2); cube('magic < p', M3.blue, [1.6, 0.5, 0.8], 0.4, 0.25, 1.5, 2);
  say('mod p 讓所有數字都小於 p', 'append、skip、hash() 都是 O(1)');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-caterpillar', 'Caterpillar：視窗大小可以變', async (tok) => {
  fresh([0, 5.5, 13], [0, 2, 0]);
  const hT = tag('hash = 0', 'ptr', -3.4, 5), mT = tag('magic = 1', 'ptr alt', 0.4, 5), sT = tag('size = 0', 'idx', 3.8, 5);
  const X = (i) => -3 + i * 1.3;
  let arr = [], vals = [], h = 0, mg = 1;
  say('一般的 rolling hash：append、skip 任意順序', '不只是固定大小的視窗');
  await beat(tok, 2800);
  const ops = [['a', 3], ['a', 14], ['a', 15], ['s'], ['a', 92], ['a', 65], ['s']];
  for (const [op, v] of ops) {
    if (op === 'a') {
      mg = (mg * 100) % 23; h = (h * 100 + v) % 23; vals.push(v);
      arr.push(cube(v, M3.blue, [1.1, 0.6, 0.9], X(arr.length), 0.3, 0, 3));
      say('append(' + v + ')：size +1', 'magic ×base → ' + mg + '；hash → ' + h);
    } else {
      const old = vals.shift(); mg = (mg * 3) % 23; h = m3mod(h - old * mg, 23);
      fly(arr.shift(), V3(-6, 5, 0)); arr.forEach((m, i) => move(m, X(i), 0.3, 0));
      say('skip(' + old + ')：size −1', 'magic ×ibase → ' + mg + '；hash → ' + h);
    }
    txt(hT, 'hash = ' + h); txt(mT, 'magic = ' + mg); txt(sT, 'size = ' + vals.length);
    await beat(tok, 2200);
  }
  const n = vals.reduce((s, d) => s * 100 + d, 0);
  tag(vals.join(' ') + ' → ' + n + ' mod 23 = ' + (n % 23), 'ptr alt', 0, 3.4, 0);
  say('驗算：跟直接算一樣', 'magic 永遠 = base^size mod p');
  await beat(tok, 3000);
  say('用 shift 存整個大數？', 'hash() 就要 O(size)，不行');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-p-prime', 'p 的取捨：要大、要快、要是質數', async (tok) => {
  fresh([0, 5, 13], [0, 2.2, 0]);
  const fb = m3Bar(M3.red, 1, 1, -5, 0), cb = m3Bar(M3.blue, 1, 1, -3.4, 0);
  tag('false positive ≈ 1/p', 'idx', -5, 0, 1.1); tag('運算成本', 'idx', -3.4, 0, 1.8);
  const pT = tag('', 'ptr', -4.2, 4.9);
  say('p 越大，false positive 越少', '輸出只有 p 種 → 約 1/p');
  for (let e = 4; e <= 40; e += 2) {
    m3Set(fb, 3.8 * 4 / e); m3Set(cb, e <= 32 ? 0.6 : 3.4); txt(pT, 'p ≈ 2^' + e);
    if (e === 32) { say('超過一個 word 就不是一個指令了', '運算成本跳上去'); await beat(tok, 2400); }
    else await beat(tok, 260);
  }
  m3Set(fb, 3.8 * 4 / 31); m3Set(cb, 0.6); txt(pT, 'p ≈ 2³²（略小的質數）');
  say('trade-off：p 放得進一個 word', '取略小於 2³² 的質數');
  await beat(tok, 3000);
  tag('mod 8（不是質數）', 'ptr', 2.6, 5.2);
  const rows = [[2, '2·x mod 8：2 4 6 0 2 4 6', false], [3, '3·3 = 9 ≡ 1', true], [3, '3·5 = 15 ≡ 7', null], [3, '3·7 = 21 ≡ 5', null]];
  for (let r = 0; r < rows.length; r++) {
    const [a, s, ok] = rows[r];
    const c = cube(a, ok === false ? M3.red : ok ? M3.green : M3.sand, [0.6, 0.5, 0.6], 0.4, 4.2 - r * 0.9, 0, 2);
    tag(s, 'idx', 3.6, 4.2 - r * 0.9);
    if (r === 0) { say('2 乘什麼都得不到 1', '2 在 mod 8 沒有反元素'); await beat(tok, 2800); }
    else if (r === 1) { say('3 的反元素是自己', '3·3 ≡ 1'); await beat(tok, 2200); }
    else await beat(tok, 1300);
    if (!ok) glow(c, null);
  }
  say('模數不是質數，skip 就壞了', 'magic = base^size mod p 的 invariant 要靠 ibase');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-amort-chop', 'Table doubling：把大成本切開攤平', async (tok) => {
  fresh([0, 4.5, 13], [0, 1.8, 0]);
  const X = (i) => -6.1 + i * 0.72, N = 16, cost = [];
  let size = 0, total = 0;
  const bars = [], sT = tag('table 大小 0', 'ptr', -3.6, 4.6), tT = tag('總成本 0', 'ptr alt', 3, 4.6);
  say('從大小 1 的 table 一直插入', '有空位 O(1)；滿了要 resize，搬 n 個');
  await beat(tok, 2800);
  for (let i = 1; i <= N; i++) {
    let c = 1;
    if (size === 0) size = 1; else if (i > size) { c = i; size *= 2; }
    cost.push(c); total += c;
    const b = m3Bar(c > 1 ? M3.red : M3.green, 0.5, 0.6, X(i), 0); m3Set(b, c * 0.42); bars.push(b);
    tag(String(i), 'idx', X(i), 0, 0.7);
    txt(sT, 'table 大小 ' + size); txt(tT, '總成本 ' + total);
    if (i === 2 || i === 3 || i === 5) { say('第 ' + i + ' 個：resize 到 ' + size, '成本 ' + c); await beat(tok, 1700); }
    else if (i === 9) { say('到 8 之後：7 次便宜、1 次很貴', '第 9 個成本 9，table 變 16'); await beat(tok, 2400); }
    else await beat(tok, 300);
  }
  say('把大成本切成小塊，分給前面便宜的', '貴的間隔也每次加倍');
  await beat(tok, 2600);
  const h0 = bars.map((b) => b.scale.y);
  await anim(tok, 1600, (t) => bars.forEach((b, k) => m3Set(b, h0[k] + (3 * 0.42 - h0[k]) * t)));
  bars.forEach((b) => tint(b, M3.blue));
  say('攤平後每次約 3：dampening', 'CPU 實際時間沒變，變的是分析');
  await beat(tok, 2800);
  say('前 16 次總成本 ' + total + ' ≤ 3·16', '不是 n²，而是 O(n)');
  await beat(tok, 3200);
}]);

FRAG.push(['algmit3-bst-succ', 'min + successor 走訪 BST：每條邊走兩次', async (tok) => {
  fresh([0, 4.5, 13], [0, 3.2, 0]);
  const POS = { 8: [0, 5.6], 4: [-2.8, 4.1], 12: [2.8, 4.1], 2: [-4.2, 2.6], 6: [-1.4, 2.6], 10: [1.4, 2.6], 14: [4.2, 2.6] };
  const PAR = { 4: 8, 12: 8, 2: 4, 6: 4, 10: 12, 14: 12 };
  const nd = {};
  [8, 4, 12, 2, 6, 10, 14].forEach((v) => { nd[v] = tnode(v, POS[v][0], POS[v][1], 0, PAR[v] ? nd[PAR[v]] : null, M3.sand); });
  tag('示意 BST（n = 7）', 'idx', -5, 6.2);
  const cnt = {}, ct = {};
  Object.keys(PAR).forEach((c) => { const [x1, y1] = POS[c], [x2, y2] = POS[PAR[c]]; cnt[c] = 0; ct[c] = tag('0', 'idx', (x1 + x2) / 2 + (x1 < x2 ? -0.35 : 0.35), (y1 + y2) / 2 + 0.2, 0.3); });
  const cur = cube('', M3.gold, [0.4, 0.4, 0.4], 0, 6.4, 0);
  const tot = tag('走過的邊 0', 'ptr alt', 4.6, 6.2);
  say('min，然後一直呼叫 successor', '每次 O(log n) → 上界 O(n log n)');
  await beat(tok, 3000);
  const path = [8, 4, 2, 'o', 4, 'o', 6, 'o', 4, 8, 'o', 12, 10, 'o', 12, 'o', 14, 'o', 12, 8];
  let at = 8, total = 0, ox = -4.6;
  for (const s of path) {
    if (s === 'o') { cube(at, M3.green, [0.6, 0.45, 0.6], ox, 0.23, 1.6, 2); ox += 1.1; glow(nd[at], GREEN); await beat(tok, 500); continue; }
    if (s !== at) { const c = PAR[s] === at ? s : at; cnt[c]++; total++; txt(ct[c], String(cnt[c])); txt(tot, '走過的邊 ' + total); }
    at = s; move(cur, POS[s][0], POS[s][1] + 0.8, 0);
    await beat(tok, 550);
  }
  say('14 的 successor：一路往上到根，回傳 null', '');
  await beat(tok, 2000);
  say('每條邊剛好走兩次：2(n−1) = 12', 'n 次 successor 總共 O(n)，攤銷 O(1)');
  await beat(tok, 3200);
  say('range(L, H) 同理', 'O(log n + 輸出個數)');
  await beat(tok, 2800);
}]);

// ═══ -FElVPKykgw：Rec10 Quiz 1 Review ═══
FRAG.push(['algmit3-resize-cost', 'Resize 成本：滿或空都是 Θ(m)', async (tok) => {
  fresh([0, 6, 13], [0, 1.5, 0]);
  const X = (i) => -5.2 + i * 0.95, NX = (j) => -6 + j * 0.78, m = 8;
  tag('空 table', 'ptr', -6.3, 0.3, -1.6); tag('滿 table', 'ptr', -6.3, 0.3, 1.6);
  const full = [];
  for (let i = 0; i < m; i++) {
    cube('nil', GRAY, [0.8, 0.1, 0.8], X(i), 0.05, -1.6);
    cube('', GRAY, [0.8, 0.1, 0.8], X(i), 0.05, 1.6);
    full.push(cube('@' + (i + 1), M3.blue, [0.6, 0.45, 0.6], X(i), 0.32, 1.6));
  }
  for (let j = 0; j < 15; j++) cube('', '#e8dcc4', [0.6, 0.06, 0.6], NX(j), 2.6, 1.6);
  tag('新 table（2m）', 'idx', 4.2, 3.1, 1.6);
  const e = tag('index 0・move 0', 'ptr alt', 3.6, 1.2, -1.6), f = tag('index 0・move 0', 'ptr alt', 3.6, 0.9, 3.2);
  say('table 存的是物件的 reference（位址）', '搬一格 O(1)，跟物件多大無關');
  await beat(tok, 3000);
  const cur = cube('', M3.gold, [0.3, 0.3, 0.3], X(0), 1, -1.6);
  for (let i = 0; i < m; i++) { move(cur, X(i), 1, -1.6); txt(e, 'index ' + (i + 1) + '・move 0'); await beat(tok, 260); }
  say('空 table：m 次 index、0 次搬移', '→ O(m)');
  await beat(tok, 2400);
  for (let i = 0; i < m; i++) { move(cur, X(i), 1, 1.6); move(full[i], NX((i * 5) % 15), 2.95, 1.6); txt(f, 'index ' + (i + 1) + '・move ' + (i + 1)); await beat(tok, 380); }
  say('滿 table：m 次 index、m 次搬移', 'O(2m) = O(m)');
  await beat(tok, 2600);
  say('不管滿或空，resize 都是 Θ(m)', '');
  await beat(tok, 2800);
}]);

const M3MAP = [[1, 2, 1, 2, 3, 0, 0, 1], [0, 0, 1, 1, 2, 1, 0, 2], [2, 1, 0, 0, 1, 2, 3, 0], [1, 0, 2, 3, 0, 1, 2, 1], [0, 1, 1, 2, 1, 0, 0, 2]];
const M3PAT = [[2, 3, 0], [1, 2, 1]];
const m3MX = (c) => -3.5 + c, m3MZ = (r) => -2 + r;
function m3DrawMap() {
  const t = [];
  M3MAP.forEach((row, r) => { t.push(row.map((v, c) => cube(v, v >= 2 ? '#e0c27a' : M3.sand, [0.9, 0.2, 0.9], m3MX(c), 0.1, m3MZ(r)))); });
  tag('W = 8、H = 5（示意）', 'idx', -5.6, 0.1, -2.6);
  M3PAT.forEach((row, r) => row.forEach((v, c) => cube(v, M3.purple, [0.6, 0.2, 0.6], 4.6 + c * 0.65, 2.6 - r * 0.65, -3)));
  tag('bunker：w = 3、h = 2', 'ptr', 5.25, 3.5, -3);
  return t;
}
function m3IsMatch(r, c) { for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) if (M3MAP[r + i][c + j] !== M3PAT[i][j]) return false; return true; }

FRAG.push(['algmit3-bunker-naive', 'Bunker hill：2D 樣式比對暴力法', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.2]);
  const t = m3DrawMap();
  say('夜間衛星圖：找 bunker 出現幾次', 'W×H 的亮度圖裡找 w×h 的樣式');
  await beat(tok, 3000);
  const win = ghostBox(M3.gold, 3, 0.6, 2); const cT = tag('', 'ptr alt', 0, 1.3, 2.6);
  let k = 0;
  for (let r = 0; r <= 3; r++) for (let c = 0; c <= 5; c++) {
    k++; win.position.set(m3MX(c + 1), 0.3, m3MZ(r) + 0.5); txt(cT, '位置 ' + k + '：比 w·h = 6 格');
    if (m3IsMatch(r, c)) { for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) glow(t[r + i][c + j], GREEN); say('找到一個 match', ''); await beat(tok, 1500); }
    else await beat(tok, 260);
  }
  say('(W−w+1)(H−h+1) 個位置', '每個位置比 w·h 格');
  await beat(tok, 2800);
  say('暴力法 O(WH·wh)', '比輸入大小 WH 還多一個 wh');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-bunker-1d', 'Bunker hill：整塊 rolling hash 往右滑', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.2]);
  const t = m3DrawMap();
  say('最好是 O(WH)：至少要看完整張圖', '只比左上角？重複值多就一堆 false positive');
  await beat(tok, 3200);
  const win = ghostBox(M3.gold, 3, 0.6, 2);
  say('對整個視窗做 rolling hash', '往右滑：拿掉左欄、加進右欄');
  for (let c = 0; c <= 5; c++) {
    win.position.set(m3MX(c + 1), 0.3, -1.5);
    if (c > 0) { for (let i = 0; i < 2; i++) { glow(t[i][c - 1], RED); glow(t[i][c + 2], GREEN); } }
    await beat(tok, c === 1 ? 2400 : 900);
    if (c > 0) for (let i = 0; i < 2; i++) { glow(t[i][c - 1], null); glow(t[i][c + 2], null); }
  }
  say('每滑一格要動一整欄：O(h)', '總共 O(WH·h)：進步了一步');
  await beat(tok, 3000);
  say('能不能讓加一欄也是 O(1)？', '→ 先把每一欄 hash 起來');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-bunker-2d', 'Hash of hashes：直向 rolling hash', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.4]);
  const t = m3DrawMap();
  const colH = [];
  for (let c = 0; c < 8; c++) colH.push(cube('h' + c, M3.teal, [0.8, 0.4, 0.6], m3MX(c), 0.2, 3.6, 2));
  const band = ghostBox(M3.teal, 8.2, 0.4, 2); band.position.set(0, 0.25, -1.5);
  say('每一欄各一個直向 rolling hash', 'W 個，每個裝 h 格');
  await beat(tok, 3000);
  const win = ghostBox(M3.gold, 3, 0.6, 0.9);
  say('在 W 個欄 hash 上做 1D Karp-Rabin', '視窗 = w 個欄 hash（hash of hashes）');
  for (let c = 0; c <= 5; c++) { win.position.set(m3MX(c + 1), 0.4, 3.6); await beat(tok, c === 0 ? 2200 : 600); }
  for (let r = 1; r <= 3; r++) {
    band.position.z = m3MZ(r) + 0.5;
    for (let c = 0; c < 8; c++) { glow(t[r - 1][c], RED); glow(t[r + 1][c], GREEN); }
    say('往下一列：每個欄 hash 滾一格', '出去一格、進來一格，O(1)');
    await beat(tok, r === 1 ? 2600 : 1200);
    for (let c = 0; c < 8; c++) { glow(t[r - 1][c], null); glow(t[r + 1][c], null); }
    for (let c = 0; c <= 5; c++) { win.position.set(m3MX(c + 1), 0.4, 3.6); await beat(tok, 220); }
  }
  say('總時間 O(WH)，額外空間 O(W)', '1D 的方法推廣到 2D');
  await beat(tok, 3200);
}]);

const M3A = [13, 22, 43, 56, 72, 81, 86, 87], M3B = [2, 3, 7, 9, 15, 24, 28, 32];
const m3LX = (i) => -4.9 + i * 1.4;
function m3Lists() {
  const ma = M3A.map((v, i) => { tag('A' + (i + 1), 'idx', m3LX(i), 0, -0.4); return cube(v, M3.blue, [1.1, 0.6, 0.9], m3LX(i), 0.3, -1.3); });
  const mb = M3B.map((v, i) => { tag('B' + (i + 1), 'idx', m3LX(i), 0, 2.1); return cube(v, M3.purple, [1.1, 0.6, 0.9], m3LX(i), 0.3, 1.2); });
  return [ma, mb];
}

FRAG.push(['algmit3-kth-merge', '兩個已排序串列：merge 到第 k 個', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.2, 0.6]);
  const [ma, mb] = m3Lists();
  tag('k = 8（示意）', 'ptr alt', 0, 3.6, -1.3);
  say('兩個已排序串列，找合併後第 k 小', '數字都不同');
  await beat(tok, 2800);
  say('最直接：整個 merge 再取第 k 個', 'O(N₁ + N₂)，還要一個新陣列');
  await beat(tok, 2600);
  const pi = tag('i', 'ptr', m3LX(0), 1.2, -1.3), pj = tag('j', 'ptr', m3LX(0), 1.2, 1.2);
  let i = 0, j = 0, last = 0;
  for (let r = 1; r <= 8; r++) {
    const fromA = M3A[i] < M3B[j];
    const m = fromA ? ma[i] : mb[j]; last = fromA ? M3A[i] : M3B[j];
    glow(m, GOLD); move(m, -4.9 + (r - 1) * 1.15, 0.3, 3.6);
    if (fromA) i++; else j++;
    pi.position.x = m3LX(i); pj.position.x = m3LX(j);
    say('第 ' + r + ' 小：' + last, fromA ? 'A 的比較小' : 'B 的比較小');
    await beat(tok, 900);
  }
  say('merge 到第 k 個就停：第 8 小 = ' + last, '時間 O(k)，空間 O(1)');
  await beat(tok, 3000);
  say('還是線性；想要對數時間', '→ 像 binary search 一樣每次丟一半');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-kth-15-43', '比 15 與 43：兩頭各丟一段', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.2, 0.6]);
  const [ma, mb] = m3Lists();
  const kT = tag('找第 k = 8 小（示意）', 'ptr alt', 0, 3.6, -1.3);
  say('取 A 第 3 個、B 第 5 個（3 + 5 = k）', '老師的例子：43 與 15');
  glow(ma[2], GOLD); glow(mb[4], GOLD);
  await beat(tok, 3000);
  say('15 < 43', '15 左邊（含 15）排名都 < 8');
  await beat(tok, 2600);
  for (let q = 0; q <= 4; q++) { tint(mb[q], GRAY); glow(mb[q], null); }
  say('丟掉 B 的 2、3、7、9、15', 'k 變成 8 − 5 = 3');
  await beat(tok, 2600);
  for (let q = 3; q < 8; q++) { tint(ma[q], GRAY); glow(ma[q], null); }
  txt(kT, '剩下找第 k = 3 小');
  say('43 右邊的排名都 > 8：也丟掉', '剩 13 22 43 與 24 28 32');
  await beat(tok, 3000);
  glow(ma[2], null); glow(ma[1], GOLD); glow(mb[5], GOLD);
  say('再比：A 第 2 個 22、B 第 1 個 24', '2 + 1 = 3');
  await beat(tok, 2600);
  [0, 1].forEach((q) => { tint(ma[q], GRAY); glow(ma[q], null); });
  [6, 7].forEach((q) => tint(mb[q], GRAY));
  txt(kT, '剩下找第 k = 1 小');
  say('22 < 24：丟 13、22；也丟 28、32', 'k = 3 − 2 = 1');
  await beat(tok, 2800);
  glow(mb[5], GREEN); tint(mb[5], M3.green);
  say('k = 1：43 和 24 取小的 → 24', '合併後 2 3 7 9 13 15 22 24');
  await beat(tok, 2800);
  say('每輪 k 約減半 → O(log k)', '比 O(log(N₁ + N₂)) 更緊');
  await beat(tok, 3000);
}]);

// ═══ a_otxyu0mSQ：Rec11 Principles of Algorithm Design ═══
const M3S = [7, 9, 12, 1, 3, 5, 6];
const m3SX = (i) => -3.9 + i * 1.3;
FRAG.push(['algmit3-shift-array', 'Shifted array：先給暴力解', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const S0 = [1, 3, 5, 6, 7, 9, 12];
  const ms = S0.map((v, i) => cube(v, M3.blue, [1.1, 0.6, 0.9], m3SX(i), 0.3, 0));
  S0.forEach((v, i) => tag(String(i), 'idx', m3SX(i), 0, 0.9));
  say('已排序陣列：binary search O(log n)', '1 3 5 6 7 9 12');
  await beat(tok, 2800);
  for (let i = 0; i < 4; i++) glow(ms[i], GOLD);
  say('把前 k = 4 個移到最右邊', '不知道 k 是多少');
  await beat(tok, 2400);
  const order = [4, 5, 6, 0, 1, 2, 3];
  order.forEach((src, pos) => move(ms[src], m3SX(pos), 0.3, 0));
  for (let i = 0; i < 4; i++) glow(ms[i], null);
  say('shifted array：7 9 12 1 3 5 6', '找某個數 e，例如 12');
  await beat(tok, 2800);
  say('先確保手上有答案：暴力解', '忘掉 shifted，直接 linear search');
  await beat(tok, 2400);
  const cur = cube('', M3.gold, [0.35, 0.35, 0.35], m3SX(0), 1.2, 0);
  for (let p = 0; p <= 2; p++) { move(cur, m3SX(p), 1.2, 0); glow(ms[order[p]], p === 2 ? GREEN : GOLD); await beat(tok, 700); }
  say('linear search：O(n)', '時間用完時，至少不是交白卷');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-shift-two-bs', '知道 k：兩段各做 binary search', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const ms = M3S.map((v, i) => cube(v, i < 3 ? M3.blue : M3.purple, [1.1, 0.6, 0.9], m3SX(i), 0.3, 0));
  M3S.forEach((v, i) => tag(String(i), 'idx', m3SX(i), 0, 0.9));
  say('如果知道 k 呢？', '7 9 12 | 1 3 5 6');
  await beat(tok, 2400);
  say('移回去再 binary search', 'O(k + log n)；Python list 甚至 O(n)');
  await beat(tok, 2800);
  say('同樣 O(n) 時：寫比較簡單的那個', '簡單 → 比較不會有 bug');
  await beat(tok, 2600);
  const g1 = ghostBox(M3.blue, 3.8, 0.9, 1.2); g1.position.set(m3SX(1), 0.4, 0);
  const g2 = ghostBox(M3.purple, 5.1, 0.9, 1.2); g2.position.set((m3SX(3) + m3SX(6)) / 2, 0.4, 0);
  say('兩段各自已排序', '兩次 binary search，各 O(log n)');
  await beat(tok, 2600);
  const cur = tag('找 6', 'ptr alt', m3SX(1), 1.6, 0);
  say('6 < 7：左段裡沒有', '');
  await beat(tok, 2000);
  let lo = 3, hi = 6;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; cur.position.x = m3SX(mid); glow(ms[mid], GOLD);
    if (M3S[mid] === 6) { glow(ms[mid], GREEN); say('右段 binary search：找到 6', 'index ' + mid); await beat(tok, 2200); break; }
    say('右段：mid = ' + M3S[mid] + ' < 6', '往右半邊');
    await beat(tok, 1500); glow(ms[mid], null); lo = mid + 1;
  }
  say('知道 k → O(log n)，兩行 pseudocode', '問題變成：怎麼找 k？');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-shift-findk', 'Binary search 找 k：跟第一個元素比', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.4, 0]);
  const bars = M3S.map((v, i) => { const b = m3Bar(M3.blue, 0.9, 0.9, m3SX(i), 0); m3Set(b, v * 0.4); tag(String(v), 'ptr', m3SX(i), v * 0.4 + 0.35, 0); tag(String(i), 'idx', m3SX(i), 0, 0.9); return b; });
  say('畫成高度：兩段各自上升', '中間有一個斷崖（discontinuity）');
  await beat(tok, 2800);
  line(-5, 7 * 0.4, 5, 7 * 0.4, 0.5, '#d64545');
  tag('A[0] = 7', 'ptr alt', 5.6, 7 * 0.4, 0.5);
  say('左段全部 ≥ 7，右段全部 < 7', '用第一個元素畫一條水平線');
  await beat(tok, 3000);
  let lo = 0, hi = 6;
  const cur = tag('', 'ptr alt', 0, 5.8, 0);
  while (lo < hi) {
    const mid = (lo + hi) >> 1; txt(cur, 'mid = ' + mid); cur.position.x = m3SX(mid);
    tint(bars[mid], M3.gold);
    if (M3S[mid] >= M3S[0]) { say(M3S[mid] + ' ≥ 7：在線上 → 猜太小', 'lo = mid + 1'); lo = mid + 1; }
    else { say(M3S[mid] + ' < 7：在線下 → 猜太大', 'hi = mid'); hi = mid; }
    await beat(tok, 2400);
    tint(bars[mid], M3.blue);
  }
  tint(bars[lo], M3.green);
  say('lo = hi = 3：k 的位置，最小值 1', 'O(log n) 找到 k');
  await beat(tok, 2800);
  say('再兩次 binary search：總共 O(log n)', '從暴力 → 部分解 → 最佳解');
  await beat(tok, 3000);
}]);

const M3H = [null, 2, 5, 7, 6, 9, 8];
const M3HP = [null, [0, 5.4], [-2.4, 3.9], [2.4, 3.9], [-3.6, 2.4], [-1.2, 2.4], [1.2, 2.4]];
function m3Heap(dx = 0) {
  const nd = [null];
  for (let i = 1; i <= 6; i++) nd.push(tnode(M3H[i], M3HP[i][0] + dx, M3HP[i][1], 0, i > 1 ? nd[i >> 1] : null, M3.sand));
  for (let i = 1; i <= 6; i++) { cube(M3H[i], M3.blue, [0.7, 0.4, 0.7], -2.9 + (i - 1) * 0.8 + dx, 0.2, 2); tag(String(i), 'idx', -2.9 + (i - 1) * 0.8 + dx, 0, 2.8); }
  return nd;
}

FRAG.push(['algmit3-heap-pop', 'Heap 第 k 小：sort 或 pop k 次', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0.4]);
  const nd = m3Heap();
  say('min-heap，找第 k 小（目標 O(k log k)）', '陣列：2 5 7 6 9 8');
  await beat(tok, 3000);
  say('暴力：整個陣列 sort 再取第 k 個', 'O(n log n)');
  await beat(tok, 2600);
  const out = [2, 5, 6], idx = [1, 2, 4];
  for (let q = 0; q < 3; q++) {
    glow(nd[idx[q]], GREEN);
    cube(out[q], M3.green, [0.6, 0.45, 0.6], 4.4 + q * 0.8, 0.23, 0, 2);
    say('extract-min 第 ' + (q + 1) + ' 次 → ' + out[q], '每次 O(log n)');
    await beat(tok, 1800);
  }
  say('k = 3：第 3 小是 6', 'pop k 次 = heap sort 中途停：O(k log n)');
  await beat(tok, 3000);
  say('不能只當陣列拿前 k 個', 'pop 後要維持 heap invariant');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-heap-bag', 'Max-heap 袋子：留住最小的 k 個', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.8, 0]);
  const A = [2, 5, 7, 6, 9, 8], X = (i) => -4.4 + i * 1.1;
  const ms = A.map((v, i) => cube(v, M3.sand, [0.9, 0.5, 0.9], X(i), 0.25, 1.5));
  const bagBox = ghostBox(M3.purple, 3.6, 1.2, 1.4); bagBox.position.set(3.6, 2.6, -1);
  tag('bag（max-heap，k = 3）', 'ptr', 3.6, 3.7, -1);
  say('k = 1：記一個 best seen，掃一遍', '7 → 6 → 9 → 8：留 6');
  await beat(tok, 3000);
  say('一般 k：記住「目前最小的 k 個」', '新來的跟袋子裡最大的比');
  await beat(tok, 2600);
  const bag = [];
  const BX = (i) => 2.4 + i * 1.2;
  const cur = cube('', M3.gold, [0.35, 0.35, 0.35], X(0), 1.2, 1.5);
  for (let i = 0; i < A.length; i++) {
    move(cur, X(i), 1.2, 1.5);
    if (bag.length < 3) { bag.push([A[i], ms[i]]); move(ms[i], BX(bag.length - 1), 2.4, -1); say('放進袋子：' + A[i], ''); await beat(tok, 900); continue; }
    let mx = 0; bag.forEach((b, q) => { if (b[0] > bag[mx][0]) mx = q; });
    glow(bag[mx][1], GOLD); glow(ms[i], GOLD);
    if (A[i] < bag[mx][0]) {
      say(A[i] + ' < 袋中最大 ' + bag[mx][0] + '：換掉', 'max-heap：O(log k)');
      await beat(tok, 2200);
      fly(bag[mx][1], V3(4, 6, -3)); bag[mx] = [A[i], ms[i]]; move(ms[i], BX(mx), 2.4, -1); glow(ms[i], null);
    } else {
      say(A[i] + ' ≥ 袋中最大 ' + bag[mx][0] + '：不要', '');
      await beat(tok, 1600); glow(ms[i], null); tint(ms[i], GRAY);
    }
    glow(bag[mx][1], null);
    await beat(tok, 600);
  }
  say('袋中最大的就是第 3 小 = 6', 'n 個元素 × O(log k) = O(n log k)');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-heap-trunc', '只留前 k 層：O(k²)', async (tok) => {
  fresh([0, 4.5, 13], [0, 3, 0]);
  const L = 7, slabs = [];
  for (let d = 0; d < L; d++) { slabs.push(cube('第 ' + (d + 1) + ' 層', d < 4 ? M3.blue : M3.sand, [0.8 + d * 1.6, 0.55, 1], 0, 6.2 - d * 0.85, 0, 1)); }
  tag('heap 高度 log n', 'ptr', 5.6, 3.6);
  say('想要第 k = 4 小，heap 卻有很多層', '');
  await beat(tok, 2600);
  const pth = [];
  for (let d = 0; d < 4; d++) pth.push(cube('', M3.gold, [0.3, 0.3, 0.3], -0.3 + d * 0.5, 6.2 - d * 0.85, 0.7));
  say('min-heap：沿任一路徑往下都遞增', '第 4 小一定在前 4 層');
  await beat(tok, 3000);
  for (let d = 4; d < L; d++) { fly(slabs[d], V3(0, -2, 6)); await beat(tok, 300); }
  pth.forEach(kill);
  say('砍掉第 k 層以下：高度變 k', '');
  await beat(tok, 2400);
  say('heap 操作 = O(高度) = O(k)', 'k 次 extract-min → O(k²)');
  await beat(tok, 3000);
  say('k 很小時有用；也給了下一步的提示', '我們不需要整個 heap');
  await beat(tok, 2800);
}]);

FRAG.push(['algmit3-heap-horizon', 'Horizon：取出一個，放進它的孩子', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0.4]);
  const nd = m3Heap(-1.2);
  const zl = tag('horizon = {2}', 'ptr alt', 4.2, 6);
  glow(nd[1], GOLD);
  say('第 1 小一定是 root', 'horizon 一開始只有 root');
  await beat(tok, 2600);
  const Z = [1], got = [];
  for (let r = 1; r <= 4; r++) {
    let b = 0; Z.forEach((j, q) => { if (M3H[j] < M3H[Z[b]]) b = q; });
    const j = Z.splice(b, 1)[0]; got.push(M3H[j]);
    glow(nd[j], GREEN); tint(nd[j], M3.green);
    [2 * j, 2 * j + 1].forEach((c) => { if (c <= 6) { Z.push(c); glow(nd[c], GOLD); } });
    txt(zl, 'horizon = {' + Z.map((q) => M3H[q]).join(', ') + '}');
    say('第 ' + r + ' 小 = ' + M3H[j] + '：取出，放進孩子', r === 2 ? '7 還在競爭；6、9 加進來' : '下一個 = horizon 裡最小的');
    await beat(tok, 2600);
  }
  say('horizon 的下一個用 min-heap 取', '刀子落在前 k 個與其餘之間');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-heap-horizon-code', 'Horizon pseudocode：O(k log k)', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const cd = code(['Z = new min-heap', 'Z.insert(H[1], 1)', 'for i = 1 to k:', '  (ith, j) = Z.extract_min()', '  Z.insert(H[2j], 2j)', '  Z.insert(H[2j+1], 2j+1)', 'return ith'], -2.6, 6.4, 0.6);
  const zT = tag('Z = {}', 'ptr alt', 3.2, 5.6), sT = tag('|Z| = 0', 'idx', 3.2, 4.9);
  say('Z 存 (值, 在 H 的 index)', 'key 是值，index 用來找孩子');
  cd.hl(0); await beat(tok, 2600);
  const Z = [1]; cd.hl(1); txt(zT, 'Z = {2@1}'); txt(sT, '|Z| = 1'); await beat(tok, 1600);
  const show = () => { txt(zT, 'Z = {' + Z.map((q) => M3H[q] + '@' + q).join(', ') + '}'); txt(sT, '|Z| = ' + Z.length); };
  const outs = [];
  for (let i = 1; i <= 3; i++) {
    cd.hl(3);
    let b = 0; Z.forEach((j, q) => { if (M3H[j] < M3H[Z[b]]) b = q; });
    const j = Z.splice(b, 1)[0]; show();
    outs.push(cube(M3H[j], M3.green, [0.6, 0.45, 0.6], -3 + i * 0.9, 0.23, 1.6, 2));
    say('i = ' + i + '：取出 ' + M3H[j] + '（j = ' + j + '）', '');
    await beat(tok, 1500);
    cd.hl(4); if (2 * j <= 6) Z.push(2 * j); show(); await beat(tok, 800);
    cd.hl(5); if (2 * j + 1 <= 6) Z.push(2 * j + 1); show();
    say(2 * j <= 6 ? '放進孩子 2j、2j+1' : '沒有孩子：要檢查邊界', '每輪 −1、最多 +2');
    await beat(tok, 1500);
  }
  cd.hl(6);
  say('return ith = 6', 'k = 3');
  await beat(tok, 2000);
  cd.hl(-1);
  say('|Z| 每輪最多 +1 → 最多約 k 個', '每個操作 O(log k) → 總共 O(k log k)');
  await beat(tok, 3200);
  say('想不到時：寫 O(k log n)', '更快也更簡單，至少拿大部分分數');
  await beat(tok, 2800);
}]);

const M3R = [6, 7, 2, 5, 3, 8, 9, 4];
const m3RX = (i) => -4.55 + i * 1.3;
FRAG.push(['algmit3-rmq-tradeoff', 'Range minimum：全部預算 vs 每次現算', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.4, 0]);
  const ms = M3R.map((v, i) => { tag(String(i + 1), 'idx', m3RX(i), 0, -1.6); return cube(v, M3.sand, [1.1, 0.55, 0.9], m3RX(i), 0.28, -2.4); });
  say('n = 2ᵏ 個數，問 min(i..j)', '先 preprocessing，之後回答很多次查詢');
  await beat(tok, 2800);
  for (let i = 1; i <= 4; i++) glow(ms[i], GOLD);
  glow(ms[2], GREEN);
  say('例：min(2..5) = min(7, 2, 5, 3) = 2', '');
  await beat(tok, 2400);
  for (let i = 1; i <= 4; i++) glow(ms[i], null);
  say('極端一：什麼都不先做', '每次查詢掃一遍：O(n)');
  await beat(tok, 2800);
  say('極端二：所有 (i, j) 的答案都存起來', 'hash 查表 O(1)，空間 O(n²)');
  const S = 0.5;
  for (let i = 0; i < 8; i++) {
    let mn = Infinity;
    for (let j = i; j < 8; j++) { mn = Math.min(mn, M3R[j]); cube(mn, j === i ? M3.blue : M3.teal, [0.45, 0.2, 0.45], -1.75 + j * S, 0.1, 0 + i * S); }
    await beat(tok, 300);
  }
  tag('min(i..j) 表', 'ptr', 2.9, 0.3, 1.6);
  say('從 [i, i] 往右長：新 min = min(舊 min, 下一個)', '建表 O(n²) 而不是 O(n³)');
  await beat(tok, 3000);
  say('兩端：O(1) 預處理/O(n) 查詢 ↔ O(n²)/O(1)', '要找中間的點');
  await beat(tok, 3000);
}]);

FRAG.push(['algmit3-rmq-split', 'Partial minima：S(n) = 2S(n/2) + n', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.2, 0.4]);
  M3R.forEach((v, i) => { tag(String(i + 1), 'idx', m3RX(i), 0, -1.6); cube(v, M3.sand, [1.1, 0.55, 0.9], m3RX(i), 0.28, -2.4); });
  line(-0.0, 0, 0, 2.6, -2.4, '#d64545');
  say('從中間切開：6 7 2 5 | 3 8 9 4', '');
  await beat(tok, 2400);
  const suf = [], pre = [];
  for (let i = 3; i >= 0; i--) { suf[i] = Math.min(M3R[i], i < 3 ? suf[i + 1] : Infinity); }
  for (let i = 4; i < 8; i++) { pre[i] = Math.min(M3R[i], i > 4 ? pre[i - 1] : Infinity); }
  const pm = [];
  for (let i = 3; i >= 0; i--) { pm[i] = cube(suf[i], M3.blue, [0.9, 0.45, 0.7], m3RX(i), 0.23, -0.6, 2); await beat(tok, 400); }
  say('左半：從中間往左的 min', 'min(4..4)、min(3..4)、…');
  await beat(tok, 2000);
  for (let i = 4; i < 8; i++) { pm[i] = cube(pre[i], M3.purple, [0.9, 0.45, 0.7], m3RX(i), 0.23, -0.6, 2); await beat(tok, 400); }
  say('右半：從中間往右的 min', '每層 n 個 partial minima');
  await beat(tok, 2200);
  glow(pm[1], GOLD); glow(pm[5], GOLD);
  say('查 min(2..6)：i、j 在中間兩側', 'min(2, 3) = 2：只看兩個值');
  await beat(tok, 3000);
  glow(pm[1], null); glow(pm[5], null);
  say('同一半：遞迴到一半大小再切', '6 7 | 2 5、3 8 | 9 4');
  const sub = [[0, 1, 'L'], [2, 3, 'R'], [4, 5, 'L'], [6, 7, 'R']];
  for (const [a, b, sd] of sub) {
    const vs = sd === 'L' ? [Math.min(M3R[a], M3R[b]), M3R[b]] : [M3R[a], Math.min(M3R[a], M3R[b])];
    cube(vs[0], M3.teal, [0.9, 0.4, 0.6], m3RX(a), 0.2, 1.0, 2); cube(vs[1], M3.teal, [0.9, 0.4, 0.6], m3RX(b), 0.2, 1.0, 2);
    await beat(tok, 500);
  }
  line(m3RX(1) + 0.65, 0, m3RX(1) + 0.65, 1.2, 1.0, '#d64545'); line(m3RX(5) + 0.65, 0, m3RX(5) + 0.65, 1.2, 1.0, '#d64545');
  await beat(tok, 1600);
  tag('S(n) = 2S(n/2) + n', 'ptr alt', 0, 3.2, -1);
  say('空間遞迴式跟 merge sort 一樣', 'S(n) = 2S(n/2) + n → O(n log n)');
  await beat(tok, 3200);
  say('每次查詢只用兩個 partial minima', '寫法要簡單：不要特例');
  await beat(tok, 2800);
}]);
  }
  // ═══ algbari3.js ═══
  {
const { V3, tag, cube, glow, tint, txt, relabel, anim, line, travel, remove, step, buddy, zone, fresh } = K;
// ─── Abdul Bari 2.1.1–2.5、T(n/2) + n、Tower of Hanoi、Master's Theorem Explained（algbari3）───
// Cued scenes: every `await step(tok)` waits for the sentence the lecturer is saying, then a short move
// (≤ ~2.5 s) and the picture holds. Recursion trees grow one level per sentence; back substitution is a
// little "T" character walking down a staircase of arguments and dropping one coin per added term.
// Lecturer's own examples only (test(3), TOH(3,1,2,3), his recurrence list); where he gives no numbers
// (2.5 root function) the stairs say 示意.
const say = (a, b = '') => ctx.say(a, b);
const A3 = { blue: '#7cb8ee', orange: '#f4a56a', green: '#8fd6a8', gold: '#e8cf8a', red: '#f08a8a', purple: '#b9a4f4', teal: '#7fd0d4', sand: '#e6d3b0', pink: '#f6a6c1', gray: '#d8cfc0' };
const A3_MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
const A3_DISK = ['#f4a56a', '#7cb8ee', '#8fd6a8', '#b9a4f4'];

function A3stage(tok) {
  const S = { tok, nodes: {}, sides: [], coins: [], hist: [] };
  S.cam = (p = [0, 6, 16], l = [0, 3.6, 0]) => fresh(p, l);
  // left-anchored label
  S.L = (t, cls, x, y, z = 0) => { const l = tag(t, cls, x, y, z); l.center.set(0, 0.5); return l; };
  // ── equation board: newest line lit, older lines plain ──
  S.board = (x = -7.2, y = 7.5, dy = 0.6, z = 0) => { S.b = { x, y, dy, z, ls: [], n: 0 }; };
  S.eq = (t, cls = 'ptr alt') => {
    const b = S.b; b.ls.forEach((l) => { if (l.userData.live) { l.element.className = 'lab-label ptr'; l.userData.live = false; } });
    const l = S.L(t, cls, b.x, b.y - b.n * b.dy, b.z); l.userData.live = cls === 'ptr alt'; b.ls.push(l); b.n++; return l;
  };
  S.gap = (k = 0.5) => { S.b.n += k; };
  // ── a friendly guide in the front-left corner who reacts to each step ──
  S.guide = (x = -6.3, z = 2.6, color = '#f4c06a') => { S.g = buddy('小助教', '', color, x, 0, z, 0.7); S.gb = tag('…', 'say', x, 1.75, z); };
  S.talk = async (t, mood = 'happy', hop = false) => { if (!S.g) return; txt(S.gb, t); S.g.mood(mood); if (hop) await S.g.hop(tok); };
  // ── a code panel with a cost column ──
  S.code = (lines, x = -7.2, y = 7.5, dy = 0.5) => {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = S.L(s.padEnd(w, ' '), '', x, y - i * dy); Object.assign(l.element.style, A3_MONO); return l; });
    S.c = { ls, x, y, dy, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
    return S.c;
  };
  S.cost = (i, t, x = -1.9, cls = 'pkt') => tag(t, cls, x, S.c.y - i * S.c.dy);
  // ── tree nodes (drop in) with an edge to the parent ──
  S.node = (key, label, x, y, pkey, color = A3.blue, w = 1.3) => {
    const m = cube(label, color, [w, 0.5, 0.6], x, y, 0, 1.0);
    const p = pkey && S.nodes[pkey];
    if (p) line(p.x, p.y - 0.27, x, y + 0.27, -0.05, '#a99470');
    S.nodes[key] = { m, x, y }; return m;
  };
  S.side = (y, t, x = 6.5) => { const l = tag(t, 'note', x, y); S.sides.push(l); return l; };
  // ── staircase of arguments: a little "T" walks down, one coin per added term ──
  S.stairs = (labels, x0 = 1.0, dx = 1.05, h = 0.5) => {
    const N = labels.length;
    S.st = labels.map((t, i) => {
      const top = (N - i) * h, x = x0 + i * dx;
      const m = lab.box(i === N - 1 ? '#bfe3c8' : A3.sand, [dx - 0.06, top, 1.4]); m.position.set(x, top / 2, 0); lab.world.add(m);
      const l = tag(t, 'idx', x, top - 0.22, 0.75);
      return { x, top, m, l };
    });
    S.w = buddy('T', '', A3.blue, S.st[0].x, S.st[0].top, 0, 0.55); S.wi = 0;
  };
  S.walk = async (i, ms = 800) => {
    const a = S.w.g.position.clone(), b = V3(S.st[i].x, S.st[i].top, 0); S.wi = i;
    await anim(tok, ms, (u) => { S.w.g.position.lerpVectors(a, b, u); S.w.g.position.y += Math.sin(u * Math.PI) * 0.6; });
  };
  S.coin = (t, color = A3.gold) => { const k = S.coins.length; const c = cube(t, color, [1.15, 0.3, 0.8], 6.7, 0.15 + k * 0.32, 2.1, 2.5); S.coins.push(c); return c; };
  // ── balance scale for the Master Theorem: left pan = log_b a (the recursion), right pan = k (f(n)) ──
  S.scale = (x = 2.6, y = 3.0) => {
    const post = lab.box('#a9865a', [0.22, y, 0.22]); post.position.set(x, y / 2, 0); lab.world.add(post);
    const g = new THREE.Group(); g.position.set(x, y, 0); lab.world.add(g);
    const beam = lab.box('#c9a46a', [5.0, 0.14, 0.3]); g.add(beam);
    const mk = (px, t) => { const p = lab.box('#e8cf8a', [1.6, 0.12, 1.0]); p.position.set(px, -0.85, 0); g.add(p); const l = lab.label(t, 'ptr'); l.position.set(px, -0.4, 0); g.add(l); return l; };
    S.sc = { g, l: mk(-2.2, '遞迴：log_b a'), r: mk(2.2, 'f(n)：k'), cs: tag(' ', 'say', x, y + 1.35), ans: tag(' ', 'good', x, y + 2.15), card: tag(' ', 'ptr alt', x, y + 3.2) };
  };
  S.pans = (l, r) => { txt(S.sc.l, l); txt(S.sc.r, r); };
  S.tilt = async (d) => { const g = S.sc.g, a = g.rotation.z, b = Math.max(-0.28, Math.min(0.28, d * 0.12)); await anim(tok, 700, (u) => { g.rotation.z = a + (b - a) * u; }); };
  S.hist0 = (x = -7.2, y = 7.5, dy = 0.56) => { S.hb = { x, y, dy }; };
  S.histAdd = (t) => { const h = S.hb; S.hist.forEach((l) => { l.element.className = 'lab-label ptr'; }); const l = S.L(t, 'ptr alt', h.x, h.y - S.hist.length * h.dy); S.hist.push(l); return l; };
  return S;
}
function sc(id, title, setup, steps) {
  FRAG.push([id, title, async (tok) => {
    const S = A3stage(tok);
    if (setup) await setup(S);
    for (const f of steps) { await step(tok); await f(S); }
  }]);
}
// a decreasing "chain" tree: node i at a diagonal
const chX = (i) => -3.2 + i * 1.25, chY = (i) => 7.2 - i * 1.05;
// binary tree positions
const btX = (L, i, cx = 0.2, W = 11) => cx - W / 2 + (i + 0.5) * W / Math.pow(2, L);
const btY = (L) => 7.2 - L * 1.4;
async function btLevel(S, L, label, color = A3.blue, w) {
  for (let i = 0; i < Math.pow(2, L); i++) S.node(L + ':' + i, label, btX(L, i), btY(L), L ? (L - 1) + ':' + (i >> 1) : null, color, w || (L >= 3 ? 1.1 : 1.3));
  await anim(S.tok, 600, () => {});
}
function btRelabel(S, L, t, color) { for (let i = 0; i < Math.pow(2, L); i++) { const n = S.nodes[L + ':' + i]; relabel(n.m, t); if (color) tint(n.m, color); } }
// MT example: card, pans, tilt, case, answer, history
async function mtShow(S, rr, lb, k, ans, opt = {}) {
  txt(S.sc.card, rr);
  S.pans('log_b a = ' + lb, 'k = ' + k);
  const d = (opt.ln ?? Number(lb)) - (opt.kn ?? Number(k));
  await S.tilt(d);
  txt(S.sc.cs, d > 0 ? 'Case 1：遞迴那邊重' : d < 0 ? 'Case 3：f(n) 那邊重' : 'Case 2：一樣重');
  txt(S.sc.ans, ans);
  S.histAdd(rr + ' → ' + ans);
  say(rr + ' → ' + ans, opt.why || '');
}
const mtStep = (rr, lb, k, ans, opt) => async (S) => { await mtShow(S, rr, lb, k, ans, opt); if (opt && opt.talk) await S.talk(opt.talk); };
const mtSetup = (cap) => async (S) => { S.cam(); S.hist0(); S.scale(); S.guide(); say(cap, ''); };

// ═══════════ 4V30R3I1vLI：2.1.1 test(n) → T(n) = T(n−1) + 1 ═══════════
const A3_CODE1 = ['void test(int n) {', '  if (n > 0) {', '    printf("%d", n);', '    test(n - 1);', '  }', '}'];
const t3x = (n) => -0.4 + (3 - n) * 1.75, t3y = (n) => 6.6 - (3 - n) * 1.45;
async function t3call(S, n) {
  S.c.hl(3);
  S.node('t' + n, 'test(' + n + ')', t3x(n), t3y(n), n < 3 ? 't' + (n + 1) : null, n === 0 ? A3.orange : A3.blue, 1.5);
  await anim(S.tok, 500, () => {});
}
async function t3print(S, n) {
  S.c.hl(2);
  const chip = cube(String(n), A3.green, [0.5, 0.42, 0.5], t3x(n) - 1.15, t3y(n) - 0.6, 0, 1.2);
  S.prints.push(chip);
  const p = tag(String(n), 'pkt', t3x(n) - 1.15, t3y(n) - 0.2);
  await travel(S.tok, p, V3(t3x(n) - 1.15, t3y(n) - 0.2, 0), V3(5.2, 7.5, 0), 700);
  remove(p); S.out += n + ' '; txt(S.outL, '輸出：' + S.out);
}
sc('algbari3-trace-test3', 'test(3) 的 tracing tree：呼叫 4 次、印 3 次', (S) => { S.cam(); S.guide(); S.prints = []; S.out = ''; say('追蹤遞迴函式', ''); }, [
  async (S) => { S.code(A3_CODE1); S.outL = tag('輸出：', 'ptr alt', 5.2, 7.5); say('test(n)：n > 0 就印 n，再呼叫 test(n − 1)', ''); await S.talk('先讀懂這個函式'); },
  async (S) => { await t3call(S, 3); say('呼叫 test(3)', ''); await S.talk('傳 3 進去看看'); },
  async (S) => { S.c.hl(1); await S.talk('3 > 0 ✓', 'happy'); await t3print(S, 3); say('3 > 0 → 印出 3', ''); },
  async (S) => { await t3call(S, 2); say('再呼叫 test(3 − 1) = test(2)', ''); },
  async (S) => { await t3print(S, 2); await t3call(S, 1); say('test(2)：印 2，呼叫 test(1)', ''); },
  async (S) => { await t3print(S, 1); await t3call(S, 0); say('test(1)：印 1，呼叫 test(0)', ''); },
  async (S) => { S.c.hl(1); tag('0 > 0 ✗ 停', 'bad', t3x(0) + 1.9, t3y(0)); say('test(0)：0 不大於 0 → 不印也不再呼叫', ''); await S.talk('到底了！', 'wow', true); },
  async (S) => { S.c.hl(-1); S.tt = tag('tracing tree（追蹤樹）', 'say', -3.6, 3.7); say('這張圖叫 tracing tree', ''); },
  async (S) => { S.prints.forEach((m) => glow(m, '#3a5a00')); S.cnt = tag('印 3 次', 'ptr alt', 5.2, 6.8); say('主要的工作是印：印了 3 次', ''); },
  async (S) => { Object.values(S.nodes).forEach((n) => glow(n.m, '#1a3a6a')); txt(S.cnt, '印 3 次・呼叫 4 次'); say('呼叫了 4 次 = 3 + 1', ''); await S.talk('呼叫比印多一次', 'wow'); },
  async (S) => { [3, 2, 1, 0].forEach((n) => tag('1', 'note', t3x(n) + 1.05, t3y(n) + 0.45)); say('printf 是簡單敘述：1 單位時間', '每次呼叫花 1'); },
  async (S) => { tag('傳 n → 呼叫 n + 1 次、印 n 次', 'ptr alt', -3.4, 3.0); say('傳入 n：呼叫 n + 1 次、印 n 次', ''); },
  async (S) => { tag('f(n) = n + 1 → O(n)', 'good', -3.4, 2.35); say('時間看呼叫次數：f(n) = n + 1', 'O(n)，也可寫 Θ(n)、Ω(n)'); await S.talk('線性時間！', 'happy', true); },
  async (S) => { txt(S.tt, 'tracing tree = recursive tree（遞迴樹）'); say('也叫 recursive tree（遞迴樹）', ''); },
]);
sc('algbari3-rr-dec1', '寫出 T(n) = T(n−1) + 1', (S) => { S.cam(); S.guide(); S.board(0.6, 7.5, 0.62); say('從程式寫出遞迴式', ''); }, [
  async (S) => { S.code(A3_CODE1); say('從程式寫出遞迴式', ''); await S.talk('一行一行看花多少時間'); },
  async (S) => { S.c.hl(0); S.cost(0, 'T(n)', -1.9, 'ptr alt'); say('整個函式的時間記作 T(n)', '遞迴式習慣用 T 而不是 f'); },
  async (S) => { S.c.hl(2); S.cost(1, '先不算', -1.9, 'note'); S.cost(2, '1'); say('先忽略 if；printf 花 1 單位', ''); },
  async (S) => { S.c.hl(3); S.cost(3, 'T(n−1)'); say('遞迴呼叫 test(n − 1)：花 T(n − 1)', '同一個函式，只是 n 小 1'); await S.talk('自己呼叫自己'); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = T(n−1) + 1'); say('加起來：T(n) = T(n − 1) + 1', ''); await S.talk('這就是遞迴式！', 'happy', true); },
  async (S) => { S.cost(1, '+1？', -1.9, 'pkt'); S.eq('算上 if：T(n−1) + 2', 'note'); say('把 if 也算進去：變成 + 2', '答案一樣'); await S.talk('多 1 也沒差', 'calm'); },
  async (S) => { S.eq('常數一律寫 1（或 c）', 'note'); say('任何常數都寫成 1（或 c）', ''); },
  async (S) => { S.gap(0.3); S.eq('T(n) = T(n−1) + 1，n > 0'); say('n > 0 時：T(n) = T(n − 1) + 1', ''); },
  async (S) => { S.eq('T(n) = 1，　　　　 n = 0'); say('n = 0 什麼都不做，但時間寫 1 不寫 0', '常數時間就記為 1'); await S.talk('不是 0 喔', 'wow', true); },
]);
const A3_ST_DEC = ['n', 'n−1', 'n−2', 'n−3', '…', '0'];
sc('algbari3-bs-dec1', 'Back substitution：T(n) = T(n−1) + 1', (S) => { S.cam(); S.board(-7.2, 7.5, 0.6); S.stairs(A3_ST_DEC); say('Back substitution（代入法）', ''); }, [
  async (S) => { S.eq('① T(n) = T(n−1) + 1'); await S.walk(1); S.coin('+1'); say('代入法：從 T(n) = T(n − 1) + 1 出發', ''); },
  async (S) => { S.qm = tag('T(n−1) = ?', 'pkt', S.st[1].x, S.st[1].top + 1.5); S.w.mood('wow'); say('知道 T(n − 1) 就能算 T(n)', 'T(n − 1) 是多少？'); },
  async (S) => { remove(S.qm); S.eq('T(n−1) = T(n−2) + 1', 'note'); say('把 n 換成 n − 1：T(n − 1) = T(n − 2) + 1', ''); S.w.mood('happy'); },
  async (S) => { S.eq('T(n) = [T(n−2) + 1] + 1'); await S.walk(2); S.coin('+1'); say('代回去', 'T(n) = [T(n − 2) + 1] + 1'); },
  async (S) => { S.eq('② T(n) = T(n−2) + 2'); say('T(n) = T(n − 2) + 2', ''); },
  async (S) => { S.eq('T(n) = [T(n−3) + 1] + 2'); await S.walk(3); S.coin('+1'); say('再代一次：T(n − 2) = T(n − 3) + 1', ''); },
  async (S) => { S.eq('③ T(n) = T(n−3) + 3'); say('T(n) = T(n − 3) + 3', ''); },
  async (S) => { S.eq('代 k 次：T(n) = T(n−k) + k'); await S.walk(4); S.coin('… 共 k 個', A3.orange); say('一直代 k 次', 'T(n) = T(n − k) + k'); },
  async (S) => { tag('T(0) = 1 已知', 'good', S.st[5].x - 0.3, S.st[5].top + 1.4); say('最小的已知值：n = 0 時答案是 1', ''); },
  async (S) => { S.eq('假設 n − k = 0 → k = n'); await S.walk(5); S.w.mood('happy'); say('假設已經減到 0：n − k = 0', '所以 k = n'); },
  async (S) => { S.eq('T(n) = T(n−n) + n'); say('把 k 換成 n', 'T(n) = T(n − n) + n'); },
  async (S) => { S.eq('T(n) = T(0) + n = 1 + n'); say('T(0) = 1 → T(n) = 1 + n', ''); },
  async (S) => { S.eq('T(n) = n + 1 → Θ(n)', 'good'); S.w.mood('happy'); say('和 tracing tree 的 n + 1 次呼叫一樣', '線性 → Θ(n)'); },
]);

// ═══════════ IawM82BQ4II：2.1.2 T(n) = T(n−1) + n ═══════════
const A3_CODE2 = ['void Test(int n) {', '  if (n > 0) {', '    for (i = 0; i < n; i++)', '      printf("%d", n);', '    Test(n - 1);', '  }', '}'];
sc('algbari3-rr-dec-n', '寫出 T(n) = T(n−1) + n', (S) => { S.cam(); S.guide(); S.board(0.6, 7.5, 0.62); say('有迴圈的遞迴函式', ''); }, [
  async (S) => { S.code(A3_CODE2); say('Test(n)：一個 for 迴圈，再呼叫 Test(n − 1)', ''); await S.talk('這次多了迴圈'); },
  async (S) => { S.c.hl(0); S.cost(0, 'T(n)', -1.6, 'ptr alt'); say('整個函式花 T(n)', ''); },
  async (S) => { S.c.hl(1); S.cost(1, '1'); say('if 判斷：1 單位', ''); },
  async (S) => { S.c.hl(2); S.cost(2, 'n + 1'); S.cost(3, 'n'); say('for 判斷 n + 1 次，裡面執行 n 次', ''); },
  async (S) => { S.c.hl(4); S.cost(4, 'T(n−1)'); say('遞迴呼叫：T(n − 1)', ''); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = T(n−1) + 2n + 2'); say('全部加起來', 'T(n) = T(n − 1) + 2n + 2'); },
  async (S) => { S.eq('2n + 2 這樣不好解', 'note'); say('這樣的式子不好解', ''); await S.talk('太囉嗦了', 'wow'); },
  async (S) => { S.eq('2n + 2 → O(n)：取 n', 'note'); say('2n + 2 取漸近 → n（線性）', ''); await S.talk('只留最高次'); },
  async (S) => { S.eq('T(n) = T(n−1) + n'); say('簡化成 T(n) = T(n − 1) + n', ''); await S.talk('清爽多了', 'happy', true); },
  async (S) => { S.gap(0.3); S.eq('T(n) = T(n−1) + n，n > 0'); say('n > 0 時成立', ''); },
  async (S) => { S.eq('T(n) = 1，　　　　 n = 0'); say('n = 0 不做事 → 常數 1', ''); },
]);
async function chainNode(S, i, label, cost, color) {
  S.node('c' + i, label, chX(i), chY(i), i ? 'c' + (i - 1) : null, color || A3.blue, 1.35);
  if (cost != null) S.nodes['c' + i].cost = tag(cost, 'pkt', chX(i) - 1.35, chY(i) - 0.05);
  await anim(S.tok, 500, () => {});
}
function chainCost(S, i, cost) { S.nodes['c' + i].cost = tag(cost, 'pkt', chX(i) - 1.35, chY(i) - 0.05); }
sc('algbari3-tree-dec-n', '遞迴樹：n + (n−1) + … + 1', (S) => { S.cam(); S.guide(); say('用遞迴樹（recursion tree）解', ''); }, [
  async (S) => { await chainNode(S, 0, 'T(n)'); say('遞迴樹：從 T(n) 開始', ''); await S.talk('一層一層長出來'); },
  async (S) => { chainCost(S, 0, 'n'); say('這一層：迴圈花 n', '只寫時間，不追蹤印了什麼'); },
  async (S) => { await chainNode(S, 1, 'T(n−1)'); say('再呼叫 T(n − 1)', ''); },
  async (S) => { chainCost(S, 1, 'n−1'); await chainNode(S, 2, 'T(n−2)'); say('T(n − 1)：迴圈 n − 1 次，再呼叫 T(n − 2)', ''); },
  async (S) => { chainCost(S, 2, 'n−2'); await chainNode(S, 3, 'T(n−3)'); say('T(n − 2)：花 n − 2，再呼叫 T(n − 3)', ''); },
  async (S) => { tag('⋮', 'ptr', chX(3.6), chY(3.6)); tag('每次少 1，到 0 才停', 'say', 2.6, 6.5); say('n 每次少 1，一直到 0', 'T(0) = 1 是已知的最小值'); },
  async (S) => { await chainNode(S, 4, 'T(2)'); chainCost(S, 4, '2'); await chainNode(S, 5, 'T(1)'); chainCost(S, 5, '1'); await chainNode(S, 6, 'T(0)', null, A3.orange); say('…T(2) 花 2、T(1) 花 1、T(0) 停', ''); },
  async (S) => { ['n', 'n−1', 'n−2', 'n−3', '2', '1', '0'].forEach((t, i) => S.side(chY(i), t, 5.6)); say('把每一層的時間列出來', 'n、n − 1、n − 2、…、2、1、0'); },
  async (S) => { S.sum = S.L('0 + 1 + 2 + … + (n−1) + n', 'ptr alt', -5.0, 0.9, 1.2); say('全部加起來', '0 + 1 + 2 + … + n'); },
  async (S) => { txt(S.sum, '0 + 1 + … + n = n(n + 1)/2'); say('= n(n + 1)/2', '前 n 個自然數的和'); await S.talk('等差級數！'); },
  async (S) => { tag('T(n) = n(n + 1)/2 → Θ(n²)', 'good', 2.6, 7.3); say('T(n) = n(n + 1)/2 → n²', 'Θ(n²)'); await S.talk('平方時間', 'happy', true); },
  async (S) => { await S.talk('練熟了直接看出答案！', 'happy', true); say('多練幾題就能直接寫答案', '申論題才要寫完整步驟'); },
]);
sc('algbari3-bs-dec-n', 'Back substitution：T(n) = T(n−1) + n', (S) => { S.cam(); S.board(-7.3, 7.6, 0.55); S.stairs(A3_ST_DEC); say('Back substitution（代入法）', ''); }, [
  async (S) => { S.eq('① T(n) = T(n−1) + n'); await S.walk(1); S.coin('n'); say('代入法：T(n) = T(n − 1) + n', ''); },
  async (S) => { S.eq('T(n−1) = T(n−2) + (n−1)', 'note'); say('把 n 換成 n − 1', 'T(n − 1) = T(n − 2) + (n − 1)'); },
  async (S) => { S.eq('T(n) = [T(n−2) + (n−1)] + n'); await S.walk(2); S.coin('n−1'); say('代回去', ''); },
  async (S) => { S.eq('② T(n) = T(n−2) + (n−1) + n'); say('打開括號', 'T(n) = T(n − 2) + (n − 1) + n'); },
  async (S) => { S.warn = tag('別合併成 2n − 1！', 'bad', -1.6, 4.5); say('不要把 (n − 1) + n 加成 2n − 1', '留著才看得出規律'); S.w.mood('wow'); },
  async (S) => { remove(S.warn); S.w.mood('happy'); S.eq('T(n−2) = T(n−3) + (n−2)', 'note'); say('再把 n 換成 n − 2', ''); },
  async (S) => { S.eq('T(n) = [T(n−3) + (n−2)] + (n−1) + n'); await S.walk(3); S.coin('n−2'); say('代回去', ''); },
  async (S) => { S.eq('③ T(n) = T(n−3) + (n−2) + (n−1) + n'); say('第三式', ''); },
  async (S) => { S.eq('k：T(n−k) + (n−k+1) + … + (n−1) + n'); await S.walk(4); S.coin('…', A3.orange); say('代 k 次', 'T(n − k) + (n − k + 1) + … + n'); },
  async (S) => { S.eq('n − k = 0 → k = n'); await S.walk(5); say('假設減到 0：n − k = 0 → k = n', ''); },
  async (S) => { S.eq('T(n) = T(n−n) + (n−n+1) + (n−n+2) + … + n'); say('把 k 換成 n', ''); },
  async (S) => { S.eq('T(n) = T(0) + 1 + 2 + 3 + … + n'); say('n − n 消掉：1 + 2 + 3 + … + n', ''); },
  async (S) => { S.eq('T(n) = 1 + n(n + 1)/2'); say('前 n 個自然數的和', 'T(n) = 1 + n(n + 1)/2'); },
  async (S) => { S.eq('→ Θ(n²)', 'good'); S.w.mood('happy'); say('Θ(n²)：和遞迴樹一樣', '多的 1 是 T(0) 那次呼叫'); },
]);

// ═══════════ MhT7XmxhaCE：2.1.3 T(n) = T(n−1) + log n ═══════════
const A3_CODE3 = ['void Test(int n) {', '  if (n > 0) {', '    for (i = 1; i < n; i = i * 2)', '      printf("%d", i);', '    Test(n - 1);', '  }', '}'];
sc('algbari3-rr-dec-log', '寫出 T(n) = T(n−1) + log n', (S) => { S.cam(); S.guide(); S.board(0.9, 4.0, 0.62); say('i 每次乘 2 的迴圈', ''); }, [
  async (S) => { S.code(A3_CODE3); say('Test(n)：迴圈 i 每次乘 2，再呼叫 Test(n − 1)', ''); },
  async (S) => { S.c.hl(0); S.cost(0, 'T(n)', -0.9, 'ptr alt'); say('整個函式花 T(n)', ''); },
  async (S) => { S.c.hl(2); const xs = [1, 2, 4, 8]; for (let k = 0; k < 4; k++) { const p = tag('i = ' + xs[k], 'pkt', 1.6 + k * 1.3, 6.6); await travel(S.tok, p, V3(1.6, 7.2, 0), V3(1.6 + k * 1.3, 6.6, 0), 350); } say('i = 1、2、4、8…每次乘 2', ''); await S.talk('翻倍跳！'); },
  async (S) => { S.c.hl(3); S.cost(3, 'log n', -0.9); say('跳到 n 只要 log n 次 → printf 執行 log n 次', ''); },
  async (S) => { S.cost(1, '1', -0.9, 'note'); S.cost(2, 'log n + 1', -0.9, 'note'); say('其他行加上去：2 log n + 2', '取最高階 → 還是 log n'); },
  async (S) => { S.c.hl(4); S.cost(4, 'T(n−1)', -0.9); say('遞迴呼叫：T(n − 1)', ''); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = T(n−1) + log n'); say('T(n) = T(n − 1) + log n', ''); await S.talk('成形了', 'happy', true); },
  async (S) => { S.eq('T(n) = 1，　　　　　 n = 0'); say('n = 0 → 1（前面看過）', ''); },
  async (S) => { S.eq('T(n) = T(n−1) + log n，n > 0'); say('n > 0 → T(n − 1) + log n', ''); },
]);
sc('algbari3-tree-dec-log', '遞迴樹：log n + … + log 1 = log n!', (S) => { S.cam(); S.guide(); say('用遞迴樹解', ''); }, [
  async (S) => { await chainNode(S, 0, 'T(n)', 'log n'); await chainNode(S, 1, 'T(n−1)'); say('T(n)：花 log n，再呼叫 T(n − 1)', ''); },
  async (S) => { chainCost(S, 1, 'log(n−1)'); await chainNode(S, 2, 'T(n−2)'); say('下一層花 log(n − 1)，再呼叫 T(n − 2)', ''); },
  async (S) => { chainCost(S, 2, 'log(n−2)'); await chainNode(S, 3, 'T(n−3)'); say('再下一層 log(n − 2)', ''); },
  async (S) => { tag('⋮', 'ptr', chX(3.6), chY(3.6)); await chainNode(S, 4, 'T(2)', 'log 2'); await chainNode(S, 5, 'T(1)', 'log 1'); await chainNode(S, 6, 'T(0)', null, A3.orange); say('…T(2) 花 log 2、T(1) 花 log 1、T(0) 停', ''); },
  async (S) => { ['log n', 'log(n−1)', 'log(n−2)', '…', 'log 2', 'log 1'].forEach((t, i) => S.side(chY(i < 3 ? i : i + 1), t, 5.6)); say('每一層的時間', ''); },
  async (S) => { S.sum = S.L('log n + log(n−1) + … + log 2 + log 1', 'ptr alt', -5.0, 0.9, 1.2); say('全部加起來', ''); },
  async (S) => { txt(S.sum, '= log[n·(n−1)·…·2·1]'); say('log 相加 = 乘起來再取 log', 'log a + log b = log(ab)'); await S.talk('log 的乘法規則'); },
  async (S) => { txt(S.sum, '= log n!'); say('n·(n − 1)·…·1 = n!', '所以總和 = log n!'); },
  async (S) => { tag('n! ≤ nⁿ → log n! ≤ n log n', 'ptr alt', 2.6, 6.6); say('n! 的上界是 nⁿ', 'log nⁿ = n log n'); },
  async (S) => { tag('T(n) = O(n log n)', 'good', 2.6, 7.3); say('T(n) = O(n log n)', '其實 log n! = Θ(n log n)'); await S.talk('n log n！', 'happy', true); },
]);
const A3_ST_LOG = ['n', 'n−1', 'n−2', 'n−3', '…', '0'];
sc('algbari3-bs-dec-log', 'Back substitution：T(n) = T(n−1) + log n', (S) => { S.cam(); S.board(-7.3, 7.6, 0.6); S.stairs(A3_ST_LOG); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = T(n−1) + log n'); await S.walk(1); S.coin('log n'); say('代入法：T(n) = T(n − 1) + log n', ''); },
  async (S) => { S.eq('T(n) = [T(n−2) + log(n−1)] + log n'); await S.walk(2); S.coin('log(n−1)'); say('直接代入 T(n − 1)', ''); },
  async (S) => { S.eq('② T(n) = T(n−2) + log(n−1) + log n'); say('打開括號：第二式', ''); },
  async (S) => { S.eq('T(n) = [T(n−3) + log(n−2)] + log(n−1) + log n'); await S.walk(3); S.coin('log(n−2)'); say('再代一次', ''); },
  async (S) => { S.eq('③ T(n) = T(n−3) + log(n−2) + log(n−1) + log n'); say('第三式', ''); },
  async (S) => { S.eq('k：T(n−k) + log 1 + log 2 + … + log n'); await S.walk(4); S.coin('…', A3.orange); say('代 k 次：一路減到 log 1', ''); },
  async (S) => { S.eq('n − k = 0 → k = n'); await S.walk(5); say('n − k = 0 → k = n', ''); },
  async (S) => { S.eq('T(n) = T(0) + log n!'); say('log 1 + … + log n = log n!', ''); },
  async (S) => { S.eq('T(n) = 1 + log n!'); say('T(0) = 1', ''); },
  async (S) => { S.eq('→ O(n log n)', 'good'); S.w.mood('happy'); say('O(n log n)：和遞迴樹一樣', ''); },
]);
// the "× n" shortcut machine
async function a3Machine(S, rr, f, out, row, cls = 'good') {
  const card = tag(rr, 'pkt', -6.0, 3.0);
  await travel(S.tok, card, V3(-6.0, 3.0, 0), V3(-0.2, 3.0, 0), 700);
  remove(card);
  S.mach.glow('#3a2a00');
  const o = tag(out, cls, 2.4, 3.0);
  await travel(S.tok, o, V3(0.8, 3.0, 0), V3(3.2, 3.0, 0), 600);
  remove(o); S.mach.glow(null);
  S.L(rr + '　→　' + out, row === 'bad' ? 'bad' : 'ptr', 1.2, 7.5 - S.rows * 0.6); S.rows++;
}
sc('algbari3-dec-times-n', '遞減型直接寫答案：f(n) × n', (S) => { S.cam(); S.guide(); S.rows = 0; say('直接寫出答案', ''); }, [
  async (S) => { S.mach = buddy('× n 機', '', A3.purple, 0.2, 2.2, 0, 1.1); tag('T(n−1) + f(n)', 'say', 0.2, 1.6, 0.8); say('看前面解過的例子', ''); await S.talk('找規律'); },
  async (S) => { await a3Machine(S, 'T(n−1) + 1', '1', 'n'); say('T(n − 1) + 1 → n', ''); },
  async (S) => { await a3Machine(S, 'T(n−1) + n', 'n', 'n²'); say('T(n − 1) + n → n²', ''); },
  async (S) => { await a3Machine(S, 'T(n−1) + log n', 'log n', 'n log n'); say('T(n − 1) + log n → n log n', ''); },
  async (S) => { tag('n 每次減 1 → f(n) 做 n 次', 'say', -3.8, 5.2); S.mach.mood('wow'); say('n 每次減 1：1 × n、n × n、log n × n', ''); },
  async (S) => { S.mach.mood('happy'); await a3Machine(S, 'T(n−1) + n²', 'n²', 'n³'); say('所以 T(n − 1) + n² → n³', ''); },
  async (S) => { await S.talk('後面那項 × n 就對了', 'happy', true); say('不管 f(n) 是什麼，乘上 n', '因為它重複 n 次'); },
  async (S) => { await a3Machine(S, 'T(n−2) + 1', '1', 'n/2 → O(n)'); say('T(n − 2) + 1：每次減 2 → n/2 次', '還是 O(n)'); },
  async (S) => { await a3Machine(S, 'T(n−100) + n', 'n', 'O(n²)'); say('T(n − 100) + n → 一樣 O(n²)', 'n 很大時減多少都一樣'); },
  async (S) => { S.L('2T(n−1) + 1　→　？有係數，不是 × n', 'bad', 1.2, 7.5 - S.rows * 0.6); S.rows++; S.mach.mood('wow'); say('前面有係數 2：不能直接乘 n', '下一部說明'); await S.talk('下集揭曉', 'wow'); },
]);

// ═══════════ JvcqtZk2mng：2.1.4 T(n) = 2T(n−1) + 1 ═══════════
const A3_CODE4 = ['void Test(int n) {', '  if (n > 0) {', '    printf("%d", n);', '    Test(n - 1);', '    Test(n - 1);', '  }', '}'];
sc('algbari3-rr-2t', '寫出 T(n) = 2T(n−1) + 1', (S) => { S.cam(); S.guide(); S.board(0.6, 7.5, 0.62); say('呼叫自己兩次', ''); }, [
  async (S) => { S.code(A3_CODE4); S.c.hl(0); S.cost(0, 'T(n)', -1.9, 'ptr alt'); say('Test(n) 花 T(n)', ''); await S.talk('注意：呼叫兩次'); },
  async (S) => { S.c.hl(2); S.cost(2, '1'); say('printf：1 單位', ''); },
  async (S) => { S.c.hl(3); S.cost(3, 'T(n−1)'); S.cost(4, 'T(n−1)'); say('兩次 Test(n − 1)：各花 T(n − 1)', ''); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = 2T(n−1) + 1'); say('T(n) = 2T(n − 1) + 1', ''); await S.talk('係數 2！', 'wow', true); },
  async (S) => { S.eq('T(n) = 2T(n−1) + 1，n > 0'); say('n > 0 時成立', ''); },
  async (S) => { S.eq('T(n) = 1，　　　　　n = 0'); say('n = 0 → 常數 1', ''); },
]);
sc('algbari3-tree-2t', '遞迴樹：1、2、4、8…', (S) => { S.cam(); S.guide(); say('遞迴樹：一個變兩個', ''); }, [
  async (S) => { await btLevel(S, 0, 'T(n)'); say('T(n)：印一次，再呼叫自己兩次', ''); },
  async (S) => { await btLevel(S, 1, 'T(n−1)'); say('印 1 次，呼叫兩個 T(n − 1)', ''); await S.talk('一分為二'); },
  async (S) => { await btLevel(S, 2, 'T(n−2)'); say('每個 T(n − 1) 又各呼叫兩個 T(n − 2)', ''); },
  async (S) => { await btLevel(S, 3, 'T(n−3)', A3.blue, 1.15); say('下一層：8 個 T(n − 3)', ''); },
  async (S) => { tag('⋮　　　⋮　　　⋮', 'ptr', 0.2, 2.2); tag('T(0)　T(0)　…　T(0)', 'ptr', 0.2, 1.4); say('一直到 T(0) 才停', ''); },
  async (S) => { btRelabel(S, 0, '1', A3.gold); S.side(btY(0), '1'); say('這一層只花 1', ''); },
  async (S) => { btRelabel(S, 1, '1', A3.gold); S.side(btY(1), '2'); say('下一層：1 + 1 = 2', ''); },
  async (S) => { btRelabel(S, 2, '1', A3.gold); S.side(btY(2), '4'); say('再下一層：4 個 1 = 4', ''); },
  async (S) => { btRelabel(S, 3, '1', A3.gold); S.side(btY(3), '8'); say('再下一層：8', ''); await S.talk('每層翻倍！', 'wow', true); },
  async (S) => { ['2⁰', '2¹', '2²', '2³'].forEach((t, i) => txt(S.sides[i], t)); say('1、2¹、2²、2³', ''); },
  async (S) => { S.side(1.4, '2ᵏ'); say('做 k 次到 T(0)：最後一層 2ᵏ', ''); },
  async (S) => { S.L('總和 = 1 + 2 + 2² + 2³ + … + 2ᵏ', 'ptr alt', -2.2, 0.5, 1.4); say('總時間 = 1 + 2 + 2² + … + 2ᵏ', ''); },
]);
sc('algbari3-gp-sum', '等比級數 1 + 2 + … + 2ᵏ = 2ᵏ⁺¹ − 1', (S) => { S.cam(); S.guide(); S.board(-7.2, 7.5, 0.62); say('等比級數求和', ''); }, [
  async (S) => { S.eq('1 + 2 + 2² + … + 2ᵏ'); S.tw = [1, 2, 4, 8].map((h, i) => cube(String(h), [A3.gold, A3.orange, A3.pink, A3.purple][i], [0.9, h * 0.32, 0.9], 1.4 + i * 1.2, h * 0.16, 0, 2)); say('把每層加起來', ''); },
  async (S) => { S.eq('= 2ᵏ⁺¹ − 1'); const g = lab.box('#bfe3c8', [0.9, 16 * 0.32, 0.9]); g.position.set(6.3, 8 * 0.32, -0.6); lab.world.add(g); tag('16 − 1 = 15', 'good', 6.3, 5.6); tag('1+2+4+8', 'note', 3.2, 3.4); say('答案：2ᵏ⁺¹ − 1', '例：1 + 2 + 4 + 8 = 15 = 16 − 1'); await S.talk('剛好差 1！', 'wow', true); },
  async (S) => { S.gap(0.3); S.eq('a + ar + ar² + … + arᵏ'); say('一般的等比級數（GP series）', ''); },
  async (S) => { S.eq('a：首項　r：公比', 'note'); say('a 是第一項，r 是公比（每次乘的數）', ''); },
  async (S) => { S.eq('和 = a(rᵏ⁺¹ − 1)/(r − 1)'); say('公式：a(rᵏ⁺¹ − 1)/(r − 1)', ''); },
  async (S) => { S.eq('這裡 a = 1，r = 2', 'note'); say('這裡 a = 1、r = 2', '每次乘 2'); },
  async (S) => { S.eq('1·(2ᵏ⁺¹ − 1)/(2 − 1) = 2ᵏ⁺¹ − 1'); say('分母 2 − 1 = 1', '= 2ᵏ⁺¹ − 1'); },
  async (S) => { S.eq('n − k = 0 → k = n'); say('一樣假設 n − k = 0 → k = n', ''); },
  async (S) => { S.eq('T(n) = 2ⁿ⁺¹ − 1 → O(2ⁿ)', 'good'); say('T(n) = 2ⁿ⁺¹ − 1 → O(2ⁿ)', '指數時間'); await S.talk('指數級，很慢', 'wow', true); },
]);
sc('algbari3-bs-2t', 'Back substitution：T(n) = 2T(n−1) + 1', (S) => { S.cam(); S.board(-7.3, 7.6, 0.58); S.stairs(A3_ST_DEC); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = 2T(n−1) + 1'); await S.walk(1); S.coin('1'); say('代入法：T(n) = 2T(n − 1) + 1', ''); },
  async (S) => { S.eq('T(n) = 2[2T(n−2) + 1] + 1'); say('代入 T(n − 1) = 2T(n − 2) + 1', ''); },
  async (S) => { S.eq('② T(n) = 2²T(n−2) + 2 + 1'); await S.walk(2); S.coin('2'); say('打開：2²T(n − 2) + 2 + 1', ''); },
  async (S) => { S.eq('T(n) = 2²[2T(n−3) + 1] + 2 + 1'); say('再代 T(n − 2)', ''); },
  async (S) => { S.eq('③ T(n) = 2³T(n−3) + 2² + 2 + 1'); await S.walk(3); S.coin('2²'); say('2³T(n − 3) + 2² + 2 + 1', ''); },
  async (S) => { S.eq('k：2ᵏT(n−k) + 2ᵏ⁻¹ + … + 2 + 1'); await S.walk(4); S.coin('…', A3.orange); say('代 k 次', '2ᵏT(n − k) + 2ᵏ⁻¹ + … + 2 + 1'); },
  async (S) => { S.eq('n − k = 0 → k = n'); await S.walk(5); say('遞減型：假設 n − k = 0', ''); },
  async (S) => { S.eq('T(n) = 2ⁿT(0) + 1 + 2 + … + 2ⁿ⁻¹'); say('k 換成 n', ''); },
  async (S) => { S.eq('= 2ⁿ·1 + (2ⁿ − 1)'); say('T(0) = 1；1 + … + 2ᵏ⁻¹ = 2ᵏ − 1', ''); },
  async (S) => { S.eq('= 2ⁿ⁺¹ − 1'); say('2ⁿ + 2ⁿ − 1 = 2ⁿ⁺¹ − 1', ''); },
  async (S) => { S.eq('→ Θ(2ⁿ)', 'good'); S.w.mood('happy'); say('Θ(2ⁿ)：和遞迴樹一樣', ''); },
]);

// ═══════════ 8gt0D0IqU5w：2.3.1 T(n) = T(n/2) + 1 ═══════════
const A3_CODE5 = ['void Test(int n) {', '  if (n > 1) {', '    printf("%d", n);', '    Test(n / 2);', '  }', '}'];
sc('algbari3-rr-half', 'Dividing function：T(n) = T(n/2) + 1', (S) => { S.cam(); S.guide(); S.board(0.9, 3.6, 0.62); say('Dividing function', ''); }, [
  async (S) => { S.code(A3_CODE5); S.c.hl(3); say('Test 呼叫自己時傳 n/2：dividing function', ''); await S.talk('這次是「除」'); },
  async (S) => { const cs = [['n − 1　減', A3.sand], ['n / 2　除', A3.gold], ['√n　開根號', A3.teal]]; for (let i = 0; i < 3; i++) { const l = tag(cs[i][0], 'pkt', 1.6 + i * 2.0, 6.6); await travel(S.tok, l, V3(1.6 + i * 2.0, 8.0, 0), V3(1.6 + i * 2.0, 6.6, 0), 400); } say('n 可以用減、除、開根號縮小', ''); },
  async (S) => { S.c.hl(0); S.cost(0, 'T(n)', -1.9, 'ptr alt'); say('設這個函式花 T(n)', ''); },
  async (S) => { S.c.hl(2); S.cost(2, '1'); say('printf：1 單位', ''); },
  async (S) => { S.c.hl(3); S.cost(3, 'T(n/2)'); say('Test(n/2)：T(n/2)', ''); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = T(n/2) + 1'); say('T(n) = T(n/2) + 1', ''); await S.talk('除法型遞迴式', 'happy', true); },
  async (S) => { S.c.hl(1); S.eq('T(n) = T(n/2) + 1，n > 1'); say('程式寫 n > 1：除到 1 就停', ''); },
  async (S) => { S.eq('T(n) = 1，　　　　 n = 1'); say('n = 1 → 常數 1', ''); },
]);
// vertical chain for dividing trees
const dvX = -2.6, dvY = (i) => 7.2 - i * 1.3;
async function dvNode(S, i, label, cost, color) {
  S.node('d' + i, label, dvX, dvY(i), i ? 'd' + (i - 1) : null, color || A3.blue, 1.45);
  if (cost) tag(cost, 'pkt', dvX - 1.45, dvY(i));
  await anim(S.tok, 500, () => {});
}
sc('algbari3-tree-half', '遞迴樹：k = log n 層', (S) => { S.cam(); S.guide(); S.board(0.9, 7.5, 0.62); say('遞迴樹', ''); }, [
  async (S) => { await dvNode(S, 0, 'T(n)', '1'); say('T(n)：做 1，再呼叫 T(n/2)', ''); },
  async (S) => { await dvNode(S, 1, 'T(n/2)', '1'); say('T(n/2)：1 + T(n/2²)', ''); },
  async (S) => { await dvNode(S, 2, 'T(n/2²)', '1'); await dvNode(S, 3, 'T(n/2³)', '1'); say('一直除下去：T(n/2²)、T(n/2³)…', ''); },
  async (S) => { tag('⋮', 'ptr', dvX, dvY(3.6)); await dvNode(S, 4.2, 'T(n/2ᵏ)', null, A3.orange); say('做 k 次：T(n/2ᵏ)', ''); },
  async (S) => { tag('= T(1) = 1', 'good', dvX + 2.1, dvY(4.2)); say('除到 1 就停：T(1) = 1 已知', '除法的最小單位是 1'); },
  async (S) => { S.eq('假設 n/2ᵏ = 1'); say('假設已經除到 1：n/2ᵏ = 1', ''); },
  async (S) => { [0, 1, 2, 3].forEach((i) => tag('1 步', 'note', dvX + 1.5, dvY(i))); tag('共 k 層 → 時間 k', 'say', 2.6, 2.6); say('每層 1 步，共 k 層 → 時間 = k', ''); await S.talk('看有幾層就好'); },
  async (S) => { S.eq('n/2ᵏ = 1 → n = 2ᵏ'); say('n/2ᵏ = 1 → n = 2ᵏ', ''); },
  async (S) => { S.eq('k = log₂ n'); say('k = log₂ n', '把指數搬過來就變 log'); },
  async (S) => { S.eq('例：2⁵ = 32 ⇔ 5 = log₂ 32', 'note'); say('例：2⁵ = 32 → 5 = log₂ 32', ''); },
  async (S) => { S.eq('aᵇ = c ⇔ b = log_a c', 'note'); say('一般：aᵇ = c ⇔ b = log_a c', ''); },
  async (S) => { S.eq('T(n) = O(log n)', 'good'); say('k = log n → T(n) = O(log n)', ''); await S.talk('對數時間！', 'happy', true); },
]);
const A3_ST_HALF = ['n', 'n/2', 'n/2²', 'n/2³', '…', '1'];
sc('algbari3-bs-half', 'Back substitution：T(n) = T(n/2) + 1', (S) => { S.cam(); S.board(-7.3, 7.6, 0.62); S.stairs(A3_ST_HALF); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = T(n/2) + 1'); await S.walk(1); S.coin('+1'); say('代入法：T(n) = T(n/2) + 1', ''); },
  async (S) => { S.eq('T(n/2) = T(n/2²) + 1', 'note'); say('n 換成 n/2：T(n/2) = T(n/2²) + 1', ''); },
  async (S) => { S.eq('T(n) = [T(n/2²) + 1] + 1'); await S.walk(2); S.coin('+1'); say('代回去', ''); },
  async (S) => { S.eq('② T(n) = T(n/2²) + 2'); say('常數可以直接加：+ 2', ''); },
  async (S) => { S.eq('③ T(n) = T(n/2³) + 3'); await S.walk(3); S.coin('+1'); say('再代：T(n/2³) + 3', ''); },
  async (S) => { S.eq('k：T(n) = T(n/2ᵏ) + k'); await S.walk(4); S.coin('… k 個', A3.orange); say('代 k 次：T(n/2ᵏ) + k', ''); },
  async (S) => { S.eq('n/2ᵏ = 1 → n = 2ᵏ → k = log n'); await S.walk(5); say('假設 n/2ᵏ = 1', 'n = 2ᵏ，k = log n'); },
  async (S) => { S.eq('T(n) = T(1) + log n'); say('代回：T(1) + log n', ''); },
  async (S) => { S.eq('= 1 + log n → Θ(log n)', 'good'); S.w.mood('happy'); say('1 + log n → Θ(log n)', '和遞迴樹一樣'); },
]);

// ═══════════ 1K9ebQJosvo：2.3.3 T(n) = 2T(n/2) + n ═══════════
const A3_CODE6 = ['void Test(int n) {', '  if (n > 1) {', '    for (i = 0; i < n; i++)', '      stmt;', '    Test(n / 2);', '    Test(n / 2);', '  }', '}'];
sc('algbari3-rr-2half', '寫出 T(n) = 2T(n/2) + n', (S) => { S.cam(); S.guide(); S.board(0.8, 7.5, 0.62); say('迴圈 + 兩次對半呼叫', ''); }, [
  async (S) => { S.code(A3_CODE6); S.c.hl(0); S.cost(0, 'T(n)', -1.5, 'ptr alt'); say('Test(n) 花 T(n)', ''); },
  async (S) => { S.c.hl(3); S.cost(3, 'n', -1.5); say('迴圈裡的敘述執行 n 次', ''); },
  async (S) => { S.c.hl(4); S.cost(4, 'T(n/2)', -1.5); S.cost(5, 'T(n/2)', -1.5); say('兩次 Test(n/2)：各 T(n/2)', ''); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = 2T(n/2) + n'); say('T(n) = 2T(n/2) + n', '呼叫自己兩次'); await S.talk('經典款！', 'happy', true); },
  async (S) => { S.eq('T(n) = 2T(n/2) + n，n > 1'); say('n > 1 時成立', ''); },
  async (S) => { S.eq('T(n) = 1，　　　　　n = 1'); say('n = 1 → 常數 1', ''); },
  async (S) => { S.eq('除法型：最小值取 1', 'note'); say('除法型除到 1；遞減型減到 0', ''); },
  async (S) => { S.eq('取 0 → 每項都變 0，不好解', 'note'); say('除到 0 會讓所有項都變 0', '所以停在 1'); await S.talk('停在 1 比較好算', 'calm'); },
  async (S) => { S.eq('★ 很多演算法都是這個式子', 'good'); say('非常重要的遞迴式', '很多演算法的時間都是它'); await S.talk('一定要記住', 'wow', true); },
]);
sc('algbari3-tree-2half', '遞迴樹：每層都是 n', (S) => { S.cam(); S.guide(); say('遞迴樹', ''); }, [
  async (S) => { await btLevel(S, 0, 'n', A3.gold); say('根：迴圈花 n', ''); },
  async (S) => { await btLevel(S, 1, 'T(n/2)'); say('呼叫兩次 T(n/2)', ''); },
  async (S) => { btRelabel(S, 1, 'n/2', A3.gold); say('只寫時間：兩個 n/2', '不寫整個 T(n)'); await S.talk('只寫每格的工作量'); },
  async (S) => { await btLevel(S, 2, 'n/2²', A3.gold); say('每個再呼叫兩次：4 個 n/2²', ''); },
  async (S) => { await btLevel(S, 3, 'n/2³', A3.gold, 1.15); say('再下一層：8 個 n/2³', ''); },
  async (S) => { tag('⋮　　　⋮　　　⋮', 'ptr', 0.2, 2.2); S.bot = tag('1　1　1　…　1　1　1', 'ptr', 0.2, 1.4); say('一直分到變成 1', ''); },
  async (S) => { txt(S.bot, 'n/2ᵏ = 1　…　n/2ᵏ = 1'); say('做 k 次：n/2ᵏ', ''); },
  async (S) => { tag('k 層', 'say', -6.3, 4.4); line(-5.7, 7.2, -5.7, 1.4, 0, '#c08a1f'); say('總共 k 層', ''); },
  async (S) => { S.side(btY(0), 'n'); say('這一層：n', ''); },
  async (S) => { S.side(btY(1), 'n/2 + n/2 = n'); S.side(btY(2), '4 × n/4 = n'); say('n/2 + n/2 = n；4 × n/4 = n', ''); await S.talk('每層都是 n！', 'wow', true); },
  async (S) => { S.side(btY(3), '8 × n/8 = n'); say('8 × n/8 = n', ''); },
  async (S) => { S.sum = S.L('每層 n × k 層 = n·k', 'ptr alt', -2.5, 0.5, 1.4); say('每層 n，共 k 層 → n·k', ''); },
  async (S) => { txt(S.sum, 'n/2ᵏ = 1 → k = log n'); say('n/2ᵏ = 1 → n = 2ᵏ → k = log n', ''); },
  async (S) => { txt(S.sum, 'T(n) = n·log n → Θ(n log n)'); S.sum.element.className = 'lab-label good'; say('T(n) = Θ(n log n)', ''); await S.talk('n log n！', 'happy', true); },
]);
sc('algbari3-bs-2half', 'Back substitution：2ᵏT(n/2ᵏ) + kn', (S) => { S.cam(); S.board(-7.3, 7.6, 0.58); S.stairs(A3_ST_HALF); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = 2T(n/2) + n'); await S.walk(1); S.coin('n'); say('代入法：T(n) = 2T(n/2) + n', ''); },
  async (S) => { S.eq('T(n/2) = 2T(n/2²) + n/2', 'note'); say('n 換成 n/2', 'T(n/2) = 2T(n/2²) + n/2'); },
  async (S) => { S.eq('T(n) = 2[2T(n/2²) + n/2] + n'); say('代回去', ''); },
  async (S) => { S.eq('② T(n) = 2²T(n/2²) + 2n'); await S.walk(2); S.coin('n'); say('2 × n/2 = n → 2²T(n/2²) + 2n', ''); },
  async (S) => { S.eq('T(n/2²) = 2T(n/2³) + n/2²', 'note'); say('再找 T(n/2²)', ''); },
  async (S) => { S.eq('T(n) = 2²[2T(n/2³) + n/2²] + 2n'); say('代回去', ''); },
  async (S) => { S.eq('③ T(n) = 2³T(n/2³) + 3n'); await S.walk(3); S.coin('n'); say('2² × n/2² = n → 3n', ''); },
  async (S) => { S.eq('k：T(n) = 2ᵏT(n/2ᵏ) + kn'); await S.walk(4); S.coin('… k 個 n', A3.orange); say('代 k 次：2ᵏT(n/2ᵏ) + kn', ''); },
  async (S) => { S.eq('n/2ᵏ = 1 → n = 2ᵏ，k = log n'); await S.walk(5); say('假設 n/2ᵏ = 1', 'n = 2ᵏ，k = log n'); },
  async (S) => { S.eq('T(n) = 2ᵏT(1) + kn'); say('代回：2ᵏT(1) + kn', ''); },
  async (S) => { S.eq('= n·1 + n log n'); say('2ᵏ = n、T(1) = 1、k = log n', ''); },
  async (S) => { S.eq('→ Θ(n log n)', 'good'); S.w.mood('happy'); say('最高項 n log n → Θ(n log n)', ''); },
]);

// ═══════════ CyknhZbfMqc：2.2 Master Theorem for decreasing functions ═══════════
function a3Bins(S, labels, ay = 0.3, az = 2.3) {
  S.bins = labels.map(([nm, x, color]) => { zone(nm, x, 0, 0.6, 4.2, 2.6, color); return { x, n: 0, ans: tag(' ', 'good', x, ay, az) }; });
}
async function a3Drop(S, bi, t) {
  const b = S.bins[bi], y = 0.45 + b.n * 0.62; b.n++;
  const c = tag(t, 'pkt', 0, 7.2);
  await travel(S.tok, c, V3(0, 7.2, 0), V3(b.x, y, 0.2), 800);
  return c;
}
sc('algbari3-mt-dec-obs', '遞減型：從解過的例子找規律', (S) => { S.cam(); S.guide(-6.8, 3.2); say('遞減函數的 Master Theorem', ''); }, [
  async (S) => { a3Bins(S, [['a = 1（係數 1）', -2.6, '#dfe9f6'], ['a > 1（係數 2、3）', 2.6, '#f6e1d6']], 2.9, 0.2); say('先看前面解過的例子', ''); await S.talk('先觀察'); },
  async (S) => { await a3Drop(S, 0, 'T(n−1) + 1 → O(n)'); say('T(n − 1) + 1 → O(n)', ''); },
  async (S) => { await a3Drop(S, 0, 'T(n−1) + n → O(n²)'); say('T(n − 1) + n → O(n²)', ''); },
  async (S) => { await a3Drop(S, 0, 'T(n−1) + log n → O(n log n)'); say('T(n − 1) + log n → O(n log n)', ''); },
  async (S) => { await a3Drop(S, 1, '2T(n−1) + 1 → O(2ⁿ)'); say('2T(n − 1) + 1 → O(2ⁿ)', ''); },
  async (S) => { await a3Drop(S, 1, '3T(n−1) + 1 → O(3ⁿ)'); say('3T(n − 1) + 1 → O(3ⁿ)', ''); },
  async (S) => { await a3Drop(S, 1, '2T(n−1) + n → O(n·2ⁿ)'); say('2T(n − 1) + n → O(n·2ⁿ)', ''); },
  async (S) => { txt(S.bins[0].ans, 'f(n) × n'); txt(S.bins[1].ans, 'f(n) × aⁿ'); say('係數 1：f(n) 乘 n；係數 2：乘 2ⁿ', ''); await S.talk('看出來了嗎？', 'wow', true); },
]);
sc('algbari3-mt-dec-gen', '遞減型 Master Theorem：一般式與三種情況', (S) => { S.cam(); S.guide(-6.8, 3.2); S.board(-7.2, 7.6, 0.6); say('一般式', ''); }, [
  async (S) => { S.eq('T(n) = aT(n − b) + f(n)'); say('一般式：T(n) = aT(n − b) + f(n)', ''); },
  async (S) => { S.eq('a > 0，b > 0', 'note'); say('假設 a > 0、b > 0', ''); },
  async (S) => { S.eq('f(n) = O(nᵏ)，k ≥ 0', 'note'); say('f(n) = O(nᵏ)，k ≥ 0', ''); },
  async (S) => { a3Bins(S, [['a < 1', -4.6, '#e3f2e6'], ['a = 1', 0, '#dfe9f6'], ['a > 1', 4.6, '#f6e1d6']]); say('情況一：a = 1', ''); txt(S.bins[1].ans, 'f(n) × n'); },
  async (S) => { txt(S.bins[1].ans, 'O(nᵏ⁺¹)'); say('a = 1 → O(nᵏ⁺¹)', 'nᵏ 再乘一個 n'); },
  async (S) => { txt(S.bins[1].ans, 'O(nᵏ⁺¹) = O(n·f(n))'); say('換句話說：O(n·f(n))', ''); await S.talk('乘 n'); },
  async (S) => { txt(S.bins[2].ans, 'aⁿ'); say('情況二：a > 1', '2ⁿ、3ⁿ…'); },
  async (S) => { txt(S.bins[2].ans, 'O(nᵏ·aⁿ)'); say('a > 1 → O(nᵏ·aⁿ) = f(n)·aⁿ', ''); },
  async (S) => { txt(S.bins[2].ans, 'O(nᵏ·a^(n/b))'); say('每次減 b：aⁿ 變成 a^(n/b)', '例：T(n − 2) → 2^(n/2)'); await S.talk('減 b → 指數除以 b'); },
  async (S) => { txt(S.bins[0].ans, '？'); say('情況三：a < 1（例如 0.5）', ''); },
  async (S) => { txt(S.bins[0].ans, 'O(nᵏ) = O(f(n))'); say('a < 1 → 就是 f(n)', ''); },
  async (S) => { S.eq('三種情況：看 a 跟 1 比', 'good'); say('這就是遞減型的 Master Theorem', ''); await S.talk('三種情況到齊', 'happy', true); },
]);
sc('algbari3-mt-dec-recap', '遞減型 Master Theorem：怎麼記', (S) => { S.cam(); S.guide(-6.8, 3.2); a3Bins(S, [['a < 1', -4.6, '#e3f2e6'], ['a = 1', 0, '#dfe9f6'], ['a > 1', 4.6, '#f6e1d6']]); say('整理', ''); }, [
  async (S) => { tag('從例子觀察 ⇄ 先寫定理再套例子', 'say', 0, 6.8); say('定理是從例子觀察出來的', '也可以先寫定理再套例子'); },
  async (S) => { txt(S.bins[0].ans, 'O(f(n))'); say('a < 1 → f(n)', ''); },
  async (S) => { txt(S.bins[1].ans, 'O(n·f(n)) = O(nᵏ⁺¹)'); say('a = 1 → n·f(n)', ''); },
  async (S) => { txt(S.bins[2].ans, 'O(f(n)·a^(n/b))'); say('a > 1 → f(n)·a^(n/b)', ''); },
  async (S) => { tag('aT(n − b) + f(n) → 直接寫答案', 'good', 0, 5.8); say('任何 aT(n − b) + f(n) 都能直接寫答案', ''); },
  async (S) => { await S.talk('自己動手寫幾題才記得住', 'happy', true); say('沒有特別的推導，要自己動手練', ''); },
]);

// ═══════════ OynWkEj0S-s：2.4.1 Master Theorem for dividing functions ═══════════
sc('algbari3-mt-div-rules', 'Master Theorem（除法型）：比 log_b a 與 k', (S) => { S.cam(); S.board(-7.3, 7.6, 0.56); S.scale(3.4, 2.6); say('Master Theorem：除法型', ''); }, [
  async (S) => { S.eq('T(n) = aT(n/b) + f(n)'); txt(S.sc.card, 'T(n) = aT(n/b) + f(n)'); say('一般式：T(n) = aT(n/b) + f(n)', ''); },
  async (S) => { S.eq('a ≥ 1，b > 1', 'note'); say('a ≥ 1（至少一次）、b > 1', ''); },
  async (S) => { S.eq('f(n) = Θ(nᵏ logᵖ n)', 'note'); say('f(n) = Θ(nᵏ logᵖ n)', ''); },
  async (S) => { S.pans('log_b a', 'k'); say('先算兩個值：log_b a 與 k', 'k = f(n) 裡 n 的次方'); await S.talk('左邊遞迴、右邊 f(n)'); },
  async (S) => { S.eq('Case 1：log_b a > k → Θ(n^(log_b a))'); await S.tilt(1.5); txt(S.sc.cs, 'Case 1：左邊重'); say('Case 1：log_b a > k', '→ Θ(n^(log_b a))'); },
  async (S) => { S.eq('Case 2：log_b a = k'); await S.tilt(0); txt(S.sc.cs, 'Case 2：一樣重'); say('Case 2：兩個相等', '再看 p 分三種'); },
  async (S) => { S.eq('　p > −1 → Θ(nᵏ logᵖ⁺¹ n)'); say('p > −1 → Θ(nᵏ logᵖ⁺¹ n)', 'log 的次方多 1'); },
  async (S) => { S.eq('　p = −1 → Θ(nᵏ log log n)'); say('p = −1 → Θ(nᵏ log log n)', ''); },
  async (S) => { S.eq('　p < −1 → Θ(nᵏ)'); say('p < −1 → Θ(nᵏ)', 'log 丟掉'); },
  async (S) => { S.eq('Case 3：log_b a < k'); await S.tilt(-1.5); txt(S.sc.cs, 'Case 3：右邊重'); say('Case 3：log_b a < k', 'f(n) 那邊比較重'); },
  async (S) => { S.eq('　p ≥ 0 → Θ(nᵏ logᵖ n)'); say('p ≥ 0 → Θ(nᵏ logᵖ n)', '就是 f(n) 本身'); },
  async (S) => { S.eq('　p < 0 → O(nᵏ)'); say('p < 0 → O(nᵏ)', 'log 丟掉'); await S.talk('接著看例題', 'happy', true); },
]);
sc('algbari3-mt-c1', 'Master Theorem Case 1 例題', mtSetup('Case 1：log_b a > k'), [
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/2) + 1'); S.L('a = 2，b = 2，f(n) = Θ(1)', 'note', -2.0, 6.9); say('2T(n/2) + 1：a = 2、b = 2', 'f(n) = Θ(1)'); },
  async (S) => { S.L('Θ(1) = n⁰ log⁰ n → k = 0，p = 0', 'note', -2.0, 6.3); say('Θ(1) = n⁰·log⁰ n', 'k = 0、p = 0'); },
  async (S) => { S.pans('log₂2 = 1', 'k = 0'); say('log₂2 = 1，k = 0', ''); },
  async (S) => { await S.tilt(1); txt(S.sc.cs, 'Case 1：遞迴那邊重'); txt(S.sc.ans, 'Θ(n¹) = Θ(n)'); S.histAdd('2T(n/2) + 1 → Θ(n)'); say('1 > 0 → Case 1 → Θ(n^(log_b a)) = Θ(n)', ''); await S.talk('答案是 n'); },
  async (S) => { txt(S.sc.card, 'T(n) = 4T(n/2) + n'); S.pans('log₂4 = 2', 'k = 1'); txt(S.sc.ans, ' '); say('4T(n/2) + n：log₂4 = 2，k = 1', ''); },
  async (S) => { await S.tilt(1); txt(S.sc.ans, 'Θ(n²)'); S.histAdd('4T(n/2) + n → Θ(n²)'); say('2 > 1 → Case 1 → Θ(n²)', ''); },
  mtStep('8T(n/2) + n', '3', '1', 'Θ(n³)', { why: 'log₂8 = 3 > 1' }),
  mtStep('8T(n/2) + n²', '3', '2', 'Θ(n³)', { why: '3 > 2：還是 Case 1' }),
  mtStep('9T(n/3) + 1', '2', '0', 'Θ(n²)', { why: 'log₃9 = 2 > 0' }),
  mtStep('9T(n/3) + n', '2', '1', 'Θ(n²)', { why: '2 > 1：一樣 n²' }),
  async (S) => { txt(S.sc.card, '9T(n/3) + n²'); S.pans('log_b a = 2', 'k = 2'); await S.tilt(0); txt(S.sc.cs, '一樣重 → 不是 Case 1'); txt(S.sc.ans, '→ Case 2'); say('9T(n/3) + n²：2 = 2', '相等 → 屬於 Case 2'); await S.talk('平手了！', 'wow'); },
  async (S) => { await mtShow(S, '4T(n/2) + n', '2', '1', 'Θ(n²)'); await mtShow(S, '8T(n/2) + n', '3', '1', 'Θ(n³)'); say('只要 log_b a 比較大', '答案直接寫 n^(log_b a)'); },
  mtStep('8T(n/2) + n log n', '3', '1', 'Θ(n³)', { why: '只看 n 的次方：1 < 3', talk: 'log 不影響' }),
]);
sc('algbari3-mt-c2', 'Master Theorem Case 2：再乘 log n', mtSetup('Case 2：log_b a = k'), [
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/2) + n'); S.pans('log₂2 = 1', 'k = 1'); await S.tilt(0); txt(S.sc.cs, 'Case 2：一樣重'); say('2T(n/2) + n：1 = 1', '相等 → Case 2'); },
  async (S) => { S.L('p = 0 > −1 → nᵏ logᵖ⁺¹ n', 'note', -2.0, 6.9); txt(S.sc.ans, 'Θ(n log n)'); S.histAdd('2T(n/2) + n → Θ(n log n)'); say('p = 0 > −1 → n¹·log¹ n', 'Θ(n log n)'); },
  async (S) => { await S.talk('相等：f(n) × log n', 'happy', true); say('簡單說：相等就把 f(n) 再乘 log n', ''); },
  mtStep('4T(n/2) + n²', '2', '2', 'Θ(n² log n)', { why: '2 = 2：n² × log n' }),
  mtStep('4T(n/2) + n² log n', '2', '2', 'Θ(n² log² n)', { why: '已經有 log n → 變 log² n' }),
  async (S) => { S.L('n² log² n → log³ n；log⁵ n → log⁶ n', 'note', -2.0, 6.9); say('log² 變 log³，log⁵ 變 log⁶', ''); await S.talk('log 次方 +1'); },
  mtStep('8T(n/2) + n³', '3', '3', 'Θ(n³ log n)', { why: '3 = 3：n³ × log n' }),
]);
sc('algbari3-mt-c2p', 'Case 2：p = −1 與 p < −1', mtSetup('Case 2：p 是負的'), [
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/2) + n/log n'); S.pans('log₂2 = 1', 'k = 1'); await S.tilt(0); txt(S.sc.cs, 'Case 2：一樣重'); say('2T(n/2) + n/log n：1 = 1', 'p 是多少？'); },
  async (S) => { S.L('log n 在分母 → p = −1', 'note', -2.0, 6.9); say('log 在分母 → p = −1', ''); },
  async (S) => { S.L('× log n 會抵消 → 不能這樣做', 'bad', -2.0, 6.3); say('乘 log n 會抵消：不能這樣', ''); await S.talk('方法不一樣', 'wow'); },
  async (S) => { txt(S.sc.ans, 'Θ(n log log n)'); S.histAdd('2T(n/2) + n/log n → Θ(n log log n)'); say('p = −1 → Θ(n log log n)', ''); },
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/2) + n/log² n'); txt(S.sc.ans, ' '); S.L('分母 log² n → p = −2 < −1', 'note', -2.0, 5.7); say('分母是 log² n → p = −2', ''); },
  async (S) => { txt(S.sc.ans, 'Θ(n)'); S.histAdd('2T(n/2) + n/log² n → Θ(n)'); say('p < −1 → 連 log log n 都不要', 'Θ(n)'); await S.talk('只剩 n', 'happy', true); },
]);
sc('algbari3-mt-c3', 'Master Theorem Case 3：直接取 f(n)', mtSetup('Case 3：log_b a < k'), [
  async (S) => { txt(S.sc.card, 'T(n) = T(n/2) + n²'); S.pans('log₂1 = 0', 'k = 2'); say('T(n/2) + n²：log₂1 = 0，k = 2', ''); },
  async (S) => { await S.tilt(-2); txt(S.sc.cs, 'Case 3：f(n) 那邊重'); txt(S.sc.ans, 'Θ(n²)'); S.histAdd('T(n/2) + n² → Θ(n²)'); say('k 比較大 → Θ(n²)', ''); },
  mtStep('2T(n/2) + n²', '1', '2', 'Θ(n²)', { why: '1 < 2：還是 n²' }),
  async (S) => { S.histAdd('有 log 照抄：n² log n、n² log² n'); txt(S.sc.ans, 'Θ(n² log n)'); say('f(n) 有 log n 就照抄', 'n² log n、n² log² n'); },
  async (S) => { await S.talk('直接取 f(n)', 'happy', true); say('n 的次方比 log_b a 大 → 直接取 f(n)', ''); },
  mtStep('4T(n/2) + n³', '2', '3', 'Θ(n³)', { why: '2 < 3' }),
  async (S) => { txt(S.sc.card, '4T(n/2) + n³/log n'); txt(S.sc.ans, 'O(n³)'); S.histAdd('4T(n/2) + n³/log n → O(n³)'); say('分母有 log：不要它，只寫 n³', ''); },
]);

// ═══════════ kGcO-nAm9Vc：2.4.2 Master Theorem examples ═══════════
sc('algbari3-mt-k1', 'Master Theorem 例題：Case 1', mtSetup('Case 1 例題'), [
  mtStep('2T(n/2) + 1', '1', '0', 'Θ(n)', { why: 'log₂2 = 1 > 0' }),
  mtStep('4T(n/2) + 1', '2', '0', 'Θ(n²)', { why: 'log₂4 = 2 > 0' }),
  mtStep('4T(n/2) + n', '2', '1', 'Θ(n²)', { why: '2 > 1' }),
  mtStep('8T(n/2) + n²', '3', '2', 'Θ(n³)', { why: 'log₂8 = 3 > 2' }),
  mtStep('16T(n/2) + n²', '4', '2', 'Θ(n⁴)', { why: 'log₂16 = 4 > 2', talk: 'Case 1 收工' }),
]);
sc('algbari3-mt-k3', 'Master Theorem 例題：Case 3', mtSetup('Case 3 例題'), [
  mtStep('T(n/2) + n', '0', '1', 'Θ(n)', { why: 'log₂1 = 0 < 1' }),
  mtStep('2T(n/2) + n²', '1', '2', 'Θ(n²)', { why: '1 < 2' }),
  mtStep('2T(n/2) + n² log n', '1', '2', 'Θ(n² log n)', { why: 'f(n) 照抄' }),
  mtStep('4T(n/2) + n³ log² n', '2', '3', 'Θ(n³ log² n)', { why: '2 < 3：整個照抄' }),
  mtStep('2T(n/2) + n²/log n', '1', '2', 'O(n²)', { why: '分母的 log 不要', talk: '分母 log 丟掉' }),
]);
sc('algbari3-mt-k2', 'Master Theorem 例題：Case 2', mtSetup('Case 2 例題'), [
  mtStep('T(n/2) + 1', '0', '0', 'Θ(log n)', { why: 'log₂1 = 0 = k：1 × log n' }),
  mtStep('2T(n/2) + n', '1', '1', 'Θ(n log n)', { why: 'n × log n' }),
  mtStep('2T(n/2) + n log n', '1', '1', 'Θ(n log² n)', { why: 'n log n × log n' }),
  mtStep('4T(n/2) + n²', '2', '2', 'Θ(n² log n)', { why: 'n² × log n' }),
  mtStep('4T(n/2) + (n log n)²', '2', '2', 'Θ(n² log³ n)', { why: 'n² log² n × log n' }),
  mtStep('2T(n/2) + n/log n', '1', '1', 'Θ(n log log n)', { why: 'p = −1' }),
  mtStep('2T(n/2) + n/log² n', '1', '1', 'Θ(n)', { why: 'p = −2 < −1', talk: 'Case 2 也會了' }),
]);

// ═══════════ 9rVuyjxzwgM：2.5 Root function T(n) = T(√n) + 1 ═══════════
const A3_CODE10 = ['void Test(int n) {', '  if (n > 2) {', '    printf("%d", n);', '    Test(√n);', '  }', '}'];
sc('algbari3-root-rr', 'Root function：T(n) = T(√n) + 1', (S) => { S.cam(); S.guide(); S.board(0.9, 3.4, 0.62); say('Root function', ''); }, [
  async (S) => { S.code(A3_CODE10); S.cost(2, '1'); S.cost(3, 'T(√n)'); say('已經寫好的遞迴式', ''); },
  async (S) => { S.c.hl(3); say('Test 呼叫自己時傳 √n', ''); await S.talk('開根號！', 'wow'); },
  async (S) => { const cs = [['n − 1　減', A3.sand], ['n / 2　除', A3.gold], ['√n　開根號', A3.teal]]; for (let i = 0; i < 3; i++) { const l = tag(cs[i][0], i === 2 ? 'ptr alt' : 'pkt', 1.6 + i * 2.0, 6.6); await travel(S.tok, l, V3(1.6 + i * 2.0, 8.0, 0), V3(1.6 + i * 2.0, 6.6, 0), 400); } say('減、除之外的第三種：開根號', ''); },
  async (S) => { S.c.hl(1); say('注意：條件是 n > 2', ''); },
  async (S) => { S.eq('最小值要 ≥ 2（取 1 或 0 解不出來）', 'note'); say('開根號的最小值要 ≥ 2', '√1 = 1、√0 = 0 會卡住'); await S.talk('1 開根號還是 1', 'wow'); },
  async (S) => { S.c.hl(-1); S.eq('T(n) = T(√n) + 1'); say('T(n) = T(√n) + 1', ''); },
]);
const A3_ST_ROOT = ['n', 'n^(1/2)', 'n^(1/2²)', 'n^(1/2³)', '…', '2'];
sc('algbari3-root-bs', '代入：T(n^(1/2ᵏ)) + k', (S) => { S.cam(); S.board(-7.3, 7.6, 0.62); S.stairs(A3_ST_ROOT); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = T(n^(1/2)) + 1'); await S.walk(1); S.coin('+1'); say('√n = n^(1/2)', 'T(n) = T(n^(1/2)) + 1'); },
  async (S) => { S.eq('② T(n) = T(n^(1/2²)) + 2'); await S.walk(2); S.coin('+1'); say('再開一次根號：n^(1/2²)', '+ 2'); },
  async (S) => { S.eq('③ T(n) = T(n^(1/2³)) + 3'); await S.walk(3); S.coin('+1'); say('再代：n^(1/2³)，+ 3', ''); },
  async (S) => { S.eq('k：T(n) = T(n^(1/2ᵏ)) + k'); await S.walk(4); S.coin('… k 個', A3.orange); say('代 k 次：T(n^(1/2ᵏ)) + k', ''); },
]);
const A3_ST_2M = ['2¹⁶', '2⁸', '2⁴', '2²', '2¹ = 2'];
sc('algbari3-root-2m', '設 n = 2ᵐ → k = log log n', (S) => { S.cam(); S.board(-7.3, 7.6, 0.6); S.stairs(A3_ST_2M, 1.4, 1.25, 0.55); tag('示意：n = 2¹⁶ = 65536', 'note', 3.9, 4.2); say('換成 2 的次方', ''); }, [
  async (S) => { S.eq('最小值是 2 → 假設 n = 2ᵐ'); say('最小值是 2：假設 n = 2ᵐ', ''); },
  async (S) => { S.eq('T(n) = T(2^(m/2ᵏ)) + k'); say('n^(1/2ᵏ) = (2ᵐ)^(1/2ᵏ) = 2^(m/2ᵏ)', ''); await S.walk(1); await S.walk(2); },
  async (S) => { S.eq('假設 T(2^(m/2ᵏ)) 到了 T(2)'); await S.walk(3); await S.walk(4); S.w.mood('happy'); say('一直開根號到 2 為止', ''); },
  async (S) => { S.eq('2 = 2¹ → m/2ᵏ = 1'); say('2 的次方是 1 → m/2ᵏ = 1', '示意：16 → 8 → 4 → 2 → 1'); },
  async (S) => { S.eq('m = 2ᵏ'); say('m = 2ᵏ', ''); },
  async (S) => { S.eq('k = log₂ m'); tag('示意：k = log₂ 16 = 4 步', 'good', 3.9, 5.0); say('k = log₂ m', '示意：16 → 4 步'); },
  async (S) => { S.eq('n = 2ᵐ → m = log₂ n'); say('但答案要用 n 表示：m = log₂ n', ''); },
  async (S) => { S.eq('k = log₂ log₂ n'); say('k = log log n', ''); },
  async (S) => { S.eq('T(n) = Θ(log log n)', 'good'); say('T(n) = Θ(log log n)', '長得非常慢'); },
  async (S) => { S.eq('老師：也可套 Master Theorem（要先換變數）', 'note'); say('也可以用 Master Theorem', '要先令 m = log n 換變數'); },
]);

// ═══════════ XcZw01FuH18：T(n) = T(n/2) + n ═══════════
sc('algbari3-tree-halfn', '遞迴樹：n、n/2、n/2²…', (S) => { S.cam(); S.guide(); S.board(0.9, 7.5, 0.62); say('T(n) = T(n/2) + n', ''); }, [
  async (S) => { S.eq('T(n) = T(n/2) + n'); await dvNode(S, 0, 'T(n)'); say('直接給遞迴式，用遞迴樹解', ''); },
  async (S) => { tag('n', 'pkt', dvX - 1.45, dvY(0)); await dvNode(S, 1, 'T(n/2)'); say('這層花 n，再呼叫 T(n/2)', ''); },
  async (S) => { tag('n/2', 'pkt', dvX - 1.45, dvY(1)); await dvNode(S, 2, 'T(n/2²)'); say('下一層花 n/2，再呼叫 T(n/2²)', ''); },
  async (S) => { tag('n/2²', 'pkt', dvX - 1.45, dvY(2)); await dvNode(S, 3, 'T(n/2³)'); say('再下一層 n/2²', ''); },
  async (S) => { tag('⋮', 'ptr', dvX, dvY(3.6)); await dvNode(S, 4.2, 'T(n/2ᵏ)', null, A3.orange); say('一直減半，做 k 次', ''); },
  async (S) => { tag('= T(1)', 'good', dvX + 1.8, dvY(4.2)); S.eq('假設 n/2ᵏ = 1'); say('假設已經到 1', ''); },
  async (S) => { ['n', 'n/2', 'n/2²'].forEach((t, i) => S.side(dvY(i), t, dvX + 1.6)); say('每層的時間加起來', ''); },
  async (S) => { S.side(dvY(4.2) + 0.55, '…n/2ᵏ⁻¹', dvX + 1.9); say('最後一項大約 n/2ᵏ（或 n/2ᵏ⁻¹）', '差一項不影響'); },
  async (S) => { S.eq('n + n/2 + n/2² + … + n/2ᵏ'); say('總和 = n + n/2 + n/2² + … + n/2ᵏ', ''); await S.talk('越加越少'); },
]);
function a3Slice(x, y, r, a0, da, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 48, 1, false, a0, da), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); lab.world.add(m); return m;
}
sc('algbari3-half-circle', '½ + ¼ + ⅛ + … = 一個圓', (S) => { S.cam(); S.guide(); S.board(-7.2, 7.5, 0.62); say('這個級數是多少？', ''); }, [
  async (S) => { S.eq('T(n) = n(1 + 1/2 + 1/2² + … + 1/2ᵏ)'); say('把 n 提出來', ''); },
  async (S) => { S.eq('= n · Σ 1/2ⁱ（i = 0…k）'); say('n · Σ 1/2ⁱ，i 從 0 到 k', ''); },
  async (S) => { S.eq('老師：這個和 ≈ 1 → T(n) = n', 'note'); say('老師說這個和是 1 → T(n) = n', '（含首項 1 的話其實趨近 2）'); },
  async (S) => { S.eq('→ O(n)', 'good'); say('不管是 1 還是 2，都是常數 → O(n)', ''); await S.talk('常數倍不影響'); },
  async (S) => { tag('一個圓 = 1', 'say', 3.2, 6.6); line(3.2, 2.0, 3.2, 6.0, 0.15, '#8a7a5a'); S.p = [a3Slice(3.2, 4.0, 2.0, 0, Math.PI, A3.orange)]; tag('½', 'ptr alt', 4.4, 4.0, 0.3); say('½：半個圓', ''); },
  async (S) => { S.p.push(a3Slice(3.2, 4.0, 2.0, Math.PI, Math.PI / 2, A3.blue)); tag('¼', 'ptr alt', 2.4, 4.9, 0.3); say('¼：四分之一', ''); },
  async (S) => { S.p.push(a3Slice(3.2, 4.0, 2.0, Math.PI * 1.5, Math.PI / 4, A3.green)); S.p.push(a3Slice(3.2, 4.0, 2.0, Math.PI * 1.75, Math.PI / 8, A3.purple)); tag('⅛　1/16…', 'ptr alt', 0.6, 2.6, 0.3); say('⅛、1/16…', ''); },
  async (S) => { let a = Math.PI * 1.875, d = Math.PI / 16; for (let i = 0; i < 4; i++) { S.p.push(a3Slice(3.2, 4.0, 2.0, a, d, [A3.pink, A3.teal, A3.gold, A3.red][i])); a += d; d /= 2; } say('一直加到無窮多塊 → 剛好一個圓', '½ + ¼ + ⅛ + … = 1'); await S.talk('拼回一整個！', 'wow', true); },
  async (S) => { S.eq('≈ 1 → n × 1 → O(n)', 'good'); say('約等於 1 → n·1 → O(n)', ''); },
]);
const A3_ST_HN = ['n', 'n/2', 'n/2²', 'n/2³', '…', '1'];
sc('algbari3-bs-halfn', '代入法：T(n) = T(n/2) + n', (S) => { S.cam(); S.board(-7.3, 7.6, 0.6); S.stairs(A3_ST_HN); say('代入法', ''); }, [
  async (S) => { S.eq('① T(n) = T(n/2) + n'); await S.walk(1); S.coin('n'); say('代入法：T(n) = T(n/2) + n', ''); },
  async (S) => { tag('同一個級數，這次橫著寫', 'say', 3.6, 4.6); say('會得到同一個級數，只是橫著寫', ''); },
  async (S) => { S.eq('② T(n) = T(n/2²) + n/2 + n'); await S.walk(2); S.coin('n/2'); say('T(n/2) = T(n/2²) + n/2 → 代回', ''); },
  async (S) => { S.eq('③ T(n) = T(n/2³) + n/2² + n/2 + n'); await S.walk(3); S.coin('n/2²'); say('再代一次', ''); },
  async (S) => { S.eq('k：T(n/2ᵏ) + n/2ᵏ⁻¹ + … + n/2 + n'); await S.walk(4); S.coin('…', A3.orange); say('代 k 次', ''); },
  async (S) => { S.eq('n/2ᵏ = 1 → n = 2ᵏ，k = log n'); await S.walk(5); say('假設 n/2ᵏ = 1', 'k = log n'); },
  async (S) => { S.eq('T(n) = T(1) + n(1/2ᵏ⁻¹ + … + 1/2 + 1)'); say('n 提出來', ''); },
  async (S) => { S.eq('括號 ≈ 2（老師算成 1 + 1）', 'note'); say('括號裡大約是 2', ''); },
  async (S) => { S.eq('T(n) ≈ 1 + 2n'); say('T(n) ≈ 1 + 2n', ''); },
  async (S) => { S.eq('→ O(n)', 'good'); S.w.mood('happy'); say('O(n)：和遞迴樹答案相同', ''); },
]);

// ═══════════ q6RicK1FCUs：Tower of Hanoi ═══════════
function a3Hanoi(S, n, names = ['A', 'B', 'C'], y0 = 0, dx = 4.4) {
  const xs = [-dx, 0, dx];
  const base = lab.box('#c9a46a', [3 * dx + 1.6, 0.2, 2.4]); base.position.set(0, y0 + 0.1, 0); lab.world.add(base);
  xs.forEach((x, i) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.0, 12), new THREE.MeshStandardMaterial({ color: '#8a6a44' })); p.position.set(x, y0 + 1.7, 0); lab.world.add(p); tag(names[i], 'idx', x, y0 + 0.2, 1.5); });
  const H = { xs, y0, pegs: [[], [], []], disks: {} };
  for (let d = n; d >= 1; d--) {
    const w = 0.9 + d * 0.65;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.38, 32), new THREE.MeshStandardMaterial({ color: A3_DISK[(d - 1) % 4], roughness: 0.5 }));
    m.position.set(xs[0], y0 + 0.4 + H.pegs[0].length * 0.4, 0); lab.world.add(m);
    const l = lab.label(String(d), 'val'); l.position.set(0, 0, w / 2 + 0.02); m.add(l);
    H.disks[d] = m; H.pegs[0].push(d);
  }
  H.move = async (from, to, ms = 900) => {
    const d = H.pegs[from].pop(); const m = H.disks[d]; const a = m.position.clone();
    const b = V3(xs[to], y0 + 0.4 + H.pegs[to].length * 0.4, 0); H.pegs[to].push(d);
    const top = y0 + 3.7;
    await anim(S.tok, ms, (u) => {
      if (u < 1 / 3) m.position.set(a.x, a.y + (top - a.y) * u * 3, 0);
      else if (u < 2 / 3) m.position.set(a.x + (b.x - a.x) * (u - 1 / 3) * 3, top, 0);
      else m.position.set(b.x, top + (b.y - top) * (u - 2 / 3) * 3, 0);
    });
  };
  return H;
}
sc('algbari3-hanoi-intro', 'Tower of Hanoi：規則', (S) => { S.cam([0, 5.5, 15], [0, 2.4, 0]); S.guide(-6.6, 2.8); say('Tower of Hanoi', ''); }, [
  async (S) => { S.H = a3Hanoi(S, 3); say('Tower of Hanoi（河內塔）', '先小例子，再 3 個盤子'); await S.talk('經典遞迴題'); },
  async (S) => { tag('由下往上：越來越小', 'say', -4.4, 3.6); say('三根柱子；一根疊著盤子，下大上小', ''); },
  async (S) => { tag('目標 →', 'pkt', 2.2, 3.4); tag('全部搬到 C', 'good', 4.4, 3.6); say('要把所有盤子從 A 搬到 C', ''); },
  async (S) => { tag('✗ 大盤不能壓小盤', 'bad', 0, 5.4); say('任何時候：大盤子不能放在小盤子上', '一次只搬一個'); await S.talk('不能壓！', 'wow', true); },
  async (S) => { tag('輔助柱', 'say', 0, 3.6); say('多給一根輔助柱 B 幫忙', ''); },
]);
sc('algbari3-hanoi-small', 'Tower of Hanoi：1 個、2 個盤子', (S) => { S.cam([0, 5.5, 15], [0, 2.4, 0]); S.guide(-6.6, 2.8); say('從小例子開始', ''); }, [
  async (S) => { S.H = a3Hanoi(S, 1); say('只有 1 個盤子', ''); },
  async (S) => { await S.H.move(0, 2); say('1 個盤子：A → C 直接搬', ''); await S.talk('一步搞定', 'happy', true); },
  async (S) => { lab.clear(); S.cam([0, 5.5, 15], [0, 2.4, 0]); S.guide(-6.6, 2.8); S.H = a3Hanoi(S, 2); S.mv = S.L(' ', 'ptr alt', -2.6, 6.4); say('2 個盤子：disk 1、disk 2', ''); },
  async (S) => { await S.H.move(0, 1); txt(S.mv, '① A → B'); say('第一步：A → B', '先放到中間的輔助柱'); },
  async (S) => { txt(S.mv, '① A → B using C'); say('寫成：A → B using C', '不是直接去目的地，用 using 標明'); },
  async (S) => { await S.H.move(0, 2); txt(S.mv, '① A → B using C　② A → C'); say('第二步：A → C', '直接放到目的地'); },
  async (S) => { await S.H.move(1, 2); txt(S.mv, '① A → B using C　② A → C　③ B → C using A'); say('第三步：B → C using A', ''); await S.talk('完成！', 'happy', true); },
  async (S) => { tag('2 個盤子：3 步', 'good', 0, 5.4); say('2 個盤子 3 步：很簡單的小問題', ''); },
]);
sc('algbari3-hanoi-three', 'Tower of Hanoi：3 個盤子，上面 2 個當一組', (S) => { S.cam([0, 5.5, 15], [0, 2.4, 0]); S.guide(-6.6, 2.8); say('3 個盤子', ''); }, [
  async (S) => { S.H = a3Hanoi(S, 3); S.mv = S.L(' ', 'ptr alt', -5.6, 6.4); say('3 個盤子：比較大的問題', ''); },
  async (S) => { S.grp = tag('這 2 個當一組', 'say', -4.4, 3.2); txt(S.mv, '① Move 2 disks A → B using C'); say('第一步：把 2 個盤子 A → B using C', ''); },
  async (S) => { txt(S.grp, '搬 2 個 = 剛才學過 → 遞迴！'); say('一次只能搬一個，但「搬 2 個」剛才學過', '這是遞迴步驟'); await S.talk('用剛才的方法', 'wow'); },
  async (S) => { remove(S.grp); await S.H.move(0, 2, 600); await S.H.move(0, 1, 600); await S.H.move(2, 1, 600); say('上面 2 個搬到 B 了', ''); },
  async (S) => { await S.H.move(0, 2); txt(S.mv, '① 2 disks A → B　② 1 disk A → C'); say('第二步：1 個盤子 A → C', ''); },
  async (S) => { txt(S.mv, '① 2 disks A → B　② 1 disk A → C　③ 2 disks B → C using A'); say('第三步：2 個盤子 B → C using A', '又是遞迴'); },
  async (S) => { await S.H.move(1, 0, 600); await S.H.move(1, 2, 600); await S.H.move(0, 2, 600); say('完成！', ''); await S.talk('三步就搞定', 'happy', true); },
  async (S) => { tag('這三步 = 遞迴演算法的關鍵', 'good', 0, 5.4); say('這三步是設計遞迴演算法的關鍵', ''); },
]);
sc('algbari3-hanoi-code', 'TOH(n, A, B, C)：n 個盤子的遞迴演算法', (S) => { S.cam(); S.guide(); S.board(-7.2, 7.5, 0.62); say('n 個盤子', ''); }, [
  async (S) => { S.eq('3 個 → 寫 2；4 個 → 寫 3；n 個 → 寫 n − 1'); say('3 個寫 2、4 個寫 3 → n 個寫 n − 1', ''); },
  async (S) => { S.eq('① n−1 個：A → B using C'); S.eq('② 1 個：A → C'); S.eq('③ n−1 個：B → C using A'); say('同樣三步，換成 n − 1', ''); },
  async (S) => { S.code(['TOH(n, A, B, C) {', '  if (n > 0) {', '    TOH(n-1, A, C, B);', '    printf("Move %c to %c", A, C);', '    TOH(n-1, B, A, C);', '  }', '}'], 0.4, 7.5, 0.55); say('演算法 TOH(n, A, B, C)', ''); await S.talk('對照三步看'); },
  async (S) => { S.c.hl(0); tag('來源　中繼　目的地', 'note', 3.0, 8.1); say('n 個盤子，三根柱子 A、B、C', ''); },
  async (S) => { S.c.hl(1); say('n > 0 才做', ''); },
  async (S) => { S.c.hl(2); tag('C 在中間 = using', 'pkt', 6.0, 6.4); say('TOH(n−1, A, C, B)：C 在中間 → using C', '從 A 搬到 B'); },
  async (S) => { S.c.hl(3); say('printf：Move A → C', ''); },
  async (S) => { S.c.hl(4); tag('A 在中間 = using', 'pkt', 6.0, 5.3); say('TOH(n−1, B, A, C)：B → C，A 當中繼', ''); await S.talk('三步全對上', 'happy', true); },
]);
const A3_TX = [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0];
sc('algbari3-hanoi-trace', '追蹤 TOH(3, 1, 2, 3)', (S) => { S.cam(); say('追蹤 TOH(3, 1, 2, 3)', ''); }, [
  async (S) => { S.r = tag('TOH(3, 1, 2, 3)', 'ptr alt', 0, 7.3); say('追蹤 3 個盤子：TOH(3, 1, 2, 3)', '柱子編號 1、2、3'); },
  async (S) => { tag('呼叫 → printf → 呼叫', 'say', 3.8, 7.3); say('每個呼叫三步：遞迴、印、遞迴', ''); },
  async (S) => { tag('TOH(2, 1, 3, 2)', 'ptr', -3.6, 5.7); line(0, 7.0, -3.6, 6.0); say('第一個呼叫：TOH(2, 1, 3, 2)', 'n − 1，A C B 的順序'); },
  async (S) => { tag('1 → 3', 'pkt', 0, 5.7); line(0, 7.0, 0, 6.0); say('接著印：1 → 3', ''); },
  async (S) => { tag('TOH(2, 2, 1, 3)', 'ptr', 3.6, 5.7); line(0, 7.0, 3.6, 6.0); say('再呼叫：TOH(2, 2, 1, 3)', 'B A C 的順序'); },
  async (S) => { const L2 = [['TOH(1,1,2,3)', -3.6], ['1 → 2', -3.6, 1], ['TOH(1,3,1,2)', -3.6], ['TOH(1,2,3,1)', 3.6], ['2 → 3', 3.6, 1], ['TOH(1,1,2,3)', 3.6]]; L2.forEach(([t, px, pr], i) => { tag(t, pr ? 'pkt' : 'ptr', A3_TX[i], 4.1); line(px, 5.4, A3_TX[i], 4.4); }); say('兩個 TOH(2) 再依同樣規則展開', ''); },
  async (S) => { const pr = ['1 → 3', '', '3 → 2', '2 → 1', '', '1 → 3']; [0, 2, 3, 5].forEach((i) => { tag(pr[i], 'pkt', A3_TX[i], 2.7); line(A3_TX[i], 3.8, A3_TX[i], 3.0); tag('∅', 'idx', A3_TX[i] - 0.8, 2.0); tag('∅', 'idx', A3_TX[i] + 0.8, 2.0); }); say('TOH(1) 展開：TOH(0)、印、TOH(0)', ''); },
  async (S) => { tag('∅ = TOH(0)：0 個盤子，什麼都不做', 'note', 0, 1.2); say('0 個盤子的呼叫：什麼都不做，停止', ''); await S.talk('到底了', 'calm'); },
]);
const A3_MOVES = [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]];
const A3_MV = (k) => (A3_MOVES[k][0] + 1) + '→' + (A3_MOVES[k][1] + 1);
sc('algbari3-hanoi-play', '照著印出的 7 步搬', (S) => { S.cam([0, 5.5, 15], [0, 2.4, 0]); S.guide(-6.6, 2.8); say('照著 printf 搬', ''); }, [
  async (S) => { S.H = a3Hanoi(S, 3, ['1', '2', '3']); S.ms = A3_MOVES.map((m, k) => tag(A3_MV(k), 'note', -4.8 + k * 1.6, 6.6)); say('把所有 printf 收集起來', ''); },
  async (S) => { S.ms.forEach((l) => { l.element.className = 'lab-label pkt'; }); say('1→3、1→2、3→2、1→3、2→1、2→3、1→3', '共 7 步'); },
  async (S) => { S.ms[0].element.className = 'lab-label good'; await S.H.move(0, 2); say('第一步：1 → 3', ''); },
  async (S) => { S.ms[1].element.className = 'lab-label good'; await S.H.move(0, 1); say('第二步：1 → 2', ''); },
  async (S) => { S.ms[2].element.className = 'lab-label good'; await S.H.move(2, 1); say('第三步：3 → 2', ''); },
  async (S) => { for (let k = 3; k < 7; k++) { S.ms[k].element.className = 'lab-label good'; await S.H.move(A3_MOVES[k][0], A3_MOVES[k][1], 600); } say('1 → 3、2 → 1、2 → 3、1 → 3', ''); },
  async (S) => { tag('3 個盤子全部到 3 號柱 ✓', 'good', 0, 5.4); say('全部從 1 號搬到 3 號柱', ''); await S.talk('成功！', 'happy', true); },
  async (S) => { tag('n 個盤子也適用', 'say', 4.4, 4.4); say('同一個演算法對 n 個盤子都適用', ''); },
]);

// ═══════════ SLsHKh_OUEM：Master's Theorem Explained ═══════════
sc('algbari3-mtx-form', 'Master Theorem：形式與 a、b、f(n)', (S) => { S.cam(); S.board(-7.2, 7.6, 0.6); say('Master Theorem', ''); }, [
  async (S) => { S.eq('T(n) = aT(n/b) + f(n)'); say('Master Theorem 解這種形式', ''); },
  async (S) => { S.eq('aT(n/b)：遞迴部分　f(n)：非遞迴部分', 'note'); say('遞迴部分 + 非遞迴部分', ''); },
  async (S) => { S.eq('遞迴部分有常數 a、b；非遞迴部分是 f(n)', 'note'); say('a、b 在遞迴部分；f(n) 在非遞迴部分', ''); },
  async (S) => { S.eq('條件：a ≥ 1，b > 1'); say('條件：a ≥ 1、b > 1', ''); },
  async (S) => { S.eq('f(n) 漸近為正'); say('f(n) 要漸近為正', ''); },
  async (S) => { S.eq('a：每層分成幾個子問題', 'note'); say('a = 每層分成幾個子問題', ''); },
  async (S) => { S.eq('b：每次規模縮小幾倍', 'note'); say('b = 每次呼叫規模縮小的倍數', ''); },
  async (S) => { S.eq('f(n)：遞迴呼叫之外做的工作', 'note'); say('f(n) = 遞迴呼叫以外的工作', ''); },
  async (S) => { S.eq('例：a = 2，b = 2，f(n) = n²'); S.node('r', 'n', 3.6, 6.8, null, A3.gold); say('例：a = 2、b = 2、f(n) = n²', ''); },
  async (S) => { S.node('a', '子問題', 1.9, 5.2, 'r', A3.blue, 1.4); S.node('b', '子問題', 5.3, 5.2, 'r', A3.blue, 1.4); say('a = 2：分成 2 個子問題', '就是樹上的 2 個子節點'); await S.talk('一分為二'); },
  async (S) => { relabel(S.nodes.a.m, 'n/2'); relabel(S.nodes.b.m, 'n/2'); [1.0, 2.8, 4.4, 6.2].forEach((x, i) => S.node('c' + i, 'n/4', x, 3.6, i < 2 ? 'a' : 'b', A3.blue, 1.0)); say('b = 2：每層規模減半', 'n → n/2 → n/4'); },
  async (S) => { S.eq('漸近為正：n 夠大後一直 > 0', 'note'); say('漸近為正：n 夠大之後一直是正的', ''); },
  async (S) => { S.eq('例：n²、n³、指數函數', 'note'); say('例：n²、n³、指數函數', ''); },
]);
sc('algbari3-mtx-depth', '樹的深度與葉子數', (S) => { S.cam(); S.guide(); S.board(-7.2, 7.6, 0.6); say('樹有多深、有幾片葉子', ''); }, [
  async (S) => { for (let L = 0; L < 4; L++) await btLevel(S, L, ['n', 'n/b', 'n/b²', 'n/b³'][L], A3.blue, L === 3 ? 0.9 : 1.1); say('先求樹的深度', ''); },
  async (S) => { tag('⋮　　⋮　　⋮', 'ptr', 0.2, 2.2); S.bot = tag('1　1　1　…　1　1　1', 'good', 0.2, 1.4); say('最底層：條件終止，值是常數 1', ''); },
  async (S) => { S.eq('n/bᵏ = 1 → k = log_b n'); tag('深度 k', 'say', 6.4, 4.4); say('n/bᵏ = 1 → 深度 k = log_b n', ''); },
  async (S) => { S.eq('節點數 = 分支數 ^ 深度'); say('最底層的節點數 = 分支數的「深度」次方', ''); },
  async (S) => { S.eq('分支數 = a'); say('每個問題分成 a 個 → 分支數是 a', ''); },
  async (S) => { S.eq('a^(log_b n)'); say('= a^(log_b n)', ''); },
  async (S) => { S.eq('= n^(log_b a)', 'good'); say('a^(log_b n) = n^(log_b a)', '兩個可以互換'); await S.talk('記住這個', 'wow', true); },
  async (S) => { S.eq('遞迴部分的複雜度 = n^(log_b a)', 'good'); say('這就是遞迴部分的複雜度', ''); },
]);
sc('algbari3-mtx-cases', '三種情況：誰主導', (S) => { S.cam(); S.board(-7.3, 7.6, 0.56); S.scale(3.4, 2.6); S.pans('n^(log_b a)', 'f(n)'); S.guide(); say('遞迴 vs 非遞迴', ''); }, [
  async (S) => { txt(S.sc.card, '誰比較重？'); say('比較遞迴部分與非遞迴部分誰主導', '分成三種情況'); },
  async (S) => { S.eq('Case 1：遞迴部分主導'); await S.tilt(1.5); txt(S.sc.cs, 'Case 1：遞迴那邊重'); say('Case 1：遞迴部分明顯比較大', ''); },
  async (S) => { S.eq('　f(n) 比 n^(log_b a) 小一個多項式倍', 'note'); say('f(n) 比 n^(log_b a) 小一個多項式倍', ''); },
  async (S) => { S.eq('　→ Θ(n^(log_b a))'); txt(S.sc.ans, 'Θ(n^(log_b a))'); say('→ Θ(n^(log_b a))', ''); },
  async (S) => { S.eq('Case 2：兩邊同階'); await S.tilt(0); txt(S.sc.cs, 'Case 2：一樣重'); txt(S.sc.ans, ' '); say('Case 2：兩邊成長一樣快', ''); },
  async (S) => { S.eq('　（或只多一個 log 因子）', 'note'); say('或 f(n) 只多一個 log 因子', 'log 比線性快，但比多項式慢'); },
  async (S) => { S.eq('　→ Θ(n^(log_b a) · logᵏ⁺¹ n)'); txt(S.sc.ans, 'Θ(n^(log_b a)·logᵏ⁺¹ n)'); say('兩邊都要算 → Θ(n^(log_b a)·logᵏ⁺¹ n)', '每層都有一份 log'); },
  async (S) => { S.eq('Case 3：f(n) 至少大一個多項式倍'); await S.tilt(-1.5); txt(S.sc.cs, 'Case 3：f(n) 那邊重'); txt(S.sc.ans, ' '); say('Case 3：非遞迴部分大一個多項式倍', ''); },
  async (S) => { S.eq('　要驗證 regularity condition', 'note'); say('還要驗證 regularity condition', 'a·f(n/b) ≤ c·f(n)，c < 1'); await S.talk('多一道檢查', 'wow'); },
  async (S) => { S.eq('　→ Θ(f(n))'); txt(S.sc.ans, 'Θ(f(n))'); say('成立 → Θ(f(n))', '非遞迴部分主導'); },
]);
sc('algbari3-mtx-examples', '例題：binary search、merge sort…', mtSetup('套用 Master Theorem'), [
  async (S) => { txt(S.sc.card, '套用到幾個遞迴式'); say('來解幾個遞迴式', ''); },
  async (S) => { txt(S.sc.card, 'Binary search：T(n) = T(n/2) + 1'); S.pans('n^(log₂1) = 1', 'f(n) = 1'); say('Binary search：T(n/2) + 1', ''); },
  async (S) => { await S.tilt(0); txt(S.sc.cs, 'Case 2（k = 0）'); say('兩邊都是常數 → Case 2', '沒有 log 因子：k = 0'); },
  async (S) => { txt(S.sc.ans, 'Θ(log n)'); S.histAdd('T(n/2) + 1 → Θ(log n)'); say('→ Θ(log n)', ''); },
  async (S) => { txt(S.sc.card, 'Merge sort：T(n) = 2T(n/2) + n'); S.pans('n^(log₂2) = n', 'f(n) = n'); txt(S.sc.ans, ' '); say('Merge sort：2T(n/2) + n', ''); },
  async (S) => { txt(S.sc.cs, 'Case 2（k = 0）'); txt(S.sc.ans, 'Θ(n log n)'); S.histAdd('2T(n/2) + n → Θ(n log n)'); say('同階 → Case 2 → Θ(n log n)', ''); },
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/2) + n log n'); S.pans('n', 'n log n'); txt(S.sc.ans, ' '); await S.tilt(-0.4); txt(S.sc.cs, '只多一個 log 因子'); say('f(n) 多一個 log 因子（推測：2T(n/2) + n log n）', ''); },
  async (S) => { await S.tilt(0); txt(S.sc.cs, 'Case 2（k = 1）'); txt(S.sc.ans, 'Θ(n log² n)'); S.histAdd('2T(n/2) + n log n → Θ(n log² n)'); say('Case 2，k = 1 → Θ(n log² n)', ''); },
  async (S) => { txt(S.sc.card, 'T(n) = 2T(n/4) + n^0.51'); S.pans('n^(log₄2) = n^0.5', 'n^0.51'); txt(S.sc.ans, ' '); await S.tilt(-0.6); txt(S.sc.cs, '只大一點點，但 n 大時會贏'); say('最後一題（推測）：2T(n/4) + n^0.51', 'n^0.5 vs n^0.51'); },
  async (S) => { txt(S.sc.cs, 'Case 3：regularity ✓'); say('Case 3：regularity condition 成立', '2·(n/4)^0.51 ≤ c·n^0.51'); },
  async (S) => { txt(S.sc.ans, 'Θ(n^0.51)'); S.histAdd('2T(n/4) + n^0.51 → Θ(n^0.51)'); say('→ Θ(n^0.51)', ''); await S.talk('四題都解完', 'happy', true); },
]);
  }
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
