// 離散數學 第2章：證明方法（Direct proof、Contraposition、Contradiction、Cases、
// Mathematical / Strong Induction、Well-Ordering、除法定理與 Euclid）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（除法定理 a = dq + r，0 ≤ r < d；強歸納法以郵票 4、5 分為例）。
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ pfA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 2 章（交大 易志偉 Lec03–Lec04 Logic and Proofs）— cued scenes ───
// Every scene is a list of steps; each step waits for the lecturer's sentence (notes "cues"), then makes one short move.
// Nothing loops or replays. 老師的例子照用（Alice/Andy、lily apple banana cherry、x² > 10、喜歡 L(x,y)、
// 小英參選、腳踏車、烤肉、email、n 奇 → n² 奇、3n+2、√2、1 = 2、x² + 3y² = 8…）；老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const ok = (x, y, t = 'T 真') => tag(t, 'good', x, y);
const ng = (x, y, t = 'F 假') => tag(t, 'bad', x, y);
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f' };
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a proof board: lines appear one under another (left-aligned)
function board(x, yTop, dy = 0.62) {
  const ls = [];
  return {
    ls,
    ln(t, c = 'say', dx = 0) { const l = L(t, c, x + dx, yTop - ls.length * dy); ls.push(l); return l; },
    skip() { ls.push(null); },
    set(i, c) { cls(ls[i < 0 ? ls.length + i : i], c); },
    y(i) { return yTop - i * dy; },
  };
}
// a word / value block that can be checked (glow green or red)
const blk = (t, c, x, y, w = 1.5) => cube(t, c, [w, 0.55, 0.7], x, y, 0);
const pass = (m) => glow(m, '#0f5a3a');
const fail = (m) => glow(m, '#7a1010');
async function hopTo(tok, o, x, y, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, a.z), ms); }

// ════════ _WXIdyyHfqk（Lec03 Logic and Proofs：述詞與量詞） ════════
scene('pfA-l3-pred', '述詞邏輯：Alice is a girl → P(x)', [
  async (tok, S) => { // 14.1 上次：命題邏輯
    S.a = T('上次：命題邏輯 propositional logic', 'idx', 0, 6.5);
    cap('上次講的是命題邏輯', 'proposition：一句能判斷真假的話');
  },
  async (tok, S) => { // 20.4 這次：述詞邏輯
    T('這次：述詞邏輯 predicate logic', 'ptr alt', 0, 5.8);
    cap('這次：述詞邏輯 predicate logic', '就是文法裡「主詞、述詞」的述詞');
  },
  async (tok, S) => { // 34.2 例句
    S.s1 = T('Alice', 'note', -2.0, 4.4); S.s2 = T('is a girl', 'say', 0.2, 4.4);
    cap('先看一個簡單的英文句子', 'Alice is a girl');
  },
  async (tok, S) => { // 53.8 主詞
    T('主詞', 'idx', -2.0, 3.8); S.al = buddy('Alice', '', FC.pink, -5.6, 0);
    cap('Alice 是主詞', '');
  },
  async (tok, S) => { // 61.0 述詞
    cls(S.s2, 'ptr alt'); T('述詞：用來描述 Alice', 'idx', 0.4, 3.8);
    cap('is a girl 在描述 Alice', '這部分叫做述詞');
  },
  async (tok, S) => { // 72.3 其他人
    S.o = ['John is a girl', 'Alan is a girl', 'Amy is a girl'].map((t, i) => T(t, 'say', 4.6, 3.2 - i * 0.65));
    cap('也可能問 John、Alan、Amy…', '一大堆長得很像的命題');
  },
  async (tok, S) => { // 106.6 主詞空出來
    txt(S.s1, '  ?  '); S.o.forEach((l) => cls(l, 'idx'));
    cap('把主詞當成可以代換的空格', '只留下述詞，像一個函式');
  },
  async (tok, S) => { // 132.0 P(x)
    S.px = T('P(x)：x is a girl', 'note', 0, 2.3);
    cap('述詞函式 P(x)', 'x 代進主詞的位置');
  },
  async (tok, S) => { // 153.3 x 未知
    S.nq = T('x 不知道是誰 → 不是命題', 'bad', 0, 1.6);
    cap('x 不知道是誰的時候', 'P(x) 不能判斷真假，不是命題');
  },
  async (tok, S) => { // 163.2 代入 Andy
    S.an = buddy('Andy', '', FC.blue, -3.6, 0); txt(S.s1, 'Andy'); kill(S.nq);
    S.pa = T('P(Andy)：Andy is a girl', 'note', 0, 1.6);
    await S.an.hop(tok);
    cap('把 x 代成 Andy', '函式值 P(Andy)：Andy is a girl');
  },
  async (tok, S) => { // 185.0 變成命題 → 假
    ng(3.6, 1.6, 'F 假（Andy 是男生）'); S.an.mood('wow');
    cap('代入後就是一個命題', 'Andy 是男生 → 這個命題為假');
  },
  async (tok, S) => { // 233.5 名詞
    T('P 是 propositional function（命題函式）', 'ptr', 0, 0.6);
    cap('P 像 f、g 一樣是函式', '函式值是命題 → propositional function');
  },
]);

scene('pfA-l3-multi', '多個變數：Q(x, y, z) 與 P(x): x > 3', [
  async (tok, S) => { // 252.1 不只主詞
    S.b = board(-6.4, 5.8, 0.66);
    S.b.ln('不只主詞，任何位置都能換成變數', 'idx');
    cap('變數可以不只一個', '主詞、後面的詞都能代換');
  },
  async (tok, S) => { // 282.5 Q(x,y,z)
    S.b.ln('Q(x, y, z)：x + y = z', 'note');
    S.b.ln('x、y、z 不知道 → 不是命題', 'bad');
    cap('Q(x, y, z)：x + y = z', '還沒代入之前不能判斷真假');
  },
  async (tok, S) => { // 300.1 代 1,2,3
    S.b.ln('x = 1, y = 2, z = 3 → 1 + 2 = 3', 'say');
    ok(-0.6, S.b.y(3));
    cap('x=1、y=2、z=3 代進去', '1 + 2 = 3 → 真');
  },
  async (tok, S) => { // 326.7 P(x): x>3
    S.c = board(1.2, 5.8, 0.66);
    S.c.ln('P(x)：x > 3', 'note');
    cap('第二個例子 P(x)：x > 3', '');
  },
  async (tok, S) => { // 330.6 x = 1
    S.c.ln('x = 1 → 1 > 3', 'say'); ng(4.6, S.c.y(1));
    cap('x 代 1：1 > 3', '這個命題是錯的');
  },
  async (tok, S) => { // 342.1 x = 4
    S.c.ln('x = 4 → 4 > 3', 'say'); ok(4.6, S.c.y(2));
    cap('x 代 4：4 > 3', '這個命題是真的');
  },
  async (tok, S) => { // 358.5 P(2)
    S.c.ln('P(2)：2 > 3', 'say'); ng(4.6, S.c.y(3));
    cap('投影片上：P(2) 是 2 > 3', '判斷為假');
  },
  async (tok, S) => { // 368.1 P(4)
    S.c.ln('P(4)：4 > 3', 'say'); ok(4.6, S.c.y(4));
    cap('P(4) 是 4 > 3', '判斷為真');
  },
  async (tok, S) => { // 385.4 n-tuple
    T('P(x₁, x₂, …, xₙ)：n-ary predicate', 'ptr', 0, 1.2);
    T('(x₁, …, xₙ) 叫 n-tuple', 'idx', 0, 0.6);
    cap('多個變數 x₁ … xₙ', 'n-tuple；這種述詞叫 n-ary predicate');
  },
]);

scene('pfA-l3-forall', '全稱量詞 ∀：班上每個人都高於 120？', [
  async (tok, S) => { // 412.0 問題
    T('班上同學身高都高於 120 公分嗎？', 'ptr alt', 0, 6.4);
    cap('常問的問題：', '班上同學是不是都高於 120 公分？');
  },
  async (tok, S) => { // 453.0 P(x)
    T('P(x)：x 的身高 > 120', 'note', -3.6, 5.6);
    cap('P(x)：x 這個同學身高 > 120', '');
  },
  async (tok, S) => { // 457.1 集合
    S.z = zone('班上同學（集合）', 0, -0.05, 0, 11.5, 2.2);
    const H = [135, 128, 142, 131, 126];
    S.k = ['A', 'B', 'C', 'D', 'E'].map((n, i) => buddy(n, H[i], [FC.blue, FC.green, FC.orange, FC.purple, FC.teal][i], -4.4 + i * 2.2, 0, 0, 0.8));
    T('身高為示意', 'idx', 4.8, 2.4);
    cap('把班上同學看成一個集合', '每個人帶進 P(x) 看看');
  },
  async (tok, S) => { // 508.0 ∀x P(x)
    S.f = T('∀x P(x)', 'note', 3.2, 5.6);
    cap('每一個人都要高於 120', '寫成 ∀x P(x)');
  },
  async (tok, S) => { // 544.1 逐一檢查
    for (const b of S.k) { b.glow('#0f5a3a'); b.mood('happy'); await wt(tok, 260); }
    S.r = ok(3.2, 4.9, '全部檢查都對 → T');
    cap('A、B、C… 一個一個量', '全部都超過 120，整句才為真');
  },
  async (tok, S) => { // 569.2 一個不符合
    S.k[3].set(115); S.k[3].glow('#7a1010'); S.k[3].mood('sad'); kill(S.r);
    S.r = ng(3.2, 4.9, '只要一人不符合 → F');
    cap('只要有一個人沒超過 120', '這個命題就為假');
  },
  async (tok, S) => { // 583.5 名稱
    T('Universal Quantification（全稱量詞）', 'ptr', -1.6, 4.2);
    T('讀作 for all x, P(x)', 'idx', -1.6, 3.6);
    cap('∀ 叫 universal quantification', '讀作 for all x');
  },
  async (tok, S) => { // 657.5 domain
    S.k[3].set(131); S.k[3].glow(); S.k[3].mood('calm'); kill(S.r);
    T('前提：只看「班上同學」= domain（論域）', 'say', -1.6, 3.0);
    cap('「所有人」都有一個前提', '這個範圍就是 domain（論域）');
  },
  async (tok, S) => { // 683.0 加隔壁班
    S.n = buddy('隔壁班', 112, FC.red, 6.4, 0, 0, 0.8); S.n.mood('sad'); S.n.glow('#7a1010');
    ng(6.4, 2.4, '範圍變大 → 可能變 F');
    cap('如果範圍包含隔壁班', '有人比較矮，答案就變成假');
  },
  async (tok, S) => { // 719.9 domain 英文
    cls(S.z.userData.name, 'ptr alt'); txt(S.z.userData.name, 'domain = 班上同學');
    cap('論域英文叫 domain', '討論量詞一定要先講清楚 domain');
  },
]);

scene('pfA-l3-forall-ex', '∀ 的例子：每個字都以 b 開頭嗎？', [
  async (tok, S) => { // 726.5 P(x)
    T('P(x)：英文字 x 以 b 開頭', 'note', -3.2, 6.2);
    cap('P(x)：x 這個英文字以 b 開頭', '');
  },
  async (tok, S) => { // 743.0 U
    S.w = ['lily', 'apple', 'banana', 'cherry'].map((t, i) => blk(t, FC.sand, -4.5 + i * 2.2, 3.8, 1.8));
    T('U = {lily, apple, banana, cherry}', 'say', -1.2, 4.8);
    cap('domain U 只有這四個字', 'U 就是論域（集合）');
  },
  async (tok, S) => { // 761.7 ∀x∈U
    T('∀x ∈ U, P(x)', 'note', 3.6, 6.2);
    cap('問：U 裡每個字都以 b 開頭嗎？', '∀x ∈ U, P(x)');
  },
  async (tok, S) => { // 790.3 展開
    S.e = L('= P(lily) ∧ P(apple) ∧ P(banana) ∧ P(cherry)', 'say', -6.0, 2.4);
    cap('把檢查過程展開', '每個字都代進去，用 AND 接起來');
  },
  async (tok, S) => { // 815.2 F
    for (let i = 0; i < 4; i++) { (i === 2 ? pass : fail)(S.w[i]); await wt(tok, 250); }
    ['F', 'F', 'T', 'F'].forEach((v, i) => (v === 'T' ? ok : ng)(-4.5 + i * 2.2, 3.0, v));
    ng(2.8, 1.5, '∀ 的答案：F');
    cap('只有 banana 對，其他三個錯', 'AND 只要一個錯 → 整句為假');
  },
  async (tok, S) => { // 828.4 像 Σ
    L('像 Σ 的寫法： ⋀ (x∈U) P(x)', 'ptr', -6.0, 0.8);
    cap('也能像 summation 一樣寫', '把每個 P(x) 全部做 AND');
  },
  async (tok, S) => { // 849.7 x+1>x
    S.b = L('P(x)：x + 1 > x，domain = 所有實數', 'note', 0.6, 0.8);
    cap('再想一題：P(x)：x + 1 > x', 'x 是所有實數');
  },
  async (tok, S) => { // 876.4 T
    ok(4.4, 0.1, '∀x P(x)：T');
    cap('每個實數加 1 都比自己大', '所以 ∀x P(x) 為真');
  },
]);

scene('pfA-l3-exists', '存在量詞 ∃：至少找到一個', [
  async (tok, S) => { // 904.7 名稱
    T('Existential Quantifier（存在量詞）', 'ptr alt', 0, 6.4);
    cap('另一個常用的：存在量詞', 'existential quantifier');
  },
  async (tok, S) => { // 914.2 班上有人 >120
    S.k = ['A', 'B', 'C', 'D'].map((n, i) => buddy(n, [112, 118, 131, 109][i], [FC.blue, FC.green, FC.orange, FC.purple][i], -5.4 + i * 1.9, 0, 0, 0.8));
    T('身高為示意', 'idx', -2.6, 2.3);
    S.k[2].glow('#0f5a3a'); S.k[2].mood('happy');
    cap('班上有沒有人高於 120？', '找到一個人，命題就為真');
  },
  async (tok, S) => { // 932.0 百萬富翁
    S.m = board(1.6, 5.4, 0.62);
    S.m.ln('有人身價超過百萬嗎？', 'say');
    S.m.ln('1 個、2 個、全部都是 → 都對', 'good');
    S.m.ln('大家都沒超過 → 才錯', 'bad');
    cap('有沒有百萬富翁？', '一個兩個都行；全部都沒有才為假');
  },
  async (tok, S) => { // 951.5 符號
    S.m.ln('∃x P(x)（∃ 是 E 反過來）', 'note');
    cap('寫法 ∃x P(x)', '∃ 是大寫 E 左右翻過來');
  },
  async (tok, S) => { // 969.7 至少一個 + domain
    S.m.ln('意思：至少一個 x 滿足 P(x)；一樣要講 domain', 'idx');
    cap('意思：至少有一個', '一樣要注意 domain');
  },
  async (tok, S) => { // 989.2 例
    S.w = ['lily', 'apple', 'banana', 'cherry'].map((t, i) => blk(t, FC.sand, 0.8 + i * 1.75, 0.9, 1.5));
    T('∃x ∈ U, P(x)：有字以 b 開頭嗎？', 'note', 3.4, 2.0);
    cap('同一個 U，問：有沒有字以 b 開頭？', '∃x ∈ U, P(x)');
  },
  async (tok, S) => { // 1010.2 展開 OR
    L('= P(lily) ∨ P(apple) ∨ P(banana) ∨ P(cherry)', 'say', -6.6, -0.4);
    cap('一個一個檢查，用 OR 接起來', '只要有一個對就為真');
  },
  async (tok, S) => { // 1026.6 T
    for (let i = 0; i < 4; i++) { (i === 2 ? pass : fail)(S.w[i]); await wt(tok, 250); }
    ok(4.9, -0.4, '∃ 的答案：T');
    cap('banana 確實以 b 開頭', '其他都錯也沒關係 → 為真');
  },
]);

scene('pfA-l3-neg', '量詞的否定：¬∃ ≡ ∀¬，¬∀ ≡ ∃¬', [
  async (tok, S) => { // 1036.6 ¬∃
    S.b = board(-6.6, 6.2, 0.6);
    S.b.ln('¬∃x P(x)：「有人高於 120」是錯的', 'note');
    cap('∃x P(x) 的否定是什麼？', '¬∃x P(x)');
  },
  async (tok, S) => { // 1068.6 怎麼檢查
    S.b.ln('→ 要把所有人量一遍，大家都沒超過 120', 'say');
    cap('說「沒有人超過 120」', '要檢查所有人，全都沒超過');
  },
  async (tok, S) => { // 1109.3 工具
    S.b.ln('重要工具：量詞的否定有邏輯等價', 'ptr alt');
    cap('很重要的工具', '量詞的否定有一組邏輯等價');
  },
  async (tok, S) => { // 1131.5 ∃ = OR
    S.b.ln('∃x P(x) ≡ P(x₁) ∨ P(x₂) ∨ … ∨ P(xₙ)', 'say');
    cap('證明：先把 ∃ 展開', '就像 lily、banana 一個個代，用 OR');
  },
  async (tok, S) => { // 1171.0 ∀ = AND
    S.b.ln('∀x P(x) ≡ P(x₁) ∧ P(x₂) ∧ … ∧ P(xₙ)', 'say');
    cap('∀ 展開是 AND', '');
  },
  async (tok, S) => { // 1196.0 代換
    S.b.ln('¬∃x P(x) ≡ ¬(P(x₁) ∨ P(x₂) ∨ … ∨ P(xₙ))', 'say');
    cap('¬∃x P(x) 代換開來', '');
  },
  async (tok, S) => { // 1208.7 De Morgan
    S.b.ln('≡ ¬P(x₁) ∧ ¬P(x₂) ∧ … ∧ ¬P(xₙ)（De Morgan）', 'say');
    cap('用 De Morgan 律', 'NOT 分給每一項，OR 變 AND');
  },
  async (tok, S) => { // 1244.2 = ∀¬
    S.b.ln('≡ ∀x ¬P(x)', 'good');
    cap('正好是 ∀ 的形式，每項前面多 NOT', '¬∃x P(x) ≡ ∀x ¬P(x)');
  },
  async (tok, S) => { // 1258.5 另一條
    S.b.ln('同理：¬∀x P(x) ≡ ∃x ¬P(x)', 'good');
    cap('同樣方法可得另一條', '¬∀x P(x) ≡ ∃x ¬P(x)');
  },
  async (tok, S) => { // 1273.3 意思
    S.b.ln('「不是所有人都 > 120」→ 找一個沒超過的人就好', 'idx');
    cap('說「並非所有人都超過 120」', '只要找出一個沒超過的人');
  },
  async (tok, S) => { // 1303.1 整理 ∀
    S.t = board(-6.6, -0.2, 0.0);
    T('∀x P(x)：真 → 每個都檢查；假 → 找一個反例', 'note', 0, 0.0);
    cap('整理：∀x P(x)', '真要全部檢查；假只要一個 x 不成立');
  },
  async (tok, S) => { // 1329.0 整理 ∃
    T('∃x P(x)：真 → 找到一個；假 → 每個都不成立', 'note', 0, -0.7);
    cap('∃x P(x) 剛好相反', '真找一個就好；假要說每個都不成立');
  },
]);

scene('pfA-l3-x2', '練習：P(x): x² > 10 在三個 domain', [
  async (tok, S) => { // 1366.5
    T('P(x)：x² > 10', 'note', 0, 6.4);
    cap('練習：P(x)：x² > 10', '還沒講 domain');
  },
  async (tok, S) => { // 1382.0 三個集合
    S.U = [[1, 2, 3], [2, 3, 4], [4, 5, 6]].map((a, r) => {
      T('U' + '₁₂₃'[r] + ' = {' + a.join(', ') + '}', 'ptr', -5.4, 4.8 - r * 1.7);
      return a.map((v, i) => blk(v, FC.sand, -2.6 + i * 1.3, 4.8 - r * 1.7, 1.0));
    });
    cap('給三個 domain', 'U₁ = {1,2,3}、U₂ = {2,3,4}、U₃ = {4,5,6}');
  },
  async (tok, S) => { // 1395.4 邊界
    T('邊界 √10 ≈ 3.16', 'idx', -1.3, 6.0);
    cap('x² > 10 的邊界在 √10', '大約 3.16');
  },
  async (tok, S) => { // 1404.2 代入結果
    const A = [[1, 2, 3], [2, 3, 4], [4, 5, 6]];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) (A[r][i] * A[r][i] > 10 ? pass : fail)(S.U[r][i]);
    cap('U₁ 全錯、U₂ 有對有錯、U₃ 全對', '');
  },
  async (tok, S) => { // 1429.5 寫法
    S.c = ['∀x ∈ U₁, P(x)', '∀x ∈ U₂, P(x)', '∀x ∈ U₃, P(x)'].map((t, r) => L(t, 'say', 1.8, 4.8 - r * 1.7));
    cap('指定 domain 的寫法', '∀x ∈ U₁, P(x)');
  },
  async (tok, S) => { // 1465.1 老師更正
    T('（老師更正：這三格都是 ∀）', 'idx', 4.2, 6.0);
    cap('老師更正投影片：這裡是 ∀', '');
  },
  async (tok, S) => { // 1492.1 U1
    ng(6.0, 4.8);
    cap('U₁：每個都要對，但全部都錯', '∀x ∈ U₁, P(x) 為假');
  },
  async (tok, S) => { // 1503.5 U2
    ng(6.0, 3.1);
    cap('U₂：2、3 錯，4 對', '「所有」都要對 → 為假');
  },
  async (tok, S) => { // 1524.2 U3
    ok(6.0, 1.4);
    cap('U₃：16、25、36 都 > 10', '全對 → 為真');
  },
  async (tok, S) => { // 1532.4 ∃ U2
    L('∃x ∈ U₂, P(x)', 'note', 1.8, -0.1); ok(6.0, -0.1);
    S.U[1][2].scale.set(1.2, 1.2, 1.2);
    cap('∃x ∈ U₂, P(x)', '4 代進去成立，找到一個就為真');
  },
  async (tok, S) => { // 1557.6 ¬∃
    L('¬∃x ∈ U₂, P(x)', 'note', 1.8, -0.8); ng(6.0, -0.8);
    cap('加上否定：¬∃x P(x)', '∃ 那句為真，加 ¬ 就為假');
  },
]);

scene('pfA-l3-negex', '寫出否定：¬∃x (x² > x)、¬∃x (x² = 2)', [
  async (tok, S) => { // 1589.3
    S.b = board(-6.6, 6.2, 0.62);
    S.b.ln('練習：把命題的 negation 找出來', 'ptr alt');
    cap('練習：找出 negation（否定）', '');
  },
  async (tok, S) => { // 1606.0 原命題
    S.b.ln('原命題：∃x (x² > x)', 'note');
    cap('原命題：存在 x，x² > x', '');
  },
  async (tok, S) => { // 1620.3 加 ¬
    S.b.ln('否定：¬∃x (x² > x)', 'say');
    cap('否定就是前面加 NOT', '');
  },
  async (tok, S) => { // 1623.2 拿進去
    S.b.ln('≡ ∀x ¬(x² > x)', 'say');
    cap('NOT 拿進去，∃ 變 ∀', '後面類似 De Morgan 變成「非」');
  },
  async (tok, S) => { // 1646.0 化簡
    S.b.ln('≡ ∀x (x² ≤ x)', 'good');
    cap('x² > x 不成立', '就是 x² ≤ x');
  },
  async (tok, S) => { // 1661.1 第二題
    S.c = board(0.6, 6.2, 0.62); S.c.skip();
    S.c.ln('原命題：∃x (x² = 2)', 'note');
    cap('另一題：存在 x，x² = 2', '');
  },
  async (tok, S) => { // 1680.2 否定
    S.c.ln('¬∃x (x² = 2) ≡ ∀x ¬(x² = 2)', 'say');
    S.c.ln('≡ ∀x (x² ≠ 2)', 'good');
    cap('否定：所有數都拿來檢查', '每個 x 都 x² ≠ 2');
  },
  async (tok, S) => { // 1709.0 自然數
    S.d = board(-6.6, 1.8, 0.62);
    S.d.ln('∃x ∈ ℕ (x² = 2)', 'note');
    ng(-1.6, 1.8);
    cap('domain 改成自然數', '沒有自然數平方等於 2 → 假');
  },
  async (tok, S) => { // 1746.6 實數
    S.d.ln('∃x ∈ ℝ (x² = 2)：x = √2', 'note');
    ok(-0.2, S.d.y(1));
    cap('只改 domain 成實數', '√2 就滿足 → 真');
  },
  async (tok, S) => { // 1762.6 −√2
    S.d.ln('x = −√2 也可以', 'idx');
    cap('−√2 也行', '至少找到一個就對');
  },
  async (tok, S) => { // 1770.5 domain 影響
    T('同一句話，domain 不同，答案就不同', 'ptr alt', 3.4, 0.6);
    cap('domain 影響很大', '');
  },
]);

scene('pfA-l3-unique', '∃!：剛好只有一個', [
  async (tok, S) => { // 1778.0
    T('∃!x P(x)：剛好只有一個 x 滿足', 'note', 0, 6.4);
    cap('進階：∃ 後面加驚嘆號', '∃! = 剛好只有一個');
  },
  async (tok, S) => { // 1799.1 班上剛好一人
    S.k = [0, 1, 2, 3, 4, 5].map((i) => buddy('', i === 3 ? 125 : [110, 115, 108, 0, 112, 117][i], [FC.blue, FC.green, FC.orange, FC.pink, FC.purple, FC.teal][i], -5.5 + i * 2.2, 0, 0, 0.75));
    S.k[3].glow('#0f5a3a'); S.k[3].mood('happy');
    T('身高為示意', 'idx', 5.4, 2.2);
    S.r = ok(0, 5.6, '只有一人 > 120 → 真');
    cap('剛好班上只有一人高於 120', '其他人都沒超過 → 為真');
  },
  async (tok, S) => { // 1830.4 兩個
    S.k[0].set(126); S.k[0].glow('#0f5a3a'); kill(S.r);
    S.r = ng(0, 5.6, '有兩人符合 → 唯一不成立');
    cap('如果有兩個人超過', '「唯一」就錯了 → 為假');
  },
  async (tok, S) => { // 1855.3 x²=2 沒 domain
    S.k.forEach((b) => kill(b.g)); kill(S.r);
    S.b = board(-6.4, 4.8, 0.66);
    S.b.ln('∃!x (x² = 2)：沒講 domain → 無法判斷', 'bad');
    cap('∃!x (x² = 2)', '沒講 domain，沒辦法判斷');
  },
  async (tok, S) => { // 1885.0 ℕ
    S.b.ln('x ∈ ℕ：一個都沒有 → F', 'say');
    cap('domain 是自然數', '一個都沒有 → 假');
  },
  async (tok, S) => { // 1906.0 ℝ
    S.b.ln('x ∈ ℝ：√2 和 −√2 兩個 → F', 'say');
    cap('domain 是實數', '有 √2 和 −√2 兩個 → 還是假');
  },
  async (tok, S) => { // 1928.4 正實數
    S.b.ln('x ∈ ℝ⁺：只有 √2 → T', 'good');
    cap('domain 是正實數', '剛好只有 √2 → 真');
  },
]);

scene('pfA-l3-swap', '寫法：domain 放進式子、同種量詞可交換', [
  async (tok, S) => { // 1955.3
    S.b = board(-6.4, 5.6, 0.7);
    S.b.ln('∀x ∈ U, P(x)', 'note');
    cap('domain 可以寫在量詞旁邊', '∀x ∈ U, P(x)');
  },
  async (tok, S) => { // 1969.6 拿進去
    S.b.ln('≡ ∀x (x ∈ U → P(x))', 'say');
    S.b.ln('（∃x ∈ U, P(x) ≡ ∃x (x ∈ U ∧ P(x))）', 'idx');
    cap('也可以把 x ∈ U 拿進式子裡', '「x ∈ U」本身也是命題');
  },
  async (tok, S) => { // 1987.0 ∀∀ 交換
    S.b.ln('∀x ∀y P(x, y) ≡ ∀y ∀x P(x, y)', 'good');
    cap('兩個都是 ∀', 'x、y 誰前誰後都一樣');
  },
  async (tok, S) => { // 2016.5 ∃∃
    S.b.ln('∃x ∃y P(x, y) ≡ ∃y ∃x P(x, y)', 'good');
    cap('兩個都是 ∃ 也可以交換', '（∀ 和 ∃ 混在一起就不行）');
  },
]);

scene('pfA-l3-prec', '量詞的優先權與作用範圍', [
  async (tok, S) => { // 2030.3 ¬∀ 括號?
    S.b = board(-6.6, 6.2, 0.62);
    S.b.ln('¬∀x P(x)：要不要加括號？', 'note');
    cap('¬∀x P(x) 要不要加括號？', '');
  },
  async (tok, S) => { // 2055.0 兩種
    S.b.ln('∀x P(x) ∨ Q(x)  vs  ∀x (P(x) ∨ Q(x))', 'note');
    cap('∀x P(x) ∨ Q(x)', '括號加在不同地方，一樣嗎？');
  },
  async (tok, S) => { // 2078.2 優先權
    S.b.ln('∀、∃ 的優先權最高：比 ¬、∧、∨ 都高', 'ptr alt');
    cap('先看優先權', '∀、∃ 最高，比所有邏輯運算子都高');
  },
  async (tok, S) => { // 2113.2 ¬∀ 不用括號
    S.b.ln('¬∀x P(x) = ¬(∀x P(x))：括號可省', 'good');
    cap('∀x P(x) 本來就框在一起', '括號可以不加');
  },
  async (tok, S) => { // 2125.7 ∀x P(x) ∨ Q(x)
    S.b.ln('∀x P(x) ∨ Q(x) = (∀x P(x)) ∨ Q(x)', 'say');
    cap('∨ 優先權低，∀ 在這裡就斷開', '∀ 只管到 P(x)');
  },
  async (tok, S) => { // 2166.0 展開
    S.b.ln('= (P(x₁) ∧ … ∧ P(xₙ)) ∨ Q(x)', 'say');
    cap('把 ∀x P(x) 展開', '');
  },
  async (tok, S) => { // 2189.3 分配
    S.b.ln('= (P(x₁) ∨ Q(x)) ∧ … ∧ (P(xₙ) ∨ Q(x))', 'say');
    cap('用分配律把 ∨ Q(x) 分進去', '');
  },
  async (tok, S) => { // 2205.0 看起來像
    S.w = L('≟ ∀x (P(x) ∨ Q(x))  ✗ 不能這樣合', 'bad', -6.6, S.b.y(7));
    cap('看起來好像能寫成 ∀x(P(x)∨Q(x))', '錯了！');
  },
  async (tok, S) => { // 2237.3 x 不同
    T('x₁ … xₙ 都是確定的人；Q(x) 的 x 是外面另一個 x', 'idx', 0, 1.0);
    cap('x₁…xₙ 每個都不同、確定的', '但 Q(x) 的 x 是不知道的另一個');
  },
  async (tok, S) => { // 2261.7 迴圈變數
    S.c = code(['for (i = 1; i <= n; i++)', '    sum += x[i];', 'y = sum + y[i];  // 外面的 i'], 3.6, 5.0);
    S.c.hl(2);
    cap('就像迴圈變數 i', '迴圈裡的 i 拿到外面，是另一回事');
  },
  async (tok, S) => { // 2374.0 範圍
    T('∀ 的「迴圈」只到 P(x)，後面是別人的 x', 'ptr alt', 0, 0.3);
    cap('∀ 的範圍只到 P(x)', '後面的 x 是別人的 x');
  },
]);

scene('pfA-l3-free', 'free variable 與 binding', [
  async (tok, S) => { // 2385.4
    S.b = board(-6.4, 6.0, 0.7);
    S.b.ln('P(x)：x 不知道是誰 → 不能判斷真假', 'note');
    cap('換個角度看', 'x 不知道是誰，就不能判斷真假');
  },
  async (tok, S) => { // 2416.1 free
    S.b.ln('x 可以隨便換 → free variable（自由變數）', 'say');
    cap('這種 x 叫 free variable', '');
  },
  async (tok, S) => { // 2428.0 兩個
    S.b.ln('P(x, y)：x、y 都 free → 無法判斷', 'bad');
    cap('兩個變數都沒指定', '都是 free，沒辦法判斷');
  },
  async (tok, S) => { // 2452.0 binding
    S.b.ln('∀x P(x)：已說好 x 怎麼處理 → binding（綁住）', 'say');
    cap('∀x 告訴你：所有 x 都拿來檢查', '這個動作叫 binding');
  },
  async (tok, S) => { // 2495.7 可判斷
    S.b.ln('沒有自由變數 → 可以判斷真或假', 'good');
    cap('綁住之後沒有自由變數', '就能判斷真假');
  },
  async (tok, S) => { // 2506.6 ∀x P(x,y)
    S.b.ln('∀x P(x, y)：x bound，y 還是 free → 無法判斷', 'bad');
    cap('∀x P(x, y)', 'x 綁住了，y 還是自由的');
  },
  async (tok, S) => { // 2530.1 ∀x∃y
    S.b.ln('∀x ∃y P(x, y)：x、y 都 bound → 可判斷', 'good');
    cap('∀x ∃y P(x, y)', '檢查方式都定了 → 可判斷真假');
  },
]);

scene('pfA-l3-likes', '巢狀量詞：L(x, y)「x 喜歡 y」', [
  async (tok, S) => { // 2560.0
    T('L(x, y)：x 喜歡 y（domain：教室裡的人）', 'note', 0, 6.4);
    cap('L(x, y)：x 喜歡 y', 'x、y 都是教室裡的人');
  },
  async (tok, S) => { // 2583.5 ∀x∀y
    S.b = board(-6.6, 5.6, 0.62);
    S.b.ln('∀x ∀y L(x, y)', 'say');
    cap('第一句：∀x ∀y L(x, y)', '');
  },
  async (tok, S) => { // 2600.3 雙層迴圈
    S.c = code(['for i = 1..9', '  for j = 1..9', '    print i × j   // 81 次'], 4.4, 5.4);
    S.c.hl(2);
    cap('想成雙層迴圈：九九乘法表', '每個 i 配每個 j，要算 81 次');
  },
  async (tok, S) => { // 2627.5 50 人
    S.b.ln('1 喜歡 1？1 喜歡 2？…2 喜歡 1？…全部配對都要對', 'idx');
    cap('班上 50 人：每一對都要檢查', '大家都互相喜歡才為真');
  },
  async (tok, S) => { // 2674.1 可交換
    S.b.ln('= ∀y ∀x L(x, y)（可交換）', 'good');
    cap('兩個 ∀ 可以交換', '');
  },
  async (tok, S) => { // 2683.0 ∃x∃y
    S.b.ln('∃x ∃y L(x, y)：例如 1 號喜歡 2 號就對', 'say');
    cap('∃x ∃y L(x, y)', '找到一對，例如 1 號喜歡 2 號');
  },
  async (tok, S) => { // 2721.1 ∀x∃y
    S.b.ln('∀x ∃y L(x, y)：每個人都有喜歡的人', 'say');
    cap('∀x ∃y L(x, y)', '每個人都找得到一個他喜歡的人');
  },
  async (tok, S) => { // 2786.0 重新整理
    S.b.ln('　（1 號喜歡 A、2 號喜歡 B；喜歡的人可以一樣）', 'idx');
    cap('老師更正後重講', '每人心裡至少喜歡一個人，可以相同');
  },
  async (tok, S) => { // 2818.5 ∃y∀x
    S.b.ln('∃y ∀x L(x, y)：有一個人大家都喜歡（萬人迷）', 'say');
    cap('∃y ∀x L(x, y)', '有一個 y，所有人都喜歡他');
  },
  async (tok, S) => { // 2832.7 ∀y∃x
    S.b.ln('∀y ∃x L(x, y)：每個人都有人喜歡', 'say');
    cap('∀y ∃x L(x, y)', '每個人都被某個人喜歡');
  },
  async (tok, S) => { // 2876.0 ∃x∀y
    S.b.ln('∃x ∀y L(x, y)：有一個人喜歡所有人（花心）', 'say');
    cap('∃x ∀y L(x, y)', '有一個人喜歡每一個人');
  },
  async (tok, S) => { // 2894.2 不要亂換
    T('∀ 和 ∃ 混在一起：順序不能亂換！', 'bad', 3.6, 1.8);
    cap('四種意思都不一樣', '∀、∃ 混用時順序不要亂換');
  },
  async (tok, S) => { // 2934.2 怎麼讀
    T('∀y ∃x L(x, y) = ∀y ( ∃x L(x, y) )：從後往前讀', 'ptr', 3.6, 1.1);
    cap('量詞像負號，是一元運算子', '加括號：∀y ( ∃x L(x, y) )');
  },
]);

scene('pfA-l3-likesdraw', '畫圖看四種 ∀∃ 組合', [
  async (tok, S) => { // 3014.7 兩個集合
    S.X = ['A', 'B', 'C'].map((n, i) => buddy(n, '', [FC.blue, FC.green, FC.orange][i], -4.6, 4.2 - i * 1.9, 0, 0.7));
    S.Y = ['1', '2', '3', '4', '5'].map((n, i) => buddy(n, '', [FC.pink, FC.purple, FC.teal, FC.gold, FC.red][i], 1.4, 5.2 - i * 1.3, 0, 0.55));
    T('X', 'ptr', -4.6, 6.6); T('Y', 'ptr', 1.4, 6.8);
    cap('畫圖：X 集合 A、B、C', 'Y 集合 1～5');
  },
  async (tok, S) => { // 3047.3 箭頭
    S.ar = [];
    S.A = (xi, yi) => { const a = arrow(V3(-4.1, 4.5 - xi * 1.9, 0), V3(0.9, 5.4 - yi * 1.3, 0), 0x6e5f49); S.ar.push(a); return a; };
    S.A(0, 1);
    S.t = T('箭頭 A → 2：A 喜歡 2', 'idx', 4.8, 6.4);
    cap('用箭頭表示「喜歡」', 'A → 2：A 喜歡 2');
  },
  async (tok, S) => { // 3052.4 ∀x∃y
    S.ar.forEach(kill); S.ar = []; S.A(0, 0); S.A(1, 1); S.A(2, 2);
    txt(S.t, '∀x ∃y L(x, y)'); cls(S.t, 'note');
    T('A、B、C 每人都有一條箭頭射出去', 'say', 4.8, 5.6);
    cap('∀x ∃y：X 每個人都要有箭頭出去', '');
  },
  async (tok, S) => { // 3082.4 ∃y∀x
    S.ar.forEach(kill); S.ar = []; S.A(0, 2); S.A(1, 2); S.A(2, 2);
    txt(S.t, '∃y ∀x L(x, y)');
    S.Y[2].glow('#0f5a3a'); S.Y[2].mood('happy');
    T('3 號被 A、B、C 全部喜歡', 'say', 4.8, 4.8);
    cap('∃y ∀x：有一個 y 被大家喜歡', '例如 3 號');
  },
  async (tok, S) => { // 3114.3 ∀y∃x
    S.ar.forEach(kill); S.ar = []; S.Y[2].glow(); S.Y[2].mood('calm');
    [[0, 0], [1, 1], [2, 2], [1, 3], [2, 4]].forEach(([a, b]) => S.A(a, b));
    txt(S.t, '∀y ∃x L(x, y)');
    T('1～5 每人都有箭頭射進來', 'say', 4.8, 4.0);
    cap('∀y ∃x：Y 每個人都被喜歡到', '1 被 A、2 被 B、3 被 C…');
  },
  async (tok, S) => { // 3157.1 ∃x∀y
    S.ar.forEach(kill); S.ar = [];
    for (let k = 0; k < 5; k++) S.A(1, k);
    txt(S.t, '∃x ∀y L(x, y)');
    S.X[1].glow('#0f5a3a');
    T('B 喜歡 1～5 全部', 'say', 4.8, 3.2);
    cap('∃x ∀y：有一個人喜歡所有人', '例如 B');
  },
]);

scene('pfA-l3-eqv', '證明 ¬∀x (P(x) → Q(x)) ≡ ∃x (P(x) ∧ ¬Q(x))', [
  async (tok, S) => { // 3193.2
    S.b = board(-6.0, 6.0, 0.72);
    S.b.ln('證明：¬∀x (P(x) → Q(x)) ≡ ∃x (P(x) ∧ ¬Q(x))', 'ptr alt');
    cap('等式推導：證明兩邊邏輯等價', '用上新學的量詞');
  },
  async (tok, S) => { // 3234.6 優先權
    S.b.ln('¬∀x (P(x) → Q(x))　← ∀x 管整個括號', 'note');
    cap('先把優先權搞清楚', '∀x 管的是整個括號');
  },
  async (tok, S) => { // 3265.0 De Morgan 量詞
    S.b.ln('≡ ∃x ¬(P(x) → Q(x))　量詞的 De Morgan', 'say');
    cap('NOT 放進去：∀ 變 ∃', '裡面多一個 NOT');
  },
  async (tok, S) => { // 3288.7 → 換掉
    S.b.ln('≡ ∃x ¬(¬P(x) ∨ Q(x))　p → q ≡ ¬p ∨ q', 'say');
    cap('最討厭的 → 換掉', 'p → q ≡ ¬p ∨ q');
  },
  async (tok, S) => { // 3306.0 De Morgan
    S.b.ln('≡ ∃x (¬¬P(x) ∧ ¬Q(x))　De Morgan，括號別漏', 'say');
    cap('再用 De Morgan 分進去', '括號不要漏掉');
  },
  async (tok, S) => { // 3340.1 雙重否定
    S.b.ln('≡ ∃x (P(x) ∧ ¬Q(x))　雙重否定', 'good');
    cap('¬¬P(x) = P(x)', '');
  },
  async (tok, S) => { // 3352.6 得證
    T('得證：兩邊邏輯等價 ✓', 'good', 3.6, 1.0);
    cap('證完了', '從裡面或外面先做都可以，答案一樣');
  },
]);

scene('pfA-l3-trans', '翻譯：班上每個學生都修過微積分', [
  async (tok, S) => { // 3361.3
    T('「班上每個學生都修過微積分」', 'note', 0, 6.4);
    cap('把句子寫成邏輯式', '學生、微積分都可以換掉');
  },
  async (tok, S) => { // 3393.7 C(x)
    S.b = board(-6.0, 5.4, 0.72);
    S.b.ln('C(x)：x 修過微積分', 'say');
    cap('先設述詞 C(x)', 'x 修過微積分');
  },
  async (tok, S) => { // 3413.5 domain
    S.b.ln('寫法一：domain U = 班上學生　→　∀x C(x)', 'good');
    cap('一定要考慮 domain', 'U 已經是班上學生 → ∀x C(x)');
  },
  async (tok, S) => { // 3434.2 S(x)
    S.b.ln('寫法二：S(x)：x 是班上的學生（x 可以是任何人）', 'say');
    cap('更囉嗦一點：再設 S(x)', 'x 是班上的學生');
  },
  async (tok, S) => { // 3455.1 錯誤 ∧
    S.b.ln('∀x (S(x) ∧ C(x))　✗', 'bad');
    cap('寫成 AND？老師說：寫錯了', '這會說「每個人都是班上學生」');
  },
  async (tok, S) => { // 3472.2 改成 →
    S.b.ln('∀x (S(x) → C(x))　✓', 'good');
    cap('要改成 →', 'x 範圍很大，可能是外校學生');
  },
  async (tok, S) => { // 3524.0 意思
    S.b.ln('「如果是班上的學生，就修過微積分」', 'idx');
    cap('意思：是班上學生 → 修過微積分', '');
  },
  async (tok, S) => { // 3537.4 意涵
    T('寫法可以不同，意涵要相同', 'ptr alt', 0, 0.2);
    cap('最重要的是意思要一樣', '下一節要拿這些來做證明');
  },
]);

scene('pfA-l3-lions', '翻譯：獅子、勇敢、喝咖啡', [
  async (tok, S) => { // 3568.0
    S.s = board(-6.6, 6.3, 0.62);
    S.s.ln('練習：三個句子寫成邏輯式', 'ptr alt');
    cap('簡單練習：翻成邏輯式', '');
  },
  async (tok, S) => { // 3587.0 三句
    S.s.ln('① 所有獅子都很勇敢', 'say');
    S.s.ln('② 有些獅子不喝咖啡', 'say');
    S.s.ln('③ 有些勇敢的動物不喝咖啡', 'say');
    cap('三個句子', '照字面翻，不管它有沒有道理');
  },
  async (tok, S) => { // 3620.0 述詞
    S.p = board(1.6, 6.3, 0.62); S.p.skip();
    S.p.ln('P(x)：x 是獅子', 'note');
    S.p.ln('Q(x)：x 是勇敢的', 'note');
    S.p.ln('R(x)：x 喝咖啡', 'note');
    cap('用同一組述詞', 'P 獅子、Q 勇敢、R 喝咖啡');
  },
  async (tok, S) => { // 3641.5 ①
    S.a = board(-6.6, 2.4, 0.72);
    S.a.ln('① ∀x (P(x) → Q(x))', 'good');
    cap('① 所有獅子都勇敢', '如果 x 是獅子，x 就勇敢');
  },
  async (tok, S) => { // 3657.1 ②
    S.a.ln('② ∃x (P(x) ∧ ¬R(x))', 'good');
    cap('② 「有一些」就是存在', '有 x 是獅子，而且不喝咖啡');
  },
  async (tok, S) => { // 3674.2 ③
    S.a.ln('③ ∃x (Q(x) ∧ ¬R(x))（Rosen 答案）', 'good');
    cap('③ 有 x 勇敢，而且不喝咖啡', '存在量詞配 ∧，不是 →');
  },
]);

scene('pfA-l3-nested-neg', '否定 ∀x ∃y ∀z T(x, y, z)：¬ 一層一層往裡搬', [
  async (tok, S) => { // 3773.0
    T('練習：求 ∀x ∃y ∀z T(x, y, z) 的 negation', 'ptr alt', 0, 6.4);
    cap('最後一題練習', '把敘述的 negation 推導出來');
  },
  async (tok, S) => { // 3828.0 原命題
    S.b = board(-5.6, 5.4, 0.8);
    S.b.ln('¬ ∀x ∃y ∀z T(x, y, z)', 'note');
    cap('原命題前面加 ¬', '');
  },
  async (tok, S) => { // 3840.1 目標
    T('目標：把 ¬ 移到最裡面', 'idx', 3.6, 5.4);
    cap('希望 ¬ 不要留在最外面', '要把它移到最裡面');
  },
  async (tok, S) => { // 3857.4 一層一層
    S.lv = ['第一層', '第二層', '第三層'].map((t, i) => T(t, 'idx', -4.6 + i * 1.15, 6.0));
    cap('一步一步來', '量詞一層一層，從外面分配進去');
  },
  async (tok, S) => { // 3877.5 第一層
    S.b.ln('≡ ∃x ¬ ∃y ∀z T(x, y, z)', 'say'); cls(S.lv[0], 'ptr');
    cap('¬ 和 ∀x 做 De Morgan', '∀x 變 ∃x，¬ 往裡搬');
  },
  async (tok, S) => { // 3916.0 第二層
    S.b.ln('≡ ∃x ∀y ¬ ∀z T(x, y, z)', 'say'); cls(S.lv[1], 'ptr');
    cap('¬ 和 ∃y 做 De Morgan', '∃y 變 ∀y');
  },
  async (tok, S) => { // 3940.7 第三層
    S.b.ln('≡ ∃x ∀y ∃z ¬T(x, y, z)', 'good'); cls(S.lv[2], 'ptr');
    cap('最後處理最裡面', '∀z 變 ∃z，¬ 到了 T 前面');
  },
  async (tok, S) => { // 3959.3 結束
    T('意思不用管，形式上一步步推就對', 'ptr alt', 2.6, 1.4);
    cap('這就是形式上的邏輯推導', '其他練習題回家自己試');
  },
]);

// ════════ qilMh8Uoabk（Lec04 Logic and Proofs：推論規則與證明方法） ════════
scene('pfA-l4-intro', '今天：怎樣的推論才合理？', [
  async (tok, S) => { // 6.6
    T('今天：1-5、1-6、1-7 全部走完', 'idx', 0, 6.5);
    cap('今天把第一章結束', '1-5、1-6、1-7 全部走過');
  },
  async (tok, S) => { // 11.4
    T('重點：教你如何「證明」', 'ptr alt', 0, 5.8);
    cap('今天的重點很明確', '教你如何去證明');
  },
  async (tok, S) => { // 34.7
    T('什麼推論是合理的？常用證明法、常錯的證明法', 'say', 0, 5.1);
    cap('先看：什麼推論是合理的', '再介紹常用和常錯的證明方法');
  },
  async (tok, S) => { // 58.5 前提1
    S.b = board(-5.0, 3.8, 0.75);
    S.b.ln('前提①：如果小英今天參選，小馬明年就不是總統', 'say');
    cap('一個時事例子', '如果小英今天參選，小馬明年不是總統');
  },
  async (tok, S) => { // 89.0 前提2
    S.b.ln('前提②：小英今天真的去參選了', 'say');
    cap('另外我們知道', '小英今天真的宣布參選');
  },
  async (tok, S) => { // 106.0 結論
    S.b.ln('結論：明年總統不會是小馬', 'note');
    cap('結論：明年總統不會是小馬', '直覺上這個推論是對的');
  },
  async (tok, S) => { // 146.0 攻擊
    T('如果你要反駁，要攻擊哪裡？', 'ptr alt', 0, 0.6);
    cap('中立地看：你要怎麼攻擊這個論述？', '');
  },
]);

scene('pfA-l4-premise', '推論 = 前提 + 結論，前提要先為真', [
  async (tok, S) => { // 170.1
    S.b = board(-6.4, 6.0, 0.7);
    S.b.ln('推論的基本形式：一堆前提 → 一個結論', 'ptr alt');
    cap('推論的基本形式', '前面一堆前提，最後得到結論');
  },
  async (tok, S) => { // 210.3
    S.b.ln('很重要：前提必須為真', 'note');
    cap('前提一定要為真', '');
  },
  async (tok, S) => { // 235.0 攻擊1
    S.b.ln('攻擊①：「參選 → 不是總統」這句 if-then 本身就錯', 'bad');
    cap('第一種攻擊：這個 if-then 本身就有問題', '前提錯一個，結論就不予考慮');
  },
  async (tok, S) => { // 264.3 攻擊2
    S.b.ln('攻擊②：她其實沒宣布成（被車撞到…）', 'bad');
    cap('第二種：前提②其實不成立', '例如臨時沒辦法開記者會');
  },
  async (tok, S) => { // 287.4 有效推論
    S.b.ln('有效推論：先假設前提都對，再看結論對不對', 'good');
    cap('講有效推論時', '先假設前提都對，才看結論');
  },
  async (tok, S) => { // 313.3 因果
    S.b.ln('第二個問題：為什麼前提對，結論就一定對？', 'say');
    cap('第二個要問：為什麼結論一定跟著成立？', '用邏輯形式把因果寫清楚');
  },
  async (tok, S) => { // 340.3 GRE
    S.b.ln('GRE 邏輯題：找出推論哪個環節錯（前提錯？謬誤？）', 'idx');
    cap('GRE 有一大類題目就在考這個', '找出推論哪一環不合邏輯');
  },
]);

scene('pfA-l4-form', '有效推論 ⇔ (p₁ ∧ … ∧ pₙ) → q 是 tautology', [
  async (tok, S) => { // 405.4
    S.p = board(-5.6, 5.4, 0.6);
    ['p₁', 'p₂', '⋮', 'pₙ'].forEach((t) => S.p.ln(t, t === '⋮' ? 'idx' : 'note'));
    T('前提（premises）', 'idx', -4.0, 6.2);
    cap('形式上：前面很多前提', '一個、兩個、三個都可能');
  },
  async (tok, S) => { // 441.7 長除法寫法
    S.ln = L('────────', 'idx', -5.8, 2.9); L('∴ q　結論', 'good', -5.6, 2.3);
    cap('像直式運算一樣寫', '畫一條線，下面是結論 q');
  },
  async (tok, S) => { // 460.4 前提都成立
    S.b = board(-1.0, 5.4, 0.8);
    S.b.ln('前提都成立 = p₁ ∧ p₂ ∧ … ∧ pₙ', 'say');
    cap('「前提都成立」', '其實隱含「而且」→ 用 AND');
  },
  async (tok, S) => { // 481.2 imply
    S.b.ln('(p₁ ∧ p₂ ∧ … ∧ pₙ) → q', 'note');
    cap('寫成 imply 的形式', '前提都對 → 結論一定對');
  },
  async (tok, S) => { // 514.6 永遠為真
    S.b.ln('不管怎樣都要成立 → 永遠為真', 'say');
    cap('我們要保證：前提對，結論就對', '所以這句永遠為真');
  },
  async (tok, S) => { // 547.7 tautology
    S.b.ln('有效推論 ⇔ 這個式子是 tautology', 'good');
    cap('證明一個論述有效', '= 證明它是 tautology（恆真式）');
  },
]);

scene('pfA-l4-syllo', '三段論：p → q，q → r ∴ p → r', [
  async (tok, S) => { // 557.6
    T('三段論法（hypothetical syllogism）', 'ptr alt', 0, 6.4);
    cap('最有名的：三段論法', '');
  },
  async (tok, S) => { // 566.7
    S.p = board(-6.4, 5.4, 0.62);
    S.p.ln('p → q', 'note'); S.p.ln('q → r', 'note'); S.p.ln('──────', 'idx'); S.p.ln('∴ p → r', 'good');
    cap('p 則 q、q 則 r', '那麼 p 則 r');
  },
  async (tok, S) => { // 589.0 例子
    S.s = [prop('note', -1.0, 2.0, 0, 1.2), prop('note', 2.2, 2.0, 0, 1.2), prop('note', 5.4, 2.0, 0, 1.2)];
    S.k = [T('☀ 早上出太陽', 'say', -1.0, 2.7), T('🚲 騎車到學校', 'say', 2.2, 2.7), T('🚲 騎車回家', 'say', 5.4, 2.7)];
    S.a1 = arrow(V3(0.1, 2.7, 0), V3(1.1, 2.7, 0)); S.a2 = arrow(V3(3.3, 2.7, 0), V3(4.3, 2.7, 0));
    cap('出太陽 → 騎腳踏車到學校', '騎腳踏車到學校 → 騎腳踏車回家');
  },
  async (tok, S) => { // 609.0 結論
    S.a3 = arrow(V3(-1.0, 3.4, 0), V3(5.4, 3.4, 0), 0x0f5a3a);
    T('出太陽 → 騎車回家', 'good', 2.2, 4.0);
    cap('結論：今天出太陽', '那我今天一定騎腳踏車回家');
  },
  async (tok, S) => { // 617.0 為什麼
    T('直覺對，但為什麼？要說服我', 'ptr', 2.2, 1.0);
    cap('直覺上一則二、二則三', '問題是：為什麼這是合法的推論？');
  },
  async (tok, S) => { // 642.3 premise/conclusion
    T('premise', 'idx', -3.6, 5.1); T('premise', 'idx', -3.6, 4.5); T('conclusion', 'idx', -3.2, 3.3);
    cap('p→q 和 q→r 是前提 premise', 'p→r 是結論 conclusion');
  },
  async (tok, S) => { // 693.0 tautology
    T('要證：((p → q) ∧ (q → r)) → (p → r) 是 tautology', 'note', 0, 0.2);
    cap('前提都對 → 結論一定對', '要證這個式子是 tautology');
  },
  async (tok, S) => { // 718.0 方法
    T('方法：① 真值表（8 列全 T）② 邏輯等式化簡', 'say', 0, -0.5);
    cap('只有 p、q、r 三個', '可以畫真值表，也可以用邏輯等式');
  },
]);

scene('pfA-l4-syllo-alg', '用邏輯等式證三段論是 tautology', [
  async (tok, S) => { // 743.6 換掉 →
    S.b = board(-6.8, 6.3, 0.62);
    S.b.ln('((p → q) ∧ (q → r)) → (p → r)', 'note');
    S.b.ln('前提裡的 →：(¬p ∨ q) ∧ (¬q ∨ r)', 'say');
    cap('最討厭 →，先全部換掉', 'p → q 換成 ¬p ∨ q');
  },
  async (tok, S) => { // 800.5 分配
    S.b.ln('= (¬p∧¬q) ∨ (¬p∧r) ∨ (q∧¬q) ∨ (q∧r)', 'say');
    cap('先把前面化簡', '用分配律展開成四項');
  },
  async (tok, S) => { // 878.1 q∧¬q
    S.b.ln('q ∧ ¬q = F，消掉 → (¬p∧¬q) ∨ (¬p∧r) ∨ (q∧r)', 'say');
    cap('q 和 ¬q 做 AND 是 F', 'F 跟別人做 OR 就消失');
  },
  async (tok, S) => { // 898.0 整個 →
    S.b.ln('整句：¬[(¬p∧¬q) ∨ (¬p∧r) ∨ (q∧r)] ∨ (¬p ∨ r)', 'say');
    cap('整個大 → 也換掉', '前面加 NOT，OR 上結論 ¬p ∨ r');
  },
  async (tok, S) => { // 978.0 De Morgan
    S.b.ln('= [(p∨q) ∧ (p∨¬r) ∧ (¬q∨¬r)] ∨ ¬p ∨ r', 'say');
    cap('NOT 放進去（De Morgan）', 'AND 變 OR、每個字母取反');
  },
  async (tok, S) => { // 1059.7 分配
    S.b.ln('= (p∨q∨¬p∨r) ∧ (p∨¬r∨¬p∨r) ∧ (¬q∨¬r∨¬p∨r)', 'say');
    cap('用 OR 的分配律', '把 ¬p ∨ r 分給每個括號');
  },
  async (tok, S) => { // 1085.0 第一項
    T('p ∨ ¬p', 'good', -4.6, 2.3); T('= T', 'good', -4.6, 1.7);
    cap('第一個括號有 p 和 ¬p', 'OR 在一起永遠為真');
  },
  async (tok, S) => { // 1097.0 第二項
    T('p ∨ ¬p', 'good', -0.6, 2.3); T('= T', 'good', -0.6, 1.7);
    cap('第二個括號也有 ¬p 和 p', '永遠為真');
  },
  async (tok, S) => { // 1110.2 第三項
    T('r ∨ ¬r', 'good', 3.8, 2.3); T('= T', 'good', 3.8, 1.7);
    T('T ∧ T ∧ T = T → tautology ✓', 'ptr alt', 0, 0.9);
    cap('第三個有 r 和 ¬r', '全部是 T → 是 tautology');
  },
]);

scene('pfA-l4-rules-intro', '證過一次，以後就能直接套用', [
  async (tok, S) => { // 1148.5
    S.b = board(-6.0, 5.6, 0.75);
    S.b.ln('真值表也可以證（自己列列看）', 'idx');
    cap('真值表你們應該會列', '代進去算出永遠為真就行');
  },
  async (tok, S) => { // 1159.6 合法推論
    S.b.ln('證完 → 三段論就是合法的推論，可以直接套用', 'good');
    cap('以後看到這個形式', '就是合法推論，可以直接套');
  },
  async (tok, S) => { // 1201.0 很多規則
    S.b.ln('會有很多推論規則：像基本公式一樣', 'say');
    cap('我們會有很多這種推論原則', '說你套哪一條，就不會再被質疑');
  },
  async (tok, S) => { // 1225.0 名詞
    S.b.ln('premise 前提、conclusion 結論', 'note');
    cap('名詞：premise、conclusion', '');
  },
  async (tok, S) => { // 1251.7 證明推論 = tautology
    S.b.ln('證明推論合法 = 證明 (前提) → 結論 是 tautology', 'good');
    S.b.ln('等一下：請把幾個推論規則背起來', 'ptr alt');
    cap('證推論合法 = 證這個複合陳述是 tautology', '幾個推論規則一定要背起來');
  },
]);

scene('pfA-l4-mp', '證明 modus ponens：(p ∧ (p → q)) → q', [
  async (tok, S) => { // 1288.2
    T('就像 sin²θ + cos²θ = 1：剛學時要會證', 'idx', 0, 6.5);
    cap('就像背三角公式', '剛學的時候必須會證明');
  },
  async (tok, S) => { // 1309.6 寫法
    S.p = board(-6.6, 5.4, 0.62);
    S.p.ln('p', 'note'); S.p.ln('p → q', 'note'); S.p.ln('──────', 'idx'); S.p.ln('∴ q', 'good');
    cap('前提寫在上面', 'p、p → q，結論 q');
  },
  async (tok, S) => { // 1337.1 意思
    T('p → q 對，而且 p 對 → q 也對', 'say', -4.8, 2.3);
    cap('if-then 是對的，前件也對', '就能下結論：後件也對');
  },
  async (tok, S) => { // 1355.0 tautology
    S.b = board(-1.6, 5.4, 0.68);
    S.b.ln('要證：(p ∧ (p → q)) → q 是 tautology', 'note');
    cap('兩個前提做 AND', '證明 (p ∧ (p→q)) → q 是 tautology');
  },
  async (tok, S) => { // 1387.2 換 →
    S.b.ln('p ∧ (p → q) = p ∧ (¬p ∨ q)', 'say');
    cap('最討厭的 → 劃掉', 'p → q 換成 ¬p ∨ q');
  },
  async (tok, S) => { // 1412.0 分配
    S.b.ln('= (p ∧ ¬p) ∨ (p ∧ q)', 'say');
    cap('用分配律乘開', '');
  },
  async (tok, S) => { // 1438.0 F
    S.b.ln('= F ∨ (p ∧ q) = p ∧ q', 'say');
    cap('p 和 ¬p 做 AND 是 F', 'F 跟別人做 OR 就消失');
  },
  async (tok, S) => { // 1449.5 整句
    S.b.ln('整句：(p ∧ q) → q = ¬(p ∧ q) ∨ q = ¬p ∨ ¬q ∨ q', 'say');
    cap('再把整句的 → 換掉', 'NOT 優先權最高，括號可省');
  },
  async (tok, S) => { // 1491.6 T
    S.b.ln('¬q ∨ q = T → ¬p ∨ T = T ✓', 'good');
    cap('¬q ∨ q 永遠為真', '再跟別人 OR，還是 T（支配律）');
  },
  async (tok, S) => { // 1527.0 名字
    T('Modus ponens（拉丁文）＝ 肯定前件', 'ptr alt', 0, 0.2);
    cap('這條叫 modus ponens', '中文：肯定前件');
  },
]);

scene('pfA-l4-rules', '常用推論規則一覽', [
  async (tok, S) => { // 1530.5 MP
    S.b = board(-6.8, 6.2, 0.78);
    S.b.ln('p，p → q　∴ q　　　modus ponens（肯定前件）', 'good');
    cap('剛證的 modus ponens', 'p 對、p → q 對 → q 對');
  },
  async (tok, S) => { // 1576.8 MT
    S.b.ln('¬q，p → q　∴ ¬p　　modus tollens（否定後件）', 'good');
    cap('p → q ≡ ¬q → ¬p', '套上面那條：有 ¬q 就有 ¬p');
  },
  async (tok, S) => { // 1605.3 HS
    S.b.ln('p → q，q → r　∴ p → r　　三段論', 'good');
    cap('三段論', '中間那一步可以直接跳過');
  },
  async (tok, S) => { // 1614.3 DS
    S.b.ln('p ∨ q，¬p　∴ q　　　disjunctive syllogism', 'good');
    cap('p 或 q 至少一個對', '現在 p 錯了，那當然 q 對');
  },
  async (tok, S) => { // 1654.6 addition
    S.b.ln('p　∴ p ∨ q　　　　addition', 'good');
    cap('已知 p 對', '「p 或 q」當然對，不用管 q');
  },
  async (tok, S) => { // 1677.0 simplification
    S.b.ln('p ∧ q　∴ p　　　　simplification', 'good');
    cap('p 和 q 都對', '拿出其中一部分當然沒問題');
  },
  async (tok, S) => { // 1696.0 conjunction
    S.b.ln('p，q　∴ p ∧ q　　　conjunction', 'good');
    cap('p 對、q 對', '那 p ∧ q 也對');
  },
]);

scene('pfA-l4-resol', '證明 ((p ∨ q) ∧ (¬p ∨ r)) → (q ∨ r)', [
  async (tok, S) => { // 1710.4
    S.b = board(-6.8, 6.3, 0.6);
    S.b.ln('證：((p ∨ q) ∧ (¬p ∨ r)) → (q ∨ r) 是 tautology', 'note');
    cap('最後這條比較沒直覺', '我們來證它');
  },
  async (tok, S) => { // 1741.4 → 換掉
    S.b.ln('= ¬[(p ∨ q) ∧ (¬p ∨ r)] ∨ q ∨ r', 'say');
    cap('不管三七二十一，先換掉 →', '前面加 NOT，記得加大括號');
  },
  async (tok, S) => { // 1784.2 分配
    S.b.ln('裡面：(p∧¬p) ∨ (p∧r) ∨ (q∧¬p) ∨ (q∧r)，p∧¬p = F', 'say');
    cap('跟前面一樣，分配律展開四項', '第一項 p ∧ ¬p 是 F，不寫');
  },
  async (tok, S) => { // 1822.0 NOT 進去
    S.b.ln('¬[…] = (¬p∨¬r) ∧ (p∨¬q) ∧ (¬q∨¬r)', 'say');
    cap('NOT 放進去，一次拿兩層', 'AND 變 OR、OR 變 AND');
  },
  async (tok, S) => { // 1852.0 分配 q∨r
    S.b.ln('= (¬p∨¬r∨q∨r) ∧ (p∨¬q∨q∨r) ∧ (¬q∨¬r∨q∨r)', 'say');
    cap('再把 q ∨ r 分配進去', '');
  },
  async (tok, S) => { // 1894.0 全 T
    S.b.ln('r∨¬r = T，q∨¬q = T，q∨¬q = T → 全部 T ✓', 'good');
    cap('每個括號都有一對互補', '全部永遠為真 → 證明完成');
  },
  async (tok, S) => { // 1900.0 很像
    T('這個式子跟三段論長得很像？', 'ptr alt', 2.8, 2.2);
    cap('跟第一個例子長得很像', '其實不用每次都這麼笨');
  },
  async (tok, S) => { // 1934.4 改寫
    S.c = board(-6.8, 1.6, 0.62);
    S.c.ln('試著把 ∨ 改寫成 →', 'idx');
    cap('之前都是把 → 換成 OR', '這次反過來，OR 換成 →');
  },
  async (tok, S) => { // 1976.7 p∨q
    S.c.ln('p ∨ q ≡ ¬q → p', 'say');
    cap('最後要留 q 和 r，想辦法消掉 p', 'p ∨ q ≡ ¬q → p');
  },
  async (tok, S) => { // 1998.4 ¬p∨r
    S.c.ln('¬p ∨ r ≡ p → r', 'say');
    cap('另一個：¬p ∨ r', '≡ p → r');
  },
  async (tok, S) => { // 2017.6 三段論
    L('¬q → p，p → r　∴ ¬q → r（三段論）', 'good', -0.6, S.c.y(1));
    cap('兩個都有了，套三段論', '得到 ¬q → r');
  },
  async (tok, S) => { // 2030.0 換回
    L('¬q → r ≡ q ∨ r ✓', 'good', -0.6, S.c.y(2));
    cap('換回 OR 的形式', '¬q → r 就是 q ∨ r');
  },
  async (tok, S) => { // 2052.0 積木
    T('用已知規則像疊積木一樣組合', 'ptr alt', 0, -0.9);
    cap('回到定義也能證', '學聰明：用已知的規則疊積木');
  },
]);

scene('pfA-l4-bbq', '範例：下雨就不烤肉', [
  async (tok, S) => { // 2090.2
    T('判斷這個推論是否正確', 'ptr alt', 0, 6.4);
    cap('範例：判斷推論對不對', '能不能套剛才的規則？');
  },
  async (tok, S) => { // 2105.1 英文
    S.b = board(-6.6, 5.6, 0.62);
    S.b.ln('If it rains today → no barbecue today.', 'say');
    S.b.ln('If no barbecue today → barbecue tomorrow.', 'say');
    S.b.ln('∴ If it rains today → barbecue tomorrow.', 'idx');
    cap('下雨 → 今天不烤肉', '今天不烤肉 → 明天烤肉');
  },
  async (tok, S) => { // 2135.0 變數
    S.v = board(-6.6, 3.2, 0.6);
    S.v.ln('p：今天下雨', 'note'); S.v.ln('q：今天不烤肉', 'note'); S.v.ln('r：明天烤肉', 'note');
    cap('最好先換成符號', 'p 下雨、q 今天不烤肉、r 明天烤肉');
  },
  async (tok, S) => { // 2156.3
    S.p = board(0.6, 3.2, 0.6);
    S.p.ln('p → q', 'say'); S.p.ln('q → r', 'say');
    cap('第一句 p → q', '第二句 q → r');
  },
  async (tok, S) => { // 2167.7
    S.p.ln('∴ p → r', 'good');
    cap('結論 p → r', '下雨 → 明天烤肉');
  },
  async (tok, S) => { // 2185.3
    T('就是三段論 → 推論有效 ✓', 'good', 3.6, 0.8);
    cap('寫成邏輯式就是三段論', '這個推論成立');
  },
]);

scene('pfA-l4-email', '範例：email、寫程式、早睡、精神好', [
  async (tok, S) => { // 2196.7
    T('第一步：分出前提和結論', 'ptr alt', 0, 6.5);
    cap('先把句子看懂', '找出哪些是前提、哪個是結論');
  },
  async (tok, S) => { // 2250.1
    T('第二步：挑出基本命題，用變數表示', 'ptr', 0, 5.9);
    cap('用變數表示', '免得 NOT 漏寫、意思搞錯');
  },
  async (tok, S) => { // 2274.7 變數
    S.v = board(-6.8, 5.2, 0.6);
    S.v.ln('p：你寄 email 給我', 'note'); S.v.ln('q：我把程式寫完', 'note');
    S.v.ln('r：我早早去睡', 'note'); S.v.ln('s：明天醒來精神很好', 'note');
    cap('p 寄 email、q 寫完程式', 'r 早睡、s 醒來精神好');
  },
  async (tok, S) => { // 2401.4 (1)
    S.b = board(-1.4, 5.2, 0.6);
    S.b.ln('(1) p → q', 'say');
    cap('(1) 你寄 email → 我寫完程式', 'p → q');
  },
  async (tok, S) => { // 2429.5 (2)
    S.b.ln('(2) ¬p → r', 'say');
    cap('(2) 你沒寄 email → 我早睡', '¬p → r');
  },
  async (tok, S) => { // 2446.6 (3)
    S.b.ln('(3) r → s', 'say');
    cap('(3) 早睡 → 醒來精神好', 'r → s');
  },
  async (tok, S) => { // 2458.0 結論
    S.b.ln('結論：¬q → s', 'note');
    cap('結論：沒寫完程式 → 醒來精神好', '¬q → s');
  },
  async (tok, S) => { // 2558.0 工具
    S.d = board(-6.8, 2.2, 0.62);
    S.d.ln('可用：推論規則 + 邏輯等價；前後對照著看', 'idx');
    cap('可以用的工具', '推論規則、邏輯等價；前後偷看一下');
  },
  async (tok, S) => { // 2576.2 (4)
    S.d.ln('(4) ¬q → ¬p　　由 (1)，逆否等價', 'good');
    cap('結論要 ¬q，哪裡有 q？(1)', '由 (1) 得 ¬q → ¬p');
  },
  async (tok, S) => { // 2622.6 (5)
    S.d.ln('(5) ¬q → r　　由 (4)(2)，三段論', 'good');
    cap('(4) 加上 (2)', '三段論 → ¬q → r');
  },
  async (tok, S) => { // 2644.4 (6)
    S.d.ln('(6) ¬q → s　　由 (5)(3)，三段論 ∎', 'good');
    cap('再用一次：(5) 加 (3)', '得到 ¬q → s，就是結論');
  },
  async (tok, S) => { // 2674.0 理由
    T('每一步都寫清楚用了什麼', 'ptr alt', 3.4, 0.5);
    cap('要很清楚地寫出', '每一步用了哪條規則');
  },
]);

scene('pfA-l4-resol2', 'Resolution：為什麼 q ∨ r 一定成立', [
  async (tok, S) => { // 2704.0
    T('Resolution（AI 推論常用）', 'ptr alt', 0, 6.4);
    cap('最後這條叫 resolution', '寫程式做 AI 推論時常用');
  },
  async (tok, S) => { // 2740.0
    S.p = board(-6.0, 5.4, 0.62);
    S.p.ln('p ∨ q', 'note'); S.p.ln('¬p ∨ r', 'note'); S.p.ln('──────', 'idx'); S.p.ln('∴ q ∨ r', 'good');
    cap('p ∨ q、¬p ∨ r 都對', '則 q、r 至少一個對');
  },
  async (tok, S) => { // 2763.0 p 一真一假
    S.sw = T('p 和 ¬p：一定一真一假', 'say', 2.0, 5.2);
    cap('兩個前提都要對', '裡面的 p 和 ¬p 一定一真一假');
  },
  async (tok, S) => { // 2780.3 p 假
    T('若 p 假 → p ∨ q 要對 → q 真', 'good', 2.0, 4.2);
    cap('如果 p 是錯的', 'p ∨ q 要成立，q 一定對');
  },
  async (tok, S) => { // 2786.1 ¬p 假
    T('若 ¬p 假 → ¬p ∨ r 要對 → r 真', 'good', 2.0, 3.4);
    T('→ q ∨ r 至少一個對 ✓', 'ptr alt', 2.0, 2.4);
    cap('如果 ¬p 是錯的，r 一定對', '所以 q 或 r 至少一個對');
  },
]);

scene('pfA-l4-fallacy', '兩個最常犯的錯', [
  async (tok, S) => { // 2809.7
    T('兩個最常犯的推論錯誤', 'ptr alt', 0, 6.4);
    cap('看兩個最常犯的錯', '');
  },
  async (tok, S) => { // 2836.2 肯定後件
    S.a = board(-6.6, 5.5, 0.62);
    S.a.ln('小英參選 → 我口袋有 100 元', 'say');
    S.a.ln('我口袋真的有 100 元', 'say');
    S.a.ln('∴ 小英一定參選？ ✗', 'bad');
    cap('口袋真的有 100 元', '不能反過來肯定小英參選');
  },
  async (tok, S) => { // 2853.6 形式
    S.a.ln('((p → q) ∧ q) → p 不是 tautology', 'bad');
    cap('不能用結論對來說前提對', '剛好顛倒了，千萬不要犯');
  },
  async (tok, S) => { // 2863.6 否定前件
    S.b = board(0.6, 5.5, 0.62);
    S.b.ln('小英參選 → 我口袋有 100 元', 'say');
    S.b.ln('小英沒參選（被綁架…）', 'say');
    S.b.ln('∴ 我口袋沒有 100 元？ ✗', 'bad');
    cap('第二個很類似：小英沒參選', '口袋不一定沒錢');
  },
  async (tok, S) => { // 2891.4 形式
    S.b.ln('((p → q) ∧ ¬p) → ¬q 不是 tautology', 'bad');
    cap('前件被否定', '後件不一定錯');
  },
]);

scene('pfA-l4-quant-rules', '量詞的推論：全班都穿外套', [
  async (tok, S) => { // 2902.0
    T('量詞的推論規則', 'ptr alt', 0, 6.5);
    S.k = ['', '', '小明', '', ''].map((n, i) => buddy(n, '', [FC.blue, FC.green, FC.orange, FC.purple, FC.teal][i], -5.2 + i * 1.6, 0, 0, 0.7));
    cap('有量詞的命題怎麼用？', '');
  },
  async (tok, S) => { // 2920.7 全班
    S.k.forEach((b) => b.glow('#0f5a3a'));
    S.b = board(-6.6, 5.6, 0.7);
    S.b.ln('∀x P(x)：全班同學都有穿外套', 'note');
    cap('全班同學都有穿外套', '');
  },
  async (tok, S) => { // 2945.2 UI
    S.k[2].mood('happy'); await S.k[2].hop(tok);
    S.b.ln('小明是班上一份子 ∴ P(小明)　（universal instantiation）', 'good');
    cap('小明是班上一份子', '所以小明有穿外套：普遍原則裡的一個例子');
  },
  async (tok, S) => { // 2974.0 UG
    S.b.ln('任取一人 c，證出 P(c) ∴ ∀x P(x)（universal generalization）', 'good');
    cap('要證全班都穿：任取一個 c', '沒說是誰，證出 c 有穿 → 全部都有');
  },
  async (tok, S) => { // 3019.6 EI
    S.b.ln('∃x P(x) ∴ 設 c 是有穿的那人（existential instantiation）', 'good');
    cap('班上至少一人有穿外套', '可以假設 c 就是那個人，再往下推');
  },
  async (tok, S) => { // 3070.0 EG
    S.b.ln('P(小明) ∴ ∃x P(x)　（existential generalization）', 'good');
    cap('知道小明有穿外套', '就能說：班上存在人有穿外套');
  },
]);

scene('pfA-l4-terms', '名詞：theorem、proof、axiom、lemma、corollary、conjecture', [
  async (tok, S) => { // 3104.0
    T('1-6、1-7：用推論來證明數學定理', 'ptr alt', 0, 6.5);
    S.b = board(-6.6, 5.6, 0.65);
    cap('接下來把推論拿來用', '先看幾個名詞');
  },
  async (tok, S) => { // 3126.0 proposition
    S.b.ln('proposition：比較不重要的定理（如 1 + 1 = 2 之類）', 'say');
    cap('proposition', '類似定理，但比較不重要');
  },
  async (tok, S) => { // 3158.6 theorem
    S.b.ln('theorem 定理：根據假設與已知，能說服你為真的陳述', 'note');
    cap('theorem 定理', '能證明它是真的的陳述');
  },
  async (tok, S) => { // 3185.5 proof
    S.b.ln('proof：說服你的那段推論過程', 'note');
    cap('說服你的過程', '叫 proof（證明）');
  },
  async (tok, S) => { // 3195.2 axiom
    S.b.ln('axiom 公理：大家認為對、無法證明的基本假設（平行線不相交）', 'say');
    cap('axiom 公理', '例如平行線永遠不相交');
  },
  async (tok, S) => { // 3250.0 lemma
    S.b.ln('lemma 引理：證大定理時先證的小工具', 'say');
    cap('lemma', '把共同的小步驟先拿出來證');
  },
  async (tok, S) => { // 3268.3 corollary
    S.b.ln('corollary 系理：由定理馬上得到（x+x=2x ⇒ 1+1=2）', 'say');
    cap('corollary', '從定理馬上推出來的結果');
  },
  async (tok, S) => { // 3295.3 conjecture
    S.b.ln('conjecture 猜想：大家相信、還沒被證明（費馬最後定理曾是）', 'say');
    cap('conjecture 猜想', '大家相信是對的，但還沒人證出來');
  },
  async (tok, S) => { // 3365.1 最重要
    S.b.set(1, 'ptr alt'); S.b.set(2, 'ptr alt');
    cap('最重要的兩個', 'theorem 要證的東西、proof 證明過程');
  },
]);

scene('pfA-l4-methods', '證明 p → q 的幾種方法', [
  async (tok, S) => { // 3378.5
    T('要證的定理多半長這樣：p → q', 'ptr alt', 0, 6.5);
    cap('定理大多是「如果…則…」', '寫成 p → q');
  },
  async (tok, S) => { // 3422.2 真值表
    S.t = ['p', 'q', 'p→q'].map((h, i) => T(h, 'ptr', -5.6 + i * 1.2, 5.6));
    [['T', 'T', 'T'], ['T', 'F', 'F'], ['F', 'T', 'T'], ['F', 'F', 'T']].forEach((r, j) => r.forEach((v, i) => T(v, j === 1 ? 'bad' : 'say', -5.6 + i * 1.2, 4.9 - j * 0.6)));
    T('唯一會錯：p 真、q 假', 'bad', -4.4, 2.4);
    cap('p → q 唯一會錯的情況', '前面對、後面錯');
  },
  async (tok, S) => { // 3473.0 直接證法
    S.b = board(-1.6, 5.6, 0.7);
    S.b.ln('直接證法：假設 p 真 → 一步步推出 q 真', 'good');
    cap('排除那種情況', '假設 p 對，推出 q 也一定對：直接證法');
  },
  async (tok, S) => { // 3492.6 contrapositive
    S.b.ln('逆否證法：p → q ≡ ¬q → ¬p，假設 ¬q 推出 ¬p', 'good');
    cap('雙胞胎：contrapositive', '改證 ¬q → ¬p（prove by contrapositive）');
  },
  async (tok, S) => { // 3546.0 矛盾
    S.b.ln('矛盾證法：另外講', 'idx');
    cap('矛盾證法另外講', '');
  },
  async (tok, S) => { // 3550.0 vacuous/trivial
    S.b.ln('vacuous proof、trivial proof：有說跟沒說一樣，但也是證明', 'say');
    cap('還有 vacuous、trivial proof', '有說跟沒說一樣，但也算證明');
  },
  async (tok, S) => { // 3596.3 vacuous
    S.b.ln('p 永遠假 → 不可能 p 真 q 假（vacuous）', 'say');
    cap('排除法一：p 永遠不成立', '那就不用管 q');
  },
  async (tok, S) => { // 3637.5 trivial
    S.b.ln('q 永遠真 → 也不可能 q 假（trivial）', 'say');
    cap('排除法二：q 永遠不會錯', '這也是證明');
  },
]);

scene('pfA-l4-direct', '直接證法：n 是奇數 → n² 是奇數', [
  async (tok, S) => { // 3647.0 偶數
    S.d = board(-6.8, 6.3, 0.6);
    S.d.ln('定義：n 是偶數 ⇔ 存在整數 k，n = 2k', 'note');
    cap('先看定義：偶數', '找得到整數 k 使 n = 2k');
  },
  async (tok, S) => { // 3683.6 奇數
    S.d.ln('定義：n 是奇數 ⇔ 存在整數 k，n = 2k + 1', 'note');
    cap('奇數', '找得到整數 k 使 n = 2k + 1');
  },
  async (tok, S) => { // 3697.0 二選一
    S.d.ln('事實：每個整數非奇即偶，不會同時是', 'note');
    cap('事實：整數要嘛奇、要嘛偶', '二選一，不會同時成立');
  },
  async (tok, S) => { // 3722.0 隱含前提
    S.d.ln('定義、已知事實 = 可直接用的隱含前提', 'idx');
    cap('定義和已知事實', '都可以當隱含前提拿來用');
  },
  async (tok, S) => { // 3736.2 定理
    S.b = board(-6.8, 3.6, 0.6);
    S.b.ln('定理：若 n 是奇數，則 n² 是奇數', 'ptr alt');
    cap('要證：n 奇 → n² 奇', '');
  },
  async (tok, S) => { // 3748.6 直接證
    S.b.ln('直接證法：從「n 是奇數」開始推', 'idx');
    cap('用直接證法', '從 n 是奇數開始推論');
  },
  async (tok, S) => { // 3760.2 邏輯式
    L('∀n (P(n) → Q(n))　P：奇數，Q：平方是奇數', 'say', 0.6, 3.6);
    cap('先寫成邏輯式', '∀n (P(n) → Q(n))');
  },
  async (tok, S) => { // 3816.0 任意 n
    S.b.ln('給一個 n，沒指定是多少（不是 3、不是 5）', 'say');
    cap('給你一個 n，不知道是多少', '任何整數都要成立');
  },
  async (tok, S) => { // 3846.6 n=2k+1
    S.b.ln('n 是奇數 → 存在整數 k，n = 2k + 1', 'say');
    cap('根據定義', '有一個 k 讓 n = 2k + 1');
  },
  async (tok, S) => { // 3880.3 平方
    S.b.ln('n² = (2k + 1)² = 4k² + 4k + 1 = 2(2k² + 2k) + 1', 'say');
    cap('代進去算 n²', '乘開整理成 2(2k² + 2k) + 1');
  },
  async (tok, S) => { // 3898.0 整數
    S.b.ln('2k² + 2k 是整數 → n² = 2·(整數) + 1', 'say');
    cap('只要講一件事', '2k² + 2k 是整數');
  },
  async (tok, S) => { // 3910.3 結論
    S.b.ln('符合奇數的定義 → n² 是奇數 ∎', 'good');
    cap('符合奇數定義 → n² 是奇數', '從前提平鋪直敘推到結論');
  },
  async (tok, S) => { // 3930.1 perfect number
    T('回家試：perfect number（所有真因數加起來 = 自己）', 'idx', 0, -1.0);
    cap('回家練習：perfect number', '真因數加起來等於自己的數');
  },
]);

scene('pfA-l4-contra1', '逆否證法：3n + 2 是奇數 → n 是奇數', [
  async (tok, S) => { // 3961.3
    T('P → Q 不好直接證？換成 ¬Q → ¬P', 'ptr alt', 0, 6.5);
    cap('從前面推過去不好算時', '換成等價的 ¬q → ¬p 再直接證');
  },
  async (tok, S) => { // 4002.5 定理
    S.b = board(-6.6, 5.6, 0.7);
    S.b.ln('定理：n 是整數，若 3n + 2 是奇數，則 n 是奇數', 'note');
    cap('例子：3n + 2 是奇數', '證明 n 是奇數');
  },
  async (tok, S) => { // 4012.6 直接證不好
    S.b.ln('直接證：3n + 2 = 2k + 1 → n = (2k − 1)/3，是整數嗎？難！', 'bad');
    cap('直接證？3n + 2 = 2k + 1', '換一換有個「三分之幾」，很難講');
  },
  async (tok, S) => { // 4044.0 逆否
    S.b.ln('改證逆否：若 n 不是奇數，則 3n + 2 不是奇數', 'good');
    cap('山不轉路轉', '改證等價的逆否命題');
  },
  async (tok, S) => { // 4073.4 n=2k
    S.b.ln('n 不是奇數 → n 是偶數 → n = 2k', 'say');
    cap('n 不是奇數就是偶數', '可以設 n = 2k');
  },
  async (tok, S) => { // 4092.5
    S.b.ln('3n + 2 = 6k + 2 = 2(3k + 1) → 偶數，不是奇數 ∎', 'good');
    cap('代進去：3n + 2 = 2(3k + 1)', '是偶數 → 不是奇數，證完');
  },
]);

scene('pfA-l4-rational', '直接證法：兩個有理數相加還是有理數', [
  async (tok, S) => { // 4115.0
    S.b = board(-6.6, 6.2, 0.66);
    S.b.ln('定義：r 是有理數 ⇔ r = p/q，p、q 是整數，q ≠ 0', 'note');
    cap('有理數 rational 的定義', '兩個整數相除，分母不為 0');
  },
  async (tok, S) => { // 4147.0 互質
    S.b.ln('必要時還可以假設 p、q 互質（約分約好）', 'idx');
    cap('還可以假設 p、q 互質', '公因數都消掉了');
  },
  async (tok, S) => { // 4166.0 定理
    S.b.ln('證：∀x ∀y (R(x) ∧ R(y) → R(x + y))', 'ptr alt');
    cap('證明：有理數 + 有理數 = 有理數', 'R(x)：x 是有理數');
  },
  async (tok, S) => { // 4193.7 往前證
    S.b.ln('用直接證法：從 x、y 是有理數開始', 'idx');
    cap('往前證還是往後證？', '這裡用直接證法');
  },
  async (tok, S) => { // 4231.0 x=p/q
    S.b.ln('x = p/q（p、q 整數，q ≠ 0）', 'say');
    cap('x 是有理數', 'x = p/q，q ≠ 0');
  },
  async (tok, S) => { // 4240.3 y=r/s
    S.b.ln('y = r/s（r、s 整數，s ≠ 0）← 不能也寫 p/q', 'say');
    cap('y 要用不同字母 r/s', '寫成 p/q 就等於說 x = y');
  },
  async (tok, S) => { // 4267.0 通分
    S.b.ln('x + y = p/q + r/s = (ps + rq) / (qs)', 'say');
    cap('合在一起通分', '(ps + rq) / qs');
  },
  async (tok, S) => { // 4282.6 結論
    S.b.ln('qs ≠ 0；ps + rq、qs 都是整數 → x + y 是有理數 ∎', 'good');
    cap('分母 qs 不為 0，分子分母都是整數', '所以 x + y 是有理數');
  },
]);

scene('pfA-l4-contra2', '逆否證法：n² 是奇數 → n 是奇數', [
  async (tok, S) => { // 4313.0
    S.b = board(-6.6, 6.2, 0.7);
    S.b.ln('定理：n 是整數，若 n² 是奇數，則 n 是奇數', 'note');
    cap('再一個例子', 'n² 是奇數 → n 是奇數');
  },
  async (tok, S) => { // 4342.0 邏輯式
    S.b.ln('∀n (R(n²) → R(n))　R：是奇數', 'say');
    cap('寫成邏輯式', '∀n (R(n²) → R(n))');
  },
  async (tok, S) => { // 4365.0 直接難
    S.b.ln('直接證：n² = 2k + 1 → n = √(2k + 1)？開根號很難處理', 'bad');
    cap('前提比較複雜，不好用', 'n² = 2k + 1 還要開根號');
  },
  async (tok, S) => { // 4389.1 逆否
    S.b.ln('改證：若 n 不是奇數，則 n² 不是奇數', 'good');
    cap('從簡單往複雜走', '改證等價的逆否命題');
  },
  async (tok, S) => { // 4428.5 n=2k
    S.b.ln('n 不是奇數 → n 是偶數 → n = 2k', 'say');
    cap('不是奇數就是偶數', 'n = 2k');
  },
  async (tok, S) => { // 4440.2 平方
    S.b.ln('n² = (2k)² = 4k² = 2(2k²) → 偶數，不是奇數 ∎', 'good');
    cap('n² = 2(2k²)', '是偶數，所以不是奇數');
  },
  async (tok, S) => { // 4465.2
    T('直接證或逆否證，挑一個寫；形式要對', 'ptr alt', 0, 0.8);
    cap('兩種方法自己挑', '寫一個就夠，但形式要合');
  },
]);

scene('pfA-l4-vacuous', 'vacuous proof 與 trivial proof', [
  async (tok, S) => { // 4480.0
    T('vacuous proof 與 trivial proof', 'ptr alt', 0, 6.5);
    cap('接著介紹', 'vacuous 和 trivial proof');
  },
  async (tok, S) => { // 4500.0 排除
    S.b = board(-6.6, 5.8, 0.62);
    S.b.ln('p → q 只有「p 真、q 假」會錯 → 排除它', 'say');
    cap('一樣用排除法', '排除 p 真、q 假的情況');
  },
  async (tok, S) => { // 4523.6 vacuous
    S.b.ln('p 永遠假 → vacuous proof（空話）', 'good');
    cap('p 永遠不會對', '這是在講空話：vacuous proof');
  },
  async (tok, S) => { // 4544.7 trivial
    S.b.ln('q 永遠真 → trivial proof（結論本來就對）', 'good');
    cap('後面本來就永遠為真', '根本不用證：trivial proof');
  },
  async (tok, S) => { // 4571.2 例1
    S.c = board(-6.6, 3.8, 0.62);
    S.c.ln('例：P(n)：若 n > 1，則 n² > n。證明 P(0)', 'note');
    cap('例：P(n)：若 n > 1，則 n² > n', '只要證 P(0)');
  },
  async (tok, S) => { // 4623.3 代 0
    S.c.ln('P(0)：若 0 > 1，則 0² > 0', 'say');
    cap('n = 0 代進去', '若 0 > 1，則 0² > 0');
  },
  async (tok, S) => { // 4646.0 被騙
    S.c.ln('0² > 0 即 0 > 0：本身是錯的 → 別被騙去證它', 'bad');
    cap('如果一直想證 0² > 0', '那是錯的，你就被騙了');
  },
  async (tok, S) => { // 4662.5 vacuous
    S.c.ln('前提 0 > 1 永遠假 → P(0) 為真（vacuous）∎', 'good');
    cap('前提 0 > 1 永遠不會對', '不用管結論 → P(0) 為真');
  },
  async (tok, S) => { // 4694.0 例2
    S.d = board(-6.6, 1.1, 0.62);
    S.d.ln('例：a、b 正整數，a ≥ b → aⁿ ≥ bⁿ，證 P(0)', 'note');
    cap('另一例：a ≥ b → aⁿ ≥ bⁿ', '也只要證 P(0)');
  },
  async (tok, S) => { // 4739.0
    S.d.ln('P(0)：結論是 a⁰ ≥ b⁰', 'say');
    cap('代 n = 0', '要證 a⁰ ≥ b⁰');
  },
  async (tok, S) => { // 4757.4
    S.d.ln('a⁰ = 1，b⁰ = 1 → 1 ≥ 1 永遠對', 'say');
    cap('任何正整數的 0 次方 = 1', '1 ≥ 1 是對的（有等號）');
  },
  async (tok, S) => { // 4776.5
    S.d.ln('結論永遠真，不用管前提 → trivial proof ∎', 'good');
    cap('結論本來就對', '這就叫 trivial proof');
  },
  async (tok, S) => { // 4784.5
    T('邏輯上有趣，實際證明很少這樣用', 'idx', 2.6, -1.5);
    cap('這兩個邏輯上有趣', '實際證明不太會叫你做這麼笨的事');
  },
]);

scene('pfA-l4-contra-method', '矛盾證法：假設結論錯，推出矛盾', [
  async (tok, S) => { // 4796.0
    T('矛盾證法：逆否證法的延伸', 'ptr alt', 0, 6.5);
    cap('最後一種：矛盾證法', '有點像逆否證法的延伸');
  },
  async (tok, S) => { // 4813.0 假設 ¬q
    S.b = board(-6.4, 5.7, 0.7);
    S.b.ln('要證 q：先假設 ¬q 為真', 'note');
    cap('逆否是假設 ¬q，最後推出 ¬p', '這次不一定要走到 ¬p');
  },
  async (tok, S) => { // 4845.3 矛盾
    S.b.ln('推論途中跟已知事實衝突 → 得到矛盾（永遠為假 F）', 'bad');
    cap('推論中會跟已知事實衝突', '矛盾 = 永遠為假');
  },
  async (tok, S) => { // 4881.3 ¬q → F
    S.b.ln('寫下來：¬q → F　（推論沒犯錯，所以這句為真）', 'say');
    cap('從 ¬q 出發推到 F', '推論過程沒錯，這句是真的');
  },
  async (tok, S) => { // 4916.4
    S.b.ln('後面是 F，前面 ¬q 就不能為真 → ¬q 假 → q 真 ∎', 'good');
    cap('後面為假，前面就不能為真', '¬q 被迫是假的 → q 成立');
  },
  async (tok, S) => { // 4952.3
    S.b.ln('作法：先假設結論錯 → 推到矛盾就可以停', 'ptr alt');
    cap('一般作法：先假設結論錯', '找到永遠為假的事，就可以停了');
  },
  async (tok, S) => { // 5001.3
    S.b.ln('逆否其實也是特例：推出 ¬p，又有前提 p → p ∧ ¬p = F', 'idx');
    cap('逆否證法也算矛盾證法的特例', '¬p 加上前提 p，就是矛盾');
  },
]);

scene('pfA-l4-sqrt2', '矛盾證法：√2 是無理數', [
  async (tok, S) => { // 5050.0
    S.b = board(-6.6, 6.3, 0.62);
    S.b.ln('證明：√2 是無理數', 'ptr alt');
    cap('最典型的矛盾證法', '證明 √2 是無理數');
  },
  async (tok, S) => { // 5060.7 假設
    S.b.ln('假設 √2 是有理數（結論錯）', 'bad');
    cap('假設 √2 是有理數', '從這裡出發，找矛盾');
  },
  async (tok, S) => { // 5070.0 p/q
    S.b.ln('√2 = p/q，q ≠ 0，p、q 互質', 'say');
    cap('有理數 → √2 = p/q', 'q ≠ 0，而且可以假設 p、q 互質');
  },
  async (tok, S) => { // 5098.0 平方
    S.b.ln('√2·q = p → 兩邊平方：p² = 2q²', 'say');
    cap('q 乘過來再平方', 'p² = 2q²');
  },
  async (tok, S) => { // 5110.0 p 偶
    S.b.ln('p² 是偶數 → p 是偶數（剛才證過的逆否）', 'say');
    cap('p² 是偶數', '用之前學過的：p 也是偶數');
  },
  async (tok, S) => { // 5133.0 p=2k
    S.b.ln('p = 2k → (2k)² = 4k² = 2q²', 'say');
    cap('p 是偶數，設 p = 2k', '代回去：4k² = 2q²');
  },
  async (tok, S) => { // 5147.3 q 偶
    S.b.ln('q² = 2k² → q² 偶數 → q 是偶數', 'say');
    cap('把 2 消掉：q² = 2k²', '同樣方法：q 也是偶數');
  },
  async (tok, S) => { // 5167.5 矛盾
    S.b.ln('p、q 都有因數 2 → 和「互質」矛盾！', 'bad');
    cap('p、q 有公因數 2', '跟互質的假設衝突 → 矛盾');
  },
  async (tok, S) => { // 5185.0 結論
    S.b.ln('假設錯了 → √2 是無理數 ∎', 'good');
    cap('最早的假設出錯', '所以 √2 是無理數');
  },
]);

scene('pfA-l4-bad1', '錯誤證明：1 = 2 錯在哪？', [
  async (tok, S) => { // 5211.5
    T('常見的證明錯誤', 'ptr alt', 0, 6.5);
    cap('看看常見的證明錯誤', '');
  },
  async (tok, S) => { // 5224.0
    S.b = board(-6.0, 5.8, 0.6);
    T('「證明」2 = 1', 'note', 3.6, 5.8);
    cap('這個「證明」說 1 = 2', '一看就知道有錯，錯在哪？');
  },
  async (tok, S) => { // 5250.0
    S.b.ln('1. a = b', 'say'); S.c = [ok(-1.2, S.b.y(0), '✓')];
    cap('令 a、b 是兩個相等的數', '自己假設的，沒問題');
  },
  async (tok, S) => { // 5270.4
    S.b.ln('2. a² = ab　（兩邊乘 a）', 'say'); ok(0.8, S.b.y(1), '✓');
    cap('兩邊乘 a', 'a = 0 也成立，沒問題');
  },
  async (tok, S) => { // 5299.0
    S.b.ln('3. a² − b² = ab − b²　（兩邊減 b²）', 'say'); ok(1.6, S.b.y(2), '✓');
    cap('兩邊同減 b²', '沒問題');
  },
  async (tok, S) => { // 5311.1
    S.b.ln('4. (a − b)(a + b) = b(a − b)　（因式分解）', 'say'); ok(1.9, S.b.y(3), '✓');
    cap('因式分解', '沒問題');
  },
  async (tok, S) => { // 5320.0
    S.b.ln('5. a + b = b　（兩邊除以 a − b）', 'bad'); ng(0.6, S.b.y(4), '✗ a − b = 0！');
    cap('把 a − b 消掉：錯了！', 'a = b，a − b = 0，不能除');
  },
  async (tok, S) => { // 5335.0
    S.b.ln('6. 2b = b　7. 2 = 1', 'idx');
    T('一處錯 → 整個證明作廢', 'bad', 3.6, 2.2);
    cap('只要一個地方錯', '不管結論怎樣，整個證明垮掉');
  },
  async (tok, S) => { // 5359.4 規則
    T('正確規則：ab = ac 而且 a ≠ 0 → b = c', 'good', 0, 0.8);
    T('(p₁ ∧ p₂) → q，卻只檢查 p₁', 'idx', 0, 0.2);
    cap('規則要兩個前提：ab = ac 且 a ≠ 0', '它沒檢查 a ≠ 0 就直接用');
  },
]);

scene('pfA-l4-bad2', '錯誤證明：n 不是正數 → n² 不是正數？', [
  async (tok, S) => { // 5400.7
    S.b = board(-6.4, 6.0, 0.7);
    S.b.ln('「若 n 不是正數，則 n² 不是正數」', 'note');
    T('結論是錯的：n = −1 時 n² = 1 是正數', 'bad', 2.2, 5.3);
    cap('要證：n 不是正數 → n² 不是正數', '這本身就錯，平方除了 0 都是正數');
  },
  async (tok, S) => { // 5434.0
    S.b.ln('它的「證明」：若 n 是正數，則 n² 是正數（這句對）', 'say');
    cap('它先說：n 正 → n² 正', '這是對的事實');
  },
  async (tok, S) => { // 5449.2
    S.b.ln('現在 n 不是正數 ∴ n² 不是正數？', 'bad');
    cap('然後說：n 不是正數', '所以 n² 也不是正數？');
  },
  async (tok, S) => { // 5463.1 形式
    S.b.ln('p → q，¬p　∴ ¬q', 'bad');
    cap('寫成形式：p → q、¬p，∴ ¬q', '');
  },
  async (tok, S) => { // 5487.0
    S.b.ln('p → q 和 ¬p → ¬q 不等價 → 否定前件的謬誤', 'good');
    cap('要這樣推，得有 ¬p → ¬q', '但它和 p → q 不等價，套錯公式');
  },
]);

scene('pfA-l4-cases', '列舉法（proof by cases）：x² + 3y² = 8 沒有整數解', [
  async (tok, S) => { // 5495.6
    S.b = board(-6.8, 6.3, 0.6);
    S.b.ln('列舉法：(p₁ ∨ p₂ ∨ … ∨ pₙ) → q', 'note');
    cap('最後一個證明：列舉法', '(p₁ ∨ … ∨ pₙ) → q');
  },
  async (tok, S) => { // 5527.0 等價
    S.b.ln('≡ (p₁ → q) ∧ (p₂ → q) ∧ … ∧ (pₙ → q)', 'good');
    cap('有一個等價陳述', '其中任一個對，都保證 q 對');
  },
  async (tok, S) => { // 5550.4
    S.b.ln('拆開：p₁ 對 → 證 q；p₂ 對 → 證 q；…', 'say');
    cap('一起證太複雜', '拆成簡單情況一個一個證');
  },
  async (tok, S) => { // 5584.0 不能漏
    S.b.ln('中間是 AND：每個 case 都要證，一個都不能漏', 'bad');
    cap('記得是 AND', '例如整數分奇偶，兩個都要證');
  },
  async (tok, S) => { // 5642.6 常見形式
    S.b.ln('常見：n 是整數 → 分成 n 奇數、n 偶數兩個 case', 'idx');
    cap('常見形式', '把一件事拆成幾個 case 來談');
  },
  async (tok, S) => { // 5669.0 例
    S.c = board(-6.8, 3.0, 0.62);
    S.c.ln('例：證 x² + 3y² = 8 沒有整數解', 'ptr alt');
    cap('例子：x² + 3y² = 8', '證明沒有整數解');
  },
  async (tok, S) => { // 5687.5 y=0
    S.c.ln('y = 0：x² = 8 → x = ±2√2，不是整數', 'say');
    cap('y = 0 代進去', 'x² = 8，x 不是整數');
  },
  async (tok, S) => { // 5750.4 y=1
    S.c.ln('y = 1：x² = 5 → 不是整數', 'say');
    cap('y = 1', 'x² = 5，也沒有整數解');
  },
  async (tok, S) => { // 5754.7 y≥2
    S.c.ln('y ≥ 2：3y² ≥ 12 → x² ≤ −4，根本無解', 'say');
    cap('y ≥ 2', 'x² ≤ −4，連解都沒有');
  },
  async (tok, S) => { // 5770.5 漏了
    T('只有這三個 case 嗎？漏了！', 'bad', 3.2, 2.4);
    cap('故意留的錯', 'y 是整數，不只這三種情況');
  },
  async (tok, S) => { // 5803.4 負數
    S.c.ln('還要：y = −1、y ≤ −2（y² 一樣 → 同樣結論）', 'good');
    cap('還要考慮 y = −1、y ≤ −2', '平方一樣，結論相同');
  },
  async (tok, S) => { // 5833.5 WLOG
    T('Without loss of generality（不失一般性）', 'ptr alt', 2.6, -0.9);
    cap('補上之後不必重寫', '說「不失一般性」就好');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'domino', 'sum-stairs', 'odd-sum', 'induction-ineq', 'horses', 'strong-stamps', 'strong-factor', 'well-ordering', 'euclid-gcd'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
