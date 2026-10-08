// 資料結構 第1章：複雜度分析（Big-O / Θ / Ω、遞迴分析、Master Theorem）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const fmtNum = (x) => !isFinite(x) ? '∞' : x >= 1e15 ? x.toExponential(1) : x >= 1e6 ? (x / 1e6).toFixed(1) + ' 百萬' : x >= 1e4 ? Math.round(x).toLocaleString() : (Math.round(x * 10) / 10).toString();

  // ───────────────────────── 成長賽跑 ─────────────────────────
  const FUNCS = [
    { id: 'log', name: 'log n', f: (n) => Math.log2(Math.max(n, 1)), color: '#2fc092' },
    { id: 'n', name: 'n', f: (n) => n, color: '#4b9ee2' },
    { id: 'nlog', name: 'n log n', f: (n) => n * Math.log2(Math.max(n, 1)), color: '#9b7ef4' },
    { id: 'n2', name: 'n²', f: (n) => n * n, color: '#dd8238' },
    { id: '2n', name: '2ⁿ', f: (n) => Math.pow(2, n), color: '#d64545' },
  ];
  const race = { n: 1, bars: [], vals: [], cap: 400, logScale: false };
  const BAR_MAX = 9; // world units for the tallest visible bar
  function barHeight(v) {
    if (race.logScale) return Math.max(0.05, Math.log10(v + 1) / Math.log10(1e18) * BAR_MAX);
    return Math.max(0.05, Math.min(v, race.cap) / race.cap * BAR_MAX);
  }
  function enterRace() {
    stopTimer();
    lab.clear();
    race.bars = []; race.vals = [];
    lab.frameCamera([0, 6, 17], [0, 4, 0]);
    FUNCS.forEach((fn, i) => {
      const x = (i - 2) * 2.4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), new THREE.MeshStandardMaterial({ color: fn.color, roughness: 0.5 }));
      m.castShadow = true;
      m.position.set(x, 0.5, 0);
      lab.world.add(m);
      const name = lab.label(fn.name, 'ptr');
      name.position.set(x, -0.2, 1.4);
      lab.world.add(name);
      const val = lab.label('', 'idx');
      lab.world.add(val);
      race.bars.push({ m, val, x, fn, h: 0.05 });
    });
    // the "chart ceiling" line
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: '#c9b48e' }));
    ceil.position.set(0, BAR_MAX, -0.8);
    lab.world.add(ceil);
    const cl = lab.label('畫面上限', 'idx');
    cl.position.set(6.8, BAR_MAX, -0.8);
    lab.world.add(cl);
    race.ceilLabel = cl;
    controls(
      '<label>n = <input id="rN" type="range" min="1" max="64" value="1" style="width:200px"></label> <b id="rNv">1</b>'
      + '<button class="primary" id="rPlay">自動跑</button><button id="rLog">切換對數尺度</button>'
    );
    $('rN').oninput = (e) => setN(Number(e.target.value));
    on('rPlay', () => {
      stopTimer();
      race.n = 1;
      timer = setInterval(() => { if (race.n >= 40) stopTimer(); else setN(race.n + 1); }, 160);
    });
    on('rLog', () => { race.logScale = !race.logScale; cl.element.textContent = race.logScale ? '10¹⁸' : '畫面上限'; setN(race.n); });
    log('拖動 n，看五種成長速度：小的時候差不多，n 一大就天差地遠。');
    setN(1);
  }
  function setN(n) {
    race.n = n;
    if ($('rN')) { $('rN').value = n; $('rNv').textContent = n; }
    race.bars.forEach((b) => {
      const v = b.fn.f(n);
      const h = barHeight(v);
      b.h = h;
      b.m.scale.y = h;
      b.m.position.y = h / 2;
      const over = !race.logScale && v > race.cap;
      b.m.material.emissive = new THREE.Color(over ? '#5a1010' : '#000000');
      b.val.element.textContent = (over ? '爆表 ' : '') + fmtNum(v);
      b.val.position.set(b.x, h + 0.5, 0);
    });
    const ns = (v) => v * 1e-9; // 1 ns per step
    const t2 = ns(Math.pow(2, n));
    setState('n = ' + n + ' 時要做幾步', FUNCS.map((fn) => [fn.name, fmtNum(fn.f(n))]),
      '假設一步 1 奈秒：2ⁿ 需要 ' + (t2 < 1 ? (t2 * 1e3).toFixed(3) + ' 毫秒' : t2 < 3600 ? t2.toFixed(1) + ' 秒' : t2 < 3.15e7 ? (t2 / 3600).toFixed(1) + ' 小時' : (t2 / 3.15e7).toExponential(1) + ' 年')
      + '<br>順序：log n &lt; n &lt; n log n &lt; n² &lt; 2ⁿ');
  }

  // ───────────────────────── 迴圈計數 ─────────────────────────
  const LOOPS = {
    single: { code: 'for (i = 0; i < n; i++)\n  sum++;', count: (n) => n, formula: 'n', big: 'O(n)' },
    nested: { code: 'for (i = 0; i < n; i++)\n  for (j = 0; j < n; j++)\n    sum++;', count: (n) => n * n, formula: 'n · n = n²', big: 'O(n²)' },
    tri: { code: 'for (i = 0; i < n; i++)\n  for (j = 0; j < i; j++)\n    sum++;', count: (n) => n * (n - 1) / 2, formula: '0+1+…+(n−1) = n(n−1)/2', big: 'O(n²)' },
    double: { code: 'for (i = 1; i < n; i *= 2)\n  sum++;', count: (n) => Math.ceil(Math.log2(n)), formula: 'i = 1,2,4,8… 走 ⌈log₂ n⌉ 次', big: 'O(log n)' },
    sqrt: { code: 'for (i = 1, p = 0; p < n; i++)\n  p += i;', count: (n) => { let p = 0, k = 0; while (p < n) { k++; p += k; } return k; }, formula: 'p = 1+2+…+k ≥ n → k ≈ √(2n)', big: 'O(√n)' },
  };
  const loop = { kind: 'nested', n: 8, cubes: [], running: false };
  function enterLoop() {
    stopTimer();
    lab.clear();
    loop.cubes = [];
    lab.frameCamera([0, 9, 13], [0, 1.5, 0]);
    // a floor grid of slots: n × n, so you can see how much of it fills up
    controls(
      '<select id="lKind"><option value="single">單層迴圈</option><option value="nested">雙層迴圈</option><option value="tri">三角形雙層（j &lt; i）</option><option value="double">i *= 2</option><option value="sqrt">p += i</option></select>'
      + '<label>n = <input id="lN" type="number" min="2" max="12" value="' + loop.n + '"></label>'
      + '<button class="primary" id="lRun">執行並計數</button>'
    );
    $('lKind').value = loop.kind;
    $('lKind').onchange = (e) => { loop.kind = e.target.value; enterLoop(); };
    $('lN').onchange = (e) => { loop.n = Math.max(2, Math.min(12, Number(e.target.value) || 8)); enterLoop(); };
    on('lRun', () => runLoop());
    const L = LOOPS[loop.kind];
    log('程式碼：\n' + L.code.replace(/\n/g, '  ⏎ '));
    renderLoopState(0);
  }
  function cellPos(i, n) {
    const cols = n;
    const r = Math.floor(i / cols), c = i % cols;
    return new THREE.Vector3((c - (cols - 1) / 2) * 0.9, 0.35, (r - (n - 1) / 2) * 0.9);
  }
  async function runLoop(tok) {
    if (loop.running) return;
    loop.running = true;
    loop.cubes.forEach((b) => lab.removeBody(b));
    loop.cubes = [];
    const L = LOOPS[loop.kind];
    const n = loop.n;
    const total = L.count(n);
    const delay = Math.max(25, Math.min(220, 2400 / Math.max(total, 1)));
    try {
      for (let k = 0; k < total; k++) {
        const m = lab.box('#4b9ee2', [0.75, 0.6, 0.75]);
        const p = cellPos(k, Math.max(n, Math.ceil(Math.sqrt(total))));
        m.position.set(p.x, 7, p.z);
        const b = lab.addBody(m);
        lab.dropTo(b, p);
        loop.cubes.push(b);
        renderLoopState(k + 1);
        if (tok !== undefined) await beat(tok, delay); else await sleep(delay);
      }
      log('n = ' + n + ' 時共執行 ' + total + ' 次 → ' + L.big);
    } finally { loop.running = false; }
  }
  function renderLoopState(k) {
    const L = LOOPS[loop.kind];
    setState('迴圈計數', [['程式碼', L.code.split('\n')[0] + (L.code.includes('\n  for') ? ' …' : '')], ['n', String(loop.n)], ['已執行', String(k)], ['公式', L.formula]],
      '一顆方塊 = sum++ 執行一次<br>總次數 = ' + L.count(loop.n) + ' → <span class="ok">' + L.big + '</span>');
  }

  // ───────────────────────── Big-O 定義 ─────────────────────────
  // f(n) = a·n + b（預設 3n + 10），g(n) = n：找 c 和 n0 使 n ≥ n0 時 f(n) ≤ c·g(n)
  const bigo = { c: 2, n0: 5, fa: 3, fb: 10, fLine: null, gLine: null, marker: null, kind: 'O' };
  const SX = 0.55, SY = 0.09, NMAX = 22; // world scale for the plot
  const F = (n) => bigo.fa * n + bigo.fb;
  const fName = () => bigo.fa + 'n + ' + bigo.fb;
  function linePoints(fn) {
    const pts = [];
    for (let n = 0; n <= NMAX; n += 0.25) pts.push(new THREE.Vector3((n - NMAX / 2) * SX, Math.min(fn(n) * SY, 10), 0));
    return pts;
  }
  function makeLine(fn, color) {
    const g = new THREE.BufferGeometry().setFromPoints(linePoints(fn));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
    lab.world.add(l);
    return l;
  }
  function plotAxes() {
    const ax = new THREE.Mesh(new THREE.BoxGeometry(NMAX * SX + 0.4, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
    ax.position.set(0, 0, 0); lab.world.add(ax);
    const ay = new THREE.Mesh(new THREE.BoxGeometry(0.04, 10, 0.04), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
    ay.position.set(-NMAX / 2 * SX, 5, 0); lab.world.add(ay);
    const xl = lab.label('n', 'idx'); xl.position.set(NMAX / 2 * SX + 0.5, 0, 0); lab.world.add(xl);
  }
  function enterBigO() {
    stopTimer();
    lab.clear();
    lab.frameCamera([0, 5, 15], [0, 4.5, 0]);
    plotAxes();
    bigo.fLine = makeLine(F, '#d64545');
    bigo.gLine = makeLine((n) => bigo.c * n, '#2fc092');
    const fl = lab.label('f(n) = ' + fName(), 'ptr'); fl.position.set(NMAX / 2 * SX - 1.5, Math.min(F(NMAX) * SY, 10) + 0.6, 0); lab.world.add(fl);
    bigo.gl = lab.label('', 'ptr alt'); lab.world.add(bigo.gl);
    bigo.marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 10, 0.05), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    lab.world.add(bigo.marker);
    bigo.ml = lab.label('', 'idx'); lab.world.add(bigo.ml);
    bigo.zone = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.02), new THREE.MeshBasicMaterial({ color: '#2fc092', transparent: true, opacity: 0.08 }));
    lab.world.add(bigo.zone);
    controls(
      '<label>c = <input id="bC" type="range" min="1" max="8" step="0.5" value="' + bigo.c + '" style="width:130px"></label> <b id="bCv"></b>'
      + '<label>n₀ = <input id="bN" type="range" min="0" max="20" value="' + bigo.n0 + '" style="width:130px"></label> <b id="bNv"></b>'
    );
    $('bC').oninput = (e) => { bigo.c = Number(e.target.value); updateBigO(); };
    $('bN').oninput = (e) => { bigo.n0 = Number(e.target.value); updateBigO(); };
    log('Big-O 的定義：存在常數 c > 0 和 n₀，使得所有 n ≥ n₀ 都有 f(n) ≤ c·g(n)。');
    log('調 c 和 n₀，讓綠線在黃色直線右邊永遠壓在紅線上面。');
    updateBigO();
  }
  function updateBigO() {
    bigo.gLine.geometry.setFromPoints(linePoints((n) => bigo.c * n));
    const x0 = (bigo.n0 - NMAX / 2) * SX;
    bigo.marker.position.set(x0, 5, 0);
    bigo.ml.element.textContent = 'n₀ = ' + bigo.n0;
    bigo.ml.position.set(x0, -0.5, 0);
    const w = (NMAX - bigo.n0) * SX;
    bigo.zone.scale.x = Math.max(0.01, w);
    bigo.zone.position.set(x0 + w / 2, 5, -0.05);
    bigo.gl.element.textContent = 'c·g(n) = ' + bigo.c + 'n';
    bigo.gl.position.set(NMAX / 2 * SX - 1.5, Math.min(bigo.c * NMAX * SY, 10) + 0.6, 0);
    let ok = true;
    for (let n = bigo.n0; n <= NMAX * 4; n += 0.5) if (F(n) > bigo.c * n) { ok = false; break; }
    if ($('bCv')) { $('bCv').textContent = bigo.c; $('bNv').textContent = bigo.n0; }
    bigo.zone.material.color.set(ok ? '#2fc092' : '#d64545');
    setState('f(n) = ' + fName() + ' 是不是 O(n)？', [['c', String(bigo.c)], ['n₀', String(bigo.n0)], ['n ≥ n₀ 時 f ≤ c·n', ok ? '成立' : '不成立']],
      ok ? '<span class="ok">找到了</span>：c = ' + bigo.c + '、n₀ = ' + bigo.n0 + ' 讓 ' + fName() + ' ≤ ' + bigo.c + 'n → f(n) = O(n)'
        : (bigo.c <= bigo.fa ? '<span class="no">c ≤ ' + bigo.fa + ' 永遠追不上</span>：' + fName() + ' 斜率是 ' + bigo.fa + '，c 要大於 ' + bigo.fa : '<span class="no">n₀ 太小</span>：交點在 n = ' + (bigo.fb / (bigo.c - bigo.fa)).toFixed(1) + '，n₀ 要往右'));
    return ok;
  }

  // ───────────────────────── 遞迴樹 ─────────────────────────
  const TREES = {
    merge: { a: 2, b: 2, k: 1, name: 'T(n) = 2T(n/2) + n', note: '每層總成本都是 n，共 log n 層 → Θ(n log n)' },
    leaf: { a: 2, b: 2, k: 0, name: 'T(n) = 2T(n/2) + 1', note: '越往下越多，葉子主導 → Θ(n)' },
    root: { a: 1, b: 2, k: 1, name: 'T(n) = T(n/2) + n', note: '越往下越少，根主導 → Θ(n)' },
    four: { a: 4, b: 2, k: 1, name: 'T(n) = 4T(n/2) + n', note: '每層成本翻倍，葉子主導 → Θ(n²)' },
  };
  const tree = { kind: 'merge', n: 16 };
  async function enterTree(tok) {
    stopTimer();
    lab.clear();
    lab.frameCamera([0, 5, 19], [0, 3.5, 0]);
    if (tok === undefined) {
      controls('<select id="tKind">' + Object.keys(TREES).map((k) => '<option value="' + k + '">' + TREES[k].name + '</option>').join('') + '</select><button class="primary" id="tGrow">一層一層長出來</button>');
      $('tKind').value = tree.kind;
      $('tKind').onchange = (e) => { tree.kind = e.target.value; enterTree(); };
      on('tGrow', () => growTree());
    }
    const T = TREES[tree.kind];
    log(T.name + '：每個節點寫的是「這一層這一塊要花的成本」。');
    setState('遞迴樹 ' + T.name, [['a（分幾塊）', String(T.a)], ['b（每塊變 1/b）', String(T.b)], ['每塊額外成本', T.k ? 'n' : '1']], '按「一層一層長出來」');
    if (tok !== undefined) await growTree(tok);
  }
  async function growTree(tok) {
    const T = TREES[tree.kind];
    lab.clear();
    const levels = Math.round(Math.log(tree.n) / Math.log(T.b));
    const rows = [];
    let total = 0;
    for (let d = 0; d <= levels; d++) {
      const count = Math.pow(T.a, d);
      const size = tree.n / Math.pow(T.b, d);
      const each = T.k ? size : 1;
      const levelCost = count * each;
      total += levelCost;
      const shown = Math.min(count, 16);
      const width = 13;
      const y = 7.5 - d * (7.5 / Math.max(levels, 1));
      for (let i = 0; i < shown; i++) {
        const x = shown === 1 ? 0 : (i / (shown - 1) - 0.5) * width * Math.min(1, shown / 8 + 0.25);
        const w = Math.max(0.18, Math.min(1.6, (T.k ? size / tree.n : 1 / Math.max(count, 1)) * 3 + 0.18));
        const m = lab.box(d === levels ? '#9b7ef4' : '#4b9ee2', [w, 0.45, 0.6]);
        m.position.set(x, y + 4, 0);
        const b = lab.addBody(m);
        lab.dropTo(b, new THREE.Vector3(x, y, 0));
        if (shown <= 8) { const l = lab.label(T.k ? fmtNum(size) : '1', 'idx'); l.position.set(0, 0.45, 0); m.add(l); }
      }
      if (count > shown) { const l = lab.label('…共 ' + count + ' 個', 'idx'); l.position.set(width / 2 + 0.8, y, 0); lab.world.add(l); }
      const lc = lab.label('第 ' + d + ' 層：' + fmtNum(levelCost), d === levels ? 'ptr alt' : 'ptr');
      lc.position.set(-8.6, y, 0);
      lab.world.add(lc);
      rows.push(['第 ' + d + ' 層', count + ' 塊 × ' + fmtNum(each) + ' = ' + fmtNum(levelCost)]);
      setState('遞迴樹 ' + T.name, rows, '目前總和 = ' + fmtNum(total));
      say('第 ' + d + ' 層：' + count + ' 塊，每塊 ' + fmtNum(each) + ' → 這層 ' + fmtNum(levelCost), '總和 ' + fmtNum(total));
      if (tok !== undefined) await beat(tok, 1300); else await sleep(700);
    }
    setState('遞迴樹 ' + T.name, rows, '總和 = ' + fmtNum(total) + '（n = ' + tree.n + '）<br><span class="ok">' + T.note + '</span>');
    say(T.note, '總和 = ' + fmtNum(total));
    log(T.note);
  }

  // ───────────────────────── Master Theorem ─────────────────────────
  // T(n) = aT(n/b) + Θ(n^k)：比較 n^(log_b a) 和 n^k
  const mt = { a: 2, b: 2, k: 1 };
  function enterMaster() {
    stopTimer();
    lab.clear();
    lab.frameCamera([0, 5, 14], [0, 3.5, 0]);
    mt.left = lab.box('#9b7ef4', [2.4, 1, 2]); mt.right = lab.box('#dd8238', [2.4, 1, 2]);
    mt.left.position.set(-2.4, 0.5, 0); mt.right.position.set(2.4, 0.5, 0);
    lab.world.add(mt.left, mt.right);
    mt.ll = lab.label('', 'ptr'); mt.rl = lab.label('', 'ptr alt');
    lab.world.add(mt.ll, mt.rl);
    controls('T(n) = <input id="mA" type="number" min="1" max="16" value="' + mt.a + '">T(n / <input id="mB" type="number" min="2" max="8" value="' + mt.b + '">) + n^<input id="mK" type="number" min="0" max="4" step="0.5" value="' + mt.k + '">');
    ['mA', 'mB', 'mK'].forEach((id) => { $(id).oninput = () => { mt.a = Number($('mA').value) || 1; mt.b = Math.max(2, Number($('mB').value) || 2); mt.k = Number($('mK').value) || 0; updateMaster(); }; });
    log('Master Theorem：比較「葉子的總工作量 n^(log_b a)」和「每層額外的工作 f(n) = n^k」誰比較大。');
    updateMaster();
  }
  function masterCase(a, b, k) {
    const e = Math.log(a) / Math.log(b);
    const eq = Math.abs(e - k) < 1e-9;
    if (eq) return { e, c: 2, ans: 'Θ(n^' + k + ' log n)', why: '兩邊一樣大：每層成本一樣，乘上 log n 層' };
    if (e > k) return { e, c: 1, ans: 'Θ(n^' + (+e.toFixed(3)) + ')', why: '葉子比較大：工作集中在最底層' };
    return { e, c: 3, ans: 'Θ(n^' + k + ')', why: 'f(n) 比較大：工作集中在根（要再檢查 regularity：a·f(n/b) ≤ c·f(n)）' };
  }
  function updateMaster() {
    const r = masterCase(mt.a, mt.b, mt.k);
    const hl = 1 + r.e * 2.2, hr = 1 + mt.k * 2.2;
    mt.left.scale.y = hl; mt.left.position.y = hl / 2;
    mt.right.scale.y = hr; mt.right.position.y = hr / 2;
    mt.ll.element.textContent = 'n^log_' + mt.b + ' ' + mt.a + ' = n^' + (+r.e.toFixed(3));
    mt.rl.element.textContent = 'f(n) = n^' + mt.k;
    mt.ll.position.set(-2.4, hl + 0.6, 0); mt.rl.position.set(2.4, hr + 0.6, 0);
    mt.left.material.emissive = new THREE.Color(r.c === 1 ? '#2a1a50' : '#000');
    mt.right.material.emissive = new THREE.Color(r.c === 3 ? '#4a2000' : '#000');
    setState('Master Theorem', [['a, b, k', mt.a + ', ' + mt.b + ', ' + mt.k], ['log_b a', (+r.e.toFixed(3)).toString()], ['情況', '第 ' + r.c + ' 種']],
      'T(n) = <span class="ok">' + r.ans + '</span><br>' + r.why);
    return r;
  }

  // ───────────────────────── 文字頁：小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const pick = Math.random();
    if (pick > 0.85) {
      const n = 5 + Math.floor(Math.random() * 40);
      return { q: '用 for 迴圈逐一掃描找 ' + n + ' 個數的最小值要比較幾次？兩兩淘汰賽呢？', opts: ['都是 ' + (n - 1) + ' 次', '都是 ' + n + ' 次', (n - 1) + ' 次 vs 約 ' + Math.ceil(Math.log2(n)) + ' 次', n + ' 次 vs ' + (n - 1) + ' 次'], ans: '都是 ' + (n - 1) + ' 次', why: '每次比較淘汰一個，要淘汰 n − 1 個；淘汰賽只是能平行成約 ⌈log₂n⌉ 輪，比較次數一樣。' };
    }
    if (pick > 0.72) {
      const n = 3 + Math.floor(Math.random() * 30);
      return { q: '加總程式 for (i = 0; i < n; i++) tempsum += list[i]; 在 n = ' + n + ' 時，for 標頭那行執行幾次？整個程式（float tempsum = 0、迴圈、return）共幾步？', opts: [(n + 1) + ' 次；' + (2 * n + 3) + ' 步', n + ' 次；' + (2 * n + 2) + ' 步', (n + 1) + ' 次；' + (2 * n + 1) + ' 步', n + ' 次；' + (2 * n + 3) + ' 步'], ans: (n + 1) + ' 次；' + (2 * n + 3) + ' 步', why: 'for 的判斷比本體多一次（最後一次不成立才結束）：n+1；total = 1 + (n+1) + n + 1 = 2n + 3。' };
    }
    if (pick > 0.6) {
      const n = 5 + Math.floor(Math.random() * 20);
      return { q: '每次呼叫約占 16 bytes，遞迴版 rsum(list, ' + n + ') 在碰到 n == 0 之前，堆疊上最多同時擱著多少 bytes？（迴圈版固定 24 bytes）', opts: [16 * n + ' bytes', '16 bytes', '24 bytes', 16 * n * n + ' bytes'], ans: 16 * n + ' bytes', why: n + ' 號～1 號任務都還沒做完、同時存在，約 16n → O(n)；迴圈版 O(1)。' };
    }
    if (pick < 0.3) {
      const presets = [[2, 2, 1], [4, 2, 1], [1, 2, 0], [8, 2, 2], [9, 3, 1], [3, 2, 2], [2, 4, 0.5], [7, 2, 2]];
      const [a, b, k] = presets[Math.floor(Math.random() * presets.length)];
      const r = masterCase(a, b, k);
      const e = +r.e.toFixed(3);
      const opts = [...new Set(['Θ(n^' + k + ')', 'Θ(n^' + k + ' log n)', 'Θ(n^' + e + ')', 'Θ(n log n)'])].slice(0, 4);
      if (!opts.includes(r.ans)) opts[0] = r.ans;
      return { q: 'T(n) = ' + a + 'T(n/' + b + ') + n^' + k + '，用 Master Theorem 解：', opts, ans: r.ans, why: 'log_' + b + ' ' + a + ' = ' + e + '，和 k = ' + k + ' 比較 → ' + r.why };
    }
    const keys = Object.keys(LOOPS);
    const k = keys[Math.floor(Math.random() * keys.length)];
    const L = LOOPS[k];
    return { q: '這段程式的時間複雜度是？\n' + L.code, opts: ['O(n)', 'O(n²)', 'O(log n)', 'O(√n)'], ans: L.big, why: L.formula };
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

  // ───────────────────────── 跟著影片的場景：共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  // a value cube; dropH > 0 makes it fall into place from that height
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
  // a code / pseudocode panel: one monospace label per line, hl(i) lights the current line
  function code(lines, x, yTop, dy = 0.56, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = h0 + (h - h0) * t; m.scale.y = v; m.position.y = v / 2; }); }
  function line(x1, y1, x2, y2, z = 0, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function ghostBox(color, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    lab.world.add(m); return m;
  }

  // ─── V42FBiohc6c：Ram 與 Shyam 判斷質數 ───
  async function scPrimeTrial(tok) {
    fresh([0, 8.5, 12.5], [0, 0.4, 0]);
    tag('Ram：i = 2 … n−1', 'ptr', -3.6, 0.2, -3.6);
    tag('Shyam：i = 2 … √n', 'ptr alt', 3.6, 0.2, -3.6);
    const cR = tag('', 'idx', -3.6, 0.2, 3.2), cS = tag('', 'idx', 3.6, 0.2, 3.2);
    const blocks = [];
    async function run(n, sp, cols, ms, showI) {
      const rN = n - 2, sN = Math.floor(Math.sqrt(n)) - 1;
      txt(cR, '除法 0 次'); txt(cS, '除法 0 次');
      for (let k = 0; k < rN; k++) {
        const i = k + 2, col = k % cols, z = -2.6 + Math.floor(k / cols) * sp, sz = [sp * 0.85, 0.36, sp * 0.85];
        blocks.push(cube(showI ? i : '', '#4b9ee2', sz, -6 + col * sp, 0.18, z, 3));
        txt(cR, '除法 ' + (k + 1) + ' 次');
        if (k < sN) { blocks.push(cube(showI ? i : '', '#dd8238', sz, 1.4 + col * sp, 0.18, z, 3)); txt(cS, '除法 ' + (k + 1) + ' 次'); }
        if (showI) say('n = ' + n + '：拿 i = ' + i + ' 去除', n + ' % ' + i + ' = ' + (n % i) + (k < sN ? '（兩人都做）' : '（只有 Ram 做）'));
        await beat(tok, ms);
      }
    }
    say('判斷 n 是不是質數：拿 i 去試除 n', '質數恰有 1 和自己兩個因數；1 不是質數');
    await beat(tok, 2400);
    await run(11, 0.6, 9, 650, true);
    say('n = 11：Ram 除 9 次、Shyam 除 2 次', '最壞情況（n 是質數）：n − 2 次 vs ⌊√n⌋ − 1 次');
    await beat(tok, 2600);
    blocks.splice(0).forEach((m) => fly(m));
    await beat(tok, 900);
    say('n = 101：再比一次', 'Ram 試 2 … 100，Shyam 試 2 … 10');
    await run(101, 0.5, 10, 45, false);
    say('n = 101：99 次 vs 9 次', '一顆方塊 = 一次除法');
    await beat(tok, 2400);
    say('為什麼試到 √n 就夠？', '若 n = a × b，a、b 至少有一個 ≤ √n');
    await beat(tok, 2800);
    say('兩種解法都正確，差在 n 變大後的執行時間', 'Ram ≈ n 次，Shyam ≈ √n 次');
    await beat(tok, 2800);
  }
  async function scPrimeTiming(tok) {
    fresh([0, 4.5, 15], [0, 3.6, 0]);
    const quick = (ctx.params || {}).focus === 'bigo';
    const rows = [['n = 11', 9, 2, '9 ms', '2 ms', 'n = 11：9 ms vs 2 ms，看不出差別'], ['n = 101', 99, 9, '99 ms', '9 ms', 'n = 101：都不到 1 秒，還是看不出來'],
      ['n ≈ 10⁶', 1e6, 1e3, '≈16.7 分', '≈1 秒', 'n ≈ 10⁶：16.7 分鐘 vs 1 秒'], ['n ≈ 10¹⁰', 1e10, 1e5, '>115 天', '≈1.7 分', 'n ≈ 10¹⁰：超過 115 天 vs 1.7 分鐘']];
    tag('藍 = Ram（n−2 次除法）', 'ptr', -3.2, 0, 2.8); tag('橘 = Shyam（√n−1 次）', 'ptr alt', 3.2, 0, 2.8);
    const H = (ms) => 0.25 + Math.log10(ms) * 0.75;
    say('假設電腦做一次除法要 1 ms', '最壞情況：n 是質數，每個 i 都要試');
    await beat(tok, quick ? 2000 : 2400);
    for (let k = 0; k < rows.length; k++) {
      const [nm, r, s, rl, sl, cap] = rows[k];
      const x = -5.1 + k * 3.4;
      tag(nm, 'idx', x, 0, 1.4);
      const br = bar('#4b9ee2', 0.9, 0.9, x - 0.55, 0), bs = bar('#dd8238', 0.9, 0.9, x + 0.55, 0);
      if (!quick) say(cap, '高度是對數尺度：每高一格 ×10');
      await growBar(tok, br, H(r), quick ? 250 : 700);
      tag(rl, 'idx', x - 0.55, H(r) + 0.4);
      await growBar(tok, bs, H(s), quick ? 200 : 450);
      tag(sl, 'idx', x + 0.55, H(s) + 0.4);
      await beat(tok, quick ? 300 : 1500);
    }
    say('輸入小時看不出差別；n 很大時差距爆炸', '比較演算法要看 n 很大時的表現');
    await beat(tok, 2600);
    say('Ram 的時間 ∝ n → O(n)；Shyam ∝ √n → O(√n)', 'Big-O 丟掉 −2、−1 和「1 ms」這種常數');
    await beat(tok, quick ? 5600 : 3200);
  }

  // ─── d-PDYIqg_Kc：空間複雜度（迴圈求和 vs 遞迴求和） ───
  const RL = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  async function scSpaceLoop(tok) {
    fresh([0, 6, 14], [0, 2.6, 0]);
    const cd = code(['int sum(int arr[], int len) {', '  int total = 0;', '  for (int i = 0; i < len; i++)', '    total += arr[i];', '  return total;', '}'], -2.6, 6.8);
    say('把 array 裡的數字全部加起來', '要多花多少「額外」空間？');
    const data = lab.box('#c9b48e', [1, 0.5, 0.9]); data.scale.x = 0.01; data.position.set(0, 0.25, 2.4); lab.world.add(data);
    const dl = tag('', 'idx', 0, 0, 3.3);
    await anim(tok, 600, (t) => { data.scale.x = 3 * t; });
    txt(dl, '資料 20 筆：輸入已經放好了，不算');
    await beat(tok, 1600);
    const VARS = [['arr 指標', 8, 0], ['len', 4, 0], ['total', 4, 1], ['i', 4, 2], ['回傳值', 4, 4]];
    let bytes = 0; const vm = [];
    for (const [nm, b, ln] of VARS) {
      cd.hl(ln); bytes += b;
      const x = 2.2 + vm.length * 0.95;
      vm.push(cube(b + 'B', '#9b7ef4', [0.8, 0.7, 0.8], x, 0.35, -0.6, 4));
      tag(nm, 'idx', x, 0, 0.3);
      say('變數 ' + nm + '：' + b + ' bytes', '目前額外空間 = ' + bytes + ' bytes');
      await beat(tok, 1000);
    }
    cd.hl(-1);
    tag('額外空間 = 24 bytes', 'ptr alt', 4.1, 1.5, -0.6);
    say('合計約 24 bytes（某個系統上，依系統而定）', 'pointer 8 + 4 個 int × 4 = 24');
    await beat(tok, 2400);
    for (const [N, w] of [[200, 6], [2000, 9], [20000, 12]]) {
      const w0 = data.scale.x;
      await anim(tok, 500, (t) => { data.scale.x = w0 + (w - w0) * t; });
      txt(dl, '資料 ' + N.toLocaleString() + ' 筆（長度不按比例）');
      vm.forEach((m) => glow(m, GOLD));
      say('資料變成 ' + N.toLocaleString() + ' 筆', '額外空間還是 24 bytes');
      await beat(tok, 1400);
      vm.forEach((m) => glow(m, null));
    }
    say('額外空間跟資料量無關 → O(1)', 'S(n) = 24 bytes，不論 n 多大');
    await beat(tok, 3000);
  }
  async function scRecTwoParts(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    const cd = code(['int rsum(int list[], int n) {', '  if (n == 0) return 0;', '  return rsum(list, n-1) + list[n-1];', '}'], 0, 6.6);
    const cs = RL.map((v, k) => { tag('[' + k + ']', 'idx', -4.5 + k, 0, 0.9); return cube(v, '#4b9ee2', [0.8, 0.7, 0.8], -4.5 + k, 0.35, 0); });
    const br = ghostBox('#4b9ee2', 1.2, 1.2);
    const bl = tag('', 'ptr', 0, 1.5), ll = tag('', 'ptr alt', 0, 2.2);
    function show(n) {
      cs.forEach((m, k) => { glow(m, k === n - 1 ? GOLD : null); m.position.y = k === n - 1 ? 0.75 : 0.35; tint(m, k < n ? '#4b9ee2' : GRAY); });
      br.visible = n > 1; showL(bl, n > 1); showL(ll, n > 0);
      if (n > 1) { br.scale.x = n - 1; br.position.set(-4.5 + (n - 2) / 2, 0.55, 0); bl.position.set(-4.5 + (n - 2) / 2, 1.5, 0); txt(bl, 'rsum(list, ' + (n - 1) + ')'); }
      if (n > 0) { ll.position.set(-4.5 + n - 1, 2.2, 0); txt(ll, '+ list[' + (n - 1) + ']'); }
    }
    show(10); cd.hl(2);
    say('遞迴式：10 個數的和 = 前 9 個的和 + 最後一個', 'rsum(list, 10) = rsum(list, 9) + list[9]');
    await beat(tok, 3000);
    say('前 9 個：長得一樣、但比較小的問題', '額外運算：再加上 list[9] = 3');
    await beat(tok, 2400);
    for (let n = 9; n >= 1; n--) {
      show(n);
      say('再拆：' + n + ' 個 → ' + (n - 1) + ' 個 + 最後一個', 'rsum(list, ' + n + ') = rsum(list, ' + (n - 1) + ') + ' + RL[n - 1]);
      await beat(tok, 650);
    }
    show(0); cd.hl(1);
    say('終止條件：n == 0 時直接回傳 0', 'if (n == 0) return 0;');
    await beat(tok, 2600);
    cd.hl(-1); Object.assign(cd.ls[1].element.style, { textDecoration: 'line-through', opacity: '0.45' });
    say('如果沒有終止條件呢？', '');
    await beat(tok, 1300);
    for (let n = -1; n >= -6; n--) {
      const g = cube('n=' + n, '#d64545', [0.8, 0.6, 0.8], -5.7, 0.3, 0, 3);
      say('10 → 9 → … → 0 → ' + n + '：停不下來', 'list[' + (n - 1) + '] 根本不存在');
      await beat(tok, 450);
      fly(g, V3(-2, 7, 3));
    }
    Object.assign(cd.ls[1].element.style, { textDecoration: '', opacity: '' });
    cd.hl(1);
    say('遞迴兩要素：遞迴式 + 終止條件', 'recursive formula + terminating condition；迴圈重複指令，遞迴重複函數呼叫');
    await beat(tok, 3200);
  }
  async function scRecStack(tok) {
    fresh([0, 5, 15], [0, 3.2, 0]);
    cube('24B', '#9b7ef4', [1.6, 1, 1.4], -4.6, 0.5, 0);
    tag('迴圈版 sum()', 'ptr', -4.6, 1.6); tag('不論 n 多大都 24 bytes', 'idx', -4.6, 0, 1.3);
    tag('遞迴版 rsum 的呼叫', 'ptr alt', 1.8, 6.9);
    const cnt = tag('擱著的任務：0 bytes', 'ptr', 5.6, 2.6);
    say('rsum 看起來只有 list、n、回傳值：約 16 bytes', '比迴圈版的 24 bytes 還少？');
    await beat(tok, 2600);
    const frames = [];
    for (let n = 10; n >= 1; n--) {
      const k = 10 - n;
      frames.push(cube('rsum(n=' + n + ')  16B', '#4b9ee2', [3.4, 0.5, 1.4], 1.8, 0.27 + k * 0.56, 0, 3));
      txt(cnt, '擱著的任務：' + 16 * (k + 1) + ' bytes');
      say(n === 10 ? '10 號任務要等 9 號的結果' : n + ' 號任務開始，' + (n + 1) + ' 號還擱在一邊', '同時存在 ' + (k + 1) + ' 份 × 16 bytes');
      await beat(tok, 750);
    }
    const base = tag('rsum(n=0) → return 0', 'ptr alt', 1.8, 6.1);
    say('解到 0 號任務前，10～1 號全都擱著', '16 × 10 = 160 bytes（約 16n）');
    await beat(tok, 2800);
    kill(base);
    let ret = 0;
    for (let n = 1; n <= 10; n++) {
      const prev = ret; ret += RL[n - 1];
      fly(frames.pop(), V3(3, 6, 3));
      txt(cnt, '擱著的任務：' + 16 * frames.length + ' bytes');
      say('rsum(' + n + ') 做完，回傳 ' + ret, prev + ' + list[' + (n - 1) + '] = ' + prev + ' + ' + RL[n - 1] + ' = ' + ret);
      await beat(tok, n === 10 ? 1800 : 520);
    }
    say('n 夠大時，遞迴版反而比迴圈版更耗空間', '遞迴 ≈ 16n bytes → O(n)；迴圈 24 bytes → O(1)');
    await beat(tok, 3400);
  }
  async function scMatrixAdd(tok) {
    fresh([0, 6.5, 12], [0, 1.4, 0]);
    const A = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 1, 2, 3]], B = [[2, 0, 1, 3], [1, 4, 2, 0], [3, 2, 5, 1]];
    const cell = (cx, i, j) => [cx + (j - 1.5) * 0.72, 0.15, (i - 1) * 0.72];
    const am = A.map((r, i) => r.map((v, j) => cube(v, '#4b9ee2', [0.6, 0.3, 0.6], ...cell(-4.4, i, j))));
    const bm = B.map((r, i) => r.map((v, j) => cube(v, '#9b7ef4', [0.6, 0.3, 0.6], ...cell(0, i, j))));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const [x, , z] = cell(4.4, i, j); ctx.tile(V3(x, 0.04, z), 0.6, 0.6); }
    tag('A', 'ptr', -4.4, 0.5, -1.6); tag('B', 'ptr', 0, 0.5, -1.6); tag('C', 'ptr alt', 4.4, 0.5, -1.6);
    tag('+', 'val', -2.2, 0.3); tag('=', 'val', 2.2, 0.3);
    const cd = code(['for (i = 0; i < rows; i++)', '  for (j = 0; j < cols; j++)', '    c[i][j] = a[i][j] + b[i][j];'], 0, 5.6);
    const cost = tag('成本 ≈ 0', 'ptr alt', 0, 3.6);
    say('兩個 dense 矩陣相加，A、B、C 空間都配置好', 'rows = 3、cols = 4，兩層 for 迴圈');
    await beat(tok, 2400);
    for (let i = 0; i < 3; i++) {
      cd.hl(1);
      say('第 ' + (i + 1) + ' 列：內層開始（j = 0 這種只做一次的成本算 q）', '內層每次迭代約花 p 步機器碼');
      await beat(tok, 900);
      for (let j = 0; j < 4; j++) {
        cd.hl(2); glow(am[i][j], GOLD); glow(bm[i][j], GOLD);
        cube(A[i][j] + B[i][j], '#2fc092', [0.6, 0.3, 0.6], ...cell(4.4, i, j), 2.5);
        txt(cost, '這一列：p × ' + (j + 1));
        await beat(tok, 480);
        glow(am[i][j], null); glow(bm[i][j], null);
      }
      txt(cost, '第 ' + (i + 1) + ' 列 ≈ p·cols + q');
      await beat(tok, 700);
    }
    cd.hl(0);
    txt(cost, '總計 ≈ rows·(p·cols + q) + s·rows + t');
    say('外層同理：跟 rows 有關的放 s、無關的放 t', 'p、q、s、t：跟平台有關的常數（CPU 快兩倍，秒數約減半）');
    await beat(tok, 3200);
    cd.hl(-1);
    txt(cost, '差不多 rows × cols');
    say('不管常數：成本差不多是 rows × cols', '跟矩陣元素個數成正比');
    await beat(tok, 3000);
  }

  // ─── 0J2eLvkuF8k：遞迴、排列、效能評估、program step ───
  async function scRecKinds(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    tag('Direct recursion', 'ptr', -3.4, 6.2); tag('Indirect recursion', 'ptr alt', 3.4, 6.2);
    tag('A() { … A(); … }', 'idx', -3.4, 0, 1.4); tag('A() { … B(); … }   B() { … A(); … }', 'idx', 3.4, 0, 1.4);
    say('演算法裡會呼叫自己的步驟 = recursive', '');
    await beat(tok, 1800);
    const L = [], R = [];
    for (let k = 0; k < 4; k++) {
      const last = k === 3;
      L.push(cube(last ? 'A() 停' : 'A()', last ? '#dd8238' : '#4b9ee2', [2.2, 0.6, 1.2], -3.4, 0.32 + k * 0.72, 0, 3));
      say(last ? '碰到 boundary condition：不再呼叫' : 'Direct：A 直接呼叫 A 自己', last ? 'boundary condition 成立 → return' : 'A() → A()');
      await beat(tok, 950);
    }
    for (let k = 0; k < 4; k++) {
      const last = k === 3, nm = k % 2 ? 'B()' : 'A()';
      R.push(cube(last ? nm + ' 停' : nm, last ? '#dd8238' : k % 2 ? '#9b7ef4' : '#4b9ee2', [2.2, 0.6, 1.2], 3.4, 0.32 + k * 0.72, 0, 3));
      say(last ? '一樣要有 boundary condition 才會停' : 'Indirect：A 不直接叫自己，經由 B 再叫回 A', 'A() → B() → A() → B()');
      await beat(tok, 950);
    }
    say('寫遞迴的關鍵：boundary condition，確保會停', '停下來之後，一層一層返回');
    await beat(tok, 2000);
    for (let k = 3; k >= 0; k--) { fly(L[k], V3(-2, 6, 3)); fly(R[k], V3(2, 6, 3)); await beat(tok, 450); }
    say('Direct：自己叫自己；Indirect：繞一圈叫回來', '兩種都要 boundary condition');
    await beat(tok, 2600);
  }
  async function scRecMult(tok) {
    fresh([0, 5, 14], [0, 2.8, 0]);
    let cd = code(['int mult(int a, int b) {', '  if (b == 1) return a;', '  return mult(a, b-1) + a;', '}'], -3.9, 2.1);
    const pos = (k) => [-4.2 + k * 2.8, 5 - k * 1.3];
    async function chain(calls, rets, pace) {
      const fr = [];
      for (let k = 0; k < calls.length; k++) {
        const [x, y] = pos(k), last = k === calls.length - 1;
        fr.push(cube(calls[k][0], last ? '#dd8238' : '#4b9ee2', [2.4, 0.6, 1.1], x, y, 0, 2));
        tag(calls[k][1], 'idx', x, y - 0.65);
        cd.hl(last ? 1 : 2);
        say(calls[k][2], calls[k][3]);
        await beat(tok, pace);
      }
      for (let k = calls.length - 1; k >= 0; k--) {
        const [x, y] = pos(k);
        tag('= ' + rets[k], 'ptr alt', x, y + 0.7);
        glow(fr[k], GREEN); cd.hl(k === calls.length - 1 ? 1 : 2);
        say('帶著結果一路返回', calls[k][4]);
        await beat(tok, pace * 0.8);
      }
    }
    say('遞迴乘法：a × b = a × (b−1) + a', '先把遞迴式寫出來，就成功一半（例：5 × 4）');
    await beat(tok, 2600);
    await chain([
      ['mult(5, 4)', '= mult(5, 3) + 5', 'b 每呼叫一次就減 1', 'mult(5,4) = mult(5,3) + 5', 'mult(5,4) = 15 + 5 = 20'],
      ['mult(5, 3)', '= mult(5, 2) + 5', 'b = 3：繼續拆', 'mult(5,3) = mult(5,2) + 5', 'mult(5,3) = 10 + 5 = 15'],
      ['mult(5, 2)', '= mult(5, 1) + 5', 'b = 2：繼續拆', 'mult(5,2) = mult(5,1) + 5', 'mult(5,2) = 5 + 5 = 10'],
      ['mult(5, 1)', 'b == 1 → return 5', 'boundary condition：b == 1 不能再減', 'b == 1 時直接回傳 a', 'mult(5,1) = 5'],
    ], [20, 15, 10, 5], 1400);
    await beat(tok, 1200);
    fresh([0, 5, 14], [0, 2.8, 0]);
    cd = code(['int sum(int n) {', '  if (n == 1) return 1;', '  return sum(n-1) + n;', '}'], -3.9, 2.1);
    say('1 加到 n 也能寫成遞迴', 'sum(n) = sum(n−1) + n（例：n = 4）');
    await beat(tok, 2000);
    await chain([
      ['sum(4)', '= sum(3) + 4', '(1 加到 3) + 4', 'sum(4) = sum(3) + 4', 'sum(4) = 6 + 4 = 10'],
      ['sum(3)', '= sum(2) + 3', '(1 加到 2) + 3', 'sum(3) = sum(2) + 3', 'sum(3) = 3 + 3 = 6'],
      ['sum(2)', '= sum(1) + 2', '一路展開下去', 'sum(2) = sum(1) + 2', 'sum(2) = 1 + 2 = 3'],
      ['sum(1)', 'n == 1 → return 1', 'boundary condition：n == 1', 'n == 1 時直接回傳 1', 'sum(1) = 1'],
    ], [10, 6, 3, 1], 1000);
    say('但這不是唯一解：公式或 for 迴圈更直接', 'n(n+1)/2；遞迴每次呼叫都要記返回位置（overhead）');
    await beat(tok, 3200);
  }
  async function scBinSearch(tok) {
    fresh([0, 6.5, 13], [0, 2.2, 0]);
    const A = [3, 8, 12, 17, 23, 31, 38, 45, 52, 60], X = 38;
    const xs = (k) => -5.4 + k * 1.2;
    const cs = A.map((v, k) => { tag('[' + k + ']', 'idx', xs(k), 0, 0.95); return cube(v, '#4b9ee2', [1, 0.7, 1], xs(k), 0.35, 0); });
    const cd = code(['while (left <= right) {', '  middle = (left + right) / 2;', '  switch (COMPARE(list[middle], x)) {', '    case -1: left = middle + 1; break;', '    case  0: return middle;', '    case  1: right = middle - 1;', '  }', '}', 'return -1;'], 0, 6.6, 0.48);
    const Lp = tag('left', 'ptr', xs(0), 0, 1.7), Rp = tag('right', 'ptr', xs(9), 0, 2.4), Mp = tag('middle', 'ptr alt', xs(4), 1.4, 0);
    showL(Mp, false);
    say('已排序的陣列中找 x = 38', 'left = 0、right = 9 圍出搜尋範圍');
    await beat(tok, 2400);
    let l = 0, r = 9, cmp = 0;
    while (l <= r) {
      const m = (l + r) >> 1;
      cd.hl(1); showL(Mp, true); move(Mp, xs(m), 1.4, 0); glow(cs[m], GOLD);
      say('middle = (' + l + ' + ' + r + ') / 2 = ' + m, 'list[' + m + '] = ' + A[m] + '，跟 38 比');
      await beat(tok, 1400);
      cmp++;
      if (A[m] < X) {
        cd.hl(3); for (let k = l; k <= m; k++) { tint(cs[k], GRAY); glow(cs[k], null); }
        l = m + 1; move(Lp, xs(l), 0, 1.7);
        say(A[m] + ' < 38：丟掉左半，往右找', 'left = middle + 1 = ' + l);
      } else if (A[m] > X) {
        cd.hl(5); for (let k = m; k <= r; k++) { tint(cs[k], GRAY); glow(cs[k], null); }
        r = m - 1; move(Rp, xs(r), 0, 2.4);
        say(A[m] + ' > 38：丟掉右半，往左找', 'right = middle − 1 = ' + r);
      } else {
        cd.hl(4); glow(cs[m], GREEN); tint(cs[m], '#2fc092');
        say('找到了！只比較 ' + cmp + ' 次', 'return middle = ' + m);
        await beat(tok, 2400);
        break;
      }
      await beat(tok, 1400);
    }
    cd.hl(3);
    say('遞迴版：不用 while，改成呼叫自己', 'case -1: return binsearch(list, x, middle+1, right);');
    await beat(tok, 3000);
    cd.hl(8);
    say('每次範圍砍一半 → 最多約 log₂n 次', 'n = 10 最多比 4 次；找不到就 return −1');
    await beat(tok, 3000);
  }
  async function scPermTree(tok) {
    fresh([0, 5, 15], [0, 3.3, 0]);
    const S = ['a', 'b', 'c'], COL = ['#4b9ee2', '#9b7ef4', '#2fc092'];
    const slotX = (p) => (p - 2) * 1.2;
    const letters = S.map((ch, k) => cube(ch, COL[k], [1, 0.7, 1], slotX(k + 1), 0.35, 2.6));
    [1, 2, 3].forEach((p) => tag('位置 ' + p, 'idx', slotX(p), 0, 3.5));
    const cur = [0, 1, 2];
    const str = () => cur.map((i) => S[i]).join('');
    async function swap(i, j, ms) {
      if (i === j) { glow(letters[cur[i - 1]], GOLD); await beat(tok, ms); glow(letters[cur[i - 1]], null); return; }
      const a = letters[cur[i - 1]], b = letters[cur[j - 1]];
      move(a, slotX(i), 1.3, 2.6); await beat(tok, ms * 0.3);
      move(a, slotX(j), 1.3, 2.6); move(b, slotX(i), 0.35, 2.6); await beat(tok, ms * 0.4);
      move(a, slotX(j), 0.35, 2.6); await beat(tok, ms * 0.3);
      [cur[i - 1], cur[j - 1]] = [cur[j - 1], cur[i - 1]];
    }
    const act = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
    say('輸出 a、b、c 的所有排列', '寫 6 行 cout 是「工人智慧」；字元一多就要靠程式產生');
    await beat(tok, 2400);
    const root = tag('perm(abc, 1, 3)', 'ptr alt', 0, 6.4);
    say('perm(list, 1, 3)：排列範圍是第 1～3 個位置', '第 1 個位置輪流放 a、b、c，剩下的遞迴去排');
    await beat(tok, 2400);
    act(root, '');
    const L1 = [-4.4, 0, 4.4];
    for (let j = 1; j <= 3; j++) {
      await swap(1, j, 900);
      say('SWAP(list[1], list[' + j + ']) → ' + str(), '固定第 1 個字元 = ' + str()[0]);
      const n1 = tag('perm(' + str() + ', 2, 3)', 'ptr alt', L1[j - 1], 4.4);
      line(0, 6.1, L1[j - 1], 4.7);
      await beat(tok, 900);
      for (let k = 2; k <= 3; k++) {
        await swap(2, k, 600);
        const lx = L1[j - 1] + (k === 2 ? -1.1 : 1.1);
        line(L1[j - 1], 4.1, lx, 2.7);
        tag(str(), 'ptr', lx, 2.4);
        say('perm(' + str() + ', 3, 3)：範圍只剩一個位置 → 輸出 ' + str(), 'boundary condition：i == n');
        await beat(tok, 1000);
        if (k !== 2) { await swap(2, k, 500); say('換回來：' + str(), 'SWAP(list[2], list[' + k + '])'); }
      }
      if (j !== 1) { await swap(1, j, 700); say('第 1 個位置換回來：' + str(), '換回原狀，下一輪才正確'); await beat(tok, 500); }
      act(n1, '');
    }
    say('6 種排列：abc acb bac bca cba cab', 'for j = i..n：SWAP → perm(i+1, n) → SWAP 回來');
    await beat(tok, 3200);
  }
  async function scPermLoops(tok) {
    fresh([0, 7, 12], [0, 1, 0]);
    const cd = code(['for (i = 0; i < 3; i++)', '  for (j = 0; j < 3; j++)', '    for (k = 0; k < 3; k++)', '      print(s[i], s[j], s[k]);'], 0, 5.2);
    say('不用遞迴也可以：多層 for，每個位置都試 a、b、c', '3 × 3 × 3 = 27 種組合');
    await beat(tok, 2000);
    const S = 'abc', all = [];
    cd.hl(3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const s = S[i] + S[j] + S[k], n = all.length;
      all.push({ s, dup: new Set(s).size < 3, m: cube(s, '#4b9ee2', [1.1, 0.45, 0.8], -5.6 + (n % 9) * 1.4, 0.23, -1.2 + Math.floor(n / 9) * 1.2, 3) });
      await beat(tok, 110);
    }
    cd.hl(-1);
    say('問題：會產生字元重複的組合', '像 aab、bbb、cac…');
    await beat(tok, 1600);
    for (const e of all) if (e.dup) { tint(e.m, '#d64545'); await beat(tok, 50); }
    say('必須偵測已出現過的字元，把它們排除', '27 − 21 = 6');
    await beat(tok, 1600);
    all.filter((e) => e.dup).forEach((e) => fly(e.m));
    await beat(tok, 1200);
    all.filter((e) => !e.dup).forEach((e, q) => { tint(e.m, '#2fc092'); move(e.m, -3.5 + q * 1.4, 0.23, 0); });
    say('剩下 6 種，跟遞迴版一樣', '同一個問題不只一種 solution');
    await beat(tok, 4200);
  }
  async function scSpaceSP(tok) {
    fresh([0, 5, 14], [0, 2.8, 0]);
    say('空間複雜度：S(P) = c + S_P', 'c 是固定部分；S_P 跟輸入有關');
    await beat(tok, 2400);
    tag('sum()：迴圈版', 'ptr', -3, 6.6); tag('rsum()：遞迴版', 'ptr alt', 3, 6.6);
    cube('c', '#b8a98a', [2.4, 1.1, 1.6], -3, 0.55, 0, 3); cube('c', '#b8a98a', [2.4, 1.1, 1.6], 3, 0.55, 0, 3);
    say('c：程式碼本身、簡單變數、常數的空間', '跟輸入大小無關，固定不變');
    await beat(tok, 2600);
    tag('S_P = 0（陣列只傳位址）', 'idx', -3, 1.6);
    const sp = tag('S_P = 0', 'ptr alt', 5.7, 1.6);
    for (let n = 1; n <= 8; n++) {
      cube('n=' + n, '#4b9ee2', [2.4, 0.5, 1.6], 3, 1.35 + (n - 1) * 0.55, 0, 3);
      txt(sp, 'S_P ∝ ' + n);
      say('instance characteristics：n = ' + n, '迴圈版 S_P 不變；遞迴版每多一層就多一份');
      await beat(tok, 650);
    }
    say('一樣是加總，S_P 差很多', 'S_sum(n) = 0；S_rsum(n) ∝ n');
    await beat(tok, 2400);
    say('分析重點是 S_P：跟輸入資料量的關係', 'S(P) = c + S_P(instance characteristics)');
    await beat(tok, 3000);
  }
  async function scTimeTP(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    say('T(P) = compile time + 執行時間 T_P', '');
    cube('compile', '#b8a98a', [2.4, 1, 1.6], -3.2, 0.5, 0, 3);
    tag('跟輸入無關：編一次就好', 'idx', -3.2, 0, 1.3);
    await beat(tok, 2200);
    const tl = tag('T_P', 'ptr alt', -3.2, 1.4);
    for (let n = 1; n <= 6; n++) {
      cube('', '#4b9ee2', [2.4, 0.45, 1.6], -3.2, 1.25 + (n - 1) * 0.5, 0, 3);
      tl.position.y = 1.8 + n * 0.5;
      say('輸入變大，T_P 跟著變長', 'n = ' + n);
      await beat(tok, 500);
    }
    say('compile time 跟輸入無關 → 只分析 T_P', 'T(P) = c + T_P');
    await beat(tok, 2200);
    const ins = ['load', 'add', 'store', 'load', 'sub', 'store', 'add', 'load'];
    const IC = { load: '#31aab0', add: '#dd8238', sub: '#e55a9b', store: '#9b7ef4' };
    const im = ins.map((t, k) => cube(t, IC[t], [1.15, 0.45, 0.9], 1.6 + (k % 4) * 1.3, 0.23, k < 4 ? -0.7 : 0.7, 3));
    say('CPU 真正跑的是 add、sub、load、store 指令', '時間取決於 instruction set → 太瑣碎');
    await beat(tok, 3000);
    im.forEach((m) => fly(m));
    await beat(tok, 700);
    for (let k = 0; k < 4; k++) cube('step', '#4b9ee2', [1.15, 0.45, 0.9], 1.6 + k * 1.3, 0.23, 0, 3);
    say('資料結構與演算法改數 program step', '一個有意義的敘述算一步，跟機器無關');
    await beat(tok, 3800);
  }
  async function scCountSteps(tok) {
    fresh([0, 5, 14], [0, 3.4, 0]);
    const cd = code(['float sum(float list[], int n) {', '  float tempsum = 0;  count++;', '  int i;', '  for (i = 0; i < n; i++) {', '    count++;      // for test', '    tempsum += list[i];  count++;', '  }', '  count++;        // last for test', '  count++;        // return', '  return tempsum;', '}'], -2.2, 6.6, 0.5);
    tag('n = 3', 'idx', 4.4, 0, 1.2);
    const cl = tag('count = 0', 'ptr alt', 4.4, 4.2);
    let count = 0;
    async function add(ln, cap) {
      cd.hl(ln); count++;
      cube('', '#4b9ee2', [1, 0.32, 1], 4.4, 0.17 + (count - 1) * 0.36, 0, 2.5);
      txt(cl, 'count = ' + count);
      say(cap, 'count = ' + count);
      await beat(tok, 850);
    }
    say('宣告全域變數 count，初值 0', '每執行一個敘述就 count++');
    await beat(tok, 2400);
    await add(1, 'tempsum = 0 是 assignment：算一步');
    cd.hl(2); say('int i; 只有宣告、沒有 assignment：不算', 'count = ' + count);
    await beat(tok, 1600);
    for (let i = 0; i < 3; i++) {
      await add(4, 'for 判斷 i < n（i = ' + i + '，成立）');
      await add(5, 'tempsum += list[' + i + ']');
    }
    await add(7, 'for 最後一次判斷（i = 3 不成立）');
    await add(8, 'return 也算一步');
    cd.hl(-1);
    say('n = 3 → count = 9 = 2n + 3', '2n+3 和 2n+5 在 n 很大時沒差，重點是跟 n 的關係');
    await beat(tok, 3200);
    say('矩陣加法同理：步數跟 rows、cols 有關', '2·rows·cols + 2·rows + 1；rows ≫ cols 時可交換內外迴圈');
    await beat(tok, 3400);
  }
  async function scStepTable(tok) {
    fresh([0, 5, 14], [0, 3.6, 0]);
    const R = [
      ['float sum(float list[], int n)', '0', '0', '0', 0, '函數標頭不是執行的敘述', '0 × 0 = 0'],
      ['{', '0', '0', '0', 0, '大括號不算', '0'],
      ['  float tempsum = 0;', '1', '1', '1', 1, 'assignment：每次 1 步、執行 1 次', '1 × 1 = 1'],
      ['  int i;', '0', '0', '0', 0, '只有宣告、沒有 assignment', '0'],
      ['  for (i = 0; i < n; i++)', '1', 'n+1', 'n+1', 6, 'for 標頭：最後還要多判斷一次才結束', '1 × (n+1) = n+1'],
      ['    tempsum += list[i];', '1', 'n', 'n', 5, '迴圈本體：執行 n 次', '1 × n = n'],
      ['  return tempsum;', '1', '1', '1', 1, 'return：1 步', '1 × 1 = 1'],
      ['}', '0', '0', '0', 0, '結尾大括號不算', '0'],
    ];
    const fmt = (a, b, c, d) => a.padEnd(31) + b.padStart(4) + c.padStart(6) + d.padStart(7);
    const hd = tag(fmt('Statement', 's/e', 'freq', 'total'), 'ptr', -1.4, 6.8); Object.assign(hd.element.style, MONO);
    tag('n = 5', 'idx', 5.6, 0, 1.2);
    const COLS = ['#4b9ee2', '#9b7ef4', '#2fc092', '#dd8238'];
    say('Tabular method：每行列出 s/e 和 frequency', 's/e（每次執行幾步）× frequency（執行幾次）= total');
    await beat(tok, 2800);
    let stack = 0, ci = 0;
    for (let k = 0; k < R.length; k++) {
      const [st, se, fq, tot, cnt, cap, f] = R[k];
      const l = tag(fmt(st, se, fq, tot), 'ptr alt', -1.4, 6.2 - k * 0.5); Object.assign(l.element.style, MONO);
      say(cap, f);
      if (cnt) { const c = COLS[ci++ % 4]; for (let q = 0; q < cnt; q++) { cube('', c, [0.9, 0.26, 0.9], 5.6, 0.13 + stack * 0.3, 0, 2.5); stack++; await beat(tok, 90); } }
      await beat(tok, cnt ? 1300 : 800);
      l.element.className = 'lab-label';
    }
    const tl = tag(fmt('Total', '', '', '2n+3'), 'ptr', -1.4, 6.2 - R.length * 0.5); Object.assign(tl.element.style, MONO);
    say('把 total 欄加起來：2n + 3', 'n = 5 → 13 步（右邊 13 顆）');
    await beat(tok, 3200);
  }
  async function scOmegaTheta(tok) {
    fresh([0, 5, 15], [0, 4.2, 0]);
    plotAxes();
    const px = (n) => (n - NMAX / 2) * SX;
    const f = (n) => 3 * n + 3;
    makeLine(f, '#d64545'); tag('f(n) = 3n + 3', 'ptr', px(22), f(22) * SY + 0.6);
    say('f(n) = 3n + 3', '想用 g(n) = n 從上下把它夾住');
    await beat(tok, 2000);
    makeLine((n) => 3 * n, '#2fc092'); tag('3n', 'ptr alt', px(20), 60 * SY - 0.6);
    say('Ω：存在 c、n₀，n ≥ n₀ 時 f(n) ≥ c·g(n)', '3n + 3 ≥ 3n，取 c = 3 → f(n) = Ω(n)');
    await beat(tok, 3200);
    makeLine((n) => 4 * n, '#9b7ef4'); tag('4n', 'ptr', px(16), 64 * SY + 0.6);
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 10, 0.05), new THREE.MeshBasicMaterial({ color: '#c08a1f' })); mk.position.set(px(3), 5, 0); lab.world.add(mk);
    tag('n₀ = 3', 'idx', px(3), -0.5);
    say('O：3n + 3 ≤ 4n 在 n ≥ 3 時成立', '取 c = 4、n₀ = 3 → f(n) = O(n)');
    await beat(tok, 3200);
    const zone = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.02), new THREE.MeshBasicMaterial({ color: '#2fc092', transparent: true, opacity: 0.1 }));
    zone.scale.x = (NMAX - 3) * SX; zone.position.set(px(3) + (NMAX - 3) * SX / 2, 5, -0.05); lab.world.add(zone);
    say('Θ：上界、下界同時成立，把 f 夾住', '3n ≤ 3n + 3 ≤ 4n（n ≥ 3）→ f(n) = Θ(n)');
    await beat(tok, 3400);
    say('上界要取最小的、下界要取最大的', 'n² 也是上界、1 也是下界，但都不夠緊');
    await beat(tok, 3000);
  }

  // ─── 8IOv2fnc01E：演算法五面向、找最小值、pseudocode、資料結構 ───
  const MINA = [7, 4, 9, 6, 8, 2, 5, 3];
  const mx = (k) => -4.2 + k * 1.2;
  function minArray() { return MINA.map((v, k) => { tag('[' + k + ']', 'idx', mx(k), 0, 0.95); return cube(v, '#4b9ee2', [1, 0.8, 1], mx(k), 0.4, 0); }); }
  async function scFive(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const C = [['Input', '接收資料（少數短程式可以沒有輸入）'], ['Output', '輸出要是我們想要的、正確的結果'], ['Definiteness', '描述清楚、不模稜兩可'], ['Effectiveness', '電腦做得到，而且跟平台有關'], ['Finiteness', '照步驟執行，一定會停下來']];
    const ps = C.map(([nm], k) => { const x = -5 + k * 2.5; tag(nm, 'ptr', x, k % 2 ? 3.8 : 3.2); return bar(GRAY, 1.8, 1.4, x, 0); });
    ps.forEach((m) => { m.scale.y = 0.6; m.position.y = 0.3; });
    say('Knuth：看演算法的五個面向', '');
    await beat(tok, 1800);
    for (let k = 0; k < 5; k++) {
      tint(ps[k], ['#4b9ee2', '#2fc092', '#9b7ef4', '#dd8238', '#e55a9b'][k]);
      await growBar(tok, ps[k], 2.6, 400);
      say(C[k][0] + '：' + C[k][1], '');
      await beat(tok, 1700);
    }
    fresh([0, 5, 14], [0, 2.4, 0]);
    tag('for (i = 0; i < 5; i++) { }', 'ptr', -3.4, 6.2); tag('while (1) { }', 'ptr alt', 3.4, 6.2);
    const lc = tag('', 'idx', -3.4, 0, 1.4), rc = tag('', 'idx', 3.4, 0, 1.4);
    say('Finiteness ≠ 程式碼行數有限', '兩行就能寫出無窮迴圈');
    const right = [];
    for (let t = 1; t <= 16; t++) {
      if (t <= 5) { cube('', '#4b9ee2', [1.6, 0.4, 1.2], -3.4, 0.2 + (t - 1) * 0.45, 0, 3); txt(lc, '第 ' + t + ' 步'); }
      if (t === 6) { txt(lc, 'i = 5 → 停 ✓'); }
      right.push(cube('', '#d64545', [1.6, 0.4, 1.2], 3.4, 0.2 + (right.length) * 0.45, 0, 3));
      if (right.length > 8) { fly(right.shift(), V3(4, 6, 3)); right.forEach((m, q) => move(m, 3.4, 0.2 + q * 0.45, 0)); }
      txt(rc, '已跑 ' + t + ' 輪，還沒停…');
      await beat(tok, 320);
    }
    say('Finiteness：執行步驟有限，最後一定會停', '左邊停了；右邊跑到天荒地老');
    await beat(tok, 3000);
  }
  async function scMinIndex(tok) {
    fresh([0, 6, 13.5], [0, 2.6, 0]);
    const cs = minArray();
    const cd = code(['int getMinIndex(int arr[], int len) {', '  int minPos = 0;', '  for (int i = 1; i < len; i++)', '    if (arr[i] < arr[minPos])', '      minPos = i;', '  return minPos;', '}'], 0, 6.8, 0.5);
    const ip = tag('i', 'ptr', mx(1), 1.5), mp = tag('minPos', 'ptr alt', mx(0), 0, 1.8);
    const cnt = tag('比較 0 次', 'ptr', 5.9, 0.4);
    showL(ip, false);
    say('給一個 array 和長度，回傳最小值的 index', 'getMinIndex(arr, len)');
    await beat(tok, 2200);
    cd.hl(1); glow(cs[0], GREEN);
    say('先假設第 0 個最小，抓在手上', 'minPos = 0（arr[0] = 7）');
    await beat(tok, 1900);
    let m = 0;
    for (let i = 1; i < MINA.length; i++) {
      cd.hl(2); showL(ip, true); move(ip, mx(i), 1.5, 0); glow(cs[i], GOLD);
      await beat(tok, 420);
      cd.hl(3); txt(cnt, '比較 ' + i + ' 次');
      if (MINA[i] < MINA[m]) {
        glow(cs[m], null); m = i; glow(cs[m], GREEN); move(mp, mx(m), 0, 1.8); cd.hl(4);
        say('arr[' + i + '] = ' + MINA[i] + ' 比較小：更新', 'minPos = ' + i);
      } else say('arr[' + i + '] = ' + MINA[i] + ' ≥ ' + MINA[m] + '：不動', 'minPos 還是 ' + m);
      await beat(tok, 950);
      if (i !== m) glow(cs[i], null);
    }
    cd.hl(5); showL(ip, false);
    say('回傳 5：最小值 2 在第 5 個位置', '比較了 n − 1 = 7 次');
    await beat(tok, 2600);
    say('Input：arr、len；Output：最小元素的 index', '只有一個 for 迴圈 → 給正確輸入就會停（Finiteness）');
    await beat(tok, 3000);
  }
  async function scLoopInv(tok) {
    fresh([0, 6, 13.5], [0, 2.4, 0]);
    const cs = minArray();
    const br = ghostBox('#2fc092', 1.3, 1.3); br.visible = false;
    const bl = tag('', 'ptr', 0, 1.6), mp = tag('minPos', 'ptr alt', mx(0), 0, 1.8);
    showL(bl, false);
    say('正確性：回傳的 m 要讓 arr[m] ≤ 每一個 arr[j]', '先把「正確」寫成數學命題');
    await beat(tok, 2800);
    say('Loop invariant：第 k 輪結束時', 'minPos 存的是 arr[0..k] 範圍內最小值的位置');
    await beat(tok, 2800);
    let m = 0;
    for (let k = 1; k < MINA.length; k++) {
      if (MINA[k] < MINA[m]) m = k;
      const cx = (mx(0) + mx(k)) / 2;
      br.visible = true; br.scale.x = (k + 1) * 1.2; br.position.set(cx, 0.6, 0);
      showL(bl, true); bl.position.set(cx, 1.6, 0); txt(bl, 'arr[0..' + k + '] 最小 = ' + MINA[m]);
      move(mp, mx(m), 0, 1.8);
      cs.forEach((c, j) => glow(c, j === m ? GREEN : null));
      if (k === 1) say('k = 1：只比過 arr[0]、arr[1]，直接驗證成立', '基底（base case）');
      else if (k === 2) say('假設 k 成立 → 再比一個 arr[k+1] → k+1 也成立', '數學歸納法（induction step）');
      else say('k = ' + k + '：性質仍然成立 ✓', 'minPos = ' + m + '（值 ' + MINA[m] + '）');
      await beat(tok, k <= 2 ? 2800 : 1100);
    }
    say('推到 k = len−1：整個陣列的最小值 → 正確', '每輪結束都維持不變的性質 = loop invariant');
    await beat(tok, 3400);
  }
  async function scTournament(tok) {
    fresh([0, 5.5, 14], [0, 3.1, 0]);
    let lvl = MINA.map((v, k) => ({ v, x: mx(k), m: cube(v, '#4b9ee2', [0.9, 0.7, 0.9], mx(k), 0.35, 0) }));
    const cnt = tag('比較 0 次・0 輪', 'ptr alt', 0, 7.4);
    say('另一種找最小值：兩兩比較的淘汰賽', '8 → 4 → 2 → 1');
    await beat(tok, 2400);
    let cmp = 0;
    const caps = [['第 1 輪：4 組同時比，小的晉級', '4 顆 CPU 平行 → 一輪只要 1 單位時間'], ['第 2 輪：剩 4 個，2 組比', ''], ['決賽：最小值出線', '']];
    for (let r = 0; r < 3; r++) {
      const nxt = [], y = 0.35 + (r + 1) * 1.85;
      for (let p = 0; p < lvl.length; p += 2) {
        glow(lvl[p].m, GOLD); glow(lvl[p + 1].m, GOLD);
        if (r === 0) tag('CPU ' + (p / 2 + 1), 'idx', (lvl[p].x + lvl[p + 1].x) / 2, 0, 1.3);
      }
      say(caps[r][0], caps[r][1]);
      await beat(tok, 1300);
      for (let p = 0; p < lvl.length; p += 2) {
        const a = lvl[p], b = lvl[p + 1], w = a.v < b.v ? a : b, lo = w === a ? b : a, x = (a.x + b.x) / 2;
        glow(a.m, null); glow(b.m, null); tint(lo.m, GRAY);
        line(a.x, a.m.position.y + 0.35, x, y - 0.35); line(b.x, b.m.position.y + 0.35, x, y - 0.35);
        const nm = cube(w.v, '#2fc092', [0.9, 0.7, 0.9], w.x, w.m.position.y, 0);
        move(nm, x, y, 0);
        nxt.push({ v: w.v, x, m: nm });
        cmp++;
      }
      txt(cnt, '比較 ' + cmp + ' 次・' + (r + 1) + ' 輪');
      lvl = nxt;
      await beat(tok, 1300);
    }
    say('比較次數 4 + 2 + 1 = 7 = n − 1', '跟 for 迴圈逐一掃描一樣多，並沒有比較少');
    await beat(tok, 3000);
    say('但能平行：只要 log₂8 = 3 輪', '非平行平台還有存比較結果的隱藏成本 → 效率跟平台有關');
    await beat(tok, 3400);
  }
  async function scPseudoMin(tok) {
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    const cC = code(['int getMinIndex(int arr[], int len) {', '  int minPos = 0;', '  for (int i = 1; i < len; i++)', '    if (arr[i] < arr[minPos])', '      minPos = i;', '  return minPos;', '}'], -3.3, 6.4, 0.55);
    say('C 程式碼：要讓 compiler 看得懂，規則很嚴', '分號、大括號、型別宣告…');
    await beat(tok, 2600);
    const P = ['GET-MIN-INDEX(A, len)', '  minPos ← 0', '  for i ← 1 to len−1', '    if A[i] < A[minPos]', '      minPos ← i', '  return minPos'];
    const caps = [['Pseudocode：不綁定特定語言', '電腦科學的「口語」'], ['← 表示 assignment', '不用 int、不用分號'], ['i 的宣告已隱含在 for 裡，省略', '先初始化、再跑一個迴圈'], ['意圖：比較', '不用大括號'], ['條件成立就更新', ''], ['回傳答案', '']];
    const cP = code(P, 3.4, 6.4, 0.55);
    cP.ls.forEach((l) => showL(l, false));
    for (let k = 0; k < P.length; k++) {
      cC.hl(k); showL(cP.ls[k], true); cP.hl(k);
      say(caps[k][0], caps[k][1]);
      await beat(tok, 1100);
    }
    cC.kill(); cP.hl(-1);
    const A = [4, 9, 2, 6], ax = (k) => -5.2 + k * 1.1;
    const cs = A.map((v, k) => { tag('[' + k + ']', 'idx', ax(k), 0, 0.9); return cube(v, '#4b9ee2', [0.9, 0.7, 0.9], ax(k), 0.35, 0, 3); });
    const mv = tag('minPos = ?', 'ptr alt', -3.55, 2.9), iv = tag('i = ?', 'ptr', -3.55, 2.2);
    say('拿 A = [4, 9, 2, 6] 一行一行 trace', 'len = 4');
    await beat(tok, 1800);
    const step = async (ln, cap, f, ms = 1150) => { cP.hl(ln); say(cap, f); await beat(tok, ms); };
    txt(mv, 'minPos = 0'); glow(cs[0], GREEN);
    await step(1, 'minPos ← 0', 'A[0] = 4');
    let m = 0;
    for (let i = 1; i < 4; i++) {
      txt(iv, 'i = ' + i); glow(cs[i], GOLD);
      await step(2, 'for：i ← ' + i, '');
      const yes = A[i] < A[m];
      await step(3, 'A[' + i + '] < A[minPos]？', A[i] + ' < ' + A[m] + ' → ' + (yes ? '是' : '否'));
      if (yes) { glow(cs[m], null); m = i; glow(cs[m], GREEN); txt(mv, 'minPos = ' + m); await step(4, 'minPos ← ' + i, ''); }
      else glow(cs[i], null);
    }
    await step(5, 'return minPos = ' + m, '最小值 ' + A[m] + ' 在位置 ' + m, 1500);
    cP.hl(-1);
    say('意圖清楚：初始化 → 跑迴圈 → 條件成立就更新', 'pseudocode 沒有嚴格語法，重點是表達意圖');
    await beat(tok, 3000);
  }
  async function scPseudoStyles(tok) {
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    const beam = lab.box('#c9b48e', [10, 0.12, 0.3]); beam.position.set(0, 0.25, 2); lab.world.add(beam);
    tag('字太少：太抽象', 'idx', -4.6, 0, 2.8); tag('字太多：太詳細', 'idx', 4.6, 0, 2.8);
    const mk = cube('', '#2fc092', [0.5, 0.5, 0.5], 0, 0.6, 2);
    const vd = tag('', 'ptr', 0, 1.5, 2);
    const GOOD = ['minPos ← 0', 'for i ← 1 to len−1', '  if A[i] < A[minPos]', '    minPos ← i', 'return minPos'];
    const V = [
      [GOOD, 0, '#2fc092', '好的 pseudocode', '意圖清楚、不多不少；變數名就說明用途'],
      [['minPos ← 0', 'for i ← 1 to len−1', '  a ← A[i]', '  b ← A[minPos]', '  if a < b', '    minPos ← i', 'return minPos'], 4.4, '#d64545', '太詳細：多餘的暫存變數掩蓋了意圖', '像在寫 C，不像在溝通'],
      [['a ← 0', 'for b ← 1 to len−1', '  if A[b] < A[a]', '    a ← b', 'return a'], 0.8, '#d64545', '太神秘：每行都看得懂，卻看不出在做什麼', '把 minPos、i 改成 a、b'],
      [['run a loop that updates minPos'], -4.4, '#d64545', '太抽象：惜字如金', '少數人懂，多數人無法完整理解'],
      [GOOD, 0, '#2fc092', '在字太少與字太多之間取得平衡', '目標：communicate correctly'],
    ];
    let panel = null;
    for (const [lines, x, col, cap, f] of V) {
      if (panel) panel.kill();
      panel = code(lines, 0, 6.4, 0.6);
      move(mk, x, 0.6, 2); tint(mk, col);
      txt(vd, col === '#2fc092' ? '✓ 好懂' : '✗ 不好');
      say(cap, f);
      await beat(tok, 4600);
    }
  }
  async function scSelSort(tok) {
    fresh([0, 6, 13.5], [0, 2.6, 0]);
    const a = MINA.slice(), cs = minArray();
    const cd = code(['SELECTION-SORT(A, len)', '  for i ← 0 to len−2', '    m ← GET-MIN-INDEX(A, i … len−1)', '    swap A[i] ↔ A[m]'], 0, 6.4, 0.56);
    const ip = tag('i', 'ptr', mx(0), 0, 1.8), mp = tag('m', 'ptr alt', mx(0), 1.6, 0);
    const cnt = tag('比較 0 次', 'ptr', 5.9, 0.4);
    say('用 get minimum index 寫出 selection sort', '每輪在還沒排好的 A[i … len−1] 找最小，換到第 i 個');
    await beat(tok, 2800);
    let cmp = 0;
    for (let i = 0; i < a.length - 1; i++) {
      cd.hl(1); move(ip, mx(i), 0, 1.8);
      say('第 ' + (i + 1) + ' 輪：在 A[' + i + ' … 7] 找最小', '');
      await beat(tok, 550);
      cd.hl(2);
      let m = i; glow(cs[m], GREEN); move(mp, mx(m), 1.6, 0);
      for (let j = i + 1; j < a.length; j++) {
        glow(cs[j], GOLD); cmp++; txt(cnt, '比較 ' + cmp + ' 次');
        await beat(tok, 150);
        if (a[j] < a[m]) { glow(cs[m], null); m = j; glow(cs[m], GREEN); move(mp, mx(m), 1.6, 0); } else glow(cs[j], null);
      }
      cd.hl(3);
      say('把最小值 ' + a[m] + ' 換到第 ' + i + ' 個位置', m === i ? '本來就在位置上，不用換' : 'swap A[' + i + '] ↔ A[' + m + ']');
      if (m !== i) {
        const A1 = cs[i], B1 = cs[m];
        move(A1, mx(i), 0.4, 1.2); move(B1, mx(m), 0.4, -1.2); await beat(tok, 300);
        move(A1, mx(m), 0.4, 1.2); move(B1, mx(i), 0.4, -1.2); await beat(tok, 350);
        move(A1, mx(m), 0.4, 0); move(B1, mx(i), 0.4, 0);
        [a[i], a[m]] = [a[m], a[i]]; [cs[i], cs[m]] = [cs[m], cs[i]];
      }
      await beat(tok, 450);
      cs.forEach((c) => glow(c, null)); tint(cs[i], '#2fc092');
    }
    tint(cs[a.length - 1], '#2fc092'); cd.hl(-1);
    say('排好了：比較 7 + 6 + … + 1 = 28 次', 'n(n−1)/2 → Θ(n²)；最花力氣的是找最小值');
    await beat(tok, 3200);
  }
  async function scExamPapers(tok) {
    fresh([0, 7, 12], [0, 0.6, 0]);
    const ID = [3, 17, 8, 12, 20, 1, 15, 6, 11, 19, 4, 14, 9, 2, 16, 7, 13, 10, 18, 5];
    const SC = [72, 95, 60, 88, 45, 99, 67, 81, 53, 90, 76, 38, 84, 92, 70, 58, 63, 87, 49, 79];
    const pad = (v) => (v < 10 ? '0' : '') + v;
    const P = ID.map((id, k) => {
      const x = (Math.random() - 0.5) * 2, z = (Math.random() - 0.5) * 1.6;
      const m = cube(pad(id), '#efe6d2', [0.8, 0.12, 0.6], x, 0.06 + k * 0.13, z, 3);
      m.rotation.y = (Math.random() - 0.5) * 1.2;
      return { id, sc: SC[k], m };
    });
    say('200 份考卷（這裡用 20 份）隨意疊', '放進去最快，要找某個人就得一份份翻');
    await beat(tok, 3000);
    const grid = (list, lab2) => list.forEach((p, r) => { p.m.rotation.y = 0; relabel(p.m, lab2(p)); showL(p.m.userData.lbl, true); move(p.m, -4.5 + (r % 10), 0.06, r < 10 ? -0.7 : 0.7); });
    grid([...P].sort((a, b) => b.sc - a.sc), (p) => p.sc);
    say('依分數高低排（標籤 = 分數）', '方便看排名、找前幾名');
    await beat(tok, 3200);
    grid([...P].sort((a, b) => a.id - b.id), (p) => pad(p.id));
    say('依學號排（標籤 = 學號）', '要找某個學號，很快就翻到');
    await beat(tok, 3200);
    const COL = ['#4b9ee2', '#9b7ef4', '#2fc092', '#dd8238', '#e55a9b', '#31aab0', '#c08a1f', '#5c7a4a', '#d64545', '#6e5f49'];
    for (let d = 0; d < 10; d++) tag(String(d), 'ptr', -4.5 + d, 0, 1.3);
    const h = new Array(10).fill(0);
    [...P].sort((a, b) => a.id - b.id).forEach((p) => {
      const d = p.id % 10;
      tint(p.m, COL[d]); showL(p.m.userData.lbl, true);
      move(p.m, -4.5 + d, 0.06 + h[d] * 0.14, 0);
      h[d]++;
    });
    P.forEach((p) => { if ([...P].some((q) => q.id % 10 === p.id % 10 && q.id > p.id)) showL(p.m.userData.lbl, false); });
    say('依學號尾數分成 10 堆', '發回考卷時一堆一堆發，最省事');
    await beat(tok, 3400);
    say('怎麼收納，取決於要拿資料做什麼', 'Data structure = 在電腦裡整理（收納）資料的方式');
    await beat(tok, 3200);
  }
  async function scTradeoff(tok) {
    fresh([0, 6.5, 13], [0, 1.2, 0]);
    const tx = (k) => -6.2 + k * 0.78, rx = (k) => 0.7 + k * 0.78;
    const tidyV = [3, 8, 15, 21, 30, 37, 50], messyV = [37, 3, 50, 21, 8, 30, 15];
    const T = tidyV.map((v, k) => ({ v, m: cube(v, '#4b9ee2', [0.65, 0.6, 0.65], tx(k), 0.3, 0) }));
    const M = messyV.map((v, k) => ({ v, m: cube(v, '#dd8238', [0.65, 0.6, 0.65], rx(k), 0.3, 0) }));
    tag('愛整理（隨時排好序）', 'ptr', -3.5, 0, -1.4); tag('隨便丟（來一個放一個）', 'ptr alt', 3.4, 0, -1.4);
    const tc = tag('', 'idx', -3.5, 0, 1.3), mc = tag('', 'idx', 3.4, 0, 1.3);
    say('兩種收納習慣：愛整理 vs 隨便丟', '');
    await beat(tok, 2200);
    // insert 10
    say('放入 10：愛整理的要找位置，再把後面的往後挪', '找位置 3 次比較 + 挪 5 個 + 放入 1 次');
    let tSteps = 3;
    txt(tc, '放入：' + tSteps + ' 步');
    for (let k = T.length - 1; k >= 2; k--) { move(T[k].m, tx(k + 1), 0.3, 0); tSteps++; txt(tc, '放入：' + tSteps + ' 步'); await beat(tok, 280); }
    const nT = cube(10, '#2fc092', [0.65, 0.6, 0.65], tx(2), 0.3, 0, 3); T.splice(2, 0, { v: 10, m: nT }); tSteps++;
    txt(tc, '放入：' + tSteps + ' 步');
    await beat(tok, 1200);
    say('隨便丟的：直接丟在最後面', '1 步');
    const nM = cube(10, '#2fc092', [0.65, 0.6, 0.65], rx(7), 0.3, 0, 3); M.push({ v: 10, m: nM });
    txt(mc, '放入：1 步');
    await beat(tok, 2000);
    // find 30
    say('找 30：排好序可以二分搜尋', '');
    let l = 0, r = T.length - 1, probes = 0;
    while (l <= r) {
      const m = (l + r) >> 1; probes++;
      glow(T[m].m, GOLD); txt(tc, '放入 ' + tSteps + ' 步・找 ' + probes + ' 次');
      await beat(tok, 700);
      if (T[m].v === 30) { glow(T[m].m, GREEN); break; }
      glow(T[m].m, null);
      if (T[m].v < 30) l = m + 1; else r = m - 1;
    }
    say('隨便丟的：只能一個一個翻', '');
    for (let k = 0; k < M.length; k++) {
      glow(M[k].m, GOLD); txt(mc, '放入 1 步・找 ' + (k + 1) + ' 次');
      await beat(tok, 380);
      if (M[k].v === 30) { glow(M[k].m, GREEN); break; }
      glow(M[k].m, null);
    }
    await beat(tok, 900);
    say('愛整理：放入慢、找得快；隨便丟：放入快、找得慢', '沒有白吃的午餐：trade-off');
    await beat(tok, 3000);
    say('計算 vs 儲存、時間 vs 空間常要取捨', '還要看平台：平行、分散式、GPU vs CPU');
    await beat(tok, 3000);
  }

  // ───────────────────────── 遞迴呼叫堆疊（互動） ─────────────────────────
  const rs = { n: 6, frames: [], next: 6, retv: 0, returning: false };
  function enterRecStack() {
    stopTimer();
    lab.clear();
    Object.assign(rs, { frames: [], next: rs.n, retv: 0, returning: false });
    lab.frameCamera([0, 5, 15], [0, 3.2, 0]);
    cube('24B', '#9b7ef4', [1.6, 1, 1.4], -4.6, 0.5, 0);
    tag('迴圈版 sum()：固定 24 bytes', 'ptr', -4.6, 1.6);
    tag('rsum 呼叫堆疊', 'ptr alt', 1.8, 0, 1.6);
    controls('<label>n = <input id="rsN" type="number" min="1" max="10" value="' + rs.n + '"></label>'
      + '<button class="primary" id="rsCall">呼叫下一層</button><button id="rsRet">返回一層</button><button id="rsReset">重來</button>');
    $('rsN').onchange = (e) => { rs.n = Math.max(1, Math.min(10, Number(e.target.value) || 6)); clearLog(); enterRecStack(); };
    on('rsCall', rsCall); on('rsRet', rsRet); on('rsReset', () => { clearLog(); enterRecStack(); });
    log('rsum(list, n) = rsum(list, n−1) + list[n−1]；n == 0 時回傳 0。');
    log('list = [' + RL.slice(0, rs.n).join(', ') + ']，先一直按「呼叫下一層」。');
    rsState();
  }
  function rsCall() {
    if (rs.returning) { log('已經在返回了：返回途中不會再往下呼叫。按「重來」重新開始。', true); return; }
    if (rs.next < 0) { log('n == 0 是終止條件，直接 return 0，不會再呼叫 rsum(−1)。現在該按「返回一層」。', true); return; }
    const n = rs.next, k = rs.frames.length;
    const m = cube(n === 0 ? 'rsum(n=0) → 0' : 'rsum(n=' + n + ')  16B', n === 0 ? '#dd8238' : '#4b9ee2', [3.4, 0.5, 1.4], 1.8, 0.27 + k * 0.56, 0, 3);
    rs.frames.push({ n, m });
    rs.next--;
    log(n === 0 ? 'rsum(0)：碰到終止條件 n == 0。' : 'rsum(' + n + ') 等 rsum(' + (n - 1) + ') 的結果，先擱在堆疊上。');
    rsState();
  }
  function rsRet() {
    if (!rs.frames.length) { log('堆疊已經空了：rsum(' + rs.n + ') = ' + rs.retv + '。按「重來」再玩一次。', true); return; }
    if (rs.next >= 0) { log('還沒碰到終止條件 n == 0：下面那層的結果還沒出來，不能返回。', true); return; }
    rs.returning = true;
    const f = rs.frames.pop();
    const prev = rs.retv;
    rs.retv = f.n === 0 ? 0 : prev + RL[f.n - 1];
    fly(f.m, V3(3, 6, 3));
    log(f.n === 0 ? 'rsum(0) 回傳 0' : 'rsum(' + f.n + ') 回傳 ' + prev + ' + list[' + (f.n - 1) + '](' + RL[f.n - 1] + ') = ' + rs.retv);
    rsState();
  }
  function rsState() {
    const live = rs.frames.filter((f) => f.n > 0).length;
    setState('遞迴呼叫堆疊（n = ' + rs.n + '）', [['堆疊層數', String(rs.frames.length)], ['額外空間', '約 ' + 16 * live + ' bytes'], ['迴圈版', '24 bytes'], ['目前回傳值', String(rs.retv)]],
      '每層 ≈ 16 bytes（list、n、回傳值）<br>最深 n + 1 層 → 約 16n bytes：<span class="no">O(n)</span>；迴圈版 <span class="ok">O(1)</span>');
  }

  // ───────────────────────── 舞台場景（跟著影片） ─────────────────────────
  const scenes = {
    'growth-race': { title: '成長速度：log n < n < n log n < n² < 2ⁿ', play: async (tok) => {
      race.logScale = false; enterRace(); say('n 很小的時候，大家差不多', '');
      await beat(tok, 1500);
      for (let n = 1; n <= 30; n++) {
        setN(n);
        if (n === 6) say('n² 開始拉開距離', 'n² = 36');
        if (n === 9) say('2ⁿ 爆表了！', '2⁹ = 512，已經超過畫面上限');
        if (n === 20) say('n = 20：2ⁿ 已經是一百萬', 'n log n ≈ 86，n² = 400');
        await beat(tok, n < 12 ? 450 : 220);
      }
      say('差距是「量級」不同，不是常數倍', 'log n < n < n log n < n² < 2ⁿ');
      await beat(tok, 3000);
    } },
    'loop-nested': { title: '雙層迴圈：n × n 次', play: async (tok) => {
      loop.kind = 'nested'; loop.n = 6; enterLoop();
      say('外層跑 n 次，每次內層也跑 n 次', 'for i < n { for j < n { sum++ } }');
      await beat(tok, 1500);
      await runLoop(tok);
      say('6 × 6 = 36 顆方塊 → O(n²)', '總次數 = n²');
      await beat(tok, 2600);
      loop.kind = 'tri'; enterLoop();
      say('內層改成 j < i：只剩一半', '0 + 1 + … + (n−1)');
      await beat(tok, 1200);
      await runLoop(tok);
      say('n(n−1)/2，丟掉常數還是 O(n²)', '= 15 次');
      await beat(tok, 2800);
    } },
    'loop-log': { title: 'i *= 2：log n 次', play: async (tok) => {
      loop.kind = 'double'; loop.n = 12; enterLoop();
      say('i 每次乘 2：1, 2, 4, 8 …', 'for (i = 1; i < n; i *= 2)');
      await beat(tok, 1500);
      await runLoop(tok);
      say('n = 12 只跑 4 次 → O(log n)', '⌈log₂ 12⌉ = 4');
      await beat(tok, 3000);
    } },
    'bigo-def': { title: 'Big-O 定義：找 c 和 n₀', play: async (tok) => {
      // params (from the notes): { a, b, c, n0 } → f(n) = a·n + b, target c and n₀ (defaults: 3n + 10, c = 5, n₀ = 5)
      const P = ctx.params || {};
      bigo.fa = P.a || 3; bigo.fb = P.b === undefined ? 10 : P.b;
      const cT = P.c || bigo.fa + 2, n0T = P.n0 === undefined ? Math.ceil(bigo.fb / (cT - bigo.fa)) : P.n0;
      bigo.c = bigo.fa - 1; bigo.n0 = 0; enterBigO();
      say('f(n) = ' + fName() + ' 是 O(n) 嗎？', '要找 c、n₀：n ≥ n₀ 時 f(n) ≤ c·n');
      await beat(tok, 2200);
      say('c = ' + bigo.c + '：斜率比 ' + bigo.fa + ' 小，永遠追不上', '');
      updateBigO(); await beat(tok, 2200);
      for (let c = bigo.fa; c <= cT; c++) { bigo.c = c; updateBigO(); say('把 c 加大到 ' + c, ''); await beat(tok, 1100); }
      say('c = ' + cT + ' 時交點在 n = ' + +(bigo.fb / (cT - bigo.fa)).toFixed(2), fName() + ' ≤ ' + cT + 'n ⇔ n ≥ ' + +(bigo.fb / (cT - bigo.fa)).toFixed(2));
      await beat(tok, 1800);
      for (let n0 = 0; n0 <= n0T; n0++) { bigo.n0 = n0; updateBigO(); await beat(tok, 350); }
      say('n₀ = ' + n0T + ' 之後綠線永遠在上面 → f(n) = O(n)', '<span class="ok">c = ' + cT + '、n₀ = ' + n0T + '</span>');
      await beat(tok, 3200);
    } },
    'recursion-tree': { title: '遞迴樹：每層成本加起來', play: async (tok) => {
      tree.kind = (ctx.params || {}).tree || 'merge';
      await enterTree(tok);
      await beat(tok, 3200);
    } },
    'master': { title: 'Master Theorem 三種情況', play: async (tok) => {
      enterMaster();
      const cases = [[4, 2, 1, '情況 1：葉子大'], [2, 2, 1, '情況 2：一樣大，多乘 log n'], [2, 2, 2, '情況 3：f(n) 大']];
      for (const [a, b, k, t] of cases) {
        mt.a = a; mt.b = b; mt.k = k;
        $('mA').value = a; $('mB').value = b; $('mK').value = k;
        const r = updateMaster();
        say(t, 'T(n) = ' + a + 'T(n/' + b + ') + n^' + k + ' → ' + r.ans);
        await beat(tok, 3200);
      }
    } },
    // ── 依影片段落新增的場景 ──
    'prime-trial': { title: '判斷質數：試除到 n−1 vs 試除到 √n', play: scPrimeTrial },
    'prime-timing': { title: 'Ram vs Shyam：n 變大時的執行時間', play: scPrimeTiming },
    'space-loop-sum': { title: '迴圈求和的額外空間：固定 24 bytes', play: scSpaceLoop },
    'recursion-two-parts': { title: '遞迴兩要素：遞迴式 + 終止條件', play: scRecTwoParts },
    'recursion-stack': { title: '遞迴求和的呼叫堆疊：約 16n bytes', play: scRecStack },
    'matrix-add': { title: '矩陣加法：成本 ≈ rows × cols', play: scMatrixAdd },
    'recursion-kinds': { title: 'Direct / Indirect recursion 與 boundary condition', play: scRecKinds },
    'recursive-multiply': { title: '遞迴乘法與遞迴加總：展開再返回', play: scRecMult },
    'binary-search': { title: 'Binary search：left、right、middle', play: scBinSearch },
    'perm-tree': { title: '遞迴產生排列：perm(abc, 1, 3)', play: scPermTree },
    'perm-loops': { title: '不用遞迴的排列：三層迴圈再去重複', play: scPermLoops },
    'space-sp': { title: '空間複雜度 S(P) = c + S_P', play: scSpaceSP },
    'time-tp': { title: '時間複雜度 T(P) 與 program step', play: scTimeTP },
    'count-steps': { title: '用 count 變數數步數：2n + 3', play: scCountSteps },
    'step-table': { title: 'Tabular method：s/e × frequency', play: scStepTable },
    'omega-theta': { title: 'Ω 與 Θ：把 3n + 3 夾住', play: scOmegaTheta },
    'five-criteria': { title: '演算法的五個面向（Knuth）', play: scFive },
    'min-index': { title: '找陣列最小值的 index：n − 1 次比較', play: scMinIndex },
    'loop-invariant': { title: 'Loop invariant：每輪都成立的性質', play: scLoopInv },
    'tournament': { title: '淘汰賽找最小值：7 次比較、3 輪', play: scTournament },
    'pseudo-min': { title: '從 C 到 pseudocode，逐行 trace', play: scPseudoMin },
    'pseudo-styles': { title: '不好的 pseudocode：太詳細、太神秘、太抽象', play: scPseudoStyles },
    'selection-sort': { title: 'Selection sort：每輪找最小換到前面', play: scSelSort },
    'exam-papers': { title: '資料結構 = 收納資料的方式（考卷）', play: scExamPapers },
    'tradeoff-tidy': { title: 'Trade-off：愛整理 vs 隨便丟', play: scTradeoff },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 1 章',
    title: '複雜度分析',
    color: 'var(--ds)',
    modes: [
      { id: 'race', name: '成長賽跑', enter: enterRace },
      { id: 'loop', name: '迴圈計數', enter: enterLoop },
      { id: 'bigo', name: 'Big-O 定義', enter: () => { bigo.fa = 3; bigo.fb = 10; enterBigO(); } },
      { id: 'tree', name: '遞迴樹', enter: () => enterTree() },
      { id: 'master', name: 'Master Theorem', enter: enterMaster },
      { id: 'recstack', name: '遞迴呼叫堆疊', enter: enterRecStack },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'five-criteria', 'min-index', 'loop-invariant', 'tournament', 'pseudo-min', 'pseudo-styles', 'selection-sort', 'exam-papers', 'tradeoff-tidy',
      'prime-trial', 'prime-timing', 'growth-race',
      'space-loop-sum', 'recursion-two-parts', 'recursion-stack', 'recursion-kinds', 'recursive-multiply', 'binary-search', 'perm-tree', 'perm-loops',
      'space-sp', 'time-tp', 'count-steps', 'step-table', 'matrix-add', 'loop-nested', 'loop-log',
      'bigo-def', 'omega-theta', 'recursion-tree', 'master',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
