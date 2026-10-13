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
  // ═══ cplx.js ═══
  {
// ─── ds-1 複雜度分析：六支影片的 cued scenes（cplx-*）───
// 每個場景是一串「一句話一步」的函式：run() 在每一步之前 await step(tok)，
// 等老師講到那句話才動。動作本身很短（≤ 2.5 s），之後畫面停住等下一句。
const P = kit(ctx);
const { V3, tag, cube, kill, glow, tint, txt, code, anim, line, arrow, zone, travel, remove, step, buddy, prop, bob, icon, dim } = P;
const say = (a, b = '') => ctx.say(a, b);
const T = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const ptr = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const wait = (tok, ms) => anim(tok, ms, () => {});
const C_A = '#f4a56a', C_B = '#7cb8ee', C_C = '#9fd8b0', C_D = '#e8cf8a', C_E = '#c9b2ee', C_ROW = '#9fc7ef';
// one function per lecture sentence; each waits for its cue first
async function run(tok, fns) { for (const f of fns) { await step(tok); await f(); } }
// a row of value cubes (an array) with its index under each one
function row(vals, x0, z = 0, dx = 1.0, color = C_ROW, size = 0.8, showIdx = true) {
  return vals.map((v, i) => {
    const m = cube(v, color, [size, size * 0.8, size], x0 + i * dx, size * 0.4, z);
    if (showIdx) m.userData.ix = idx(String(i), x0 + i * dx, -0.1, z + size * 0.85);
    return m;
  });
}
// lift a cube up a little (picked out) or put it back
async function lift(tok, m, up = true, h = 0.9) {
  const y0 = m.position.y, y1 = up ? y0 + h : y0 - h;
  await anim(tok, 400, (u) => { m.position.y = y0 + (y1 - y0) * u; });
}
// grow a bar (cube) to height h
async function grow(tok, m, h, ms = 700) {
  const h0 = m.scale.y;
  await anim(tok, ms, (u) => { const s = h0 + (h - h0) * u; m.scale.y = Math.max(0.01, s); m.position.y = s / 2; });
}
function bar(color, x, z = 0, w = 0.9) { const m = cube('', color, [w, 1, w], x, 0.005, z); m.scale.y = 0.01; return m; }
// a checklist that grows downwards: add(text, cls)
function list(x, yTop, z = 0, dy = 0.55) {
  const items = [];
  return { items, add(t, cls = 'note') { const l = tag(t, cls, x, yTop - items.length * dy, z); items.push(l); return l; } };
}
// draw y = f(u) for u in [0,1] as a polyline over the box (x0..x1, y0..y1)
async function curve(tok, f, x0, x1, y0, y1, z, color, ms = 1200) {
  const N = 24; let px = x0, py = y0 + (y1 - y0) * f(0);
  for (let k = 1; k <= N; k++) {
    const u = k / N, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * f(u);
    line(px, py, x, y, z, color); px = x; py = y;
    await wait(tok, ms / N);
  }
}

// ═══════════ V42FBiohc6c：Abdul Bari〈Time Complexity of a Computer Program〉═══════════

// 0:00 Ram 和 Shyam 的兩種質數判斷法
FRAG.push(['cplx-bari-prime', '判斷質數：Ram 試到 n−1，Shyam 只試到 √n', async (tok) => {
  P.fresh([0, 6.5, 12], [0, 1.0, 0]);
  let ram, shy, q, input, defs = [], rl = [], sl = [];
  const lineup = (labels, x0, color) => labels.map((s, i) => cube(s, color, [0.9, 0.7, 0.9], x0 + i * 1.05, 0.35, 2.0));
  await run(tok, [
    () => { q = T('時間複雜度是什麼？為什麼重要？', 0, 3.4, -1.5); say('時間複雜度是什麼？', '先看一個例子'); },
    () => {
      ram = buddy('Ram', '', C_A, -4.2, 0, -0.6); shy = buddy('Shyam', '', C_B, 4.2, 0, -0.6);
      input = pkt('輸入 n', 0, 1.6, 0); T('作業：n 是不是質數？', 0, 2.4, -0.6);
      say('同一份作業：判斷 n 是不是質數', '輸入 n → 輸出「是／不是」');
    },
    () => { kill(q); defs.push(T('7 ÷ 1 ✓　7 ÷ 7 ✓　只有這兩個', 0, 3.4, -1.5)); say('質數：剛好能被兩個數整除', '1 和它自己'); },
    () => { defs.push(note('質數：2、3、5、7、11 …', 0, 0.5, 1.6)); say('最小的質數是 2', '3、5、7、11 … 一直下去'); },
    () => { defs.push(no('1 不是質數：只有 1 一個因數', 0, 4.1, -1.5)); say('1 不是質數', '質數要剛好兩個因數'); },
    () => {
      defs.forEach(kill); defs = [];
      rl = lineup(['2', '3', '…', 'n−1'], -6.0, C_A); ram.look(1);
      say('Ram：用 2 一路除到 n−1', '每個 i 都試一次');
    },
    async () => {
      const h = pkt('n ÷ i', -6.0, 1.3, 2.0);
      await travel(tok, h, V3(-6.0, 1.3, 2.0), V3(-2.85, 1.3, 2.0), 1200);
      h.element.textContent = '有 i 整除 → 不是質數';
      say('只要找到一個 i 能整除 n', 'n 就不是質數');
    },
    async () => { shy.mood('wow'); await shy.hop(tok); say('Shyam 發現：不用試到 n−1'); },
    () => { sl = lineup(['2', '3', '…', '√n'], 2.6, C_B); shy.mood('happy'); say('Shyam：只試到 √n 就夠了', '2 到 √n 都不能整除 → 質數'); },
    () => { ok('正確 ✓', -4.2, 2.3, -0.6); ok('正確 ✓', 4.2, 2.3, -0.6); say('兩個解法都正確'); },
    () => { note('n = 1 的特例另外處理', 0, 0.5, 1.6); say('1 這個特例，假設兩人都另外處理了'); },
    () => { ram.mood('sad'); shy.mood('happy'); ram.look(0); say('n 變大後：Ram 很難過，Shyam 笑了', '為什麼？'); },
  ]);
}]);

// 2:31 小輸入：看不出差別
FRAG.push(['cplx-bari-small', '代入數字：n = 11、101 時差別很小', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const ram = buddy('Ram', '', C_A, -4.6, 0, 0.6), shy = buddy('Shyam', '', C_B, 4.6, 0, 0.6);
  let cpu, board, rT, sT;
  const rows = [];
  const put = (i, s) => { txt(board.ls[i], s); };
  await run(tok, [
    () => { cpu = prop('cpu', 0, 0, -1.2, 1, '電腦先生：除一次 = 1 ms'); bob(cpu, 0.04); say('假設電腦做一次除法要 1 ms'); },
    () => { rT = note('最壞：n−2 次除法', -4.6, 2.2, 0.6); say('最壞情況（n 是質數）', 'Ram 要做 n−2 次除法'); },
    () => { sT = note('最壞：√n − 1 次', 4.6, 2.2, 0.6); say('Shyam 最壞要做 √n − 1 次'); },
    async () => {
      board = code(['  n   │ Ram   │ Shyam', '──────┼───────┼──────', '      │       │', '      │       │'], 0, 4.4, 0.5, -1.6);
      const p = pkt('n = 11', 0, 1.8, 1.4);
      put(2, '  11  │       │');
      await travel(tok, p, V3(0, 1.8, 1.4), V3(0, 1.0, 1.4), 600);
      say('先試小的：n = 11（質數）');
      rows.push(p);
    },
    () => { txt(rT, '2…10：11−2 = 9 次'); put(2, '  11  │ 9 ms  │'); ram.set('9 ms'); say('Ram 從 2 試到 10', '11 − 2 = 9 ms'); },
    () => { txt(sT, '√11 = 3.3 → 試 2、3'); put(2, '  11  │ 9 ms  │ 2 ms'); shy.set('2 ms'); say('√11 ≈ 3.3，只試 2 和 3', '3 − 1 = 2 ms'); },
    () => { note('9 ms vs 2 ms：差不多', 0, 0.4, 2.6); say('9 ms 對 2 ms', '算起來沒什麼差別'); },
    () => { txt(rows[0], 'n = 101'); put(3, ' 101  │       │'); say('換大一點：n = 101（也是質數）'); },
    () => { txt(rT, '101 − 2 = 99 次'); put(3, ' 101  │ 99 ms │'); ram.set('99 ms'); say('Ram：99 ms'); },
    () => { txt(sT, '√101 ≈ 10 → 10 − 1 = 9 次'); put(3, ' 101  │ 99 ms │ 9 ms'); shy.set('9 ms'); say('Shyam：√101 ≈ 10.0', '10 − 1 = 9 ms'); },
    () => { note('都不到 1 秒，感覺不出來', 0, 0.4, 3.3); say('兩個都不到一秒', '這麼小的 n 看不出真正差距'); },
  ]);
}]);

// 4:58 大輸入：差距爆炸
FRAG.push(['cplx-bari-big', '代入大數字：16.66 分 vs 1 秒、115 天 vs 1.66 分', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.6, 0]);
  const ram = buddy('Ram', '', C_A, -5.2, 0, 1.6), shy = buddy('Shyam', '', C_B, 5.2, 0, 1.6);
  const rb = bar(C_A, -2.0, 0), sb = bar(C_B, 2.0, 0);
  const rl = tag('', 'ptr', -2.0, 0.4, 0.9), sl = tag('', 'ptr', 2.0, 0.4, 0.9);
  idx('高度用對數刻度（每格 ×10）', 0, -0.1, 2.0);
  const H = (ms) => Math.log10(ms) * 0.42;      // log-scale bar: 10¹⁰ ms → 4.2
  const setL = (l, m, t) => { txt(l, t); l.position.y = m.scale.y + 0.4; };
  let inp;
  await run(tok, [
    () => { inp = pkt('七位數質數', 0, 3.6, -1.0); say('挑一個七位數的質數'); },
    async () => { txt(inp, 'n = 10⁶ + 3'); await grow(tok, rb, H(1e6)); setL(rl, rb, '≈ 10⁶ ms'); say('n = 10⁶ + 3', 'Ram 要將近 10⁶ ms'); },
    () => { setL(rl, rb, '10³ 秒 ≈ 16.66 分'); say('10⁶ ms = 10³ 秒', '≈ 16.66 分鐘'); },
    () => { setL(sl, sb, '√(10⁶+3) − 1'); sl.position.y = 0.6; say('Shyam：√(10⁶ + 3) − 1 次'); },
    async () => { await grow(tok, sb, H(1e3)); setL(sl, sb, '≈ 10³ ms = 1 秒'); say('n 很大時 −1 可以忽略', '≈ 10³ ms = 1 秒'); },
    () => { ram.mood('sad'); shy.mood('happy'); say('現在看得出差別了', '16.66 分 vs 1 秒'); },
    () => { txt(inp, '十一位數質數：n = 10¹⁰ + 19'); say('再挑更大的：十一位數質數', 'n = 10¹⁰ + 19'); },
    async () => { await grow(tok, rb, H(1e10), 1200); setL(rl, rb, '≈ 10¹⁰ ms'); say('Ram 的迴圈跑 n − 2 次', '≈ 10¹⁰ ms'); },
    () => { setL(rl, rb, '10⁷ 秒'); say('10¹⁰ ms = 10⁷ 秒'); },
    async () => { setL(rl, rb, '> 115 天！'); no('不切實際 ✗', -5.2, 2.6, 1.6); await ram.hop(tok); say('換成天數：超過 115 天', '程式根本不能用'); },
    async () => { await grow(tok, sb, H(1e5)); setL(sl, sb, '√10¹⁰ = 10⁵ ms'); say('Shyam：√10¹⁰ = 10⁵', '約 10⁵ ms'); },
    () => { setL(sl, sb, '100 秒 = 1.66 分'); ok('還能用 ✓', 5.2, 2.6, 1.6); say('10⁵ ms = 100 秒', '≈ 1.66 分鐘'); },
    async () => { shy.mood('happy'); ram.mood('sad'); await shy.hop(tok); say('Shyam 1.66 分鐘解完', 'Ram 要 115 天'); },
  ]);
}]);

// 8:24 時間複雜度與 Big-O
FRAG.push(['cplx-bari-bigo', '時間複雜度：O(n) 與 O(√n)', async (tok) => {
  P.fresh([0, 5.5, 12.5], [0, 2.0, 0]);
  const X0 = -5, X1 = 4, Y0 = 0.2, Y1 = 4.4;
  let ax;
  await run(tok, [
    () => {
      line(X0, Y0, X1 + 0.6, Y0, 0, '#6e5f49'); line(X0, Y0, X0, Y1 + 0.3, 0, '#6e5f49');
      idx('輸入大小 n →', X1 - 0.6, -0.2, 0.4); ax = idx('執行時間 ↑', X0 - 0.2, Y1 + 0.6, 0);
      say('時間複雜度：輸入變大時', '執行時間「長得多快」');
    },
    async () => { await curve(tok, (u) => u, X0, X1, Y0, Y1, 0, '#d0702a'); ptr('Ram：時間 ∝ n', X1 + 0.4, Y1, 0); say('Ram 的時間和 n 成正比'); },
    () => { T('order of n 的演算法', -1.6, 4.6, -1.2); say('我們說它是 order of n 的演算法'); },
    () => { tag('O(n)', 'ptr alt', X1 + 1.4, Y1 - 0.6, 0); say('這個 O 叫做 big O', '寫成 O(n)'); },
    async () => { await curve(tok, (u) => Math.sqrt(u) * 0.25, X0, X1, Y0, Y1, 0, '#2f7fc4'); ptr('Shyam：時間 ∝ √n', X1 + 0.4, Y0 + 1.4, 0); say('Shyam 的時間和 √n 成正比'); },
    () => { tag('O(√n)', 'ptr alt', X1 + 1.4, Y0 + 0.8, 0); say('order of √n', '寫成 O(√n)'); },
    () => { ok('正確 ✓ 只是基本', -2.5, 1.5, 1.6); say('程式正確不是唯一重點'); },
    () => { T('n 很大時也要跑得好', -1.0, 2.8, 1.6); say('還要看輸入很大時表現如何', '要寫出 n 大也跑得快的程式'); },
  ]);
}]);

// ═══════════ d-PDYIqg_Kc：林軒田〈Analysis Tools〉═══════════

// 1:17 為什麼需要分析工具
FRAG.push(['cplx-lin-why', '為什麼需要分析工具：怎麼比較好壞', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  let arr, mid, la, lb, c1, c2, qq;
  await run(tok, [
    () => { const tb = prop('parcel', 0, 0, -1.6, 1.1, '分析工具 Analysis Tools'); bob(tb, 0.05); say('這講的主題：Analysis Tools', '描述好壞的工具'); },
    async () => {
      arr = row([2, 5, 8, 12, 16, 23, 38], -6.2, 1.2, 0.85, C_ROW, 0.7);
      mid = pkt('index 3：直接抓中間', -3.65, 1.6, 1.2);
      await lift(tok, arr[3], true, 0.5);
      say('學過 array：排好序就能 binary search', '用 index 直接抓中間點');
    },
    () => {
      la = [P.lnode(3, 1.6, 0.35, 0.2), P.lnode(7, 3.2, 0.35, 0.2), P.lnode(9, 4.8, 0.35, 0.2)];
      lb = [P.lnode(1, 1.6, 0.35, 2.2), P.lnode(7, 3.2, 0.35, 2.2), P.lnode(8, 4.8, 0.35, 2.2)];
      idx('sparse array A（linked list）', 3.2, -0.1, 1.0); idx('sparse array B', 3.2, -0.1, 3.0);
      say('也學過 linked list 表示 sparse array', '合併、算內積');
    },
    async () => {
      c1 = pkt('游標 1', 1.6, 1.3, 0.2); c2 = pkt('游標 2', 1.6, 1.3, 2.2);
      await Promise.all([travel(tok, c1, V3(1.6, 1.3, 0.2), V3(4.8, 1.3, 0.2), 1500), travel(tok, c2, V3(1.6, 1.3, 2.2), V3(4.8, 1.3, 2.2), 1500)]);
      say('兩個游標像賽跑一樣', '各跑一條 list 到結束');
    },
    () => { qq = T('學了更多 DS 和演算法之後：怎麼比較好壞？', 0, 3.6, -1.6); say('問題來了：怎麼比較它們的好壞？'); },
    () => {
      buddy('解法 A', '快？', C_A, -4.6, 0, -2.6, 0.7); buddy('解法 B', '慢？', C_B, -3.0, 0, -2.6, 0.7); buddy('解法 C', '省記憶體？', C_C, -1.4, 0, -2.6, 0.7);
      say('同一個問題有三種演算法都能解', '誰快誰慢？誰花的記憶體多？');
    },
    () => { ok('需要一套共通的「說法」（術語）', 0, 4.4, -1.6); say('電腦科學要有一套共通的說法', '來描述 DS 和演算法的好壞'); },
  ]);
}]);

// 3:33 什麼是好程式
FRAG.push(['cplx-lin-goodprog', '好程式：requirements、correctness、文件、易讀', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let me, chk;
  await run(tok, [
    () => { prop('file', -3.5, 0, 0, 1.6, '你的程式'); me = buddy('你', '', C_B, -5.6, 0, 1.2, 0.8); chk = list(2.4, 4.0, 0); say('什麼叫做「好的程式」？'); },
    () => { chk.add('⏰ 期限內寫完（一種 requirement）'); say('也許在期限內寫完就算好', '這是一種 requirement'); },
    () => { chk.add('🎯 輸出符合題目的要求'); say('滿足題目對輸出的要求', '也是 requirement'); },
    () => { chk.add('✓ 合理的 case 都跑對', 'good'); no('segmentation fault ✗', -3.5, 2.4, 0.6); say('合理的輸入都要正確執行', '不能跑出奇怪的 segmentation fault'); },
    () => { chk.add('= requirements + correctness（基本要求）', 'ptr'); me.mood('happy'); say('這些是基本要求', 'requirements 和 correctness'); },
    () => { chk.add('🏢 給很多人用：不只寫程式本身'); say('如果程式要在業界、給很多人用', '好不好就不只看程式本身'); },
    () => { prop('file', -1.6, 0, 1.6, 0.9, '使用說明'); chk.add('📄 寫說明文件，別人好上手'); say('要寫說明文件', '讓別人很簡單就會用'); },
    async () => { chk.add('👀 程式碼易讀：好修改、好討論、好 code review'); buddy('同事', '', C_C, -0.2, 0, 2.6, 0.7); await me.hop(tok); say('程式碼要讓別人看得懂', '修改、討論、code review 都容易'); },
  ]);
}]);

// 6:10 時間資源與空間資源
FRAG.push(['cplx-lin-resources', '程式用了多少資源：時間與空間', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let cpu, disk, net, man, clock, mem, xfer;
  await run(tok, [
    () => { prop('file', 0, 0, 0, 1.3, '你的程式'); say('衡量程式的一個面向', '到底用了多少資源'); },
    () => {
      cpu = prop('cpu', -4.6, 0, -1.4, 1, '計算'); disk = prop('disk', 4.6, 0, -1.4, 1, '儲存');
      net = icon('🌐', '網路', -4.6, 0.6, 2.2); man = icon('👩‍💻', '人力', 4.6, 0.6, 2.2);
      say('資源有很多種', '計算、儲存、網路、人力…');
    },
    () => { dim(net); dim(man); say('程式「執行時」的資源', '主要看兩個面向'); },
    () => { cpu.userData.label.element.textContent = '計算資源：CPU、GPU'; glow(cpu.children[0], '#5a3a00'); say('一個是計算資源', 'CPU、GPU 做的運算'); },
    () => { clock = list(-4.6, 3.4, -1.4); clock.add('100 筆資料：1 秒？10 秒？100 秒？'); say('傳統上用「要花多少時間跑完」衡量', '→ 時間'); },
    () => { clock.add('跑了 10 分：再 2 分？還是 2000 分？', 'bad'); say('作業跑了十分鐘', '再兩分鐘還是兩千分鐘？差很多'); },
    () => { disk.userData.label.element.textContent = '記憶體、硬碟暫存'; say('另一個：程式要耗多少記憶體', '或硬碟暫存空間'); },
    () => { mem = list(4.6, 3.4, -1.4); mem.add('6.4G 讀進來：佔 6.4G？64G？640G？'); say('6.4G 資料讀進記憶體', '佔 6.4G、64G 還是 640G？'); },
    () => { mem.add('沒有 640G → 程式掛掉', 'bad'); say('記憶體不夠，存完之前就掛了', '改用硬碟暫存，量多少也重要'); },
    async () => {
      xfer = pkt('6MB？60MB？600MB？', -4.0, 1.3, 3.2);
      await travel(tok, xfer, V3(-4.0, 1.3, 3.2), V3(4.0, 1.3, 3.2), 1400);
      say('分散式環境：資料在電腦間傳來傳去', '要傳多少也重要');
    },
    () => { T('跟資料量有關 → 統稱 Space（空間）', 3.0, 4.6, -1.4); say('儲存、傳輸都跟資料量有關', '統稱 space'); },
    () => { T('時間複雜度 ／ 空間複雜度', -2.0, 5.3, -1.4); say('對應到空間複雜度', '「複雜度」= 這件事有多難、多費力'); },
    () => { ok('好演算法：時間效率高', -4.6, 2.2, 0.4); ok('好資料結構：空間效率好', 4.6, 2.2, 0.4); say('好的演算法：時間複雜度低', '好的資料結構：空間效率好'); },
    () => { note('互相搭配：合理的空間換合理的時間', 0, 0.4, 2.0); say('兩者互相搭配', '不一定要追求最小的空間'); },
    () => { prop('lock', 0, 0, 3.2, 0.8); note('嵌入式系統：每個 byte 都要省', 0, 1.2, 3.4); say('記憶體很小的嵌入式系統', '就真的要把資料壓到極限'); },
    () => { T('描述複雜度的「專有名詞」＝ 本講內容', 0, 6.0, -1.4); say('我們要的是一種「說法」', '描述複雜度的專有名詞'); },
  ]);
}]);

// 12:10 空間範例：迴圈加總
FRAG.push(['cplx-lin-spaceloop', '迴圈加總的額外空間：固定 24 bytes', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  let data, dl, cd, vars = [], tot, badge;
  const V = (name, b, x) => { const v = buddy(name, b, C_E, x, 0, 1.8, 0.62); vars.push(v); return v; };
  await run(tok, [
    () => { data = row([3, 1, 4, 1, 5, 9, 2, 6], -4.2, -1.4, 0.95, C_ROW, 0.75, false); say('例子：一個 array（或 linked list）'); },
    async () => {
      cd = code(['total = 0', 'for i = 0 … n−1:', '  total += list[i]', 'return total'], 4.2, 3.6, 0.5, -1.4);
      tot = pkt('total', -4.2, 1.4, -1.4);
      await travel(tok, tot, V3(-4.2, 1.4, -1.4), V3(2.4, 1.4, -1.4), 1400);
      say('把裡面所有數字加起來', '算總和');
    },
    () => { dl = note('資料已經放在那裡（20 個櫃子）', -0.9, 0.0, -0.3); say('算空間時：資料已經給你、放好了'); },
    () => { say('在那 20 個櫃子之外', '這段演算法還要多花多少空間？'); T('額外要多少空間？', -0.9, 2.4, 0.6); },
    () => { say('幾乎就只看：宣告了多少變數'); cd.hl(-1); },
    () => { V('total', '', -5.0); cd.hl(0); say('total：暫存總和'); },
    () => { V('i', '', -3.6); cd.hl(1); say('i：迴圈裡從頭跑到尾'); },
    () => { V('回傳值', '', -2.2); cd.hl(3); say('回傳值也可能佔一格'); },
    () => { V('list 指標', '', -0.8); V('n（長度）', '', 0.6); cd.hl(-1); say('傳進來的資料在哪、多長', 'array 指標、array 長度'); },
    () => { vars.forEach((v) => v.mood('happy')); T('就這 5 個變數', -2.2, 3.2, 1.8); say('除了資料和程式碼本身', '就是這五個變數'); },
    () => { vars[3].set('8B？4B？'); say('各系統不一樣', '指標是 8 byte 還是 4 byte？'); },
    () => { [4, 4, 4, 8, 4].forEach((b, i) => vars[i].set(b + 'B')); badge = tag('合計 24 bytes', 'ptr alt', 2.6, 1.0, 1.8); say('在某個系統上合計 24 bytes'); },
    async () => {
      for (const N of ['200 筆', '2000 筆', '2 萬筆']) { txt(dl, '資料 ' + N); await wait(tok, 500); }
      ok('資料再多，還是 24 bytes', 2.6, 2.0, 1.8);
      say('20、200、2000、2 萬筆都一樣', '額外空間跟資料量無關');
    },
  ]);
}]);

// 15:43 遞迴加總與遞迴兩要素
FRAG.push(['cplx-lin-rec2', '遞迴加總：recursive formula ＋ terminating condition', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  let arr, cd, last, br, cnt, f1, f2;
  await run(tok, [
    () => {
      arr = row([5, 2, 7, 1, 4, 3, 6, 8, 2, 3], -5.4, 0, 1.0, C_ROW, 0.75);
      cd = code(['rsum(list, n):', '  if n == 0: return 0', '  return rsum(list, n−1) + list[n−1]'], 0, 4.4, 0.5, -1.6);
      say('同一個問題，換一個演算法', 'Recursive List Summing');
    },
    async () => { cd.hl(2); await lift(tok, arr[9], true, 1.0); last = ptr('list[n−1]（最後一個）', 3.6, 2.1, 0); say('先把最後一個抓出來', 'list[n−1]'); },
    () => {
      br = P.ghostBox(C_B, 9.0, 1.0, 1.2); br.position.set(-1.4, 0.45, 0);
      T('前 n−1 個的總和', -1.4, 1.6, 0);
      say('再加上前 n−1 個的總和', '合起來就是答案');
    },
    () => { note('recursion：課本有，請自己讀', -4.0, 3.0, 1.8); say('recursion 課本上有', '不熟的請去讀'); },
    () => { T('重複「呼叫函式」：拆成同一個函式能解的小問題', 0, 5.4, -1.6); say('recursion：重複用函式呼叫', '把任務拆成同樣函式能解的小問題'); },
    () => { note('加 10 個 = 加前 9 個 ＋ 最後一個', 0, -0.6, 1.8); say('10 個數相加', '= 前 9 個相加 ＋ 最後一個'); },
    () => { f1 = ok('① recursive formula（遞迴定義）', -3.2, 3.4, 1.2); cd.hl(2); say('寫 recursion 記得兩件事', '第一：recursive formula'); },
    () => { note('較簡單但相似（n−1 個）＋ 額外運算（加最後一個）', -1.0, 2.6, 2.4); say('把複雜的事化成較簡單、長得類似的事', '再加一點額外運算'); },
    () => { f2 = ok('② terminating condition（終止條件）', 3.2, 3.4, 1.2); cd.hl(1); say('第二：terminating condition', '什麼時候停下來'); },
    async () => {
      cnt = tag('10', 'ptr alt', 0, 2.6, 2.6);
      for (const v of [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3]) { txt(cnt, String(v)); await wait(tok, 150); }
      txt(cnt, '−1、−2、−3 … 停不下來！'); no('沒有終止條件 ✗', 0, 3.3, 2.6);
      say('10→9→…→0，沒有終止條件', '就 −1、−2、−3 … 跑到天荒地老');
    },
    () => { glow(arr[0], '#0f5a3a'); say('兩件事合起來', '才是一個成功的 recursion'); },
    () => { T('迴圈：重複指令　遞迴：重複函式呼叫', 0, 6.1, -1.6); say('迴圈和遞迴都在「重複」', '迴圈重複指令，遞迴重複函式呼叫'); },
  ]);
}]);

// 19:30 遞迴版真的比較省空間嗎？
FRAG.push(['cplx-lin-recstack', '遞迴求和：每層都擱在一邊 → 約 16n bytes', async (tok) => {
  P.fresh([0, 7, 13], [0, 2.2, 0]);
  let vs = [], badge, loopB, frames = [], cmp;
  const frame = (k) => {
    const y = 0.25 + frames.length * 0.45;
    const m = cube(k + ' 號任務：16B', k === 10 ? C_A : '#f3c99a', [3.0, 0.4, 1.4], 3.0, y, -0.4);
    frames.push(m); return m;
  };
  await run(tok, [
    () => { T('那遞迴版要花多少空間？', 0, 4.8, -1.6); say('遞迴版要花多少空間？', '一樣看函式裡有哪些變數'); },
    () => {
      vs = [buddy('list', '8B', C_E, -5.6, 0, 0.6, 0.65), buddy('n', '4B', C_E, -4.3, 0, 0.6, 0.65), buddy('回傳值', '4B', C_E, -3.0, 0, 0.6, 0.65)];
      say('輸入：list 和 n', '輸出：一個回傳值 → 三個變數');
    },
    () => { badge = tag('16 bytes', 'ptr alt', -4.3, 2.3, 0.6); loopB = note('迴圈版：24 bytes', -4.3, 2.9, 0.6); say('看起來只要 16 bytes', '上一個例子要 24'); },
    () => { cmp = T('真的比較省嗎？', -4.3, 3.6, 0.6); say('真的只要 16 個 byte 嗎？', '遞迴真的比較省空間嗎？'); },
    () => { txt(cmp, '答案：沒有比較好'); vs.forEach((v) => v.mood('wow')); say('答案：沒有比前一個好'); },
    () => { frame(10); note('rsum(10) = rsum(9) + list[9]', 3.0, 0.2, 1.2); say('算 10 個元素', '換成 list[9] 加上前 9 個'); },
    () => { frame(9); say('再把前 9 個換成 list[8] + 前 8 個', '一步一步置換'); },
    () => { tag('10 號還沒做完！', 'bad', 6.0, 0.6, -0.4); say('做 9 號時，10 號還沒做完', '要等 9 號的結果（例如 5566）才能 +3'); },
    () => { tint(frames[0], '#d9b48a'); note('先擱在一邊', 6.0, 1.2, -0.4); say('電腦要有地方記住', '10 號任務先擱在一邊'); },
    () => { frame(8); tint(frames[1], '#d9b48a'); say('做 8 號時，9 號也擱在一邊'); },
    async () => { for (let k = 7; k >= 1; k--) { frame(k); await wait(tok, 160); } say('一路做到 1 號', '2～10 號全都擱在一邊'); },
    () => { T('擱在一邊 = 佔用額外空間', 3.0, 5.2, -0.4); say('「擱在一邊」要佔額外的記憶體'); },
    () => { txt(badge, '16 × n = 160 bytes（n = 10）'); frames.forEach((f) => glow(f, '#5a3a00')); say('每個任務各有自己的 16 bytes', '同時存在 → 16n，n = 10 就是 160'); },
    () => { no('n 夠大時比迴圈版（固定 24B）更耗空間', 0, 0.2, 2.8); say('n 夠大時', '反而比固定 24 bytes 的迴圈版更耗空間'); },
    () => { note('觀念不清楚：去讀課本的 recursion', -4.3, 4.3, 0.6); say('對 recursion 不熟的', '強烈建議去讀課本'); },
    () => { note('tail recursion：某些語言可以省下來（閱讀作業）', -2.0, 5.6, -1.6); say('課本的 tail recursion', '某些語言可以變精簡，不佔那麼多空間'); },
    () => { T('要能比較：花多少空間、多少時間', 0, 6.3, -1.6); say('看程式碼要能算出空間、時間', '再拿來比較'); },
  ]);
}]);

// 26:10 時間範例：矩陣加法
FRAG.push(['cplx-lin-matrix', '矩陣加法：p、q、r、s、t 這些常數', async (tok) => {
  P.fresh([0, 7, 13], [0, 1.4, 0]);
  const grid = (x0, color, name) => { const g = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.push(cube('', color, [0.5, 0.3, 0.5], x0 + c * 0.6, 0.15, -1.6 + r * 0.6)); idx(name, x0 + 0.9, -0.1, 0.4); return g; };
  let A, B, C, cd, cost, hand;
  await run(tok, [
    () => { A = grid(-6.4, C_A, 'A'); B = grid(-3.4, C_B, 'B'); T('+', -3.7, 0.6, -1.0); say('換時間複雜度：兩個二維矩陣相加'); },
    () => { C = grid(0.6, '#e0ddd5', 'C（先配置好）'); T('=', -0.7, 0.6, -1.0); say('dense 矩陣，A、B、C 的空間都先配置好'); },
    () => { cd = code(['for (i = 0; i < rows; i++)', '  for (j = 0; j < cols; j++)', '    C[i][j] = A[i][j] + B[i][j];'], 4.6, 3.6, 0.5, -1.6); say('兩個 for 迴圈跑過去', '就算出 C'); },
    () => { cost = list(-3.0, 4.6, 1.0); cost.add('要花多少時間？怎麼表達？', 'say'); say('怎麼表達它要花多少時間？'); },
    () => { cost.add('估計：大概要幾步機器碼'); say('姑且算它要幾步機器碼'); },
    async () => {
      cd.hl(1); hand = pkt('j', 0.6, 0.8, -1.6);
      await travel(tok, hand, V3(0.6, 0.8, -1.6), V3(2.4, 0.8, -1.6), 1000);
      say('中間的 for 迴圈跑了 cols 次');
    },
    async () => {
      cd.hl(2);
      for (let k = 0; k < 4; k++) { tint(C[k], '#f0b77a'); await wait(tok, 200); }
      cost.add('每次：取 A、取 B、相加、存 C ＝ p');
      say('每次取 A、取 B、加起來存進 C', '假設花 p（例如 10 秒 × 100 欄 = 1000 秒）');
    },
    () => { cost.add('內層 ≈ p·cols + q'); say('為什麼後面還要加 q？'); },
    () => { note('j++ 每輪都有 → 算在 p', 4.6, 1.6, 0); say('j++ 確實執行 cols 次', '它的成本算進 p'); },
    () => { note('j = 0 只做一次 → 放進 q', 4.6, 1.0, 0); say('j = 0 只在開頭做一次', '跟 cols 無關 → 放進 q'); },
    async () => {
      cd.hl(0);
      for (let k = 4; k < 12; k++) { tint(C[k], '#f0b77a'); if (k % 4 === 3) await wait(tok, 250); }
      cost.add('內層合起來叫 r；外層跑 rows 次：s、t');
      say('內層總共叫 r', '外層跑 rows 次：有關的放 s、無關的放 t');
    },
    () => { cost.add('總共 ≈ rows·cols·p ＋ rows·(q+s) ＋ t', 'ptr'); say('加起來：rows × cols 乘上 p', '再加上其他項'); },
    () => { cost.add('（還有函式呼叫的 overhead）'); say('還可能有函式呼叫的 overhead'); },
    () => { prop('cpu', -5.6, 0, 2.6, 0.8, 'CPU 快 2 倍 → 秒數約減半'); say('p、q、r、s、t 在特定電腦上是常數', '跟計算平台有關'); },
  ]);
}]);

// 31:00 忽略常數：「差不多」的說法
FRAG.push(['cplx-lin-rough', '「差不多先生」：只留 rows × cols', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let f, big, me;
  await run(tok, [
    () => { f = tag('rows·cols·p ＋ rows·(q+s) ＋ t', 'ptr alt', 0, 3.6, -1.0); T('平台不知道 → p～t 很難估', 0, 4.5, -1.0); say('不知道計算平台', '很難估出 p、q、r、s、t'); },
    () => { T('能分析的：成本 ↔ rows、cols 的關係', 0, 2.7, -1.0); say('設計演算法時能分析的', '是成本跟輸入大小的關係'); },
    () => { me = buddy('分析的人', '', C_B, -4.6, 0, 1.4, 0.8); me.mood('calm'); say('分析的時候', '根本不想管 p、q、r、s、t'); },
    () => { prop('cpu', 4.6, 0, 1.4, 0.9, '換台更快的電腦'); say('真想讓常數變小', '換一台快一點的電腦就好'); },
    () => { note('這些常數在演算法分析上不重要', 0, 1.2, 2.2); say('跟平台有關的常數', '在演算法分析上不太重要'); },
    () => { note('但實際上線時，可能決定跑不跑得完', 0, 0.6, 2.8); say('不是說常數不重要', '真的上線時，它可能決定跑不跑得完'); },
    async () => { me.mood('happy'); await me.hop(tok); T('差不多先生（rough）', -4.6, 2.4, 1.4); say('我們要一種「差不多」的說法', '英文叫 rough'); },
    () => { txt(f, 'rows·cols·p ＋ …'); note('內層 ≈ cols 的力氣（p、q 塗掉）', 0, 4.5, 0.2); say('內層迴圈：差不多 cols 的力氣', '把 p、q 都塗掉'); },
    () => { txt(f, '≈ rows × cols'); glow(me.body, '#0f5a3a'); say('總共差不多 rows × cols'); },
    () => { big = row(['', '', '', '', '', ''], -2.5, -2.4, 1.0, C_A, 0.6, false); idx('rows × cols = 矩陣的元素個數', 0, -0.1, -1.6); say('rows × cols', '就是矩陣裡的元素個數'); },
    () => { T('1000 個元素 ≈ 1000 的力氣；100 萬 ≈ 100 萬', 0, 5.4, -1.0); say('1000 個元素：約 1000 的力氣', '100 萬個：約 100 萬'); },
    () => { ok('下一步：用數學精確定義「差不多」', 0, 6.2, -1.0); say('接下來：用數學方式', '定義什麼叫「差不多」'); },
  ]);
}]);

// ═══════════ 8IOv2fnc01E：林軒田〈Introduction to Data Structures and Algorithms〉═══════════
const MIN8 = [7, 4, 9, 6, 8, 2, 5, 3];        // 示範用：最小值 2 在第 5 個位置

// 15:23 演算法＝程式譜
FRAG.push(['cplx-intro-recipe', '演算法是什麼：程式譜', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let pc;
  await run(tok, [
    () => { T('什麼是演算法（algorithm）？', 0, 4.2, -1.2); say('從 Algorithm 開始講起', '什麼是演算法？'); },
    () => { prop('file', -4.5, 0, 0, 1.1, '樂譜'); icon('🎻', '演奏', -4.5, 2.6, 0); say('演算法就是一種「譜」', '學樂器有樂譜'); },
    () => { prop('file', -1.5, 0, 0, 1.1, '食譜'); icon('🍳', '做菜', -1.5, 2.6, 0); say('武俠小說有暗器譜', '煮飯有食譜'); },
    () => { prop('file', 1.5, 0, 0, 1.1, '程式譜 = algorithm'); icon('💻', '計算', 1.5, 2.6, 0); say('Algorithm 就是「程式譜」'); },
    () => { pc = prop('cpu', 4.6, 0, 0, 1, '電腦'); bob(pc, 0.04); arrow(V3(2.4, 0.6, 0), V3(3.8, 0.6, 0), 0xa8730f); say('它描述計算的方式', '怎麼叫電腦做事'); },
    async () => { const s = pkt('指令 1 → 指令 2 → 指令 3', 1.5, 1.9, 1.2); await travel(tok, s, V3(1.5, 1.9, 1.2), V3(4.6, 1.9, 1.2), 1200); say('要下哪一串指令', '用什麼樣的步驟'); },
    () => { ok('正確 ✓　有效率 ✓', 4.6, 3.0, 0); say('照著步驟做，電腦就能', '正確、而且有效率地算出結果'); },
  ]);
}]);

// 17:40 看待演算法的五個面向
FRAG.push(['cplx-intro-five', '演算法的五個面向（Knuth）', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let inp, algo, out, pg, pc, cards = list(0, 4.6, -2.4, 0.55);
  await run(tok, [
    async () => {
      algo = prop('file', 0, 0, 0, 1.2, '演算法'); inp = prop('parcel', -4.8, 0, 0, 0.8, '輸入資料');
      const d = pkt('資料', -4.8, 1.4, 0); await travel(tok, d, V3(-4.8, 1.4, 0), V3(-0.6, 1.4, 0), 1000); remove(d);
      cards.add('① Input：拿來處理的資料');
      say('第一個面向：輸入', '電腦是用來處理資料的');
    },
    async () => {
      out = prop('parcel', 4.8, 0, 0, 0.8, '想要的形式');
      const d = pkt('結果', 0.6, 1.4, 0); await travel(tok, d, V3(0.6, 1.4, 0), V3(4.6, 1.4, 0), 1000); remove(d);
      cards.add('② Output：運算後變成想要的形式');
      say('經過運算，變成想要的形式', '→ 輸出（少數短程式可以沒有輸入）');
    },
    () => { pg = buddy('programmer', '', C_B, -3.0, 0, 2.2, 0.8); cards.add('③ Definiteness：寫清楚、不模稜兩可'); say('描述要明確', '不能模稜兩可'); },
    () => { pg.set('打蛋！'); pg.mood('happy'); note('食譜寫「打蛋」→ 廚師看了就做', -3.0, 2.4, 2.2); say('像番茄炒蛋的食譜寫「打蛋」', '看的人照著就做得到'); },
    () => { pc = prop('cpu', 3.0, 0, 2.2, 0.9, 'computer'); cards.add('④ Effectiveness：電腦做得到'); say('Effectiveness：電腦要做得到', '不能天馬行空變魔術'); },
    () => { note('平行演算法 → 一般平台做不到', 3.0, 1.4, 3.2); say('跟平台有關', '平行演算法放到一般平台就做不到'); },
    () => { idx('Definiteness 給人看', -3.0, -0.1, 3.2); idx('Effectiveness 給電腦做', 3.0, -0.1, 3.6); say('Definiteness 是給 programmer 看', 'Effectiveness 是給 computer 做'); },
    () => { cards.add('⑤ Finiteness：照步驟做，最後會停'); say('程式要跑得完、要能停下來', '不能跑到天荒地老'); },
    () => { no('不是「程式碼行數有限」', 0, 2.4, 1.0); say('不是說程式只有有限行', '兩三行就能寫出無窮迴圈'); },
    () => { ok('Output 隱含：要正確', 4.8, 2.0, 0); say('輸出隱含著「要正確」', '不能隨便吐一個答案'); },
    () => { T('五個面向：Stanford 的 Knuth 提出', 0, 5.4, -2.4); say('這五個面向由演算法大師', 'Stanford 退休教授 Knuth 提出'); },
  ]);
}]);

// 23:50 例子：找陣列最小值的 index
FRAG.push(['cplx-intro-minidx', '找最小值的 index：先抓第 0 個，再一路比', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  let arr, cd, hand, cur, chk;
  await run(tok, [
    () => { arr = row(MIN8, -3.5, 0, 1.0); say('需求：給一個 array'); },
    async () => { await lift(tok, arr[5], true, 0.6); ptr('最小的在第 5 個位置', 1.5, 2.0, 0); say('想找出最小值在哪個位置', '例如在第 5 個'); },
    async () => { await lift(tok, arr[5], false, 0.6); cd = code(['int getMinIndex(int arr[], int len) {', '  int m = 0;', '  for (i = 1; i < len; i++)', '    if (arr[i] < arr[m]) m = i;', '  return m;', '}'], 0, 4.8, 0.48, -1.8); say('用 C 寫 get minimum index', '給它 array 和長度'); },
    () => { cd.hl(1); hand = buddy('m（抓在手上）', '0', C_A, -5.6, 0, 1.6, 0.75); say('先把要回傳的位置存下來', '再跑一個 for 迴圈'); },
    () => { glow(arr[0], '#5a3a00'); hand.mood('happy'); say('第 0 個先不比', '假設它就是最小的，抓在手上'); },
    async () => {
      cd.hl(2); cur = pkt('i', -2.5, 1.4, 0);
      let m = 0;
      for (let i = 1; i < 8; i++) {
        cur.position.set(-3.5 + i, 1.4, 0); await wait(tok, 220);
        if (MIN8[i] < MIN8[m]) { glow(arr[m], null); m = i; glow(arr[m], '#5a3a00'); hand.set(String(m)); }
      }
      say('每一個都跟手上那個比較');
    },
    () => { cd.hl(3); note('比較小 → 換成抓這個', -5.6, 2.5, 1.6); say('發現比較小的', '就把它的位置存下來'); },
    async () => { cd.hl(4); await hand.hop(tok); say('最後把結果回傳', 'm = 5'); },
    () => { chk = list(4.6, 3.0, 1.6); chk.add('Input：array（與長度）'); say('對照五個面向：輸入', '是 array 和它的長度'); },
    () => { chk.add('Output：最小元素的 index'); say('輸出：最小元素的 index'); },
    () => { chk.add('Definiteness：用 C 寫，看得懂 ✓', 'good'); cd.hl(-1); say('用 C 語言寫，懂 C 的人看得懂', '明確性沒問題'); },
    () => { chk.add('Effectiveness：compiler → 機器碼 ✓', 'good'); prop('cpu', -5.6, 0, -1.6, 0.7); say('compiler 把 for、if 變成機器碼', '一般電腦做得到'); },
    () => { chk.add('Finiteness：只有一個 for，會停 ✓', 'good'); say('只有一個 for 迴圈', '給正確的輸入就會停'); },
    () => { chk.add('正確性：怎麼說服別人？', 'bad'); say('輸出要正確', '要怎麼說服別人它是對的？'); },
    () => { T('靠數學證明（proof）', 4.6, 3.8, 1.6); say('需要靠數學證明'); },
  ]);
}]);

// 30:57 正確性證明：loop invariant
FRAG.push(['cplx-intro-invariant', 'Loop invariant：每輪結束都成立的性質', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  const arr = row(MIN8, -3.5, 0, 1.0);
  let claim, inv, box, kL, hand;
  const cover = (k) => { box.scale.x = (k + 1); box.position.x = -3.5 + k / 2; txt(kL, 'arr[0..' + k + '] 的最小值'); kL.position.x = -3.5 + k / 2; };
  await run(tok, [
    () => { claim = T('先把「正確」寫成數學命題', 0, 4.4, -1.4); say('先把正確性', '變成一個數學命題'); },
    () => { hand = buddy('m', '5', C_A, 5.6, 0, 1.0, 0.75); say('演算法回傳一個 m'); },
    () => { txt(claim, 'arr[m] ≤ 任何其他 arr[j]'); glow(arr[5], '#5a3a00'); say('m 的性質：arr[m] 不比任何 arr[j] 大', '也就是最小值'); },
    () => { note('len = 1000 要跑 1000 步…不好直接證', 0, 3.6, -1.4); say('跑了上千步', '乍看不容易證明'); },
    () => { inv = T('改證：第 k 輪結束時…', 0, 2.8, 1.6); glow(arr[5], null); say('改成看迴圈的每一輪', '每一輪結束時發生什麼事'); },
    () => {
      box = P.ghostBox('#e8b04a', 1, 1.2, 1.2); box.position.set(-3.5, 0.5, 0);
      kL = ptr('', -3.5, 1.5, 0); cover(1); hand.set('0'); glow(arr[0], '#5a3a00');
      say('一開始抓住第 0 個', '第 1 輪：比第 1 個和第 0 個');
    },
    async () => { glow(arr[0], null); glow(arr[1], '#5a3a00'); hand.set('1'); cover(2); await wait(tok, 400); say('第 2 輪：第 2 個跟目前比較小的比', '每輪多檢查一個'); },
    () => { txt(inv, '第 k 輪結束：m 存的是 arr[0..k] 的最小值'); say('第 k 輪結束時', 'm 存的是 0 到 k 範圍內的最小值'); },
    () => { ok('k = 1 成立：容易驗證', -4.6, 3.4, 1.6); say('i = 1 時不難證明'); },
    () => { ok('假設 k 成立 → 證 k+1 也成立', 0, 3.4, 2.6); say('假設 i = k 對', '證明 i = k+1 也對 → 數學歸納法'); },
    async () => {
      for (let k = 3; k <= 7; k++) { cover(k); if (MIN8[k] < MIN8[Number(hand.val.element.textContent)]) { arr.forEach((a) => glow(a, null)); glow(arr[k], '#5a3a00'); hand.set(String(k)); } await wait(tok, 300); }
      hand.mood('happy');
      say('1、2、3 … 一路到 len−1 都對', '演算法最後就是對的');
    },
    () => { note('離散數學：證明技巧與數學工具', -4.6, 2.6, 2.6); say('像數學歸納法這類工具', '離散數學課會教'); },
    () => { tag('loop invariant：迴圈裡維持不變的性質', 'ptr alt', 0, 5.2, -1.4); say('這種每輪結束都成立的性質', '叫做 loop invariant'); },
  ]);
}]);

// 37:24 效率：淘汰賽
FRAG.push(['cplx-intro-tournament', '淘汰賽找最小值：一樣 7 次比較，但能平行', async (tok) => {
  P.fresh([0, 7, 13], [0, 1.6, 0]);
  let arr, eff, cnt, lv1 = [], lv2 = [], lv3, cpus = [];
  const X = (i) => -3.5 + i;
  await run(tok, [
    () => { T('五個 criteria 沒有 efficiency…', 0, 5.0, -2.0); say('五個 criteria 沒有特別講 efficiency'); },
    () => { eff = T('但「有效率」一直是潛藏的願望', 0, 4.3, -2.0); say('但讓電腦有效率地計算', '一直是潛藏的願望'); },
    () => { note('array 變 2 倍、10 倍大 → 要多花多少時間？', 0, 3.6, -2.0); say('array 變兩倍、十倍大', '演算法會多花多少時間？'); },
    () => { arr = row(MIN8, -3.5, 1.6, 1.0); say('剛才的做法：一個一個掃過去'); },
    async () => { cnt = tag('比較 1 次', 'ptr alt', 5.4, 1.0, 1.6); lv1.push(cube(4, C_A, [0.7, 0.55, 0.7], -3.0, 1.6, 1.6)); await wait(tok, 300); say('換個方式：先比第 0 個和第 1 個', '小的留下'); },
    async () => {
      for (const [a, b] of [[2, 3], [4, 5], [6, 7]]) { const w = Math.min(MIN8[a], MIN8[b]); lv1.push(cube(w, C_A, [0.7, 0.55, 0.7], (X(a) + X(b)) / 2, 1.6, 1.6)); await wait(tok, 250); }
      txt(cnt, '比較 4 次');
      say('第 2、3 個比；4、5 比；6、7 比');
    },
    () => { [0, 2, 4, 6].forEach((i) => tint(arr[i], '#d8cfc0')); say('像淘汰賽：小的是贏家', '大的是輸家，淘汰掉'); },
    async () => {
      lv2 = [cube(4, C_A, [0.7, 0.55, 0.7], -2.0, 3.0, 1.6), cube(2, C_A, [0.7, 0.55, 0.7], 2.0, 3.0, 1.6)]; txt(cnt, '比較 6 次'); await wait(tok, 400);
      lv3 = cube(2, '#e8b04a', [0.8, 0.6, 0.8], 0, 4.3, 1.6); txt(cnt, '比較 7 次');
      say('8 個 → 4 個 → 2 個 → 1 個', '最後還是找到最小的');
    },
    () => { note('每場比賽都要花一點計算力氣', -5.4, 3.0, 1.6); say('怎麼分析它花多少力氣？', '每畫一場比賽就要花一次比較'); },
    () => { tag('淘汰賽：7 次　逐一掃描：也是 7 次', 'ptr alt', 0, 5.6, 0.6); say('8 筆資料：淘汰賽比 7 次', 'for 迴圈逐一掃描也是 7 次'); },
    () => { no('沒有比較快', 5.4, 2.0, 1.6); say('淘汰賽演算法', '其實沒有比較快'); },
    () => { for (let k = 0; k < 4; k++) cpus.push(prop('cpu', -3.0 + k * 2, 0, -1.4, 0.55)); say('但它可以高度平行化', '有 4 顆 CPU 的話…'); },
    async () => { lv1.forEach((m) => glow(m, '#0f5a3a')); await wait(tok, 300); ok('第一輪 4 場：1 個單位時間', 0, 1.0, -0.4); say('4 場比賽同時比', '一個單位時間就做完'); },
    () => { T('效率跟平台高度相關', 0, 6.3, 0.6); say('演算法的效率', '跟所用的平台高度相關'); },
  ]);
}]);

// 43:04 問答：淘汰賽會比較慢嗎？
FRAG.push(['cplx-intro-hidden', '問答：淘汰賽的隱藏成本', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.0, 0]);
  let q, l;
  await run(tok, [
    () => { q = T('同學：淘汰賽這樣會比較慢吧？', 0, 3.8, -1.0); buddy('同學', '？', C_C, -4.4, 0, 0.6, 0.8); say('同學問：淘汰賽會不會比較慢？'); },
    () => { l = list(2.4, 2.8, 0.4); l.add('比較次數：7 次 vs 7 次', 'good'); say('只看比較次數', '8 個元素都是 7 次，沒有比較慢'); },
    () => { cube('結果', '#f3c99a', [0.9, 0.6, 0.9], -0.6, 0.3, 1.6); l.add('要先存比賽結果 → 額外存取時間', 'bad'); say('但可能有隱藏的成本', '比賽結果要先存下來'); },
    () => { l.add('多的變數、多的迴圈 → 額外時間', 'bad'); say('還需要多的變數、不同的迴圈'); },
    () => { l.add('要「說清楚為什麼」並不容易', 'ptr'); say('可能比較慢', '但要好好說出為什麼，不容易'); },
  ]);
}]);

// 48:43 Pseudocode：電腦科學的口語
FRAG.push(['cplx-intro-pseudo', 'Pseudocode：電腦科學的口語', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let c, ps, pg, pg2;
  await run(tok, [
    () => { c = code(['int getMinIndex(int arr[], int len) {', '  int m = 0; int i;', '  for (i = 1; i < len; i++) {', '    if (arr[i] < arr[m]) { m = i; }', '  }', '  return m;', '}'], -3.6, 4.6, 0.46, -1.6); say('剛才用程式碼表示演算法'); },
    () => { prop('cpu', -3.6, 0, 1.4, 0.8, 'compiler 要看得懂'); say('程式碼的定義非常嚴謹', 'compiler 要看得懂'); },
    () => { pg = buddy('程式設計師 A', '', C_B, 1.6, 0, 1.6, 0.7); pg2 = buddy('B', '？', C_C, 4.6, 0, 1.6, 0.7); say('直接用程式碼溝通', '不一定有效率'); },
    () => { T('pseudo code：虛擬的程式', 3.4, 4.6, -1.6); say('電腦科學常用 pseudo code', '虛擬的程式'); },
    () => { note('像說話：不必照文法，但意思清楚', 3.4, 3.9, -1.6); say('就像日常口語', '不那麼嚴謹，但能把意思說清楚'); },
    async () => { const s = pkt('演算法（譜）', 1.6, 2.0, 1.6); await travel(tok, s, V3(1.6, 2.0, 1.6), V3(4.6, 2.0, 1.6), 1000); pg2.set('懂了'); pg2.mood('happy'); say('algorithm 是「譜」', '要拿來溝通、傳承'); },
    () => { c.hl(0); say('例如 get minimum index'); },
    () => { ps = code(['getMinIndex(integer array arr, length len)', '  minPos ← 0', '  for i from 1 to len−1', '    if arr[i] < arr[minPos]', '      minPos ← i', '  return minPos'], 3.2, 3.2, 0.46, -0.2); ps.hl(1); say('minimum position 先 assign 成 0'); },
    () => { ps.hl(2); c.hl(2); say('for i from 1 to len−1', '不綁特定語言'); },
    () => { c.hl(-1); no('不需要分號、大括號', -3.6, 1.2, 0.2); say('不用照 C 的文法', '分號、大括號都不必'); },
    () => { ps.hl(4); ok('意圖：初始化 → 跑迴圈 → 條件成立就更新', 3.2, 0.5, 1.0); say('重點是把意圖表達出來', '初始化、跑迴圈、在條件成立時更新'); },
    () => { ps.hl(-1); T('沒有嚴格規定 → 先看什麼是「不好的」', 0, 5.6, -1.6); say('pseudocode 沒有嚴格規定', '通常比較容易說什麼是不好的'); },
  ]);
}]);

// 54:00 不好的 pseudocode
FRAG.push(['cplx-intro-badpseudo', '不好的 pseudocode：太詳細、太神秘、太抽象', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let a, b, c, r = buddy('讀的人', '', C_C, 0, 0, 2.6, 0.75);
  await run(tok, [
    () => { T('① 太詳細', -4.6, 5.0, -1.6); say('一種不好的：太詳細', '細節多到蓋過真正的意圖'); },
    () => { a = code(['x ← arr[i]', 'y ← arr[minPos]', 'if x < y then', '  minPos ← i'], -4.6, 4.3, 0.46, -1.6); r.mood('sad'); say('明明一行就能比', '偏要先放進兩個新變數再比'); },
    () => { note('i 的宣告：for 迴圈裡已經隱含 → 省略', -4.6, 2.2, -1.0); say('i 的宣告也拿掉', '意圖已經藏在 for 迴圈裡'); },
    () => { T('② 太神秘', 0, 5.0, -1.6); say('另一種不好的', '寫完別人看不懂'); },
    () => { r.set('？？'); say('太神妙，沒人搞得懂', '或要花額外腦力才懂'); },
    () => { note('minimum position：名字就在暗示用途', 0, 2.2, -1.0); say('變數叫 minimum position', '名字就暗示在做什麼'); },
    () => { b = code(['a ← 0', 'for b from 1 to len−1', '  if arr[b] < arr[a]', '    a ← b'], 0, 4.3, 0.46, -1.6); say('改成 a、b 這種亂取的名字', '每行看得懂，意圖看不懂'); },
    () => { ok('目標：communicate correctly', 0, 1.5, -1.0); say('pseudocode 的目標是溝通', '而且要溝通「正確」'); },
    () => { note('靠變數命名、註解傳達意圖', 0, 0.8, -1.0); say('用變數命名、加註解', '讓讀的人瞭解你的意圖'); },
    () => { T('③ 太抽象（惜字如金）', 4.6, 5.0, -1.6); say('第三種：太抽象', '惜字如金'); },
    () => { c = code(['run a loop that updates', 'minimum position in', 'every iteration'], 4.6, 4.3, 0.46, -1.6); r.set('…？'); say('只寫一句：run a loop that updates…', '多數人沒辦法完整理解'); },
    () => { r.set('懂了'); r.mood('happy'); tag('字太少 ⟷ 字太多：取得平衡、清楚表達', 'ptr alt', 0, 0.2, 1.0); say('在字太少和字太多之間', '取得平衡，清楚表達'); },
  ]);
}]);

// 1:00:30 好的 pseudocode：selection sort
FRAG.push(['cplx-intro-selsort', '好的 pseudocode：selection sort', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const a = MIN8.slice();
  let arr, ps, iP;
  const swapAt = async (i, j) => {
    if (i === j) return;
    const mi = arr[i], mj = arr[j], xi = mi.position.x, xj = mj.position.x;
    await anim(tok, 450, (u) => { mi.position.x = xi + (xj - xi) * u; mj.position.x = xj + (xi - xj) * u; mi.position.y = mj.position.y = 0.32 + Math.sin(u * Math.PI) * 0.6; });
    arr[i] = mj; arr[j] = mi; [a[i], a[j]] = [a[j], a[i]];
  };
  const round = async (i) => { let m = i; for (let k = i + 1; k < 8; k++) if (a[k] < a[m]) m = k; iP.position.x = -3.5 + i; await swapAt(i, m); tint(arr[i], '#9fd8b0'); };
  await run(tok, [
    () => { T('從 get minimum index 升級', 0, 4.8, -1.6); say('好的 pseudocode 長什麼樣？', '從 get minimum index 出發'); },
    () => { arr = row(a, -3.5, 1.4, 1.0, C_ROW, 0.8, false); say('selection sort：一個一個把最小的挑出來', '放到該放的位置'); },
    () => { ps = code(['selectionSort(integer array arr, integer len)', '  for i from 0 to len−1', '    // 在 i～len−1 找最小值的 index', '    m ← getMinIndex(arr, i, len−1)', '    swap arr[i] and arr[m]'], 0, 4.2, 0.46, -1.6); ps.hl(0); say('input：integer array 和長度'); },
    () => { ps.hl(1); iP = ptr('i', -3.5, 2.3, 1.4); say('主要意念：每一輪選出最小的', '排到正確的位置'); },
    () => { ps.hl(2); const g = P.ghostBox('#e8b04a', 8, 1, 1.1); g.position.set(0, 0.4, 1.4); say('寫個註解：在 i 到 len−1 的範圍', '找 minimum index'); },
    () => { ps.hl(3); glow(arr[5], '#5a3a00'); say('呼叫剛才寫好的那段程式'); },
    async () => { ps.hl(4); glow(arr[5], null); await round(0); say('把最小的換到第 i 個位置'); },
    () => { ps.hl(-1); note('還沒排好的裡面找最小 → 放到前面', 0, 0.0, 2.6); say('演算法的描述：從還沒排好的找最小', '放到前面'); },
    async () => { await round(1); await round(2); say('第 0 小放第 0 位、第 1 小放第 1 位', '第 2 小放第 2 位…'); },
    async () => { for (let i = 3; i < 8; i++) await round(i); ok('array 排好了 ✓', 4.6, 2.4, 1.4); say('做完這些步驟', 'array 就排好了'); },
    () => { T('沒有嚴格定義，但多數程式設計師都看得懂', 0, 5.5, -1.6); say('沒有嚴格的定義', '但這樣寫大多數人都能理解'); },
    () => { note('手寫作業：用 pseudocode 描述你的想法', 0, -0.6, 2.6); say('手寫作業多半要用 pseudocode', '讓助教看得懂'); },
  ]);
}]);

// 1:04:30 問答：pseudocode vs 註解、← 是什麼
FRAG.push(['cplx-intro-arrow', '問答：pseudocode 和註解差在哪、← 是 assignment', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let l, sw, ar;
  await run(tok, [
    () => { T('問：跟寫好的程式加註解有什麼差別？', 0, 4.4, -1.4); buddy('同學', '？', C_C, -5.0, 0, 1.0, 0.75); say('同學問：這跟程式裡寫註解', '有什麼差別？'); },
    () => { l = list(-1.0, 3.4, -0.4); l.add('pseudocode 不一定是完整、嚴格的程式'); say('pseudocode 不一定是完整、嚴格的程式'); },
    () => { l.add('程式很大時，宣告等細節反而礙事', 'bad'); say('程式很大的時候', '光寫變數宣告就煩死了'); },
    () => { sw = code(['t = a;', 'a = b;', 'b = t;'], 4.4, 2.8, 0.46, 0); note('「交換」要寫三行', 4.4, 1.0, 0); say('很簡單的概念，像交換兩個東西', '程式碼要寫兩三行'); },
    () => { l.add('只想讀懂概念 → 非正式的程式更有效率', 'good'); txt(sw.ls[0], 'swap a, b'); txt(sw.ls[1], ''); txt(sw.ls[2], ''); say('只想懂概念時', 'pseudocode 這種非正式程式比較有效率'); },
    () => { ar = tag('minPos <- 0　？', 'ptr alt', 0, 0.6, 2.2); say('「<-」是什麼意思？', '本來應該畫箭頭，打字打不出來'); },
    () => { txt(ar, 'minPos ← 0　＝ 把 0 放進 minPos'); say('pseudocode 常用箭頭', '代表 assignment（賦值）'); },
    () => { note('C 用「=」；pseudocode 用「←」強調「把值放進去」', 0, -0.2, 2.6); say('C 語言用 =', 'pseudocode 用左箭頭強調「放進去」'); },
  ]);
}]);

// 1:08:12 Data structure 是什麼
FRAG.push(['cplx-intro-dsdef', 'Data structure：在電腦裡收納資料的方式', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.4, 0]);
  let papers = [], lbl;
  const pile = (x, z, n, color) => { const g = []; for (let k = 0; k < n; k++) g.push(cube('', color || '#ffffff', [0.9, 0.06, 1.2], x, 0.04 + k * 0.08, z)); return g; };
  await run(tok, [
    () => { T('接下來：data structure 是什麼？', 0, 4.8, -1.8); say('講完 algorithm', '接下來是 data structure'); },
    () => { tag('organizing your data：整理資料的方式', 'ptr alt', 0, 4.1, -1.8); say('Data structure：在電腦裡', '整理你的資料的方式'); },
    () => { icon('👕', '衣櫃：收衣服', -5.0, 2.6, -1.0); icon('🧂', '調味料櫃', -3.0, 2.6, -1.0); say('其實就是「收納」', '衣櫃收衣服、櫃子收調味料'); },
    () => { note('structure = 一種收納方式；這裡收的是資料', 0, 3.3, -1.8); say('structure 是收納的方式', '這裡要收納的是資料'); },
    () => { icon('🧊', '冰箱：food structure', -1.0, 2.6, -1.0); say('冰箱是你的 food structure'); },
    () => { icon('🎻', '樂團：player structure', 1.0, 2.6, -1.0); say('交響樂團是收納演奏者的方式', '對應樂譜：player structure'); },
    async () => { const d = pkt('input → algorithm → output：都是 data', 3.6, 2.6, -1.0); await wait(tok, 300); say('algorithm 把 input 變成 output', '從宏觀看，這些都是 data'); },
    () => { prop('disk', 5.2, 0, 1.0, 0.8, '記憶體？磁碟？'); say('這些 data 要怎麼擺、放在哪', '就是 data structure'); },
    () => { icon('🗄️', '整整齊齊／依顏色分', -5.0, 0.6, 1.6); icon('🌀', '亂七八糟丟進去', -3.0, 0.6, 1.6); say('每個人的衣櫃收法不一樣', '有的整齊，有的亂丟'); },
    () => { papers = pile(-0.4, 1.6, 12); lbl = T('200 份考卷要發回去', 0.6, 1.6, 2.8); say('例子：200 份考卷要發回去', '怎麼收納才能讓大家很快拿到？'); },
    () => { papers.forEach((p, k) => { p.position.x = -0.4 + (k % 3 - 1) * 0.12; p.rotation.y = (k % 4) * 0.2; }); txt(lbl, '① 照交卷順序隨便疊'); say('隨便疊：交來或改完的順序'); },
    () => { papers.forEach((p) => { p.rotation.y = 0; p.position.x = -0.4; }); txt(lbl, '② 依分數高到低排'); say('依分數從高排到低', '方便看分布、比較'); },
    () => { txt(lbl, '③ 依學號排'); say('依學號排', '老師登記成績比較方便'); },
    () => { papers.forEach(kill); papers = []; for (let d = 0; d < 10; d++) pile(-1.8 + (d % 5) * 0.75, 1.0 + Math.floor(d / 5) * 1.3, 2, d % 2 ? '#f3e7c8' : '#ffffff'); txt(lbl, '④ 依學號尾數分 10 堆'); say('依學號尾數分成 10 堆', '發回去時大家各自去找'); },
    () => { note('領口罩：身分證尾數奇偶分流', 4.6, 0.3, 2.8); say('就像領口罩用身分證尾數分流', '也是一種收納（人潮）'); },
    () => { tag('怎麼收納 ← 看使用情境', 'ptr alt', 0.6, 3.5, 2.8); say('要怎麼整理', '跟使用情境有關'); },
    () => { T('用什麼 data structure ↔ 要解決的問題（algorithm）', 0, 5.6, -1.8); say('電腦裡：用什麼 data structure', '跟要用的 algorithm 有關'); },
  ]);
}]);

// 1:15:20 資料結構可以加速演算法
FRAG.push(['cplx-intro-dsfast', '收納得好，演算法就快：1000 → 10', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let arr, cost, l;
  await run(tok, [
    () => { T('想設計有效率的演算法 → 從收納資料下手', 0, 4.6, -1.6); say('想要有效率的演算法', '可以從收納資料的方式下手'); },
    () => { arr = row(MIN8, -3.5, 0, 1.0); l = list(-4.0, 3.6, 1.8); l.add('selection sort：每次選最小的放前面'); say('selection sort', '每次選一個最小的放到最前面'); },
    () => { l.add('最花力氣的：找出最小的在哪', 'bad'); say('它最花力氣的步驟', '是找出最小的在哪裡'); },
    () => { l.add('之後會教：很快就找到最小的資料結構', 'good'); say('之後會教好幾個資料結構', '能很快找到最小的'); },
    async () => { cost = tag('1000 筆亂放：一個一個找 → 1000', 'ptr alt', 3.0, 2.0, 0); const h = pkt('找', -3.5, 1.3, 0); await travel(tok, h, V3(-3.5, 1.3, 0), V3(3.5, 1.3, 0), 1400); remove(h); say('1000 筆隨便亂放', '一個一個找要花 1000'); },
    () => { txt(cost, '用特別方式排好 → 約 10'); glow(arr[5], '#0f5a3a'); say('用某種特別方式排好', '只要大概 10 的力氣'); },
    () => { ok('selection sort 就快得多', 3.0, 2.7, 0); say('從 1000 變成 10', 'selection sort 就快得多'); },
    () => { icon('📖', '食譜', 3.4, 3.8, -1.6); icon('🧂', '廚房收納', 5.2, 3.8, -1.6); say('做菜要好食譜', '也要把廚房收納好'); },
    () => { T('algorithm ≈ 食譜　data structure ≈ 調味料和食材的擺法', 0, 5.4, -1.6); say('演算法和資料結構', '就像食譜和廚房擺放的關係'); },
  ]);
}]);

// 1:18:20 get、insert 與維護規則
FRAG.push(['cplx-intro-dsops', '每個資料結構：get、insert，還有維護規則', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let l, stacks = [], cl;
  const pileAt = (x, n) => { const s = []; for (let k = 0; k < n; k++) s.push(cube('', k % 2 ? '#f4a56a' : '#7cb8ee', [1.0, 0.25, 0.8], x, 0.13 + k * 0.27, 1.6)); return s; };
  await run(tok, [
    () => { cl = prop('warehouse', -4.6, 0, -1.0, 1.0, '衣櫃（資料結構）'); l = list(2.6, 4.4, -1.6); l.add('get：把東西拿出來'); say('每個資料結構至少兩件事', '一：怎麼拿出來（get）'); },
    () => { l.add('insert：把東西放進去'); say('二：怎麼放進去（insert）'); },
    async () => { const s = pkt('紅衣服', -1.4, 1.4, 1.0); await travel(tok, s, V3(-1.4, 1.4, 1.0), V3(-4.2, 1.0, -0.4), 1000); say('get、insert 本身就是一段程式', '衣櫃依顏色分：放進去前要先看顏色'); },
    () => { l.add('照大小排：先檢查、再塞到適當位置'); say('衣服照大小排', '放進去時還要檢查、塞到適當位置'); },
    () => { l.add('好的 DS = 兩段好的演算法', 'good'); say('好的資料結構', '至少要兩個好的演算法'); },
    () => { l.add('規則下：怎麼放才持續符合？怎麼拿最想要的？'); say('資料結構定義了一種規則', '放進去要符合規則，拿出想要的'); },
    () => { l.add('常拿的放近一點 → 效率好', 'good'); say('常拿的東西放在快拿得到的地方', '整體效率就好'); },
    () => { l.add('還要「維護」規則', 'ptr'); say('收納規則下不只有放和拿', '還要維護規則'); },
    () => { stacks = [pileAt(-2.0, 5), pileAt(0, 4), pileAt(2.0, 5)]; say('一開始：怎麼建構出符合規則的衣櫃'); },
    () => { note('規則：每疊差不多一樣高（5 件、4 件 OK）', 0, 2.2, 2.6); say('例如每疊衣服要差不多一樣高', '5 件和 4 件可以'); },
    async () => { const top = stacks[1].pop(); await travel(tok, top, top.position.clone(), V3(0, 2.6, 3.2), 600); kill(top); no('5 件 vs 3 件：落差太大！', 0, 1.6, 3.4); say('從 4 件那疊拿走一件，剩 3 件', '落差太大 → 要調整'); },
    async () => { const mv = stacks[0].pop(); await travel(tok, mv, mv.position.clone(), V3(0, 0.13 + 3 * 0.27, 1.6), 800); ok('維護：調整成符合規則', 0, 3.0, 3.4); say('get 只是偷看一下', '真的拿走（移除）後要維護'); },
    () => { l.add('維護的工作也是程式 = 演算法'); say('規則要有對應的程式碼來維護', '這些程式碼都是演算法'); },
    () => { l.add('最隱藏的力氣：維護', 'bad'); say('資料結構最隱藏的力氣', '就是維護'); },
    () => { T('重點：DS 是收納資料的方式；DS 和演算法相輔相成', 0, 5.6, -1.6); say('兩個重點：DS 是收納資料的方式', 'DS 和 algorithm 相輔相成'); },
  ]);
}]);

// 1:25:24 為什麼要學 DSA：計算與儲存資源
FRAG.push(['cplx-intro-resources', '計算與儲存：電腦的兩大資源', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let st, cp, l;
  await run(tok, [
    () => { T('為什麼要學這門課？', 0, 4.8, -1.6); say('為什麼要學 DSA？'); },
    () => { note('algorithm：電腦怎麼執行　DS：電腦怎麼收納資料', 0, 4.1, -1.6); say('Algorithm 描述電腦執行的方式', 'Data structure 描述收納資料的方式'); },
    () => { st = prop('disk', 4.4, 0, -0.6, 1.1, 'DS ↔ Storage：記憶體、硬碟'); say('Data structure 對應 storage 資源', '記憶體、硬碟'); },
    () => { cp = prop('cpu', -4.4, 0, -0.6, 1.1, 'Algorithm ↔ CPU、GPU、雲端機器'); say('Algorithm 對應另一種資源', 'CPU、GPU、雲端的多台機器'); },
    () => { note('計算很珍貴：花時間、花能量', -4.4, 1.8, 1.0); say('演算法在節省計算資源', '計算要花時間、花能量'); },
    () => { note('儲存也珍貴：再便宜也有限', 4.4, 1.8, 1.0); say('儲存也是珍貴的資源', '硬碟、RAM 再便宜也有限'); },
    () => { tag('Computation ＋ Storage = 兩大資源', 'ptr alt', 0, 3.3, -1.0); say('傳統電腦的兩大資源', '計算和儲存'); },
    async () => { const t = pkt('多一點計算 ⇄ 少一點儲存', 0, 1.2, -0.6); await travel(tok, t, V3(-2, 1.2, -0.6), V3(2, 1.2, -0.6), 900); say('兩者相輔相成，也常有 trade-off', '用多一點計算換少一點儲存'); },
    () => { l = list(0, 0.6, 2.0); l.add('妥善使用 = 把使用情境考慮進去：要很快？儲存很小？'); say('妥善使用資源', '要把使用情境考慮進去'); },
    () => { l.add('要考慮：執行時間、記憶體、電力…'); say('想要的執行時間、能忍受的記憶體', '還有電力'); },
    () => { icon('⌚', '穿戴裝置：太耗電 30 分鐘就要充', -5.4, 0.6, 3.2); say('穿戴式裝置太耗電', '30 分鐘就要充一次'); },
    () => { icon('🌐', '網路頻寬', 0, 0.6, 3.6); say('網路年代：要用多少頻寬'); },
    () => { icon('👩‍💻', '人力：要花多少人寫', 5.4, 0.6, 3.2); say('甚至：要花多少人力把程式寫出來'); },
  ]);
}]);

// 1:31:25 各種 trade-off
FRAG.push(['cplx-intro-tradeoff', 'Trade-off：愛整理 vs 隨便丟', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let tidy, messy;
  await run(tok, [
    () => { T('5 分鐘寫好，卻要跑很久：划算嗎？看情境', 0, 4.8, -1.6); say('花 5 分鐘寫的短程式，卻要跑很久', '划不划算，看情境'); },
    () => { tidy = buddy('愛整理的人', '', C_C, -3.6, 0, 0.6, 0.9); messy = buddy('隨便丟的人', '', C_A, 3.6, 0, 0.6, 0.9); say('時間和空間之間也有 trade-off'); },
    async () => { tidy.mood('wow'); for (let k = 0; k < 3; k++) await tidy.hop(tok); note('一天到晚在整理', -3.6, 2.6, 0.6); say('有潔癖的人一天到晚在整理'); },
    () => { tidy.mood('happy'); ok('要拿東西：一目瞭然、很快', -3.6, 3.3, 0.6); no('維護力氣：很多', -3.6, 4.0, 0.6); say('要拿東西一下子就拿到', '但花在維護的力氣比較多'); },
    () => { messy.mood('happy'); ok('放進去、維護：力氣很低', 3.6, 2.6, 0.6); no('找東西：找很久', 3.6, 3.3, 0.6); messy.set('找…'); say('隨便丟的人：放進去、維護都很省力', '可是找東西要找很久'); },
    () => { tag('知道哪些重要 → 做決定（prioritize）', 'ptr alt', 0, 5.6, -1.6); say('好的程式設計師要知道面對哪些 trade-off', '哪些重要，才能做決定'); },
    () => { prop('cpu', -2.0, 0, 3.0, 0.5); prop('cpu', -1.0, 0, 3.0, 0.5); note('平行：用平行演算法嗎？', -1.5, 1.0, 3.0); say('不同平台有不同 trade-off', '平行運算平台'); },
    () => { note('分散式：分出去（傳輸多）或單一節點（負荷重）', 2.6, 1.6, 3.4); say('分散式：分散出去要花傳輸', '集中在一個節點負荷又很重'); },
    () => { icon('🎮', 'GPU vs CPU', 2.6, 0.4, 2.4); say('深度學習用 GPU', '和 CPU 各有好處'); },
  ]);
}]);

// 1:34:47 Programming 與 Coding
FRAG.push(['cplx-intro-programming', 'Programming ≠ Coding：從需求到交付', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let st = [], house;
  const stage = (t, i, cls = 'note') => { const l = tag(t, cls, -5.6 + i * 1.6, 3.2 - (i % 2) * 0.6, -1.4); st.push(l); return l; };
  await run(tok, [
    () => { no('開十門 programming 課：C、Python、MATLAB…？', 0, 4.8, -1.6); say('為什麼不開十門 programming 課？'); },
    () => { ok('重要的不是語言本身，而是各平台的重要概念', 0, 4.2, -1.6); say('重要的不是語言本身', '是針對應用，掌握平台的重要概念'); },
    () => { icon('🖥️', '作業系統、計算機結構…', 4.8, 0.6, 2.4); say('所以還要學其他 CS 課', '系統、作業系統、計算機結構'); },
    () => { house = prop('warehouse', 0, 0, 1.2, 1.1, 'Programming = 蓋一棟房子'); say('Programming 和 Coding 不一樣'); },
    () => { prop('parcel', 2.4, 0, 2.6, 0.5, 'Coding = 木工、水泥'); say('Coding 只是其中的建築工法', 'Programming 是從設計圖到交屋'); },
    () => { stage('Requirement', 0); say('Programming 流程：需求是什麼', 'requirement'); },
    () => { stage('Analysis', 1); say('針對需求做分析'); },
    () => { stage('Design', 2); say('根據分析去做 design', '畫出藍圖'); },
    () => { stage('Refine → Coding', 3); say('refine 設計之後', '才真正進入 coding'); },
    () => { stage('Proof', 4); say('還要說明它為什麼是好的', '像交屋前的檢查 → proof'); },
    () => { stage('Testing／Debug', 5); say('測試、debug'); },
    () => { st[1].element.className = 'lab-label ptr'; say('C 程式設計：需求簡單', 'DSA 開始走向 analysis'); },
    () => { st[2].element.className = 'lab-label ptr alt'; say('希望大家開始 move to design', '先想好，免得電腦跑到天荒地老'); },
    () => { st[4].element.className = 'lab-label ptr'; say('C 課沒有 proof', 'DSA 開始帶入證明'); },
    () => { st[5].element.className = 'lab-label ptr'; say('testing 要自己做好', '不要只依賴批改系統'); },
    () => { tag('從 coding 帶到 designing', 'ptr alt', 0, 1.6, 3.4); say('這門課把大家從 coding', '帶到 designing'); },
  ]);
}]);

// ═══════════ 0J2eLvkuF8k：彭文志〈Lec02 Introduction (2/2)〉═══════════

// 0:13 演算法與資料結構的關係
FRAG.push(['cplx-peng2-algds', '演算法與資料結構：誰在上層、怎麼互相影響', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let st, algo, ds, l;
  await run(tok, [
    () => { buddy('同學', '？', C_C, -5.4, 0, 1.6, 0.75); T('演算法和資料結構有什麼關係？', 0, 4.8, -1.6); say('同學問：演算法和資料結構', '到底什麼關係？'); },
    () => { algo = prop('file', -2.4, 0, -1.0, 1.1, '演算法：解決問題'); say('演算法在解決問題'); },
    () => { note('設計理念：greedy、各種方法…', -2.4, 2.4, -1.0); say('用各種演算法設計理念', '設計出解決問題的方法'); },
    () => { prop('file', 0.4, 0, -1.0, 0.9, 'pseudocode'); arrow(V3(-1.6, 0.6, -1.0), V3(-0.3, 0.6, -1.0), 0xa8730f); say('設計好的演算法', '先用 pseudocode 寫出來'); },
    () => { ds = prop('warehouse', 3.6, 0, -1.0, 0.9, '資料結構：怎麼 implement'); arrow(V3(1.1, 0.6, -1.0), V3(2.6, 0.6, -1.0), 0xa8730f); say('資料結構：學怎麼把演算法', 'implement 出來'); },
    () => { l = list(3.6, 2.6, 1.0); l.add('array'); l.add('linked list'); l.add('tree …'); say('implement 的方式很多', 'array、linked list、tree…'); },
    () => { tag('演算法比較上層', 'ptr alt', -2.4, 3.3, -1.0); say('演算法比較上層', '資料結構往下談實作'); },
    async () => { const a = pkt('互相影響', 3.6, 1.6, 0.4); await travel(tok, a, V3(3.6, 1.6, 0.4), V3(-2.4, 1.6, 0.4), 1000); say('兩者互相影響', '選不同的資料結構，效率就不一樣'); },
    () => { ok('好的資料結構 → 幫你找出更棒的演算法', 0, 0.3, 2.6); say('資料結構也可能', '幫你找出更好的演算法'); },
  ]);
}]);

// 3:10 遞迴：direct 與 indirect
FRAG.push(['cplx-peng2-reckinds', '遞迴：direct、indirect 與 boundary condition', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.0, 0]);
  let A, A2, B;
  await run(tok, [
    () => { T('Recursive（遞迴）', 0, 4.4, -1.4); say('上禮拜提到 recursive'); },
    () => { note('演算法的某個步驟會呼叫自己', 0, 3.7, -1.4); say('演算法裡有步驟', '會呼叫自己'); },
    async () => {
      A = buddy('function A', '', C_A, -4.2, 0, 0.6, 0.85);
      const c = pkt('呼叫 A', -4.2, 2.0, 0.6); await travel(tok, c, V3(-3.2, 1.8, 0.6), V3(-4.2, 2.4, 0.6), 600);
      T('Direct：A 直接呼叫 A', -4.2, 3.0, 0.6);
      say('Function A 直接呼叫 A', '→ direct recursion');
    },
    async () => {
      A2 = buddy('function A', '', C_A, 1.6, 0, 0.6, 0.85); B = buddy('function B', '', C_B, 4.6, 0, 0.6, 0.85);
      const c = pkt('A → B', 1.6, 1.7, 0.6); await travel(tok, c, V3(1.6, 1.7, 0.6), V3(4.6, 1.7, 0.6), 700);
      txt(c, 'B → A'); await travel(tok, c, V3(4.6, 1.7, 0.6), V3(1.6, 1.7, 0.6), 700);
      T('Indirect：A 透過 B 繞回來', 3.1, 3.0, 0.6);
      say('A 不直接叫自己，而是叫 B', '再經由 B 繞回來 → indirect recursion');
    },
    () => { tag('最重要：boundary condition（會停）', 'ptr alt', 0, 1.0, 2.6); A.mood('happy'); say('寫遞迴最重要：知道它會停', '要有 boundary condition'); },
  ]);
}]);

// 4:33 遞迴乘法與 1 加到 n
FRAG.push(['cplx-peng2-mult', '遞迴乘法：a × b = a × (b−1) + a', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let f, cd, calls = [], s, l;
  const callBox = (t, i) => { const m = cube(t, '#f3c99a', [2.6, 0.45, 1.0], -3.6 + i * 0.35, 0.25 + i * 0.5, 1.0); calls.push(m); return m; };
  await run(tok, [
    () => { T('遞迴函式其實不難：例如乘法', 0, 5.0, -1.6); say('遞迴 function 還蠻簡單的', '像乘法'); },
    () => { f = tag('a × b = a × (b−1) + a', 'ptr alt', 0, 4.2, -1.6); say('a 乘 b', '= a 乘 (b−1)，再加 a'); },
    async () => {
      callBox('5 × 4 = 5×3 + 5', 0); await wait(tok, 300); callBox('5 × 3 = 5×2 + 5', 1); await wait(tok, 300); callBox('5 × 2 = 5×1 + 5', 2);
      say('a × (b−1) = a × (b−2) + a', 'b 可以一直遞減（以 5 × 4 為例）');
    },
    () => { callBox('5 × 1 → 停！', 3); tint(calls[3], '#9fd8b0'); say('減到 b = 1 就要停', '再減下去沒有意義'); },
    () => { cd = code(['int mult(int a, int b) {', '  if (b == 1) return a;', '  return mult(a, b-1) + a;', '}'], 3.4, 3.0, 0.48, -0.6); cd.hl(1); say('b == 1 是 boundary condition', '直接回傳 a'); },
    async () => {
      cd.hl(2);
      const vals = [10, 15, 20];
      for (let i = 2; i >= 0; i--) { P.relabel(calls[i], '= ' + vals[2 - i]); glow(calls[i], '#0f5a3a'); await wait(tok, 350); }
      say('否則回傳 mult(a, b−1) + a', '一路返回：5 → 10 → 15 → 20');
    },
    () => { ok('先把遞迴式寫出來 → 成功一半', 3.4, 4.6, -0.6); say('設計遞迴的重點', '把遞迴式寫出來，就成功一半'); },
    () => { calls.forEach(kill); calls = []; cd.kill(); txt(f, 'sum(n) = 1 + 2 + … + n'); say('1 加到 n 也能寫成遞迴'); },
    async () => {
      txt(f, 'sum(n) = sum(n−1) + n');
      callBox('sum(4) = sum(3) + 4', 0); await wait(tok, 250); callBox('sum(3) = sum(2) + 3', 1); await wait(tok, 250); callBox('sum(2) = sum(1) + 2', 2); await wait(tok, 250); callBox('sum(1) = 1', 3);
      say('1 加到 n = (1 加到 n−1) + n', '再一路展開下去');
    },
    () => { s = buddy('你', '？', C_B, 4.0, 0, 1.0, 0.8); say('要算 1 加到 n', '需要搞得這麼複雜嗎？'); },
    () => { l = list(4.0, 3.6, -0.6); l.add('公式：n(n+1)/2'); l.add('for 迴圈：一路加'); s.set('!'); say('用公式，或用 for 迴圈', '更直接'); },
    () => { l.add('遞迴不是唯一解：多想自己的辦法', 'good'); s.mood('happy'); say('遞迴不是唯一解', '要多想自己的辦法'); },
    () => { T('for 迴圈 vs 遞迴：誰比較好？', 0, 5.6, -1.6); say('用 for 和用遞迴', '哪個比較好？'); },
    () => { no('遞迴：每次呼叫要記得回到哪裡 → overhead', -1.0, -0.1, 2.8); say('迴圈通常比較有效率', '遞迴要記錄並跳回原呼叫處'); },
  ]);
}]);

// 10:10 Binary search：迴圈版與遞迴版
FRAG.push(['cplx-peng2-bsearch', 'Binary search：left、right 與遞迴呼叫', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const V = [1, 3, 5, 7, 9, 11, 13, 15, 17];
  let arr, L, R, M, cdI, cdR, tgt;
  const at = (i) => -4.0 + i;
  await run(tok, [
    () => { arr = row(V, -4.0, 1.2, 1.0); say('Binary search：對一串數字找東西'); },
    async () => { tgt = pkt('找 13', -5.6, 1.4, 1.2); await lift(tok, arr[4], true, 0.5); M = ptr('中間', at(4), 2.3, 1.2); say('假設已經排序過', '每次比中間，切一半'); },
    () => { cdI = code(['while (left <= right) {', '  middle = (left + right) / 2;', '  switch (COMPARE(list[middle], x)) {', '    ...  left = middle + 1 / right = middle − 1'], -1.6, 5.2, 0.46, -1.6); say('第一種寫法：while 迴圈', '沒有用到遞迴'); },
    () => { cdR = code(['binsearch(list, x, left, right):', '  case <: return binsearch(..., middle+1, right)', '  case =: return middle', '  case >: return binsearch(..., left, middle−1)'], 2.4, 3.2, 0.46, -0.4); say('接下來看遞迴版', 'function 叫 binsearch'); },
    () => { L = tag('left', 'ptr', at(0), -0.2, 2.1); R = tag('right', 'ptr', at(8), -0.2, 2.1); say('兩個重要的指標', 'left 和 right'); },
    () => { note('調整 left、right → 決定要搜尋哪一段', -1.6, 0.1, 3.0); say('它們是數列最左、最右的邊界', '調整邊界就決定搜哪一段'); },
    () => { cdR.hl(1); say('用 compare 搭配 switch-case', '判斷往左半還是右半'); },
    async () => {
      await lift(tok, arr[4], false, 0.5);
      for (let i = 0; i <= 4; i++) tint(arr[i], '#d8cfc0');
      await travel(tok, L, L.position.clone(), V3(at(5), -0.2, 2.1), 600);
      await lift(tok, arr[6], true, 0.5); M.position.x = at(6);
      say('case 不同就 return binsearch', 'binsearch 裡呼叫自己 → recursive');
    },
    () => { cdR.hl(3); say('往左半邊也一樣', '呼叫自己 binsearch'); },
    () => { cdI.hl(0); cdR.hl(-1); say('比較兩種寫法', '迴圈版靠 while 一直繞'); },
    async () => { cdR.hl(2); glow(arr[6], '#0f5a3a'); tgt.position.set(at(6), 3.0, 1.2); txt(tgt, '找到 13 → return'); say('找到就回傳', '這就是 boundary condition'); },
    () => { cdR.hl(-1); no('都沒找到 → 回傳「沒找到」', 2.4, 0.1, 3.0); say('沒找到的話', '回傳沒找到（錯誤訊息）'); },
  ]);
}]);

// 13:50 用遞迴產生排列
FRAG.push(['cplx-peng2-perm', '遞迴產生排列：perm(abc, 1, 3)', async (tok) => {
  P.fresh([0, 7, 13], [0, 1.8, 0]);
  let six, out, root, k1, k2, k3, nd = {}, cd;
  const node = (t, x, y, color = '#f3c99a') => cube(t, color, [1.9, 0.5, 0.8], x, y, -0.6);
  await run(tok, [
    () => { T('a、b、c 有幾種排列？', 0, 5.4, -1.6); say('給你 a、b、c', '輸出所有排列'); },
    () => { six = note('abc acb bac bca cab cba：6 種', 0, 4.7, -1.6); say('排列組合：3! = 6 種', '人算一下就出來'); },
    () => { prop('cpu', -5.6, 0, 2.2, 0.8, '讓電腦產生'); say('現在要寫程式', '讓電腦 output 出來'); },
    () => { out = code(['cout << "abc";', 'cout << "acb";', 'cout << "bac";', '…（6 行）'], -4.6, 3.6, 0.46, 0.4); no('工人智慧', -4.6, 1.4, 0.4); say('直接寫 6 行 cout', '這叫「工人智慧」'); },
    () => { txt(six, '100 個字元？手寫不完、還會寫錯'); say('字元有 100 個時', '必須讓程式自動產生'); },
    () => { out.kill(); T('用遞迴來設計', -4.6, 3.6, 0.4); say('那怎麼設計？', '可以用遞迴'); },
    () => { root = node('perm(abc,1,3)', 0, 3.4, '#e8b04a'); k1 = node('a | perm(bc)', -3.6, 2.2); say('先把第一個字元固定成 a'); },
    () => { note('第 2、3 位：b、c 做 permutation', -3.6, 1.4, 0.4); say('剩下 b、c', '在後面兩個位置做 permutation'); },
    () => { k2 = node('b | perm(ac)', 0, 2.2); say('第二種 case：第一個是 b', 'a、c 在後面排列'); },
    () => { k3 = node('c | perm(ab)', 3.6, 2.2); say('第三種：第一個是 c', '後面排 a、b'); },
    () => { cd = code(['perm(list, i, n):', '  if (i == n) output list', '  else for j = i … n:', '    swap(list[i], list[j])', '    perm(list, i+1, n)', '    swap back'], 4.6, 5.6, 0.42, -1.8); say('設計一個 function：perm', '它有三個參數'); },
    () => { cd.hl(0); note('perm(字串, 起點, 終點)：1～3 = 第 1 到第 3 個位置', 0, 0.2, 2.6); say('1 到 3：排列範圍', '從第 1 個位置到第 3 個位置'); },
    () => { cd.hl(4); glow(k1, '#5a3a00'); say('第一位是 a：呼叫 perm(abc, 2, 3)', '範圍限定在第 2～3 個位置'); },
    () => { nd.ab = node('ab | perm(c)', -5.0, 1.0); say('再遞迴：第 2 位固定 b', '第 3 位自然是 c'); },
    () => { cd.hl(1); tag('3～3：boundary condition', 'ptr alt', -5.0, 0.2, 0.6); say('範圍只剩 3 到 3', '這就是 boundary condition'); },
    async () => { const r = pkt('輸出 abc', -5.0, 1.0, 0.4); await travel(tok, r, V3(-5.0, 1.0, 0.4), V3(-5.0, -0.2, 2.0), 600); say('直接輸出結果', 'abc'); },
    async () => { cd.hl(3); nd.ac = node('ac | perm(b)', -2.2, 1.0); const r = pkt('輸出 acb', -2.2, 1.0, 0.4); await travel(tok, r, V3(-2.2, 1.0, 0.4), V3(-2.2, -0.2, 2.0), 600); say('a 固定，第 2 位換成 c', '剩 b → 輸出 acb'); },
    () => { glow(nd.ab, '#0f5a3a'); glow(nd.ac, '#0f5a3a'); say('以 a 開頭的：abc、acb', '剛好就是 a + perm(bc)'); },
    () => { note('只剩一個字母、一個位置 → 輸出', -3.6, 3.0, 0.6); say('boundary condition：只剩一個字母', '只在一個位置 → output'); },
    () => { cd.hl(3); ok('用 swap 交換來固定位置；拿 abc 自己 trace 一次', 0, 5.4, 0.6); say('實作用 swap 交換', '拿 abc 自己 trace 一次程式'); },
  ]);
}]);

// 25:18 不用遞迴的排列
FRAG.push(['cplx-peng2-permloop', '不用遞迴：三層迴圈，再去掉重複', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let cd, grid = [], st;
  await run(tok, [
    () => { T('不用遞迴，怎麼解 permutation？', 0, 4.8, -1.6); say('再問一個問題', '不用遞迴，怎麼產生排列？'); },
    () => { ['第 1 位', '第 2 位', '第 3 位'].forEach((t, i) => { idx(t, -4.0 + i * 1.6, -0.1, 0.4); }); ['a', 'b', 'c'].forEach((ch, r) => { for (let i = 0; i < 3; i++) grid.push(cube(ch, C_ROW, [0.6, 0.45, 0.6], -4.0 + i * 1.6, 0.25, -1.2 + r * 0.7)); }); say('每個位置都可以是 a、b、c'); },
    () => { cd = code(['for x in {a,b,c}', '  for y in {a,b,c}', '    for z in {a,b,c}', '      output x y z'], 3.2, 3.4, 0.46, -1.0); say('用多層 for 迴圈', '一層管一個位置'); },
    () => { st = list(3.2, 1.2, 0.8); st.add('aaa, aab, aac, aba, abb, abc …（27 種）'); say('不用遞迴也做得到'); },
    () => { st.add('aaa、aab… 有重複字元 → 偵測後排除', 'bad'); say('但會產生字元重複的組合', '要偵測已經出現過的，排掉'); },
    () => { st.add('考試不一定考；重點：解法不只一種', 'good'); say('同一個問題', '不只一種 solution'); },
    () => { buddy('你', '💡', C_B, -4.0, 0, 2.6, 0.8).mood('happy'); say('做研究沒有標準答案', '鼓勵多想自己的解法'); },
  ]);
}]);

// 29:12 效能評估與空間複雜度
FRAG.push(['cplx-peng2-space', '效能評估：S(P) = c + S_P', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let flow, l, sp, c;
  const st = (t, i) => tag(t, 'note', -5.4 + i * 2.7, 4.6, -1.6);
  await run(tok, [
    () => { st('發現問題', 0); say('解決問題的流程', '先發現問題、知道問題是什麼'); },
    () => { st('提出想法 → solution', 1); say('提出想法', '把 solution 設計出來'); },
    () => { st('寫成程式', 2); prop('cpu', 4.8, 0, -1.0, 0.8); say('寫成程式', '讓電腦執行'); },
    () => { st('評估效能？', 3); say('接著要問：這個解法的效能如何？'); },
    () => { l = list(-3.2, 3.2, -0.4); l.add('① 與機器無關：複雜度分析', 'good'); say('performance evaluation 有兩個層次', '第一：與機器無關'); },
    async () => { l.add('② 實測：程式從開始跑到結束'); const t = pkt('⏱ 開始 → 結束', -3.2, 1.4, 1.2); await travel(tok, t, V3(-5.2, 1.4, 1.2), V3(-1.2, 1.4, 1.2), 1000); say('第二：實際量測', '程式從開始到結束的時間'); },
    () => { l.add('實測會受 CPU、memory 影響', 'bad'); say('實測時間會受 CPU、memory 影響', '好機器通常就跑得好'); },
    () => { l.add('→ 通常用 complexity 分析'); say('所以評估通常用 complexity 分析'); },
    () => { prop('disk', 1.6, 0, 1.4, 0.8, 'space complexity：用多少 memory'); say('常用兩個複雜度', '第一：space complexity'); },
    () => { prop('cpu', 4.6, 0, 1.4, 0.8, 'time complexity'); say('第二：time complexity'); },
    () => { sp = tag('S(P) = c + S_P', 'ptr alt', 1.6, 3.2, 0.6); say('空間複雜度：S(P) = c + S_P'); },
    () => { c = note('c：固定部分（存程式碼本身…）', 1.6, 2.6, 1.4); say('c 是固定部分', '例如存放程式碼的空間'); },
    () => { note('S_P：跟輸入資料量有關 → 分析的重點', 1.6, 2.0, 1.8); say('S_P 跟輸入的資料量有關', '比較確定、也是分析的重點'); },
    () => { row(['', '', '', '', '', ''], -5.0, 2.6, 0.7, C_B, 0.55, false); idx('給你 n 個數字 → 要存 n 個', -3.2, -0.1, 3.3); say('例如給你 n 個數字', '就要空間存這 n 個'); },
  ]);
}]);

// 33:48 時間：T(P) 與 program step
FRAG.push(['cplx-peng2-time', 'T(P) = compile time + T_P；改數 program step', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let f, ins, l;
  await run(tok, [
    () => { f = tag('T(P) = compile time ＋ T_P（執行）', 'ptr alt', 0, 4.6, -1.6); say('時間複雜度', 'T(P) = 編譯時間 + 執行時間 T_P'); },
    () => { note('compile time 跟輸入無關 → 不分析', -3.0, 3.8, -1.6); say('compile time 跟輸入無關', '所以只看 T_P'); },
    () => { note('T_P：跟程式在做什麼運算有關', 3.0, 3.8, -1.6); say('執行時間', '跟程式裡做什麼運算有關'); },
    () => { code(['int a = b + c;', 'sum = sum + x;'], -3.6, 2.4, 0.46, 0); say('在 C 裡寫得很 high level', '宣告變數、加減、存取'); },
    () => { prop('cpu', 0, 0, 0.4, 1.0, 'CPU 看到的是 instruction'); say('最後讓電腦執行', '電腦看到的是 instruction'); },
    () => { ins = code(['LOAD  b', 'ADD   c', 'STORE a', 'LOAD  sum …'], 3.8, 2.4, 0.46, 0); say('不外乎 add、sub', 'load、store'); },
    () => { note('執行時間 depends on instruction set', 3.8, 0.2, 1.4); say('執行時間取決於 instruction set', '做幾個 add、幾個 load…'); },
    () => { no('太細節了，DS 不分析到這裡', 0, 1.8, 2.4); say('這太細節了'); },
    () => { tag('改數：program step（程式步數）', 'ptr alt', 0, 5.4, -1.6); say('DS 和演算法改數 program step', '大概執行多少個指令'); },
  ]);
}]);

// 37:01 用 count 變數數步數
FRAG.push(['cplx-peng2-count', '在程式裡放 count：加總 n 個數 = 2n + 3 步', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  let cd, cnt, cv = 0, f, mx;
  const bump = (k) => { cv += k; cnt.set(String(cv)); };
  await run(tok, [
    () => { T('怎麼數 program step？', 0, 5.6, -1.6); say('怎麼算 program step？', '在程式裡宣告一個變數'); },
    () => { cnt = buddy('count', '0', C_D, -5.4, 0, 1.4, 0.85); say('比較笨的方法', '宣告一個全域變數 count'); },
    () => { cd = code(['float sum(float list[], int n) {', '  float tempsum = 0; count++;', '  int i;', '  for (i = 0; i < n; i++) { count++;', '    tempsum += list[i]; count++; }', '  count++;  /* 最後一次 for 判斷 */', '  count++; return tempsum;', '}'], 1.0, 4.8, 0.46, -1.6); say('count 從 0 開始', '每做完一個指令就 count++'); },
    async () => { cd.hl(1); bump(1); await cnt.hop(tok); say('tempsum = 0 是一個指令', '後面就 count++'); },
    async () => { cd.hl(3); for (let k = 0; k < 4; k++) { bump(1); await wait(tok, 150); cd.hl(4); bump(1); await wait(tok, 150); cd.hl(3); } say('for 迴圈裡每做一次', '也 count++'); },
    () => { cd.hl(-1); note('加總 n 個數字（這裡 n = 4）', -5.4, 3.0, 1.4); say('這個程式在做加總', '總共 n 個數字'); },
    async () => { cd.hl(5); bump(1); await wait(tok, 200); cd.hl(6); bump(1); f = tag('2n + 3 = 11（n = 4）', 'ptr alt', -5.4, 3.7, 1.4); say('算起來大概是 2n + 3 步'); },
    () => { cd.hl(1); say('為什麼是 2n + 3？', '每個有做事的敘述都算'); },
    () => { cd.hl(2); no('int i：只有宣告，沒有 assignment → 不算', 3.2, 0.4, 1.6); say('int i 只是宣告，沒有 assignment', 'tempsum = 0 是 assignment，算一步'); },
    () => { cd.hl(-1); txt(f, '2n + 3 ？ 2n + 5 ？'); say('問題：2n+3 和 2n+5', '有什麼差別？'); },
    () => { note('n = 100：差 2 步，幾乎沒感覺', -5.4, 4.4, 1.4); say('n = 100 時加 3 加 5', '差別很小'); },
    () => { ok('在乎的是：跟 n 的關係', -5.4, 5.0, 1.4); say('我們在乎的是跟 n 的關係', '後面那些小數字不重要'); },
    () => { cd.kill(); mx = code(['for (i = 0; i < rows; i++)', '  for (j = 0; j < cols; j++)', '    c[i][j] = a[i][j] + b[i][j];'], 1.4, 4.4, 0.48, -1.6); say('矩陣加法：A + B 存到 C'); },
    () => { mx.hl(1); say('兩個 for 迴圈就結束'); },
    () => { mx.hl(2); note('step 數跟 rows、cols 有關', 1.4, 2.4, -1.6); say('一樣可以放 count++', 'step 數跟 rows、cols 有關'); },
    () => { mx.hl(0); ok('rows 遠大於 cols → 把內外迴圈交換', 1.4, 1.6, 0); say('rows 遠大於 cols 時', '可以把內外兩層迴圈交換'); },
  ]);
}]);

// 43:31 Tabular method
FRAG.push(['cplx-peng2-table', 'Tabular method：s/e × frequency', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 2.0, 0]);
  const L = ['float sum(float list[], int n)', '{ float tempsum = 0;', '  int i;', '  for (i = 0; i < n; i++)', '    tempsum += list[i];', '  return tempsum;', '}'];
  let tb, se = [], fr = [], to = [], sum;
  const col = (arr, x, vals, i0 = 0) => vals.forEach((v, i) => { arr[i0 + i] = idx(v, x, 5.0 - (i0 + i) * 0.55, -1.6); });
  await run(tok, [
    () => { T('另一個笨方法：列表格', 0, 6.2, -1.6); say('另一個方法：用表格'); },
    () => { tb = code(L, -2.6, 5.0, 0.55, -1.6); idx('s/e', 1.6, 5.6, -1.6); idx('frequency', 3.2, 5.6, -1.6); idx('total', 4.8, 5.6, -1.6); say('左邊是敘述', '右邊看它牽涉多少指令'); },
    () => { tb.hl(1); col(se, 1.6, ['1'], 1); say('float tempsum = 0 是 assignment', 's/e（每次幾步）= 1'); },
    () => { col(fr, 3.2, ['1'], 1); col(to, 4.8, ['1'], 1); say('frequency：執行幾次？', '只執行 1 次 → total 1'); },
    () => { tb.hl(3); col(se, 1.6, ['1'], 3); col(fr, 3.2, ['n+1'], 3); col(to, 4.8, ['n+1'], 3); say('for 迴圈要執行 n+1 次', '最後多一次判斷才結束'); },
    () => { tb.hl(4); col(se, 1.6, ['1'], 4); col(fr, 3.2, ['n'], 4); col(to, 4.8, ['n'], 4); tb.hl(5); col(se, 1.6, ['1'], 5); col(fr, 3.2, ['1'], 5); col(to, 4.8, ['1'], 5); say('每一行：s/e × frequency', '= 這行的 total steps'); },
    () => { tb.hl(-1); sum = tag('1 + (n+1) + n + 1 = 2n + 3', 'ptr alt', 1.6, 0.6, 0); say('把最右邊加起來', '= 2n + 3'); },
    () => { note('矩陣加法也能這樣列表', 1.6, 0.0, 0.8); say('矩陣加法', '也可以這樣算'); },
  ]);
}]);

// 45:28 Big-O 的定義
FRAG.push(['cplx-peng2-bigo', 'Big-O：f(n) ≤ c·g(n)，對所有 n ≥ n₀', async (tok) => {
  P.fresh([0, 6, 13], [0, 2.2, 0]);
  const X0 = -6, X1 = 0.4, Y0 = 0.2, Y1 = 4.6;
  let def, l, ex, ax;
  const nAt = (n) => X0 + (X1 - X0) * n / 6;            // n ∈ [0, 6]
  const yAt = (v) => Y0 + (Y1 - Y0) * v / 26;           // value ∈ [0, 26]
  await run(tok, [
    () => { T('最終目的：求複雜度 Big-O', 3.4, 5.6, -1.6); say('算 step 最重要的目的', '是求出複雜度 Big-O'); },
    () => { l = list(3.4, 4.9, -1.6); l.add('看 best、worst、average case'); say('看程式在最好、最差', '或平均情況下要多少步'); },
    () => { l.add('step 數 ≠ 實際執行時間'); say('program step', '並不代表真正的執行時間'); },
    () => { l.add('重點：跟 n 的關係', 'good'); say('我們看的是', '它跟 n 的關係'); },
    () => { l.add('n² + … vs 10n：後者效率較好'); say('一個要 n² 步、一個要 10n 步', '很明顯後者比較好'); },
    () => { def = tag('f(n) = O(g(n))', 'ptr alt', 3.4, 2.4, 0); say('f(n) 是算出來的 program step', '要找 g(n)'); },
    () => { txt(def, '存在常數 c 和 n₀'); say('定義：存在常數 c', '還有 n₀'); },
    () => { txt(def, 'f(n) ≤ c·g(n)，對所有 n ≥ n₀'); say('使得 f(n) ≤ c·g(n)', '對所有 n ≥ n₀（注意是 ≤）'); },
    async () => {
      line(X0, Y0, X1 + 0.3, Y0, 0, '#6e5f49'); line(X0, Y0, X0, Y1 + 0.2, 0, '#6e5f49'); ax = idx('n →', X1 + 0.6, 0, 0);
      await curve(tok, (u) => (3 * u * 6 + 2) / 26, X0, X1, Y0, Y1, 0, '#d0702a', 900); ptr('f(n) = 3n + 2', X1 + 0.2, yAt(20), 0);
      say('例：3n + 2 = O(n)');
    },
    async () => { await curve(tok, (u) => (4 * u * 6) / 26, X0, X1, Y0, Y1, 0, '#2f7fc4', 900); ptr('c·g(n) = 4n', X1 + 0.2, yAt(24) + 0.5, 0); say('因為 3n + 2 ≤ 4n'); },
    () => { line(nAt(2), Y0, nAt(2), Y1, 0, '#0f5a3a'); ok('c = 4，n₀ = 2：n ≥ 2 起 4n 都在上面', nAt(2) + 0.6, Y1 + 0.6, 0); say('c = 4、n₀ = 2', '這個不等式就成立'); },
    () => { ex = note('10n² + 4n + 2 = O(n²)', 3.4, 1.6, 0.6); say('同樣：10n² + 4n + 2', 'Big-O 是 n²'); },
    () => { txt(ex, '10n² + 4n + 2 ≤ 11n²（c = 11，n₀ = 10）'); say('取 c = 11、n₀ = 10', '不等式成立'); },
    () => { no('3n + 2 也 ≤ c·n² → g(n) = n² 也算？', 3.4, 1.0, 1.2); say('g(n) 可以有很多種', '3n + 2 也 ≤ c·n²'); },
    () => { ok('要取所有 upper bound 裡最小的那個', 3.4, 0.4, 1.8); say('但我們要的 g(n)', '是所有 upper bound 裡最小的'); },
  ]);
}]);

// 50:10 Ω 與 Θ
FRAG.push(['cplx-peng2-omega', 'Ω（下界）與 Θ（夾住）', async (tok) => {
  P.fresh([0, 6, 13], [0, 2.2, 0]);
  const X0 = -6, X1 = 0.4, Y0 = 0.2, Y1 = 4.6;
  let def, f;
  await run(tok, [
    () => { def = tag('Ω 和 Big-O 差在哪？', 'ptr alt', 3.4, 4.8, -1.0); line(X0, Y0, X1 + 0.3, Y0, 0, '#6e5f49'); line(X0, Y0, X0, Y1 + 0.2, 0, '#6e5f49'); say('Omega 和 Big-O 差在哪裡？'); },
    () => { txt(def, 'f(n) = Ω(g(n))：f(n) ≥ c·g(n)，n ≥ n₀'); say('不等號反過來', 'f(n) ≥ c·g(n)'); },
    async () => { await curve(tok, (u) => (3 * u * 6 + 3) / 26, X0, X1, Y0, Y1, 0, '#d0702a', 900); ptr('f(n) = 3n + 3', X1 + 0.3, 4.0, 0); say('例：3n + 3 = Ω(n)'); },
    async () => { await curve(tok, (u) => (3 * u * 6) / 26, X0, X1, Y0, Y1, 0, '#2f7fc4', 900); ptr('3n（c = 3）', X1 + 0.3, 3.0, 0); say('取 c = 3', '3n + 3 ≥ 3n'); },
    () => { note('Ω = lower bound（下界）', 3.4, 3.6, -1.0); say('Ω 求的是 lower bound'); },
    () => { ok('lower bound 有很多 → 取最大的', 3.4, 3.0, -0.4); say('lower bound 有很多', '要取最大的那一個'); },
    async () => { await curve(tok, (u) => (4 * u * 6) / 26, X0, X1, Y0, Y1, 0, '#0f5a3a', 900); f = tag('Θ：上下兩條把 f(n) 夾住', 'ptr alt', 3.4, 2.0, 0.4); say('Θ 是夾擠', '用兩個常數把它夾住'); },
    () => { note('c₁·g(n) ≤ f(n) ≤ c₂·g(n)：既是上界也是下界', 3.4, 1.2, 1.0); say('它既是 upper bound', '也是 lower bound'); },
  ]);
}]);

// ═══════════ 3503j2L6qNA：彭文志〈Lec01 Introduction (1/2)〉═══════════

// 0:11 這堂課的大綱
FRAG.push(['cplx-peng1-outline', '這堂課的大綱', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let l;
  await run(tok, [
    () => { T('Data structure 是幹嘛用的？', 0, 4.4, -1.4); l = list(0, 3.5, -0.4); say('這堂課介紹 data structure', '它的用處是什麼'); },
    () => { l.add('① System life cycle'); say('大綱一：system 的 life cycle'); },
    () => { l.add('② 複習：什麼是演算法、它的 spec'); say('二：複習演算法', '以及演算法的 spec'); },
    () => { l.add('③ Data abstraction'); say('三：data abstraction', '方便我們解讀資料結構'); },
    () => { l.add('④ Performance 分析：怎麼量測'); say('最後：performance 分析', '要怎麼量測'); },
    () => { l.add('　machine-dependent ／ machine-independent', 'ptr'); say('有跟機器有關', '和跟機器無關兩種方式'); },
  ]);
}]);

// 1:07 一個 system：小型搜尋引擎
FRAG.push(['cplx-peng1-search', '一個 system：小型搜尋引擎的需求', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let web, idxP, user, l;
  await run(tok, [
    () => { T('Tiny search engine＝一個 system', 0, 4.8, -1.6); say('假設要做一個小搜尋引擎', '這就是一個 system'); },
    async () => {
      web = icon('🌐', '網路上的網頁', -5.2, 0.6, -0.6); prop('disk', -2.4, 0, -0.6, 0.8, '撈回來的網頁');
      const p = pkt('網頁', -5.2, 1.4, -0.6); await travel(tok, p, V3(-5.2, 1.4, -0.6), V3(-2.4, 1.4, -0.6), 900); remove(p);
      say('第一件事：寫程式把網頁都撈回來');
    },
    () => { idxP = prop('file', 0.4, 0, -0.6, 0.9, '關鍵字 index'); arrow(V3(-1.6, 0.5, -0.6), V3(-0.3, 0.5, -0.6), 0xa8730f); say('第二件事：分析網頁內容', '建關鍵字、建 index'); },
    async () => {
      user = buddy('使用者', '', C_B, 4.6, 0, 1.6, 0.8);
      const q = pkt('query：資料結構', 4.6, 1.6, 1.6); await travel(tok, q, V3(4.6, 1.6, 1.6), V3(0.4, 1.6, -0.6), 900);
      txt(q, '找到的網頁 →'); await travel(tok, q, V3(0.4, 1.6, -0.6), V3(4.6, 1.6, 1.6), 900); user.mood('happy');
      say('第三件事：使用者下 query', 'match 文件，把結果 display 出來');
    },
    () => { l = list(-3.0, 3.6, 1.6); l.add('Requirements = 這三個步驟（三個 component）'); say('前面這三步', '就是這個 system 的 requirements'); },
    () => { l.add('使用者看到：下 query word → 拿回 web page'); say('從使用者的觀點', '輸入 query word，拿回網頁'); },
    () => { l.add('requirement：input、output、主要功能', 'ptr'); say('設計系統要先知道 requirement', 'input、output、主要功能'); },
    () => { l.add('Top-down：先看外面，再看每個小 component', 'good'); say('這是 top-down design', '先看使用者看到什麼，再看細節'); },
    () => { icon('🗺️', 'Google Map：先找台灣，再 zoom in', 4.6, 0.6, -1.6); say('就像用 Google Map', '先找到台灣，再 zoom in'); },
  ]);
}]);

// 3:34 設計、寫程式、驗證
FRAG.push(['cplx-peng1-lifecycle', 'System life cycle：設計 → coding → 驗證', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let st = [], l, sz;
  const stage = (t, i) => { const s = tag(t, 'note', -5.4 + i * 2.7, 4.6, -1.6); st.push(s); st.forEach((x) => x.element.className = 'lab-label note'); s.element.className = 'lab-label ptr alt'; return s; };
  await run(tok, [
    () => { stage('Design', 0); say('知道 system 有哪些 component', '接下來看 design 的 issue'); },
    () => { cube('data object', C_E, [1.6, 0.6, 1.0], -4.4, 0.3, 0.6); say('要 implement 每個 component', '有哪些 data object？'); },
    () => { note('它的 operation = function', -4.4, 1.2, 0.6); say('data object 負責的 operation', '就是它的 function'); },
    () => { note('function 要做事 → 要設計演算法', -4.4, 1.8, 0.6); say('function 要達成目的', '就會用到演算法'); },
    () => { stage('Coding', 1); say('接下來才真的去 coding'); },
    () => { stage('Refine', 2); say('看輸出結果', '再修改、refine 程式'); },
    () => { stage('Verify', 3); l = list(3.0, 3.6, 0.2); l.add('結果對嗎？'); say('出來的結果要 verify', '第一：是不是對的'); },
    () => { l.add('多跑幾個 test case', 'good'); say('多跑幾個 test case', '跑一個對還不夠'); },
    () => { l.add('也看 efficiency（有效性）'); say('testing 除了正確性', '也看 efficiency'); },
    () => { sz = prop('file', -1.2, 0, 1.8, 0.8, '1 萬個檔案'); say('例如 1 萬個檔案和 100 萬個檔案', '效能差多少？'); },
    async () => { for (const t of ['10 萬個檔案', '100 萬個檔案']) { sz.userData.label.element.textContent = t; await wait(tok, 500); } l.add('scalability 測試：100 → 1 萬 → 100 萬'); say('這叫 scalability 的測試', '把檔案量一路加大'); },
    () => { no('資料一大：memory 爆掉、array 不夠大 → 跑不起來', -1.2, 2.2, 2.6); say('小資料跑得好不代表能擴展', 'memory 會爆、array 開不夠大'); },
    () => { l.add('小資料測正確性、改 size 測 efficiency', 'ptr'); say('testing 有好幾個層次', '小 size 測正確，改 size 測效率'); },
  ]);
}]);

// 7:20 文件與 error code
FRAG.push(['cplx-peng1-docs', '別忘了：document、error code、comment', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let l, e;
  await run(tok, [
    () => { prop('file', -3.6, 0, 0, 1.2, 'document'); l = list(2.4, 3.6, 0); l.add('寫 document（常被忽略）'); say('最後一步常被忽略', '要寫 document'); },
    () => { l.add('出錯要回傳 error code'); say('出錯時，程式要寫 error code'); },
    () => { e = tag('401 ／ 連不上', 'bad', -3.6, 2.6, 0); icon('🌐', 'browser', -5.4, 0.6, 1.2); say('像 browser 連到不見的 server', '會回傳 error code'); },
    () => { l.add('程式幾千行 → error code 方便 debug', 'good'); say('系統動輒幾千行', 'error code 方便 debug'); },
    () => { l.add('程式碼要寫 comment', 'ptr'); say('還有：code 裡要寫 comment'); },
  ]);
}]);

// 13:00 評估一個 system
FRAG.push(['cplx-peng1-evaluate', '怎麼評估一個程式：正確、可讀、省空間、夠快', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let l, v, disk, ph, r;
  await run(tok, [
    () => { l = list(-3.0, 4.6, -1.6); T('System life cycle 長這樣 → 再看怎麼 evaluate', 2.6, 5.4, -1.6); say('剛才看了 system life cycle', '再細看怎麼評估'); },
    () => { l.add('output 符合 spec、requirement？'); say('輸出是否符合預期的 spec'); },
    () => { l.add('能正常運作？'); say('是不是可以正常運作'); },
    () => { l.add('document 有寫？每個 function 都能運作？'); say('document 有沒有寫', '每個 data object 的 function 能不能運作'); },
    () => { l.add('code 讀得懂嗎？'); say('code 可不可以讀'); },
    () => { v = code(['int XXYY;', 'int tmp, tmp2, tmp3;'], 3.0, 3.6, 0.48, -1.6); no('看不懂的變數名', 3.0, 2.6, -1.6); say('有老師的變數都叫 XXYY', '或 tmp、tmp2、tmp3…'); },
    () => { txt(v.ls[0], 'int studentCount;'); txt(v.ls[1], 'int maxScore;'); v.hl(0); ok('取有意義的名字：舉手之勞', 3.0, 2.0, -1.6); say('取變數時要有意義', '舉手之勞，code 就好讀'); },
    () => { l.add('儲存空間用得有效率嗎？'); disk = prop('disk', -4.8, 0, 1.6, 0.8); say('執行時用的儲存空間', '有沒有效率'); },
    () => { note('1995：64 MB 就很強；現在 1 TB 很便宜', -4.8, 1.4, 2.6); say('現在 terabyte 硬碟很便宜', '1995 年 64 MB 就覺得很強'); },
    () => { ph = icon('📱', '手機、平板：空間有限', -1.8, 0.6, 2.2); say('但寫 app 要放在手機、平板', 'storage 和 memory 都不大'); },
    () => { l.add('執行時間可以接受（acceptable）嗎？'); say('最後：執行時間是否可以接受'); },
    () => { r = note('acceptable 很主觀', 3.0, 1.0, 1.0); say('acceptable 這個詞很主觀'); },
    () => { buddy('用 1 GHz 的人', '還好', C_C, 1.4, 0, 2.6, 0.65); buddy('用高效能電腦的人', '1 秒都不等', C_A, 4.4, 0, 2.6, 0.65).mood('sad'); say('用慢電腦的人覺得可以', '用慣快電腦的人 1 秒都不能等'); },
    () => { ok('目標：runtime 越小越好', 3.0, 1.6, 1.0); say('最終希望', 'runtime 越小、越快越好'); },
  ]);
}]);

// 17:45 Data abstraction 與 ADT
FRAG.push(['cplx-peng1-adt', 'Data abstraction：struct 與 ADT', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let st, l, nat, fn;
  await run(tok, [
    () => { T('什麼是 data abstraction？', 0, 5.0, -1.6); say('什麼叫做 data abstraction？'); },
    () => { icon('🐧', 'UNIX、Linux 用 C 寫', -5.2, 0.6, 1.6); say('C 其實很厲害', 'UNIX、Linux 都是用 C 寫的'); },
    () => { st = code(['struct student {', '  char id[10];', '  char name[20];', '  int  grade;', '};'], -2.6, 3.8, 0.46, -1.4); say('C 裡有 structure', '就像一筆 data record'); },
    () => { st.hl(1); buddy('student', '', C_B, 1.2, 0, 0.6, 0.8); say('student 這個 record', '有三個欄位：學號、名字、分數'); },
    () => { l = list(4.4, 4.0, -1.4); l.add('object 叫什麼：student'); l.add('有哪些 attribute：id、name、grade'); st.hl(-1); say('從型態可以知道兩件事', '物件叫什麼、有哪些 attribute'); },
    () => { l.add('operation：+ − × ÷ % ==（像 integer）'); say('還有可以做的 operation', '例如整數的加減乘除、餘數、相等'); },
    () => { l.add('大小看型態：char 1 byte、int 4 bytes'); say('它佔多大空間', '要看你用哪種資料型態實作'); },
    () => { l.add('重點：這個 data type 有哪些功能', 'ptr'); say('重點是知道', '這個 data type 有哪些功能'); },
    () => { tag('ADT：machine independent、implementation independent', 'ptr alt', 0, 5.7, -1.6); say('所以有 abstract data type（ADT）', '跟機器、跟實作都無關'); },
    () => { st.kill(); nat = code(['ADT NaturalNumber', '  objects: 0 … INT_MAX 之間的有序整數', '  functions:', '    IsZero(x), Add(x, y), Equal(x, y), …'], -2.6, 3.8, 0.48, -1.4); say('例子：自然數 Natural Number'); },
    () => { nat.hl(1); say('object：落在 0 到最大值之間', '最大值由電腦決定'); },
    () => { nat.hl(3); say('function：能對自然數做什麼', '例如判斷是不是 0'); },
    () => { nat.hl(-1); no('int？float？char？無關', -2.6, 1.0, 0.4); say('它是 integer、float 還是 character', '一點關係都沒有'); },
    () => { ok('ADT 的精神：跳脫實作，只講是什麼、能做什麼', 0, 0.3, 2.2); say('ADT 的精神', '跳脫 implementation'); },
  ]);
}]);

// 22:26 implementation dependent 的例子
FRAG.push(['cplx-peng1-impl', '綁在實作上 vs 只講概念', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let cd, mem;
  await run(tok, [
    () => { cd = code(['for (i = 0; i < n; i++)', '  z[i] = x[i];'], -3.2, 4.0, 0.5, -1.4); say('兩個 array：x 和 z', '把 x 的值給 z'); },
    () => { idx('char 版、int 版：for 迴圈一模一樣', -3.2, 2.8, -1.4); say('不管是什麼型態', 'for 迴圈完全一模一樣'); },
    () => {
      for (let i = 0; i < 6; i++) cube('', C_A, [0.4, 0.3, 0.6], 0.6 + i * 0.45, 0.15, 0.8);
      for (let i = 0; i < 3; i++) cube('', C_B, [1.3, 0.3, 0.6], 1.05 + i * 1.35, 0.15, 2.0);
      idx('char：1 byte 一格', 4.4, -0.1, 0.8); idx('int：4 bytes 一格', 5.2, -0.1, 2.0);
      say('implementation dependent', 'char 和 int 佔的 memory 不一樣');
    },
    () => { no('要寫清楚：哪個位置 copy 到哪個位置', 2.4, 1.4, 1.4); say('綁在實作上就要講', 'memory 的哪個位置 copy 到哪'); },
    () => { ok('DS 希望跳脫細節：就是「把 x 給 z」', -3.2, 1.6, 0.4); say('資料結構希望跳脫這些細節', '很自然地講出概念'); },
    () => { note('課本的 array ADT：檢查 size、起頭結尾…', -3.2, 0.8, 1.2); say('課本的 array', '會講它的 function：檢查 size 等'); },
  ]);
}]);

// 24:36 演算法：解決問題的方法
FRAG.push(['cplx-peng1-algo', '演算法：input、output、有限、有效率', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let a, inp, out, l;
  await run(tok, [
    () => { T('知道要用哪些 DS 之後 → 用演算法做事', 0, 5.0, -1.6); say('知道要用哪些資料結構', '要做事就用到演算法'); },
    () => { a = prop('file', 0, 0, 0, 1.2, '演算法'); say('禮拜二講過：什麼是演算法？'); },
    () => { l = list(0, 3.6, -1.0); l.add('解決問題的方法，有一些 requirements'); say('演算法是解決問題的方法', '它有一些 requirements'); },
    async () => { inp = prop('parcel', -4.6, 0, 0, 0.8, 'input：問題給什麼'); const p = pkt('input', -4.6, 1.3, 0); await travel(tok, p, V3(-4.6, 1.3, 0), V3(-0.8, 1.3, 0), 800); remove(p); say('問題是什麼，寫在 input 裡'); },
    () => { out = prop('parcel', 4.6, 0, 0, 0.8, 'output：要吐回的答案'); say('output 是要吐回去的答案', 'input、output 反映你要解的問題'); },
    () => { l.add('真的能解決問題：給 input 得到 output', 'good'); say('設計的方法要真的能解決問題'); },
    () => { l.add('有限步驟內跑完、會停止', 'good'); say('在有限的步驟內跑完', '會停止'); },
    () => { l.add('有效率，不是暴力法', 'good'); say('有效率的演算法', '不是暴力法'); },
    () => { T('最簡單的例子：排序（sort）', 0, 5.6, -1.6); say('最簡單的例子：排序'); },
    () => { inp.userData.label.element.textContent = 'input：一堆數字 5 3 8 1'; out.userData.label.element.textContent = 'output：一堆數字'; say('input 是一堆數字', 'output 也是一堆數字'); },
    () => { out.userData.label.element.textContent = 'output：1 3 5 8（從小到大）'; say('output 要符合條件', '從小到大（或從大到小）'); },
    () => { note('怎麼解？bubble sort、selection sort…', 0, 2.2, 2.0); say('那你怎麼解？', '學過 bubble sort、selection sort'); },
  ]);
}]);

// 27:30 selection sort 的概念、pseudocode、程式
FRAG.push(['cplx-peng1-selconcept', 'Selection sort：從 unsorted 選最小，接到 sorted 尾巴', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const v = [34, 8, 64, 51, 32, 21];
  let arr, ps, real, sl, ul;
  await run(tok, [
    () => { T('Selection sort 怎麼做？', 0, 5.0, -1.6); arr = row(v, -2.5, 1.4, 1.0); say('selection sort 是怎麼做的？'); },
    () => { note('selection = 選', 0, 4.3, -1.6); say('看字面意義', 'selection 就是「選」'); },
    async () => { await lift(tok, arr[1], true, 0.6); ptr('最小的 → 放第一個', -1.5, 2.5, 1.4); say('每次從這堆數字選最小的', '放在第一個位置'); },
    () => { note('再從剩下的選最小 → 放第二個…', 0, 3.6, -1.6); say('再從剩下的選最小的', '放第二個、第三個…'); },
    async () => { await lift(tok, arr[1], false, 0.6); sl = ok('sorted（排好的）', -4.6, 1.0, 1.4); ul = no('unsorted（還沒排）', 1.0, 2.4, 1.4); say('數字分成兩個 set', '排好序的、還沒排好的'); },
    () => { note('從 unsorted 找最小 → 接到 sorted 的尾巴', 0, 2.9, -1.6); say('從 unsorted 裡找最小的', '放到 sorted 的最尾巴'); },
    () => { ps = code(['for (i = 0; i < n; i++) {', '  檢查 list[i] 到 list[n−1]，', '  假設 list[min] 最小；', '  把 list[i] 和 list[min] 交換', '}'], 4.4, 3.2, 0.46, -1.0); ps.hl(0); say('寫成 pseudocode', '數字放在 array list 裡'); },
    () => { ps.hl(1); say('檢查 list[i] 到 list[n−1]', '這段 unsorted，選最小的'); },
    () => { ps.hl(-1); real = code(['void sort(int list[], int n) {', '  for (i = 0; i < n − 1; i++) {', '    min = i;', '    for (j = i + 1; j < n; j++)', '      if (list[j] < list[min]) min = j;', '    SWAP(list[i], list[min], temp);', '  } }'], -3.8, 4.2, 0.42, -1.6); real.hl(1); say('變成實際的 code', '外層 for 和 pseudocode 一模一樣'); },
    () => { real.hl(4); say('內層 for 在 unsorted 裡選最小', '最小的位置記在 min'); },
    () => { real.hl(5); prop('keyboard', 4.4, 0, 2.4, 0.8, '自己寫、自己 debug'); say('看不懂？寫進 Visual Studio', '丟一堆數字進去 debug'); },
  ]);
}]);

// 32:26 實際跑一次：34、8、64、51、32、21
FRAG.push(['cplx-peng1-seltrace', 'Selection sort 實際跑一次', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const a = [34, 8, 64, 51, 32, 21];
  let arr, ul = [], pass;
  const X = (i) => -2.5 + i;
  const swapAt = async (i, j) => {
    if (i === j) return;
    const mi = arr[i], mj = arr[j], xi = mi.position.x, xj = mj.position.x;
    await anim(tok, 500, (u) => { mi.position.x = xi + (xj - xi) * u; mj.position.x = xj + (xi - xj) * u; mi.position.y = mj.position.y = 0.32 + Math.sin(u * Math.PI) * 0.7; });
    arr[i] = mj; arr[j] = mi; [a[i], a[j]] = [a[j], a[i]];
  };
  const mark = (i) => { tint(arr[i], '#9fd8b0'); ul.push(line(X(i) - 0.4, 0.02, X(i) + 0.4, 0.02, 0.6, '#0f5a3a')); };
  const pick = (i) => { let m = i; for (let k = i + 1; k < 6; k++) if (a[k] < a[m]) m = k; return m; };
  await run(tok, [
    () => { arr = row(a, -2.5, 0, 1.0); pass = tag('A[0] = 34、A[1] = 8 … 共 6 個', 'ptr alt', 0, 2.6, 0); say('模擬一次：A[0] = 34、A[1] = 8', '總共 6 個數字'); },
    async () => { glow(arr[1], '#5a3a00'); txt(pass, '第 1 輪：最小 8 和 34 交換'); await swapAt(0, 1); glow(arr[0], null); say('第一輪：最小的是 8', '和位置 0 的 34 交換（swap）'); },
    () => { mark(0); txt(pass, '畫底線 = 已經排好'); say('有底線的', '代表已經選出、排好序了'); },
    async () => { txt(pass, '第 2 輪：剩下 5 個裡最小是 21 → 和 34 交換'); await swapAt(1, pick(1)); mark(1); say('剩下 5 個裡最小是 21', '和 34 交換'); },
    async () => { txt(pass, '第 3 輪：64 51 32 34 → 32 和 64 交換'); await swapAt(2, pick(2)); mark(2); say('8、21 排好了', '剩 64、51、32、34 → 32 和 64 交換'); },
    async () => { for (let i = 3; i < 5; i++) { await swapAt(i, pick(i)); mark(i); } mark(5); txt(pass, '全部都有底線 → 排好了 ✓'); say('一直做下去', '全部都有底線，就排好了'); },
    () => { note('細節：pass 2 之後，從剩下的數字裡選最小', 0, 3.3, 0); say('更細的步驟：pass 2', 'A[2] 排好後再從剩下的選'); },
    () => { note('選到最小 → exchange（swap）', 0, 4.0, 0); say('選到最小的', '就做交換'); },
  ]);
}]);

// 35:09 排序有好多種演算法
FRAG.push(['cplx-peng1-sorts', '排序演算法有很多種：誰最快？', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let names = [], q, l;
  const b = (t, i, c) => { const m = buddy(t, '', c, -5.0 + i * 2.5, 0, 0.6, 0.7); names.push(m); return m; };
  await run(tok, [
    () => { b('selection', 0, C_A); b('bubble', 1, C_B); say('排序不只一種演算法', 'selection sort、bubble sort'); },
    () => { b('quick', 2, C_C); b('merge', 3, C_E); say('還有 quick sort、merge sort'); },
    () => { T('設計理念都不一樣，但都能排好', 0, 4.4, -1.4); say('每種的設計理念不一樣', '但都能解決排序問題'); },
    () => { q = T('最快的 sort 是哪個？', 0, 3.7, -1.4); names.forEach((n) => n.mood('wow')); say('那最快的 sort 是什麼？'); },
    () => { txt(q, '最快可以達到 n log n'); say('最快可以達到 n log n'); },
    () => { l = list(0, 3.0, 1.4); l.add('comparison-based：兩兩比大小'); say('這是基於 comparison', '也就是兩兩比大小'); },
    async () => { names[2].mood('happy'); await names[2].hop(tok); l.add('comparison-based 裡：quick sort 最快', 'good'); say('comparison-based 裡', 'quick sort 最快（名字取得好）'); },
    () => { icon('🪣', 'radix／bucket／hash：不用兩兩比', 4.6, 0.6, 2.6); say('不是 comparison-based 的', 'radix、bucket、用 hash 丟進 bucket'); },
    () => { l.add('不比較的方法 → 可以更快', 'ptr'); say('不用兩兩比較', '所以可以更快'); },
  ]);
}]);

// 38:23 搜尋問題：binary search 找 6
FRAG.push(['cplx-peng1-bsearch', '搜尋：binary search 找 6', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.0, 0]);
  const V = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const X = (i) => -6.3 + i * 0.9;
  let arr, q, m, l;
  await run(tok, [
    () => { T('第二個例子：搜尋', 0, 4.6, -1.6); say('第二個例子：搜尋'); },
    () => { note('Binary search', 0, 3.9, -1.6); say('binary search 有沒有聽過？'); },
    () => { arr = row(V, -6.3, 0.4, 0.9, C_ROW, 0.7); q = pkt('6 在不在裡面？', 0, 2.8, 1.6); say('給你一堆數字，使用者問：', '6 有沒有在裡面？在哪裡？'); },
    async () => { const h = pkt('一個一個看', X(0), 1.3, 0.4); await travel(tok, h, V3(X(0), 1.3, 0.4), V3(X(14), 1.3, 0.4), 1600); remove(h); say('最笨的方法：一個一個驗明正身', 'n 個都看過'); },
    () => { ok('更好的：binary search', 4.6, 3.2, 0.4); say('更好的方法', 'binary search'); },
    () => { note('binary search ≠ binary search tree', 4.6, 2.5, 0.4); say('注意：binary search 是演算法', 'binary search tree 是講 tree'); },
    () => { l = list(-3.4, 3.2, 0.4); l.add('二分法：數字必須先排好序', 'ptr'); say('概念是二分法', '要件：數字必須先排好序'); },
    () => { arr.forEach((c) => glow(c, '#0f5a3a')); say('先做功課：0 到 28 排好序'); },
    async () => { arr.forEach((c) => glow(c, null)); await lift(tok, arr[7], true, 0.5); m = ptr('中間：14', X(7), 2.0, 0.4); say('要找 6：先從中間切一半'); },
    async () => { for (let i = 7; i < 15; i++) tint(arr[i], '#d8cfc0'); txt(m, '6 < 14 → 只看左半邊'); say('6 比 14 小', '一定在左半邊（右半邊都比 14 大）'); },
    async () => { await lift(tok, arr[7], false, 0.5); await lift(tok, arr[3], true, 0.5); m.position.x = X(3); txt(m, '左半邊的中間：6'); say('左半邊再切一半', '剛好是 6'); },
    () => { glow(arr[3], '#0f5a3a'); txt(q, '找到了：在 array 第 3 個位置'); say('找到了', '回報它在 array 的第 3 個位置'); },
  ]);
}]);

// 42:12 找不到的例子、其他搜尋方法
FRAG.push(['cplx-peng1-bsearch2', '找 25：找不到；還有 BST、hash', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.0, 0]);
  const V = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const X = (i) => -6.3 + i * 0.9;
  let arr, m, q;
  const range = (a, b) => arr.forEach((c, i) => tint(c, i >= a && i <= b ? C_ROW : '#d8cfc0'));
  await run(tok, [
    async () => { arr = row(V, -6.3, 0.4, 0.9, C_ROW, 0.7); q = pkt('找 25', 0, 2.8, 1.6); m = ptr('中間：14', X(7), 2.0, 0.4); say('數字不一定找得到', '例如找 25'); },
    () => { range(8, 14); txt(m, '25 > 14 → 往右'); say('切一半是 14', '25 比較大，往右邊走'); },
    () => { m.position.x = X(11); txt(m, '14～28 的中間：22 → 25 更大'); range(12, 14); say('14 到 28 切一半是 22', '25 比 22 大'); },
    () => { m.position.x = X(13); txt(m, '再切：26 → 只剩 24'); range(12, 12); say('再切一半是 26', '切到最後只剩一個數字'); },
    () => { range(-1, -1); txt(q, '沒有 25 → 回報找不到'); say('都沒看到 25', '回報：這堆數字裡沒有 25'); },
    () => { note('方法一：一個一個看　方法二：排序後二分', 0, 3.6, -1.6); say('最笨：一個一個看', '第二種：先排序再二分'); },
    () => { icon('🌳', '建 binary search tree 去走', -4.4, 0.6, 2.6); say('還有：把數字建成 binary search tree', '在 tree 上找'); },
    () => { icon('🪣', 'hash：丟到對應的 bucket 再找', 0, 0.6, 2.8); say('將來還會學 hash', '用 hash function 丟進 bucket'); },
    () => { ok('同一個問題，可以想出好多種演算法', 4.4, 1.4, 2.6); say('光是「找數字」這個問題', '就能想出好多種方法'); },
  ]);
}]);

// 44:35 怎麼思考：從 naive 開始
FRAG.push(['cplx-peng1-naive', '思考的方法：先想 naive，再找更好的', async (tok) => {
  P.fresh([0, 6, 12], [0, 1.2, 0]);
  let me, l;
  await run(tok, [
    () => { me = buddy('你', '', C_B, -4.6, 0, 0.6, 0.9); T('這就是「思考」', 0, 4.4, -1.4); say('這就是思考'); },
    () => { l = list(1.6, 3.4, -0.4); l.add('讀書時就能訓練'); say('思考平常讀書就能訓練'); },
    () => { l.add('先問：它要解決的問題是什麼？'); say('要知道它要解決的問題是什麼', '再用你所學去想解法'); },
    () => { l.add('問題定清楚 → 最笨（naive）的方法是什麼？'); me.set('naive'); say('研究時：問題要定得很明確', '先問最笨、最 naive 的方法'); },
    async () => { l.add('從 naive 的觀察 → 找到更好的方法', 'good'); me.set('naive +'); me.mood('happy'); await me.hop(tok); say('有了 naive 的方法', '從觀察中找到更好的'); },
    () => { l.add('讀書、研究不是硬梆梆的：腦筋一直在轉'); say('讀書和研究不是硬梆梆的', '腦筋隨時在轉'); },
  ]);
}]);

// 46:23 binary search 的 pseudocode
FRAG.push(['cplx-peng1-bspseudo', 'Binary search 的 pseudocode：left、right、middle', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.2, 0]);
  const V = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const X = (i) => -6.3 + i * 0.9;
  let arr, ps, L, R, M;
  await run(tok, [
    () => { arr = row(V, -6.3, 1.6, 0.9, C_ROW, 0.7); say('演算法：先排序、找中間、切一半'); },
    () => { T('想好了 → 下一步：怎麼 implement', 0, 5.0, -1.6); say('知道演算法之後', '下一階段：怎麼 implement'); },
    () => { ps = code(['while (還有數字沒檢查) {', '  middle = (left + right) / 2;', '  if (searchnum < list[middle])', '    right = middle − 1;', '  else if (searchnum == list[middle])', '    return middle;', '  else left = middle + 1;', '}'], 0, 4.4, 0.4, -1.6); say('implement 之前', '先寫 pseudocode'); },
    () => { ps.hl(0); L = ptr('left', X(0), -0.1, 2.5); R = ptr('right', X(14), -0.1, 2.5); say('while：中間還有數字沒檢查'); },
    async () => { ps.hl(1); M = ptr('middle', X(7), 2.6, 1.6); await lift(tok, arr[7], true, 0.4); say('middle = (left + right) / 2', '中位數的位置'); },
    () => { ps.hl(2); pkt('searchnum = 6', 5.4, 2.4, 1.6); say('searchnum 比 list[middle] 小', '就找左半邊'); },
    async () => { ps.hl(3); for (let i = 7; i < 15; i++) tint(arr[i], '#d8cfc0'); await travel(tok, R, R.position.clone(), V3(X(6), -0.1, 2.5), 700); say('左半邊怎麼表示？', '把 right 設成 middle − 1（12 那格）'); },
    () => { ps.hl(5); say('如果剛好等於 list[middle]', '直接 return 它的位置'); },
    () => { ps.hl(6); note('否則往右：left = middle + 1', -3.0, 3.2, 1.6); say('不是的話就往右', 'left 設成 middle + 1'); },
    () => { ps.hl(-1); ok('寫成 C／C++ 就能跑：只是換成語言的格式', 0, 0.6, 3.4); say('最後真的 implement 出來', '就是換成能跑的語言格式'); },
  ]);
}]);

// 49:33 演算法 vs 程式語言
FRAG.push(['cplx-peng1-lang', '演算法才是根本：語言只是查表換格式', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  let chain = [], me, l;
  const ch = (t, i) => { const s = tag(t, 'note', -5.0 + i * 2.5, 4.6, -1.6); chain.push(s); return s; };
  await run(tok, [
    () => { ch('問題（ADT 的 function）', 0); say('演算法在找解決問題的方法', '對應到 ADT 的 function'); },
    () => { ch('例：排序問題 → 一堆演算法', 1); say('例如排序：給一堆數字', '從小到大輸出'); },
    () => { ch('pseudocode', 2); say('演算法出來後', '先寫 pseudocode'); },
    () => { ch('順便看 complexity', 3); say('寫 pseudocode 時', '也可以順便看 complexity'); },
    () => { ch('→ 程式：只差語言格式', 4); say('pseudocode 到程式', '頂多是換成那個語言的格式'); },
    () => { tag('演算法跟 C++、Java 無關', 'ptr alt', 0, 3.8, -1.6); say('演算法很重要', '它跟 C++、Java 沒有關係'); },
    () => { me = buddy('你', 'My Search', C_B, -4.0, 0, 1.2, 0.85); me.mood('happy'); say('假設你想出比所有方法都好的', '叫 My Search'); },
    () => { icon('🐍', 'Python？', -1.0, 0.6, 1.6); say('用你最熟悉的語言做出來', '例如 Python'); },
    () => { icon('📖', '查表、查書：while、for 的語法', 2.0, 0.6, 1.6); say('換語言只是查表、查書', 'while、for 怎麼寫'); },
    () => { no('不要為了學語言而學語言', 0, 2.9, 2.6); say('不要為了學語言而學語言'); },
    () => { ok('最 fundamental：解決問題的方法', 0, 2.2, 2.6); say('最根本的是', '學會解決問題的方法'); },
    () => { icon('📱', 'iPhone：Objective-C　Android：Java', 4.8, 0.6, 1.6); say('新語言很熱門', 'iPhone 用 Objective-C，Android 用 Java'); },
    () => { me.set('先有想法'); say('目的應該是：我有一個演算法、應用', '想放到 iPhone 上，才去學那個語言'); },
    () => { l = note('別急著開 IDE：先想清楚、寫 pseudocode', -4.0, 3.0, 1.2); me.mood('calm'); say('不要急著開 Visual C、Java 的 IDE', '先想清楚，寫 pseudocode'); },
  ]);
}]);

// 54:42 Selection problem：第 k 大
FRAG.push(['cplx-peng1-kth', 'Selection problem：找第 k 大', async (tok) => {
  P.fresh([0, 6.5, 13], [0, 1.2, 0]);
  const N = [12, 45, 7, 33, 90, 21, 58, 3];
  let arr, l, kb = [], a1, a2;
  const X = (i) => -5.6 + i * 0.85;
  await run(tok, [
    () => { T('第三個例子：Selection problem', 0, 5.2, -1.6); say('第三個例子', 'selection problem'); },
    () => { arr = row(N, -5.6, 0, 0.85, C_ROW, 0.7); say('給你 N 個數字', '問第 k 大的數字'); },
    () => { note('k = 1：最大的（第一大）', 0, 4.5, -1.6); say('k = 1 就是最大的', '第 k 大：第一大、第二大…'); },
    () => { pkt('input：數字 ＋ k（這裡 k = 3）', -2.6, 2.2, 0); pkt('output：第 k 大', 3.4, 2.2, 0); say('input：一堆數字和 k', 'output：第 k 大的數字'); },
    async () => {
      a1 = list(-2.6, 3.6, -1.0); a1.add('Approach 1：全部 n 個從大到小排序，取位置 k');
      const s = N.slice().sort((x, y) => y - x);
      s.forEach((v, i) => { arr[i].userData.lbl.element.textContent = String(v); });
      await wait(tok, 300); glow(arr[2], '#0f5a3a');
      say('方法一：放進 array', '從大到小排序，看位置 k');
    },
    () => { a1.add('最直接（naive），也許還不錯'); say('這是最笨的方法', '也許還不錯'); },
    () => { glow(arr[2], null); N.forEach((v, i) => { arr[i].userData.lbl.element.textContent = String(v); }); say('還有沒有別的方法？'); },
    () => {
      a2 = list(3.0, 3.6, -1.0); a2.add('Approach 2：先拿 k 個來排序');
      kb = [45, 12, 7].map((v, i) => buddy('', v, C_D, 1.8 + i * 1.3, 0, 2.4, 0.55));
      for (let i = 0; i < 3; i++) tint(arr[i], '#d8cfc0');
      say('方法二：只拿 k 個進來', '這 k 個從大到小排好');
    },
    async () => {
      a2.add('其他的跟最後一個比：比較小就丟掉');
      const p = pkt('33 > 7 → 放進來', X(3), 1.3, 0); await travel(tok, p, V3(X(3), 1.3, 0), V3(4.4, 1.6, 2.4), 800); remove(p);
      kb[0].set(45); kb[1].set(33); kb[2].set(12); tint(arr[3], '#d8cfc0');
      say('沒選進來的，一個一個跟最後一個比', '比它小就丟了吧');
    },
    async () => {
      a2.add('比較大 → 插進適當的位置');
      for (const [i, s] of [[4, [90, 45, 33]], [5, null], [6, [90, 58, 45]], [7, null]]) { tint(arr[i], '#d8cfc0'); if (s) s.forEach((v, k) => kb[k].set(v)); await wait(tok, 350); }
      glow(kb[2].body, '#0f5a3a');
      say('比較大的就有機會進來', '放到對的位置 → 最後一個就是答案 45');
    },
    () => { tag('一個排 n 個，一個只排 k 個', 'ptr alt', 0, 1.6, 3.2); say('兩個都能找到第 k 大', '一個排 n 個、一個只排 k 個'); },
    () => { no('n 遠大於 k：方法一一定比較差', -2.6, 2.4, 3.2); say('n 遠遠超過 k 的話', '方法一一定比方法二差'); },
    () => { ok('方法二：排完 k 個後只要做比較', 3.0, 2.4, 3.2); say('方法二排完 k 個', '後面只要做 comparison'); },
    () => { note('selection problem ≠ sorting problem', 0, 5.9, -1.6); say('selection 和 sorting', '不是同一個問題'); },
    () => { note('但可以借 sorting 的方法來解 → 知識', 0, 6.5, -1.6); say('但可以用 sorting 的方法來解', '學過的東西會變成你的知識'); },
    () => { buddy('你', '💡', C_B, -5.6, 0, 2.6, 0.75).mood('happy'); say('遇到新問題', '回想學過的哪些知識可以用'); },
    () => { icon('🧗', '站在巨人的肩膀上', 5.6, 0.6, 2.8); say('站在巨人的肩膀上', '去解更 advanced 的問題'); },
  ]);
}]);

// 1:05:30 遞迴演算法與階乘
FRAG.push(['cplx-peng1-rec', '遞迴演算法：n! 與 boundary condition', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let cd, calls = [], cnt;
  const callBox = (t, i) => { const m = cube(t, '#f3c99a', [2.4, 0.45, 1.0], 2.6 + i * 0.3, 0.25 + i * 0.5, 0.6); calls.push(m); return m; };
  await run(tok, [
    () => { T('Recursive algorithm：自己呼叫自己', 0, 5.2, -1.6); say('演算法裡還有一種', 'recursive algorithm'); },
    () => { buddy('f', '', C_A, -5.2, 0, 0.6, 0.75); note('f 呼叫 f：direct', -5.2, 2.0, 0.6); say('function 呼叫自己', '叫 direct recursive'); },
    () => { buddy('f1', '', C_B, -3.2, 0, 1.6, 0.6); buddy('f2', '', C_C, -1.8, 0, 1.6, 0.6); note('f1 → f2 → f2…：f1 也算 recursive', -2.5, 1.6, 2.4); say('function 1 呼叫 function 2', '透過別的函式產生遞迴'); },
    () => { tag('C(n, m) = C(n−1, m) + C(n−1, m−1)', 'ptr alt', 0, 4.4, -1.6); say('例：n 個取 m 個的組合數', '可以拆成兩個 n−1 的問題'); },
    () => { no('不要讓它無限呼叫下去', 0, 3.7, -1.6); say('設計遞迴時', '不要讓它進入無限的呼叫'); },
    () => { note('演算法要會停止', 0, 3.1, -1.6); say('演算法有個條件', '要讓它停止'); },
    () => { tag('boundary condition = 停的條件', 'ptr', 0, 2.5, -1.6); say('什麼時候停？', '要注意 boundary condition'); },
    () => { cnt = tag('n! = n × (n−1)!', 'ptr alt', 4.0, 4.4, 0.6); say('例：n 階乘 = n × (n−1)!'); },
    async () => { for (const [t, i] of [['fact(4) = 4 × fact(3)', 0], ['fact(3) = 3 × fact(2)', 1], ['fact(2) = 2 × fact(1)', 2], ['fact(1) = 1 × fact(0)', 3]]) { callBox(t, i); await wait(tok, 260); } say('寫成 fact(n) = n × fact(n−1)', '自己呼叫自己'); },
    () => { callBox('fact(0) = 1 → 停', 4); tint(calls[4], '#9fd8b0'); say('n = 0 時就必須停止', '0! = 1 就是 boundary condition'); },
    () => { cd = code(['int fact(int n) {', '  if (n == 0) return 1;', '  return n * fact(n − 1);', '}'], -3.4, 3.4, 0.48, 0.4); cd.hl(1); say('程式裡寫在 if n == 0', '直接 return 1'); },
    async () => { cd.hl(2); const v = [1, 2, 6, 24]; for (let i = 3; i >= 0; i--) { P.relabel(calls[i], '= ' + v[3 - i]); glow(calls[i], '#0f5a3a'); await wait(tok, 300); } say('不是 0 就 return n × fact(n−1)', '一路返回：1、2、6、24'); },
    () => { cd.hl(1); ok('寫遞迴時千萬問自己：它什麼時候停？', -3.4, 0.6, 1.6); say('寫遞迴千萬記得問自己', '它什麼時候停止'); },
  ]);
}]);

// 1:08:56 遞迴乘法
FRAG.push(['cplx-peng1-mult', '遞迴乘法：mult(a, b) = mult(a, b−1) + a', async (tok) => {
  P.fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  let f, cd, calls = [];
  await run(tok, [
    () => { f = tag('A × B', 'ptr alt', 0, 4.6, -1.4); say('講完這個就下課：A 乘 B'); },
    async () => { txt(f, 'A × B = A × (B−1) + A'); for (let i = 0; i < 3; i++) { calls.push(cube(['5 × 3 = 5 × 2 + 5', '5 × 2 = 5 × 1 + 5', '5 × 1'][i], '#f3c99a', [2.4, 0.45, 1.0], -3.6 + i * 0.3, 0.25 + i * 0.5, 0.6)); await wait(tok, 250); } say('A × B = A × (B−1) + A', 'B 會一直遞減（以 5 × 3 為例）'); },
    () => { tint(calls[2], '#9fd8b0'); P.relabel(calls[2], '5 × 1 = 5 → 停'); say('B = 1 時就要停', '回報的值是 A'); },
    () => { cd = code(['int mult(int a, int b) {', '  if (b == 1) return a;', '  return mult(a, b − 1) + a;', '}'], 3.0, 3.6, 0.48, -0.6); cd.hl(1); say('function mult(a, b)', 'boundary：if b == 1 return a'); },
    async () => { cd.hl(2); for (const [i, v] of [[1, 10], [0, 15]]) { P.relabel(calls[i], '= ' + v); glow(calls[i], '#0f5a3a'); await wait(tok, 350); } say('否則 return mult(a, b−1) + a', '很簡單的乘法也能寫成遞迴'); },
  ]);
}]);
  }
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
