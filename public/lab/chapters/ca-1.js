// 計算機組織 第1章：數字系統與運算（二進位／十六進位、2's complement、加減法與 overflow、
// ALU、乘法器、除法器、IEEE 754、浮點加法與捨入、CPU time、Amdahl's law）。
// 課本：Patterson & Hennessy, Computer Organization and Design (MIPS)，第 1、3 章與附錄 B/C。
// 本章影片目前都還沒有逐字稿，場景全部依課本例題（數字照課本），名稱標「課本」。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  let run = 0; // bumps on every mode (re)entry / stop, so stray hands-on animations end quietly
  const newRun = () => ({ my: ++run });
  async function W(tok, ms) {
    if (typeof tok === 'number') return beat(tok, ms);
    await sleep(ms);
    if (tok && tok.my !== run) throw new Error('stopped');
  }
  const go = (p) => p.catch(() => {});
  function fresh(pos, look) { run++; lab.clear(); controls(''); lab.frameCamera(pos, look); }
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
  const small = (l, px = 10) => { Object.assign(l.element.style, { fontSize: px + 'px', padding: '0 3px' }); return l; };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await W(tok, ms / steps); } }
  function line(pts, color = '#8a7a5c') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V3(...p))), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = v / 2; }); }

  // bits as a row of small cubes (index 0 = MSB, on the left)
  const BIT1 = '#4b9ee2', BIT0 = '#efe6d6';
  function bitRow(n, cx, y, z = 0, w = 0.6, colorFn, gaps = []) {
    const gapW = w * 0.45;
    const total = (n - 1) * w + gaps.length * gapW;
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(cx - total / 2 + i * w + gaps.filter((g) => g <= i).length * gapW);
    const ms = xs.map((x) => {
      const m = lab.box(BIT0, [w * 0.86, Math.min(0.62, w * 0.75), w * 0.86]);
      const l = small(lab.label('0', 'val'), w < 0.5 ? 10 : 12);
      m.add(l); m.userData.lbl = l;
      m.position.set(x, y, z); lab.world.add(m);
      return m;
    });
    const row = {
      ms, n, xs, y, z, bits: '0'.repeat(n),
      col: colorFn || ((i, b) => (b === '1' ? BIT1 : BIT0)),
      set(bits, flash) {
        bits.split('').forEach((b, i) => {
          const m = ms[i];
          const ch = row.bits[i] !== b;
          relabel(m, b); tint(m, row.col(i, b)); glow(m, flash && ch ? GOLD : null);
          if (flash && ch) { m.position.y = y + 0.5; move(m, xs[i], y, z); }
        });
        row.bits = bits;
      },
      clearGlow() { ms.forEach((m) => glow(m, null)); },
    };
    return row;
  }
  const bin = (v, n) => { const M = 2 ** n; return (((v % M) + M) % M).toString(2).padStart(n, '0'); };
  const sval = (b) => { const u = parseInt(b, 2); return b[0] === '1' ? u - 2 ** b.length : u; };
  const uval = (b) => parseInt(b, 2);
  const hexOf = (b) => b.match(/.{4}/g).map((q) => parseInt(q, 2).toString(16).toUpperCase()).join('');
  const grp = (b) => b.match(/.{1,4}/g).join(' ');
  const inv = (b) => b.split('').map((c) => (c === '1' ? '0' : '1')).join('');

  // ───────────────────────── 模式 1：進位與補數 ─────────────────────────
  const bs = { n: 8, bits: bin(173, 8) };
  function enterBits() {
    fresh([0, 5, 13.5], [0, 1.2, 0]);
    const n = bs.n, w = n === 8 ? 1.3 : 0.78;
    bs.row = bitRow(n, 0, 0.45, 0, w);
    bs.row.xs.forEach((x, i) => small(tag(i === 0 ? '−' + 2 ** (n - 1) : String(2 ** (n - 1 - i)), 'idx', x, 0, 1.1), n === 8 ? 11 : 9));
    bs.hex = [];
    for (let g = 0; g < n / 4; g++) bs.hex.push(tag('', 'ptr alt', (bs.row.xs[g * 4] + bs.row.xs[g * 4 + 3]) / 2, 0, 2.2));
    tag('權重（MSB 在 2\'s complement 是負的）', 'idx', 0, 0, 3.1);
    controls('<label>十進位 <input id="bD" type="number" value="' + sval(bs.bits) + '" style="width:80px"></label><button id="bSet">設定</button>'
      + '<label>hex <input id="bH" value="' + hexOf(bs.bits) + '" style="width:60px"></label><button id="bHex">設定 hex</button>'
      + '<button id="bInc">+1</button><button id="bShl">左移（×2）</button><button id="bSra">算術右移（÷2）</button>'
      + '<button class="primary" id="bNeg">取 2\'s 補數（−x）</button><select id="bN"><option value="8">8 bits</option><option value="16">16 bits</option></select>');
    $('bN').value = String(n);
    $('bN').onchange = (e) => { const nn = Number(e.target.value); const v = sval(bs.bits); bs.n = nn; bs.bits = bin(v, nn); enterBits(); };
    on('bSet', () => {
      const v = Math.round(Number($('bD').value));
      if (!isFinite(v) || v < -(2 ** (n - 1)) || v > 2 ** n - 1) { log(n + ' bits 只能放 −' + 2 ** (n - 1) + ' ～ ' + (2 ** n - 1) + '（負數用 2\'s complement，正數最大 ' + (2 ** n - 1) + ' 當 unsigned）', true); return; }
      setBits(bin(v, n), true); log(v + ' → ' + grp(bs.bits));
    });
    on('bHex', () => {
      const h = String($('bH').value).trim().replace(/^0x/i, '');
      if (!/^[0-9a-f]+$/i.test(h) || h.length > n / 4) { log('hex 要是 0–9、A–F，最多 ' + n / 4 + ' 位（每位 = 4 bits）', true); return; }
      setBits(parseInt(h, 16).toString(2).padStart(n, '0'), true); log('0x' + h.toUpperCase() + ' → 每個 hex 位數展開成 4 bits：' + grp(bs.bits));
    });
    on('bInc', () => { const u = (uval(bs.bits) + 1) % 2 ** n; if (u === 0) log('全部是 1 再 +1：進位跑出最左邊被丟掉，變回 0（unsigned 溢位 / signed −1 + 1 = 0）', true); else if (bs.bits === '0' + '1'.repeat(n - 1)) log('最大正數 +1 → 變成最小負數：signed overflow！', true); setBits(bin(u, n), true); });
    on('bShl', () => { const nb = bs.bits.slice(1) + '0'; if (bs.bits[0] !== nb[0]) log('左移後 sign bit 變了：signed 的結果溢位（×2 超出範圍）', true); setBits(nb, true); log('sll 1：所有 bit 往左一格，右邊補 0 → ×2'); });
    on('bSra', () => { setBits(bs.bits[0] + bs.bits.slice(0, -1), true); log('sra 1：往右一格，左邊補 sign bit（負數維持負數）→ ÷2 向 −∞ 取整'); });
    on('bNeg', () => go(negate(newRun())));
    show();
    log('8 bits 的權重：MSB 在 unsigned 是 +128，在 2\'s complement 是 −128。');
  }
  function setBits(b, flash) { bs.bits = b; bs.row.set(b, flash); show(); }
  function show() {
    if (!bs.row.ms[0].userData.lbl || bs.row.bits !== bs.bits) bs.row.set(bs.bits);
    hexOf(bs.bits).split('').forEach((h, g) => txt(bs.hex[g], h));
    const s = sval(bs.bits), u = uval(bs.bits);
    setState(bs.n + ' bits', [['二進位', grp(bs.bits)], ['hex', '0x' + hexOf(bs.bits)], ['unsigned', String(u)], ['2\'s complement', String(s)]],
      '範圍：unsigned 0 ～ ' + (2 ** bs.n - 1) + '；signed −' + 2 ** (bs.n - 1) + ' ～ ' + (2 ** (bs.n - 1) - 1) + (s < 0 ? '<br>MSB = 1 → <span class="no">負數</span>：−' + 2 ** (bs.n - 1) + ' + ' + (u - 2 ** (bs.n - 1)) + ' = ' + s : ''));
  }
  async function negate(t) {
    const n = bs.n, before = sval(bs.bits);
    setBits(inv(bs.bits), true); log('步驟 1：每個 bit 反相 → ' + grp(bs.bits) + '（這是 1\'s complement）');
    await W(t, 900);
    setBits(bin(uval(bs.bits) + 1, n), true); log('步驟 2：再 +1 → ' + grp(bs.bits) + ' = ' + sval(bs.bits));
    if (before === -(2 ** (n - 1))) log('−' + 2 ** (n - 1) + ' 取補數還是自己：+' + 2 ** (n - 1) + ' 放不進 ' + n + ' bits', true);
  }

  // ───────────────────────── 模式 2：加減法與 overflow ─────────────────────────
  function buildAdd(A, B, op, n = 8) {
    const w = 1.05, cx = 0.9;
    const b0 = bin(B, n);
    const st = { n, A, B, op, a: bin(A, n), b: op === '-' ? inv(b0) : b0, cin: op === '-' ? 1 : 0, cubes: [] };
    st.rowA = bitRow(n, cx, 3.4, 0, w); st.rowA.set(st.a);
    st.rowB = bitRow(n, cx, 2.3, 0, w); st.rowB.set(st.b);
    st.xs = st.rowA.xs;
    const lx = st.xs[0] - 1.6;
    tag('carry', 'idx', lx, 4.5); tag('A = ' + A, 'ptr', lx - 0.4, 3.4);
    tag(op === '-' ? '¬B（B = ' + B + '）' : 'B = ' + B, 'ptr', lx - 0.4, 2.3);
    tag(op === '-' ? 'A − B' : 'A + B', 'ptr alt', lx - 0.4, 0.4);
    line([[st.xs[0] - 0.6, 1.45, 0], [st.xs[n - 1] + 0.6, 1.45, 0]], '#6e5f49');
    st.sum = [];
    return st;
  }
  async function animateAdd(st, tok, pace, talk) {
    const n = st.n;
    let c = st.cin, cinMSB = 0;
    const cy = 4.5;
    if (c) { st.cubes.push(cube('1', '#c08a1f', [0.55, 0.45, 0.55], st.xs[n - 1], cy, 0, 2)); if (talk) say('減法：A + ¬B + 1', 'carry-in = 1 就是那個「+1」'); await W(tok, pace); }
    const sb = [];
    for (let i = n - 1; i >= 0; i--) {
      const ai = +st.a[i], bi = +st.b[i];
      const s = ai ^ bi ^ c, co = (ai & bi) | (ai & c) | (bi & c);
      if (i === 0) cinMSB = c;
      glow(st.rowA.ms[i], GOLD); glow(st.rowB.ms[i], GOLD);
      st.sum.push(cube(String(s), s ? '#2fc092' : BIT0, [0.9, 0.6, 0.9], st.xs[i], 0.4, 0, 2.5));
      sb.unshift(String(s));
      if (talk) say('bit ' + (n - 1 - i) + '：' + ai + ' + ' + bi + ' + ' + c + ' = ' + (ai + bi + c), '寫 ' + s + '，進位 ' + co);
      else log('bit ' + (n - 1 - i) + '：' + ai + ' + ' + bi + ' + carry ' + c + ' → sum ' + s + '，carry ' + co);
      c = co;
      if (co) {
        const x = i > 0 ? st.xs[i - 1] : st.xs[0] - 1.1;
        const m = cube('1', i > 0 ? '#c08a1f' : '#d64545', [0.55, 0.45, 0.55], st.xs[i], cy, 0);
        move(m, x, cy, 0); st.cubes.push(m);
      }
      await W(tok, pace);
      glow(st.rowA.ms[i], null); glow(st.rowB.ms[i], null);
    }
    const bits = sb.join('');
    return { bits, cout: c, cinMSB, ovf: (cinMSB ^ c) === 1 };
  }
  const as = { A: 100, B: 50, op: '+' };
  function enterAdd() {
    fresh([0, 3.4, 14], [0, 2.3, 0]);
    controls('<label>A <input id="aA" type="number" value="' + as.A + '" style="width:70px"></label><select id="aOp"><option value="+">+</option><option value="-">−</option></select>'
      + '<label>B <input id="aB" type="number" value="' + as.B + '" style="width:70px"></label><button class="primary" id="aRun">逐位相加</button>'
      + '<button id="aEx1">7 + 6</button><button id="aEx2">7 − 6</button><button id="aEx3">100 + 50</button><button id="aEx4">−100 − 50</button>');
    $('aOp').value = as.op;
    const runIt = () => {
      const A = Math.round(Number($('aA').value)), B = Math.round(Number($('aB').value));
      if (!(A >= -128 && A <= 127 && B >= -128 && B <= 127)) { log('8-bit 2\'s complement 只能放 −128 ～ 127，A、B 都要在範圍內', true); return; }
      as.A = A; as.B = B; as.op = $('aOp').value;
      enterAdd(); go(doAdd(newRun()));
    };
    on('aRun', runIt);
    const ex = (A, op, B) => () => { $('aA').value = A; $('aB').value = B; $('aOp').value = op; runIt(); };
    on('aEx1', ex(7, '+', 6)); on('aEx2', ex(7, '-', 6)); on('aEx3', ex(100, '+', 50)); on('aEx4', ex(-100, '-', 50));
    as.st = buildAdd(as.A, as.B, as.op);
    setState('8-bit 加減法', [['A', as.A + ' = ' + grp(bin(as.A, 8))], ['B', as.B + ' = ' + grp(bin(as.B, 8))], ['運算', as.op === '-' ? 'A + ¬B + 1' : 'A + B']], '按「逐位相加」，carry 從最右邊一路傳到左邊（ripple）');
  }
  async function doAdd(t) {
    const st = as.st;
    const r = await animateAdd(st, t, 550, false);
    const val = sval(r.bits), real = as.op === '-' ? as.A - as.B : as.A + as.B;
    log('結果 ' + grp(r.bits) + ' = ' + val + '；carry out = ' + r.cout + (as.op === '-' ? '（減法的 carry out 直接丟掉）' : ''));
    if (r.ovf) log('進 MSB 的 carry（' + r.cinMSB + '）≠ 出 MSB 的 carry（' + r.cout + '）→ overflow：真正答案 ' + real + ' 放不進 8 bits', true);
    setState('8-bit 加減法', [['A', as.A], ['B', as.B], ['結果 bits', grp(r.bits)], ['當 signed 看', String(val)], ['carry in/out of MSB', r.cinMSB + ' / ' + r.cout]],
      r.ovf ? '<span class="no">Overflow</span>：真正的答案是 ' + real + '（超出 −128 ～ 127）<br>正 + 正 → 負，或 負 + 負 → 正' : '<span class="ok">沒有 overflow</span>：' + (as.op === '-' ? as.A + ' − ' + as.B : as.A + ' + ' + as.B) + ' = ' + val);
  }

  // ───────────────────────── 模式 3／4：乘法器、除法器（課本流程圖逐步） ─────────────────────────
  function multV1(md, mr) {
    let Md = md, Mr = mr, P = 0; const S = [];
    const snap = (note, chg, it) => S.push({ r: { Multiplicand: bin(Md, 8), Multiplier: bin(Mr, 4), Product: bin(P, 8) }, note, chg, it });
    snap('初始：Product = 0', [], 0);
    for (let i = 1; i <= 4; i++) {
      if (Mr & 1) { P = (P + Md) & 0xff; snap('1a. 1 ⇒ Prod = Prod + Mcand', ['Product'], i); }
      else snap('1. 0 ⇒ No operation', [], i);
      Md = (Md << 1) & 0xff; snap('2. Shift left Mcand', ['Multiplicand'], i);
      Mr >>= 1; snap('3. Shift right Mplier', ['Multiplier'], i);
    }
    return S;
  }
  function multV2(md, mr) {
    let P = mr & 0xf; const S = [];
    const snap = (note, chg, it) => S.push({ r: { Multiplicand: bin(md, 4), Product: bin(P, 8) }, note, chg, it });
    snap('初始：Product 右半放 Multiplier，左半 0', [], 0);
    for (let i = 1; i <= 4; i++) {
      let carry = 0;
      if (P & 1) { const left = (P >> 4) + md; carry = left >> 4; P = ((left & 0xf) << 4) | (P & 0xf); snap('1a. 1 ⇒ 左半 += Mcand' + (carry ? '（有進位）' : ''), ['Product'], i); }
      else snap('1. 0 ⇒ No operation', [], i);
      P = (P >> 1) | (carry << 7); snap('2. Shift right Product', ['Product'], i);
    }
    return S;
  }
  function booth(m, q) {
    let A = 0, Q = q & 0xf, Q1 = 0; const M = m & 0xf; const S = [];
    const snap = (note, chg, it) => S.push({ r: { M: bin(M, 4), A: bin(A, 4), Q: bin(Q, 4), 'Q₋₁': String(Q1) }, note, chg, it });
    snap('初始：A = 0，Q = 乘數，Q₋₁ = 0', [], 0);
    for (let i = 1; i <= 4; i++) {
      const pair = (Q & 1) + '' + Q1;
      if (pair === '10') { A = (A - M) & 0xf; snap('10 ⇒ A = A − M', ['A'], i); }
      else if (pair === '01') { A = (A + M) & 0xf; snap('01 ⇒ A = A + M', ['A'], i); }
      else snap(pair + ' ⇒ No operation', [], i);
      Q1 = Q & 1; Q = ((Q >> 1) | ((A & 1) << 3)) & 0xf; A = ((A >> 1) | (A & 8)) & 0xf;
      snap('A、Q、Q₋₁ 算術右移 1', ['A', 'Q', 'Q₋₁'], i);
    }
    return S;
  }
  function divV1(dd, dv) {
    let Div = (dv << 4) & 0xff, Rem = dd & 0xff, Q = 0; const S = [];
    const snap = (note, chg, it, neg) => S.push({ r: { Divisor: bin(Div, 8), Remainder: bin(Rem, 8), Quotient: bin(Q, 4) }, note, chg, it, neg });
    snap('初始：Divisor 放左半，Remainder = 被除數', [], 0);
    for (let i = 1; i <= 5; i++) {
      const r = Rem - Div;
      Rem = r & 0xff; snap('1. Rem = Rem − Div' + (r < 0 ? '（< 0）' : '（≥ 0）'), ['Remainder'], i, r < 0);
      if (r < 0) { Rem = (Rem + Div) & 0xff; Q = (Q << 1) & 0xf; snap('2b. Rem < 0 ⇒ +Div，sll Q，Q₀ = 0', ['Remainder', 'Quotient'], i); }
      else { Q = ((Q << 1) | 1) & 0xf; snap('2a. Rem ≥ 0 ⇒ sll Q，Q₀ = 1', ['Quotient'], i); }
      Div >>= 1; snap('3. Shift Div right', ['Divisor'], i);
    }
    return S;
  }
  const ALGS = {
    v1: { name: '乘法器第一版（課本）', rows: [['Multiplicand', 8], ['Multiplier', 4], ['Product', 8]], gen: multV1, signed: false, iters: 4, a: 'Multiplicand', b: 'Multiplier', res: (s) => 'Product = ' + uval(s.r.Product) },
    v2: { name: '乘法器改良版（Product 右半放 Multiplier）', rows: [['Multiplicand', 4], ['Product', 8]], gen: multV2, signed: false, iters: 4, a: 'Multiplicand', b: 'Multiplier', res: (s) => 'Product = ' + uval(s.r.Product) },
    booth: { name: 'Booth 演算法（補充：signed）', rows: [['M', 4], ['A', 4], ['Q', 4], ['Q₋₁', 1]], gen: booth, signed: true, iters: 4, a: 'M（被乘數）', b: 'Q（乘數）', res: (s) => 'A:Q = ' + sval(s.r.A + s.r.Q) },
    div: { name: '除法器第一版（restoring，課本）', rows: [['Divisor', 8], ['Remainder', 8], ['Quotient', 4]], gen: divV1, signed: false, iters: 5, a: '被除數', b: '除數', res: (s) => 'Quotient = ' + uval(s.r.Quotient) + '，Remainder = ' + uval(s.r.Remainder) },
  };
  function buildRegs(alg) {
    const A = ALGS[alg];
    const R = {};
    const w = 0.66, cx = 1.2;
    A.rows.forEach(([name, n], k) => {
      const y = 4.4 - k * (A.rows.length > 3 ? 1.15 : 1.5);
      const row = bitRow(n, cx + (n < 8 ? (8 - n) * w / 2 : 0), y, 0, w); // narrow registers right-aligned
      tag(name, 'ptr', -4.6, y);
      const vt = tag('', 'idx', 5.0, y);
      R[name] = { row, vt, n };
    });
    R.it = tag('', 'ptr alt', -4.6, 6.0);
    return R;
  }
  function showStep(R, alg, s, flash) {
    const A = ALGS[alg];
    for (const [name] of A.rows) {
      const r = R[name];
      r.row.set(s.r[name], flash);
      if (flash && (s.chg || []).includes(name)) r.row.ms.forEach((m) => glow(m, s.neg && name === 'Remainder' ? RED : GOLD));
      else r.row.clearGlow();
      const b = s.r[name];
      txt(r.vt, b.length === 1 ? '' : '= ' + (A.signed || (name === 'Remainder' && s.neg) ? sval(b) : uval(b)));
    }
    txt(R.it, s.it ? '第 ' + s.it + ' 輪 / 共 ' + A.iters + ' 輪' : '開始');
  }
  async function playSteps(tok, alg, a, b, pace, talk) {
    const A = ALGS[alg];
    const R = buildRegs(alg);
    const S = A.gen(a, b);
    showStep(R, alg, S[0], false);
    if (talk) say(A.name, alg === 'div' ? a + ' ÷ ' + b : a + ' × ' + b);
    await W(tok, pace * 1.6);
    for (let k = 1; k < S.length; k++) {
      showStep(R, alg, S[k], true);
      if (talk) say('第 ' + S[k].it + ' 輪：' + S[k].note, Object.entries(S[k].r).map(([n, v]) => n + ' ' + grp(v)).join('　'));
      await W(tok, pace);
    }
    return S[S.length - 1];
  }
  const ms_ = { alg: 'v1', a: 2, b: 3, k: 0 };
  function enterMult(divMode) {
    fresh([0, 3.2, 13.5], [0, 2.6, 0]);
    if (divMode) { if (ms_.alg !== 'div') { ms_.alg = 'div'; ms_.a = 7; ms_.b = 2; } }
    else if (ms_.alg === 'div') { ms_.alg = 'v1'; ms_.a = 2; ms_.b = 3; }
    const A = ALGS[ms_.alg];
    controls((divMode ? '' : '<select id="mAlg"><option value="v1">第一版</option><option value="v2">改良版</option><option value="booth">Booth（signed）</option></select>')
      + '<label>' + A.a + ' <input id="mA" type="number" value="' + ms_.a + '" style="width:60px"></label>'
      + '<label>' + A.b + ' <input id="mB" type="number" value="' + ms_.b + '" style="width:60px"></label>'
      + '<button id="mSet">重來</button><button class="primary" id="mStep">下一步</button><button id="mAuto">自動跑完</button>');
    if (!divMode) { $('mAlg').value = ms_.alg; $('mAlg').onchange = (e) => { ms_.alg = e.target.value; if (e.target.value === 'booth') { ms_.a = 2; ms_.b = -3; } else { ms_.a = 2; ms_.b = 3; } enterMult(false); }; }
    ms_.R = buildRegs(ms_.alg);
    ms_.S = A.gen(ms_.a, ms_.b); ms_.k = 0;
    showStep(ms_.R, ms_.alg, ms_.S[0], false);
    const lo = A.signed ? -8 : (divMode ? 0 : 0), hi = A.signed ? 7 : 15;
    on('mSet', () => {
      const a = Math.round(Number($('mA').value)), b = Math.round(Number($('mB').value));
      if (!(a >= lo && a <= hi && b >= lo && b <= hi)) { log('4-bit ' + (A.signed ? 'signed：−8 ～ 7' : 'unsigned：0 ～ 15') + '，兩個數都要在範圍內', true); return; }
      if (divMode && b === 0) { log('除數不能是 0', true); return; }
      ms_.a = a; ms_.b = b; enterMult(divMode);
    });
    const step = () => {
      if (ms_.k >= ms_.S.length - 1) { log('已經做完 ' + A.iters + ' 輪：' + A.res(ms_.S[ms_.S.length - 1]) + '。按「重來」換數字。', true); return false; }
      ms_.k++;
      const s = ms_.S[ms_.k];
      showStep(ms_.R, ms_.alg, s, true);
      log('第 ' + s.it + ' 輪：' + s.note);
      upd();
      return true;
    };
    on('mStep', step);
    on('mAuto', () => go((async (t) => { while (step()) await W(t, 700); })(newRun())));
    const upd = () => {
      const s = ms_.S[ms_.k];
      setState(A.name, [['輸入', divMode ? ms_.a + ' ÷ ' + ms_.b : ms_.a + ' × ' + ms_.b], ['步驟', ms_.k + ' / ' + (ms_.S.length - 1)], ...Object.entries(s.r).map(([n, v]) => [n, grp(v)])],
        ms_.k === ms_.S.length - 1 ? '<span class="ok">完成</span>：' + A.res(s) : (divMode ? '每輪：減 → 看正負 → 還原或補 1 → Divisor 右移；n bits 要做 n + 1 輪' : ms_.alg === 'booth' ? '看 Q₀Q₋₁：10 減、01 加、00/11 不動，再算術右移' : '每輪：看最低位決定加不加 → 移位；n bits 做 n 輪'));
    };
    upd();
    log(A.name + '：按「下一步」一步一步看暫存器怎麼變。');
    log('縮寫照課本流程圖：Mcand = Multiplicand、Mplier = Multiplier、Prod = Product、Rem = Remainder、Div = Divisor、Q = Quotient。');
  }

  // ───────────────────────── 模式 5：IEEE 754 ─────────────────────────
  const fcol = (i, b) => (i === 0 ? (b === '1' ? '#d64545' : '#f2c4c4') : i <= 8 ? (b === '1' ? '#4b9ee2' : '#c6def5') : (b === '1' ? '#2fc092' : '#c2ecdc'));
  const f2u = (x) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x); return dv.getUint32(0); };
  const u2f = (u) => { const dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, u >>> 0); return dv.getFloat32(0); };
  const fbits = (x) => f2u(x).toString(2).padStart(32, '0');
  function classify(b) {
    const e = uval(b.slice(1, 9)), f = uval(b.slice(9));
    if (e === 255) return f ? 'NaN' : (b[0] === '1' ? '−∞' : '+∞');
    if (e === 0) return f ? 'denormalized' : (b[0] === '1' ? '−0' : '+0');
    return 'normalized';
  }
  function floatRow(y = 0.4) {
    const r = bitRow(32, 0, y, 0, 0.38, fcol, [1, 9]);
    tag('S', 'ptr', r.xs[0], 0, 1.0); tag('exponent（8）', 'ptr', (r.xs[1] + r.xs[8]) / 2, 0, 1.0); tag('fraction（23）', 'ptr', (r.xs[9] + r.xs[31]) / 2, 0, 1.0);
    return r;
  }
  function decodeText(b) {
    const s = b[0], e = uval(b.slice(1, 9)), f = b.slice(9);
    const fv = uval(f) / 2 ** 23;
    const c = classify(b);
    if (c === 'normalized') return '(−1)^' + s + ' × 1.' + (f.replace(/0+$/, '') || '0') + '₂ × 2^(' + e + '−127) = ' + (s === '1' ? '−' : '') + (1 + fv) + ' × 2^' + (e - 127);
    if (c === 'denormalized') return '(−1)^' + s + ' × 0.' + (f.replace(/0+$/, '') || '0') + '₂ × 2^−126（沒有隱藏的 1）';
    return c;
  }
  const fs = { x: -0.75 };
  function enterFloat() {
    fresh([0, 4.2, 13.5], [0, 1.0, 0]);
    fs.row = floatRow();
    fs.ev = tag('', 'ptr alt', (fs.row.xs[1] + fs.row.xs[8]) / 2, 0, 2.0);
    fs.sv = tag('', 'ptr alt', fs.row.xs[0], 0, 2.0);
    fs.fv = tag('', 'ptr alt', (fs.row.xs[9] + fs.row.xs[31]) / 2, 0, 2.0);
    controls('<label>十進位 <input id="fX" value="' + fs.x + '" style="width:110px"></label><button class="primary" id="fEnc">編碼</button>'
      + '<label>hex <input id="fH" value="" style="width:90px"></label><button id="fDec">解碼</button>'
      + '<select id="fPre"><option value="">課本 / 特殊值…</option><option>-0.75</option><option>-5</option><option>0.1</option><option>1</option><option>0</option><option>-0</option><option>1e-40</option><option>3.4e38</option><option>Infinity</option><option>NaN</option></select>');
    on('fEnc', () => {
      const raw = String($('fX').value).trim();
      const x = raw === 'NaN' ? NaN : Number(raw);
      if (raw === '' || (isNaN(x) && raw !== 'NaN')) { log('請輸入一個數字（可以用 1e-40、Infinity、NaN）', true); return; }
      setFloat(x, true);
    });
    on('fDec', () => {
      const h = String($('fH').value).trim().replace(/^0x/i, '');
      if (!/^[0-9a-f]{1,8}$/i.test(h)) { log('hex 要 1–8 位 0–9 / A–F（32 bits = 8 個 hex 位數）', true); return; }
      setFloat(u2f(parseInt(h, 16)), true, parseInt(h, 16).toString(2).padStart(32, '0'));
    });
    $('fPre').onchange = (e) => { if (!e.target.value) return; $('fX').value = e.target.value; setFloat(e.target.value === 'NaN' ? NaN : Number(e.target.value), true); };
    setFloat(fs.x, false);
    log('single precision：1 bit sign + 8 bits exponent（bias 127）+ 23 bits fraction；值 = (−1)^S × 1.F × 2^(E−127)。');
  }
  function setFloat(x, flash, bitsOverride) {
    fs.x = x;
    const b = bitsOverride || fbits(x);
    fs.row.set(b, flash);
    const e = uval(b.slice(1, 9)), c = classify(b);
    txt(fs.sv, b[0] === '1' ? '負' : '正');
    txt(fs.ev, 'E = ' + e + (c === 'normalized' ? '（實際指數 ' + (e - 127) + '）' : e === 0 ? '（全 0）' : '（全 1）'));
    txt(fs.fv, c === 'normalized' ? '1.F（隱藏 1）' : c === 'denormalized' ? '0.F（沒有隱藏 1）' : c);
    $('fH').value = hexOf(b);
    const stored = u2f(uval(b));
    const exact = Object.is(stored, x) || (isNaN(stored) && isNaN(x));
    setState('IEEE 754 single', [['輸入', String(x)], ['類別', c], ['S / E / F', b[0] + ' / ' + b.slice(1, 9) + ' / ' + b.slice(9, 15) + '…'], ['hex', '0x' + hexOf(b)], ['實際存的值', String(stored)]],
      decodeText(b) + (exact ? '' : '<br><span class="no">存不剛好</span>：23 bits 放不下，四捨五入（round to nearest even）'));
    log(x + ' → ' + b[0] + ' ' + b.slice(1, 9) + ' ' + b.slice(9) + ' = 0x' + hexOf(b) + '（' + c + '）');
  }

  // ───────────────────────── 模式 6：效能公式 ─────────────────────────
  const pf = { kind: 'cpu', IC: 10, CPI: 2, GHz: 2, f: 80, s: 4 };
  function enterPerf() {
    fresh([0, 4.5, 14], [0, 3, 0]);
    controls('<select id="pK"><option value="cpu">CPU time = IC × CPI × Tc</option><option value="amdahl">Amdahl\'s law</option></select>'
      + (pf.kind === 'cpu'
        ? '<label>IC（×10⁹）<input id="pIC" type="number" step="0.5" value="' + pf.IC + '" style="width:60px"></label><label>CPI <input id="pCPI" type="number" step="0.1" value="' + pf.CPI + '" style="width:60px"></label><label>clock rate（GHz）<input id="pG" type="number" step="0.5" value="' + pf.GHz + '" style="width:60px"></label>'
        : '<label>被改善的比例 <input id="pF" type="range" min="0" max="100" value="' + pf.f + '" style="width:120px"></label><b id="pFv"></b><label>那部分加速 <input id="pS" type="range" min="1" max="64" value="' + pf.s + '" style="width:120px"></label><b id="pSv"></b>'));
    $('pK').value = pf.kind;
    $('pK').onchange = (e) => { pf.kind = e.target.value; enterPerf(); };
    if (pf.kind === 'cpu') {
      pf.bars = [bar('#4b9ee2', 1.4, 1.4, -4.5, 0), bar('#9b7ef4', 1.4, 1.4, -1.5, 0), bar('#dd8238', 1.4, 1.4, 1.5, 0), bar('#2fc092', 1.8, 1.8, 4.8, 0)];
      pf.tl = ['IC', 'CPI', 'Tc', 'CPU time'].map((t, i) => tag(t, 'ptr', [-4.5, -1.5, 1.5, 4.8][i], 0, 1.6));
      pf.vl = [0, 1, 2, 3].map((i) => tag('', 'idx', [-4.5, -1.5, 1.5, 4.8][i], 1));
      tag('×', 'val', -3, 1); tag('×', 'val', 0, 1); tag('=', 'val', 3.1, 1);
      ['pIC', 'pCPI', 'pG'].forEach((id) => { $(id).oninput = updPerf; });
      log('CPU time = 指令數 × 每個指令平均幾個 cycle × 每個 cycle 多久 = IC × CPI ÷ clock rate。');
    } else {
      pf.old1 = bar('#9b7ef4', 2, 1.6, -3, 0); pf.old2 = bar('#c9b48e', 2, 1.6, -3, 0);
      pf.new1 = bar('#9b7ef4', 2, 1.6, 3, 0); pf.new2 = bar('#c9b48e', 2, 1.6, 3, 0);
      tag('改善前', 'ptr', -3, 0, 1.5); tag('改善後', 'ptr alt', 3, 0, 1.5);
      pf.al = [tag('', 'idx', -5.2, 1), tag('', 'idx', -5.2, 3), tag('', 'idx', 5.2, 1), tag('', 'idx', 5.2, 3)];
      $('pF').oninput = updPerf; $('pS').oninput = updPerf;
      log('Amdahl\'s law：T_new = T_unaffected + T_affected ÷ 改善倍數。沒被改善的部分決定了上限。');
    }
    updPerf();
  }
  function setBar(m, h, base = 0) { m.scale.y = Math.max(0.001, h); m.position.y = base + h / 2; }
  function updPerf() {
    if (pf.kind === 'cpu') {
      pf.IC = Math.max(0.1, Number($('pIC').value) || 1); pf.CPI = Math.max(0.1, Number($('pCPI').value) || 1); pf.GHz = Math.max(0.1, Number($('pG').value) || 1);
      const Tc = 1 / pf.GHz, T = pf.IC * pf.CPI * Tc;
      [pf.IC / 3, pf.CPI * 1.5, Tc * 3, T / 3].forEach((h, i) => { setBar(pf.bars[i], Math.min(6.5, h)); pf.vl[i].position.y = Math.min(6.5, h) + 0.5; });
      txt(pf.vl[0], pf.IC + '×10⁹'); txt(pf.vl[1], String(pf.CPI)); txt(pf.vl[2], (+Tc.toFixed(3)) + ' ns'); txt(pf.vl[3], (+T.toFixed(3)) + ' s');
      setState('CPU time', [['Instruction count', pf.IC + ' × 10⁹'], ['CPI', String(pf.CPI)], ['Clock cycle time', (+Tc.toFixed(4)) + ' ns（' + pf.GHz + ' GHz）'], ['Clock cycles', (+(pf.IC * pf.CPI).toFixed(3)) + ' × 10⁹']],
        'CPU time = ' + pf.IC + '×10⁹ × ' + pf.CPI + ' × ' + (+Tc.toFixed(4)) + ' ns = <span class="ok">' + (+T.toFixed(4)) + ' s</span>');
    } else {
      pf.f = Number($('pF').value); pf.s = Number($('pS').value);
      $('pFv').textContent = pf.f + '%'; $('pSv').textContent = pf.s + '×';
      const H = 6, a = pf.f / 100, u = 1 - a, nw = u + a / pf.s;
      setBar(pf.old2, u * H); setBar(pf.old1, a * H, u * H);
      setBar(pf.new2, u * H); setBar(pf.new1, a / pf.s * H, u * H);
      txt(pf.al[0], '沒改善 ' + (+(u * 100).toFixed(1)) + '%'); pf.al[0].position.y = u * H / 2;
      txt(pf.al[1], '可改善 ' + pf.f + '%'); pf.al[1].position.y = u * H + a * H / 2;
      txt(pf.al[2], '還是 ' + (+(u * 100).toFixed(1)) + '%'); pf.al[2].position.y = u * H / 2;
      txt(pf.al[3], '÷' + pf.s + ' = ' + (+(a / pf.s * 100).toFixed(2)) + '%'); pf.al[3].position.y = u * H + a / pf.s * H / 2 + 0.3;
      const sp = 1 / nw, lim = u > 0 ? 1 / u : Infinity;
      setState('Amdahl\'s law', [['可改善比例 f', pf.f + '%'], ['那部分加速 s', pf.s + '×'], ['整體 speedup', (+sp.toFixed(3)) + '×'], ['s → ∞ 的上限', isFinite(lim) ? (+lim.toFixed(2)) + '×' : '∞']],
        'Speedup = 1 / ((1 − f) + f / s) = 1 / (' + (+u.toFixed(2)) + ' + ' + (+(a / pf.s).toFixed(3)) + ') = <span class="ok">' + (+sp.toFixed(3)) + '</span>');
    }
  }

  // ───────────────────────── 場景（課本例題） ─────────────────────────
  async function scBinHex(tok) {
    fresh([0, 5, 13.5], [0, 1.2, 0]);
    const row = bitRow(8, 0, 0.45, 0, 1.3);
    row.xs.forEach((x, i) => tag(String(2 ** (7 - i)), 'idx', x, 0, 1.1));
    say('十進位 173 → 二進位', '從最大的權重 128 開始拆');
    await beat(tok, 2000);
    let rem = 173, bits = '';
    for (let i = 0; i < 8; i++) {
      const w = 2 ** (7 - i);
      if (rem >= w) { rem -= w; bits += '1'; say(w + ' ≤ ' + (rem + w) + '：這格放 1', '剩下 ' + rem); }
      else { bits += '0'; say(w + ' > ' + rem + '：這格放 0', '剩下 ' + rem); }
      row.set(bits.padEnd(8, '0'), true);
      await beat(tok, 900);
    }
    row.clearGlow();
    say('173 = 1010 1101₂', '128 + 32 + 8 + 4 + 1');
    await beat(tok, 2200);
    const h1 = tag('A', 'ptr alt', (row.xs[0] + row.xs[3]) / 2, 0, 2.2), h2 = tag('D', 'ptr alt', (row.xs[4] + row.xs[7]) / 2, 0, 2.2);
    row.ms.slice(0, 4).forEach((m) => glow(m, GOLD));
    say('每 4 bits 一組 = 一個 hex 位數', '1010 = A（10）');
    await beat(tok, 1800);
    row.clearGlow(); row.ms.slice(4).forEach((m) => glow(m, GOLD));
    say('1101 = D（13）', '173 = 0xAD');
    await beat(tok, 2200);
    kill(h1); kill(h2);
    lab.clear();
    lab.frameCamera([0, 5, 13.5], [0, 1.2, 0]);
    const r16 = bitRow(16, 0, 0.45, 0, 0.78);
    say('課本例：eca8₁₆ 轉二進位', '一個 hex 位數直接展開成 4 bits');
    await beat(tok, 1800);
    const H = ['e', 'c', 'a', '8'];
    let acc = '';
    for (let g = 0; g < 4; g++) {
      cube(H[g], '#dd8238', [1, 0.6, 0.8], (r16.xs[g * 4] + r16.xs[g * 4 + 3]) / 2, 0.4, 2.2, 3);
      const nib = parseInt(H[g], 16).toString(2).padStart(4, '0');
      acc += nib;
      r16.set(acc.padEnd(16, '0'), true);
      say(H[g] + ' = ' + parseInt(H[g], 16) + ' = ' + nib, '');
      await beat(tok, 1100);
    }
    r16.clearGlow();
    say('eca8₁₆ = 1110 1100 1010 1000₂', '反過來：每 4 bits 一組換成 hex');
    await beat(tok, 3000);
  }
  async function scTwos(tok) {
    fresh([0, 5, 13.5], [0, 1.2, 0]);
    const row = bitRow(8, 0, 0.45, 0, 1.3);
    row.xs.forEach((x, i) => tag(i === 0 ? '−128' : String(2 ** (7 - i)), i === 0 ? 'ptr' : 'idx', x, 0, 1.1));
    row.set('00000010');
    say('課本例：把 2 變成 −2', '2 = 0000 0010');
    await beat(tok, 2200);
    for (let i = 0; i < 8; i++) { row.set('11111101'.slice(0, i + 1) + '00000010'.slice(i + 1), true); await beat(tok, 160); }
    say('步驟 1：每個 bit 反相', '0000 0010 → 1111 1101');
    await beat(tok, 2000);
    row.clearGlow();
    row.set('11111110', true);
    say('步驟 2：再加 1', '1111 1101 + 1 = 1111 1110');
    await beat(tok, 2200);
    row.clearGlow(); glow(row.ms[0], RED);
    say('MSB 的權重是 −128', '−128 + 64+32+16+8+4+2 = −2');
    await beat(tok, 2800);
    glow(row.ms[0], null);
    say('MSB = 1 就是負數：sign bit', '8 bits 範圍：−128 ～ +127');
    await beat(tok, 2400);
    row.set('10000000', true);
    say('特例：−128 = 1000 0000', '反相 0111 1111，加 1 又變回 1000 0000');
    await beat(tok, 1600);
    row.set('01111111', true); await beat(tok, 900); row.set('10000000', true);
    say('−128 取補數還是自己', '+128 放不進 8 bits（負數比正數多一個）');
    await beat(tok, 3000);
  }
  async function scSignExt(tok) {
    fresh([0, 4.5, 13.5], [0, 1.7, 0]);
    const w = 0.78;
    const top = bitRow(8, 3.12, 3.0, 0, w); top.set('11111110');
    const bot = bitRow(16, 0, 0.45, 0, w);
    tag('8 bits', 'ptr', -1.6, 3.0); tag('16 bits', 'ptr', -7, 0.45);
    say('Sign extension：位數變多，值不變', '課本是 16 → 32 bits，這裡縮成 8 → 16');
    await beat(tok, 2400);
    bot.set('00000000' + '11111110', true);
    say('低 8 位直接照抄', '−2 = 1111 1110');
    await beat(tok, 1800);
    for (let i = 7; i >= 0; i--) { bot.set('0'.repeat(i) + '1'.repeat(8 - i) + '11111110', true); await beat(tok, 140); }
    glow(top.ms[0], GOLD);
    say('高 8 位全部複製 sign bit（1）', '1111 1111 1111 1110 還是 −2');
    await beat(tok, 2600);
    top.clearGlow(); bot.clearGlow();
    top.set('00000010'); bot.set('0000000000000010', true);
    glow(top.ms[0], GOLD);
    say('+2：sign bit 是 0，就補 0', '0000 0000 0000 0010');
    await beat(tok, 2400);
    say('MIPS 的 lw、addi、beq 立即值都先做 sign extend', '補 0 的叫 zero extend（andi、ori）');
    await beat(tok, 3000);
  }
  async function scRipple(tok) {
    fresh([0, 3.4, 14], [0, 2.3, 0]);
    const st = buildAdd(7, 6, '+');
    say('課本例：7 + 6（這裡用 8 bits）', '0000 0111 + 0000 0110');
    await beat(tok, 2200);
    const r = await animateAdd(st, tok, 750, true);
    say('= 0000 1101 = 13', 'carry 從右往左一位一位傳：ripple carry');
    await beat(tok, 2600);
    say('每一位都要等右邊的 carry → 慢', '加速：carry lookahead（並行算 carry）');
    await beat(tok, 2600);
    return r;
  }
  async function scSub(tok) {
    fresh([0, 3.4, 14], [0, 2.3, 0]);
    const st = buildAdd(7, 6, '-');
    say('課本例：7 − 6 = 7 + (−6)', '減法 = 加上 2\'s complement');
    await beat(tok, 2400);
    const r = await animateAdd(st, tok, 700, true);
    say('= 0000 0001 = 1', '最左邊跑出去的 carry ' + r.cout + ' 丟掉');
    await beat(tok, 2600);
    say('硬體只要「反相 + carry-in = 1」', '加法器不用改就能做減法');
    await beat(tok, 2600);
  }
  async function scOverflow(tok) {
    fresh([0, 3.4, 14], [0, 2.3, 0]);
    let st = buildAdd(100, 50, '+');
    say('100 + 50 = 150，8 bits 放得下嗎？', 'signed 8 bits 最大 127');
    await beat(tok, 2200);
    let r = await animateAdd(st, tok, 450, false);
    st.sum.forEach((m) => glow(m, RED));
    say('正 + 正 = 負（−106）→ overflow', '進 MSB 的 carry ' + r.cinMSB + ' ≠ 出 MSB 的 carry ' + r.cout);
    await beat(tok, 3000);
    fresh([0, 3.4, 14], [0, 2.3, 0]);
    st = buildAdd(-100, 50, '-');
    say('−100 − 50 = −150？', '負 + 負');
    await beat(tok, 1800);
    r = await animateAdd(st, tok, 450, false);
    st.sum.forEach((m) => glow(m, RED));
    say('負 − 正 = 正（+106）→ overflow', 'carry in ' + r.cinMSB + ' ≠ carry out ' + r.cout);
    await beat(tok, 3000);
    say('同號相加、或異號相減，才可能 overflow', '正 + 負 永遠不會 overflow');
    await beat(tok, 2800);
    say('MIPS：add/addi/sub 溢位會產生 exception', 'addu/addiu/subu 不檢查（C 的 unsigned 用）');
    await beat(tok, 3200);
  }
  async function scALU(tok) {
    fresh([0, 3.6, 14], [0, 3.2, 0]);
    const box = (t, c, x, y, w = 1.6, h = 0.9) => cube(t, c, [w, h, 0.6], x, y, 0);
    const AND = box('AND', '#4b9ee2', -2, 5.2), OR = box('OR', '#9b7ef4', -2, 3.6), ADD = box('+', '#dd8238', -2, 2.0);
    const MUX = box('MUX', '#6e5f49', 2.2, 3.6, 1.0, 4.2);
    tag('a', 'ptr', -6, 4.4); tag('b', 'ptr', -6, 2.8);
    for (const y of [5.2, 3.6, 2.0]) { line([[-5.6, 4.4, 0], [-4, 4.4, 0], [-4, y + 0.15, 0], [-2.8, y + 0.15, 0]]); line([[-5.6, 2.8, 0], [-4.4, 2.8, 0], [-4.4, y - 0.15, 0], [-2.8, y - 0.15, 0]]); }
    const outs = [5.2, 3.6, 2.0].map((y, i) => line([[-1.2, y, 0], [1.7, 3.6 + (1 - i) * 1.2, 0]]));
    tag('Operation', 'idx', 2.2, 1.0); tag('CarryIn', 'idx', -2, 0.9);
    const res = tag('Result = ?', 'ptr alt', 5, 3.6);
    line([[2.7, 3.6, 0], [4, 3.6, 0]]);
    say('1-bit ALU：AND、OR、加法器 + MUX', '附錄 B（5 版為附錄 C）的設計');
    await beat(tok, 2600);
    const a = 1, b = 0, vals = [a & b, a | b, a ^ b];
    const names = ['AND', 'OR', 'add'];
    for (let op = 0; op < 3; op++) {
      [AND, OR, ADD].forEach((m, i) => glow(m, i === op ? GOLD : null));
      outs.forEach((l, i) => l.material.color.set(i === op ? '#c08a1f' : '#8a7a5c'));
      txt(res, 'Result = ' + vals[op]);
      say('Operation = ' + op + '：選 ' + names[op], 'a = 1, b = 0 → ' + names[op] + ' = ' + vals[op]);
      await beat(tok, 1800);
    }
    [AND, OR, ADD].forEach((m) => glow(m, null));
    say('減法：Binvert 選 ¬b，CarryIn = 1', 'a + ¬b + 1 = a − b');
    await beat(tok, 2600);
    lab.clear();
    lab.frameCamera([0, 3.6, 14], [0, 2.6, 0]);
    const A = '0111', B = '0110', Bn = inv(B);
    const sx = (i) => 4.8 - i * 3.2; // bit i (0 = LSB) on the right
    const slices = [], rl = [];
    for (let i = 0; i < 4; i++) {
      slices.push(cube('ALU' + i, '#6e5f49', [2.0, 1.6, 0.8], sx(i), 2.6, 0));
      tag('a' + i + '=' + A[3 - i] + '  ¬b' + i + '=' + Bn[3 - i], 'idx', sx(i), 4.0);
      rl.push(tag('', 'ptr alt', sx(i), 1.2));
    }
    tag('7 − 6：a = 0111，b = 0110 → ¬b = 1001', 'ptr', 0, 5.6);
    let c = 1;
    const cin = cube('1', '#c08a1f', [0.5, 0.4, 0.5], sx(0) + 1.5, 2.6, 0, 2);
    say('4 個 1-bit ALU 串起來：carry 一路往左', 'CarryIn₀ = 1（減法）');
    await beat(tok, 2200);
    let out = '';
    for (let i = 0; i < 4; i++) {
      const ai = +A[3 - i], bi = +Bn[3 - i];
      const s = ai ^ bi ^ c, co = (ai & bi) | (ai & c) | (bi & c);
      glow(slices[i], GOLD); txt(rl[i], 'Result' + i + ' = ' + s);
      out = s + out;
      say('ALU' + i + '：' + ai + ' + ' + bi + ' + ' + c + ' → ' + s + '，carry ' + co, '');
      c = co;
      if (i < 3) { const m = cube(String(co), '#c08a1f', [0.5, 0.4, 0.5], sx(i) - 1.3, 2.6, 0); move(m, sx(i) - 1.6, 2.6, 0); }
      await beat(tok, 1300);
      glow(slices[i], null);
    }
    kill(cin);
    say('Result = 0001 = 1', 'Zero = NOR(全部 Result) = 0；slt 看 a − b 的 sign bit');
    await beat(tok, 3000);
    say('ALU control：0000 AND、0001 OR、0010 add', '0110 sub、0111 slt、1100 NOR');
    await beat(tok, 3200);
  }
  async function scMultV1(tok) {
    fresh([0, 3.2, 13.5], [0, 2.6, 0]);
    const last = await playSteps(tok, 'v1', 2, 3, 1500, true);
    say('2 × 3 = 0000 0110 = 6', '4 輪、每輪：判斷 → 加 → 移位');
    await beat(tok, 3000);
    return last;
  }
  async function scMultV2(tok) {
    fresh([0, 3.2, 13.5], [0, 2.6, 0]);
    await playSteps(tok, 'v2', 2, 3, 1500, true);
    say('結果一樣是 0000 0110', '改良版：Multiplicand 不用移、加法器只要一半寬');
    await beat(tok, 3000);
  }
  async function scBooth(tok) {
    fresh([0, 3.2, 13.5], [0, 2.6, 0]);
    await playSteps(tok, 'booth', 2, -3, 1500, true);
    say('2 × (−3) = 1111 1010 = −6', '補充：Booth 直接處理 signed（張凡講義常考）');
    await beat(tok, 3200);
  }
  async function scDiv(tok) {
    fresh([0, 3.2, 13.5], [0, 2.6, 0]);
    await playSteps(tok, 'div', 7, 2, 1300, true);
    say('7 ÷ 2：Quotient 0011 = 3，Remainder 1', '4 bits 要做 5 輪；減完是負的就「還原」');
    await beat(tok, 3200);
    say('有號除法：先當正數除，再補號', '餘數的正負號跟被除數相同');
    await beat(tok, 2800);
  }
  async function scIeeeEncode(tok) {
    fresh([0, 4.2, 13.5], [0, 1.0, 0]);
    const row = floatRow();
    say('課本例：−0.75 用 single precision 表示', '');
    await beat(tok, 2000);
    const t = tag('−0.75 = −3/4 = −0.11₂', 'ptr alt', 0, 3.6);
    await beat(tok, 1800);
    txt(t, '−0.11₂ = −1.1₂ × 2⁻¹');
    say('先寫成 normalized 科學記號', '1.xxxx × 2^e');
    await beat(tok, 2200);
    let b = '1' + '0'.repeat(31); row.set(b, true);
    say('負數 → S = 1', '(−1)^S');
    await beat(tok, 1800);
    b = '1' + '01111110' + '0'.repeat(23); row.set(b, true);
    say('指數 −1 加上 bias 127 = 126', 'E = 0111 1110');
    await beat(tok, 2400);
    b = '1' + '01111110' + '1' + '0'.repeat(22); row.set(b, true);
    say('1.1 的「1.」不存（hidden bit）', 'Fraction = .1000…0');
    await beat(tok, 2400);
    row.clearGlow();
    say('= 1011 1111 0100 0000 … = 0xBF400000', '');
    await beat(tok, 2600);
    txt(t, 'double：1 + 11 + 52 bits，bias 1023');
    say('double：E = −1 + 1023 = 1022', '格式一樣，只是更寬');
    await beat(tok, 3000);
  }
  async function scIeeeDecode(tok) {
    fresh([0, 4.2, 13.5], [0, 1.0, 0]);
    const row = floatRow();
    const b = '1' + '10000001' + '01' + '0'.repeat(21);
    row.set(b, true);
    say('課本例：這 32 bits 是多少？', '1 10000001 0100…0');
    await beat(tok, 2400);
    row.clearGlow(); glow(row.ms[0], GOLD);
    say('S = 1 → 負數', '');
    await beat(tok, 1600);
    row.clearGlow(); row.ms.slice(1, 9).forEach((m) => glow(m, GOLD));
    say('E = 129 → 實際指數 129 − 127 = 2', '');
    await beat(tok, 2200);
    row.clearGlow(); row.ms.slice(9).forEach((m) => glow(m, GOLD));
    say('F = .01 → 1.01₂ = 1.25', '記得補回 hidden 1');
    await beat(tok, 2200);
    row.clearGlow();
    tag('(−1)¹ × 1.25 × 2² = −5.0', 'ptr alt', 0, 3.4);
    say('= −1.25 × 4 = −5.0', '(−1)^S × (1 + F) × 2^(E − 127)');
    await beat(tok, 3200);
  }
  async function scIeeeSpecial(tok) {
    fresh([0, 4.2, 13.5], [0, 1.0, 0]);
    const row = floatRow();
    const t = tag('', 'ptr alt', 0, 3.4);
    const cases = [
      ['0' + '0'.repeat(31), 'E = 0、F = 0 → ±0', '0 有 +0、−0 兩種'],
      ['0' + '00000000' + '0'.repeat(22) + '1', 'E = 0、F ≠ 0 → denormalized', '0.F × 2⁻¹²⁶；最小 2⁻¹⁴⁹'],
      ['0' + '00000001' + '0'.repeat(23), '最小 normalized：1.0 × 2⁻¹²⁶', 'E 用 1 ～ 254'],
      ['0' + '11111110' + '1'.repeat(23), '最大：≈ 2 × 2¹²⁷ ≈ 3.4 × 10³⁸', 'E = 254 → 指數 127'],
      ['0' + '11111111' + '0'.repeat(23), 'E = 255、F = 0 → ∞', '例如 1/0'],
      ['0' + '11111111' + '1' + '0'.repeat(22), 'E = 255、F ≠ 0 → NaN', '例如 0/0、√−1'],
    ];
    say('E 全 0、全 1 保留給特殊值', '');
    await beat(tok, 2000);
    for (const [b, c1, c2] of cases) {
      row.set(b, true); txt(t, c1);
      say(c1, c2);
      await beat(tok, 2600);
      row.clearGlow();
    }
    say('denormalized 讓接近 0 的數慢慢變少（gradual underflow）', '沒有 hidden 1，指數固定 −126');
    await beat(tok, 3000);
  }
  async function scFpAdd(tok) {
    fresh([0, 4.2, 13.5], [0, 2.4, 0]);
    const slot = (k) => -1.6 + k * 1.0;
    const mk = (bits, y, color) => bits.split('').map((b, k) => cube(b, color, [0.8, 0.6, 0.8], slot(k), y, 0, 2));
    const dot = (y) => tag('.', 'val', slot(0) + 0.5, y);
    say('課本例：0.5 + (−0.4375)，有效位數 4 bits', '');
    await beat(tok, 2000);
    let X = mk('1000', 4.6, '#4b9ee2'); dot(4.6); const ex = tag('× 2⁻¹', 'ptr', 3.6, 4.6); tag('0.5 =', 'idx', -3.6, 4.6);
    let Y = mk('1110', 3.2, '#dd8238'); dot(3.2); const ey = tag('× 2⁻²', 'ptr', 3.6, 3.2); tag('−0.4375 = −', 'idx', -3.8, 3.2);
    await beat(tok, 2000);
    say('1. 對齊：指數小的往右移', '−1.110 × 2⁻² = −0.111 × 2⁻¹');
    await beat(tok, 1200);
    fly(Y[3], V3(3, 5, 3));
    for (let k = 2; k >= 0; k--) move(Y[k], slot(k + 1), 3.2);
    Y = [cube('0', '#dd8238', [0.8, 0.6, 0.8], slot(0), 3.2, 0, 2), Y[0], Y[1], Y[2]];
    txt(ey, '× 2⁻¹');
    await beat(tok, 2400);
    line([[-2.4, 2.4, 0], [2.4, 2.4, 0]], '#6e5f49');
    say('2. 有效數相加：1.000 − 0.111 = 0.001', '');
    let Z = mk('0001', 1.5, '#2fc092'); dot(1.5); const ez = tag('× 2⁻¹', 'ptr alt', 3.6, 1.5);
    await beat(tok, 2600);
    say('3. 正規化：左移 3 位 → 1.000 × 2⁻⁴', '檢查 −126 ≤ −4 ≤ 127：沒有 overflow / underflow');
    for (let k = 0; k < 3; k++) fly(Z[k], V3(-4, 5, 3));
    move(Z[3], slot(0), 1.5);
    Z = [Z[3], ...[1, 2, 3].map((k) => cube('0', '#2fc092', [0.8, 0.6, 0.8], slot(k), 1.5, 0, 2))];
    txt(ez, '× 2⁻⁴');
    await beat(tok, 3000);
    say('4. 捨入：剛好 4 bits，不用動', '結果 1.000 × 2⁻⁴ = 0.0625');
    await beat(tok, 3000);
    return [X, ex];
  }
  async function scRound(tok) {
    fresh([0, 4.2, 13.5], [0, 2.4, 0]);
    const slot = (k) => -2.6 + k * 1.1;
    const tiles = [3, 4].map((k) => { const g = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.2, 0.2), new THREE.MeshBasicMaterial({ color: '#f3dd9a', transparent: true, opacity: 0.45, depthWrite: false })); g.position.set(slot(k), 3.1, -0.6); lab.world.add(g); return g; });
    tag('guard', 'idx', slot(3), 5.5); tag('round', 'idx', slot(4), 5.5);
    const mk = (ds, y, c) => ds.map((d, k) => (d === null ? null : cube(String(d), c, [0.85, 0.6, 0.85], slot(k), y, 0, 2)));
    say('課本例：2.56 × 10⁰ + 2.34 × 10²', '十進位、只能存 3 位有效數字');
    await beat(tok, 2200);
    mk([2, 3, 4], 4.6, '#4b9ee2'); tag('.', 'val', slot(0) + 0.55, 4.6); tag('× 10²', 'ptr', 3.6, 4.6);
    const B = mk([2, 5, 6], 3.4, '#dd8238'); tag('× 10⁰', 'ptr', 3.6, 3.4);
    await beat(tok, 1800);
    say('對齊：2.56 往右移 2 位 → 0.0256', '多留兩位：guard、round');
    B.forEach((m, k) => move(m, slot(k + 2), 3.4));
    const z0 = cube('0', '#dd8238', [0.85, 0.6, 0.85], slot(0), 3.4, 0, 2), z1 = cube('0', '#dd8238', [0.85, 0.6, 0.85], slot(1), 3.4, 0, 2);
    tag('.', 'val', slot(0) + 0.55, 3.4);
    await beat(tok, 2600);
    say('相加：2.3400 + 0.0256 = 2.3656', '');
    mk([2, 3, 6, 5, 6], 1.6, '#2fc092'); tag('.', 'val', slot(0) + 0.55, 1.6);
    await beat(tok, 2400);
    say('看 guard/round = 56 > 50 → 進位', '= 2.37 × 10²');
    tag('→ 2.37 × 10²', 'ptr alt', 4.4, 1.6);
    await beat(tok, 2600);
    say('沒有 guard/round：0.0256 被砍成 0.02', '2.34 + 0.02 = 2.36（差 1 ulp）');
    glow(B[1], RED); glow(B[2], RED);
    await beat(tok, 3000);
    say('IEEE 754 另加 sticky bit：右邊還有沒有非 0', '預設模式：round to nearest even');
    await beat(tok, 3000);
    return [tiles, z0, z1];
  }
  async function scAssoc(tok) {
    fresh([0, 4.2, 13], [0, 2, 0]);
    const big = (t, c, x) => cube(t, c, [2.4, 1.6, 1.2], x, 0.8, 0, 2);
    say('浮點加法沒有結合律', 'x = −1.5×10³⁸，y = 1.5×10³⁸，z = 1.0');
    let x = big('x = −1.5e38', '#d64545', -4), y = big('y = 1.5e38', '#4b9ee2', 0), z = cube('z = 1', '#2fc092', [0.9, 0.6, 0.6], 4, 0.3, 0, 2);
    tag('(x + y) + z', 'ptr', 0, 4.4);
    await beat(tok, 2400);
    move(x, -1.2, 0.8); move(y, 1.2, 0.8);
    await beat(tok, 900);
    fly(x); fly(y);
    const zero = cube('0.0', '#c9b48e', [1.0, 0.6, 0.6], 0, 0.3, 0, 2);
    say('x + y = 0.0', '大小相同、正負相反，剛好抵消');
    await beat(tok, 1800);
    move(z, 1.2, 0.3);
    await beat(tok, 900);
    say('(x + y) + z = 1.0', '');
    tag('= 1.0', 'ptr alt', 0, 3.6);
    await beat(tok, 2400);
    lab.clear();
    x = big('x = −1.5e38', '#d64545', -4); y = big('y = 1.5e38', '#4b9ee2', 0); z = cube('z = 1', '#2fc092', [0.9, 0.6, 0.6], 4, 0.3, 0, 2);
    tag('x + (y + z)', 'ptr', 0, 4.4);
    say('換個順序：先算 y + z', '');
    await beat(tok, 1800);
    move(z, 1.4, 0.3);
    await beat(tok, 800);
    fly(z, V3(0, 3, -2));
    say('1.0 太小，被 1.5×10³⁸ 吃掉', 'y + z 捨入後還是 1.5×10³⁸');
    await beat(tok, 2600);
    move(x, -1.2, 0.8); move(y, 1.2, 0.8);
    await beat(tok, 900);
    fly(x); fly(y);
    tag('= 0.0', 'ptr alt', 0, 3.6);
    say('x + (y + z) = 0.0', '(x + y) + z ≠ x + (y + z)：常考陷阱');
    await beat(tok, 3200);
    return zero;
  }
  async function scCpuTime(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('課本例：A 是 2 GHz，程式跑 10 秒', 'cycles = 10 s × 2×10⁹ = 20×10⁹');
    const stackA = [], stackB = [];
    for (let k = 0; k < 10; k++) { stackA.push(cube(k === 9 ? '20×10⁹' : '', '#4b9ee2', [1.6, 0.42, 1.2], -3.5, 0.21 + k * 0.46, 0, 3)); await beat(tok, 120); }
    tag('A：2 GHz', 'ptr', -3.5, 0, 1.4);
    await beat(tok, 2000);
    say('要設計 B：只要 6 秒，但 cycles 變 1.2 倍', '24×10⁹ cycles');
    for (let k = 0; k < 12; k++) { stackB.push(cube(k === 11 ? '24×10⁹' : '', '#dd8238', [1.6, 0.42, 1.2], 1.5, 0.21 + k * 0.46, 0, 3)); await beat(tok, 120); }
    await beat(tok, 2000);
    tag('B：? GHz', 'ptr alt', 1.5, 0, 1.4);
    say('clock rate = cycles ÷ 時間', '24×10⁹ ÷ 6 s = 4 GHz');
    await beat(tok, 2800);
    say('CPU time = IC × CPI × clock cycle time', '= IC × CPI ÷ clock rate');
    await beat(tok, 3000);
    say('IC 看程式／compiler／ISA；CPI 看 ISA／organization', 'clock rate 看 organization／technology');
    await beat(tok, 3200);
  }
  async function scAmdahl(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const H = 0.06;
    const u = bar('#c9b48e', 2, 1.6, -4, 0), a = bar('#9b7ef4', 2, 1.6, -4, 0);
    setBar(u, 20 * H); setBar(a, 80 * H, 20 * H);
    tag('乘法 80 s', 'idx', -6.2, 20 * H + 40 * H); tag('其他 20 s', 'idx', -6.2, 10 * H);
    tag('原本 100 s', 'ptr', -4, 0, 1.4);
    say('課本例：程式 100 秒，乘法占 80 秒', '想讓整個程式快 5 倍（20 秒）？');
    await beat(tok, 2800);
    const u2 = bar('#c9b48e', 2, 1.6, 2, 0), a2 = bar('#9b7ef4', 2, 1.6, 2, 0);
    setBar(u2, 20 * H);
    const lt = tag('', 'ptr alt', 2, 0, 1.4), at = tag('', 'idx', 4.4, 1);
    for (const n of [1, 2, 4, 8, 16, 100]) {
      const t = 20 + 80 / n;
      setBar(a2, 80 / n * H, 20 * H);
      txt(lt, '乘法快 ' + n + ' 倍 → ' + (+t.toFixed(1)) + ' s'); at.position.y = 20 * H + 80 / n * H + 0.3; txt(at, (+(80 / n).toFixed(1)) + ' s');
      say('乘法改善 ' + n + ' 倍', '20 + 80/' + n + ' = ' + (+t.toFixed(1)) + ' s');
      await beat(tok, 1300);
    }
    const lim = line([[-6, 20 * H, 0.9], [6, 20 * H, 0.9]], '#d64545');
    say('乘法再快，20 秒的部分也不會變', '20 = 80/n + 20 → 不可能快 5 倍');
    await beat(tok, 3200);
    say('Amdahl：先加速常見的情況', 'Speedup ≤ 1 / (1 − f)');
    await beat(tok, 3000);
    return lim;
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function uniq(ans, wrong) { const o = [ans]; for (const w of wrong) if (!o.includes(w) && o.length < 4) o.push(w); let k = 1; while (o.length < 4) o.push(ans + '（×' + k++ + '）'); return o; }
  function genQ() {
    const t = R(0, 9);
    if (t === 0) {
      const v = R(16, 255), h = '0x' + v.toString(16).toUpperCase().padStart(2, '0');
      return { q: '十進位 ' + v + ' 的 8-bit 二進位與 hex 是？', opts: uniq(grp(bin(v, 8)) + ' = ' + h, [grp(bin(v ^ 1, 8)) + ' = 0x' + (v ^ 1).toString(16).toUpperCase().padStart(2, '0'), grp(bin(v, 8).split('').reverse().join('')) + ' = 0x' + uval(bin(v, 8).split('').reverse().join('')).toString(16).toUpperCase().padStart(2, '0'), grp(bin(v + 16, 8)) + ' = 0x' + ((v + 16) & 255).toString(16).toUpperCase().padStart(2, '0')]), ans: grp(bin(v, 8)) + ' = ' + h, why: '用權重 128、64、…、1 拆，再 4 bits 一組換成 hex。' };
    }
    if (t === 1) {
      const v = -R(1, 127);
      const ans = grp(bin(v, 8));
      return { q: v + ' 的 8-bit 2\'s complement 是？', opts: uniq(ans, [grp(inv(bin(-v, 8))), grp('1' + bin(-v, 7)), grp(bin(-v, 8))]), ans, why: '|' + v + '| = ' + grp(bin(-v, 8)) + '，反相得 ' + grp(inv(bin(-v, 8))) + '（1\'s complement），再 +1。' };
    }
    if (t === 2) {
      const a = R(-128, 127), b = R(-128, 127), s = a + b, w = sval(bin(s, 8)), ov = s > 127 || s < -128;
      const ans = ov ? '會 overflow，bits 讀起來是 ' + w : '不會，結果 ' + s;
      return { q: '8-bit 2\'s complement：' + a + ' + ' + b + ' 會 overflow 嗎？', opts: uniq(ans, [ov ? '不會，結果 ' + s : '會 overflow，bits 讀起來是 ' + (s - 256), '會 overflow，結果是 0', ov ? '會 overflow，bits 讀起來是 ' + (-w) : '會 overflow，bits 讀起來是 ' + (s + 1)]), ans, why: '真正的和 ' + s + (ov ? ' 超出 −128 ～ 127；同號相加結果變號。' : ' 在 −128 ～ 127 內。') + (a * b < 0 ? '異號相加永遠不會 overflow。' : '') };
    }
    if (t === 3 || t === 4) {
      const e = R(-3, 4), k = R(0, 7), neg = Math.random() < 0.5;
      const x = (neg ? -1 : 1) * (1 + k / 8) * 2 ** e;
      const h = '0x' + hexOf(fbits(x));
      if (t === 3) {
        const wrongBias = '0x' + hexOf((neg ? '1' : '0') + bin(e + 128, 8) + bin(k, 3) + '0'.repeat(20));
        const noHidden = '0x' + hexOf((neg ? '1' : '0') + bin(e + 127, 8) + ('1' + bin(k, 3)).slice(0, 4) + '0'.repeat(19));
        const flip = '0x' + hexOf((neg ? '0' : '1') + bin(e + 127, 8) + bin(k, 3) + '0'.repeat(20));
        return { q: x + ' 的 IEEE 754 single precision（hex）是？', opts: uniq(h, [wrongBias, noHidden, flip]), ans: h, why: x + ' = ' + (neg ? '−' : '') + '1.' + bin(k, 3) + '₂ × 2^' + e + '；S = ' + (neg ? 1 : 0) + '，E = ' + e + ' + 127 = ' + (e + 127) + '，F = ' + bin(k, 3) + '0…（hidden 1 不存）。' };
      }
      const ans = String(x);
      return { q: 'IEEE 754 single 0x' + hexOf(fbits(x)) + ' 代表的十進位是？', opts: uniq(ans, [String(-x), String(x * 2), String((neg ? -1 : 1) * (k / 8) * 2 ** e)]), ans, why: 'S = ' + (neg ? 1 : 0) + '，E = ' + (e + 127) + ' → 指數 ' + e + '，1.F = ' + (1 + k / 8) + ' → ' + x + '。' };
    }
    if (t === 5) {
      const IC = R(2, 20), CPI = pickOne([0.8, 1, 1.2, 1.5, 2, 2.5]), G = pickOne([1, 2, 2.5, 4]);
      const T = +(IC * CPI / G).toFixed(3);
      return { q: '程式有 ' + IC + '×10⁹ 個指令，CPI = ' + CPI + '，clock rate ' + G + ' GHz，CPU time 是？', opts: uniq(T + ' s', [+(IC * CPI * G).toFixed(3) + ' s', +(IC / (CPI * G)).toFixed(3) + ' s', +(IC * G / CPI).toFixed(3) + ' s']), ans: T + ' s', why: 'CPU time = IC × CPI ÷ clock rate = ' + IC + '×10⁹ × ' + CPI + ' ÷ ' + G + '×10⁹ = ' + T + ' s。' };
    }
    if (t === 6) {
      const f = pickOne([0.5, 0.6, 0.75, 0.8, 0.9]), s = pickOne([2, 4, 5, 10]);
      const sp = +(1 / (1 - f + f / s)).toFixed(2);
      return { q: '程式有 ' + f * 100 + '% 的時間可以加速 ' + s + ' 倍，整體 speedup 約多少？', opts: uniq(sp + '×', [s + '×', +(f * s).toFixed(2) + '×', +(1 / (1 - f)).toFixed(2) + '×']), ans: sp + '×', why: 'Amdahl：1 / ((1 − ' + f + ') + ' + f + '/' + s + ') = ' + sp + '；上限是 1/(1 − f) = ' + +(1 / (1 - f)).toFixed(2) + '。' };
    }
    if (t === 7) {
      const c = pickOne([['00000000', '全 0', '±0'], ['00000000', '不是 0', 'denormalized number'], ['11111111', '全 0', '±∞'], ['11111111', '不是 0', 'NaN'], ['10000010', '任意', 'normalized number']]);
      return { q: 'IEEE 754 single：exponent = ' + c[0] + '，fraction ' + c[1] + '，代表什麼？', opts: uniq(c[2], ['±0', 'denormalized number', '±∞', 'NaN', 'normalized number'].filter((x) => x !== c[2])), ans: c[2], why: 'E 全 0：F = 0 是 ±0、F ≠ 0 是 denormalized；E 全 1：F = 0 是 ±∞、F ≠ 0 是 NaN；其餘 normalized。' };
    }
    if (t === 8) {
      const n = pickOne([4, 8, 16, 32]);
      const ans = (n + 1) + ' 輪';
      return { q: '課本第一版 restoring 除法器做 ' + n + '-bit 除法，要跑幾輪？', opts: uniq(ans, [n + ' 輪', 2 * n + ' 輪', (n - 1) + ' 輪']), ans, why: 'Divisor 一開始放在左半，第一輪一定是負的，所以 n bits 要 n + 1 輪；乘法器則是 n 輪。' };
    }
    const q = pickOne([
      { q: '浮點數 (x + y) + z 和 x + (y + z) 的關係？', ans: '不一定相等（沒有結合律）', w: ['一定相等', '只有整數才不相等', '只有 double 才相等'], why: '例：x = −1.5e38、y = 1.5e38、z = 1：一個是 1.0，一個是 0.0。' },
      { q: 'IEEE 754 single 的 exponent bias 是？', ans: '127', w: ['128', '1023', '126'], why: '8 bits exponent，bias = 2⁷ − 1 = 127；double 是 1023。' },
      { q: 'MIPS 哪個指令在 2\'s complement overflow 時會產生 exception？', ans: 'add', w: ['addu', 'addiu', 'subu'], why: 'add/addi/sub 會檢查 overflow；u 結尾的不檢查。' },
      { q: '4-bit 2\'s complement 能表示的範圍？', ans: '−8 ～ 7', w: ['−7 ～ 7', '−8 ～ 8', '0 ～ 15'], why: '−2ⁿ⁻¹ ～ 2ⁿ⁻¹ − 1，負數比正數多一個。' },
      { q: 'IEEE 754 捨入時額外保留的三個 bit 是？', ans: 'guard、round、sticky', w: ['carry、overflow、sign', 'hidden、guard、parity', 'sign、exponent、fraction'], why: 'guard、round 多保留兩位，sticky 記錄更右邊有沒有非 0。' },
    ]);
    return { q: q.q, opts: uniq(q.ans, q.w), ans: q.ans, why: q.why };
  }
  const qs = { score: 0, total: 0 };
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

  const scenes = {
    'bin-hex': { title: '課本：十進位、二進位、十六進位互轉', play: scBinHex },
    'twos-complement': { title: '課本：2\'s complement（2 → −2）', play: scTwos },
    'sign-extend': { title: '課本：sign extension', play: scSignExt },
    'ripple-add': { title: '課本：7 + 6，carry 一位一位傳', play: scRipple },
    'subtract': { title: '課本：7 − 6 = 7 + (−6)', play: scSub },
    'overflow': { title: 'Overflow：carry in ≠ carry out', play: scOverflow },
    'alu-1bit': { title: '課本附錄：1-bit ALU 串成 4-bit ALU', play: scALU },
    'mult-v1': { title: '課本：乘法器第一版 2 × 3', play: scMultV1 },
    'mult-v2': { title: '課本：改良版乘法器 2 × 3', play: scMultV2 },
    'booth': { title: '補充：Booth 演算法 2 × (−3)', play: scBooth },
    'div-restore': { title: '課本：restoring 除法 7 ÷ 2', play: scDiv },
    'ieee-encode': { title: '課本：−0.75 編成 IEEE 754', play: scIeeeEncode },
    'ieee-decode': { title: '課本：1 10000001 01… = −5.0', play: scIeeeDecode },
    'ieee-special': { title: 'IEEE 754 特殊值：0、denormal、∞、NaN', play: scIeeeSpecial },
    'fp-add': { title: '課本：浮點加法 0.5 + (−0.4375)', play: scFpAdd },
    'fp-rounding': { title: '課本：guard / round digit 捨入', play: scRound },
    'fp-assoc': { title: '浮點加法沒有結合律', play: scAssoc },
    'cpu-time': { title: '課本：CPU time 與 clock rate', play: scCpuTime },
    'amdahl': { title: '課本：Amdahl\'s law（乘法占 80 秒）', play: scAmdahl },
  };

  return {
    kicker: '計算機組織・第 1 章',
    title: '數字系統與運算',
    color: 'var(--ca)',
    modes: [
      { id: 'bits', name: '進位與補數', enter: enterBits },
      { id: 'add', name: '加減法與 overflow', enter: enterAdd },
      { id: 'mult', name: '乘法器', enter: () => enterMult(false) },
      { id: 'div', name: '除法器', enter: () => enterMult(true) },
      { id: 'float', name: 'IEEE 754', enter: enterFloat },
      { id: 'perf', name: 'CPU time / Amdahl', enter: enterPerf },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['bin-hex', 'twos-complement', 'sign-extend', 'ripple-add', 'subtract', 'overflow', 'alu-1bit',
      'mult-v1', 'mult-v2', 'booth', 'div-restore', 'ieee-encode', 'ieee-decode', 'ieee-special', 'fp-add', 'fp-rounding', 'fp-assoc',
      'cpu-time', 'amdahl'],
    stop() { run++; },
  };
}
