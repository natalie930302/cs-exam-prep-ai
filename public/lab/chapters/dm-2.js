// 離散數學 第2章：證明方法（Direct proof、Contraposition、Contradiction、Cases、
// Mathematical / Strong Induction、Well-Ordering、除法定理與 Euclid）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（除法定理 a = dq + r，0 ≤ r < d；強歸納法以郵票 4、5 分為例）。
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
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function line(x1, y1, z1, x2, y2, z2, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  const W = (tok) => { const e = epoch; return async (ms) => { if (tok !== undefined) return beat(tok, ms); await sleep(Math.min(ms, 260)); if (e !== epoch) throw new Error('mode changed'); }; };
  async function anim(w, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

  // ───────────────────────── Mode 1：骨牌（數學歸納法） ─────────────────────────
  const STMTS = {
    sum: { name: '1 + 2 + … + n = n(n+1)/2', n0: 1, L: (n) => n * (n + 1) / 2, R: (n) => n * (n + 1) / 2, show: (n) => n * (n + 1) / 2 + ' = ' + n * (n + 1) / 2 },
    odd: { name: '1 + 3 + … + (2n−1) = n²', n0: 1, show: (n) => n * n + ' = ' + n * n },
    pow: { name: '2ⁿ > n', n0: 1, show: (n) => Math.pow(2, n) + ' > ' + n },
    fact: { name: '2ⁿ < n!（n ≥ 4）', n0: 4, show: (n) => Math.pow(2, n) + ' < ' + fact(n) },
  };
  const dom = { key: 'sum', base: true, brk: 0, g: [], N: 9 };
  const DX = (i) => (i - 4) * 1.25;
  function makeDomino(i, label, sub) {
    const g = new THREE.Group();
    g.position.set(DX(i) + 0.17, 0, 0);
    const m = lab.box('#4b9ee2', [0.34, 1.9, 1.1]);
    m.position.set(-0.17, 0.95, 0);
    g.add(m);
    lab.world.add(g);
    const l = tag(label, 'idx', DX(i), 2.45);
    const s = tag(sub, 'idx', DX(i), i % 2 ? -0.7 : -0.15, 1.1);
    return { g, m, l, s };
  }
  function enterDomino() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 5, 13], [0, 1.2, 0]);
    const S = STMTS[dom.key];
    dom.g = [];
    for (let i = 0; i < dom.N; i++) {
      const n = S.n0 + i;
      dom.g.push(makeDomino(i, 'P(' + n + ')', S.show(n)));
    }
    if (dom.brk) { const i = dom.brk - S.n0 + 1; if (i > 0 && i < dom.N) { const gap = cube('', '#d64545', [0.2, 0.2, 1.4], (DX(i - 1) + DX(i)) / 2, 0.1, 0); gap.scale.set(1, 1, 1); tag('P(' + dom.brk + ') ⇏ P(' + (dom.brk + 1) + ')', 'ptr', (DX(i - 1) + DX(i)) / 2, 3.2); } }
    controls('<select id="dS">' + Object.keys(STMTS).map((k) => '<option value="' + k + '">' + STMTS[k].name + '</option>').join('') + '</select>'
      + '<label><input type="checkbox" id="dB"' + (dom.base ? ' checked' : '') + '> 有證基底</label>'
      + '<select id="dK"><option value="0">歸納步驟全部成立</option><option value="3">步驟在 k=3 斷掉</option><option value="5">步驟在 k=5 斷掉</option></select>'
      + '<button class="primary" id="dPush">推倒第一張</button><button id="dReset">扶起來</button>');
    $('dS').value = dom.key; $('dK').value = String(dom.brk);
    $('dS').onchange = (e) => { dom.key = e.target.value; clearLog(); enterDomino(); };
    $('dK').onchange = (e) => { dom.brk = Number(e.target.value); clearLog(); enterDomino(); };
    $('dB').onchange = (e) => { dom.base = !!e.target.checked; clearLog(); enterDomino(); };
    on('dPush', () => dominoRun());
    on('dReset', () => { clearLog(); enterDomino(); });
    log('Basis step：證 P(' + S.n0 + ')。Inductive step：證 P(k) → P(k+1) 對每個 k ≥ ' + S.n0 + '。');
    domState(0, '');
  }
  async function dominoRun(tok) {
    if (busy) return; busy = true;
    const w = W(tok), S = STMTS[dom.key];
    let fell = 0;
    try {
      if (!dom.base) { log('沒有證 P(' + S.n0 + ')：第一張沒人推，後面全部都不會倒。', true); domState(0, '<span class="no">缺 basis step：連一張都推不倒</span>'); return 0; }
      for (let i = 0; i < dom.N; i++) {
        const n = S.n0 + i;
        if (i > 0 && dom.brk && n - 1 === dom.brk) { log('P(' + (n - 1) + ') → P(' + n + ') 沒證出來：骨牌到這裡停了。', true); break; }
        const d = dom.g[i];
        glow(d.m, GOLD);
        if (tok) say(i === 0 ? 'Basis：P(' + n + ') 成立，推倒第一張' : 'P(' + (n - 1) + ') → P(' + n + ')：下一張跟著倒', S.show(n));
        const last = i === dom.N - 1 || (dom.brk && n === dom.brk);
        await anim(w, tok ? 360 : 200, (t) => { d.g.rotation.z = -t * (last ? 1.5 : 1.12); });
        tint(d.m, '#2fc092'); glow(d.m, null);
        fell++;
      }
    } finally { busy = false; }
    domState(fell, fell === dom.N ? '<span class="ok">全部倒下：對所有 n ≥ ' + S.n0 + '，P(n) 成立</span>' : '<span class="no">只倒了 ' + fell + ' 張</span>');
    return fell;
  }
  function domState(fell, msg) {
    const S = STMTS[dom.key];
    setState('數學歸納法：' + S.name, [['基底', dom.base ? 'P(' + S.n0 + ') 已證' : '沒證'], ['歸納步驟', dom.brk ? 'k = ' + dom.brk + ' 時失敗' : '每個 k 都成立'], ['倒下', fell + ' / ' + dom.N]],
      (msg ? msg + '<br>' : '') + 'P(n₀) ∧ ∀k ≥ n₀ (P(k) → P(k+1)) ⇒ ∀n ≥ n₀ P(n)');
  }

  // ───────────────────────── Mode 2：強歸納（郵票 4、5 分） ─────────────────────────
  const st = { N: 26, cols: {} };
  const SX = (n) => (n - 12 - (Math.max(st.N, 15) - 12) / 2) * 0.6;
  function stampsFor(n) { for (let f = 0; f * 5 <= n; f++) if ((n - 5 * f) % 4 === 0) return { four: (n - 5 * f) / 4, five: f }; return null; }
  function enterStamps() {
    stopTimer(); lab.clear(); busy = false;
    st.cols = {};
    lab.frameCamera([0, 5.2, 14], [0, 2.6, 0]);
    controls('<label>一路蓋到 n = <input id="sN" type="number" min="15" max="30" value="' + st.N + '"></label><button class="primary" id="sRun">用強歸納蓋</button><button id="sOne">直接拆 n</button><button id="sReset">清空</button>');
    $('sN').onchange = (e) => { st.N = Math.max(15, Math.min(30, Number(e.target.value) || 26)); clearLog(); enterStamps(); };
    on('sRun', () => stampsRun());
    on('sOne', () => stampsOne());
    on('sReset', () => { clearLog(); enterStamps(); });
    for (let n = 12; n <= st.N; n++) tag(String(n), 'idx', SX(n), -0.2, 0.7);
    tag('藍 = 4 分、橘 = 5 分', 'ptr', 0, 6.6);
    log('Rosen：證明每個 ≥ 12 分的郵資都能用 4 分和 5 分郵票湊出。');
    stState('');
  }
  function buildCol(n, drop = 3) {
    const s = stampsFor(n), ms = [];
    let h = 0;
    for (let k = 0; k < s.four + s.five; k++) {
      const five = k >= s.four;
      ms.push(cube('', five ? '#dd8238' : '#4b9ee2', [0.5, five ? 0.5 : 0.4, 0.5], SX(n), h + (five ? 0.25 : 0.2), 0, drop));
      h += five ? 0.52 : 0.42;
    }
    st.cols[n] = ms;
    return s;
  }
  async function stampsRun(tok) {
    if (busy) return; busy = true;
    const w = W(tok);
    try {
      for (let n = 12; n <= st.N; n++) {
        if (st.cols[n]) continue;
        if (n <= 15) {
          const s = buildCol(n);
          st.cols[n].forEach((m) => glow(m, GOLD));
          const msg = 'Basis：' + n + ' = ' + Array(s.four).fill(4).concat(Array(s.five).fill(5)).join(' + ');
          log(msg); if (tok) say(msg, '四個基底 P(12)、P(13)、P(14)、P(15)');
          await w(tok ? 1300 : 200);
        } else {
          (st.cols[n - 4] || []).forEach((m) => glow(m, GREEN));
          buildCol(n);
          const msg = 'P(' + n + ')：拿 P(' + (n - 4) + ') 再加一張 4 分';
          log(msg); if (tok) say(msg, n + ' = ' + (n - 4) + ' + 4');
          await w(tok ? 700 : 150);
          (st.cols[n - 4] || []).forEach((m) => glow(m, null));
        }
        stState(n);
      }
    } finally { busy = false; }
    stState(st.N, '<span class="ok">12 到 ' + st.N + ' 全部湊得出來</span>');
  }
  function stampsOne() {
    if (busy) return;
    const n = st.N;
    if (st.cols[n]) { log(n + ' 已經蓋好了。', true); return; }
    const s = buildCol(n);
    log(n + ' = ' + s.four + ' × 4 + ' + s.five + ' × 5（直接找到一種拆法，但這不是證明「所有」n）');
    stState(n);
  }
  function stState(n, msg) {
    const s = n ? stampsFor(n) : null;
    setState('強歸納：郵資 ≥ 12 分', [['目前 n', n ? String(n) : '—'], ['拆法', s ? s.four + ' 張 4 分 + ' + s.five + ' 張 5 分' : '—'], ['用到', n > 15 ? 'P(' + (n - 4) + ')，不是 P(' + (n - 1) + ')' : n ? '基底' : '—']],
      (msg ? msg + '<br>' : '') + '強歸納：假設 P(12)…P(k) 都成立，證 P(k+1)<br>k+1 = (k−3) + 4，需要 k−3 ≥ 12 → 基底要 12～15');
  }

  // ───────────────────────── Mode 3：奇偶與直接證明 ─────────────────────────
  const par = { n: 5 };
  function enterParity() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 9, 8.5], [0, 0, 0.3]);
    controls('<label>n = <input id="pN" type="number" min="1" max="9" value="' + par.n + '"></label><button class="primary" id="pDraw">畫出 n²</button>');
    $('pN').onchange = (e) => { par.n = Math.max(1, Math.min(9, Number(e.target.value) || 5)); clearLog(); enterParity(); };
    on('pDraw', () => parityDraw());
    log('Direct proof：假設 n 是奇數，n = 2k + 1，推出 n² = 2(2k² + 2k) + 1 是奇數。');
    setState('n² 的奇偶', [['n', String(par.n)]], '按「畫出 n²」');
  }
  async function parityDraw(tok) {
    if (busy) return; busy = true;
    lab.clear();
    const w = W(tok), n = par.n, k = Math.floor(n / 2), odd = n % 2 === 1;
    const s = Math.min(0.9, 7.2 / n), P = (i) => (i - (n - 1) / 2) * s;
    let cnt = { a: 0, b: 0, c: 0 };
    try {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const inA = i < 2 * k && j < 2 * k, corner = odd && i === n - 1 && j === n - 1;
          const col = inA ? '#4b9ee2' : corner ? '#dd8238' : '#9b7ef4';
          cube('', col, [s * 0.86, 0.3, s * 0.86], P(j), 0.15, P(i), 2);
          if (inA) cnt.a++; else if (corner) cnt.c++; else cnt.b++;
        }
        await w(tok ? 220 : 40);
      }
    } finally { busy = false; }
    if (odd) {
      tag('4k² = ' + cnt.a, 'ptr', P(k - 0.5), 0.6, P(k - 0.5));
      tag('2·2k = ' + cnt.b, 'ptr', P(n - 1), 0.6, P(k - 0.5) - 0.2);
      tag('1', 'ptr alt', P(n - 1), 0.6, P(n - 1) + 0.2);
    }
    const msg = odd ? n + '² = ' + n * n + ' = 4·' + k * k + ' + 4·' + k + ' + 1 = 2·' + (2 * k * k + 2 * k) + ' + 1 → 奇數' : n + '² = ' + n * n + ' = 4·' + k * k + ' → 偶數';
    setState('n² 的奇偶', [['n', n + (odd ? '（奇，k = ' + k + '）' : '（偶，k = ' + k + '）')], ['藍', String(cnt.a)], ['紫', String(cnt.b)], ['橘', String(cnt.c)]],
      (odd ? '<span class="ok">' : '') + msg + (odd ? '</span>' : '') + '<br>(2k+1)² = 4k² + 4k + 1 = 2(2k²+2k) + 1');
    log(msg);
  }

  // ───────────────────────── Mode 4：良序原理與除法定理 ─────────────────────────
  const wo = { a: 101, d: 11, ms: [] };
  function enterWO() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4.5, 14], [0, 3, 0]);
    controls('<label>a = <input id="wA" type="number" min="1" max="150" value="' + wo.a + '"></label><label>d = <input id="wD" type="number" min="2" max="40" value="' + wo.d + '"></label><button class="primary" id="wRun">列出 S = {a − dq ≥ 0}</button>');
    $('wA').onchange = (e) => { wo.a = Math.max(1, Math.min(150, Number(e.target.value) || 101)); clearLog(); enterWO(); };
    $('wD').onchange = (e) => { wo.d = Math.max(2, Math.min(40, Number(e.target.value) || 11)); clearLog(); enterWO(); };
    on('wRun', () => woRun());
    log('Well-ordering：每個非空的非負整數集合都有最小元素。');
    log('除法定理：S = {a − dq | q ∈ ℤ, a − dq ≥ 0} 非空 → 有最小元素 r，而且 r < d。');
    setState('良序原理 → 除法定理', [['a', String(wo.a)], ['d', String(wo.d)]], '按按鈕看 S');
  }
  async function woRun(tok) {
    if (busy) return; busy = true;
    lab.clear();
    const w = W(tok), a = wo.a, d = wo.d, q = Math.floor(a / d), r = a % d;
    const vals = []; for (let k = 0; k <= q; k++) vals.push(a - d * k);
    const shown = vals.length > 14 ? vals.slice(0, 6).concat(vals.slice(-7)) : vals;
    const n = shown.length, X = (i) => (i - (n - 1) / 2) * Math.min(0.95, 12 / n), H = (v) => 0.2 + (v / a) * 5.2;
    wo.ms = [];
    try {
      for (let i = 0; i < n; i++) {
        const v = shown[i], h = H(v);
        const m = cube('', '#4b9ee2', [0.7, h, 0.7], X(i), h / 2, 0);
        tag(String(v), 'idx', X(i), h + 0.35);
        tag('q=' + (a - v) / d, 'idx', X(i), -0.25, 0.7);
        wo.ms.push(m);
        if (vals.length > 14 && i === 5) tag('…', 'val', (X(5) + X(6)) / 2, 0.6);
        await w(tok ? 260 : 40);
      }
      const neg = a - d * (q + 1);
      const nm = cube('', '#d64545', [0.7, 0.3, 0.7], X(n - 1) + 1.1, 0.15, 0);
      nm.material.transparent = true; nm.material.opacity = 0.4;
      tag(neg + '（負，不在 S）', 'idx', X(n - 1) + 1.1, 0.7);
      await w(tok ? 600 : 50);
      glow(wo.ms[n - 1], GOLD); tint(wo.ms[n - 1], '#dd8238');
    } finally { busy = false; }
    const msg = a + ' = ' + d + ' · ' + q + ' + ' + r + '（0 ≤ ' + r + ' < ' + d + '）';
    setState('良序原理 → 除法定理', [['a', String(a)], ['d', String(d)], ['|S|', String(q + 1)], ['最小元素 r', String(r)], ['q', String(q)]],
      '<span class="ok">' + msg + '</span><br>若 r ≥ d，r − d 也在 S 且更小，矛盾');
    log(msg);
  }

  // ───────────────────────── Mode 5：Euclid 演算法（正方形鋪長方形） ─────────────────────────
  const eu = { a: 21, b: 15 };
  const ECOL = ['#4b9ee2', '#9b7ef4', '#2fc092', '#dd8238', '#e55a9b', '#31aab0', '#c08a1f'];
  function enterEuclid() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 10, 7], [0, 0, 0.3]);
    controls('<label>a = <input id="gA" type="number" min="2" max="99" value="' + eu.a + '"></label><label>b = <input id="gB" type="number" min="1" max="99" value="' + eu.b + '"></label><button class="primary" id="gRun">用正方形鋪滿</button>');
    $('gA').onchange = (e) => { eu.a = Math.max(2, Math.min(99, Number(e.target.value) || 21)); clearLog(); enterEuclid(); };
    $('gB').onchange = (e) => { eu.b = Math.max(1, Math.min(99, Number(e.target.value) || 15)); clearLog(); enterEuclid(); };
    on('gRun', () => euclidRun());
    log('gcd(a, b) = gcd(b, a mod b)：從長方形切掉最大的正方形，剩下的長方形繼續切。');
    setState('Euclid：gcd(' + eu.a + ', ' + eu.b + ')', [['a', String(eu.a)], ['b', String(eu.b)]], '按「用正方形鋪滿」');
  }
  async function euclidRun(tok) {
    if (busy) return; busy = true;
    lab.clear();
    let A = Math.max(eu.a, eu.b), B = Math.min(eu.a, eu.b);
    const w = W(tok), sc = Math.min(11 / A, 7 / B);
    let x0 = -A * sc / 2, z0 = -B * sc / 2, wid = A, hei = B, horiz = true, step = 0;
    const rows = [];
    const frame = cube('', '#efe6d6', [A * sc, 0.05, B * sc], 0, 0.02, 0);
    try {
      while (wid > 0 && hei > 0 && step < 12) {
        const big = Math.max(wid, hei), small = Math.min(wid, hei), qn = Math.floor(big / small), rem = big % small;
        rows.push([big + ' = ' + small + ' · ' + qn + ' + ' + rem]);
        if (tok) say('切 ' + qn + ' 個 ' + small + '×' + small + ' 的正方形', big + ' = ' + small + ' · ' + qn + ' + ' + rem);
        const col = ECOL[step % ECOL.length];
        for (let k = 0; k < qn; k++) {
          const s = small * sc;
          const cx = wid >= hei ? x0 + (k + 0.5) * s : x0 + s / 2;
          const cz = wid >= hei ? z0 + s / 2 : z0 + (k + 0.5) * s;
          const m = cube(qn <= 12 && small * sc > 0.45 ? small : '', col, [s * 0.94, 0.25 + 0.08 * (step % 3), s * 0.94], cx, 0.15, cz, 2.5);
          void m;
          await w(tok ? Math.max(120, 600 / qn) : 30);
        }
        if (wid >= hei) { x0 += qn * small * sc; wid = rem; } else { z0 += qn * small * sc; hei = rem; }
        step++;
        await w(tok ? 900 : 60);
      }
    } finally { busy = false; }
    void frame;
    const g = gcd(eu.a, eu.b);
    setState('Euclid：gcd(' + eu.a + ', ' + eu.b + ')', rows.map((r, i) => ['第 ' + (i + 1) + ' 步', r[0]]),
      '<span class="ok">最後的正方形邊長 = gcd = ' + g + '</span><br>能鋪滿 a×b 的最大正方形邊長');
    log('gcd(' + eu.a + ', ' + eu.b + ') = ' + g + '，共 ' + rows.length + ' 次除法。');
    return g;
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.14) {
      const S = pick([['n² 是偶數', 'n 是偶數'], ['3n + 2 是奇數', 'n 是奇數'], ['xy 是無理數', 'x 或 y 是無理數'], ['n² + 1 是偶數', 'n 是奇數']]);
      const m = pick(['逆否證明（contraposition）', '反證法（contradiction）', '直接證明（direct proof）']);
      const ans = { '逆否證明（contraposition）': '假設「' + S[1] + '」不成立，推出「' + S[0] + '」不成立', '反證法（contradiction）': '假設「' + S[0] + '」成立且「' + S[1] + '」不成立，推出矛盾', '直接證明（direct proof）': '假設「' + S[0] + '」成立，直接推出「' + S[1] + '」' }[m];
      return { q: '要證「若 ' + S[0] + '，則 ' + S[1] + '」，用' + m + '時的起手式？', opts: ['假設「' + S[1] + '」不成立，推出「' + S[0] + '」不成立', '假設「' + S[0] + '」成立且「' + S[1] + '」不成立，推出矛盾', '假設「' + S[0] + '」成立，直接推出「' + S[1] + '」', '假設「' + S[1] + '」成立，推出「' + S[0] + '」成立'], ans, why: 'p → q：直接證明假設 p；逆否證 ¬q → ¬p；反證假設 p ∧ ¬q 推出矛盾。最後一個是證逆命題，不算。' };
    }
    if (k < 0.27) {
      const fam = pick([['2ⁿ < n!', (n) => Math.pow(2, n) < fact(n)], ['3ⁿ < n!', (n) => Math.pow(3, n) < fact(n)], ['2ⁿ > n²', (n) => Math.pow(2, n) > n * n], ['n! > n²', (n) => fact(n) > n * n], ['2ⁿ > n³', (n) => Math.pow(2, n) > n * n * n]]);
      let n0 = 1; for (let n = 1; n <= 20; n++) { let ok = true; for (let m = n; m <= 20; m++) if (!fam[1](m)) { ok = false; break; } if (ok) { n0 = n; break; } }
      const opts = [n0, n0 - 1, n0 + 1, n0 + 2].filter((x) => x >= 1).map(String);
      while (opts.length < 4) opts.push(String(n0 + opts.length + 1));
      return { q: '用歸納法證明「' + fam[0] + '」，基底應從哪個 n 開始（之後全部成立的最小 n）？', opts, ans: String(n0), why: '直接代：n = ' + n0 + ' 成立，n = ' + (n0 - 1) + ' 不成立；基底挑錯，歸納步驟再對也沒用。' };
    }
    if (k < 0.4) {
      const f = pick([['1 + 2 + … + k', 'k + 1', ['k', '2k + 1', '(k+1)(k+2)/2']], ['1 + 3 + … + (2k − 1)', '2k + 1', ['2k − 1', 'k + 1', '(k+1)²']], ['1² + 2² + … + k²', '(k + 1)²', ['k²', '2k + 1', 'k(k+1)']], ['1 + 2 + 4 + … + 2ᵏ', '2ᵏ⁺¹', ['2ᵏ', '2k + 2', '2ᵏ⁺¹ − 1']]]);
      return { q: '歸納步驟：已知 P(k) 的左邊是 ' + f[0] + '，要得到 P(k+1) 的左邊，需要加上哪一項？', opts: [f[1], ...f[2]], ans: f[1], why: 'P(k+1) 的左邊 = P(k) 的左邊 + 第 k+1 項；把歸納假設代進去再整理成 P(k+1) 的右邊。' };
    }
    if (k < 0.53) {
      const pr = pick([[4, 5], [3, 5], [3, 7], [5, 6], [4, 7], [3, 8]]);
      const n0 = pr[0] * pr[1] - pr[0] - pr[1] + 1;
      return { q: '只有 ' + pr[0] + ' 分與 ' + pr[1] + ' 分郵票。可以湊出「所有 ≥ n₀」的金額，最小的 n₀ 是？（強歸納要幾個基底？）', opts: [n0 + '；' + pr[0] + ' 個基底', (n0 - 1) + '；' + pr[0] + ' 個基底', n0 + '；1 個基底', (n0 + pr[0]) + '；' + pr[1] + ' 個基底'], ans: n0 + '；' + pr[0] + ' 個基底', why: '湊不出的最大值 = ' + pr[0] + '·' + pr[1] + ' − ' + pr[0] + ' − ' + pr[1] + ' = ' + (n0 - 1) + '。歸納時 P(n) 由 P(n − ' + pr[0] + ') 加一張 ' + pr[0] + ' 分得到，所以要連續 ' + pr[0] + ' 個基底。' };
    }
    if (k < 0.67) {
      const d = 2 + Math.floor(Math.random() * 10);
      const a = (Math.random() < 0.4 ? -1 : 1) * (5 + Math.floor(Math.random() * 90));
      const q = Math.floor(a / d), r = a - d * q;
      const wrongR = a < 0 ? -((-a) % d) : (r + 1) % d;
      return { q: '除法定理：a = ' + a + '，d = ' + d + '，求 q 與 r（0 ≤ r < d）', opts: ['q = ' + q + '，r = ' + r, 'q = ' + (q + 1) + '，r = ' + (r - d), 'q = ' + q + '，r = ' + wrongR, 'q = ' + (q - 1) + '，r = ' + (r + d)], ans: 'q = ' + q + '，r = ' + r, why: a + ' = ' + d + '·(' + q + ') + ' + r + '；r 一定要非負且小於 d' + (a < 0 ? '（負數時 q 要往下取，例如 Rosen：−11 = 3·(−4) + 1）' : '') + '。' };
    }
    if (k < 0.8) {
      const g = pick([2, 3, 4, 6, 7]), x = g * (3 + Math.floor(Math.random() * 20)), y = g * (2 + Math.floor(Math.random() * 15));
      const G = gcd(x, y);
      return { q: '用 Euclid 演算法求 gcd(' + x + ', ' + y + ')', opts: [...new Set([G, G * 2, Math.max(1, Math.floor(G / 2)), G + 1, 1].map(String))].slice(0, 4), ans: String(G), why: 'gcd(a, b) = gcd(b, a mod b)，一直做到餘數 0；最後一個非零餘數就是 gcd。' };
    }
    if (k < 0.9) {
      const items = [
        ['「所有馬同色」的歸納證明錯在哪？', 'n = 1 推到 n = 2 時，兩群沒有共同的馬', ['基底 n = 1 不成立', '歸納假設用錯變數', '沒有錯，結論成立'], '拿掉一匹與拿掉另一匹的兩群要重疊才能傳遞顏色；n+1 = 2 時重疊是空的。'],
        ['證明 √2 是無理數時，矛盾出在哪？', 'a、b 都是偶數，和「最簡分數」矛盾', ['a² = 2b² 不可能', 'b 必須是 0', '√2 > 1'], '假設 √2 = a/b 且 gcd(a,b) = 1，推出 a、b 都是偶數。'],
        ['Euclid 證明質數無限多：Q = p₁p₂…pₙ + 1，下列何者正確？', 'Q 的質因數不在 p₁…pₙ 裡', ['Q 一定是質數', 'Q 一定是合數', 'Q 可以被 p₁ 整除'], 'Q 不一定是質數（2·3·5·7·11·13 + 1 = 30031 = 59·509），但它的質因數都是新的。'],
        ['強歸納法和一般歸納法的差別？', '歸納步驟可以假設 P(n₀) 到 P(k) 全部成立', ['基底可以省略', '只能用在不等式', '只能證有限多個 n'], '兩者等價；強歸納在需要用到 P(k−3)、P(a)、P(b) 這種較小情況時比較方便。'],
        ['要證「每個 ≥ 2 的整數都是質數的乘積」，為什麼用強歸納？', 'n 若是合數 = ab，要用 P(a) 與 P(b)，不是 P(n−1)', ['因為基底有兩個', '因為 n 可能是負數', '因為一般歸納不能證存在性'], 'a、b 介於 2 與 n−1 之間，但不知道是哪一個。'],
        ['以反例否定「每個正整數都是兩個整數平方和」，最小反例？', '3', ['2', '5', '4'], '1 = 1²+0²、2 = 1²+1²，3 不行。'],
      ];
      const [q, ans, wrong, why] = pick(items);
      return { q, opts: [ans, ...wrong], ans, why };
    }
    const n = 3 + Math.floor(Math.random() * 6), k2 = Math.floor(n / 2);
    const odd = n % 2 === 1;
    const ans = odd ? n * n + ' = 2·' + (2 * k2 * k2 + 2 * k2) + ' + 1' : n * n + ' = 2·' + n * n / 2;
    return { q: 'n = ' + n + '，把 n² 寫成 2m 或 2m + 1 的形式', opts: [ans, n * n + ' = 2·' + Math.floor(n * n / 2) + (odd ? '' : ' + 1'), n * n + ' = 2·' + (Math.floor(n * n / 2) + 1) + ' + 1', n * n + ' = 4·' + k2 * k2], ans, why: odd ? '(2k+1)² = 2(2k²+2k) + 1，k = ' + k2 + '。' : '(2k)² = 2(2k²)，k = ' + k2 + '。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts)].sort(() => Math.random() - 0.5);
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

  // ───────────────────────── 場景（課本：Rosen 1.7–1.8、5.1–5.2、4.1、4.3） ─────────────────────────
  // 證明的步驟：一塊一塊疊上去
  function proofStack(lines, x = 0, top = 6.2, wdt = 7.6) {
    const ms = [];
    return {
      ms,
      async add(tok, text, color, caption, formula, ms0 = 1800) {
        ms.forEach((m) => glow(m, null));
        const m = cube(text, color || '#4b9ee2', [wdt, 0.55, 1], x, top - ms.length * 0.78, 0, 2.5);
        glow(m, GOLD); ms.push(m);
        say(caption || text, formula || '');
        await beat(tok, ms0);
        return m;
      },
    };
  }
  async function scDirect(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const P = proofStack();
    say('Direct proof：假設 p，一路推到 q', '定理：若 n 是奇數，則 n² 是奇數');
    await beat(tok, 2400);
    await P.add(tok, '假設 n 是奇數', '#9b7ef4', '先假設前提 p 為真');
    await P.add(tok, 'n = 2k + 1（k 是整數）', '#4b9ee2', '用奇數的定義改寫', 'odd ⇔ ∃k, n = 2k + 1');
    await P.add(tok, 'n² = 4k² + 4k + 1', '#4b9ee2', '平方展開');
    await P.add(tok, 'n² = 2(2k² + 2k) + 1', '#4b9ee2', '湊成 2·(整數) + 1');
    const m = await P.add(tok, '∴ n² 是奇數', '#dd8238', '符合奇數的定義 → 得證', 'p → q 成立', 2000);
    glow(m, GREEN);
    par.n = 5; enterParity(); controls('');
    say('n = 5 的樣子：k = 2', '');
    await parityDraw(tok);
    say('25 = 4·4 + 4·2 + 1 = 2·12 + 1', '藍 4k²、紫 4k、橘 1');
    await beat(tok, 3200);
  }
  async function scContrapos(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('Rosen：若 3n + 2 是奇數，則 n 是奇數', '直接證不好下手');
    await beat(tok, 2600);
    say('改證逆否：若 n 不是奇數，則 3n + 2 不是奇數', 'p → q ≡ ¬q → ¬p');
    await beat(tok, 2600);
    const P = proofStack();
    await P.add(tok, '假設 n 是偶數（¬q）', '#9b7ef4', '從結論的否定出發');
    await P.add(tok, 'n = 2k', '#4b9ee2', '偶數的定義');
    await P.add(tok, '3n + 2 = 6k + 2 = 2(3k + 1)', '#4b9ee2', '代進去');
    await P.add(tok, '∴ 3n + 2 是偶數（¬p）', '#dd8238', '得到前提的否定');
    say('¬q → ¬p 成立，所以 p → q 成立', '逆否證明（proof by contraposition）');
    await beat(tok, 3000);
  }
  async function scSqrt2(tok) {
    fresh([0, 4.5, 14.5], [0, 3, 0]);
    say('反證法：證明 √2 是無理數', '假設結論不成立，推出矛盾');
    await beat(tok, 2400);
    const P = proofStack();
    await P.add(tok, '假設 √2 = a / b，a、b 沒有公因數', '#9b7ef4', '假設 √2 是有理數，而且是最簡分數');
    await P.add(tok, '2 = a² / b²  →  a² = 2b²', '#4b9ee2', '兩邊平方');
    const ma = await P.add(tok, 'a² 是偶數 → a 是偶數，a = 2c', '#4b9ee2', 'a² 偶 → a 偶（用逆否證過）');
    await P.add(tok, '4c² = 2b²  →  b² = 2c²', '#4b9ee2', '代回去');
    const mb = await P.add(tok, 'b² 是偶數 → b 是偶數', '#4b9ee2', '同樣的理由');
    glow(ma, RED); glow(mb, RED);
    const x = await P.add(tok, '2 | a 且 2 | b：和「沒有公因數」矛盾！', '#d64545', 'a、b 都有因數 2', 'contradiction', 2600);
    glow(x, RED);
    say('假設錯了 → √2 是無理數', '(¬p → F) ⇒ p');
    await beat(tok, 3000);
  }
  async function scPrimes(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    say('Euclid：質數有無限多個', '反證：假設只有 p₁, p₂, …, pₙ');
    await beat(tok, 2600);
    const ps = [2, 3, 5, 7, 11, 13];
    const ms = ps.map((p, i) => cube(p, '#4b9ee2', [0.9, 0.8, 0.9], -4.5 + i * 1.3, 0.4, 0, 3));
    await beat(tok, 1200);
    say('Q = p₁p₂…pₙ + 1', '用每個 pᵢ 除 Q，都餘 1');
    await beat(tok, 2600);
    let prod = 1;
    for (let i = 0; i < ps.length; i++) {
      prod *= ps[i];
      ms.slice(0, i + 1).forEach((m) => glow(m, GOLD));
      const Q = prod + 1;
      const f = isPrime(Q) ? '質數' : '= 59 × 509';
      say('前 ' + (i + 1) + ' 個：Q = ' + prod + ' + 1 = ' + Q, Q + ' ' + f);
      await beat(tok, i === 5 ? 3200 : 1500);
    }
    cube('59', '#dd8238', [0.9, 0.8, 0.9], 3.4, 0.4, 2.2, 3); cube('509', '#dd8238', [1.1, 0.8, 0.9], 4.8, 0.4, 2.2, 3);
    say('30031 不是質數，但 59、509 都不在原清單裡', 'Q 的質因數一定是新的 → 矛盾');
    await beat(tok, 3400);
  }
  async function scCases(tok) {
    fresh([0, 9, 9], [0, 0, 0.4]);
    say('Proof by cases：|xy| = |x||y|', '依 x、y 的正負分四種情況');
    const quad = [[1, 1, '#2fc092', 'x≥0, y≥0：xy ≥ 0'], [-1, 1, '#4b9ee2', 'x<0, y≥0：|xy| = −xy = (−x)y'], [-1, -1, '#9b7ef4', 'x<0, y<0：xy > 0 = (−x)(−y)'], [1, -1, '#dd8238', 'x≥0, y<0：|xy| = x(−y)']];
    line(-5.5, 0.05, 0, 5.5, 0.05, 0, '#6e5f49'); line(0, 0.05, -4, 0, 0.05, 4, '#6e5f49');
    tag('x', 'idx', 5.8, 0.1, 0); tag('y', 'idx', 0, 0.1, -4.3);
    await beat(tok, 2200);
    for (const [sx, sy, c, cap] of quad) {
      const m = cube('', c, [4.6, 0.12, 3.4], sx * 2.6, 0.08, -sy * 1.95, 2);
      void m;
      say(cap, '這個情況下等式成立');
      await beat(tok, 2200);
    }
    say('四種情況涵蓋所有 x、y → 得證', '(p₁ ∨ p₂ ∨ p₃ ∨ p₄) → q ≡ (p₁→q) ∧ … ∧ (p₄→q)');
    await beat(tok, 3000);
  }
  async function scCounter(tok) {
    fresh([0, 5, 13], [0, 1.6, 0]);
    say('「每個正整數都是兩個整數的平方和」？', '要否定 ∀，找一個反例就好');
    await beat(tok, 2400);
    const ok = { 1: '1²+0²', 2: '1²+1²', 4: '2²+0²', 5: '2²+1²' };
    for (let n = 1; n <= 5; n++) {
      const good = !!ok[n];
      const m = cube(n, good ? '#2fc092' : '#d64545', [1.2, 1, 1.2], -5 + (n - 1) * 2.5, 0.5, 0, 3);
      tag(good ? ok[n] : '找不到', 'idx', -5 + (n - 1) * 2.5, 1.5);
      say(good ? n + ' = ' + ok[n] : '3：0、1 的平方組不出 3', '');
      if (!good) glow(m, RED);
      await beat(tok, good ? 1000 : 2400);
      if (n === 3) break;
    }
    say('反例 n = 3 → 命題為假', '¬∀n P(n) ≡ ∃n ¬P(n)');
    await beat(tok, 3000);
  }
  async function scDomino(tok) {
    dom.key = 'sum'; dom.base = true; dom.brk = 0; enterDomino(); controls('');
    say('數學歸納法 = 一排骨牌', '1 + 2 + … + n = n(n+1)/2');
    await beat(tok, 2400);
    say('Basis step：P(1) 成立 → 第一張會倒', '1 = 1·2/2');
    await beat(tok, 2000);
    say('Inductive step：只要第 k 張倒，第 k+1 張就倒', 'P(k) → P(k+1)');
    await beat(tok, 2400);
    await dominoRun(tok);
    say('兩步都證了 → 每一張都倒', '∀n ≥ 1, P(n)');
    await beat(tok, 2400);
    dom.brk = 5; enterDomino(); controls('');
    say('如果歸納步驟在 k = 5 斷掉…', '');
    await beat(tok, 1600);
    await dominoRun(tok);
    say('第 6 張以後就不倒了', '兩個步驟缺一不可');
    await beat(tok, 2600);
    dom.brk = 0;
  }
  async function scSumStairs(tok) {
    fresh([0, 5.5, 13], [0, 2.2, 0]);
    const n = 5, s = 0.85, X = (j) => (j - n / 2) * s, Y = (i) => 0.4 + i * s * 0.9;
    say('1 + 2 + 3 + 4 + 5 疊成樓梯', '');
    for (let j = 0; j < n; j++) { for (let i = 0; i <= j; i++) cube('', '#4b9ee2', [s * 0.9, s * 0.8, 0.8], X(j), Y(i), 0, 2); await beat(tok, 500); }
    await beat(tok, 800);
    say('再拿一份倒過來蓋上去', '兩份剛好拼成 n × (n+1) 的長方形');
    for (let j = 0; j < n; j++) { for (let i = j + 1; i <= n; i++) cube('', '#dd8238', [s * 0.9, s * 0.8, 0.8], X(j), Y(i), 0, 3); await beat(tok, 450); }
    say('2 × (1+…+5) = 5 × 6 = 30', '1 + … + n = n(n+1)/2 = 15');
    await beat(tok, 2600);
    say('歸納步驟：P(k) 兩邊加 (k+1)', 'k(k+1)/2 + (k+1) = (k+1)(k+2)/2');
    await beat(tok, 3200);
  }
  async function scOddSum(tok) {
    fresh([0, 9, 8], [0, 0, 0.5]);
    say('1 + 3 + 5 + … + (2n−1) = n²', '每加一個奇數，正方形長大一圈');
    await beat(tok, 2200);
    const s = 1, P = (i) => (i - 2) * s;
    const cols = ['#4b9ee2', '#9b7ef4', '#2fc092', '#dd8238', '#e55a9b'];
    for (let k = 1; k <= 5; k++) {
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i === k - 1 || j === k - 1) cube('', cols[k - 1], [0.88, 0.35, 0.88], P(j), 0.18, P(i), 2);
      say('加上 ' + (2 * k - 1) + '（L 形）→ ' + k + ' × ' + k, '1 + … + ' + (2 * k - 1) + ' = ' + k * k);
      await beat(tok, 1500);
    }
    say('P(k) → P(k+1)：k² + (2k+1) = (k+1)²', 'L 形 = 一邊 k、一邊 k、轉角 1');
    await beat(tok, 3200);
  }
  async function scIneq(tok) {
    dom.key = 'fact'; dom.base = true; dom.brk = 0; enterDomino(); controls('');
    say('Rosen：2ⁿ < n!，對 n ≥ 4', '基底不一定從 1 開始');
    await beat(tok, 2600);
    say('n = 1, 2, 3 都不成立：2 < 1？4 < 2？8 < 6？', '基底是 P(4)：16 < 24');
    await beat(tok, 3000);
    say('歸納步驟：2ᵏ⁺¹ = 2·2ᵏ < 2·k! < (k+1)·k!', '用到 k ≥ 4 時 2 < k + 1');
    await beat(tok, 3000);
    await dominoRun(tok);
    say('從第 4 張開始全部倒下', '∀n ≥ 4, 2ⁿ < n!');
    await beat(tok, 2600);
    dom.key = 'sum';
  }
  async function scHorses(tok) {
    fresh([0, 5, 13], [0, 1.4, 0]);
    say('錯誤證明：「所有馬都同一顏色」', '找出歸納步驟哪裡壞掉');
    await beat(tok, 2400);
    const cols = ['#4b9ee2', '#4b9ee2', '#4b9ee2', '#4b9ee2'];
    let hs = cols.map((c, i) => cube('馬' + (i + 1), c, [1.1, 1.1, 1.1], -2.4 + i * 1.6, 0.55, 0, 3));
    say('k+1 匹：拿掉最後一匹，前 k 匹同色', '拿掉第一匹，後 k 匹也同色');
    await beat(tok, 1500);
    for (let i = 0; i < 3; i++) move(hs[i], -2.4 + i * 1.6, 0.55, -1.2);
    await beat(tok, 1400);
    for (let i = 1; i < 4; i++) glow(hs[i], GOLD);
    say('兩群有重疊（中間的馬）→ 全部同色', 'k + 1 = 4 時看起來沒問題');
    await beat(tok, 2800);
    hs.forEach((m) => fly(m, V3(0, 7, -3)));
    await beat(tok, 800);
    const a = cube('馬1', '#4b9ee2', [1.1, 1.1, 1.1], -1, 0.55, 0, 3), b = cube('馬2', '#dd8238', [1.1, 1.1, 1.1], 1, 0.55, 0, 3);
    say('但 k + 1 = 2：{馬1} 與 {馬2} 沒有重疊', '顏色傳不過去');
    await beat(tok, 2400);
    glow(a, RED); glow(b, RED);
    say('P(1) → P(2) 不成立，整條骨牌鏈斷在第一步', '歸納步驟必須對「每個」k ≥ n₀ 成立');
    await beat(tok, 3200);
  }
  async function scStamps(tok) {
    st.N = 24; enterStamps(); controls('');
    say('Rosen：郵資 ≥ 12 分都能用 4、5 分郵票湊', '強歸納法（strong induction）');
    await beat(tok, 2600);
    await stampsRun(tok);
    say('每一根都是「往回 4 根」再加一張 4 分', '用到 P(k−3)，不只 P(k)');
    await beat(tok, 3200);
  }
  async function scFactor(tok) {
    fresh([0, 5, 13], [0, 2.8, 0]);
    say('每個 n ≥ 2 都是質數的乘積（強歸納）', '例：n = 60');
    await beat(tok, 2400);
    const nodes = [[60, 0, 5.6], [6, -2.6, 4.1], [10, 2.6, 4.1], [2, -3.8, 2.6], [3, -1.4, 2.6], [2, 1.4, 2.6], [5, 3.8, 2.6]];
    const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
    const ms = [];
    for (let i = 0; i < nodes.length; i++) {
      const [v, x, y] = nodes[i];
      if (i) { const [p] = edges[i - 1]; line(nodes[p][1], nodes[p][2] - 0.35, 0, x, y + 0.35, 0); }
      ms.push(cube(v, isPrime(v) ? '#2fc092' : '#4b9ee2', [1.1, 0.7, 0.9], x, y, 0, 2));
      if (i === 2) { say('60 是合數：60 = 6 × 10', '6、10 都 < 60 → 由強歸納假設，它們已是質數乘積'); await beat(tok, 2800); }
      else if (i === 6) { say('6 = 2 × 3，10 = 2 × 5', '質數本身就是基底'); await beat(tok, 2400); }
      else await beat(tok, 600);
    }
    say('60 = 2 × 3 × 2 × 5', '需要 P(6)、P(10)，不是 P(59) → 用強歸納');
    await beat(tok, 3200);
  }
  async function scWellOrder(tok) {
    wo.a = 101; wo.d = 11; enterWO(); controls('');
    say('Rosen：101 除以 11', 'S = {101 − 11q ≥ 0}');
    await beat(tok, 2200);
    await woRun(tok);
    say('S 非空 → 良序原理保證有最小元素 r = 2', '101 = 11 · 9 + 2');
    await beat(tok, 3000);
    say('r 一定 < 11：否則 r − 11 也在 S 且更小', '最小元素 → 唯一的 q、r');
    await beat(tok, 3000);
  }
  async function scEuclid(tok) {
    fresh([0, 5, 13], [0, 2.6, 0]);
    say('Rosen：gcd(414, 662)', 'gcd(a, b) = gcd(b, a mod b)');
    await beat(tok, 2200);
    const steps = [[662, 414, 1, 248], [414, 248, 1, 166], [248, 166, 1, 82], [166, 82, 2, 2], [82, 2, 41, 0]];
    const H = (v) => 0.15 + v / 662 * 5.4;
    for (let i = 0; i < steps.length; i++) {
      const [a, b, q, r] = steps[i];
      const x = -5 + i * 2.5;
      cube('', '#4b9ee2', [0.7, H(a), 0.7], x - 0.45, H(a) / 2, 0); tag(String(a), 'idx', x - 0.45, H(a) + 0.3);
      const mb = cube('', '#dd8238', [0.7, H(b), 0.7], x + 0.45, H(b) / 2, 0); tag(String(b), 'idx', x + 0.45, H(b) + 0.3);
      tag(r ? 'r=' + r : 'r=0', r ? 'ptr' : 'ptr alt', x, -0.3, 0.8);
      say(a + ' = ' + b + ' · ' + q + ' + ' + r, r ? '換成 gcd(' + b + ', ' + r + ')' : '餘數 0 → 停');
      if (!r) glow(mb, GOLD);
      await beat(tok, 2000);
    }
    say('gcd(414, 662) = 2', '最後一個非零餘數');
    await beat(tok, 2600);
    eu.a = 21; eu.b = 15; enterEuclid(); controls('');
    say('幾何看法：用正方形鋪滿 21 × 15', '');
    await euclidRun(tok);
    say('最後的正方形邊長 3 = gcd(21, 15)', '');
    await beat(tok, 3000);
  }

  const scenes = {
    'direct-proof': { title: 'Direct proof：n 奇 → n² 奇（Rosen 例）', play: scDirect },
    'contraposition': { title: '逆否證明：3n + 2 奇 → n 奇（Rosen 例）', play: scContrapos },
    'sqrt2': { title: '反證法：√2 是無理數（課本）', play: scSqrt2 },
    'infinite-primes': { title: '反證法：質數無限多（課本）', play: scPrimes },
    'proof-cases': { title: 'Proof by cases：|xy| = |x||y|（Rosen 例）', play: scCases },
    'counterexample': { title: '反例：不是每個數都是兩平方和（Rosen 例）', play: scCounter },
    'domino': { title: '數學歸納法：骨牌 = 基底 + 歸納步驟（課本）', play: scDomino },
    'sum-stairs': { title: '1 + … + n = n(n+1)/2：樓梯拼長方形（課本）', play: scSumStairs },
    'odd-sum': { title: '奇數和 = n²：L 形一圈一圈（Rosen 例）', play: scOddSum },
    'induction-ineq': { title: '2ⁿ < n!：基底從 4 開始（Rosen 例）', play: scIneq },
    'horses': { title: '錯誤歸納：所有馬同色（課本）', play: scHorses },
    'strong-stamps': { title: '強歸納：4 分與 5 分郵票（Rosen 例）', play: scStamps },
    'strong-factor': { title: '強歸納：每個整數都是質數乘積（課本）', play: scFactor },
    'well-ordering': { title: '良序原理 → 除法定理 101 = 11·9 + 2（Rosen 例）', play: scWellOrder },
    'euclid-gcd': { title: 'Euclid：gcd(414, 662) = 2（Rosen 例）', play: scEuclid },
  };

  return {
    kicker: '離散數學・第 2 章',
    title: '證明方法',
    color: 'var(--dm)',
    modes: [
      { id: 'domino', name: '骨牌歸納', enter: enterDomino },
      { id: 'stamps', name: '強歸納郵票', enter: enterStamps },
      { id: 'parity', name: '奇偶直接證明', enter: enterParity },
      { id: 'wellorder', name: '良序與除法', enter: enterWO },
      { id: 'euclid', name: 'Euclid 鋪磚', enter: enterEuclid },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['direct-proof', 'contraposition', 'sqrt2', 'infinite-primes', 'proof-cases', 'counterexample',
      'domino', 'sum-stairs', 'odd-sum', 'induction-ineq', 'horses', 'strong-stamps', 'strong-factor', 'well-ordering', 'euclid-gcd'],
    stop() { stopTimer(); busy = false; },
  };
}
