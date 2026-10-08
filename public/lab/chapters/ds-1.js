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
  // ═══ course1.js ═══
  {
// ─── 課程 part 1：第 1～5 課（演算法、虛擬碼、資料結構、loop invariant、為什麼要分析效率）───
// Each lesson is one scene in manual mode: every step(tok) is one "下一步" and matches explain[k].
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const say = (a, b = '') => ctx.say(a, b);
const C_IN = '#cfe3d4', C_OUT = '#f3dcc0', C_VAL = '#7cb8ee', C_M = '#e8cf8a', C_HOT = '#f4a56a', C_GRAY = '#d8cfc0', C_OK = '#9fd6a8';
const wait = (tok, ms) => anim(tok, ms, () => {});
// a row of values as little characters, with their position number (index) at their feet
function row(vals, x0, dx, z, size = 0.6, color = C_VAL) {
  return vals.map((v, i) => {
    const b = buddy('', v, color, x0 + i * dx, 0, z, size);
    b.idx = tag(i + ' 號', 'idx', x0 + i * dx, -0.05, z + size * 0.85);
    return b;
  });
}
const gone = (...ls) => ls.forEach((l) => remove(l));

// ═══ 第 1 課：演算法是什麼 ═══
FRAG.push(['c1-algorithm-what', '演算法是什麼：輸入、輸出與五大特性', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1, 0]);
  await step(tok);                                   // 1 程式 = 給電腦的指令清單
  const mon = prop('monitor', 0, 0, -1.4, 1.3, '電腦：很快，但只會照指令做');
  const cpu = prop('cpu', 0, 0, 0.9, 0.8);
  const prog = prop('file', -2.2, 0, 0.4, 0.9); bob(prog, 0.05);
  const progL = tag('程式＝一張指令清單', 'note', -2.2, 1.6, 0.4);
  say('程式：給電腦照做的指令', '電腦 + 程式 → 做事');
  await step(tok);                                   // 2 輸入
  zone('輸入區', -4.9, 0, 0.6, 3.8, 2.6, C_IN);
  const ins = [5, 3, 8, 1, 7].map((v, i) => buddy('', v, C_VAL, -6.3 + i * 0.7, 0, 0.9, 0.5));
  const inL = tag('輸入：交給程式處理的資料', 'say', -4.9, 1.5, 0.6);
  const chip = tag('5 3 8 1 7', 'pkt', -4.9, 1.0, 1.7);
  await travel(tok, chip, V3(-4.9, 1.0, 1.7), V3(0, 1.0, 1.5), 1000);
  remove(chip); glow(mon.children[1], '#1d4a6a');
  say('輸入：交給程式的資料', '例：5、3、8、1、7');
  await step(tok);                                   // 3 輸出
  zone('輸出區', 4.9, 0, 0.6, 3.6, 2.6, C_OUT);
  const outB = buddy('答案', '', C_M, 4.9, 0, 0.9, 0.8);
  const outL = tag('輸出：程式交回來的結果', 'say', 4.9, 2.1, 0.6);
  const ans = tag('最小的在 3 號', 'pkt', 0, 1.0, 1.5);
  await travel(tok, ans, V3(0, 1.0, 1.5), V3(4.9, 1.0, 1.7), 1000);
  remove(ans); outB.set('3 號'); outB.mood('happy'); ins[3].mood('wow');
  await outB.hop(tok);
  say('輸出：交回來的結果', '輸入 → 程式 → 輸出');
  await step(tok);                                   // 4 演算法 = 程式譜
  remove(progL);
  const rec = tag('演算法＝解題步驟（程式譜）', 'say', 0, 3.7, -1.4);
  const rec2 = tag('食譜→做菜｜樂譜→演奏｜程式譜→計算', 'note', 0, 3.1, -1.4);
  await anim(tok, 600, (u) => { prog.rotation.y = u * Math.PI * 2; });
  say('演算法＝把輸入變輸出的步驟', '演算法（想法）→ 程式（寫出來）');
  await step(tok);                                   // 5 五大特性：輸入、輸出
  gone(rec, rec2, inL, outL);
  const five = code(['五大特性（Knuth）', '① 輸入 Input', '② 輸出 Output', '③ 明確性 Definiteness', '④ 有效性 Effectiveness', '⑤ 有限性 Finiteness'], -4.6, 4.9, 0.5, -2.6);
  five.hl(1);
  const g0 = tag('輸入：0 個以上', 'good', -4.9, 1.5, 0.6);
  await wait(tok, 700);
  five.hl(2);
  const g1 = tag('輸出：至少 1 個，而且要對', 'good', 4.9, 2.1, 0.6);
  await outB.hop(tok);
  say('合格演算法的五個特性', '① 輸入 ② 輸出');
  await step(tok);                                   // 6 明確性
  gone(g0, g1);
  five.hl(3);
  const chef = buddy('讀步驟的人', '', '#c8a2e8', -2.3, 0, 2.8, 0.7);
  const d1 = tag('「打蛋」一看就懂 ✓', 'good', -2.3, 2.3, 2.8);
  chef.mood('happy'); await chef.hop(tok);
  const d2 = tag('「鹽加適量」？要加多少 ✗', 'bad', -2.3, 1.7, 2.8);
  chef.mood('wow');
  say('③ 明確：每步都不模稜兩可', '給「人」看的');
  await step(tok);                                   // 7 有效性
  gone(d1, d2); chef.mood('calm');
  five.hl(4);
  cpu.children.forEach((c) => { if (c.material) glow(c, '#3a2a00'); });
  const e1 = tag('加減、比大小 ✓ 電腦做得到', 'good', 2.6, 1.7, 2.6);
  const e2 = tag('「這裡變個魔術」✗', 'bad', 2.6, 1.1, 2.6);
  await anim(tok, 800, (u) => { cpu.rotation.y = u * Math.PI / 2; });
  say('④ 有效：每步電腦都做得到', '給「電腦」看的');
  await step(tok);                                   // 8 有限性
  gone(e1, e2);
  five.hl(5);
  const lp = tag('while (1) { … }', 'pkt', 1.2, 0.8, 0.9);
  await anim(tok, 1600, (u) => { const a = u * Math.PI * 4; lp.position.set(Math.cos(a) * 1.3, 0.8, 0.9 + Math.sin(a) * 1.0); });
  const f1 = tag('兩行就能永遠跑不完 ✗', 'bad', 2.6, 1.7, 2.6);
  const f2 = tag('有限＝跑有限步一定停', 'good', 2.6, 1.1, 2.6);
  mon.children[1].material.emissive.set('#5a1010');
  say('⑤ 有限：一定會停下來', '≠ 程式碼行數有限');
  await step(tok);                                   // 9 新畫面：找最小值
  fresh([0, 6.5, 12], [0, 1, 0]);
  const cd = code(['int getMinIndex(int A[], int len) {', '  int m = 0;', '  for (int i = 1; i < len; i++)', '    if (A[i] < A[m]) m = i;', '  return m;', '}'], -3.0, 4.9, 0.48, -2.6);
  zone('陣列 A（輸入）', 1.5, 0, 0.8, 6.6, 2.0, C_IN);
  const vals = [5, 3, 8, 1, 7];
  const A = row(vals, -1.0, 1.25, 0.8, 0.65);
  const m = buddy('m：目前最小的位置', 0, C_M, -4.7, 0, 1.4, 0.8);
  cd.hl(1); A[0].glow('#5a3a00');
  const ip = tag('i', 'ptr', -1.0, 1.4, 0.8);
  let cur = 0;
  for (let i = 1; i < 5; i++) {
    cd.hl(2);
    await travel(tok, ip, ip.position.clone(), V3(-1.0 + i * 1.25, 1.4, 0.8), 280);
    cd.hl(3);
    if (vals[i] < vals[cur]) { A[cur].glow(); cur = i; A[i].glow('#5a3a00'); m.set(i); m.mood('wow'); await m.hop(tok); }
    else await wait(tok, 280);
  }
  cd.hl(4); m.mood('happy'); A[3].mood('happy');
  say('例：找最小值的位置', '5 3 8 1 7 → m = 3');
  await step(tok);                                   // 10 對照五個特性
  const chk = code(['① 輸入：A 和 len ✓', '② 輸出：m（最小值的位置）✓', '③ 明確：用 C 寫清楚 ✓', '④ 有效：compiler 翻成機器碼 ✓', '⑤ 有限：for 跑 len−1 輪就停 ✓'], 4.0, 4.9, 0.5, -2.6);
  chk.hl(4);
  await m.hop(tok);
  tag('演算法一定要會停（作業系統這種程式可以不停）', 'note', 1.5, 2.3, 0.8);
  say('五個特性逐一打勾', '演算法 ≠ 永遠跑的程式');
}]);

// ═══ 第 2 課：虛擬碼 ═══
FRAG.push(['c1-pseudocode', '虛擬碼：電腦科學的口語', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  await step(tok);                                   // 1 為什麼要虛擬碼
  const wr = buddy('寫演算法的人', '', '#c8a2e8', -5.2, 0, 1.2, 0.85);
  const rd = buddy('要照著寫程式的人', '', C_VAL, 5.2, 0, 1.2, 0.85);
  let panel = code(['int m = 0;', 'for (int i = 1; i < len; i++) {', '  if (A[i] < A[m]) { m = i; }', '}'], 0, 4.8, 0.46, -2.6);
  let pTag = tag('C 程式：給 compiler 看，分號、宣告一個不能少', 'note', 0, 2.7, -2.6);
  const chip = tag('虛擬碼＝電腦科學的口語', 'pkt', -5.2, 1.6, 1.2);
  await travel(tok, chip, V3(-5.2, 1.6, 1.2), V3(5.2, 1.6, 1.2), 1300);
  remove(chip); rd.mood('happy'); await rd.hop(tok);
  say('虛擬碼：寫給人看的程式', 'pseudocode');
  await step(tok);                                   // 2 找最小值的虛擬碼、← 賦值
  panel.kill(); remove(pTag);
  panel = code(['GetMinIndex(A, len)', '  m ← 0', '  for i ← 1 to len − 1', '    if A[i] < A[m] then m ← i', '  return m'], 0, 4.8, 0.46, -2.6);
  panel.hl(1);
  const mb = buddy('m', '', C_M, 0, 0, 1.6, 0.8);
  const zero = tag('0', 'pkt', 0, 3.0, -2.0);
  await travel(tok, zero, V3(0, 3.0, -2.0), V3(0, 0.4, 1.7), 900);
  remove(zero); mb.set(0); mb.mood('wow');
  pTag = tag('← 讀作「設成」：把右邊放進左邊', 'good', 0, 2.0, 1.6);
  say('← 是賦值（assignment）', 'm ← 0 等於 C 的 m = 0');
  await step(tok);                                   // 3 壞寫法一：太詳細
  panel.kill(); remove(pTag);
  panel = code(['a ← A[i]', 'b ← A[m]', 'if a < b then', '  m ← i'], 0, 4.8, 0.46, -2.6);
  pTag = tag('太詳細：重點被細節淹沒 ✗', 'bad', 0, 2.7, -2.6);
  rd.mood('sad');
  say('壞寫法①：太詳細', '只是比大小，卻多抄兩個變數');
  await step(tok);                                   // 4 壞寫法二：太神秘
  panel.kill(); remove(pTag);
  panel = code(['a ← 0', 'for b ← 1 to len − 1', '  if ar[b] < ar[a] then a ← b', 'return a'], 0, 4.8, 0.46, -2.6);
  pTag = tag('太神秘：a、b 到底是什麼？✗', 'bad', 0, 2.7, -2.6);
  rd.mood('wow'); rd.look(-1);
  say('壞寫法②：太神秘', '名字看不出用途');
  await step(tok);                                   // 5 壞寫法三：太抽象
  panel.kill(); remove(pTag);
  panel = code(['跑一個迴圈，', '每一輪更新最小值的位置'], 0, 4.6, 0.46, -2.6);
  pTag = tag('太抽象：怎麼更新？跟誰比？✗', 'bad', 0, 3.2, -2.6);
  rd.mood('sad'); rd.look(0);
  say('壞寫法③：太抽象', '字太少，讀的人要自己猜');
  await step(tok);                                   // 6 好寫法：selection sort
  panel.kill(); remove(pTag); kill(mb.g);
  panel = code(['SelectionSort(A, len)', '  for i ← 0 to len − 1', '    m ← GetMinIndex(A, i … len − 1)', '    交換 A[i] 和 A[m]'], 0, 4.8, 0.46, -2.6);
  pTag = tag('剛剛好：意圖清楚、每步明確 ✓', 'good', 0, 2.7, -2.6);
  rd.mood('happy'); await rd.hop(tok);
  say('好範例：selection sort', '每輪挑最小的，換到最前面');
  await step(tok);                                   // 7 跑一次 [5,3,8,1]
  remove(pTag);
  zone('要排序的陣列', 0, 0, 1.8, 5.6, 1.9, C_IN);
  const S = row([5, 3, 8, 1], -1.9, 1.25, 1.8, 0.6);
  async function swapAt(i, j) {
    const a = S[i].g.position.clone(), b = S[j].g.position.clone();
    await anim(tok, 650, (u) => {
      S[i].g.position.lerpVectors(a, b, u); S[i].g.position.z = a.z + Math.sin(Math.PI * u) * 0.9;
      S[j].g.position.lerpVectors(b, a, u); S[j].g.position.z = b.z - Math.sin(Math.PI * u) * 0.9;
    });
    [S[i], S[j]] = [S[j], S[i]];
  }
  const done = (k) => { S[k].mood('happy'); S[k].glow('#0f3a20'); };
  panel.hl(2); S[3].glow('#5a3a00'); await wait(tok, 250);
  panel.hl(3); await swapAt(0, 3); done(0);
  panel.hl(2); S[1].glow('#5a3a00'); await wait(tok, 300); done(1);
  panel.hl(2); S[3].glow('#5a3a00'); await wait(tok, 250);
  panel.hl(3); await swapAt(2, 3); done(2); done(3);
  say('[5,3,8,1] 排好了', '→ [1,3,8,5] → [1,3,5,8]');
  await step(tok);                                   // 8 小結與考試提醒
  panel.hl(-1);
  tag('「x ← x + 1」＝把 x 加 1 再存回 x', 'note', -4.6, 2.5, 1.2);
  tag('沒有固定文法：意圖清楚就好', 'note', 4.6, 2.5, 1.2);
  wr.mood('happy'); rd.mood('happy');
  await Promise.all([wr.hop(tok), rd.hop(tok)]);
  say('虛擬碼＝非正式的程式', '注意 ← 和迴圈範圍');
}]);

// ═══ 第 3 課：資料結構是什麼 ═══
FRAG.push(['c1-data-structure-what', '資料結構：資料要怎麼收納', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1, 0]);
  await step(tok);                                   // 1 收納資料的方式
  const wh = prop('warehouse', 0, 0, -1.2, 1.6, '記憶體：電腦放資料的倉庫'); bob(wh, 0.03);
  const parcels = [-2.2, -1.1, 1.1, 2.2].map((x) => prop('parcel', x, 0, 1.4, 0.6));
  const n1 = tag('衣櫃收衣服・冰箱收食物・資料結構收資料', 'note', 0, 3.5, -1.2);
  say('資料結構＝收納資料的方式', 'data structure');
  await step(tok);                                   // 2 輸入輸出都是資料
  remove(n1);
  prop('cpu', -4.8, 0, 1.2, 0.9, '演算法在這裡跑');
  const ci = tag('輸入資料', 'pkt', -6.5, 1.0, 2.6);
  await travel(tok, ci, V3(-6.5, 1.0, 2.6), V3(-0.8, 1.0, 1.4), 900);
  remove(ci);
  const co = tag('輸出資料', 'pkt', 0.8, 1.0, 1.4);
  await travel(tok, co, V3(0.8, 1.0, 1.4), V3(6.3, 1.0, 2.6), 900);
  tag('要放哪、怎麼排 → 資料結構決定', 'good', 0, 0.2, 3.0);
  parcels.forEach((p, i) => { p.rotation.y = i * 0.4; });
  say('輸入、輸出都是資料', '資料要擺在記憶體裡');
  await step(tok);                                   // 3 新畫面：200 份考卷四種擺法
  fresh([0, 7, 12.5], [0, 0.6, 0.5]);
  const xs = [-5.1, -1.7, 1.7, 5.1];
  const names = ['照交卷順序疊一疊', '照分數排（高→低）', '照學號排', '照學號尾數分 10 堆'];
  xs.forEach((x, k) => zone(names[k], x, 0, 0.5, 3.1, 2.6, k === 3 ? C_OUT : C_IN));
  for (let s = 0; s < 8; s++) {
    cube('', '#ffffff', [0.9, 0.08, 0.65], -5.1 + (s % 3 - 1) * 0.12, 0.08 + s * 0.09, 0.5 + (s % 2) * 0.1);
    cube('', s < 3 ? '#9fd6a8' : s < 6 ? '#fff1a6' : '#f4b6a6', [0.9, 0.08, 0.65], -1.7, 0.08 + s * 0.09, 0.5);
    cube('', '#ffffff', [0.9, 0.08, 0.65], 1.7, 0.08 + s * 0.09, 0.5);
  }
  for (let p = 0; p < 5; p++) for (let s = 0; s < 2; s++) cube('', '#ffffff', [0.42, 0.08, 0.4], 4.25 + (p % 3) * 0.6, 0.08 + s * 0.09, p < 3 ? 0.1 : 0.8);
  tag('0～9', 'idx', 5.1, 0.5, 1.6);
  const st = buddy('來拿考卷的同學', '', '#c8a2e8', 0, 0, 3.3, 0.75);
  say('200 份考卷，怎麼擺？', '同樣的資料，好幾種收納法');
  await step(tok);                                   // 4 看用途
  tag('找自己的要翻整疊 ✗', 'bad', -5.1, 1.5, 0.5);
  tag('看成績分布', 'note', -1.7, 1.5, 0.5);
  tag('登記成績', 'note', 1.7, 1.5, 0.5);
  tag('發考卷最快 ✓', 'good', 5.1, 1.5, 0.5);
  await travel(tok, st.g, V3(0, 0, 3.3), V3(5.1, 0, 2.6), 1000);
  st.mood('happy'); await st.hop(tok);
  say('好不好，看拿來做什麼', '資料結構 ↔ 使用情境（演算法）');
  await step(tok);                                   // 5 新畫面：找最小值 1000 vs 10
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  zone('資料亂放：一筆一筆找', 0, 0, 1.6, 12.6, 1.6, C_OUT);
  zone('資料先用特別的方式排好', 0, 0, -1.4, 12.6, 1.6, C_IN);
  const r1 = buddy('', '', C_HOT, -5.6, 0, 1.6, 0.6), r2 = buddy('', '', C_OK, -5.6, 0, -1.4, 0.6);
  const b1 = cube('', C_HOT, [1, 0.25, 0.5], -5.0, 0.15, 1.6), b2 = cube('', C_OK, [1, 0.25, 0.5], -5.0, 0.15, -1.4);
  b1.scale.x = 0.01; b2.scale.x = 0.01;
  const c1 = tag('0 步', 'pkt', -5.6, 1.3, 1.6), c2 = tag('0 步', 'pkt', -5.6, 1.3, -1.4);
  const L = 10.5;   // bar length for 1000 steps; 10 steps is 1/100 of it
  await anim(tok, 2400, (u) => {
    const s1 = Math.round(1000 * u), s2 = Math.min(10, Math.round(1000 * u));
    b1.scale.x = Math.max(0.01, L * s1 / 1000); b1.position.x = -5.0 + b1.scale.x / 2;
    b2.scale.x = Math.max(0.01, L * s2 / 1000); b2.position.x = -5.0 + b2.scale.x / 2;
    P.txt(c1, s1 + ' 步'); P.txt(c2, s2 + ' 步');
    r1.g.position.x = -5.6 + b1.scale.x;
  });
  r2.mood('happy'); r1.mood('sad');
  await r2.hop(tok);
  say('找最小值：1000 步對 10 步', '排好 → 演算法變快');
  await step(tok);                                   // 6 食譜和廚房
  tag('演算法＝食譜', 'note', -3.2, 2.6, 0);
  tag('資料結構＝廚房裡材料怎麼擺', 'note', 2.6, 2.6, 0);
  tag('selection sort 每輪都要找最小 → 整個變快', 'good', 0, 1.9, 0);
  say('兩者相輔相成', '演算法 ＋ 資料結構');
  await step(tok);                                   // 7 新畫面：衣櫃的 get / insert
  fresh([0, 6.5, 12], [0, 1, 0]);
  const cl = zone('衣櫃（規則：同顏色放一疊）', 0, 0, 0, 7.0, 3.0, '#efe3cf');
  const cols = ['#e07a6a', '#6aa0e0', '#7cc48a'];
  const piles = cols.map((c, p) => { const a = []; for (let s = 0; s < 3; s++) a.push(cube('', c, [1.0, 0.22, 0.75], -2.2 + p * 2.2, 0.15 + s * 0.24, 0)); return a; });
  const shirt = cube('', cols[1], [1.0, 0.22, 0.75], 5.4, 2.4, 2.4);
  const look = tag('insert：先看顏色 → 藍色', 'say', 5.0, 3.2, 2.4);
  await wait(tok, 500);
  await travel(tok, shirt, V3(5.4, 2.4, 2.4), V3(0, 0.15 + 3 * 0.24, 0), 1000);
  piles[1].push(shirt);
  P.txt(look, 'insert：放進藍色那疊 ✓');
  const top = piles[0][2];
  const gL = tag('get：拿出來看一下', 'say', -2.2, 2.4, 0);
  await anim(tok, 500, (u) => { top.position.y = 0.63 + u * 1.0; });
  await anim(tok, 500, (u) => { top.position.y = 1.63 - u * 1.0; });
  say('至少兩種操作：get、insert', '兩者本身就是演算法');
  await step(tok);                                   // 8 維護規則
  remove(look); remove(gL);
  piles.flat().forEach((c) => kill(c));
  P.txt(cl.userData.name, '衣櫃（新規則：每疊差不多高）');
  const h1 = [], h2 = [];
  for (let s = 0; s < 5; s++) h1.push(cube('', '#d9b48a', [1.0, 0.22, 0.75], -1.4, 0.15 + s * 0.24, 0));
  for (let s = 0; s < 4; s++) h2.push(cube('', '#d9b48a', [1.0, 0.22, 0.75], 1.4, 0.15 + s * 0.24, 0));
  const out = h2.pop();
  await anim(tok, 600, (u) => { out.position.set(1.4 + u * 4.0, 0.87 + u * 1.5, u * 2.0); });
  kill(out);
  const bad = tag('5 件 vs 3 件：差太多 ✗', 'bad', 0, 2.4, 0);
  await wait(tok, 500);
  const mv = h1.pop();
  await anim(tok, 900, (u) => { mv.position.set(-1.4 + u * 2.8, 1.11 + Math.sin(Math.PI * u) * 1.0 - u * 0.48, 0); });
  h2.push(mv);
  P.txt(bad, '維護：搬一件過去，4 件 vs 4 件 ✓'); bad.element.className = 'lab-label good';
  tag('維護的力氣，常是隱藏的大成本', 'note', 0, 3.1, -1.6);
  say('第三種工作：維護規則', 'get ＋ insert ＋ 維護');
}]);

// ═══ 第 4 課：正確性與 loop invariant ═══
FRAG.push(['c1-correctness-loop-invariant', '怎麼證明演算法是對的：loop invariant', async (tok) => {
  fresh([0, 6.8, 12.5], [0, 1.2, -0.5]);
  await step(tok);                                   // 1 要怎麼說服別人
  zone('陣列 A', 0, 0, 1.2, 6.6, 2.0, C_IN);
  const vals = [5, 3, 8, 1, 7];
  const A = row(vals, -2.5, 1.25, 1.2, 0.65);
  const m = buddy('m', '?', C_M, -5.3, 0, 1.6, 0.8);
  const q = tag('m 真的是最小值的位置嗎？怎麼說服別人？', 'say', 0, 2.4, 1.2);
  m.mood('wow');
  say('輸出要正確，怎麼證明？', '試例子永遠試不完');
  await step(tok);                                   // 2 寫成數學命題
  remove(q);
  tag('目標：對每個 j，A[m] ≤ A[j]', 'note', 0, 4.9, -2.4);
  say('先把「正確」寫成數學句子', 'A[m] ≤ A[j]，對所有 j');
  await step(tok);                                   // 3 每一輪的小命題
  tag('每輪結束：m 是 A[0..i] 裡最小的位置', 'say', 0, 4.2, -2.4);
  const gb = P.ghostBox('#f4c542', 1, 1.2, 1.4);
  const setRange = (k) => { gb.scale.x = (k + 1) * 1.25; gb.position.set(-2.5 - 0.625 + gb.scale.x / 2, 0.6, 1.2); };
  setRange(0);
  m.set(0); m.mood('calm'); A[0].glow('#5a3a00');
  const rl = tag('已檢查的範圍', 'idx', -2.5, 1.5, 2.0);
  say('拆成「每一輪」的小命題', '第 i 輪後：m = A[0..i] 的最小');
  await step(tok);                                   // 4 數學歸納法 = 骨牌
  const dom = [];
  for (let j = 0; j < 6; j++) dom.push(cube('', j === 0 ? C_HOT : '#efe3cf', [0.22, 1.1, 0.7], -3.2 + j * 1.0, 0.55, -3.6));
  const dB = tag('基底：第一張會倒', 'note', -3.2, 1.7, -3.6);
  const dS = tag('歸納：前一張倒 → 推倒下一張', 'note', 1.6, 1.7, -3.6);
  await anim(tok, 2000, (u) => { dom.forEach((d, j) => { const t = Math.max(0, Math.min(1, u * 7 - j)); d.rotation.z = -t * 1.15; }); });
  say('工具：數學歸納法', '基底 ＋ 歸納步驟 → 全部成立');
  await step(tok);                                   // 5 基底 i = 1
  remove(dB); remove(dS);
  const ip = tag('i', 'ptr', -1.25, 1.5, 1.2);
  remove(rl);
  await anim(tok, 400, () => {});
  A[0].glow(); A[1].glow('#5a3a00'); m.set(1); m.mood('wow'); await m.hop(tok);
  setRange(1);
  const ok1 = tag('第 1 輪後成立 ✓（3 < 5）', 'good', -5.3, 2.2, 1.6);
  say('基底：第 1 輪成立', 'A[0..1] = {5, 3}，最小在 1 號');
  await step(tok);                                   // 6 歸納 k → k+1
  remove(ok1);
  await travel(tok, ip, V3(-1.25, 1.5, 1.2), V3(0, 1.5, 1.2), 350);
  setRange(2); await wait(tok, 350);
  await travel(tok, ip, V3(0, 1.5, 1.2), V3(1.25, 1.5, 1.2), 350);
  A[1].glow(); A[3].glow('#5a3a00'); m.set(3); m.mood('wow'); await m.hop(tok);
  setRange(3);
  const ok2 = tag('第 k 輪對 → 第 k+1 輪也對 ✓', 'good', 0, 2.4, 1.2);
  say('歸納：只多看一個，留小的', '第 3 輪：1 < 3 → m = 3');
  await step(tok);                                   // 7 終止
  remove(ok2);
  await travel(tok, ip, V3(1.25, 1.5, 1.2), V3(2.5, 1.5, 1.2), 350);
  await anim(tok, 400, (u) => setRange(3 + u));
  m.mood('happy'); A[3].mood('happy'); await m.hop(tok);
  const ok3 = tag('範圍＝整個陣列 → 答案正確 ✓', 'good', 0, 2.4, 1.2);
  say('迴圈結束：範圍就是全部', 'm = 3 正確');
  await step(tok);                                   // 8 名字：loop invariant
  remove(ok3);
  tag('loop invariant（迴圈不變量）', 'say', 0, 5.6, -2.4);
  tag('初始：開始前成立', 'note', -4.4, 0.1, 3.4);
  tag('維持：每輪後還成立', 'note', 0, 0.1, 3.4);
  tag('終止：結束時推出答案', 'note', 4.4, 0.1, 3.4);
  say('每輪結束都成立的性質', '初始 → 維持 → 終止');
  await step(tok);                                   // 9 陷阱
  tag('✗「m 是整個陣列最小」：跑到一半還不成立', 'bad', 0, 2.4, 1.2);
  dom.forEach((d) => { d.rotation.z = 0; });
  tag('✗ 只證歸納、沒證基底：第一張沒倒', 'bad', 0, 1.7, -3.6);
  m.mood('calm');
  say('常見陷阱', 'invariant ≠ 迴圈條件 i < len');
}]);

// ═══ 第 5 課：為什麼要分析效率 ═══
FRAG.push(['c1-why-efficiency', '為什麼要分析效率：n 變大差距爆炸', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  await step(tok);                                   // 1 同一題，兩個正確解法
  const qT = tag('題目：n 是不是質數？', 'say', 0, 4.4, -1.0);
  const ram = buddy('Ram', '', C_HOT, -3.6, 0, 0.6, 0.9), shy = buddy('Shyam', '', C_VAL, 3.6, 0, 0.6, 0.9);
  const ok1 = tag('答案正確 ✓', 'good', -3.6, 2.0, 0.6), ok2 = tag('答案正確 ✓', 'good', 3.6, 2.0, 0.6);
  ram.mood('happy'); shy.mood('happy');
  await Promise.all([ram.hop(tok), shy.hop(tok)]);
  say('都正確，那誰比較好？', '資料變 2 倍、10 倍，時間呢？');
  await step(tok);                                   // 2 質數是什麼
  remove(ok1); remove(ok2);
  const nums = [];
  for (let k = 1; k <= 9; k++) {
    const pr = [2, 3, 5, 7].includes(k);
    const b = buddy('', k, pr ? C_OK : C_GRAY, -4 + (k - 1) * 1.0, 0, -2.4, 0.45);
    b.mood(pr ? 'happy' : 'sad'); nums.push(b);
  }
  const pN = tag('質數：剛好 2 個因數（1 和自己）', 'note', 0, 1.3, -2.4);
  await Promise.all([1, 2, 4, 6].map((i) => nums[i].hop(tok)));
  say('質數：只被 1 和自己整除', '2、3、5、7、11…；1 不是');
  await step(tok);                                   // 3 兩種方法
  nums.forEach((b) => kill(b.g)); remove(pN);
  const m1 = tag('試 2、3、…、n−1', 'note', -3.6, 2.1, 0.6);
  const m2 = tag('只試 2、…、√n', 'note', 3.6, 2.1, 0.6);
  const why = tag('36 = 4 × 9：小的那個一定 ≤ √36 = 6', 'say', 0, 3.4, -1.0);
  shy.mood('wow');
  say('一個試到 n−1，一個到 √n', '兩種都正確');
  await step(tok);                                   // 4 每次除法 1 ms、最壞情況
  remove(why);
  prop('cpu', 0, 0, 0.6, 0.9, '電腦：除一次 1 ms');
  const wc = tag('最壞情況：n 是質數（一個都除不盡）', 'bad', 0, 0.2, 3.0);
  const BH = 4;
  const bar = (x, c) => { const b = cube('', c, [0.7, 1, 0.7], x, 0.5, 0.6); b.scale.y = 0.01; b.position.y = 0.005; return b; };
  const bR = bar(-1.9, C_HOT), bS = bar(5.4, C_VAL);
  const tR = tag('n − 2 次', 'pkt', -1.9, 0.6, 1.2), tS = tag('約 √n − 1 次', 'pkt', 5.4, 0.6, 1.2);
  say('一次除法 1 ms，看最壞情況', 'Ram：n − 2 次｜Shyam：√n − 1 次');
  await step(tok);                                   // 5 n = 11、101
  remove(wc);
  const nT = tag('n = 11', 'say', 0, 3.6, -1.0);
  tag('柱子高度＝兩人時間的比例', 'idx', 1.75, 4.6, -1.0);
  const grow = async (ratio, a, b) => {
    const r0 = bR.scale.y, s0 = bS.scale.y;
    P.txt(tR, a); P.txt(tS, b);
    await anim(tok, 800, (u) => {
      bR.scale.y = r0 + (BH - r0) * u; bR.position.y = bR.scale.y / 2;
      const sh = Math.max(0.03, BH * ratio); bS.scale.y = s0 + (sh - s0) * u; bS.position.y = bS.scale.y / 2;
      tR.position.y = bR.scale.y + 0.4; tS.position.y = bS.scale.y + 0.4;
    });
  };
  await grow(2 / 9, '9 ms', '2 ms');
  await wait(tok, 500);
  P.txt(nT, 'n = 101');
  await grow(9 / 99, '99 ms', '9 ms');
  say('n 小時：差不到一秒', '11：9 vs 2 ms｜101：99 vs 9 ms');
  await step(tok);                                   // 6 n = 10^6 + 3
  P.txt(nT, 'n = 10⁶ + 3（七位數）');
  await grow(1 / 1000, '約 16.66 分鐘', '約 1 秒');
  ram.mood('sad');
  say('一百萬：16 分鐘 vs 1 秒', '10⁶ ms vs 10³ ms');
  await step(tok);                                   // 7 n = 10^10 + 19
  P.txt(nT, 'n = 10¹⁰ + 19（11 位數）');
  await grow(1 / 100000, '超過 115 天', '約 1.66 分鐘');
  shy.mood('happy'); await shy.hop(tok);
  say('一百億：115 天 vs 1.66 分', '10¹⁰ ms vs 10⁵ ms');
  await step(tok);                                   // 8 時間複雜度
  remove(m1); remove(m2);
  P.txt(nT, '時間複雜度：n 變大時，時間長多快');
  tag('時間 ∝ n → O(n)', 'good', -3.6, 2.1, 0.6);
  tag('時間 ∝ √n → O(√n)', 'good', 3.6, 2.1, 0.6);
  say('Ram：O(n)；Shyam：O(√n)', 'Big-O：成長速度');
  await step(tok);                                   // 9 新畫面：淘汰賽找最小值
  fresh([0, 7.5, 12], [0, 0.5, -0.3]);
  zone('8 個數找最小值：淘汰賽', 0, 0, 0, 13.2, 7.4, '#efe3cf');
  const tv = [6, 2, 7, 4, 8, 1, 5, 3];
  let cur = tv.map((v, i) => ({ v, b: buddy('', v, C_VAL, -5.25 + i * 1.5, 0, 2.6, 0.55) }));
  const zs = [0.6, -1.4, -3.2];
  for (let r = 0; r < 3; r++) {
    const next = [], moves = [];
    for (let p = 0; p < cur.length; p += 2) {
      const a = cur[p], b = cur[p + 1];
      const w = a.v < b.v ? a : b, l = a.v < b.v ? b : a;
      l.b.mood('sad');
      const from = w.b.g.position.clone(), to = V3((a.b.g.position.x + b.b.g.position.x) / 2, 0, zs[r]);
      moves.push(travel(tok, w.b.g, from, to, 650));
      next.push(w);
    }
    await Promise.all(moves);
    cur = next;
  }
  cur[0].b.mood('happy'); await cur[0].b.hop(tok);
  say('淘汰賽：兩兩比，小的晉級', '8 → 4 → 2 → 1');
  await step(tok);                                   // 10 次數一樣、平行化、隱藏成本
  tag('第 1 輪：4 場', 'idx', 6.2, 0.3, 1.6);
  tag('第 2 輪：2 場', 'idx', 6.2, 0.3, -0.4);
  tag('第 3 輪：1 場', 'idx', 6.2, 0.3, -2.2);
  tag('逐一掃描：7 次｜淘汰賽：4 + 2 + 1 = 7 次', 'say', 0, 3.3, -3.2);
  tag('4 顆 CPU 同時比 → 只要 3 輪', 'good', -3.6, 2.4, -3.2);
  tag('隱藏成本：要記住每場結果', 'bad', 3.6, 2.4, -3.2);
  say('比較次數一樣：都是 7 次', '效率和平台有關');
}]);
  }

  // ═══ course2.js ═══
  {
// ─── 課程 part 2：時間與空間資源、空間複雜度、算步數、忽略常數、最好／最壞／平均 ───
// Manual-mode lesson scenes: one step(tok) per explain entry. Variables and workers are
// little characters (buddy); devices and places are props; growth is shown with bars.
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const say = (a, b = '') => ctx.say(a, b);
const C_PROG = '#7cb8ee', C_VAR = '#9ad1a8', C_PTR = '#e8cf8a', C_CELL = '#f5b97a', C_CNT = '#f4a56a', C_CONST = '#c9b6e4';
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pause = (tok, ms) => anim(tok, ms, () => {});
const recls = (l, cls) => { l.element.className = 'lab-label ' + cls; };
// fade a group out of focus (on) or back (off)
function fade(g, on) {
  g.traverse((o) => {
    if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = on ? 0.25 : 1; }
    if (o.element) o.element.style.opacity = on ? '0.35' : '';
  });
}
// a growth bar standing on the floor (or on `base`), animated with grow()
function bar(x, z, color, w = 0.8) {
  const m = cube('', color, [w, 1, w], x, 0.005, z);
  m.scale.y = 0.01; m.userData.h = 0.01; m.userData.base = 0; return m;
}
function setBar(m, h) { h = Math.max(0.01, h); m.scale.y = h; m.userData.h = h; m.position.y = m.userData.base + h / 2; }
async function grow(tok, bars, hs, ms = 900) {
  const h0 = bars.map((b) => b.userData.h);
  await anim(tok, ms, (u) => bars.forEach((b, i) => setBar(b, h0[i] + (hs[i] - h0[i]) * u)));
}

// ═══ 第 6 課：時間資源與空間資源 ═══
FRAG.push(['c1-resources-time-space', '程式要用的兩種資源：時間與空間', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.8, 0]);
  await step(tok);
  const data = prop('file', -5.4, 0, 0.6, 1.1, '輸入：一大堆資料'); bob(data, 0.05);
  const prog = buddy('程式', '', C_PROG, 0, 0, 0.6, 1.1);
  prop('parcel', 5.2, 0, 0.6, 0.8, '輸出：答案');
  arrow(V3(-4.6, 0.6, 0.6), V3(-0.9, 0.6, 0.6), 0xa8730f); arrow(V3(0.9, 0.6, 0.6), V3(4.4, 0.6, 0.6), 0xa8730f);
  const c1 = tag('資料', 'pkt', -5.4, 1.5, 0.6);
  await travel(tok, c1, V3(-5.4, 1.5, 0.6), V3(0, 1.7, 0.6), 900); remove(c1);
  prog.mood('happy');
  say('程式：資料進去、答案出來', '跑的時候會消耗「資源」');
  await step(tok);
  const cpu = prop('cpu', -3.0, 0, -2.8, 1.1, '計算資源（CPU）'); bob(cpu, 0.04);
  const tq = note('100 筆：1 秒？10 秒？100 秒？', -3.0, 2.5, -2.8);
  const c2 = tag('計算中…', 'pkt', 0, 1.8, 0.6);
  await travel(tok, c2, V3(0, 1.8, 0.6), V3(-3.0, 0.9, -2.8), 900); remove(c2);
  prog.mood('wow');
  say('計算資源 → 用「時間」來量', '再跑 2 分鐘？還是 2000 分鐘？');
  await step(tok);
  prop('warehouse', 3.0, 0, -2.8, 1.0, '儲存資源（記憶體、硬碟）');
  const sq = note('6.4G 讀進來：佔 6.4G？64G？640G？', 3.0, 2.9, -2.8);
  const c3 = tag('暫存資料', 'pkt', 0, 1.8, 0.6);
  await travel(tok, c3, V3(0, 1.8, 0.6), V3(3.0, 0.9, -2.8), 900); remove(c3);
  say('儲存資源 → 用「空間」來量', '記憶體不夠，程式直接掛掉');
  await step(tok);
  P.txt(tq, '時間複雜度：要跑多久'); recls(tq, 'good');
  P.txt(sq, '空間複雜度：要佔多大'); recls(sq, 'good');
  prog.mood('happy'); await prog.hop(tok);
  say('兩種複雜度', '時間複雜度 ＋ 空間複雜度');
  await step(tok);
  const others = [tag('電力', 'idx', -4.2, 4.2, -1.0), tag('網路頻寬', 'idx', 0, 4.4, -1.0), tag('人力：要幾個人寫', 'idx', 4.2, 4.2, -1.0)];
  prog.look(0);
  say('還有電力、網路、人力…', '本章主角：時間和空間');
  await step(tok);
  others.forEach(remove);
  const neat = buddy('愛整理的人', '', C_VAR, -3.2, 0, 3.6, 0.8), messy = buddy('愛亂丟的人', '', C_CNT, 3.2, 0, 3.6, 0.8);
  const tn = ok('整理很累，但找東西超快', -3.2, 2.1, 3.6), tm = no('放東西很快，但找很久', 3.2, 2.1, 3.6);
  neat.mood('calm'); messy.mood('happy');
  await anim(tok, 600, () => {});
  neat.mood('happy'); messy.mood('sad');
  const to = tag('trade-off：有得就有失', 'say', 0, 1.0, 3.6);
  say('時間和空間常常要取捨', 'trade-off：多花一邊，省另一邊');
  await step(tok);
  [tn, tm, to].forEach(remove); kill(neat.g); kill(messy.g);
  no('實測：拿碼錶量（換台電腦就不同）', -3.0, 1.2, 3.4);
  ok('分析：數步數，跟機器無關 ✓', 3.0, 1.2, 3.4);
  prog.mood('happy'); await prog.hop(tok);
  say('評估效能有兩層', '本章學的是「分析」');
}]);

// ═══ 第 7 課：空間複雜度 ═══
FRAG.push(['c1-space-complexity', '空間複雜度：額外要多少記憶體', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 0.6, 0]);
  await step(tok);
  const shelf = zone('輸入資料：20 格的陣列（已經放好了）', 0, 0, -3.0, 12.6, 1.4, '#f3dcc0');
  const vals = [3, 8, 1, 6, 2, 9, 4, 7, 5, 2, 8, 3, 6, 1, 9, 4, 7, 2, 5, 8];
  const cells = vals.map((v, i) => cube(v, C_CELL, [0.5, 0.5, 0.5], -5.7 + i * 0.6, 0.3, -3.0, 1.5 + i * 0.06));
  const cd = code(['int sum(int *a, int n) {', '  int total = 0;', '  for (int i = 0; i < n; i++)', '    total += a[i];', '  return total;', '}'], -4.0, 4.4, 0.5, -1.0);
  say('任務：把 20 個數全部加起來', '資料本來就在，不算「額外」');
  await step(tok);
  const total = buddy('total', 0, C_VAR, -3.0, 0, 1.6, 0.8), iv = buddy('i', 0, C_VAR, -1.5, 0, 1.6, 0.8);
  cd.hl(3);
  let s = 0;
  for (let k = 0; k < 3; k++) {
    iv.set(k); glow(cells[k], '#5a3a00');
    const pk = tag(String(vals[k]), 'pkt', cells[k].position.x, 0.9, -3.0);
    await travel(tok, pk, V3(cells[k].position.x, 0.9, -3.0), V3(-3.0, 1.0, 1.6), 450); remove(pk);
    s += vals[k]; total.set(s); glow(cells[k], '#000000');
  }
  total.mood('happy');
  say('額外空間 ≈ 自己宣告的變數', 'total 存總和，i 記走到第幾格');
  await step(tok);
  cd.hl(0);
  const ret = buddy('回傳值', '', C_VAR, 0, 0, 1.6, 0.8);
  const ap = buddy('a：陣列起點', '', C_PTR, 1.5, 0, 1.6, 0.8);
  const nb = buddy('n：長度', 20, C_PTR, 3.0, 0, 1.6, 0.8);
  arrow(V3(1.5, 0.5, 1.1), V3(-5.6, 0.4, -2.5), 0xa8730f);
  ap.look(-1);
  say('還有回傳值、陣列起點、長度', '一共 5 個變數');
  await step(tok);
  const bytes = [['4 B', -3.0], ['4 B', -1.5], ['4 B', 0], ['8 B', 1.5], ['4 B', 3.0]].map(([t, x]) => note(t, x, -0.05, 2.5));
  const sum24 = ok('額外空間：24 bytes', 5.2, 1.2, 1.6);
  say('每個變數幾 byte 看系統', '假設加起來：24 bytes');
  await step(tok);
  const nm = shelf.userData.name;
  for (const [t, nv] of [['輸入資料：200 筆', 200], ['輸入資料：2000 筆', 2000], ['輸入資料：2 萬筆', 20000]]) {
    P.txt(nm, t); nb.set(nv); cells.forEach((c) => glow(c, '#3a2a00'));
    await pause(tok, 350); cells.forEach((c) => glow(c, '#000000')); await pause(tok, 250);
  }
  [total, iv, ret, ap, nb].forEach((b) => b.mood('happy'));
  P.txt(sum24, '還是 24 bytes ✓');
  say('20、200、2 萬筆：都只要 24 bytes', '跟資料量無關 → 固定空間');
  await step(tok);
  bytes.forEach(remove);
  [total, iv, ret, ap, nb].forEach((b) => b.glow('#123a22'));
  const fc = tag('c：固定部分（程式碼、簡單變數）', 'say', 0, 2.6, 1.6);
  const fs = tag('S(P) = c + S_P(I)', 'ptr', 4.4, 4.2, -1.0);
  say('課本公式：S(P) = c + S_P(I)', 'c 固定；S_P(I) 跟輸入大小有關');
  await step(tok);
  zone('如果程式要另外複製一份陣列：要 n 格新空間', 0, 0, 4.4, 12.0, 1.2, '#f6e6c8');
  const copies = [];
  for (let k = 0; k < 10; k++) { copies.push(cube('', '#f7c99a', [0.45, 0.45, 0.45], -5.4 + k * 0.7, 0.25, 4.4)); await pause(tok, 120); }
  const sp = no('S_P(n) = n：跟著 n 變大', 3.6, 1.1, 4.4);
  say('多開一個 n 格陣列的話', 'S_P(n) = n → 會隨 n 成長');
  await step(tok);
  copies.forEach(kill); remove(sp);
  ok('輸入本身不算「額外」', -3.2, 1.0, -3.0);
  P.txt(fc, 'sum：S_P(n) = 0，只有固定的 24 bytes');
  fs.element.textContent = 'S(sum) = c + 0';
  say('考點：問「額外空間」時', 'sum 的 S_P(n) = 0 → 固定大小');
}]);

// ═══ 第 8 課：算程式步數 ═══
FRAG.push(['c1-program-steps', '算程式步數：count 法與表格法', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.2, 0]);
  await step(tok);
  const file = prop('file', -5.0, 0, 1.0, 1.1, '你的程式'); bob(file, 0.05);
  arrow(V3(-4.4, 0.8, 1.0), V3(-1.4, 0.8, -0.6), 0xa8730f); arrow(V3(-4.4, 0.8, 1.0), V3(1.6, 0.8, 2.2), 0xa8730f);
  const t1 = note('編譯：只做一次，跟 n 無關', -0.6, 1.6, -0.6);
  const t2 = ok('執行時間 t_P：要分析的', 2.6, 1.6, 2.2);
  say('T(P) = 編譯時間 + 執行時間', '只分析執行時間');
  await step(tok);
  const cpu = prop('cpu', 4.6, 0, -1.6, 1, 'CPU');
  const t3 = no('數 add、load、store ✗ 太細', 4.6, 2.6, -1.6);
  await pause(tok, 700);
  const t4 = ok('數 program step ✓', 2.6, 2.6, 2.2);
  say('不數機器指令，改數 program step', '一個有意義的敘述片段 = 1 步');
  await step(tok);
  [t1, t2, t3, t4].forEach(remove); kill(file); kill(cpu);
  P.fresh([0, 7, 12.5], [0, 1.2, 0]);
  const cd = code(['float sum(float list[], int n) {', '  float tempsum = 0;', '  int i;', '  for (i = 0; i < n; i++)', '    tempsum += list[i];', '  return tempsum;', '}'], -3.8, 4.0, 0.6, 0);
  const cnt = buddy('count', 0, C_CNT, 4.6, 0, 0.6, 1);
  const nt = tag('先用 n = 3 試試', 'idx', 4.6, 2.4, 0.6);
  say('count 法：每做一步，count 就加 1', 'count 是我們放進去的計數器');
  await step(tok);
  let c = 0;
  const tick = async (line) => { cd.hl(line); c++; cnt.set(c); await pause(tok, 170); };
  await tick(1);
  for (let k = 0; k < 3; k++) { await tick(3); await tick(4); }
  await tick(3); await tick(5);
  cd.hl(-1);
  const ys = [3.4, 2.8, 2.2, 1.6, 1.0];
  const fq = [['×1', 1], ['不算', 2], ['×(n+1)', 3], ['×n', 4], ['×1', 5]].map(([t, ln]) => tag(t, ln === 2 ? 'bad' : 'idx', 0.9, 4.0 - ln * 0.6, 0));
  cnt.mood('wow');
  say('n = 3 一步一步數', 'int i; 只宣告、沒有給值 → 不算');
  await step(tok);
  const tot = ok('1 + (n+1) + n + 1 = 2n + 3', 0.6, 5.0, 0);
  cnt.mood('happy'); await cnt.hop(tok);
  say('加起來：2n + 3', 'n = 3 → 2·3 + 3 = 9，和 count 一樣');
  await step(tok);
  fq.forEach(remove); remove(nt); kill(cnt.g); remove(tot);
  const tb = code(['敘述                s/e  次數  小計', 'float tempsum = 0;   1    1     1', 'int i;               0    -     0', 'for (i=0; i<n; i++)  1   n+1   n+1', 'tempsum += list[i];  1    n     n', 'return tempsum;      1    1     1', '            總計            2n+3'], 3.0, 4.0, 0.6, 0);
  say('表格法：s/e × 次數 = 小計', 's/e：這行執行一次算幾步');
  await step(tok);
  tb.hl(3); cd.hl(3);
  no('for 標頭跑 n+1 次：最後一次 i<n 不成立也要檢查', 0, 0.3, 1.6);
  say('陷阱：for 那一行是 n+1 次', '不是 n 次！');
  await step(tok);
  P.fresh([0, 7, 12.5], [0, 1.0, 0]);
  const mc = code(['for (i = 0; i < rows; i++)', '  for (j = 0; j < cols; j++)', '    c[i][j] = a[i][j] + b[i][j];'], -3.8, 4.2, 0.7, 0);
  const mf = [tag('rows + 1', 'idx', -3.8, 2.0, 1.2), tag('rows·(cols + 1)', 'idx', -3.8, 1.3, 1.2), tag('rows·cols', 'idx', -3.8, 0.6, 1.2)];
  zone('矩陣 c：3 列 × 4 行', 3.6, 0, 0, 4.6, 3.6, '#e9dcc4');
  const grid = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) grid.push(cube('', '#e8e0d0', [0.7, 0.4, 0.7], 2.1 + j * 1.0, 0.2, -1.1 + i * 1.1));
  for (let k = 0; k < grid.length; k++) { mc.hl(2); P.tint(grid[k], '#9ad1a8'); await pause(tok, 110); }
  const mt = ok('2·rows·cols + 2·rows + 1 = 31（3×4）', 0.4, 5.2, 0);
  say('矩陣加法：兩層迴圈', 'rows = 3、cols = 4 → 24 + 6 + 1 = 31 步');
  await step(tok);
  mc.hl(-1);
  P.txt(mc.ls[0], 'for (j = 0; j < cols; j++)  '); P.txt(mc.ls[1], '  for (i = 0; i < rows; i++)');
  P.txt(mf[0], 'cols + 1'); P.txt(mf[1], 'cols·(rows + 1)');
  P.txt(mt, 'rows 遠大於 cols：2·rows·cols + 2·cols + 1 比較少');
  say('rows 比 cols 大很多時', '把內外迴圈對調，可以少幾步');
  await step(tok);
  P.txt(mc.ls[0], 'for (i = 0; i < rows; i++)  '); P.txt(mc.ls[1], '  for (j = 0; j < cols; j++)');
  P.txt(mf[0], '外圈：每列多花 s，只做一次的 t'); P.txt(mf[1], '內圈：每格 p，零碎 q → 一列 r = p·cols + q'); remove(mf[2]);
  P.txt(mt, 'rows·(p·cols + q) + s·rows + t');
  say('林軒田的寫法：用秒數常數', 'rows·(p·cols + q) + s·rows + t');
}]);

// ═══ 第 9 課：忽略常數與低次項 ═══
FRAG.push(['c1-drop-constants', '忽略常數與低次項', async (tok) => {
  fresh([0, 7, 12.5], [0.5, 1.4, 0]);
  await step(tok);
  prop('cpu', -4.2, 0, -0.4, 1.2, '這台電腦');
  const names = ['p', 'q', 's', 't'], v0 = [10, 4, 3, 2];
  const ks = names.map((n, i) => buddy(n, v0[i], C_CONST, -5.7 + i * 1.0, 0, 1.8, 0.6));
  const ft = tag('rows·(p·cols + q) + s·rows + t', 'ptr', -3.0, 3.6, -0.4);
  say('p、q、s、t 是常數', '由電腦平台決定，不隨資料量變');
  await step(tok);
  const fast = tag('換一台快兩倍的電腦', 'say', -4.2, 2.6, -0.4);
  ks.forEach((b, i) => b.set(v0[i] / 2));
  await Promise.all(ks.map((b) => b.hop(tok)));
  ks.forEach((b) => b.mood('wow'));
  say('電腦快兩倍：常數全部砍半', '每格 10 秒 → 5 秒');
  await step(tok);
  remove(fast);
  ks.forEach((b) => { b.mood('calm'); fade(b.g, true); });
  P.txt(ft, 'rows · cols ← 演算法的本體');
  ok('分析時：先不管 p、q、s、t', -4.0, 2.6, 1.8);
  say('分析時不管這些常數', '不是不重要，是跟演算法設計無關');
  await step(tok);
  const grid = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { grid.push(cube('', '#9ad1a8', [0.6, 0.6, 0.6], 1.6 + j * 0.9, 0.3, -1.0 + i * 0.9)); await pause(tok, 70); }
  const gt = ok('成本 ≈ rows × cols = 元素個數', 3.0, 2.0, -1.0);
  say('「差不多」的語言', '1000 個元素 ≈ 1000 份力氣；100 萬 ≈ 100 萬');
  await step(tok);
  grid.forEach(kill); remove(gt);
  const b1 = bar(2.0, 0, '#7cb8ee'), b2 = bar(3.6, 0, '#f4a56a');
  const l1 = tag('2n+3 = 2003', 'idx', 2.0, -0.1, 1.0), l2 = tag('2n+5 = 2005', 'idx', 3.6, -0.1, 1.0);
  await grow(tok, [b1, b2], [5 * 2003 / 2005, 5]);
  const bt = note('n = 1000：幾乎一樣高', 2.8, 5.8, 0);
  say('n = 1000：2003 vs 2005', '常數 3 或 5：沒差');
  await step(tok);
  kill(b1); kill(b2); remove(l1); remove(l2);
  const lo = bar(2.8, 0, '#7cb8ee', 1.0), hi = bar(2.8, 0, '#f4a56a', 1.0);
  const ln = tag('n²', 'idx', 4.4, 0.4, 0), lh = tag('100n', 'idx', 4.4, 2.0, 0);
  const stack = async (a, b) => {
    const a0 = lo.userData.h, b0 = hi.userData.h;
    await anim(tok, 1000, (u) => { setBar(lo, a0 + (a - a0) * u); hi.userData.base = lo.userData.h; setBar(hi, b0 + (b - b0) * u); });
  };
  P.txt(bt, 'n = 10：n² = 100，100n = 1000');
  await stack(5 * 100 / 1100, 5 * 1000 / 1100);
  await pause(tok, 500);
  P.txt(bt, 'n = 10000：n² = 1 億，100n = 100 萬');
  await stack(5 * 1e8 / 1.01e8, 5 * 1e6 / 1.01e8);
  lh.position.y = 5.3; ln.position.y = 2.5;
  say('低次項也丟掉：n² + 100n', 'n 很大時 ≈ n²');
  await step(tok);
  kill(lo); kill(hi); remove(ln); remove(lh);
  const sq = bar(2.0, 0, '#e07a7a'), ln10 = bar(3.6, 0, '#7cb8ee');
  const ls = tag('n² = 100 萬', 'idx', 2.0, -0.1, 1.0), lt = tag('10n = 1 萬', 'idx', 3.6, -0.1, 1.0);
  await grow(tok, [sq, ln10], [5, 0.05]);
  P.txt(bt, 'n = 1000：差 100 倍');
  say('n² 和 10n：真的不一樣', '這種「等級」的差別才是重點');
  await step(tok);
  P.txt(ls, 'n² = 25'); P.txt(lt, '10n = 50');
  await grow(tok, [sq, ln10], [2.5, 5]);
  P.txt(bt, 'n = 5：10n 反而比較多！'); recls(bt, 'bad');
  say('丟常數只在 n 很大時成立', 'n = 5：n² = 25 < 10n = 50');
}]);

// ═══ 第 10 課：最好、最壞、平均情況（影片沒教，這裡完整教） ═══
FRAG.push(['c1-best-worst-average', '最好、最壞、平均情況', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 1.0, 0]);
  await step(tok);
  const vals = [7, 3, 9, 4, 8, 1, 6, 5];
  const xs = vals.map((_, i) => -4.2 + i * 1.2);
  zone('陣列：8 格（n = 8）', 0, 0, 0, 10.4, 1.6, '#f3dcc0');
  const cells = vals.map((v, i) => cube(v, C_CELL, [0.9, 0.9, 0.9], xs[i], 0.45, 0, 1.5 + i * 0.1));
  vals.forEach((_, i) => tag('[' + i + ']', 'idx', xs[i], -0.1, 0.9));
  const sr = buddy('搜尋小幫手', 7, C_PROG, -6.0, 0, 2.0, 0.75);
  say('線性搜尋：從頭一格一格找', '小幫手手上拿的是要找的 key');
  await step(tok);
  const cnt = buddy('比較次數', 0, C_CNT, 6.0, 0, -1.8, 0.75);
  const rule = note('跟一格比一次 = 1 步', 6.0, 2.0, -1.8);
  say('步數 = 比較了幾次', '換不同的 key，次數會不一樣');
  await step(tok);
  remove(rule);
  const search = async (key) => {
    sr.set(key); sr.mood('calm'); cells.forEach((c) => glow(c, '#000000'));
    let n = 0; cnt.set(0);
    for (let k = 0; k < vals.length; k++) {
      const from = sr.g.position.clone();
      await travel(tok, sr.g, from, V3(xs[k], 0, 2.0), 160);
      n++; cnt.set(n);
      if (vals[k] === key) { glow(cells[k], '#145a2a'); sr.mood('happy'); await sr.hop(tok); return n; }
      glow(cells[k], '#3a1a1a'); await pause(tok, 90);
    }
    sr.mood('sad'); return n;
  };
  await search(7);
  const tb = ok('最好情況：1 次', -4.2, 2.6, 0);
  say('找 7：第一格就找到', '最好情況：比 1 次');
  await step(tok);
  await travel(tok, sr.g, sr.g.position.clone(), V3(-6.0, 0, 2.0), 300);
  await search(5);
  const t5 = note('找 5：比 8 次（在最後一格）', 4.2, 2.6, 0);
  say('找 5：最後一格才找到', '比了 8 次 = n 次');
  await step(tok);
  await travel(tok, sr.g, sr.g.position.clone(), V3(-6.0, 0, 2.0), 300);
  await search(2);
  remove(t5);
  const tw = no('最壞情況：n = 8 次', 4.2, 2.6, 0);
  say('找 2：根本不在裡面', '每格都比過 → 最壞情況 n 次');
  await step(tok);
  cells.forEach((c) => glow(c, '#000000'));
  const per = xs.map((x, i) => tag((i + 1) + ' 次', 'pkt', x, 1.5, 0));
  const ta = note('平均：(1+2+…+8) ÷ 8 = 36 ÷ 8 = 4.5 次', 0, 3.4, 0);
  sr.mood('calm');
  say('平均情況：每格機率一樣', '(1 + 2 + … + n) ÷ n = (n + 1) / 2');
  await step(tok);
  per.forEach(remove);
  const trap = no('✗ 最好情況 ≠ 陣列很小（n = 1）', 0, 4.4, 0);
  say('陷阱：n 固定，比的是「哪種輸入」', '最好情況不是把 n 變小');
  await step(tok);
  remove(trap); remove(ta); remove(tb); remove(tw);
  const bb = bar(-2.4, -3.4, '#9ad1a8'), ba = bar(0, -3.4, '#e8cf8a'), bw = bar(2.4, -3.4, '#e07a7a');
  const lb = tag('最好 1', 'idx', -2.4, -0.1, -2.6), la = tag('平均 4.5', 'idx', 0, -0.1, -2.6), lw = tag('最壞 8', 'idx', 2.4, -0.1, -2.6);
  await grow(tok, [bb, ba, bw], [0.3, 1.35, 2.4], 700);
  const nn = note('n = 8', 4.6, 1.0, -3.4);
  await pause(tok, 400);
  P.txt(nn, 'n = 16'); P.txt(la, '平均 8.5'); P.txt(lw, '最壞 16');
  await grow(tok, [bb, ba, bw], [0.3, 2.55, 4.8], 800);
  say('n 變兩倍', '最好不變；平均、最壞跟著 n 變大');
  await step(tok);
  const g = ok('保證：再倒楣也不會超過 n 次', 2.4, 5.6, -3.4);
  sr.mood('happy');
  say('最壞情況 = 保證的上限', '像「30 分鐘內一定送到」');
  await step(tok);
  remove(g);
  const avgN = note('平均：要假設每格機率一樣', 0, 3.4, -3.4);
  const bestN = note('最好：太樂觀，參考價值低', -3.2, 1.6, -3.4);
  say('平均要假設機率；最好太樂觀', '所以最常用的是最壞情況');
  await step(tok);
  remove(avgN); remove(bestN);
  const pr = tag('影片例子：判斷 n 是不是質數，最壞 = n 是質數，要除 n − 2 次', 'say', 0, 3.6, -1.8);
  say('Abdul Bari 的例子', '最壞情況：n 是質數 → 除 n − 2 次');
  await step(tok);
  remove(pr);
  ok('題目只說「時間複雜度」→ 通常指最壞情況', 0, 3.8, -1.8);
  sr.mood('happy'); await sr.hop(tok);
  say('考試讀題', '沒特別說 → 預設看最壞情況');
}]);
  }

  // ═══ course3.js ═══
  {
// ─── 資料結構 第 1 章 course part 3：Big-O、Ω/Θ、數學工具、成長率排序、遞迴基礎 ───
// manual-mode lesson scenes: one step(tok) per explain entry.
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const say = (a, b = '') => ctx.say(a, b);
const THREE = ctx.THREE, LAB = ctx.lab;
const C_F = '#f08a4b', C_G = '#4b9ee2', C_CG = '#2fa36b', C_LO = '#b07cd8', C_BAD = '#d9534f', C_AX = '#6e5f49';
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const chip = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const txt = (l, t) => { l.element.textContent = t; };
const pause = (tok, ms) => anim(tok, ms, () => {});
// a fade for meshes (curves, bars): on = dim
function dimMesh(m, on = true) { if (!m.material) return; m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = on ? 0.22 : 1; }

// ── a 2D graph on the stage: n to the right, 步數 upward; curves are drawn as tubes that grow ──
function graph(nMax, vMax, nTicks, vTicks) {
  const X0 = -5, W = 9.6, Y0 = 0.3, H = 6.0;
  const X = (n) => X0 + (n / nMax) * W, Y = (v) => Y0 + (v / vMax) * H;
  const parts = []; const keep = (o) => { parts.push(o); return o; };
  keep(cube(null, C_AX, [W + 0.4, 0.06, 0.06], X0 + W / 2, Y0, 0));
  keep(cube(null, C_AX, [0.06, H + 0.4, 0.06], X0, Y0 + H / 2, 0));
  keep(tag('n（資料筆數）→', 'idx', X0 + W - 0.6, Y0 - 0.85, 0));
  keep(tag('步數 ↑', 'idx', X0 + 0.2, Y0 + H + 0.45, 0));
  const ticks = [];
  // relabel the axes for a range 0..nR / 0..vR drawn in the same frame
  const setTicks = (nt, vt, nR = nMax, vR = vMax) => {
    ticks.splice(0).forEach(remove);
    nt.forEach((n) => ticks.push(tag(String(n), 'idx', X((n * nMax) / nR), Y0 - 0.38, 0)));
    vt.forEach((v) => ticks.push(tag(String(v), 'idx', X0 - 0.6, Y((v * vMax) / vR), 0)));
  };
  setTicks(nTicks, vTicks);
  const curves = [];
  async function curve(tok, fn, color, label, ms = 900, lx = 0.15, ly = 0.35) {
    const pts = [];
    for (let i = 0; i <= 80; i++) { const n = (nMax * i) / 80; const y = Y(fn(n)); if (y > Y0 + H + 0.15) break; pts.push(V3(X(n), y, 0.05)); }
    if (pts.length < 2) pts.push(pts[0].clone().add(V3(0.01, 0.01, 0)));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.06, 6, false);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    geo.setDrawRange(0, 0); LAB.world.add(m);
    const total = geo.index ? geo.index.count : geo.attributes.position.count;
    const end = pts[pts.length - 1];
    const l = label ? tag(label, 'say', Math.min(end.x + lx, 5.6), end.y + ly, 0.1) : null;
    if (l) l.element.style.visibility = 'hidden';
    await anim(tok, ms, (u) => geo.setDrawRange(0, Math.floor((u * total) / 6) * 6));
    if (l) l.element.style.visibility = '';
    const c = { m, l, dim(on = true) { dimMesh(m, on); if (l) l.element.style.opacity = on ? '0.35' : ''; } };
    curves.push(c); return c;
  }
  // a vertical marker at n0 and the shaded zone after it
  function mark(n0, text, color = '#2fa36b') {
    const ln = cube(null, color, [0.05, H, 0.05], X(n0), Y0 + H / 2, 0.08);
    const lb = tag(text, 'ptr', X(n0), Y0 + H + 0.1, 0.1);
    const sh = P.ghostBox(color, X(nMax) - X(n0), H, 0.05); sh.position.set((X(n0) + X(nMax)) / 2, Y0 + H / 2, -0.05);
    const o = { ln, lb, sh, kill() { kill(ln); remove(lb); remove(sh); } };
    parts.push(ln, lb, sh); return o;
  }
  function clearCurves() { curves.splice(0).forEach((c) => { remove(c.m); if (c.l) remove(c.l); }); }
  function clear() { clearCurves(); ticks.splice(0).forEach(remove); parts.splice(0).forEach((o) => { kill(o); remove(o); }); }
  return { X, Y, X0, Y0, W, H, curve, mark, setTicks, clearCurves, clear, curves };
}

// ═════════════ 第 11 課：Big-O ═════════════
FRAG.push(['c1-big-o', 'Big-O：找 c 與 n₀，讓 c·g(n) 蓋住 f(n)', async (tok) => {
  fresh([0.4, 3.6, 13.5], [0.3, 3.0, 0]);
  // 1 程式是一台機器：吃 n 筆資料，跑出 3n+2 步
  await step(tok);
  const cpu = prop('cpu', -2.5, 0, 0, 1.3, '你的程式'); bob(cpu, 0.05);
  const inp = tag('輸入：n 筆資料', 'pkt', -6.2, 0.6, 0);
  await travel(tok, inp, V3(-6.2, 0.6, 0), V3(-3.6, 0.6, 0), 800);
  const f = buddy('f(n)：真正的步數', '3n+2', C_F, 1.8, 0, 0, 1.0);
  const out = tag('跑了 3n+2 步', 'pkt', -1.4, 0.6, 0);
  await travel(tok, out, V3(-1.4, 0.6, 0), V3(0.9, 1.6, 0), 700);
  remove(out); f.mood('wow');
  const up = chip('想說：它「最多是 n 等級」', 1.8, 2.6, 0);
  say('步數想用一個等級來說', 'f(n) = 3n + 2');
  // 2 定義
  await step(tok);
  remove(up);
  const def = chip('f(n) = O(g(n))  ⇔  存在正常數 c、n₀，使所有 n ≥ n₀ 都有 f(n) ≤ c·g(n)', 0, 7.3, 0);
  const g1 = note('g(n)：拿來比的簡單函數（n、n²…）', -3.2, 4.6, 0);
  const g2 = note('c：可以自己挑的倍數', 0.6, 4.0, 0);
  const g3 = note('n₀：從第幾筆開始算數', 3.6, 4.6, 0);
  f.mood('calm');
  say('Big-O 的正式定義', 'f(n) ≤ c·g(n)，對所有 n ≥ n₀');
  // 3 畫成圖：f 和 g
  await step(tok);
  [cpu, inp].forEach((o) => { kill(o); remove(o); }); f.g.visible = false; [g1, g2, g3].forEach(remove);
  const G = graph(8, 34, [0, 2, 4, 6, 8], [10, 20, 30]);
  await G.curve(tok, (n) => 3 * n + 2, C_F, 'f(n) = 3n+2', 1000);
  await G.curve(tok, (n) => n, C_G, 'g(n) = n', 700, -0.4, 0.4);
  say('f 一直比 g 高，怎麼辦？', '3n+2 > n');
  // 4 乘上 c = 4
  await step(tok);
  const cg = await G.curve(tok, (n) => 4 * n, C_CG, 'c·g(n) = 4n', 1000, -1.6, 0.45);
  const cb = buddy('c', '4', C_CG, 5.9, 0, 1.6, 0.7); cb.mood('happy'); await cb.hop(tok);
  const r1 = no('n=1：f=5 ＞ 4n=4 ✗', -2.6, 5.9, 0);
  const r2 = ok('n=2：f=8 ≤ 4n=8 ✓', -2.6, 5.3, 0);
  const r3 = ok('n=3：f=11 ≤ 4n=12 ✓', -2.6, 4.7, 0);
  say('挑 c = 4 試試看', '3n+2 ≤ 4n ⇔ n ≥ 2');
  // 5 n0 = 2 之後永遠蓋住
  await step(tok);
  const m0 = G.mark(2, 'n₀ = 2');
  const n0b = buddy('n₀', '2', '#8fd1a8', 5.9, 0, -0.3, 0.6); n0b.mood('happy');
  const proof = chip('找法：3n+2 ≤ 3n + n = 4n（只要 n ≥ 2）', -1.0, 3.9, 0.3);
  say('n₀ 之後，4n 永遠在上面', '3n+2 = O(n)，c=4、n₀=2');
  // 6 第二個例子 10n²+4n+2 = O(n²)
  await step(tok);
  [r1, r2, r3, proof].forEach(remove); m0.kill(); G.clearCurves();
  G.setTicks([0, 4, 8, 10, 12], [500, 1000, 1500], 12, 1600);
  // same axes, relabelled 0..12 / 0..1600: rescale each function into the old frame
  const X12 = (fn) => (n8) => (fn((n8 * 12) / 8) * 34) / 1600;
  await G.curve(tok, X12((n) => 10 * n * n + 4 * n + 2), C_F, 'f(n) = 10n²+4n+2', 1000, -3.4, 0.2);
  await G.curve(tok, X12((n) => 11 * n * n), C_CG, '11n²', 900, -0.9, 0.3);
  cb.set('11'); await cb.hop(tok); n0b.set('10');
  const m10 = G.mark((10 * 8) / 12, 'n₀ = 10');
  const r4 = ok('n=10：f=1042 ≤ 11n²=1100 ✓', -2.2, 5.9, 0);
  say('彭老師的第二題', '10n²+4n+2 = O(n²)，c=11、n₀=10');
  // 7 陷阱：選錯 g，c 再大也救不了
  await step(tok);
  remove(r4); m10.kill();
  const bad = await G.curve(tok, X12((n) => 100 * n), C_BAD, 'c·n = 100n', 900, -1.2, -0.6);
  cb.set('100'); cb.mood('sad');
  const r5 = no('n≈10 之後 f 就衝過 100n', -2.2, 5.9, 0);
  const r6 = no('c=1000？n=100 時 f=100402 ＞ 100000', -2.2, 5.3, 0);
  say('c 再大也蓋不住：不是 O(n)', 'f(n)/n = 10n+4+2/n → ∞');
  // 8 取最小的上界
  await step(tok);
  [r5, r6].forEach(remove); G.clearCurves(); G.setTicks([0, 2, 4, 6, 8], [10, 20, 30]);
  cb.set('4'); cb.mood('calm'); n0b.set('2');
  await G.curve(tok, (n) => 3 * n + 2, C_F, 'f(n) = 3n+2', 600);
  await G.curve(tok, (n) => 4 * n, C_CG, 'O(n) ✓ 最貼近', 600, -1.6, 0.45);
  await G.curve(tok, (n) => n * n, C_LO, 'O(n²) 也對，但太鬆', 600, -2.6, 0.2);
  const set = note('O(g(n)) 是一個「集合」，= 只能從左讀到右', -2.2, 5.9, 0);
  say('天花板要取最低的那一個', '3n+2 = O(n)，不寫 O(n²)');
  // 9 證明三步驟
  await step(tok);
  remove(set);
  const s1 = chip('① 寫出 f(n) ≤ c·g(n)', -2.6, 6.0, 0.3);
  const s2 = chip('② 把小項放大成大項，找出 c', -2.6, 5.4, 0.3);
  const s3 = chip('③ 找 n₀，代數字檢查', -2.6, 4.8, 0.3);
  cb.mood('happy'); n0b.mood('happy'); await cb.hop(tok);
  say('證明 Big-O 的三步驟', '寫不等式 → 找 c → 找 n₀');
  void def; void s1; void s2; void s3; void cg; void bad;
}]);

// ═════════════ 第 12 課：Ω 與 Θ ═════════════
FRAG.push(['c1-omega-theta', 'Ω 是地板、Θ 是上下夾住', async (tok) => {
  fresh([0.4, 3.6, 13.5], [0.3, 3.0, 0]);
  const G = graph(8, 34, [0, 2, 4, 6, 8], [10, 20, 30]);
  // 1 Ω 定義
  await step(tok);
  const def = chip('f(n) = Ω(g(n))  ⇔  存在正常數 c、n₀，使所有 n ≥ n₀ 都有 f(n) ≥ c·g(n)', 0, 7.3, 0);
  const floor = buddy('Ω：地板', '≥', C_LO, 5.9, 0, 1.6, 0.7); floor.mood('calm');
  say('Ω：不等號反過來', 'f(n) ≥ c·g(n)');
  // 2 例子 3n+3 = Ω(n)
  await step(tok);
  await G.curve(tok, (n) => 3 * n + 3, C_F, 'f(n) = 3n+3', 900);
  await G.curve(tok, (n) => 3 * n, C_LO, 'c·g(n) = 3n', 800, -0.2, -0.7);
  const r1 = ok('n=1：6 ≥ 3 ✓　c=3、n₀=1', -2.4, 5.9, 0);
  floor.set('3n'); floor.mood('happy'); await floor.hop(tok);
  say('3n 永遠在 f 下面', '3n+3 = Ω(n)，c=3、n₀=1');
  // 3 取最大的下界
  await step(tok);
  const low = await G.curve(tok, () => 1, '#9aa3ad', 'Ω(1)：對，但太低', 700, -2.2, 0.35);
  const r2 = note('下界有很多個，要取「最大」的那一個', -2.4, 5.3, 0);
  say('地板要取最高的', '3n+3 = Ω(n)，不只說 Ω(1)');
  // 4 Θ 定義
  await step(tok);
  [r1, r2].forEach(remove); G.clearCurves(); void low;
  txt(def, 'f(n) = Θ(g(n))  ⇔  存在正常數 c₁、c₂、n₀，使所有 n ≥ n₀ 都有 c₁·g(n) ≤ f(n) ≤ c₂·g(n)');
  const ceil = buddy('O：天花板', '≤', C_CG, 5.9, 0, -0.6, 0.7);
  floor.set('≥'); floor.mood('calm');
  say('Θ：上下同時夾住', 'c₁·g(n) ≤ f(n) ≤ c₂·g(n)');
  // 5 3n+2 = Θ(n)
  await step(tok);
  await G.curve(tok, (n) => 4 * n, C_CG, 'c₂·n = 4n', 700, -1.6, 0.45);
  await G.curve(tok, (n) => 3 * n, C_LO, 'c₁·n = 3n', 700, -0.2, -0.7);
  await G.curve(tok, (n) => 3 * n + 2, C_F, 'f(n) = 3n+2', 800, -3.4, 0.0);
  const m0 = G.mark(2, 'n₀ = 2');
  const r3 = ok('n ≥ 2：3n ≤ 3n+2 ≤ 4n ✓', -2.4, 5.9, 0);
  ceil.set('4n'); floor.set('3n'); ceil.mood('happy'); floor.mood('happy');
  say('f 被 3n 和 4n 夾住', '3n+2 = Θ(n)，c₁=3、c₂=4、n₀=2');
  // 6 Θ ⇔ O 且 Ω
  await step(tok);
  const r4 = chip('f = Θ(g)  ⇔  f = O(g) 而且 f = Ω(g)', -1.2, 5.2, 0.3);
  await ceil.hop(tok); await floor.hop(tok);
  say('Θ = 既是 O 又是 Ω', '天花板 + 地板 = 夾住');
  // 7 第二例 & 多項式規則
  await step(tok);
  [r3, r4].forEach(remove); m0.kill(); G.clearCurves();
  G.setTicks([0, 4, 8, 10, 12], [500, 1000, 1500], 12, 1600);
  const X12 = (fn) => (n8) => (fn((n8 * 12) / 8) * 34) / 1600;
  await G.curve(tok, X12((n) => 11 * n * n), C_CG, '11n²', 700, -0.9, 0.3);
  await G.curve(tok, X12((n) => 10 * n * n + 4 * n + 2), C_F, 'f = 10n²+4n+2', 700, -3.4, 0.2);
  await G.curve(tok, X12((n) => 10 * n * n), C_LO, '10n²', 700, 0.1, -0.5);
  const m10 = G.mark((10 * 8) / 12, 'n₀ = 10');
  ceil.set('11n²'); floor.set('10n²');
  const r5 = ok('10n² ≤ f(n) ≤ 11n²（n ≥ 10）', -2.2, 5.9, 0);
  const r6 = note('多項式：只看最高次項 → Θ(n²)', -2.2, 5.3, 0);
  say('10n²+4n+2 = Θ(n²)', 'c₁=10、c₂=11、n₀=10');
  // 8 反例 3n+2 ≠ Θ(n²)
  await step(tok);
  [r5, r6].forEach(remove); m10.kill(); G.clearCurves();
  await G.curve(tok, X12((n) => 3 * n + 2), C_F, 'f = 3n+2（貼在地上）', 700, -0.5, 0.35);
  await G.curve(tok, X12((n) => 8 * n * n), C_LO, 'c₁·n²？', 700, 0.1, 0.3);
  floor.set('n²？'); floor.mood('sad');
  const r7 = no('n=100 要 c₁ ≤ 0.03，n=1000 要 c₁ ≤ 0.003…', -2.2, 5.9, 0);
  const r8 = ok('3n+2 = O(n²) 對，但不是 Ω(n²)，所以不是 Θ(n²)', -2.2, 5.3, 0);
  say('n² 當地板撐不住', '3n+2 ≠ Θ(n²)');
  // 9 小 o 與小 ω
  await step(tok);
  [r7, r8].forEach(remove);
  const r9 = chip('小 o：f = o(g) ⇔ 對「每一個」c > 0 都找得到 n₀，n ≥ n₀ 時 f(n) < c·g(n)', 0, 6.2, 0.3);
  const r10 = ok('3n+2 = o(n²)　✓（嚴格比較慢）', -2.2, 5.5, 0.3);
  const r11 = no('3n+2 = o(n)　✗（同一級，不算嚴格慢）', -2.2, 4.9, 0.3);
  const r12 = note('小 ω 反過來：f 嚴格長得比 g 快，例 n² = ω(n)', -2.2, 4.3, 0.3);
  say('小 o、小 ω：嚴格的大小', 'o 像 <，ω 像 >');
  // 10 總整理
  await step(tok);
  [r9, r10, r11, r12].forEach(remove); G.clearCurves(); G.clear(); remove(def);
  const a = buddy('O：天花板', '≤', C_CG, -4, 0, 0, 1.0);
  const b = buddy('Ω：地板', '≥', C_LO, 0, 0, 0, 1.0);
  const c = buddy('Θ：夾住', '＝', C_F, 4, 0, 0, 1.0);
  ceil.g.visible = false; floor.g.visible = false;
  chip('f 最多這麼快（上界）', -4, 2.4, 0); chip('f 至少這麼快（下界）', 0, 2.4, 0); chip('剛好這個等級（緊界）', 4, 2.4, 0);
  no('陷阱：O ≠ 最壞情況；最壞情況也能用 O、Ω、Θ 來描述', 0, 4.2, 0);
  for (const x of [a, b, c]) { x.mood('happy'); await x.hop(tok); }
  say('三個符號一起記', 'O ≤　Ω ≥　Θ 夾住');
}]);

// ═════════════ 第 13 課：數學工具 ═════════════
FRAG.push(['c1-math-tools', 'log、指數、級數：複雜度的高中數學', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 2.6, 0]);
  // 1 三樣工具
  await step(tok);
  const kid = buddy('你', '?', '#7cb8ee', 0, 0, 1.5, 1.0); kid.mood('wow');
  const t1 = note('2ⁿ　指數', -4, 3.2, 0), t2 = note('log n　對數', 0, 3.6, 0), t3 = note('1+2+…+n　級數', 4, 3.2, 0);
  say('三樣高中數學工具', 'log n、2ⁿ、1+2+…+n');
  // 2 指數：一直乘 2
  await step(tok);
  [t1, t2, t3].forEach(remove); kid.g.position.set(-6, 0, 2.2); kid.mood('calm');
  const bars = [];
  for (let k = 0; k <= 4; k++) {
    const h = 0.3 * 2 ** k, m = cube(null, '#f4a56a', [0.9, 1, 0.9], -4 + k * 1.6, 0, -1.2);
    m.scale.y = 0.02; bars.push(m);
    tag('2' + '⁰¹²³⁴'[k] + '=' + 2 ** k, 'idx', -4 + k * 1.6, -0.35, -0.4);
    await anim(tok, 300, (u) => { m.scale.y = Math.max(0.02, u * h); m.position.y = m.scale.y / 2; });
  }
  const big = ok('2¹⁰ = 1024 ≈ 1000（一千）', 3.6, 5.6, 0);
  kid.mood('wow');
  say('指數：每次乘 2，翻倍長', '2¹⁰ = 1024 ≈ 10³');
  // 3 log：對半切幾次
  await step(tok);
  bars.forEach((m) => dimMesh(m)); remove(big);
  let row = [];
  for (let i = 0; i < 16; i++) row.push(cube(null, '#7cb8ee', [0.42, 0.42, 0.42], -3.6 + i * 0.48, 0.21, 2.0));
  const cnt = buddy('切了幾刀', '0', '#8fd1a8', 5.6, 0, 2.0, 0.65);
  const nl = tag('n = 16', 'ptr', 0, 1.0, 2.0);
  for (let cut = 1; cut <= 4; cut++) {
    await pause(tok, 350);
    const half = row.length / 2; row.slice(half).forEach(kill); row = row.slice(0, half);
    cnt.set(cut); txt(nl, '剩 ' + row.length + ' 個');
  }
  cnt.mood('happy'); await cnt.hop(tok);
  say('16 對半切 4 次剩 1', 'log₂ 16 = 4，因為 2⁴ = 16');
  // 4 log 很小
  await step(tok);
  const l1 = chip('log₂ 1,000 ≈ 10', 3.4, 6.2, 0), l2 = chip('log₂ 1,000,000 ≈ 20', 3.4, 5.6, 0), l3 = chip('log₂ 10⁹ ≈ 30', 3.4, 5.0, 0);
  const tip = note('1000 筆資料猜數字，每次砍一半，約 10 次就猜到', -2.5, 6.2, 0);
  kid.mood('happy');
  say('n 超大，log n 還是很小', '2¹⁰ ≈ 10³ ⇒ log₂ 10³ ≈ 10');
  // 5 換底：底數只差常數倍
  await step(tok);
  [l1, l2, l3, tip].forEach(remove);
  const b1 = chip('換底公式：logₐ n = log_b n ÷ log_b a', 0, 6.2, 0);
  const b2 = note('log₄ n = log₂ n ÷ 2　例：log₄ 16 = 4 ÷ 2 = 2', 0, 5.5, 0);
  const b3 = ok('只差常數倍 ⇒ O(log n) 不用寫底數', 0, 4.8, 0);
  say('換底只差一個常數', 'log₄ n = (log₂ n) / 2');
  // 6 log 的兩條運算規則
  await step(tok);
  [b1, b2, b3].forEach(remove);
  const q1 = chip('log(x·y) = log x + log y', -2.6, 6.2, 0);
  const q2 = chip('log(nᵏ) = k · log n', 2.6, 6.2, 0);
  const q3 = note('例：log₂(8·4) = 3 + 2 = 5；log(n²) = 2 log n = O(log n)', 0, 5.4, 0);
  say('乘法變加法、次方變倍數', 'log(n²) = 2·log n');
  // 7 等差級數：樓梯 + 倒過來的樓梯 = 長方形
  await step(tok);
  [q1, q2, q3].forEach(remove); bars.forEach(kill); row.forEach(kill); remove(nl);
  cnt.g.visible = false; kid.g.position.set(-6, 0, 1.5);
  const S = 0.62, n = 5, stairs = [], flip = [];
  for (let i = 1; i <= n; i++) for (let k = 0; k < i; k++) stairs.push(cube(null, '#f4a56a', [S - 0.04, S - 0.04, S - 0.04], -2.2 + (i - 1) * S, S / 2 + k * S, 0, 0));
  const sl = tag('1+2+3+4+5 = 15', 'ptr', -1.0, 4.5, 0);
  await pause(tok, 500);
  for (let i = 1; i <= n; i++) for (let k = i; k <= n; k++) flip.push(cube(null, '#7cb8ee', [S - 0.04, S - 0.04, S - 0.04], -2.2 + (i - 1) * S, S / 2 + k * S, 0, 0));
  await anim(tok, 700, (u) => flip.forEach((m) => { m.scale.setScalar(Math.max(0.02, u)); }));
  txt(sl, '兩份拼成 5 × 6 = 30 格，一份 = 15');
  const gs = chip('1 + 2 + … + n = n(n+1) / 2', 3.6, 3.0, 0);
  say('兩個樓梯拼成長方形', '1+2+…+n = n(n+1)/2');
  // 8 n = 100 與巢狀迴圈
  await step(tok);
  const g100 = ok('n = 100：100 × 101 ÷ 2 = 5050', 3.6, 2.3, 0);
  const cd = code(['for i ← 1 to n', '  for j ← 1 to i', '    count++'], 3.4, 6.4, 0.5, 0);
  const g2 = note('內圈跑 1+2+…+n 次 = n(n+1)/2 = Θ(n²)', 3.6, 4.5, 0);
  cd.hl(2); kid.mood('happy');
  say('巢狀迴圈常出現這個和', 'n(n+1)/2 = Θ(n²)');
  // 9 等比級數：1+2+4+8 = 16−1
  await step(tok);
  [...stairs, ...flip].forEach(kill); [sl, gs, g100, g2].forEach(remove); cd.kill();
  const gb = [];
  for (let k = 0; k <= 3; k++) { const h = 0.3 * 2 ** k, m = cube(String(2 ** k), '#f4a56a', [0.9, h, 0.9], -4 + k * 1.4, h / 2, 0); gb.push(m); }
  const b16 = cube('16', '#7cb8ee', [0.9, 4.8, 0.9], 3.6, 2.4, 0);
  await pause(tok, 300);
  // stack the four bars into one column next to 16
  const tops = [0, 0.3, 0.9, 2.1];
  await anim(tok, 1200, (u) => gb.forEach((m, k) => { const h = 0.3 * 2 ** k; m.position.x = -4 + k * 1.4 + (2.2 - (-4 + k * 1.4)) * u; m.position.y = h / 2 + (tops[k] + h / 2 - h / 2) * u; }));
  const gap = no('只差 1 格', 2.2, 5.0, 0);
  const gf = chip('1 + 2 + 4 + … + 2ᵏ = 2ᵏ⁺¹ − 1', -2.6, 5.6, 0);
  say('前面全部加起來 = 下一個 − 1', '1+2+4+8 = 16 − 1');
  // 10 一直減半：n + n/2 + n/4 + … ≤ 2n
  await step(tok);
  [...gb, b16].forEach(kill); [gap].forEach(remove);
  txt(gf, '公比 r：1 + r + r² + … + rᵏ = (rᵏ⁺¹ − 1) / (r − 1)');
  const frame = P.ghostBox('#2fa36b', 8, 0.8, 0.8); frame.position.set(0, 0.4, 0);
  tag('2n（n = 4）', 'ptr', 0, 1.3, 0);
  const ws = [4, 2, 1, 0.5, 0.25, 0.125]; let x = -4; const pieces = [];
  for (const w of ws) { const m = cube(null, ws.indexOf(w) % 2 ? '#7cb8ee' : '#f4a56a', [w - 0.03, 0.7, 0.7], x + w / 2, 0.35, 0); pieces.push(m); x += w; await pause(tok, 220); }
  const gh = ok('n + n/2 + n/4 + … 永遠 < 2n ⇒ O(n)', 0, 3.0, 0);
  say('一直減半，總和不到 2 倍', 'n + n/2 + n/4 + … ≤ 2n');
  // 11 階乘
  await step(tok);
  pieces.forEach(kill); remove(frame); remove(gh); remove(gf);
  const f5 = buddy('5!', '120', '#f08a4b', -3, 0, 0, 0.9), p10 = buddy('2¹⁰', '1,024', '#7cb8ee', 0.5, 0, 0, 0.9), f10 = buddy('10!', '3,628,800', '#d9534f', 4.2, 0, 0, 1.2);
  chip('n! = 1 × 2 × 3 × … × n（階乘）', 0, 4.4, 0);
  f10.mood('wow'); await f10.hop(tok);
  say('n! 比 2ⁿ 長得快很多', '10! = 3,628,800 ≫ 2¹⁰');
  // 12 考試陷阱
  await step(tok);
  f5.g.visible = false; p10.g.visible = false; f10.g.visible = false;
  ok('log 的底數不重要：log₂ n、log₁₀ n 都是 Θ(log n)', 0, 5.6, 0);
  no('指數的底數很重要：4ⁿ = (2ⁿ)²，不是 O(2ⁿ)', 0, 4.8, 0);
  no('1+2+…+n 是 Θ(n²)，不是 Θ(n)', 0, 4.0, 0);
  kid.g.position.set(0, 0, 1.5); kid.mood('happy'); await kid.hop(tok);
  say('三個常見陷阱', '4ⁿ ≠ O(2ⁿ)');
}]);

// ═════════════ 第 14 課：成長率排序 ═════════════
FRAG.push(['c1-growth-rates', '函數賽跑：1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n!', async (tok) => {
  fresh([0, 4.2, 14], [0, 2.6, 0]);
  const NAMES = ['1', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', 'n!'];
  const COLS = ['#8fd1a8', '#7cc5b8', '#7cb8ee', '#8aa0e8', '#b07cd8', '#e08ac0', '#f4a56a', '#f08a4b', '#d9534f'];
  const XS = NAMES.map((_, i) => -6 + i * 1.5);
  const VALS = {
    10: ['1', '3.3', '3.2', '10', '33', '100', '1,000', '1,024', '3,628,800'],
    100: ['1', '6.6', '10', '100', '664', '10,000', '10⁶', '1.3×10³⁰', '9.3×10¹⁵⁷'],
    1000: ['1', '10', '31.6', '1,000', '9,966', '10⁶', '10⁹', '1.1×10³⁰¹', '4×10²⁵⁶⁷'],
  };
  const DIG = { 10: [0, 0.52, 0.5, 1, 1.52, 2, 3, 3.01, 6.56], 100: [0, 0.82, 1, 2, 2.82, 4, 6, 30.1, 158], 1000: [0, 1, 1.5, 3, 4, 6, 9, 301, 2567.6] };
  const CAP = 6.0, hOf = (d) => Math.min(CAP, 0.2 + 0.55 * d);
  const racers = [], bars = [], vals = [];
  let cur = NAMES.map(() => 0.02); const burst = [];
  async function setN(n, ms = 1400) {
    const from = cur.slice(), to = DIG[n].map(hOf);
    burst.splice(0).forEach(remove);
    await anim(tok, ms, (u) => bars.forEach((m, i) => { m.scale.y = Math.max(0.02, from[i] + (to[i] - from[i]) * u); m.position.y = m.scale.y / 2; vals[i].position.y = m.scale.y + 0.3; }));
    cur = to;
    VALS[n].forEach((v, i) => { txt(vals[i], v); vals[i].element.style.visibility = ''; if (DIG[n][i] > 10) burst.push(no('爆表', XS[i], CAP + 0.85, -0.6)); });
  }
  // 1 為什麼要排
  await step(tok);
  const A = buddy('演算法 A', 'n log n', '#b07cd8', -2.5, 0, 1.0, 1.1), B = buddy('演算法 B', 'n²', '#e08ac0', 2.5, 0, 1.0, 1.1);
  chip('同一個問題，兩種做法：資料很多時誰比較快？', 0, 3.6, 0);
  A.look(1); B.look(-1);
  say('兩個演算法，誰比較快？', 'O(n log n) vs O(n²)');
  // 2 九位選手上場
  await step(tok);
  fresh([0, 4.2, 14], [0, 2.6, 0]);
  NAMES.forEach((nm, i) => {
    racers.push(buddy(nm, '', COLS[i], XS[i], 0, 1.8, 0.62));
    const m = cube(null, COLS[i], [0.8, 1, 0.8], XS[i], 0.01, -0.6); m.scale.y = 0.02; bars.push(m);
    const v = tag('', 'idx', XS[i], 0.3, -0.6); v.element.style.visibility = 'hidden'; vals.push(v);
  });
  const legend = note('柱子高度看「位數」：數字多一位，柱子就高一截', 0, 7.0, -0.6);
  say('九位選手：柱子 = 要跑的步數', '步數越少越快');
  // 3 n = 10
  await step(tok);
  const nb = tag('n = 10', 'ptr', -6.6, 6.2, -0.6);
  await setN(10);
  racers.forEach((r) => r.mood('calm'));
  say('n = 10：大家差不多', 'n! 已經 3,628,800');
  // 4 n = 100
  await step(tok);
  txt(nb, 'n = 100'); await setN(100);
  racers[7].mood('wow'); racers[8].mood('wow');
  say('n = 100：2ⁿ、n! 爆表', '2¹⁰⁰ ≈ 1.3×10³⁰');
  // 5 n = 1000
  await step(tok);
  txt(nb, 'n = 1000'); await setN(1000);
  racers.forEach((r, i) => r.mood(i <= 4 ? 'happy' : i <= 6 ? 'calm' : 'sad'));
  for (const i of [0, 1, 2]) await racers[i].hop(tok);
  say('n = 1000：差距越拉越大', 'log n = 10、n³ = 10⁹');
  // 6 換成時間
  await step(tok);
  legend.element.textContent = '假設每一步 1 微秒（百萬分之一秒），n = 1000：';
  const tt = [ok('n log n ≈ 0.01 秒', -4.2, 6.2, 1.2), ok('n² = 1 秒', -1.2, 6.2, 1.2), note('n³ ≈ 17 分鐘', 1.6, 6.2, 1.2), no('2ⁿ ≈ 10²⁸⁷ 年（宇宙才 1.4×10¹⁰ 年）', 3.4, 5.5, 1.2)];
  say('換成時間更有感', 'n³：17 分鐘；2ⁿ：永遠跑不完');
  // 7 排行榜
  await step(tok);
  tt.forEach(remove); burst.forEach(remove);
  legend.element.textContent = '1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n! < nⁿ';
  const grp = [chip('常數', -6, -0.9, 2.6), chip('對數', -4.5, -0.9, 2.6), chip('多項式', -0.75, -0.9, 2.6), chip('指數', 4.5, -0.9, 2.6), chip('階乘', 6, -0.9, 2.6)];
  say('n 夠大時的排行榜', '1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n!');
  // 8 小 n 的陷阱
  await step(tok);
  grp.forEach(remove); txt(nb, 'n = 10'); await setN(10, 1000);
  racers.forEach((r) => r.mood('calm')); racers[1].mood('wow'); racers[2].mood('sad');
  const w1 = no('n = 10：log n ≈ 3.3 > √n ≈ 3.2（反了！）', -1.5, 6.2, 1.2);
  const w2 = note('100n vs n²：n < 100 時 n² 反而比較小', -1.5, 5.5, 1.2);
  say('n 小的時候順序會反', 'Big-O 只看 n 很大的時候');
  // 9 極限比較法
  await step(tok);
  [w1, w2].forEach(remove);
  racers.forEach((r, i) => { r.g.visible = i === 4 || i === 5; }); bars.forEach((m, i) => { m.visible = i === 4 || i === 5; }); vals.forEach((v, i) => { v.element.style.visibility = i === 4 || i === 5 ? '' : 'hidden'; });
  legend.element.textContent = '比較 f 和 g：看 n → ∞ 時 f(n) / g(n) 趨近什麼';
  const L1 = chip('→ 0：f 長得比較慢　f = O(g)，而且 f = o(g)', -1.5, 6.2, 1.2);
  const L2 = chip('→ 常數 c > 0：同一級　f = Θ(g)', -1.5, 5.5, 1.2);
  const L3 = chip('→ ∞：f 長得比較快　f = Ω(g)，而且 f = ω(g)', -1.5, 4.8, 1.2);
  say('用極限比大小', 'lim f(n)/g(n)：0、常數、∞');
  // 10 例：n log n vs n²
  await step(tok);
  [L2, L3].forEach(remove);
  txt(L1, 'f/g = (n log n)/n² = (log n)/n');
  const rt = tag('', 'pkt', 1.5, 5.0, 1.2);
  const NS = [[10, '0.33'], [1000, '0.01'], ['10⁶', '0.00002'], ['∞', '→ 0']];
  for (const [nn, r] of NS) { txt(rt, 'n = ' + nn + '：' + r); await pause(tok, 450); }
  racers[4].mood('happy'); racers[5].mood('sad'); await racers[4].hop(tok);
  say('比值趨近 0', 'n log n = O(n²)，但不是 Θ(n²)');
  // 11 更多例子
  await step(tok);
  remove(rt); txt(L1, '(n² + 3n) / n² → 1　⇒ 同一級 Θ(n²)');
  const e2 = chip('2ⁿ / 3ⁿ = (2/3)ⁿ → 0　⇒ 2ⁿ = o(3ⁿ)，底數不同就不同級', -1.5, 5.5, 1.2);
  const e3 = chip('log₂ n / log₁₀ n → 3.32（常數）⇒ 同一級', -1.5, 4.8, 1.2);
  say('三個用極限判斷的例子', '常數 → Θ；0 → o');
  // 12 考試大原則
  await step(tok);
  [L1, e2, e3].forEach(remove);
  racers.forEach((r) => { r.g.visible = true; r.mood('calm'); }); bars.forEach((m) => { m.visible = true; }); vals.forEach((v) => { v.element.style.visibility = ''; });
  legend.element.textContent = '1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n! < nⁿ';
  ok('任何多項式 nᵏ 最後都輸給指數 2ⁿ（例：n¹⁰⁰ = O(2ⁿ)）', -1.0, 6.2, 1.2);
  ok('任何 log 的次方都輸給 n 的正次方（例：(log n)² = O(√n)）', -1.0, 5.5, 1.2);
  racers[0].mood('happy'); await racers[0].hop(tok);
  say('考試兩大原則', 'nᵏ = O(2ⁿ)，(log n)ᵏ = O(n^ε)');
  void A; void B;
}]);

// ═════════════ 第 15 課：遞迴基礎 ═════════════
FRAG.push(['c1-recursion-basics', '遞迴：把大問題交給「小一號的自己」', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 1.8, 0.5]);
  const ARR = [3, 1, 4, 1, 5];
  // 1 加總 5 個數 = 前 4 個 + 最後一個
  await step(tok);
  const cells = ARR.map((v, i) => cube(v, '#f3dcc0', [0.8, 0.8, 0.8], -1.8 + i * 0.9, 0.4, -2.2));
  ARR.forEach((_, i) => tag('list[' + i + ']', 'idx', -1.8 + i * 0.9, -0.2, -1.6));
  const top = buddy('sum(5 個)', '?', '#7cb8ee', -5.5, 0, 1.5, 0.75);
  const idea = chip('5 個數的和 ＝ 前 4 個的和 ＋ 最後一個', 0, 3.4, -2.2);
  glow(cells[4], '#5a3a00');
  say('大問題 = 小一號的問題 + 一點點', 'sum(5) = sum(4) + list[4]');
  // 2 一路往下交辦
  await step(tok);
  const chain = [top];
  for (let k = 4; k >= 0; k--) {
    const x = -5.5 + (5 - k) * 2.2;
    const b = buddy('sum(' + k + ' 個)', '?', k === 0 ? '#8fd1a8' : '#7cb8ee', x, 0, 1.5, 0.75); chain.push(b);
    const ask = tag('幫我算前 ' + k + ' 個', 'pkt', x - 2.2, 1.5, 1.5);
    await travel(tok, ask, V3(x - 2.2, 1.5, 1.5), V3(x - 0.4, 1.5, 1.5), 380); remove(ask);
  }
  say('每個人都交給小一號的自己', 'sum(5) → sum(4) → … → sum(0)');
  // 3 recursive formula
  await step(tok);
  remove(idea);
  const cd = code(['sum(list, n):', '  if n == 0: return 0', '  return sum(list, n−1) + list[n−1]'], 0, 4.4, 0.5, -2.2);
  cd.hl(2);
  say('第一件事：遞迴式', 'sum(n) = sum(n−1) + list[n−1]');
  // 4 terminating condition
  await step(tok);
  cd.hl(1);
  const last = chain[5]; last.set('0'); last.mood('happy'); await last.hop(tok);
  const st = ok('n = 0 就停：直接回傳 0', 5.5, 3.0, 1.5);
  const ghost = no('沒有終止條件：sum(−1)、sum(−2)… 停不下來！', 0, -0.9, 3.4);
  say('第二件事：終止條件', 'n == 0 → return 0');
  // 5 答案一路傳回來
  await step(tok);
  remove(ghost); remove(st);
  const partial = [0, 3, 4, 8, 9, 14];
  for (let k = 1; k <= 5; k++) {
    const from = chain[6 - k], to = chain[5 - k];
    const p = tag('回傳 ' + partial[k - 1], 'pkt', from.g.position.x, 1.9, 1.5);
    glow(cells[k - 1], '#5a3a00');
    await travel(tok, p, V3(from.g.position.x, 1.9, 1.5), V3(to.g.position.x + 0.3, 1.9, 1.5), 380); remove(p);
    to.set(partial[k]); to.mood('happy');
  }
  await top.hop(tok);
  say('答案一層一層傳回來', '0 → 3 → 4 → 8 → 9 → 14');
  // 6 迴圈 vs 遞迴
  await step(tok);
  cd.kill();
  const lp = chip('for 迴圈：重複執行「同一段指令」', -3.2, 4.4, -2.2);
  const rc = chip('遞迴：重複呼叫「同一個函式」', 3.2, 4.4, -2.2);
  chain.forEach((b) => b.mood('calm'));
  say('迴圈和遞迴都在「重複」', '重複的東西不一樣');
  // 7 直接遞迴 vs 間接遞迴
  await step(tok);
  fresh([0, 4.4, 13.5], [0, 1.8, 0.5]);
  const A1 = buddy('函式 A', '', '#7cb8ee', -4.2, 0, 0.5, 1.0);
  arrow(V3(-3.4, 1.4, 0.5), V3(-3.4, 2.3, 0.5), 0x0f5a3a); arrow(V3(-3.4, 2.3, 0.5), V3(-4.6, 2.3, 0.5), 0x0f5a3a); arrow(V3(-4.6, 2.3, 0.5), V3(-4.6, 1.3, 0.5), 0x0f5a3a);
  chip('direct recursion：A 呼叫 A', -4.2, 3.4, 0.5);
  const A2 = buddy('函式 A', '', '#7cb8ee', 1.6, 0, 0.5, 1.0), B2 = buddy('函式 B', '', '#f4a56a', 5.0, 0, 0.5, 1.0);
  arrow(V3(2.3, 1.2, 0.5), V3(4.3, 1.2, 0.5), 0x0f5a3a); arrow(V3(4.3, 0.6, 0.5), V3(2.3, 0.6, 0.5), 0x7a1010);
  chip('indirect recursion：A 呼叫 B，B 又呼叫 A', 3.3, 3.4, 0.5);
  A1.mood('happy'); A2.look(1); B2.look(-1);
  say('直接遞迴與間接遞迴', 'A→A ／ A→B→A');
  // 8 遞迴乘法
  await step(tok);
  fresh([0, 4.4, 13.5], [0, 1.8, 0.5]);
  const mf = code(['mult(a, b):', '  if b == 1: return a', '  return mult(a, b−1) + a'], -3.4, 5.6, 0.5, -1.5);
  const ms = [4, 3, 2, 1].map((b, i) => buddy('mult(3, ' + b + ')', '?', b === 1 ? '#8fd1a8' : '#f4a56a', -4.8 + i * 3.2, 0, 1.2, 0.8));
  for (let i = 0; i < 3; i++) { const p = tag('問 mult(3, ' + (3 - i) + ')', 'pkt', ms[i].g.position.x, 1.6, 1.2); await travel(tok, p, V3(ms[i].g.position.x, 1.6, 1.2), V3(ms[i + 1].g.position.x - 0.6, 1.6, 1.2), 350); remove(p); }
  mf.hl(1); ms[3].set(3); ms[3].mood('happy');
  for (let i = 2; i >= 0; i--) { const p = tag('+3', 'pkt', ms[i + 1].g.position.x, 2.0, 1.2); await travel(tok, p, V3(ms[i + 1].g.position.x, 2.0, 1.2), V3(ms[i].g.position.x + 0.4, 2.0, 1.2), 350); remove(p); ms[i].set(3 * (4 - i)); ms[i].mood('happy'); }
  chip('邊界條件 b = 1：3 × 1 = 3', 4.8, 3.0, 1.2);
  say('a×b = a×(b−1) + a', '3×4 = 3×3 + 3 = … = 12');
  // 9 1+…+n 的遞迴與效率
  await step(tok);
  fresh([0, 4.4, 13.5], [0, 1.8, 0.5]);
  code(['S(n):', '  if n == 1: return 1', '  return S(n−1) + n'], -3.4, 5.6, 0.5, -1.5);
  code(['S(n):', '  s ← 0', '  for i ← 1 to n: s ← s + i', '  return s'], 3.2, 5.6, 0.5, -1.5);
  const rb = buddy('遞迴版', '', '#7cb8ee', -3.4, 0, 1.0, 0.9), lb = buddy('迴圈版', '', '#8fd1a8', 3.2, 0, 1.0, 0.9);
  rb.mood('sad'); lb.mood('happy'); await lb.hop(tok);
  no('每次呼叫都要記「做完回到哪裡」，比較慢、比較佔記憶體', -1.0, 3.0, 1.0);
  note('寫遞迴先檢查：每次都朝終止條件前進嗎？', 1.8, 2.3, 1.0);
  say('答案一樣，迴圈通常比較快', 'S(n) = S(n−1) + n，S(1) = 1');
  void cells; void A1; void A2; void B2; void rc; void lp;
}]);
  }

  // ═══ course4.js ═══
  {
// ─── 資料結構 第 1 章 課程 part 4：遞迴範例、遞迴的堆疊空間、遞迴關係式、遞迴樹、Master Theorem ───
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const say = (a, b = '') => ctx.say(a, b);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const cls = (l, c) => { l.element.className = 'lab-label ' + c; };
const C_CELL = '#f3dcc0', C_DIM = '#cfc8bc', C_BLUE = '#7cb8ee', C_ORNG = '#f4a56a', C_GRN = '#8fd3a8', C_PINK = '#f2a7c3', C_YEL = '#f3d36b';
// a tree node: a small block with its own work written on it, plus an edge to its parent
function tnode(text, x, y, parent, color = C_CELL, w = 1.0) {
  const m = cube(text, color, [w, 0.6, 0.8], x, y, 0);
  if (parent) m.userData.edge = P.line(parent.position.x, parent.position.y - 0.3, x, y + 0.3, 0);
  return m;
}

// ══ 第 16 課：遞迴範例：二分搜尋與排列 ══
FRAG.push(['c1-recursion-examples', '遞迴範例：二分搜尋與排列', async (tok) => {
  fresh([0, 6.5, 11.5], [0, 1.2, 0]);
  const A = [3, 8, 15, 21, 27, 34, 40, 52];
  const xs = (i) => -4.9 + i * 1.4;
  // 1. 二分搜尋是什麼：輸入排好序的陣列與 x，輸出位置
  await step(tok);
  const cells = A.map((v, i) => cube(v, C_CELL, [1.1, 0.7, 1.1], xs(i), 0.35, 0, 1.5 + i * 0.2));
  A.forEach((v, i) => tag(String(i), 'idx', xs(i), -0.1, 0.95));
  const hunter = buddy('要找 x', 34, C_BLUE, -6.2, 0, 2.8, 0.75);
  tag('已排好序的陣列（小 → 大）', 'say', 0, 1.6, -1.0);
  say('二分搜尋：在排好的數字裡找 x', '輸入：排序陣列＋x → 輸出：位置');
  // 2. 迴圈版：left、right 兩條界線
  await step(tok);
  const L = tag('left', 'ptr', xs(0), 1.15, 0.6), R = tag('right', 'ptr', xs(7), 1.15, 0.6);
  const cd = code(['while (left <= right) {', '  mid = (left + right) / 2;', '  比較 x 和 list[mid]', '  砍掉不可能的那一半', '}'], 0, 4.8, 0.5, -2.4);
  say('迴圈版：left、right 夾住範圍', 'while (left <= right)');
  // 3. 遞迴版：自己呼叫自己，界線變成參數
  await step(tok);
  P.txt(cd.ls[0], 'binsearch(list, x, left, right):');
  P.txt(cd.ls[1], '  if (left > right) return -1;');
  P.txt(cd.ls[2], '  mid = (left + right) / 2;');
  P.txt(cd.ls[3], '  相等 → return mid；小 → 找左半');
  P.txt(cd.ls[4], '  大 → binsearch(list, x, mid+1, right)');
  cd.hl(4);
  say('遞迴版：把「新範圍」傳給自己', 'binsearch(…, left, right)');
  // 4. trace：找 34
  await step(tok);
  const M = tag('mid = 3', 'pkt', xs(3), 2.3, 0.4);
  glow(cells[3], '#5a3a00');
  for (let i = 0; i <= 3; i++) P.tint(cells[i], C_DIM);
  await travel(tok, L, L.position.clone(), V3(xs(4), 1.15, 0.6), 600);
  glow(cells[3]);
  M.element.textContent = '21 < 34 → 找右半 (4..7)';
  await anim(tok, 400, () => {});
  M.position.set(xs(5), 2.3, 0.4); M.element.textContent = 'mid = 5：找到 34！';
  glow(cells[5], '#0f5a3a');
  hunter.mood('happy'); await hunter.hop(tok);
  ok('回傳 5', xs(5), -0.6, 1.8);
  say('只問了 2 次就找到', 'mid=3 → mid=5');
  // 5. 每次砍半 → 呼叫次數約 log₂n
  await step(tok);
  note('每呼叫一次，範圍砍一半：8 → 4 → 2 → 1', 0, 3.0, 1.6);
  say('每層只做 1 次比較＋砍半', 'T(n) = T(n/2) + 1 → O(log n)');
  // 6. 排列：abc 有 6 種
  await step(tok);
  fresh([0, 6.2, 12], [0, 2.4, 0]);
  const letters = ['a', 'b', 'c'].map((c, i) => buddy('', c, [C_PINK, C_GRN, C_YEL][i], -1.4 + i * 1.4, 0, 3.0, 0.7));
  no('cout 寫死 6 行 → 換成 100 個字就寫不完 ✗', -2.5, 2.0, 3.2);
  say('abc 共 3! = 6 種排法', '目標：讓程式自動產生');
  // 7. 遞迴想法：固定第一個字，剩下的再排
  await step(tok);
  const root = tnode('perm(1..3)', 0, 5.4, null, C_BLUE, 1.8);
  const kids = [['a 固定｜排 bc', -4.4], ['b 固定｜排 ac', 0], ['c 固定｜排 ba', 4.4]].map(([t, x]) => tnode(t, x, 3.7, root, C_CELL, 2.6));
  say('先固定第 1 個字，其餘遞迴排', 'perm(list, 1, 3) → perm(list, 2, 3)');
  // 8. 邊界條件：範圍只剩一格就輸出
  await step(tok);
  const outs = ['abc', 'acb', 'bac', 'bca', 'cba', 'cab'];
  const lx = [-5.6, -3.2, -1.2, 1.2, 3.2, 5.6];
  outs.forEach((o, i) => { const k = kids[Math.floor(i / 2)]; P.line(k.position.x, 3.4, lx[i], 2.3, 0); ok(o, lx[i], 2.0, 0); });
  note('範圍只剩 3..3 一格 → 邊界條件：直接輸出', 0, 1.2, 0.8);
  letters.forEach((b) => b.mood('happy'));
  say('只剩一格就輸出，不再呼叫', 'if (i == n) 輸出');
  // 9. 用 swap 換字：換過去、排完、換回來
  await step(tok);
  const g0 = letters[0].g, g1 = letters[1].g;
  const p0 = g0.position.clone(), p1 = g1.position.clone();
  const sw = tag('swap：把 b 換到第 1 格', 'pkt', 0, 1.5, 3.4);
  await anim(tok, 800, (u) => { g0.position.lerpVectors(p0, p1, u); g1.position.lerpVectors(p1, p0, u); });
  letters[1].mood('wow');
  await anim(tok, 300, () => {});
  sw.element.textContent = '排完 b 開頭的 → 再 swap 回來';
  await anim(tok, 800, (u) => { g0.position.lerpVectors(p1, p0, u); g1.position.lerpVectors(p0, p1, u); });
  letters[1].mood('happy');
  say('swap 換字，排完要換回來', 'swap → perm → swap');
  // 10. 共 n! 種輸出；也能用迴圈，但要排除重複
  await step(tok);
  ok('n 個字 → n! 種，每種印 n 個字 → O(n·n!)', 0, 6.5, 0);
  note('不用遞迴：n 層 for 迴圈，跳過重複的字（也可以，只是不好寫）', 0, -0.6, 4.2);
  say('同一題可以有不同解法', '排列總數 n!');
}]);

// ══ 第 17 課：遞迴的堆疊空間成本 ══
FRAG.push(['c1-recursion-space', '遞迴的堆疊空間：16 bytes 變 16n', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.2, 0]);
  // 1. 迴圈版：幾個變數，固定 24 bytes
  await step(tok);
  zone('迴圈版 sum(list, n)', -4.0, 0, 0.5, 5.2, 3.6, '#dfe0ee');
  const vs = [['list', 'ptr'], ['n', 10], ['i', 0], ['sum', 0]].map(([nm, v], k) => buddy(nm, v, C_BLUE, -5.7 + k * 1.15, 0, 0.6, 0.6));
  ok('約 24 bytes：n 多大都一樣 → O(1)', -4.0, 2.3, 1.6);
  say('迴圈版：變數個數固定', '空間 24 bytes → O(1)');
  // 2. 遞迴版：看起來只要 16 bytes？
  await step(tok);
  zone('遞迴版 rsum(list, n)', 3.4, 0, 0.5, 5.6, 3.6, '#cfe3d4');
  code(['rsum(list, n):', '  if (n == 0) return 0;', '  return rsum(list, n-1) + list[n-1];'], 3.4, 7.4, 0.5, -1.8);
  const frames = [];
  const push = (k) => { const f = cube('rsum(n=' + k + ')  16 B', k === 10 ? C_ORNG : '#f5c99a', [2.6, 0.4, 1.4], 3.4, 0.25 + frames.length * 0.45, 0.6); frames.push(f); return f; };
  push(10);
  const me = buddy('', '?', C_ORNG, 6.2, 0, 1.6, 0.6); me.mood('wow');
  note('只有 list、n、回傳值 → 好像只要 16 bytes？', 3.4, -0.5, 2.8);
  say('遞迴版看起來比較省？', '16 B < 24 B ？');
  // 3. 10 號任務還沒做完，先擱在一邊
  await step(tok);
  const wait = tag('10 號：等 9 號的答案…', 'say', 0.0, 0.3, 1.6);
  push(9);
  say('10 號還沒做完，先擱一邊', 'rsum(10) 等 rsum(9)');
  // 4. 一路疊上去：呼叫堆疊
  await step(tok);
  for (let k = 8; k >= 0; k--) { push(k); await anim(tok, 160, () => {}); }
  const st = tag('呼叫堆疊（call stack）：每層都還在等', 'ptr', 3.4, 5.6, 0.6);
  me.mood('sad');
  say('每一層都占著自己的 16 B', '10, 9, 8, …, 1, 0 全部疊著');
  // 5. 算一算：16 × n
  await step(tok);
  ok('16 B × 10 層 ≈ 160 B，一般是 16n → O(n)', 3.4, 6.3, 0.6);
  say('真正的空間：16n', 'n = 10 → 約 160 bytes');
  // 6. 回程：從上往下一層層拆掉
  await step(tok);
  for (let k = frames.length - 1; k >= 2; k--) { kill(frames[k]); frames.length = k; await anim(tok, 140, () => {}); }
  remove(st);
  const chip = tag('前 9 個的和 = 5566', 'pkt', 6.0, 1.2, 0.6);
  await travel(tok, chip, V3(6.0, 1.2, 0.6), V3(3.4, 0.9, 1.4), 700);
  kill(frames[1]); frames.length = 1;
  chip.element.textContent = '5566 + list[9]=3 → 5569';
  wait.element.textContent = '10 號：終於做完！';
  me.mood('happy'); await me.hop(tok);
  say('答案一層層傳回來才能算完', '5566 + 3 = 5569');
  // 7. 比一比
  await step(tok);
  vs.forEach((b) => b.mood('happy'));
  note('n = 10：24 B vs 160 B　n = 1000：24 B vs 16000 B', 0, 4.6, -1.2);
  say('n 越大，遞迴越吃空間', '迴圈 O(1)　遞迴 O(n)');
  // 8. 考試重點：遞迴空間 = 每層 × 深度
  await step(tok);
  note('遞迴空間 = 每層大小 × 最深幾層', -4.0, 3.6, 0.5);
  note('二分搜尋：深度 log n → O(log n)', -4.0, 3.0, 0.5);
  say('空間 = 每層 × 深度', 'tail recursion 有機會省掉');
}]);

// ══ 第 18 課：遞迴關係式 T(n) ══
FRAG.push(['c1-recurrence-relations', '遞迴關係式：把遞迴寫成 T(n)', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.0, 0]);
  // 1. T(n) 是什麼
  await step(tok);
  const tn = buddy('T(n)', '時間', C_BLUE, -4.5, 0, 0.5, 1.0);
  const box = prop('parcel', -4.5, 0, 2.0, 0.9, 'n 筆資料');
  bob(box, 0.05);
  say('T(n)：處理 n 筆要花的時間', 'T = Time，n = 輸入大小');
  // 2. 遞迴關係式 = 用小一號的自己來描述自己
  await step(tok);
  const small = buddy('T(n−1)', '時間', '#a9cff3', -1.0, 0, 0.5, 0.75);
  arrow(V3(-3.7, 0.6, 0.5), V3(-1.7, 0.5, 0.5), 0x6e5f49);
  note('高中遞迴數列：a₁ = 1，aₙ = aₙ₋₁ + 2', -2.8, 2.6, 0.5);
  say('大問題 = 小問題 + 多做的', 'T(n) = T(n−1) + c，T(0) = c');
  // 3. 寫 T(n) 的三個問題
  await step(tok);
  note('① 自己呼叫自己幾次？→ 前面放幾個 T', 3.6, 3.6, 0);
  note('② 每次問題變多小？→ n−1 還是 n/2', 3.6, 2.8, 0);
  note('③ 呼叫以外還做多少事？→ ＋c 或 ＋n', 3.6, 2.0, 0);
  say('寫 T(n) 只要問三件事', '幾次？多小？多做多少？');
  // 4. rsum：一路代換下去
  await step(tok);
  const ex = code(['T(n) = T(n−1) + c', '     = T(n−2) + 2c', '     = T(n−k) + kc', '     = T(0) + nc  → O(n)'], 3.6, 0.9, 0.48, 1.2);
  for (let i = 0; i < 4; i++) { ex.hl(i); await anim(tok, 350, () => {}); }
  tn.mood('happy');
  say('rsum：展開到 T(0) 為止', 'T(n) = c(n+1) → O(n)');
  // 5. 二分搜尋：一次呼叫、範圍一半、多做 1 次比較
  await step(tok);
  fresh([0, 6.5, 12], [0, 2.0, 0]);
  const sizes = [16, 8, 4, 2, 1];
  const bx = sizes.map((s, i) => cube(s, i ? '#e7e2d8' : C_CELL, [0.5 + s * 0.09, 0.7, 1.0], -5.0 + i * 2.2, 0.35, 0));
  for (let i = 1; i < 5; i++) P.tint(bx[i], '#efebe4');
  const cnt = buddy('比較次數', 0, C_ORNG, -5.6, 0, 2.6, 0.7);
  code(['binsearch：只呼叫自己 1 次（左半或右半）', '範圍變一半，外面只做 1 次比較', 'T(n) = T(n/2) + 1，T(1) = 1'], 1.2, 4.6, 0.5, -1.2);
  say('二分搜尋的 T(n)', 'T(n) = T(n/2) + 1');
  // 6. 反覆代換
  await step(tok);
  const ex2 = code(['T(n) = T(n/2) + 1', '     = T(n/4) + 2', '     = T(n/8) + 3', '     = T(n/2ᵏ) + k'], 4.2, 3.0, 0.48, 1.0);
  for (let i = 1; i < 5; i++) {
    ex2.hl(Math.min(i - 1, 3)); P.tint(bx[i], C_CELL); cnt.set(i);
    const c = tag('+1', 'pkt', -5.0 + (i - 1) * 2.2, 1.2, 0);
    await travel(tok, c, V3(-5.0 + (i - 1) * 2.2, 1.2, 0), V3(-5.0 + i * 2.2, 1.2, 0), 350); remove(c);
  }
  say('每砍一半就 +1', 'T(n) = T(n/2ᵏ) + k');
  // 7. 什麼時候停：n/2ᵏ = 1
  await step(tok);
  cnt.set(5); cnt.mood('happy'); await cnt.hop(tok);
  ok('n/2ᵏ = 1 → k = log₂n → T(n) = log₂n + 1', 0, -0.4, 1.8);
  note('n = 16：4 次砍半 + 1 = 5　n = 1024：11', 0, 5.6, -1.2);
  say('停在 n/2ᵏ = 1', 'T(n) = log₂n + 1 → O(log n)');
  // 8. 合併排序：兩次呼叫、各一半、合併要 n
  await step(tok);
  fresh([0, 6.5, 12], [0, 2.0, 0]);
  const whole = cube('8 筆', C_CELL, [3.2, 0.6, 1.0], -3.5, 4.2, 0);
  const h1 = cube('4 筆', C_GRN, [1.6, 0.6, 1.0], -4.5, 2.6, 0), h2 = cube('4 筆', C_GRN, [1.6, 0.6, 1.0], -2.5, 2.6, 0);
  P.line(-3.5, 3.9, -4.5, 2.9, 0); P.line(-3.5, 3.9, -2.5, 2.9, 0);
  const mg = buddy('合併工', 'n', C_ORNG, -3.5, 0, 1.4, 0.7);
  tag('兩半各自遞迴排好 → 2T(n/2)', 'say', -3.5, 1.8, -1.0);
  tag('再一個一個比、合成一排 → 約 n 步', 'say', -3.5, -0.6, 2.4);
  say('合併排序：切兩半、各自排、合併', 'T(n) = 2T(n/2) + n');
  // 9. 代換
  await step(tok);
  const ex3 = code(['T(n) = 2T(n/2) + n', '     = 2[2T(n/4) + n/2] + n = 4T(n/4) + 2n', '     = 8T(n/8) + 3n', '     = 2ᵏ T(n/2ᵏ) + k·n'], 3.0, 4.4, 0.5, 0);
  for (let i = 0; i < 4; i++) { ex3.hl(i); await anim(tok, 400, () => {}); }
  say('每代換一次就多一個 n', '2ᵏ T(n/2ᵏ) + k·n');
  // 10. k = log₂n
  await step(tok);
  ok('k = log₂n：T(n) = n·T(1) + n·log₂n → O(n log n)', 2.4, 1.6, 0);
  note('n = 8：8·1 + 8·3 = 32', 2.4, 0.8, 0.6);
  mg.mood('happy'); await mg.hop(tok);
  say('合併排序 = O(n log n)', 'T(n) = n + n log₂n');
  // 11. 陷阱：n−1 和 n/2 差很多
  await step(tok);
  fresh([0, 6.5, 12], [0, 2.4, 0]);
  const bars = [['T(n/2)+1', 'log n ≈ 4', 0.5, C_GRN], ['2T(n/2)+n', 'n log n ≈ 33', 1.6, C_BLUE], ['2T(n−1)+1', '2ⁿ − 1 = 1023', 5.2, '#e88c8c']];
  bars.forEach(([f, v, h, c], i) => {
    const x = -4 + i * 4; const b = cube('', c, [1.6, 0.05, 1.6], x, 0.03, 0);
    tag(f, 'ptr', x, -0.6, 1.2); const vl = tag(v, 'say', x, 0.6, 1.0);
    bars[i].push(b, vl);
  });
  await anim(tok, 1200, (u) => bars.forEach(([, , h, , b, vl]) => { b.scale.y = Math.max(1, u * h / 0.05); b.position.y = (u * h) / 2 + 0.03; vl.position.y = u * h + 0.4; }));
  note('n = 10 時的步數', 0, -1.3, 1.2);
  say('呼叫兩次又只少 1 → 爆炸', 'T(n) = 2T(n−1) + 1 → O(2ⁿ)');
  // 12. 常見陷阱整理
  await step(tok);
  note('T(n) = T(n−1) + n → n + (n−1) + … + 1 = n(n+1)/2 → O(n²)', 0, 7.2, -1.0);
  note('T(1) 是幾都沒關係；先假設 n = 2ᵏ 好算', 0, 6.6, -1.0);
  say('陷阱：看清楚是減 1 還是除 2', '外面多做 n → 加總起來');
}]);

// ══ 第 19 課：遞迴樹 ══
FRAG.push(['c1-recursion-tree', '遞迴樹：一層一層加起來', async (tok) => {
  fresh([0, 5.5, 13], [0, 3.0, 0]);
  const Y = [6.4, 4.8, 3.2, 1.6];
  const XS = [[0], [-3, 3], [-4.5, -1.5, 1.5, 4.5], [-5.25, -3.75, -2.25, -0.75, 0.75, 2.25, 3.75, 5.25]];
  const T1 = ['n', 'n/2', 'n/4', 'n/8'];
  const lv = [];
  const sums = [];
  const level = (d, labels, color) => {
    lv[d] = XS[d].map((x, i) => tnode(labels[i] !== undefined ? labels[i] : labels[0], x, Y[d], d ? lv[d - 1][Math.floor(i / 2)] : null, color, d === 3 ? 1.1 : 1.2));
  };
  // 1. 遞迴樹是什麼
  await step(tok);
  level(0, ['n'], C_BLUE);
  tag('T(n)：這次呼叫自己做 n 的工（不含小孩）', 'say', 0, 7.4, 0);
  say('把每次呼叫畫成一個節點', 'T(n) = 2T(n/2) + n');
  // 2. 它叫了兩個小孩
  await step(tok);
  level(1, ['n/2'], C_CELL);
  say('呼叫兩次，每個處理 n/2', '小孩各做 n/2 的工');
  // 3. 每層加總
  await step(tok);
  sums[0] = ok('= n', 6.6, Y[0], 0);
  sums[1] = ok('= n', 6.6, Y[1], 0);
  level(2, ['n/4'], C_CELL);
  sums[2] = ok('= n', 6.6, Y[2], 0);
  say('一層一層橫著加', 'n/2 + n/2 = n，4 × n/4 = n');
  // 4. 第 i 層
  await step(tok);
  level(3, ['n/8'], C_CELL);
  sums[3] = ok('= n', 6.6, Y[3], 0);
  const ni = note('第 i 層：2ⁱ 個 × n/2ⁱ = n', 0, 0.5, 1.6);
  say('每一層都剛好是 n', '2ⁱ × n/2ⁱ = n');
  // 5. 幾層
  await step(tok);
  arrow(V3(-6.6, Y[0], 0), V3(-6.6, Y[3] - 0.3, 0), 0xa8730f);
  const depth = tag('log₂n + 1 層', 'ptr', -6.2, 4.0, 1.0);
  say('砍到 1 要 log₂n 次', 'n → n/2 → … → 1');
  // 6. 總和
  await step(tok);
  ok('總共 = n × (log₂n + 1) → O(n log n)', 0, -0.4, 2.2);
  ni.element.textContent = 'n = 8：每層 8，共 4 層 = 32（和代換法一樣）';
  say('每層 n × 層數', 'O(n log n)');
  // 7. 換一題：T(n) = 2T(n/2) + 1
  await step(tok);
  lv.forEach((row) => row.forEach((m) => { P.relabel(m, '1'); P.tint(m, C_GRN); }));
  ['= 1', '= 2', '= 4', '= 8'].forEach((t, i) => { sums[i].element.textContent = t; });
  say('換一題：每個節點只做 1', 'T(n) = 2T(n/2) + 1');
  // 8. 越往下越多 → 葉子贏
  await step(tok);
  lv[3].forEach((m) => glow(m, '#0f5a3a'));
  ok('1 + 2 + 4 + … + n = 2n − 1 → O(n)', 0, -1.0, 2.2);
  say('越往下越重，葉子決定', '總和 ≈ 2n → O(n)');
  // 9. 第三題：3T(n/4) + n²
  await step(tok);
  fresh([0, 5.5, 13], [0, 3.0, 0]);
  const r3 = tnode('n²', 0, 6.4, null, C_ORNG, 1.2);
  const l1 = [-4, 0, 4].map((x) => tnode('(n/4)²', x, 4.6, r3, C_CELL, 1.5));
  ok('= n²', 6.4, 6.4, 0); ok('= 3n²/16', 6.2, 4.6, 0);
  const f3 = tag('T(n) = 3T(n/4) + n²', 'say', 0, 7.5, 0);
  say('三個小孩，各處理 n/4', '第 1 層：3 × (n/4)² = 3n²/16');
  // 10. 第 2 層
  await step(tok);
  const l2 = [];
  l1.forEach((p, j) => [-1.2, 0, 1.2].forEach((dx) => l2.push(tnode('', p.position.x + dx, 2.8, p, '#efe6d6', 0.9))));
  ok('= 9n²/256', 6.2, 2.8, 0);
  note('第 i 層 = (3/16)ⁱ · n²：越往下越輕', 0, 1.6, 1.6);
  say('每層乘上 3/16', '(3/16)ⁱ · n²');
  // 11. 樹根贏
  await step(tok);
  glow(r3, '#7a3a00');
  ok('n² (1 + 3/16 + (3/16)² + …) ≤ (16/13) n² → O(n²)', 0, 0.4, 2.2);
  say('越往下越輕，樹根決定', 'O(n²)');
  // 12. 三種形狀
  await step(tok);
  const kinds = [['每層一樣', 'f × log n', C_BLUE], ['越來越重', '葉子 n^(log_b a)', C_GRN], ['越來越輕', '樹根 f(n)', C_ORNG]];
  kinds.forEach(([a, b, c], i) => { const k = buddy(a, b, c, -4.5 + i * 4.5, -1.6, 3.6, 0.6); k.mood(i ? 'happy' : 'calm'); });
  say('三種樹形，就是 Master 的三種情況', '一樣／葉子贏／樹根贏');
  // 13. 陷阱
  await step(tok);
  remove(f3);
  note('層數用 log 的底 b：n/4 → log₄n 層；葉子數 = a^(log_b n) = n^(log_b a)', 0, 7.7, -1.0);
  note('不平均：T(n/3)+T(2n/3)+n → 每層 ≤ n，最深 log₃/₂ n 層 → O(n log n)', 0, 7.1, -1.0);
  say('陷阱：log 的底與不平均的樹', '葉子數 = n^(log_b a)');
}]);

// ══ 第 20 課：Master Theorem ══
FRAG.push(['c1-master-theorem', 'Master Theorem：樹根 vs 葉子拔河', async (tok) => {
  fresh([0, 6.0, 12.5], [0, 2.4, 0]);
  // 1. 公式長相
  await step(tok);
  tag('T(n) = a·T(n/b) + f(n)', 'ptr', 1.8, 6.0, -1.0);
  const big = cube('n', C_CELL, [1.8, 0.7, 1.0], -4.6, 4.6, -1.0);
  const pcs = [-5.6, -4.6, -3.6].map((x) => cube('n/b', C_GRN, [0.8, 0.5, 0.8], x, 3.3, -1.0));
  pcs.forEach((p) => P.line(-4.6, 4.25, p.position.x, 3.55, -1.0));
  const abf = [note('a：切成幾個小問題（a ≥ 1）', 1.8, 5.2, -1.0), note('b：每個小問題變成 1/b 大（b > 1）', 1.8, 4.5, -1.0), note('f(n)：切開＋合併，遞迴以外做的工', 1.8, 3.8, -1.0)];
  say('主定理只解這一種形狀', 'T(n) = aT(n/b) + f(n)');
  // 2. 拔河：樹根 f(n) vs 葉子 n^(log_b a)
  await step(tok);
  const rope = cube('', '#c8a165', [6.0, 0.1, 0.1], 0, 0.6, 2.2);
  const flag = tag('▼', 'pkt', 0, 1.0, 2.2);
  const rootB = buddy('樹根 f(n)', 'f(n)', C_ORNG, -3.8, 0, 2.2, 0.85);
  const leafB = buddy('葉子 n^(log_b a)', 'n^(log_b a)', C_GRN, 3.8, 0, 2.2, 0.85);
  rootB.look(1); leafB.look(-1);
  say('樹根 vs 葉子：誰大誰贏', '誰大誰決定答案');
  let off = 0;
  const pull = async (to) => {
    const from = off;
    await anim(tok, 900, (u) => {
      off = from + (to - from) * u;
      rope.position.x = off; flag.position.x = off;
      rootB.g.position.x = -3.8 + off; leafB.g.position.x = 3.8 + off;
    });
  };
  // 3. 怎麼算 log_b a
  await step(tok);
  const lg = code(['log_b a = 「b 的幾次方等於 a」', 'log₂8 = 3　log₂4 = 2', 'log₂2 = 1　log₂1 = 0', 'log₄3 ≈ 0.79'], -4.6, 7.4, 0.45, -1.0);
  say('先算 log_b a', 'b^? = a');
  // 4. Case 1：葉子大
  await step(tok);
  leafB.set('n³'); rootB.set('n²');
  await pull(1.6);
  leafB.mood('happy'); rootB.mood('sad');
  const c1 = ok('Case 1：f(n) 小一個 n^ε → Θ(n^(log_b a))', 0, -0.6, 3.2);
  say('Case 1：葉子贏', 'f(n) = O(n^(log_b a − ε))');
  // 5. Case 1 例題
  await step(tok);
  const ex = tag('8T(n/2) + n²：a=8, b=2 → log₂8 = 3 → n² 比 n³ 小 → Θ(n³)', 'say', 0, -1.3, 3.2);
  say('例：8T(n/2) + n²', 'Θ(n³)');
  // 6. Case 2：平手
  await step(tok);
  remove(c1);
  leafB.set('n'); rootB.set('n');
  await pull(0);
  leafB.mood('calm'); rootB.mood('calm');
  const c2 = ok('Case 2：一樣大 → Θ(n^(log_b a) · log n)', 0, -0.6, 3.2);
  say('Case 2：平手 → 多乘 log n', 'f(n) = Θ(n^(log_b a))');
  // 7. Case 2 例題
  await step(tok);
  ex.element.textContent = '2T(n/2)+n：n¹ vs n → Θ(n log n)　T(n/2)+1：n⁰=1 vs 1 → Θ(log n)';
  say('例：合併排序、二分搜尋', 'Θ(n log n)、Θ(log n)');
  // 8. Case 3：樹根大，還要檢查 regularity
  await step(tok);
  remove(c2);
  leafB.set('n^0.79'); rootB.set('n²');
  await pull(-1.6);
  rootB.mood('happy'); leafB.mood('sad');
  ok('Case 3：f(n) 大一個 n^ε，且 a·f(n/b) ≤ c·f(n)（c < 1）→ Θ(f(n))', 0, -0.6, 3.2);
  say('Case 3：樹根贏，但要多檢查一條', 'regularity：a·f(n/b) ≤ c·f(n)');
  // 9. Case 3 例題
  await step(tok);
  ex.element.textContent = '3T(n/4)+n²：log₄3≈0.79，n² 大；3·(n/4)² = (3/16)n² ✓ → Θ(n²)';
  say('例：3T(n/4) + n²', 'c = 3/16 < 1 → Θ(n²)');
  // 10. 速練：同一個 4T(n/2)
  await step(tok);
  lg.ls.forEach(kill);
  const drill = code(['4T(n/2) + n　 → n² 比 n 大 → Case 1 → Θ(n²)', '4T(n/2) + n² → 一樣 → Case 2 → Θ(n² log n)', '4T(n/2) + n³ → n³ 大 → Case 3 → Θ(n³)'], 0, 7.6, 0.5, -2.4);
  await pull(0);
  rootB.mood('calm'); leafB.mood('calm');
  for (let i = 0; i < 3; i++) { drill.hl(i); await anim(tok, 500, () => {}); }
  say('速練：log₂4 = 2，比 n²', '三題三種情況');
  // 11. 陷阱 A：只差 log，不能套
  await step(tok);
  abf.forEach(remove);
  const trapA = [no('2T(n/2) + n log n：只大一個 log，不是 n^ε → 基本三情況都不符', 1.0, 5.2, -1.0), no('2T(n/2) + n / log n：只小一個 log → 也不能套', 1.0, 4.5, -1.0)];
  rootB.mood('wow'); leafB.mood('wow');
  say('陷阱：差距只有 log 不算數', '要差 n^ε（多項式）才行');
  // 12. 陷阱 B：形狀不對
  await step(tok);
  no('T(n−1)+n（減不是除）、T(n/3)+T(2n/3)+n（不平均）、2ⁿT(n/2)（a 不是常數）', 0, -2.1, 3.2);
  note('→ 改用代換法或遞迴樹', 0, -2.8, 3.2);
  say('陷阱：不是 aT(n/b) 的形狀', '改用代換法／遞迴樹');
  // 13. regularity condition
  await step(tok);
  trapA.forEach(remove);
  note('Case 3 一定要寫出 regularity 檢查：f(n) = nᵏ 這種多項式一定會過', 1.0, 5.0, -1.0);
  rootB.mood('happy'); leafB.mood('happy');
  say('三步驟：算、比、選情況', 'Case 3 記得驗 regularity');
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
