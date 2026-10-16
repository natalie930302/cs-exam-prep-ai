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
      tag(neg + '（負，不在 S）', 'idx', X(n - 1) + 1.6, 1.4);
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
    return { q: 'n = ' + n + '，把 n² 寫成 2m 或 2m + 1 的形式', opts: [ans, n * n + ' = 2·' + Math.floor(n * n / 2) + (odd ? '' : ' + 1'), n * n + ' = 2·' + (Math.floor(n * n / 2) + 1) + ' + 1', n * n + ' = 4·' + k2 * k2 + (odd ? '' : ' + 1')], ans, why: odd ? '(2k+1)² = 2(2k²+2k) + 1，k = ' + k2 + '。' : '(2k)² = 2(2k²)，k = ' + k2 + '。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts)].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    const quad = [[1, 1, '#2fc092', 'x≥0, y≥0：|xy| = xy = |x||y|'], [-1, 1, '#4b9ee2', 'x<0, y≥0：|xy| = −xy = (−x)y = |x||y|'], [-1, -1, '#9b7ef4', 'x<0, y<0：|xy| = xy = (−x)(−y) = |x||y|'], [1, -1, '#dd8238', 'x≥0, y<0：|xy| = −xy = x(−y) = |x||y|']];
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
    S.z = zone('班上同學（集合）', 0, -0.05, 0, 11.5, 2.2); S.z.userData.name.position.set(-5.55, -0.55, 1.2);
    const H = [135, 128, 142, 131, 126];
    S.k = ['A', 'B', 'C', 'D', 'E'].map((n, i) => buddy(n, H[i], [FC.blue, FC.green, FC.orange, FC.purple, FC.teal][i], -4.4 + i * 2.2, 0, 0, 0.8));
    T('身高為示意', 'idx', 4.8, -0.6, 1.2);
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
    S.b = board(-6.6, 5.7, 0.66);
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
    S.c.kill(); T('∀ 和 ∃ 混在一起：順序不能亂換！', 'bad', 3.9, 5.0); // the loop picture is done: the warning takes its place
    cap('四種意思都不一樣', '∀、∃ 混用時順序不要亂換');
  },
  async (tok, S) => { // 2934.2 怎麼讀
    T('∀y ( ∃x L(x, y) )：從後往前讀', 'ptr', 3.9, 4.3);
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
    T('p ∨ ¬p', 'good', -4.6, 1.75); T('= T', 'good', -4.6, 1.15);
    cap('第一個括號有 p 和 ¬p', 'OR 在一起永遠為真');
  },
  async (tok, S) => { // 1097.0 第二項
    T('p ∨ ¬p', 'good', -0.6, 1.75); T('= T', 'good', -0.6, 1.15);
    cap('第二個括號也有 ¬p 和 p', '永遠為真');
  },
  async (tok, S) => { // 1110.2 第三項
    T('r ∨ ¬r', 'good', 3.8, 1.75); T('= T', 'good', 3.8, 1.15);
    T('T ∧ T ∧ T = T → tautology ✓', 'ptr alt', 0, 0.35);
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
    S.b.ln('p² 是偶數 → p 是偶數（「n 奇 → n² 奇」的逆否）', 'say');
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
    T('結論是錯的：n = −1 時 n² = 1 是正數', 'bad', 0, 2.3);
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

  // ═══ pfB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 2 章（交大 易志偉 Lec08–Lec11：Algorithms and the Integers）— cued scenes ───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的數字照用（101 = 11·9 + 2、−11 = 3·(−4) + 1、gcd(528,30) = 6、139 = (2023)₄、x ≡ 52 (mod 105)、
// p = 43, q = 59, e = 13, d = 937, 1819 → 2081…）；老師沒給的數字標「示意」。
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
const bx = (t, c, x, y, z = 0, w = 0.6, h = 0.6, d = 0.6) => cube(t, c, [w, h, d], x, y, z);
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && o.add) return gone(o.ls); if (o.ls) return o.kill(); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
// a board: text lines top → down; hi(i) lights line i (−1 = none)
function board(x, yTop, dy = 0.62) {
  const ls = [];
  return {
    ls,
    add(t, cls = '') { const l = tag(t, cls, x, yTop - ls.length * dy); l.userData.base = cls; ls.push(l); return l; },
    skip() { ls.push(null); },
    hi(i) { ls.forEach((l, k) => { if (l) l.element.className = 'lab-label' + (k === i ? ' ptr alt' : (l.userData.base ? ' ' + l.userData.base : '')); }); },
    last() { this.hi(ls.length - 1); },
    clear() { ls.forEach((l) => l && remove(l)); ls.length = 0; },
  };
}
// a row of value cubes (digits, bits, residues)
function row(x0, y, vals, o = {}) {
  const w = o.w || 0.6, gap = o.gap == null ? 0.1 : o.gap, c = o.c || FC.blue;
  const cells = vals.map((v, i) => bx(v, typeof c === 'function' ? c(i, v) : c, x0 + i * (w + gap), y, o.z || 0, w, o.h || w, o.d || w));
  return { cells, x: (i) => x0 + i * (w + gap) };
}
// n small cubes in groups of g (counting pictures)
function groups(x0, y, n, g, color, left = 0, leftColor = FC.red, s = 0.3) {
  const out = []; let x = x0;
  for (let i = 0; i < n; i++) { out.push(bx('', color, x, y, 0, s, s, s)); x += s + 0.05; if ((i + 1) % g === 0) x += 0.22; }
  for (let i = 0; i < left; i++) { out.push(bx('', leftColor, x, y, 0, s, s, s)); x += s + 0.05; }
  return out;
}
// a number line: x(v) maps values; ticks labelled every `every`
function nline(x0, x1, y, v0, v1, every = 1) {
  const X = (v) => x0 + (v - v0) * (x1 - x0) / (v1 - v0);
  const ls = [line(x0 - 0.2, y, x1 + 0.2, y, 0, '#8a7a60')];
  for (let v = v0; v <= v1; v += every) ls.push(sm(String(v), X(v), y - 0.35));
  return { X, ls };
}
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }


// ════════ wiVH6goGrWQ（交大OCW 易志偉《離散數學》Lec08 Algorithms and the Integers (1/4)） ════════
scene('pfB-l8-divdef', "整除 a | b：定義與例子", CAM, [
  // 32.6
  async (tok, S) => {
          hot('3-4：整數與除法', 0, 7.2); cap('整數與除法的正式定義', '因數、倍數、整除');
        },
  // 64.8
  async (tok, S) => {
          S.z = []; for (let v = -3; v <= 3; v++) S.z.push(bx(String(v), v < 0 ? FC.orange : v === 0 ? FC.gray : FC.blue, -2.4 + (v + 3) * 0.8, 5.6, 0, 0.6, 0.6, 0.6));
          sm('ℤ = {…, −2, −1, 0, 1, 2, …}（示意）', 0, 4.9); cap('ℤ：整數的集合', '0、正整數、負整數都在裡面');
        },
  // 86.5
  async (tok, S) => {
          glow(S.z[3], NG); S.a = bx('a', FC.purple, -5.2, 3.6, 0, 0.8, 0.8, 0.8); S.b = bx('b', FC.teal, -4.0, 3.6, 0, 0.8, 0.8, 0.8);
          bad('a ≠ 0（除以 0 沒有定義）', -4.6, 2.6); cap('取兩個整數 a、b', 'a 當除數，不能是 0');
        },
  // 107
  async (tok, S) => {
          glow(S.z[3], null); S.L = board(-3.4, 1.6); S.L.add('a | b ：a 整除 b（沒有餘數）', 'ptr alt'); cap('a | b：a 整除 b', '一直線代表「整除」');
        },
  // 123.2
  async (tok, S) => {
          S.L.add('⇔ 存在整數 c，使 b = a · c'); S.L.last(); cap('存在整數 c 使 b = a·c', '證明時都用這個等式');
        },
  // 133.4
  async (tok, S) => {
          S.L.add('a 是 b 的因數；b 是 a 的倍數'); S.L.last(); cap('a 是因數，b 是倍數', '');
        },
  // 151.7
  async (tok, S) => {
          S.L.hi(-1); S.g1 = groups(1.0, 4.0, 12, 3, FC.green); good('3 | −12 ✔：−12 = 3·(−4)', 3.4, 3.2); cap('3 | −12 成立', '−12 = 3 × (−4)');
        },
  // 165.2
  async (tok, S) => {
          S.g2 = groups(1.0, 2.0, 6, 3, FC.blue, 1); bad('3 ∤ 7 ✘：7 = 3·2 + 1，餘 1', 3.4, 1.2); cap('3 不整除 7', '7 除以 3 會餘 1');
        },
  // 176.9
  async (tok, S) => {
          gone(S.g1, S.g2); hot('b 是偶數 ⇔ 2 | b', 3.4, 0.2); cap('偶數的定義：2 | b', '');
        },
  // 186
  async (tok, S) => {
          good('0 = 2·0 → 0 是偶數', 3.4, -0.5); cap('0 是偶數', '因為 0 = 2 × 0');
        },
  // 189
  async (tok, S) => {
          good('−4 = 2·(−2) → −4 是偶數', 3.4, -1.2); cap('−4 也是偶數', '−4 = 2 × (−2)');
        },
]);
scene('pfB-l8-divprops', "整除的三個性質（附證明）", CAM, [
  // 197.5
  async (tok, S) => {
          hd('a, b, c ∈ ℤ，a ≠ 0', -3.4, 7.2); S.L = board(-3.4, 6.3, 0.75); S.R = board(3.4, 6.3, 0.75); cap('整除的性質', 'a、b、c 都是整數');
        },
  // 210.7
  async (tok, S) => {
          S.L.add('a | 0：0 是任何數的倍數'); S.L.last(); cap('0 是任何數的倍數', '0 = a × 0');
        },
  // 224.7
  async (tok, S) => {
          S.L.add('(i) a|b 且 a|c ⇒ a|(b+c)'); S.L.last(); cap('(i) a|b、a|c ⇒ a|(b+c)', '');
        },
  // 239.7
  async (tok, S) => {
          S.R.add('a | b ⇒ b = a·k₁'); S.R.last(); cap('b = a·k₁', '把整除翻成等式');
        },
  // 251.3
  async (tok, S) => {
          S.R.add('a | c ⇒ c = a·k₂'); S.R.last(); cap('c = a·k₂', '');
        },
  // 255.3
  async (tok, S) => {
          S.R.add('b + c = a·(k₁ + k₂) ✔', 'good'); S.R.hi(-1); cap('b + c = a(k₁ + k₂)', 'k₁ + k₂ 是整數 → a | (b + c)');
        },
  // 271.5
  async (tok, S) => {
          S.R.clear(); S.L.add('(ii) a|b ⇒ a|bc'); S.L.last(); cap('(ii) a|b ⇒ a|bc', '');
        },
  // 286.1
  async (tok, S) => {
          S.R.add('b = a·k₁'); S.R.add('bc = a·(k₁·c) ✔', 'good'); cap('bc = a·(k₁c)', '括號裡是整數 → a | bc');
        },
  // 299.2
  async (tok, S) => {
          S.R.clear(); S.L.add('(iii) a|b 且 b|c ⇒ a|c'); S.L.last(); cap('(iii) a|b、b|c ⇒ a|c', '整除可以接力');
        },
  // 304.2
  async (tok, S) => {
          S.R.add('b | c ⇒ c = b·k₃'); S.R.last(); cap('c = b·k₃', '');
        },
  // 316.1
  async (tok, S) => {
          S.R.add('c = (a·k₁)·k₃ = a·(k₁k₃)'); S.R.last(); cap('代入 b = a·k₁', 'c = a·(k₁k₃)');
        },
  // 334.4
  async (tok, S) => {
          S.R.add('a | c ✔', 'good'); S.R.hi(-1); S.L.hi(-1); cap('a | c 得證', '');
        },
]);
scene('pfB-l8-divalg', "除法演算法：101 = 11·9 + 2、−11 = 3·(−4) + 1", CAM, [
  // 337.4
  async (tok, S) => {
          hd('The Division Algorithm', -3.6, 7.2); S.L = board(-3.8, 6.3, 0.7); cap('除法演算法', '被除數 = 除數 × 商 + 餘數');
        },
  // 349.1
  async (tok, S) => {
          sm('其實是「定理」，不是演算法', -3.6, 6.7); cap('名字叫演算法，其實是定理', '演算法要有輸入、輸出');
        },
  // 362.5
  async (tok, S) => {
          S.L.add('a：被除數（dividend）'); S.L.last(); cap('a：被除數', '');
        },
  // 372.9
  async (tok, S) => {
          S.L.add('d ≠ 0：除數 → 唯一的 q、r'); S.L.last(); cap('d ≠ 0 ⇒ 唯一的商 q、餘數 r', '');
        },
  // 387.4
  async (tok, S) => {
          S.L.add('a = d · q + r'); S.L.last(); cap('a = d·q + r', '');
        },
  // 393.8
  async (tok, S) => {
          S.L.add('0 ≤ r < |d|', 'good'); S.L.last(); cap('餘數：0 ≤ r < |d|', '餘數不能是負的');
        },
  // 426.7
  async (tok, S) => {
          S.L.add('q = ⌊a / d⌋（d > 0）'); S.L.last(); cap('q = ⌊a/d⌋', '高斯符號：往下取整');
        },
  // 436
  async (tok, S) => {
          S.L.add('r = a − d · q'); S.L.last(); cap('r = a − d·q', '');
        },
  // 450
  async (tok, S) => {
          S.L.hi(-1); S.bars = []; for (let i = 0; i < 9; i++) S.bars.push(bx('11', FC.blue, 1.0 + i * 0.56, 4.8, 0, 0.48, 1.0, 0.5));
          S.bars.push(bx('', FC.red, 6.1, 4.45, 0, 0.3, 0.3, 0.3), bx('', FC.red, 6.45, 4.45, 0, 0.3, 0.3, 0.3));
          good('101 = 11·9 + 2', 3.6, 6.0); cap('101 = 11·9 + 2', '商 9、餘數 2');
        },
  // 451.4
  async (tok, S) => {
          note('餘數 ≥ 0，且 < 除數', 3.6, 3.6); cap('餘數要 ≥ 0 而且比除數小', '');
        },
  // 462
  async (tok, S) => {
          S.nl = nline(0.9, 6.3, 1.8, -12, 0, 3);
          S.m = bx('−12', FC.purple, S.nl.X(-12), 2.4, 0, 0.5, 0.5, 0.5); await wt(tok, 500);
          S.ar = arrow(V3(S.nl.X(-12), 2.8, 0), V3(S.nl.X(-11), 2.8, 0), 0xd64545); S.p = bx('−11', FC.orange, S.nl.X(-11) + 0.2, 3.3, 0, 0.5, 0.5, 0.5);
          good('−11 = 3·(−4) + 1', 3.6, 0.6); cap('−11 = 3·(−4) + 1', '商 −4、餘數 1（不是 −2）');
        },
]);
scene('pfB-l8-mod', "mod：取餘數運算", CAM, [
  // 475.3
  async (tok, S) => {
          hd('mod：取餘數運算', 0, 7.2); S.L = board(0, 6.2, 0.75); cap('取餘數運算 mod', '');
        },
  // 487.3
  async (tok, S) => {
          S.L.add('整數 a、d，d > 1（d = 1 永遠餘 0）'); S.L.last(); cap('a、d 為整數，d > 1', 'd = 1 就沒有餘數可言');
        },
  // 497.4
  async (tok, S) => {
          S.L.add('a mod d = r（除法演算法的餘數）'); S.L.last(); cap('a mod d = 餘數 r', '');
        },
  // 526
  async (tok, S) => {
          S.L.add('101 mod 11 = 2，−11 mod 3 = 1', 'good'); S.L.last(); cap('a 除以 d 的餘數', '101 mod 11 = 2、−11 mod 3 = 1');
        },
  // 540.2
  async (tok, S) => {
          S.L.add('a mod d = a − d·⌊a / d⌋'); S.L.last(); cap('a mod d = a − d·⌊a/d⌋', '');
        },
  // 554.3
  async (tok, S) => {
          S.c = code(['r = a % d;   // C 語言', '-11 % 3  → -2（C）', '-11 mod 3 → 1（數學）'], 0, 2.4); S.c.hl(0); cap('C 語言：%', '負數時和數學 mod 不同');
        },
]);
scene('pfB-l8-congr', "同餘：a ≡ b (mod m) ⇔ m | (a − b)", CAM, [
  // 568.2
  async (tok, S) => {
          hd('同餘 congruence', -3.6, 7.2); S.L = board(-3.6, 6.2, 0.75); cap('同餘：餘數相同', 'congruence');
        },
  // 586.1
  async (tok, S) => {
          S.L.add('a, b ∈ ℤ，m 是正整數'); S.L.last(); cap('a、b 整數，m 正整數', '');
        },
  // 598
  async (tok, S) => {
          S.L.add('a ≡ b (mod m) ⇔ m | (a − b)'); S.L.last(); cap('a ≡ b (mod m) ⇔ m | (a − b)', '');
        },
  // 609.9
  async (tok, S) => {
          S.L.add('≡ 讀作「同餘」；(mod m) 說明除數', 'idx'); cap('符號 ≡', '括號註明 mod m');
        },
  // 622.6
  async (tok, S) => {
          S.L.add('⇔ a − b ≡ 0 (mod m)'); S.L.last(); cap('也可寫 a − b ≡ 0 (mod m)', 'iff：兩個方向都成立');
        },
  // 676.2
  async (tok, S) => {
          S.L.hi(-1); S.a = groups(1.4, 4.6, 2, 2, FC.blue, 1); S.b = groups(1.4, 3.6, 0, 2, FC.blue, 1);
          sm('3', 0.8, 4.6); sm('1', 0.8, 3.6); good('3 ≡ 1 (mod 2)：2 | (3 − 1)', 3.6, 2.6); cap('3 ≡ 1 (mod 2)', '2 整除 3 − 1 = 2');
        },
  // 698.8
  async (tok, S) => {
          S.L.add('a = dq + r ⇒ d | (a − r)'); S.L.last(); cap('a − r 一定被 d 整除', '每個數都和自己的餘數同餘');
        },
  // 725.2
  async (tok, S) => {
          S.L.add('只看 a − b 能不能被 m 整除', 'good'); S.L.hi(-1); cap('判斷同餘：看 a − b', '能被 m 整除就同餘');
        },
]);
scene('pfB-l8-congops', "同餘的加法、乘法規則", CAM, [
  // 756.7
  async (tok, S) => {
          S.L = board(-3.5, 6.8, 0.72); S.R = board(3.6, 6.8, 0.72); S.L.add('a ≡ b ⇔ ∃k：a = b + k·m'); S.L.last(); cap('a = b + k·m', '同餘的等式寫法');
        },
  // 775
  async (tok, S) => {
          S.L.add('⇔ a − b 是 m 的倍數'); S.L.last(); cap('a − b = k·m', '');
        },
  // 797.2
  async (tok, S) => {
          S.L.add('設 a ≡ b，c ≡ d (mod m)', 'ptr'); S.L.last(); cap('設 a ≡ b、c ≡ d (mod m)', '');
        },
  // 821.4
  async (tok, S) => {
          S.L.add('① a + c ≡ b + d (mod m)'); S.L.last(); cap('① 可以相加', 'a + c ≡ b + d');
        },
  // 855.6
  async (tok, S) => {
          S.R.add('a − b = m·k₁'); S.R.last(); cap('a − b = m·k₁', '');
        },
  // 877.9
  async (tok, S) => {
          S.R.add('c − d = m·k₂'); S.R.last(); cap('c − d = m·k₂', '');
        },
  // 902.3
  async (tok, S) => {
          S.R.add('(a+c) − (b+d) = m(k₁+k₂) ✔', 'good'); S.R.hi(-1); sm('示意：7 ≡ 2、11 ≡ 1 (mod 5) ⇒ 18 ≡ 3', 3.6, 4.0); cap('相加後差仍是 m 的倍數', '');
        },
  // 950.1
  async (tok, S) => {
          S.L.add('② a · c ≡ b · d (mod m)'); S.L.last(); cap('② 可以相乘', 'ac ≡ bd');
        },
  // 991.8
  async (tok, S) => {
          S.f1 = pl('(a + b) mod m = ((a mod m) + (b mod m)) mod m', 0, 1.0); S.L.hi(-1); cap('先各自取餘數再相加', '');
        },
  // 1002.6
  async (tok, S) => {
          sm('因為 a ≡ (a mod m)，b ≡ (b mod m)', 0, 0.4); cap('a 和自己的餘數同餘', '再套規則一');
        },
  // 1185.9
  async (tok, S) => {
          S.R.clear(); S.R.add('a = b + m·k₁，c = d + m·k₂'); S.R.last(); cap('a = b + mk₁，c = d + mk₂', '');
        },
  // 1196.7
  async (tok, S) => {
          S.R.add('ac = bd + m(bk₂ + dk₁ + mk₁k₂) ✔', 'good'); S.R.hi(-1); sm('示意：77 ≡ 2·1 = 2 (mod 5)', 3.6, 4.6); cap('ac − bd 是 m 的倍數', '所以 ac ≡ bd');
        },
  // 1210.3
  async (tok, S) => {
          pl('(a · b) mod m = ((a mod m)(b mod m)) mod m', 0, -0.3); cap('乘法也可先取餘數', '');
        },
]);
scene('pfB-l8-cantor', "實數不可數：對角線法", CAM, [
  // 1254.6
  async (tok, S) => {
          hd('定理：實數集合 ℝ 不可數', -3.4, 7.2); S.L = board(-3.6, 6.2, 0.72); cap('ℝ 不可數', '');
        },
  // 1272.8
  async (tok, S) => {
          S.L.add('可數 ⇔ 能和 1, 2, 3, … 一一對應'); S.L.last(); cap('可數：能發號碼牌', '一對一對應到正整數');
        },
  // 1318.3
  async (tok, S) => {
          S.L.add('反證：假設 ℝ 可數', 'bad'); S.L.last(); cap('反證法：先假設可數', '');
        },
  // 1349.5
  async (tok, S) => {
          S.L.add('可數集合的子集合也可數'); S.L.last(); cap('子集合也要可數', '');
        },
  // 1370.5
  async (tok, S) => {
          S.L.add('⇒ (0, 1) 也要可數'); S.L.last(); cap('看 (0,1) 這個子集合', '');
        },
  // 1431
  async (tok, S) => {
          S.L.hi(-1); S.D = [[2, 3, 7, 1], [1, 4, 5, 9], [6, 0, 4, 2], [9, 9, 1, 8]]; S.cells = [];
          sm('（數字示意）', 2.6, 6.6);
          S.cells.push(row(1.6, 5.6, S.D[0], { w: 0.55, c: FC.sand }).cells); pl('r₁ = 0.', 0.6, 5.6); cap('r₁ = 0.d₁₁d₁₂d₁₃…', '');
        },
  // 1441.6
  async (tok, S) => {
          for (let i = 1; i < 4; i++) { S.cells.push(row(1.6, 5.6 - i * 0.75, S.D[i], { w: 0.55, c: FC.sand }).cells); pl('r' + '₁₂₃₄'[i] + ' = 0.', 0.6, 5.6 - i * 0.75); await wt(tok, 200); }
          sm('⋮', 2.6, 2.6); cap('r₂、r₃、… 全部列出', '');
        },
  // 1460.8
  async (tok, S) => {
          pl('r = 0.', 0.6, 1.6); S.r = row(1.6, 1.6, ['?', '?', '?', '?'], { w: 0.55, c: FC.mint }).cells; cap('造一個不在清單上的 r', '');
        },
  // 1512.7
  async (tok, S) => {
          for (let i = 0; i < 4; i++) glow(S.cells[i][i], HL);
          note('dᵢ = 4（若 dᵢᵢ ≠ 4）；dᵢ = 5（若 dᵢᵢ = 4）', -3.6, 1.0); cap('看對角線 dᵢᵢ', '≠ 4 放 4，= 4 放 5');
        },
  // 1622.3
  async (tok, S) => {
          relabel(S.r[0], '4'); glow(S.r[0], OKG); cap('d₁₁ = 2 ≠ 4 → 放 4', '');
        },
  // 1636.6
  async (tok, S) => {
          relabel(S.r[1], '5'); glow(S.r[1], OKG); cap('d₂₂ = 4 → 放 5', '');
        },
  // 1646.1
  async (tok, S) => {
          relabel(S.r[2], '5'); relabel(S.r[3], '4'); glow(S.r[2], OKG); glow(S.r[3], OKG);
          bad('r 和每個 rᵢ 在第 i 位都不同 → 不在清單上', 2.4, 0.6); cap('r 不在清單上', '');
        },
  // 1664.8
  async (tok, S) => {
          good('(0,1) 不可數 ⇒ ℝ 不可數', -3.6, -0.2); cap('矛盾 ⇒ ℝ 不可數', '');
        },
]);

// ════════ a_iekTDu1xQ（交大OCW 易志偉《離散數學》Lec09 Algorithms and the Integers (2/4)） ════════
scene('pfB-l9-sym', "整除：用符號簡潔寫下", CAM, [
  // 7.1
  async (tok, S) => {
          S.L = board(0, 6.6, 0.8); S.L.add('a | b ⇔ ∃c ∈ ℤ，b = a · c', 'ptr alt'); cap('a | b ⇔ 存在 c 使 b = ac', '');
        },
  // 27.5
  async (tok, S) => {
          S.L.add('中文敘述 → 先寫成符號 a | b'); S.L.last(); cap('先把條件寫成符號', '方便記憶');
        },
  // 39.7
  async (tok, S) => {
          S.L.add('推演時用等式：b = a · c', 'good'); S.L.last(); cap('推演用等式 b = a·c', '');
        },
]);
scene('pfB-l9-read', "讀懂符號：a|b ∧ b|c → a|c", CAM, [
  // 89.1
  async (tok, S) => {
          S.L = board(0, 6.2, 0.9); S.L.add('a | b ∧ b | c  →  a | c'); S.L.last(); cap('a|b 且 b|c ⇒ a|c', '先看懂意思');
        },
  // 102.5
  async (tok, S) => {
          S.L.add('a | b ∧ a | c  →  ∀m, n ∈ ℤ：a | (mb + nc)'); S.L.last(); cap('a | (mb + nc)', 'b、c 的線性組合');
        },
  // 111.3
  async (tok, S) => {
          S.L.hi(-1); bub('只寫符號也能溝通 ✔', 0, 3.4); cap('符號就是共同語言', '');
        },
]);
scene('pfB-l9-divsign', "除法公式：±11 除以 ±3", CAM, [
  // 138.4
  async (tok, S) => {
          hd('除法：不一定除得盡', -3.6, 7.2); S.L = board(-3.6, 6.2, 0.7); cap('一般的除法', '有可能除不盡');
        },
  // 148.1
  async (tok, S) => {
          S.L.add('a = b · q + r（全是整數）'); S.L.last(); cap('a = bq + r', '');
        },
  // 164.7
  async (tok, S) => {
          S.q = bub('哪個條件讓答案只有一種？', 3.4, 6.4); cap('哪個條件最重要？', '');
        },
  // 189.7
  async (tok, S) => {
          S.L.add('a ÷ b → 商 q、餘數 r（要唯一）'); S.L.last(); cap('答案要唯一', '');
        },
  // 240.5
  async (tok, S) => {
          remove(S.q); S.q = bub('關鍵：限制餘數 r', 3.4, 6.4); cap('最重要的是餘數', '');
        },
  // 247.1
  async (tok, S) => {
          S.L.add('0 ≤ r < |b|', 'good'); S.L.last(); cap('0 ≤ r < |b|', 'a、b 可正可負');
        },
  // 270.5
  async (tok, S) => {
          S.L.add('⇒ q 也唯一'); S.L.last(); cap('商 q 也唯一', '');
        },
  // 287.5
  async (tok, S) => {
          S.L.hi(-1); S.nl = nline(0.3, 6.3, 2.0, -12, 12, 3); sm('10 ÷ 2 = 5 餘 0；11 ÷ 3 = 3 餘 2', 3.3, 5.6); cap('10 ÷ 2 = 5 餘 0', '11 ÷ 3 = 3 餘 2');
        },
  // 316.6
  async (tok, S) => {
          S.m = bx('9', FC.blue, S.nl.X(9), 2.6, 0, 0.45, 0.45, 0.45); S.a1 = arrow(V3(S.nl.X(9), 3.0, 0), V3(S.nl.X(11), 3.0, 0), 0x2fc092);
          S.R = board(3.3, 4.8, 0.62); S.R.add('11 = 3 · 3 + 2', 'good'); cap('11 = 3·3 + 2', '寫成等式才能運算');
        },
  // 326.9
  async (tok, S) => {
          S.m2 = bx('−12', FC.purple, S.nl.X(-12), 2.6, 0, 0.45, 0.45, 0.45); S.a2 = arrow(V3(S.nl.X(-12), 3.0, 0), V3(S.nl.X(-11), 3.0, 0), 0xd64545);
          S.R.add('−11 = 3 · (−4) + 1', 'good'); cap('−11 = 3·(−4) + 1', '商 −4、餘 1');
        },
  // 394.2
  async (tok, S) => {
          S.R.add('除數 −3：餘數仍要 0 ≤ r < 3', 'idx'); cap('除數是 −3 呢？', '餘數仍 0 ≤ r < 3');
        },
  // 425
  async (tok, S) => {
          S.R.add('11 = (−3) · (−3) + 2', 'good'); cap('11 = (−3)·(−3) + 2', '商 −3、餘 2');
        },
  // 441.7
  async (tok, S) => {
          S.R.add('−11 = (−3) · 4 + 1', 'good'); cap('−11 = (−3)·4 + 1', '商 4、餘 1');
        },
]);
scene('pfB-l9-congr', "同餘：10、13、16、1 除以 3 都餘 1", CAM, [
  // 463.9
  async (tok, S) => {
          hd('同餘：只在意餘數', -3.6, 7.2); S.L = board(-3.6, 6.3, 0.66); cap('同餘', '');
        },
  // 480.2
  async (tok, S) => {
          S.L.add('「餘」= 餘數 → 一定要有除法'); S.L.last(); cap('先有除法才有餘數', '');
        },
  // 497
  async (tok, S) => {
          S.L.add('大家要除「同一個」數'); S.L.last(); cap('除數要一樣才公平', '');
        },
  // 529.2
  async (tok, S) => {
          S.L.add('共同的除數：divisor'); S.L.last(); cap('共同的 divisor', '');
        },
  // 534.2
  async (tok, S) => {
          S.L.hi(-1); S.cols = []; S.addc = (n, i) => { const r = n % 3; const c = bx(String(n), [FC.gray, FC.green, FC.blue][r], 0.6 + i * 1.0, 5.4, 0, 0.75, 0.75, 0.75); const t = sm('餘 ' + r, 0.6 + i * 1.0, 4.6); S.cols.push([c, t, r]); };
          S.addc(10, 0); cap('10 ÷ 3 = 3 餘 1', '');
        },
  // 608.6
  async (tok, S) => {
          for (let i = 1; i <= 4; i++) { S.addc(10 + i, i); await wt(tok, 250); } cap('11、12、13、14 除以 3', '餘 2、0、1、2');
        },
  // 654.8
  async (tok, S) => {
          glow(S.cols[0][0], HL); glow(S.cols[3][0], HL); cap('10 和 13 都餘 1', '');
        },
  // 659.2
  async (tok, S) => {
          S.addc(16, 5); glow(S.cols[5][0], HL); cap('16 ÷ 3 也餘 1', '');
        },
  // 678.7
  async (tok, S) => {
          S.one = bx('1', FC.green, 3.6, 3.2, 0, 0.75, 0.75, 0.75); glow(S.one, HL); sm('最簡單的代表', 3.6, 2.4); cap('最簡單的代表：1', '');
        },
  // 698.5
  async (tok, S) => {
          S.L.add('10、13、16、1 …：除 3 都餘 1'); S.L.last(); cap('除 3 底下同餘', '');
        },
  // 739.4
  async (tok, S) => {
          S.L.add('10 ≡ 13 (mod 3)', 'ptr alt'); cap('10 ≡ 13 (mod 3)', '括號寫清楚除數');
        },
  // 754
  async (tok, S) => {
          bad('不要寫 10 = 13 ✘', -3.6, -0.1); cap('不要用等號', '只是餘數一樣，不是相等');
        },
  // 777.3
  async (tok, S) => {
          gone(S.cols.map((c) => [c[0], c[1]]), S.one); S.R = board(3.2, 5.6, 0.75); S.R.add('① a mod m = b mod m'); S.R.last(); cap('① 餘數相等', '直接但不好算');
        },
  // 808.6
  async (tok, S) => {
          S.R.add('② m | (a − b)'); S.R.last(); cap('② m | (a − b)', '相減後餘數抵消');
        },
  // 861.2
  async (tok, S) => {
          S.R.add('③ ∃c：a − b = c · m', 'good'); S.R.last(); cap('③ a − b = c·m', '證明最常用');
        },
]);
scene('pfB-l9-byte', "1000 = 256·3 + 232：用兩個 byte 存", CAM, [
  // 897.6
  async (tok, S) => {
          hd('為什麼資工要學同餘？', 0, 7.2); cap('同餘在電腦裡有什麼用？', '');
        },
  // 919.2
  async (tok, S) => {
          S.b1 = row(-2.45, 5.4, [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '], { w: 0.6, c: FC.sand }).cells; sm('1 byte = 8 bits', 0, 4.7); cap('1 byte = 8 bits', '');
        },
  // 929.5
  async (tok, S) => {
          pl('能存 0 ～ 255（2⁸ = 256 種）', 0, 6.3); cap('能存 0～255', '');
        },
  // 939.6
  async (tok, S) => {
          S.big = bx('1000', FC.red, -5.4, 5.4, 0, 1.0, 0.8, 0.8); bad('1000 放不下！', -5.4, 4.5); cap('1000 放不下', '要留哪一部分？');
        },
  // 959.7
  async (tok, S) => {
          S.L = board(0, 3.6, 0.65); S.L.add('1000 ÷ 256（2⁸ = 256）'); S.L.last(); cap('1000 除以 256', '餘數一定在 0～255');
        },
  // 1004.8
  async (tok, S) => {
          S.L.add('1000 mod 256 = 232'); S.L.last(); '11101000'.split('').forEach((d, i) => { relabel(S.b1[i], d); if (d === '1') glow(S.b1[i], OKG); }); cap('餘數 232 → 一個 byte', '232 = 11101000₂');
        },
  // 1012.5
  async (tok, S) => {
          S.b2 = row(-2.45, 1.4, '00000011'.split(''), { w: 0.6, c: FC.lilac }).cells; sm('第二個 byte：商 3', 0, 0.7); cap('第二個 byte 記商 3', '');
        },
  // 1033.7
  async (tok, S) => {
          S.L.add('1000 = 256 · 3 + 232 ✔', 'good'); S.L.last(); cap('湊回去：256·3 + 232 = 1000', '');
        },
  // 1049.3
  async (tok, S) => {
          S.L.hi(-1); note('RSA 加密：只記餘數（3-7 節）', -5.0, 2.6); cap('RSA 也只記餘數', '後面 3-7 節');
        },
]);
scene('pfB-l9-sumproof', "同餘相加的證明：把已知寫成等式", CAM, [
  // 1088.2
  async (tok, S) => {
          S.L = board(-3.4, 6.6, 0.75); S.L.add('a ≡ b (mod m) ⇔ ∃k：a = b + km'); S.L.last(); cap('a = b + km', '同餘的等式形式');
        },
  // 1121.8
  async (tok, S) => {
          hd('求證：a + c ≡ b + d (mod m)', 3.0, 7.2); cap('求證 a + c ≡ b + d', '');
        },
  // 1166.3
  async (tok, S) => {
          S.L.add('已知：a ≡ b，c ≡ d (mod m)', 'ptr'); S.L.last(); cap('先寫下已知', '');
        },
  // 1206.1
  async (tok, S) => {
          S.L.add('a = b + k₁ m'); S.L.last(); cap('a = b + k₁m', '');
        },
  // 1212.4
  async (tok, S) => {
          S.L.add('c = d + k₂ m'); S.L.last(); cap('c = d + k₂m', '');
        },
  // 1241
  async (tok, S) => {
          S.R = board(3.0, 3.6, 0.75); S.R.add('目標：a + c = b + d + (？) · m', 'note'); cap('目標等式', 'a + c = b + d + ？·m');
        },
  // 1281
  async (tok, S) => {
          S.R.add('a + c = b + d + k₁m + k₂m'); S.R.last(); cap('兩式相加', '');
        },
  // 1293
  async (tok, S) => {
          S.R.add('= b + d + (k₁ + k₂) m'); S.R.last(); cap('？ = k₁ + k₂', '');
        },
  // 1298.9
  async (tok, S) => {
          S.R.add('k₁ + k₂ ∈ ℤ ⇒ a + c ≡ b + d ✔', 'good'); S.R.hi(-1); S.L.hi(-1); cap('k₁ + k₂ 是整數 ⇒ 得證', '');
        },
]);
scene('pfB-l9-prime', "質數、合成數、100 = 2²·5²", CAM, [
  // 1325.2
  async (tok, S) => {
          hd('3-5：質數、gcd、lcm', -3.6, 7.2); S.L = board(-3.6, 6.3, 0.68); cap('3-5：質數與 gcd、lcm', '');
        },
  // 1341.3
  async (tok, S) => {
          S.L.add('p ≥ 2'); S.L.last(); cap('質數一定 ≥ 2', '');
        },
  // 1377.9
  async (tok, S) => {
          S.L.add('正因數只有 1 和 p → 質數 prime'); S.L.last(); cap('只有 1 和自己 → 質數', '');
        },
  // 1398.4
  async (tok, S) => {
          S.L.add('q ≥ 2 且不是質數 → 合成數'); S.L.last(); cap('合成數：≥ 2 且不是質數', '');
        },
  // 1438.8
  async (tok, S) => {
          S.L.add('−2：都不是 ✘', 'bad'); cap('−2：都不是', '定義要求 ≥ 2');
        },
  // 1465.8
  async (tok, S) => {
          S.L.add('1：也都不是 ✘', 'bad'); cap('1：都不是', '');
        },
  // 1480.5
  async (tok, S) => {
          S.L.hi(-1); const ps = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
          S.ps = ps.map((p, i) => bx(String(p), FC.green, 1.2 + (i % 5) * 0.95, 6.4 - Math.floor(i / 5) * 0.8, 0, 0.7, 0.6, 0.5)); sm('1～100 的質數（25 個）', 3.1, 7.2); cap('背 1～100 的質數', '共 25 個');
        },
  // 1514.4
  async (tok, S) => {
          bad('51 = 3 × 17 → 不是質數', 3.1, 2.2); cap('51 = 3 × 17', '不是質數');
        },
  // 1531.1
  async (tok, S) => {
          gone(S.ps); S.f = pl('100 = 2 · 2 · 5 · 5', 3.1, 6.0); cap('100 = 2·2·5·5', '因數分解');
        },
  // 1568.4
  async (tok, S) => {
          good('100 = 2² · 5²（標準分解式）', 3.1, 5.2); cap('100 = 2²·5²', '標準分解式');
        },
  // 1581
  async (tok, S) => {
          hot('a = p₁^n₁ · p₂^n₂ ⋯ p_k^n_k', 3.1, 3.8); cap('a = p₁^n₁ ⋯ p_k^n_k', '每個整數都能這樣寫');
        },
]);
scene('pfB-l9-gcd', "gcd = max{公因數}，lcm = min{正的公倍數}", CAM, [
  // 1609
  async (tok, S) => {
          hd('最大公因數 gcd', -3.4, 7.2); S.L = board(-3.4, 6.3, 0.75); cap('最大公因數 gcd', '');
        },
  // 1618.2
  async (tok, S) => {
          S.L.add('能同時整除 a、b 的最大整數'); S.L.last(); cap('同時整除 a、b，最大的', '');
        },
  // 1648.5
  async (tok, S) => {
          S.L.add('max{ 集合 }：挑出最大的'); S.L.last(); cap('max：集合裡最大的', '');
        },
  // 1678.8
  async (tok, S) => {
          S.L.add('gcd(a,b) = max{ m : m|a 且 m|b }', 'ptr alt'); cap('gcd = max{公因數}', '');
        },
  // 1693.3
  async (tok, S) => {
          S.d = [1, 2, 3, 6].map((v, i) => bx(String(v), FC.blue, 1.6 + i * 1.0, 5.6, 0, 0.7, 0.7, 0.7)); await wt(tok, 400); glow(S.d[3], HL);
          sm('示意：12、18 的公因數', 3.1, 6.5); good('gcd(12, 18) = 6', 3.1, 4.7); cap('示意：gcd(12, 18) = 6', '');
        },
  // 1719
  async (tok, S) => {
          S.L.hi(-1); hd('最小公倍數 lcm', -3.4, 2.4); cap('最小公倍數 lcm', '');
        },
  // 1730.5
  async (tok, S) => {
          bad('負的倍數 −36, −72, … 沒有最小', 3.1, 2.4); cap('小心負數', '負的倍數沒有最小');
        },
  // 1745.8
  async (tok, S) => {
          S.L2 = board(-3.4, 1.6, 0.7); S.L2.add('m ∈ ℤ⁺（正整數）'); S.L2.last(); cap('限制在正整數 ℤ⁺', '');
        },
  // 1758.4
  async (tok, S) => {
          S.L2.add('lcm(a,b) = min{ m ∈ ℤ⁺ : a|m 且 b|m }', 'ptr alt'); good('示意：lcm(12, 18) = 36', 3.1, 1.4); cap('lcm = min{正的公倍數}', '');
        },
]);
scene('pfB-l9-sqrt', "合成數 n 有一個因數 ≤ √n", CAM, [
  // 1775.3
  async (tok, S) => {
          hd('n 合成數 ⇒ 有質因數 ≤ √n', 0, 7.2); S.L = board(-3.6, 6.2, 0.75); cap('合成數有 ≤ √n 的質因數', '');
        },
  // 1793.7
  async (tok, S) => {
          sm('用反證法', 0, 6.6); cap('用反證法', '');
        },
  // 1821.6
  async (tok, S) => {
          S.L.add('n = a · b，1 < a, b < n'); S.L.last(); cap('n = ab', 'a、b 不是 1 也不是 n');
          S.nl = nline(1.0, 6.4, 1.6, 0, 14, 2); S.sq = hot('√n', 1.0 + Math.sqrt(91) * 5.4 / 14, 2.6); sm('示意：n = 91 = 7 · 13，√91 ≈ 9.54', 3.7, 0.6);
        },
  // 1839.7
  async (tok, S) => {
          S.L.add('目標：a ≤ √n 或 b ≤ √n', 'note'); cap('目標：至少一個 ≤ √n', '');
        },
  // 1848.8
  async (tok, S) => {
          S.L.add('假設 a > √n 且 b > √n', 'bad'); cap('假設兩個都 > √n', '');
        },
  // 1871.4
  async (tok, S) => {
          S.L.add('⇒ a · b > √n · √n = n'); S.L.last(); cap('ab > n', '');
        },
  // 1883.6
  async (tok, S) => {
          S.L.add('但 a · b = n ⇒ 矛盾！', 'bad'); cap('ab = n 又 ab > n：矛盾', '');
        },
  // 1903.2
  async (tok, S) => {
          S.L.add('⇒ 至少一個 ≤ √n ✔', 'good'); S.L.hi(-1); S.b7 = bx('7', FC.green, 1.0 + 7 * 5.4 / 14, 2.3, 0, 0.45, 0.45, 0.45); S.b13 = bx('13', FC.orange, 1.0 + 13 * 5.4 / 14, 2.3, 0, 0.45, 0.45, 0.45); cap('至少一個 ≤ √n', '示意：7 ≤ √91');
        },
]);
scene('pfB-l9-infcop', "質數無窮多；互質 gcd = 1", CAM, [
  // 1942
  async (tok, S) => {
          hd('質數有無窮多個', -3.0, 6.6); cap('質數有無窮多個', '');
        },
  // 1953.8
  async (tok, S) => {
          sm('反證：假設有限 → 推出矛盾（課本）', -3.0, 5.8); cap('假設有限 → 矛盾', '細節看課本');
        },
  // 1989
  async (tok, S) => {
          hot('m、n 互質 ⇔ gcd(m, n) = 1', 2.4, 3.4); sm('示意：gcd(8, 15) = 1', 2.4, 2.6); cap('互質：gcd = 1', 'relatively prime');
        },
]);

// ════════ ddMlBS2RYp4（交大OCW 易志偉《離散數學》Lec10 Algorithms and the Integers (3/4)） ════════
scene('pfB-l10-base', "b 進位展開 n = a_k b^k + … + a_1 b + a_0", CAM, [
  // 33.6
  async (tok, S) => {
          hd('3-6 數字系統', 0, 7.2); cap('數字系統：數字的表示法', '');
        },
  // 48.3
  async (tok, S) => {
          S.L = board(-3.8, 6.2, 0.68); S.L.add('20 = 2 × 10'); S.L.last(); cap('十根手指 → 以 10 為底', '20 = 2 × 10');
        },
  // 57.6
  async (tok, S) => {
          S.L.add('200 = 2 × 100 = 2 × 10²'); S.L.last(); cap('200 = 2 × 10²', '逢十進位');
        },
  // 78
  async (tok, S) => {
          S.et = buddy('ET', '0 1', FC.green, 3.6, 4.6, 0, 0.9); cap('ET 兩根手指 → 二進位', '只有 0 和 1');
        },
  // 112.4
  async (tok, S) => {
          S.p2 = row(1.6, 2.6, ['2³', '2²', '2¹', '2⁰'], { w: 0.8, c: FC.mint }).cells; sm('二進位每一位的「重量」', 2.8, 1.8); cap('二進位：2⁰、2¹、2²、2³…', '');
        },
  // 137.3
  async (tok, S) => {
          S.p10 = row(1.6, 0.9, ['10³', '10²', '10¹', '10⁰'], { w: 0.8, c: FC.sky }).cells; sm('十進位每一位的「重量」', 2.8, 0.1); cap('十進位：10⁰、10¹、10²…', '');
        },
  // 151.3
  async (tok, S) => {
          S.L.add('b：基底 base（b ≥ 2）'); S.L.last(); cap('b：基底', '');
        },
  // 172.5
  async (tok, S) => {
          S.L.add('n = a_k b^k + … + a_1 b + a_0', 'ptr alt'); cap('n = a_k b^k + … + a_1 b + a_0', '');
        },
  // 232.4
  async (tok, S) => {
          S.L.add('a_k ≠ 0（532 不寫成 0532）'); S.L.last(); cap('最高位 ≠ 0', '');
        },
  // 257.3
  async (tok, S) => {
          S.L.add('0 ≤ a_i ≤ b − 1（滿 b 就進位）'); S.L.last(); cap('係數 0 ～ b − 1', '');
        },
  // 280.2
  async (tok, S) => {
          S.L.add('⇒ 表示法唯一', 'good'); S.L.hi(-1); cap('表示法唯一', '');
        },
]);
scene('pfB-l10-157', "157 = (9D)₁₆ = (235)₈ = (10011101)₂", CAM, [
  // 308.5
  async (tok, S) => {
          S.L = board(-3.4, 6.6, 0.85); S.L.add('157 = 1·10² + 5·10¹ + 7·10⁰'); S.L.last(); cap('157 = 1·10² + 5·10 + 7', '');
        },
  // 339
  async (tok, S) => {
          sm('decimal expansion', -3.4, 7.2); cap('decimal expansion', '十進位展開');
        },
  // 344.4
  async (tok, S) => {
          S.tags = ['16 進位', '8 進位', '2 進位'].map((t, i) => bub(t, 2.0 + i * 1.9, 7.0)); cap('16、8、2 進位', '');
        },
  // 352
  async (tok, S) => {
          S.L.add('157 = 9·16¹ + 13·16⁰'); S.L.last(); S.h = row(1.8, 5.0, ['9', '13'], { w: 0.9, c: FC.orange }).cells; cap('157 = 9·16 + 13', '');
        },
  // 389.3
  async (tok, S) => {
          sm('10=A 11=B 12=C 13=D 14=E 15=F', 2.4, 4.1); cap('10～15 用 A～F', '避免和兩位數混淆');
        },
  // 422.5
  async (tok, S) => {
          relabel(S.h[1], 'D'); glow(S.h[1], HL); S.L.add('= (9D)₁₆', 'good'); cap('157 = (9D)₁₆', '下標寫明基底');
        },
  // 463.5
  async (tok, S) => {
          S.L.add('157 = 2·8² + 3·8 + 5 = (235)₈', 'good'); S.o = row(1.8, 3.0, ['2', '3', '5'], { w: 0.9, c: FC.purple }).cells; cap('157 = (235)₈', '128 + 24 + 5');
        },
  // 500.1
  async (tok, S) => {
          S.L.add('157 = (10011101)₂', 'good'); S.b = row(0.6, 1.2, '10011101'.split(''), { w: 0.62, c: (i, v) => (v === '1' ? FC.green : FC.gray) }).cells; sm('128 + 16 + 8 + 4 + 1 = 157', 3.1, 0.4); cap('157 = (10011101)₂', '');
        },
]);
scene('pfB-l10-to10', "(134)₅ = 1·25 + 3·5 + 4 = 44", CAM, [
  // 553
  async (tok, S) => {
          S.d = row(-1.0, 5.4, ['1', '3', '4'], { w: 1.0, c: FC.teal }).cells; sm('(134)₅', 0.1, 4.5); cap('(134)₅ = ？', '');
        },
  // 564.9
  async (tok, S) => {
          ['5²', '5¹', '5⁰'].forEach((t, i) => sm(t, -1.0 + i * 1.1, 6.3)); cap('4·5⁰ + 3·5¹ + 1·5²', '');
        },
  // 578.5
  async (tok, S) => {
          good('(134)₅ = 4 + 15 + 25 = 44', 0.1, 3.4); cap('= 4 + 15 + 25 = 44', '');
        },
  // 588.1
  async (tok, S) => {
          note('換回十進位：乘開相加', 0.1, 2.4); cap('乘開相加就好', '');
        },
]);
scene('pfB-l10-repdiv', "連除法：139 → 四進位、五進位", CAM, [
  // 613.5
  async (tok, S) => {
          hd('連除法', -4.4, 7.2); cap('十進位 → b 進位：連除法', '');
        },
  // 621.1
  async (tok, S) => {
          hot('139 = (2023)₄ ？', -4.4, 6.4); cap('139 = (2023)₄？', '');
        },
  // 634.3
  async (tok, S) => {
          sm('驗算：3 + 8 + 0 + 128 = 139 ✔', -4.4, 5.7); cap('驗算：128 + 0 + 8 + 3 = 139', '');
        },
  // 661.1
  async (tok, S) => {
          S.L = board(-4.2, 4.8, 0.62); cap('一直做除法', '');
        },
  // 676.2
  async (tok, S) => {
          S.L.add('139 = 34·4 + 3'); S.L.last(); S.dg = row(1.2, 5.6, ['?', '?', '?', '3'], { w: 0.9, c: FC.sand }).cells; ['4³', '4²', '4¹', '4⁰'].forEach((t, i) => sm(t, 1.2 + i * 1.0, 6.5)); glow(S.dg[3], OKG); cap('139 = 34·4 + 3', '餘 3 → 第 0 位');
        },
  // 707.1
  async (tok, S) => {
          S.L.add('34 = 8·4 + 2'); S.L.last(); relabel(S.dg[2], '2'); glow(S.dg[2], OKG); cap('34 = 8·4 + 2', '餘 2 → 第 1 位');
        },
  // 746.1
  async (tok, S) => {
          S.L.add('8 = 2·4 + 0'); S.L.last(); relabel(S.dg[1], '0'); glow(S.dg[1], OKG); cap('8 = 2·4 + 0', '餘 0 → 第 2 位');
        },
  // 760.1
  async (tok, S) => {
          bad('0 不能丟！', 2.7, 4.6); cap('0 一定要寫', '');
        },
  // 766.1
  async (tok, S) => {
          S.L.add('139 = 2·4³ + 0·4² + 2·4 + 3'); S.L.last(); relabel(S.dg[0], '2'); glow(S.dg[0], OKG); cap('139 = 2·4³ + 0·4² + 2·4 + 3', '');
        },
  // 788.3
  async (tok, S) => {
          S.L.hi(-1); S.poly = sm('多項式版：一直除以 (x + 1)，餘數依序是 d、c、b、a', 2.7, 3.6); cap('和多項式連除一樣', '');
        },
  // 858.3
  async (tok, S) => {
          gone(S.L); S.R = board(-4.2, 4.8, 0.62); S.R.add('4 │ 139'); S.R.add('4 │  34 … 3'); S.R.add('4 │   8 … 2'); S.R.add('     2 … 0'); S.R.hi(-1); cap('短除法排版', '');
        },
  // 905.3
  async (tok, S) => {
          S.up = arrow(V3(-1.4, 2.6, 0), V3(-1.4, 4.4, 0), 0xc08a1f); S.g4 = good('由下往上讀 → (2023)₄', -4.2, 1.8); cap('由下往上讀：(2023)₄', '');
        },
  // 940.2
  async (tok, S) => {
          gone(S.R, S.up, S.poly, S.g4); S.F = board(-4.2, 4.8, 0.62); S.F.add('5 │ 139'); S.d5 = row(1.2, 2.6, ['?', '?', '?', '?'], { w: 0.9, c: FC.lilac }).cells; ['5³', '5²', '5¹', '5⁰'].forEach((t, i) => sm(t, 1.2 + i * 1.0, 3.5)); cap('139 換成五進位', '');
        },
  // 953.2
  async (tok, S) => {
          S.F.add('5 │  27 … 4'); S.F.last(); relabel(S.d5[3], '4'); glow(S.d5[3], OKG); cap('139 = 27·5 + 4', '');
        },
  // 961.5
  async (tok, S) => {
          S.F.add('5 │   5 … 2'); S.F.last(); relabel(S.d5[2], '2'); glow(S.d5[2], OKG); cap('27 = 5·5 + 2', '');
        },
  // 973.8
  async (tok, S) => {
          S.F.add('     1 … 0'); S.F.last(); relabel(S.d5[1], '0'); relabel(S.d5[0], '1'); glow(S.d5[1], OKG); glow(S.d5[0], OKG); cap('5 = 1·5 + 0', '0 不能丟');
        },
  // 987.4
  async (tok, S) => {
          S.F.hi(-1); good('139 = (1024)₅', 3.0, 1.4); cap('139 = (1024)₅', '125 + 10 + 4 = 139');
        },
]);
scene('pfB-l10-weight', "位權：最高位最重要", CAM, [
  // 1004.8
  async (tok, S) => {
          S.d = row(-2.0, 5.4, ['1', '0', '2', '4'], { w: 1.0, c: FC.lilac }).cells; cap('位置的權重', '');
        },
  // 1021
  async (tok, S) => {
          ['1·5³', '0·5²', '2·5¹', '4·5⁰'].forEach((t, i) => sm(t, -2.0 + i * 1.1, 4.5)); ['第3位', '第2位', '第1位', '第0位'].forEach((t, i) => sm(t, -2.0 + i * 1.1, 6.3)); cap('weight：5³、5²、5¹、5⁰', '');
        },
  // 1059.9
  async (tok, S) => {
          S.b = row(-2.0, 2.6, ['1', '0', '1', '1'], { w: 1.0, c: FC.mint }).cells; sm('二進位（示意）', -0.4, 1.8); cap('二進位的一位：bit', '');
        },
  // 1071.9
  async (tok, S) => {
          S.a = arrow(V3(2.4, 3.6, 0), V3(-2.6, 3.6, 0), 0xc08a1f); sm('權重越來越重', 0.0, 3.9); cap('越左邊權重越重', '');
        },
  // 1084.9
  async (tok, S) => {
          S.n = row(3.6, 5.4, ['2', '5', '6', '9'], { w: 0.8, c: FC.sky }).cells; glow(S.n[0], HL); bub('2569 ≈ 2000', 4.8, 6.6); cap('2569 ≈ 2000', '最高位最有意義');
        },
  // 1117.4
  async (tok, S) => {
          glow(S.b[0], HL); hot('MSB', -2.0, 0.9); cap('MSB：最高位', 'most significant bit');
        },
  // 1131.9
  async (tok, S) => {
          glow(S.b[3], OKG); good('LSB', 1.3, 0.9); cap('LSB：最低位', 'least significant bit');
        },
  // 1185
  async (tok, S) => {
          note('5 進位 → 10 進位 → 3 進位', 3.6, 1.6); cap('五進位 → 十進位 → 三進位', '兩步完成');
        },
]);
scene('pfB-l10-code', "連除法的 pseudocode", CAM, [
  // 1217.2
  async (tok, S) => {
          S.c = code(['procedure base b expansion(n, b)', 'q := n', 'k := 0', 'while q ≠ 0', '    a_k := q mod b', '    q := ⌊q / b⌋', '    k := k + 1', 'return (a_{k−1} … a_1 a_0)'], -2.6, 6.6, 0.62); cap('把連除法寫成程式', '');
        },
  // 1224.1
  async (tok, S) => {
          S.c.hl(0); cap('輸入 n、基底 b', '');
        },
  // 1238.2
  async (tok, S) => {
          S.c.hl(1); S.q = buddy('q', '139', FC.blue, 3.4, 4.0, 0, 0.9); sm('（沿用 139、b = 4 示意）', 3.6, 6.6); cap('q := n', '');
        },
  // 1242.2
  async (tok, S) => {
          S.c.hl(2); S.k = buddy('k', '0', FC.orange, 5.4, 4.0, 0, 0.9); cap('k := 0', '從第 0 位開始');
        },
  // 1254
  async (tok, S) => {
          S.c.hl(3); cap('while q ≠ 0', '');
        },
  // 1273
  async (tok, S) => {
          S.c.hl(4); S.dg = bx('3', FC.green, 4.4, 2.2, 0, 0.7, 0.7, 0.7); sm('a₀ = 3', 4.4, 1.4); cap('a_k := q mod b', '139 mod 4 = 3');
        },
  // 1285.8
  async (tok, S) => {
          S.c.hl(5); S.q.set('34'); cap('q := ⌊q / b⌋', '⌊139/4⌋ = 34');
        },
  // 1298.8
  async (tok, S) => {
          S.c.hl(6); S.k.set('1'); await wt(tok, 400); S.c.hl(7); good('→ (2023)₄', 4.4, 0.5); cap('k := k + 1，下一位', '一直除到 q = 0');
        },
]);
scene('pfB-l10-group', "(ABC)₁₆ → 二進位 → (5274)₈", CAM, [
  // 1325.3
  async (tok, S) => {
          hd('快速互換：2、8、16 進位', 0, 7.2); cap('快速轉換', '');
        },
  // 1344.4
  async (tok, S) => {
          S.L = board(-4.4, 6.4, 0.62); S.L.add('8 = 2³，16 = 2⁴'); S.L.last(); cap('8 = 2³、16 = 2⁴', '');
        },
  // 1359.4
  async (tok, S) => {
          S.L.add('→ 經過二進位互換'); S.L.last(); cap('經過二進位最快', '');
        },
  // 1376.6
  async (tok, S) => {
          S.L.hi(-1); const H = '0123456789ABCDEF'; S.tb = []; for (let i = 0; i < 16; i++) S.tb.push(sm(H[i] + ' = ' + i.toString(2).padStart(4, '0'), -5.4 + Math.floor(i / 8) * 2.2, 4.8 - (i % 8) * 0.5)); cap('一位 16 進位 = 4 bits', '');
        },
  // 1412.1
  async (tok, S) => {
          S.bits = row(0.0, 5.6, '101010111100'.split(''), { w: 0.48, gap: 0.06, c: (i) => [FC.orange, FC.teal, FC.purple][Math.floor(i / 4)] }).cells; S.bits.forEach((m) => { m.visible = false; });
          for (let i = 0; i < 4; i++) S.bits[i].visible = true; S.abc = [sm('A', 0.81, 6.3)]; cap('A = 1010', '');
        },
  // 1422.2
  async (tok, S) => {
          for (let i = 4; i < 8; i++) S.bits[i].visible = true; S.abc.push(sm('B', 2.97, 6.3)); cap('B = 1011', '');
        },
  // 1425
  async (tok, S) => {
          for (let i = 8; i < 12; i++) S.bits[i].visible = true; S.abc.push(sm('C', 5.13, 6.3)); S.eq = good('(ABC)₁₆ = (101010111100)₂', 3.0, 4.9); cap('C = 1100', '(ABC)₁₆ = (101010111100)₂');
        },
  // 1428.7
  async (tok, S) => {
          gone(S.tb); S.L.add('一位 8 進位 = 3 bits'); S.L.last(); cap('一位 8 進位 = 3 bits', '');
        },
  // 1454.2
  async (tok, S) => {
          S.tb = []; for (let i = 0; i < 8; i++) S.tb.push(sm(i + ' = ' + i.toString(2).padStart(3, '0'), -4.4, 4.2 - i * 0.5)); cap('0～7 的三位二進位', '');
        },
  // 1464
  async (tok, S) => {
          gone(S.abc); S.bits.forEach((m, i) => { const g = Math.floor(i / 3); m.position.x = i * 0.54 + g * 0.3; tint(m, [FC.sky, FC.lilac, FC.mint, FC.sand][g]); }); S.ar = arrow(V3(6.4, 3.6, 0), V3(4.6, 3.6, 0), 0xc08a1f); sm('從右邊開始分組', 5.0, 3.2); cap('從右邊三個一組', '');
        },
  // 1476
  async (tok, S) => {
          gone(S.eq); ['5', '2', '7', '4'].forEach((d, g) => good(d, 0.54 + g * 1.92, 4.6)); hot('= (5274)₈', 3.0, 2.4); cap('(101 010 111 100)₂ = (5274)₈', '');
        },
]);
scene('pfB-l10-753', "753 = (11003)₅ = (1361)₈ = (2F1)₁₆", CAM, [
  // 1504.2
  async (tok, S) => {
          hd('753（由老師的除法還原）', -4.0, 7.2); cap('再算一個：753', '');
        },
  // 1520.4
  async (tok, S) => {
          S.L = board(-4.4, 6.3, 0.6); S.L.add('5 │ 753'); S.L.add('5 │ 150 … 3'); S.L.last(); cap('753 = 150·5 + 3', '');
        },
  // 1537.4
  async (tok, S) => {
          S.L.add('5 │  30 … 0'); S.L.add('5 │   6 … 0'); S.L.add('     1 … 1'); S.L.hi(-1); good('753 = (11003)₅', -4.4, 3.0); cap('753 = (11003)₅', '');
        },
  // 1556.1
  async (tok, S) => {
          S.R = board(0.6, 6.3, 0.6); S.R.add('8 │ 753'); cap('換八進位', '');
        },
  // 1577.7
  async (tok, S) => {
          S.R.add('8 │  94 … 1'); S.R.add('8 │  11 … 6'); S.R.add('     1 … 3'); S.R.hi(-1); good('753 = (1361)₈', 0.6, 3.6); cap('753 = (1361)₈', '');
        },
  // 1588.5
  async (tok, S) => {
          note('8 進位 → 2 進位 → 16 進位', 4.6, 6.8); cap('經過二進位換十六進位', '');
        },
  // 1607.5
  async (tok, S) => {
          S.b3 = row(-0.4, 1.6, '001011110001'.split(''), { w: 0.48, gap: 0.06, c: (i) => [FC.sky, FC.lilac, FC.mint, FC.sand][Math.floor(i / 3)] }).cells; S.dl = ['1', '3', '6', '1'].map((d, g) => sm(d, -0.4 + g * 1.62 + 0.54, 2.3)); cap('每位換 3 bits', '1→001、3→011、6→110、1→001');
        },
  // 1617.4
  async (tok, S) => {
          gone(S.dl); S.b3.forEach((m, i) => { const g = Math.floor(i / 4); tint(m, [FC.orange, FC.teal, FC.purple][g]); m.position.x = -0.4 + i * 0.54 + g * 0.3; }); cap('改成 4 個一組', '不夠補 0');
        },
  // 1639.7
  async (tok, S) => {
          ['2', 'F', '1'].forEach((d, g) => good(d, -0.4 + g * 2.46 + 0.81, 0.8)); hot('753 = (2F1)₁₆', 3.0, -0.2); cap('753 = (2F1)₁₆', '');
        },
  // 1649.6
  async (tok, S) => {
          bub('(16)₂₀ = 1·20 + 6 = 26', -4.0, 1.4); cap('(16)₂₀ = 26', '二十進位也照公式');
        },
]);
scene('pfB-l10-arith', "二進位加法、長乘法 1011 × 101", CAM, [
  // 1701.6
  async (tok, S) => {
          hd('二進位的運算', 0, 7.2); cap('二進位的加減乘除', '和十進位一樣');
        },
  // 1713.3
  async (tok, S) => {
          S.A = row(-4.6, 5.6, ['', '1', '1', '1', '0'], { w: 0.6, c: FC.sky }).cells; S.B = row(-4.6, 4.8, ['', '1', '0', '1', '1'], { w: 0.6, c: FC.lilac }).cells; S.A[0].visible = false; S.B[0].visible = false;
          sm('+', -5.4, 4.8); sm('示意：1110 + 1011（課本例）', -2.9, 6.5); S.Sm = row(-4.6, 3.6, [' ', ' ', ' ', ' ', ' '], { w: 0.6, c: FC.mint }).cells; cap('對齊個位，一位一位加', '');
        },
  // 1732
  async (tok, S) => {
          relabel(S.Sm[4], '1'); await wt(tok, 300); relabel(S.Sm[3], '0'); S.c1 = sm('進 1', -2.8, 6.0); cap('1 + 1 = 10：寫 0 進 1', '');
        },
  // 1759.2
  async (tok, S) => {
          relabel(S.Sm[2], '0'); await wt(tok, 300); relabel(S.Sm[1], '1'); relabel(S.Sm[0], '1'); good('1110 + 1011 = 11001（14 + 11 = 25）', -2.9, 2.8); cap('1 + 1 + 1 = 11：寫 1 進 1', '答案 11001');
        },
  // 1778.4
  async (tok, S) => {
          note('半加器 → 全加器 → 串起來', 4.4, 6.4); cap('半加器、全加器', '數位邏輯會學');
        },
  // 1809
  async (tok, S) => {
          S.M = code(['      1011', '  ×    101', '  --------', '      1011', '     0000 ', '    1011  ', '  --------', '    110111'], 2.6, 5.4, 0.5); S.M.ls.forEach((l, i) => { if (i > 2) l.element.style.visibility = 'hidden'; }); S.M.hl(-1); cap('長乘法：1011 × 101', '');
        },
  // 1814.3
  async (tok, S) => {
          S.M.ls[3].element.style.visibility = ''; S.M.hl(3); cap('乘 1：照抄 1011', '');
        },
  // 1823.4
  async (tok, S) => {
          S.M.ls[4].element.style.visibility = ''; S.M.hl(4); cap('乘 0：全部是 0', '');
        },
  // 1838.3
  async (tok, S) => {
          [5, 6, 7].forEach((i) => { S.M.ls[i].element.style.visibility = ''; }); S.M.hl(7); sm('左移 = 右邊補 0', 5.6, 3.4); cap('左移後相加 = 110111', '11 × 5 = 55');
        },
  // 1896.4
  async (tok, S) => {
          bub('長乘法、長除法 ≈ 多項式，但要處理進位', 0, -0.4); cap('和多項式的乘除很像', '多了進位');
        },
]);
scene('pfB-l10-euclid', "輾轉相除法的原理", CAM, [
  // 1957.1
  async (tok, S) => {
          S.lk = prop('lock', 5.4, 5.0, 0, 1.4); note('目標：會算 RSA', 5.4, 6.6); cap('目標：RSA', '先學數論工具');
        },
  // 1994
  async (tok, S) => {
          hd('Euclidean algorithm（輾轉相除法）', -2.4, 7.2); S.L = board(-3.0, 6.2, 0.75); cap('Euclid 演算法', '輾轉相除法');
        },
  // 2022.4
  async (tok, S) => {
          S.L.add('a = b · q + r'); S.L.last(); cap('a = bq + r', '');
        },
  // 2060.2
  async (tok, S) => {
          S.L.add('gcd(a, b) = gcd(b, r)', 'ptr alt'); cap('gcd(a, b) = gcd(b, r)', '');
        },
  // 2072.6
  async (tok, S) => {
          S.x = buddy('a', 'a', FC.blue, 2.2, 1.0, 0, 1.0); S.y = buddy('b', 'b', FC.orange, 4.2, 1.0, 0, 0.8); S.r = buddy('r', 'r', FC.green, 6.0, 1.0, 0, 0.6); cap('(b, r) 比 (a, b) 小', '');
        },
  // 2127.9
  async (tok, S) => {
          S.L.add('重複到出現 0 → gcd = 另一個數'); S.L.last(); cap('一直縮小到 0', 'gcd 就是另一個數');
        },
  // 2157.1
  async (tok, S) => {
          S.R = board(3.6, 6.2, 0.75); S.R.add('證明：兩邊公因數相同'); S.R.last(); cap('證明：公因數一模一樣', '');
        },
  // 2204.9
  async (tok, S) => {
          S.R.add('設 c | a，c | b'); S.R.last(); cap('設 c | a、c | b', '只要再證 c | r');
        },
  // 2227.7
  async (tok, S) => {
          S.R.add('r = a − b · q'); S.R.last(); cap('r = a − bq', '');
        },
  // 2252.2
  async (tok, S) => {
          S.R.add('⇒ c | (a − bq) = r ✔', 'good'); S.R.last(); cap('c | r', '線性組合也被 c 整除');
        },
  // 2272.4
  async (tok, S) => {
          S.R.add('反向同理 ⇒ gcd 相同', 'good'); S.R.hi(-1); S.L.hi(-1); cap('反向同理', '公因數相同 ⇒ gcd 相同');
        },
]);
scene('pfB-l10-528', "gcd(528, 30)：528 → 30 → 18 → 12 → 6 → 0", CAM, [
  // 2298.7
  async (tok, S) => {
          S.x = buddy('x', '528', FC.blue, 2.6, 4.4, 0, 1.0); S.y = buddy('y', '30', FC.orange, 4.8, 4.4, 0, 1.0); S.L = board(-4.0, 6.6, 0.7); cap('gcd(528, 30) = ？', '');
        },
  // 2316.3
  async (tok, S) => {
          bub('大 ÷ 小 → 留下「小的」和「餘數」', 3.7, 6.8); cap('大的除以小的', '留小的和餘數');
        },
  // 2338.9
  async (tok, S) => {
          S.L.add('528 = 17·30 + 18'); S.L.last(); S.x.set('30'); S.y.set('18'); cap('528 = 17·30 + 18', '→ gcd(30, 18)');
        },
  // 2393.5
  async (tok, S) => {
          S.L.add('30 = 1·18 + 12'); S.L.last(); S.x.set('18'); S.y.set('12'); cap('30 = 1·18 + 12', '→ gcd(18, 12)');
        },
  // 2405.7
  async (tok, S) => {
          S.L.add('18 = 1·12 + 6'); S.L.last(); S.x.set('12'); S.y.set('6'); cap('18 = 1·12 + 6', '→ gcd(12, 6)');
        },
  // 2420
  async (tok, S) => {
          S.L.add('12 = 2·6 + 0'); S.L.last(); S.x.set('6'); S.y.set('0'); S.x.mood('happy'); good('gcd(528, 30) = 6', -4.0, 3.4); cap('12 = 2·6 + 0', 'gcd(528, 30) = 6');
        },
  // 2445.5
  async (tok, S) => {
          S.L.hi(-1); S.c = code(['procedure gcd(a, b)', 'x := a;  y := b', 'while y ≠ 0', '    r := x mod y', '    x := y', '    y := r', 'return x'], -4.0, 2.4, 0.56); S.c.hl(1); cap('x := a，y := b', '');
        },
  // 2469.4
  async (tok, S) => {
          S.c.hl(3); cap('r := x mod y', '');
        },
  // 2488.5
  async (tok, S) => {
          S.c.hl(4); await wt(tok, 300); S.c.hl(5); cap('x := y，y := r', '');
        },
  // 2499.7
  async (tok, S) => {
          S.c.hl(6); cap('y = 0 時回傳 x', '');
        },
]);
scene('pfB-l10-bezout', "6 = 2·528 − 35·30；1 = 12·528 − 181·35", CAM, [
  // 2512.8
  async (tok, S) => {
          S.E = board(-4.4, 6.6, 0.6); ['528 = 17·30 + 18', '30 = 1·18 + 12', '18 = 1·12 + 6', '12 = 2·6 + 0'].forEach((t) => S.E.add(t)); S.E.hi(-1); sm('（剛才的輾轉相除）', -4.4, 7.2); cap('3-7：沿用 gcd(528, 30)', '');
        },
  // 2529
  async (tok, S) => {
          hot('gcd(a, b) = s·a + t·b', 2.6, 7.0); cap('gcd(a, b) = sa + tb', 'Bézout 定理');
        },
  // 2554.5
  async (tok, S) => {
          pl('s · 528 + t · 30 = 6', 2.6, 6.2); cap('s·528 + t·30 = 6', '一定有整數解');
        },
  // 2577.3
  async (tok, S) => {
          S.up = arrow(V3(-1.8, 4.4, 0), V3(-1.8, 6.6, 0), 0xc08a1f); cap('把 Euclid 倒推回去', '');
        },
  // 2603.4
  async (tok, S) => {
          S.E.hi(2); cap('從 6 出現的那一行開始', '');
        },
  // 2632.8
  async (tok, S) => {
          S.R = board(2.6, 5.2, 0.66); S.R.add('6 = 18 − 1·12'); S.R.last(); cap('6 = 18 − 1·12', '');
        },
  // 2654.4
  async (tok, S) => {
          S.E.hi(1); S.R.add('= 18 − 1·(30 − 1·18)'); S.R.last(); cap('換掉 12 = 30 − 18', '');
        },
  // 2682.5
  async (tok, S) => {
          S.R.add('= 2·18 − 1·30'); S.R.last(); cap('= 2·18 − 30', '');
        },
  // 2697.5
  async (tok, S) => {
          S.E.hi(0); S.R.add('= 2·(528 − 17·30) − 1·30'); S.R.last(); cap('換掉 18 = 528 − 17·30', '');
        },
  // 2713.4
  async (tok, S) => {
          S.R.add('= 2·528 − 35·30', 'good'); S.R.last(); cap('6 = 2·528 − 35·30', '');
        },
  // 2742.6
  async (tok, S) => {
          S.R.hi(-1); good('s = 2，t = −35（1056 − 1050 = 6）', 2.6, 0.9); cap('s = 2，t = −35', '一定要會的技巧');
        },
  // 2770.9
  async (tok, S) => {
          gone(S.E, S.R, S.up); S.E = board(-4.4, 5.6, 0.62); hd('講義例：gcd(528, 35) = 1（互質）', -2.4, 6.6); cap('528 和 35 互質', 'gcd = 1');
        },
  // 2794.7
  async (tok, S) => {
          ['528 = 15·35 + 3', '35 = 11·3 + 2', '3 = 1·2 + 1'].forEach((t) => S.E.add(t)); S.E.hi(2); cap('528 = 15·35 + 3 …', '餘數出現 1 就停');
        },
  // 2810.3
  async (tok, S) => {
          S.R = board(2.6, 5.6, 0.62); ['1 = 3 − 1·2', '= 3 − (35 − 11·3) = 12·3 − 35', '= 12·(528 − 15·35) − 35'].forEach((t) => S.R.add(t)); S.R.add('= 12·528 − 181·35', 'good'); S.R.hi(-1); cap('1 = 12·528 − 181·35', '6336 − 6335 = 1');
        },
]);
scene('pfB-l10-lemma', "互質時 a | bc ⇒ a | c", CAM, [
  // 2831.3
  async (tok, S) => {
          S.L = board(-3.6, 6.6, 0.72); S.L.add('gcd(a, b) = 1，a | bc'); S.L.last(); cap('gcd(a, b) = 1 且 a | bc', '');
        },
  // 2856.9
  async (tok, S) => {
          S.L.add('⇒ a | c ？', 'note'); cap('結論：a | c', '');
        },
  // 2867.4
  async (tok, S) => {
          S.R = board(3.0, 6.6, 0.72); S.R.add('s·a + t·b = 1'); S.R.last(); cap('sa + tb = 1', 'Bézout');
        },
  // 2883.1
  async (tok, S) => {
          S.R.add('s·a·c + t·b·c = c'); S.R.last(); cap('兩邊乘 c', 'sac + tbc = c');
        },
  // 2893.4
  async (tok, S) => {
          S.R.add('s·a·c：a 的倍數'); S.R.last(); cap('sac 是 a 的倍數', '');
        },
  // 2920.4
  async (tok, S) => {
          S.R.add('t·(bc)：a | bc → a 的倍數'); S.R.last(); cap('tbc 也是 a 的倍數', '因為 a | bc');
        },
  // 2927.7
  async (tok, S) => {
          S.R.add('⇒ c 是 a 的倍數：a | c ✔', 'good'); S.R.hi(-1); S.L.hi(-1); cap('a | c 得證', '');
        },
  // 2941.1
  async (tok, S) => {
          note('預告：mod 的消去律、倒數', -3.6, 4.0); cap('預告：消去律與倒數', '');
        },
  // 2976.3
  async (tok, S) => {
          hot('p 質數，p | a₁a₂⋯aₙ ⇒ p | 某個 aᵢ', -1.0, 1.6); cap('推廣到質數 p', 'p 至少整除其中一個');
        },
]);
scene('pfB-l10-cancel', "ac ≡ bc (mod m)，gcd(c, m) = 1 ⇒ a ≡ b", CAM, [
  // 3003.2
  async (tok, S) => {
          hd('mod 的消去律', -3.6, 7.2); S.L = board(-3.6, 6.4, 0.72); cap('mod 裡的消去律', '不是都能消');
        },
  // 3021.6
  async (tok, S) => {
          S.L.add('a·c ≡ b·c (mod m)'); S.L.last(); cap('ac ≡ bc (mod m)', '');
        },
  // 3045
  async (tok, S) => {
          S.L.add('能直接消掉 c 嗎？ ✘', 'bad'); cap('不能隨便消 c', '');
        },
  // 3072.3
  async (tok, S) => {
          S.R = board(3.4, 6.4, 0.72); S.R.add('示意：2·2 ≡ 2·5 (mod 6)', 'idx'); S.R.add('但 2 ≢ 5 (mod 6) ✘', 'bad'); cap('反例：4 ≡ 10 (mod 6)', '但 2 ≢ 5');
        },
  // 3078.1
  async (tok, S) => {
          S.L.add('若 gcd(c, m) = 1 ⇒ a ≡ b (mod m)', 'good'); S.L.last(); cap('c、m 互質才能消', '');
        },
  // 3105
  async (tok, S) => {
          S.R.clear(); S.R.add('m | ac − bc = (a − b)·c'); S.R.last(); cap('m | (a − b)c', '');
        },
  // 3117.9
  async (tok, S) => {
          S.R.add('gcd(c, m) = 1 ⇒ m | (a − b) ✔', 'good'); S.R.hi(-1); cap('引理 ⇒ m | (a − b)', 'a ≡ b (mod m)');
        },
  // 3133.6
  async (tok, S) => {
          S.L.hi(-1); hot('消去 = 除法 = 乘上反元素', 0, 1.6); cap('消去律就是除法', '用反元素來看');
        },
  // 3149.9
  async (tok, S) => {
          pl('÷ 3 = × 1/3，÷ 5 = × 1/5', 0, 0.8); cap('除以 3 = 乘 1/3', '');
        },
  // 3189
  async (tok, S) => {
          good('兩邊乘 c⁻¹：c · c⁻¹ ≡ 1 → 消失', 0, 0.0); cap('兩邊乘 c⁻¹', 'c 就消掉了');
        },
]);
scene('pfB-l10-inverse', "gcd(a, m) = 1 ⇒ 存在 a⁻¹ (mod m)", CAM, [
  // 3230.2
  async (tok, S) => {
          S.L = board(-3.0, 6.6, 0.75); S.L.add('若 gcd(a, m) = 1'); S.L.last(); cap('a、m 互質', '');
        },
  // 3245.9
  async (tok, S) => {
          S.L.add('⇒ ∃b：a · b ≡ 1 (mod m)'); S.L.last(); cap('∃b：ab ≡ 1 (mod m)', '');
        },
  // 3264.4
  async (tok, S) => {
          S.L.add('b = a⁻¹（mod m 的倒數）', 'ptr alt'); cap('b = a⁻¹', '模反元素');
        },
  // 3273
  async (tok, S) => {
          bad('mod m 不能丟', 3.6, 6.0); cap('mod m 一定要寫', '');
        },
  // 3307.7
  async (tok, S) => {
          S.L.hi(-1); hd('怎麼找？', 3.6, 4.6); cap('怎麼找倒數？', '');
        },
  // 3326.6
  async (tok, S) => {
          S.R = board(3.6, 3.8, 0.75); S.R.add('s·a + t·m = 1'); S.R.last(); cap('sa + tm = 1', '');
        },
  // 3347.6
  async (tok, S) => {
          S.R.add('⇒ s·a ≡ 1 (mod m)'); S.R.last(); cap('mod m：t·m 消失', 's·a ≡ 1 (mod m)');
        },
  // 3388.9
  async (tok, S) => {
          S.R.add('s = a⁻¹ ✔', 'good'); S.R.hi(-1); cap('s 就是 a⁻¹', '');
        },
]);
scene('pfB-l10-inv5', "5⁻¹ ≡ −1 ≡ 2 (mod 3)", CAM, [
  // 3416.9
  async (tok, S) => {
          S.L = board(-3.6, 6.6, 0.68); cap('來算一個例子', '');
        },
  // 3421.6
  async (tok, S) => {
          S.L.add('a = 5，m = 3'); S.L.last(); S.five = buddy('a', '5', FC.blue, 3.4, 4.2, 0, 1.0); cap('a = 5，m = 3', '');
        },
  // 3441.6
  async (tok, S) => {
          S.L.add('gcd(5, 3) = 1 ✔'); S.L.last(); cap('gcd(5, 3) = 1', '倒數存在');
        },
  // 3473
  async (tok, S) => {
          S.L.add('求 s：5 · s ≡ 1 (mod 3)', 'ptr alt'); cap('求 5s ≡ 1 (mod 3)', '');
        },
  // 3528.8
  async (tok, S) => {
          S.L.add('⇔ 求 s·5 + t·3 = 1'); S.L.last(); cap('解 5s + 3t = 1', '');
        },
  // 3541.1
  async (tok, S) => {
          S.R = board(3.4, 2.8, 0.62); S.R.add('5 = 1·3 + 2'); S.R.add('3 = 1·2 + 1'); S.R.hi(-1); cap('gcd(5,3) → gcd(3,2) → gcd(2,1)', '');
        },
  // 3568.8
  async (tok, S) => {
          S.L.hi(-1); S.R.hi(1); S.B = board(-3.6, 2.6, 0.62); S.B.add('1 = 3 − 1·2'); S.B.last(); cap('1 = 3 − 1·2', '');
        },
  // 3572.4
  async (tok, S) => {
          S.R.hi(0); cap('2 = 5 − 1·3', '');
        },
  // 3590.4
  async (tok, S) => {
          S.B.add('= 3 − (5 − 1·3) = 2·3 − 1·5'); S.B.last(); cap('1 = 2·3 − 1·5', '');
        },
  // 3620.2
  async (tok, S) => {
          S.B.add('⇒ 5⁻¹ ≡ −1 (mod 3)'); S.B.last(); cap('5⁻¹ ≡ −1 (mod 3)', '');
        },
  // 3641.2
  async (tok, S) => {
          S.B.add('≡ −1 + 3 = 2', 'good'); S.B.last(); S.five.set('5⁻¹=2'); cap('−1 + 3 = 2', '5⁻¹ ≡ 2 (mod 3)');
        },
  // 3654.9
  async (tok, S) => {
          S.five.mood('happy'); good('5 · 2 = 10，10 mod 3 = 1 ✔', 3.4, 6.4); cap('驗算：10 mod 3 = 1', '');
        },
  // 3683.8
  async (tok, S) => {
          S.B.hi(-1); note('mod 運算用 =；同餘關係用 ≡', 3.4, 3.65); cap('= 和 ≡ 意義不同', '');
        },
  // 3732.6
  async (tok, S) => {
          bad('不互質 → 沒有倒數', 3.4, 0.4); cap('只有互質才有倒數', '');
        },
]);
scene('pfB-l10-invex', "倒數的例子：mod 3、mod 6、mod 9", CAM, [
  // 3755.6
  async (tok, S) => {
          S.L = board(-3.6, 6.6, 0.68); S.L.add('7 · 5⁻¹ (mod 3) = ？'); S.L.last(); cap('7·5⁻¹ (mod 3) = ？', '');
        },
  // 3779.5
  async (tok, S) => {
          S.L.add('5⁻¹ 換成 2（不是 1/5）'); S.L.last(); cap('5⁻¹ 換成 2', '不是 1/5');
        },
  // 3812.3
  async (tok, S) => {
          S.L.add('7 · 2 = 14 ≡ 2 (mod 3)', 'good'); S.L.last(); cap('14 ≡ 2 (mod 3)', '');
        },
  // 3830.9
  async (tok, S) => {
          S.L.hi(-1); sm('乘一個特別的數，帶有「除法」的味道', -3.6, 4.4); cap('是乘法，不是除法', '');
        },
  // 3871.4
  async (tok, S) => {
          bad('只有互質才有倒數', -3.6, 3.7); cap('只有互質才有倒數', '');
        },
  // 3906.6
  async (tok, S) => {
          S.R = board(3.4, 6.6, 0.68); S.R.add('mod 6：gcd(5, 6) = 1 ✔'); S.R.last(); S.c6 = [0, 1, 2, 3, 4, 5].map((v, i) => bx(String(v), v === 5 ? FC.green : FC.sand, 1.2 + i * 0.85, 3.0, 0, 0.6, 0.6, 0.6)); cap('mod 6 裡的 5', '和 6 互質');
        },
  // 3931.3
  async (tok, S) => {
          S.R.add('5 ≡ −1 ⇒ 5⁻¹ = 5'); S.R.last(); cap('5 ≡ −1 (mod 6)', '(−1)(−1) = 1 ⇒ 5⁻¹ = 5');
        },
  // 3975.4
  async (tok, S) => {
          S.R.add('5 · 5 = 25 ≡ 1 (mod 6) ✔', 'good'); S.R.last(); glow(S.c6[5], OKG); cap('25 ≡ 1 (mod 6)', '');
        },
  // 3999.6
  async (tok, S) => {
          [2, 3, 4].forEach((i) => tint(S.c6[i], FC.red)); S.R.add('2、3、4：和 6 不互質 ✘', 'bad'); cap('2、3、4 都和 6 不互質', '');
        },
  // 4026.3
  async (tok, S) => {
          S.R.add('2⁻¹ (mod 6) 不存在'); S.R.last(); cap('2⁻¹ (mod 6) 不存在', '');
        },
  // 4046.8
  async (tok, S) => {
          gone(S.c6); S.R.hi(-1); S.N = board(3.4, 2.4, 0.66); S.N.add('mod 9，a = 2'); S.N.last(); cap('mod 9，a = 2', '');
        },
  // 4052.6
  async (tok, S) => {
          S.N.add('2 · 5 = 10 ≡ 1 ⇒ 2⁻¹ = 5，5⁻¹ = 2', 'good'); S.N.last(); cap('2·5 = 10 ≡ 1 (mod 9)', '2⁻¹ = 5、5⁻¹ = 2');
        },
  // 4099.6
  async (tok, S) => {
          S.N.add('gcd(6, 9) = 3 ⇒ 6⁻¹ 不存在', 'bad'); cap('6 在 mod 9 沒有倒數', 'gcd(6, 9) = 3');
        },
]);
scene('pfB-l10-crtintro', "韓信點兵：x ≡ 1 (mod 3)、x ≡ 2 (mod 5)", CAM, [
  // 4121.8
  async (tok, S) => {
          S.sold = []; for (let i = 0; i < 3; i++) S.sold.push(buddy('', '', [FC.blue, FC.orange, FC.green][i], -5.4 + i * 1.1, 4.6, 0, 0.6)); S.L = board(-0.6, 6.6, 0.68); S.L.add('3 個一數剩 1、5 個剩 1、7 個剩 1'); S.L.last(); cap('韓信點兵', '3、5、7 個一數都剩 1');
        },
  // 4140.9
  async (tok, S) => {
          S.L.add('x = 105k + 1'); S.L.last(); cap('3·5·7 的倍數 + 1', '');
        },
  // 4146.4
  async (tok, S) => {
          S.L.add('都差 1：x = 105k − 1'); S.L.last(); cap('都差 1 → 倍數 − 1', '');
        },
  // 4165
  async (tok, S) => {
          S.L.hi(-1); hd('中國餘數定理', -4.2, 2.8); cap('中國餘數定理', '');
        },
  // 4177.9
  async (tok, S) => {
          note('除數兩兩互質（3、5、7）', -4.2, 2.0); cap('3、5、7 兩兩互質', '基本要件');
        },
  // 4234.4
  async (tok, S) => {
          S.L.add('x ≡ aᵢ (mod mᵢ)', 'ptr alt'); cap('x ≡ aᵢ (mod mᵢ)', '剩多少 = 餘數');
        },
  // 4251.1
  async (tok, S) => {
          S.L.add('答案 = (m₁m₂⋯) 的倍數 + 某個數'); S.L.last(); cap('找出那個「餘數」', '');
        },
  // 4281.7
  async (tok, S) => {
          gone(S.sold); S.L.hi(-1); S.R = board(3.6, 2.6, 0.62); S.R.add('x ≡ 1 (mod 3)'); S.R.add('x ≡ 2 (mod 5)'); S.R.hi(-1); cap('x ≡ 1 (mod 3)、x ≡ 2 (mod 5)', '');
        },
  // 4298
  async (tok, S) => {
          S.R.add('x = 15k + ？'); S.R.last(); cap('x = 15k + ？', '');
        },
  // 4317
  async (tok, S) => {
          S.tr = [1, 4, 7].map((v, i) => bx(String(v), v === 7 ? FC.green : FC.gray, -0.8 + i * 1.0, -0.4, 0, 0.6, 0.6, 0.6)); sm('除 3 餘 1：1、4、7…', 0.2, -1.2); cap('湊：1、4、7', '7 除 5 餘 2 ✔');
        },
  // 4351.8
  async (tok, S) => {
          S.R.add('x ≡ 7 (mod 15)', 'good'); S.R.last(); cap('x ≡ 7 (mod 15)', '');
        },
  // 4369.1
  async (tok, S) => {
          S.R.add('+ x ≡ 3 (mod 7) ⇒ x ≡ ？ (mod 105)', 'note'); cap('三個條件：mod 105', '要有系統的方法');
        },
]);
scene('pfB-l10-crt', "CRT：x ≡ 1, 2, 3 (mod 3, 5, 7) ⇒ x ≡ 52 (mod 105)", CAM, [
  // 4417.5
  async (tok, S) => {
          hd('系統解法', -4.6, 7.2); S.E = board(-4.6, 6.4, 0.62); ['x ≡ 1 (mod 3)', 'x ≡ 2 (mod 5)', 'x ≡ 3 (mod 7)'].forEach((t) => S.E.add(t)); S.E.hi(-1); cap('三個同餘式', '');
        },
  // 4429.5
  async (tok, S) => {
          S.T = []; const cols = ['i', 'aᵢ', 'mᵢ', 'Mᵢ', 'yᵢ']; cols.forEach((c, j) => S.T.push(hd(c, 0.2 + j * 1.4, 6.6)));
          S.cell = {}; [[1, 1, 3], [2, 2, 5], [3, 3, 7]].forEach((r, i) => r.forEach((v, j) => { S.cell[i + ',' + j] = bx(String(v), FC.sand, 0.2 + j * 1.4, 5.8 - i * 0.8, 0, 0.9, 0.6, 0.5); }));
          cap('aᵢ：餘數，mᵢ：除數', '');
        },
  // 4450.4
  async (tok, S) => {
          note('3、5、7 兩兩互質 ✔', -4.6, 4.4); cap('兩兩互質', '');
        },
  // 4456
  async (tok, S) => {
          S.F = board(-4.6, 3.6, 0.62); S.F.add('Mᵢ = m / mᵢ'); S.F.last(); cap('Mᵢ = m / mᵢ', '');
        },
  // 4477
  async (tok, S) => {
          S.F.add('m = 3·5·7 = 105'); S.F.last(); S.cell['0,3'] = bx('35', FC.sky, 0.2 + 3 * 1.4, 5.8, 0, 0.9, 0.6, 0.5); cap('m = 105，M₁ = 35', '= 5 × 7');
        },
  // 4497
  async (tok, S) => {
          S.cell['1,3'] = bx('21', FC.sky, 0.2 + 3 * 1.4, 5.0, 0, 0.9, 0.6, 0.5); S.cell['2,3'] = bx('15', FC.sky, 0.2 + 3 * 1.4, 4.2, 0, 0.9, 0.6, 0.5); cap('M₂ = 21，M₃ = 15', '');
        },
  // 4511.4
  async (tok, S) => {
          S.F.add('Mᵢ · yᵢ ≡ 1 (mod mᵢ)', 'ptr alt'); cap('yᵢ = Mᵢ⁻¹ (mod mᵢ)', '');
        },
  // 4571.6
  async (tok, S) => {
          S.F.add('Mᵢ 和 mᵢ 互質 → 倒數存在'); S.F.last(); cap('Mᵢ 和 mᵢ 互質', '所以 yᵢ 存在');
        },
  // 4643.2
  async (tok, S) => {
          S.F.hi(-1); S.cell['0,4'] = bx('2', FC.green, 0.2 + 4 * 1.4, 5.8, 0, 0.9, 0.6, 0.5); sm('35 ≡ 2，2·2 = 4 ≡ 1 (mod 3)', 3.0, 3.3); cap('y₁ = 2', '35 ≡ 2，2·2 ≡ 1 (mod 3)');
        },
  // 4711.6
  async (tok, S) => {
          S.cell['1,4'] = bx('1', FC.green, 0.2 + 4 * 1.4, 5.0, 0, 0.9, 0.6, 0.5); sm('21 ≡ 1 (mod 5)', 3.0, 2.7); cap('y₂ = 1', '21 ≡ 1 (mod 5)');
        },
  // 4753
  async (tok, S) => {
          S.cell['2,4'] = bx('1', FC.green, 0.2 + 4 * 1.4, 4.2, 0, 0.9, 0.6, 0.5); sm('15 ≡ 1 (mod 7)', 3.0, 2.1); cap('y₃ = 1', '15 ≡ 1 (mod 7)');
        },
  // 4786.6
  async (tok, S) => {
          S.X = board(1.6, 1.2, 0.62); S.X.add('x ≡ Σ aᵢ · Mᵢ · yᵢ (mod m)', 'ptr alt'); cap('x = Σ aᵢMᵢyᵢ', '');
        },
  // 4814
  async (tok, S) => {
          S.X.add('= 1·35·2 + 2·21·1 + 3·15·1'); S.X.last(); cap('= 1·35·2 + 2·21·1 + 3·15·1', 'Mᵢ 照抄');
        },
  // 4839.6
  async (tok, S) => {
          S.X.add('= 70 + 42 + 45 = 157'); S.X.last(); cap('70 + 42 + 45 = 157', '');
        },
  // 4862.1
  async (tok, S) => {
          S.X.add('157 mod 105 = 52 ⇒ x ≡ 52 (mod 105)', 'good'); S.X.last(); cap('x ≡ 52 (mod 105)', '52 = 3·17+1 = 5·10+2 = 7·7+3');
        },
  // 4926.7
  async (tok, S) => {
          S.X.hi(-1); S.T.forEach((l) => { l.element.className = 'lab-label ptr alt'; }); cap('列表幫助記憶', '這題會考');
        },
  // 4956.4
  async (tok, S) => {
          S.T.forEach((l) => { l.element.className = 'lab-label ptr'; }); tint(S.cell['1,3'], FC.gray); tint(S.cell['2,3'], FC.gray); cap('除以 m₁：第 2、3 項整除', '');
        },
  // 5014.6
  async (tok, S) => {
          glow(S.cell['0,3'], HL); glow(S.cell['0,4'], HL); good('x ≡ a₁·1 = a₁ (mod m₁)', -4.6, 0.2); cap('只剩 a₁·M₁y₁ ≡ a₁', '');
        },
  // 5042.8
  async (tok, S) => {
          tint(S.cell['1,3'], FC.sky); tint(S.cell['2,3'], FC.sky); cap('除 m₂ 剩 a₂，除 m₃ 剩 a₃', '');
        },
  // 5096.2
  async (tok, S) => {
          bad('unique（唯一）還沒證！', -4.6, 1.0); cap('唯一性還沒證', '自己想想');
        },
  // 5155.1
  async (tok, S) => {
          hot('一般：k = 1…n，x ≡ Σ aₖMₖyₖ (mod m)', 0.6, -2.0); cap('推廣到 n 個式子', '');
        },
]);

// ════════ IlMZbpJW1ek（交大OCW 易志偉《離散數學》Lec11 Algorithms and the Integers (4/4) / Induction and Recur (1/4)） ════════
scene('pfB-l11-review', "CRT 步驟：m → Mᵢ → yᵢ → Σ aᵢMᵢyᵢ", CAM, [
  // 7.1
  async (tok, S) => {
          S.L = board(-3.4, 6.6, 0.8); hd('中國餘數定理：四個步驟', 2.6, 7.2); cap('CRT 解題步驟', '');
        },
  // 14
  async (tok, S) => {
          S.L.add('① m = m₁ · m₂ · m₃'); S.L.last(); cap('① m = m₁m₂m₃', '');
        },
  // 26.3
  async (tok, S) => {
          S.L.add('② M₁ = 5·7，M₂ = 3·7，M₃ = 3·5'); S.L.last(); cap('② Mᵢ = 除了 mᵢ 的其他乘積', '');
        },
  // 48.3
  async (tok, S) => {
          S.L.add('③ yᵢ = Mᵢ⁻¹ (mod mᵢ)'); S.L.last(); cap('③ yᵢ：Mᵢ 在 mod mᵢ 的倒數', '');
        },
  // 71.3
  async (tok, S) => {
          sm('數字大 → Euclid 倒推求倒數', -3.4, 3.0); cap('數字大就用 Euclid 倒推', '');
        },
  // 99.3
  async (tok, S) => {
          S.L.add('④ x ≡ Σ aᵢ Mᵢ yᵢ (mod m)', 'good'); S.L.last(); cap('④ x = Σ aᵢMᵢyᵢ', '');
        },
]);
scene('pfB-l11-noncop', "x ≡ 2 (mod 15) 拆成 mod 3 與 mod 5", CAM, [
  // 109.1
  async (tok, S) => {
          hd('除數不互質怎麼辦？', -3.4, 7.2); S.L = board(-3.4, 6.2, 0.66); cap('除數不互質怎麼辦？', '');
        },
  // 143.2
  async (tok, S) => {
          ['x ≡ 2 (mod 3)', 'x ≡ 3 (mod 5)', 'x ≡ 2 (mod 15)'].forEach((t) => S.L.add(t)); S.L.hi(2); cap('第三式改成 x ≡ 2 (mod 15)', '');
        },
  // 173.2
  async (tok, S) => {
          bad('15 和 3、5 都不互質', 2.8, 5.4); cap('15 和 3、5 不互質', '');
        },
  // 201.4
  async (tok, S) => {
          S.f = pl('15 = 3 × 5', 2.8, 4.6); cap('15 = 3 × 5', '');
        },
  // 235.2
  async (tok, S) => {
          S.R = board(2.8, 3.8, 0.62); S.R.add('x ≡ 2 (mod 15)'); S.R.add('⇔ x ≡ 2 (mod 3) 且 x ≡ 2 (mod 5)', 'ptr alt'); cap('x ≡ 2 (mod 15)', '⇔ x ≡ 2 (mod 3) 且 x ≡ 2 (mod 5)');
        },
  // 270.4
  async (tok, S) => {
          S.L.clear(); ['x ≡ 2 (mod 3)', 'x ≡ 3 (mod 5)', 'x ≡ 2 (mod 3)', 'x ≡ 2 (mod 5)'].forEach((t) => S.L.add(t)); S.L.hi(-1); cap('換成四個式子', '');
        },
  // 329.9
  async (tok, S) => {
          S.L.ls[2].element.className = 'lab-label lab-dim'; S.L.ls[2].userData.base = 'lab-dim'; sm('重複 → 刪掉', -0.6, 4.9); cap('重複的刪掉', '');
        },
  // 343.6
  async (tok, S) => {
          S.L.ls[1].element.className = 'lab-label bad'; S.L.ls[3].element.className = 'lab-label bad'; bad('mod 5 餘 3 又餘 2：矛盾', -3.4, 3.0); cap('矛盾 contradiction', '');
        },
  // 364.9
  async (tok, S) => {
          hot('⇒ 無解', -3.4, 2.2); cap('答案：無解', '');
        },
  // 383.6
  async (tok, S) => {
          gone(S.R, S.f); S.N = board(2.8, 5.0, 0.62); S.N.add('改成 x ≡ 8 (mod 15)？'); S.N.last(); S.tr = [2, 5, 8, 11].map((v, i) => bx(String(v), v === 8 ? FC.green : FC.gray, 1.6 + i * 0.9, 6.0, 0, 0.6, 0.6, 0.6)); cap('改成 8 試試', '');
        },
  // 412.5
  async (tok, S) => {
          S.N.add('8 ≡ 2 (mod 3)，8 ≡ 3 (mod 5)'); S.N.last(); cap('8 ≡ 2 (mod 3)，8 ≡ 3 (mod 5)', '');
        },
  // 425.4
  async (tok, S) => {
          S.N.add('和原題相同 → 相容 ✔', 'good'); S.N.add('（補算）x ≡ 8 (mod 15)', 'idx'); S.N.hi(-1); cap('條件相容', '補算：x ≡ 8 (mod 15)');
        },
]);
scene('pfB-l11-noncop2', "不互質的除數：拆解、刪重複、保留 mod 4", CAM, [
  // 446.8
  async (tok, S) => {
          hd('再一例（數字依推理重建・示意）', -2.0, 7.2); S.L = board(-4.2, 6.3, 0.62); ['x ≡ 5 (mod 6)', 'x ≡ 10 (mod 30)', 'x ≡ 3 (mod 4)'].forEach((t) => S.L.add(t)); S.L.hi(-1); cap('再一例：有解還是無解？', '');
        },
  // 452.4
  async (tok, S) => {
          bad('6、30、4 都不互質', -4.2, 4.1); cap('除數都不互質', '');
        },
  // 464.6
  async (tok, S) => {
          S.R = board(2.4, 6.3, 0.62); cap('因數分解來化簡', '');
        },
  // 472.2
  async (tok, S) => {
          S.L.hi(0); S.R.add('mod 6 → x ≡ 1 (mod 2)，x ≡ 2 (mod 3)'); S.R.last(); cap('6 = 2·3', 'x ≡ 1 (mod 2)，x ≡ 2 (mod 3)');
        },
  // 492.9
  async (tok, S) => {
          S.L.hi(1); S.R.add('mod 30 → x ≡ 0 (mod 2)，≡ 1 (mod 3)，≡ 0 (mod 5)'); S.R.last(); cap('30 = 2·3·5', '');
        },
  // 542
  async (tok, S) => {
          S.L.hi(-1); S.bd = bad('mod 2：餘 1 vs 餘 0 → 矛盾，無解', -4.2, 2.6); cap('mod 2 矛盾 ⇒ 無解', '');
        },
  // 552
  async (tok, S) => {
          S.R.hi(1); cap('調整數字讓它有解', '以 mod 30 那條為準');
        },
  // 590.8
  async (tok, S) => {
          S.L.ls[0].element.textContent = 'x ≡ 4 (mod 6)'; S.L.hi(0); gone(S.bd); S.R.clear(); S.R.add('mod 6 → x ≡ 0 (mod 2)，x ≡ 1 (mod 3)'); S.R.last(); cap('改成 x ≡ 4 (mod 6)', '');
        },
  // 604.3
  async (tok, S) => {
          sm('和 mod 30 的條件重複 → 多餘', -4.2, 2.6); cap('mod 6 那條多餘', '');
        },
  // 627.6
  async (tok, S) => {
          S.L.hi(1); S.R.add('mod 30 → x ≡ 0 (mod 5)，x ≡ 4 (mod 6)'); S.R.last(); cap('30 = 5 × 6（互質）', '');
        },
  // 664.1
  async (tok, S) => {
          S.L.ls[0].element.className = 'lab-label lab-dim'; S.L.ls[0].userData.base = 'lab-dim'; cap('一眼看出重複', '');
        },
  // 683.2
  async (tok, S) => {
          S.R.add('mod 6 → x ≡ 0 (mod 2)，x ≡ 1 (mod 3)'); S.R.last(); cap('6 = 2·3 再拆', '');
        },
  // 717.1
  async (tok, S) => {
          S.L.hi(2); bad('4 = 2 × 2：拆不成互質', -4.2, 3.4); cap('4 = 2 × 2 拆不開', '');
        },
  // 736.4
  async (tok, S) => {
          S.R.add('x ≡ 3 (mod 4) ⇒ x ≡ 1 (mod 2) ✘ 矛盾', 'bad'); cap('mod 4 推出 mod 2 餘 1', '又矛盾 → 無解');
        },
  // 786.5
  async (tok, S) => {
          S.L.ls[2].element.textContent = 'x ≡ 2 (mod 4)'; S.R.add('改 x ≡ 2 (mod 4) ⇒ x ≡ 0 (mod 2) ✔', 'good'); cap('改成 x ≡ 2 (mod 4)', '沒有矛盾');
        },
  // 813.2
  async (tok, S) => {
          S.R.hi(-1); note('mod 4 比 mod 2 嚴格', 2.4, 0.6); cap('mod 4 比較嚴格', '');
        },
  // 854.2
  async (tok, S) => {
          sm('mod 2 只用來檢查，算答案留 mod 4', 2.4, -0.1); cap('留 mod 4，丟 mod 2', '');
        },
  // 909.2
  async (tok, S) => {
          hot('x ≡ 2 (mod 4)，≡ 1 (mod 3)，≡ 0 (mod 5) → mod 60', -2.0, -1.0); good('（補算）x ≡ 10 (mod 60)', -2.0, -1.8); cap('4、3、5 互質 → mod 60', '補算：x ≡ 10');
        },
  // 930.5
  async (tok, S) => {
          S.L.hi(-1); bub('拆開 → 檢查矛盾 → 刪重複、留嚴格', 2.4, 7.0); cap('拆開、檢查、留嚴格', '');
        },
]);
scene('pfB-l11-fermat', "費馬小定理：10⁶ ≡ 1 (mod 7)", CAM, [
  // 1012.6
  async (tok, S) => {
          hd('費馬小定理', -3.6, 7.2); S.L = board(-3.6, 6.3, 0.66); cap('費馬小定理', 'RSA 之前的工具');
        },
  // 1021.4
  async (tok, S) => {
          S.L.add('p 質數，a 不是 p 的倍數'); S.L.last(); cap('p 質數、p ∤ a', '');
        },
  // 1045.1
  async (tok, S) => {
          S.L.add('a^(p−1) ≡ 1 (mod p)', 'ptr alt'); cap('a^(p−1) ≡ 1 (mod p)', '');
        },
  // 1057.9
  async (tok, S) => {
          S.L.add('例：p = 7，a = 10'); S.L.last(); cap('p = 7，a = 10', '');
        },
  // 1068.2
  async (tok, S) => {
          S.L.add('10⁶ ≡ 1 (mod 7)？'); S.L.last(); cap('10⁶ 除以 7 餘 1？', '');
        },
  // 1110.2
  async (tok, S) => {
          S.L.add('1000000 = 7 · 142857 + 1 ✔', 'good'); S.L.last(); cap('1000000 = 7·142857 + 1', '真的餘 1');
        },
  // 1144.1
  async (tok, S) => {
          S.L.hi(-1); hd('為什麼？', 3.4, 7.2); cap('為什麼會這樣？', '');
        },
  // 1172.5
  async (tok, S) => {
          S.top = [0, 1, 2, 3, 4, 5, 6].map((v, i) => bx(String(v), FC.sand, 0.6 + i * 0.9, 6.0, 0, 0.65, 0.65, 0.65)); sm('mod 7 的餘數', 3.3, 6.8); cap('mod 7：7 種餘數', '');
        },
  // 1186.5
  async (tok, S) => {
          kill(S.top[0]); S.top.shift(); cap('拿掉 0：剩 1～6', '');
        },
  // 1201.7
  async (tok, S) => {
          note('6 個數 ↔ 指數 6 = p − 1', 3.3, 4.9); cap('6 個數 = p − 1', '');
        },
  // 1213.5
  async (tok, S) => {
          S.bot = [1, 2, 3, 4, 5, 6].map((v, i) => bx(v + '·10', FC.lilac, 1.5 + i * 0.9, 3.8, 0, 0.8, 0.6, 0.6)); cap('每個都乘 10', '');
        },
  // 1238
  async (tok, S) => {
          sm('gcd(10, 7) = 1 → 10 有倒數', 3.3, 3.0); cap('10 和 7 互質', '有倒數');
        },
  // 1267.8
  async (tok, S) => {
          cap('乘 10 之後仍然兩兩不同', '');
        },
  // 1285.1
  async (tok, S) => {
          S.L.clear(); S.L.add('a ≢ b ⇒ a·10 ≢ b·10 (mod 7)'); S.L.last(); cap('a ≢ b ⇒ a·10 ≢ b·10', '因為能消去');
        },
  // 1314.4
  async (tok, S) => {
          relabel(S.bot[0], '3'); relabel(S.bot[1], '6'); relabel(S.bot[5], '4'); [0, 1, 5].forEach((i) => tint(S.bot[i], FC.mint)); cap('10→3、20→6、60→4', '');
        },
  // 1341.9
  async (tok, S) => {
          relabel(S.bot[2], '2'); relabel(S.bot[3], '5'); relabel(S.bot[4], '1'); [2, 3, 4].forEach((i) => tint(S.bot[i], FC.mint)); cap('30→2、40→5、50→1', '六個都不同');
        },
  // 1373.7
  async (tok, S) => {
          for (let i = 0; i < 6; i++) glow(S.top[i], OKG), glow(S.bot[i], OKG); hot('重排 permutation', 3.3, 2.3); cap('只是重新排列', 'permutation');
        },
  // 1385
  async (tok, S) => {
          S.L.add('1·2·3·4·5·6 ≡ (1·10)(2·10)⋯(6·10)'); S.L.last(); cap('全部乘起來', '餘數相等');
        },
  // 1426
  async (tok, S) => {
          S.L.add('6! ≡ 6! · 10⁶ (mod 7)'); S.L.last(); cap('6! ≡ 6!·10⁶ (mod 7)', '');
        },
  // 1452.3
  async (tok, S) => {
          S.L.add('消去 6! ⇒ 10⁶ ≡ 1 (mod 7) ✔', 'good'); S.L.last(); cap('消去 6!', '10⁶ ≡ 1 (mod 7)');
        },
  // 1464.6
  async (tok, S) => {
          S.L.add('一般：a^(p−1) ≡ 1 (mod p)', 'ptr alt'); cap('換成 p、a 也成立', '');
        },
  // 1482.4
  async (tok, S) => {
          S.L.hi(-1); bub('關鍵：乘 a 造成重排', 3.3, 1.4); cap('轉折點：重排', '');
        },
]);
scene('pfB-l11-fermat2', "對所有整數：a^p ≡ a (mod p)", CAM, [
  // 1527.9
  async (tok, S) => {
          S.L = board(-3.4, 6.6, 0.72); S.L.add('對所有整數 a：a^p ≡ a (mod p)', 'ptr alt'); cap('放寬：a^p ≡ a (mod p)', '');
        },
  // 1553.6
  async (tok, S) => {
          S.L.add('情況一：p ∤ a；情況二：p | a'); S.L.last(); cap('只有兩種情況', '');
        },
  // 1566.4
  async (tok, S) => {
          S.R = board(3.4, 4.6, 0.72); S.R.add('p ∤ a：a^(p−1) ≡ 1 → × a → a^p ≡ a ✔'); S.R.last(); cap('情況一：兩邊乘 a', '');
        },
  // 1593.6
  async (tok, S) => {
          S.R.add('p | a：a^p ≡ 0 ≡ a ✔'); S.R.last(); cap('情況二：兩邊都 ≡ 0', '');
        },
  // 1631.6
  async (tok, S) => {
          S.R.hi(-1); S.L.hi(-1); good('費馬小定理 → RSA 會用到', 0, 1.4); cap('RSA 會用到', '');
        },
  // 1644.1
  async (tok, S) => {
          note('作業：b ≢ c ⇔ ab ≢ ac (mod p)（p ∤ a）', 0, 0.4); cap('回家寫成數學式', 'b ≢ c ⇔ ab ≢ ac');
        },
]);
scene('pfB-l11-crypto', "加密 → 密文 → 解密", CAM, [
  // 1754.2
  async (tok, S) => {
          hd('RSA：加密與解密', 0, 7.2); cap('RSA：加密、解密', '');
        },
  // 1768.2
  async (tok, S) => {
          S.a = buddy('寄件者', '', FC.blue, -5.2, 2.2, 0, 1.0); S.b = buddy('收件者', '', FC.green, 5.2, 2.2, 0, 1.0); S.e = buddy('偷看的人', '', FC.gray, 0, 4.4, -1.0, 0.8); S.e.mood('wow'); cap('怕中間有人偷看', '');
        },
  // 1775.6
  async (tok, S) => {
          S.p = prop('file', -3.4, 2.2, 0, 0.9, '資料'); cap('處理一下，讓人看不懂', '');
        },
  // 1813.9
  async (tok, S) => {
          S.p.userData.label.element.textContent = '明文'; cap('明文', '看得懂');
        },
  // 1818.4
  async (tok, S) => {
          S.lk = prop('lock', -1.6, 2.2, 0, 1.0); await slide(tok, S.p, -1.6, 2.4, 0, 700); S.p.userData.label.element.textContent = '密文'; S.a.mood('happy'); cap('加密 → 密文', '別人看不懂');
        },
  // 1835.6
  async (tok, S) => {
          await slide(tok, S.p, 3.4, 2.2, 0, 900); S.p.userData.label.element.textContent = '明文'; S.b.mood('happy'); S.e.mood('sad'); cap('解密 → 明文', '');
        },
  // 1846.1
  async (tok, S) => {
          sm('寄件者加密，收件者解密', -5.2, 1.0); sm('中間的人看不懂', 0, 3.4, -1.0); cap('寄件者加密、收件者解密', '');
        },
]);
scene('pfB-l11-rsakey', "RSA：p, q → n = pq → e、d", CAM, [
  // 1860
  async (tok, S) => {
          hd('RSA = Rivest · Shamir · Adleman', 0, 7.2); S.L = board(-3.4, 6.2, 0.72); cap('RSA：三位發明者', '');
        },
  // 1878.4
  async (tok, S) => {
          cap('設計加密系統', '');
        },
  // 1883.6
  async (tok, S) => {
          S.p = buddy('p', 'p', FC.orange, 3.0, 4.4, 0, 0.9); S.q = buddy('q', 'q', FC.purple, 5.0, 4.4, 0, 0.9); S.L.add('① 兩個大質數 p、q'); S.L.last(); cap('① 兩個大質數 p、q', '');
        },
  // 1901.9
  async (tok, S) => {
          sm('老師：2¹²⁸ 以上；現今約 2¹⁰²⁴', 4.0, 3.4); cap('p、q 要非常大', '現今實務：p、q 各約 1024 位元');
        },
  // 1933.3
  async (tok, S) => {
          S.L.add('② n = p · q'); S.L.last(); cap('② n = pq', '');
        },
  // 1936.6
  async (tok, S) => {
          sm('n：算餘數用的除數', -3.4, 4.76); cap('n 是除數', '');
        },
  // 1954.2
  async (tok, S) => {
          S.L.skip(); S.L.add('③ (p − 1)(q − 1)'); S.L.last(); cap('③ (p−1)(q−1)', '');
        },
  // 1966.9
  async (tok, S) => {
          S.L.add('④ e：gcd(e, (p−1)(q−1)) = 1'); S.L.last(); cap('④ e 和 (p−1)(q−1) 互質', '');
        },
  // 1982.8
  async (tok, S) => {
          S.ke = prop('lock', 3.0, 1.6, 0, 1.0); sm('e：一把鑰匙', 3.0, 0.9); cap('e：一把鑰匙', '');
        },
  // 1990.4
  async (tok, S) => {
          S.L.add('⑤ d·e ≡ 1 (mod (p−1)(q−1))', 'ptr alt'); S.kd = prop('lock', 5.0, 1.6, 0, 1.0); sm('d：e 的倒數', 5.0, 0.9); cap('⑤ d = e⁻¹ mod (p−1)(q−1)', '');
        },
  // 2030.8
  async (tok, S) => {
          good('n：公開（寫在電話簿）', -3.4, 0.6); cap('n 公開', 'public key');
        },
  // 2048
  async (tok, S) => {
          sm('Rosen：公鑰 (n, e)，私鑰 d', -3.4, -0.1); cap('一把公開、一把私藏', 'Rosen：公開 (n, e)，d 保密');
        },
  // 2078.9
  async (tok, S) => {
          S.p.mood('sad'); S.q.mood('sad'); await wt(tok, 300); kill(S.p.g); kill(S.q.g); bad('p、q 用完銷毀', 4.0, 5.0); cap('p、q 要銷毀', '像密碼單用完就撕');
        },
]);
scene('pfB-l11-rsaenc', "C = M^e mod n，M = C^d mod n", CAM, [
  // 2129.4
  async (tok, S) => {
          S.bits = row(-4.6, 5.8, '0100100001101001'.split(''), { w: 0.42, gap: 0.06, c: (i, v) => (v === '1' ? FC.green : FC.gray) }).cells; S.bm = sm('明文的 ASCII（示意 "Hi"）', -1.0, 6.6); cap('明文 = 一串二進位', 'ASCII code');
        },
  // 2149.4
  async (tok, S) => {
          S.m = buddy('M', 'M', FC.blue, -4.6, 2.6, 0, 0.9); sm('一塊 = 一個數字 M', -4.6, 1.8); cap('切成區塊：數字 M', '例：64 bits 一塊');
        },
  // 2169.4
  async (tok, S) => {
          S.L = board(1.6, 4.4, 0.72); S.L.add('C = M^e mod n'); S.L.last(); cap('M^e 除以 n 取餘數', '');
        },
  // 2183.5
  async (tok, S) => {
          S.c = buddy('C', 'C', FC.orange, 0, 2.6, 0, 0.9); await slide(tok, S.c.g, 2.2, 0.4, 0, 800); cap('密文 C 送出去', '');
        },
  // 2194
  async (tok, S) => {
          S.L.add('C^d mod n = M', 'good'); S.L.last(); S.m2 = buddy('M', 'M', FC.blue, 5.4, 2.6, 0, 0.9); S.m2.mood('happy'); cap('C^d mod n = M', '還原！');
        },
  // 2219.8
  async (tok, S) => {
          sm('同樣的運算，換一把鑰匙', 1.6, 2.4); cap('運算相同，鑰匙不同', '');
        },
  // 2228.2
  async (tok, S) => {
          note('Rosen：用公開 e 加密、私鑰 d 解密', 1.6, 3.05); cap('哪把鑰匙公開？', '課本：e 公開、d 私藏');
        },
  // 2254.7
  async (tok, S) => {
          S.L.hi(-1); gone(S.bits, S.bm); hd('為什麼 C^d ≡ M？', -4.0, 7.2); cap('為什麼會還原？', '');
        },
  // 2295.1
  async (tok, S) => {
          S.P = board(-4.0, 6.3, 0.72); S.P.add('C^d ≡ (M^e)^d = M^(ed) (mod n)'); S.P.last(); cap('C^d ≡ M^(ed) (mod n)', '');
        },
  // 2311.6
  async (tok, S) => {
          S.P.add('M^(ed) ≡ M (mod n) ？', 'note'); cap('M^(ed) ≡ M？', '');
        },
  // 2329
  async (tok, S) => {
          S.P.add('費馬小定理（mod p、mod q）＋ 中國餘數定理', 'good'); S.P.last(); cap('費馬小定理 + CRT', '');
        },
]);
scene('pfB-l11-rsaex', "RSA 例：n = 2537、e = 13、d = 937", CAM, [
  // 2334.7
  async (tok, S) => {
          S.L = board(-3.6, 6.6, 0.68); hd('RSA 例子', 3.4, 7.2); cap('算一次例子', '');
        },
  // 2337.5
  async (tok, S) => {
          S.L.add('p = 43，q = 59'); S.L.last(); cap('p = 43，q = 59', '');
        },
  // 2348.6
  async (tok, S) => {
          S.L.add('n = 43 · 59 = 2537'); S.L.last(); cap('n = 2537', '');
        },
  // 2350.8
  async (tok, S) => {
          S.L.add('e = 13'); S.L.last(); cap('e = 13', '');
        },
  // 2358.5
  async (tok, S) => {
          S.L.add('(p−1)(q−1) = 42·58 = 2436，gcd(13, 2436) = 1'); S.L.last(); cap('42·58 = 2436', '和 13 互質');
        },
  // 2372
  async (tok, S) => {
          S.L.add('d = 937（13·937 = 5·2436 + 1）', 'good'); S.L.last(); cap('d = 937', '13·937 ≡ 1 (mod 2436)');
        },
  // 2382.2
  async (tok, S) => {
          S.L.hi(-1); S.keep = ['e = 13', 'd = 937', 'n = 2537'].map((t, i) => bx(t, FC.gold, 1.6 + i * 1.9, 5.6, 0, 1.6, 0.6, 0.6)); bad('p、q 丟掉', 3.5, 4.7); cap('只留 e、d、n', '');
        },
  // 2409.6
  async (tok, S) => {
          S.m = buddy('M', '1819', FC.blue, -5.4, 0.6, 0, 1.0); cap('明文 M = 1819', '');
        },
  // 2418.8
  async (tok, S) => {
          S.E = board(1.6, 3.6, 0.7); S.E.add('1819¹³ mod 2537 = 2081'); S.E.last(); cap('1819¹³ mod 2537 = 2081', '加密');
        },
  // 2436.3
  async (tok, S) => {
          S.c = buddy('C', '2081', FC.orange, -1.6, 0.6, 0, 1.0); await slide(tok, S.c.g, 1.4, 0.6, 0, 800); cap('網路上傳的是 2081', '');
        },
  // 2449.9
  async (tok, S) => {
          S.E.add('2081⁹³⁷ mod 2537 = 1819 ✔', 'good'); S.E.last(); S.m2 = buddy('M', '1819', FC.blue, 5.4, 0.6, 0, 1.0); S.m2.mood('happy'); cap('2081⁹³⁷ mod 2537 = 1819', '解密還原');
        },
  // 2469.7
  async (tok, S) => {
          S.E.hi(-1); cap('加密 ↔ 解密', '還原明文');
        },
]);
scene('pfB-l11-modexp', "2081⁹³⁷ mod 2537 要怎麼算？", CAM, [
  // 2491.8
  async (tok, S) => {
          hd('2081⁹³⁷ mod 2537 怎麼算？', 0, 7.2); S.L = board(-3.6, 6.2, 0.72); cap('怎麼算這個？', '每筆資料都要算');
        },
  // 2512.7
  async (tok, S) => {
          S.pc = prop('monitor', 4.0, 3.4, 0, 1.2); cap('寫程式的問題', '');
        },
  // 2520.4
  async (tok, S) => {
          S.L.add('① 速度：要乘 937 次嗎？'); S.L.last(); cap('① 速度', '');
        },
  // 2543.4
  async (tok, S) => {
          S.L.add('② overflow：數字太大裝不下', 'bad'); cap('② overflow', '');
        },
  // 2579.6
  async (tok, S) => {
          S.L.add('(a·b) mod m = ((a mod m)·b) mod m'); S.L.last(); cap('先取餘數再乘', '');
        },
  // 2607.8
  async (tok, S) => {
          S.L.add('每乘一次就 mod 一次 ✔', 'good'); S.L.last(); cap('每步都取餘數', '就不會 overflow');
        },
  // 2624.6
  async (tok, S) => {
          S.L.hi(-1); S.R = board(3.6, 1.2, 0.72); cap('怎麼加速？', '');
        },
  // 2633.8
  async (tok, S) => {
          S.R.add('5¹² = 5⁶ · 5⁶'); S.R.last(); cap('5¹² = 5⁶ · 5⁶', '');
        },
  // 2656.7
  async (tok, S) => {
          S.R.add('5⁶ 平方一次 → 5¹²'); S.R.last(); cap('平方一次', '');
        },
  // 2662.5
  async (tok, S) => {
          S.R.add('5⁶ = 5³ · 5³', 'good'); S.R.last(); cap('5⁶ = 5³·5³', '一直對半');
        },
  // 2672.4
  async (tok, S) => {
          S.R.hi(-1); note('兩個技巧 → 寫成遞迴函式', -3.6, 1.0); cap('寫成遞迴函式', '');
        },
]);
  }

  // ═══ pfC.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint } = P;
const pline = P.line;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 2 章（交大 易志偉 Lec12–Lec13 Induction and Recursion、清大 趙啟超 第3A–3D講）— cued scenes ───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的例子照用（2¹⁶、2¹³ = 1101₂、1+…+n、n < 2ⁿ、2ⁿ < n!、power set、H_{2ⁿ}、郵票 4/5、火柴、
// 八邊形、f(n+1) = 2f(n)+3、Fibonacci、3 ∈ S、apple、power(5,3)、5¹⁰、10 6 5 7 8 3 2、Σ(4i+3)、Σi³、
// aₙ = 3ⁿ − 2ⁿ、everybody is rich、A = {1,2,3} → B = {x,y}…）；老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f', gray: '#cfc6b6', sky: '#cfe6f7', mint: '#d2f1e6' };
const OKG = '#0f5a3a', NG = '#7a1010', HL = '#6a4a00';
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a proof board: lines appear one under another (left-aligned); add() lights the newest line
function board(x, yTop, dy = 0.6, max = 0) {
  const ls = []; let last = null;
  return {
    ls,
    add(t, c = 'note', dx = 0) {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      if (max && ls.length >= max) { kill(ls.shift()); ls.forEach((o) => { o.position.y += dy; }); }
      const l = L(t, c, x + dx, yTop - ls.length * dy); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
    set(i, c) { cls(ls[i < 0 ? ls.length + i : i], c); },
    dim() { ls.forEach((l) => cls(l, 'idx')); last = null; },
    clear() { ls.forEach((l) => kill(l)); ls.length = 0; last = null; },
  };
}
const chip = (t, c, x, y, w = 0.9, h = 0.6, drop = 0) => cube(t, c, [w, h, 0.6], x, y, 0, drop);
// a row of dominoes standing on y; fall(i) tips number i over to the right
function dominoes(n, x0, y, gap = 0.9, col = FC.blue, labels = null) {
  const ms = [], lb = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap;
    const m = cube('', col, [0.22, 1.2, 0.8], x, y + 0.6, 0); m.userData.x = x; m.userData.y = y; ms.push(m);
    if (labels) lb.push(T(String(labels[i]), 'idx', x, y - 0.35));
  }
  async function fall(tok, i, t = 300) {
    const m = ms[i]; if (!m || m.userData.down) return; m.userData.down = 1;
    const px = m.userData.x + 0.11, py = m.userData.y;
    await anim(tok, t, (u) => { const th = -1.0 * u, c = Math.cos(th), s = Math.sin(th); m.rotation.z = th; m.position.set(px - 0.11 * c - 0.6 * s, py - 0.11 * s + 0.6 * c, 0); });
  }
  async function run(tok, a, b, t = 180) { for (let i = a; i <= b; i++) await fall(tok, i, t); }
  return { ms, lb, fall, run };
}
function poly(pts, color = '#6e5f49') { const ls = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ls.push(pline(a[0], a[1], b[0], b[1], 0, color)); } return ls; }
const seg = (a, b, color = '#6e5f49') => pline(a[0], a[1], b[0], b[1], 0, color);
async function lift(tok, ms, t = 400) { const y0 = ms.map((m) => m.position.y); await anim(tok, t, (u) => ms.forEach((m, i) => { m.position.y = y0[i] + u * 1.2; })); ms.forEach((m) => kill(m)); }

// ════════ R29RKSmZCnM（Lec12 Induction and Recursion：快速冪、歸納法、強歸納） ════════
scene('pfC-12-mulmod', 'aᵇ mod m：先取餘數再乘', [
  async (tok, S) => { // 7.1
    S.B = board(-6.6, 6.4); S.B.add('目標：aᵇ mod m（b 很大）');
    cap('要算 aᵇ 除以 m 的餘數', 'b 很大，a 也不小');
  },
  async (tok, S) => { // 13.1
    S.B.add('aᵇ = a · a · … · a（乘 b 次）');
    S.ch = [];
    for (let i = 0; i < 6; i++) { S.ch.push(chip('a', FC.blue, 1.4 + i * 0.85, 4.6, 0.7, 0.6, 1.2)); await wt(tok, 120); }
    T('… 一共乘 b 次', 'idx', 3.5, 3.9);
    cap('aᵇ 就是 a 自己乘 b 次', '乘、乘、乘…');
  },
  async (tok, S) => { // 38.6
    S.B.add('越乘越大 → overflow', 'bad'); S.ch.forEach((m) => glow(m, NG));
    cap('乘的過程很容易 overflow', '數字大到電腦裝不下');
  },
  async (tok, S) => { // 49.7
    S.ch.forEach((m) => glow(m, '#000000'));
    S.B.add('a 先 mod m，b 也先 mod m');
    cap('兩數相乘求餘數：先各自取餘數', '(a mod m)、(b mod m)');
  },
  async (tok, S) => { // 61.3
    S.B.add('兩個餘數相乘可能又 ≥ m → 再 mod m');
    S.B.add('(a·b) mod m = ((a mod m)(b mod m)) mod m', 'good');
    T('示意：7·8 = 56，56 mod 5 = 1', 'idx', 3.8, 2.6);
    T('(2·3) mod 5 = 6 mod 5 = 1 ✓', 'idx', 3.8, 2.0);
    cap('乘起來可能又超過 m', '所以最後再取一次餘數');
  },
  async (tok, S) => { // 71.2
    S.B.add('mulmod(a, b, m) = ((a mod m)(b mod m)) mod m');
    cap('寫成演算法：mod 的乘法', '');
  },
  async (tok, S) => { // 86.5
    S.B.add('但 b 可能上千上萬：真的乘 b 次太慢', 'bad');
    cap('真的乘 b 次不合理', 'b 越大算越久');
  },
]);

scene('pfC-12-sq16', '2¹⁶：平方一次就到', [
  async (tok, S) => { // 122.0
    S.B = board(-6.6, 6.4); S.B.add('2¹⁶ = ?');
    cap('先問：2¹⁶ 怎麼算？', '答案是 65536');
  },
  async (tok, S) => { // 149.4
    S.B.add('笨方法：2 → 4 → 8 → 16 → …（每次乘 2）', 'bad');
    const v = [2, 4, 8, 16, 32, 64];
    for (let i = 0; i < v.length; i++) { chip(String(v[i]), FC.sand, 1.2 + i * 0.95, 4.4, 0.8, 0.6, 1); await wt(tok, 140); }
    T('… 一路乘到 65536：要 15 次乘法', 'idx', 3.6, 3.7);
    cap('一次乘一個 2：徹底錯誤的想法', '');
  },
  async (tok, S) => { // 173.2
    S.B.add('16 = 2·8 → 2¹⁶ = (2⁸)²');
    cap('指數律：2¹⁶ = (2⁸)²', '16 是 8 的兩倍');
  },
  async (tok, S) => { // 190.5
    S.B.add('2⁸ = 256，256² = 65536', 'good');
    chip('256', FC.blue, 2.0, 2.2, 1.2, 0.7, 1.2); chip('65536', FC.green, 5.2, 2.2, 1.6, 0.7, 1.2);
    arrow(V3(2.7, 2.2, 0), V3(4.3, 2.2, 0)); T('平方（乘 1 次）', 'idx', 3.5, 2.8);
    cap('背得 2⁸ = 256，平方一次就是 65536', '只要一次乘法');
  },
  async (tok, S) => { // 208.2
    S.B.add('從 2⁸ 一個一個乘到 2¹⁶：還要 8 次');
    T('平方：1 次　vs　一個個乘：8 次', 'note', 3.6, 1.2);
    cap('當然選平方', '');
  },
]);

scene('pfC-12-sq13', '2¹³：13 = 2·6 + 1，二進位 1101', [
  async (tok, S) => { // 240.1
    S.B = board(-6.6, 6.4); S.B.add('2¹³ = ?');
    cap('換成 2¹³：能不能也用平方？', '');
  },
  async (tok, S) => { // 261.0
    S.B.add('13 ÷ 2 = 6.5 → (2^6.5)²？ 6.5 不喜歡', 'bad');
    cap('13 除一半是 6.5', '不是整數，不好用');
  },
  async (tok, S) => { // 269.7
    S.B.add('13 = 2·6 + 1');
    cap('改寫：13 = 2·6 + 1', '這就是除法公式');
  },
  async (tok, S) => { // 292.3
    S.B.add('2¹³ = (2⁶)² · 2¹');
    cap('先算 2⁶ 再平方，多出來的 1 再乘一個 2', '');
  },
  async (tok, S) => { // 304.0
    S.B.add('6 = 2·3 + 0 → 2⁶ = (2³)² · 2⁰');
    S.B.add('3 = 2·1 + 1 → 2³ = (2¹)² · 2¹', 'say');
    cap('2⁶ 一樣折一半', '一直除以 2，記下餘數');
  },
  async (tok, S) => { // 367.2
    S.B.add('13 = 1101₂（8 + 4 + 0 + 1）');
    S.bits = ['1', '1', '0', '1'].map((b, i) => chip(b, b === '1' ? FC.green : FC.gray, 2.0 + i * 1.1, 5.2, 0.8, 0.6, 1));
    ['8', '4', '2', '1'].forEach((w, i) => T('權重 ' + w, 'idx', 2.0 + i * 1.1, 4.6));
    cap('13 寫成二進位是 1101', '8 + 4 + 1 = 13');
  },
  async (tok, S) => { // 401.4
    S.B.add('13 = 2³ + 2² + 2⁰');
    S.B.add('2¹³ = 2^(2³) · 2^(2²) · 2^(2⁰)', 'say');
    cap('剛才一直除以 2，其實就是在找二進位', '指數加法 → 乘法');
  },
  async (tok, S) => { // 463.5
    const v = ['2^(2⁰) = 2', '2^(2¹) = 4', '2^(2²) = 16', '2^(2³) = 256'];
    S.lad = [];
    for (let i = 0; i < 4; i++) {
      S.lad.push(chip(v[i], FC.blue, 1.3 + i * 1.75, 2.6, 1.6, 0.6, 1));
      if (i) arrow(V3(1.3 + (i - 1) * 1.75 + 0.8, 3.1, 0), V3(1.3 + i * 1.75 - 0.8, 3.1, 0));
      await wt(tok, 200);
    }
    cap('2 平方得 4，4 平方得 16，16 平方得 256', '');
  },
  async (tok, S) => { // 525.0
    T('每一項 = 前一項的平方', 'note', 3.9, 3.6);
    cap('相鄰兩項的關係：平方', '');
  },
  async (tok, S) => { // 537.0
    const b = ['1', '0', '1', '1'];
    S.lad.forEach((m, i) => { glow(m, b[i] === '1' ? OKG : '#000000'); if (b[i] === '0') tint(m, FC.gray); T('位元 ' + b[i] + (b[i] === '1' ? ' → 乘' : ' → 不乘'), b[i] === '1' ? 'good' : 'idx', 1.3 + i * 1.75, 1.9); });
    S.B.add('2¹³ = 2 · 16 · 256 = 8192', 'good');
    cap('該不該乘：看二進位那一位', '1 就乘進來，0 就跳過');
  },
]);

scene('pfC-12-modexp', '快速冪演算法（modular exponentiation）', [
  async (tok, S) => { // 548.1
    S.B = board(-6.6, 6.4); S.B.add('換成一般的 aᵇ：b 寫成二進位');
    S.lad = ['a', 'a²', 'a⁴', 'a⁸'].map((t, i) => chip(t, FC.gray, 1.4 + i * 1.6, 4.6, 1.0, 0.6));
    S.pw = ['2⁰', '2¹', '2²', '2³'].map((t, i) => T('a^(' + t + ')', 'idx', 1.4 + i * 1.6, 3.95));
    S.x = T('x = 1', 'note', 3.8, 2.9);
    cap('把底數換成 a：aᵇ', '先把 b 換成二進位');
  },
  async (tok, S) => { // 572.6
    tint(S.lad[0], FC.blue); glow(S.lad[0], OKG); txt(S.x, 'x = a');
    S.bit = T('第 0 位 = 1 → 乘', 'good', 1.4, 5.3);
    cap('第 0 位是 1：乘上 a^(2⁰) = a', '結果先放在暫存器 x');
  },
  async (tok, S) => { // 585.5
    tint(S.lad[1], FC.blue);
    cap('把 a 自己平方 → a^(2¹)', '');
  },
  async (tok, S) => { // 596.3
    kill(S.bit); S.bit = T('第 1 位 = 0 → 不乘', 'idx', 3.0, 5.3);
    cap('這一位是 0：這一項沒有，不要乘', '但還是要繼續平方');
  },
  async (tok, S) => { // 605.2
    tint(S.lad[2], FC.blue); glow(S.lad[2], OKG); kill(S.bit); S.bit = T('第 2 位 = 1 → 乘', 'good', 4.6, 5.3); txt(S.x, 'x = a · a⁴ = a⁵');
    await wt(tok, 500);
    tint(S.lad[3], FC.blue); glow(S.lad[3], OKG); kill(S.bit); S.bit = T('第 3 位 = 1 → 乘', 'good', 6.2, 5.3); txt(S.x, 'x = a⁵ · a⁸ = a¹³（示意：b = 1101₂）');
    cap('再平方 → a⁴、a⁸；那一位是 1 就乘進來', '一直累乘上去');
  },
  async (tok, S) => { // 630.6
    S.B.clear(); S.lad.forEach((m) => kill(m)); kill(S.x); kill(S.bit); S.pw.forEach((l) => kill(l));
    S.code = code(['procedure modexp(b, n = (a_{k-1}…a₁a₀)₂, m)', 'x := 1', 'power := b mod m', 'for i := 0 to k − 1', '   if aᵢ = 1 then x := (x · power) mod m', '   power := (power · power) mod m', 'return x      { x = bⁿ mod m }'], -2.6, 6.4);
    S.code.hl(1); cls(S.code.ls[2], 'ptr alt');
    cap('寫成演算法：x := 1，power := b mod m', '底數太大沒用，先取餘數');
  },
  async (tok, S) => { // 674.0
    S.code.hl(3);
    cap('i 從 0 到 k−1：一位一位看指數', '每一位是 0 或 1');
  },
  async (tok, S) => { // 696.0
    S.code.hl(4);
    cap('aᵢ = 1：x 乘上 power 再 mod m', 'x 最後就是答案（餘數）');
  },
  async (tok, S) => { // 735.7
    S.code.hl(5);
    cap('power 自己平方再 mod m', '不管這一位是不是 1，都要平方');
  },
  async (tok, S) => { // 774.0
    S.code.hl(-1);
    T('例：13 = 8 + 4 + 1 → 2¹³ = 2⁸ · 2⁴ · 2¹', 'note', 3.4, 2.4);
    ['i', 'aᵢ', 'power', 'x'].forEach((h, j) => T(h, 'ptr', [0.6, 2.0, 3.6, 6.2][j], 1.7));
    cap('不看 mod，用 2¹³ 走一次', '13 = 1101₂');
  },
  async (tok, S) => { // 797.6
    ['0', '1', '2', '1 · 2 = 2'].forEach((v, j) => T(v, 'say', [0.6, 2.0, 3.6, 6.2][j], 1.15));
    cap('i = 0：power = 2¹ = 2，位元 1 → x = 2', '');
  },
  async (tok, S) => { // 810.7
    ['1', '0', '4', '2（不乘）'].forEach((v, j) => T(v, j === 3 ? 'idx' : 'say', [0.6, 2.0, 3.6, 6.2][j], 0.6));
    cap('i = 1：power = 2·2 = 4，位元 0 → 不乘', '');
  },
  async (tok, S) => { // 836.6
    ['2', '1', '16', '2 · 16 = 32'].forEach((v, j) => T(v, 'say', [0.6, 2.0, 3.6, 6.2][j], 0.05));
    cap('i = 2：power = 4·4 = 16，位元 1 → x = 32', '');
  },
  async (tok, S) => { // 848.5
    ['3', '1', '256', '32 · 256 = 8192'].forEach((v, j) => T(v, j === 3 ? 'good' : 'say', [0.6, 2.0, 3.6, 6.2][j], -0.5));
    cap('i = 3：power = 256 → x = 8192 = 2¹³', '16·16 = 256');
  },
  async (tok, S) => { // 860.4
    S.code.hl(4); cls(S.code.ls[5], 'ptr alt');
    cap('每一步都 mod m：數字變小，答案不變', '這就是要 mod 的原因');
  },
]);

scene('pfC-12-indform', '數學歸納法的正式寫法：三步驟', [
  async (tok, S) => { // 954.0
    S.B = board(-6.6, 6.4); S.B.add('數學歸納法：正式地寫一次');
    cap('數學歸納法大家都會', '這次把它正式寫下來');
  },
  async (tok, S) => { // 966.8
    S.B.add('P(n)：跟 n 有關的命題，n ∈ ℤ⁺');
    cap('P(n)：一個帶 n 的命題', 'n 可以是正整數（或自然數）');
  },
  async (tok, S) => { // 983.0
    S.B.add('例：P(n)：1 + 2 + … + n = n(n+1)/2');
    cap('例如以前解過的 1 + … + n', '這個等式本身就是一個命題');
  },
  async (tok, S) => { // 1004.5
    S.B.add('P(1)：1 = 1·(1+1)/2 ？');
    cap('n = 1 時，問 1 會不會等於 1·2/2', '對或錯');
  },
  async (tok, S) => { // 1020.0
    S.B.add('要證：∀n ∈ ℤ⁺，P(n) 為真');
    cap('目標：所有正整數 n，P(n) 都對', '題目常只寫 prove');
  },
  async (tok, S) => { // 1077.7
    S.B.add('三步驟：① 起始條件 ② 推演 ③ 結論');
    cap('答案一定要寫出 ①②③', '① 和 ③ 是固定形式');
  },
  async (tok, S) => { // 1108.1
    S.B.add('② 重點：任意 k，若 P(k) 為真 → P(k+1) 為真');
    cap('重點在第二步', '假設 P(k) 對，推出 P(k+1) 也對');
  },
  async (tok, S) => { // 1142.7
    S.B.add('① 起始：最小的 n，P(1) 為真');
    cap('起始條件：最小的那個數', '通常很明顯，寫下來就好');
  },
  async (tok, S) => { // 1186.0
    T('例：n = 10 對 → 能推出 n = 11 對', 'say', 3.6, 3.0);
    cap('隨便給一個 k，例如 10', '10 對的話，11 也會對嗎？');
  },
  async (tok, S) => { // 1195.6
    S.D = dominoes(7, 1.0, 0.3, 0.9, FC.blue, [1, 2, 3, 4, 5, 6, '…']);
    cap('這就像推骨牌', '這一張倒，下一張就會倒');
  },
  async (tok, S) => { // 1202.7
    await S.D.fall(tok, 0, 400); await S.D.run(tok, 1, 6, 160);
    cap('第一張推倒了 → 第二張倒 → 第三張倒…', '一直連續下去');
  },
  async (tok, S) => { // 1216.0
    S.B.add('③ 結論：∀n ∈ ℤ⁺，P(n) 為真', 'good');
    cap('最後寫結論：證完了', '把要證的話再寫一次');
  },
]);

scene('pfC-12-sum', '證明 1 + 2 + … + n = n(n+1)/2', [
  async (tok, S) => { // 1242.0
    S.B = board(-6.6, 6.4); S.B.add('證明：1 + 2 + … + n = n(n+1)/2');
    S.D = dominoes(7, 1.2, 0.3, 0.9, FC.blue, [1, 2, 3, 4, 5, 6, '…']);
    cap('來證剛才的例子', '');
  },
  async (tok, S) => { // 1252.1
    S.B.add('P(n)：1 + … + n = n(n+1)/2');
    cap('先寫出命題 P(n)', '問這個等號成不成立');
  },
  async (tok, S) => { // 1277.7
    S.B.add('① n = 1：1 = 1·(1+1)/2 = 1 ✓');
    await S.D.fall(tok, 0, 400);
    cap('第一塊骨牌：n = 1 帶進去', '左邊 1，右邊 1·2/2 = 1');
  },
  async (tok, S) => { // 1299.3
    S.B.add('② 假設 P(k)：1 + … + k = k(k+1)/2');
    cap('假設隨便一個 k，P(k) 是對的', '這是可以用的工具，先寫下來');
  },
  async (tok, S) => { // 1310.6
    S.B.add('目標 P(k+1)：1 + … + (k+1) = (k+1)(k+2)/2');
    cap('要證 k+1 時也對', '右邊是 (k+1)((k+1)+1)/2');
  },
  async (tok, S) => { // 1336.0
    S.B.add('左邊 = (1 + … + k) + (k+1)');
    cap('把左邊拆成：加到 k，再加 k+1', '');
  },
  async (tok, S) => { // 1341.2
    S.B.add('= k(k+1)/2 + (k+1)　← 用假設');
    cap('前面那段用假設換掉', 'k(k+1)/2');
  },
  async (tok, S) => { // 1350.0
    S.B.add('= (k+1)(k/2 + 1)　← 提出 k+1');
    cap('提出公因式 k+1', '');
  },
  async (tok, S) => { // 1357.1
    S.B.add('= (k+1)(k+2)/2 ✓', 'good');
    cap('k/2 + 1 = (k+2)/2', '剛好就是目標');
  },
  async (tok, S) => { // 1365.3
    await S.D.run(tok, 1, 6, 170);
    cap('P(k) 對 → P(k+1) 也對', '前一張倒，下一張就倒');
  },
  async (tok, S) => { // 1386.7
    S.B.add('③ 結論：∀n ∈ ℤ⁺，P(n) 為真', 'good');
    cap('最後寫結論，表示做完了', '');
  },
]);

scene('pfC-12-n2n', '證明 n < 2ⁿ', [
  async (tok, S) => { // 1409.2
    S.B = board(-6.6, 6.4); S.B.add('n ∈ ℤ⁺，證明 n < 2ⁿ');
    cap('下一題：n < 2ⁿ', 'n 是正整數 1, 2, 3, …');
  },
  async (tok, S) => { // 1428.2
    S.B.add('P(n)：n < 2ⁿ');
    cap('先寫成命題 P(n)', '');
  },
  async (tok, S) => { // 1437.0
    S.B.add('① P(1)：1 < 2¹ = 2 ✓');
    cap('第一塊骨牌 n = 1', '1 < 2，對');
  },
  async (tok, S) => { // 1458.0
    S.B.add('② 假設 P(k)：k < 2ᵏ');
    cap('假設 P(k) 對', '手上有什麼，先寫下來');
  },
  async (tok, S) => { // 1477.0
    S.B.add('目標：k + 1 < 2ᵏ⁺¹');
    cap('從這裡出發，想辦法串到 2ᵏ⁺¹', '');
  },
  async (tok, S) => { // 1487.2
    S.B.add('k + 1 < 2ᵏ + 1　← 假設兩邊加 1');
    cap('k < 2ᵏ，兩邊同時加 1', '');
  },
  async (tok, S) => { // 1509.0
    S.B.add('因為 k ≥ 1，所以 1 ≤ 2ᵏ');
    cap('那個 1 比 2ᵏ 小（或相等）', '');
  },
  async (tok, S) => { // 1524.0
    S.B.add('≤ 2ᵏ + 2ᵏ = 2 · 2ᵏ = 2ᵏ⁺¹ ✓', 'good');
    cap('把 1 換成 2ᵏ，兩個相加是兩倍', '剛好變成 2ᵏ⁺¹');
  },
  async (tok, S) => { // 1539.0
    S.B.add('③ 結論：∀n ∈ ℤ⁺，n < 2ⁿ', 'good');
    cap('P(k+1) 成立，證完了', '');
  },
]);

scene('pfC-12-fact', '2ⁿ < n!：第一塊骨牌在 4', [
  async (tok, S) => { // 1563.0
    S.B = board(-6.6, 6.4); S.B.add('第一塊骨牌不一定是 0 或 1');
    cap('之前 n 都是自然數或正整數', '現在稍微不一樣');
  },
  async (tok, S) => { // 1573.0
    S.B.add('n ≥ 4，證明 2ⁿ < n!');
    S.D = dominoes(8, 0.6, 0.3, 0.85, FC.blue, [1, 2, 3, 4, 5, 6, 7, 8]);
    [0, 1, 2].forEach((i) => tint(S.D.ms[i], FC.gray));
    cap('第一塊骨牌在 4', '1、2、3 不用管');
  },
  async (tok, S) => { // 1589.9
    S.B.add('① basis step：n = 4');
    glow(S.D.ms[3], HL);
    cap('basis step：最小的那塊，n = 4', '真的帶進去算');
  },
  async (tok, S) => { // 1609.0
    S.B.add('2⁴ = 16');
    cap('2⁴ = 16', '');
  },
  async (tok, S) => { // 1616.1
    S.B.add('4! = 4·3·2·1 = 24 → 16 < 24 ✓');
    await S.D.fall(tok, 3, 400);
    cap('4! = 24，16 < 24 對', '第一塊倒了');
  },
  async (tok, S) => { // 1632.7
    S.B.add('② 假設 2ᵏ < k!，k ≥ 4');
    cap('假設 2ᵏ < k!', 'k ≥ 4 這個條件等一下會用到');
  },
  async (tok, S) => { // 1665.1
    S.B.add('2ᵏ⁺¹ = 2 · 2ᵏ');
    cap('2ᵏ⁺¹：先把一個 2 提出來', '讓 2ᵏ 露出來');
  },
  async (tok, S) => { // 1674.4
    S.B.add('< 2 · k!　← 用假設');
    cap('2ᵏ < k!，用上去', '');
  },
  async (tok, S) => { // 1677.0
    S.B.add('< (k+1) · k!　← k+1 ≥ 5 > 2');
    cap('k ≥ 4，所以 k+1 ≥ 5，比 2 大', '把 2 換成 k+1');
  },
  async (tok, S) => { // 1694.7
    S.B.add('= (k+1)! ✓', 'good');
    cap('頭跟尾抓出來：2ᵏ⁺¹ < (k+1)!', '');
  },
  async (tok, S) => { // 1705.0
    T('證明裡一定要用到假設 P(k)', 'note', 3.6, 3.2);
    await S.D.run(tok, 4, 7, 170);
    cap('前面不對，這裡也證不出來', '所以一定要把假設用上');
  },
  async (tok, S) => { // 1724.4
    S.B.add('③ 結論：∀n ≥ 4，2ⁿ < n!', 'good');
    cap('最後下結論：①②③ 清楚標出來', '');
  },
]);

scene('pfC-12-power', '|P(S)| = 2^|S|：對集合大小歸納', [
  async (tok, S) => { // 1758.7
    S.B = board(-6.6, 6.4); S.B.add('條件放鬆：不一定是「∀n ∈ ℤ⁺」');
    cap('不要死記一定是自然數或正整數', '從 4 開始也沒差');
  },
  async (tok, S) => { // 1798.4
    S.B.add('例：|P(S)| = 2^|S|（P(S)：S 的所有子集合）');
    cap('不是數列：是一個集合的敘述', 'power set 的個數 = 2 的 |S| 次方');
  },
  async (tok, S) => { // 1819.0
    S.B.add('要有順序 → 對「集合大小 |S|」做歸納');
    cap('歸納法一定要有骨牌的順序', '小問題會了，推到大一點的');
  },
  async (tok, S) => { // 1883.3
    S.B.add('大小 3 的對 → 推出大小 4 的也對');
    cap('先說清楚：歸納的對象是集合大小', '');
  },
  async (tok, S) => { // 1915.6
    S.B.add('最小的集合：∅（大小 0）= 第一塊骨牌');
    cap('最小的集合是空集合', '0 個、1 個、2 個、3 個……');
  },
  async (tok, S) => { // 1943.4
    S.B.add('S = ∅：P(∅) = {∅}，大小 1 = 2⁰ ✓', 'good');
    cap('空集合的子集合只有它自己', 'P(∅) = {∅} 有 1 個東西，2⁰ = 1');
  },
  async (tok, S) => { // 1997.6
    S.B.clear(); S.B.add('例：S = {1, 2, 3}，|S| = 3');
    cap('舉個例子：S = {1, 2, 3}', '');
  },
  async (tok, S) => { // 2033.3
    const sub = ['∅', '{1}', '{2}', '{3}', '{1,2}', '{1,3}', '{2,3}', '{1,2,3}'];
    S.row = [];
    for (let i = 0; i < 8; i++) { S.row.push(chip(sub[i], FC.blue, 1.8 + (i % 4) * 1.55, 5.6 - Math.floor(i / 4) * 0.75, 1.35, 0.6, 1)); await wt(tok, 120); }
    cap('把 S 的子集合一個一個列出來', '');
  },
  async (tok, S) => { // 2073.6
    S.B.add('共 8 個 = 2³ ✓', 'good');
    cap('8 個，剛好是 2³', '');
  },
  async (tok, S) => { // 2091.5
    S.B.add("S' = S ∪ {a} = {1, 2, 3, a}");
    cap('下一塊骨牌：多放一個新元素 a', '');
  },
  async (tok, S) => { // 2147.0
    S.B.add("|S'| = |S| + 1");
    cap('a 跟 1、2、3 都不同', '所以大小多 1');
  },
  async (tok, S) => { // 2175.7
    T('① 不含 a：就是原來的 8 個', 'ptr', 4.1, 6.3);
    cap('S′ 的子集合分兩類', '第一類：不含 a');
  },
  async (tok, S) => { // 2196.2
    const sub = ['{a}', '{1,a}', '{2,a}', '{3,a}', '{1,2,a}', '{1,3,a}', '{2,3,a}', '{1,2,3,a}'];
    for (let i = 0; i < 8; i++) { chip(sub[i], FC.orange, 1.8 + (i % 4) * 1.55, 3.0 - Math.floor(i / 4) * 0.75, 1.45, 0.6, 1); await wt(tok, 120); }
    T('② 含 a：每個舊的再塞進 a', 'ptr', 4.1, 3.7);
    cap('第二類：含 a', '每一個舊子集合再多放一個 a');
  },
  async (tok, S) => { // 2239.8
    S.B.add("P(S') = P(S) ∪ { X ∪ {a} : X ∈ P(S) }");
    cap('沒有別的可能了', '第二類是第一類的 copy，再塞一個 a');
  },
  async (tok, S) => { // 2266.4
    S.B.add("兩類一樣多 → |P(S')| = 2 · |P(S)| = 16", 'good');
    cap('大小變兩倍', '8 × 2 = 16 = 2⁴');
  },
  async (tok, S) => { // 2291.0
    S.B.add('正式：|S| = k+1，拿掉一個元素得 T，|T| = k');
    cap('正式寫：假設大小 k 的都對', '大小 k+1 的 S 拿掉一個元素，剩 T');
  },
  async (tok, S) => { // 2352.3
    S.B.add('|P(S)| = 2 · |P(T)| = 2 · 2ᵏ = 2ᵏ⁺¹ ✓', 'good');
    cap('T 可以用假設：|P(T)| = 2ᵏ', '再乘 2 就是 2ᵏ⁺¹');
  },
]);

scene('pfC-12-harm', '調和數 H_{2ⁿ} ≥ 1 + n/2', [
  async (tok, S) => { // 2380.6
    S.B = board(-6.6, 6.4, 0.7, 5); S.B.add('另一種數列：不是 1, 2, 3, 4 一個一個');
    cap('這次的數列不是一個接一個', '');
  },
  async (tok, S) => { // 2402.6
    S.B.add('H_j = 1 + 1/2 + 1/3 + … + 1/j（調和數）');
    S.bar = [];
    for (let j = 1; j <= 8; j++) { const h = 2.4 / j; S.bar.push(cube('', FC.blue, [0.5, h, 0.5], 1.2 + (j - 1) * 0.72, 0.2 + h / 2, 0)); T('1/' + j, 'idx', 1.2 + (j - 1) * 0.72, -0.15); }
    cap('Harmonic number：1 + 1/2 + … + 1/j', '每根柱子是一項 1/j');
  },
  async (tok, S) => { // 2408.4
    S.B.add('跟 log 很像（1/x 的積分）→ 很有用');
    cap('它跟 log 很接近', '常拿來評估 log 的增長');
  },
  async (tok, S) => { // 2429.0
    S.B.add('只看 H₁, H₂, H₄, H₈, …（n = 0, 1, 2, 3…）');
    [[0], [1], [2, 3], [4, 5, 6, 7]].forEach((g, k) => g.forEach((i) => tint(S.bar[i], [FC.purple, FC.orange, FC.teal, FC.pink][k])));
    cap('只管第 2ⁿ 項', 'n 是自然數，2⁰ = 1');
  },
  async (tok, S) => { // 2455.1
    S.B.add('證明：H_{2ⁿ} ≥ 1 + n/2');
    cap('要證 H_{2ⁿ} ≥ 1 + n/2', '');
  },
  async (tok, S) => { // 2468.8
    T('越加越大、不會收斂（像 log）', 'idx', 4.5, 3.05);
    cap('意思：這個數列會越加越大', '跟 log 一樣不會停在某個值');
  },
  async (tok, S) => { // 2532.3
    S.B.add('① n = 0：H₁ = 1，右邊 1 + 0/2 = 1 → 1 ≥ 1 ✓');
    cap('n = 0：左邊 H₁ = 1，右邊也是 1', '≥ 含等於，所以對');
  },
  async (tok, S) => { // 2565.2
    S.B.add('② 假設 H_{2ᵏ} ≥ 1 + k/2');
    cap('假設 k 的時候對', '');
  },
  async (tok, S) => { // 2579.8
    S.B.add('H_{2ᵏ⁺¹} = H_{2ᵏ} + [1/(2ᵏ+1) + … + 1/2ᵏ⁺¹]');
    cap('照定義寫開：前面一段 + 後面一段', '');
  },
  async (tok, S) => { // 2593.3
    S.B.add('前段 H_{2ᵏ} ≥ 1 + k/2　← 用假設');
    cap('前面那段套用假設', '');
  },
  async (tok, S) => { // 2602.8
    S.B.add('後段每一項 ≥ 1/2ᵏ⁺¹（分母最大的最小）');
    [4, 5, 6, 7].forEach((i) => glow(S.bar[i], HL));
    T('示意 k = 2：1/5…1/8 都 ≥ 1/8', 'idx', 4.4, 1.6);
    cap('後面那些數字誰最小？分母最大的', '全部換成最小的，只會變小');
  },
  async (tok, S) => { // 2633.6
    S.B.add('後段共 2ᵏ 項 → ≥ 2ᵏ · 1/2ᵏ⁺¹ = 1/2');
    cap('一共 2ᵏ 項，每項至少 1/2ᵏ⁺¹', '乘起來是 1/2');
  },
  async (tok, S) => { // 2664.7
    S.B.add('H_{2ᵏ⁺¹} ≥ 1 + k/2 + 1/2 = 1 + (k+1)/2 ✓', 'good');
    cap('兩段加起來：k+1 也對', '常常就是這樣「換小」');
  },
]);

scene('pfC-12-demorgan', '推廣的 De Morgan 定律', [
  async (tok, S) => { // 2681.1
    S.B = board(-6.6, 6.4); S.B.add('要證：(A₁ ∩ A₂ ∩ … ∩ Aₙ)ᶜ = A₁ᶜ ∪ A₂ᶜ ∪ … ∪ Aₙᶜ');
    cap('先把要證的東西寫下來', 'n 個集合交集的補集');
  },
  async (tok, S) => { // 2709.4
    S.B.add('工具：兩個集合的 De Morgan（X ∩ Y）ᶜ = Xᶜ ∪ Yᶜ');
    S.B.add('　　　＋ 假設 k 個集合時成立', 'say');
    cap('手上有兩個工具', '兩個集合的公式、k 個集合的假設');
  },
  async (tok, S) => { // 2723.3
    S.B.add('k+1 個看成兩塊：B = A₁ ∩ … ∩ A_k，和 A_{k+1}');
    S.b1 = chip('B = A₁ ∩ … ∩ A_k', FC.blue, 2.4, 2.0, 2.6, 0.7, 1); S.b2 = chip('A_{k+1}', FC.orange, 5.4, 2.0, 1.4, 0.7, 1);
    cap('換個心態：前面 k 個當成一個集合 B', '後面一個 A_{k+1}');
  },
  async (tok, S) => { // 2756.9
    S.B.add('(B ∩ A_{k+1})ᶜ = Bᶜ ∪ A_{k+1}ᶜ　← 兩個集合版');
    cap('先用兩個集合的 De Morgan', '');
  },
  async (tok, S) => { // 2776.8
    S.B.add('Bᶜ = A₁ᶜ ∪ … ∪ A_kᶜ　← 歸納假設');
    glow(S.b1, OKG);
    cap('Bᶜ 是 k 個集合交集的補集', '可以套用假設');
  },
  async (tok, S) => { // 2800.9
    S.B.add('連集結合律 → A₁ᶜ ∪ … ∪ A_kᶜ ∪ A_{k+1}ᶜ ✓', 'good');
    cap('全部都是連集，用結合律合在一起', '就是 k+1 個的公式');
  },
  async (tok, S) => { // 2817.1
    S.B.add('③ 故得證', 'good');
    cap('Step 3：故得證', '');
  },
]);

scene('pfC-12-incl', '排容原理的歸納證明', [
  async (tok, S) => { // 2844.5
    S.B = board(-6.6, 6.4, 0.6, 6); S.B.add('排容原理：|A₁ ∪ A₂ ∪ … ∪ Aₙ| = ?');
    cap('Inclusion–exclusion principle', '算連集裡有幾個東西');
  },
  async (tok, S) => { // 2867.9
    S.B.add('= Σ|Aᵢ| − Σ_{i<j}|Aᵢ ∩ Aⱼ| + Σ_{i<j<l}|Aᵢ ∩ Aⱼ ∩ A_l| − …');
    S.ex = T('加個別 → 減兩兩（加過頭）→ 加回三個（減過頭）…', 'idx', 0.4, 4.6);
    cap('先加個別的，加過頭就減掉兩兩的', '減過頭再把三個的加回去');
  },
  async (tok, S) => { // 2924.6
    S.B.add('假設 n 個集合時成立，看 n+1 個');
    cap('假設 n 個集合成立', '手上的工具：兩個集合的公式、n 個的公式');
  },
  async (tok, S) => { // 2950.1
    kill(S.ex); S.B.add('把 Aₙ ∪ Aₙ₊₁ 當成一個集合 → 只剩 n 個 → 套假設');
    S.c = [1, 2, 3].map((i) => chip('A' + ['₁', '₂', '…'][i - 1], FC.blue, 0.8 + i * 1.1, 2.0, 0.9, 0.6, 1));
    S.d = chip('Aₙ ∪ Aₙ₊₁', FC.orange, 6.0, 2.0, 1.6, 0.6, 1);
    cap('最後兩個先綁成一個', '這樣只有 n 個集合，可以套假設');
  },
  async (tok, S) => { // 3023.4
    S.B.add('|Aₙ ∪ Aₙ₊₁| 再用兩個集合的公式拆開');
    cap('裡面還藏著連集：再拆開', '|X ∪ Y| = |X| + |Y| − |X ∩ Y|');
  },
  async (tok, S) => { // 3092.8
    S.B.add('分配律：Aᵢ ∩ (Aₙ ∪ Aₙ₊₁) = (Aᵢ ∩ Aₙ) ∪ (Aᵢ ∩ Aₙ₊₁)');
    cap('交集裡有連集：用分配律', '');
  },
  async (tok, S) => { // 3125.8
    S.B.add('又跑出連集 → 再套一次排容');
    cap('我們只要交集，不要連集', '再套一次排容原理');
  },
  async (tok, S) => { // 3142.5
    S.B.add('兩兩一組、三三一組合併 → 剛好是 n+1 個集合的所有配對');
    cap('把兩項的放一起、三項的放一起', '所有可能的配對都找齊了');
  },
  async (tok, S) => { // 3203.1
    S.B.add('整理完 = n+1 個集合的排容公式 ✓', 'good');
    cap('證明結束（投影片有幾個筆誤）', '');
  },
  async (tok, S) => { // 3211.0
    T('證明不一定是數字：也可以是抽象的形式', 'note', 2.0, 0.6);
    cap('證明不一定都是數字', '也可以是比較抽象的寫法');
  },
]);

scene('pfC-12-strong', '強歸納法：每個 n > 1 都能質因數分解', [
  async (tok, S) => { // 3233.7
    S.B = board(-6.6, 6.4); S.B.add('Strong Induction（強數學歸納法）');
    S.D = dominoes(6, 1.0, 0.3, 0.9, FC.blue, [2, 3, 4, 5, 'k', 'k+1']);
    cap('式子二：Strong Induction', '');
  },
  async (tok, S) => { // 3242.4
    S.B.add('剛才：前一張推倒下一張');
    cap('剛才的骨牌：前一張推倒下一張', '還不能應付所有情況');
  },
  async (tok, S) => { // 3254.1
    S.B.add('有時候：要靠前面好幾張');
    cap('有時候問題會縮成前面好幾個', '不是只跟前一個有關');
  },
  async (tok, S) => { // 3262.1
    S.B.add('第一張要倒；第 k+1 張倒，是因為前面全倒了');
    await S.D.fall(tok, 0, 350);
    cap('一樣要先推倒第一張', '');
  },
  async (tok, S) => { // 3288.3
    S.B.add('可以假設 P(1), P(2), …, P(k) 全部為真');
    cap('差別在手上的牌', '前面所有的都可以假設是對的');
  },
  async (tok, S) => { // 3299.8
    S.big = cube('', FC.orange, [0.5, 2.0, 0.9], 1.0 + 6 * 0.9, 1.3, 0);
    T('超級大骨牌', 'ptr', 1.0 + 6 * 0.9, 2.7);
    cap('中間放了一個超級大骨牌', '要前面好幾張一起倒才推得動');
  },
  async (tok, S) => { // 3320.3
    S.B.add('例：每個整數 n > 1 都能寫成質數的乘積');
    cap('例子：質因數分解', 'n > 1 的整數都可以分解');
  },
  async (tok, S) => { // 3336.6
    S.B.add('分解是乘法 → 變小要用除法，不是 n → n−1');
    cap('要把問題變小，只能用除法', '至少除以 2，跟前一個 n−1 無關');
  },
  async (tok, S) => { // 3370.5
    S.B.add('① n = 2：2 本身是質數 ✓');
    cap('第一塊骨牌：n = 2', '2 自己就是質數');
  },
  async (tok, S) => { // 3393.0
    S.B.add('② 假設 2, 3, 4, …, k 都能分解');
    await S.D.run(tok, 1, 4, 160);
    cap('假設 2 到 k 全部都有質因數分解', '要證 k+1 也有');
  },
  async (tok, S) => { // 3409.8
    S.B.add('case 1：k+1 是質數 → 自己就是分解 ✓');
    cap('第一種情況：k+1 是質數', '質數不能再變小，自己就是');
  },
  async (tok, S) => { // 3441.3
    S.B.add('case 2：k+1 = a · b，2 ≤ a, b ≤ k');
    cap('不是質數：可以寫成兩數相乘', 'a、b 都比 k+1 小');
  },
  async (tok, S) => { // 3471.8
    S.B.add('a、b 落在 2…k → 依假設都能分解');
    cap('a、b 都在前面那些骨牌裡', '根據假設，它們都能分解');
  },
  async (tok, S) => { // 3480.8
    S.B.add('k+1 = (a 的分解) · (b 的分解) ✓', 'good');
    T('示意：12 = 3 · 4 = 3 · 2 · 2', 'idx', 3.6, 3.4);
    await S.D.fall(tok, 5, 400);
    cap('把兩個分解乘起來就好', '');
  },
]);

scene('pfC-12-match', '撿火柴遊戲：後手必勝', [
  async (tok, S) => { // 3503.0
    S.B = board(-6.6, 6.4); S.B.add('撿火柴遊戲');
    cap('以前玩過的撿火柴遊戲', '');
  },
  async (tok, S) => { // 3514.5
    S.B.add('兩堆一樣多；輪流從其中一堆拿走若干根');
    S.B.add('拿到最後一根的人贏', 'say');
    cap('兩堆火柴數量一樣', '每次只能從一堆裡拿');
  },
  async (tok, S) => { // 3552.4
    S.B.add('主張：第二個拿的人一定贏');
    cap('第二個挑的人一定贏', '這遊戲不用玩');
  },
  async (tok, S) => { // 3601.0
    S.B.add('對「每堆的根數 n」做歸納');
    cap('最明顯的是火柴的根數', '');
  },
  async (tok, S) => { // 3610.5
    S.B.add('① n = 1：先手拿走一根，後手拿最後一根 ✓');
    const a = cube('', FC.gold, [0.14, 1.0, 0.14], 2.0, 1.0, 0), b = cube('', FC.gold, [0.14, 1.0, 0.14], 5.0, 1.0, 0);
    T('左堆', 'idx', 2.0, 0.2); T('右堆', 'idx', 5.0, 0.2);
    await lift(tok, [a], 400); await lift(tok, [b], 400);
    cap('每堆一根：先手只能拿走一根', '後手拿走剩下那根 → 後手贏');
  },
  async (tok, S) => { // 3634.7
    S.B.add('② 假設每堆 1, 2, …, k 根時，後手都贏');
    cap('假設火柴 1 根、2 根…到 k 根', '都是第二個人贏');
  },
  async (tok, S) => { // 3661.6
    S.B.add('k+1 根：先手拿 r 根，後手在另一堆也拿 r 根');
    S.L = []; S.R = [];
    for (let i = 0; i < 5; i++) { S.L.push(cube('', FC.gold, [0.14, 1.0, 0.14], 1.4 + i * 0.3, 1.0, 0)); S.R.push(cube('', FC.gold, [0.14, 1.0, 0.14], 4.4 + i * 0.3, 1.0, 0)); }
    T('示意：k+1 = 5', 'idx', 3.4, 2.0);
    await lift(tok, S.L.slice(2), 400);
    await lift(tok, S.R.slice(2), 400);
    cap('先手從一堆拿 3 根', '我就跟屁蟲：另一堆也拿 3 根');
  },
  async (tok, S) => { // 3688.3
    S.B.add('剩下兩堆都是 k+1−r 根，又輪先手');
    cap('又變成兩堆一樣多', '還是輪他先挑，我還是第二個');
  },
  async (tok, S) => { // 3697.8
    S.B.add('k+1−r ≤ k → 依假設後手贏 ✓', 'good');
    cap('根數 ≤ k：根據前面的假設', '一定是後手贏');
  },
  async (tok, S) => { // 3718.7
    T('現場玩：你拿幾根，我就在另一堆拿幾根', 'note', 3.4, 3.2);
    await lift(tok, [S.L[1]], 350); await lift(tok, [S.R[1]], 350);
    cap('課堂上實際玩一次', '你做什麼，我就跟你做一樣的事');
  },
]);

scene('pfC-12-stamp', '郵票：4 元與 5 元湊出 ≥ 12 元', [
  async (tok, S) => { // 3764.5
    S.B = board(-6.6, 6.4, 0.6, 6); S.B.add('寄信：要準備幾種郵票才夠貼？');
    cap('去郵局寄信：30、40、50 元…', '要準備幾種郵票？');
  },
  async (tok, S) => { // 3787.3
    S.B.add('只要 4 元和 5 元 → ≥ 12 的金額都湊得出來');
    cap('信封夠大的話，只要 4 元和 5 元', '任何 ≥ 12 的金額都能湊');
  },
  async (tok, S) => { // 3834.3
    S.B.add('起始條件不只一個');
    cap('這次起始條件要好幾個', '為什麼？等一下看');
  },
  async (tok, S) => { // 3860.9
    S.row = (y, a) => a.forEach((v, i) => chip(String(v), v === 4 ? FC.blue : FC.orange, 2.4 + i * 0.75, y, 0.6, 0.6, 1));
    T('12', 'ptr', 1.4, 2.6); S.row(2.6, [4, 4, 4]);
    cap('12 = 4 + 4 + 4', '');
  },
  async (tok, S) => { // 3870.0
    T('13', 'ptr', 1.4, 1.9); S.row(1.9, [4, 4, 5]);
    cap('13 = 4 + 4 + 5', '');
  },
  async (tok, S) => { // 3873.7
    T('14', 'ptr', 1.4, 1.2); S.row(1.2, [4, 5, 5]);
    cap('14 = 4 + 5 + 5', '');
  },
  async (tok, S) => { // 3876.4
    T('15', 'ptr', 1.4, 0.5); S.row(0.5, [5, 5, 5]);
    cap('15 = 5 + 5 + 5', '這 4 個是起始條件');
  },
  async (tok, S) => { // 3898.1
    S.B.add('假設 12, 13, …, k 都湊得出來（k ≥ 15）');
    cap('假設 12 到 k 全部都湊得出來', 'k + 1 怎麼辦？');
  },
  async (tok, S) => { // 3921.7
    S.B.add('k+1：先貼一張 4 元，剩 k−3');
    T('k+1', 'ptr', 1.4, -0.2); chip('4', FC.blue, 2.4, -0.2, 0.6, 0.6, 1); chip('k−3', FC.gray, 3.6, -0.2, 1.2, 0.6, 1);
    cap('先貼一張 4 元郵票', '剩下只要湊 k−3');
  },
  async (tok, S) => { // 3947.5
    S.B.add('12 ≤ k−3 < k → 依假設湊得出 → 再加 4 ✓', 'good');
    cap('k−3 落在 12 到 k 的範圍', '所以湊得出來，再多貼一張 4');
  },
  async (tok, S) => { // 3974.4
    S.B.add('為什麼要 4 個起始？一次往回退 4 步：16 → 12');
    cap('一貼就是 4 元，要往前看 4 格', '例如 16 貼一張 4，剩 12');
  },
]);

const OCT = [[1.6, 0.2], [0.0, 1.24], [0.56, 3.0], [2.4, 3.4], [4.0, 2.36], [5.6, 3.4], [5.36, 0.6], [3.6, 1.24]].map(([x, y]) => [x, y - 0.7]); // 往下移，避開左上的板書
scene('pfC-12-poly', '多邊形：凸（convex）與凹（concave）', [
  async (tok, S) => { // 4013.7
    S.B = board(-6.6, 6.4); S.B.add('Polygon 多邊形：看邊的個數');
    cap('Polygon：多邊形', '幾個邊就叫幾邊形');
  },
  async (tok, S) => { // 4031.6
    const hex = [0, 1, 2, 3, 4, 5].map((k) => [2.2 + 1.4 * Math.cos(Math.PI / 6 + k * Math.PI / 3), 4.0 + 1.4 * Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
    poly(hex); seg(hex[0], hex[3], '#2fc092'); seg(hex[1], hex[4], '#2fc092'); seg(hex[2], hex[5], '#2fc092');
    T('convex 凸', 'good', 2.2, 1.9);
    S.B.add('convex 凸：對角線不管怎麼畫，都在裡面');
    cap('對角線：連兩個頂點', '凸多邊形：全部對角線都在裡面');
  },
  async (tok, S) => { // 4059.4
    const cc = [[4.6, 2.6], [6.6, 2.6], [6.6, 5.2], [5.6, 3.6], [4.6, 5.2]];
    poly(cc); seg(cc[2], cc[4], '#d64545');
    T('concave 凹', 'bad', 5.6, 1.9);
    S.B.add('concave 凹：有對角線跑到外面');
    cap('凹多邊形：有的對角線在外面', '');
  },
  async (tok, S) => { // 4108.7
    S.B.add('多邊形 = 直線圍成的封閉區域；分凸、凹兩類', 'good');
    cap('直線圍起來的封閉區域', '直線的個數 = 邊數');
  },
]);

scene('pfC-12-tri', '三角剖分：n 邊形切成 n − 2 個三角形', [
  async (tok, S) => { // 4136.6
    S.B = board(-6.6, 6.4); S.B.add('證明：任何 n 邊形都能切成 n − 2 個三角形');
    cap('不管哪一種多邊形', '切成三角形');
  },
  async (tok, S) => { // 4149.3
    const pent = [0, 1, 2, 3, 4].map((k) => [4.6 + 1.2 * Math.cos(Math.PI / 2 + k * 2 * Math.PI / 5), 5.0 + 1.2 * Math.sin(Math.PI / 2 + k * 2 * Math.PI / 5)]);
    S.pent = [...poly(pent), seg(pent[0], pent[2], '#2fc092'), seg(pent[0], pent[3], '#2fc092')];
    S.B.add('凸的：5 → 3、6 → 4、7 → 5、8 → 6');
    cap('凸多邊形很好理解', '五邊形對角線畫出去，切成 3 個');
  },
  async (tok, S) => { // 4192.7
    poly(OCT); S.bad = seg(OCT[3], OCT[5], '#d64545');
    S.B.add('凹的：一刀下去可能切到外面', 'bad');
    cap('凹多邊形一切下去', '可能跑到外面，很難說是不是三角形');
  },
  async (tok, S) => { // 4210.3
    S.B.add('要證：不管凸凹，n 邊形 → n − 2 個三角形');
    cap('目標：任何 n 邊形都能切成 n−2 個', '');
  },
  async (tok, S) => { // 4260.5
    S.B.add('Lemma：至少有一條對角線完全在裡面');
    kill(S.bad); S.good = seg(OCT[0], OCT[3], '#2fc092');
    cap('關鍵：課本的 lemma', '一定找得到一條在內部的對角線');
  },
  async (tok, S) => { // 4294.0
    S.B.add('沿這條內部對角線切成兩塊');
    cap('找一條內部對角線', '把多邊形切成兩部分');
  },
  async (tok, S) => { // 4317.3
    OCT.forEach((p, i) => { const q = OCT[(i + 1) % 8]; T(String(i + 1), 'idx', (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.25); });
    S.B.clear(); S.pent.forEach((o) => kill(o)); S.B.add('例：八邊形（形狀示意）');
    cap('數一下：原來有 8 個邊', '');
  },
  async (tok, S) => { // 4340.1
    T('4 邊形', 'ptr', 1.1, 1.4); T('6 邊形', 'ptr', 4.2, 0.9);
    S.B.add('切開 → 一個四邊形 + 一個六邊形');
    cap('切成一半：一個 4 邊、一個 6 邊', '');
  },
  async (tok, S) => { // 4354.4
    seg(OCT[0], OCT[2], '#4b9ee2');
    [[4, 6], [4, 7], [3, 7]].forEach(([a, b]) => seg(OCT[a], OCT[b], '#4b9ee2'));
    S.B.add('依（強）歸納：4 邊形 → 2 個，6 邊形 → 4 個');
    cap('用歸納假設：4 邊形切成 2 個三角形', '6 邊形切成 4 個');
  },
  async (tok, S) => { // 4380.9
    S.B.add('八邊形 = 4 邊形 + 6 邊形');
    cap('原來是八邊形，切完變 4 跟 6', '');
  },
  async (tok, S) => { // 4393.5
    S.B.add('4 + 6 = 8 + 2 → (4−2) + (6−2) = 8 − 2 = 6 ✓', 'good');
    cap('那一刀多出一條邊，兩塊都用到', '三角形 (4−2)+(6−2) 剛好是 8−2');
  },
]);

// ════════ 5QtHzN4SRZc（Lec13 Induction and Recursion：遞迴定義、結構、遞迴演算法） ════════
// a little drawn tree: nodes [[x,y]…] (relative), edges [[i,j]…]
function tree(nodes, edges, ox, oy, col = FC.green) {
  const ms = nodes.map(([x, y]) => cube('', col, [0.32, 0.32, 0.32], ox + x, oy + y, 0));
  const es = edges.map(([i, j]) => seg([ox + nodes[i][0], oy + nodes[i][1]], [ox + nodes[j][0], oy + nodes[j][1]], '#6e5f49'));
  return { ms, es, kill() { ms.forEach((m) => kill(m)); es.forEach((e) => kill(e)); } };
}

scene('pfC-13-seq', '遞迴定義數列：首項 + 遞迴式', [
  async (tok, S) => { // 35.7
    S.B = board(-6.6, 6.4); S.B.add('遞迴（recursion）：寫程式也會用到');
    cap('今天的主題：遞迴', 'n 推 n+1、推 n+2 的概念');
  },
  async (tok, S) => { // 47.3
    S.B.add('數列：aₙ = f(n)，n 是整數');
    cap('先看最常見的形式：數列', 'aₙ 就是一個以整數 n 為變數的函式');
  },
  async (tok, S) => { // 61.1
    S.B.add('給首項＋用前面的項湊 → 遞迴定義');
    cap('另一種定義法：給首項', '後面的用 aₙ₋₁、aₙ₋₂… 湊出來');
  },
  async (tok, S) => { // 87.1
    S.B.add('aₙ = 2ⁿ（等比）');
    cap('例：aₙ = 2ⁿ', '');
  },
  async (tok, S) => { // 102.3
    S.B.add('a₀ = 1，aₙ = 2 · aₙ₋₁ → 同一個數列');
    const v = [1, 2, 4, 8, 16];
    for (let i = 0; i < v.length; i++) { chip(String(v[i]), FC.blue, 2.0 + i * 1.0, 5.2, 0.8, 0.6, 1); T('a' + '₀₁₂₃₄'[i], 'idx', 2.0 + i * 1.0, 4.6); if (i) T('×2', 'idx', 1.5 + i * 1.0, 5.75); await wt(tok, 150); }
    cap('a₀ = 1，每一項是前一項的兩倍', '跟直接給 2ⁿ 是同一個答案');
  },
  async (tok, S) => { // 148.3
    S.B.add('例：f(0) = 3，f(n+1) = 2f(n) + 3');
    S.f = [chip('3', FC.orange, 2.0, 3.4, 0.8, 0.6, 1)]; T('f(0)', 'idx', 2.0, 2.8);
    cap('f(n+1) = 2f(n) + 3', '首項 f(0) = 3');
  },
  async (tok, S) => { // 158.6
    S.B.add('f(1) = 2·3 + 3 = 9', 'say'); chip('9', FC.orange, 3.2, 3.4, 0.8, 0.6, 1); T('f(1)', 'idx', 3.2, 2.8);
    cap('f(1) = 2·f(0) + 3 = 9', '');
  },
  async (tok, S) => { // 172.3
    S.B.add('f(2) = 2·9 + 3 = 21', 'say'); chip('21', FC.orange, 4.4, 3.4, 0.8, 0.6, 1); T('f(2)', 'idx', 4.4, 2.8);
    cap('f(2) = 2·f(1) + 3 = 21', '');
  },
  async (tok, S) => { // 183.6
    S.B.add('f(3) = 2·21 + 3 = 45', 'say'); chip('45', FC.orange, 5.6, 3.4, 0.8, 0.6, 1); T('f(3)', 'idx', 5.6, 2.8);
    cap('f(3) = 2·f(2) + 3 = 45', '依此類推');
  },
  async (tok, S) => { // 198.0
    S.B.add('階乘：f(0) = 1');
    cap('階乘函式也可以這樣定', '');
  },
  async (tok, S) => { // 213.0
    S.B.add('n! = n · (n−1)! → f(n) = n · f(n−1)');
    cap('n! = n 乘上 (n−1)!', '');
  },
  async (tok, S) => { // 226.4
    S.B.add('一定要有首項！', 'bad');
    cap('要算出這些數字，一定要有首項', '');
  },
  async (tok, S) => { // 233.3
    T('示意：f(0) = 5 → f(1) = 13、f(2) = 29…全部不同', 'note', 3.6, 1.6);
    cap('遞迴式一樣、首項不一樣', '後面的答案全部不一樣');
  },
]);

scene('pfC-13-fib', 'Fibonacci 與 fₙ < 2ⁿ（強歸納）', [
  async (tok, S) => { // 268.2
    S.B = board(-6.6, 6.4, 0.7, 5); S.B.add('Fibonacci：fₙ = fₙ₋₁ + fₙ₋₂');
    cap('Fibonacci 數列', '這一項 = 前兩項相加');
  },
  async (tok, S) => { // 283.0
    S.B.add('跟前兩項有關 → 起始條件要給兩個（像貼郵票）');
    cap('跟前面幾項有關', '起始條件就要給幾項');
  },
  async (tok, S) => { // 296.7
    S.B.add('f₀ = 0，f₁ = 1');
    S.v = [0, 1, 1, 2, 3, 5, 8]; S.c = [];
    for (let i = 0; i < 2; i++) { S.c.push(chip(String(S.v[i]), FC.blue, 1.0 + i * 0.95, 2.9, 0.8, 0.6, 1)); T('f' + '₀₁₂₃₄₅₆'[i], 'idx', 1.0 + i * 0.95, 2.35); }
    cap('首項 f₀ = 0，f₁ = 1', '');
  },
  async (tok, S) => { // 299.8
    S.c.push(chip('1', FC.green, 1.0 + 2 * 0.95, 2.9, 0.8, 0.6, 1)); T('f₂', 'idx', 1.0 + 2 * 0.95, 2.35);
    S.B.add('f₂ = f₀ + f₁ = 1', 'say');
    cap('f₂ = 0 + 1 = 1', '');
  },
  async (tok, S) => { // 302.1
    for (let i = 3; i < 7; i++) { S.c.push(chip(String(S.v[i]), FC.green, 1.0 + i * 0.95, 2.9, 0.8, 0.6, 1)); T('f' + '₀₁₂₃₄₅₆'[i], 'idx', 1.0 + i * 0.95, 2.35); await wt(tok, 150); }
    S.B.add('f₃ = f₁ + f₂ = 2，f₄ = 3，f₅ = 5，…', 'say');
    cap('f₃ = 1 + 1 = 2，這樣推下來', '');
  },
  async (tok, S) => { // 320.6
    S.B.add('起始條件一定要給足');
    cap('跟前兩項有關，起始條件就要兩個', '有時候不只一項');
  },
  async (tok, S) => { // 333.4
    S.B.add('估計大小：證明 fₙ < 2ⁿ');
    ['1', '2', '4', '8', '16', '32', '64'].forEach((t, i) => T('2ⁿ=' + t, 'idx', 1.0 + i * 0.95, 1.85));
    cap('不知道 fₙ 確切多少，先估計', '至少知道不會超過 2ⁿ');
  },
  async (tok, S) => { // 374.1
    S.B.add('本質跟歸納法一樣：兩個 basis');
    cap('遞迴式的證明大多用數學歸納法', '給了兩個起始條件 → 兩個 basis');
  },
  async (tok, S) => { // 386.0
    S.B.add('n = 0：f₀ = 0 < 2⁰ = 1 ✓', 'say'); glow(S.c[0], OKG);
    cap('n = 0：0 < 1，成立', '');
  },
  async (tok, S) => { // 397.9
    S.B.add('n = 1：f₁ = 1 < 2¹ = 2 ✓', 'say'); glow(S.c[1], OKG);
    cap('n = 1：1 < 2，成立', '');
  },
  async (tok, S) => { // 408.8
    S.B.add('跟前兩項有關 → 用強數學歸納法');
    cap('因為跟前兩項有關', '要用強數學歸納法（第二歸納法）');
  },
  async (tok, S) => { // 423.9
    S.B.add('假設所有 k < n（n ≥ 2）：f_k < 2ᵏ');
    cap('考慮 n 時，先假設比 n 小的都對', '');
  },
  async (tok, S) => { // 441.5
    S.B.add('fₙ = fₙ₋₁ + fₙ₋₂ < 2ⁿ⁻¹ + 2ⁿ⁻²');
    cap('n−1、n−2 都落在假設的範圍', '各自用假設換掉');
  },
  async (tok, S) => { // 459.9
    S.B.add('< 2ⁿ⁻¹ + 2ⁿ⁻¹ = 2ⁿ ✓', 'good'); S.c.forEach((m) => glow(m, OKG));
    cap('把 2ⁿ⁻² 放大成 2ⁿ⁻¹', '兩個相加就是 2ⁿ');
  },
  async (tok, S) => { // 482.8
    T('記得照 ① ② ③ 標準順序寫', 'note', 3.8, 1.0);
    cap('證明結束', '記得 1、2、3 照順序寫');
  },
  async (tok, S) => { // 491.1
    T('練習：n ≥ 3 時 fₙ > αⁿ⁻²，α = (1+√5)/2', 'say', 3.0, 0.3);
    T('basis 要驗 n = 3、4', 'idx', 3.0, -0.3);
    cap('練習：同樣技巧證 fₙ > αⁿ⁻²', 'basis 驗第 3、4 項');
  },
]);

scene('pfC-13-lame', 'Lamé 定理：輾轉相除法的次數', [
  async (tok, S) => { // 558.0
    S.B = board(-6.6, 6.4); S.B.add('輾轉相除法：電腦算得出來，但要除幾次？');
    cap('輾轉相除法可以算', '問題是要算幾次');
  },
  async (tok, S) => { // 577.4
    S.B.add('RSA：數字可能有 100、200 位');
    cap('上次的 RSA：數字非常大', '二進位可能 100、200 位');
  },
  async (tok, S) => { // 601.9
    S.B.add('如果要除一千萬次 → 一兩天才算完，沒實用性', 'bad');
    cap('除法次數太多就沒有實用性', '');
  },
  async (tok, S) => { // 617.4
    S.B.add('定理：除法的次數其實很合理');
    cap('這個定理保證次數不會太誇張', '');
  },
  async (tok, S) => { // 634.5
    S.B.add('例：五位數（例如一萬多）');
    ['萬', '千', '百', '十', '個'].forEach((d, i) => chip(d, FC.sky, 2.0 + i * 0.9, 3.6, 0.7, 0.6, 1));
    cap('以十進位來看：五個位數', '一萬、兩萬、三萬多都一樣');
  },
  async (tok, S) => { // 653.9
    S.B.add('除法次數 ≤ 5 × 位數 = 5 × 5 = 25 次', 'good');
    cap('次數不會超過位數的五倍', '五位數 → 最多 25 次');
  },
  async (tok, S) => { // 675.1
    S.B.add('提示：除數下一步變被除數 → 兩步一起看規律');
    cap('練習：試著證明', '每兩步觀察一次規則');
  },
]);

scene('pfC-13-set3', '遞迴定義集合：3 ∈ S；x, y ∈ S → x + y ∈ S', [
  async (tok, S) => { // 769.6
    S.B = board(-6.6, 6.4, 0.7, 4); S.B.add('遞迴不只定義數列：大的東西拆成小的來說');
    cap('不一定是數列', '大東西不好講，就拆成小的');
  },
  async (tok, S) => { // 791.3
    S.B.add('定義一個集合 S（沒直接說它是什麼）');
    S.z = zone('S', 3.6, 1.2, 0, 5.4, 3.0);
    cap('定義一個集合 S', '題目只給幾條簡單的 rule');
  },
  async (tok, S) => { // 812.4
    S.B.add('① 起始：3 ∈ S');
    S.n3 = chip('3', FC.blue, 1.6, 1.6, 0.8, 0.6, 1.5);
    cap('集合裡有一個數字 3', '這是起始條件');
  },
  async (tok, S) => { // 820.2
    S.B.add('② 規則：x ∈ S 且 y ∈ S → x + y ∈ S');
    cap('兩個在 S 裡的數相加', '結果也在 S 裡');
  },
  async (tok, S) => { // 833.6
    S.B.add('起始條件 + 規則 = 遞迴（recursive）定義');
    cap('這就是遞迴的定義', '用已知的生出新的');
  },
  async (tok, S) => { // 897.4
    T('只有一個 3，找不到第二個數？', 'bad', 3.6, 3.4);
    cap('x + y 要兩個數', '可是只給了一個 3');
  },
  async (tok, S) => { // 930.3
    S.B.add('x、y 可以一樣！x = y = 3 → 6 ∈ S');
    chip('6', FC.green, 2.8, 1.6, 0.8, 0.6, 1.5);
    cap('沒說 x 和 y 要不一樣', '3 + 3 = 6');
  },
  async (tok, S) => { // 962.4
    S.B.add('x = 3，y = 6 → 9 ∈ S', 'say');
    chip('9', FC.green, 4.0, 1.6, 0.8, 0.6, 1.5);
    cap('3 + 6 = 9', '');
  },
  async (tok, S) => { // 972.7
    chip('12', FC.green, 5.2, 1.6, 0.8, 0.6, 1.5); chip('15', FC.green, 1.6, 0.6, 0.8, 0.6, 1.5); T('…', 'say', 2.8, 0.6);
    cap('一直這樣加下去', '');
  },
  async (tok, S) => { // 981.2
    S.B.add('S = {3k | k ∈ ℤ⁺}：3 的正倍數', 'good');
    cap('歸納出來：S 就是 3 的正倍數', '');
  },
]);

scene('pfC-13-str', '字串與字母集 Σ', [
  async (tok, S) => { // 1011.5
    S.B = board(-6.6, 6.4); S.B.add('字串（string）');
    cap('另一種集合：字串', '');
  },
  async (tok, S) => { // 1029.3
    S.B.add('字母集 Σ = {a, b, …, z}（26 個）');
    cap('字母集通常用 Σ 表示', '先用記憶中的 a 到 z');
  },
  async (tok, S) => { // 1054.8
    S.B.add('Σ⁰ = {λ}：長度 0（空字串）');
    chip('λ', FC.gray, 2.6, 5.2, 0.8, 0.6, 1); T('Σ⁰', 'ptr', 1.6, 5.2);
    cap('Σ⁰：長度 0 的字串', '只有一個：空字串');
  },
  async (tok, S) => { // 1074.9
    S.B.add('Σ¹ = {a, b, c, …, z}：長度 1');
    ['a', 'b', 'c', '…', 'z'].forEach((t, i) => chip(t, FC.blue, 2.6 + i * 0.85, 4.2, 0.7, 0.6, 1)); T('Σ¹', 'ptr', 1.6, 4.2);
    cap('Σ¹：長度 1 的字串', 'a、b、c 一直到 z');
  },
  async (tok, S) => { // 1097.8
    S.B.add('Σ² = {aa, ab, …, zz}：順序有關');
    ['aa', 'ab', '…', 'ba', 'bb', '…'].forEach((t, i) => chip(t, FC.orange, 2.6 + i * 0.85, 3.2, 0.8, 0.6, 1)); T('Σ²', 'ptr', 1.6, 3.2);
    cap('Σ²：長度 2 的字串', 'ab 跟 ba 不一樣');
  },
  async (tok, S) => { // 1125.9
    S.B.add('|Σ⁰| = 1，|Σ¹| = 26，|Σ²| = 26²', 'say');
    cap('大小：1、26、26²……', '');
  },
  async (tok, S) => { // 1153.6
    S.B.add('Σ* = Σ⁰ ∪ Σ¹ ∪ Σ² ∪ …：所有字串');
    cap('全部聯集起來：所有字串的集合', '長度可以 100、200，也可以是空字串');
  },
  async (tok, S) => { // 1201.6
    S.B.add('字母集可以換：程式的變數名、正規語言', 'say');
    cap('字母集可以換', '以後寫程式、正規語言都會用到');
  },
  async (tok, S) => { // 1224.3
    S.B.add('Σ = {0, 1} → 二進位字串');
    ['0', '1', '01', '110'].forEach((t, i) => chip(t, FC.teal, 2.6 + i * 1.0, 1.0, 0.8, 0.6, 1));
    cap('字母集是 {0, 1}', '列出來的就是一串串二進位');
  },
]);

scene('pfC-13-sigstar', '遞迴定義 Σ*：一步步拼出 apple', [
  async (tok, S) => { // 1251.3
    S.B = board(-6.6, 6.4); S.B.add('用遞迴定義 Σ*（所有字串）');
    cap('同一個 Σ*', '這次用遞迴來定義');
  },
  async (tok, S) => { // 1273.4
    S.B.add('① 起始：λ ∈ Σ*（空字串）');
    cap('最短的字串是空字串', '用 λ 表示');
  },
  async (tok, S) => { // 1297.9
    S.B.add('② 規則：w ∈ Σ*、x ∈ Σ → wx ∈ Σ*');
    cap('舊字串後面接一個字母', '得到新的字串');
  },
  async (tok, S) => { // 1331.6
    S.B.add('例：ab ∈ Σ*，x ∈ Σ → "abx" ∈ Σ*', 'say');
    cap('已知 "ab" 是字串，x 是字母', '所以 "abx" 也是字串');
  },
  async (tok, S) => { // 1376.9
    S.B.add('證明 "apple" ∈ Σ*');
    S.rail = cube('', FC.sand, [6.0, 0.12, 0.8], 3.6, 1.6, 0);
    cap('隨便舉個例子：apple', '要重複用這兩條規則');
  },
  async (tok, S) => { // 1412.2
    S.B.add('1. λ ∈ Σ*', 'say');
    S.w = T('目前：λ', 'note', 3.6, 3.0);
    cap('先知道：空字串在 Σ* 裡', '');
  },
  async (tok, S) => { // 1423.8
    S.B.add('2. a ∈ Σ → "a" ∈ Σ*', 'say');
    S.k = [chip('a', FC.blue, 1.2, 2.0, 0.7, 0.6, 1.5)]; txt(S.w, '目前："a"');
    cap('a 是字母，接在空字串後面', '得到 "a"');
  },
  async (tok, S) => { // 1453.8
    S.B.add('3. p ∈ Σ → "ap" ∈ Σ*', 'say');
    S.k.push(chip('p', FC.blue, 2.1, 2.0, 0.7, 0.6, 1.5)); txt(S.w, '目前："ap"');
    cap('再接一個 p', '"ap" 也在 Σ* 裡');
  },
  async (tok, S) => { // 1473.1
    S.B.add('4. p ∈ Σ → "app" ∈ Σ*', 'say');
    S.k.push(chip('p', FC.blue, 3.0, 2.0, 0.7, 0.6, 1.5)); txt(S.w, '目前："app"');
    cap('再接一個 p', '"app"');
  },
  async (tok, S) => { // 1486.5
    S.B.add('5–6. 接 l、e → "apple" ∈ Σ* ✓', 'good');
    S.k.push(chip('l', FC.blue, 3.9, 2.0, 0.7, 0.6, 1.5)); await wt(tok, 300); S.k.push(chip('e', FC.blue, 4.8, 2.0, 0.7, 0.6, 1.5));
    S.k.forEach((m) => glow(m, OKG)); txt(S.w, '"apple" ∈ Σ* ✓');
    cap('幾次之後，apple 確實在 Σ* 裡', '');
  },
  async (tok, S) => { // 1511.3
    T('練習：「長度聯集」和「遞迴」兩種定義，得到同一個集合', 'say', 2.4, 0.6);
    cap('兩種定義的 Σ* 一模一樣', '請試著證明');
  },
]);

scene('pfC-13-tree', '遞迴定義有根樹（rooted tree）', [
  async (tok, S) => { // 1547.2
    S.B = board(-6.6, 6.4); S.B.add('樹（tree）：考試不考，但要知道概念');
    cap('這種東西叫樹', '');
  },
  async (tok, S) => { // 1554.9
    S.B.add('黑點 = 節點（node），連線 = 邊（edge）');
    S.t0 = tree([[0, 1.2], [-0.8, 0], [0.8, 0], [0.8, -1.0]], [[0, 1], [0, 2], [2, 3]], 4.0, 4.2, FC.gray);
    cap('節點與邊', '抽象地講樹是什麼很難');
  },
  async (tok, S) => { // 1570.5
    S.t0.kill();
    S.B.add('① 起始：一個點就是一棵有根樹');
    tree([[0, 0]], [], 1.2, 4.6); T('一個點', 'idx', 1.2, 4.0);
    cap('給一個建構式的定義', '起始：只有一個點，它就是樹根');
  },
  async (tok, S) => { // 1596.7
    S.B.add('② 規則：T₁, …, Tₙ 是樹 → 加一個新根，連到每棵的根');
    cap('有好幾棵樹 T₁、T₂…Tₙ', '多一個新節點，連到每棵樹的根');
  },
  async (tok, S) => { // 1645.7
    tree([[0, 0.9], [0, 0]], [[0, 1]], 2.8, 4.2); T('一棵 + 新根', 'idx', 2.8, 3.6);
    cap('一棵樹 + 新樹根', '連起來是新的有根樹');
  },
  async (tok, S) => { // 1673.8
    tree([[0.5, 0.9], [0, 0], [1.0, 0]], [[0, 1], [0, 2]], 4.1, 4.2); T('兩棵 + 新根', 'idx', 4.6, 3.6);
    cap('兩棵樹上面再擺一個新根', '也是一棵樹');
  },
  async (tok, S) => { // 1695.7
    tree([[1.0, 1.0], [0, 0], [1.0, 0], [2.0, 0], [0, -0.9], [2.0, -0.9]], [[0, 1], [0, 2], [0, 3], [1, 4], [3, 5]], 2.0, 1.8);
    T('再組合：越長越大', 'idx', 3.0, 0.4);
    cap('把已經做好的樹再組合', '放一個新根，連過去');
  },
  async (tok, S) => { // 1771.5
    S.B.add('名詞：樹根、子樹、父親、小孩、兄弟', 'good');
    T('樹根', 'ptr', 3.0, 3.25); T('兄弟', 'idx', 4.6, 1.3);
    cap('最上面是樹根；底下整棵是子樹', '像族譜：父親、小孩、兄弟');
  },
]);

scene('pfC-13-btree', '遞迴定義二元樹（extended binary tree）', [
  async (tok, S) => { // 1811.3
    S.B = board(-6.6, 6.4); S.B.add('二元樹（binary tree）');
    cap('另一種：二元樹', '跟有根樹稍微不一樣');
  },
  async (tok, S) => { // 1821.7
    S.B.add('① 起始：空的（什麼都沒有）也是一棵二元樹');
    cap('起始條件不一樣', '什麼都沒有也是一棵二元樹');
  },
  async (tok, S) => { // 1856.5
    S.B.add('② 規則：T₁（左）、T₂（右）+ 一個新根');
    cap('只能接兩棵：T₁ 和 T₂', '每個人最多兩個小孩');
  },
  async (tok, S) => { // 1897.7
    S.mini = [T('∅', 'note', 1.4, 4.6), T('最小的二元樹', 'idx', 1.4, 4.0)];
    cap('最小的二元樹是什麼？', '是空的，這要小心');
  },
  async (tok, S) => { // 1917.9
    S.mini.push(T('∅', 'idx', 2.7, 4.0), T('∅', 'idx', 3.9, 4.0), tree([[0, 0]], [], 3.3, 4.8), T('→ 一個點', 'say', 4.9, 4.8));
    cap('左邊放空樹、右邊放空樹、加樹根', '空的沒有根可以連 → 只剩一個點');
  },
  async (tok, S) => { // 1945.3
    S.bt = tree([[1.0, 1.2], [0, 0], [2.0, 0], [-0.6, -1.0]], [[0, 1], [0, 2], [1, 3]], 2.4, 1.6);
    T('左兒子', 'ptr', 2.0, 1.0); T('右兒子', 'ptr', 4.8, 1.0);
    cap('只有兩個，所以有順序', '左兒子、右兒子');
  },
  async (tok, S) => { // 1968.9
    T('左子樹', 'idx', 1.6, 0.1); T('右子樹', 'idx', 4.4, 0.6);
    cap('左兒子下面整串：左子樹', '右邊的：右子樹');
  },
  async (tok, S) => { // 2012.3
    S.mini.forEach((o) => (o.kill ? o.kill() : kill(o))); S.B.add('有根樹：最小是一個點；小孩不限個數、不分順序', 'say');
    cap('比較：有根樹最小是一個點', '小孩隨便生，畫左畫右都一樣');
  },
  async (tok, S) => { // 2059.6
    S.B.add('二元樹：只有左兒子 ≠ 只有右兒子');
    tree([[0, 0.8], [-0.5, 0]], [[0, 1]], -1.0, 0.4, FC.purple); tree([[0, 0.8], [0.5, 0]], [[0, 1]], 0.4, 0.4, FC.purple);
    T('≠', 'note', -0.3, 0.8);
    cap('同樣一個小孩', '一個是左邊有兒子，一個是右邊有兒子');
  },
  async (tok, S) => { // 2110.5
    S.B.add('有兒子：內部節點；沒兒子：葉子（leaf）', 'good');
    S.bt.ms.forEach((m, i) => tint(m, i === 2 || i === 3 ? FC.orange : FC.green));
    cap('有兒子的：internal node', '沒兒子的：leaf，像樹葉');
  },
]);

scene('pfC-13-pow', '遞迴演算法：power(5, 3) 的呼叫過程', [
  async (tok, S) => { // 2135.9
    S.B = board(-6.6, 6.4); S.B.add('遞迴演算法：把遞迴定義直接寫成程式');
    cap('遞迴演算法', '剛才的概念直接寫成程式');
  },
  async (tok, S) => { // 2147.8
    S.B.add('aⁿ：for 迴圈，每次乘一個 a', 'say');
    cap('算 aⁿ：寫一個 for 迴圈', '乘 n 次 a');
  },
  async (tok, S) => { // 2165.2
    S.B.add('aⁿ = a · aⁿ⁻¹');
    cap('aⁿ = a 乘 aⁿ⁻¹', 'aⁿ⁻¹ 自己呼叫自己就算得出來');
  },
  async (tok, S) => { // 2180.5
    S.B.clear();
    S.code = code(['procedure power(a, n)', 'if n = 0 then return 1', 'else return a · power(a, n − 1)'], -3.4, 6.4);
    S.code.hl(2);
    cap('函式叫 power', '回傳 a 乘 power(a, n−1)');
  },
  async (tok, S) => { // 2200.0
    T('一定要有停止條件！', 'bad', -3.4, 4.4);
    cap('一直簡化，最後一定要停', '寫程式叫終止條件');
  },
  async (tok, S) => { // 2221.7
    S.code.hl(1);
    cap('n = 0：任何數的 0 次方是 1', '三行就寫完了');
  },
  async (tok, S) => { // 2239.2
    S.code.hl(-1); T('trace：power(5, 3)', 'note', -3.4, 3.6);
    S.st = []; S.push = (t) => { const m = chip(t, FC.sky, 3.6, 0.6 + S.st.length * 0.85, 3.6, 0.7, 1.2); S.st.push(m); return m; };
    T('堆疊（stack）', 'ptr', 3.6, -0.2);
    cap('追蹤函式呼叫的過程', '要算 5³');
  },
  async (tok, S) => { // 2260.5
    S.code.hl(2); S.push('power(5,3) = 5 · power(5,2)');
    cap('n = 3 ≠ 0 → 5 · power(5, 2)', '乘法先冷凍起來，放進堆疊');
  },
  async (tok, S) => { // 2299.7
    S.push('power(5,2) = 5 · power(5,1)');
    cap('進到函式開頭，算 5²', '5 · power(5, 1)，再冷凍');
  },
  async (tok, S) => { // 2334.8
    S.push('power(5,1) = 5 · power(5,0)');
    cap('n 還是不等於 0', '5 · power(5, 0)');
  },
  async (tok, S) => { // 2344.9
    S.code.hl(1); const m = S.push('power(5,0) = 1'); tint(m, FC.green);
    cap('n = 0：直接回傳 1', '');
  },
  async (tok, S) => { // 2377.6
    kill(S.st.pop()); S.code.hl(2); txt(S.st[2].userData.lbl, 'power(5,1) = 5 · 1 = 5'); tint(S.st[2], FC.green);
    cap('5 · 1 = 5', '回到上一層');
  },
  async (tok, S) => { // 2400.7
    kill(S.st.pop()); txt(S.st[1].userData.lbl, 'power(5,2) = 5 · 5 = 25'); tint(S.st[1], FC.green);
    cap('從冷凍庫拿出來：5 · 5 = 25', '');
  },
  async (tok, S) => { // 2411.0
    kill(S.st.pop()); txt(S.st[0].userData.lbl, 'power(5,3) = 5 · 25 = 125'); tint(S.st[0], FC.green); glow(S.st[0], OKG);
    cap('再拿出來：5 · 25 = 125', '答案 125');
  },
  async (tok, S) => { // 2416.2
    T('大問題冷凍在堆疊 → 小問題算完 → 一層層還回來', 'say', 0.0, 2.6);
    cap('這就是遞迴呼叫', '');
  },
  async (tok, S) => { // 2439.5
    T('呼叫次數 ∝ 計算時間：5¹⁰ 要呼叫 11 次（n = 10…0）', 'note', 0.0, 1.9);
    cap('呼叫越多次，花的時間越多', '5¹⁰ 要呼叫 11 次（n = 10…0）');
  },
]);

scene('pfC-13-fastpow', '更快的遞迴：n 是偶數就對半', [
  async (tok, S) => { // 2470.7
    S.B = board(-6.6, 6.4); S.B.add('mpower：bⁿ mod m = (b · (bⁿ⁻¹ mod m)) mod m');
    cap('加上 mod 的版本', '一樣是 b 乘 bⁿ⁻¹，再取餘數');
  },
  async (tok, S) => { // 2500.2
    S.B.add('n 偶數（n = 2k）：bⁿ = (bᵏ)² → 一次砍一半');
    cap('n 是偶數時，先算 b^(n/2) 再平方', '10 一次就剩 5');
  },
  async (tok, S) => { // 2538.8
    S.B.add('trace：5¹⁰（先不看 mod）');
    S.st = []; S.push = (t) => { const m = chip(t, FC.sky, 3.4, 0.6 + S.st.length * 0.8, 3.8, 0.65, 1.2); S.st.push(m); return m; };
    cap('跟著程式走一次', '算 5¹⁰');
  },
  async (tok, S) => { // 2562.5
    S.push('power(5,10) = power(5,5)²');
    cap('10 不是 0，是 2 的倍數', '先算 power(5, 5) 再平方');
  },
  async (tok, S) => { // 2615.3
    S.push('power(5,5) = 5 · power(5,4)');
    cap('5 不能被 2 整除', '用另一條：5 · power(5, 4)');
  },
  async (tok, S) => { // 2631.9
    S.push('power(5,4) = power(5,2)²');
    cap('4 是偶數', 'power(5, 2) 再平方');
  },
  async (tok, S) => { // 2647.6
    S.push('power(5,2) = power(5,1)²');
    cap('2 是偶數', 'power(5, 1) 再平方');
  },
  async (tok, S) => { // 2675.0
    S.push('power(5,1) = 5 · power(5,0)');
    cap('1 是奇數', '5 · power(5, 0)');
  },
  async (tok, S) => { // 2682.1
    tint(S.push('power(5,0) = 1'), FC.green); await wt(tok, 300);
    kill(S.st.pop()); txt(S.st[4].userData.lbl, 'power(5,1) = 5 · 1 = 5'); tint(S.st[4], FC.green);
    cap('5⁰ = 1，1 · 5 = 5', '');
  },
  async (tok, S) => { // 2699.0
    kill(S.st.pop()); txt(S.st[3].userData.lbl, 'power(5,2) = 5² = 25'); tint(S.st[3], FC.green);
    cap('5 的平方 = 25', '');
  },
  async (tok, S) => { // 2705.0
    kill(S.st.pop()); txt(S.st[2].userData.lbl, 'power(5,4) = 25² = 625'); tint(S.st[2], FC.green);
    cap('25 的平方 = 625', '');
  },
  async (tok, S) => { // 2713.4
    kill(S.st.pop()); txt(S.st[1].userData.lbl, 'power(5,5) = 625 · 5 = 3125'); tint(S.st[1], FC.green);
    cap('625 · 5 = 3125', '');
  },
  async (tok, S) => { // 2716.0
    kill(S.st.pop()); txt(S.st[0].userData.lbl, 'power(5,10) = 3125² = 9765625'); tint(S.st[0], FC.green); glow(S.st[0], OKG);
    cap('再平方：3125² = 9765625 = 5¹⁰', '');
  },
  async (tok, S) => { // 2729.8
    S.B.add('只呼叫 6 次（原本要 11 次）', 'good');
    cap('呼叫了 6 次', '比原來的 11 次少很多');
  },
  async (tok, S) => { // 2764.4
    S.B.add('壞寫法：power(5,5) · power(5,5) → 算兩次、一直分岔', 'bad');
    cap('不寫平方、呼叫自己兩次', '電腦會兩條路都算，反而更慢');
  },
]);

scene('pfC-13-gcd', '遞迴的 gcd（Euclid 演算法）', [
  async (tok, S) => { // 2852.9
    S.B = board(-6.6, 6.4); S.B.add('Euclid 演算法也能寫成遞迴');
    S.code = code(['procedure gcd(a, b)   {0 ≤ a < b}', 'if a = 0 then return b', 'else return gcd(b mod a, a)'], -3.2, 5.6);
    cap('輾轉相除法的遞迴版', '');
  },
  async (tok, S) => { // 2871.1
    S.code.hl(1);
    cap('a 是 0 的話，答案就是 b', '');
  },
  async (tok, S) => { // 2876.0
    S.code.hl(2);
    ['gcd(4, 10)', '→ gcd(10 mod 4, 4) = gcd(2, 4)', '→ gcd(4 mod 2, 2) = gcd(0, 2)', '→ 2'].forEach((t, i) => L(t, i === 3 ? 'good' : 'say', 0.8, 3.4 - i * 0.6));
    T('示意', 'idx', 0.8, 4.0);
    cap('不是 0：用 b 除以 a 的餘數，順序要換', '不用另外的變數交換');
  },
  async (tok, S) => { // 2895.5
    S.code.hl(1); T('一定要有終止條件，否則永遠停不了', 'bad', 0.0, 0.6);
    cap('最主要：一定要有終止條件', '不然程式永遠停不了');
  },
]);

scene('pfC-13-msort', 'Merge sort：10, 6, 5, 7, 8, 3, 2', [
  async (tok, S) => { // 2911.0
    S.B = board(-6.6, 6.4); S.B.add('排序：把大問題弄成小問題');
    cap('寫演算法第一個學的：排序', '就像期末排成績');
  },
  async (tok, S) => { // 2930.8
    S.B.add('最原始：先抓最大的，再抓剩下最大的', 'say');
    cap('一個一個比，記住目前最大的', '不是很好，但很好寫');
  },
  async (tok, S) => { // 2949.8
    S.B.add('Merge sort：100 個學生 → 50 + 50');
    cap('不要一次處理 100 個', '先分兩堆，各自排好');
  },
  async (tok, S) => { // 2984.6
    S.B.add('兩堆排好 → 比兩堆的頂，大的先拿（像撲克牌）');
    cap('像撲克牌：兩疊都排好、最大的在上面', '比兩疊的頂端，拿大的');
  },
  async (tok, S) => { // 3020.7
    S.B.add('那 50 個怎麼排？再切一半 → 遞迴');
    cap('剩下 50 個怎麼辦？', '再切成 25、25，一直切');
  },
  async (tok, S) => { // 3053.8
    S.B.clear();
    S.row = (vals, x0, y, col = FC.blue) => vals.map((v, i) => chip(String(v), col, x0 + i * 0.75, y, 0.62, 0.55, 1));
    S.r0 = S.row([10, 6, 5, 7, 8, 3, 2], -2.3, 6.2);
    T('例：由大排到小', 'idx', -4.4, 6.2);
    cap('例：10, 6, 5, 7, 8, 3, 2', '由大排到小');
  },
  async (tok, S) => { // 3076.8
    S.row([10, 6, 5], -5.6, 5.0); S.row([7, 8, 3, 2], 1.0, 5.0);
    cap('先切一半', '左邊 3 個、右邊 4 個');
  },
  async (tok, S) => { // 3098.6
    S.row([10], -6.4, 3.8); S.row([6, 5], -4.6, 3.8); S.row([6], -5.0, 2.6); S.row([5], -3.8, 2.6);
    cap('三個再切：10 | 6, 5', '6, 5 再切成 6 | 5；一個的不用排');
  },
  async (tok, S) => { // 3137.0
    S.row([6, 5], -4.6, 1.4, FC.green);
    cap('合併 6 和 5：誰比較大？6', '6 先放，再放 5');
  },
  async (tok, S) => { // 3155.8
    S.row([10, 6, 5], -5.6, 0.2, FC.green);
    cap('合併 10 | 6, 5：頂端 10 vs 6', '10 先拿，剩下 6、5');
  },
  async (tok, S) => { // 3181.5
    S.row([7, 8], 0.4, 3.8); S.row([3, 2], 2.8, 3.8);
    cap('右邊四個也切一半', '7, 8 一組；3, 2 一組');
  },
  async (tok, S) => { // 3189.0
    S.row([8, 7], 0.4, 2.6, FC.green);
    cap('7 | 8 → 8 比較大', '排成 8, 7');
  },
  async (tok, S) => { // 3211.5
    S.row([3, 2], 2.8, 2.6, FC.green);
    cap('3 | 2 → 3 比較大', '排成 3, 2');
  },
  async (tok, S) => { // 3232.3
    S.row([8, 7, 3, 2], 1.0, 1.4, FC.green);
    cap('合併：8 vs 3 → 8；7 vs 3 → 7', '剩 3、2 照放');
  },
  async (tok, S) => { // 3247.8
    const out = S.row([10, 8, 7, 6, 5, 3, 2], -2.3, -0.6, FC.orange); out.forEach((m) => glow(m, OKG));
    cap('最後合併：10 vs 8 → 10；8 vs 6 → 8…', '10, 8, 7, 6, 5, 3, 2');
  },
  async (tok, S) => { // 3279.2
    T('Merge sort 比 selection sort 快很多，用遞迴寫', 'note', 2.6, 0.2);
    cap('這就是 merge sort', '效能比 selection sort 好很多');
  },
], [[0, 3.2, 14.5], [0, 2.6, 0]]);

scene('pfC-13-mscode', 'mergesort 與 merge 的程式', [
  async (tok, S) => { // 3294.0
    S.code = code(['procedure mergesort(L = a₁, …, aₙ)', 'if n > 1 then', '   m := ⌊n/2⌋', '   L₁ := a₁, …, aₘ;  L₂ := aₘ₊₁, …, aₙ', '   L := merge(mergesort(L₁), mergesort(L₂))', '{ L 已排好 }'], -2.4, 6.4);
    S.code.hl(4);
    cap('切一半，兩半各自排序，再 merge', '相信兩半排得完');
  },
  async (tok, S) => { // 3330.9
    S.code.hl(1);
    cap('一直切到只剩 1 個', 'n = 1 不進來，直接回傳');
  },
  async (tok, S) => { // 3354.0
    S.code.hl(-1);
    T('merge（示意，程式是小排到大）', 'ptr', 3.0, 2.8);
    S.a = [2, 5, 6].map((v, i) => chip(String(v), FC.blue, 1.0 + i * 0.8, 2.0, 0.6, 0.55)); S.b = [3, 7].map((v, i) => chip(String(v), FC.orange, 4.2 + i * 0.8, 2.0, 0.6, 0.55));
    T('i', 'ptr', 1.0, 1.4); T('j', 'ptr', 4.2, 1.4);
    [2, 3, 5, 6].forEach((v, i) => chip(String(v), FC.green, 1.6 + i * 0.8, 0.6, 0.6, 0.55, 1));
    cap('i、j 指著兩疊目前的位置', '比 aᵢ 和 bⱼ，小的先放');
  },
  async (tok, S) => { // 3413.1
    chip('7', FC.green, 1.6 + 4 * 0.8, 0.6, 0.6, 0.55, 1);
    T('一疊空了 → 另一疊剩下的直接 copy', 'note', 3.0, -0.2);
    cap('其中一疊空了', '另一疊剩下的照抄過來');
  },
]);

scene('pfC-13-ack', 'Ackermann 函數 A(m, n)', [
  async (tok, S) => { // 3428.3
    S.B = board(-6.6, 6.4); S.B.add('Ackermann function（Rosen 的定義）');
    S.B.add('A(m, n) = 2n　　　　　　　若 m = 0', 'say');
    S.B.add('　　　　 = 0　　　　　　　 若 m ≥ 1, n = 0', 'say');
    S.B.add('　　　　 = 2　　　　　　　 若 m ≥ 1, n = 1', 'say');
    S.B.add('　　　　 = A(m−1, A(m, n−1))　若 m ≥ 1, n ≥ 2', 'say');
    cap('不要小看這個：Ackermann 函數', '');
  },
  async (tok, S) => { // 3446.8
    S.B.add('作業：A(2, 2) = ?');
    cap('回去練習：算 A(2, 2)', '要像追蹤函式呼叫一樣一個一個帶');
  },
  async (tok, S) => { // 3468.0
    S.B.set(4, 'ptr alt');
    cap('m = 2 不是 0；n = 2 不是 0 也不是 1', '只能用最後一條遞迴式');
  },
  async (tok, S) => { // 3493.0
    S.B.add('A(2, 2) = A(1, A(2, 1))：先算裡面的 A(2, 1) = 2', 'say');
    S.B.add('= A(1, 2) = A(0, A(1, 1)) = A(0, 2) = 4', 'good');
    cap('A(2, 2) = A(1, A(2, 1))', '先跑進去算 A(2, 1)，再帶回來');
  },
  async (tok, S) => { // 3511.5
    S.B.add('回去再算 A(3, 3)（會非常大）');
    cap('看起來很簡單', '回去再算 A(3, 3)');
  },
]);

// ════════ 趙啟超 第3A–3D講（Mathematical Induction and Functions） ════════
function oval(cx, cy, rx, ry, color = '#6e5f49') { const p = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return poly(p, color); }
const dot = (t, c, x, y) => chip(t, c, x, y, 0.55, 0.45);
const arr = (a, b, color = 0x6e5f49) => arrow(V3(a[0], a[1], 0), V3(b[0], b[1], 0), color);

// ── 3A ──
scene('pfC-3a-prin', '數學歸納法的原理：basis、hypothesis、step', [
  async (tok, S) => { // 26.2
    S.B = board(-6.6, 6.4); S.B.add('數學歸納法（mathematical induction）');
    cap('今天教數學歸納法', '以前應該學過，後面會強調注意的地方');
  },
  async (tok, S) => { // 44.0
    S.B.add('statement S(n)：裡面有一個變數 n');
    cap('有一個 statement S(n)', '裡面有個 variable n');
  },
  async (tok, S) => { // 62.6
    S.B.add('第一點：n = 1 帶進去，S(1) 成立');
    S.D = dominoes(7, 1.0, 0.3, 0.9, FC.blue, ['S(1)', 'S(2)', 'S(3)', 'S(4)', 'S(5)', 'S(6)', '…']);
    cap('第一點：n 用 1 帶進去', 'statement 會成立');
  },
  async (tok, S) => { // 79.0
    S.B.add('第二點：S(k) 成立 ⇒ S(k+1) 成立');
    cap('第二點：n = k 成立', '可以推到 n = k+1 也成立');
  },
  async (tok, S) => { // 101.0
    S.B.add('這個推論要對「所有」自然數 k 都成立');
    cap('這個 implication（推論）', '要對所有的 k 都成立');
  },
  async (tok, S) => { // 124.3
    await S.D.fall(tok, 0, 350); await S.D.run(tok, 1, 3, 220);
    cap('S(1) 成立 → 套第二點 → S(2) → S(3)…', '一直推上去');
  },
  async (tok, S) => { // 140.5
    await S.D.run(tok, 4, 6, 160);
    S.B.add('⇒ 所有自然數 n，S(n) 都成立', 'good');
    cap('所有的自然數都會成立', '從小的一直推上去：induction');
  },
  async (tok, S) => { // 158.3
    S.B.add('第一步 = induction basis（檢查 initial condition）');
    cap('第一步叫 induction basis', '歸納的基礎');
  },
  async (tok, S) => { // 175.3
    S.B.add('沒有 S(1)，後面什麼都推不上去', 'bad');
    cap('必須先有 S(1) 成立', '不然就沒有歸納的基礎');
  },
  async (tok, S) => { // 194.7
    S.B.add('「S(k) 成立」= induction hypothesis（歸納假設）');
    cap('推論前面那部分', '叫 induction hypothesis');
  },
  async (tok, S) => { // 205.6
    S.B.add('「S(k) ⇒ S(k+1)」= induction step');
    cap('整個推上去的步驟', '叫 induction step');
  },
  async (tok, S) => { // 234.0
    S.D2 = dominoes(7, 1.0, 2.8, 0.9, FC.orange); S.D2.ms[3].position.x += 0.8;
    await S.D2.fall(tok, 0, 300); await S.D2.run(tok, 1, 2, 200);
    T('中間有一個 k 不成立 → 鏈子斷了', 'bad', 4.0, 4.6);
    cap('如果中間有一個 k 不成立', '歸納就斷了，後面倒不下去');
  },
  async (tok, S) => { // 269.4
    T('S(1) → 帶入 → S(2) → 帶入 → S(3)…', 'note', 3.6, 5.4);
    cap('基本道理就是這樣', '一次一次帶進去');
  },
]);

scene('pfC-3a-4i3', '例：Σ(4i + 3) = 2n² + 5n', [
  async (tok, S) => { // 292.2
    S.B = board(-6.6, 6.4, 0.7, 6); S.B.add('對所有自然數 n（1, 2, 3, …）');
    cap('看一個例子', '自然數從 1 開始');
  },
  async (tok, S) => { // 304.7
    S.B.add('Σ_{i=1}^{n}：i 從 1 帶到 n，全部加起來', 'say');
    cap('summation 符號', 'i 從 1 一直帶到 n，再加起來');
  },
  async (tok, S) => { // 318.0
    S.B.add('Σ_{i=1}^{n} (4i + 3) = 2n² + 5n');
    cap('要證：Σ(4i + 3) = 2n² + 5n', '');
  },
  async (tok, S) => { // 337.1
    S.B.add('induction basis：n = 1');
    cap('第一步：check initial condition', '');
  },
  async (tok, S) => { // 356.6
    S.B.add('左邊：4·1 + 3 = 7', 'say');
    cap('左邊 i 只帶 1：4·1 + 3 = 7', '');
  },
  async (tok, S) => { // 381.4
    S.B.add('右邊：2·1² + 5·1 = 7 → 相等 ✓', 'good');
    cap('右邊 2 + 5 = 7', '兩邊相等，basis 成立');
  },
  async (tok, S) => { // 399.0
    S.B.add('induction step');
    cap('主要的證明都在 induction step', '');
  },
  async (tok, S) => { // 405.9
    S.B.add('hypothesis：Σ_{i=1}^{k} (4i + 3) = 2k² + 5k');
    cap('假設 n = k 時成立', '這是 induction hypothesis');
  },
  async (tok, S) => { // 428.3
    S.B.add('要證：Σ_{i=1}^{k+1} (4i + 3) = 2(k+1)² + 5(k+1)');
    cap('要證 n = k+1 時成立', '目標寫清楚');
  },
  async (tok, S) => { // 462.3
    S.B.add('= Σ_{i=1}^{k} (4i + 3) + [4(k+1) + 3]', 'say');
    cap('拆成兩項：加到 k 的部分', '加上 i = k+1 那一項');
  },
  async (tok, S) => { // 476.0
    S.B.add('= (2k² + 5k) + (4k + 7)　← 用 hypothesis', 'say');
    cap('前面那項用假設換掉', '後面 4(k+1) + 3 = 4k + 7');
  },
  async (tok, S) => { // 508.8
    S.B.add('= 2k² + 9k + 7', 'say');
    cap('全部加起來', '2k² + 9k + 7');
  },
  async (tok, S) => { // 519.8
    S.B.add('2(k+1)² + 5(k+1) = 2k² + 4k + 2 + 5k + 5 = 2k² + 9k + 7 ✓', 'good');
    cap('目標展開也是 2k² + 9k + 7', '兩邊一樣，證完');
  },
  async (tok, S) => { // 557.8
    S.D = dominoes(6, 1.2, 0.3, 0.9, FC.blue, [1, 2, 3, 4, 5, '…']); await S.D.run(tok, 0, 5, 160);
    S.B.add('by mathematical induction：對所有 n 成立', 'good');
    cap('n = 1 成立 → n = 2 → n = 3…', 'by mathematical induction');
  },
]);

scene('pfC-3a-cube', '例：Σ i³ = [n(n+1)/2]²', [
  async (tok, S) => { // 604.8
    S.B = board(-6.6, 6.4); S.B.add('再一個類似的例子');
    cap('再看一個類似的例子', '依樣畫葫蘆');
  },
  async (tok, S) => { // 614.2
    S.B.add('1³ + 2³ + … + n³ = [n(n+1)/2]²');
    cap('立方和', '答案是 [n(n+1)/2] 整個平方');
  },
  async (tok, S) => { // 647.8
    S.B.add('basis n = 1：1³ = 1，[1·2/2]² = 1² = 1 ✓');
    cap('n = 1：左邊 1，右邊 1', '相等');
  },
  async (tok, S) => { // 682.5
    S.B.add('step：假設 Σ_{i=1}^{k} i³ = [k(k+1)/2]²');
    cap('假設 induction hypothesis 成立', '');
  },
  async (tok, S) => { // 697.9
    S.B.add('要證：Σ_{i=1}^{k+1} i³ = [(k+1)(k+2)/2]²');
    cap('要證 n = k+1', '');
  },
  async (tok, S) => { // 711.5
    S.B.add('= Σ_{i=1}^{k} i³ + (k+1)³', 'say');
    cap('一樣拆成兩項', '加到 k 的、再加 (k+1)³');
  },
  async (tok, S) => { // 739.0
    S.B.add('= k²(k+1)²/4 + (k+1)³　← 用 hypothesis', 'say');
    cap('前面用假設', '');
  },
  async (tok, S) => { // 757.0
    S.B.add('= (k+1)² · (k²/4 + k + 1)', 'say');
    cap('提出 (k+1)² 這個因式', '');
  },
  async (tok, S) => { // 770.2
    S.B.add('= (k+1)²(k² + 4k + 4)/4 = [(k+1)(k+2)/2]² ✓', 'good');
    cap('通分、提出 1/4', 'k² + 4k + 4 = (k+2)²');
  },
  async (tok, S) => { // 791.9
    S.B.add('basis + step → by induction，對所有 n 成立', 'good');
    cap('兩步都寫完', 'by induction 就好');
  },
]);

scene('pfC-3a-rec', '不知道答案時：recurrence relation', [
  async (tok, S) => { // 840.8
    S.B = board(-6.6, 6.4, 0.7, 6); S.B.add('用歸納法證明：必須先知道答案');
    cap('要證這個，得先知道右邊是什麼', '證明都是這樣');
  },
  async (tok, S) => { // 860.6
    S.B.add('不知道答案怎麼辦？', 'bad');
    cap('如果不知道答案呢？', '');
  },
  async (tok, S) => { // 886.4
    S.B.add('例：1³ + 2³ + … + n³ = ?');
    cap('叫你算這個是多少', '歸納法就沒用了');
  },
  async (tok, S) => { // 901.6
    S.B.add('→ 用 recurrence relation（遞迴關係）');
    cap('用 recurrence relation', '');
  },
  async (tok, S) => { // 932.0
    S.B.add('aₙ = Σ_{i=1}^{n} i³');
    cap('把整個和叫做 aₙ', '跟 n 有關');
  },
  async (tok, S) => { // 944.4
    S.B.add('aₙ − aₙ₋₁ = n³（n ≥ 2）');
    cap('aₙ 跟 aₙ₋₁ 差哪一項？', '差一個 n³');
  },
  async (tok, S) => { // 966.0
    S.B.add('initial condition：a₁ = 1³ = 1');
    S.c = [chip('a₁ = 1', FC.blue, 2.0, 1.6, 1.3, 0.6, 1)];
    cap('還需要 initial condition', 'a₁ = 1');
  },
  async (tok, S) => { // 1006.5
    S.c.push(chip('a₂ = 1 + 8 = 9', FC.green, 4.2, 1.6, 2.2, 0.6, 1)); await wt(tok, 300);
    S.c.push(chip('a₃ = 9 + 27 = 36', FC.green, 3.2, 0.7, 2.4, 0.6, 1));
    cap('用一次得 a₂ = 9', '再用一次得 a₃ = 36…');
  },
  async (tok, S) => { // 1030.9
    S.B.add('aₙ 是 well-defined（完整定義了）', 'good');
    cap('後面都能用前面算出來', '所以 aₙ 是 well-defined');
  },
  async (tok, S) => { // 1054.0
    S.B.add('解 recurrence relation = 寫成只跟 n 有關的式子');
    cap('這就是 recurrence relation', '解它：寫成 n 的式子');
  },
  async (tok, S) => { // 1074.1
    S.B.add('右邊不是 0 → non-homogeneous；像 differential equation', 'say');
    cap('右邊不是 0：non-homogeneous', '又叫 difference equation');
  },
  async (tok, S) => { // 1103.7
    S.B.add('改成 4 次方、5 次方也照樣解（後面教）');
    cap('所有次方都能解', '後面會教怎麼解');
  },
]);

// ── 3B ──
scene('pfC-3b-gen', '廣義的歸納法：從 n₀ 開始、可用前面全部', [
  async (tok, S) => { // 4.2
    S.B = board(-6.6, 6.4); S.B.add('另一種形式（廣義一點）的 principle');
    cap('把歸納法變得廣義一點', '');
  },
  async (tok, S) => { // 17.1
    S.B.add('basis 不一定從 1 開始（例如從 2）');
    S.D = dominoes(8, 0.6, 0.3, 0.85, FC.blue, ['n₀', 'n₀+1', '…', 'n₁', '…', 'k', 'k+1', '…']);
    cap('initial condition 不一定從 1 開始', '從 2 開始也可以');
  },
  async (tok, S) => { // 34.5
    S.B.add('initial condition 可以好幾個：S(n₀), …, S(n₁)');
    [0, 1, 2, 3].forEach((i) => glow(S.D.ms[i], HL));
    cap('有時候要 check 好幾個', '從 n₀ 一直到 n₁');
  },
  async (tok, S) => { // 75.0
    S.B.add('step：可以假設 S(n₀), S(n₀+1), …, S(k) 全部成立');
    cap('不只假設 S(k)', '從頭到現在的都成立了');
  },
  async (tok, S) => { // 112.0
    T('例：1、2 成立 → 證 3 時兩個都能用', 'say', 3.6, 4.4);
    cap('比方說 1 和 2 已經成立', '證 3 的時候兩個都可以用');
  },
  async (tok, S) => { // 156.0
    await S.D.run(tok, 0, 6, 160);
    cap('n₀ 到 k+1 都成立', '再證下一個，一直上去');
  },
  async (tok, S) => { // 162.0
    S.B.add('⇒ S(n) 對所有 n ≥ n₀ 成立', 'good');
    cap('最小是 n₀，後面全部成立', '概念都一樣');
  },
  async (tok, S) => { // 178.6
    S.B.add('需要幾個 initial condition？看 step 要往前用幾格');
    cap('每個 case 不太一樣', '看一下就知道要幾個');
  },
]);

scene('pfC-3b-rec2', 'second-order 遞迴：aₙ = 3ⁿ − 2ⁿ', [
  async (tok, S) => { // 197.4
    S.B = board(-6.6, 6.4, 0.7, 6); S.B.add('second-order recurrence：跟前兩項有關');
    cap('second order recurrence relation', '剛才那個只跟前一項有關：first order');
  },
  async (tok, S) => { // 215.8
    S.B.add('a₁ = 1，a₂ = 5 → a₃ = 5·5 − 6·1 = 19 …');
    S.av = []; [['a₁', 1], ['a₂', 5], ['a₃', 19], ['a₄', 65]].forEach(([n, v], i) => { S.av.push(chip(String(v), i < 2 ? FC.blue : FC.green, 1.6 + i * 1.3, 4.6, 0.9, 0.6, 1), T(n, 'idx', 1.6 + i * 1.3, 4.0)); });
    cap('要有兩個起始值', '有 a₁、a₂ 就能算 a₃、a₄… → well-defined');
  },
  async (tok, S) => { // 238.9
    S.B.add('aₙ₊₁ = 5aₙ − 6aₙ₋₁，n ≥ 2');
    cap('這個式子對 n ≥ 2 成立', 'n = 2 時就用到 a₂、a₁');
  },
  async (tok, S) => { // 257.3
    S.B.add('解出來：aₙ = 3ⁿ − 2ⁿ');
    cap('這是 homogeneous recurrence', '後面學會的話一下就解出來');
  },
  async (tok, S) => { // 280.3
    S.av.forEach((o) => kill(o)); S.B.add('用歸納法證（已經知道答案）：要 check 兩個 basis');
    S.D = dominoes(6, 1.2, 0.3, 0.9, FC.blue, ['n=1', 'n=2', 'n=3', 'n=4', 'n=5', '…']);
    cap('證下一個要用前面兩個', '所以要 check 兩個');
  },
  async (tok, S) => { // 304.1
    S.B.add('n = 1：3¹ − 2¹ = 1 = a₁ ✓', 'say'); await S.D.fall(tok, 0, 300);
    cap('n = 1：3 − 2 = 1', '跟 a₁ 一樣');
  },
  async (tok, S) => { // 321.9
    S.B.add('n = 2：3² − 2² = 9 − 4 = 5 = a₂ ✓', 'say'); await S.D.fall(tok, 1, 300);
    cap('n = 2：9 − 4 = 5', '剛好是 a₂');
  },
  async (tok, S) => { // 346.1
    S.B.add('hypothesis：公式對 a_k、a_{k−1} 都成立');
    cap('只需要前面兩個', '所以只假設 a_k、a_{k−1}');
  },
  async (tok, S) => { // 366.3
    S.B.add('要證：a_{k+1} = 3^{k+1} − 2^{k+1}');
    cap('要證 a_{k+1}', '');
  },
  async (tok, S) => { // 377.2
    S.B.add('a_{k+1} = 5a_k − 6a_{k−1} = 5(3ᵏ − 2ᵏ) − 6(3ᵏ⁻¹ − 2ᵏ⁻¹)', 'say');
    cap('用 recurrence relation', '再把前面兩個帶進來');
  },
  async (tok, S) => { // 393.4
    S.B.add('= 3ᵏ⁻¹(5·3 − 6) − 2ᵏ⁻¹(5·2 − 6)', 'say');
    cap('3 的次方放一起、2 的次方放一起', '提出 3ᵏ⁻¹ 和 2ᵏ⁻¹');
  },
  async (tok, S) => { // 418.0
    S.B.add('= 9·3ᵏ⁻¹ − 4·2ᵏ⁻¹ = 3ᵏ⁺¹ − 2ᵏ⁺¹ ✓', 'good');
    cap('15 − 6 = 9 = 3²，10 − 6 = 4 = 2²', '');
  },
  async (tok, S) => { // 431.0
    for (let i = 2; i < 6; i++) { await S.D.fall(tok, i, 300); }
    cap('1、2 成立 → 3；2、3 → 4；3、4 → 5…', '一直歸納下去');
  },
  async (tok, S) => { // 462.7
    T('■', 'note', 6.6, 0.9);
    cap('畫一個塗黑的方塊：證明結束', '有些人寫 QED');
  },
  async (tok, S) => { // 473.9
    T('hypothesis 假設幾格，看 step 用到幾格', 'say', 3.0, 1.6);
    cap('這裡用到兩格，就假設兩格', '其實從頭到現在都可以用');
  },
]);

scene('pfC-3b-rich', '「定理」：everybody is rich', [
  async (tok, S) => { // 518.6
    S.B = board(-6.6, 6.4, 0.6, 4); S.B.add('定理：everybody is rich（每個人都有錢）');
    cap('看我怎麼用歸納法證這個定理', '每個人都有錢');
  },
  async (tok, S) => { // 545.7
    S.B.add('S(n)：任意 n 個人，若至少一人有錢 → 全部有錢');
    cap('先弄一個跟 n 有關的 statement', '');
  },
  async (tok, S) => { // 592.6
    S.B.add('證完 S(n) + 世界上至少有一個有錢人 → 全部有錢', 'say');
    cap('世界上至少有一個有錢人', '所以所有人都有錢？');
  },
  async (tok, S) => { // 614.5
    S.B.add('basis n = 1：只有一個人，他有錢 → 全部有錢 ✓');
    S.one = buddy('α₁', '$', FC.gold, 1.4, 0.2);
    cap('n = 1：至少一人有錢，而全部也只有一人', '很明顯是對的');
  },
  async (tok, S) => { // 663.6
    S.B.add('step：假設 S(k) 成立');
    kill(S.one.g);
    cap('Induction step', '假設任何 k 個人都滿足');
  },
  async (tok, S) => { // 695.6
    S.B.add('k+1 個人 α₁, …, α_{k+1}；不失一般性 α₁ 有錢');
    S.p = ['α₁', 'α₂', 'α₃', 'α₄', 'α₅'].map((n, i) => buddy(n, i ? '' : '$', i ? FC.gray : FC.gold, 1.2 + i * 1.3, 0.2));
    T('示意：k+1 = 5', 'idx', 3.8, -0.4);
    cap('k+1 個人，有一個有錢', '叫他 α₁（不失一般性）');
  },
  async (tok, S) => { // 742.8
    S.B.add('第一組 α₁ … α_k（k 個人，含 α₁）→ 依 S(k) 全有錢', 'say');
    S.g1 = T('第一組：α₁ … α_k', 'ptr', 3.15, 2.9);
    for (let i = 1; i < 4; i++) { tint(S.p[i].body, FC.gold); S.p[i].set('$'); }
    cap('先把 α_{k+1} 拿掉，剩 k 個人', '裡面有 α₁ 有錢 → 全部有錢');
  },
  async (tok, S) => { // 797.1
    S.B.add('第二組 α₁, …, α_{k−1}, α_{k+1}（拿掉 α_k）→ 也全有錢', 'say');
    kill(S.g1); S.g2 = T('第二組：拿掉 α_k，放進 α_{k+1}', 'ptr', 3.8, 2.9);
    tint(S.p[4].body, FC.gold); S.p[4].set('$'); await S.p[4].hop(tok);
    cap('再找 k 個人：拿掉 α_k、放進 α_{k+1}', '裡面還是有 α₁ → 全部有錢');
  },
  async (tok, S) => { // 846.9
    S.B.add('⇒ S(k+1)；by induction S(n) 對所有 n 成立', 'say');
    cap('S(k) ⇒ S(k+1)', 'by mathematical induction');
  },
  async (tok, S) => { // 872.6
    S.B.add('結論：everybody is rich ?!', 'bad');
    S.p.forEach((b) => b.mood('happy'));
    cap('所以所有人都有錢', '定理證完了？');
  },
  async (tok, S) => { // 935.3
    kill(S.g2); T('把 rich 換成 beautiful、ugly… 也都「證得出來」', 'say', 3.6, 4.0);
    cap('證明跟「有錢」這個形容詞無關', '換成任何形容詞都成立？');
  },
  async (tok, S) => { // 956.8
    T('結論不對 → 證明一定有錯（窮教授就是反例）', 'bad', 3.6, 3.35);
    S.p.forEach((b) => b.mood('wow'));
    cap('問題：證明是錯的', '要 disprove 結論，找一個沒錢的人就好');
  },
  async (tok, S) => { // 975.4
    T('重點：找出「證明」哪裡錯', 'note', 3.6, 2.7);
    cap('定理很複雜時你不知道它對不對', '要能看出證明哪裡不對');
  },
]);

// ── 3C ──
scene('pfC-3c-bug', '錯在哪裡：S(1) ⇏ S(2)', [
  async (tok, S) => { // 4.3
    S.B = board(-6.6, 6.5, 0.7, 3); S.B.add("what's wrong with the proof?");
    cap('這個證明有什麼問題？', '');
  },
  async (tok, S) => { // 35.5
    S.B.add('要把論證真的帶進每一步：1 → 2 → 3 → 4');
    cap('不要只看 statement', '要把 argument 帶進去，一步步推');
  },
  async (tok, S) => { // 64.0
    S.B.add('S(1)：對，沒問題', 'say');
    S.D = dominoes(6, 1.2, 3.2, 0.9, FC.blue, ['S(1)', 'S(2)', 'S(3)', 'S(4)', 'S(5)', '…']);
    cap('S(1) 很明顯是對的', '');
  },
  async (tok, S) => { // 78.0
    S.B.add('k = 1：用 S(1) 推 S(2)，只有兩個人 α₁、α₂');
    S.a1 = buddy('α₁', '$', FC.gold, 2.4, 0.2); S.a2 = buddy('α₂', '', FC.gray, 5.0, 0.2);
    cap('induction step 帶 k = 1', '要從 S(1) 推到 S(2)：兩個人');
  },
  async (tok, S) => { // 105.2
    S.B.add('第一組（k = 1 個人）要含有錢的 α₁：只能是 {α₁}', 'say');
    S.r1 = T('{α₁}', 'ptr', 2.4, 1.9);
    cap('挑一個人出來，必須是有錢的那個', '第一次只能挑 α₁');
  },
  async (tok, S) => { // 119.7
    S.B.add('第二組也要含 α₁ → 還是 {α₁}；α₂ 永遠沒被放進去', 'bad');
    T('還是 {α₁}', 'bad', 2.4, 2.5); T('α₂ 沒人管', 'bad', 5.0, 1.9);
    cap('第二次還是要有 α₁', '根本沒有兩個不同的集合');
  },
  async (tok, S) => { // 134.6
    S.B.add('k = 2：{α₁, α₂}、{α₁, α₃} → 可以', 'good');
    cap('如果 k = 2 成立，要證 3', '第一次挑 α₁α₂、第二次挑 α₁α₃，OK');
  },
  async (tok, S) => { // 152.5
    S.B.add('S(2) ⇒ S(3)、S(3) ⇒ S(4)… 都沒問題', 'say');
    cap('後面的 induction step 都沒問題', '');
  },
  async (tok, S) => { // 175.7
    S.D.ms[1].position.x += 0.9; await S.D.fall(tok, 0, 400);
    T('S(1) ⇏ S(2)：第一張推不倒第二張', 'bad', 3.6, -0.7);
    cap('問題在：S(1) 推不到 S(2)', '2 不成立，後面都沒辦法');
  },
  async (tok, S) => { // 236.1
    S.B.add('重點不是「定理錯」，是「證明哪裡錯」');
    cap('定理本來就不對，是故意的', '要理解的是證明怎麼不對');
  },
  async (tok, S) => { // 262.1
    S.B.add('看別人的歸納證明：每一步都要真的推得上去', 'good');
    cap('檢查 1 推 2、2 推 3、3 推 4', '整個都 work，證明才對');
  },
]);

scene('pfC-3c-func', '函式 f : A → B：domain、codomain、range', [
  async (tok, S) => { // 321.3
    S.B = board(-6.6, 6.5, 0.7, 3); S.B.add('函式（function）的定義');
    cap('歸納法講完，接著看函式', '');
  },
  async (tok, S) => { // 329.2
    S.B.add('A、B：兩個非空集合（nonempty set）');
    oval(1.6, 1.9, 1.3, 2.0); oval(5.4, 1.9, 1.3, 2.0); T('A', 'ptr', 1.6, 4.3); T('B', 'ptr', 5.4, 4.3);
    cap('兩個集合 A、B', '都不是空集合');
  },
  async (tok, S) => { // 336.6
    S.B.add('f : A → B：一個規則（rule / mapping）');
    cap('函式 f 從 A 對應到 B', '是一個 rule 或 mapping');
  },
  async (tok, S) => { // 346.5
    S.B.add('A 的每一個元素 → B 裡「唯一」一個元素');
    S.A = [3.1, 1.9, 0.7].map((y, i) => dot(['a₁', 'a₂', 'a₃'][i], FC.blue, 1.6, y));
    S.Bp = [3.3, 2.3, 1.3, 0.3].map((y, i) => dot(['b₁', 'b₂', 'b₃', 'b₄'][i], FC.orange, 5.4, y));
    cap('A 裡每一個 element', '都對應到 B 裡唯一的一個');
  },
  async (tok, S) => { // 367.6
    arr([2.0, 3.1], [5.0, 3.3]); arr([2.0, 1.9], [5.0, 2.3]); arr([2.0, 0.7], [5.0, 2.3]);
    T('示意圖', 'idx', 3.5, -0.5);
    cap('通常這樣畫（示意圖）', '');
  },
  async (tok, S) => { // 380.2
    S.B.add('A = domain（定義域）'); T('domain', 'idx', 1.6, -0.4);
    cap('A 叫 domain，定義域', '裡面每個 element 都要有定義');
  },
  async (tok, S) => { // 403.0
    S.B.add('B = codomain（對應域）'); T('codomain', 'idx', 5.4, -0.4);
    cap('B 叫 codomain', '對應過去的那個集合');
  },
  async (tok, S) => { // 424.4
    S.B.add('a 對應到 b：寫成 f(a) = b');
    cap('a 對應到 b', '寫成 f(a) = b');
  },
  async (tok, S) => { // 459.2
    S.B.add('一個 a 對到兩個 b → 不是 well-defined', 'bad');
    S.badArr = arr([2.0, 0.7], [5.0, 1.3], 0xd64545);
    cap('結果不是唯一', '這個函式就不是 well-defined');
  },
  async (tok, S) => { // 464.4
    kill(S.badArr);
    S.B.add('f(A) = { f(a) | a ∈ A }：range（值域）');
    glow(S.Bp[0], OKG); glow(S.Bp[1], OKG);
    cap('A 裡所有元素對過去的那一塊', '叫 range，值域');
  },
  async (tok, S) => { // 509.9
    S.B.add('f(A) ⊆ B，不一定是整個 B', 'say');
    cap('f(A) 是 B 的 subset', 'B 裡不見得每個都被對到');
  },
  async (tok, S) => { // 537.7
    S.B.add('函式：每個元素都有定義，而且結果唯一', 'good');
    cap('domain 每個都有定義', '結果在 codomain 裡、唯一');
  },
]);

scene('pfC-3c-inj', 'one-to-one（injective）與 onto', [
  async (tok, S) => { // 577.4
    S.B = board(-6.6, 6.5, 0.7, 3); S.B.add('有些特別的函式');
    oval(1.6, 1.7, 1.3, 2.2); oval(5.4, 1.7, 1.3, 2.2); T('A', 'ptr', 1.6, 4.3); T('B', 'ptr', 5.4, 4.3);
    cap('我們有興趣的函式', '常有一些特別的性質');
  },
  async (tok, S) => { // 593.9
    S.B.add('one-to-one = injective（一對一函式、嵌射）');
    cap('one-to-one，又叫 injective', '中文：一對一函式');
  },
  async (tok, S) => { // 615.8
    S.B.add('f(a₁) = f(a₂) ⇒ a₁ = a₂');
    cap('對應過去一樣', '原來就一樣');
  },
  async (tok, S) => { // 631.8
    S.B.add('contrapositive：a₁ ≠ a₂ ⇒ f(a₁) ≠ f(a₂)');
    cap('換成逆否命題', '不一樣的，對過去就不一樣');
  },
  async (tok, S) => { // 665.0
    S.B.add('名詞：injection', 'say');
    cap('injective 是形容詞', '名詞是 injection');
  },
  async (tok, S) => { // 696.3
    [3.1, 2.1, 1.1, 0.1].forEach((y, i) => { dot('a' + (i + 1), FC.blue, 1.6, y); arr([2.0, y], [5.0, y + 0.25]); });
    [3.35, 2.35, 1.35, 0.35, -0.4].forEach((y, i) => dot('b' + (i + 1), FC.orange, 5.4, y));
    cap('例：A 有四個元素', '全部對到不同的 → 一對一');
  },
  async (tok, S) => { // 735.5
    S.B.add('onto：一般 f(A) 只是 B 的一部分');
    T('b5 沒被對到', 'idx', 5.4, -1.0);
    cap('再來叫 onto', '一般值域只是 B 的一部分');
  },
  async (tok, S) => { // 756.3
    S.B.add('B 的每一個元素都被對到 → surjective（onto）', 'good');
    cap('如果 B 的每一個都被對應到', '就叫 surjective');
  },
]);

// ── 3D ──
scene('pfC-3d-onto', 'onto（surjective）與 bijective', [
  async (tok, S) => { // 4.3
    S.B = board(-6.6, 6.5, 0.7, 3); S.B.add('onto：f 的 range 就是 codomain，f(A) = B');
    oval(1.6, 1.6, 1.2, 1.8); oval(5.4, 1.6, 1.2, 1.8);
    [2.8, 1.6, 0.4].forEach((y, i) => dot('a' + (i + 1), FC.blue, 1.6, y));
    [2.5, 0.7].forEach((y, i) => dot('b' + (i + 1), FC.orange, 5.4, y));
    arr([2.0, 2.8], [5.0, 2.5]); arr([2.0, 1.6], [5.0, 0.8]); arr([2.0, 0.4], [5.0, 0.6]);
    cap('f 的值域就是 codomain', '');
  },
  async (tok, S) => { // 7.0
    S.B.add('等價：∀b ∈ B ∃a ∈ A，f(a) = b');
    cap('B 裡每一個 element', '都至少有一個 a 對應過去');
  },
  async (tok, S) => { // 45.2
    S.B.add('surjective / surjection（蓋射）');
    cap('叫 surjective 或 surjection', '中文：蓋射，蓋上去的蓋');
  },
  async (tok, S) => { // 57.6
    S.B.add('證 one-to-one：f(a₁) = f(a₂) ⇒ a₁ = a₂', 'say');
    S.B.add('證 onto：任給 b ∈ B，找出 a 使 f(a) = b', 'say');
    cap('要證 one-to-one、onto', '就分別證這兩句話');
  },
  async (tok, S) => { // 100.2
    S.B.add('兩個性質互相獨立：可能都是、都不是、只有一個');
    cap('one-to-one 不見得 onto', 'onto 也不見得 one-to-one');
  },
  async (tok, S) => { // 118.9
    S.B.add('兩個都成立 → one-to-one correspondence = bijective（對射）', 'good');
    cap('又是 one-to-one 又是 onto', '叫 bijective，名詞 bijection');
  },
  async (tok, S) => { // 162.8
    ['injective 嵌射', 'surjective 蓋射', 'bijective 對射'].forEach((t, i) => T(t, i === 2 ? 'good' : 'note', -4.2, 3.0 - i * 0.65));
    cap('嵌射、蓋射、對射', 'injective、surjective、bijective');
  },
]);

scene('pfC-3d-count', '例：A = {1, 2, 3} → B = {x, y} 的 8 個函式', [
  async (tok, S) => { // 193.1
    S.B = board(-6.6, 6.4); S.B.add('A = {1, 2, 3}，B = {x, y}');
    cap('用小例子熟悉定義', 'A 有 3 個元素，B 有 2 個');
  },
  async (tok, S) => { // 220.9
    S.B.add('問：幾個 injective？幾個 surjective？幾個 bijective？');
    cap('所有 A → B 的函式是有限個', '其中各有多少個？');
  },
  async (tok, S) => { // 285.1
    S.B.add('先問：A → B 的函式總共幾個？');
    cap('全部有多少個不同的函式？', '有同學說 8 個');
  },
  async (tok, S) => { // 301.7
    S.B.add('1 有 2 種、2 有 2 種、3 有 2 種 → 2·2·2 = 8');
    cap('每個元素選 x 或 y', '彼此無關 → 2 × 2 × 2');
  },
  async (tok, S) => { // 357.7
    S.B.add('|B| = 4 → 4³；一般 |A| = m，|B| = n → nᵐ', 'say');
    cap('B 有 4 個元素就是 4³', '一般：n 的 m 次方');
  },
  async (tok, S) => { // 405.2
    const fs = ['xxx', 'xxy', 'xyx', 'xyy', 'yxx', 'yxy', 'yyx', 'yyy']; S.B.clear();
    T('f(1) f(2) f(3)', 'ptr', 2.6, 6.0);
    S.rows = fs.map((t, i) => { T('f' + (i + 1), 'idx', 0.9, 5.4 - i * 0.62); return t.split('').map((c, j) => dot(c, c === 'x' ? FC.blue : FC.orange, 1.8 + j * 0.8, 5.4 - i * 0.62)); });
    S.col = (j, name) => T(name, 'ptr', 4.4 + j * 1.2, 6.0);
    cap('只有 8 個，全部列出來', 'f1 到 f8');
  },
  async (tok, S) => { // 486.9
    S.col(0, 'inj');
    for (let i = 0; i < 8; i++) { T('no', 'bad', 4.4, 5.4 - i * 0.62); await wt(tok, 80); }
    cap('injective：1、2、3 要對到不同的', '只有 x、y 兩個 → 全部 no');
  },
  async (tok, S) => { // 548.0
    S.col(1, 'sur');
    for (let i = 0; i < 8; i++) { const ok = i !== 0 && i !== 7; T(ok ? 'yes' : 'no', ok ? 'good' : 'bad', 5.6, 5.4 - i * 0.62); await wt(tok, 80); }
    cap('surjective：x 和 y 都要出現', '只有 xxx、yyy 不是 → 6 個');
  },
  async (tok, S) => { // 606.3
    S.col(2, 'bij');
    for (let i = 0; i < 8; i++) T('no', 'bad', 6.8, 5.4 - i * 0.62);
    cap('bijective：兩個都要 yes', '沒有一個 → 0 個');
  },
  async (tok, S) => { // 617.8
    T('答案：injective 0、surjective 6、bijective 0', 'good', -3.4, 0.3);
    cap('injective 0 個', 'surjective 6 個、bijective 0 個');
  },
]);

scene('pfC-3d-gen', '一般情況：|A| = m，|B| = n', [
  async (tok, S) => { // 640.0
    S.B = board(-6.6, 6.4, 0.6, 4); S.B.add('|A| = m，|B| = n → 共 nᵐ 個函式');
    cap('全部 2³ = 8 個', '一般是 n 的 m 次方個');
  },
  async (tok, S) => { // 657.9
    S.B.add('injective：這例沒有 → B 太小；需要 n ≥ m');
    cap('injective 要對到不同元素', 'B 至少要有 3 個才行');
  },
  async (tok, S) => { // 692.9
    S.B.add('A 有 3 個、B 有 4 個 → injective 有 4·3·2 = 24 個', 'say');
    [0, 1, 2].forEach((i) => dot(String(i + 1), FC.blue, 1.6, 3.2 - i * 1.0));
    [0, 1, 2, 3].forEach((i) => dot('b' + (i + 1), FC.orange, 5.0, 3.6 - i * 1.0));
    T('4 種 · 3 種 · 2 種（排列）', 'idx', 3.3, -0.2);
    cap('簡單的排列組合', '1 有 4 種、2 剩 3 種、3 剩 2 種');
  },
  async (tok, S) => { // 712.2
    S.B.add('surjective：這例 6 個；一般用排容原理（後面教）');
    cap('surjective 一般比較麻煩', '後面用 inclusion–exclusion 算');
  },
  async (tok, S) => { // 738.4
    S.B.add('bijective：m、n 要滿足條件才有');
    cap('bijective 又要 injective 又要 surjective', 'm 和 n 要有關係');
  },
  async (tok, S) => { // 759.3
    S.B.add('B 有 4 個、A 只有 3 個 → 一定有一個沒被對到 → 沒有 surjective', 'bad');
    cap('A 只有 3 個，最多對到 3 個', '一定有一個沒被對到');
  },
  async (tok, S) => { // 788.5
    S.B.add('injective 要 n ≥ m、surjective 要 m ≥ n → bijective 要 m = n', 'good');
    cap('計數（enumeration）很重要', '這只是熱身');
  },
]);
  }
  // ═══ wo-mit (MIT OCW 6.042J Well Ordering Principle, fV3v6qQ3w4A) ═══
  {
const { V3, tag, cube, kill, glow, tint, anim, arrow, step, fresh } = K;
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const setT = (l, t) => { if (l && l.element) l.element.textContent = t; };
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f', gray: '#cfc6b6' };
const OKG = '#0f5a3a', NG = '#7a1010', HL = '#6a4a00';
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// proof board on the left: one line per add(), newest line highlighted
function board(x, yTop, dy = 0.7) {
  const ls = []; let last = null;
  return {
    add(t, c = 'note') {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = L(t, c, x, yTop - ls.length * dy); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
  };
}
// a number line of small cubes: values vals at x0 + i*dx on height y, numbers underneath
function nline(vals, x0, dx, y, col = FC.sand) {
  const ms = vals.map((v, i) => cube('', col, [0.42, 0.42, 0.42], x0 + i * dx, y, 0));
  const ls = vals.map((v, i) => T(String(v), 'idx', x0 + i * dx, y - 0.6));
  return { ms, ls, X: (i) => x0 + i * dx };
}

scene('wo-mit-stmt', '良序原理：非空的非負整數集合有最小元素', [
  async (tok, S) => { // 0.5
    S.B = board(-6.6, 6.4);
    S.B.add('良序原理（Well-Ordering）');
    S.N = nline([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.6, 0.68, 2.6);
    T('非負整數 0, 1, 2, …', 'idx', 3.7, 5.5);
    cap('主角：非負整數 0, 1, 2, …', '');
  },
  async (tok, S) => { // 22.5
    S.B.add('非空的非負整數集合');
    S.B.add('一定有最小元素');
    S.in = [3, 5, 8, 9];
    for (const v of S.in) { tint(S.N.ms[v], FC.orange); await wt(tok, 150); }
    T('S = {3, 5, 8, 9}（示意）', 'say', 3.7, 4.6);
    cap('S 非空 ⇒ S 有最小元素', 'least element');
  },
  async (tok, S) => { // 44.0
    S.p = T('0 ∈ S？', 'ptr', S.N.X(0), 3.5);
    glow(S.N.ms[0], NG);
    S.r = T('不在，下一個', 'bad', 3.7, 1.0);
    cap('從 0 開始問：0 在 S 裡嗎？', '不在 → 問 1');
  },
  async (tok, S) => { // 51.0
    for (const v of [1, 2]) {
      glow(S.N.ms[v - 1], '#000000'); glow(S.N.ms[v], NG);
      setT(S.p, v + ' ∈ S？'); S.p.position.x = S.N.X(v);
      await wt(tok, 500);
    }
    cap('1 不在、2 也不在', '一個一個往上問');
  },
  async (tok, S) => { // 59.0
    glow(S.N.ms[2], '#000000'); glow(S.N.ms[3], OKG);
    setT(S.p, '3 ∈ S ✓'); S.p.position.x = S.N.X(3); cls(S.p, 'ptr alt');
    setT(S.r, '最小元素 = 3'); cls(S.r, 'good');
    S.B.add('S 非空 → 總會停下來', 'good');
    cap('S 不是空的，總會碰到第一個', '最小元素 = 3');
  },
]);

scene('wo-mit-cond', '條件不能少：有理數、負整數', [
  async (tok, S) => { // 69.5
    S.B = board(-6.6, 6.4);
    S.B.add('條件：非空、非負、整數');
    S.c = ['非空', '非負', '整數'].map((t, i) => cube(t, FC.green, [1.3, 0.6, 0.5], 1.6 + i * 1.8, 5.6, 0, 1));
    cap('良序原理有三個條件', '少一個會怎樣？');
  },
  async (tok, S) => { // 84.0
    tint(S.c[2], FC.red); setT(S.c[2].userData.lbl, '有理數');
    S.B.add('換成非負有理數？');
    cap('把「整數」換成「有理數」', '每個非空子集都有最小元素嗎？');
  },
  async (tok, S) => { // 93.5
    S.ax = K.line(0.4, 3.4, 6.6, 3.4, 0, '#8a7a60');
    T('0', 'idx', 0.6, 2.8);
    S.d = [];
    for (let n = 1; n <= 9; n++) { S.d.push(cube('', FC.orange, [0.16, 0.36, 0.16], 0.6 + 6 / n, 3.4, 0)); await wt(tok, 90); }
    T('1', 'idx', 6.6, 2.8); T('1/2', 'idx', 3.6, 2.8); T('1/3', 'idx', 2.6, 2.8);
    T('{1, 1/2, 1/3, 1/4, …}', 'say', 3.6, 4.4);
    cap('看集合 {1, 1/2, 1/3, …}', '一直往 0 靠近');
  },
  async (tok, S) => { // 102.5
    S.d.forEach((m) => glow(m, NG));
    T('1/n 後面還有更小的 1/(n+1)', 'bad', 3.6, 2.0);
    S.B.add('沒有最小元素（0 不在裡面）', 'bad');
    cap('每個 1/n 都有更小的 1/(n+1)', '0 又不在集合裡 → 沒有最小');
  },
  async (tok, S) => { // 111.0
    tint(S.c[2], FC.green); setT(S.c[2].userData.lbl, '整數'); tint(S.c[1], FC.red); setT(S.c[1].userData.lbl, '可為負');
    S.N = nline([-5, -4, -3, -2, -1, 0, 1, 2, 3], 0.6, 0.75, 1.0, FC.blue);
    S.B.add('換成所有整數？');
    cap('再把「非負」拿掉：所有整數', '有最小整數嗎？');
  },
  async (tok, S) => { // 119.0
    for (let i = 4; i >= 0; i--) { glow(S.N.ms[i], NG); await wt(tok, 160); }
    arrow(V3(0.8, -0.2, 0), V3(-0.4, -0.2, 0), 0x7a1010);
    S.B.add('−1、−2、… 沒有最小整數', 'bad');
    S.B.add('「非負」「整數」都不能少', 'good');
    cap('−1 不是最小、−2 也不是…', '兩個條件都需要');
  },
]);

scene('wo-mit-use', '最小值一定存在：年齡、硬幣與 ℕ', [
  async (tok, S) => { // 125.5
    S.B = board(-6.6, 6.4);
    S.B.add('最年輕的 MIT 畢業生幾歲？');
    S.B.add('神經元最少的動物？');
    cube('年齡 ∈ ℕ', FC.blue, [1.9, 0.6, 0.5], 1.5, 5.4, 0, 1);
    cube('神經元數 ∈ ℕ', FC.blue, [2.3, 0.6, 0.5], 5.3, 5.4, 0, 1);
    T('答案不知道，但一定存在', 'good', 3.6, 4.5);
    cap('答案不知道，但一定存在', '因為都是非負整數');
  },
  async (tok, S) => { // 150.5
    S.B.add('湊出 $1.17 最少幾枚硬幣？');
    ['25¢', '10¢', '5¢', '1¢'].forEach((t, i) => cube(t, FC.gold, [0.9, 0.9, 0.25], 1.3 + i * 1.6, 3.2, 0, 1.2));
    cap('$1.17 最少要幾枚硬幣？', '不用擔心「最少」存不存在');
  },
  async (tok, S) => { // 156.0
    T('117 枚 1¢ 一定湊得出 → 集合非空', 'say', 3.6, 2.1);
    T('良序 ⇒ 最少枚數存在', 'good', 3.6, 1.3);
    S.B.add('{可行的枚數} ≠ ∅ → 有最小', 'good');
    cap('可行的枚數組成非空集合', '良序原理保證有最小值');
  },
  async (tok, S) => { // 164.5
    S.B.add('之後「數」= 非負整數');
    S.n = T('ℕ = {0, 1, 2, 3, …}', 'say', 3.6, 0.3);
    cap('記號 ℕ：非負整數', '有雙線的 N');
  },
  async (tok, S) => { // 185.0
    S.B.add('0 ∈ ℕ（本課、Rosen）', 'good');
    cls(S.n, 'good');
    cap('0 算不算自然數？書不同', '這門課的 ℕ 包含 0');
  },
]);

scene('wo-mit-lowest', '良序原理證明：分數都能化成最簡分數', [
  async (tok, S) => { // 199.5
    S.B = board(-6.6, 6.4);
    S.B.add('回顧：√2 是無理數');
    cap('√2 無理數的證明裡藏著良序原理', '');
  },
  async (tok, S) => { // 211.5
    S.B.add('假設 √2 = m/n（m, n 正整數）');
    S.m = cube('m', FC.blue, [0.9, 0.7, 0.5], 2.4, 4.6, 0, 1);
    K.line(1.8, 4.0, 3.0, 4.0, 0, '#6e5f49');
    S.n = cube('n', FC.blue, [0.9, 0.7, 0.5], 2.4, 3.4, 0, 1);
    T('= √2', 'say', 3.8, 4.0);
    cap('假設 √2 = m/n', 'm、n 是正整數');
  },
  async (tok, S) => { // 226.0
    S.B.add('可以假設已是最簡分數？為什麼？');
    cap('「可以化成最簡分數」', '為什麼一定可以？');
  },
  async (tok, S) => { // 264.0
    S.B.add('分子集合 C ≠ ∅ → 取最小的 m');
    T('C = {m : √2 = m/n}', 'say', 3.6, 2.5);
    S.cs = ['m', '·', '·', '·'].map((t, i) => cube(t === 'm' ? 'm 最小' : '', i ? FC.sand : FC.green, [i ? 0.6 : 1.3, 0.6, 0.5], 1.6 + i * 1.3 + (i ? 0.4 : 0), 1.5, 0, 1));
    cap('所有可行分子組成非空集合', '良序：取最小的 m');
  },
  async (tok, S) => { // 284.0
    S.B.add('假設 c > 1 同時整除 m、n');
    glow(S.m, HL); glow(S.n, HL);
    T('c | m，c | n', 'ptr', 2.4, 5.5);
    cap('假設 m、n 有公因數 c > 1', '');
  },
  async (tok, S) => { // 293.0
    S.m2 = cube('m/c', FC.purple, [1.0, 0.7, 0.5], 5.6, 4.6, 0, 1);
    K.line(5.0, 4.0, 6.2, 4.0, 0, '#6e5f49');
    cube('n/c', FC.purple, [1.0, 0.7, 0.5], 5.6, 3.4, 0, 1);
    T('也 = √2', 'say', 6.6, 4.0);
    cap('m/c、n/c 都是整數', '(m/c)/(n/c) 還是 √2');
  },
  async (tok, S) => { // 303.0
    glow(S.m2, NG);
    S.B.add('m/c < m：比最小還小，矛盾', 'bad');
    cap('m/c 比 m 小', '和「m 最小」矛盾');
  },
  async (tok, S) => { // 312.0
    glow(S.m, OKG); glow(S.n, OKG);
    S.B.add('m、n 沒有公因數 → 最簡分數', 'good');
    cap('所以 m/n 是最簡分數', '任何分數都適用');
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
