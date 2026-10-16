// 離散數學 第4章：遞推關係（建立遞迴式、迭代代換、Tower of Hanoi、Fibonacci、
// 線性齊次：特徵根（相異／重根）、非齊次：particular solution、生成函數入門）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen 8.1–8.2、8.4（特徵方程 r² − c₁r − c₂ = 0；F(n) = 多項式 × sⁿ 的試解規則）。
import kit from './_kit.js';

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
    if (S.kind === 'complex' || S.kind === 'zero') { log(S.kind === 'complex' ? '複數根（解法見第 12C 講：λⁿ(β₁cos nθ + β₂sin nθ)）：本模式只畫實根，這組請換數字。' : '退化的情況，換一組。', true); return null; }
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
      const al1 = pick([1, 2, 3, -1]); let al2 = pick([1, 2, -1, -2]);
      while (al2 === al1) al2 = pick([1, 2, -1, -2]);  // 相等時「α 對調」的選項會跟正解一樣
      if (r1 === -r2) r2 = r1 === 4 ? 3 : r1 + 1 === 0 ? 2 : r1 + 1;  // r₁ = −r₂ 時「根變號」的選項會跟「α 對調」一樣
      const c1 = r1 + r2, c2 = -r1 * r2;
      const a0 = r1 === r2 ? al1 : al1 + al2, a1 = r1 === r2 ? (al1 + al2) * r1 : al1 * r1 + al2 * r2;
      const R = (r) => (r < 0 ? '(' + minus(r) + ')' : String(r));
      const ans = r1 === r2 ? 'aₙ = (' + minus(al1) + ' + ' + minus(al2) + 'n)·' + R(r1) + 'ⁿ' : 'aₙ = ' + minus(al1) + '·' + R(r1) + 'ⁿ + ' + minus(al2) + '·' + R(r2) + 'ⁿ';
      const w1 = r1 === r2 ? 'aₙ = ' + minus(al1) + '·' + R(r1) + 'ⁿ + ' + minus(al2) + '·' + R(r1) + 'ⁿ' : 'aₙ = ' + minus(al2) + '·' + R(r1) + 'ⁿ + ' + minus(al1) + '·' + R(r2) + 'ⁿ';
      const w2 = 'aₙ = ' + minus(al1) + '·' + R(-r1) + 'ⁿ + ' + minus(al2) + '·' + R(-r2) + 'ⁿ';
      const w3 = 'aₙ = ' + minus(a0) + '·' + R(r1) + 'ⁿ';
      const cf = (c, v, first) => (c === 0 ? '' : (first ? (c < 0 ? '−' : '') : (c < 0 ? ' − ' : ' + ')) + (Math.abs(c) === 1 ? '' : Math.abs(c)) + v);
      const rec = 'aₙ = ' + (cf(c1, 'aₙ₋₁', true) + cf(c2, 'aₙ₋₂', !c1) || '0');
      const T4 = [ans, w1, w2, w3].map(tidy);
      return { q: rec + '，a₀ = ' + minus(a0) + '，a₁ = ' + minus(a1) + '。解為？', opts: T4, ans: T4[0], why: '特徵方程 ' + charEq(c1, c2) + ' → r = ' + (r1 === r2 ? minus(r1) + '（重根，要多乘 n）' : minus(r1) + '、' + minus(r2)) + '，再用 a₀、a₁ 解 α。注意正負號：r² − c₁r − c₂ = 0 的兩根和 = c₁、兩根積 = −c₂。' };
    }
    if (k < 0.32) {
      const n = 3 + Math.floor(Math.random() * 8);
      const v = Math.pow(2, n) - 1;
      return { q: 'Tower of Hanoi 有 ' + n + ' 個盤子，最少要搬幾次？', opts: [v, Math.pow(2, n), Math.pow(2, n - 1), 2 * n - 1].map(String), ans: String(v), why: 'Hₙ = 2Hₙ₋₁ + 1，H₁ = 1 → Hₙ = 2ⁿ − 1 = ' + v + '。' };
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
      const c = pick([2, 3, 4, 5]), a0 = pick([2, 3, 5]), K = 2 + Math.floor(Math.random() * 3);
      const v = a0 * Math.pow(c, K);
      return { q: '用生成函數解 aₖ = ' + c + 'aₖ₋₁，a₀ = ' + a0 + '。G(x) 與 a' + sub(K) + ' 為？', opts: ['G(x) = ' + a0 + '/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + v, 'G(x) = ' + a0 + '/(1 + ' + c + 'x)，a' + sub(K) + ' = ' + minus(a0 * Math.pow(-c, K)), 'G(x) = 1/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + Math.pow(c, K), 'G(x) = ' + a0 + 'x/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + a0 * Math.pow(c, K - 1)], ans: 'G(x) = ' + a0 + '/(1 − ' + c + 'x)，a' + sub(K) + ' = ' + v, why: 'G(x) − ' + c + 'xG(x) = a₀（k ≥ 1 的項全消掉）→ G = ' + a0 + '/(1 − ' + c + 'x) = Σ ' + a0 + '·' + c + 'ᵏxᵏ。漏掉 a₀ 會得到錯的分子。' };
    }
    if (k < 0.72) {
      const items = [['1/(1 − x)', '1, 1, 1, 1, …'], ['1/(1 − x)²', '1, 2, 3, 4, …'], ['1/(1 + x)', '1, −1, 1, −1, …'], ['x/(1 − x)', '0, 1, 1, 1, …'], ['1/(1 − 2x)', '1, 2, 4, 8, …'], ['1/(1 − x²)', '1, 0, 1, 0, …']];
      const [g, a] = pick(items);
      return { q: 'G(x) = ' + g + ' 對應的數列 a₀, a₁, a₂, … 是？', opts: items.map((it) => it[1]).filter((s) => s !== a).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 3).concat([a]), ans: a, why: '由 1/(1 − ax) = Σ aᵏxᵏ 變形：代換 a、乘 x 右移、或平方（係數變成 k + 1）。' };
    }
    if (k < 0.86) {
      const n = 3 + Math.floor(Math.random() * 6);
      const a = [0, 2, 3]; for (let i = 3; i <= n + 1; i++) a[i] = a[i - 1] + a[i - 2];
      return { q: '長度 ' + n + '、不含連續兩個 0 的 bit string 有幾個？', opts: [...new Set([a[n], a[n - 1], Math.pow(2, n) - a[n], a[n + 1], a[n] + 1].map(String))].slice(0, 4), ans: String(a[n]), why: '結尾 1：前面任意合法 n−1 字串；結尾 10：前面合法 n−2 字串 → aₙ = aₙ₋₁ + aₙ₋₂，a₁ = 2，a₂ = 3。' };
    }
    const c = pick([2, 3, 4]), d = pick([1, 2, 3, 5]), a0 = pick([0, 1, 2]);
    const n = 3 + Math.floor(Math.random() * 3);
    let v = a0; for (let i = 1; i <= n; i++) v = c * v + d;
    return { q: 'aₙ = ' + c + 'aₙ₋₁ + ' + d + '，a₀ = ' + a0 + '。a' + sub(n) + ' = ?', opts: [v, v - d, c * v, Math.pow(c, n) * a0 + d].map(String), ans: String(v), why: '直接迭代 ' + n + ' 次；或 特解 p = ' + frac(d / (1 - c)) + '，aₙ = (a₀ − p)·' + c + 'ⁿ + p。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts.map(String))].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ rr.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 4 章：遞迴關係與生成函數 — cued scenes（清大 趙啟超 第12A–13B講、Neso 代換法、Generating Functions Part 1）───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的例子照用（aₙ₊₁ − 5aₙ + 6aₙ₋₁ = 0、a₁ = 1、a₂ = 5 → aₙ = 3ⁿ − 2ⁿ；Fibonacci；aₙ − 4aₙ₋₁ + 4aₙ₋₂ = 0；
// aₙ − 2aₙ₋₁ + 2aₙ₋₂ = 0；aₙ − aₙ₋₁ − 2aₙ₋₂ = 1；aₙ − 2aₙ₋₁ = n；aₙ₊₂ − 4aₙ₊₁ + 4aₙ = 2ⁿ；T(n) = T(n−1) + n…）。
// 畫面上的數列值都由程式從遞迴式與公式各算一次再比對（不相等會顯示 ✘）；老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const bx = (t, c, x, y, z = 0, w = 0.6, h = 0.6, d = 0.6, drop = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && o.add) return gone(o.ls); if (o.all) return gone(o.all); if (o.element) remove(o); else kill(o); });
const SUBM = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', n: 'ₙ', k: 'ₖ', r: 'ᵣ' };
const SUPM = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', k: 'ᵏ', r: 'ʳ' };
const sub = (s) => String(s).split('').map((c) => SUBM[c] || c).join('');
const sup = (s) => String(s).split('').map((c) => SUPM[c] || c).join('');
// number → short text: integers, simple fractions, else 3 decimals; minus sign as −
function fmt(v) {
  if (!isFinite(v)) return '∞';
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-9) return (r < 0 ? '−' : '') + Math.abs(r);
  for (let d = 2; d <= 64; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return (n < 0 ? '−' : '') + Math.abs(n) + '/' + d; }
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
}
// a sequence from a recurrence: a[n0..n0+init.length-1] = init, then a[n] = f(a, n) up to nMax
function seq(n0, init, f, nMax) { const a = {}; init.forEach((v, i) => { a[n0 + i] = v; }); for (let n = n0 + init.length; n <= nMax; n++) a[n] = f(a, n); return a; }
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.6, 14.5], [0, 3.0, 0]];
// a board: text lines top → down; hi(i) lights line i (−1 = none)
function board(x, yTop, dy = 0.62) {
  const ls = [];
  return {
    ls,
    add(t, cls = '') { const l = tag(t, cls, x, yTop - ls.length * dy); l.userData.base = cls; ls.push(l); return l; },
    skip() { ls.push(null); },
    hi(i) { ls.forEach((l, k) => { if (l) l.element.className = 'lab-label' + (k === i ? ' ptr alt' : (l.userData.base ? ' ' + l.userData.base : '')); }); },
    last() { this.hi(ls.length - 1); },
    set(i, t) { if (ls[i]) txt(ls[i], t); },
    clear() { ls.forEach((l) => l && remove(l)); ls.length = 0; },
  };
}
// a strip of sequence cells: name(n) under each slot; put(n, v) drops a value cube in slot n
function strip(name, n0, n1, x0, y, o = {}) {
  const dx = o.dx || 0.86, w = o.w || 0.66, all = [], cells = {};
  const X = (n) => x0 + (n - n0) * dx;
  for (let n = n0; n <= n1; n++) all.push(sm(name + sub(n), X(n), y - 0.62));
  return {
    all, cells, X,
    put(n, v, c) { const m = bx(typeof v === 'number' ? fmt(v) : v, c || o.c || FC.blue, X(n), y, 0, w, w, w, 0.7); cells[n] = m; all.push(m); return m; },
    hi(n, col) { Object.keys(cells).forEach((k) => glow(cells[k], Number(k) === n ? (col || HL) : null)); },
  };
}
// compare two rows (recurrence values vs formula values) for n in ns; ✓ when equal
function cmp(ns, A, B, x0, y, nameA, nameB, dx = 0.86) {
  const all = [];
  all.push(sm(nameA, x0 - 1.5, y), sm(nameB, x0 - 1.5, y - 0.8), sm('n', x0 - 1.5, y + 0.62));
  ns.forEach((n, i) => {
    const x = x0 + i * dx;
    all.push(sm(String(n), x, y + 0.62));
    all.push(bx(fmt(A[n]), FC.blue, x, y, 0, 0.66, 0.6, 0.6));
    all.push(bx(fmt(B[n]), FC.green, x, y - 0.8, 0, 0.66, 0.6, 0.6));
    all.push(Math.abs(A[n] - B[n]) < 1e-9 ? good('✓', x, y - 1.45) : bad('✘', x, y - 1.45));
  });
  return all;
}
// a labelled row of value cubes
function vrow(label, vals, x0, y, c = FC.blue, dx = 0.86) {
  const all = [sm(label, x0 - 1.3, y)];
  const cells = vals.map((v, i) => bx(typeof v === 'number' ? fmt(v) : v, c, x0 + i * dx, y, 0, 0.72, 0.55, 0.55));
  all.push(...cells);
  return { all, cells };
}
// a plain row of value cubes (no label)
const row = (x0, y, vals, c = FC.blue, dx = 0.8) => vals.map((v, i) => bx(typeof v === 'number' ? fmt(v) : v, c, x0 + i * dx, y, 0, 0.62, 0.62, 0.62, 0.6));
// a generating-function rack: coefficient cubes with the power of x above each (1, x, x², …)
function rack(vals, x0, y, c = FC.blue, label = '', dx = 0.86) {
  const all = []; if (label) all.push(sm(label, x0 - 1.4, y));
  const cells = vals.map((v, i) => bx(typeof v === 'number' ? fmt(v) : v, c, x0 + i * dx, y, 0, 0.72, 0.55, 0.55, 0.5));
  vals.forEach((v, i) => all.push(sm(i === 0 ? '1' : 'x' + (i > 1 ? sup(i) : ''), x0 + i * dx, y + 0.55)));
  all.push(...cells);
  return { all, cells };
}
const C = (n, r) => { if (r < 0) return 0; let v = 1; for (let i = 0; i < r; i++) v = v * (n - i) / (i + 1); return v; };  // works for any real n
// a flow box: wide flat cube with text
const fbox = (t, c, x, y, w = 2.4) => bx(t, c, x, y, 0, w, 0.7, 0.5);
// a vertical bar standing on y0
function bar(x, y0, h, c, label, w = 0.5) { const m = cube('', c, [w, Math.max(0.04, h), w], x, y0 + Math.max(0.04, h) / 2, 0); const l = label != null ? sm(label, x, y0 + h + 0.3) : null; return [m, l]; }
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }


// ════════ SIJSKBFIMhI（清大OCW 趙啟超《離散數學》第12A講 Recurrence Relations） ════════
scene('rr-12a-fib', "Fibonacci：Fₙ = Fₙ₋₁ + Fₙ₋₂，F₀ = 0、F₁ = 1", [
  // 3.8
  async (tok, S) => {
    hot('Recurrence Relation（遞迴關係）', 0, 7.2); cap('今天開始講 recurrence relation', '先看一個例子');
  },
  // 5.13
  async (tok, S) => {
    S.B = board(-3.4, 6.2); S.B.add('Fibonacci numbers', 'ptr'); cap('第一個例子：Fibonacci numbers', '很有名的數列');
  },
  // 6.3
  async (tok, S) => {
    S.F = seq(0, [0, 1], (a, n) => a[n - 1] + a[n - 2], 9); S.st = strip('F', 0, 9, -4.3, 0.8); S.st.put(0, 0, FC.orange); S.st.put(1, 1, FC.orange); note('起頭兩個：0、1', -3.9, 2.0); cap('一開始有兩個：0 和 1', '下一個是前兩個的和');
  },
  // 7.33
  async (tok, S) => {
    for (const n of [2, 3]) { S.st.put(n, S.F[n]); await wt(tok, 300); } cap('0 + 1 = 1，1 + 1 = 2', '');
  },
  // 38.02
  async (tok, S) => {
    for (const n of [4, 5, 6, 7]) { S.st.put(n, S.F[n]); await wt(tok, 300); } cap('1+2=3、2+3=5、3+5=8、5+8=13', '');
  },
  // 40.69
  async (tok, S) => {
    for (const n of [8, 9]) { S.st.put(n, S.F[n]); await wt(tok, 300); } cap('這樣一直下去', '每一項都是前兩項的和');
  },
  // 51.28
  async (tok, S) => {
    S.B.add('Fₙ = Fₙ₋₁ + Fₙ₋₂'); S.B.last(); cap('怎麼寫成定義？', 'Fₙ = 前兩項的和');
  },
  // 65.36
  async (tok, S) => {
    S.B.add('（n ≥ 2）'); S.B.last(); cap('這條式子用在 n ≥ 2', '');
  },
  // 76.68
  async (tok, S) => {
    S.B.add('F₀ = 0，F₁ = 1（initial conditions）', 'good'); S.B.last(); glow(S.st.cells[0], HL); glow(S.st.cells[1], HL); cap('兩個 initial condition', 'F₀ = 0、F₁ = 1');
  },
  // 93.51
  async (tok, S) => {
    S.B.hi(-1); S.st.hi(2); S.R = board(3.5, 6.2); S.R.add('n = 2：F₂ = F₁ + F₀ = 1'); cap('用 n = 2 代：F₂ = F₁ + F₀', '= 1 + 0 = 1');
  },
  // 102.67
  async (tok, S) => {
    S.st.hi(3); S.R.add('n = 3：F₃ = F₂ + F₁ = 2'); cap('F₃ = F₂ + F₁ = 1 + 1 = 2', '以此類推');
  },
  // 107.34
  async (tok, S) => {
    S.st.hi(-1); Object.values(S.st.cells).forEach((m) => glow(m, OKG)); S.R.add('…每一項都算得出來', 'good'); cap('遞迴定義把整個 sequence 定義完整', '');
  },
  // 115.95
  async (tok, S) => {
    S.R.add('要前兩項 → 需要 2 個起始值'); S.R.last(); cap('一開始要有兩個 initial condition', '這樣才是 well-defined sequence');
  },
  // 124.47
  async (tok, S) => {
    S.R.hi(-1); note('看到遞迴式：先檢查起始值夠不夠', 1.6, 3.3); cap('先 check initial condition 夠不夠', '後面每一項都有定義嗎？');
  },
]);
scene('rr-12a-goal', "解遞迴：把 Fₙ 寫成只跟 n 有關的式子", [
  // 134.95
  async (tok, S) => {
    hot('整理成「= 0」的樣子', 0, 7.2); S.B = board(0, 5.8, 0.8); S.B.add('Fₙ = Fₙ₋₁ + Fₙ₋₂'); cap('通常把它寫成這樣', '');
  },
  // 139.77
  async (tok, S) => {
    S.B.add('Fₙ − Fₙ₋₁ − Fₙ₋₂ = 0', 'ptr alt'); cap('把右邊整個移過來', '右邊剩 0');
  },
  // 149.47
  async (tok, S) => {
    S.B.add('↑ 這就是一個 recurrence relation', 'note'); cap('這就是一個 recurrence relation', '');
  },
  // 156.89
  async (tok, S) => {
    S.B.add('目標：Fₙ = （只跟 n 有關的式子）', 'good'); cap('目標：把 Fₙ 寫成 n 的式子', '');
  },
  // 165.03
  async (tok, S) => {
    S.i = bx('n', FC.purple, -3.2, 1.6, 0, 0.8, 0.8, 0.8); S.m = bx('公式', FC.sand, 0, 1.6, 0, 1.6, 0.9, 0.8); S.o = bx('Fₙ', FC.green, 3.2, 1.6, 0, 0.9, 0.8, 0.8); S.a1 = arrow(V3(-2.7, 1.6, 0), V3(-0.9, 1.6, 0)); S.a2 = arrow(V3(0.9, 1.6, 0), V3(2.6, 1.6, 0)); sm('（示意）', 0, 0.8); cap('每個 n 帶進去就出來', '不必一項一項往前推');
  },
  // 169.09
  async (tok, S) => {
    S.B.add('→ 把 recurrence relation「解」出來'); S.B.last(); cap('這就叫把 recurrence relation 解出來', '');
  },
  // 174.75
  async (tok, S) => {
    good('下面：教你怎麼解', 0, -0.2); cap('接下來教怎麼解', '');
  },
]);
scene('rr-12a-hrr', "k-th order linear homogeneous recurrence relation with constant coefficients", [
  // 179.35
  async (tok, S) => {
    hot('先解 homogeneous（齊次）', 0, 7.2); S.h = fbox('① homogeneous', FC.green, -2.6, 5.9, 2.8); cap('先解 homogeneous recurrence relation', '');
  },
  // 194.7
  async (tok, S) => {
    S.nh = fbox('② non-homogeneous', FC.orange, 2.6, 5.9, 3.2); S.ar = arrow(V3(-1.1, 5.9, 0), V3(0.9, 5.9, 0)); cap('會了以後再解 non-homogeneous', '');
  },
  // 211.88
  async (tok, S) => {
    S.B = board(0, 4.9, 0.68); S.B.add('aₙ = −c₁aₙ₋₁ − c₂aₙ₋₂ − … − cₖaₙ₋ₖ'); cap('一般式：aₙ 跟前 k 個有關', '');
  },
  // 241.7
  async (tok, S) => {
    S.B.add('⇔ aₙ + c₁aₙ₋₁ + … + cₖaₙ₋ₖ = 0', 'ptr alt'); cap('全部移到一邊，右邊是 0', '這就叫 homogeneous');
  },
  // 262.06
  async (tok, S) => {
    S.st = strip('a', 0, 7, -3.0, 1.2); for (let n = 0; n < 4; n++) S.st.put(n, '?', FC.orange); S.kl = sm('k 個 initial conditions（示意 k = 4）', -1.7, 2.1); cap('跟前 k 個有關 → 要 k 個 initial condition', 'a₀, a₁, …, aₖ₋₁');
  },
  // 287.52
  async (tok, S) => {
    for (let n = 4; n <= 7; n++) { S.st.put(n, '✓'); await wt(tok, 300); } cap('有了它們就能算出 aₖ', '再算 aₖ₊₁、aₖ₊₂、…');
  },
  // 316.86
  async (tok, S) => {
    S.B.add('k-th order linear homogeneous', 'ptr'); S.B.add('recurrence relation with constant coefficients', 'ptr'); cap('全名：k 階線性齊次常係數遞迴關係', '');
  },
  // 335.08
  async (tok, S) => {
    S.n1 = note('k-th order：跟前 k 項有關', -3.4, -0.1); cap('k-th order（k 階）', 'aₙ 跟前 k 項有關');
  },
  // 350.36
  async (tok, S) => {
    S.n2 = note('linear：都是一次，沒有平方', 2.8, -0.1); cap('linear（線性）', '每項都是一次式，沒有平方');
  },
  // 363.2
  async (tok, S) => {
    S.n3 = note('homogeneous：右邊是 0', -3.4, -0.8); cap('homogeneous（齊次）', '移項後右邊只有 0');
  },
  // 374.78
  async (tok, S) => {
    S.n4 = bad('右邊有跟 n 有關的項 → non-homogeneous', 2.8, -0.8); cap('右邊不是 0 → non-homogeneous', '後面再教');
  },
  // 389.52
  async (tok, S) => {
    S.n5 = note('constant coefficients：c₁…cₖ 跟 n 無關', -0.3, -1.5); cap('constant coefficients（常係數）', 'c₁、c₂、…、cₖ 都跟 n 無關');
  },
  // 434.02
  async (tok, S) => {
    gone(S.st, S.kl, S.n1, S.n2, S.n3, S.n4, S.n5); good('Fₙ − Fₙ₋₁ − Fₙ₋₂ = 0：k = 2（second order）', 0, 2.2); cap('剛才的 Fibonacci 就是二階的', 'k = 2');
  },
  // 452.04
  async (tok, S) => {
    S.d1 = note('又叫 difference equation（差分方程）', 0, 1.55); cap('又叫 difference equation', '差分方程');
  },
  // 479.05
  async (tok, S) => {
    S.d2 = pl('離散（discrete）→ difference equation；連續 → differential equation', 0, 0.9); cap('離散叫 difference，連續叫 differential', '');
  },
  // 487.54
  async (tok, S) => {
    S.d3 = sm('後面老師用縮寫代替這串長名字（例如 HRR）', 0, 0.25); cap('名字太長，後面用縮寫', '');
  },
  // 514.41
  async (tok, S) => {
    gone(S.d1, S.d2, S.d3); good('a₀, …, aₖ₋₁ 叫 initial conditions', 0, 1.55); cap('a₀ 到 aₖ₋₁ 叫 initial conditions', '');
  },
  // 533.25
  async (tok, S) => {
    bad('k 階就要 k 個，否則不是 well-defined', 0, 0.9); cap('k 階就必須有 k 個 initial condition', '少了就算不下去');
  },
  // 554.69
  async (tok, S) => {
    S.B.hi(-1); cap('解法跟微分方程很像', '只是離散的更簡單');
  },
]);
scene('rr-12a-char', "特徵方程：aₙ₊₁ − 5aₙ + 6aₙ₋₁ = 0 → r² − 5r + 6 = 0", [
  // 572.46
  async (tok, S) => {
    hot('例：二階、兩個相異根', 0, 7.2); cap('舉個例子', '方法類似，只是更簡單');
  },
  // 585.5
  async (tok, S) => {
    S.B = board(-3.3, 6.2, 0.75); S.B.add('aₙ₊₁ − 5aₙ + 6aₙ₋₁ = 0，n ≥ 2', 'ptr alt'); S.B.add('a₁ = 1，a₂ = 5'); cap('aₙ₊₁ − 5aₙ + 6aₙ₋₁ = 0', 'a₁ = 1、a₂ = 5');
  },
  // 595.92
  async (tok, S) => {
    note('從 aₙ₊₁ 開始也沒關係：二階', 3.0, 6.2); cap('從 aₙ₊₁ 開始也沒關係', '跟前兩個有關就是 second order');
  },
  // 607.36
  async (tok, S) => {
    S.a = seq(1, [1, 5], (a, n) => 5 * a[n - 1] - 6 * a[n - 2], 6); S.st = strip('a', 1, 6, -0.8, 0.9); S.st.put(1, 1, FC.orange); S.st.put(2, 5, FC.orange); cap('二階就給兩個 initial：a₁、a₂', '');
  },
  // 613.46
  async (tok, S) => {
    S.st.put(3, S.a[3]); S.R = board(3.0, 5.4); S.R.add('n = 2：a₃ = 5·5 − 6·1 = 19'); cap('n ≥ 2，第一個算的是 a₃', 'a₃ 需要 a₂ 和 a₁');
  },
  // 617.54
  async (tok, S) => {
    S.st.put(4, S.a[4]); S.R.add('n = 3：a₄ = 5·19 − 6·5 = 65'); cap('a₄ 需要 a₃ 和 a₂', '可以一直算上去');
  },
  // 624.7
  async (tok, S) => {
    S.R.add('✓ well-defined（先確認）', 'good'); cap('第一步：先確認 well-defined', '不是 well-defined 當然解不出來');
  },
  // 648.24
  async (tok, S) => {
    S.B.add('類比：f″ − 5f′ + 6f = 0', 'note'); cap('類似微分方程 f″ − 5f′ + 6f = 0', '');
  },
  // 685.62
  async (tok, S) => {
    S.B.add('代 f = e^(λt) → λ² − 5λ + 6 = 0', 'note'); cap('微分方程是代 f = e^(λt)', '得到 λ² − 5λ + 6 = 0');
  },
  // 714.27
  async (tok, S) => {
    S.bb = bub('先猜樣子，解得出來＝猜對', 3.0, 3.4); cap('先猜一個樣子', '解得出來就表示樣子對');
  },
  // 724.41
  async (tok, S) => {
    S.B.clear(); S.B.add('aₙ₊₁ − 5aₙ + 6aₙ₋₁ = 0', 'ptr'); S.B.add('試 aₙ = rⁿ', 'ptr alt'); S.B.last(); cap('這裡就試 aₙ = rⁿ', '');
  },
  // 749.8
  async (tok, S) => {
    S.B.add('rⁿ⁺¹ − 5rⁿ + 6rⁿ⁻¹ = 0'); S.B.last(); cap('用 rⁿ 帶進去', 'aₙ₊₁ 變成 rⁿ⁺¹');
  },
  // 765.65
  async (tok, S) => {
    S.B.add('rⁿ⁻¹ (r² − 5r + 6) = 0'); S.B.last(); cap('把 rⁿ⁻¹ 提出來', '');
  },
  // 780.45
  async (tok, S) => {
    S.B.add('r ≠ 0 ⇒ r² − 5r + 6 = 0', 'ptr alt'); S.B.last(); cap('r = 0 沒意思，所以括號要等於 0', '');
  },
  // 791.93
  async (tok, S) => {
    S.B.hi(-1); cap('剩下只是解一元二次方程式', '國中就會');
  },
  // 800.89
  async (tok, S) => {
    gone(S.bb); hot('characteristic equation（特徵方程式）', 3.0, 3.4); cap('這叫 characteristic equation', '特徵方程式');
  },
  // 826.17
  async (tok, S) => {
    good('(r − 2)(r − 3) = 0 → r = 2, 3', 3.0, 2.7); cap('可以因式分解', 'r = 2 或 r = 3');
  },
  // 841.91
  async (tok, S) => {
    good('2ⁿ 是解，3ⁿ 也是解', 3.0, 2.0); cap('2ⁿ 是解，3ⁿ 也是解', '');
  },
]);
scene('rr-12a-gen', "通解 α₁2ⁿ + α₂3ⁿ，代 a₁ = 1、a₂ = 5 → aₙ = 3ⁿ − 2ⁿ", [
  // 863.11
  async (tok, S) => {
    hot('線性 → 疊加原理', 0, 7.2); S.B = board(-3.4, 6.2); S.B.add('式子是 linear（都一次）'); S.hn = [1, 2, 3, 4].map((n) => sm('n=' + n, 0.9 + (n - 1) * 0.86, 6.2)); cap('這個式子是線性的', '全部都是一次式');
  },
  // 878.53
  async (tok, S) => {
    S.B.add('s、t 是解 ⇒ s + t 也是解', 'ptr alt'); S.r1 = vrow('2ⁿ', [2, 4, 8, 16], 0.9, 5.5, FC.blue); S.r2 = vrow('3ⁿ', [3, 9, 27, 81], 0.9, 4.8, FC.purple); S.r3 = vrow('2ⁿ+3ⁿ', [5, 13, 35, 97], 0.9, 4.1, FC.green); cap('superposition principle', 's 是解、t 是解，加起來還是解');
  },
  // 899.73
  async (tok, S) => {
    S.B.add('c · s 也是解（乘常數）'); cap('乘一個常數還是解', '');
  },
  // 904.11
  async (tok, S) => {
    S.B.add('⇒ α₁2ⁿ + α₂3ⁿ 都是解', 'ptr alt'); cap('任何 linear combination 都是解', '線性組合');
  },
  // 917.04
  async (tok, S) => {
    glow(S.r3.cells[2], OKG); S.ck = good('檢查：35 = 5·13 − 6·5 ✓', 3.0, 3.4); cap('帶進去就會滿足', '例如 2ⁿ + 3ⁿ');
  },
  // 932.04
  async (tok, S) => {
    S.B.add('所有解 → 一個向量空間'); cap('所有解形成一個向量空間', 'solution space');
  },
  // 942.82
  async (tok, S) => {
    S.B.add('dimension = 2：basis 只要 2 個'); cap('要證它的 dimension 是 2', 'basis 只有兩個');
  },
  // 968.55
  async (tok, S) => {
    S.B.add('k 階 → dimension = k（可證，不證）', 'note'); cap('k 階的 solution space 維度是 k', '老師不證，只講結論');
  },
  // 1037.78
  async (tok, S) => {
    S.B.add('general solution：aₙ = α₁2ⁿ + α₂3ⁿ', 'good'); S.B.last(); cap('這就是所有的解', 'general solution');
  },
  // 1041
  async (tok, S) => {
    gone(S.r1, S.r2, S.r3, S.hn, S.ck); S.B.clear(); S.B.add('aₙ = α₁2ⁿ + α₂3ⁿ', 'good'); S.R = board(3.2, 6.2); S.R.add('α₁、α₂ 由 initial conditions 決定', 'ptr'); cap('還有兩個常數 α₁、α₂ 要決定', '');
  },
  // 1062.98
  async (tok, S) => {
    S.R.add('2 個條件 ↔ 2 個常數：剛好唯一'); cap('兩個 initial condition', '剛好唯一決定兩個常數');
  },
  // 1083.83
  async (tok, S) => {
    S.R.add('n = 1：2α₁ + 3α₂ = 1'); S.R.last(); cap('a₁ = 1：n 用 1 代', '2α₁ + 3α₂ = 1');
  },
  // 1086.27
  async (tok, S) => {
    S.R.add('n = 2：4α₁ + 9α₂ = 5'); S.R.last(); cap('a₂ = 5：n 用 2 代', '4α₁ + 9α₂ = 5');
  },
  // 1108.43
  async (tok, S) => {
    S.R.add('(第二式) − 2×(第一式)：3α₂ = 3'); S.R.last(); cap('解二元一次聯立方程', '');
  },
  // 1119.93
  async (tok, S) => {
    S.R.add('α₂ = 1，α₁ = −1', 'good'); S.R.last(); cap('α₁ = −1，α₂ = 1', '');
  },
  // 1121.48
  async (tok, S) => {
    S.R.add('aₙ = −2ⁿ + 3ⁿ（n ≥ 1）', 'ptr alt'); S.R.last(); cap('aₙ = −2ⁿ + 3ⁿ', '');
  },
  // 1136.21
  async (tok, S) => {
    S.R.hi(-1); S.A = seq(1, [1, 5], (a, n) => 5 * a[n - 1] - 6 * a[n - 2], 6); S.Bf = {}; for (let n = 1; n <= 6; n++) S.Bf[n] = Math.pow(3, n) - Math.pow(2, n); S.c = cmp([1, 2, 3, 4, 5, 6], S.A, S.Bf, -1.4, 1.2, '遞迴算', '3ⁿ − 2ⁿ'); cap('對所有 n ≥ 1 都成立', '藍：用遞迴算　綠：用公式算');
  },
  // 1153.72
  async (tok, S) => {
    glow(S.c[S.c.length - 3], HL); good('a₆ = 3⁶ − 2⁶ = 729 − 64 = 665', 0.8, -1.0); cap('要算 a₆：n 用 6 代', '3⁶ − 2⁶ = 665');
  },
]);
scene('rr-12a-sum', "解法整理：特徵方程 → 根 → 通解 → 初始條件", [
  // 1181.35
  async (tok, S) => {
    hot('解法整理', 0, 7.2); S.b1 = fbox('① 特徵方程', FC.sky, -4.2, 5.2, 2.2); cap('先找對應的 characteristic equation', '');
  },
  // 1190.35
  async (tok, S) => {
    S.b2 = fbox('② 解出根', FC.lilac, -1.4, 5.2, 2.2); arrow(V3(-3.0, 5.2, 0), V3(-2.6, 5.2, 0)); cap('解 characteristic equation', '這題兩個根不一樣');
  },
  // 1198.35
  async (tok, S) => {
    S.b3 = fbox('③ 通解', FC.mint, 1.4, 5.2, 2.2); arrow(V3(-0.2, 5.2, 0), V3(0.2, 5.2, 0)); sm('α₁r₁ⁿ + α₂r₂ⁿ', 1.4, 4.4); cap('兩根不同：general solution 就是這樣', 'α₁r₁ⁿ + α₂r₂ⁿ');
  },
  // 1203.39
  async (tok, S) => {
    note('有重根？另外講', -1.4, 3.5); cap('如果有重根', '另外講');
  },
  // 1213.95
  async (tok, S) => {
    S.b4 = fbox('④ 代初始條件', FC.sand, 4.2, 5.2, 2.4); arrow(V3(2.6, 5.2, 0), V3(2.9, 5.2, 0)); sm('解出 α₁、α₂', 4.2, 4.4); cap('再用 initial condition 把 constant 解出來', '');
  },
  // 1221.8
  async (tok, S) => {
    bad('樣子猜錯 → 代進去解不出來', 0, 2.4); cap('樣子不對，帶進去就解不出來', '表示猜錯了');
  },
  // 1246.04
  async (tok, S) => {
    good('dimension 2 → 找到 2 個獨立解就是全部', 0, 1.4); cap('solution space dimension 2', '找到兩個獨立解就是所有的解');
  },
]);

// ════════ hbOYxWE_Qks（清大OCW 趙啟超《離散數學》第12B講 Recurrence Relations） ════════
scene('rr-12b-fibchar', "Fibonacci：r² − r − 1 = 0，r = (1 ± √5)/2", [
  // 4.26
  async (tok, S) => {
    hot('解 Fibonacci numbers', 0, 7.2); S.B = board(-3.2, 6.2); S.B.add('Fₙ − Fₙ₋₁ − Fₙ₋₂ = 0，F₀ = 0，F₁ = 1', 'ptr'); cap('來解 Fibonacci number', '');
  },
  // 7.04
  async (tok, S) => {
    S.B.add('跟前面一樣：代 Fₙ = rⁿ'); cap('跟前面一樣', '用 rⁿ 代進去');
  },
  // 23.2
  async (tok, S) => {
    S.B.add('（做多了 → 直接跳到特徵方程）', 'note'); cap('做多了就直接跳到這步', '直接寫 characteristic equation');
  },
  // 36.77
  async (tok, S) => {
    S.B.add('r² − r − 1 = 0', 'ptr alt'); S.B.last(); cap('characteristic equation', 'r² − r − 1 = 0');
  },
  // 54.22
  async (tok, S) => {
    S.B.add('r = (1 ± √(1 + 4)) / 2'); S.B.last(); cap('把 r 解出來', '一元二次方程式的公式解');
  },
  // 76.38
  async (tok, S) => {
    S.B.hi(-1); S.nl = line(-4.5, 1.0, 4.5, 1.0, 0, '#8a7a60'); for (let v = -1; v <= 2; v++) sm(String(v).replace('-', '−'), v * 2.4, 0.5); S.p1 = bx('φ', FC.gold, 1.618 * 2.4, 1.0, 0, 0.5, 0.5, 0.5, 0.6); S.p2 = bx('ψ', FC.purple, -0.618 * 2.4, 1.0, 0, 0.5, 0.5, 0.5, 0.6); sm('φ ≈ 1.618', 1.618 * 2.4, 1.75); sm('ψ ≈ −0.618', -0.618 * 2.4, 1.75); cap('r = (1 ± √5)/2', '兩個根都是無理數');
  },
  // 81.69
  async (tok, S) => {
    S.B.add('兩根不同 → 各取 n 次方，做線性組合'); S.B.last(); cap('兩個根不一樣', '取 n 次方的線性組合');
  },
  // 93.87
  async (tok, S) => {
    S.B.add('Fₙ = α₁((1+√5)/2)ⁿ + α₂((1−√5)/2)ⁿ', 'good'); S.B.last(); cap('General Solution', 'Fₙ = α₁φⁿ + α₂ψⁿ');
  },
  // 103.8
  async (tok, S) => {
    note('φⁿ、ψⁿ 是兩個獨立的 basis vector', 0, -0.3); cap('這兩個是獨立的 basis', '任何解都是它們的線性組合');
  },
]);
scene('rr-12b-binet', "代 F₀、F₁：α₁ = 1/√5、α₂ = −1/√5", [
  // 126.53
  async (tok, S) => {
    hot('用 initial conditions 定 α₁、α₂', 0, 7.2); S.B = board(-2.6, 6.2, 0.68); S.B.add('Fₙ = α₁φⁿ + α₂ψⁿ', 'ptr'); cap('用兩個 initial condition', '把 α₁、α₂ 解出來');
  },
  // 137.82
  async (tok, S) => {
    S.B.add('n = 0：α₁ + α₂ = 0'); S.B.last(); cap('n 代 0', 'φ⁰ = ψ⁰ = 1，所以 α₁ + α₂ = F₀ = 0');
  },
  // 140.84
  async (tok, S) => {
    S.B.add('n = 1：α₁φ + α₂ψ = 1'); S.B.last(); cap('n 代 1', 'α₁φ + α₂ψ = F₁ = 1');
  },
  // 152.04
  async (tok, S) => {
    S.B.add('α₂ = −α₁ ⇒ α₁(φ − ψ) = 1，φ − ψ = √5'); S.B.last(); cap('兩個方程、兩個未知數', '剛好解得出來');
  },
  // 167.51
  async (tok, S) => {
    S.B.add('α₁ = 1/√5，α₂ = −1/√5', 'good'); S.B.last(); cap('α₁ = 1/√5，α₂ = −1/√5', '');
  },
  // 169.33
  async (tok, S) => {
    S.B.hi(-1); note('檢查：n=0 → 0 ✓　n=1 → (φ−ψ)/√5 = 1 ✓', 0, 0.5); cap('帶回去檢查一下', 'n = 0 得 0，n = 1 得 1');
  },
  // 187.8
  async (tok, S) => {
    S.B.add('Fₙ = (1/√5)[((1+√5)/2)ⁿ − ((1−√5)/2)ⁿ]', 'ptr alt'); S.B.last(); cap('Fₙ 的公式', '');
  },
  // 194.18
  async (tok, S) => {
    S.B.add('n ≥ 0（從 F₀ 開始）'); S.B.last(); cap('n 從 0 開始', '因為 initial condition 是 F₀、F₁');
  },
  // 214.48
  async (tok, S) => {
    S.B.hi(-1); good('特徵方程 → 兩根 → 通解 → initial conditions 解常數', 0, -0.3); cap('步驟還是一樣', '很簡單');
  },
]);
scene('rr-12b-int', "無理數會剛好消掉：Fₙ 都是整數", [
  // 225.05
  async (tok, S) => {
    hot('解完要看一看答案', 0, 7.2); cap('解出來不要一解就很高興', '要看一看這個答案');
  },
  // 240.62
  async (tok, S) => {
    S.F = seq(0, [0, 1], (a, n) => a[n - 1] + a[n - 2], 8); S.st = strip('F', 0, 8, -3.4, 5.2); for (let n = 0; n <= 8; n++) S.st.put(n, S.F[n]); cap('Fibonacci number 都是整數', '0 1 1 2 3 5 8 …');
  },
  // 254.96
  async (tok, S) => {
    bad('公式裡有 √5（無理數）？', 0, 3.8); cap('答案裡面有無理數', '乍看之下有點怪');
  },
  // 259.75
  async (tok, S) => {
    S.u = {}; S.v = {}; const r5 = Math.sqrt(5), ph = (1 + r5) / 2, ps = (1 - r5) / 2; for (let n = 0; n <= 6; n++) { S.u[n] = Math.pow(ph, n) / r5; S.v[n] = Math.pow(ps, n) / r5; } S.r1 = vrow('φⁿ/√5', [0, 1, 2, 3, 4, 5, 6].map((n) => S.u[n].toFixed(3)), -1.9, 2.6, FC.gold, 1.0); S.r2 = vrow('ψⁿ/√5', [0, 1, 2, 3, 4, 5, 6].map((n) => S.v[n].toFixed(3)), -1.9, 1.8, FC.purple, 1.0); S.r3 = vrow('相減', [0, 1, 2, 3, 4, 5, 6].map((n) => fmt(S.u[n] - S.v[n])), -1.9, 1.0, FC.green, 1.0); cap('無理數會剛好消掉', '兩排小數相減就是整數');
  },
  // 277.44
  async (tok, S) => {
    good('任何 n 代進去都是整數', 0, -0.2); cap('任何 n 代進去都是整數', '整數 + 整數 永遠是整數');
  },
]);
scene('rr-12b-golden', "Fₙ₊₁/Fₙ → (1 + √5)/2：Golden Ratio", [
  // 293.08
  async (tok, S) => {
    hot('Fₙ 長得多快？', 0, 7.2); cap('成長的速度', 'n 很大的時候 Fₙ 大概多大');
  },
  // 322.67
  async (tok, S) => {
    S.F = seq(0, [0, 1], (a, n) => a[n - 1] + a[n - 2], 12); S.bars = []; for (let n = 1; n <= 10; n++) { const r = S.F[n + 1] / S.F[n]; S.bars.push(bar(-5.0 + (n - 1) * 0.95, 0, r * 1.3, FC.blue, null), sm(String(+r.toFixed(3)), -5.0 + (n - 1) * 0.95, r * 1.3 + (n % 2 ? 0.3 : 0.7))); S.bars.push(sm('n=' + n, -5.0 + (n - 1) * 0.95, -0.35)); await wt(tok, 120); } S.lim = line(-5.5, 1.618 * 1.3, 4.6, 1.618 * 1.3, 0, '#c08a1f'); cap('看 Fₙ₊₁ / Fₙ', '前後兩項的比值');
  },
  // 332.45
  async (tok, S) => {
    S.B = board(-2.2, 6.3, 0.55); S.B.add('lim Fₙ₊₁/Fₙ：分子代 n+1、分母代 n'); cap('Fₙ 的公式都有了', '代進去再取極限');
  },
  // 379.07
  async (tok, S) => {
    S.B.add('φ = (1+√5)/2 ≈ 1.618，ψ = (1−√5)/2 ≈ −0.618'); S.B.last(); cap('√5 ≈ 2.236', 'φ ≈ 1.618、ψ ≈ −0.618');
  },
  // 392.21
  async (tok, S) => {
    S.B.add('|ψ| < 1 ⇒ ψⁿ → 0'); S.B.last(); cap('ψ 的絕對值小於 1', 'n 很大時 ψⁿ 趨近 0');
  },
  // 399.87
  async (tok, S) => {
    S.B.add('⇒ 比值 → φⁿ⁺¹/φⁿ = φ', 'ptr alt'); S.B.last(); cap('影響最大的是 φⁿ 那一項', '上下約掉剩 φ');
  },
  // 417.82
  async (tok, S) => {
    S.B.add('Fₙ 大約像 φⁿ 那樣成長'); S.B.last(); cap('成長速度大概是 φⁿ', '');
  },
  // 425.8
  async (tok, S) => {
    S.B.hi(-1); S.h = hot('≈ 1.618', 5.4, 1.618 * 1.3); cap('(1 + √5)/2 ≈ 1.618', '是個無理數');
  },
  // 443.28
  async (tok, S) => {
    gone(S.bars, S.lim, S.h); good('Golden Ratio（黃金比例）', 0, 2.6); cap('這叫 Golden Ratio', '黃金比例');
  },
  // 465.86
  async (tok, S) => {
    const u = 1.9; S.sa = bx('a', FC.gold, -4.5 + 1.618 * u / 2, 1.2, 0, 1.618 * u, 0.3, 0.3); S.sb = bx('b', FC.teal, -4.5 + 1.618 * u + u / 2 + 0.05, 1.2, 0, u, 0.3, 0.3); sm('a + b', -4.5 + 2.618 * u / 2, 0.6); cap('兩個線段：長的 a、短的 b', '全長 a + b');
  },
  // 474.47
  async (tok, S) => {
    pl('(a + b) / a  =  a / b', 0, 0.0); cap('全長比長段 = 長段比短段', '(a + b)/a = a/b');
  },
  // 489.96
  async (tok, S) => {
    good('這個比 = (1 + √5)/2', 0, -0.7); cap('這個比例就是 (1 + √5)/2', '');
  },
  // 506.58
  async (tok, S) => {
    note('Fibonacci 的成長速度 = 黃金比例', 0, -1.4); cap('Fibonacci 的成長速度', '剛好就是 Golden Ratio');
  },
]);
scene('rr-12b-double', "重根 r = 2：2ⁿ 與 n·2ⁿ", [
  // 524.58
  async (tok, S) => {
    hot('再解一個 case', 0, 7.2); cap('我們再解一個 case', '');
  },
  // 541.61
  async (tok, S) => {
    S.B = board(-3.0, 6.2, 0.72); S.B.add('aₙ − 4aₙ₋₁ + 4aₙ₋₂ = 0', 'ptr'); cap('aₙ − 4aₙ₋₁ + 4aₙ₋₂ = 0', 'homogeneous');
  },
  // 546.21
  async (tok, S) => {
    note('不給起始值，只看通解', 3.4, 6.2); cap('不寫 initial condition', '重點在 general solution');
  },
  // 561.89
  async (tok, S) => {
    S.B.add('r² − 4r + 4 = 0'); S.B.last(); cap('照前面講的', '特徵方程 r² − 4r + 4 = 0');
  },
  // 578.22
  async (tok, S) => {
    cap('這個例子會有點不一樣', '');
  },
  // 588.22
  async (tok, S) => {
    S.B.add('(r − 2)² = 0 → r = 2 是 double root', 'ptr alt'); S.B.last(); cap('(r − 2)² → 兩個根一樣', 'double root（二重根）');
  },
  // 609.87
  async (tok, S) => {
    S.B.add('二階 → 需要 2 個獨立解'); S.B.last(); cap('二階：solution space dimension 2', '需要兩個獨立的解');
  },
  // 623.38
  async (tok, S) => {
    S.s1 = fbox('2ⁿ ✓', FC.blue, 3.4, 4.8, 1.6); S.s2 = fbox('?', FC.gray, 3.4, 3.9, 1.6); cap('現在只有 2ⁿ', '還差一個');
  },
  // 663.84
  async (tok, S) => {
    cap('double root 怎麼辦', '把它乘一個 n，還是解'); S.bb = bub('乘一個 n 試試！', 3.6, 3.0);
  },
  // 695.82
  async (tok, S) => {
    gone(S.bb); relabel(S.s2, 'n·2ⁿ ?'); tint(S.s2, FC.orange); S.B.clear(); S.B.add('aₙ − 4aₙ₋₁ + 4aₙ₋₂ = 0', 'ptr'); S.B.add('(r − 2)² = 0 → r = 2 是 double root'); S.B.add('試 aₙ = n·2ⁿ 帶回去'); S.B.last(); cap('n·2ⁿ 也是解？', '帶回去看看');
  },
  // 708.28
  async (tok, S) => {
    S.B.add('n2ⁿ − 4(n−1)2ⁿ⁻¹ + 4(n−2)2ⁿ⁻²'); S.B.last(); cap('aₙ 用 n·2ⁿ 代', 'aₙ₋₁、aₙ₋₂ 也照樣換');
  },
  // 725.2
  async (tok, S) => {
    S.B.add('= 2ⁿ⁻² [4n − 8(n−1) + 4(n−2)]'); S.B.last(); cap('把 2ⁿ⁻² 提出來', '2ⁿ = 4·2ⁿ⁻²，2ⁿ⁻¹ = 2·2ⁿ⁻²');
  },
  // 767.96
  async (tok, S) => {
    S.B.add('= 2ⁿ⁻² [(4 − 8 + 4)n + (8 − 8)] = 0 ✓', 'good'); S.B.last(); relabel(S.s2, 'n·2ⁿ ✓'); tint(S.s2, FC.green); cap('n：4 − 8 + 4 = 0；常數：8 − 8 = 0', 'always 是 0');
  },
  // 781.6
  async (tok, S) => {
    S.B.hi(-1); S.n1 = note('一般：(r − r₀)² 時 n·r₀ⁿ 也是解', 3.6, 1.9); cap('in general 都是這樣', '重根 r₀ → n·r₀ⁿ 也是解');
  },
  // 801.12
  async (tok, S) => {
    S.n2 = note('2ⁿ 與 n·2ⁿ 獨立', 3.6, 1.2); cap('這兩個解是獨立的', '');
  },
  // 812.08
  async (tok, S) => {
    gone(S.n1, S.n2); S.B.clear(); S.B.add('aₙ − 4aₙ₋₁ + 4aₙ₋₂ = 0', 'ptr'); S.B.add('通解 aₙ = α₁2ⁿ + α₂n·2ⁿ', 'ptr alt'); S.B.last(); S.A = seq(0, [1, 4], (a, n) => 4 * a[n - 1] - 4 * a[n - 2], 5); S.Bf = {}; for (let n = 0; n <= 5; n++) S.Bf[n] = Math.pow(2, n) + n * Math.pow(2, n); S.c = cmp([0, 1, 2, 3, 4, 5], S.A, S.Bf, -2.2, 3.2, '遞迴', '2ⁿ + n2ⁿ'); sm('示意：α₁ = α₂ = 1', 0, 4.5); cap('general solution', 'α₁2ⁿ + α₂n2ⁿ');
  },
]);
scene('rr-12b-multi', "多重根：r₀ⁿ、n r₀ⁿ、n² r₀ⁿ、…", [
  // 835.25
  async (tok, S) => {
    hot('如果是三重根呢？', 0, 7.2); S.B = board(-3.0, 6.2, 0.66); S.B.add('double root r₀：r₀ⁿ、n r₀ⁿ'); cap('剛剛是 double root', '那 triple root 呢？');
  },
  // 848.71
  async (tok, S) => {
    S.B.add('triple root r₀：r₀ⁿ、n r₀ⁿ、n² r₀ⁿ'); S.B.last(); cap('三重根：再乘 n、再乘 n', 'r₀ⁿ、n r₀ⁿ、n² r₀ⁿ');
  },
  // 866.27
  async (tok, S) => {
    S.B.add('m 重根：r₀ⁿ、n r₀ⁿ、…、nᵐ⁻¹ r₀ⁿ', 'ptr alt'); S.B.last(); cap('m 重根：需要 m 個', '一直乘到 nᵐ⁻¹');
  },
  // 927.55
  async (tok, S) => {
    S.B.hi(-1); S.B.add('k 階 HRR → 特徵方程：k 次實係數多項式'); S.B.last(); cap('一般 k 階', '特徵方程是 k 次的實係數多項式');
  },
  // 953.12
  async (tok, S) => {
    S.B.add('k 個相異實根 → α₁r₁ⁿ + … + αₖrₖⁿ'); S.B.last(); cap('根都不一樣', '每個取 n 次方做線性組合');
  },
  // 965.38
  async (tok, S) => {
    S.B.hi(-1); S.r = [fbox('r₁ⁿ', FC.blue, -3.2, 1.3, 1.4), fbox('r₂ⁿ', FC.purple, -1.2, 1.3, 1.4), fbox('n r₂ⁿ', FC.purple, 0.8, 1.3, 1.4), fbox('n² r₂ⁿ', FC.purple, 2.8, 1.3, 1.4)]; sm('單根 r₁', -3.2, 0.6); sm('三重根 r₂（示意：4 次多項式）', 0.8, 0.6); cap('例如一個單根 + 一個三重根', '4 次 → 需要 4 個獨立解');
  },
  // 985.34
  async (tok, S) => {
    good('看根的樣子，就能把 k 個獨立解都找到', 0, -0.4); cap('看根的樣子', '就可以把解都找到');
  },
  // 993.36
  async (tok, S) => {
    note('以上都假設根是實數', 0, -1.1); cap('這邊假設根都是實數', '');
  },
  // 1006.06
  async (tok, S) => {
    bad('根可能是複數 → 下堂課講', 0, -1.8); cap('實係數多項式的根可能是複數', '下堂課再講');
  },
]);

// ════════ n_mt9ym4MAk（清大OCW 趙啟超《離散數學》第12C講 Recurrence Relations） ════════
scene('rr-12c-cplx', "複數根：實係數多項式的根共軛成對", [
  // 6.8
  async (tok, S) => {
    hot('解 HRR = 解特徵方程的根', 0, 7.2); S.B = board(-3.0, 6.2, 0.68); S.B.add('k 階 HRR → 特徵方程：k 次多項式 = 0'); cap('繼續解 homogeneous recurrence relation', '重點是解 characteristic equation');
  },
  // 40.82
  async (tok, S) => {
    S.B.add('係數都是實數（real coefficients）'); S.B.last(); cap('通常是實係數多項式', 'degree k 的 real coefficient polynomial');
  },
  // 52.52
  async (tok, S) => {
    S.B.add('根可能是複數！'); S.B.last(); cap('但它的根可能是複數', '');
  },
  // 61.14
  async (tok, S) => {
    S.B.add('例：x² + x + 1 = 0，判別式 1 − 4 < 0'); S.B.last(); cap('x² + x + 1 = 0', '在實數裡沒有根');
  },
  // 70.34
  async (tok, S) => {
    S.B.add('實根：單根 ✓、重根 ✓（前面解決了）', 'good'); S.B.last(); cap('前面都假設根是實數', '單根、重根都解決了');
  },
  // 90.31
  async (tok, S) => {
    S.B.add('複數根 → 怎麼辦？', 'ptr alt'); S.B.last(); cap('再來要解有複數根的情況', '');
  },
  // 96.31
  async (tok, S) => {
    S.OX = 3.0; S.OY = 1.6; S.U = 1.3; S.ax = [line(S.OX - 2.2, S.OY, S.OX + 2.6, S.OY, 0, '#8a7a60'), line(S.OX, S.OY - 2.1, S.OX, S.OY + 2.3, 0, '#8a7a60'), sm('Re', S.OX + 2.8, S.OY), sm('Im', S.OX, S.OY + 2.55)]; S.z1 = bx('', FC.pink, S.OX + 1.6 * S.U, S.OY + 1.1 * S.U, 0, 0.3, 0.3, 0.3, 0.5); S.z2 = bx('', FC.pink, S.OX + 1.6 * S.U, S.OY - 1.1 * S.U, 0, 0.3, 0.3, 0.3, 0.5); sm('a + bj', S.OX + 1.6 * S.U + 0.6, S.OY + 1.1 * S.U + 0.35); sm('a − bj', S.OX + 1.6 * S.U + 0.6, S.OY - 1.1 * S.U - 0.35); sm('（示意）', S.OX - 1.3, S.OY - 1.7); S.B.hi(-1); cap('實係數多項式的複數根', '一定共軛存在');
  },
  // 114.91
  async (tok, S) => {
    good('複數根一次一對出現', -3.0, 1.0); cap('所以複數根一次一對', '');
  },
]);
scene('rr-12c-ex', "r² − 2r + 2 = 0 → r = 1 ± j = √2 e^(±jπ/4)", [
  // 127.52
  async (tok, S) => {
    hot('例：特徵方程有複數根', 0, 7.2); S.B = board(-3.2, 6.2, 0.72); S.B.add('aₙ − 2aₙ₋₁ + 2aₙ₋₂ = 0，n ≥ 2', 'ptr'); S.B.add('a₀ = 1，a₁ = 2'); cap('看一個例子', 'aₙ − 2aₙ₋₁ + 2aₙ₋₂ = 0');
  },
  // 140.67
  async (tok, S) => {
    S.a = seq(0, [1, 2], (a, n) => 2 * a[n - 1] - 2 * a[n - 2], 3); S.st = strip('a', 0, 3, 1.8, 5.7); S.st.put(0, 1, FC.orange); S.st.put(1, 2, FC.orange); S.st.put(2, S.a[2]); cap('n = 2 代進來：a₂ 跟 a₁、a₀ 有關', 'a₂ = 2·2 − 2·1 = 2');
  },
  // 151.57
  async (tok, S) => {
    S.st.put(3, S.a[3]); S.wd = good('well-defined ✓', 3.1, 4.55); cap('a₃ 跟 a₂、a₁ 決定', '= 2·2 − 2·2 = 0，上去都能決定');
  },
  // 159.49
  async (tok, S) => {
    S.B.add('直接寫 characteristic equation'); S.B.last(); cap('一樣把 aₙ 用 rⁿ 帶進去', '直接跳到特徵方程');
  },
  // 174.83
  async (tok, S) => {
    S.B.add('r² − 2r + 2 = 0', 'ptr alt'); S.B.last(); cap('r² − 2r + 2 = 0', '');
  },
  // 184.73
  async (tok, S) => {
    S.B.add('r = (2 ± √(4 − 8)) / 2'); S.B.last(); cap('去解根', '二階、實係數的一元二次方程式');
  },
  // 197.44
  async (tok, S) => {
    S.B.add('判別式 4 − 8 = −4 < 0 → 複數根'); S.B.last(); cap('判別式是負的', '所以是複數根');
  },
  // 208.23
  async (tok, S) => {
    S.B.add('r = 1 ± j（j = √−1）', 'good'); S.B.last(); gone(S.wd); S.OX = 3.0; S.OY = 1.6; S.U = 1.3; S.ax = [line(S.OX - 2.2, S.OY, S.OX + 2.6, S.OY, 0, '#8a7a60'), line(S.OX, S.OY - 2.1, S.OX, S.OY + 2.3, 0, '#8a7a60'), sm('Re', S.OX + 2.8, S.OY), sm('Im', S.OX, S.OY + 2.55)]; S.p1 = bx('', FC.pink, S.OX + S.U, S.OY + S.U, 0, 0.3, 0.3, 0.3, 0.5); S.p2 = bx('', FC.pink, S.OX + S.U, S.OY - S.U, 0, 0.3, 0.3, 0.3, 0.5); S.l1 = sm('1 + j', S.OX + S.U + 0.5, S.OY + S.U + 0.35); S.l2 = sm('1 − j', S.OX + S.U + 0.5, S.OY - S.U - 0.35); cap('r = 1 ± j', 'j 是 √−1');
  },
  // 224.13
  async (tok, S) => {
    S.jn = note('工程用 j，數學用 i（同一個 √−1）', -3.2, 1.1); cap('工程都喜歡用 j', '數學都用 i，講清楚就好');
  },
  // 228.25
  async (tok, S) => {
    glow(S.p1, HL); glow(S.p2, HL); cap('1 + j 的共軛就是 1 − j', '實部不變，虛部變號');
  },
  // 243.09
  async (tok, S) => {
    glow(S.p1, null); glow(S.p2, null); S.v1 = arrow(V3(S.OX, S.OY, 0), V3(S.OX + S.U, S.OY + S.U, 0), 0x9b7ef4); S.v2 = arrow(V3(S.OX, S.OY, 0), V3(S.OX + S.U, S.OY - S.U, 0), 0x9b7ef4); cap('改成極座標', '用長度和角度表示');
  },
  // 257.08
  async (tok, S) => {
    gone(S.jn); S.B.clear(); S.B.add('r = 1 ± j（j = √−1）', 'good'); S.B.add('e^(jθ) = cos θ + j sin θ'); S.B.last(); cap('e^(jθ) = cos θ + j sin θ', '');
  },
  // 295.86
  async (tok, S) => {
    S.B.add('1 ± j = √2(cos π/4 ± j sin π/4)'); S.B.add('= √2 e^(±jπ/4)'); S.B.last(); sm('長度 √2', S.OX + 0.15, S.OY + S.U + 0.35); sm('角度 π/4', S.OX + 0.95, S.OY + 0.3); cap('把 √(1² + 1²) = √2 提出來', '1 ± j = √2 e^(±jπ/4)');
  },
  // 316.18
  async (tok, S) => {
    S.B.add('aₙ = α₁(1 + j)ⁿ + α₂(1 − j)ⁿ', 'ptr alt'); S.B.last(); cap('兩根不一樣', '通解還是 n 次方的線性組合');
  },
  // 332.71
  async (tok, S) => {
    S.B.hi(-1); note('到這裡都跟實數根一樣', -3.2, 2.2); cap('到現在為止', '做法都跟實數根一樣');
  },
]);
scene('rr-12c-real', "換參數：β₁ = α₁ + α₂、β₂ = j(α₁ − α₂)", [
  // 346.94
  async (tok, S) => {
    hot('把通解改寫成實數形式', 0, 7.2); S.B = board(0, 6.2, 0.64); S.B.add('aₙ = α₁(√2 e^(jπ/4))ⁿ + α₂(√2 e^(−jπ/4))ⁿ'); cap('再來把式子改寫一下', '為了方便');
  },
  // 358.88
  async (tok, S) => {
    S.B.add('= 2^(n/2) [α₁ e^(jnπ/4) + α₂ e^(−jnπ/4)]'); S.B.last(); cap('n 次方乘進去', '(√2)ⁿ = 2^(n/2)、角度變 n 倍');
  },
  // 386.79
  async (tok, S) => {
    S.B.add('e^(±jnπ/4) = cos(nπ/4) ± j sin(nπ/4)'); S.B.last(); cap('用 e^(jθ) = cos θ + j sin θ', '帶進來');
  },
  // 403.18
  async (tok, S) => {
    S.B.add('cos 的放一起、sin 的放一起'); S.B.last(); cap('兩個 cos 放在一起', 'sin 也放在一起');
  },
  // 418.34
  async (tok, S) => {
    S.B.add('aₙ = 2^(n/2)[(α₁+α₂)cos(nπ/4) + j(α₁−α₂)sin(nπ/4)]', 'ptr alt'); S.B.last(); cap('寫成實部跟虛部', '後面那個負號來自 −j sin');
  },
  // 450.73
  async (tok, S) => {
    S.B.hi(-1); S.x1 = bad('α₁、α₂ 一般可能是複數', -3.2, 2.9); cap('α₁、α₂ in general 可能是複數', '');
  },
  // 465.87
  async (tok, S) => {
    S.x2 = good('aₙ 一定是實數：實數加減乘還是實數', 3.2, 2.9); cap('但 aₙ always 是實數', 'a₀、a₁ 是實數，一直代還是實數');
  },
  // 487.11
  async (tok, S) => {
    S.x3 = note('用複數係數寫是對的，但比較不好', 0, 2.25); cap('寫成複數係數是對的', '但比較不好用');
  },
  // 508.86
  async (tok, S) => {
    gone(S.x1, S.x2, S.x3); S.C = board(0, 2.9, 0.6); S.C.add('令 β₁ = α₁ + α₂', 'good'); cap('把係數換一換', '定義 β₁ = α₁ + α₂');
  },
  // 533.83
  async (tok, S) => {
    S.C.add('令 β₂ = j(α₁ − α₂)', 'good'); cap('β₂ = j(α₁ − α₂)', '用另外兩個參數換掉');
  },
  // 552.87
  async (tok, S) => {
    S.B.hi(-1); S.C.add('aₙ = 2^(n/2) (β₁ cos(nπ/4) + β₂ sin(nπ/4))', 'ptr alt'); S.C.last(); cap('式子變成這樣', '只是換個樣子');
  },
  // 571.48
  async (tok, S) => {
    S.C.hi(-1); good('β₁、β₂ 一定是實數', 0, 1.05); cap('這個形式比較好', 'β₁、β₂ 一定是實數');
  },
  // 598.06
  async (tok, S) => {
    note('代初始條件：cos、sin、aₙ 都是實數 → 聯立方程全實數', 0, 0.45); cap('用 initial condition 決定 β', '聯立方程的係數全是實數');
  },
  // 615.78
  async (tok, S) => {
    note('Gaussian elimination／Cramer 都只用加減乘除 → 解是實數', 0, -0.15); cap('解聯立只用加減乘除', '實數加減乘除還是實數');
  },
  // 643.72
  async (tok, S) => {
    cap('所以用這個形式比較方便', '係數只有實數');
  },
]);
scene('rr-12c-beta', "β₁ = 1、β₂ = 1：aₙ = 2^(n/2)(cos(nπ/4) + sin(nπ/4))", [
  // 664.58
  async (tok, S) => {
    hot('代 initial conditions', 0, 7.2); S.B = board(-2.6, 6.2, 0.66); S.B.add('aₙ = 2^(n/2)(β₁ cos(nπ/4) + β₂ sin(nπ/4))', 'ptr'); cap('用這個形式', '把 initial condition 帶進來');
  },
  // 682.54
  async (tok, S) => {
    S.B.add('n = 0：1 · (β₁·1 + β₂·0) = 1 ⇒ β₁ = 1'); S.B.last(); cap('n 代 0', 'sin 0 = 0，剩 β₁ = 1');
  },
  // 686.34
  async (tok, S) => {
    S.B.add('n = 1：√2(β₁·√2/2 + β₂·√2/2) = β₁ + β₂ = 2'); S.B.last(); cap('n 代 1', 'cos π/4 = sin π/4 = √2/2');
  },
  // 714.59
  async (tok, S) => {
    S.B.add('β₁ = 1，β₂ = 1', 'good'); S.B.last(); cap('β₁ = 1，β₂ = 1', '');
  },
  // 738.33
  async (tok, S) => {
    S.B.add('aₙ = 2^(n/2)(cos(nπ/4) + sin(nπ/4))', 'ptr alt'); S.B.last(); cap('全部解出來了', 'aₙ = 2^(n/2)(cos(nπ/4) + sin(nπ/4))');
  },
  // 750.51
  async (tok, S) => {
    S.B.hi(-1); S.A = seq(0, [1, 2], (a, n) => 2 * a[n - 1] - 2 * a[n - 2], 8); S.Bf = {}; for (let n = 0; n <= 8; n++) S.Bf[n] = Math.pow(2, n / 2) * (Math.cos(n * Math.PI / 4) + Math.sin(n * Math.PI / 4)); S.c = cmp([0, 1, 2, 3, 4, 5, 6, 7, 8], S.A, S.Bf, -3.0, 1.6, '遞迴', '公式'); cap('n 從 0 開始', '公式算出來全是整數 ✓');
  },
]);
scene('rr-12c-rule', "複數根的通解與所有根的情況整理", [
  // 760.8
  async (tok, S) => {
    hot('複數根的通則', 0, 7.2); S.B = board(-2.4, 6.2, 0.68); S.B.add('實係數 → 複數根一定共軛成對'); cap('解出複數根怎麼辦', '一定共軛成對出現');
  },
  // 779.5
  async (tok, S) => {
    S.B.add('一對：λe^(jθ)、λe^(−jθ)'); S.B.last(); S.OX = 3.0; S.OY = 1.6; S.U = 1.3; S.ax = [line(S.OX - 2.2, S.OY, S.OX + 2.6, S.OY, 0, '#8a7a60'), line(S.OX, S.OY - 2.1, S.OX, S.OY + 2.3, 0, '#8a7a60'), sm('Re', S.OX + 2.8, S.OY), sm('Im', S.OX, S.OY + 2.55)]; const c = Math.cos(0.7), s = Math.sin(0.7); S.p1 = bx('', FC.pink, S.OX + 1.6 * S.U * c, S.OY + 1.6 * S.U * s, 0, 0.3, 0.3, 0.3); S.p2 = bx('', FC.pink, S.OX + 1.6 * S.U * c, S.OY - 1.6 * S.U * s, 0, 0.3, 0.3, 0.3); S.ar = [arrow(V3(S.OX, S.OY, 0), V3(S.OX + 1.6 * S.U * c, S.OY + 1.6 * S.U * s, 0), 0x9b7ef4), arrow(V3(S.OX, S.OY, 0), V3(S.OX + 1.6 * S.U * c, S.OY - 1.6 * S.U * s, 0), 0x9b7ef4), sm('長度 λ、角度 ±θ', S.OX + 1.2, S.OY + 2.0)]; cap('一個 λe^(jθ)，一個 λe^(−jθ)', '');
  },
  // 785.8
  async (tok, S) => {
    S.B.add('通解直接跳到 →'); S.B.last(); cap('寫 general solution 時', '直接跳到這個樣子');
  },
  // 852.31
  async (tok, S) => {
    S.B.add('λⁿ (β₁ cos nθ + β₂ sin nθ)', 'ptr alt'); S.B.last(); cap('λⁿ cos nθ 和 λⁿ sin nθ', '前面各有實數係數 β₁、β₂');
  },
  // 863.02
  async (tok, S) => {
    S.B.hi(-1); note('本質還是當複數處理，換成 β 比較方便', -2.4, 2.6); cap('原來還是當複數處理', '換成 β₁、β₂ 比較方便');
  },
  // 896.35
  async (tok, S) => {
    gone(S.ax, S.ar, S.p1, S.p2); good('所有根的情況都處理了', 0, 1.0); cap('所有根的狀況都處理了', '');
  },
  // 910.58
  async (tok, S) => {
    S.t = [fbox('實單根：rⁿ', FC.blue, -4.7, 0.0, 3.0), fbox('實重根：乘 n、n²', FC.purple, 0, 0.0, 3.6), fbox('複數根：λⁿcos、sin', FC.pink, 4.7, 0.0, 3.6)]; cap('實根：單根、重根；複數根：成對', '每種都知道怎麼處理');
  },
  // 932.02
  async (tok, S) => {
    note('k 階 HRR 永遠找得到 k 個獨立解', 0, -0.9); cap('k 階 homogeneous recurrence relation', '永遠可以找到 k 個獨立的解');
  },
  // 943.43
  async (tok, S) => {
    note('剩下的難處只是：解多項式的根', 0, -1.6); cap('整個問題只剩怎麼解多項式的根', '');
  },
  // 970.61
  async (tok, S) => {
    cap('homogeneous recurrence relation 講完了', '再來只是用 initial condition 解係數');
  },
]);

// ════════ Hfc676iknHY（清大OCW 趙啟超《離散數學》第12D講 Recurrence Relations） ════════
scene('rr-12d-nrr', "非齊次：aₙ − c₁aₙ₋₁ − … − cₖaₙ₋ₖ = f(n)", [
  // 3.8
  async (tok, S) => {
    hot('Non-homogeneous recurrence relation', 0, 7.2); cap('開始解 non-homogeneous', 'recurrence relation');
  },
  // 5.65
  async (tok, S) => {
    S.B = board(0, 5.9, 1.0); S.B.add('homogeneous：aₙ − c₁aₙ₋₁ − … − cₖaₙ₋ₖ = 0'); cap('跟 homogeneous 的差別', '原來右邊是 0');
  },
  // 9.65
  async (tok, S) => {
    S.B.add('non-homogeneous：aₙ − c₁aₙ₋₁ − … − cₖaₙ₋ₖ = f(n)', 'ptr alt'); cap('現在右邊不是 0 了', '是一個跟 n 有關的東西');
  },
  // 57.9
  async (tok, S) => {
    S.f = note('f(n)：forcing sequence', 3.6, 4.4); cap('右邊這個叫 f(n)', 'forcing sequence');
  },
  // 91.86
  async (tok, S) => {
    S.B.add('k-th order linear non-homogeneous RR', 'ptr'); S.B.add('with constant coefficients'); note('有些書叫 inhomogeneous，意思一樣', 0, 1.9); cap('把 homogeneous 改成 non-homogeneous', '有些書叫 inhomogeneous');
  },
  // 119.36
  async (tok, S) => {
    sm('後面用縮寫（例如 NRR）', 0, 1.1); cap('名字太長，後面簡寫', '');
  },
  // 141.18
  async (tok, S) => {
    note('也叫 non-homogeneous difference equation', 0, 0.4); cap('或叫 non-homogeneous difference equation', '');
  },
]);
scene('rr-12d-space', "解集合 = 子空間 + 一個固定向量（示意）", [
  // 154.09
  async (tok, S) => {
    hot('解集合長什麼樣？（示意）', 0, 7.2); S.ax = [line(-4.5, 1.5, 4.5, 1.5, 0, '#8a7a60'), line(0, -1.2, 0, 5.8, 0, '#8a7a60')]; S.L0 = line(-3.2, 1.5 - 2.4, 3.2, 1.5 + 2.4, 0, '#4b9ee2'); S.o = bx('', FC.dark, 0, 1.5, 0, 0.22, 0.22, 0.22); good('= 0：solution space 是 subspace（過原點）', -2.6, 5.6); cap('右邊 = 0：solution space 是 subspace', '一定通過原點');
  },
  // 162.56
  async (tok, S) => {
    bad('≠ 0：解集合不是 subspace', 3.3, 4.6); cap('右邊不是 0', 'solution space 就不是 subspace');
  },
  // 170.69
  async (tok, S) => {
    S.L1 = line(-3.2 + 1.4, 1.5 - 2.4 - 1.4, 3.2 + 1.4, 1.5 + 2.4 - 1.4, 0, '#dd8238'); S.ar = arrow(V3(0, 1.5, 0), V3(1.4, 0.1, 0), 0xdd8238); sm('+ 固定向量', 1.3, 0.9); cap('是 subspace 加上一個固定向量', '每個向量都加同一個');
  },
  // 177.79
  async (tok, S) => {
    note('把子空間搬離原點', 4.1, 0.2); cap('就是把它搬離原點', '');
  },
]);
scene('rr-12d-thm1', "aₙ、pₙ 都是解 ⇒ zₙ = aₙ − pₙ 是 homogeneous 的解", [
  // 204.43
  async (tok, S) => {
    hot('還是要藉助 homogeneous 的解', 0, 7.2); S.B = board(0, 6.2, 0.68); cap('怎麼解？', '還是要藉助 homogeneous 的 general solution');
  },
  // 215.56
  async (tok, S) => {
    S.B.add('aₙ：NRR 的任何一個解', 'ptr'); cap('假設 aₙ 是任何一個解', '');
  },
  // 229.77
  async (tok, S) => {
    S.B.add('pₙ：某一個特別解（particular solution）', 'ptr alt'); cap('pₙ 是一個特別解', '某一個固定的解');
  },
  // 245.64
  async (tok, S) => {
    S.B.add('（先不管 initial conditions，最後才用來定係數）', 'note'); cap('先不管 initial condition', '最後再拿來決定係數');
  },
  // 261.51
  async (tok, S) => {
    S.B.add('aₙ − c₁aₙ₋₁ − … − cₖaₙ₋ₖ = f(n)'); S.B.last(); cap('aₙ 是解', '代進去會滿足');
  },
  // 278.85
  async (tok, S) => {
    S.B.add('pₙ − c₁pₙ₋₁ − … − cₖpₙ₋ₖ = f(n)'); S.B.last(); cap('pₙ 也是解', '也滿足同一條式子');
  },
  // 289.56
  async (tok, S) => {
    S.B.hi(-1); S.mn = bub('上 − 下', 5.4, 3.8); cap('兩個式子相減', '');
  },
  // 314.91
  async (tok, S) => {
    S.B.add('(aₙ − pₙ) − c₁(aₙ₋₁ − pₙ₋₁) − … − cₖ(aₙ₋ₖ − pₙ₋ₖ)'); S.B.last(); cap('同樣的 c 提出來', 'aₙ − pₙ、aₙ₋₁ − pₙ₋₁ …');
  },
  // 326.53
  async (tok, S) => {
    S.B.add('= f(n) − f(n) = 0', 'good'); S.B.last(); cap('右邊 f(n) − f(n) = 0', '');
  },
  // 376.56
  async (tok, S) => {
    gone(S.mn); S.B.hi(-1); good('aₙ − pₙ 是 homogeneous 的解！', 0, 1.0); cap('所以 aₙ − pₙ', '是 homogeneous 的解');
  },
  // 390.65
  async (tok, S) => {
    hot('記 zₙ = aₙ − pₙ', 0, 0.2); cap('把 aₙ − pₙ 叫做 zₙ', 'zₙ 是對應 HRR 的解');
  },
]);
scene('rr-12d-thm2', "NRR 通解 = HRR 通解 zₙ + 一個特解 pₙ", [
  // 419.74
  async (tok, S) => {
    hot('反過來的方向', 0, 7.2); S.B = board(0, 6.2, 0.66); cap('另外一個方向', '反過來');
  },
  // 445.8
  async (tok, S) => {
    S.B.add('zₙ：HRR 的任何一個解；pₙ：NRR 的一個特別解', 'ptr'); cap('zₙ 是 homogeneous 任何一個解', 'pₙ 是 non-homogeneous 一個特別解');
  },
  // 468.73
  async (tok, S) => {
    S.B.add('zₙ − c₁zₙ₋₁ − … − cₖzₙ₋ₖ = 0'); S.B.add('pₙ − c₁pₙ₋₁ − … − cₖpₙ₋ₖ = f(n)'); cap('zₙ 滿足右邊是 0', 'pₙ 滿足右邊是 f(n)');
  },
  // 476.5
  async (tok, S) => {
    S.pl = bub('上 + 下', 4.6, 4.2); cap('把兩個式子加起來', '');
  },
  // 507.47
  async (tok, S) => {
    gone(S.pl); S.B.add('(zₙ + pₙ) − c₁(zₙ₋₁ + pₙ₋₁) − … − cₖ(zₙ₋ₖ + pₙ₋ₖ) = f(n)'); S.B.last(); cap('同樣係數提出來', '右邊 0 + f(n) = f(n)');
  },
  // 517.48
  async (tok, S) => {
    S.B.add('⇒ zₙ + pₙ 是 NRR 的解', 'good'); S.B.last(); cap('zₙ + pₙ 是 non-homogeneous 的解', '');
  },
  // 542.43
  async (tok, S) => {
    S.B.hi(-1); S.n1 = note('① 任何解都可以寫成 zₙ + pₙ　② 任何 zₙ + pₙ 都是解', 0, 2.4); cap('這兩步做了什麼？', '兩個方向');
  },
  // 586.77
  async (tok, S) => {
    S.h = hot('若且唯若：解 ⇔ zₙ + pₙ', 0, 1.7); cap('若且唯若', '兩個方向都推了');
  },
  // 631.8
  async (tok, S) => {
    gone(S.B, S.n1, S.h); S.B = board(-2.6, 6.2, 0.7); S.B.add('NRR general solution：aₙ = zₙ + pₙ', 'ptr alt'); cap('NRR 的 general solution', 'aₙ = zₙ + pₙ');
  },
  // 643.13
  async (tok, S) => {
    S.B.add('zₙ = HRR 的 general solution'); S.B.last(); cap('zₙ：先解對應 HRR 的 general solution', '');
  },
  // 660.12
  async (tok, S) => {
    S.B.add('pₙ = 任何一個 particular solution'); S.B.last(); cap('再加上任何一個特別解', '');
  },
  // 684.48
  async (tok, S) => {
    S.B.hi(-1); S.z = vrow('zₙ', [3 / 2, 7 / 2, 13 / 2, 27 / 2], 1.4, 3.6, FC.blue, 1.0); S.p = vrow('pₙ', [-1 / 2, -1 / 2, -1 / 2, -1 / 2], 1.4, 2.8, FC.orange, 1.0); S.a = vrow('aₙ', [1, 3, 6, 13], 1.4, 2.0, FC.green, 1.0); sm('n = 1, 2, 3, 4（下一題的數字）', 2.9, 1.3); cap('只要找一個，不管怎麼找到', '兩個加起來就是通解');
  },
  // 713.22
  async (tok, S) => {
    note('跟解微分方程一樣：齊次解 + 特解', -2.6, 0.4); cap('就跟解微分方程一樣', '');
  },
]);
scene('rr-12d-ex', "例：aₙ − aₙ₋₁ − 2aₙ₋₂ = 1，a₁ = 1、a₂ = 3", [
  // 735.52
  async (tok, S) => {
    hot('例：非齊次（右邊是常數）', 0, 7.2); cap('我們看一個例子', '');
  },
  // 751.83
  async (tok, S) => {
    S.B = board(-3.0, 6.2, 0.66); S.B.add('aₙ − aₙ₋₁ − 2aₙ₋₂ = 1', 'ptr'); note('二階、右邊 = 1 ≠ 0', 3.2, 6.2); cap('second order，右邊是 constant 1', '');
  },
  // 762.59
  async (tok, S) => {
    S.B.add('a₁ = 1，a₂ = 3，n ≥ 3'); S.a = seq(1, [1, 3], (a, n) => a[n - 1] + 2 * a[n - 2] + 1, 4); S.st = strip('a', 1, 4, 1.4, 3.8); S.st.put(1, 1, FC.orange); S.st.put(2, 3, FC.orange); S.st.put(3, S.a[3]); S.st.put(4, S.a[4]); sm('a₃ = 3 + 2·1 + 1 = 6', 2.7, 2.6); cap('a₁ = 1、a₂ = 3，n ≥ 3', 'well-defined');
  },
  // 773.47
  async (tok, S) => {
    S.B.add('先解對應 HRR（右邊換成 0）', 'ptr alt'); S.B.add('aₙ − aₙ₋₁ − 2aₙ₋₂ = 0'); cap('先解對應的 homogeneous', '右邊是 0 的');
  },
  // 791.77
  async (tok, S) => {
    S.B.hi(-1); S.B.add('特徵方程 r² − r − 2 = 0'); S.B.last(); cap('characteristic equation', 'r² − r − 2 = 0');
  },
  // 807.71
  async (tok, S) => {
    S.B.add('(r − 2)(r + 1) = 0 → r = 2, −1'); S.B.last(); cap('直接分解因式', 'r = 2 或 −1');
  },
  // 819.94
  async (tok, S) => {
    S.B.add('zₙ = α₁2ⁿ + α₂(−1)ⁿ', 'good'); S.B.last(); cap('HRR 的 general solution', 'α₁2ⁿ + α₂(−1)ⁿ');
  },
]);
scene('rr-12d-part', "猜 pₙ = b：b − b − 2b = 1 → b = −1/2", [
  // 845.66
  async (tok, S) => {
    hot('多出來的一步：找一個特解', 0, 7.2); S.B = board(-2.8, 6.2, 0.66); S.B.add('aₙ = zₙ + pₙ，zₙ 已經有了', 'ptr'); cap('找一個 particular solution', '');
  },
  // 863.55
  async (tok, S) => {
    S.B.add('只要找「一個」就好'); S.B.last(); cap('不必找全部', '找一個特別解就好');
  },
  // 878.66
  async (tok, S) => {
    S.B.add('先不管 initial conditions'); S.B.last(); cap('不要管 initial condition', '最後再用');
  },
  // 889.84
  async (tok, S) => {
    S.B.add('方法：猜一個樣子 → 解得出來就對'); S.B.last(); cap('怎麼找？猜一個樣子', '解得出來＝猜對');
  },
  // 909.32
  async (tok, S) => {
    S.B.add('右邊什麼樣子就猜什麼樣子', 'ptr alt'); S.B.last(); cap('最簡單的 rule', '右邊什麼樣子就猜什麼樣子');
  },
  // 925.13
  async (tok, S) => {
    S.B.hi(-1); S.C = board(2.8, 6.2, 0.66); S.C.add('f(n) = 1 是 constant', 'ptr'); S.C.add('猜 pₙ = b（跟 n 無關）', 'good'); cap('右邊是 constant', '就猜 constant：pₙ = b');
  },
  // 955.78
  async (tok, S) => {
    S.C.add('代入：b − b − 2b = 1'); S.C.last(); cap('pₙ、pₙ₋₁、pₙ₋₂ 都是 b', 'b − b − 2b = 1');
  },
  // 980.62
  async (tok, S) => {
    S.C.add('−2b = 1 → b = −1/2', 'good'); S.C.last(); S.v = vrow('pₙ', [-1 / 2, -1 / 2, -1 / 2], 1.6, 2.6, FC.orange); sm('檢查：−1/2 − (−1/2) − 2(−1/2) = 1 ✓', 2.4, 1.8); cap('左邊剩 −2b', 'b = −1/2');
  },
  // 992
  async (tok, S) => {
    S.C.hi(-1); note('原則：看右邊的樣子去猜（後面會有變化）', 0, 0.9); cap('通常就是右邊什麼樣子', '就猜什麼樣子');
  },
  // 1018.74
  async (tok, S) => {
    hot('aₙ = α₁2ⁿ + α₂(−1)ⁿ − 1/2', 0, 0.0); cap('整個 general solution', '齊次通解 + 特解');
  },
]);
scene('rr-12d-const', "α₁ = 5/6、α₂ = 1/6", [
  // 1058.94
  async (tok, S) => {
    hot('用 initial conditions 決定 α₁、α₂', 0, 7.2); S.B = board(-2.4, 6.2, 0.66); S.B.add('aₙ = α₁2ⁿ + α₂(−1)ⁿ − 1/2', 'ptr'); cap('最後兩個 constant', '用 initial condition 決定');
  },
  // 1072.61
  async (tok, S) => {
    S.B.add('n = 1：2α₁ − α₂ − 1/2 = 1'); S.B.last(); cap('a₁ = 1：n 用 1 代', '2α₁ − α₂ − 1/2 = 1');
  },
  // 1077.24
  async (tok, S) => {
    S.B.add('n = 2：4α₁ + α₂ − 1/2 = 3'); S.B.last(); cap('a₂ = 3：n 用 2 代', '4α₁ + α₂ − 1/2 = 3');
  },
  // 1093.16
  async (tok, S) => {
    S.B.add('相加：6α₁ = 5 → α₁ = 5/6，α₂ = 1/6', 'good'); S.B.last(); cap('二元一次聯立', 'α₁ = 5/6，α₂ = 1/6');
  },
  // 1107.42
  async (tok, S) => {
    S.B.add('aₙ = (5/6)2ⁿ + (1/6)(−1)ⁿ − 1/2', 'ptr alt'); S.B.last(); S.A = seq(1, [1, 3], (a, n) => a[n - 1] + 2 * a[n - 2] + 1, 7); S.Bf = {}; for (let n = 1; n <= 7; n++) S.Bf[n] = 5 / 6 * Math.pow(2, n) + Math.pow(-1, n) / 6 - 1 / 2; S.c = cmp([1, 2, 3, 4, 5, 6, 7], S.A, S.Bf, -2.4, 1.4, '遞迴', '公式'); cap('最後答案', '帶回去檢查');
  },
  // 1111.4
  async (tok, S) => {
    S.B.hi(-1); note('= 齊次通解 + 特解', 3.6, 4.2); cap('兩部分', '前面是 homogeneous 的，後面是 particular');
  },
  // 1146.98
  async (tok, S) => {
    bad('樣子不對 → 換樣子', 3.8, 3.5); cap('試什麼樣子解不出來', '就表示樣子不對，要試別的');
  },
  // 1170.89
  async (tok, S) => {
    note('下一講：什麼 f(n) 要猜什麼樣子', 3.6, 2.8); cap('後面再講', '什麼樣子要怎麼猜');
  },
]);

// ════════ eWIlWXtnDzY（清大OCW 趙啟超《離散數學》第13A講 Recurrence Relations） ════════
scene('rr-13a-review', "複習：非齊次 = 齊次通解 + 猜一個特解", [
  // 4.52
  async (tok, S) => {
    hot('複習：non-homogeneous recurrence relation', 0, 7.2); S.B = board(0, 6.1, 0.72); S.B.add('aₙ − c₁aₙ₋₁ − … − cₖaₙ₋ₖ = f(n)', 'ptr'); cap('上次教到 non-homogeneous recurrence relation', '');
  },
  // 22.28
  async (tok, S) => {
    S.B.add('右邊 f(n)：forcing sequence（跟 n 有關）'); S.B.last(); cap('右邊不是零', '是 forcing sequence f(n)');
  },
  // 35.8
  async (tok, S) => {
    S.f1 = fbox('① HRR 通解 zₙ', FC.sky, -4.3, 3.4, 3.4); cap('先解 homogeneous 的 general solution', '');
  },
  // 42.58
  async (tok, S) => {
    S.f2 = fbox('② 猜一個特解 pₙ', FC.sand, 0, 3.4, 3.6); S.f3 = fbox('③ aₙ = zₙ + pₙ', FC.mint, 4.3, 3.4, 3.4); cap('再猜一個 particular solution', '兩個加起來就是 general solution');
  },
  // 56.46
  async (tok, S) => {
    glow(S.f2, HL); cap('多的一步就是要去猜', 'particular solution');
  },
  // 71.22
  async (tok, S) => {
    note('上次：f(n) 是 constant → 設 pₙ = constant', 0, 2.2); cap('上次右邊是 constant', '就設一個 constant');
  },
  // 83.78
  async (tok, S) => {
    good('解得出來 → 樣子對', -2.2, 1.3); bad('解不出來 → 樣子錯', 2.2, 1.3); cap('猜的樣子帶進去解得出來', '表示猜的樣子是對的');
  },
]);
scene('rr-13a-trial', "Trial sequence：常數、多項式、λⁿ、cos／sin", [
  // 92.6
  async (tok, S) => {
    S.T = hot('要怎麼猜？', 0, 7.2); S.h1 = hd('f(n) 長這樣', -2.8, 6.3); S.h2 = hd('試解 pₙ 設成', 2.8, 6.3); S.L = board(-2.8, 5.6, 0.46); S.R = board(2.8, 5.6, 0.46); cap('要怎麼猜？', '');
  },
  // 95.7
  async (tok, S) => {
    cap('看 f(n) 什麼樣子', '就設成類似的樣子');
  },
  // 125.62
  async (tok, S) => {
    S.t1 = note('試的數列叫 trial sequence', 0, 1.35); cap('這叫 trial sequence', '再把它帶進去');
  },
  // 135.32
  async (tok, S) => {
    S.L.add('常數 c'); S.R.add('B'); S.R.last(); cap('constant：跟 n 無關', '就設一個 constant');
  },
  // 156.31
  async (tok, S) => {
    S.L.add('一次式 b₁n + b₀'); S.R.add('B₁n + B₀'); S.R.last(); cap('n 的一次式', '就設一次式，兩個係數');
  },
  // 183.28
  async (tok, S) => {
    gone(S.t1); S.t2 = bad('f(n) 只有 b₁n 也要設 B₁n + B₀', 0, 1.35); cap('就算只有 b₁n', '兩個係數都要設');
  },
  // 208.82
  async (tok, S) => {
    S.L.add('m 次多項式'); S.R.add('Bₘnᵐ + … + B₁n + B₀'); S.R.last(); cap('二次就設二次', 'm 次就設 m 次');
  },
  // 245.98
  async (tok, S) => {
    S.R.set(S.R.ls.length - 1, 'Bₘnᵐ + … + B₀（m + 1 個係數全設）'); cap('不管有幾項', '最高 m 次就全部都設');
  },
  // 271.54
  async (tok, S) => {
    S.L.add('c·λⁿ'); S.R.add('B·λⁿ'); S.R.last(); cap('n 在指數上', '指數 λⁿ 就設 Bλⁿ');
  },
  // 294.17
  async (tok, S) => {
    gone(S.t2); S.t3 = sm('例：f(n) = 2ⁿ → 設 B·2ⁿ', 0, 1.35); cap('例如 2ⁿ', '就設 B·2ⁿ');
  },
  // 304.55
  async (tok, S) => {
    S.L.add('(b₁n + b₀)·λⁿ'); S.R.add('(B₁n + B₀)·λⁿ'); S.R.last(); cap('λⁿ 前面乘一次式', '也設一次式乘 λⁿ');
  },
  // 338.98
  async (tok, S) => {
    S.L.add('(m 次多項式)·λⁿ'); S.R.add('(m 次多項式)·λⁿ'); S.R.last(); cap('最廣的：多項式乘 λⁿ', '一樣它什麼樣子就設什麼樣子');
  },
  // 374.73
  async (tok, S) => {
    S.L.add('b·cos nθ'); S.R.add('B₁cos nθ + B₂sin nθ'); S.R.last(); cap('n 在 cos 裡面', '要設 cos 和 sin 兩個');
  },
  // 401
  async (tok, S) => {
    S.L.add('b·sin nθ'); S.R.add('B₁cos nθ + B₂sin nθ'); S.R.last(); cap('只有 sin nθ', '還是要設兩個');
  },
  // 417.97
  async (tok, S) => {
    S.L.add('λⁿ·cos nθ'); S.R.add('λⁿ(B₁cos nθ + B₂sin nθ)'); S.R.last(); cap('再乘上 λⁿ', '每個都乘 λⁿ 就對了');
  },
  // 470.76
  async (tok, S) => {
    S.R.hi(-1); gone(S.t1, S.t2, S.t3); txt(S.T, '原則：f(n) 什麼樣子，試解就設什麼樣子'); S.T.element.className = 'lab-label good'; cap('基本上就是', '它什麼樣子就設什麼樣子');
  },
  // 486.73
  async (tok, S) => {
    S.t4 = note('只要找到一個 particular solution 就好', 0, 0.85); cap('只要找一個 particular solution', '任何一個都 OK');
  },
  // 495.41
  async (tok, S) => {
    gone(S.t4); note('只要找一個特解；f(n) 不只這些，但常見的大都在表裡', 0, 0.85); cap('f(n) 當然不只這些', '常見的大概都在這裡');
  },
]);
scene('rr-13a-ex', "一階非齊次：aₙ − 2aₙ₋₁ = n，設 pₙ = B₁n + B₀", [
  // 522.03
  async (tok, S) => {
    hot('例：一階非齊次', 0, 7.2); cap('我們看一個例子', '重點是怎麼找 particular solution');
  },
  // 555.79
  async (tok, S) => {
    S.B = board(-3.0, 6.2, 0.5); S.B.add('aₙ − 2aₙ₋₁ = n，a₀ = 1', 'ptr'); cap('First order 的 non-homogeneous', '一個 initial condition：a₀ = 1');
  },
  // 564.13
  async (tok, S) => {
    S.a = seq(0, [1], (a, n) => 2 * a[n - 1] + n, 3); S.st = strip('a', 0, 3, 1.6, 5.6); S.st.put(0, 1, FC.orange); for (let n = 1; n <= 3; n++) { S.st.put(n, S.a[n]); await wt(tok, 250); } S.st.all.push(sm('a₁ = 2·1 + 1 = 3', 2.9, 4.4)); cap('n = 1：a₁ 用 a₀ 得到', 'well-defined');
  },
  // 582.35
  async (tok, S) => {
    S.B.add('HRR：aₙ − 2aₙ₋₁ = 0 → r − 2 = 0'); S.B.last(); cap('先解 homogeneous', 'characteristic equation r − 2 = 0');
  },
  // 593.95
  async (tok, S) => {
    S.B.add('r = 2 → zₙ = α·2ⁿ', 'good'); S.B.last(); cap('r = 2', '通解 α·2ⁿ');
  },
  // 616.87
  async (tok, S) => {
    S.B.add('f(n) = n（一次式）→ 設 pₙ = B₁n + B₀', 'ptr alt'); S.B.last(); cap('右邊是 n 的一次式', '設一次式，兩個係數都要有');
  },
  // 656.9
  async (tok, S) => {
    S.B.hi(-1); S.C = board(0.4, 3.5, 0.62); S.C.add('代入 pₙ − 2pₙ₋₁ = n'); cap('把 pₙ 帶進去', '要滿足 non-homogeneous');
  },
  // 685.85
  async (tok, S) => {
    S.C.add('B₁n + B₀ − 2[B₁(n − 1) + B₀]'); S.C.last(); cap('pₙ₋₁：n 用 n − 1 代', 'B₁(n − 1) + B₀');
  },
  // 700.62
  async (tok, S) => {
    S.C.add('= −B₁n + (2B₁ − B₀) = n'); S.C.last(); cap('整理：n 的項、常數項', '−B₁n + 2B₁ − B₀');
  },
  // 733.67
  async (tok, S) => {
    S.C.add('兩邊是多項式 → 係數要相等', 'note'); cap('兩邊都是多項式', '要相等就是係數要相等');
  },
  // 739.8
  async (tok, S) => {
    S.C.add('n 的係數：−B₁ = 1 → B₁ = −1', 'good'); S.C.last(); cap('一次項：−B₁ = 1', 'B₁ = −1');
  },
  // 744.57
  async (tok, S) => {
    S.C.add('常數：2B₁ − B₀ = 0 → B₀ = −2', 'good'); S.C.last(); cap('常數項：2B₁ − B₀ = 0', 'B₀ = −2');
  },
  // 756.72
  async (tok, S) => {
    S.C.hi(-1); S.bd = bad('若沒設 B₀：常數項 2B₁ = −2 ≠ 0 → 矛盾', 0.4, -0.3); cap('如果沒有設 B₀', '就會 inconsistent');
  },
  // 779.82
  async (tok, S) => {
    S.pp = hot('pₙ = −n − 2', 0.4, -1.0); cap('particular solution', 'pₙ = −n − 2');
  },
  // 796.16
  async (tok, S) => {
    gone(S.C, S.bd, S.pp); S.B.add('pₙ = −n − 2', 'good'); S.B.add('aₙ = α·2ⁿ − n − 2', 'ptr alt'); S.B.last(); cap('加回 homogeneous 的通解', 'aₙ = α2ⁿ − n − 2');
  },
  // 830.66
  async (tok, S) => {
    S.B.add('還有一個係數 α：用 initial condition'); S.B.last(); cap('還有一個係數 α', '用 initial condition 找');
  },
  // 846.87
  async (tok, S) => {
    S.B.add('a₀ = 1：α − 0 − 2 = 1 → α = 3', 'good'); S.B.last(); cap('a₀ = 1，n 代 0', 'α − 2 = 1 → α = 3');
  },
  // 865.93
  async (tok, S) => {
    S.B.add('aₙ = 3·2ⁿ − n − 2', 'ptr alt'); S.B.last(); cap('最後的答案', 'aₙ = 3·2ⁿ − n − 2');
  },
  // 885.89
  async (tok, S) => {
    S.B.clear(); gone(S.st); S.B.add('aₙ = 3·2ⁿ − n − 2（n ≥ 0）', 'ptr alt'); S.A = seq(0, [1], (a, n) => 2 * a[n - 1] + n, 6); S.Bf = {}; for (let n = 0; n <= 6; n++) S.Bf[n] = 3 * Math.pow(2, n) - n - 2; S.c = cmp([0, 1, 2, 3, 4, 5, 6], S.A, S.Bf, -1.6, 3.4, '遞迴', '公式'); cap('n 從 0 開始', '後面所有的 n 都滿足');
  },
  // 895.97
  async (tok, S) => {
    note('非齊次多的部分：找 particular solution', 0, 0.9); cap('多的部分就是', '找一個 particular solution');
  },
]);

// ════════ oUULN2JwYbw（清大OCW 趙啟超《離散數學》第13B講 Recurrence Relations） ════════
scene('rr-13b-hom', "例：aₙ₊₂ − 4aₙ₊₁ + 4aₙ = 2ⁿ，齊次通解 α₁2ⁿ + α₂n2ⁿ", [
  // 4.3
  async (tok, S) => {
    hot('再看一個例子', 0, 7.2); cap('我們再看一個例子', '');
  },
  // 32.49
  async (tok, S) => {
    S.B = board(-3.0, 6.2, 0.62); S.B.add('aₙ₊₂ − 4aₙ₊₁ + 4aₙ = 2ⁿ，n ≥ 0', 'ptr'); cap('aₙ₊₂ − 4aₙ₊₁ + 4aₙ = 2ⁿ', 'n ≥ 0');
  },
  // 41.91
  async (tok, S) => {
    S.B.add('跟前兩個有關 → second order'); S.B.last(); cap('這是 second order', '跟前面兩個有關');
  },
  // 46.83
  async (tok, S) => {
    S.B.add('a₀ = 0，a₁ = 0'); S.B.last(); S.a = seq(0, [0, 0], (a, n) => 4 * a[n - 1] - 4 * a[n - 2] + Math.pow(2, n - 2), 4); S.st = strip('a', 0, 4, 1.4, 5.6); S.st.put(0, 0, FC.orange); S.st.put(1, 0, FC.orange); cap('a₀ 跟 a₁ 都是 0', '二階要兩個 initial condition');
  },
  // 53.95
  async (tok, S) => {
    for (let n = 2; n <= 4; n++) { S.st.put(n, S.a[n]); await wt(tok, 250); } S.st.all.push(sm('n = 0：a₂ = 4·0 − 4·0 + 2⁰ = 1', 3.1, 4.4)); cap('n = 0 代進去得到 a₂', 'a₃ 跟 a₂、a₁ 有關');
  },
  // 62.99
  async (tok, S) => {
    S.B.add('✓ well-defined（先確認）', 'good'); S.B.last(); cap('看到題目先確定定義沒問題', '不是 well-defined 就解不出來');
  },
  // 84.8
  async (tok, S) => {
    S.B.add('先解 HRR：右邊換成 0'); S.B.last(); cap('先解 homogeneous', '右邊等於 0');
  },
  // 104.37
  async (tok, S) => {
    S.B.add('r² − 4r + 4 = 0', 'ptr alt'); S.B.last(); cap('代 rⁿ', '特徵方程 r² − 4r + 4 = 0');
  },
  // 125.47
  async (tok, S) => {
    S.B.add('(r − 2)² = 0 → r = 2 是 double root'); S.B.last(); cap('解出來發現是重根', '完全平方，double root');
  },
  // 157.03
  async (tok, S) => {
    S.B.add('2ⁿ 是解，但需要 2 個獨立解'); S.B.last(); cap('一個是 2ⁿ', '但需要兩個獨立的解');
  },
  // 172.77
  async (tok, S) => {
    S.B.add('重根 → 再乘 n：n·2ⁿ 也是解'); S.B.last(); cap('double root 就再乘一個 n', '');
  },
  // 185.71
  async (tok, S) => {
    S.B.add('zₙ = α₁2ⁿ + α₂n·2ⁿ', 'good'); S.B.last(); cap('HRR 的 general solution', 'α₁2ⁿ + α₂n2ⁿ');
  },
]);
scene('rr-13b-try1', "試 B·2ⁿ：B·2ⁿ(4 − 8 + 4) = 0 ≠ 2ⁿ", [
  // 203.74
  async (tok, S) => {
    hot('找 particular solution：右邊是 2ⁿ', 0, 7.2); S.B = board(0, 6.2, 0.66); S.B.add('aₙ₊₂ − 4aₙ₊₁ + 4aₙ = 2ⁿ', 'ptr'); cap('再來解 non-homogeneous', '右邊是 2ⁿ');
  },
  // 210.36
  async (tok, S) => {
    S.cd0 = fbox('B·2ⁿ', FC.sand, -3.6, -0.9, 2.4); S.B.add('照表：試 pₙ = B·2ⁿ'); S.B.last(); cap('照前面的表', 'try B·2ⁿ');
  },
  // 260.78
  async (tok, S) => {
    S.B.add('pₙ 當作 aₙ 帶進去'); S.B.last(); cap('把它帶進去', '');
  },
  // 289.75
  async (tok, S) => {
    S.B.add('B·2ⁿ⁺² − 4B·2ⁿ⁺¹ + 4B·2ⁿ = 2ⁿ'); S.B.last(); cap('aₙ₊₂ 用 B·2ⁿ⁺² 代', '要等於右邊 2ⁿ');
  },
  // 302.65
  async (tok, S) => {
    S.B.add('每一項都有 B·2ⁿ → 提出來'); S.B.last(); cap('每一項都有 B·2ⁿ', '把它提出來');
  },
  // 314.7
  async (tok, S) => {
    S.B.add('B·2ⁿ (2² − 4·2 + 4)'); S.B.last(); cap('剩下 2² = 4、4·2 = 8、4', '');
  },
  // 338.07
  async (tok, S) => {
    S.B.add('= B·2ⁿ · 0 = 0', 'bad'); S.B.last(); cap('4 − 8 + 4 = 0', '左邊是 0');
  },
  // 350.32
  async (tok, S) => {
    S.B.hi(-1); bad('左邊 0 ≠ 右邊 2ⁿ', -3.2, 0.7); cap('左邊是 0，右邊要 2ⁿ', '');
  },
  // 354.59
  async (tok, S) => {
    note('不管 B 怎麼選都不會相等', -3.2, 0.1); cap('不管 B 怎麼選', '都找不到');
  },
  // 371.26
  async (tok, S) => {
    relabel(S.cd0, 'B·2ⁿ ✘'); tint(S.cd0, FC.gray); hot('⇒⇐ contradiction（矛盾）', 3.4, 0.7); cap('這是矛盾的', '推過去推過來 = contradiction');
  },
  // 384.09
  async (tok, S) => {
    good('原因：2ⁿ 是 homogeneous 的解！', 3.4, 0.1); cap('為什麼？', '因為 2ⁿ 是 homogeneous 的解');
  },
  // 401.08
  async (tok, S) => {
    cap('所以這樣設就不行', '知道問題出在哪裡了');
  },
]);
scene('rr-13b-try2', "試 B·n·2ⁿ：4(n+2) − 8(n+1) + 4n = 0", [
  // 431.94
  async (tok, S) => {
    hot('乘一個 n 再試試看', 0, 7.2); S.cd0 = fbox('B·2ⁿ ✘', FC.gray, -3.6, -0.9, 2.4); S.cd1 = fbox('B·n·2ⁿ', FC.sand, 0, -0.9, 2.4); S.B = board(0, 6.2, 0.7); S.B.add('試 pₙ = B·n·2ⁿ', 'ptr'); cap('把它乘一個 n', '再試試看');
  },
  // 449.22
  async (tok, S) => {
    S.B.add('B(n+2)2ⁿ⁺² − 4B(n+1)2ⁿ⁺¹ + 4Bn·2ⁿ = 2ⁿ'); S.B.last(); cap('帶進去', 'aₙ₊₂ 就把 n 換成 n + 2');
  },
  // 493.22
  async (tok, S) => {
    S.B.add('B·2ⁿ [4(n+2) − 8(n+1) + 4n]'); S.B.last(); cap('還是把 B·2ⁿ 提出來', '');
  },
  // 531.66
  async (tok, S) => {
    S.B.add('= B·2ⁿ [(4 − 8 + 4)n + (8 − 8)] = 0', 'bad'); S.B.last(); cap('4n − 8n + 4n = 0；8 − 8 = 0', '');
  },
  // 543.15
  async (tok, S) => {
    S.B.hi(-1); relabel(S.cd1, 'B·n·2ⁿ ✘'); tint(S.cd1, FC.gray); bad('還是 0 → 還是矛盾', 0, 2.6); cap('乘一個 n 帶進去還是 0', '還是解不出來');
  },
  // 559.67
  async (tok, S) => {
    good('因為 2 是 double root', 0, 1.8); cap('因為剛才是 double root', '2 是二重根');
  },
  // 571.53
  async (tok, S) => {
    note('n·2ⁿ 也是 homogeneous 的解 → 左邊當然 0', 0, 1.0); cap('n·2ⁿ 也是 HRR 的解', '帶進去左邊當然是 0');
  },
]);
scene('rr-13b-try3', "試 B·n²·2ⁿ：4(n+2)² − 8(n+1)² + 4n² = 8", [
  // 604.86
  async (tok, S) => {
    hot('再乘一個 n', 0, 7.2); S.cd0 = fbox('B·2ⁿ ✘', FC.gray, -3.6, -0.9, 2.4); S.cd1 = fbox('B·n·2ⁿ ✘', FC.gray, 0, -0.9, 2.4); S.cd2 = fbox('B·n²·2ⁿ', FC.sand, 3.6, -0.9, 2.4); S.B = board(0, 6.2, 0.62); S.B.add('試 pₙ = B·n²·2ⁿ', 'ptr'); cap('我再把它乘一個 n', '');
  },
  // 615.49
  async (tok, S) => {
    S.B.add('B(n+2)²2ⁿ⁺² − 4B(n+1)²2ⁿ⁺¹ + 4Bn²2ⁿ = 2ⁿ'); S.B.last(); cap('多乘一個 n 再帶進去', '');
  },
  // 648.56
  async (tok, S) => {
    S.B.add('B·2ⁿ [4(n+2)² − 8(n+1)² + 4n²] = 2ⁿ'); S.B.last(); cap('一樣把 B·2ⁿ 提出來', '');
  },
  // 689.2
  async (tok, S) => {
    S.B.add('4(n+2)² = 4n² + 16n + 16'); S.B.last(); cap('(n + 2)² = n² + 4n + 4', '乘 4');
  },
  // 700.99
  async (tok, S) => {
    S.B.add('8(n+1)² = 8n² + 16n + 8'); S.B.last(); cap('(n + 1)² = n² + 2n + 1', '乘 8');
  },
  // 715.33
  async (tok, S) => {
    S.B.add('n²：4 − 8 + 4 = 0；n：16 − 16 = 0'); S.B.last(); cap('n² 消掉，n 也消掉', '');
  },
  // 748.83
  async (tok, S) => {
    S.B.add('常數：16 − 8 = 8', 'good'); S.B.last(); cap('常數項剩 16 − 8 = 8', '終於不是 0 了');
  },
  // 764.59
  async (tok, S) => {
    S.B.add('8B·2ⁿ = 2ⁿ'); S.B.last(); cap('兩邊相等', '8B = 1');
  },
  // 775.55
  async (tok, S) => {
    S.B.add('B = 1/8', 'good'); S.B.last(); relabel(S.cd2, 'B·n²·2ⁿ ✓'); tint(S.cd2, FC.green); cap('B = 1/8', '解出來了！');
  },
  // 805.38
  async (tok, S) => {
    S.B.clear(); S.B.add('8B·2ⁿ = 2ⁿ → B = 1/8', 'good'); S.pp = hot('pₙ = (1/8) n² 2ⁿ', 0, 5.3); S.v = {}; for (let n = 0; n <= 3; n++) S.v[n] = n * n * Math.pow(2, n) / 8; sm('檢查 n=1：p₃ − 4p₂ + 4p₁ = ' + fmt(S.v[3] - 4 * S.v[2] + 4 * S.v[1]) + ' = 2¹ ✓', 0, 4.6); cap('particular solution', 'pₙ = n²2ⁿ/8');
  },
  // 816.56
  async (tok, S) => {
    S.q = note('為什麼不設 (B₂n² + B₁n + B₀)·2ⁿ？', 0, 3.6); cap('為什麼不設完整的二次式？', 'B₂n² + B₁n + B₀');
  },
  // 830.78
  async (tok, S) => {
    sm('B₁n·2ⁿ、B₀·2ⁿ 代進去都是 0，係數不會出現', 0, 2.9); cap('後面兩項帶進去就是 0', '設了係數也根本不會出現');
  },
  // 851.84
  async (tok, S) => {
    note('2ⁿ、n·2ⁿ 都是 HRR 的解', 0, 2.2); cap('因為 2ⁿ 跟 n·2ⁿ', '都是 homogeneous 的解');
  },
  // 864.14
  async (tok, S) => {
    good('以後看到 double root：直接設 B·n²·2ⁿ', 0, 1.3); cap('以後做多了', '看到 double root 直接寫 n²');
  },
]);
scene('rr-13b-ic', "α₁ = 0、α₂ = −1/8：aₙ = n(n − 1)2ⁿ⁻³", [
  // 916.8
  async (tok, S) => {
    hot('代 initial conditions', 0, 7.2); S.B = board(-2.4, 6.2, 0.66); S.B.add('aₙ = α₁2ⁿ + α₂n·2ⁿ + (1/8)n²2ⁿ', 'ptr'); cap('NRR 的 general solution', '= HRR 通解 + 特解');
  },
  // 930.65
  async (tok, S) => {
    S.B.add('兩個未決定係數 → 用 a₀、a₁'); S.B.last(); cap('兩個未決定的係數', '用 initial condition 決定');
  },
  // 956.22
  async (tok, S) => {
    S.B.add('n = 0：α₁ + 0 + 0 = 0 → α₁ = 0'); S.B.last(); cap('n 代 0', '2⁰ = 1，後面兩項有 n 都是 0');
  },
  // 968.22
  async (tok, S) => {
    S.B.add('n = 1：2α₁ + 2α₂ + 2/8 = 0'); S.B.last(); cap('n 代 1', '2α₁ + 2α₂ + 1/4 = 0');
  },
  // 983.75
  async (tok, S) => {
    S.B.add('α₁ = 0 → α₂ = −1/8', 'good'); S.B.last(); cap('α₂ = −1/8', '');
  },
  // 1002.96
  async (tok, S) => {
    S.B.add('aₙ = (1/8)n²2ⁿ − (1/8)n·2ⁿ', 'ptr alt'); S.B.last(); cap('答案是這樣', '');
  },
  // 1007.36
  async (tok, S) => {
    S.B.add('= (n² − n)·2ⁿ/8 = n(n − 1)·2ⁿ⁻³', 'good'); S.B.last(); cap('把 1/8 提出來', '1/8 = 2⁻³，n² − n = n(n − 1)');
  },
  // 1020.12
  async (tok, S) => {
    S.B.hi(-1); S.A = seq(0, [0, 0], (a, n) => 4 * a[n - 1] - 4 * a[n - 2] + Math.pow(2, n - 2), 7); S.Bf = {}; for (let n = 0; n <= 7; n++) S.Bf[n] = n * (n - 1) * Math.pow(2, n - 3); S.c = cmp([0, 1, 2, 3, 4, 5, 6, 7], S.A, S.Bf, -2.6, 0.9, '遞迴', '公式'); cap('只是稍微好看一點', '檢查：每一項都對');
  },
]);
scene('rr-13b-rule', "乘 n 直到 work：B·2ⁿ ✘ → B·n·2ⁿ ✘ → B·n²·2ⁿ ✓", [
  // 1024.57
  async (tok, S) => {
    hot('通則：乘 n 直到 work', 0, 7.2); S.B = board(0, 6.2, 0.68); S.B.add('問題還是：解 HRR + 找一個 particular solution'); cap('問題基本上還是一樣', '');
  },
  // 1043.68
  async (tok, S) => {
    S.B.add('重點：找 particular solution', 'ptr'); S.B.last(); cap('homogeneous 會解', '重點在找 particular solution');
  },
  // 1049.94
  async (tok, S) => {
    S.B.add('方法：看右邊什麼樣子就設什麼樣子'); S.B.last(); cap('設一個樣子帶進去', '看右邊什麼樣子');
  },
  // 1056.4
  async (tok, S) => {
    S.B.add('出問題：設的樣子剛好是 HRR 的解', 'bad'); S.B.last(); cap('但有時候會出問題', '設的樣子是 homogeneous 的解');
  },
  // 1066.77
  async (tok, S) => {
    S.B.add('→ 左邊變 0、係數不見 → inconsistent'); S.B.last(); cap('帶進去左邊就變 0', '係數完全不見，式子 inconsistent');
  },
  // 1075.14
  async (tok, S) => {
    S.B.add('解法：乘 n；不行再乘 n，乘到 work 為止', 'good'); S.B.last(); cap('不 work 就乘一個 n', '再不 work 再乘一個 n');
  },
  // 1082.46
  async (tok, S) => {
    S.B.hi(-1); S.cd0 = fbox('B·2ⁿ ✘', FC.gray, -3.6, -0.9, 2.4); sm('2ⁿ 是 HRR 的解', -3.6, -1.7); cap('一開始設 B·2ⁿ 不 work', '因為 2ⁿ 是 homogeneous 的解');
  },
  // 1091.32
  async (tok, S) => {
    S.cd1 = fbox('B·n·2ⁿ ✘', FC.gray, 0, -0.9, 2.4); sm('n·2ⁿ 也是解', 0, -1.7); cap('B·n·2ⁿ 也不 work', 'n·2ⁿ 也是解');
  },
  // 1097.88
  async (tok, S) => {
    S.cd2 = fbox('B·n²·2ⁿ ✓', FC.green, 3.6, -0.9, 2.4); sm('B = 1/8', 3.6, -1.7); cap('再乘一個 n', '乘到 work 為止');
  },
  // 1163.42
  async (tok, S) => {
    note('不必真的帶：2 是二重根 → 直接乘到 n²', 0, 1.3); cap('你不見得真的要帶', '知道要乘就直接乘到 n² 再帶');
  },
]);

// ════════ dVPDdHE3RJU（Solving Recurrences Using Substitution Method） ════════
scene('rr-sub-prob', "REC(n)：先寫時間遞迴式，再用代換法解", [
  // 5.51
  async (tok, S) => {
    hot('Substitution method（代換法）', 0, 7.2); cap('用 substitution method 解遞迴', 'Problem 3');
  },
  // 14.11
  async (tok, S) => {
    S.cd = code(['REC(n)', '  if (n == 1)', '    return 1', '  else', '    REC(n − 1)', '    for i = 1 to n', '      print("…")'], -3.8, 5.9, 0.56); cap('求這個演算法的 time complexity', 'REC(n)');
  },
  // 25.77
  async (tok, S) => {
    S.cd.hl(4); good('REC 在自己裡面呼叫自己 → recursive', 2.6, 4.2); cap('REC(n) 在自己裡面呼叫自己', '這是 recursive algorithm');
  },
  // 36.55
  async (tok, S) => {
    S.cd.hl(-1); S.s1 = fbox('① 寫出時間的遞迴式', FC.sky, 2.6, 3.0, 3.6); cap('先寫 recurrence relation of time', '');
  },
  // 53.19
  async (tok, S) => {
    S.s2 = fbox('② 用代換法解', FC.sand, 2.6, 2.0, 3.6); cap('再用 substitution method 解', '');
  },
  // 68.63
  async (tok, S) => {
    S.s3 = fbox('③ 用 Big-O 表示', FC.mint, 2.6, 1.0, 3.6); cap('最後用 asymptotic notation 表示', '');
  },
]);
scene('rr-sub-rec', "T(n)：base case 1，recursive case T(n − 1) + n", [
  // 103.63
  async (tok, S) => {
    hot('寫出時間的遞迴式', 0, 7.2); S.cd = code(['REC(n)', '  if (n == 1)', '    return 1', '  else', '    REC(n − 1)', '    for i = 1 to n', '      print("…")'], -3.8, 5.9, 0.56); S.B = board(2.8, 5.9, 0.66); S.B.add('T(n) = 執行 REC(n) 的時間', 'ptr'); cap('令 T(n) = 解 REC(n) 需要的時間', '');
  },
  // 113.69
  async (tok, S) => {
    S.B.add('= base case 或 recursive case'); S.B.last(); cap('用較小的子問題表示 T(n)', 'base case + recursive case');
  },
  // 128.27
  async (tok, S) => {
    S.cd.hl(1); cap('先看 base case', 'if n == 1 then return 1');
  },
  // 146.57
  async (tok, S) => {
    S.cd.hl(2); S.B.add('n = 1：時間是 T(1)'); S.B.last(); cap('n = 1 就是 REC(1)', '時間是 T(1)');
  },
  // 164.15
  async (tok, S) => {
    S.B.add('比較 + return：常數時間'); S.B.last(); cap('return 跟比較都是常數時間', '');
  },
  // 177.78
  async (tok, S) => {
    S.B.add('常數通常直接記成 1（慣例）', 'note'); cap('常數本來可以寫 C', '慣例上直接寫 1');
  },
  // 198.63
  async (tok, S) => {
    S.B.add('T(1) = 1', 'good'); S.B.last(); cap('T(1) = 1', 'base case 是常數時間');
  },
  // 209.17
  async (tok, S) => {
    S.cd.hl(4); S.B.add('呼叫 REC(n − 1)：T(n − 1)'); S.B.last(); cap('recursive case', '呼叫 REC(n − 1) 花 T(n − 1)');
  },
  // 227.79
  async (tok, S) => {
    S.cd.hl(5); cap('接著是一個 for loop', 'i 從 1 開始，每次 +1，到 n');
  },
  // 262.01
  async (tok, S) => {
    S.it = []; for (let i = 1; i <= 5; i++) { S.it.push(bx(String(i), FC.purple, -5.4 + (i - 1) * 0.75, 1.0, 0, 0.6, 0.6, 0.6, 0.6)); await wt(tok, 200); } S.it.push(sm('i = 1, 2, 3, …, n → 共 n 次（示意 n = 5）', -3.8, 0.2)); cap('迴圈跑幾次？', 'i = 1, 2, 3, …, n → n 次');
  },
  // 281.63
  async (tok, S) => {
    S.cd.hl(6); S.B.add('print 執行 n 次：n'); S.B.last(); cap('print 也跑 n 次', '花的時間是 n');
  },
  // 293.79
  async (tok, S) => {
    S.cd.hl(-1); S.B.add('recursive case：T(n − 1) + n', 'ptr alt'); S.B.last(); cap('recursive case 總共', 'T(n − 1) + n');
  },
  // 304.7
  async (tok, S) => {
    gone(S.it); hot('T(n) = T(n − 1) + n（n > 1）；T(1) = 1', 0, -0.6); cap('時間的 recurrence relation', 'n > 1：T(n − 1) + n；n = 1：1');
  },
]);
scene('rr-sub-sub', "T(n) = T(n−1) + n = T(n−2) + (n−1) + n = …", [
  // 345.87
  async (tok, S) => {
    hot('Substitution：一路往回代', 0, 7.2); S.B = board(-0.6, 6.1, 0.66); cap('用 substitution method 解', '');
  },
  // 359.77
  async (tok, S) => {
    S.B.add('T(n) = T(n − 1) + n', 'ptr'); cap('從 recursive part 開始', 'T(n) = T(n − 1) + n');
  },
  // 367.65
  async (tok, S) => {
    S.side = note('n 換成 n − 1：T(n − 1) = T(n − 2) + (n − 1)', 0, 0.3); cap('T(n − 1) 可以換成 T(n − 2) + (n − 1)', '把式子裡的 n 換成 n − 1');
  },
  // 386.91
  async (tok, S) => {
    S.B.add('= T(n − 2) + (n − 1) + n'); S.B.last(); cap('代進去', 'T(n) = T(n − 2) + (n − 1) + n');
  },
  // 413.33
  async (tok, S) => {
    txt(S.side, 'n 換成 n − 2：T(n − 2) = T(n − 3) + (n − 2)'); cap('再把 T(n − 2) 換掉', 'T(n − 3) + (n − 2)');
  },
  // 437.31
  async (tok, S) => {
    S.B.add('= T(n − 3) + (n − 2) + (n − 1) + n'); S.B.last(); cap('得到新的 T(n)', 'T(n − 3) + (n − 2) + (n − 1) + n');
  },
  // 460.99
  async (tok, S) => {
    S.B.hi(-1); txt(S.side, '規律：T(n − 3) 後面接 n − 2、n − 1、n − 0'); cap('觀察 pattern', '常數每次少 1');
  },
  // 486.95
  async (tok, S) => {
    S.B.add('= …（繼續代：T(n − 4)、T(n − 5)、…）'); S.B.last(); cap('一直這樣繼續', '代到 T(n − k)');
  },
  // 500.41
  async (tok, S) => {
    S.B.add('= T(n − k) + (n − k + 1) + … + (n − 1) + n', 'ptr alt'); S.B.last(); txt(S.side, 'T(n − k) 後面第一項是 n − (k − 1)'); cap('一般式', 'T(n − k) + (n − (k − 1)) + … + n');
  },
]);
scene('rr-sub-solve', "n − k = 1 → T(n) = n(n + 1)/2 = O(n²)", [
  // 534.8
  async (tok, S) => {
    hot('什麼時候停？', 0, 7.2); S.B = board(-2.2, 6.1, 0.55); S.B.add('T(n) = T(n − k) + (n − k + 1) + … + n', 'ptr'); cap('T(n − k) 是 REC(n − k) 的時間', '');
  },
  // 546.43
  async (tok, S) => {
    S.B.add('假設 REC(n − k) 是 base case：n − k = 1'); S.B.last(); cap('假設 REC(n − k) 滿足 base case', 'n − k = 1');
  },
  // 562.15
  async (tok, S) => {
    S.B.add('T(n − k) = T(1) = 1'); S.B.last(); cap('T(n − k) 換成 1', 'base case 是常數 1');
  },
  // 579.57
  async (tok, S) => {
    S.B.add('n − k = 1 ⇒ k = n − 1', 'good'); S.B.last(); cap('n − k = 1', '所以 k = n − 1');
  },
  // 587.77
  async (tok, S) => {
    S.B.add('k 換成 n − 1：T(1) + …'); S.B.last(); cap('把 k 換成 n − 1', 'n − k 變成 1，得到 T(1)');
  },
  // 596.6
  async (tok, S) => {
    S.T = row(-4.4, 0.7, [1]); cap('T(1) = 1', '');
  },
  // 603.97
  async (tok, S) => {
    S.B.add('n − (k − 1) = n − (n − 2) = 2'); S.B.last(); S.T2 = row(-3.6, 0.7, [2], FC.purple); cap('n − (k − 1) 那一項', 'n − (n − 2) = 2');
  },
  // 631.92
  async (tok, S) => {
    S.B.add('n − (k − 2) = n − (n − 3) = 3'); S.B.last(); S.T3 = row(-2.8, 0.7, [3], FC.purple); cap('再下一項', 'n − (n − 3) = 3');
  },
  // 662.33
  async (tok, S) => {
    S.B.add('T(n) = 1 + 2 + 3 + … + n', 'ptr alt'); S.B.last(); S.T4 = row(-2.0, 0.7, ['…', 'n'], FC.purple); cap('得到這個總和', '1 + 2 + 3 + … + n');
  },
  // 671.75
  async (tok, S) => {
    gone(S.T, S.T2, S.T3, S.T4); S.tri = []; for (let c = 1; c <= 5; c++) for (let r = 0; r < c; r++) S.tri.push(bx('', c % 2 ? FC.blue : FC.teal, -5.0 + (c - 1) * 0.55, -1.4 + r * 0.55, 0, 0.5, 0.5, 0.5)); S.tri.push(sm('1 + 2 + 3 + 4 + 5 = 15（示意 n = 5）', -3.9, -2.0)); cap('前 n 個自然數的和', '');
  },
  // 687.93
  async (tok, S) => {
    S.B.add('= n(n + 1)/2', 'good'); S.B.last(); S.A = seq(1, [1], (a, n) => a[n - 1] + n, 6); S.Bf = {}; for (let n = 1; n <= 6; n++) S.Bf[n] = n * (n + 1) / 2; S.c = cmp([1, 2, 3, 4, 5, 6], S.A, S.Bf, 1.7, 0.6, 'T(n) 遞迴', 'n(n+1)/2', 0.72); cap('公式：n(n + 1)/2', '');
  },
  // 699.09
  async (tok, S) => {
    gone(S.tri, S.c); S.B.clear(); S.B.add('T(n) = 1 + 2 + … + n = n(n + 1)/2', 'ptr'); S.r = board(-2.2, 5.3, 0.6); S.r.add('Big-O：常數不重要 → 去掉 /2'); cap('用 asymptotic notation', '常數不重要，分母 2 拿掉');
  },
  // 713.59
  async (tok, S) => {
    S.r.add('n(n + 1) = n² + n'); S.r.last(); cap('n(n + 1) = n² + n', '');
  },
  // 720.75
  async (tok, S) => {
    S.r.add('n² 長得比 n 快 → dominating term'); S.r.last(); cap('n² 是 dominating term', '成長得比 n 快');
  },
  // 728.39
  async (tok, S) => {
    S.r.add('T(n) = O(n²)', 'ptr alt'); S.r.last(); cap('T(n) = O(n²)', '');
  },
  // 734.21
  async (tok, S) => {
    note('Big-O 是上界；這題每次都剛好 n(n+1)/2 步，也是 Θ(n²)', 2.6, 2.6); cap('講者說用 Big-O 寫 worst case', 'Big-O 是上界，這題其實也是 Θ(n²)');
  },
  // 751.87
  async (tok, S) => {
    S.r.hi(-1); good('REC(n) 的 time complexity = O(n²)', -1.5, 2.0); cap('這個演算法的時間複雜度', 'O(n²)');
  },
]);

// ════════ tA2cqfNh5EM（Generating Functions | Part 1） ════════
scene('rr-gf-def', "A(x) = a₀ + a₁x + a₂x² + … = Σ aᵣxʳ", [
  // 3.14
  async (tok, S) => {
    hot('Generating Function（生成函數）', 0, 7.2); cap('generating function', '計數問題的工具');
  },
  // 19.2
  async (tok, S) => {
    S.B = board(-3.0, 6.1, 0.62); S.B.add('已學：排列、組合、分配問題'); S.B.add('另一個工具：generating function', 'ptr'); cap('前面學過排列組合、分配問題', '另一個工具就是生成函數');
  },
  // 30.62
  async (tok, S) => {
    S.B.add('源自整數分割（Euler，1748）'); S.B.last(); cap('跟 partition of integers 有關', 'Euler 1748 年開始');
  },
  // 51.63
  async (tok, S) => {
    S.B.add('其實就是 power series（Taylor series）'); S.B.last(); note('不討論收斂', 3.2, 4.3); cap('生成函數就是 power series', '先不管收斂的問題');
  },
  // 68.77
  async (tok, S) => {
    S.B.hi(-1); S.q = bub('這個數列的生成函數是什麼？', 3.0, 2.3); cap('常見的問題', 'what is the generating function of the sequence?');
  },
  // 85.3
  async (tok, S) => {
    S.r = rack(['a₀', 'a₁', 'a₂', 'a₃', 'a₄', '…'], -2.2, -0.2, FC.blue, '數列'); cap('數列 a₀, a₁, a₂, …', '');
  },
  // 91.8
  async (tok, S) => {
    gone(S.q); S.q = bub('找 f(x)：展開後係數就是這些數', 3.0, 2.3); cap('生成函數是某個 f(x)', '展開成 power series 就生出這些數');
  },
  // 108.98
  async (tok, S) => {
    S.B.add('數列記作 (aᵣ)：a₀, a₁, …, aᵣ, …'); S.B.last(); cap('數列的記號 (aᵣ)', 'aᵣ 是第 r 項');
  },
  // 138.45
  async (tok, S) => {
    S.B.add('這裡說的是 ordinary generating function'); S.B.last(); cap('ordinary generating function', '另外還有 exponential generating function');
  },
  // 158.59
  async (tok, S) => {
    gone(S.q); S.A = hot('A(x) = a₀ + a₁x + a₂x² + … + aᵣxʳ + …', 0.4, 2.0); cap('定義成 power series', 'A(x) = a₀ + a₁x + a₂x² + …');
  },
  // 199.04
  async (tok, S) => {
    glow(S.r.cells[0], HL); cap('第一項 a₀ 是常數項', '等於乘上 x⁰');
  },
  // 214.01
  async (tok, S) => {
    glow(S.r.cells[0], null); S.S = pl('= Σ aᵣxʳ（r 從 0 到 ∞）', 0.4, 1.3); cap('寫成 summation', 'Σ aᵣxʳ，r = 0 到 ∞');
  },
  // 227.22
  async (tok, S) => {
    good('A(x) 就是數列 (aᵣ) 的 generating function', 0.4, -1.3); cap('A(x) 是 (aᵣ) 的 generating function', '');
  },
]);
scene('rr-gf-ones', "1 + x + x² + … = 1/(1 − x)（|x| < 1）", [
  // 244.68
  async (tok, S) => {
    hot('例：全部是 1 的數列', 0, 7.2); cap('找 1, 1, 1, … 的生成函數', '一直到無限');
  },
  // 255.48
  async (tok, S) => {
    S.r = rack([1, 1, 1, 1, 1, 1], -2.2, 4.8, FC.blue, '(aᵣ)'); sm('…', 3.2, 4.8); cap('a₀ = 1，a₁ = 1，a₂ = 1，…', '');
  },
  // 263
  async (tok, S) => {
    S.B = board(-1.0, 3.5, 0.66); S.B.add('A(x) = a₀ + a₁x + a₂x² + …'); cap('先寫出 power series', 'a₀ + a₁x + a₂x² + …');
  },
  // 281.48
  async (tok, S) => {
    S.B.add('= 1 + x + x² + x³ + …'); S.B.last(); cap('把值代進去', '1 + x + x² + x³ + …');
  },
  // 296.08
  async (tok, S) => {
    S.B.add('等比級數（geometric series），公比 = x'); S.B.last(); cap('這是 geometric series', '公比 common ratio 是 x');
  },
  // 307
  async (tok, S) => {
    S.B.add('假設 |x| < 1 → 收斂'); S.B.last(); cap('假設 |x| < 1', '級數收斂');
  },
  // 313.58
  async (tok, S) => {
    S.B.add('無窮等比和 = 首項 / (1 − 公比)'); S.B.last(); S.ps = []; let s = 0; for (let N = 0; N < 6; N++) { s += Math.pow(0.5, N); S.ps.push(bar(3.0 + N * 0.55, -1.2, s * 1.1, FC.teal, null, 0.4)); } S.ps.push(line(2.6, -1.2 + 2.2, 6.2, -1.2 + 2.2, 0, '#c08a1f'), sm('x = 0.5 的部分和 → 2（示意）', 4.4, -1.7)); cap('用 GP 公式', '首項 /(1 − 公比)');
  },
  // 330.08
  async (tok, S) => {
    S.B.add('A(x) = 1 / (1 − x)', 'ptr alt'); S.B.last(); cap('首項 1，公比 x', '= 1/(1 − x)');
  },
  // 336.57
  async (tok, S) => {
    S.B.hi(-1); good('closed form（封閉形式）', -1.0, -1.2); cap('變成 x 的函數', '也叫 closed form');
  },
  // 350.74
  async (tok, S) => {
    for (const m of S.r.cells) glow(m, OKG); cap('把它展開成 power series', '就生出全 1 的數列');
  },
]);
scene('rr-gf-binom', "Σ C(n,r)xʳ = (1 + x)ⁿ（二項式定理）", [
  // 366.43
  async (tok, S) => {
    hot('例：二項式係數', 0, 7.2); cap('計數問題得到的數字', '要找出生成它們的函數');
  },
  // 398.22
  async (tok, S) => {
    S.B = board(-2.6, 6.35, 0.72); S.B.add('數列：C(n,0), C(n,1), C(n,2), …, C(n,n), 0, 0, …', 'ptr'); cap('例：C(n,0), C(n,1), …, C(n,n)', '後面都是 0');
  },
  // 403.98
  async (tok, S) => {
    S.r = rack([1, 4, 6, 4, 1, 0, 0], -2.4, 2.0, FC.blue, 'n = 4'); for (let i = 5; i < 7; i++) tint(S.r.cells[i], FC.gray); sm('（示意 n = 4）', 4.7, 2.0); cap('有限數列', '補 0 就變成無限數列');
  },
  // 416.76
  async (tok, S) => {
    S.B.add('A(x) = Σ aᵣxʳ'); S.B.last(); cap('一樣寫成 Σ aᵣxʳ', '');
  },
  // 430.08
  async (tok, S) => {
    S.B.add('= C(n,0) + C(n,1)x + C(n,2)x² + … + C(n,n)xⁿ'); S.B.last(); cap('第一項 C(n,0)', '下一項乘 x，再下一項乘 x²…');
  },
  // 447.2
  async (tok, S) => {
    S.B.add('+ 0·xⁿ⁺¹ + 0·xⁿ⁺² + …'); S.B.last(); cap('剩下的項都是 0', '');
  },
  // 460.98
  async (tok, S) => {
    cap('本來是無限級數', '結果變成有限的');
  },
  // 490.4
  async (tok, S) => {
    S.B.clear(); S.B.add('A(x) = Σ aᵣxʳ', 'ptr'); S.B.add('= Σ(r=0..n) C(n,r)xʳ + Σ(r=n+1..∞) 0·xʳ'); S.B.last(); cap('把總和拆成兩段', 'r = 0..n 和 r = n+1..∞');
  },
  // 519.05
  async (tok, S) => {
    S.B.add('第二段全是 0'); S.B.last(); cap('n + 1 到 ∞ 那段', '係數是 0，整段是 0');
  },
  // 529.92
  async (tok, S) => {
    S.B.add('第一段：binomial theorem（二項式定理）'); S.B.last(); cap('剩下的用 binomial theorem', '');
  },
  // 541.19
  async (tok, S) => {
    S.B.add('(1 + x)ⁿ = Σ(r=0..n) C(n,r)xʳ', 'ptr alt'); S.B.last(); sm('(1 + x)⁴ = 1 + 4x + 6x² + 4x³ + x⁴', 0.6, 1.25); cap('(1 + x)ⁿ = Σ C(n,r)xʳ', '');
  },
  // 562.28
  async (tok, S) => {
    S.B.hi(-1); good('(1 + x)ⁿ 就是這個數列的 generating function', -0.6, 0.5); cap('(1 + x)ⁿ 就是 generating function', '');
  },
  // 572.16
  async (tok, S) => {
    note('任何有限數列：後面補 0 就能寫生成函數', -0.6, -0.2); cap('任何有限數列', '把其餘項當 0 就變無限數列');
  },
]);
scene('rr-gf-xn', "0, 0, …, 1（第 n 項）, 0, … → xⁿ", [
  // 588.36
  async (tok, S) => {
    hot('例：只有一個 1 的數列', 0, 7.2); S.B = board(-2.0, 6.1, 0.66); S.B.add('aᵣ = 1（r = n），否則 aᵣ = 0', 'ptr'); cap('r = n 時 aᵣ = 1', '其他都是 0');
  },
  // 604.19
  async (tok, S) => {
    S.B.add('A(x) = a₀ + a₁x + a₂x² + a₃x³ + …'); S.B.last(); cap('還是用同一個公式', 'a₀ + a₁x + a₂x² + …');
  },
  // 627.76
  async (tok, S) => {
    S.r = rack([0, 0, 0, 1, 0, 0], -2.0, 2.0, FC.gray, 'n = 3'); tint(S.r.cells[3], FC.orange); sm('（示意 n = 3）', 4.3, 2.0); cap('r 剛好等於 n 時值是 1', '其他位置是 0');
  },
  // 653.56
  async (tok, S) => {
    S.B.add('= 0 + 0 + … + 1·xⁿ + 0 + …'); S.B.last(); cap('到處都是 0', '只有 r = n 那一項不是');
  },
  // 662.26
  async (tok, S) => {
    glow(S.r.cells[3], HL); cap('aₙ = 1', '留下 xⁿ');
  },
  // 674.8
  async (tok, S) => {
    sm('數列 0, 0, 0, …, 1, 0, 0, …', -0.4, 0.9); cap('對應的數列', '0, 0, 0, …, 1, 0, …');
  },
  // 692.36
  async (tok, S) => {
    S.B.add('A(x) = xⁿ', 'ptr alt'); S.B.last(); cap('生成函數就是 xⁿ', '');
  },
]);
scene('rr-gf-sum', "A(x) + B(x)：cᵣ = aᵣ + bᵣ", [
  // 718.14
  async (tok, S) => {
    hot('生成函數的性質與運算', 0, 7.2); cap('properties and operations', '');
  },
  // 726.22
  async (tok, S) => {
    S.B = board(-3.6, 6.2, 0.72); S.B.add('A(x)：(aᵣ)；B(x)：(bᵣ)', 'ptr'); cap('兩個生成函數', 'A(x) 給 (aᵣ)，B(x) 給 (bᵣ)');
  },
  // 745.13
  async (tok, S) => {
    S.B.add('A(x) = a₀ + a₁x + a₂x² + … = Σ aᵣxʳ'); S.B.last(); S.ra = rack([1, 1, 1, 1], 1.9, 4.7, FC.blue, 'aᵣ'); cap('A(x) = Σ aᵣxʳ', '');
  },
  // 758.96
  async (tok, S) => {
    S.B.add('B(x) = b₀ + b₁x + b₂x² + … = Σ bᵣxʳ'); S.B.last(); S.rb = rack([1, 2, 3, 4], 1.9, 3.3, FC.purple, 'bᵣ'); sm('（示意數字）', 3.2, 1.05); cap('B(x) = Σ bᵣxʳ', '');
  },
  // 777.44
  async (tok, S) => {
    S.B.hi(-1); cap('先定義 sum', '');
  },
  // 783.46
  async (tok, S) => {
    S.B.add('同次方的係數相加'); S.B.last(); cap('兩個 power series 相加', '同樣 x 次方的係數加起來');
  },
  // 799.04
  async (tok, S) => {
    S.B.add('A + B = (a₀+b₀) + (a₁+b₁)x + …'); S.B.last(); S.rc = rack([2, 3, 4, 5], 1.9, 1.9, FC.green, 'cᵣ'); cap('(a₀ + b₀) + (a₁ + b₁)x + …', '');
  },
  // 818.07
  async (tok, S) => {
    S.B.add('cᵣ = aᵣ + bᵣ', 'ptr alt'); S.B.last(); cap('記 cᵣ = aᵣ + bᵣ', '');
  },
  // 841.38
  async (tok, S) => {
    S.B.hi(-1); good('C(x) = A(x) + B(x) 是 (cᵣ) 的生成函數', -1.0, 0.2); cap('C(x) 是 (cᵣ) 的 generating function', '');
  },
]);
scene('rr-gf-conv', "A(x)B(x)：dᵣ = a₀bᵣ + a₁bᵣ₋₁ + … + aᵣb₀", [
  // 850.56
  async (tok, S) => {
    hot('兩個生成函數相乘', 0, 7.2); S.B = board(-3.4, 6.1, 0.62); cap('接著定義 product', '');
  },
  // 861.58
  async (tok, S) => {
    S.B.add('用 convolution property（卷積）', 'ptr'); cap('convolution property', '卷積');
  },
  // 871.27
  async (tok, S) => {
    S.B.add('A(x)·B(x) = D(x) = d₀ + d₁x + d₂x² + …'); S.B.last(); cap('A(x)·B(x) 是另一個 power series', 'D(x) = d₀ + d₁x + …');
  },
  // 896.64
  async (tok, S) => {
    S.B.add('dᵣ = ?'); S.B.last(); cap('d 的值是多少？', '');
  },
  // 906.8
  async (tok, S) => {
    S.g = []; for (let i = 0; i < 4; i++) S.g.push(sm('a' + sub(i) + (i ? 'x' + (i > 1 ? sup(i) : '') : ''), 0.8, 4.4 - i * 1.0)); for (let j = 0; j < 4; j++) S.g.push(sm('b' + sub(j) + (j ? 'x' + (j > 1 ? sup(j) : '') : ''), 2.0 + j * 1.1, 5.2)); cap('把兩個級數乘開', '(a₀ + a₁x + …)(b₀ + b₁x + …)');
  },
  // 928.07
  async (tok, S) => {
    S.cell = {}; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { S.cell[i + ',' + j] = bx('a' + sub(i) + 'b' + sub(j), [FC.blue, FC.purple, FC.teal, FC.orange, FC.pink, FC.green, FC.gold][i + j], 2.0 + j * 1.1, 4.4 - i * 1.0, 0, 0.95, 0.7, 0.5); } await wt(tok, 300); cap('a₀ 乘每一項、a₁x 乘每一項…', '');
  },
  // 945.01
  async (tok, S) => {
    S.B.add('合併同類項（同樣 x 次方）'); S.B.last(); note('同顏色的斜線 = 同一個 x 次方', 3.6, 6.0); cap('把 like terms 合併', '同次方的放一起');
  },
  // 949.8
  async (tok, S) => {
    glow(S.cell['0,0'], HL); S.B.add('常數項 d₀ = a₀b₀'); S.B.last(); cap('a₀ × b₀', '常數項');
  },
  // 959.08
  async (tok, S) => {
    glow(S.cell['0,0'], null); glow(S.cell['0,1'], HL); cap('a₀ 乘 b₁x 得 a₀b₁x', '再來 a₁x 乘 b₀ 也是 x');
  },
  // 998.46
  async (tok, S) => {
    glow(S.cell['1,0'], HL); S.B.add('x 的係數 d₁ = a₀b₁ + a₁b₀'); S.B.last(); cap('x 的項', 'a₀b₁ + a₁b₀');
  },
  // 1016.61
  async (tok, S) => {
    glow(S.cell['0,1'], null); glow(S.cell['1,0'], null); for (const k of ['0,2', '1,1', '2,0']) glow(S.cell[k], HL); S.B.add('x² 的係數 d₂ = a₀b₂ + a₁b₁ + a₂b₀'); S.B.last(); cap('x² 的項有三個', 'a₀b₂ + a₁b₁ + a₂b₀');
  },
  // 1055.2
  async (tok, S) => {
    for (const k of ['0,2', '1,1', '2,0']) glow(S.cell[k], null); for (const k of ['0,3', '1,2', '2,1', '3,0']) glow(S.cell[k], HL); cap('一般的第 r 項', '下標加起來都是 r');
  },
  // 1083.96
  async (tok, S) => {
    S.B.add('dᵣ = a₀bᵣ + a₁bᵣ₋₁ + … + aᵣb₀'); S.B.last(); cap('a₀bᵣ + a₁bᵣ₋₁ + … + aᵣb₀', '每一項都湊出 xʳ');
  },
  // 1127.76
  async (tok, S) => {
    note('這叫 convolution（卷積）', 3.4, 0.2); cap('這個性質叫 convolution', '');
  },
  // 1148.57
  async (tok, S) => {
    S.B.add('= Σ(k=0..r) aₖ bᵣ₋ₖ', 'ptr alt'); S.B.last(); cap('寫成 Σ aₖbᵣ₋ₖ', 'k 從 0 到 r');
  },
  // 1185.5
  async (tok, S) => {
    for (const k of ['0,3', '1,2', '2,1', '3,0']) glow(S.cell[k], null); S.d = []; for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k <= r; k++) s += 1 * 1; S.d.push(s); } S.dr = rack(S.d, -4.4, -0.9, FC.green, 'dᵣ'); sm('示意：aᵣ = bᵣ = 1 → dᵣ = r + 1', -2.6, -1.6); cap('回到 D(x) = A(x)B(x)', '第 r 項 dᵣ');
  },
  // 1223.18
  async (tok, S) => {
    good('dᵣ = Σ(k=0..r) aₖbᵣ₋ₖ', 3.4, -1.0); cap('dᵣ = Σ aₖbᵣ₋ₖ', '這就是乘積的定義');
  },
  // 1235.98
  async (tok, S) => {
    S.B.hi(-1); cap('也叫 Cauchy product', '或兩個數列的 convolution');
  },
]);
scene('rr-gf-genbin', "C(α, r) = α(α − 1)…(α − r + 1)/r!", [
  // 1244.53
  async (tok, S) => {
    hot('由 binomial theorem 來的標準結果', 0, 7.2); cap('再定義兩個 standard results', '來自 binomial theorem');
  },
  // 1250.67
  async (tok, S) => {
    S.B = board(-3.3, 6.35, 0.72); S.B.add('generalized binomial coefficient', 'ptr'); cap('先定義廣義二項式係數', 'generalized binomial coefficient');
  },
  // 1259.66
  async (tok, S) => {
    S.B.add('(1 + x)ⁿ，n 正整數 → 有限項'); S.B.last(); cap('次方在分子、n 是正的', '展開是有限的');
  },
  // 1273.24
  async (tok, S) => {
    S.B.add('1/(1 − x)⁴ = (1 − x)⁻⁴ → 無限項'); S.B.last(); cap('次方在分母', '(1 − x)⁻⁴ 展開是無限的');
  },
  // 1287.7
  async (tok, S) => {
    S.B.add('α ∈ ℝ（可為負），r ∈ ℕ'); S.B.last(); cap('α 是實數、r 是自然數', 'α 可以是負的');
  },
  // 1305.94
  async (tok, S) => {
    S.B.add('C(α, r) = α(α−1)…(α−r+1) / r!', 'ptr alt'); S.B.last(); cap('α 乘 α − 1 乘…乘 α − r + 1', '再除以 r!');
  },
  // 1337.9
  async (tok, S) => {
    S.B.add('C(α, 0) = 1'); S.B.last(); cap('規定 C(α, 0) = 1', '');
  },
  // 1340.19
  async (tok, S) => {
    S.B.hi(-1); sm('α = −2：C(−2, r)，r = 0, 1, 2, 3, 4', 3.6, 4.7); S.r = rack([0, 1, 2, 3, 4].map((r) => C(-2, r)), 1.9, 3.4, FC.purple); sm('(−2)(−3)/2! = ' + fmt(C(-2, 2)), 3.6, 2.6); sm('(−2)(−3)(−4)/3! = ' + fmt(C(-2, 3)), 3.6, 2.0); cap('例如 α = −2', '−2、−3、−4 一直乘下去');
  },
  // 1352.58
  async (tok, S) => {
    S.B.add('(1 ± x)^α = Σ C(α, r)(±x)ʳ'); S.B.last(); cap('(1 ± x)^α = Σ C(α, r)(±x)ʳ', 'r 從 0 到 ∞');
  },
  // 1370.95
  async (tok, S) => {
    S.B.add('= 1 ± αx + α(α−1)/2!·x² ± …'); S.B.last(); cap('展開來', '1 ± αx + α(α − 1)/2! x² ± …');
  },
  // 1399.52
  async (tok, S) => {
    S.B.hi(-1); note('α 是正整數 → 回到原本的二項式公式', 3.9, 1.0); cap('代特定的值', '會回到原本的 binomial 公式');
  },
  // 1409.36
  async (tok, S) => {
    note('Pascal identity：C(α, r) = C(α − 1, r) + C(α − 1, r − 1)', 0, 0.1); cap('還有 Pascal identity', '也常用到');
  },
]);
scene('rr-gf-std', "1/(1 − x)ⁿ = Σ C(n + r − 1, r)xʳ", [
  // 1432.16
  async (tok, S) => {
    hot('三個要記的展開', 0, 7.2); S.B = board(-2.2, 6.3, 0.66); S.B.add('1/(1 − x) = (1 − x)⁻¹ = 1 + x + x² + …', 'ptr'); S.r1 = rack([1, 1, 1, 1, 1], 2.0, 2.7, FC.blue, '1/(1−x)'); cap('1/(1 − x)：α = −1', '生成全 1 的數列');
  },
  // 1453.08
  async (tok, S) => {
    S.B.add('1/(1 − x)² = 1 + 2x + 3x² + 4x³ + …'); S.B.last(); S.r2 = rack([0, 1, 2, 3, 4].map((r) => C(-2, r) * Math.pow(-1, r)), 2.0, 1.35, FC.purple, '1/(1−x)²'); S.r2.all.splice(1, 5).forEach((l) => remove(l));  // 次方標籤同上排，只留第一排 cap('1/(1 − x)²', '1 + 2x + 3x² + 4x³ + …');
  },
  // 1477.04
  async (tok, S) => {
    S.B.add('1/(1 − x)ⁿ（n 是正整數）= (1 − x)⁻ⁿ'); S.B.last(); cap('一般的 1/(1 − x)ⁿ', 'n 是正整數');
  },
  // 1489.11
  async (tok, S) => {
    S.B.add('= 1 + nx + n(n+1)/2!·x² + n(n+1)(n+2)/3!·x³ + …'); S.B.last(); cap('= 1 + nx + n(n + 1)/2! x² + …', '');
  },
  // 1502.74
  async (tok, S) => {
    S.B.add('= Σ C(n + r − 1, r) xʳ', 'ptr alt'); S.B.last(); S.r3 = rack([0, 1, 2, 3, 4].map((r) => C(-3, r) * Math.pow(-1, r)), 2.0, 0.0, FC.teal, '1/(1−x)³'); S.r3.all.splice(1, 5).forEach((l) => remove(l)); S.chk = [0, 1, 2, 3, 4].every((r) => Math.abs(C(-3, r) * Math.pow(-1, r) - C(3 + r - 1, r)) < 1e-9); sm(S.chk ? 'n = 3：C(r + 2, r) ✓' : '✘', 3.8, -0.65); cap('寫成二項式係數', 'C(n + r − 1, r)');
  },
  // 1527.41
  async (tok, S) => {
    S.B.hi(-1); note('跟「分配問題」（重複組合）有關', -3.9, 0.7); cap('這跟 distribution problem 有關', '之前的影片講過');
  },
  // 1549.53
  async (tok, S) => {
    good('左邊 closed form = 右邊數列的生成函數', -3.4, -0.65); cap('左邊的 closed form', '就是右邊係數數列的生成函數');
  },
]);
scene('rr-gf-deriv', "d/dx：1/(1 − x) → 1/(1 − x)²，係數 1, 2, 3, …", [
  // 1590.01
  async (tok, S) => {
    hot('例：1/(1 − x)² 生成什麼？', 0, 7.2); S.B = board(-3.4, 6.3, 0.75); S.B.add('1/(1 − x)² = 1 + 2x + 3x² + …', 'ptr'); cap('1/(1 − x)² 展開', '1 + 2x + 3x² + …');
  },
  // 1617.12
  async (tok, S) => {
    S.q = bub('忘了公式怎麼辦？', 3.6, 5.0); cap('如果不記得公式', '怎麼推出 1, 2, 3？');
  },
  // 1631.84
  async (tok, S) => {
    gone(S.q); S.B.add('全 1：1 + x + x² + … = 1/(1 − x)'); S.B.last(); S.r = rack([1, 1, 1, 1, 1], 2.6, 5.3, FC.blue, 'f(x)'); cap('先記住幾個基本數列', '全 1 的生成函數是 1/(1 − x)');
  },
  // 1667.18
  async (tok, S) => {
    S.B.add('f(x) = Σ xⁿ = 1/(1 − x)'); S.B.last(); cap('寫成 Σ xⁿ', '每個係數都是 1');
  },
  // 1701.04
  async (tok, S) => {
    S.B.clear(); S.B.add('f(x) = Σ xⁿ = 1/(1 − x)', 'ptr'); S.B.add('兩邊對 x 微分'); S.B.last(); cap('兩邊對 x 微分', '假設級數收斂');
  },
  // 1723.72
  async (tok, S) => {
    S.B.add('左邊：f′(x)'); S.B.last(); cap('左邊是 f′(x)', '');
  },
  // 1735.58
  async (tok, S) => {
    S.B.add('[1/(1 − x)]′ = 1/(1 − x)²', 'good'); S.B.last(); cap('1/(1 − x) 微分', '兩個負號相消 → 1/(1 − x)²');
  },
  // 1756.48
  async (tok, S) => {
    S.d = rack([0, 1, 2, 3, 4], 2.6, 3.4, FC.purple, '逐項微分'); for (let i = 0; i < 5; i++) S.d.all.push(sm(['0', '1', '2x', '3x²', '4x³'][i], 2.6 + i * 0.86, 2.75)); cap('右邊逐項微分', '1 → 0、x → 1、x² → 2x、x³ → 3x²');
  },
  // 1785.12
  async (tok, S) => {
    glow(S.d.cells[0], NG); S.B.add('右邊 = 1 + 2x + 3x² + 4x³ + …'); S.B.last(); cap('重寫一下', '0 那項不見，其他往前移一格');
  },
  // 1802.52
  async (tok, S) => {
    S.n = rack([1, 2, 3, 4, 5], 2.6, 1.0, FC.green, '新數列'); cap('得到的數列', '1, 2, 3, 4, …');
  },
  // 1829.24
  async (tok, S) => {
    S.B.add('1/(1 − x)² ↔ 1, 2, 3, …（自然數）', 'ptr alt'); S.B.last(); cap('closed form 1/(1 − x)²', '就是自然數數列的生成函數');
  },
  // 1853.92
  async (tok, S) => {
    S.B.hi(-1); note('微分：從標準數列推出另一個數列', -3.4, 1.5); cap('用微分這個性質', '從一個標準數列得到另一個');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '離散數學・第 4 章',
    title: '遞迴關係',
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
      'nonhom', 'trial-form', 'gf-basic', 'gf-solve', 'gf-initial-trap'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
