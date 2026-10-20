// 離散數學 第1章：邏輯與命題（Propositional Logic、Predicate Logic、量詞、推論規則）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（真值表列順序 TT、TF、FT、FF；→ 是 implication）。
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
  const TC = '#2fc092', FC = '#cfc4b2', BAD = '#d64545';
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
  function line(x1, y1, z1, x2, y2, z2, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  const W = (tok) => { const e = epoch; return async (ms) => { if (tok !== undefined) return beat(tok, ms); await sleep(Math.min(ms, 260)); if (e !== epoch) throw new Error('mode changed'); }; };
  const TF = (v) => (v ? 'T' : 'F');

  // ───────────────────────── 命題邏輯：運算子與公式庫 ─────────────────────────
  const NOT = (a) => !a, AND = (a, b) => a && b, OR = (a, b) => a || b, XOR = (a, b) => a !== b, IMP = (a, b) => !a || b, IFF = (a, b) => a === b;
  // 每個公式：vars、cols（中間欄 + 最後一欄是結果）
  const FORMS = {
    not: { name: '¬p', vars: 'p', cols: [['¬p', (e) => NOT(e.p)]] },
    and: { name: 'p ∧ q', vars: 'pq', cols: [['p ∧ q', (e) => AND(e.p, e.q)]] },
    or: { name: 'p ∨ q', vars: 'pq', cols: [['p ∨ q', (e) => OR(e.p, e.q)]] },
    xor: { name: 'p ⊕ q', vars: 'pq', cols: [['p ⊕ q', (e) => XOR(e.p, e.q)]] },
    imp: { name: 'p → q', vars: 'pq', cols: [['p → q', (e) => IMP(e.p, e.q)]] },
    iff: { name: 'p ↔ q', vars: 'pq', cols: [['p ↔ q', (e) => IFF(e.p, e.q)]] },
    conv: { name: 'q → p（逆）', vars: 'pq', cols: [['q → p', (e) => IMP(e.q, e.p)]] },
    inv: { name: '¬p → ¬q（否）', vars: 'pq', cols: [['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬p → ¬q', (e) => IMP(!e.p, !e.q)]] },
    contra: { name: '¬q → ¬p（逆否）', vars: 'pq', cols: [['¬q', (e) => !e.q], ['¬p', (e) => !e.p], ['¬q → ¬p', (e) => IMP(!e.q, !e.p)]] },
    impor: { name: '¬p ∨ q', vars: 'pq', cols: [['¬p', (e) => !e.p], ['¬p ∨ q', (e) => OR(!e.p, e.q)]] },
    dm1l: { name: '¬(p ∧ q)', vars: 'pq', cols: [['p ∧ q', (e) => AND(e.p, e.q)], ['¬(p ∧ q)', (e) => !AND(e.p, e.q)]] },
    dm1r: { name: '¬p ∨ ¬q', vars: 'pq', cols: [['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬p ∨ ¬q', (e) => OR(!e.p, !e.q)]] },
    dm2l: { name: '¬(p ∨ q)', vars: 'pq', cols: [['p ∨ q', (e) => OR(e.p, e.q)], ['¬(p ∨ q)', (e) => !OR(e.p, e.q)]] },
    dm2r: { name: '¬p ∧ ¬q', vars: 'pq', cols: [['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬p ∧ ¬q', (e) => AND(!e.p, !e.q)]] },
    taut: { name: 'p ∨ ¬p', vars: 'p', cols: [['¬p', (e) => !e.p], ['p ∨ ¬p', (e) => OR(e.p, !e.p)]] },
    contr: { name: 'p ∧ ¬p', vars: 'p', cols: [['¬p', (e) => !e.p], ['p ∧ ¬p', (e) => AND(e.p, !e.p)]] },
    iff2: { name: '(p → q) ∧ (q → p)', vars: 'pq', cols: [['p → q', (e) => IMP(e.p, e.q)], ['q → p', (e) => IMP(e.q, e.p)], ['(p→q)∧(q→p)', (e) => AND(IMP(e.p, e.q), IMP(e.q, e.p))]] },
    nimp: { name: '¬(p → q)', vars: 'pq', cols: [['p → q', (e) => IMP(e.p, e.q)], ['¬(p → q)', (e) => !IMP(e.p, e.q)]] },
    pnq: { name: 'p ∧ ¬q', vars: 'pq', cols: [['¬q', (e) => !e.q], ['p ∧ ¬q', (e) => AND(e.p, !e.q)]] },
    distl: { name: 'p ∨ (q ∧ r)', vars: 'pqr', cols: [['q ∧ r', (e) => AND(e.q, e.r)], ['p ∨ (q ∧ r)', (e) => OR(e.p, AND(e.q, e.r))]] },
    distr: { name: '(p ∨ q) ∧ (p ∨ r)', vars: 'pqr', cols: [['p ∨ q', (e) => OR(e.p, e.q)], ['p ∨ r', (e) => OR(e.p, e.r)], ['(p∨q)∧(p∨r)', (e) => AND(OR(e.p, e.q), OR(e.p, e.r))]] },
    exp1: { name: 'p → (q → r)', vars: 'pqr', cols: [['q → r', (e) => IMP(e.q, e.r)], ['p → (q → r)', (e) => IMP(e.p, IMP(e.q, e.r))]] },
    exp2: { name: '(p ∧ q) → r', vars: 'pqr', cols: [['p ∧ q', (e) => AND(e.p, e.q)], ['(p ∧ q) → r', (e) => IMP(AND(e.p, e.q), e.r)]] },
    assoc: { name: '(p → q) → r', vars: 'pqr', cols: [['p → q', (e) => IMP(e.p, e.q)], ['(p → q) → r', (e) => IMP(IMP(e.p, e.q), e.r)]] },
    rosen: { name: '¬(p ∨ (¬p ∧ q))', vars: 'pq', cols: [['¬p ∧ q', (e) => AND(!e.p, e.q)], ['p ∨ (¬p∧q)', (e) => OR(e.p, AND(!e.p, e.q))], ['¬(p∨(¬p∧q))', (e) => !OR(e.p, AND(!e.p, e.q))]] },
    big: { name: '(p ∨ ¬q) → (p ∧ q)', vars: 'pq', cols: [['¬q', (e) => !e.q], ['p ∨ ¬q', (e) => OR(e.p, !e.q)], ['p ∧ q', (e) => AND(e.p, e.q)], ['(p∨¬q)→(p∧q)', (e) => IMP(OR(e.p, !e.q), AND(e.p, e.q))]] },
  };
  const resultOf = (f) => f.cols[f.cols.length - 1][1];
  function rowsFor(vars) {
    const n = vars.length, out = [];
    for (let r = 0; r < (1 << n); r++) { const e = {}; [...vars].forEach((v, i) => { e[v] = !((r >> (n - 1 - i)) & 1); }); out.push(e); }
    return out;
  }

  // 3D 真值表：每格是一顆方塊，T = 綠、F = 灰；一列一列掉下來
  function makeTable(vars, cols, opt = {}) {
    const all = [...vars].map((v) => [v, (e) => e[v]]).concat(cols);
    const rows = rowsFor(vars);
    const nC = all.length, nR = rows.length;
    const dx = opt.dx || Math.min(1.75, 12 / Math.max(nC, 1));
    const cx = opt.cx || 0;
    const top = opt.top || 5.6, dy = nR > 4 ? 0.72 : 0.95;
    const X = (c) => cx + (c - (nC - 1) / 2) * dx, Y = (r) => top - r * dy;
    const heads = all.map(([nm], c) => tag(nm, c < vars.length ? 'idx' : (c === nC - 1 ? 'ptr alt' : 'ptr'), X(c), top + 0.75));
    const sep = line(X(vars.length) - dx / 2, top + 0.5, 0, X(vars.length) - dx / 2, Y(nR - 1) - 0.4, 0, '#c9b48e');
    const cells = rows.map(() => all.map(() => null));
    const T = {
      all, rows, cells, heads, X, Y, nR, nC, filled: 0,
      val(r, c) { return !!all[c][1](rows[r]); },
      async fillRow(r, w, ms = 160, onlyCols) {
        for (let c = 0; c < nC; c++) {
          if (onlyCols && !onlyCols.includes(c)) continue;
          if (cells[r][c]) continue;
          const v = T.val(r, c);
          cells[r][c] = cube(TF(v), v ? TC : FC, [dx * 0.8, 0.55, 0.7], X(c), Y(r), 0, 2.5);
          if (w && ms) await w(ms);
        }
        T.filled = Math.max(T.filled, r + 1);
      },
      glowCol(c, col) { cells.forEach((row) => row[c] && glow(row[c], col)); },
      glowRow(r, col) { cells[r].forEach((m) => m && glow(m, col)); },
      liftRow(r, dz) { cells[r].forEach((m, c) => m && move(m, X(c), Y(r), dz)); },
      clearGlow() { cells.forEach((row) => row.forEach((m) => m && glow(m, null))); },
    };
    return T;
  }

  // ───────────────────────── Mode 1：真值表 ─────────────────────────
  const tt = { key: 'big', T: null };
  function enterTT() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4, 15], [0, 3.4, 0]);
    const f = FORMS[tt.key];
    tt.T = makeTable(f.vars, f.cols);
    controls('<select id="tF">' + Object.keys(FORMS).map((k) => '<option value="' + k + '">' + FORMS[k].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="tStep">下一列</button><button id="tAll">全部填完</button><button id="tReset">重來</button>');
    $('tF').value = tt.key;
    $('tF').onchange = (e) => { tt.key = e.target.value; clearLog(); enterTT(); };
    on('tStep', () => ttStep());
    on('tAll', async () => { const e = epoch; while (e === epoch && tt.T.filled < tt.T.nR) { const f0 = tt.T.filled; await ttStep(); if (tt.T.filled === f0) break; } });
    on('tReset', () => { clearLog(); enterTT(); });
    log(f.name + '：' + f.vars.length + ' 個變數 → 2^' + f.vars.length + ' = ' + (1 << f.vars.length) + ' 列。列的順序 TT、TF、FT、FF（Rosen）。');
    ttState();
  }
  async function ttStep() {
    const T = tt.T;
    if (busy) return;
    if (T.filled >= T.nR) { log('每一列都填完了：結果欄看完整個真假組合。換一個公式或按「重來」。', true); return; }
    busy = true;
    const r = T.filled;
    try {
      await T.fillRow(r, W(), 90);
      const env = T.rows[r];
      log('第 ' + (r + 1) + ' 列：' + [...FORMS[tt.key].vars].map((v) => v + '=' + TF(env[v])).join('、') + ' → ' + TF(T.val(r, T.nC - 1)));
    } finally { busy = false; }
    ttState();
  }
  function ttState() {
    const T = tt.T, f = FORMS[tt.key];
    const res = T.rows.map((_, r) => T.val(r, T.nC - 1));
    const done = T.filled >= T.nR;
    const kind = res.every(Boolean) ? 'tautology（恆真）' : res.every((v) => !v) ? 'contradiction（恆假）' : 'contingency（可真可假）';
    setState('真值表：' + f.name, [['變數', [...f.vars].join(', ')], ['列數', String(T.nR)], ['已填', T.filled + ' / ' + T.nR]],
      done ? '結果欄：' + res.map(TF).join(' ') + '<br><span class="ok">' + kind + '</span>' : '一列 = 一組真假值；每欄由左邊的欄算出來');
  }

  // ───────────────────────── Mode 2：等價檢查 ─────────────────────────
  const PAIRS = [
    ['dm1l', 'dm1r', 'De Morgan 1'], ['dm2l', 'dm2r', 'De Morgan 2'], ['imp', 'impor', 'p→q ≡ ¬p∨q'], ['imp', 'contra', '原命題 vs 逆否'],
    ['imp', 'conv', '原命題 vs 逆'], ['conv', 'inv', '逆 vs 否'], ['iff', 'iff2', '雙條件'], ['nimp', 'pnq', '¬(p→q)'], ['distl', 'distr', '分配律'],
    ['exp1', 'exp2', 'Exportation'], ['assoc', 'exp1', '→ 沒有結合律'], ['rosen', 'dm2r', 'Rosen 例：化簡'],
  ];
  const eq = { i: 0, T: null };
  function enterEq() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4, 15], [0, 3.4, 0]);
    const [a, b] = PAIRS[eq.i], A = FORMS[a], B = FORMS[b];
    const vars = A.vars.length >= B.vars.length ? A.vars : B.vars;
    eq.T = makeTable(vars, [[A.name, resultOf(A)], [B.name, resultOf(B)]], { dx: 2.3 });
    controls('<select id="eP">' + PAIRS.map((p, i) => '<option value="' + i + '">' + p[2] + '：' + FORMS[p[0]].name + ' ? ' + FORMS[p[1]].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="eRun">比對兩欄</button><button id="eReset">重來</button>');
    $('eP').value = String(eq.i);
    $('eP').onchange = (e) => { eq.i = Number(e.target.value); clearLog(); enterEq(); };
    on('eRun', () => eqRun());
    on('eReset', () => { clearLog(); enterEq(); });
    log('兩個公式等價 ⇔ 每一列的值都相同（p ↔ q 是 tautology）。');
    setState('等價嗎？', [['左', A.name], ['右', B.name]], '按「比對兩欄」');
  }
  async function eqRun(tok) {
    const T = eq.T;
    if (busy) return; busy = true;
    const w = W(tok);
    let bad = -1;
    try {
      for (let r = 0; r < T.nR; r++) {
        await T.fillRow(r, w, tok ? 110 : 60);
        const same = T.val(r, T.nC - 1) === T.val(r, T.nC - 2);
        if (!same && bad < 0) bad = r;
        [T.nC - 2, T.nC - 1].forEach((c) => glow(T.cells[r][c], same ? GREEN : RED));
        if (tok) say('第 ' + (r + 1) + ' 列：' + (same ? '相同' : '不同！'), '');
        await w(tok ? 450 : 120);
      }
    } finally { busy = false; }
    const [a, b] = PAIRS[eq.i];
    const env = bad >= 0 ? T.rows[bad] : null;
    const ce = env ? Object.keys(env).map((v) => v + '=' + TF(env[v])).join('、') : '';
    setState('等價嗎？', [['左', FORMS[a].name], ['右', FORMS[b].name], ['結論', bad < 0 ? '等價' : '不等價']],
      bad < 0 ? '<span class="ok">兩欄完全相同 → ' + FORMS[a].name + ' ≡ ' + FORMS[b].name + '</span>' : '<span class="no">第 ' + (bad + 1) + ' 列不同（' + ce + '）</span>：一列反例就足以說不等價');
    log(bad < 0 ? '每一列都相同 → 邏輯等價。' : '反例：' + ce + ' 時左右不同 → 不等價。', bad >= 0);
    return bad;
  }

  // ───────────────────────── Mode 3：量詞積木 ─────────────────────────
  const PREDS = [
    { id: 'pos', name: 'x > 0', f: (x) => x > 0 }, { id: 'even', name: 'x 是偶數', f: (x) => x % 2 === 0 },
    { id: 'sq', name: 'x² ≥ x', f: (x) => x * x >= x }, { id: 'lt5', name: 'x < 5', f: (x) => x < 5 },
    { id: 'gt3', name: 'x > 3', f: (x) => x > 3 }, { id: 'sq4', name: 'x² = 4', f: (x) => x * x === 4 },
  ];
  const qm = { dom: [1, 4, 2, 7, 3, 6], p: 4, ms: [] };
  const QX = (i, n) => (i - (n - 1) / 2) * 1.9;
  function enterQuant() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 6, 13], [0, 1, 0]);
    qm.ms = qm.dom.map((v, i) => cube(v, '#4b9ee2', [1.3, 1, 1.3], QX(i, qm.dom.length), 0.5, 0));
    tag('論域 D = {' + qm.dom.join(', ') + '}', 'ptr', 0, 2.6, -1);
    qm.cur = tag('x', 'ptr alt', QX(0, qm.dom.length), 1.8, 0); qm.cur.visible = false;
    controls('<select id="qP">' + PREDS.map((p, i) => '<option value="' + i + '">P(x): ' + p.name + '</option>').join('') + '</select>'
      + '<button class="primary" id="qAll">∀x P(x)</button><button id="qEx">∃x P(x)</button><button id="qNeg">¬∀x P(x) ≡ ∃x ¬P(x)</button><button id="qDom">換論域</button>');
    $('qP').value = String(qm.p);
    $('qP').onchange = (e) => { qm.p = Number(e.target.value); clearLog(); enterQuant(); };
    on('qAll', () => qScan('all'));
    on('qEx', () => qScan('ex'));
    on('qNeg', () => qScan('neg'));
    on('qDom', () => { const pool = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; qm.dom = pool.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 6); clearLog(); enterQuant(); });
    log('∀x P(x)：D 裡每一個 x 都要讓 P(x) 為真；一個反例就假。');
    log('∃x P(x)：只要找到一個 x 讓 P(x) 為真。');
    qState('');
  }
  async function qScan(kind, tok) {
    if (busy) return; busy = true;
    const w = W(tok), P = PREDS[qm.p], n = qm.dom.length;
    qm.ms.forEach((m) => { tint(m, '#4b9ee2'); glow(m, null); m.position.y = 0.5; });
    qm.cur.visible = true;
    let ans = kind === 'ex' ? false : true, hit = -1;
    try {
      for (let i = 0; i < n; i++) {
        const v = P.f(qm.dom[i]);
        qm.cur.position.set(QX(i, n), 1.8, 0);
        tint(qm.ms[i], v ? TC : BAD);
        if (tok) say('x = ' + qm.dom[i] + '：P(' + qm.dom[i] + ') 為 ' + (v ? '真' : '假'), P.name);
        await w(tok ? 650 : 200);
        if (kind !== 'ex' && !v) { ans = false; hit = i; break; }
        if (kind === 'ex' && v) { ans = true; hit = i; break; }
      }
    } finally { busy = false; }
    qm.cur.visible = false;
    if (hit >= 0) { glow(qm.ms[hit], GOLD); qm.ms[hit].position.y = 0.9; }
    let msg;
    if (kind === 'all') msg = ans ? '∀x P(x) 為真：每一顆都是綠的' : '∀x P(x) 為假：反例 x = ' + qm.dom[hit];
    else if (kind === 'ex') msg = ans ? '∃x P(x) 為真：找到 x = ' + qm.dom[hit] : '∃x P(x) 為假：沒有一顆是綠的';
    else msg = ans ? '¬∀x P(x) 為假，∃x ¬P(x) 也為假（沒有紅的）' : '¬∀x P(x) 為真 ⇔ ∃x ¬P(x)：紅色那顆就是證據 x = ' + qm.dom[hit];
    log(msg, !ans && kind === 'all');
    qState(msg);
    return { ans, hit };
  }
  function qState(msg) {
    const P = PREDS[qm.p];
    setState('量詞：P(x) = ' + P.name, [['D', '{' + qm.dom.join(', ') + '}'], ['真的有', qm.dom.filter(P.f).join(', ') || '（無）']],
      (msg ? msg + '<br>' : '') + '¬∀x P(x) ≡ ∃x ¬P(x)<br>¬∃x P(x) ≡ ∀x ¬P(x)');
  }

  // ───────────────────────── Mode 4：巢狀量詞 ─────────────────────────
  const D5 = [-2, -1, 0, 1, 2];
  const QPRED = [
    { name: 'x + y = 0', f: (x, y) => x + y === 0 }, { name: 'x < y', f: (x, y) => x < y },
    { name: 'x · y = 0', f: (x, y) => x * y === 0 }, { name: 'x ≤ y', f: (x, y) => x <= y }, { name: 'x² ≤ y²', f: (x, y) => x * x <= y * y },
  ];
  const ORDERS = ['∀x∃y', '∃y∀x', '∀x∀y', '∃x∃y', '∃x∀y', '∀y∃x'];
  const nq = { p: 0, o: 0, ms: [] };
  const GX = (j) => (j - 2) * 1.45, GZ = (i) => (i - 2) * 1.2;
  function enterNested() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 9.5, 9.5], [0, 0, 0.4]);
    const P = QPRED[nq.p];
    nq.ms = D5.map((x, i) => D5.map((y, j) => { const v = P.f(x, y); return cube(TF(v), v ? '#9fdcc4' : '#e5ddd0', [1.1, 0.35, 0.9], GX(j), 0.18, GZ(i)); }));
    D5.forEach((x, i) => tag('x=' + x, 'idx', -4.1, 0.2, GZ(i)));
    D5.forEach((y, j) => tag('y=' + y, 'idx', GX(j), 0.2, -3.1));
    nq.rowTags = D5.map((_, i) => tag('', 'ptr alt', 4.2, 0.3, GZ(i)));
    nq.colTags = D5.map((_, j) => tag('', 'ptr alt', GX(j), 0.3, 3.3));
    controls('<select id="nP">' + QPRED.map((p, i) => '<option value="' + i + '">Q(x,y): ' + p.name + '</option>').join('') + '</select>'
      + '<select id="nO">' + ORDERS.map((o, i) => '<option value="' + i + '">' + o + ' Q(x,y)</option>').join('') + '</select><button class="primary" id="nRun">逐列判斷</button>');
    $('nP').value = String(nq.p); $('nO').value = String(nq.o);
    $('nP').onchange = (e) => { nq.p = Number(e.target.value); clearLog(); enterNested(); };
    $('nO').onchange = (e) => { nq.o = Number(e.target.value); clearLog(); enterNested(); };
    on('nRun', () => nestedRun());
    log('論域 D = {−2, −1, 0, 1, 2}。格子 (x, y) 亮 T 表示 Q(x, y) 為真。');
    log('量詞順序由外往內讀：外層每選一個，內層再去找。', false);
    setState('巢狀量詞', [['Q(x,y)', P.name], ['順序', ORDERS[nq.o]]], '按「逐列判斷」');
  }
  async function nestedRun(tok) {
    if (busy) return; busy = true;
    const w = W(tok), P = QPRED[nq.p], o = ORDERS[nq.o];
    const byRow = o[1] === 'x';               // 外層是 x：一列一列看
    const outerAll = o[0] === '∀', innerAll = o[2] === '∀';
    const val = (a, b) => (byRow ? P.f(D5[a], D5[b]) : P.f(D5[b], D5[a]));
    const cell = (a, b) => (byRow ? nq.ms[a][b] : nq.ms[b][a]);
    const outTags = byRow ? nq.rowTags : nq.colTags;
    let overall = outerAll;
    try {
      nq.ms.flat().forEach((m) => glow(m, null));
      for (let a = 0; a < 5; a++) {
        let inner = innerAll, wit = -1;
        for (let b = 0; b < 5; b++) {
          const v = val(a, b);
          glow(cell(a, b), v ? GREEN : RED);
          await w(tok ? 160 : 40);
          if (innerAll && !v) { inner = false; wit = b; break; }
          if (!innerAll && v) { inner = true; wit = b; break; }
        }
        if (wit >= 0) glow(cell(a, wit), GOLD);
        const outerName = byRow ? 'x=' + D5[a] : 'y=' + D5[a];
        const innerVar = byRow ? 'y' : 'x';
        txt(outTags[a], inner ? '✓' : '✗');
        if (tok) say(outerName + '：' + (innerAll ? (inner ? '每個 ' + innerVar + ' 都成立' : '有 ' + innerVar + ' 不成立') : (inner ? '找到 ' + innerVar + '=' + D5[wit] : '找不到 ' + innerVar)), o + ' ' + P.name);
        await w(tok ? 700 : 150);
        if (outerAll && !inner) overall = false;
        if (!outerAll && inner) overall = true;
      }
    } finally { busy = false; }
    const msg = o + ' (' + P.name + ') 為 ' + (overall ? '真' : '假');
    setState('巢狀量詞', [['Q(x,y)', P.name], ['順序', o], ['結果', overall ? '真' : '假']], (overall ? '<span class="ok">' : '<span class="no">') + msg + '</span><br>外層 ' + (outerAll ? '∀：每個 ✓ 才真' : '∃：一個 ✓ 就真'));
    log(msg);
    return overall;
  }

  // ───────────────────────── Mode 5：推論規則 ─────────────────────────
  const RULES = {
    mp: { name: 'Modus ponens', prem: [['p', (e) => e.p], ['p → q', (e) => IMP(e.p, e.q)]], concl: ['q', (e) => e.q], vars: 'pq' },
    mt: { name: 'Modus tollens', prem: [['¬q', (e) => !e.q], ['p → q', (e) => IMP(e.p, e.q)]], concl: ['¬p', (e) => !e.p], vars: 'pq' },
    hs: { name: 'Hypothetical syllogism', prem: [['p → q', (e) => IMP(e.p, e.q)], ['q → r', (e) => IMP(e.q, e.r)]], concl: ['p → r', (e) => IMP(e.p, e.r)], vars: 'pqr' },
    ds: { name: 'Disjunctive syllogism', prem: [['p ∨ q', (e) => OR(e.p, e.q)], ['¬p', (e) => !e.p]], concl: ['q', (e) => e.q], vars: 'pq' },
    add: { name: 'Addition', prem: [['p', (e) => e.p]], concl: ['p ∨ q', (e) => OR(e.p, e.q)], vars: 'pq' },
    simp: { name: 'Simplification', prem: [['p ∧ q', (e) => AND(e.p, e.q)]], concl: ['p', (e) => e.p], vars: 'pq' },
    conj: { name: 'Conjunction', prem: [['p', (e) => e.p], ['q', (e) => e.q]], concl: ['p ∧ q', (e) => AND(e.p, e.q)], vars: 'pq' },
    res: { name: 'Resolution', prem: [['p ∨ q', (e) => OR(e.p, e.q)], ['¬p ∨ r', (e) => OR(!e.p, e.r)]], concl: ['q ∨ r', (e) => OR(e.q, e.r)], vars: 'pqr' },
    ac: { name: '謬誤：肯定後件', prem: [['q', (e) => e.q], ['p → q', (e) => IMP(e.p, e.q)]], concl: ['p', (e) => e.p], vars: 'pq' },
    da: { name: '謬誤：否定前件', prem: [['¬p', (e) => !e.p], ['p → q', (e) => IMP(e.p, e.q)]], concl: ['¬q', (e) => !e.q], vars: 'pq' },
  };
  function ruleValid(R) { return rowsFor(R.vars).every((e) => !R.prem.every(([, f]) => f(e)) || R.concl[1](e)); }
  const inf = { key: 'mp' };
  function drawArgument(R) {
    const pm = R.prem.map(([nm], i) => cube(nm, '#9b7ef4', [2.6, 0.6, 1], -4.6, 4.6 - i * 0.85, 0, 3));
    line(-6, 4.6 - R.prem.length * 0.85 + 0.35, 0, -3.2, 4.6 - R.prem.length * 0.85 + 0.35, 0, '#6e5f49');
    tag('∴', 'val', -6.3, 4.6 - R.prem.length * 0.85 - 0.1);
    const cm = cube(R.concl[0], '#dd8238', [2.6, 0.6, 1], -4.6, 4.6 - R.prem.length * 0.85 - 0.45, 0, 4);
    return { pm, cm };
  }
  function enterInfer() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 4, 15.5], [0.6, 3.3, 0]);
    const R = RULES[inf.key];
    drawArgument(R);
    tag(R.name, 'ptr', -4.6, 6.4);
    inf.T = makeTable(R.vars, R.prem.concat([R.concl]), { cx: 2.7, dx: 1.25 });
    controls('<select id="iR">' + Object.keys(RULES).map((k) => '<option value="' + k + '">' + RULES[k].name + '</option>').join('') + '</select><button class="primary" id="iChk">用真值表驗證</button>');
    $('iR').value = inf.key;
    $('iR').onchange = (e) => { inf.key = e.target.value; clearLog(); enterInfer(); };
    on('iChk', () => inferCheck());
    log('論證有效 ⇔ 前提全真的每一列，結論也真（(前提的 ∧) → 結論 是 tautology）。');
    setState(R.name, [['前提', R.prem.map((p) => p[0]).join('，')], ['結論', R.concl[0]]], '按「用真值表驗證」');
  }
  async function inferCheck(tok) {
    if (busy) return; busy = true;
    const R = RULES[inf.key], T = inf.T, w = W(tok);
    const nP = R.prem.length, vC = R.vars.length;
    let badRow = -1, crit = 0;
    try {
      for (let r = 0; r < T.nR; r++) {
        await T.fillRow(r, w, tok ? 80 : 30);
        const allP = R.prem.every((_, k) => T.val(r, vC + k));
        if (allP) {
          crit++;
          const c = T.val(r, vC + nP);
          T.glowRow(r, c ? GREEN : RED);
          if (!c && badRow < 0) badRow = r;
          if (tok) say('第 ' + (r + 1) + ' 列：前提全真 → 結論 ' + (c ? '也真' : '是假的！'), '');
          await w(tok ? 900 : 150);
        } else await w(tok ? 200 : 40);
      }
    } finally { busy = false; }
    const ok = badRow < 0;
    setState(R.name, [['前提', R.prem.map((p) => p[0]).join('，')], ['結論', R.concl[0]], ['前提全真的列', String(crit)], ['有效？', ok ? '有效' : '無效']],
      ok ? '<span class="ok">每一個前提全真的列，結論都為真 → valid</span>' : '<span class="no">第 ' + (badRow + 1) + ' 列前提全真但結論為假 → invalid（fallacy）</span>');
    log(ok ? R.name + '：有效。' : R.name + '：反例在第 ' + (badRow + 1) + ' 列。', !ok);
    return ok;
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SENT = [
    ['n 是 4 的倍數', 'n 是偶數'], ['今天下雨', '比賽取消'], ['三角形是正三角形', '三角形是等腰三角形'], ['你考到 100 分', '你拿到 A'], ['x > 5', 'x > 3'],
  ];
  const neg = (s) => s.replace(/^(.*?)(是|>|考到|拿到|下雨|取消)/, (m, a, b) => a + ({ 是: '不是', '>': '≤', 考到: '沒考到', 拿到: '沒拿到', 下雨: '沒下雨', 取消: '不取消' })[b]);
  function genQ() {
    const k = Math.random();
    if (k < 0.16) {
      const keys = ['imp', 'and', 'or', 'xor', 'iff', 'big', 'exp2', 'nimp'];
      const f = FORMS[pick(keys)], rows = rowsFor(f.vars);
      const target = Math.random() < 0.5;
      const good = rows.filter((e) => !!resultOf(f)(e) === target), badR = rows.filter((e) => !!resultOf(f)(e) !== target);
      if (!good.length || badR.length < 3) return genQ();
      const fmt = (e) => Object.keys(e).map((v) => v + '=' + TF(e[v])).join(', ');
      const ans = fmt(pick(good));
      const opts = [ans, ...badR.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 3).map(fmt)];
      return { q: '下列哪一組真假值讓 ' + f.name + ' 為' + (target ? '真' : '假') + '？', opts, ans, why: '代入逐欄計算；p → q 只有在 p=T、q=F 時為假。' };
    }
    if (k < 0.32) {
      const sets = [['¬(p ∧ q)', '¬p ∨ ¬q', ['¬p ∧ ¬q', 'p ∨ q', '¬p ∧ q'], 'De Morgan：¬ 進括號，∧ 變 ∨。'], ['¬(p ∨ q)', '¬p ∧ ¬q', ['¬p ∨ ¬q', 'p ∧ q', '¬p ∨ q'], 'De Morgan：¬ 進括號，∨ 變 ∧。'],
        ['p → q', '¬p ∨ q', ['p ∨ ¬q', 'q → p', '¬p → ¬q'], 'p → q 只在 p=T、q=F 為假，和 ¬p ∨ q 相同；逆、否命題都不等價。'], ['p → q', '¬q → ¬p', ['q → p', '¬p → ¬q', 'p ∧ ¬q'], '原命題 ≡ 逆否命題（contrapositive）。'],
        ['¬(p → q)', 'p ∧ ¬q', ['¬p → ¬q', '¬p ∧ q', '¬p ∨ q'], '¬(¬p ∨ q) = p ∧ ¬q。'], ['p ↔ q', '(p → q) ∧ (q → p)', ['(p → q) ∨ (q → p)', 'p ⊕ q', 'p ∧ q'], '雙條件 = 兩個方向都成立；p ⊕ q 是 ¬(p ↔ q)。'],
        ['p → (q → r)', '(p ∧ q) → r', ['(p → q) → r', '(p ∨ q) → r', 'p ∧ (q → r)'], 'Exportation law；→ 沒有結合律。']];
      const [L, R, wrong, why] = pick(sets);
      return { q: '哪一個與 ' + L + ' 邏輯等價？', opts: [R, ...wrong], ans: R, why };
    }
    if (k < 0.47) {
      const [p, q] = pick(SENT);
      const kind = pick(['逆否命題（contrapositive）', '逆命題（converse）', '否命題（inverse）']);
      const forms = { '逆否命題（contrapositive）': '若' + neg(q) + '，則' + neg(p), '逆命題（converse）': '若' + q + '，則' + p, '否命題（inverse）': '若' + neg(p) + '，則' + neg(q) };
      const ans = forms[kind];
      return { q: '「若' + p + '，則' + q + '」的' + kind + '是？', opts: [...Object.values(forms), '若' + p + '，則' + neg(q)], ans, why: '逆：q → p；否：¬p → ¬q；逆否：¬q → ¬p（只有逆否和原命題等價）。' };
    }
    if (k < 0.62) {
      const pool = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
      const dom = pool.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 5).sort((a, b) => a - b);
      const P = pick(PREDS);
      const a = dom.every(P.f), e = dom.some(P.f);
      const f = (x, y) => '∀ ' + (x ? '真' : '假') + '，∃ ' + (y ? '真' : '假');
      const opts = [f(true, true), f(true, false), f(false, true), f(false, false)];
      const ce = dom.find((x) => !P.f(x));
      return { q: '論域 D = {' + dom.join(', ') + '}，P(x): ' + P.name + '。∀x P(x) 與 ∃x P(x) 的真假？', opts, ans: f(a, e), why: (a ? '每個都成立' : '反例 x = ' + ce) + '；' + (e ? '至少一個成立（x = ' + dom.find(P.f) + '）' : '沒有任何 x 成立') + '。（非空論域不會出現 ∀ 真 ∃ 假）' };
    }
    if (k < 0.75) {
      const qs = pick([['∀x∃y', '∃x∀y'], ['∃x∀y', '∀x∃y'], ['∀x∀y', '∃x∃y'], ['∃x∃y', '∀x∀y']]);
      const ans = qs[1] + ' ¬P(x, y)';
      return { q: '¬' + qs[0] + ' P(x, y) 等價於？', opts: [ans, qs[0] + ' ¬P(x, y)', qs[1] + ' P(x, y)', '¬' + qs[1] + ' ¬P(x, y)'], ans, why: '¬ 由外往內穿過量詞，每穿過一個 ∀↔∃ 互換，最後否定 P。' };
    }
    if (k < 0.87) {
      const items = [['∀x∃y (x + y = 0)', '真', '每個 x 取 y = −x。'], ['∃y∀x (x + y = 0)', '假', '沒有一個 y 同時讓所有 x 都滿足。'], ['∀x∃y (x < y)', '真', '取 y = x + 1。'], ['∃y∀x (x < y)', '假', '整數沒有最大值。'], ['∃x∀y (x · y = 0)', '真', 'x = 0 時對所有 y 都成立。'], ['∀x∃y (x = 2y)', '假', 'x 是奇數時找不到整數 y。'], ['∀x∀y (x + y = y + x)', '真', '加法交換律。']];
      const [s, a, why] = pick(items);
      return { q: '論域為所有整數，' + s + ' 為真還是假？', opts: ['真', '假', '要看 x 的值', '無法判斷'], ans: a, why };
    }
    if (k < 0.95) {
      const key = pick(Object.keys(RULES)), R = RULES[key], v = ruleValid(R);
      const ans = v ? '有效：' + R.name : '無效（' + R.name.replace('謬誤：', '') + '）';
      const opts = [...new Set([ans, '有效：Modus ponens', '有效：Modus tollens', '無效（肯定後件）', '無效（否定前件）', '有效：Hypothetical syllogism'])].slice(0, 4);
      if (!opts.includes(ans)) opts[0] = ans;
      return { q: '前提：' + R.prem.map((p) => p[0]).join('；') + '。結論：' + R.concl[0] + '。這個論證？', opts, ans, why: v ? '前提全真的列結論都真。' : '存在前提全真、結論假的列（例如 p=F、q=T）。' };
    }
    const n = pick([3, 5, 6]); // 這三個 n 讓 2ⁿ、2n、n²、2ⁿ⁺¹ 四個選項都不一樣
    return { q: '含 ' + n + ' 個命題變數的複合命題，真值表共有幾列？', opts: [String(1 << n), String(2 * n), String(n * n), String(1 << (n + 1))], ans: String(1 << n), why: '每個變數 T/F 兩種，乘法原理 2^' + n + ' = ' + (1 << n) + '。' };
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

  // ───────────────────────── 場景 ─────────────────────────
  // 趙啟超 1A：課程地圖（三大部分）
  async function scCourseMap(tok) {
    fresh([0, 5.5, 15], [0, 3, 0]);
    const part = (ctx.params || {}).part || 0;
    const COLS = [
      { x: -5.3, head: 'Fundamentals 13h', color: '#4b9ee2', items: ['Logic', 'Set Theory', 'Induction', 'Functions・鴿籠', 'Relations'] },
      { x: -1.8, head: 'Enumeration ≈15h', color: '#9b7ef4', items: ['Counting', '排容原理', 'Recurrence', 'Generating Fn', 'Partition', '複雜度'] },
      { x: 1.8, head: 'Graph Theory', color: '#2fc092', items: ['Graph', 'Isomorphism', 'Euler', 'Planar', 'Tree', 'Spanning Tree'] },
      { x: 5.3, head: '最佳化・Matching', color: '#dd8238', items: ['Shortest Path', 'MST', 'Matching', 'Max Flow'] },
    ];
    const ms = [];
    say('離散與組合數學：分三大部分', 'Discrete and Combinatorial Mathematics');
    for (let c = 0; c < COLS.length; c++) {
      const C = COLS[c];
      tag(C.head, c + 1 === part || (part === 3 && c === 3) ? 'ptr alt' : 'ptr', C.x, 0.1 + C.items.length * 0.62 + 0.7);
      ms.push(C.items.map((it, i) => cube(it, C.color, [3.1, 0.55, 1.1], C.x, 0.3 + i * 0.62, 0, 4)));
      await beat(tok, 700);
    }
    tag('Graph Theory ≈ 22h（含最佳化）', 'idx', 3.55, -0.1, 1.2);
    const caps = {
      0: ['13h + ≈15h + 22h = 50 小時', '18 週 − 期末考週，每週 3 小時'],
      1: ['基礎：邏輯、集合、歸納、函數、關係', 'Relation 重點：equivalence relation、partial order'],
      2: ['計數 → 遞迴關係 → 生成函數', '解遞迴 ≈ 解微分方程；生成函數 ≈ Laplace transform'],
      3: ['圖論：同構、Euler、平面圖、樹', 'Euler trail / circuit、rooted tree、spanning tree'],
      4: ['四個最佳化問題', 'Shortest path、MST、Maximum matching、Max-flow min-cut'],
    };
    const hi = part === 0 ? [0, 1, 2, 3] : part === 3 ? [2] : part === 4 ? [3] : [part - 1];
    hi.forEach((c) => ms[c].forEach((m) => glow(m, GOLD)));
    say(caps[part][0], caps[part][1]);
    await beat(tok, 3200);
    if (part === 2) {
      for (const i of [2, 3]) { move(ms[1][i], -1.8, 0.3 + i * 0.62, 1.2); await beat(tok, 500); }
      say('先解 homogeneous，再解 non-homogeneous', '生成函數也可直接計數（Partition of Integer）');
      await beat(tok, 3000);
    }
    if (part === 0) { say('課本：Grimaldi 第 5 版；台灣常用 Grimaldi 與 Rosen', ''); await beat(tok, 2800); }
  }

  // 什麼是命題（Rosen 1.1）
  async function scPropWhat(tok) {
    fresh([0, 5.5, 13], [0, 1.6, 0]);
    const S = [['1 + 1 = 2', 'T'], ['台北是台灣的城市', 'T'], ['2 + 2 = 5', 'F'], ['x + 1 = 2', '?'], ['現在幾點？', '?'], ['請關門', '?']];
    say('命題（proposition）：可判斷真或假的陳述句', '');
    await beat(tok, 2000);
    const ms = [];
    for (let i = 0; i < S.length; i++) {
      const [s, v] = S[i];
      const x = (i % 3 - 1) * 4.2, z = i < 3 ? -1 : 1.6;
      ms.push(cube(s, v === 'T' ? TC : v === 'F' ? '#e0a37f' : '#bdb3a3', [3.6, 0.6, 1.2], x, 0.3, z, 3));
      say(s, v === 'T' ? '命題，真值 T' : v === 'F' ? '命題，真值 F（假的也是命題）' : i === 3 ? '不是命題：x 未定，真假不確定' : '不是命題：不是陳述句');
      await beat(tok, 1500);
    }
    for (let i = 3; i < 6; i++) fly(ms[i], V3(0, 7, -4));
    say('留下來的才是命題：真值 T 或 F', '用 p, q, r… 表示命題變數');
    await beat(tok, 3000);
  }

  // 連接詞：¬ ∧ ∨ ⊕
  async function scConnectives(tok) {
    fresh([0, 4, 15], [0, 3.4, 0]);
    const ks = ['not', 'and', 'or', 'xor'];
    const notes = { not: ['¬p：真假顛倒', 'negation'], and: ['p ∧ q：兩個都真才真', 'conjunction'], or: ['p ∨ q：至少一個真就真（inclusive or）', 'disjunction'], xor: ['p ⊕ q：恰好一個真', 'exclusive or'] };
    for (const k of ks) {
      lab.clear();
      const f = FORMS[k], T = makeTable(f.vars, f.cols, { dx: 2.2 });
      say(notes[k][0], notes[k][1]);
      for (let r = 0; r < T.nR; r++) { await T.fillRow(r, W(tok), 120); await beat(tok, 350); }
      T.glowCol(T.nC - 1, GOLD);
      await beat(tok, 2200);
    }
    say('∨ 是「或」包含兩者都真；⊕ 不包含', 'p ∨ q 與 p ⊕ q 只差在 TT 那一列');
    await beat(tok, 2600);
  }

  // p → q：承諾的例子，vacuous truth
  async function scImplication(tok) {
    fresh([0, 4, 15], [0, 3.4, 0]);
    const T = makeTable('pq', [['p → q', (e) => IMP(e.p, e.q)]], { dx: 2.6, cx: -1.2 });
    tag('p：期末考 100 分', 'idx', 5.2, 5.3); tag('q：學期拿 A', 'idx', 5.2, 4.7);
    say('若期末考 100 分，則學期拿 A', 'p → q：p 是 hypothesis，q 是 conclusion');
    await beat(tok, 2600);
    const why = ['考 100、拿 A：守信 → T', '考 100、沒拿 A：違約 → F', '沒考 100、拿 A：沒違約 → T', '沒考 100、沒拿 A：沒違約 → T'];
    for (let r = 0; r < 4; r++) {
      await T.fillRow(r, W(tok), 120);
      if (r === 1) T.glowRow(1, RED);
      if (r >= 2) T.glowRow(r, GOLD);
      say(why[r], r >= 2 ? 'p 為假時 p → q 一律為真（vacuously true）' : '');
      await beat(tok, 2000);
    }
    say('p → q 只有一種情況是假：p 真 q 假', 'p → q ≡ ¬p ∨ q');
    await beat(tok, 3000);
  }

  // 逆、否、逆否
  async function scConvContra(tok) {
    fresh([0, 4, 15.5], [0, 3.4, 0]);
    const T = makeTable('pq', [['p → q', (e) => IMP(e.p, e.q)], ['q → p 逆', (e) => IMP(e.q, e.p)], ['¬p → ¬q 否', (e) => IMP(!e.p, !e.q)], ['¬q → ¬p 逆否', (e) => IMP(!e.q, !e.p)]], { dx: 2.2 });
    say('原命題 p → q 的三個兄弟', 'converse、inverse、contrapositive');
    await beat(tok, 2200);
    for (let r = 0; r < 4; r++) { await T.fillRow(r, W(tok), 100); await beat(tok, 300); }
    await beat(tok, 800);
    T.glowCol(2, GREEN); T.glowCol(5, GREEN);
    say('原命題 ≡ 逆否命題：兩欄一模一樣', 'p → q ≡ ¬q → ¬p');
    await beat(tok, 2800);
    T.glowCol(2, null); T.glowCol(5, null); T.glowCol(3, GOLD); T.glowCol(4, GOLD);
    say('逆 ≡ 否（互為逆否），但都不等於原命題', 'q → p ≡ ¬p → ¬q');
    await beat(tok, 2800);
    T.clearGlow(); T.glowRow(1, RED); T.glowRow(2, RED);
    say('TF、FT 兩列：原命題和逆命題不同', '「考 100 分 → 拿 A」不代表「拿 A → 考 100 分」');
    await beat(tok, 3000);
  }

  async function scBicond(tok) {
    fresh([0, 4, 15], [0, 3.4, 0]);
    const T = makeTable('pq', [['p → q', (e) => IMP(e.p, e.q)], ['q → p', (e) => IMP(e.q, e.p)], ['p ↔ q', (e) => IFF(e.p, e.q)]], { dx: 2.3 });
    say('p ↔ q：p if and only if q', '兩邊真假相同時為真');
    await beat(tok, 2000);
    for (let r = 0; r < 4; r++) { await T.fillRow(r, W(tok), 110); await beat(tok, 450); }
    T.glowCol(4, GOLD);
    say('p ↔ q ≡ (p → q) ∧ (q → p)', '兩個方向都成立才為真');
    await beat(tok, 2600);
    say('p ↔ q 正好是 p ⊕ q 的否定', '¬(p ⊕ q) ≡ p ↔ q');
    await beat(tok, 2600);
  }

  async function scTautology(tok) {
    fresh([0, 4, 15], [0, 3.2, 0]);
    let T = makeTable('p', FORMS.taut.cols, { dx: 2.4, cx: -3.6 });
    const U = makeTable('p', FORMS.contr.cols, { dx: 2.4, cx: 3.6 });
    say('p ∨ ¬p 與 p ∧ ¬p', '');
    await beat(tok, 1500);
    for (let r = 0; r < 2; r++) { await T.fillRow(r, W(tok), 120); await U.fillRow(r, W(tok), 120); await beat(tok, 500); }
    T.glowCol(2, GREEN); U.glowCol(2, RED);
    say('左：結果全 T → tautology；右：全 F → contradiction', '其他（有 T 有 F）叫 contingency');
    await beat(tok, 3200);
  }

  async function scDeMorgan(tok) {
    fresh([0, 4, 15.5], [0, 3.4, 0]);
    const T = makeTable('pq', [['p ∧ q', (e) => AND(e.p, e.q)], ['¬(p ∧ q)', (e) => !AND(e.p, e.q)], ['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬p ∨ ¬q', (e) => OR(!e.p, !e.q)]], { dx: 1.8 });
    say('De Morgan：¬(p ∧ q) ≡ ¬p ∨ ¬q', '一列一列算，最後比兩欄');
    await beat(tok, 2200);
    for (let r = 0; r < 4; r++) { await T.fillRow(r, W(tok), 90); await beat(tok, 350); }
    for (let r = 0; r < 4; r++) {
      [3, 6].forEach((c) => glow(T.cells[r][c], GREEN));
      say('第 ' + (r + 1) + ' 列：' + TF(T.val(r, 3)) + ' = ' + TF(T.val(r, 6)), '');
      await beat(tok, 600);
    }
    say('兩欄完全相同 → 邏輯等價', '¬(p ∧ q) ≡ ¬p ∨ ¬q；¬(p ∨ q) ≡ ¬p ∧ ¬q');
    await beat(tok, 3200);
  }

  async function scImpOr(tok) {
    fresh([0, 4, 15], [0, 3.4, 0]);
    const T = makeTable('pq', [['p → q', (e) => IMP(e.p, e.q)], ['¬p', (e) => !e.p], ['¬p ∨ q', (e) => OR(!e.p, e.q)]], { dx: 2.3 });
    say('p → q 可以改寫成 ¬p ∨ q', '化簡含 → 的式子時最常用');
    await beat(tok, 2000);
    for (let r = 0; r < 4; r++) { await T.fillRow(r, W(tok), 110); await beat(tok, 350); }
    T.glowCol(2, GREEN); T.glowCol(4, GREEN);
    say('兩欄相同：只有 TF 那列為 F', 'p → q ≡ ¬p ∨ q；¬(p → q) ≡ p ∧ ¬q');
    await beat(tok, 3200);
  }

  // Rosen 例：用定律化簡 ¬(p ∨ (¬p ∧ q))
  async function scEquivLaws(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const steps = [
      ['¬(p ∨ (¬p ∧ q))', '原式'], ['¬p ∧ ¬(¬p ∧ q)', 'De Morgan（第二條）'], ['¬p ∧ (¬¬p ∨ ¬q)', 'De Morgan（第一條）'], ['¬p ∧ (p ∨ ¬q)', 'Double negation'],
      ['(¬p ∧ p) ∨ (¬p ∧ ¬q)', 'Distributive law'], ['F ∨ (¬p ∧ ¬q)', '¬p ∧ p ≡ F（Negation law）'], ['¬p ∧ ¬q', 'Identity law'],
    ];
    say('不用真值表，用等價定律一步步化簡', 'Rosen 的例子');
    await beat(tok, 2200);
    const ms = [];
    for (let i = 0; i < steps.length; i++) {
      ms.forEach((m) => glow(m, null));
      const m = cube(steps[i][0], i === steps.length - 1 ? '#dd8238' : '#4b9ee2', [5.4, 0.55, 1], -1.4, 6.2 - i * 0.82, 0, 2);
      ms.push(m);
      glow(m, GOLD);
      tag(i ? '≡ ' + steps[i][1] : steps[i][1], 'idx', 3.4, 6.2 - i * 0.82);
      say(steps[i][0], i ? '用：' + steps[i][1] : '');
      await beat(tok, 1700);
    }
    say('¬(p ∨ (¬p ∧ q)) ≡ ¬p ∧ ¬q', '和 De Morgan 的 ¬(p ∨ q) 一樣');
    await beat(tok, 3000);
  }

  // 等價定律：分配律、→ 無結合律（3 變數）
  async function scThreeVar(tok) {
    fresh([0, 4, 15.5], [0, 3.2, 0]);
    const T = makeTable('pqr', [['q ∧ r', (e) => AND(e.q, e.r)], ['p∨(q∧r)', (e) => OR(e.p, AND(e.q, e.r))], ['(p∨q)∧(p∨r)', (e) => AND(OR(e.p, e.q), OR(e.p, e.r))]], { dx: 2.1 });
    say('三個變數：2³ = 8 列', '分配律 p ∨ (q ∧ r) ≡ (p ∨ q) ∧ (p ∨ r)');
    await beat(tok, 2200);
    for (let r = 0; r < 8; r++) { await T.fillRow(r, W(tok), 70); await beat(tok, 200); }
    T.glowCol(4, GREEN); T.glowCol(5, GREEN);
    say('8 列都相同 → 分配律成立', '∨ 對 ∧ 分配，∧ 對 ∨ 也分配');
    await beat(tok, 3000);
  }

  // 謂詞與論域
  async function scPredicate(tok) {
    fresh([0, 6, 13], [0, 1, 0]);
    qm.dom = [1, 2, 3, 4, 5, 6]; qm.p = 4; enterQuant(); controls('');
    say('P(x)：x > 3（propositional function）', '代入 x 之後才變成命題');
    await beat(tok, 2400);
    for (const i of [3, 1]) {
      const v = qm.dom[i];
      tint(qm.ms[i], v > 3 ? TC : BAD); glow(qm.ms[i], GOLD);
      say('P(' + v + ')：' + v + ' > 3 為 ' + (v > 3 ? '真' : '假'), 'Rosen：P(4) 真、P(2) 假');
      await beat(tok, 2200);
      glow(qm.ms[i], null);
    }
    say('x 還沒指定時，P(x) 沒有真假', '量詞把 P(x) 變成命題');
    await beat(tok, 2600);
  }

  async function scForallExists(tok) {
    qm.dom = [1, 4, 2, 7, 3, 6]; qm.p = 0;
    enterQuant(); controls(''); lab.frameCamera([0, 6, 13], [0, 1, 0]);
    say('論域 D = {1, 4, 2, 7, 3, 6}，P(x): x > 0', '∀x P(x)：每一個都要成立');
    await beat(tok, 2200);
    await qScan('all', tok);
    say('六顆全綠 → ∀x P(x) 為真', '');
    await beat(tok, 2200);
    qm.p = 4; enterQuant(); controls('');
    say('換 P(x): x > 3，再問 ∀x P(x)', '');
    await beat(tok, 1600);
    await qScan('all', tok);
    say('第一顆 1 > 3 就不成立：反例 → 假', '∀ 只要一個反例就倒');
    await beat(tok, 2400);
    enterQuant(); controls('');
    say('∃x P(x)：找到一個就夠', '');
    await beat(tok, 1400);
    await qScan('ex', tok);
    say('x = 4 成立 → ∃x P(x) 為真', '∃ 只要一個 witness');
    await beat(tok, 2800);
  }

  async function scQuantNeg(tok) {
    qm.dom = [3, 5, 4, 7, 9, 6]; qm.p = 1;
    enterQuant(); controls('');
    say('「D 裡每個數都是偶數」的否定？', '¬∀x P(x)');
    await beat(tok, 2400);
    await qScan('neg', tok);
    say('不是「每個都不是偶數」，而是「有一個不是偶數」', '¬∀x P(x) ≡ ∃x ¬P(x)');
    await beat(tok, 3200);
    say('同理：¬∃x P(x) ≡ ∀x ¬P(x)', '否定穿過量詞：∀ ↔ ∃ 互換');
    await beat(tok, 3000);
  }

  async function scNested(tok) {
    nq.p = 0; nq.o = 0; enterNested(); controls('');
    say('論域 {−2, …, 2}，Q(x, y): x + y = 0', '∀x∃y：每個 x 都找得到 y');
    await beat(tok, 2400);
    await nestedRun(tok);
    say('每一列都找到 y = −x → 真', '∀x∃y (x + y = 0)');
    await beat(tok, 2400);
    nq.o = 1; enterNested(); controls('');
    say('順序反過來：∃y∀x', '要有「一個 y」對所有 x 都成立');
    await beat(tok, 2200);
    await nestedRun(tok);
    say('沒有任何一行全綠 → 假', '量詞順序不能隨便交換');
    await beat(tok, 3000);
  }

  async function scModusPonens(tok) {
    inf.key = 'mp'; enterInfer(); controls('');
    say('Modus ponens：p，p → q，所以 q', '下雨了；若下雨則地濕 → 地濕');
    await beat(tok, 2600);
    await inferCheck(tok);
    say('前提全真只有第 1 列，那列 q 也真 → 有效', '((p ∧ (p → q)) → q) 是 tautology');
    await beat(tok, 2800);
    inf.key = 'mt'; enterInfer(); controls('');
    say('Modus tollens：¬q，p → q，所以 ¬p', '地沒濕 → 沒下雨');
    await beat(tok, 2200);
    await inferCheck(tok);
    say('有效：等於用逆否命題做 modus ponens', '');
    await beat(tok, 2600);
  }

  async function scSyllogism(tok) {
    inf.key = 'hs'; enterInfer(); controls('');
    say('Hypothetical syllogism：p → q，q → r ⊢ p → r', '三個變數 → 8 列');
    await beat(tok, 2400);
    await inferCheck(tok);
    say('四列前提全真，結論都真 → 有效', '推論可以像鏈子一樣串起來');
    await beat(tok, 2800);
  }

  async function scFallacy(tok) {
    inf.key = 'ac'; enterInfer(); controls('');
    say('地濕了；若下雨則地濕 → 所以下雨了？', '肯定後件（affirming the conclusion）');
    await beat(tok, 2600);
    await inferCheck(tok);
    say('p = F、q = T：前提都真，結論卻假', '灑水車也會讓地濕 → 無效');
    await beat(tok, 3000);
    inf.key = 'da'; enterInfer(); controls('');
    say('沒下雨；若下雨則地濕 → 所以地沒濕？', '否定前件（denying the hypothesis）');
    await beat(tok, 2200);
    await inferCheck(tok);
    say('同一列又是反例 → 無效', '');
    await beat(tok, 2600);
  }

  // Rosen：All men are mortal; Socrates is a man.
  async function scSocrates(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    say('所有人都會死；蘇格拉底是人', '∀x (Man(x) → Mortal(x))，Man(Socrates)');
    const p1 = cube('∀x (Man(x) → Mortal(x))', '#9b7ef4', [5.4, 0.6, 1.1], -3, 5, 0, 3);
    await beat(tok, 1600);
    const p2 = cube('Man(Socrates)', '#9b7ef4', [3.4, 0.6, 1.1], 3.6, 5, 0, 3);
    await beat(tok, 2200);
    const s1 = cube('Man(Socrates) → Mortal(Socrates)', '#4b9ee2', [6, 0.6, 1.1], -3, 3.4, 0, 3);
    glow(p1, GOLD);
    say('Universal instantiation：把 x 換成 Socrates', '∀x P(x) ⊢ P(c)');
    await beat(tok, 2800);
    glow(p1, null); glow(s1, GOLD); glow(p2, GOLD);
    say('再用 Modus ponens', '');
    await beat(tok, 1800);
    const c = cube('Mortal(Socrates)', '#dd8238', [3.6, 0.6, 1.1], 0.3, 1.6, 0, 3);
    glow(c, GREEN);
    say('結論：蘇格拉底會死', 'Universal modus ponens');
    await beat(tok, 3000);
  }

  const scenes = {
    'course-map': { title: '課程地圖：基礎、計數、圖論（趙啟超 1A）', play: scCourseMap },
    'prop-what': { title: '什麼是命題（課本）', play: scPropWhat },
    'connectives': { title: '¬ ∧ ∨ ⊕ 真值表一列一列長（課本）', play: scConnectives },
    'implication': { title: 'p → q：只有「p 真 q 假」為假（課本）', play: scImplication },
    'conv-contra': { title: '逆、否、逆否：逆否 ≡ 原命題（課本）', play: scConvContra },
    'biconditional': { title: 'p ↔ q ≡ (p→q) ∧ (q→p)（課本）', play: scBicond },
    'tautology': { title: 'Tautology、contradiction（課本）', play: scTautology },
    'de-morgan': { title: 'De Morgan：兩欄完全相同（課本）', play: scDeMorgan },
    'imp-or': { title: 'p → q ≡ ¬p ∨ q（課本）', play: scImpOr },
    'equiv-laws': { title: '用等價定律化簡（Rosen 例）', play: scEquivLaws },
    'three-var': { title: '三變數真值表：分配律（課本）', play: scThreeVar },
    'predicate': { title: '謂詞 P(x): x > 3（Rosen 例）', play: scPredicate },
    'forall-exists': { title: '∀ 要全亮、∃ 找一個（課本）', play: scForallExists },
    'quant-negation': { title: '¬∀x P(x) ≡ ∃x ¬P(x)（課本）', play: scQuantNeg },
    'nested-quant': { title: '巢狀量詞：∀x∃y vs ∃y∀x（課本）', play: scNested },
    'modus-ponens': { title: 'Modus ponens、Modus tollens（課本）', play: scModusPonens },
    'syllogism': { title: 'Hypothetical syllogism（課本）', play: scSyllogism },
    'fallacy': { title: '謬誤：肯定後件、否定前件（課本）', play: scFallacy },
    'socrates': { title: '量詞推論：蘇格拉底會死（Rosen 例）', play: scSocrates },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ lg.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, icon, rename } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 1 章 Logic（清大 趙啟超 1A–1C、交大 易志偉 Lec01–02）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 趙啟超用 1/0、列順序 00、01、10、11；易志偉用 T/F、Rosen 順序 TT、TF、FT、FF。老師沒給的例子標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const C = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#c08a1f', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8', dark: '#8d8170' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const card = (t, c, x, y, w = 4, h = 0.55, z = 0, drop = 1.2) => cube(t, c, [w, h, 0.8], x, y, z, drop);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.g && o.body) return kill(o.g); if (o.ls) return gone(o.ls); kill(o); });
const glowAll = (arr, c) => arr.forEach((m) => m && glow(m, c));
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4, 15], [0, 3.2, 0]];
const CAMW = [[0, 4.2, 16], [0, 3.2, 0]];

// ── 真值表：一格一顆方塊（真 = 綠、假 = 灰）。bin：1/0 與 00→11 的列順序（趙）；否則 T/F 與 TT→FF（Rosen）
function TT(vars, cols, o = {}) {
  const n = vars.length, nR = 1 << n, bin = !!o.bin, ord = o.order || (bin ? 'FT' : 'TF');
  const rows = [];
  for (let r = 0; r < nR; r++) { const e = {}; vars.forEach((v, i) => { const b = (r >> (n - 1 - i)) & 1; e[v] = ord === 'FT' ? !!b : !b; }); rows.push(e); }
  const all = vars.map((v) => [v, (e) => e[v]]).concat(cols);
  const nC = all.length, dx = o.dx || Math.min(1.7, 12 / nC), cx = o.cx || 0, top = o.top || 5.5, dy = o.dy || (nR > 4 ? 0.62 : 0.85);
  const X = (c) => cx + (c - (nC - 1) / 2) * dx, Y = (r) => top - r * dy;
  const lb = (v) => (bin ? (v ? '1' : '0') : (v ? 'T' : 'F'));
  const heads = all.map(([nm], c) => tag(nm, c < n ? 'idx' : 'ptr', X(c), top + 0.62));
  const cells = rows.map(() => all.map(() => null));
  const T = {
    rows, cells, heads, X, Y, nR, nC, n, lb,
    val: (r, c) => !!all[c][1](rows[r]),
    cell(r, c) { if (!cells[r][c]) { const v = T.val(r, c); cells[r][c] = cube(lb(v), v ? C.green : C.gray, [dx * 0.78, 0.46, 0.6], X(c), Y(r), 0, 1.4); } return cells[r][c]; },
    async fill(tok, list, ms = 110) { for (const [r, c] of list) { T.cell(r, c); if (ms) await wt(tok, ms); } },
    async col(tok, c, ms = 110, rs) { await T.fill(tok, (rs || [...Array(nR).keys()]).map((r) => [r, c]), ms); },
    async row(tok, r, ms = 90, cs) { await T.fill(tok, (cs || [...Array(nC).keys()]).map((c) => [r, c]), ms); },
    now(cs) { for (let r = 0; r < nR; r++) (cs || [...Array(nC).keys()]).forEach((c) => T.cell(r, c)); },
    glowCol(c, col) { cells.forEach((rw) => rw[c] && glow(rw[c], col)); },
    glowRow(r, col) { cells[r].forEach((m) => m && glow(m, col)); },
    glowAt(r, c, col) { if (cells[r][c]) glow(cells[r][c], col); },
    hot(c, on = true) { heads[c].element.className = 'lab-label ' + (on ? 'ptr alt' : (c < n ? 'idx' : 'ptr')); },
    clear() { cells.forEach((rw) => rw.forEach((m) => m && glow(m, null))); },
  };
  return T;
}
const IM = (a, b) => !a || b;
// 真、假兩個小夥伴：結果是真，綠色那隻跳；結果是假，灰色那隻跳
function duo(S, o = {}) {
  const x = o.x || 6.3;
  S.tb = buddy(o.tn || '真', o.bin ? '1' : 'T', C.green, -x, 0, o.z || 1.2, 0.8);
  S.fb = buddy(o.fn || '假', o.bin ? '0' : 'F', '#e0a37f', x, 0, o.z || 1.2, 0.8);
  S.tb.look(1); S.fb.look(-1);
}
async function cheer(tok, S, v) { const b = v ? S.tb : S.fb; if (!b) return; b.mood(v ? 'happy' : 'wow'); await b.hop(tok); }
// 一行一行的等價推導：新的一行發亮，右邊寫用了哪條定律
function chain(x, yTop, dy = 0.8, w = 5.8) {
  const ls = [];
  return { ls, add(e, why, c) { ls.forEach((m) => glow(m, null)); const y = yTop - ls.length * dy; const m = card((ls.length ? '≡ ' : '') + e, c || C.sky, x, y, w, 0.58); glow(m, HL); if (why) sm(why, x + w / 2 + 1.5, y); ls.push(m); return m; } };
}
// 文氏圖：兩個半透明圓與各區塊（交集、差集…）
function ringL(cx, cy, r, color = '#8a7a60', z = 0.04) {
  const pts = []; for (let k = 0; k <= 64; k++) { const a = (Math.PI * 2 * k) / 64; pts.push(V3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
function oval(cx, cy, rx, ry) { const l = ringL(0, 0, 1); l.scale.set(rx, ry, 1); l.position.set(cx, cy, 0); return l; }
function venn(cx, cy, r = 1.9, d = 1.05) {
  const a = Math.atan2(Math.sqrt(r * r - d * d), d);
  const mk = (s, color, op = 0.45) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.position.set(cx, cy, 0.02); lab.world.add(m); return m; };
  const sh = {
    A() { const s = new THREE.Shape(); s.absarc(-d, 0, r, 0, Math.PI * 2, false); return s; },
    B() { const s = new THREE.Shape(); s.absarc(d, 0, r, 0, Math.PI * 2, false); return s; },
    AB() { const s = new THREE.Shape(); s.absarc(d, 0, r, Math.PI - a, Math.PI + a, false); s.absarc(-d, 0, r, -a, a, false); return s; },
    AmB() { const s = new THREE.Shape(); s.absarc(-d, 0, r, a, Math.PI * 2 - a, false); s.absarc(d, 0, r, Math.PI + a, Math.PI - a, true); return s; },
    BmA() { const s = new THREE.Shape(); s.absarc(d, 0, r, a - Math.PI, Math.PI - a, false); s.absarc(-d, 0, r, a, -a, true); return s; },
  };
  const V = { cx, cy, r, d, rings: [], fills: [] };
  V.draw = (na = 'A', nb = 'B') => { V.rings.push(ringL(cx - d, cy, r), ringL(cx + d, cy, r)); V.la = hd(na, cx - d - r * 0.7, cy + r * 0.95); V.lb = hd(nb, cx + d + r * 0.7, cy + r * 0.95); };
  V.fill = (k, color, op) => { const m = mk(sh[k](), color, op); V.fills.push(m); return m; };
  V.unfill = () => { V.fills.forEach((m) => lab.world.remove(m)); V.fills.length = 0; };
  V.at = (k, i = 0, n = 1) => { const yy = cy + (n > 1 ? (0.6 - (1.2 * i) / (n - 1)) : 0); const xx = k === 'AB' ? cx : k === 'AmB' ? cx - d - r * 0.45 : k === 'BmA' ? cx + d + r * 0.45 : cx; return [xx, yy]; };
  return V;
}
const num = (v, x, y, c = C.blue, s = 0.62, drop = 1.4) => cube(String(v), c, [s, s, s], x, y, 0.3, drop);
// stop a dropped block's physics before a hand-made anim() moves it (otherwise a block still falling is pulled back)
const hold = (os) => os.forEach((o) => { for (const b of lab.bodies) if (b.obj === o) { b.mode = 'rest'; b.vel.set(0, 0, 0); } });

// ════════ A_NNGOqui7s（趙啟超 1A：課程內容） ════════
const TABS = ['① Fundamentals', '② Enumeration', '③ Graph Theory'];
function mapScene(id, title, part, color, items) {
  scene(id, title, CAM, items.map((it, k) => async (tok, S) => {
    if (k === 0) { S.n = 0; S.chips = []; TABS.forEach((t, i) => (i === part ? hot : sm)(t, -4.4 + i * 4.4, 6.75)); S.g = buddy('', '', C.sky, -6.3, 0, 1.6, 0.75); S.g.look(1); }
    const [chip, sub, a, b, c2] = it;
    glowAll(S.chips, null);
    if (chip) { const i = S.n++; const col = Math.floor(i / 5), r = i % 5; const x = -2.4 + col * 5.4, y = 5.7 - r * 1.25; const m = card(chip, c2 || color, x, y, 4.0); glow(m, HL); S.chips.push(m); S.last = [x, y]; S.subs = 0; }
    if (sub && S.last) { if (S.subs++) sm(sub, S.last[0] + 4.6, S.last[1], 0.5); else note(sub, S.last[0], S.last[1] - 0.62, 0.5); }
    cap(a, b);
    S.g.mood(k % 2 ? 'happy' : 'calm');
    await S.g.hop(tok);
  }));
}
mapScene('lg-1a-fund', '1A：第一部分 Fundamentals（約 13 小時）', 0, C.blue, [
  ['Fundamentals 基礎', null, '全課分三部分；第一部分是基礎', 'Fundamentals：一些基本的東西', C.gold], // 116.9
  [null, '約 13 小時', '基礎部分大約教 13 小時', ''], // 123.8
  ['Logic 邏輯', null, '第一個：邏輯', ''], // 126.2
  ['Set Theory 集合論', '以前學過 → 很快帶過', '第二個：集合論', '這兩個以前都學過，會很快教過去'], // 129.8
  ['Math. Induction 歸納法', '只強調要注意的地方', '數學歸納法', '應該也學過，只強調要注意的地方'], // 137.9
  ['Functions 函數', '定義 + 幾類函數的性質', '函數：基本定義與性質', ''], // 145.2
  ['Pigeonhole Principle', '鴿籠原理', '鴿籠原理', 'Pigeonhole principle'], // 156.5
  ['Binary Relation 關係', '關係的基本定義', '再來教 relation', 'binary relation 的基礎定義'], // 159.1
  ['Equivalence relation', '等價關係', '特別講兩類重要的 relation：', '一個叫 equivalence relation'], // 170.0
  ['Partial order 偏序', '（partial ordering）', '另一個叫 partial ordering', '基礎部分到這裡'], // 171.8
]);
mapScene('lg-1a-enum', '1A：第二部分 Enumeration（計數）', 1, C.purple, [
  ['Enumeration 計數', null, '第二部分：組合數學裡很重要的部分', 'Enumeration', C.gold], // 177.0
  [null, '數「有幾個」「有幾種方法」', '就是數東西有多少個、方法有幾種', '類似高中的排列組合'], // 187.0
  [null, null, '會教新方法', '高中大多只用加減乘除；這裡有算不出來的新技巧'], // 200.1
  ['Principle of Counting', '回憶高中排列組合', '先回顧計數原理', ''], // 219.1
  ['排容原理 PIE', 'Inclusion–Exclusion', 'Principle of Inclusion and Exclusion', '排容原理'], // 226.3
  ['Recurrence Relation', null, '再來解 recurrence relation（遞迴關係）', '計數常會變成遞迴關係'], // 230.7
  [null, '= difference equation 差分方程', '又叫 difference equation', '差分方程'], // 243.3
  ['先 homogeneous → 再 non-homo.', null, '先解齊次，再解非齊次', 'homogeneous → non-homogeneous'], // 248.5
  [null, '像微分方程，但更簡單', '解法像微分方程，只是更簡單', '離散通常比連續簡單'], // 256.3
  ['Generating Function 生成函數', null, '主要的新技巧：Generating Function', ''], // 283.0
  [null, '像 Laplace：換 domain 解', '用生成函數解遞迴', '就像微分方程用 Laplace transform：換 domain 解完再變回來'], // 298.0
  ['生成函數直接計數', null, '生成函數也能直接拿來計數', '算 sequence 的生成函數有時比直接算容易'], // 310.4
  ['Partition of Integer', '整數分割有幾種方法', '例子：partition of integer', ''], // 330.2
  ['Algorithm 複雜度', '要花多少時間／計算量', '計數常拿來算複雜度', '估計一個 algorithm 要做多少事'], // 344.7
]);
mapScene('lg-1a-graph', '1A：第三部分 Graph Theory（約 22 小時）', 2, C.green, [
  ['Graph Theory 圖論', null, '第三部分：圖論', '離散數學裡通常都會教的部分', C.gold], // 382.1
  [null, '約 22 小時（比一般課多）', '圖論教得比前兩部分多，大約 22 小時', '對電機系很重要、很多課沒教過'], // 398.1
  ['Graph：定義與性質', null, '先介紹什麼叫 graph', '以及它的性質'], // 415.0
  ['Graph Isomorphism', '兩個圖何時「一樣」', 'Graph isomorphism', '什麼叫兩個 graph 是 isomorphic'], // 420.5
  ['Euler trail / circuit', '（Euler cycle）', 'Euler trail、Euler circuit', '以及相關的問題'], // 426.6
  ['Planar Graph 平面圖', '能畫在平面上（不交叉）', 'Planar graph', '可以畫在一個平面上的圖'], // 434.7
  ['Tree 樹', null, '一種特別的 graph：Tree', '定義跟性質'], // 441.2
  ['Rooted Tree', '有根的樹', '有些 tree 有 root', 'rooted tree'], // 449.3
  ['Spanning Tree', null, 'Spanning tree', ''], // 453.9
  ['Tree 與 Sorting', null, '還有跟 sorting 相關的 tree', ''], // 456.2
]);
mapScene('lg-1a-opt', '1A：Optimization 與 Matching 四個問題', 2, C.orange, [
  ['Optimization & Matching', '四個問題', '最後講 optimization 跟 matching', '主要有四個問題', C.gold], // 458.7
  ['① Shortest Path', '最短路徑', '第一個：最短路徑問題', 'Shortest path problem'], // 465.1
  [null, 'Dijkstra\'s algorithm', '通常用一個 algorithm 解', 'Dijkstra\'s algorithm'], // 471.4
  ['② Minimal Spanning Tree', '很多 spanning tree 裡找最小的', '第二個：Minimal spanning tree', '也有對應的 algorithm'], // 475.1
  ['③ Matching', 'bipartite graph 裡配對', '第三個：matching problem', '在 bipartite graph 裡找 matching'], // 488.7
  [null, null, '找最大的 matching', 'maximum matching'], // 495.8
  ['④ Max Flow', '網路裡的最大流量', '第四個：max flow', '定義 flow、滿足條件、找最大的 flow'], // 502.0
  [null, 'Max-Flow Min-Cut Theorem', '對應一個很有名的定理', 'Max-flow min-cut theorem'], // 512.7
]);
scene('lg-1a-hours', '1A：全課 50 小時怎麼來', CAM, [
  async (tok, S) => { // 529.2 預計上課 50 小時
    S.big = hot('上課約 50 小時', 0, 6.5);
    S.g = buddy('', '', C.sky, -6.3, 0, 1.6, 0.75); S.g.look(1);
    cap('這門課預計上課 50 小時', ''); await S.g.hop(tok);
  },
  async (tok, S) => { // 537.1 18 週扣掉期末考週，每週 3 小時
    S.wk = [];
    for (let i = 0; i < 17; i++) { S.wk.push(cube('3h', C.sky, [0.62, 0.62, 0.62], -5.6 + i * 0.7, 5.2, 0, 1.2)); if (i % 4 === 3) await wt(tok, 60); }
    S.t1 = sm('18 週 − 期末考週 = 17 週，每週 3 小時 → 51 小時', 0, 4.4);
    cap('一學期 18 週，扣掉期末考週', '17 週 × 3 小時 = 51 小時');
  },
  async (tok, S) => { // 545.0 有一天放假 → 50
    tint(S.wk[16], C.gray); relabel(S.wk[16], '2h'); glow(S.wk[16], NG);
    S.t2 = note('有一天放假 → 少 1 小時 → 50 小時', 3.2, 3.8);
    cap('有一天放假', '所以剩下 50 小時'); await S.g.hop(tok);
  },
  async (tok, S) => { // 547.5 三部分加起來剛好 50
    const parts = [['Fundamentals 13h', 13, C.blue], ['Enumeration ≈15h', 15, C.purple], ['Graph Theory 22h', 22, C.green]];
    let x = -6.75;
    for (const [t, h, c] of parts) { const w = h * 0.27; cube(t, c, [w - 0.06, 0.7, 0.8], x + w / 2, 2.3, 0, 1.6); x += w; await wt(tok, 250); }
    sm('13 + 15 + 22 = 50', 0, 1.5);
    cap('三部分加起來剛好 50 小時', 'Enumeration 的 15 小時是 50 − 13 − 22 推算的');
  },
  async (tok, S) => { // 551.2 考試不在課堂上考
    good('考試不在課堂上考 → 不佔上課時間', 0, 0.5);
    S.g.mood('happy'); cap('考試不佔上課時間', '所以一共 50 小時都在上課'); await S.g.hop(tok);
  },
]);

// ════════ QCh-aVmXANA（趙啟超 1B：statement、¬ ∧ ∨、De Morgan、→） ════════
scene('lg-1b-stmt', '1B：statement 與真假值', CAM, [
  async (tok, S) => { // 18.8 邏輯的基本元件 statement
    S.c = card('statement（敘述）', C.lilac, 0, 5.2, 4.6, 0.7);
    cap('邏輯的基本元件：statement', '一句可以判斷真假的話');
  },
  async (tok, S) => { // 22.3 用 p 表示
    S.p = cube('p', C.purple, [0.9, 0.9, 0.9], -3.6, 5.2, 0, 2); hot('p 代表一個 statement', -3.6, 6.3);
    cap('用 p 來表示一個 statement', '');
  },
  async (tok, S) => { // 36.0 兩個值：True、False
    duo(S, { x: 3.2, tn: 'True 真', fn: 'False 假' });
    cap('statement 只有兩個值', 'true（真）或 false（假）'); await cheer(tok, S, true);
  },
  async (tok, S) => { // 72.1 用 T/F 或 1/0
    S.tb.set('T ＝ 1'); S.fb.set('F ＝ 0'); S.tf = sm('後面常用 T、F 或 1、0 表示', 0, 1.6);
    cap('後面用 T、F，或用 1、0 來表示', '1 = true，0 = false'); await cheer(tok, S, false);
  },
  async (tok, S) => { // 98.2 例：20 is a multiple of 3
    S.e = card('20 is a multiple of 3', C.sky, 0, 3.6, 5.2, 0.7);
    cap('例子：20 is a multiple of 3', '這是一個 statement');
  },
  async (tok, S) => { // 104.2 multiple = 倍數
    sm('multiple ＝ 倍數', 3.6, 4.3);
    cap('multiple 是「倍數」', '「20 是 3 的倍數」');
  },
  async (tok, S) => { // 108.6 很明顯是 false
    glow(S.e, NG); S.v = bad('False：20 不是 3 的倍數', 0, 2.7);
    cap('很明顯，這個 statement 是 false', '20 不是 3 的倍數'); await cheer(tok, S, false);
  },
  async (tok, S) => { // 118.0 倍數的定義
    gone(S.tf); note('a 是 b 的倍數 ⇔ a = b × 某個整數', 0, 2.05);
    sm('3 × 6 = 18，3 × 7 = 21 → 20 夾在中間', 0, 1.45);
    cap('倍數：等於另一個數乘上一個整數', '因數、倍數都只對整數而言');
  },
]);
scene('lg-1b-not', '1B：否定 ¬p 與它的真值表', CAM, [
  async (tok, S) => { // 134.0 原來的 statement p
    S.p = card('p：20 is a multiple of 3', C.sky, -3.2, 6.0, 5.4, 0.6); S.pv = bad('0', 0.2, 6.0);
    cap('原來的 statement 是 p', '它有一個「否定」');
  },
  async (tok, S) => { // 143.5 寫成 ¬p，讀 not p
    S.n = card('¬p', C.orange, 3.6, 6.0, 1.6, 0.6); sm('讀作 not p（也有人寫 ~p、p̄）', 3.6, 5.35);
    cap('p 的否定寫成 ¬p', '叫做 not p；不同書符號可能不一樣');
  },
  async (tok, S) => { // 148.5 例子
    S.a = arrow(V3(-3.2, 5.6, 0), V3(-3.2, 4.85, 0));
    cap('剛才那句的否定是什麼？', '');
  },
  async (tok, S) => { // 177.3 20 is not a multiple of 3 → true
    S.q = card('¬p：20 is NOT a multiple of 3', C.peach, -3.2, 4.4, 5.8, 0.6); S.qv = good('1', 0.4, 4.4);
    duo(S, { bin: true, tn: 'true', fn: 'false' });
    cap('20 is not a multiple of 3', '原本是 false，現在這句是 true'); await cheer(tok, S, true);
  },
  async (tok, S) => { // 188.0 true 的否定就 false
    const a = S.tb.g.position.clone(), b = S.fb.g.position.clone();
    await Promise.all([travel(tok, S.tb.g, a, b, 900), travel(tok, S.fb.g, b, a, 900)]);
    cap('statement 是 true，否定就 false', '是 false，否定就 true：真假互換');
  },
  async (tok, S) => { // 191.3 真值表
    gone(S.p, S.pv, S.n, S.a, S.q, S.qv);
    S.T = TT(['p'], [['¬p', (e) => !e.p], ['¬(¬p)', (e) => e.p]], { bin: true, order: 'TF', dx: 2.2, top: 4.6 });
    cap('用真值表（truth table）來表示', '把所有可能列出來');
  },
  async (tok, S) => { // 209.6 p 有兩種可能 1、0
    await S.T.col(tok, 0, 200);
    cap('p 只有兩種可能：不是 true 就是 false', '用 1 跟 0 表示');
  },
  async (tok, S) => { // 219.3 1 是 true，0 是 false
    sm('1 = true', -4.4, S.T.Y(0)); sm('0 = false', -4.4, S.T.Y(1));
    cap('1 是 true，0 是 false', '');
  },
  async (tok, S) => { // 221.5 not p：1 變 0、0 變 1
    S.T.hot(1); await S.T.col(tok, 1, 250); await cheer(tok, S, false);
    cap('not p：true 變 false，false 變 true', '1 → 0，0 → 1');
  },
  async (tok, S) => { // 247.2 再否定一次
    S.T.hot(1, false); S.T.hot(2);
    cap('把 not p 再否定一次', '¬(¬p) 會是什麼？');
  },
  async (tok, S) => { // 261.0 一樣運算：0 變 1、1 變 0
    await S.T.col(tok, 2, 250); await cheer(tok, S, true);
    cap('照同樣的規則：0 變 1，1 變 0', '');
  },
  async (tok, S) => { // 271.5 否定兩次變回原來
    S.T.glowCol(0, OKG); S.T.glowCol(2, OKG); good('¬(¬p) 和 p 每一列都一樣', 0, 2.2);
    cap('否定兩次就變回原來的', 'double negation');
  },
]);
scene('lg-1b-orand', '1B：p ∨ q 與 p ∧ q（1/0 真值表）', CAM, [
  async (tok, S) => { // 287.4 兩個 statement 之間的運算
    S.p = cube('p', C.purple, [0.9, 0.9, 0.9], -5.6, 4.8, 0, 2); S.q = cube('q', C.blue, [0.9, 0.9, 0.9], -5.6, 3.6, 0, 2);
    cap('兩個 statement 之間還有其他運算', 'p、q 都是 statement');
  },
  async (tok, S) => { // 293.4 or：p ∨ q
    S.or = card('p ∨ q（p or q）', C.sky, -3.4, 1.6, 3.6);
    cap('往上開口的這個是 or', 'p ∨ q');
  },
  async (tok, S) => { // 312.1 and：p ∧ q
    S.and = card('p ∧ q（p and q）', C.peach, 0.6, 1.6, 3.6);
    cap('有 or 就有 and', 'p ∧ q');
  },
  async (tok, S) => { // 326.5 or 的定義
    note('∨：至少一個 true 就 true', -3.4, 0.85);
    cap('or：兩個裡面有一個 true 就 true', '至少一個 true');
  },
  async (tok, S) => { // 335.0 and 的定義
    note('∧：兩個都 true 才 true', 0.6, 0.85);
    cap('and：兩個都要 true 才 true', '');
  },
  async (tok, S) => { // 339.0 真值表
    S.T = TT(['p', 'q'], [['p ∨ q', (e) => e.p || e.q], ['p ∧ q', (e) => e.p && e.q]], { bin: true, dx: 1.9, cx: 1.2, top: 5.6 });
    duo(S, { bin: true, x: 6.4 });
    cap('用 truth table 來看', '第一欄 p ∨ q，第二欄 p ∧ q');
  },
  async (tok, S) => { // 358.0 p 兩種、q 兩種
    sm('p：2 種 × q：2 種 = 4 種', 1.2, 7.0);
    cap('p 有 1、0 兩種，q 也有兩種', '擺在一起：2 × 2 = 4 種');
  },
  async (tok, S) => { // 364.6 四種可能
    await S.T.col(tok, 0, 100); await S.T.col(tok, 1, 100);
    cap('兩個都 false、一個 false 一個 true…', '一共四種可能：00、01、10、11');
  },
  async (tok, S) => { // 380.5 or：至少一個 1 就 1
    S.T.hot(2); await S.T.col(tok, 2, 220, [1, 2, 3]); await cheer(tok, S, true);
    cap('p ∨ q：只要至少一個 1 就是 1', '01、10、11 → 1');
  },
  async (tok, S) => { // 392.0 兩個都 false 才 false
    await S.T.col(tok, 2, 0, [0]); S.T.glowAt(0, 2, NG); await cheer(tok, S, false);
    cap('兩個都 0 的時候，or 才是 0', '');
  },
  async (tok, S) => { // 399.0 and：兩個都 1 才 1
    S.T.hot(2, false); S.T.hot(3); await S.T.col(tok, 3, 0, [3]); S.T.glowAt(3, 3, OKG); await cheer(tok, S, true);
    cap('p ∧ q：兩個都 1 才是 1', '11 → 1');
  },
  async (tok, S) => { // 406.4 其他三個都是 0
    await S.T.col(tok, 3, 200, [0, 1, 2]); await cheer(tok, S, false);
    cap('其他 case 都是 0', 'p ∧ q 這欄：0 0 0 1');
  },
]);
scene('lg-1b-dm', '1B：De Morgan 由真值表推出來', CAMW, [
  async (tok, S) => { // 418.2 再配上 not
    S.T = TT(['p', 'q'], [['p ∨ q', (e) => e.p || e.q], ['¬(p ∨ q)', (e) => !(e.p || e.q)], ['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬p ∧ ¬q', (e) => !e.p && !e.q]], { bin: true, dx: 1.62, top: 5.7 });
    S.T.now([0, 1, 2]);
    cap('剛才的 or，再配上 not', '');
  },
  async (tok, S) => { // 430.1 ¬(p ∨ q)：反過來 → 1000
    S.T.hot(3); await S.T.col(tok, 3, 200);
    cap('p ∨ q 加一個否定：把 or 的結果反過來', '0111 → 1000');
  },
  async (tok, S) => { // 456.1 ¬p：p 是 0011 → 1100
    S.T.hot(3, false); S.T.hot(4); await S.T.col(tok, 4, 180);
    cap('把 p 否定：p 是 0011', '否定就是 1100');
  },
  async (tok, S) => { // 466.4 ¬q：q 是 0101 → 1010
    S.T.hot(4, false); S.T.hot(5); await S.T.col(tok, 5, 180);
    cap('q 是 0101，否定就是 1010', '');
  },
  async (tok, S) => { // 470.6 看 not p and not q
    S.T.hot(5, false); S.T.hot(6); S.T.glowCol(4, HL); S.T.glowCol(5, HL);
    cap('再看 not p 跟 not q 的 and', '¬p ∧ ¬q');
  },
  async (tok, S) => { // 488.3 兩個都是 1 才 1
    await S.T.col(tok, 6, 220); S.T.clear();
    cap('and：兩個都是 1 才是 1', '只有第一列兩個都是 1 → 1000');
  },
  async (tok, S) => { // 501.5 兩欄一模一樣
    S.T.hot(6, false); S.T.glowCol(3, OKG); S.T.glowCol(6, OKG);
    S.eq = good('1000 ＝ 1000：四種情況都一樣！', 0, 2.4);
    cap('¬(p ∨ q) 是 1000，¬p ∧ ¬q 也是 1000', '四種狀況結果都一模一樣');
  },
  async (tok, S) => { // 524.1 logical equivalent
    S.c1 = card('兩者 logically equivalent（邏輯等價）', C.mint, 0, 1.5, 7.2, 0.6);
    cap('這兩個叫做 logically equivalent', '所有 true / false 的組合下結果都相同');
  },
  async (tok, S) => { // 568.0 符號 ≡
    gone(S.eq); S.f1 = card('¬(p ∨ q) ≡ ¬p ∧ ¬q', C.sky, -2.6, 0.6, 5.0, 0.6); sm('≡：三條橫線', 1.6, 0.6);
    cap('符號寫成三條橫線 ≡', '');
  },
  async (tok, S) => { // 589.7 不同書符號不一樣
    sm('（也有書寫 ⇔）', 4.0, 0.6);
    cap('符號怎麼寫，不同書會不一樣', '意思都是：在邏輯上一樣');
  },
  async (tok, S) => { // 608.5 把 and、or 反過來也成立
    S.T.clear(); bub('把 ∨ 換成 ∧、∧ 換成 ∨，也一樣成立', 0, 7.2);
    cap('同理，把 and、or 對調', '會得到同樣的結果');
  },
  async (tok, S) => { // 668.0 ¬(p ∧ q) ≡ ¬p ∨ ¬q
    S.f2 = card('¬(p ∧ q) ≡ ¬p ∨ ¬q', C.sky, -2.6, -0.2, 5.0, 0.6);
    cap('not (p and q) ≡ not p or not q', '');
  },
  async (tok, S) => { // 677.3 否定進括號、and/or 對調
    const n = hot('¬', -4.6, 1.3); await travel(tok, n, V3(-4.6, 1.3, 0.6), V3(-3.4, 0.6, 0.6), 700); gone(n);
    cap('括號外的否定，分給括號裡每一個', '再把 and、or 反過來');
  },
  async (tok, S) => { // 702.0 De Morgan's law
    glow(S.f1, HL); glow(S.f2, HL); hot('De Morgan\'s Law', 4.4, 0.2);
    cap('這兩條叫 De Morgan\'s law', '');
  },
  async (tok, S) => { // 723.1 集合也有
    sm('集合也有一版：之後 Set Theory', 4.4, -0.5);
    cap('這是邏輯版本', '後面集合那邊也有類似的 De Morgan\'s law');
  },
  async (tok, S) => { // 728.1 Augustus De Morgan
    note('Augustus De Morgan（1806–1871）英國數學家，著有《Formal Logic》', 0, -1.2);
    cap('Augustus De Morgan，19 世紀英國數學家', '他的書 Formal Logic 裡就有這個定律');
  },
]);
scene('lg-1b-imp', '1B：p → q 的真值表為什麼這樣定義', CAM, [
  async (tok, S) => { // 749.2 跟推論有關
    cap('not、and、or 之後', '接下來看跟「推論」有關的');
  },
  async (tok, S) => { // 760.1 if p then q
    S.c1 = card('If p, then q（若 p 則 q）', C.lilac, 3.2, 5.8, 5.4, 0.6);
    cap('從 p 推到 q：if p then q', '如果 p 成立，q 就會成立');
  },
  async (tok, S) => { // 772.3 p implies q
    S.c2 = card('p → q（p implies q）', C.lilac, 3.2, 5.0, 5.4, 0.6);
    cap('也寫成 p implies q', 'p → q');
  },
  async (tok, S) => { // 821.0 premise 前提
    note('p：premise 前提', 1.8, 4.2);
    cap('前面的 p 叫 premise', '前提');
  },
  async (tok, S) => { // 840.0 conclusion 結論
    note('q：conclusion 結論', 4.8, 4.2);
    cap('後面的 q 是 conclusion', '結論');
  },
  async (tok, S) => { // 860.0 p→q 的 truth table
    S.T = TT(['p', 'q'], [['p → q', (e) => IM(e.p, e.q)]], { bin: true, dx: 1.7, cx: -3.2, top: 5.4 });
    duo(S, { bin: true, x: 6.4 });
    cap('p → q 的真假怎麼決定？', '看它的 truth table');
  },
  async (tok, S) => { // 868.0 四種可能
    await S.T.col(tok, 0, 90); await S.T.col(tok, 1, 90);
    cap('p、q 一樣有四種可能', '00、01、10、11');
  },
  async (tok, S) => { // 881.4 只有這時 false：對的推到錯的
    S.T.hot(2); await S.T.col(tok, 2, 0, [2]); S.T.glowRow(2, NG); await cheer(tok, S, false);
    cap('只有 1 推到 0 的時候是 false', '從對的推到錯的');
  },
  async (tok, S) => { // 894.1 其他 case 都 true
    await S.T.col(tok, 2, 200, [0, 1, 3]); await cheer(tok, S, true);
    cap('其他 case 都定義成 true', 'p → q：1 1 0 1');
  },
  async (tok, S) => { // 904.6 錯的推到錯的也算對
    S.T.glowRow(0, OKG);
    cap('錯的推到錯的，這個推論是對的', '0 → 0：true');
  },
  async (tok, S) => { // 934.1 為什麼這樣定義？
    S.q = bub('為什麼這樣定義？', 3.2, 2.8);
    cap('為什麼要這樣定義呢？', '');
  },
  async (tok, S) => { // 951.1 premise 錯的時候
    S.T.clear(); S.T.glowRow(0, HL); S.T.glowRow(1, HL);
    note('p = 0：不管 q 是 0 還是 1 → p → q 都是 1', 2.6, 2.0);
    cap('premise 是錯的時候', '不管結論是對是錯，整個推論都定義成對');
  },
  async (tok, S) => { // 1003.4 要說錯必須確定它錯
    S.e = card('要說它錯，必須有證據', C.peach, 3.2, 1.0, 4.8, 0.6);
    cap('這個 implication 要說錯', '必須確定它錯：有證據才能說錯');
  },
  async (tok, S) => { // 1012.3 innocent until proven guilty
    S.j = icon('⚖️', '無罪推定', -5.6, 1.3); S.j2 = sm('innocent until proven guilty', 3.2, 0.2);
    cap('像法律上說的', 'innocent until proven guilty：證明有罪前都假設無辜');
  },
  async (tok, S) => { // 1040.1 只有 1→0 才說錯
    S.T.clear(); S.T.glowRow(2, NG); bad('只有這列：對的推到錯的 → 錯', -3.2, 1.6);
    cap('只有 1 推到 0，我們才說 implication 錯', '其他情況沒有證據說它錯 → 對');
  },
]);
scene('lg-1b-eleph', '1B：大象會飛的例子', CAM, [
  async (tok, S) => { // 1068.6 If elephants can fly, then the Dodgers will win
    S.el = buddy('大象', '🐘', '#a9a39a', -5.3, 0, 0.8, 1.2); S.el.look(1);
    S.c1 = card('If elephants can fly,', C.sky, 0.4, 5.8, 6.4, 0.6);
    S.c2 = card('then the Dodgers will win the World Series.', C.sky, 0.4, 5.0, 8.4, 0.6);
    cap('第一個推論：如果大象會飛', '道奇隊就會贏得今年的 World Series');
  },
  async (tok, S) => { // 1079.3 Dodgers、World Series
    sm('Dodgers：洛杉磯道奇隊；World Series：美國職棒總冠軍賽', 0.4, 4.3);
    cap('Dodgers 是洛杉磯道奇隊', 'World Series 是美國職棒最後的總冠軍賽');
  },
  async (tok, S) => { // 1101.6 第二個：will NOT win
    S.c3 = card('If elephants can fly,', C.peach, 0.4, 3.3, 6.4, 0.6);
    S.c4 = card('then the Dodgers will NOT win the World Series.', C.peach, 0.4, 2.5, 8.4, 0.6);
    cap('第二個推論：如果大象會飛', '道奇隊就「不會」贏');
  },
  async (tok, S) => { // 1119.6 兩個都只能說對
    good('true', 6.8, 5.0); good('true', 6.8, 2.5);
    cap('根據前面的定義', '這兩個推論我們都只能說是對的');
  },
  async (tok, S) => { // 1141.0 因為大象不會飛
    S.el.mood('sad'); S.el.set('不會飛');
    note('premise「大象會飛」是 0：0 → 1、0 → 0 都是 1', 1.8, 1.2);
    cap('因為沒辦法證明它錯', '要證明它錯，得先讓大象飛起來');
    await S.el.hop(tok);
  },
  async (tok, S) => { // 1181.6 換成日本大賽、台灣大賽
    sm('換成 Japan Series、Taiwan Series：一樣都是 true', 1.4, 0.3);
    cap('不喜歡這例子，可換成日本大賽或台灣大賽', '道理一樣：前提假 → 推論為真');
  },
]);
scene('lg-1b-xy1', '1B：x = y ⇒ x + 1 = y + 1（為什麼 0 → 0 要算真）', CAM, [
  async (tok, S) => { // 1203.2 x = y ⇒ x+1 = y+1
    S.c = card('x = y  ⇒  x + 1 = y + 1', C.lilac, 0, 6.1, 6.2, 0.7);
    cap('再看一個推論', 'x 等於 y，推到 x + 1 等於 y + 1');
  },
  async (tok, S) => { // 1206.3 這推論是對的
    S.ok = good('兩邊加同一個數，還是相等 → 對的推論', 0, 5.3);
    cap('這個推論是對的', '相等的兩邊同加一個數，答案一樣');
  },
  async (tok, S) => { // 1219.3 不管 x、y 是多少都對
    note('不管 x、y 是多少，這個 implication 都要是 1', 0, 4.6);
    duo(S, { bin: true, x: 6.4 });
    cap('不管 x 跟 y 是多少，這都對', '帶兩個 case 進來看看');
  },
  async (tok, S) => { // 1238.4 x = 1/2, y = 0.5
    hd('x = 1/2，y = 0.5', -4.4, 3.6); S.a1 = card('1/2 = 0.5', C.sky, -1.2, 3.6, 2.6); good('1', 0.7, 3.6);
    cap('x 用 1/2，y 用 0.5 代', '1/2 = 0.5：對的');
  },
  async (tok, S) => { // 1268.3 1 → 1：true
    card('1/2 + 1 = 0.5 + 1', C.sky, 3.0, 3.6, 3.4); good('1', 5.2, 3.6); arrow(V3(1.0, 3.6, 0.5), V3(1.3, 3.6, 0.5));
    cap('1/2 + 1 = 0.5 + 1 也是對的', '對的推到對的：true'); await cheer(tok, S, true);
  },
  async (tok, S) => { // 1278.2 x = 2, y = 3
    hd('x = 2，y = 3', -4.4, 2.2);
    cap('現在帶別的：x 帶 2，y 帶 3', '');
  },
  async (tok, S) => { // 1299.7 2 = 3 → false
    card('2 = 3', C.peach, -1.2, 2.2, 2.6); bad('0', 0.7, 2.2);
    cap('第一個：2 = 3', '這個 statement 是 false');
  },
  async (tok, S) => { // 1307.8 2+1 = 3+1 → 3 = 4 false
    card('2+1 = 3+1（3=4）', C.peach, 3.2, 2.2, 3.6); bad('0', 5.9, 2.2); arrow(V3(1.0, 2.2, 0.5), V3(1.2, 2.2, 0.5));
    cap('2 + 1 = 3 + 1，也就是 3 = 4', '也是 false');
  },
  async (tok, S) => { // 1314.7 0 → 0 必須 true
    S.must = good('0 → 0：必須定義成 true', 0, 1.2); await cheer(tok, S, true);
    cap('false 推到 false 是 true', '因為不管 x、y 是多少，推論都對');
  },
  async (tok, S) => { // 1326.0 不然前面就不一致
    bad('若定義成 false → 跟「這推論永遠對」矛盾', 0, 0.4); await cheer(tok, S, false);
    cap('如果把 false 推到 false 定義成 false', '就跟前面不一致了');
  },
]);
scene('lg-1b-xyz', '1B：x = y ⇒ xz = yz（為什麼 0 → 1 也算真）', CAM, [
  async (tok, S) => { // 1352.0 x = y ⇒ xz = yz
    S.c = card('x = y  ⇒  xz = yz', C.lilac, 0, 6.1, 5.4, 0.7);
    cap('再看一個例子', 'x = y，兩邊都乘上 z');
  },
  async (tok, S) => { // 1375.1 左右同乘：true
    good('兩邊同乘一個數，還是相等 → 對的推論（任何 x、y、z）', 0, 5.3);
    duo(S, { bin: true, x: 6.4 });
    cap('根據以前學的，這個推論是對的', '不管 x、y、z 是什麼數都成立');
  },
  async (tok, S) => { // 1398.4 x=2, y=3, z=0
    hd('x = 2，y = 3，z = 0', -3.6, 4.2);
    cap('隨便代：x 代 2、y 代 3', 'z 代 0');
  },
  async (tok, S) => { // 1415.3 2 = 3 false
    card('2 = 3', C.peach, -3.6, 3.2, 2.6); bad('0', -1.8, 3.2);
    cap('原來的 statement：2 = 3', 'false');
  },
  async (tok, S) => { // 1418.1 2·0 = 3·0 → 0 = 0 true
    card('2·0 = 3·0（0 = 0）', C.mint, 2.0, 3.2, 3.8); good('1', 4.3, 3.2); arrow(V3(-1.5, 3.2, 0.5), V3(-0.2, 3.2, 0.5));
    cap('得出來：2 × 0 = 3 × 0', '左右兩邊都是 0 → true');
  },
  async (tok, S) => { // 1426.0 false 推到 true 是 true
    good('0 → 1：true', 0, 2.3); await cheer(tok, S, true);
    cap('false 推到 true', '根據定義是 true');
  },
  async (tok, S) => { // 1436.0 不然又不一致
    note('因為這推論對「所有」x、y、z 都要成立', 0, 1.7);
    cap('為什麼要 true？', '推論永遠成立，代 z = 0 也要成立，不然又不一致');
  },
  async (tok, S) => { // 1459.0 只有 1→0 才是錯
    S.T = TT(['p', 'q'], [['p → q', (e) => IM(e.p, e.q)]], { bin: true, dx: 1.2, cx: -3.0, top: 0.3, dy: 0.62 });
    S.T.now(); S.T.glowRow(0, OKG); S.T.glowRow(1, OKG); S.T.glowRow(2, NG);
    sm('0→0、0→1 都必須是 1', 3.4, 0.0);
    cap('所以只有對的推到錯的才能說錯', '0 → 0、0 → 1 都必須定義成 true');
  },
]);
scene('lg-1b-conv', '1B：converse、↔、contrapositive', CAM, [
  async (tok, S) => { // 1528.0 若 p 則 q
    S.o = card('p → q（若 p 則 q）', C.lilac, -3.0, 5.8, 4.6, 0.6);
    cap('回到推論：若 p 則 q', 'if p then q');
  },
  async (tok, S) => { // 1539.5 converse
    S.c = card('q → p：converse（逆）', C.sky, 3.0, 5.8, 4.6, 0.6);
    const a = hd('p', -4.2, 6.6), b = hd('q', -2.0, 6.6);
    await Promise.all([travel(tok, a, V3(-4.2, 6.6, 0), V3(4.0, 6.6, 0), 900), travel(tok, b, V3(-2.0, 6.6, 0), V3(1.8, 6.6, 0), 900)]);
    cap('把它反過來寫：q implies p', '叫做原來那句的 converse');
  },
  async (tok, S) => { // 1576.0 兩個方向推
    S.bi = card('p ↔ q', C.mint, 0, 4.2, 2.6, 0.7);
    arrow(V3(-1.5, 4.5, 0.5), V3(1.5, 4.5, 0.5)); arrow(V3(1.5, 3.9, 0.5), V3(-1.5, 3.9, 0.5));
    cap('還有兩個方向都推的', '若且唯若');
  },
  async (tok, S) => { // 1591.5 p if and only if q
    sm('p if and only if q（若且唯若）', 0, 3.3);
    cap('寫成 p if and only if q', '');
  },
  async (tok, S) => { // 1604.1 = p→q 且 q→p
    card('p ↔ q ＝ (p → q) ∧ (q → p)', C.mint, 0, 2.5, 6.0, 0.6);
    cap('意思是：p 推到 q 成立', '而且 q 推到 p 也成立，兩個方向都要成立');
  },
  async (tok, S) => { // 1648.7 還有一個：¬q → ¬p
    S.cp = card('¬q → ¬p（若非 q 則非 p）', C.peach, 0, 1.3, 5.6, 0.6);
    cap('還有一個從 p → q 變化出來的', '若非 q 則非 p：not q implies not p');
  },
  async (tok, S) => { // 1665.0 contrapositive
    hot('contrapositive（逆否）', 0, 0.5); glow(S.cp, HL);
    cap('這叫原來那句的 contrapositive', '逆否命題');
  },
  async (tok, S) => { // 1683.0 用 truth table 來看
    bub('從 truth table 看會怎樣？（下一講）', 0, -0.3);
    cap('從 truth table 的觀點來看會怎麼樣？', '下一講接著算');
  },
]);

// ════════ jBoa60H5XVU（趙啟超 1C：逆否、量詞、集合） ════════
scene('lg-1c-tab', '1C：converse、↔、contrapositive、¬p ∨ q 一次比', CAMW, [
  async (tok, S) => { // 6.0 p → q：只有 1→0 是 0
    S.T = TT(['p', 'q'], [['p→q', (e) => IM(e.p, e.q)], ['q→p', (e) => IM(e.q, e.p)], ['p↔q', (e) => e.p === e.q], ['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['¬q→¬p', (e) => IM(!e.q, !e.p)], ['¬p∨q', (e) => !e.p || e.q]], { bin: true, dx: 1.36, top: 5.6 });
    S.T.now([0, 1, 2]); duo(S, { bin: true, x: 6.6 });
    cap('上次的：一共四種', '若 p 則 q：只有 true 推到 false 才是 false');
  },
  async (tok, S) => { // 8.2 converse：若 q 則 p
    S.T.hot(3);
    cap('第一個是它的 converse', '若 q 則 p');
  },
  async (tok, S) => { // 10.6 q=1、p=0 才 false
    await S.T.col(tok, 3, 0, [1]); S.T.glowAt(1, 3, NG); await S.T.col(tok, 3, 160, [0, 2, 3]);
    cap('q 是 1、p 是 0 的時候才 false', '其他 case 都 true：1 0 1 1');
  },
  async (tok, S) => { // 53.1 converse 不見得成立
    [1, 2].forEach((r) => { S.T.glowAt(r, 2, NG); S.T.glowAt(r, 3, NG); }); await cheer(tok, S, false);
    cap('implication 成立時，converse 不見得成立', '01、10 兩列兩欄不一樣');
  },
  async (tok, S) => { // 68.2 if and only if
    S.T.clear(); S.T.hot(3, false); S.T.hot(4);
    cap('再來是 if and only if', 'p ↔ q');
  },
  async (tok, S) => { // 76.6 兩個都成立 → and
    await S.T.col(tok, 4, 200);
    cap('兩個方向都要成立（and）才會成立', 'p→q、q→p 都是 1 才 1：1 0 0 1');
  },
  async (tok, S) => { // 99.2 00 跟 11
    S.T.glowRow(0, OKG); S.T.glowRow(3, OKG); await cheer(tok, S, true);
    cap('就是 00 跟 11 這兩個 case', 'both true 或 both false 才對');
  },
  async (tok, S) => { // 104.5 ¬p、¬q
    S.T.clear(); S.T.hot(4, false); await S.T.col(tok, 5, 120); await S.T.col(tok, 6, 120);
    cap('非 p：1 1 0 0', '非 q：1 0 1 0');
  },
  async (tok, S) => { // 117.0 contrapositive
    S.T.hot(7);
    cap('再來是 contrapositive', '非 q 則非 p');
  },
  async (tok, S) => { // 127.7 ¬q 是 1、¬p 是 0 才不對
    await S.T.col(tok, 7, 0, [2]); S.T.glowAt(2, 7, NG); await S.T.col(tok, 7, 160, [0, 1, 3]);
    cap('非 q 是 1、非 p 是 0 的時候才不對', '1 推到 0 是 0，其他都 1');
  },
  async (tok, S) => { // 150.1 ¬p ∨ q
    S.T.hot(7, false); S.T.hot(8);
    cap('再看一個：not p or q', '');
  },
  async (tok, S) => { // 163.7 兩個都是 0 才 0
    await S.T.col(tok, 8, 160);
    cap('not p 跟 q 都是 0 的時候才 0', '其他 case 都 1');
  },
  async (tok, S) => { // 177.6 看這一行：1101
    S.T.hot(8, false); S.T.glowCol(2, HL);
    cap('看 truth table：p → q', '四種情況是 1 1 0 1');
  },
  async (tok, S) => { // 191.1 contrapositive 也是 1101
    S.T.glowCol(2, OKG); S.T.glowCol(7, OKG); await cheer(tok, S, true);
    cap('它的 contrapositive 也是 1 1 0 1', '所以兩者 logically equivalent');
  },
  async (tok, S) => { // 199.0 p → q ≡ ¬q → ¬p
    card('p → q ≡ ¬q → ¬p', C.mint, 0, 1.6, 5.0, 0.7);
    cap('若 p 則 q，邏輯等價於', '若非 q 則非 p');
  },
]);
scene('lg-1c-proof', '1C：用 contrapositive 來證明', CAM, [
  async (tok, S) => { // 220.5 要證 p → q
    S.g = card('要證：p → q', C.lilac, -3.2, 5.8, 4.2, 0.7);
    cap('後面很多證明', '要證「這個成立會推到那個成立」');
  },
  async (tok, S) => { // 229.2 證它的 contrapositive
    S.c = card('改證：¬q → ¬p', C.peach, 3.2, 5.8, 4.2, 0.7); arrow(V3(-1.0, 5.8, 0.5), V3(1.0, 5.8, 0.5));
    cap('老師說的「反證」：證它的 contrapositive', '課本叫 proof by contraposition');
  },
  async (tok, S) => { // 232.5 假設結論不成立 → 前提不成立
    S.a = buddy('假設', '¬q', '#e0a37f', 1.6, 0, 3.0, 0.8); S.b = buddy('推出', '¬p', '#e0a37f', 4.8, 0, 3.0, 0.8);
    arrow(V3(2.4, 0.5, 3.0), V3(4.0, 0.5, 3.0));
    cap('假設結論不成立', '去推出前提不成立'); await S.a.hop(tok); await S.b.hop(tok);
  },
  async (tok, S) => { // 255.5 為什麼可以：等價
    card('p → q ≡ ¬q → ¬p', C.mint, 0, 4.4, 5.0, 0.6); good('證出一個，就等於證出另一個', 0, 3.7);
    cap('因為兩者 logically equivalent', '前提成立時結論一定成立；結論不成立，前提當然不成立');
  },
  async (tok, S) => { // 294.4 converse 不一樣
    S.v = card('q → p（converse）', C.gray, -3.6, 2.6, 4.0, 0.6); bad('不一樣！正向成立，反向不見得', -3.6, 1.9);
    cap('跟 converse 是不一樣的', '它成立，converse 不見得成立');
  },
  async (tok, S) => { // 309.0 contrapositive 一樣
    good('contrapositive：一樣', 3.0, 2.6);
    cap('但 contrapositive 是一樣的', '');
  },
  async (tok, S) => { // 321.7 也 ≡ ¬p ∨ q
    card('也 ≡ ¬p ∨ q（同樣 1101）', C.sky, 3.0, 1.8, 4.6, 0.6);
    cap('也跟 not p or q 等價', '同樣是 1 1 0 1');
  },
  async (tok, S) => { // 328.4 比較少用
    sm('這個比較少用來證明', 3.0, 1.1);
    cap('不過這個通常比較少用', '證明多半用 contrapositive');
  },
  async (tok, S) => { // 348.2 最重要
    hot('最重要：implication ≡ 它的 contrapositive', 0, 6.8);
    cap('最重要的是：implication 跟它的 contrapositive', '是 logically equivalent');
  },
]);
scene('lg-1c-quant', '1C：量詞 ∃、∀ 與自然數', CAM, [
  async (tok, S) => { // 355.4 quantifier
    hot('quantifier 量詞', 0, 6.6);
    cap('邏輯裡還有 quantifier', '量詞');
  },
  async (tok, S) => { // 368.0 ∃ there is
    S.e = card('∃：there is（存在）', C.sky, -3.0, 5.6, 4.4, 0.7);
    cap('第一個符號：there is', '存在一個什麼什麼');
  },
  async (tok, S) => { // 383.7 ∀ for all
    S.a = card('∀：for all（對所有）', C.peach, 3.0, 5.6, 4.4, 0.7);
    cap('第二個符號：for all', '對所有的');
  },
  async (tok, S) => { // 398.7 ∃ n ∈ ℕ, n² 奇數
    S.s1 = card('∃ n ∈ ℕ such that n² is odd', C.lilac, 0, 4.5, 6.6, 0.7);
    cap('例：there is an n in ℕ', 'such that n² is odd');
  },
  async (tok, S) => { // 433.2 存在一個 n
    sm('「存在一個 n，使得 n² 是奇數」', 0, 3.8);
    cap('存在一個 n', 'n 屬於自然數的集合');
  },
  async (tok, S) => { // 451.7 ℕ = {1, 2, 3, …}
    S.ns = [1, 2, 3, 4, 5, 6].map((v, i) => num(v, -3.6 + i * 1.3, 2.3, C.blue, 0.8));
    sm('…', 4.4, 2.3); S.nl = hd('ℕ = {1, 2, 3, …}（自然數）', -4.0, 3.1);
    cap('ℕ：自然數，從 1、2、3 開始', '一直下去，無窮多個');
  },
  async (tok, S) => { // 466.8 ℤ、ℤ⁺
    sm('ℤ：整數（正、負、0）；ℤ⁺：正整數', 2.4, 3.1);
    cap('ℤ 是整數：正整數、負整數跟 0', 'ℤ⁺ 是正整數 1、2、3…');
  },
  async (tok, S) => { // 485.4 有些書從 0 開始
    note('有些書 ℕ 從 0 開始；這門課 ℕ 從 1 開始', 0, 1.2);
    cap('有些書的自然數從 0 開始', '這門課的自然數一律從 1 開始');
  },
  async (tok, S) => { // 516.3 3² = 9 是奇數
    relabel(S.ns[2], '3²=9'); tint(S.ns[2], C.green); glow(S.ns[2], OKG); good('找到 n = 3：9 是奇數 → ∃ 這句為真', 0, 0.4);
    cap('比方說 3：3 的平方是 9', '9 是奇數 → 存在這樣的 n');
  },
  async (tok, S) => { // 534.6 ∀ n ∈ ℕ, n² is odd
    S.s2 = card('∀ n ∈ ℕ, n² is odd', C.peach, 0, -0.5, 5.0, 0.7);
    cap('另一句：所有 n 在自然數裡', 'n² 都是奇數');
  },
  async (tok, S) => { // 552.4 不見得對
    bub('這句不見得對（只是一個 statement）', 0, -1.3);
    cap('這個 statement 不見得對', '一個是「存在」，一個是「所有」');
  },
]);
scene('lg-1c-qneg', '1C：量詞的否定與找反例', CAM, [
  async (tok, S) => { // 570.7 可以 and、or；主要講 not
    cap('有量詞的 statement 也可以 and、or、推論', '這邊主要講「否定」');
  },
  async (tok, S) => { // 574.3 ∀x P(x)
    S.a = card('∀x P(x)', C.peach, -3.4, 5.8, 3.0, 0.7); sm('P(x)：跟 x 有關的某個性質', -3.4, 5.1);
    cap('所有的 x，P(x) 這個性質都成立', '');
  },
  async (tok, S) => { // 596.0 否定是什麼？
    S.na = card('¬∀x P(x)', C.gray, 1.4, 5.8, 3.0, 0.7);
    cap('這個 statement 的否定是什麼？', '');
  },
  async (tok, S) => { // 606.8 找一個不成立就好
    S.xs = [1, 2, 3, 4, 5].map((v, i) => num('x' + v, -3.2 + i * 1.6, 3.5, C.green, 0.75));
    tint(S.xs[3], C.red); glow(S.xs[3], NG); await wt(tok, 300);
    cap('要證它不對，只要找一個不成立的', '紅色那顆（示意）');
  },
  async (tok, S) => { // 609.7 ¬∀x P(x) ≡ ∃x ¬P(x)
    S.r1 = card('¬∀x P(x) ≡ ∃x ¬P(x)', C.mint, 0, 2.4, 5.2, 0.7);
    cap('否定就是：存在一個 x，性質不成立', '¬∀x P(x) ≡ ∃x ¬P(x)');
  },
  async (tok, S) => { // 625.0 像 De Morgan
    sm('像 De Morgan：∀ 變 ∃，P 變 ¬P', 0, 1.7);
    cap('有點像 De Morgan\'s law', 'for all 變 there is，再把性質否定');
  },
  async (tok, S) => { // 640.6 disprove：counterexample
    hot('disprove ＝ 找一個 counterexample（反例）', 0, 6.8);
    cap('要 disprove 一件事', '只要找一個 counterexample；有時比證明還容易');
  },
  async (tok, S) => { // 696.0 找一個反例就好
    glow(S.xs[3], HL); await wt(tok, 200); glow(S.xs[3], NG);
    cap('說「所有都成立」的，找一個反例', '這個 statement 就不成立了');
  },
  async (tok, S) => { // 724.0 作業：先判斷對不對
    S.hw = note('作業：先判斷對不對 → 對就證明，錯就找反例', 0, 1.0);
    cap('作業會給一個 statement', '先判斷對錯：對就證，不對就找反例');
  },
  async (tok, S) => { // 755.6 ∃x P(x)
    gone(S.xs, S.a, S.na, S.r1, S.hw);
    S.e = card('∃x P(x)', C.sky, -3.4, 5.8, 3.0, 0.7);
    cap('同理：存在一個 x，P(x) 成立', '它的否定是什麼？');
  },
  async (tok, S) => { // 779.3 否定：∀x ¬P(x)
    S.r2 = card('¬∃x P(x) ≡ ∀x ¬P(x)', C.mint, 1.6, 5.8, 5.2, 0.7);
    S.xs = [1, 2, 3, 4, 5].map((v, i) => num('x' + v, -3.2 + i * 1.6, 4.4, C.red, 0.7));
    cap('否定：所有 x，那個性質都不成立', '就不會存在一個');
  },
  async (tok, S) => { // 795.3 也像 De Morgan
    sm('一樣：全部否定，∃ 變 ∀', 1.6, 5.1);
    cap('這也跟 De Morgan 有點像', '把全部否定，there is 變 for all');
  },
  async (tok, S) => { // 825.6 例：∀ n ∈ ℕ, n² is odd
    gone(S.xs);
    S.c = card('∀ n ∈ ℕ, n² is odd ？', C.peach, -1.6, 3.3, 5.4, 0.7);
    S.ns = [1, 2, 3, 4, 5].map((v, i) => num(v + '²=' + v * v, -3.6 + i * 1.6, 2.2, (v * v) % 2 ? C.green : C.blue, 0.95));
    cap('例：所有自然數 n，n² 都是奇數', '先判斷對不對：很明顯不對');
  },
  async (tok, S) => { // 844.7 反例 n = 2
    tint(S.ns[1], C.red); glow(S.ns[1], NG); S.ns[1].position.y += 0.3;
    bad('反例 n = 2：2² = 4 不是奇數 → disproved', 0, 1.2);
    cap('找一個平方不是奇數的就好', '比方說 2，平方是 4');
  },
  async (tok, S) => { // 856.0 對的證、錯的找反例
    good('對 → 證出來；錯 → 找到反例', 0, 0.4);
    cap('對的東西可以證出來', '不對的東西可以找到反例');
  },
  async (tok, S) => { // 861.7 判斷對錯不容易
    note('先判斷對錯有時比證明還重要：題目若是錯的，一輩子也證不出來', 0, -0.4);
    cap('有時候判斷對不對沒那麼容易', '題目根本不對，就一輩子證不出來');
  },
]);
scene('lg-1c-set', '1C：集合、元素與兩種寫法', CAM, [
  async (tok, S) => { // 932.4 set：unordered collection of objects
    hot('set（集合）：unordered collection of objects', 0, 6.7);
    cap('什麼是集合？', 'unordered collection of objects');
  },
  async (tok, S) => { // 954.5 unordered：沒有順序
    sm('unordered：裡面的東西沒有順序', 0, 6.1);
    cap('collection of objects：把東西放在一起', 'unordered：沒有順序');
  },
  async (tok, S) => { // 961.5 有順序要特別說
    sm('（有順序要特別說：ordered）', 0, 5.6);
    cap('如果有順序，要特別說是 ordered', '沒講的時候集合都沒有順序');
  },
  async (tok, S) => { // 974.3 第一種：全部列出來
    S.z = oval(-0.4, 4.4, 5.0, 0.9);
    S.ns = [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => num(v, -4.6 + i * 0.98, 4.4, C.blue, 0.7));
    S.l = hd('A = {1, 2, 3, 4, 5, 6, 7, 8}', 4.4, 5.05);
    cap('表示集合的第一種方法：全部列出來', '中間用逗號分開，外面用大括號');
  },
  async (tok, S) => { // 1008.3 順序無關
    const order = [1, 2, 3, 4, 5, 6, 7, 0];
    hold(S.ns);
    await anim(tok, 900, (u) => order.forEach((k, i) => { const x0 = -4.6 + k * 0.98, x1 = -4.6 + i * 0.98; S.ns[k].position.x = x0 + (x1 - x0) * u; S.ns[k].position.y = 4.4 + Math.sin(Math.PI * u) * (k === 0 ? 0.55 : -0.15); }));
    S.l2 = sm('{2, 3, 4, 5, 6, 7, 8, 1} 也是同一個 A', 4.6, 3.7);
    cap('寫成 2、3、…、8、1 也一樣', '跟順序無關，只說裡面有這些東西');
  },
  async (tok, S) => { // 1019.3 元素
    S.el = note('裡面的東西叫 element（元素）', -2.0, 2.9);
    cap('裡面的東西叫做元素', 'element');
  },
  async (tok, S) => { // 1028.6 2 ∈ A
    glow(S.ns[1], HL); S.ns[1].position.y += 0.35; S.in = card('2 ∈ A', C.mint, 3.6, 2.6, 2.2, 0.6);
    S.e1 = sm('2 is an element of A', 3.6, 1.95);
    cap('2 是 A 的元素：2 ∈ A', '2 is in A / 2 is an element of A');
  },
  async (tok, S) => { // 1050.7 member
    S.e2 = sm('也可以說 2 is a member of A', 3.6, 1.45);
    cap('也有人叫 member', 'element 用得比較多');
  },
  async (tok, S) => { // 1082.2 第二種：寫共同性質
    gone(S.ns, S.l, S.in, S.z, S.l2, S.el, S.e1, S.e2);
    cap('元素太多、根本寫不完時', '第二種方法：把共同的性質寫出來');
  },
  async (tok, S) => { // 1105.3 B = {n ∈ ℕ : n 是 11 的倍數}
    S.b = card('B = { n ∈ ℕ : n is a multiple of 11 }', C.lilac, 0, 5.0, 7.6, 0.7);
    sm('n：代表元素（typical element）', -2.4, 4.3);
    cap('B 的代表元素叫 n', 'n 是自然數，而且是 11 的倍數');
  },
  async (tok, S) => { // 1117.6 冒號
    sm('冒號「:」；也有人用直線「|」', 2.6, 4.3);
    cap('老師習慣用冒號', '有人用一條直線，只是習慣不同');
  },
  async (tok, S) => { // 1158.5 11, 22, 33, …
    S.bs = [11, 22, 33, 44, 55, 66, 77, 88].map((v, i) => num(v, -4.6 + i * 1.1, 3.0, C.purple, 0.8));
    sm('…', 4.6, 3.0);
    cap('一個一個列：11、22、33、44…', '寫成共同性質比較好寫');
  },
  async (tok, S) => { // 1190.0 empty set
    card('∅：empty set（空集合）', C.gray, 0, 1.4, 5.0, 0.7); sm('一個元素都沒有', 0, 0.7);
    cap('一個元素都沒有的集合', '叫 empty set，空集合，符號 ∅');
  },
]);
scene('lg-1c-venn', '1C：交集、聯集與 Venn diagram', CAM, [
  async (tok, S) => { // 1232.5 set operations
    hot('set operations 集合運算', 0, 6.7);
    cap('集合之間有一些運算', 'set operations');
  },
  async (tok, S) => { // 1245.7 intersection、union
    card('∩ intersection 交集', C.sky, -3.2, 6.0, 4.2, 0.6); card('∪ union 聯集', C.peach, 3.2, 6.0, 4.2, 0.6);
    cap('交集 intersection、聯集 union', '以前都學過');
  },
  async (tok, S) => { // 1270.5 A ∩ B 定義
    card('A ∩ B = { x : x ∈ A ∧ x ∈ B }', C.sky, -3.2, 5.2, 5.8, 0.6);
    cap('又在 A 裡面、又在 B 裡面的元素', '就是 A 和 B 的 intersection');
  },
  async (tok, S) => { // 1292.0 and
    sm('∧：兩個 statement 都要成立', -3.2, 4.55);
    cap('這裡是 and', '兩個都要成立才行');
  },
  async (tok, S) => { // 1302.0 A ∪ B 定義
    card('A ∪ B = { x : x ∈ A ∨ x ∈ B }', C.peach, 3.2, 5.2, 5.8, 0.6); sm('∨：有一個成立就成立', 3.2, 4.55);
    cap('聯集：在 A 裡面或在 B 裡面', '這是 or');
  },
  async (tok, S) => { // 1319.1 兩個圓
    S.V = venn(0, 1.6, 1.7, 0.95); S.V.draw();
    cap('兩個集合畫成兩個圓', '左邊 A、右邊 B');
  },
  async (tok, S) => { // 1323.3 交集是重疊、聯集是全部
    S.V.fill('AB', C.blue, 0.6); sm('A ∩ B', 0, 1.6, 0.3); await wt(tok, 900);
    S.V.fill('A', C.orange, 0.18); S.V.fill('B', C.orange, 0.18);
    cap('交集是中間重疊的部分', '聯集是兩個圓全部');
  },
  async (tok, S) => { // 1333.1 Venn diagram
    hd('Venn diagram（文氏圖）', 4.8, 3.6);
    cap('這種圖叫 Venn diagram', '文氏圖');
  },
  async (tok, S) => { // 1358.0 John Venn
    sm('John Venn（1834–1923）英國邏輯學家，《Symbolic Logic》', 0, -0.6);
    cap('John Venn，英國邏輯學家', '在他的書 Symbolic Logic 裡用這種圖');
  },
  async (tok, S) => { // 1374.2 不能當證明
    bad('幫助理解，不能拿來當證明', 4.8, 2.6);
    cap('Venn diagram 幫你看懂交集、聯集', '但只是幫助瞭解，不能拿來當證明');
  },
]);
scene('lg-1c-comp', '1C：補集 complement 與 universe', CAM, [
  async (tok, S) => { // 1385.2 邏輯有 NOT，集合有 complement
    card('邏輯：¬（NOT）', C.gray, -3.2, 6.2, 3.6, 0.6); card('集合：complement 補集', C.peach, 3.2, 6.2, 4.4, 0.6);
    cap('跟邏輯類似：邏輯有 NOT', '集合這邊有 complement');
  },
  async (tok, S) => { // 1398.5 Ā / Aᶜ
    sm('寫法：Ā（A 上面一條 bar），也有人寫 Aᶜ', 0, 5.5);
    cap('很多種寫法：A bar', '有些書在右上角寫一個 c');
  },
  async (tok, S) => { // 1412.6 不在 A 裡的元素
    card('Ā = { x : x ∉ A }', C.peach, 0, 4.8, 4.4, 0.6);
    cap('complement：不在 A 裡面的那些元素', '');
  },
  async (tok, S) => { // 1435.3 必須先知道全部範圍
    S.q = bub('「不在 A 裡」…那全部是指什麼？', 0, 4.0);
    cap('講 complement 之前', '必須先知道你整個考慮的範圍是什麼');
  },
  async (tok, S) => { // 1448.0 universe
    const w = 9.6, h = 3.4, cx = 0, cy = 1.5;
    const s = new THREE.Shape(); s.moveTo(cx - w / 2, cy - h / 2); s.lineTo(cx + w / 2, cy - h / 2); s.lineTo(cx + w / 2, cy + h / 2); s.lineTo(cx - w / 2, cy + h / 2); s.lineTo(cx - w / 2, cy - h / 2);
    const hole = new THREE.Path(); hole.absarc(-1.6, cy, 1.45, 0, Math.PI * 2, true); s.holes.push(hole);
    S.out = new THREE.Mesh(new THREE.ShapeGeometry(s, 48), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    lab.world.add(S.out); ringL(-1.6, cy, 1.45);
    hd('U（universe）', cx + w / 2 + 1.1, cy + h / 2 - 0.3); hd('A', -3.55, cy - 0.6); sm('Ā：外面這一圈', 2.6, cy - 1.15, 0.2);
    cap('整個考慮的大範圍叫 universe', 'A 的 complement 就是 A 外面的部分');
  },
  async (tok, S) => { // 1474.0 U = {1..10}
    S.pos = {}; let k = 0;
    for (let v = 1; v <= 10; v++) { const inA = v >= 2 && v <= 6; const x = inA ? null : 0.4 + (k % 3) * 1.25, y = inA ? null : 2.4 - Math.floor(k / 3) * 0.95; if (!inA) k++; S.pos[v] = [x, y]; }
    gone(S.q); S.ns = []; for (let v = 1; v <= 10; v++) S.ns.push(num(v, -4.4 + (v - 1) * 0.98, 3.8, C.blue, 0.62));
    sm('U = {1, 2, …, 10}', -3.2, 4.5);
    cap('例：universe 是 1 到 10', '這 10 個正整數');
  },
  async (tok, S) => { // 1491.0 A = {2..6}
    const inA = [2, 3, 4, 5, 6];
    hold(inA.map((v) => S.ns[v - 1]));
    await anim(tok, 1000, (u) => inA.forEach((v, i) => { const m = S.ns[v - 1]; const x0 = -4.4 + (v - 1) * 0.98, y0 = 3.8; const x1 = -2.6 + i * 0.5, y1 = i % 2 ? 1.1 : 1.9; m.position.x = x0 + (x1 - x0) * u; m.position.y = y0 + (y1 - y0) * u; }));
    sm('A = {2, 3, 4, 5, 6}', -1.6, 0.0);
    cap('假設 A 是 2、3、4、5、6', '');
  },
  async (tok, S) => { // 1502.6 Ā = {1, 7, 8, 9, 10}
    const out = [1, 7, 8, 9, 10];
    hold(out.map((v) => S.ns[v - 1]));
    // bottom row (9, 10) moves first, then the top row (1, 7, 8): their paths never cross
    await anim(tok, 1400, (u0) => out.forEach((v, i) => { const u = Math.min(1, Math.max(0, i >= 3 ? u0 * 2 : u0 * 2 - 1)); const m = S.ns[v - 1]; const x0 = -4.4 + (v - 1) * 0.98, y0 = 3.8; const x1 = 1.4 + (i % 3) * 1.1, y1 = 2.2 - Math.floor(i / 3) * 0.9; m.position.x = x0 + (x1 - x0) * u; m.position.y = y0 + (y1 - y0) * u; }));
    out.forEach((v) => { tint(S.ns[v - 1], C.orange); glow(S.ns[v - 1], HL); });
    card('Ā = {1, 7, 8, 9, 10}', C.peach, 3.0, -0.4, 4.4, 0.6);
    cap('不在 A 裡的：1、7、8、9、10', '就是 A 的 complement');
  },
  async (tok, S) => { // 1524.1 要知道 universe
    note('universe 換了，complement 就跟著換', -3.2, -0.4);
    cap('必須先知道 universe 是什麼', '才能說 complement 是什麼');
  },
]);
scene('lg-1c-diff', '1C：差集 A − B 與例題', CAM, [
  async (tok, S) => { // 1536.0 difference
    hot('difference 差集', 0, 6.7);
    cap('最後介紹一個：difference', '可能平常比較少看到');
  },
  async (tok, S) => { // 1554.0 A − B
    card('A − B（也寫 A \\ B）', C.lilac, -3.2, 6.0, 4.4, 0.6);
    cap('A 扣掉 B', '有人寫減號，也有人寫斜線');
  },
  async (tok, S) => { // 1568.1 在 A 裡、不在 B 裡
    card('A − B = { x : x ∈ A ∧ x ∉ B }', C.lilac, 3.0, 6.0, 5.8, 0.6);
    cap('在 A 裡面、不在 B 裡面', '');
  },
  async (tok, S) => { // 1580.0 = A ∩ B̄
    card('A − B = A ∩ B̄', C.mint, 3.0, 5.2, 4.0, 0.6);
    cap('不在 B 裡 = 在 B 的 complement 裡', '所以 A − B 就是 A 交 B bar（因為是 and）');
  },
  async (tok, S) => { // 1599.0 跟誰寫前面有關
    sm('誰寫前面有關係！', -3.2, 5.3);
    cap('difference 跟哪個寫在前面有關', '');
  },
  async (tok, S) => { // 1608.2 relative complement
    sm('又叫 relative complement of B in A', -3.2, 4.75);
    cap('有人叫 relative complement', 'relative complement of B in A');
  },
  async (tok, S) => { // 1636.6 Venn
    S.V = venn(0, 1.9, 1.6, 0.9); S.V.draw(); S.f1 = S.V.fill('AmB', C.purple, 0.5); S.t1 = hd('A − B', -2.6, 4.0);
    cap('用 Venn diagram 看', '在 A 裡面、不在 B 裡面：左邊這一塊');
  },
  async (tok, S) => { // 1667.0 不對稱
    S.V.fill('BmA', C.teal, 0.5); hd('B − A', 2.6, 4.0); bad('A − B ≠ B − A（不對稱）', 0, 4.6);
    cap('A − B 跟 B − A 不一樣', '不對稱');
  },
  async (tok, S) => { // 1672.4 例 A={1,2,3,4}, B={3,4,5,6}
    S.V.unfill();
    const at = { 1: ['AmB', 0, 2], 2: ['AmB', 1, 2], 3: ['AB', 0, 2], 4: ['AB', 1, 2], 5: ['BmA', 0, 2], 6: ['BmA', 1, 2] };
    S.ns = {}; for (let v = 1; v <= 6; v++) { const [k, i, n] = at[v]; const [x, y] = S.V.at(k, i, n); S.ns[v] = num(v, x, y, C.blue, 0.6); await wt(tok, 120); }
    card('A = {1, 2, 3, 4}', C.sky, -4.6, 0.0, 3.4, 0.55); card('B = {3, 4, 5, 6}', C.sky, 4.6, 0.0, 3.4, 0.55);
    cap('例：A = {1, 2, 3, 4}', 'B = {3, 4, 5, 6}');
  },
  async (tok, S) => { // 1687.3 A ∪ B
    for (let v = 1; v <= 6; v++) glow(S.ns[v], HL);
    card('A ∪ B = {1, 2, 3, 4, 5, 6}', C.peach, 0, -0.8, 5.0, 0.55);
    cap('A 聯集 B：在 A 裡或在 B 裡', '全部寫出來：1 到 6');
  },
  async (tok, S) => { // 1708.0 A ∩ B
    for (let v = 1; v <= 6; v++) glow(S.ns[v], v === 3 || v === 4 ? HL : null);
    card('A ∩ B = {3, 4}', C.sky, -4.6, -1.6, 3.4, 0.55);
    cap('A 交集 B：在 A 裡又在 B 裡', '1、2 只在 A，5、6 只在 B → 3 跟 4');
  },
  async (tok, S) => { // 1729.2 A − B
    for (let v = 1; v <= 6; v++) glow(S.ns[v], v <= 2 ? HL : null);
    card('A − B = {1, 2}', C.lilac, 0, -1.6, 3.4, 0.55);
    cap('A 扣掉 B：在 A 裡不在 B 裡', '1 跟 2');
  },
  async (tok, S) => { // 1743.6 B − A
    for (let v = 1; v <= 6; v++) glow(S.ns[v], v >= 5 ? HL : null);
    card('B − A = {5, 6}', C.mint, 4.6, -1.6, 3.4, 0.55);
    cap('B 扣掉 A：5 跟 6', '看懂這個例子，前面的定義就 OK 了');
  },
]);

// ════════ klWl-t7V5qY（易志偉 Lec01：命題與五個運算子） ════════
scene('lg-01-why', 'Lec01：為什麼先學邏輯', CAM, [
  async (tok, S) => { // 67.4 第一個要學的是邏輯
    hot('第一個主題：Logic 邏輯', 0, 6.4);
    cap('第一個要學的是邏輯', '為什麼邏輯屬於離散數學？');
  },
  async (tok, S) => { // 75.1 分辨是非 → 真或假
    duo(S, { x: 3.2, tn: '是 → 真', fn: '非 → 假' });
    cap('邏輯最基本：教你分辨是非黑白', '在數理裡就是真或假');
  },
  async (tok, S) => { // 83.8 電腦用 0、1
    S.tb.set('1'); S.fb.set('0'); await cheer(tok, S, true);
    cap('電腦用 0 跟 1 來表示', '不是 0 就是 1，最基本的兩個數字');
  },
  async (tok, S) => { // 99.3 電腦的基本元件就是 0、1
    S.cpu = prop('cpu', 0, 3.4, 0, 1.4, '0 / 1');
    cap('以後會發現：電腦的基本元件就是 0 跟 1', '所以邏輯擺在最前面');
  },
  async (tok, S) => { // 105.0 教你如何讀書
    S.b = icon('📖', '每句話都要有清楚的定義', -4.4, 4.6);
    cap('這門課也教你怎麼讀書', '書裡任何句子，都要有清楚的定義');
  },
  async (tok, S) => { // 134.7 不要模稜兩可
    bad('不要用模稜兩可的說法', 4.0, 4.6);
    cap('邏輯告訴你句子怎麼寫、代表什麼意思', '不要造成模稜兩可');
  },
]);
scene('lg-01-prop', 'Lec01：命題 proposition 與真值', CAM, [
  async (tok, S) => { // 142.0 講一件事情，判斷對錯
    bub('講一件事情 → 它是對還是錯？', 0, 6.0);
    cap('既然教是非對錯', '一定要先講一件事情，再說它對或錯');
  },
  async (tok, S) => { // 157.6 Proposition 命題
    hot('Proposition 命題', 0, 6.8);
    cap('第一個最基本的元件', 'Proposition，命題');
  },
  async (tok, S) => { // 177.7 命題是一個陳述
    S.c = card('命題 ＝ 一個陳述（敘述句）', C.lilac, 0, 5.0, 5.6, 0.7);
    cap('命題基本上是一個陳述', '');
  },
  async (tok, S) => { // 187.3 可判斷 → True
    duo(S, { x: 4.6 }); good('可以判斷：對 → True', -3.2, 3.8); await cheer(tok, S, true);
    cap('很重要的特徵：可以判斷它是對或錯', '對的叫 True');
  },
  async (tok, S) => { // 199.5 假的 → False
    bad('錯 → False（假的陳述也是命題）', 3.2, 3.8); await cheer(tok, S, false);
    cap('講的東西是假的', '就說這是一個假的陳述：False');
  },
  async (tok, S) => { // 210.7 必須清楚
    note('必須清楚：不能模稜兩可、沒有答案、好像對又好像錯', 0, 2.8);
    cap('陳述必須很清楚', '模稜兩可、沒有答案的，都不是命題');
  },
  async (tok, S) => { // 235.5 truth value
    card('truth value 真值：命題是真還是假', C.sky, 0, 1.6, 6.2, 0.6);
    cap('再定義一個名詞：truth value（真值）', '命題是對或錯，就是它的真值');
  },
  async (tok, S) => { // 294.0 T / F
    S.tb.set('T'); S.fb.set('F'); sm('T 表示 true，F（大寫）表示 false', 0, 0.9); await cheer(tok, S, true);
    cap('簡單的符號：T 表示 true', '大寫 F 表示 false');
  },
]);
scene('lg-01-ex', 'Lec01：哪些是命題？（標準題）', CAM, [
  async (tok, S) => { // 302.2 標準題目
    hot('哪些是命題？是的話真值為何？', 0, 6.7);
    S.L = ['a. 臺北是臺灣的首都', 'b. 2 + 3 = 5', 'c. 5 + 7 = 10', 'd. x + 2 = 11', 'e. Good morning!', 'f. Where are you going?', 'g. 給我錢'].map((t, i) => card(t, C.sand, -2.6, 5.9 - i * 0.8, 4.8, 0.56));
    cap('常看到的標準題目', '先判斷是不是命題，是的話真值是什麼');
  },
  async (tok, S) => { // 348.3 a
    glow(S.L[0], HL); good('命題，T（老師的答案）', 2.6, 5.9);
    cap('臺北是臺灣的首都', '可以判斷對錯、有答案 → 是命題');
  },
  async (tok, S) => { // 365.3 b
    glow(S.L[0], null); glow(S.L[1], HL); good('命題，T', 2.6, 5.1);
    cap('2 + 3 = 5', '兩根手指加三根手指是五根 → 命題，真');
  },
  async (tok, S) => { // 382.0 c
    glow(S.L[1], null); glow(S.L[2], HL); good('命題，F', 2.6, 4.3);
    cap('5 + 7 = 10', '算一算不對 → 是命題，但答案是假的');
  },
  async (tok, S) => { // 398.0 d
    glow(S.L[2], null); glow(S.L[3], HL); bad('不是命題', 2.6, 3.5);
    cap('x + 2 = 11', '這不是要你解方程式，是看它對或錯');
  },
  async (tok, S) => { // 413.1 x=9 對、x=8 錯
    sm('d：x = 9 → 對；x = 8 → 錯 → 沒有固定答案', 0, 0.3);
    cap('x 如果是 9 就對，是 8 就錯', '不能判斷對錯 → 不是命題');
  },
  async (tok, S) => { // 441.3 e
    glow(S.L[3], null); glow(S.L[4], HL); bad('不是命題', 2.6, 2.7);
    cap('Good morning', '問候沒有對錯 → 不是命題');
  },
  async (tok, S) => { // 451.2 f
    glow(S.L[4], null); glow(S.L[5], HL); bad('不是命題（問句）', 2.6, 1.9);
    cap('Where are you going?', '你要去哪裡：沒有對錯的含義');
  },
  async (tok, S) => { // 462.0 g
    glow(S.L[5], null); glow(S.L[6], HL); bad('不是命題（命令句）', 2.6, 1.1);
    cap('給我錢', '本身沒有對錯的概念 → 不是命題');
  },
]);
scene('lg-01-var', 'Lec01：命題變數與 propositional calculus', CAM, [
  async (tok, S) => { // 477.0 把命題當代數運算
    hot('把命題當成代數來運算', 0, 6.6);
    cap('我們要把命題當作數學的代數運算', '');
  },
  async (tok, S) => { // 490.6 變數
    sm('代數運算有「變數」', 0, 6.0);
    cap('代數運算會有變數', '');
  },
  async (tok, S) => { // 497.0 每次都寫那麼長？
    S.long = card('臺北是臺灣的首都而且新竹在臺灣的最北邊…', C.sand, 0, 4.8, 8.6, 0.6);
    cap('剛才寫了那麼多式子', '難道每次都要寫那麼長的東西嗎？');
  },
  async (tok, S) => { // 505.0 用符號代表
    S.pp = cube('p', C.purple, [0.9, 0.9, 0.9], 0, 3.4, 0, 2); arrow(V3(0, 4.4, 0.5), V3(0, 3.95, 0.5));
    cap('當然不是：用一個符號代表命題', '');
  },
  async (tok, S) => { // 508.7 p, q, r, s
    ['q', 'r', 's'].forEach((v, i) => cube(v, C.blue, [0.9, 0.9, 0.9], 1.4 + i * 1.4, 3.4, 0, 2));
    good('命題變數：小寫 p、q、r、s', 2.8, 2.5);
    cap('習慣用小寫的 p、q、r、s', '迫不得已才用 x、y、z');
  },
  async (tok, S) => { // 523.1 不要用大寫
    bad('不要用大寫 P、Q：大寫另有用途', -3.6, 2.5);
    cap('千萬不要用大寫', '大寫在這邊有別的用途（後面的謂詞）');
  },
  async (tok, S) => { // 553.4 Propositional Calculus
    card('Propositional Calculus 命題計算（命題邏輯）', C.mint, 0, 1.2, 7.6, 0.7);
    cap('這門學問叫做命題計算', '有時也叫命題邏輯');
  },
]);
scene('lg-01-comp', 'Lec01：複合命題與邏輯運算子', CAM, [
  async (tok, S) => { // 575.0 命題怎麼加減乘除
    cap('既然是代數運算', '命題怎麼拿來做「加減乘除」？');
  },
  async (tok, S) => { // 588.3 compound
    hot('Compound proposition 複合命題', 0, 6.7);
    cap('第一個產生的東西：複合命題', 'compound');
  },
  async (tok, S) => { // 597.0 像複合函數
    sm('像高中的「複合函數」：兩個合成一個', 0, 6.1);
    cap('高中學過複合函數', '從兩個命題組成一個比較複雜的命題');
  },
  async (tok, S) => { // 617.0 兩個陳述
    S.a = card('A：臺北是臺灣的首都', C.sky, -3.2, 5.0, 5.0, 0.6); S.b = card('B：新竹在臺灣的最北邊', C.sky, 3.2, 5.0, 5.0, 0.6);
    cap('比如：臺北是臺灣的首都', '新竹在臺灣的最北邊：這是兩個陳述');
  },
  async (tok, S) => { // 626.0 一對一錯
    good('T', -0.2, 5.0); bad('F', 6.2, 5.0);
    cap('第一個可能是對的', '第二個是錯的');
  },
  async (tok, S) => { // 635.0 而且
    S.j = card('臺北是臺灣的首都「而且」新竹在臺灣的最北邊', C.peach, 0, 3.6, 9.0, 0.6);
    cap('中間加一個「而且」', '構成比較複雜的句子，也可以判斷對錯');
  },
  async (tok, S) => { // 690.2 logical operator
    hd('「而且」＝ 邏輯運算子 logical operator', 0, 2.8);
    cap('這個「而且」串連了兩個命題', '叫做邏輯運算子');
  },
  async (tok, S) => { // 699.7 或者
    card('臺北是臺灣的首都「或者」新竹在臺灣的最北邊', C.lilac, 0, 1.9, 9.0, 0.6); sm('「或者」也是運算子', 0, 1.2);
    cap('也可以用「或者」', '這又是另外一個運算子');
  },
  async (tok, S) => { // 725.0 知道 A、B 對錯 → 判斷複合命題
    bub('知道 A、B 的對錯 → 複合命題是 ? ', 0, 0.3);
    cap('知道原始命題的對錯', '用「且」或「或」，答案可能不一樣：要會判斷');
  },
]);
scene('lg-01-neg', 'Lec01：Negation ¬p 與第一張真值表', CAM, [
  async (tok, S) => { // 751.0 negation operator
    hot('Negation operator（否定）', -3.0, 6.7);
    cap('直接給定義', '第一個最簡單：negation operator');
  },
  async (tok, S) => { // 767.3 ¬p 或 p̄
    S.s = card('¬p（也寫成 p̄）', C.orange, -3.0, 5.9, 3.6, 0.6);
    cap('符號：¬p', '或在 p 上面加一條 bar');
  },
  async (tok, S) => { // 777.2 像負號
    sm('有點像數學的負號「−」', -3.0, 5.25);
    cap('有點像負號', '可以從以前的加減乘除延伸過來');
  },
  async (tok, S) => { // 793.1 先定義 p
    sm('嚴謹：先說 p 是一個命題變數', -3.0, 4.75);
    cap('寫數學要嚴謹', '先說清楚：p 是一個命題變數');
  },
  async (tok, S) => { // 827.5 the negation of p
    card('¬p：the negation of p', C.sky, 3.2, 5.9, 4.6, 0.6);
    cap('¬p 叫做 the negation of p', '這是一個新的陳述');
  },
  async (tok, S) => { // 858.0 It is not the case that p
    card('"It is not the case that p."', C.sky, 3.2, 5.1, 5.4, 0.6);
    cap('它的意思：It is not the case that p', '簡單講：p 是錯的');
  },
  async (tok, S) => { // 877.9 例：新竹在臺灣最北邊
    S.e1 = card('p：新竹在臺灣的最北邊', C.sand, -2.0, 3.6, 5.2, 0.6); S.e1v = bad('F', 1.0, 3.6);
    duo(S, { x: 6.2 }); await cheer(tok, S, false);
    cap('例：新竹在臺灣的最北邊', '就我們所知，這是錯的');
  },
  async (tok, S) => { // 900.3 ¬p 對
    S.e2 = card('¬p：「新竹在最北邊」這件事是錯的', C.peach, -1.0, 2.8, 6.6, 0.6); S.e2v = good('T', 2.7, 2.8); await cheer(tok, S, true);
    cap('NOT p 說「這件事情是錯的」', '它就講對了');
  },
  async (tok, S) => { // 922.0 相反
    const a = S.tb.g.position.clone(), b = S.fb.g.position.clone();
    await Promise.all([travel(tok, S.tb.g, a, b, 900), travel(tok, S.fb.g, b, a, 900)]);
    cap('p 錯 → ¬p 對；p 對 → ¬p 錯', '兩者的答案剛好相反');
  },
  async (tok, S) => { // 987.2 p：Today is Friday
    gone(S.e1, S.e1v, S.e2, S.e2v);
    S.f1 = card('p：Today is Friday.', C.sand, -2.6, 3.6, 4.6, 0.6);
    cap('再舉例：p 代表 Today is Friday', '');
  },
  async (tok, S) => { // 1005.4 It is not the case that today is Friday
    S.f2 = card('¬p：It is not the case that today is Friday.', C.peach, 0, 2.8, 8.4, 0.6);
    cap('先照定義套進來', 'It is not the case that today is Friday');
  },
  async (tok, S) => { // 1019.3 Today is not Friday
    S.f3 = card('¬p：Today is not Friday.', C.peach, -1.6, 2.0, 5.2, 0.6);
    cap('很饒舌，更直接的說法', 'Today is not Friday');
  },
  async (tok, S) => { // 1043.0 今天星期五
    S.d = icon('📅', '今天星期五', 4.6, 3.6); S.v1 = good('p：T', 2.3, 3.6); S.v2 = bad('¬p：F', 1.6, 2.0); await cheer(tok, S, true);
    cap('今天確實是星期五：p 是真的', '¬p「今天不是星期五」就是錯的');
  },
  async (tok, S) => { // 1059.2 假設今天星期二
    rename(S.d, '假設今天星期二'); txt(S.v1, 'p：F'); S.v1.element.className = 'lab-label bad'; txt(S.v2, '¬p：T'); S.v2.element.className = 'lab-label good'; await cheer(tok, S, false);
    cap('假設今天是星期二', 'p 變成錯的，¬p 反而對了');
  },
  async (tok, S) => { // 1092.0 用真值表
    gone(S.f1, S.f2, S.f3, S.d, S.v1, S.v2);
    cap('每次寫句子再看意思，很麻煩', '只看對錯 → 用真值表（很重要）');
  },
  async (tok, S) => { // 1118.0 窮舉
    S.T = TT(['p'], [['¬p', (e) => !e.p]], { dx: 2.2, cx: -1.6, top: 3.8 });
    note('窮舉：把所有可能列出來', 3.6, 3.8);
    cap('把 negation 的所有可能列下來', '這種窮舉的格式叫真值表');
  },
  async (tok, S) => { // 1146.0 只有 p 一個變數
    await S.T.col(tok, 0, 250); sm('只有 p 一個變數 → 2 列', 3.6, 3.1);
    cap('最原始的變數只有 p', 'p 只有真、假兩種可能');
  },
  async (tok, S) => { // 1166.1 p 真 → ¬p 假
    S.T.hot(1); await S.T.col(tok, 1, 300); await cheer(tok, S, false);
    cap('p 真，¬p 一定假', 'p 不成立，¬p 反而對');
  },
  async (tok, S) => { // 1195.0 數位邏輯：簡化電路
    S.chip = prop('cpu', 3.6, 0.6, 0, 1.1); sm('數位邏輯：100 個元件 → 簡化成 50、30 個（示意）', 0, -0.4);
    cap('以後學數位邏輯：簡化電路', '用真值表把 100 個元件省成 50 或 30 個');
  },
  async (tok, S) => { // 1237.5 像函式
    bub('真值表像函式：輸入 p → 輸出 ¬p', -1.6, 1.4);
    cap('真值表其實就像一個函式', '把輸入跟輸出的關係全部列出來');
  },
]);
scene('lg-01-and', 'Lec01：Conjunction p ∧ q（老師 41 歲的例子）', CAM, [
  async (tok, S) => { // 1253.6 conjunction operator
    hot('Conjunction operator', 3.2, 6.7);
    cap('第二個運算子', 'conjunction operator');
  },
  async (tok, S) => { // 1272.4 ∧ = and = 且
    card('∧ ＝ and ＝ 且', C.peach, 3.2, 6.0, 3.6, 0.6);
    cap('符號是 ∧', '就是 and，中文是「且」');
  },
  async (tok, S) => { // 1289.5 p、q 命題變數
    sm('p、q 是兩個命題變數', 3.2, 5.35);
    cap('一樣先定義', 'p 跟 q 是兩個命題變數');
  },
  async (tok, S) => { // 1307.6 p ∧ q
    card('p ∧ q：the conjunction of p and q', C.sky, 3.2, 4.7, 5.8, 0.6);
    cap('寫成 p ∧ q', 'the conjunction of p and q：p 且 q');
  },
  async (tok, S) => { // 1350.2 真值表
    S.T = TT(['p', 'q'], [['p ∧ q', (e) => e.p && e.q]], { dx: 1.6, cx: -3.6, top: 5.4 });
    cap('畫它的真值表', '');
  },
  async (tok, S) => { // 1365.5 2 × 2 = 4
    sm('p：T/F × q：T/F → 4 種', -3.6, 6.7);
    cap('兩個變數，各有真、假兩種', '總共 2 × 2 = 4 種變化');
  },
  async (tok, S) => { // 1398.6 列出 TT TF FT FF
    await S.T.col(tok, 0, 90); await S.T.col(tok, 1, 90);
    cap('把可能的輸入全部列出來', 'TT、TF、FT、FF');
  },
  async (tok, S) => { // 1408.4 例：41 歲、30 歲
    card('p：老師今年 41 歲', C.sand, 3.2, 3.6, 4.0, 0.56); card('q：助教今年 30 歲', C.sand, 3.2, 2.9, 4.0, 0.56);
    duo(S, { x: 6.4 });
    cap('例：p 是「我今年 41 歲」', 'q 是「助教今年 30 歲」');
  },
  async (tok, S) => { // 1432.0 都對 → T
    S.T.hot(2); await S.T.col(tok, 2, 0, [0]); S.T.glowRow(0, OKG); await cheer(tok, S, true);
    cap('兩個都對：41 歲、30 歲', '用「而且」串起來的句子就是真的');
  },
  async (tok, S) => { // 1441.4 一真一假 → F
    await S.T.col(tok, 2, 0, [1]); S.T.glowRow(0, null); S.T.glowRow(1, NG); await cheer(tok, S, false);
    cap('老師 41 歲，但助教其實 24 歲', '一真一假：直覺上就是錯的');
  },
  async (tok, S) => { // 1466.6 F T → F
    await S.T.col(tok, 2, 0, [2]); S.T.glowRow(1, null); S.T.glowRow(2, NG); await cheer(tok, S, false);
    cap('老師 18 歲、助教 30 歲', '我錯他對：答案還是錯的');
  },
  async (tok, S) => { // 1478.6 F F → F
    await S.T.col(tok, 2, 0, [3]); S.T.glowRow(2, null); S.T.glowRow(3, NG); await cheer(tok, S, false);
    cap('老師 18 歲、助教 20 歲', '兩個都錯：錯到底');
  },
  async (tok, S) => { // 1491.0 true when both true
    S.T.clear(); S.T.glowAt(0, 2, OKG);
    note('p ∧ q is true when both p and q are true, and false otherwise.', 0, 0.9);
    cap('只有兩個都為真時，答案才是真', '其他都是假');
  },
]);
scene('lg-01-or', 'Lec01：Disjunction p ∨ q 與三個命題串接', CAM, [
  async (tok, S) => { // 1553.8 有而且就有或
    cap('既然有「而且」', '就會有一個「或」');
  },
  async (tok, S) => { // 1558.6 disjunction
    hot('Disjunction operator', 3.2, 6.7);
    cap('「或」叫做 disjunction operator', '');
  },
  async (tok, S) => { // 1569.4 ∨
    card('∨ ＝ or ＝ 或', C.sky, 3.2, 6.0, 3.6, 0.6);
    cap('符號是 ∨', '文字敘述也可以直接寫 or');
  },
  async (tok, S) => { // 1580.2 記法
    sm('記法：∧ 像 A（And）；∨ 是它倒過來', 3.2, 5.35);
    cap('符號怎麼記？', '∧ 像 and 的 A，開口朝下；∨ 跟它顛倒');
  },
  async (tok, S) => { // 1637.2 只有兩個都錯才錯
    card('p ∨ q：只有 p、q 都錯才錯', C.sky, 3.2, 4.7, 5.4, 0.6);
    cap('p ∨ q 比較特殊', '只有 p 跟 q 都是錯的，才是錯的');
  },
  async (tok, S) => { // 1685.0 真值表
    S.T = TT(['p', 'q'], [['p ∨ q', (e) => e.p || e.q]], { dx: 1.6, cx: -3.6, top: 5.4 }); S.T.now([0, 1]);
    duo(S, { x: 6.4 });
    cap('一樣畫真值表', '兩個變數，4 種可能');
  },
  async (tok, S) => { // 1712.0 任何一個真 → 真
    S.T.hot(2); await S.T.col(tok, 2, 220, [0, 1, 2]); await cheer(tok, S, true);
    cap('只要任何一個為真', '答案就是真的');
  },
  async (tok, S) => { // 1720.7 兩個都假 → 假
    await S.T.col(tok, 2, 0, [3]); S.T.glowAt(3, 2, NG); await cheer(tok, S, false);
    cap('兩個都是假的', '這個陳述才變成非事實');
  },
  async (tok, S) => { // 1722.7 例：p、q、r
    S.vs = [['p：今天是星期五', 'T'], ['q：外面正在下雨', 'F'], ['r：教室裡有一隻狗', 'F']].map(([t, v], i) => { const c = card(t, C.sand, 2.6, 3.7 - i * 0.7, 4.2, 0.56); (v === 'T' ? good : bad)(v, 5.2, 3.7 - i * 0.7); return c; });
    cap('定義三個命題（老師上課那天）', '星期五：對；下雨：沒有；狗：沒有');
  },
  async (tok, S) => { // 1750.4 p ∧ q → F
    S.r1 = card('p ∧ q：星期五而且在下雨 → T ∧ F = F', C.peach, -1.6, 1.4, 7.2, 0.56);
    cap('p ∧ q：今天星期五而且外面在下雨', '一個對一個錯 → 錯');
  },
  async (tok, S) => { // 1770.1 p ∨ q → T
    S.r2 = card('p ∨ q：星期五或在下雨 → T ∨ F = T', C.mint, -1.6, 0.7, 7.2, 0.56); await cheer(tok, S, true);
    cap('改成 or', '星期五已經對了，不管有沒有下雨 → 對');
  },
  async (tok, S) => { // 1801.0 p ∧ q ∧ r
    gone(S.r1, S.r2); S.r3 = card('p ∧ q ∧ r：三件事都要真', C.peach, -1.6, 1.4, 7.2, 0.56);
    cap('不只兩個，可以串起來', 'p and q and r：三件事都要為真');
  },
  async (tok, S) => { // 1851.7 T ∧ F ∧ F → F
    S.r4 = card('T ∧ F ∧ F = F（一個錯就錯）', C.peach, -1.6, 0.7, 7.2, 0.56); await cheer(tok, S, false);
    cap('星期五對；沒下雨、沒有狗', '一對兩錯 → 答案是錯的');
  },
  async (tok, S) => { // 1883.1 p ∨ q ∨ r
    gone(S.r3, S.r4); S.r5 = card('p ∨ q ∨ r：一件真就真', C.mint, -1.6, 1.4, 7.2, 0.56); await cheer(tok, S, true);
    cap('p or q or r 也一樣', '只要有一件事是對的，馬上寫 true');
  },
  async (tok, S) => { // 1909.5 全部假才假
    card('要寫 false：每一件都要是錯的', C.sand, -1.6, 0.7, 7.2, 0.56);
    cap('要說它是錯的', '必須三件事情每一件都錯');
  },
  async (tok, S) => { // 1936.0 ∧ 像乘、∨ 像加
    gone(S.vs); hd('類比：∧ ≈ 乘法，∨ ≈ 加法', 3.0, 3.6);
    cap('以後可以把 and 想成乘法', 'or 想成加法');
  },
  async (tok, S) => { // 1957.0 有一個 0 就 0
    sm('1 · 0 = 0：乘法只要有一個 0 就是 0（像 ∧）', 3.0, 3.0);
    cap('0/1 的乘法：只要有一個 0', '答案就是 0：跟 ∧ 一樣');
  },
  async (tok, S) => { // 1976.6 加法：1+1 記成 1
    sm('1 + 1 也記成 1：有一個 1 就是 1（像 ∨）', 3.0, 2.4);
    cap('加法：只要有一個 1，答案就是 1', '只能用 0、1，所以 1 + 1 還是寫 1');
  },
]);
scene('lg-01-xor', 'Lec01：Exclusive or p ⊕ q', CAM, [
  async (tok, S) => { // 2018.6 exclusive or
    hot('Exclusive or（互斥或）', 3.0, 6.7);
    cap('再來：exclusive or', '中文叫互斥或');
  },
  async (tok, S) => { // 2033.6 符號與真值表
    S.T = TT(['p', 'q'], [['p ∨ q', (e) => e.p || e.q], ['p ⊕ q', (e) => e.p !== e.q]], { dx: 1.6, cx: -3.0, top: 5.4 });
    card('p ⊕ q', C.sky, 3.0, 6.0, 2.4, 0.6);
    cap('直接給符號跟真值表', 'p ⊕ q');
  },
  async (tok, S) => { // 2050.5 operator / operand
    sm('⊕、∧、∨：operator 運算子', 3.0, 5.3); sm('p、q：operand 運算元（被拿來算的）', 3.0, 4.8);
    cap('這種符號叫 operator（運算子）', '被拿來計算的 p、q 叫 operand');
  },
  async (tok, S) => { // 2088.4 4 列
    await S.T.col(tok, 0, 90); await S.T.col(tok, 1, 90); S.T.now([2]);
    duo(S, { x: 6.4 });
    cap('兩個運算元，各兩種變化', '列舉出來 4 列');
  },
  async (tok, S) => { // 2103.0 一真一假才真
    S.T.hot(3); await S.T.col(tok, 3, 250, [1, 2]); await cheer(tok, S, true);
    cap('要為真唯一的條件', '一真一假');
  },
  async (tok, S) => { // 2119.1 兩真、兩假 → 假
    await S.T.col(tok, 3, 250, [0, 3]); S.T.glowAt(0, 3, NG); S.T.glowAt(3, 3, NG); await cheer(tok, S, false);
    cap('兩個都真，或兩個都假', '答案都是錯的');
  },
  async (tok, S) => { // 2130.6 口語「或」
    bub('兩個都真，算「或」嗎？', 3.4, 4.0); sm('例：今天星期五或外面在下雨', 3.4, 3.35);
    cap('語意上會有一點問題', '我們口語的「或」到底包不包含兩個都真？');
  },
  async (tok, S) => { // 2156.0 but not both
    S.T.clear(); S.T.glowAt(0, 2, HL); S.T.glowAt(0, 3, HL);
    note('看到 "but not both" → 用 ⊕', 2.6, 2.0); sm('∨ 和 ⊕ 只差在 TT 這一列', -3.0, 1.9);
    cap('要把兩個同時為真排除掉', '看到 but not both，就用 exclusive or');
  },
]);
scene('lg-01-cond', 'Lec01：Conditional p → q（全勤拿 100 分）', CAM, [
  async (tok, S) => { // 2207.4 conditional operator
    hot('Conditional operator', 0, 6.7);
    cap('再來一個：conditional operator', '牽涉兩個運算元');
  },
  async (tok, S) => { // 2234.7 符號 →
    card('p → q', C.lilac, -4.2, 6.0, 2.6, 0.6);
    cap('condition 就是條件', '符號是箭頭：p → q');
  },
  async (tok, S) => { // 2246.2 若 p 則 q
    card('conditional statement：若 p 則 q', C.lilac, 2.0, 6.0, 6.0, 0.6);
    cap('叫做 conditional statement', '翻成中文：若 p 則 q');
  },
  async (tok, S) => { // 2269.2 例：每堂課都來 → 100 分
    card('p：每堂課都來（全勤）', C.sand, -3.2, 5.1, 4.4, 0.56); card('q：期末拿 100 分', C.sand, 3.2, 5.1, 4.4, 0.56);
    S.st = buddy('學生', '', C.pink, -6.2, 0, 1.4, 0.8); S.st.look(1);
    cap('例：每次上課都來、沒缺席', '期末就拿到 100 分');
  },
  async (tok, S) => { // 2297.0 TT → T
    S.L = [];
    S.L.push(card('全勤、100 分', C.mint, -2.6, 4.0, 3.8, 0.5), good('T', 0.2, 4.0));
    S.st.mood('happy'); cap('穿紅衣服的同學：每堂都來，也拿 100', '這個陳述為真'); await S.st.hop(tok);
  },
  async (tok, S) => { // 2328.0 TF → F
    S.L.push(card('全勤、只拿 99 分', C.peach, -2.6, 3.3, 3.8, 0.5), bad('F', 0.2, 3.3));
    S.st.mood('sad'); cap('每節都來，一題寫錯只拿 99', '真的來上課卻沒拿到 100 → 假'); await S.st.hop(tok);
  },
  async (tok, S) => { // 2354.0 FT → ?
    S.L.push(card('沒全勤、拿 100 分', C.sand, -2.6, 2.6, 3.8, 0.5)); S.q3 = bub('?', 0.2, 2.6);
    S.st.mood('wow'); cap('有一節沒來，最後卻拿 100', '這是真的還是假的？');
  },
  async (tok, S) => { // 2386.5 → T
    kill(S.q3); S.L.push(good('T', 0.2, 2.6));
    cap('他其實沒講錯', '前提沒成立，就沒辦法說他錯 → 真');
  },
  async (tok, S) => { // 2390.3 FF → T
    S.L.push(card('沒全勤、拿 99 分', C.sand, -2.6, 1.9, 3.8, 0.5), good('T', 0.2, 1.9));
    cap('沒全勤、拿 99', '前後都沒成立：我們還是認為它是對的');
  },
  async (tok, S) => { // 2418.6 沒有因果關係
    S.L.push(bad('沒有因果關係！只看真假的組合', -1.6, 1.1));
    cap('跟以前的認知不太一樣', '若…則…在這裡沒有因果關係');
  },
  async (tok, S) => { // 2437.3 真值表
    S.T = TT(['p', 'q'], [['p → q', (e) => IM(e.p, e.q)]], { dx: 1.3, cx: 4.4, top: 4.0, dy: 0.7 });
    await S.T.col(tok, 0, 60); await S.T.col(tok, 1, 60); S.T.hot(2); await S.T.col(tok, 2, 160); S.T.glowAt(1, 2, NG);
    cap('寫成真值表：T F T T', '只有前件真、後件假才是假');
  },
  async (tok, S) => { // 2490.5 穿紅衣 → 中大樂透
    gone(S.L); S.r = card('If I\'m in red, then I win the lottery.', C.lilac, -3.0, 3.6, 6.4, 0.6);
    cap('補充一個例子', '如果我今天穿紅衣服，我就中大樂透');
  },
  async (tok, S) => { // 2518.5 沒穿紅衣 → 真
    note('老師沒穿紅衣 → 前提假 → 整句為真', -3.0, 2.8); S.T.glowRow(2, OKG); S.T.glowRow(3, OKG);
    cap('我有沒有穿紅衣服？沒有', '前提不成立，不管有沒有中獎，句子都對');
  },
  async (tok, S) => { // 2545.2 再次強調
    bad('穿紅衣跟中樂透：本來就沒有因果', -3.0, 2.0);
    cap('再次強調：不要想像任何因果關係', '只是前後真假的組合');
  },
]);
scene('lg-01-cex', 'Lec01：例題 If 2 + 3 = 4, then x = x + 1', CAM, [
  async (tok, S) => { // 2563.4 兩個句子
    cap('當作一個例子', '給你兩個命題');
  },
  async (tok, S) => { // 2572.0 ①
    S.a = card('① If 2 + 3 = 4, then x = x + 1.', C.lilac, -2.0, 6.0, 6.8, 0.6);
    cap('第一句：如果 2 + 3 = 4', '則 x = x + 1');
  },
  async (tok, S) => { // 2583.3 ②
    S.b = card('② If 2 + 3 = 5, then x = x + 1.', C.lilac, -2.0, 5.2, 6.8, 0.6);
    cap('第二句：2 + 3 = 5', '則 x = x + 1');
  },
  async (tok, S) => { // 2593.0 設變數
    S.v = [['p：2 + 3 = 4', -4.2], ['q：2 + 3 = 5', 0], ['r：x = x + 1', 4.2]].map(([t, x]) => card(t, C.sand, x, 3.9, 3.6, 0.56));
    cap('先寫成像樣的式子', 'p、q、r 三個命題變數');
  },
  async (tok, S) => { // 2610.2 真值
    bad('F', -4.2, 3.25); good('T', 0, 3.25); bad('F（不管 x 是多少都錯）', 4.2, 3.25);
    cap('2 + 3 = 4 錯；2 + 3 = 5 對', 'x = x + 1 永遠錯：雖然不知道 x，仍是命題');
  },
  async (tok, S) => { // 2634.0 ① = p → r：F → F → T
    S.e1 = card('① = p → r：F → F ⇒ T', C.mint, -1.6, 2.2, 5.6, 0.6); good('為真', 2.4, 2.2);
    cap('第一句寫成 p → r', '前提是錯的，後面不管對錯，答案是對的');
  },
  async (tok, S) => { // 2644.4 前提的名稱
    sm('p：前提／假設／前件（hypothesis、antecedent、premise）', -1.0, 1.55);
    cap('p 一般叫前提、假設或前件', '英文有三種說法，回去看課本');
  },
  async (tok, S) => { // 2672.1 ② = q → r：T → F → F
    S.e2 = card('② = q → r：T → F ⇒ F', C.peach, -1.6, 0.8, 5.6, 0.6); bad('為假', 2.4, 0.8);
    cap('第二句：前提對，結論（後件）錯', '這是唯一會錯的情況');
  },
  async (tok, S) => { // 2692.3 沒有因果
    note('x = x + 1 永遠不會對，① 卻是真的：只看真假，沒有因果', 0, 0.0);
    cap('再強調一次：沒有任何因果關係', '純粹就對錯來判斷');
  },
]);
scene('lg-01-four', 'Lec01：逆、否、逆否的真值表（逆否 ≡ 原命題）', CAMW, [
  async (tok, S) => { // 2708.6 各種組合
    S.T = TT(['p', 'q'], [['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['p→q', (e) => IM(e.p, e.q)], ['q→p', (e) => IM(e.q, e.p)], ['¬p→¬q', (e) => IM(!e.p, !e.q)], ['¬q→¬p', (e) => IM(!e.q, !e.p)]], { dx: 1.48, top: 5.6 });
    S.T.hot(4); cap('做個練習：p → q 有各種組合', '這個我們知道了');
  },
  async (tok, S) => { // 2732.0 q → p
    S.T.hot(4, false); S.T.hot(5);
    cap('常看到的形式：q 則 p', 'q → p');
  },
  async (tok, S) => { // 2742.9 ¬p → ¬q
    S.T.hot(5, false); S.T.hot(6);
    cap('還有一個：非 p 則非 q', '¬p → ¬q');
  },
  async (tok, S) => { // 2745.5 ¬q → ¬p
    S.T.hot(6, false); S.T.hot(7);
    cap('一般是：非 q 則非 p', '¬q → ¬p');
  },
  async (tok, S) => { // 2747.2 4 種可能
    S.T.hot(7, false); await S.T.col(tok, 0, 80); await S.T.col(tok, 1, 80); duo(S, { x: 6.6 });
    cap('寫真值表：把所有可能列出來', '兩個變數，4 種');
  },
  async (tok, S) => { // 2787.6 中間欄 ¬p、¬q
    await S.T.col(tok, 2, 110); await S.T.col(tok, 3, 110);
    cap('會用到 not p、not q', '先把中間的「原料」準備好');
  },
  async (tok, S) => { // 2826.0 p → q
    S.T.hot(4); await S.T.col(tok, 4, 200); S.T.glowAt(1, 4, NG);
    cap('p → q：前件真、後件假才錯', 'T F T T');
  },
  async (tok, S) => { // 2861.0 q → p
    S.T.hot(4, false); S.T.hot(5); await S.T.col(tok, 5, 200); S.T.glowAt(2, 5, NG);
    cap('q → p：這時 q 是前提、p 是結論', 'q 真 p 假（第 3 列）才錯：T T F T');
  },
  async (tok, S) => { // 2893.5 ¬p → ¬q：你們試試看
    S.T.hot(5, false); S.T.hot(6); await S.T.col(tok, 6, 200); S.T.glowAt(2, 6, NG);
    cap('這個你們試試看', '¬p → ¬q：T T F T');
  },
  async (tok, S) => { // 2901.4 ¬q → ¬p 比較重要
    S.T.hot(6, false); S.T.hot(7); S.T.glowCol(3, HL); S.T.glowCol(2, HL);
    cap('比較重要的是：非 q 則非 p', '前件是 ¬q 這一排，結論是 ¬p');
  },
  async (tok, S) => { // 2915.0 填 ¬q → ¬p
    S.T.glowCol(3, null); S.T.glowCol(2, null); await S.T.col(tok, 7, 220); S.T.glowAt(1, 7, NG);
    cap('¬q 假 → 對；¬q 真、¬p 假 → 錯', 'T F T T');
  },
  async (tok, S) => { // 2951.0 跟 p → q 一致
    S.T.clear(); S.T.hot(7, false); S.T.glowCol(4, OKG); S.T.glowCol(7, OKG); await cheer(tok, S, true);
    cap('它的答案跟 p → q 在任何情況都一致', '長相不一樣，答案相同');
  },
  async (tok, S) => { // 2966.0 邏輯等價
    card('這叫「邏輯等價」（下一節 1-2）', C.mint, 0, 1.6, 6.0, 0.6);
    cap('這個下一節會講', '叫做邏輯等價');
  },
  async (tok, S) => { // 2976.5 像 sin²θ + cos²θ = 1
    sm('像 sin²θ + cos²θ = 1：需要時可以代換、讓運算變簡單', 0, 0.9);
    cap('像以前的恆等式', '兩邊在任何情況都一樣，才能互相代換');
  },
  async (tok, S) => { // 2996.0 ≡ 不是運算子
    card('p → q ≡ ¬q → ¬p', C.sky, -2.4, 0.1, 4.6, 0.6); bad('≡ 不是運算子，只表示可以代換', 2.8, 0.1);
    cap('符號寫成 ≡', '它不是運算子，只表示兩個一樣、可以代換');
  },
]);
scene('lg-01-bicond', 'Lec01：Biconditional p ↔ q', CAM, [
  async (tok, S) => { // 3017.0 biconditional operator
    hot('Biconditional operator', 3.4, 6.7);
    cap('最後一個運算子', 'biconditional operator');
  },
  async (tok, S) => { // 3034.7 ↔
    card('p ↔ q', C.mint, 3.4, 6.0, 2.6, 0.6);
    cap('符號是雙箭頭', 'p ↔ q');
  },
  async (tok, S) => { // 3045.0 p→q 而且 q→p
    card('意思：(p → q) 而且 (q → p)', C.mint, 3.4, 5.2, 5.4, 0.6);
    cap('利用這個符號的樣子', '意思就是 p 則 q，而且 q 則 p');
  },
  async (tok, S) => { // 3060.5 兩件都要對
    sm('兩件事都要對', 3.4, 4.55);
    cap('要為真', '這件事要對，那件事也要對');
  },
  async (tok, S) => { // 3069.5 imply
    sm('→ 也叫 imply（蘊含）', 3.4, 4.05);
    cap('剛才沒講：→ 有時也叫 imply', '隱含、蘊含');
  },
  async (tok, S) => { // 3076.1 真值表
    S.T = TT(['p', 'q'], [['p → q', (e) => IM(e.p, e.q)], ['q → p', (e) => IM(e.q, e.p)], ['p ↔ q', (e) => e.p === e.q]], { dx: 1.55, cx: -2.6, top: 5.4 });
    await S.T.col(tok, 0, 80); await S.T.col(tok, 1, 80); duo(S, { x: 6.4 });
    cap('按部就班畫真值表', 'TTFF、TFTF');
  },
  async (tok, S) => { // 3097.3 p → q
    S.T.hot(2); await S.T.col(tok, 2, 180);
    cap('先看 p → q', '唯一會錯：前件真、後件假');
  },
  async (tok, S) => { // 3128.4 q → p
    S.T.hot(2, false); S.T.hot(3); await S.T.col(tok, 3, 180);
    cap('q → p 也一樣', '前提真、結論假才是假');
  },
  async (tok, S) => { // 3141.2 and
    S.T.hot(3, false); S.T.hot(4); await S.T.col(tok, 4, 220); S.T.glowAt(1, 4, NG); S.T.glowAt(2, 4, NG);
    cap('最後拿 and 出來用', '兩個都真才真，有一個假就假：T F F T');
  },
  async (tok, S) => { // 3157.7 同真同假
    S.T.clear(); S.T.glowRow(0, OKG); S.T.glowRow(3, OKG); await cheer(tok, S, true);
    note('p、q 同時為真或同時為假 → p ↔ q 為真', 0, 1.0);
    cap('記的時候看含義就好', '兩個要同時為真或同時為假，答案才是真');
  },
]);
scene('lg-01-suff', 'Lec01：充分條件與必要條件', CAM, [
  async (tok, S) => { // 3187.0 課本 p.6、p.9
    hot('→ 和 ↔ 有很多種說法（課本第 6、9 頁）', 0, 6.7);
    cap('有件事要特別注意', '請回去看課本列的各種講法');
  },
  async (tok, S) => { // 3205.4 if p then q；q if p
    card('if p, then q', C.lilac, -3.2, 5.9, 3.6, 0.56); card('q if p（倒裝）', C.lilac, 3.2, 5.9, 3.6, 0.56);
    cap('if p then q', '常常可以倒裝成 q if p');
  },
  async (tok, S) => { // 3237.0 若且唯若
    card('p ↔ q：若且唯若', C.mint, 0, 5.1, 4.2, 0.56);
    cap('以前數學課常講的', '若且唯若');
  },
  async (tok, S) => { // 3254.0 充分、必要條件
    card('充分條件', C.sky, -3.2, 4.3, 3.0, 0.56); card('必要條件', C.peach, 3.2, 4.3, 3.0, 0.56);
    cap('中文另一種說法', '充分條件、必要條件');
  },
  async (tok, S) => { // 3273.7 英文
    sm('if and only if', 0, 4.3); sm('sufficient condition', -3.2, 3.7); sm('necessary condition', 3.2, 3.7);
    cap('英文直接照字面翻', 'sufficient condition、necessary condition');
  },
  async (tok, S) => { // 3288.4 p 真保證 q 真
    S.p = buddy('p', 'T', C.purple, -2.0, 0, 1.2, 0.9); S.q = buddy('q', 'T', C.blue, 2.0, 0, 1.2, 0.9); arrow(V3(-1.2, 0.5, 1.2), V3(1.2, 0.5, 1.2));
    cap('從 p → q 來看：要它為真', 'p 如果對，就保證 q 要對');
    await S.p.hop(tok); await S.q.hop(tok);
  },
  async (tok, S) => { // 3316.6 p 是 q 的充分條件
    good('p 是 q 的充分條件（p 成立就夠了）', -3.0, 2.75);
    cap('正向思考：p 對一定保證 q 對', '所以 p 是 q 的充分條件');
  },
  async (tok, S) => { // 3343.0 q 是 p 的必要條件
    good('q 是 p 的必要條件', 3.0, 2.75);
    cap('反過來講', 'q 是 p 的必要條件');
  },
  async (tok, S) => { // 3353.7 q 不成立 → p 不能成立
    S.q.set('F'); S.q.mood('sad'); S.p.set('F'); S.p.mood('sad');
    S.nt = note('p 要成立，q 一定要成立；q 不成立 → p 也不可能成立', 0, 2.05);
    cap('p 如果要對，q 一定要對', 'q 不對時，p 絕對不能對'); await S.q.hop(tok);
  },
  async (tok, S) => { // 3376.0 15 種寫法
    gone(S.nt); sm('英文常見約 15 種寫法：見課本', 0, 2.05);
    cap('英文也有相對應的寫法', '常見大概有 15 種');
  },
]);
scene('lg-01-prec', 'Lec01：運算子的優先權', CAM, [
  async (tok, S) => { // 3395.2 2 × 3 + 1
    S.e = card('2 × 3 + 1 = ?', C.sand, 0, 5.8, 3.6, 0.7);
    cap('最後一件基本的事', '給你 2 × 3 + 1，你怎麼算？');
  },
  async (tok, S) => { // 3412.6 先乘再加
    relabel(S.e, '2 × 3 + 1 = 6 + 1 = 7'); sm('不會先算 3 + 1 再乘 2', 0, 5.1);
    cap('先 2 × 3，再加 1', '絕對不會先把 3 跟 1 相加');
  },
  async (tok, S) => { // 3423.3 優先權
    hot('運算子的優先權（precedence）', 0, 6.7);
    cap('這叫運算子的優先權', '邏輯運算也有');
  },
  async (tok, S) => { // 3437.3 五個
    S.ops = ['∧', '∨', '¬', '→', '↔'].map((o, i) => cube(o, C.lilac, [1.0, 1.0, 1.0], -4 + i * 2, 3.9, 0, 2.4));
    cap('講過常見的五個', 'and、or、not、imply、if and only if');
  },
  async (tok, S) => { // 3471.2 排順序
    const order = [2, 0, 1, 3, 4];
    hold(S.ops);
    await anim(tok, 900, (u) => order.forEach((k, i) => { const x0 = -4 + k * 2, x1 = -4 + i * 2; S.ops[k].position.x = x0 + (x1 - x0) * u; S.ops[k].position.y = 3.9 - (k === 2 ? Math.sin(Math.PI * u) * 1.2 : 0); }));
    ['1', '2', '3', '4', '5'].forEach((t, i) => sm('第 ' + t, -4 + i * 2, 3.0)); glow(S.ops[2], HL);
    cap('照課本的表：¬ 最優先', '然後 ∧、∨、→，↔ 最後');
  },
  async (tok, S) => { // 3483.5 類比
    note('¬ ≈ 負號，∧ ≈ 乘法，∨ ≈ 加法；→、↔ 比加減還後面', 0, 2.0);
    cap('跟我們一樣：not 像負號、and 像乘法', 'or 想成加法；→、↔ 擺在最後');
  },
  async (tok, S) => { // 3503.2 加括號
    card('想先算別的 → 加括號', C.mint, 0, 1.0, 4.6, 0.6); sm('例：p ∨ q → r 就是 (p ∨ q) → r', 0, 0.3);
    cap('要違背它天生的優先權', '就像 3 + 1 要先算，麻煩加括號');
  },
]);
scene('lg-01-tt3', 'Lec01：(p ∨ q) → (p ∧ r) 的 8 列真值表', CAMW, [
  async (tok, S) => { // 3530.6 例子
    S.f = card('p ∨ q → p ∧ r', C.lilac, 0, 7.6, 4.0, 0.6);
    cap('看這個例子', '寫了一個邏輯式子，請列真值表');
  },
  async (tok, S) => { // 3548.0 真值表多大？
    S.q = bub('要畫幾列？', 4.2, 7.6);
    cap('先回到真值表', 'not 只有兩排…');
  },
  async (tok, S) => { // 3561.3 兩個變數 4 列
    S.n2 = sm('2 個變數 → 4 列', -4.2, 7.0);
    cap('p and q、p or q 只有兩個變數', '要畫四排');
  },
  async (tok, S) => { // 3567.7 p q r → 8
    S.n3 = sm('p、q、r：2³ = 8 列', 0, 7.0);
    cap('這裡有 p、q、r 三個變數', '每個兩種可能：2 的 3 次方 = 8 種');
  },
  async (tok, S) => { // 3588.5 4 → 16，5 → 32
    S.n4 = sm('4 個 → 16、5 個 → 32：一倍一倍長', 4.2, 7.0);
    cap('4 個變數就要 2⁴ 排，5 個要 2⁵', '多一個變數就翻一倍');
  },
  async (tok, S) => { // 3598.7 只能處理小事情
    kill(S.q); bad('變數一多，真值表就不切實際', 4.2, 8.25);
    cap('真值表只能處理小事情', '但它可以幫助我們學習');
  },
  async (tok, S) => { // 3615.0 畫 p q r
    gone(S.n2, S.n3, S.n4);
    S.T = TT(['p', 'q', 'r'], [['p ∨ q', (e) => e.p || e.q], ['p ∧ r', (e) => e.p && e.r], ['(p∨q)→(p∧r)', (e) => IM(e.p || e.q, e.p && e.r)]], { dx: 1.75, top: 5.9, dy: 0.6 });
    await S.T.col(tok, 0, 40); await S.T.col(tok, 1, 40); await S.T.col(tok, 2, 40);
    cap('真值表：p、q、r，總共 8 排', '');
  },
  async (tok, S) => { // 3624.4 → 最低，從這裡切兩半
    relabel(S.f, '(p ∨ q) → (p ∧ r)'); glow(S.f, HL);
    cap('沒有括號 → 看優先權', '→ 最低、最後處理：從這裡切成兩部分');
  },
  async (tok, S) => { // 3646.3 先算 p ∨ q、p ∧ r
    S.T.hot(3); S.T.hot(4);
    cap('所以先判斷 p 或 q，跟 p 且 r', '從小的疊上去，最後湊成要的式子');
  },
  async (tok, S) => { // 3670.2 p ∨ q
    S.T.hot(4, false); await S.T.col(tok, 3, 120);
    cap('p ∨ q：有一個真就是真', '只有最後兩列兩個都假');
  },
  async (tok, S) => { // 3688.7 p ∧ r
    S.T.hot(3, false); S.T.hot(4); await S.T.col(tok, 4, 120);
    cap('p ∧ r：p 跟 r 兩個都要真才真', '只有第 1、3 列');
  },
  async (tok, S) => { // 3725.5 前件、後件
    S.T.hot(4, false); S.T.hot(5); S.T.glowCol(3, HL); S.T.glowCol(4, HL);
    cap('前件是 p ∨ q 這一欄', '後件（結論）是 p ∧ r 這一欄');
  },
  async (tok, S) => { // 3732.4 逐列
    S.T.clear(); for (let r = 0; r < 8; r++) { await S.T.col(tok, 5, 0, [r]); if (!S.T.val(r, 5)) S.T.glowAt(r, 5, NG); await wt(tok, 150); }
    cap('前提真、結論真 → T；真推到假 → F', '最後兩列前提假 → T：T F T F F F T T');
  },
  async (tok, S) => { // 3777.3 總結
    S.T.hot(5, false); note('學到：優先權、真值表大小（2ⁿ 列）', 0, 0.5);
    cap('這個例子講了優先權', '也講了真值表大小跟變數個數的關係');
  },
]);
scene('lg-01-qs', 'Lec01：兩個小問題（2⁶、真值表有幾種）', CAM, [
  async (tok, S) => { // 3795.4 兩個問題
    hot('最後給你們兩個問題', 0, 6.7);
    cap('基礎告一段落', '最後兩個問題，其中一個已經有答案');
  },
  async (tok, S) => { // 3805.7 6 個變數
    card('① 6 個變數 → 2⁶ = 64 列', C.sky, 0, 5.6, 5.4, 0.6);
    cap('一個式子有 6 個不一樣的變數', '真值表有幾排？2⁶ = 64');
  },
  async (tok, S) => { // 3817.1 邏輯等價
    sm('外表不一樣、真值表一樣 → 邏輯等價，算同一個', 0, 4.9);
    cap('有些式子表面不一樣', '真值表一樣：我們說它們邏輯等價');
  },
  async (tok, S) => { // 3834.0 3 個變數能有幾種
    card('② 3 個變數：能變出幾種不同的真值表？', C.peach, 0, 4.1, 7.2, 0.6);
    S.cells = []; for (let r = 0; r < 8; r++) S.cells.push(cube('?', C.gray, [0.8, 0.42, 0.6], -3.5 + r, 2.9, 0, 1.4));
    cap('三個變數的複合命題', '真值表可能有幾種變化？回去想');
  },
  async (tok, S) => { // 3856.1 提示 2^8
    S.cells.forEach((m, i) => { const v = (0b10110010 >> (7 - i)) & 1; relabel(m, v ? 'T' : 'F'); tint(m, v ? C.green : C.gray); });
    sm('隨便填一組（示意）', 0, 2.3); note('提示：結果欄 8 格、每格 T 或 F → 2⁸ = 256 種', 0, 1.5);
    cap('上面輸入不管，結果欄隨便你填', '每格兩種 → 2⁸ = 256（提示）');
  },
]);
scene('lg-01-eng', 'Lec01：把英文句子寫成邏輯式（only if）', CAM, [
  async (tok, S) => { // 3886.0 小心語意
    hot('進階：小心英文（中文）語意', 0, 6.7);
    cap('第一件事：注意英文', '要適切地表達一件事');
  },
  async (tok, S) => { // 3909.0 寫成邏輯式子
    sm('不能直接判斷 → 寫成邏輯式子', 0, 6.1);
    cap('語意複雜、不清楚的時候', '就把它寫成邏輯式子來判斷');
  },
  async (tok, S) => { // 3921.3 句子
    S.s1 = card('You can access the Internet from campus', C.sand, 0, 5.2, 8.0, 0.56);
    S.s2 = card('only if you are a CS major or you are not a freshman.', C.sand, 0, 4.55, 8.6, 0.56);
    cap('你可以在學校用網路', '唯有你是資工系學生，或你不是大一新生');
  },
  async (tok, S) => { // 3963.2 設變數
    [['p：You can access the Internet from campus', 3.6], ['q：You are a CS major', 2.95], ['r：You are a freshman', 2.3]].forEach(([t, y]) => card(t, C.sky, -1.4, y, 7.0, 0.5));
    sm('r 設成「是大一」，「不是大一」就寫 ¬r', 4.6, 2.3);
    cap('從頭開始：三個基本句子 → p、q、r', 'r 看你高興：設成 You are a freshman');
  },
  async (tok, S) => { // 3991.0 關鍵字
    hd('only if', -2.4, 1.5); hd('or', 0, 1.5); hd('not', 2.0, 1.5);
    cap('再看關鍵字', 'only if、or、not');
  },
  async (tok, S) => { // 4009.0 p only if q ≡ p → q
    card('p only if q ≡ if p then q（p → q）', C.mint, 0, 0.8, 6.6, 0.56);
    cap('only if 是「唯有」', 'p only if q 其實就是 p → q');
  },
  async (tok, S) => { // 4046.2 優先權
    sm('優先權：¬、∨ 先做，→ 最後', 0, 0.15);
    cap('三個句子又有優先權的問題', '∨ 跟 ¬ 先做，再做 →');
  },
  async (tok, S) => { // 4071.1 p → (q ∨ ¬r)
    S.ans = card('p → (q ∨ ¬r)', C.lilac, 0, -0.6, 4.4, 0.7); glow(S.ans, HL);
    cap('寫出來：p → q ∨ ¬r', '¬ 優先權最高，不用加括號');
  },
  async (tok, S) => { // 4141.9 加括號
    sm('不放心就加括號，意思一樣', 3.8, -0.6);
    cap('優先權背得沒那麼好', '再加括號也 OK，都是同樣的意思');
  },
]);
scene('lg-01-coaster', 'Lec01：雲霄飛車的 unless', CAM, [
  async (tok, S) => { // 4147.0 例 2
    hot('再一個例子：unless', 0, 6.7);
    cap('再看一個', '首先分析句子');
  },
  async (tok, S) => { // 4152.0 You cannot ride
    S.a = card('You cannot ride the roller coaster', C.sand, 0, 5.9, 7.2, 0.56);
    cap('最基本的：你不能坐雲霄飛車', '');
  },
  async (tok, S) => { // 4158.3 under 4 feet
    S.b = card('if you are under 4 feet tall', C.sand, 0, 5.25, 6.0, 0.56);
    cap('如果你身高低於 4 呎', '');
  },
  async (tok, S) => { // 4171.7 older than 16
    S.c = card('unless you are older than 16 years old.', C.sand, 0, 4.6, 7.0, 0.56);
    cap('除非你超過 16 歲', '三個基本句子');
  },
  async (tok, S) => { // 4175.0 if、unless
    hd('if', -4.6, 5.25); hd('unless', -4.6, 4.6);
    cap('這邊有 if，還有 unless', 'unless 也在課本列的同義句法裡');
  },
  async (tok, S) => { // 4216.4 設變數
    [['q：你可以坐雲霄飛車', 3.5], ['r：你身高低於 4 呎', 2.85], ['s：你超過 16 歲', 2.2]].forEach(([t, y]) => card(t, C.sky, -2.2, y, 5.0, 0.5));
    sm('（變數名稱用課本的設法）', 3.4, 2.85);
    cap('三個基本變數這樣設', '');
  },
  async (tok, S) => { // 4225.0 字面意思
    S.st = buddy('矮個子', '16+?', C.pink, 5.6, 0, 1.4, 0.7); S.st.look(-1);
    note('低於 4 呎就不能坐…除非你超過 16 歲', 0, 1.4);
    cap('字面上：身高低於 4 呎就不能坐', '除非年紀超過 16 歲，夠成熟能自己決定');
  },
  async (tok, S) => { // 4279.4 (r ∧ ¬s) → ¬q
    S.ans = card('(r ∧ ¬s) → ¬q', C.lilac, 0, 0.5, 4.4, 0.7); glow(S.ans, HL);
    sm('比 4 呎矮「而且」沒超過 16 歲 → 不能坐', 0, -0.2);
    cap('字面翻成：如果矮於 4 呎而且沒超過 16 歲', '那你就不能坐雲霄飛車'); await S.st.hop(tok);
  },
  async (tok, S) => { // 4304.1 為什麼？1-2 再說
    bub('為什麼可以化成這個形式？→ 1-2 邏輯等價再說', 0, -1.0);
    cap('至少直覺上意思是 OK 的', '為什麼能這樣寫，學了邏輯等價再說');
  },
  async (tok, S) => { // 4319.6 英文文法優先權
    bad('小心英文文法的「優先權」', -4.8, 0.5);
    cap('牽涉英文文法怎麼解釋', 'unless 是最後的排除條件');
  },
]);
scene('lg-01-knight', 'Lec01：Logic puzzle：騎士與無賴', CAM, [
  async (tok, S) => { // 4346.0 logic puzzle
    hot('Logic puzzle 邏輯拼圖', 0, 6.7);
    cap('另外一種題目', 'Logic puzzle');
  },
  async (tok, S) => { // 4357.6 像柯南
    sm('給一堆陳述 → 一步步推出答案（像柯南找兇手）', 0, 6.1);
    cap('它會跟你講一堆陳述', '像猜謎、拼圖：從這句推到那句');
  },
  async (tok, S) => { // 4386.3 島上兩個人
    S.A = buddy('A', '?', C.sky, -3.6, 0, 1.0, 1.1); S.B = buddy('B', '?', C.lilac, 3.6, 0, 1.0, 1.1); S.A.look(1); S.B.look(-1);
    note('knight（騎士）永遠說實話；knave（無賴）永遠說謊', 0, 5.3);
    cap('島上遇到兩個人 A、B', 'knight 只說實話，knave 只說謊話');
  },
  async (tok, S) => { // 4392.0 A：B 是 knight
    S.sa = bub('A：「B 是 knight。」', -3.6, 3.1);
    cap('A 跟我說：B 是一個 knight', ''); await S.A.hop(tok);
  },
  async (tok, S) => { // 4414.0 B：我們兩個不同類
    S.sb = bub('B：「我們兩個是不同類型的人。」', 3.6, 3.1);
    cap('B 跟我說', '我們兩個是不一樣類型的人'); await S.B.hop(tok);
  },
  async (tok, S) => { // 4435.2 結論？
    S.qq = sm('A、B 各是 knight 還是 knave？', 0, 4.4);
    cap('請下一個結論', 'A 跟 B 各是什麼人？');
  },
  async (tok, S) => { // 4455.5 列舉、矛盾就排除
    S.q2 = sm('列舉所有可能：推出矛盾的就排除', 0, 3.9);
    cap('某種程度也是在列舉', '從假設推下去，互相矛盾就把它排除');
  },
  async (tok, S) => { // 4473.5 假設 A 是 knight
    S.A.set('knight?'); S.A.glow('#4a3a00');
    cap('先從第一種可能開始', '假設 A 是說實話的 knight');
  },
  async (tok, S) => { // 4498.7 → B 是 knight
    S.B.set('knight'); await S.B.hop(tok);
    cap('A 說實話，他說的「B 是 knight」為真', '可以推到 B 也是 knight');
  },
  async (tok, S) => { // 4519.3 B 說實話：兩人不同類
    glow(S.B.body, HL);
    cap('B 是 knight，也會說實話', '那他說的「兩個人類型不一樣」就是實話');
  },
  async (tok, S) => { // 4538.0 矛盾 → 排除
    S.x1 = bad('矛盾！兩個都是 knight，卻說「不同類」→ 排除', 0, 1.9); S.A.mood('wow'); S.B.mood('wow');
    cap('這就互相矛盾了', '矛盾的原因是假設錯了：這種可能不存在');
  },
  async (tok, S) => { // 4557.7 只剩 A 是 knave
    kill(S.x1); S.A.glow(null); glow(S.B.body, null); S.A.set('knave'); S.A.mood('calm'); S.B.set('?'); S.B.mood('calm');
    cap('只剩一種可能', 'A 是一個 knave：說的都是假話'); await S.A.hop(tok);
  },
  async (tok, S) => { // 4580.4 B 是 knight 為假 → B 是 knave
    S.B.set('knave'); gone(S.qq, S.q2); sm('A 說謊 → 「B 是 knight」是假的 → B 是 knave', 0, 4.45);
    cap('回去看 A 說了什麼：B 是 knight', '這件事是假的；島上只有兩種人 → B 是 knave'); await S.B.hop(tok);
  },
  async (tok, S) => { // 4605.3 B 說謊 → 兩人同類 ✓
    good('B 說謊 → 「不同類」是假的 → 兩人同類 ✓ 沒有矛盾', 0, 3.8);
    cap('B 既然是 knave，他說的是假的', '所以兩個人其實是同一類：所有話都驗證過，沒有牴觸');
  },
  async (tok, S) => { // 4628.4 答案
    card('答案：A、B 都是 knave', C.mint, 0, 0.4, 5.0, 0.7); S.A.mood('happy'); S.B.mood('happy');
    cap('答案：A 是 knave，B 也是 knave', '這就是 logic puzzle');
  },
]);
scene('lg-01-bit', 'Lec01：Bit string 與 bitwise OR、AND、XOR', CAM, [
  async (tok, S) => { // 4660.3 bit operation
    hot('Bit operation 位元運算', 0, 6.7);
    cap('再補一個以後會用到的', 'bit operation');
  },
  async (tok, S) => { // 4676.0 bit string
    S.bs = '010101'.split('').map((b, i) => cube(b, b === '1' ? C.green : C.gray, [0.8, 0.6, 0.7], -2.4 + i * 0.95, 5.6, 0, 1.4));
    hd('bit string', -4.6, 5.6);
    cap('像 010101 這樣一連串的 0、1', '叫做 bit string');
  },
  async (tok, S) => { // 4687.4 長度
    S.len = sm('length = 裡面 0、1 的個數 = 6', 0, 4.9);
    cap('二元字串的長度', '就是裡面 0、1 的個數');
  },
  async (tok, S) => { // 4716.6 兩個一樣長
    gone(S.bs, S.len); sm('兩個字串一樣長 → 可以做 bitwise 運算：同一位置自己對自己', 0, 4.9);
    cap('如果兩個字串一樣長', '定義 bitwise operation');
  },
  async (tok, S) => { // 4728.1 兩個字串
    const row = (s, y, nm, c) => { hd(nm, -5.4, y); return s.split('').map((b, i) => cube(b, b === '1' ? (c || C.green) : C.gray, [0.8, 0.55, 0.7], -3.3 + i * 0.95, y, 0, 1.2)); };
    S.row = row; S.a = row('01010111', 4.1, 'a'); S.b = row('11000011', 3.35, 'b');
    sm('長度都是 8', 5.6, 3.7);
    cap('例：01010111', '另一個：11000011，長度都是 8');
  },
  async (tok, S) => { // 4750.5 bitwise OR
    S.or = S.row('11010111', 2.2, 'OR', C.blue);
    cap('bitwise OR：同一位置兩個做 or', '01 → 1，11 → 1，00 → 0');
  },
  async (tok, S) => { // 4788.1 bitwise AND
    S.and = S.row('01000011', 1.45, 'AND', C.orange);
    cap('bitwise AND', '兩個都要是 1 才是 1');
  },
  async (tok, S) => { // 4815.0 bitwise XOR
    S.xor = S.row('10010100', 0.7, 'XOR', C.purple);
    cap('bitwise XOR 也可以', '兩個必須不一樣才是 1');
  },
]);

// ════════ ih43BS7GsNY（易志偉 Lec02：邏輯等價與等價定律） ════════
scene('lg-02-intro', 'Lec02：1-2 邏輯等價要做什麼', CAM, [
  async (tok, S) => { // 7.0 1-2 邏輯等價
    hot('1-2 Logical Equivalence 邏輯等價', 0, 6.6);
    cap('1-2 的標題：邏輯等價', '');
  },
  async (tok, S) => { // 8.0 像三角公式
    card('sin²θ + cos²θ = 1', C.sand, -3.0, 5.4, 4.2, 0.6); sm('像三角恆等式：背公式、做推演', -3.0, 4.7);
    cap('其實就是寫一些恆等式', '像國高中的三角公式');
  },
  async (tok, S) => { // 11.4 換成真假、and、or
    card('¬(p ∨ q) ≡ ¬p ∧ ¬q', C.sky, 3.0, 5.4, 4.2, 0.6); sm('這邊的公式：真、假、∧、∨…', 3.0, 4.7);
    cap('只是這邊講的是真、假', 'and、or 之類，公式長相不一樣');
  },
  async (tok, S) => { // 44.1 化簡、得到新結論
    S.big = card('看起來很複雜的式子', C.peach, -3.0, 2.6, 4.6, 0.8); S.sm = card('比較簡單的式子', C.mint, 3.0, 2.6, 3.6, 0.6);
    arrow(V3(-0.5, 2.6, 0.5), V3(1.1, 2.6, 0.5));
    cap('把很複雜的公式推演成比較簡單的', '甚至在推演過程裡得到新的結論');
  },
]);
scene('lg-02-taut', 'Lec02：tautology、contradiction、contingency', CAM, [
  async (tok, S) => { // 56.0 先給定義
    cap('第一件事：先給一個定義', '');
  },
  async (tok, S) => { // 73.2 複合命題
    sm('要是「複合」命題：單一命題可真可假，不會永遠為真', 3.4, 6.6);
    cap('記得是複合命題', '簡單命題可能真可能假，不可能永遠為真');
  },
  async (tok, S) => { // 84.0 tautology
    card('永遠為真：tautology（恆真）', C.mint, 3.4, 5.8, 5.2, 0.56);
    cap('如果一個複合命題永遠為真', '叫做 tautology');
  },
  async (tok, S) => { // 98.1 contradiction
    card('永遠為假：contradiction（矛盾）', C.peach, 3.4, 5.1, 5.2, 0.56);
    cap('如果永遠為假', '就是 contradiction，矛盾');
  },
  async (tok, S) => { // 115.7 contingency
    card('都不是：contingency', C.sand, 3.4, 4.4, 5.2, 0.56);
    cap('既不是 tautology 也不是 contradiction', '叫 contingency（看看就好）');
  },
  async (tok, S) => { // 125.1 看例子
    bub('命題怎麼會「永遠」為真？', 3.4, 3.5);
    cap('你會覺得很奇怪', '命題可真可假，怎麼會永遠為真？看例子');
  },
  async (tok, S) => { // 146.3 畫真值表 p
    S.T = TT(['p'], [['¬p', (e) => !e.p], ['p ∧ ¬p', (e) => e.p && !e.p], ['p ∨ ¬p', (e) => e.p || !e.p]], { dx: 1.6, cx: -3.0, top: 5.0 });
    await S.T.col(tok, 0, 200); duo(S, { x: 6.4 });
    cap('畫真值表：p 在這邊', 'T、F');
  },
  async (tok, S) => { // 158.3 ¬p
    S.T.hot(1); await S.T.col(tok, 1, 200);
    cap('式子裡有 not p', '剛好跟 p 顛倒：F、T');
  },
  async (tok, S) => { // 164.2 p ∧ ¬p
    S.T.hot(1, false); S.T.hot(2);
    cap('接著做 p and not p', '');
  },
  async (tok, S) => { // 169.3 p ∨ ¬p
    S.T.hot(3);
    cap('還有另外一個：p or not p', '');
  },
  async (tok, S) => { // 181.0 第一列 → F
    S.T.hot(3, false); await S.T.col(tok, 2, 0, [0]); await cheer(tok, S, false);
    cap('p 是 true、not p 是 false', '一真一假做 and → false');
  },
  async (tok, S) => { // 194.0 第二列 → F → contradiction
    await S.T.col(tok, 2, 0, [1]); S.T.glowCol(2, NG); S.T.hot(2, false);
    good('p ∧ ¬p：所有情況都是假 → contradiction', -2.0, 2.6);
    cap('一個 false 一個 true，也是 false', '在所有情況底下永遠為假：contradiction');
  },
  async (tok, S) => { // 215.6 p ∨ ¬p → tautology
    S.T.hot(3); await S.T.col(tok, 3, 250); S.T.glowCol(3, OKG); await cheer(tok, S, true);
    good('p ∨ ¬p：任何情況都是真 → tautology', -2.0, 1.9);
    cap('or：一個 true 一個 false → true', '在任何情況下永遠為真：tautology');
  },
]);
scene('lg-02-equiv', 'Lec02：邏輯等價的正式定義', CAMW, [
  async (tok, S) => { // 241.4 重點：等價
    hot('重點：什麼叫「等價」？', 0, 7.2);
    cap('有了這個定義', '重點是今天的標題：等價');
  },
  async (tok, S) => { // 251.2 正式定義
    card('p ≡ q  ⇔  p ↔ q 是 tautology', C.mint, 0, 6.4, 6.4, 0.7);
    cap('兩個複合命題 p、q 叫邏輯等價', 'if and only if：p ↔ q 是永遠為真的命題');
  },
  async (tok, S) => { // 287.0 符號 ≡
    sm('≡：三條橫，表示兩個複合命題是同一回事', 0, 5.75);
    cap('先看懂符號', '用三條橫的 ≡ 表示');
  },
  async (tok, S) => { // 300.2 像 sin²+cos² 寫 1
    sm('像 sin²θ + cos²θ 懶得寫，就寫 1', 0, 5.3);
    cap('就像 sin²θ + cos²θ', '懶得寫就寫 1：一模一樣的意思');
  },
  async (tok, S) => { // 319.6 上次例題
    S.T = TT(['p', 'q'], [['p → q', (e) => IM(e.p, e.q)], ['¬q → ¬p', (e) => IM(!e.q, !e.p)], ['(p→q)↔(¬q→¬p)', () => true]], { dx: 2.1, top: 3.8, cx: -0.6 });
    S.T.now([0, 1]); duo(S, { x: 6.6 });
    cap('記得上次叫你畫的真值表', '');
  },
  async (tok, S) => { // 325.3 p → q
    S.T.hot(2); await S.T.col(tok, 2, 180);
    cap('p implies q', 'T F T T');
  },
  async (tok, S) => { // 332.7 ¬q → ¬p
    S.T.hot(2, false); S.T.hot(3); await S.T.col(tok, 3, 180);
    cap('同樣的情況底下：¬q → ¬p', 'T F T T');
  },
  async (tok, S) => { // 338.0 任何情況都一樣
    S.T.hot(3, false); S.T.glowCol(2, OKG); S.T.glowCol(3, OKG);
    cap('不管在哪一種情況', '兩個真值表上的值都一樣');
  },
  async (tok, S) => { // 366.0 組成 ↔
    S.T.clear(); S.T.hot(4);
    cap('再把這兩個組成一個複合命題', '(p → q) ↔ (¬q → ¬p)');
  },
  async (tok, S) => { // 384.3 每列 T → tautology
    await S.T.col(tok, 4, 220); S.T.glowCol(4, OKG); await cheer(tok, S, true);
    cap('畫下去：每一列都是 true', '所以它是 tautology → 兩者邏輯等價');
  },
  async (tok, S) => { // 434.5 ↔ 為真：同真同假
    note('↔ 為真 ＝ 兩頭同時為真或同時為假 ＝ 兩欄每列都一樣', 0, 0.3);
    cap('繞了一圈', '意思就是兩頭同時為真、或同時為假');
  },
]);
scene('lg-02-dm', 'Lec02：用真值表證明 De Morgan', CAMW, [
  async (tok, S) => { // 447.0 集合 De Morgan
    card('集合：(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', C.sand, -3.2, 7.2, 5.4, 0.6);
    cap('提醒一下集合的 De Morgan', 'A 聯集 B 的補集 = A 的補集交 B 的補集');
  },
  async (tok, S) => { // 465.1 對應
    sm('補集 ↔ ¬，聯集 ∪ ↔ ∨，交集 ∩ ↔ ∧', 3.4, 7.2);
    cap('集合跟邏輯很多符號可以互相對應', '補集是 NOT、聯集是 OR、交集是 AND');
  },
  async (tok, S) => { // 487.1 邏輯版
    S.f = card('邏輯：¬(p ∨ q) ≡ ¬p ∧ ¬q', C.sky, 0, 6.5, 5.4, 0.6);
    cap('邏輯這邊也有同樣的翻版', '這叫 De Morgan 律');
  },
  async (tok, S) => { // 499.6 優先權
    sm('優先權：¬ 先，最後做 ∧', 4.6, 6.5);
    cap('記得運算子有優先順序', 'not 先做，最後再做 and');
  },
  async (tok, S) => { // 516.1 不能光背
    bad('不能馬上背起來：要先說服自己', -4.6, 6.5);
    cap('不能只背', '一定要說服你自己它們確實一樣');
  },
  async (tok, S) => { // 525.5 唯一工具：真值表
    hd('目前唯一的證明工具：真值表', 0, 5.8);
    cap('目前沒有任何證明工具', '畫真值表就是證明這些基本等式的唯一工具');
  },
  async (tok, S) => { // 537.5 表格欄位
    S.T = TT(['p', 'q'], [['¬p', (e) => !e.p], ['¬q', (e) => !e.q], ['p ∨ q', (e) => e.p || e.q], ['¬(p∨q)', (e) => !(e.p || e.q)], ['¬p ∧ ¬q', (e) => !e.p && !e.q], ['兩欄 ↔', () => true]], { dx: 1.48, top: 4.6 });
    await S.T.col(tok, 0, 70); await S.T.col(tok, 1, 70);
    cap('兩個變數 p、q', '還要算 ¬p、¬q、p ∨ q…一個一個寫下來');
  },
  async (tok, S) => { // 582.6 ¬p
    S.T.hot(2); await S.T.col(tok, 2, 150);
    cap('not p', 'F、F、T、T');
  },
  async (tok, S) => { // 586.0 ¬q
    S.T.hot(2, false); S.T.hot(3); await S.T.col(tok, 3, 150);
    cap('not q', 'F、T、F、T');
  },
  async (tok, S) => { // 597.0 p ∨ q
    S.T.hot(3, false); S.T.hot(4); await S.T.col(tok, 4, 150);
    cap('p or q：只要有一個 true 就是 true', '最後一個是 false');
  },
  async (tok, S) => { // 605.2 ¬(p ∨ q)
    S.T.hot(4, false); S.T.hot(5); await S.T.col(tok, 5, 150);
    cap('對 p or q 做 NOT', 'true 變 false、false 變 true');
  },
  async (tok, S) => { // 616.0 ¬p ∧ ¬q
    S.T.hot(5, false); S.T.hot(6); await S.T.col(tok, 6, 150);
    cap('not p and not q', '只有兩個都 true 才 true，其他都 false');
  },
  async (tok, S) => { // 636.2 一模一樣
    S.T.hot(6, false); S.T.glowCol(5, OKG); S.T.glowCol(6, OKG); duo(S, { x: 6.6 }); await cheer(tok, S, true);
    cap('一模一樣，真的一模一樣', '');
  },
  async (tok, S) => { // 650.5 再做 ↔
    S.T.clear(); S.T.hot(7);
    cap('跟 tautology 的定義對一下', '再把兩欄做 biconditional');
  },
  async (tok, S) => { // 676.0 全 T → tautology
    await S.T.col(tok, 7, 220); S.T.glowCol(7, OKG); await cheer(tok, S, true);
    cap('兩個一樣時為真：每列都是 true', '確實是 tautology');
  },
  async (tok, S) => { // 718.5 這就是證明
    S.T.hot(7, false); good('這就是證明：畫完真值表，答案就對了', 0, 1.6);
    cap('叫你證明這個式子', '簡單：用真值表畫一畫');
  },
  async (tok, S) => { // 747.0 雙胞胎
    card('雙胞胎：¬(p ∧ q) ≡ ¬p ∨ ¬q', C.sky, 0, 0.8, 5.6, 0.6);
    cap('De Morgan 律其實有雙胞胎', 'and、or 全部換過去也是對的');
  },
]);
scene('lg-02-assoc', 'Lec02：結合律與交換律', CAMW, [
  async (tok, S) => { // 770.3 加減乘除更基本
    cap('做加減乘除時', '其實還有更基本的東西');
  },
  async (tok, S) => { // 800.6 結合律
    hot('Associative law 結合律', 0, 7.4);
    cap('叫做結合律', '');
  },
  async (tok, S) => { // 808.4 p ∧ q ∧ r 括號？
    S.f = card('p ∧ q ∧ r：括號為什麼可以不寫？', C.sand, 0, 6.7, 6.4, 0.6);
    cap('p and q and r，之前偷偷用了', '三個運算元、兩個運算子，為什麼不用寫括號？');
  },
  async (tok, S) => { // 835.7 左邊先做 = 右邊先做
    S.two = [card('(p ∧ q) ∧ r', C.sky, -3.0, 6.0, 3.2, 0.55), card('p ∧ (q ∧ r)', C.sky, 3.0, 6.0, 3.2, 0.55), hd('≡ ?', 0, 6.0)];
    cap('怎麼知道從左邊做', '跟從右邊做的答案一模一樣？');
  },
  async (tok, S) => { // 857.3 8 列大真值表
    gone(S.two); S.T = TT(['p', 'q', 'r'], [['(p∧q)∧r', (e) => e.p && e.q && e.r], ['p∧(q∧r)', (e) => e.p && e.q && e.r]], { dx: 2.0, top: 5.0, dy: 0.56 });
    for (let c = 0; c < 5; c++) await S.T.col(tok, c, 25);
    S.T.glowCol(3, OKG); S.T.glowCol(4, OKG);
    cap('畫一個很大很大的真值表：8 列', '會發現兩邊答案確實一模一樣：這就證明了結合律');
  },
  async (tok, S) => { // 871.6 交換律
    card('Commutative law 交換律：p ∧ q ≡ q ∧ p', C.mint, 0, 0.3, 7.0, 0.6); sm('像 1 + 2 = 2 + 1', 0, -0.35);
    cap('一樣有交換律', 'p and q 等於 q and p，就像 1 + 2 跟 2 + 1');
  },
  async (tok, S) => { // 897.0 雙胞胎
    card('∨ 也一樣：(p ∨ q) ∨ r ≡ p ∨ (q ∨ r)，p ∨ q ≡ q ∨ p', C.mint, 0, -1.1, 8.6, 0.6);
    cap('記得它也有雙胞胎', '背了一個等於背了兩個：or 也有結合律、交換律');
  },
  async (tok, S) => { // 920.6 直接寫 p ∨ q ∨ r
    sm('以後直接寫 p ∨ q ∨ r，不用囉嗦加括號', 0, -1.8);
    cap('以後麻煩不要這麼囉嗦', '可以直接寫成 p ∨ q ∨ r');
  },
]);
scene('lg-02-laws', 'Lec02：等價定律一覽', CAMW, [
  async (tok, S) => { // 932.0 熟悉基本公式
    hot('基本等價定律（證明都是畫真值表）', 0, 7.2);
    S.k = 0; S.L = [];
    S.add = (t) => { glowAll(S.L, null); const i = S.k++; const x = i < 5 || i > 9 ? -3.3 : 3.3, y = i > 9 ? 0.6 : 6.3 - (i % 5) * 1.12; const m = card(t, i % 2 ? C.sky : C.lilac, x, y, 6.2, 0.62); glow(m, HL); S.L.push(m); return m; };
    cap('先熟悉有哪些基本公式', '要你證明時，做法都是畫真值表');
  },
  async (tok, S) => { // 949.1 一大堆公式
    sm('（課本也有，抄一下）', 0, 6.7);
    cap('有一大堆公式', '課本也有，這邊還是抄一下');
  },
  async (tok, S) => { // 954.6 identity
    S.add('Identity：p ∧ T ≡ p，p ∨ F ≡ p');
    cap('Identity laws', '跟 T 做 and、跟 F 做 or');
  },
  async (tok, S) => { // 983.0 沒作用
    sm('跟 T 做 ∧、跟 F 做 ∨：沒有作用，答案永遠是 p', -3.3, 5.7);
    cap('不管你前面說什麼', '答案永遠是 p：都沒有作用');
  },
  async (tok, S) => { // 994.4 domination
    S.add('Domination：p ∨ T ≡ T，p ∧ F ≡ F');
    cap('跟一個真做 or：答案永遠為真', 'p 沒有用，T 主控一切：主控律');
  },
  async (tok, S) => { // 1037.0 idempotent
    S.add('Idempotent：p ∧ p ≡ p，p ∨ p ≡ p');
    cap('自己跟自己做 and，還是自己', '自己跟自己做 or，也等於自己');
  },
  async (tok, S) => { // 1048.0 double negation
    S.add('Double negation：¬(¬p) ≡ p');
    cap('Double negation', '負負得正：再做一次 not 變回自己');
  },
  async (tok, S) => { // 1061.1 commutative
    S.add('Commutative：p ∨ q ≡ q ∨ p，p ∧ q ≡ q ∧ p');
    cap('剛才講的交換律', '');
  },
  async (tok, S) => { // 1080.0 associative
    S.add('Associative：(p ∨ q) ∨ r ≡ p ∨ (q ∨ r)（∧ 也是）');
    cap('結合律', '同一類運算，先做哪個沒關係');
  },
  async (tok, S) => { // 1126.0 distributive ∧ 對 ∨
    S.add('Distributive：p ∧ (q ∨ r) ≡ (p ∧ q) ∨ (p ∧ r)');
    cap('比較複雜一點的分配律', '像 a × (b + c) = a × b + a × c');
  },
  async (tok, S) => { // 1160.7 ∨ 對 ∧ 也分配
    S.add('p ∨ (q ∧ r) ≡ (p ∨ q) ∧ (p ∨ r)');
    cap('and、or 地位差不多', 'or 對 and 也能分配：這是當初沒想到的');
  },
  async (tok, S) => { // 1202.0 De Morgan
    S.add('De Morgan：¬(p ∧ q) ≡ ¬p ∨ ¬q（∨ 也是）');
    cap('再來是 De Morgan', '');
  },
  async (tok, S) => { // 1231.0 not 分進去
    sm('¬ 分配進去，裡面 ∧ 變 ∨、∨ 變 ∧', 3.3, 0.85);
    cap('not 分配進去之後', '裡面的 and 變 or、or 變 and');
  },
  async (tok, S) => { // 1241.4 absorption
    S.add('Absorption：p ∨ (p ∧ q) ≡ p，p ∧ (p ∨ q) ≡ p');
    cap('吸收律', '這個比較沒什麼可以想的');
  },
  async (tok, S) => { // 1262.7 negation
    S.add('Negation：p ∨ ¬p ≡ T，p ∧ ¬p ≡ F');
    cap('Negation laws', '就是最早的例子：永遠為真、永遠為假');
  },
  async (tok, S) => { // 1287.6 記起來
    glowAll(S.L, null); good('麻煩把這些記起來：等一下推演會用到', 0, -0.6);
    cap('麻煩把這些記起來', '不管用聯想法還是什麼方法');
  },
]);
scene('lg-02-gen', 'Lec02：很多個 ∧、∨ 與廣義 De Morgan', CAM, [
  async (tok, S) => { // 1302.4 延伸
    hot('延伸：很多個串在一起', 0, 6.7);
    cap('最後一個延伸題', '');
  },
  async (tok, S) => { // 1317.0 p1 ∧ … ∧ pn
    card('p₁ ∧ p₂ ∧ … ∧ pₙ', C.sky, -3.0, 5.8, 4.2, 0.6); sm('結合律 → 不用寫括號', -3.0, 5.15);
    cap('p₁ 一直 and 到 pₙ', '因為結合律，都不用寫括號');
  },
  async (tok, S) => { // 1332.5 像 summation
    card('⋀ᵢ₌₁ⁿ pᵢ', C.lilac, 3.0, 5.8, 2.8, 0.7); sm('像高中的 Σ（summation）', 3.0, 5.1);
    cap('跟你們講一個以後會用到的符號', '像 summation，把很多 and 縮寫起來');
  },
  async (tok, S) => { // 1359.1 ∨ 也一樣
    card('p₁ ∨ p₂ ∨ … ∨ pₙ ＝ ⋁ᵢ₌₁ⁿ pᵢ', C.lilac, 0, 4.2, 6.4, 0.6);
    cap('同樣的，很多個 or 也可以連在一起', '必要時用大符號寫');
  },
  async (tok, S) => { // 1393.1 符號遊戲
    S.q = card('¬ ⋀ᵢ₌₁ⁿ pᵢ ≡ ?', C.peach, 0, 3.0, 3.6, 0.6);
    cap('玩一個符號的遊戲', 'not（全部 and 起來）應該等於多少？');
  },
  async (tok, S) => { // 1408.0 De Morgan
    relabel(S.q, '¬ ⋀ᵢ₌₁ⁿ pᵢ ≡ ⋁ᵢ₌₁ⁿ ¬pᵢ'); glow(S.q, OKG);
    S.ps = [1, 2, 3, 4].map((i) => buddy('¬p' + i, '', C.orange, -4.2 + (i - 1) * 2.8, 0, 1.2, 0.6));
    cap('De Morgan 原則一樣：not 分給每一個人', '每個都加 not，然後 and 變成 or');
  },
  async (tok, S) => { // 1420.0 另一方向
    card('¬ ⋁ᵢ₌₁ⁿ pᵢ ≡ ⋀ᵢ₌₁ⁿ ¬pᵢ', C.mint, 0, 2.0, 4.2, 0.6);
    cap('另一個方向一樣', 'not（全部 or）≡ 每個 not 再 and');
    for (const b of S.ps) await b.hop(tok);
  },
]);
scene('lg-02-cond', 'Lec02：→ 與 ↔ 的等價式（一定要背）', CAM, [
  async (tok, S) => { // 1452.1 條件運算子的等式
    hot('含 → 的等價式', -3.0, 6.7);
    cap('全部公式寫完了？還有條件運算子', '它也有等式');
  },
  async (tok, S) => { // 1474.0 p → q ≡ ¬q → ¬p
    S.a = card('p → q ≡ ¬q → ¬p', C.sky, -3.0, 5.9, 4.6, 0.6);
    cap('之前講過，麻煩記一下', 'p → q ≡ ¬q → ¬p');
  },
  async (tok, S) => { // 1497.2 p → q ≡ ¬p ∨ q
    S.b = card('p → q ≡ ¬p ∨ q', C.sky, -3.0, 5.1, 4.6, 0.6); glow(S.a, HL); glow(S.b, HL);
    cap('還有另外一個：¬p ∨ q', '這兩個是最基本的，一定要記');
  },
  async (tok, S) => { // 1518.0 還有一些奇怪的
    sm('還有一些比較少用的 → 看課本', -3.0, 4.45);
    cap('還有一些奇奇怪怪的', '比較少用到，其他去看課本');
  },
  async (tok, S) => { // 1561.0 考 60 分
    bad('想考 60 分：這兩個一定要記好', -3.0, 3.9);
    cap('我沒要每個人都考 90 分', '但要考 60 分，這兩個一定要記好');
  },
  async (tok, S) => { // 1588.0 biconditional
    hot('含 ↔ 的等價式', 3.0, 6.7);
    cap('再來：biconditional 相關的', '其實還蠻簡單的');
  },
  async (tok, S) => { // 1598.0 (p→q) ∧ (q→p)
    card('p ↔ q ≡ (p → q) ∧ (q → p)', C.mint, 3.0, 5.9, 5.4, 0.6);
    cap('根據定義', 'p 推 q，而且 q 推 p');
  },
  async (tok, S) => { // 1621.0 同真或同假
    card('p ↔ q ≡ (p ∧ q) ∨ (¬p ∧ ¬q)', C.mint, 3.0, 5.1, 5.4, 0.6);
    S.t = buddy('同真', 'T T', C.green, 1.6, 0, 1.2, 0.7); S.f = buddy('同假', 'F F', '#e0a37f', 4.4, 0, 1.2, 0.7);
    cap('兩個值要一樣：兩個都真，或兩個都假', '這兩個可能性用 or 起來');
    await S.t.hop(tok); await S.f.hop(tok);
  },
  async (tok, S) => { // 1701.0 畫真值表
    good('證明千篇一律：畫真值表', 0, 2.6);
    cap('該背的到這邊結束', '自己回去背；證明千篇一律：畫真值表');
  },
]);
scene('lg-02-alg1', 'Lec02：代數推演 ¬(p → q) ≡ p ∧ ¬q', CAM, [
  async (tok, S) => { // 1715.3 代數運算
    hot('代數運算：用公式化簡', 0, 6.7);
    cap('接下來教的是代數運算', '用這些公式來化簡');
  },
  async (tok, S) => { // 1735.2 每次都畫真值表？
    S.goal = card('證明：¬(p → q) ≡ p ∧ ¬q', C.sand, 0, 6.0, 5.6, 0.6);
    cap('像這種東西', '難道每次都要畫真值表嗎？');
  },
  async (tok, S) => { // 1756.0 方法一：真值表
    S.old = sm('方法一：真值表（太老了，再用就零分 😅）', 0, 5.35);
    cap('答案不是', '第一個方法還是真值表，但這個方法已經老了');
  },
  async (tok, S) => { // 1773.4 用公式推演
    S.ch = chain(-1.4, 4.4);
    S.ch.add('¬(p → q)', '原式');
    cap('試著用剛才背的公式來推演', '等於做恆等式的運算');
  },
  async (tok, S) => { // 1782.0 看到 → 先換掉
    gone(S.old); S.x = bad('最討厭 →、↔：看到就先換掉', 3.4, 5.35);
    cap('最討厭的就是 imply 跟 double condition', '看到二話不說，先把它換掉');
  },
  async (tok, S) => { // 1805.6 p → q ≡ ¬p ∨ q
    S.ch.add('¬(¬p ∨ q)', 'p → q ≡ ¬p ∨ q');
    cap('最好用的：p → q 換成 ¬p ∨ q', '換完就沒事了');
  },
  async (tok, S) => { // 1824.2 De Morgan
    S.ch.add('¬(¬p) ∧ ¬q', 'De Morgan');
    cap('括號外面一個 not → De Morgan', 'not 移進去，or 變成 and');
  },
  async (tok, S) => { // 1850.0 double negation
    S.ch.add('p ∧ ¬q', 'Double negation', C.mint);
    cap('接著：double negation，負負得正', '後面的不能動，就這樣');
  },
  async (tok, S) => { // 1862.5 這就是證明
    good('這就是證明：¬(p → q) ≡ p ∧ ¬q', 0, 0.5);
    cap('這就是我們的證明', '活用公式：朝著簡單的方向走');
  },
]);
scene('lg-02-alg2', 'Lec02：化簡 ¬(p ∨ (¬p ∧ q))', CAM, [
  async (tok, S) => { // 1882.3 抄原式、寫 ≡
    S.ch = chain(-1.6, 6.0, 0.86, 6.2);
    S.ch.add('¬(p ∨ (¬p ∧ q))', '原式');
    sm('每一步的等號一定要寫三槓 ≡', 3.4, 6.7);
    cap('第一個：一定要把式子抄一遍', '像國中「原式 =」，但等號要寫三槓');
  },
  async (tok, S) => { // 1895.6 從裡面或外面都可以
    bub('從裡面做或從外面做都可以', -3.9, 6.75);
    cap('你要怎麼做？', '先分進去好像反而變複雜：先從裡面做');
  },
  async (tok, S) => { // 1910.0 分配律
    S.ch.add('¬((p ∨ ¬p) ∧ (p ∨ q))', 'Distributive');
    cap('裡面這個形式是分配律', 'p 分給它：(p ∨ ¬p) ∧ (p ∨ q)');
  },
  async (tok, S) => { // 1930.2 p ∨ ¬p ≡ T
    S.ch.add('¬(T ∧ (p ∨ q))', 'Negation law');
    cap('p ∨ ¬p 是什麼？', '永遠為真：T；一次做一件事');
  },
  async (tok, S) => { // 1956.0 T ∧ … 沒用
    S.ch.add('¬(p ∨ q)', 'Identity law');
    cap('true 跟某個人做 and', '沒有用：把中括號拿掉');
  },
  async (tok, S) => { // 1969.4 De Morgan
    S.ch.add('¬p ∧ ¬q', 'De Morgan', C.mint);
    cap('最後 De Morgan', '¬(p ∨ q) ≡ ¬p ∧ ¬q');
  },
  async (tok, S) => { // 1984.3 定律名稱
    sm('T 沒有用：Identity law；最後一步：De Morgan', 3.4, 0.9);
    cap('T 沒有作用，叫 Identity law', '跟自己原來一樣');
  },
  async (tok, S) => { // 1994.0 大部分記得起來
    good('¬(p ∨ (¬p ∧ q)) ≡ ¬p ∧ ¬q', 0, 0.1);
    cap('大部分定律記得起來', '小部分特殊的，才稍微花點功夫');
  },
]);
scene('lg-02-alg3', 'Lec02：證明 (p ∧ q) → (p ∨ q) 是 tautology', CAM, [
  async (tok, S) => { // 1999.1 最複雜的例子
    hot('最後一個：比較複雜的例子', 0, 6.8);
    cap('最後做一個最複雜的例子', '1-2 到此結束');
  },
  async (tok, S) => { // 2010.0 tautology
    S.goal = card('證明 (p ∧ q) → (p ∨ q) 是 tautology', C.sand, 0, 6.1, 6.6, 0.6);
    cap('這個式子是一個 tautology', '');
  },
  async (tok, S) => { // 2014.4 不畫真值表，推到 T
    S.s2 = sm('以前：畫真值表全部為真；現在：一路推演到 T', 0, 5.45);
    cap('以前叫你畫真值表全部為真', '現在不畫：直接推演，最後答案是 true');
  },
  async (tok, S) => { // 2046.0 → 換掉
    S.ch = chain(-1.4, 4.6, 0.82, 6.4);
    S.ch.add('(p ∧ q) → (p ∨ q)', '原式'); await wt(tok, 300);
    S.ch.add('¬(p ∧ q) ∨ (p ∨ q)', 'p → q ≡ ¬p ∨ q');
    cap('第一個一樣：最討厭的 → 讓它變不見', 'not (p and q) or (p or q)');
  },
  async (tok, S) => { // 2061.2 De Morgan
    S.ch.add('(¬p ∨ ¬q) ∨ (p ∨ q)', 'De Morgan');
    cap('有人說 De Morgan', '把 not 分進去，and 變 or');
  },
  async (tok, S) => { // 2075.1 全部是 or → 括號拿掉
    S.ch.add('¬p ∨ ¬q ∨ p ∨ q', 'Associative');
    cap('有沒有看到很特別的？全部都是 or', '括號全部拿掉');
  },
  async (tok, S) => { // 2089.5 交換、結合
    S.ch.add('(¬p ∨ p) ∨ (¬q ∨ q)', 'Commutative、Associative');
    cap('交換律：同類放在一起', 'p 跟 ¬p 放一堆，q 跟 ¬q 放一堆');
  },
  async (tok, S) => { // 2104.6 ¬p ∨ p ≡ T
    S.ch.add('T ∨ T', 'Negation law');
    cap('自己跟自己的 not 做 or', '永遠為 true');
  },
  async (tok, S) => { // 2119.0 T
    S.ch.add('T', 'Domination', C.mint); S.b = buddy('真', 'T', C.green, 5.4, 0, 1.6, 0.8);
    cap('兩個 true 做 or 還是 true', '到這邊結束：它是 tautology'); S.b.mood('happy'); await S.b.hop(tok);
  },
  async (tok, S) => { // 2130.8 作業
    gone(S.s2); note('作業兩種程度：① 畫真值表證明基本定理 ② 用公式代數推演', 0, 5.45);
    cap('課本有很多習題', '真值表證明簡單題目；代數運算證明等式');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '離散數學・第 1 章',
    title: '邏輯與命題',
    color: 'var(--dm)',
    modes: [
      { id: 'tt', name: '真值表', enter: enterTT },
      { id: 'equiv', name: '等價檢查', enter: enterEq },
      { id: 'quant', name: '量詞積木', enter: enterQuant },
      { id: 'nested', name: '巢狀量詞', enter: enterNested },
      { id: 'infer', name: '推論規則', enter: enterInfer },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['course-map', 'prop-what', 'connectives', 'implication', 'conv-contra', 'biconditional', 'tautology', 'de-morgan', 'imp-or', 'equiv-laws', 'three-var',
      'predicate', 'forall-exists', 'quant-negation', 'nested-quant', 'modus-ponens', 'syllogism', 'fallacy', 'socrates'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
