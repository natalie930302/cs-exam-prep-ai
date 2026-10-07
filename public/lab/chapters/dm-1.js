// 離散數學 第1章：邏輯與命題（Propositional Logic、Predicate Logic、量詞、推論規則）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（真值表列順序 TT、TF、FT、FF；→ 是 implication）。
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
    on('qDom', () => { const pool = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; qm.dom = pool.sort(() => Math.random() - 0.5).slice(0, 6); clearLog(); enterQuant(); });
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
      const opts = [ans, ...badR.sort(() => Math.random() - 0.5).slice(0, 3).map(fmt)];
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
      const dom = pool.sort(() => Math.random() - 0.5).slice(0, 5).sort((a, b) => a - b);
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
    const n = 2 + Math.floor(Math.random() * 4);
    return { q: '含 ' + n + ' 個命題變數的複合命題，真值表共有幾列？', opts: [String(1 << n), String(2 * n), String(n * n), String((1 << n) - 1)], ans: String(1 << n), why: '每個變數 T/F 兩種，乘法原理 2^' + n + '。' };
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
      'predicate', 'forall-exists', 'quant-negation', 'nested-quant', 'modus-ponens', 'syllogism', 'fallacy', 'socrates'],
    stop() { stopTimer(); busy = false; },
  };
}
