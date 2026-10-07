// 離散數學 第4章：遞推關係（建立遞迴式、迭代代換、Tower of Hanoi、Fibonacci、
// 線性齊次：特徵根（相異／重根）、非齊次：particular solution、生成函數入門）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen 8.1–8.2、8.4（特徵方程 r² − c₁r − c₂ = 0；F(n) = 多項式 × sⁿ 的試解規則）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, say, beat } = ctx;
  const on = (id, fn) => ctx.on(id, () => { Promise.resolve().then(fn).catch((e) => { if (!/mode changed/.test(String(e && e.message))) console.error(e); }); });
  let timer = null;
  let epoch = 0; // 換模式／重進模式就 +1，讓還在跑的互動動畫自己停下
  const stopTimer = () => { clearInterval(timer); timer = null; epoch++; };
  let busy = false;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
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
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  function line(x1, y1, z1, x2, y2, z2, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  const W = (tok) => { const e = epoch; return async (ms) => { if (tok !== undefined) return beat(tok, ms); await sleep(Math.min(ms, 260)); if (e !== epoch) throw new Error('mode changed'); }; };
  async function anim(w, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  const minus = (s) => String(s).replace(/-/g, '−');
  function frac(x) {
    if (!isFinite(x)) return '∞';
    if (Math.abs(x - Math.round(x)) < 1e-9) return minus(Math.round(x));
    for (let d = 2; d <= 60; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return (n < 0 ? '−' : '') + Math.abs(n) + '/' + d; }
    return minus(x.toFixed(3));
  }
  const tidy = (t) => t.replace(/\+ −/g, '− ').replace(/(^|[^\d./])1n/g, '$1n');
  const fmt = (v) => (Math.abs(v) >= 1e6 ? minus(v.toExponential(2)) : Math.abs(v - Math.round(v)) < 1e-9 ? minus(Math.round(v)) : minus(v.toFixed(2)));

  // 一排長條：baseline 以上是正、以下是負；每次重畫時會依最大值重新縮放
  function makeBars(n, opt = {}) {
    const dx = opt.dx || Math.min(1.3, 12 / n), x0 = opt.x0 === undefined ? -(n - 1) / 2 * dx : opt.x0, z = opt.z || 0;
    const base = opt.base === undefined ? 0 : opt.base, H = opt.H || 5;
    const bars = [], vals = [], lbl = [], idx = [];
    for (let i = 0; i < n; i++) {
      const m = lab.box(opt.color || '#4b9ee2', [dx * (opt.w || 0.7), 1, opt.d || 0.7]);
      m.scale.y = 0.001; m.position.set(x0 + i * dx, base, z); m.visible = false;
      lab.world.add(m); bars.push(m);
      lbl.push(tag('', 'idx', x0 + i * dx, base + 0.3, z));
      if (opt.names) idx.push(tag(opt.names(i), 'idx', x0 + i * dx, base - 0.35, z + 0.7));
    }
    const B = {
      bars, vals, lbl, X: (i) => x0 + i * dx,
      scaleMax: opt.fixedMax || 0,
      set(i, v, color) { vals[i] = v; bars[i].visible = true; if (color) tint(bars[i], color); B.layout(); },
      layout() {
        const mx = B.scaleMax || Math.max(1e-9, ...vals.filter((v) => v !== undefined).map(Math.abs));
        vals.forEach((v, i) => {
          if (v === undefined) return;
          const h = Math.max(0.03, Math.abs(v) / mx * H);
          bars[i].scale.y = h; bars[i].position.y = base + (v >= 0 ? h / 2 : -h / 2);
          lbl[i].position.y = base + (v >= 0 ? h + 0.3 : -h - 0.3);
          txt(lbl[i], fmt(v));
        });
      },
    };
    return B;
  }

  // ───────────────────────── Mode 1：遞迴展開 ─────────────────────────
  const RECS = {
    arith: { name: 'aₙ = aₙ₋₁ + 3，a₀ = 2', start: 0, init: [2], next: (a, n) => a[n - 1] + 3, deps: [1], closed: 'aₙ = 2 + 3n', cf: (n) => 2 + 3 * n },
    tri: { name: 'T(n) = T(n−1) + n，T(1) = 1', start: 1, init: [1], next: (a, n) => a[n - 1] + n, deps: [1], closed: 'T(n) = n(n+1)/2', cf: (n) => n * (n + 1) / 2 },
    geo: { name: 'aₙ = 2aₙ₋₁，a₀ = 1', start: 0, init: [1], next: (a, n) => 2 * a[n - 1], deps: [1], closed: 'aₙ = 2ⁿ', cf: (n) => Math.pow(2, n) },
    interest: { name: 'Pₙ = 1.11 Pₙ₋₁，P₀ = 10000', start: 0, init: [10000], next: (a, n) => 1.11 * a[n - 1], deps: [1], closed: 'Pₙ = 10000 · 1.11ⁿ', cf: (n) => 10000 * Math.pow(1.11, n) },
    hanoi: { name: 'Hₙ = 2Hₙ₋₁ + 1，H₁ = 1', start: 1, init: [1], next: (a, n) => 2 * a[n - 1] + 1, deps: [1], closed: 'Hₙ = 2ⁿ − 1', cf: (n) => Math.pow(2, n) - 1 },
    fib: { name: 'fₙ = fₙ₋₁ + fₙ₋₂，f₁ = f₂ = 1', start: 1, init: [1, 1], next: (a, n) => a[n - 1] + a[n - 2], deps: [1, 2], closed: 'fₙ = (φⁿ − ψⁿ)/√5', cf: (n) => (Math.pow((1 + Math.sqrt(5)) / 2, n) - Math.pow((1 - Math.sqrt(5)) / 2, n)) / Math.sqrt(5) },
    no00: { name: '沒有 00 的 bit string：aₙ = aₙ₋₁ + aₙ₋₂，a₁ = 2，a₂ = 3', start: 1, init: [2, 3], next: (a, n) => a[n - 1] + a[n - 2], deps: [1, 2], closed: 'aₙ = fₙ₊₂', cf: null },
    r3: { name: 'aₙ = aₙ₋₁ + 2aₙ₋₂，a₀ = 2，a₁ = 7', start: 0, init: [2, 7], next: (a, n) => a[n - 1] + 2 * a[n - 2], deps: [1, 2], closed: 'aₙ = 3·2ⁿ − (−1)ⁿ', cf: (n) => 3 * Math.pow(2, n) - Math.pow(-1, n) },
    r5: { name: 'aₙ = 6aₙ₋₁ − 9aₙ₋₂，a₀ = 1，a₁ = 6', start: 0, init: [1, 6], next: (a, n) => 6 * a[n - 1] - 9 * a[n - 2], deps: [1, 2], closed: 'aₙ = (1 + n)·3ⁿ', cf: (n) => (1 + n) * Math.pow(3, n) },
  };
  const sub = (n) => String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[c] || c).join('');
  const un = { key: 'arith', a: {}, k: 0, B: null, N: 9 };
  function enterUnfold() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4.2, 14], [0, 2.8, 0]);
    const R = RECS[un.key];
    un.a = {}; un.k = 0;
    un.B = makeBars(un.N, { names: (i) => 'n=' + (R.start + i), H: 5.2, base: 0.02 });
    controls('<select id="uR">' + Object.keys(RECS).map((k) => '<option value="' + k + '">' + RECS[k].name + '</option>').join('') + '</select><button class="primary" id="uStep">下一項</button><button id="uAll">全部展開</button><button id="uReset">重來</button>');
    $('uR').value = un.key;
    $('uR').onchange = (e) => { un.key = RECS[e.target.value] ? e.target.value : 'arith'; clearLog(); enterUnfold(); };
    on('uStep', () => unfoldStep());
    on('uAll', async () => { const e = epoch; while (e === epoch && un.k < un.N) { const k0 = un.k; await unfoldStep(); if (un.k === k0) break; } });
    on('uReset', () => { clearLog(); enterUnfold(); });
    log('遞迴關係 = 用前面的項定義下一項；一定要配初始條件（initial conditions）才定得出整個數列。');
    unState();
  }
  async function unfoldStep(tok) {
    if (busy) return;
    if (un.k >= un.N) { log('已經展開 ' + un.N + ' 項；按「重來」或換一個遞迴式。', true); return; }
    busy = true;
    const R = RECS[un.key], w = W(tok), i = un.k, n = R.start + i;
    try {
      let v;
      if (i < R.init.length) { v = R.init[i]; un.B.set(i, v, '#dd8238'); log('初始條件：' + (R.start + i === n ? 'n = ' + n : '') + ' → ' + fmt(v)); if (tok) say('初始條件：第 ' + n + ' 項 = ' + fmt(v), R.name); }
      else {
        R.deps.forEach((d) => glow(un.B.bars[i - d], GOLD));
        await w(tok ? 500 : 120);
        v = R.next(un.a, n);
        un.B.set(i, v, '#4b9ee2');
        const expr = R.deps.length === 1 ? fmt(un.a[n - 1]) : fmt(un.a[n - 1]) + ' 與 ' + fmt(un.a[n - 2]);
        log('n = ' + n + '：由 ' + expr + ' 算出 ' + fmt(v));
        if (tok) say('第 ' + n + ' 項 = ' + fmt(v), '由前 ' + R.deps.length + ' 項算出');
        await w(tok ? 400 : 80);
        R.deps.forEach((d) => glow(un.B.bars[i - d], null));
      }
      un.a[n] = v;
      un.k++;
      await w(tok ? 400 : 40);
    } finally { busy = false; }
    unState();
  }
  function unState() {
    const R = RECS[un.key];
    const last = un.k ? R.start + un.k - 1 : null;
    const ok = last !== null && R.cf ? Math.abs(R.cf(last) - un.a[last]) < 1e-6 * Math.max(1, Math.abs(un.a[last])) : null;
    setState('遞迴展開：' + R.name, [['已展開', un.k + ' / ' + un.N], ['最新', last === null ? '—' : 'n=' + last + ' → ' + fmt(un.a[last])], ['closed form', R.closed]],
      (ok === null ? '' : ok ? '<span class="ok">代入 closed form 也得 ' + fmt(R.cf(last)) + '</span><br>' : '') + '橘色 = 初始條件；藍色 = 由遞迴式算出');
  }

  // ───────────────────────── Mode 2：特徵根 ─────────────────────────
  const ch = { c1: 1, c2: 2, a0: 2, a1: 7 };
  function solveChar(c1, c2, a0, a1) {
    const D = c1 * c1 + 4 * c2;
    if (D < -1e-12) return { kind: 'complex', D };
    if (Math.abs(D) < 1e-12) {
      const r = c1 / 2;
      if (Math.abs(r) < 1e-12) return { kind: 'zero' };
      const al1 = a0, al2 = a1 / r - a0;
      return { kind: 'rep', D, r, al1, al2, f: (n) => (al1 + al2 * n) * Math.pow(r, n), str: tidy('aₙ = (' + frac(al1) + ' + ' + frac(al2) + 'n)·' + rstr(r) + 'ⁿ') };
    }
    const s = Math.sqrt(D), r1 = (c1 + s) / 2, r2 = (c1 - s) / 2;
    const al1 = (a1 - a0 * r2) / (r1 - r2), al2 = a0 - al1;
    const sq = Math.abs(s - Math.round(s)) < 1e-9;
    const rs = (r, sign) => (sq ? rstr(r) : '((' + frac(c1) + (sign > 0 ? ' + ' : ' − ') + '√' + frac(D) + ')/2)');
    return { kind: 'dist', D, r1, r2, al1, al2, sq, f: (n) => al1 * Math.pow(r1, n) + al2 * Math.pow(r2, n), str: tidy('aₙ = ' + frac(al1) + '·' + rs(r1, 1) + 'ⁿ + ' + frac(al2) + '·' + rs(r2, -1) + 'ⁿ'), rs };
  }
  const rstr = (r) => (r < 0 ? '(' + frac(r) + ')' : frac(r));
  // r² − c₁r − c₂ 寫成正常的正負號
  const term = (c, v) => (c === 0 ? '' : (c > 0 ? ' + ' : ' − ') + (Math.abs(c) === 1 && v ? '' : frac(Math.abs(c))) + v);
  const charEq = (c1, c2) => 'r²' + term(-c1, 'r') + term(-c2, '') + ' = 0';
  function enterChar() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 5, 14.5], [0, 2.6, 0]);
    controls('aₙ = <input id="kC1" type="number" min="-9" max="9" value="' + ch.c1 + '">aₙ₋₁ + <input id="kC2" type="number" min="-9" max="9" value="' + ch.c2 + '">aₙ₋₂'
      + '<label>a₀ <input id="kA0" type="number" min="-20" max="20" value="' + ch.a0 + '"></label><label>a₁ <input id="kA1" type="number" min="-50" max="50" value="' + ch.a1 + '"></label><button class="primary" id="kGo">求解並驗證</button>');
    const rd = (id, d) => { const v = Math.round(Number($(id).value)); return isFinite(v) ? v : d; };
    ['kC1', 'kC2', 'kA0', 'kA1'].forEach((id) => { $(id).onchange = () => { ch.c1 = Math.max(-9, Math.min(9, rd('kC1', 1))); ch.c2 = Math.max(-9, Math.min(9, rd('kC2', 2))); ch.a0 = Math.max(-20, Math.min(20, rd('kA0', 2))); ch.a1 = Math.max(-50, Math.min(50, rd('kA1', 7))); clearLog(); enterChar(); }; });
    on('kGo', () => charRun());
    // 數線：根畫在 z = 2.6 那條線上
    line(-6, 0.05, 2.6, 6, 0.05, 2.6, '#6e5f49');
    for (let v = -4; v <= 4; v++) tag(minus(v), 'idx', v * 1.3, 0.1, 3.1);
    tag('r', 'idx', 6.2, 0.1, 2.6);
    const S = solveChar(ch.c1, ch.c2, ch.a0, ch.a1);
    log('猜 aₙ = rⁿ 代進去：rⁿ = c₁rⁿ⁻¹ + c₂rⁿ⁻² → r² − c₁r − c₂ = 0（特徵方程）。');
    if (S.kind === 'complex') log('判別式 c₁² + 4c₂ = ' + S.D + ' < 0：複數根，本實驗室只畫實根的情況。', true);
    if (S.kind === 'zero') log('c₁ = c₂ = 0：特徵根 0，數列從第 2 項起全為 0，沒什麼好解。', true);
    chState(S, '');
  }
  function chState(S, msg) {
    const rows = [['特徵方程', charEq(ch.c1, ch.c2)], ['判別式', frac(ch.c1 * ch.c1 + 4 * ch.c2)]];
    if (S.kind === 'dist') rows.push(['根', S.rs(S.r1, 1) + '，' + S.rs(S.r2, -1)], ['α₁, α₂', frac(S.al1) + '，' + frac(S.al2)]);
    if (S.kind === 'rep') rows.push(['重根', rstr(S.r)], ['α₁, α₂', frac(S.al1) + '，' + frac(S.al2)]);
    setState('aₙ = ' + frac(ch.c1) + 'aₙ₋₁ + ' + frac(ch.c2) + 'aₙ₋₂', rows,
      (msg ? msg + '<br>' : '') + (S.kind === 'dist' ? '相異根：aₙ = α₁r₁ⁿ + α₂r₂ⁿ' : S.kind === 'rep' ? '重根：aₙ = (α₁ + α₂n)·rⁿ' : '（複數根／退化）'));
  }
  async function charRun(tok) {
    if (busy) return;
    const S = solveChar(ch.c1, ch.c2, ch.a0, ch.a1);
    if (S.kind === 'complex' || S.kind === 'zero') { log(S.kind === 'complex' ? '複數根：Rosen 的 Theorem 1、4 只處理實根；這組請換數字。' : '退化的情況，換一組。', true); return null; }
    busy = true;
    const w = W(tok);
    try {
      const roots = S.kind === 'rep' ? [S.r] : [S.r1, S.r2];
      for (const r of roots) {
        const x = Math.max(-6, Math.min(6, r * 1.3));
        const m = cube('', '#dd8238', [0.5, 0.5, 0.5], x, 0.3, 2.6, 3);
        glow(m, GOLD);
        tag('r = ' + (S.kind === 'rep' ? rstr(r) + '（重根）' : S.sq ? rstr(r) : r.toFixed(3)), 'ptr alt', x, 1, 2.6);
        if (tok) say('特徵根 r = ' + (S.sq || S.kind === 'rep' ? frac(r) : r.toFixed(3)), S.kind === 'rep' ? '重根：多乘一個 n' : '');
        await w(tok ? 1400 : 100);
      }
      // 遞迴算出來的（藍）vs 公式算出來的（橘），並排
      const N = 7, a = [ch.a0, ch.a1];
      for (let n = 2; n < N; n++) a.push(ch.c1 * a[n - 1] + ch.c2 * a[n - 2]);
      const mx = Math.max(...a.map(Math.abs), 1e-9);
      const B1 = makeBars(N, { color: '#4b9ee2', dx: 1.5, x0: -4.5 - 0.3, H: 2.3, base: 2.6, fixedMax: mx, names: (i) => 'n=' + i, w: 0.35 });
      const B2 = makeBars(N, { color: '#dd8238', dx: 1.5, x0: -4.5 + 0.3, H: 2.3, base: 2.6, fixedMax: mx, w: 0.35 });
      B2.lbl.forEach((l) => (l.visible = false));
      for (let n = 0; n < N; n++) {
        B1.set(n, a[n]); B2.set(n, S.f(n));
        if (tok) say('n = ' + n + '：遞迴 ' + fmt(a[n]) + '，公式 ' + fmt(S.f(n)), S.str);
        await w(tok ? 600 : 60);
      }
      const ok = a.every((v, n) => Math.abs(v - S.f(n)) < 1e-6 * Math.max(1, Math.abs(v)));
      chState(S, (ok ? '<span class="ok">' : '<span class="no">') + S.str + '</span>');
      log(S.str + (ok ? '：和遞迴算出的每一項都相同。' : ''), !ok);
      return S;
    } finally { busy = false; }
  }

  // ───────────────────────── Mode 3：Tower of Hanoi ─────────────────────────
  const hn = { n: 3, pegs: [[], [], []], moves: [], k: 0, ms: {} };
  const PEGX = [-4.2, 0, 4.2];
  function hanoiMoves(n, a, b, c, out) { if (n === 0) return; hanoiMoves(n - 1, a, c, b, out); out.push([n, a, c]); hanoiMoves(n - 1, b, a, c, out); }
  const DCOL = ['#e55a9b', '#dd8238', '#c08a1f', '#2fc092', '#4b9ee2', '#9b7ef4', '#31aab0'];
  function enterHanoi() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 5, 13], [0, 1.6, 0]);
    cube('', '#c9b48e', [12.6, 0.2, 2.6], 0, 0.1, 0);
    PEGX.forEach((x, i) => { cube('', '#8a7a60', [0.18, 3.2, 0.18], x, 1.8, 0); tag(['A（起點）', 'B（暫放）', 'C（終點）'][i], 'idx', x, -0.2, 1.6); });
    hn.pegs = [[], [], []]; hn.ms = {}; hn.k = 0; hn.moves = [];
    hanoiMoves(hn.n, 0, 1, 2, hn.moves);
    for (let d = hn.n; d >= 1; d--) {
      const m = cube(d, DCOL[(d - 1) % DCOL.length], [0.8 + 0.5 * d, 0.4, 1.4], PEGX[0], 0.4 + (hn.n - d) * 0.42, 0);
      hn.ms[d] = m; hn.pegs[0].push(d);
    }
    controls('<label>盤子數 n = <input id="hN" type="number" min="1" max="7" value="' + hn.n + '"></label><button class="primary" id="hStep">下一步</button><button id="hAuto">自動跑完</button><button id="hReset">重來</button>');
    $('hN').onchange = (e) => { hn.n = Math.max(1, Math.min(7, Math.round(Number(e.target.value)) || 3)); clearLog(); enterHanoi(); };
    on('hStep', () => hanoiStep());
    on('hAuto', async () => { const e = epoch; while (e === epoch && hn.k < hn.moves.length) { const k0 = hn.k; await hanoiStep(undefined, true); if (hn.k === k0) break; } });
    on('hReset', () => { clearLog(); enterHanoi(); });
    log('規則：一次搬一個盤子，大盤不能壓在小盤上。');
    log('遞迴想法：n−1 個搬到 B → 最大的搬到 C → n−1 個從 B 搬到 C：Hₙ = 2Hₙ₋₁ + 1。');
    hnState();
  }
  async function hanoiStep(tok, fast) {
    if (busy) return;
    if (hn.k >= hn.moves.length) { log('已經全部搬到 C 了：共 ' + hn.moves.length + ' 步 = 2^' + hn.n + ' − 1。', true); return; }
    busy = true;
    const w = W(tok), [d, from, to] = hn.moves[hn.k], m = hn.ms[d];
    try {
      hn.pegs[from].pop();
      const ms = tok ? (hn.n > 4 ? 140 : 300) : fast ? 90 : 220;
      glow(m, GOLD);
      move(m, PEGX[from], 4.0, 0); await w(ms);
      move(m, PEGX[to], 4.0, 0); await w(ms);
      move(m, PEGX[to], 0.4 + hn.pegs[to].length * 0.42, 0); await w(ms);
      glow(m, null);
      hn.pegs[to].push(d);
      hn.k++;
      if (tok) say('第 ' + hn.k + ' 步：盤子 ' + d + '：' + 'ABC'[from] + ' → ' + 'ABC'[to], '共需 2^' + hn.n + ' − 1 = ' + hn.moves.length + ' 步');
      if (!fast) log('第 ' + hn.k + ' 步：盤子 ' + d + ' 從 ' + 'ABC'[from] + ' 搬到 ' + 'ABC'[to]);
    } finally { busy = false; }
    hnState();
  }
  function hnState() {
    const H = []; for (let i = 1; i <= hn.n; i++) H.push(Math.pow(2, i) - 1);
    setState('Tower of Hanoi（n = ' + hn.n + '）', [['已搬', hn.k + ' / ' + hn.moves.length], ['H₁…H' + sub(hn.n), H.join(', ')]],
      'Hₙ = 2Hₙ₋₁ + 1，H₁ = 1<br>迭代：Hₙ = 2ⁿ⁻¹ + … + 2 + 1 = <span class="ok">2ⁿ − 1</span>');
  }

  // ───────────────────────── Mode 4：非齊次與 particular solution ─────────────────────────
  // aₙ = c·aₙ₋₁ + F(n)，初始條件給 a₁（Rosen 例 10 的寫法）
  const nh = { c: 3, type: 'lin', d: 2, k: 2, a1: 3 };
  function particular(c, type, d, k) {
    if (type === 'const') return c !== 1 ? { f: () => d / (1 - c), s: 'p(n) = ' + frac(d / (1 - c)), why: '試 p(n) = A' } : { f: (n) => d * n, s: tidy('p(n) = ' + frac(d) + 'n'), why: 'c = 1 是特徵根 → 試 p(n) = An' };
    if (type === 'lin') {
      if (c !== 1) { const A = d / (1 - c), B = -c * A / (1 - c); return { f: (n) => A * n + B, s: tidy('p(n) = ' + frac(A) + 'n + ' + frac(B)), why: '試 p(n) = An + B' }; }
      return { f: (n) => d * n * (n + 1) / 2, s: tidy('p(n) = ' + frac(d / 2) + 'n² + ' + frac(d / 2) + 'n'), why: 'c = 1 是特徵根 → 多乘 n：試 n(An + B)' };
    }
    if (k !== c) { const A = d * k / (k - c); return { f: (n) => A * Math.pow(k, n), s: 'p(n) = ' + frac(A) + '·' + rstr(k) + 'ⁿ', why: 's = ' + k + ' 不是特徵根 → 試 A·' + k + 'ⁿ' }; }
    return { f: (n) => d * n * Math.pow(c, n), s: 'p(n) = ' + frac(d) + 'n·' + rstr(c) + 'ⁿ', why: 's = ' + k + ' 是特徵根（重數 1）→ 多乘 n：試 An·' + k + 'ⁿ' };
  }
  const FNAME = (t) => ({ const: 'F(n) = ' + frac(nh.d), lin: 'F(n) = ' + frac(nh.d) + 'n', exp: 'F(n) = ' + frac(nh.d) + '·' + rstr(nh.k) + 'ⁿ' })[t];
  function enterNonHom() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4.6, 15], [0, 3, 0]);
    controls('aₙ = <input id="nC" type="number" min="-4" max="4" value="' + nh.c + '">aₙ₋₁ + <select id="nT"><option value="const">常數 d</option><option value="lin">d·n</option><option value="exp">d·kⁿ</option></select>'
      + '<label>d <input id="nD" type="number" min="-9" max="9" value="' + nh.d + '"></label><label>k <input id="nK" type="number" min="-4" max="4" value="' + nh.k + '"></label><label>a₁ <input id="nA" type="number" min="-20" max="20" value="' + nh.a1 + '"></label><button class="primary" id="nGo">拆成 齊次 + 特解</button>');
    $('nT').value = nh.type;
    const rd = (id, d, lo, hi) => { const v = Math.round(Number($(id).value)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const upd = () => { nh.c = rd('nC', 3, -4, 4); nh.type = ['const', 'lin', 'exp'].includes($('nT').value) ? $('nT').value : 'lin'; nh.d = rd('nD', 2, -9, 9); nh.k = rd('nK', 2, -4, 4); nh.a1 = rd('nA', 3, -20, 20); clearLog(); enterNonHom(); };
    ['nC', 'nT', 'nD', 'nK', 'nA'].forEach((id) => { $(id).onchange = upd; });
    on('nGo', () => nonHomRun());
    tag('紫 = 齊次解 α·cⁿ　綠 = 特解 p(n)　藍 = 兩者相加 = aₙ', 'ptr', 0, 6.9);
    line(-6.2, 3, 0, 6.2, 3, 0, '#c9b48e');
    log('非齊次的解 = 齊次通解 + 一個特解：aₙ = α·cⁿ + p(n)。');
    if (nh.c === 0) log('c = 0：沒有齊次部分，aₙ = F(n)。換一個 c 比較有意思。', true);
    if (nh.type === 'exp' && nh.k === 0) log('k = 0 時 F(n) = 0，就是齊次了。', true);
    nhState(null, '');
  }
  function nhState(sol, msg) {
    setState('aₙ = ' + frac(nh.c) + 'aₙ₋₁ + ' + FNAME(nh.type).slice(7), [['齊次部分', 'α·' + rstr(nh.c) + 'ⁿ'], ['特解', sol ? sol.p.s : '—'], ['α', sol ? frac(sol.alpha) : '—']],
      (msg ? msg + '<br>' : '') + (sol ? sol.p.why : 'F(n) = 多項式 × sⁿ；s 是特徵根時要多乘 nᵐ'));
  }
  async function nonHomRun(tok) {
    if (busy) return null;
    if (nh.c === 0 || (nh.type === 'exp' && nh.k === 0)) { log('這組參數是退化情況，請換一組。', true); return null; }
    busy = true;
    const w = W(tok);
    try {
      const p = particular(nh.c, nh.type, nh.d, nh.k);
      const alpha = (nh.a1 - p.f(1)) / nh.c;
      const F = (n) => (nh.type === 'const' ? nh.d : nh.type === 'lin' ? nh.d * n : nh.d * Math.pow(nh.k, n));
      const N = 6, a = { 1: nh.a1 };
      for (let n = 2; n <= N; n++) a[n] = nh.c * a[n - 1] + F(n);
      const vals = []; for (let n = 1; n <= N; n++) vals.push([alpha * Math.pow(nh.c, n), p.f(n), a[n]]);
      const mx = Math.max(1e-9, ...vals.flat().map(Math.abs));
      const mk = (col, off, names) => makeBars(N, { color: col, dx: 2, x0: -5 + off, H: 2.7, base: 3, fixedMax: mx, w: 0.22, names });
      const BH = mk('#9b7ef4', -0.5), BP = mk('#2fc092', 0), BA = mk('#4b9ee2', 0.5, (i) => 'n=' + (i + 1));
      [BH, BP].forEach((B) => B.lbl.forEach((l) => (l.visible = false)));
      if (tok) say('特解：' + p.s, p.why);
      await w(tok ? 2200 : 100);
      for (let i = 0; i < N; i++) {
        BH.set(i, vals[i][0]); await w(tok ? 250 : 30);
        BP.set(i, vals[i][1]); await w(tok ? 250 : 30);
        BA.set(i, vals[i][2]);
        if (tok) say('n = ' + (i + 1) + '：' + fmt(vals[i][0]) + ' + ' + fmt(vals[i][1]) + ' = ' + fmt(vals[i][2]), '紫 + 綠 = 藍');
        await w(tok ? 650 : 40);
      }
      const sol = { p, alpha };
      const full = tidy('aₙ = ' + frac(alpha) + '·' + rstr(nh.c) + 'ⁿ + ' + p.s.slice(7));
      const ok = vals.every(([h, q, s]) => Math.abs(h + q - s) < 1e-6 * Math.max(1, Math.abs(s)));
      nhState(sol, (ok ? '<span class="ok">' : '<span class="no">') + full + '</span>');
      log(full + '（由 a₁ = ' + nh.a1 + ' 定出 α）', !ok);
      return sol;
    } finally { busy = false; }
  }

  // ───────────────────────── Mode 5：生成函數 ─────────────────────────
  const GF = {
    one: { name: '1/(1 − x)', coef: () => 1, seq: '1, 1, 1, 1, …' },
    sq: { name: '1/(1 − x)²', coef: (k) => k + 1, seq: '1, 2, 3, 4, …' },
    two: { name: '1/(1 − 2x)', coef: (k) => Math.pow(2, k), seq: '1, 2, 4, 8, …' },
    alt: { name: '1/(1 + x)', coef: (k) => (k % 2 ? -1 : 1), seq: '1, −1, 1, −1, …' },
    xs: { name: 'x/(1 − x)²', coef: (k) => k, seq: '0, 1, 2, 3, …' },
    r3: { name: '2/(1 − 3x)', coef: (k) => 2 * Math.pow(3, k), seq: '2, 6, 18, 54, …' },
    fib: { name: 'x/(1 − x − x²)', coef: (k) => { let a = 0, b = 1; for (let i = 0; i < k; i++) [a, b] = [b, a + b]; return a; }, seq: '0, 1, 1, 2, 3, 5, …' },
    binom: { name: '(1 + x)⁵', coef: (k) => (k > 5 ? 0 : [1, 5, 10, 10, 5, 1][k]), seq: 'C(5, k)' },
  };
  const gf = { key: 'one', c: [], B: null, N: 9, hist: [] };
  function enterGF() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4.2, 14], [0, 2.6, 0]);
    gf.c = Array.from({ length: gf.N }, (_, k) => GF[gf.key].coef(k));
    gf.hist = [GF[gf.key].name];
    controls('<select id="gG">' + Object.keys(GF).map((k) => '<option value="' + k + '">' + GF[k].name + '</option>').join('') + '</select><button class="primary" id="gShow">展開係數</button><button id="gX">× x（右移）</button><button id="gS">× 1/(1−x)（部分和）</button><button id="gD">× (1−x)（差分）</button>');
    $('gG').value = gf.key;
    $('gG').onchange = (e) => { gf.key = GF[e.target.value] ? e.target.value : 'one'; clearLog(); enterGF(); };
    on('gShow', () => gfShow());
    on('gX', () => gfOp('x'));
    on('gS', () => gfOp('s'));
    on('gD', () => gfOp('d'));
    gf.B = makeBars(gf.N, { names: (i) => 'x' + (i === 0 ? '⁰' : i === 1 ? '¹' : i === 2 ? '²' : i === 3 ? '³' : '^' + i), H: 4.6, base: 1.4 });
    log('生成函數 G(x) = a₀ + a₁x + a₂x² + …：第 k 根柱子 = xᵏ 的係數 aₖ。');
    gfState();
  }
  async function gfShow(tok) {
    if (busy) return; busy = true;
    const w = W(tok);
    try {
      for (let k = 0; k < gf.N; k++) { gf.B.set(k, gf.c[k], '#4b9ee2'); await w(tok ? 300 : 40); }
    } finally { busy = false; }
    gfState();
  }
  async function gfOp(op, tok) {
    if (busy) return;
    const c = gf.c;
    let n;
    if (op === 'x') { n = [0, ...c.slice(0, gf.N - 1)]; gf.hist.push('× x'); log('乘 x：每一項 aₖxᵏ 變成 aₖxᵏ⁺¹，整排往右移一格，a₀ 變 0。'); }
    else if (op === 's') { n = []; c.reduce((s, v, i) => ((n[i] = s + v), s + v), 0); gf.hist.push('× 1/(1−x)'); log('乘 1/(1−x) = 1 + x + x² + …：新的第 k 項 = a₀ + … + aₖ（部分和）。'); }
    else { n = c.map((v, i) => v - (i ? c[i - 1] : 0)); gf.hist.push('× (1−x)'); log('乘 (1 − x)：新的第 k 項 = aₖ − aₖ₋₁（差分）。'); }
    gf.c = n;
    busy = true;
    try { const w = W(tok); for (let k = 0; k < gf.N; k++) { gf.B.set(k, n[k], op === 'x' ? '#9b7ef4' : op === 's' ? '#2fc092' : '#dd8238'); } await w(tok ? 400 : 60); } finally { busy = false; }
    gfState();
  }
  function gfState() {
    setState('G(x) = ' + gf.hist.join(' '), [['係數', gf.c.slice(0, 7).map(fmt).join(', ') + ', …']],
      '1/(1−x) = Σ xᵏ；1/(1−ax) = Σ aᵏxᵏ<br>× x 右移；× 1/(1−x) 部分和；× (1−x) 差分');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.18) {
      // 隨機挑兩個整數根，造出遞迴式
      let r1 = pick([-3, -2, -1, 1, 2, 3, 4]), r2 = pick([-3, -2, -1, 1, 2, 3, 4]);
      const al1 = pick([1, 2, 3, -1]), al2 = pick([1, 2, -1, -2]);
      const c1 = r1 + r2, c2 = -r1 * r2;
      const a0 = r1 === r2 ? al1 : al1 + al2, a1 = r1 === r2 ? (al1 + al2) * r1 : al1 * r1 + al2 * r2;
      const R = (r) => (r < 0 ? '(' + minus(r) + ')' : String(r));
      const ans = r1 === r2 ? 'aₙ = (' + minus(al1) + ' + ' + minus(al2) + 'n)·' + R(r1) + 'ⁿ' : 'aₙ = ' + minus(al1) + '·' + R(r1) + 'ⁿ + ' + minus(al2) + '·' + R(r2) + 'ⁿ';
      const w1 = r1 === r2 ? 'aₙ = ' + minus(al1) + '·' + R(r1) + 'ⁿ + ' + minus(al2) + '·' + R(r1) + 'ⁿ' : 'aₙ = ' + minus(al2) + '·' + R(r1) + 'ⁿ + ' + minus(al1) + '·' + R(r2) + 'ⁿ';
      const w2 = 'aₙ = ' + minus(al1) + '·' + R(-r1) + 'ⁿ + ' + minus(al2) + '·' + R(-r2) + 'ⁿ';
      const w3 = 'aₙ = ' + minus(a0) + '·' + R(r1) + 'ⁿ';
      const rec = 'aₙ = ' + minus(c1) + 'aₙ₋₁ ' + (c2 < 0 ? '− ' + -c2 : '+ ' + c2) + 'aₙ₋₂';
      const T4 = [ans, w1, w2, w3].map(tidy);
      return { q: rec + '，a₀ = ' + minus(a0) + '，a₁ = ' + minus(a1) + '。解為？', opts: T4, ans: T4[0], why: '特徵方程 ' + charEq(c1, c2) + ' → r = ' + (r1 === r2 ? minus(r1) + '（重根，要多乘 n）' : minus(r1) + '、' + minus(r2)) + '，再用 a₀、a₁ 解 α。注意根的正負號：r² − c₁r − c₂ 的根和係數符號相反。' };
    }
    if (k < 0.32) {
      const n = 2 + Math.floor(Math.random() * 9);
      const v = Math.pow(2, n) - 1;
      return { q: 'Tower of Hanoi 有 ' + n + ' 個盤子，最少要搬幾次？', opts: [v, Math.pow(2, n), 2 * n - 1, n * n].map(String), ans: String(v), why: 'Hₙ = 2Hₙ₋₁ + 1，H₁ = 1 → Hₙ = 2ⁿ − 1 = ' + v + '。' };
    }
    if (k < 0.46) {
      const items = [
        ['F(n) = 3ⁿ，特徵根 3（重根）', 'n²·p·3ⁿ', ['p·3ⁿ', 'n·p·3ⁿ', 'p·n²']],
        ['F(n) = n·3ⁿ，特徵根 3（重根）', 'n²(p₁n + p₀)·3ⁿ', ['(p₁n + p₀)·3ⁿ', 'n(p₁n + p₀)·3ⁿ', 'p·n·3ⁿ']],
        ['F(n) = n²·2ⁿ，特徵根 3（重根）', '(p₂n² + p₁n + p₀)·2ⁿ', ['p·n²·2ⁿ', 'n²(p₂n² + p₁n + p₀)·2ⁿ', '(p₁n + p₀)·2ⁿ']],
        ['F(n) = 5，特徵根 1（單根）', 'n·p', ['p', 'n²·p', 'p·5ⁿ']],
        ['F(n) = 2ⁿ，特徵根 2 與 3', 'n·p·2ⁿ', ['p·2ⁿ', 'n²·p·2ⁿ', 'p·3ⁿ']],
        ['F(n) = n，特徵根 3', 'p₁n + p₀', ['p·n', 'n(p₁n + p₀)', 'p·3ⁿ']],
      ];
      const [s, ans, wr] = pick(items);
      return { q: '非齊次遞迴，' + s + '。particular solution 的試解形式？', opts: [ans, ...wr], ans, why: 'F(n) = (多項式)·sⁿ：試 (同次多項式)·sⁿ；若 s 是重數 m 的特徵根，再乘 nᵐ（Rosen Theorem 6）。' };
    }
    if (k < 0.6) {
      const c = pick([2, 3, 4, 5]), a0 = pick([1, 2, 3]), K = 2 + Math.floor(Math.random() * 3);
      const v = a0 * Math.pow(c, K);
      return { q: '用生成函數解 aₖ = ' + c + 'aₖ₋₁，a₀ = ' + a0 + '。G(x) 與 a' + sub(K) + ' 為？', opts: ['G(x) = ' + a0 + '/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + v, 'G(x) = ' + a0 + '/(1 + ' + c + 'x)，a' + sub(K) + ' = ' + minus(a0 * Math.pow(-c, K)), 'G(x) = 1/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + Math.pow(c, K), 'G(x) = ' + a0 + 'x/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + a0 * Math.pow(c, K - 1)], ans: 'G(x) = ' + a0 + '/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + v, why: 'G(x) − ' + c + 'xG(x) = a₀（k ≥ 1 的項全消掉）→ G = ' + a0 + '/(1 − ' + c + 'x) = Σ ' + a0 + '·' + c + 'ᵏxᵏ。漏掉 a₀ 會得到錯的分子。' };
    }
    if (k < 0.72) {
      const items = [['1/(1 − x)', '1, 1, 1, 1, …'], ['1/(1 − x)²', '1, 2, 3, 4, …'], ['1/(1 + x)', '1, −1, 1, −1, …'], ['x/(1 − x)', '0, 1, 1, 1, …'], ['1/(1 − 2x)', '1, 2, 4, 8, …'], ['1/(1 − x²)', '1, 0, 1, 0, …']];
      const [g, a] = pick(items);
      return { q: 'G(x) = ' + g + ' 對應的數列 a₀, a₁, a₂, … 是？', opts: items.map((it) => it[1]).filter((s) => s !== a).sort(() => Math.random() - 0.5).slice(0, 3).concat([a]), ans: a, why: '由 1/(1 − ax) = Σ aᵏxᵏ 變形：代換 a、乘 x 右移、或平方（係數變成 k + 1）。' };
    }
    if (k < 0.86) {
      const n = 3 + Math.floor(Math.random() * 6);
      const a = [0, 2, 3]; for (let i = 3; i <= n; i++) a[i] = a[i - 1] + a[i - 2];
      return { q: '長度 ' + n + '、不含連續兩個 0 的 bit string 有幾個？', opts: [a[n], a[n - 1], Math.pow(2, n) - a[n], a[n] + 1].map(String), ans: String(a[n]), why: '結尾 1：前面任意合法 n−1 字串；結尾 10：前面合法 n−2 字串 → aₙ = aₙ₋₁ + aₙ₋₂，a₁ = 2，a₂ = 3。' };
    }
    const c = pick([2, 3, 4]), d = pick([1, 2, 3, 5]), a0 = pick([0, 1, 2]);
    const n = 3 + Math.floor(Math.random() * 3);
    let v = a0; for (let i = 1; i <= n; i++) v = c * v + d;
    return { q: 'aₙ = ' + c + 'aₙ₋₁ + ' + d + '，a₀ = ' + a0 + '。a' + sub(n) + ' = ?', opts: [v, v - d, c * v, Math.pow(c, n) * a0 + d].map(String), ans: String(v), why: '直接迭代 ' + n + ' 次；或 特解 p = ' + frac(d / (1 - c)) + '，aₙ = (a₀ − p)·' + c + 'ⁿ + p。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts.map(String))].sort(() => Math.random() - 0.5);
    if (!opts.includes(p.ans)) opts[0] = p.ans;
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

  // ───────────────────────── 場景（課本：Rosen 8.1、8.2、8.4；Grimaldi 10） ─────────────────────────
  async function playUnfold(tok, key, n) { un.key = key; un.N = n || 9; enterUnfold(); controls(''); for (let i = 0; i < un.N; i++) await unfoldStep(tok); un.N = 9; }
  async function scRecDef(tok) {
    say('Rosen：aₙ = aₙ₋₁ + 3，a₀ = 2', '遞迴式 + 初始條件 → 整個數列');
    un.key = 'arith'; un.N = 6; enterUnfold(); controls('');
    await beat(tok, 2400);
    for (let i = 0; i < 6; i++) await unfoldStep(tok);
    say('a₁ = 5，a₂ = 8，a₃ = 11 …', '');
    await beat(tok, 2400);
    say('同一個遞迴式，a₀ 換成 5 就是另一個數列', '初始條件沒寫清楚，後面全錯');
    await beat(tok, 3000);
    un.N = 9;
  }
  async function scIterate(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('迭代（代換）法：一直把 aₙ₋₁ 代進去', 'aₙ = aₙ₋₁ + 3');
    await beat(tok, 2200);
    const rows = ['aₙ = aₙ₋₁ + 3', '   = (aₙ₋₂ + 3) + 3 = aₙ₋₂ + 2·3', '   = aₙ₋₃ + 3·3', '   ⋮', '   = a₀ + n·3 = 2 + 3n'];
    for (let i = 0; i < rows.length; i++) {
      const m = cube(rows[i], i === rows.length - 1 ? '#dd8238' : '#4b9ee2', [7.2, 0.55, 1], -1.4, 6 - i * 0.8, 0, 2.5);
      if (i === rows.length - 1) glow(m, GREEN);
      say(i === 3 ? '看出規律：往回 k 步就加 k 個 3' : rows[i].trim(), '');
      await beat(tok, 1600);
    }
    say('T(n) = T(n−1) + n 也一樣代換', 'T(n) = T(1) + 2 + 3 + … + n = n(n+1)/2');
    await beat(tok, 2200);
    un.key = 'tri'; un.N = 8; enterUnfold(); controls('');
    for (let i = 0; i < 8; i++) await unfoldStep(tok);
    say('1, 3, 6, 10, 15 … = n(n+1)/2', '猜出公式後可用歸納法證明');
    await beat(tok, 2800);
    un.N = 9;
  }
  async function scInterest(tok) {
    say('Rosen：存 10000 元，年利率 11% 複利', 'Pₙ = Pₙ₋₁ + 0.11Pₙ₋₁ = 1.11Pₙ₋₁');
    un.key = 'interest'; un.N = 9; enterUnfold(); controls('');
    await beat(tok, 2600);
    for (let i = 0; i < 9; i++) await unfoldStep(tok);
    say('迭代：Pₙ = 1.11ⁿ · P₀', '30 年後 P₃₀ = 1.11³⁰ × 10000 ≈ 228,922.97');
    await beat(tok, 3200);
  }
  async function scHanoi(tok) {
    hn.n = 3; enterHanoi(); controls('');
    say('Tower of Hanoi：3 個盤子從 A 搬到 C', '一次一個，大的不能壓小的');
    await beat(tok, 2400);
    for (let i = 0; i < 7; i++) {
      if (i === 0) say('先把上面 2 個搬到 B（H₂ = 3 步）', '');
      if (i === 3) { say('最大的盤子 A → C（1 步）', ''); }
      if (i === 4) { say('再把 2 個從 B 搬到 C（H₂ = 3 步）', ''); }
      await hanoiStep(tok);
      await beat(tok, 500);
    }
    say('H₃ = 2H₂ + 1 = 7', 'Hₙ = 2Hₙ₋₁ + 1，H₁ = 1');
    await beat(tok, 2600);
    say('迭代：Hₙ = 2ⁿ⁻¹ + 2ⁿ⁻² + … + 1 = 2ⁿ − 1', '64 個盤子：2⁶⁴ − 1 步，一秒一步要 5000 億年以上');
    await beat(tok, 3400);
  }
  async function scFib(tok) {
    fresh([0, 4.5, 14], [0, 2.4, 0]);
    say('Rosen：兔子對數，出生兩個月後每月生一對', 'fₙ = fₙ₋₁ + fₙ₋₂，f₁ = f₂ = 1');
    await beat(tok, 2800);
    say('這個月的 = 上個月的（都還活著）+ 兩個月前的（都會生）', '');
    await beat(tok, 2600);
    await playUnfold(tok, 'fib', 9);
    say('1, 1, 2, 3, 5, 8, 13, 21, 34', '每一項需要「前兩項」→ 二階遞迴，要兩個初始條件');
    await beat(tok, 3000);
  }
  async function scBitStrings(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    say('Rosen：長度 n、沒有連續 00 的 bit string', 'aₙ = ?');
    await beat(tok, 2400);
    const S = ['010', '011', '101', '110', '111'];
    const ms = S.map((s, i) => cube(s, '#4b9ee2', [1.6, 0.6, 1], -4 + i * 2, 5, 0, 3));
    say('n = 3 共 5 個', '');
    await beat(tok, 2200);
    const end1 = S.filter((s) => s.endsWith('1')), end0 = S.filter((s) => s.endsWith('0'));
    end1.forEach((s) => glow(ms[S.indexOf(s)], GREEN));
    end1.forEach((s, k) => move(ms[S.indexOf(s)], -4.5 + k * 1.9, 3.2, 0));
    end0.forEach((s, k) => move(ms[S.indexOf(s)], 2 + k * 1.9, 3.2, 0));
    tag('結尾 1：前面 n−1 位任意合法 → aₙ₋₁ = 3', 'ptr', -2.6, 4.3);
    tag('結尾 10：前面 n−2 位合法 → aₙ₋₂ = 2', 'ptr alt', 3.4, 2.3);
    say('拆結尾：…1 或 …10', 'a₃ = a₂ + a₁ = 3 + 2 = 5');
    await beat(tok, 3600);
    lab.clear();
    await playUnfold(tok, 'no00', 8);
    say('aₙ = aₙ₋₁ + aₙ₋₂，a₁ = 2，a₂ = 3', '和 Fibonacci 同一個式子，只是初始條件不同 → aₙ = fₙ₊₂');
    await beat(tok, 3200);
  }
  async function scCharIntro(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('線性齊次、常係數：aₙ = c₁aₙ₋₁ + c₂aₙ₋₂', '猜 aₙ = rⁿ');
    await beat(tok, 2600);
    const rows = ['rⁿ = c₁rⁿ⁻¹ + c₂rⁿ⁻²', '兩邊除以 rⁿ⁻²', 'r² − c₁r − c₂ = 0（特徵方程）', '相異根 r₁ ≠ r₂：aₙ = α₁r₁ⁿ + α₂r₂ⁿ', '重根 r₀：aₙ = (α₁ + α₂n)r₀ⁿ', 'α 由初始條件 a₀、a₁ 解出'];
    for (let i = 0; i < rows.length; i++) {
      const m = cube(rows[i], i === 2 ? '#dd8238' : i >= 3 ? '#2fc092' : '#4b9ee2', [7.4, 0.55, 1], 0, 6 - i * 0.82, 0, 2.5);
      if (i === 2) glow(m, GOLD);
      say(rows[i], i === 4 ? '重根時 rⁿ 和 n·rⁿ 都是解' : '');
      await beat(tok, 1800);
    }
    say('解遞迴 ≈ 解常係數微分方程，只是更簡單', '');
    await beat(tok, 2600);
  }
  async function scCharDistinct(tok) {
    Object.assign(ch, { c1: 1, c2: 2, a0: 2, a1: 7 }); enterChar(); controls('');
    say('Rosen 例：aₙ = aₙ₋₁ + 2aₙ₋₂，a₀ = 2，a₁ = 7', '特徵方程 r² − r − 2 = 0');
    await beat(tok, 2800);
    say('(r − 2)(r + 1) = 0 → r = 2、−1', 'aₙ = α₁2ⁿ + α₂(−1)ⁿ');
    await beat(tok, 2400);
    say('a₀：α₁ + α₂ = 2；a₁：2α₁ − α₂ = 7', 'α₁ = 3，α₂ = −1');
    await beat(tok, 2800);
    await charRun(tok);
    say('aₙ = 3·2ⁿ − (−1)ⁿ：藍橘每一根都一樣高', '2, 7, 11, 25, 47 …');
    await beat(tok, 3000);
  }
  async function scBinet(tok) {
    Object.assign(ch, { c1: 1, c2: 1, a0: 0, a1: 1 }); enterChar(); controls('');
    say('Fibonacci：fₙ = fₙ₋₁ + fₙ₋₂，f₀ = 0，f₁ = 1', 'r² − r − 1 = 0');
    await beat(tok, 2600);
    say('r = (1 ± √5)/2：φ ≈ 1.618，ψ ≈ −0.618', '');
    await beat(tok, 2400);
    await charRun(tok);
    say('fₙ = (1/√5)·φⁿ − (1/√5)·ψⁿ', 'α₁ = 1/√5 ≈ 0.447，α₂ = −1/√5');
    await beat(tok, 3000);
    say('|ψ| < 1，ψⁿ → 0：fₙ 是最接近 φⁿ/√5 的整數', '');
    await beat(tok, 2800);
  }
  async function scCharRepeated(tok) {
    Object.assign(ch, { c1: 6, c2: -9, a0: 1, a1: 6 }); enterChar(); controls('');
    say('Rosen 例：aₙ = 6aₙ₋₁ − 9aₙ₋₂，a₀ = 1，a₁ = 6', 'r² − 6r + 9 = (r − 3)² = 0');
    await beat(tok, 2800);
    say('重根 r = 3：只用 α·3ⁿ 湊不出兩個初始條件', '要再加 n·3ⁿ');
    await beat(tok, 2600);
    say('aₙ = (α₁ + α₂n)·3ⁿ；a₀ = α₁ = 1，a₁ = 3(α₁ + α₂) = 6', 'α₂ = 1');
    await beat(tok, 2800);
    await charRun(tok);
    say('aₙ = 3ⁿ + n·3ⁿ = (1 + n)3ⁿ', '1, 6, 27, 108, 405 …');
    await beat(tok, 3000);
  }
  async function scNonHom(tok) {
    Object.assign(nh, { c: 3, type: 'lin', d: 2, k: 2, a1: 3 }); enterNonHom(); controls('');
    say('Rosen 例：aₙ = 3aₙ₋₁ + 2n，a₁ = 3', '齊次部分 aₙ = 3aₙ₋₁ → α·3ⁿ');
    await beat(tok, 2800);
    say('F(n) = 2n 是一次多項式 → 試 pₙ = cn + d', 'cn + d = 3(c(n−1) + d) + 2n → c = −1，d = −3/2');
    await beat(tok, 3000);
    await nonHomRun(tok);
    say('aₙ = −n − 3/2 + α·3ⁿ，a₁ = 3 → α = 11/6', 'aₙ = (11/6)·3ⁿ − n − 3/2');
    await beat(tok, 3200);
  }
  async function scTrial(tok) {
    fresh([0, 4.5, 14.5], [0, 3, 0]);
    say('Rosen 例：aₙ = 6aₙ₋₁ − 9aₙ₋₂ + F(n)', '特徵根 3，重數 2');
    await beat(tok, 2600);
    const rows = [['F(n) = 3ⁿ', 's = 3 是根（重數 2）', 'n²·p₀·3ⁿ', 2], ['F(n) = n·3ⁿ', 's = 3 是根（重數 2）', 'n²(p₁n + p₀)·3ⁿ', 2], ['F(n) = n²·2ⁿ', 's = 2 不是根', '(p₂n² + p₁n + p₀)·2ⁿ', 0], ['F(n) = (n² + 1)·3ⁿ', 's = 3 是根（重數 2）', 'n²(p₂n² + p₁n + p₀)·3ⁿ', 2]];
    for (let i = 0; i < rows.length; i++) {
      const [F, why, trial, m] = rows[i];
      const y = 5.8 - i * 1.3;
      cube(F, '#4b9ee2', [3.2, 0.6, 1], -4.4, y, 0, 2.5);
      await beat(tok, 700);
      const t = cube(trial, m ? '#dd8238' : '#2fc092', [4.6, 0.6, 1], 2.6, y, 0, 2.5);
      if (m) glow(t, GOLD);
      tag(why, 'idx', -1.1, y + 0.55);
      say(F + '：' + why, '試解 ' + trial);
      await beat(tok, 2400);
    }
    say('F(n) = (多項式)·sⁿ → 試同次多項式·sⁿ', 's 是 m 重根就再乘 nᵐ（Rosen Theorem 6）');
    await beat(tok, 3200);
  }
  async function scGFBasic(tok) {
    gf.key = 'one'; enterGF(); controls('');
    say('生成函數：把數列當成冪級數的係數', 'G(x) = a₀ + a₁x + a₂x² + …');
    await beat(tok, 2600);
    await gfShow(tok);
    say('1/(1 − x) = 1 + x + x² + …', '數列 1, 1, 1, …');
    await beat(tok, 2400);
    await gfOp('s', tok);
    say('再乘 1/(1 − x)：部分和 → 1, 2, 3, …', '1/(1 − x)² = Σ (k+1)xᵏ');
    await beat(tok, 2800);
    await gfOp('x', tok);
    say('乘 x：整排右移一格 → 0, 1, 2, 3, …', 'x/(1 − x)² = Σ k·xᵏ');
    await beat(tok, 2800);
    gf.key = 'two'; enterGF(); controls('');
    await gfShow(tok);
    say('1/(1 − ax) = Σ aᵏxᵏ（這裡 a = 2）', '最常用的一條');
    await beat(tok, 2800);
  }
  async function scGFSolve(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('Rosen 例：用生成函數解 aₖ = 3aₖ₋₁，a₀ = 2', '');
    await beat(tok, 2400);
    const rows = ['G(x) = a₀ + a₁x + a₂x² + …', '3xG(x) = 3a₀x + 3a₁x² + …', 'G(x) − 3xG(x) = a₀ = 2', 'G(x) = 2/(1 − 3x)', '= Σ 2·3ᵏxᵏ → aₖ = 2·3ᵏ'];
    for (let i = 0; i < rows.length; i++) {
      const m = cube(rows[i], i >= 3 ? '#dd8238' : '#4b9ee2', [6.6, 0.55, 1], -0.5, 6 - i * 0.8, 0, 2.5);
      if (i === 2) glow(m, GOLD);
      say(rows[i], i === 2 ? 'k ≥ 1 的項：aₖ − 3aₖ₋₁ = 0，全部消掉，只剩 a₀' : '');
      await beat(tok, 2000);
    }
    say('像 Laplace transform：換到 G(x) 解完再變回數列', '');
    await beat(tok, 2600);
    gf.key = 'r3'; enterGF(); controls('');
    await gfShow(tok);
    say('2/(1 − 3x) 的係數：2, 6, 18, 54 …', 'aₖ = 2·3ᵏ');
    await beat(tok, 2800);
  }
  async function scGFTrap(tok) {
    fresh([0, 4.5, 14.5], [0, 3, 0]);
    say('筆記提醒：生成函數先把初始項寫清楚', 'Fibonacci 從 f₀ = 0 還是 f₁ = 1 開始？');
    await beat(tok, 2800);
    const N = 8;
    const A = makeBars(N, { color: '#4b9ee2', dx: 1.5, x0: -5.25 - 0.25, H: 2.4, base: 3.4, fixedMax: 21, w: 0.3, names: (i) => 'x' + (i === 0 ? '⁰' : i === 1 ? '¹' : i === 2 ? '²' : i === 3 ? '³' : '^' + i) });
    const B = makeBars(N, { color: '#d64545', dx: 1.5, x0: -5.25 + 0.25, H: 2.4, base: 3.4, fixedMax: 21, w: 0.3 });
    tag('藍：f₀ = 0, f₁ = 1 → x/(1 − x − x²)', 'ptr', -2.5, 6.6);
    tag('紅：當成 a₀ = a₁ = 1 → 1/(1 − x − x²)', 'ptr alt', 2.8, 6.1);
    const fib = [0, 1]; for (let i = 2; i < N + 1; i++) fib.push(fib[i - 1] + fib[i - 2]);
    for (let i = 0; i < N; i++) { A.set(i, fib[i]); B.set(i, fib[i + 1]); await beat(tok, 380); }
    say('分母一樣，分子不同：整個數列錯位一格', 'G(x) − f₀ − f₁x = x(G(x) − f₀) + x²G(x)');
    await beat(tok, 3400);
    say('先寫 a₀、a₁，再把級數從 k = 2 開始對齊', '初始條件定錯，後面每個係數都錯');
    await beat(tok, 3200);
  }

  const scenes = {
    'rec-def': { title: '遞迴式 + 初始條件：aₙ = aₙ₋₁ + 3（Rosen 例）', play: scRecDef },
    'iteration': { title: '迭代／代換法：往回代到初始條件（課本）', play: scIterate },
    'compound-interest': { title: '複利 Pₙ = 1.11Pₙ₋₁（Rosen 例）', play: scInterest },
    'hanoi': { title: 'Tower of Hanoi：Hₙ = 2Hₙ₋₁ + 1（Rosen 例）', play: scHanoi },
    'fibonacci': { title: 'Fibonacci 兔子（Rosen 例）', play: scFib },
    'bit-strings': { title: '沒有 00 的 bit string（Rosen 例）', play: scBitStrings },
    'char-intro': { title: '特徵方程：猜 aₙ = rⁿ（課本）', play: scCharIntro },
    'char-distinct': { title: '相異根：aₙ = 3·2ⁿ − (−1)ⁿ（Rosen 例）', play: scCharDistinct },
    'fib-binet': { title: 'Fibonacci 通項：φ 與 ψ（Rosen 例）', play: scBinet },
    'char-repeated': { title: '重根：aₙ = (1 + n)3ⁿ（Rosen 例）', play: scCharRepeated },
    'nonhom': { title: '非齊次：aₙ = 3aₙ₋₁ + 2n（Rosen 例）', play: scNonHom },
    'trial-form': { title: 'Particular solution 的試解形式（Rosen 例）', play: scTrial },
    'gf-basic': { title: '生成函數：1/(1 − x) 與右移、部分和（課本）', play: scGFBasic },
    'gf-solve': { title: '用生成函數解 aₖ = 3aₖ₋₁（Rosen 例）', play: scGFSolve },
    'gf-initial-trap': { title: '易錯：初始項沒定清楚，整排錯位（章節筆記）', play: scGFTrap },
  };

  return {
    kicker: '離散數學・第 4 章',
    title: '遞推關係',
    color: 'var(--dm)',
    modes: [
      { id: 'unfold', name: '遞迴展開', enter: enterUnfold },
      { id: 'char', name: '特徵根', enter: enterChar },
      { id: 'hanoi', name: 'Tower of Hanoi', enter: enterHanoi },
      { id: 'nonhom', name: '非齊次', enter: enterNonHom },
      { id: 'gf', name: '生成函數', enter: enterGF },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['rec-def', 'iteration', 'compound-interest', 'hanoi', 'fibonacci', 'bit-strings', 'char-intro', 'char-distinct', 'fib-binet', 'char-repeated',
      'nonhom', 'trial-form', 'gf-basic', 'gf-solve', 'gf-initial-trap'],
    stop() { stopTimer(); busy = false; },
  };
}
